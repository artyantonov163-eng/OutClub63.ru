import {createHmac} from 'node:crypto';
import {validateConfig, verifyPassword, issueSession, readSession} from '../server/auth.mjs';
const TTL=30*24*3600*1000, WINDOW=15*60*1000;
const security={
 'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'same-origin',
 'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"
};
const cookie=(value,age)=>`out_session=${value}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${age}`;
const json=(statusCode,data,headers={})=>({statusCode,headers:{...security,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers},body:JSON.stringify(data)});
// Conditional writes keep attempts correct across concurrent calls and cold starts.
async function reserveAttempt(store,key,time) {
 for(let retry=0;retry<12;retry++) {
  const old=await store.get(key);
  const saved=old?JSON.parse(old.body.toString()):null;
  if(saved && (!Number.isInteger(saved.count)||!Number.isFinite(saved.until))) throw Error('Invalid state');
  const attempt=saved?.until>time?saved:{count:0,until:time+WINDOW};
  if(attempt.count>=10)return Math.ceil((attempt.until-time)/1000);
  attempt.count++;
  if(await store.put(key,JSON.stringify(attempt),old?.etag))return 0;
 }
 throw Error('State contention');
}
export function createHandler({store,files,origin,now=Date.now}) {
 return async event=>{
  try {
   let url;
   try {url=decodeURIComponent((event.url || event.path || '/').split('?')[0]);}catch{return json(400,{error:'Invalid path'});}
   if(!url.startsWith('/') || /[\\\0]/.test(url) || url.split('/').some(p=>p==='.'||p==='..'))return json(400,{error:'Invalid path'});
   const method=event.httpMethod;
   if(!['GET','POST','HEAD'].includes(method))return json(405,{error:'Method not allowed'});
   const headers=Object.fromEntries(Object.entries(event.headers||{}).map(([k,v])=>[k.toLowerCase(),String(v)]));
   if(method==='POST' && (headers.origin!==origin || headers['sec-fetch-site']==='cross-site'))return json(403,{error:'Invalid origin'});
   const asset=files[url];
   if(asset && !asset.private && ['GET','HEAD'].includes(method))return await serve(store,asset,method);
   if(!url.startsWith('/api/') && !asset)return json(404,{error:'Not found'});
   const authObject=await store.get('runtime/auth.json');
   const config=validateConfig(JSON.parse(authObject.body.toString()));
   const raw=(headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('out_session='))?.slice(12);
   const session=readSession(raw,config,now());
   const validId=session && /^[a-f0-9]{48}$/.test(session.id);
   const authenticated=!!(validId && !await store.exists(`runtime/revoked/${session.id}.json`));
   if(url==='/api/session' && method==='GET')return json(200,{authenticated});
   if(url==='/api/login' && method==='POST'){
    const ip=event.requestContext?.identity?.sourceIp;
    if(!ip)return json(503,{error:'Client address unavailable'});
    const key=createHmac('sha256',config.secret).update(ip).digest('hex');
    const wait=await reserveAttempt(store,`runtime/attempts/${key}.json`,now());
    if(wait)return json(429,{error:'Too many attempts. Try again later.'},{'Retry-After':String(wait)});
    if(!/^application\/json(?:;|$)/i.test(headers['content-type']||''))return json(415,{error:'JSON required'});
    const body=event.isBase64Encoded?Buffer.from(event.body||'','base64').toString():event.body||'';
    if(Buffer.byteLength(body)>4096)return json(413,{error:'Request too large'});
    let data;try{data=JSON.parse(body);}catch{return json(400,{error:'Invalid JSON'});}
    if(!verifyPassword(data?.password,config))return json(401,{error:'Неверный пароль'});
    return json(200,{ok:true},{'Set-Cookie':cookie(issueSession(config,now(),TTL),TTL/1000)});
   }
   if(url==='/api/logout' && method==='POST'){
    if(validId)await store.putUnconditional(`runtime/revoked/${session.id}.json`,JSON.stringify({exp:session.exp}));
    return json(200,{ok:true},{'Set-Cookie':cookie('',0)});
   }
   if(asset?.private && ['GET','HEAD'].includes(method))return authenticated?await serve(store,asset,method):json(401,{error:'Authentication required'});
   return json(404,{error:'Not found'});
  }catch{return json(503,{error:'Service unavailable'});}
 };
}
async function serve(store,asset,method){
 const file=await store.get(asset.key);
 if(!file)return json(404,{error:'Not found'});
 return {statusCode:200,headers:{...security,'Content-Type':asset.type,'Cache-Control':asset.private?'no-store':'no-cache',...(asset.private?{'Content-Security-Policy':"default-src 'none'; sandbox"}:{})},isBase64Encoded:true,body:method==='HEAD'?'':file.body.toString('base64')};
}

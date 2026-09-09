import test from 'node:test';
import assert from 'node:assert/strict';
import {createHandler} from '../serverless/app.mjs';
import {makeConfig} from '../server/auth.mjs';
function fixture(){
 const map=new Map();let version=0,time=1000000;
 const write=(key,body)=>map.set(key,{body:Buffer.from(body),etag:String(++version)});
 const config=makeConfig('fixture password 123');write('runtime/auth.json',JSON.stringify(config));
 write('pub/index','public page');write('priv/data','private data');
 const store={async get(k){return map.get(k)||null;},async exists(k){return map.has(k);},async put(k,b,etag){if((map.get(k)?.etag)!==etag)return false;write(k,b);return true;},async putUnconditional(k,b){write(k,b);}};
 const options={store,origin:'https://club.example',now:()=>time,files:{'/':{key:'pub/index',type:'text/html',private:false},'/api/club':{key:'priv/data',type:'application/json',private:true},'/media/test.webp':{key:'priv/data',type:'image/webp',private:true}}};
 const event=(url,method='GET',body='',headers={},ip='test-client')=>({url,httpMethod:method,headers:{Origin:options.origin,'Content-Type':'application/json',...headers},body:JSON.stringify(body),requestContext:{identity:{sourceIp:ip}}});
 return {map,store,options,event,write,advance:n=>time+=n,config};
}
test('serverless: login, protected data, persistent logout across cold starts and storage failures',async()=>{
 const f=fixture();const handler=createHandler(f.options);
 assert.equal((await handler(f.event('/'))).statusCode,200);
 assert.equal((await handler(f.event('/api/club'))).statusCode,401);
 const login=await handler(f.event('/api/login','POST',{password:'fixture password 123'}));assert.equal(login.statusCode,200);
 const cookie=login.headers['Set-Cookie'].split(';')[0];assert.match(login.headers['Set-Cookie'],/HttpOnly; Secure; SameSite=Strict/);
 assert.equal((await handler(f.event('/media/test.webp','GET','',{Cookie:cookie}))).statusCode,200);
 assert.equal((await handler(f.event('/api/logout','POST',{}, {Cookie:cookie}))).statusCode,200);
 assert.equal((await createHandler(f.options)(f.event('/api/club','GET','',{Cookie:cookie}))).statusCode,401);
 f.store.get=async()=>{throw Error('offline');};assert.equal((await handler(f.event('/api/club'))).statusCode,503);
});
test('serverless: concurrent attempts cannot overwrite the persistent rate limit',async()=>{
 const f=fixture();const h=createHandler(f.options);
 const results=await Promise.all(Array.from({length:18},()=>h(f.event('/api/login','POST',{password:'fixture password 123'}))));
 assert.equal(results.filter(r=>r.statusCode===200).length,10);
 assert.ok(results.every(r=>[200,429,503].includes(r.statusCode)));
 assert.equal((await createHandler(f.options)(f.event('/api/login','POST',{password:'fixture password 123'},{'X-Forwarded-For':'spoof'}))).statusCode,429);
 f.advance(15*60*1000+1);assert.equal((await h(f.event('/api/login','POST',{password:'fixture password 123'}))).statusCode,200);
});
test('serverless: bad origins, path traversal, runtime access, bad tokens and expiry fail closed',async()=>{
 const f=fixture();const h=createHandler(f.options);
 assert.equal((await h(f.event('/api/login','POST',{}, {Origin:'https://evil.example'}))).statusCode,403);
 for(const p of ['/media/../runtime/auth.json','/%2e%2e/runtime/auth.json','/bad%zz'])assert.equal((await h(f.event(p))).statusCode,400);
 assert.equal((await h(f.event('/runtime/auth.json'))).statusCode,404);
 assert.equal((await h(f.event('/api/club','GET','',{Cookie:'out_session=invalid'}))).statusCode,401);
 const login=await h(f.event('/api/login','POST',{password:'fixture password 123'}));const cookie=login.headers['Set-Cookie'].split(';')[0];
 f.advance(31*24*3600*1000);assert.equal((await h(f.event('/api/club','GET','',{Cookie:cookie}))).statusCode,401);
});

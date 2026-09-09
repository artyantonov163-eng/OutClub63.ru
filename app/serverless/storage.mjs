export function objectStore(bucket,token){
 const url=key=>`https://storage.yandexcloud.net/${bucket}/${key.split('/').map(encodeURIComponent).join('/')}`;
 const request=(key,options={})=>fetch(url(key),{...options,headers:{Authorization:`Bearer ${token}`,...options.headers},signal:AbortSignal.timeout(15000)});
 return {
  async get(key){const r=await request(key);if(r.status===404)return null;if(!r.ok)throw Error('Storage read failed');return {body:Buffer.from(await r.arrayBuffer()),etag:r.headers.get('etag')};},
  async exists(key){const r=await request(key,{method:'HEAD'});if(r.status===404)return false;if(!r.ok)throw Error('Storage check failed');return true;},
  async put(key,body,etag){const r=await request(key,{method:'PUT',headers:{'Content-Type':'application/json',...(etag?{'If-Match':etag}:{'If-None-Match':'*'})},body});if([409,412].includes(r.status))return false;if(!r.ok)throw Error('Storage update failed');return true;},
  async putUnconditional(key,body){const r=await request(key,{method:'PUT',headers:{'Content-Type':'application/json'},body});if(!r.ok)throw Error('Storage write failed');}
 };
}

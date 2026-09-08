import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,mkdir,writeFile,symlink,rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createServer, clientAddress } from '../server/index.mjs';
import { makeConfig } from '../server/auth.mjs';
async function fixture(t,options={}) {
  const root=await mkdtemp(path.join(os.tmpdir(),'out-auth-'));
  for(const dir of ['private/data','private/media','dist/client'])await mkdir(path.join(root,dir),{recursive:true});
  await writeFile(path.join(root,'private/data/club.json'),JSON.stringify({players:['private-player']}));
  await writeFile(path.join(root,'private/media/photo.jpg'),'private-photo');
  await writeFile(path.join(root,'dist/client/index.html'),'<html>public shell</html>');
  await symlink(path.join(root,'private/data/club.json'),path.join(root,'dist/client/leak.json'));
  await symlink(path.join(root,'private/data/club.json'),path.join(root,'private/media/leak.json'));
  let time=Date.now();
  const config=makeConfig('test password 12345');
  const server=await createServer({root,config,now:()=>time,...options});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));await rm(root,{recursive:true,force:true});});
  const post=(route,data={},extra={})=>fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json',Origin:options.origin || base,...extra},body:JSON.stringify(data)});
  return {root,server,base,post,config,advance:ms=>{time+=ms;},login:async()=>{const r=await post('/api/login',{password:'test password 12345'});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];}};
}
test('private data and media are protected; login, logout, replay and expiry',async t=>{
  const f=await fixture(t,{sessionTtlMs:2000});
  assert.deepEqual(await (await fetch(f.base+'/api/session')).json(),{authenticated:false});
  for(const p of ['/api/club','/media/photo.jpg'])assert.equal((await fetch(f.base+p)).status,401);
  assert.equal((await fetch(f.base+'/')).status,200);
  assert.equal((await f.post('/api/login',{password:'wrong'})).status,401);
  const login=await f.post('/api/login',{password:'test password 12345'});
  assert.match(login.headers.get('set-cookie'),/HttpOnly; SameSite=Strict/);
  const cookie=login.headers.get('set-cookie').split(';')[0];
  const headers={Cookie:cookie};
  assert.deepEqual(await (await fetch(f.base+'/api/session',{headers})).json(),{authenticated:true});
  const data=await fetch(f.base+'/api/club',{headers});assert.equal(data.status,200);assert.equal(data.headers.get('cache-control'),'no-store');
  assert.deepEqual(await data.json(),{players:['private-player']});
  assert.equal(await (await fetch(f.base+'/media/photo.jpg',{headers})).text(),'private-photo');
  assert.equal((await f.post('/api/logout',{},headers)).status,200);
  assert.equal((await fetch(f.base+'/api/club',{headers})).status,401);
  const next=await f.login();f.advance(2001);
  assert.equal((await fetch(f.base+'/api/club',{headers:{Cookie:next}})).status,401);
});
test('origin validation, traversal and symlinks; rotation invalidates tokens',async t=>{
  const f=await fixture(t);
  assert.equal((await f.post('/api/login',{password:'test password 12345'},{Origin:'https://evil.example'})).status,403);
  const cookie=await f.login();
  for(const p of ['/media/%2e%2e%2fdata/club.json','/media/%5c..%5cdata','/leak.json','/media/leak.json','/private/data/club.json','/.runtime/auth.json']) {
    assert.ok([400,404].includes((await fetch(f.base+p,{headers:{Cookie:cookie}})).status),p);
  }
  f.config.version='f'.repeat(32);
  assert.equal((await fetch(f.base+'/api/club',{headers:{Cookie:cookie}})).status,401);
});
test('rate limit blocks repeated guesses and resets after window',async t=>{
  const f=await fixture(t,{rateLimit:2,rateWindowMs:1000});
  for(let i=0;i<2;i++)assert.equal((await f.post('/api/login',{password:'bad'})).status,401);
  assert.equal((await f.post('/api/login',{password:'test password 12345'})).status,429);
  f.advance(1001);await f.login();
});
test('missing configuration fails before listening',async()=>{
  await assert.rejects(createServer({root:'/nonexistent/out-club-test'}));
});
test('revoked sessions remain rejected after server restart',async t=>{
  const f=await fixture(t);
  const cookie=await f.login();
  assert.equal((await f.post('/api/logout',{}, {Cookie:cookie})).status,200);
  await new Promise(resolve=>f.server.close(resolve));
  const restarted=await createServer({root:f.root,config:f.config});
  await new Promise(resolve=>restarted.listen(0,'127.0.0.1',resolve));
  try {
    assert.equal((await fetch(`http://127.0.0.1:${restarted.address().port}/api/club`,{headers:{Cookie:cookie}})).status,401);
  } finally {await new Promise(resolve=>restarted.close(resolve));}
});
test('forwarded IP spoofing cannot bypass default login rate limit',async t=>{
  const f=await fixture(t,{rateLimit:1});
  assert.equal((await f.post('/api/login',{password:'wrong'},{'X-Forwarded-For':'198.51.100.1'})).status,401);
  assert.equal((await f.post('/api/login',{password:'wrong'},{'X-Forwarded-For':'198.51.100.2'})).status,429);
});
test('explicit trusted loopback proxy gets separate valid client budgets',async t=>{
  const f=await fixture(t,{rateLimit:1,trustProxy:true,origin:'https://out.example'});
  for(const ip of ['198.51.100.1','198.51.100.2'])assert.equal((await f.post('/api/login',{password:'wrong'},{'X-Forwarded-For':ip})).status,401);
  assert.equal((await f.post('/api/login',{password:'wrong'},{'X-Forwarded-For':'198.51.100.1'})).status,429);
  assert.equal(clientAddress({socket:{remoteAddress:'203.0.113.9'},headers:{'x-forwarded-for':'198.51.100.3'}},true),'203.0.113.9');
  for(const forwarded of ['198.51.100.1, 198.51.100.2','invalid'])assert.equal(clientAddress({socket:{remoteAddress:'127.0.0.1'},headers:{'x-forwarded-for':forwarded}},true),'127.0.0.1');
  await assert.rejects(createServer({root:f.root,config:f.config,trustProxy:true}),/PUBLIC_ORIGIN/);
});

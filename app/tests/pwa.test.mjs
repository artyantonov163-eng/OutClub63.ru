import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, cp, mkdir, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createServer} from '../server/index.mjs';
import {makeConfig} from '../server/auth.mjs';

test('installation metadata and correctly sized icons are public; club data stays private', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'out-pwa-'));
  await mkdir(path.join(root, 'dist'), {recursive:true});
  await cp(new URL('../dist/client', import.meta.url), path.join(root, 'dist/client'), {recursive:true});
  const server = await createServer({root,config:makeConfig('pwa test password 123')});
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));await rm(root,{recursive:true,force:true});});
  const base = `http://127.0.0.1:${server.address().port}`;
  const html = await (await fetch(base)).text();
  assert.match(html, /lang="ru"/);
  assert.match(html, /viewport-fit=cover/);
  assert.match(html, /name="theme-color" content="#04271e"/);
  assert.match(html, /apple-mobile-web-app-title/);
  const response = await fetch(base+'/manifest.webmanifest');
  assert.match(response.headers.get('content-type'), /application\/manifest\+json/);
  const manifest = await response.json();
  assert.equal(manifest.name,'OUT Tennis Club');
  assert.equal(manifest.short_name,'OUT Club');
  assert.equal(manifest.display,'standalone');
  assert.equal(manifest.scope,'/');
  assert.equal(manifest.start_url,'/#/ranking');
  assert.ok(manifest.icons.some(i=>i.purpose==='maskable'));
  for(const icon of [...manifest.icons,{src:'/icons/apple-touch-icon.png',sizes:'180x180'}]) {
    const r=await fetch(base+icon.src); assert.equal(r.status,200);
    assert.match(r.headers.get('content-type'),/image\/png/);
    const bytes=Buffer.from(await r.arrayBuffer());
    assert.equal(`${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`,icon.sizes);
  }
  assert.match((await fetch(base+'/favicon.ico')).headers.get('content-type'),/image\/x-icon/);
  for(const url of ['/api/club','/media/portraits/player-16.webp']) assert.equal((await fetch(base+url)).status,401);
});

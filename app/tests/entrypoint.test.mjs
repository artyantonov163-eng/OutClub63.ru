import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,cp,writeFile,symlink,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {makeConfig} from '../server/auth.mjs';
test('production entrypoint starts through current release symlink',async t=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'outclub-entry-'));
 const release=path.join(root,'release');await mkdir(path.join(release,'.runtime'),{recursive:true});
 await cp(new URL('../server/',import.meta.url),path.join(release,'server'),{recursive:true});
 await writeFile(path.join(release,'.runtime/auth.json'),JSON.stringify(makeConfig('isolated-test-password')));
 await symlink(release,path.join(root,'current'));
 const child=spawn(process.execPath,[path.join(root,'current/server/index.mjs')],{env:{...process.env,PORT:'0',HOST:'127.0.0.1',TRUST_PROXY:'false',COOKIE_SECURE:'false'},stdio:['ignore','pipe','pipe']});
 t.after(async()=>{child.kill('SIGTERM');await new Promise(resolve=>child.exitCode!==null?resolve():child.once('exit',resolve));await rm(root,{recursive:true,force:true});});
 const port=await new Promise((resolve,reject)=>{let text='';const timer=setTimeout(()=>reject(new Error('entrypoint did not listen')),8000);child.stdout.on('data',chunk=>{text+=chunk;const match=text.match(/listening on port (\d+)/);if(match){clearTimeout(timer);resolve(Number(match[1]));}});child.once('exit',()=>{clearTimeout(timer);reject(new Error('entrypoint exited before listening'));});child.once('error',reject);});
 const response=await fetch(`http://127.0.0.1:${port}/api/session`);assert.equal(response.status,200);assert.deepEqual(await response.json(),{authenticated:false});
});

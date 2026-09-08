import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const file=path.join(root,'private/data/club.json');
const data=existsSync(file)?JSON.parse(readFileSync(file,'utf8')):null;
test('private club snapshot: unique identities, totals and reciprocal tournament joins',{skip:!data},()=>{
 assert.equal(data.schemaVersion,1);
 assert.equal(new Set(data.players.map(p=>p.id)).size,data.players.length);
 assert.equal(new Set(data.tournaments.map(t=>t.id)).size,data.tournaments.length);
 for(const player of data.players){
  assert.equal(player.results.reduce((sum,r)=>sum+r.points,0),player.points);
  for(const result of player.results){
   const event=data.tournaments.find(t=>t.id===result.tournamentId);assert.ok(event);
   assert.ok(event.results.some(r=>r.playerId===player.id && r.points===result.points));
  }
 }
 for(const event of data.tournaments){
  assert.deepEqual(event.participants,event.results.map(r=>r.playerId));
  for(const result of event.results){
   const player=data.players.find(p=>p.id===result.playerId);assert.ok(player);
   assert.ok(player.results.some(r=>r.tournamentId===event.id && r.points===result.points));
  }
 }
});
test('private media stays in protected paths and generated illustrations stay separate',{skip:!data},()=>{
 const urls=[...data.players.flatMap(p=>[p.photo,p.portrait].filter(Boolean)),...data.tournaments.flatMap(t=>[...t.photos.map(p=>p.url),...t.documents.map(d=>d.url),...(t.cover?[t.cover.url]:[])])];
 for(const url of urls){assert.match(url,/^\/media\/[a-z0-9/.-]+$/);assert.ok(!url.includes('..'));assert.ok(existsSync(path.join(root,'private',url)));}
 for(const event of data.tournaments) if(event.cover?.kind==='generated')assert.ok(!event.photos.some(p=>p.url===event.cover.url));
 for(const variants of Object.values(data.imageVariants||{}))for(const v of variants){assert.ok(v.url.startsWith('/media/optimized/'));assert.equal(readFileSync(path.join(root,'private',v.url)).length,v.bytes);}
});

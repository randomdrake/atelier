import test from 'node:test';
import assert from 'node:assert/strict';
import {groupArtwork} from '../scripts/source-parts.mjs';

test('artwork parts keep every file in order under the archive budget',()=>{
  const files=[{path:'a.png',size:6},{path:'b.png',size:4},{path:'c.png',size:8},{path:'d.png',size:3}];
  const parts=groupArtwork(files,10);
  assert.deepEqual(parts,[['a.png','b.png'],['c.png'],['d.png']]);
  assert.deepEqual(parts.flat(),files.map(f=>f.path));
  for(const part of parts)assert.ok(part.reduce((sum,path)=>sum+files.find(f=>f.path===path).size,0)<=10);
  assert.deepEqual(groupArtwork([],10),[]);
});

test('artwork parts reject a file that cannot fit without truncating it',()=>{
  assert.throws(()=>groupArtwork([{path:'huge.png',size:11}],10),/huge.png/);
  assert.throws(()=>groupArtwork([{path:'bad.png',size:-1}],10),/budget/);
});

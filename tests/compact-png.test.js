import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {inflateSync} from 'node:zlib';
import {compactPNG} from '../scripts/compact-png.mjs';

function chunks(png){
  const result=[];
  for(let offset=8;offset<png.length;){const length=png.readUInt32BE(offset);result.push({type:png.toString('ascii',offset+4,offset+8),data:png.subarray(offset+8,offset+8+length)});offset+=length+12;}
  return result;
}
test('source PNG compaction preserves every filtered pixel byte and metadata chunk',async()=>{
  const original=await readFile(new URL('../examples/previews/violet-held-in-clay.png',import.meta.url));
  const compact=compactPNG(original),before=chunks(original),after=chunks(compact);
  assert.ok(compact.length<original.length);
  const pixels=list=>inflateSync(Buffer.concat(list.filter(c=>c.type==='IDAT').map(c=>c.data)));
  assert.deepEqual(pixels(after),pixels(before));
  assert.deepEqual(after.filter(c=>c.type!=='IDAT'),before.filter(c=>c.type!=='IDAT'));
  assert.deepEqual(compactPNG(compact),compact);
  assert.deepEqual(await readFile(new URL('../examples/previews/violet-held-in-clay.png',import.meta.url)),original);
});
test('source PNG compaction rejects malformed input',()=>{
  assert.throws(()=>compactPNG(Buffer.from('not a PNG')),/signature/);
  assert.throws(()=>compactPNG(Buffer.from([137,80,78,71,13,10,26,10,0])),/Truncated/);
});

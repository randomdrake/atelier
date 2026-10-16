import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {inflateSync} from 'node:zlib';
import {compactPNG,refilterPNG} from '../scripts/compact-png.mjs';

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

// Independent decoder used to compare actual samples, rather than compressed
// bytes or filter choices. These browser exports are non-interlaced RGB/RGBA8.
function decode(png){
  const list=chunks(png),header=list.find(c=>c.type==='IHDR').data;
  const width=header.readUInt32BE(0),height=header.readUInt32BE(4),bpp=header[9]===6?4:3;
  const data=inflateSync(Buffer.concat(list.filter(c=>c.type==='IDAT').map(c=>c.data))),stride=width*bpp,rows=[];
  for(let y=0;y<height;y++){
    const row=Buffer.alloc(stride),filter=data[y*(stride+1)];
    for(let x=0;x<stride;x++){
      const left=x<bpp?0:row[x-bpp],up=y?rows[y-1][x]:0,corner=y&&x>=bpp?rows[y-1][x-bpp]:0;
      let prediction=0;
      if(filter===1)prediction=left;
      if(filter===2)prediction=up;
      if(filter===3)prediction=(left+up)>>>1;
      if(filter===4){const p=left+up-corner,distances=[left,up,corner].map(v=>Math.abs(p-v));prediction=[left,up,corner][distances.indexOf(Math.min(...distances))];}
      row[x]=(data[y*(stride+1)+x+1]+prediction)&255;
    }
    rows.push(row);
  }
  return Buffer.concat(rows);
}
test('adaptive archive PNG filters preserve all decoded pixels and metadata',async()=>{
  for(const name of ['a-gold-thread-in-the-rain','violet-held-in-clay']){
    const original=await readFile(new URL(`../examples/previews/${name}.png`,import.meta.url)),optimized=refilterPNG(original);
    assert.ok(optimized.length<compactPNG(original).length);
    assert.deepEqual(decode(optimized),decode(original));
    assert.deepEqual(chunks(optimized).filter(c=>c.type!=='IDAT'),chunks(original).filter(c=>c.type!=='IDAT'));
    assert.deepEqual(refilterPNG(optimized),optimized);
    assert.deepEqual(await readFile(new URL(`../examples/previews/${name}.png`,import.meta.url)),original);
  }
});

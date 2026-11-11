import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {inflateSync,deflateSync} from 'node:zlib';
import {compactPNG,refilterPNG} from '../scripts/compact-png.mjs';
import {compactGalleryArtwork} from '../scripts/gallery-artwork.mjs';

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
  if(bpp===4)return Buffer.concat(rows);
  const rgb=Buffer.concat(rows),rgba=Buffer.alloc(width*height*4,255);
  for(let i=0,j=0;i<rgb.length;i+=3,j+=4)rgb.copy(rgba,j,i,i+3);
  return rgba;
}
function metadata(png){return chunks(png).filter(c=>c.type!=='IDAT').map(c=>{
  if(c.type!=='IHDR')return c;
  const data=Buffer.from(c.data);data[9]=0;return{type:c.type,data};
});}
function pngChunk(type,data){
  const bytes=Buffer.alloc(data.length+12);bytes.writeUInt32BE(data.length);bytes.write(type,4);data.copy(bytes,8);
  let crc=0xffffffff;
  for(const byte of bytes.subarray(4,-4)){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
  bytes.writeUInt32BE((crc^0xffffffff)>>>0,bytes.length-4);return bytes;
}
test('opaque RGB conversion preserves RGBA samples and retains translucent alpha',async()=>{
  const original=await readFile(new URL('../examples/previews/the-grain-remembers-a-flower.png',import.meta.url));
  const optimized=refilterPNG(original);
  assert.equal(optimized[25],2);assert.deepEqual(decode(optimized),decode(original));
  const pixels=decode(original);pixels[3]=127;pixels[pixels.length-1]=0;
  const header=Buffer.from(chunks(original).find(c=>c.type==='IHDR').data),stride=header.readUInt32BE(0)*4,height=header.readUInt32BE(4);
  header[9]=6;const rows=Buffer.alloc((stride+1)*height);
  for(let y=0;y<height;y++)pixels.copy(rows,y*(stride+1)+1,y*stride,(y+1)*stride);
  const translucent=Buffer.concat([original.subarray(0,8),pngChunk('IHDR',header),pngChunk('tEXt',Buffer.from('Test\0alpha samples')),pngChunk('IDAT',deflateSync(rows)),pngChunk('IEND',Buffer.alloc(0))]);
  const result=refilterPNG(translucent);
  assert.equal(result[25],6);assert.deepEqual(decode(result),pixels);assert.deepEqual(metadata(result),metadata(translucent));
});
test('adaptive and fixed archive PNG filters preserve all decoded pixels and metadata',async()=>{
  for(const name of ['a-gold-thread-in-the-rain','violet-held-in-clay','the-grain-remembers-a-flower']){
    const original=await readFile(new URL(`../examples/previews/${name}.png`,import.meta.url)),optimized=refilterPNG(original);
    assert.ok(optimized.length<compactPNG(original).length);
    assert.deepEqual(decode(optimized),decode(original));
    assert.deepEqual(metadata(optimized),metadata(original));
    assert.deepEqual(refilterPNG(optimized),optimized);
    assert.deepEqual(await readFile(new URL(`../examples/previews/${name}.png`,import.meta.url)),original);
  }
});

test('deployment compaction preserves artwork samples and metadata without changing source exports',async()=>{
  const output=await mkdtemp(join(tmpdir(),'atelier-deploy-png-'));
  const source=new URL('../examples/previews/violet-held-in-clay.png',import.meta.url),original=await readFile(source);
  try{
    await mkdir(join(output,'paintings/study'),{recursive:true});
    const target=join(output,'paintings/study/finished.png'),catalog=[{image:'/paintings/study/finished.png'}];
    await writeFile(target,original);
    const saved=await compactGalleryArtwork({output,catalog}),result=await readFile(target);
    assert.ok(saved>0);assert.equal(saved,original.length-result.length);
    assert.deepEqual(decode(result),decode(original));
    assert.deepEqual(metadata(result),metadata(original));
    assert.deepEqual(await readFile(source),original);
    assert.equal(await compactGalleryArtwork({output,catalog}),0);
  }finally{await rm(output,{recursive:true,force:true});}
});

import {inflateSync,deflateSync} from 'node:zlib';
import zopfli from '@gfx/zopfli';
import {createHash} from 'node:crypto';

const signature=Buffer.from([137,80,78,71,13,10,26,10]);
function crc32(bytes){
  let crc=0xffffffff;
  for(const byte of bytes){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
  return (crc^0xffffffff)>>>0;
}
function chunk(type,data){
  const out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length);out.write(type,4,'ascii');data.copy(out,8);
  out.writeUInt32BE(crc32(out.subarray(4,-4)),out.length-4);return out;
}

// Recompress only the PNG's filtered bytes. Pixels, filters and ancillary
// metadata remain unchanged; original exported files are never overwritten.
export function compactPNG(bytes){
  if(!bytes.subarray(0,8).equals(signature))throw new Error('Invalid PNG signature');
  const chunks=[],image=[];
  for(let offset=8;offset<bytes.length;){
    if(offset+12>bytes.length)throw new Error('Truncated PNG chunk');
    const length=bytes.readUInt32BE(offset),end=offset+length+12;
    if(end>bytes.length)throw new Error('Truncated PNG data');
    const type=bytes.toString('ascii',offset+4,offset+8),data=bytes.subarray(offset+8,end-4);
    chunks.push({type,bytes:bytes.subarray(offset,end)});if(type==='IDAT')image.push(data);offset=end;
  }
  if(!image.length)throw new Error('PNG has no image data');
  const compressed=deflateSync(inflateSync(Buffer.concat(image)),{level:9});
  let written=false;
  const result=Buffer.concat([signature,...chunks.flatMap(item=>{
    if(item.type!=='IDAT')return [item.bytes];
    if(written)return [];written=true;return [chunk('IDAT',compressed)];
  })]);
  return result.length<bytes.length?result:bytes;
}

// Zopfli emits ordinary zlib/DEFLATE, readable by every PNG decoder. It
// changes compression only, retaining the selected filters and all metadata.
const compressionResults=new Map();
export async function compressPNG(bytes){
  // Downloads and gallery copies normally share the same original. Reuse
  // their result within this build instead of doing the expensive work twice.
  const key=createHash('sha256').update(bytes).digest('hex');
  if(compressionResults.has(key))return compressionResults.get(key);
  const pending=compressPNGOnce(bytes);compressionResults.set(key,pending);
  try{return await pending;}catch(error){compressionResults.delete(key);throw error;}
}
async function compressPNGOnce(bytes){
  const selected=refilterPNG(bytes),chunks=[],image=[];
  for(let offset=8;offset<selected.length;){
    const length=selected.readUInt32BE(offset),end=offset+length+12;
    const type=selected.toString('ascii',offset+4,offset+8);
    chunks.push({type,bytes:selected.subarray(offset,end)});
    if(type==='IDAT')image.push(selected.subarray(offset+8,end-4));
    offset=end;
  }
  const filtered=inflateSync(Buffer.concat(image));
  const compressed=Buffer.from(await zopfli.zlibAsync(filtered,{numiterations:5}));
  if(!inflateSync(compressed).equals(filtered))throw new Error('PNG compressor changed scanlines');
  let written=false;
  const output=Buffer.concat([signature,...chunks.flatMap(item=>{
    if(item.type!=='IDAT')return[item.bytes];
    if(written)return[];written=true;return[chunk('IDAT',compressed)];
  })]);
  return output.length<selected.length?output:selected;
}

function paeth(a,b,c){
  const p=a+b-c,da=Math.abs(p-a),db=Math.abs(p-b),dc=Math.abs(p-c);
  return da<=db&&da<=dc?a:db<=dc?b:c;
}

// Compare adaptive and all five fixed row filters after DEFLATE. A locally
// smaller residual score need not produce the smallest complete stream.
// Fully opaque RGBA can also use RGB storage without changing decoded pixels.
// Original exports stay untouched; only IHDR's color type may change.
export function refilterPNG(bytes){
  const compact=compactPNG(bytes),chunks=[],image=[];
  for(let offset=8;offset<bytes.length;){
    const length=bytes.readUInt32BE(offset),end=offset+length+12;
    const type=bytes.toString('ascii',offset+4,offset+8),data=bytes.subarray(offset+8,end-4);
    chunks.push({type,data,bytes:bytes.subarray(offset,end)});if(type==='IDAT')image.push(data);offset=end;
  }
  const header=chunks.find(c=>c.type==='IHDR')?.data;
  if(!header||header.length!==13)throw new Error('Invalid PNG header');
  let channels=header[9]===6?4:header[9]===2?3:0;
  if(header[8]!==8||!channels||header[10]!==0||header[11]!==0||header[12]!==0)return compact;
  const width=header.readUInt32BE(0),height=header.readUInt32BE(4);let stride=width*channels;
  if(!width||!height||stride*height>128*1024*1024)throw new Error('Invalid PNG dimensions');
  const filtered=inflateSync(Buffer.concat(image));
  if(filtered.length!==(stride+1)*height)throw new Error('Invalid PNG scanline length');
  let pixels=Buffer.alloc(stride*height);
  const predictor=(filter,a,b,c)=>filter===0?0:filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):paeth(a,b,c);
  for(let y=0;y<height;y++){
    const start=y*(stride+1),row=y*stride,filter=filtered[start];
    if(filter>4)throw new Error('Invalid PNG filter');
    for(let x=0;x<stride;x++){
      const a=x>=channels?pixels[row+x-channels]:0,b=y?pixels[row+x-stride]:0,c=y&&x>=channels?pixels[row+x-stride-channels]:0;
      pixels[row+x]=(filtered[start+1+x]+predictor(filter,a,b,c))&255;
    }
  }
  // Retain alpha for translucency or color-type-dependent/animated chunks.
  if(channels===4&&!chunks.some(c=>['tRNS','sBIT','acTL','fcTL','fdAT'].includes(c.type))&&pixels.every((value,i)=>i%4!==3||value===255)){
    const rgb=Buffer.alloc(width*height*3);
    for(let i=0,j=0;i<pixels.length;i+=4){rgb[j++]=pixels[i];rgb[j++]=pixels[i+1];rgb[j++]=pixels[i+2];}
    pixels=rgb;channels=3;stride=width*3;
    const ihdr=chunks.find(c=>c.type==='IHDR');const data=Buffer.from(ihdr.data);data[9]=2;
    ihdr.bytes=chunk('IHDR',data);
  }
  const result=Buffer.alloc((stride+1)*height);
  const fixed=Array.from({length:5},()=>Buffer.alloc(result.length));
  for(let y=0;y<height;y++){
    const start=y*(stride+1),row=y*stride;
    let bestScore=Infinity;
    for(let candidate=0;candidate<5;candidate++){
      const values=Buffer.alloc(stride);let score=0;
      fixed[candidate][start]=candidate;
      for(let x=0;x<stride;x++){
        const a=x>=channels?pixels[row+x-channels]:0,b=y?pixels[row+x-stride]:0,c=y&&x>=channels?pixels[row+x-stride-channels]:0;
        const value=(pixels[row+x]-predictor(candidate,a,b,c))&255;values[x]=value;score+=Math.min(value,256-value);
      }
      values.copy(fixed[candidate],start+1);
      if(score<bestScore){bestScore=score;result[start]=candidate;values.copy(result,start+1);}
    }
  }
  let compressed=deflateSync(result,{level:9});
  for(const candidate of fixed){
    const encoded=deflateSync(candidate,{level:9});
    if(encoded.length<compressed.length)compressed=encoded;
  }
  let written=false;
  const output=Buffer.concat([signature,...chunks.flatMap(item=>{
    if(item.type!=='IDAT')return[item.bytes];if(written)return[];written=true;return[chunk('IDAT',compressed)];
  })]);
  return output.length<compact.length?output:compact;
}

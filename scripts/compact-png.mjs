import {inflateSync,deflateSync} from 'node:zlib';

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

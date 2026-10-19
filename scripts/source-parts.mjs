// Leave headroom for ZIP headers and incompressible PNG data under 25 MiB.
export function groupArtwork(files,budget=24*1024*1024){
  if(!Number.isSafeInteger(budget)||budget<1)throw new Error('Invalid archive budget');
  const groups=[];let group=[],size=0;
  for(const file of files){
    if(!Number.isSafeInteger(file.size)||file.size<0||file.size>budget)throw new Error('Artwork exceeds archive budget: '+file.path);
    if(group.length&&size+file.size>budget){groups.push(group);group=[];size=0;}
    group.push(file.path);size+=file.size;
  }
  if(group.length)groups.push(group);
  return groups;
}

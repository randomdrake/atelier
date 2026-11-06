import {access,copyFile,mkdir,readFile,writeFile} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {refilterPNG} from './compact-png.mjs';

// Optimize deployment copies only. All pixel samples and PNG metadata survive;
// the browser exports and pinned gallery originals remain untouched in source.
export async function compactGalleryArtwork({output,catalog}){
  let saved=0;
  for(const entry of catalog){
    const target=join(output,entry.image),original=await readFile(target),compact=refilterPNG(original);
    if(compact.length<original.length){await writeFile(target,compact);saved+=original.length-compact.length;}
  }
  return saved;
}

// Source downloads retain original previews once. Rebuild the gallery copies
// when building an extracted download; normal checkouts keep their pinned PNGs.
export async function restoreGalleryArtwork({root,output,catalog}){
  for(const entry of catalog){
    const target=join(output,entry.image);
    try{await access(target);continue;}catch(error){if(error.code!=='ENOENT')throw error;}
    await mkdir(dirname(target),{recursive:true});
    await copyFile(join(root,'examples/previews',entry.id+'.png'),target);
  }
}

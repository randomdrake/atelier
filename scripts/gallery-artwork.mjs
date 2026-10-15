import {access,copyFile,mkdir} from 'node:fs/promises';
import {join,dirname} from 'node:path';

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

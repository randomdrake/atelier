import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {restoreGalleryArtwork} from '../scripts/gallery-artwork.mjs';

test('compact source downloads restore missing artwork without replacing pinned gallery images',async()=>{
  const root=await mkdtemp(join(tmpdir(),'atelier-source-')),output=join(root,'dist');
  try{
    await mkdir(join(root,'examples/previews'),{recursive:true});
    await mkdir(join(output,'paintings/pinned'),{recursive:true});
    await writeFile(join(root,'examples/previews/restored.png'),'original export');
    await writeFile(join(output,'paintings/pinned/finished.png'),'pinned gallery export');
    await writeFile(join(root,'examples/previews/pinned.png'),'different preview');
    await restoreGalleryArtwork({root,output,catalog:[
      {id:'restored',image:'/paintings/restored/finished.png'},
      {id:'pinned',image:'/paintings/pinned/finished.png'}
    ]});
    assert.equal(await readFile(join(output,'paintings/restored/finished.png'),'utf8'),'original export');
    assert.equal(await readFile(join(output,'paintings/pinned/finished.png'),'utf8'),'pinned gallery export');
    await assert.rejects(restoreGalleryArtwork({root,output,catalog:[{id:'missing',image:'/paintings/missing/finished.png'}]}),{code:'ENOENT'});
  }finally{await rm(root,{recursive:true,force:true});}
});

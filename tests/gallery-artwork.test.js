import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {restoreGalleryArtwork,compactGallerySessions} from '../scripts/gallery-artwork.mjs';
import {validateDocument} from '../src/tour.js';

test('served replay compaction preserves complete recorded data and source bytes',async()=>{
  const output=await mkdtemp(join(tmpdir(),'atelier-replays-'));
  const source=new URL('../examples/leaves-folded-into-violet.json',import.meta.url);
  const original=await readFile(source),document=JSON.parse(original);
  try{
    await mkdir(join(output,'paintings/study'),{recursive:true});
    const target=join(output,'paintings/study/session.json');
    await writeFile(target,original);
    const catalog=[{session:'/paintings/study/session.json'}];
    const saved=await compactGallerySessions({output,catalog});
    const compact=await readFile(target);
    assert.ok(saved>0);assert.equal(saved,original.length-compact.length);
    assert.deepEqual(JSON.parse(compact),document);
    assert.deepEqual(validateDocument(JSON.parse(compact)),validateDocument(document));
    assert.deepEqual(await readFile(source),original);
    assert.equal(await compactGallerySessions({output,catalog}),0);
  }finally{await rm(output,{recursive:true,force:true});}
});

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

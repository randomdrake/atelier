import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {addPainting,root} from '../scripts/add-gallery-painting.mjs';
test('publishing a painting retains its notes and pins a working replay engine',async()=>{
  const output=await mkdtemp(join(tmpdir(),'atelier-publish-'));
  try{
    const entry=await addPainting({id:'oil-study',session:join(root,'examples/copper-and-pears.json'),image:join(root,'examples/previews/copper-and-pears.png'),description:'Copper and fruit',process:'Inspected live',output});
    assert.equal(entry.strokes,57);assert.equal(entry.moments,46);
    const {validateDocument}=await import(`file://${join(output,'replay-engine',entry.engine,'tour.js')}`);
    const doc=validateDocument(JSON.parse(await readFile(join(output,'paintings/oil-study/session.json'),'utf8')));assert.equal(doc.events.length,46);
    await addPainting({id:'oil-study',session:join(root,'examples/copper-and-pears.json'),image:join(root,'examples/previews/copper-and-pears.png'),description:'Updated description',process:'Inspected live',output});
    assert.equal(JSON.parse(await readFile(join(output,'catalog.json'))).length,1);
    await assert.rejects(addPainting({id:'../escape',session:'missing',image:'missing',description:'x',process:'x',output}));
  }finally{await rm(output,{recursive:true,force:true});}
});
test('published collection includes every finished picture and replay snapshot',async()=>{
  const catalog=JSON.parse(await readFile(join(root,'public-gallery/catalog.json'),'utf8'));assert.equal(catalog.length,5);
  for(const entry of catalog){const doc=JSON.parse(await readFile(join(root,'public-gallery',entry.session),'utf8'));assert.equal(doc.strokes.length,entry.strokes);await readFile(join(root,'public-gallery',entry.image));await readFile(join(root,'public-gallery/replay-engine',entry.engine,'engine.js'));}
});

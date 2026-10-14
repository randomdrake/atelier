import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PaintingLibrary,LIBRARY_KEY} from '../src/library.js';
import {validateDocument} from '../src/tour.js';
const stroke={medium:'oil',color:'#b47738',size:12,duration:100,points:[[.2,.3],[.4,.5]]};
const doc={version:2,title:'A pear',strokes:[stroke],events:[{afterStroke:1,text:'A little light.',camera:{zoom:2,x:.3,y:.7}}]};
function memory(){const values=new Map();return {getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};}
test('saved paintings survive refresh with every stroke, note, and camera',()=>{
  const storage=memory(),library=new PaintingLibrary(storage);library.save('pear',doc,'data:image/jpeg;base64,preview');
  const restored=new PaintingLibrary(storage).entries[0];assert.deepEqual(restored.document,validateDocument(doc));assert.equal(restored.preview,'data:image/jpeg;base64,preview');
  doc.title='Changed outside the library';assert.equal(restored.title,'A pear');
});
test('updates keep a stable painting identity and preserve other paintings',()=>{
  const library=new PaintingLibrary(memory());library.save('one',doc,'preview');library.save('two',{...doc,title:'Second'},'second');
  library.save('one',{...doc,strokes:[stroke,stroke]},null);assert.equal(library.entries.length,2);assert.equal(library.entries[0].strokes,2);assert.equal(library.entries[0].preview,'preview');
  assert.equal(library.list([{id:'one'},{id:'three'}]).length,3);
});
test('invalid scores cannot overwrite a saved painting; empty canvases are omitted',()=>{
  const library=new PaintingLibrary(memory());library.save('one',doc,'preview');assert.throws(()=>library.save('one',{...doc,strokes:[{...stroke,color:'invalid'}]},'bad'));
  assert.equal(library.entries[0].preview,'preview');assert.equal(library.save('blank',{version:2,strokes:[]},''),null);
});
test('corrupt entries and storage failures leave valid paintings available',()=>{
  const storage=memory(),library=new PaintingLibrary(storage);library.save('one',doc,'preview');const saved=JSON.parse(storage.getItem(LIBRARY_KEY));saved.push({id:'bad',document:{version:99},preview:'broken'});storage.setItem(LIBRARY_KEY,JSON.stringify(saved));assert.equal(new PaintingLibrary(storage).entries.length,1);
  const blocked=new PaintingLibrary({getItem(){throw new Error();},setItem(){throw new Error();}});blocked.save('one',doc,'preview');assert.equal(blocked.entries.length,1);assert.match(blocked.error,/storage/);
});
test('every gallery painting has a valid replay and a real finished preview',async()=>{
  const catalog=JSON.parse(await readFile(new URL('../examples/gallery.json',import.meta.url),'utf8'));assert.equal(catalog.length,5);assert.equal(new Set(catalog.map(e=>e.id)).size,5);
  for(const entry of catalog){const painting=validateDocument(JSON.parse(await readFile(new URL(`..${entry.source}`,import.meta.url),'utf8')));assert.equal(painting.strokes.length,entry.strokes);assert.equal(painting.events.length,entry.moments);const preview=await readFile(new URL(`..${entry.preview}`,import.meta.url));assert.equal(preview.subarray(1,4).toString(),'PNG');}
});

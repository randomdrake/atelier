import test from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync,gunzipSync} from 'node:zlib';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {embeddedJSONResponse} from '../src/embedded-json.js';
import {embedGalleryJSON} from '../scripts/embed-gallery-json.mjs';

test('embedded public JSON retains complete data and stable URLs for GET and HEAD',async()=>{
  const text=JSON.stringify({title:'Café — 渡り',strokes:[{points:[[.1,.2,.3]]}],humanRating:null});
  const documents={'/paintings/test/session.json':gzipSync(text).toString('base64')};
  const response=embeddedJSONResponse(new Request('https://example.com/paintings/test/session.json?v=1'),documents);
  assert.equal(await response.text(),text);
  assert.match(response.headers.get('content-type'),/^application\/json/);
  assert.equal(response.headers.get('content-encoding'),null);
  assert.equal(await embeddedJSONResponse(new Request('https://example.com/paintings/test/session.json',{method:'HEAD'}),documents).text(),'');
  for(const [path,method] of [['/missing.json','GET'],['/toString','GET'],['/paintings/test/session.json','POST']])assert.equal(embeddedJSONResponse(new Request('https://example.com'+path,{method}),documents),null);
});

test('build embeds all catalogue sessions and journal losslessly while keeping source exports',async()=>{
  const root=await mkdtemp(join(tmpdir(),'atelier-json-test-')),staging=join(root,'staging');
  try{
    await mkdir(join(staging,'paintings/test'),{recursive:true});await mkdir(join(staging,'practice'));
    const files={'catalog.json':'[{"session":"/paintings/test/session.json"}]','practice/studies.json':'[{"humanRating":null}]','paintings/test/session.json':'{"version":2,"strokes":[],"events":[]}'};
    for(const [path,text]of Object.entries(files))await writeFile(join(staging,path),text);
    await writeFile(join(root,'original.json'),files['paintings/test/session.json']);
    const documents=await embedGalleryJSON({root,staging});
    for(const [path,text]of Object.entries(files)){
      assert.equal(gunzipSync(Buffer.from(documents['/'+path],'base64')).toString(),text);
      await assert.rejects(readFile(join(staging,path)),{code:'ENOENT'});
    }
    assert.equal(await readFile(join(root,'original.json'),'utf8'),files['paintings/test/session.json']);
    assert.match(await readFile(join(root,'hosting/generated/gallery-json.js'),'utf8'),/export default/);
  }finally{await rm(root,{recursive:true,force:true});}
});

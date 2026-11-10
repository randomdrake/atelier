import {readdir,readFile,stat} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {root} from './add-gallery-painting.mjs';

const output=join(root,'dist');
const config=JSON.parse(await readFile(join(output,'.openai/hosting.json'),'utf8'));
assert.equal(config.project_id,'appgprj_6acef2a547908191b9a135eb3eab25da');
assert.equal(config.r2,'BUCKET');assert.equal(config.static,undefined);
await readFile(join(output,'server/index.js'));
for(const file of ['viewer.js','date-time.js','live.js','live-status.js','camera.js','live-camera.js','thought-links.js','catalog.json','gallery.css','source.zip'])await readFile(join(output,'client',file));
const catalog=JSON.parse(await readFile(join(output,'client/catalog.json'),'utf8'));
for(const entry of catalog){
  await readFile(join(output,'client',entry.image));
  await readFile(join(output,'client',entry.session));
  await readFile(join(output,'client/replay-engine',entry.engine,'engine.js'));
}
let secret;
try{process.loadEnvFile(join(root,'.env.live'));secret=process.env.ATELIER_BROADCAST_TOKEN;}
catch(error){if(error.code!=='ENOENT')throw error;}
let expandedBytes=0;
async function inspect(directory){
  for(const item of await readdir(directory,{withFileTypes:true})){
    assert.ok(!/^(\.env(?:\.|$)|\.dev\.vars|\.git$)/.test(item.name),'Secret or Git metadata in build output');
    const path=join(directory,item.name);
    if(item.isDirectory())await inspect(path);
    else{
      expandedBytes+=(await stat(path)).size;
      if(directory.startsWith(join(output,'client')))assert.ok((await stat(path)).size<=25*1024*1024,'Public asset exceeds the 25 MiB hosting limit: '+path);
      if(secret)assert.ok(!(await readFile(path)).includes(Buffer.from(secret)),'Publisher credential in build output');
    }
  }
}
await inspect(output);
assert.ok(expandedBytes<=256*1024*1024,'Build exceeds the 256 MiB expanded hosting package limit');
const downloads=JSON.parse(await readFile(join(output,'client/source-downloads.json'),'utf8'));
const entries=downloads.flatMap(name=>execFileSync('unzip',['-Z1',join(output,'client',name)],{encoding:'utf8'}).split('\n').filter(Boolean));
assert.ok(!entries.some(file=>/(^|\/)(\.env(?!\.example)|\.dev\.vars|node_modules|\.git|\.sites-runtime)(\/|$|\.)/.test(file)),'Private or generated files in source download');
assert.equal(new Set(entries.filter(file=>!file.endsWith('/'))).size,entries.filter(file=>!file.endsWith('/')).length,'Duplicate files across source downloads');
for(const entry of catalog)assert.ok(entries.includes(`examples/previews/${entry.id}.png`)||entries.includes('public-gallery'+entry.image),'Artwork missing from source downloads: '+entry.id);
for(const entry of catalog)assert.ok(entries.includes(`examples/${entry.id}.json`)||entries.includes('public-gallery'+entry.session),'Replay missing from source downloads: '+entry.id);
// Download JSON may have compact whitespace, but it must preserve every field
// and value from the matching source revision, including practice provenance.
for(const path of entries.filter(path=>path.endsWith('.json'))){
  const archived=execFileSync('unzip',['-p',join(output,'client/source.zip'),path],{maxBuffer:16*1024*1024});
  assert.deepEqual(JSON.parse(archived),JSON.parse(await readFile(join(root,path))),'Changed JSON data in source download: '+path);
}
console.log('Live artifact verified: '+catalog.length+' paintings, complete Worker, no publisher credential or private files.');

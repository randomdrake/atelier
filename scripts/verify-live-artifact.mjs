import {readdir,readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {root} from './add-gallery-painting.mjs';

const output=join(root,'dist');
const config=JSON.parse(await readFile(join(output,'.openai/hosting.json'),'utf8'));
assert.equal(config.project_id,'appgprj_6acef2a547908191b9a135eb3eab25da');
assert.equal(config.r2,'BUCKET');assert.equal(config.static,undefined);
await readFile(join(output,'server/index.js'));
for(const file of ['viewer.js','live.js','thought-links.js','catalog.json','gallery.css','source.zip'])await readFile(join(output,'client',file));
const catalog=JSON.parse(await readFile(join(output,'client/catalog.json'),'utf8'));
for(const entry of catalog){
  await readFile(join(output,'client',entry.image));
  await readFile(join(output,'client',entry.session));
  await readFile(join(output,'client/replay-engine',entry.engine,'engine.js'));
}
let secret;
try{process.loadEnvFile(join(root,'.env.live'));secret=process.env.ATELIER_BROADCAST_TOKEN;}
catch(error){if(error.code!=='ENOENT')throw error;}
async function inspect(directory){
  for(const item of await readdir(directory,{withFileTypes:true})){
    assert.ok(!/^(\.env(?:\.|$)|\.dev\.vars|\.git$)/.test(item.name),'Secret or Git metadata in build output');
    const path=join(directory,item.name);
    if(item.isDirectory())await inspect(path);
    else if(secret)assert.ok(!(await readFile(path)).includes(Buffer.from(secret)),'Publisher credential in build output');
  }
}
await inspect(output);
const entries=execFileSync('unzip',['-Z1',join(output,'client/source.zip')],{encoding:'utf8'}).split('\n');
assert.ok(!entries.some(file=>/(^|\/)(\.env(?!\.example)|\.dev\.vars|node_modules|\.git|\.sites-runtime)(\/|$|\.)/.test(file)),'Private or generated files in source download');
console.log('Live artifact verified: '+catalog.length+' paintings, complete Worker, no publisher credential or private files.');

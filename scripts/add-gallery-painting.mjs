import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {validateDocument} from '../src/tour.js';
export const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export async function addPainting({id,session,image,description,process,output=join(root,'public-gallery')}){
  if(!/^[a-z][a-z0-9-]{0,79}$/.test(id??''))throw new Error('Use a short lowercase painting id.');
  const input=JSON.parse(await readFile(resolve(session),'utf8')),doc=validateDocument(input);
  if(!doc.strokes.length)throw new Error('A published painting needs completed strokes.');
  const bytes=await readFile(resolve(image));if(bytes.subarray(1,4).toString()!=='PNG')throw new Error('Provide the exported PNG painting.');
  if(!description?.trim()||!process?.trim())throw new Error('Describe the painting and how it was made.');
  const modules=['engine.js','playback.js','session.js','tour.js','pacing.js','camera.js'],sources=await Promise.all(modules.map(f=>readFile(join(root,'src',f))));
  const engine=createHash('sha256').update(Buffer.concat(sources)).digest('hex').slice(0,16);
  const folder=join(output,'paintings',id),engineFolder=join(output,'replay-engine',engine);await mkdir(folder,{recursive:true});await mkdir(engineFolder,{recursive:true});
  for(let i=0;i<modules.length;i++)await writeFile(join(engineFolder,modules[i]),sources[i]);
  await writeFile(join(folder,'session.json'),JSON.stringify({...input,...doc},null,2)+'\n');await copyFile(resolve(image),join(folder,'finished.png'));
  let catalog=[];try{catalog=JSON.parse(await readFile(join(output,'catalog.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
  const previous=catalog.find(entry=>entry.id===id),now=new Date();
  const entry={id,title:doc.title||'Untitled painting',description,process,media:[...new Set(doc.strokes.map(s=>s.medium))],strokes:doc.strokes.length,moments:doc.events.length,engine,session:`/paintings/${id}/session.json`,image:`/paintings/${id}/finished.png`,addedAt:previous?.addedAt||(previous?undefined:now.toISOString()),addedAtSource:previous?.addedAtSource||(previous?undefined:'gallery-export'),publishedAt:previous?.publishedAt||new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(now)};
  await writeFile(join(output,'catalog.json'),JSON.stringify([entry,...catalog.filter(e=>e.id!==id)],null,2)+'\n');return entry;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const args={};for(let i=2;i<process.argv.length;i+=2)args[process.argv[i].replace(/^--/,'')]=process.argv[i+1];
  try{console.log(JSON.stringify(await addPainting(args)));}catch(e){console.error(e.message);process.exitCode=1;}
}

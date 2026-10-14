import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {finalizeLivePainting} from '../src/live-finalize.js';

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try{
    const args={};for(let i=2;i<process.argv.length;i+=2)args[process.argv[i].replace(/^--/,'')]=process.argv[i+1];
    if(!args.session||!args.preview)throw new Error('Provide --session <JSON> and --preview <finished JPEG>');
    process.loadEnvFile(resolve('.env.live'));
    const bytes=await readFile(resolve(args.preview));
    if(bytes[0]!==0xff||bytes[1]!==0xd8)throw new Error('The preview must be a JPEG of the finished export');
    const result=await finalizeLivePainting({document:JSON.parse(await readFile(resolve(args.session),'utf8')),
      preview:'data:image/jpeg;base64,'+bytes.toString('base64'),endpoint:process.env.ATELIER_BROADCAST_URL,token:process.env.ATELIER_BROADCAST_TOKEN});
    console.log(JSON.stringify(result));
  }catch(error){console.error(error.message);process.exitCode=1;}
}

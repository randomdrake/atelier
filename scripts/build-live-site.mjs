import {cp,mkdir,rm,readdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {root} from './add-gallery-painting.mjs';

execFileSync(process.execPath,[join(root,'scripts/build-gallery.mjs')],{stdio:'inherit'});
const staging=join(root,'hosting/public');
await rm(staging,{recursive:true,force:true});await mkdir(staging,{recursive:true});
await cp(join(root,'dist'),staging,{recursive:true});
// The root route serves the unchanged gallery HTML; only public gallery assets
// enter the framework output, never the local studio or its credentials.
await rm(join(staging,'index.html'));
await cp(join(root,'.openai/hosting.json'),join(root,'hosting/.openai/hosting.json'));
// Preview-only vars must never follow a rebuilt Worker into its public archive.
await rm(join(root,'hosting/dist'),{recursive:true,force:true});
execFileSync('npm',['run','build'],{cwd:join(root,'hosting'),stdio:'inherit'});
await rm(join(root,'dist'),{recursive:true,force:true});
await cp(join(root,'hosting/dist'),join(root,'dist'),{recursive:true});
// Debugging source maps are retained in hosting/dist locally. They are not
// required by the Worker or browser and need not consume public package space.
async function removeDeploymentMaps(directory){
  for(const item of await readdir(directory,{withFileTypes:true})){
    const path=join(directory,item.name);
    if(item.isDirectory())await removeDeploymentMaps(path);
    else if(item.name.endsWith('.map'))await rm(path);
  }
}
await removeDeploymentMaps(join(root,'dist'));

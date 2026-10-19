import {mkdir,mkdtemp,cp,readFile,writeFile,rm} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {root} from './add-gallery-painting.mjs';
import {restoreGalleryArtwork} from './gallery-artwork.mjs';
import {refilterPNG} from './compact-png.mjs';
import {groupArtwork} from './source-parts.mjs';
const output=join(root,'dist');await rm(output,{recursive:true,force:true});await mkdir(output,{recursive:true});await cp(join(root,'public-gallery'),output,{recursive:true});await cp(join(root,'LICENSE'),join(output,'LICENSE.txt'));await cp(join(root,'src/pacing.js'),join(output,'pacing.js'));
await cp(join(root,'src/thought-links.js'),join(output,'thought-links.js'));
for(const file of ['live-status.js','camera.js','live-camera.js'])await cp(join(root,'src',file),join(output,file));
const catalog=JSON.parse(await readFile(join(output,'catalog.json'),'utf8'));
await restoreGalleryArtwork({root,output,catalog});
await cp(join(root,'practice'),join(output,'practice'),{recursive:true});
const duplicateArtwork=[];
for(const entry of catalog){
  try{
    const preview=await readFile(join(root,'examples/previews',entry.id+'.png'));
    if(preview.equals(await readFile(join(output,entry.image))))duplicateArtwork.push('public-gallery'+entry.image);
  }catch(error){if(error.code!=='ENOENT')throw error;}
}
execFileSync('zip',['-qr',join(output,'source.zip'),'src','scripts','hosting/app','hosting/build','hosting/lib','hosting/scripts','hosting/package.json','hosting/package-lock.json','hosting/vite.config.ts','hosting/tsconfig.json','hosting/cloudflare-env.d.ts','hosting/next-env.d.ts','skills','practice','public-gallery','examples','tests','docs','README.md','PUBLISHING.md','LICENSE','index.html','.env.example','package.json','server.mjs',...(duplicateArtwork.length?['-x',...duplicateArtwork]:[])],{cwd:root});
// Keep the growing source download below the hosting asset limit without
// changing exported originals or discarding artwork from the download.
const archive=join(output,'source.zip'),compactRoot=await mkdtemp(join(tmpdir(),'atelier-source-png-'));
try{
  const paths=execFileSync('unzip',['-Z1',archive],{encoding:'utf8'}).split('\n').filter(path=>path.endsWith('.png'));
  const changed=[],files=[];
  for(const path of paths){
    const original=await readFile(join(root,path)),compact=refilterPNG(original);
    const selected=compact.length<original.length?compact:original;
    await mkdir(dirname(join(compactRoot,path)),{recursive:true});await writeFile(join(compactRoot,path),selected);
    files.push({path,size:selected.length});
    if(selected===compact)changed.push(path);
  }
  if(changed.length)execFileSync('zip',['-q','-9',archive,...changed],{cwd:compactRoot});
  // Separate image parts avoid a single ever-growing public asset. Extracting
  // all downloads together restores the same complete source tree.
  const parts=groupArtwork(files),downloads=['source.zip'];
  if(paths.length)execFileSync('zip',['-qd',archive,...paths]);
  for(const [index,part] of parts.entries()){
    const name=`source-artwork-${String(index+1).padStart(2,'0')}.zip`;
    execFileSync('zip',['-q','-9',join(output,name),...part],{cwd:compactRoot});downloads.push(name);
  }
  await writeFile(join(output,'source-downloads.json'),JSON.stringify(downloads,null,2)+'\n');
  await writeFile(join(output,'downloads.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Atelier source downloads</title><link rel="stylesheet" href="/gallery.css"><main style="max-width:48rem;margin:3rem auto;padding:1.5rem"><a href="/">← Atelier gallery</a><h1>Take the studio with you.</h1><p>Download the code and every artwork part below. Extract all ZIP files into the same folder, preserving their paths. The code includes the MIT license, paint physics, recorded sessions and build instructions; the artwork parts include all original-resolution paintings with lossless compression.</p><ul>${downloads.map((name,i)=>`<li><a href="/${name}" download>${i===0?'Code and recorded sessions':`Artwork part ${i}`}</a></li>`).join('')}</ul><p>Then follow README.md. Rebuilding the gallery restores shared preview images automatically.</p></main></html>`);
}finally{await rm(compactRoot,{recursive:true,force:true});}
await writeFile(join(output,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://atelier.randomdrake.com/</loc></url></urlset>`);
console.log(`Viewing gallery built: ${catalog.length} paintings. Studio editor excluded.`);

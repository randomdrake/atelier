import {readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {brotliCompressSync,brotliDecompressSync,constants} from 'node:zlib';
import assert from 'node:assert/strict';

// Bundle public JSON in the Worker instead of storing a second uncompressed
// copy in static assets. Source exports and downloadable originals stay intact.
export async function embedGalleryJSON({root,staging}){
  const catalog=JSON.parse(await readFile(join(staging,'catalog.json')));
  const paths=['/catalog.json','/practice/studies.json',...catalog.map(entry=>entry.session)];
  const documents={};let before=0,after=0;
  for(const path of paths){
    assert.ok(/^\/(?:catalog\.json|practice\/studies\.json|paintings\/[a-z0-9-]+\/session\.json)$/.test(path));
    const original=await readFile(join(staging,path)),encoded=brotliCompressSync(original,{
      params:{[constants.BROTLI_PARAM_QUALITY]:11,[constants.BROTLI_PARAM_MODE]:constants.BROTLI_MODE_TEXT}
    });
    assert.deepEqual(brotliDecompressSync(encoded),original);
    documents[path]=encoded.toString('base64');before+=original.length;after+=encoded.length;
  }
  const directory=join(root,'hosting/generated');await mkdir(directory,{recursive:true});
  await writeFile(join(directory,'gallery-json.js'),'// Generated from public gallery JSON during build.\nexport default '+JSON.stringify(documents)+';\n');
  for(const path of paths)await rm(join(staging,path));
  console.log(`Embedded ${paths.length} public JSON documents: ${before} bytes → ${after} Brotli bytes.`);
  return documents;
}

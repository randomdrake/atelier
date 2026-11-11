// Compressed public data is decoded at the edge. Clients keep the same JSON
// URLs and receive ordinary JSON regardless of Accept-Encoding support.
export function embeddedJSONResponse(request,documents){
  if(request.method!=='GET'&&request.method!=='HEAD')return null;
  const path=new URL(request.url).pathname;
  if(!Object.hasOwn(documents,path))return null;
  const bytes=Uint8Array.from(atob(documents[path]),char=>char.charCodeAt(0));
  const body=request.method==='HEAD'?null:new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(body,{headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=60','X-Content-Type-Options':'nosniff'}});
}

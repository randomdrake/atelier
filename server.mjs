import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {Readable} from 'node:stream';
import {LocalBroadcastRelay} from './src/local-broadcast.js';
import {handleLiveRequest} from './src/live-service.js';

const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.zip':'application/zip'};
export function createAtelierServer({root=process.cwd(),relay=new LocalBroadcastRelay(),liveEnv}={}){
  root=resolve(root);
  return http.createServer(async(req,res)=>{
    try{
      const address=req.headers.host;
      if(!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(address||'')){res.writeHead(403);res.end();return;}
      const url=new URL(req.url,'http://'+address);
      if(url.pathname.startsWith('/api/')){
        const origin=req.headers.origin;
        if(origin&&origin!==url.origin){res.writeHead(403);res.end();return;}
        const request=new Request(url,{method:req.method,headers:req.headers,
          ...(!['GET','HEAD'].includes(req.method)?{body:Readable.toWeb(req),duplex:'half'}:{})});
        const reply=await relay.handle(request)|| (liveEnv?await handleLiveRequest(request,liveEnv):null);
        if(!reply){res.writeHead(404);res.end();return;}
        res.writeHead(reply.status,Object.fromEntries(reply.headers));res.end(Buffer.from(await reply.arrayBuffer()));return;
      }
      if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
      const path=resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
      // Block hidden paths and server source even when using the checkout as
      // the static root; secrets and relay code never enter a browser bundle.
      const relative=path.slice(root.length+1);
      if(!path.startsWith(root+sep)||relative.split(sep).some(part=>part.startsWith('.'))||
        relative==='server.mjs'||relative==='src/local-broadcast.js'){
        res.writeHead(403);res.end();return;
      }
      const body=await readFile(path);
      res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream','Cache-Control':'no-store'});
      res.end(req.method==='HEAD'?undefined:body);
    }catch{res.writeHead(404);res.end('Not found');}
  });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try{process.loadEnvFile(resolve('.env.live'));}catch(error){if(error.code!=='ENOENT')throw error;}
  const relay=new LocalBroadcastRelay({endpoint:process.env.ATELIER_BROADCAST_URL,token:process.env.ATELIER_BROADCAST_TOKEN});
  createAtelierServer({root:process.argv[2]||process.cwd(),relay}).listen(Number(process.env.PORT||5173),'127.0.0.1',
    ()=>console.log('Atelier ready at http://127.0.0.1:'+(process.env.PORT||5173)));
}

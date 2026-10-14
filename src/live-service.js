import {validateDocument} from './tour.js';

export const LIVE_TIMEOUT=45000;
export const MAX_LIVE_BYTES=1500000;
export const VIEWER_TIMEOUT=45000;
const headers={'Content-Type':'application/json','Cache-Control':'no-store'};
export function liveJSON(value,status=200){return new Response(JSON.stringify(value),{status,headers});}

export async function readLiveBody(request,maxBytes=MAX_LIVE_BYTES){
  if(Number(request.headers.get('Content-Length'))>maxBytes)throw new Error('Broadcast is too large');
  const reader=request.body?.getReader();if(!reader)throw new Error('Missing broadcast');
  const chunks=[];let size=0;
  while(true){
    const {done,value}=await reader.read();if(done)break;
    size+=value.byteLength;if(size>maxBytes){await reader.cancel();throw new Error('Broadcast is too large');}
    chunks.push(value);
  }
  const bytes=new Uint8Array(size);let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  return JSON.parse(new TextDecoder().decode(bytes));
}

export function validateLiveSnapshot(input){
  if(!input||!['painting','looking','replaying','ended'].includes(input.activity))throw new Error('Invalid broadcast activity');
  const validated=validateDocument(input.document);
  if(input.document.width!==900||input.document.height!==620||validated.strokes.length>2000)throw new Error('Invalid broadcast document');
  const pick=(value,keys)=>Object.fromEntries(keys.filter(key=>value[key]!==undefined).map(key=>[key,value[key]]));
  const document={version:2,width:900,height:620,title:validated.title,
    strokes:validated.strokes.map(stroke=>pick(stroke,['medium','color','size','points','duration','flow','water','body','tip','wait'])),
    events:validated.events.map(event=>({...pick(event,['afterStroke','text','title','kind','duration']),
      ...(event.camera?{camera:pick(event.camera,['zoom','x','y'])}:{})}))};
  if(typeof input.preview!=='string'||!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(input.preview)||input.preview.length>700000)throw new Error('Invalid canvas preview');
  // Reconstruct a bounded public payload; never forward arbitrary local fields.
  return {activity:input.activity,document,preview:input.preview};
}

export function publicLiveState(snapshot,now=Date.now()){
  if(!snapshot||snapshot.test)return {status:'offline',live:false};
  const age=Math.max(0,now-snapshot.receivedAt);
  return {...snapshot,live:snapshot.activity!=='ended'&&age<LIVE_TIMEOUT,
    status:snapshot.activity==='ended'?'ended':age>=LIVE_TIMEOUT?'disconnected':'live'};
}

export async function handleLiveRequest(request,env,now=Date.now()){
  const url=new URL(request.url);
  if(url.pathname==='/api/live/viewers')return handleViewerRequest(request,env,now);
  if(url.pathname!=='/api/live')return null;
  if(!env.BUCKET)return liveJSON({error:'Live storage is unavailable'},503);
  const authorized=!!env.ATELIER_BROADCAST_TOKEN&&request.headers.get('Authorization')==='Bearer '+env.ATELIER_BROADCAST_TOKEN;
  const test=url.searchParams.get('test')==='1';
  const key=test?'atelier/live-test.json':'atelier/live.json';
  if(request.method==='GET'){
    if(test&&!authorized)return liveJSON({error:'Unauthorized'},401);
    const object=await env.BUCKET.get(key);
    const snapshot=object?await object.json():null;
    return liveJSON(test?{snapshot}:publicLiveState(snapshot,now));
  }
  if(request.method!=='POST')return liveJSON({error:'Method not allowed'},405);
  if(!authorized)return liveJSON({error:'Unauthorized'},401);
  let input,snapshot;
  try{
    input=await readLiveBody(request);
    if(typeof input.sessionId!=='string'||!/^[a-f0-9-]{36}$/.test(input.sessionId)||!Number.isSafeInteger(input.sequence)||input.sequence<1)throw new Error('Invalid broadcast sequence');
    snapshot=validateLiveSnapshot(input);
  }catch(error){return liveJSON({error:error.message},400);}
  const previous=await env.BUCKET.get(key);
  const old=previous?await previous.json():null;
  if(old&&old.sessionId!==input.sessionId&&old.activity!=='ended'&&now-old.receivedAt<LIVE_TIMEOUT)return liveJSON({error:'Another laptop session is still live'},409);
  if(old?.sessionId===input.sessionId&&input.sequence<=old.sequence)return liveJSON({accepted:true,sequence:old.sequence});
  const next={...snapshot,sessionId:input.sessionId,sequence:input.sequence,
    startedAt:old?.sessionId===input.sessionId?old.startedAt:now,receivedAt:now,
    publisher:'randomdrake',host:'randomdrake',painter:'AI agent',origin:'Laptop studio',collaboration:'AI painter on hardware hosted by randomdrake',test};
  // Conditional writes prevent an older request from overwriting a newer canvas.
  const saved=await env.BUCKET.put(key,JSON.stringify(next),{
    httpMetadata:{contentType:'application/json'},
    onlyIf:previous?{etagMatches:previous.etag}:{etagDoesNotMatch:'*'}
  });
  if(!saved)return liveJSON({error:'Broadcast changed; retry this update'},409);
  return liveJSON({accepted:true,sequence:next.sequence,receivedAt:now});
}

async function handleViewerRequest(request,env,now){
  if(!env.BUCKET)return liveJSON({error:'Live storage is unavailable'},503);
  if(request.method!=='POST')return liveJSON({error:'Method not allowed'},405);
  const origin=request.headers.get('Origin');
  if(origin&&origin!==new URL(request.url).origin)return liveJSON({error:'Use the gallery to join'},403);
  let input;
  try{
    input=await readLiveBody(request,256);
    if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(input.viewerId)||typeof input.active!=='boolean')throw new Error('Invalid viewer presence');
  }catch{return liveJSON({error:'Invalid viewer presence'},400);}
  // Ephemeral random tab IDs only: no IP, account, or browsing history is stored.
  const prefix='atelier/viewers/',key=prefix+input.viewerId;
  if(input.active)await env.BUCKET.put(key,'',{customMetadata:{seenAt:String(now)}});
  else await env.BUCKET.delete(key);
  let cursor,viewers=0;
  const expired=[];
  do{
    const page=await env.BUCKET.list({prefix,include:['customMetadata'],limit:1000,...(cursor?{cursor}:{})});
    for(const object of page.objects){
      const seenAt=Number(object.customMetadata?.seenAt);
      if(Number.isFinite(seenAt)&&now-seenAt<VIEWER_TIMEOUT)viewers++;
      else if(expired.length<20)expired.push(object.key);
    }
    cursor=page.truncated?page.cursor:undefined;
  }while(cursor);
  if(expired.length)await env.BUCKET.delete(expired);
  return liveJSON({viewers});
}

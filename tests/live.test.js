import {test} from 'node:test';
import assert from 'node:assert/strict';
import {handleLiveRequest,publicLiveState,LIVE_TIMEOUT,VIEWER_TIMEOUT} from '../src/live-service.js';
import {livePresentation,thoughtChange,LiveFeedClock,returnSchedule} from '../src/live-status.js';
import {LocalBroadcastRelay} from '../src/local-broadcast.js';
import {LiveBroadcast} from '../src/live-broadcast.js';
import {finalizeLivePainting} from '../src/live-finalize.js';

const id='a1111111-1111-4111-8111-111111111111';
const client='b1111111-1111-4111-8111-111111111111';
const token='test-only-publisher-token';
const preview='data:image/jpeg;base64,/9j/2Q==';
const document={version:2,width:900,height:620,title:'Test canvas',strokes:[],
  events:[{afterStroke:0,text:'A test thought.',duration:6000}]};
const payload={activity:'looking',preview,document};
function bucket(){
  const data=new Map();let revision=0;
  return {
    async get(key){const item=data.get(key);return item?{etag:item.etag,json:async()=>JSON.parse(item.value)}:null;},
    async put(key,value,{onlyIf,customMetadata}={}){
      const old=data.get(key);
      if(onlyIf?.etagMatches&&old?.etag!==onlyIf.etagMatches||onlyIf?.etagDoesNotMatch==='*'&&old)return null;
      const etag=String(++revision);data.set(key,{value,etag,customMetadata});return {etag};
    },
    async delete(keys){for(const key of Array.isArray(keys)?keys:[keys])data.delete(key);},
    async list({prefix,cursor,limit}){
      const keys=[...data.keys()].filter(key=>key.startsWith(prefix)).sort();
      const start=Number(cursor||0),end=Math.min(keys.length,start+Math.min(limit,2));
      return {objects:keys.slice(start,end).map(key=>({key,customMetadata:data.get(key).customMetadata})),truncated:end<keys.length,cursor:String(end)};
    }
  };
}
const env=()=>({BUCKET:bucket(),ATELIER_BROADCAST_TOKEN:token});
const post=(data,authorization=token,path='/api/live')=>new Request('https://atelier.test'+path,{
  method:'POST',headers:{Authorization:'Bearer '+authorization,'Content-Type':'application/json'},body:JSON.stringify(data)});

test('only the owner relay can publish; public snapshots expose only painting fields',async()=>{
  const e=env();
  assert.equal((await handleLiveRequest(post({...payload,sessionId:id,sequence:1},'wrong'),e,1000)).status,401);
  const input={...payload,sessionId:id,sequence:1,publisher:'someone else',privateKey:'do not publish',
    document:{...document,creation:{secret:'private'},events:[{...document.events[0],secret:'private'}]}};
  assert.equal((await handleLiveRequest(post(input),e,1000)).status,200);
  const state=await (await handleLiveRequest(new Request('https://atelier.test/api/live'),e,1001)).json();
  assert.equal(state.publisher,'randomdrake');assert.equal(state.host,'randomdrake');assert.equal(state.painter,'AI agent');assert.equal(state.live,true);
  assert.equal(state.document.creation,undefined);assert.equal(state.document.events[0].secret,undefined);
  assert.equal(state.privateKey,undefined);assert.equal(state.document.width,900);
});

test('duplicates and older updates cannot roll back the live painting',async()=>{
  const e=env();
  for(const sequence of [2,2,1])assert.equal((await handleLiveRequest(post({...payload,sessionId:id,sequence}),e,1000+sequence)).status,200);
  const state=await (await handleLiveRequest(new Request('https://atelier.test/api/live'),e,1003)).json();
  assert.equal(state.sequence,2);assert.equal(state.receivedAt,1002);
  assert.equal((await handleLiveRequest(post({...payload,sessionId:client,sequence:1}),e,1004)).status,409);
});

test('camera-only updates survive the laptop relay, storage and public read without adding marks',async()=>{
  const e=env();
  const relay=new LocalBroadcastRelay({endpoint:'https://atelier.test/api/live',token,
    fetcher:(url,options)=>handleLiveRequest(new Request(url,options),e,1000)});
  await relay.publish({action:'start',payload:{...payload,camera:{zoom:1,x:.5,y:.5}},clientId:client});
  const camera={zoom:2,x:.7,y:.3};
  await relay.publish({action:'update',payload:{...payload,camera},clientId:client});
  const state=await (await handleLiveRequest(new Request('https://atelier.test/api/live'),e,1001)).json();
  assert.deepEqual(state.camera,camera);assert.equal(state.document.strokes.length,0);assert.equal(state.sequence,2);
});

test('an ended broadcast and missing heartbeats never claim someone is painting now',async()=>{
  const snapshot={...payload,receivedAt:1000};
  assert.equal(publicLiveState(snapshot,1000+LIVE_TIMEOUT-1).live,true);
  assert.equal(publicLiveState(snapshot,1000+LIVE_TIMEOUT).status,'disconnected');
  assert.equal(publicLiveState({...snapshot,activity:'ended'},1001).live,false);
  assert.equal(publicLiveState({...snapshot,test:true},1001).status,'offline');
});

test('broadcast tests are isolated from the public easel and malformed previews are rejected',async()=>{
  const e=env();
  await handleLiveRequest(post({...payload,sessionId:id,sequence:1},token,'/api/live?test=1'),e,1000);
  assert.deepEqual(await (await handleLiveRequest(new Request('https://atelier.test/api/live'),e,1000)).json(),{status:'offline',live:false,serverNow:1000});
  assert.equal((await handleLiveRequest(new Request('https://atelier.test/api/live?test=1'),e)).status,401);
  assert.equal((await handleLiveRequest(post({...payload,preview:'data:text/html;base64,AAAA',sessionId:id,sequence:1}),e)).status,400);
  assert.equal((await handleLiveRequest(post({...payload,document:{...document,width:999},sessionId:id,sequence:1}),e)).status,400);
});

test('conditional storage conflicts cannot claim an update was delivered',async()=>{
  const e=env();e.BUCKET.put=async()=>null;
  assert.equal((await handleLiveRequest(post({...payload,sessionId:id,sequence:1}),e)).status,409);
});

test('a laptop can retry a lost start acknowledgement without creating a second live session',async()=>{
  const e=env();let lose=true;
  const relay=new LocalBroadcastRelay({endpoint:'https://atelier.test/api/live',token,
    fetcher:async(url,options)=>{
      const result=await handleLiveRequest(new Request(url,options),e,1000);
      if(lose){lose=false;throw new Error('Acknowledgement lost');}
      return result;
    }});
  await assert.rejects(relay.publish({action:'start',payload,clientId:client}));
  const first=relay.sessionId;
  await relay.publish({action:'start',payload,clientId:client});
  assert.equal(relay.sessionId,first);assert.equal(relay.active,true);
  await relay.publish({action:'stop',clientId:client});
});

test('the laptop relay keeps its publishing key out of the browser and enforces one studio tab',async()=>{
  const e=env(),seen=[];
  const relay=new LocalBroadcastRelay({endpoint:'https://atelier.test/api/live',token,
    fetcher:async(url,options)=>{seen.push(options);return handleLiveRequest(new Request(url,options),e,1000);}});
  const configuration=await (await relay.handle(new Request('http://localhost/api/broadcast'))).json();
  assert.equal(configuration.token,undefined);assert.equal(configuration.configured,true);
  const request=(action,clientId=client)=>new Request('http://localhost/api/broadcast',{
    method:'POST',headers:{'X-Atelier-Local':configuration.localToken},body:JSON.stringify({action,payload,clientId})});
  assert.equal((await relay.handle(request('start'))).status,200);
  assert.equal((await relay.handle(request('update',id))).status,502);
  assert.equal((await relay.handle(request('stop'))).status,200);assert.equal(relay.active,false);
  assert.equal(seen.length,2);assert.equal(seen[0].headers.Authorization,'Bearer '+token);
  assert.equal((await relay.handle(new Request('http://localhost/api/broadcast',{method:'POST',body:'{}'}))).status,403);
});

test('the browser sends changed boundaries, retries a failed update and ends even without a rendered canvas',async()=>{
  let count=0,fail=false,last=[],statuses=[];
  const broadcaster=new LiveBroadcast({interval:100000,snapshot:()=>({...payload,signature:String(count)}),
    onStatus:state=>statuses.push(state),fetcher:async(url,options)=>{
      if(!options?.body)return Response.json({configured:true,localToken:'local',active:false});
      const input=JSON.parse(options.body);last.push(input.action);
      if(fail){fail=false;return Response.json({error:'disconnected'},{status:502});}
      return Response.json({accepted:true});
    }});
  try{
    await broadcaster.configure();await broadcaster.start();await broadcaster.tick();
    assert.deepEqual(last,['start']);
    count=1;fail=true;await broadcaster.tick();assert.equal(statuses.at(-1),'reconnecting');
    await broadcaster.tick();assert.equal(statuses.at(-1),'live');
    broadcaster.snapshot=()=>{throw new Error('No rendered canvas');};
    await broadcaster.end();assert.equal(broadcaster.active,false);assert.equal(last.at(-1),'stop');
  }finally{broadcaster.dispose();}
});

test('ending with a vanished laptop server stops heartbeats instead of reconnecting forever',async()=>{
  let calls=0,status;
  const broadcaster=new LiveBroadcast({interval:100000,snapshot:()=>({...payload,signature:'1'}),
    onStatus:value=>status=value,fetcher:async()=>{calls++;throw new Error('Server stopped');}});
  try{
    broadcaster.active=true;
    await broadcaster.end();
    assert.equal(broadcaster.active,false);assert.equal(status,'ended-offline');
    await broadcaster.tick();assert.equal(calls,1,'An ended broadcast must not keep sending');
  }finally{broadcaster.dispose();}
});

const presence=(viewerId,active=true,headers={})=>new Request('https://atelier.test/api/live/viewers',{
  method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify({viewerId,active})});
test('viewer heartbeats count distinct recent tabs, page through storage, and expire missing viewers',async()=>{
  const e=env(),third='c1111111-1111-4111-8111-111111111111';
  const count=async(who,time,active=true)=>(await (await handleLiveRequest(presence(who,active),e,time)).json()).viewers;
  assert.equal(await count(id,1000),1);
  assert.equal(await count(id,2000),1,'A heartbeat must not count a tab twice');
  assert.equal(await count(client,2000),2);
  assert.equal(await count(third,2000),3,'Counts must include every storage page');
  assert.equal(await count(third,2001,false),2);
  assert.equal(await count(client,2000+VIEWER_TIMEOUT),1,'A lost viewer expires without a leave request');
  const page=await e.BUCKET.list({prefix:'atelier/viewers/',limit:1000});assert.equal(page.objects.length,1);
});

test('presence stores no submitted identity fields and rejects invalid or cross-origin requests',async()=>{
  const e=env();
  assert.equal((await handleLiveRequest(presence('invalid'),e)).status,400);
  assert.equal((await handleLiveRequest(presence(id,true,{Origin:'https://elsewhere.test'}),e)).status,403);
  assert.equal((await handleLiveRequest(new Request('https://atelier.test/api/live/viewers'),e)).status,405);
  const request=new Request('https://atelier.test/api/live/viewers',{method:'POST',body:JSON.stringify({viewerId:id,active:true,email:'private@example.test'})});
  const response=await handleLiveRequest(request,e,1000);assert.deepEqual(await response.json(),{viewers:1});
  const stored=await e.BUCKET.list({prefix:'atelier/viewers/',limit:1000});
  assert.deepEqual(stored.objects[0].customMetadata,{seenAt:'1000'});
  assert.equal((await e.BUCKET.get('atelier/viewers/'+id)).json instanceof Function,true);
  const oversized=new Request('https://atelier.test/api/live/viewers',{method:'POST',body:' '.repeat(300)});
  assert.equal((await handleLiveRequest(oversized,e)).status,400);
});

test('the live lamp goes off for expired or ended canvases and recovers for a fresh session',()=>{
  const state={...payload,receivedAt:1000};
  assert.equal(livePresentation(state,1001).live,true);
  for(const offline of [{...state,activity:'ended'},{...state,status:'disconnected'}]){
    const view=livePresentation(offline,1001);assert.equal(view.live,false);assert.equal(view.badge,'STUDIO OFFLINE');
  }
  assert.equal(livePresentation(state,1000+LIVE_TIMEOUT).live,false);
  assert.equal(livePresentation({...state,receivedAt:60000},60001).live,true);
  assert.equal(livePresentation(null).status,'offline');
});

test('only arriving thoughts animate; repeated heartbeats preserve the existing conversation',()=>{
  const first=thoughtChange(null,id,document.events);assert.equal(first.animate,false);
  const repeated=thoughtChange(first,id,document.events);assert.equal(repeated.changed,false);assert.equal(repeated.animate,false);
  const second={afterStroke:2,text:'The new mark softened.'};
  const added=thoughtChange(first,id,[...document.events,second]);
  assert.equal(added.animate,true);assert.equal(added.append,true);assert.deepEqual(added.added,[second]);
  const reset=thoughtChange(added,client,document.events);assert.equal(reset.append,false);assert.equal(reset.animate,true);
});

const stroke={medium:'pencil',color:'#315b70',size:4,duration:800,points:[[.3,.5,.5],[.6,.4,.7]]};
const painting=count=>({...payload,document:{...document,strokes:Array.from({length:count},()=>stroke)},signature:String(count)});
const publicSnapshot=async e=>(await (await handleLiveRequest(new Request('https://atelier.test/api/live'),e,100000)).json());

test('ending sends all 37 marks even if the last heartbeat uploaded only 34',async()=>{
  const e=env();let count=34;
  const relay=new LocalBroadcastRelay({endpoint:'https://atelier.test/api/live',token,fetcher:(url,options)=>handleLiveRequest(new Request(url,options),e,1000)});
  const broadcaster=new LiveBroadcast({interval:100000,storage:null,snapshot:()=>painting(count),fetcher:(url,options)=>relay.handle(new Request('http://localhost'+url,options))});
  try{
    await broadcaster.configure();await broadcaster.start();count=37;
    await broadcaster.end();
    const result=await publicSnapshot(e);
    assert.equal(result.document.strokes.length,37);assert.equal(result.activity,'ended');assert.equal(result.status,'ended');
    assert.equal(broadcaster.pendingEnd,null);
  }finally{broadcaster.dispose();}
});

test('ending waits for an in-flight older update before sending the final snapshot',async()=>{
  let count=34,release,started;const gate=new Promise(resolve=>release=resolve),entered=new Promise(resolve=>started=resolve),seen=[];
  const broadcaster=new LiveBroadcast({interval:100000,storage:null,snapshot:()=>painting(count),fetcher:async(url,options)=>{
    const input=JSON.parse(options.body);seen.push([input.action,input.payload.document.strokes.length]);
    if(input.action==='update'){started();await gate;}
    return Response.json({accepted:true});
  }});
  try{
    await broadcaster.start();count=35;
    const update=broadcaster.tick();await entered;count=37;
    const ending=broadcaster.end();release();await Promise.all([update,ending]);
    assert.deepEqual(seen,[['start',34],['update',35],['stop',37]]);
    assert.equal(broadcaster.active,false);assert.equal(broadcaster.pendingEnd,null);
  }finally{broadcaster.dispose();}
});

test('an offline final snapshot survives a browser reload and retries without live heartbeats',async()=>{
  const items=new Map(),storage={getItem:key=>items.get(key),setItem:(key,value)=>items.set(key,value),removeItem:key=>items.delete(key)};
  let offline=false,count=34,clock=0;const seen=[];
  const fetcher=async(url,options)=>{
    if(!options?.body)return Response.json({configured:true,localToken:'local',active:false});
    const input=JSON.parse(options.body);seen.push(input.action);
    if(offline)throw new Error('Local server stopped');
    assert.equal(input.action==='stop'?input.payload.document.strokes.length:count,count);
    return Response.json({accepted:true});
  };
  const first=new LiveBroadcast({interval:100000,snapshot:()=>painting(count),storage,now:()=>clock,fetcher});
  let second;
  try{
    await first.start();count=37;offline=true;await first.end();first.dispose();
    assert.equal(first.active,false);assert.equal(JSON.parse(items.get('atelier-broadcast-end-v1')).payload.document.strokes.length,37);
    second=new LiveBroadcast({interval:100000,snapshot:()=>{throw new Error('Canvas not rebuilt');},storage,now:()=>clock,fetcher});
    offline=false;clock=2000;await second.configure();await second.tick();
    assert.equal(second.active,false);assert.equal(second.pendingEnd,null);assert.equal(items.size,0);
    assert.deepEqual(seen,['start','stop','stop']);
  }finally{first.dispose();second?.dispose();}
});

test('a restarted relay restores its session and an open browser refreshes its rotated local token',async()=>{
  const e=env();let saved,relay,count=34;
  const persistence={load:async()=>saved?structuredClone(saved):null,save:async state=>{saved=structuredClone(state);}};
  const makeRelay=()=>new LocalBroadcastRelay({endpoint:'https://atelier.test/api/live',token,persistence,fetcher:(url,options)=>handleLiveRequest(new Request(url,options),e,1000)});
  relay=makeRelay();
  const broadcaster=new LiveBroadcast({interval:100000,storage:null,snapshot:()=>painting(count),fetcher:(url,options)=>relay.handle(new Request('http://localhost'+url,options))});
  try{
    await broadcaster.configure();await broadcaster.start();const sessionId=relay.sessionId,oldLocalToken=relay.localToken;
    relay=makeRelay();count=37;await broadcaster.tick();
    assert.equal(relay.sessionId,sessionId);assert.notEqual(relay.localToken,oldLocalToken);
    assert.equal(broadcaster.localToken,relay.localToken);assert.equal((await publicSnapshot(e)).document.strokes.length,37);
    await broadcaster.end();assert.equal((await publicSnapshot(e)).activity,'ended');
    assert.equal(saved.active,false);assert.equal(saved.lastSnapshot.document.strokes.length,37);
    assert.equal(JSON.stringify(saved).includes(token),false,'Publisher credentials must not enter the journal');
  }finally{broadcaster.dispose();}
});

test('a lost end acknowledgement can retry the complete final canvas on an already stopped relay',async()=>{
  const e=env();let lose=true;
  const relay=new LocalBroadcastRelay({endpoint:'https://atelier.test/api/live',token,fetcher:async(url,options)=>{
    const result=await handleLiveRequest(new Request(url,options),e,1000);
    if(JSON.parse(options.body).activity==='ended'&&lose){lose=false;throw new Error('Acknowledgement lost');}
    return result;
  }});
  await relay.publish({action:'start',payload:painting(34),clientId:client});
  await assert.rejects(relay.publish({action:'stop',payload:painting(37),clientId:client}));
  assert.equal(relay.active,false);
  await relay.publish({action:'stop',payload:painting(37),clientId:client});
  const result=await publicSnapshot(e);assert.equal(result.document.strokes.length,37);assert.equal(result.activity,'ended');
});

test('finished-export recovery restores matching missing marks, rejects another painting and preserves new activity',async()=>{
  const e=env();await handleLiveRequest(post({...painting(34),sessionId:id,sequence:1}),e,1000);
  const fetcher=(url,options)=>handleLiveRequest(new Request(url,options),e,100000);
  const args={document:painting(37).document,preview,endpoint:'https://atelier.test/api/live',token,fetcher};
  const result=await finalizeLivePainting(args);assert.equal(result.marks,37);assert.equal(result.status,'ended');
  assert.equal((await publicSnapshot(e)).origin,'Finished export recovery');
  assert.equal(livePresentation(await publicSnapshot(e)).activity,'The AI is offline · finished canvas restored');
  await assert.rejects(finalizeLivePainting({...args,document:{...args.document,strokes:[{...stroke,color:'#ffffff'}]}}),/does not match/);
  const current=env();await handleLiveRequest(post({...painting(34),sessionId:id,sequence:1}),current,1000);
  let calls=0;
  const racingFetcher=async(url,options)=>{
    const response=await handleLiveRequest(new Request(url,options),current,100000);
    if(++calls===1)await handleLiveRequest(post({...painting(38),sessionId:id,sequence:2}),current,100000);
    return response;
  };
  await assert.rejects(finalizeLivePainting({...args,fetcher:racingFetcher}),/not accepted \(409\)/);
  assert.equal((await publicSnapshot(current)).document.strokes.length,38);
  await assert.rejects(finalizeLivePainting({...args,fetcher:(url,options)=>handleLiveRequest(new Request(url,options),current,100001)}),/inactive/);
});


test('viewer freshness follows the server clock even with a fast or slow wall clock',()=>{
  for(const skew of [-86400000,86400000,365*86400000]){
    let wall=1000+skew,tick=50;
    const clock=new LiveFeedClock({wall:()=>wall,tick:()=>tick});
    const fresh=publicLiveState({...payload,receivedAt:1000},2000);
    clock.accept(fresh);
    assert.equal(livePresentation(fresh,clock.now()).live,true);
    wall+=20*86400000;tick+=43999;
    assert.equal(livePresentation(fresh,clock.now()).live,true,'Wall-clock jumps must not expire a fresh feed');
    tick++;
    assert.equal(livePresentation(fresh,clock.now()).status,'disconnected');
    const heartbeat=publicLiveState({...payload,receivedAt:50000},50001);
    clock.accept(heartbeat);
    assert.equal(livePresentation(heartbeat,clock.now()).live,true);
    clock.accept(publicLiveState({...payload,activity:'ended',receivedAt:50001},50001));
    assert.equal(livePresentation({...heartbeat,activity:'ended'},clock.now()).status,'ended');
  }
});

test('legacy live responses and offline boot remain usable during a rolling deployment',()=>{
  let tick=0;const clock=new LiveFeedClock({wall:()=>900000,tick:()=>tick});
  clock.accept({...payload,status:'live',live:true,receivedAt:1000});
  assert.equal(livePresentation({...payload,receivedAt:1000},clock.now()).live,true);
  tick=45000;assert.equal(livePresentation({...payload,receivedAt:1000},clock.now()).live,false);
  clock.accept({status:'offline',live:false,serverNow:2000});
  assert.equal(livePresentation(null,clock.now()).status,'offline');
});

test('the return sign uses the next Pacific weekday hour, including DST weekends',()=>{
  const cases=[
    ['2026-10-15T14:30:00Z','2026-10-15T15:00:00.000Z','à 8 h'],
    ['2026-10-15T16:16:00Z','2026-10-15T17:00:00.000Z','à 10 h'],
    ['2026-10-15T22:00:00Z','2026-10-16T15:00:00.000Z','à 8 h'],
    ['2026-10-16T22:16:00Z','2026-10-19T15:00:00.000Z','à 8 h'],
    ['2026-10-30T22:16:00Z','2026-11-02T16:00:00.000Z','à 8 h'],
    ['2026-03-06T23:16:00Z','2026-03-09T15:00:00.000Z','à 8 h']
  ];
  for(const [now,at,time] of cases){
    const sign=returnSchedule(Date.parse(now));assert.equal(sign.at,at);assert.equal(sign.time,time);
  }
  assert.equal(returnSchedule(Date.parse('2026-10-15T16:16:00Z')).date,'aujourd’hui');
  assert.match(returnSchedule(Date.parse('2026-10-16T22:16:00Z')).date,/lundi 19 octobre/);
});

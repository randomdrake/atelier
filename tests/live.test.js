import {test} from 'node:test';
import assert from 'node:assert/strict';
import {handleLiveRequest,publicLiveState,LIVE_TIMEOUT} from '../src/live-service.js';
import {LocalBroadcastRelay} from '../src/local-broadcast.js';
import {LiveBroadcast} from '../src/live-broadcast.js';

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
    async put(key,value,{onlyIf}={}){
      const old=data.get(key);
      if(onlyIf?.etagMatches&&old?.etag!==onlyIf.etagMatches||onlyIf?.etagDoesNotMatch==='*'&&old)return null;
      const etag=String(++revision);data.set(key,{value,etag});return {etag};
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
  assert.equal(state.publisher,'randomdrake');assert.equal(state.live,true);
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
  assert.deepEqual(await (await handleLiveRequest(new Request('https://atelier.test/api/live'),e)).json(),{status:'offline',live:false});
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
      if(!options)return Response.json({configured:true,localToken:'local',active:false});
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

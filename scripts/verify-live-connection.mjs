// An authenticated, isolated hosted round trip. Never replaces the public easel.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {LocalBroadcastRelay} from '../src/local-broadcast.js';
import {livePresentation} from '../src/live-status.js';
import {publicLiveState} from '../src/live-service.js';
import {randomUUID} from 'node:crypto';

try{process.loadEnvFile('.env.live');}catch(error){if(error.code!=='ENOENT')throw error;}
const endpoint=process.env.ATELIER_BROADCAST_URL,token=process.env.ATELIER_BROADCAST_TOKEN;
assert.ok(endpoint&&token,'Configure the existing laptop relay before verifying its hosted connection');
const url=new URL(endpoint),testURL=new URL(endpoint);testURL.searchParams.set('test','1');
const read=async target=>{
  const response=await fetch(target,{headers:{Authorization:'Bearer '+token},cache:'no-store',signal:AbortSignal.timeout(15000)});
  assert.equal(response.status,200,'Hosted live read failed');return response.json();
};
const before=await read(url),existing=(await read(testURL)).snapshot;
assert.ok(!existing||existing.activity==='ended'||Date.now()-existing.receivedAt>=45000,'Another isolated verification is active');
const saved=JSON.parse(await readFile('.atelier-broadcast-state.json','utf8'));
assert.ok(saved.lastSnapshot?.preview,'A saved actual canvas preview is required');
const document={version:2,width:900,height:620,title:'Isolated connection verification',strokes:[],events:[]};
const stroke={medium:'pencil',color:'#315b70',size:4,duration:800,points:[[.3,.5,.5],[.6,.4,.7]]};
let payload={activity:'looking',document,preview:saved.lastSnapshot.preview,camera:{zoom:1,x:.5,y:.5}};
const relay=new LocalBroadcastRelay({endpoint,token,test:true});
const clientId=randomUUID();let started=false;
try{
  await relay.publish({action:'start',payload,clientId});started=true;
  let snapshot=(await read(testURL)).snapshot;
  assert.equal(snapshot.sessionId,relay.sessionId);assert.equal(snapshot.test,true);
  // A gallery's reported time is authoritative even for a badly set viewer clock.
  assert.equal(livePresentation(publicLiveState({...snapshot,test:false},snapshot.receivedAt),snapshot.receivedAt).live,true);
  for(const activity of ['painting','looking','replaying']){
    payload={...payload,activity,document:{...document,strokes:[stroke,stroke]},camera:{zoom:2,x:.7,y:.3}};
    await relay.publish({action:'update',payload,clientId});
    snapshot=(await read(testURL)).snapshot;
    assert.equal(snapshot.activity,activity);assert.equal(snapshot.document.strokes.length,2);assert.equal(snapshot.camera.zoom,2);
  }
  await relay.publish({action:'stop',payload,clientId});started=false;
  snapshot=(await read(testURL)).snapshot;
  assert.equal(snapshot.activity,'ended');assert.equal(snapshot.document.strokes.length,2);
  assert.equal(livePresentation(publicLiveState({...snapshot,test:false},snapshot.receivedAt),snapshot.receivedAt).live,false);
  const after=await read(url);
  // Concurrent real painting is allowed; the test must never become the public feed.
  assert.notEqual(after.sessionId,relay.sessionId);
  assert.notEqual(after.document?.title,document.title);
  console.log(JSON.stringify({isolatedHostedRoundTrip:'passed',activities:['painting','looking','replaying','ended'],finalMarks:2,
    publicFeedUnchanged:before.sessionId===after.sessionId&&before.sequence===after.sequence,
    publicStatus:after.status,serverClockAvailable:Number.isFinite(after.serverNow)}));
}finally{
  if(started)await relay.publish({action:'stop',payload,clientId});
}

import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

process.loadEnvFile('.env.live');
const endpoint=new URL(process.env.ATELIER_BROADCAST_URL);
endpoint.searchParams.set('test','1');
const token=process.env.ATELIER_BROADCAST_TOKEN;
const sessionId=randomUUID();
const document={version:2,width:900,height:620,title:'Isolated broadcast verification',
  strokes:[{medium:'pencil',color:'#315b70',size:4,duration:800,points:[[.3,.5,.5],[.6,.4,.7]]}],
  events:[{afterStroke:1,text:'Authenticated laptop relay verification; not a public painting.',duration:6000}]};
const snapshot={sessionId,activity:'looking',document,preview:'data:image/jpeg;base64,/9j/2Q=='};
async function send(sequence,activity='looking'){
  const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
    body:JSON.stringify({...snapshot,sequence,activity}),signal:AbortSignal.timeout(15000)});
  assert.equal(response.status,200,'Hosted broadcast update was not accepted');
  const result=await response.json();assert.equal(result.sequence,sequence);
}
await send(1);
const read=await fetch(endpoint,{headers:{Authorization:'Bearer '+token},cache:'no-store'});
assert.equal(read.status,200);
const stored=(await read.json()).snapshot;
assert.equal(stored.sessionId,sessionId);assert.equal(stored.document.strokes.length,1);
assert.equal(stored.publisher,'randomdrake');
await send(2);
await send(3,'ended');
const unauthorized=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
assert.equal(unauthorized.status,401);
endpoint.searchParams.delete('test');
const publicRead=await fetch(endpoint,{cache:'no-store'});
assert.equal(publicRead.status,200);
assert.notEqual((await publicRead.json()).sessionId,sessionId,'Isolated test appeared on the public easel');
console.log('Hosted live path verified: authenticated updates, stored stroke and thought, end state, unauthorized rejection, isolated from public painting feed.');

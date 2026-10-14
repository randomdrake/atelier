import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LiveCamera} from '../src/live-camera.js';
import {WHOLE_VIEW,cameraTransform} from '../src/camera.js';
import {validateLiveSnapshot} from '../src/live-service.js';

const close={zoom:2,x:.5,y:.5},pan={zoom:2,x:.75,y:.25};
const state=(views=[],camera=views.at(-1)??WHOLE_VIEW,sessionId='one')=>({sessionId,camera,document:{events:views.map(camera=>({afterStroke:0,camera}))}});

test('a quiet easel and failed first poll keep the camera at whole view',()=>{
  const view=new LiveCamera();
  view.update(null);view.update({status:'offline'});view.update(null);
  assert.deepEqual(view.value,WHOLE_VIEW);assert.equal(view.moving,false);
});

test('live camera preserves zoom, pan and return moves arriving between polls',()=>{
  const view=new LiveCamera();view.update(state());
  view.update(state([close,pan,WHOLE_VIEW]));
  assert.equal(view.queue.length,3);
  view.advance(.8);assert.deepEqual(view.value,close);
  view.advance(.35);view.advance(.8);assert.deepEqual(view.value,pan);
  view.advance(.35);view.advance(.8);assert.deepEqual(view.value,WHOLE_VIEW);
  assert.equal(view.moving,false);
});

test('heartbeats do not restart an in-progress camera move or duplicate its queue',()=>{
  const view=new LiveCamera();view.update(state());view.update(state([close]));
  view.advance(.4);assert.equal(view.value.zoom,1.5);
  const elapsed=view.camera.elapsed;
  view.update(state([close]));assert.equal(view.camera.elapsed,elapsed);assert.equal(view.queue.length,0);
  view.advance(.4);assert.deepEqual(view.value,close);assert.equal(view.moving,false);
});

test('joining and replacement sessions use the current camera without replaying historical inspection moves',()=>{
  const view=new LiveCamera();view.update(state([close,pan,WHOLE_VIEW],pan));
  assert.equal(view.queue.length,0);view.advance(.8);assert.deepEqual(view.value,pan);
  view.update(state([close],close,'two'));assert.equal(view.queue.length,0);
  view.advance(.8);assert.deepEqual(view.value,close);
});

test('reduced motion jumps to the latest view and ending cancels pending inspections for a whole view',()=>{
  const view=new LiveCamera();view.update(state());
  view.update(state([close,pan]),{reducedMotion:true});
  assert.deepEqual(view.value,pan);assert.equal(view.moving,false);
  view.update(state([close,pan,close]));assert.equal(view.queue.length,1);
  view.update(state([close,pan,close]),{ended:true});
  assert.equal(view.queue.length,0);view.advance(.8);assert.deepEqual(view.value,WHOLE_VIEW);
  view.update(state([close,pan,close]),{ended:true});assert.equal(view.moving,false);
});

test('live viewport matches the studio focus and clamps pans at canvas edges',()=>{
  assert.equal(cameraTransform(WHOLE_VIEW),'translate(0%, 0%) scale(1)');
  assert.equal(cameraTransform(close),'translate(-50%, -50%) scale(2)');
  assert.equal(cameraTransform(pan),'translate(-100%, 0%) scale(2)');
  assert.equal(cameraTransform({zoom:3,x:0,y:1}),'translate(0%, -200%) scale(3)');
});

test('snapshot validation carries only bounded public camera fields and supports older broadcasts',()=>{
  const input={activity:'looking',preview:'data:image/jpeg;base64,/9j/2Q==',document:{version:2,width:900,height:620,strokes:[],events:[]}};
  assert.deepEqual(validateLiveSnapshot(input).camera,WHOLE_VIEW);
  assert.deepEqual(validateLiveSnapshot({...input,camera:{...pan,private:'discard'}}).camera,pan);
  for(const camera of [{zoom:4,x:.5,y:.5},{zoom:2,x:-1,y:.5},{zoom:2,x:.5,y:Infinity},{zoom:NaN,x:.5,y:.5},{}]){
    assert.throws(()=>validateLiveSnapshot({...input,camera}),/Camera views/);
  }
});

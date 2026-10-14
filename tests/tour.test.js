import {test} from 'node:test';
import assert from 'node:assert/strict';
import {StudioTour,StudioCamera,validateDocument,validateEvents} from '../src/tour.js';
import {PaintSurface} from '../src/engine.js';
import {PaintingSession} from '../src/session.js';
const stroke={medium:'watercolor',color:'#315b70',size:12,points:[[.2,.3,.7],[.7,.5,.8]],duration:350};
const events=[{afterStroke:0,text:'A little room to explore.',duration:500,camera:{zoom:1,x:.5,y:.5}},{afterStroke:1,text:'Look at the wet edge.',kind:'notice',duration:700,camera:{zoom:2,x:.4,y:.4}},{afterStroke:1,text:'Now see the whole shape.',kind:'try',duration:500,camera:{zoom:1,x:.5,y:.5}},{afterStroke:2,text:'We can leave this quiet.',kind:'keep',duration:500}];
test('legacy scores and sessions remain compatible with narrated documents',()=>{
  assert.equal(validateDocument([stroke]).events.length,0);
  assert.equal(validateDocument({version:1,strokes:[stroke]}).version,2);
  const doc=validateDocument({version:2,title:'Study',strokes:[stroke,stroke],events});
  assert.deepEqual(doc.events,events);doc.strokes[0].points[0][0]=.9;assert.equal(stroke.points[0][0],.2);
});
test('invalid camera and event boundaries reject the complete document',()=>{
  for(const event of [{afterStroke:3,text:'bad'},{afterStroke:-1,text:'bad'},{afterStroke:0},{afterStroke:0,text:42},{afterStroke:0,text:'a',duration:0},{afterStroke:0,text:'a',kind:'secret'},{afterStroke:0,camera:{zoom:5,x:.5,y:.5}},{afterStroke:0,camera:{zoom:2,x:NaN,y:.5}}])assert.throws(()=>validateDocument({version:2,strokes:[stroke],events:[event]}));
});
test('studio events keep their order when several share the same stroke boundary',()=>{
  assert.deepEqual(validateEvents([events[3],events[1],events[0],events[2]],2).map(e=>e.text),[events[0],events[1],events[2],events[3]].map(e=>e.text));
});
test('intro, close-up, whole view and final notes all play at their boundaries',()=>{
  const seen=[],tour=new StudioTour({cue:e=>seen.push(e.text)});tour.start(events,2);
  assert(tour.advance(.1,0));assert.equal(seen.length,1);
  assert(!tour.advance(1,0));assert.equal(seen.length,1);
  assert(tour.advance(.1,1));assert.equal(seen.length,2);
  assert(tour.advance(1,1));assert.equal(seen.length,3);
  assert(!tour.advance(1,1));assert(tour.running);
  assert(tour.advance(.1,2));assert.equal(seen.length,4);
  assert(!tour.advance(1,2));assert(!tour.running);
  tour.start(events,2);tour.advance(.1,0);assert.equal(seen.length,5);
});
test('camera movement interpolates and finishes at the exact recorded focus',()=>{
  const c=new StudioCamera();c.move({zoom:2,x:.7,y:.3},1);c.advance(.5);
  assert.deepEqual(c.value,{zoom:1.5,x:.6,y:.4});c.advance(3);assert.deepEqual(c.value,{zoom:2,x:.7,y:.3});
  c.move({zoom:1,x:.5,y:.5},1);c.advance(1);assert.deepEqual(c.value,{zoom:1,x:.5,y:.5});
});
test('narrated replay holds simulation during notes and preserves the painted result',()=>{
  const score=[stroke,{...stroke,color:'#bb7755',medium:'oil',points:[[.4,.2,.8],[.4,.7,.9]]}];
  const plain=new PaintSurface(48,36),p=new PaintingSession(plain);p.play(score);while(p.busy)p.advance(.08);
  const surface=new PaintSurface(48,36),player=new PaintingSession(surface),tour=new StudioTour();
  player.play(score);tour.start(events,2);let count=0;
  while(player.busy||tour.running){
    const before=surface.snapshot(),holding=tour.advance(.08,player.strokes.length);
    if(holding)assert.deepEqual(surface.snapshot(),before);else if(player.busy)player.advance(.08,true);
    assert(count++<5000);
  }
  assert.deepEqual(surface.snapshot(),plain.snapshot());assert.equal(player.strokes.length,2);
});
test('stopping a studio tour prevents queued comments and camera actions from firing',()=>{
  let cues=0;const tour=new StudioTour({cue:()=>cues++});tour.start(events,2);tour.advance(.1,0);tour.stop();
  assert(!tour.advance(100,2));assert.equal(cues,1);
});

test('a session without a title can be normalized and opened again without losing its score',()=>{
  const doc=validateDocument({version:1,strokes:[stroke]});assert.equal(doc.title,null);
  assert.deepEqual(validateDocument(doc),doc);
});
test('the full flower lesson plays all 24 moments without changing the completed physical fields',async()=>{
  const {readFile}=await import('node:fs/promises');
  const doc=validateDocument(JSON.parse(await readFile(new URL('../examples/afternoon-flowers-tour.json',import.meta.url),'utf8')));
  assert.equal(doc.strokes.length,34);assert.equal(doc.events.length,24);
  const surface=new PaintSurface(72,50),player=new PaintingSession(surface),heard=[];
  const tour=new StudioTour({cue:e=>heard.push(e)});player.play(doc.strokes);tour.start(doc.events,doc.strokes.length);
  let frames=0;while(player.busy||tour.running){if(!tour.advance(.2,player.strokes.length)&&player.busy)player.advance(.2,true);assert(frames++<20000);}
  assert.deepEqual(heard,doc.events);
  const plain=new PaintSurface(72,50),comparison=new PaintingSession(plain);comparison.play(doc.strokes);while(comparison.busy)comparison.advance(.04);
  assert.deepEqual(surface.snapshot(),plain.snapshot());
});

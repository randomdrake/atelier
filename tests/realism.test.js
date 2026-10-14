import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PaintSurface,BrushReservoir,mixPigments,rgb,validateScore} from '../src/engine.js';
import {PaintingSession} from '../src/session.js';
const sum=a=>a.reduce((x,y)=>x+y,0);
const watercolor={medium:'watercolor',color:'#315b70',size:18,flow:.8,water:1};
const oil={medium:'oil',color:'#315b70',size:18,flow:.8,body:.9};
const totalRGB=s=>[0,1,2].map(c=>s.pigment.reduce((total,x,i)=>total+(i%3===c?x:0),0));
const close=(a,b,tolerance=.0001)=>assert(Math.abs(a-b)<tolerance,`${a} differs from ${b}`);

test('capillary flow carries watercolor outside its original footprint without losing pigment',()=>{
  const s=new PaintSurface(48,36);s.dab(.5,.5,1,watercolor);
  const before=s.mass.slice(),mass=sum(s.mass),color=totalRGB(s);
  for(let i=0;i<80;i++)s.step(.05);
  assert(s.mass.some((v,i)=>before[i]===0&&v>.00001));
  close(sum(s.mass),mass,.001);totalRGB(s).forEach((v,c)=>close(v,color[c],.001));
  assert(sum(s.absorbed)>0);assert(s.mobile.every((v,i)=>v>=0&&v<=s.mass[i]+.00001));
});
test('suspended blue watercolor cannot carry red dry pigment away',()=>{
  const s=new PaintSurface(48,36);s.dab(.5,.5,1,{medium:'pencil',color:'#cc4422',size:16});
  const anchored=s.pigment.slice();s.dab(.5,.5,1,watercolor);
  for(let i=0;i<60;i++)s.step(.05);
  for(let i=0;i<anchored.length;i++)assert(s.pigment[i]-s.mobilePigment[i]>=anchored[i]-.00001);
});
test('a clean-water brush adds moisture without adding paint',()=>{
  const s=new PaintSurface(48,36);s.dab(.5,.5,1,{...watercolor,flow:0});
  assert(sum(s.water)>0);assert.equal(sum(s.mass),0);assert.equal(sum(s.mobilePigment),0);
});
test('oil displacement conserves color, absorption, mass, and relief',()=>{
  const s=new PaintSurface(48,36);s.dab(.5,.5,1,oil);
  const totals=['mass','pigment','oilMass','oilPigment','oilColor','heightMap','oilHeight'].map(k=>sum(s[k]));
  const source=18*48+24,target=18*48+29,old=s.oilMass[target];
  s.moveOil(source,target,s.oilMass[source]*.4);
  assert(s.oilMass[target]>old);
  ['mass','pigment','oilMass','oilPigment','oilColor','heightMap','oilHeight'].forEach((k,i)=>close(sum(s[k]),totals[i],.001));
});
test('brushes push wet oil along their direction, while dry oil stays anchored',()=>{
  const wet=new PaintSurface(64,48);wet.dab(.5,.5,1,oil);const dry=new PaintSurface(64,48);dry.restore(wet.snapshot());dry.oilWet.fill(0);
  const dryBefore=dry.oilMass.slice(),wetBefore=wet.oilMass.slice();
  const empty={...oil,flow:0};wet.dab(.5,.5,1,empty,0);dry.dab(.5,.5,1,empty,0);
  assert.deepEqual(dry.oilMass,dryBefore);assert.notDeepEqual(wet.oilMass,wetBefore);
  close(sum(wet.oilMass),sum(wetBefore),.001);
});
test('opaque pigment mixing is subtractive and has stable endpoints',()=>{
  const blue=rgb('#245caa'),yellow=rgb('#ecc841'),mix=mixPigments(blue,yellow,.5);
  assert(mix[1]>mix[0]&&mix[1]>mix[2]);
  mixPigments(blue,yellow,0).forEach((v,i)=>close(v,blue[i],1e-8));
  mixPigments(blue,yellow,1).forEach((v,i)=>close(v,yellow[i],1e-8));
});
test('thicker oil builds greater relief and leaves ridges across the stroke',()=>{
  const thick=new PaintSurface(64,48),thin=new PaintSurface(64,48);
  thick.segment([.2,.5,1],[.8,.5,1],{...oil,body:1},new BrushReservoir(oil));
  thin.segment([.2,.5,1],[.8,.5,1],{...oil,body:0},new BrushReservoir(oil));
  assert(sum(thick.oilHeight)>sum(thin.oilHeight)*2);
  const heights=Array.from({length:12},(_,y)=>thick.heightMap[(18+y)*64+32]);
  assert(Math.max(...heights)-Math.min(...heights)>.05);
  assert(thick.render(new Uint8ClampedArray(thick.length*4)).some((v,i)=>i%4<3&&v<180));
});
test('optional realism controls and waiting time reject invalid inputs atomically',()=>{
  const valid={...watercolor,points:[[.2,.2],[.8,.8]],wait:100,body:.5};
  for(const change of [{water:2},{body:-1},{flow:NaN},{wait:-1},{tip:'fork'}])assert.throws(()=>validateScore([valid,{...valid,...change}]));
});
const score=[
  {...watercolor,size:12,points:[[.1,.2,.5],[.8,.4,.8]],duration:550},
  {...oil,size:10,color:'#cca741',points:[[.2,.65,.6],[.75,.65,.9]],duration:750,wait:200},
  {...oil,size:8,points:[[.5,.5,.8],[.5,.8,.7]],duration:600}
];
function renderScore(frameTime){
  const surface=new PaintSurface(64,48),session=new PaintingSession(surface);session.play(score);
  let count=0;while(session.busy){session.advance(frameTime);assert(count++<10000);}
  return {surface,session};
}
test('the complete physical timeline is identical at different frame rates and replay speeds',()=>{
  const slow=renderScore(.01),fast=renderScore(.12);
  assert.deepEqual(slow.surface.snapshot(),fast.surface.snapshot());
  assert.equal(slow.session.strokes.length,score.length);
});
test('replay clears prior paint and reconstructs all physical fields exactly',async()=>{
  const {surface,session}=renderScore(.03),expected=surface.snapshot();
  const done=session.replay();while(session.busy)session.advance(.2);
  assert.deepEqual(await done,{cancelled:false});assert.deepEqual(surface.snapshot(),expected);
  assert.equal(session.strokes.length,score.length);
});
test('pause freezes fluid and playback; stop preserves the painted part for replay',async()=>{
  const surface=new PaintSurface(64,48),session=new PaintingSession(surface),done=session.play(score);
  session.advance(.2);session.paused=true;const snapshot=surface.snapshot(),elapsed=session.active.playback.elapsed;
  session.advance(3);assert.deepEqual(surface.snapshot(),snapshot);assert.equal(session.active.playback.elapsed,elapsed);
  session.stop();assert.deepEqual(await done,{cancelled:true});assert(!session.busy);assert.equal(session.strokes.length,1);
  assert(session.strokes[0].points.at(-1)[0]<.8);const replay=session.replay();while(session.busy)session.advance(.1);
  assert.deepEqual(await replay,{cancelled:false});
});
test('invalid score cannot replace a valid painting or start a partial queue',()=>{
  const {surface,session}=renderScore(.03),before=surface.snapshot();
  assert.throws(()=>session.play([score[0],{...score[1],water:2}]));
  assert.deepEqual(surface.snapshot(),before);assert(!session.busy);assert.equal(session.strokes.length,3);
});

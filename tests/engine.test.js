import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PaintSurface,BrushReservoir,MEDIA,validateStroke} from '../src/engine.js';
import {compose} from '../src/compositions.js';
const brush={medium:'watercolor',color:'#315b70',size:20,flow:.8};
const sum=a=>a.reduce((x,y)=>x+y,0);
test('opaque oil highlights cover a deep dark ground without erasing its pigment',()=>{
  const s=new PaintSurface(40,40),dark={medium:'oil',color:'#252a24',size:16,body:.1,flow:1};
  for(let n=0;n<80;n++)s.dab(.5,.5,1,dark);
  const i=20*40+20,before=s.render(new Uint8ClampedArray(s.length*4))[i*4],mass=sum(s.oilMass),pigment=sum(s.oilPigment);
  const light={...dark,color:'#ffe8b9',body:1},r=new BrushReservoir(light);
  for(let n=0;n<35;n++)s.dab(.5,.5,1,light,0,r);
  const after=s.render(new Uint8ClampedArray(s.length*4))[i*4];
  assert(after>before+70,`highlight must remain visible: ${before} → ${after}`);
  assert(sum(s.oilMass)>mass);assert(sum(s.oilPigment)>=pigment);
});
test('loaded thick oil retains more fresh color than a thin mixing brush',()=>{
  const s=new PaintSurface(40,40),dark={medium:'oil',color:'#252a24',size:16,flow:1};
  for(let n=0;n<40;n++)s.dab(.5,.5,1,dark);
  const paint={...dark,color:'#ffe8b9'},thick=new BrushReservoir(paint),thin=new BrushReservoir(paint);
  for(let n=0;n<200;n++){thick.contact(s,.5,.5,{...paint,body:1},0);thin.contact(s,.5,.5,{...paint,body:0},0);}
  assert(thick.color[0]>thin.color[0]+.1);assert(thick.color[0]<1);
});
test('all six media deposit finite pigment with distinct water and relief',()=>{
  const results={};for(const medium of Object.keys(MEDIA)){const s=new PaintSurface(64,48);s.dab(.5,.5,.8,{...brush,medium});assert(sum(s.mass)>0);assert(s.render(new Uint8ClampedArray(s.length*4)).every(Number.isFinite));results[medium]={water:sum(s.water),relief:sum(s.heightMap)};}
  assert(results.watercolor.water>results.acrylic.water);assert.equal(results.pencil.water,0);assert(results.oil.relief>results.acrylic.relief);assert(results.acrylic.relief>results.chalk.relief);
});
test('wet transport conserves pigment and mass while water evaporates',()=>{const s=new PaintSurface(64,48);s.dab(.5,.5,.8,brush);const mass=sum(s.mass),pigment=sum(s.pigment),water=sum(s.water);for(let i=0;i<30;i++)s.step(1/30);assert(Math.abs(sum(s.mass)-mass)<.001);assert(Math.abs(sum(s.pigment)-pigment)<.001);assert(sum(s.water)<water);assert(s.mass.every(x=>x>=0));});
test('snapshot restores pigment, water, and relief exactly',()=>{const s=new PaintSurface(64,48);s.dab(.5,.5,.8,brush);const before=s.snapshot();s.step();s.dab(.3,.3,.6,{...brush,medium:'oil'});s.restore(before);for(const k of Object.keys(before))assert.deepEqual(s[k],before[k]);s.clear();assert.equal(sum(s.mass),0);});
test('drying distinguishes slow oil from fast acrylic',()=>{const oil=new PaintSurface(40,40),acrylic=new PaintSurface(40,40);oil.dab(.5,.5,.7,{...brush,medium:'oil'});acrylic.dab(.5,.5,.7,{...brush,medium:'acrylic'});const a=sum(oil.wet),b=sum(acrylic.wet);for(let i=0;i<100;i++){oil.step(.1);acrylic.step(.1);}assert(sum(oil.wet)/a>sum(acrylic.wet)/b);});
test('invalid scores reject nonfinite and out-of-bounds inputs',()=>{const s={...brush,points:[[.1,.2]],duration:100};assert.equal(validateStroke(s),s);for(const edit of [{medium:'ink'},{color:'bad'},{size:0},{points:[[NaN,.2]]},{points:[[1.1,.2]]},{duration:-1}])assert.throws(()=>validateStroke({...s,...edit}));});
test('every built-in study contains valid strokes and visible marks',()=>{for(const prompt of ['coast','sunflower','abstract','harbor']){const study=compose(prompt),s=new PaintSurface(90,62);assert(study.strokes.length>20);for(const stroke of study.strokes){validateStroke(stroke);for(let i=1;i<stroke.points.length;i++)s.segment(stroke.points[i-1],stroke.points[i],stroke);}assert(sum(s.mass)>20);}});
test('off-canvas brush footprints never create invalid state',()=>{const s=new PaintSurface(20,20);for(const p of [[0,0],[1,1],[0,1],[1,0]])s.dab(...p,1,{...brush,size:160});s.step();assert(s.pigment.every(Number.isFinite));assert(s.mass.every(x=>x>=0));});
test('water transports mobile pigment without moving anchored dry marks',()=>{const s=new PaintSurface(64,48);s.dab(.5,.5,.8,{...brush,medium:'pencil'});s.water.fill(.6);const mass=s.mass.slice(),pigment=s.pigment.slice();for(let i=0;i<20;i++)s.step(.1);assert.deepEqual(s.mass,mass);assert.deepEqual(s.pigment,pigment);});
test('watercolor mobility falls as pigment settles without losing paint',()=>{const s=new PaintSurface(64,48);s.dab(.5,.5,.8,brush);const mobile=sum(s.mobile),mass=sum(s.mass);for(let i=0;i<60;i++)s.step(.1);assert(sum(s.mobile)<mobile);assert(Math.abs(sum(s.mass)-mass)<.001);assert(s.mobile.every((v,i)=>v>=0&&v<=s.mass[i]+.00001));});
test('water and paint at canvas borders dry too',()=>{const s=new PaintSurface(20,20);s.water.fill(.6);s.wet.fill(.4);s.drying.fill(.018);const water=s.water[0],wet=s.wet[0];s.step(.1);assert(s.water[0]<water);assert(s.wet[0]<wet);});
test('oil brushes carry wet pigment and gradually spend their paint load',()=>{const s=new PaintSurface(64,48),blue={...brush,medium:'oil'},red={...blue,color:'#cc4422'};for(let i=0;i<30;i++)s.dab(.5,.5,.9,blue);const reservoir=new BrushReservoir(red),initial=reservoir.color.slice();for(let i=0;i<20;i++)reservoir.contact(s,.5,.5,red,0);assert(reservoir.color[2]>initial[2]);assert(reservoir.color[0]<initial[0]);assert(reservoir.load<1);const pencil=new BrushReservoir({...red,medium:'pencil'}),before=pencil.color.slice();pencil.contact(s,.5,.5,{...red,medium:'pencil'},0);assert.deepEqual(pencil.color,before);});

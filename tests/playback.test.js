import {test} from 'node:test';
import assert from 'node:assert/strict';
import {StrokePlayback} from '../src/playback.js';
import {PaintSurface,BrushReservoir} from '../src/engine.js';
const stroke={medium:'oil',color:'#b47738',size:12,duration:1000,points:[[.1,.2,.2],[.5,.7,1],[.9,.3,.4]]};
function play(dt){const surface=new PaintSurface(90,62),player=new StrokePlayback(stroke,90,62),reservoir=new BrushReservoir(stroke);while(!player.done)player.advance(dt,(p,a)=>surface.dab(...p,stroke,a,reservoir));return surface.snapshot();}
test('stroke deposition is identical at 10, 30, and 120 frames per second',()=>{assert.deepEqual(play(100),play(1000/30));assert.deepEqual(play(100),play(1000/120));});
test('zero-duration and single-point strokes finish with valid contacts',()=>{for(const points of [[[.5,.5,.5]],stroke.points]){const player=new StrokePlayback({...stroke,points,duration:0},90,62);let count=0;player.advance(0,()=>count++);assert(player.done);assert(count>0);const before=count;player.advance(100,()=>count++);assert.equal(count,before);}});
test('unfinished playback records only the painted part for cancellation',()=>{const player=new StrokePlayback(stroke,90,62);player.advance(200,()=>{});assert(!player.done);assert(player.drawn.length>0);assert(player.drawn.at(-1)[0]<.5);});

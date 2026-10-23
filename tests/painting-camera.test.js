import {test} from 'node:test';
import assert from 'node:assert/strict';
import {StudioCamera,WHOLE_VIEW,canPaintAtCamera,prepareCameraForPainting} from '../src/camera.js';
import {StudioTour} from '../src/tour.js';
import {PaintingSession} from '../src/session.js';
import {PaintSurface} from '../src/engine.js';

test('painting waits through zoom-in and the complete return transition',()=>{
  const camera=new StudioCamera();
  assert(canPaintAtCamera(camera));
  camera.move({zoom:2,x:.3,y:.7});
  assert(!canPaintAtCamera(camera)); // Still at 1x, but about to zoom.
  camera.advance(.3);
  assert(!prepareCameraForPainting(camera));
  assert.deepEqual(camera.target,WHOLE_VIEW);
  camera.advance(.49);
  const elapsed=camera.elapsed;
  assert(!prepareCameraForPainting(camera));
  assert.equal(camera.elapsed,elapsed); // Do not restart the return each frame.
  camera.advance(.01);
  assert(prepareCameraForPainting(camera));
});

test('replay returns from an unpaired inspection and preserves every paint field',()=>{
  const stroke={medium:'oil',color:'#315b70',size:12,points:[[.2,.3,.7],[.7,.5,.8]],duration:350};
  const score=[stroke,{...stroke,color:'#bb7755'}];
  const plain=new PaintSurface(48,36),comparison=new PaintingSession(plain);
  comparison.play(score);while(comparison.busy)comparison.advance(.08);
  const surface=new PaintSurface(48,36),player=new PaintingSession(surface),camera=new StudioCamera();
  const tour=new StudioTour({cue:event=>camera.move(event.camera,.8)});
  player.play(score);
  tour.start([{afterStroke:1,camera:{zoom:2,x:.4,y:.4},duration:500}],2);
  let frames=0,returnFrames=0;
  while(player.busy||tour.running){
    let holding=tour.advance(.08,player.strokes.length);
    if(!holding&&player.busy){holding=!prepareCameraForPainting(camera);if(holding)returnFrames++;}
    if(!holding&&player.busy){assert(canPaintAtCamera(camera));player.advance(.08,tour.running);}
    camera.advance(.08);
    assert(frames++<1000);
  }
  assert(returnFrames>1);
  assert.deepEqual(surface.snapshot(),plain.snapshot());
  assert.deepEqual(player.strokes,score);
});

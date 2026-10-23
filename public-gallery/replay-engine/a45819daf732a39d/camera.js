export const WHOLE_VIEW=Object.freeze({zoom:1,x:.5,y:.5});

export function canPaintAtCamera(camera){
  return camera.value.zoom===1&&camera.target.zoom===1&&camera.elapsed>=camera.duration;
}

// Inspection can omit an explicit return cue. Step back and wait for the
// transition to finish before advancing any pigment simulation.
export function prepareCameraForPainting(camera){
  if(canPaintAtCamera(camera))return true;
  if(camera.target.zoom!==1)camera.move(WHOLE_VIEW,.5);
  return false;
}

export function validateCamera(value){
  const {zoom,x,y}=value??{};
  if(!Number.isFinite(zoom)||zoom<1||zoom>3||![x,y].every(v=>Number.isFinite(v)&&v>=0&&v<=1))throw new Error('Camera views need zoom 1–3 and normalized x/y coordinates');
  return {zoom,x,y};
}

// Match the studio's scroll-clamped viewport without resizing the live layout.
export function cameraTransform({zoom,x,y}){
  const offset=focus=>-100*Math.max(0,Math.min(zoom-1,focus*zoom-.5));
  return `translate(${offset(x)}%, ${offset(y)}%) scale(${zoom})`;
}

export class StudioCamera {
  constructor(){this.value={zoom:1,x:.5,y:.5};this.from={...this.value};this.target={...this.value};this.elapsed=1;this.duration=.8;}
  move(target,seconds=.8){this.from={...this.value};this.target={...target};this.duration=seconds;this.elapsed=0;}
  advance(seconds){
    if(this.elapsed>=this.duration)return false;
    this.elapsed=Math.min(this.duration,this.elapsed+seconds);
    const t=this.duration?this.elapsed/this.duration:1,ease=t*t*(3-2*t);
    for(const key of ['zoom','x','y'])this.value[key]=this.from[key]+(this.target[key]-this.from[key])*ease;
    return true;
  }
}

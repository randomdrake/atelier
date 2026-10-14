import {validateScore} from './engine.js';

export function validateEvents(events,strokeCount) {
  if(!Array.isArray(events)||events.length>1000)throw new Error('Provide at most 1000 studio moments');
  return events.map(event=>{
    if(!event||!Number.isInteger(event.afterStroke)||event.afterStroke<0||event.afterStroke>strokeCount)throw new Error('Studio moments must follow an existing stroke boundary');
    if(event.text!==undefined&&(typeof event.text!=='string'||event.text.length>1600))throw new Error('Studio notes must be text, up to 1600 characters');
    if(!event.text?.trim()&&!event.camera)throw new Error('A studio moment needs a note or a camera view');
    if(event.kind!==undefined&&!['notice','try','learn','keep','look'].includes(event.kind))throw new Error('Unknown studio note kind');
    if(event.title!==undefined&&(typeof event.title!=='string'||event.title.length>100))throw new Error('Keep studio titles under 100 characters');
    const duration=event.duration??(event.text?6500:1200);
    if(!Number.isFinite(duration)||duration<500||duration>30000)throw new Error('Studio moments last 500–30000 milliseconds');
    if(event.camera){
      const {zoom,x,y}=event.camera;
      if(!Number.isFinite(zoom)||zoom<1||zoom>3||![x,y].every(v=>Number.isFinite(v)&&v>=0&&v<=1))throw new Error('Camera views need zoom 1–3 and normalized x/y coordinates');
    }
    return {...structuredClone(event),duration};
  }).sort((a,b)=>a.afterStroke-b.afterStroke);
}
export function validateDocument(data) {
  if(Array.isArray(data))return {version:2,title:null,strokes:validateScore(data),events:[]};
  if(!data||![1,2].includes(data.version))throw new Error('Unsupported studio session');
  if(data.title!==undefined&&data.title!==null&&(typeof data.title!=='string'||data.title.length>200))throw new Error('Invalid painting title');
  const strokes=validateScore(data.strokes);
  return {version:2,title:data.title??null,strokes,events:validateEvents(data.events??[],strokes.length)};
}

// Review time holds the physical simulation. Narration never alters pigment or drying.
export class StudioTour {
  constructor({cue=()=>{},finished=()=>{}}={}){this.cue=cue;this.finished=finished;this.stop();}
  start(events,strokeCount){this.events=validateEvents(events,strokeCount);this.index=0;this.active=null;this.elapsed=0;this.running=!!this.events.length;}
  stop(){this.events=[];this.index=0;this.active=null;this.elapsed=0;this.running=false;}
  advance(seconds,completedStrokes){
    if(!this.running)return false;
    if(this.active){
      this.elapsed+=seconds*1000;
      if(this.elapsed<this.active.duration)return true;
      this.active=null;this.index++;
      if(this.index===this.events.length){this.running=false;this.finished();return false;}
    }
    const next=this.events[this.index];
    if(next.afterStroke>completedStrokes)return false;
    this.active=next;this.elapsed=0;this.cue(next,this.index,this.events.length);
    return true;
  }
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

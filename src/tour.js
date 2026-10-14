import {validateScore} from './engine.js';
import {replayMomentDuration} from './pacing.js';
import {validateCamera} from './camera.js';
export {replayMomentDuration} from './pacing.js';

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
      validateCamera(event.camera);
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
  get activeDuration(){return this.active?replayMomentDuration(this.active):0;}
  start(events,strokeCount){this.events=validateEvents(events,strokeCount);this.index=0;this.active=null;this.elapsed=0;this.running=!!this.events.length;}
  stop(){this.events=[];this.index=0;this.active=null;this.elapsed=0;this.running=false;}
  advance(seconds,completedStrokes){
    if(!this.running)return false;
    if(this.active){
      this.elapsed+=seconds*1000;
      if(this.elapsed<this.activeDuration)return true;
      this.active=null;this.index++;
      if(this.index===this.events.length){this.running=false;this.finished();return false;}
    }
    const next=this.events[this.index];
    if(next.afterStroke>completedStrokes)return false;
    this.active=next;this.elapsed=0;this.cue(next,this.index,this.events.length);
    return true;
  }
}
export {StudioCamera} from './camera.js';

import {StudioCamera,WHOLE_VIEW,validateCamera} from './camera.js';

const same=(a,b)=>a.zoom===b.zoom&&a.x===b.x&&a.y===b.y;

// Follow fresh inspection moments even when a whole/close pair lands between
// polls. A new viewer joins the current view rather than replaying old moves.
export class LiveCamera {
  constructor(){this.camera=new StudioCamera();this.history=null;this.queue=[];this.hold=0;}
  get value(){return this.camera.value;}
  get moving(){return this.camera.elapsed<this.camera.duration||this.queue.length>0||this.hold>0;}
  update(state,{ended=false,reducedMotion=false}={}){
    const events=(state?.document?.events??[]).filter(event=>event.camera);
    const keys=events.map(event=>JSON.stringify([event.afterStroke,event.camera]));
    const previous=this.history;
    const append=!!previous&&previous.sessionId===state?.sessionId&&previous.keys.length<=keys.length&&previous.keys.every((key,i)=>key===keys[i]);
    const target=validateCamera(ended||!state?.document?WHOLE_VIEW:state.camera??WHOLE_VIEW);
    this.history={sessionId:state?.sessionId,keys};
    if(!append||ended||reducedMotion){
      this.queue=[];this.hold=0;
      if(!append)this.camera=new StudioCamera();
      if(reducedMotion){
        this.camera.value={...target};this.camera.target={...target};this.camera.elapsed=this.camera.duration;
      }else if(!same(this.camera.target,target))this.camera.move(target);
      return;
    }
    for(const view of [...events.slice(previous.keys.length).map(event=>event.camera),target]){
      const clean=validateCamera(view),last=this.queue.at(-1)??this.camera.target;
      if(!same(last,clean))this.queue.push(clean);
    }
    // Catch up after suspension without replaying minutes of obsolete views.
    if(this.queue.length>6)this.queue=this.queue.slice(-6);
  }
  advance(seconds){
    if(this.hold>0){this.hold=Math.max(0,this.hold-seconds);return false;}
    if(this.camera.elapsed>=this.camera.duration&&this.queue.length)this.camera.move(this.queue.shift());
    const changed=this.camera.advance(seconds);
    if(changed&&this.camera.elapsed>=this.camera.duration&&this.queue.length)this.hold=.35;
    return changed;
  }
}

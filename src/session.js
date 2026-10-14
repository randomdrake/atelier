import {BrushReservoir,validateScore} from './engine.js';
import {StrokePlayback} from './playback.js';

// A fixed simulation timeline makes replay independent of display frame rate and playback speed.
export class PaintingSession {
  constructor(surface,{beforeStroke=()=>{},changed=()=>{}}={}) {
    this.surface=surface;this.beforeStroke=beforeStroke;this.changed=changed;
    this.strokes=[];this.queue=[];this.active=null;this.paused=false;
    this.accumulator=0;this.physicsTicks=0;this.listeners=[];
  }
  get busy(){return !!this.active||this.queue.length>0;}
  play(score) {
    if(this.busy)throw new Error('Finish or stop the current painting first');
    const validated=validateScore(score); // Reject the whole score before changing the canvas.
    this.queue.push(...validated);this.paused=false;
    this.changed();
    return new Promise(resolve=>{if(!this.busy)resolve({cancelled:false});else this.listeners.push(resolve);});
  }
  clear() {
    this.stop();this.surface.clear();this.strokes=[];this.accumulator=0;this.physicsTicks=0;this.changed();
  }
  replay() {
    const score=validateScore(this.strokes);
    if(this.busy)throw new Error('Stop playback before replaying');
    this.clear();return this.play(score);
  }
  stop() {
    if(this.active?.playback.drawn.length) {
      const {stroke,playback}=this.active;
      this.strokes.push({...stroke,wait:0,duration:playback.elapsed,points:structuredClone(playback.drawn)});
    }
    this.active=null;this.queue=[];this.paused=false;this.accumulator=0;
    this.listeners.splice(0).forEach(resolve=>resolve({cancelled:true}));this.changed();
  }
  advance(seconds) {
    if(this.paused)return false;
    this.accumulator+=seconds;
    let modified=false;
    const tick=1/30;
    while(this.accumulator+1e-10>=tick) {
      this.accumulator-=tick;
      if(!this.active&&this.queue.length) {
        const stroke=this.queue.shift();this.beforeStroke(stroke);
        this.active={stroke,playback:new StrokePlayback(stroke,this.surface.width,this.surface.height),brush:new BrushReservoir(stroke),wait:(stroke.wait??0)/1000};
        this.changed();
      }
      let completed=false;
      if(this.active) {
        const active=this.active;
        if(active.wait>1e-10)active.wait-=tick;
        else {
          active.playback.advance(tick*1000,(point,angle)=>this.surface.dab(...point,active.stroke,angle,active.brush));
          modified=true;
          if(active.playback.done){this.strokes.push(active.stroke);this.active=null;completed=true;this.changed();}
        }
      }
      this.physicsTicks++;
      if(this.physicsTicks===3){this.surface.step(.1);this.physicsTicks=0;modified=true;}
      if(completed&&!this.busy) {
        this.accumulator=0;
        this.listeners.splice(0).forEach(resolve=>resolve({cancelled:false}));
        break;
      }
    }
    return modified;
  }
}

import {renderThought} from '/thought-links.js';
import {livePresentation,thoughtChange} from '/live-status.js';
import {cameraTransform} from '/camera.js';
import {LiveCamera} from '/live-camera.js';

const panel=document.getElementById('live-easel');
const image=document.getElementById('live-image');
const viewLabel=document.getElementById('live-view');
const camera=new LiveCamera();
let cameraFrame=0,cameraTime=0;
function drawCamera(){
  image.style.transform=cameraTransform(camera.value);
  setText(viewLabel,camera.value.zoom>1.005?`Looking closer · ${camera.value.zoom.toFixed(1)}×`:'Whole painting');
}
function animateCamera(time){
  camera.advance(Math.min(.1,Math.max(0,(time-cameraTime)/1000)));cameraTime=time;
  drawCamera();
  cameraFrame=camera.moving?requestAnimationFrame(animateCamera):0;
}
function followCamera(state,presentation){
  camera.update(state,{ended:presentation.status==='ended',reducedMotion:reducedMotion.matches});
  drawCamera();
  if(camera.moving&&!cameraFrame){cameraTime=performance.now();cameraFrame=requestAnimationFrame(animateCamera);}
}
const badge=document.getElementById('live-badge-label');
const title=document.getElementById('live-title');
const activity=document.getElementById('live-activity');
const dots=document.getElementById('live-ellipsis');
const updated=document.getElementById('live-updated');
const thought=document.getElementById('live-thought');
const bubble=document.getElementById('live-thought-bubble');
const marks=document.getElementById('live-marks');
const notebook=document.getElementById('live-notes');
const download=document.getElementById('live-session-download');
const indicator=document.getElementById('live-nav');
const navLabel=document.getElementById('live-nav-label');
const viewers=document.getElementById('live-viewers');
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
let current=null,downloadURL=null,fetching=false,noteHistory=null,lastSnapshotKey='';
const setText=(element,text)=>{if(element.textContent!==text)element.textContent=text;};
function arrive(element){
  if(reducedMotion.matches)return;
  // Restart only for a new message, never for a heartbeat or a clock update.
  element.classList.remove('thought-arriving');
  void element.offsetWidth;
  element.classList.add('thought-arriving');
}

export function renderLive(state,now=Date.now()){
  const presentation=livePresentation(state,now);
  followCamera(state,presentation);
  current=state;
  panel.hidden=false;indicator.hidden=false;
  panel.dataset.status=presentation.status;indicator.dataset.status=presentation.status;
  setText(badge,presentation.badge);
  setText(navLabel,presentation.live?'AI painting live':'Studio offline');
  setText(activity,presentation.activity);dots.hidden=!presentation.live;
  if(!state?.document){
    setText(title,'The easel is quiet');
    panel.querySelector('.live-layout').hidden=true;panel.querySelector('details').hidden=true;download.hidden=true;
    noteHistory=null;lastSnapshotKey='';
    return;
  }
  panel.querySelector('.live-layout').hidden=false;panel.querySelector('details').hidden=false;download.hidden=false;
  setText(title,state.document.title||'A painting is taking shape');
  const elapsed=presentation.elapsed;
  const age=elapsed<5000?'just now':elapsed<60000?Math.floor(elapsed/1000)+' seconds ago':elapsed<3600000?Math.floor(elapsed/60000)+' minutes ago':Math.floor(elapsed/3600000)+' hours ago';
  setText(updated,'Last received '+age);
  if(image.src!==state.preview)image.src=state.preview;
  image.alt='Canvas painted by AI on hardware hosted by randomdrake';
  setText(marks,state.document.strokes.length+' completed marks');
  const notes=state.document.events.filter(event=>event.text);
  const change=thoughtChange(noteHistory,state.sessionId,notes);
  if(change.changed){
    renderThought(thought,notes.at(-1)?.text||'The brush is about to meet the canvas.');
    if(!change.append)notebook.replaceChildren();
    for(const event of change.added){
      const item=document.createElement('li'),boundary=document.createElement('span'),text=document.createElement('p');
      boundary.textContent=event.afterStroke?'After '+event.afterStroke+' marks':'Before the first mark';
      renderThought(text,event.text);item.append(boundary,text);notebook.append(item);
      if(change.animate)arrive(item);
    }
    if(change.animate)arrive(bubble);
    noteHistory=change;
  }
  const snapshotKey=state.sessionId+':'+state.sequence;
  if(snapshotKey!==lastSnapshotKey){
    lastSnapshotKey=snapshotKey;
    if(downloadURL)URL.revokeObjectURL(downloadURL);
    downloadURL=URL.createObjectURL(new Blob([JSON.stringify(state.document,null,2)],{type:'application/json'}));
    download.href=downloadURL;download.download='atelier-live-session.json';
  }
}
async function poll(){
  if(fetching||document.hidden)return;
  fetching=true;
  const abort=new AbortController(),timeout=setTimeout(()=>abort.abort(),8000);
  try{
    const response=await fetch('/api/live',{cache:'no-store',signal:abort.signal});
    if(!response.ok)throw new Error();
    renderLive(await response.json());
  }catch{
    renderLive(current?{...current,status:'disconnected'}:null);
    setText(updated,'Feed unavailable · last shared canvas shown');
  }finally{clearTimeout(timeout);fetching=false;}
}

// Random, page-lifetime IDs count concurrent visible tabs without identifying people.
const viewerId=crypto.randomUUID();
let presencePending=false;
async function presence(active=!document.hidden){
  if(active&&presencePending)return;
  if(active)presencePending=true;
  const abort=new AbortController(),timeout=setTimeout(()=>abort.abort(),8000);
  try{
    const response=await fetch('/api/live/viewers',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({viewerId,active}),cache:'no-store',keepalive:!active,signal:abort.signal});
    if(!response.ok)throw new Error();
    const state=await response.json();
    if(active)setText(viewers,state.viewers+' '+(state.viewers===1?'viewer':'viewers'));
  }catch{if(active)setText(viewers,'— viewers');}
  finally{clearTimeout(timeout);if(active)presencePending=false;}
}
setInterval(()=>{if(current&&!document.hidden)renderLive(current);poll();},2500);
setInterval(()=>{if(!document.hidden)presence();},15000);
document.addEventListener('visibilitychange',()=>{presence(!document.hidden);if(!document.hidden)poll();});
window.addEventListener('pagehide',()=>presence(false));
window.addEventListener('pageshow',()=>{if(!document.hidden){presence();poll();}});
poll();presence();

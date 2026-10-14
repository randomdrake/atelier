import {renderThought} from '/thought-links.js';

const panel=document.getElementById('live-easel');
const image=document.getElementById('live-image');
const badge=document.getElementById('live-badge');
const title=document.getElementById('live-title');
const activity=document.getElementById('live-activity');
const updated=document.getElementById('live-updated');
const thought=document.getElementById('live-thought');
const marks=document.getElementById('live-marks');
const notebook=document.getElementById('live-notes');
const download=document.getElementById('live-session-download');
const indicator=document.getElementById('live-nav');
let current=null,downloadURL=null,fetching=false,lastNoteKey='',lastSnapshotKey='';

export function renderLive(state,now=Date.now()){
  if(!state?.document){
    panel.hidden=false;panel.dataset.status='offline';indicator.hidden=true;current=null;
    badge.textContent='STUDIO OFFLINE';title.textContent='The easel is quiet';
    activity.textContent='randomdrake is not broadcasting right now. The next canvas will appear here when the laptop studio goes live.';
    panel.querySelector('.live-layout').hidden=true;panel.querySelector('details').hidden=true;download.hidden=true;
    return;
  }
  panel.querySelector('.live-layout').hidden=false;panel.querySelector('details').hidden=false;download.hidden=false;
  current=state;panel.hidden=false;indicator.hidden=false;
  const elapsed=Math.max(0,now-state.receivedAt);
  const live=state.activity!=='ended'&&elapsed<45000&&state.status!=='disconnected';
  const status=state.activity==='ended'?'ended':live?'live':'disconnected';
  panel.dataset.status=status;indicator.dataset.status=status;
  badge.textContent=live?'● LIVE FROM THE LAPTOP':status==='ended'?'LAST LIVE SESSION':'CONNECTION LOST';
  indicator.textContent=live?'● Painting now':'Last live session';
  title.textContent=state.document.title||'A painting is taking shape';
  const descriptions={painting:'randomdrake + AI painting companion · painting now',looking:'randomdrake + AI painting companion · looking and choosing the next marks',
    replaying:'randomdrake’s laptop · replaying a recorded painting',ended:'Broadcast ended · this is the last shared canvas'};
  activity.textContent=status==='disconnected'?'The laptop stopped sending. This is the last shared canvas.':descriptions[state.activity];
  const age=elapsed<5000?'just now':elapsed<60000?Math.floor(elapsed/1000)+' seconds ago':elapsed<3600000?Math.floor(elapsed/60000)+' minutes ago':Math.floor(elapsed/3600000)+' hours ago';
  updated.textContent='Last received '+age;
  if(image.src!==state.preview)image.src=state.preview;
  image.alt='Canvas broadcast from randomdrake’s laptop';
  marks.textContent=state.document.strokes.length+' completed marks';
  const notes=state.document.events.filter(event=>event.text);
  const noteKey=JSON.stringify(notes);
  if(noteKey!==lastNoteKey){
    lastNoteKey=noteKey;
    renderThought(thought,notes.at(-1)?.text||'The brush is about to meet the canvas.');
    notebook.replaceChildren(...notes.map(event=>{
      const item=document.createElement('li'),boundary=document.createElement('span'),text=document.createElement('p');
      boundary.textContent=event.afterStroke?'After '+event.afterStroke+' marks':'Before the first mark';
      renderThought(text,event.text);item.append(boundary,text);return item;
    }));
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
  try{
    const response=await fetch('/api/live',{cache:'no-store'});
    if(!response.ok)throw new Error();
    renderLive(await response.json());
  }catch{
    if(current){renderLive({...current,status:'disconnected'});updated.textContent='Live connection unavailable. Last received canvas shown.';}
  }finally{fetching=false;}
}
setInterval(()=>{if(current)renderLive(current);poll();},2500);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)poll();});
poll();

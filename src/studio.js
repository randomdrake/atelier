import {MEDIA,PaintSurface,BrushReservoir} from './engine.js';
import {compose} from './compositions.js';
import {PaintingSession} from './session.js';
import {StudioTour,StudioCamera,validateDocument,validateEvents} from './tour.js';
const $=id=>document.getElementById(id);
const canvas=$('canvas'),wrap=canvas.parentElement,ctx=canvas.getContext('2d',{alpha:false});
const surface=new PaintSurface(canvas.width,canvas.height),pixels=ctx.createImageData(canvas.width,canvas.height);
const brush={medium:'watercolor',color:'#315b70',size:28,flow:.75,tip:'round',water:.85,body:.75};
const symbols={watercolor:'≈',oil:'≋',acrylic:'▰',pastel:'▧',chalk:'░',pencil:'╱'};
const notes={watercolor:'Water carries suspended pigment across uneven paper. The wash absorbs, granulates, and settles into dry edges.',oil:'Opaque pigments mix under the brush. Wet paint moves with the gesture, building bristle ridges and soft highlights.',acrylic:'Dense color covers quickly, holds a little relief, and dries faster than oil.',pastel:'Soft dry pigment catches on the paper grain. Pressure fills more of the tooth.',chalk:'Powdery, broken marks leave the paper visible. Layer gently for a soft haze.',pencil:'A fine, directional mark. Pressure and stroke angle change the deposited tone.'};
const stageLabels={notice:'A CLOSER LOOK',try:'LET’S TRY A LITTLE SOMETHING',learn:'A SMALL STUDIO DISCOVERY',keep:'KNOWING WHAT TO KEEP',look:'STEPPING BACK · LEANING IN'};
const headings={notice:'What’s the paint telling us?',try:'A small experiment.',learn:'The paint has a lesson for us.',keep:'Let’s leave a little breathing room.',look:'Let’s change our point of view.'};
let history=[],events=[],pointer=null,manualReservoir=null,dirty=true,last=0,lastMetrics=0,pointerStarted=0;
let currentPlayback=null,programmaticCameraUntil=0,scrollTimer=null,speechActive=false,speechEpoch=0,speechDeadline=0,speechPauseStarted=0,manualCamera=false;
const camera=new StudioCamera();
const tour=new StudioTour({cue:event=>showMoment(event,true),finished:()=>{updateButtons();finishPlayback();}});
const player=new PaintingSession(surface,{
  beforeStroke(stroke){checkpoint();selectMedium(stroke.medium);selectColor(stroke.color);showBrush(stroke);status(`Making mark ${player.strokes.length+1} · ${MEDIA[stroke.medium].label.toLowerCase()}`);},
  changed(){updateButtons();if(player.pauseReason==='review')status(`A little looking time. ${player.strokes.length} marks on the paper.`);}
});
function busy(){return player.busy||tour.running||!!currentPlayback;}
function status(text){$('status').textContent=text;}
function checkpoint(){
  const state=surface.snapshot(),bytes=Object.values(state).reduce((sum,a)=>sum+a.byteLength,0);
  const limit=Math.max(1,Math.floor(128*1024*1024/bytes));
  history.push({state,count:player.strokes.length});while(history.length>limit)history.shift();
}
function selectMedium(name){
  brush.medium=name;
  for(const b of $('media').children)b.classList.toggle('active',b.dataset.medium===name);
  $('medium-symbol').textContent=symbols[name];$('medium-name').textContent=MEDIA[name].label;
  $('medium-description').textContent=notes[name];$('material-note').textContent=notes[name];
  $('water-control').hidden=name!=='watercolor';$('body-control').hidden=name!=='oil';
}
for(const [name,m] of Object.entries(MEDIA)){
  const b=document.createElement('button');b.dataset.medium=name;b.innerHTML=`<span>${symbols[name]}</span>${m.label}`;
  b.onclick=()=>{selectMedium(name);updateBrushDescription();};$('media').append(b);
}
const colors=['#315b70','#709c9b','#6f8153','#c7ad61','#c16c4f','#855567','#383e39','#eee2c4'];
function selectColor(c){brush.color=c;$('color').value=c;for(const b of $('palette').children)b.classList.toggle('selected',b.dataset.color===c);updateBrushDescription();}
for(const c of colors){
  const b=document.createElement('button');b.style.background=c;b.dataset.color=c;b.setAttribute('aria-label',`Pigment ${c}`);
  b.onclick=()=>selectColor(c);$('palette').append(b);
}
$('color').oninput=e=>selectColor(e.target.value);
for(const [id,key,scale] of [['size','size',1],['flow','flow',100],['water','water',100],['body','body',100]]){
  $(id).oninput=e=>{brush[key]=+e.target.value/scale;$(id+'-value').textContent=e.target.value+(scale===100?'%':'');updateBrushDescription();};
}
function updateBrushDescription(){
  $('paint-dot').style.background=brush.color;
  const load=brush.flow===0?'clean water':`${Math.round(brush.flow*100)}% paint`;
  $('tool-description').textContent=`${MEDIA[brush.medium].label} · ${brush.size} px · ${load}`;
}
function showBrush(stroke){
  brush.size=stroke.size;brush.flow=stroke.flow??1;brush.water=stroke.water??MEDIA[stroke.medium].water;
  brush.body=stroke.body??.75;brush.tip=stroke.tip??'round';
  for(const [id,key,scale] of [['size','size',1],['flow','flow',100],['water','water',100],['body','body',100]]){
    const value=Math.round(brush[key]*scale);$(id).value=value;$(id+'-value').textContent=value+(scale===100?'%':'');
  }
  $('tip').value=brush.tip;updateBrushDescription();
}
$('tip').onchange=e=>brush.tip=e.target.value;
function point(e){
  const r=canvas.getBoundingClientRect();
  return [Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),Math.max(0,Math.min(1,(e.clientY-r.top)/r.height)),e.pointerType==='pen'?Math.max(.05,e.pressure):.7];
}
function updateButtons(){
  const working=busy();
  for(const id of ['pause','stop','pause-top','stop-top'])$(id).disabled=!working;
  for(const id of ['demo','run-score','undo','load-lesson','post-note'])$(id).disabled=working||!!pointer;
  $('replay').disabled=working||!!pointer||!player.strokes.length;$('replay-top').disabled=$('replay').disabled;
  $('pause').textContent=player.paused?(player.pauseReason==='review'?'Continue painting':'Resume'):'Pause';
  $('pause-top').textContent=player.paused?'▶ Continue':'Ⅱ Pause';$('pause-top').setAttribute('aria-label',player.paused?'Continue studio session':'Pause studio session');document.querySelector('.studio-voice').classList.toggle('is-paused',player.paused);if(player.paused)document.querySelector('.studio-voice').classList.remove('new-note');
  $('stroke-count').textContent=`${player.strokes.length} marks`;
  $('live').textContent=player.paused?'● A LITTLE LOOKING TIME':tour.active?'● AT THE EASEL':working?'● MAKING A MARK':'● ROOM FOR POSSIBILITY';
}
function documentState(full=false){
  const strokes=full&&currentPlayback&&!currentPlayback.settled?currentPlayback.source:player.strokes;
  return {version:2,width:canvas.width,height:canvas.height,title:$('painting-title').textContent,strokes,events:events.filter(e=>e.afterStroke<=strokes.length)};
}
function saveSession(){
  try{localStorage.setItem('atelier-score-v2',JSON.stringify(documentState(true)));}catch{/* Downloads remain available when browser storage is full or blocked. */}
}
function renderNotebook(){
  $('note-count').textContent=`${events.length} moments`;$('notebook').replaceChildren();
  for(const event of events){
    const item=document.createElement('li'),label=document.createElement('span'),body=document.createElement('p');
    label.textContent=`After ${event.afterStroke} marks · ${event.kind??'look'}`;
    body.textContent=event.text||`${event.camera.zoom===1?'Whole painting':'Close inspection'} · ${event.camera.zoom.toFixed(1)}×`;
    item.append(label,body);$('notebook').append(item);
  }
}
function showMoment(event,recorded=false){
  const kind=event.kind??'look',voice=document.querySelector('.studio-voice');
  voice.dataset.kind=kind;voice.classList.toggle('is-looking',!!event.camera&&event.camera.zoom>1);
  voice.classList.toggle('is-trying',kind==='try');
  $('studio-stage').textContent=stageLabels[kind];
  if(event.text){
    $('studio-heading').textContent=event.title??headings[kind];$('studio-message').textContent=event.text;
    voice.classList.remove('new-note');void voice.offsetWidth;voice.classList.add('new-note');
    if($('read-aloud').checked&&'speechSynthesis' in window){
      try{
        const epoch=++speechEpoch;window.speechSynthesis.cancel();const speech=new SpeechSynthesisUtterance(event.text);
        speech.rate=.92;speech.lang='en-US';speechActive=true;speechDeadline=performance.now()+Math.max(10000,event.text.split(/\s+/).length*550+4000);
        speech.onend=speech.onerror=()=>{if(epoch===speechEpoch)speechActive=false;};window.speechSynthesis.speak(speech);
      }catch{speechActive=false;}
    }
  }
  $('moment-count').textContent=recorded?`RECORDED MOMENT ${tour.index+1} / ${tour.events.length}`:'LIVE STUDIO NOTE';
  if(event.camera){camera.move(event.camera,window.matchMedia('(prefers-reduced-motion: reduce)').matches?.01:.9);manualCamera=!recorded;}
  status(kind==='look'||kind==='notice'?'Let’s take a look together.':'A little thought at the easel.');updateButtons();
}
function recordMoment(event){
  const validated=validateEvents([{...event,afterStroke:player.strokes.length}],player.strokes.length)[0];
  events.push(validated);renderNotebook();showMoment(validated);saveSession();return validated;
}
function applyCamera(){
  const {zoom,x,y}=camera.value,w=wrap.getBoundingClientRect().width,h=w*canvas.height/canvas.width;
  programmaticCameraUntil=performance.now()+200;
  wrap.classList.toggle('close-view',zoom>1.005);wrap.style.height=`${h}px`;canvas.style.width=`${zoom*100}%`;
  wrap.scrollLeft=Math.max(0,x*w*zoom-w/2);wrap.scrollTop=Math.max(0,y*h*zoom-h/2);
  const close=zoom>1.005;
  $('whole-view').setAttribute('aria-pressed',String(!close));$('close-view').setAttribute('aria-pressed',String(close));
  const label=close?`Looking closer · ${zoom.toFixed(1)}×`:'Whole painting';
  $('camera-badge').textContent=label;$('view-description').textContent=label;
}
function setView(close){
  const target=close?{zoom:2,x:.5,y:.5}:{zoom:1,x:.5,y:.5};
  if(camera.elapsed>=camera.duration&&Math.abs(camera.value.zoom-target.zoom)<.005&&Math.abs(camera.value.x-target.x)<.002&&Math.abs(camera.value.y-target.y)<.002)return;
  camera.move(target,.8);manualCamera=true;
  if(!busy())recordMoment({kind:'look',camera:target,duration:1200});
}
$('whole-view').onclick=()=>setView(false);$('close-view').onclick=()=>setView(true);
wrap.addEventListener('scroll',()=>{
  if(performance.now()<programmaticCameraUntil)return;
  clearTimeout(scrollTimer);scrollTimer=setTimeout(()=>{
    if(performance.now()<programmaticCameraUntil)return;
    const zoom=camera.value.zoom,w=wrap.clientWidth,h=wrap.clientHeight;
    const target={zoom,x:Math.max(0,Math.min(1,(wrap.scrollLeft+w/2)/(w*zoom))),y:Math.max(0,Math.min(1,(wrap.scrollTop+h/2)/(h*zoom)))};
    camera.value={...target};camera.target={...target};camera.elapsed=camera.duration;manualCamera=false;
    if(!busy())recordMoment({kind:'look',camera:target,duration:1200});
  },250);
});
window.addEventListener('resize',applyCamera);
canvas.onpointerdown=e=>{
  if(busy())return;canvas.setPointerCapture(e.pointerId);checkpoint();const p=point(e);
  pointer={...brush,points:[p],duration:0};pointerStarted=performance.now();manualReservoir=new BrushReservoir(pointer);
  surface.dab(...p,pointer,0,manualReservoir);dirty=true;updateButtons();status('There’s our first little gesture…');
};
canvas.onpointermove=e=>{
  if(busy())return;const r=canvas.getBoundingClientRect(),cursor=$('brush-cursor');cursor.style.display='block';
  cursor.style.left=e.clientX-r.left+'px';cursor.style.top=e.clientY-r.top+'px';
  cursor.style.width=cursor.style.height=brush.size*r.width/canvas.width+'px';
  if(pointer){const p=point(e);surface.segment(pointer.points.at(-1),p,pointer,manualReservoir);pointer.points.push(p);dirty=true;}
};
function endPointer(){
  if(!pointer)return;pointer.duration=Math.min(60000,Math.max(100,performance.now()-pointerStarted));
  player.strokes.push(pointer);pointer=null;updateButtons();saveSession();status('A mark, a memory. What do you notice?');
}
canvas.onpointerup=endPointer;canvas.onpointercancel=endPointer;canvas.onlostpointercapture=endPointer;
canvas.onpointerleave=()=>{if(!player.active)$('brush-cursor').style.display='none';};
function finishPlayback(){
  const pending=currentPlayback;
  if(!pending||pending.settled||!pending.physicalDone||tour.running)return;
  pending.settled=true;currentPlayback=null;saveSession();updateButtons();
  status('That’s our little study. Replay it, or see where another mark takes you.');
  $('moment-count').textContent=events.length?'STUDIO SESSION RECORDED':'ROOM FOR A NEW THOUGHT';
  pending.resolve(pending.result);
}
function stop(){
  tour.stop();player.stop();speechEpoch++;if('speechSynthesis' in window)window.speechSynthesis.cancel();speechActive=false;
  if(currentPlayback&&!currentPlayback.settled){currentPlayback.settled=true;currentPlayback.resolve({cancelled:true});currentPlayback=null;}
  events=events.filter(e=>e.afterStroke<=player.strokes.length);renderNotebook();dirty=true;saveSession();updateButtons();status('Brush down. We can pick this up again.');
}
function reset(){
  stop();pointer=null;player.clear();events=[];history=[];dirty=true;camera.move({zoom:1,x:.5,y:.5},.6);
  $('painting-title').textContent='An open possibility';renderNotebook();saveSession();updateButtons();
  $('studio-heading').textContent='Fresh paper. No pressure.';$('studio-message').textContent='One small mark is enough to begin. We’ll look, listen to the paint, and decide on the next one together.';
  $('studio-stage').textContent='HELLO FROM THE EASEL';$('moment-count').textContent='';status('A little room to explore.');
}
function enqueue(input){
  if(busy()||pointer)throw new Error('Put the current brush down before starting another score');
  const doc=validateDocument(input),offset=player.strokes.length;
  const incoming=doc.events.map(e=>({...e,afterStroke:e.afterStroke+offset}));
  const allEvents=validateEvents([...events,...incoming],offset+doc.strokes.length);
  const done=player.play(doc.strokes);events=allEvents;if(doc.title)$('painting-title').textContent=doc.title;
  renderNotebook();if(incoming.length&&$('guided').checked)tour.start(incoming,offset+doc.strokes.length);
  const promise=new Promise(resolve=>{currentPlayback={resolve,physicalDone:false,settled:false,result:null,source:[...player.strokes,...doc.strokes]};});
  const pending=currentPlayback;
  done.then(result=>{
    if(pending.settled)return;
    pending.physicalDone=true;pending.result=result;
    if(result.cancelled){pending.settled=true;pending.resolve(result);if(currentPlayback===pending)currentPlayback=null;}
    else finishPlayback();
  });
  saveSession();updateButtons();return promise;
}
function replay(){
  if(busy()||pointer)throw new Error('Finish or stop the current painting first');
  const doc=validateDocument(documentState());history=[];player.clear();events=[];dirty=true;camera.move({zoom:1,x:.5,y:.5},.6);
  return enqueue(doc);
}
$('stop').onclick=stop;
$('review').onchange=e=>{player.reviewEvery=Number(e.target.value);};
function pausePlayback(paused){
  if(paused&&!player.paused)speechPauseStarted=performance.now();
  if(!paused&&player.paused&&speechPauseStarted){speechDeadline+=performance.now()-speechPauseStarted;speechPauseStarted=0;}
  player.paused=paused;
  if('speechSynthesis' in window){if(paused)window.speechSynthesis.pause();else window.speechSynthesis.resume();}
  updateButtons();
}
$('pause').onclick=()=>pausePlayback(!player.paused);
$('clear').onclick=reset;$('replay').onclick=()=>{try{replay();}catch(err){status(err.message);}};
$('undo').onclick=()=>{
  if(busy()||pointer)return;const prev=history.pop();if(!prev)return;
  surface.restore(prev.state);player.strokes.length=prev.count;events=events.filter(e=>e.afterStroke<=prev.count);
  dirty=true;updateButtons();renderNotebook();saveSession();status('Lifted that last gesture. There’s room to try again.');
};
$('demo').onclick=()=>{reset();const composition=compose($('prompt').value);$('painting-title').textContent=composition.title;enqueue(composition.strokes);};
$('run-score').onclick=()=>{try{enqueue(JSON.parse($('score').value));}catch(err){status(err.message);}};
$('post-note').onclick=()=>{
  try{
    const text=$('studio-note').value.trim();if(!text)throw new Error('Leave a little thought first');
    const focus=$('note-focus').value;
    const views={whole:{zoom:1,x:.5,y:.5},upper:{zoom:2,x:.5,y:.25},middle:{zoom:2,x:.5,y:.5},lower:{zoom:2,x:.5,y:.75},current:{...camera.value}};
    recordMoment({text,kind:$('note-kind').value,camera:views[focus],duration:Math.min(15000,Math.max(6000,text.split(/\s+/).length*260))});$('studio-note').value='';
  }catch(err){status(err.message);}
};
$('guided').onchange=()=>{
  if(!$('guided').checked){tour.stop();finishPlayback();updateButtons();}
};
$('voice-option').hidden=!('speechSynthesis' in window);
$('read-aloud').onchange=()=>{if(!$('read-aloud').checked&&'speechSynthesis' in window){window.speechSynthesis.cancel();speechActive=false;}};
$('load-lesson').onclick=async()=>{
  try{
    if(busy()||pointer)throw new Error('Put the current brush down first');
    const response=await fetch('/examples/afternoon-flowers-tour.json');if(!response.ok)throw new Error('The guided flower session could not be opened');
    const doc=validateDocument(await response.json());if(busy()||pointer)throw new Error('The current painting changed before the lesson opened');reset();$('guided').checked=true;$('review').value='0';player.reviewEvery=0;await enqueue(doc);
  }catch(err){status(err.message);}
};
function download(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
$('export').onclick=()=>canvas.toBlob(b=>download(b,'atelier-painting.png'));
$('save-score').onclick=()=>download(new Blob([JSON.stringify(documentState(true),null,2)],{type:'application/json'}),'atelier-session.json');
$('import').onchange=async e=>{
  try{
    const file=e.target.files[0];if(!file)return;const doc=validateDocument(JSON.parse(await file.text()));
    if(busy()||pointer)throw new Error('Stop playback before opening another session');reset();await enqueue(doc);
  }catch(err){status(err.message);}finally{e.target.value='';}
};
$('replay-top').onclick=()=>$('replay').click();$('pause-top').onclick=()=>$('pause').click();$('stop-top').onclick=stop;
$('speed-top').onchange=e=>{$('speed').value=e.target.value;};$('speed').onchange=e=>{$('speed-top').value=e.target.value;};
function frame(now){
  const dt=Math.min(.25,(now-last)/1000||.016);last=now;const seconds=dt*Number($('speed').value);
  let holding=false;
  if(!player.paused){
    if(speechActive&&now>speechDeadline){speechEpoch++;speechActive=false;if('speechSynthesis' in window)window.speechSynthesis.cancel();}
    const spokenHold=speechActive&&tour.active&&tour.elapsed+seconds*1000>=tour.active.duration;
    holding=tour.advance(spokenHold?0:seconds,player.strokes.length);
    if(!holding&&player.advance(seconds,tour.running))dirty=true;
  }
  if(!player.paused||manualCamera){if(camera.advance(seconds))applyCamera();if(camera.elapsed>=camera.duration)manualCamera=false;}
  if(dirty){surface.render(pixels.data);ctx.putImageData(pixels,0,0);dirty=false;}
  const mark=player.active?.playback.drawn.at(-1),cursor=$('brush-cursor');
  if(mark&&!holding){
    cursor.style.display='block';cursor.style.left=mark[0]*canvas.offsetWidth+'px';cursor.style.top=mark[1]*canvas.offsetHeight+'px';
    cursor.style.width=cursor.style.height=player.active.stroke.size*(mark[2]??.7)*canvas.offsetWidth/canvas.width+'px';
  }else if(busy())cursor.style.display='none';
  if(now-lastMetrics>700){
    lastMetrics=now;let water=0,relief=0;for(let i=0;i<surface.length;i+=37){water+=surface.water[i];relief=Math.max(relief,surface.heightMap[i]);}
    $('water-meter').textContent=water>20?'Wet wash':water>1?'Settling':'Dry paper';$('relief-meter').textContent=relief>.3?'Impasto':relief>.03?'Light texture':'Flat';
    $('playback-meter').textContent=player.paused?'Paused':tour.active?'Looking together':player.busy?'Painting':'At rest';
    $('queue-state').textContent=tour.active?'A LITTLE LOOKING TIME':busy()?`${player.queue.length} MARKS TO COME`:'ROOM FOR POSSIBILITY';updateButtons();
  }
  requestAnimationFrame(frame);
}
window.atelier={version:3,paint:enqueue,comment:recordMoment,replay,clear:reset,stop,pause:()=>pausePlayback(true),resume:()=>pausePlayback(false),getState:()=>({busy:busy(),paused:player.paused,queued:player.queue.length,strokes:player.strokes.length,moments:events.length,medium:brush.medium,width:canvas.width,height:canvas.height}),getSession:()=>structuredClone(player.strokes),getDocument:()=>structuredClone(documentState(true)),surface};
selectMedium('watercolor');selectColor(brush.color);
try{
  const saved=JSON.parse(localStorage.getItem('atelier-score-v2'));
  if(saved){const doc=validateDocument(saved);player.strokes=doc.strokes;events=doc.events;$('painting-title').textContent=doc.title||'Saved study';status('Your studio session is ready. Replay it, or open the guided flowers.');}
}catch{/* An unavailable or invalid stored score never blocks the studio. */}
renderNotebook();applyCamera();updateButtons();requestAnimationFrame(frame);

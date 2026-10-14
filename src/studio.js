import {MEDIA,PaintSurface,BrushReservoir,validateScore} from './engine.js';
import {compose} from './compositions.js';
import {PaintingSession} from './session.js';
const $=id=>document.getElementById(id);
const canvas=$('canvas'),ctx=canvas.getContext('2d',{alpha:false});
const surface=new PaintSurface(canvas.width,canvas.height),pixels=ctx.createImageData(canvas.width,canvas.height);
const brush={medium:'watercolor',color:'#315b70',size:28,flow:.75,tip:'round',water:.85,body:.75};
const symbols={watercolor:'≈',oil:'≋',acrylic:'▰',pastel:'▧',chalk:'░',pencil:'╱'};
const notes={watercolor:'Water carries suspended pigment across uneven paper. The wash absorbs, granulates, and settles into dry edges.',oil:'Opaque pigments mix under the brush. Wet paint moves with the gesture, building bristle ridges and soft highlights.',acrylic:'Dense color covers quickly, holds a little relief, and dries faster than oil.',pastel:'Soft dry pigment catches on the paper grain. Pressure fills more of the tooth.',chalk:'Powdery, broken marks leave the paper visible. Layer gently for a soft haze.',pencil:'A fine, directional mark. Pressure and stroke angle change the deposited tone.'};
let history=[],pointer=null,manualReservoir=null,dirty=true,last=0,lastMetrics=0,pointerStarted=0;
const player=new PaintingSession(surface,{
  beforeStroke(stroke){checkpoint();selectMedium(stroke.medium);selectColor(stroke.color);status(`Painting ${MEDIA[stroke.medium].label.toLowerCase()} · ${player.queue.length+1} strokes remaining`);},
  changed(){updateButtons();}
});
function status(text){$('status').textContent=text;}
function checkpoint(){
  const state=surface.snapshot();
  const bytes=Object.values(state).reduce((sum,a)=>sum+a.byteLength,0);
  // Bound undo memory as physical fields grow; at 900 × 620 this retains two full states.
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
  const b=document.createElement('button');b.dataset.medium=name;
  b.innerHTML=`<span>${symbols[name]}</span>${m.label}`;b.onclick=()=>selectMedium(name);$('media').append(b);
}
const colors=['#315b70','#709c9b','#6f8153','#c7ad61','#c16c4f','#855567','#383e39','#eee2c4'];
function selectColor(c){brush.color=c;$('color').value=c;for(const b of $('palette').children)b.classList.toggle('selected',b.dataset.color===c);}
for(const c of colors){
  const b=document.createElement('button');b.style.background=c;b.dataset.color=c;
  b.setAttribute('aria-label',`Pigment ${c}`);b.onclick=()=>selectColor(c);$('palette').append(b);
}
$('color').oninput=e=>selectColor(e.target.value);
for(const [id,key,scale] of [['size','size',1],['flow','flow',100],['water','water',100],['body','body',100]]){
  $(id).oninput=e=>{brush[key]=+e.target.value/scale;$(id+'-value').textContent=e.target.value+(scale===100?'%':'');};
}
$('tip').onchange=e=>brush.tip=e.target.value;
function point(e){
  const r=canvas.getBoundingClientRect();
  return [Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),Math.max(0,Math.min(1,(e.clientY-r.top)/r.height)),e.pointerType==='pen'?Math.max(.05,e.pressure):.7];
}
function updateButtons(){
  const busy=player.busy;
  for(const id of ['pause','stop'])$(id).disabled=!busy;
  for(const id of ['demo','run-score','undo'])$(id).disabled=busy||!!pointer;
  $('replay').disabled=busy||!!pointer||!player.strokes.length;
  $('pause').textContent=player.paused?'Resume':'Pause';
  $('stroke-count').textContent=`${player.strokes.length} strokes`;
  $('live').textContent=busy?'● PAINTING IN PROGRESS':'● STUDIO READY';
}
canvas.onpointerdown=e=>{
  if(player.busy)return;
  canvas.setPointerCapture(e.pointerId);checkpoint();const p=point(e);
  pointer={...brush,points:[p],duration:0};pointerStarted=performance.now();manualReservoir=new BrushReservoir(pointer);
  surface.dab(...p,pointer,0,manualReservoir);dirty=true;updateButtons();status('Making a mark…');
};
canvas.onpointermove=e=>{
  const r=canvas.getBoundingClientRect(),cursor=$('brush-cursor');cursor.style.display='block';
  cursor.style.left=e.clientX-r.left+'px';cursor.style.top=e.clientY-r.top+'px';
  cursor.style.width=cursor.style.height=brush.size*r.width/canvas.width+'px';
  if(pointer){const p=point(e);surface.segment(pointer.points.at(-1),p,pointer,manualReservoir);pointer.points.push(p);dirty=true;}
};
function saveSession(){
  try{localStorage.setItem('atelier-score-v2',JSON.stringify({version:1,title:$('painting-title').textContent,strokes:player.strokes}));}catch{/* Storage may be unavailable; downloads always remain available. */}
}
function endPointer(){
  if(!pointer)return;
  pointer.duration=Math.min(60000,Math.max(100,performance.now()-pointerStarted));
  player.strokes.push(pointer);pointer=null;updateButtons();saveSession();status('A mark, a memory.');
}
canvas.onpointerup=endPointer;canvas.onpointercancel=endPointer;canvas.onlostpointercapture=endPointer;
canvas.onpointerleave=()=>{$('brush-cursor').style.display='none';};
function stop(){player.stop();dirty=true;saveSession();status('Playback stopped. Replay starts the recorded painting again.');}
function reset(){
  pointer=null;player.clear();history=[];dirty=true;$('painting-title').textContent='An open possibility';
  saveSession();updateButtons();status('Fresh paper. Start anywhere.');
}
function enqueue(score){
  if(pointer)throw new Error('Finish the current brush stroke first');
  const done=player.play(score);
  return done.then(result=>{if(!result.cancelled){status('Study complete. Replay it, or add your own marks.');saveSession();}return result;});
}
function replay(){
  if(player.busy||pointer)throw new Error('Finish or stop the current painting first');
  const score=validateScore(player.strokes);history=[];player.clear();dirty=true;
  return enqueue(score);
}
$('stop').onclick=stop;
$('pause').onclick=()=>{player.paused=!player.paused;updateButtons();};
$('clear').onclick=reset;$('replay').onclick=()=>replay();
$('undo').onclick=()=>{
  if(player.busy||pointer)return;
  const prev=history.pop();if(!prev)return;
  surface.restore(prev.state);player.strokes.length=prev.count;dirty=true;updateButtons();saveSession();status('Last stroke lifted.');
};
$('demo').onclick=()=>{
  reset();const composition=compose($('prompt').value);$('painting-title').textContent=composition.title;enqueue(composition.strokes);
};
$('run-score').onclick=()=>{try{enqueue(JSON.parse($('score').value));}catch(e){status(e.message);}};
function download(blob,name){
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
$('export').onclick=()=>canvas.toBlob(b=>download(b,'atelier-painting.png'));
$('save-score').onclick=()=>download(new Blob([JSON.stringify({version:1,width:canvas.width,height:canvas.height,title:$('painting-title').textContent,strokes:player.strokes},null,2)],{type:'application/json'}),'atelier-session.json');
$('import').onchange=async e=>{
  try{
    const file=e.target.files[0];if(!file)return;
    const data=JSON.parse(await file.text());
    if(data.version!==1)throw new Error('Unsupported session');
    const score=validateScore(data.strokes);
    if(player.busy||pointer)throw new Error('Stop playback before importing');
    reset();$('painting-title').textContent=data.title||'Imported study';await enqueue(score);
  }catch(err){status(err.message);}finally{e.target.value='';}
};
function frame(now){
  const dt=Math.min(.25,(now-last)/1000||.016);last=now;
  if(player.advance(dt*Number($('speed').value)))dirty=true;
  if(dirty){surface.render(pixels.data);ctx.putImageData(pixels,0,0);dirty=false;}
  if(now-lastMetrics>1000){
    lastMetrics=now;let water=0,relief=0;
    for(let i=0;i<surface.length;i+=37){water+=surface.water[i];relief=Math.max(relief,surface.heightMap[i]);}
    $('water-meter').textContent=water>20?'Wet wash':water>1?'Settling':'Dry paper';
    $('relief-meter').textContent=relief>.3?'Impasto':relief>.03?'Light texture':'Flat';
    $('playback-meter').textContent=player.paused?'Paused':player.busy?'Painting':'At rest';
    $('queue-state').textContent=player.busy?`${player.queue.length} STROKES IN QUEUE`:'LIVE STROKE ENGINE';
  }
  requestAnimationFrame(frame);
}
window.atelier={version:2,paint:enqueue,replay,clear:reset,stop,pause:()=>{player.paused=true;updateButtons();},resume:()=>{player.paused=false;updateButtons();},getState:()=>({busy:player.busy,paused:player.paused,queued:player.queue.length,strokes:player.strokes.length,medium:brush.medium,width:canvas.width,height:canvas.height}),getSession:()=>structuredClone(player.strokes),surface};
selectMedium('watercolor');selectColor(brush.color);
try{
  const saved=JSON.parse(localStorage.getItem('atelier-score-v2'));
  if(saved?.version===1){player.strokes=validateScore(saved.strokes);$('painting-title').textContent=saved.title||'Saved study';status('Saved painting score ready. Press Replay painting to watch.');}
}catch{/* Ignore malformed or unavailable browser storage. */}
updateButtons();requestAnimationFrame(frame);

import {MEDIA,PaintSurface,BrushReservoir,validateStroke} from './engine.js';
import {compose} from './compositions.js';
import {StrokePlayback} from './playback.js';
const $=id=>document.getElementById(id), canvas=$('canvas'),ctx=canvas.getContext('2d',{alpha:false});
const surface=new PaintSurface(canvas.width,canvas.height), pixels=ctx.createImageData(canvas.width,canvas.height);
const brush={medium:'watercolor',color:'#315b70',size:28,flow:.75,tip:'round'};
const symbols={watercolor:'≈',oil:'≋',acrylic:'▰',pastel:'▧',chalk:'░',pencil:'╱'};
const notes={watercolor:'Transparent pigment travels through wet paper, softens at the edges, and settles as water evaporates.',oil:'Slow-drying paint builds relief. Bristles leave ridges; wet pigment mingles beneath the brush.',acrylic:'Dense color covers quickly, holds a little relief, and dries faster than oil.',pastel:'Soft dry pigment catches on the paper grain. Pressure fills more of the tooth.',chalk:'Powdery, broken marks leave the paper visible. Layer gently for a soft haze.',pencil:'A fine, directional mark. Pressure and stroke angle change the deposited tone.'};
let history=[], session=[], queue=[], active=null, paused=false, pointer=null, reservoir=null, dirty=true, last=0, physics=0, lastMetrics=0;
let completion=[],manualReservoir=null;
function status(text){$('status').textContent=text;}
function checkpoint(){history.push({state:surface.snapshot(),count:session.length});if(history.length>12)history.shift();}
function selectMedium(name){brush.medium=name;for(const b of $('media').children)b.classList.toggle('active',b.dataset.medium===name);$('medium-symbol').textContent=symbols[name];$('medium-name').textContent=MEDIA[name].label;$('medium-description').textContent=notes[name];$('material-note').textContent=notes[name];}
for(const [name,m] of Object.entries(MEDIA)){const b=document.createElement('button');b.dataset.medium=name;b.innerHTML=`<span>${symbols[name]}</span>${m.label}`;b.onclick=()=>selectMedium(name);$('media').append(b);}
const colors=['#315b70','#709c9b','#6f8153','#c7ad61','#c16c4f','#855567','#383e39','#eee2c4'];
function selectColor(c){brush.color=c;$('color').value=c;for(const b of $('palette').children)b.classList.toggle('selected',b.dataset.color===c);}
for(const c of colors){const b=document.createElement('button');b.style.background=c;b.dataset.color=c;b.setAttribute('aria-label',`Pigment ${c}`);b.onclick=()=>selectColor(c);$('palette').append(b);}
$('color').oninput=e=>selectColor(e.target.value);
$('size').oninput=e=>{brush.size=+e.target.value;$('size-value').textContent=brush.size;};
$('flow').oninput=e=>{brush.flow=+e.target.value/100;$('flow-value').textContent=e.target.value+'%';};
$('tip').onchange=e=>brush.tip=e.target.value;
function point(e){const r=canvas.getBoundingClientRect();return [Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),Math.max(0,Math.min(1,(e.clientY-r.top)/r.height)),e.pointerType==='pen'?Math.max(.05,e.pressure):.7];}
function busy(){return !!active||queue.length>0;}
function updateButtons(){const b=busy();$('pause').disabled=!b;$('stop').disabled=!b;$('demo').disabled=b;$('run-score').disabled=b;$('undo').disabled=b;$('pause').textContent=paused?'Resume':'Pause';$('stroke-count').textContent=`${session.length} strokes`;$('live').textContent=b?'● PAINTING IN PROGRESS':'● STUDIO READY';}
canvas.onpointerdown=e=>{if(busy())return;canvas.setPointerCapture(e.pointerId);checkpoint();const p=point(e);pointer={...brush,points:[p],duration:0};manualReservoir=new BrushReservoir(pointer);surface.dab(...p,pointer,0,manualReservoir);dirty=true;status('Making a mark…');};
canvas.onpointermove=e=>{const r=canvas.getBoundingClientRect(),cursor=$('brush-cursor');cursor.style.display='block';cursor.style.left=e.clientX-r.left+'px';cursor.style.top=e.clientY-r.top+'px';cursor.style.width=cursor.style.height=brush.size*r.width/canvas.width+'px';if(pointer){const p=point(e);surface.segment(pointer.points.at(-1),p,pointer,manualReservoir);pointer.points.push(p);dirty=true;}};
function endPointer(){if(pointer){session.push(pointer);pointer=null;updateButtons();status('A mark, a memory.');}}
canvas.onpointerup=endPointer;canvas.onpointercancel=endPointer;canvas.onlostpointercapture=endPointer;canvas.onpointerleave=()=>{$('brush-cursor').style.display='none';};
function stop(){queue=[];if(active){session.push({...active.stroke,points:active.drawn});active=null;}paused=false;completion.splice(0).forEach(resolve=>resolve({cancelled:true}));updateButtons();status('Playback stopped.');}
function reset(){stop();pointer=null;surface.clear();session=[];history=[];dirty=true;$('painting-title').textContent='An open possibility';updateButtons();status('Fresh paper. Start anywhere.');}
function enqueue(strokes){if(busy()||pointer)throw new Error('Finish or stop the current painting first');if(!Array.isArray(strokes)||strokes.length>2000)throw new Error('Provide an array of at most 2000 strokes');const validated=strokes.map(s=>{validateStroke(s);if(s.flow!==undefined&&(!Number.isFinite(s.flow)||s.flow<0||s.flow>1))throw new Error('Flow must be 0–1');if(s.tip!==undefined&&!['round','flat'].includes(s.tip))throw new Error('Tip must be round or flat');return structuredClone(s);});queue.push(...validated);paused=false;updateButtons();return new Promise(resolve=>{if(!queue.length)resolve({cancelled:false});else completion.push(resolve);});}
$('stop').onclick=stop;$('pause').onclick=()=>{paused=!paused;updateButtons();};
$('clear').onclick=reset;
$('undo').onclick=()=>{if(busy()||pointer)return;const prev=history.pop();if(prev){surface.restore(prev.state);session.length=prev.count;dirty=true;updateButtons();status('Last stroke lifted.');}};
$('demo').onclick=()=>{reset();const composition=compose($('prompt').value);$('painting-title').textContent=composition.title;enqueue(composition.strokes);};
$('run-score').onclick=()=>{try{enqueue(JSON.parse($('score').value));}catch(e){status(e.message);}};
function download(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
$('export').onclick=()=>canvas.toBlob(b=>download(b,'atelier-painting.png'));
$('save-score').onclick=()=>download(new Blob([JSON.stringify({version:1,width:canvas.width,height:canvas.height,title:$('painting-title').textContent,strokes:session},null,2)],{type:'application/json'}),'atelier-session.json');
$('import').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;const data=JSON.parse(await file.text());if(data.version!==1||!Array.isArray(data.strokes))throw new Error('Unsupported session');data.strokes.forEach(validateStroke);if(busy())throw new Error('Stop playback before importing');reset();$('painting-title').textContent=data.title||'Imported study';await enqueue(data.strokes);}catch(err){status(err.message);}finally{e.target.value='';}};
function frame(now){const dt=Math.min(.05,(now-last)/1000||.016);last=now;
  if(!paused&&queue.length&&!active){const stroke=queue.shift();checkpoint();active=new StrokePlayback(stroke,canvas.width,canvas.height);reservoir=new BrushReservoir(stroke);dirty=true;selectMedium(stroke.medium);selectColor(stroke.color);status(`Painting ${MEDIA[stroke.medium].label.toLowerCase()} · ${queue.length+1} strokes remaining`);}
  if(active&&!paused){const a=active,s=a.stroke;a.advance(dt*1000,(point,angle)=>surface.dab(...point,s,angle,reservoir));
    dirty=true;
    if(a.done){session.push(s);active=null;updateButtons();if(!queue.length){status('Study complete. Add your own marks.');completion.splice(0).forEach(resolve=>resolve({cancelled:false}));}}
  }
  // The whole simulation pauses with playback, preserving a paused study exactly.
  physics+=dt;if(!paused&&physics>.09){surface.step(physics);physics=0;dirty=true;}else if(paused)physics=0;
  if(dirty){surface.render(pixels.data);ctx.putImageData(pixels,0,0);dirty=false;}
  if(now-lastMetrics>1000){lastMetrics=now;let water=0,relief=0;for(let i=0;i<surface.length;i+=37){water+=surface.water[i];relief=Math.max(relief,surface.heightMap[i]);}$('water-meter').textContent=water>20?'Wet wash':water>1?'Settling':'Dry paper';$('relief-meter').textContent=relief>.3?'Impasto':relief>.03?'Light texture':'Flat';$('playback-meter').textContent=paused?'Paused':busy()?'Painting':'At rest';$('queue-state').textContent=busy()?`${queue.length} STROKES IN QUEUE`:'LIVE STROKE ENGINE';}
  requestAnimationFrame(frame);
}
// Browser agents can also fill the visible score editor and press Play stroke score.
window.atelier={version:1,paint:enqueue,clear:reset,stop,pause:()=>{paused=true;updateButtons();},resume:()=>{paused=false;updateButtons();},getState:()=>({busy:busy(),paused,queued:queue.length,strokes:session.length,medium:brush.medium,width:canvas.width,height:canvas.height}),getSession:()=>structuredClone(session),surface};
selectMedium('watercolor');selectColor(brush.color);requestAnimationFrame(frame);

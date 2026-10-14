const $=id=>document.getElementById(id),dialog=$('viewer'),wrap=$('surface'),canvas=$('replay-canvas'),ctx=canvas.getContext('2d',{alpha:false});
let catalog=[],selected=null,player=null,tour=null,camera=null,surface=null,pixels=null,paused=false,running=false,last=0,epoch=0;
const headings={notice:'A closer look',try:'Let’s try a little something',learn:'A studio discovery',keep:'Knowing what to keep'};
function stop(){epoch++;running=false;paused=false;player?.stop();tour?.stop();$('contact').hidden=true;}
function finishedView(){stop();$('finished').hidden=false;canvas.hidden=true;wrap.style.height='';wrap.scrollLeft=wrap.scrollTop=0;$('pause').hidden=true;$('show-finished').hidden=true;$('caption').hidden=true;$('play').textContent='Watch it painted';$('play').disabled=false;$('progress').textContent='Finished view';}
function openWork(entry,watch=false){
  stop();selected=entry;$('work-title').textContent=entry.title;$('work-meta').textContent=`${entry.media.join(' / ')} · ${entry.strokes} marks${entry.moments?` · ${entry.moments} studio moments`:''}`;
  $('finished').src=entry.image;$('finished').alt=entry.title;$('work-description').textContent=entry.description;$('work-process').textContent=entry.process;
  $('session-link').href=entry.session;$('session-link').download=`${entry.id}.json`;$('public-notes').replaceChildren();$('notebook').hidden=true;$('viewer-error').textContent='';
  finishedView();if(!dialog.open)dialog.showModal();dialog.scrollTop=0;history.replaceState(null,'',`#painting/${entry.id}`);if(watch)replay();
}
async function replay(){
  if(!selected)return;stop();const token=epoch,entry=selected;$('play').disabled=true;$('progress').textContent='Opening the recorded session…';
  try{
    const response=await fetch(entry.session);if(!response.ok)throw new Error('The recorded session could not be opened.');const input=await response.json();
    if(!/^[a-f0-9]{16}$/.test(entry.engine))throw new Error('This painting has no valid replay engine.');
    const base=`/replay-engine/${entry.engine}`;
    const [{PaintSurface,MEDIA},{PaintingSession},{StudioTour,StudioCamera,validateDocument}]=await Promise.all([import(`${base}/engine.js`),import(`${base}/session.js`),import(`${base}/tour.js`)]);
    if(token!==epoch)return;const doc=validateDocument(input);
    surface=new PaintSurface(900,620);pixels=ctx.createImageData(900,620);camera=new StudioCamera();
    player=new PaintingSession(surface,{beforeStroke:s=>{$('progress').textContent=`Mark ${player.strokes.length+1} of ${doc.strokes.length} · ${MEDIA[s.medium].label}`;}});
    tour=new StudioTour({cue:e=>{if(e.text){$('caption').hidden=false;$('caption-kind').textContent=e.kind||'Observation';$('caption-title').textContent=e.title||headings[e.kind]||'A thought at the easel';$('caption-text').textContent=e.text;}if(e.camera)camera.move(e.camera,.5);}});
    $('public-notes').replaceChildren();for(const e of doc.events.filter(e=>e.text)){const li=document.createElement('li');li.textContent=`After ${e.afterStroke} marks — ${e.text}`;$('public-notes').append(li);}$('notebook').hidden=!$('public-notes').children.length;
    $('finished').hidden=true;canvas.hidden=false;canvas.style.width='100%';wrap.style.height=`${wrap.clientWidth*620/900}px`;
    $('progress').textContent=`0 of ${doc.strokes.length} marks`;player.play(doc.strokes);tour.start(doc.events,doc.strokes.length);running=true;paused=false;last=performance.now();$('pause').hidden=false;$('pause').textContent='Pause';$('show-finished').hidden=false;$('play').textContent='Replay from the beginning';$('play').disabled=false;surface.render(pixels.data);ctx.putImageData(pixels,0,0);requestAnimationFrame(now=>frame(now,token));
  }catch(error){if(token===epoch){$('viewer-error').textContent=error.message;$('play').disabled=false;$('progress').textContent='';}}
}
function frame(now,token){
  if(!running||token!==epoch)return;const dt=Math.min(.25,(now-last)/1000);last=now;
  if(!paused){const seconds=dt*Number($('speed').value),holding=tour.advance(seconds,player.strokes.length);if(!holding&&player.busy){player.advance(seconds,tour.running);surface.render(pixels.data);ctx.putImageData(pixels,0,0);}
    if(camera.advance(seconds)){const {zoom,x,y}=camera.value,w=wrap.clientWidth,h=w*620/900;wrap.style.height=`${h}px`;canvas.style.width=`${zoom*100}%`;wrap.scrollLeft=Math.max(0,x*w*zoom-w/2);wrap.scrollTop=Math.max(0,y*h*zoom-h/2);}
    const active=player.active,mark=active?.playback.drawn.at(-1);$('contact').hidden=!mark||holding;if(mark){const c=$('contact');c.style.left=`${mark[0]*canvas.offsetWidth}px`;c.style.top=`${mark[1]*canvas.offsetHeight}px`;c.style.width=c.style.height=`${active.stroke.size*(mark[2]??.7)*canvas.offsetWidth/900}px`;}
    if(!player.busy&&!tour.running){running=false;$('pause').hidden=true;$('contact').hidden=true;$('progress').textContent=`${player.strokes.length} marks · replay complete`;$('play').textContent='Watch again';return;}
  }requestAnimationFrame(now=>frame(now,token));
}
$('play').onclick=replay;$('pause').onclick=()=>{paused=!paused;$('pause').textContent=paused?'Continue':'Pause';};$('show-finished').onclick=finishedView;
$('close-viewer').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{stop();history.replaceState(null,'','#collection');});dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
window.addEventListener('resize',()=>{if(running)wrap.style.height=`${wrap.clientWidth*620/900}px`;});
try{
  const response=await fetch('/catalog.json');if(!response.ok)throw new Error();catalog=await response.json();$('paintings').replaceChildren();
  for(const entry of catalog){const article=document.createElement('article');article.className='painting';const picture=document.createElement('button');picture.className='picture';picture.setAttribute('aria-label',`View ${entry.title}`);const img=document.createElement('img');img.src=entry.image;img.alt=entry.title;img.loading='lazy';picture.append(img);picture.onclick=()=>openWork(entry);
    const info=document.createElement('div');info.className='work-info';const meta=document.createElement('p');meta.className='eyebrow';meta.textContent=`${entry.media.join(' / ')} · ${entry.strokes} marks`;const title=document.createElement('h3');title.textContent=entry.title;const description=document.createElement('p');description.textContent=entry.description;const actions=document.createElement('div');actions.className='work-actions';for(const [label,watch] of [['View painting',false],['Watch it painted',true]]){const button=document.createElement('button');button.textContent=label;button.setAttribute('aria-label',`${label}: ${entry.title}`);button.onclick=()=>openWork(entry,watch);actions.append(button);}info.append(meta,title,description,actions);article.append(picture,info);$('paintings').append(article);}
  const entry=catalog.find(e=>`#painting/${e.id}`===location.hash);if(entry)openWork(entry);
}catch{$('paintings').replaceChildren();$('collection-error').textContent='The paintings could not be opened. Please try refreshing the collection.';}
try{const response=await fetch('/practice/studies.json');if(response.ok){const studies=await response.json();for(const study of studies){const article=document.createElement('article');article.className='practice-entry';const h=document.createElement('h3');h.textContent=study.title;const observation=document.createElement('p');observation.textContent=study.observations.at(-1).text;const next=document.createElement('p');const label=document.createElement('strong');label.textContent='Next experiment: ';next.append(label,document.createTextNode(study.nextExperiment));article.append(h,observation,next);$('practice-studies').append(article);}}}catch{/* The painting collection remains available if the journal cannot be loaded. */}

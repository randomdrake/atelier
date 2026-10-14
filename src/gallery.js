export class PaintingGallery {
  constructor({library,onReplay,onOpen}){
    this.library=library;this.onReplay=onReplay;this.onOpen=onOpen;this.catalog=[];this.selection=null;this.loading=false;
    this.dialog=document.getElementById('gallery');this.grid=document.getElementById('gallery-grid');
    document.getElementById('browse-paintings').onclick=()=>this.open();
    document.getElementById('gallery-close').onclick=()=>this.dialog.close();
    document.getElementById('gallery-back').onclick=()=>this.showGrid();
    document.getElementById('gallery-replay').onclick=()=>this.replay(this.selection);
    this.dialog.addEventListener('click',e=>{if(e.target===this.dialog)this.dialog.close();});
    this.ready=this.loadCatalog();
  }
  async loadCatalog(){
    try{const response=await fetch('/examples/gallery.json');if(!response.ok)throw new Error();this.catalog=await response.json();}
    catch{document.getElementById('gallery-status').textContent='The studio collection could not be loaded. Your saved paintings are still available.';}
    this.render();
  }
  open(){this.onOpen();this.render();this.showGrid();this.dialog.showModal();}
  showGrid(){document.getElementById('gallery-detail').hidden=true;this.grid.hidden=false;document.getElementById('gallery-back').hidden=true;}
  render(){
    this.grid.replaceChildren();
    for(const entry of this.library.list(this.catalog)){
      const card=document.createElement('article');card.className='painting-card';
      const select=document.createElement('button');select.className='painting-preview';select.setAttribute('aria-label',`View ${entry.title}`);
      const img=document.createElement('img');img.src=entry.preview;img.alt=entry.title;img.loading='lazy';select.append(img);select.onclick=()=>this.view(entry);
      const title=document.createElement('h3');title.textContent=entry.title;
      const meta=document.createElement('p');meta.className='painting-meta';meta.textContent=`${entry.strokes} marks · ${entry.moments?`${entry.moments} studio moments`:'brush strokes only'}`;
      const actions=document.createElement('div');actions.className='painting-actions';
      const view=document.createElement('button');view.textContent='View finished';view.setAttribute('aria-label',`View finished ${entry.title}`);view.onclick=()=>this.view(entry);
      const replay=document.createElement('button');replay.textContent='↻ Replay';replay.setAttribute('aria-label',`Replay ${entry.title}`);replay.onclick=()=>this.replay(entry);
      actions.append(view,replay);card.append(select,title,meta,actions);this.grid.append(card);
    }
    document.getElementById('gallery-empty').hidden=!!this.grid.children.length;
    if(this.library.error)document.getElementById('gallery-status').textContent=this.library.error;
  }
  view(entry){
    this.selection=entry;this.grid.hidden=true;document.getElementById('gallery-detail').hidden=false;document.getElementById('gallery-back').hidden=false;
    document.getElementById('gallery-image').src=entry.preview;document.getElementById('gallery-image').alt=entry.title;
    document.getElementById('gallery-painting-title').textContent=entry.title;document.getElementById('gallery-description').textContent=entry.description;
    document.getElementById('gallery-back').focus();
  }
  async replay(entry){
    if(!entry||this.loading)return;this.loading=true;
    const message=document.getElementById('gallery-status');message.textContent=`Opening ${entry.title}…`;
    try{
      let input=entry.document;
      if(!input){const response=await fetch(entry.source);if(!response.ok)throw new Error('This painting could not be opened.');input=await response.json();}
      await this.onReplay(input,entry.id);this.dialog.close();message.textContent='';
    }catch(error){message.textContent=error.message||'This painting could not be opened.';}
    finally{this.loading=false;}
  }
}

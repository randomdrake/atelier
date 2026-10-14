import {validateDocument} from './tour.js';

export const LIBRARY_KEY='atelier-paintings-v1';
export class PaintingLibrary {
  constructor(storage){
    this.storage=storage;this.entries=[];this.error=null;
    try{
      const saved=JSON.parse(storage?.getItem(LIBRARY_KEY)??'[]');
      if(Array.isArray(saved))for(const entry of saved){
        try{if(typeof entry.id!=='string'||typeof entry.preview!=='string')continue;
          const document=validateDocument(entry.document);if(document.strokes.length)this.entries.push({...entry,document});
        }catch{/* One broken entry must not hide the rest of the gallery. */}
      }
    }catch{this.error='Saved paintings are unavailable in this browser.';}
  }
  save(id,input,preview){
    const document=validateDocument(input);if(!document.strokes.length)return null;
    const previous=this.entries.find(e=>e.id===id);
    const entry={id,title:document.title||'Untitled study',document,preview:preview||previous?.preview||'',strokes:document.strokes.length,moments:document.events.length,savedAt:Date.now(),description:'Saved in your studio. Strokes, notes, and camera views travel together.'};
    this.entries=[entry,...this.entries.filter(e=>e.id!==id)];
    try{this.storage?.setItem(LIBRARY_KEY,JSON.stringify(this.entries));this.error=null;}
    catch{this.error='Browser storage is full or unavailable. Download this session to keep it after closing the browser.';}
    return entry;
  }
  list(catalog=[]){
    const ids=new Set(this.entries.map(e=>e.id));
    return [...this.entries,...catalog.filter(e=>!ids.has(e.id))];
  }
}

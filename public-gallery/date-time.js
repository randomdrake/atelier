const zone='America/Los_Angeles';
const small=['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
const tens=['','','twenty','thirty','forty','fifty'];
const words=n=>n<20?small[n]:tens[Math.floor(n/10)]+(n%10?'-'+small[n%10]:'');
export function ordinalSuffix(day){
  if(day%100>=11&&day%100<=13)return 'th';
  return ({1:'st',2:'nd',3:'rd'})[day%10]||'th';
}
export function spelledTime(hour,minute){
  if(minute===0&&hour===0)return 'midnight';
  if(minute===0&&hour===12)return 'noon';
  const clock=words(hour%12||12)+(minute===0?' o’clock':minute<10?' oh '+words(minute):' '+words(minute));
  return clock+(hour<12?' in the morning':hour<18?' in the afternoon':' in the evening');
}
export function galleryTimestamp(value){
  if(typeof value!=='string')return null;
  const dateOnly=/^\d{4}-\d{2}-\d{2}$/.test(value);
  if(!dateOnly&&!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value))return null;
  const date=new Date(dateOnly?value+'T12:00:00Z':value);
  if(!Number.isFinite(date.getTime())||(dateOnly&&date.toISOString().slice(0,10)!==value))return null;
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:dateOnly?'UTC':zone,month:'long',day:'numeric',year:'numeric',hour:'numeric',minute:'numeric',hourCycle:'h23'}).formatToParts(date).map(p=>[p.type,p.value]));
  const day=Number(parts.day),suffix=ordinalSuffix(day);
  return {datetime:value,month:parts.month,day,suffix,year:parts.year,dateText:`${parts.month} ${day}${suffix}, ${parts.year}`,time:dateOnly?null:spelledTime(Number(parts.hour),Number(parts.minute))};
}
export function renderGalleryTimestamp(element,entry){
  const stamp=galleryTimestamp(entry.addedAt||entry.publishedAt);
  element.replaceChildren();element.hidden=!stamp;
  if(!stamp)return;
  const label=document.createElement('span'),time=document.createElement('time'),ordinal=document.createElement('sup');
  label.className='date-label';label.textContent='Added to the gallery';
  time.dateTime=stamp.datetime;ordinal.textContent=stamp.suffix;
  time.append(`${stamp.month} ${stamp.day}`,ordinal,`, ${stamp.year}`);
  if(stamp.time){const clock=document.createElement('span');clock.className='date-clock';clock.textContent=`at ${stamp.time} · Pacific time`;time.append(' ',clock);}
  element.append(label,time);
  element.title=entry.addedAtSource==='first-gallery-commit'?'Historical archive time; the painting time was not recorded.':'';
}

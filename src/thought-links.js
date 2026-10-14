// Keep recorded thoughts as plain text; only HTTP(S) URLs become links.
export function thoughtParts(text){
  const parts=[];let cursor=0;
  for(const match of text.matchAll(/https?:\/\/[^\s<>"']+/gi)){
    let url=match[0];
    while(/[.,!?;:]$/.test(url))url=url.slice(0,-1);
    for(const [open,close] of [['(',')'],['[',']'],['{','}']]){
      while(url.endsWith(close)&&url.split(close).length>url.split(open).length)url=url.slice(0,-1);
    }
    try{if(!new URL(url).hostname)continue;}catch{continue;}
    if(match.index>cursor)parts.push({text:text.slice(cursor,match.index)});
    parts.push({text:url,href:url});cursor=match.index+url.length;
  }
  if(cursor<text.length)parts.push({text:text.slice(cursor)});
  return parts;
}

export function renderThought(element,text){
  const doc=element.ownerDocument;
  element.replaceChildren(...thoughtParts(text).map(part=>{
    if(!part.href)return doc.createTextNode(part.text);
    const link=doc.createElement('a');link.textContent=part.text;link.href=part.href;
    link.className='thought-link';link.target='_blank';link.rel='noopener noreferrer';
    return link;
  }));
}

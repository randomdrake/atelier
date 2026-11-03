// One featured painting followed by four rows of two.
export const PAINTINGS_PER_PAGE=9;

export function collectionPage(catalog,requestedPage=1){
  const total=catalog.length,pageCount=Math.max(1,Math.ceil(total/PAINTINGS_PER_PAGE));
  const requested=Number(requestedPage);
  const page=Number.isSafeInteger(requested)&&requested>0?Math.min(requested,pageCount):1;
  const offset=(page-1)*PAINTINGS_PER_PAGE;
  return {page,pageCount,total,start:total?offset+1:0,end:Math.min(offset+PAINTINGS_PER_PAGE,total),entries:catalog.slice(offset,offset+PAINTINGS_PER_PAGE)};
}

export function collectionPageURL(href,page){
  const url=new URL(href);
  if(page===1)url.searchParams.delete('page');
  else url.searchParams.set('page',String(page));
  url.hash='collection';
  return url.pathname+url.search+url.hash;
}

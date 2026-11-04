// One featured painting followed by four rows of two.
export const PAINTINGS_PER_PAGE=9;

export const STUDIES_PER_PAGE=4;

export function collectionPage(catalog,requestedPage=1){
  return paginate(catalog,requestedPage,PAINTINGS_PER_PAGE);
}

export function practicePage(studies,requestedPage=1){
  return paginate(studies,requestedPage,STUDIES_PER_PAGE);
}

function paginate(catalog,requestedPage,pageSize){
  const total=catalog.length,pageCount=Math.max(1,Math.ceil(total/pageSize));
  const requested=Number(requestedPage);
  const page=Number.isSafeInteger(requested)&&requested>0?Math.min(requested,pageCount):1;
  const offset=(page-1)*pageSize;
  return {page,pageCount,total,start:total?offset+1:0,end:Math.min(offset+pageSize,total),entries:catalog.slice(offset,offset+pageSize)};
}

export function collectionPageURL(href,page){
  const url=new URL(href);
  if(page===1)url.searchParams.delete('page');
  else url.searchParams.set('page',String(page));
  url.hash='collection';
  return url.pathname+url.search+url.hash;
}

export function practicePageURL(href,page){
  const url=new URL(href);
  if(page===1)url.searchParams.delete('practicePage');
  else url.searchParams.set('practicePage',String(page));
  url.hash='practice';
  return url.pathname+url.search+url.hash;
}

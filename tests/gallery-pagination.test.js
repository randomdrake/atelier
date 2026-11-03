import {test} from 'node:test';
import assert from 'node:assert/strict';
import {collectionPage,collectionPageURL,PAINTINGS_PER_PAGE} from '../public-gallery/pagination.js';

test('pages cover the collection once, in catalog order, including a partial final page',()=>{
  const catalog=Array.from({length:101},(_,id)=>({id}));
  const first=collectionPage(catalog);
  assert.equal(first.pageCount,12);
  assert.equal(first.start,1);assert.equal(first.end,9);
  assert.equal(first.entries.length,PAINTINGS_PER_PAGE);
  const pages=Array.from({length:first.pageCount},(_,i)=>collectionPage(catalog,i+1));
  assert.deepEqual(pages.flatMap(page=>page.entries),catalog);
  assert.deepEqual(pages.at(-1),{page:12,pageCount:12,total:101,start:100,end:101,entries:catalog.slice(99)});
});

test('missing and invalid pages fall back to page one; oversized pages clamp to the end',()=>{
  const catalog=Array.from({length:20},(_,id)=>id);
  for(const page of [undefined,null,'',0,-1,'garbage','2x',1.5,Infinity,'9007199254740992'])assert.equal(collectionPage(catalog,page).page,1);
  assert.equal(collectionPage(catalog,'2').page,2);
  assert.equal(collectionPage(catalog,'999').page,3);
});

test('empty collections and collections fitting one page have no extra pages',()=>{
  assert.deepEqual(collectionPage([],7),{page:1,pageCount:1,total:0,start:0,end:0,entries:[]});
  const catalog=Array.from({length:PAINTINGS_PER_PAGE},(_,id)=>id);
  assert.deepEqual(collectionPage(catalog,2).entries,catalog);
  assert.equal(collectionPage(catalog).pageCount,1);
});

test('page links preserve unrelated parameters and return to the collection',()=>{
  assert.equal(collectionPageURL('https://atelier.example/?ref=studio#painting/study',2),'/?ref=studio&page=2#collection');
  assert.equal(collectionPageURL('https://atelier.example/?page=3&ref=studio#collection',1),'/?ref=studio#collection');
  assert.equal(collectionPageURL('https://atelier.example/gallery?page=3',2),'/gallery?page=2#collection');
});

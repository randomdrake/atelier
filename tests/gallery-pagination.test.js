import {test} from 'node:test';
import assert from 'node:assert/strict';
import {collectionPage,collectionPageURL,PAINTINGS_PER_PAGE,practicePage,practicePageURL,STUDIES_PER_PAGE} from '../public-gallery/pagination.js';

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


test('practice pages show four studies, preserve order, and clamp invalid requests',()=>{
  const studies=Array.from({length:11},(_,id)=>({id}));
  const pages=[1,2,3].map(page=>practicePage(studies,page));
  assert.equal(pages[0].entries.length,STUDIES_PER_PAGE);
  assert.equal(STUDIES_PER_PAGE,4);
  assert.deepEqual(pages.flatMap(page=>page.entries),studies);
  assert.deepEqual(pages[2],{page:3,pageCount:3,total:11,start:9,end:11,entries:studies.slice(8)});
  assert.equal(practicePage(studies,'invalid').page,1);
  assert.equal(practicePage(studies,999).page,3);
  assert.equal(practicePage([]).pageCount,1);
  assert.equal(practicePage(studies.slice(0,4)).pageCount,1);
});

test('practice and painting page links preserve each other’s page selections',()=>{
  assert.equal(practicePageURL('https://atelier.example/?page=3&ref=studio#collection',2),'/?page=3&ref=studio&practicePage=2#practice');
  assert.equal(practicePageURL('https://atelier.example/?page=3&practicePage=2',1),'/?page=3#practice');
  assert.equal(collectionPageURL('https://atelier.example/?practicePage=2&page=3',1),'/?practicePage=2#collection');
});

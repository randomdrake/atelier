import {test} from 'node:test';
import assert from 'node:assert/strict';
import {galleryTimestamp,ordinalSuffix,spelledTime} from '../public-gallery/date-time.js';

test('ordinal dates handle the teens and later st/nd/rd endings',()=>{
  for(const [day,suffix] of [[1,'st'],[2,'nd'],[3,'rd'],[4,'th'],[11,'th'],[12,'th'],[13,'th'],[21,'st'],[22,'nd'],[23,'rd'],[31,'st']])assert.equal(ordinalSuffix(day),suffix);
});
test('archive timestamps use Pacific local date and daylight-saving time',()=>{
  const evening=galleryTimestamp('2026-10-14T02:05:00Z');
  assert.equal(evening.dateText,'October 13th, 2026');
  assert.equal(evening.time,'seven oh five in the evening');
  assert.equal(galleryTimestamp('2026-01-14T23:34:00Z').time,'three thirty-four in the afternoon');
  assert.equal(galleryTimestamp('2026-07-14T23:34:00Z').time,'four thirty-four in the afternoon');
});
test('spelled times distinguish noon, midnight, and hour boundaries',()=>{
  assert.equal(spelledTime(0,0),'midnight');assert.equal(spelledTime(12,0),'noon');
  assert.equal(spelledTime(8,0),'eight o’clock in the morning');
  assert.equal(spelledTime(12,1),'twelve oh one in the afternoon');
  assert.equal(spelledTime(23,59),'eleven fifty-nine in the evening');
});
test('legacy dates retain their day without inventing a time; bad values stay hidden',()=>{
  const stamp=galleryTimestamp('2026-10-14');assert.equal(stamp.dateText,'October 14th, 2026');assert.equal(stamp.time,null);
  for(const value of [undefined,'','no date','2026-02-30','2026-10-14T15:34:00'])assert.equal(galleryTimestamp(value),null);
});

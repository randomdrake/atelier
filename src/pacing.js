// Give each note a readable turn at the easel. Recorded creation timings are
// preserved; viewing time is based on the words, including any visible title.
export function replayMomentDuration(event){
  const text=event.text?.trim();
  if(!text)return Math.min(event.duration??1200,650);
  const words=[event.title,text].filter(Boolean).join(' ').trim().split(/\s+/).length;
  const readingTime=Math.max(4000,2000+words*300);
  // The introduction stays beside the first strokes; avoid a long blank easel.
  return event.afterStroke===0?4000:readingTime;
}

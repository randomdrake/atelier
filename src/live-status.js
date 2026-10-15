// Shared presentation rules keep an old canvas from looking like an active stream.
export function livePresentation(state,now=Date.now()){
  const elapsed=Math.max(0,now-(state?.receivedAt||0));
  const live=!!state?.document&&state.activity!=='ended'&&elapsed<45000&&state.status!=='disconnected';
  const status=!state?.document?'offline':state.activity==='ended'?'ended':live?'live':'disconnected';
  const descriptions={painting:'The AI is painting',looking:'The AI is looking and choosing the next marks',replaying:'The AI is replaying a painting'};
  return {live,status,elapsed,badge:live?'LIVE AI PAINTING':'STUDIO OFFLINE',
    activity:live?descriptions[state.activity]||'The AI is at the easel':status==='ended'?(state.origin==='Finished export recovery'?'The AI is offline · finished canvas restored':'The AI is offline · broadcast ended'):
      status==='disconnected'?'The AI is offline · showing the last shared canvas':'The AI is offline · the easel is quiet'};
}

// Heartbeats and repeated polls must not restart conversation animations.
export function thoughtChange(previous,sessionId,notes){
  const sameSession=previous?.sessionId===sessionId;
  const keys=notes.map(note=>JSON.stringify([note.afterStroke,note.text]));
  const append=sameSession&&previous.keys.length<=keys.length&&previous.keys.every((key,i)=>key===keys[i]);
  return {sessionId,keys,changed:!sameSession||JSON.stringify(previous.keys)!==JSON.stringify(keys),
    append,added:append?notes.slice(previous.keys.length):notes,
    animate:!!previous&&(append?keys.length>previous.keys.length:!!notes.length)};
}

// Anchor freshness to the gallery's clock, then advance it monotonically between
// polls. A visitor's clock can be minutes (or years) ahead of the publisher.
export class LiveFeedClock {
  constructor({wall=()=>Date.now(),tick=()=>performance.now()}={}){
    this.wall=wall;this.tick=tick;this.anchor=null;
  }
  accept(state){
    const local=this.wall();
    // Older deployments omit serverNow but still explicitly report freshness.
    const server=Number.isFinite(state?.serverNow)?state.serverNow:
      state?.live===true&&Number.isFinite(state.receivedAt)?state.receivedAt:local;
    this.anchor={server,tick:this.tick()};
  }
  now(){return this.anchor?this.anchor.server+Math.max(0,this.tick()-this.anchor.tick):this.wall();}
}

const pacificParts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',
  weekday:'short',year:'numeric',month:'2-digit',day:'2-digit',hour:'numeric',hourCycle:'h23'});
const parts=date=>Object.fromEntries(pacificParts.formatToParts(date).map(part=>[part.type,part.value]));
const dayKey=date=>{const p=parts(date);return p.year+'-'+p.month+'-'+p.day;};

// Inspect actual instants in Pacific time, rather than assuming a fixed UTC
// offset. This carries the weekday schedule across daylight-saving changes.
export function returnSchedule(now=Date.now(),state=null){
  const hour=3600000;
  const slot=Math.floor(now/hour)*hour;
  const current=parts(slot);
  const scheduled=!['Sat','Sun'].includes(current.weekday)&&Number(current.hour)>=8&&Number(current.hour)<=15;
  // Startup checks take a few minutes. Do not announce the next hour while
  // this slot is still waiting to begin, or call an already-finished slot late.
  const alreadyStarted=Number.isFinite(state?.startedAt)&&state.startedAt>=slot&&state.startedAt<=now;
  if(scheduled&&now-slot<15*60000&&!alreadyStarted){
    return {at:new Date(slot).toISOString(),time:'prévu à '+Number(current.hour)+' h',
      date:'merci de patienter',greeting:'Un petit retard…',message:'L’artiste arrive bientôt'};
  }
  for(let at=(Math.floor(now/hour)+1)*hour;at<=now+8*24*hour;at+=hour){
    const p=parts(at);
    if(['Sat','Sun'].includes(p.weekday)||Number(p.hour)<8||Number(p.hour)>15)continue;
    const date=dayKey(at)===dayKey(now)?'aujourd’hui':
      new Intl.DateTimeFormat('fr-FR',{timeZone:'America/Los_Angeles',weekday:'long',day:'numeric',month:'long'}).format(at);
    return {at:new Date(at).toISOString(),time:'à '+Number(p.hour)+' h',date,
      greeting:'À bientôt',message:'L’artiste sera de retour'};
  }
  throw new Error('No painting time in the next week');
}

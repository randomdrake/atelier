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

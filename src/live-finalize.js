import {validateDocument} from './tour.js';
import {validateLiveSnapshot} from './live-service.js';

// Restore a finished export only onto its own inactive broadcast.
export async function finalizeLivePainting({document,preview,endpoint,token,fetcher=fetch}){
  const final=validateDocument(document);
  const snapshot=validateLiveSnapshot({activity:'ended',document:{...final,width:900,height:620},preview});
  const read=await fetcher(endpoint,{cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!read.ok)throw new Error('Cannot read the current live easel');
  const old=await read.json();
  if(!old.document||old.live)throw new Error('Only an existing inactive broadcast can be restored');
  const previous=validateLiveSnapshot({...old,activity:'ended'}).document.strokes;
  if(!previous.length||JSON.stringify(previous)!==JSON.stringify(snapshot.document.strokes.slice(0,previous.length)))throw new Error('The finished painting does not match the last broadcast');
  const response=await fetcher(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
    body:JSON.stringify({...snapshot,sessionId:old.sessionId,sequence:old.sequence+1,expectedSequence:old.sequence,finalizedFromExport:true}),signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error('Final snapshot was not accepted ('+response.status+')');
  const acknowledgement=await response.json();
  const verification=await fetcher(endpoint,{cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!verification.ok)throw new Error('Cannot verify the restored canvas');
  const stored=await verification.json();
  if(stored.sessionId!==old.sessionId||stored.sequence!==acknowledgement.sequence||stored.activity!=='ended'||stored.document.strokes.length!==final.strokes.length||stored.preview!==preview)throw new Error('The final live canvas could not be verified');
  return {title:final.title,marks:final.strokes.length,status:stored.status,receivedAt:stored.receivedAt};
}

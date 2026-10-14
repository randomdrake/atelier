import {randomUUID,randomBytes} from 'node:crypto';
import {validateLiveSnapshot,readLiveBody,liveJSON,LIVE_TIMEOUT} from './live-service.js';

export class LocalBroadcastRelay {
  constructor({endpoint,token,fetcher=fetch,test=false}={}){
    this.endpoint=endpoint;this.token=token;this.fetcher=fetcher;this.test=test;
    this.localToken=randomBytes(24).toString('hex');this.active=false;
    this.sessionId=null;this.ownerId=null;this.sequence=0;this.lastAcceptedAt=0;this.lastSnapshot=null;this.pendingStart=false;this.queue=Promise.resolve();
  }
  get configured(){return !!this.endpoint&&!!this.token;}
  async handle(request){
    if(new URL(request.url).pathname!=='/api/broadcast')return null;
    if(request.method==='GET')return liveJSON({configured:this.configured,active:this.active&&Date.now()-this.lastAcceptedAt<LIVE_TIMEOUT,ownerId:this.ownerId,localToken:this.localToken});
    if(request.method!=='POST')return liveJSON({error:'Method not allowed'},405);
    if(request.headers.get('X-Atelier-Local')!==this.localToken)return liveJSON({error:'Open this control from the local Atelier studio'},403);
    if(!this.configured)return liveJSON({error:'Live broadcasting is not configured on this laptop'},503);
    let input;
    try{input=await readLiveBody(request);}catch(error){return liveJSON({error:error.message},400);}
    const operation=this.queue.then(()=>this.publish(input));
    this.queue=operation.catch(()=>{});
    try{return liveJSON(await operation);}catch(error){return liveJSON({error:error.message},502);}
  }
  async publish({action,payload,clientId}){
    if(typeof clientId!=='string'||!/^[a-f0-9-]{36}$/.test(clientId))throw new Error('Invalid studio client');
    if(!['start','update','stop'].includes(action))throw new Error('Invalid broadcast action');
    if(action!=='start'&&!this.active)throw new Error('Start a live session first');
    if(action==='start'&&this.active&&Date.now()-this.lastAcceptedAt<LIVE_TIMEOUT)throw new Error('This studio already has a live session');
    if(action!=='start'&&clientId!==this.ownerId)throw new Error('This broadcast belongs to another studio tab');
    const snapshot=action==='stop'?this.lastSnapshot:validateLiveSnapshot(payload);
    if(action==='start'&&(!this.pendingStart||this.ownerId!==clientId)){this.sessionId=randomUUID();this.ownerId=clientId;this.sequence=0;this.pendingStart=true;}
    const sequence=++this.sequence;
    const endpoint=new URL(this.endpoint);if(this.test)endpoint.searchParams.set('test','1');
    const body=JSON.stringify({...snapshot,activity:action==='stop'?'ended':snapshot.activity,sessionId:this.sessionId,sequence});
    // Serialize updates and retry a transient storage conflict with the same
    // sequence, so acknowledgements lost in transit cannot duplicate a mark.
    let response;
    for(let attempt=0;attempt<2;attempt++){
      response=await this.fetcher(endpoint,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+this.token},
        body,signal:AbortSignal.timeout(10000)});
      if(response.status!==409)break;
    }
    if(!response.ok)throw new Error('The public gallery could not accept this update ('+response.status+')');
    const result=await response.json();
    this.active=action!=='stop';this.pendingStart=false;this.lastAcceptedAt=Date.now();this.lastSnapshot=snapshot;return result;
  }
}

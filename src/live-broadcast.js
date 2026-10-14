export class LiveBroadcast {
  constructor({snapshot,onStatus=()=>{},fetcher=(...args)=>fetch(...args),interval=1000,storage,now=()=>Date.now()}={}){
    this.snapshot=snapshot;this.onStatus=onStatus;this.fetcher=fetcher;this.now=now;
    this.active=false;this.sending=false;this.signature='';this.sentAt=0;this.localToken='';
    this.inFlight=Promise.resolve();this.lastPayload=null;this.pendingEnd=null;this.retryAt=0;this.failures=0;
    try{this.clientId=sessionStorage.getItem('atelier-broadcast-client')||crypto.randomUUID();sessionStorage.setItem('atelier-broadcast-client',this.clientId);}
    catch{this.clientId=crypto.randomUUID();}
    try{
      this.storage=storage===undefined?globalThis.localStorage:storage;
      const pending=JSON.parse(this.storage?.getItem('atelier-broadcast-end-v1')||'null');
      if(pending?.clientId&&pending.payload){this.pendingEnd=pending;this.clientId=pending.clientId;}
    }catch{/* An unavailable browser store never blocks painting or in-memory retry. */}
    this.timer=setInterval(()=>this.tick(),interval);
  }
  async configuration(){
    const response=await this.fetch('/api/broadcast');
    if(!response.ok)throw new Error('The local studio is unavailable');
    const state=await response.json();this.localToken=state.localToken;return state;
  }
  async configure(){
    try{
      const state=await this.configuration();
      this.active=!this.pendingEnd&&state.active&&state.ownerId===this.clientId;
      this.onStatus(this.pendingEnd?'ended-offline':!state.configured?'unconfigured':state.active&&!this.active?'occupied':this.active?'reconnecting':'ready');
      return state.configured;
    }catch{this.onStatus(this.pendingEnd?'ended-offline':this.active?'reconnecting':'unconfigured');return false;}
  }
  async fetch(url,options){
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),25000);
    try{return await this.fetcher(url,{...options,signal:controller.signal});}
    finally{clearTimeout(timeout);}
  }
  async request(action,payload){
    const send=()=>this.fetch('/api/broadcast',{method:'POST',
      headers:{'Content-Type':'application/json','X-Atelier-Local':this.localToken},
      body:JSON.stringify({action,payload,clientId:this.clientId})});
    let response=await send();
    // Server restart rotates the local token. Refresh it without dropping intent.
    if(response.status===403){await this.configuration();response=await send();}
    const result=await response.json();
    if(!response.ok)throw new Error(result.error||'Broadcast could not reach the gallery');
    return result;
  }
  perform(work){
    if(this.sending)return this.inFlight;
    this.sending=true;
    this.inFlight=Promise.resolve().then(work).finally(()=>{this.sending=false;});
    return this.inFlight;
  }
  async start(){
    if(this.pendingEnd){await this.flushEnd(true);if(this.pendingEnd)return;}
    if(this.sending)return this.inFlight;
    return this.perform(async()=>{
      this.onStatus('connecting');
      try{
        const payload=this.snapshot();this.lastPayload=payload;await this.request('start',payload);
        this.active=true;this.signature=payload.signature;this.sentAt=this.now();this.onStatus('live');
      }catch(error){this.onStatus('error',error.message);}
    });
  }
  async tick(){
    if(this.pendingEnd)return this.flushEnd();
    if(!this.active||this.sending)return;
    let payload;
    try{payload=this.snapshot();this.lastPayload=payload;}catch(error){this.onStatus('reconnecting',error.message);return;}
    if(payload.signature===this.signature&&this.now()-this.sentAt<10000)return;
    return this.perform(async()=>{
      this.onStatus('updating');
      try{
        await this.request('update',payload);this.signature=payload.signature;this.sentAt=this.now();
        this.onStatus(this.active?'live':'ending');
      }catch(error){if(this.active)this.onStatus('reconnecting',error.message);}
    });
  }
  rememberEnd(){
    try{
      if(this.pendingEnd)this.storage?.setItem('atelier-broadcast-end-v1',JSON.stringify(this.pendingEnd));
      else this.storage?.removeItem('atelier-broadcast-end-v1');
    }catch{/* Keep retrying in memory if browser storage is unavailable or full. */}
  }
  async end(){
    if(!this.active&&!this.pendingEnd)return;
    this.active=false;
    let payload;
    try{payload=this.snapshot();}catch{payload=this.pendingEnd?.payload||this.lastPayload;}
    this.pendingEnd={clientId:this.clientId,payload};this.rememberEnd();
    this.onStatus('ending');
    // A final send must follow any in-flight update, never be silently ignored.
    await this.inFlight;
    return this.flushEnd(true);
  }
  async flushEnd(force=false){
    if(!this.pendingEnd||this.sending||!force&&this.now()<this.retryAt)return;
    const pending=this.pendingEnd;
    return this.perform(async()=>{
      try{
        await this.request('stop',pending.payload);
        if(this.pendingEnd===pending){this.pendingEnd=null;this.rememberEnd();this.failures=0;this.onStatus('ready');}
      }catch{
        this.retryAt=this.now()+Math.min(30000,1000*2**Math.min(this.failures++,5));
        this.onStatus('ended-offline');
      }
    });
  }
  dispose(){clearInterval(this.timer);}
}

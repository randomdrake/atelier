export class LiveBroadcast {
  constructor({snapshot,onStatus=()=>{},fetcher=(...args)=>fetch(...args),interval=1000}){
    this.snapshot=snapshot;this.onStatus=onStatus;this.fetcher=fetcher;
    this.active=false;this.sending=false;this.signature='';this.sentAt=0;this.localToken='';
    try{this.clientId=sessionStorage.getItem('atelier-broadcast-client')||crypto.randomUUID();sessionStorage.setItem('atelier-broadcast-client',this.clientId);}
    catch{this.clientId=crypto.randomUUID();}
    this.timer=setInterval(()=>this.tick(),interval);
  }
  async configure(){
    try{
      const response=await this.fetcher('/api/broadcast');
      if(!response.ok)throw new Error();
      const state=await response.json();this.localToken=state.localToken;
      this.active=state.active&&state.ownerId===this.clientId;
      this.onStatus(!state.configured?'unconfigured':state.active&&!this.active?'occupied':this.active?'reconnecting':'ready');
      return state.configured;
    }catch{this.onStatus('unconfigured');return false;}
  }
  async request(action,payload){
    const response=await this.fetcher('/api/broadcast',{method:'POST',
      headers:{'Content-Type':'application/json','X-Atelier-Local':this.localToken},
      body:JSON.stringify({action,payload,clientId:this.clientId})});
    const result=await response.json();
    if(!response.ok)throw new Error(result.error||'Broadcast could not reach the gallery');
    return result;
  }
  async start(){
    if(this.sending)return;
    this.sending=true;this.onStatus('connecting');
    try{
      const payload=this.snapshot();await this.request('start',payload);
      this.active=true;this.signature=payload.signature;this.sentAt=Date.now();this.onStatus('live');
    }catch(error){this.onStatus('error',error.message);}
    finally{this.sending=false;}
  }
  async tick(){
    if(!this.active||this.sending)return;
    let payload;
    try{payload=this.snapshot();}catch(error){this.onStatus('reconnecting',error.message);return;}
    if(payload.signature===this.signature&&Date.now()-this.sentAt<10000)return;
    this.sending=true;this.onStatus('updating');
    try{
      await this.request('update',payload);this.signature=payload.signature;this.sentAt=Date.now();
      this.onStatus('live');
    }catch(error){this.onStatus('reconnecting',error.message);}
    finally{this.sending=false;}
  }
  async end(){
    if(!this.active||this.sending)return;
    this.sending=true;this.onStatus('ending');
    try{await this.request('stop',null);this.active=false;this.onStatus('ready');}
    catch(error){this.onStatus('reconnecting',error.message);}
    finally{this.sending=false;}
  }
  dispose(){clearInterval(this.timer);}
}

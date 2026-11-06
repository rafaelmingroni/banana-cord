/* Mingrx 3.1.5. Authorized media control and session lifecycle.
 * The media remains peer-to-peer. All authorization uses the same Firestore
 * membership/relationship documents as chat; no client-written RTDB grants.
 */
(() => {
  const F = require('firebase/firestore');
  const { doc, collection, getDoc, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot,
    query, where, limit, writeBatch, runTransaction, serverTimestamp, Timestamp } = F;
  const leaseMs = 90000;
  const pairId = (a,b) => [String(a),String(b)].sort().join('_');
  const stamp = value => value?.toMillis?.() || Number(value) || 0;
  const alive = value => stamp(value?.expiresAt) > Date.now();
  const media = value => ({ muted:!!value?.muted, camera:!!value?.camera, screen:!!value?.screen });
  const previousAttach = window.BananaLegacy?.attachSocket;

  function patch(socket) {
    if (!socket?.db || !socket.user || socket.__mingrx315Transport) return;
    socket.__mingrx315Transport = true;
    const uid = socket.user.uid;
    socket.__voiceWatches = new Map();
    socket.__voiceTrees = new Map();
    socket.__presenceWatches = new Map();
    socket.__profileCache = new Map();
    socket.__presenceState = 'online';
    socket.__activity = null;
    socket.__voiceInbox = null;
    socket.__presenceRefs = new Map();
    socket.__sendQueue = Promise.resolve();
    let lastSend = 0;
    const originalPublicUser = socket.publicUser.bind(socket);
    socket.publicUser = async function(uid) {
      let cached = this.__profileCache.get(uid);
      if (!cached || Date.now() - cached.at > 60000) {
        cached = { at: Date.now(), value: await originalPublicUser(uid) };
        this.__profileCache.set(uid,cached);
      }
      const p = this.presence.get(uid) || {};
      return { ...cached.value, status:p.state || 'offline', activity:p.activity || null, lastSeen:p.lastChanged || null };
    };
    const updateProfile = socket.updateProfile.bind(socket);
    socket.updateProfile = async function(...args) { const result=await updateProfile(...args); this.__profileCache.delete(uid); return result; };

    socket.ensureFriendThread = async function(peerId) {
      if (!(await this.canDm(peerId))) throw new Error('Adicione esta pessoa como amigo antes de iniciar uma conversa privada.');
      // Do not get a missing document: membership-based get rules deny absence.
      await setDoc(doc(this.db,'dmThreads',pairId(uid,peerId)), {
        participants:[uid,peerId].sort(), updatedAt:serverTimestamp()
      },{merge:true});
    };
    socket.addSendPermit = function(batch,key) {
      batch.set(doc(this.db,'users',uid,'limits','chat'),{ lastSentAt:serverTimestamp(), messageKey:key });
    };
    socket.sendMessage = async function(p) {
      const text=String(p.text||'').trim().slice(0,2000);
      if (!text) return;
      const messageRef=doc(collection(this.db,'servers',p.serverId,'channels',p.channelId,'messages'));
      const batch=writeBatch(this.db);
      this.addSendPermit(batch,`${p.serverId}/${p.channelId}/${messageRef.id}`);
      batch.set(messageRef,{authorId:uid,text,createdAt:serverTimestamp(),editedAt:null,
        replyToId:p.replyToId||null,reactions:{},mentionIds:await this.mentionIds(p.serverId,text)});
      await batch.commit();
    };
    // Bound work at admission, then serialize accepted sends to the server limit.
    for (const method of ['sendMessage','sendDm']) {
      const base=(method==='sendDm' ? socket.__mingrxSendDmBase || socket[method] : socket[method]).bind(socket);
      socket[method]=function(...args) {
        this.takeMessagePermitV220?.();
        const send=async()=>{
          if (!this.connected || this.auth.currentUser?.uid !== uid) throw new Error('Sessão encerrada.');
          const delay=Math.max(0,lastSend+850-Date.now());
          if(delay) await new Promise(resolve=>setTimeout(resolve,delay));
          if (!this.connected || this.auth.currentUser?.uid !== uid) throw new Error('Sessão encerrada.');
          const result=await base(...args); lastSend=Date.now(); return result;
        };
        const result=this.__sendQueue.catch(()=>{}).then(send);
        this.__sendQueue=result; return result;
      };
    }
    socket.mentionIds = async function(serverId,text) {
      if (!String(text).includes('@')) return [];
      const names=this.memberCache.get(serverId) || new Map();
      const lower=String(text).toLocaleLowerCase('pt-BR');
      const ids=[];
      for (const [id,profile] of names) {
        const user=this.__profileCache.get(id)?.value;
        const name=user?.name || profile.displayName;
        if (name && lower.includes(`@${String(name).toLocaleLowerCase('pt-BR')}`)) ids.push(id);
      }
      return ids.slice(0,50);
    };

    const presenceRef = (user, serverId) => serverId
      ? collection(socket.db,'servers',serverId,'presence',user,'connections')
      : collection(socket.db,'presence',user,'connections');
    socket.watchContactPresence = function(user,serverId='') {
      const key=`${serverId}:${user}`;
      if(this.__presenceWatches.has(key)) return;
      let entries=[];
      const emit=()=>{
        const active=entries.filter(alive).sort((a,b)=>stamp(b.updatedAt)-stamp(a.updatedAt));
        const value=active[0];
        const previous=this.presence.get(user);
        const next={state:value?.state||'offline',activity:value?.activity||null,lastChanged:stamp(value?.updatedAt)};
        this.presence.set(user,next);
        if(JSON.stringify(previous)!==JSON.stringify(next)) this.publicUser(user).then(p=>this.connected&&this.receive('presence:update',p)).catch(()=>{});
      };
      const off=onSnapshot(presenceRef(user,serverId),snap=>{entries=snap.docs.map(d=>d.data());emit();},()=>{entries=[];emit();});
      this.__presenceWatches.set(key,{off,emit,user,serverId});
    };
    socket.publishPresence = async function() {
      if(!this.connected || this.auth.currentUser?.uid!==uid) return;
      const refs=[doc(this.db,'presence',uid,'connections',this.id)];
      // Scope community presence to communities actually joined, never a global directory.
      for(const serverId of this.knownServerIds) refs.push(doc(this.db,'servers',serverId,'presence',uid,'connections',this.id));
      const data={state:this.__presenceState,activity:this.__activity,updatedAt:serverTimestamp(),expiresAt:Timestamp.fromMillis(Date.now()+120000)};
      for(let i=0;i<refs.length;i+=100){
        const batch=writeBatch(this.db);
        refs.slice(i,i+100).forEach(r=>{batch.set(r,data);this.__presenceRefs.set(r.path,r);});
        await batch.commit();
      }
    };
    socket.startSession = async function() {
      await this.publishPresence();
      this.__presenceTimer=setInterval(()=>this.publishPresence().catch(()=>{}),60000);
      this.__expiryTimer=setInterval(()=>{
        for(const p of this.__presenceWatches.values()) p.emit();
        for(const [serverId,tree] of this.__voiceTrees) this.processVoiceServer(serverId,this.activeVoiceTree(tree));
      },15000);
    };
    socket.watchPresence = function() {
      this.watchContactPresence(uid);
      const off=onSnapshot(query(collection(this.db,'relationships'),where('participants','array-contains',uid)),snap=>{
        const friends=new Set();
        for(const row of snap.docs){const data=row.data();if(data.status==='friends')for(const user of data.participants)if(user!==uid){friends.add(user);this.watchContactPresence(user);}}
        for(const [key,p] of this.__presenceWatches)if(!p.serverId&&p.user!==uid&&!friends.has(p.user)){p.off();this.__presenceWatches.delete(key);this.presence.delete(p.user);}
      });
      this.cleanup.push(off);
    };
    socket.setPresenceV21 = async function(payload) {
      if(!['online','away','busy'].includes(payload.state)) throw new Error('Status inválido.');
      this.__presenceState=payload.state; await this.publishPresence();
    };
    socket.setActivityV21 = async function(payload) {
      const a=payload.activity;
      this.__activity=a ? {id:String(a.id||'').slice(0,64),name:String(a.name||'').slice(0,80),startedAt:Number(a.startedAt)||Date.now()}:null;
      await this.publishPresence();
    };
    const deleteServer=socket.deleteServer.bind(socket);
    socket.deleteServer=async function(serverId) {
      if(await this.role(serverId)!=='owner')throw new Error('Só o dono pode excluir a comunidade.');
      await updateDoc(doc(this.db,'servers',serverId),{deleting:true,updatedAt:serverTimestamp()});
      // Cleanup is idempotent. A failed deletion can be resumed by the owner.
      while(true){
        const snap=await getDocs(query(collection(this.db,'invites'),where('serverId','==',serverId),limit(100)));
        if(snap.empty)break;const batch=writeBatch(this.db);snap.docs.forEach(d=>batch.delete(d.ref));await batch.commit();
      }
      await updateDoc(doc(this.db,'servers',serverId),{inviteCode:''});
      const members=await getDocs(collection(this.db,'servers',serverId,'members'));
      for(const member of members.docs){
        const snap=await getDocs(collection(this.db,'servers',serverId,'presence',member.id,'connections'));
        if(!snap.empty){const batch=writeBatch(this.db);snap.docs.forEach(d=>batch.delete(d.ref));await batch.commit();}
      }
      return deleteServer(serverId);
    };
    for(const method of ['createCategory','updateCategory']) {
      const base=socket[method].bind(socket);
      socket[method]=async function(payload) {
        if(method==='updateCategory'&&payload.action==='delete')return base(payload);
        await this.requireRole(payload.serverId,'moderator');
        const ref=doc(this.db,'servers',payload.serverId);
        await runTransaction(this.db,async tx=>{
          const snap=await tx.get(ref);const categories=[...(snap.data().categories||[])];
          if(method==='createCategory')categories.push({id:'cat_'+crypto.randomUUID().replace(/-/g,''),name:String(payload.name||'Categoria').trim().slice(0,32)});
          else for(const row of categories)if(row.id===payload.categoryId)row.name=String(payload.name||row.name).trim().slice(0,32);
          tx.update(ref,{categories,updatedAt:serverTimestamp()});
        });
      };
    }
    const emitMembers=socket.emitMembers.bind(socket);
    socket.emitMembers=async function(serverId) {
      const result=await emitMembers(serverId);
      for(const user of this.memberCache.get(serverId)?.keys()||[])this.watchContactPresence(user,serverId);
      return result;
    };

    socket.activeVoiceTree = function(tree) {
      const active={};
      for(const [channel,sessions] of Object.entries(tree)) {
        active[channel]={};
        for(const [id,row] of Object.entries(sessions))if(alive(row)
          && (row.sessionId!==this.id || this.voice || this.__voiceJoining))active[channel][id]=row;
      }
      return active;
    };
    socket.syncVoiceWatchers = function(serverId,channels=[]) {
      const allowed=new Set(channels.filter(c=>c.type==='voice').map(c=>c.id));
      const watched=this.__voiceWatches.get(serverId);
      if(!watched)return;
      for(const [channelId,off] of watched)if(!allowed.has(channelId)){off();watched.delete(channelId);delete this.__voiceTrees.get(serverId)?.[channelId];}
      for(const channelId of allowed)if(!watched.has(channelId)){
        const off=onSnapshot(collection(this.db,'servers',serverId,'channels',channelId,'voiceSessions'),snap=>{
          const tree=this.__voiceTrees.get(serverId)||{};
          tree[channelId]=Object.fromEntries(snap.docs.map(d=>{const x=d.data();return [x.sessionId,{...x,slot:d.id}];}));
          this.__voiceTrees.set(serverId,tree);
          this.processVoiceServer(serverId,this.activeVoiceTree(tree));
        },()=>{
          if(this.voice?.serverId===serverId&&this.voice?.channelId===channelId){this.receive('voice:revoked');this.leaveVoice().catch(()=>{});}
        });
        watched.set(channelId,off);
      }
    };
    socket.watchVoiceServer = function(serverId) {
      this.__voiceWatches.set(serverId,new Map());this.__voiceTrees.set(serverId,{});
      this.syncVoiceWatchers(serverId,this.serverCache.get(serverId)?.channels||[]);
      this.publishPresence().catch(()=>{});
      return ()=>{
        for(const off of this.__voiceWatches.get(serverId)?.values()||[])off();
        this.__voiceWatches.delete(serverId);this.__voiceTrees.delete(serverId);
        for(const [key,p]of this.__presenceWatches)if(p.serverId===serverId){p.off();this.__presenceWatches.delete(key);}
        const own=doc(this.db,'servers',serverId,'presence',uid,'connections',this.id);
        this.__presenceRefs.delete(own.path);deleteDoc(own).catch(()=>{});
        if(this.voice?.serverId===serverId){this.receive('voice:revoked');this.leaveVoice().catch(()=>{});}
      };
    };
    socket.watchSignals=function() {}; // inbox is owned by an authorized room slot
    socket.joinVoice=async function(payload={}) {
      if(this.voice)await this.leaveVoice();
      const generation=this.__voiceGeneration=(this.__voiceGeneration||0)+1;
      const direct=String(payload.directUserId||'');
      let base,serverId=String(payload.serverId||''),channelId=String(payload.channelId||'');
      if(direct){
        await this.ensureFriendThread(direct);
        const tid=pairId(uid,direct);base=['dmThreads',tid];serverId=`dm_${tid}`;channelId='direct';
      }else{
        const server=await this.loadServer(serverId);
        if(!server?.channels.some(c=>c.id===channelId&&c.type==='voice'))throw new Error('Você não tem acesso a essa sala de voz.');
        base=['servers',serverId,'channels',channelId];
      }
      const room=collection(this.db,...base,'voiceSessions');
      const slots=Array.from({length:direct?2:5},(_,i)=>doc(room,String(i)));
      const profile=await this.publicUser(uid);
      const user={id:uid,name:String(profile.name||'Usuário').slice(0,32),avatar:String(profile.avatar||'').slice(0,800000),status:profile.status||'online'};
      if(generation!==this.__voiceGeneration || !this.connected)return;
      const joinedAt=Math.max(Date.now(),(this.__voiceLastJoinAt||0)+1);this.__voiceLastJoinAt=joinedAt;
      this.__voiceJoining=true;
      let peers;
      try{peers=await runTransaction(this.db,async tx=>{
        const snaps=await Promise.all(slots.map(r=>tx.get(r)));
        let index=snaps.findIndex(s=>s.exists()&&s.data().userId===uid);
        if(index<0)index=snaps.findIndex(s=>!s.exists()||!alive(s.data()));
        if(index<0)throw new Error('Essa sala está cheia.');
        const slotRef=slots[index];
        tx.set(slotRef,{userId:uid,sessionId:this.id,user,mediaState:media(),speaking:false,
          updatedAt:serverTimestamp(),expiresAt:Timestamp.fromMillis(Date.now()+leaseMs),joinedAt});
        return {slotRef,rows:snaps.filter((s,i)=>i!==index&&s.exists()&&alive(s.data())).map(s=>({slot:s.id,...s.data()}))};
      });}finally{if(generation===this.__voiceGeneration)this.__voiceJoining=false;}
      if(generation!==this.__voiceGeneration || !this.connected){
        await runTransaction(this.db,async tx=>{
          const snap=await tx.get(peers.slotRef);
          if(snap.exists()&&snap.data().sessionId===this.id&&snap.data().joinedAt===joinedAt)tx.delete(peers.slotRef);
        }).catch(()=>{});
        return;
      }
      this.voice={serverId,channelId,directPeerId:direct||undefined,base,slotRef:peers.slotRef,user,initialPeers:peers.rows};
      const admitted=this.voice;
      const off=onSnapshot(query(collection(peers.slotRef,'signals'),where('targetSessionId','==',this.id),where('targetUserId','==',uid)),snap=>{
        for(const change of snap.docChanges())if(change.type==='added'){
          const s=change.doc.data();
          if(s.targetSessionId===this.id&&stamp(s.createdAt)>Date.now()-60000)this.receive('webrtc:signal',{fromSocketId:s.fromSocketId,fromUser:s.fromUser,data:s.data});
          deleteDoc(change.doc.ref).catch(()=>{});
        }
      },()=>{if(this.connected&&this.voice===admitted){this.receive('voice:revoked');this.leaveVoice().catch(()=>{});}});
      this.__voiceInbox=off;
      if(direct){
        this.__directRoomOff=onSnapshot(room,snap=>{
          const tree={direct:Object.fromEntries(snap.docs.map(d=>{const data=d.data();return[data.sessionId,{...data,slot:d.id}];}))};
          this.__voiceTrees.set(serverId,tree);this.processVoiceServer(serverId,this.activeVoiceTree(tree));
        },()=>{if(this.voice===admitted){this.receive('voice:revoked');this.leaveVoice().catch(()=>{});}});
      }
      this.__voiceTimer=setInterval(()=>this.refreshVoiceLease().catch(()=>{if(this.voice===admitted){this.receive('voice:revoked');this.leaveVoice().catch(()=>{});}}),30000);
      this.receive('voice:peers',{channelId,peers:peers.rows.map(e=>({socketId:e.sessionId,user:e.user,mediaState:e.mediaState}))});
    };
    socket.refreshVoiceLease=async function() {
      const current=this.voice;if(!current)return;
      await runTransaction(this.db,async tx=>{
        const snapshot=await tx.get(current.slotRef);
        if(this.voice!==current)return;
        if(!snapshot.exists()||snapshot.data().sessionId!==this.id)throw new Error('Sessão de voz substituída.');
        tx.update(current.slotRef,{updatedAt:serverTimestamp(),expiresAt:Timestamp.fromMillis(Date.now()+leaseMs)});
      });
    };
    socket.leaveVoice=async function() {
      this.__voiceGeneration=(this.__voiceGeneration||0)+1;this.__voiceJoining=false;
      const current=this.voice;this.voice=null;
      clearInterval(this.__voiceTimer);this.__voiceInbox?.();this.__voiceInbox=null;
      this.__directRoomOff?.();this.__directRoomOff=null;
      if(current){
        const tree=this.__voiceTrees.get(current.serverId);
        if(tree){
          for(const sessions of Object.values(tree))for(const [id,row]of Object.entries(sessions))if(row.sessionId===this.id)delete sessions[id];
          this.processVoiceServer(current.serverId,this.activeVoiceTree(tree));
        }
      }
      if(current?.directPeerId){this.__voiceTrees.delete(current.serverId);await this.endDirectCallV212?.(current.directPeerId);}
      if(current?.slotRef)await runTransaction(this.db,async tx=>{
        const s=await tx.get(current.slotRef);
        if(s.exists()&&s.data().sessionId===this.id)tx.delete(current.slotRef);
      }).catch(()=>{});
    };
    socket.voiceMedia=async function(value) {if(this.voice)await updateDoc(this.voice.slotRef,{mediaState:media(value)});};
    socket.voiceSpeaking=async function(value) {if(this.voice)await updateDoc(this.voice.slotRef,{speaking:!!value.speaking});};
    socket.signal=async function(payload={}) {
      const current=this.voice;if(!current||!payload.targetSocketId)return;
      const directory=this.__voiceTrees.get(current.serverId)?.[current.channelId]||{};
      const target=Object.values(directory).find(row=>row.sessionId===payload.targetSocketId)
        || current.initialPeers.find(row=>row.sessionId===payload.targetSocketId);
      if(!target||!alive(target))return;
      const targetRef=doc(this.db,...current.base,'voiceSessions',target.slot);
      const data=JSON.parse(JSON.stringify(payload.data||{}));
      await setDoc(doc(collection(targetRef,'signals')),{fromUserId:uid,fromSocketId:this.id,
        fromSlot:current.slotRef.id,fromUser:current.user,
        targetSessionId:payload.targetSocketId,targetUserId:target.userId,data,createdAt:serverTimestamp()});
    };
    const disconnect=socket.disconnect.bind(socket);
    socket.disconnect=async function(...args) {
      this.connected=false;
      // Unsubscribe synchronously: no old-account callbacks may reach a new UI
      // while an offline cleanup write waits for its network acknowledgement.
      for(const off of this.cleanup)try{off();}catch{}
      this.cleanup=[];
      for(const off of this.messageCleanup.values())try{off();}catch{}
      for(const off of this.dmCleanup.values())try{off();}catch{}
      this.messageCleanup.clear();this.dmCleanup.clear();
      this.handlers.clear();
      clearInterval(this.__presenceTimer);clearInterval(this.__expiryTimer);
      clearInterval(this.__voiceTimer);
      for(const p of this.__presenceWatches.values())p.off();this.__presenceWatches.clear();
      // Stop device capture before waiting for any network flush.
      if(window.BananaCloudSocket===this&&typeof window.MingrxStopMedia==='function')window.MingrxStopMedia();
      await this.leaveVoice();
      await Promise.all([...this.__presenceRefs.values()].map(r=>deleteDoc(r).catch(()=>{})));
      this.__presenceRefs.clear();this.__profileCache.clear();this.presence.clear();
      await disconnect(...args);
    };
    require('./chat-history')(socket);
    const online=()=>{
      if(!socket.connected || socket.auth.currentUser?.uid!==uid) return;
      if(socket.voice) socket.refreshVoiceLease().catch(()=>socket.receive('voice:revoked'));
      socket.publishPresence().catch(()=>{});
    };
    window.addEventListener('online',online);
    socket.cleanup.push(()=>window.removeEventListener('online',online));
  }
  if(previousAttach)window.BananaLegacy.attachSocket=function(socket,user){const result=previousAttach(socket,user);patch(socket);return result;};
  if(window.BananaCloudSocket)patch(window.BananaCloudSocket);
  window.Mingrx315PatchTransport=patch;
})();

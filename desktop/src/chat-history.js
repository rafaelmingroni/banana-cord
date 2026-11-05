/* Bounded live subscriptions with independent cursor pagination. */
const { collection, doc, query, orderBy, limit, startAfter, onSnapshot, getDocs, getDoc } = require('firebase/firestore');
const PAGE=60;
const millis=x=>x?.toMillis?.() || Number(x) || Date.now();
module.exports=function installHistory(socket) {
  socket.__historyGeneration=0;
  socket.__history=new Map();
  const pair=(a,b)=>[String(a),String(b)].sort().join('_');
  const map=(snap,serverId,channelId)=>{const d=snap.data();return{id:snap.id,serverId,channelId,authorId:d.authorId||'',text:d.text||d.body||'',at:millis(d.createdAt),editedAt:d.editedAt?millis(d.editedAt):null,replyToId:d.replyToId||null,reactions:d.reactions||{},mentionIds:d.mentionIds||[]};};
  function publish(record) {
    if(!socket.connected||socket.__history.get(record.kind)!==record)return;
    const rows=[...record.rows.values()].sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id));
    if(record.kind==='dm')socket.receive('dm:list',{user:record.user,messages:rows,historyCount:rows.length});
    else socket.receive('messages:list',{channelId:record.channelId,messages:rows,historyCount:rows.length});
  }
  async function watch(kind,key,serverId,channelId) {
    socket.__history.get(kind)?.off?.();
    const record={kind,key,serverId,channelId,rows:new Map(),cursor:null,hasMore:true,loading:false,chain:Promise.resolve(),off:null};
    socket.__history.set(kind,record);
    if(kind==='dm') {
      await socket.ensureFriendThread(key);
      if(!socket.__bananaE2EEReady)await socket.ensureE2EEIdentity();
      record.user=await socket.publicUser(key);
      const peerKey=await socket.e2eePublicKey(key);
      socket.receive('dm:e2ee-status',{available:!!peerKey,userId:key,keyId:peerKey?.keyId||'',reason:peerKey?'':'O contato ainda não publicou uma chave de criptografia.'});
      record.path=['dmThreads',pair(socket.user.uid,key),'messages'];
    } else record.path=['servers',serverId,'channels',channelId,'messages'];
    if(socket.__history.get(kind)!==record)return;
    const decode=snap=>kind==='dm'?socket.decryptDmV216(snap):map(snap,serverId,channelId);
    record.decode=decode;
    let first=true;
    record.off=onSnapshot(query(collection(socket.db,...record.path),orderBy('createdAt','desc'),limit(PAGE)),snap=>{
      record.chain=record.chain.catch(()=>{}).then(async()=>{
        if(socket.__history.get(kind)!==record||!socket.connected)return;
        if(first){first=false;record.cursor=snap.docs.at(-1)||null;record.hasMore=snap.size===PAGE;}
        for(const change of snap.docChanges()) {
          if(change.type==='removed') {
            // A limited query also removes documents displaced by newer messages.
            // Confirm deletion without discarding a still-existing historical row.
            const current=await getDoc(change.doc.ref);
            if(!current.exists())record.rows.delete(change.doc.id);
            else record.rows.set(current.id,await decode(current));
          }else record.rows.set(change.doc.id,await decode(change.doc));
        }
        publish(record);
      }).catch(error=>socket.receive('app:error',socket.friendly(error)));
    },error=>{record.loading=false;socket.receive('app:error',socket.friendly(error));socket.receive('history:error');});
    const clean=()=>record.off?.();
    if(kind==='dm'){for(const off of socket.dmCleanup.values())off();socket.dmCleanup.clear();socket.dmCleanup.set(key,clean);}
    else{for(const off of socket.messageCleanup.values())off();socket.messageCleanup.clear();socket.messageCleanup.set(channelId,clean);}
  }
  function older(kind,key) {
    const r=socket.__history.get(kind);
    if(!r||r.key!==key||!r.cursor||!r.hasMore||r.loading)return false;
    r.loading=true;
    getDocs(query(collection(socket.db,...r.path),orderBy('createdAt','desc'),startAfter(r.cursor),limit(PAGE))).then(async snap=>{
      if(socket.__history.get(kind)!==r)return;
      for(const item of snap.docs)r.rows.set(item.id,await r.decode(item));
      if(snap.size)r.cursor=snap.docs.at(-1);
      r.hasMore=snap.size===PAGE;publish(r);
    }).catch(error=>{socket.receive('app:error',socket.friendly(error));socket.receive('history:error');}).finally(()=>{r.loading=false;});
    return true;
  }
  socket.watchMessages=(serverId,channelId)=>watch('server',channelId,serverId,channelId);
  socket.watchDm=peerId=>watch('dm',peerId);
  socket.loadOlderMessagesV220=(serverId,channelId)=>older('server',channelId);
  socket.loadOlderDmV220=peerId=>older('dm',peerId);
};

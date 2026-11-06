require('./test-local-emulators');
const fs=require('fs'),path=require('path');
const {initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing');
const {doc,collection,getDoc,getDocs,setDoc,updateDoc,deleteDoc,writeBatch,serverTimestamp,Timestamp,query,where}=require('firebase/firestore');
const {ref,set,get}=require('firebase/database');
const envelope={version:1,algorithm:'X25519-AES-256-GCM',senderKeyId:'a'.repeat(32),recipientKeyId:'b'.repeat(32),iv:'MTIzNDU2Nzg5MDEy',ciphertext:'ZW5jcnlwdGVk',tag:'MTIzNDU2Nzg5MDEyMzQ1Ng=='};
async function main(){
  const env=await initializeTestEnvironment({projectId:'demo-banana-cord',firestore:{rules:fs.readFileSync(path.resolve(__dirname,'../../firebase/firestore.rules'),'utf8')},database:{rules:fs.readFileSync(path.resolve(__dirname,'../../firebase/database.rules.json'),'utf8')}});
  let checks=0;
  const yes=async p=>{await assertSucceeds(p);checks++;}, no=async p=>{await assertFails(p);checks++;};
  const user=id=>env.authenticatedContext(id,{email:`${id}@test.invalid`,email_verified:true});
  const alice=user('alice'),bob=user('bob'),mod=user('mod'),outsider=user('outsider');
  const a=alice.firestore(),b=bob.firestore(),m=mod.firestore(),o=outsider.firestore();
  const server=(db,...p)=>doc(db,'servers','s',...p);
  const room=(db,slot)=>server(db,'channels','voice','voiceSessions',slot);
  const session=(uid,sid)=>({userId:uid,sessionId:sid,user:{id:uid,name:uid,avatar:'',status:'online'},mediaState:{muted:false,camera:false,screen:false},speaking:false,joinedAt:Date.now(),updatedAt:serverTimestamp(),expiresAt:Timestamp.fromMillis(Date.now()+90000)});
  try{
    await env.clearFirestore();await env.clearDatabase();
    await no(setDoc(doc(env.unauthenticatedContext().firestore(),'publicProfiles','n'),{displayName:'n'}));
    const create=writeBatch(a);
    create.set(server(a),{name:'Teste',ownerId:'alice',inviteCode:'ABCD1234',categories:[],createdAt:serverTimestamp()});
    create.set(server(a,'members','alice'),{role:'owner',joinedAt:serverTimestamp()});
    create.set(server(a,'channels','chat'),{name:'chat',type:'text',allowedRoles:[],createdAt:serverTimestamp()});
    create.set(server(a,'channels','voice'),{name:'voz',type:'voice',allowedRoles:[],createdAt:serverTimestamp()});
    create.set(doc(a,'invites','ABCD1234'),{serverId:'s',code:'ABCD1234',createdAt:serverTimestamp()});
    await yes(create.commit());
    await no(getDoc(server(o)));
    await yes(setDoc(server(b,'members','bob'),{role:'member',joinedVia:'ABCD1234'}));
    await yes(setDoc(server(a,'members','mod'),{role:'moderator'}));
    await no(deleteDoc(server(a,'members','alice')));
    await yes(getDoc(server(b)));
    const send=(db,uid,id,text='oi',extra={})=>{
      const batch=writeBatch(db);batch.set(doc(db,'users',uid,'limits','chat'),{lastSentAt:serverTimestamp(),messageKey:`s/chat/${id}`});
      batch.set(server(db,'channels','chat','messages',id),{authorId:uid,text,createdAt:serverTimestamp(),editedAt:null,reactions:{},...extra});return batch.commit();
    };
    await yes(send(a,'alice','one'));
    await no(send(a,'alice','flood'));
    await no(setDoc(server(b,'channels','chat','messages','no-permit'),{authorId:'bob',text:'sem limite',createdAt:serverTimestamp()}));
    await no(send(b,'bob','future','oi',{createdAt:Timestamp.fromMillis(Date.now()+600000)}));
    await yes(send(b,'bob','two'));
    await no(updateDoc(server(m,'channels','chat','messages','one'),{text:'falsificado',editedAt:serverTimestamp()}));
    await yes(updateDoc(server(a,'channels','chat','messages','one'),{text:'editado',editedAt:serverTimestamp()}));
    await yes(updateDoc(server(b,'channels','chat','messages','one'),{reactions:{'👍':['bob']}}));
    await no(updateDoc(server(m,'channels','chat','messages','one'),{reactions:{'👍':['alice','bob']}}));
    await no(updateDoc(server(m,'channels','chat','messages','one'),{reactions:{'👍':[]}}));
    await no(updateDoc(server(m,'channels','chat','messages','one'),{reactions:{falso:['mod']}}));
    await yes(updateDoc(server(b,'channels','chat','messages','one'),{reactions:{}}));
    await yes(setDoc(doc(a,'relationships','alice_bob'),{participants:['alice','bob'],status:'pending',requestedBy:'alice'}));
    await yes(updateDoc(doc(b,'relationships','alice_bob'),{status:'friends',blockedBy:null,updatedAt:serverTimestamp()}));
    await no(getDoc(doc(a,'dmThreads','alice_bob')));
    // Real fresh-DM sequence: authorized idempotent creation, without denied get.
    await yes(setDoc(doc(a,'dmThreads','alice_bob'),{participants:['alice','bob'],updatedAt:serverTimestamp()},{merge:true}));
    await yes(getDocs(collection(b,'dmThreads','alice_bob','messages')));
    await no(getDocs(collection(o,'dmThreads','alice_bob','messages')));
    const dm=writeBatch(m);dm.set(doc(m,'users','mod','limits','chat'),{lastSentAt:serverTimestamp(),messageKey:'alice_bob/spoof'});dm.set(doc(m,'dmThreads','alice_bob','messages','spoof'),{fromId:'mod',toId:'alice',e2ee:envelope,createdAt:serverTimestamp()});await no(dm.commit());
    // Both media control and signaling enforce the room's Firestore permissions.
    await yes(setDoc(room(a,'0'),session('alice','session-a')));
    await yes(setDoc(room(b,'1'),session('bob','session-b')));
    await no(setDoc(room(o,'2'),session('outsider','session-o')));
    await no(getDocs(collection(o,'servers','s','channels','voice','voiceSessions')));
    await no(setDoc(room(b,'0'),session('bob','takeover')));
    await no(setDoc(room(a,'5'),session('alice','sixth-slot')));
    const signal={fromUserId:'alice',fromSocketId:'session-a',fromSlot:'0',fromUser:session('alice','session-a').user,targetSessionId:'session-b',targetUserId:'bob',data:{description:{type:'offer',sdp:'synthetic'}},createdAt:serverTimestamp()};
    const inbox=(db,id)=>doc(db,'servers','s','channels','voice','voiceSessions','1','signals',id);
    await yes(setDoc(inbox(a,'offer'),signal));
    await yes(getDoc(inbox(b,'offer')));
    await no(getDoc(inbox(a,'offer')));
    await no(setDoc(inbox(a,'forged'),{...signal,fromSocketId:'socket-of-somebody-else'}));
    await no(setDoc(inbox(o,'outsider'),{...signal,fromUserId:'outsider'}));
    await yes(deleteDoc(inbox(b,'offer')));
    const candidate={candidate:'candidate:1 1 UDP 2122260223 192.0.2.1 50000 typ host',sdpMid:'0',sdpMLineIndex:0,usernameFragment:'test'};
    await yes(setDoc(inbox(a,'ice'),{...signal,data:{candidate}}));
    await yes(getDocs(query(collection(b,'servers','s','channels','voice','voiceSessions','1','signals'),where('targetSessionId','==','session-b'),where('targetUserId','==','bob'))));
    await yes(deleteDoc(inbox(b,'ice')));
    await no(setDoc(inbox(a,'oversize-ice'),{...signal,data:{candidate:{...candidate,candidate:'x'.repeat(4097)}}}));
    await no(setDoc(inbox(o,'forged-ice'),{...signal,fromUserId:'outsider',data:{candidate}}));
    await yes(setDoc(doc(a,'dmThreads','alice_bob','voiceSessions','0'),session('alice','private-a')));
    await no(setDoc(doc(o,'dmThreads','alice_bob','voiceSessions','1'),session('outsider','private-o')));
    await yes(updateDoc(doc(a,'relationships','alice_bob'),{status:'blocked',blockedBy:'alice',updatedAt:serverTimestamp()}));
    await no(deleteDoc(doc(b,'relationships','alice_bob')));
    await no(updateDoc(doc(b,'relationships','alice_bob'),{status:'blocked',blockedBy:'bob'}));
    await no(setDoc(doc(b,'dmThreads','alice_bob','voiceSessions','1'),session('bob','private-b')));
    await yes(deleteDoc(doc(a,'dmThreads','alice_bob','voiceSessions','0')));
    const presence={state:'online',activity:null,updatedAt:serverTimestamp(),expiresAt:Timestamp.fromMillis(Date.now()+120000)};
    await yes(setDoc(doc(a,'presence','alice','connections','pc'),presence));
    await no(getDocs(collection(b,'presence','alice','connections')));
    await yes(setDoc(server(a,'presence','alice','connections','pc'),presence));
    await yes(getDocs(collection(b,'servers','s','presence','alice','connections')));
    await no(getDocs(collection(o,'servers','s','presence','alice','connections')));
    await yes(deleteDoc(server(a,'members','bob')));
    await no(getDocs(collection(b,'servers','s','channels','voice','voiceSessions')));
    await no(updateDoc(room(b,'1'),{speaking:true}));
    await yes(deleteDoc(room(b,'1')));
    // No legacy RTDB path may bypass the new authorization.
    for(const location of ['presence/alice','sessionOwners/s','voiceRooms/s/v/s','signals/s/s']){
      await no(set(ref(alice.database(),location),{userId:'alice'}));
      await no(get(ref(alice.database(),location)));
    }
    console.log(`Mingrx 3.1.5 Firebase authorization tests: OK (${checks} checks)`);
  }finally{await env.cleanup();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});

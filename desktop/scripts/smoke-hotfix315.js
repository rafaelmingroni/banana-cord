const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
async function main(){
  const registered=new Map();const fakeIpc={handle:(name,fn)=>registered.set(name,fn),on:(name,fn)=>registered.set(name,fn)};
  const ipcContext={module:{exports:{}},require:name=>name==='electron'?{ipcMain:fakeIpc}:require(name),__dirname:root,process,URL};
  vm.runInNewContext(fs.readFileSync(path.join(root,'ipc-security.js'),'utf8'),ipcContext);
  const guard=ipcContext.module.exports;
  const frame={url:require('url').pathToFileURL(path.join(root,'src/index.html')).href};
  const event={sender:{mainFrame:frame},senderFrame:frame};
  assert.equal(guard.trusted(event),true);
  assert.equal(guard.trusted({sender:event.sender,senderFrame:{url:frame.url}}),false);
  assert.equal(guard.trusted({sender:{mainFrame:{url:'https://evil.invalid'}},senderFrame:{url:'https://evil.invalid'}}),false);
  guard.install();fakeIpc.handle('test',()=>42);
  assert.equal(registered.get('test')(event),42);
  assert.throws(()=>registered.get('test')({sender:{mainFrame:frame},senderFrame:{url:frame.url}}));
  let exposed;const incoming=new Map(),invoked=[];
  const preloadContext={process:{platform:'win32'},require:()=>({contextBridge:{exposeInMainWorld:(_name,value)=>{exposed=value;}},ipcRenderer:{invoke:(...args)=>{invoked.push(args);return Promise.resolve(true);},send(){},on:(name,fn)=>incoming.set(name,fn),removeListener(){}}})};
  vm.runInNewContext(fs.readFileSync(path.join(root,'preload.js'),'utf8'),preloadContext);
  await assert.rejects(exposed.ipcRenderer.invoke('host:start'));
  await assert.rejects(exposed.ipcRenderer.invoke('fs:read','secret'));
  assert.throws(()=>exposed.ipcRenderer.on('arbitrary',()=>{}));
  let leaked;exposed.ipcRenderer.on('update:state',(event)=>{leaked=event;});incoming.get('update:state')({sender:'privileged'},{});assert.equal(leaked,null);
  await exposed.ipcRenderer.invoke('clipboard:write','ok');assert.equal(invoked[0][0],'clipboard:write');
  assert(!('require' in exposed));

  const data=Array.from({length:361},(_,i)=>({id:`m${String(i).padStart(4,'0')}`,data:()=>({authorId:'alice',text:`message ${i}`,createdAt:{toMillis:()=>i+1}})})).reverse();
  const page=q=>{const at=q.after?data.findIndex(d=>d.id===q.after.id)+1:0;return data.slice(at,at+q.limit);};
  let offCount=0;
  const F={collection:(...args)=>args,doc(){},orderBy:()=>({order:true}),limit:n=>({limit:n}),startAfter:after=>({after}),query:(_path,...args)=>Object.assign({},...args),getDoc:async()=>({exists:()=>true}),getDocs:async q=>{const docs=page(q);return{docs,size:docs.length};},onSnapshot:(q,fn)=>{const docs=page(q);queueMicrotask(()=>fn({docs,size:docs.length,docChanges:()=>docs.map(doc=>({type:'added',doc}))}));return()=>{offCount++;};}};
  const context={module:{exports:{}},require:()=>F,queueMicrotask,Map,Date};
  vm.runInNewContext(fs.readFileSync(path.join(root,'src/chat-history.js'),'utf8'),context);
  const lists=[];const socket={db:{},connected:true,messageCleanup:new Map(),dmCleanup:new Map(),receive:(event,payload)=>{if(event==='messages:list')lists.push(payload.messages);},friendly:e=>e.message};
  context.module.exports(socket);
  const flush=()=>new Promise(resolve=>setImmediate(resolve));
  await socket.watchMessages('server','channel');await flush();assert.equal(lists.at(-1).length,60);
  for(let i=0;i<6;i++){assert.equal(socket.loadOlderMessagesV220('server','channel'),true);await flush();}
  assert.equal(lists.at(-1).length,361);assert.equal(lists.at(-1)[0].text,'message 0');
  assert.equal(socket.loadOlderMessagesV220('server','channel'),false);
  await socket.watchMessages('server','other');await flush();assert(offCount>=1);
  const updaterHandlers=new Map(),events=new Map();
  const updater={autoInstallOnAppQuit:true,on:(name,fn)=>events.set(name,fn),setFeedURL(value){this.feed=value;}};
  const app={getVersion:()=> '3.1.5',on(){},whenReady:()=>({then(){}})};
  const updateContext={module:{exports:{}},__dirname:root,setTimeout,clearTimeout,setInterval,clearInterval,
    require:name=>{
      if(name==='electron')return {app,BrowserWindow:{getAllWindows:()=>[]},ipcMain:{handle:(name,fn)=>updaterHandlers.set(name,fn),on:(name,fn)=>updaterHandlers.set(name,fn)}};
      if(name==='electron-updater')return{autoUpdater:updater};
      if(name==='./graceful-shutdown')return{patchAutoUpdater(){}};
      if(name==='./src/mingrx-updater-compat')return{OFFICIAL_UPDATE_OWNER:'rafaelmingroni',OFFICIAL_UPDATE_REPO:'mingrx-app'};
      return require(name);
    }};
  vm.runInNewContext(fs.readFileSync(path.join(root,'update-service.js'),'utf8'),updateContext);
  updateContext.module.exports.configureUpdater();
  assert.equal(updater.autoInstallOnAppQuit,true);assert.equal(updater.autoDownload,true);assert.equal(updater.autoRunAppAfterInstall,true);assert.equal(updater.feed.repo,'mingrx-app');
  assert.throws(()=>updaterHandlers.get('update:save-config')({}, {repoUrl:'https://evil.invalid'}));
  events.get('update-downloaded')({version:'3.1.6'});
  assert.equal(updaterHandlers.get('update:get-state')(),updaterHandlers.get('banana-updater:get-state')());
  assert.equal(updaterHandlers.get('update:get-state')().phase,'ready');
  const main=fs.readFileSync(path.join(root,'main.js'),'utf8');
  assert(main.includes('nodeIntegration: false')&&main.includes('contextIsolation: true')&&main.includes('sandbox: true'));
  assert(fs.readFileSync(path.join(root,'src/mingrx-312-private-fix.js'),'utf8').includes('socket.ensureFriendThread'));
  console.log('Mingrx 3.1.5 IPC isolation and 361-message cursor pagination: OK');
}
main().catch(error=>{console.error(error);process.exitCode=1;});

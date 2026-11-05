const path = require('path');
const { app, BrowserWindow, ipcMain } = require('electron');

app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');

for (const [name, handler] of [
  ['update:get-config', async () => ({ repoUrl:'',autoCheck:true,autoDownload:true,currentVersion:'2.1.0' })],
  ['update:get-state', async () => ({ status:'idle',progress:0,message:'' })],
  ['clipboard:write', async () => true],
  ['banana-updater:get-state', async () => ({ phase:'idle',version:'2.1.0',percent:0 })],
  ['banana-updater:get-version', async () => '2.1.0'],
  ['banana-updater:check', async () => ({ ok:true })],
  ['banana-v21:get-settings', async () => ({ idleSeconds:0,idleState:'active',activity:null,settings:{shareActivity:true,autoAwayMinutes:5,startup:{enabled:false}},startupLaunch:false })],
  ['banana-v21:set-settings', async () => ({ idleSeconds:0,idleState:'active',activity:null,settings:{shareActivity:true,autoAwayMinutes:5,startup:{enabled:false}},startupLaunch:false })],
  ['banana-v21:get-system-languages', async () => ['pt-BR']]
]) ipcMain.handle(name, handler);

const timeout = setTimeout(() => { console.error('Banana Cord 2.1 submit priority E2E failed: timeout'); app.exit(1); }, 16000);
function finish(code, message) { clearTimeout(timeout); (code ? console.error : console.log)(message); setTimeout(() => app.exit(code), 40); }
function fail(message) { finish(1, `Banana Cord 2.1 submit priority E2E failed: ${message}`); }

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show:false,width:900,height:650,webPreferences:{preload:path.join(__dirname,'..','preload.js'),nodeIntegration:false,contextIsolation:true,sandbox:true} });
  win.webContents.on('console-message', (...args) => { const d=args[1]; const message=typeof d==='object'?d.message:args[2]; if((typeof d==='object' && d.level==='error')||d===3) console.error('renderer error:',message); });
  await win.loadFile(path.join(__dirname,'..','src','index.html'));
  await new Promise(r => setTimeout(r,180));
  const result = await win.webContents.executeJavaScript(`
    (async()=>{
      const sleep=ms=>new Promise(r=>setTimeout(r,ms));
      const emitted=[];const handlers=new Map();
      const socket={connected:true,on(e,f){if(!handlers.has(e))handlers.set(e,new Set());handlers.get(e).add(f);return this},off(){return this},emit(event,payload,ack){emitted.push({event,payload});if(event==='messages:clear')ack?.({ok:true,count:payload.amount,mode:payload.mode,all:payload.all});else ack?.({ok:true});return this}};
      state.user={id:'me',name:'Rafael',status:'online'};state.ui.status='online';state.socket=socket;state.viewMode='server';
      state.selectedServer={id:'srv',name:'Test',ownerId:'me',memberRoles:{me:'owner',peer:'member'},categories:[],channels:[{id:'general',name:'geral',type:'text',categoryId:null,allowedRoles:[]}]};
      state.selectedChannel=state.selectedServer.channels[0];state.servers=[state.selectedServer];state.members=new Map([['me',{id:'me',name:'Rafael',role:'owner',status:'online'}],['peer',{id:'peer',name:'Gustavo',role:'member',status:'online'}]]);
      state.messagesByChannel.set('general',[{id:'peer1',serverId:'srv',channelId:'general',authorId:'peer',text:'mensagem original',at:Date.now(),reactions:{}}]);
      bindSocket(socket);els.setup.classList.add('hidden');els.app.classList.remove('hidden');els.emptyView.classList.add('hidden');els.textView.classList.remove('hidden');renderMessages(true);await sleep(30);

      const reply=document.querySelector('.message[data-message-id="peer1"] [data-v21-action="reply"]');
      if(!reply)return{ok:false,reason:'reply action missing'};
      reply.click();els.messageInput.value='minha resposta';els.messageForm.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await sleep(20);
      const replySend=emitted.find(x=>x.event==='message:send'&&x.payload?.replyToId==='peer1');
      if(!replySend)return{ok:false,reason:'reply was not routed with replyToId',emitted};
      if(emitted.filter(x=>x.event==='message:send'&&x.payload?.text==='minha resposta').length!==1)return{ok:false,reason:'reply was duplicated by legacy submitter',emitted};

      const beforeCommandSends=emitted.filter(x=>x.event==='message:send').length;
      els.messageInput.value='/clear 20';els.messageForm.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await sleep(20);
      const clear20=emitted.find(x=>x.event==='messages:clear');
      if(!clear20||clear20.payload?.amount!==20||clear20.payload?.mode!=='all'||clear20.payload?.all!==false)return{ok:false,reason:'slash clear 20 did not keep bounded intent',emitted};
      if(emitted.filter(x=>x.event==='message:send').length!==beforeCommandSends)return{ok:false,reason:'slash command leaked into chat as a message',emitted};

      els.messageInput.value='/clear 100';els.messageForm.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await sleep(20);
      const clear100=emitted.filter(x=>x.event==='messages:clear')[1];
      if(!clear100||clear100.payload?.amount!==100||clear100.payload?.all!==false)return{ok:false,reason:'clear 100 must not become clear all',emitted};

      els.messageInput.value='/clear all';els.messageForm.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await sleep(20);
      const confirm=document.getElementById('v21ReleaseClearOk');
      if(!confirm)return{ok:false,reason:'clear all confirmation missing'};
      confirm.click();await sleep(20);
      const clearAll=emitted.filter(x=>x.event==='messages:clear')[2];
      if(!clearAll||clearAll.payload?.all!==true||clearAll.payload?.mode!=='all')return{ok:false,reason:'explicit clear all intent missing',emitted};

      els.messageInput.value='/status away';els.messageForm.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await sleep(20);
      if(!emitted.some(x=>x.event==='profile:update'&&x.payload?.status==='away'))return{ok:false,reason:'status command was not executed',emitted};
      if(emitted.some(x=>x.event==='message:send'&&String(x.payload?.text||'').startsWith('/')))return{ok:false,reason:'a slash command was posted as chat text',emitted};
      return{ok:true,events:emitted.map(x=>x.event)};
    })();
  `,true);
  if(!result?.ok)return fail(`${result?.reason||'unknown'} ${JSON.stringify(result||{})}`);
  try{win.destroy()}catch{}
  finish(0,`Banana Cord 2.1 submit priority Electron test: OK (${result.events.join(', ')})`);
}).catch(error=>fail(error?.stack||error?.message||String(error)));

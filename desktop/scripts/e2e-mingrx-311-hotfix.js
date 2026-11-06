const path = require('path');
const { app, BrowserWindow, ipcMain } = require('electron');

app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');
const safeHandle = (name, fn) => { try { ipcMain.handle(name, fn); } catch {} };
safeHandle('clipboard:write', async () => true);
safeHandle('update:get-config', async () => ({ repoUrl:'',autoCheck:true,autoDownload:true,currentVersion:'3.1.1' }));
safeHandle('update:get-state', async () => ({ status:'idle',progress:0,message:'' }));
safeHandle('banana-updater:get-state', async () => ({ phase:'idle',version:'3.1.1',percent:0 }));
safeHandle('banana-updater:get-version', async () => '3.1.1');
safeHandle('banana-updater:check', async () => ({ ok:true }));
safeHandle('banana-v21:get-settings', async () => ({idleSeconds:0,idleState:'active',activity:null,settings:{shareActivity:true,autoAwayMinutes:5,startup:{enabled:false}},startupLaunch:false}));
safeHandle('banana-v21:set-settings', async () => ({}));
safeHandle('banana-v21:get-system-languages', async () => ['pt-BR']);

const hardTimeout = setTimeout(() => { console.error('Mingrx 3.1.1 hotfix E2E failed: hard timeout'); app.exit(1); }, 26000);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function finish(code, message) { clearTimeout(hardTimeout); if (message) (code ? console.error : console.log)(message); setTimeout(() => app.exit(code), 50); }
const fail = message => finish(1, `Mingrx 3.1.1 hotfix E2E failed: ${message}`);

// Keep the harness alive until its explicit success/failure exit code runs.
app.on('window-all-closed', () => {});

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show:false,width:1366,height:768,webPreferences:{preload:path.join(__dirname,'..','preload.js'),nodeIntegration:false,contextIsolation:true,sandbox:true} });
  win.webContents.on('console-message', (...args) => { const d=args[1]; const message=typeof d==='object'?d.message:args[2]; if((typeof d==='object' && d.level==='error')||d===3) console.error('renderer error:',message); });
  await win.loadFile(path.join(__dirname,'..','src','index.html'));
  await sleep(350);

  const result = await win.webContents.executeJavaScript(`
    (async()=>{
      const sleep=ms=>new Promise(r=>setTimeout(r,ms));
      const failures=[];
      const handlers=new Map();
      const fake={
        id:'socket-me', connected:true,
        on(event,fn){if(!handlers.has(event))handlers.set(event,new Set());handlers.get(event).add(fn);return this;},
        off(event,fn){handlers.get(event)?.delete(fn);return this;},
        emit(event,payload,ack){
          if(event==='server:update') {
            queueMicrotask(()=>{
              const updated={...server,icon:String(payload.icon||'')};
              for(const fn of [...(handlers.get('server:updated')||[])]) fn(updated);
              ack?.({ok:true});
            });
          } else ack?.({ok:true});
          return this;
        }
      };
      const server={id:'srv',name:'GZ E MINGRX',ownerId:'me',inviteCode:'MINGRX88',icon:'',memberRoles:{me:'owner',peer:'member'},categories:[],channels:[{id:'general',name:'geral',type:'text',categoryId:null,allowedRoles:[]},{id:'voice',name:'Geral',type:'voice',categoryId:null,allowedRoles:[]}]};

      state.user={id:'me',name:'Rafael',status:'online',avatar:''};
      state.socket=fake;
      state.servers=[server];
      state.selectedServer=server;
      state.selectedChannel=server.channels[0];
      state.viewMode='server';
      state.members=new Map([['me',{id:'me',name:'Rafael',role:'owner',status:'online',avatar:''}],['peer',{id:'peer',name:'Gustavo',role:'member',status:'online',avatar:''}]]);
      els.setup.classList.add('hidden');
      els.app.classList.remove('hidden');

      if(!window.Mingrx311) failures.push('3.1.1 hotfix runtime missing');

      // Real server photo rendering: use an <img>, not a fragile CSS-only background.
      const icon='data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEAAQAcJaQAA3AA/v89WAAAAA==';
      server.icon=icon;
      renderServers();
      const serverButton=document.querySelector('#serverList [data-server-id="srv"]');
      const serverImg=serverButton?.querySelector(':scope > .mingrx311-server-photo');
      if(!serverButton?.classList.contains('mingrx311-photo-ready')) failures.push('server button did not enter real-photo mode');
      if(!serverImg || !String(serverImg.src||'').startsWith('data:image/webp;base64,')) failures.push('server photo img was not rendered from persisted icon');

      // Persistence is only considered successful after server:updated confirms the exact icon.
      server.icon='';
      state.servers[0].icon='';
      await window.Mingrx311.persistServerIcon(server,icon);
      if(server.icon!==icon || state.servers[0].icon!==icon) failures.push('server photo confirmation did not update local server state');
      renderServers();
      if(!document.querySelector('#serverList [data-server-id="srv"] > .mingrx311-server-photo')) failures.push('confirmed server photo disappeared after rerender');

      // Private navigation must be the three requested actions in one vertical column.
      state.viewMode='dm';
      state.activeDmUserId=null;
      renderDmSidebar();
      window.Mingrx311.normalizePrivateActions();
      const tools=document.querySelector('.v214-private-sidebar .v1-dm-tools,.dm-sidebar .v1-dm-tools');
      const labels=[...(tools?.querySelectorAll(':scope > button')||[])].map(b=>String(b.textContent||'').replace(/\\s+/g,' ').trim());
      if(labels.length<3) failures.push('private sidebar does not have three top actions: '+JSON.stringify(labels));
      if(!/Amigos/i.test(labels[0]||'') || !/Mensagem/i.test(labels[1]||'') || !/Adicionar amigo/i.test(labels[2]||'')) failures.push('private action order is wrong: '+JSON.stringify(labels));
      if(tools && getComputedStyle(tools).flexDirection!=='column') failures.push('private actions are not stacked vertically');

      // A connected local user must never disappear from the voice channel list.
      state.viewMode='server';
      state.selectedServer=server;
      state.selectedChannel=server.channels[1];
      state.voice.serverId='srv';
      state.voice.channelId='voice';
      state.voice.muted=false;
      state.voice.camera=null;
      state.voice.screen=null;
      state.voice.speaking=false;
      state.voice.peers=new Map();
      state.voicePresence.set('voice',[]);
      window.Mingrx311.reconcileVoicePresence('voice',{force:true});
      let voiceRows=state.voicePresence.get('voice')||[];
      if(!voiceRows.some(row=>String(row.userId||row.user?.id)==='me')) failures.push('connected local user vanished from voice presence');

      // A remote peer whose connection is closed must not remain as a ghost after updater/restart.
      state.voicePresence.set('voice',[
        {socketId:'socket-me',userId:'me',user:{id:'me',name:'Rafael'},mediaState:{},speaking:false},
        {socketId:'socket-old-peer',userId:'peer',user:{id:'peer',name:'Gustavo'},mediaState:{},speaking:false}
      ]);
      state.voice.peers=new Map([['socket-old-peer',{socketId:'socket-old-peer',user:{id:'peer',name:'Gustavo'},mediaState:{},pc:{connectionState:'closed',iceConnectionState:'closed'}}]]);
      window.Mingrx311.reconcileVoicePresence('voice',{force:true});
      voiceRows=state.voicePresence.get('voice')||[];
      if(voiceRows.some(row=>String(row.userId||row.user?.id)==='peer')) failures.push('disconnected updater ghost remained in voice presence');
      if(!voiceRows.some(row=>String(row.userId||row.user?.id)==='me')) failures.push('ghost cleanup also removed the real local call');

      // Ending a watched stream must cancel watch/focus mode instead of trapping the avatar.
      const card=document.createElement('div');
      card.id='video-peer-hotfix';
      card.className='video-card is-sharing';
      card.innerHTML='<div class="video-placeholder"><div class="avatar-video"></div></div><video></video>';
      els.videoGrid.appendChild(card);
      state.ui.focusSharing=true;
      state.ui.showAllOverride=false;
      window.Mingrx31UX?.markWatchingCard?.(card);
      card.classList.remove('is-sharing');
      window.Mingrx311.handleEndedStreamCard(card);
      await sleep(20);
      if(card.classList.contains('mingrx-watching-stream')) failures.push('ended stream kept watched marker');
      if(card.querySelector('.mingrx-stop-watching')) failures.push('ended stream kept stop-watching overlay');
      if(state.ui.focusSharing!==false || state.ui.showAllOverride!==true) failures.push('ended stream did not restore normal voice grid');
      card.remove();

      return {ok:failures.length===0,failures,labels,serverPhoto:!!serverImg,voiceRows:voiceRows.map(r=>r.user?.name||r.userId),focusSharing:state.ui.focusSharing,showAllOverride:state.ui.showAllOverride};
    })();
  `, true);

  try { win.destroy(); } catch {}
  if (!result?.ok) return fail(JSON.stringify(result));
  finish(0, `Mingrx 3.1.1 reported-regressions Electron test: OK ${JSON.stringify(result)}`);
}).catch(error => fail(error?.stack || error?.message || String(error)));

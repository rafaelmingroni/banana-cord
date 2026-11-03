const path = require('path');
const { app, BrowserWindow, ipcMain } = require('electron');

app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');
const safeHandle = (name, fn) => { try { ipcMain.handle(name, fn); } catch {} };
safeHandle('clipboard:write', async () => true);
safeHandle('update:get-config', async () => ({ repoUrl:'',autoCheck:true,autoDownload:true,currentVersion:'3.1.0' }));
safeHandle('update:get-state', async () => ({ status:'idle',progress:0,message:'' }));
safeHandle('banana-updater:get-state', async () => ({ phase:'idle',version:'3.1.0',percent:0 }));
safeHandle('banana-updater:get-version', async () => '3.1.0');
safeHandle('banana-updater:check', async () => ({ ok:true }));
safeHandle('banana-v21:get-settings', async () => ({idleSeconds:0,idleState:'active',activity:null,settings:{shareActivity:true,autoAwayMinutes:5,startup:{enabled:false}},startupLaunch:false}));
safeHandle('banana-v21:set-settings', async () => ({}));
safeHandle('banana-v21:get-system-languages', async () => ['pt-BR']);

const hardTimeout = setTimeout(() => { console.error('Mingrx Spark media/invite E2E failed: hard timeout'); app.exit(1); }, 24000);
const sleep = ms => new Promise(r => setTimeout(r, ms));
function finish(code, message) { clearTimeout(hardTimeout); if (message) (code ? console.error : console.log)(message); setTimeout(() => app.exit(code), 50); }
const fail = message => finish(1, `Mingrx Spark media/invite E2E failed: ${message}`);

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show:false,width:1366,height:768,webPreferences:{nodeIntegration:true,contextIsolation:false,sandbox:false} });
  await win.loadFile(path.join(__dirname,'..','src','index.html'));
  await sleep(300);

  const result = await win.webContents.executeJavaScript(`
    (async()=>{
      const sleep=ms=>new Promise(r=>setTimeout(r,ms));
      const failures=[];
      const emitted=[];
      const handlers=new Map();
      const fake={
        connected:true,
        on(event,fn){if(!handlers.has(event))handlers.set(event,new Set());handlers.get(event).add(fn);return this;},
        off(event,fn){handlers.get(event)?.delete(fn);return this;},
        emit(event,payload,ack){
          emitted.push({event,payload});
          if(event==='invite:create-temporary') queueMicrotask(()=>ack?.({ok:true,code:'ABCDEFGH',expiresAt:Date.now()+3600000}));
          else ack?.({ok:true});
          return this;
        }
      };
      const server={id:'srv',name:'GZ E MINGRX',ownerId:'me',inviteCode:'MINGRX88',icon:'',memberRoles:{me:'owner',peer:'member'},categories:[],channels:[{id:'general',name:'geral',type:'text',categoryId:null,allowedRoles:[]},{id:'voice',name:'Geral',type:'voice',categoryId:null,allowedRoles:[]}]};
      state.user={id:'me',name:'Rafael',status:'online',avatar:''};
      state.socket=fake; state.servers=[server]; state.selectedServer=server; state.selectedChannel=server.channels[0]; state.viewMode='server'; state.activeDmUserId=null;
      state.members=new Map([['me',{id:'me',name:'Rafael',role:'owner',status:'online',avatar:''}],['peer',{id:'peer',name:'Gustavo',role:'member',status:'online',avatar:''}]]);
      els.setup.classList.add('hidden'); els.app.classList.remove('hidden'); els.app.classList.remove('dm-mode');
      els.emptyView.classList.add('hidden'); els.textView.classList.remove('hidden'); els.voiceView.classList.add('hidden');
      els.serverName.textContent=server.name; els.inviteBtn.style.visibility='visible'; els.serverSettingsBtn.style.visibility='visible';
      renderServers(); renderChannels(); renderMembers();

      const attach=document.getElementById('mingrxAttachBtn');
      if(attach) failures.push('chat/DM attachment button must not exist in Spark mode');
      if(!window.MingrxMedia?.sparkMode || window.MingrxMedia?.chatImageUpload!==false) failures.push('Spark media runtime flags are incorrect');
      if(!window.MingrxInvite?.open) failures.push('Mingrx invite runtime missing');
      if(!window.Mingrx31UX?.repairCommunitySettings || !window.Mingrx31UX?.stopWatching) failures.push('Mingrx 3.1 UX runtime missing');

      // Invite must open immediately and old premium handler must be gone.
      const invite=document.getElementById('inviteBtn');
      if(invite?.dataset.mingrxInvite!=='1') failures.push('invite button was not replaced');
      const started=performance.now();
      invite?.click();
      await sleep(30);
      const elapsed=performance.now()-started;
      if(els.modal.classList.contains('hidden')) failures.push('invite modal did not open');
      if(!document.querySelector('.mingrx-invite')) failures.push('new Mingrx invite modal missing');
      if(document.querySelector('.premium-invite')) failures.push('legacy premium invite modal still won the click');
      if(elapsed>500) failures.push('invite modal blocked UI for '+Math.round(elapsed)+'ms');
      if(!(els.modalBody.textContent||'').includes('MING-RX88') && !(els.modalBody.textContent||'').includes('MINGRX88')) failures.push('permanent invite code missing');
      if(!(els.modalBody.textContent||'').includes('mingrx://join/')) failures.push('Mingrx invite link missing');
      document.getElementById('mxInviteTemporary')?.click();
      await sleep(60);
      if(!document.getElementById('mxInviteTempResult') || document.getElementById('mxInviteTempResult')?.classList.contains('hidden')) failures.push('temporary invite result missing');
      closeModal();

      // Community photo remains available without Firebase Storage and must be visible in the correct place.
      document.getElementById('serverSettingsBtn')?.click();
      await sleep(420);
      const settingsRoot=document.querySelector('#modalBody .v219-role-settings');
      const photoCard=document.querySelector('#modalBody .mingrx-community-photo-card');
      const modalCard=document.querySelector('#modal > .modal-card');
      if(!photoCard) failures.push('community photo card missing from settings');
      if(photoCard && photoCard.parentElement!==settingsRoot) failures.push('community photo card is not a top-level settings section');
      if(photoCard?.dataset.mingrx31Placement!=='fixed') failures.push('community photo placement fix did not run');
      if(!modalCard?.classList.contains('mingrx-server-settings-modal')) failures.push('community settings modal was not widened');
      const choose=[...document.querySelectorAll('.mingrx-community-photo-actions button')].find(b=>/foto/i.test(b.textContent||'')&&!/remover/i.test(b.textContent||''));
      if(!choose) failures.push('community photo choose action missing');
      if(choose && getComputedStyle(choose).display==='none') failures.push('community photo choose action is hidden');
      if(!(els.modalBody.textContent||'').includes('Spark')) failures.push('community photo UI does not explain Spark mode');
      closeModal();
      await sleep(40);
      if(document.querySelector('#modal > .modal-card')?.classList.contains('mingrx-server-settings-modal')) failures.push('wide settings modal class leaked after closing');

      // Watching a stream must expose an explicit stop control and return to normal grid mode.
      const fakeCard=document.createElement('div');
      fakeCard.id='video-peer-e2e';
      fakeCard.className='video-card is-sharing';
      fakeCard.innerHTML='<video></video><div class="video-label">Gustavo · compartilhando tela</div>';
      els.videoGrid.appendChild(fakeCard);
      state.ui.focusSharing=true;
      state.ui.showAllOverride=false;
      window.Mingrx31UX.markWatchingCard(fakeCard);
      const stopButton=fakeCard.querySelector('.mingrx-stop-watching');
      if(!stopButton || !/Parar de assistir/i.test(stopButton.textContent||'')) failures.push('stop-watching button missing on watched stream');
      stopButton?.click();
      await sleep(20);
      if(fakeCard.querySelector('.mingrx-stop-watching')) failures.push('stop-watching button remained after stopping');
      if(fakeCard.classList.contains('mingrx-watching-stream')) failures.push('watched stream marker remained after stopping');
      if(state.ui.focusSharing!==false || state.ui.showAllOverride!==true) failures.push('stop-watching did not restore normal grid mode');
      fakeCard.remove();

      // Old 3.0 image markers still render for backwards compatibility, but no new upload UI exists.
      const legacyMeta={u:'https://example.com/screenshot.webp',n:'print.webp',c:'Imagem antiga'};
      const marker='[[MINGRX_IMAGE_V1:'+Buffer.from(JSON.stringify(legacyMeta),'utf8').toString('base64url')+']]';
      state.viewMode='server'; state.selectedServer=server; state.selectedChannel=server.channels[0];
      state.messagesByChannel.set('general',[{id:'img1',serverId:'srv',channelId:'general',authorId:'me',text:marker,at:Date.now(),reactions:{}}]);
      renderMessages(true); await sleep(30);
      const communityImage=document.querySelector('.mingrx-chat-image-card img');
      if(!communityImage || !communityImage.src.includes('example.com/screenshot.webp')) failures.push('legacy community inline image did not render');
      if((els.messages.textContent||'').includes('MINGRX_IMAGE_V1')) failures.push('raw legacy media marker leaked to UI');

      state.viewMode='dm'; state.activeDmUserId='peer'; state.selectedServer=null; state.selectedChannel=null;
      state.dmConversations=[{user:{id:'peer',name:'Gustavo',status:'online',avatar:''},lastMessage:null}];
      state.dmMessages.set('peer',[{id:'dmimg1',fromId:'me',toId:'peer',text:marker,at:Date.now(),reactions:{},e2ee:true}]);
      els.app.classList.add('dm-mode'); els.textView.classList.remove('hidden');
      renderDmMessages(true); await sleep(30);
      const dmImage=document.querySelector('.mingrx-chat-image-card img');
      if(!dmImage || !dmImage.src.includes('example.com/screenshot.webp')) failures.push('legacy DM inline image did not render');
      if((els.messages.textContent||'').includes('MINGRX_IMAGE_V1')) failures.push('raw legacy DM media marker leaked to UI');

      return {ok:failures.length===0,failures,elapsed,emitted:emitted.map(x=>x.event),attachPresent:!!attach,sparkMode:window.MingrxMedia?.sparkMode,inviteReplaced:invite?.dataset.mingrxInvite==='1',photoPlacement:photoCard?.dataset.mingrx31Placement||'',stopWatchingTest:true};
    })();
  `, true);

  try { win.destroy(); } catch {}
  if (!result?.ok) return fail(JSON.stringify(result));
  finish(0, `Mingrx Spark media + invite + UX Electron test: OK ${JSON.stringify(result)}`);
}).catch(error => fail(error?.stack || error?.message || String(error)));

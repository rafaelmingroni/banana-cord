const path = require('path');
const { app, BrowserWindow, ipcMain } = require('electron');

app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');
const safeHandle = (name, fn) => { try { ipcMain.handle(name, fn); } catch {} };
safeHandle('clipboard:write', async () => true);
safeHandle('update:get-config', async () => ({ repoUrl:'',autoCheck:true,autoDownload:true,currentVersion:'3.0.0' }));
safeHandle('update:get-state', async () => ({ status:'idle',progress:0,message:'' }));
safeHandle('banana-updater:get-state', async () => ({ phase:'idle',version:'3.0.0',percent:0 }));
safeHandle('banana-updater:get-version', async () => '3.0.0');
safeHandle('banana-updater:check', async () => ({ ok:true }));
safeHandle('banana-v21:get-settings', async () => ({idleSeconds:0,idleState:'active',activity:null,settings:{shareActivity:true,autoAwayMinutes:5,startup:{enabled:false}},startupLaunch:false}));
safeHandle('banana-v21:set-settings', async () => ({}));
safeHandle('banana-v21:get-system-languages', async () => ['pt-BR']);

const hardTimeout = setTimeout(() => { console.error('Mingrx media/invite E2E failed: hard timeout'); app.exit(1); }, 30000);
const sleep = ms => new Promise(r => setTimeout(r, ms));
function finish(code, message) { clearTimeout(hardTimeout); if (message) (code ? console.error : console.log)(message); setTimeout(() => app.exit(code), 50); }
const fail = message => finish(1, `Mingrx media/invite E2E failed: ${message}`);

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
      const server={id:'srv',name:'GZ E MINGRX',ownerId:'me',inviteCode:'MINGRX88',icon:'',memberRoles:{me:'owner',peer:'member'},categories:[],channels:[{id:'general',name:'geral',type:'text',categoryId:null,allowedRoles:[]}]};
      state.user={id:'me',name:'Rafael',status:'online',avatar:''};
      state.socket=fake; state.servers=[server]; state.selectedServer=server; state.selectedChannel=server.channels[0]; state.viewMode='server'; state.activeDmUserId=null;
      state.members=new Map([['me',{id:'me',name:'Rafael',role:'owner',status:'online',avatar:''}],['peer',{id:'peer',name:'Gustavo',role:'member',status:'online',avatar:''}]]);
      els.setup.classList.add('hidden'); els.app.classList.remove('hidden'); els.app.classList.remove('dm-mode');
      els.emptyView.classList.add('hidden'); els.textView.classList.remove('hidden'); els.voiceView.classList.add('hidden');
      els.serverName.textContent=server.name; els.inviteBtn.style.visibility='visible'; els.serverSettingsBtn.style.visibility='visible';
      renderServers(); renderChannels(); renderMembers();

      const attach=document.getElementById('mingrxAttachBtn');
      if(!attach) failures.push('composer attachment button missing');
      if(!window.MingrxMedia?.encodeMedia || !window.MingrxInvite?.open) failures.push('Mingrx media/invite runtime missing');

      // Reproduce the exact class of file that the legacy 550 KB gate rejected.
      // A deterministic noisy PNG is intentionally hard to compress at source,
      // then Mingrx must resize/re-encode it below the community-icon target.
      try {
        const canvas=document.createElement('canvas');
        canvas.width=1200; canvas.height=1200;
        const ctx=canvas.getContext('2d');
        const image=ctx.createImageData(canvas.width,canvas.height);
        let seed=0x12345678;
        for(let i=0;i<image.data.length;i+=4){
          seed=(1664525*seed+1013904223)>>>0;
          image.data[i]=seed&255;
          image.data[i+1]=(seed>>>8)&255;
          image.data[i+2]=(seed>>>16)&255;
          image.data[i+3]=255;
        }
        ctx.putImageData(image,0,0);
        const source=await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('png blob failed')),'image/png'));
        if(source.size<=550000) failures.push('large-photo fixture did not exceed legacy 550 KB gate: '+source.size);
        const compressed=await window.MingrxMedia.compressImage(source,{maxDimension:512,maxBytes:360*1024,minDimension:128});
        if(!compressed?.blob || compressed.blob.size<=0 || compressed.blob.size>360*1024) failures.push('large community photo was not compressed below 360 KB: '+(compressed?.blob?.size||0));
      } catch(error) {
        failures.push('large-photo compression failed: '+(error?.message||error));
      }

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

      // Community settings must expose an actual photo control.
      document.getElementById('serverSettingsBtn')?.click();
      await sleep(260);
      if(!document.querySelector('.mingrx-community-photo-card')) failures.push('community photo card missing from settings');
      if(![...document.querySelectorAll('.mingrx-community-photo-actions button')].some(b=>/foto/i.test(b.textContent))) failures.push('community photo action missing');
      closeModal();

      // Community image markers must render inline, not as raw marker text.
      const marker=window.MingrxMedia.encodeMedia({url:'https://example.com/screenshot.webp',name:'print.webp',caption:'Olha esse print'});
      state.viewMode='server'; state.selectedServer=server; state.selectedChannel=server.channels[0];
      state.messagesByChannel.set('general',[{id:'img1',serverId:'srv',channelId:'general',authorId:'me',text:marker,at:Date.now(),reactions:{}}]);
      renderMessages(true); await sleep(30);
      const communityImage=document.querySelector('.mingrx-chat-image-card img');
      if(!communityImage || !communityImage.src.includes('example.com/screenshot.webp')) failures.push('community inline image did not render');
      if((els.messages.textContent||'').includes('MINGRX_IMAGE_V1')) failures.push('raw community media marker leaked to UI');

      // Same marker travels through DM text; E2EE encrypts this text in the real cloud path.
      state.viewMode='dm'; state.activeDmUserId='peer'; state.selectedServer=null; state.selectedChannel=null;
      state.dmConversations=[{user:{id:'peer',name:'Gustavo',status:'online',avatar:''},lastMessage:null}];
      state.dmMessages.set('peer',[{id:'dmimg1',fromId:'me',toId:'peer',text:marker,at:Date.now(),reactions:{},e2ee:true}]);
      els.app.classList.add('dm-mode'); els.textView.classList.remove('hidden');
      renderDmMessages(true); await sleep(30);
      const dmImage=document.querySelector('.mingrx-chat-image-card img');
      if(!dmImage || !dmImage.src.includes('example.com/screenshot.webp')) failures.push('DM inline image did not render');
      if((els.messages.textContent||'').includes('MINGRX_IMAGE_V1')) failures.push('raw DM media marker leaked to UI');

      return {ok:failures.length===0,failures,elapsed,emitted:emitted.map(x=>x.event),attach:!!attach,inviteReplaced:invite?.dataset.mingrxInvite==='1'};
    })();
  `, true);

  try { win.destroy(); } catch {}
  if (!result?.ok) return fail(JSON.stringify(result));
  finish(0, `Mingrx media + invite Electron test: OK ${JSON.stringify(result)}`);
}).catch(error => fail(error?.stack || error?.message || String(error)));
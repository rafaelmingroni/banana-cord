const path = require('path');
const { app, BrowserWindow, ipcMain } = require('electron');

app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.on('window-all-closed', () => {});
const safeHandle = (name, fn) => { try { ipcMain.handle(name, fn); } catch {} };
safeHandle('clipboard:write', async () => true);
safeHandle('update:get-config', async () => ({ repoUrl:'',autoCheck:true,autoDownload:true,currentVersion:'3.1.2' }));
safeHandle('update:get-state', async () => ({ status:'idle',progress:0,message:'' }));
safeHandle('banana-updater:get-state', async () => ({ phase:'idle',version:'3.1.2',percent:0 }));
safeHandle('banana-updater:get-version', async () => '3.1.2');
safeHandle('banana-updater:check', async () => ({ ok:true }));
safeHandle('banana-v21:get-settings', async () => ({idleSeconds:0,idleState:'active',activity:null,settings:{shareActivity:true,autoAwayMinutes:5,startup:{enabled:false}},startupLaunch:false}));
safeHandle('banana-v21:set-settings', async () => ({}));
safeHandle('banana-v21:get-system-languages', async () => ['pt-BR']);

const hardTimeout = setTimeout(() => { console.error('Mingrx 3.1.2 private E2E failed: hard timeout'); app.exit(1); }, 26000);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function finish(code, message) { clearTimeout(hardTimeout); if (message) (code ? console.error : console.log)(message); setTimeout(() => app.exit(code), 50); }
const fail = message => finish(1, `Mingrx 3.1.2 private E2E failed: ${message}`);

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show:false,width:1366,height:768,webPreferences:{preload:path.join(__dirname,'..','preload.js'),nodeIntegration:false,contextIsolation:true,sandbox:true} });
  win.webContents.on('console-message', (...args) => { const d=args[1]; const message=typeof d==='object'?d.message:args[2]; if((typeof d==='object' && d.level==='error')||d===3) console.error('renderer error:',message); });
  await win.loadFile(path.join(__dirname,'..','src','index.html'));
  await sleep(400);

  const result = await win.webContents.executeJavaScript(`
    (async()=>{
      const failures=[];
      window.BananaI18n?.setLocale('pt-BR');
      const peer={id:'peer',name:'Gustavo Pioto',status:'offline',avatar:'',customStatus:''};
      const ari={id:'ari',name:'Ari',status:'online',avatar:'',customStatus:'aqui é palmeiras'};
      state.user={id:'me',name:'mingrx',status:'online',avatar:''};
      state.viewMode='dm';
      state.activeDmUserId='ari';
      state.dmUnread=new Set();
      state.dmMessages=new Map([['ari',[{id:'m1',fromId:'me',toId:'ari',text:'mensagem preservada',at:100}]]]);
      state.dmConversations=[
        {user:peer,lastMessage:{fromId:'peer',toId:'me',text:'🔒 Mensagem criptografada',at:1000,e2ee:true}},
        {user:ari,lastMessage:{fromId:'me',toId:'ari',text:'Iniciar conversa',at:900}}
      ];
      state.v1.social={friends:[peer,ari],incoming:[],outgoing:[],blocked:[]};
      state.v1.pinnedDms=new Set();
      localStorage.removeItem(window.Mingrx312?.hiddenRecentsKey || 'mingrx.hiddenDmRecents.v1');
      els.setup.classList.add('hidden');
      els.app.classList.remove('hidden');
      document.getElementById('cloudGate')?.classList.add('hidden');

      if(!window.Mingrx312) failures.push('Mingrx312 runtime missing');
      renderDmSidebar();
      await new Promise(r=>setTimeout(r,20));

      const nav=[...document.querySelectorAll('.mingrx312-private-nav button')].map(b=>String(b.textContent||'').replace(/\\s+/g,' ').trim());
      if(nav.length!==3) failures.push('private nav does not have exactly three actions: '+JSON.stringify(nav));
      if(!/Mensagens privadas/i.test(nav[0]||'') || !/Amigos/i.test(nav[1]||'') || !/Adicionar amigo/i.test(nav[2]||'')) failures.push('private nav order/labels are wrong: '+JSON.stringify(nav));
      const intro=document.querySelector('.mingrx312-private-sidebar .v214-private-intro');
      if(!intro || !/Amigos e mensagens/i.test(intro.textContent||'')) failures.push('private-space card missing');
      const tools=document.querySelector('.mingrx312-private-sidebar .v1-dm-tools');
      if(!tools || tools.getClientRects().length) failures.push('duplicate legacy navigation is still visible');
      for(const button of tools?.querySelectorAll('button')||[]) {
        if(button.getClientRects().length) failures.push('duplicate navigation button remains visible: '+button.textContent);
      }
      const quick=document.getElementById('v1FriendQuick');
      if(quick && getComputedStyle(quick).display!=='none') failures.push('legacy quick-friends list is still visible');

      let recentItems=[...document.querySelectorAll('.mingrx312-recent-item')];
      if(recentItems.length!==2) failures.push('expected two recent rows, found '+recentItems.length);
      if(recentItems.some(item=>!item.querySelector('.mingrx312-recent-remove'))) failures.push('recent row missing remove X');

      const ariItem=recentItems.find(item=>item.dataset.userId==='ari');
      const x=ariItem?.querySelector('.mingrx312-recent-remove');
      if(!x) failures.push('Ari recent remove button missing');
      else x.click();
      await new Promise(r=>setTimeout(r,10));

      if(document.querySelector('.mingrx312-recent-item[data-user-id="ari"]')) failures.push('X did not remove the recent shortcut');
      if((state.dmMessages.get('ari')||[]).length!==1 || state.dmMessages.get('ari')[0].text!=='mensagem preservada') failures.push('removing recent deleted/changed message history');
      if(state.dmConversations.length!==2) failures.push('removing recent mutated cloud conversation state');

      // A newer message should bring a locally hidden conversation back to Recents.
      state.dmConversations[1].lastMessage={fromId:'ari',toId:'me',text:'nova mensagem',at:Date.now()+10000};
      renderDmSidebar();
      await new Promise(r=>setTimeout(r,20));
      if(!document.querySelector('.mingrx312-recent-item[data-user-id="ari"]')) failures.push('new message did not restore hidden recent conversation');
      const themeSheet=document.querySelector('link[href="mingrx-obsidian.css"]');
      if(themeSheet) document.head.appendChild(themeSheet);
      window.dispatchEvent(new CustomEvent('mingrx:theme-change'));
      await new Promise(r=>setTimeout(r,30));
      if(document.querySelector('.v1-dm-tools')?.getClientRects().length) failures.push('theme refresh restored duplicate navigation');
      if(document.querySelectorAll('.mingrx312-private-nav').length!==1) failures.push('sidebar redraw duplicated primary navigation');

      const ensureSource=String(window.Mingrx312?.ensureFriendThread || '');
      if(!/socket.ensureFriendThread/.test(ensureSource)) failures.push('fresh-DM repair must delegate to bundled transport');
      if(/require\\('firebase/.test(ensureSource)) failures.push('DM repair must not load a second Firebase runtime');

      for(const tab of ['friends','add']) {
        document.querySelector('[data-mingrx312-nav="'+tab+'"]').click();
        await new Promise(r=>setTimeout(r,30));
        if(!document.querySelector('.mingrx-social-tab.active[data-mx-tab="'+tab+'"]')) failures.push('primary navigation action failed: '+tab);
        closeModal();
      }
      document.querySelector('[data-mingrx312-nav="messages"]').click();
      await new Promise(r=>setTimeout(r,30));
      if(state.viewMode!=='dm' || state.activeDmUserId) failures.push('primary messages action did not open private home');

      return {ok:failures.length===0,failures,nav,recentCount:document.querySelectorAll('.mingrx312-recent-item').length,historyCount:(state.dmMessages.get('ari')||[]).length};
    })();
  `, true);

  try { win.destroy(); } catch {}
  if (!result?.ok) return fail(JSON.stringify(result));
  finish(0, `Mingrx 3.1.2 private sidebar/DM repair E2E: OK ${JSON.stringify(result)}`);
}).catch(error => fail(error?.stack || error?.message || String(error)));

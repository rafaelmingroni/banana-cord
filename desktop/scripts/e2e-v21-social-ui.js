const path = require('path');
const { app, BrowserWindow, ipcMain } = require('electron');

app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');

ipcMain.handle('update:get-config', async () => ({ repoUrl:'', autoCheck:true, autoDownload:true, currentVersion:'2.1.0' }));
ipcMain.handle('update:get-state', async () => ({ status:'idle', progress:0, message:'' }));
ipcMain.handle('clipboard:write', async () => true);
ipcMain.handle('banana-updater:get-state', async () => ({ phase:'idle', version:'2.1.0', percent:0 }));
ipcMain.handle('banana-updater:get-version', async () => '2.1.0');
ipcMain.handle('banana-updater:check', async () => ({ ok:true }));
let socialSettings = {
  idleSeconds:0,
  idleState:'active',
  activity:{ id:'rocket-league', name:'Rocket League', startedAt:Date.now()-12*60*1000 },
  settings:{ shareActivity:true, autoAwayMinutes:5, startup:{ supported:true, enabled:true, registered:true } },
  startupLaunch:false
};
ipcMain.handle('banana-v21:get-settings', async () => socialSettings);
ipcMain.handle('banana-v21:set-settings', async (_e, next={}) => {
  socialSettings = {
    ...socialSettings,
    settings:{
      ...socialSettings.settings,
      shareActivity:next.shareActivity ?? socialSettings.settings.shareActivity,
      autoAwayMinutes:next.autoAwayMinutes ?? socialSettings.settings.autoAwayMinutes,
      startup:{ ...socialSettings.settings.startup, enabled:next.startupEnabled ?? socialSettings.settings.startup.enabled }
    },
    activity:(next.shareActivity === false ? null : socialSettings.activity)
  };
  return socialSettings;
});
ipcMain.handle('banana-v21:get-system-languages', async () => ['pt-BR','en-US']);

const hardTimeout = setTimeout(() => {
  console.error('Mingrx social UI E2E failed: hard timeout');
  app.exit(1);
}, 25000);

function finish(code, message) {
  clearTimeout(hardTimeout);
  if (message) (code === 0 ? console.log : console.error)(message);
  setTimeout(() => app.exit(code), 50);
}
function fail(message) { finish(1, `Mingrx social UI E2E failed: ${message}`); }
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Keep the harness alive until its explicit success/failure exit code runs.
app.on('window-all-closed', () => {});

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show:false,
    width:1180,
    height:760,
    webPreferences:{preload:path.join(__dirname,'..','preload.js'), nodeIntegration:false, contextIsolation:true, sandbox:true, autoplayPolicy:'no-user-gesture-required' }
  });
  win.webContents.on('console-message', (...args) => { const d=args[1]; const message=typeof d==='object'?d.message:args[2]; if((typeof d==='object' && d.level==='error')||d===3) console.error('renderer error:',message); });
  await win.loadFile(path.join(__dirname, '..', 'src', 'index.html'));
  await sleep(250);

  const result = await win.webContents.executeJavaScript(`
    (async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const handlers = new Map();
      const emitted = [];
      const fake = {
        connected:true,
        on(event, fn){ if(!handlers.has(event)) handlers.set(event,new Set()); handlers.get(event).add(fn); return this; },
        off(event, fn){ handlers.get(event)?.delete(fn); return this; },
        emit(event, payload, ack){
          emitted.push({event,payload});
          if(event==='messages:clear') ack?.({ok:true,count:Number(payload?.amount||0),mode:payload?.mode||'mine'});
          else if(event==='dm:clear') ack?.({ok:true,count:Number(payload?.amount||0),mode:'mine'});
          else ack?.({ok:true});
          return this;
        },
        trigger(event,payload){ for(const fn of handlers.get(event)||[]) fn(payload); }
      };

      const now=Date.now();
      state.user={id:'me',name:'Rafael',status:'online',avatar:''};
      state.ui.status='online';
      state.socket=fake;
      state.viewMode='server';
      state.selectedServer={
        id:'srv',name:'Mingrx Test',ownerId:'me',memberRoles:{me:'owner',peer:'admin'},
        roleColors:{owner:'#f2c94c',admin:'#c47cff',moderator:'#53b5df',member:'#d7dbe3'},
        categories:[{id:'cat_games',name:'Jogos'}],
        channels:[
          {id:'general',name:'geral',type:'text',categoryId:null,allowedRoles:[]},
          {id:'rocket',name:'rocket-league',type:'text',categoryId:'cat_games',allowedRoles:[]},
          {id:'voice',name:'Geral',type:'voice',categoryId:'cat_games',allowedRoles:[]}
        ]
      };
      state.servers=[state.selectedServer];
      state.selectedChannel=state.selectedServer.channels[0];
      state.members=new Map([
        ['me',{id:'me',name:'Rafael',role:'owner',status:'online',avatar:''}],
        ['peer',{id:'peer',name:'Gustavo Pioto',role:'admin',status:'online',avatar:'',activity:{id:'rocket-league',name:'Rocket League',startedAt:now-720000}}]
      ]);
      state.messagesByChannel.set('general',[
        {id:'mine1',serverId:'srv',channelId:'general',authorId:'me',text:'minha mensagem',at:now-2000,editedAt:null,replyToId:null,reactions:{}},
        {id:'peer1',serverId:'srv',channelId:'general',authorId:'peer',text:'https://example.com teste',at:now-1000,editedAt:null,replyToId:null,reactions:{}}
      ]);
      bindSocket(fake);
      els.setup.classList.add('hidden');
      els.app.classList.remove('hidden');
      els.emptyView.classList.add('hidden');
      els.textView.classList.remove('hidden');
      els.voiceView.classList.add('hidden');
      renderChannels();renderMembers();renderMessages(true);
      await sleep(120);

      const checks={};
      checks.channelHead=!!document.querySelector('.v21-channel-head');
      checks.category=!!document.querySelector('.v21-category[data-category-id="cat_games"]');
      checks.oldSplit=!document.querySelector('.channel-section-title');
      checks.activityMember=(document.querySelector('.v21-activity-line')?.textContent||'').includes('Rocket League');
      if(!checks.channelHead||!checks.category||!checks.oldSplit)return{ok:false,reason:'premium channel tree missing',checks};
      if(!checks.activityMember)return{ok:false,reason:'member game activity missing',checks};

      const ownRow=document.querySelector('.message[data-message-id="mine1"]');
      const initialPeerRow=document.querySelector('.message[data-message-id="peer1"]');
      if(!ownRow||!initialPeerRow)return{ok:false,reason:'decorated message rows missing'};
      if(!ownRow.querySelector('[data-v21-action="edit"]'))return{ok:false,reason:'own edit action missing'};
      if(initialPeerRow.querySelector('[data-v21-action="edit"]'))return{ok:false,reason:'owner/moderator must not edit another author message'};

      ownRow.querySelector('[data-v21-action="edit"]').click();
      await sleep(30);
      const edit=ownRow.querySelector('.v21-inline-edit textarea');
      if(!edit)return{ok:false,reason:'inline editor did not open'};
      edit.value='mensagem editada';
      edit.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
      await sleep(30);
      const editEmit=emitted.find(x=>x.event==='message:edit'&&x.payload?.messageId==='mine1');
      if(!editEmit||editEmit.payload.text!=='mensagem editada')return{ok:false,reason:'message:edit not emitted',emitted};
      fake.trigger('message:updated',{id:'mine1',serverId:'srv',channelId:'general',authorId:'me',text:'mensagem editada',at:now-2000,editedAt:Date.now(),replyToId:null,reactions:{}});
      await sleep(50);
      const editedRow=document.querySelector('.message[data-message-id="mine1"]');
      if(!(editedRow?.querySelector('.msg-text')?.textContent||'').includes('mensagem editada'))return{ok:false,reason:'message update did not reach UI'};
      if(!editedRow.querySelector('.v21-edited'))return{ok:false,reason:'edited marker missing'};

      const currentPeerRow=document.querySelector('.message[data-message-id="peer1"]');
      if(!currentPeerRow)return{ok:false,reason:'peer message disappeared during edit rerender'};
      currentPeerRow.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,clientX:500,clientY:300}));
      await sleep(20);
      const deleteMenu=document.querySelector('.v21-context-menu button.danger');
      if(!deleteMenu)return{ok:false,reason:'moderator/owner delete action missing in context menu'};
      deleteMenu.click();await sleep(20);
      document.getElementById('v21ConfirmOk')?.click();await sleep(20);
      if(!emitted.some(x=>x.event==='message:delete'&&x.payload?.messageId==='peer1'))return{ok:false,reason:'message:delete not emitted',emitted};
      fake.trigger('message:deleted',{channelId:'general',messageId:'peer1'});await sleep(40);
      if(document.querySelector('.message[data-message-id="peer1"]'))return{ok:false,reason:'deleted message remained visible'};

      els.messageInput.value='/';
      els.messageInput.dispatchEvent(new Event('input',{bubbles:true}));await sleep(20);
      if(document.getElementById('v21CommandMenu')?.classList.contains('hidden'))return{ok:false,reason:'slash command menu did not open'};
      if(![...document.querySelectorAll('[data-command]')].some(x=>x.dataset.command==='/clear'))return{ok:false,reason:'/clear missing from command autocomplete'};
      els.messageInput.value='/clear 20';
      els.messageForm.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await sleep(30);
      const clearEmit=emitted.find(x=>x.event==='messages:clear');
      if(!clearEmit||clearEmit.payload.amount!==20||clearEmit.payload.mode!=='all')return{ok:false,reason:'/clear server payload incorrect',clearEmit};

      openServerSettings();await sleep(80);
      if(document.querySelector('select.v219-role-select'))return{ok:false,reason:'native black role select still visible'};
      if(!document.querySelector('.v21-role-picker')||!document.querySelector('.v21-role-menu'))return{ok:false,reason:'custom role picker missing'};
      closeModal();

      window.BananaI18n.setLocale('pt-BR');await sleep(30);
      if(window.BananaI18n.t('settings.social')!=='Idioma e Social')return{ok:false,reason:'Portuguese locale switch failed'};
      window.BananaI18n.setLocale('en-US');await sleep(30);
      if(window.BananaI18n.t('settings.social')!=='Language & Social')return{ok:false,reason:'English locale switch failed'};
      window.BananaI18n.setLocale('es-ES');await sleep(30);
      if(window.BananaI18n.t('settings.social')!=='Idioma y Social')return{ok:false,reason:'Spanish locale switch failed'};
      window.BananaI18n.setLocale('pt-BR');

      openSettings();await sleep(80);
      if(!document.getElementById('tabV21Social'))return{ok:false,reason:'Language & Social settings tab missing'};
      document.getElementById('tabV21Social').click();await sleep(60);
      if(!document.querySelector('[data-language="pt-BR"]')||!document.getElementById('v21Startup')||!document.getElementById('v21ShareActivity'))return{ok:false,reason:'social settings controls missing'};
      if(!(document.getElementById('v21ActivityPreview')?.textContent||'').includes('Rocket League'))return{ok:false,reason:'activity settings preview missing'};
      document.getElementById('v21ShareActivity').checked=false;
      document.querySelector('[data-idle-minutes="10"]')?.click();
      document.getElementById('v21SaveSocial').click();await sleep(80);
      closeModal();

      state.viewMode='dm';state.activeDmUserId='peer';state.selectedServer=null;state.selectedChannel=null;
      state.dmConversations=[{user:{id:'peer',name:'Gustavo Pioto',status:'online'},lastMessage:null}];
      state.dmMessages.set('peer',[{id:'dm1',fromId:'me',toId:'peer',text:'segredo',at:now,editedAt:null,replyToId:null,reactions:{},e2ee:true}]);
      els.app.classList.add('dm-mode');els.textView.classList.remove('hidden');
      renderDmMessages();await sleep(50);
      const dmRow=document.querySelector('.dm-message[data-message-id="dm1"]');
      if(!dmRow?.querySelector('[data-v21-action="edit"]'))return{ok:false,reason:'encrypted DM edit action missing'};
      dmRow.querySelector('[data-v21-action="edit"]').click();await sleep(20);
      const dmEdit=dmRow.querySelector('.v21-inline-edit textarea');dmEdit.value='segredo editado';dmEdit.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));await sleep(20);
      if(!emitted.some(x=>x.event==='dm:edit'&&x.payload?.messageId==='dm1'&&x.payload?.text==='segredo editado'))return{ok:false,reason:'DM edit not emitted through E2EE-compatible path'};

      return{ok:true,checks,emitted:emitted.map(x=>x.event),locale:window.BananaI18n.getLocale(),socialSettingsControls:true};
    })();
  `, true);

  if (!result?.ok) return fail(`${result?.reason || 'unknown'} ${JSON.stringify(result || {})}`);
  console.log('Mingrx social UI Electron interaction test: OK');
  console.log(JSON.stringify(result));
  try { win.destroy(); } catch {}
  finish(0);
}).catch(error => fail(error?.stack || error?.message || String(error)));

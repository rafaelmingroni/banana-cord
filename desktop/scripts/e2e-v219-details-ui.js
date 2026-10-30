const path = require('path');
const { app, BrowserWindow, ipcMain } = require('electron');

app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');

ipcMain.handle('update:get-config', async () => ({ repoUrl:'', autoCheck:true, autoDownload:true, currentVersion:'2.0.19' }));
ipcMain.handle('update:get-state', async () => ({ status:'idle', progress:0, message:'' }));
ipcMain.handle('clipboard:write', async () => true);
ipcMain.handle('banana-updater:get-state', async () => ({ phase:'idle', version:'2.0.19', percent:0 }));
ipcMain.handle('banana-updater:get-version', async () => '2.0.19');
ipcMain.handle('banana-updater:check', async () => ({ ok:true }));

const hardTimeout = setTimeout(() => { console.error('V2.0.19 details E2E failed: hard timeout'); app.exit(1); }, 16000);
const finish = (code, msg) => { clearTimeout(hardTimeout); if (msg) (code ? console.error : console.log)(msg); setTimeout(() => app.exit(code), 50); };

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show:false, width:1200, height:760, webPreferences:{ nodeIntegration:true, contextIsolation:false, sandbox:false } });
  await win.loadFile(path.join(__dirname, '..', 'src', 'index.html'));
  await new Promise(r => setTimeout(r, 180));

  const result = await win.webContents.executeJavaScript(`
    (() => {
      const now = Date.now();
      const day = 86400000;
      state.user = { id:'me', name:'Rafael', status:'online', customStatus:'Jogando leve', role:'admin' };
      state.selectedServer = {
        id:'s1', name:'Banana Test', ownerId:'owner',
        memberRoles:{ me:'admin', admin:'admin', mod:'moderator' },
        roleColors:{ owner:'#ffaa00', admin:'#ff3366', moderator:'#33aaff', member:'#dddddd' },
        channels:[{id:'c1',name:'geral',type:'text'}]
      };
      state.selectedChannel = state.selectedServer.channels[0];
      state.viewMode = 'server';
      state.members = new Map([
        ['owner',{id:'owner',name:'Owner',status:'online',role:'owner',customStatus:'Fundador'}],
        ['admin',{id:'admin',name:'Admin',status:'online',role:'admin',customStatus:'Organizando tudo'}],
        ['mod',{id:'mod',name:'Mod',status:'online',role:'moderator'}],
        ['member',{id:'member',name:'Member',status:'online',role:'member'}],
        ['off',{id:'off',name:'Offline',status:'offline',role:'member',lastSeen:now-day}],
        ['me',state.user]
      ]);
      state.messagesByChannel.set('c1',[
        {id:'a',authorId:'owner',text:'hoje',at:now},
        {id:'b',authorId:'admin',text:'ontem',at:now-day},
        {id:'c',authorId:'mod',text:'semana',at:now-(8*day)},
        {id:'d',authorId:'member',text:'antiga',at:now-(30*day)}
      ]);
      els.app.classList.remove('hidden');
      els.textView.classList.remove('hidden');
      els.emptyView.classList.add('hidden');
      renderMessages(true);
      renderMembers();

      const dividers = [...document.querySelectorAll('.v219-date-divider span')].map(x=>x.textContent);
      const groups = [...document.querySelectorAll('.v219-member-group-title span:first-child')].map(x=>x.textContent);
      const memberRows = document.querySelectorAll('.v219-member-row').length;
      const ownerMark = document.querySelector('.v219-member-row[data-role="owner"] .v219-hierarchy-mark');
      const names = [...document.querySelectorAll('.message:not(.dm-message) .msg-head b')];
      if (!dividers.some(x=>x.startsWith('Hoje'))) return {ok:false,reason:'Hoje divider missing',dividers};
      if (!dividers.some(x=>x.startsWith('Ontem'))) return {ok:false,reason:'Ontem divider missing',dividers};
      if (!dividers.some(x=>x.includes('1 semana atrás'))) return {ok:false,reason:'weekly divider missing',dividers};
      if (dividers.length !== 4) return {ok:false,reason:'unexpected divider count',dividers};
      for (const label of ['Dono','Administradores','Moderadores','Membros','Offline']) if (!groups.includes(label)) return {ok:false,reason:'missing group '+label,groups};
      if (memberRows !== 6) return {ok:false,reason:'unexpected member row count '+memberRows};
      if (!ownerMark) return {ok:false,reason:'owner hierarchy marker missing'};
      if (names[0]?.dataset.role !== 'owner' || names[1]?.dataset.role !== 'admin') return {ok:false,reason:'message role metadata missing'};
      if (!names[0]?.style.color || !names[1]?.style.color) return {ok:false,reason:'message role colors missing'};

      openServerSettings();
      const colorInputs = [...document.querySelectorAll('.v219-role-color-input')];
      if (colorInputs.length !== 4) return {ok:false,reason:'expected four role color pickers',count:colorInputs.length};
      if (!document.querySelector('.v219-role-settings')) return {ok:false,reason:'new role settings modal missing'};
      closeModal();

      openMemberProfile('admin');
      const profile = document.querySelector('.v219-profile-card');
      const profileName = document.querySelector('.v219-profile-heading h2')?.textContent || '';
      const profileRole = document.querySelector('.v219-profile-role')?.textContent || '';
      const profileAbout = document.querySelector('.v219-profile-about p')?.textContent || '';
      if (!profile || profileName !== 'Admin') return {ok:false,reason:'rich member profile missing',profileName};
      if (!profileRole.includes('Administrador')) return {ok:false,reason:'profile role missing',profileRole};
      if (profileAbout !== 'Organizando tudo') return {ok:false,reason:'profile custom status missing',profileAbout};
      if (!document.getElementById('dmFromProfile')) return {ok:false,reason:'profile DM action missing'};
      closeModal();

      state.viewMode='dm';
      state.activeDmUserId='admin';
      state.dmConversations=[{user:{id:'admin',name:'Admin',status:'online'},lastMessage:null}];
      state.dmMessages.set('admin',[
        {id:'dm1',fromId:'me',toId:'admin',text:'oi',at:now},
        {id:'dm2',fromId:'admin',toId:'me',text:'ontem',at:now-day}
      ]);
      renderDmMessages(true);
      const dmDividers=[...document.querySelectorAll('.v219-date-divider span')].map(x=>x.textContent);
      if (dmDividers.length !== 2 || !dmDividers[0].startsWith('Hoje') || !dmDividers[1].startsWith('Ontem')) return {ok:false,reason:'DM dividers invalid',dmDividers};

      return {ok:true,dividers,groups,memberRows,dmDividers,colorInputs:colorInputs.length,profileName,profileRole};
    })();
  `, true);

  if (!result?.ok) return finish(1, `V2.0.19 details E2E failed: ${JSON.stringify(result)}`);
  console.log('Banana Cord V2.0.19 details Electron UI test: OK');
  console.log(JSON.stringify(result));
  try { win.destroy(); } catch {}
  finish(0);
}).catch(error => finish(1, `V2.0.19 details E2E failed: ${error?.stack || error}`));

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

const timeout = setTimeout(() => { console.error('Banana Cord 2.1 language E2E failed: timeout'); app.exit(1); }, 16000);
function finish(code, message) { clearTimeout(timeout); (code ? console.error : console.log)(message); setTimeout(() => app.exit(code), 40); }
function fail(message) { finish(1, `Banana Cord 2.1 language E2E failed: ${message}`); }
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Keep the harness alive until its explicit success/failure exit code runs.
app.on('window-all-closed', () => {});

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show:false,width:1000,height:700,webPreferences:{preload:path.join(__dirname,'..','preload.js'),nodeIntegration:false,contextIsolation:true,sandbox:true} });
  win.webContents.on('console-message', (...args) => { const d=args[1]; const message=typeof d==='object'?d.message:args[2]; if((typeof d==='object' && d.level==='error')||d===3) console.error('renderer error:',message); });
  await win.loadFile(path.join(__dirname,'..','src','index.html'));
  await sleep(180);
  const result = await win.webContents.executeJavaScript(`
    (async()=>{
      const sleep=ms=>new Promise(r=>setTimeout(r,ms));
      const socket={connected:true,on(){return this},off(){return this},emit(_event,_payload,ack){ack?.({ok:true});return this}};
      state.user={id:'me',name:'Rafael',status:'online',avatar:''};state.ui.status='online';state.socket=socket;state.viewMode='server';
      state.selectedServer={id:'srv',name:'Servidor Geral',ownerId:'me',memberRoles:{me:'owner'},categories:[{id:'cat',name:'Geral'}],channels:[{id:'ch',name:'Geral',type:'text',categoryId:'cat',allowedRoles:[]}]};
      state.servers=[state.selectedServer];state.selectedChannel=state.selectedServer.channels[0];state.members=new Map([['me',{id:'me',name:'Rafael',role:'owner',status:'online'}]]);
      els.setup.classList.add('hidden');els.app.classList.remove('hidden');renderChannels();await sleep(20);

      const channelName=()=>document.querySelector('.v21-channel-row .channel span:last-child')?.textContent||'';
      const categoryName=()=>document.querySelector('.v21-category-name')?.textContent||'';
      if(channelName()!=='Geral'||categoryName()!=='Geral')return{ok:false,reason:'baseline user names missing',channel:channelName(),category:categoryName()};

      window.BananaI18n.setLocale('en-US');await sleep(40);renderChannels();await sleep(20);
      if(channelName()!=='Geral'||categoryName()!=='Geral')return{ok:false,reason:'English locale translated a user channel/category name',channel:channelName(),category:categoryName()};
      openSettings();await sleep(60);
      const optionsEn=[...document.querySelectorAll('#profileStatus option')].map(o=>o.textContent.trim());
      if(optionsEn.join('|')!=='Online|Busy|Away')return{ok:false,reason:'English status options not translated',optionsEn};
      closeModal();

      window.BananaI18n.setLocale('es-ES');await sleep(40);renderChannels();await sleep(20);
      if(channelName()!=='Geral'||categoryName()!=='Geral')return{ok:false,reason:'Spanish locale translated a user channel/category name',channel:channelName(),category:categoryName()};
      openSettings();await sleep(60);
      const optionsEs=[...document.querySelectorAll('#profileStatus option')].map(o=>o.textContent.trim());
      if(optionsEs.join('|')!=='En línea|Ocupado|Ausente')return{ok:false,reason:'Spanish status options not translated',optionsEs};
      closeModal();

      window.BananaI18n.setLocale('pt-BR');await sleep(20);
      return{ok:true,optionsEn,optionsEs,channel:channelName(),category:categoryName()};
    })();
  `,true);
  if(!result?.ok)return fail(`${result?.reason||'unknown'} ${JSON.stringify(result||{})}`);
  try{win.destroy()}catch{}
  finish(0,`Banana Cord 2.1 language Electron test: OK (${result.optionsEn.join('/')}; ${result.optionsEs.join('/')}; channel=${result.channel})`);
}).catch(error=>fail(error?.stack||error?.message||String(error)));

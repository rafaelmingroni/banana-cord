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
ipcMain.handle('banana-v21:get-settings', async () => ({ idleSeconds:0,idleState:'active',activity:null,settings:{shareActivity:true,autoAwayMinutes:5,startup:{supported:true,enabled:false,registered:false}},startupLaunch:false }));
ipcMain.handle('banana-v21:set-settings', async () => ({ idleSeconds:0,idleState:'active',activity:null,settings:{shareActivity:true,autoAwayMinutes:5,startup:{supported:true,enabled:false,registered:false}},startupLaunch:false }));
ipcMain.handle('banana-v21:get-system-languages', async () => ['pt-BR']);

const hardTimeout = setTimeout(() => {
  console.error('Mingrx branding E2E failed: hard timeout');
  app.exit(1);
}, 22000);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function finish(code, message) {
  clearTimeout(hardTimeout);
  if (message) (code === 0 ? console.log : console.error)(message);
  setTimeout(() => app.exit(code), 50);
}
const fail = message => finish(1, `Mingrx branding E2E failed: ${message}`);

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show:false, width:1300, height:827, webPreferences:{preload:path.join(__dirname,'..','preload.js'), nodeIntegration:false, contextIsolation:true, sandbox:true } });
  win.webContents.on('console-message', (...args) => { const d=args[1]; const message=typeof d==='object'?d.message:args[2]; if((typeof d==='object' && d.level==='error')||d===3) console.error('renderer error:',message); });
  await win.loadFile(path.join(__dirname, '..', 'src', 'index.html'));
  await sleep(250);

  const result = await win.webContents.executeJavaScript(`
    (async()=>{
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const failures=[];
      const probe=document.createElement('span');
      probe.style.color='var(--mx-accent)';
      document.body.appendChild(probe);
      const accent=getComputedStyle(probe).color;
      probe.remove();

      const authBrand=document.querySelector('.cloud-brand');
      const authText=authBrand?.textContent||'';
      const authBananaImage=authBrand?.querySelector('img[src*="banana"]');
      const authButton=document.querySelector('#cloudLoginForm button.primary');
      const authButtonBg=authButton?getComputedStyle(authButton).backgroundColor:'';
      if(!authBrand) failures.push('auth brand missing');
      if(/banana/i.test(authText)) failures.push('auth still contains Banana branding');
      if(authBananaImage) failures.push('auth still uses banana image');
      if(!/mingrx/i.test(authText)) failures.push('auth does not show Mingrx');
      if(authButtonBg!==accent) failures.push('auth primary button is not using Mingrx accent: '+authButtonBg+' vs '+accent);

      const handlers=new Map();
      const fake={
        connected:true,
        on(event,fn){if(!handlers.has(event))handlers.set(event,new Set());handlers.get(event).add(fn);return this;},
        off(event,fn){handlers.get(event)?.delete(fn);return this;},
        disconnect(){this.connected=false;return this;},
        trigger(event,payload){for(const fn of handlers.get(event)||[])fn(payload);},
        emit(event,payload,ack){
          if(event==='dm:conversations:get') queueMicrotask(()=>this.trigger('dm:conversations',{conversations:[]}));
          ack?.({ok:true,users:[]});
          return this;
        }
      };

      document.getElementById('cloudGate')?.classList.add('hidden');
      if(!window.BananaLegacy?.attachSocket) failures.push('cloud bridge missing');
      else {
        window.BananaLegacy.attachSocket(fake,{uid:'me',displayName:'Rafael',emailVerified:true});
        fake.trigger('auth:ready',{user:{id:'me',name:'Rafael',status:'online',avatar:''},servers:[]});
        await sleep(120);
      }

      if(String(state.serverUrl||'')!=='mingrx-cloud://firebase') failures.push('cloud state still uses legacy serverUrl: '+String(state.serverUrl||''));

      state.v1=state.v1||{};
      state.v1.social=state.v1.social||{friends:[],incoming:[],outgoing:[],blocked:[]};
      state.v1.social.friends=[{id:'peer',name:'Gustavo',status:'online',avatar:''}];
      state.v1.social.incoming=[];state.v1.social.outgoing=[];state.v1.social.blocked=[];
      if(typeof showDmHome==='function') showDmHome();
      await sleep(80);
      const rect=el=>{const r=el?.getBoundingClientRect?.();return r?{width:r.width,left:r.left,right:r.right}:null};
      const sidebar=rect(document.querySelector('.sidebar'));
      const dm=rect(document.querySelector('.dm-sidebar'));
      const intro=rect(document.querySelector('.v214-private-intro'));
      if(!sidebar||sidebar.width<280) failures.push('private outer sidebar collapsed: '+JSON.stringify(sidebar));
      if(!dm||dm.width<250) failures.push('private inner dm-sidebar collapsed: '+JSON.stringify(dm));
      if(!intro||intro.width<220) failures.push('private intro collapsed: '+JSON.stringify(intro));

      document.getElementById('profileBtn')?.click();
      await sleep(140);
      const shell=document.querySelector('.settings-shell');
      if(!shell) failures.push('settings did not open');
      else {
        const tabs=['tabProfile','tabAudio','tabVideo','tabGeneral','tabDiag','tabNotifications','tabUpdates'];
        let sawCloud=false;
        for(const id of tabs){
          document.getElementById(id)?.click();
          await sleep(45);
          window.MingrxRepairBranding?.();
          await sleep(10);
          const text=shell.textContent||'';
          const lower=text.toLowerCase();
          if(lower.includes('banana cord')||lower.includes('banana cloud')||lower.includes('banana-cloud://firebase')) failures.push('settings legacy branding in '+id+': '+text.slice(0,240));
          if(lower.includes('mingrx cloud')) sawCloud=true;
          if(shell.querySelector('img[src*="banana-cord"],img[alt*="Banana"]')) failures.push('settings banana image in '+id);
          if(shell.querySelector('.settings-brand,.settings-nav-foot,.version-label')) failures.push('legacy settings brand/version node in '+id);
          if(shell.querySelectorAll('.mingrx-settings-brand').length!==1) failures.push('Mingrx settings brand count invalid in '+id);
        }
        if(!sawCloud) failures.push('settings never exposed Mingrx Cloud connection label');
      }

      return {ok:failures.length===0,failures,accent,authButtonBg,sidebar,dm,intro,serverUrl:String(state.serverUrl||'')};
    })();
  `, true);

  try { win.destroy(); } catch {}
  if(!result?.ok) return fail(JSON.stringify(result));
  finish(0, `Mingrx auth/settings/private branding test: OK ${JSON.stringify(result)}`);
}).catch(error => fail(error?.stack || error?.message || String(error)));

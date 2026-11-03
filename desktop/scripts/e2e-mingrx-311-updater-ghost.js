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

const timeout = setTimeout(() => { console.error('Mingrx 3.1.1 updater ghost E2E failed: timeout'); app.exit(1); }, 22000);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const finish = (code, text) => { clearTimeout(timeout); (code ? console.error : console.log)(text); setTimeout(() => app.exit(code), 50); };

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show:false,width:1200,height:760,webPreferences:{nodeIntegration:true,contextIsolation:false,sandbox:false} });
  await win.loadFile(path.join(__dirname,'..','src','index.html'));
  await sleep(350);

  const result = await win.webContents.executeJavaScript(`
    (()=>{
      const failures=[];
      const server={id:'srv',name:'GZ E MINGRX',ownerId:'me',memberRoles:{me:'owner',peer:'member'},categories:[],channels:[{id:'voice',name:'Geral',type:'voice',categoryId:null,allowedRoles:[]}]};
      state.user={id:'me',name:'Rafael',avatar:'',status:'online'};
      state.servers=[server];
      state.selectedServer=server;
      state.selectedChannel=server.channels[0];
      state.viewMode='server';
      state.socket={id:'socket-me',voiceServerState:new Map([['srv',new Map([
        ['socket-me',{userId:'me',user:{id:'me',name:'Rafael'},channelId:'voice'}],
        ['stale-updater-socket',{userId:'peer',user:{id:'peer',name:'Gustavo'},channelId:'voice'}]
      ])]])};
      state.members=new Map([
        ['me',{id:'me',name:'Rafael',role:'owner',avatar:'',status:'online'}],
        ['peer',{id:'peer',name:'Gustavo',role:'member',avatar:'',status:'online'}]
      ]);
      state.voice.serverId='srv';
      state.voice.channelId='voice';
      state.voice.peers=new Map();
      state.voicePresence.set('voice',[
        {socketId:'socket-me',userId:'me',user:{id:'me',name:'Rafael'},mediaState:{},speaking:false},
        {socketId:'stale-updater-socket',userId:'peer',user:{id:'peer',name:'Gustavo'},mediaState:{},speaking:false}
      ]);

      if(!window.Mingrx311Followup?.pruneOrphanVoiceRows) failures.push('updater ghost follow-up runtime missing');
      const changed=window.Mingrx311Followup?.pruneOrphanVoiceRows?.({force:true});
      const rows=state.voicePresence.get('voice')||[];
      if(!changed) failures.push('stale updater row was not detected');
      if(rows.some(row=>String(row.userId||row.user?.id)==='peer')) failures.push('stale Firebase voice row remained visible after updater disconnect');
      if(!rows.some(row=>String(row.userId||row.user?.id)==='me')) failures.push('real local participant was removed with the ghost');

      // Photo compatibility: real img plus background fallback must coexist.
      const icon='data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEAAQAcJaQAA3AA/v89WAAAAA==';
      server.icon=icon;
      renderServers();
      const button=document.querySelector('#serverList [data-server-id="srv"]');
      if(!button?.querySelector('.mingrx311-server-photo')) failures.push('server photo real img missing');
      if(!String(button?.style.backgroundImage||'').includes('data:image/webp;base64')) failures.push('server photo background compatibility missing');

      return {ok:failures.length===0,failures,rows:rows.map(row=>row.user?.name||row.userId),hasImg:!!button?.querySelector('.mingrx311-server-photo'),background:String(button?.style.backgroundImage||'').slice(0,40)};
    })();
  `, true);

  try { win.destroy(); } catch {}
  if (!result?.ok) return finish(1, `Mingrx 3.1.1 updater ghost E2E failed: ${JSON.stringify(result)}`);
  finish(0, `Mingrx 3.1.1 updater ghost E2E: OK ${JSON.stringify(result)}`);
}).catch(error => finish(1, `Mingrx 3.1.1 updater ghost E2E failed: ${error?.stack || error}`));

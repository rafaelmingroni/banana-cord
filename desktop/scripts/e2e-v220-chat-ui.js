const path = require('path');
const { app, BrowserWindow, ipcMain } = require('electron');

app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');

ipcMain.handle('update:get-config', async () => ({ repoUrl:'', autoCheck:true, autoDownload:true, currentVersion:'2.0.20' }));
ipcMain.handle('update:get-state', async () => ({ status:'idle', progress:0, message:'' }));
ipcMain.handle('clipboard:write', async () => true);
ipcMain.handle('banana-updater:get-state', async () => ({ phase:'idle', version:'2.0.20', percent:0 }));
ipcMain.handle('banana-updater:get-version', async () => '2.0.20');
ipcMain.handle('banana-updater:check', async () => ({ ok:true }));

const hardTimeout = setTimeout(() => {
  console.error('V2.0.20 chat E2E failed: hard timeout');
  app.exit(1);
}, 18000);

function finish(code, message) {
  clearTimeout(hardTimeout);
  if (message) (code === 0 ? console.log : console.error)(message);
  setTimeout(() => app.exit(code), 50);
}
function fail(message) { finish(1, `V2.0.20 chat E2E failed: ${message}`); }
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show:false,
    width:1180,
    height:720,
    webPreferences:{ nodeIntegration:true, contextIsolation:false, sandbox:false }
  });
  await win.loadFile(path.join(__dirname, '..', 'src', 'index.html'));
  await sleep(180);

  const result = await win.webContents.executeJavaScript(`
    (async () => {
      const now = Date.now();
      state.user = { id:'me', name:'Rafael', status:'online' };
      state.viewMode = 'server';
      state.selectedServer = {
        id:'srv', name:'Teste', ownerId:'me', memberRoles:{ me:'owner', peer:'admin' },
        channels:[{ id:'general', name:'geral', type:'text' }]
      };
      state.selectedChannel = state.selectedServer.channels[0];
      state.members = new Map([
        ['me',{ id:'me', name:'Rafael', role:'owner', status:'online' }],
        ['peer',{ id:'peer', name:'Gustavo Pioto', role:'admin', status:'online' }]
      ]);
      state.messagesByChannel.set('general', Array.from({length:180}, (_,i) => ({
        id:'m'+i,
        channelId:'general',
        authorId:'peer',
        text:'Mensagem de stress '+i+' '.repeat(i % 7),
        at:now - (180-i)*1000
      })));

      els.setup.classList.add('hidden');
      els.app.classList.remove('hidden');
      els.emptyView.classList.add('hidden');
      els.textView.classList.remove('hidden');
      els.voiceView.classList.add('hidden');
      renderChannels();
      renderMembers();
      renderMessages(true);
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

      const appRect = els.app.getBoundingClientRect();
      const main = document.querySelector('.main');
      const mainRect = main.getBoundingClientRect();
      const channelsRect = els.channels.getBoundingClientRect();
      const composer = document.getElementById('messageForm');
      const composerRect = composer.getBoundingClientRect();
      const messagesRect = els.messages.getBoundingClientRect();
      const serverTitleRect = document.querySelector('.server-title').getBoundingClientRect();

      if (Math.abs(appRect.height - innerHeight) > 2) return {ok:false,reason:'app height escaped viewport',appRect,innerHeight};
      if (mainRect.bottom > innerHeight + 2 || mainRect.top < -1) return {ok:false,reason:'main escaped viewport',mainRect,innerHeight};
      if (composerRect.bottom > innerHeight + 2 || composerRect.height < 25) return {ok:false,reason:'composer not visible',composerRect,innerHeight};
      if (channelsRect.height < 100 || serverTitleRect.top < -1) return {ok:false,reason:'channels/sidebar displaced',channelsRect,serverTitleRect};
      if (!(els.messages.scrollHeight > els.messages.clientHeight)) return {ok:false,reason:'messages did not become independently scrollable',scrollHeight:els.messages.scrollHeight,clientHeight:els.messages.clientHeight};
      if (messagesRect.bottom > composerRect.top + 2) return {ok:false,reason:'messages overlap composer',messagesRect,composerRect};

      const bottom = els.messages.scrollTop;
      els.messages.scrollTop = 0;
      await new Promise(r => requestAnimationFrame(r));
      if (els.messages.scrollTop !== 0) return {ok:false,reason:'cannot scroll chat to top',scrollTop:els.messages.scrollTop};
      els.messages.scrollTop = bottom;

      return {
        ok:true,
        innerHeight,
        appHeight:appRect.height,
        mainHeight:mainRect.height,
        messagesClientHeight:els.messages.clientHeight,
        messagesScrollHeight:els.messages.scrollHeight,
        composerBottom:composerRect.bottom,
        channelsHeight:channelsRect.height
      };
    })();
  `, true);

  if (!result?.ok) return fail(`${result?.reason || 'unknown'} ${JSON.stringify(result || {})}`);
  console.log('Banana Cord V2.0.20 chat viewport stress test: OK');
  console.log(JSON.stringify(result));
  try { win.destroy(); } catch {}
  finish(0);
}).catch(error => fail(error?.stack || error?.message || String(error)));

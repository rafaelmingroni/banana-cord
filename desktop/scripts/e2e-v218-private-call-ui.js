const path = require('path');
const { app, BrowserWindow, ipcMain } = require('electron');

app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');

ipcMain.handle('update:get-config', async () => ({ repoUrl: 'https://github.com/rafaelmingroni/banana-cord', autoCheck: true, autoDownload: true, currentVersion: '2.0.18' }));
ipcMain.handle('update:get-state', async () => ({ status: 'idle', progress: 0, message: '' }));
ipcMain.handle('clipboard:write', async () => true);
ipcMain.handle('banana-updater:get-state', async () => ({ phase: 'idle', version: '2.0.18', percent: 0 }));
ipcMain.handle('banana-updater:get-version', async () => '2.0.18');
ipcMain.handle('banana-updater:check', async () => ({ ok: true }));

const hardTimeout = setTimeout(() => {
  console.error('V2.0.18 private/call E2E failed: hard timeout');
  app.exit(1);
}, 18000);

function finish(code, message) {
  clearTimeout(hardTimeout);
  if (message) (code === 0 ? console.log : console.error)(message);
  setTimeout(() => app.exit(code), 50);
}
function fail(message) { finish(1, `V2.0.18 private/call E2E failed: ${message}`); }
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    width: 900,
    height: 600,
    webPreferences: { nodeIntegration: true, contextIsolation: false, sandbox: false, autoplayPolicy: 'no-user-gesture-required' }
  });

  await win.loadFile(path.join(__dirname, '..', 'src', 'index.html'));
  await sleep(180);

  const result = await win.webContents.executeJavaScript(`
    (async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const handlers = new Map();
      const emitted = [];
      const fake = {
        connected: true,
        on(event, fn) { if (!handlers.has(event)) handlers.set(event, new Set()); handlers.get(event).add(fn); return this; },
        off(event, fn) { handlers.get(event)?.delete(fn); return this; },
        emit(event, payload, ack) { emitted.push({ event, payload }); ack?.({ ok: true }); return this; },
        trigger(event, payload) { for (const fn of handlers.get(event) || []) fn(payload); }
      };

      state.user = { id: 'me', name: 'Rafael', avatar: '', status: 'online' };
      state.viewMode = 'dm';
      state.activeDmUserId = 'peer';
      state.dmConversations = [{ user: { id: 'peer', name: 'Gustavo Pioto', avatar: '', status: 'online' }, lastMessage: null }];
      state.dmMessages.set('peer', [{ id: 'm1', fromId: 'peer', toId: 'me', text: 'oi', at: Date.now() }]);
      state.v1.social.friends = [{ id: 'peer', name: 'Gustavo Pioto', avatar: '', status: 'online' }];
      state.e2ee = state.e2ee || { localAvailable: true, byUser: new Map() };
      state.e2ee.byUser.set('peer', { userId: 'peer', available: true });
      state.socket = fake;
      bindSocket(fake);

      els.setup.classList.add('hidden');
      els.app.classList.remove('hidden');
      els.app.classList.add('dm-mode');
      els.textView.classList.remove('hidden');
      els.emptyView.classList.add('hidden');
      els.voiceView.classList.add('hidden');
      renderDmSidebar();
      renderDmMessages();
      await sleep(100);

      const composerRect = els.messageForm.getBoundingClientRect();
      const mainRect = els.main.getBoundingClientRect();
      const inputRect = els.messageInput.getBoundingClientRect();
      const responsive = {
        innerWidth,
        innerHeight,
        composerBottom: composerRect.bottom,
        composerTop: composerRect.top,
        composerHeight: composerRect.height,
        inputWidth: inputRect.width,
        mainRight: mainRect.right,
        mainLeft: mainRect.left,
        mainWidth: mainRect.width
      };
      if (composerRect.height < 25 || inputRect.width < 80) return { ok:false, reason:'composer collapsed', responsive };
      if (composerRect.bottom > innerHeight + 2 || composerRect.top < 0) return { ok:false, reason:'composer outside window', responsive };
      if (mainRect.right > innerWidth + 2 || mainRect.width < 250) return { ok:false, reason:'DM main outside responsive grid', responsive };

      fake.trigger('dm:call-state', { calls: [{ peerId: 'peer', activeCall: { id: 'call1', startedBy: 'peer', startedAt: Date.now() } }] });
      await sleep(120);
      const incoming = {
        visible: !document.getElementById('v218IncomingCall')?.classList.contains('hidden'),
        name: document.getElementById('v218IncomingName')?.textContent || '',
        accept: document.getElementById('v218AcceptCall')?.textContent || '',
        decline: document.getElementById('v218DeclineCall')?.textContent || ''
      };
      if (!incoming.visible || incoming.name !== 'Gustavo Pioto') return { ok:false, reason:'incoming call notification missing', incoming };
      if (!incoming.accept.includes('Atender') || !incoming.decline.includes('Recusar')) return { ok:false, reason:'incoming call actions missing', incoming };

      document.getElementById('v218DeclineCall').click();
      await sleep(60);
      if (!emitted.some(x => x.event === 'dm:call:end' && x.payload?.userId === 'peer')) return { ok:false, reason:'decline did not emit dm:call:end', emitted };
      if (!document.getElementById('v218IncomingCall').classList.contains('hidden')) return { ok:false, reason:'incoming call did not close after decline' };

      state.voice.channelId = 'direct';
      state.voice.directPeerId = 'peer';
      state.voice.serverId = 'dm_me_peer';
      state.voice.muted = false;
      state.voice.speaking = false;
      state.voice.peers = new Map([['sock-peer', { user: { id:'peer', name:'Gustavo Pioto' }, speaking:true, mediaState:{ muted:false } }]]);
      await sleep(360);

      const active = {
        visible: !document.getElementById('v218ActiveCall')?.classList.contains('hidden'),
        title: document.getElementById('v218ActiveTitle')?.textContent || '',
        status: document.getElementById('v218ActiveStatus')?.textContent || '',
        time: document.getElementById('v218CallTime')?.textContent || ''
      };
      if (!active.visible || !active.title.includes('Gustavo Pioto')) return { ok:false, reason:'active call bar missing', active };
      if (!active.status.includes('Gustavo Pioto') || !active.status.includes('falando')) return { ok:false, reason:'remote speaking indicator missing', active };

      state.voice.peers.get('sock-peer').speaking = false;
      state.voice.speaking = true;
      await sleep(320);
      const localStatus = document.getElementById('v218ActiveStatus')?.textContent || '';
      if (localStatus !== 'Você está falando') return { ok:false, reason:'local speaking indicator missing: ' + localStatus };

      const bannerText = document.querySelector('.v216-e2ee-banner')?.textContent || '';
      if (bannerText.includes('Firebase')) return { ok:false, reason:'technical Firebase wording still visible' };
      if (!bannerText.includes('Só você e seu contato')) return { ok:false, reason:'plain-language protection copy missing: ' + bannerText };

      return { ok:true, responsive, incoming, active, localStatus, bannerText };
    })();
  `, true);

  if (!result?.ok) return fail(`${result?.reason || 'unknown'} ${JSON.stringify(result || {})}`);
  console.log('Banana Cord V2.0.18 private/call Electron UI test: OK');
  console.log(JSON.stringify(result));
  try { win.destroy(); } catch {}
  finish(0);
}).catch(error => fail(error?.stack || error?.message || String(error)));

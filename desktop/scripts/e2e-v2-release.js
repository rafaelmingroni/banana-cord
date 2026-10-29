const path = require('path');
const { app, BrowserWindow, ipcMain } = require('electron');

app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');

ipcMain.handle('update:get-config', async () => ({ repoUrl: 'https://github.com/rafaelmingroni/banana-cord', autoCheck: true, autoDownload: true, currentVersion: '2.0.0' }));
ipcMain.handle('update:get-state', async () => ({ status: 'idle', progress: 0, message: '' }));
ipcMain.handle('clipboard:write', async () => true);

const hardTimeout = setTimeout(() => {
  console.error('V2 release E2E failed: hard timeout');
  app.exit(1);
}, 20000);

function finish(code, message) {
  clearTimeout(hardTimeout);
  if (message) (code === 0 ? console.log : console.error)(message);
  setTimeout(() => app.exit(code), 50);
}
function fail(message) { finish(1, `V2 release E2E failed: ${message}`); }

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    width: 1200,
    height: 800,
    webPreferences: { nodeIntegration: true, contextIsolation: false, sandbox: false, autoplayPolicy: 'no-user-gesture-required' }
  });

  await win.loadFile(path.join(__dirname, '..', 'src', 'index.html'));

  const result = await Promise.race([
    win.webContents.executeJavaScript(`
      (async () => {
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const emitted = [];
        const handlers = new Map();
        const fake = {
          connected: true,
          on(event, fn) { if (!handlers.has(event)) handlers.set(event, new Set()); handlers.get(event).add(fn); return this; },
          off(event, fn) { handlers.get(event)?.delete(fn); return this; },
          disconnect() { this.connected = false; return this; },
          trigger(event, payload) { for (const fn of handlers.get(event) || []) fn(payload); },
          emit(event, payload, ack) {
            emitted.push({ event, payload });
            if (event === 'dm:conversations:get') queueMicrotask(() => this.trigger('dm:conversations', { conversations: [] }));
            if (event === 'members:get') queueMicrotask(() => this.trigger('members:list', { serverId: payload.serverId, members: [{ id: 'u-e2e', name: 'E2E User', role: 'owner', status: 'online', avatar: '' }] }));
            if (event === 'messages:load') queueMicrotask(() => this.trigger('messages:list', { serverId: payload.serverId, channelId: payload.channelId, messages: [] }));
            if (event === 'server:create') {
              const server = { id: 'srv-e2e', name: payload.name, icon: '', ownerId: 'u-e2e', inviteCode: 'ABCD1234', members: ['u-e2e'], memberRoles: { 'u-e2e': 'owner' }, categories: [], channels: [
                { id: 'general', type: 'text', name: 'geral', categoryId: null, allowedRoles: [] },
                { id: 'voice-general', type: 'voice', name: 'Geral', categoryId: null, allowedRoles: [] }
              ]};
              queueMicrotask(() => this.trigger('server:created', server));
            }
            ack?.({ ok: true });
            return this;
          }
        };

        document.getElementById('cloudGate')?.classList.add('hidden');
        if (!window.BananaLegacy?.attachSocket) return { ok: false, reason: 'BananaLegacy bridge unavailable' };
        window.BananaLegacy.attachSocket(fake, { uid: 'u-e2e', displayName: 'E2E User', emailVerified: true });
        fake.trigger('auth:ready', { user: { id: 'u-e2e', name: 'E2E User', status: 'online', avatar: '' }, servers: [] });
        await sleep(60);

        if (document.getElementById('app')?.classList.contains('hidden')) return { ok: false, reason: 'app shell remained hidden after auth' };

        document.getElementById('profileBtn')?.click();
        await sleep(120);
        const shell = document.querySelector('#modalBody .settings-shell');
        if (!shell) return { ok: false, reason: 'settings did not open' };
        const versionFoot = document.querySelector('.settings-nav-foot')?.textContent || '';
        if (versionFoot !== 'v2.0.0') return { ok: false, reason: 'official version label incorrect: ' + versionFoot };

        const tabs = ['tabProfile','tabAudio','tabVideo','tabGeneral','tabDiag','tabNotifications','tabUpdates'];
        for (const id of tabs) {
          const tab = document.getElementById(id);
          if (!tab) return { ok: false, reason: 'settings tab missing: ' + id };
          tab.click(); await sleep(45);
          if (!(document.getElementById('settingsArea')?.textContent || '').trim()) return { ok: false, reason: 'empty settings tab: ' + id };
        }

        document.getElementById('tabVideo')?.click(); await sleep(60);
        const scroller = document.querySelector('.settings-content');
        const range = (scroller?.scrollHeight || 0) - (scroller?.clientHeight || 0);
        if (!scroller || !['auto','scroll'].includes(getComputedStyle(scroller).overflowY) || range <= 0) return { ok: false, reason: 'settings scroll regression' };
        scroller.scrollTop = range; await sleep(20);
        if (scroller.scrollTop < Math.max(1, range - 2)) return { ok: false, reason: 'settings cannot reach bottom' };

        document.getElementById('tabNotifications')?.click(); await sleep(50);
        for (const id of ['soundMaster','soundCall','soundPeople','soundMute','soundDeafen','soundDm','soundVolume','testNotificationSound','saveNotificationSounds']) {
          if (!document.getElementById(id)) return { ok: false, reason: 'notification control missing: ' + id };
        }
        document.getElementById('soundMute').checked = true;
        document.getElementById('soundDeafen').checked = true;
        document.getElementById('saveNotificationSounds').click();
        await sleep(20);
        document.getElementById('modalClose')?.click();

        const played = [];
        if (!window.BananaNotificationSounds) return { ok: false, reason: 'notification sound engine missing' };
        window.BananaNotificationSounds.play = kind => played.push(kind);
        state.voice.channelId = 'voice-general';
        state.voice.serverId = 'srv-e2e';
        state.voice.localAudio = null;
        state.voice.muted = false;
        state.voice.deafened = false;

        document.getElementById('muteBtn')?.click(); await sleep(25);
        document.getElementById('muteBtn')?.click(); await sleep(25);
        document.getElementById('deafenBtn')?.click(); await sleep(25);
        document.getElementById('deafenBtn')?.click(); await sleep(25);
        if (!played.includes('mute') || !played.includes('unmute')) return { ok: false, reason: 'mute/unmute button sounds did not fire: ' + played.join(',') };
        if (!played.includes('deafen') || !played.includes('undeafen')) return { ok: false, reason: 'deafen button sounds did not fire: ' + played.join(',') };

        state.voice.screen = { getTracks: () => [], getAudioTracks: () => [], getVideoTracks: () => [] };
        if (typeof addLocalCard !== 'function' || typeof updateLocalVideo !== 'function') return { ok: false, reason: 'local video renderer missing' };
        addLocalCard(); updateLocalVideo(); await sleep(20);
        const localCard = document.getElementById('video-local');
        const localVideo = localCard?.querySelector('video');
        if (!localCard?.classList.contains('self-share-safe') || localVideo?.style.display !== 'none' || localVideo?.srcObject) return { ok: false, reason: 'self-share recursion guard failed' };
        state.voice.screen = null; updateLocalVideo();
        state.voice.channelId = null; state.voice.serverId = null;

        document.getElementById('addServerBtn')?.click(); await sleep(30);
        const input = document.getElementById('newServerName');
        const create = document.getElementById('createServerNow');
        if (!input || !create) return { ok: false, reason: 'create server modal missing' };
        input.value = 'Servidor E2E'; create.click(); await sleep(70);
        if (!emitted.some(x => x.event === 'server:create' && x.payload?.name === 'Servidor E2E')) return { ok: false, reason: 'server:create was not emitted' };

        return { ok: true, versionFoot, tabs, played, settingsScrollRange: range, selfShareSafe: true };
      })();
    `, true),
    new Promise(resolve => setTimeout(() => resolve({ ok: false, reason: 'renderer interaction timeout' }), 12000))
  ]);

  if (!result?.ok) return fail(result?.reason || 'unknown renderer failure');
  console.log('Banana Cord V2.0.0 release Electron interaction test: OK');
  console.log(JSON.stringify(result));
  try { win.destroy(); } catch {}
  finish(0);
}).catch(error => fail(error?.stack || error?.message || String(error)));

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
}, 26000);

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
            if (event === 'private-call:start') {
              ack?.({ ok: true, inviteId: 'pv-e2e', roomId: 'pv-e2e', peer: { id: payload.userId, name: 'Amigo E2E', avatar: '' } });
              return this;
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
        input.value = 'Servidor E2E'; create.click(); await sleep(90);
        if (!emitted.some(x => x.event === 'server:create' && x.payload?.name === 'Servidor E2E')) return { ok: false, reason: 'server:create was not emitted' };

        const server = state.servers.find(s => s.id === 'srv-e2e');
        if (!server) return { ok: false, reason: 'E2E server was not selected/created' };

        // V2.0.12: URLs rendered as messages must become real clickable links.
        selectServer('srv-e2e');
        selectChannel('general');
        // Let the initial messages:load empty snapshot settle before injecting the
        // message under test; otherwise the fake transport can erase it in a microtask.
        await sleep(25);
        fake.trigger('messages:list', {
          serverId: 'srv-e2e', channelId: 'general',
          messages: [{ id: 'link-e2e', authorId: 'u-e2e', authorName: 'E2E User', text: 'Veja https://example.com/teste', at: Date.now(), reactions: {} }]
        });
        await sleep(50);
        const messageLink = document.querySelector('.msg-text a.v212-message-link');
        if (!messageLink || messageLink.getAttribute('href') !== 'https://example.com/teste') return { ok: false, reason: 'V2.0.12 message linkification failed' };

        // V2.0.12: private tab must survive late server updates without becoming a server sidebar.
        document.getElementById('homeServer')?.click();
        await sleep(50);
        fake.trigger('server:updated', { ...server, name: 'Servidor E2E atualizado' });
        await sleep(60);
        if (state.viewMode !== 'dm' || document.getElementById('serverName')?.textContent !== 'Privado' || !document.querySelector('#channels .dm-sidebar')) {
          return { ok: false, reason: 'V2.0.12 private tab was overwritten by a server update' };
        }

        // V2.0.12: a DM exposes the private-call action and starts a call request.
        startDm('friend-e2e', { id: 'friend-e2e', name: 'Amigo E2E', avatar: '', status: 'online' });
        await sleep(50);
        const privateCallButton = document.getElementById('v212PrivateCallBtn');
        if (!privateCallButton || privateCallButton.classList.contains('hidden')) return { ok: false, reason: 'private call button missing from DM' };
        privateCallButton.click();
        await sleep(50);
        if (!emitted.some(x => x.event === 'private-call:start' && x.payload?.userId === 'friend-e2e')) return { ok: false, reason: 'private-call:start was not emitted' };
        if (!document.getElementById('v212CallCard')) return { ok: false, reason: 'outgoing private call card did not render' };
        document.querySelector('#v212CallCard .v212-call-cancel')?.click();
        await sleep(20);

        // V2.0.12: double-clicking a voice channel joins immediately.
        selectServer('srv-e2e');
        await sleep(40);
        try {
          Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: async () => new MediaStream() } });
        } catch {}
        const voiceRow = document.querySelector('.channel-row[data-channel-id="voice-general"]');
        if (!voiceRow) return { ok: false, reason: 'voice channel row missing for double-click test' };
        const joinsBefore = emitted.filter(x => x.event === 'voice:join').length;
        voiceRow.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
        await sleep(120);
        const joinsAfter = emitted.filter(x => x.event === 'voice:join').length;
        if (joinsAfter !== joinsBefore + 1) return { ok: false, reason: 'double-click did not join voice immediately' };
        await leaveVoice();

        // V2.0.12: role hierarchy is enforced again inside joinVoice, not only in the UI.
        server.ownerId = 'another-owner';
        server.memberRoles['u-e2e'] = 'member';
        const restricted = server.channels.find(c => c.id === 'voice-general');
        restricted.allowedRoles = ['admin'];
        state.selectedServer = server;
        state.selectedChannel = restricted;
        const deniedBefore = emitted.filter(x => x.event === 'voice:join').length;
        await joinVoice(restricted);
        await sleep(30);
        const deniedAfter = emitted.filter(x => x.event === 'voice:join').length;
        if (deniedAfter !== deniedBefore || state.voice.channelId) return { ok: false, reason: 'restricted voice channel bypassed hierarchical join guard' };

        return {
          ok: true,
          versionFoot,
          tabs,
          played,
          settingsScrollRange: range,
          selfShareSafe: true,
          clickableLinks: true,
          privateTabStable: true,
          privateCallAction: true,
          voiceDoubleClick: true,
          hierarchicalVoiceGuard: true
        };
      })();
    `, true),
    new Promise(resolve => setTimeout(() => resolve({ ok: false, reason: 'renderer interaction timeout' }), 18000))
  ]);

  if (!result?.ok) return fail(result?.reason || 'unknown renderer failure');
  console.log('Banana Cord V2 release Electron interaction test: OK');
  console.log(JSON.stringify(result));
  try { win.destroy(); } catch {}
  finish(0);
}).catch(error => fail(error?.stack || error?.message || String(error)));

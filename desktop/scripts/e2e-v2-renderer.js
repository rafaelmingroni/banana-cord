const path = require('path');
const { app, BrowserWindow } = require('electron');

app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');

const hardTimeout = setTimeout(() => {
  console.error('V2 Electron E2E failed: hard timeout');
  app.exit(1);
}, 20000);

function finish(code, message) {
  clearTimeout(hardTimeout);
  if (message) (code === 0 ? console.log : console.error)(message);
  setTimeout(() => app.exit(code), 50);
}

function fail(message) {
  finish(1, `V2 Electron E2E failed: ${message}`);
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      sandbox: false,
      autoplayPolicy: 'no-user-gesture-required'
    }
  });

  win.webContents.on('console-message', (_event, level, message) => {
    if (level >= 3) console.error(`[renderer] ${message}`);
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
          on(event, fn) {
            if (!handlers.has(event)) handlers.set(event, new Set());
            handlers.get(event).add(fn);
            return this;
          },
          off(event, fn) { handlers.get(event)?.delete(fn); return this; },
          disconnect() { this.connected = false; },
          trigger(event, payload) {
            for (const fn of handlers.get(event) || []) fn(payload);
          },
          emit(event, payload, ack) {
            emitted.push({ event, payload });
            if (event === 'latency:ping') { ack?.(); return this; }
            if (event === 'dm:conversations:get') {
              queueMicrotask(() => this.trigger('dm:conversations', { conversations: [] }));
              return this;
            }
            if (event === 'members:get') {
              queueMicrotask(() => this.trigger('members:list', {
                serverId: payload.serverId,
                members: [{ id: 'u-e2e', name: 'E2E User', role: 'owner', status: 'online', avatar: '' }]
              }));
              return this;
            }
            if (event === 'messages:load') {
              queueMicrotask(() => this.trigger('messages:list', {
                serverId: payload.serverId,
                channelId: payload.channelId,
                messages: []
              }));
              return this;
            }
            if (event === 'server:create') {
              const server = {
                id: 'srv-e2e',
                name: payload.name,
                icon: '',
                ownerId: 'u-e2e',
                inviteCode: 'ABCD1234',
                members: ['u-e2e'],
                memberRoles: { 'u-e2e': 'owner' },
                categories: [],
                channels: [
                  { id: 'general', type: 'text', name: 'geral', categoryId: null, allowedRoles: [] },
                  { id: 'voice-general', type: 'voice', name: 'Geral', categoryId: null, allowedRoles: [] }
                ]
              };
              queueMicrotask(() => this.trigger('server:created', server));
              return this;
            }
            return this;
          }
        };

        document.getElementById('cloudGate')?.classList.add('hidden');
        window.BananaLegacy.attachSocket(fake, { displayName: 'E2E User' });
        fake.trigger('auth:ready', {
          user: { id: 'u-e2e', name: 'E2E User', status: 'online', avatar: '' },
          servers: []
        });
        await sleep(30);

        const setupHidden = document.getElementById('setup')?.classList.contains('hidden');
        const appVisible = !document.getElementById('app')?.classList.contains('hidden');
        if (!setupHidden || !appVisible) return { ok: false, reason: 'login-first shell state incorrect' };

        document.getElementById('addServerBtn')?.click();
        await sleep(20);
        const modal = document.getElementById('modal');
        const input = document.getElementById('newServerName');
        const create = document.getElementById('createServerNow');
        if (!modal || modal.classList.contains('hidden') || !input || !create) {
          return { ok: false, reason: 'server modal did not open from + button' };
        }
        const modalText = document.getElementById('modalBody')?.textContent || '';
        if (!modalText.includes('Banana Cloud') || /mesmo host/i.test(modalText)) {
          return { ok: false, reason: 'server modal still exposes host-era copy' };
        }

        input.value = 'Servidor E2E';
        create.click();
        await sleep(40);
        const createEmit = emitted.find(x => x.event === 'server:create' && x.payload?.name === 'Servidor E2E');
        if (!createEmit) return { ok: false, reason: 'create server button did not emit server:create' };

        const serverVisible = [...document.querySelectorAll('#serverList .server-icon')].some(el => /Servidor E2E/i.test(el.title || ''));
        const channelsText = document.getElementById('channels')?.textContent || '';
        if (!serverVisible) return { ok: false, reason: 'created server did not render in server rail' };
        if (!channelsText.includes('geral') || !channelsText.includes('Geral')) return { ok: false, reason: 'default text/voice channels did not render' };

        document.getElementById('profileBtn')?.click();
        await sleep(20);
        const settingsText = document.getElementById('modalBody')?.textContent || '';
        if (!settingsText.match(/Áudio|Audio/i) || !settingsText.match(/Vídeo|Video|Tela/i)) {
          return { ok: false, reason: 'v1.2.1 settings parity missing' };
        }

        return {
          ok: true,
          emitted: emitted.map(x => x.event),
          channelsText,
          settingsOpened: true
        };
      })();
    `, true),
    new Promise(resolve => setTimeout(() => resolve({ ok: false, reason: 'renderer interaction timeout' }), 12000))
  ]);

  if (!result?.ok) return fail(result?.reason || 'unknown renderer failure');
  console.log('Banana Cord V2 Electron interaction test: OK');
  console.log(JSON.stringify(result));
  try { win.destroy(); } catch {}
  finish(0);
}).catch(error => fail(error?.stack || error?.message || String(error)));

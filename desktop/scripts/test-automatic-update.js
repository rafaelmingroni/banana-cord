const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'update-service.js'), 'utf8');
const flush = () => new Promise(resolve => setImmediate(resolve));

// Exercise the real main-process service with deterministic time and a real
// evaluation of its renderer activity probe. No installer process is launched.
function fixture() {
  let now = 1000000;
  let nextId = 0;
  const tasks = new Map();
  const handlers = new Map();
  const updaterEvents = new Map();
  const appEvents = new Map();
  const installations = [];
  const emitted = [];
  let pendingProbe = false;
  let probeError = false;
  let probeValue;
  let composer = '';
  let incomingCall = false;
  let currentUrl = pathToFileURL(path.join(root, 'src/index.html')).href;
  let savedConfig;
  const renderer = {
    state: { voice: { channelId: null, serverId: null, peers: new Map() }, v1: {} },
    document: {
      getElementById: id => id === 'messageInput' ? { value: composer } : null,
      querySelector: () => incomingCall ? {} : null
    }
  };
  const setTimeoutFake = (fn, delay = 0) => {
    const task = { id: ++nextId, due: now + delay, fn, unref() {} };
    tasks.set(task.id, task);
    return task;
  };
  const clearTimeoutFake = task => tasks.delete(task?.id);
  const contents = {
    isDestroyed: () => false,
    getURL: () => currentUrl,
    send: (_name, value) => emitted.push({ ...value }),
    executeJavaScript: script => {
      if (probeError) return Promise.reject(new Error('renderer unavailable'));
      if (pendingProbe) return new Promise(() => {});
      if (probeValue !== undefined) return Promise.resolve(probeValue);
      return Promise.resolve(vm.runInNewContext(script, renderer));
    }
  };
  let openWindows = [{ isDestroyed: () => false, webContents: contents, setProgressBar() {} }];
  const updater = {
    on: (name, callback) => updaterEvents.set(name, callback),
    setFeedURL(value) { this.feed = value; },
    checkForUpdates: async () => {},
    downloadUpdate: async () => {},
    quitAndInstall: (...args) => installations.push(args)
  };
  const app = {
    isPackaged: true,
    getVersion: () => '3.1.7',
    getPath: () => '/test-user-data',
    on: (name, callback) => appEvents.set(name, callback),
    whenReady: () => ({ then() {} })
  };
  const context = {
    module: { exports: {} }, __dirname: root,
    URL, Promise,
    Date: { now: () => now },
    setTimeout: setTimeoutFake, clearTimeout: clearTimeoutFake,
    setInterval: setTimeoutFake, clearInterval: clearTimeoutFake,
    require(name) {
      if (name === 'electron') return { app, BrowserWindow: { getAllWindows: () => openWindows },
        ipcMain: { handle: (name, fn) => handlers.set(name, fn), on: (name, fn) => handlers.set(name, fn) } };
      if (name === 'electron-updater') return { autoUpdater: updater };
      if (name === './graceful-shutdown') return { patchAutoUpdater(value) { assert.equal(value, updater); } };
      if (name === './src/mingrx-updater-compat') return { OFFICIAL_UPDATE_OWNER: 'rafaelmingroni', OFFICIAL_UPDATE_REPO: 'mingrx-app' };
      if (name === 'fs') return { readFileSync: () => JSON.stringify(savedConfig || {}), mkdirSync() {}, writeFileSync() {} };
      return require(name);
    }
  };
  vm.runInNewContext(source, context, { filename: 'update-service.js' });
  const service = context.module.exports;
  service.configureUpdater();
  const state = () => handlers.get('update:get-state')();
  return {
    updater, appEvents, handlers, service, renderer, installations, tasks, state, emitted,
    ready: () => updaterEvents.get('update-downloaded')({ version: '3.1.8' }),
    event: (name, value) => updaterEvents.get(name)(value),
    setComposer: value => { composer = value; },
    setIncomingCall: value => { incomingCall = value; },
    setPendingProbe: value => { pendingProbe = value; },
    setProbeError: value => { probeError = value; },
    setProbeValue: value => { probeValue = value; },
    setUrl: value => { currentUrl = value; },
    closeWindows: () => { openWindows = []; },
    setSavedConfig: value => { savedConfig = value; service.loadUpdateConfig(); service.configureUpdater(); },
    async advance(milliseconds) {
      const target = now + milliseconds;
      for (;;) {
        const task = [...tasks.values()].filter(task => task.due <= target).sort((a, b) => a.due - b.due)[0];
        if (!task) break;
        now = task.due;
        tasks.delete(task.id);
        task.fn();
        await flush();
      }
      now = target;
      await flush();
    }
  };
}

async function main() {
  const login = fixture();
  assert.equal(login.updater.autoDownload, true);
  assert.equal(login.updater.autoInstallOnAppQuit, true, 'a normal quit must retain electron-updater install fallback');
  assert.equal(login.updater.autoRunAppAfterInstall, true);
  assert.equal(login.updater.feed.repo, 'mingrx-app');
  // No account, no auth:ready event and no install IPC call are necessary.
  login.ready();
  assert.equal(login.state().autoInstallPending, true);
  await login.advance(7999);
  assert.equal(login.installations.length, 0);
  await login.advance(1);
  assert.equal(login.state().phase, 'installing');
  await login.advance(350);
  assert.deepEqual(login.installations, [[true, true]], 'automatic apply must be silent and force relaunch');
  assert.equal(login.handlers.get('update:install')(), false, 'repeated explicit apply must not launch another installer');
  await login.advance(30000);
  assert.equal(login.installations.length, 1);

  const busy = fixture();
  busy.renderer.state.voice.channelId = 'active-call';
  busy.ready();
  await busy.advance(8000);
  assert.equal(busy.state().phase, 'ready');
  assert.equal(busy.state().installDeferReason, 'activity');
  busy.renderer.state.voice.channelId = null;
  busy.setComposer('mensagem ainda não enviada');
  await busy.advance(5000);
  assert.equal(busy.installations.length, 0, 'an unsent draft must survive automatic updates');
  busy.setComposer('');
  busy.renderer.state.voice.screen = { getTracks: () => [{ readyState: 'live' }] };
  await busy.advance(5000);
  assert.equal(busy.installations.length, 0, 'active screen capture must postpone restart');
  busy.renderer.state.voice.screen = null;
  busy.setIncomingCall(true);
  await busy.advance(5000);
  assert.equal(busy.installations.length, 0, 'incoming call must postpone restart');
  busy.setIncomingCall(false);
  await busy.advance(5350);
  assert.deepEqual(busy.installations, [[true, true]], 'apply automatically after active work finishes');

  const stalled = fixture();
  stalled.setPendingProbe(true);
  stalled.ready();
  await stalled.advance(10000);
  assert.equal(stalled.installations.length, 0, 'an unresponsive renderer must not lose active work');
  assert.equal(stalled.state().installDeferReason, 'activity');
  stalled.setPendingProbe(false);
  await stalled.advance(5350);
  assert.deepEqual(stalled.installations, [[true, true]]);

  for (const configure of [
    f => f.setProbeError(true),
    f => f.setProbeValue('false'),
    f => f.setUrl('https://example.invalid'),
    f => { delete f.renderer.state; }
  ]) {
    const unknown = fixture(); configure(unknown); unknown.ready(); await unknown.advance(10000);
    assert.equal(unknown.installations.length, 0, 'only a trusted renderer returning boolean false permits automatic apply');
  }

  const later = fixture();
  later.ready();
  assert.equal(later.handlers.get('update:defer')(), true);
  await later.advance(60000);
  assert.equal(later.installations.length, 0);
  assert.equal(later.state().installDeferReason, 'user');
  assert.equal(later.updater.autoInstallOnAppQuit, true, 'Later still applies on the next real quit');
  assert.equal(later.handlers.get('update:install')(), true, 'explicit apply remains available after postponing');
  await later.advance(350);
  assert.deepEqual(later.installations, [[true, true]]);

  const cancelled = fixture();
  cancelled.ready();
  cancelled.event('error', new Error('download verification failed'));
  await cancelled.advance(10000);
  assert.equal(cancelled.installations.length, 0);
  cancelled.ready();
  cancelled.appEvents.get('before-quit')();
  await cancelled.advance(10000);
  assert.equal(cancelled.installations.length, 0, 'shutdown must cancel pending automatic attempts');

  const lateError = fixture();
  lateError.ready();
  await lateError.advance(8000);
  assert.equal(lateError.state().phase, 'installing');
  lateError.event('error', new Error('installer unavailable'));
  await lateError.advance(350);
  assert.equal(lateError.installations.length, 0, 'a late installer error must invalidate a queued install');

  const pendingQuit = fixture();
  pendingQuit.setPendingProbe(true);
  pendingQuit.ready();
  await pendingQuit.advance(8000);
  pendingQuit.handlers.get('update:defer')();
  pendingQuit.setPendingProbe(false);
  await pendingQuit.advance(20000);
  assert.equal(pendingQuit.installations.length, 0, 'postponing while an activity probe is pending must invalidate its result');

  const optedOut = fixture();
  optedOut.setSavedConfig({ autoDownload: false, autoCheck: false });
  assert.equal(optedOut.updater.autoDownload, false, 'preserve a user download preference');
  assert.equal(optedOut.handlers.get('update:get-config')().autoCheck, false);
  optedOut.ready();
  await optedOut.advance(8350);
  assert.deepEqual(optedOut.installations, [[true, true]], 'a manually downloaded update still applies automatically');
  console.log('Automatic update: login apply, protected activity, timeout, defer, quit fallback and silent relaunch: OK');
}

main().catch(error => { console.error(error); process.exitCode = 1; });

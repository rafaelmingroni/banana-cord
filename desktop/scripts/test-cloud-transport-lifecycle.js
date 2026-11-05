const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

// Exercise the real socket and every bundled transport patch. The UI suites
// supply a socket without db/user, which intentionally skips these patches.
async function main() {
  const source = path.resolve(__dirname, '../src');
  const events = new Map();
  const snapshots = new Set();
  const intervals = new Map();
  const failures = [];
  const writes = [];
  let nextTimer = 0;
  let socket;
  let shellReady = false;
  let deleteBarrier = null;
  const user = { uid: 'lifecycle-user', displayName: 'Lifecycle', email: 'test@example.invalid', emailVerified: true };
  const reference = (...parts) => {
    const [parent, ...segments] = parts;
    const segmentsPath = segments.join('/');
    return { path: parent?.path ? `${parent.path}/${segmentsPath}` : segmentsPath, id: segments.at(-1) };
  };
  const emptySnapshot = { docs: [], size: 0, empty: true, forEach() {}, docChanges: () => [] };
  const F = {
    doc: reference, collection: reference,
    query: (ref, ...constraints) => ({ ...ref, constraints }),
    where: (...args) => args, orderBy: (...args) => args,
    limit: (...args) => args, startAfter: (...args) => args,
    serverTimestamp: () => ({ serverTimestamp: true }),
    Timestamp: { fromMillis: value => ({ toMillis: () => value }) },
    getDoc: async ref => ({ id: ref.id, ref, exists: () => false, data: () => ({}) }),
    getDocs: async () => emptySnapshot,
    setDoc: async (ref, data) => { writes.push({ path: ref.path, data }); },
    updateDoc: async () => {},
    deleteDoc: async () => { if (deleteBarrier) await deleteBarrier; },
    writeBatch: () => ({
      set(ref, data) { writes.push({ path: ref.path, data }); },
      async commit() {}
    }),
    onSnapshot(ref, callback) {
      const record = { ref, callback, active: true };
      snapshots.add(record);
      queueMicrotask(() => { if (record.active) callback(emptySnapshot); });
      return () => { record.active = false; snapshots.delete(record); };
    }
  };
  const context = {
    crypto: webcrypto, queueMicrotask, Map, Set, Date, Promise,
    console: {
      log() {}, warn() {},
      error: (...args) => failures.push(args.map(value => value?.message || String(value)).join(' '))
    },
    setTimeout: () => ++nextTimer, clearTimeout() {},
    setInterval(callback) { const id = ++nextTimer; intervals.set(id, callback); return id; },
    clearInterval: id => intervals.delete(id),
    localStorage: { getItem: () => null },
    document: { getElementById: () => ({ classList: { contains: () => !shellReady } }) },
    addEventListener(name, callback) {
      if (!events.has(name)) events.set(name, new Set());
      events.get(name).add(callback);
    },
    removeEventListener(name, callback) { events.get(name)?.delete(callback); },
    BananaCloud: { ready: false, user, auth: { currentUser: user }, db: {}, realtime: null },
    BananaE2EE: { ensureKeypair: async () => ({ keyId: '1'.repeat(32), publicKey: 'test-public-key' }) },
    BananaLegacy: {
      attachSocket(value) {
        socket = value;
        context.BananaCloudSocket = value;
        value.on('auth:ready', () => { shellReady = true; });
      },
      toast: message => failures.push(message)
    }
  };
  context.window = context;
  vm.createContext(context);
  let installHistory;
  context.require = name => {
    if (name === './chat-history') return installHistory;
    if (name === 'firebase/firestore' || name === 'firebase/database') return F;
    throw new Error(`Unexpected module: ${name}`);
  };
  context.module = { exports: {} };
  vm.runInContext(fs.readFileSync(path.join(source, 'chat-history.js'), 'utf8'), context, { filename: 'chat-history.js' });
  installHistory = context.module.exports;
  const patches = [
    'cloud-v2-socket.js', 'cloud-v2-server-delete-fix.js',
    'cloud-v2-social-fix.js', 'cloud-v2-webrtc-fix.js',
    'cloud-v2-v212-fix.js', 'cloud-v2-v215-security-fix.js',
    'cloud-v2-v216-e2ee.js', 'cloud-v2-v220-chat-stability.js',
    'cloud-v2-v21-social.js', 'cloud-v315-transport.js'
  ];
  for (const filename of patches) {
    vm.runInContext(fs.readFileSync(path.join(source, filename), 'utf8'), context, { filename });
  }
  context.BananaCloud.ready = true;
  for (const callback of events.get('banana:cloud-ready') || []) await callback({});
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(failures, [], 'a real Cloud socket must attach and start without a runtime error');
  assert(shellReady, 'the first serverRefs snapshot must reveal the authenticated shell');
  assert(socket.__mingrx315Transport, 'the authorized transport patch must run');
  assert(socket.__history instanceof Map, 'cursor history must be installed on the real socket');
  assert(writes.some(write => write.path === `presence/${user.uid}/connections/${socket.id}`), 'startup must publish the authorized connection presence');
  const sessionTimers = [socket.__presenceTimer, socket.__expiryTimer].filter(Boolean);
  assert.equal(sessionTimers.length, 2, 'the real presence session must start its renewal and expiry timers');
  assert.equal(events.get('online')?.size, 1, 'one online handler per active socket');

  let publishCount = 0;
  let refreshCount = 0;
  let revokedCount = 0;
  socket.publishPresence = async function() { assert.equal(this, socket); publishCount++; };
  socket.refreshVoiceLease = async function() { assert.equal(this, socket); refreshCount++; };
  socket.on('voice:revoked', () => { revokedCount++; });
  socket.voice = {};
  for (const callback of events.get('online')) callback();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(publishCount, 1, 'reconnecting must publish presence for this socket');
  assert.equal(refreshCount, 1, 'reconnecting must renew this socket voice lease');
  socket.refreshVoiceLease = async () => { throw new Error('lease revoked'); };
  for (const callback of events.get('online')) callback();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(revokedCount, 1, 'a rejected lease must report revocation through this socket');
  socket.voice = null;

  const onlineHandler = [...events.get('online')][0];
  let releaseDeletes;
  deleteBarrier = new Promise(resolve => { releaseDeletes = resolve; });
  let staleMessages = 0;
  socket.on('app:error', () => { staleMessages++; });
  const disconnecting = socket.disconnect();
  assert.equal(socket.connected, false);
  assert.equal(events.get('online').size, 0, 'logout must remove the online handler before network cleanup finishes');
  assert.equal(snapshots.size, 0, 'logout must unsubscribe all snapshots before awaiting network cleanup');
  assert(sessionTimers.every(id => !intervals.has(id)), 'logout must stop all session timers');
  context.BananaCloud.auth.currentUser = { uid: 'another-account' };
  socket.receive('app:error', 'late event from old account');
  assert.equal(staleMessages, 0, 'old socket callbacks must not reach the new account UI');
  // Even an event already queued before removal must not refresh a closed socket.
  const beforeClose = { publishCount, refreshCount };
  onlineHandler();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(publishCount, beforeClose.publishCount, 'a queued online event must ignore a closed socket');
  assert.equal(refreshCount, beforeClose.refreshCount, 'a queued online event must not renew a closed voice lease');
  releaseDeletes();
  await disconnecting;
  console.log('Cloud socket boot, online recovery and logout lifecycle: OK');
}

main().catch(error => { console.error(error); process.exitCode = 1; });

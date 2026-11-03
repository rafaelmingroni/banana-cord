'use strict';
// Deterministic regression test for the exact boot gate that stranded users.
// No Firebase production credentials, accounts, or live requests are used.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src', 'cloud-v2-socket.js'), 'utf8');
const cloudSource = fs.readFileSync(path.join(root, 'src', 'cloud-v2.js'), 'utf8');

async function withDeadline(promise, label) {
  await Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(label + ': blocked on backend')), 400))
  ]);
}

(async () => {
  const from = cloudSource.indexOf('  async function handleUser(user) {');
  const to = cloudSource.indexOf('\n  function requireUser()', from);
  assert(from >= 0 && to > from, 'Could not locate actual auth state handler');
  const handlerText = cloudSource.slice(from, to);
  const dispatched = [];
  const events = [];
  const authWindow = { BananaCloud: { ready: false }, dispatchEvent: e => dispatched.push(e.type) };
  const authGate = { classList: { remove: () => {}, add: () => {} } };
  const authHandler = new Function('gate', 'hide', 'show', 'ensureProfile', 'attachPresence',
    'window', 'CustomEvent', 'user', handlerText + '\nreturn handleUser(user);');
  class TestEvent { constructor(type, opts) { this.type = type; this.detail = opts.detail; } }
  await withDeadline(authHandler(authGate, () => {}, () => {},
    () => new Promise(() => {}), () => events.push('presence'),
    authWindow, TestEvent, { uid:'test', emailVerified:true }), 'Auth handler');
  assert.equal(authWindow.BananaCloud.ready, true, 'Auth handler failed to declare ready');
  assert.deepEqual(dispatched, ['banana:cloud-ready'], 'Auth handler failed to dispatch cloud-ready');

  const snapshots = [];
  const online = [];
  const errors = [];
  const ui = [];
  const firestore = {
    doc: (...parts) => parts, collection: (...parts) => parts,
    query: (...args) => args, orderBy: () => ({}),
    onSnapshot: (q, options, onData, onError) => {
      assert.equal(options.includeMetadataChanges, true, 'Need metadata changes for online confirmation');
      snapshots.push({ onData, onError });
      return () => {};
    },
    serverTimestamp: () => 'timestamp'
  };
  const database = {
    ref: (...parts) => parts,
    onValue: () => () => {},
    onChildAdded: () => () => {},
    onDisconnect: () => ({ remove: () => Promise.resolve() })
  };
  const user = { uid:'user-a', emailVerified:true, displayName:'A', email:'a@example.test' };
  const win = {
    BananaCloud: { ready:false },
    BananaLegacy: { setConnection: value => online.push(value) },
    addEventListener: () => {},
    BananaCloudBootIssue: null
  };
  const context = vm.createContext({
    window: win, console: { log: () => {}, warn: () => {}, error: (...args) => errors.push(args) },
    require: module => module === 'firebase/firestore' ? firestore : module === 'firebase/database' ? database : assert.fail(module),
    crypto: webcrypto, document: { getElementById: () => ({ classList: { contains: () => true } }) },
    setTimeout, clearTimeout, queueMicrotask
  });
  assert(source.includes('  let started = false;'), 'Socket test class extraction anchor moved');
  vm.runInContext(source.replace('  let started = false;', '  window.__TestSocket = BananaCloudSocket;\n  let started = false;'), context);
  const Socket = win.__TestSocket;
  const socket = new Socket({ auth: { currentUser: user }, db: {}, realtime: {} });
  socket.on('auth:ready', data => ui.push(data));
  socket.on('app:error', err => errors.push(err));
  socket.ensurePublicProfile = () => new Promise(() => {}); // Simulate hung Firestore.
  socket.startSession = () => new Promise(() => {});       // Simulate hung RTDB.
  await withDeadline(socket.start(), 'Cloud socket start');
  assert.equal(ui.length, 1, 'Shell must be shown exactly once without backend');
  assert.equal(ui[0].user.id, user.uid);
  assert.equal(snapshots.length, 1, 'Server listener must still be registered');

  snapshots[0].onData({ docs: [], metadata: { fromCache: true } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(online.at(-1), false, 'Cached snapshot is not proof of online connection');
  snapshots[0].onData({ docs: [], metadata: { fromCache: false } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(online.at(-1), true, 'Server snapshot should confirm online connection');

  snapshots[0].onError({ code: 'permission-denied', message: 'simulated' });
  assert.equal(online.at(-1), false, 'Permission error must return to offline');
  assert.equal(win.BananaCloudBootIssue.stage, 'server-list');
  assert.equal(win.BananaCloudBootIssue.code, 'permission-denied');
  assert.equal(ui.length, 1, 'Backend failure must not revert successful authentication');
  console.log('Mingrx Cloud boot resilience: hung Firestore/RTDB and permission denial OK');
})().catch(error => { console.error(error); process.exit(1); });

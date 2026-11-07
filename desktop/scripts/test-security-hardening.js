const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');
const { createGuard } = require('../src/auth-request-guard');
const publicConfig = require('../firebase-public-config');

(async () => {
  let clock = 0, calls = 0;
  const guard = createGuard(() => clock);
  const fail = () => { calls++; throw Object.assign(new Error('Invalid credentials'), { code: 'auth/invalid-credential' }); };
  for (let attempt = 0; attempt < 5; attempt++) {
    await assert.rejects(guard.run('login', fail), { code: 'auth/invalid-credential' });
    if (attempt < 4) clock += 1001;
  }
  await assert.rejects(guard.run('login', fail), { code: 'mingrx/auth-throttled' });
  assert.equal(calls, 5, 'Blocked attempt reached Firebase');
  clock += 30001;
  await guard.run('login', () => 'signed in');
  await guard.run('reset', () => { calls++; });
  await assert.rejects(guard.run('reset', () => { calls++; }), { code: 'mingrx/auth-throttled' });
  let release;
  const pending = guard.run('register', () => new Promise(resolve => { release = resolve; }));
  await assert.rejects(guard.run('register', () => {}), { code: 'mingrx/auth-busy' });
  release(); await pending;
  const config = { apiKey: 'public-demo-key', projectId: 'demo-mingrx', authDomain: 'demo-mingrx.firebaseapp.com', appId: 'demo-app' };
  assert.deepEqual(publicConfig(config), config);
  for (const extra of [{ private_key: 'private-credential' }, { client_email: 'service-account' }, { refresh_token: 'private-credential' }, { databaseURL: 'http://insecure.invalid' }, { authDomain: 'https://credentials@invalid.test' }]) {
    assert.throws(() => publicConfig({ ...config, ...extra }));
  }
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mingrx-security-'));
  let available = true;
  const key = crypto.randomBytes(32);
  const safeStorage = {
    isEncryptionAvailable: () => available,
    getSelectedStorageBackend: () => 'test-keyring',
    encryptString: value => {
      const iv = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      return Buffer.concat([iv, cipher.update(value, 'utf8'), cipher.final(), cipher.getAuthTag()]);
    },
    decryptString: value => {
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, value.subarray(0, 12));
      decipher.setAuthTag(value.subarray(-16));
      return Buffer.concat([decipher.update(value.subarray(12, -16)), decipher.final()]).toString('utf8');
    }
  };
  const root = path.resolve(__dirname, '..');
  const load = () => {
    const context = { module: { exports: {} }, __dirname: root, Buffer, process,
      require: name => name === 'electron' ? { app: { getPath: () => temp }, ipcMain: {}, safeStorage, BrowserWindow: { getAllWindows: () => [] } }
        : name === './ipc-security' ? require('../ipc-security') : require(name) };
    vm.runInNewContext(fs.readFileSync(path.join(root, 'auth-vault.js'), 'utf8'), context);
    return context.module.exports.operation;
  };
  const frame = { url: pathToFileURL(path.join(root, 'src/index.html')).href };
  const session = { storagePath: path.join(temp, 'default') };
  const event = { sender: { mainFrame: frame, session }, senderFrame: frame };
  const authKey = 'firebase:authUser:public-demo-key:[DEFAULT]';
  const payload = JSON.stringify({ uid: 'synthetic-user', refreshToken: 'synthetic-refresh-token' });
  try {
    let operation = load();
    operation(event, 'set', authKey, payload);
    const files = fs.readdirSync(path.join(temp, 'auth'));
    assert.equal(files.length, 1);
    const file = path.join(temp, 'auth', files[0]);
    assert(!fs.readFileSync(file).includes(Buffer.from('synthetic-refresh-token')));
    operation = load();
    assert.equal(operation(event, 'get', authKey).value, payload, 'Session did not survive main-process recreation');
    assert.equal(operation({ sender: { mainFrame: frame, session: { storagePath: 'other' } }, senderFrame: frame }, 'get', authKey).value, null);
    assert.throws(() => operation({ ...event, senderFrame: { url: frame.url } }, 'get', authKey));
    assert.throws(() => operation(event, 'set', '../../escape', payload));
    assert.throws(() => operation(event, 'set', authKey, 'x'.repeat(65537)));
    fs.writeFileSync(file, Buffer.from('corrupted-encrypted-vault'));
    assert.throws(() => operation(event, 'get', authKey), /Não foi possível acessar/);
    operation(event, 'remove', authKey);
    assert(!fs.existsSync(file));
    available = false;
    operation(event, 'set', authKey, payload);
    assert.equal(operation(event, 'get', authKey).value, payload);
    assert.equal(fs.readdirSync(path.join(temp, 'auth')).length, 0, 'Unavailable encryption wrote a plaintext session');
    assert.equal(load()(event, 'get', authKey).value, null, 'Volatile session persisted across process recreation');
    operation(event, 'remove', authKey);
    assert.equal(operation(event, 'get', authKey).value, null);
    assert(require('../package.json').build.files.includes('auth-vault.js'), 'Release omits the session vault');
    console.log('Security: login/reset/concurrent-request limits, public config, encrypted session, process restart, partition isolation, invalid origins, corrupt vault and memory-only fallback passed.');
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });

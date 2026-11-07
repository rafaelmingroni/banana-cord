// Firebase sessions belong to the OS user and the Electron storage partition.
// Never fall back to a plaintext file when the OS credential store is unavailable.
const { app, ipcMain, safeStorage, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { trusted } = require('./ipc-security');
const memory = new WeakMap();
const MAX_BYTES = 65536;

function encryptedStorageAvailable() {
  return !!safeStorage?.isEncryptionAvailable?.()
    && !(process.platform === 'linux' && safeStorage.getSelectedStorageBackend?.() === 'basic_text');
}

function storeFor(session) {
  if (!memory.has(session)) memory.set(session, new Map());
  return memory.get(session);
}

function sessionFile(session, key) {
  // A nonpersistent Electron partition must never acquire disk persistence.
  if (!session.storagePath) return null;
  const digest = crypto.createHash('sha256').update(`${session.storagePath}\0${key}`).digest('hex');
  return path.join(app.getPath('userData'), 'auth', `${digest}.bin`);
}

function operation(event, action, key, value) {
  if (!trusted(event)) throw new Error('Origem não autorizada.');
  if (!['get', 'set', 'remove'].includes(action)
    || typeof key !== 'string' || !/^firebase:(authUser|persistence):[^:]{1,256}:\[DEFAULT\]$/.test(key)) {
    throw new Error('Operação de sessão inválida.');
  }
  if (action === 'set' && (typeof value !== 'string' || Buffer.byteLength(value) > MAX_BYTES)) {
    throw new Error('Sessão inválida.');
  }
  const session = event.sender.session;
  const volatile = storeFor(session);
  const file = sessionFile(session, key);
  const available = !!file && encryptedStorageAvailable();
  try {
    if (action === 'get') {
      if (!available) return { available: false, value: volatile.get(key) ?? null };
      if (!fs.existsSync(file)) return { available: true, value: null };
      if (fs.statSync(file).size > MAX_BYTES * 4) throw new Error('Invalid vault size');
      return { available: true, value: safeStorage.decryptString(fs.readFileSync(file)) };
    }
    if (action === 'set') {
      if (available) {
        fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
        const temp = `${file}.tmp`;
        fs.writeFileSync(temp, safeStorage.encryptString(value), { mode: 0o600 });
        fs.renameSync(temp, file);
      } else volatile.set(key, value);
    } else {
      volatile.delete(key);
      if (file) fs.rmSync(file, { force: true });
    }
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed() && win.webContents !== event.sender && win.webContents.session === session) {
        win.webContents.send('auth-vault:changed', { key });
      }
    }
    return { available };
  } catch {
    throw new Error('Não foi possível acessar a sessão protegida neste dispositivo.');
  }
}

function install() { ipcMain.handle('auth-vault:operation', operation); }
module.exports = { install, operation, encryptedStorageAvailable };

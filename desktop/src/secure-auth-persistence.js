const {
  initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence
} = require('firebase/auth');

class SecureAuthPersistence {
  constructor() {
    this.type = 'LOCAL';
    this._shouldAllowMigration = true;
    this.listeners = new Map();
    this.bridge = window.MingrxDesktop?.ipcRenderer;
    this.volatile = new Map();
    this.bridge?.on('auth-vault:changed', async (_event, { key }) => {
      try {
        const value = await this._get(key);
        for (const listener of this.listeners.get(key) || []) listener(value);
      } catch { /* An unreadable session must not leak errors or credentials. */ }
    });
  }
  // An in-memory session remains available when OS encryption is unavailable.
  async _isAvailable() { return true; }
  async _get(key) {
    if (!this.bridge) return this.volatile.get(key) ?? null;
    const result = await this.bridge.invoke('auth-vault:operation', 'get', key);
    return result.value === null ? null : JSON.parse(result.value);
  }
  async _set(key, value) {
    if (!this.bridge) { this.volatile.set(key, value); return; }
    await this.bridge.invoke('auth-vault:operation', 'set', key, JSON.stringify(value));
  }
  async _remove(key) {
    this.volatile.delete(key);
    if (this.bridge) await this.bridge.invoke('auth-vault:operation', 'remove', key);
  }
  _addListener(key, listener) {
    if (!this.listeners.has(key)) this.listeners.set(key, new Set());
    this.listeners.get(key).add(listener);
  }
  _removeListener(key, listener) { this.listeners.get(key)?.delete(listener); }
}

function migrationOnly(Base) {
  return class {
    constructor() { this.legacy = new Base(); this.type = this.legacy.type; this._shouldAllowMigration = true; }
    async _isAvailable() { return false; }
    _get(key) { return this.legacy._get(key); }
    _remove(key) { return this.legacy._remove(key); }
    async _set() { throw new Error('O armazenamento antigo da sessão é somente leitura.'); }
    _addListener() {}
    _removeListener() {}
  };
}

module.exports = app => initializeAuth(app, { persistence: [
  SecureAuthPersistence,
  migrationOnly(indexedDBLocalPersistence),
  migrationOnly(browserLocalPersistence),
  migrationOnly(browserSessionPersistence)
] });

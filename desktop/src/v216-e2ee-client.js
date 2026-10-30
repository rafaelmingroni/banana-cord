/* Banana Cord V2.0.16 — minimal renderer bridge for DM E2EE.
 * Private X25519 keys never leave the Electron main process.
 */
(() => {
  if (window.BananaE2EE) return;
  const { ipcRenderer } = require('electron');
  window.BananaE2EE = Object.freeze({
    status: () => ipcRenderer.invoke('e2ee:status'),
    ensureKeypair: uid => ipcRenderer.invoke('e2ee:ensure-keypair', uid),
    encrypt: payload => ipcRenderer.invoke('e2ee:encrypt', payload),
    decrypt: payload => ipcRenderer.invoke('e2ee:decrypt', payload)
  });
})();

const { app, ipcMain } = require('electron');
const path = require('path');
const { createRendezvous } = require('./rendezvous');

let rendezvous = null;
let currentHostUrl = '';
let refreshTimer = null;

function hostDataFile() {
  return path.join(app.getPath('userData'), 'host-data', 'data.json');
}

function rv() {
  if (!rendezvous) rendezvous = createRendezvous({
    storageDir: path.join(app.getPath('userData'), 'rendezvous')
  });
  return rendezvous;
}

async function refreshDirectory() {
  if (!currentHostUrl) return;
  try { await rv().publishAll(currentHostUrl, hostDataFile()); }
  catch (e) { console.warn('Banana Cord rendezvous:', e?.message || e); }
}

function startRefresh() {
  clearInterval(refreshTimer);
  refreshTimer = setInterval(refreshDirectory, 60_000);
  refreshTimer.unref?.();
}

app.on('banana:host-status', data => {
  const status = typeof data === 'string' ? data : data?.status;
  if (status === 'ready' && data?.url) {
    currentHostUrl = String(data.url).replace(/\/$/, '');
    setTimeout(refreshDirectory, 700);
    startRefresh();
  }
  if (['stopped', 'tunnel-ended'].includes(status)) {
    currentHostUrl = '';
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
});

ipcMain.handle('invite:resolve-short', async (_e, code) => {
  try { return await rv().resolve(code); }
  catch (e) { return { ok: false, reason: 'error', message: e?.message || String(e) }; }
});

ipcMain.handle('invite:code-for-server', async (_e, serverId) => {
  try {
    const row = rv().getCodeForServer(serverId, hostDataFile());
    if (!row) return { ok: false };
    return { ok: true, ...row, online: !!currentHostUrl };
  } catch (e) {
    return { ok: false, message: e?.message || String(e) };
  }
});

ipcMain.handle('invite:create-temporary', async (_e, payload) => {
  try {
    const minutes = Number(payload?.minutes || 60);
    const durationMs = Math.max(5, Math.min(minutes, 10080)) * 60_000;
    const row = await rv().createTemporaryInvite({
      serverId: payload?.serverId,
      dataFile: hostDataFile(),
      url: currentHostUrl,
      durationMs,
      publish: true
    });
    return { ok: true, ...row, online: !!currentHostUrl };
  } catch (e) {
    return { ok: false, message: e?.message || String(e) };
  }
});

ipcMain.handle('invite:refresh-directory', async () => {
  await refreshDirectory();
  return { ok: !!currentHostUrl };
});

app.on('before-quit', () => {
  clearInterval(refreshTimer);
  try { rendezvous?.close(); } catch {}
});

require('./updater-prompt.js');

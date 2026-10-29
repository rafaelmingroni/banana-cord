const { BrowserWindow } = require('electron');

let cleanupInFlight = null;

async function prepareRendererShutdown(timeoutMs = 3200) {
  if (cleanupInFlight) return cleanupInFlight;
  cleanupInFlight = (async () => {
    const win = BrowserWindow.getAllWindows().find(w => !w.isDestroyed());
    if (!win || win.webContents.isDestroyed()) return true;

    const cleanup = win.webContents.executeJavaScript(`
      (async () => {
        try {
          if (window.BananaCloudSocket?.disconnect) {
            await window.BananaCloudSocket.disconnect();
          } else if (typeof leaveVoice === 'function') {
            await leaveVoice();
          }
          return true;
        } catch (error) {
          console.warn('Banana Cord shutdown cleanup:', error);
          return false;
        }
      })()
    `, true).catch(() => false);

    const timeout = new Promise(resolve => setTimeout(() => resolve(false), timeoutMs));
    return Promise.race([cleanup, timeout]);
  })();

  try { return await cleanupInFlight; }
  finally { cleanupInFlight = null; }
}

function patchAutoUpdater(autoUpdater) {
  if (!autoUpdater || autoUpdater.__bananaGracefulInstallPatched) return;
  autoUpdater.__bananaGracefulInstallPatched = true;
  const originalQuitAndInstall = autoUpdater.quitAndInstall.bind(autoUpdater);
  let installing = false;

  autoUpdater.quitAndInstall = function gracefulQuitAndInstall(isSilent = false, isForceRunAfter = true) {
    if (installing) return;
    installing = true;
    (async () => {
      await prepareRendererShutdown();
      // Give Firebase/Realtime Database a small window to flush explicit removals
      // before the installer terminates the process and launches the new version.
      await new Promise(resolve => setTimeout(resolve, 250));
      originalQuitAndInstall(isSilent, isForceRunAfter);
    })().catch(() => originalQuitAndInstall(isSilent, isForceRunAfter));
  };
}

module.exports = { prepareRendererShutdown, patchAutoUpdater };

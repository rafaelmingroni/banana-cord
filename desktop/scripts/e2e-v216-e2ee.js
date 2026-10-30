const fs = require('fs');
const os = require('os');
const path = require('path');
const { app, BrowserWindow } = require('electron');

app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');
const testUserData = path.join(os.tmpdir(), `banana-cord-e2ee-${process.pid}-${Date.now()}`);
app.setPath('userData', testUserData);
require('../e2ee-main.js');

const hardTimeout = setTimeout(() => {
  console.error('V2.0.16 E2EE Electron test failed: hard timeout');
  app.exit(1);
}, 20000);

function finish(code, message) {
  clearTimeout(hardTimeout);
  if (message) (code === 0 ? console.log : console.error)(message);
  try { fs.rmSync(testUserData, { recursive: true, force: true }); } catch {}
  setTimeout(() => app.exit(code), 40);
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    webPreferences: { nodeIntegration: true, contextIsolation: false, sandbox: false }
  });
  await win.loadFile(path.join(__dirname, '..', 'src', 'index.html'));
  const result = await win.webContents.executeJavaScript(`
    (async () => {
      if (!window.BananaE2EE) return { ok: false, reason: 'BananaE2EE bridge missing' };
      const status = await window.BananaE2EE.status();
      if (!status.available) return { ok: false, reason: 'safeStorage unavailable in Electron test' };
      const alice = await window.BananaE2EE.ensureKeypair('e2ee-alice');
      const bob = await window.BananaE2EE.ensureKeypair('e2ee-bob');
      if (!alice?.keyId || !bob?.keyId || alice.keyId === bob.keyId) return { ok: false, reason: 'invalid X25519 identities' };
      const context = { threadId: 'e2ee-alice_e2ee-bob', messageId: 'msg-test-1', fromId: 'e2ee-alice', toId: 'e2ee-bob' };
      const envelope = await window.BananaE2EE.encrypt({ uid: 'e2ee-alice', peerPublicKey: bob.publicKey, peerKeyId: bob.keyId, text: 'banana secreta 🍌', context });
      if (!envelope?.ciphertext || envelope.ciphertext.includes('banana')) return { ok: false, reason: 'ciphertext leaked plaintext' };
      const plain = await window.BananaE2EE.decrypt({ uid: 'e2ee-bob', peerPublicKey: alice.publicKey, envelope, context });
      if (plain !== 'banana secreta 🍌') return { ok: false, reason: 'round-trip decrypt mismatch' };
      let tamperRejected = false;
      try {
        const broken = { ...envelope, ciphertext: envelope.ciphertext.slice(0, -2) + 'AA' };
        await window.BananaE2EE.decrypt({ uid: 'e2ee-bob', peerPublicKey: alice.publicKey, envelope: broken, context });
      } catch { tamperRejected = true; }
      if (!tamperRejected) return { ok: false, reason: 'tampered ciphertext was accepted' };
      return { ok: true, algorithm: envelope.algorithm, aliceKey: alice.keyId, bobKey: bob.keyId, tamperRejected };
    })();
  `, true);
  try { win.destroy(); } catch {}
  if (!result?.ok) return finish(1, `V2.0.16 E2EE Electron test failed: ${result?.reason || 'unknown'}`);
  finish(0, `Banana Cord V2.0.16 real E2EE Electron test: OK ${JSON.stringify(result)}`);
}).catch(error => finish(1, `V2.0.16 E2EE Electron test failed: ${error?.stack || error}`));

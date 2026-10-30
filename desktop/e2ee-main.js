const { app, ipcMain, safeStorage } = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const E2EE_VERSION = 1;
const E2EE_ALGORITHM = 'X25519-AES-256-GCM';

function trustedRenderer(event) {
  try {
    const raw = event?.senderFrame?.url || event?.sender?.getURL?.() || '';
    const url = new URL(raw);
    return url.protocol === 'file:' && url.pathname.endsWith('/src/index.html');
  } catch {
    return false;
  }
}

function requireTrusted(event) {
  if (!trustedRenderer(event)) throw new Error('Origem de criptografia não autorizada.');
}

function cleanUid(value) {
  const uid = String(value || '').trim();
  if (!uid || uid.length > 256) throw new Error('Conta inválida para criptografia.');
  return uid;
}

function safeString(value, max = 256) {
  const out = String(value || '');
  if (!out || out.length > max) throw new Error('Contexto criptográfico inválido.');
  return out;
}

function vaultFile(uid) {
  const digest = crypto.createHash('sha256').update(cleanUid(uid)).digest('hex');
  return path.join(app.getPath('userData'), 'crypto', `dm-e2ee-${digest}.json`);
}

function emptyVault() {
  return { version: E2EE_VERSION, currentKeyId: '', keys: {} };
}

function readVault(uid) {
  const file = vaultFile(uid);
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (parsed?.version !== E2EE_VERSION || !parsed?.keys || typeof parsed.keys !== 'object') return emptyVault();
    return parsed;
  } catch {
    return emptyVault();
  }
}

function writeVault(uid, vault) {
  const file = vaultFile(uid);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(vault, null, 2), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(temp, file);
}

function keyIdForPublicKey(publicKey) {
  const bytes = Buffer.from(String(publicKey || ''), 'base64');
  if (!bytes.length) throw new Error('Chave pública inválida.');
  return crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 32);
}

function encryptionReady() {
  return !!safeStorage?.isEncryptionAvailable?.();
}

function generateKey(uid) {
  if (!encryptionReady()) throw new Error('O armazenamento seguro do Windows não está disponível para proteger a chave privada.');
  const { publicKey, privateKey } = crypto.generateKeyPairSync('x25519');
  const publicDer = publicKey.export({ format: 'der', type: 'spki' });
  const privateDer = privateKey.export({ format: 'der', type: 'pkcs8' });
  const publicB64 = Buffer.from(publicDer).toString('base64');
  const privateB64 = Buffer.from(privateDer).toString('base64');
  const keyId = keyIdForPublicKey(publicB64);
  const vault = readVault(uid);
  vault.version = E2EE_VERSION;
  vault.currentKeyId = keyId;
  vault.keys[keyId] = {
    keyId,
    publicKey: publicB64,
    privateKeyEncrypted: safeStorage.encryptString(privateB64).toString('base64'),
    createdAt: Date.now()
  };
  writeVault(uid, vault);
  return { keyId, publicKey: publicB64, algorithm: 'X25519', createdAt: vault.keys[keyId].createdAt };
}

function ensureKeyPair(uid) {
  uid = cleanUid(uid);
  if (!encryptionReady()) throw new Error('O armazenamento seguro do Windows não está disponível para criptografia ponta a ponta.');
  const vault = readVault(uid);
  const current = vault.keys?.[vault.currentKeyId];
  if (current?.publicKey && current?.privateKeyEncrypted) {
    return {
      keyId: current.keyId || vault.currentKeyId,
      publicKey: current.publicKey,
      algorithm: 'X25519',
      createdAt: Number(current.createdAt || 0)
    };
  }
  return generateKey(uid);
}

function localPrivateKey(uid, keyId) {
  uid = cleanUid(uid);
  const vault = readVault(uid);
  const row = vault.keys?.[String(keyId || '')];
  if (!row?.privateKeyEncrypted) throw new Error('A chave local desta mensagem não existe mais neste dispositivo.');
  if (!encryptionReady()) throw new Error('O armazenamento seguro do Windows não está disponível.');
  const encrypted = Buffer.from(row.privateKeyEncrypted, 'base64');
  const privateB64 = safeStorage.decryptString(encrypted);
  return crypto.createPrivateKey({
    key: Buffer.from(privateB64, 'base64'),
    format: 'der',
    type: 'pkcs8'
  });
}

function importPeerPublicKey(publicKey, expectedKeyId) {
  const publicB64 = String(publicKey || '');
  const actual = keyIdForPublicKey(publicB64);
  if (expectedKeyId && actual !== String(expectedKeyId)) throw new Error('A identidade criptográfica do contato não confere.');
  return crypto.createPublicKey({ key: Buffer.from(publicB64, 'base64'), format: 'der', type: 'spki' });
}

function normalizeContext(raw = {}) {
  return {
    threadId: safeString(raw.threadId, 600),
    messageId: safeString(raw.messageId, 256),
    fromId: safeString(raw.fromId, 256),
    toId: safeString(raw.toId, 256)
  };
}

function aadFor(context, envelope) {
  const data = [
    'banana-cord-dm',
    String(envelope.version),
    context.threadId,
    context.messageId,
    context.fromId,
    context.toId,
    envelope.senderKeyId,
    envelope.recipientKeyId
  ].join('|');
  return Buffer.from(data, 'utf8');
}

function deriveAesKey(privateKey, peerPublicKey, context, envelope) {
  const shared = crypto.diffieHellman({ privateKey, publicKey: peerPublicKey });
  const salt = crypto.createHash('sha256').update(`banana-cord:${context.threadId}`).digest();
  const info = Buffer.from(`dm-e2ee-v${envelope.version}:${envelope.senderKeyId}:${envelope.recipientKeyId}`, 'utf8');
  return Buffer.from(crypto.hkdfSync('sha256', shared, salt, info, 32));
}

function encryptMessage(payload = {}) {
  const uid = cleanUid(payload.uid);
  const text = String(payload.text || '');
  if (!text || text.length > 2000) throw new Error('Mensagem inválida para criptografia.');
  const context = normalizeContext(payload.context);
  if (context.fromId !== uid) throw new Error('O remetente não corresponde à conta local.');

  const local = ensureKeyPair(uid);
  const recipientKeyId = safeString(payload.peerKeyId, 64);
  const peer = importPeerPublicKey(payload.peerPublicKey, recipientKeyId);
  const envelope = {
    version: E2EE_VERSION,
    algorithm: E2EE_ALGORITHM,
    senderKeyId: local.keyId,
    recipientKeyId
  };
  const key = deriveAesKey(localPrivateKey(uid, local.keyId), peer, context, envelope);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(aadFor(context, envelope));
  const ciphertext = Buffer.concat([cipher.update(Buffer.from(text, 'utf8')), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ...envelope,
    iv: iv.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
    tag: tag.toString('base64')
  };
}

function decryptMessage(payload = {}) {
  const uid = cleanUid(payload.uid);
  const envelope = payload.envelope || {};
  if (Number(envelope.version) !== E2EE_VERSION || envelope.algorithm !== E2EE_ALGORITHM) throw new Error('Formato de mensagem criptografada não suportado.');
  const context = normalizeContext(payload.context);
  if (context.fromId !== uid && context.toId !== uid) throw new Error('Esta mensagem não pertence à conta local.');

  const mine = context.fromId === uid;
  const ownKeyId = safeString(mine ? envelope.senderKeyId : envelope.recipientKeyId, 64);
  const peerKeyId = safeString(mine ? envelope.recipientKeyId : envelope.senderKeyId, 64);
  const peer = importPeerPublicKey(payload.peerPublicKey, peerKeyId);
  const privateKey = localPrivateKey(uid, ownKeyId);
  const key = deriveAesKey(privateKey, peer, context, envelope);
  const iv = Buffer.from(String(envelope.iv || ''), 'base64');
  const tag = Buffer.from(String(envelope.tag || ''), 'base64');
  const ciphertext = Buffer.from(String(envelope.ciphertext || ''), 'base64');
  if (iv.length !== 12 || tag.length !== 16 || ciphertext.length > 16384) throw new Error('Mensagem criptografada inválida.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAAD(aadFor(context, envelope));
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  if (!plain || plain.length > 2000) throw new Error('Conteúdo descriptografado inválido.');
  return plain;
}

ipcMain.handle('e2ee:status', event => {
  requireTrusted(event);
  return { available: encryptionReady(), version: E2EE_VERSION, algorithm: E2EE_ALGORITHM };
});

ipcMain.handle('e2ee:ensure-keypair', (event, uid) => {
  requireTrusted(event);
  return ensureKeyPair(uid);
});

ipcMain.handle('e2ee:encrypt', (event, payload) => {
  requireTrusted(event);
  return encryptMessage(payload);
});

ipcMain.handle('e2ee:decrypt', (event, payload) => {
  requireTrusted(event);
  return decryptMessage(payload);
});

module.exports = { ensureKeyPair, encryptMessage, decryptMessage, keyIdForPublicKey };

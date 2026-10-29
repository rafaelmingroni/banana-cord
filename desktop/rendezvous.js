const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const WebSocket = require('ws');
const { generateSecretKey, finalizeEvent, verifyEvent } = require('nostr-tools/pure');
const { SimplePool, useWebSocketImplementation } = require('nostr-tools/pool');

useWebSocketImplementation(WebSocket);

const KIND = 30078;
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const AAD = Buffer.from('banana-cord-rendezvous-v1', 'utf8');
const DEFAULT_RELAYS = [
  'wss://relay.primal.net',
  'wss://relay.snort.social',
  'wss://offchain.pub'
];

function encodeBase32(buffer, chars = 8) {
  let acc = 0, bits = 0, out = '';
  for (const byte of buffer) {
    acc = (acc << 8) | byte;
    bits += 8;
    while (bits >= 5 && out.length < chars) {
      bits -= 5;
      out += ALPHABET[(acc >>> bits) & 31];
    }
    if (out.length >= chars) break;
    acc &= (1 << bits) - 1;
  }
  if (out.length < chars && bits > 0) out += ALPHABET[(acc << (5 - bits)) & 31];
  return out.padEnd(chars, '2').slice(0, chars);
}

function normalizeCode(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function formatCode(value) {
  const raw = normalizeCode(value);
  if (raw.length === 8) return `${raw.slice(0,4)}-${raw.slice(4)}`;
  if (raw.length === 12) return `${raw.slice(0,4)}-${raw.slice(4,8)}-${raw.slice(8)}`;
  return raw;
}

function isValidShortCode(value) {
  const raw = normalizeCode(value);
  if (![8,12].includes(raw.length)) return false;
  return [...raw].every(ch => ALPHABET.includes(ch));
}

function randomCode(chars = 8) {
  return encodeBase32(crypto.randomBytes(Math.ceil(chars * 5 / 8) + 2), chars);
}

function lookupTag(code) {
  const raw = normalizeCode(code);
  return crypto.createHash('sha256').update(`banana-cord-index:${raw}`, 'utf8').digest('hex');
}

function keyForCode(code) {
  const raw = normalizeCode(code);
  return crypto.createHash('sha256').update(`banana-cord-key:${raw}`, 'utf8').digest();
}

function encryptPayload(code, payload) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyForCode(code), iv);
  cipher.setAAD(AAD);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

function decryptPayload(code, packed) {
  const [ivText, tagText, dataText] = String(packed || '').split('.');
  if (!ivText || !tagText || !dataText) throw new Error('payload inválido');
  const decipher = crypto.createDecipheriv('aes-256-gcm', keyForCode(code), Buffer.from(ivText, 'base64url'));
  decipher.setAAD(AAD);
  decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
  const plain = Buffer.concat([decipher.update(Buffer.from(dataText, 'base64url')), decipher.final()]);
  return JSON.parse(plain.toString('utf8'));
}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return fallback; }
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

function readServers(dataFile) {
  const data = readJson(dataFile, { servers: {} });
  return data && typeof data.servers === 'object' ? data.servers : {};
}

function withTimeout(promise, ms, label = 'timeout') {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(label)), ms); })
  ]).finally(() => clearTimeout(timer));
}

function createRendezvous({ storageDir, relays = DEFAULT_RELAYS } = {}) {
  if (!storageDir) throw new Error('storageDir obrigatório');
  const stateFile = path.join(storageDir, 'rendezvous.json');
  const pool = new SimplePool({ enablePing: false, enableReconnect: false });
  let state = readJson(stateFile, { servers: {}, temporary: {} });
  if (!state.servers || typeof state.servers !== 'object') state.servers = {};
  if (!state.temporary || typeof state.temporary !== 'object') state.temporary = {};

  function persist() { writeJson(stateFile, state); }

  function credentialsFor(serverId) {
    const key = String(serverId || '');
    if (!key) throw new Error('Servidor inválido.');
    let row = state.servers[key] || {};
    let changed = false;
    if (!row.secret || !/^[0-9a-f]{64}$/i.test(row.secret)) {
      row.secret = Buffer.from(generateSecretKey()).toString('hex');
      changed = true;
    }
    if (!isValidShortCode(row.code) || normalizeCode(row.code).length !== 8) {
      row.code = randomCode(8);
      changed = true;
    }
    if (!row.createdAt) { row.createdAt = Date.now(); changed = true; }
    if (changed) {
      state.servers[key] = row;
      persist();
    }
    return {
      secret: Uint8Array.from(Buffer.from(row.secret, 'hex')),
      code: normalizeCode(row.code)
    };
  }

  function permanentCodeFor(serverId) {
    return credentialsFor(serverId).code;
  }

  function serverRecord(serverId, dataFile) {
    const servers = readServers(dataFile);
    const server = servers[String(serverId || '')];
    if (!server) return null;
    return {
      id: String(server.id || serverId),
      name: String(server.name || 'Banana Cord').slice(0, 80),
      joinCode: String(server.inviteCode || '').trim()
    };
  }

  function getCodeForServer(serverId, dataFile) {
    const server = serverRecord(serverId, dataFile);
    if (!server || !server.joinCode) return null;
    const raw = permanentCodeFor(server.id);
    return { raw, code: formatCode(raw), serverId: server.id, serverName: server.name };
  }

  async function publishEvent({ server, url, secret, expiresAt, shortCode, temporary = false, parentCode = '' }) {
    if (!relays.length) return { ok: false, relays: 0 };
    const nowSec = Math.floor(Date.now() / 1000);
    const payload = {
      v: 2,
      code: shortCode,
      parentCode: parentCode || shortCode.slice(0, 8),
      url,
      joinCode: server.joinCode,
      serverId: server.id,
      serverName: server.name,
      expiresAt,
      temporary
    };
    const event = finalizeEvent({
      kind: KIND,
      created_at: nowSec,
      tags: [
        ['d', `bc:${lookupTag(shortCode)}`],
        ['expiration', String(Math.floor(expiresAt / 1000))]
      ],
      content: encryptPayload(shortCode, payload)
    }, secret);
    const jobs = pool.publish(relays, event);
    try {
      await withTimeout(Promise.any(jobs), 5000, 'Não consegui publicar o convite.');
      return { ok: true, eventId: event.id, relays: jobs.length };
    } catch {
      return { ok: false, eventId: event.id, relays: jobs.length };
    }
  }

  async function publishPermanent(server, url) {
    const credentials = credentialsFor(server.id);
    return publishEvent({
      server, url,
      secret: credentials.secret,
      expiresAt: Date.now() + 3 * 60 * 1000,
      shortCode: credentials.code,
      temporary: false,
      parentCode: credentials.code
    });
  }

  function pruneTemporary() {
    const now = Date.now();
    let changed = false;
    for (const [token, row] of Object.entries(state.temporary)) {
      if (!row || Number(row.expiresAt || 0) <= now) {
        delete state.temporary[token];
        changed = true;
      }
    }
    if (changed) persist();
  }

  async function publishTemporary(row, url, dataFile) {
    const server = serverRecord(row.serverId, dataFile);
    if (!server || !server.joinCode || row.expiresAt <= Date.now()) return { ok: false };
    const credentials = credentialsFor(server.id);
    const raw = normalizeCode(row.token);
    if (!raw.startsWith(credentials.code) || raw.length !== 12) return { ok: false };
    return publishEvent({
      server, url,
      secret: credentials.secret,
      expiresAt: row.expiresAt,
      shortCode: raw,
      temporary: true,
      parentCode: credentials.code
    });
  }

  async function publishAll(url, dataFile) {
    if (!/^https?:\/\//i.test(String(url || ''))) return { ok: false, count: 0 };
    pruneTemporary();
    const servers = Object.values(readServers(dataFile)).filter(s => s?.id && s?.inviteCode);
    let okCount = 0;
    for (const s of servers) {
      const result = await publishPermanent({
        id: String(s.id),
        name: String(s.name || 'Banana Cord'),
        joinCode: String(s.inviteCode)
      }, url);
      if (result.ok) okCount++;
    }
    for (const row of Object.values(state.temporary)) {
      const result = await publishTemporary(row, url, dataFile);
      if (result.ok) okCount++;
    }
    return { ok: okCount > 0, count: okCount };
  }

  async function createTemporaryInvite({ serverId, dataFile, url, durationMs, publish = true }) {
    const server = serverRecord(serverId, dataFile);
    if (!server || !server.joinCode) throw new Error('Servidor local não encontrado.');
    const permanent = permanentCodeFor(server.id);
    let raw;
    do { raw = `${permanent}${randomCode(4)}`; } while (state.temporary[raw]);
    const safeDuration = Math.max(5 * 60 * 1000, Math.min(Number(durationMs || 3600000), 7 * 24 * 60 * 60 * 1000));
    const row = { token: raw, serverId: server.id, createdAt: Date.now(), expiresAt: Date.now() + safeDuration };
    state.temporary[raw] = row;
    persist();
    let published = false;
    if (publish && url) published = !!(await publishTemporary(row, url, dataFile)).ok;
    return { raw, code: formatCode(raw), serverId: server.id, serverName: server.name, expiresAt: row.expiresAt, published };
  }

  async function resolve(value) {
    const raw = normalizeCode(value);
    if (!isValidShortCode(raw)) return { ok: false, reason: 'invalid' };
    const temporary = raw.length === 12;
    let events = [];
    try {
      events = await pool.querySync(relays, {
        kinds: [KIND],
        '#d': [`bc:${lookupTag(raw)}`],
        since: Math.floor(Date.now() / 1000) - 8 * 24 * 60 * 60,
        limit: 20
      }, { maxWait: 3500 });
    } catch {
      return { ok: false, reason: 'network' };
    }

    const valid = [];
    for (const event of events || []) {
      if (!verifyEvent(event)) continue;
      let content;
      try { content = decryptPayload(raw, event.content); } catch { continue; }
      if (!content || normalizeCode(content.code) !== raw) continue;
      if (Number(content.expiresAt || 0) <= Date.now()) continue;
      if (temporary && normalizeCode(content.parentCode) !== raw.slice(0, 8)) continue;
      try {
        const u = new URL(String(content.url || ''));
        if (!['https:', 'http:'].includes(u.protocol)) continue;
        if (u.username || u.password) continue;
      } catch { continue; }
      if (!content.joinCode || !content.serverId) continue;
      valid.push({ event, content });
    }

    valid.sort((a,b) => b.event.created_at - a.event.created_at);
    const best = valid[0];
    if (!best) return { ok: false, reason: 'offline' };
    return {
      ok: true,
      code: formatCode(raw),
      raw,
      temporary,
      url: String(best.content.url).replace(/\/$/, ''),
      joinCode: String(best.content.joinCode),
      serverId: String(best.content.serverId),
      serverName: String(best.content.serverName || 'Banana Cord'),
      expiresAt: Number(best.content.expiresAt || 0)
    };
  }

  function close() {
    try { pool.close(relays); } catch {}
  }

  return {
    relays: [...relays],
    normalizeCode,
    formatCode,
    isValidShortCode,
    getCodeForServer,
    createTemporaryInvite,
    publishAll,
    resolve,
    close
  };
}

module.exports = {
  DEFAULT_RELAYS,
  normalizeCode,
  formatCode,
  isValidShortCode,
  lookupTag,
  encryptPayload,
  decryptPayload,
  createRendezvous
};

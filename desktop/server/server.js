const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const VERSION = '0.9.0';
const ROLE_RANK = { member: 0, moderator: 1, admin: 2, owner: 3 };
const VALID_ROLES = new Set(Object.keys(ROLE_RANK));

function uid(prefix = '') { return prefix + crypto.randomBytes(8).toString('hex'); }
function inviteCode() { return crypto.randomBytes(4).toString('hex').toUpperCase(); }
function now() { return Date.now(); }
function safeRole(v) { return VALID_ROLES.has(v) ? v : 'member'; }

async function startBananaServer({ port = 3210, dataFile }) {
  const DATA_FILE = dataFile || path.join(__dirname, 'data.json');
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });

  function normalizeServer(s) {
    s.members = Array.isArray(s.members) ? [...new Set(s.members)] : [];
    s.channels = Array.isArray(s.channels) ? s.channels : [];
    s.memberRoles = s.memberRoles && typeof s.memberRoles === 'object' ? s.memberRoles : {};
    for (const id of s.members) s.memberRoles[id] = safeRole(s.memberRoles[id]);
    if (s.ownerId) {
      if (!s.members.includes(s.ownerId)) s.members.unshift(s.ownerId);
      s.memberRoles[s.ownerId] = 'owner';
    }
    return s;
  }

  function load() {
    try {
      const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      const next = { users: parsed.users || {}, servers: parsed.servers || {}, messages: parsed.messages || {} };
      for (const s of Object.values(next.servers)) normalizeServer(s);
      return next;
    } catch {
      return { users: {}, servers: {}, messages: {} };
    }
  }

  let db = load();
  let saveTimer = null;
  function saveSoon() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2)); }
      catch (e) { console.error('Banana Cord save error', e); }
    }, 120);
  }

  function publicUser(user) {
    if (!user) return null;
    return {
      id: user.id,
      name: user.name,
      avatar: user.avatar || '',
      status: user.status || 'offline',
      lastSeen: user.lastSeen || null
    };
  }

  function publicServer(s) {
    normalizeServer(s);
    return {
      id: s.id,
      name: s.name,
      ownerId: s.ownerId,
      inviteCode: s.inviteCode,
      members: s.members,
      memberRoles: s.memberRoles,
      channels: s.channels
    };
  }

  function getUserServers(userId) {
    return Object.values(db.servers).filter(s => s.members.includes(userId)).map(publicServer);
  }

  function membership(socket, serverId) {
    const s = db.servers[serverId];
    return !!(s && socket.data.userId && s.members.includes(socket.data.userId));
  }

  function roleFor(s, userId) {
    if (!s || !userId) return 'member';
    if (s.ownerId === userId) return 'owner';
    return safeRole(s.memberRoles?.[userId]);
  }

  function hasRole(socket, serverId, minimum) {
    const s = db.servers[serverId];
    if (!s || !membership(socket, serverId)) return false;
    return ROLE_RANK[roleFor(s, socket.data.userId)] >= ROLE_RANK[minimum];
  }

  function owner(socket, serverId) { return hasRole(socket, serverId, 'owner'); }
  function canManageChannels(socket, serverId) { return hasRole(socket, serverId, 'moderator'); }
  function canManageServer(socket, serverId) { return hasRole(socket, serverId, 'admin'); }

  function broadcastServer(serverId) {
    const s = db.servers[serverId];
    if (s) io.to(`server:${serverId}`).emit('server:updated', publicServer(s));
  }

  function broadcastMembers(serverId) {
    const s = db.servers[serverId];
    if (!s) return;
    const members = s.members.map(id => ({
      ...publicUser(db.users[id] || { id, name: 'Usuário', status: 'offline' }),
      role: roleFor(s, id)
    }));
    io.to(`server:${serverId}`).emit('members:list', { serverId, members });
  }

  function voiceRoom(serverId, channelId) { return `voice:${serverId}:${channelId}`; }

  const app = express();
  app.disable('x-powered-by');
  app.use(cors());
  app.use(express.json({ limit: '2mb' }));
  app.get('/health', (_req, res) => res.json({ ok: true, name: 'Banana Cord', version: VERSION, at: now() }));

  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    maxHttpBufferSize: 2e6,
    pingInterval: 10000,
    pingTimeout: 15000
  });

  function emitVoiceSnapshot(serverId) {
    const entries = [];
    for (const sx of io.sockets.sockets.values()) {
      if (sx.data.voiceServerId === serverId && sx.data.voiceChannelId && sx.data.userId) {
        entries.push({
          channelId: sx.data.voiceChannelId,
          socketId: sx.id,
          user: publicUser(db.users[sx.data.userId]),
          mediaState: sx.data.mediaState || { muted: false, camera: false, screen: false },
          speaking: !!sx.data.speaking
        });
      }
    }
    io.to(`server:${serverId}`).emit('voice:snapshot', { serverId, entries });
  }

  async function leaveVoice(socket) {
    const room = socket.data.voiceRoom;
    const serverId = socket.data.voiceServerId;
    const channelId = socket.data.voiceChannelId;
    if (!room) return;
    socket.to(room).emit('voice:user-left', { socketId: socket.id, userId: socket.data.userId });
    socket.leave(room);
    socket.data.voiceRoom = null;
    socket.data.voiceServerId = null;
    socket.data.voiceChannelId = null;
    socket.data.mediaState = { muted: false, camera: false, screen: false };
    socket.data.speaking = false;
    if (serverId) {
      io.to(`server:${serverId}`).emit('voice:presence-event', { type: 'leave', userId: socket.data.userId, channelId });
      emitVoiceSnapshot(serverId);
    }
  }

  io.on('connection', socket => {
    socket.on('auth:hello', payload => {
      const id = String(payload?.deviceId || '').trim().slice(0, 128);
      if (!id) return socket.emit('app:error', 'Identidade inválida.');
      const name = String(payload?.name || 'Amigo').trim().slice(0, 32) || 'Amigo';
      const avatar = String(payload?.avatar || '').slice(0, 1_500_000);
      const requestedStatus = ['online', 'busy', 'away'].includes(payload?.status) ? payload.status : 'online';
      db.users[id] = { ...(db.users[id] || {}), id, name, avatar, status: requestedStatus, lastSeen: now() };
      socket.data.userId = id;
      socket.join(`user:${id}`);
      getUserServers(id).forEach(s => socket.join(`server:${s.id}`));
      saveSoon();
      socket.emit('auth:ready', { user: publicUser(db.users[id]), servers: getUserServers(id) });
      for (const s of getUserServers(id)) emitVoiceSnapshot(s.id);
      io.emit('presence:update', publicUser(db.users[id]));
    });

    socket.on('profile:update', payload => {
      const id = socket.data.userId;
      if (!id || !db.users[id]) return;
      if (payload?.name != null) db.users[id].name = String(payload.name).trim().slice(0, 32) || db.users[id].name;
      if (payload?.avatar != null) db.users[id].avatar = String(payload.avatar).slice(0, 1_500_000);
      if (['online', 'busy', 'away'].includes(payload?.status)) db.users[id].status = payload.status;
      saveSoon();
      socket.emit('profile:updated', publicUser(db.users[id]));
      io.emit('presence:update', publicUser(db.users[id]));
      for (const s of getUserServers(id)) broadcastMembers(s.id);
    });

    socket.on('server:create', payload => {
      const userId = socket.data.userId;
      if (!userId) return;
      if (Object.values(db.servers).filter(s => s.ownerId === userId).length >= 8) return socket.emit('app:error', 'Limite de servidores atingido.');
      const serverId = uid('srv_');
      const textId = uid('txt_');
      const voiceId = uid('vc_');
      const s = {
        id: serverId,
        name: String(payload?.name || 'Meu servidor').trim().slice(0, 40) || 'Meu servidor',
        ownerId: userId,
        inviteCode: inviteCode(),
        members: [userId],
        memberRoles: { [userId]: 'owner' },
        channels: [
          { id: textId, type: 'text', name: 'geral' },
          { id: voiceId, type: 'voice', name: 'Geral' }
        ]
      };
      db.servers[serverId] = s;
      db.messages[textId] = [];
      socket.join(`server:${serverId}`);
      saveSoon();
      socket.emit('server:created', publicServer(s));
      broadcastMembers(serverId);
    });

    socket.on('server:join', payload => {
      const userId = socket.data.userId;
      const code = String(payload?.inviteCode || '').trim().toUpperCase();
      const s = Object.values(db.servers).find(x => x.inviteCode === code);
      if (!userId || !s) return socket.emit('app:error', 'Convite não encontrado neste Banana Cord.');
      normalizeServer(s);
      if (!s.members.includes(userId)) {
        if (s.members.length >= 20) return socket.emit('app:error', 'Este servidor atingiu o limite de membros.');
        s.members.push(userId);
        s.memberRoles[userId] = 'member';
      }
      socket.join(`server:${s.id}`);
      saveSoon();
      socket.emit('server:joined', publicServer(s));
      broadcastServer(s.id);
      broadcastMembers(s.id);
      emitVoiceSnapshot(s.id);
    });

    socket.on('server:update', payload => {
      const serverId = payload?.serverId;
      if (!canManageServer(socket, serverId)) return socket.emit('app:error', 'Você não tem permissão para editar o servidor.');
      const s = db.servers[serverId];
      if (payload?.name != null) s.name = String(payload.name).trim().slice(0, 40) || s.name;
      saveSoon();
      broadcastServer(serverId);
    });

    socket.on('server:regenerate-invite', payload => {
      const serverId = payload?.serverId;
      if (!canManageServer(socket, serverId)) return socket.emit('app:error', 'Você não tem permissão para renovar o convite.');
      db.servers[serverId].inviteCode = inviteCode();
      saveSoon();
      broadcastServer(serverId);
    });

    socket.on('member:set-role', payload => {
      const serverId = payload?.serverId;
      const targetUserId = String(payload?.userId || '');
      const nextRole = safeRole(payload?.role);
      const s = db.servers[serverId];
      if (!owner(socket, serverId)) return socket.emit('app:error', 'Só o dono pode alterar cargos.');
      if (!s?.members.includes(targetUserId)) return;
      if (targetUserId === s.ownerId) return socket.emit('app:error', 'O cargo do dono não pode ser alterado.');
      if (nextRole === 'owner') return socket.emit('app:error', 'Transferência de propriedade ainda não está disponível.');
      s.memberRoles[targetUserId] = nextRole;
      saveSoon();
      broadcastServer(serverId);
      broadcastMembers(serverId);
    });

    socket.on('member:kick', async payload => {
      const serverId = payload?.serverId;
      const targetUserId = String(payload?.userId || '');
      const s = db.servers[serverId];
      if (!owner(socket, serverId)) return socket.emit('app:error', 'Só o dono pode remover membros nesta versão.');
      if (!s || targetUserId === s.ownerId) return;
      s.members = s.members.filter(id => id !== targetUserId);
      delete s.memberRoles[targetUserId];
      for (const sx of io.sockets.sockets.values()) {
        if (sx.data.userId === targetUserId) {
          if (sx.data.voiceServerId === serverId) await leaveVoice(sx);
          sx.leave(`server:${serverId}`);
          sx.emit('server:removed', { serverId });
        }
      }
      saveSoon();
      broadcastServer(serverId);
      broadcastMembers(serverId);
    });

    socket.on('channel:create', payload => {
      const serverId = payload?.serverId;
      if (!canManageChannels(socket, serverId)) return socket.emit('app:error', 'Seu cargo não permite criar canais.');
      const s = db.servers[serverId];
      if (s.channels.length >= 30) return socket.emit('app:error', 'Limite de canais atingido.');
      const type = payload?.type === 'voice' ? 'voice' : 'text';
      const raw = String(payload?.name || (type === 'voice' ? 'Nova sala' : 'novo-canal')).trim().slice(0, 32);
      const name = type === 'text' ? raw.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9à-ú_-]/gi, '') || 'novo-canal' : raw || 'Nova sala';
      const ch = { id: uid(type === 'voice' ? 'vc_' : 'txt_'), type, name };
      s.channels.push(ch);
      if (type === 'text') db.messages[ch.id] = [];
      saveSoon();
      broadcastServer(serverId);
    });

    socket.on('channel:update', async payload => {
      const serverId = payload?.serverId;
      const channelId = payload?.channelId;
      if (!canManageChannels(socket, serverId)) return socket.emit('app:error', 'Seu cargo não permite editar canais.');
      const s = db.servers[serverId];
      const ch = s?.channels.find(c => c.id === channelId);
      if (!ch) return;
      if (payload?.action === 'delete') {
        if (s.channels.filter(c => c.type === ch.type).length <= 1) return socket.emit('app:error', `Mantenha pelo menos um canal de ${ch.type === 'voice' ? 'voz' : 'texto'}.`);
        if (ch.type === 'voice') {
          for (const sx of io.sockets.sockets.values()) if (sx.data.voiceServerId === serverId && sx.data.voiceChannelId === channelId) await leaveVoice(sx);
        }
        s.channels = s.channels.filter(c => c.id !== channelId);
        delete db.messages[channelId];
      } else if (payload?.name != null) {
        const raw = String(payload.name).trim().slice(0, 32);
        ch.name = ch.type === 'text' ? raw.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9à-ú_-]/gi, '') || ch.name : raw || ch.name;
      }
      saveSoon();
      broadcastServer(serverId);
    });

    socket.on('channel:reorder', payload => {
      const serverId = payload?.serverId;
      const channelId = payload?.channelId;
      const beforeId = payload?.beforeId || null;
      if (!canManageChannels(socket, serverId)) return;
      const s = db.servers[serverId];
      const from = s?.channels.findIndex(c => c.id === channelId) ?? -1;
      if (from < 0) return;
      const [moved] = s.channels.splice(from, 1);
      let to = beforeId ? s.channels.findIndex(c => c.id === beforeId) : -1;
      if (to < 0) {
        const same = s.channels.map((c, i) => ({ c, i })).filter(x => x.c.type === moved.type);
        to = same.length ? same[same.length - 1].i + 1 : s.channels.length;
      }
      s.channels.splice(to, 0, moved);
      saveSoon();
      broadcastServer(serverId);
    });

    socket.on('messages:load', payload => {
      const { serverId, channelId } = payload || {};
      if (!membership(socket, serverId)) return;
      const s = db.servers[serverId];
      if (!s.channels.some(c => c.id === channelId && c.type === 'text')) return;
      socket.emit('messages:list', { channelId, messages: (db.messages[channelId] || []).slice(-150) });
    });

    socket.on('message:send', payload => {
      const { serverId, channelId } = payload || {};
      if (!membership(socket, serverId)) return;
      const text = String(payload?.text || '').trim().slice(0, 2000);
      if (!text) return;
      const s = db.servers[serverId];
      if (!s.channels.some(c => c.id === channelId && c.type === 'text')) return;
      const m = { id: uid('msg_'), channelId, authorId: socket.data.userId, text, at: now() };
      db.messages[channelId] = db.messages[channelId] || [];
      db.messages[channelId].push(m);
      if (db.messages[channelId].length > 2000) db.messages[channelId] = db.messages[channelId].slice(-2000);
      saveSoon();
      io.to(`server:${serverId}`).emit('message:new', m);
    });

    socket.on('members:get', payload => {
      const serverId = payload?.serverId;
      if (!membership(socket, serverId)) return;
      broadcastMembers(serverId);
      emitVoiceSnapshot(serverId);
    });

    socket.on('voice:join', async payload => {
      const { serverId, channelId } = payload || {};
      if (!membership(socket, serverId)) return;
      const s = db.servers[serverId];
      if (!s.channels.some(c => c.id === channelId && c.type === 'voice')) return;
      if (socket.data.voiceRoom) await leaveVoice(socket);
      const room = voiceRoom(serverId, channelId);
      const sockets = await io.in(room).fetchSockets();
      if (sockets.length >= 5) return socket.emit('voice:full', { channelId });
      socket.data.voiceRoom = room;
      socket.data.voiceServerId = serverId;
      socket.data.voiceChannelId = channelId;
      socket.data.speaking = false;
      socket.join(room);
      socket.data.mediaState = socket.data.mediaState || { muted: false, camera: false, screen: false };
      const peers = sockets.map(sx => ({
        socketId: sx.id,
        user: publicUser(db.users[sx.data.userId]),
        mediaState: sx.data.mediaState || { muted: false, camera: false, screen: false }
      }));
      socket.emit('voice:peers', { channelId, peers });
      socket.to(room).emit('voice:user-joined', { socketId: socket.id, user: publicUser(db.users[socket.data.userId]), mediaState: socket.data.mediaState });
      io.to(`server:${serverId}`).emit('voice:presence-event', { type: 'join', userId: socket.data.userId, channelId });
      emitVoiceSnapshot(serverId);
    });

    socket.on('voice:leave', () => leaveVoice(socket));

    socket.on('voice:media-state', payload => {
      if (!socket.data.voiceRoom) return;
      const mediaState = { muted: !!payload?.muted, camera: !!payload?.camera, screen: !!payload?.screen };
      socket.data.mediaState = mediaState;
      socket.to(socket.data.voiceRoom).emit('voice:media-state', { socketId: socket.id, mediaState });
      if (socket.data.voiceServerId) {
        io.to(`server:${socket.data.voiceServerId}`).emit('voice:media-state-global', {
          socketId: socket.id,
          userId: socket.data.userId,
          channelId: socket.data.voiceChannelId,
          mediaState
        });
      }
    });

    socket.on('voice:speaking', payload => {
      if (!socket.data.voiceRoom) return;
      socket.data.speaking = !!payload?.speaking;
      socket.to(socket.data.voiceRoom).emit('voice:speaking', { socketId: socket.id, speaking: socket.data.speaking });
      if (socket.data.voiceServerId) {
        io.to(`server:${socket.data.voiceServerId}`).emit('voice:speaking-global', {
          socketId: socket.id,
          userId: socket.data.userId,
          channelId: socket.data.voiceChannelId,
          speaking: socket.data.speaking
        });
      }
    });

    socket.on('webrtc:signal', payload => {
      const { targetSocketId, data } = payload || {};
      if (!targetSocketId || !socket.data.voiceRoom) return;
      const target = io.sockets.sockets.get(targetSocketId);
      if (!target || target.data.voiceRoom !== socket.data.voiceRoom) return;
      io.to(targetSocketId).emit('webrtc:signal', { fromSocketId: socket.id, fromUser: publicUser(db.users[socket.data.userId]), data });
    });

    socket.on('latency:ping', (stamp, cb) => cb?.(stamp));

    socket.on('disconnect', async () => {
      await leaveVoice(socket);
      const id = socket.data.userId;
      if (id && db.users[id]) {
        const remaining = [...io.sockets.sockets.values()].some(s => s.data.userId === id && s.connected);
        if (!remaining) {
          db.users[id].status = 'offline';
          db.users[id].lastSeen = now();
          saveSoon();
          io.emit('presence:update', publicUser(db.users[id]));
          for (const s of getUserServers(id)) broadcastMembers(s.id);
        }
      }
    });
  });

  return await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      server.off('error', reject);
      console.log(`Banana Cord ${VERSION} server listening on 127.0.0.1:${port}`);
      resolve({ server, io, port, close: () => new Promise(r => io.close(() => server.close(() => r()))) });
    });
  });
}

module.exports = { startBananaServer };

if (require.main === module) {
  const dataFile = process.env.BANANA_DATA || path.join(__dirname, 'data.json');
  startBananaServer({ port: Number(process.env.PORT || 3210), dataFile }).catch(err => { console.error(err); process.exit(1); });
}

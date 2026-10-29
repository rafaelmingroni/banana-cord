const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const VERSION = '1.0.0';
const ROLE_RANK = { member: 0, moderator: 1, admin: 2, owner: 3 };
const VALID_ROLES = new Set(Object.keys(ROLE_RANK));
const QUICK_REACTIONS = new Set(['👍', '❤️', '😂', '👎']);

function uid(prefix = '') { return prefix + crypto.randomBytes(8).toString('hex'); }
function inviteCode() { return crypto.randomBytes(4).toString('hex').toUpperCase(); }
function now() { return Date.now(); }
function safeRole(v) { return VALID_ROLES.has(v) ? v : 'member'; }
function uniqueStrings(values) { return [...new Set((Array.isArray(values) ? values : []).map(String).filter(Boolean))]; }

async function startBananaServer({ port = 3210, dataFile }) {
  const DATA_FILE = dataFile || path.join(__dirname, 'data.json');
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });

  function normalizeUser(user, id = '') {
    const u = user && typeof user === 'object' ? user : {};
    u.id = String(u.id || id);
    u.name = String(u.name || 'Amigo').slice(0, 32);
    u.avatar = String(u.avatar || '').slice(0, 1_500_000);
    u.status = ['online', 'busy', 'away', 'offline'].includes(u.status) ? u.status : 'offline';
    u.customStatus = String(u.customStatus || '').trim().slice(0, 80);
    u.friends = uniqueStrings(u.friends);
    u.blocked = uniqueStrings(u.blocked);
    u.friendIncoming = uniqueStrings(u.friendIncoming);
    u.friendOutgoing = uniqueStrings(u.friendOutgoing);
    return u;
  }

  function normalizeChannel(ch) {
    const c = ch && typeof ch === 'object' ? ch : {};
    c.id = String(c.id || uid('ch_'));
    c.type = c.type === 'voice' ? 'voice' : 'text';
    c.name = String(c.name || (c.type === 'voice' ? 'Geral' : 'geral')).slice(0, 32);
    c.categoryId = c.categoryId ? String(c.categoryId) : null;
    c.allowedRoles = uniqueStrings(c.allowedRoles).filter(r => VALID_ROLES.has(r) && r !== 'owner');
    return c;
  }

  function normalizeServer(s) {
    s.members = uniqueStrings(s.members);
    s.channels = Array.isArray(s.channels) ? s.channels.map(normalizeChannel) : [];
    s.categories = Array.isArray(s.categories) ? s.categories.map(c => ({ id: String(c.id || uid('cat_')), name: String(c.name || 'Categoria').trim().slice(0, 32) || 'Categoria' })) : [];
    s.memberRoles = s.memberRoles && typeof s.memberRoles === 'object' ? s.memberRoles : {};
    s.icon = String(s.icon || '').slice(0, 900_000);
    for (const id of s.members) s.memberRoles[id] = safeRole(s.memberRoles[id]);
    if (s.ownerId) {
      if (!s.members.includes(s.ownerId)) s.members.unshift(s.ownerId);
      s.memberRoles[s.ownerId] = 'owner';
    }
    for (const ch of s.channels) if (ch.categoryId && !s.categories.some(c => c.id === ch.categoryId)) ch.categoryId = null;
    return s;
  }

  function load() {
    try {
      const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      const next = { users: parsed.users || {}, servers: parsed.servers || {}, messages: parsed.messages || {}, dms: parsed.dms || {} };
      for (const [id, u] of Object.entries(next.users)) next.users[id] = normalizeUser(u, id);
      for (const s of Object.values(next.servers)) normalizeServer(s);
      return next;
    } catch {
      return { users: {}, servers: {}, messages: {}, dms: {} };
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
      customStatus: user.customStatus || '',
      lastSeen: user.lastSeen || null
    };
  }

  function roleFor(s, userId) {
    if (!s || !userId) return 'member';
    if (s.ownerId === userId) return 'owner';
    return safeRole(s.memberRoles?.[userId]);
  }

  function canAccessChannel(s, ch, userId) {
    if (!s || !ch || !userId || !s.members.includes(userId)) return false;
    if (s.ownerId === userId || ROLE_RANK[roleFor(s, userId)] >= ROLE_RANK.admin) return true;
    const roles = Array.isArray(ch.allowedRoles) ? ch.allowedRoles : [];
    return !roles.length || roles.includes(roleFor(s, userId));
  }

  function publicServer(s, userId = '') {
    normalizeServer(s);
    const visibleChannels = userId ? s.channels.filter(ch => canAccessChannel(s, ch, userId)) : s.channels;
    const visibleCategoryIds = new Set(visibleChannels.map(ch => ch.categoryId).filter(Boolean));
    const canManage = ROLE_RANK[roleFor(s, userId)] >= ROLE_RANK.moderator;
    return {
      id: s.id,
      name: s.name,
      icon: s.icon || '',
      ownerId: s.ownerId,
      inviteCode: s.inviteCode,
      members: s.members,
      memberRoles: s.memberRoles,
      channels: visibleChannels,
      categories: canManage ? s.categories : s.categories.filter(c => visibleCategoryIds.has(c.id))
    };
  }

  function getUserServers(userId) {
    return Object.values(db.servers).filter(s => s.members.includes(userId)).map(s => publicServer(s, userId));
  }

  function membership(socket, serverId) {
    const s = db.servers[serverId];
    return !!(s && socket.data.userId && s.members.includes(socket.data.userId));
  }

  function hasRole(socket, serverId, minimum) {
    const s = db.servers[serverId];
    if (!s || !membership(socket, serverId)) return false;
    return ROLE_RANK[roleFor(s, socket.data.userId)] >= ROLE_RANK[minimum];
  }

  function owner(socket, serverId) { return hasRole(socket, serverId, 'owner'); }
  function canManageChannels(socket, serverId) { return hasRole(socket, serverId, 'moderator'); }
  function canManageServer(socket, serverId) { return hasRole(socket, serverId, 'admin'); }

  function emitServerToUser(serverId, userId) {
    const s = db.servers[serverId];
    if (!s || !s.members.includes(userId)) return;
    io.to(`user:${userId}`).emit('server:updated', publicServer(s, userId));
  }

  function broadcastServer(serverId) {
    const s = db.servers[serverId];
    if (!s) return;
    for (const userId of s.members) emitServerToUser(serverId, userId);
  }

  function broadcastMembers(serverId) {
    const s = db.servers[serverId];
    if (!s) return;
    const members = s.members.map(id => ({
      ...publicUser(db.users[id] || normalizeUser({ id, name: 'Usuário', status: 'offline' }, id)),
      role: roleFor(s, id)
    }));
    io.to(`server:${serverId}`).emit('members:list', { serverId, members });
  }

  function emitChannelEvent(serverId, channelId, eventName, payload) {
    const s = db.servers[serverId];
    const ch = s?.channels.find(c => c.id === channelId);
    if (!s || !ch) return;
    for (const userId of s.members) if (canAccessChannel(s, ch, userId)) io.to(`user:${userId}`).emit(eventName, payload);
  }

  function voiceRoom(serverId, channelId) { return `voice:${serverId}:${channelId}`; }
  function dmKey(a, b) { return [String(a || ''), String(b || '')].sort().join('::'); }

  function usersShareServer(a, b) {
    if (!a || !b || a === b) return false;
    return Object.values(db.servers).some(s => s.members.includes(a) && s.members.includes(b));
  }

  function areFriends(a, b) {
    return !!(db.users[a]?.friends?.includes(b) && db.users[b]?.friends?.includes(a));
  }

  function isBlockedBetween(a, b) {
    return !!(db.users[a]?.blocked?.includes(b) || db.users[b]?.blocked?.includes(a));
  }

  function canDm(a, b) {
    return !!(a && b && a !== b && db.users[b] && !isBlockedBetween(a, b) && (areFriends(a, b) || usersShareServer(a, b)));
  }

  function socialState(userId) {
    const u = db.users[userId];
    if (!u) return { friends: [], incoming: [], outgoing: [], blocked: [] };
    const mapUsers = ids => uniqueStrings(ids).map(id => publicUser(db.users[id])).filter(Boolean);
    return {
      friends: mapUsers(u.friends),
      incoming: mapUsers(u.friendIncoming),
      outgoing: mapUsers(u.friendOutgoing),
      blocked: mapUsers(u.blocked)
    };
  }

  function emitSocial(userId) {
    io.to(`user:${userId}`).emit('social:state', socialState(userId));
  }

  function dmConversations(userId) {
    const rows = [];
    for (const [key, messages] of Object.entries(db.dms || {})) {
      const ids = key.split('::');
      if (!ids.includes(userId) || !Array.isArray(messages) || !messages.length) continue;
      const peerId = ids.find(id => id !== userId);
      if (!peerId || !db.users[peerId] || !canDm(userId, peerId)) continue;
      const last = messages[messages.length - 1];
      rows.push({ user: publicUser(db.users[peerId]), lastMessage: last });
    }
    rows.sort((a, b) => Number(b.lastMessage?.at || 0) - Number(a.lastMessage?.at || 0));
    return rows.slice(0, 50);
  }

  function emitDmConversations(userId) {
    io.to(`user:${userId}`).emit('dm:conversations', { conversations: dmConversations(userId) });
  }

  function findMessage(channelId, messageId) {
    return (db.messages[channelId] || []).find(m => m.id === messageId) || null;
  }

  function findDmMessage(a, b, messageId) {
    return (db.dms[dmKey(a, b)] || []).find(m => m.id === messageId) || null;
  }

  function mentionIdsFor(s, text) {
    const lower = String(text || '').toLocaleLowerCase('pt-BR');
    return s.members.filter(id => {
      const name = String(db.users[id]?.name || '').trim();
      return !!name && lower.includes(`@${name.toLocaleLowerCase('pt-BR')}`);
    });
  }

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
    const s = db.servers[serverId];
    if (!s) return;
    const entries = [];
    for (const sx of io.sockets.sockets.values()) {
      if (sx.data.voiceServerId === serverId && sx.data.voiceChannelId && sx.data.userId) {
        const ch = s.channels.find(c => c.id === sx.data.voiceChannelId);
        if (!ch || !canAccessChannel(s, ch, sx.data.userId)) continue;
        entries.push({
          channelId: sx.data.voiceChannelId,
          socketId: sx.id,
          user: publicUser(db.users[sx.data.userId]),
          mediaState: sx.data.mediaState || { muted: false, camera: false, screen: false },
          speaking: !!sx.data.speaking
        });
      }
    }
    for (const userId of s.members) {
      const visible = entries.filter(e => { const ch = s.channels.find(c => c.id === e.channelId); return ch && canAccessChannel(s, ch, userId); });
      io.to(`user:${userId}`).emit('voice:snapshot', { serverId, entries: visible });
    }
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
      emitChannelEvent(serverId, channelId, 'voice:presence-event', { type: 'leave', userId: socket.data.userId, channelId });
      emitVoiceSnapshot(serverId);
    }
  }

  io.on('connection', socket => {
    socket.on('auth:hello', payload => {
      const id = String(payload?.deviceId || '').trim().slice(0, 128);
      if (!id) return socket.emit('app:error', 'Identidade inválida.');
      const existing = normalizeUser(db.users[id] || {}, id);
      existing.name = String(payload?.name || existing.name || 'Amigo').trim().slice(0, 32) || 'Amigo';
      existing.avatar = String(payload?.avatar ?? existing.avatar ?? '').slice(0, 1_500_000);
      existing.status = ['online', 'busy', 'away'].includes(payload?.status) ? payload.status : 'online';
      existing.lastSeen = now();
      db.users[id] = existing;
      socket.data.userId = id;
      socket.join(`user:${id}`);
      getUserServers(id).forEach(s => socket.join(`server:${s.id}`));
      saveSoon();
      socket.emit('auth:ready', { user: publicUser(db.users[id]), servers: getUserServers(id) });
      socket.emit('dm:conversations', { conversations: dmConversations(id) });
      socket.emit('social:state', socialState(id));
      for (const friendId of db.users[id].friends) emitSocial(friendId);
      for (const s of getUserServers(id)) emitVoiceSnapshot(s.id);
      io.emit('presence:update', publicUser(db.users[id]));
    });

    socket.on('profile:update', payload => {
      const id = socket.data.userId;
      if (!id || !db.users[id]) return;
      if (payload?.name != null) db.users[id].name = String(payload.name).trim().slice(0, 32) || db.users[id].name;
      if (payload?.avatar != null) db.users[id].avatar = String(payload.avatar).slice(0, 1_500_000);
      if (['online', 'busy', 'away'].includes(payload?.status)) db.users[id].status = payload.status;
      if (payload?.customStatus != null) db.users[id].customStatus = String(payload.customStatus).trim().slice(0, 80);
      saveSoon();
      socket.emit('profile:updated', publicUser(db.users[id]));
      io.emit('presence:update', publicUser(db.users[id]));
      for (const s of getUserServers(id)) broadcastMembers(s.id);
      for (const friendId of db.users[id].friends) emitSocial(friendId);
    });

    socket.on('social:get', () => emitSocial(socket.data.userId));

    socket.on('friend:request', payload => {
      const fromId = socket.data.userId;
      const toId = String(payload?.userId || '');
      if (!fromId || !toId || fromId === toId || !db.users[toId]) return;
      if (!usersShareServer(fromId, toId) && !areFriends(fromId, toId)) return socket.emit('app:error', 'Vocês precisam estar em um servidor em comum para adicionar amizade.');
      if (isBlockedBetween(fromId, toId)) return socket.emit('app:error', 'Não é possível enviar solicitação para este usuário.');
      if (areFriends(fromId, toId)) return;
      const from = db.users[fromId], to = db.users[toId];
      if (!from.friendOutgoing.includes(toId)) from.friendOutgoing.push(toId);
      if (!to.friendIncoming.includes(fromId)) to.friendIncoming.push(fromId);
      saveSoon(); emitSocial(fromId); emitSocial(toId);
    });

    socket.on('friend:accept', payload => {
      const me = socket.data.userId;
      const other = String(payload?.userId || '');
      if (!me || !other || !db.users[other] || !db.users[me]?.friendIncoming.includes(other) || isBlockedBetween(me, other)) return;
      const a = db.users[me], b = db.users[other];
      a.friendIncoming = a.friendIncoming.filter(id => id !== other);
      a.friendOutgoing = a.friendOutgoing.filter(id => id !== other);
      b.friendIncoming = b.friendIncoming.filter(id => id !== me);
      b.friendOutgoing = b.friendOutgoing.filter(id => id !== me);
      if (!a.friends.includes(other)) a.friends.push(other);
      if (!b.friends.includes(me)) b.friends.push(me);
      saveSoon(); emitSocial(me); emitSocial(other); emitDmConversations(me); emitDmConversations(other);
    });

    socket.on('friend:reject', payload => {
      const me = socket.data.userId;
      const other = String(payload?.userId || '');
      if (!me || !other || !db.users[other]) return;
      db.users[me].friendIncoming = db.users[me].friendIncoming.filter(id => id !== other);
      db.users[me].friendOutgoing = db.users[me].friendOutgoing.filter(id => id !== other);
      db.users[other].friendIncoming = db.users[other].friendIncoming.filter(id => id !== me);
      db.users[other].friendOutgoing = db.users[other].friendOutgoing.filter(id => id !== me);
      saveSoon(); emitSocial(me); emitSocial(other);
    });

    socket.on('friend:remove', payload => {
      const me = socket.data.userId;
      const other = String(payload?.userId || '');
      if (!me || !other || !db.users[other]) return;
      db.users[me].friends = db.users[me].friends.filter(id => id !== other);
      db.users[other].friends = db.users[other].friends.filter(id => id !== me);
      saveSoon(); emitSocial(me); emitSocial(other); emitDmConversations(me); emitDmConversations(other);
    });

    socket.on('friend:block', payload => {
      const me = socket.data.userId;
      const other = String(payload?.userId || '');
      if (!me || !other || me === other || !db.users[other]) return;
      const a = db.users[me], b = db.users[other];
      if (!a.blocked.includes(other)) a.blocked.push(other);
      a.friends = a.friends.filter(id => id !== other);
      b.friends = b.friends.filter(id => id !== me);
      a.friendIncoming = a.friendIncoming.filter(id => id !== other);
      a.friendOutgoing = a.friendOutgoing.filter(id => id !== other);
      b.friendIncoming = b.friendIncoming.filter(id => id !== me);
      b.friendOutgoing = b.friendOutgoing.filter(id => id !== me);
      saveSoon(); emitSocial(me); emitSocial(other); emitDmConversations(me); emitDmConversations(other);
    });

    socket.on('friend:unblock', payload => {
      const me = socket.data.userId;
      const other = String(payload?.userId || '');
      if (!me || !other) return;
      db.users[me].blocked = db.users[me].blocked.filter(id => id !== other);
      saveSoon(); emitSocial(me);
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
        icon: '',
        ownerId: userId,
        inviteCode: inviteCode(),
        members: [userId],
        memberRoles: { [userId]: 'owner' },
        categories: [],
        channels: [
          { id: textId, type: 'text', name: 'geral', categoryId: null, allowedRoles: [] },
          { id: voiceId, type: 'voice', name: 'Geral', categoryId: null, allowedRoles: [] }
        ]
      };
      db.servers[serverId] = s;
      db.messages[textId] = [];
      socket.join(`server:${serverId}`);
      saveSoon();
      socket.emit('server:created', publicServer(s, userId));
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
      socket.emit('server:joined', publicServer(s, userId));
      broadcastServer(s.id);
      broadcastMembers(s.id);
      emitVoiceSnapshot(s.id);
    });

    socket.on('server:update', payload => {
      const serverId = payload?.serverId;
      if (!canManageServer(socket, serverId)) return socket.emit('app:error', 'Você não tem permissão para editar o servidor.');
      const s = db.servers[serverId];
      if (payload?.name != null) s.name = String(payload.name).trim().slice(0, 40) || s.name;
      if (payload?.icon != null) {
        if (String(payload.icon).length > 900_000) return socket.emit('app:error', 'A imagem do servidor é grande demais.');
        s.icon = String(payload.icon);
      }
      saveSoon(); broadcastServer(serverId);
    });

    socket.on('server:delete', async payload => {
      const serverId = payload?.serverId;
      const s = db.servers[serverId];
      if (!s || !owner(socket, serverId)) return socket.emit('app:error', 'Só o dono pode excluir o servidor.');
      for (const ch of s.channels) {
        if (ch.type === 'text') delete db.messages[ch.id];
        if (ch.type === 'voice') for (const sx of io.sockets.sockets.values()) if (sx.data.voiceServerId === serverId && sx.data.voiceChannelId === ch.id) await leaveVoice(sx);
      }
      const members = [...s.members];
      delete db.servers[serverId];
      saveSoon();
      for (const userId of members) {
        io.to(`user:${userId}`).emit('server:removed', { serverId, deleted: true });
        for (const sx of io.sockets.sockets.values()) if (sx.data.userId === userId) sx.leave(`server:${serverId}`);
      }
    });

    socket.on('server:leave', async payload => {
      const serverId = payload?.serverId;
      const userId = socket.data.userId;
      const s = db.servers[serverId];
      if (!s || !s.members.includes(userId)) return;
      if (s.ownerId === userId) return socket.emit('app:error', 'O dono precisa excluir o servidor em vez de sair.');
      s.members = s.members.filter(id => id !== userId);
      delete s.memberRoles[userId];
      if (socket.data.voiceServerId === serverId) await leaveVoice(socket);
      socket.leave(`server:${serverId}`);
      saveSoon(); socket.emit('server:removed', { serverId, left: true }); broadcastServer(serverId); broadcastMembers(serverId);
    });

    socket.on('server:regenerate-invite', payload => {
      const serverId = payload?.serverId;
      if (!canManageServer(socket, serverId)) return socket.emit('app:error', 'Você não tem permissão para renovar o convite.');
      db.servers[serverId].inviteCode = inviteCode(); saveSoon(); broadcastServer(serverId);
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
      for (const sx of io.sockets.sockets.values()) {
        if (sx.data.userId === targetUserId && sx.data.voiceServerId === serverId) {
          const voiceCh = s.channels.find(c => c.id === sx.data.voiceChannelId);
          if (voiceCh && !canAccessChannel(s, voiceCh, targetUserId)) leaveVoice(sx).catch(() => {});
        }
      }
      saveSoon(); broadcastServer(serverId); broadcastMembers(serverId); emitVoiceSnapshot(serverId);
    });

    socket.on('member:kick', async payload => {
      const serverId = payload?.serverId;
      const targetUserId = String(payload?.userId || '');
      const s = db.servers[serverId];
      if (!owner(socket, serverId)) return socket.emit('app:error', 'Só o dono pode remover membros.');
      if (!s || targetUserId === s.ownerId) return;
      s.members = s.members.filter(id => id !== targetUserId); delete s.memberRoles[targetUserId];
      for (const sx of io.sockets.sockets.values()) {
        if (sx.data.userId === targetUserId) {
          if (sx.data.voiceServerId === serverId) await leaveVoice(sx);
          sx.leave(`server:${serverId}`); sx.emit('server:removed', { serverId, kicked: true });
        }
      }
      saveSoon(); broadcastServer(serverId); broadcastMembers(serverId);
    });

    socket.on('category:create', payload => {
      const serverId = payload?.serverId;
      if (!canManageChannels(socket, serverId)) return socket.emit('app:error', 'Seu cargo não permite criar categorias.');
      const s = db.servers[serverId];
      if (s.categories.length >= 20) return socket.emit('app:error', 'Limite de categorias atingido.');
      const name = String(payload?.name || 'Categoria').trim().slice(0, 32) || 'Categoria';
      s.categories.push({ id: uid('cat_'), name }); saveSoon(); broadcastServer(serverId);
    });

    socket.on('category:update', payload => {
      const serverId = payload?.serverId;
      if (!canManageChannels(socket, serverId)) return socket.emit('app:error', 'Seu cargo não permite editar categorias.');
      const s = db.servers[serverId];
      const c = s?.categories.find(x => x.id === payload?.categoryId);
      if (!c) return;
      if (payload?.action === 'delete') {
        s.categories = s.categories.filter(x => x.id !== c.id);
        for (const ch of s.channels) if (ch.categoryId === c.id) ch.categoryId = null;
      } else if (payload?.name != null) c.name = String(payload.name).trim().slice(0, 32) || c.name;
      saveSoon(); broadcastServer(serverId);
    });

    socket.on('channel:create', payload => {
      const serverId = payload?.serverId;
      if (!canManageChannels(socket, serverId)) return socket.emit('app:error', 'Seu cargo não permite criar canais.');
      const s = db.servers[serverId];
      if (s.channels.length >= 40) return socket.emit('app:error', 'Limite de canais atingido.');
      const type = payload?.type === 'voice' ? 'voice' : 'text';
      const raw = String(payload?.name || (type === 'voice' ? 'Nova sala' : 'novo-canal')).trim().slice(0, 32);
      const name = type === 'text' ? raw.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9à-ú_-]/gi, '') || 'novo-canal' : raw || 'Nova sala';
      const categoryId = s.categories.some(c => c.id === payload?.categoryId) ? payload.categoryId : null;
      const allowedRoles = uniqueStrings(payload?.allowedRoles).filter(r => VALID_ROLES.has(r) && r !== 'owner');
      const ch = { id: uid(type === 'voice' ? 'vc_' : 'txt_'), type, name, categoryId, allowedRoles };
      s.channels.push(ch); if (type === 'text') db.messages[ch.id] = []; saveSoon(); broadcastServer(serverId);
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
        if (ch.type === 'voice') for (const sx of io.sockets.sockets.values()) if (sx.data.voiceServerId === serverId && sx.data.voiceChannelId === channelId) await leaveVoice(sx);
        s.channels = s.channels.filter(c => c.id !== channelId); delete db.messages[channelId];
      } else {
        if (payload?.name != null) {
          const raw = String(payload.name).trim().slice(0, 32);
          ch.name = ch.type === 'text' ? raw.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9à-ú_-]/gi, '') || ch.name : raw || ch.name;
        }
        if (payload?.categoryId !== undefined) ch.categoryId = s.categories.some(c => c.id === payload.categoryId) ? payload.categoryId : null;
        if (payload?.allowedRoles !== undefined) ch.allowedRoles = uniqueStrings(payload.allowedRoles).filter(r => VALID_ROLES.has(r) && r !== 'owner');
        if (ch.type === 'voice') {
          for (const sx of io.sockets.sockets.values()) {
            if (sx.data.voiceServerId === serverId && sx.data.voiceChannelId === ch.id && !canAccessChannel(s, ch, sx.data.userId)) await leaveVoice(sx);
          }
        }
      }
      saveSoon(); broadcastServer(serverId); emitVoiceSnapshot(serverId);
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
      if (to < 0) to = s.channels.length;
      s.channels.splice(to, 0, moved); saveSoon(); broadcastServer(serverId);
    });

    socket.on('messages:load', payload => {
      const { serverId, channelId } = payload || {};
      if (!membership(socket, serverId)) return;
      const s = db.servers[serverId];
      const ch = s?.channels.find(c => c.id === channelId && c.type === 'text');
      if (!ch || !canAccessChannel(s, ch, socket.data.userId)) return;
      socket.emit('messages:list', { channelId, messages: (db.messages[channelId] || []).slice(-200) });
    });

    socket.on('message:send', payload => {
      const { serverId, channelId } = payload || {};
      if (!membership(socket, serverId)) return;
      const text = String(payload?.text || '').trim().slice(0, 2000);
      if (!text) return;
      const s = db.servers[serverId];
      const ch = s?.channels.find(c => c.id === channelId && c.type === 'text');
      if (!ch || !canAccessChannel(s, ch, socket.data.userId)) return;
      const replyToId = payload?.replyToId && findMessage(channelId, String(payload.replyToId)) ? String(payload.replyToId) : null;
      const m = { id: uid('msg_'), serverId, channelId, authorId: socket.data.userId, text, at: now(), editedAt: null, replyToId, reactions: {}, mentionIds: mentionIdsFor(s, text) };
      db.messages[channelId] = db.messages[channelId] || [];
      db.messages[channelId].push(m);
      if (db.messages[channelId].length > 2000) db.messages[channelId] = db.messages[channelId].slice(-2000);
      saveSoon(); emitChannelEvent(serverId, channelId, 'message:new', m);
      for (const userId of m.mentionIds) if (userId !== socket.data.userId) io.to(`user:${userId}`).emit('mention:new', { serverId, channelId, messageId: m.id, from: publicUser(db.users[socket.data.userId]) });
    });

    socket.on('message:edit', payload => {
      const { serverId, channelId, messageId } = payload || {};
      if (!membership(socket, serverId)) return;
      const s = db.servers[serverId], ch = s?.channels.find(c => c.id === channelId && c.type === 'text');
      if (!ch || !canAccessChannel(s, ch, socket.data.userId)) return;
      const m = findMessage(channelId, String(messageId || ''));
      if (!m || m.authorId !== socket.data.userId) return socket.emit('app:error', 'Você só pode editar suas próprias mensagens.');
      const text = String(payload?.text || '').trim().slice(0, 2000);
      if (!text) return;
      m.text = text; m.editedAt = now(); m.mentionIds = mentionIdsFor(s, text); saveSoon(); emitChannelEvent(serverId, channelId, 'message:updated', m);
    });

    socket.on('message:delete', payload => {
      const { serverId, channelId, messageId } = payload || {};
      if (!membership(socket, serverId)) return;
      const s = db.servers[serverId], ch = s?.channels.find(c => c.id === channelId && c.type === 'text');
      if (!ch || !canAccessChannel(s, ch, socket.data.userId)) return;
      const arr = db.messages[channelId] || [], m = arr.find(x => x.id === messageId);
      if (!m) return;
      if (m.authorId !== socket.data.userId && !hasRole(socket, serverId, 'moderator')) return socket.emit('app:error', 'Você não pode apagar essa mensagem.');
      db.messages[channelId] = arr.filter(x => x.id !== messageId); saveSoon(); emitChannelEvent(serverId, channelId, 'message:deleted', { channelId, messageId });
    });

    socket.on('message:react', payload => {
      const { serverId, channelId, messageId } = payload || {};
      const emoji = String(payload?.emoji || '');
      if (!QUICK_REACTIONS.has(emoji) || !membership(socket, serverId)) return;
      const s = db.servers[serverId], ch = s?.channels.find(c => c.id === channelId && c.type === 'text');
      if (!ch || !canAccessChannel(s, ch, socket.data.userId)) return;
      const m = findMessage(channelId, String(messageId || '')); if (!m) return;
      m.reactions = m.reactions && typeof m.reactions === 'object' ? m.reactions : {};
      const ids = uniqueStrings(m.reactions[emoji]);
      m.reactions[emoji] = ids.includes(socket.data.userId) ? ids.filter(id => id !== socket.data.userId) : [...ids, socket.data.userId];
      if (!m.reactions[emoji].length) delete m.reactions[emoji];
      saveSoon(); emitChannelEvent(serverId, channelId, 'message:updated', m);
    });

    socket.on('members:get', payload => {
      const serverId = payload?.serverId;
      if (!membership(socket, serverId)) return;
      broadcastMembers(serverId); emitVoiceSnapshot(serverId);
    });

    socket.on('dm:conversations:get', () => { if (socket.data.userId) socket.emit('dm:conversations', { conversations: dmConversations(socket.data.userId) }); });

    socket.on('dm:load', payload => {
      const userId = socket.data.userId;
      const peerId = String(payload?.userId || '').trim();
      if (!canDm(userId, peerId)) return socket.emit('app:error', 'Essa conversa privada não está disponível.');
      const messages = Array.isArray(db.dms[dmKey(userId, peerId)]) ? db.dms[dmKey(userId, peerId)] : [];
      socket.emit('dm:list', { user: publicUser(db.users[peerId]), messages: messages.slice(-250) });
    });

    socket.on('dm:send', payload => {
      const fromId = socket.data.userId;
      const toId = String(payload?.userId || '').trim();
      const text = String(payload?.text || '').trim().slice(0, 2000);
      if (!fromId || !toId || !text) return;
      if (!canDm(fromId, toId)) return socket.emit('app:error', 'Essa conversa privada não está disponível.');
      const key = dmKey(fromId, toId);
      const replyToId = payload?.replyToId && findDmMessage(fromId, toId, String(payload.replyToId)) ? String(payload.replyToId) : null;
      const message = { id: uid('dm_'), fromId, toId, text, at: now(), editedAt: null, replyToId, reactions: {} };
      db.dms[key] = Array.isArray(db.dms[key]) ? db.dms[key] : [];
      db.dms[key].push(message); if (db.dms[key].length > 1500) db.dms[key] = db.dms[key].slice(-1500);
      saveSoon();
      const payloadOut = { message, from: publicUser(db.users[fromId]), to: publicUser(db.users[toId]) };
      io.to(`user:${fromId}`).emit('dm:new', payloadOut); io.to(`user:${toId}`).emit('dm:new', payloadOut); emitDmConversations(fromId); emitDmConversations(toId);
    });

    socket.on('dm:edit', payload => {
      const me = socket.data.userId, peerId = String(payload?.userId || '');
      if (!canDm(me, peerId)) return;
      const m = findDmMessage(me, peerId, String(payload?.messageId || ''));
      if (!m || m.fromId !== me) return socket.emit('app:error', 'Você só pode editar suas próprias mensagens.');
      const text = String(payload?.text || '').trim().slice(0, 2000); if (!text) return;
      m.text = text; m.editedAt = now(); saveSoon();
      io.to(`user:${me}`).emit('dm:updated', { userId: peerId, message: m }); io.to(`user:${peerId}`).emit('dm:updated', { userId: me, message: m }); emitDmConversations(me); emitDmConversations(peerId);
    });

    socket.on('dm:delete', payload => {
      const me = socket.data.userId, peerId = String(payload?.userId || '');
      if (!canDm(me, peerId)) return;
      const key = dmKey(me, peerId), arr = db.dms[key] || [], m = arr.find(x => x.id === payload?.messageId);
      if (!m || m.fromId !== me) return socket.emit('app:error', 'Você só pode apagar suas próprias mensagens.');
      db.dms[key] = arr.filter(x => x.id !== payload.messageId); saveSoon();
      io.to(`user:${me}`).emit('dm:deleted', { userId: peerId, messageId: payload.messageId }); io.to(`user:${peerId}`).emit('dm:deleted', { userId: me, messageId: payload.messageId }); emitDmConversations(me); emitDmConversations(peerId);
    });

    socket.on('dm:react', payload => {
      const me = socket.data.userId, peerId = String(payload?.userId || ''), emoji = String(payload?.emoji || '');
      if (!canDm(me, peerId) || !QUICK_REACTIONS.has(emoji)) return;
      const m = findDmMessage(me, peerId, String(payload?.messageId || '')); if (!m) return;
      m.reactions = m.reactions && typeof m.reactions === 'object' ? m.reactions : {};
      const ids = uniqueStrings(m.reactions[emoji]); m.reactions[emoji] = ids.includes(me) ? ids.filter(id => id !== me) : [...ids, me]; if (!m.reactions[emoji].length) delete m.reactions[emoji];
      saveSoon(); io.to(`user:${me}`).emit('dm:updated', { userId: peerId, message: m }); io.to(`user:${peerId}`).emit('dm:updated', { userId: me, message: m });
    });

    socket.on('voice:join', async payload => {
      const { serverId, channelId } = payload || {};
      if (!membership(socket, serverId)) return;
      const s = db.servers[serverId], ch = s?.channels.find(c => c.id === channelId && c.type === 'voice');
      if (!ch || !canAccessChannel(s, ch, socket.data.userId)) return socket.emit('app:error', 'Você não tem acesso a essa sala de voz.');
      if (socket.data.voiceRoom) await leaveVoice(socket);
      const room = voiceRoom(serverId, channelId), sockets = await io.in(room).fetchSockets();
      if (sockets.length >= 5) return socket.emit('voice:full', { channelId });
      socket.data.voiceRoom = room; socket.data.voiceServerId = serverId; socket.data.voiceChannelId = channelId; socket.data.speaking = false; socket.join(room);
      socket.data.mediaState = socket.data.mediaState || { muted: false, camera: false, screen: false };
      const peers = sockets.map(sx => ({ socketId: sx.id, user: publicUser(db.users[sx.data.userId]), mediaState: sx.data.mediaState || { muted: false, camera: false, screen: false } }));
      socket.emit('voice:peers', { channelId, peers }); socket.to(room).emit('voice:user-joined', { socketId: socket.id, user: publicUser(db.users[socket.data.userId]), mediaState: socket.data.mediaState });
      emitChannelEvent(serverId, channelId, 'voice:presence-event', { type: 'join', userId: socket.data.userId, channelId }); emitVoiceSnapshot(serverId);
    });

    socket.on('voice:leave', () => leaveVoice(socket));
    socket.on('voice:media-state', payload => {
      if (!socket.data.voiceRoom) return;
      const mediaState = { muted: !!payload?.muted, camera: !!payload?.camera, screen: !!payload?.screen };
      socket.data.mediaState = mediaState; socket.to(socket.data.voiceRoom).emit('voice:media-state', { socketId: socket.id, mediaState });
      if (socket.data.voiceServerId) emitChannelEvent(socket.data.voiceServerId, socket.data.voiceChannelId, 'voice:media-state-global', { socketId: socket.id, userId: socket.data.userId, channelId: socket.data.voiceChannelId, mediaState });
    });
    socket.on('voice:speaking', payload => {
      if (!socket.data.voiceRoom) return;
      socket.data.speaking = !!payload?.speaking; socket.to(socket.data.voiceRoom).emit('voice:speaking', { socketId: socket.id, speaking: socket.data.speaking });
      if (socket.data.voiceServerId) emitChannelEvent(socket.data.voiceServerId, socket.data.voiceChannelId, 'voice:speaking-global', { socketId: socket.id, userId: socket.data.userId, channelId: socket.data.voiceChannelId, speaking: socket.data.speaking });
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
          db.users[id].status = 'offline'; db.users[id].lastSeen = now(); saveSoon(); io.emit('presence:update', publicUser(db.users[id]));
          for (const s of getUserServers(id)) broadcastMembers(s.id);
          for (const friendId of db.users[id].friends) emitSocial(friendId);
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

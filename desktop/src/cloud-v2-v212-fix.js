/* Banana Cord V2.0.12 — permissions + private voice calls.
 * This file is bundled into cloud-v2-all.browser.js so Firebase stays on the
 * same runtime used by the rest of Banana Cloud.
 */
(() => {
  if (window.__bananaV212CloudFix) return;
  window.__bananaV212CloudFix = true;

  const {
    doc, collection, getDoc, getDocs, setDoc, onSnapshot,
    query, where, serverTimestamp
  } = require('firebase/firestore');
  const {
    ref, set, update, remove, get, onValue, onDisconnect,
    serverTimestamp: rtdbTimestamp
  } = require('firebase/database');

  const ROLE_RANK = { member: 0, moderator: 1, admin: 2, owner: 3 };
  const pair = (a, b) => [String(a), String(b)].sort();
  const pairId = (a, b) => pair(a, b).join('_');

  function minimumRoleForChannel(channel) {
    const roles = Array.isArray(channel?.allowedRoles) ? channel.allowedRoles : [];
    if (!roles.length) return 'member';
    let min = 'owner';
    for (const role of roles) {
      if (ROLE_RANK[role] == null) continue;
      if (ROLE_RANK[role] < ROLE_RANK[min]) min = role;
    }
    return min;
  }

  function roleCanAccessChannel(role, channel) {
    const roles = Array.isArray(channel?.allowedRoles) ? channel.allowedRoles : [];
    if (!roles.length) return true;
    if (role === 'owner') return true;
    const min = minimumRoleForChannel(channel);
    return (ROLE_RANK[role] ?? -1) >= (ROLE_RANK[min] ?? 99);
  }

  function patchSocket(socket) {
    if (!socket || socket.__bananaV212CloudPatched) return false;
    if (typeof socket.handle !== 'function' || !socket.user || !socket.db) return false;
    socket.__bananaV212CloudPatched = true;

    socket.loadServer = async function loadServerV212(serverId) {
      const sSnap = await getDoc(doc(this.db, 'servers', serverId));
      if (!sSnap.exists()) return null;
      const s = sSnap.data();
      const [channelsSnap, membersSnap] = await Promise.all([
        getDocs(collection(this.db, 'servers', serverId, 'channels')),
        getDocs(collection(this.db, 'servers', serverId, 'members'))
      ]);
      const memberRoles = {}, members = [];
      membersSnap.forEach(m => {
        members.push(m.id);
        memberRoles[m.id] = m.data().role || (m.id === s.ownerId ? 'owner' : 'member');
      });
      const myRole = memberRoles[this.user.uid] || (s.ownerId === this.user.uid ? 'owner' : 'member');
      const channels = channelsSnap.docs.map(c => ({ id: c.id, ...c.data() })).sort((a, b) => Number(a.position || 0) - Number(b.position || 0));
      const visible = channels.filter(channel => roleCanAccessChannel(myRole, channel));
      const server = {
        id: serverId, name: s.name || 'Servidor', icon: s.icon || '', ownerId: s.ownerId,
        inviteCode: s.inviteCode || '', members, memberRoles,
        channels: visible.map(c => ({
          id: c.id, type: c.type === 'voice' ? 'voice' : 'text', name: c.name || 'canal',
          categoryId: c.categoryId || null, allowedRoles: c.allowedRoles || []
        })),
        categories: Array.isArray(s.categories) ? s.categories : []
      };
      this.serverCache.set(serverId, server);
      this.memberCache.set(serverId, new Map(membersSnap.docs.map(m => [m.id, m.data()])));
      return server;
    };

    socket.startDirectCallV212 = async function startDirectCallV212(peerId) {
      if (!peerId || peerId === this.user.uid) throw new Error('Contato inválido para chamada privada.');
      if (!(await this.canDm(peerId))) throw new Error('Essa chamada privada não está disponível.');
      const tid = pairId(this.user.uid, peerId);
      const startedAt = Date.now();
      await setDoc(doc(this.db, 'dmThreads', tid), {
        participants: pair(this.user.uid, peerId), updatedAt: serverTimestamp(),
        activeCall: { id: `call_${tid}`, startedBy: this.user.uid, startedAt }
      }, { merge: true });
      return { peerId, startedAt };
    };

    socket.endDirectCallV212 = async function endDirectCallV212(peerId) {
      if (!peerId || peerId === this.user.uid) return;
      const tid = pairId(this.user.uid, peerId);
      await setDoc(doc(this.db, 'dmThreads', tid), {
        participants: pair(this.user.uid, peerId), updatedAt: serverTimestamp(), activeCall: null
      }, { merge: true }).catch(() => {});
    };

    socket.watchDirectCallsV212 = function watchDirectCallsV212() {
      if (this.__bananaDirectCallsCleanup) return;
      const q = query(collection(this.db, 'dmThreads'), where('participants', 'array-contains', this.user.uid));
      const off = onSnapshot(q, snap => {
        const calls = [], now = Date.now();
        for (const row of snap.docs) {
          const data = row.data() || {}, activeCall = data.activeCall;
          if (!activeCall || !activeCall.startedAt) continue;
          if (now - Number(activeCall.startedAt) > 10 * 60 * 1000) continue;
          const peerId = (data.participants || []).find(uid => uid !== this.user.uid);
          if (peerId) calls.push({ peerId, activeCall });
        }
        this.receive('dm:call-state', { calls });
      }, error => this.receive('app:error', this.friendly(error)));
      this.__bananaDirectCallsCleanup = off;
      this.cleanup.push(() => { try { off(); } catch {} this.__bananaDirectCallsCleanup = null; });
    };

    const baseStart = socket.start.bind(socket);
    socket.start = async function startV212(...args) {
      const result = await baseStart(...args);
      this.watchDirectCallsV212();
      return result;
    };

    const baseJoinVoice = socket.joinVoice.bind(socket);
    socket.joinVoice = async function joinVoiceV212(payload = {}) {
      const directUserId = String(payload.directUserId || '');
      if (!directUserId) {
        const channelSnap = await getDoc(doc(this.db, 'servers', payload.serverId, 'channels', payload.channelId));
        if (!channelSnap.exists() || channelSnap.data()?.type !== 'voice') throw new Error('Sala de voz não encontrada.');
        const myRole = await this.role(payload.serverId);
        if (!roleCanAccessChannel(myRole, channelSnap.data())) throw new Error('Seu cargo não permite entrar nessa sala de voz.');
        return baseJoinVoice(payload);
      }

      if (!this.rtdb) throw new Error('Voz privada indisponível no momento.');
      if (directUserId === this.user.uid) throw new Error('Você não pode ligar para si mesmo.');
      if (!(await this.canDm(directUserId))) throw new Error('Essa chamada privada não está disponível.');
      if (this.voice) await this.leaveVoice();

      const [uidA, uidB] = pair(this.user.uid, directUserId);
      const roomKey = `dm_${uidA}_${uidB}`;
      const roomRef = ref(this.rtdb, `voiceRooms/${roomKey}/direct`);
      const snap = await get(roomRef), sessions = snap.val() || {};
      const others = Object.entries(sessions).filter(([sid]) => sid !== this.id);
      const uniqueOthers = new Map();
      for (const [sid, entry] of others) {
        if (!entry?.userId || entry.userId === this.user.uid) continue;
        uniqueOthers.set(entry.userId, [sid, entry]);
      }
      if (uniqueOthers.size >= 1 && !uniqueOthers.has(directUserId)) throw new Error('Essa chamada privada já está ocupada.');

      const me = await this.publicUser(this.user.uid);
      this.voice = { serverId: roomKey, channelId: 'direct', directPair: [uidA, uidB], directPeerId: directUserId };
      const myRef = ref(this.rtdb, `voiceRooms/${roomKey}/direct/${this.id}`);
      await set(myRef, {
        userId: this.user.uid, user: me,
        mediaState: { muted: false, camera: false, screen: false },
        speaking: false, joinedAt: rtdbTimestamp()
      });
      await onDisconnect(myRef).remove();
      try { this.__bananaDirectVoiceCleanup?.(); } catch {}
      this.__bananaDirectVoiceCleanup = onValue(roomRef, roomSnap => {
        this.processVoiceServer(roomKey, { direct: roomSnap.val() || {} });
      });
      this.receive('voice:peers', {
        channelId: 'direct',
        peers: [...uniqueOthers.values()].map(([socketId, entry]) => ({
          socketId, user: entry.user || { id: entry.userId, name: 'Amigo' }, mediaState: entry.mediaState || {}
        }))
      });
    };

    const baseLeaveVoice = socket.leaveVoice.bind(socket);
    socket.leaveVoice = async function leaveVoiceV212() {
      if (!this.voice?.directPeerId || !this.rtdb) return baseLeaveVoice();
      const current = this.voice;
      this.voice = null;
      const [uidA, uidB] = current.directPair || pair(this.user.uid, current.directPeerId);
      const roomKey = current.serverId || `dm_${uidA}_${uidB}`;
      const myRef = ref(this.rtdb, `voiceRooms/${roomKey}/direct/${this.id}`);
      try { await onDisconnect(myRef).cancel(); } catch {}
      await remove(myRef).catch(() => {});
      try { this.__bananaDirectVoiceCleanup?.(); } catch {}
      this.__bananaDirectVoiceCleanup = null;
      await this.endDirectCallV212(current.directPeerId);
    };

    const baseVoiceMedia = socket.voiceMedia.bind(socket);
    socket.voiceMedia = async function voiceMediaV212(mediaState = {}) {
      if (!this.voice?.directPeerId || !this.rtdb) return baseVoiceMedia(mediaState);
      const [uidA, uidB] = this.voice.directPair || pair(this.user.uid, this.voice.directPeerId);
      const roomKey = this.voice.serverId || `dm_${uidA}_${uidB}`;
      await update(ref(this.rtdb, `voiceRooms/${roomKey}/direct/${this.id}`), {
        mediaState: { muted: !!mediaState.muted, camera: false, screen: false }
      });
    };

    const baseVoiceSpeaking = socket.voiceSpeaking.bind(socket);
    socket.voiceSpeaking = async function voiceSpeakingV212(payload = {}) {
      if (!this.voice?.directPeerId || !this.rtdb) return baseVoiceSpeaking(payload);
      const [uidA, uidB] = this.voice.directPair || pair(this.user.uid, this.voice.directPeerId);
      const roomKey = this.voice.serverId || `dm_${uidA}_${uidB}`;
      await update(ref(this.rtdb, `voiceRooms/${roomKey}/direct/${this.id}`), { speaking: !!payload.speaking });
    };

    const baseDisconnect = socket.disconnect.bind(socket);
    socket.disconnect = async function disconnectV212(...args) {
      if (this.voice?.directPeerId) { try { await this.leaveVoice(); } catch {} }
      return baseDisconnect(...args);
    };

    const baseHandle = socket.handle.bind(socket);
    socket.handle = async function handleV212(event, payload = {}, ack) {
      if (event === 'dm:call:start') {
        const result = await this.startDirectCallV212(payload.userId);
        ack?.({ ok: true, ...result });
        return;
      }
      if (event === 'dm:call:end') {
        await this.endDirectCallV212(payload.userId);
        ack?.({ ok: true });
        return;
      }
      if (event === 'dm:call:get') {
        this.watchDirectCallsV212();
        ack?.({ ok: true });
        return;
      }
      return baseHandle(event, payload, ack);
    };

    queueMicrotask(async () => {
      for (const serverId of [...(socket.knownServerIds || [])]) {
        const server = await socket.loadServer(serverId).catch(() => null);
        if (server) socket.receive('server:updated', server);
      }
    });
    return true;
  }

  if (window.BananaLegacy?.attachSocket) {
    const previousAttachSocket = window.BananaLegacy.attachSocket;
    window.BananaLegacy.attachSocket = function attachSocketV212(socket, user) {
      patchSocket(socket);
      return previousAttachSocket(socket, user);
    };
  }
  if (window.BananaCloudSocket) patchSocket(window.BananaCloudSocket);
  window.BananaV212PatchCloudSocket = patchSocket;
  window.BananaV212RoleCanAccessChannel = roleCanAccessChannel;
})();

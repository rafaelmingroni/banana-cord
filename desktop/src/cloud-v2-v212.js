/* Banana Cord V2.0.12 — hierarchical channel access + private 1:1 calls.
 * This file is bundled into the single Banana Cloud browser runtime so all
 * Firebase references use the same SDK instance as the rest of the app.
 */
(() => {
  const { doc, collection, getDoc, getDocs } = require('firebase/firestore');
  const {
    ref, set, update, remove, get, onValue, onChildAdded, onDisconnect,
    serverTimestamp: rtdbTimestamp
  } = require('firebase/database');

  const ROLE_RANK = { member: 0, moderator: 1, admin: 2, owner: 3 };
  const ACCESS_ROLES = ['member', 'moderator', 'admin'];
  const PRIVATE_SERVER_ID = '__private__';

  const unique = values => [...new Set((values || []).filter(Boolean).map(String))];
  const roomId = () => `pv_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;

  function normalizeAllowedRoles(values) {
    const valid = unique(values).filter(role => ACCESS_ROLES.includes(role));
    if (!valid.length) return [];
    const minimum = Math.min(...valid.map(role => ROLE_RANK[role]));
    return ACCESS_ROLES.filter(role => ROLE_RANK[role] >= minimum);
  }

  function canAccess(role, allowedRoles) {
    const normalized = normalizeAllowedRoles(allowedRoles);
    if (!normalized.length) return true;
    const minimum = Math.min(...normalized.map(item => ROLE_RANK[item]));
    return (ROLE_RANK[role] ?? 0) >= minimum;
  }

  function patchSocket(socket) {
    if (!socket || socket.__bananaV212CloudPatched) return false;
    if (
      typeof socket.handle !== 'function' || typeof socket.loadServer !== 'function' ||
      typeof socket.publicUser !== 'function' || !socket.db || !socket.rtdb || !socket.user?.uid
    ) return false;

    socket.__bananaV212CloudPatched = true;
    socket.privateCallOutgoing ||= new Map();
    socket.privateRoomOff ||= null;
    socket.privateCallHadPeer = false;

    // Interpret allowedRoles as a minimum role. Existing channels written by older
    // versions continue to work: ['moderator'] means moderator + admin + owner.
    socket.loadServer = async function loadServerV212(serverId) {
      const sSnap = await getDoc(doc(this.db, 'servers', serverId));
      if (!sSnap.exists()) return null;
      const s = sSnap.data();
      const [channelsSnap, membersSnap] = await Promise.all([
        getDocs(collection(this.db, 'servers', serverId, 'channels')),
        getDocs(collection(this.db, 'servers', serverId, 'members'))
      ]);

      const memberRoles = {}, members = [];
      membersSnap.forEach(member => {
        members.push(member.id);
        memberRoles[member.id] = member.data().role || (member.id === s.ownerId ? 'owner' : 'member');
      });
      const myRole = memberRoles[this.user.uid] || (s.ownerId === this.user.uid ? 'owner' : 'member');
      const channels = channelsSnap.docs
        .map(channel => ({ id: channel.id, ...channel.data() }))
        .sort((a, b) => Number(a.position || 0) - Number(b.position || 0));
      const visible = channels.filter(channel => canAccess(myRole, channel.allowedRoles));

      const server = {
        id: serverId,
        name: s.name || 'Servidor',
        icon: s.icon || '',
        ownerId: s.ownerId,
        inviteCode: s.inviteCode || '',
        members,
        memberRoles,
        channels: visible.map(channel => ({
          id: channel.id,
          type: channel.type === 'voice' ? 'voice' : 'text',
          name: channel.name || 'canal',
          categoryId: channel.categoryId || null,
          allowedRoles: normalizeAllowedRoles(channel.allowedRoles)
        })),
        categories: Array.isArray(s.categories) ? s.categories : []
      };

      this.serverCache.set(serverId, server);
      this.memberCache.set(serverId, new Map(membersSnap.docs.map(member => [member.id, member.data()])));
      return server;
    };

    const originalLeaveVoice = socket.leaveVoice.bind(socket);
    const originalVoiceMedia = socket.voiceMedia.bind(socket);
    const originalVoiceSpeaking = socket.voiceSpeaking.bind(socket);
    const originalHandle = socket.handle.bind(socket);

    socket.leaveVoice = async function leaveVoiceV212() {
      if (!this.voice || this.voice.serverId !== PRIVATE_SERVER_ID) return originalLeaveVoice();
      const active = this.voice;
      this.voice = null;
      this.privateCallHadPeer = false;
      try { this.privateRoomOff?.(); } catch {}
      this.privateRoomOff = null;

      const sessionRef = ref(this.rtdb, `privateVoiceRooms/${active.channelId}/sessions/${this.id}`);
      try { await onDisconnect(sessionRef).cancel(); } catch {}
      await remove(sessionRef).catch(() => {});

      try {
        const sessionsRef = ref(this.rtdb, `privateVoiceRooms/${active.channelId}/sessions`);
        const remaining = (await get(sessionsRef)).val() || {};
        if (!Object.keys(remaining).length) await remove(ref(this.rtdb, `privateVoiceRooms/${active.channelId}`));
      } catch {}

      this.receive('private-call:ended', { roomId: active.channelId, peerId: active.peerId || '' });
    };

    socket.voiceMedia = async function voiceMediaV212(mediaState) {
      if (this.voice?.serverId !== PRIVATE_SERVER_ID) return originalVoiceMedia(mediaState);
      await update(ref(this.rtdb, `privateVoiceRooms/${this.voice.channelId}/sessions/${this.id}`), {
        mediaState: {
          muted: !!mediaState.muted,
          camera: !!mediaState.camera,
          screen: !!mediaState.screen
        }
      });
    };

    socket.voiceSpeaking = async function voiceSpeakingV212(payload) {
      if (this.voice?.serverId !== PRIVATE_SERVER_ID) return originalVoiceSpeaking(payload);
      await update(ref(this.rtdb, `privateVoiceRooms/${this.voice.channelId}/sessions/${this.id}`), {
        speaking: !!payload.speaking
      });
    };

    socket.startPrivateCall = async function startPrivateCallV212(peerId, ack) {
      if (!peerId || peerId === this.user.uid) throw new Error('Escolha outra pessoa para ligar.');
      if (!(await this.canDm(peerId))) throw new Error('A ligação privada não está disponível para este usuário.');

      const sessions = (await get(ref(this.rtdb, 'sessionOwners'))).val() || {};
      const online = Object.values(sessions).some(uid => uid === peerId);
      if (!online) throw new Error('Esse usuário está offline no momento.');

      const id = roomId();
      const inviteId = id;
      const me = await this.publicUser(this.user.uid);
      const peer = await this.publicUser(peerId);
      const roomRef = ref(this.rtdb, `privateVoiceRooms/${id}`);
      const inviteRef = ref(this.rtdb, `privateCallInvites/${peerId}/${inviteId}`);

      await set(roomRef, {
        callerId: this.user.uid,
        calleeId: peerId,
        createdAt: rtdbTimestamp()
      });
      await set(inviteRef, {
        roomId: id,
        fromUserId: this.user.uid,
        fromUser: me,
        toUserId: peerId,
        status: 'ringing',
        createdAt: rtdbTimestamp()
      });

      const off = onValue(inviteRef, snap => {
        const value = snap.val();
        if (!value) return;
        this.receive('private-call:status', {
          inviteId,
          roomId: id,
          peerId,
          peer,
          status: value.status || 'ringing'
        });
      });
      this.privateCallOutgoing.set(inviteId, { off, peerId, roomId: id, inviteRef });
      this.cleanup.push(off);
      ack?.({ ok: true, inviteId, roomId: id, peer });
    };

    socket.respondPrivateCall = async function respondPrivateCallV212(payload, ack) {
      const inviteId = String(payload.inviteId || '');
      if (!inviteId) throw new Error('Convite de ligação inválido.');
      const inviteRef = ref(this.rtdb, `privateCallInvites/${this.user.uid}/${inviteId}`);
      const snap = await get(inviteRef);
      if (!snap.exists()) throw new Error('Essa ligação não está mais disponível.');
      const invite = snap.val();
      if (invite.toUserId !== this.user.uid || invite.status !== 'ringing') throw new Error('Essa ligação já foi encerrada.');

      const accepted = !!payload.accept;
      await update(inviteRef, {
        status: accepted ? 'accepted' : 'declined',
        respondedAt: rtdbTimestamp()
      });
      const peer = await this.publicUser(invite.fromUserId);
      ack?.({
        ok: true,
        accepted,
        inviteId,
        roomId: invite.roomId,
        peerId: invite.fromUserId,
        peer
      });
    };

    socket.cancelPrivateCall = async function cancelPrivateCallV212(payload, ack) {
      const inviteId = String(payload.inviteId || '');
      const peerId = String(payload.peerId || '');
      if (!inviteId || !peerId) return ack?.({ ok: false });
      const inviteRef = ref(this.rtdb, `privateCallInvites/${peerId}/${inviteId}`);
      const snap = await get(inviteRef);
      if (snap.exists() && snap.val()?.fromUserId === this.user.uid && snap.val()?.status === 'ringing') {
        await update(inviteRef, { status: 'cancelled', respondedAt: rtdbTimestamp() });
      }
      ack?.({ ok: true });
    };

    socket.joinPrivateCall = async function joinPrivateCallV212(payload, ack) {
      const id = String(payload.roomId || '');
      const peerId = String(payload.peerId || '');
      if (!id || !peerId) throw new Error('Ligação privada inválida.');
      if (!(await this.canDm(peerId))) throw new Error('Essa ligação privada não está mais disponível.');

      const roomRef = ref(this.rtdb, `privateVoiceRooms/${id}`);
      const roomSnap = await get(roomRef);
      if (!roomSnap.exists()) throw new Error('Essa ligação já terminou.');
      const room = roomSnap.val() || {};
      if (![room.callerId, room.calleeId].includes(this.user.uid) || ![room.callerId, room.calleeId].includes(peerId)) {
        throw new Error('Você não participa dessa ligação.');
      }

      if (this.voice) await this.leaveVoice();
      const sessionsRef = ref(this.rtdb, `privateVoiceRooms/${id}/sessions`);
      const existing = (await get(sessionsRef)).val() || {};

      // Remove a stale session from this same account before joining again.
      for (const [sessionId, row] of Object.entries(existing)) {
        if (sessionId !== this.id && row?.userId === this.user.uid) {
          await remove(ref(this.rtdb, `privateVoiceRooms/${id}/sessions/${sessionId}`)).catch(() => {});
          delete existing[sessionId];
        }
      }

      const me = await this.publicUser(this.user.uid);
      const peer = await this.publicUser(peerId);
      this.voice = { serverId: PRIVATE_SERVER_ID, channelId: id, private: true, peerId };
      this.privateCallHadPeer = Object.values(existing).some(row => row?.userId === peerId);

      try { this.privateRoomOff?.(); } catch {}
      this.privateRoomOff = onValue(sessionsRef, snap => {
        const sessions = snap.val() || {};
        const hasPeer = Object.values(sessions).some(row => row?.userId === peerId);
        if (this.privateCallHadPeer && !hasPeer && this.voice?.serverId === PRIVATE_SERVER_ID && this.voice?.channelId === id) {
          this.receive('private-call:peer-left', { roomId: id, peerId, peer });
        }
        if (hasPeer) this.privateCallHadPeer = true;
        this.processVoiceServer(PRIVATE_SERVER_ID, { [id]: sessions });
      });

      const myRef = ref(this.rtdb, `privateVoiceRooms/${id}/sessions/${this.id}`);
      await set(myRef, {
        userId: this.user.uid,
        user: me,
        mediaState: { muted: false, camera: false, screen: false },
        speaking: false,
        joinedAt: rtdbTimestamp()
      });
      await onDisconnect(myRef).remove();

      const peers = Object.entries(existing)
        .filter(([sessionId, row]) => sessionId !== this.id && row?.userId !== this.user.uid)
        .map(([socketId, row]) => ({
          socketId,
          user: row.user || { id: row.userId, name: 'Amigo' },
          mediaState: row.mediaState || {}
        }));

      this.receive('voice:peers', { channelId: id, peers });
      this.receive('private-call:joined', { roomId: id, peerId, peer });
      ack?.({ ok: true, roomId: id, peerId, peer });
    };

    // Watch incoming calls addressed to the signed-in account.
    const incomingRef = ref(socket.rtdb, `privateCallInvites/${socket.user.uid}`);
    const incomingOff = onChildAdded(incomingRef, async snap => {
      const invite = snap.val() || {};
      if (invite.status !== 'ringing' || invite.toUserId !== socket.user.uid) return;
      const createdAt = Number(invite.createdAt || 0);
      if (createdAt && Date.now() - createdAt > 120000) return;
      const fromUser = invite.fromUser || await socket.publicUser(invite.fromUserId).catch(() => null);
      socket.receive('private-call:incoming', {
        inviteId: snap.key,
        roomId: invite.roomId,
        peerId: invite.fromUserId,
        peer: fromUser || { id: invite.fromUserId, name: 'Usuário' }
      });
    });
    socket.cleanup.push(incomingOff);

    socket.handle = async function handleV212(event, payload = {}, ack) {
      if ((event === 'channel:create' || event === 'channel:update') && Object.prototype.hasOwnProperty.call(payload, 'allowedRoles')) {
        payload = { ...payload, allowedRoles: normalizeAllowedRoles(payload.allowedRoles) };
      }
      if (event === 'private-call:start') return this.startPrivateCall(payload.userId, ack);
      if (event === 'private-call:respond') return this.respondPrivateCall(payload, ack);
      if (event === 'private-call:cancel') return this.cancelPrivateCall(payload, ack);
      if (event === 'private-call:join') return this.joinPrivateCall(payload, ack);
      return originalHandle(event, payload, ack);
    };

    return true;
  }

  window.BananaV212PatchCloudSocket = patchSocket;
  window.BananaV212NormalizeAllowedRoles = normalizeAllowedRoles;
  window.BananaV212CanAccessRole = canAccess;

  if (window.BananaLegacy?.attachSocket) {
    const previousAttachSocket = window.BananaLegacy.attachSocket;
    window.BananaLegacy.attachSocket = function attachSocketV212(socket, user) {
      patchSocket(socket);
      return previousAttachSocket(socket, user);
    };
  }
  if (window.BananaCloudSocket) patchSocket(window.BananaCloudSocket);
})();

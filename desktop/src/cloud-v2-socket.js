/* Banana Cord v2 Cloud Socket
 * Traduz o protocolo interno da v1.2.1 para Firebase, preservando UI e WebRTC.
 */
(() => {
  const {
    doc, collection, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
    onSnapshot, query, where, orderBy, limit, serverTimestamp, writeBatch,
    runTransaction, Timestamp
  } = require('firebase/firestore');
  const {
    ref, set, update, remove, get, onValue, onChildAdded, push, onDisconnect,
    serverTimestamp: rtdbTimestamp
  } = require('firebase/database');

  const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const ROLE_RANK = { member: 0, moderator: 1, admin: 2, owner: 3 };
  const REACTIONS = new Set(['👍', '❤️', '😂', '👎']);
  const now = () => Date.now();
  const id = prefix => `${prefix}${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const cleanCode = value => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  function shortCode(length = 8) {
    const bytes = new Uint8Array(length); crypto.getRandomValues(bytes);
    return [...bytes].map(v => ALPHABET[v % ALPHABET.length]).join('');
  }
  function millis(value) {
    if (!value) return 0;
    if (typeof value === 'number') return value;
    if (typeof value.toMillis === 'function') return value.toMillis();
    if (typeof value.toDate === 'function') return value.toDate().getTime();
    return Number(value) || 0;
  }
  function mapMessage(snap, serverId, channelId) {
    const d = snap.data();
    return {
      id: snap.id, serverId, channelId,
      authorId: d.authorId || '', text: d.text || d.body || '',
      at: millis(d.createdAt) || now(), editedAt: millis(d.editedAt) || null,
      replyToId: d.replyToId || d.replyTo || null,
      reactions: d.reactions || {}, mentionIds: d.mentionIds || []
    };
  }
  function mapDm(snap, me, peerId) {
    const d = snap.data();
    return {
      id: snap.id, fromId: d.fromId || d.authorId || '', toId: d.toId || '',
      text: d.text || d.body || '', at: millis(d.createdAt) || now(),
      editedAt: millis(d.editedAt) || null, replyToId: d.replyToId || null,
      reactions: d.reactions || {}
    };
  }
  const pairId = (a, b) => [String(a), String(b)].sort().join('_');
  const uniq = values => [...new Set((values || []).filter(Boolean).map(String))];

  class BananaCloudSocket {
    constructor(cloud) {
      this.cloud = cloud;
      this.auth = cloud.auth;
      this.db = cloud.db;
      this.rtdb = cloud.realtime;
      this.user = this.auth.currentUser;
      this.id = `bc_${crypto.randomUUID().replace(/-/g, '')}`;
      this.connected = true;
      this.handlers = new Map();
      this.cleanup = [];
      this.serverCleanup = new Map();
      this.messageCleanup = new Map();
      this.dmCleanup = new Map();
      this.presence = new Map();
      this.serverCache = new Map();
      this.memberCache = new Map();
      this.knownServerIds = new Set();
      this.initialRefsReady = false;
      this.socialCleanup = null;
      this.dmThreadsCleanup = null;
      this.voice = null;
      this.voiceServerState = new Map();
      this.signalCleanup = null;
      this.pendingInvite = window.BananaPendingInvite || '';
    }

    on(event, handler) {
      if (!this.handlers.has(event)) this.handlers.set(event, new Set());
      this.handlers.get(event).add(handler);
      return this;
    }
    off(event, handler) { this.handlers.get(event)?.delete(handler); return this; }
    receive(event, payload) {
      for (const handler of [...(this.handlers.get(event) || [])]) {
        try { handler(payload); } catch (error) { console.error(`Banana Cloud handler ${event}:`, error); }
      }
    }
    emit(event, payload, ack) {
      this.handle(event, payload, ack).catch(error => {
        console.error(`Banana Cloud emit ${event}:`, error);
        this.receive('app:error', this.friendly(error));
        try { ack?.({ ok: false, message: this.friendly(error) }); } catch {}
      });
      return this;
    }
    friendly(error) {
      const code = String(error?.code || '');
      if (code.includes('permission-denied')) return 'O Banana Cloud bloqueou essa ação por permissão. Verifique seu cargo ou as regras do Firebase.';
      if (code.includes('unavailable') || code.includes('network')) return 'Banana Cloud indisponível no momento. Confira sua internet.';
      return error?.message || 'Não foi possível concluir essa ação no Banana Cloud.';
    }

    async start() {
      if (!this.user?.emailVerified) throw new Error('Faça login com um e-mail verificado.');
      await this.ensurePublicProfile();
      await this.startSession();
      this.watchPresence();
      this.watchSignals();
      this.watchServerRefs();
      window.BananaCloudSocket = this;
    }

    async ensurePublicProfile() {
      const u = this.user;
      const current = await getDoc(doc(this.db, 'users', u.uid));
      const privateData = current.exists() ? current.data() : {};
      const profile = {
        displayName: u.displayName || privateData.displayName || u.email?.split('@')[0] || 'Usuário',
        avatar: privateData.avatar || '', customStatus: privateData.customStatus || '',
        updatedAt: serverTimestamp()
      };
      await setDoc(doc(this.db, 'publicProfiles', u.uid), profile, { merge: true });
    }

    async publicUser(uid) {
      if (!uid) return null;
      const p = await getDoc(doc(this.db, 'publicProfiles', uid));
      const d = p.exists() ? p.data() : {};
      const pr = this.presence.get(uid) || {};
      return {
        id: uid, name: d.displayName || (uid === this.user.uid ? this.user.displayName : '') || 'Usuário',
        avatar: d.avatar || '', customStatus: d.customStatus || '',
        status: pr.state || (uid === this.user.uid ? 'online' : 'offline'),
        lastSeen: pr.lastChanged || null
      };
    }

    async startSession() {
      if (!this.rtdb) return;
      const ownerRef = ref(this.rtdb, `sessionOwners/${this.id}`);
      await set(ownerRef, this.user.uid);
      await onDisconnect(ownerRef).remove();
    }

    watchPresence() {
      if (!this.rtdb) return;
      const off = onValue(ref(this.rtdb, 'presence'), snap => {
        const next = new Map(Object.entries(snap.val() || {}));
        for (const [uid, value] of next) {
          const before = this.presence.get(uid);
          if (!before || before.state !== value?.state || before.lastChanged !== value?.lastChanged) {
            this.presence.set(uid, value || {});
            this.publicUser(uid).then(user => user && this.receive('presence:update', user)).catch(() => {});
          }
        }
        this.presence = next;
      });
      this.cleanup.push(off);
    }

    watchSignals() {
      if (!this.rtdb) return;
      const inbox = ref(this.rtdb, `signals/${this.id}`);
      this.signalCleanup = onChildAdded(inbox, snap => {
        const value = snap.val();
        if (value?.fromSocketId && value?.data) {
          this.receive('webrtc:signal', {
            fromSocketId: value.fromSocketId,
            fromUser: value.fromUser || { id: value.fromUserId || '', name: 'Amigo' },
            data: value.data
          });
        }
        remove(snap.ref).catch(() => {});
      });
      this.cleanup.push(this.signalCleanup);
    }

    watchServerRefs() {
      const q = query(collection(this.db, 'users', this.user.uid, 'serverRefs'), orderBy('joinedAt', 'asc'));
      const off = onSnapshot(q, async snap => {
        const ids = snap.docs.map(d => d.id);
        const previous = new Set(this.knownServerIds);
        const servers = (await Promise.all(ids.map(serverId => this.loadServer(serverId)))).filter(Boolean);
        this.knownServerIds = new Set(ids);
        for (const serverId of ids) this.watchServer(serverId);
        for (const serverId of previous) if (!this.knownServerIds.has(serverId)) this.unwatchServer(serverId);

        if (!this.initialRefsReady) {
          this.initialRefsReady = true;
          this.receive('auth:ready', { user: await this.publicUser(this.user.uid), servers });
          if (this.pendingInvite) {
            const pending = this.pendingInvite; this.pendingInvite = ''; window.BananaPendingInvite = '';
            setTimeout(() => this.emit('server:join', { inviteCode: pending }), 150);
          }
          return;
        }

        const currentIds = new Set(ids);
        for (const oldId of previous) if (!currentIds.has(oldId)) this.receive('server:removed', { serverId: oldId });
        for (const server of servers) {
          if (!previous.has(server.id)) this.receive('server:joined', server);
          else this.receive('server:updated', server);
        }
      }, error => this.receive('app:error', this.friendly(error)));
      this.cleanup.push(off);
    }

    watchServer(serverId) {
      if (this.serverCleanup.has(serverId)) return;
      const offs = [];
      let queued = false;
      const refresh = () => {
        if (queued) return; queued = true;
        queueMicrotask(async () => {
          queued = false;
          const server = await this.loadServer(serverId).catch(() => null);
          if (!server) return;
          this.serverCache.set(serverId, server);
          this.receive('server:updated', server);
          await this.emitMembers(serverId).catch(() => {});
        });
      };
      offs.push(onSnapshot(doc(this.db, 'servers', serverId), refresh, () => {}));
      offs.push(onSnapshot(collection(this.db, 'servers', serverId, 'channels'), refresh, () => {}));
      offs.push(onSnapshot(collection(this.db, 'servers', serverId, 'members'), refresh, () => {}));
      if (this.rtdb) {
        const voiceOff = onValue(ref(this.rtdb, `voiceRooms/${serverId}`), snap => this.processVoiceServer(serverId, snap.val() || {}));
        offs.push(voiceOff);
      }
      this.serverCleanup.set(serverId, offs);
    }
    unwatchServer(serverId) {
      for (const off of this.serverCleanup.get(serverId) || []) try { off(); } catch {}
      this.serverCleanup.delete(serverId); this.serverCache.delete(serverId); this.memberCache.delete(serverId);
    }

    async loadServer(serverId) {
      const sSnap = await getDoc(doc(this.db, 'servers', serverId));
      if (!sSnap.exists()) return null;
      const s = sSnap.data();
      const [channelsSnap, membersSnap] = await Promise.all([
        getDocs(collection(this.db, 'servers', serverId, 'channels')),
        getDocs(collection(this.db, 'servers', serverId, 'members'))
      ]);
      const memberRoles = {}, members = [];
      membersSnap.forEach(m => { members.push(m.id); memberRoles[m.id] = m.data().role || (m.id === s.ownerId ? 'owner' : 'member'); });
      const myRole = memberRoles[this.user.uid] || (s.ownerId === this.user.uid ? 'owner' : 'member');
      const channels = channelsSnap.docs.map(c => ({ id: c.id, ...c.data() })).sort((a,b) => Number(a.position||0)-Number(b.position||0));
      const visible = channels.filter(c => {
        const roles = Array.isArray(c.allowedRoles) ? c.allowedRoles : [];
        return ROLE_RANK[myRole] >= ROLE_RANK.admin || !roles.length || roles.includes(myRole);
      });
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
    }

    async emitMembers(serverId) {
      const snap = await getDocs(collection(this.db, 'servers', serverId, 'members'));
      const rows = [];
      for (const m of snap.docs) {
        const data = m.data();
        const user = await this.publicUser(m.id);
        rows.push({ ...user, role: data.role || 'member' });
      }
      this.memberCache.set(serverId, new Map(snap.docs.map(m => [m.id, m.data()])));
      this.receive('members:list', { serverId, members: rows });
    }

    async role(serverId, uid = this.user.uid) {
      const server = this.serverCache.get(serverId);
      if (server?.ownerId === uid) return 'owner';
      const cached = this.memberCache.get(serverId)?.get(uid)?.role;
      if (cached) return cached;
      const snap = await getDoc(doc(this.db, 'servers', serverId, 'members', uid));
      return snap.exists() ? (snap.data().role || 'member') : 'member';
    }
    async requireRole(serverId, minimum) {
      const role = await this.role(serverId);
      if ((ROLE_RANK[role] || 0) < ROLE_RANK[minimum]) throw new Error('Seu cargo não permite essa ação.');
      return role;
    }

    async handle(event, payload = {}, ack) {
      switch (event) {
        case 'auth:hello': return;
        case 'profile:update': return this.updateProfile(payload);
        case 'social:get': return this.watchSocial();
        case 'friend:request': return this.friendRequest(payload.userId);
        case 'friend:accept': return this.friendAccept(payload.userId);
        case 'friend:reject': return this.friendDelete(payload.userId);
        case 'friend:remove': return this.friendDelete(payload.userId);
        case 'friend:block': return this.friendBlock(payload.userId);
        case 'friend:unblock': return this.friendDelete(payload.userId);
        case 'server:create': return this.createServer(payload.name);
        case 'server:join': return this.joinServer(payload.inviteCode);
        case 'server:update': return this.updateServer(payload);
        case 'server:delete': return this.deleteServer(payload.serverId);
        case 'server:leave': return this.leaveServer(payload.serverId);
        case 'server:regenerate-invite': return this.regenerateInvite(payload.serverId);
        case 'invite:create-temporary': return this.createTemporaryInvite(payload, ack);
        case 'member:set-role': return this.setMemberRole(payload);
        case 'member:kick': return this.kickMember(payload);
        case 'members:get': return this.emitMembers(payload.serverId);
        case 'category:create': return this.createCategory(payload);
        case 'category:update': return this.updateCategory(payload);
        case 'channel:create': return this.createChannel(payload);
        case 'channel:update': return this.updateChannel(payload);
        case 'channel:reorder': return this.reorderChannel(payload);
        case 'messages:load': return this.watchMessages(payload.serverId, payload.channelId);
        case 'message:send': return this.sendMessage(payload);
        case 'message:edit': return this.editMessage(payload);
        case 'message:delete': return this.deleteMessage(payload);
        case 'message:react': return this.reactMessage(payload);
        case 'dm:conversations:get': return this.watchDmThreads();
        case 'dm:load': return this.watchDm(payload.userId);
        case 'dm:send': return this.sendDm(payload);
        case 'dm:edit': return this.editDm(payload);
        case 'dm:delete': return this.deleteDm(payload);
        case 'dm:react': return this.reactDm(payload);
        case 'voice:join': return this.joinVoice(payload);
        case 'voice:leave': return this.leaveVoice();
        case 'voice:media-state': return this.voiceMedia(payload);
        case 'voice:speaking': return this.voiceSpeaking(payload);
        case 'webrtc:signal': return this.signal(payload);
        case 'latency:ping': {
          if (!this.rtdb) return ack?.(payload);
          try { await get(ref(this.rtdb, '.info/serverTimeOffset')); } catch {}
          return ack?.(payload);
        }
        default: console.debug('Banana Cloud: evento ainda não mapeado', event);
      }
    }

    async updateProfile(payload) {
      const patch = {};
      if (payload.name != null) patch.displayName = String(payload.name).trim().slice(0,32) || 'Usuário';
      if (payload.avatar != null) patch.avatar = String(payload.avatar).slice(0,800000);
      if (payload.customStatus != null) patch.customStatus = String(payload.customStatus).trim().slice(0,80);
      patch.updatedAt = serverTimestamp();
      await setDoc(doc(this.db, 'users', this.user.uid), { ...patch, email: this.user.email || '', emailVerified: true }, { merge: true });
      await setDoc(doc(this.db, 'publicProfiles', this.user.uid), patch, { merge: true });
      if (patch.displayName) {
        try { const { updateProfile } = require('firebase/auth'); await updateProfile(this.user, { displayName: patch.displayName }); } catch {}
      }
      const refs = await getDocs(collection(this.db, 'users', this.user.uid, 'serverRefs'));
      const batch = writeBatch(this.db); let writes = 0;
      for (const r of refs.docs) {
        batch.set(doc(this.db, 'servers', r.id, 'members', this.user.uid), {
          displayName: patch.displayName || this.user.displayName || '', avatar: patch.avatar || '', customStatus: patch.customStatus || ''
        }, { merge: true }); writes++;
      }
      if (writes) await batch.commit();
      if (this.rtdb && payload.status) await update(ref(this.rtdb, `presence/${this.user.uid}`), { state: payload.status, lastChanged: rtdbTimestamp() });
      this.receive('profile:updated', await this.publicUser(this.user.uid));
    }

    async createServer(name) {
      const clean = String(name || '').trim().slice(0,40); if (!clean) return;
      const serverRef = doc(collection(this.db, 'servers'));
      const code = shortCode();
      this.knownServerIds.add(serverRef.id);
      const batch = writeBatch(this.db);
      batch.set(serverRef, { name: clean, icon: '', ownerId: this.user.uid, inviteCode: code, categories: [], createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      batch.set(doc(this.db, 'servers', serverRef.id, 'members', this.user.uid), { role: 'owner', joinedAt: serverTimestamp(), displayName: this.user.displayName || '' });
      batch.set(doc(this.db, 'servers', serverRef.id, 'channels', 'general'), { name: 'geral', type: 'text', position: 0, categoryId: null, allowedRoles: [], createdAt: serverTimestamp() });
      batch.set(doc(this.db, 'servers', serverRef.id, 'channels', 'voice-general'), { name: 'Geral', type: 'voice', position: 1, categoryId: null, allowedRoles: [], createdAt: serverTimestamp() });
      batch.set(doc(this.db, 'users', this.user.uid, 'serverRefs', serverRef.id), { serverId: serverRef.id, role: 'owner', joinedAt: serverTimestamp() });
      batch.set(doc(this.db, 'invites', code), { serverId: serverRef.id, code, createdBy: this.user.uid, permanent: true, createdAt: serverTimestamp() });
      await batch.commit();
      this.watchServer(serverRef.id);
      const server = await this.loadServer(serverRef.id);
      if (server) this.receive('server:created', server);
    }

    async joinServer(inviteCode) {
      const code = cleanCode(inviteCode);
      if (!code) throw new Error('Digite um código de convite válido.');
      const inv = await getDoc(doc(this.db, 'invites', code));
      if (!inv.exists()) throw new Error('Convite inválido ou expirado.');
      const data = inv.data();
      if (data.expiresAt && millis(data.expiresAt) <= now()) throw new Error('Esse convite expirou.');
      const serverId = data.serverId;
      const serverDoc = await getDoc(doc(this.db, 'servers', serverId));
      if (!serverDoc.exists()) throw new Error('Servidor não encontrado.');
      const existing = await getDoc(doc(this.db, 'servers', serverId, 'members', this.user.uid));
      if (!existing.exists()) {
        const batch = writeBatch(this.db);
        batch.set(doc(this.db, 'servers', serverId, 'members', this.user.uid), { role: 'member', joinedAt: serverTimestamp(), joinedVia: code, displayName: this.user.displayName || '' });
        batch.set(doc(this.db, 'users', this.user.uid, 'serverRefs', serverId), { serverId, role: 'member', joinedAt: serverTimestamp() });
        await batch.commit();
      }
      this.knownServerIds.add(serverId); this.watchServer(serverId);
      const server = await this.loadServer(serverId); if (server) this.receive('server:joined', server);
    }

    async updateServer(payload) {
      await this.requireRole(payload.serverId, 'admin');
      const patch = { updatedAt: serverTimestamp() };
      if (payload.name != null) patch.name = String(payload.name).trim().slice(0,40);
      if (payload.icon != null) patch.icon = String(payload.icon).slice(0,800000);
      await updateDoc(doc(this.db, 'servers', payload.serverId), patch);
    }

    async deleteServer(serverId) {
      const role = await this.role(serverId); if (role !== 'owner') throw new Error('Só o dono pode excluir o servidor.');
      const server = await getDoc(doc(this.db, 'servers', serverId)); if (!server.exists()) return;
      const [channels, members] = await Promise.all([
        getDocs(collection(this.db, 'servers', serverId, 'channels')),
        getDocs(collection(this.db, 'servers', serverId, 'members'))
      ]);
      for (const c of channels.docs) {
        if (c.data().type === 'text') {
          const msgs = await getDocs(collection(this.db, 'servers', serverId, 'channels', c.id, 'messages'));
          for (let i=0;i<msgs.docs.length;i+=400) { const b=writeBatch(this.db); msgs.docs.slice(i,i+400).forEach(m=>b.delete(m.ref)); await b.commit(); }
        }
      }
      for (let i=0;i<members.docs.length;i+=150) {
        const b=writeBatch(this.db);
        for (const m of members.docs.slice(i,i+150)) { b.delete(m.ref); b.delete(doc(this.db,'users',m.id,'serverRefs',serverId)); }
        await b.commit();
      }
      const b = writeBatch(this.db); channels.docs.forEach(c=>b.delete(c.ref));
      const oldCode = server.data().inviteCode; if (oldCode) b.delete(doc(this.db,'invites',cleanCode(oldCode)));
      b.delete(server.ref); await b.commit();
      this.knownServerIds.delete(serverId); this.unwatchServer(serverId); this.receive('server:removed',{serverId,deleted:true});
    }

    async leaveServer(serverId) {
      const server = await getDoc(doc(this.db,'servers',serverId)); if (!server.exists()) return;
      if (server.data().ownerId === this.user.uid) throw new Error('O dono precisa excluir o servidor em vez de sair.');
      const b=writeBatch(this.db); b.delete(doc(this.db,'servers',serverId,'members',this.user.uid)); b.delete(doc(this.db,'users',this.user.uid,'serverRefs',serverId)); await b.commit();
      this.knownServerIds.delete(serverId); this.unwatchServer(serverId); this.receive('server:removed',{serverId,left:true});
    }

    async regenerateInvite(serverId) {
      await this.requireRole(serverId,'admin');
      const sref=doc(this.db,'servers',serverId), ss=await getDoc(sref); if(!ss.exists()) return;
      const old=cleanCode(ss.data().inviteCode), code=shortCode(); const b=writeBatch(this.db);
      b.update(sref,{inviteCode:code,updatedAt:serverTimestamp()}); if(old)b.delete(doc(this.db,'invites',old));
      b.set(doc(this.db,'invites',code),{serverId,code,createdBy:this.user.uid,permanent:true,createdAt:serverTimestamp()}); await b.commit();
    }

    async createTemporaryInvite(payload, ack) {
      await this.requireRole(payload.serverId,'admin');
      const minutes=Math.max(5,Math.min(10080,Number(payload.minutes)||60)); const code=shortCode(); const expiresAt=Timestamp.fromMillis(now()+minutes*60000);
      await setDoc(doc(this.db,'invites',code),{serverId:payload.serverId,code,createdBy:this.user.uid,permanent:false,createdAt:serverTimestamp(),expiresAt});
      ack?.({ok:true,code,expiresAt:expiresAt.toMillis()});
    }

    async setMemberRole(payload) {
      const role=await this.role(payload.serverId); if(role!=='owner') throw new Error('Só o dono pode alterar cargos.');
      const next=['member','moderator','admin'].includes(payload.role)?payload.role:'member';
      await updateDoc(doc(this.db,'servers',payload.serverId,'members',payload.userId),{role:next});
    }
    async kickMember(payload) {
      const role=await this.role(payload.serverId); if(role!=='owner') throw new Error('Só o dono pode remover membros.');
      const server=await getDoc(doc(this.db,'servers',payload.serverId)); if(server.data()?.ownerId===payload.userId) return;
      const b=writeBatch(this.db); b.delete(doc(this.db,'servers',payload.serverId,'members',payload.userId)); b.delete(doc(this.db,'users',payload.userId,'serverRefs',payload.serverId)); await b.commit();
    }

    async createCategory(payload) {
      await this.requireRole(payload.serverId,'moderator'); const sref=doc(this.db,'servers',payload.serverId); const snap=await getDoc(sref); const cats=Array.isArray(snap.data()?.categories)?snap.data().categories:[];
      cats.push({id:id('cat_'),name:String(payload.name||'Categoria').trim().slice(0,32)||'Categoria'}); await updateDoc(sref,{categories:cats,updatedAt:serverTimestamp()});
    }
    async updateCategory(payload) {
      await this.requireRole(payload.serverId,'moderator'); const sref=doc(this.db,'servers',payload.serverId); const snap=await getDoc(sref); let cats=Array.isArray(snap.data()?.categories)?snap.data().categories:[];
      if(payload.action==='delete') cats=cats.filter(c=>c.id!==payload.categoryId); else cats=cats.map(c=>c.id===payload.categoryId?{...c,name:String(payload.name||c.name).trim().slice(0,32)||c.name}:c);
      await updateDoc(sref,{categories:cats,updatedAt:serverTimestamp()});
      if(payload.action==='delete') { const chans=await getDocs(collection(this.db,'servers',payload.serverId,'channels')); const b=writeBatch(this.db); let n=0; for(const c of chans.docs)if(c.data().categoryId===payload.categoryId){b.update(c.ref,{categoryId:null});n++;} if(n)await b.commit(); }
    }
    async createChannel(payload) {
      await this.requireRole(payload.serverId,'moderator'); const chans=await getDocs(collection(this.db,'servers',payload.serverId,'channels')); const type=payload.type==='voice'?'voice':'text';
      const cref=doc(collection(this.db,'servers',payload.serverId,'channels')); await setDoc(cref,{name:String(payload.name||'canal').trim().slice(0,32)||'canal',type,position:chans.size,categoryId:payload.categoryId||null,allowedRoles:uniq(payload.allowedRoles).filter(r=>['member','moderator','admin'].includes(r)),createdAt:serverTimestamp()});
    }
    async updateChannel(payload) {
      await this.requireRole(payload.serverId,'moderator'); const cref=doc(this.db,'servers',payload.serverId,'channels',payload.channelId); const cs=await getDoc(cref); if(!cs.exists())return;
      if(payload.action==='delete') { if(cs.data().type==='text'){const msgs=await getDocs(collection(this.db,'servers',payload.serverId,'channels',payload.channelId,'messages'));for(let i=0;i<msgs.docs.length;i+=400){const b=writeBatch(this.db);msgs.docs.slice(i,i+400).forEach(m=>b.delete(m.ref));await b.commit();}} await deleteDoc(cref);return; }
      const patch={}; if(payload.name!=null)patch.name=String(payload.name).trim().slice(0,32); if('categoryId'in payload)patch.categoryId=payload.categoryId||null; if(payload.allowedRoles)patch.allowedRoles=uniq(payload.allowedRoles).filter(r=>['member','moderator','admin'].includes(r)); await updateDoc(cref,patch);
    }
    async reorderChannel(payload) {
      await this.requireRole(payload.serverId,'moderator'); const snap=await getDocs(collection(this.db,'servers',payload.serverId,'channels')); let rows=snap.docs.map(d=>({id:d.id,ref:d.ref,...d.data()})).sort((a,b)=>Number(a.position||0)-Number(b.position||0)); const at=rows.findIndex(c=>c.id===payload.channelId);if(at<0)return;const[moved]=rows.splice(at,1);let to=payload.beforeId?rows.findIndex(c=>c.id===payload.beforeId):-1;if(to<0)to=rows.length;rows.splice(to,0,moved);const b=writeBatch(this.db);rows.forEach((c,i)=>b.update(c.ref,{position:i}));await b.commit();
    }

    async watchMessages(serverId, channelId) {
      this.messageCleanup.get(channelId)?.(); let first=true;
      const q=query(collection(this.db,'servers',serverId,'channels',channelId,'messages'),orderBy('createdAt','asc'),limit(200));
      const off=onSnapshot(q,snap=>{
        if(first){first=false;this.receive('messages:list',{channelId,messages:snap.docs.map(d=>mapMessage(d,serverId,channelId))});return;}
        for(const change of snap.docChanges()) { const m=mapMessage(change.doc,serverId,channelId); if(change.type==='added')this.receive('message:new',m);else if(change.type==='modified')this.receive('message:updated',m);else if(change.type==='removed')this.receive('message:deleted',{channelId,messageId:change.doc.id}); }
      },e=>this.receive('app:error',this.friendly(e))); this.messageCleanup.set(channelId,off);
    }
    async mentionIds(serverId,text){const members=await getDocs(collection(this.db,'servers',serverId,'members'));const lower=String(text||'').toLocaleLowerCase('pt-BR'),ids=[];for(const m of members.docs){const u=await this.publicUser(m.id);if(u?.name&&lower.includes(`@${u.name.toLocaleLowerCase('pt-BR')}`))ids.push(m.id);}return ids;}
    async sendMessage(p){const text=String(p.text||'').trim().slice(0,2000);if(!text)return;await setDoc(doc(collection(this.db,'servers',p.serverId,'channels',p.channelId,'messages')),{authorId:this.user.uid,text,createdAt:serverTimestamp(),editedAt:null,replyToId:p.replyToId||null,reactions:{},mentionIds:await this.mentionIds(p.serverId,text)});}
    async editMessage(p){const mref=doc(this.db,'servers',p.serverId,'channels',p.channelId,'messages',p.messageId);const s=await getDoc(mref);if(!s.exists())return;const role=await this.role(p.serverId);if(s.data().authorId!==this.user.uid&&ROLE_RANK[role]<ROLE_RANK.moderator)throw new Error('Você não pode editar essa mensagem.');const text=String(p.text||'').trim().slice(0,2000);if(text)await updateDoc(mref,{text,editedAt:serverTimestamp(),mentionIds:await this.mentionIds(p.serverId,text)});}
    async deleteMessage(p){const mref=doc(this.db,'servers',p.serverId,'channels',p.channelId,'messages',p.messageId);const s=await getDoc(mref);if(!s.exists())return;const role=await this.role(p.serverId);if(s.data().authorId!==this.user.uid&&ROLE_RANK[role]<ROLE_RANK.moderator)throw new Error('Você não pode apagar essa mensagem.');await deleteDoc(mref);}
    async reactMessage(p){if(!REACTIONS.has(String(p.emoji||'')))return;const mref=doc(this.db,'servers',p.serverId,'channels',p.channelId,'messages',p.messageId);await runTransaction(this.db,async tx=>{const s=await tx.get(mref);if(!s.exists())return;const reactions={...(s.data().reactions||{})},ids=uniq(reactions[p.emoji]||[]);reactions[p.emoji]=ids.includes(this.user.uid)?ids.filter(x=>x!==this.user.uid):[...ids,this.user.uid];if(!reactions[p.emoji].length)delete reactions[p.emoji];tx.update(mref,{reactions});});}

    async relation(otherUid){return getDoc(doc(this.db,'relationships',pairId(this.user.uid,otherUid)));}
    async watchSocial(){if(this.socialCleanup)return;const q=query(collection(this.db,'relationships'),where('participants','array-contains',this.user.uid));this.socialCleanup=onSnapshot(q,()=>this.emitSocial(),e=>this.receive('app:error',this.friendly(e)));this.cleanup.push(this.socialCleanup);await this.emitSocial();}
    async emitSocial(){const q=query(collection(this.db,'relationships'),where('participants','array-contains',this.user.uid));const snap=await getDocs(q);const state={friends:[],incoming:[],outgoing:[],blocked:[]};for(const r of snap.docs){const d=r.data(),other=(d.participants||[]).find(x=>x!==this.user.uid);if(!other)continue;const u=await this.publicUser(other);if(!u)continue;if(d.status==='friends')state.friends.push(u);else if(d.status==='blocked'){if(d.blockedBy===this.user.uid)state.blocked.push(u);}else if(d.status==='pending'){if(d.requestedBy===this.user.uid)state.outgoing.push(u);else state.incoming.push(u);}}this.receive('social:state',state);}
    async sharesServer(otherUid){for(const sid of this.knownServerIds){const m=await getDoc(doc(this.db,'servers',sid,'members',otherUid));if(m.exists())return true;}return false;}
    async friendRequest(otherUid){if(!otherUid||otherUid===this.user.uid)return;if(!(await this.sharesServer(otherUid)))throw new Error('Vocês precisam estar em um servidor em comum para adicionar amizade.');const rid=pairId(this.user.uid,otherUid),r=await getDoc(doc(this.db,'relationships',rid));if(r.exists()&&r.data().status==='blocked')throw new Error('Não é possível enviar solicitação para este usuário.');await setDoc(doc(this.db,'relationships',rid),{participants:[this.user.uid,otherUid].sort(),status:'pending',requestedBy:this.user.uid,updatedAt:serverTimestamp()});}
    async friendAccept(otherUid){const rref=doc(this.db,'relationships',pairId(this.user.uid,otherUid));const r=await getDoc(rref);if(!r.exists()||r.data().status!=='pending'||r.data().requestedBy===this.user.uid)return;await updateDoc(rref,{status:'friends',blockedBy:null,updatedAt:serverTimestamp()});}
    async friendDelete(otherUid){if(!otherUid)return;await deleteDoc(doc(this.db,'relationships',pairId(this.user.uid,otherUid)));}
    async friendBlock(otherUid){if(!otherUid||otherUid===this.user.uid)return;await setDoc(doc(this.db,'relationships',pairId(this.user.uid,otherUid)),{participants:[this.user.uid,otherUid].sort(),status:'blocked',blockedBy:this.user.uid,updatedAt:serverTimestamp()});}
    async canDm(otherUid){const r=await this.relation(otherUid);if(r.exists()){const d=r.data();if(d.status==='blocked')return false;if(d.status==='friends')return true;}return this.sharesServer(otherUid);}

    async watchDmThreads(){if(this.dmThreadsCleanup)return;const q=query(collection(this.db,'dmThreads'),where('participants','array-contains',this.user.uid));this.dmThreadsCleanup=onSnapshot(q,async snap=>{const conversations=[];for(const t of snap.docs){const d=t.data(),peerId=(d.participants||[]).find(x=>x!==this.user.uid);if(!peerId)continue;const user=await this.publicUser(peerId);if(user)conversations.push({user,lastMessage:d.lastMessage||null});}conversations.sort((a,b)=>Number(b.lastMessage?.at||0)-Number(a.lastMessage?.at||0));this.receive('dm:conversations',{conversations});},e=>this.receive('app:error',this.friendly(e)));this.cleanup.push(this.dmThreadsCleanup);}
    async watchDm(peerId){if(!(await this.canDm(peerId)))throw new Error('Essa conversa privada não está disponível.');const tid=pairId(this.user.uid,peerId);this.dmCleanup.get(peerId)?.();let first=true;const q=query(collection(this.db,'dmThreads',tid,'messages'),orderBy('createdAt','asc'),limit(250));const off=onSnapshot(q,async snap=>{const user=await this.publicUser(peerId);if(first){first=false;this.receive('dm:list',{user,messages:snap.docs.map(d=>mapDm(d,this.user.uid,peerId))});return;}for(const ch of snap.docChanges()){const m=mapDm(ch.doc,this.user.uid,peerId);if(ch.type==='added')this.receive('dm:new',{message:m,from:m.fromId===this.user.uid?await this.publicUser(this.user.uid):user,to:m.toId===this.user.uid?await this.publicUser(this.user.uid):user});else if(ch.type==='modified')this.receive('dm:updated',{userId:peerId,message:m});else this.receive('dm:deleted',{userId:peerId,messageId:ch.doc.id});}},e=>this.receive('app:error',this.friendly(e)));this.dmCleanup.set(peerId,off);}
    async sendDm(p){const peerId=p.userId,text=String(p.text||'').trim().slice(0,2000);if(!text)return;if(!(await this.canDm(peerId)))throw new Error('Essa conversa privada não está disponível.');const tid=pairId(this.user.uid,peerId),mref=doc(collection(this.db,'dmThreads',tid,'messages')),at=now();const message={id:mref.id,fromId:this.user.uid,toId:peerId,text,at,editedAt:null,replyToId:p.replyToId||null,reactions:{}};const b=writeBatch(this.db);b.set(doc(this.db,'dmThreads',tid),{participants:[this.user.uid,peerId].sort(),updatedAt:serverTimestamp(),lastMessage:message},{merge:true});b.set(mref,{fromId:this.user.uid,toId:peerId,text,createdAt:serverTimestamp(),editedAt:null,replyToId:p.replyToId||null,reactions:{}});await b.commit();}
    async editDm(p){const tid=pairId(this.user.uid,p.userId),mref=doc(this.db,'dmThreads',tid,'messages',p.messageId),s=await getDoc(mref);if(!s.exists()||s.data().fromId!==this.user.uid)throw new Error('Você só pode editar suas próprias mensagens.');const text=String(p.text||'').trim().slice(0,2000);if(text)await updateDoc(mref,{text,editedAt:serverTimestamp()});}
    async deleteDm(p){const tid=pairId(this.user.uid,p.userId),mref=doc(this.db,'dmThreads',tid,'messages',p.messageId),s=await getDoc(mref);if(!s.exists()||s.data().fromId!==this.user.uid)throw new Error('Você só pode apagar suas próprias mensagens.');await deleteDoc(mref);}
    async reactDm(p){if(!REACTIONS.has(String(p.emoji||'')))return;const mref=doc(this.db,'dmThreads',pairId(this.user.uid,p.userId),'messages',p.messageId);await runTransaction(this.db,async tx=>{const s=await tx.get(mref);if(!s.exists())return;const reactions={...(s.data().reactions||{})},ids=uniq(reactions[p.emoji]||[]);reactions[p.emoji]=ids.includes(this.user.uid)?ids.filter(x=>x!==this.user.uid):[...ids,this.user.uid];if(!reactions[p.emoji].length)delete reactions[p.emoji];tx.update(mref,{reactions});});}

    processVoiceServer(serverId, tree) {
      const flat=new Map();for(const [channelId,sessions]of Object.entries(tree||{}))for(const [socketId,e]of Object.entries(sessions||{}))flat.set(socketId,{...e,socketId,channelId});
      const prev=this.voiceServerState.get(serverId)||new Map();const entries=[...flat.values()].map(e=>({channelId:e.channelId,socketId:e.socketId,user:e.user||{id:e.userId,name:'Amigo'},mediaState:e.mediaState||{},speaking:!!e.speaking}));
      this.receive('voice:snapshot',{serverId,entries});
      for(const [sid,e]of flat){const old=prev.get(sid);if(!old){if(sid!==this.id)this.receive('voice:presence-event',{type:'join',userId:e.userId,channelId:e.channelId});if(this.voice?.serverId===serverId&&this.voice?.channelId===e.channelId&&sid!==this.id)this.receive('voice:user-joined',{socketId:sid,user:e.user,mediaState:e.mediaState||{}});}else{if(JSON.stringify(old.mediaState||{})!==JSON.stringify(e.mediaState||{})){this.receive('voice:media-state-global',{socketId:sid,userId:e.userId,channelId:e.channelId,mediaState:e.mediaState||{}});if(this.voice?.channelId===e.channelId&&sid!==this.id)this.receive('voice:media-state',{socketId:sid,mediaState:e.mediaState||{}});}if(!!old.speaking!==!!e.speaking){this.receive('voice:speaking-global',{socketId:sid,userId:e.userId,channelId:e.channelId,speaking:!!e.speaking});if(this.voice?.channelId===e.channelId&&sid!==this.id)this.receive('voice:speaking',{socketId:sid,speaking:!!e.speaking});}}}
      for(const [sid,e]of prev)if(!flat.has(sid)){if(sid!==this.id)this.receive('voice:presence-event',{type:'leave',userId:e.userId,channelId:e.channelId});if(this.voice?.serverId===serverId&&this.voice?.channelId===e.channelId&&sid!==this.id)this.receive('voice:user-left',{socketId:sid});}
      this.voiceServerState.set(serverId,flat);
    }
    async joinVoice(p){if(!this.rtdb)return;const server=await this.loadServer(p.serverId);const ch=server?.channels.find(c=>c.id===p.channelId&&c.type==='voice');if(!ch)throw new Error('Você não tem acesso a essa sala de voz.');if(this.voice)await this.leaveVoice();const roomRef=ref(this.rtdb,`voiceRooms/${p.serverId}/${p.channelId}`),snap=await get(roomRef),sessions=snap.val()||{},others=Object.entries(sessions).filter(([sid])=>sid!==this.id);if(others.length>=5){this.receive('voice:full');return;}const me=await this.publicUser(this.user.uid);this.voice={serverId:p.serverId,channelId:p.channelId};const myRef=ref(this.rtdb,`voiceRooms/${p.serverId}/${p.channelId}/${this.id}`);await set(myRef,{userId:this.user.uid,user:me,mediaState:{muted:false,camera:false,screen:false},speaking:false,joinedAt:rtdbTimestamp()});await onDisconnect(myRef).remove();this.receive('voice:peers',{channelId:p.channelId,peers:others.map(([socketId,e])=>({socketId,user:e.user||{id:e.userId,name:'Amigo'},mediaState:e.mediaState||{}}))});}
    async leaveVoice(){if(!this.voice||!this.rtdb)return;const v=this.voice;this.voice=null;const myRef=ref(this.rtdb,`voiceRooms/${v.serverId}/${v.channelId}/${this.id}`);try{await onDisconnect(myRef).cancel();}catch{}await remove(myRef).catch(()=>{});}
    async voiceMedia(mediaState){if(!this.voice||!this.rtdb)return;await update(ref(this.rtdb,`voiceRooms/${this.voice.serverId}/${this.voice.channelId}/${this.id}`),{mediaState:{muted:!!mediaState.muted,camera:!!mediaState.camera,screen:!!mediaState.screen}});}
    async voiceSpeaking(p){if(!this.voice||!this.rtdb)return;await update(ref(this.rtdb,`voiceRooms/${this.voice.serverId}/${this.voice.channelId}/${this.id}`),{speaking:!!p.speaking});}
    async signal(p){if(!this.rtdb||!p.targetSocketId)return;const fromUser=await this.publicUser(this.user.uid);await set(push(ref(this.rtdb,`signals/${p.targetSocketId}`)),{fromSocketId:this.id,fromUserId:this.user.uid,fromUser,data:p.data,at:rtdbTimestamp()});}

    async disconnect() {
      this.connected=false;await this.leaveVoice().catch(()=>{});if(this.rtdb){await remove(ref(this.rtdb,`sessionOwners/${this.id}`)).catch(()=>{});}
      for(const off of this.cleanup)try{off();}catch{};for(const off of this.messageCleanup.values())try{off();}catch{};for(const off of this.dmCleanup.values())try{off();}catch{};for(const sid of [...this.serverCleanup.keys()])this.unwatchServer(sid);
      this.handlers.clear();
    }
  }

  let started=false;
  async function boot(event) {
    if(started)return;const cloud=window.BananaCloud;if(!cloud?.ready||!cloud?.user)return;started=true;
    try{
      const socket=new BananaCloudSocket(cloud);window.BananaLegacy?.attachSocket(socket,cloud.user);await socket.start();
    }catch(error){started=false;console.error('Banana Cloud socket boot:',error);window.BananaLegacy?.toast?.(error?.message||'Falha ao iniciar Banana Cloud.',6000);}
  }
  window.addEventListener('banana:cloud-ready',boot);
  if(window.BananaCloud?.ready)queueMicrotask(boot);
})();

/* Banana Cord V2.0.15 — security hardening for Banana Cloud.
 * Keep authorization decisions enforceable by Firebase rules instead of relying
 * on UI-only checks. DMs/private calls are now friend-only, and joining a
 * server no longer requires reading the server document before membership.
 */
(() => {
  if (window.__bananaV215CloudSecurity) return;
  window.__bananaV215CloudSecurity = true;

  const {
    doc, getDoc, setDoc, writeBatch, serverTimestamp
  } = require('firebase/firestore');

  const cleanCode = value => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const millis = value => {
    if (!value) return 0;
    if (typeof value === 'number') return value;
    if (typeof value.toMillis === 'function') return value.toMillis();
    if (typeof value.toDate === 'function') return value.toDate().getTime();
    return Number(value) || 0;
  };

  function patchSocket(socket) {
    if (!socket || socket.__bananaV215SecurityPatched) return false;
    if (typeof socket.handle !== 'function' || !socket.user || !socket.db) return false;
    socket.__bananaV215SecurityPatched = true;

    // A private conversation/call now requires an accepted friendship. This makes
    // the same condition possible to enforce in Firestore Security Rules.
    socket.canDm = async function canDmV215(otherUid) {
      if (!otherUid || otherUid === this.user.uid) return false;
      const relation = await this.relation(otherUid);
      if (!relation?.exists?.()) return false;
      return relation.data()?.status === 'friends';
    };

    // Preserve relationship metadata when blocking an existing relationship, so
    // Security Rules can validate a narrow transition instead of a full replace.
    socket.friendBlock = async function friendBlockV215(otherUid) {
      if (!otherUid || otherUid === this.user.uid) return;
      const participants = [this.user.uid, otherUid].sort();
      await setDoc(doc(this.db, 'relationships', participants.join('_')), {
        participants,
        status: 'blocked',
        blockedBy: this.user.uid,
        updatedAt: serverTimestamp()
      }, { merge: true });
      await this.emitSocial?.().catch(() => {});
    };

    // The invite document is the capability. Do not read the server itself until
    // the membership batch succeeds; production rules can therefore hide server
    // metadata from authenticated outsiders.
    socket.joinServer = async function joinServerV215(inviteCode) {
      const code = cleanCode(inviteCode);
      if (!code) throw new Error('Digite um código de convite válido.');
      const invite = await getDoc(doc(this.db, 'invites', code));
      if (!invite.exists()) throw new Error('Convite inválido ou expirado.');
      const data = invite.data() || {};
      if (data.expiresAt && millis(data.expiresAt) <= Date.now()) throw new Error('Esse convite expirou.');
      const serverId = String(data.serverId || '');
      if (!serverId) throw new Error('Convite inválido.');

      const memberRef = doc(this.db, 'servers', serverId, 'members', this.user.uid);
      const existing = await getDoc(memberRef);
      if (!existing.exists()) {
        const batch = writeBatch(this.db);
        batch.set(memberRef, {
          role: 'member',
          joinedAt: serverTimestamp(),
          joinedVia: code,
          displayName: this.user.displayName || ''
        });
        batch.set(doc(this.db, 'users', this.user.uid, 'serverRefs', serverId), {
          serverId,
          role: 'member',
          joinedAt: serverTimestamp()
        });
        await batch.commit();
      }

      this.knownServerIds.add(serverId);
      this.watchServer(serverId);
      const server = await this.loadServer(serverId);
      if (!server) throw new Error('Servidor não encontrado.');
      this.receive('server:joined', server);
    };

    return true;
  }

  if (window.BananaLegacy?.attachSocket) {
    const previousAttachSocket = window.BananaLegacy.attachSocket;
    window.BananaLegacy.attachSocket = function attachSocketV215(socket, user) {
      patchSocket(socket);
      return previousAttachSocket(socket, user);
    };
  }
  if (window.BananaCloudSocket) patchSocket(window.BananaCloudSocket);
  window.BananaV215PatchCloudSocket = patchSocket;
})();

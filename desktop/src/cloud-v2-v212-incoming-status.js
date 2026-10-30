/* Banana Cord V2.0.12 — keep incoming private-call cards synchronized. */
(() => {
  const { ref, onValue } = require('firebase/database');

  function patch(socket) {
    if (!socket || socket.__bananaV212IncomingStatusPatched) return false;
    if (typeof socket.receive !== 'function' || !socket.rtdb || !socket.user?.uid) return false;
    socket.__bananaV212IncomingStatusPatched = true;
    socket.__bananaV212IncomingStatusOff ||= new Map();

    const previousReceive = socket.receive.bind(socket);
    socket.receive = function receiveV212IncomingStatus(event, payload = {}) {
      if (event === 'private-call:incoming' && payload.inviteId && !this.__bananaV212IncomingStatusOff.has(payload.inviteId)) {
        const inviteId = String(payload.inviteId);
        const inviteRef = ref(this.rtdb, `privateCallInvites/${this.user.uid}/${inviteId}`);
        const off = onValue(inviteRef, snap => {
          const status = snap.val()?.status || 'ended';
          if (status === 'ringing') return;
          previousReceive('private-call:incoming-status', { inviteId, status });
          try { off(); } catch {}
          this.__bananaV212IncomingStatusOff.delete(inviteId);
        });
        this.__bananaV212IncomingStatusOff.set(inviteId, off);
        this.cleanup?.push?.(off);
      }
      return previousReceive(event, payload);
    };
    return true;
  }

  window.BananaV212PatchIncomingCallStatus = patch;
  if (window.BananaLegacy?.attachSocket) {
    const previousAttachSocket = window.BananaLegacy.attachSocket;
    window.BananaLegacy.attachSocket = function attachSocketV212IncomingStatus(socket, user) {
      patch(socket);
      return previousAttachSocket(socket, user);
    };
  }
  if (window.BananaCloudSocket) patch(window.BananaCloudSocket);
})();

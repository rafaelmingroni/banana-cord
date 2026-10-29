/* Banana Cord V2 WebRTC signaling compatibility.
 * Socket.IO used JSON serialization automatically. The Firebase Realtime
 * Database transport must receive plain objects, not browser-native
 * RTCIceCandidate/RTCSessionDescription instances.
 */
(() => {
  if (window.__bananaCloudWebRtcJsonFix) return;
  window.__bananaCloudWebRtcJsonFix = true;

  function plainDescription(description) {
    if (!description) return null;
    if (typeof description.toJSON === 'function') return description.toJSON();
    return {
      type: description.type,
      sdp: description.sdp
    };
  }

  function plainCandidate(candidate) {
    if (!candidate) return null;
    if (typeof candidate.toJSON === 'function') return candidate.toJSON();
    return {
      candidate: candidate.candidate || '',
      sdpMid: candidate.sdpMid ?? null,
      sdpMLineIndex: candidate.sdpMLineIndex ?? null,
      usernameFragment: candidate.usernameFragment ?? null
    };
  }

  function normalizeSignalData(data) {
    if (!data || typeof data !== 'object') return data;
    if (data.description) return { description: plainDescription(data.description) };
    if (data.candidate) return { candidate: plainCandidate(data.candidate) };
    try { return JSON.parse(JSON.stringify(data)); }
    catch { return data; }
  }

  function patchSocket() {
    const socket = window.BananaCloudSocket;
    if (!socket || socket.__bananaRtcJsonPatched || typeof socket.signal !== 'function') return false;

    const originalSignal = socket.signal.bind(socket);
    socket.signal = payload => originalSignal({
      ...(payload || {}),
      data: normalizeSignalData(payload?.data)
    });
    socket.__bananaRtcJsonPatched = true;
    return true;
  }

  function schedulePatch() {
    if (patchSocket()) return;
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (patchSocket() || attempts >= 60) clearInterval(timer);
    }, 50);
  }

  window.addEventListener('banana:cloud-ready', schedulePatch);
  queueMicrotask(schedulePatch);

  // Exposed only for smoke/E2E diagnostics.
  window.BananaWebRtcSignalFix = { normalizeSignalData, patchSocket };
})();

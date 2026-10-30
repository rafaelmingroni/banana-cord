/* Banana Cord V2.0.18 — incoming direct-call UX, active-call clarity and responsive polish. */
(() => {
  if (window.__bananaV218Polish) return;
  window.__bananaV218Polish = true;

  const { ipcRenderer } = require('electron');
  const seenNotifications = new Set();
  let incomingPeerId = '';
  let incomingCallKey = '';
  let ringTimer = null;
  let ringStopTimer = null;
  let ringContext = null;
  let directCallStartedAt = 0;

  function peerFor(userId) {
    if (!userId) return null;
    try {
      if (typeof dmPeer === 'function') {
        const peer = dmPeer(userId);
        if (peer) return peer;
      }
    } catch {}
    return state.dmConversations?.find?.(row => row?.user?.id === userId)?.user
      || state.v1?.social?.friends?.find?.(row => row?.id === userId)
      || state.members?.get?.(userId)
      || { id: userId, name: 'Amigo' };
  }

  function setAvatar(node, user) {
    if (!node) return;
    node.style.backgroundImage = '';
    node.textContent = String(user?.name || '?').trim().slice(0, 1).toUpperCase();
    if (user?.avatar) {
      node.style.backgroundImage = `url(${user.avatar})`;
      node.textContent = '';
    }
  }

  function ensureIncomingCall() {
    let root = document.getElementById('v218IncomingCall');
    if (root) return root;
    root = document.createElement('div');
    root.id = 'v218IncomingCall';
    root.className = 'v218-incoming-call hidden';
    root.innerHTML = `
      <div class="v218-call-head">
        <div id="v218IncomingAvatar" class="v218-call-avatar">?</div>
        <div class="v218-call-copy">
          <small>Chamada privada recebida</small>
          <b id="v218IncomingName">Amigo</b>
          <span>Está ligando para você no Banana Cord</span>
        </div>
        <span class="v218-ring-dot" aria-hidden="true"></span>
      </div>
      <div class="v218-call-actions">
        <button id="v218DeclineCall" class="v218-call-decline" type="button">✕ Recusar</button>
        <button id="v218AcceptCall" class="v218-call-accept" type="button">📞 Atender</button>
      </div>`;
    document.body.appendChild(root);
    document.getElementById('v218DeclineCall')?.addEventListener('click', declineIncomingCall);
    document.getElementById('v218AcceptCall')?.addEventListener('click', acceptIncomingCall);
    return root;
  }

  function ensureActiveCallBar() {
    let bar = document.getElementById('v218ActiveCall');
    if (bar) return bar;
    bar = document.createElement('div');
    bar.id = 'v218ActiveCall';
    bar.className = 'v218-active-call hidden';
    bar.innerHTML = `
      <span id="v218ActiveDot" class="v218-active-dot"></span>
      <div class="v218-active-copy">
        <b id="v218ActiveTitle">Em chamada</b>
        <small id="v218ActiveStatus">Conectando…</small>
      </div>
      <span id="v218CallTime" class="v218-call-time">00:00</span>
      <button id="v218Hangup" class="v218-call-hangup" type="button">Desligar</button>`;
    const header = els.main?.querySelector?.(':scope > header');
    if (header) header.insertAdjacentElement('afterend', bar);
    else els.main?.prepend?.(bar);
    document.getElementById('v218Hangup')?.addEventListener('click', async () => {
      try {
        if (state.voice?.channelId === 'direct' && typeof leaveVoice === 'function') await leaveVoice();
      } catch {}
      updateActiveCallBar();
    });
    return bar;
  }

  function ringOnce() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!ringContext || ringContext.state === 'closed') ringContext = new AudioCtx();
      ringContext.resume?.().catch?.(() => {});
      const now = ringContext.currentTime;
      for (const offset of [0, 0.26]) {
        const osc = ringContext.createOscillator();
        const gain = ringContext.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(offset ? 660 : 560, now + offset);
        gain.gain.setValueAtTime(0.0001, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.085, now + offset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.18);
        osc.connect(gain); gain.connect(ringContext.destination);
        osc.start(now + offset); osc.stop(now + offset + 0.2);
      }
    } catch {}
  }

  function stopRinging() {
    clearInterval(ringTimer); ringTimer = null;
    clearTimeout(ringStopTimer); ringStopTimer = null;
    try { ipcRenderer.send('banana-call:attention', false); } catch {}
  }

  function startRinging() {
    stopRinging();
    ringOnce();
    ringTimer = setInterval(ringOnce, 1800);
    ringStopTimer = setTimeout(() => {
      stopRinging();
      if (incomingPeerId) {
        state.socket?.emit?.('dm:call:end', { userId: incomingPeerId });
        hideIncomingCall();
        if (typeof toast === 'function') toast('Chamada não atendida.', 3200);
      }
    }, 45000);
    try { ipcRenderer.send('banana-call:attention', true); } catch {}
  }

  function systemNotify(peer, key) {
    if (!key || seenNotifications.has(key)) return;
    seenNotifications.add(key);
    try {
      if ('Notification' in window) {
        const note = new Notification('Chamada no Banana Cord', {
          body: `${peer?.name || 'Um amigo'} está te ligando.`,
          silent: true
        });
        note.onclick = () => {
          try { ipcRenderer.send('banana-call:focus'); } catch {}
          window.focus();
        };
      }
    } catch {}
  }

  function showIncomingCall(row) {
    const peerId = String(row?.peerId || '');
    if (!peerId || state.voice?.channelId === 'direct') return;
    const startedBy = String(row?.activeCall?.startedBy || '');
    const startedAt = Number(row?.activeCall?.startedAt || 0);
    const key = `${peerId}:${startedBy}:${startedAt}`;
    const peer = peerFor(peerId);
    const root = ensureIncomingCall();
    incomingPeerId = peerId;
    incomingCallKey = key;
    document.getElementById('v218IncomingName').textContent = peer?.name || 'Amigo';
    setAvatar(document.getElementById('v218IncomingAvatar'), peer);
    root.classList.remove('hidden');
    if (!ringTimer) startRinging();
    systemNotify(peer, key);
  }

  function hideIncomingCall() {
    ensureIncomingCall().classList.add('hidden');
    incomingPeerId = '';
    incomingCallKey = '';
    stopRinging();
  }

  async function acceptIncomingCall() {
    const peerId = incomingPeerId;
    if (!peerId) return;
    const peer = peerFor(peerId);
    stopRinging();
    try { ipcRenderer.send('banana-call:focus'); } catch {}
    try {
      if (typeof startDm === 'function') startDm(peerId, peer);
      await new Promise(resolve => setTimeout(resolve, 70));
      const callButton = document.getElementById('v212DmCallBtn');
      if (!callButton) throw new Error('Botão de chamada indisponível.');
      callButton.click();
      hideIncomingCall();
    } catch (error) {
      if (typeof toast === 'function') toast(error?.message || 'Não consegui atender a chamada.', 4200);
    }
  }

  function declineIncomingCall() {
    const peerId = incomingPeerId;
    if (!peerId) return;
    state.socket?.emit?.('dm:call:end', { userId: peerId }, () => {});
    hideIncomingCall();
    if (typeof toast === 'function') toast('Chamada recusada.', 2600);
  }

  function formatDuration(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const min = Math.floor(total / 60);
    const sec = total % 60;
    return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }

  function updateActiveCallBar() {
    const bar = ensureActiveCallBar();
    const direct = state.voice?.channelId === 'direct' && !!state.voice?.directPeerId;
    bar.classList.toggle('hidden', !direct);
    document.body.classList.toggle('v218-direct-call-active', direct);
    if (!direct) {
      directCallStartedAt = 0;
      return;
    }
    if (!directCallStartedAt) directCallStartedAt = Date.now();
    const peer = peerFor(state.voice.directPeerId);
    const peers = [...(state.voice.peers?.values?.() || [])];
    const peerSpeaking = peers.some(p => !!p?.speaking && !p?.mediaState?.muted);
    const localSpeaking = !!state.voice.speaking && !state.voice.muted;
    const connected = peers.length > 0;
    let status = connected ? 'Conectados' : 'Chamando…';
    if (localSpeaking && peerSpeaking) status = 'Vocês estão falando';
    else if (localSpeaking) status = 'Você está falando';
    else if (peerSpeaking) status = `${peer?.name || 'Seu contato'} está falando`;
    else if (state.voice.muted) status = 'Seu microfone está silenciado';
    document.getElementById('v218ActiveTitle').textContent = `Em chamada com ${peer?.name || 'Amigo'}`;
    document.getElementById('v218ActiveStatus').textContent = status;
    document.getElementById('v218CallTime').textContent = formatDuration(Date.now() - directCallStartedAt);
    document.getElementById('v218ActiveDot')?.classList.toggle('speaking', localSpeaking || peerSpeaking);
    hideIncomingCall();
  }

  function bindV218Socket(socket) {
    if (!socket || socket.__bananaV218Bound) return;
    socket.__bananaV218Bound = true;
    socket.on('dm:call-state', ({ calls }) => {
      const incoming = (calls || []).find(row => row?.peerId && row?.activeCall?.startedBy && row.activeCall.startedBy !== state.user?.id);
      if (incoming && state.voice?.channelId !== 'direct') showIncomingCall(incoming);
      else if (!incoming) hideIncomingCall();
      updateActiveCallBar();
    });
    socket.on('disconnect', () => {
      hideIncomingCall();
      updateActiveCallBar();
    });
  }

  const bindSocketBase = bindSocket;
  bindSocket = function bindSocketV218(socket) {
    bindSocketBase(socket);
    bindV218Socket(socket);
  };
  if (state.socket) bindV218Socket(state.socket);

  const updateVoiceUIBase = updateVoiceUI;
  updateVoiceUI = function updateVoiceUIV218(...args) {
    const result = updateVoiceUIBase(...args);
    updateActiveCallBar();
    return result;
  };

  const leaveVoiceBase = leaveVoice;
  leaveVoice = async function leaveVoiceV218(...args) {
    const result = await leaveVoiceBase(...args);
    updateActiveCallBar();
    return result;
  };

  // Poll only the tiny status strip so speaking/duration remain immediately clear
  // without forcing a full chat rerender.
  setInterval(updateActiveCallBar, 250);

  ensureIncomingCall();
  ensureActiveCallBar();
  updateActiveCallBar();
})();

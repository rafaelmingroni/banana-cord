/* Banana Cord V2.0.12 — clickable links, voice shortcuts, stable DM shell and private calls. */
(() => {
  if (window.__bananaV212UxPrivateCall) return;
  window.__bananaV212UxPrivateCall = true;

  const PRIVATE_SERVER_ID = '__private__';
  const ROLE_RANK_V212 = { member: 0, moderator: 1, admin: 2, owner: 3 };
  const ROLE_LABEL_V212 = { member: 'Membro', moderator: 'Moderador', admin: 'Administrador', owner: 'Dono' };
  const electronShell = (() => { try { return require('electron').shell; } catch { return null; } })();
  const privateUi = { outgoing: null, incoming: null, activePeer: null, activeRoomId: null, joiningRoom: null };

  function minimumRole(allowedRoles = []) {
    const valid = [...new Set((allowedRoles || []).filter(role => ['member', 'moderator', 'admin'].includes(role)))];
    if (!valid.length) return null;
    return valid.sort((a, b) => ROLE_RANK_V212[a] - ROLE_RANK_V212[b])[0];
  }

  function canAccessChannel(channel) {
    const min = minimumRole(channel?.allowedRoles || []);
    if (!min) return true;
    return (ROLE_RANK_V212[currentRole()] ?? 0) >= ROLE_RANK_V212[min];
  }

  function openExternal(url) {
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) return;
      if (electronShell?.openExternal) electronShell.openExternal(parsed.href);
      else window.open(parsed.href, '_blank', 'noopener,noreferrer');
    } catch {}
  }

  function linkifyElement(el) {
    if (!el || el.dataset.v212Linkified === '1') return;
    const text = el.textContent || '';
    const regex = /https?:\/\/[^\s<>"']+/gi;
    const matches = [...text.matchAll(regex)];
    if (!matches.length) { el.dataset.v212Linkified = '1'; return; }

    el.textContent = '';
    let cursor = 0;
    for (const match of matches) {
      const raw = match[0];
      const at = match.index || 0;
      if (at > cursor) el.appendChild(document.createTextNode(text.slice(cursor, at)));

      let href = raw;
      let suffix = '';
      while (/[.,!?;:]$/.test(href)) { suffix = href.slice(-1) + suffix; href = href.slice(0, -1); }
      const a = document.createElement('a');
      a.className = 'v212-message-link';
      a.href = href;
      a.textContent = href;
      a.title = 'Abrir link';
      a.rel = 'noopener noreferrer';
      a.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        openExternal(href);
      });
      el.appendChild(a);
      if (suffix) el.appendChild(document.createTextNode(suffix));
      cursor = at + raw.length;
    }
    if (cursor < text.length) el.appendChild(document.createTextNode(text.slice(cursor)));
    el.dataset.v212Linkified = '1';
  }

  function linkifyMessages() {
    els.messages?.querySelectorAll?.('.msg-text').forEach(linkifyElement);
  }

  if (typeof renderMessages === 'function') {
    const previousRenderMessages = renderMessages;
    renderMessages = function renderMessagesV212(...args) {
      const result = previousRenderMessages(...args);
      linkifyMessages();
      return result;
    };
  }
  if (typeof renderDmMessages === 'function') {
    const previousRenderDmMessages = renderDmMessages;
    renderDmMessages = function renderDmMessagesV212(...args) {
      const result = previousRenderDmMessages(...args);
      linkifyMessages();
      return result;
    };
  }
  if (els.messages) {
    const observer = new MutationObserver(() => linkifyMessages());
    observer.observe(els.messages, { childList: true, subtree: true });
  }

  // The DM screen used to be overwritten by late server/member snapshots because
  // those events kept calling renderChannels() while a server remained selected.
  const previousRenderChannels = renderChannels;
  renderChannels = function renderChannelsV212(...args) {
    if (state.viewMode === 'dm') {
      els.app?.classList.add('dm-mode');
      els.serverName.textContent = 'Privado';
      els.inviteBtn.style.visibility = 'hidden';
      els.serverSettingsBtn.style.visibility = 'hidden';
      if (!els.channels.querySelector('.dm-sidebar')) renderDmSidebar();
      syncPrivateCallButton();
      return;
    }
    return previousRenderChannels(...args);
  };

  function stabilizeDmShell() {
    if (state.viewMode !== 'dm') return;
    els.app?.classList.add('dm-mode');
    els.serverName.textContent = 'Privado';
    els.inviteBtn.style.visibility = 'hidden';
    els.serverSettingsBtn.style.visibility = 'hidden';
    if (!els.channels.querySelector('.dm-sidebar')) renderDmSidebar();
    syncPrivateCallButton();
  }

  let dmStabilizeQueued = false;
  const dmShellObserver = new MutationObserver(() => {
    if (dmStabilizeQueued || state.viewMode !== 'dm') return;
    dmStabilizeQueued = true;
    queueMicrotask(() => { dmStabilizeQueued = false; stabilizeDmShell(); });
  });
  if (els.channels) dmShellObserver.observe(els.channels, { childList: true, subtree: true });
  if (els.serverName) dmShellObserver.observe(els.serverName, { childList: true, characterData: true, subtree: true });
  els.homeServer?.addEventListener('click', () => queueMicrotask(() => { stabilizeDmShell(); syncPrivateCallButton(); }));

  // A restricted channel now behaves as a minimum role both visually and before
  // navigation. The backend independently enforces the same rule.
  if (typeof selectChannel === 'function') {
    const previousSelectChannel = selectChannel;
    selectChannel = function selectChannelV212(id) {
      const channel = state.selectedServer?.channels?.find(item => item.id === id);
      if (channel?.type === 'voice' && !canAccessChannel(channel)) {
        const min = minimumRole(channel.allowedRoles);
        toast(`Este canal exige cargo ${ROLE_LABEL_V212[min] || min} ou superior.`, 3600);
        return;
      }
      return previousSelectChannel(id);
    };
  }

  els.channels?.addEventListener('dblclick', async event => {
    if (state.viewMode !== 'server') return;
    const row = event.target.closest?.('.channel-row');
    const channelId = row?.dataset?.channelId;
    if (!channelId) return;
    const channel = state.selectedServer?.channels?.find(item => item.id === channelId);
    if (!channel || channel.type !== 'voice') return;
    event.preventDefault();
    if (!canAccessChannel(channel)) {
      const min = minimumRole(channel.allowedRoles);
      return toast(`Este canal exige cargo ${ROLE_LABEL_V212[min] || min} ou superior.`, 3600);
    }
    selectChannel(channel.id);
    if (state.voice.serverId === state.selectedServer?.id && state.voice.channelId === channel.id) return;
    await joinVoice(channel);
  }, true);

  // Turn the old multi-checkbox permission UI into a clear minimum-role selector.
  function upgradePermissionModal() {
    const box = els.modalBody?.querySelector?.('.v1-permission-box');
    if (!box || box.dataset.v212RoleUi === '1') return;
    const checks = [...box.querySelectorAll('.v1-role-access')];
    if (!checks.length) return;
    box.dataset.v212RoleUi = '1';
    const selected = checks.filter(input => input.checked).map(input => input.value);
    const min = minimumRole(selected);
    for (const input of checks) {
      input.type = 'radio';
      input.name = 'v212MinimumRole';
      input.checked = input.value === min;
    }
    const grid = box.querySelector('.switch-grid');
    if (grid && !grid.querySelector('.v212-role-all')) {
      const all = document.createElement('label');
      all.className = 'switch-line v212-role-all';
      all.innerHTML = `<input type="radio" name="v212MinimumRole" ${min ? '' : 'checked'}> Todos`;
      grid.prepend(all);
    }
    const title = box.querySelector('b');
    const copy = box.querySelector('small');
    if (title) title.textContent = 'Cargo mínimo para acessar';
    if (copy) copy.textContent = 'Quem tem este cargo ou um cargo superior também pode entrar. “Todos” libera para qualquer membro.';
  }
  const permissionObserver = new MutationObserver(upgradePermissionModal);
  if (els.modalBody) permissionObserver.observe(els.modalBody, { childList: true, subtree: true });

  function ensurePrivateCallButton() {
    let button = document.getElementById('v212PrivateCallBtn');
    if (!button) {
      button = document.createElement('button');
      button.id = 'v212PrivateCallBtn';
      button.className = 'v212-private-call-btn hidden';
      button.textContent = '☎ Ligar';
      button.title = 'Iniciar ligação privada';
      button.addEventListener('click', startPrivateCallFromDm);
      els.connectionBadge?.insertAdjacentElement('beforebegin', button);
    }
    return button;
  }

  function syncPrivateCallButton() {
    const button = ensurePrivateCallButton();
    const visible = state.viewMode === 'dm' && !!state.activeDmUserId;
    button.classList.toggle('hidden', !visible);
    const active = state.voice.serverId === PRIVATE_SERVER_ID && !!state.voice.channelId;
    button.classList.toggle('active', active);
    button.disabled = active;
    button.textContent = active ? '☎ Em ligação' : '☎ Ligar';
  }

  const startDmBase = startDm;
  startDm = function startDmV212(...args) {
    const result = startDmBase(...args);
    queueMicrotask(() => { stabilizeDmShell(); syncPrivateCallButton(); });
    return result;
  };

  function avatarInto(el, user) {
    if (!el) return;
    el.style.backgroundImage = '';
    el.textContent = (user?.name || '?').trim().slice(0, 1).toUpperCase();
    if (user?.avatar) {
      el.style.backgroundImage = `url(${user.avatar})`;
      el.textContent = '';
    }
  }

  function removeCallCard() { document.getElementById('v212CallCard')?.remove(); }
  function callCard(user, subtitle, actionsHtml) {
    removeCallCard();
    const card = document.createElement('div');
    card.id = 'v212CallCard';
    card.className = 'v212-call-card';
    card.innerHTML = `<div class="v212-call-head"><div class="v212-call-avatar"></div><div class="v212-call-copy"><b>${escapeHtml(user?.name || 'Usuário')}</b><small>${escapeHtml(subtitle)}</small></div></div>${actionsHtml}`;
    document.body.appendChild(card);
    avatarInto(card.querySelector('.v212-call-avatar'), user);
    return card;
  }

  function showOutgoingCall(peer, inviteId, roomId) {
    privateUi.outgoing = { peer, peerId: peer?.id || state.activeDmUserId, inviteId, roomId };
    const card = callCard(peer, 'Chamando…', '<div class="v212-call-actions single"><button class="v212-call-cancel">Cancelar ligação</button></div>');
    card.querySelector('.v212-call-cancel').onclick = () => {
      const current = privateUi.outgoing;
      if (current) state.socket?.emit('private-call:cancel', { inviteId: current.inviteId, peerId: current.peerId });
      privateUi.outgoing = null;
      removeCallCard();
      toast('Ligação cancelada.');
    };
  }

  function showIncomingCall(info) {
    privateUi.incoming = info;
    const card = callCard(info.peer, 'Ligação privada recebida', '<div class="v212-call-actions"><button class="v212-call-decline">Recusar</button><button class="v212-call-accept">Atender</button></div>');
    card.querySelector('.v212-call-decline').onclick = () => {
      state.socket?.emit('private-call:respond', { inviteId: info.inviteId, accept: false }, () => {});
      privateUi.incoming = null;
      removeCallCard();
    };
    card.querySelector('.v212-call-accept').onclick = async () => {
      const button = card.querySelector('.v212-call-accept');
      button.disabled = true;
      if (state.voice.channelId) await leaveVoice();
      state.socket?.emit('private-call:respond', { inviteId: info.inviteId, accept: true }, async response => {
        if (!response?.ok || !response.accepted) {
          button.disabled = false;
          return toast(response?.message || 'Não consegui atender essa ligação.', 4200);
        }
        privateUi.incoming = null;
        removeCallCard();
        await beginPrivateVoice(response);
      });
    };
  }

  async function startPrivateCallFromDm() {
    const peerId = state.activeDmUserId;
    if (!peerId || !state.socket) return;
    if (privateUi.outgoing) return toast('Já existe uma ligação sendo iniciada.');
    const peer = dmPeer(peerId) || { id: peerId, name: els.channelName?.textContent || 'Usuário' };
    const button = ensurePrivateCallButton();
    button.disabled = true;
    state.socket.emit('private-call:start', { userId: peerId }, response => {
      button.disabled = false;
      if (!response?.ok) return toast(response?.message || 'Não consegui iniciar a ligação privada.', 4200);
      showOutgoingCall(response.peer || peer, response.inviteId, response.roomId);
    });
  }

  function showPrivateVoiceView(peer) {
    state.viewMode = 'dm';
    state.selectedChannel = null;
    els.app.classList.add('dm-mode', 'v212-private-voice');
    els.serverName.textContent = 'Privado';
    els.inviteBtn.style.visibility = 'hidden';
    els.serverSettingsBtn.style.visibility = 'hidden';
    renderDmSidebar();
    els.emptyView.classList.add('hidden');
    els.textView.classList.add('hidden');
    els.voiceView.classList.remove('hidden');
    els.channelIcon.textContent = '☎';
    els.channelName.textContent = peer?.name || 'Ligação privada';
    els.channelDesc.textContent = 'Ligação privada';
    els.voiceTitle.textContent = `Ligação com ${peer?.name || 'seu amigo'}`;
    syncPrivateCallButton();
    updateVoiceUI();
  }

  async function beginPrivateVoice(info) {
    const roomId = info?.roomId;
    const peerId = info?.peerId || info?.peer?.id;
    const peer = info?.peer || dmPeer(peerId) || { id: peerId, name: 'Usuário' };
    if (!roomId || !peerId) return;
    if (privateUi.joiningRoom === roomId || (state.voice.serverId === PRIVATE_SERVER_ID && state.voice.channelId === roomId)) return;
    privateUi.joiningRoom = roomId;

    if (state.voice.channelId) await leaveVoice();
    try {
      state.voice.localAudio = await navigator.mediaDevices.getUserMedia({ audio: micConstraints(), video: false });
    } catch {
      privateUi.joiningRoom = null;
      return toast('Não consegui acessar seu microfone. Abra ⚙️ → Áudio e teste o microfone.', 4200);
    }

    state.voice.serverId = PRIVATE_SERVER_ID;
    state.voice.channelId = roomId;
    state.voice.privatePeerId = peerId;
    state.voice.privatePeer = peer;
    state.voice.muted = !!state.media.autoMute;
    state.voice.deafened = false;
    state.voice.pttHeld = false;
    privateUi.activePeer = peer;
    privateUi.activeRoomId = roomId;
    applyMicTrackState();
    addLocalCard();
    startLocalVAD();
    startPeerStats();
    showPrivateVoiceView(peer);

    state.socket.emit('private-call:join', { roomId, peerId }, response => {
      privateUi.joiningRoom = null;
      if (!response?.ok) {
        cleanupVoice();
        els.app.classList.remove('v212-private-voice');
        privateUi.activePeer = null;
        privateUi.activeRoomId = null;
        startDm(peerId, peer);
        toast(response?.message || 'Não consegui conectar a ligação privada.', 4200);
        return;
      }
      setTimeout(emitMediaState, 150);
      updateVoiceUI();
    });
  }

  async function endPrivateVoice(message = '') {
    const peerId = state.voice.privatePeerId || privateUi.activePeer?.id;
    const peer = state.voice.privatePeer || privateUi.activePeer || dmPeer(peerId);
    if (state.voice.serverId === PRIVATE_SERVER_ID && state.voice.channelId) await leaveVoice();
    els.app.classList.remove('v212-private-voice');
    privateUi.activePeer = null;
    privateUi.activeRoomId = null;
    privateUi.joiningRoom = null;
    if (peerId) startDm(peerId, peer);
    if (message) toast(message, 3500);
    syncPrivateCallButton();
  }

  const previousUpdateVoiceUI = updateVoiceUI;
  updateVoiceUI = function updateVoiceUIV212() {
    previousUpdateVoiceUI();
    if (state.voice.serverId !== PRIVATE_SERVER_ID || !state.voice.channelId) return syncPrivateCallButton();
    const peer = state.voice.privatePeer || privateUi.activePeer || dmPeer(state.voice.privatePeerId);
    els.voiceControls.classList.remove('hidden');
    els.reconnectVoiceBtn.classList.remove('hidden');
    els.voiceChannelName.textContent = `Privado · ${peer?.name || 'Amigo'}`;
    els.joinVoiceBtn.textContent = 'Sair da ligação';
    els.voiceSubtitle.textContent = `${state.voice.peers.size + 1} conectado(s) · ligação privada`;
    syncPrivateCallButton();
  };

  const previousRejoinVoiceTransport = rejoinVoiceTransport;
  rejoinVoiceTransport = async function rejoinVoiceTransportV212() {
    if (state.voice.serverId !== PRIVATE_SERVER_ID) return previousRejoinVoiceTransport();
    if (!state.voice.channelId || !state.socket?.connected) return;
    clearPeersOnly();
    state.socket.emit('private-call:join', { roomId: state.voice.channelId, peerId: state.voice.privatePeerId });
    addLocalCard();
    startPeerStats();
    setTimeout(emitMediaState, 250);
  };

  els.hangupBtn?.addEventListener('click', event => {
    if (state.voice.serverId !== PRIVATE_SERVER_ID) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    endPrivateVoice();
  }, true);
  els.joinVoiceBtn?.addEventListener('click', event => {
    if (state.voice.serverId !== PRIVATE_SERVER_ID) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    endPrivateVoice();
  }, true);

  function attachPrivateSocketListeners(socket) {
    if (!socket || socket.__bananaV212UiListeners) return;
    socket.__bananaV212UiListeners = true;
    socket.on('private-call:incoming', info => showIncomingCall(info));
    socket.on('private-call:incoming-status', info => {
      if (privateUi.incoming?.inviteId !== info.inviteId) return;
      if (info.status === 'cancelled') {
        privateUi.incoming = null;
        removeCallCard();
        toast('A ligação foi cancelada.');
      }
    });
    socket.on('private-call:status', async info => {
      if (info.status === 'accepted') {
        privateUi.outgoing = null;
        removeCallCard();
        await beginPrivateVoice(info);
      } else if (info.status === 'declined') {
        privateUi.outgoing = null;
        removeCallCard();
        toast(`${info.peer?.name || 'Usuário'} recusou a ligação.`);
      } else if (info.status === 'cancelled') {
        privateUi.outgoing = null;
        removeCallCard();
      }
    });
    socket.on('private-call:peer-left', info => {
      if (state.voice.serverId === PRIVATE_SERVER_ID && state.voice.channelId === info.roomId) endPrivateVoice('A outra pessoa saiu da ligação.');
    });
    socket.on('private-call:ended', () => syncPrivateCallButton());
  }

  if (window.BananaLegacy?.attachSocket) {
    const previousAttachSocket = window.BananaLegacy.attachSocket;
    window.BananaLegacy.attachSocket = function attachSocketV212Ui(socket, user) {
      attachPrivateSocketListeners(socket);
      return previousAttachSocket(socket, user);
    };
  }
  if (state.socket) attachPrivateSocketListeners(state.socket);

  ensurePrivateCallButton();
  linkifyMessages();
  upgradePermissionModal();
  if (state.viewMode === 'dm') stabilizeDmShell();
})();

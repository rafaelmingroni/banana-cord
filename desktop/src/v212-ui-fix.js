/* Banana Cord V2.0.12 — desktop UX fixes.
 * Clickable links, stable Private navigation, voice double-click/permissions
 * and private 1:1 voice calls.
 */
(() => {
  if (window.__bananaV212UiFix) return;
  window.__bananaV212UiFix = true;

  const { shell } = require('electron');
  const ROLE_RANK_V212 = { member: 0, moderator: 1, admin: 2, owner: 3 };
  const directCalls = new Map();
  const notifiedCalls = new Set();

  const style = document.createElement('style');
  style.textContent = `
    .msg-text .banana-external-link{color:#ffd43b;text-decoration:none;overflow-wrap:anywhere}
    .msg-text .banana-external-link:hover{text-decoration:underline;color:#ffe47a}
    .v212-dm-call-btn{margin-left:10px;border:1px solid #3a3d45;background:#252830;color:#fff;border-radius:9px;padding:7px 11px;font-weight:700;cursor:pointer;white-space:nowrap}
    .v212-dm-call-btn:hover{background:#30333b}.v212-dm-call-btn.active{background:#2f6f4e;border-color:#45a96f}
    .v212-dm-call-btn.ringing{background:#6d5816;border-color:#f5c542;color:#fff4bd}
    .channel.v212-voice-denied{opacity:.48;cursor:not-allowed}
    .channel.v212-voice-denied .symbol::after{content:' 🔒';font-size:10px}
    .app.dm-mode .members{display:none}
    .app.dm-mode .main{grid-column:3 / 5}
  `;
  document.head.appendChild(style);

  function safeHttpUrl(raw) {
    try {
      const url = new URL(String(raw || ''));
      if (!['http:', 'https:'].includes(url.protocol)) return '';
      return url.toString();
    } catch { return ''; }
  }

  function linkifyMessage(text = '') {
    const raw = String(text || '');
    const regex = /https?:\/\/[^\s<>"']+/gi;
    let html = '', cursor = 0, match;
    while ((match = regex.exec(raw))) {
      html += escapeHtml(raw.slice(cursor, match.index));
      let candidate = match[0], suffix = '';
      while (/[.,!?;:)\]}]$/.test(candidate)) {
        suffix = candidate.slice(-1) + suffix;
        candidate = candidate.slice(0, -1);
      }
      const url = safeHttpUrl(candidate);
      if (url) html += `<a href="${escapeHtml(url)}" class="banana-external-link" data-external-url="${escapeHtml(url)}">${escapeHtml(candidate)}</a>${escapeHtml(suffix)}`;
      else html += escapeHtml(match[0]);
      cursor = match.index + match[0].length;
    }
    html += escapeHtml(raw.slice(cursor));
    return html;
  }

  els.messages?.addEventListener('click', event => {
    const link = event.target.closest?.('a[data-external-url]');
    if (!link) return;
    event.preventDefault(); event.stopPropagation();
    const url = safeHttpUrl(link.dataset.externalUrl);
    if (url) shell.openExternal(url).catch(() => toast('Não consegui abrir esse link.', 3500));
  });

  renderMessages = function renderMessagesV212(forceBottom = false) {
    if (!state.selectedChannel || state.selectedChannel.type !== 'text') return;
    const wasBottom = els.messages.scrollHeight - els.messages.scrollTop - els.messages.clientHeight < 90;
    els.messages.innerHTML = '';
    for (const m of state.messagesByChannel.get(state.selectedChannel.id) || []) {
      const u = state.members.get(m.authorId) || { name: 'Usuário' };
      const role = u.role || roleFor(m.authorId);
      const row = document.createElement('div'); row.className = 'message';
      const av = document.createElement('div'); av.className = 'avatar'; avatarStyle(av, u);
      const body = document.createElement('div');
      body.innerHTML = `<div class="msg-head"><b class="role-color-${role}">${escapeHtml(u.name)}</b><small>${fmtTime(m.at)}</small></div><div class="msg-text">${linkifyMessage(m.text)}</div>`;
      row.append(av, body); els.messages.appendChild(row);
    }
    if (forceBottom || wasBottom) els.messages.scrollTop = els.messages.scrollHeight;
  };

  renderDmMessages = function renderDmMessagesV212(forceBottom = false) {
    if (state.viewMode !== 'dm' || !state.activeDmUserId) return;
    const wasBottom = els.messages.scrollHeight - els.messages.scrollTop - els.messages.clientHeight < 90;
    const peer = dmPeer(state.activeDmUserId) || { id: state.activeDmUserId, name: 'Amigo' };
    els.messages.innerHTML = '';
    for (const m of state.dmMessages.get(state.activeDmUserId) || []) {
      const mine = m.fromId === state.user?.id, u = mine ? state.user : peer;
      const row = document.createElement('div'); row.className = 'message dm-message';
      const av = document.createElement('div'); av.className = 'avatar'; avatarStyle(av, u);
      const body = document.createElement('div');
      body.innerHTML = `<div class="msg-head"><b>${escapeHtml(mine ? 'Você' : u?.name || 'Amigo')}</b><small>${fmtTime(m.at)}</small></div><div class="msg-text">${linkifyMessage(m.text)}</div>`;
      row.append(av, body); els.messages.appendChild(row);
    }
    if (!els.messages.children.length) els.messages.innerHTML = '<div class="dm-conversation-empty"><b>Comece a conversa 👋</b><span>As mensagens ficam sincronizadas com segurança no Banana Cloud.</span></div>';
    if (forceBottom || wasBottom) els.messages.scrollTop = els.messages.scrollHeight;
  };

  function resetPrivateSurface() {
    state.viewMode = 'dm'; state.selectedServer = null; state.selectedChannel = null; state.voicePresence = new Map();
    els.app.classList.add('dm-mode'); els.serverName.textContent = 'Privado';
    els.inviteBtn.style.visibility = 'hidden'; els.serverSettingsBtn.style.visibility = 'hidden';
    els.memberList.innerHTML = ''; renderServers();
  }

  function showDmHomeStable() {
    state.activeDmUserId = null; resetPrivateSurface(); renderDmSidebar();
    els.channelIcon.textContent = '💬'; els.channelName.textContent = 'Mensagens privadas';
    els.channelDesc.textContent = 'Converse diretamente com seus amigos';
    els.textView.classList.add('hidden'); els.voiceView.classList.add('hidden');
    els.emptyView.innerHTML = '<div class="big-banana">🍌</div><h2>Mensagens privadas</h2><p>Escolha uma conversa na lateral ou inicie uma nova.</p>';
    els.emptyView.classList.remove('hidden'); state.socket?.emit('dm:conversations:get'); renderDirectCallButton();
  }

  function startDmStable(userId, user = null) {
    if (!userId || userId === state.user?.id) return;
    const peer = user || dmPeer(userId); if (peer) mergeDmConversation(peer, null);
    state.activeDmUserId = userId; state.dmUnread.delete(userId); updateDmUnreadBadge();
    resetPrivateSurface(); renderDmSidebar();
    els.emptyView.classList.add('hidden'); els.voiceView.classList.add('hidden'); els.textView.classList.remove('hidden');
    els.channelIcon.textContent = '@'; els.channelName.textContent = peer?.name || 'Mensagem privada'; els.channelDesc.textContent = 'Mensagem privada';
    els.messageInput.placeholder = `Mensagem para ${peer?.name || 'seu amigo'}`;
    renderDmMessages(); renderDirectCallButton(); state.socket?.emit('dm:load', { userId });
    setTimeout(() => els.messageInput.focus(), 0);
  }

  showDmHome = showDmHomeStable; startDm = startDmStable;
  els.homeServer?.addEventListener('click', event => {
    event.preventDefault(); event.stopImmediatePropagation(); showDmHomeStable();
  }, true);

  function roleCanAccessLocal(channel) {
    const roles = Array.isArray(channel?.allowedRoles) ? channel.allowedRoles : [];
    if (!roles.length) return true;
    const role = currentRole(); if (role === 'owner') return true;
    let minRank = 99;
    for (const allowed of roles) if (ROLE_RANK_V212[allowed] != null) minRank = Math.min(minRank, ROLE_RANK_V212[allowed]);
    return (ROLE_RANK_V212[role] ?? -1) >= minRank;
  }

  const renderChannelsBase = renderChannels;
  renderChannels = function renderChannelsV212() {
    renderChannelsBase();
    if (state.viewMode !== 'server' || !state.selectedServer) return;
    for (const row of els.channels.querySelectorAll('.channel-row')) {
      const channel = state.selectedServer.channels.find(c => c.id === row.dataset.channelId);
      if (!channel || channel.type !== 'voice') continue;
      const button = row.querySelector('.channel'); if (!button) continue;
      const allowed = roleCanAccessLocal(channel);
      button.classList.toggle('v212-voice-denied', !allowed);
      if (!allowed) button.title = 'Seu cargo não permite entrar nesta sala';
      button.addEventListener('dblclick', async event => {
        event.preventDefault(); event.stopPropagation();
        if (!roleCanAccessLocal(channel)) return toast('Seu cargo não permite entrar nessa sala de voz.', 3600);
        selectChannel(channel.id); await joinVoice(channel);
      });
    }
  };

  const joinVoiceBase = joinVoice;
  joinVoice = async function joinVoiceV212(channel) {
    if (channel?.type === 'voice' && state.viewMode === 'server' && !roleCanAccessLocal(channel)) {
      toast('Seu cargo não permite entrar nessa sala de voz.', 3600); return;
    }
    return joinVoiceBase(channel);
  };

  function ensureDirectCallButton() {
    let button = document.getElementById('v212DmCallBtn');
    if (button) return button;
    button = document.createElement('button'); button.id = 'v212DmCallBtn'; button.type = 'button'; button.className = 'v212-dm-call-btn hidden';
    button.addEventListener('click', () => toggleDirectCall());
    els.connectionBadge?.insertAdjacentElement('beforebegin', button); return button;
  }

  function currentDirectPeer() { return state.voice?.channelId === 'direct' ? state.voice?.directPeerId : null; }

  function renderDirectCallButton() {
    const button = ensureDirectCallButton(), peerId = state.viewMode === 'dm' ? state.activeDmUserId : null;
    button.classList.toggle('hidden', !peerId); if (!peerId) return;
    const call = directCalls.get(peerId), connected = currentDirectPeer() === peerId;
    button.classList.toggle('active', connected);
    button.classList.toggle('ringing', !!call && !connected && call.activeCall?.startedBy !== state.user?.id);
    if (connected) button.textContent = '📞 Desligar';
    else if (call?.activeCall?.startedBy === state.user?.id) button.textContent = '📞 Entrar na chamada';
    else if (call) button.textContent = '📞 Atender';
    else button.textContent = '📞 Ligar';
  }

  async function joinDirectVoice(peerId) {
    if (!peerId || peerId === state.user?.id) return;
    if (state.voice.channelId) await leaveVoice();
    try { state.voice.localAudio = await navigator.mediaDevices.getUserMedia({ audio: micConstraints(), video: false }); }
    catch { return toast('Não consegui acessar seu microfone. Abra ⚙️ → Áudio e teste o microfone.'); }
    const ids = [String(state.user?.id || ''), String(peerId)].sort();
    state.voice.serverId = `dm_${ids[0]}_${ids[1]}`; state.voice.channelId = 'direct'; state.voice.directPeerId = peerId;
    state.voice.muted = !!state.media.autoMute; state.voice.deafened = false; state.voice.pttHeld = false;
    applyMicTrackState(); state.socket.emit('voice:join', { directUserId: peerId, channelId: 'direct' });
    addLocalCard(); startLocalVAD(); updateVoiceUI(); startPeerStats(); setTimeout(emitMediaState, 250);
  }

  async function toggleDirectCall() {
    const peerId = state.activeDmUserId; if (!peerId) return;
    if (currentDirectPeer() === peerId) { await leaveVoice(); renderDirectCallButton(); return; }
    if (state.voice.channelId) await leaveVoice();
    if (directCalls.get(peerId)) return joinDirectVoice(peerId);
    const button = ensureDirectCallButton(); button.disabled = true;
    state.socket.emit('dm:call:start', { userId: peerId }, async result => {
      button.disabled = false;
      if (result?.ok === false) return toast(result.message || 'Não consegui iniciar a chamada privada.', 4200);
      await joinDirectVoice(peerId);
    });
  }

  const updateVoiceUIBase = updateVoiceUI;
  updateVoiceUI = function updateVoiceUIV212() {
    updateVoiceUIBase();
    const peerId = currentDirectPeer(), direct = !!peerId;
    els.cameraBtn?.classList.toggle('hidden', direct); els.screenBtn?.classList.toggle('hidden', direct);
    if (direct) {
      const peer = dmPeer(peerId); els.voiceChannelName.textContent = `Privado · ${peer?.name || 'Amigo'}`;
      els.voiceSubtitle.textContent = `${state.voice.peers.size + 1} conectado(s) · chamada privada`;
    }
    renderDirectCallButton();
  };

  const rejoinVoiceTransportBase = rejoinVoiceTransport;
  rejoinVoiceTransport = async function rejoinVoiceTransportV212() {
    if (state.voice?.channelId !== 'direct') return rejoinVoiceTransportBase();
    if (!state.voice.directPeerId || !state.socket?.connected) return;
    clearPeersOnly(); state.socket.emit('voice:join', { directUserId: state.voice.directPeerId, channelId: 'direct' });
    addLocalCard(); startPeerStats(); setTimeout(emitMediaState, 250);
  };

  function bindV212Socket(socket) {
    if (!socket || socket.__bananaV212UiBound) return;
    socket.__bananaV212UiBound = true;
    socket.on('dm:call-state', ({ calls }) => {
      directCalls.clear();
      for (const row of calls || []) if (row?.peerId && row.activeCall) directCalls.set(row.peerId, row);
      for (const [peerId, row] of directCalls) {
        const startedBy = row.activeCall?.startedBy, startedAt = row.activeCall?.startedAt;
        const key = `${peerId}:${startedBy}:${startedAt}`;
        if (startedBy && startedBy !== state.user?.id && !notifiedCalls.has(key)) {
          notifiedCalls.add(key); const peer = dmPeer(peerId);
          toast(`📞 ${peer?.name || 'Um amigo'} está te ligando.`, 5200); window.BananaNotificationSounds?.play?.('dm');
        }
      }
      if (state.viewMode === 'dm') { renderDmSidebar(); renderDirectCallButton(); }
    });
    socket.emit('dm:call:get', {}, () => {});
  }

  const bindSocketBase = bindSocket;
  bindSocket = function bindSocketV212(socket) { bindSocketBase(socket); bindV212Socket(socket); };
  if (state.socket) bindV212Socket(state.socket);

  const selectServerBase = selectServer;
  selectServer = function selectServerV212(id) { const result = selectServerBase(id); renderDirectCallButton(); return result; };

  ensureDirectCallButton(); renderDirectCallButton();
})();

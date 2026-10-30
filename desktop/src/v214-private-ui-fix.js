/* Banana Cord V2.0.14 — stable/private UI.
 * Prevents server/voice renders from wiping the DM sidebar and gives Privado
 * its own resilient layout instead of relying on server navigation state.
 */
(() => {
  if (window.__bananaV214PrivateUiFix) return;
  window.__bananaV214PrivateUiFix = true;

  const style = document.createElement('style');
  style.textContent = `
    .app.dm-mode .sidebar{background:linear-gradient(180deg,#191a1e 0%,#151619 100%)}
    .app.dm-mode .server-title{height:58px;padding:0 14px;border-bottom:1px solid #25272c;background:#17181b}
    .app.dm-mode .server-title strong{font-size:15px;letter-spacing:-.01em}
    .app.dm-mode .channels{padding:12px 10px 14px}
    .v214-private-sidebar{display:flex!important;flex-direction:column;gap:10px;min-height:100%}
    .v214-private-intro{padding:8px 10px 10px;border:1px solid #343027;border-radius:12px;background:linear-gradient(145deg,#252116,#1b1b1d);box-shadow:0 8px 22px #0002}
    .v214-private-intro b{display:block;font-size:13px;color:#fff2a6;margin-bottom:3px}
    .v214-private-intro span{display:block;color:#8f949d;font-size:10px;line-height:1.4}
    .v214-private-sidebar .v1-dm-tools{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin:0}
    .v214-private-sidebar .v1-dm-tools button,.v214-private-sidebar .v207-dm-add-friend{margin:0!important;min-width:0;border-radius:9px!important;padding:9px 10px!important;font-size:11px!important;font-weight:800!important}
    .v214-private-sidebar .v1-dm-tools button{background:#24262b!important;border:1px solid #383b42!important;color:#e6e8ec!important;text-align:center!important}
    .v214-private-sidebar .v1-dm-tools button:hover{background:#2c2f35!important;border-color:#4a4e56!important}
    .v214-private-sidebar .v207-dm-add-friend{order:3;width:100%;background:linear-gradient(180deg,#f7cf3e,#e2b918)!important;border:1px solid #ffdf68!important;color:#211a00!important;text-align:center!important;box-shadow:0 6px 18px #f3c62312}
    .v214-private-sidebar .v207-dm-add-friend:hover{filter:brightness(1.06)}
    .v214-private-section-title{display:flex;align-items:center;justify-content:space-between;margin:2px 4px -2px;color:#8d929c;font-size:9px;font-weight:900;letter-spacing:.09em;text-transform:uppercase}
    .v214-private-section-title small{font-size:9px;color:#666c75;letter-spacing:0;text-transform:none;font-weight:700}
    .v214-private-request{width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 10px;border:1px solid #6f5b1c;border-radius:9px;background:#302812;color:#ffe783;font-size:10px;font-weight:800;text-align:left;cursor:pointer}
    .v214-private-request:hover{background:#3a3015;border-color:#9a7b20}
    .v214-private-request span:last-child{color:#f3c623;font-size:14px}
    .v214-private-sidebar .v1-friend-quick{display:grid;gap:3px;margin:0}
    .v214-private-sidebar .v1-friend-quick-row{border:1px solid transparent;border-radius:9px;padding:7px;background:transparent;transition:.12s}
    .v214-private-sidebar .v1-friend-quick-row:hover{background:#24272c;border-color:#30343a}
    .v214-private-sidebar .v1-friend-quick-row .avatar{width:34px;height:34px}
    .v214-private-sidebar .dm-conversation-list{display:grid;gap:3px}
    .v214-private-sidebar .dm-row{border:1px solid transparent;padding:7px 8px;border-radius:10px}
    .v214-private-sidebar .dm-row:hover{background:#23262b;border-color:#30343a}
    .v214-private-sidebar .dm-row.active{background:#302b17;border-color:#5a4c1e;box-shadow:inset 3px 0 0 #f3c623}
    .v214-private-empty-mini{border:1px dashed #35383f;border-radius:10px;padding:13px 10px;color:#747a84;font-size:10px;line-height:1.45;text-align:center;background:#17191c}
    .v214-private-home{display:grid;place-items:center;max-width:460px;text-align:center;padding:28px}
    .v214-private-home img{width:92px;height:92px;object-fit:contain;border-radius:23px;box-shadow:0 16px 42px #0007,0 0 28px #f3c62318;margin-bottom:14px}
    .v214-private-home h2{margin:0 0 7px;color:#f4f5f6;font-size:24px}
    .v214-private-home p{margin:0;color:#8c929c;font-size:12px;line-height:1.5;max-width:390px}
    .v214-private-home-actions{display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin-top:18px}
    .v214-private-home-actions button{border-radius:9px;padding:9px 13px;font-size:11px;font-weight:800;cursor:pointer}
    .v214-private-home-actions .primary{background:#f3c623;color:#201900}
    .v214-private-home-actions .secondary{background:#282b30;color:#e6e8ec;border:1px solid #3b3f46}
    .v214-private-home-actions button:hover{filter:brightness(1.08)}
    .app.dm-mode .profile-bar{border-top:1px solid #24262b}
  `;
  document.head.appendChild(style);

  let lastServer = state.selectedServer || null;
  let privateRendering = false;
  let repairQueued = false;

  function validLastServer() {
    if (!lastServer?.id) return null;
    return state.servers?.find?.(server => server.id === lastServer.id) || null;
  }

  function rememberServer() {
    if (state.viewMode === 'server' && state.selectedServer?.id) lastServer = state.selectedServer;
  }

  function restoreServerReference() {
    if (state.viewMode !== 'dm' || state.selectedServer) return;
    const server = validLastServer();
    if (server) state.selectedServer = server;
  }

  function decoratePrivateSidebar() {
    if (state.viewMode !== 'dm') return;
    const sidebar = els.channels?.querySelector?.('.dm-sidebar');
    if (!sidebar) return;
    sidebar.classList.add('v214-private-sidebar');

    if (!sidebar.querySelector('.v214-private-intro')) {
      const intro = document.createElement('div');
      intro.className = 'v214-private-intro';
      intro.innerHTML = '<b>Seu espaço privado</b><span>Amigos, mensagens diretas e chamadas sem depender de um servidor.</span>';
      sidebar.prepend(intro);
    }

    const tools = sidebar.querySelector('.v1-dm-tools');
    const friendsButton = document.getElementById('v1FriendsBtn');
    const newDmButton = document.getElementById('newDmBtn');
    const addFriendButton = document.getElementById('v207AddFriendBtn');
    if (friendsButton) friendsButton.title = 'Ver amigos e solicitações';
    if (newDmButton) { newDmButton.textContent = '💬 Mensagem'; newDmButton.title = 'Iniciar mensagem privada'; }
    if (addFriendButton) { addFriendButton.textContent = '＋ Adicionar amigo'; addFriendButton.title = 'Procurar usuário pelo nome'; }

    const incoming = Number(state?.v1?.social?.incoming?.length || 0);
    if (incoming > 0 && tools && !sidebar.querySelector('.v214-private-request')) {
      const request = document.createElement('button');
      request.type = 'button';
      request.className = 'v214-private-request';
      request.innerHTML = `<span>${incoming} solicita${incoming === 1 ? 'ção' : 'ções'} de amizade pendente${incoming === 1 ? '' : 's'}</span><span>›</span>`;
      request.onclick = () => friendsButton?.click();
      tools.insertAdjacentElement('afterend', request);
    }

    const friendQuick = document.getElementById('v1FriendQuick');
    if (friendQuick && !friendQuick.previousElementSibling?.classList?.contains('v214-private-section-title')) {
      const heading = document.createElement('div');
      heading.className = 'v214-private-section-title';
      const count = Number(state?.v1?.social?.friends?.length || 0);
      heading.innerHTML = `<span>Amigos</span><small>${count}</small>`;
      friendQuick.insertAdjacentElement('beforebegin', heading);
    }
    if (friendQuick && !friendQuick.children.length) {
      const empty = document.createElement('div');
      empty.className = 'v214-private-empty-mini';
      empty.textContent = 'Você ainda não tem amigos aqui. Use “Adicionar amigo” para encontrar alguém.';
      friendQuick.appendChild(empty);
    }

    const recentTitle = sidebar.querySelector('.v1-recent-title');
    if (recentTitle) recentTitle.classList.add('v214-private-section-title');
    const conversationList = document.getElementById('dmConversationList');
    const legacyEmpty = conversationList?.querySelector?.('.dm-empty-list');
    if (legacyEmpty) {
      legacyEmpty.className = 'v214-private-empty-mini';
      legacyEmpty.textContent = 'Nenhuma conversa recente. Abra uma mensagem com um amigo para começar.';
    }
  }

  function renderPrivateHome() {
    if (state.viewMode !== 'dm' || state.activeDmUserId) return;
    els.channelIcon.textContent = '💬';
    els.channelName.textContent = 'Mensagens privadas';
    els.channelDesc.textContent = 'Amigos, mensagens e chamadas';
    els.textView.classList.add('hidden');
    els.voiceView.classList.add('hidden');
    els.emptyView.innerHTML = `
      <div class="v214-private-home">
        <img src="../assets/banana-cord.png" alt="Banana Cord">
        <div>
          <h2>Privado</h2>
          <p>Converse diretamente com seus amigos, inicie chamadas privadas e acompanhe suas mensagens em um espaço separado dos servidores.</p>
          <div class="v214-private-home-actions">
            <button id="v214HomeFriend" class="primary" type="button">＋ Adicionar amigo</button>
            <button id="v214HomeMessage" class="secondary" type="button">💬 Nova mensagem</button>
            <button id="v214HomeFriends" class="secondary" type="button">👥 Amigos</button>
          </div>
        </div>
      </div>`;
    els.emptyView.classList.remove('hidden');
    document.getElementById('v214HomeFriend')?.addEventListener('click', () => window.BananaOpenFriendSearch?.());
    document.getElementById('v214HomeMessage')?.addEventListener('click', () => document.getElementById('newDmBtn')?.click());
    document.getElementById('v214HomeFriends')?.addEventListener('click', () => document.getElementById('v1FriendsBtn')?.click());
  }

  const renderDmSidebarBase = renderDmSidebar;
  renderDmSidebar = function renderDmSidebarV214() {
    if (state.viewMode !== 'dm') return;
    if (privateRendering) return;
    privateRendering = true;
    try {
      renderDmSidebarBase();
      decoratePrivateSidebar();
    } finally {
      privateRendering = false;
    }
  };

  // Critical fix: the V2.0.12 wrapper called the server renderer first. That
  // renderer clears #channels before discovering it is currently in Privado.
  // Voice speaking/media updates therefore erased the whole DM sidebar.
  const renderChannelsBase = renderChannels;
  renderChannels = function renderChannelsV214() {
    if (state.viewMode === 'dm') {
      renderDmSidebar();
      return;
    }
    return renderChannelsBase();
  };

  const showDmHomeBase = showDmHome;
  showDmHome = function showDmHomeV214(...args) {
    rememberServer();
    const result = showDmHomeBase(...args);
    restoreServerReference();
    els.app.classList.add('dm-mode');
    els.serverName.textContent = 'Privado';
    renderDmSidebar();
    renderPrivateHome();
    renderServers();
    return result;
  };

  const startDmBase = startDm;
  startDm = function startDmV214(userId, user = null) {
    rememberServer();
    const result = startDmBase(userId, user);
    restoreServerReference();
    els.app.classList.add('dm-mode');
    els.serverName.textContent = 'Privado';
    renderDmSidebar();
    renderServers();
    return result;
  };

  const selectServerBase = selectServer;
  selectServer = function selectServerV214(id) {
    const result = selectServerBase(id);
    if (state.selectedServer?.id) lastServer = state.selectedServer;
    return result;
  };

  // Self-healing guard for any older compatibility handler that writes directly
  // into #channels instead of going through renderChannels().
  const channelsObserver = new MutationObserver(() => {
    if (privateRendering || repairQueued || state.viewMode !== 'dm') return;
    if (els.channels?.querySelector?.('.dm-sidebar')) return;
    repairQueued = true;
    queueMicrotask(() => {
      repairQueued = false;
      if (state.viewMode !== 'dm' || els.channels?.querySelector?.('.dm-sidebar')) return;
      renderDmSidebar();
      if (!state.activeDmUserId) renderPrivateHome();
    });
  });
  if (els.channels) channelsObserver.observe(els.channels, { childList: true, subtree: false });

  // Keep Private selected through Cloud reconnect/auth refresh. V2.0.12 cleared
  // selectedServer, which made auth:ready auto-select the first server again.
  const bindSocketBase = bindSocket;
  bindSocket = function bindSocketV214(socket) {
    bindSocketBase(socket);
    if (!socket || socket.__bananaV214PrivateBound) return;
    socket.__bananaV214PrivateBound = true;
    socket.on('auth:ready', () => {
      if (state.viewMode !== 'dm') return;
      restoreServerReference();
      queueMicrotask(() => {
        if (state.viewMode !== 'dm') return;
        els.app.classList.add('dm-mode');
        els.serverName.textContent = 'Privado';
        renderDmSidebar();
        if (!state.activeDmUserId) renderPrivateHome();
        renderServers();
      });
    });
  };

  if (state.viewMode === 'dm') {
    restoreServerReference();
    renderDmSidebar();
    if (!state.activeDmUserId) renderPrivateHome();
  }
})();

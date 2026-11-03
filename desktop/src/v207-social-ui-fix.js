/* Mingrx compatibility layer for the V2.0.7 onboarding + friend search UI. */
(() => {
  if (window.__bananaV207SocialUiFix) return;
  window.__bananaV207SocialUiFix = true;

  const style = document.createElement('style');
  style.textContent = `
    .v207-onboarding-actions{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:18px}
    .v207-onboarding-actions button,.v207-friend-search button{border:0;border-radius:10px;padding:10px 14px;font-weight:700;cursor:pointer;transition:background-color .14s ease,border-color .14s ease,color .14s ease,transform .14s ease}
    .v207-primary{background:var(--mx-accent,#7c5cff);color:var(--mx-on-accent,#fff)}
    .v207-primary:hover{filter:brightness(1.06)}
    .v207-secondary{background:var(--mx-panel-3,#1a1d27);color:var(--mx-text,#fff);border:1px solid var(--mx-line,#2a2d38)!important}
    .v207-secondary:hover{background:var(--mx-hover,#222530)}
    .v207-friend-search{display:grid;grid-template-columns:1fr auto;gap:8px;margin:12px 0}
    .v207-friend-search input{min-width:0;border-radius:9px;border:1px solid var(--mx-line,#3b3f48);background:var(--mx-bg,#17191e);color:var(--mx-text,#fff);padding:10px 12px}
    .v207-friend-results{display:flex;flex-direction:column;gap:8px;max-height:330px;overflow:auto}
    .v207-friend-row{display:flex;align-items:center;gap:10px;padding:9px;border-radius:10px;background:var(--mx-panel-2,#1f2127)}
    .v207-friend-row .avatar{flex:0 0 auto}.v207-friend-row .v207-user-copy{flex:1;min-width:0}
    .v207-friend-row b,.v207-friend-row small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .v207-friend-row small{opacity:.65;margin-top:2px}.v207-friend-row button{background:var(--mx-accent,#7c5cff);color:var(--mx-on-accent,#fff)}
    .v207-dm-add-friend{width:100%;margin:8px 0 2px;padding:9px 10px;border-radius:9px;border:1px solid var(--mx-line,#3a3d45);background:var(--mx-panel-3,#252830);color:var(--mx-text,#fff);font-weight:700;cursor:pointer}
    .v207-mingrx-mark{width:68px;height:68px;display:block;margin:0 auto 12px;object-fit:contain}
  `;
  document.head.appendChild(style);

  function openFriendSearch() {
    openModal(`
      <div class="simple-modal-head">
        <h2>Adicionar amigo</h2>
        <p>Procure pelo nome de usuário. Não é preciso estar na mesma comunidade.</p>
      </div>
      <div class="v207-friend-search">
        <input id="v207FriendQuery" maxlength="32" autocomplete="off" placeholder="Nome do usuário">
        <button id="v207FriendSearchBtn" class="v207-primary">Buscar</button>
      </div>
      <div id="v207FriendResults" class="v207-friend-results"><small>Digite o nome para procurar.</small></div>
    `);

    const input = document.getElementById('v207FriendQuery');
    const searchBtn = document.getElementById('v207FriendSearchBtn');
    const results = document.getElementById('v207FriendResults');

    const search = () => {
      const query = input?.value.trim();
      if (!query) return;
      searchBtn.disabled = true;
      results.innerHTML = '<small>Procurando…</small>';
      state.socket?.emit('friend:search', { query }, response => {
        searchBtn.disabled = false;
        const users = response?.users || [];
        if (!response?.ok) {
          results.innerHTML = `<small>${escapeHtml(response?.message || 'Não consegui procurar esse usuário.')}</small>`;
          return;
        }
        if (!users.length) {
          results.innerHTML = '<small>Nenhum usuário encontrado com esse nome.</small>';
          return;
        }
        results.innerHTML = '';
        for (const user of users) {
          const row = document.createElement('div');
          row.className = 'v207-friend-row';
          const av = document.createElement('div'); av.className = 'avatar'; avatarStyle(av, user);
          const text = document.createElement('div'); text.className = 'v207-user-copy';
          text.innerHTML = `<b>${escapeHtml(user.name || 'Usuário')}</b><small>${escapeHtml(user.customStatus || STATUS_LABEL[user.status || 'offline'] || 'Offline')}</small>`;
          const add = document.createElement('button'); add.textContent = 'Adicionar';
          add.onclick = () => {
            add.disabled = true;
            state.socket?.emit('friend:request', { userId: user.id }, result => {
              if (result?.ok === false) {
                add.disabled = false;
                return toast(result.message || 'Não consegui enviar a solicitação.', 4200);
              }
              add.textContent = 'Enviado ✓';
              toast(`Solicitação enviada para ${user.name || 'usuário'}.`);
            });
          };
          row.append(av, text, add); results.appendChild(row);
        }
      });
    };
    searchBtn.onclick = search;
    input?.addEventListener('keydown', event => { if (event.key === 'Enter') search(); });
    setTimeout(() => input?.focus(), 0);
  }
  window.BananaOpenFriendSearch = openFriendSearch;

  const renderDmSidebarBase = renderDmSidebar;
  renderDmSidebar = function renderDmSidebarV207() {
    renderDmSidebarBase();
    if (state.viewMode !== 'dm') return;
    const sidebar = document.querySelector('.dm-sidebar');
    const newDm = document.getElementById('newDmBtn');
    if (!sidebar || document.getElementById('v207AddFriendBtn')) return;
    const button = document.createElement('button');
    button.id = 'v207AddFriendBtn';
    button.className = 'v207-dm-add-friend';
    button.textContent = '👤 Adicionar amigo';
    button.onclick = openFriendSearch;
    newDm?.insertAdjacentElement('afterend', button);
  };

  openNewDmModal = function openNewDmModalV207() {
    const byId = new Map();
    for (const user of [...state.members.values()]) if (user?.id && user.id !== state.user?.id) byId.set(user.id, user);
    try {
      for (const user of (v1?.social?.friends || [])) if (user?.id && user.id !== state.user?.id) byId.set(user.id, user);
    } catch {}
    const candidates = [...byId.values()];
    openModal(`<div class="simple-modal-head"><h2>Nova mensagem</h2><p>Escolha um amigo ou alguém da comunidade atual.</p></div><div class="dm-picker">${candidates.map(u=>`<button class="dm-picker-row" data-user="${escapeHtml(u.id)}"><span class="dm-picker-avatar avatar" data-avatar="${escapeHtml(u.id)}"></span><span><b>${escapeHtml(u.name)}</b><small>${STATUS_LABEL[u.status||'offline']||'Offline'}</small></span></button>`).join('')||'<p>Nenhum contato disponível. Use “Adicionar amigo” para procurar alguém pelo nome.</p>'}</div>`);
    for (const av of document.querySelectorAll('.dm-picker-avatar')) avatarStyle(av, byId.get(av.dataset.avatar));
    for (const button of document.querySelectorAll('.dm-picker-row')) button.onclick = () => {
      const user = byId.get(button.dataset.user); closeModal(); startDm(button.dataset.user, user);
    };
  };

  const renderDmMessagesBase = renderDmMessages;
  renderDmMessages = function renderDmMessagesV207(forceBottom = false) {
    renderDmMessagesBase(forceBottom);
    const emptyCopy = els.messages?.querySelector?.('.dm-conversation-empty span');
    if (emptyCopy) emptyCopy.textContent = 'As mensagens ficam sincronizadas com segurança no Mingrx Cloud.';
  };

  const showEmptyBase = showEmpty;
  showEmpty = function showEmptyV207() {
    showEmptyBase();
    if (state.servers?.length) return;
    els.emptyView.innerHTML = `
      <img class="v207-mingrx-mark" src="../assets/mingrx.svg" alt="Mingrx">
      <h2>Bem-vindo ao Mingrx</h2>
      <p>Crie ou entre em uma comunidade para começar, ou adicione um amigo pelo nome.</p>
      <div class="v207-onboarding-actions">
        <button id="v207StartServer" class="v207-primary">＋ Comunidades</button>
        <button id="v207StartFriend" class="v207-secondary">👤 Adicionar amigo</button>
      </div>`;
    document.getElementById('v207StartServer')?.addEventListener('click', () => {
      if (typeof window.MingrxOpenCommunity === 'function') window.MingrxOpenCommunity();
      else document.getElementById('addServerBtn')?.click();
    });
    document.getElementById('v207StartFriend')?.addEventListener('click', openFriendSearch);
  };

  queueMicrotask(() => {
    if (!state?.servers?.length && !document.getElementById('app')?.classList.contains('hidden')) showEmpty();
    if (state?.viewMode === 'dm') renderDmSidebar();
  });
})();

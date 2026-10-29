/* Banana Cord V2.0.5 onboarding + friend search UI. */
(() => {
  if (window.__bananaV205SocialUiFix) return;
  window.__bananaV205SocialUiFix = true;

  const style = document.createElement('style');
  style.textContent = `
    .v205-onboarding-actions{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:18px}
    .v205-onboarding-actions button,.v205-friend-search button{border:0;border-radius:10px;padding:10px 14px;font-weight:700;cursor:pointer}
    .v205-primary{background:#f5c542;color:#181200}.v205-secondary{background:#24262c;color:#fff;border:1px solid #3a3d45!important}
    .v205-friend-search{display:grid;grid-template-columns:1fr auto;gap:8px;margin:12px 0}
    .v205-friend-search input{min-width:0;border-radius:9px;border:1px solid #3b3f48;background:#17191e;color:#fff;padding:10px 12px}
    .v205-friend-results{display:flex;flex-direction:column;gap:8px;max-height:330px;overflow:auto}
    .v205-friend-row{display:flex;align-items:center;gap:10px;padding:9px;border-radius:10px;background:#1f2127}
    .v205-friend-row .avatar{flex:0 0 auto}.v205-friend-row .v205-user-copy{flex:1;min-width:0}
    .v205-friend-row b,.v205-friend-row small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .v205-friend-row small{opacity:.65;margin-top:2px}.v205-friend-row button{background:#f5c542;color:#181200}
    .v205-dm-add-friend{width:100%;margin:8px 0 2px;padding:9px 10px;border-radius:9px;border:1px solid #3a3d45;background:#252830;color:#fff;font-weight:700;cursor:pointer}
  `;
  document.head.appendChild(style);

  function openFriendSearch() {
    openModal(`
      <div class="simple-modal-head">
        <h2>Adicionar amigo</h2>
        <p>Procure pelo nome de usuário exato. Não é preciso estar no mesmo servidor.</p>
      </div>
      <div class="v205-friend-search">
        <input id="v205FriendQuery" maxlength="32" autocomplete="off" placeholder="Nome do usuário">
        <button id="v205FriendSearchBtn" class="v205-primary">Buscar</button>
      </div>
      <div id="v205FriendResults" class="v205-friend-results"><small>Digite o nome para procurar.</small></div>
    `);

    const input = document.getElementById('v205FriendQuery');
    const searchBtn = document.getElementById('v205FriendSearchBtn');
    const results = document.getElementById('v205FriendResults');

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
          results.innerHTML = '<small>Nenhum usuário encontrado com esse nome. Confira a grafia exata.</small>';
          return;
        }
        results.innerHTML = '';
        for (const user of users) {
          const row = document.createElement('div');
          row.className = 'v205-friend-row';
          const av = document.createElement('div'); av.className = 'avatar'; avatarStyle(av, user);
          const text = document.createElement('div'); text.className = 'v205-user-copy';
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
  renderDmSidebar = function renderDmSidebarV205() {
    renderDmSidebarBase();
    if (state.viewMode !== 'dm') return;
    const sidebar = document.querySelector('.dm-sidebar');
    const newDm = document.getElementById('newDmBtn');
    if (!sidebar || document.getElementById('v205AddFriendBtn')) return;
    const button = document.createElement('button');
    button.id = 'v205AddFriendBtn';
    button.className = 'v205-dm-add-friend';
    button.textContent = '👤 Adicionar amigo';
    button.onclick = openFriendSearch;
    newDm?.insertAdjacentElement('afterend', button);
  };

  // "Nova mensagem" now includes accepted friends even when they do not share a server.
  openNewDmModal = function openNewDmModalV205() {
    const byId = new Map();
    for (const user of [...state.members.values()]) if (user?.id && user.id !== state.user?.id) byId.set(user.id, user);
    try {
      for (const user of (v1?.social?.friends || [])) if (user?.id && user.id !== state.user?.id) byId.set(user.id, user);
    } catch {}
    const candidates = [...byId.values()];
    openModal(`<div class="simple-modal-head"><h2>Nova mensagem</h2><p>Escolha um amigo ou alguém do servidor atual.</p></div><div class="dm-picker">${candidates.map(u=>`<button class="dm-picker-row" data-user="${escapeHtml(u.id)}"><span class="dm-picker-avatar avatar" data-avatar="${escapeHtml(u.id)}"></span><span><b>${escapeHtml(u.name)}</b><small>${STATUS_LABEL[u.status||'offline']||'Offline'}</small></span></button>`).join('')||'<p>Nenhum contato disponível. Use “Adicionar amigo” para procurar alguém pelo nome.</p>'}</div>`);
    for (const av of document.querySelectorAll('.dm-picker-avatar')) avatarStyle(av, byId.get(av.dataset.avatar));
    for (const button of document.querySelectorAll('.dm-picker-row')) button.onclick = () => {
      const user = byId.get(button.dataset.user); closeModal(); startDm(button.dataset.user, user);
    };
  };

  const showEmptyBase = showEmpty;
  showEmpty = function showEmptyV205() {
    showEmptyBase();
    if (state.servers?.length) return;
    els.emptyView.innerHTML = `
      <div class="big-banana">🍌</div>
      <h2>Bem-vindo ao Banana Cord</h2>
      <p>Entre em um servidor para conversar com a galera, ou adicione um amigo pelo nome.</p>
      <div class="v205-onboarding-actions">
        <button id="v205StartServer" class="v205-primary">＋ Criar ou entrar em um servidor</button>
        <button id="v205StartFriend" class="v205-secondary">👤 Adicionar amigo</button>
      </div>`;
    document.getElementById('v205StartServer')?.addEventListener('click', () => els.addServerBtn?.click());
    document.getElementById('v205StartFriend')?.addEventListener('click', openFriendSearch);
  };

  // If auth completed before this late compatibility layer loaded, refresh the view now.
  queueMicrotask(() => {
    if (!state?.servers?.length && !document.getElementById('app')?.classList.contains('hidden')) showEmpty();
    if (state?.viewMode === 'dm') renderDmSidebar();
  });
})();

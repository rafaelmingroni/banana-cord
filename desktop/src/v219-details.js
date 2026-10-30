/* Banana Cord V2.0.19 — richer dates + cleaner hierarchy while staying lightweight. */
(() => {
  if (window.__bananaV219Details) return;
  window.__bananaV219Details = true;

  const DAY = 86400000;
  const ROLE_ORDER = ['owner','admin','moderator','member'];
  const ROLE_ICON = { owner:'👑', admin:'◆', moderator:'●', member:'' };
  const ROLE_GROUP = { owner:'Dono', admin:'Administradores', moderator:'Moderadores', member:'Membros' };

  function dayStart(ts) {
    const d = new Date(Number(ts) || Date.now());
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  }

  function dateKey(ts) {
    const d = new Date(Number(ts) || Date.now());
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }

  function shortDate(ts) {
    return new Date(Number(ts) || Date.now()).toLocaleDateString('pt-BR', { day:'2-digit', month:'long' });
  }

  function fullDate(ts) {
    return new Date(Number(ts) || Date.now()).toLocaleDateString('pt-BR', { day:'2-digit', month:'long', year:'numeric' });
  }

  function relativeDateLabel(ts) {
    const target = dayStart(ts);
    const today = dayStart(Date.now());
    const diff = Math.max(0, Math.round((today - target) / DAY));
    const date = shortDate(ts);
    if (diff === 0) return `Hoje — ${date}`;
    if (diff === 1) return `Ontem — ${date}`;
    if (diff >= 2 && diff <= 6) return `há ${diff} dias — ${date}`;
    if (diff >= 7 && diff <= 13) return `1 semana atrás — ${date}`;
    if (diff >= 14 && diff <= 20) return `2 semanas atrás — ${date}`;
    return fullDate(ts);
  }

  function decorateMessageDates(messages, selector) {
    if (!els.messages) return;
    for (const old of els.messages.querySelectorAll('.v219-date-divider')) old.remove();
    const rows = [...els.messages.querySelectorAll(selector)];
    let lastKey = '';
    let rowIndex = 0;
    for (const message of messages || []) {
      const row = rows[rowIndex++];
      if (!row) continue;
      const key = dateKey(message?.at);
      if (key === lastKey) continue;
      lastKey = key;
      const divider = document.createElement('div');
      divider.className = 'v219-date-divider';
      divider.dataset.dateKey = key;
      divider.innerHTML = `<span>${escapeHtml(relativeDateLabel(message?.at))}</span>`;
      row.before(divider);
    }
  }

  const renderMessagesBase = renderMessages;
  renderMessages = function renderMessagesV219(...args) {
    const result = renderMessagesBase(...args);
    const list = state.selectedChannel?.id ? (state.messagesByChannel.get(state.selectedChannel.id) || []) : [];
    decorateMessageDates(list, '.message:not(.dm-message)');
    return result;
  };

  const renderDmMessagesBase = renderDmMessages;
  renderDmMessages = function renderDmMessagesV219(...args) {
    const result = renderDmMessagesBase(...args);
    const list = state.activeDmUserId ? (state.dmMessages.get(state.activeDmUserId) || []) : [];
    decorateMessageDates(list, '.dm-message');
    return result;
  };

  function roleOf(user) {
    return user?.role || roleFor(user?.id) || 'member';
  }

  function makeMemberRow(user) {
    const role = roleOf(user);
    const row = document.createElement('div');
    row.className = 'v219-member-row' + (user.status === 'offline' ? ' offline' : '');
    row.dataset.role = role;
    const mark = document.createElement('span'); mark.className = 'v219-hierarchy-mark';
    const av = document.createElement('div'); av.className = 'avatar'; avatarStyle(av, user);
    const copy = document.createElement('div'); copy.className = 'v219-member-copy';
    const icon = ROLE_ICON[role] ? `<span aria-hidden="true">${ROLE_ICON[role]}</span>` : '';
    copy.innerHTML = `<div class="v219-member-name"><b class="role-color-${role}">${escapeHtml(user.name || 'Usuário')}</b>${icon}</div><div class="v219-member-meta"><span class="status-dot status-${escapeHtml(user.status || 'offline')}"></span><span>${STATUS_LABEL[user.status || 'offline'] || 'Offline'}</span><span class="v219-mini-role role-${role}">${ROLE_LABEL[role] || 'Membro'}</span></div>`;
    row.append(mark, av, copy);
    row.title = `${user.name || 'Usuário'} · ${ROLE_LABEL[role] || 'Membro'}`;
    row.addEventListener('click', () => openMemberProfile(user.id));
    return row;
  }

  renderMembers = function renderMembersV219() {
    if (!els.memberList) return;
    els.memberList.innerHTML = '';
    const all = [...state.members.values()];
    const online = all.filter(u => u.status !== 'offline');
    const offline = all.filter(u => u.status === 'offline');

    const groups = [];
    for (const role of ROLE_ORDER) {
      const members = online.filter(u => roleOf(u) === role).sort((a,b) => String(a.name).localeCompare(String(b.name), 'pt-BR'));
      if (members.length) groups.push({ label: ROLE_GROUP[role], role, members });
    }
    if (offline.length) groups.push({ label:'Offline', role:'offline', members:offline.sort((a,b) => String(a.name).localeCompare(String(b.name), 'pt-BR')) });

    for (const group of groups) {
      const wrap = document.createElement('section');
      wrap.className = 'v219-member-group';
      const head = document.createElement('div');
      head.className = 'v219-member-group-title';
      head.innerHTML = `<span>${escapeHtml(group.label)}</span><span>${group.members.length}</span>`;
      wrap.appendChild(head);
      for (const user of group.members) wrap.appendChild(makeMemberRow(user));
      els.memberList.appendChild(wrap);
    }
  };

  function permissionCards() {
    return `
      <div class="v219-permission-stack">
        <div class="v219-permission-card"><span class="v219-role-color owner"></span><div><b>Dono</b><small>Controle total do servidor e da hierarquia. É o único que pode promover ou rebaixar cargos.</small></div></div>
        <div class="v219-permission-card"><span class="v219-role-color admin"></span><div><b>Administrador</b><small>Gerencia servidor, convites e canais. Fica abaixo apenas do dono.</small></div></div>
        <div class="v219-permission-card"><span class="v219-role-color moderator"></span><div><b>Moderador</b><small>Organiza e modera canais, mantendo a operação do servidor.</small></div></div>
        <div class="v219-permission-card"><span class="v219-role-color member"></span><div><b>Membro</b><small>Usa texto, voz, chamadas e recursos normais do servidor.</small></div></div>
      </div>`;
  }

  openServerSettings = function openServerSettingsV219() {
    if (!state.selectedServer) return;
    const server = state.selectedServer;
    const meRole = currentRole();
    const members = [...state.members.values()].sort((a,b) => (ROLE_RANK[roleOf(b)] - ROLE_RANK[roleOf(a)]) || String(a.name).localeCompare(String(b.name), 'pt-BR'));
    const rows = members.map(user => {
      const role = roleOf(user);
      const editable = meRole === 'owner' && user.id !== server.ownerId;
      const control = editable
        ? `<select class="v219-role-select role-select" data-user="${escapeHtml(user.id)}"><option value="member" ${role==='member'?'selected':''}>Membro</option><option value="moderator" ${role==='moderator'?'selected':''}>Moderador</option><option value="admin" ${role==='admin'?'selected':''}>Administrador</option></select><button class="v219-remove-member remove-member" data-user="${escapeHtml(user.id)}">Remover</button>`
        : `<span class="v219-mini-role role-${role} v219-role-static">${ROLE_LABEL[role] || 'Membro'}</span><span></span>`;
      return `<div class="v219-role-row"><div class="avatar v219-role-avatar" data-user="${escapeHtml(user.id)}"></div><div class="v219-role-user"><b class="role-color-${role}">${escapeHtml(user.name || 'Usuário')}</b><small>${STATUS_LABEL[user.status || 'offline'] || 'Offline'} · ${ROLE_LABEL[role] || 'Membro'}</small></div>${control}</div>`;
    }).join('');

    openModal(`<div class="v219-role-settings"><div class="v219-role-hero"><h2>${escapeHtml(server.name)}</h2><p>Hierarquia do servidor · seu cargo: <b>${escapeHtml(ROLE_LABEL[meRole] || 'Membro')}</b></p></div>${can('admin') ? `<label>Nome do servidor</label><div style="display:flex;gap:8px"><input id="serverNameEdit" maxlength="40" value="${escapeHtml(server.name)}"><button id="saveServerName" style="width:auto;margin:0">Salvar</button></div>` : ''}${permissionCards()}<div><div class="channel-section-title"><span>Membros e cargos</span></div><div class="v219-role-table">${rows || '<p>Carregando membros…</p>'}</div></div></div>`);

    for (const av of document.querySelectorAll('.v219-role-avatar')) avatarStyle(av, state.members.get(av.dataset.user));
    $('saveServerName')?.addEventListener('click', () => { state.socket.emit('server:update', { serverId:server.id, name:$('serverNameEdit').value }); closeModal(); });
    for (const select of document.querySelectorAll('.v219-role-select')) select.addEventListener('change', () => {
      state.socket.emit('member:set-role', { serverId:server.id, userId:select.dataset.user, role:select.value });
      toast(`Cargo alterado para ${ROLE_LABEL[select.value] || select.value}.`);
    });
    for (const button of document.querySelectorAll('.v219-remove-member')) button.addEventListener('click', () => {
      const user = state.members.get(button.dataset.user);
      if (confirm(`Remover ${user?.name || 'membro'} do servidor?`)) {
        state.socket.emit('member:kick', { serverId:server.id, userId:button.dataset.user });
        closeModal();
      }
    });
  };

  renderMembers();
})();

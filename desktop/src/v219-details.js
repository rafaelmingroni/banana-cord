/* Banana Cord V2.0.19 — richer dates, role identity and cleaner hierarchy. */
(() => {
  if (window.__bananaV219Details) return;
  window.__bananaV219Details = true;

  const DAY = 86400000;
  const ROLE_ORDER = ['owner','admin','moderator','member'];
  const ROLE_ICON = { owner:'👑', admin:'◆', moderator:'●', member:'' };
  const ROLE_GROUP = { owner:'Dono', admin:'Administradores', moderator:'Moderadores', member:'Membros' };
  const DEFAULT_ROLE_COLORS = { owner:'#f2c94c', admin:'#c47cff', moderator:'#53b5df', member:'#d7dbe3' };
  const roleColorCache = new Map();
  let watchedRoleServerId = '';
  let stopRoleColorWatch = null;

  const firestore = (() => {
    try { return require('firebase/firestore'); } catch { return null; }
  })();

  function cleanHex(value, fallback) {
    const color = String(value || '').trim();
    return /^#[0-9a-fA-F]{6}$/.test(color) ? color.toLowerCase() : fallback;
  }

  function normalizeRoleColors(value = {}) {
    return Object.fromEntries(ROLE_ORDER.map(role => [role, cleanHex(value?.[role], DEFAULT_ROLE_COLORS[role])]));
  }

  function colorsForServer(serverId = state.selectedServer?.id) {
    if (!serverId) return { ...DEFAULT_ROLE_COLORS };
    return roleColorCache.get(serverId)
      || normalizeRoleColors(state.selectedServer?.id === serverId ? state.selectedServer?.roleColors : null);
  }

  function roleColor(role, serverId = state.selectedServer?.id) {
    return colorsForServer(serverId)[role] || DEFAULT_ROLE_COLORS.member;
  }

  function syncRoleCssVars(serverId = state.selectedServer?.id) {
    const colors = colorsForServer(serverId);
    const root = document.documentElement;
    for (const role of ROLE_ORDER) root.style.setProperty(`--banana-role-${role}`, colors[role]);
  }

  function ensureRoleColorWatch(serverId = state.selectedServer?.id) {
    if (!serverId || watchedRoleServerId === serverId) return;
    stopRoleColorWatch?.();
    stopRoleColorWatch = null;
    watchedRoleServerId = serverId;
    syncRoleCssVars(serverId);
    const db = window.BananaCloud?.db;
    if (!db || !firestore?.doc || !firestore?.onSnapshot) return;
    try {
      stopRoleColorWatch = firestore.onSnapshot(firestore.doc(db, 'servers', serverId), snap => {
        if (!snap.exists()) return;
        const colors = normalizeRoleColors(snap.data()?.roleColors || {});
        roleColorCache.set(serverId, colors);
        if (state.selectedServer?.id === serverId) state.selectedServer.roleColors = colors;
        syncRoleCssVars(serverId);
        applyMessageRoleColors();
        if (state.selectedServer?.id === serverId && state.viewMode !== 'dm') renderMembers();
      }, () => {});
    } catch {}
  }

  async function persistRoleColors(serverId, colors) {
    const db = window.BananaCloud?.db;
    if (!db || !firestore?.doc || !firestore?.updateDoc) throw new Error('Não foi possível salvar as cores agora.');
    const safe = normalizeRoleColors(colors);
    await firestore.updateDoc(firestore.doc(db, 'servers', serverId), {
      roleColors: safe,
      updatedAt: firestore.serverTimestamp()
    });
    roleColorCache.set(serverId, safe);
    if (state.selectedServer?.id === serverId) state.selectedServer.roleColors = safe;
    syncRoleCssVars(serverId);
    return safe;
  }

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

  function applyMessageRoleColors() {
    if (state.viewMode === 'dm' || !state.selectedChannel?.id || !els.messages) return;
    const list = state.messagesByChannel.get(state.selectedChannel.id) || [];
    const rows = [...els.messages.querySelectorAll('.message:not(.dm-message)')];
    rows.forEach((row, i) => {
      const message = list[i];
      const user = state.members.get(message?.authorId) || null;
      const role = user?.role || roleFor(message?.authorId) || 'member';
      const name = row.querySelector('.msg-head b');
      if (!name) return;
      const color = roleColor(role);
      name.style.color = color;
      name.dataset.role = role;
      name.title = ROLE_LABEL[role] || 'Membro';
    });
  }

  const renderMessagesBase = renderMessages;
  renderMessages = function renderMessagesV219(...args) {
    const result = renderMessagesBase(...args);
    ensureRoleColorWatch();
    const list = state.selectedChannel?.id ? (state.messagesByChannel.get(state.selectedChannel.id) || []) : [];
    decorateMessageDates(list, '.message:not(.dm-message)');
    applyMessageRoleColors();
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
    const color = roleColor(role);
    const row = document.createElement('div');
    row.className = 'v219-member-row' + (user.status === 'offline' ? ' offline' : '');
    row.dataset.role = role;
    const mark = document.createElement('span'); mark.className = 'v219-hierarchy-mark'; mark.style.background = color;
    const av = document.createElement('div'); av.className = 'avatar'; avatarStyle(av, user);
    const copy = document.createElement('div'); copy.className = 'v219-member-copy';
    const icon = ROLE_ICON[role] ? `<span aria-hidden="true">${ROLE_ICON[role]}</span>` : '';
    copy.innerHTML = `<div class="v219-member-name"><b style="color:${color}">${escapeHtml(user.name || 'Usuário')}</b>${icon}</div><div class="v219-member-meta"><span class="status-dot status-${escapeHtml(user.status || 'offline')}"></span><span>${STATUS_LABEL[user.status || 'offline'] || 'Offline'}</span><span class="v219-mini-role role-${role}" style="--role-color:${color}">${ROLE_LABEL[role] || 'Membro'}</span></div>`;
    row.append(mark, av, copy);
    row.title = `${user.name || 'Usuário'} · ${ROLE_LABEL[role] || 'Membro'}`;
    row.addEventListener('click', () => openMemberProfile(user.id));
    return row;
  }

  renderMembers = function renderMembersV219() {
    if (!els.memberList) return;
    ensureRoleColorWatch();
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

  function permissionCards(colors, editable) {
    return `<div class="v219-permission-stack">${ROLE_ORDER.map(role => {
      const descriptions = {
        owner:'Controle total do servidor e da hierarquia.',
        admin:'Gerencia servidor, convites, canais e aparência dos cargos.',
        moderator:'Organiza e modera canais, mantendo a operação do servidor.',
        member:'Usa texto, voz, chamadas e recursos normais do servidor.'
      };
      return `<div class="v219-permission-card" data-role-card="${role}"><span class="v219-role-color" style="background:${colors[role]}"></span><div><div class="v219-role-card-title"><b>${ROLE_LABEL[role]}</b>${editable ? `<label class="v219-color-control" title="Cor de ${ROLE_LABEL[role]}"><input type="color" class="v219-role-color-input" data-role="${role}" value="${colors[role]}"><span>${colors[role].toUpperCase()}</span></label>` : `<span class="v219-color-preview" style="background:${colors[role]}"></span>`}</div><small>${descriptions[role]}</small></div></div>`;
    }).join('')}</div>`;
  }

  openServerSettings = function openServerSettingsV219() {
    if (!state.selectedServer) return;
    ensureRoleColorWatch();
    const server = state.selectedServer;
    const meRole = currentRole();
    const canStyleRoles = can('admin');
    const colors = colorsForServer(server.id);
    const members = [...state.members.values()].sort((a,b) => (ROLE_RANK[roleOf(b)] - ROLE_RANK[roleOf(a)]) || String(a.name).localeCompare(String(b.name), 'pt-BR'));
    const rows = members.map(user => {
      const role = roleOf(user);
      const color = colors[role];
      const editable = meRole === 'owner' && user.id !== server.ownerId;
      const control = editable
        ? `<select class="v219-role-select role-select" data-user="${escapeHtml(user.id)}"><option value="member" ${role==='member'?'selected':''}>Membro</option><option value="moderator" ${role==='moderator'?'selected':''}>Moderador</option><option value="admin" ${role==='admin'?'selected':''}>Administrador</option></select><button class="v219-remove-member remove-member" data-user="${escapeHtml(user.id)}">Remover</button>`
        : `<span class="v219-mini-role role-${role} v219-role-static" style="--role-color:${color}">${ROLE_LABEL[role] || 'Membro'}</span><span></span>`;
      return `<div class="v219-role-row"><div class="avatar v219-role-avatar" data-user="${escapeHtml(user.id)}"></div><div class="v219-role-user"><b style="color:${color}">${escapeHtml(user.name || 'Usuário')}</b><small>${STATUS_LABEL[user.status || 'offline'] || 'Offline'} · ${ROLE_LABEL[role] || 'Membro'}</small></div>${control}</div>`;
    }).join('');

    openModal(`<div class="v219-role-settings"><div class="v219-role-hero"><h2>${escapeHtml(server.name)}</h2><p>Hierarquia do servidor · seu cargo: <b style="color:${colors[meRole] || colors.member}">${escapeHtml(ROLE_LABEL[meRole] || 'Membro')}</b></p></div>${can('admin') ? `<label>Nome do servidor</label><div style="display:flex;gap:8px"><input id="serverNameEdit" maxlength="40" value="${escapeHtml(server.name)}"><button id="saveServerName" style="width:auto;margin:0">Salvar</button></div>` : ''}<div><div class="channel-section-title"><span>Aparência dos cargos</span></div><p class="v219-settings-help">As cores aparecem no chat, na lista de membros e nos perfis. ${canStyleRoles ? 'Escolha uma cor e ela será aplicada para todo o servidor.' : 'Somente a administração pode alterar.'}</p>${permissionCards(colors, canStyleRoles)}</div><div><div class="channel-section-title"><span>Membros e cargos</span></div><div class="v219-role-table">${rows || '<p>Carregando membros…</p>'}</div></div></div>`);

    for (const av of document.querySelectorAll('.v219-role-avatar')) avatarStyle(av, state.members.get(av.dataset.user));
    $('saveServerName')?.addEventListener('click', () => { state.socket.emit('server:update', { serverId:server.id, name:$('serverNameEdit').value }); closeModal(); });
    for (const input of document.querySelectorAll('.v219-role-color-input')) {
      input.addEventListener('input', () => {
        const next = { ...colorsForServer(server.id), [input.dataset.role]:cleanHex(input.value, DEFAULT_ROLE_COLORS[input.dataset.role]) };
        roleColorCache.set(server.id, next);
        syncRoleCssVars(server.id);
        input.nextElementSibling.textContent = next[input.dataset.role].toUpperCase();
        const card = input.closest('[data-role-card]');
        if (card) card.querySelector('.v219-role-color').style.background = next[input.dataset.role];
        renderMembers(); applyMessageRoleColors();
      });
      input.addEventListener('change', async () => {
        input.disabled = true;
        try {
          await persistRoleColors(server.id, { ...colorsForServer(server.id), [input.dataset.role]:input.value });
          toast(`Cor de ${ROLE_LABEL[input.dataset.role]} atualizada.`);
        } catch (error) { toast(error?.message || 'Não consegui salvar a cor.', 4200); }
        finally { input.disabled = false; }
      });
    }
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

  const settingsButton = els.serverSettingsBtn;
  if (settingsButton) settingsButton.addEventListener('click', event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    openServerSettings();
  }, true);

  function formatMemberSince(value) {
    const ms = typeof value?.toMillis === 'function' ? value.toMillis() : Number(value || 0);
    if (!ms) return 'Data de entrada indisponível';
    return `Membro desde ${new Date(ms).toLocaleDateString('pt-BR', { day:'2-digit', month:'long', year:'numeric' })}`;
  }

  openMemberProfile = function openMemberProfileV219(userId) {
    const user = state.members.get(userId);
    if (!user) return;
    ensureRoleColorWatch();
    const role = roleOf(user);
    const color = roleColor(role);
    const canDm = userId !== state.user?.id;
    const custom = String(user.customStatus || '').trim();
    const offlineSeen = user.status === 'offline' && user.lastSeen
      ? `Visto por último ${new Date(Number(user.lastSeen)).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}`
      : (STATUS_LABEL[user.status || 'offline'] || 'Offline');

    openModal(`<div class="v219-profile-card" style="--profile-role-color:${color}"><div class="v219-profile-banner"></div><div class="v219-profile-main"><div id="v219ProfileAvatar" class="avatar v219-profile-avatar"></div><div class="v219-profile-heading"><h2 style="color:${color}">${escapeHtml(user.name)}</h2><div class="v219-profile-status"><span class="status-dot status-${escapeHtml(user.status || 'offline')}"></span>${escapeHtml(offlineSeen)}</div></div><div class="v219-profile-role" style="color:${color};border-color:${color}55;background:${color}16">${ROLE_ICON[role] || '•'} ${escapeHtml(ROLE_LABEL[role] || 'Membro')}</div>${custom ? `<div class="v219-profile-about"><small>SOBRE</small><p>${escapeHtml(custom)}</p></div>` : ''}<div class="v219-profile-info"><div><small>CARGO NO SERVIDOR</small><b style="color:${color}">${escapeHtml(ROLE_LABEL[role] || 'Membro')}</b></div><div><small>NO SERVIDOR</small><b id="v219MemberSince">Carregando…</b></div></div>${canDm ? '<button id="dmFromProfile" class="v219-profile-dm action">💬 Enviar mensagem</button>' : '<div class="v219-profile-self">Este é o seu perfil neste servidor.</div>'}</div></div>`);
    avatarStyle($('v219ProfileAvatar'), user);
    $('dmFromProfile')?.addEventListener('click', () => { closeModal(); startDm(userId, user); });

    const db = window.BananaCloud?.db;
    const serverId = state.selectedServer?.id;
    if (db && serverId && firestore?.getDoc && firestore?.doc) {
      firestore.getDoc(firestore.doc(db, 'servers', serverId, 'members', userId)).then(snap => {
        const target = $('v219MemberSince');
        if (target) target.textContent = formatMemberSince(snap.exists() ? snap.data()?.joinedAt : null);
      }).catch(() => { const target = $('v219MemberSince'); if (target) target.textContent = 'Data indisponível'; });
    } else {
      const target = $('v219MemberSince'); if (target) target.textContent = 'Data indisponível';
    }
  };

  renderMembers();
})();

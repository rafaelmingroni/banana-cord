/* Banana Cord v2 Cloud home: server list + persistent text chat, no local host required. */
(() => {
  const home = document.createElement('div');
  home.id = 'cloudHome';
  home.className = 'cloud-home hidden';
  home.innerHTML = `
    <aside class="cloud-home-servers">
      <button class="cloud-home-logo" title="Banana Cord"><img src="../assets/banana-cord.png" alt=""></button>
      <div id="cloudServerList" class="cloud-server-list"></div>
      <button id="cloudCreateServer" class="cloud-server-add" title="Criar servidor">+</button>
    </aside>
    <aside class="cloud-home-sidebar">
      <div class="cloud-home-title"><b id="cloudCurrentServer">Banana Cord</b><small>Cloud Preview</small></div>
      <div class="cloud-channel-heading">CANAIS DE TEXTO</div>
      <button id="cloudGeneralChannel" class="cloud-channel active"># geral</button>
      <div class="cloud-home-user"><div class="cloud-user-avatar" id="cloudUserAvatar">?</div><div><b id="cloudUserName">Usuário</b><small id="cloudUserEmail"></small></div><button id="cloudLogout" title="Sair">↪</button></div>
    </aside>
    <main class="cloud-main">
      <header><b id="cloudChannelTitle"># geral</b><span>Mensagens sincronizadas pelo Banana Cloud</span><i class="cloud-online-pill">● online</i></header>
      <section id="cloudWelcome" class="cloud-welcome"><img src="../assets/banana-cord.png" alt=""><h2>Banana Cloud</h2><p>Crie um servidor. Ele continuará existindo mesmo quando seu PC estiver desligado.</p></section>
      <section id="cloudChat" class="cloud-chat hidden"><div id="cloudMessages" class="cloud-messages"></div><form id="cloudComposer" class="cloud-composer"><input id="cloudMessageInput" maxlength="4000" autocomplete="off" placeholder="Mensagem em #geral"><button>Enviar</button></form></section>
    </main>`;
  document.body.appendChild(home);

  let unsubscribeServers = null;
  let unsubscribeMessages = null;
  let currentServer = null;

  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  const initials = value => String(value || '?').trim().split(/\s+/).slice(0,2).map(s => s[0] || '').join('').toUpperCase() || '?';
  const when = value => {
    try {
      const d = value?.toDate ? value.toDate() : null;
      return d ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
    } catch { return ''; }
  };

  function setLegacyVisible(visible) {
    document.getElementById('setup')?.classList.toggle('hidden', !visible);
    document.getElementById('app')?.classList.toggle('hidden', !visible);
  }

  function renderMessages(messages) {
    const box = document.getElementById('cloudMessages');
    if (!box) return;
    box.innerHTML = messages.map(m => `
      <article class="cloud-message" data-id="${escapeHtml(m.id)}">
        <div class="cloud-msg-avatar">${escapeHtml(initials(m.authorName || '?'))}</div>
        <div><div class="cloud-msg-meta"><b>${escapeHtml(m.authorName || 'Usuário')}</b><span>${escapeHtml(when(m.createdAt))}${m.editedAt ? ' · editado' : ''}</span></div><p>${escapeHtml(m.body)}</p></div>
      </article>`).join('');
    box.scrollTop = box.scrollHeight;
  }

  function selectServer(server) {
    currentServer = server;
    document.getElementById('cloudCurrentServer').textContent = server.name || 'Servidor';
    document.getElementById('cloudWelcome')?.classList.add('hidden');
    document.getElementById('cloudChat')?.classList.remove('hidden');
    document.querySelectorAll('.cloud-server-item').forEach(el => el.classList.toggle('active', el.dataset.id === server.id));
    unsubscribeMessages?.();
    unsubscribeMessages = window.BananaCloud.listenChannelMessages(server.id, 'general', renderMessages, 100);
  }

  function renderServers(servers) {
    const list = document.getElementById('cloudServerList');
    if (!list) return;
    list.innerHTML = '';
    for (const server of servers) {
      const button = document.createElement('button');
      button.className = 'cloud-server-item';
      button.dataset.id = server.id;
      button.title = server.name || 'Servidor';
      button.textContent = initials(server.name);
      button.addEventListener('click', () => selectServer(server));
      list.appendChild(button);
    }
    if (currentServer) {
      const updated = servers.find(s => s.id === currentServer.id);
      if (updated) selectServer(updated);
    } else if (servers[0]) selectServer(servers[0]);
  }

  async function createServer() {
    const name = window.prompt('Nome do novo servidor Banana Cord:');
    if (!name?.trim()) return;
    try {
      await window.BananaCloud.createServer(name.trim());
    } catch (err) {
      window.alert(err?.message || 'Não foi possível criar o servidor.');
    }
  }

  document.getElementById('cloudCreateServer')?.addEventListener('click', createServer);
  document.getElementById('cloudLogout')?.addEventListener('click', () => window.BananaCloud?.signOut?.());
  document.getElementById('cloudComposer')?.addEventListener('submit', async e => {
    e.preventDefault();
    const input = document.getElementById('cloudMessageInput');
    const text = input?.value.trim();
    if (!text || !currentServer) return;
    input.value = '';
    try { await window.BananaCloud.sendChannelMessage(currentServer.id, 'general', text); }
    catch (err) { input.value = text; window.alert(err?.message || 'Não foi possível enviar a mensagem.'); }
  });

  window.addEventListener('banana:cloud-ready', event => {
    const user = event.detail?.user || window.BananaCloud?.user;
    if (!user) return;
    setLegacyVisible(false);
    home.classList.remove('hidden');
    document.getElementById('cloudUserName').textContent = user.displayName || user.email?.split('@')[0] || 'Usuário';
    document.getElementById('cloudUserEmail').textContent = user.email || '';
    document.getElementById('cloudUserAvatar').textContent = initials(user.displayName || user.email);
    unsubscribeServers?.();
    unsubscribeServers = window.BananaCloud.listenMyServers(renderServers);
  });

  window.addEventListener('beforeunload', () => {
    unsubscribeServers?.(); unsubscribeMessages?.();
  });
})();

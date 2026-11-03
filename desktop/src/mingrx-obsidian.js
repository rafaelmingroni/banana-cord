/* Mingrx Obsidian — Phase 1 private UI enhancement.
 * Progressive decoration over the existing social engine.
 * Observers are intentionally scoped to the surfaces that actually re-render.
 */
(() => {
  if (window.__mingrxObsidianLoaded) return;
  window.__mingrxObsidianLoaded = true;

  const ICONS = {
    users:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    message:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg>',
    userPlus:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 19a6 6 0 0 0-12 0"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/></svg>',
    arrow:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>'
  };

  const icon = name => `<span class="mx-button-icon">${ICONS[name] || ''}</span>`;

  function socialState() {
    try { return state?.v1?.social || { friends:[], incoming:[], outgoing:[], blocked:[] }; }
    catch { return { friends:[], incoming:[], outgoing:[], blocked:[] }; }
  }

  function statusClass(user) {
    const value = String(user?.status || '').toLowerCase();
    if (['online','available'].includes(value)) return 'online';
    if (['away','idle'].includes(value)) return 'away';
    if (['busy','dnd'].includes(value)) return 'busy';
    return 'offline';
  }

  function counts() {
    const social = socialState();
    return {
      friends:social.friends.length,
      incoming:social.incoming.length,
      online:social.friends.filter(user => statusClass(user) === 'online').length
    };
  }

  function replaceButton(button, iconName, label, badge = 0) {
    if (!button) return;
    const signature = `${iconName}:${label}:${badge}`;
    if (button.dataset.mxObsidianSignature === signature) return;
    button.dataset.mxObsidianSignature = signature;
    button.innerHTML = `${icon(iconName)}<span>${label}</span>${badge ? `<span class="v1-small-badge">${badge}</span>` : ''}`;
  }

  function decoratePrivateSidebar() {
    const sidebar = document.querySelector('.v214-private-sidebar');
    if (!sidebar) return;
    sidebar.dataset.mxObsidian = 'true';

    const current = counts();
    const intro = sidebar.querySelector('.v214-private-intro');
    if (intro) {
      const signature = `${current.friends}:${current.online}`;
      if (intro.dataset.mxObsidianSignature !== signature) {
        intro.dataset.mxObsidianSignature = signature;
        intro.innerHTML = `<b>Amigos e mensagens</b><span>Conversas diretas, chamadas e contatos em um só lugar.</span><span class="mx-private-presence"><i class="mx-presence-dot"></i>${current.online} online · ${current.friends} amigo${current.friends === 1 ? '' : 's'}</span>`;
      }
    }

    replaceButton(document.getElementById('v1FriendsBtn'), 'users', 'Amigos', current.incoming);
    replaceButton(document.getElementById('newDmBtn'), 'message', 'Mensagem');
    replaceButton(document.getElementById('v207AddFriendBtn'), 'userPlus', 'Adicionar amigo');

    const request = sidebar.querySelector('.v214-private-request');
    if (request && current.incoming) {
      request.innerHTML = `<span>${current.incoming} pedido${current.incoming === 1 ? '' : 's'} de amizade</span>${icon('arrow')}`;
      request.setAttribute('aria-label', `${current.incoming} pedido${current.incoming === 1 ? '' : 's'} de amizade pendente${current.incoming === 1 ? '' : 's'}`);
    }

    const friendHeading = document.getElementById('v1FriendQuick')?.previousElementSibling;
    if (friendHeading?.classList?.contains('v214-private-section-title')) {
      friendHeading.innerHTML = `<span>Amigos</span><small>${current.friends}</small>`;
    }
  }

  function decoratePrivateHome() {
    const home = document.querySelector('.v214-private-home');
    if (!home) return;
    const heading = home.querySelector('h2');
    const copy = home.querySelector('p');
    if (heading) heading.textContent = 'Privado';
    if (copy) copy.textContent = 'Encontre seus amigos, continue conversas recentes ou comece uma nova mensagem.';
    replaceButton(document.getElementById('v214HomeFriend'), 'userPlus', 'Adicionar amigo');
    replaceButton(document.getElementById('v214HomeMessage'), 'message', 'Nova mensagem');
    replaceButton(document.getElementById('v214HomeFriends'), 'users', 'Ver amigos');
  }

  let queued = false;
  function refresh() {
    queued = false;
    decoratePrivateSidebar();
    decoratePrivateHome();
  }
  function queueRefresh() {
    if (queued) return;
    queued = true;
    queueMicrotask(refresh);
  }

  const targets = [document.getElementById('channels'), document.getElementById('emptyView')].filter(Boolean);
  for (const target of targets) new MutationObserver(queueRefresh).observe(target, { childList:true, subtree:true });

  window.addEventListener('banana:i18n-changed', queueRefresh);
  window.addEventListener('mingrx:theme-change', queueRefresh);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) queueRefresh(); });

  queueRefresh();
})();

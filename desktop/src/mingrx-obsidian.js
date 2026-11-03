/* Mingrx Obsidian — Phase 1 social UI enhancement.
 * Progressive decoration over the existing social engine.
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

  function allSocialUsers() {
    const social = socialState();
    return [...social.friends, ...social.incoming, ...social.outgoing, ...social.blocked];
  }

  function userById(id) {
    if (!id) return null;
    try {
      return state?.members?.get?.(id) || allSocialUsers().find(user => user?.id === id) || state?.dmConversations?.find?.(row => row?.user?.id === id)?.user || null;
    } catch { return allSocialUsers().find(user => user?.id === id) || null; }
  }

  function statusClass(user) {
    const value = String(user?.status || '').toLowerCase();
    if (['online','available'].includes(value)) return 'online';
    if (['away','idle'].includes(value)) return 'away';
    if (['busy','dnd'].includes(value)) return 'busy';
    return 'offline';
  }

  function friendCounts() {
    const social = socialState();
    return {
      friends:social.friends.length,
      incoming:social.incoming.length,
      outgoing:social.outgoing.length,
      blocked:social.blocked.length,
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

  function decoratePrivateSidebar(root = document) {
    const sidebar = root?.matches?.('.v214-private-sidebar') ? root : root?.querySelector?.('.v214-private-sidebar');
    if (!sidebar) return;
    sidebar.dataset.mxObsidian = 'true';

    const counts = friendCounts();
    const intro = sidebar.querySelector('.v214-private-intro');
    if (intro) {
      const signature = `${counts.friends}:${counts.online}`;
      if (intro.dataset.mxObsidianSignature !== signature) {
        intro.dataset.mxObsidianSignature = signature;
        intro.innerHTML = `<b>Amigos e mensagens</b><span>Conversas diretas, chamadas e contatos em um só lugar.</span><span class="mx-private-presence"><i class="mx-presence-dot"></i>${counts.online} online · ${counts.friends} amigo${counts.friends === 1 ? '' : 's'}</span>`;
      }
    }

    replaceButton(document.getElementById('v1FriendsBtn'), 'users', 'Amigos', counts.incoming);
    replaceButton(document.getElementById('newDmBtn'), 'message', 'Mensagem');
    replaceButton(document.getElementById('v207AddFriendBtn'), 'userPlus', 'Adicionar amigo');

    const request = sidebar.querySelector('.v214-private-request');
    if (request && counts.incoming) {
      request.innerHTML = `<span>${counts.incoming} pedido${counts.incoming === 1 ? '' : 's'} de amizade</span>${icon('arrow')}`;
      request.setAttribute('aria-label', `${counts.incoming} pedido${counts.incoming === 1 ? '' : 's'} de amizade pendente${counts.incoming === 1 ? '' : 's'}`);
    }

    const friendHeading = document.getElementById('v1FriendQuick')?.previousElementSibling;
    if (friendHeading?.classList?.contains('v214-private-section-title')) {
      friendHeading.innerHTML = `<span>Amigos</span><small>${counts.friends}</small>`;
    }

    decoratePrivateHome();
  }

  function decoratePrivateHome() {
    const home = document.querySelector('.v214-private-home');
    if (!home || home.dataset.mxObsidian === 'true') return;
    home.dataset.mxObsidian = 'true';
    const heading = home.querySelector('h2');
    const copy = home.querySelector('p');
    if (heading) heading.textContent = 'Privado';
    if (copy) copy.textContent = 'Encontre seus amigos, continue conversas recentes ou comece uma nova mensagem.';
    replaceButton(document.getElementById('v214HomeFriend'), 'userPlus', 'Adicionar amigo');
    replaceButton(document.getElementById('v214HomeMessage'), 'message', 'Nova mensagem');
    replaceButton(document.getElementById('v214HomeFriends'), 'users', 'Ver amigos');
  }

  function wrapAvatar(avatar) {
    if (!avatar || avatar.parentElement?.classList?.contains('mx-social-avatar-wrap')) return;
    const userId = avatar.dataset.user || avatar.dataset.avatar || '';
    if (!userId) return;
    const wrap = document.createElement('span');
    wrap.className = 'mx-social-avatar-wrap';
    avatar.before(wrap);
    wrap.appendChild(avatar);
    const dot = document.createElement('i');
    dot.className = `mx-social-status ${statusClass(userById(userId))}`;
    dot.setAttribute('aria-hidden', 'true');
    wrap.appendChild(dot);
  }

  function decorateSocialRows(root) {
    for (const avatar of root.querySelectorAll('.v1-social-avatar,.v207-friend-row .avatar')) wrapAvatar(avatar);

    for (const button of root.querySelectorAll('.v1-social-row button[data-dm]')) {
      if (button.dataset.mxObsidian === 'true') continue;
      button.dataset.mxObsidian = 'true';
      button.innerHTML = icon('message');
      button.title = 'Mensagem';
      button.setAttribute('aria-label', 'Abrir mensagem');
    }
  }

  function sectionCount(section, fallback) {
    const match = section?.querySelector?.('h3')?.textContent?.match(/\((\d+)\)/);
    return Number(match?.[1] ?? fallback ?? 0);
  }

  function decorateFriendsModal() {
    const body = document.getElementById('modalBody');
    if (!body) return;
    const sections = [...body.querySelectorAll(':scope > .v1-social-section')];
    if (sections.length !== 4) return;

    body.classList.add('mx-social-modal');
    decorateSocialRows(body);

    const social = socialState();
    const meta = [
      { label:'Amigos', count:sectionCount(sections[0], social.friends.length) },
      { label:'Pedidos', count:sectionCount(sections[1], social.incoming.length) },
      { label:'Enviadas', count:sectionCount(sections[2], social.outgoing.length) },
      { label:'Bloqueados', count:sectionCount(sections[3], social.blocked.length) }
    ];

    let tabs = body.querySelector('.mx-social-tabs');
    if (!tabs) {
      tabs = document.createElement('div');
      tabs.className = 'mx-social-tabs';
      tabs.setAttribute('role', 'tablist');
      body.querySelector('.simple-modal-head')?.insertAdjacentElement('afterend', tabs);
    }

    const previous = Number(tabs.dataset.active || 0);
    tabs.innerHTML = '';
    meta.forEach((item, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `mx-social-tab${index === previous ? ' active' : ''}`;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-selected', String(index === previous));
      button.innerHTML = `<span>${item.label}</span><span class="count">${item.count}</span>`;
      button.onclick = () => {
        tabs.dataset.active = String(index);
        for (const [tabIndex, tab] of [...tabs.children].entries()) {
          tab.classList.toggle('active', tabIndex === index);
          tab.setAttribute('aria-selected', String(tabIndex === index));
        }
        sections.forEach((section, sectionIndex) => section.classList.toggle('mx-hidden', sectionIndex !== index));
      };
      tabs.appendChild(button);
    });
    sections.forEach((section, index) => section.classList.toggle('mx-hidden', index !== previous));
  }

  function decorateFriendSearch() {
    const body = document.getElementById('modalBody');
    const search = body?.querySelector?.('.v207-friend-search');
    if (!search) return;
    body.classList.add('mx-friend-search-modal');
    const input = search.querySelector('input');
    if (input) {
      input.placeholder = 'Busque pelo nome de usuário';
      input.setAttribute('aria-label', 'Nome do usuário');
    }
    const button = search.querySelector('button');
    if (button) button.textContent = 'Buscar';
    decorateSocialRows(body);
  }

  function clearModalModes() {
    const body = document.getElementById('modalBody');
    if (!body) return;
    if (!body.querySelector('.v1-social-section')) body.classList.remove('mx-social-modal');
    if (!body.querySelector('.v207-friend-search')) body.classList.remove('mx-friend-search-modal');
  }

  function refresh(root = document) {
    decoratePrivateSidebar(root);
    decoratePrivateHome();
    decorateFriendsModal();
    decorateFriendSearch();
    clearModalModes();
  }

  let queued = false;
  function queueRefresh() {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      refresh(document);
    });
  }

  const observer = new MutationObserver(queueRefresh);
  observer.observe(document.body, { childList:true, subtree:true });

  window.addEventListener('banana:i18n-changed', queueRefresh);
  window.addEventListener('mingrx:theme-change', queueRefresh);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) queueRefresh(); });

  queueRefresh();
})();

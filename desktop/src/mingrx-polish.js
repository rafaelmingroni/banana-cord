/* Mingrx final polish — brand/runtime cleanup without touching the communication engine. */
(() => {
  if (window.__mingrxPolishLoaded) return;
  window.__mingrxPolishLoaded = true;

  const BRAND = 'Mingrx';
  let DISPLAY_VERSION = 'v3.0.0';
  try { DISPLAY_VERSION = `v${require('../package.json').version}`; } catch {}

  function markSvg(className = 'mingrx-inline-mark') {
    return `<span class="${className}" aria-hidden="true"><svg viewBox="0 0 1024 1024" role="presentation"><rect x="72" y="72" width="880" height="880" rx="220" fill="var(--mx-panel-3)"/><path d="M252 716V360c0-72 84-106 132-52L512 452l128-144c48-54 132-20 132 52v356" fill="none" stroke="var(--mx-accent)" stroke-width="124" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`;
  }

  function wordmark() {
    return `<span class="mingrx-brand-word"><span>Mingr</span><span class="mingrx-x">x</span></span>`;
  }

  const TEXT_MAP = new Map([
    ['Configurações do servidor', 'Configurações da comunidade'],
    ['Nome do servidor', 'Nome da comunidade'],
    ['Hierarquia do servidor', 'Hierarquia da comunidade'],
    ['Novo servidor', 'Nova comunidade'],
    ['Servidores', 'Comunidades'],
    ['Servidor', 'Comunidade'],
    ['Banana Cord', BRAND],
    ['BANANA CORD', 'MINGRX'],
    ['Banana Cloud', 'Mingrx Cloud'],
    ['Conta Banana', 'Conta Mingrx'],
    ['Entrando no Banana Cord…', 'Entrando no Mingrx…'],
    ['Entrando no Banana Cord...', 'Entrando no Mingrx...'],
    ['banana-cloud://firebase', 'Mingrx Cloud'],
    ['Your profile', 'Seu perfil'],
    ['Save profile', 'Salvar perfil'],
    ['Profile', 'Perfil'],
    ['Server', 'Comunidade']
  ]);

  function cleanText(value) {
    let text = String(value ?? '');
    for (const [from, to] of TEXT_MAP) text = text.split(from).join(to);
    return text;
  }

  function installNotificationBrandGuard() {
    const NativeNotification = window.Notification;
    if (typeof NativeNotification !== 'function' || NativeNotification.__mingrxWrapped) return;
    function MingrxNotification(title, options) {
      const nextOptions = options ? { ...options } : options;
      if (nextOptions?.body) nextOptions.body = cleanText(nextOptions.body);
      return new NativeNotification(cleanText(title), nextOptions);
    }
    MingrxNotification.prototype = NativeNotification.prototype;
    MingrxNotification.__mingrxWrapped = true;
    try { Object.defineProperty(MingrxNotification, 'permission', { configurable:true, get:() => NativeNotification.permission }); } catch {}
    if (typeof NativeNotification.requestPermission === 'function') MingrxNotification.requestPermission = (...args) => NativeNotification.requestPermission(...args);
    window.Notification = MingrxNotification;
  }

  function normalizeText(root = document.body) {
    if (!root) return;
    if (root.nodeType === Node.TEXT_NODE) {
      const next = cleanText(root.nodeValue);
      if (next !== root.nodeValue) root.nodeValue = next;
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE && root !== document.body) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      const next = cleanText(node.nodeValue);
      if (next !== node.nodeValue) node.nodeValue = next;
    }
    if (root.nodeType === Node.ELEMENT_NODE) {
      const attrs = [];
      if (root.matches?.('[title],[placeholder],[aria-label]')) attrs.push(root);
      for (const el of root.querySelectorAll?.('[title],[placeholder],[aria-label]') || []) attrs.push(el);
      for (const el of attrs) {
        for (const attr of ['title','placeholder','aria-label']) {
          if (!el.hasAttribute(attr)) continue;
          const before = el.getAttribute(attr);
          const after = cleanText(before);
          if (after !== before) el.setAttribute(attr, after);
        }
      }
    }
  }

  function installBrandHome() {
    const bar = document.querySelector('.servers');
    if (!bar) return;
    let brand = bar.querySelector('.mingrx-brand');
    if (!brand) {
      brand = document.createElement('button');
      brand.type = 'button';
      brand.className = 'mingrx-brand';
      bar.prepend(brand);
    } else if (brand.tagName !== 'BUTTON') {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = brand.className;
      brand.replaceWith(button);
      brand = button;
    }
    if (brand.dataset.mingrxHome !== 'true') {
      brand.dataset.mingrxHome = 'true';
      brand.innerHTML = `${markSvg()}${wordmark()}<span class="mingrx-brand-badge hidden">0</span>`;
      brand.title = 'Início e mensagens';
      brand.setAttribute('aria-label', 'Início e mensagens');
      brand.onclick = () => document.getElementById('homeServer')?.click();
    }
    syncUnreadBadge();
  }

  function syncUnreadBadge() {
    const source = document.getElementById('dmUnreadBadge');
    const target = document.querySelector('.mingrx-brand-badge');
    if (!source || !target) return;
    const count = String(source.textContent || '').trim();
    const hidden = source.classList.contains('hidden') || !count || count === '0';
    if (target.textContent !== (count || '0')) target.textContent = count || '0';
    if (target.classList.contains('hidden') !== hidden) target.classList.toggle('hidden', hidden);
  }

  function removeBlankTopItems() {
    for (const button of document.querySelectorAll('.servers .server-icon')) {
      if (button.id === 'homeServer' || button.id === 'addServerBtn') continue;
      const hasImage = !!button.querySelector('img');
      const text = String(button.textContent || '').trim();
      const labelled = String(button.getAttribute('title') || button.getAttribute('aria-label') || '').trim();
      if (!hasImage && !text && !labelled) button.remove();
    }
  }

  function upgradeAuth() {
    const brand = document.querySelector('.cloud-brand');
    if (!brand || brand.dataset.mingrxPolished === 'true') return;
    brand.dataset.mingrxPolished = 'true';
    brand.innerHTML = `<div class="mingrx-auth-brand">${markSvg()}<div><h1>${wordmark()}</h1><p>Entre para conversar, jogar e compartilhar.</p></div></div>`;
    const missing = document.getElementById('cloudConfigMissing');
    const h2 = missing?.querySelector('h2');
    if (h2) h2.textContent = 'Mingrx Cloud ainda não configurado';
  }

  function htmlNode(html) {
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    return template.content.firstElementChild;
  }

  function upgradePrivateHome(root = document) {
    const homes = [];
    if (root?.matches?.('.v214-private-home')) homes.push(root);
    for (const home of root?.querySelectorAll?.('.v214-private-home') || []) homes.push(home);
    for (const home of homes) {
      const img = home.querySelector('img');
      if (img) img.replaceWith(htmlNode(markSvg('mingrx-inline-mark mingrx-private-mark')));
      const heading = home.querySelector('h2');
      if (heading && heading.textContent.trim() === 'Privado') heading.textContent = 'Mensagens privadas';
    }
  }

  function upgradeSettings() {
    const shell = document.querySelector('.settings-shell');
    if (!shell) return;
    const nav = shell.querySelector('.settings-nav');
    if (nav) {
      for (const legacy of nav.querySelectorAll(':scope > .settings-brand,:scope > .settings-nav-foot')) legacy.remove();
      if (!nav.querySelector('.mingrx-settings-brand')) {
        const brand = document.createElement('div');
        brand.className = 'mingrx-settings-brand';
        brand.innerHTML = `${markSvg()}<div><b>${wordmark()}</b><small>Configurações</small></div>`;
        nav.prepend(brand);
      }
      if (!nav.querySelector('.mingrx-settings-version')) {
        const version = document.createElement('div');
        version.className = 'mingrx-settings-version';
        version.textContent = `${BRAND} · ${DISPLAY_VERSION}`;
        nav.appendChild(version);
      }
    }
    const content = shell.querySelector('.settings-content');
    if (content) content.classList.add('settings-main');
    normalizeText(shell);
  }

  function normalizeConnection() {
    const badge = document.getElementById('connectionBadge');
    if (badge && /banana|firebase/i.test(badge.textContent || '')) badge.textContent = 'Mingrx Cloud';
    const setupUrl = document.getElementById('setupUrl');
    if (setupUrl && /banana-cloud/i.test(setupUrl.value || '')) setupUrl.value = 'Mingrx Cloud';
  }

  function polishInitial() {
    installNotificationBrandGuard();
    normalizeText(document.body);
    installBrandHome();
    removeBlankTopItems();
    upgradeAuth();
    upgradePrivateHome(document);
    upgradeSettings();
    normalizeConnection();
  }

  polishInitial();

  const pendingRoots = new Set();
  let timer = null;
  function schedule(root) {
    if (root) pendingRoots.add(root);
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      const roots = [...pendingRoots];
      pendingRoots.clear();
      for (const root of roots) {
        if (root?.nodeType === Node.TEXT_NODE) normalizeText(root);
        else if (root?.nodeType === Node.ELEMENT_NODE && root.isConnected) {
          normalizeText(root);
          upgradePrivateHome(root);
        }
      }
      installBrandHome();
      removeBlankTopItems();
      upgradeAuth();
      upgradeSettings();
      normalizeConnection();
    }, 0);
  }

  const observer = new MutationObserver(records => {
    for (const record of records) for (const node of record.addedNodes) schedule(node);
  });
  observer.observe(document.body, { childList:true, subtree:true });

  const unread = document.getElementById('dmUnreadBadge');
  if (unread) new MutationObserver(syncUnreadBadge).observe(unread, { childList:true, characterData:true, subtree:true, attributes:true, attributeFilter:['class'] });

  window.addEventListener('mingrx:theme-change', syncUnreadBadge);
  window.addEventListener('banana:i18n-changed', () => schedule(document.body));
})();
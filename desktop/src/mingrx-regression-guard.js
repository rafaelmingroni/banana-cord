/* Mingrx release regression guard — loaded last after every legacy compatibility layer. */
(() => {
  if (window.__mingrxRegressionGuardLoaded) return;
  window.__mingrxRegressionGuardLoaded = true;

  const BRAND = 'Mingrx';
  const VERSION = 'Preview · v2.1.0';
  let fixing = false;
  let queued = false;

  function markSvg(className = 'mingrx-inline-mark') {
    return `<span class="${className}" aria-hidden="true"><svg viewBox="0 0 1024 1024" role="presentation"><rect x="72" y="72" width="880" height="880" rx="220" fill="var(--mx-panel-3)"/><path d="M252 716V360c0-72 84-106 132-52L512 452l128-144c48-54 132-20 132 52v356" fill="none" stroke="var(--mx-accent)" stroke-width="124" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`;
  }

  function wordmark() {
    return '<span class="mingrx-brand-word"><span>Mingr</span><span class="mingrx-x">x</span></span>';
  }

  function htmlNode(html) {
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    return template.content.firstElementChild;
  }

  function replaceVisibleText(root) {
    if (!root) return;
    const replacements = [
      [/banana-cloud:\/\/firebase/gi, 'Mingrx Cloud'],
      [/mingrx-cloud:\/\/firebase/gi, 'Mingrx Cloud'],
      [/banana\s+cloud/gi, 'Mingrx Cloud'],
      [/banana\s+cord/gi, BRAND],
      [/conta\s+banana/gi, 'Conta Mingrx']
    ];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      let next = String(node.nodeValue || '');
      for (const [pattern, value] of replacements) next = next.replace(pattern, value);
      if (next !== node.nodeValue) node.nodeValue = next;
    }
  }

  function fixAuth() {
    const brand = document.querySelector('.cloud-brand');
    if (!brand) return;
    const stale = /banana/i.test(brand.textContent || '') || !!brand.querySelector('img[src*="banana"]') || !brand.querySelector('.mingrx-auth-brand');
    if (stale) {
      brand.innerHTML = `<div class="mingrx-auth-brand">${markSvg()}<div><h1>${wordmark()}</h1><p>Entre para conversar, jogar e compartilhar.</p></div></div>`;
    }
    const missing = document.getElementById('cloudConfigMissing');
    const title = missing?.querySelector('h2');
    if (title && /banana/i.test(title.textContent || '')) title.textContent = 'Mingrx Cloud ainda não configurado';
    replaceVisibleText(document.getElementById('cloudGate'));
  }

  function fixPrivateIdentity() {
    for (const home of document.querySelectorAll('.v214-private-home')) {
      const banana = home.querySelector('img[src*="banana"]');
      if (banana) banana.replaceWith(htmlNode(markSvg('mingrx-inline-mark mingrx-private-mark')));
      const heading = home.querySelector('h2');
      if (heading && heading.textContent.trim() === 'Privado') heading.textContent = 'Mensagens privadas';
      replaceVisibleText(home);
    }
  }

  function removeLegacySettingsBrand(root) {
    if (!root) return;
    for (const legacy of root.querySelectorAll('.settings-brand,.settings-nav-foot,.version-label')) legacy.remove();
    for (const image of root.querySelectorAll('img')) {
      const src = String(image.getAttribute('src') || '');
      const alt = String(image.getAttribute('alt') || '');
      if (/banana-cord|banana/i.test(src) || /banana\s*cord/i.test(alt)) image.replaceWith(htmlNode(markSvg()));
    }
  }

  function fixSettings() {
    const shell = document.querySelector('.settings-shell');
    if (!shell) return;
    const settingsRoot = shell.closest('.settings-modal') || document.getElementById('modalBody') || shell;
    removeLegacySettingsBrand(settingsRoot);
    const nav = shell.querySelector('.settings-nav');
    if (nav) {
      if (!nav.querySelector('.mingrx-settings-brand')) {
        const brand = document.createElement('div');
        brand.className = 'mingrx-settings-brand';
        brand.innerHTML = `${markSvg()}<div><b>${wordmark()}</b><small>Configurações</small></div>`;
        nav.prepend(brand);
      }
      if (!nav.querySelector('.mingrx-settings-version')) {
        const version = document.createElement('div');
        version.className = 'mingrx-settings-version';
        version.textContent = `${BRAND} ${VERSION}`;
        nav.appendChild(version);
      }
    }
    const content = shell.querySelector('.settings-content');
    content?.classList.add('settings-main');
    replaceVisibleText(settingsRoot);
  }

  function fixCloudState() {
    try {
      if (window.BananaCloudMode && typeof state !== 'undefined' && /banana-cloud/i.test(String(state.serverUrl || ''))) {
        state.serverUrl = 'mingrx-cloud://firebase';
      }
    } catch {}
  }

  function scheduleFix() {
    if (queued) return;
    queued = true;
    setTimeout(() => {
      queued = false;
      fixAll();
    }, 0);
  }

  function wrapFunction(name, after) {
    const base = window[name];
    if (typeof base !== 'function' || base.__mingrxGuardWrapped) return;
    const wrapped = function(...args) {
      const result = base.apply(this, args);
      setTimeout(after, 0);
      return result;
    };
    wrapped.__mingrxGuardWrapped = true;
    window[name] = wrapped;
  }

  function wrapCloudBridge() {
    const legacy = window.BananaLegacy;
    const base = legacy?.attachSocket;
    if (typeof base !== 'function' || base.__mingrxGuardWrapped) return;
    const wrapped = function(...args) {
      const result = base.apply(this, args);
      fixCloudState();
      setTimeout(() => { fixCloudState(); fixSettings(); }, 0);
      return result;
    };
    wrapped.__mingrxGuardWrapped = true;
    legacy.attachSocket = wrapped;
  }

  function installHooks() {
    wrapCloudBridge();
    wrapFunction('openSettings', fixSettings);
    wrapFunction('showDmHome', () => { fixPrivateIdentity(); fixSettings(); });
  }

  function fixAll() {
    if (fixing) return;
    fixing = true;
    try {
      installHooks();
      fixCloudState();
      fixAuth();
      fixPrivateIdentity();
      fixSettings();
    } finally {
      fixing = false;
    }
  }

  /* Event-driven only: do not observe the document. Hot chat/social rendering stays untouched. */
  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if (target.closest('#profileBtn,.settings-nav-item,[id^="tab"]')) scheduleFix();
    if (target.closest('#homeServer,.mingrx-brand')) setTimeout(fixPrivateIdentity, 0);
  }, true);
  window.addEventListener('banana:i18n-changed', scheduleFix);

  fixAll();
  setTimeout(fixAll, 80);
  window.MingrxRepairBranding = fixAll;
})();

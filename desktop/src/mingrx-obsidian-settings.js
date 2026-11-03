/* Mingrx Obsidian — Settings progressive enhancement.
 * Keeps the existing settings logic and only decorates rendered surfaces.
 */
(() => {
  if (window.__mingrxObsidianSettingsLoaded) return;
  window.__mingrxObsidianSettingsLoaded = true;

  const ICONS = {
    tabProfile:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
    tabAudio:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8"/></svg>',
    tabVideo:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="14" height="14" rx="2"/><path d="m17 10 4-2v8l-4-2z"/></svg>',
    tabGeneral:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M9 18h6"/><circle cx="8" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="12" cy="18" r="2"/></svg>',
    tabV21Social:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="10" r="2.5"/><path d="M3 20a6 6 0 0 1 12 0M14 20a4 4 0 0 1 7 0"/></svg>',
    tabDiag:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h4l2-5 4 10 2-5h6"/></svg>',
    tabUpdates:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 1 0 2 5M20 4v7h-7"/></svg>'
  };

  const searchIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>';
  const activityIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h8l2 3v8a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3V9z"/><path d="M9 11h6M12 8v6"/></svg>';

  const stripLeadingSymbol = value => String(value || '').replace(/^[^A-Za-zÀ-ÿ0-9]+/u, '').trim();

  function replaceLegacyBrandText(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      if (node.parentElement?.closest('script,style')) continue;
      if (node.data.includes('Banana Cord')) node.data = node.data.replaceAll('Banana Cord', 'Mingrx');
    }
  }

  function ensureBrand(shell) {
    const brand = shell.querySelector('.settings-brand');
    if (!brand || brand.dataset.mxObsidianSettings === 'true') return;
    brand.dataset.mxObsidianSettings = 'true';
    brand.innerHTML = '<div class="mx-settings-brand-mark"><img src="../assets/mingrx.svg" alt=""></div><div><b>Mingrx</b><small>Configurações</small></div>';
  }

  function filterNavigation(shell, query) {
    const value = String(query || '').trim().toLocaleLowerCase('pt-BR');
    for (const button of shell.querySelectorAll('.settings-nav-item')) {
      const text = button.textContent.toLocaleLowerCase('pt-BR');
      button.classList.toggle('mx-settings-filtered', !!value && !text.includes(value));
    }
  }

  function ensureSearch(shell) {
    const nav = shell.querySelector('.settings-nav');
    const brand = shell.querySelector('.settings-brand');
    if (!nav || !brand || nav.querySelector('.mx-settings-search')) return;
    const wrap = document.createElement('div');
    wrap.className = 'mx-settings-search';
    wrap.innerHTML = `${searchIcon}<input type="search" aria-label="Buscar configurações" placeholder="Buscar configurações" autocomplete="off">`;
    brand.insertAdjacentElement('afterend', wrap);
    const input = wrap.querySelector('input');
    input.addEventListener('input', () => filterNavigation(shell, input.value));
    input.addEventListener('keydown', event => {
      if (event.key !== 'Enter') return;
      const visible = [...shell.querySelectorAll('.settings-nav-item:not(.mx-settings-filtered)')];
      if (visible.length === 1) {
        event.preventDefault();
        visible[0].click();
      }
    });
  }

  function decorateNavigation(shell) {
    for (const button of shell.querySelectorAll('.settings-nav-item')) {
      const svg = ICONS[button.id];
      if (!svg) continue;
      let holder = button.querySelector(':scope > .mx-settings-nav-icon');
      if (!holder) {
        const legacy = button.querySelector(':scope > span');
        holder = document.createElement('span');
        holder.className = 'mx-settings-nav-icon';
        if (legacy) legacy.replaceWith(holder); else button.prepend(holder);
      }
      if (holder.dataset.mxIcon !== button.id) {
        holder.dataset.mxIcon = button.id;
        holder.innerHTML = svg;
      }
    }
  }

  function decorateSettingsArea(shell) {
    const area = shell.querySelector('#settingsArea');
    if (!area) return;

    for (const heading of area.querySelectorAll('.v21-setting-card h3')) {
      const clean = stripLeadingSymbol(heading.textContent);
      if (heading.textContent !== clean) heading.textContent = clean;
    }
    for (const button of area.querySelectorAll('.v21-language')) {
      const clean = stripLeadingSymbol(button.textContent);
      if (button.textContent !== clean) button.textContent = clean;
    }

    const game = area.querySelector('.v21-activity-game');
    if (game && !game.querySelector('svg')) {
      game.classList.add('mx-settings-activity-icon');
      game.innerHTML = activityIcon;
    }

    const kicker = [...area.querySelectorAll('.settings-kicker')].find(el => el.textContent.trim().toUpperCase() === 'BANANA CORD');
    if (kicker) kicker.textContent = 'MINGRX';

    replaceLegacyBrandText(area);
  }

  function decorateSettings() {
    const shell = document.querySelector('.settings-shell');
    if (!shell) return;
    const modal = shell.closest('.settings-modal');
    if (modal) modal.style.setProperty('height', 'min(620px, calc(100vh - 56px))', 'important');
    shell.dataset.mxObsidianSettings = 'true';
    ensureBrand(shell);
    ensureSearch(shell);
    decorateNavigation(shell);
    decorateSettingsArea(shell);
    const foot = shell.querySelector('.settings-nav-foot');
    if (foot && !/^Mingrx\s/i.test(foot.textContent.trim())) foot.textContent = `Mingrx ${foot.textContent.trim()}`;
  }

  let queued = false;
  function queueDecorate() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      decorateSettings();
    });
  }

  const modalBody = document.getElementById('modalBody');
  if (modalBody) new MutationObserver(queueDecorate).observe(modalBody, { childList:true, subtree:true });

  document.addEventListener('keydown', event => {
    const shell = document.querySelector('.settings-shell');
    if (!shell) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
      const input = shell.querySelector('.mx-settings-search input');
      if (input) {
        event.preventDefault();
        input.focus();
        input.select();
      }
    }
  });

  window.addEventListener('banana:i18n-changed', queueDecorate);
  queueDecorate();
})();
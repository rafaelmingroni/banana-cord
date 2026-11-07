(() => {
  'use strict';
  const params = new URLSearchParams(location.search);
  const isHome = !location.pathname || /\/(?:index\.html)?$/.test(location.pathname);
  if (isHome && params.has('invite')) {
    location.replace(`./invite.html?invite=${encodeURIComponent(params.get('invite') || '')}`);
    return;
  }

  const menuButton = document.querySelector('.menu-button');
  const nav = document.querySelector('.topnav');
  if (menuButton && nav) {
    const closeMenu = () => {
      nav.classList.remove('open');
      menuButton.setAttribute('aria-expanded', 'false');
    };
    menuButton.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      menuButton.setAttribute('aria-expanded', String(open));
    });
    nav.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && nav.classList.contains('open')) {
        closeMenu();
        menuButton.focus();
      }
    });
    document.addEventListener('click', event => {
      if (!nav.contains(event.target) && !menuButton.contains(event.target)) closeMenu();
    });
    window.matchMedia('(min-width: 851px)').addEventListener?.('change', closeMenu);
  }

  // One visible scene, keyboard-operable tabs, and no autoplay.
  const sceneTabs = [...document.querySelectorAll('[data-scene]')];
  const activateScene = (name, focus = false) => {
    const selected = sceneTabs.find(tab => tab.dataset.scene === name);
    if (!selected) return;
    sceneTabs.forEach(tab => {
      const active = tab === selected;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      const panel = document.getElementById(tab.getAttribute('aria-controls'));
      if (panel) panel.hidden = !active;
    });
    if (focus) selected.focus();
  };
  sceneTabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activateScene(tab.dataset.scene));
    tab.addEventListener('keydown', event => {
      const destinations = {ArrowRight:(index+1)%sceneTabs.length, ArrowLeft:(index-1+sceneTabs.length)%sceneTabs.length, Home:0, End:sceneTabs.length-1};
      if (!(event.key in destinations)) return;
      event.preventDefault();
      activateScene(sceneTabs[destinations[event.key]].dataset.scene, true);
    });
  });
  document.querySelectorAll('[data-show-scene]').forEach(link => link.addEventListener('click', () => activateScene(link.dataset.showScene)));
  document.querySelectorAll('.legal-toc').forEach(toc => { if (window.matchMedia?.('(min-width: 851px)').matches) toc.open = true; });
  document.querySelectorAll('[data-copy-site]').forEach(button => button.addEventListener('click', async () => {
    const group = button.closest('.pc-link');
    const status = group?.querySelector('.copy-status');
    const fallback = group?.querySelector('.copy-fallback');
    button.disabled = true;
    try {
      await navigator.clipboard.writeText('https://mingrx.site/');
      if (status) status.textContent = 'Link copiado. Abra no seu computador.';
      if (fallback) fallback.hidden = true;
    } catch {
      if (status) status.textContent = 'Não foi possível copiar automaticamente. Use o endereço abaixo.';
      if (fallback) fallback.hidden = false;
    } finally { button.disabled = false; }
  }));

  const year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());

  const downloadLinks = [...document.querySelectorAll('.download-link')];
  if (!downloadLinks.length) return;
  // Every link already has a working fallback. Never block a download on API availability.
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timeout = controller ? setTimeout(() => controller.abort(), 6000) : null;
  fetch('https://api.github.com/repos/rafaelmingroni/mingrx-app/releases/latest', {
    headers: { Accept: 'application/vnd.github+json' },
    ...(controller ? { signal: controller.signal } : {})
  }).then(response => response.ok ? response.json() : Promise.reject(new Error('Release unavailable')))
    .then(release => {
      if (release.draft || release.prerelease) return;
      const asset = (release.assets || []).find(item => /^Mingrx-Setup-.*-x64\.exe$/i.test(item.name));
      const url = asset?.browser_download_url || '';
      if (/^https:\/\/github\.com\/rafaelmingroni\/mingrx-app\/releases\/download\/[^\s]+\.exe$/.test(url)) {
        downloadLinks.forEach(link => { link.href = url; });
      }
      const version = String(release.tag_name || '').replace(/^v/i, '');
      if (/^\d+\.\d+\.\d+$/.test(version)) {
        document.querySelectorAll('.release-note').forEach(note => {
          const publicVersion = version.replace(/\.0$/, '');
          note.textContent = `Mingrx ${publicVersion}. Gratuito para Windows 10 e 11.`;
        });
      }
    }).catch(() => {})
    .finally(() => { if (timeout !== null) clearTimeout(timeout); });
})();

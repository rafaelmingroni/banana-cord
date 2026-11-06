(() => {
  'use strict';
  const params = new URLSearchParams(location.search);
  if (params.has('invite')) {
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
          note.textContent = `Versão ${version} para Windows 10 e 11. Download gratuito na versão atual.`;
        });
      }
    }).catch(() => {})
    .finally(() => { if (timeout !== null) clearTimeout(timeout); });
})();

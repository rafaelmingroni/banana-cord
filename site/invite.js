(() => {
  'use strict';
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const normalize = value => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const format = value => value.match(/.{1,4}/g)?.join('-') || '';
  const raw = normalize(new URLSearchParams(location.search).get('invite'));
  const valid = [8,12].includes(raw.length) && [...raw].every(char => alphabet.includes(char));
  const codeEl = document.getElementById('code');
  const status = document.getElementById('status');
  const open = document.getElementById('openApp');
  const download = document.getElementById('download');
  const recovery = document.getElementById('inviteRecovery');
  const title = document.getElementById('inviteTitle');
  const copyGroup = document.getElementById('inviteCopy');
  if (!valid) {
    codeEl.textContent = 'INVÁLIDO';
    status.textContent = 'Esse link de convite não está no formato esperado.';
    open.style.display = 'none';
    if (title) title.textContent = 'Vamos precisar de um novo convite.';
    if (recovery) recovery.hidden = false;
    return;
  }
  const code = format(raw);
  codeEl.textContent = code;
  const deep = `mingrx://join/${encodeURIComponent(code)}`;
  open.href = deep;
  status.textContent = 'Tentando abrir o Mingrx…';
  if (copyGroup) copyGroup.hidden = false;
  const copyButton = document.getElementById('copyInvite');
  copyButton?.addEventListener('click', async () => {
    const feedback = document.getElementById('copyInviteStatus');
    const fallback = document.getElementById('copyInviteFallback');
    const url = `https://mingrx.site/invite.html?invite=${encodeURIComponent(code)}`;
    copyButton.disabled = true;
    try {
      await navigator.clipboard.writeText(url);
      if (feedback) feedback.textContent = 'Convite copiado. Abra no computador com o Mingrx.';
      if (fallback) fallback.hidden = true;
    } catch {
      if (feedback) feedback.textContent = 'Copie o endereço abaixo para continuar.';
      if (fallback) { fallback.hidden = false; fallback.textContent = url; }
    } finally { copyButton.disabled = false; }
  });
  let leftPage = false;
  document.addEventListener('visibilitychange', () => { if (document.hidden) leftPage = true; });
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timeout = controller ? setTimeout(() => controller.abort(), 6000) : null;
  fetch('https://api.github.com/repos/rafaelmingroni/mingrx-app/releases/latest', {
    headers: { Accept:'application/vnd.github+json' }, ...(controller ? {signal:controller.signal} : {})
  }).then(response => response.ok ? response.json() : Promise.reject())
    .then(release => {
      if (release.draft || release.prerelease) return;
      const asset = (release.assets || []).find(item => /^Mingrx-Setup-.*-x64\.exe$/i.test(item.name));
      const url = asset?.browser_download_url || '';
      if (/^https:\/\/github\.com\/rafaelmingroni\/mingrx-app\/releases\/download\/[^\s]+\.exe$/.test(url)) download.href = url;
    }).catch(() => {}).finally(() => { if (timeout !== null) clearTimeout(timeout); });
  setTimeout(() => { location.href = deep; }, 180);
  setTimeout(() => {
    if (leftPage || document.hidden) return;
    status.textContent = 'O aplicativo não abriu? Você pode baixar a versão mais recente abaixo. Depois de instalar, abra este mesmo convite novamente.';
  }, 1800);
})();

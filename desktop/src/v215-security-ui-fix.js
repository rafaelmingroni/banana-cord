/* Banana Cord V2.0.15 — renderer security hardening.
 * Invitations must never be allowed to replace the official update source.
 */
(() => {
  if (window.__bananaV215SecurityUi) return;
  window.__bananaV215SecurityUi = true;

  const OFFICIAL_REPO = 'https://github.com/rafaelmingroni/banana-cord';

  // Keep invitation payloads independent from update infrastructure.
  try {
    makeInvite = function makeInviteV215(url, code) {
      return `BANANA|${String(url || '')}|${String(code || '')}`;
    };
  } catch {}

  // Old invites may still contain a fourth field. Ignore it completely.
  try {
    maybeAdoptUpdateRepo = async function maybeAdoptUpdateRepoV215() {
      state.updates.config = { ...state.updates.config, repoUrl: OFFICIAL_REPO };
      return false;
    };
  } catch {}

  // Keep renderer state pinned even if stale local preferences existed before 2.0.15.
  queueMicrotask(async () => {
    try {
      const cfg = await ipcRenderer.invoke('update:get-config');
      state.updates.config = { ...cfg, repoUrl: OFFICIAL_REPO };
    } catch {}
  });

  const observer = new MutationObserver(() => {
    for (const input of document.querySelectorAll('input')) {
      const value = String(input.value || '');
      const placeholder = String(input.placeholder || '');
      if (value.includes('github.com/') || /github|repositório|repositorio/i.test(placeholder)) {
        if (/update|atualiza|repo/i.test(input.id || input.name || input.closest?.('.settings-card')?.textContent || '')) {
          input.value = OFFICIAL_REPO;
          input.readOnly = true;
          input.title = 'Por segurança, atualizações do Banana Cord vêm somente do repositório oficial.';
        }
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();

(() => {
  const KEY = 'mingrx.theme';
  const allowed = new Set(['system', 'midnight', 'pearl', 'crimson', 'ocean', 'forest', 'mono']);
  let preference = 'system';
  try {
    const saved = localStorage.getItem(KEY);
    if (allowed.has(saved)) preference = saved;
  } catch {}

  const media = window.matchMedia?.('(prefers-color-scheme: light)');
  const systemMode = () => media?.matches ? 'light' : 'dark';
  const root = document.documentElement;

  root.dataset.mingrxTheme = preference;
  root.dataset.mingrxSystem = systemMode();
  root.style.colorScheme = preference === 'pearl' || (preference === 'system' && systemMode() === 'light') ? 'light' : 'dark';

  const updateSystem = () => {
    root.dataset.mingrxSystem = systemMode();
    if (root.dataset.mingrxTheme === 'system') {
      root.style.colorScheme = systemMode();
      window.dispatchEvent(new CustomEvent('mingrx:theme-system-change', { detail: { mode: systemMode() } }));
    }
  };

  media?.addEventListener?.('change', updateSystem);
})();

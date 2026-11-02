/* Banana Cord 2.1 — targeted localization for legacy select options. */
(() => {
  if (window.__bananaV21LegacyI18n) return;
  window.__bananaV21LegacyI18n = true;

  const groups = [
    { 'pt-BR':'Online', 'en-US':'Online', 'es-ES':'En línea' },
    { 'pt-BR':'Ocupado', 'en-US':'Busy', 'es-ES':'Ocupado' },
    { 'pt-BR':'Ausente', 'en-US':'Away', 'es-ES':'Ausente' },
    { 'pt-BR':'Automático (recomendado)', 'en-US':'Automatic (recommended)', 'es-ES':'Automático (recomendado)' },
    { 'pt-BR':'Qualidade', 'en-US':'Quality', 'es-ES':'Calidad' },
    { 'pt-BR':'Fluidez', 'en-US':'Smoothness', 'es-ES':'Fluidez' },
    { 'pt-BR':'Economia de banda', 'en-US':'Bandwidth saver', 'es-ES':'Ahorro de ancho de banda' },
    { 'pt-BR':'Membro', 'en-US':'Member', 'es-ES':'Miembro' },
    { 'pt-BR':'Moderador', 'en-US':'Moderator', 'es-ES':'Moderador' },
    { 'pt-BR':'Administrador', 'en-US':'Administrator', 'es-ES':'Administrador' }
  ];

  function translateOption(option) {
    if (!(option instanceof HTMLOptionElement)) return;
    const current = String(option.textContent || '').trim();
    const locale = window.BananaI18n?.getLocale?.() || 'pt-BR';
    for (const group of groups) {
      if (Object.values(group).includes(current)) {
        option.textContent = group[locale] || group['pt-BR'];
        return;
      }
    }
  }

  function translateOptions(root = document) {
    if (root instanceof HTMLOptionElement) translateOption(root);
    for (const option of root.querySelectorAll?.('option') || []) translateOption(option);
  }

  window.addEventListener('banana:i18n-changed', () => translateOptions(document));
  const observer = new MutationObserver(records => {
    for (const record of records) for (const node of record.addedNodes || []) {
      if (node.nodeType === Node.ELEMENT_NODE) translateOptions(node);
    }
  });
  queueMicrotask(() => {
    translateOptions(document);
    observer.observe(document.body, { childList:true, subtree:true });
  });
})();

/* Banana Cord v1.0.1 — correções de estabilidade do renderer. */
(() => {
  const VERSION = '1.0.1';
  const descriptor = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent');

  // A v1.0.0 atualizava labels de versão de dentro de um MutationObserver.
  // Atribuir o mesmo textContent recriava o text node e disparava o observer sem parar.
  // Este guard normaliza os três labels de versão e ignora atribuições idênticas.
  if (descriptor?.get && descriptor?.set && descriptor.configurable !== false) {
    Object.defineProperty(Node.prototype, 'textContent', {
      configurable: descriptor.configurable,
      enumerable: descriptor.enumerable,
      get: descriptor.get,
      set(value) {
        let next = value;
        const isElement = this?.nodeType === 1 && typeof this.matches === 'function';
        if (isElement) {
          if (this.matches('.version-label')) next = `Banana Cord v${VERSION}`;
          else if (this.matches('.settings-nav-foot, .setup .brand p b')) next = `v${VERSION}`;

          if (this.matches('.version-label, .settings-nav-foot, .setup .brand p b')) {
            const current = descriptor.get.call(this);
            if (current === String(next)) return;
          }
        }
        descriptor.set.call(this, next);
      }
    });
  }

  // Mantém o renderer leve quando a janela está escondida na bandeja.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) document.body.classList.add('window-hidden');
    else document.body.classList.remove('window-hidden');
  });
})();

/* Banana Cord v1.2.1 — guard de estabilidade do renderer. */
(() => {
  const descriptor = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent');

  if (descriptor?.get && descriptor?.set && descriptor.configurable !== false) {
    Object.defineProperty(Node.prototype, 'textContent', {
      configurable: descriptor.configurable,
      enumerable: descriptor.enumerable,
      get: descriptor.get,
      set(value) {
        const isElement = this?.nodeType === 1 && typeof this.matches === 'function';
        if (isElement && this.matches('.version-label, .settings-nav-foot, .setup .brand p b')) {
          const current = descriptor.get.call(this);
          if (current === String(value)) return;
        }
        descriptor.set.call(this, value);
      }
    });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) document.body.classList.add('window-hidden');
    else document.body.classList.remove('window-hidden');
  });
})();

/* Banana Cord v1.2.1/V2 — guard de estabilidade do renderer. */
(() => {
  const descriptor = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent');

  function normalizedVersionText(node, value) {
    const raw = String(value);
    if (!window.BananaCloudMode || !node?.matches) return raw;
    if (node.matches('.version-label')) return 'Banana Cord v2 Cloud Preview';
    if (node.matches('.settings-nav-foot, .setup .brand p b')) return 'v2 Cloud Preview';
    return raw;
  }

  if (descriptor?.get && descriptor?.set && descriptor.configurable !== false) {
    Object.defineProperty(Node.prototype, 'textContent', {
      configurable: descriptor.configurable,
      enumerable: descriptor.enumerable,
      get: descriptor.get,
      set(value) {
        const isElement = this?.nodeType === 1 && typeof this.matches === 'function';
        let next = String(value);
        if (isElement && this.matches('.version-label, .settings-nav-foot, .setup .brand p b')) {
          next = normalizedVersionText(this, value);
          const current = descriptor.get.call(this);
          if (current === next) return;
        }
        descriptor.set.call(this, next);
      }
    });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) document.body.classList.add('window-hidden');
    else document.body.classList.remove('window-hidden');
  });
})();

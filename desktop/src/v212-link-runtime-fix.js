/* Banana Cord V2.0.12 — reliable linkification after the final V1 message renderer. */
(() => {
  if (window.__bananaV212LinkRuntimeFix) return;
  window.__bananaV212LinkRuntimeFix = true;

  const electronShell = (() => { try { return require('electron').shell; } catch { return null; } })();
  const urlPattern = /https?:\/\/[^\s<>"']+/gi;

  function openExternal(url) {
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) return;
      if (electronShell?.openExternal) electronShell.openExternal(parsed.href);
      else window.open(parsed.href, '_blank', 'noopener,noreferrer');
    } catch {}
  }

  function replaceTextNode(node) {
    const text = node.nodeValue || '';
    urlPattern.lastIndex = 0;
    const matches = [...text.matchAll(urlPattern)];
    if (!matches.length) return;

    const fragment = document.createDocumentFragment();
    let cursor = 0;
    for (const match of matches) {
      const raw = match[0];
      const index = match.index || 0;
      if (index > cursor) fragment.appendChild(document.createTextNode(text.slice(cursor, index)));

      let href = raw;
      let suffix = '';
      while (/[.,!?;:]$/.test(href)) {
        suffix = href.slice(-1) + suffix;
        href = href.slice(0, -1);
      }

      const link = document.createElement('a');
      link.className = 'v212-message-link';
      link.href = href;
      link.textContent = href;
      link.title = 'Abrir link';
      link.rel = 'noopener noreferrer';
      link.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        openExternal(href);
      });
      fragment.appendChild(link);
      if (suffix) fragment.appendChild(document.createTextNode(suffix));
      cursor = index + raw.length;
    }
    if (cursor < text.length) fragment.appendChild(document.createTextNode(text.slice(cursor)));
    node.replaceWith(fragment);
  }

  function linkifyMessageElement(element) {
    if (!element) return;
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let node;
    while ((node = walker.nextNode())) {
      if (node.parentElement?.closest('a')) continue;
      urlPattern.lastIndex = 0;
      if (urlPattern.test(node.nodeValue || '')) nodes.push(node);
    }
    nodes.forEach(replaceTextNode);
  }

  function linkifyAll() {
    document.querySelectorAll('#messages .msg-text').forEach(linkifyMessageElement);
  }

  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => {
      scheduled = false;
      linkifyAll();
    }, 0);
  }

  const messages = document.getElementById('messages');
  if (messages) {
    new MutationObserver(schedule).observe(messages, { childList: true, subtree: true, characterData: true });
  }

  function attach(socket) {
    if (!socket || socket.__bananaV212LinkRuntimeAttached || typeof socket.on !== 'function') return;
    socket.__bananaV212LinkRuntimeAttached = true;
    for (const event of ['messages:list', 'message:new', 'message:updated', 'dm:list', 'dm:new', 'dm:updated']) {
      socket.on(event, schedule);
    }
  }

  if (window.BananaLegacy?.attachSocket) {
    const previousAttachSocket = window.BananaLegacy.attachSocket;
    window.BananaLegacy.attachSocket = function attachSocketV212Links(socket, user) {
      const result = previousAttachSocket(socket, user);
      attach(socket);
      schedule();
      return result;
    };
  }
  if (state?.socket) attach(state.socket);
  schedule();
})();

/* Banana Cord V2.0.20 — progressive chat history + scroll anchoring. */
(() => {
  if (window.__bananaV220ChatUi) return;
  window.__bananaV220ChatUi = true;

  let loading = false;
  let pendingAnchor = null;
  let scrollTimer = null;

  function ensureIndicator() {
    let el = document.getElementById('v220HistoryLoading');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'v220HistoryLoading';
    el.className = 'v220-history-loading hidden';
    el.textContent = 'Carregando mensagens anteriores…';
    els.messages?.prepend(el);
    return el;
  }

  function setLoading(value) {
    loading = !!value;
    ensureIndicator().classList.toggle('hidden', !loading);
  }

  function captureAnchor(kind, key) {
    pendingAnchor = {
      kind,
      key,
      oldHeight: els.messages?.scrollHeight || 0,
      oldTop: els.messages?.scrollTop || 0
    };
  }

  function restoreAnchor(kind, key) {
    if (!pendingAnchor || pendingAnchor.kind !== kind || pendingAnchor.key !== key || !els.messages) return;
    const anchor = pendingAnchor;
    pendingAnchor = null;
    requestAnimationFrame(() => {
      const delta = Math.max(0, els.messages.scrollHeight - anchor.oldHeight);
      els.messages.scrollTop = anchor.oldTop + delta;
      setLoading(false);
    });
  }

  const renderMessagesBase = renderMessages;
  renderMessages = function renderMessagesV220(...args) {
    const result = renderMessagesBase(...args);
    restoreAnchor('server', state.selectedChannel?.id || '');
    return result;
  };

  const renderDmMessagesBase = renderDmMessages;
  renderDmMessages = function renderDmMessagesV220(...args) {
    const result = renderDmMessagesBase(...args);
    restoreAnchor('dm', state.activeDmUserId || '');
    return result;
  };

  async function loadOlderIfNeeded() {
    if (loading || !els.messages || els.messages.scrollTop > 90 || !state.socket) return;
    if (state.viewMode === 'dm' && state.activeDmUserId) {
      if (typeof state.socket.loadOlderDmV220 !== 'function') return;
      captureAnchor('dm', state.activeDmUserId);
      setLoading(true);
      const started = state.socket.loadOlderDmV220(state.activeDmUserId);
      if (!started) { pendingAnchor = null; setLoading(false); }
      return;
    }
    if (state.viewMode === 'server' && state.selectedServer?.id && state.selectedChannel?.type === 'text') {
      if (typeof state.socket.loadOlderMessagesV220 !== 'function') return;
      captureAnchor('server', state.selectedChannel.id);
      setLoading(true);
      const started = state.socket.loadOlderMessagesV220(state.selectedServer.id, state.selectedChannel.id);
      if (!started) { pendingAnchor = null; setLoading(false); }
    }
  }

  els.messages?.addEventListener('scroll', () => {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(loadOlderIfNeeded, 80);
  }, { passive: true });

  // Re-check geometry after resize/maximize/restore. This only touches layout;
  // it does not rerender messages or query Firebase.
  const clampLayout = () => {
    if (!els.messages) return;
    const main = document.querySelector('.main');
    if (main && main.scrollHeight > main.clientHeight + 2) main.scrollTop = 0;
  };
  window.addEventListener('resize', () => requestAnimationFrame(clampLayout));

  ensureIndicator();
})();

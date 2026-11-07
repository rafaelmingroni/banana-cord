// UX protection in addition to Firebase Authentication's server-side quotas.
// This is deliberately not presented as a substitute for backend enforcement.
function createGuard(now = () => performance.now()) {
  const states = new Map();
  function blocked(code, message) { const error = new Error(message); error.code = code; return error; }
  return {
    async run(action, operation) {
      const state = states.get(action) || { running: false, failures: 0, retryAt: 0 };
      states.set(action, state);
      if (state.running) throw blocked('mingrx/auth-busy', 'Aguarde a tentativa em andamento.');
      if (now() < state.retryAt) {
        throw blocked('mingrx/auth-throttled', `Aguarde ${Math.max(1, Math.ceil((state.retryAt - now()) / 1000))} segundos antes de tentar novamente.`);
      }
      state.running = true;
      state.retryAt = now() + (action === 'login' ? 1000 : action === 'register' ? 10000 : 60000);
      try {
        const result = await operation();
        state.failures = 0;
        return result;
      } catch (error) {
        if (action === 'login') {
          state.failures++;
          const delay = state.failures < 5 ? 1000 : Math.min(300000, 30000 * 2 ** Math.min(4, state.failures - 5));
          state.retryAt = now() + Math.max(delay, error?.code === 'auth/too-many-requests' ? 60000 : 0);
        }
        throw error;
      } finally { state.running = false; }
    }
  };
}
module.exports = createGuard();
module.exports.createGuard = createGuard;

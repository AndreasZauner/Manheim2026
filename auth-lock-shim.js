(function installSupabaseAuthLockShim() {
  if (window.__manheimSupabaseAuthLockShim) return;
  window.__manheimSupabaseAuthLockShim = true;

  const locks = navigator?.locks;
  if (!locks?.request) return;

  const originalRequest = locks.request.bind(locks);
  let authQueue = Promise.resolve();

  locks.request = function request(name, options, callback) {
    let lockOptions = options;
    let lockCallback = callback;
    if (typeof options === 'function') {
      lockCallback = options;
      lockOptions = {};
    }

    if (typeof name === 'string' && /^lock:sb-.*-auth-token$/.test(name) && typeof lockCallback === 'function') {
      const run = () => Promise.resolve(lockCallback({
        name,
        mode: lockOptions?.mode || 'exclusive'
      }));
      const result = authQueue.catch(() => {}).then(run);
      authQueue = result.catch(() => {});
      return result;
    }

    return typeof lockCallback === 'function'
      ? originalRequest(name, lockOptions || {}, lockCallback)
      : originalRequest(name, lockOptions);
  };
})();

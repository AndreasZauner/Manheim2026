const LOGIN_WATCH_MS = 30000;

function getAuthMessage() {
  return document.getElementById('authMessage');
}

function getAppShell() {
  return document.getElementById('app');
}

function isAppVisible() {
  const app = getAppShell();
  return Boolean(app && !app.classList.contains('hidden'));
}

function watchLoginCompletion() {
  const startedAt = Date.now();
  const timer = window.setInterval(() => {
    const message = getAuthMessage()?.textContent || '';
    if (isAppVisible()) {
      window.clearInterval(timer);
      return;
    }
    if (/angemeldet/i.test(message)) {
      window.clearInterval(timer);
      window.setTimeout(() => window.location.reload(), 250);
      return;
    }
    if (Date.now() - startedAt > LOGIN_WATCH_MS) {
      window.clearInterval(timer);
      if (/anmeldung l/i.test(message)) {
        const box = getAuthMessage();
        if (box) {
          box.textContent = 'Anmeldung dauert laenger als erwartet. Bitte kurz warten oder die Seite neu laden.';
        }
      }
    }
  }, 300);
}

function handleLoginSubmit(event) {
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || form.id !== 'loginForm') return;
  window.setTimeout(watchLoginCompletion, 250);
}

if (!window.__manheimLoginStabilizerInstalled) {
  window.__manheimLoginStabilizerInstalled = true;
  document.addEventListener('submit', handleLoginSubmit);
}

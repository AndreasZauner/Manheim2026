const LOGIN_TIMEOUT_MS = 20000;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', installAuthLockHotfix);
} else {
  installAuthLockHotfix();
}

function installAuthLockHotfix() {
  if (window.__manheimAuthLockHotfixV3) return;
  window.__manheimAuthLockHotfixV3 = true;

  document.addEventListener('submit', (event) => {
    if (event.target?.id !== 'loginForm') return;
    handleLogin(event);
  }, true);
}

async function handleLogin(event) {
  event.preventDefault();
  event.stopImmediatePropagation();

  const form = event.target;
  const button = form.querySelector('button[type="submit"]');
  const message = document.getElementById('authMessage');
  const data = new FormData(form);
  const email = String(data.get('email') || '').trim();
  const password = String(data.get('password') || '');

  if (!email || !password) {
    setMessage(message, 'Bitte E-Mail und Passwort eingeben.', true);
    return;
  }

  try {
    if (button) button.disabled = true;
    setMessage(message, 'Direkte Anmeldung laeuft ...');

    const authData = await withTimeout(
      passwordGrant(email, password),
      'Anmeldung',
      LOGIN_TIMEOUT_MS
    );

    persistSupabaseSession(authData);
    setMessage(message, 'Angemeldet. Lade App neu ...');
    window.setTimeout(() => {
      window.location.replace(`${window.location.pathname}?login=${Date.now()}`);
    }, 250);
  } catch (error) {
    setMessage(message, error?.message || String(error), true);
    if (button) button.disabled = false;
  }
}

async function passwordGrant(email, password) {
  const config = window.APP_CONFIG || {};
  if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
    throw new Error('Supabase-Konfiguration fehlt.');
  }

  const response = await fetch(`${config.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: config.SUPABASE_ANON_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password })
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      payload.error_description ||
      payload.msg ||
      payload.message ||
      'Anmeldung fehlgeschlagen.'
    );
  }
  if (!payload.access_token || !payload.refresh_token) {
    throw new Error('Anmeldung erfolgreich, aber Sessiondaten fehlen.');
  }
  return payload;
}

function persistSupabaseSession(authData) {
  const config = window.APP_CONFIG || {};
  const projectRef = new URL(config.SUPABASE_URL).hostname.split('.')[0];
  const storageKey = `sb-${projectRef}-auth-token`;
  const expiresIn = Number(authData.expires_in || 3600);
  const session = {
    ...authData,
    expires_in: expiresIn,
    expires_at: authData.expires_at || Math.floor(Date.now() / 1000) + expiresIn
  };
  window.localStorage.setItem(storageKey, JSON.stringify(session));
}

function withTimeout(promise, label, ms) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = window.setTimeout(
      () => reject(new Error(`${label} dauert zu lange. Bitte Seite neu laden und erneut versuchen.`)),
      ms
    );
  });
  return Promise.race([
    Promise.resolve(promise).finally(() => window.clearTimeout(timeoutId)),
    timeout
  ]);
}

function setMessage(element, text, isError = false) {
  if (!element) return;
  element.textContent = text;
  element.style.background = isError ? '#fff0ef' : '#f8fbff';
  element.style.color = isError ? '#b8342f' : '#486279';
}

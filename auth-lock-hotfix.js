import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const LOGIN_TIMEOUT_MS = 20000;
const SESSION_TIMEOUT_MS = 12000;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', installAuthLockHotfix);
} else {
  installAuthLockHotfix();
}

function installAuthLockHotfix() {
  if (window.__manheimAuthLockHotfixV2) return;
  window.__manheimAuthLockHotfixV2 = true;

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

    const client = getClient();
    const { error } = await withTimeout(
      client.auth.setSession({
        access_token: authData.access_token,
        refresh_token: authData.refresh_token
      }),
      'Session speichern',
      SESSION_TIMEOUT_MS
    );
    if (error) throw error;

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

function getClient() {
  const config = window.APP_CONFIG || {};
  return window.getManheimSupabaseClient?.(createClient) || createClient(
    config.SUPABASE_URL,
    config.SUPABASE_ANON_KEY,
    { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
  );
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

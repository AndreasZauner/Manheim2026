import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const LOGIN_TIMEOUT_MS = 20000;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', installAuthLockHotfix);
} else {
  installAuthLockHotfix();
}

function installAuthLockHotfix() {
  const form = document.getElementById('loginForm');
  if (!form || form.dataset.authLockHotfix === 'true') return;
  form.dataset.authLockHotfix = 'true';
  form.addEventListener('submit', handleLogin, true);
}

async function handleLogin(event) {
  event.preventDefault();
  event.stopImmediatePropagation();

  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const message = document.getElementById('authMessage');
  const data = new FormData(form);

  try {
    if (button) button.disabled = true;
    setMessage(message, 'Anmeldung laeuft ...');
    const client = getClient();
    const { error } = await withTimeout(client.auth.signInWithPassword({
      email: String(data.get('email') || '').trim(),
      password: data.get('password')
    }), 'Anmeldung', LOGIN_TIMEOUT_MS);
    if (error) throw error;
    await withTimeout(getAuthSession(client), 'Session laden', 12000);
    setMessage(message, 'Angemeldet. Lade App ...');
    window.setTimeout(() => window.location.reload(), 250);
  } catch (error) {
    setMessage(message, error?.message || String(error), true);
    if (button) button.disabled = false;
  }
}

function getClient() {
  const config = window.APP_CONFIG || {};
  return window.getManheimSupabaseClient?.(createClient) || createClient(
    config.SUPABASE_URL,
    config.SUPABASE_ANON_KEY,
    { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
  );
}

function getAuthSession(client) {
  return window.getManheimAuthSession?.(client) || client.auth.getSession();
}

function withTimeout(promise, label, ms) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(`${label} dauert zu lange. Bitte Seite neu laden und erneut versuchen.`)), ms);
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

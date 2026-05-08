import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const config = window.APP_CONFIG || {};
const AUTH_TIMEOUT_MS = 18000;

function getClient() {
  if (typeof window.getManheimSupabaseClient === 'function') {
    return window.getManheimSupabaseClient(createClient);
  }
  return createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
}

function setAuthMessage(message, isError = false) {
  const box = document.getElementById('authMessage');
  if (!box) return;
  box.textContent = message;
  box.classList.toggle('error', Boolean(isError));
}

function withTimeout(promise, label) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(new Error(`${label} dauert zu lange. Bitte Seite neu laden und erneut versuchen.`));
    }, AUTH_TIMEOUT_MS);
  });
  return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timeoutId));
}

async function readSession(client) {
  const sessionRequest = typeof window.getManheimAuthSession === 'function'
    ? window.getManheimAuthSession(client)
    : client.auth.getSession();
  const { data, error } = await withTimeout(sessionRequest, 'Session speichern');
  if (error) throw error;
  return data?.session || null;
}

async function handleLoginSubmit(event) {
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || form.id !== 'loginForm') return;

  event.preventDefault();
  event.stopImmediatePropagation();

  const submitButton = form.querySelector('button[type="submit"]');
  if (submitButton?.disabled) return;
  if (submitButton) submitButton.disabled = true;

  const formData = new FormData(form);
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');
  const client = getClient();

  try {
    setAuthMessage('Anmeldung l\u00e4uft \u2026');
    const { data, error } = await withTimeout(
      client.auth.signInWithPassword({ email, password }),
      'Anmeldung'
    );
    if (error) throw error;

    const session = data?.session || await readSession(client);
    if (!session) {
      throw new Error('Anmeldung erfolgreich, aber die Session konnte nicht geladen werden. Bitte Seite neu laden und erneut versuchen.');
    }

    setAuthMessage('Angemeldet. Lade App \u2026');
    window.setTimeout(() => window.location.reload(), 250);
  } catch (error) {
    console.error('Login konnte nicht stabil abgeschlossen werden', error);
    setAuthMessage(error?.message || 'Anmeldung fehlgeschlagen.', true);
    if (submitButton) submitButton.disabled = false;
  }
}

if (!window.__manheimLoginStabilizerInstalled) {
  window.__manheimLoginStabilizerInstalled = true;
  document.addEventListener('submit', handleLoginSubmit, true);
}

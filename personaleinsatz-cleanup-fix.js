import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const MANAGER_ROLES = ['admin', 'professor', 'technical_lead', 'assistant'];

function getClient() {
  const config = window.APP_CONFIG || {};
  return window.getManheimSupabaseClient?.(createClient) || createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
}

function injectStyles() {
  if (document.getElementById('personaleinsatzCleanupStyles')) return;
  const style = document.createElement('style');
  style.id = 'personaleinsatzCleanupStyles';
  style.textContent = `
    #participantPlanningTabs.personaleinsatz-tabs-hidden {
      display: none !important;
    }
  `;
  document.head.appendChild(style);
}

function preferDeploymentView() {
  const tab = document.getElementById('participantsTab');
  if (!tab) return;
  const sectionHead = tab.querySelector('.section-head');
  sectionHead?.querySelector('h3')?.replaceChildren(document.createTextNode('Personaleinsatz'));
  sectionHead?.querySelector('.muted, p')?.replaceChildren(document.createTextNode('Zeitr\u00e4ume, Verbindlichkeit und Hinweise.'));

  const tabs = document.getElementById('participantPlanningTabs');
  const deploymentButton = tabs?.querySelector('[data-planning-tab="deployment"]');
  if (deploymentButton && !deploymentButton.classList.contains('active')) deploymentButton.click();
  tabs?.classList.add('personaleinsatz-tabs-hidden');
  tabs?.setAttribute('aria-hidden', 'true');

  const presence = document.getElementById('participantPresenceView');
  presence?.classList.add('hidden');
  presence?.setAttribute('aria-hidden', 'true');

  const deployment = document.getElementById('personnelDeploymentView');
  deployment?.classList.remove('hidden');
  deployment?.removeAttribute('aria-hidden');
}

async function getSession(client) {
  const request = window.getManheimAuthSession?.(client) || client.auth.getSession();
  const { data, error } = await request;
  if (error) throw error;
  return data?.session || null;
}

async function ensureManager(client) {
  const session = await getSession(client);
  const userId = session?.user?.id || null;
  if (!userId) return { userId: null, isManager: false };
  const { data, error } = await client.from('profiles').select('role,is_active').eq('id', userId).single();
  if (error) throw error;
  return {
    userId,
    isManager: Boolean(data?.is_active) && MANAGER_ROLES.includes(data?.role)
  };
}

function setDrawerError(message) {
  const node = document.getElementById('v21PersonError') || ensureDrawerErrorNode();
  if (node) node.textContent = message || '';
}

function ensureDrawerErrorNode() {
  const form = document.getElementById('v21PersonForm');
  if (!form) return null;
  let node = document.getElementById('v21PersonError');
  if (!node) {
    node = document.createElement('p');
    node.id = 'v21PersonError';
    node.className = 'personnel-form-error full';
    node.setAttribute('role', 'alert');
    form.querySelector('.personnel-drawer-footer')?.before(node);
  }
  return node;
}

function closePersonDrawer() {
  document.getElementById('v21PersonDrawer')?.classList.remove('open');
  document.getElementById('v21PersonDrawerBackdrop')?.classList.remove('open');
}

async function handlePersonSubmit(event) {
  const formElement = event.target;
  if (!(formElement instanceof HTMLFormElement) || formElement.id !== 'v21PersonForm') return;
  event.preventDefault();
  event.stopImmediatePropagation();

  const submitButton = formElement.querySelector('button[type="submit"]');
  const originalText = submitButton?.textContent || 'Person speichern';
  if (submitButton?.disabled) return;
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = 'Speichere ...';
  }
  setDrawerError('');

  try {
    const client = getClient();
    const { userId, isManager } = await ensureManager(client);
    if (!userId || !isManager) {
      throw new Error('Ihre Berechtigung wurde noch nicht geladen. Bitte Seite kurz neu laden und erneut versuchen.');
    }

    const form = new FormData(formElement);
    const special = String(form.get('special_function') || '').trim();
    const participant = {
      full_name: String(form.get('full_name') || '').trim(),
      public_role: String(form.get('public_role') || '').trim() || 'Teilnehmende',
      status: String(form.get('status') || 'zugesagt'),
      availability_from: String(form.get('availability_from') || '').trim() || null,
      availability_to: String(form.get('availability_to') || '').trim() || null,
      availability_note: String(form.get('availability_note') || '').trim() || null,
      source_note: ['Manuell im Personaleinsatz angelegt.', special ? `Zusatzfunktion: ${special}` : ''].filter(Boolean).join(' '),
      created_by: userId
    };
    if (!participant.full_name) throw new Error('Bitte mindestens einen Namen eintragen.');

    const { data, error } = await client.from('participants').insert(participant).select('id').single();
    if (error) throw error;

    const privatePayload = {
      participant_id: data.id,
      phone: String(form.get('phone') || '').trim() || null,
      email: String(form.get('email') || '').trim() || null,
      internal_note: String(form.get('internal_note') || '').trim() || null
    };
    if (privatePayload.phone || privatePayload.email || privatePayload.internal_note) {
      const { error: privateError } = await client.from('participant_private').insert(privatePayload);
      if (privateError) throw privateError;
    }

    if (participant.availability_from && participant.availability_to) {
      const { error: slotError } = await client.from('participant_availability_slots').insert({
        participant_id: data.id,
        availability_from: participant.availability_from,
        availability_to: participant.availability_to,
        order_index: 1,
        created_by: userId
      });
      if (slotError) console.warn('Primaerer Zeitraum konnte nicht gespiegelt werden', slotError);
    }

    formElement.reset();
    closePersonDrawer();
    document.getElementById('refreshButton')?.click();
    window.setTimeout(preferDeploymentView, 900);
  } catch (error) {
    console.error('Person konnte nicht gespeichert werden', error);
    setDrawerError('Person konnte nicht gespeichert werden: ' + (error?.message || error));
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = originalText;
    }
  }
}

function install() {
  if (window.__personaleinsatzCleanupInstalled) return;
  window.__personaleinsatzCleanupInstalled = true;
  injectStyles();
  document.addEventListener('submit', handlePersonSubmit, true);
  window.setInterval(preferDeploymentView, 800);
  window.setTimeout(preferDeploymentView, 50);
  window.setTimeout(preferDeploymentView, 600);
  window.setTimeout(preferDeploymentView, 1500);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', install);
} else {
  install();
}

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const MANAGER_ROLES = ['admin', 'professor', 'technical_lead', 'assistant'];
const ROLE_OPTIONS = [
  'Technische Grabungsleitung',
  'Assistenz technische Grabungsleitung',
  'Teilnehmende'
];

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
    .personnel-role-select {
      width: 100%;
    }
    .personnel-role-cleanup-backdrop {
      position: fixed;
      inset: 0;
      z-index: 9998;
      display: none;
      background: rgba(9, 24, 39, 0.28);
    }
    .personnel-role-cleanup-backdrop.open {
      display: block;
    }
    .personnel-role-cleanup-panel {
      position: fixed;
      right: 24px;
      top: 96px;
      z-index: 9999;
      display: none;
      width: min(360px, calc(100vw - 32px));
      padding: 18px;
      border: 1px solid #cfddea;
      border-radius: 12px;
      background: #ffffff;
      box-shadow: 0 18px 46px rgba(10, 35, 57, 0.22);
    }
    .personnel-role-cleanup-panel.open {
      display: block;
    }
    .personnel-role-cleanup-panel h3 {
      margin: 0 0 4px;
      color: #08243d;
      font-size: 18px;
    }
    .personnel-role-cleanup-panel p {
      margin: 0 0 14px;
      color: #5a6e82;
    }
    .personnel-role-cleanup-options {
      display: grid;
      gap: 8px;
    }
    .personnel-role-cleanup-choice {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid #cfddea;
      border-radius: 8px;
      background: #f8fbfe;
      color: #08243d;
      font-weight: 700;
      text-align: left;
      cursor: pointer;
    }
    .personnel-role-cleanup-choice:hover,
    .personnel-role-cleanup-choice.active {
      border-color: #2b7de1;
      background: #eaf3ff;
    }
    .personnel-role-cleanup-footer {
      display: flex;
      justify-content: flex-end;
      margin-top: 14px;
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

  enhancePersonDrawerRoleSelect();
  ensureRoleEditControls();
  sortDeploymentRowsByRoleStart();
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
      public_role: normalizeRole(String(form.get('public_role') || '').trim() || 'Teilnehmende'),
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

function enhancePersonDrawerRoleSelect() {
  const form = document.getElementById('v21PersonForm');
  const field = form?.querySelector('[name="public_role"]');
  if (!form || !field || field.tagName === 'SELECT') return;

  const currentRole = normalizeRole(field.value || 'Teilnehmende');
  const select = document.createElement('select');
  select.name = 'public_role';
  select.className = `${field.className || 'personnel-field'} personnel-role-select`.trim();
  select.required = true;
  select.innerHTML = ROLE_OPTIONS.map(role => (
    `<option value="${escapeHtml(role)}" ${role === currentRole ? 'selected' : ''}>${escapeHtml(role)}</option>`
  )).join('');
  field.replaceWith(select);
}

function ensureRoleEditControls() {
  if (!isDeploymentVisible()) return;
  document.querySelectorAll('#personnelDeploymentView .personnel-row').forEach(row => {
    if (row.querySelector('.personnel-role-edit-btn')) return;
    const id = row.querySelector('.personnel-date-edit-btn')?.dataset?.id;
    const roleNode = row.querySelector('.personnel-role');
    if (!id || !roleNode) return;
    const button = document.createElement('button');
    button.className = 'personnel-role personnel-role-edit-btn';
    button.type = 'button';
    button.dataset.id = id;
    button.textContent = normalizeRole(roleNode.textContent || 'Teilnehmende');
    roleNode.replaceWith(button);
  });
}

function handleRoleEditClick(event) {
  const button = event.target?.closest?.('#personnelDeploymentView .personnel-role-edit-btn');
  if (!button) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const row = button.closest('.personnel-row');
  const name = row?.querySelector('.personnel-person-top strong')?.textContent?.trim() || 'Person';
  openRolePanel(button.dataset.id, name, button.textContent);
}

function openRolePanel(participantId, name, currentRole) {
  if (!participantId) return;
  const panel = ensureRolePanel();
  panel.dataset.participantId = participantId;
  panel.querySelector('[data-role-name]').textContent = name;
  panel.querySelector('[data-role-options]').innerHTML = ROLE_OPTIONS.map(role => (
    `<button class="personnel-role-cleanup-choice ${role === normalizeRole(currentRole) ? 'active' : ''}" type="button" data-role="${escapeHtml(role)}">${escapeHtml(role)}</button>`
  )).join('');
  document.getElementById('personnelRoleCleanupBackdrop')?.classList.add('open');
  panel.classList.add('open');
}

function ensureRolePanel() {
  let panel = document.getElementById('personnelRoleCleanupPanel');
  if (panel) return panel;
  document.body.insertAdjacentHTML('beforeend', `
    <div id="personnelRoleCleanupBackdrop" class="personnel-role-cleanup-backdrop"></div>
    <aside id="personnelRoleCleanupPanel" class="personnel-role-cleanup-panel" aria-label="Rolle bearbeiten">
      <h3>Rolle bearbeiten</h3>
      <p><strong data-role-name></strong></p>
      <div class="personnel-role-cleanup-options" data-role-options></div>
      <p id="personnelRoleCleanupError" class="personnel-form-error" role="alert"></p>
      <div class="personnel-role-cleanup-footer">
        <button class="btn small ghost" type="button" data-role-close>Schliessen</button>
      </div>
    </aside>
  `);
  panel = document.getElementById('personnelRoleCleanupPanel');
  document.getElementById('personnelRoleCleanupBackdrop')?.addEventListener('click', closeRolePanel);
  panel.querySelector('[data-role-close]')?.addEventListener('click', closeRolePanel);
  panel.addEventListener('click', event => {
    const choice = event.target?.closest?.('.personnel-role-cleanup-choice');
    if (choice) saveRoleChoice(panel.dataset.participantId, choice.dataset.role);
  });
  return panel;
}

function closeRolePanel() {
  document.getElementById('personnelRoleCleanupBackdrop')?.classList.remove('open');
  const panel = document.getElementById('personnelRoleCleanupPanel');
  panel?.classList.remove('open');
  if (panel) panel.dataset.participantId = '';
}

async function saveRoleChoice(participantId, role) {
  const panel = document.getElementById('personnelRoleCleanupPanel');
  const errorNode = document.getElementById('personnelRoleCleanupError');
  if (errorNode) errorNode.textContent = '';
  try {
    const client = getClient();
    const { isManager } = await ensureManager(client);
    if (!isManager) throw new Error('Keine Berechtigung zum Bearbeiten.');
    const normalizedRole = normalizeRole(role);
    const { error } = await client.from('participants').update({ public_role: normalizedRole }).eq('id', participantId);
    if (error) throw error;
    closeRolePanel();
    document.getElementById('refreshButton')?.click();
    window.setTimeout(preferDeploymentView, 500);
    window.setTimeout(preferDeploymentView, 1200);
  } catch (error) {
    console.error('Rolle konnte nicht gespeichert werden', error);
    if (errorNode) errorNode.textContent = `Speichern fehlgeschlagen: ${error?.message || error}`;
    panel?.classList.add('open');
  }
}

function sortDeploymentRowsByRoleStart() {
  if (!isDeploymentVisible()) return;
  const sortSelect = document.getElementById('personnelSortBy');
  if (sortSelect && sortSelect.value !== 'role') return;
  const container = document.querySelector('#personnelDeploymentView .personnel-rows');
  if (!container) return;
  const rows = [...container.querySelectorAll('.personnel-row')];
  rows
    .sort((a, b) => compareRowRolePriority(a, b) || compareRowStart(a, b) || compareRowName(a, b))
    .forEach(row => container.appendChild(row));
}

function compareRowRolePriority(a, b) {
  const nameA = getRowName(a);
  const nameB = getRowName(b);
  return getRoleRank(getRowRole(a), nameA) - getRoleRank(getRowRole(b), nameB);
}

function compareRowStart(a, b) {
  return getRowStartTime(a) - getRowStartTime(b);
}

function compareRowName(a, b) {
  return getRowName(a).localeCompare(getRowName(b), 'de');
}

function getRowName(row) {
  return row.querySelector('.personnel-person-top strong')?.textContent?.trim() || '';
}

function getRowRole(row) {
  return row.querySelector('.personnel-role')?.textContent?.trim() || 'Teilnehmende';
}

function getRowStartTime(row) {
  const text = row.textContent || '';
  const match = text.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (!match) return Number.MAX_SAFE_INTEGER;
  return new Date(`${match[3]}-${match[2]}-${match[1]}T00:00:00`).getTime();
}

function getRoleRank(role, name = '') {
  if (normalizeComparable(name) === 'andreas zauner') return 0;
  const normalized = normalizeRole(role);
  if (normalized === 'Technische Grabungsleitung') return 1;
  if (normalized === 'Assistenz technische Grabungsleitung') return 2;
  if (normalized === 'Teilnehmende') return 3;
  return 9;
}

function normalizeRole(role) {
  const raw = String(role || '').trim();
  const comparable = normalizeComparable(raw);
  if (!raw) return 'Teilnehmende';
  if (comparable === 'technische grabungsleitung') return 'Technische Grabungsleitung';
  if (comparable === 'assistenz technische grabungsleitung' || comparable === 'assistenz') return 'Assistenz technische Grabungsleitung';
  if (['teilnehmer', 'teilnehmerin', 'teilnehmender', 'teilnehmende'].includes(comparable)) return 'Teilnehmende';
  return ROLE_OPTIONS.includes(raw) ? raw : 'Teilnehmende';
}

function normalizeComparable(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function isDeploymentVisible() {
  const deployment = document.getElementById('personnelDeploymentView');
  return Boolean(deployment && !deployment.classList.contains('hidden'));
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function install() {
  if (window.__personaleinsatzCleanupInstalled) return;
  window.__personaleinsatzCleanupInstalled = true;
  injectStyles();
  document.addEventListener('submit', handlePersonSubmit, true);
  document.addEventListener('click', handleRoleEditClick, true);
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

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const MANAGER_ROLES = ['admin', 'professor', 'technical_lead', 'assistant'];
const STATUS_OPTIONS = [
  { value: 'gesetzt', label: 'Fest eingeplant', tone: 'green', description: 'Fest eingeplant und nicht weiter zu klaeren.' },
  { value: 'zugesagt', label: 'Zugesagt', tone: 'blue', description: 'Teilnahme bestaetigt, Zeitraum gilt als Planungsgrundlage.' },
  { value: 'erweiterbar', label: 'Erweiterbar', tone: 'teal', description: 'Zusage vorhanden, weitere Tage oder Wochen sind moeglich.' },
  { value: 'unklar', label: 'Unklar', tone: 'orange', description: 'Zeitraum oder Teilnahme muss noch geklaert werden.' },
  { value: 'anzufragen', label: 'Anzufragen', tone: 'gray', description: 'Person ist noch nicht verbindlich angefragt.' },
  { value: 'abgesagt', label: 'Abgesagt', tone: 'red', description: 'Person nimmt in diesem Zeitraum nicht teil.' }
];
const LEGACY_STATUS = { value: 'zu_klaeren', dbValue: 'zu_kl\u00e4ren', label: 'Zu klaeren (alt)' };

const state = {
  client: null,
  userId: null,
  isManager: false,
  observer: null,
  activeParticipantId: null
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', installStatusEditor);
} else {
  installStatusEditor();
}

function installStatusEditor() {
  if (window.__participantStatusEditorInstalled) return;
  window.__participantStatusEditorInstalled = true;
  injectStyles();
  setupSupabase();
  bindAuth();
  watchPersonnelView();
  window.setTimeout(refreshUserAndEnhance, 300);
  window.setTimeout(refreshUserAndEnhance, 1200);
}

function setupSupabase() {
  const config = window.APP_CONFIG || {};
  if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) return;
  state.client = window.getManheimSupabaseClient?.(createClient) || createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
}

function bindAuth() {
  if (!state.client) return;
  state.client.auth.onAuthStateChange(event => {
    if (event === 'SIGNED_OUT') {
      state.userId = null;
      state.isManager = false;
      closeDrawer();
      enhancePersonnelStatusUi();
      return;
    }
    if (['SIGNED_IN', 'TOKEN_REFRESHED', 'USER_UPDATED', 'INITIAL_SESSION'].includes(event)) {
      window.setTimeout(refreshUserAndEnhance, 500);
    }
  });
}

async function refreshUserAndEnhance() {
  await loadManagerState();
  enhancePersonnelStatusUi();
}

async function loadManagerState() {
  if (!state.client) return;
  const { data: sessionData, error: sessionError } = await getAuthSession();
  if (sessionError) {
    console.warn('Status-Modul: Session konnte nicht geladen werden', sessionError);
    return;
  }
  state.userId = sessionData?.session?.user?.id || null;
  state.isManager = false;
  if (!state.userId) return;
  const { data, error } = await state.client.from('profiles').select('role,is_active').eq('id', state.userId).single();
  if (error) {
    console.warn('Status-Modul: Rolle konnte nicht geladen werden', error);
    return;
  }
  state.isManager = Boolean(data?.is_active) && MANAGER_ROLES.includes(data?.role);
}

function watchPersonnelView() {
  state.observer = new MutationObserver(() => enhancePersonnelStatusUi());
  state.observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener('click', event => {
    if (event.target?.closest?.('.participant-planning-tab, .nav-btn[data-tab="participants"]')) {
      window.setTimeout(refreshUserAndEnhance, 200);
    }
  });
}

function enhancePersonnelStatusUi() {
  enhanceStatusFilter();
  if (!state.isManager) return;
  document.querySelectorAll('#personnelDeploymentView .personnel-row').forEach(row => {
    const idNode = row.querySelector('.personnel-date-edit-btn[data-id], .personnel-role-edit-btn[data-id]');
    const participantId = idNode?.dataset.id;
    if (!participantId) return;
    const current = row.querySelector('.personnel-person-top .personnel-badge');
    if (!current || current.classList.contains('personnel-status-edit-btn')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `${current.className} personnel-status-edit-btn`;
    button.dataset.id = participantId;
    button.textContent = current.textContent;
    button.title = 'Status aendern';
    button.addEventListener('click', () => openDrawer(participantId));
    current.replaceWith(button);
  });
}

function enhanceStatusFilter() {
  const select = document.getElementById('personnelStatusFilter');
  if (!select || select.dataset.statusEditorEnhanced === 'true') return;
  const current = select.value;
  select.innerHTML = [
    '<option value="all">Alle Status</option>',
    ...STATUS_OPTIONS.map(option => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`),
    `<option value="${LEGACY_STATUS.dbValue}">${LEGACY_STATUS.label}</option>`
  ].join('');
  select.value = [...STATUS_OPTIONS.map(option => option.value), LEGACY_STATUS.dbValue, 'all'].includes(current) ? current : 'all';
  select.dataset.statusEditorEnhanced = 'true';
}

async function openDrawer(participantId) {
  if (!state.isManager || !state.client) return;
  state.activeParticipantId = participantId;
  const drawer = ensureDrawer();
  setError('');
  drawer.querySelector('#participantStatusName').textContent = 'Status wird geladen ...';
  drawer.querySelector('#participantStatusOptions').innerHTML = renderStatusButtons(null);
  showDrawer();
  const { data, error } = await state.client.from('participants').select('id,full_name,status').eq('id', participantId).single();
  if (error) {
    setError(error.message || String(error));
    return;
  }
  drawer.querySelector('#participantStatusName').textContent = data?.full_name || 'Ohne Namen';
  drawer.querySelector('#participantStatusOptions').innerHTML = renderStatusButtons(data?.status);
  drawer.querySelectorAll('[data-participant-status]').forEach(button => {
    button.addEventListener('click', () => saveStatus(button.dataset.participantStatus));
  });
}

function renderStatusButtons(currentStatus) {
  return STATUS_OPTIONS.map(option => `
    <button class="participant-status-choice ${option.value === currentStatus ? 'active' : ''}" type="button" data-participant-status="${escapeHtml(option.value)}">
      <span>${escapeHtml(option.label)}</span>
      <small>${escapeHtml(option.description)}</small>
    </button>
  `).join('');
}

async function saveStatus(status) {
  if (!state.activeParticipantId || !status) return;
  setError('');
  const { error } = await state.client
    .from('participants')
    .update({ status })
    .eq('id', state.activeParticipantId);
  if (error) {
    setError(`Speichern fehlgeschlagen: ${error.message || error}`);
    return;
  }
  updateVisibleRow(state.activeParticipantId, status);
  closeDrawer();
  document.getElementById('refreshButton')?.click();
}

function updateVisibleRow(participantId, status) {
  const label = STATUS_OPTIONS.find(option => option.value === status)?.label || status;
  const tone = STATUS_OPTIONS.find(option => option.value === status)?.tone || 'gray';
  document.querySelectorAll(`#personnelDeploymentView [data-id="${CSS.escape(String(participantId))}"].personnel-status-edit-btn`).forEach(button => {
    button.className = `personnel-badge personnel-status-edit-btn status-${status}`;
    button.textContent = label;
  });
  document.querySelectorAll(`#personnelDeploymentView .personnel-row`).forEach(row => {
    const idNode = row.querySelector(`[data-id="${CSS.escape(String(participantId))}"]`);
    if (!idNode) return;
    row.querySelectorAll('.personnel-bar, .print-bar').forEach(bar => {
      bar.classList.remove('green', 'blue', 'teal', 'orange', 'gray', 'red');
      bar.classList.add(tone);
    });
  });
}

function ensureDrawer() {
  let drawer = document.getElementById('participantStatusDrawer');
  if (drawer) return drawer;
  document.body.insertAdjacentHTML('beforeend', `
    <div id="participantStatusBackdrop" class="participant-status-backdrop"></div>
    <aside id="participantStatusDrawer" class="participant-status-drawer" aria-hidden="true">
      <div class="participant-status-head">
        <div>
          <h3>Status aendern</h3>
          <p id="participantStatusName">-</p>
        </div>
        <button id="participantStatusClose" type="button" aria-label="Schliessen">x</button>
      </div>
      <div class="participant-status-body">
        <div id="participantStatusOptions" class="participant-status-options"></div>
        <p id="participantStatusError" class="participant-status-error" role="alert"></p>
      </div>
    </aside>
  `);
  drawer = document.getElementById('participantStatusDrawer');
  document.getElementById('participantStatusBackdrop')?.addEventListener('click', closeDrawer);
  document.getElementById('participantStatusClose')?.addEventListener('click', closeDrawer);
  return drawer;
}

function showDrawer() {
  document.getElementById('participantStatusBackdrop')?.classList.add('open');
  document.getElementById('participantStatusDrawer')?.classList.add('open');
  document.getElementById('participantStatusDrawer')?.setAttribute('aria-hidden', 'false');
}

function closeDrawer() {
  state.activeParticipantId = null;
  document.getElementById('participantStatusBackdrop')?.classList.remove('open');
  document.getElementById('participantStatusDrawer')?.classList.remove('open');
  document.getElementById('participantStatusDrawer')?.setAttribute('aria-hidden', 'true');
}

function setError(message) {
  const node = document.getElementById('participantStatusError');
  if (node) node.textContent = message;
}

function getAuthSession() {
  return window.getManheimAuthSession?.(state.client) || state.client.auth.getSession();
}

function injectStyles() {
  if (document.getElementById('participantStatusEditorStyles')) return;
  const style = document.createElement('style');
  style.id = 'participantStatusEditorStyles';
  style.textContent = `
    .personnel-status-edit-btn { border: 0; cursor: pointer; font-family: inherit; }
    .personnel-status-edit-btn:hover, .personnel-status-edit-btn:focus-visible { box-shadow: 0 0 0 2px rgba(37, 99, 235, .18); outline: none; }
    .personnel-badge.status-erweiterbar { background: #e6f7f4; color: #0f766e; }
    .personnel-badge.status-unklar { background: #fff4e5; color: #c98216; }
    .personnel-badge.status-abgesagt { background: #fee4e2; color: #b42318; }
    .personnel-bar.teal, .print-bar.teal { background: linear-gradient(90deg, #0f766e, #14b8a6); }
    .personnel-bar.red, .print-bar.red { background: linear-gradient(90deg, #b42318, #e53e3e); }
    .participant-status-backdrop { position: fixed; inset: 0; display: none; background: rgba(10,20,30,.28); z-index: 80; }
    .participant-status-backdrop.open { display: block; }
    .participant-status-drawer { position: fixed; top: 0; right: 0; z-index: 90; width: min(430px, 100vw); height: 100vh; background: #fff; box-shadow: -8px 0 30px rgba(0,0,0,.14); transform: translateX(100%); transition: transform .2s ease; display: flex; flex-direction: column; }
    .participant-status-drawer.open { transform: translateX(0); }
    .participant-status-head { display: flex; justify-content: space-between; gap: 12px; padding: 18px 20px; border-bottom: 1px solid var(--border); }
    .participant-status-head h3 { margin: 0 0 4px; }
    .participant-status-head p { margin: 0; color: var(--muted); font-size: .86rem; font-weight: 800; }
    #participantStatusClose { border: 0; background: #f4f7fa; color: var(--text); width: 36px; height: 36px; border-radius: 10px; font-size: 1.1rem; cursor: pointer; }
    .participant-status-body { padding: 18px 20px; overflow: auto; }
    .participant-status-options { display: grid; gap: 8px; }
    .participant-status-choice { border: 1px solid var(--border); background: #fff; color: var(--text); border-radius: 10px; padding: 10px 12px; text-align: left; font-weight: 900; cursor: pointer; }
    .participant-status-choice:hover, .participant-status-choice:focus-visible, .participant-status-choice.active { border-color: var(--accent); background: #edf5ff; color: #174f8a; }
    .participant-status-choice small { display: block; margin-top: 4px; color: var(--muted); font-size: .76rem; font-weight: 700; line-height: 1.35; }
    .participant-status-error { min-height: 18px; color: #b42318; font-size: .84rem; font-weight: 800; }
  `;
  document.head.appendChild(style);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

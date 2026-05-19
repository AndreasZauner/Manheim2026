import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const MANAGER_ROLES = ['admin', 'professor', 'technical_lead', 'assistant'];
const TYPE_OPTIONS = [
  ['student', 'Regul\u00e4r'],
  ['external', 'Extern']
];

const state = {
  client: null,
  userId: null,
  isManager: false,
  editingId: null,
  editingBadge: null,
  observer: null
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', installParticipantTypeEditor);
} else {
  installParticipantTypeEditor();
}

async function installParticipantTypeEditor() {
  if (window.__participantTypeEditorInstalled) return;
  window.__participantTypeEditorInstalled = true;
  injectStyles();
  setupSupabase();
  await refreshPermissions();
  if (!state.isManager) return;
  enhanceTypeBadges();
  observePersonnelView();
  document.getElementById('refreshButton')?.addEventListener('click', () => window.setTimeout(enhanceTypeBadges, 900));
}

function setupSupabase() {
  const config = window.APP_CONFIG || {};
  if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) return;
  state.client = window.getManheimSupabaseClient?.(createClient) || createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
}

async function refreshPermissions() {
  if (!state.client) return;
  const { data: sessionData, error: sessionError } = await getAuthSession();
  if (sessionError) throw sessionError;
  state.userId = sessionData?.session?.user?.id || null;
  state.isManager = false;
  if (!state.userId) return;
  const { data, error } = await state.client.from('profiles').select('role,is_active').eq('id', state.userId).single();
  if (error) throw error;
  state.isManager = Boolean(data?.is_active) && MANAGER_ROLES.includes(data?.role);
}

function observePersonnelView() {
  const target = document.getElementById('participantsTab') || document.body;
  if (!target || state.observer) return;
  state.observer = new MutationObserver(() => enhanceTypeBadges());
  state.observer.observe(target, { childList: true, subtree: true });
}

function enhanceTypeBadges() {
  if (!state.isManager) return;
  document.querySelectorAll('.personnel-row').forEach(row => {
    const id = row.querySelector('.personnel-role-edit-btn[data-id]')?.dataset.id;
    const badge = row.querySelector('.personnel-badge.type-student, .personnel-badge.type-external');
    if (!id || !badge || badge.dataset.typeEditorBound === 'true') return;
    const button = badge.tagName === 'BUTTON' ? badge : document.createElement('button');
    if (button !== badge) {
      button.className = badge.className;
      button.textContent = badge.textContent;
      badge.replaceWith(button);
    }
    button.type = 'button';
    button.dataset.id = id;
    button.dataset.typeEditorBound = 'true';
    button.classList.add('personnel-type-edit-btn');
    button.addEventListener('click', () => openTypeEditor(id, button));
  });
}

function openTypeEditor(participantId, badge) {
  state.editingId = participantId;
  state.editingBadge = badge;
  const drawer = ensureTypeEditor();
  const currentType = badge.classList.contains('type-external') ? 'external' : 'student';
  drawer.querySelector('#participantTypeEditorError').textContent = '';
  drawer.querySelector('#participantTypeEditorOptions').innerHTML = TYPE_OPTIONS.map(([value, label]) => `
    <button class="personnel-role-choice ${value === currentType ? 'active' : ''}" type="button" data-person-type="${value}">
      ${label}
    </button>
  `).join('');
  drawer.querySelectorAll('[data-person-type]').forEach(button => {
    button.addEventListener('click', () => saveType(button.dataset.personType));
  });
  document.getElementById('participantTypeEditorBackdrop')?.classList.add('open');
  drawer.classList.add('open');
  drawer.setAttribute('aria-hidden', 'false');
}

function ensureTypeEditor() {
  let drawer = document.getElementById('participantTypeEditorDrawer');
  if (drawer) return drawer;
  document.body.insertAdjacentHTML('beforeend', `
    <div id="participantTypeEditorBackdrop" class="personnel-drawer-backdrop"></div>
    <aside id="participantTypeEditorDrawer" class="personnel-drawer personnel-role-drawer" aria-hidden="true">
      <div class="personnel-drawer-header">
        <div>
          <h3>Gruppe \u00e4ndern</h3>
          <p>Regul\u00e4r oder Extern</p>
        </div>
        <button id="participantTypeEditorClose" class="personnel-close" type="button" aria-label="Schliessen">x</button>
      </div>
      <div class="personnel-drawer-body personnel-role-body">
        <div id="participantTypeEditorOptions" class="personnel-role-options full"></div>
        <p id="participantTypeEditorError" class="personnel-form-error full" role="alert"></p>
      </div>
    </aside>
  `);
  drawer = document.getElementById('participantTypeEditorDrawer');
  document.getElementById('participantTypeEditorBackdrop')?.addEventListener('click', closeTypeEditor);
  document.getElementById('participantTypeEditorClose')?.addEventListener('click', closeTypeEditor);
  return drawer;
}

function closeTypeEditor() {
  state.editingId = null;
  state.editingBadge = null;
  document.getElementById('participantTypeEditorBackdrop')?.classList.remove('open');
  const drawer = document.getElementById('participantTypeEditorDrawer');
  drawer?.classList.remove('open');
  drawer?.setAttribute('aria-hidden', 'true');
}

async function saveType(personTypeValue) {
  if (!state.client || !state.editingId || !['student', 'external'].includes(personTypeValue)) return;
  const drawer = document.getElementById('participantTypeEditorDrawer');
  const errorNode = drawer?.querySelector('#participantTypeEditorError');
  if (errorNode) errorNode.textContent = '';
  try {
    const payload = {
      person_type: personTypeValue,
      external_source: personTypeValue === 'external' ? 'Manuell markiert' : null
    };
    const { error } = await state.client.from('participants').update(payload).eq('id', state.editingId);
    if (error) throw error;
    updateBadge(state.editingBadge, personTypeValue);
    closeTypeEditor();
    document.getElementById('refreshButton')?.click();
    window.setTimeout(enhanceTypeBadges, 1200);
  } catch (error) {
    if (errorNode) errorNode.textContent = `Speichern fehlgeschlagen: ${error.message || error}`;
  }
}

function updateBadge(badge, personTypeValue) {
  if (!badge) return;
  badge.classList.toggle('type-student', personTypeValue === 'student');
  badge.classList.toggle('type-external', personTypeValue === 'external');
  badge.textContent = personTypeValue === 'external' ? 'extern' : 'regul\u00e4r';
}

function injectStyles() {
  if (document.getElementById('participantTypeEditorStyles')) return;
  document.head.insertAdjacentHTML('beforeend', `
    <style id="participantTypeEditorStyles">
      .personnel-type-edit-btn { border: 1px solid transparent; cursor: pointer; }
      .personnel-type-edit-btn:hover,
      .personnel-type-edit-btn:focus-visible { border-color: var(--accent); box-shadow: 0 0 0 2px rgba(49, 130, 206, .14); }
    </style>
  `);
}

function getAuthSession() {
  return window.getManheimAuthSession?.(state.client) || state.client.auth.getSession();
}

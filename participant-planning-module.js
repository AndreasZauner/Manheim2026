import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const PROJECT_START = new Date('2026-07-27T00:00:00');
const PROJECT_END = new Date('2026-10-09T00:00:00');
const MANAGER_ROLES = ['admin', 'professor', 'technical_lead', 'assistant'];
const STATUS_ORDER = { gesetzt: 0, zugesagt: 1, 'zu_kl\u00e4ren': 2, anzufragen: 3 };
const ROLE_PRESETS = [
  'Grabungsleiter',
  'Professor',
  'Technische Leitung',
  'Assistenz',
  'Schnittleitung',
  'Dokumentation',
  'Logistik',
  'Teilnehmende'
];

const state = {
  client: null,
  userId: null,
  isManager: false,
  activeSubtab: 'presence',
  participants: [],
  privateRows: [],
  availabilitySlots: [],
  search: '',
  status: 'all',
  sort: 'role',
  loading: false,
  authListenerBound: false,
  editingParticipantId: null,
  editingRoleId: null
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', installParticipantPlanning);
} else {
  installParticipantPlanning();
}

function installParticipantPlanning() {
  if (window.__participantPlanningInstalled) return;
  window.__participantPlanningInstalled = true;
  injectStylesheet();
  setupSupabase();
  bindAuthStateListener();
  renameNavigation();
  ensurePlanningShell();
  renderDeployment();
  installReadinessWatcher();
  document.getElementById('refreshButton')?.addEventListener('click', () => {
    window.setTimeout(refreshParticipantPlanning, 700);
  });
}

function injectStylesheet() {
  if (document.querySelector('link[href^="./participant-planning-module.css"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = './participant-planning-module.css?v=planning-20260504-2';
  document.head.appendChild(link);
}

function setupSupabase() {
  const config = window.APP_CONFIG || {};
  if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) return;
  state.client = window.getManheimSupabaseClient?.(createClient) || createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
}

function bindAuthStateListener() {
  if (!state.client || state.authListenerBound) return;
  state.authListenerBound = true;
  state.client.auth.onAuthStateChange(event => {
    if (event === 'SIGNED_OUT') {
      state.userId = null;
      state.isManager = false;
      state.participants = [];
      state.privateRows = [];
      state.availabilitySlots = [];
      renderDeployment();
      return;
    }
    if (['SIGNED_IN', 'TOKEN_REFRESHED', 'USER_UPDATED', 'INITIAL_SESSION'].includes(event)) {
      window.setTimeout(refreshParticipantPlanning, 700);
    }
  });
}

function installReadinessWatcher() {
  let checks = 0;
  const timer = window.setInterval(() => {
    checks += 1;
    const appVisible = !document.getElementById('app')?.classList.contains('hidden');
    if (appVisible && !state.userId && !state.loading) refreshParticipantPlanning();
    if (state.userId || checks > 80) window.clearInterval(timer);
  }, 250);
}

async function refreshParticipantPlanning() {
  const appVisible = !document.getElementById('app')?.classList.contains('hidden');
  if (!appVisible || state.loading) return;
  state.loading = true;
  try {
    ensurePlanningShell();
    await loadUser();
    await loadData();
    renderDeployment();
  } catch (error) {
    console.error(error);
    renderDeploymentError(error?.message || String(error));
  } finally {
    state.loading = false;
  }
}

async function loadUser() {
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

function renameNavigation() {
  const button = document.querySelector('.nav-btn[data-tab="participants"]');
  if (button && button.textContent !== 'Personal') button.textContent = 'Personal';
  if (button && button.dataset.participantPlanningClickBound !== 'true') {
    button.dataset.participantPlanningClickBound = 'true';
    button.addEventListener('click', () => window.setTimeout(() => {
      renameNavigation();
      updatePageTitle();
      refreshParticipantPlanning();
    }, 30));
  }
  updatePageTitle();
}

function updatePageTitle() {
  const active = document.querySelector('.nav-btn[data-tab="participants"]')?.classList.contains('active');
  if (!active) return;
  const title = document.getElementById('pageTitle');
  const subtitle = document.getElementById('pageSubtitle');
  if (title && title.textContent !== 'Personal') title.textContent = 'Personal';
  if (subtitle && subtitle.textContent !== 'Personaleinsatz, Zeitr\u00e4ume, Verbindlichkeit und Hinweise') {
    subtitle.textContent = 'Personaleinsatz, Zeitr\u00e4ume, Verbindlichkeit und Hinweise';
  }
}

function ensurePlanningShell() {
  const tab = document.getElementById('participantsTab');
  if (!tab || document.getElementById('participantPlanningTabs')) return;
  const sectionHead = tab.querySelector('.section-head');
  if (!sectionHead) return;
  sectionHead.querySelector('h3')?.replaceChildren(document.createTextNode('Personaleinsatz'));
  sectionHead.querySelector('p')?.replaceChildren(document.createTextNode('Anwesenheit, Teilnehmendenliste und Einsatzzeitr\u00e4ume im Grabungszeitraum.'));

  sectionHead.insertAdjacentHTML('afterend', `
    <div id="participantPlanningTabs" class="participant-planning-tabs" role="tablist" aria-label="Personal">
      <button type="button" class="btn small participant-planning-tab active" data-planning-tab="presence">Anwesenheit & Liste</button>
      <button type="button" class="btn small participant-planning-tab" data-planning-tab="deployment">Personaleinsatz</button>
    </div>
  `);

  const presenceWrapper = document.createElement('div');
  presenceWrapper.id = 'participantPresenceView';
  [...tab.children].forEach(child => {
    if (child === sectionHead || child.id === 'participantPlanningTabs') return;
    presenceWrapper.appendChild(child);
  });
  tab.appendChild(presenceWrapper);
  tab.insertAdjacentHTML('beforeend', '<section id="personnelDeploymentView" class="personnel-deployment-view hidden"></section>');

  document.querySelectorAll('.participant-planning-tab').forEach(button => {
    button.addEventListener('click', () => {
      state.activeSubtab = button.dataset.planningTab;
      syncSubtabs();
      if (state.activeSubtab === 'deployment') refreshParticipantPlanning();
    });
  });
  syncSubtabs();
}

function syncSubtabs() {
  document.querySelectorAll('.participant-planning-tab').forEach(button => {
    button.classList.toggle('active', button.dataset.planningTab === state.activeSubtab);
  });
  document.getElementById('participantPresenceView')?.classList.toggle('hidden', state.activeSubtab !== 'presence');
  document.getElementById('personnelDeploymentView')?.classList.toggle('hidden', state.activeSubtab !== 'deployment');
  updatePageTitle();
}

async function loadData() {
  if (!state.client || !state.userId) return;
  const [participantsResult, privateResult] = await Promise.all([
    state.client
      .from('participants')
      .select('id,full_name,public_role,availability_from,availability_to,status,availability_note,source_note')
      .order('availability_from', { ascending: true, nullsFirst: false })
      .order('full_name'),
    state.isManager
      ? state.client.from('participant_private').select('participant_id,phone,email,internal_note')
      : Promise.resolve({ data: [], error: null })
  ]);

  if (participantsResult.error) throw participantsResult.error;
  if (privateResult.error) throw privateResult.error;
  state.participants = participantsResult.data || [];
  state.privateRows = state.isManager ? privateResult.data || [] : [];
  const { data: slots, error: slotsError } = await state.client
    .from('participant_availability_slots')
    .select('id,participant_id,availability_from,availability_to,order_index')
    .order('order_index', { ascending: true })
    .order('availability_from', { ascending: true, nullsFirst: false });
  if (slotsError) {
    console.warn('Zusatzzeiträume konnten nicht geladen werden. Wurde supabase/participant_availability_slots.sql ausgeführt?', slotsError);
    state.availabilitySlots = [];
  } else {
    state.availabilitySlots = slots || [];
  }
}

function renderDeployment() {
  const host = document.getElementById('personnelDeploymentView');
  if (!host) return;
  const list = getFilteredParticipants();
  host.innerHTML = `
    <section class="personnel-hero">
      <div>
        <div class="personnel-eyebrow">Personal</div>
        <h3>Personaleinsatz</h3>
        <p>Zeitr\u00e4ume, Status und Hinweise im \u00dcberblick. Die Balken basieren auf den echten Supabase-Teilnehmerdaten.</p>
      </div>
    </section>
    <div class="personnel-topbar">
      <div class="personnel-summary">${summaryCards(list)}</div>
      <div class="personnel-controls">
        <input id="personnelSearch" class="personnel-search" type="text" placeholder="Nach Namen suchen ..." value="${escapeHtml(state.search)}">
        <select id="personnelStatusFilter" class="personnel-select">
          <option value="all" ${state.status === 'all' ? 'selected' : ''}>Alle Status</option>
          <option value="gesetzt" ${state.status === 'gesetzt' ? 'selected' : ''}>gesetzt</option>
          <option value="zugesagt" ${state.status === 'zugesagt' ? 'selected' : ''}>zugesagt</option>
          <option value="zu_kl\u00e4ren" ${state.status === 'zu_kl\u00e4ren' ? 'selected' : ''}>zu kl\u00e4ren</option>
          <option value="anzufragen" ${state.status === 'anzufragen' ? 'selected' : ''}>anzufragen</option>
        </select>
        <select id="personnelSortBy" class="personnel-select">
          <option value="role" ${state.sort === 'role' ? 'selected' : ''}>Nach Rolle / Start</option>
          <option value="start" ${state.sort === 'start' ? 'selected' : ''}>Nach Startdatum</option>
          <option value="name" ${state.sort === 'name' ? 'selected' : ''}>Alphabetisch</option>
          <option value="status" ${state.sort === 'status' ? 'selected' : ''}>Nach Status</option>
          <option value="problem" ${state.sort === 'problem' ? 'selected' : ''}>Kl\u00e4rungsbedarf zuerst</option>
        </select>
        ${state.isManager ? '<button id="personnelPdfExport" class="btn small personnel-pdf-btn" type="button">PDF exportieren</button>' : ''}
      </div>
    </div>
    <section class="personnel-board">
      <div class="personnel-board-header">
        <div class="personnel-left-head">
          <h3>Teilnehmende</h3>
          <p>Name, Rolle, Status und Zusatzhinweise</p>
        </div>
        <div class="personnel-right-head">
          <h3>Gesamtzeitraum der Grabung: 27.07.2026 - 09.10.2026</h3>
          <p>Der farbige Balken zeigt den jeweils geplanten Teilnahmezeitraum.</p>
        </div>
      </div>
      <div class="personnel-rows">${list.length ? list.map(renderDeploymentRow).join('') : emptyMessage()}</div>
      <div class="personnel-legend">
        <span><i class="personnel-swatch green"></i>gesetzt</span>
        <span><i class="personnel-swatch blue"></i>zugesagt</span>
        <span><i class="personnel-swatch orange"></i>zu kl\u00e4ren</span>
        <span><i class="personnel-swatch gray"></i>anzufragen</span>
      </div>
    </section>
  `;
  bindDeploymentUi();
}

function emptyMessage() {
  if (state.loading) return '<div class="personnel-empty">Personaleinsatz wird geladen ...</div>';
  if (!state.userId) return '<div class="personnel-empty">Personaleinsatz l\u00e4dt nach dem Login automatisch.</div>';
  return '<div class="personnel-empty">Keine Personen f\u00fcr diese Auswahl gefunden.</div>';
}

function bindDeploymentUi() {
  document.getElementById('personnelSearch')?.addEventListener('input', event => {
    state.search = event.target.value;
    renderDeployment();
  });
  document.getElementById('personnelStatusFilter')?.addEventListener('change', event => {
    state.status = event.target.value;
    renderDeployment();
  });
  document.getElementById('personnelSortBy')?.addEventListener('change', event => {
    state.sort = event.target.value;
    renderDeployment();
  });
  document.getElementById('personnelPdfExport')?.addEventListener('click', exportPersonnelPdf);
  document.querySelectorAll('.personnel-date-edit-btn').forEach(button => {
    button.addEventListener('click', () => openDateEditor(button.dataset.id));
  });
  document.querySelectorAll('.personnel-role-edit-btn').forEach(button => {
    button.addEventListener('click', () => openRoleEditor(button.dataset.id));
  });
}

function getFilteredParticipants() {
  const query = state.search.trim().toLowerCase();
  return [...state.participants]
    .filter(person => !query || String(person.full_name || '').toLowerCase().includes(query))
    .filter(person => state.status === 'all' || person.status === state.status)
    .sort(comparePeople);
}

function comparePeople(a, b) {
  if (state.sort === 'role') return compareRolePriority(a, b) || compareDates(a.availability_from, b.availability_from) || comparePeopleByName(a, b);
  if (state.sort === 'name') return comparePeopleByName(a, b);
  if (state.sort === 'status') return (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99) || comparePeopleByName(a, b);
  if (state.sort === 'problem') return Number(hasProblem(b)) - Number(hasProblem(a)) || compareDates(a.availability_from, b.availability_from);
  return compareDates(a.availability_from, b.availability_from) || comparePeopleByName(a, b);
}

function comparePeopleByName(a, b) {
  return String(a.full_name || '').localeCompare(String(b.full_name || ''), 'de');
}

function compareRolePriority(a, b) {
  return roleRank(a.public_role) - roleRank(b.public_role)
    || String(a.public_role || '').localeCompare(String(b.public_role || ''), 'de');
}

function roleRank(role) {
  const text = String(role || '').toLowerCase();
  if (/grabungsleit|projektleit|professor/.test(text)) return 0;
  if (/technische leit|technical/.test(text)) return 1;
  if (/assist/.test(text)) return 2;
  if (/schnitt|trench/.test(text)) return 3;
  if (/doku|dokument/.test(text)) return 4;
  if (/logistik|infra/.test(text)) return 5;
  if (/teilnehm|student|participant/.test(text)) return 6;
  return 9;
}

function renderDeploymentRow(person) {
  const ranges = getRanges(person);
  const privateData = privateFor(person.id);
  const note = [person.availability_note, privateData.internal_note, person.source_note].filter(Boolean).join(' \u00b7 ');
  const timeline = ranges.length
    ? `<div class="personnel-timeline">${ranges.map((range, index) => `<div class="personnel-bar personnel-bar-segment ${barColor(person.status)}" style="left:${range.left}%;width:${range.width}%">${index === 0 ? escapeHtml(formatSlotSummary(person)) : ''}</div>`).join('')}</div>`
    : '<div class="personnel-unclear">Zeitraum unklar / uneinheitlich</div>';
  return `
    <article class="personnel-row">
      <div class="personnel-person">
        <div class="personnel-person-top">
          <strong>${escapeHtml(person.full_name || 'Ohne Namen')}</strong>
          <span class="personnel-badge ${statusClass(person.status)}">${prettyStatus(person.status)}</span>
        </div>
        ${state.isManager ? `<button class="personnel-role personnel-role-edit-btn" type="button" data-id="${escapeHtml(person.id)}">${escapeHtml(person.public_role || 'Teilnehmende')}</button>` : `<span class="personnel-role">${escapeHtml(person.public_role || 'Teilnehmende')}</span>`}
        <div class="personnel-meta">
          <span class="personnel-badge outline">${escapeHtml(formatSlotSummary(person))}</span>
          ${hasProblem(person) ? '<span class="personnel-badge warning">Kl\u00e4rungsbedarf</span>' : ''}
          ${state.isManager && privateData.email ? `<span class="personnel-badge outline">${escapeHtml(privateData.email)}</span>` : ''}
        </div>
        ${state.isManager ? `<div class="personnel-actions"><button class="btn small personnel-date-edit-btn" type="button" data-id="${escapeHtml(person.id)}">Zeitraum ändern</button></div>` : ''}
      </div>
      <div class="personnel-timeline-cell">
        <div class="personnel-timeline-wrap">
          ${timeline}
          ${note ? `<div class="personnel-note">${escapeHtml(shorten(note, 180))}</div>` : ''}
        </div>
      </div>
    </article>
  `;
}

function summaryCards(list) {
  const finalConfirmed = list.filter(person => getRange(person).valid && !hasProblem(person) && !['anzufragen', 'zu_kl\u00e4ren'].includes(person.status)).length;
  const expandable = list.filter(person => /auch|evtl|eventuell|m\u00f6glich|verl\u00e4nger|zusatzwoche|flexibel|sp\u00e4tere termine/i.test(noteText(person))).length;
  const clarificationNeeded = list.filter(hasProblem).length;
  const withNote = list.filter(person => Boolean(noteText(person))).length;
  return [
    ['Gesamt', list.length],
    ['Final best\u00e4tigt', finalConfirmed],
    ['Erweiterbar', expandable],
    ['Kl\u00e4rungsbedarf', clarificationNeeded],
    ['Mit Anmerkung', withNote]
  ].map(([label, value]) => `<div class="personnel-stat"><span>${label}</span><strong>${value}</strong></div>`).join('');
}

function openRoleEditor(participantId) {
  if (!state.isManager) return;
  const person = state.participants.find(row => String(row.id) === String(participantId));
  if (!person) return;
  state.editingRoleId = person.id;
  const drawer = ensureRoleEditor();
  drawer.querySelector('#personnelRoleName').textContent = person.full_name || 'Ohne Namen';
  drawer.querySelector('#personnelRoleError').textContent = '';
  const roles = getRoleOptions();
  const currentRole = person.public_role || 'Teilnehmende';
  drawer.querySelector('#personnelRoleOptions').innerHTML = roles.map(role => `
    <button class="personnel-role-choice ${role === currentRole ? 'active' : ''}" type="button" data-role="${escapeHtml(role)}">
      ${escapeHtml(role)}
    </button>
  `).join('');
  drawer.querySelectorAll('.personnel-role-choice').forEach(button => {
    button.addEventListener('click', () => saveRole(button.dataset.role));
  });
  document.getElementById('personnelRoleBackdrop')?.classList.add('open');
  drawer.classList.add('open');
  drawer.setAttribute('aria-hidden', 'false');
}

function ensureRoleEditor() {
  let drawer = document.getElementById('personnelRoleDrawer');
  if (drawer) return drawer;
  document.body.insertAdjacentHTML('beforeend', `
    <div id="personnelRoleBackdrop" class="personnel-drawer-backdrop"></div>
    <aside id="personnelRoleDrawer" class="personnel-drawer personnel-role-drawer" aria-hidden="true">
      <div class="personnel-drawer-header">
        <div>
          <h3>Rolle aendern</h3>
          <p><strong id="personnelRoleName"></strong></p>
        </div>
        <button id="personnelRoleClose" class="personnel-close" type="button" aria-label="Schliessen">x</button>
      </div>
      <div class="personnel-drawer-body personnel-role-body">
        <div id="personnelRoleOptions" class="personnel-role-options full"></div>
        <p id="personnelRoleError" class="personnel-form-error full" role="alert"></p>
      </div>
    </aside>
  `);
  drawer = document.getElementById('personnelRoleDrawer');
  document.getElementById('personnelRoleBackdrop')?.addEventListener('click', closeRoleEditor);
  document.getElementById('personnelRoleClose')?.addEventListener('click', closeRoleEditor);
  return drawer;
}

function closeRoleEditor() {
  state.editingRoleId = null;
  document.getElementById('personnelRoleBackdrop')?.classList.remove('open');
  const drawer = document.getElementById('personnelRoleDrawer');
  drawer?.classList.remove('open');
  drawer?.setAttribute('aria-hidden', 'true');
}

async function saveRole(role) {
  if (!state.isManager || !state.client || !state.editingRoleId || !role) return;
  const drawer = document.getElementById('personnelRoleDrawer');
  const errorNode = drawer?.querySelector('#personnelRoleError');
  if (errorNode) errorNode.textContent = '';
  try {
    const { error } = await state.client
      .from('participants')
      .update({ public_role: role })
      .eq('id', state.editingRoleId);
    if (error) throw error;
    state.participants = state.participants.map(person => (
      String(person.id) === String(state.editingRoleId) ? { ...person, public_role: role } : person
    ));
    closeRoleEditor();
    renderDeployment();
  } catch (error) {
    if (errorNode) errorNode.textContent = `Speichern fehlgeschlagen: ${error.message || error}`;
  }
}

function getRoleOptions() {
  const existing = state.participants.map(person => person.public_role).filter(Boolean);
  return [...new Set([...ROLE_PRESETS, ...existing])]
    .sort((a, b) => roleRank(a) - roleRank(b) || String(a).localeCompare(String(b), 'de'));
}

function openDateEditor(participantId) {
  if (!state.isManager) return;
  const person = state.participants.find(row => String(row.id) === String(participantId));
  if (!person) return;
  state.editingParticipantId = person.id;
  const drawer = ensureDateEditor();
  drawer.querySelector('#personnelDateName').textContent = person.full_name || 'Ohne Namen';
  drawer.querySelector('#personnelDateRole').textContent = person.public_role || 'Teilnehmende';
  renderDateSlotInputs(drawer, getEditableSlots(person));
  drawer.querySelector('#personnelDateError').textContent = '';
  document.getElementById('personnelDateBackdrop')?.classList.add('open');
  drawer.classList.add('open');
  drawer.setAttribute('aria-hidden', 'false');
  drawer.querySelector('[data-slot-field="from"]')?.focus();
}

function ensureDateEditor() {
  let drawer = document.getElementById('personnelDateDrawer');
  if (drawer) return drawer;
  document.body.insertAdjacentHTML('beforeend', `
    <div id="personnelDateBackdrop" class="personnel-drawer-backdrop"></div>
    <aside id="personnelDateDrawer" class="personnel-drawer personnel-date-drawer" aria-hidden="true">
      <div class="personnel-drawer-header">
        <div>
          <h3>Teilnahmezeitraum ändern</h3>
          <p><strong id="personnelDateName"></strong><br><span id="personnelDateRole"></span></p>
        </div>
        <button id="personnelDateClose" class="personnel-close" type="button" aria-label="Schliessen">x</button>
      </div>
      <form id="personnelDateForm" class="personnel-date-form">
        <div class="personnel-drawer-body">
          <div id="personnelDateSlots" class="personnel-date-slots full"></div>
          <button id="personnelAddSlot" class="personnel-add-slot-btn full" type="button" aria-label="Weiteren Zeitraum hinzufügen">+ Weiteren Zeitraum hinzufügen</button>
          <p id="personnelDateError" class="personnel-form-error full" role="alert"></p>
        </div>
        <div class="personnel-drawer-footer">
          <button class="btn small ghost" type="button" data-personnel-date-cancel>Abbrechen</button>
          <button class="btn small" type="submit">Zeitraum speichern</button>
        </div>
      </form>
    </aside>
  `);
  drawer = document.getElementById('personnelDateDrawer');
  document.getElementById('personnelDateBackdrop')?.addEventListener('click', closeDateEditor);
  document.getElementById('personnelDateClose')?.addEventListener('click', closeDateEditor);
  drawer.querySelector('[data-personnel-date-cancel]')?.addEventListener('click', closeDateEditor);
  drawer.querySelector('#personnelAddSlot')?.addEventListener('click', addDateSlotRow);
  drawer.addEventListener('click', event => {
    const removeButton = event.target?.closest?.('[data-remove-slot]');
    if (removeButton) removeDateSlotRow(Number(removeButton.dataset.removeSlot));
  });
  drawer.querySelector('#personnelDateForm')?.addEventListener('submit', saveDateRange);
  return drawer;
}

function closeDateEditor() {
  state.editingParticipantId = null;
  document.getElementById('personnelDateBackdrop')?.classList.remove('open');
  const drawer = document.getElementById('personnelDateDrawer');
  drawer?.classList.remove('open');
  drawer?.setAttribute('aria-hidden', 'true');
}

async function saveDateRange(event) {
  event.preventDefault();
  if (!state.isManager || !state.client || !state.editingParticipantId) return;
  const drawer = document.getElementById('personnelDateDrawer');
  const errorNode = drawer?.querySelector('#personnelDateError');
  const slots = readDateSlotInputs(drawer).sort((a, b) => compareDates(a.availability_from, b.availability_from));
  if (!slots.length) {
    if (errorNode) errorNode.textContent = 'Bitte mindestens einen Zeitraum eintragen.';
    return;
  }
  const invalidSlot = slots.find(slot => !slot.availability_from || !slot.availability_to);
  if (invalidSlot) {
    if (errorNode) errorNode.textContent = 'Bitte jeden Zeitraum vollständig mit Von und Bis ausfüllen.';
    return;
  }
  if (slots.some(slot => new Date(`${slot.availability_to}T00:00:00`) < new Date(`${slot.availability_from}T00:00:00`))) {
    if (errorNode) errorNode.textContent = 'Ein Enddatum darf nicht vor dem jeweiligen Startdatum liegen.';
    return;
  }
  const submitButton = drawer?.querySelector('button[type="submit"]');
  if (submitButton) submitButton.disabled = true;
  if (errorNode) errorNode.textContent = '';
  try {
    const primarySlot = slots[0];
    const { error } = await state.client
      .from('participants')
      .update({ availability_from: primarySlot.availability_from, availability_to: primarySlot.availability_to })
      .eq('id', state.editingParticipantId);
    if (error) throw error;
    const { error: deleteError } = await state.client
      .from('participant_availability_slots')
      .delete()
      .eq('participant_id', state.editingParticipantId);
    if (deleteError) throw deleteError;
    const { data: savedSlots, error: insertError } = await state.client
      .from('participant_availability_slots')
      .insert(slots.map((slot, index) => ({
        participant_id: state.editingParticipantId,
        availability_from: slot.availability_from,
        availability_to: slot.availability_to,
        order_index: index + 1,
        created_by: state.userId
      })))
      .select('id,participant_id,availability_from,availability_to,order_index')
      .order('order_index', { ascending: true });
    if (insertError) throw insertError;
    state.participants = state.participants.map(person => (
      String(person.id) === String(state.editingParticipantId)
        ? { ...person, availability_from: primarySlot.availability_from, availability_to: primarySlot.availability_to }
        : person
    ));
    state.availabilitySlots = [
      ...state.availabilitySlots.filter(slot => String(slot.participant_id) !== String(state.editingParticipantId)),
      ...(savedSlots || [])
    ];
    closeDateEditor();
    renderDeployment();
  } catch (error) {
    if (errorNode) errorNode.textContent = `Speichern fehlgeschlagen: ${error.message || error}`;
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
}

function exportPersonnelPdf() {
  if (!state.isManager) {
    window.alert('PDF-Export mit Kontaktdaten ist nur fuer berechtigte Rollen verfuegbar.');
    return;
  }
  const rows = getFilteredParticipants();
  const printedAt = new Date().toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
  const tableRows = rows.map(person => `
    <tr>
      <td>
        <strong>${escapeHtml(person.full_name || 'Ohne Namen')}</strong>
        <span>${escapeHtml(person.public_role || 'Teilnehmende')}</span>
      </td>
      <td>${escapeHtml(privateFor(person.id).email || '-')}<br>${escapeHtml(privateFor(person.id).phone || '-')}</td>
      <td><span class="status ${barColor(person.status)}">${escapeHtml(prettyStatus(person.status))}</span></td>
      <td>${renderPrintTimeline(person)}</td>
      <td>${escapeHtml(shorten([person.availability_note, person.source_note].filter(Boolean).join(' - '), 90))}</td>
    </tr>
  `).join('');
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    window.alert('PDF-Export konnte nicht geoeffnet werden. Bitte Pop-ups fuer diese Seite erlauben.');
    return;
  }
  printWindow.document.write(`<!doctype html>
    <html lang="de">
      <head>
        <meta charset="utf-8">
        <title>Personaleinsatz Kerpen-Manheim 2026</title>
        <style>
          @page { size: A4 landscape; margin: 14mm; }
          body { font-family: Arial, sans-serif; color: #0f2740; margin: 0; }
          header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 2px solid #18324a; padding-bottom: 10px; margin-bottom: 14px; }
          h1 { margin: 0 0 5px; font-size: 21px; }
          p { margin: 0; color: #52677c; font-size: 11px; }
          table { width: 100%; border-collapse: collapse; font-size: 9.6px; }
          th { text-align: left; background: #edf3f8; color: #17324a; border: 1px solid #c9d8e5; padding: 7px; }
          td { vertical-align: top; border: 1px solid #d7e1ea; padding: 5px 6px; }
          td:first-child { width: 18%; }
          td:nth-child(2) { width: 18%; }
          td:nth-child(3) { width: 9%; }
          td:nth-child(4) { width: 37%; }
          td:nth-child(5) { width: 18%; color: #52677c; }
          td strong, td span { display: block; }
          tr:nth-child(even) td { background: #f8fbfd; }
          .meta { text-align: right; white-space: nowrap; }
          .print-timeline { position: relative; height: 18px; border: 1px solid #ccd8e4; border-radius: 999px; background: repeating-linear-gradient(to right, #f7fafc 0, #f7fafc calc(9.09% - 1px), #dce6ef calc(9.09% - 1px), #dce6ef 9.09%); overflow: hidden; }
          .print-bar { position: absolute; top: 3px; height: 12px; border-radius: 999px; }
          .print-dates { margin-top: 3px; color: #52677c; font-size: 8.5px; }
          .status { display: inline-block; border-radius: 999px; color: #fff; padding: 3px 6px; font-weight: 700; }
          .green { background: #2f855a; }
          .blue { background: #2b6cb0; }
          .orange { background: #c98216; }
          .gray { background: #687587; }
        </style>
      </head>
      <body>
        <header>
          <div>
            <h1>Personaleinsatz Kerpen-Manheim 2026</h1>
            <p>Gefilterte Ansicht aus der Web-App mit Kontaktinformationen fuer berechtigte Rollen.</p>
          </div>
          <p class="meta">Export: ${escapeHtml(printedAt)}<br>${rows.length} Personen<br>27.07.2026 - 09.10.2026</p>
        </header>
        <table>
          <thead>
            <tr><th>Person / Rolle</th><th>Kontakt</th><th>Status</th><th>Teilnahmezeitraum</th><th>Hinweis</th></tr>
          </thead>
          <tbody>${tableRows || '<tr><td colspan="5">Keine Personen fuer diese Auswahl.</td></tr>'}</tbody>
        </table>
        <script>window.addEventListener('load', () => setTimeout(() => window.print(), 150));</script>
      </body>
    </html>`);
  printWindow.document.close();
}

function renderPrintTimeline(person) {
  const ranges = getRanges(person);
  if (!ranges.length) return '<div class="print-dates">Zeitraum unklar / uneinheitlich</div>';
  return `
    <div class="print-timeline">
      ${ranges.map(range => `<div class="print-bar ${barColor(person.status)}" style="left:${range.left}%;width:${range.width}%"></div>`).join('')}
    </div>
    <div class="print-dates">${escapeHtml(formatSlotSummary(person))}</div>
  `;
}

function noteText(person) {
  const privateData = privateFor(person.id);
  return [person.availability_note, person.source_note, privateData.internal_note].filter(Boolean).join(' ');
}

function privateFor(participantId) {
  if (!state.isManager) return {};
  return state.privateRows.find(row => Number(row.participant_id) === Number(participantId)) || {};
}

function slotsFor(person) {
  const explicitSlots = state.availabilitySlots
    .filter(slot => String(slot.participant_id) === String(person.id))
    .sort((a, b) => (a.order_index ?? 999) - (b.order_index ?? 999) || compareDates(a.availability_from, b.availability_from));
  if (explicitSlots.length) return explicitSlots;
  if (person.availability_from || person.availability_to) {
    return [{
      participant_id: person.id,
      availability_from: person.availability_from,
      availability_to: person.availability_to,
      order_index: 1
    }];
  }
  return [];
}

function getEditableSlots(person) {
  const slots = slotsFor(person).map(slot => ({
    availability_from: dateInputValue(slot.availability_from),
    availability_to: dateInputValue(slot.availability_to)
  }));
  return slots.length ? slots : [{ availability_from: '', availability_to: '' }];
}

function renderDateSlotInputs(drawer, slots) {
  const container = drawer?.querySelector('#personnelDateSlots');
  if (!container) return;
  container.innerHTML = slots.map((slot, index) => `
    <div class="personnel-date-slot" data-slot-index="${index}">
      <div class="personnel-date-slot-head">
        <strong>Zeitraum ${index + 1}</strong>
        ${slots.length > 1 ? `<button class="personnel-remove-slot" type="button" data-remove-slot="${index}" aria-label="Zeitraum ${index + 1} entfernen">Entfernen</button>` : ''}
      </div>
      <label>Verfügbar von
        <input class="personnel-field" type="date" data-slot-field="from" min="2026-07-27" max="2026-10-09" value="${escapeHtml(slot.availability_from || '')}" required>
      </label>
      <label>Verfügbar bis
        <input class="personnel-field" type="date" data-slot-field="to" min="2026-07-27" max="2026-10-09" value="${escapeHtml(slot.availability_to || '')}" required>
      </label>
    </div>
  `).join('');
}

function readDateSlotInputs(drawer) {
  return [...(drawer?.querySelectorAll('.personnel-date-slot') || [])]
    .map(row => ({
      availability_from: row.querySelector('[data-slot-field="from"]')?.value || '',
      availability_to: row.querySelector('[data-slot-field="to"]')?.value || ''
    }))
    .filter(slot => slot.availability_from || slot.availability_to);
}

function addDateSlotRow() {
  const drawer = document.getElementById('personnelDateDrawer');
  const slots = readDateSlotInputs(drawer);
  slots.push({ availability_from: '', availability_to: '' });
  renderDateSlotInputs(drawer, slots);
}

function removeDateSlotRow(index) {
  const drawer = document.getElementById('personnelDateDrawer');
  const slots = readDateSlotInputs(drawer);
  if (slots.length <= 1) return;
  slots.splice(index, 1);
  renderDateSlotInputs(drawer, slots.length ? slots : [{ availability_from: '', availability_to: '' }]);
}

function hasProblem(person) {
  const text = [person.status, noteText(person)].filter(Boolean).join(' ').toLowerCase();
  return person.status === 'zu_kl\u00e4ren'
    || person.status === 'anzufragen'
    || !getRange(person).valid
    || /unklar|offen|anzufragen|final|kl\u00e4ren|klaer|uneinheitlich|kl\u00e4rungsbedarf/.test(text);
}

function getRange(person) {
  const slotRanges = slotsFor(person)
    .map(slot => ({ start: parseDate(slot.availability_from), end: parseDate(slot.availability_to) }))
    .filter(slot => slot.start && slot.end && slot.end >= slot.start);
  if (!slotRanges.length) return { valid: false, left: 0, width: 0 };
  const start = new Date(Math.min(...slotRanges.map(slot => slot.start.getTime())));
  const end = new Date(Math.max(...slotRanges.map(slot => slot.end.getTime())));
  return buildRange(start, end);
}

function getRanges(person) {
  return slotsFor(person)
    .map(slot => buildRange(parseDate(slot.availability_from), parseDate(slot.availability_to)))
    .filter(range => range.valid);
}

function buildRange(start, end) {
  const total = PROJECT_END - PROJECT_START;
  if (!start || !end || end < start || end < PROJECT_START || start > PROJECT_END) return { valid: false, left: 0, width: 0 };
  const clippedStart = new Date(Math.max(start, PROJECT_START));
  const clippedEnd = new Date(Math.min(end, PROJECT_END));
  const left = clamp(((clippedStart - PROJECT_START) / total) * 100, 0, 100);
  const width = clamp(((clippedEnd - clippedStart) / total) * 100, 4, 100 - left);
  return { valid: true, left, width };
}

function formatSlotSummary(person) {
  const slots = slotsFor(person).filter(slot => slot.availability_from || slot.availability_to);
  if (!slots.length) return 'offen';
  return slots.map(slot => `${formatDate(slot.availability_from)} - ${formatDate(slot.availability_to)}`).join(' · ');
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(String(value).slice(0, 10) + 'T00:00:00');
  return Number.isNaN(date.getTime()) ? null : date;
}

function compareDates(a, b) {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return new Date(a) - new Date(b);
}

function formatDate(value) {
  const date = parseDate(value);
  return date ? date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'offen';
}

function dateInputValue(value) {
  return value ? String(value).slice(0, 10) : '';
}

function prettyStatus(status) {
  return ({ gesetzt: 'gesetzt', zugesagt: 'zugesagt', 'zu_kl\u00e4ren': 'zu kl\u00e4ren', anzufragen: 'anzufragen' })[status] || status || '-';
}

function statusClass(status) {
  return status === 'zu_kl\u00e4ren' ? 'status-zu-klaeren' : `status-${status || 'unknown'}`;
}

function barColor(status) {
  if (status === 'gesetzt') return 'green';
  if (status === 'zugesagt') return 'blue';
  if (status === 'zu_kl\u00e4ren') return 'orange';
  return 'gray';
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function shorten(value, maxLength) {
  const text = String(value || '').trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}...` : text;
}

function renderDeploymentError(message) {
  const host = document.getElementById('personnelDeploymentView');
  if (host) host.innerHTML = `<div class="empty">Personaleinsatz konnte nicht geladen werden: ${escapeHtml(message)}</div>`;
}

function getAuthSession() {
  return window.getManheimAuthSession?.(state.client) || state.client.auth.getSession();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

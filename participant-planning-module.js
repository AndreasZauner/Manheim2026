import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const PROJECT_START = new Date('2026-07-27T00:00:00');
const PROJECT_END = new Date('2026-10-09T00:00:00');
const MANAGER_ROLES = ['admin', 'professor', 'technical_lead', 'assistant'];
const STATUS_ORDER = { gesetzt: 0, zugesagt: 1, 'zu_kl\u00e4ren': 2, anzufragen: 3 };

const state = {
  client: null,
  userId: null,
  isManager: false,
  activeSubtab: 'presence',
  participants: [],
  privateRows: [],
  search: '',
  status: 'all',
  sort: 'start',
  loading: false,
  authListenerBound: false
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
  link.href = './participant-planning-module.css?v=planning-20260501-3';
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
          <option value="start" ${state.sort === 'start' ? 'selected' : ''}>Nach Startdatum</option>
          <option value="name" ${state.sort === 'name' ? 'selected' : ''}>Alphabetisch</option>
          <option value="status" ${state.sort === 'status' ? 'selected' : ''}>Nach Status</option>
          <option value="problem" ${state.sort === 'problem' ? 'selected' : ''}>Kl\u00e4rungsbedarf zuerst</option>
        </select>
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
}

function getFilteredParticipants() {
  const query = state.search.trim().toLowerCase();
  return [...state.participants]
    .filter(person => !query || String(person.full_name || '').toLowerCase().includes(query))
    .filter(person => state.status === 'all' || person.status === state.status)
    .sort(comparePeople);
}

function comparePeople(a, b) {
  if (state.sort === 'name') return comparePeopleByName(a, b);
  if (state.sort === 'status') return (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99) || comparePeopleByName(a, b);
  if (state.sort === 'problem') return Number(hasProblem(b)) - Number(hasProblem(a)) || compareDates(a.availability_from, b.availability_from);
  return compareDates(a.availability_from, b.availability_from) || comparePeopleByName(a, b);
}

function comparePeopleByName(a, b) {
  return String(a.full_name || '').localeCompare(String(b.full_name || ''), 'de');
}

function renderDeploymentRow(person) {
  const range = getRange(person);
  const privateData = privateFor(person.id);
  const note = [person.availability_note, privateData.internal_note, person.source_note].filter(Boolean).join(' \u00b7 ');
  const timeline = range.valid
    ? `<div class="personnel-timeline"><div class="personnel-bar ${barColor(person.status)}" style="left:${range.left}%;width:${range.width}%">${formatDate(person.availability_from)} - ${formatDate(person.availability_to)}</div></div>`
    : '<div class="personnel-unclear">Zeitraum unklar / uneinheitlich</div>';
  return `
    <article class="personnel-row">
      <div class="personnel-person">
        <div class="personnel-person-top">
          <strong>${escapeHtml(person.full_name || 'Ohne Namen')}</strong>
          <span class="personnel-badge ${statusClass(person.status)}">${prettyStatus(person.status)}</span>
        </div>
        <span class="personnel-role">${escapeHtml(person.public_role || 'Teilnehmende')}</span>
        <div class="personnel-meta">
          <span class="personnel-badge outline">${formatDate(person.availability_from)} ${person.availability_to ? '- ' + formatDate(person.availability_to) : ''}</span>
          ${hasProblem(person) ? '<span class="personnel-badge warning">Kl\u00e4rungsbedarf</span>' : ''}
          ${state.isManager && privateData.email ? `<span class="personnel-badge outline">${escapeHtml(privateData.email)}</span>` : ''}
        </div>
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

function noteText(person) {
  const privateData = privateFor(person.id);
  return [person.availability_note, person.source_note, privateData.internal_note].filter(Boolean).join(' ');
}

function privateFor(participantId) {
  if (!state.isManager) return {};
  return state.privateRows.find(row => Number(row.participant_id) === Number(participantId)) || {};
}

function hasProblem(person) {
  const text = [person.status, noteText(person)].filter(Boolean).join(' ').toLowerCase();
  return person.status === 'zu_kl\u00e4ren'
    || person.status === 'anzufragen'
    || !getRange(person).valid
    || /unklar|offen|anzufragen|final|kl\u00e4ren|klaer|uneinheitlich|kl\u00e4rungsbedarf/.test(text);
}

function getRange(person) {
  const start = parseDate(person.availability_from);
  const end = parseDate(person.availability_to);
  const total = PROJECT_END - PROJECT_START;
  if (!start || !end || end < start || end < PROJECT_START || start > PROJECT_END) return { valid: false, left: 0, width: 0 };
  const clippedStart = new Date(Math.max(start, PROJECT_START));
  const clippedEnd = new Date(Math.min(end, PROJECT_END));
  const left = clamp(((clippedStart - PROJECT_START) / total) * 100, 0, 100);
  const width = clamp(((clippedEnd - clippedStart) / total) * 100, 4, 100 - left);
  return { valid: true, left, width };
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

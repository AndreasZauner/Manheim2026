import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const PROJECT_START = new Date('2026-07-27T00:00:00');
const PROJECT_END = new Date('2026-10-09T00:00:00');
const MANAGER_ROLES = ['admin', 'professor', 'technical_lead', 'assistant'];
const STATUS_ORDER = { gesetzt: 0, zugesagt: 1, 'zu_klären': 2, anzufragen: 3 };

const state = {
  client: null,
  userId: null,
  role: null,
  isManager: false,
  activeSubtab: 'presence',
  participants: [],
  privateRows: [],
  search: '',
  status: 'all',
  sort: 'start'
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', installParticipantPlanning);
} else {
  installParticipantPlanning();
}

async function installParticipantPlanning() {
  if (window.__participantPlanningInstalled) return;
  window.__participantPlanningInstalled = true;
  injectStylesheet();
  renameNavigation();
  await boot();
  installObservers();
}

function injectStylesheet() {
  if (document.querySelector('link[href^="./participant-planning-module.css"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = './participant-planning-module.css?v=planning-20260501-1';
  document.head.appendChild(link);
}

async function boot() {
  setupSupabase();
  await loadUser();
  ensurePlanningShell();
  await loadData();
  renderDeployment();
}

function setupSupabase() {
  const config = window.APP_CONFIG || {};
  if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) return;
  state.client = window.getManheimSupabaseClient
    ? window.getManheimSupabaseClient(createClient)
    : createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
}

async function loadUser() {
  if (!state.client) return;
  const { data: sessionData } = await state.client.auth.getSession();
  state.userId = sessionData?.session?.user?.id || null;
  if (!state.userId) return;
  const { data } = await state.client.from('profiles').select('role,is_active').eq('id', state.userId).single();
  state.role = data?.role || null;
  state.isManager = Boolean(data?.is_active) && MANAGER_ROLES.includes(state.role);
}

function renameNavigation() {
  document.querySelectorAll('.nav-btn[data-tab="participants"]').forEach(button => {
    button.textContent = 'Teilnehmerplanung';
    if (button.dataset.participantPlanningClickBound !== 'true') {
      button.dataset.participantPlanningClickBound = 'true';
      button.addEventListener('click', () => window.setTimeout(renameNavigation, 0));
    }
  });
  const title = document.getElementById('pageTitle');
  const subtitle = document.getElementById('pageSubtitle');
  const active = document.querySelector('.nav-btn[data-tab="participants"]')?.classList.contains('active');
  if (active && title && subtitle) {
    title.textContent = 'Teilnehmerplanung';
    subtitle.textContent = 'Anwesenheit, Verfügbarkeiten und Personaleinsatz';
  }
}

function ensurePlanningShell() {
  const tab = document.getElementById('participantsTab');
  if (!tab || document.getElementById('participantPlanningTabs')) return;
  const sectionHead = tab.querySelector('.section-head');
  if (!sectionHead) return;
  sectionHead.querySelector('h3')?.replaceChildren(document.createTextNode('Teilnehmerplanung'));
  sectionHead.querySelector('p')?.replaceChildren(document.createTextNode('Anwesenheit, Teilnehmendenliste und Personaleinsatz im Grabungszeitraum.'));

  sectionHead.insertAdjacentHTML('afterend', `
    <div id="participantPlanningTabs" class="participant-planning-tabs" role="tablist" aria-label="Teilnehmerplanung">
      <button type="button" class="btn small participant-planning-tab active" data-planning-tab="presence">Anwesenheit & Liste</button>
      <button type="button" class="btn small participant-planning-tab" data-planning-tab="deployment">Personaleinsatz</button>
    </div>
  `);
  const presenceWrapper = document.createElement('div');
  presenceWrapper.id = 'participantPresenceView';
  const nodesToMove = [];
  for (const child of [...tab.children]) {
    if (child === sectionHead || child.id === 'participantPlanningTabs') continue;
    nodesToMove.push(child);
  }
  nodesToMove.forEach(node => presenceWrapper.appendChild(node));
  tab.appendChild(presenceWrapper);
  tab.insertAdjacentHTML('beforeend', '<section id="personnelDeploymentView" class="personnel-deployment-view hidden"></section>');

  document.querySelectorAll('.participant-planning-tab').forEach(button => {
    button.addEventListener('click', () => {
      state.activeSubtab = button.dataset.planningTab;
      syncSubtabs();
    });
  });
  syncSubtabs();
}

function syncSubtabs() {
  renameNavigation();
  document.querySelectorAll('.participant-planning-tab').forEach(button => {
    button.classList.toggle('active', button.dataset.planningTab === state.activeSubtab);
  });
  document.getElementById('participantPresenceView')?.classList.toggle('hidden', state.activeSubtab !== 'presence');
  document.getElementById('personnelDeploymentView')?.classList.toggle('hidden', state.activeSubtab !== 'deployment');
}

function installObservers() {
  const observer = new MutationObserver(() => {
    renameNavigation();
    if (!document.getElementById('participantPlanningTabs')) ensurePlanningShell();
  });
  observer.observe(document.body, { childList: true, subtree: true });
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
  if (participantsResult.error) {
    renderDeploymentError(participantsResult.error.message);
    return;
  }
  state.participants = participantsResult.data || [];
  state.privateRows = privateResult.data || [];
}

function renderDeployment() {
  const host = document.getElementById('personnelDeploymentView');
  if (!host) return;
  const list = getFilteredParticipants();
  host.innerHTML = `
    <section class="personnel-hero">
      <div>
        <div class="personnel-eyebrow">Teilnehmerplanung</div>
        <h3>Personaleinsatz</h3>
        <p>Zeiträume, Status und Hinweise im Überblick. Die Balken basieren auf den echten Supabase-Teilnehmerdaten.</p>
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
          <option value="zu_klären" ${state.status === 'zu_klären' ? 'selected' : ''}>zu klären</option>
          <option value="anzufragen" ${state.status === 'anzufragen' ? 'selected' : ''}>anzufragen</option>
        </select>
        <select id="personnelSortBy" class="personnel-select">
          <option value="start" ${state.sort === 'start' ? 'selected' : ''}>Nach Startdatum</option>
          <option value="name" ${state.sort === 'name' ? 'selected' : ''}>Alphabetisch</option>
          <option value="status" ${state.sort === 'status' ? 'selected' : ''}>Nach Status</option>
          <option value="problem" ${state.sort === 'problem' ? 'selected' : ''}>Klärungsbedarf zuerst</option>
        </select>
        ${state.isManager ? '<button class="btn primary" type="button" id="openPersonnelDrawer">Neue Person</button>' : ''}
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
          <div class="personnel-scale">
            <span>27.07.</span><span>01.08.</span><span>10.08.</span><span>20.08.</span><span>31.08.</span><span>10.09.</span><span>20.09.</span><span>30.09.</span><span>05.10.</span><span>09.10.</span><span>Ende</span>
          </div>
        </div>
      </div>
      <div class="personnel-rows">${list.length ? list.map(renderDeploymentRow).join('') : '<div class="personnel-empty">Keine Personen für diese Auswahl gefunden.</div>'}</div>
      <div class="personnel-legend">
        <span><i class="personnel-swatch green"></i>gesetzt</span>
        <span><i class="personnel-swatch blue"></i>zugesagt</span>
        <span><i class="personnel-swatch orange"></i>zu klären</span>
        <span><i class="personnel-swatch gray"></i>anzufragen</span>
      </div>
    </section>
    ${state.isManager ? drawerMarkup() : ''}
  `;
  bindDeploymentUi();
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
  document.getElementById('openPersonnelDrawer')?.addEventListener('click', openDrawer);
  document.getElementById('closePersonnelDrawer')?.addEventListener('click', closeDrawer);
  document.getElementById('cancelPersonnelDrawer')?.addEventListener('click', closeDrawer);
  document.getElementById('personnelDrawerBackdrop')?.addEventListener('click', closeDrawer);
  document.getElementById('personnelForm')?.addEventListener('submit', savePerson);
}

function getFilteredParticipants() {
  const query = state.search.trim().toLowerCase();
  return [...state.participants]
    .filter(person => !query || String(person.full_name || '').toLowerCase().includes(query))
    .filter(person => state.status === 'all' || person.status === state.status)
    .sort(comparePeople);
}

function comparePeople(a, b) {
  if (state.sort === 'name') return String(a.full_name || '').localeCompare(String(b.full_name || ''), 'de');
  if (state.sort === 'status') return (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99) || comparePeopleByName(a, b);
  if (state.sort === 'problem') return Number(hasProblem(b)) - Number(hasProblem(a)) || compareDates(a.availability_from, b.availability_from);
  return compareDates(a.availability_from, b.availability_from) || comparePeopleByName(a, b);
}

function comparePeopleByName(a, b) {
  return String(a.full_name || '').localeCompare(String(b.full_name || ''), 'de');
}

function renderDeploymentRow(person) {
  const privateData = privateFor(person.id);
  const range = getRange(person);
  const status = statusClass(person.status);
  const note = [person.availability_note, privateData.internal_note, person.source_note].filter(Boolean).join(' · ');
  const timeline = range.valid
    ? `<div class="personnel-timeline"><div class="personnel-bar ${barColor(person.status)}" style="left:${range.left}%;width:${range.width}%">${formatDate(person.availability_from)} - ${formatDate(person.availability_to)}</div></div>`
    : '<div class="personnel-unclear">Zeitraum unklar / uneinheitlich</div>';
  return `
    <article class="personnel-row">
      <div class="personnel-person">
        <div class="personnel-person-top">
          <strong>${escapeHtml(person.full_name || 'Ohne Namen')}</strong>
          <span class="personnel-badge ${status}">${prettyStatus(person.status)}</span>
        </div>
        <span class="personnel-role">${escapeHtml(person.public_role || 'Teilnehmende')}</span>
        <div class="personnel-meta">
          <span class="personnel-badge outline">${formatDate(person.availability_from)} ${person.availability_to ? '- ' + formatDate(person.availability_to) : ''}</span>
          ${hasProblem(person) ? '<span class="personnel-badge warning">Klärungsbedarf</span>' : ''}
          ${privateData.email ? `<span class="personnel-badge outline">${escapeHtml(privateData.email)}</span>` : ''}
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
  const finalConfirmed = list.filter(person => getRange(person).valid && !hasProblem(person) && !['anzufragen', 'zu_klären'].includes(person.status)).length;
  const expandable = list.filter(person => /auch|evtl|eventuell|möglich|verlänger|zusatzwoche|flexibel|spätere termine/i.test([person.availability_note, person.source_note, privateFor(person.id).internal_note].filter(Boolean).join(' '))).length;
  const clarificationNeeded = list.filter(hasProblem).length;
  const withNote = list.filter(person => Boolean(person.availability_note || person.source_note || privateFor(person.id).internal_note)).length;
  return [
    ['Gesamt', list.length],
    ['Final bestätigt', finalConfirmed],
    ['Erweiterbar', expandable],
    ['Klärungsbedarf', clarificationNeeded],
    ['Mit Anmerkung', withNote]
  ].map(([label, value]) => `<div class="personnel-stat"><span>${label}</span><strong>${value}</strong></div>`).join('');
}

function drawerMarkup() {
  return `
    <div class="personnel-drawer-backdrop" id="personnelDrawerBackdrop"></div>
    <aside class="personnel-drawer" id="personnelDrawer">
      <div class="personnel-drawer-header">
        <div><h3>Neue Person anlegen</h3><p>Kompakte Seiteneingabe mit allen wesentlichen Angaben.</p></div>
        <button class="personnel-close" id="closePersonnelDrawer" type="button">×</button>
      </div>
      <form id="personnelForm" class="personnel-drawer-body">
        <label class="full">Name<input class="personnel-field" name="full_name" required></label>
        <label class="full">Rolle<input class="personnel-field" name="public_role" placeholder="z. B. Teilnehmende, Assistenz, Spezialbereich"></label>
        <label>Status<select class="personnel-field" name="status"><option value="zugesagt">zugesagt</option><option value="gesetzt">gesetzt</option><option value="zu_klären">zu klären</option><option value="anzufragen">anzufragen</option></select></label>
        <label>Klärungsbedarf<select class="personnel-field" name="problem"><option value="false">nein</option><option value="true">ja</option></select></label>
        <label>Verfügbar von<input class="personnel-field" name="availability_from" type="date"></label>
        <label>Verfügbar bis<input class="personnel-field" name="availability_to" type="date"></label>
        <label>Telefon<input class="personnel-field" name="phone" placeholder="optional"></label>
        <label>E-Mail<input class="personnel-field" name="email" type="email" placeholder="optional"></label>
        <label class="full">Öffentliche Bemerkung<textarea class="personnel-field area" name="availability_note"></textarea></label>
        <label class="full">Interne Notiz<textarea class="personnel-field area" name="internal_note"></textarea></label>
        <div class="personnel-drawer-footer full">
          <button class="btn" type="button" id="cancelPersonnelDrawer">Abbrechen</button>
          <button class="btn primary" type="submit">Person speichern</button>
        </div>
      </form>
    </aside>
  `;
}

async function savePerson(event) {
  event.preventDefault();
  if (!state.isManager) return;
  const form = new FormData(event.currentTarget);
  const note = String(form.get('availability_note') || '').trim();
  const hasProblemFlag = form.get('problem') === 'true';
  const participantPayload = {
    full_name: String(form.get('full_name') || '').trim(),
    public_role: String(form.get('public_role') || '').trim() || 'Teilnehmende',
    status: String(form.get('status') || 'zugesagt'),
    availability_from: String(form.get('availability_from') || '').trim() || null,
    availability_to: String(form.get('availability_to') || '').trim() || null,
    availability_note: [note, hasProblemFlag && !/klärungsbedarf/i.test(note) ? 'Klärungsbedarf' : ''].filter(Boolean).join(' · ') || null,
    source_note: 'Manuell in der Teilnehmerplanung angelegt.',
    created_by: state.userId
  };
  const { data, error } = await state.client.from('participants').insert(participantPayload).select('id').single();
  if (error) return alert('Person konnte nicht gespeichert werden: ' + error.message);
  const privatePayload = {
    participant_id: data.id,
    phone: String(form.get('phone') || '').trim() || null,
    email: String(form.get('email') || '').trim() || null,
    internal_note: String(form.get('internal_note') || '').trim() || null
  };
  const { error: privateError } = await state.client.from('participant_private').insert(privatePayload);
  if (privateError) return alert('Kontaktdaten konnten nicht gespeichert werden: ' + privateError.message);
  closeDrawer();
  await loadData();
  renderDeployment();
  document.getElementById('refreshButton')?.click();
}

function openDrawer() {
  document.getElementById('personnelDrawer')?.classList.add('open');
  document.getElementById('personnelDrawerBackdrop')?.classList.add('open');
  document.querySelector('#personnelForm [name="full_name"]')?.focus();
}

function closeDrawer() {
  document.getElementById('personnelDrawer')?.classList.remove('open');
  document.getElementById('personnelDrawerBackdrop')?.classList.remove('open');
}

function renderDeploymentError(message) {
  const host = document.getElementById('personnelDeploymentView');
  if (host) host.innerHTML = `<div class="empty">Personaleinsatz konnte nicht geladen werden: ${escapeHtml(message)}</div>`;
}

function privateFor(participantId) {
  return state.privateRows.find(row => Number(row.participant_id) === Number(participantId)) || {};
}

function hasProblem(person) {
  const text = [person.status, person.availability_note, person.source_note, privateFor(person.id).internal_note].filter(Boolean).join(' ').toLowerCase();
  return person.status === 'zu_klären'
    || person.status === 'anzufragen'
    || !getRange(person).valid
    || /unklar|offen|anzufragen|final|klären|klaer|uneinheitlich|klärungsbedarf/.test(text);
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
  return ({ gesetzt: 'gesetzt', zugesagt: 'zugesagt', 'zu_klären': 'zu klären', anzufragen: 'anzufragen' })[status] || status || '–';
}

function statusClass(status) {
  return status === 'zu_klären' ? 'status-zu-klaeren' : `status-${status || 'unknown'}`;
}

function barColor(status) {
  if (status === 'gesetzt') return 'green';
  if (status === 'zugesagt') return 'blue';
  if (status === 'zu_klären') return 'orange';
  return 'gray';
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function shorten(value, maxLength) {
  const text = String(value || '').trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}...` : text;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

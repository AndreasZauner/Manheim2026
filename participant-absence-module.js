import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const PROJECT_START = new Date('2026-07-27T00:00:00');
const PROJECT_END = new Date('2026-10-09T00:00:00');
const MANAGER_ROLES = ['admin', 'professor', 'technical_lead', 'assistant'];

const state = {
  client: null,
  userId: null,
  isManager: false,
  participants: [],
  availabilitySlots: [],
  absences: [],
  activeParticipantId: null,
  domSignature: '',
  renderTimer: null
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', installAbsenceModule);
} else {
  installAbsenceModule();
}

function installAbsenceModule() {
  if (window.__participantAbsenceModuleInstalled) return;
  window.__participantAbsenceModuleInstalled = true;
  injectStyles();
  setupSupabase();
  bindAuth();
  observePersonnel();
  hideDailyAttendancePanel();
  scheduleEnhance(400);
  scheduleEnhance(1300);
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
      state.absences = [];
      closeDrawer();
      scheduleEnhance(100);
      return;
    }
    if (['SIGNED_IN', 'TOKEN_REFRESHED', 'USER_UPDATED', 'INITIAL_SESSION'].includes(event)) {
      scheduleEnhance(600);
    }
  });
}

function observePersonnel() {
  const observer = new MutationObserver(() => {
    hideDailyAttendancePanel();
    const signature = currentPersonnelSignature();
    if (signature && signature !== state.domSignature) {
      state.domSignature = signature;
      scheduleEnhance(120);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener('click', event => {
    if (event.target?.closest?.('.participant-planning-tab, .nav-btn[data-tab="participants"], #refreshButton')) {
      scheduleEnhance(250);
    }
  });
}

function currentPersonnelSignature() {
  const ids = [...document.querySelectorAll('#personnelDeploymentView .personnel-date-edit-btn[data-id]')]
    .map(button => button.dataset.id)
    .join('|');
  const hasAttendancePanel = document.getElementById('attendancePanel') ? 'attendance' : '';
  return `${ids}:${hasAttendancePanel}`;
}

function scheduleEnhance(delay = 0) {
  window.clearTimeout(state.renderTimer);
  state.renderTimer = window.setTimeout(enhanceAbsenceUi, delay);
}

async function enhanceAbsenceUi() {
  hideDailyAttendancePanel();
  if (!state.client) return;
  await loadManagerState();
  await loadPlanningData();
  addAbsenceButtons();
  renderAbsenceOverlays();
}

function hideDailyAttendancePanel() {
  const panel = document.getElementById('attendancePanel');
  if (panel) panel.remove();
}

async function loadManagerState() {
  const { data: sessionData, error: sessionError } = await getAuthSession();
  if (sessionError) {
    console.warn('Ausfall-Modul: Session konnte nicht geladen werden', sessionError);
    return;
  }
  state.userId = sessionData?.session?.user?.id || null;
  state.isManager = false;
  if (!state.userId) return;
  const { data, error } = await state.client.from('profiles').select('role,is_active').eq('id', state.userId).single();
  if (error) {
    console.warn('Ausfall-Modul: Rolle konnte nicht geladen werden', error);
    return;
  }
  state.isManager = Boolean(data?.is_active) && MANAGER_ROLES.includes(data?.role);
}

async function loadPlanningData() {
  if (!state.userId) return;
  const [participantsResult, slotsResult, absencesResult] = await Promise.all([
    state.client
      .from('participants')
      .select('id,full_name,public_role,availability_from,availability_to,status')
      .order('full_name'),
    state.client
      .from('participant_availability_slots')
      .select('id,participant_id,availability_from,availability_to,order_index')
      .order('order_index', { ascending: true }),
    state.client
      .from('participant_absences')
      .select('id,participant_id,absence_from,absence_to,reason_type,reason_note')
      .order('absence_from', { ascending: true })
  ]);

  if (participantsResult.error) console.warn('Ausfall-Modul: Teilnehmende konnten nicht geladen werden', participantsResult.error);
  if (slotsResult.error) console.warn('Ausfall-Modul: Zusatzzeitraeume konnten nicht geladen werden', slotsResult.error);
  if (absencesResult.error) {
    console.warn('Ausfall-Modul: Ausfaelle konnten nicht geladen werden. Wurde supabase/participant_absences.sql ausgefuehrt?', absencesResult.error);
  }
  state.participants = participantsResult.data || [];
  state.availabilitySlots = slotsResult.data || [];
  state.absences = absencesResult.data || [];
}

function addAbsenceButtons() {
  document.querySelectorAll('#personnelDeploymentView .personnel-row').forEach(row => {
    const actions = row.querySelector('.personnel-actions');
    const dateButton = row.querySelector('.personnel-date-edit-btn[data-id]');
    const participantId = dateButton?.dataset.id;
    if (!actions || !participantId || actions.querySelector('.personnel-absence-btn')) return;
    if (!state.isManager) return;
    const button = document.createElement('button');
    button.className = 'btn small personnel-absence-btn';
    button.type = 'button';
    button.dataset.id = participantId;
    button.textContent = 'Ausfall';
    button.addEventListener('click', () => openDrawer(participantId));
    actions.appendChild(button);
  });
}

function renderAbsenceOverlays() {
  document.querySelectorAll('#personnelDeploymentView .personnel-row').forEach(row => {
    row.querySelectorAll('.personnel-absence-segment').forEach(node => node.remove());
    const idNode = row.querySelector('.personnel-date-edit-btn[data-id], .personnel-role-edit-btn[data-id], .personnel-status-edit-btn[data-id]');
    const participantId = Number(idNode?.dataset.id);
    if (!participantId) return;
    const timeline = row.querySelector('.personnel-timeline');
    if (!timeline) return;
    const person = state.participants.find(item => Number(item.id) === participantId);
    const absences = state.absences.filter(item => Number(item.participant_id) === participantId);
    if (!person || !absences.length) return;
    absences.flatMap(absence => clippedAbsenceRanges(person, absence)).forEach(range => {
      const segment = document.createElement('div');
      segment.className = 'personnel-absence-segment';
      segment.style.left = `${range.left}%`;
      segment.style.width = `${range.width}%`;
      segment.title = range.title;
      timeline.appendChild(segment);
    });
  });
}

function clippedAbsenceRanges(person, absence) {
  const absenceStart = parseDate(absence.absence_from);
  const absenceEnd = parseDate(absence.absence_to);
  if (!absenceStart || !absenceEnd || absenceEnd < absenceStart) return [];
  return slotsFor(person).map(slot => {
    const slotStart = parseDate(slot.availability_from);
    const slotEnd = parseDate(slot.availability_to);
    if (!slotStart || !slotEnd) return null;
    const start = new Date(Math.max(absenceStart, slotStart, PROJECT_START));
    const end = new Date(Math.min(absenceEnd, slotEnd, PROJECT_END));
    if (end < start) return null;
    const range = buildRange(start, end);
    return range.valid ? {
      ...range,
      title: `${absenceLabel(absence)}: ${formatDate(absence.absence_from)} - ${formatDate(absence.absence_to)}`
    } : null;
  }).filter(Boolean);
}

function openDrawer(participantId) {
  if (!state.isManager) return;
  state.activeParticipantId = Number(participantId);
  const drawer = ensureDrawer();
  const person = state.participants.find(item => Number(item.id) === Number(participantId));
  drawer.querySelector('#absencePersonName').textContent = person?.full_name || 'Ohne Namen';
  drawer.querySelector('#absenceForm').reset();
  drawer.querySelector('#absenceReasonNoteWrap').classList.add('hidden');
  setError('');
  renderExistingAbsences();
  showDrawer();
}

function ensureDrawer() {
  let drawer = document.getElementById('participantAbsenceDrawer');
  if (drawer) return drawer;
  document.body.insertAdjacentHTML('beforeend', `
    <div id="participantAbsenceBackdrop" class="participant-absence-backdrop"></div>
    <aside id="participantAbsenceDrawer" class="participant-absence-drawer" aria-hidden="true">
      <div class="participant-absence-head">
        <div>
          <h3>Ausfall erfassen</h3>
          <p id="absencePersonName">-</p>
        </div>
        <button id="participantAbsenceClose" type="button" aria-label="Schliessen">x</button>
      </div>
      <form id="absenceForm" class="participant-absence-form">
        <label>Von
          <input name="absence_from" type="date" min="2026-07-27" max="2026-10-09" required>
        </label>
        <label>Bis
          <input name="absence_to" type="date" min="2026-07-27" max="2026-10-09" required>
        </label>
        <label>Grund
          <select name="reason_type" required>
            <option value="krank">Krank</option>
            <option value="anderer_grund">Anderer Grund</option>
          </select>
        </label>
        <label id="absenceReasonNoteWrap" class="hidden">Grund notieren
          <textarea name="reason_note" rows="3" placeholder="Kurze Begruendung"></textarea>
        </label>
        <p id="absenceError" class="participant-absence-error" role="alert"></p>
        <div class="participant-absence-footer">
          <button class="btn small ghost" type="button" data-absence-cancel>Abbrechen</button>
          <button class="btn small" type="submit">Speichern</button>
        </div>
      </form>
      <section class="participant-absence-existing">
        <h4>Gespeicherte Ausfaelle</h4>
        <div id="absenceExistingList"></div>
      </section>
    </aside>
  `);
  drawer = document.getElementById('participantAbsenceDrawer');
  document.getElementById('participantAbsenceBackdrop')?.addEventListener('click', closeDrawer);
  document.getElementById('participantAbsenceClose')?.addEventListener('click', closeDrawer);
  drawer.querySelector('[data-absence-cancel]')?.addEventListener('click', closeDrawer);
  drawer.querySelector('[name="reason_type"]')?.addEventListener('change', event => {
    drawer.querySelector('#absenceReasonNoteWrap')?.classList.toggle('hidden', event.target.value !== 'anderer_grund');
  });
  drawer.querySelector('#absenceForm')?.addEventListener('submit', saveAbsence);
  return drawer;
}

async function saveAbsence(event) {
  event.preventDefault();
  if (!state.activeParticipantId || !state.client) return;
  const form = event.currentTarget;
  const formData = new FormData(form);
  const from = String(formData.get('absence_from') || '');
  const to = String(formData.get('absence_to') || '');
  const reasonType = String(formData.get('reason_type') || 'krank');
  const reasonNote = String(formData.get('reason_note') || '').trim();
  const person = state.participants.find(item => Number(item.id) === Number(state.activeParticipantId));
  const validationError = validateAbsence(person, from, to, reasonType, reasonNote);
  if (validationError) {
    setError(validationError);
    return;
  }
  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true;
  setError('');
  try {
    const { data, error } = await state.client
      .from('participant_absences')
      .insert({
        participant_id: state.activeParticipantId,
        absence_from: from,
        absence_to: to,
        reason_type: reasonType,
        reason_note: reasonType === 'anderer_grund' ? reasonNote : null,
        created_by: state.userId
      })
      .select('id,participant_id,absence_from,absence_to,reason_type,reason_note')
      .single();
    if (error) throw error;
    state.absences.push(data);
    form.reset();
    form.querySelector('#absenceReasonNoteWrap')?.classList.add('hidden');
    renderExistingAbsences();
    renderAbsenceOverlays();
  } catch (error) {
    setError(`Speichern fehlgeschlagen: ${error.message || error}`);
  } finally {
    submit.disabled = false;
  }
}

function validateAbsence(person, from, to, reasonType, reasonNote) {
  const start = parseDate(from);
  const end = parseDate(to);
  if (!person) return 'Person konnte nicht gefunden werden.';
  if (!start || !end) return 'Bitte Von und Bis eintragen.';
  if (end < start) return 'Das Bis-Datum darf nicht vor dem Von-Datum liegen.';
  if (reasonType === 'anderer_grund' && !reasonNote) return 'Bitte den anderen Grund kurz eintragen.';
  const withinSlot = slotsFor(person).some(slot => {
    const slotStart = parseDate(slot.availability_from);
    const slotEnd = parseDate(slot.availability_to);
    return slotStart && slotEnd && start >= slotStart && end <= slotEnd;
  });
  return withinSlot ? '' : 'Der Ausfall muss vollstaendig innerhalb eines eingetragenen Teilnahmezeitraums liegen.';
}

function renderExistingAbsences() {
  const list = document.getElementById('absenceExistingList');
  if (!list) return;
  const items = state.absences.filter(item => Number(item.participant_id) === Number(state.activeParticipantId));
  if (!items.length) {
    list.innerHTML = '<div class="participant-absence-empty">Noch keine Ausfaelle gespeichert.</div>';
    return;
  }
  list.innerHTML = items.map(item => `
    <div class="participant-absence-item">
      <strong>${escapeHtml(formatDate(item.absence_from))} - ${escapeHtml(formatDate(item.absence_to))}</strong>
      <span>${escapeHtml(absenceLabel(item))}</span>
    </div>
  `).join('');
}

function slotsFor(person) {
  const explicitSlots = state.availabilitySlots
    .filter(slot => Number(slot.participant_id) === Number(person.id))
    .sort((a, b) => (a.order_index ?? 999) - (b.order_index ?? 999));
  if (explicitSlots.length) return explicitSlots;
  if (person.availability_from || person.availability_to) {
    return [{ availability_from: person.availability_from, availability_to: person.availability_to }];
  }
  return [];
}

function buildRange(start, end) {
  const total = PROJECT_END - PROJECT_START;
  if (!start || !end || end < start || end < PROJECT_START || start > PROJECT_END) return { valid: false, left: 0, width: 0 };
  const clippedStart = new Date(Math.max(start, PROJECT_START));
  const clippedEnd = new Date(Math.min(end, PROJECT_END));
  const left = clamp(((clippedStart - PROJECT_START) / total) * 100, 0, 100);
  const width = clamp(((clippedEnd - clippedStart) / total) * 100, 1.4, 100 - left);
  return { valid: true, left, width };
}

function absenceLabel(absence) {
  if (absence.reason_type === 'krank') return 'Krank';
  return absence.reason_note ? `Anderer Grund: ${absence.reason_note}` : 'Anderer Grund';
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(String(value).slice(0, 10) + 'T00:00:00');
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value) {
  const date = parseDate(value);
  return date ? date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'offen';
}

function showDrawer() {
  document.getElementById('participantAbsenceBackdrop')?.classList.add('open');
  document.getElementById('participantAbsenceDrawer')?.classList.add('open');
  document.getElementById('participantAbsenceDrawer')?.setAttribute('aria-hidden', 'false');
}

function closeDrawer() {
  state.activeParticipantId = null;
  document.getElementById('participantAbsenceBackdrop')?.classList.remove('open');
  document.getElementById('participantAbsenceDrawer')?.classList.remove('open');
  document.getElementById('participantAbsenceDrawer')?.setAttribute('aria-hidden', 'true');
}

function setError(message) {
  const node = document.getElementById('absenceError');
  if (node) node.textContent = message;
}

function getAuthSession() {
  return window.getManheimAuthSession?.(state.client) || state.client.auth.getSession();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function injectStyles() {
  if (document.getElementById('participantAbsenceStyles')) return;
  const style = document.createElement('style');
  style.id = 'participantAbsenceStyles';
  style.textContent = `
    #attendancePanel { display: none !important; }
    .personnel-absence-btn { background: #fff5f5; border-color: #f2b8b5; color: #b42318; }
    .personnel-absence-btn:hover, .personnel-absence-btn:focus-visible { background: #fee4e2; border-color: #e53e3e; }
    .personnel-absence-segment { position: absolute; top: 4px; height: 18px; border-radius: 999px; background: linear-gradient(90deg, #b42318, #e53e3e); z-index: 5; box-shadow: 0 0 0 1px rgba(255,255,255,.46) inset; pointer-events: auto; }
    .participant-absence-backdrop { position: fixed; inset: 0; display: none; background: rgba(10,20,30,.28); z-index: 82; }
    .participant-absence-backdrop.open { display: block; }
    .participant-absence-drawer { position: fixed; top: 0; right: 0; z-index: 92; width: min(460px, 100vw); height: 100vh; background: #fff; box-shadow: -8px 0 30px rgba(0,0,0,.14); transform: translateX(100%); transition: transform .2s ease; display: flex; flex-direction: column; }
    .participant-absence-drawer.open { transform: translateX(0); }
    .participant-absence-head { display: flex; justify-content: space-between; gap: 12px; padding: 18px 20px; border-bottom: 1px solid var(--border); }
    .participant-absence-head h3 { margin: 0 0 4px; }
    .participant-absence-head p { margin: 0; color: var(--muted); font-size: .86rem; font-weight: 800; }
    #participantAbsenceClose { border: 0; background: #f4f7fa; color: var(--text); width: 36px; height: 36px; border-radius: 10px; font-size: 1.1rem; cursor: pointer; }
    .participant-absence-form { display: grid; gap: 12px; padding: 18px 20px; border-bottom: 1px solid var(--border); }
    .participant-absence-form label { display: grid; gap: 6px; color: #355066; font-size: .75rem; font-weight: 900; text-transform: uppercase; letter-spacing: .04em; }
    .participant-absence-form input, .participant-absence-form select, .participant-absence-form textarea { border: 1px solid var(--border); border-radius: 12px; padding: 10px 12px; font: inherit; color: var(--text); background: #fff; }
    .participant-absence-form .hidden { display: none; }
    .participant-absence-error { margin: 0; min-height: 18px; color: #b42318; font-size: .84rem; font-weight: 800; }
    .participant-absence-footer { display: flex; justify-content: space-between; gap: 10px; }
    .participant-absence-existing { padding: 16px 20px 20px; overflow: auto; }
    .participant-absence-existing h4 { margin: 0 0 10px; }
    .participant-absence-item, .participant-absence-empty { border: 1px solid var(--border); border-radius: 12px; padding: 10px 12px; margin-bottom: 8px; background: #fbfdff; }
    .participant-absence-item strong, .participant-absence-item span { display: block; }
    .participant-absence-item span, .participant-absence-empty { color: var(--muted); font-size: .84rem; }
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

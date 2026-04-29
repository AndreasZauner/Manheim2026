import './participant-timeline-module.js?v=timeline-20260429-1';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const EDIT_ROLES = ['admin', 'technical_lead', 'assistant'];
const PRESENT_STATUSES = ['anwesend', 'verspaetet', 'halbtags'];
const STATUS_OPTIONS = [
  ['unklar', 'unklar'],
  ['anwesend', 'anwesend'],
  ['abgesagt', 'abgesagt'],
  ['krank', 'krank'],
  ['sonstiger_ausfall', 'sonstiger Ausfall'],
  ['verspaetet', 'verspaetet'],
  ['halbtags', 'nur halbtags']
];

const state = {
  client: null,
  userId: null,
  role: null,
  todayIso: '',
  participants: [],
  attendance: []
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', installAttendanceModule);
} else {
  installAttendanceModule();
}

async function installAttendanceModule() {
  if (window.__dailyAttendanceModuleInstalled) return;
  window.__dailyAttendanceModuleInstalled = true;

  injectStylesheet();
  renderSidebarShell();
  strengthenSignOutButton();
  injectAttendancePanel();
  await loadAttendanceData();
}

function injectStylesheet() {
  if (document.querySelector('link[href^="./attendance-module.css"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = './attendance-module.css?v=attendance-20260429-1';
  document.head.appendChild(link);
}

function renderSidebarShell() {
  const meta = document.querySelector('.sidebar-meta');
  if (!meta) return;
  meta.innerHTML = `
    <section id="dailyStatusBox" class="daily-status-box" aria-live="polite">
      <div class="daily-status-head">
        <h2>Tagesstatus</h2>
        <span class="daily-status-dot"></span>
      </div>
      <div class="daily-status-date">${formatGermanDate(new Date())}</div>
      <div class="daily-status-loading">Lade Tagesdaten ...</div>
    </section>
  `;
}

function strengthenSignOutButton() {
  const signOutButton = document.getElementById('signOutButton');
  if (signOutButton) signOutButton.classList.add('signout-strong');
}

function injectAttendancePanel() {
  const tab = document.getElementById('participantsTab');
  const sectionHead = tab?.querySelector('.section-head');
  if (!tab || !sectionHead || document.getElementById('attendancePanel')) return;

  sectionHead.insertAdjacentHTML('afterend', `
    <section id="attendancePanel" class="panel attendance-panel">
      <div class="panel-head">
        <div>
          <h3>Heutige Anwesenheit</h3>
          <p class="muted">Tagesstatus fuer reale Anwesenheit und kurzfristige Ausfaelle.</p>
        </div>
        <span id="attendanceEditHint" class="attendance-edit-hint">Lade Daten ...</span>
      </div>
      <div id="attendanceTodaySummary" class="attendance-summary"></div>
      <div id="attendanceRows" class="attendance-rows"></div>
    </section>
  `);
}

async function loadAttendanceData() {
  const config = window.APP_CONFIG;
  if (!config?.SUPABASE_URL || !config?.SUPABASE_ANON_KEY) {
    renderSidebarError('Supabase-Konfiguration fehlt.');
    return;
  }

  state.todayIso = getLocalIsoDate();
  state.client = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  try {
    const { data: sessionData, error: sessionError } = await state.client.auth.getSession();
    if (sessionError) throw sessionError;
    state.userId = sessionData?.session?.user?.id || null;
    if (!state.userId) {
      renderSidebarError('Nicht angemeldet.');
      return;
    }

    const [{ data: profile, error: profileError }, participantsResult, attendanceResult] = await Promise.all([
      state.client.from('profiles').select('role,is_active').eq('id', state.userId).single(),
      state.client.from('participants').select('id,full_name,public_role,availability_from,availability_to,status').order('full_name'),
      state.client.from('daily_attendance').select('id,participant_id,date,status,note').eq('date', state.todayIso)
    ]);

    if (profileError) throw profileError;
    if (participantsResult.error) throw participantsResult.error;
    if (attendanceResult.error) throw attendanceResult.error;

    state.role = profile?.role || null;
    state.participants = participantsResult.data || [];
    state.attendance = attendanceResult.data || [];
    renderAll();
  } catch (error) {
    renderSidebarError(error?.message || String(error));
    renderAttendancePanelError(error?.message || String(error));
  }
}

function renderAll() {
  renderSidebarStatus();
  renderAttendancePanel();
}

function renderSidebarStatus() {
  const box = document.getElementById('dailyStatusBox');
  if (!box) return;

  const stats = calculateStats();
  const unclearText = stats.unclear > 0
    ? `<div class="daily-status-warning">${stats.unclear} heute ungeklart</div>`
    : '';

  box.innerHTML = `
    <div class="daily-status-head">
      <h2>Tagesstatus</h2>
      <span class="daily-status-dot"></span>
    </div>
    <div class="daily-status-date">${formatGermanDate(new Date())}</div>
    <div class="daily-status-grid">
      <div class="daily-status-row"><span>Laut Liste</span><strong>${stats.planned}</strong></div>
      <div class="daily-status-row primary"><span>Real anwesend</span><strong>${stats.realPresent}</strong></div>
    </div>
    <div class="daily-status-breakdown">
      <span>Abgesagt <strong>${stats.cancelled}</strong></span>
      <span>Krank <strong>${stats.sick}</strong></span>
      <span>Sonstiger Ausfall <strong>${stats.otherAbsence}</strong></span>
    </div>
    ${unclearText}
  `;
}

function renderAttendancePanel() {
  const rows = document.getElementById('attendanceRows');
  const summary = document.getElementById('attendanceTodaySummary');
  const hint = document.getElementById('attendanceEditHint');
  if (!rows || !summary || !hint) return;

  const canEdit = canEditAttendance();
  const stats = calculateStats();
  const plannedParticipants = getPlannedParticipants();
  const visibleParticipants = plannedParticipants.length ? plannedParticipants : state.participants;
  const showingAll = !plannedParticipants.length;
  const attendanceByParticipant = getAttendanceByParticipant();

  hint.textContent = canEdit ? 'bearbeitbar' : 'nur Lesen';
  hint.className = `attendance-edit-hint ${canEdit ? 'can-edit' : 'read-only'}`;
  summary.innerHTML = `
    <span>Real anwesend: <strong>${stats.realPresent}</strong></span>
    <span>Abgesagt: <strong>${stats.cancelled}</strong></span>
    <span>Krank: <strong>${stats.sick}</strong></span>
    <span>Sonstiger Ausfall: <strong>${stats.otherAbsence}</strong></span>
    ${stats.unclear ? `<span class="is-warning">Ungeklaert: <strong>${stats.unclear}</strong></span>` : ''}
  `;

  if (!visibleParticipants.length) {
    rows.innerHTML = '<div class="attendance-empty">Keine Teilnehmenden gefunden.</div>';
    return;
  }

  const note = showingAll
    ? '<div class="attendance-note">Heute ist laut Verfuegbarkeitszeitraum niemand eingeplant. Zur Pflege und zum Test werden alle sichtbaren Personen angezeigt.</div>'
    : '';

  rows.innerHTML = `${note}${visibleParticipants.map(participant => {
    const entry = attendanceByParticipant.get(participant.id);
    const status = entry?.status || '';
    return `
      <div class="attendance-row" data-participant-id="${participant.id}">
        <div class="attendance-person">
          <strong>${escapeHtml(participant.full_name || 'Ohne Namen')}</strong>
          <span>${escapeHtml(participant.public_role || participant.status || 'Teilnehmende')}</span>
        </div>
        <label>
          Status
          <select class="attendance-status" ${canEdit ? '' : 'disabled'}>
            <option value="">nicht gepflegt</option>
            ${STATUS_OPTIONS.map(([value, label]) => `<option value="${value}" ${value === status ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('')}
          </select>
        </label>
        <label>
          Notiz
          <input class="attendance-note-input" type="text" value="${escapeHtml(entry?.note || '')}" ${canEdit ? '' : 'disabled'} />
        </label>
        <div class="attendance-save-state" aria-live="polite"></div>
      </div>
    `;
  }).join('')}`;

  if (canEdit) {
    rows.querySelectorAll('.attendance-row').forEach(row => {
      row.querySelector('.attendance-status')?.addEventListener('change', () => saveAttendanceRow(row));
      row.querySelector('.attendance-note-input')?.addEventListener('change', () => saveAttendanceRow(row));
    });
  }
}

async function saveAttendanceRow(row) {
  const participantId = Number(row.dataset.participantId);
  const status = row.querySelector('.attendance-status')?.value || 'unklar';
  const note = row.querySelector('.attendance-note-input')?.value?.trim() || null;
  const saveState = row.querySelector('.attendance-save-state');

  try {
    if (saveState) saveState.textContent = 'Speichere ...';
    const { data, error } = await state.client
      .from('daily_attendance')
      .upsert({
        participant_id: participantId,
        date: state.todayIso,
        status,
        note,
        created_by: state.userId,
        updated_by: state.userId
      }, { onConflict: 'participant_id,date' })
      .select('id,participant_id,date,status,note')
      .single();

    if (error) throw error;
    const existingIndex = state.attendance.findIndex(entry => Number(entry.participant_id) === participantId);
    if (existingIndex >= 0) state.attendance[existingIndex] = data;
    else state.attendance.push(data);
    if (saveState) saveState.textContent = 'Gespeichert';
    renderSidebarStatus();
    window.setTimeout(() => { if (saveState?.textContent === 'Gespeichert') saveState.textContent = ''; }, 1500);
  } catch (error) {
    if (saveState) saveState.textContent = 'Fehler';
    alert('Anwesenheit konnte nicht gespeichert werden: ' + (error?.message || String(error)));
  }
}

function calculateStats() {
  const plannedParticipants = getPlannedParticipants();
  const attendanceByParticipant = getAttendanceByParticipant();
  const realPresent = state.attendance.filter(entry => PRESENT_STATUSES.includes(entry.status)).length;
  const cancelled = countAttendance('abgesagt');
  const sick = countAttendance('krank');
  const otherAbsence = countAttendance('sonstiger_ausfall');
  const explicitUnclear = countAttendance('unklar');
  const missingPlanned = plannedParticipants.filter(participant => !attendanceByParticipant.has(participant.id)).length;
  return {
    planned: plannedParticipants.length,
    realPresent,
    cancelled,
    sick,
    otherAbsence,
    unclear: explicitUnclear + missingPlanned
  };
}

function getPlannedParticipants() {
  return state.participants.filter(participant => {
    const participantStatus = String(participant.status || '').toLowerCase();
    if (participantStatus === 'anzufragen' || participantStatus === 'inaktiv' || participantStatus === 'inactive') return false;
    if (!participant.availability_from || !participant.availability_to) return false;
    return participant.availability_from <= state.todayIso && participant.availability_to >= state.todayIso;
  });
}

function getAttendanceByParticipant() {
  return new Map(state.attendance.map(entry => [Number(entry.participant_id), entry]));
}

function countAttendance(status) {
  return state.attendance.filter(entry => entry.status === status).length;
}

function canEditAttendance() {
  return EDIT_ROLES.includes(state.role);
}

function renderSidebarError(message) {
  const box = document.getElementById('dailyStatusBox');
  if (!box) return;
  box.innerHTML = `
    <div class="daily-status-head"><h2>Tagesstatus</h2><span class="daily-status-dot error"></span></div>
    <div class="daily-status-date">${formatGermanDate(new Date())}</div>
    <div class="daily-status-error">${escapeHtml(message)}</div>
  `;
}

function renderAttendancePanelError(message) {
  const rows = document.getElementById('attendanceRows');
  const hint = document.getElementById('attendanceEditHint');
  if (hint) hint.textContent = 'Fehler';
  if (rows) rows.innerHTML = `<div class="attendance-empty">Anwesenheit konnte nicht geladen werden: ${escapeHtml(message)}</div>`;
}

function getLocalIsoDate() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function formatGermanDate(date) {
  return new Intl.DateTimeFormat('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const PROJECT_START = new Date('2026-07-27T00:00:00');
const PROJECT_END = new Date('2026-10-09T00:00:00');
const STATUS_OPTIONS = [
  ['alle', 'Alle Status'],
  ['gesetzt', 'gesetzt'],
  ['zugesagt', 'zugesagt'],
  ['zu_klären', 'zu klären'],
  ['anzufragen', 'anzufragen']
];

const state = {
  client: null,
  participants: [],
  view: 'table',
  search: '',
  status: 'alle',
  sort: 'start',
  reloadTimer: null
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', installParticipantTimeline);
} else {
  installParticipantTimeline();
}

async function installParticipantTimeline() {
  if (window.__participantTimelineInstalled) return;
  window.__participantTimelineInstalled = true;
  injectStylesheet();
  ensureUi();
  bindRefreshObserver();
  await loadParticipants();
  scheduleParticipantPlanningModule();
}

function scheduleParticipantPlanningModule() {
  window.setTimeout(() => {
    if (window.__participantPlanningInstalled) return;
    import('./participant-planning-module.js?v=planning-20260501-1')
      .catch(error => console.error('Teilnehmerplanung konnte nicht geladen werden', error));
  }, 600);
}

function injectStylesheet() {
  if (document.querySelector('link[href^="./participant-timeline-module.css"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = './participant-timeline-module.css?v=timeline-20260429-1';
  document.head.appendChild(link);
}

function ensureUi() {
  const tab = document.getElementById('participantsTab');
  if (!tab || document.getElementById('participantViewPanel')) return;
  const standardView = tab.querySelector(':scope > .two-col');
  if (standardView) standardView.id = 'participantsStandardView';
  const sectionHead = tab.querySelector('.section-head');
  if (!sectionHead) return;

  sectionHead.insertAdjacentHTML('afterend', `
    <section class="panel participant-view-panel" id="participantViewPanel">
      <div class="participant-view-head">
        <div class="participant-view-tabs" role="group" aria-label="Teilnehmendenansicht">
          <button type="button" class="btn small participant-view-toggle active" data-view="table">Liste</button>
          <button type="button" class="btn small participant-view-toggle" data-view="timeline">Zeitachse</button>
        </div>
        <div class="participant-timeline-controls">
          <label>Suche<input type="text" id="participantTimelineSearch" placeholder="Name suchen" /></label>
          <label>Status<select id="participantTimelineStatus">
            ${STATUS_OPTIONS.map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}
          </select></label>
          <label>Sortierung<select id="participantTimelineSort">
            <option value="start">Startdatum</option>
            <option value="name">Name</option>
            <option value="status">Status</option>
            <option value="needs">Klärungsbedarf zuerst</option>
          </select></label>
        </div>
      </div>
      <div id="participantTimelineView" class="participant-timeline-view hidden"></div>
    </section>
  `);

  document.querySelectorAll('.participant-view-toggle').forEach(button => {
    button.addEventListener('click', () => {
      state.view = button.dataset.view;
      render();
    });
  });
  document.getElementById('participantTimelineSearch')?.addEventListener('input', event => {
    state.search = event.target.value;
    render();
  });
  document.getElementById('participantTimelineStatus')?.addEventListener('change', event => {
    state.status = event.target.value;
    render();
  });
  document.getElementById('participantTimelineSort')?.addEventListener('change', event => {
    state.sort = event.target.value;
    render();
  });
}

function bindRefreshObserver() {
  const body = document.getElementById('participantsBody');
  if (!body) return;
  new MutationObserver(() => {
    window.clearTimeout(state.reloadTimer);
    state.reloadTimer = window.setTimeout(loadParticipants, 400);
  }).observe(body, { childList: true, subtree: true });
}

async function loadParticipants() {
  const config = window.APP_CONFIG;
  if (!config?.SUPABASE_URL || !config?.SUPABASE_ANON_KEY) return;
  state.client ||= window.getManheimSupabaseClient?.(createClient) || createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  const { data: sessionData } = await state.client.auth.getSession();
  if (!sessionData?.session?.user) return;

  const { data, error } = await state.client
    .from('participants')
    .select('id,full_name,public_role,availability_from,availability_to,status,availability_note,source_note')
    .order('availability_from', { ascending: true, nullsFirst: false })
    .order('full_name');
  if (error) {
    renderError(error.message);
    return;
  }
  state.participants = data || [];
  render();
}

function render() {
  ensureUi();
  const timeline = document.getElementById('participantTimelineView');
  const standardView = document.getElementById('participantsStandardView');
  const panel = document.getElementById('participantViewPanel');
  if (!timeline || !standardView || !panel) return;

  const showTimeline = state.view === 'timeline';
  standardView.classList.toggle('hidden', showTimeline);
  timeline.classList.toggle('hidden', !showTimeline);
  panel.querySelectorAll('.participant-view-toggle').forEach(button => {
    button.classList.toggle('active', button.dataset.view === state.view);
  });
  if (!showTimeline) return;

  const participants = getFilteredParticipants();
  timeline.innerHTML = `
    <div class="participant-timeline-legend">
      <span><i class="timeline-status-dot status-gesetzt"></i>gesetzt</span>
      <span><i class="timeline-status-dot status-zugesagt"></i>zugesagt</span>
      <span><i class="timeline-status-dot status-zu-klaeren"></i>zu klären</span>
      <span><i class="timeline-status-dot status-anzufragen"></i>anzufragen</span>
    </div>
    <div class="participant-timeline-scale" aria-hidden="true">
      ${timelineScaleTicks().map(tick => `<span style="left:${tick.left}%">${tick.label}</span>`).join('')}
    </div>
    <div class="participant-timeline-rows">
      ${participants.length ? participants.map(renderRow).join('') : '<div class="empty">Keine Teilnehmenden für diese Filter.</div>'}
    </div>
  `;
}

function renderError(message) {
  const timeline = document.getElementById('participantTimelineView');
  if (timeline) timeline.innerHTML = `<div class="empty">Zeitachse konnte nicht geladen werden: ${escapeHtml(message)}</div>`;
}

function getFilteredParticipants() {
  const query = state.search.trim().toLowerCase();
  return [...state.participants]
    .filter(participant => !query || String(participant.full_name || '').toLowerCase().includes(query))
    .filter(participant => state.status === 'alle' || participant.status === state.status)
    .sort((a, b) => compareParticipants(a, b, state.sort));
}

function renderRow(participant) {
  const range = getRange(participant);
  const statusClass = statusClassFor(participant.status);
  const needsAttention = hasClarificationNeed(participant);
  const note = participant.availability_note || participant.source_note || '';
  const rangeLabel = range.valid ? `${formatDate(participant.availability_from)} - ${formatDate(participant.availability_to)}` : 'Zeitraum unklar';
  const bar = range.valid
    ? `<div class="participant-timeline-bar ${statusClass}" style="left:${range.left}%;width:${range.width}%"></div>`
    : '<div class="participant-timeline-invalid">Zeitraum fehlt oder liegt außerhalb des Projekts</div>';

  return `
    <article class="participant-timeline-row ${needsAttention ? 'needs-attention' : ''}">
      <div class="participant-timeline-person">
        <strong>${escapeHtml(participant.full_name || 'Ohne Namen')}</strong>
        <span>${escapeHtml(participant.public_role || 'Teilnehmende')}</span>
        <div class="participant-timeline-meta">
          <span class="participant-timeline-status ${statusClass}">${prettyStatus(participant.status)}</span>
          <span>${escapeHtml(rangeLabel)}</span>
          ${needsAttention ? '<span class="participant-timeline-warning">Klärungsbedarf</span>' : ''}
        </div>
        ${note ? `<p>${escapeHtml(shorten(note, 95))}</p>` : ''}
      </div>
      <div class="participant-timeline-track">${bar}</div>
    </article>
  `;
}

function getRange(participant) {
  const start = parseDate(participant.availability_from);
  const end = parseDate(participant.availability_to);
  const total = PROJECT_END - PROJECT_START;
  if (!start || !end || end < start || end < PROJECT_START || start > PROJECT_END) return { valid: false, left: 0, width: 0 };
  const clippedStart = new Date(Math.max(start, PROJECT_START));
  const clippedEnd = new Date(Math.min(end, PROJECT_END));
  const left = clamp(((clippedStart - PROJECT_START) / total) * 100, 0, 100);
  const width = clamp(((clippedEnd - clippedStart) / total) * 100, 1.5, 100 - left);
  return { valid: true, left, width };
}

function timelineScaleTicks() {
  const ticks = [
    ['2026-07-27', '27.07.'],
    ['2026-08-17', '17.08.'],
    ['2026-09-07', '07.09.'],
    ['2026-09-28', '28.09.'],
    ['2026-10-09', '09.10.']
  ];
  const total = PROJECT_END - PROJECT_START;
  return ticks.map(([date, label]) => ({ label, left: clamp(((new Date(`${date}T00:00:00`) - PROJECT_START) / total) * 100, 0, 100) }));
}

function compareParticipants(a, b, sort) {
  if (sort === 'name') return String(a.full_name || '').localeCompare(String(b.full_name || ''), 'de');
  if (sort === 'status') return statusRank(a.status) - statusRank(b.status) || compareParticipants(a, b, 'name');
  if (sort === 'needs') return Number(!hasClarificationNeed(a)) - Number(!hasClarificationNeed(b)) || compareParticipants(a, b, 'start');
  const dateCompare = compareDates(a.availability_from, b.availability_from);
  return dateCompare || compareParticipants(a, b, 'name');
}

function hasClarificationNeed(participant) {
  return participant.status === 'zu_klären' || participant.status === 'anzufragen' || !getRange(participant).valid;
}

function statusClassFor(status) {
  if (status === 'gesetzt') return 'status-gesetzt';
  if (status === 'zugesagt') return 'status-zugesagt';
  if (status === 'zu_klären') return 'status-zu-klaeren';
  if (status === 'anzufragen') return 'status-anzufragen';
  return 'status-unknown';
}

function statusRank(status) {
  return ({ gesetzt: 1, zugesagt: 2, 'zu_klären': 3, anzufragen: 4 })[status] || 9;
}

function compareDates(a, b) {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return new Date(a) - new Date(b);
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(String(value).slice(0, 10) + 'T00:00:00');
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value) {
  const date = parseDate(value);
  return date ? date.toLocaleDateString('de-DE') : '-';
}

function prettyStatus(status) {
  return ({ gesetzt: 'gesetzt', zugesagt: 'zugesagt', 'zu_klären': 'zu klären', anzufragen: 'anzufragen' })[status] || status || '-';
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

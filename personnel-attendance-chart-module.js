import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const PROJECT_START = new Date(2026, 6, 27);
const PROJECT_END = new Date(2026, 9, 9);
const TARGET_ATTENDANCE = 10;
const CRITICAL_ATTENDANCE = 6;

const state = {
  client: null,
  loading: false,
  installed: false,
  participants: [],
  lastError: null,
  renderTimer: null
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', installPersonnelAttendanceChart);
} else {
  installPersonnelAttendanceChart();
}

function installPersonnelAttendanceChart() {
  if (window.__personnelAttendanceChartInstalled) return;
  window.__personnelAttendanceChartInstalled = true;
  state.installed = true;
  setupSupabase();
  injectStyles();
  bindUiEvents();
  scheduleRender(250);
  scheduleRender(1200);
  scheduleRender(2400);
}

function setupSupabase() {
  const config = window.APP_CONFIG || {};
  if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) return;
  state.client = window.getManheimSupabaseClient?.(createClient) || createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  state.client.auth.onAuthStateChange(event => {
    if (event === 'SIGNED_OUT') {
      state.participants = [];
      state.lastError = null;
      removeChart();
      return;
    }
    if (['SIGNED_IN', 'TOKEN_REFRESHED', 'USER_UPDATED', 'INITIAL_SESSION'].includes(event)) {
      scheduleRender(700);
    }
  });
}

function bindUiEvents() {
  document.querySelector('.nav-btn[data-tab="participants"]')?.addEventListener('click', () => scheduleRender(120));
  document.getElementById('refreshButton')?.addEventListener('click', () => scheduleRender(1000));
  document.addEventListener('click', event => {
    if (event.target?.closest?.('.participant-planning-tab')) scheduleRender(120);
  });
  window.addEventListener('resize', () => scheduleRender(100));
}

function scheduleRender(delay = 0) {
  window.clearTimeout(state.renderTimer);
  state.renderTimer = window.setTimeout(renderChart, delay);
}

async function renderChart() {
  if (!isPersonalVisible()) {
    hideChart();
    return;
  }
  const host = ensureChartHost();
  if (!host) return;

  host.classList.remove('hidden');
  if (!state.client) {
    host.innerHTML = renderEmpty('Keine Supabase-Konfiguration');
    return;
  }

  host.innerHTML = renderLoading();
  try {
    await loadParticipants();
    const daily = buildDailySeries(state.participants);
    host.innerHTML = renderSvgChart(daily);
  } catch (error) {
    console.error('Anwesenheitsdiagramm konnte nicht geladen werden', error);
    state.lastError = error;
    host.innerHTML = renderEmpty('Anwesenheit konnte nicht geladen werden');
  }
}

async function loadParticipants() {
  if (state.loading) return;
  state.loading = true;
  try {
    const { data: sessionData, error: sessionError } = await getAuthSession();
    if (sessionError) throw sessionError;
    if (!sessionData?.session?.user) {
      state.participants = [];
      return;
    }
    const { data, error } = await state.client
      .from('participants')
      .select('id,full_name,availability_from,availability_to,status')
      .order('availability_from', { ascending: true, nullsFirst: false })
      .order('full_name');
    if (error) throw error;
    state.participants = data || [];
    state.lastError = null;
  } finally {
    state.loading = false;
  }
}

function ensureChartHost() {
  const topbar = document.querySelector('.topbar');
  const sync = document.querySelector('.topbar-right');
  if (!topbar || !sync) return null;
  let host = document.getElementById('personnelAttendanceChart');
  if (!host) {
    host = document.createElement('section');
    host.id = 'personnelAttendanceChart';
    host.className = 'personnel-attendance-chart';
    host.setAttribute('aria-label', 'Anwesenheitsentwicklung im Grabungszeitraum');
    topbar.insertBefore(host, sync);
  }
  return host;
}

function hideChart() {
  document.getElementById('personnelAttendanceChart')?.classList.add('hidden');
}

function removeChart() {
  document.getElementById('personnelAttendanceChart')?.remove();
}

function isPersonalVisible() {
  const app = document.getElementById('app');
  if (!app || app.classList.contains('hidden')) return false;
  const participantsTab = document.getElementById('participantsTab');
  const navActive = document.querySelector('.nav-btn[data-tab="participants"]')?.classList.contains('active');
  return Boolean(navActive || participantsTab?.classList.contains('active'));
}

function buildDailySeries(participants) {
  const days = eachProjectDay();
  const counted = participants.filter(person => hasValidRange(person) && isCountedStatus(person.status));
  return days.map(day => {
    const count = counted.filter(person => isWithinRange(day.date, person.availability_from, person.availability_to)).length;
    return { ...day, count };
  });
}

function eachProjectDay() {
  const result = [];
  for (let date = new Date(PROJECT_START); date <= PROJECT_END; date.setDate(date.getDate() + 1)) {
    const copy = new Date(date);
    result.push({
      date: copy,
      key: dateKey(copy),
      label: copy.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
    });
  }
  return result;
}

function renderSvgChart(daily) {
  if (!daily.length) return renderEmpty('Noch keine Zeitachse vorhanden');

  const width = 430;
  const height = 152;
  const pad = { left: 28, right: 12, top: 14, bottom: 24 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const maxCount = Math.max(TARGET_ATTENDANCE + 2, ...daily.map(day => day.count), 1);
  const y = value => pad.top + plotHeight - (value / maxCount) * plotHeight;
  const x = index => pad.left + (index / Math.max(daily.length - 1, 1)) * plotWidth;
  const linePoints = daily.map((day, index) => `${x(index).toFixed(1)},${y(day.count).toFixed(1)}`).join(' ');
  const areaPoints = `${pad.left},${pad.top + plotHeight} ${linePoints} ${pad.left + plotWidth},${pad.top + plotHeight}`;
  const criticalY = y(CRITICAL_ATTENDANCE);
  const targetY = y(TARGET_ATTENDANCE);
  const stats = calculateStats(daily);
  const ticks = [0, CRITICAL_ATTENDANCE, TARGET_ATTENDANCE, maxCount].filter((value, index, list) => list.indexOf(value) === index);
  const highlightPoints = pickHighlightPoints(daily);

  return `
    <div class="personnel-attendance-head">
      <div>
        <strong>Anwesenheit</strong>
        <span>${escapeHtml(stats.trendLabel)}</span>
      </div>
      <div class="personnel-attendance-stats">
        <span>Max ${stats.max}</span>
        <span>Ø ${stats.avg}</span>
      </div>
    </div>
    <svg class="personnel-attendance-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Anwesenheit pro Tag mit Zielmarke 10 Personen">
      <rect x="${pad.left}" y="${criticalY.toFixed(1)}" width="${plotWidth}" height="${(pad.top + plotHeight - criticalY).toFixed(1)}" class="critical-band"></rect>
      ${ticks.map(value => `<line x1="${pad.left}" x2="${pad.left + plotWidth}" y1="${y(value).toFixed(1)}" y2="${y(value).toFixed(1)}" class="grid-line"></line>`).join('')}
      <line x1="${pad.left}" x2="${pad.left + plotWidth}" y1="${targetY.toFixed(1)}" y2="${targetY.toFixed(1)}" class="target-line"></line>
      <text x="${pad.left + plotWidth - 2}" y="${(targetY - 4).toFixed(1)}" text-anchor="end" class="target-label">Ziel 10</text>
      <polyline points="${areaPoints}" class="attendance-area"></polyline>
      <polyline points="${linePoints}" class="attendance-line"></polyline>
      ${highlightPoints.map(point => `<circle cx="${x(point.index).toFixed(1)}" cy="${y(point.count).toFixed(1)}" r="3.2" class="attendance-dot"><title>${escapeHtml(point.label)}: ${point.count} Personen</title></circle>`).join('')}
      ${ticks.map(value => `<text x="${pad.left - 7}" y="${(y(value) + 3).toFixed(1)}" text-anchor="end" class="axis-label">${value}</text>`).join('')}
      <text x="${pad.left}" y="${height - 5}" class="axis-label">27.07.</text>
      <text x="${pad.left + plotWidth}" y="${height - 5}" text-anchor="end" class="axis-label">09.10.</text>
    </svg>
    <div class="personnel-attendance-note">
      <span class="note-target">Zielmarke: 10</span>
      <span class="note-critical">kritisch: unter 6</span>
    </div>
  `;
}

function calculateStats(daily) {
  const counts = daily.map(day => day.count);
  const max = Math.max(...counts, 0);
  const avg = counts.length ? (counts.reduce((sum, value) => sum + value, 0) / counts.length).toFixed(1).replace('.', ',') : '0';
  const segment = Math.max(Math.floor(counts.length / 3), 1);
  const first = average(counts.slice(0, segment));
  const last = average(counts.slice(-segment));
  const diff = last - first;
  const trendLabel = diff > 1 ? 'Trend steigend' : diff < -1 ? 'Trend fallend' : 'Trend stabil';
  return { max, avg, trendLabel };
}

function pickHighlightPoints(daily) {
  const max = Math.max(...daily.map(day => day.count), 0);
  const min = Math.min(...daily.map(day => day.count), 0);
  const result = [];
  const maxIndex = daily.findIndex(day => day.count === max);
  const minIndex = daily.findIndex(day => day.count === min);
  if (maxIndex >= 0) result.push({ ...daily[maxIndex], index: maxIndex });
  if (minIndex >= 0 && minIndex !== maxIndex) result.push({ ...daily[minIndex], index: minIndex });
  return result;
}

function renderLoading() {
  return `
    <div class="personnel-attendance-head">
      <div><strong>Anwesenheit</strong><span>wird geladen</span></div>
    </div>
    <div class="personnel-attendance-loading"></div>
  `;
}

function renderEmpty(message) {
  return `
    <div class="personnel-attendance-head">
      <div><strong>Anwesenheit</strong><span>${escapeHtml(message)}</span></div>
    </div>
    <div class="personnel-attendance-empty">Keine Diagrammdaten</div>
  `;
}

function isCountedStatus(status) {
  const normalized = normalizeStatus(status);
  return normalized === 'gesetzt' || normalized === 'zugesagt' || normalized === 'zu_klaeren';
}

function normalizeStatus(status) {
  return String(status || '')
    .trim()
    .toLowerCase()
    .replaceAll('ä', 'ae')
    .replaceAll('ö', 'oe')
    .replaceAll('ü', 'ue')
    .replaceAll(' ', '_')
    .replaceAll('-', '_')
    .replaceAll('\\u00e4', 'ae');
}

function hasValidRange(person) {
  const start = parseDate(person.availability_from);
  const end = parseDate(person.availability_to);
  return Boolean(start && end && end >= start);
}

function isWithinRange(day, from, to) {
  const start = parseDate(from);
  const end = parseDate(to);
  if (!start || !end) return false;
  return day >= start && day <= end;
}

function parseDate(value) {
  if (!value) return null;
  const parts = String(value).slice(0, 10).split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function dateKey(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
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

function injectStyles() {
  if (document.getElementById('personnelAttendanceChartStyles')) return;
  const style = document.createElement('style');
  style.id = 'personnelAttendanceChartStyles';
  style.textContent = `
    .topbar {
      gap: 16px;
      align-items: center;
    }
    .personnel-attendance-chart {
      flex: 0 1 430px;
      min-width: 300px;
      max-width: 470px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.88);
      box-shadow: 0 8px 24px rgba(15, 39, 64, 0.06);
      padding: 10px 12px 8px;
    }
    .personnel-attendance-chart.hidden {
      display: none;
    }
    .personnel-attendance-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 4px;
      color: var(--text);
    }
    .personnel-attendance-head strong,
    .personnel-attendance-head span {
      display: block;
    }
    .personnel-attendance-head strong {
      font-size: 0.92rem;
      line-height: 1.1;
    }
    .personnel-attendance-head span {
      color: var(--muted);
      font-size: 0.76rem;
      margin-top: 2px;
    }
    .personnel-attendance-stats {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    .personnel-attendance-stats span,
    .personnel-attendance-note span {
      border-radius: 999px;
      border: 1px solid var(--border);
      background: #f7fafc;
      color: var(--muted);
      font-size: 0.7rem;
      font-weight: 700;
      padding: 3px 7px;
      white-space: nowrap;
    }
    .personnel-attendance-svg {
      display: block;
      width: 100%;
      height: auto;
      min-height: 118px;
    }
    .personnel-attendance-svg .grid-line {
      stroke: #dbe6ef;
      stroke-width: 1;
    }
    .personnel-attendance-svg .target-line {
      stroke: #2f855a;
      stroke-width: 1.7;
      stroke-dasharray: 5 4;
    }
    .personnel-attendance-svg .target-label {
      fill: #2f855a;
      font-size: 10px;
      font-weight: 800;
    }
    .personnel-attendance-svg .critical-band {
      fill: rgba(216, 59, 45, 0.13);
    }
    .personnel-attendance-svg .attendance-area {
      fill: rgba(37, 99, 235, 0.1);
      stroke: none;
    }
    .personnel-attendance-svg .attendance-line {
      fill: none;
      stroke: #2563eb;
      stroke-width: 2.4;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .personnel-attendance-svg .attendance-dot {
      fill: #ffffff;
      stroke: #2563eb;
      stroke-width: 2;
    }
    .personnel-attendance-svg .axis-label {
      fill: #60748a;
      font-size: 10px;
    }
    .personnel-attendance-note {
      display: flex;
      justify-content: space-between;
      gap: 6px;
      margin-top: 2px;
    }
    .personnel-attendance-note .note-target {
      border-color: rgba(47, 133, 90, 0.28);
      color: #286f4c;
      background: #edf9f2;
    }
    .personnel-attendance-note .note-critical {
      border-color: rgba(216, 59, 45, 0.22);
      color: #a7322b;
      background: #fff2f1;
    }
    .personnel-attendance-loading,
    .personnel-attendance-empty {
      min-height: 118px;
      border-radius: 8px;
      background: linear-gradient(90deg, #eef4f9, #f8fbfd, #eef4f9);
      color: var(--muted);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.82rem;
    }
    .personnel-attendance-loading {
      background-size: 220% 100%;
      animation: personnel-attendance-pulse 1.4s ease-in-out infinite;
    }
    @keyframes personnel-attendance-pulse {
      0% { background-position: 0 50%; }
      100% { background-position: 220% 50%; }
    }
    @media (max-width: 1180px) {
      .topbar {
        flex-wrap: wrap;
      }
      .personnel-attendance-chart {
        order: 3;
        flex-basis: 100%;
        max-width: none;
      }
      .topbar-right {
        margin-left: auto;
      }
    }
    @media (max-width: 720px) {
      .personnel-attendance-chart {
        min-width: 0;
        padding: 9px;
      }
      .personnel-attendance-note,
      .personnel-attendance-stats {
        justify-content: flex-start;
      }
    }
  `;
  document.head.appendChild(style);
}

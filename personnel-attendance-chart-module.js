import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const PROJECT_START = new Date(2026, 6, 27);
const PROJECT_END = new Date(2026, 9, 9);
const TARGET_ATTENDANCE = 10;
const CRITICAL_ATTENDANCE = 6;
const MAX_Y = 15;

const state = {
  client: null,
  loading: false,
  participants: [],
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
      removeChart();
      return;
    }
    if (['SIGNED_IN', 'TOKEN_REFRESHED', 'USER_UPDATED', 'INITIAL_SESSION'].includes(event)) scheduleRender(700);
  });
}

function bindUiEvents() {
  document.querySelector('.nav-btn[data-tab="participants"]')?.addEventListener('click', () => scheduleRender(120));
  document.getElementById('refreshButton')?.addEventListener('click', () => scheduleRender(1000));
  document.addEventListener('click', event => {
    if (event.target?.closest?.('.participant-planning-tab')) scheduleRender(140);
  });
  window.addEventListener('resize', () => scheduleRender(120));
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
    host.innerHTML = renderChartCard(daily);
  } catch (error) {
    console.error('Anwesenheitsdiagramm konnte nicht geladen werden', error);
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
    host.className = 'personnel-attendance-chart chart-card';
    host.setAttribute('aria-label', 'Diagramm zur täglichen Anwesenheit des Personals');
  }

  if (host.parentElement !== topbar || host.nextElementSibling !== sync) topbar.insertBefore(host, sync);
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
      label: copy.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
    });
  }
  return result;
}

function renderChartCard(daily) {
  if (!daily.length) return renderEmpty('Noch keine Zeitachse vorhanden');

  const stats = calculateStats(daily);
  return `
    <div class="chart-head">
      <div>
        <div class="eyebrow">Personal · Anwesenheit</div>
        <strong>Tägliche Personalstärke</strong>
      </div>
      <div class="kpis" aria-label="Kennzahlen">
        <span><strong>${stats.avg}</strong> Ø</span>
        <span><strong>${stats.max}</strong> Max</span>
        <span><strong>${stats.criticalDays}</strong> kritisch</span>
      </div>
    </div>
    <div class="chart-wrap">
      ${renderSvg(daily)}
    </div>
  `;
}

function renderSvg(daily) {
  const width = 620;
  const height = 172;
  const margin = { top: 18, right: 24, bottom: 28, left: 34 };
  const chartW = width - margin.left - margin.right;
  const chartH = height - margin.top - margin.bottom;
  const maxY = Math.max(MAX_Y, Math.ceil(Math.max(...daily.map(day => day.count), TARGET_ATTENDANCE) / 3) * 3);
  const minY = 0;
  const x = index => margin.left + (index / Math.max(daily.length - 1, 1)) * chartW;
  const y = value => margin.top + chartH - ((value - minY) / (maxY - minY)) * chartH;
  const yTicks = buildTicks(maxY).filter(tick => tick === 0 || tick === CRITICAL_ATTENDANCE || tick === TARGET_ATTENDANCE || tick === maxY);
  const criticalTop = y(CRITICAL_ATTENDANCE);
  const dateStep = daily.length > 55 ? 14 : daily.length > 28 ? 7 : 4;
  const lineSegments = buildColoredLineSegments(daily, x, y);

  return `
    <svg class="attendance-chart" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="attendanceChartTitle attendanceChartDesc">
      <title id="attendanceChartTitle">Liniendiagramm der täglichen Personal-Anwesenheit</title>
      <desc id="attendanceChartDesc">Zeitachse mit Anzahl anwesender Mitarbeiter pro Tag, Zielmarke bei 10 und kritischem Bereich bis 6.</desc>
      ${yTicks.map(tick => `
        <line x1="${margin.left}" x2="${width - margin.right}" y1="${y(tick).toFixed(1)}" y2="${y(tick).toFixed(1)}" class="grid-line"></line>
        <text x="${margin.left - 9}" y="${(y(tick) + 3).toFixed(1)}" text-anchor="end" class="tick-label">${tick}</text>
      `).join('')}
      <rect x="${margin.left}" y="${criticalTop.toFixed(1)}" width="${chartW}" height="${(y(0) - criticalTop).toFixed(1)}" class="critical-band"></rect>
      <line x1="${margin.left}" x2="${width - margin.right}" y1="${y(CRITICAL_ATTENDANCE).toFixed(1)}" y2="${y(CRITICAL_ATTENDANCE).toFixed(1)}" class="critical-boundary"></line>
      <line x1="${margin.left}" x2="${width - margin.right}" y1="${y(TARGET_ATTENDANCE).toFixed(1)}" y2="${y(TARGET_ATTENDANCE).toFixed(1)}" class="target-line"></line>
      <text x="${width - margin.right}" y="${(y(TARGET_ATTENDANCE) - 5).toFixed(1)}" text-anchor="end" class="target-text">Ziel 10</text>
      ${lineSegments.map(segment => `<path d="${segment.path}" class="attendance-line ${segment.color}"></path>`).join('')}
      ${daily.map((day, index) => renderDateTick(day, index, daily.length, x, height, margin, dateStep)).join('')}
    </svg>
  `;
}

function buildColoredLineSegments(daily, x, y) {
  const segments = [];
  for (let index = 1; index < daily.length; index += 1) {
    const start = pointForDay(daily[index - 1], index - 1, x, y);
    const end = pointForDay(daily[index], index, x, y);
    const breakpoints = [start];
    [CRITICAL_ATTENDANCE, TARGET_ATTENDANCE].forEach(threshold => {
      if (crossesThreshold(start.count, end.count, threshold)) {
        const ratio = (threshold - start.count) / (end.count - start.count);
        breakpoints.push({
          x: start.x + (end.x - start.x) * ratio,
          y: y(threshold),
          count: threshold,
          ratio
        });
      }
    });
    breakpoints.push({ ...end, ratio: 1 });
    breakpoints
      .sort((a, b) => (a.ratio ?? 0) - (b.ratio ?? 0))
      .slice(0, -1)
      .forEach((point, segmentIndex) => {
        const next = breakpoints[segmentIndex + 1];
        if (!next) return;
        const midpoint = (point.count + next.count) / 2;
        segments.push({
          color: lineColorClass(midpoint),
          path: `M ${point.x.toFixed(1)} ${point.y.toFixed(1)} L ${next.x.toFixed(1)} ${next.y.toFixed(1)}`
        });
      });
  }
  return segments;
}

function pointForDay(day, index, x, y) {
  return { x: x(index), y: y(day.count), count: day.count, ratio: 0 };
}

function crossesThreshold(start, end, threshold) {
  return (start < threshold && end > threshold) || (start > threshold && end < threshold);
}

function lineColorClass(value) {
  if (value <= CRITICAL_ATTENDANCE) return 'line-critical';
  if (value >= TARGET_ATTENDANCE) return 'line-target';
  return 'line-normal';
}

function renderDateTick(day, index, totalDays, x, height, margin, step) {
  if (index !== 0 && index !== totalDays - 1 && index % step !== 0) return '';
  return `<text x="${x(index).toFixed(1)}" y="${height - margin.bottom + 18}" text-anchor="middle" class="tick-label x">${escapeHtml(day.label)}</text>`;
}

function calculateStats(daily) {
  const counts = daily.map(day => day.count);
  const max = Math.max(...counts, 0);
  const avg = counts.length ? (counts.reduce((sum, value) => sum + value, 0) / counts.length).toFixed(1).replace('.', ',') : '0';
  const criticalDays = counts.filter(value => value <= CRITICAL_ATTENDANCE).length;
  return { max, avg, criticalDays };
}

function buildTicks(maxY) {
  const ticks = [];
  const step = maxY <= 15 ? 3 : Math.ceil(maxY / 5);
  for (let tick = 0; tick <= maxY; tick += step) ticks.push(tick);
  if (!ticks.includes(CRITICAL_ATTENDANCE)) ticks.push(CRITICAL_ATTENDANCE);
  if (!ticks.includes(TARGET_ATTENDANCE)) ticks.push(TARGET_ATTENDANCE);
  return [...new Set(ticks)].sort((a, b) => a - b);
}

function renderLoading() {
  return `
    <div class="chart-head"><div><div class="eyebrow">Personal · Anwesenheit</div><strong>Diagramm wird geladen</strong></div></div>
    <div class="chart-wrap loading-wrap"></div>
  `;
}

function renderEmpty(message) {
  return `
    <div class="chart-head"><div><div class="eyebrow">Personal · Anwesenheit</div><strong>${escapeHtml(message)}</strong></div></div>
    <div class="chart-wrap empty-wrap">Keine Diagrammdaten</div>
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
    .topbar > div:first-child {
      flex: 0 0 420px;
      min-width: 380px;
    }
    .topbar > div:first-child p {
      margin-top: 4px;
      line-height: 1.25;
      white-space: nowrap;
    }
    .personnel-attendance-chart.chart-card {
      flex: 0 0 clamp(540px, 39vw, 650px);
      max-width: clamp(540px, 39vw, 650px);
      min-width: 520px;
      margin: 0 8px 0 auto;
      background: #fffaf2;
      border: 1px solid #e1d6c7;
      border-radius: 16px;
      box-shadow: 0 10px 26px rgba(74, 57, 37, 0.10);
      padding: 10px 12px 9px;
      color: #2f2a24;
    }
    .personnel-attendance-chart.hidden {
      display: none;
    }
    .personnel-attendance-chart .chart-head {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: flex-start;
      margin-bottom: 6px;
    }
    .personnel-attendance-chart .eyebrow {
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #766b5d;
      margin-bottom: 2px;
    }
    .personnel-attendance-chart .chart-head strong {
      display: block;
      color: #2f2a24;
      font-size: 0.88rem;
      line-height: 1.1;
    }
    .personnel-attendance-chart .kpis {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    .personnel-attendance-chart .kpis span {
      border-radius: 999px;
      border: 1px solid rgba(47, 42, 36, 0.08);
      background: rgba(255, 255, 255, 0.62);
      color: #766b5d;
      font-size: 0.68rem;
      font-weight: 700;
      padding: 3px 7px;
      white-space: nowrap;
    }
    .personnel-attendance-chart .kpis strong {
      display: inline;
      color: #2f2a24;
      font-size: 0.82rem;
      margin-right: 2px;
    }
    .personnel-attendance-chart .chart-wrap {
      position: relative;
      width: 100%;
      height: 172px;
      border-radius: 12px;
      overflow: hidden;
      background: linear-gradient(180deg, rgba(255,255,255,0.54), rgba(255,255,255,0.18)), #fffdf8;
      border: 1px solid rgba(47, 42, 36, 0.08);
    }
    .personnel-attendance-chart svg {
      width: 100%;
      height: 100%;
      display: block;
    }
    .personnel-attendance-chart .tick-label {
      fill: #766b5d;
      font-size: 10px;
    }
    .personnel-attendance-chart .grid-line {
      stroke: rgba(47, 42, 36, 0.12);
      stroke-width: 1;
    }
    .personnel-attendance-chart .attendance-line {
      fill: none;
      stroke-width: 3.2;
      stroke-linecap: round;
      stroke-linejoin: round;
      filter: drop-shadow(0 5px 7px rgba(37, 99, 235, 0.18));
    }
    .personnel-attendance-chart .attendance-line.line-normal {
      stroke: #2563eb;
    }
    .personnel-attendance-chart .attendance-line.line-target {
      stroke: #16a34a;
      filter: drop-shadow(0 5px 7px rgba(22, 163, 74, 0.16));
    }
    .personnel-attendance-chart .attendance-line.line-critical {
      stroke: #dc2626;
      filter: drop-shadow(0 5px 7px rgba(220, 38, 38, 0.14));
    }
    .personnel-attendance-chart .target-line {
      stroke: #16a34a;
      stroke-width: 2;
      stroke-dasharray: 7 6;
      stroke-linecap: round;
    }
    .personnel-attendance-chart .critical-band {
      fill: rgba(220, 38, 38, 0.16);
    }
    .personnel-attendance-chart .critical-boundary {
      stroke: rgba(220, 38, 38, 0.45);
      stroke-width: 1.2;
      stroke-dasharray: 5 5;
    }
    .personnel-attendance-chart .target-text {
      fill: #166534;
      font-size: 10px;
      font-weight: 800;
    }
    .personnel-attendance-chart .loading-wrap,
    .personnel-attendance-chart .empty-wrap {
      display: flex;
      align-items: center;
      justify-content: center;
      color: #766b5d;
      background: linear-gradient(90deg, #fff7ea, #fffdf8, #fff7ea);
      background-size: 220% 100%;
      animation: personnel-attendance-pulse 1.4s ease-in-out infinite;
      min-height: 120px;
    }
    .personnel-attendance-chart .empty-wrap {
      animation: none;
    }
    @keyframes personnel-attendance-pulse {
      0% { background-position: 0 50%; }
      100% { background-position: 220% 50%; }
    }
    @media (max-width: 1180px) {
      .topbar {
        flex-wrap: wrap;
      }
      .topbar > div:first-child {
        min-width: 0;
        flex-basis: auto;
      }
      .topbar > div:first-child p {
        white-space: normal;
      }
      .personnel-attendance-chart.chart-card {
        order: 3;
        flex-basis: 100%;
        max-width: none;
        min-width: 0;
        margin: 4px 0 0;
      }
      .topbar-right {
        margin-left: auto;
      }
    }
    @media (max-width: 760px) {
      .personnel-attendance-chart.chart-card {
        padding: 9px;
      }
      .personnel-attendance-chart .chart-head {
        display: block;
      }
      .personnel-attendance-chart .kpis {
        justify-content: flex-start;
        margin-top: 6px;
      }
      .personnel-attendance-chart .chart-wrap {
        height: 150px;
      }
      .personnel-attendance-chart .tick-label.x {
        font-size: 9px;
      }
    }
  `;
  document.head.appendChild(style);
}

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
  const tab = document.getElementById('participantsTab');
  if (!tab) return null;

  let host = document.getElementById('personnelAttendanceChart');
  if (!host) {
    host = document.createElement('section');
    host.id = 'personnelAttendanceChart';
    host.className = 'personnel-attendance-chart chart-card';
    host.setAttribute('aria-label', 'Diagramm zur taeglichen Anwesenheit des Personals');
  }

  const tabs = document.getElementById('participantPlanningTabs');
  const sectionHead = tab.querySelector('.section-head');
  const anchor = tabs || sectionHead;
  if (anchor && host.previousElementSibling !== anchor) anchor.insertAdjacentElement('afterend', host);
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
        <h3>Taegliche Personalstaerke im Zeitverlauf</h3>
        <p class="subtitle">
          Die Linie zeigt, wie viele Mitarbeiter pro Tag anwesend sind. Die gruene Linie markiert die Zielstaerke von 10 Personen;
          der rot hinterlegte Bereich zeigt kritisch niedrige Besetzung unter 6 Personen.
        </p>
      </div>
      <div class="kpis" aria-label="Kennzahlen">
        <div class="kpi"><strong>${stats.avg}</strong><span>Ø Personen</span></div>
        <div class="kpi"><strong>${stats.max}</strong><span>Maximum</span></div>
        <div class="kpi"><strong>${stats.criticalDays}</strong><span>kritische Tage</span></div>
      </div>
    </div>
    <div class="legend">
      <span class="legend-item"><span class="swatch"></span> Anwesenheit</span>
      <span class="legend-item"><span class="swatch target"></span> Zielmarke: 10 Personen</span>
      <span class="legend-item"><span class="swatch critical"></span> Kritisch: unter 6 Personen</span>
    </div>
    <div class="chart-wrap">
      ${renderSvg(daily)}
    </div>
    <p class="note">Jeder Tageswert entspricht der Anzahl der Personen, die an diesem Datum laut Zeitraum Von/Bis und Status geplant anwesend waeren.</p>
  `;
}

function renderSvg(daily) {
  const width = 1100;
  const height = 430;
  const margin = { top: 32, right: 38, bottom: 58, left: 54 };
  const chartW = width - margin.left - margin.right;
  const chartH = height - margin.top - margin.bottom;
  const maxY = Math.max(MAX_Y, Math.ceil(Math.max(...daily.map(day => day.count), TARGET_ATTENDANCE) / 3) * 3);
  const minY = 0;
  const x = index => margin.left + (index / Math.max(daily.length - 1, 1)) * chartW;
  const y = value => margin.top + chartH - ((value - minY) / (maxY - minY)) * chartH;
  const yTicks = buildTicks(maxY);
  const points = daily.map((day, index) => [x(index), y(day.count)]);
  const areaPath = [
    `M ${points[0][0].toFixed(1)} ${y(0).toFixed(1)}`,
    ...points.map(([px, py]) => `L ${px.toFixed(1)} ${py.toFixed(1)}`),
    `L ${points[points.length - 1][0].toFixed(1)} ${y(0).toFixed(1)}`,
    'Z'
  ].join(' ');
  const linePath = points.map(([px, py], index) => `${index === 0 ? 'M' : 'L'} ${px.toFixed(1)} ${py.toFixed(1)}`).join(' ');
  const criticalTop = y(CRITICAL_ATTENDANCE);
  const dateStep = daily.length > 55 ? 7 : daily.length > 28 ? 4 : 2;

  return `
    <svg class="attendance-chart" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="attendanceChartTitle attendanceChartDesc">
      <title id="attendanceChartTitle">Liniendiagramm der taeglichen Personal-Anwesenheit</title>
      <desc id="attendanceChartDesc">Zeitachse mit Anzahl anwesender Mitarbeiter pro Tag, Zielmarke bei 10 und kritischem Bereich unter 6.</desc>
      ${yTicks.map(tick => `
        <line x1="${margin.left}" x2="${width - margin.right}" y1="${y(tick).toFixed(1)}" y2="${y(tick).toFixed(1)}" class="grid-line"></line>
        <text x="${margin.left - 12}" y="${(y(tick) + 4).toFixed(1)}" text-anchor="end" class="tick-label">${tick}</text>
      `).join('')}
      <text x="${margin.left}" y="18" class="axis-title">Anwesende Personen</text>
      <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${height - margin.bottom}" class="axis-line"></line>
      <line x1="${margin.left}" y1="${height - margin.bottom}" x2="${width - margin.right}" y2="${height - margin.bottom}" class="axis-line"></line>
      <rect x="${margin.left}" y="${criticalTop.toFixed(1)}" width="${chartW}" height="${(y(0) - criticalTop).toFixed(1)}" class="critical-band"></rect>
      <line x1="${margin.left}" x2="${width - margin.right}" y1="${y(CRITICAL_ATTENDANCE).toFixed(1)}" y2="${y(CRITICAL_ATTENDANCE).toFixed(1)}" class="critical-boundary"></line>
      <line x1="${margin.left}" x2="${width - margin.right}" y1="${y(TARGET_ATTENDANCE).toFixed(1)}" y2="${y(TARGET_ATTENDANCE).toFixed(1)}" class="target-line"></line>
      <text x="${width - margin.right}" y="${(y(TARGET_ATTENDANCE) - 8).toFixed(1)}" text-anchor="end" class="target-text">Ziel: 10 Personen</text>
      <text x="${width - margin.right}" y="${(y(CRITICAL_ATTENDANCE) + 18).toFixed(1)}" text-anchor="end" class="critical-text">kritisch unter 6</text>
      <path d="${areaPath}" class="attendance-area"></path>
      <path d="${linePath}" class="attendance-line"></path>
      ${daily.map((day, index) => renderDateTick(day, index, daily.length, x, height, margin, dateStep)).join('')}
      ${daily.map((day, index) => renderPoint(day, index, x, y)).join('')}
    </svg>
  `;
}

function renderDateTick(day, index, totalDays, x, height, margin, step) {
  if (index !== 0 && index !== totalDays - 1 && index % step !== 0) return '';
  return `<text x="${x(index).toFixed(1)}" y="${height - margin.bottom + 28}" text-anchor="middle" class="tick-label x">${escapeHtml(day.label)}</text>`;
}

function renderPoint(day, index, x, y) {
  const classes = ['point'];
  if (day.count < CRITICAL_ATTENDANCE) classes.push('critical');
  if (day.count >= TARGET_ATTENDANCE) classes.push('target-ok');
  return `
    <circle cx="${x(index).toFixed(1)}" cy="${y(day.count).toFixed(1)}" r="5.4" class="${classes.join(' ')}" tabindex="0">
      <title>${escapeHtml(day.count)} Personen am ${escapeHtml(day.label)}</title>
    </circle>
  `;
}

function calculateStats(daily) {
  const counts = daily.map(day => day.count);
  const max = Math.max(...counts, 0);
  const avg = counts.length ? (counts.reduce((sum, value) => sum + value, 0) / counts.length).toFixed(1).replace('.', ',') : '0';
  const criticalDays = counts.filter(value => value < CRITICAL_ATTENDANCE).length;
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
    <div class="chart-head">
      <div>
        <div class="eyebrow">Personal · Anwesenheit</div>
        <h3>Taegliche Personalstaerke im Zeitverlauf</h3>
        <p class="subtitle">Diagramm wird geladen.</p>
      </div>
    </div>
    <div class="chart-wrap loading-wrap"></div>
  `;
}

function renderEmpty(message) {
  return `
    <div class="chart-head">
      <div>
        <div class="eyebrow">Personal · Anwesenheit</div>
        <h3>Taegliche Personalstaerke im Zeitverlauf</h3>
        <p class="subtitle">${escapeHtml(message)}</p>
      </div>
    </div>
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
    .personnel-attendance-chart.chart-card {
      width: 100%;
      margin: 16px 0 18px;
      background: #fffaf2;
      border: 1px solid #e1d6c7;
      border-radius: 22px;
      box-shadow: 0 18px 45px rgba(74, 57, 37, 0.12);
      padding: 22px;
      color: #2f2a24;
    }
    .personnel-attendance-chart.hidden {
      display: none;
    }
    .personnel-attendance-chart .chart-head {
      display: flex;
      justify-content: space-between;
      gap: 20px;
      align-items: flex-start;
      margin-bottom: 18px;
    }
    .personnel-attendance-chart .eyebrow {
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #766b5d;
      margin-bottom: 6px;
    }
    .personnel-attendance-chart h3 {
      margin: 0;
      font-size: clamp(20px, 2.2vw, 30px);
      line-height: 1.1;
      color: #2f2a24;
    }
    .personnel-attendance-chart .subtitle {
      margin: 8px 0 0;
      max-width: 620px;
      color: #766b5d;
      font-size: 14px;
      line-height: 1.45;
    }
    .personnel-attendance-chart .kpis {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    .personnel-attendance-chart .kpi {
      min-width: 98px;
      padding: 10px 12px;
      border-radius: 16px;
      border: 1px solid rgba(47, 42, 36, 0.08);
      background: rgba(255, 255, 255, 0.62);
    }
    .personnel-attendance-chart .kpi strong {
      display: block;
      font-size: 22px;
      line-height: 1;
      color: #2f2a24;
    }
    .personnel-attendance-chart .kpi span {
      display: block;
      margin-top: 4px;
      color: #766b5d;
      font-size: 12px;
      white-space: nowrap;
    }
    .personnel-attendance-chart .legend {
      display: flex;
      gap: 14px;
      flex-wrap: wrap;
      margin-bottom: 8px;
      color: #766b5d;
      font-size: 13px;
    }
    .personnel-attendance-chart .legend-item {
      display: inline-flex;
      align-items: center;
      gap: 7px;
    }
    .personnel-attendance-chart .swatch {
      width: 22px;
      height: 4px;
      border-radius: 99px;
      background: #2563eb;
    }
    .personnel-attendance-chart .swatch.target {
      background: #16a34a;
    }
    .personnel-attendance-chart .swatch.critical {
      height: 12px;
      background: rgba(220, 38, 38, 0.16);
      border: 1px solid rgba(220, 38, 38, 0.45);
    }
    .personnel-attendance-chart .chart-wrap {
      position: relative;
      width: 100%;
      height: 430px;
      border-radius: 18px;
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
      font-size: 12px;
    }
    .personnel-attendance-chart .axis-title {
      fill: #766b5d;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.02em;
    }
    .personnel-attendance-chart .grid-line {
      stroke: rgba(47, 42, 36, 0.12);
      stroke-width: 1;
    }
    .personnel-attendance-chart .axis-line {
      stroke: rgba(47, 42, 36, 0.45);
      stroke-width: 1.4;
    }
    .personnel-attendance-chart .attendance-line {
      fill: none;
      stroke: #2563eb;
      stroke-width: 4;
      stroke-linecap: round;
      stroke-linejoin: round;
      filter: drop-shadow(0 6px 8px rgba(37, 99, 235, 0.18));
    }
    .personnel-attendance-chart .attendance-area {
      fill: rgba(37, 99, 235, 0.14);
    }
    .personnel-attendance-chart .target-line {
      stroke: #16a34a;
      stroke-width: 3;
      stroke-dasharray: 8 7;
      stroke-linecap: round;
    }
    .personnel-attendance-chart .critical-band {
      fill: rgba(220, 38, 38, 0.16);
    }
    .personnel-attendance-chart .critical-boundary {
      stroke: rgba(220, 38, 38, 0.45);
      stroke-width: 1.5;
      stroke-dasharray: 5 5;
    }
    .personnel-attendance-chart .target-text {
      fill: #166534;
      font-size: 12px;
      font-weight: 800;
    }
    .personnel-attendance-chart .critical-text {
      fill: #991b1b;
      font-size: 12px;
      font-weight: 800;
    }
    .personnel-attendance-chart .point {
      fill: #fffdf8;
      stroke: #2563eb;
      stroke-width: 3;
    }
    .personnel-attendance-chart .point.critical {
      stroke: #dc2626;
      fill: #fff4f4;
    }
    .personnel-attendance-chart .point.target-ok {
      stroke: #16a34a;
      fill: #f0fdf4;
    }
    .personnel-attendance-chart .note {
      margin: 12px 2px 0;
      color: #766b5d;
      font-size: 13px;
      line-height: 1.45;
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
    }
    .personnel-attendance-chart .empty-wrap {
      animation: none;
    }
    @keyframes personnel-attendance-pulse {
      0% { background-position: 0 50%; }
      100% { background-position: 220% 50%; }
    }
    @media (max-width: 760px) {
      .personnel-attendance-chart.chart-card {
        padding: 16px;
      }
      .personnel-attendance-chart .chart-head {
        display: block;
      }
      .personnel-attendance-chart .kpis {
        justify-content: flex-start;
        margin-top: 14px;
      }
      .personnel-attendance-chart .chart-wrap {
        height: 380px;
      }
      .personnel-attendance-chart .tick-label.x {
        font-size: 10px;
      }
    }
  `;
  document.head.appendChild(style);
}

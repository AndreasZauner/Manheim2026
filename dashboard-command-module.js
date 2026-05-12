import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const START = new Date(2026, 6, 27);
const END = new Date(2026, 9, 9);
const TARGET = 10;
const CRITICAL = 6;
const PLACE = { lat: 50.889, lon: 6.646, label: 'Kerpen-Manheim' };

const state = {
  client: null,
  compact: localStorage.getItem('leitstandModulesCompact') === 'true',
  weatherMode: 'forecast',
  weatherOpen: false,
  participants: [],
  slots: [],
  absences: [],
  weather: [],
  loadingWeather: false
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', installDashboardCommandModule);
} else {
  installDashboardCommandModule();
}

function installDashboardCommandModule() {
  if (window.__dashboardCommandModuleInstalled) return;
  window.__dashboardCommandModuleInstalled = true;
  installStyles();
  setupSupabase();
  document.addEventListener('click', event => {
    if (event.target?.closest?.('.nav-btn, #refreshButton')) scheduleEnhance(220);
    const actionButton = event.target?.closest?.('[data-leitstand-module-action]');
    if (actionButton) handleAction(actionButton.dataset.leitstandModuleAction);
  });
  scheduleEnhance(200);
  scheduleEnhance(900);
  scheduleEnhance(1800);
}

function setupSupabase() {
  const config = window.APP_CONFIG || {};
  if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) return;
  state.client = window.getManheimSupabaseClient?.(createClient) || createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  state.client.auth.onAuthStateChange(event => {
    if (['INITIAL_SESSION', 'SIGNED_IN', 'TOKEN_REFRESHED', 'USER_UPDATED'].includes(event)) scheduleEnhance(400);
  });
}

function scheduleEnhance(delay = 0) {
  window.clearTimeout(window.__leitstandCommandTimer);
  window.__leitstandCommandTimer = window.setTimeout(enhanceLeitstandCommand, delay);
}

async function enhanceLeitstandCommand() {
  compactKpis();
  ensureHeader();
  if (!isLeitstandActive()) return;
  await loadPersonnel();
  renderPersonnel();
  await loadWeather();
  renderWeather();
}

function compactKpis() {
  const grid = document.getElementById('kpiGrid');
  if (grid) grid.classList.add('leitstand-kpi-strip');
}

function ensureHeader() {
  const dashboard = document.getElementById('dashboardTab');
  const kpiGrid = document.getElementById('kpiGrid');
  if (!dashboard || !kpiGrid) return;
  let header = document.getElementById('leitstandCommandHeader');
  if (!header) {
    header = document.createElement('section');
    header.id = 'leitstandCommandHeader';
    header.className = 'leitstand-command-header';
    header.innerHTML = `
      <div class="leitstand-command-copy">
        <span>Leitstand</span>
        <h3>Tages- und Wochenlage</h3>
        <p>Personalst&auml;rke, Wetterlage und operative Kennzahlen f&uuml;r den Grabungstag.</p>
      </div>
      <div class="leitstand-command-modules">
        <article id="leitstandPersonnelModule" class="leitstand-module personnel-module"></article>
        <article id="leitstandWeatherModule" class="leitstand-module weather-module"></article>
      </div>`;
    kpiGrid.insertAdjacentElement('beforebegin', header);
  }
  header.classList.toggle('is-compact', state.compact);
}

async function loadPersonnel() {
  if (!state.client) return;
  try {
    const { data: sessionData } = await getSession();
    if (!sessionData?.session?.user) return;
    const [participants, slots, absences] = await Promise.all([
      state.client.from('participants').select('*'),
      state.client.from('participant_availability_slots').select('participant_id,availability_from,availability_to,order_index').order('order_index', { ascending: true }),
      state.client.from('participant_absences').select('participant_id,absence_from,absence_to')
    ]);
    if (!participants.error) state.participants = participants.data || [];
    if (!slots.error) state.slots = slots.data || [];
    if (!absences.error) state.absences = absences.data || [];
  } catch (error) {
    console.warn('Leitstand-Personaldaten konnten nicht geladen werden', error);
  }
}

async function loadWeather() {
  if (state.weather.length || state.loadingWeather) return;
  state.loadingWeather = true;
  try {
    const start = new Date();
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const url = new URL('https://api.brightsky.dev/weather');
    url.searchParams.set('lat', String(PLACE.lat));
    url.searchParams.set('lon', String(PLACE.lon));
    url.searchParams.set('date', toIso(start));
    url.searchParams.set('last_date', toIso(end));
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Wetterdienst ${response.status}`);
    const data = await response.json();
    state.weather = summarizeWeather(data.weather || []);
  } catch (error) {
    console.warn('Wetterdaten konnten nicht geladen werden', error);
    state.weather = [];
  } finally {
    state.loadingWeather = false;
  }
}

function renderPersonnel() {
  const host = document.getElementById('leitstandPersonnelModule');
  if (!host) return;
  const series = buildSeries();
  const stats = summarizeSeries(series);
  host.innerHTML = `
    <div class="module-head">
      <div><span>Personal</span><strong>T&auml;gliche Personalst&auml;rke</strong></div>
      <button type="button" class="mini-btn" data-leitstand-module-action="toggle-size">${state.compact ? 'normal' : 'kompakt'}</button>
    </div>
    <div class="mini-kpis"><span><b>${stats.avg}</b> &Oslash;</span><span><b>${stats.max}</b> Max</span><span><b>${stats.critical}</b> kritisch</span></div>
    <div class="leitstand-chart">${renderChart(series)}</div>`;
}

function renderWeather() {
  const host = document.getElementById('leitstandWeatherModule');
  if (!host) return;
  host.classList.toggle('is-open', state.weatherOpen);
  host.innerHTML = `
    <div class="module-head">
      <div><span>Wetter</span><strong>${PLACE.label}</strong></div>
      <div class="module-actions">
        <button type="button" class="mini-btn ${state.weatherMode === 'forecast' ? 'active' : ''}" data-leitstand-module-action="forecast">7 Tage</button>
        <button type="button" class="mini-btn ${state.weatherMode === 'radar' ? 'active' : ''}" data-leitstand-module-action="radar">Radar</button>
        <button type="button" class="mini-btn" data-leitstand-module-action="weather-open">${state.weatherOpen ? 'min' : 'mehr'}</button>
      </div>
    </div>
    ${state.weatherMode === 'radar' ? renderRadar() : renderForecast()}`;
}

function renderForecast() {
  if (state.loadingWeather) return '<div class="weather-empty">Lade DWD-Prognose ...</div>';
  if (!state.weather.length) return '<div class="weather-empty">Prognose derzeit nicht erreichbar. Radar bleibt verf&uuml;gbar.</div>';
  const days = state.weatherOpen ? state.weather : state.weather.slice(0, state.compact ? 4 : 7);
  return `<div class="weather-days">${days.map(day => `
    <div class="weather-day"><strong>${day.label}</strong><span>${day.temp}</span><small>${day.rain} mm &middot; ${day.wind}</small></div>`).join('')}</div>
    <p class="weather-source">Quelle: DWD Open Data, technische Abfrage via Bright Sky. Radar/Karte: DWD-Geodienst.</p>`;
}

function renderRadar() {
  return `<div class="weather-radar ${state.weatherOpen ? 'is-open' : ''}">
      <img src="${buildDwdRadarUrl()}" alt="DWD Niederschlagsradar f&uuml;r Kerpen-Manheim" loading="lazy">
      <div class="radar-pin">Manheim</div>
    </div>
    <div class="radar-tags"><span>Niederschlagsradar</span><span>Wind: Prognosewerte</span><span>UV: Prognosewerte</span></div>
    <p class="weather-source">Offizieller DWD-WMS: <code>dwd:RX-Produkt</code>. Wind/UV bleiben im kompakten Modul als Prognosewerte gef&uuml;hrt.</p>`;
}

function handleAction(action) {
  if (action === 'toggle-size') {
    state.compact = !state.compact;
    localStorage.setItem('leitstandModulesCompact', String(state.compact));
  }
  if (action === 'forecast') state.weatherMode = 'forecast';
  if (action === 'radar') state.weatherMode = 'radar';
  if (action === 'weather-open') state.weatherOpen = !state.weatherOpen;
  ensureHeader();
  renderPersonnel();
  renderWeather();
}

function buildSeries() {
  const counted = state.participants.filter(person => isCountedStatus(person.status) && slotsFor(person).length);
  return projectDays().map(day => {
    const planned = counted.filter(person => (
      slotsFor(person).some(slot => inRange(day, slot.availability_from, slot.availability_to))
      && !state.absences.some(absence => String(absence.participant_id) === String(person.id) && inRange(day, absence.absence_from, absence.absence_to))
    ));
    const count = planned.filter(person => personType(person) !== 'external').length;
    const externalCount = planned.filter(person => personType(person) === 'external').length;
    return { date: day, count, externalCount, totalCount: count + externalCount };
  });
}

function renderChart(series) {
  const width = 520;
  const height = state.compact ? 112 : 148;
  const margin = { top: 16, right: 18, bottom: 20, left: 28 };
  const chartW = width - margin.left - margin.right;
  const chartH = height - margin.top - margin.bottom;
  const maxY = Math.max(15, TARGET, ...series.map(day => Math.max(day.count, day.totalCount || day.count)));
  const x = index => margin.left + (index / Math.max(series.length - 1, 1)) * chartW;
  const y = value => margin.top + chartH - (value / maxY) * chartH;
  const path = series.map((day, index) => `${index ? 'L' : 'M'} ${x(index).toFixed(1)} ${y(day.count).toFixed(1)}`).join(' ');
  const totalPath = series.map((day, index) => `${index ? 'L' : 'M'} ${x(index).toFixed(1)} ${y(day.totalCount || day.count).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Personalst&auml;rke im Grabungszeitraum">
    <rect class="critical-band" x="${margin.left}" y="${y(CRITICAL)}" width="${chartW}" height="${y(0) - y(CRITICAL)}"></rect>
    ${[0, CRITICAL, TARGET, maxY].map(tick => `<line class="grid" x1="${margin.left}" x2="${width - margin.right}" y1="${y(tick)}" y2="${y(tick)}"></line>`).join('')}
    <line class="target" x1="${margin.left}" x2="${width - margin.right}" y1="${y(TARGET)}" y2="${y(TARGET)}"></line>
    <path class="line total" d="${totalPath}"></path>
    <path class="line" d="${path}"></path>
    <text class="axis" x="${margin.left}" y="${height - 5}">27.07.</text>
    <text class="axis" x="${width - margin.right}" y="${height - 5}" text-anchor="end">09.10.</text>
  </svg>`;
}

function summarizeSeries(series) {
  const counts = series.map(day => day.count);
  const totalCounts = series.map(day => day.totalCount || day.count);
  return {
    avg: counts.length ? (counts.reduce((sum, value) => sum + value, 0) / counts.length).toFixed(1).replace('.', ',') : '0',
    max: Math.max(...totalCounts, 0),
    critical: counts.filter(value => value <= CRITICAL).length
  };
}

function summarizeWeather(rows) {
  const groups = new Map();
  rows.forEach(row => {
    const day = String(row.timestamp || '').slice(0, 10);
    if (!day) return;
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day).push(row);
  });
  return [...groups.entries()].slice(0, 7).map(([day, values]) => {
    const temps = values.map(row => row.temperature).filter(Number.isFinite);
    const rain = values.map(row => row.precipitation).filter(Number.isFinite).reduce((sum, value) => sum + value, 0);
    const wind = values.map(row => row.wind_speed).filter(Number.isFinite);
    const temp = temps.length ? `${Math.round(Math.min(...temps))}&deg;/${Math.round(Math.max(...temps))}&deg;` : 'keine Temp.';
    return {
      label: new Date(`${day}T00:00:00`).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' }),
      temp,
      rain: rain.toFixed(1).replace('.', ','),
      wind: wind.length ? `${Math.round(Math.max(...wind))} km/h` : 'Wind n/a'
    };
  });
}

function buildDwdRadarUrl() {
  const url = new URL('https://maps.dwd.de/geoserver/ows');
  url.searchParams.set('service', 'WMS');
  url.searchParams.set('version', '1.1.1');
  url.searchParams.set('request', 'GetMap');
  url.searchParams.set('layers', 'dwd:RX-Produkt');
  url.searchParams.set('styles', '');
  url.searchParams.set('bbox', '6.35,50.72,6.92,51.04');
  url.searchParams.set('width', '680');
  url.searchParams.set('height', '360');
  url.searchParams.set('srs', 'EPSG:4326');
  url.searchParams.set('format', 'image/png');
  url.searchParams.set('transparent', 'true');
  return url.toString();
}

function slotsFor(person) {
  const explicit = state.slots
    .filter(slot => String(slot.participant_id) === String(person.id))
    .sort((a, b) => (a.order_index ?? 999) - (b.order_index ?? 999))
    .filter(slot => slot.availability_from && slot.availability_to);
  return explicit.length ? explicit : (person.availability_from && person.availability_to ? [person] : []);
}

function projectDays() {
  const days = [];
  for (let date = new Date(START); date <= END; date.setDate(date.getDate() + 1)) days.push(new Date(date));
  return days;
}

function inRange(day, from, to) {
  const start = parseDate(from);
  const end = parseDate(to);
  return Boolean(start && end && day >= start && day <= end);
}

function parseDate(value) {
  if (!value) return null;
  const [year, month, day] = String(value).slice(0, 10).split('-').map(Number);
  return year && month && day ? new Date(year, month - 1, day) : null;
}

function isCountedStatus(status) {
  const value = String(status || '').toLowerCase().replaceAll('ä', 'ae').replaceAll(' ', '_');
  return ['gesetzt', 'zugesagt', 'zu_klaeren', 'erweiterbar', 'unklar'].includes(value);
}

function personType(person) {
  return String(person?.person_type || 'student') === 'external' ? 'external' : 'student';
}

function isLeitstandActive() {
  const app = document.getElementById('app');
  return Boolean(app && !app.classList.contains('hidden') && document.getElementById('dashboardTab')?.classList.contains('active'));
}

function getSession() {
  return window.getManheimAuthSession?.(state.client) || state.client.auth.getSession();
}

function toIso(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function installStyles() {
  if (document.getElementById('leitstandCommandStyles')) return;
  const style = document.createElement('style');
  style.id = 'leitstandCommandStyles';
  style.textContent = `
    #dashboardTab .leitstand-kpi-strip{grid-template-columns:repeat(4,minmax(130px,1fr));gap:10px;margin-bottom:14px}
    #dashboardTab .leitstand-kpi-strip .panel{padding:12px 14px;border-radius:8px}
    #dashboardTab .leitstand-kpi-strip .value{font-size:1.55rem;line-height:1}
    #dashboardTab .leitstand-kpi-strip .kpi-label,#dashboardTab .leitstand-kpi-strip .kpi-note{font-size:.78rem}
    .leitstand-command-header{display:grid;grid-template-columns:minmax(230px,.62fr) minmax(650px,1.9fr);gap:16px;align-items:start;margin-bottom:14px}
    .leitstand-command-copy{padding:12px 0}.leitstand-command-copy span,.module-head span{color:#64758a;font-size:.72rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.leitstand-command-copy h3{margin:4px 0 6px;font-size:1.15rem}.leitstand-command-copy p{margin:0;color:var(--muted);line-height:1.35}
    .leitstand-command-modules{display:grid;grid-template-columns:repeat(2,minmax(300px,1fr));gap:12px}.leitstand-module{min-width:0;border:1px solid #d8e3ee;border-radius:12px;background:rgba(255,255,255,.9);box-shadow:0 12px 26px rgba(27,48,70,.08);padding:12px}.personnel-module{background:#fffaf2;border-color:#e3d5c3}
    .module-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:8px}.module-head strong{display:block;color:var(--text);font-size:.95rem}.module-actions,.mini-kpis,.radar-tags{display:flex;gap:6px;flex-wrap:wrap;align-items:center}.mini-btn{border:1px solid #d8e3ee;background:#fff;color:var(--text);border-radius:999px;padding:4px 9px;font-size:.72rem;font-weight:800;cursor:pointer}.mini-btn.active{background:#1f78d8;border-color:#1f78d8;color:#fff}.mini-kpis span,.radar-tags span{border:1px solid #e1e8f0;border-radius:999px;padding:3px 7px;background:rgba(255,255,255,.72);color:#64758a;font-size:.7rem;font-weight:700}
    .leitstand-chart{height:148px;border-radius:10px;background:#fffdf8;border:1px solid rgba(47,42,36,.08);overflow:hidden}.leitstand-command-header.is-compact .leitstand-chart{height:112px}.leitstand-chart svg{width:100%;height:100%;display:block}.leitstand-chart .grid{stroke:rgba(47,42,36,.12)}.leitstand-chart .critical-band{fill:rgba(220,38,38,.14)}.leitstand-chart .target{stroke:#16a34a;stroke-width:2;stroke-dasharray:7 6}.leitstand-chart .line{fill:none;stroke:#2563eb;stroke-width:3;stroke-linecap:round;stroke-linejoin:round}.leitstand-chart .line.total{stroke:#eab308;stroke-width:2.6;stroke-dasharray:6 4}.leitstand-chart .axis{fill:#766b5d;font-size:10px}
    .weather-days{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px}.weather-day{display:grid;gap:3px;border:1px solid #e1e8f0;border-radius:8px;padding:7px;background:#f8fbff;min-width:0}.weather-day strong,.weather-day span,.weather-day small{white-space:nowrap}.weather-day strong,.weather-day small,.weather-source,.weather-empty{font-size:.72rem}.weather-day span{font-weight:800}.weather-day small,.weather-source,.weather-empty{color:var(--muted)}.weather-source{margin:8px 0 0}.weather-radar{position:relative;height:142px;border-radius:10px;overflow:hidden;background:linear-gradient(135deg,#eef5fb,#dce8f3);border:1px solid #d8e3ee}.weather-radar.is-open{height:230px}.weather-radar img{width:100%;height:100%;object-fit:cover;opacity:.86}.radar-pin{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background:#0f2740;color:#fff;border-radius:999px;padding:4px 8px;font-size:.72rem;font-weight:800;box-shadow:0 6px 16px rgba(15,39,64,.22)}
    .dashboard-grid{grid-template-columns:minmax(0,1.2fr) minmax(320px,.8fr);align-items:start}.dashboard-grid .panel:first-child{grid-row:span 2}
    @media (max-width:1280px){.leitstand-command-header{grid-template-columns:1fr}.leitstand-command-copy{padding-bottom:0}}@media (max-width:980px){.leitstand-command-modules,#dashboardTab .leitstand-kpi-strip,.weather-days{grid-template-columns:repeat(2,minmax(0,1fr))}}
  `;
  document.head.appendChild(style);
}

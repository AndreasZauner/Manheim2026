const PLACE = {
  label: '50170 Manheim (Kerpen)',
  lat: 50.889,
  lon: 6.646
};

const state = {
  size: localStorage.getItem('leitstandWeatherSize') || 'normal',
  view: localStorage.getItem('leitstandWeatherView') || 'forecast',
  layer: localStorage.getItem('leitstandWeatherLayer') || 'radar',
  forecast: null,
  uv: null,
  loading: false,
  error: '',
  timer: null,
  rendering: false
};

const WEATHER_LABELS = {
  0: ['Sonnig', 'sun'],
  1: ['Heiter', 'sun'],
  2: ['Wolkig', 'cloud-sun'],
  3: ['Bedeckt', 'cloud'],
  45: ['Nebel', 'fog'],
  48: ['Nebel', 'fog'],
  51: ['Niesel', 'rain'],
  53: ['Niesel', 'rain'],
  55: ['Niesel', 'rain'],
  61: ['Regen', 'rain'],
  63: ['Regen', 'rain'],
  65: ['Starkregen', 'rain'],
  80: ['Schauer', 'rain'],
  81: ['Schauer', 'rain'],
  82: ['Schauer', 'storm'],
  95: ['Gewitter', 'storm'],
  96: ['Gewitter', 'storm'],
  99: ['Gewitter', 'storm']
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', installWeatherModule);
} else {
  installWeatherModule();
}

function installWeatherModule() {
  if (window.__leitstandWeatherV2Installed) return;
  window.__leitstandWeatherV2Installed = true;
  installStyles();
  bindEvents();
  loadWeather();
  const observer = new MutationObserver(() => scheduleRender());
  observer.observe(document.body, { childList: true, subtree: true });
  scheduleRender(100);
  scheduleRender(900);
}

function bindEvents() {
  document.addEventListener('click', event => {
    const button = event.target?.closest?.('[data-weather-v2-action]');
    if (!button) return;
    const action = button.dataset.weatherV2Action;
    if (action === 'min') state.size = 'min';
    if (action === 'normal') state.size = 'normal';
    if (action === 'max') state.size = 'max';
    if (action === 'forecast') state.view = 'forecast';
    if (action === 'map') state.view = 'map';
    if (action === 'refresh') {
      state.forecast = null;
      state.uv = null;
      loadWeather(true);
    }
    if (action?.startsWith('layer:')) {
      state.view = 'map';
      state.layer = action.split(':')[1] || 'radar';
    }
    localStorage.setItem('leitstandWeatherSize', state.size);
    localStorage.setItem('leitstandWeatherView', state.view);
    localStorage.setItem('leitstandWeatherLayer', state.layer);
    scheduleRender();
  });
}

function scheduleRender(delay = 60) {
  window.clearTimeout(state.timer);
  state.timer = window.setTimeout(render, delay);
}

async function loadWeather(force = false) {
  if ((state.forecast && !force) || state.loading) return;
  state.loading = true;
  state.error = '';
  scheduleRender();
  try {
    const [forecast, uv] = await Promise.all([fetchDwdIconForecast(), fetchUvForecast()]);
    state.forecast = forecast;
    state.uv = uv;
  } catch (error) {
    console.warn('Wettermodul konnte keine Prognose laden', error);
    state.error = error?.message || String(error);
  } finally {
    state.loading = false;
    scheduleRender();
  }
}

async function fetchDwdIconForecast() {
  const url = new URL('https://api.open-meteo.com/v1/dwd-icon');
  url.searchParams.set('latitude', String(PLACE.lat));
  url.searchParams.set('longitude', String(PLACE.lon));
  url.searchParams.set('timezone', 'Europe/Berlin');
  url.searchParams.set('forecast_days', '7');
  url.searchParams.set('wind_speed_unit', 'kmh');
  url.searchParams.set('daily', [
    'weather_code',
    'temperature_2m_max',
    'temperature_2m_min',
    'precipitation_sum',
    'precipitation_hours',
    'wind_speed_10m_max',
    'wind_gusts_10m_max',
    'sunshine_duration'
  ].join(','));
  url.searchParams.set('current', [
    'temperature_2m',
    'apparent_temperature',
    'precipitation',
    'weather_code',
    'cloud_cover',
    'wind_speed_10m',
    'wind_gusts_10m'
  ].join(','));
  const response = await fetch(url);
  if (!response.ok) throw new Error(`DWD-ICON-Prognose ${response.status}`);
  return response.json();
}

async function fetchUvForecast() {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(PLACE.lat));
  url.searchParams.set('longitude', String(PLACE.lon));
  url.searchParams.set('timezone', 'Europe/Berlin');
  url.searchParams.set('forecast_days', '7');
  url.searchParams.set('daily', 'uv_index_max');
  const response = await fetch(url);
  if (!response.ok) return null;
  return response.json();
}

function render() {
  if (state.rendering) return;
  const host = document.getElementById('leitstandWeatherModule');
  if (!host) return;
  state.rendering = true;
  const signature = [
    state.size,
    state.view,
    state.layer,
    state.loading,
    state.error,
    state.forecast?.current?.time || '',
    state.uv?.daily?.time?.join('|') || ''
  ].join('::');
  if (host.dataset.weatherV2Signature !== signature || !host.querySelector('.weather-v2-shell')) {
    host.dataset.weatherV2Signature = signature;
    host.classList.add('weather-v2-module');
    host.classList.toggle('is-weather-min', state.size === 'min');
    host.classList.toggle('is-weather-max', state.size === 'max');
    host.innerHTML = renderModule();
  }
  state.rendering = false;
}

function renderModule() {
  if (state.size === 'min') return renderMin();
  return `
    <div class="weather-v2-shell">
      ${renderHeader()}
      ${state.loading ? '<div class="weather-v2-loading">Lade DWD-ICON-Prognose ...</div>' : ''}
      ${state.error ? `<div class="weather-v2-error">Wetterdaten derzeit nicht erreichbar: ${escapeHtml(state.error)}</div>` : ''}
      ${state.view === 'map' ? renderMapView() : renderForecastView()}
    </div>
  `;
}

function renderMin() {
  const today = getToday();
  return `
    <div class="weather-v2-shell weather-v2-min">
      <div>
        <span class="weather-v2-eyebrow">Wetter</span>
        <strong>${weatherIcon(today?.icon)} ${today?.tempText || '--'} ${today?.label || PLACE.label}</strong>
      </div>
      <div class="weather-v2-actions">
        <button type="button" class="mini-btn" data-weather-v2-action="normal">öffnen</button>
        <button type="button" class="mini-btn" data-weather-v2-action="max">max</button>
      </div>
    </div>
  `;
}

function renderHeader() {
  const today = getToday();
  return `
    <div class="weather-v2-head">
      <div>
        <span class="weather-v2-eyebrow">Wetter · ${PLACE.label}</span>
        <strong>${weatherIcon(today?.icon)} ${today?.summary || '7-Tage-Prognose'}</strong>
      </div>
      <div class="weather-v2-actions">
        <button type="button" class="mini-btn ${state.view === 'forecast' ? 'active' : ''}" data-weather-v2-action="forecast">Prognose</button>
        <button type="button" class="mini-btn ${state.view === 'map' ? 'active' : ''}" data-weather-v2-action="map">Karte</button>
        <button type="button" class="mini-btn" data-weather-v2-action="min">min</button>
        <button type="button" class="mini-btn" data-weather-v2-action="max">max</button>
      </div>
    </div>
  `;
}

function renderForecastView() {
  const days = getDays();
  if (!days.length) return '<div class="weather-v2-empty">Noch keine Prognosedaten geladen.</div>';
  const today = days[0];
  return `
    <div class="weather-v2-current">
      <div class="weather-v2-icon">${weatherIcon(today.icon)}</div>
      <div>
        <span>Heute</span>
        <strong>${today.tempText}</strong>
        <small>${today.labelText}</small>
      </div>
      <div><span>Regen</span><strong>${today.rainText}</strong><small>${today.rainHours} h</small></div>
      <div><span>Wind</span><strong>${today.windText}</strong><small>Böen ${today.gustText}</small></div>
      <div><span>UV</span><strong>${today.uvText}</strong><small>${uvRisk(today.uv)}</small></div>
    </div>
    <div class="weather-v2-days">
      ${days.map(day => renderDay(day)).join('')}
    </div>
    <p class="weather-v2-source">Prognose: Open-Meteo DWD ICON für ${PLACE.label}. UV separat über Open-Meteo Forecast.</p>
  `;
}

function renderDay(day) {
  return `
    <div class="weather-v2-day">
      <div class="weather-v2-day-top"><strong>${day.shortDate}</strong><span>${weatherIcon(day.icon)}</span></div>
      <b>${day.tempText}</b>
      <small>${day.labelText}</small>
      <div class="weather-v2-bar"><span style="width:${Math.min(day.rain * 12, 100)}%"></span></div>
      <em>${day.rainText} · ${day.windText} · UV ${day.uvText}</em>
    </div>
  `;
}

function renderMapView() {
  const layer = mapLayer();
  return `
    <div class="weather-v2-map-actions">
      <button type="button" class="mini-btn ${state.layer === 'radar' ? 'active' : ''}" data-weather-v2-action="layer:radar">Niederschlag</button>
      <button type="button" class="mini-btn ${state.layer === 'warnings' ? 'active' : ''}" data-weather-v2-action="layer:warnings">Warnungen</button>
      <button type="button" class="mini-btn ${state.layer === 'wind' ? 'active' : ''}" data-weather-v2-action="layer:wind">Wind</button>
      <button type="button" class="mini-btn ${state.layer === 'uv' ? 'active' : ''}" data-weather-v2-action="layer:uv">UV</button>
      <button type="button" class="mini-btn" data-weather-v2-action="refresh">neu laden</button>
    </div>
    <div class="weather-v2-map-frame">
      <img src="${layer.url}" alt="${layer.title}" loading="lazy" onerror="this.closest('.weather-v2-map-frame').classList.add('has-error')">
      <div class="weather-v2-pin">Manheim</div>
      <div class="weather-v2-map-error">DWD-Layer konnte nicht geladen werden. Bitte später erneut versuchen.</div>
    </div>
    <div class="weather-v2-overlay-note">
      <strong>${layer.title}</strong>
      <span>${layer.description}</span>
    </div>
    <p class="weather-v2-source">Kartenlayer: DWD Geoserver WMS. Die Werte in der Prognose bleiben zusätzlich als kompakte Tageskennzahlen sichtbar.</p>
  `;
}

function getDays() {
  const daily = state.forecast?.daily;
  if (!daily?.time?.length) return [];
  return daily.time.map((date, index) => {
    const code = Number(daily.weather_code?.[index] ?? 3);
    const meta = WEATHER_LABELS[code] || ['Wetterlage', 'cloud'];
    const rain = Number(daily.precipitation_sum?.[index] ?? 0);
    const uv = Number(state.uv?.daily?.uv_index_max?.[index] ?? NaN);
    return {
      date,
      shortDate: new Date(`${date}T00:00:00`).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' }),
      labelText: meta[0],
      icon: meta[1],
      tempText: `${round(daily.temperature_2m_min?.[index])}°/${round(daily.temperature_2m_max?.[index])}°`,
      rain,
      rainText: `${formatDecimal(rain)} mm`,
      rainHours: round(daily.precipitation_hours?.[index] ?? 0),
      windText: `${round(daily.wind_speed_10m_max?.[index] ?? 0)} km/h`,
      gustText: `${round(daily.wind_gusts_10m_max?.[index] ?? 0)} km/h`,
      uv,
      uvText: Number.isFinite(uv) ? formatDecimal(uv) : 'n/a',
      summary: `${round(daily.temperature_2m_max?.[index])}° · ${meta[0]}`,
    };
  });
}

function getToday() {
  return getDays()[0];
}

function mapLayer() {
  const layers = {
    radar: {
      layer: 'dwd:Niederschlagsradar',
      styles: '',
      title: 'DWD Niederschlagsradar',
      description: 'Aktuelles Niederschlagsradar als offizieller DWD-WMS-Layer.'
    },
    warnings: {
      layer: 'dwd:Warnungen_Gemeinden_vereinigt',
      styles: '',
      title: 'DWD Wetterwarnungen',
      description: 'Amtliche Warnungen auf Gemeindeebene, zusammengefasst.'
    },
    wind: {
      layer: 'dwd:Icon_reg025_fd_sl_UV10M',
      styles: 'icon_reg025_fd_sl_uv10m_wmc_windbarbs',
      title: 'DWD Wind 10 m',
      description: 'ICON-Modell, Wind in 10 m Höhe mit Windpfeilen als offizieller DWD-WMS-Layer.'
    },
    uv: {
      layer: 'dwd:UVIndex',
      styles: 'uvindex',
      title: 'DWD UV-Index',
      description: 'Maximaler UV-Index des Tages aus ICON-EU als offizieller DWD-WMS-Layer.'
    }
  };
  const layer = layers[state.layer] || layers.radar;
  return { ...layer, url: buildWmsUrl(layer.layer, layer.styles) };
}

function buildWmsUrl(layer, styles = '') {
  const url = new URL('https://maps.dwd.de/geoserver/wms');
  url.searchParams.set('SERVICE', 'WMS');
  url.searchParams.set('VERSION', '1.1.1');
  url.searchParams.set('REQUEST', 'GetMap');
  url.searchParams.set('LAYERS', layer);
  url.searchParams.set('STYLES', styles);
  url.searchParams.set('BBOX', '6.25,50.72,7.02,51.12');
  url.searchParams.set('WIDTH', state.size === 'max' ? '980' : '720');
  url.searchParams.set('HEIGHT', state.size === 'max' ? '480' : '330');
  url.searchParams.set('SRS', 'EPSG:4326');
  url.searchParams.set('FORMAT', 'image/png');
  url.searchParams.set('TRANSPARENT', 'true');
  return url.toString();
}

function weatherIcon(type) {
  if (type === 'sun') return '☀';
  if (type === 'cloud-sun') return '⛅';
  if (type === 'rain') return '🌧';
  if (type === 'storm') return '⛈';
  if (type === 'fog') return '≋';
  return '☁';
}

function uvRisk(value) {
  if (!Number.isFinite(value)) return 'keine UV-Daten';
  if (value < 3) return 'niedrig';
  if (value < 6) return 'mittel';
  if (value < 8) return 'hoch';
  return 'sehr hoch';
}

function round(value) {
  return Math.round(Number(value) || 0);
}

function formatDecimal(value) {
  return Number(value || 0).toFixed(1).replace('.', ',');
}

function escapeHtml(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function installStyles() {
  if (document.getElementById('dashboardWeatherV2Styles')) return;
  const style = document.createElement('style');
  style.id = 'dashboardWeatherV2Styles';
  style.textContent = `
    #leitstandWeatherModule.weather-v2-module{background:#f8fbff;border-color:#cfddeb}
    #leitstandWeatherModule.is-weather-min{min-height:72px;align-self:start}
    #leitstandWeatherModule.is-weather-max{grid-column:span 2}
    .weather-v2-shell{display:grid;gap:9px}
    .weather-v2-min{grid-template-columns:1fr auto;align-items:center;min-height:48px}
    .weather-v2-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
    .weather-v2-eyebrow{display:block;color:#64758a;font-size:.72rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
    .weather-v2-head strong,.weather-v2-min strong{display:block;color:var(--text);font-size:.95rem}
    .weather-v2-actions,.weather-v2-map-actions{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
    .weather-v2-current{display:grid;grid-template-columns:auto 1.2fr repeat(3, minmax(70px,.8fr));gap:8px;align-items:center;border:1px solid #d8e3ee;background:#fff;border-radius:10px;padding:9px}
    .weather-v2-current>div{min-width:0}.weather-v2-current span{display:block;color:#64758a;font-size:.7rem;font-weight:800;text-transform:uppercase}.weather-v2-current strong{font-size:1.05rem}.weather-v2-current small{color:var(--muted);font-size:.72rem}.weather-v2-icon{font-size:2rem;line-height:1}
    .weather-v2-days{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px}
    .weather-v2-day{display:grid;gap:4px;border:1px solid #d8e3ee;border-radius:8px;background:#fff;padding:7px;min-width:0}.weather-v2-day-top{display:flex;justify-content:space-between;align-items:center}.weather-v2-day strong,.weather-v2-day b,.weather-v2-day small,.weather-v2-day em{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.weather-v2-day strong{font-size:.72rem}.weather-v2-day b{font-size:.95rem}.weather-v2-day small{color:var(--muted);font-size:.72rem}.weather-v2-day em{color:#4f6278;font-size:.68rem;font-style:normal}
    .weather-v2-bar{height:5px;border-radius:999px;background:#eaf1f8;overflow:hidden}.weather-v2-bar span{display:block;height:100%;background:#2563eb;border-radius:999px}
    .weather-v2-map-frame{position:relative;height:168px;border:1px solid #cfddeb;border-radius:10px;overflow:hidden;background:linear-gradient(135deg,#eaf2f9,#dce8f3)}#leitstandWeatherModule.is-weather-max .weather-v2-map-frame{height:360px}.weather-v2-map-frame img{width:100%;height:100%;object-fit:cover;display:block;opacity:.94}.weather-v2-pin{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background:#0f2740;color:#fff;border-radius:999px;padding:4px 8px;font-size:.72rem;font-weight:800;box-shadow:0 6px 16px rgba(15,39,64,.22)}.weather-v2-map-error{display:none;position:absolute;inset:auto 10px 10px 10px;background:#fff6f6;border:1px solid #f2b8b8;border-radius:8px;color:#9f1d1d;padding:8px;font-size:.78rem}.weather-v2-map-frame.has-error .weather-v2-map-error{display:block}
    .weather-v2-overlay-note{display:grid;gap:2px;border:1px solid #d8e3ee;background:#fff;border-radius:8px;padding:8px}.weather-v2-overlay-note strong{font-size:.85rem}.weather-v2-overlay-note span,.weather-v2-source,.weather-v2-loading,.weather-v2-error,.weather-v2-empty{color:var(--muted);font-size:.72rem}.weather-v2-error{color:#9f1d1d;background:#fff6f6;border:1px solid #f2b8b8;border-radius:8px;padding:8px}.weather-v2-source{margin:0}
    @media (max-width:980px){#leitstandWeatherModule.is-weather-max{grid-column:auto}.weather-v2-current{grid-template-columns:1fr 1fr}.weather-v2-days{grid-template-columns:repeat(2,minmax(0,1fr))}}
  `;
  document.head.appendChild(style);
}

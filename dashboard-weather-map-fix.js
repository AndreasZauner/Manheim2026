(function () {
  if (window.__leitstandWeatherMapFixInstalled) return;
  window.__leitstandWeatherMapFixInstalled = true;

  const PLACE = { label: 'Kerpen-Manheim', lat: 50.889, lon: 6.646 };
  const WMS_URL = 'https://maps.dwd.de/geoserver/wms';
  const FORECAST_CAPABILITIES_URL = 'https://maps.dwd.de/geoserver/dwd/Radar_rv_product_1x1km_ger/wms?service=WMS&version=1.3.0&request=GetCapabilities';
  const ICON_24H_CAPABILITIES_URL = 'https://maps.dwd.de/geoserver/dwd/Icon_reg025_fd_sl_TOTPREC/wms?service=WMS&version=1.3.0&request=GetCapabilities';
  const BASE_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  const LAYERS = {
    radar: {
      layer: 'dwd:Niederschlagsradar',
      styles: '',
      opacity: 0.72,
      title: 'DWD Niederschlagsradar',
      legend: 'Farbskala: staerkere Farben bedeuten staerkeren Niederschlag.'
    },
    forecast: {
      layer: 'dwd:Radar_rv_product_1x1km_ger',
      styles: 'radar_rv_product_1x1km_ger',
      opacity: 0.72,
      title: 'DWD Niederschlagsprognose',
      legend: 'RV-Radar: Analyse und Niederschlagsvorhersage in 5-Minuten-Schritten.',
      timeControl: true,
      capabilitiesUrl: FORECAST_CAPABILITIES_URL,
      horizonHours: 2,
      maxFrames: 25,
      sourceLabel: 'DWD RV',
      note: 'Radar-Nowcast: Zugrichtung vorhandener Niederschlagsfelder.'
    },
    model24: {
      layer: 'dwd:Icon_reg025_fd_sl_TOTPREC',
      styles: 'icon_reg025_fd_sl_totprec_wmc_isoarea',
      opacity: 0.55,
      title: 'DWD ICON 24h-Niederschlag',
      legend: 'ICON-Modell: akkumulierte Niederschlagsprognose bis zum gewaehlten Zeitpunkt.',
      timeControl: true,
      capabilitiesUrl: ICON_24H_CAPABILITIES_URL,
      horizonHours: 24,
      maxFrames: 25,
      sourceLabel: 'DWD ICON',
      note: '24h-Planungsprognose: Modellansicht, keine Radarbeobachtung.'
    },
    warnings: {
      layer: 'dwd:Warnungen_Gemeinden_vereinigt',
      styles: '',
      opacity: 0.58,
      title: 'DWD Wetterwarnungen',
      legend: 'Warnfarben folgen der amtlichen DWD-Warnskala.'
    },
    wind: {
      layer: 'dwd:Icon_reg025_fd_sl_UV10M',
      styles: 'icon_reg025_fd_sl_uv10m_wmc_windbarbs',
      opacity: 0.8,
      title: 'DWD Wind 10 m',
      legend: 'Windfahnen zeigen Richtung und Staerke.'
    },
    uv: {
      layer: 'dwd:UVIndex',
      styles: 'uvindex',
      opacity: 0.62,
      title: 'DWD UV-Index',
      legend: 'UV-Farben markieren niedrige bis sehr hohe Belastung.'
    }
  };

  let leafletReady = null;
  let map = null;
  let weatherLayer = null;
  let marker = null;
  let currentFrame = null;
  let currentKey = '';
  let currentForecastIndex = -1;
  const forecastFramePromises = new Map();
  let forecastFrames = [];
  let timer = null;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installWeatherMapFix);
  } else {
    installWeatherMapFix();
  }

  function installWeatherMapFix() {
    installStyles();
    document.addEventListener('click', onLegendToggle);
    document.addEventListener('keydown', onLegendKeydown);
    scheduleApply(80);
    scheduleApply(700);
    const observer = new MutationObserver(mutations => {
      if (mutations.every(isInternalMapMutation)) return;
      scheduleApply();
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    window.addEventListener('resize', () => scheduleApply(120), { passive: true });
  }

  function isInternalMapMutation(mutation) {
    const target = mutation.target?.nodeType === Node.ELEMENT_NODE
      ? mutation.target
      : mutation.target?.parentElement;
    return Boolean(target?.closest?.('.weather-map-fix-canvas,.weather-map-fix-legend,.weather-map-fix-timeline'));
  }

  function scheduleApply(delay = 70) {
    window.clearTimeout(timer);
    timer = window.setTimeout(applyWeatherMapFix, delay);
  }

  async function applyWeatherMapFix() {
    const host = document.getElementById('leitstandWeatherModule');
    if (!host) return;
    host.classList.add('has-weather-map-fix');
    ensureForecastButton(host);

    const frame = host.querySelector('.weather-v2-map-frame');
    if (!frame || host.classList.contains('is-weather-min')) {
      destroyMap();
      return;
    }

    const key = activeLayer(host);
    if (!map || currentFrame !== frame || !frame.querySelector('.weather-map-fix-canvas')) {
      await createMap(frame, key);
      return;
    }

    syncWeatherLayer(key);
    invalidateMap();
  }

  function activeLayer(host) {
    const active = host.querySelector('.weather-v2-map-actions [data-weather-v2-action^="layer:"].active');
    const stored = localStorage.getItem('leitstandWeatherLayer');
    const action = active?.dataset?.weatherV2Action || (stored ? `layer:${stored}` : 'layer:radar');
    const key = action.split(':')[1] || 'radar';
    return LAYERS[key] ? key : 'radar';
  }

  function ensureForecastButton(host) {
    const actions = host.querySelector('.weather-v2-map-actions');
    if (!actions) return;
    const radar = actions.querySelector('[data-weather-v2-action="layer:radar"]');
    const forecast = ensureLayerButton(actions, 'forecast', 'Prognose', radar);
    ensureLayerButton(actions, 'model24', '24h', forecast);
    syncInjectedButtonState(actions);
  }

  function ensureLayerButton(actions, key, label, afterElement) {
    const existing = actions.querySelector(`[data-weather-v2-action="layer:${key}"]`);
    if (existing) return existing;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'mini-btn';
    button.dataset.weatherV2Action = `layer:${key}`;
    button.textContent = label;
    if (afterElement?.nextSibling) actions.insertBefore(button, afterElement.nextSibling);
    else if (afterElement) actions.appendChild(button);
    else actions.prepend(button);
    return button;
  }

  function syncInjectedButtonState(actions) {
    const stored = localStorage.getItem('leitstandWeatherLayer');
    if (!stored || !LAYERS[stored]) return;
    actions.querySelectorAll('[data-weather-v2-action^="layer:"]').forEach(button => {
      button.classList.toggle('active', button.dataset.weatherV2Action === `layer:${stored}`);
    });
  }

  async function createMap(frame, key) {
    destroyMap();
    currentFrame = frame;
    currentKey = '';
    frame.classList.add('has-interactive-map', 'is-loading');
    frame.dataset.weatherMapFix = key;
    frame.innerHTML = `
      <div class="weather-map-fix-canvas" aria-label="Interaktive Wetterkarte"></div>
      <div class="weather-map-fix-legend" role="button" tabindex="0" aria-expanded="false" title="Legende vergroessern">
        <strong>Legende</strong>
        <img src="${legendUrl(LAYERS[key] || LAYERS.radar)}" alt="Legende" loading="lazy" onerror="this.classList.add('is-hidden')">
        <span>${(LAYERS[key] || LAYERS.radar).legend}</span>
      </div>
      <div class="weather-map-fix-timeline" aria-live="polite"></div>
      <div class="weather-map-fix-loading">Karte wird geladen ...</div>
    `;

    try {
      await loadLeaflet();
      if (!window.L) throw new Error('Leaflet nicht verfuegbar');

      const canvas = frame.querySelector('.weather-map-fix-canvas');
      map = window.L.map(canvas, {
        zoomControl: true,
        attributionControl: true,
        scrollWheelZoom: true,
        dragging: true,
        doubleClickZoom: true,
        touchZoom: true
      }).setView([PLACE.lat, PLACE.lon], 11);

      window.L.tileLayer(BASE_TILE_URL, {
        maxZoom: 19,
        detectRetina: true,
        attribution: '&copy; OpenStreetMap'
      }).addTo(map);

      marker = window.L.circleMarker([PLACE.lat, PLACE.lon], {
        radius: 6,
        color: '#0f2740',
        weight: 2,
        fillColor: '#2e7d32',
        fillOpacity: 0.95
      }).addTo(map);
      marker.bindPopup(PLACE.label);

      syncWeatherLayer(key);
      frame.classList.remove('is-loading');
      invalidateMap();
    } catch (error) {
      console.warn('Interaktive Wetterkarte konnte nicht geladen werden', error);
      frame.classList.remove('is-loading');
      frame.insertAdjacentHTML('beforeend', '<div class="weather-map-fix-error">Interaktive Karte konnte nicht geladen werden.</div>');
    }
  }

  function syncWeatherLayer(key) {
    if (!map) return;
    const selected = LAYERS[key] || LAYERS.radar;
    if (weatherLayer && currentKey === key) {
      const timeline = currentFrame?.querySelector('.weather-map-fix-timeline');
      if (selected.timeControl && (!timeline?.classList.contains('is-visible') || !timeline.querySelector('input'))) {
        syncTimeline(selected);
      }
      return;
    }
    if (weatherLayer) map.removeLayer(weatherLayer);
    const params = {
      layers: selected.layer,
      styles: selected.styles,
      format: 'image/png',
      transparent: true,
      version: '1.1.1',
      opacity: selected.opacity,
      attribution: 'DWD'
    };
    if (selected.timeControl) params.time = 'current';
    weatherLayer = window.L.tileLayer.wms(WMS_URL, params).addTo(map);
    currentKey = key;
    currentForecastIndex = -1;
    updateFrameLegend(selected);
    syncTimeline(selected);
    if (marker) marker.bringToFront();
  }

  function updateFrameLegend(selected) {
    const legend = currentFrame?.querySelector('.weather-map-fix-legend');
    if (!legend) return;
    const image = legend.querySelector('img');
    const text = legend.querySelector('span');
    if (image) {
      image.classList.remove('is-hidden');
      image.alt = `Legende ${selected.title}`;
      image.src = legendUrl(selected);
    }
    if (text) text.textContent = selected.legend;
    legend.classList.remove('is-expanded');
    legend.setAttribute('aria-expanded', 'false');
    legend.title = 'Legende vergroessern';
  }

  async function syncTimeline(selected) {
    const timeline = currentFrame?.querySelector('.weather-map-fix-timeline');
    if (!timeline || !weatherLayer) return;
    if (!selected.timeControl) {
      timeline.classList.remove('is-visible');
      timeline.innerHTML = '';
      currentForecastIndex = -1;
      return;
    }

    timeline.classList.add('is-visible');
    timeline.innerHTML = '<span>Niederschlagsprognose wird geladen ...</span>';
    try {
      forecastFrames = await getForecastFrames(selected);
      if (!forecastFrames.length) throw new Error('Keine Zeitschritte verfuegbar');
      const initialIndex = currentForecastIndex >= 0 ? currentForecastIndex : 0;
      renderTimeline(Math.min(initialIndex, forecastFrames.length - 1), false, selected);
    } catch (error) {
      console.warn('DWD-Zeitachse konnte nicht geladen werden', error);
      forecastFrames = buildFallbackForecastFrames(selected);
      renderTimeline(0, true, selected);
    }
  }

  function renderTimeline(index, fallback = false, selected = LAYERS.forecast) {
    const timeline = currentFrame?.querySelector('.weather-map-fix-timeline');
    if (!timeline || !weatherLayer || !forecastFrames.length) return;
    const signature = `${currentKey}:${forecastFrames.length}:${fallback ? 'fallback' : 'dwd'}`;
    if (timeline.dataset.timelineSignature !== signature) {
      timeline.dataset.timelineSignature = signature;
      timeline.innerHTML = `
        <div class="weather-map-fix-time-head">
          <strong data-weather-time-label></strong>
          <span data-weather-time-source></span>
        </div>
        <input type="range" min="0" max="${forecastFrames.length - 1}" value="${index}" step="1" aria-label="Zeitpunkt der Niederschlagsprognose">
        <div class="weather-map-fix-time-strip" aria-label="Zeitfenster der Prognose">
          ${forecastFrames.map((frame, frameIndex) => `<button type="button" data-weather-frame="${frameIndex}" title="${frame.label}"></button>`).join('')}
        </div>
        <div class="weather-map-fix-time-range">
          <span>${forecastFrames[0]?.short || ''}</span>
          <span>${forecastFrames[forecastFrames.length - 1]?.short || ''}</span>
        </div>
        <p class="weather-map-fix-time-note">${selected.note}</p>
      `;
      timeline.querySelector('input')?.addEventListener('input', event => {
        setForecastFrame(Number(event.currentTarget.value) || 0, fallback, selected);
      });
      timeline.querySelectorAll('[data-weather-frame]').forEach(button => {
        button.addEventListener('click', event => {
          renderTimeline(Number(event.currentTarget.dataset.weatherFrame) || 0, fallback, selected);
        });
      });
    }
    const range = timeline.querySelector('input');
    if (range) {
      range.max = String(forecastFrames.length - 1);
      range.value = String(index);
    }
    setForecastFrame(index, fallback, selected);
  }

  function setForecastFrame(index, fallback = false, selected = LAYERS.forecast) {
    if (!weatherLayer || !forecastFrames.length) return;
    const safeIndex = Math.max(0, Math.min(index, forecastFrames.length - 1));
    const frame = forecastFrames[safeIndex] || forecastFrames[0];
    currentForecastIndex = safeIndex;
    const params = { time: frame.value };
    if (frame.referenceTime) params.REFERENCE_TIME = frame.referenceTime;
    weatherLayer.setParams(params, false);
    const timeline = currentFrame?.querySelector('.weather-map-fix-timeline');
    const label = timeline?.querySelector('[data-weather-time-label]');
    const source = timeline?.querySelector('[data-weather-time-source]');
    const range = timeline?.querySelector('input');
    if (label) label.textContent = frame.label;
    if (source) source.textContent = fallback ? 'Fallback-Zeitachse' : selected.sourceLabel;
    if (range && range.value !== String(safeIndex)) range.value = String(safeIndex);
    timeline?.querySelectorAll('[data-weather-frame]').forEach(button => {
      button.classList.toggle('active', Number(button.dataset.weatherFrame) === safeIndex);
    });
  }

  function getForecastFrames(selected = LAYERS.forecast) {
    const key = selected.capabilitiesUrl || FORECAST_CAPABILITIES_URL;
    if (forecastFramePromises.has(key)) return forecastFramePromises.get(key);
    const promise = fetch(key)
      .then(response => {
        if (!response.ok) throw new Error(`DWD Capabilities ${response.status}`);
        return response.text();
      })
      .then(xmlText => parseForecastFrames(xmlText, selected));
    forecastFramePromises.set(key, promise);
    return promise;
  }

  function parseForecastFrames(xmlText, selected = LAYERS.forecast) {
    const documentXml = new DOMParser().parseFromString(xmlText, 'application/xml');
    const dimensions = Array.from(documentXml.getElementsByTagName('Dimension'));
    const timeDimension = dimensions.find(item => item.getAttribute('name') === 'time');
    const referenceDimension = dimensions.find(item => item.getAttribute('name') === 'REFERENCE_TIME');
    const [startText, endText, stepText] = (timeDimension?.textContent || '').trim().split('/');
    const referenceText = referenceDimension?.getAttribute('default') || startText;
    const start = new Date(referenceText);
    const dimensionEnd = new Date(endText || referenceText);
    const requestedEnd = new Date(start.getTime() + (selected.horizonHours || 2) * 60 * 60000);
    const end = dimensionEnd < requestedEnd ? dimensionEnd : requestedEnd;
    const minutes = parseIsoStepMinutes(stepText || 'PT5M');
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || !minutes) {
      return buildFallbackForecastFrames(selected);
    }
    const frames = [];
    for (let time = new Date(start); time <= end && frames.length < (selected.maxFrames || 25); time = new Date(time.getTime() + minutes * 60000)) {
      frames.push(toForecastFrame(time, referenceText));
    }
    return frames.length ? frames : buildFallbackForecastFrames(selected);
  }

  function parseIsoStepMinutes(value) {
    const match = String(value || '').match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
    if (!match) return 5;
    return (Number(match[1] || 0) * 60) + Number(match[2] || 0);
  }

  function buildFallbackForecastFrames(selected = LAYERS.forecast) {
    const now = new Date();
    now.setSeconds(0, 0);
    const stepMinutes = selected.horizonHours > 2 ? 60 : 5;
    now.setMinutes(Math.floor(now.getMinutes() / stepMinutes) * stepMinutes);
    return Array.from({ length: selected.maxFrames || 25 }, (_, index) => toForecastFrame(new Date(now.getTime() + index * stepMinutes * 60000)));
  }

  function toForecastFrame(date, referenceTime = '') {
    const label = new Intl.DateTimeFormat('de-DE', { weekday: 'short', hour: '2-digit', minute: '2-digit' }).format(date);
    const short = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' }).format(date);
    return { value: date.toISOString(), referenceTime, label, short };
  }

  function onLegendToggle(event) {
    const legend = event.target?.closest?.('.weather-map-fix-legend');
    if (!legend) return;
    const expanded = !legend.classList.contains('is-expanded');
    legend.classList.toggle('is-expanded', expanded);
    legend.setAttribute('aria-expanded', String(expanded));
    legend.title = expanded ? 'Legende verkleinern' : 'Legende vergroessern';
  }

  function onLegendKeydown(event) {
    if (!event.target?.classList?.contains('weather-map-fix-legend')) return;
    if (!['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    event.target.click();
  }

  function invalidateMap() {
    if (!map) return;
    window.setTimeout(() => map.invalidateSize(), 80);
    window.setTimeout(() => map.invalidateSize(), 240);
  }

  function destroyMap() {
    if (map) {
      try {
        map.remove();
      } catch (error) {
        console.warn('Wetterkarte konnte nicht sauber entfernt werden', error);
      }
    }
    map = null;
    weatherLayer = null;
    marker = null;
    currentFrame = null;
    currentKey = '';
    currentForecastIndex = -1;
  }

  function loadLeaflet() {
    if (window.L) return Promise.resolve();
    if (leafletReady) return leafletReady;
    leafletReady = new Promise((resolve, reject) => {
      if (!document.getElementById('weatherLeafletCss')) {
        const link = document.createElement('link');
        link.id = 'weatherLeafletCss';
        link.rel = 'stylesheet';
        link.href = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }
      const existing = document.getElementById('weatherLeafletScript');
      if (existing) {
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }
      const script = document.createElement('script');
      script.id = 'weatherLeafletScript';
      script.src = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js';
      script.async = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
    return leafletReady;
  }

  function legendUrl(selected) {
    const url = new URL(WMS_URL);
    url.searchParams.set('SERVICE', 'WMS');
    url.searchParams.set('VERSION', '1.1.1');
    url.searchParams.set('REQUEST', 'GetLegendGraphic');
    url.searchParams.set('FORMAT', 'image/png');
    url.searchParams.set('LAYER', selected.layer);
    if (selected.styles) url.searchParams.set('STYLE', selected.styles);
    return url.toString();
  }

  function installStyles() {
    if (document.getElementById('weatherMapFixStyles')) return;
    const style = document.createElement('style');
    style.id = 'weatherMapFixStyles';
    style.textContent = `
      #leitstandWeatherModule.has-weather-map-fix{min-width:0}
      #leitstandWeatherModule.has-weather-map-fix .weather-v2-map-frame>img,
      #leitstandWeatherModule.has-weather-map-fix .weather-v2-pin{display:none!important}
      #leitstandWeatherModule.has-weather-map-fix .weather-v2-map-frame.has-interactive-map{height:184px;border:1px solid #cfddeb;border-radius:10px;overflow:hidden;background:#eaf2f9}
      #leitstandWeatherModule.is-weather-max.has-weather-map-fix .weather-v2-map-frame.has-interactive-map{height:390px}
      .weather-map-fix-canvas{width:100%;height:100%;font-family:inherit}
      .weather-map-fix-canvas .leaflet-container{font-family:inherit}
      .weather-map-fix-canvas .leaflet-control-attribution{font-size:.58rem}
      .weather-map-fix-loading{position:absolute;inset:0;z-index:450;display:none;place-items:center;background:rgba(248,251,255,.82);color:#4f6278;font-size:.78rem;font-weight:800}
      .weather-v2-map-frame.is-loading .weather-map-fix-loading{display:grid}
      .weather-map-fix-legend{position:absolute;left:10px;bottom:10px;z-index:600;display:grid;gap:4px;max-width:172px;border:1px solid rgba(207,221,235,.95);border-radius:8px;background:rgba(255,255,255,.94);padding:7px;box-shadow:0 8px 18px rgba(15,39,64,.12);cursor:pointer;transition:max-width .16s ease,padding .16s ease,box-shadow .16s ease}
      .weather-map-fix-legend:focus-visible{outline:3px solid rgba(37,99,235,.28);outline-offset:2px}
      .weather-map-fix-legend.is-expanded{max-width:min(320px,calc(100% - 20px));max-height:calc(100% - 20px);overflow:auto;padding:10px;box-shadow:0 16px 34px rgba(15,39,64,.22);overscroll-behavior:contain}
      .weather-map-fix-legend strong{font-size:.7rem;color:var(--text)}
      .weather-map-fix-legend span{font-size:.63rem;line-height:1.18;color:var(--muted)}
      .weather-map-fix-legend img{display:block;max-width:100%;max-height:68px;object-fit:contain}
      .weather-map-fix-legend.is-expanded strong{font-size:.82rem}
      .weather-map-fix-legend.is-expanded span{font-size:.75rem;line-height:1.28}
      .weather-map-fix-legend.is-expanded img{max-height:98px}
      #leitstandWeatherModule.is-weather-max.has-weather-map-fix .weather-map-fix-legend.is-expanded img{max-height:168px}
      .weather-map-fix-legend img.is-hidden{display:none}
      .weather-map-fix-timeline{display:none;position:absolute;right:10px;top:10px;z-index:590;width:min(270px,calc(100% - 204px));border:1px solid rgba(207,221,235,.95);border-radius:8px;background:rgba(255,255,255,.94);padding:7px 9px;box-shadow:0 8px 18px rgba(15,39,64,.12)}
      .weather-map-fix-timeline.is-visible{display:grid;gap:5px}
      .weather-map-fix-time-head,.weather-map-fix-time-range{display:flex;align-items:center;justify-content:space-between;gap:8px}
      .weather-map-fix-time-head strong{font-size:.72rem;color:var(--text)}
      .weather-map-fix-time-head span,.weather-map-fix-time-range span,.weather-map-fix-timeline>span{font-size:.62rem;color:var(--muted);font-weight:800}
      .weather-map-fix-timeline input{width:100%;accent-color:#2563eb}
      .weather-map-fix-time-strip{display:grid;grid-template-columns:repeat(25,1fr);gap:2px}
      .weather-map-fix-time-strip button{height:7px;border:0;border-radius:999px;background:#d8e3ee;padding:0;cursor:pointer}
      .weather-map-fix-time-strip button.active{background:#2563eb}
      .weather-map-fix-time-note{margin:0;color:#4f6278;font-size:.62rem;line-height:1.18}
      .weather-map-fix-error{position:absolute;inset:auto 10px 10px 10px;z-index:650;border:1px solid #f2b8b8;border-radius:8px;background:#fff6f6;color:#9f1d1d;padding:8px;font-size:.75rem}
      #leitstandWeatherModule.has-weather-map-fix .weather-v2-current{grid-template-columns:auto minmax(92px,1.15fr) repeat(3,minmax(76px,.8fr))}
      #leitstandWeatherModule.has-weather-map-fix .weather-v2-days{grid-template-columns:repeat(7,minmax(82px,1fr));overflow-x:auto;padding-bottom:2px}
      #leitstandWeatherModule.has-weather-map-fix .weather-v2-day{min-width:82px;padding:7px}
      #leitstandWeatherModule.has-weather-map-fix .weather-v2-day small,
      #leitstandWeatherModule.has-weather-map-fix .weather-v2-day em{white-space:normal;line-height:1.15;font-size:.66rem}
      @media (max-width:980px){
        #leitstandWeatherModule.has-weather-map-fix .weather-v2-days{grid-template-columns:repeat(2,minmax(120px,1fr))}
        #leitstandWeatherModule.has-weather-map-fix .weather-v2-current{grid-template-columns:1fr 1fr}
        .weather-map-fix-timeline{left:10px;right:10px;top:10px;width:auto}
      }
    `;
    document.head.appendChild(style);
  }
})();

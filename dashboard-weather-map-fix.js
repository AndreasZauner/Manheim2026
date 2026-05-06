(function () {
  if (window.__leitstandWeatherMapFixInstalled) return;
  window.__leitstandWeatherMapFixInstalled = true;

  const PLACE = { label: 'Kerpen-Manheim', lat: 50.889, lon: 6.646 };
  const WMS_URL = 'https://maps.dwd.de/geoserver/wms';
  const BASE_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  const LAYERS = {
    radar: {
      layer: 'dwd:Niederschlagsradar',
      styles: '',
      opacity: 0.72,
      title: 'DWD Niederschlagsradar',
      legend: 'Farbskala: staerkere Farben bedeuten staerkeren Niederschlag.'
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
  let timer = null;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installWeatherMapFix);
  } else {
    installWeatherMapFix();
  }

  function installWeatherMapFix() {
    installStyles();
    scheduleApply(80);
    scheduleApply(700);
    const observer = new MutationObserver(() => scheduleApply());
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    window.addEventListener('resize', () => scheduleApply(120), { passive: true });
  }

  function scheduleApply(delay = 70) {
    window.clearTimeout(timer);
    timer = window.setTimeout(applyWeatherMapFix, delay);
  }

  async function applyWeatherMapFix() {
    const host = document.getElementById('leitstandWeatherModule');
    if (!host) return;
    host.classList.add('has-weather-map-fix');

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
    const action = active?.dataset?.weatherV2Action || 'layer:radar';
    const key = action.split(':')[1] || 'radar';
    return LAYERS[key] ? key : 'radar';
  }

  async function createMap(frame, key) {
    destroyMap();
    currentFrame = frame;
    currentKey = '';
    frame.classList.add('has-interactive-map', 'is-loading');
    frame.dataset.weatherMapFix = key;
    frame.innerHTML = `
      <div class="weather-map-fix-canvas" aria-label="Interaktive Wetterkarte"></div>
      <div class="weather-map-fix-legend">
        <strong>Legende</strong>
        <img src="${legendUrl(LAYERS[key] || LAYERS.radar)}" alt="Legende" loading="lazy" onerror="this.classList.add('is-hidden')">
        <span>${(LAYERS[key] || LAYERS.radar).legend}</span>
      </div>
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
    if (weatherLayer && currentKey === key) return;
    if (weatherLayer) map.removeLayer(weatherLayer);
    weatherLayer = window.L.tileLayer.wms(WMS_URL, {
      layers: selected.layer,
      styles: selected.styles,
      format: 'image/png',
      transparent: true,
      version: '1.1.1',
      opacity: selected.opacity,
      attribution: 'DWD'
    }).addTo(map);
    currentKey = key;
    updateFrameLegend(selected);
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
      .weather-map-fix-legend{position:absolute;left:10px;bottom:10px;z-index:600;display:grid;gap:4px;max-width:172px;border:1px solid rgba(207,221,235,.95);border-radius:8px;background:rgba(255,255,255,.94);padding:7px;box-shadow:0 8px 18px rgba(15,39,64,.12)}
      .weather-map-fix-legend strong{font-size:.7rem;color:var(--text)}
      .weather-map-fix-legend span{font-size:.63rem;line-height:1.18;color:var(--muted)}
      .weather-map-fix-legend img{display:block;max-width:100%;max-height:68px;object-fit:contain}
      .weather-map-fix-legend img.is-hidden{display:none}
      .weather-map-fix-error{position:absolute;inset:auto 10px 10px 10px;z-index:650;border:1px solid #f2b8b8;border-radius:8px;background:#fff6f6;color:#9f1d1d;padding:8px;font-size:.75rem}
      #leitstandWeatherModule.has-weather-map-fix .weather-v2-current{grid-template-columns:auto minmax(92px,1.15fr) repeat(3,minmax(76px,.8fr))}
      #leitstandWeatherModule.has-weather-map-fix .weather-v2-days{grid-template-columns:repeat(7,minmax(82px,1fr));overflow-x:auto;padding-bottom:2px}
      #leitstandWeatherModule.has-weather-map-fix .weather-v2-day{min-width:82px;padding:7px}
      #leitstandWeatherModule.has-weather-map-fix .weather-v2-day small,
      #leitstandWeatherModule.has-weather-map-fix .weather-v2-day em{white-space:normal;line-height:1.15;font-size:.66rem}
      @media (max-width:980px){
        #leitstandWeatherModule.has-weather-map-fix .weather-v2-days{grid-template-columns:repeat(2,minmax(120px,1fr))}
        #leitstandWeatherModule.has-weather-map-fix .weather-v2-current{grid-template-columns:1fr 1fr}
      }
    `;
    document.head.appendChild(style);
  }
})();

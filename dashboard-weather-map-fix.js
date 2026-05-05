(function () {
  if (window.__leitstandWeatherMapFixInstalled) return;
  window.__leitstandWeatherMapFixInstalled = true;

  const PLACE = { label: 'Manheim', lat: 50.889, lon: 6.646 };
  const WMS_URL = 'https://maps.dwd.de/geoserver/wms';
  const layers = {
    radar: { layer: 'dwd:Niederschlagsradar', styles: '', opacity: 0.72, title: 'DWD Niederschlagsradar', legend: 'Farbskala: st&auml;rkere Farben bedeuten st&auml;rkeren Niederschlag.' },
    warnings: { layer: 'dwd:Warnungen_Gemeinden_vereinigt', styles: '', opacity: 0.58, title: 'DWD Wetterwarnungen', legend: 'Warnfarben folgen der amtlichen DWD-Warnskala.' },
    wind: { layer: 'dwd:Icon_reg025_fd_sl_UV10M', styles: 'icon_reg025_fd_sl_uv10m_wmc_windbarbs', opacity: 0.8, title: 'DWD Wind 10 m', legend: 'Windfahnen zeigen Richtung und St&auml;rke.' },
    uv: { layer: 'dwd:UVIndex', styles: 'uvindex', opacity: 0.62, title: 'DWD UV-Index', legend: 'UV-Farben markieren niedrige bis sehr hohe Belastung.' }
  };

  let leafletReady = null;
  let map = null;
  let mapSignature = '';
  let timer = null;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installWeatherMapFix);
  } else {
    installWeatherMapFix();
  }

  function installWeatherMapFix() {
    installStyles();
    scheduleApply(120);
    scheduleApply(900);
    const observer = new MutationObserver(() => scheduleApply());
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function scheduleApply(delay = 80) {
    window.clearTimeout(timer);
    timer = window.setTimeout(applyWeatherMapFix, delay);
  }

  function applyWeatherMapFix() {
    const host = document.getElementById('leitstandWeatherModule');
    if (!host) return;
    host.classList.add('has-weather-map-fix');
    const frame = host.querySelector('.weather-v2-map-frame');
    if (!frame || host.classList.contains('is-weather-min')) {
      destroyMap();
      return;
    }
    const key = activeLayer(host);
    const size = host.classList.contains('is-weather-max') ? 'max' : 'normal';
    const signature = `${key}:${size}`;
    if (map && mapSignature === signature && frame.dataset.weatherMapFix === signature) {
      map.invalidateSize();
      return;
    }
    initInteractiveMap(frame, key, signature);
  }

  function activeLayer(host) {
    const active = host.querySelector('.weather-v2-map-actions [data-weather-v2-action^="layer:"].active');
    const action = active?.dataset?.weatherV2Action || 'layer:radar';
    const key = action.split(':')[1] || 'radar';
    return layers[key] ? key : 'radar';
  }

  async function initInteractiveMap(frame, key, signature) {
    const selected = layers[key] || layers.radar;
    destroyMap();
    frame.classList.add('has-interactive-map');
    frame.dataset.weatherMapFix = signature;
    frame.innerHTML = `
      <div class="weather-map-fix-canvas"></div>
      <div class="weather-map-fix-legend">
        <strong>Legende</strong>
        <img src="${legendUrl(selected)}" alt="Legende ${selected.title}" loading="lazy" onerror="this.classList.add('is-hidden')">
        <span>${selected.legend}</span>
      </div>
    `;
    try {
      await loadLeaflet();
      if (!window.L) throw new Error('Leaflet nicht verfuegbar');
      const canvas = frame.querySelector('.weather-map-fix-canvas');
      const leafletMap = window.L.map(canvas, { zoomControl: true, attributionControl: true, scrollWheelZoom: true }).setView([PLACE.lat, PLACE.lon], 11);
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(leafletMap);
      window.L.tileLayer.wms(WMS_URL, { layers: selected.layer, styles: selected.styles, format: 'image/png', transparent: true, version: '1.1.1', opacity: selected.opacity, attribution: 'DWD' }).addTo(leafletMap);
      window.L.circleMarker([PLACE.lat, PLACE.lon], { radius: 6, color: '#0f2740', weight: 2, fillColor: '#2e7d32', fillOpacity: 0.95 }).addTo(leafletMap).bindTooltip(PLACE.label, { direction: 'top' });
      map = leafletMap;
      mapSignature = signature;
      window.setTimeout(() => leafletMap.invalidateSize(), 160);
    } catch (error) {
      console.warn('Interaktive Wetterkarte konnte nicht geladen werden', error);
      frame.insertAdjacentHTML('beforeend', '<div class="weather-map-fix-error">Interaktive Karte konnte nicht geladen werden.</div>');
    }
  }

  function destroyMap() {
    if (!map) {
      mapSignature = '';
      return;
    }
    map.remove();
    map = null;
    mapSignature = '';
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
      #leitstandWeatherModule.has-weather-map-fix .weather-v2-current{grid-template-columns:auto minmax(92px,1.15fr) repeat(3,minmax(76px,.8fr))}
      #leitstandWeatherModule.has-weather-map-fix .weather-v2-current strong{display:block;font-size:1rem;line-height:1.1}
      #leitstandWeatherModule.has-weather-map-fix .weather-v2-current small{display:block;line-height:1.2}
      #leitstandWeatherModule.has-weather-map-fix .weather-v2-days{grid-template-columns:repeat(7,minmax(82px,1fr));overflow-x:auto;padding-bottom:2px}
      #leitstandWeatherModule.has-weather-map-fix .weather-v2-day{min-width:82px;padding:7px}
      #leitstandWeatherModule.has-weather-map-fix .weather-v2-day-top{gap:4px}
      #leitstandWeatherModule.has-weather-map-fix .weather-v2-day-top span{font-size:1.05rem}
      #leitstandWeatherModule.has-weather-map-fix .weather-v2-day strong{font-size:.68rem}
      #leitstandWeatherModule.has-weather-map-fix .weather-v2-day b{font-size:.86rem}
      #leitstandWeatherModule.has-weather-map-fix .weather-v2-day small,#leitstandWeatherModule.has-weather-map-fix .weather-v2-day em{white-space:normal;line-height:1.15;font-size:.66rem}
      #leitstandWeatherModule.has-weather-map-fix .weather-v2-map-frame.has-interactive-map{height:184px;border:1px solid #cfddeb;border-radius:10px;overflow:hidden;background:#eaf2f9}
      #leitstandWeatherModule.is-weather-max.has-weather-map-fix .weather-v2-map-frame.has-interactive-map{height:390px}
      .weather-map-fix-canvas{width:100%;height:100%;font-family:inherit}
      .weather-map-fix-legend{position:absolute;left:10px;bottom:10px;z-index:600;display:grid;gap:4px;max-width:172px;border:1px solid rgba(207,221,235,.95);border-radius:8px;background:rgba(255,255,255,.94);padding:7px;box-shadow:0 8px 18px rgba(15,39,64,.12)}
      .weather-map-fix-legend strong{font-size:.7rem;color:var(--text)}
      .weather-map-fix-legend span{font-size:.63rem;line-height:1.18;color:var(--muted)}
      .weather-map-fix-legend img{display:block;max-width:100%;max-height:68px;object-fit:contain}
      .weather-map-fix-legend img.is-hidden{display:none}
      .weather-map-fix-error{position:absolute;inset:auto 10px 10px 10px;z-index:650;border:1px solid #f2b8b8;border-radius:8px;background:#fff6f6;color:#9f1d1d;padding:8px;font-size:.75rem}
      @media (max-width:980px){#leitstandWeatherModule.has-weather-map-fix .weather-v2-days{grid-template-columns:repeat(2,minmax(120px,1fr))}#leitstandWeatherModule.has-weather-map-fix .weather-v2-current{grid-template-columns:1fr 1fr}}
    `;
    document.head.appendChild(style);
  }
})();

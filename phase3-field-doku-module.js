import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const FIELD_CATEGORIES = {
  dokumentation: 'Dokumentation',
  schnitte: 'Grabungsfl\u00e4chen',
  funde: 'Funde / Proben',
  sicherheit: 'Sicherheit',
  schnittstelle_amt: 'Amt / Freigaben'
};
const FIELD_CATEGORY_KEYS = new Set(Object.keys(FIELD_CATEGORIES));
const OPEN_STATUSES = new Set(['offen', 'laufend', 'blockiert', 'aktiv', 'geplant', 'pruefen']);
const NAV = {
  dashboard: ['Leitstand', 'Tageslage, Priorit\u00e4ten, Kl\u00e4rungsbedarf und Risiken'],
  participants: ['Personal', 'Personaleinsatz, Zeitr\u00e4ume, Verbindlichkeit und Hinweise'],
  mindmap: ['Feld & Doku', 'Karte, Feldstruktur, Dokumentationshinweise und Fortschritt'],
  tasks: ['Infrastruktur', 'Ressourcen, Logistik und operative Aufgaben'],
  ideas: ['Finanzen', 'Beschaffung, offene Kostenpunkte und vorgemerkte Hinweise'],
  admin: ['Verwaltung', 'Rollen, Freischaltungen und Systemeinstellungen']
};

const state = {
  client: null,
  tasks: [],
  notes: [],
  mapFeatures: [],
  mapError: '',
  filters: { q: '', category: 'alle', status: 'offen' },
  installed: false
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', installPhase3FieldDoku);
} else {
  installPhase3FieldDoku();
}

function installPhase3FieldDoku() {
  if (state.installed) return;
  state.installed = true;
  injectStylesheet();
  injectLocalStyles();
  normalizeV21Shell();
  hideStandaloneMapNav();
  installMapNavObserver();
  ensureFieldDokuShell();
  bindFieldDokuUi();
  installMainDataBridge();
  installShellStabilizer();
  window.setTimeout(() => {
    normalizeV21Shell();
    hideStandaloneMapNav();
    ensureFieldDokuShell();
  }, 800);
}

function installMainDataBridge() {
  window.addEventListener('manheim:data-ready', event => {
    ensureFieldDokuShell();
    state.tasks = event.detail?.tasks || [];
    state.notes = event.detail?.notes || [];
    renderFieldDoku();
    const sync = document.getElementById('fieldDokuSync');
    if (sync) sync.textContent = 'synchronisiert';
    loadMapSummaryOnly();
  });

  if (!document.getElementById('app')?.classList.contains('hidden')) {
    window.setTimeout(loadFieldDokuData, 0);
    return;
  }

  let checks = 0;
  const timer = window.setInterval(() => {
    checks += 1;
    if (!document.getElementById('app')?.classList.contains('hidden')) {
      window.clearInterval(timer);
      window.setTimeout(loadFieldDokuData, 250);
    }
    if (checks > 80) window.clearInterval(timer);
  }, 250);
}

function injectStylesheet() {
  if (document.querySelector('link[href^="./phase3-field-doku.css"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = './phase3-field-doku.css?v=phase3-20260501-3';
  document.head.appendChild(link);
}

function injectLocalStyles() {
  if (document.getElementById('phase3FieldDokuInlineStyles')) return;
  const style = document.createElement('style');
  style.id = 'phase3FieldDokuInlineStyles';
  style.textContent = `
    .field-doku-controls{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:12px}
    .field-doku-controls input,.field-doku-controls select{min-height:38px}
    .field-doku-progress-list{display:grid;gap:10px}
    .field-doku-progress{padding:12px;border:1px solid var(--border);border-radius:8px;background:#fbfdff}
    .field-doku-progress-head{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:8px}
    .field-doku-progress-title{font-weight:800}
    .field-doku-progress-bar{height:9px;border-radius:999px;background:#eaf1f8;overflow:hidden}
    .field-doku-progress-bar span{display:block;height:100%;background:linear-gradient(90deg,#24995a,#1f7ae0)}
    .field-doku-map-summary{display:grid;gap:10px}
    .field-doku-map-row{display:flex;justify-content:space-between;gap:12px;padding:10px 12px;border:1px solid var(--border);border-radius:8px;background:#fbfdff}
    .field-doku-map-row span{color:var(--muted);font-weight:700}
    .field-doku-alert{padding:10px 12px;border-radius:8px;background:#fff7e7;color:#815300;border:1px solid #f5dfaa}
    .field-doku-empty-note{padding:12px;border:1px dashed var(--border);border-radius:8px;color:var(--muted);background:#fbfdff}
  `;
  document.head.appendChild(style);
}

function ensureFieldDokuShell() {
  const tab = document.getElementById('mindmapTab');
  const head = tab?.querySelector('.section-head');
  const grid = document.getElementById('mindmapGrid');
  if (!tab || !head || !grid) return;

  head.querySelector('h3')?.replaceChildren(document.createTextNode('Feld & Doku'));
  head.querySelector('.muted, p')?.replaceChildren(
    document.createTextNode('Karte, Feldstruktur, Dokumentationshinweise und Fortschritt.')
  );

  if (document.getElementById('fieldDokuPhase3')) return;
  const panel = document.createElement('section');
  panel.id = 'fieldDokuPhase3';
  panel.className = 'field-doku-phase3';
  panel.innerHTML = `
    <div class="field-doku-overview">
      <section class="panel field-doku-command">
        <div>
          <div class="field-doku-eyebrow">Phase 3</div>
          <h3>Feldsteuerung & Dokumentationslage</h3>
          <p>Raumdaten, Grabungsfl\u00e4chen, Doku-Hinweise und operative Feldpunkte werden hier als Arbeits\u00fcbersicht zusammengef\u00fchrt.</p>
        </div>
        <div class="button-row">
          <button class="btn primary" type="button" id="fieldDokuOpenMap">Karte</button>
          <button class="btn" type="button" id="fieldDokuRefresh">Feldstatus laden</button>
        </div>
      </section>
      <section class="panel field-doku-status">
        <div class="panel-head">
          <h3>Feldstatus</h3>
          <span class="muted" id="fieldDokuSync">wird geladen</span>
        </div>
        <div class="field-doku-stats" id="fieldDokuStats"></div>
      </section>
    </div>
    <div class="field-doku-grid">
      <section class="panel">
        <div class="panel-head">
          <h3>Offene Feld- & Doku-Punkte</h3>
          <span class="muted">aus Aufgaben und Notizen</span>
        </div>
        <div class="field-doku-controls">
          <input id="fieldDokuSearch" type="search" placeholder="Suche nach Titel oder Text">
          <select id="fieldDokuCategoryFilter">
            <option value="alle">Alle Bereiche</option>
            <option value="dokumentation">Dokumentation</option>
            <option value="schnitte">Grabungsfl\u00e4chen</option>
            <option value="funde">Funde / Proben</option>
            <option value="sicherheit">Sicherheit</option>
            <option value="schnittstelle_amt">Amt / Freigaben</option>
          </select>
          <select id="fieldDokuStatusFilter">
            <option value="offen">Nur offene</option>
            <option value="alle">Alle Status</option>
            <option value="blockiert">Blockiert</option>
            <option value="laufend">Laufend / aktiv</option>
            <option value="erledigt">Erledigt</option>
          </select>
        </div>
        <div id="fieldDokuOpenItems" class="stack-list"></div>
      </section>
      <section class="panel">
        <div class="panel-head">
          <h3>Fortschritt nach Arbeitsphase</h3>
          <span class="muted">aus vorhandenen Daten abgeleitet</span>
        </div>
        <div id="fieldDokuProgress" class="field-doku-progress-list"></div>
      </section>
    </div>
    <div class="field-doku-grid">
      <section class="panel">
        <div class="panel-head">
          <h3>Karten- und Raumdaten</h3>
          <span class="muted">Kartenmodul / GeoJSON</span>
        </div>
        <div id="fieldDokuMapSummary" class="field-doku-map-summary"></div>
      </section>
      <section class="panel">
        <div class="panel-head">
          <h3>Arbeitsbereiche</h3>
          <span class="muted">bestehende Kategorien</span>
        </div>
        <div id="fieldDokuCategories" class="field-doku-category-list"></div>
      </section>
    </div>
  `;
  tab.insertBefore(panel, grid);
}

function bindFieldDokuUi() {
  if (document.body.dataset.phase3FieldDokuBound === 'true') return;
  document.body.dataset.phase3FieldDokuBound = 'true';
  document.addEventListener('click', event => {
    if (event.target?.id === 'fieldDokuOpenMap') openMap();
    if (event.target?.id === 'fieldDokuRefresh') loadFieldDokuData();
  });
  document.addEventListener('input', event => {
    if (event.target?.id === 'fieldDokuSearch') {
      state.filters.q = event.target.value || '';
      renderFieldDoku();
    }
  });
  document.addEventListener('change', event => {
    if (event.target?.id === 'fieldDokuCategoryFilter') {
      state.filters.category = event.target.value || 'alle';
      renderFieldDoku();
    }
    if (event.target?.id === 'fieldDokuStatusFilter') {
      state.filters.status = event.target.value || 'offen';
      renderFieldDoku();
    }
  });
  document.getElementById('refreshButton')?.addEventListener('click', () => {
    window.setTimeout(loadFieldDokuData, 900);
  });
}

function installShellStabilizer() {
  let count = 0;
  const timer = window.setInterval(() => {
    count += 1;
    normalizeV21Shell();
    hideStandaloneMapNav();
    if (count > 20) window.clearInterval(timer);
  }, 250);
}

function normalizeV21Shell() {
  document.querySelectorAll('.nav-btn[data-tab]').forEach(button => {
    const meta = NAV[button.dataset.tab];
    if (!meta) {
      button.classList.add('hidden');
      return;
    }
    button.classList.remove('hidden');
    if (button.textContent !== meta[0]) button.textContent = meta[0];
    if (button.dataset.phase3NavBound !== 'true') {
      button.dataset.phase3NavBound = 'true';
      button.addEventListener('click', () => window.setTimeout(normalizeV21Shell, 30));
    }
  });
  const active = document.querySelector('.nav-btn.active[data-tab]')?.dataset.tab;
  const meta = NAV[active];
  const title = document.getElementById('pageTitle');
  const subtitle = document.getElementById('pageSubtitle');
  if (meta && title && title.textContent !== meta[0]) title.textContent = meta[0];
  if (meta && subtitle && subtitle.textContent !== meta[1]) subtitle.textContent = meta[1];
}

async function loadFieldDokuData() {
  const sync = document.getElementById('fieldDokuSync');
  try {
    ensureFieldDokuShell();
    if (sync) sync.textContent = 'l\u00e4dt ...';
    const client = getClient();
    if (!client) {
      if (sync) sync.textContent = 'Supabase fehlt';
      return;
    }
    const { data: sessionData } = await getAuthSession(client);
    if (!sessionData?.session) {
      if (sync) sync.textContent = 'nicht angemeldet';
      return;
    }

    const [tasksResult, notesResult, mapResult] = await Promise.allSettled([
      client
        .from('tasks')
        .select('id,title,description,category,subcategory,status,priority,due_date,assigned_role')
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('id'),
      client
        .from('notes')
        .select('id,title,body,category,subcategory,status,note_type,created_at')
        .order('created_at', { ascending: false }),
      client
        .from('map_features')
        .select('id,title,category,status,priority,geometry_type,primary_layer_id,updated_at')
        .order('updated_at', { ascending: false })
    ]);

    const tasksPayload = unwrapSupabaseResult(tasksResult);
    const notesPayload = unwrapSupabaseResult(notesResult);
    const mapPayload = unwrapSupabaseResult(mapResult, true);
    if (tasksPayload.error) throw tasksPayload.error;
    if (notesPayload.error) throw notesPayload.error;

    state.tasks = tasksPayload.data || [];
    state.notes = notesPayload.data || [];
    state.mapFeatures = mapPayload.data || [];
    state.mapError = mapPayload.error ? mapPayload.error.message || String(mapPayload.error) : '';
    renderFieldDoku();
    if (sync) sync.textContent = state.mapError ? 'mit Kartenhinweis' : 'synchronisiert';
  } catch (error) {
    console.error(error);
    if (sync) sync.textContent = 'Fehler';
    const host = document.getElementById('fieldDokuOpenItems');
    if (host) host.innerHTML = `<div class="empty">Feldstatus konnte nicht geladen werden: ${escapeHtml(error.message || error)}</div>`;
  }
}

async function loadMapSummaryOnly() {
  try {
    const client = getClient();
    if (!client) return;
    const { data: sessionData } = await getAuthSession(client);
    if (!sessionData?.session) return;
    const { data, error } = await client
      .from('map_features')
      .select('id,title,category,status,priority,geometry_type,primary_layer_id,updated_at')
      .order('updated_at', { ascending: false });
    state.mapFeatures = error ? [] : data || [];
    state.mapError = error ? error.message || String(error) : '';
    renderFieldDoku();
  } catch (error) {
    state.mapFeatures = [];
    state.mapError = error.message || String(error);
    renderFieldDoku();
  }
}

function unwrapSupabaseResult(result, optional = false) {
  if (result.status === 'rejected') {
    return optional ? { data: [], error: result.reason } : { data: null, error: result.reason };
  }
  return result.value || { data: [], error: null };
}

function getClient() {
  if (state.client) return state.client;
  const config = window.APP_CONFIG || {};
  if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) return null;
  state.client = window.getManheimSupabaseClient?.(createClient) || createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  return state.client;
}

function getAuthSession(client) {
  return window.getManheimAuthSession?.(client) || client.auth.getSession();
}

function renderFieldDoku() {
  const fieldTasks = state.tasks.filter(item => FIELD_CATEGORY_KEYS.has(item.category));
  const fieldNotes = state.notes.filter(item => FIELD_CATEGORY_KEYS.has(item.category));
  const openTasks = fieldTasks.filter(isOpen);
  const openNotes = fieldNotes.filter(isOpen);
  const allFieldItems = [...fieldTasks.map(toTaskItem), ...fieldNotes.map(toNoteItem)];
  const filteredItems = allFieldItems
    .filter(matchesFilters)
    .sort((a, b) => scoreItem(b) - scoreItem(a))
    .slice(0, 12);

  renderStats(openTasks, openNotes, fieldNotes);
  renderItems(filteredItems);
  renderProgress(fieldTasks, fieldNotes);
  renderMapSummary();
  renderCategories(fieldTasks, fieldNotes);
}

function renderStats(openTasks, openNotes, fieldNotes) {
  const safetyOpen = [...openTasks, ...openNotes].filter(item => item.category === 'sicherheit').length;
  const documentationOpen = [...openTasks, ...openNotes].filter(item => item.category === 'dokumentation').length;
  const mapActive = state.mapFeatures.filter(item => item.status !== 'archiv').length;
  const stats = document.getElementById('fieldDokuStats');
  if (!stats) return;
  stats.innerHTML = [
    ['Feldaufgaben offen', openTasks.length],
    ['Doku-Punkte offen', documentationOpen],
    ['Sicherheit offen', safetyOpen],
    ['Kartenobjekte aktiv', mapActive || state.mapFeatures.length],
    ['Notizen Feld/Doku', fieldNotes.length]
  ].map(([label, value]) => `<div class="field-doku-stat"><span>${escapeHtml(label)}</span><strong>${value}</strong></div>`).join('');
}

function renderItems(items) {
  const list = document.getElementById('fieldDokuOpenItems');
  if (!list) return;
  list.innerHTML = items.length
    ? items.map(renderItem).join('')
    : '<div class="empty">Keine Feld- oder Dokumentationspunkte f\u00fcr diese Filter gefunden.</div>';
}

function renderProgress(fieldTasks, fieldNotes) {
  const phases = [
    ['Fl\u00e4chenplanung', ['schnitte', 'schnittstelle_amt']],
    ['Dokumentationsstandard', ['dokumentation']],
    ['Sicherheit & Freigaben', ['sicherheit', 'schnittstelle_amt']],
    ['Funde / Probenlogik', ['funde']]
  ];
  const host = document.getElementById('fieldDokuProgress');
  if (!host) return;
  host.innerHTML = phases.map(([label, categories]) => {
    const rows = [...fieldTasks, ...fieldNotes].filter(item => categories.includes(item.category));
    const done = rows.filter(item => ['erledigt', 'archiv'].includes(item.status)).length;
    const open = rows.length - done;
    const percent = rows.length ? Math.round((done / rows.length) * 100) : 0;
    const note = rows.length ? `${done} erledigt / ${open} offen` : 'noch keine Eintr\u00e4ge';
    return `
      <div class="field-doku-progress">
        <div class="field-doku-progress-head">
          <div class="field-doku-progress-title">${escapeHtml(label)}</div>
          <span class="muted">${note}</span>
        </div>
        <div class="field-doku-progress-bar" aria-label="${percent} Prozent"><span style="width:${percent}%"></span></div>
      </div>
    `;
  }).join('');
}

function renderMapSummary() {
  const host = document.getElementById('fieldDokuMapSummary');
  if (!host) return;
  if (state.mapError) {
    host.innerHTML = `<div class="field-doku-alert">Kartenobjekte konnten noch nicht geladen werden. Falls das Kartenmodul noch nicht eingerichtet ist: <code>supabase/map_module.sql</code> ausf\u00fchren.</div>`;
    return;
  }
  const byType = countBy(state.mapFeatures, item => item.geometry_type || 'ohne Geometrie');
  const byStatus = countBy(state.mapFeatures, item => item.status || 'ohne Status');
  host.innerHTML = [
    ['Objekte gesamt', state.mapFeatures.length],
    ['Punkte', byType.Point || byType.MultiPoint || 0],
    ['Linien', byType.LineString || byType.MultiLineString || 0],
    ['Fl\u00e4chen', byType.Polygon || byType.MultiPolygon || 0],
    ['Aktiv / geplant', (byStatus.aktiv || 0) + (byStatus.geplant || 0)]
  ].map(([label, value]) => `<div class="field-doku-map-row"><span>${escapeHtml(label)}</span><strong>${value}</strong></div>`).join('');
}

function renderCategories(fieldTasks, fieldNotes) {
  const categories = document.getElementById('fieldDokuCategories');
  if (!categories) return;
  categories.innerHTML = Object.entries(FIELD_CATEGORIES).map(([key, label]) => {
    const rows = [...fieldTasks, ...fieldNotes].filter(item => item.category === key);
    const open = rows.filter(isOpen).length;
    const text = rows.length ? `${open} offen / ${rows.length} gesamt` : 'noch leer';
    return `<div class="field-doku-category"><span>${escapeHtml(label)}</span><strong>${escapeHtml(text)}</strong></div>`;
  }).join('');
}

function matchesFilters(item) {
  if (state.filters.category !== 'alle' && item.category !== state.filters.category) return false;
  if (state.filters.status === 'offen' && !isOpen(item)) return false;
  if (state.filters.status !== 'alle' && state.filters.status !== 'offen') {
    if (state.filters.status === 'laufend' && !['laufend', 'aktiv', 'geplant', 'pruefen'].includes(item.status)) return false;
    if (state.filters.status !== 'laufend' && item.status !== state.filters.status) return false;
  }
  if (state.filters.q) {
    const haystack = `${item.title || ''} ${item.text || ''} ${item.meta || ''}`.toLowerCase();
    if (!haystack.includes(state.filters.q.toLowerCase())) return false;
  }
  return true;
}

function toTaskItem(item) {
  return {
    type: 'Aufgabe',
    title: item.title,
    text: item.description,
    category: item.category,
    status: item.status,
    priority: item.priority,
    meta: [item.subcategory, item.assigned_role, item.due_date ? `f\u00e4llig: ${formatDate(item.due_date)}` : ''].filter(Boolean).join(' / ')
  };
}

function toNoteItem(item) {
  return {
    type: item.note_type === 'idea' ? 'Idee' : 'Notiz',
    title: item.title,
    text: item.body,
    category: item.category,
    status: item.status || 'offen',
    priority: 'mittel',
    meta: item.subcategory || ''
  };
}

function scoreItem(item) {
  const priority = item.priority === 'hoch' ? 4 : item.priority === 'mittel' ? 2 : 1;
  const status = item.status === 'blockiert' ? 5 : isOpen(item) ? 2 : 0;
  return priority + status;
}

function renderItem(item) {
  return `
    <div class="list-item field-doku-item ${escapeHtml(item.category || '')}">
      <div class="item-head">
        <div>
          <div class="item-title">${escapeHtml(item.title || 'Ohne Titel')}</div>
          <div class="item-meta">
            <span class="chip">${escapeHtml(item.type)}</span>
            <span class="chip">${escapeHtml(FIELD_CATEGORIES[item.category] || item.category || 'Feld')}</span>
            <span class="status ${escapeHtml(item.status || 'offen')}">${escapeHtml(prettyStatus(item.status))}</span>
            ${item.meta ? `<span>${escapeHtml(item.meta)}</span>` : ''}
          </div>
        </div>
      </div>
      ${item.text ? `<div class="muted">${escapeHtml(shorten(item.text, 220))}</div>` : ''}
    </div>
  `;
}

async function openMap() {
  const sync = document.getElementById('fieldDokuSync');
  if (sync) sync.textContent = 'Karte wird ge\u00f6ffnet ...';
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (typeof window.openManheimMap === 'function') {
      await window.openManheimMap();
      return;
    }
    const mapButton = document.querySelector('[data-map-tab="map"]');
    if (mapButton) {
      mapButton.click();
      return;
    }
    await wait(150);
  }
  if (sync) sync.textContent = 'Kartenmodul nicht bereit';
}

function hideStandaloneMapNav() {
  document.querySelectorAll('[data-map-tab="map"]').forEach(button => {
    button.classList.add('hidden');
    button.setAttribute('aria-hidden', 'true');
    button.tabIndex = -1;
  });
}

function installMapNavObserver() {
  const nav = document.querySelector('.nav');
  if (!nav) return;
  const observer = new MutationObserver(hideStandaloneMapNav);
  observer.observe(nav, { childList: true, subtree: true });
}

function wait(ms) {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

function isOpen(item) {
  return OPEN_STATUSES.has(item.status || 'offen') && !['erledigt', 'archiv'].includes(item.status);
}

function countBy(rows, getter) {
  return rows.reduce((acc, row) => {
    const key = getter(row);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function prettyStatus(status) {
  return ({ offen: 'offen', laufend: 'laufend', erledigt: 'erledigt', blockiert: 'blockiert', aktiv: 'aktiv', geplant: 'geplant', pruefen: 'pr\u00fcfen', archiv: 'Archiv' })[status] || status || '-';
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(String(value).slice(0, 10) + 'T00:00:00');
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('de-DE');
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

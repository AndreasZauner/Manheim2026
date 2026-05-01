import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const FIELD_CATEGORIES = new Set(['dokumentation', 'schnitte', 'funde', 'sicherheit', 'schnittstelle_amt']);
const FIELD_STATUS_OPEN = new Set(['offen', 'laufend', 'blockiert', 'aktiv']);
const NAV = {
  dashboard: ['Leitstand', 'Tageslage, Prioritaeten, Klaerungsbedarf und Risiken'],
  participants: ['Personal', 'Personaleinsatz, Zeitraeume, Verbindlichkeit und Hinweise'],
  mindmap: ['Feld & Doku', 'Kartenviewer, Feldstruktur, Dokumentationshinweise und Fortschritt'],
  tasks: ['Infrastruktur', 'Ressourcen, Logistik und operative Aufgaben'],
  ideas: ['Finanzen', 'Beschaffung, offene Kostenpunkte und vorgemerkte Hinweise'],
  admin: ['Verwaltung', 'Rollen, Freischaltungen und Systemeinstellungen']
};

const state = {
  client: null,
  tasks: [],
  notes: [],
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
  link.href = './phase3-field-doku.css?v=phase3-20260501-1';
  document.head.appendChild(link);
}

function ensureFieldDokuShell() {
  const tab = document.getElementById('mindmapTab');
  const head = tab?.querySelector('.section-head');
  const grid = document.getElementById('mindmapGrid');
  if (!tab || !head || !grid) return;

  head.querySelector('h3')?.replaceChildren(document.createTextNode('Feld & Doku'));
  head.querySelector('.muted, p')?.replaceChildren(
    document.createTextNode('Kartenviewer, Feldstruktur, Dokumentationshinweise und offene Punkte.')
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
          <h3>Kartenviewer & Feldsteuerung</h3>
          <p>Raeumliche Informationen, Feldbereiche, Doku-Hinweise und offene operative Punkte werden hier zusammengefuehrt.</p>
        </div>
        <div class="button-row">
          <button class="btn primary" type="button" id="fieldDokuOpenMap">Kartenviewer oeffnen</button>
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
        <div id="fieldDokuOpenItems" class="stack-list"></div>
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
  document.getElementById('fieldDokuOpenMap')?.addEventListener('click', openMap);
  document.getElementById('fieldDokuRefresh')?.addEventListener('click', loadFieldDokuData);
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
    if (sync) sync.textContent = 'laedt ...';
    const client = getClient();
    if (!client) {
      if (sync) sync.textContent = 'Supabase fehlt';
      return;
    }
    const { data: sessionData } = await client.auth.getSession();
    if (!sessionData?.session) {
      if (sync) sync.textContent = 'nicht angemeldet';
      return;
    }
    const [tasksResult, notesResult] = await Promise.all([
      client
        .from('tasks')
        .select('id,title,description,category,subcategory,status,priority,due_date,assigned_role')
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('id'),
      client
        .from('notes')
        .select('id,title,body,category,subcategory,status,note_type,created_at')
        .order('created_at', { ascending: false })
    ]);
    if (tasksResult.error) throw tasksResult.error;
    if (notesResult.error) throw notesResult.error;
    state.tasks = tasksResult.data || [];
    state.notes = notesResult.data || [];
    renderFieldDoku();
    if (sync) sync.textContent = 'synchronisiert';
  } catch (error) {
    console.error(error);
    if (sync) sync.textContent = 'Fehler';
    const host = document.getElementById('fieldDokuOpenItems');
    if (host) host.innerHTML = `<div class="empty">Feldstatus konnte nicht geladen werden: ${escapeHtml(error.message || error)}</div>`;
  }
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

function renderFieldDoku() {
  const fieldTasks = state.tasks.filter(item => FIELD_CATEGORIES.has(item.category));
  const fieldNotes = state.notes.filter(item => FIELD_CATEGORIES.has(item.category));
  const openTasks = fieldTasks.filter(item => item.status !== 'erledigt');
  const openNotes = fieldNotes.filter(item => item.status !== 'erledigt');
  const safetyOpen = [...openTasks, ...openNotes].filter(item => item.category === 'sicherheit').length;
  const documentationOpen = [...openTasks, ...openNotes].filter(item => item.category === 'dokumentation').length;

  const stats = document.getElementById('fieldDokuStats');
  if (stats) {
    stats.innerHTML = [
      ['Feldaufgaben offen', openTasks.length],
      ['Doku-Punkte offen', documentationOpen],
      ['Sicherheit offen', safetyOpen],
      ['Notizen Feld/Doku', fieldNotes.length]
    ].map(([label, value]) => `<div class="field-doku-stat"><span>${label}</span><strong>${value}</strong></div>`).join('');
  }

  const items = [...openTasks.map(toTaskItem), ...openNotes.map(toNoteItem)]
    .sort((a, b) => scoreItem(b) - scoreItem(a))
    .slice(0, 8);
  const list = document.getElementById('fieldDokuOpenItems');
  if (list) {
    list.innerHTML = items.length
      ? items.map(renderItem).join('')
      : '<div class="empty">Keine offenen Feld- oder Dokumentationspunkte gefunden.</div>';
  }

  const categories = document.getElementById('fieldDokuCategories');
  if (categories) {
    categories.innerHTML = [
      ['dokumentation', 'Dokumentation'],
      ['schnitte', 'Grabungsflaechen'],
      ['funde', 'Funde / Proben'],
      ['sicherheit', 'Sicherheit'],
      ['schnittstelle_amt', 'Amt / Freigaben']
    ].map(([key, label]) => {
      const count = [...fieldTasks, ...fieldNotes].filter(item => item.category === key).length;
      return `<div class="field-doku-category"><span>${label}</span><strong>${count}</strong></div>`;
    }).join('');
  }
}

function toTaskItem(item) {
  return {
    type: 'Aufgabe',
    title: item.title,
    text: item.description,
    category: item.category,
    status: item.status,
    priority: item.priority,
    meta: [item.subcategory, item.assigned_role, item.due_date ? `faellig: ${formatDate(item.due_date)}` : ''].filter(Boolean).join(' · ')
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
  const status = item.status === 'blockiert' ? 5 : FIELD_STATUS_OPEN.has(item.status) ? 2 : 0;
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
            <span class="status ${escapeHtml(item.status || 'offen')}">${escapeHtml(prettyStatus(item.status))}</span>
            ${item.meta ? `<span>${escapeHtml(item.meta)}</span>` : ''}
          </div>
        </div>
      </div>
      ${item.text ? `<div class="muted">${escapeHtml(shorten(item.text, 190))}</div>` : ''}
    </div>
  `;
}

function openMap() {
  const mapButton = document.querySelector('[data-map-tab="map"]');
  if (mapButton) {
    mapButton.click();
    return;
  }
  const sync = document.getElementById('fieldDokuSync');
  if (sync) sync.textContent = 'Kartenmodul startet ...';
  window.setTimeout(() => document.querySelector('[data-map-tab="map"]')?.click(), 700);
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

function prettyStatus(status) {
  return ({ offen: 'offen', laufend: 'laufend', erledigt: 'erledigt', blockiert: 'blockiert', aktiv: 'aktiv' })[status] || status || '-';
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

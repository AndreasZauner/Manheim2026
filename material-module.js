import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const MANAGER_ROLES = ['admin', 'professor', 'technical_lead', 'assistant'];
const SOURCES = [
  ['lmu', 'LMU'],
  ['lvr', 'LVR / vor Ort'],
  ['privat', 'Privat']
];
const CATEGORIES = [
  ['dokumentation', 'Dokumentation'],
  ['fundverwaltung', 'Fundverwaltung'],
  ['feinwerkzeug', 'Feinwerkzeug'],
  ['grobwerkzeug', 'Grobwerkzeug'],
  ['wasser', 'Wasser / Schlaemmstation'],
  ['it_foto', 'IT / Foto'],
  ['psa_erste_hilfe', 'PSA / Erste Hilfe'],
  ['infrastruktur', 'Infrastruktur / Wetterschutz'],
  ['transport_lagerung', 'Transport / Lagerung'],
  ['verbrauch', 'Verbrauchsmaterial'],
  ['sonstiges', 'Sonstiges']
];
const STATUSES = [
  ['offen', 'offen'],
  ['angefragt', 'angefragt'],
  ['zugesagt', 'zugesagt'],
  ['beschafft', 'beschafft'],
  ['teilweise', 'teilweise'],
  ['fehlt', 'fehlt'],
  ['entfaellt', 'entfaellt']
];
const PRIORITIES = [['hoch', 'hoch'], ['mittel', 'mittel'], ['niedrig', 'niedrig']];

const state = {
  client: null,
  session: null,
  profile: null,
  items: [],
  activeSource: 'all',
  search: '',
  showArchived: false,
  editingId: null,
  loading: false,
  error: '',
  installed: false
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', installMaterialModule);
} else {
  installMaterialModule();
}

function installMaterialModule() {
  if (state.installed) return;
  state.installed = true;
  injectStylesheet();
  ensureMaterialNav();
  ensureMaterialShell();
  bindMaterialUi();
  waitForApp();
}

function injectStylesheet() {
  if (document.querySelector('link[href^="./material-module.css"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = './material-module.css?v=material-list-20260527-1';
  document.head.appendChild(link);
}

function waitForApp() {
  if (!document.getElementById('app')?.classList.contains('hidden')) {
    window.setTimeout(loadMaterialData, 0);
    return;
  }
  let checks = 0;
  const timer = window.setInterval(() => {
    checks += 1;
    ensureMaterialNav();
    ensureMaterialShell();
    if (!document.getElementById('app')?.classList.contains('hidden')) {
      window.clearInterval(timer);
      loadMaterialData();
    }
    if (checks > 80) window.clearInterval(timer);
  }, 250);
}

function ensureMaterialNav() {
  if (document.getElementById('materialNavButton')) return;
  const nav = document.querySelector('.nav');
  const before = document.querySelector('.nav-btn[data-tab="mindmap"]');
  if (!nav || !before) return;
  const button = document.createElement('button');
  button.className = 'nav-extra-btn';
  button.id = 'materialNavButton';
  button.type = 'button';
  button.textContent = 'Material & Beschaffung';
  nav.insertBefore(button, before);
}

function ensureMaterialShell() {
  if (document.getElementById('materialTab')) return;
  const main = document.querySelector('main.main');
  if (!main) return;
  const section = document.createElement('section');
  section.id = 'materialTab';
  section.className = 'tab';
  section.innerHTML = `
    <div class="section-head material-head">
      <div>
        <h3>Material & Beschaffung</h3>
        <p class="muted">Planung nach LMU, LVR / Vor-Ort-Beschaffung und privater Beschaffung.</p>
      </div>
      <div class="button-row">
        <button class="btn small" type="button" id="materialRefresh">Neu laden</button>
        <button class="btn small primary" type="button" id="materialNew">Neuer Gegenstand</button>
      </div>
    </div>
    <section id="materialModule" class="material-module">
      <div class="material-tabs" role="tablist" aria-label="Beschaffungswege">
        <button class="material-tab active" type="button" data-material-source="all">Alle</button>
        ${SOURCES.map(([value, label]) => `<button class="material-tab" type="button" data-material-source="${value}">${escapeHtml(label)}</button>`).join('')}
      </div>
      <div id="materialNotice" class="material-notice hidden"></div>
      <div class="material-toolbar">
        <input id="materialSearch" type="search" placeholder="Suchen nach Gegenstand, Gruppe, Hinweis ...">
        <label class="material-archive-toggle"><input id="materialShowArchived" type="checkbox"> Archivierte anzeigen</label>
      </div>
      <div id="materialKpis" class="material-kpis"></div>
      <div id="materialBoard" class="material-board"></div>
    </section>
  `;
  const anchor = document.getElementById('mindmapTab') || main.lastElementChild;
  main.insertBefore(section, anchor);
}

function bindMaterialUi() {
  document.addEventListener('click', event => {
    if (event.target.closest('#materialNavButton')) {
      activateMaterialTab();
      return;
    }
    if (event.target.closest('.nav-btn, #openPointsNavButton')) {
      document.getElementById('materialTab')?.classList.remove('active');
      document.getElementById('materialNavButton')?.classList.remove('active');
    }
    const sourceButton = event.target.closest('[data-material-source]');
    if (sourceButton) {
      state.activeSource = sourceButton.dataset.materialSource;
      renderMaterial();
      return;
    }
    if (event.target.closest('#materialRefresh')) loadMaterialData();
    if (event.target.closest('#materialNew')) openMaterialEditor();
    const edit = event.target.closest('[data-material-edit]');
    if (edit) openMaterialEditor(Number(edit.dataset.materialEdit));
    const archive = event.target.closest('[data-material-archive]');
    if (archive) archiveItem(Number(archive.dataset.materialArchive), true);
    const restore = event.target.closest('[data-material-restore]');
    if (restore) archiveItem(Number(restore.dataset.materialRestore), false);
    if (event.target.closest('#materialDrawerClose') || event.target.closest('#materialDrawerCancel') || event.target.closest('#materialBackdrop')) closeMaterialEditor();
  });
  document.addEventListener('input', event => {
    if (event.target?.id === 'materialSearch') {
      state.search = event.target.value;
      renderMaterial();
    }
  });
  document.addEventListener('change', event => {
    if (event.target?.id === 'materialShowArchived') {
      state.showArchived = event.target.checked;
      renderMaterial();
    }
  });
  document.addEventListener('submit', event => {
    if (event.target?.id === 'materialForm') {
      event.preventDefault();
      saveMaterialItem(event.target);
    }
  });
}

function activateMaterialTab() {
  ensureMaterialShell();
  document.querySelectorAll('.nav-btn, .nav-extra-btn').forEach(button => button.classList.remove('active'));
  document.getElementById('materialNavButton')?.classList.add('active');
  document.querySelectorAll('.tab').forEach(section => section.classList.remove('active'));
  document.getElementById('materialTab')?.classList.add('active');
  const title = document.getElementById('pageTitle');
  const subtitle = document.getElementById('pageSubtitle');
  if (title) title.textContent = 'Material & Beschaffung';
  if (subtitle) subtitle.textContent = 'LMU, LVR / Vor-Ort-Beschaffung und private Beschaffung im Ueberblick';
  renderMaterial();
}

async function loadMaterialData() {
  try {
    state.loading = true;
    state.error = '';
    renderMaterial();
    const client = getClient();
    if (!client) throw new Error('Supabase-Konfiguration fehlt.');
    const { data: sessionData } = await getAuthSession(client);
    state.session = sessionData?.session || null;
    if (!state.session) throw new Error('Keine aktive Anmeldung gefunden.');
    const profileRes = await client.from('profiles').select('role,is_active,full_name,email').eq('id', state.session.user.id).single();
    if (profileRes.error) throw profileRes.error;
    state.profile = profileRes.data;
    const { data, error } = await client
      .from('material_items')
      .select('*')
      .order('procurement_source', { ascending: true })
      .order('category', { ascending: true })
      .order('priority', { ascending: true })
      .order('title', { ascending: true });
    if (error) throw error;
    state.items = data || [];
  } catch (error) {
    console.error(error);
    state.error = error.message || String(error);
  } finally {
    state.loading = false;
    renderMaterial();
  }
}

function renderMaterial() {
  ensureMaterialShell();
  renderNotice();
  document.querySelectorAll('[data-material-source]').forEach(button => {
    button.classList.toggle('active', button.dataset.materialSource === state.activeSource);
  });
  const search = document.getElementById('materialSearch');
  if (search && search.value !== state.search) search.value = state.search;
  const archiveToggle = document.getElementById('materialShowArchived');
  if (archiveToggle) archiveToggle.checked = state.showArchived;
  const items = filteredItems();
  renderKpis(items);
  renderBoard(items);
}

function renderNotice() {
  const notice = document.getElementById('materialNotice');
  if (!notice) return;
  if (state.loading) {
    notice.className = 'material-notice';
    notice.textContent = 'Materialdaten werden geladen ...';
    return;
  }
  if (state.error) {
    notice.className = 'material-notice error';
    notice.innerHTML = `Materialmodul konnte nicht geladen werden: ${escapeHtml(state.error)}<br><small>Falls die Tabellen noch fehlen: <code>supabase/material_module.sql</code> in Supabase ausfuehren.</small>`;
    return;
  }
  notice.className = 'material-notice hidden';
  notice.textContent = '';
}

function renderKpis(items) {
  const host = document.getElementById('materialKpis');
  if (!host) return;
  const active = state.items.filter(item => !item.archived_at);
  host.innerHTML = [
    kpi('Offen', active.filter(item => ['offen', 'angefragt', 'teilweise', 'fehlt'].includes(item.status)).length, 'noch zu klaeren oder zu beschaffen'),
    kpi('LMU', active.filter(item => item.procurement_source === 'lmu').length, 'zentral / aus Muenchen'),
    kpi('LVR / vor Ort', active.filter(item => item.procurement_source === 'lvr').length, 'lokal anzufragen'),
    kpi('Privat', active.filter(item => item.procurement_source === 'privat').length, 'durch Andreas / privat')
  ].join('');
}

function renderBoard(items) {
  const host = document.getElementById('materialBoard');
  if (!host) return;
  if (!items.length) {
    host.innerHTML = empty(state.error ? 'Keine Daten geladen.' : 'Keine Gegenstaende fuer diese Auswahl.');
    return;
  }
  const sources = state.activeSource === 'all' ? SOURCES : SOURCES.filter(([value]) => value === state.activeSource);
  host.innerHTML = sources.map(([source, sourceLabel]) => {
    const sourceItems = items.filter(item => item.procurement_source === source);
    if (!sourceItems.length) return '';
    const groups = CATEGORIES.map(([category, label]) => {
      const groupItems = sourceItems.filter(item => item.category === category);
      if (!groupItems.length) return '';
      return `
        <section class="material-group">
          <div class="material-group-head">
            <h4>${escapeHtml(label)}</h4>
            <span>${groupItems.length} Positionen</span>
          </div>
          <div class="material-list">${groupItems.map(itemCard).join('')}</div>
        </section>
      `;
    }).join('');
    return `
      <section class="material-source-section">
        <div class="material-source-head">
          <h3>${escapeHtml(sourceLabel)}</h3>
          <span>${sourceItems.length} Gegenstaende</span>
        </div>
        ${groups}
      </section>
    `;
  }).join('');
}

function itemCard(item) {
  const quantity = [item.target_quantity, item.unit].filter(value => value !== null && value !== '').join(' ');
  const current = [item.current_quantity, item.unit].filter(value => value !== null && value !== '').join(' ');
  const facts = [
    quantity ? `Soll ${quantity}` : '',
    current ? `Ist ${current}` : '',
    item.needed_by ? `bis ${formatDate(item.needed_by)}` : '',
    item.storage_location || '',
    item.responsible_role ? `Verantw.: ${item.responsible_role}` : ''
  ].filter(Boolean);
  return `
    <article class="material-card ${item.archived_at ? 'archived' : ''}">
      <div class="material-card-main">
        <div class="material-card-title">
          <h5>${escapeHtml(item.title)}</h5>
          ${facts.length ? `<div class="material-meta">${facts.map(fact => `<span>${escapeHtml(fact)}</span>`).join('')}</div>` : ''}
        </div>
        <div class="material-state">
          <span class="status ${statusClass(item.status)}">${labelFor(STATUSES, item.status)}</span>
          <span class="chip">${escapeHtml(item.priority || 'mittel')}</span>
        </div>
        <div class="material-actions">
          ${canEdit() ? `<button class="btn small" type="button" data-material-edit="${item.id}">Bearbeiten</button>` : ''}
          ${canEdit() && !item.archived_at ? `<button class="btn small ghost" type="button" data-material-archive="${item.id}">Archivieren</button>` : ''}
          ${canEdit() && item.archived_at ? `<button class="btn small" type="button" data-material-restore="${item.id}">Wiederherstellen</button>` : ''}
        </div>
      </div>
      ${item.note ? `<p>${escapeHtml(item.note)}</p>` : ''}
    </article>
  `;
}

function openMaterialEditor(id = null) {
  if (!canEdit()) return;
  state.editingId = id;
  const item = id ? state.items.find(row => Number(row.id) === Number(id)) : null;
  const drawer = ensureDrawer();
  drawer.querySelector('#materialDrawerTitle').textContent = item ? 'Gegenstand bearbeiten' : 'Gegenstand erfassen';
  const form = drawer.querySelector('#materialForm');
  form.reset();
  form.elements.title.value = item?.title || '';
  form.elements.procurement_source.value = item?.procurement_source || (state.activeSource === 'all' ? 'lmu' : state.activeSource);
  form.elements.category.value = item?.category || 'dokumentation';
  form.elements.status.value = item?.status || 'offen';
  form.elements.priority.value = item?.priority || 'mittel';
  form.elements.target_quantity.value = item?.target_quantity ?? '';
  form.elements.current_quantity.value = item?.current_quantity ?? '';
  form.elements.unit.value = item?.unit || '';
  form.elements.needed_by.value = item?.needed_by || '';
  form.elements.storage_location.value = item?.storage_location || '';
  form.elements.responsible_role.value = item?.responsible_role || '';
  form.elements.note.value = item?.note || '';
  document.getElementById('materialBackdrop')?.classList.add('open');
  drawer.classList.add('open');
  drawer.setAttribute('aria-hidden', 'false');
  form.elements.title.focus();
}

function ensureDrawer() {
  let drawer = document.getElementById('materialDrawer');
  if (drawer) return drawer;
  document.body.insertAdjacentHTML('beforeend', `
    <div id="materialBackdrop" class="material-backdrop"></div>
    <aside id="materialDrawer" class="material-drawer" aria-hidden="true">
      <div class="material-drawer-head">
        <div>
          <h3 id="materialDrawerTitle">Gegenstand erfassen</h3>
          <p>Beschaffungsweg, Gruppe und Status pflegen.</p>
        </div>
        <button id="materialDrawerClose" class="material-close" type="button" aria-label="Schliessen">x</button>
      </div>
      <form id="materialForm" class="material-form">
        <label class="full">Gegenstand<input name="title" required></label>
        <label>Beschaffung<select name="procurement_source">${options(SOURCES)}</select></label>
        <label>Gruppe<select name="category">${options(CATEGORIES)}</select></label>
        <label>Status<select name="status">${options(STATUSES, 'offen')}</select></label>
        <label>Prioritaet<select name="priority">${options(PRIORITIES, 'mittel')}</select></label>
        <label>Soll-Menge<input name="target_quantity" type="number" min="0" step="0.01"></label>
        <label>Ist-Menge<input name="current_quantity" type="number" min="0" step="0.01"></label>
        <label>Einheit<input name="unit" placeholder="Stk., Rollen, Sets ..."></label>
        <label>Frist<input name="needed_by" type="date"></label>
        <label class="full">Lagerort / Kiste<input name="storage_location" placeholder="z. B. Teamkiste A, Doku-Kiste, vor Ort"></label>
        <label class="full">Verantwortlich<input name="responsible_role" placeholder="z. B. Assistenz technische Grabungsleitung"></label>
        <label class="full">Hinweis<textarea name="note" rows="4"></textarea></label>
        <div class="material-drawer-actions full">
          <button class="btn ghost" type="button" id="materialDrawerCancel">Abbrechen</button>
          <button class="btn primary" type="submit">Speichern</button>
        </div>
      </form>
    </aside>
  `);
  return document.getElementById('materialDrawer');
}

function closeMaterialEditor() {
  state.editingId = null;
  document.getElementById('materialBackdrop')?.classList.remove('open');
  const drawer = document.getElementById('materialDrawer');
  drawer?.classList.remove('open');
  drawer?.setAttribute('aria-hidden', 'true');
}

async function saveMaterialItem(form) {
  if (!canEdit()) return;
  const fd = new FormData(form);
  const payload = {
    title: clean(fd.get('title')),
    procurement_source: clean(fd.get('procurement_source')),
    category: clean(fd.get('category')),
    status: clean(fd.get('status')) || 'offen',
    priority: clean(fd.get('priority')) || 'mittel',
    target_quantity: nullableNumber(fd.get('target_quantity')),
    current_quantity: nullableNumber(fd.get('current_quantity')),
    unit: clean(fd.get('unit')) || null,
    needed_by: clean(fd.get('needed_by')) || null,
    storage_location: clean(fd.get('storage_location')) || null,
    responsible_role: clean(fd.get('responsible_role')) || null,
    note: clean(fd.get('note')) || null
  };
  const client = getClient();
  const query = state.editingId
    ? client.from('material_items').update(payload).eq('id', state.editingId)
    : client.from('material_items').insert({ ...payload, created_by: state.session.user.id });
  const { error } = await query;
  if (error) return alert('Gegenstand konnte nicht gespeichert werden: ' + error.message);
  closeMaterialEditor();
  await loadMaterialData();
}

async function archiveItem(id, archived) {
  if (!canEdit()) return;
  const { error } = await getClient()
    .from('material_items')
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq('id', id);
  if (error) return alert('Eintrag konnte nicht aktualisiert werden: ' + error.message);
  await loadMaterialData();
}

function filteredItems() {
  const query = state.search.trim().toLowerCase();
  return state.items
    .filter(item => state.showArchived || !item.archived_at)
    .filter(item => state.activeSource === 'all' || item.procurement_source === state.activeSource)
    .filter(item => {
      if (!query) return true;
      return [item.title, labelFor(CATEGORIES, item.category), item.note, item.storage_location, item.responsible_role]
        .some(value => String(value || '').toLowerCase().includes(query));
    });
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

function canEdit() {
  return Boolean(state.profile?.is_active) && MANAGER_ROLES.includes(state.profile?.role);
}
function kpi(label, value, note) {
  return `<div class="panel material-kpi"><span>${escapeHtml(label)}</span><strong>${value}</strong><small>${escapeHtml(note)}</small></div>`;
}
function options(rows, selected = '') {
  return rows.map(([value, label]) => `<option value="${value}" ${value === selected ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('');
}
function labelFor(rows, value) {
  return rows.find(([key]) => key === value)?.[1] || value || '-';
}
function statusClass(status) {
  if (['beschafft', 'zugesagt'].includes(status)) return 'erledigt';
  if (['fehlt', 'entfaellt'].includes(status)) return 'blockiert';
  return 'laufend';
}
function empty(text) {
  return `<div class="empty">${escapeHtml(text)}</div>`;
}
function clean(value) {
  return String(value ?? '').trim();
}
function nullableNumber(value) {
  const text = clean(value);
  return text === '' ? null : Number(text);
}
function formatDate(value) {
  if (!value) return '-';
  const date = new Date(String(value).slice(0, 10) + 'T00:00:00');
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('de-DE');
}
function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import MindElixir from 'https://cdn.jsdelivr.net/npm/mind-elixir@5.10.0/dist/MindElixir.js';

const MEMBERS = ['andreas-zauner@gmx.de', 'mahler1994niklas@web.de'];
const AREAS = [
  ['website', 'Website-Funktionen'],
  ['personal', 'Personal'],
  ['field', 'Feld & Doku'],
  ['map', 'Karte / GIS'],
  ['weather', 'Wetter / Leitstand'],
  ['finance', 'Finanzen'],
  ['logistics', 'Logistik'],
  ['general', 'Sonstiges']
];
const TYPES = [['idea', 'Idee'], ['todo', 'To-do'], ['decision', 'Entscheidung'], ['note', 'Notiz']];
const STATUSES = [['idea', 'Idee'], ['review', 'prüfen'], ['important', 'wichtig'], ['later', 'später'], ['done', 'umgesetzt'], ['archived', 'Archiv']];
const PRIORITIES = [['high', 'hoch'], ['medium', 'mittel'], ['low', 'niedrig']];

const state = {
  client: null,
  session: null,
  allowed: false,
  installed: false,
  loading: false,
  saving: false,
  error: '',
  linksError: '',
  items: [],
  links: [],
  linksAvailable: true,
  selectedId: null,
  draft: null,
  view: 'mindmap',
  search: '',
  area: 'all',
  status: 'active',
  mind: null,
  saveTimer: null,
  suppressMindEvents: false
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', installIdeaLab);
} else {
  installIdeaLab();
}

function installIdeaLab() {
  if (state.installed) return;
  state.installed = true;
  injectMindElixirCss();
  injectStyles();
  bindNavigationGuard();
  bindAuthListener();
  refreshAuthAndData();
  installAuthStabilizer();
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

function bindAuthListener() {
  const client = getClient();
  if (!client || state.authListenerBound) return;
  state.authListenerBound = true;
  client.auth.onAuthStateChange(event => {
    if (['INITIAL_SESSION', 'SIGNED_IN', 'TOKEN_REFRESHED', 'USER_UPDATED', 'SIGNED_OUT'].includes(event)) {
      window.setTimeout(refreshAuthAndData, 100);
    }
  });
}

function installAuthStabilizer() {
  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    if (state.allowed || attempts > 20) {
      window.clearInterval(timer);
      return;
    }
    refreshAuthAndData();
  }, 1200);
}

async function refreshAuthAndData() {
  const client = getClient();
  if (!client) return;
  try {
    const { data } = await getAuthSession(client);
    state.session = data?.session || null;
    state.allowed = false;
    if (!state.session?.user?.id) {
      removeIdeaLabShell();
      return;
    }
    const profile = await client.from('profiles').select('email').eq('id', state.session.user.id).maybeSingle();
    if (profile.error) console.warn('Ideenlabor-Profil konnte nicht geladen werden', profile.error);
    const email = String(profile.data?.email || state.session.user.email || '').trim().toLowerCase();
    state.allowed = MEMBERS.includes(email);
    if (!state.allowed) {
      removeIdeaLabShell();
      return;
    }
    ensureIdeaLabShell();
    await loadItems();
  } catch (error) {
    console.error('Ideenlabor konnte den Loginstatus nicht prüfen', error);
  }
}

async function loadItems() {
  const client = getClient();
  if (!client || !state.allowed) return;
  state.loading = true;
  state.error = '';
  state.linksError = '';
  renderIdeaLab();
  try {
    const [itemsRes, linksRes] = await Promise.all([
      client.from('idea_lab_items').select('*').order('sort_order', { ascending: true, nullsFirst: false }).order('updated_at', { ascending: false }),
      client.from('idea_lab_links').select('*').order('created_at', { ascending: true })
    ]);
    if (itemsRes.error) throw itemsRes.error;
    state.items = itemsRes.data || [];
    if (linksRes.error) {
      state.links = [];
      state.linksAvailable = false;
      state.linksError = linksRes.error.message || String(linksRes.error);
      console.warn('Ideenlabor-Verknüpfungen konnten nicht geladen werden', linksRes.error);
    } else {
      state.links = linksRes.data || [];
      state.linksAvailable = true;
    }
    if (!getSelectedItem() && state.items.length) {
      const firstActive = state.items.find(item => item.status !== 'archived') || state.items[0];
      state.selectedId = firstActive?.id || null;
    }
  } catch (error) {
    console.error('Ideenlabor-Daten konnten nicht geladen werden', error);
    state.error = error.message || String(error);
  } finally {
    state.loading = false;
    renderIdeaLab();
  }
}

function ensureIdeaLabShell() {
  ensureNavButton();
  ensureTab();
  renderIdeaLab();
}

function ensureNavButton() {
  if (document.getElementById('ideaLabNavButton')) return;
  const nav = document.querySelector('.nav');
  if (!nav) return;
  const button = document.createElement('button');
  button.id = 'ideaLabNavButton';
  button.type = 'button';
  button.className = 'nav-extra-btn idea-lab-nav-button';
  button.textContent = 'Ideenlabor';
  button.addEventListener('click', openIdeaLabTab);
  const adminButton = document.getElementById('adminTabButton');
  const openPointsButton = document.getElementById('openPointsNavButton');
  nav.insertBefore(button, adminButton || openPointsButton?.nextSibling || null);
}

function ensureTab() {
  if (document.getElementById('ideaLabTab')) return;
  const main = document.querySelector('.main');
  if (!main) return;
  const section = document.createElement('section');
  section.id = 'ideaLabTab';
  section.className = 'tab idea-lab-tab';
  section.addEventListener('click', handleIdeaLabClick);
  section.addEventListener('input', handleIdeaLabInput);
  section.addEventListener('change', handleIdeaLabChange);
  section.addEventListener('submit', handleIdeaLabSubmit);
  main.appendChild(section);
}

function removeIdeaLabShell() {
  document.getElementById('ideaLabNavButton')?.remove();
  document.getElementById('ideaLabTab')?.remove();
}

function openIdeaLabTab() {
  ensureIdeaLabShell();
  document.querySelectorAll('.nav-btn, .nav-extra-btn').forEach(button => button.classList.remove('active'));
  document.getElementById('ideaLabNavButton')?.classList.add('active');
  document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
  document.getElementById('ideaLabTab')?.classList.add('active');
  const title = document.getElementById('pageTitle');
  const subtitle = document.getElementById('pageSubtitle');
  if (title) title.textContent = 'Ideenlabor';
  if (subtitle) subtitle.textContent = 'Interne Mindmap für Funktionen, Grabungsideen und To-dos';
  renderIdeaLab();
}

function bindNavigationGuard() {
  document.addEventListener('click', event => {
    const button = event.target.closest?.('.nav-btn, .nav-extra-btn');
    if (!button || button.id === 'ideaLabNavButton') return;
    document.getElementById('ideaLabNavButton')?.classList.remove('active');
    document.getElementById('ideaLabTab')?.classList.remove('active');
  });
}

function renderIdeaLab() {
  const tab = document.getElementById('ideaLabTab');
  if (!tab) return;
  state.mind = null;
  tab.innerHTML = `
    <div class="idea-lab-page">
      ${renderHeader()}
      ${renderStatus()}
      ${renderToolbar()}
      <div class="idea-lab-workspace ${state.view === 'list' ? 'list-mode' : ''}">
        <main class="idea-lab-main-panel">${state.view === 'list' ? renderListView() : renderMindmapView()}</main>
        <aside class="idea-lab-detail-panel">${renderDetailPanel()}</aside>
      </div>
      ${renderImportDialog()}
    </div>
  `;
  window.requestAnimationFrame(mountMindmapIfNeeded);
}

function renderHeader() {
  const activeCount = state.items.filter(item => item.status !== 'archived').length;
  return `
    <div class="idea-lab-header">
      <div>
        <p class="idea-lab-kicker">Interner Arbeitsraum</p>
        <h3>Ideenlabor</h3>
        <p>Grafische Mindmap für Funktionen, offene Grabungsideen und To-dos von Andreas und Niklas.</p>
      </div>
      <div class="idea-lab-header-status">
        <span>${state.saving ? 'Speichert ...' : 'Synchronisiert'}</span>
        <small>${activeCount} aktive Knoten</small>
      </div>
    </div>
  `;
}

function renderStatus() {
  if (state.loading) return '<div class="idea-lab-notice">Ideenlabor wird geladen ...</div>';
  if (state.error) {
    return `<div class="idea-lab-notice error">Ideenlabor konnte nicht geladen werden: ${escapeHtml(state.error)}<span>Bitte prüfen, ob <code>supabase/idea_lab_module.sql</code> ausgeführt wurde.</span></div>`;
  }
  if (state.linksError) {
    return '<div class="idea-lab-notice">Querverbindungen sind noch nicht aktiv: <code>supabase/idea_lab_mindmap_links.sql</code> ausführen.</div>';
  }
  return '';
}

function renderToolbar() {
  return `
    <div class="idea-lab-toolbar">
      <div class="segmented-control">
        <button type="button" class="${state.view === 'mindmap' ? 'active' : ''}" data-idea-action="view" data-view="mindmap">Mindmap</button>
        <button type="button" class="${state.view === 'list' ? 'active' : ''}" data-idea-action="view" data-view="list">Knotenliste</button>
      </div>
      <label>Suche<input id="ideaLabSearch" type="search" value="${escapeAttribute(state.search)}" placeholder="Titel oder Inhalt"></label>
      <label>Bereich<select id="ideaLabAreaFilter"><option value="all">Alle Bereiche</option>${AREAS.map(([value, label]) => `<option value="${value}" ${state.area === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
      <label>Status<select id="ideaLabStatusFilter"><option value="active" ${state.status === 'active' ? 'selected' : ''}>Aktiv ohne Archiv</option><option value="all" ${state.status === 'all' ? 'selected' : ''}>Alle</option>${STATUSES.map(([value, label]) => `<option value="${value}" ${state.status === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
    </div>
  `;
}

function renderMindmapView() {
  if (!state.items.length && !state.error) {
    return `
      <div class="idea-lab-empty">
        <strong>Noch keine Ideen angelegt.</strong>
        <span>Starte mit einer neuen Idee oder füge eine Liste ein. Danach wird sie als Mindmap dargestellt.</span>
        <button type="button" class="primary-button" data-idea-action="new">Erste Idee anlegen</button>
      </div>
    `;
  }
  return `
    <div class="idea-mindmap-shell">
      <div class="idea-mindmap-actions">
        <div><strong>Grafische Mindmap</strong><span>Knoten ziehen, direkt umbenennen, Unterpunkte anhängen und per Rechtsklick verknüpfen.</span></div>
        <div class="idea-mindmap-buttons">
          <button type="button" class="secondary-button" data-idea-action="mind-fit">Zentrieren</button>
          <button type="button" class="secondary-button" data-idea-action="mind-child">Unterpunkt</button>
          <button type="button" class="secondary-button" data-idea-action="mind-sibling">Nachbaridee</button>
          <button type="button" class="secondary-button" data-idea-action="import-open">Liste einfügen</button>
          <button type="button" class="primary-button" data-idea-action="mind-save">Speichern</button>
        </div>
      </div>
      <div id="ideaMindmapCanvas" class="idea-mindmap-canvas"></div>
      <p class="idea-mindmap-hint">Änderungen werden automatisch gesichert. Bei Filtern wird die sichtbare Struktur gespeichert; Querverbindungen werden nur in der ungefilterten aktiven Ansicht aktualisiert.</p>
    </div>
  `;
}

function renderListView() {
  const visible = getVisibleItems();
  if (!visible.length) {
    return '<div class="idea-lab-empty"><strong>Keine passenden Einträge.</strong><span>Filter anpassen oder einen neuen Eintrag anlegen.</span></div>';
  }
  return `
    <div class="idea-list">
      ${visible.map(item => `
        <button type="button" class="idea-list-row ${Number(item.id) === Number(state.selectedId) ? 'active' : ''}" data-idea-id="${item.id}">
          <span class="idea-list-title">${escapeHtml(item.title)}</span>
          <span>${areaLabel(item.area)}</span>
          <span class="idea-chip ${statusClass(item.status)}">${statusLabel(item.status)}</span>
          <span class="idea-chip priority-${item.priority || 'medium'}">${priorityLabel(item.priority)}</span>
        </button>
      `).join('')}
    </div>
  `;
}

function renderDetailPanel() {
  if (state.error) return '<h4>Setup erforderlich</h4><p>Die Datenbanktabelle ist nicht erreichbar.</p>';
  const selected = getSelectedItem();
  const item = state.draft || selected;
  if (!item) {
    return '<div class="idea-lab-detail-empty"><h4>Knoten auswählen</h4><p>Wähle einen Knoten in der Mindmap oder lege eine neue Idee an.</p><button type="button" class="primary-button" data-idea-action="new">Neue Idee</button></div>';
  }
  return `
    <form id="ideaLabForm" class="idea-lab-form">
      <h4>${state.draft ? 'Neue Idee' : 'Knoten bearbeiten'}</h4>
      <label>Titel<input name="title" required value="${escapeAttribute(item.title || '')}" placeholder="Kurz und eindeutig"></label>
      <label>Beschreibung / Notiz<textarea name="description" rows="6" placeholder="Gedanke, To-do, offene Frage oder Kontext">${escapeHtml(item.description || '')}</textarea></label>
      <div class="idea-lab-field-grid">
        <label>Bereich<select name="area">${AREAS.map(([value, label]) => `<option value="${value}" ${normalizeArea(item.area) === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
        <label>Typ<select name="item_type">${TYPES.map(([value, label]) => `<option value="${value}" ${(item.item_type || 'idea') === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
        <label>Status<select name="status">${STATUSES.map(([value, label]) => `<option value="${value}" ${(item.status || 'idea') === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
        <label>Priorität<select name="priority">${PRIORITIES.map(([value, label]) => `<option value="${value}" ${(item.priority || 'medium') === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
      </div>
      <label>Übergeordneter Knoten<select name="parent_id"><option value="">Keiner</option>${state.items.filter(candidate => candidate.id !== item.id).map(candidate => `<option value="${candidate.id}" ${Number(item.parent_id) === Number(candidate.id) ? 'selected' : ''}>${escapeHtml(candidate.title)}</option>`).join('')}</select></label>
      <div class="idea-lab-form-actions">
        <button type="submit" class="primary-button">Speichern</button>
        <button type="button" class="secondary-button" data-idea-action="cancel">Abbrechen</button>
        ${selected && !state.draft ? '<button type="button" class="danger-button" data-idea-action="archive">Archivieren</button>' : ''}
      </div>
      ${selected && !state.draft ? '<button type="button" class="link-action" data-idea-action="task">Als Aufgabe vormerken</button>' : ''}
    </form>
  `;
}

function renderImportDialog() {
  return `
    <div class="idea-import-backdrop" id="ideaImportDialog" hidden>
      <div class="idea-import-dialog">
        <div class="idea-import-head"><h4>Liste in Mindmap einfügen</h4><button type="button" data-idea-action="import-close" aria-label="Schließen">×</button></div>
        <label>Sammelknoten<input id="ideaImportGroup" placeholder="z. B. Kartenviewer offene Funktionen"></label>
        <label>Bereich<select id="ideaImportArea">${AREAS.map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}</select></label>
        <label>Liste<textarea id="ideaImportText" rows="9" placeholder="- Punkt eins&#10;- Punkt zwei&#10;3. Punkt drei"></textarea></label>
        <div class="idea-lab-form-actions"><button type="button" class="primary-button" data-idea-action="import-save">Einfügen</button><button type="button" class="secondary-button" data-idea-action="import-close">Abbrechen</button></div>
      </div>
    </div>
  `;
}

function handleIdeaLabClick(event) {
  const node = event.target.closest('[data-idea-id]');
  if (node) {
    state.selectedId = Number(node.dataset.ideaId);
    state.draft = null;
    renderIdeaLab();
    return;
  }
  const action = event.target.closest('[data-idea-action]')?.dataset.ideaAction;
  if (!action) return;
  if (action === 'reload') loadItems();
  if (action === 'new') startNewDraft();
  if (action === 'mind-child') createRelatedDraft('child');
  if (action === 'mind-sibling') createRelatedDraft('sibling');
  if (action === 'mind-fit') fitMindmap();
  if (action === 'mind-save') persistMindmapNow();
  if (action === 'cancel') cancelEdit();
  if (action === 'archive') archiveSelected();
  if (action === 'task') createTaskFromSelected();
  if (action === 'import-open') openImportDialog();
  if (action === 'import-close') closeImportDialog();
  if (action === 'import-save') importList();
  if (action === 'view') {
    state.view = event.target.closest('[data-view]')?.dataset.view || 'mindmap';
    renderIdeaLab();
  }
}

function handleIdeaLabInput(event) {
  if (event.target?.id === 'ideaLabSearch') {
    state.search = event.target.value;
    renderIdeaLab();
  }
}

function handleIdeaLabChange(event) {
  if (event.target?.id === 'ideaLabAreaFilter') {
    state.area = event.target.value;
    renderIdeaLab();
  }
  if (event.target?.id === 'ideaLabStatusFilter') {
    state.status = event.target.value;
    renderIdeaLab();
  }
}

function handleIdeaLabSubmit(event) {
  if (event.target?.id !== 'ideaLabForm') return;
  event.preventDefault();
  saveItem(event.target);
}

function startNewDraft() {
  state.draft = { title: '', description: '', area: state.area !== 'all' ? state.area : 'website', item_type: 'idea', status: 'idea', priority: 'medium', parent_id: null };
  renderIdeaLab();
}

function createRelatedDraft(mode) {
  const selected = getSelectedItem();
  if (!selected) {
    window.alert('Bitte zuerst einen Knoten auswählen.');
    return;
  }
  state.draft = { title: '', description: '', area: selected.area || 'general', item_type: 'todo', status: 'idea', priority: 'medium', parent_id: mode === 'child' ? selected.id : selected.parent_id || null };
  renderIdeaLab();
}

function cancelEdit() {
  state.draft = null;
  renderIdeaLab();
}

async function saveItem(form) {
  if (!state.allowed) return;
  const client = getClient();
  const payload = formPayload(form);
  if (!payload.title) {
    window.alert('Bitte einen Titel eintragen.');
    return;
  }
  try {
    const selected = getSelectedItem();
    const isNew = Boolean(state.draft || !selected);
    const query = isNew
      ? client.from('idea_lab_items').insert({ ...payload, created_by: state.session.user.id }).select('*').single()
      : client.from('idea_lab_items').update(payload).eq('id', selected.id).select('*').single();
    const { data, error } = await query;
    if (error) throw error;
    state.draft = null;
    state.selectedId = data?.id || state.selectedId;
    await loadItems();
  } catch (error) {
    console.error(error);
    window.alert(`Speichern fehlgeschlagen: ${error.message || error}`);
  }
}

function formPayload(form) {
  const data = new FormData(form);
  const parentId = data.get('parent_id');
  return {
    title: String(data.get('title') || '').trim(),
    description: String(data.get('description') || '').trim() || null,
    area: normalizeArea(data.get('area')),
    item_type: String(data.get('item_type') || 'idea'),
    status: String(data.get('status') || 'idea'),
    priority: String(data.get('priority') || 'medium'),
    parent_id: parentId ? Number(parentId) : null
  };
}

async function archiveSelected() {
  const selected = getSelectedItem();
  if (!selected) return;
  if (!window.confirm(`Eintrag "${selected.title}" ins Archiv verschieben?`)) return;
  try {
    const { error } = await getClient().from('idea_lab_items').update({ status: 'archived' }).eq('id', selected.id);
    if (error) throw error;
    state.selectedId = null;
    await loadItems();
  } catch (error) {
    console.error(error);
    window.alert(`Archivieren fehlgeschlagen: ${error.message || error}`);
  }
}

async function createTaskFromSelected() {
  const selected = getSelectedItem();
  if (!selected) return;
  if (!window.confirm('Diesen Ideenlabor-Eintrag als Aufgabe vormerken?')) return;
  const categoryMap = { website: 'Steuerung', personal: 'Personal', field: 'Dokumentation', map: 'Dokumentation', weather: 'Steuerung', finance: 'Logistik', logistics: 'Logistik', general: 'Steuerung' };
  try {
    const { error } = await getClient().from('tasks').insert({
      title: selected.title,
      description: selected.description || 'Aus dem Ideenlabor vorgemerkt.',
      category: categoryMap[normalizeArea(selected.area)] || 'Steuerung',
      subcategory: 'Ideenlabor',
      status: 'offen',
      priority: selected.priority === 'high' ? 'hoch' : selected.priority === 'low' ? 'niedrig' : 'mittel',
      assigned_role: 'Technische Leitung',
      created_by: state.session.user.id
    });
    if (error) throw error;
    window.alert('Aufgabe wurde vorgemerkt.');
  } catch (error) {
    console.error(error);
    window.alert(`Aufgabe konnte nicht angelegt werden: ${error.message || error}`);
  }
}

function mountMindmapIfNeeded() {
  if (state.view !== 'mindmap') return;
  const canvas = document.getElementById('ideaMindmapCanvas');
  if (!canvas || state.error || !state.items.length) return;
  canvas.innerHTML = '';
  state.suppressMindEvents = true;
  const side = MindElixir.SIDE || 2;
  const mind = new MindElixir({
    el: canvas,
    direction: side,
    draggable: true,
    contextMenu: true,
    toolBar: true,
    nodeMenu: true,
    keypress: true,
    locale: 'de',
    allowUndo: true
  });
  mind.init(buildMindmapData(side));
  state.mind = mind;
  mind.bus.addListener('operation', () => {
    if (!state.suppressMindEvents) scheduleMindmapPersist();
  });
  canvas.addEventListener('click', event => {
    const topic = event.target.closest('[data-nodeid]');
    const id = parseMindIdeaId(topic?.dataset?.nodeid);
    if (!id) return;
    state.selectedId = id;
    state.draft = null;
    renderDetailOnly();
  });
  window.setTimeout(() => {
    state.suppressMindEvents = false;
    fitMindmap();
  }, 180);
}

function buildMindmapData(direction) {
  const visible = getVisibleItems();
  const itemById = new Map(visible.map(item => [Number(item.id), item]));
  const children = new Map();
  visible.forEach((item, index) => {
    const parentId = Number(item.parent_id);
    const parentKey = parentId && itemById.has(parentId) ? `idea-${parentId}` : `area-${normalizeArea(item.area)}`;
    if (!children.has(parentKey)) children.set(parentKey, []);
    children.get(parentKey).push({ item, index });
  });
  const areaNodes = AREAS
    .filter(([area]) => state.area === 'all' || state.area === area || children.has(`area-${area}`))
    .map(([area, label], index) => ({ id: `area-${area}`, topic: label, direction: index % 2, expanded: true, children: buildChildNodes(`area-${area}`, children) }))
    .filter(node => node.children.length || state.area === node.id.replace('area-', ''));
  return {
    nodeData: { id: 'idea-lab-root', topic: 'Ideenlabor', root: true, children: areaNodes.length ? areaNodes : [{ id: 'area-general', topic: 'Sonstiges', direction: 0, children: [] }] },
    arrows: getVisibleLinks().map(link => ({ id: `link-${link.id}`, label: link.label || '', from: `idea-${link.source_item_id}`, to: `idea-${link.target_item_id}`, delta1: link.delta1 || { x: -80, y: 0 }, delta2: link.delta2 || { x: 80, y: 0 } })),
    direction,
    theme: {
      name: 'Kerpen-Manheim',
      palette: ['#0f2a40', '#2b7de1', '#1e9a55', '#f4a42d', '#d84040', '#5a7088'],
      cssVar: { '--root-bgcolor': '#0f2a40', '--root-color': '#ffffff', '--main-bgcolor': '#ffffff', '--main-color': '#08233d', '--color': '#39536c', '--bgcolor': '#ffffff' }
    }
  };
}

function buildChildNodes(parentKey, childrenMap) {
  return (childrenMap.get(parentKey) || [])
    .sort((a, b) => {
      const orderA = Number.isFinite(a.item.sort_order) ? a.item.sort_order : a.index;
      const orderB = Number.isFinite(b.item.sort_order) ? b.item.sort_order : b.index;
      return orderA - orderB || String(a.item.title).localeCompare(String(b.item.title), 'de');
    })
    .map(({ item }) => ({ id: `idea-${item.id}`, topic: item.title, expanded: true, tags: [statusLabel(item.status), priorityLabel(item.priority)], children: buildChildNodes(`idea-${item.id}`, childrenMap) }));
}

function scheduleMindmapPersist() {
  window.clearTimeout(state.saveTimer);
  state.saveTimer = window.setTimeout(persistMindmapNow, 800);
}

async function persistMindmapNow() {
  if (!state.mind || !state.allowed || state.suppressMindEvents) return;
  const client = getClient();
  state.saving = true;
  renderHeaderStatusOnly();
  try {
    await commitPendingMindmapEdit();
    const data = state.mind.getData();
    const entries = flattenMindNodes(data.nodeData);
    const idMap = new Map();
    const updatedItems = new Map(state.items.map(item => [Number(item.id), { ...item }]));
    let insertedNewNodes = false;
    for (const entry of entries) {
      const existingId = parseMindIdeaId(entry.node.id);
      const parentId = parseMindIdeaId(entry.parentNodeId) || idMap.get(entry.parentNodeId) || null;
      const payload = { title: String(entry.node.topic || 'Neue Idee').trim() || 'Neue Idee', area: entry.area, parent_id: parentId, sort_order: entry.sortOrder };
      if (existingId) {
        const current = updatedItems.get(existingId);
        if (!current) continue;
        if (current.title !== payload.title || normalizeArea(current.area) !== payload.area || Number(current.parent_id || 0) !== Number(parentId || 0) || Number(current.sort_order ?? -1) !== Number(payload.sort_order)) {
          const { error } = await client.from('idea_lab_items').update(payload).eq('id', existingId);
          if (error) throw error;
          updatedItems.set(existingId, { ...current, ...payload });
        }
        idMap.set(entry.node.id, existingId);
      } else if (!isVirtualMindNode(entry.node.id)) {
        const { data: inserted, error } = await client.from('idea_lab_items').insert({ ...payload, description: null, item_type: 'todo', status: 'idea', priority: 'medium', created_by: state.session.user.id }).select('*').single();
        if (error) throw error;
        insertedNewNodes = true;
        idMap.set(entry.node.id, Number(inserted.id));
        updatedItems.set(Number(inserted.id), inserted);
      }
    }
    await persistMindmapLinks(data.arrows, idMap);
    state.items = Array.from(updatedItems.values());
    if (insertedNewNodes) await loadItems();
    renderDetailOnly();
  } catch (error) {
    console.error('Mindmap konnte nicht gespeichert werden', error);
    window.alert(`Mindmap konnte nicht gespeichert werden: ${error.message || error}`);
  } finally {
    state.saving = false;
    renderHeaderStatusOnly();
  }
}

async function persistMindmapLinks(arrows, idMap) {
  if (!state.linksAvailable || !Array.isArray(arrows)) return;
  if (state.search || state.area !== 'all' || state.status !== 'active') return;
  const rows = arrows
    .map(arrow => {
      const source = parseMindIdeaId(arrow.from) || idMap.get(arrow.from);
      const target = parseMindIdeaId(arrow.to) || idMap.get(arrow.to);
      if (!source || !target || source === target) return null;
      return { source_item_id: source, target_item_id: target, label: arrow.label || null, delta1: arrow.delta1 || null, delta2: arrow.delta2 || null, created_by: state.session.user.id };
    })
    .filter(Boolean);
  const client = getClient();
  const deleteRes = await client.from('idea_lab_links').delete().gte('id', 0);
  if (deleteRes.error) throw deleteRes.error;
  if (!rows.length) {
    state.links = [];
    return;
  }
  const insertRes = await client.from('idea_lab_links').insert(rows).select('*');
  if (insertRes.error) throw insertRes.error;
  state.links = insertRes.data || [];
}

function flattenMindNodes(root) {
  const entries = [];
  const walk = (node, context) => {
    if (!node) return;
    const id = String(node.id || '').replace(/^me/, '');
    let nextContext = { ...context };
    if (id.startsWith('area-')) {
      nextContext = { ...nextContext, area: areaFromMindTopic(node.topic, id.replace('area-', '')), parentNodeId: null };
    } else if (id !== 'idea-lab-root') {
      entries.push({ node: { ...node, id }, area: nextContext.area, parentNodeId: nextContext.parentNodeId, sortOrder: nextContext.childIndex });
      nextContext = { ...nextContext, parentNodeId: id };
    }
    (node.children || []).forEach((child, index) => walk(child, { ...nextContext, childIndex: index }));
  };
  walk(root, { area: 'general', parentNodeId: null, childIndex: 0 });
  return entries;
}

function commitPendingMindmapEdit() {
  const active = document.activeElement;
  const editingMindmapTopic = active?.id === 'input-box' || active?.isContentEditable || active?.getAttribute?.('contenteditable') === 'plaintext-only';
  if (!editingMindmapTopic) return Promise.resolve();
  active.blur();
  state.mind?.container?.focus?.();
  return new Promise(resolve => window.setTimeout(resolve, 80));
}

function fitMindmap() {
  state.mind?.scaleFit?.();
  state.mind?.toCenter?.();
}

function renderDetailOnly() {
  const panel = document.querySelector('#ideaLabTab .idea-lab-detail-panel');
  if (panel) panel.innerHTML = renderDetailPanel();
}

function renderHeaderStatusOnly() {
  const status = document.querySelector('#ideaLabTab .idea-lab-header-status span');
  if (status) status.textContent = state.saving ? 'Speichert ...' : 'Synchronisiert';
}

function getVisibleLinks() {
  const ids = new Set(getVisibleItems().map(item => Number(item.id)));
  return state.links.filter(link => ids.has(Number(link.source_item_id)) && ids.has(Number(link.target_item_id)));
}

function getVisibleItems() {
  const search = state.search.trim().toLowerCase();
  return state.items.filter(item => {
    if (state.status === 'active' && item.status === 'archived') return false;
    if (state.status !== 'all' && state.status !== 'active' && item.status !== state.status) return false;
    if (state.area !== 'all' && normalizeArea(item.area) !== state.area) return false;
    if (!search) return true;
    return [item.title, item.description, areaLabel(item.area), statusLabel(item.status)].filter(Boolean).some(value => String(value).toLowerCase().includes(search));
  });
}

function getSelectedItem() {
  return state.items.find(item => Number(item.id) === Number(state.selectedId)) || null;
}

function parseMindIdeaId(id) {
  const match = String(id || '').replace(/^me/, '').match(/^idea-(\d+)$/);
  return match ? Number(match[1]) : null;
}

function isVirtualMindNode(id) {
  const value = String(id || '').replace(/^me/, '');
  return value === 'idea-lab-root' || value.startsWith('area-');
}

function normalizeArea(area) {
  const key = String(area || 'general');
  return AREAS.some(([value]) => value === key) ? key : 'general';
}

function areaFromMindTopic(topic, fallback) {
  const normalizedTopic = normalizeLookup(topic);
  const match = AREAS.find(([value, label]) => normalizeLookup(value) === normalizedTopic || normalizeLookup(label) === normalizedTopic);
  return match?.[0] || normalizeArea(fallback);
}

function normalizeLookup(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function areaLabel(area) {
  return AREAS.find(([value]) => value === normalizeArea(area))?.[1] || 'Sonstiges';
}

function statusLabel(status) {
  return STATUSES.find(([value]) => value === status)?.[1] || 'Idee';
}

function priorityLabel(priority) {
  return PRIORITIES.find(([value]) => value === priority)?.[1] || 'mittel';
}

function statusClass(status) {
  return `status-${status || 'idea'}`;
}

function openImportDialog() {
  const dialog = document.getElementById('ideaImportDialog');
  if (!dialog) return;
  dialog.hidden = false;
  document.getElementById('ideaImportText')?.focus();
}

function closeImportDialog() {
  const dialog = document.getElementById('ideaImportDialog');
  if (dialog) dialog.hidden = true;
}

async function importList() {
  const text = document.getElementById('ideaImportText')?.value || '';
  const groupTitle = document.getElementById('ideaImportGroup')?.value?.trim() || '';
  const area = normalizeArea(document.getElementById('ideaImportArea')?.value);
  const lines = text.split(/\r?\n/).map(line => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim()).filter(Boolean);
  if (!lines.length) {
    window.alert('Bitte mindestens einen Listenpunkt einfügen.');
    return;
  }
  try {
    let parentId = null;
    if (groupTitle) {
      const groupRes = await getClient().from('idea_lab_items').insert({ title: groupTitle, description: null, area, item_type: 'note', status: 'idea', priority: 'medium', created_by: state.session.user.id }).select('id').single();
      if (groupRes.error) throw groupRes.error;
      parentId = groupRes.data.id;
    }
    const rows = lines.map((title, index) => ({ title, description: null, area, item_type: 'todo', status: 'idea', priority: 'medium', parent_id: parentId, sort_order: index + 1, created_by: state.session.user.id }));
    const { error } = await getClient().from('idea_lab_items').insert(rows);
    if (error) throw error;
    closeImportDialog();
    state.selectedId = parentId;
    await loadItems();
  } catch (error) {
    console.error(error);
    window.alert(`Liste konnte nicht eingefügt werden: ${error.message || error}`);
  }
}

function escapeHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, '&#096;');
}

function injectMindElixirCss() {
  if (document.getElementById('mindElixirStyles')) return;
  const link = document.createElement('link');
  link.id = 'mindElixirStyles';
  link.rel = 'stylesheet';
  link.href = 'https://cdn.jsdelivr.net/npm/mind-elixir@5.10.0/dist/MindElixir.css';
  document.head.appendChild(link);
}

function injectStyles() {
  if (document.getElementById('ideaLabStyles')) return;
  const style = document.createElement('style');
  style.id = 'ideaLabStyles';
  style.textContent = `
    .idea-lab-nav-button{margin-top:6px}.idea-lab-tab.active{display:block}.idea-lab-page{display:flex;flex-direction:column;gap:14px}.idea-lab-header{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;padding:18px;border:1px solid #d6e2ef;border-radius:16px;background:linear-gradient(135deg,#0f2a40,#1f5572);color:#fff;box-shadow:0 18px 40px rgba(15,42,64,.14)}.idea-lab-header h3{margin:4px 0 6px;font-size:30px}.idea-lab-header p{margin:0;color:rgba(255,255,255,.86)}.idea-lab-kicker{margin:0;color:rgba(255,255,255,.68)!important;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.idea-lab-header-status{display:grid;gap:4px;justify-items:end}.idea-lab-header-status span{border-radius:999px;background:rgba(255,255,255,.14);padding:8px 12px;font-weight:900}.idea-lab-header-status small{color:rgba(255,255,255,.75);font-weight:800}.idea-lab-toolbar{display:grid;grid-template-columns:auto minmax(220px,1fr) minmax(150px,210px) minmax(150px,210px);gap:12px;align-items:end}.idea-lab-toolbar label,.idea-lab-form label,.idea-import-dialog label{display:grid;gap:6px;color:#5a7088;font-size:13px;font-weight:700}.idea-lab-toolbar input,.idea-lab-toolbar select,.idea-lab-form input,.idea-lab-form select,.idea-lab-form textarea,.idea-import-dialog input,.idea-import-dialog select,.idea-import-dialog textarea{width:100%;border:1px solid #d2dfec;border-radius:10px;padding:10px 12px;color:#08233d;background:#fff;font:inherit}.segmented-control{display:inline-flex;gap:6px;padding:4px;border:1px solid #d6e2ef;border-radius:12px;background:#fff}.segmented-control button{border:0;border-radius:9px;padding:9px 14px;background:transparent;color:#0b2942;font-weight:800;cursor:pointer}.segmented-control button.active{background:#2b7de1;color:#fff}.idea-lab-workspace{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:16px;align-items:start}.idea-lab-main-panel,.idea-lab-detail-panel{border:1px solid #d6e2ef;border-radius:16px;background:rgba(255,255,255,.96);box-shadow:0 16px 32px rgba(31,85,114,.07)}.idea-lab-main-panel{min-height:690px;padding:14px;overflow:hidden}.idea-lab-detail-panel{position:sticky;top:18px;padding:18px}.idea-lab-detail-panel h4{margin:0 0 12px;font-size:18px}.idea-mindmap-shell{display:grid;gap:12px;min-height:660px}.idea-mindmap-actions{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding:12px;border:1px solid #d6e2ef;border-radius:14px;background:#f7fbff}.idea-mindmap-actions strong,.idea-mindmap-actions span{display:block}.idea-mindmap-actions strong{color:#08233d;font-size:15px}.idea-mindmap-actions span,.idea-mindmap-hint{color:#5a7088;font-size:13px;line-height:1.35}.idea-mindmap-buttons,.idea-lab-form-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}.idea-mindmap-canvas{height:min(72vh,760px);min-height:560px;width:100%;overflow:hidden;border:1px solid #d6e2ef;border-radius:16px;background:#fff}.idea-mindmap-canvas .map-container{background:#fff}.idea-mindmap-canvas .topic{border-radius:10px;font-family:inherit;font-weight:800}.idea-list{display:grid;gap:8px}.idea-list-row{display:grid;grid-template-columns:minmax(240px,1fr) 150px 90px 90px;gap:10px;align-items:center;width:100%;border:1px solid #d6e2ef;border-radius:12px;background:#fff;color:#08233d;text-align:left;cursor:pointer;padding:11px 12px}.idea-list-row.active{border-color:#2b7de1;box-shadow:0 0 0 3px rgba(43,125,225,.14)}.idea-list-title{font-weight:850}.idea-chip{display:inline-flex;width:fit-content;align-items:center;border-radius:999px;padding:3px 8px;background:#edf4fb;color:#0b2942;font-size:12px;font-weight:850}.priority-high{background:#ffe9e6;color:#b82828}.priority-medium{background:#fff3d6;color:#946200}.priority-low{background:#e7f8ee;color:#0f7a3e}.idea-lab-form{display:grid;gap:12px}.idea-lab-field-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.idea-lab-notice,.idea-lab-empty{display:grid;gap:8px;margin-bottom:0;padding:12px 14px;border:1px solid #d6e2ef;border-radius:12px;background:#f6fbff;color:#39536c}.idea-lab-notice.error{border-color:#f0b7b7;background:#fff5f5;color:#b82828}.idea-lab-detail-empty{display:grid;gap:10px;color:#39536c}.link-action{width:fit-content;border:0;background:transparent;color:#1e67bd;font-weight:850;cursor:pointer}.danger-button{border:1px solid #d84040;border-radius:10px;padding:10px 14px;background:#fff0f0;color:#b82828;font-weight:850;cursor:pointer}.idea-import-backdrop{position:fixed;inset:0;z-index:3000;display:grid;place-items:center;padding:20px;background:rgba(8,35,61,.28)}.idea-import-backdrop[hidden]{display:none}.idea-import-dialog{display:grid;gap:13px;width:min(620px,100%);border-radius:18px;padding:20px;background:#fff;box-shadow:0 24px 80px rgba(8,35,61,.28)}.idea-import-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.idea-import-head h4{margin:0;font-size:19px}.idea-import-head button{border:0;background:transparent;color:#0b2942;font-size:26px;line-height:1;cursor:pointer}@media (max-width:1100px){.idea-lab-workspace{grid-template-columns:1fr}.idea-lab-detail-panel{position:static}.idea-lab-main-panel{min-height:620px}}@media (max-width:800px){.idea-lab-header,.idea-lab-toolbar,.idea-mindmap-actions{display:grid;grid-template-columns:1fr}.idea-lab-header-status{justify-items:start}.idea-mindmap-buttons,.idea-lab-form-actions{justify-content:flex-start}.idea-list-row{grid-template-columns:1fr}.idea-mindmap-canvas{height:70vh}}
  `;
  document.head.appendChild(style);
}

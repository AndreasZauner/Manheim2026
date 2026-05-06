import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const IDEA_LAB_MEMBERS = ['andreas-zauner@gmx.de', 'mahler1994niklas@web.de'];

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

const TYPES = [
  ['idea', 'Idee'],
  ['todo', 'To-do'],
  ['decision', 'Entscheidung'],
  ['note', 'Notiz']
];

const STATUSES = [
  ['idea', 'Idee'],
  ['review', 'prüfen'],
  ['important', 'wichtig'],
  ['later', 'später'],
  ['done', 'umgesetzt'],
  ['archived', 'Archiv']
];

const PRIORITIES = [
  ['high', 'hoch'],
  ['medium', 'mittel'],
  ['low', 'niedrig']
];

const state = {
  client: null,
  session: null,
  profile: null,
  allowed: false,
  installed: false,
  loading: false,
  error: '',
  items: [],
  selectedId: null,
  view: 'mindmap',
  search: '',
  filterArea: 'all',
  filterStatus: 'active'
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', installIdeaLab);
} else {
  installIdeaLab();
}

function installIdeaLab() {
  if (state.installed) return;
  state.installed = true;
  injectStyles();
  bindGlobalNavigationGuard();
  refreshAuthAndData();
  bindAuthListener();
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
  client.auth.onAuthStateChange((event) => {
    if (['INITIAL_SESSION', 'SIGNED_IN', 'TOKEN_REFRESHED', 'USER_UPDATED', 'SIGNED_OUT'].includes(event)) {
      window.setTimeout(refreshAuthAndData, 80);
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
    state.profile = null;
    state.allowed = false;
    if (!state.session?.user?.id) {
      removeIdeaLabShell();
      return;
    }
    const profileRes = await client
      .from('profiles')
      .select('email,full_name,role,is_active')
      .eq('id', state.session.user.id)
      .maybeSingle();
    if (profileRes.error) console.warn('Ideenlabor-Profil konnte nicht geladen werden', profileRes.error);
    state.profile = profileRes.data || null;
    const email = String(state.profile?.email || state.session.user.email || '').trim().toLowerCase();
    state.allowed = IDEA_LAB_MEMBERS.includes(email);
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
  renderIdeaLab();
  try {
    const { data, error } = await client
      .from('idea_lab_items')
      .select('*')
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('updated_at', { ascending: false });
    if (error) throw error;
    state.items = data || [];
    if (!state.selectedId && state.items.length) {
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
  section.innerHTML = `
    <div class="idea-lab-page">
      <div class="idea-lab-header">
        <div>
          <p class="idea-lab-kicker">Interner Arbeitsraum</p>
          <h3>Ideenlabor</h3>
          <p>Mindmap, To-dos und offene Website-Ideen für Andreas Zauner und Niklas Mahler.</p>
        </div>
        <div class="idea-lab-header-actions">
          <button type="button" class="secondary-button" data-idea-action="reload">Aktualisieren</button>
          <button type="button" class="secondary-button" data-idea-action="import-open">Liste einfügen</button>
          <button type="button" class="primary-button" data-idea-action="new">Neue Idee</button>
        </div>
      </div>
      <div id="ideaLabContent"></div>
    </div>
  `;
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
  if (subtitle) subtitle.textContent = 'Interne Mindmap für neue Funktionen, offene Grabungsideen und To-dos';
  renderIdeaLab();
}

function bindGlobalNavigationGuard() {
  document.addEventListener('click', event => {
    const button = event.target.closest?.('.nav-btn, .nav-extra-btn');
    if (!button || button.id === 'ideaLabNavButton') return;
    document.getElementById('ideaLabNavButton')?.classList.remove('active');
    document.getElementById('ideaLabTab')?.classList.remove('active');
  });
}

function renderIdeaLab() {
  const content = document.getElementById('ideaLabContent');
  if (!content) return;
  content.innerHTML = `
    ${renderStatus()}
    ${renderToolbar()}
    <div class="idea-lab-layout ${state.view === 'list' ? 'list-mode' : ''}">
      <div class="idea-lab-main-panel">
        ${state.view === 'list' ? renderListView() : renderMindmapView()}
      </div>
      <aside class="idea-lab-detail-panel">
        ${renderDetailPanel()}
      </aside>
    </div>
    ${renderImportDialog()}
  `;
}

function renderStatus() {
  if (state.loading) return '<div class="idea-lab-notice">Ideenlabor wird geladen ...</div>';
  if (!state.error) return '';
  return `
    <div class="idea-lab-notice error">
      Ideenlabor konnte nicht geladen werden: ${escapeHtml(state.error)}
      <span>Bitte nach dem Merge die Datei <code>supabase/idea_lab_module.sql</code> in Supabase ausführen.</span>
    </div>
  `;
}

function renderToolbar() {
  return `
    <div class="idea-lab-toolbar">
      <div class="segmented-control">
        <button type="button" class="${state.view === 'mindmap' ? 'active' : ''}" data-idea-action="view" data-view="mindmap">Mindmap</button>
        <button type="button" class="${state.view === 'list' ? 'active' : ''}" data-idea-action="view" data-view="list">Liste</button>
      </div>
      <label>
        Suche
        <input id="ideaLabSearch" type="search" value="${escapeAttribute(state.search)}" placeholder="Titel oder Inhalt">
      </label>
      <label>
        Bereich
        <select id="ideaLabAreaFilter">
          <option value="all">Alle Bereiche</option>
          ${AREAS.map(([value, label]) => `<option value="${value}" ${state.filterArea === value ? 'selected' : ''}>${label}</option>`).join('')}
        </select>
      </label>
      <label>
        Status
        <select id="ideaLabStatusFilter">
          <option value="active" ${state.filterStatus === 'active' ? 'selected' : ''}>Aktiv ohne Archiv</option>
          <option value="all" ${state.filterStatus === 'all' ? 'selected' : ''}>Alle</option>
          ${STATUSES.map(([value, label]) => `<option value="${value}" ${state.filterStatus === value ? 'selected' : ''}>${label}</option>`).join('')}
        </select>
      </label>
    </div>
  `;
}

function renderMindmapView() {
  const visible = getVisibleItems();
  const activeAreas = AREAS.map(([key, label]) => ({
    key,
    label,
    items: visible.filter(item => (item.area || 'general') === key)
  })).filter(area => area.items.length || state.filterArea === area.key || state.filterArea === 'all');

  if (!visible.length && !state.error) {
    return `
      <div class="idea-lab-empty">
        <strong>Noch keine Ideen angelegt.</strong>
        <span>Lege eine erste Idee an oder füge eine Liste ein. Daraus entsteht später die Mindmap.</span>
      </div>
    `;
  }

  return `
    <div class="idea-map">
      <div class="idea-map-root">
        <span>Ideenlabor</span>
        <small>${visible.length} aktive Einträge</small>
      </div>
      <div class="idea-map-branches">
        ${activeAreas.map(area => renderMindmapBranch(area)).join('')}
      </div>
    </div>
  `;
}

function renderMindmapBranch(area) {
  const items = area.items.slice(0, 8);
  return `
    <section class="idea-map-branch">
      <div class="idea-map-branch-title">${escapeHtml(area.label)}</div>
      <div class="idea-map-node-list">
        ${items.map(item => renderMindmapNode(item)).join('') || '<div class="idea-map-muted">Noch kein Eintrag</div>'}
      </div>
    </section>
  `;
}

function renderMindmapNode(item) {
  const active = Number(item.id) === Number(state.selectedId);
  return `
    <button type="button" class="idea-map-node ${active ? 'active' : ''} ${statusClass(item.status)}" data-idea-id="${item.id}">
      <span>${escapeHtml(item.title)}</span>
      <small>
        ${renderTypeLabel(item.item_type)}
        ${renderPriorityLabel(item.priority)}
      </small>
    </button>
  `;
}

function renderListView() {
  const visible = getVisibleItems();
  if (!visible.length) {
    return `
      <div class="idea-lab-empty">
        <strong>Keine passenden Einträge.</strong>
        <span>Filter anpassen oder einen neuen Eintrag anlegen.</span>
      </div>
    `;
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
  if (state.error) {
    return `
      <h4>Setup erforderlich</h4>
      <p>Das Modul ist eingebaut, die Datenbanktabelle fehlt aber noch oder ist nicht erreichbar.</p>
      <p class="idea-lab-muted">Nach dem Merge bitte <code>supabase/idea_lab_module.sql</code> in Supabase ausführen.</p>
    `;
  }
  const selected = getSelectedItem();
  if (!selected && !state.newDraft) {
    return `
      <h4>Eintrag auswählen</h4>
      <p>Wähle einen Knoten in der Mindmap oder lege eine neue Idee an.</p>
    `;
  }
  const item = state.newDraft || selected || {};
  return `
    <form id="ideaLabForm" class="idea-lab-form">
      <h4>${state.newDraft ? 'Neue Idee' : 'Eintrag bearbeiten'}</h4>
      <label>
        Titel
        <input name="title" required value="${escapeAttribute(item.title || '')}" placeholder="Kurz und eindeutig">
      </label>
      <label>
        Beschreibung / Notiz
        <textarea name="description" rows="5" placeholder="Gedanke, To-do, offene Frage oder Kontext">${escapeHtml(item.description || '')}</textarea>
      </label>
      <div class="idea-lab-field-grid">
        <label>
          Bereich
          <select name="area">
            ${AREAS.map(([value, label]) => `<option value="${value}" ${normalizeArea(item.area) === value ? 'selected' : ''}>${label}</option>`).join('')}
          </select>
        </label>
        <label>
          Typ
          <select name="item_type">
            ${TYPES.map(([value, label]) => `<option value="${value}" ${(item.item_type || 'idea') === value ? 'selected' : ''}>${label}</option>`).join('')}
          </select>
        </label>
        <label>
          Status
          <select name="status">
            ${STATUSES.map(([value, label]) => `<option value="${value}" ${(item.status || 'idea') === value ? 'selected' : ''}>${label}</option>`).join('')}
          </select>
        </label>
        <label>
          Priorität
          <select name="priority">
            ${PRIORITIES.map(([value, label]) => `<option value="${value}" ${(item.priority || 'medium') === value ? 'selected' : ''}>${label}</option>`).join('')}
          </select>
        </label>
      </div>
      <label>
        Übergeordneter Mindmap-Knoten
        <select name="parent_id">
          <option value="">Keiner</option>
          ${state.items.filter(candidate => candidate.id !== item.id).map(candidate => `
            <option value="${candidate.id}" ${Number(item.parent_id) === Number(candidate.id) ? 'selected' : ''}>${escapeHtml(candidate.title)}</option>
          `).join('')}
        </select>
      </label>
      <div class="idea-lab-form-actions">
        <button type="submit" class="primary-button">Speichern</button>
        <button type="button" class="secondary-button" data-idea-action="cancel">Abbrechen</button>
        ${selected && !state.newDraft ? '<button type="button" class="danger-button" data-idea-action="archive">Archivieren</button>' : ''}
      </div>
      ${selected && !state.newDraft ? '<button type="button" class="link-action" data-idea-action="task">Als Aufgabe vormerken</button>' : ''}
    </form>
  `;
}

function renderImportDialog() {
  return `
    <div class="idea-import-backdrop" id="ideaImportDialog" hidden>
      <div class="idea-import-dialog">
        <div class="idea-import-head">
          <h4>Liste in Mindmap einfügen</h4>
          <button type="button" data-idea-action="import-close" aria-label="Schließen">×</button>
        </div>
        <label>
          Sammelknoten
          <input id="ideaImportGroup" placeholder="z. B. Kartenviewer offene Funktionen">
        </label>
        <label>
          Bereich
          <select id="ideaImportArea">
            ${AREAS.map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}
          </select>
        </label>
        <label>
          Liste
          <textarea id="ideaImportText" rows="9" placeholder="- Punkt eins&#10;- Punkt zwei&#10;3. Punkt drei"></textarea>
        </label>
        <div class="idea-lab-form-actions">
          <button type="button" class="primary-button" data-idea-action="import-save">Einfügen</button>
          <button type="button" class="secondary-button" data-idea-action="import-close">Abbrechen</button>
        </div>
      </div>
    </div>
  `;
}

function handleIdeaLabClick(event) {
  const node = event.target.closest('[data-idea-id]');
  if (node) {
    state.selectedId = Number(node.dataset.ideaId);
    state.newDraft = null;
    renderIdeaLab();
    return;
  }
  const action = event.target.closest('[data-idea-action]')?.dataset.ideaAction;
  if (!action) return;
  if (action === 'reload') loadItems();
  if (action === 'new') startNewDraft();
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
    state.filterArea = event.target.value;
    renderIdeaLab();
  }
  if (event.target?.id === 'ideaLabStatusFilter') {
    state.filterStatus = event.target.value;
    renderIdeaLab();
  }
}

function handleIdeaLabSubmit(event) {
  if (event.target?.id !== 'ideaLabForm') return;
  event.preventDefault();
  saveItem(event.target);
}

function startNewDraft() {
  state.newDraft = {
    title: '',
    description: '',
    area: state.filterArea !== 'all' ? state.filterArea : 'website',
    item_type: 'idea',
    status: 'idea',
    priority: 'medium',
    parent_id: state.selectedId || null
  };
  renderIdeaLab();
}

function cancelEdit() {
  state.newDraft = null;
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
    const isNew = Boolean(state.newDraft || !selected);
    const query = isNew
      ? client.from('idea_lab_items').insert({ ...payload, created_by: state.session.user.id }).select('*').single()
      : client.from('idea_lab_items').update(payload).eq('id', selected.id).select('*').single();
    const { data, error } = await query;
    if (error) throw error;
    state.newDraft = null;
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
  const confirmed = window.confirm(`Eintrag "${selected.title}" ins Archiv verschieben?`);
  if (!confirmed) return;
  try {
    const { error } = await getClient()
      .from('idea_lab_items')
      .update({ status: 'archived' })
      .eq('id', selected.id);
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
  const confirmed = window.confirm('Diesen Ideenlabor-Eintrag als Aufgabe vormerken?');
  if (!confirmed) return;
  const categoryMap = {
    website: 'Steuerung',
    personal: 'Personal',
    field: 'Dokumentation',
    map: 'Dokumentation',
    weather: 'Steuerung',
    finance: 'Logistik',
    logistics: 'Logistik',
    general: 'Steuerung'
  };
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
  const lines = text.split(/\r?\n/)
    .map(line => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
    .filter(Boolean);
  if (!lines.length) {
    window.alert('Bitte mindestens einen Listenpunkt einfügen.');
    return;
  }
  try {
    let parentId = null;
    if (groupTitle) {
      const groupRes = await getClient().from('idea_lab_items').insert({
        title: groupTitle,
        description: null,
        area,
        item_type: 'note',
        status: 'idea',
        priority: 'medium',
        created_by: state.session.user.id
      }).select('id').single();
      if (groupRes.error) throw groupRes.error;
      parentId = groupRes.data.id;
    }
    const rows = lines.map((title, index) => ({
      title,
      description: null,
      area,
      item_type: 'todo',
      status: 'idea',
      priority: 'medium',
      parent_id: parentId,
      sort_order: index + 1,
      created_by: state.session.user.id
    }));
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

function getVisibleItems() {
  const search = state.search.trim().toLowerCase();
  return state.items.filter(item => {
    if (state.filterStatus === 'active' && item.status === 'archived') return false;
    if (state.filterStatus !== 'all' && state.filterStatus !== 'active' && item.status !== state.filterStatus) return false;
    if (state.filterArea !== 'all' && normalizeArea(item.area) !== state.filterArea) return false;
    if (!search) return true;
    return [item.title, item.description, areaLabel(item.area), statusLabel(item.status)]
      .filter(Boolean)
      .some(value => String(value).toLowerCase().includes(search));
  });
}

function getSelectedItem() {
  return state.items.find(item => Number(item.id) === Number(state.selectedId)) || null;
}

function normalizeArea(area) {
  const key = String(area || 'general');
  return AREAS.some(([value]) => value === key) ? key : 'general';
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

function renderTypeLabel(type) {
  return TYPES.find(([value]) => value === type)?.[1] || 'Idee';
}

function renderPriorityLabel(priority) {
  return `<span class="idea-priority priority-${priority || 'medium'}">${priorityLabel(priority)}</span>`;
}

function statusClass(status) {
  return `status-${status || 'idea'}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, '&#096;');
}

function injectStyles() {
  if (document.getElementById('ideaLabStyles')) return;
  const style = document.createElement('style');
  style.id = 'ideaLabStyles';
  style.textContent = `
    .idea-lab-nav-button{margin-top:6px}.idea-lab-tab.active{display:block}.idea-lab-page{display:flex;flex-direction:column;gap:16px}.idea-lab-header{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;padding:20px;border:1px solid #d6e2ef;border-radius:16px;background:linear-gradient(135deg,#0f2a40,#1f5572);color:#fff;box-shadow:0 18px 40px rgba(15,42,64,.14)}.idea-lab-header h3{margin:4px 0 6px;font-size:30px}.idea-lab-header p{margin:0;color:rgba(255,255,255,.86)}.idea-lab-kicker{margin:0;color:rgba(255,255,255,.68)!important;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.idea-lab-header-actions,.idea-lab-form-actions{display:flex;align-items:center;justify-content:flex-end;gap:10px;flex-wrap:wrap}.idea-lab-header .secondary-button{border-color:rgba(255,255,255,.58);background:rgba(255,255,255,.1);color:#fff}.idea-lab-toolbar{display:grid;grid-template-columns:auto minmax(220px,1fr) minmax(160px,220px) minmax(160px,220px);gap:12px;align-items:end}.idea-lab-toolbar label,.idea-lab-form label,.idea-import-dialog label{display:grid;gap:6px;color:#5a7088;font-size:13px;font-weight:700}.idea-lab-toolbar input,.idea-lab-toolbar select,.idea-lab-form input,.idea-lab-form select,.idea-lab-form textarea,.idea-import-dialog input,.idea-import-dialog select,.idea-import-dialog textarea{width:100%;border:1px solid #d2dfec;border-radius:10px;padding:10px 12px;color:#08233d;background:#fff;font:inherit}.segmented-control{display:inline-flex;gap:6px;padding:4px;border:1px solid #d6e2ef;border-radius:12px;background:#fff}.segmented-control button{border:0;border-radius:9px;padding:9px 14px;background:transparent;color:#0b2942;font-weight:800;cursor:pointer}.segmented-control button.active{background:#2b7de1;color:#fff}.idea-lab-layout{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:16px;align-items:start}.idea-lab-main-panel,.idea-lab-detail-panel{border:1px solid #d6e2ef;border-radius:16px;background:rgba(255,255,255,.94);box-shadow:0 16px 32px rgba(31,85,114,.07)}.idea-lab-main-panel{min-height:520px;padding:18px;overflow:auto}.idea-lab-detail-panel{position:sticky;top:18px;padding:18px}.idea-lab-detail-panel h4{margin:0 0 12px;font-size:18px}.idea-map{display:grid;grid-template-columns:180px minmax(0,1fr);gap:22px;align-items:start}.idea-map-root{position:sticky;top:6px;display:grid;gap:4px;padding:18px;border:2px solid #96bfe8;border-radius:18px;background:#e8f3ff;color:#08233d;font-weight:900;text-align:center}.idea-map-root small{color:#5a7088;font-weight:700}.idea-map-branches{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}.idea-map-branch{display:grid;gap:10px;padding:12px;border:1px solid #d9e7f2;border-radius:14px;background:#f7fbff}.idea-map-branch-title{color:#0b2942;font-size:13px;font-weight:900;text-transform:uppercase}.idea-map-node-list{display:grid;gap:8px}.idea-map-node,.idea-list-row{width:100%;border:1px solid #d6e2ef;border-radius:12px;background:#fff;color:#08233d;text-align:left;cursor:pointer}.idea-map-node{display:grid;gap:8px;padding:12px;border-left-width:5px}.idea-map-node span{font-weight:850}.idea-map-node small{display:flex;gap:8px;align-items:center;color:#5a7088;font-size:12px;font-weight:700}.idea-map-node.active,.idea-list-row.active{border-color:#2b7de1;box-shadow:0 0 0 3px rgba(43,125,225,.14)}.status-idea{border-left-color:#2b7de1}.status-review{border-left-color:#f4a42d}.status-important{border-left-color:#d84040}.status-later{border-left-color:#8b98aa}.status-done{border-left-color:#1e9a55}.status-archived{border-left-color:#64748b;opacity:.75}.idea-list{display:grid;gap:8px}.idea-list-row{display:grid;grid-template-columns:minmax(240px,1fr) 150px 90px 90px;gap:10px;align-items:center;padding:11px 12px}.idea-list-title{font-weight:850}.idea-chip,.idea-priority{display:inline-flex;width:fit-content;align-items:center;border-radius:999px;padding:3px 8px;background:#edf4fb;color:#0b2942;font-size:12px;font-weight:850}.idea-chip.status-important,.idea-map-node.status-important .idea-priority{background:#ffe9e6;color:#b82828}.priority-high{background:#ffe9e6;color:#b82828}.priority-medium{background:#fff3d6;color:#946200}.priority-low{background:#e7f8ee;color:#0f7a3e}.idea-lab-form{display:grid;gap:12px}.idea-lab-field-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.idea-lab-notice,.idea-lab-empty{display:grid;gap:5px;margin-bottom:12px;padding:12px 14px;border:1px solid #d6e2ef;border-radius:12px;background:#f6fbff;color:#39536c}.idea-lab-notice.error{border-color:#f0b7b7;background:#fff5f5;color:#b82828}.idea-map-muted,.idea-lab-muted{color:#6a7f95;font-size:13px}.link-action{width:fit-content;border:0;background:transparent;color:#1e67bd;font-weight:850;cursor:pointer}.danger-button{border:1px solid #d84040;border-radius:10px;padding:10px 14px;background:#fff0f0;color:#b82828;font-weight:850;cursor:pointer}.idea-import-backdrop{position:fixed;inset:0;z-index:3000;display:grid;place-items:center;padding:20px;background:rgba(8,35,61,.28)}.idea-import-backdrop[hidden]{display:none}.idea-import-dialog{display:grid;gap:13px;width:min(620px,100%);border-radius:18px;padding:20px;background:#fff;box-shadow:0 24px 80px rgba(8,35,61,.28)}.idea-import-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.idea-import-head h4{margin:0;font-size:19px}.idea-import-head button{border:0;background:transparent;color:#0b2942;font-size:26px;line-height:1;cursor:pointer}@media (max-width:1100px){.idea-lab-layout,.idea-map{grid-template-columns:1fr}.idea-lab-detail-panel,.idea-map-root{position:static}}@media (max-width:800px){.idea-lab-header,.idea-lab-toolbar{grid-template-columns:1fr;display:grid}.idea-lab-header-actions{justify-content:flex-start}.idea-list-row{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
}

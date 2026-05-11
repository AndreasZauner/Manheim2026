import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const AREA_META = {
  leitstand: { label: 'Leitstand', category: 'steuerung' },
  personal: { label: 'Personal', category: 'personal' },
  feld_doku: { label: 'Feld & Doku', category: 'dokumentation' },
  infrastruktur: { label: 'Infrastruktur', category: 'logistik' },
  finanzen: { label: 'Finanzen', category: 'logistik' },
  verwaltung: { label: 'Verwaltung', category: 'steuerung' }
};

const CATEGORY_LABELS = {
  steuerung: 'Steuerung',
  personal: 'Personal',
  dokumentation: 'Dokumentation',
  schnitte: 'Schnitte',
  logistik: 'Logistik',
  funde: 'Funde',
  sicherheit: 'Sicherheit',
  schnittstelle_amt: 'Schnittstelle Amt'
};

const FINANCE_KEYWORDS = [
  'einkauf',
  'einkaufsplan',
  'beleg',
  'buchhaltung',
  'rechnung',
  'lebensmittel',
  'sprit',
  'werkzeug',
  'haushalt',
  'ausflug'
];

const state = {
  client: null,
  session: null,
  profile: null,
  notes: [],
  tasks: [],
  archivedTasks: new Set(),
  archiveRows: [],
  taskObserver: null,
  loaded: false,
  loading: false
};

const els = {};

document.addEventListener('DOMContentLoaded', initOpenPointsModule);

function initOpenPointsModule() {
  els.navButton = document.getElementById('openPointsNavButton');
  els.tab = document.getElementById('openPointsTab');
  els.form = document.getElementById('openPointForm');
  els.search = document.getElementById('openPointSearch');
  els.areaFilter = document.getElementById('openPointAreaFilter');
  els.statusFilter = document.getElementById('openPointStatusFilter');
  els.sourceFilter = document.getElementById('openPointSourceFilter');
  els.horizonFilter = document.getElementById('openPointHorizonFilter');
  els.summary = document.getElementById('openPointSummary');
  els.list = document.getElementById('openPointList');
  els.title = document.getElementById('pageTitle');
  els.subtitle = document.getElementById('pageSubtitle');

  if (!els.navButton || !els.tab || !els.list) return;

  els.navButton.addEventListener('click', openOpenPointsTab);
  document.querySelectorAll('.nav-btn').forEach((button) => {
    button.addEventListener('click', () => els.navButton.classList.remove('active'));
  });

  [els.search, els.areaFilter, els.statusFilter, els.sourceFilter, els.horizonFilter].forEach((control) => {
    control?.addEventListener('input', renderOpenPoints);
    control?.addEventListener('change', renderOpenPoints);
  });

  els.form?.addEventListener('submit', onOpenPointSubmit);
  window.addEventListener('manheim:archive-changed', () => {
    state.loaded = false;
    if (els.tab.classList.contains('active') && !state.loading) loadOpenPoints();
  });
  window.addEventListener('manheim:open-points-changed', () => {
    state.loaded = false;
    if (els.tab.classList.contains('active') && !state.loading) loadOpenPoints();
  });
  markFinanceNotesOnSubmit();
  initAdminArchiveFeatures();
}

function openOpenPointsTab() {
  document.querySelectorAll('.tab').forEach((tab) => tab.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach((button) => button.classList.remove('active'));
  els.tab.classList.add('active');
  els.navButton.classList.add('active');
  if (els.title) els.title.textContent = 'Offene Punkte';
  if (els.subtitle) {
    els.subtitle.textContent = 'Zentrale Arbeitsliste fuer Kl\u00e4rungsbedarf, Hinweise, Notizen und Aufgaben';
  }

  if (!state.loaded && !state.loading) {
    loadOpenPoints();
  } else {
    renderOpenPoints();
  }
}

async function loadOpenPoints() {
  if (!els.list) return;
  state.loading = true;
  setSyncState('Lade offene Punkte ...');
  els.list.innerHTML = '<div class="empty">Offene Punkte werden geladen ...</div>';

  try {
    state.client = getClient();
    const sessionData = await getSession(state.client);
    state.session = sessionData?.session || null;
    if (!state.session?.user?.id) {
      els.list.innerHTML = '<div class="empty">Bitte anmelden, um offene Punkte zu sehen.</div>';
      return;
    }
    await loadProfile();

    const [notesResult, tasksResult] = await Promise.all([
      state.client.from('notes').select('*').order('created_at', { ascending: false }),
      state.client.from('tasks').select('*').order('due_date', { ascending: true, nullsFirst: false }).order('id')
    ]);

    if (notesResult.error) throw notesResult.error;
    if (tasksResult.error) throw tasksResult.error;

    state.notes = (notesResult.data || []).filter((note) => !note.is_archived);
    state.tasks = (tasksResult.data || []).filter((task) => !task.is_archived);
    state.loaded = true;
    renderOpenPoints();
    setSyncState('Synchronisiert');
  } catch (error) {
    console.error('[open-points-module]', error);
    els.list.innerHTML = `<div class="empty">Offene Punkte konnten nicht geladen werden: ${escapeHtml(error.message || error)}</div>`;
    setSyncState('Fehler');
  } finally {
    state.loading = false;
  }
}

async function onOpenPointSubmit(event) {
  event.preventDefault();
  if (!els.form) return;

  try {
    state.client = state.client || getClient();
    const sessionData = await getSession(state.client);
    state.session = sessionData?.session || null;
    if (!state.session?.user?.id) {
      alert('Bitte zuerst anmelden.');
      return;
    }

    const form = new FormData(els.form);
    const area = String(form.get('area') || 'leitstand');
    const areaMeta = AREA_META[area] || AREA_META.leitstand;
    const rawSubcategory = String(form.get('subcategory') || '').trim();
    const subcategory = area === 'finanzen'
      ? `Finanzen / ${rawSubcategory || 'Allgemein'}`
      : (rawSubcategory || areaMeta.label);

    const payload = {
      title: String(form.get('title') || '').trim(),
      body: String(form.get('body') || '').trim(),
      category: areaMeta.category,
      subcategory,
      note_type: 'note',
      status: String(form.get('status') || 'offen'),
      created_by: state.session.user.id
    };

    if (!payload.title || !payload.body) return;

    setSyncState('Speichere ...');
    const { error } = await state.client.from('notes').insert(payload);
    if (error) throw error;

    els.form.reset();
    state.loaded = false;
    await loadOpenPoints();
  } catch (error) {
    console.error('[open-points-module] save failed', error);
    alert('Punkt konnte nicht gespeichert werden: ' + (error.message || error));
    setSyncState('Fehler');
  }
}

function renderOpenPoints() {
  if (!els.list) return;
  const items = getOpenPointItems();
  const query = (els.search?.value || '').trim().toLowerCase();
  const areaFilter = els.areaFilter?.value || 'alle';
  const statusFilter = els.statusFilter?.value || 'alle';
  const sourceFilter = els.sourceFilter?.value || 'alle';
  const horizonFilter = els.horizonFilter?.value || 'alle';

  const filtered = items.filter((item) => {
    const text = `${item.title} ${item.body} ${item.subcategory} ${item.areaLabel} ${item.source} ${item.workType || ''} ${item.horizon || ''}`.toLowerCase();
    const matchesQuery = !query || text.includes(query);
    const matchesArea = areaFilter === 'alle' || item.area === areaFilter;
    const matchesStatus = statusFilter === 'alle' || item.status === statusFilter;
    const matchesSource = sourceFilter === 'alle' || item.sourceKey === sourceFilter;
    const matchesHorizon = horizonFilter === 'alle' || item.horizonKey === horizonFilter;
    return matchesQuery && matchesArea && matchesStatus && matchesSource && matchesHorizon;
  });

  if (els.summary) {
    const openCount = items.filter((item) => item.status !== 'erledigt').length;
    const financeCount = items.filter((item) => item.area === 'finanzen').length;
    const ideaLabCount = items.filter((item) => item.sourceKey === 'ideenlabor').length;
    els.summary.innerHTML = `
      <span class="pill">Gesamt: ${items.length}</span>
      <span class="pill">Offen: ${openCount}</span>
      <span class="pill">Ideenlabor: ${ideaLabCount}</span>
      <span class="pill">Finanzen: ${financeCount}</span>
      <span class="pill">Angezeigt: ${filtered.length}</span>
    `;
  }

  els.list.innerHTML = filtered.length
    ? filtered.map(openPointCard).join('')
    : '<div class="empty">Keine passenden offenen Punkte gefunden.</div>';

  document.querySelectorAll('.openpoint-archive-btn').forEach((button) => {
    button.addEventListener('click', onArchiveOpenPoint);
  });
  document.querySelectorAll('.openpoint-edit-control').forEach((control) => {
    control.addEventListener('change', onOpenPointQuickEdit);
  });
}

function getOpenPointItems() {
  const notes = state.notes.map((note) => {
    const area = areaForNote(note);
    return {
      id: `note-${note.id}`,
      table: 'notes',
      rawId: note.id,
      source: note.note_type === 'idea' ? 'Idee' : 'Notiz',
      sourceKey: note.note_type === 'idea' ? 'idee' : 'notiz',
      title: note.title || 'Ohne Titel',
      body: note.body || '',
      category: note.category,
      subcategory: cleanAreaPrefix(note.subcategory || ''),
      status: note.status || 'offen',
      area,
      areaLabel: AREA_META[area]?.label || 'Leitstand',
      priority: '',
      dueDate: '',
      assignedRole: '',
      horizonKey: '',
      createdAt: note.created_at || ''
    };
  });

  const tasks = state.tasks.map((task) => {
    const area = areaForCategory(task.category);
    const due = task.due_date ? `Fällig: ${formatDate(task.due_date)}` : '';
    const meta = parseTaskMeta(task.description);
    return {
      id: `task-${task.id}`,
      table: 'tasks',
      rawId: task.id,
      source: meta.ideaId ? 'Ideenlabor' : 'Aufgabe',
      sourceKey: meta.ideaId ? 'ideenlabor' : 'aufgabe',
      title: task.title || 'Ohne Titel',
      body: [meta.body, due, task.assigned_role].filter(Boolean).join(' - '),
      category: task.category,
      subcategory: task.subcategory || '',
      status: task.status || 'offen',
      area,
      areaLabel: AREA_META[area]?.label || 'Leitstand',
      workType: meta.workType,
      horizon: meta.horizon,
      horizonKey: horizonKey(meta.horizon),
      priority: task.priority || 'mittel',
      dueDate: task.due_date || '',
      assignedRole: task.assigned_role || '',
      createdAt: task.due_date || task.created_at || ''
    };
  });

  return [...notes, ...tasks].sort((a, b) => statusRank(a.status) - statusRank(b.status) || String(b.createdAt).localeCompare(String(a.createdAt)));
}

function openPointCard(item) {
  const categoryLabel = CATEGORY_LABELS[item.category] || item.category || item.areaLabel;
  const canArchive = isAdmin();
  const canEdit = canEditOpenPoints();
  const quickControls = canEdit ? openPointQuickControls(item) : '';
  return `
    <article class="list-item openpoint-item">
      <div class="item-head">
        <div>
          <div class="item-title">${escapeHtml(item.title)}</div>
          <div class="openpoint-meta">
            <span class="pill">${escapeHtml(item.areaLabel)}</span>
            <span class="chip">${escapeHtml(item.source)}</span>
            <span class="chip">${escapeHtml(categoryLabel)}</span>
            ${item.workType ? `<span class="chip">${escapeHtml(item.workType)}</span>` : ''}
            ${item.horizon ? `<span class="chip">${escapeHtml(item.horizon)}</span>` : ''}
            <span class="status ${escapeHtml(item.status)}">${escapeHtml(item.status)}</span>
          </div>
        </div>
        ${canArchive ? `<button class="btn small danger openpoint-archive-btn" type="button" data-table="${escapeHtml(item.table)}" data-id="${escapeHtml(item.rawId)}">Archivieren</button>` : ''}
      </div>
      ${item.subcategory ? `<div class="muted">${escapeHtml(item.subcategory)}</div>` : ''}
      ${item.body ? `<p class="openpoint-text">${escapeHtml(item.body)}</p>` : ''}
      ${quickControls}
    </article>
  `;
}

function openPointQuickControls(item) {
  const isTask = item.table === 'tasks';
  return `
    <div class="openpoint-quick-row">
      <label>Status
        <select class="openpoint-edit-control" data-table="${escapeHtml(item.table)}" data-id="${escapeHtml(item.rawId)}" data-field="status">
          ${['offen', 'laufend', 'erledigt', 'blockiert'].map((status) => `<option value="${status}" ${item.status === status ? 'selected' : ''}>${status}</option>`).join('')}
        </select>
      </label>
      ${isTask ? `
        <label>Priorität
          <select class="openpoint-edit-control" data-table="tasks" data-id="${escapeHtml(item.rawId)}" data-field="priority">
            ${['hoch', 'mittel', 'niedrig'].map((priority) => `<option value="${priority}" ${item.priority === priority ? 'selected' : ''}>${priority}</option>`).join('')}
          </select>
        </label>
        <label>Fällig
          <input class="openpoint-edit-control" data-table="tasks" data-id="${escapeHtml(item.rawId)}" data-field="due_date" type="date" value="${escapeAttribute(item.dueDate)}">
        </label>
        <label>Horizont
          <select class="openpoint-edit-control" data-table="tasks" data-id="${escapeHtml(item.rawId)}" data-field="horizon">
            ${[
              ['short', 'kurzfristig'],
              ['medium', 'mittelfristig'],
              ['long', 'langfristig']
            ].map(([key, label]) => `<option value="${key}" ${item.horizonKey === key ? 'selected' : ''}>${label}</option>`).join('')}
          </select>
        </label>
      ` : ''}
    </div>
  `;
}

async function onOpenPointQuickEdit(event) {
  if (!canEditOpenPoints()) {
    alert('Keine Berechtigung zum Bearbeiten offener Punkte.');
    renderOpenPoints();
    return;
  }
  const control = event.currentTarget;
  const table = control.dataset.table;
  const id = control.dataset.id;
  const field = control.dataset.field;
  if (!id || !['notes', 'tasks'].includes(table)) return;

  const payload = {};
  if (field === 'status') payload.status = control.value;
  if (table === 'tasks' && field === 'priority') payload.priority = control.value;
  if (table === 'tasks' && field === 'due_date') payload.due_date = control.value || null;
  if (table === 'tasks' && field === 'horizon') {
    const task = state.tasks.find((entry) => String(entry.id) === String(id));
    if (!task) return;
    payload.description = replaceTaskMetaLine(task.description, 'Zeithorizont', horizonLabel(control.value));
    payload.subcategory = replaceIdeenlaborSubcategoryHorizon(task.subcategory, horizonLabel(control.value));
  }
  if (!Object.keys(payload).length) return;

  try {
    setSyncState('Speichere ...');
    const { error } = await state.client.from(table).update(payload).eq('id', id);
    if (error) throw error;
    state.loaded = false;
    await loadOpenPoints();
    window.dispatchEvent(new CustomEvent('manheim:open-points-changed'));
    setSyncState('Synchronisiert');
  } catch (error) {
    console.error('[open-points-module] quick edit failed', error);
    alert('Änderung konnte nicht gespeichert werden: ' + (error.message || error));
    setSyncState('Fehler');
    state.loaded = false;
    await loadOpenPoints();
  }
}

async function onArchiveOpenPoint(event) {
  if (!isAdmin()) {
    alert('Nur Admins koennen offene Punkte archivieren.');
    return;
  }
  const id = event.currentTarget?.dataset?.id;
  const table = event.currentTarget?.dataset?.table;
  if (!id || !['notes', 'tasks'].includes(table)) return;
  const confirmed = window.confirm('Diesen Eintrag wirklich archivieren? Er verschwindet aus der normalen Liste und bleibt im Admin-Archiv erhalten.');
  if (!confirmed) return;

  try {
    state.client = state.client || getClient();
    setSyncState('Archiviere ...');
    const { error } = await state.client.from(table).update({
      is_archived: true,
      archived_at: new Date().toISOString(),
      archived_by: state.session?.user?.id || null
    }).eq('id', id);
    if (error) throw error;
    state.loaded = false;
    await loadOpenPoints();
    window.dispatchEvent(new CustomEvent('manheim:archive-changed'));
    if (isAdmin()) await loadArchiveData();
  } catch (error) {
    console.error('[open-points-module] archive failed', error);
    alert('Punkt konnte nicht archiviert werden: ' + (error.message || error));
    setSyncState('Fehler');
  }
}

async function initAdminArchiveFeatures() {
  try {
    state.client = state.client || getClient();
    const sessionData = await getSession(state.client);
    state.session = sessionData?.session || null;
    if (!state.session?.user?.id) return;
    await loadProfile();
    if (!isAdmin()) return;
    ensureArchivePanel();
    await loadArchiveData();
    observeTaskList();
  } catch (error) {
    console.error('[open-points-module] archive init failed', error);
  }
}

async function loadArchiveData() {
  if (!isAdmin()) return;
  const [tasksResult, notesResult] = await Promise.all([
    state.client.from('tasks').select('*').eq('is_archived', true).order('archived_at', { ascending: false, nullsFirst: false }),
    state.client.from('notes').select('*').eq('is_archived', true).order('archived_at', { ascending: false, nullsFirst: false })
  ]);
  if (tasksResult.error) throw tasksResult.error;
  if (notesResult.error) throw notesResult.error;

  const tasks = (tasksResult.data || []).map((task) => ({ ...task, archive_table: 'tasks', archive_type: 'Aufgabe' }));
  const notes = (notesResult.data || []).map((note) => ({ ...note, archive_table: 'notes', archive_type: note.note_type === 'idea' ? 'Idee' : 'Notiz' }));
  state.archiveRows = [...tasks, ...notes].sort((a, b) => String(b.archived_at || '').localeCompare(String(a.archived_at || '')));
  state.archivedTasks = new Set(tasks.map((task) => String(task.id)));
  hideArchivedTasksInList();
  renderArchivePanel();
}

function observeTaskList() {
  const taskList = document.getElementById('taskList');
  if (!taskList) return;
  state.taskObserver?.disconnect();
  state.taskObserver = new MutationObserver(() => {
    attachTaskArchiveButtons();
    hideArchivedTasksInList();
  });
  state.taskObserver.observe(taskList, { childList: true, subtree: true });
  attachTaskArchiveButtons();
  hideArchivedTasksInList();
}

function attachTaskArchiveButtons() {
  const taskList = document.getElementById('taskList');
  if (!taskList || !isAdmin()) return;
  taskList.querySelectorAll('.task-status-btn').forEach((statusButton) => {
    const taskId = statusButton.dataset.id;
    if (!taskId || state.archivedTasks.has(String(taskId))) return;
    const actionRow = statusButton.closest('.action-row');
    if (!actionRow || actionRow.querySelector(`.task-archive-btn[data-id="${taskId}"]`)) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn small danger archive-action-btn task-archive-btn';
    button.dataset.id = taskId;
    button.textContent = 'Archivieren';
    button.addEventListener('click', onArchiveTask);
    actionRow.appendChild(button);
  });
}

function hideArchivedTasksInList() {
  const taskList = document.getElementById('taskList');
  if (!taskList || !state.archivedTasks.size) return;
  taskList.querySelectorAll('.task-status-btn').forEach((statusButton) => {
    if (state.archivedTasks.has(String(statusButton.dataset.id))) {
      statusButton.closest('.list-item')?.remove();
    }
  });
}

async function onArchiveTask(event) {
  const id = event.currentTarget?.dataset?.id;
  if (!id || !isAdmin()) return;
  const confirmed = window.confirm('Diese Aufgabe wirklich archivieren? Sie verschwindet aus der Aufgabenliste und bleibt im Admin-Archiv erhalten.');
  if (!confirmed) return;
  try {
    setSyncState('Archiviere ...');
    const { error } = await state.client.from('tasks').update({
      is_archived: true,
      archived_at: new Date().toISOString(),
      archived_by: state.session.user.id
    }).eq('id', id);
    if (error) throw error;
    await loadArchiveData();
    window.dispatchEvent(new CustomEvent('manheim:archive-changed'));
    setSyncState('Synchronisiert');
  } catch (error) {
    console.error('[open-points-module] task archive failed', error);
    alert('Aufgabe konnte nicht archiviert werden: ' + (error.message || error));
    setSyncState('Fehler');
  }
}

function ensureArchivePanel() {
  const adminTab = document.getElementById('adminTab');
  if (!adminTab || document.getElementById('archivePanel')) return;
  const panel = document.createElement('section');
  panel.id = 'archivePanel';
  panel.className = 'panel archive-panel';
  panel.innerHTML = `
    <div class="panel-head">
      <h3>Archiv</h3>
      <span class="muted">nur Admin</span>
    </div>
    <div class="archive-toolbar">
      <select id="archiveTypeFilter">
        <option value="alle">Alle Eintr&auml;ge</option>
        <option value="tasks">Aufgaben</option>
        <option value="notes">Notizen / offene Punkte</option>
      </select>
      <input id="archiveSearch" type="search" placeholder="Archiv durchsuchen" />
    </div>
    <div id="archiveList" class="archive-list"></div>
  `;
  adminTab.appendChild(panel);
  document.getElementById('archiveTypeFilter')?.addEventListener('change', renderArchivePanel);
  document.getElementById('archiveSearch')?.addEventListener('input', renderArchivePanel);
}

function renderArchivePanel() {
  const list = document.getElementById('archiveList');
  if (!list) return;
  const typeFilter = document.getElementById('archiveTypeFilter')?.value || 'alle';
  const query = (document.getElementById('archiveSearch')?.value || '').trim().toLowerCase();
  const filtered = state.archiveRows.filter((row) => {
    const typeMatches = typeFilter === 'alle' || row.archive_table === typeFilter;
    const text = `${row.title || ''} ${row.description || ''} ${row.body || ''} ${row.subcategory || ''}`.toLowerCase();
    return typeMatches && (!query || text.includes(query));
  });

  list.innerHTML = filtered.length
    ? filtered.map(archiveCard).join('')
    : '<div class="empty">Keine archivierten Eintr&auml;ge vorhanden.</div>';
  list.querySelectorAll('.archive-restore-btn').forEach((button) => button.addEventListener('click', onRestoreArchived));
}

function archiveCard(row) {
  const text = row.description || row.body || '';
  return `
    <article class="list-item archive-item">
      <div class="item-head">
        <div>
          <div class="item-title">${escapeHtml(row.title || 'Ohne Titel')}</div>
          <div class="openpoint-meta">
            <span class="chip">${escapeHtml(row.archive_type)}</span>
            <span class="status ${escapeHtml(row.status || 'offen')}">${escapeHtml(row.status || 'offen')}</span>
            <span class="muted">${row.archived_at ? `archiviert: ${formatDateTime(row.archived_at)}` : 'archiviert'}</span>
          </div>
        </div>
        <button class="btn small archive-restore-btn" type="button" data-table="${escapeHtml(row.archive_table)}" data-id="${escapeHtml(row.id)}">Wiederherstellen</button>
      </div>
      ${row.subcategory ? `<div class="muted">${escapeHtml(row.subcategory)}</div>` : ''}
      ${text ? `<p class="openpoint-text">${escapeHtml(text)}</p>` : ''}
    </article>
  `;
}

async function onRestoreArchived(event) {
  const table = event.currentTarget?.dataset?.table;
  const id = event.currentTarget?.dataset?.id;
  if (!isAdmin() || !id || !['notes', 'tasks'].includes(table)) return;
  try {
    setSyncState('Stelle wieder her ...');
    const { error } = await state.client.from(table).update({
      is_archived: false,
      archived_at: null,
      archived_by: null,
      archive_reason: null
    }).eq('id', id);
    if (error) throw error;
    await loadArchiveData();
    state.loaded = false;
    window.dispatchEvent(new CustomEvent('manheim:archive-changed'));
    setSyncState('Synchronisiert');
  } catch (error) {
    console.error('[open-points-module] restore failed', error);
    alert('Eintrag konnte nicht wiederhergestellt werden: ' + (error.message || error));
    setSyncState('Fehler');
  }
}

function areaForNote(note) {
  const combined = `${note.subcategory || ''} ${note.title || ''} ${note.body || ''}`.toLowerCase();
  if (/^finanzen\s*\//i.test(note.subcategory || '') || FINANCE_KEYWORDS.some((keyword) => combined.includes(keyword))) {
    return 'finanzen';
  }
  return areaForCategory(note.category);
}

function areaForCategory(category) {
  if (category === 'personal') return 'personal';
  if (category === 'dokumentation' || category === 'schnitte' || category === 'funde' || category === 'sicherheit') return 'feld_doku';
  if (category === 'logistik') return 'infrastruktur';
  return 'leitstand';
}

function cleanAreaPrefix(value) {
  return String(value || '').replace(/^Finanzen\s*\/\s*/i, '').trim();
}

function parseTaskMeta(description) {
  const lines = String(description || '').split(/\r?\n/);
  const meta = { body: '', ideaId: null, workType: '', horizon: '' };
  const bodyLines = [];
  lines.forEach((line) => {
    const ideaMatch = line.match(/^Ideenlabor-ID:\s*(\d+)/i);
    const typeMatch = line.match(/^Typ:\s*(.+)$/i);
    const horizonMatch = line.match(/^Zeithorizont:\s*(.+)$/i);
    if (ideaMatch) {
      meta.ideaId = Number(ideaMatch[1]);
      return;
    }
    if (/^Quelle:\s*Ideenlabor/i.test(line)) return;
    if (typeMatch) {
      meta.workType = typeMatch[1].trim();
      return;
    }
    if (horizonMatch) {
      meta.horizon = horizonMatch[1].trim();
      return;
    }
    bodyLines.push(line);
  });
  meta.body = bodyLines.join('\n').trim();
  return meta;
}

function horizonKey(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized.includes('kurz') || normalized === 'short') return 'short';
  if (normalized.includes('lang') || normalized === 'long') return 'long';
  if (normalized.includes('mittel') || normalized === 'medium') return 'medium';
  return '';
}

function horizonLabel(value) {
  const labels = { short: 'kurzfristig', medium: 'mittelfristig', long: 'langfristig' };
  return labels[value] || labels[horizonKey(value)] || 'mittelfristig';
}

function replaceTaskMetaLine(description, label, value) {
  const lines = String(description || '').split(/\r?\n/);
  let replaced = false;
  const nextLines = lines.map((line) => {
    if (line.match(new RegExp(`^${label}:`, 'i'))) {
      replaced = true;
      return `${label}: ${value}`;
    }
    return line;
  });
  if (!replaced) nextLines.push(`${label}: ${value}`);
  return nextLines.join('\n').trim();
}

function replaceIdeenlaborSubcategoryHorizon(subcategory, horizon) {
  const parts = String(subcategory || '').split('/').map((part) => part.trim()).filter(Boolean);
  if (parts[0]?.toLowerCase() === 'ideenlabor' && parts.length >= 3) {
    parts[2] = horizon;
    return parts.join(' / ');
  }
  return subcategory || `Ideenlabor / Aufgabe / ${horizon}`;
}

function statusRank(status) {
  const rank = { blockiert: 0, offen: 1, aktiv: 2, laufend: 2, erledigt: 9 };
  return rank[status] ?? 5;
}

function markFinanceNotesOnSubmit() {
  const ideaForm = document.getElementById('ideaForm');
  if (!ideaForm) return;
  ideaForm.addEventListener('submit', () => {
    const subcategory = ideaForm.querySelector('[name="subcategory"]');
    if (!subcategory) return;
    const value = subcategory.value.trim();
    if (!/^Finanzen\s*\//i.test(value)) {
      subcategory.value = `Finanzen / ${value || 'Einkaufsplan'}`;
    }
  }, true);
}

function getClient() {
  if (window.getManheimSupabaseClient) {
    return window.getManheimSupabaseClient(createClient);
  }
  return createClient(window.APP_CONFIG.SUPABASE_URL, window.APP_CONFIG.SUPABASE_ANON_KEY);
}

async function getSession(client) {
  if (window.getManheimAuthSession) {
    const { data, error } = await window.getManheimAuthSession(client);
    if (error) throw error;
    return data;
  }
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  return data;
}

async function loadProfile() {
  if (!state.session?.user?.id) return;
  const { data, error } = await state.client
    .from('profiles')
    .select('id, role, is_active')
    .eq('id', state.session.user.id)
    .single();
  if (error) throw error;
  state.profile = data || null;
}

function isAdmin() {
  return state.profile?.role === 'admin';
}

function canEditOpenPoints() {
  return ['admin', 'technical_lead', 'assistant', 'professor'].includes(state.profile?.role);
}

function setSyncState(label) {
  const syncState = document.getElementById('syncState');
  if (syncState) syncState.textContent = label;
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('de-DE');
}

function formatDateTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('de-DE');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeAttribute(value) {
  return escapeHtml(value);
}



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
  els.summary = document.getElementById('openPointSummary');
  els.list = document.getElementById('openPointList');
  els.title = document.getElementById('pageTitle');
  els.subtitle = document.getElementById('pageSubtitle');

  if (!els.navButton || !els.tab || !els.list) return;

  els.navButton.addEventListener('click', openOpenPointsTab);
  document.querySelectorAll('.nav-btn').forEach((button) => {
    button.addEventListener('click', () => els.navButton.classList.remove('active'));
  });

  [els.search, els.areaFilter, els.statusFilter].forEach((control) => {
    control?.addEventListener('input', renderOpenPoints);
    control?.addEventListener('change', renderOpenPoints);
  });

  els.form?.addEventListener('submit', onOpenPointSubmit);
  markFinanceNotesOnSubmit();
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

    state.notes = notesResult.data || [];
    state.tasks = tasksResult.data || [];
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

  const filtered = items.filter((item) => {
    const text = `${item.title} ${item.body} ${item.subcategory} ${item.areaLabel}`.toLowerCase();
    const matchesQuery = !query || text.includes(query);
    const matchesArea = areaFilter === 'alle' || item.area === areaFilter;
    const matchesStatus = statusFilter === 'alle' || item.status === statusFilter;
    return matchesQuery && matchesArea && matchesStatus;
  });

  if (els.summary) {
    const openCount = items.filter((item) => item.status !== 'erledigt').length;
    const financeCount = items.filter((item) => item.area === 'finanzen').length;
    els.summary.innerHTML = `
      <span class="pill">Gesamt: ${items.length}</span>
      <span class="pill">Offen: ${openCount}</span>
      <span class="pill">Finanzen: ${financeCount}</span>
      <span class="pill">Angezeigt: ${filtered.length}</span>
    `;
  }

  els.list.innerHTML = filtered.length
    ? filtered.map(openPointCard).join('')
    : '<div class="empty">Keine passenden offenen Punkte gefunden.</div>';

  document.querySelectorAll('.openpoint-delete-btn').forEach((button) => {
    button.addEventListener('click', onDeleteOpenPoint);
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
      title: note.title || 'Ohne Titel',
      body: note.body || '',
      category: note.category,
      subcategory: cleanAreaPrefix(note.subcategory || ''),
      status: note.status || 'offen',
      area,
      areaLabel: AREA_META[area]?.label || 'Leitstand',
      createdAt: note.created_at || ''
    };
  });

  const tasks = state.tasks.map((task) => {
    const area = areaForCategory(task.category);
    const due = task.due_date ? `Faellig: ${formatDate(task.due_date)}` : '';
    return {
      id: `task-${task.id}`,
      table: 'tasks',
      rawId: task.id,
      source: 'Aufgabe',
      title: task.title || 'Ohne Titel',
      body: [task.description, due, task.assigned_role].filter(Boolean).join(' - '),
      category: task.category,
      subcategory: task.subcategory || '',
      status: task.status || 'offen',
      area,
      areaLabel: AREA_META[area]?.label || 'Leitstand',
      createdAt: task.due_date || task.created_at || ''
    };
  });

  return [...notes, ...tasks].sort((a, b) => statusRank(a.status) - statusRank(b.status) || String(b.createdAt).localeCompare(String(a.createdAt)));
}

function openPointCard(item) {
  const categoryLabel = CATEGORY_LABELS[item.category] || item.category || item.areaLabel;
  const canDelete = isAdmin() && item.table === 'notes';
  return `
    <article class="list-item openpoint-item">
      <div class="item-head">
        <div>
          <div class="item-title">${escapeHtml(item.title)}</div>
          <div class="openpoint-meta">
            <span class="pill">${escapeHtml(item.areaLabel)}</span>
            <span class="chip">${escapeHtml(item.source)}</span>
            <span class="chip">${escapeHtml(categoryLabel)}</span>
            <span class="status ${escapeHtml(item.status)}">${escapeHtml(item.status)}</span>
          </div>
        </div>
        ${canDelete ? `<button class="btn small danger openpoint-delete-btn" type="button" data-id="${escapeHtml(item.rawId)}">L&ouml;schen</button>` : ''}
      </div>
      ${item.subcategory ? `<div class="muted">${escapeHtml(item.subcategory)}</div>` : ''}
      ${item.body ? `<p class="openpoint-text">${escapeHtml(item.body)}</p>` : ''}
    </article>
  `;
}

async function onDeleteOpenPoint(event) {
  if (!isAdmin()) {
    alert('Nur Admins koennen offene Punkte loeschen.');
    return;
  }
  const id = event.currentTarget?.dataset?.id;
  if (!id) return;
  const confirmed = window.confirm('Diesen offenen Punkt wirklich loeschen?');
  if (!confirmed) return;

  try {
    state.client = state.client || getClient();
    setSyncState('Loesche ...');
    const { error } = await state.client.from('notes').delete().eq('id', id);
    if (error) throw error;
    state.loaded = false;
    await loadOpenPoints();
  } catch (error) {
    console.error('[open-points-module] delete failed', error);
    alert('Punkt konnte nicht geloescht werden: ' + (error.message || error));
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

function setSyncState(label) {
  const syncState = document.getElementById('syncState');
  if (syncState) syncState.textContent = label;
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('de-DE');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

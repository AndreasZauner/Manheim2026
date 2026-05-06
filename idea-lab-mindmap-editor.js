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
const STATUS_LABELS = { idea: 'Idee', review: 'prüfen', important: 'wichtig', later: 'später', done: 'umgesetzt', archived: 'Archiv' };
const PRIORITY_LABELS = { high: 'hoch', medium: 'mittel', low: 'niedrig' };

const state = {
  client: null,
  session: null,
  allowed: false,
  checkedAuth: false,
  items: [],
  links: [],
  linksAvailable: true,
  selectedId: null,
  mind: null,
  saveTimer: null,
  suppressEvents: false,
  signature: ''
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', installMindmapEditor);
} else {
  installMindmapEditor();
}

function installMindmapEditor() {
  if (window.__ideaLabMindmapEditorInstalled) return;
  window.__ideaLabMindmapEditorInstalled = true;
  injectExternalStyles();
  injectStyles();
  bindAuth();
  observeIdeaLab();
  document.addEventListener('click', event => {
    const action = event.target.closest?.('[data-mind-action]')?.dataset.mindAction;
    if (!action) {
      window.setTimeout(tryMount, 80);
      return;
    }
    if (action === 'reload') reloadAndMount(true);
    if (action === 'fit') fitMap();
    if (action === 'child') addChild();
    if (action === 'sibling') addSibling();
    if (action === 'save') persistNow();
  });
  document.addEventListener('submit', event => {
    if (event.target?.id === 'ideaMindDetailForm') {
      event.preventDefault();
      saveDetail(event.target);
    }
  });
  window.setTimeout(tryMount, 800);
}

function client() {
  if (state.client) return state.client;
  const config = window.APP_CONFIG || {};
  if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) return null;
  state.client = window.getManheimSupabaseClient?.(createClient) || createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  return state.client;
}

function getAuthSession(instance) {
  return window.getManheimAuthSession?.(instance) || instance.auth.getSession();
}

function bindAuth() {
  const instance = client();
  if (!instance) return;
  instance.auth.onAuthStateChange(() => {
    state.checkedAuth = false;
    window.setTimeout(tryMount, 100);
  });
}

function observeIdeaLab() {
  new MutationObserver(() => window.setTimeout(tryMount, 80))
    .observe(document.body, { childList: true, subtree: true });
}

async function ensureAllowed() {
  if (state.checkedAuth) return state.allowed;
  const instance = client();
  if (!instance) return false;
  const { data } = await getAuthSession(instance);
  state.session = data?.session || null;
  const userId = state.session?.user?.id;
  if (!userId) {
    state.allowed = false;
    state.checkedAuth = true;
    return false;
  }
  const profile = await instance.from('profiles').select('email').eq('id', userId).maybeSingle();
  const email = String(profile.data?.email || state.session.user.email || '').trim().toLowerCase();
  state.allowed = MEMBERS.includes(email);
  state.checkedAuth = true;
  return state.allowed;
}

async function tryMount() {
  const tab = document.getElementById('ideaLabTab');
  const panel = tab?.querySelector('.idea-lab-main-panel');
  const mindTabActive = tab?.classList.contains('active') && tab.querySelector('[data-view="mindmap"].active');
  if (!tab || !panel || !mindTabActive) return;
  if (!(await ensureAllowed())) return;
  if (panel.dataset.realMindmap === '1') return;
  await reloadAndMount(false);
}

async function reloadAndMount(force = false) {
  const tab = document.getElementById('ideaLabTab');
  const panel = tab?.querySelector('.idea-lab-main-panel');
  if (!panel || !(await ensureAllowed())) return;
  if (!force && panel.dataset.realMindmap === '1') return;
  await loadData();
  panel.dataset.realMindmap = '1';
  panel.innerHTML = renderShell();
  mountMindElixir();
}

async function loadData() {
  const instance = client();
  const [itemsRes, linksRes] = await Promise.all([
    instance.from('idea_lab_items').select('*').order('sort_order', { ascending: true, nullsFirst: false }).order('updated_at', { ascending: false }),
    instance.from('idea_lab_links').select('*').order('created_at', { ascending: true })
  ]);
  if (itemsRes.error) throw itemsRes.error;
  state.items = itemsRes.data || [];
  if (linksRes.error) {
    state.links = [];
    state.linksAvailable = false;
    console.warn('Ideenlabor-Links nicht verfügbar', linksRes.error);
  } else {
    state.links = linksRes.data || [];
    state.linksAvailable = true;
  }
}

function renderShell() {
  return `
    <div class="real-mindmap-shell">
      <div class="real-mindmap-toolbar">
        <div>
          <strong>Grafische Mindmap</strong>
          <span>Knoten ziehen, Unterpunkte anhängen und per Rechtsklick Querverbindungen setzen.</span>
        </div>
        <div class="real-mindmap-actions">
          <button type="button" class="secondary-button" data-mind-action="fit">Zentrieren</button>
          <button type="button" class="secondary-button" data-mind-action="child">Unterpunkt</button>
          <button type="button" class="secondary-button" data-mind-action="sibling">Nachbaridee</button>
          <button type="button" class="primary-button" data-mind-action="save">Speichern</button>
          <button type="button" class="secondary-button" data-mind-action="reload">Neu laden</button>
        </div>
      </div>
      ${state.linksAvailable ? '' : '<div class="idea-lab-notice">Querverbindungen werden angezeigt, sobald <code>supabase/idea_lab_mindmap_links.sql</code> ausgeführt ist.</div>'}
      <div id="realMindmapCanvas" class="real-mindmap-canvas"></div>
      <p class="real-mindmap-hint">Änderungen werden automatisch gesichert. Löschen/Archivieren bleibt bewusst im Detailpanel, damit keine Ideen versehentlich verschwinden.</p>
    </div>
  `;
}

function mountMindElixir() {
  const canvas = document.getElementById('realMindmapCanvas');
  if (!canvas) return;
  const data = buildMindData();
  state.signature = JSON.stringify(data);
  canvas.innerHTML = '';
  state.suppressEvents = true;
  const mind = new MindElixir({
    el: canvas,
    direction: 2,
    draggable: true,
    contextMenu: true,
    toolBar: false,
    nodeMenu: true,
    keypress: true,
    allowUndo: true
  });
  mind.init(data);
  state.mind = mind;
  mind.bus.addListener('operation', () => {
    if (!state.suppressEvents) schedulePersist();
  });
  mind.bus.addListener('selectNode', node => {
    const id = parseIdeaId(node?.id || node?.nodeObj?.id || node?.dataset?.nodeid);
    if (id) selectItem(id);
  });
  window.setTimeout(() => {
    state.suppressEvents = false;
    fitMap();
  }, 160);
}

function buildMindData() {
  const visible = visibleItems();
  const byId = new Map(visible.map(item => [Number(item.id), item]));
  const children = new Map();
  visible.forEach((item, index) => {
    const parentId = Number(item.parent_id);
    const parentKey = parentId && byId.has(parentId) ? `idea-${parentId}` : `area-${areaKey(item.area)}`;
    if (!children.has(parentKey)) children.set(parentKey, []);
    children.get(parentKey).push({ item, index });
  });
  const areaNodes = AREAS
    .filter(([key]) => currentFilters().area === 'all' || currentFilters().area === key || children.has(`area-${key}`))
    .map(([key, label], index) => ({
      id: `area-${key}`,
      topic: label,
      direction: index % 2,
      expanded: true,
      children: childNodes(`area-${key}`, children)
    }))
    .filter(node => node.children.length || currentFilters().area === node.id.replace('area-', ''));
  return {
    nodeData: {
      id: 'idea-root',
      topic: 'Ideenlabor',
      root: true,
      children: areaNodes.length ? areaNodes : [{ id: 'area-general', topic: 'Sonstiges', children: [] }]
    },
    arrows: visibleLinks(visible).map(link => ({
      id: `link-${link.id}`,
      from: `idea-${link.source_item_id}`,
      to: `idea-${link.target_item_id}`,
      label: link.label || '',
      delta1: link.delta1 || { x: -80, y: 0 },
      delta2: link.delta2 || { x: 80, y: 0 }
    })),
    direction: 2
  };
}

function childNodes(parentKey, children) {
  return (children.get(parentKey) || [])
    .sort((a, b) => (Number(a.item.sort_order ?? a.index) - Number(b.item.sort_order ?? b.index)) || String(a.item.title).localeCompare(String(b.item.title), 'de'))
    .map(({ item }) => ({
      id: `idea-${item.id}`,
      topic: item.title,
      expanded: true,
      tags: [STATUS_LABELS[item.status] || 'Idee', PRIORITY_LABELS[item.priority] || 'mittel'],
      children: childNodes(`idea-${item.id}`, children)
    }));
}

function currentFilters() {
  return {
    search: String(document.getElementById('ideaLabSearch')?.value || '').trim().toLowerCase(),
    area: document.getElementById('ideaLabAreaFilter')?.value || 'all',
    status: document.getElementById('ideaLabStatusFilter')?.value || 'active'
  };
}

function visibleItems() {
  const filters = currentFilters();
  return state.items.filter(item => {
    if (filters.status === 'active' && item.status === 'archived') return false;
    if (filters.status !== 'all' && filters.status !== 'active' && item.status !== filters.status) return false;
    if (filters.area !== 'all' && areaKey(item.area) !== filters.area) return false;
    if (!filters.search) return true;
    return [item.title, item.description, areaLabel(item.area)].filter(Boolean).some(value => String(value).toLowerCase().includes(filters.search));
  });
}

function visibleLinks(items) {
  const ids = new Set(items.map(item => Number(item.id)));
  return state.links.filter(link => ids.has(Number(link.source_item_id)) && ids.has(Number(link.target_item_id)));
}

function selectItem(id) {
  state.selectedId = id;
  const item = state.items.find(entry => Number(entry.id) === Number(id));
  const panel = document.querySelector('#ideaLabTab .idea-lab-detail-panel');
  if (!panel || !item) return;
  panel.innerHTML = `
    <form id="ideaMindDetailForm" class="idea-lab-form">
      <h4>Mindmap-Knoten bearbeiten</h4>
      <input type="hidden" name="id" value="${item.id}">
      <label>Titel<input name="title" required value="${escapeAttr(item.title)}"></label>
      <label>Beschreibung<textarea name="description" rows="5">${escapeHtml(item.description || '')}</textarea></label>
      <div class="idea-lab-field-grid">
        <label>Bereich<select name="area">${AREAS.map(([key, label]) => `<option value="${key}" ${areaKey(item.area) === key ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
        <label>Status<select name="status">${Object.entries(STATUS_LABELS).map(([key, label]) => `<option value="${key}" ${item.status === key ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
        <label>Priorität<select name="priority">${Object.entries(PRIORITY_LABELS).map(([key, label]) => `<option value="${key}" ${item.priority === key ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
      </div>
      <div class="idea-lab-form-actions">
        <button type="submit" class="primary-button">Speichern</button>
      </div>
    </form>
  `;
}

async function saveDetail(form) {
  const data = new FormData(form);
  const id = Number(data.get('id'));
  const payload = {
    title: String(data.get('title') || '').trim(),
    description: String(data.get('description') || '').trim() || null,
    area: areaKey(data.get('area')),
    status: String(data.get('status') || 'idea'),
    priority: String(data.get('priority') || 'medium')
  };
  if (!payload.title) return;
  const res = await client().from('idea_lab_items').update(payload).eq('id', id).select('*').single();
  if (res.error) {
    window.alert(`Speichern fehlgeschlagen: ${res.error.message}`);
    return;
  }
  state.items = state.items.map(item => Number(item.id) === id ? res.data : item);
  await reloadAndMount(true);
  selectItem(id);
}

function schedulePersist() {
  window.clearTimeout(state.saveTimer);
  state.saveTimer = window.setTimeout(persistNow, 800);
}

async function persistNow() {
  if (!state.mind || !state.allowed || state.suppressEvents) return;
  const data = state.mind.getData();
  const nodes = flatten(data.nodeData);
  const tempMap = new Map();
  const updated = new Map(state.items.map(item => [Number(item.id), { ...item }]));
  let inserted = false;
  for (const entry of nodes) {
    const existingId = parseIdeaId(entry.id);
    const parentId = parseIdeaId(entry.parentId) || tempMap.get(entry.parentId) || null;
    const payload = { title: entry.topic, area: entry.area, parent_id: parentId, sort_order: entry.index };
    if (existingId) {
      const current = updated.get(existingId);
      if (!current) continue;
      if (current.title !== payload.title || areaKey(current.area) !== payload.area || Number(current.parent_id || 0) !== Number(parentId || 0) || Number(current.sort_order ?? -1) !== entry.index) {
        const res = await client().from('idea_lab_items').update(payload).eq('id', existingId);
        if (res.error) throw res.error;
        updated.set(existingId, { ...current, ...payload });
      }
      tempMap.set(entry.id, existingId);
    } else {
      const res = await client().from('idea_lab_items').insert({
        ...payload,
        item_type: 'todo',
        status: 'idea',
        priority: 'medium',
        created_by: state.session.user.id
      }).select('*').single();
      if (res.error) throw res.error;
      inserted = true;
      tempMap.set(entry.id, Number(res.data.id));
      updated.set(Number(res.data.id), res.data);
    }
  }
  await persistLinks(data.arrows || [], tempMap);
  state.items = Array.from(updated.values());
  if (inserted) await reloadAndMount(true);
}

function flatten(root) {
  const out = [];
  const walk = (node, area, parentId, index) => {
    const id = String(node.id || '');
    if (id === 'idea-root') {
      (node.children || []).forEach((child, childIndex) => walk(child, area, null, childIndex));
      return;
    }
    if (id.startsWith('area-')) {
      (node.children || []).forEach((child, childIndex) => walk(child, areaKey(id.slice(5)), null, childIndex));
      return;
    }
    out.push({ id, topic: String(node.topic || 'Neue Idee').trim() || 'Neue Idee', area, parentId, index });
    (node.children || []).forEach((child, childIndex) => walk(child, area, id, childIndex));
  };
  walk(root, 'general', null, 0);
  return out;
}

async function persistLinks(arrows, tempMap) {
  if (!state.linksAvailable) return;
  const filters = currentFilters();
  if (filters.search || filters.area !== 'all' || filters.status !== 'active') return;
  const rows = arrows.map(arrow => {
    const source = parseIdeaId(arrow.from) || tempMap.get(arrow.from);
    const target = parseIdeaId(arrow.to) || tempMap.get(arrow.to);
    if (!source || !target || source === target) return null;
    return { source_item_id: source, target_item_id: target, label: arrow.label || null, delta1: arrow.delta1 || null, delta2: arrow.delta2 || null, created_by: state.session.user.id };
  }).filter(Boolean);
  const del = await client().from('idea_lab_links').delete().gte('id', 0);
  if (del.error) throw del.error;
  if (!rows.length) {
    state.links = [];
    return;
  }
  const ins = await client().from('idea_lab_links').insert(rows).select('*');
  if (ins.error) throw ins.error;
  state.links = ins.data || [];
}

function addChild() {
  const el = selectedElement();
  if (!el) return window.alert('Bitte zuerst einen Knoten auswählen.');
  state.mind.addChild(el);
}

function addSibling() {
  const el = selectedElement();
  if (!el) return window.alert('Bitte zuerst einen Knoten auswählen.');
  state.mind.insertSibling('after', el);
}

function selectedElement() {
  return state.selectedId && typeof MindElixir.E === 'function' ? MindElixir.E(`idea-${state.selectedId}`) : null;
}

function fitMap() {
  state.mind?.scaleFit?.();
  state.mind?.toCenter?.();
}

function parseIdeaId(id) {
  const match = String(id || '').match(/^idea-(\d+)$/);
  return match ? Number(match[1]) : null;
}

function areaKey(value) {
  const key = String(value || 'general');
  return AREAS.some(([area]) => area === key) ? key : 'general';
}

function areaLabel(value) {
  return AREAS.find(([area]) => area === areaKey(value))?.[1] || 'Sonstiges';
}

function injectExternalStyles() {
  if (document.getElementById('mindElixirStylesheet')) return;
  const link = document.createElement('link');
  link.id = 'mindElixirStylesheet';
  link.rel = 'stylesheet';
  link.href = 'https://cdn.jsdelivr.net/npm/mind-elixir@5.10.0/dist/style.css';
  document.head.appendChild(link);
}

function injectStyles() {
  if (document.getElementById('realMindmapStyles')) return;
  const style = document.createElement('style');
  style.id = 'realMindmapStyles';
  style.textContent = `
    .real-mindmap-shell{display:grid;gap:12px;min-height:640px}
    .real-mindmap-toolbar{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding:12px;border:1px solid #d6e2ef;border-radius:14px;background:#f7fbff}
    .real-mindmap-toolbar strong,.real-mindmap-toolbar span{display:block}
    .real-mindmap-toolbar strong{color:#08233d;font-size:15px}
    .real-mindmap-toolbar span,.real-mindmap-hint{color:#5a7088;font-size:13px;line-height:1.35}
    .real-mindmap-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
    .real-mindmap-canvas{min-height:560px;height:min(68vh,720px);width:100%;overflow:hidden;border:1px solid #d6e2ef;border-radius:16px;background:#fff}
    .real-mindmap-canvas .map-container{background:#fff}
    .real-mindmap-canvas .topic{border-radius:10px;font-family:inherit;font-weight:800}
    @media (max-width:800px){.real-mindmap-toolbar{display:grid}.real-mindmap-actions{justify-content:flex-start}.real-mindmap-canvas{height:70vh}}
  `;
  document.head.appendChild(style);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, '&#096;');
}

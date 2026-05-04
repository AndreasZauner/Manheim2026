const ROLE_OPTIONS = ['Technische Grabungsleitung', 'Assistenz technische Grabungsleitung', 'Teilnehmende'];
const PROJECT_START = new Date('2026-07-27T00:00:00');
const PROJECT_END = new Date('2026-10-09T00:00:00');
const STATUS_ORDER = { gesetzt: 0, zugesagt: 1, 'zu_kl\u00e4ren': 2, anzufragen: 3 };
let activeRoleId = null;
let debounceTimer = null;

function roleRank(role) {
  const text = String(role || '').toLowerCase();
  if (/assistenz|assist/.test(text)) return 1;
  if (/technische grabungsleitung|technische leitung|technical[_ ]?lead|grabungsleit/.test(text)) return 0;
  return 2;
}

function parseDate(value) {
  if (!value) return null;
  const iso = String(value).slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return new Date(`${iso}T00:00:00`);
  const german = String(value).match(/(\d{2})\.(\d{2})\.(\d{4})/);
  return german ? new Date(`${german[3]}-${german[2]}-${german[1]}T00:00:00`) : null;
}

function formatDate(value) {
  const date = parseDate(value);
  return date ? date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'offen';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function rowRole(row) {
  return row.querySelector('.personnel-role')?.textContent?.trim() || 'Teilnehmende';
}

function rowStart(row) {
  const text = row.querySelector('.personnel-badge.outline')?.textContent || '';
  return parseDate(text) || new Date('9999-12-31T00:00:00');
}

function sortPersonnelRows() {
  const select = document.getElementById('personnelSortBy');
  const host = document.querySelector('#personnelDeploymentView .personnel-rows');
  if (!host || select?.value !== 'role') return;
  [...host.querySelectorAll('.personnel-row')]
    .sort((a, b) => roleRank(rowRole(a)) - roleRank(rowRole(b)) || rowStart(a) - rowStart(b) || a.textContent.localeCompare(b.textContent, 'de'))
    .forEach(row => host.appendChild(row));
}

function patchRoleChoices() {
  const box = document.getElementById('personnelRoleOptions');
  if (!box || box.dataset.roleOrderPatched === 'true') return;
  const current = box.querySelector('.personnel-role-choice.active')?.textContent?.trim();
  box.dataset.roleOrderPatched = 'true';
  box.innerHTML = ROLE_OPTIONS.map(role => `
    <button class="personnel-role-choice ${role === current ? 'active' : ''}" type="button" data-role="${escapeHtml(role)}">
      ${escapeHtml(role)}
    </button>
  `).join('');
}

function scheduleApply() {
  window.setTimeout(sortPersonnelRows, 0);
  window.setTimeout(sortPersonnelRows, 80);
  window.setTimeout(sortPersonnelRows, 250);
  window.setTimeout(patchRoleChoices, 0);
  window.setTimeout(patchRoleChoices, 80);
}

async function getClient() {
  const config = window.APP_CONFIG || {};
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm');
  return window.getManheimSupabaseClient?.(createClient) || createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
}

async function saveRole(role) {
  if (!activeRoleId || !role) return;
  const client = await getClient();
  const { error } = await client.from('participants').update({ public_role: role }).eq('id', activeRoleId);
  if (error) {
    const node = document.getElementById('personnelRoleError');
    if (node) node.textContent = `Speichern fehlgeschlagen: ${error.message || error}`;
    return;
  }
  const button = document.querySelector(`.personnel-role-edit-btn[data-id="${activeRoleId}"]`);
  if (button) button.textContent = role;
  document.getElementById('personnelRoleBackdrop')?.classList.remove('open');
  const drawer = document.getElementById('personnelRoleDrawer');
  drawer?.classList.remove('open');
  drawer?.setAttribute('aria-hidden', 'true');
  sortPersonnelRows();
}

function range(person) {
  const start = parseDate(person.availability_from);
  const end = parseDate(person.availability_to);
  const total = PROJECT_END - PROJECT_START;
  if (!start || !end || end < start) return null;
  const clippedStart = new Date(Math.max(start, PROJECT_START));
  const clippedEnd = new Date(Math.min(end, PROJECT_END));
  const left = Math.min(100, Math.max(0, ((clippedStart - PROJECT_START) / total) * 100));
  const width = Math.min(100 - left, Math.max(4, ((clippedEnd - clippedStart) / total) * 100));
  return { left, width };
}

function barColor(status) {
  if (status === 'gesetzt') return 'green';
  if (status === 'zugesagt') return 'blue';
  if (status === 'zu_kl\u00e4ren') return 'orange';
  return 'gray';
}

async function exportPdf() {
  const client = await getClient();
  const [participants, privateRows] = await Promise.all([
    client.from('participants').select('id,full_name,public_role,availability_from,availability_to,status,availability_note,source_note'),
    client.from('participant_private').select('participant_id,phone,email')
  ]);
  if (participants.error) throw participants.error;
  if (privateRows.error) throw privateRows.error;
  const query = (document.getElementById('personnelSearch')?.value || '').trim().toLowerCase();
  const status = document.getElementById('personnelStatusFilter')?.value || 'all';
  const sort = document.getElementById('personnelSortBy')?.value || 'role';
  const privateById = new Map((privateRows.data || []).map(row => [Number(row.participant_id), row]));
  const future = new Date('9999-12-31T00:00:00');
  const rows = (participants.data || [])
    .filter(row => (!query || String(row.full_name || '').toLowerCase().includes(query)) && (status === 'all' || row.status === status))
    .sort((a, b) => {
      if (sort === 'name') return String(a.full_name || '').localeCompare(String(b.full_name || ''), 'de');
      if (sort === 'status') return (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99) || String(a.full_name || '').localeCompare(String(b.full_name || ''), 'de');
      if (sort === 'start') return (parseDate(a.availability_from) || future) - (parseDate(b.availability_from) || future) || String(a.full_name || '').localeCompare(String(b.full_name || ''), 'de');
      return roleRank(a.public_role) - roleRank(b.public_role) || (parseDate(a.availability_from) || future) - (parseDate(b.availability_from) || future) || String(a.full_name || '').localeCompare(String(b.full_name || ''), 'de');
    });
  const body = rows.map(person => {
    const privateRow = privateById.get(Number(person.id)) || {};
    const timeline = range(person);
    const bar = timeline
      ? `<div class="tl"><div class="bar ${barColor(person.status)}" style="left:${timeline.left}%;width:${timeline.width}%"></div></div><small>${formatDate(person.availability_from)} - ${formatDate(person.availability_to)}</small>`
      : '<small>Zeitraum unklar</small>';
    return `<tr><td><b>${escapeHtml(person.full_name || 'Ohne Namen')}</b><br>${escapeHtml(person.public_role || 'Teilnehmende')}</td><td>${escapeHtml(privateRow.email || '-')}<br>${escapeHtml(privateRow.phone || '-')}</td><td>${escapeHtml(person.status || '-')}</td><td>${bar}</td><td>${escapeHtml([person.availability_note, person.source_note].filter(Boolean).join(' - ').slice(0, 100))}</td></tr>`;
  }).join('');
  const win = window.open('', '_blank');
  if (!win) {
    window.alert('PDF-Export konnte nicht geoeffnet werden.');
    return;
  }
  win.document.write(`<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Personaleinsatz</title><style>@page{size:A4 landscape;margin:14mm}body{font-family:Arial,sans-serif;color:#0f2740}table{width:100%;border-collapse:collapse;font-size:9.5px}th,td{border:1px solid #d7e1ea;padding:5px;vertical-align:top}th{background:#edf3f8}.tl{position:relative;height:18px;border:1px solid #ccd8e4;border-radius:999px;background:#f7fafc}.bar{position:absolute;top:3px;height:12px;border-radius:999px}.green{background:#2f855a}.blue{background:#2b6cb0}.orange{background:#c98216}.gray{background:#687587}small{color:#52677c}</style></head><body><h1>Personaleinsatz Kerpen-Manheim 2026</h1><p>Sortierung wie in der Webansicht. Export mit Kontaktdaten fuer berechtigte Rollen.</p><table><thead><tr><th>Person / Rolle</th><th>Kontakt</th><th>Status</th><th>Teilnahmezeitraum</th><th>Hinweis</th></tr></thead><tbody>${body || '<tr><td colspan="5">Keine Personen fuer diese Auswahl.</td></tr>'}</tbody></table><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),150));</script></body></html>`);
  win.document.close();
}

document.addEventListener('click', event => {
  const roleButton = event.target.closest?.('.personnel-role-edit-btn');
  if (roleButton) {
    activeRoleId = roleButton.dataset.id;
    scheduleApply();
  }
  const choice = event.target.closest?.('#personnelRoleOptions[data-role-order-patched="true"] .personnel-role-choice');
  if (choice) {
    event.preventDefault();
    event.stopImmediatePropagation();
    saveRole(choice.dataset.role);
  }
  if (event.target.closest?.('.participant-planning-tab, .nav-btn[data-tab="participants"]')) scheduleApply();
  const exportButton = event.target.closest?.('#personnelPdfExport');
  if (exportButton) {
    event.preventDefault();
    event.stopImmediatePropagation();
    exportPdf().catch(error => window.alert(`PDF-Export fehlgeschlagen: ${error.message || error}`));
  }
}, true);

document.addEventListener('change', event => {
  if (event.target.matches?.('#personnelSortBy, #personnelStatusFilter')) scheduleApply();
}, true);

document.addEventListener('input', event => {
  if (!event.target.matches?.('#personnelSearch')) return;
  window.clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(scheduleApply, 120);
}, true);

window.setTimeout(scheduleApply, 800);
window.setTimeout(scheduleApply, 1600);

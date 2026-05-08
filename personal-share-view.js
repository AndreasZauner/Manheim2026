import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const PROJECT_START = new Date('2026-07-27T00:00:00');
const PROJECT_END = new Date('2026-10-09T00:00:00');
const REFRESH_MS = 60000;
let state = { client: null, password: '', snapshot: null, error: '' };

function isShareRoute() {
  const params = new URLSearchParams(window.location.search);
  return params.get('share') === 'personal' || params.has('personalstand');
}

function getClient() {
  const config = window.APP_CONFIG || {};
  return window.getManheimSupabaseClient?.(createClient) || createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
}

function install() {
  if (!isShareRoute() || window.__personalShareInstalled) return;
  window.__personalShareInstalled = true;
  state.client = getClient();
  document.body.classList.add('personal-share-mode');
  injectStyles();
  hideApp();
  renderRoot();
  renderLocked();
}

function hideApp() {
  ['setupBanner', 'authScreen', 'pendingScreen', 'app'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
}

function renderRoot() {
  if (document.getElementById('personalShareRoot')) return;
  document.body.insertAdjacentHTML('beforeend', '<main id="personalShareRoot" class="personal-share-root"></main>');
}

function injectStyles() {
  if (document.getElementById('personalShareStyles')) return;
  const style = document.createElement('style');
  style.id = 'personalShareStyles';
  style.textContent = `
    body.personal-share-mode{margin:0;background:#edf4fb;color:#0b2540;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.personal-share-root{min-height:100vh;padding:28px;box-sizing:border-box}.personal-share-shell{max-width:1480px;margin:0 auto}.personal-share-card{background:#fff;border:1px solid #d4e2ee;border-radius:12px;box-shadow:0 20px 55px rgba(18,44,71,.12)}.personal-share-login{width:min(520px,100%);margin:12vh auto 0;padding:28px}.personal-share-login h1,.personal-share-header h1{margin:0;font-size:30px;letter-spacing:0}.personal-share-muted{color:#526a80;line-height:1.45}.personal-share-form{display:grid;gap:14px;margin-top:22px}.personal-share-form label{display:grid;gap:7px;font-weight:700}.personal-share-form input{border:1px solid #c9d9e6;border-radius:9px;font:inherit;padding:12px 14px}.personal-share-button{border:0;border-radius:9px;background:#2378d5;color:#fff;cursor:pointer;font:inherit;font-weight:800;padding:12px 16px}.personal-share-button:disabled{opacity:.65;cursor:wait}.personal-share-error{min-height:20px;color:#b42318;font-weight:700}.personal-share-header{display:grid;grid-template-columns:minmax(240px,1fr) auto;gap:22px;align-items:end;margin-bottom:18px}.personal-share-badge{display:inline-flex;border-radius:999px;background:#e7f7ed;border:1px solid #bde6ca;color:#046c38;font-weight:800;padding:9px 14px;white-space:nowrap}.personal-share-kpis{display:grid;grid-template-columns:repeat(5,minmax(120px,1fr));gap:12px;margin-bottom:16px}.personal-share-kpi{padding:14px}.personal-share-kpi span{display:block;color:#60778d;font-size:12px;font-weight:800;text-transform:uppercase}.personal-share-kpi strong{display:block;margin-top:4px;font-size:28px}.personal-share-table{overflow:hidden}.personal-share-table-head,.personal-share-row{display:grid;grid-template-columns:1.1fr .8fr 1fr 1.45fr 1.5fr}.personal-share-table-head{background:#18324a;color:#fff;font-size:12px;font-weight:900;text-transform:uppercase}.personal-share-table-head div,.personal-share-cell{padding:12px 14px;border-bottom:1px solid #dbe7f0}.personal-share-row:nth-child(odd){background:#f8fbfd}.personal-share-name{display:grid;gap:5px}.personal-share-name strong{font-size:16px}.personal-share-status{display:inline-flex;width:fit-content;border-radius:999px;padding:4px 9px;font-size:12px;font-weight:900}.personal-share-status.gesetzt{background:#dff5e7;color:#086034}.personal-share-status.zugesagt{background:#dbeafe;color:#1e4f95}.personal-share-status.unklar,.personal-share-status.zu-klaeren{background:#fff1d6;color:#995d00}.personal-share-status.anzufragen{background:#e7edf3;color:#4b5d6f}.personal-share-timeline{position:relative;height:22px;border:1px solid #cbdbe8;border-radius:999px;background:repeating-linear-gradient(to right,#f6f9fc 0,#f6f9fc calc(9.09% - 1px),#dce7f0 calc(9.09% - 1px),#dce7f0 9.09%);overflow:hidden;margin-bottom:6px}.personal-share-bar,.personal-share-absence{position:absolute;top:4px;height:14px;border-radius:999px}.personal-share-bar.gesetzt{background:#2f855a}.personal-share-bar.zugesagt{background:#2b6cb0}.personal-share-bar.unklar,.personal-share-bar.zu-klaeren{background:#c98216}.personal-share-bar.anzufragen{background:#6b7785}.personal-share-absence{background:#dc2626;opacity:.86;z-index:2}.personal-share-note{color:#526a80;line-height:1.35;white-space:pre-wrap}.personal-share-empty{padding:22px;color:#526a80}@media(max-width:980px){.personal-share-root{padding:14px}.personal-share-header,.personal-share-table-head,.personal-share-row{grid-template-columns:1fr}.personal-share-table-head{display:none}.personal-share-kpis{grid-template-columns:repeat(2,1fr)}.personal-share-cell::before{content:attr(data-label);display:block;margin-bottom:4px;color:#60778d;font-size:11px;font-weight:900;text-transform:uppercase}}
  `;
  document.head.appendChild(style);
}

function renderLocked() {
  hideApp();
  const root = document.getElementById('personalShareRoot');
  root.innerHTML = `
    <section class="personal-share-login personal-share-card">
      <h1>Personalstand</h1>
      <p class="personal-share-muted">Vertrauliche Live-Ansicht der Personalplanung Kerpen-Manheim 2026. Der Link ist nur lesend, Aenderungen werden in der internen App vorgenommen.</p>
      <form id="personalShareForm" class="personal-share-form">
        <label>Passwort<input name="password" type="password" autocomplete="current-password" required autofocus></label>
        <button class="personal-share-button" type="submit">Personalstand oeffnen</button>
        <div class="personal-share-error">${escapeHtml(state.error)}</div>
      </form>
    </section>`;
  root.querySelector('#personalShareForm')?.addEventListener('submit', event => {
    event.preventDefault();
    state.password = String(new FormData(event.currentTarget).get('password') || '');
    loadShare();
  });
}

async function loadShare() {
  if (!state.client || !state.password) return;
  const button = document.querySelector('#personalShareForm button[type="submit"]');
  if (button) { button.disabled = true; button.textContent = 'Lade Personalstand ...'; }
  try {
    const { data, error } = await state.client.rpc('get_personal_share_snapshot', { p_password: state.password });
    if (error) throw error;
    state.snapshot = data || { participants: [] };
    renderUnlocked();
    window.clearInterval(window.__personalShareRefreshTimer);
    window.__personalShareRefreshTimer = window.setInterval(loadShareQuietly, REFRESH_MS);
  } catch (error) {
    console.error('Personalstand konnte nicht geladen werden', error);
    state.error = 'Personalstand konnte nicht geladen werden. Bitte Passwort pruefen.';
    renderLocked();
  }
}

async function loadShareQuietly() {
  try {
    const { data, error } = await state.client.rpc('get_personal_share_snapshot', { p_password: state.password });
    if (error) throw error;
    state.snapshot = data || { participants: [] };
    renderUnlocked();
  } catch (error) {
    console.error('Personalstand konnte nicht aktualisiert werden', error);
  }
}

function renderUnlocked() {
  hideApp();
  const root = document.getElementById('personalShareRoot');
  const people = normalizePeople(state.snapshot?.participants || []);
  const kpis = buildKpis(people);
  root.innerHTML = `
    <div class="personal-share-shell">
      <header class="personal-share-header"><div><h1>Personalstand Kerpen-Manheim 2026</h1><p class="personal-share-muted">Live-Nur-Lese-Ansicht mit Kontaktinformationen, Hinweisen, Zeitraeumen und Ausfaellen. Stand: ${escapeHtml(formatDateTime(state.snapshot?.generated_at))}</p></div><div class="personal-share-badge">Live aus Supabase</div></header>
      <section class="personal-share-kpis">${kpis.map(item => `<div class="personal-share-card personal-share-kpi"><span>${escapeHtml(item.label)}</span><strong>${item.value}</strong></div>`).join('')}</section>
      <section class="personal-share-card personal-share-table"><div class="personal-share-table-head"><div>Person</div><div>Status</div><div>Kontakt</div><div>Zeitraum</div><div>Hinweise / Notizen</div></div>${people.length ? people.map(renderPerson).join('') : '<div class="personal-share-empty">Noch keine Personen vorhanden.</div>'}</section>
    </div>`;
}

function normalizePeople(people) {
  return [...people].sort((a, b) => roleRank(a.public_role) - roleRank(b.public_role) || compareDate(firstSlot(a)?.availability_from, firstSlot(b)?.availability_from) || String(a.full_name || '').localeCompare(String(b.full_name || ''), 'de'));
}

function renderPerson(person) {
  const slots = getSlots(person);
  const absences = Array.isArray(person.absences) ? person.absences : [];
  const privateData = person.private || {};
  const notes = [person.availability_note, person.source_note, privateData.internal_note].filter(Boolean).join('\n');
  return `<article class="personal-share-row"><div class="personal-share-cell personal-share-name" data-label="Person"><strong>${escapeHtml(person.full_name || 'Ohne Namen')}</strong><span>${escapeHtml(person.public_role || 'Teilnehmende')}</span></div><div class="personal-share-cell" data-label="Status"><span class="personal-share-status ${escapeHtml(statusClass(person.status))}">${escapeHtml(prettyStatus(person.status))}</span></div><div class="personal-share-cell personal-share-note" data-label="Kontakt">${escapeHtml([privateData.email, privateData.phone].filter(Boolean).join('\n') || '-')}</div><div class="personal-share-cell" data-label="Zeitraum"><div class="personal-share-timeline">${slots.map(slot => renderRange(slot, `personal-share-bar ${statusClass(person.status)}`)).join('')}${absences.map(renderAbsence).join('')}</div><div class="personal-share-note">${escapeHtml(slots.map(slot => `${formatDate(slot.availability_from)} - ${formatDate(slot.availability_to)}`).join('\n') || 'offen')}</div></div><div class="personal-share-cell personal-share-note" data-label="Hinweise / Notizen">${escapeHtml(notes || '-')}${absences.length ? `<br><br><strong>Ausfaelle:</strong><br>${escapeHtml(absences.map(formatAbsence).join('\n'))}` : ''}</div></article>`;
}

function renderRange(slot, className) {
  const range = buildRange(slot.availability_from, slot.availability_to);
  return range.valid ? `<span class="${className}" style="left:${range.left}%;width:${range.width}%"></span>` : '';
}

function renderAbsence(absence) {
  const range = buildRange(absence.absence_from, absence.absence_to);
  return range.valid ? `<span class="personal-share-absence" title="${escapeHtml(formatAbsence(absence))}" style="left:${range.left}%;width:${range.width}%"></span>` : '';
}

function buildRange(from, to) {
  const start = parseDate(from);
  const end = parseDate(to);
  const total = PROJECT_END - PROJECT_START;
  if (!start || !end || end < start) return { valid: false, left: 0, width: 0 };
  const clippedStart = new Date(Math.max(start, PROJECT_START));
  const clippedEnd = new Date(Math.min(end, PROJECT_END));
  if (clippedEnd < PROJECT_START || clippedStart > PROJECT_END) return { valid: false, left: 0, width: 0 };
  const left = clamp(((clippedStart - PROJECT_START) / total) * 100, 0, 100);
  const width = clamp(((clippedEnd - clippedStart) / total) * 100, 2, 100 - left);
  return { valid: true, left, width };
}

function buildKpis(people) {
  return [
    { label: 'Gesamt', value: people.length },
    { label: 'Zugesagt', value: people.filter(person => person.status === 'zugesagt').length },
    { label: 'Gesetzt', value: people.filter(person => person.status === 'gesetzt').length },
    { label: 'Unklar', value: people.filter(person => ['unklar', 'zu_klären', 'anzufragen'].includes(person.status)).length },
    { label: 'Mit Ausfaellen', value: people.filter(person => Array.isArray(person.absences) && person.absences.length).length }
  ];
}

function getSlots(person) {
  if (Array.isArray(person.slots) && person.slots.length) return person.slots;
  if (person.availability_from || person.availability_to) return [{ availability_from: person.availability_from, availability_to: person.availability_to }];
  return [];
}
function firstSlot(person) { return getSlots(person)[0] || {}; }
function roleRank(role) { const text = String(role || '').toLowerCase(); if (/grabungsleit|professor|projektleit/.test(text)) return 0; if (/technische/.test(text)) return 1; if (/assist/.test(text)) return 2; if (/schnitt/.test(text)) return 3; if (/doku|dokument/.test(text)) return 4; if (/logistik|infra/.test(text)) return 5; if (/teilnehm|student/.test(text)) return 6; return 9; }
function prettyStatus(status) { return ({ gesetzt: 'gesetzt', zugesagt: 'zugesagt', unklar: 'unklar', 'zu_klären': 'zu klaeren', anzufragen: 'anzufragen' })[status] || status || '-'; }
function statusClass(status) { return status === 'zu_klären' ? 'zu-klaeren' : String(status || 'unklar'); }
function formatAbsence(absence) { const reason = absence.reason_type === 'krank' ? 'Krank' : (absence.reason_note || 'Anderer Grund'); return `${formatDate(absence.absence_from)} - ${formatDate(absence.absence_to)}: ${reason}`; }
function parseDate(value) { if (!value) return null; const date = new Date(String(value).slice(0, 10) + 'T00:00:00'); return Number.isNaN(date.getTime()) ? null : date; }
function compareDate(a, b) { if (!a && !b) return 0; if (!a) return 1; if (!b) return -1; return new Date(a) - new Date(b); }
function formatDate(value) { const date = parseDate(value); return date ? date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'offen'; }
function formatDateTime(value) { const date = value ? new Date(value) : new Date(); return date.toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' }); }
function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
function escapeHtml(value) { return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;'); }

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install); else install();

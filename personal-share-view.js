import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const PROJECT_START = new Date('2026-07-27T00:00:00');
const PROJECT_END = new Date('2026-10-09T00:00:00');
const TARGET_ATTENDANCE = 10;
const CRITICAL_ATTENDANCE = 6;
const MAX_Y = 15;
const REFRESH_MS = 60000;

let state = { client: null, password: '', snapshot: null, error: '', search: '', status: 'all', personType: 'all', sort: 'role' };

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
  if (!document.querySelector('link[href^="./participant-planning-module.css"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = './participant-planning-module.css?v=planning-20260504-2';
    document.head.appendChild(link);
  }
  if (document.getElementById('personalShareStyles')) return;
  const style = document.createElement('style');
  style.id = 'personalShareStyles';
  style.textContent = `
    body.personal-share-mode{margin:0;background:#edf4fb;color:#0b2540;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.personal-share-root{--border:#d4e2ee;--muted:#526a80;--shadow:0 20px 55px rgba(18,44,71,.12);min-height:100vh;padding:28px;box-sizing:border-box}.personal-share-shell{max-width:1480px;margin:0 auto;display:grid;gap:18px}.personal-share-card{background:#fff;border:1px solid #d4e2ee;border-radius:12px;box-shadow:var(--shadow)}.personal-share-login{width:min(520px,100%);margin:12vh auto 0;padding:28px}.personal-share-login h1,.personal-share-title h1{margin:0;font-size:30px;letter-spacing:0}.personal-share-muted{color:#526a80;line-height:1.45}.personal-share-form{display:grid;gap:14px;margin-top:22px}.personal-share-form label{display:grid;gap:7px;font-weight:700}.personal-share-form input{border:1px solid #c9d9e6;border-radius:9px;font:inherit;padding:12px 14px}.personal-share-button{border:0;border-radius:9px;background:#2378d5;color:#fff;cursor:pointer;font:inherit;font-weight:800;padding:12px 16px}.personal-share-button:disabled{opacity:.65;cursor:wait}.personal-share-error{min-height:20px;color:#b42318;font-weight:700}.personal-share-header{display:grid;grid-template-columns:minmax(260px,1fr) minmax(520px,650px) auto;gap:20px;align-items:start}.personal-share-title{padding-top:10px}.personal-share-badge,.personal-share-readonly-note{display:inline-flex;width:fit-content;border-radius:999px;font-weight:800;white-space:nowrap}.personal-share-badge{background:#e7f7ed;border:1px solid #bde6ca;color:#046c38;padding:9px 14px;margin-top:10px}.personal-share-readonly-note{background:#eef6ff;border:1px solid #cfe1f4;color:#1f5f99;font-size:12px;padding:5px 10px;margin-top:10px}.personal-share-chart.chart-card{width:100%;border:1px solid rgba(166,125,65,.32);background:#fffaf1;border-radius:16px;padding:12px 14px 8px;box-shadow:0 16px 35px rgba(72,54,30,.11);box-sizing:border-box}.personal-share-chart .chart-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:6px}.personal-share-chart .eyebrow{font-size:10px;font-weight:800;color:#7a6b59;text-transform:uppercase;letter-spacing:.08em}.personal-share-chart .chart-head strong{display:block;color:#2f2a24;font-size:15px}.personal-share-chart .kpis{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}.personal-share-chart .kpis span{border-radius:999px;border:1px solid rgba(47,42,36,.08);background:rgba(255,255,255,.82);padding:3px 8px;font-size:12px;color:#6d5d4c}.personal-share-chart .kpis strong{color:#2f2a24}.personal-share-chart .chart-wrap{width:100%;height:172px;border:1px solid rgba(47,42,36,.08);border-radius:10px;background:#fff;overflow:hidden}.personal-share-chart svg{width:100%;height:100%;display:block}.personal-share-chart .tick-label{fill:#766b5d;font-size:10px}.personal-share-chart .grid-line{stroke:rgba(47,42,36,.12);stroke-width:1}.personal-share-chart .attendance-line{fill:none;stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round}.personal-share-chart .line-normal{stroke:#2563eb}.personal-share-chart .line-target{stroke:#16a34a}.personal-share-chart .line-critical{stroke:#dc2626}.personal-share-chart .line-total{stroke:#eab308;stroke-width:2.8;stroke-dasharray:6 4}.personal-share-chart .legend-line{stroke-width:3;stroke-linecap:round}.personal-share-chart .legend-line.regular{stroke:#2563eb}.personal-share-chart .legend-line.total{stroke:#eab308;stroke-dasharray:5 3}.personal-share-chart .attendance-legend text{fill:#766b5d;font-size:9px;font-weight:800}.personal-share-chart .target-line{stroke:#16a34a;stroke-width:2;stroke-dasharray:8 6}.personal-share-chart .critical-band{fill:rgba(220,38,38,.16)}.personal-share-chart .critical-boundary{stroke:rgba(220,38,38,.45);stroke-width:1.2;stroke-dasharray:5 5}.personal-share-chart .target-text{fill:#166534;font-size:10px;font-weight:800}.personal-share-root .personnel-topbar{margin-top:0}.personal-share-root .personnel-controls .personnel-select,.personal-share-root .personnel-controls .personnel-search{min-height:42px}.personal-share-root .personnel-role{border:0;background:transparent;padding:0;text-align:left;cursor:default}.personal-share-root .personnel-note{display:grid;gap:3px}.personal-share-root .personnel-note small{color:#60778d;line-height:1.35}.personal-share-root .personnel-note strong{color:#0b2540}.personal-share-root .personnel-badge.status-erweiterbar{background:#e9f1fb;color:#2b6cb0}.personal-share-root .personnel-badge.status-unklar{background:#fff4e5;color:#c98216}.personal-share-root .personnel-badge.type-student{background:#eef6ff;border:1px solid #cfe2fb;color:#245d9f}.personal-share-root .personnel-badge.type-external{background:#fff8db;border:1px solid #efd47a;color:#8a6400}.personal-share-root .personnel-swatch.red{background:#dc2626}.personal-share-absence{position:absolute;top:4px;height:18px;border-radius:999px;background:#dc2626;opacity:.86;z-index:3}@media(max-width:1180px){.personal-share-header{grid-template-columns:1fr}.personal-share-badge{margin-top:0}}@media(max-width:760px){.personal-share-root{padding:14px}.personal-share-chart .chart-head{display:block}.personal-share-chart .kpis{justify-content:flex-start;margin-top:6px}.personal-share-chart .chart-wrap{height:150px}}
    .personal-share-login{width:min(980px,100%);margin:7vh auto 0;padding:0;display:grid;grid-template-columns:minmax(300px,.9fr) minmax(340px,1fr);overflow:hidden;border-radius:18px;background:#fff}.personal-share-login-brand{display:grid;place-items:center;padding:34px 28px;background:linear-gradient(145deg,#f8fbff 0,#eef5fb 100%);border-right:1px solid #dbe7f1}.personal-share-login-logo{width:min(360px,92%);height:auto;display:block;filter:drop-shadow(0 18px 32px rgba(9,32,52,.12))}.personal-share-login-panel{padding:38px 36px 34px;display:grid;align-content:center}.personal-share-login-kicker{width:fit-content;margin-bottom:12px;border:1px solid #cfe1f4;border-radius:999px;background:#eef6ff;color:#1f5f99;font-size:12px;font-weight:900;letter-spacing:.08em;padding:6px 10px;text-transform:uppercase}.personal-share-login h1{font-size:32px;line-height:1.1}.personal-share-login .personal-share-muted{margin:12px 0 0}.personal-share-login .personal-share-form{margin-top:26px}.personal-share-login .personal-share-form input{min-height:48px;border-radius:10px;background:#fbfdff}.personal-share-login .personal-share-button{min-height:48px;border-radius:10px;background:#0f5faa;box-shadow:0 12px 22px rgba(15,95,170,.18)}.personal-share-login .personal-share-button:hover,.personal-share-login .personal-share-button:focus-visible{background:#0b4f91;outline:3px solid rgba(35,120,213,.18);outline-offset:2px}.personal-share-login-foot{margin-top:18px;color:#60778d;font-size:13px;line-height:1.4}@media(max-width:760px){.personal-share-login{grid-template-columns:1fr;margin:4vh auto 0}.personal-share-login-brand{padding:22px 18px;border-right:0;border-bottom:1px solid #dbe7f1}.personal-share-login-logo{width:min(310px,94%)}.personal-share-login-panel{padding:26px 22px 24px}.personal-share-login h1{font-size:28px}}
  `;
  document.head.appendChild(style);
}

function renderLocked() {
  hideApp();
  const root = document.getElementById('personalShareRoot');
  root.innerHTML = `
    <section class="personal-share-login personal-share-card">
      <div class="personal-share-login-brand">
        <img class="personal-share-login-logo" src="./assets/psa-logo.png?v=20260510" alt="Kerpen-Manheim 2026 Lehrgrabung Planer">
      </div>
      <div class="personal-share-login-panel">
        <span class="personal-share-login-kicker">Geschützter Zugang</span>
        <h1>Personalstand</h1>
        <p class="personal-share-muted">Vertrauliche Live-Ansicht der Personalplanung Kerpen-Manheim 2026. Der Link ist nur lesend, Änderungen werden in der internen App vorgenommen.</p>
        <form id="personalShareForm" class="personal-share-form">
          <label>Passwort<input name="password" type="password" autocomplete="current-password" required autofocus></label>
          <button class="personal-share-button" type="submit">Personalstand öffnen</button>
          <div class="personal-share-error">${escapeHtml(state.error)}</div>
        </form>
        <div class="personal-share-login-foot">Nur für Personen mit freigegebenem Passwort. Daten werden live aus der Planung geladen.</div>
      </div>
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
    state.error = getShareErrorMessage(error);
    renderLocked();
  }
}

function getShareErrorMessage(error) {
  const message = String(error?.message || error || '');
  const code = String(error?.code || '');
  if (code === 'PGRST202' || /get_personal_share_snapshot|schema cache|function .*not found/i.test(message)) return 'Personal-Viewer ist in Supabase noch nicht eingerichtet. Bitte supabase/personal_share_module.sql ausführen und danach kurz warten.';
  if (code === '28000' || /ungueltiges passwort|ungültiges passwort|invalid password/i.test(message)) return 'Personalstand konnte nicht geladen werden. Bitte Passwort prüfen.';
  return 'Personalstand konnte nicht geladen werden. Bitte Setup und Verbindung prüfen.';
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
  const list = getFilteredPeople(people);
  root.innerHTML = `
    <div class="personal-share-shell">
      <header class="personal-share-header">
        <div class="personal-share-title"><h1>Personal</h1><p class="personal-share-muted">Personaleinsatz, Zeiträume, Verbindlichkeit und Hinweise</p><span class="personal-share-readonly-note">Nur-Lese-Ansicht · Stand: ${escapeHtml(formatDateTime(state.snapshot?.generated_at))}</span></div>
        <section class="personal-share-chart chart-card" aria-label="Diagramm zur täglichen Anwesenheit des Personals">${renderChartCard(buildDailySeries(people))}</section>
        <div class="personal-share-badge">Live aus Supabase</div>
      </header>
      <section class="personnel-hero"><div><div class="personnel-eyebrow">Personal</div><h3>Personaleinsatz</h3><p>Zeiträume, Status und Hinweise im Überblick. Die Balken basieren auf den echten Supabase-Teilnehmerdaten.</p></div></section>
      <div class="personnel-topbar"><div class="personnel-summary">${summaryCards(list)}</div><div class="personnel-controls"><input id="personnelShareSearch" class="personnel-search" type="text" placeholder="Nach Namen suchen ..." value="${escapeHtml(state.search)}"><select id="personnelShareStatusFilter" class="personnel-select">${statusOptions(people).map(item => `<option value="${escapeHtml(item.value)}" ${state.status === item.value ? 'selected' : ''}>${escapeHtml(item.label)}</option>`).join('')}</select><select id="personnelShareTypeFilter" class="personnel-select"><option value="all" ${state.personType === 'all' ? 'selected' : ''}>Alle Gruppen</option><option value="student" ${state.personType === 'student' ? 'selected' : ''}>Regulär</option><option value="external" ${state.personType === 'external' ? 'selected' : ''}>Externe</option><option value="external_unclear" ${state.personType === 'external_unclear' ? 'selected' : ''}>Externe offen</option></select><select id="personnelShareSortBy" class="personnel-select"><option value="role" ${state.sort === 'role' ? 'selected' : ''}>Nach Rolle / Start</option><option value="start" ${state.sort === 'start' ? 'selected' : ''}>Nach Startdatum</option><option value="name" ${state.sort === 'name' ? 'selected' : ''}>Alphabetisch</option><option value="status" ${state.sort === 'status' ? 'selected' : ''}>Nach Status</option><option value="problem" ${state.sort === 'problem' ? 'selected' : ''}>Klärungsbedarf zuerst</option></select></div></div>
      <section class="personnel-board"><div class="personnel-board-header"><div class="personnel-left-head"><h3>Teilnehmende</h3><p>Name, Rolle, Status und Zusatzhinweise</p></div><div class="personnel-right-head"><h3>Gesamtzeitraum der Grabung: 27.07.2026 - 09.10.2026</h3><p>Der farbige Balken zeigt den jeweils geplanten Teilnahmezeitraum.</p></div></div><div class="personnel-rows">${list.length ? list.map(renderPerson).join('') : '<div class="personnel-empty">Keine Personen für diese Auswahl gefunden.</div>'}</div><div class="personnel-legend"><span><i class="personnel-swatch green"></i>gesetzt</span><span><i class="personnel-swatch blue"></i>zugesagt</span><span><i class="personnel-swatch orange"></i>zu klären / unklar</span><span><i class="personnel-swatch gray"></i>anzufragen</span><span><i class="personnel-swatch red"></i>Ausfall</span></div></section>
    </div>`;
  bindReadOnlyUi();
}

function bindReadOnlyUi() {
  document.getElementById('personnelShareSearch')?.addEventListener('input', event => { state.search = event.target.value; renderUnlocked(); });
  document.getElementById('personnelShareStatusFilter')?.addEventListener('change', event => { state.status = event.target.value; renderUnlocked(); });
  document.getElementById('personnelShareTypeFilter')?.addEventListener('change', event => { state.personType = event.target.value; renderUnlocked(); });
  document.getElementById('personnelShareSortBy')?.addEventListener('change', event => { state.sort = event.target.value; renderUnlocked(); });
}

function normalizePeople(people) { return people.map(person => ({ ...person, status: normalizeStatus(person.status), slots: slotsFor(person) })); }
function getFilteredPeople(people) { const query = state.search.trim().toLowerCase(); return [...people].filter(person => !query || String(person.full_name || '').toLowerCase().includes(query)).filter(person => state.status === 'all' || person.status === state.status).filter(matchesPersonTypeFilter).sort(comparePeople); }
function matchesPersonTypeFilter(person) { const type = personType(person); if (state.personType === 'all') return true; if (state.personType === 'external_unclear') return type === 'external' && hasProblem(person); return type === state.personType; }
function comparePeople(a, b) { if (state.sort === 'role') return roleRank(a.public_role) - roleRank(b.public_role) || compareDates(firstSlot(a)?.availability_from, firstSlot(b)?.availability_from) || compareNames(a, b); if (state.sort === 'name') return compareNames(a, b); if (state.sort === 'status') return statusRank(a.status) - statusRank(b.status) || compareNames(a, b); if (state.sort === 'problem') return Number(hasProblem(b)) - Number(hasProblem(a)) || compareDates(firstSlot(a)?.availability_from, firstSlot(b)?.availability_from); return compareDates(firstSlot(a)?.availability_from, firstSlot(b)?.availability_from) || compareNames(a, b); }
function compareNames(a, b) { return String(a.full_name || '').localeCompare(String(b.full_name || ''), 'de'); }

function renderPerson(person) {
  const ranges = rangesFor(person);
  const privateData = person.private || {};
  const absences = Array.isArray(person.absences) ? person.absences : [];
  const note = [person.availability_note, privateData.internal_note, person.source_note].filter(Boolean).join(' · ');
  const contact = [privateData.email, privateData.phone].filter(Boolean).join(' · ');
  const timeline = ranges.length ? `<div class="personnel-timeline">${ranges.map((range, index) => `<div class="personnel-bar personnel-bar-segment ${barColor(person.status)}" style="left:${range.left}%;width:${range.width}%">${index === 0 ? escapeHtml(formatSlotSummary(person)) : ''}</div>`).join('')}${absences.map(renderAbsenceBar).join('')}</div>` : '<div class="personnel-unclear">Zeitraum unklar / uneinheitlich</div>';
  const notes = [note ? `<small><strong>Hinweise:</strong> ${escapeHtml(shorten(note, 220))}</small>` : '', absences.length ? `<small><strong>Ausfälle:</strong> ${escapeHtml(absences.map(formatAbsence).join(' · '))}</small>` : ''].filter(Boolean).join('');
  return `<article class="personnel-row"><div class="personnel-person"><div class="personnel-person-top"><strong>${escapeHtml(person.full_name || 'Ohne Namen')}</strong><span class="personnel-badge ${statusClass(person.status)}">${escapeHtml(prettyStatus(person.status))}</span><span class="personnel-badge type-${escapeHtml(personType(person))}">${personType(person) === 'external' ? 'extern' : 'regulär'}</span></div><span class="personnel-role">${escapeHtml(person.public_role || 'Teilnehmende')}</span><div class="personnel-meta"><span class="personnel-badge outline">${escapeHtml(formatSlotSummary(person))}</span>${hasProblem(person) ? '<span class="personnel-badge warning">Klärungsbedarf</span>' : ''}${contact ? `<span class="personnel-badge outline">${escapeHtml(contact)}</span>` : ''}</div></div><div class="personnel-timeline-cell"><div class="personnel-timeline-wrap">${timeline}${notes ? `<div class="personnel-note">${notes}</div>` : ''}</div></div></article>`;
}

function summaryCards(list) {
  const finalConfirmed = list.filter(person => rangesFor(person).length && !hasProblem(person) && !['anzufragen', 'zu_klaeren', 'unklar'].includes(person.status)).length;
  const expandable = list.filter(person => person.status === 'erweiterbar' || /auch|evtl|eventuell|moeglich|möglich|verlänger|verlaenger|zusatzwoche|flexibel|spätere termine|spaetere termine/i.test(noteText(person))).length;
  const values = [['Gesamt', list.length], ['Regulär', list.filter(person => personType(person) === 'student').length], ['Extern', list.filter(person => personType(person) === 'external').length], ['Final bestätigt', finalConfirmed], ['Erweiterbar', expandable], ['Klärungsbedarf', list.filter(hasProblem).length], ['Mit Anmerkung', list.filter(person => Boolean(noteText(person))).length]];
  return values.map(([label, value]) => `<div class="personnel-stat"><span>${escapeHtml(label)}</span><strong>${value}</strong></div>`).join('');
}

function statusOptions(people) { const known = [['all', 'Alle Status'], ['gesetzt', 'gesetzt'], ['zugesagt', 'zugesagt'], ['erweiterbar', 'erweiterbar'], ['unklar', 'unklar'], ['zu_klaeren', 'zu klären'], ['anzufragen', 'anzufragen']]; const extra = new Set(people.map(person => person.status).filter(Boolean)); known.forEach(([value]) => extra.delete(value)); return [...known.map(([value, label]) => ({ value, label })), ...[...extra].sort().map(value => ({ value, label: prettyStatus(value) }))]; }
function buildDailySeries(people) { const counted = people.filter(person => slotsFor(person).length && isCountedStatus(person.status)); return eachProjectDay().map(day => { const planned = counted.filter(person => slotsFor(person).some(slot => isWithin(day.date, slot.availability_from, slot.availability_to)) && !hasAbsenceOnDay(person, day.date)); const count = planned.filter(person => personType(person) !== 'external').length; const externalCount = planned.filter(person => personType(person) === 'external').length; return { ...day, count, externalCount, totalCount: count + externalCount }; }); }
function eachProjectDay() { const days = []; for (let date = new Date(PROJECT_START); date <= PROJECT_END; date.setDate(date.getDate() + 1)) { const copy = new Date(date); days.push({ date: copy, label: copy.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) }); } return days; }
function renderChartCard(daily) { const stats = chartStats(daily); return `<div class="chart-head"><div><div class="eyebrow">Personal · Anwesenheit</div><strong>Tägliche Personalstärke</strong></div><div class="kpis" aria-label="Kennzahlen"><span><strong>${stats.avg}</strong> Ø</span><span><strong>${stats.max}</strong> Max</span><span><strong>${stats.maxTotal}</strong> inkl. extern</span><span><strong>${stats.criticalDays}</strong> kritisch</span></div></div><div class="chart-wrap">${renderSvg(daily)}</div>`; }
function renderSvg(daily) { const width = 620, height = 172, margin = { top: 18, right: 24, bottom: 28, left: 34 }; const chartW = width - margin.left - margin.right, chartH = height - margin.top - margin.bottom; const maxY = Math.max(MAX_Y, Math.ceil(Math.max(...daily.map(day => Math.max(day.count, day.totalCount || day.count)), TARGET_ATTENDANCE) / 3) * 3); const x = index => margin.left + (index / Math.max(daily.length - 1, 1)) * chartW; const y = value => margin.top + chartH - (value / maxY) * chartH; const criticalTop = y(CRITICAL_ATTENDANCE); const ticks = buildTicks(maxY).filter(tick => tick === 0 || tick === CRITICAL_ATTENDANCE || tick === TARGET_ATTENDANCE || tick === maxY); const dateStep = daily.length > 55 ? 14 : daily.length > 28 ? 7 : 4; const totalPath = buildLinePath(daily, x, y, 'totalCount'); return `<svg class="attendance-chart" viewBox="0 0 ${width} ${height}" role="img"><title>Liniendiagramm der täglichen Personal-Anwesenheit</title>${ticks.map(tick => `<line x1="${margin.left}" x2="${width - margin.right}" y1="${y(tick).toFixed(1)}" y2="${y(tick).toFixed(1)}" class="grid-line"></line><text x="${margin.left - 9}" y="${(y(tick) + 3).toFixed(1)}" text-anchor="end" class="tick-label">${tick}</text>`).join('')}<rect x="${margin.left}" y="${criticalTop.toFixed(1)}" width="${chartW}" height="${(y(0) - criticalTop).toFixed(1)}" class="critical-band"></rect><line x1="${margin.left}" x2="${width - margin.right}" y1="${y(CRITICAL_ATTENDANCE).toFixed(1)}" y2="${y(CRITICAL_ATTENDANCE).toFixed(1)}" class="critical-boundary"></line><line x1="${margin.left}" x2="${width - margin.right}" y1="${y(TARGET_ATTENDANCE).toFixed(1)}" y2="${y(TARGET_ATTENDANCE).toFixed(1)}" class="target-line"></line><text x="${width - margin.right}" y="${(y(TARGET_ATTENDANCE) - 5).toFixed(1)}" text-anchor="end" class="target-text">Ziel 10</text>${totalPath ? `<path d="${totalPath}" class="attendance-line line-total"></path>` : ''}${lineSegments(daily, x, y).map(segment => `<path d="${segment.path}" class="attendance-line ${segment.color}"></path>`).join('')}<g class="attendance-legend" transform="translate(${margin.left}, ${margin.top - 5})"><line x1="0" x2="18" y1="0" y2="0" class="legend-line regular"></line><text x="24" y="3">regulär</text><line x1="78" x2="96" y1="0" y2="0" class="legend-line total"></line><text x="102" y="3">inkl. extern</text></g>${daily.map((day, index) => index !== 0 && index !== daily.length - 1 && index % dateStep !== 0 ? '' : `<text x="${x(index).toFixed(1)}" y="${height - margin.bottom + 18}" text-anchor="middle" class="tick-label x">${escapeHtml(day.label)}</text>`).join('')}</svg>`; }
function lineSegments(daily, x, y) { const parts = []; for (let index = 1; index < daily.length; index += 1) { const a = { x: x(index - 1), y: y(daily[index - 1].count), count: daily[index - 1].count, ratio: 0 }, b = { x: x(index), y: y(daily[index].count), count: daily[index].count, ratio: 1 }; const points = [a]; [CRITICAL_ATTENDANCE, TARGET_ATTENDANCE].forEach(threshold => { if ((a.count < threshold && b.count > threshold) || (a.count > threshold && b.count < threshold)) { const ratio = (threshold - a.count) / (b.count - a.count); points.push({ x: a.x + (b.x - a.x) * ratio, y: y(threshold), count: threshold, ratio }); } }); points.push(b); points.sort((aPoint, bPoint) => aPoint.ratio - bPoint.ratio).slice(0, -1).forEach((point, pointIndex) => { const next = points[pointIndex + 1]; const midpoint = (point.count + next.count) / 2; parts.push({ color: midpoint <= CRITICAL_ATTENDANCE ? 'line-critical' : midpoint >= TARGET_ATTENDANCE ? 'line-target' : 'line-normal', path: `M ${point.x.toFixed(1)} ${point.y.toFixed(1)} L ${next.x.toFixed(1)} ${next.y.toFixed(1)}` }); }); } return parts; }
function buildLinePath(daily, x, y, key = 'count') { return daily.map((day, index) => `${index === 0 ? 'M' : 'L'} ${x(index).toFixed(1)} ${y(day[key] ?? day.count).toFixed(1)}`).join(' '); }
function chartStats(daily) { const counts = daily.map(day => day.count); const totalCounts = daily.map(day => day.totalCount || day.count); return { max: Math.max(...counts, 0), maxTotal: Math.max(...totalCounts, 0), avg: counts.length ? (counts.reduce((sum, value) => sum + value, 0) / counts.length).toFixed(1).replace('.', ',') : '0', criticalDays: counts.filter(value => value <= CRITICAL_ATTENDANCE).length }; }
function buildTicks(maxY) { const ticks = []; const step = maxY <= 15 ? 3 : Math.ceil(maxY / 5); for (let tick = 0; tick <= maxY; tick += step) ticks.push(tick); ticks.push(CRITICAL_ATTENDANCE, TARGET_ATTENDANCE); return [...new Set(ticks)].sort((a, b) => a - b); }
function rangesFor(person) { return slotsFor(person).map(slot => buildRange(parseDate(slot.availability_from), parseDate(slot.availability_to))).filter(range => range.valid); }
function buildRange(start, end) { const total = PROJECT_END - PROJECT_START; if (!start || !end || end < start || end < PROJECT_START || start > PROJECT_END) return { valid: false, left: 0, width: 0 }; const clippedStart = new Date(Math.max(start, PROJECT_START)); const clippedEnd = new Date(Math.min(end, PROJECT_END)); const left = clamp(((clippedStart - PROJECT_START) / total) * 100, 0, 100); const width = clamp(((clippedEnd - clippedStart) / total) * 100, 4, 100 - left); return { valid: true, left, width }; }
function renderAbsenceBar(absence) { const range = buildRange(parseDate(absence.absence_from), parseDate(absence.absence_to)); return range.valid ? `<span class="personal-share-absence" title="${escapeHtml(formatAbsence(absence))}" style="left:${range.left}%;width:${range.width}%"></span>` : ''; }
function slotsFor(person) { if (Array.isArray(person.slots) && person.slots.length) return person.slots; return person.availability_from || person.availability_to ? [{ availability_from: person.availability_from, availability_to: person.availability_to }] : []; }
function firstSlot(person) { return slotsFor(person)[0] || {}; }
function hasAbsenceOnDay(person, day) { return (Array.isArray(person.absences) ? person.absences : []).some(absence => isWithin(day, absence.absence_from, absence.absence_to)); }
function isWithin(day, from, to) { const start = parseDate(from), end = parseDate(to); return Boolean(start && end && day >= start && day <= end); }
function isCountedStatus(status) { return ['gesetzt', 'zugesagt', 'erweiterbar', 'zu_klaeren', 'unklar'].includes(normalizeStatus(status)); }
function personType(person) { return String(person?.person_type || 'student') === 'external' ? 'external' : 'student'; }
function normalizeStatus(status) { return String(status || '').trim().toLowerCase().replaceAll('ä', 'ae').replaceAll('ö', 'oe').replaceAll('ü', 'ue').replaceAll('Ã¤', 'ae').replaceAll('Ã¶', 'oe').replaceAll('Ã¼', 'ue').replaceAll(' ', '_').replaceAll('-', '_'); }
function roleRank(role) { const text = String(role || '').toLowerCase(); if (/grabungsleit|projektleit|professor/.test(text)) return 0; if (/technische leit|technical/.test(text)) return 1; if (/assist/.test(text)) return 2; if (/schnitt|trench/.test(text)) return 3; if (/doku|dokument/.test(text)) return 4; if (/logistik|infra/.test(text)) return 5; if (/teilnehm|student|participant/.test(text)) return 6; return 9; }
function statusRank(status) { return ({ gesetzt: 0, zugesagt: 1, erweiterbar: 2, zu_klaeren: 3, unklar: 4, anzufragen: 5 })[normalizeStatus(status)] ?? 99; }
function prettyStatus(status) { return ({ gesetzt: 'gesetzt', zugesagt: 'zugesagt', erweiterbar: 'erweiterbar', unklar: 'unklar', zu_klaeren: 'zu klären', anzufragen: 'anzufragen' })[normalizeStatus(status)] || status || '-'; }
function statusClass(status) { const normalized = normalizeStatus(status); return normalized === 'zu_klaeren' ? 'status-zu-klaeren' : `status-${normalized || 'unknown'}`; }
function barColor(status) { const normalized = normalizeStatus(status); if (normalized === 'gesetzt') return 'green'; if (normalized === 'zugesagt' || normalized === 'erweiterbar') return 'blue'; if (normalized === 'zu_klaeren' || normalized === 'unklar') return 'orange'; return 'gray'; }
function hasProblem(person) { return ['zu_klaeren', 'unklar', 'anzufragen'].includes(normalizeStatus(person.status)) || /unklar|offen|klaer|klär|uneinheitlich|angefragt/i.test(noteText(person)); }
function noteText(person) { const privateData = person.private || {}; return [person.availability_note, person.source_note, privateData.internal_note].filter(Boolean).join(' '); }
function formatSlotSummary(person) { const slots = slotsFor(person).filter(slot => slot.availability_from || slot.availability_to); return slots.length ? slots.map(slot => `${formatDate(slot.availability_from)} - ${formatDate(slot.availability_to)}`).join(' · ') : 'offen'; }
function formatAbsence(absence) { const reason = absence.reason_type === 'krank' ? 'Krank' : (absence.reason_note || 'Anderer Grund'); return `${formatDate(absence.absence_from)} - ${formatDate(absence.absence_to)}: ${reason}`; }
function parseDate(value) { if (!value) return null; const date = new Date(String(value).slice(0, 10) + 'T00:00:00'); return Number.isNaN(date.getTime()) ? null : date; }
function compareDates(a, b) { if (!a && !b) return 0; if (!a) return 1; if (!b) return -1; return new Date(a) - new Date(b); }
function formatDate(value) { const date = parseDate(value); return date ? date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'offen'; }
function formatDateTime(value) { const date = value ? new Date(value) : new Date(); return date.toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' }); }
function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
function shorten(value, maxLength) { const text = String(value || '').trim(); return text.length > maxLength ? `${text.slice(0, maxLength - 1)}...` : text; }
function escapeHtml(value) { return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;'); }

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install); else install();



import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const MANAGER_ROLES = ['admin', 'professor', 'technical_lead', 'assistant'];
const CATEGORIES = [
  ['lebensmittel', 'Lebensmittel'],
  ['haushalt', 'Haushaltsartikel'],
  ['sprit', 'Sprit / Fahrtkosten'],
  ['werkzeug', 'Werkzeug / Material'],
  ['buero_doku', 'B\u00fcro / Doku'],
  ['ausflug', 'Ausflug / Eintritt'],
  ['sonstiges', 'Sonstiges']
];
const PLAN_STATUSES = [
  ['bedarf', 'Bedarf'],
  ['zu_pruefen', 'zu pr\u00fcfen'],
  ['freigegeben', 'freigegeben'],
  ['zu_kaufen', 'zu kaufen'],
  ['gekauft', 'gekauft'],
  ['gestrichen', 'gestrichen']
];
const EXPENSE_RECEIPTS = [
  ['fehlt', 'Beleg fehlt'],
  ['vorhanden', 'Beleg vorhanden'],
  ['pruefen', 'Beleg pr\u00fcfen']
];
const ACCOUNTING_STATUSES = [
  ['offen', 'offen'],
  ['vollstaendig', 'vollst\u00e4ndig'],
  ['zu_pruefen', 'zu pr\u00fcfen'],
  ['eingereicht', 'eingereicht'],
  ['verbucht', 'verbucht / erstattet']
];

const state = {
  client: null,
  session: null,
  profile: null,
  plans: [],
  expenses: [],
  participants: [],
  activeView: 'planning',
  installed: false,
  loading: false,
  error: ''
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', installFinanceModule);
} else {
  installFinanceModule();
}

function installFinanceModule() {
  if (state.installed) return;
  state.installed = true;
  injectStylesheet();
  ensureFinanceShell();
  bindFinanceUi();
  installShellWatcher();
  waitForApp();
}

function injectStylesheet() {
  if (document.querySelector('link[href^="./finance-module.css"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = './finance-module.css?v=finance-20260503-1';
  document.head.appendChild(link);
}

function waitForApp() {
  if (!document.getElementById('app')?.classList.contains('hidden')) {
    window.setTimeout(loadFinanceData, 0);
    return;
  }
  let checks = 0;
  const timer = window.setInterval(() => {
    checks += 1;
    ensureFinanceShell();
    if (!document.getElementById('app')?.classList.contains('hidden')) {
      window.clearInterval(timer);
      loadFinanceData();
    }
    if (checks > 80) window.clearInterval(timer);
  }, 250);
}

function installShellWatcher() {
  const timer = window.setInterval(() => {
    ensureFinanceShell();
    patchActiveTitle();
  }, 500);
  window.setTimeout(() => window.clearInterval(timer), 12000);
}

function ensureFinanceShell() {
  const tab = document.getElementById('ideasTab');
  if (!tab || document.getElementById('financeModule')) return;
  tab.innerHTML = `
    <div class="section-head">
      <div>
        <h3>Finanzen</h3>
        <p class="muted">Ausgabenplanung, Belege und Abrechnungsvorbereitung.</p>
      </div>
      <button class="btn small" type="button" id="financeRefresh">Neu laden</button>
    </div>
    <section id="financeModule" class="finance-module">
      <div class="finance-tabs" role="tablist" aria-label="Finanzbereiche">
        <button class="finance-tab active" type="button" data-finance-view="planning">Ausgaben / Beschaffungsplanung</button>
        <button class="finance-tab" type="button" data-finance-view="accounting">Buchhaltung</button>
      </div>
      <div id="financeNotice" class="finance-notice hidden"></div>
      <div id="financePlanningView" class="finance-view active"></div>
      <div id="financeAccountingView" class="finance-view"></div>
    </section>
  `;
}

function bindFinanceUi() {
  document.addEventListener('click', event => {
    if (event.target.closest('.nav-btn[data-tab="ideas"]')) {
      window.setTimeout(() => {
        ensureFinanceShell();
        patchActiveTitle();
      }, 60);
    }
    const tabButton = event.target.closest('[data-finance-view]');
    if (tabButton) {
      state.activeView = tabButton.dataset.financeView;
      renderFinance();
      return;
    }
    if (event.target.closest('#financeRefresh')) loadFinanceData();
    const statusButton = event.target.closest('[data-plan-status]');
    if (statusButton) updatePlanStatus(Number(statusButton.dataset.planId), statusButton.dataset.planStatus);
    const takeOver = event.target.closest('[data-plan-expense]');
    if (takeOver) prepareExpenseFromPlan(Number(takeOver.dataset.planExpense));
    if (event.target.closest('#financeExpenseExport')) exportExpensesCsv();
  });
  document.addEventListener('submit', event => {
    if (event.target?.id === 'financePlanForm') {
      event.preventDefault();
      savePlan(event.target);
    }
    if (event.target?.id === 'financeExpenseForm') {
      event.preventDefault();
      saveExpense(event.target);
    }
  });
}

async function loadFinanceData() {
  try {
    state.loading = true;
    state.error = '';
    renderFinance();
    const client = getClient();
    if (!client) throw new Error('Supabase-Konfiguration fehlt.');
    const { data: sessionData } = await getAuthSession(client);
    state.session = sessionData?.session || null;
    if (!state.session) throw new Error('Keine aktive Anmeldung gefunden.');
    const profileRes = await client.from('profiles').select('role,is_active,full_name,email').eq('id', state.session.user.id).single();
    if (profileRes.error) throw profileRes.error;
    state.profile = profileRes.data;

    const [plansRes, expensesRes, participantsRes] = await Promise.all([
      client.from('procurement_plans').select('*').order('needed_by', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false }),
      client.from('expenses').select('*').order('expense_date', { ascending: false }).order('created_at', { ascending: false }),
      client.from('participants').select('id,full_name').order('full_name')
    ]);
    const error = plansRes.error || expensesRes.error || participantsRes.error;
    if (error) throw error;
    state.plans = plansRes.data || [];
    state.expenses = expensesRes.data || [];
    state.participants = participantsRes.data || [];
  } catch (error) {
    console.error(error);
    state.error = error.message || String(error);
  } finally {
    state.loading = false;
    renderFinance();
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

function getAuthSession(client) {
  return window.getManheimAuthSession?.(client) || client.auth.getSession();
}

function renderFinance() {
  ensureFinanceShell();
  patchActiveTitle();
  document.querySelectorAll('[data-finance-view]').forEach(button => {
    button.classList.toggle('active', button.dataset.financeView === state.activeView);
  });
  document.getElementById('financePlanningView')?.classList.toggle('active', state.activeView === 'planning');
  document.getElementById('financeAccountingView')?.classList.toggle('active', state.activeView === 'accounting');
  renderNotice();
  renderPlanning();
  renderAccounting();
}

function patchActiveTitle() {
  const active = document.querySelector('.nav-btn.active[data-tab="ideas"]');
  if (!active) return;
  const title = document.getElementById('pageTitle');
  const subtitle = document.getElementById('pageSubtitle');
  if (title) title.textContent = 'Finanzen';
  if (subtitle) subtitle.textContent = 'Ausgabenplanung, Belege und Abrechnungsvorbereitung';
}

function renderNotice() {
  const notice = document.getElementById('financeNotice');
  if (!notice) return;
  if (state.loading) {
    notice.className = 'finance-notice';
    notice.textContent = 'Finanzdaten werden geladen ...';
    return;
  }
  if (state.error) {
    notice.className = 'finance-notice error';
    notice.innerHTML = `Finanzmodul konnte nicht geladen werden: ${escapeHtml(state.error)}<br><small>Falls die Tabellen noch fehlen: <code>supabase/finance_module.sql</code> in Supabase ausf\u00fchren.</small>`;
    return;
  }
  notice.className = 'finance-notice hidden';
  notice.textContent = '';
}

function renderPlanning() {
  const host = document.getElementById('financePlanningView');
  if (!host) return;
  const openPlans = state.plans.filter(plan => !['gekauft', 'gestrichen'].includes(plan.status));
  const soon = openPlans.filter(plan => plan.needed_by && daysDiff(plan.needed_by) <= 7).length;
  host.innerHTML = `
    <div class="finance-kpis">
      ${kpi('Offene Bedarfe', openPlans.length, 'noch nicht gekauft oder gestrichen')}
      ${kpi('N\u00e4chste 7 Tage', soon, 'ben\u00f6tigt bis bald')}
      ${kpi('Freigegeben', state.plans.filter(plan => plan.status === 'freigegeben' || plan.status === 'zu_kaufen').length, 'bereit zur Beschaffung')}
    </div>
    <div class="finance-grid">
      <section class="panel">
        <div class="panel-head"><h3>Bedarf erfassen</h3><span class="muted">Planung vor dem Einkauf</span></div>
        ${canEdit() ? planForm() : readonlyHint()}
      </section>
      <section class="panel">
        <div class="panel-head"><h3>Beschaffungsplanung</h3><span class="muted">${state.plans.length} Eintr\u00e4ge</span></div>
        <div class="stack-list">${state.plans.length ? state.plans.map(planCard).join('') : empty('Noch keine geplanten Ausgaben erfasst.')}</div>
      </section>
    </div>
  `;
}

function renderAccounting() {
  const host = document.getElementById('financeAccountingView');
  if (!host) return;
  const monthTotal = state.expenses.filter(isCurrentMonth).reduce((sum, expense) => sum + amount(expense.amount), 0);
  const missingReceipts = state.expenses.filter(expense => expense.receipt_status === 'fehlt').length;
  const openAccounting = state.expenses.filter(expense => !['eingereicht', 'verbucht'].includes(expense.accounting_status)).length;
  host.innerHTML = `
    <div class="finance-kpis">
      ${kpi('Summe aktueller Monat', formatMoney(monthTotal), 'get\u00e4tigte Ausgaben')}
      ${kpi('Belege fehlen', missingReceipts, 'm\u00fcssen nachgereicht werden')}
      ${kpi('Abrechnung offen', openAccounting, 'noch nicht eingereicht/verbucht')}
    </div>
    <div class="finance-grid">
      <section class="panel">
        <div class="panel-head"><h3>Ausgabe erfassen</h3><span class="muted">mit Belegstatus</span></div>
        ${canEdit() ? expenseForm() : readonlyHint()}
      </section>
      <section class="panel">
        <div class="panel-head"><h3>Buchhaltung</h3><button class="btn small" type="button" id="financeExpenseExport">CSV exportieren</button></div>
        ${expenseBreakdown()}
        <div class="stack-list finance-expense-list">${state.expenses.length ? state.expenses.map(expenseCard).join('') : empty('Noch keine Ausgaben verbucht.')}</div>
      </section>
    </div>
  `;
}

function planForm() {
  return `
    <form id="financePlanForm" class="form-grid finance-form">
      <label class="span-2">Titel<input name="title" required placeholder="z. B. Einkauf Teamk\u00fcche Woche 1"></label>
      <label>Kategorie<select name="category">${options(CATEGORIES)}</select></label>
      <label>Status<select name="status">${options(PLAN_STATUSES, 'bedarf')}</select></label>
      <label>Menge<input name="quantity" type="number" step="0.01" min="0"></label>
      <label>Einheit<input name="unit" placeholder="z. B. Stk., Liter, Einkauf"></label>
      <label>Ben\u00f6tigt bis<input name="needed_by" type="date"></label>
      <label>Priorit\u00e4t<select name="priority">${options([['hoch','hoch'],['mittel','mittel'],['niedrig','niedrig']], 'mittel')}</select></label>
      <label>Sch\u00e4tzung EUR<input name="estimated_amount" type="number" step="0.01" min="0"></label>
      <label>Zust\u00e4ndige Rolle<input name="responsible_role" placeholder="z. B. Assistenz"></label>
      <label class="span-2">Notiz<textarea name="note" rows="3" placeholder="Was muss gekauft/gekl\u00e4rt werden?"></textarea></label>
      <div class="span-2 button-row"><button class="btn primary" type="submit">Planung speichern</button></div>
    </form>
  `;
}

function expenseForm() {
  return `
    <form id="financeExpenseForm" class="form-grid finance-form">
      <input type="hidden" name="procurement_plan_id">
      <label>Datum<input name="expense_date" type="date" value="${todayIso()}" required></label>
      <label>Titel<input name="title" required placeholder="z. B. Supermarkt Einkauf"></label>
      <label>Kategorie<select name="category">${options(CATEGORIES)}</select></label>
      <label>Betrag EUR<input name="amount" type="number" step="0.01" min="0" required></label>
      <label>Bezahlt von<select name="paid_by_participant_id"><option value="">freie Eingabe</option>${state.participants.map(person => `<option value="${person.id}">${escapeHtml(person.full_name)}</option>`).join('')}</select></label>
      <label>Name Zahler/in<input name="paid_by_name" placeholder="falls nicht in Teilnehmerliste"></label>
      <label>Zahlungsart<select name="payment_method">${options([['bar','bar'],['karte','Karte'],['ueberweisung','\u00dcberweisung'],['privat_vorgestreckt','privat vorgestreckt'],['sonstiges','sonstiges']], 'privat_vorgestreckt')}</select></label>
      <label>Belegstatus<select name="receipt_status">${options(EXPENSE_RECEIPTS, 'fehlt')}</select></label>
      <label>Abrechnungsstatus<select name="accounting_status">${options(ACCOUNTING_STATUSES, 'offen')}</select></label>
      <label>Belegdatei<input name="receipt_file" type="file" accept="image/*,.pdf"></label>
      <label class="span-2">Beschreibung / Hinweis f\u00fcr Uni<textarea name="description" rows="3"></textarea></label>
      <div class="span-2 button-row"><button class="btn primary" type="submit">Ausgabe speichern</button></div>
    </form>
  `;
}

function planCard(plan) {
  return `
    <div class="list-item finance-card">
      <div class="item-head">
        <div>
          <div class="item-title">${escapeHtml(plan.title)}</div>
          <div class="item-meta">
            <span class="chip">${labelFor(CATEGORIES, plan.category)}</span>
            <span class="status ${statusClass(plan.status)}">${labelFor(PLAN_STATUSES, plan.status)}</span>
            <span class="chip">${escapeHtml(plan.priority || 'mittel')}</span>
            ${plan.needed_by ? `<span>bis ${formatDate(plan.needed_by)}</span>` : ''}
          </div>
        </div>
        <strong>${formatOptionalMoney(plan.estimated_amount)}</strong>
      </div>
      ${plan.note ? `<div class="muted finance-note">${escapeHtml(plan.note)}</div>` : ''}
      <div class="action-row">
        ${canEdit() ? PLAN_STATUSES.map(([value, label]) => `<button class="btn small" type="button" data-plan-id="${plan.id}" data-plan-status="${value}">${label}</button>`).join('') : ''}
        ${canEdit() ? `<button class="btn small primary-soft" type="button" data-plan-expense="${plan.id}">als Ausgabe verbuchen</button>` : ''}
      </div>
    </div>
  `;
}

function expenseCard(expense) {
  return `
    <div class="list-item finance-card">
      <div class="item-head">
        <div>
          <div class="item-title">${escapeHtml(expense.title)}</div>
          <div class="item-meta">
            <span>${formatDate(expense.expense_date)}</span>
            <span class="chip">${labelFor(CATEGORIES, expense.category)}</span>
            <span class="status ${receiptClass(expense.receipt_status)}">${labelFor(EXPENSE_RECEIPTS, expense.receipt_status)}</span>
            <span class="status ${accountingClass(expense.accounting_status)}">${labelFor(ACCOUNTING_STATUSES, expense.accounting_status)}</span>
          </div>
        </div>
        <strong>${formatMoney(expense.amount)}</strong>
      </div>
      <div class="muted finance-note">
        Bezahlt von: ${escapeHtml(expense.paid_by_name || nameForParticipant(expense.paid_by_participant_id) || '\u2013')}
        ${expense.description ? `<br>${escapeHtml(expense.description)}` : ''}
      </div>
    </div>
  `;
}

async function savePlan(form) {
  if (!canEdit()) return;
  const fd = new FormData(form);
  const payload = {
    title: clean(fd.get('title')),
    category: clean(fd.get('category')),
    status: clean(fd.get('status')) || 'bedarf',
    quantity: nullableNumber(fd.get('quantity')),
    unit: clean(fd.get('unit')) || null,
    needed_by: clean(fd.get('needed_by')) || null,
    priority: clean(fd.get('priority')) || 'mittel',
    estimated_amount: nullableNumber(fd.get('estimated_amount')),
    responsible_role: clean(fd.get('responsible_role')) || null,
    note: clean(fd.get('note')) || null,
    created_by: state.session.user.id
  };
  const { error } = await getClient().from('procurement_plans').insert(payload);
  if (error) return alert('Planung konnte nicht gespeichert werden: ' + error.message);
  form.reset();
  await loadFinanceData();
}

async function saveExpense(form) {
  if (!canEdit()) return;
  const fd = new FormData(form);
  let receiptPath = null;
  const file = fd.get('receipt_file');
  if (file && file.name) {
    receiptPath = await uploadReceipt(file);
  }
  const participantId = clean(fd.get('paid_by_participant_id'));
  const payload = {
    expense_date: clean(fd.get('expense_date')) || todayIso(),
    title: clean(fd.get('title')),
    category: clean(fd.get('category')),
    amount: Number(fd.get('amount') || 0),
    currency: 'EUR',
    paid_by_participant_id: participantId ? Number(participantId) : null,
    paid_by_name: clean(fd.get('paid_by_name')) || null,
    payment_method: clean(fd.get('payment_method')) || null,
    receipt_file_path: receiptPath,
    receipt_status: receiptPath ? 'vorhanden' : clean(fd.get('receipt_status')) || 'fehlt',
    accounting_status: clean(fd.get('accounting_status')) || 'offen',
    description: clean(fd.get('description')) || null,
    procurement_plan_id: clean(fd.get('procurement_plan_id')) ? Number(fd.get('procurement_plan_id')) : null,
    created_by: state.session.user.id
  };
  const { error } = await getClient().from('expenses').insert(payload);
  if (error) return alert('Ausgabe konnte nicht gespeichert werden: ' + error.message);
  if (payload.procurement_plan_id) {
    await getClient().from('procurement_plans').update({ status: 'gekauft' }).eq('id', payload.procurement_plan_id);
  }
  form.reset();
  await loadFinanceData();
}

async function uploadReceipt(file) {
  const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'beleg';
  const path = `${todayIso()}/${Date.now()}-${safe}`;
  const { error } = await getClient().storage.from('expense-receipts').upload(path, file, { upsert: false });
  if (error) throw new Error('Beleg konnte nicht hochgeladen werden: ' + error.message);
  return path;
}

async function updatePlanStatus(id, status) {
  if (!canEdit()) return;
  const { error } = await getClient().from('procurement_plans').update({ status }).eq('id', id);
  if (error) return alert('Status konnte nicht gespeichert werden: ' + error.message);
  await loadFinanceData();
}

function prepareExpenseFromPlan(id) {
  const plan = state.plans.find(item => Number(item.id) === Number(id));
  if (!plan) return;
  state.activeView = 'accounting';
  renderFinance();
  const form = document.getElementById('financeExpenseForm');
  if (!form) return;
  form.elements.procurement_plan_id.value = plan.id;
  form.elements.title.value = plan.title;
  form.elements.category.value = plan.category;
  form.elements.amount.value = plan.estimated_amount || '';
  form.elements.description.value = plan.note || '';
  form.elements.title.focus();
}

function expenseBreakdown() {
  if (!state.expenses.length) return '';
  const byCategory = sumBy(state.expenses, item => labelFor(CATEGORIES, item.category));
  const byPayer = sumBy(state.expenses, item => item.paid_by_name || nameForParticipant(item.paid_by_participant_id) || 'ohne Angabe');
  return `
    <div class="finance-breakdown">
      <div><strong>Nach Kategorie</strong>${Object.entries(byCategory).map(([key, value]) => `<span>${escapeHtml(key)}: ${formatMoney(value)}</span>`).join('')}</div>
      <div><strong>Nach Zahler/in</strong>${Object.entries(byPayer).map(([key, value]) => `<span>${escapeHtml(key)}: ${formatMoney(value)}</span>`).join('')}</div>
    </div>
  `;
}

function exportExpensesCsv() {
  const header = ['Datum','Titel','Kategorie','Betrag','Waehrung','Bezahlt von','Belegstatus','Abrechnungsstatus','Beschreibung'];
  const rows = state.expenses.map(expense => [
    expense.expense_date,
    expense.title,
    labelFor(CATEGORIES, expense.category),
    String(expense.amount || 0).replace('.', ','),
    expense.currency || 'EUR',
    expense.paid_by_name || nameForParticipant(expense.paid_by_participant_id) || '',
    labelFor(EXPENSE_RECEIPTS, expense.receipt_status),
    labelFor(ACCOUNTING_STATUSES, expense.accounting_status),
    expense.description || ''
  ]);
  const csv = [header, ...rows].map(row => row.map(csvCell).join(';')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `finanzen-buchhaltung-${todayIso()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function canEdit() {
  return Boolean(state.profile?.is_active) && MANAGER_ROLES.includes(state.profile?.role);
}
function kpi(label, value, note) {
  return `<div class="panel finance-kpi"><span>${escapeHtml(label)}</span><strong>${value}</strong><small>${escapeHtml(note)}</small></div>`;
}
function empty(text) {
  return `<div class="empty">${escapeHtml(text)}</div>`;
}
function readonlyHint() {
  return '<div class="empty">Dieser Finanzbereich ist f\u00fcr Leitungsrollen bearbeitbar.</div>';
}
function options(rows, selected = '') {
  return rows.map(([value, label]) => `<option value="${value}" ${value === selected ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('');
}
function labelFor(rows, value) {
  return rows.find(([key]) => key === value)?.[1] || value || '\u2013';
}
function nameForParticipant(id) {
  return state.participants.find(person => Number(person.id) === Number(id))?.full_name || '';
}
function sumBy(rows, keyFn) {
  return rows.reduce((acc, row) => {
    const key = keyFn(row);
    acc[key] = (acc[key] || 0) + amount(row.amount);
    return acc;
  }, {});
}
function amount(value) {
  return Number(value || 0);
}
function nullableNumber(value) {
  const text = clean(value);
  return text === '' ? null : Number(text);
}
function formatMoney(value) {
  return amount(value).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}
function formatOptionalMoney(value) {
  return value == null ? '' : formatMoney(value);
}
function statusClass(status) {
  return ['gekauft', 'freigegeben'].includes(status) ? 'erledigt' : status === 'gestrichen' ? 'blockiert' : 'laufend';
}
function receiptClass(status) {
  return status === 'vorhanden' ? 'erledigt' : status === 'fehlt' ? 'blockiert' : 'laufend';
}
function accountingClass(status) {
  return ['eingereicht', 'verbucht', 'vollstaendig'].includes(status) ? 'erledigt' : status === 'zu_pruefen' ? 'laufend' : 'offen';
}
function clean(value) {
  return String(value ?? '').trim();
}
function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
function isCurrentMonth(expense) {
  const value = String(expense.expense_date || '');
  return value.slice(0, 7) === todayIso().slice(0, 7);
}
function daysDiff(dateStr) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const other = new Date(String(dateStr).slice(0, 10) + 'T00:00:00');
  return Number.isNaN(other.getTime()) ? 9999 : Math.round((other - now) / 86400000);
}
function formatDate(value) {
  if (!value) return '\u2013';
  const date = new Date(String(value).slice(0, 10) + 'T00:00:00');
  return Number.isNaN(date.getTime()) ? '\u2013' : date.toLocaleDateString('de-DE');
}
function csvCell(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}
function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

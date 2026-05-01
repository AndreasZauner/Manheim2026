import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const MANAGER_ROLES = ['admin', 'professor', 'technical_lead', 'assistant'];
const NAV = {
  dashboard: ['Leitstand', 'Tageslage, Prioritäten, Klärungsbedarf und Risiken'],
  participants: ['Personal', 'Personaleinsatz, Zeiträume, Verbindlichkeit und Hinweise'],
  mindmap: ['Feld & Doku', 'Projektkarte, Dokumentation, Feldstruktur und Fortschritt'],
  tasks: ['Infrastruktur', 'Ressourcen, Logistik und operative Aufgaben'],
  ideas: ['Finanzen', 'Beschaffung, offene Kostenpunkte und vorgemerkte Hinweise'],
  admin: ['Verwaltung', 'Rollen, Freischaltungen und Systemeinstellungen']
};
const SPECIAL_FUNCTIONS = [
  'Laser-Aided-Profiler für Keramikerfassung',
  'Tierknochen',
  'Makroreste'
];

const state = {
  client: null,
  userId: null,
  isManager: false,
  authListenerBound: false,
  checks: 0
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', installV21Phase12);
} else {
  installV21Phase12();
}

async function installV21Phase12() {
  if (window.__v21Phase12Installed) return;
  window.__v21Phase12Installed = true;
  injectStylesheet();
  setupSupabase();
  bindAuthStateListener();
  await loadUser();
  applyV21Shell();
  installShortStabilizer();
}

function injectStylesheet() {
  if (document.querySelector('link[href^="./v21-phase12-module.css"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = './v21-phase12-module.css?v=v21-phase12-1';
  document.head.appendChild(link);
}

function setupSupabase() {
  const config = window.APP_CONFIG || {};
  if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) return;
  state.client = window.getManheimSupabaseClient?.(createClient) || createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
}

async function loadUser() {
  if (!state.client) {
    state.userId = null;
    state.isManager = false;
    return;
  }
  const { data: sessionData } = await state.client.auth.getSession();
  state.userId = sessionData?.session?.user?.id || null;
  if (!state.userId) {
    state.isManager = false;
    return;
  }
  const { data, error } = await state.client.from('profiles').select('role,is_active').eq('id', state.userId).single();
  if (error) {
    state.isManager = false;
    return;
  }
  state.isManager = Boolean(data?.is_active) && MANAGER_ROLES.includes(data?.role);
}

function bindAuthStateListener() {
  if (!state.client || state.authListenerBound) return;
  state.authListenerBound = true;
  state.client.auth.onAuthStateChange(async event => {
    if (event === 'SIGNED_OUT') {
      state.userId = null;
      state.isManager = false;
      applyV21Shell();
      return;
    }
    if (['SIGNED_IN', 'TOKEN_REFRESHED', 'USER_UPDATED', 'INITIAL_SESSION'].includes(event)) {
      await loadUser();
      applyV21Shell();
    }
  });
}

function installShortStabilizer() {
  const timer = window.setInterval(async () => {
    state.checks += 1;
    if (!state.userId) await loadUser();
    applyV21Shell();
    if (state.checks > 16) window.clearInterval(timer);
  }, 500);
}

function applyV21Shell() {
  normalizeNavigation();
  enhanceLeitstand();
  enhancePersonal();
  enhanceAreaLabels();
}

function normalizeNavigation() {
  document.querySelectorAll('.nav-btn').forEach(button => {
    const tab = button.dataset.tab;
    const meta = NAV[tab];
    button.classList.toggle('v21-hidden-nav', !meta);
    if (meta && button.textContent !== meta[0]) button.textContent = meta[0];
    if (meta && button.dataset.v21ClickBound !== 'true') {
      button.dataset.v21ClickBound = 'true';
      button.addEventListener('click', () => window.setTimeout(() => {
        normalizeNavigation();
        updatePageTitle(tab);
        enhanceLeitstand();
        enhanceAreaLabels();
      }, 40));
    }
  });
  const active = document.querySelector('.nav-btn.active')?.dataset.tab;
  if (active) updatePageTitle(active);
}

function updatePageTitle(tab) {
  const meta = NAV[tab];
  if (!meta) return;
  const title = document.getElementById('pageTitle');
  const subtitle = document.getElementById('pageSubtitle');
  if (title && title.textContent !== meta[0]) title.textContent = meta[0];
  if (subtitle && subtitle.textContent !== meta[1]) subtitle.textContent = meta[1];
}

function enhanceLeitstand() {
  const dashboard = document.getElementById('dashboardTab');
  if (!dashboard) return;
  if (!document.getElementById('v21LeitstandIntro')) {
    const intro = document.createElement('section');
    intro.id = 'v21LeitstandIntro';
    intro.className = 'panel v21-leitstand-intro';
    intro.innerHTML = `
      <div class="panel-head"><h3>1.1 Tages- und Wochenlage</h3><span class="muted">aus bestehenden Projektkennzahlen</span></div>
      <p class="muted">Der Leitstand bündelt Tageslage, Prioritäten, offene Punkte, Terminrahmen und Risiken, ohne neue Pflichtlogik einzuführen.</p>
    `;
    dashboard.prepend(intro);
  }
  setPanelTitle('upcomingList', '1.2 Prioritäten / Als Nächstes', 'die nächsten relevanten Aufgaben');
  setPanelTitle('staffAlerts', '1.3 Offene Punkte / Klärungsbedarf', 'Personal, Aufgaben und Notizen mit Nachsteuerungsbedarf');
  setPanelTitle('cockpitGrid', '1.5 Risiken / Ampel-Cockpit', 'schneller Führungsüberblick');
  const roleCards = document.getElementById('roleCards');
  const hasPhaseOverview = roleCards?.querySelector('[data-v21-phase-overview-panel="true"]');
  if (roleCards && !hasPhaseOverview) {
    setPanelTitle('roleCards', '1.4 Termin- und Phasenüberblick', 'Grabungszeitraum und Arbeitsphasen');
    roleCards.classList.add('v21-phase-grid');
    roleCards.innerHTML = [
      ['Vorbereitung', 'bis 26.07.2026', 'Personal, Logistik, Infrastruktur, Rollen und Datenlage klären.'],
      ['Feldphase', '27.07.–09.10.2026', 'Tagessteuerung, Dokumentation, Sicherheit und Prioritäten verfolgen.'],
      ['Nachbereitung', 'ab 10.10.2026', 'Abschlussdokumentation, offene Punkte und Auswertung bündeln.']
    ].map(([title, date, text]) => `
      <div class="role-card v21-phase-card" data-v21-phase-overview-panel="true">
        <strong>${title}</strong>
        <span class="v21-phase-date">${date}</span>
        <span class="muted">${text}</span>
      </div>
    `).join('');
  }
}

function setPanelTitle(hostId, titleText, mutedText) {
  const panel = document.getElementById(hostId)?.closest('.panel');
  const title = panel?.querySelector('.panel-head h3');
  const muted = panel?.querySelector('.panel-head .muted');
  if (title && title.textContent !== titleText) title.textContent = titleText;
  if (muted && muted.textContent !== mutedText) muted.textContent = mutedText;
}

function enhanceAreaLabels() {
  setSectionHead('mindmapTab', 'Feld & Doku', 'Projektkarte, Feldstruktur, Dokumentationshinweise und Fortschritt.');
  setSectionHead('tasksTab', 'Infrastruktur', 'Operative Aufgaben mit Schwerpunkt Ressourcen, Logistik und Tagesbetrieb.');
  setSectionHead('ideasTab', 'Finanzen & Beschaffung', 'Offene Kostenpunkte, Beschaffungsideen und Hinweise für Phase 3 vorbereiten.');
  setSectionHead('adminTab', 'Verwaltung', 'Rollen, Freischaltungen und Systemeinstellungen bleiben geschützt.');
}

function setSectionHead(tabId, titleText, subtitleText) {
  const head = document.querySelector(`#${tabId} .section-head`);
  const title = head?.querySelector('h3');
  const subtitle = head?.querySelector('.muted, p');
  if (title && title.textContent !== titleText) title.textContent = titleText;
  if (subtitle && subtitle.textContent !== subtitleText) subtitle.textContent = subtitleText;
}

function enhancePersonal() {
  const head = document.querySelector('#participantsTab .section-head');
  if (head) {
    head.querySelector('h3')?.replaceChildren(document.createTextNode('Personaleinsatz'));
    head.querySelector('.muted, p')?.replaceChildren(document.createTextNode('Zeiträume, Verbindlichkeit, Hinweise, Kontaktfreigaben und Sonderfunktionen.'));
  }
  const controls = document.querySelector('.personnel-controls');
  if (!state.isManager) {
    document.getElementById('openV21PersonDrawer')?.remove();
  }
  if (controls && state.isManager && !document.getElementById('openV21PersonDrawer')) {
    controls.insertAdjacentHTML('beforeend', '<button class="btn primary" type="button" id="openV21PersonDrawer">Neue Person</button>');
    document.getElementById('openV21PersonDrawer')?.addEventListener('click', openDrawer);
  }
  if (!document.getElementById('v21PersonDrawer')) {
    document.body.insertAdjacentHTML('beforeend', drawerMarkup());
    bindDrawer();
  }
}

function drawerMarkup() {
  const options = SPECIAL_FUNCTIONS.map(value => `<option value="${escapeHtml(value)}"></option>`).join('');
  return `
    <div class="personnel-drawer-backdrop" id="v21PersonDrawerBackdrop"></div>
    <aside class="personnel-drawer" id="v21PersonDrawer" aria-label="Neue Person anlegen">
      <div class="personnel-drawer-header">
        <div><h3>Neue Person anlegen</h3><p>Kompakte Eingabe für Personaleinsatz und Kontaktdaten.</p></div>
        <button class="personnel-close" id="closeV21PersonDrawer" type="button" aria-label="Schließen">×</button>
      </div>
      <form id="v21PersonForm" class="personnel-drawer-body">
        <label class="full">Name<input class="personnel-field" name="full_name" required></label>
        <label class="full">Rolle<input class="personnel-field" name="public_role" placeholder="Teilnehmende / Assistenz / Schnittleitung"></label>
        <label>Status<select class="personnel-field" name="status"><option value="zugesagt">zugesagt</option><option value="gesetzt">gesetzt</option><option value="zu_klären">zu klären</option><option value="anzufragen">anzufragen</option></select></label>
        <label>Verfügbarkeit von<input class="personnel-field" name="availability_from" type="date"></label>
        <label>Verfügbarkeit bis<input class="personnel-field" name="availability_to" type="date"></label>
        <label>Telefon<input class="personnel-field" name="phone" placeholder="nur intern sichtbar"></label>
        <label>E-Mail<input class="personnel-field" name="email" type="email" placeholder="nur intern sichtbar"></label>
        <label class="full">Zusatzfunktion / Sonderrolle<input class="personnel-field" name="special_function" list="v21SpecialFunctions" placeholder="z. B. Tierknochen"></label>
        <datalist id="v21SpecialFunctions">${options}</datalist>
        <label class="full">Öffentliche Bemerkung<textarea class="personnel-field area" name="availability_note"></textarea></label>
        <label class="full">Interne Notiz<textarea class="personnel-field area" name="internal_note"></textarea></label>
        <div class="personnel-drawer-footer full">
          <button class="btn" type="button" id="cancelV21PersonDrawer">Abbrechen</button>
          <button class="btn primary" type="submit">Person speichern</button>
        </div>
      </form>
    </aside>
  `;
}

function bindDrawer() {
  document.getElementById('closeV21PersonDrawer')?.addEventListener('click', closeDrawer);
  document.getElementById('cancelV21PersonDrawer')?.addEventListener('click', closeDrawer);
  document.getElementById('v21PersonDrawerBackdrop')?.addEventListener('click', closeDrawer);
  document.getElementById('v21PersonForm')?.addEventListener('submit', savePerson);
}

function openDrawer() {
  document.getElementById('v21PersonDrawer')?.classList.add('open');
  document.getElementById('v21PersonDrawerBackdrop')?.classList.add('open');
  document.querySelector('#v21PersonForm [name="full_name"]')?.focus();
}

function closeDrawer() {
  document.getElementById('v21PersonDrawer')?.classList.remove('open');
  document.getElementById('v21PersonDrawerBackdrop')?.classList.remove('open');
}

async function savePerson(event) {
  event.preventDefault();
  if (!state.userId || !state.isManager) {
    await loadUser();
    applyV21Shell();
  }
  if (!state.client || !state.userId || !state.isManager) return;
  const form = new FormData(event.currentTarget);
  const special = String(form.get('special_function') || '').trim();
  const participant = {
    full_name: String(form.get('full_name') || '').trim(),
    public_role: String(form.get('public_role') || '').trim() || 'Teilnehmende',
    status: String(form.get('status') || 'zugesagt'),
    availability_from: String(form.get('availability_from') || '').trim() || null,
    availability_to: String(form.get('availability_to') || '').trim() || null,
    availability_note: String(form.get('availability_note') || '').trim() || null,
    source_note: ['Manuell in v2.1-Personal angelegt.', special ? `Zusatzfunktion: ${special}` : ''].filter(Boolean).join(' '),
    created_by: state.userId
  };
  const { data, error } = await state.client.from('participants').insert(participant).select('id').single();
  if (error) return alert('Person konnte nicht gespeichert werden: ' + error.message);
  const privatePayload = {
    participant_id: data.id,
    phone: String(form.get('phone') || '').trim() || null,
    email: String(form.get('email') || '').trim() || null,
    internal_note: String(form.get('internal_note') || '').trim() || null
  };
  const { error: privateError } = await state.client.from('participant_private').insert(privatePayload);
  if (privateError) return alert('Kontaktdaten konnten nicht gespeichert werden: ' + privateError.message);
  event.currentTarget.reset();
  closeDrawer();
  document.getElementById('refreshButton')?.click();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

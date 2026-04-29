
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const APP_CONFIG = window.APP_CONFIG || {};
const SUPABASE_URL = APP_CONFIG.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = APP_CONFIG.SUPABASE_ANON_KEY || '';
const PROJECT_SLUG = APP_CONFIG.PROJECT_SLUG || 'lehrgrabung-kerpen-manheim-2026';
const seedData = {"tasks": [{"title": "Offene Verfügbarkeiten und Zusagen mit Teilnehmenden klären", "description": "Unklare Zusagen, Zusatzwochen und Sonderfälle aus der Teilnehmerübersicht nachfassen.", "category": "personal", "subcategory": "Teilnehmendenmanagement", "due_date": "2026-05-08", "status": "offen", "priority": "hoch", "assigned_role": "Technische Leitung"}, {"title": "Schnittleiter benennen und Einsatzbereiche vorstrukturieren", "description": "Schnitte/Teilflächen und Lehrverantwortung pro Schnittleiter definieren.", "category": "schnitte", "subcategory": "Feldorganisation", "due_date": "2026-05-15", "status": "offen", "priority": "hoch", "assigned_role": "Technische Leitung"}, {"title": "Grabungsbüro in Kerpen sichern und Einrichtungsplan erstellen", "description": "Arbeitsplätze, Lager, Druck/Scan, Fundannahme, Strom und Internet festlegen.", "category": "logistik", "subcategory": "Grabungsbüro", "due_date": "2026-05-22", "status": "offen", "priority": "hoch", "assigned_role": "Technische Leitung"}, {"title": "Warnwestenbedarf und Größen erfassen", "description": "Stückzahlen nach Rollen, Größenmix und Druckvarianten für Team und Leitungsfunktionen festlegen.", "category": "logistik", "subcategory": "Ausstattung", "due_date": "2026-05-26", "status": "offen", "priority": "mittel", "assigned_role": "Technische Leitung"}, {"title": "Dokumentationssystem finalisieren", "description": "Nummernkreise, Befundblätter, Foto-Logik, Freigaben und QC-Prozess mit Assistenz festziehen.", "category": "dokumentation", "subcategory": "Standards", "due_date": "2026-06-05", "status": "offen", "priority": "hoch", "assigned_role": "Assistenz / Doku-QS"}, {"title": "Material- und Geräteinventar prüfen", "description": "Werkzeug, Kamera, Ladegeräte, Messausstattung, Fundmaterial, Regale und Verbrauchsmaterial erfassen.", "category": "logistik", "subcategory": "Material", "due_date": "2026-06-12", "status": "offen", "priority": "hoch", "assigned_role": "Technische Leitung"}, {"title": "Transport- und Pendelplan Buir–Kerpen–Manheim erstellen", "description": "Fahrzeuge, Fahrer, Schlüssel, Abfahrtszeiten und Materialtransport definieren.", "category": "logistik", "subcategory": "Transport", "due_date": "2026-06-19", "status": "offen", "priority": "mittel", "assigned_role": "Technische Leitung"}, {"title": "Onboarding-Paket für Studierende fertigstellen", "description": "Hausregeln, Tagesablauf, Sicherheitsunterweisung, Schnittzuweisung und Ansprechpersonen bündeln.", "category": "personal", "subcategory": "Onboarding", "due_date": "2026-06-26", "status": "offen", "priority": "mittel", "assigned_role": "Technische Leitung"}, {"title": "Leitungsbriefing mit Assistent und Schnittleitern vorbereiten", "description": "Berichtslinien, Freigabepunkte und tägliche Besprechungsstruktur vor Saisonbeginn testen.", "category": "steuerung", "subcategory": "Leitungsstruktur", "due_date": "2026-07-03", "status": "offen", "priority": "mittel", "assigned_role": "Technische Leitung"}, {"title": "Sicherheits- und Notfallstruktur einsatzfähig machen", "description": "Erste Hilfe, Notfallkontakte, Hitze-/Wetterregime und Feldkommunikation praktisch vorbereiten.", "category": "sicherheit", "subcategory": "Notfall", "due_date": "2026-07-10", "status": "offen", "priority": "hoch", "assigned_role": "Technische Leitung"}, {"title": "Einrichtungswoche starten", "description": "Haus, Büro, Lager, Nummernkreise, Materialwege und Einweisungen live anfahren.", "category": "steuerung", "subcategory": "Grabungsstart", "due_date": "2026-07-27", "status": "offen", "priority": "hoch", "assigned_role": "Technische Leitung"}, {"title": "Abschlussstrategie zwei Wochen vor Ende aktivieren", "description": "Keine neuen Großflächen ohne Abschlusskapazität; Doku- und Fundrückstände abbauen.", "category": "steuerung", "subcategory": "Abschluss", "due_date": "2026-09-25", "status": "offen", "priority": "hoch", "assigned_role": "Technische Leitung"}], "notes": [{"title": "Rollenmodell der Grabung", "body": "Professor übernimmt Amtsebene und rechtlich-organisatorische Außenebene. Technische Grabungsleitung steuert operativ. Assistenz überwacht Dokumentationsqualität. Schnittleiter lehren im Feld. Studierende arbeiten unter Anleitung.", "category": "steuerung", "subcategory": "Leitungsstruktur", "note_type": "decision", "status": "aktiv"}, {"title": "Untersuchungsschwerpunkte", "body": "Antoniterhof Priorität 1, Hofkapelle Priorität 2, Erweiterung Richtung historischer Marktplatz Priorität 3, römische Grabenstruktur/Villa-rustica-Frage Priorität 4, Eremitage optional nachrangig.", "category": "schnitte", "subcategory": "Flächenpriorisierung", "note_type": "note", "status": "aktiv"}, {"title": "Unterkunft und Infrastruktur", "body": "Grabungshaus in Kerpen-Buir ist als Unterkunft gesetzt. Grabungsbüro in Kerpen muss einsatzfähig eingerichtet werden. Wohn- und Arbeitsfunktionen klar trennen.", "category": "logistik", "subcategory": "Infrastruktur", "note_type": "note", "status": "aktiv"}, {"title": "Dokumentationsprinzip", "body": "Kein Profilabbau und kein Befundabschluss ohne dokumentarische Freigabe. Assistenz kontrolliert täglich Nummernkreise, Befundblätter, Fotos, Pläne und Nachdokumentation.", "category": "dokumentation", "subcategory": "Freigaben", "note_type": "decision", "status": "aktiv"}, {"title": "Lehrgrabungsprinzip", "body": "Schnittleiter sind nicht nur Aufsicht, sondern didaktische Anleiter. Lernaufgaben, qualitätskritische Aufgaben und zeitkritische Aufgaben müssen bewusst getrennt werden.", "category": "personal", "subcategory": "Lehre", "note_type": "decision", "status": "aktiv"}, {"title": "Tägliche Leitungsroutine", "body": "Morgens Leitungsbriefing, tagsüber Rundgänge und Rückmeldungen aus allen Schnitten, abends Kurz-Auswertung mit offenen Punkten und Plan für den Folgetag.", "category": "steuerung", "subcategory": "Tagesbetrieb", "note_type": "note", "status": "aktiv"}, {"title": "Teilnehmendenlage laut Auswertung", "body": "Bisher 16 Personen in der Übersicht; Maximalbelegung laut Auswertungsblatt 10 gleichzeitig, Durchschnitt 4,4 aktive Teilnehmende.", "category": "personal", "subcategory": "Kapazität", "note_type": "note", "status": "aktiv"}, {"title": "Offene Personalfälle", "body": "Zu klären sind u. a. Arbeitgeberfreigabe Rudolf Jürgens, Verlängerungsoption Jakob Redepenning, Sardinien-Pause Jakob Hetesy, Datumsangaben Finn Fesq und Phil Föckersperger.", "category": "personal", "subcategory": "Offene Punkte", "note_type": "idea", "status": "offen"}, {"title": "Warnwesten und Außenauftritt", "body": "Bestellung hochwertiger, aber preisgünstiger Warnwesten mit Schriftzug und Unilogo als separates Beschaffungspaket einplanen.", "category": "logistik", "subcategory": "Ausstattung", "note_type": "idea", "status": "offen"}], "participants": [{"full_name": "Yva Stamminger", "public_role": "Teilnehmende", "availability_from": "2026-08-10", "availability_to": "2026-08-28", "status": "zugesagt", "availability_note": "Auch andere Termine möglich; nicht 31.08.–04.09.", "source_note": "Aus Teilnehmerübersicht übernommen."}, {"full_name": "Mijana Terzic-Tanaskovic", "public_role": "Teilnehmende", "availability_from": "2026-08-03", "availability_to": "2026-08-28", "status": "zugesagt", "availability_note": "Auch ab 01.08 möglich; evtl. bis 31.08.", "source_note": "Aus Teilnehmerübersicht übernommen."}, {"full_name": "Verena Laubenbacher", "public_role": "Teilnehmende", "availability_from": "2026-08-03", "availability_to": "2026-08-24", "status": "zugesagt", "availability_note": "", "source_note": "Aus Teilnehmerübersicht übernommen."}, {"full_name": "Anton Bönisch", "public_role": "Teilnehmende", "availability_from": "2026-08-10", "availability_to": "2026-09-04", "status": "zugesagt", "availability_note": "", "source_note": "Aus Teilnehmerübersicht übernommen."}, {"full_name": "Rudolf Jürgens", "public_role": "Teilnehmende", "availability_from": "2026-07-27", "availability_to": "2026-08-14", "status": "zu_klären", "availability_note": "Finale Abklärung mit dem Arbeitgeber steht noch aus.", "source_note": "Aus Teilnehmerübersicht übernommen."}, {"full_name": "Marie Doetkotte", "public_role": "Teilnehmende", "availability_from": "2026-07-27", "availability_to": "2026-08-14", "status": "zugesagt", "availability_note": "", "source_note": "Aus Teilnehmerübersicht übernommen."}, {"full_name": "Moritz Frimberger", "public_role": "Teilnehmende", "availability_from": "2026-08-03", "availability_to": "2026-08-23", "status": "zugesagt", "availability_note": "Auch spätere Termine möglich; nicht möglich am 12.09.", "source_note": "Aus Teilnehmerübersicht übernommen."}, {"full_name": "Jakob Redepenning", "public_role": "Teilnehmende", "availability_from": "2026-07-27", "availability_to": "2026-08-16", "status": "zu_klären", "availability_note": "Möglicherweise auch länger; Prüfungsleistungen anderer Kurse noch offen.", "source_note": "Aus Teilnehmerübersicht übernommen."}, {"full_name": "Alexander Voßberg", "public_role": "Teilnehmende", "availability_from": "2026-09-09", "availability_to": "2026-09-30", "status": "zugesagt", "availability_note": "Erste Ausgrabung.", "source_note": "Aus Teilnehmerübersicht übernommen."}, {"full_name": "Claudia Heindl", "public_role": "Teilnehmende", "availability_from": "2026-08-29", "availability_to": "2026-09-19", "status": "zugesagt", "availability_note": "Zusatzwoche noch flexibel planbar.", "source_note": "Aus Teilnehmerübersicht übernommen."}, {"full_name": "Clara Hausberg", "public_role": "Teilnehmende", "availability_from": "2026-08-08", "availability_to": "2026-09-19", "status": "zugesagt", "availability_note": "Erste Ausgrabung.", "source_note": "Aus Teilnehmerübersicht übernommen."}, {"full_name": "Jakob Hetesy", "public_role": "Teilnehmende", "availability_from": "2026-08-03", "availability_to": "2026-10-09", "status": "zu_klären", "availability_note": "Pause mittendrin wegen Sardinien-Exkursion; genaue Daten offen.", "source_note": "Aus Teilnehmerübersicht übernommen."}, {"full_name": "Finn Fesq", "public_role": "Teilnehmende / Spezialbereich Tierknochen", "availability_from": null, "availability_to": null, "status": "zu_klären", "availability_note": "Angaben im Original uneinheitlich: 17.08.–29.08. sowie 05.–09.10. genannt.", "source_note": "Aus Teilnehmerübersicht übernommen."}, {"full_name": "Andreas Zauner", "public_role": "Technische Grabungsleitung", "availability_from": "2026-07-27", "availability_to": "2026-10-09", "status": "gesetzt", "availability_note": "Durchgehend eingeplant.", "source_note": "Aus Teilnehmerübersicht übernommen."}, {"full_name": "Niklas Mahler", "public_role": "Assistenz technische Grabungsleitung", "availability_from": "2026-07-27", "availability_to": "2026-10-09", "status": "gesetzt", "availability_note": "Durchgehend eingeplant.", "source_note": "Aus Teilnehmerübersicht übernommen."}, {"full_name": "Phil Föckersperger", "public_role": "Teilnehmende / angefragt", "availability_from": null, "availability_to": "2026-09-11", "status": "anzufragen", "availability_note": "Telefon wird angefragt; Startdatum in der Übersicht unklar.", "source_note": "Aus Teilnehmerübersicht übernommen."}], "participantPrivate": [{"full_name": "Yva Stamminger", "phone": "017318192921", "email": "y.stamminger@campus.lmu.de", "internal_note": ""}, {"full_name": "Mijana Terzic-Tanaskovic", "phone": "015129461434", "email": "Mij.Terzic@campus.lmu.de", "internal_note": ""}, {"full_name": "Verena Laubenbacher", "phone": "015754999316", "email": "V.Laubenbacher@campus.lmu.de", "internal_note": ""}, {"full_name": "Anton Bönisch", "phone": "015255928551", "email": "Anton.boenisch@gmx.de", "internal_note": ""}, {"full_name": "Rudolf Jürgens", "phone": "015259962848", "email": "Juergens.ru@campus.lmu.de", "internal_note": "Teilnahme noch nicht final bestätigt."}, {"full_name": "Marie Doetkotte", "phone": "015140118314", "email": "Ma.Doetkotte@campus.lmu.de", "internal_note": ""}, {"full_name": "Moritz Frimberger", "phone": "01783022646", "email": "Moritz.frimberger@t-online.de", "internal_note": ""}, {"full_name": "Jakob Redepenning", "phone": "017620009004", "email": "Jakob@Redepenning.com", "internal_note": "Option auf Verlängerung prüfen."}, {"full_name": "Alexander Voßberg", "phone": "015120534339", "email": "Alex.vossberg@posteo.de", "internal_note": ""}, {"full_name": "Claudia Heindl", "phone": "01743224706", "email": "Claudiaheindl753@gmail.com", "internal_note": ""}, {"full_name": "Clara Hausberg", "phone": "01701446818", "email": "clarahausberg@yahoo.de", "internal_note": ""}, {"full_name": "Jakob Hetesy", "phone": "016096462764", "email": "Jakob@hetesy.eu", "internal_note": "Pausenfenster nachtragen."}, {"full_name": "Finn Fesq", "phone": "01726777901", "email": "f.fesq@campus.lmu.de", "internal_note": "Genauen Einsatzplan klären."}, {"full_name": "Andreas Zauner", "phone": "015561547828", "email": "andreas-zauner@gmx.de", "internal_note": ""}, {"full_name": "Niklas Mahler", "phone": "015738137548", "email": "mahler1994niklas@web.de", "internal_note": ""}, {"full_name": "Phil Föckersperger", "phone": "wird angefragt", "email": "phil.foeckersperger@gmail.com", "internal_note": "Startdatum und Teilnahme final klären."}]};

const CATEGORY_META = {
  steuerung: { label: 'Steuerung', colorClass: 'steuerung' },
  personal: { label: 'Personal', colorClass: 'personal' },
  dokumentation: { label: 'Dokumentation', colorClass: 'dokumentation' },
  schnitte: { label: 'Schnitte', colorClass: 'schnitte' },
  logistik: { label: 'Logistik', colorClass: 'logistik' },
  funde: { label: 'Funde', colorClass: 'funde' },
  sicherheit: { label: 'Sicherheit', colorClass: 'sicherheit' },
  schnittstelle_amt: { label: 'Schnittstelle Amt', colorClass: 'amt' }
};

const ROLE_META = {
  admin: 'Admin',
  professor: 'Professor',
  technical_lead: 'Technische Leitung',
  assistant: 'Assistenz / Doku-QS',
  trench_lead: 'Schnittleitung',
  participant: 'Teilnehmende',
  viewer: 'Lesend'
};

const ROLE_DESCRIPTIONS = {
  professor: 'Amtsebene, institutionelle Außenkommunikation und formale Rahmenebene',
  technical_lead: 'operative Gesamtsteuerung, Freigaben, Prioritäten, Tagesbetrieb',
  assistant: 'Dokumentationskontrolle, Qualitätsprüfung, tägliche Nachsteuerung',
  trench_lead: 'Feldanleitung in den Schnitten und direkte Betreuung der Studierenden',
  participant: 'Mitarbeit, Rückmeldung, Lernbetrieb und zugewiesene Aufgaben'
};

const MINDMAP_BRANCHES = {
  steuerung: ['Leitungsstruktur', 'Tagesbetrieb', 'Abschluss', 'Berichtslinien'],
  personal: ['Teilnehmendenmanagement', 'Onboarding', 'Lehre', 'Kapazität', 'Offene Punkte'],
  dokumentation: ['Standards', 'Freigaben', 'Qualitätskontrolle'],
  schnitte: ['Flächenpriorisierung', 'Feldorganisation', 'Antoniterhof', 'Hofkapelle', 'Marktplatz', 'Römische Struktur'],
  logistik: ['Infrastruktur', 'Grabungsbüro', 'Transport', 'Material', 'Ausstattung'],
  funde: ['Fundbearbeitung', 'Proben', 'Datenbank'],
  sicherheit: ['Notfall', 'Hitze/Wetter', 'Unterweisung'],
  schnittstelle_amt: ['Professor als Schnittstelle', 'Rückmeldungen']
};

const state = {
  supabase: null,
  session: null,
  profile: null,
  tasks: [],
  notes: [],
  participants: [],
  participantPrivate: [],
  profiles: [],
  activeTab: 'dashboard',
  calendarOffset: 0
};

const els = {};
document.addEventListener('DOMContentLoaded', init);

async function init() {
  cacheEls();
  bindStaticUi();
  fillSelects();

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    showSetupBanner('Die Datei ist noch nicht mit Supabase verbunden. Öffnen Sie <code>config.js</code>, tragen Sie URL und Anon Key ein und laden Sie die Seite neu.');
    els.authMessage.innerHTML = 'Konfiguration fehlt. Bitte zuerst <code>config.js</code> aus <code>config.example.js</code> erstellen.';
    return;
  }

  state.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  const { data: { session } } = await state.supabase.auth.getSession();
  state.session = session;

  state.supabase.auth.onAuthStateChange(async (_event, sessionNow) => {
    state.session = sessionNow;
    if (sessionNow) await bootstrapApp();
    else showAuth();
  });

  if (state.session) await bootstrapApp();
  else showAuth();
}

function cacheEls() {
  [
    'setupBanner','authScreen','pendingScreen','app','authMessage','loginForm','signupForm','magicForm',
    'sidebarUserName','sidebarUserRole','pageTitle','pageSubtitle','syncState','kpiGrid','upcomingList','cockpitGrid','roleCards','staffAlerts',
    'mindmapGrid','taskCategoryFilter','taskStatusFilter','taskForm','taskFormCategory','taskSuggestionBox','taskList',
    'calendarGrid','calendarLabel','participantsBody','participantsHead','participantsSummary','participantForm','participantFormPanel',
    'ideaForm','ideaFormCategory','ideaSuggestionBox','ideaList','profilesBody','adminInfoList','seedButton','refreshButton','exportButton','adminTabButton'
  ].forEach(id => els[id] = document.getElementById(id));
}

function bindStaticUi() {
  document.querySelectorAll('.nav-btn').forEach(btn => btn.addEventListener('click', () => setTab(btn.dataset.tab)));
  document.querySelectorAll('.auth-tab').forEach(btn => btn.addEventListener('click', () => switchAuthTab(btn.dataset.authTab)));
  document.getElementById('signOutButton').addEventListener('click', signOut);
  document.getElementById('signOutPending').addEventListener('click', signOut);
  document.getElementById('pendingRefresh').addEventListener('click', bootstrapApp);
  document.getElementById('prevMonth').addEventListener('click', () => { state.calendarOffset--; renderCalendar(); });
  document.getElementById('nextMonth').addEventListener('click', () => { state.calendarOffset++; renderCalendar(); });

  els.loginForm.addEventListener('submit', onLogin);
  els.signupForm.addEventListener('submit', onSignup);
  els.magicForm.addEventListener('submit', onMagicLink);
  els.taskForm.addEventListener('input', onTaskSuggest);
  els.taskForm.addEventListener('submit', onTaskSubmit);
  els.ideaForm.addEventListener('input', onIdeaSuggest);
  els.ideaForm.addEventListener('submit', onIdeaSubmit);
  els.participantForm.addEventListener('submit', onParticipantSubmit);
  els.seedButton.addEventListener('click', seedProjectData);
  els.refreshButton.addEventListener('click', bootstrapApp);
  els.exportButton.addEventListener('click', exportBackup);
  els.taskCategoryFilter.addEventListener('change', renderTasks);
  els.taskStatusFilter.addEventListener('change', renderTasks);
}

function fillSelects() {
  const categoryOptions = ['alle', ...Object.keys(CATEGORY_META)];
  els.taskCategoryFilter.innerHTML = categoryOptions.map(v => `<option value="${v}">${v === 'alle' ? 'Alle Kategorien' : CATEGORY_META[v].label}</option>`).join('');
  els.taskStatusFilter.innerHTML = ['alle','offen','laufend','erledigt','blockiert'].map(v => `<option value="${v}">${v === 'alle' ? 'Alle Status' : v}</option>`).join('');
  const formOptions = Object.entries(CATEGORY_META).map(([key, meta]) => `<option value="${key}">${meta.label}</option>`).join('');
  els.taskFormCategory.innerHTML = formOptions;
  els.ideaFormCategory.innerHTML = formOptions;
}

function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.authTab === tab));
  document.querySelectorAll('.auth-panel').forEach(panel => panel.classList.remove('active'));
  if (tab === 'login') els.loginForm.classList.add('active');
  if (tab === 'signup') els.signupForm.classList.add('active');
  if (tab === 'magic') els.magicForm.classList.add('active');
}

function showSetupBanner(message) {
  els.setupBanner.classList.remove('hidden');
  els.setupBanner.innerHTML = message;
}
function showAuth() {
  els.authScreen.classList.remove('hidden');
  els.pendingScreen.classList.add('hidden');
  els.app.classList.add('hidden');
}
function showPending() {
  els.authScreen.classList.add('hidden');
  els.pendingScreen.classList.remove('hidden');
  els.app.classList.add('hidden');
}
function showApp() {
  els.authScreen.classList.add('hidden');
  els.pendingScreen.classList.add('hidden');
  els.app.classList.remove('hidden');
}

async function onLogin(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  setAuthMessage('Anmeldung läuft …');
  const { error } = await state.supabase.auth.signInWithPassword({
    email: form.get('email'),
    password: form.get('password')
  });
  if (error) return setAuthMessage(error.message, true);
  setAuthMessage('Angemeldet.');
}
async function onSignup(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  setAuthMessage('Konto wird angelegt …');
  const { error } = await state.supabase.auth.signUp({
    email: String(form.get('email')).trim(),
    password: form.get('password'),
    options: {
      data: { full_name: form.get('full_name') },
      emailRedirectTo: window.location.origin + window.location.pathname
    }
  });
  if (error) return setAuthMessage(error.message, true);
  setAuthMessage('Konto angelegt. Bitte E-Mail bestätigen, falls aktiviert. Danach kann der Admin das Konto freischalten.');
}
async function onMagicLink(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  setAuthMessage('Magic Link wird gesendet …');
  const { error } = await state.supabase.auth.signInWithOtp({
    email: form.get('email'),
    options: { emailRedirectTo: window.location.origin + window.location.pathname }
  });
  if (error) return setAuthMessage(error.message, true);
  setAuthMessage('Magic Link versendet.');
}
function setAuthMessage(message, isError = false) {
  els.authMessage.innerHTML = message;
  els.authMessage.style.background = isError ? '#fff0ef' : '#f8fbff';
  els.authMessage.style.color = isError ? '#b8342f' : '#486279';
}

async function signOut() {
  if (!state.supabase) return;
  await state.supabase.auth.signOut();
  showAuth();
}

async function bootstrapApp() {
  if (!state.session) return showAuth();
  setSyncState('Lade Daten …');
  await loadProfile();
  if (!state.profile) return showPending();
  if (!state.profile.is_active && state.profile.role !== 'admin') {
    setSyncState('Warte auf Freigabe');
    return showPending();
  }
  await loadData();
  renderAll();
  showApp();
  setSyncState('Synchronisiert');
}

async function loadProfile() {
  const { data, error } = await state.supabase.from('profiles').select('*').eq('id', state.session.user.id).single();
  state.profile = error ? null : data;
  if (error) console.error(error);
}

async function loadData() {
  const isManager = canManageProject();
  const isAdmin = canAdmin();
  const [tasksRes, notesRes, participantsRes, privateRes, profilesRes] = await Promise.all([
    state.supabase.from('tasks').select('*').order('due_date', { ascending: true, nullsFirst: false }).order('id'),
    state.supabase.from('notes').select('*').order('created_at', { ascending: false }),
    state.supabase.from('participants').select('*').order('availability_from', { ascending: true, nullsFirst: false }).order('full_name'),
    isManager ? state.supabase.from('participant_private').select('*') : Promise.resolve({ data: [], error: null }),
    isAdmin ? state.supabase.from('profiles').select('*').order('created_at', { ascending: true }) : Promise.resolve({ data: [], error: null })
  ]);
  [tasksRes, notesRes, participantsRes, privateRes, profilesRes].forEach(r => { if (r.error) console.error(r.error); });
  state.tasks = tasksRes.data || [];
  state.notes = notesRes.data || [];
  state.participants = participantsRes.data || [];
  state.participantPrivate = privateRes.data || [];
  state.profiles = profilesRes.data || [];
}

function renderAll() {
  renderSidebarIdentity();
  renderKpis();
  renderUpcoming();
  renderCockpit();
  renderRoleCards();
  renderStaffAlerts();
  renderMindmap();
  renderTasks();
  renderCalendar();
  renderParticipants();
  renderIdeas();
  renderAdmin();
  setTab(state.activeTab);
}

function renderSidebarIdentity() {
  els.sidebarUserName.textContent = state.profile.full_name || state.profile.email || 'Unbekannt';
  els.sidebarUserRole.textContent = `${ROLE_META[state.profile.role] || state.profile.role} · ${state.profile.is_active ? 'freigeschaltet' : 'wartend'}`;
  els.adminTabButton.classList.toggle('hidden', !canAdmin());
  els.participantFormPanel.classList.toggle('hidden', !canManageProject());
  els.seedButton.classList.toggle('hidden', !canManageProject());
}

function renderKpis() {
  const openTasks = state.tasks.filter(t => t.status !== 'erledigt').length;
  const dueNext7 = state.tasks.filter(t => t.due_date && daysDiff(t.due_date) >= 0 && daysDiff(t.due_date) <= 7 && t.status !== 'erledigt').length;
  const ideasOpen = state.notes.filter(n => n.note_type === 'idea' || n.status === 'offen').length;
  const cards = [
    { label: 'Offene Aufgaben', value: openTasks, note: 'ohne erledigte Punkte' },
    { label: 'Nächste 7 Tage', value: dueNext7, note: 'fällige Aufgaben' },
    { label: 'Ideen / offene Notizen', value: ideasOpen, note: 'Inbox und offene Punkte' },
    { label: 'Teilnehmende', value: state.participants.length, note: 'sichtbare Personen im Projekt' }
  ];
  els.kpiGrid.innerHTML = cards.map(card => `
    <div class="panel kpi">
      <div class="kpi-label">${card.label}</div>
      <div class="value">${card.value}</div>
      <div class="kpi-note">${card.note}</div>
    </div>
  `).join('');
}

function renderUpcoming() {
  const items = state.tasks.filter(t => t.status !== 'erledigt').sort((a,b) => compareDates(a.due_date,b.due_date)).slice(0,8);
  els.upcomingList.innerHTML = items.length ? items.map(taskCard).join('') : `<div class="empty">Keine offenen Aufgaben vorhanden.</div>`;
  bindTaskActionButtons();
}

function renderCockpit() {
  const docsIssues = state.notes.filter(n => n.category === 'dokumentation' && n.status !== 'erledigt').length;
  const staffUnclear = state.participants.filter(p => ['zu_klären','anzufragen'].includes(p.status)).length;
  const blocked = state.tasks.filter(t => t.status === 'blockiert').length;
  const upcoming = state.tasks.filter(t => t.status !== 'erledigt' && t.due_date && daysDiff(t.due_date) <= 14).length;
  const items = [
    { title:'Personal', status: staffUnclear === 0 ? 'gruen' : staffUnclear < 4 ? 'gelb' : 'rot', text:`${staffUnclear} Fälle mit Klärungsbedarf` },
    { title:'Dokumentation', status: docsIssues === 0 ? 'gruen' : docsIssues < 5 ? 'gelb' : 'rot', text:`${docsIssues} offene Doku-/QC-Notizen` },
    { title:'Aufgabenlage', status: blocked === 0 ? 'gruen' : blocked < 3 ? 'gelb' : 'rot', text:`${blocked} blockierte Aufgaben` },
    { title:'Nächste Fristen', status: upcoming < 6 ? 'gruen' : upcoming < 10 ? 'gelb' : 'rot', text:`${upcoming} Aufgaben in den nächsten 14 Tagen` }
  ];
  els.cockpitGrid.innerHTML = items.map(item => `<div class="cockpit-item"><h4>${item.title}</h4><div class="ampel ${item.status}">${item.status.toUpperCase()}</div><p class="muted">${item.text}</p></div>`).join('');
}

function renderRoleCards() {
  const cards = [
    ['professor', ROLE_DESCRIPTIONS.professor],
    ['technical_lead', ROLE_DESCRIPTIONS.technical_lead],
    ['assistant', ROLE_DESCRIPTIONS.assistant],
    ['trench_lead', ROLE_DESCRIPTIONS.trench_lead],
    ['participant', ROLE_DESCRIPTIONS.participant]
  ];
  els.roleCards.innerHTML = cards.map(([role, desc]) => `<div class="role-card"><strong>${ROLE_META[role]}</strong><span class="muted">${desc}</span></div>`).join('');
}

function renderStaffAlerts() {
  const flagged = state.participants.filter(p => ['zu_klären','anzufragen'].includes(p.status));
  els.staffAlerts.innerHTML = flagged.length ? flagged.map(p => `
    <div class="list-item list-card">
      <div class="item-head"><div class="item-title">${escapeHtml(p.full_name)}</div><span class="status ${p.status === 'anzufragen' ? 'blockiert' : 'laufend'}">${prettyStatus(p.status)}</span></div>
      <div class="item-meta"><span>${formatDate(p.availability_from)} – ${formatDate(p.availability_to)}</span></div>
      <div class="muted">${escapeHtml(p.availability_note || p.source_note || 'Kein Hinweis')}</div>
    </div>`).join('') : `<div class="empty">Keine offenen Personalwarnungen.</div>`;
}

function renderMindmap() {
  const grouped = state.notes.reduce((acc, note) => {
    acc[note.category] ||= {};
    const key = note.subcategory || 'Sonstiges';
    acc[note.category][key] ||= [];
    acc[note.category][key].push(note);
    return acc;
  }, {});
  els.mindmapGrid.innerHTML = Object.keys(CATEGORY_META).map(category => {
    const subgroups = MINDMAP_BRANCHES[category] || [];
    const body = subgroups.map(sub => {
      const matches = (grouped[category]?.[sub]) || [];
      return `<div class="subgroup"><h4>${escapeHtml(sub)}</h4>${matches.length ? matches.map(n => `<div class="muted"><strong>${escapeHtml(n.title)}</strong><br>${escapeHtml(n.body || '')}</div>`).join('<hr style="border:none;border-top:1px solid var(--border);margin:10px 0">') : '<div class="muted">Noch keine Notiz hinterlegt.</div>'}</div>`;
    }).join('');
    return `<details class="branch" open><summary>${CATEGORY_META[category].label}<span>⌄</span></summary><div class="branch-content">${body}</div></details>`;
  }).join('');
}

function renderTasks() {
  const cat = els.taskCategoryFilter.value || 'alle';
  const stat = els.taskStatusFilter.value || 'alle';
  const tasks = state.tasks.filter(t => (cat === 'alle' || t.category === cat) && (stat === 'alle' || t.status === stat));
  els.taskList.innerHTML = tasks.length ? tasks.map(taskCard).join('') : `<div class="empty">Keine Aufgaben für diesen Filter.</div>`;
  bindTaskActionButtons();
}

function taskCard(task) {
  const category = CATEGORY_META[task.category] || { label: task.category, colorClass: '' };
  const canEdit = canManageProject() || task.created_by === state.session?.user?.id;
  return `
    <div class="list-item ${task.category}">
      <div class="item-head">
        <div>
          <div class="item-title">${escapeHtml(task.title)}</div>
          <div class="item-meta">
            <span class="chip ${category.colorClass}">${category.label}</span>
            <span class="status ${task.status}">${prettyStatus(task.status)}</span>
            <span class="chip">${task.priority || 'mittel'}</span>
            ${task.assigned_role ? `<span>${escapeHtml(task.assigned_role)}</span>` : ''}
            ${task.due_date ? `<span>fällig: ${formatDate(task.due_date)}</span>` : ''}
          </div>
        </div>
      </div>
      ${task.description ? `<div class="muted" style="margin-top:10px">${escapeHtml(task.description)}</div>` : ''}
      ${task.subcategory ? `<div class="muted" style="margin-top:8px">Unterpunkt: ${escapeHtml(task.subcategory)}</div>` : ''}
      ${canEdit ? `<div class="action-row">
        <button class="btn small task-status-btn" data-id="${task.id}" data-status="offen">offen</button>
        <button class="btn small task-status-btn" data-id="${task.id}" data-status="laufend">laufend</button>
        <button class="btn small task-status-btn" data-id="${task.id}" data-status="erledigt">erledigt</button>
        <button class="btn small task-status-btn" data-id="${task.id}" data-status="blockiert">blockiert</button>
      </div>` : ''}
    </div>
  `;
}

function bindTaskActionButtons() {
  document.querySelectorAll('.task-status-btn').forEach(btn => btn.addEventListener('click', async () => {
    await updateTaskStatus(Number(btn.dataset.id), btn.dataset.status);
  }));
}

async function updateTaskStatus(id, status) {
  setSyncState('Speichere …');
  const { error } = await state.supabase.from('tasks').update({ status }).eq('id', id);
  if (error) {
    alert('Status konnte nicht aktualisiert werden: ' + error.message);
    return setSyncState('Fehler');
  }
  await loadData(); renderAll(); setSyncState('Synchronisiert');
}

function renderCalendar() {
  const base = new Date();
  const monthDate = new Date(base.getFullYear(), base.getMonth() + state.calendarOffset, 1);
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  els.calendarLabel.textContent = monthDate.toLocaleDateString('de-DE', { month:'long', year:'numeric' });

  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  const firstDay = (start.getDay() + 6) % 7;
  const daysInMonth = end.getDate();
  const previousEnd = new Date(year, month, 0).getDate();

  const names = ['Mo','Di','Mi','Do','Fr','Sa','So'].map(n => `<div class="dayname">${n}</div>`).join('');
  const cells = [];
  for (let i=0; i<firstDay; i++) {
    const dayNum = previousEnd - firstDay + i + 1;
    cells.push(`<div class="day mutedday"><div class="num">${dayNum}</div></div>`);
  }
  for (let day=1; day<=daysInMonth; day++) {
    const iso = toIsoDate(new Date(year, month, day));
    const dayTasks = state.tasks.filter(t => t.due_date === iso).slice(0,4);
    cells.push(`<div class="day ${toIsoDate(new Date()) === iso ? 'today' : ''}">
      <div class="num">${day}</div>
      ${dayTasks.map(t => `<span class="cal-task" style="background:${colorForCategory(t.category)}">${escapeHtml(t.title)}</span>`).join('')}
    </div>`);
  }
  const total = firstDay + daysInMonth;
  const trailing = (7 - (total % 7)) % 7;
  for (let i=0; i<trailing; i++) cells.push(`<div class="day mutedday"></div>`);
  els.calendarGrid.innerHTML = names + cells.join('');
}

function renderParticipants() {
  const isManager = canManageProject();
  const privateMap = new Map(state.participantPrivate.map(p => [p.participant_id, p]));
  const headers = ['Name','Rolle','Verfügbarkeit','Status','Hinweise'];
  if (isManager) headers.push('Kontakt','Intern');
  els.participantsHead.innerHTML = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;
  els.participantsSummary.innerHTML = [
    summaryChip(`Gesamt: ${state.participants.length}`),
    summaryChip(`gesetzt: ${state.participants.filter(p => p.status === 'gesetzt').length}`),
    summaryChip(`zugesagt: ${state.participants.filter(p => p.status === 'zugesagt').length}`),
    summaryChip(`zu klären: ${state.participants.filter(p => p.status === 'zu_klären').length}`)
  ].join('');
  els.participantsBody.innerHTML = state.participants.map(p => {
    const privateData = privateMap.get(p.id) || {};
    const cols = [
      escapeHtml(p.full_name),
      escapeHtml(p.public_role || ''),
      `${formatDate(p.availability_from)} – ${formatDate(p.availability_to)}`,
      `<span class="status ${p.status === 'gesetzt' || p.status === 'zugesagt' ? 'erledigt' : p.status === 'zu_klären' ? 'laufend' : 'blockiert'}">${prettyStatus(p.status)}</span>`,
      escapeHtml(p.availability_note || p.source_note || '')
    ];
    if (isManager) {
      cols.push(`${escapeHtml(privateData.phone || '–')}<br>${escapeHtml(privateData.email || '–')}`);
      cols.push(escapeHtml(privateData.internal_note || ''));
    }
    return `<tr>${cols.map(c => `<td>${c}</td>`).join('')}</tr>`;
  }).join('');
}

function renderIdeas() {
  const sorted = [...state.notes].sort((a,b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  els.ideaList.innerHTML = sorted.length ? sorted.map(note => {
    const cat = CATEGORY_META[note.category] || { label: note.category, colorClass: '' };
    return `<div class="list-item">
      <div class="item-head">
        <div>
          <div class="item-title">${escapeHtml(note.title)}</div>
          <div class="item-meta">
            <span class="chip ${cat.colorClass}">${cat.label}</span>
            <span class="status ${note.status === 'aktiv' ? 'laufend' : (note.status || 'offen')}">${prettyStatus(note.status || 'offen')}</span>
            <span>${escapeHtml(note.subcategory || '')}</span>
          </div>
        </div>
      </div>
      <div class="muted" style="margin-top:10px">${escapeHtml(note.body || '')}</div>
    </div>`;
  }).join('') : `<div class="empty">Noch keine Ideen oder Notizen vorhanden.</div>`;
}

function renderAdmin() {
  if (!canAdmin()) {
    els.profilesBody.innerHTML = `<tr><td colspan="5">Nur für Admin sichtbar.</td></tr>`;
    els.adminInfoList.innerHTML = `<div class="empty">Sie sind nicht als Admin angemeldet.</div>`;
    return;
  }
  els.profilesBody.innerHTML = state.profiles.map(profile => `
    <tr>
      <td>${escapeHtml(profile.full_name || '–')}</td>
      <td>${escapeHtml(profile.email || '–')}</td>
      <td><select class="inline-select role-select" data-id="${profile.id}">${Object.entries(ROLE_META).map(([value, label]) => `<option value="${value}" ${profile.role === value ? 'selected' : ''}>${label}</option>`).join('')}</select></td>
      <td><select class="inline-select active-select" data-id="${profile.id}"><option value="true" ${profile.is_active ? 'selected' : ''}>ja</option><option value="false" ${!profile.is_active ? 'selected' : ''}>nein</option></select></td>
      <td><button class="btn small profile-save-btn" data-id="${profile.id}">Speichern</button></td>
    </tr>`).join('');
  document.querySelectorAll('.profile-save-btn').forEach(btn => btn.addEventListener('click', async () => {
    const id = btn.dataset.id;
    const role = document.querySelector(`.role-select[data-id="${id}"]`).value;
    const is_active = document.querySelector(`.active-select[data-id="${id}"]`).value === 'true';
    await updateProfile(id, { role, is_active });
  }));
  const pending = state.profiles.filter(p => !p.is_active).length;
  const active = state.profiles.filter(p => p.is_active).length;
  els.adminInfoList.innerHTML = `
    <div class="list-item"><strong>Konten gesamt</strong><div class="muted">${state.profiles.length}</div></div>
    <div class="list-item"><strong>Aktiv freigeschaltet</strong><div class="muted">${active}</div></div>
    <div class="list-item"><strong>Warten auf Freigabe</strong><div class="muted">${pending}</div></div>
    <div class="list-item"><strong>Hinweis</strong><div class="muted">Das erste Admin-Konto wird einmalig direkt in Supabase per SQL freigeschaltet.</div></div>`;
}
async function updateProfile(id, payload) {
  setSyncState('Speichere …');
  const { error } = await state.supabase.from('profiles').update(payload).eq('id', id);
  if (error) {
    alert('Profil konnte nicht aktualisiert werden: ' + error.message);
    return setSyncState('Fehler');
  }
  await loadData(); renderAll(); setSyncState('Synchronisiert');
}

async function onTaskSubmit(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const data = {
    title: String(form.get('title')).trim(),
    description: String(form.get('description') || '').trim(),
    category: String(form.get('category')),
    subcategory: String(form.get('subcategory') || '').trim() || null,
    due_date: String(form.get('due_date') || '').trim() || null,
    status: String(form.get('status') || 'offen'),
    priority: String(form.get('priority') || 'mittel'),
    assigned_role: String(form.get('assigned_role') || '').trim() || null,
    created_by: state.session.user.id
  };
  setSyncState('Speichere …');
  const { error } = await state.supabase.from('tasks').insert(data);
  if (error) {
    alert('Aufgabe konnte nicht gespeichert werden: ' + error.message);
    return setSyncState('Fehler');
  }
  event.currentTarget.reset(); els.taskSuggestionBox.textContent = '';
  await loadData(); renderAll(); setSyncState('Synchronisiert');
}

async function onIdeaSubmit(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const data = {
    title: String(form.get('title')).trim(),
    body: String(form.get('body') || '').trim(),
    category: String(form.get('category')),
    subcategory: String(form.get('subcategory') || '').trim() || null,
    note_type: 'idea',
    status: 'offen',
    created_by: state.session.user.id
  };
  setSyncState('Speichere …');
  const { error } = await state.supabase.from('notes').insert(data);
  if (error) {
    alert('Idee konnte nicht gespeichert werden: ' + error.message);
    return setSyncState('Fehler');
  }
  event.currentTarget.reset(); els.ideaSuggestionBox.textContent = '';
  await loadData(); renderAll(); setSyncState('Synchronisiert');
}

async function onParticipantSubmit(event) {
  event.preventDefault();
  if (!canManageProject()) return alert('Nur Leitungsrollen können Teilnehmende anlegen.');
  const form = new FormData(event.currentTarget);
  const participant = {
    full_name: String(form.get('full_name')).trim(),
    public_role: String(form.get('public_role') || '').trim() || 'Teilnehmende',
    availability_from: String(form.get('availability_from') || '').trim() || null,
    availability_to: String(form.get('availability_to') || '').trim() || null,
    status: String(form.get('status') || 'zugesagt'),
    availability_note: String(form.get('availability_note') || '').trim() || null,
    source_note: 'Manuell in der Web-App angelegt.',
    created_by: state.session.user.id
  };
  setSyncState('Speichere …');
  const { data, error } = await state.supabase.from('participants').insert(participant).select().single();
  if (error) {
    alert('Person konnte nicht gespeichert werden: ' + error.message);
    return setSyncState('Fehler');
  }
  const { error: privateError } = await state.supabase.from('participant_private').insert({
    participant_id: data.id,
    phone: String(form.get('phone') || '').trim() || null,
    email: String(form.get('email') || '').trim() || null,
    internal_note: String(form.get('internal_note') || '').trim() || null
  });
  if (privateError) {
    alert('Kontaktteil konnte nicht gespeichert werden: ' + privateError.message);
    return setSyncState('Fehler');
  }
  event.currentTarget.reset();
  await loadData(); renderAll(); setSyncState('Synchronisiert');
}

function onTaskSuggest() {
  const form = new FormData(els.taskForm);
  const suggestion = categorizeText(`${form.get('title') || ''} ${form.get('description') || ''}`);
  els.taskFormCategory.value = suggestion.category;
  const subInput = els.taskForm.querySelector('[name="subcategory"]');
  if (!subInput.value) subInput.value = suggestion.subcategory;
  els.taskSuggestionBox.innerHTML = `Vorschlag: <strong>${CATEGORY_META[suggestion.category].label}</strong> → <strong>${escapeHtml(suggestion.subcategory)}</strong>`;
}
function onIdeaSuggest() {
  const form = new FormData(els.ideaForm);
  const suggestion = categorizeText(`${form.get('title') || ''} ${form.get('body') || ''}`);
  els.ideaFormCategory.value = suggestion.category;
  const subInput = els.ideaForm.querySelector('[name="subcategory"]');
  if (!subInput.value) subInput.value = suggestion.subcategory;
  els.ideaSuggestionBox.innerHTML = `Vorschlag: <strong>${CATEGORY_META[suggestion.category].label}</strong> → <strong>${escapeHtml(suggestion.subcategory)}</strong>`;
}

function categorizeText(text) {
  const t = String(text || '').toLowerCase();
  const rules = [
    { keys:['schnitt','schnittleiter','antoniterhof','hofkapelle','marktplatz','villa','grabenstruktur','fläche'], category:'schnitte', subcategory:'Feldorganisation' },
    { keys:['befund','profil','planum','foto','sfm','dokumentation','nummer','fundliste','qc'], category:'dokumentation', subcategory:'Qualitätskontrolle' },
    { keys:['teilnehmer','studierende','personal','zusage','verfügbarkeit','onboarding','schicht'], category:'personal', subcategory:'Teilnehmendenmanagement' },
    { keys:['büro','haus','transport','fahrzeug','lager','material','warnweste','unterkunft'], category:'logistik', subcategory:'Infrastruktur' },
    { keys:['fund','probe','tierknochen','reinigung','datenbank'], category:'funde', subcategory:'Fundbearbeitung' },
    { keys:['notfall','erste hilfe','hitze','sicherheit','wetter','unfall'], category:'sicherheit', subcategory:'Notfall' },
    { keys:['landesamt','amt','professor','auflage','rückmeldung'], category:'schnittstelle_amt', subcategory:'Professor als Schnittstelle' }
  ];
  for (const rule of rules) if (rule.keys.some(k => t.includes(k))) return { category: rule.category, subcategory: rule.subcategory };
  return { category:'steuerung', subcategory:'Leitungsstruktur' };
}

async function seedProjectData() {
  if (!canManageProject()) return alert('Nur freigeschaltete Leitungsrollen dürfen die Grunddaten einspielen.');
  if (!confirm('Grunddaten aus Chatverlauf und Teilnehmerdatei jetzt in Supabase anlegen? Vorhandene Daten bleiben erhalten.')) return;
  setSyncState('Spiele Grunddaten ein …');

  const taskCount = await state.supabase.from('tasks').select('id', { count:'exact', head:true });
  if (!taskCount.error && taskCount.count === 0) {
    await state.supabase.from('tasks').insert(seedData.tasks.map(item => ({ ...item, created_by: state.session.user.id })));
  }
  const noteCount = await state.supabase.from('notes').select('id', { count:'exact', head:true });
  if (!noteCount.error && noteCount.count === 0) {
    await state.supabase.from('notes').insert(seedData.notes.map(item => ({ ...item, created_by: state.session.user.id })));
  }
  const participantCount = await state.supabase.from('participants').select('id', { count:'exact', head:true });
  if (!participantCount.error && participantCount.count === 0) {
    const { data: inserted, error } = await state.supabase.from('participants').insert(seedData.participants.map(item => ({ ...item, created_by: state.session.user.id }))).select('id, full_name');
    if (!error) {
      const map = new Map(inserted.map(row => [row.full_name, row.id]));
      const privateRows = seedData.participantPrivate.map(item => ({
        participant_id: map.get(item.full_name),
        phone: item.phone,
        email: item.email,
        internal_note: item.internal_note
      })).filter(item => item.participant_id);
      await state.supabase.from('participant_private').insert(privateRows);
    }
  }
  await loadData(); renderAll(); setSyncState('Synchronisiert');
  alert('Grunddaten wurden eingespielt oder waren bereits vorhanden.');
}

function exportBackup() {
  const data = {
    exported_at: new Date().toISOString(),
    project_slug: PROJECT_SLUG,
    tasks: state.tasks,
    notes: state.notes,
    participants: state.participants,
    participant_private_visible_to_current_user: canManageProject() ? state.participantPrivate : [],
    profiles_visible_to_current_user: canAdmin() ? state.profiles : []
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `lehrgrabung-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function setTab(tab) {
  state.activeTab = tab;
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
  document.querySelectorAll('.tab').forEach(section => section.classList.remove('active'));
  const map = { dashboard:'dashboardTab', mindmap:'mindmapTab', tasks:'tasksTab', calendar:'calendarTab', participants:'participantsTab', ideas:'ideasTab', admin:'adminTab', help:'helpTab' };
  document.getElementById(map[tab]).classList.add('active');
  const titles = {
    dashboard:['Übersicht','Aktueller Projektstand, Ampel-Cockpit und nächste Aufgaben'],
    mindmap:['Projektkarte','Strukturierte Hauptäste mit laufend ergänzbaren Notizen'],
    tasks:['Aufgaben & Timeline','Operative To-dos, Fälligkeiten und Statuspflege'],
    calendar:['Kalender','Monatsansicht der nächsten Arbeitspunkte'],
    participants:['Teilnehmende','Übersicht, Verfügbarkeiten und – je nach Rolle – Kontaktdaten'],
    ideas:['Ideen-Inbox','Neue Stichpunkte mit automatischer Zuordnung'],
    admin:['Admin','Rollen, Freischaltungen und Grunddaten'],
    help:['Hilfe & Setup','Einfach erklärt für Veröffentlichung und Nutzung auf mehreren Geräten']
  };
  els.pageTitle.textContent = titles[tab][0];
  els.pageSubtitle.textContent = titles[tab][1];
}

function canManageProject() { return ['admin','professor','technical_lead','assistant'].includes(state.profile?.role); }
function canAdmin() { return state.profile?.role === 'admin'; }
function setSyncState(text) { els.syncState.textContent = text; }
function daysDiff(dateStr) {
  if (!dateStr) return 9999;
  const now = new Date(); now.setHours(0,0,0,0);
  const other = new Date(String(dateStr).slice(0,10) + 'T00:00:00');
  return Math.round((other - now) / 86400000);
}
function compareDates(a,b) {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return new Date(a) - new Date(b);
}
function formatDate(value) {
  if (!value) return '–';
  const d = new Date(String(value).slice(0,10) + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return '–';
  return d.toLocaleDateString('de-DE');
}
function toIsoDate(date) { return date.toISOString().slice(0,10); }
function summaryChip(text) { return `<span class="summary-chip">${text}</span>`; }
function prettyStatus(status) {
  const map = { offen:'offen', laufend:'laufend', erledigt:'erledigt', blockiert:'blockiert', gesetzt:'gesetzt', zugesagt:'zugesagt', zu_klären:'zu klären', anzufragen:'anzufragen', aktiv:'aktiv' };
  return map[status] || status || '–';
}
function colorForCategory(category) {
  const map = { steuerung:'#2d5bff', personal:'#0a95ae', dokumentation:'#c88900', schnitte:'#24995a', logistik:'#6f46c7', funde:'#c44b6e', sicherheit:'#d83b2d', schnittstelle_amt:'#58657a' };
  return map[category] || '#2d5bff';
}
function escapeHtml(value) {
  return String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'", '&#39;');
}

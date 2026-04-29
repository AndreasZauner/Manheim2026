window.APP_CONFIG = {
  SUPABASE_URL: 'https://qpondbcuoyaxsidyzddn.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_bdwHq4KzgvI0t8R2vTGYIQ_ezvqeG_8',
  PROJECT_SLUG: 'lehrgrabung-kerpen-manheim-2026'
};

window.getManheimSupabaseClient = function getManheimSupabaseClient(createClient) {
  if (!window.__manheimSupabaseClient) {
    window.__manheimSupabaseClient = createClient(
      window.APP_CONFIG.SUPABASE_URL,
      window.APP_CONFIG.SUPABASE_ANON_KEY,
      { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
    );
  }
  return window.__manheimSupabaseClient;
};

(function bootExtensions() {
  loadMapModule();
  loadAttendanceModule();
  loadParticipantTimelineModule();
  document.addEventListener('DOMContentLoaded', installModernAuthScreen);
  document.addEventListener('DOMContentLoaded', installIdeaFormHotfix);
  document.addEventListener('DOMContentLoaded', installPasswordToggle);

  const knownCategories = [
    ['steuerung', 'Steuerung'], ['personal', 'Personal'], ['dokumentation', 'Dokumentation'],
    ['schnitte', 'Schnitte'], ['logistik', 'Logistik'], ['funde', 'Funde'],
    ['sicherheit', 'Sicherheit'], ['schnittstelle_amt', 'Schnittstelle Amt']
  ];
  const gisWords = ['karte','maps','google maps','geopackage','gis','layer','layerauswahl','ebene','projektion','viewer','upload'];
  const defaultSuggestion = { category: 'steuerung', subcategory: 'Leitungsstruktur' };

  function loadMapModule() {
    if (document.querySelector('script[src^="./map-module.js"]')) return;
    const script = document.createElement('script');
    script.type = 'module';
    script.src = './map-module.js?v=map-20260429-2';
    document.head.appendChild(script);
  }

  function loadAttendanceModule() {
    if (document.querySelector('script[src^="./attendance-module.js"]')) return;
    const script = document.createElement('script');
    script.type = 'module';
    script.src = './attendance-module.js?v=attendance-20260429-1';
    document.head.appendChild(script);
  }

  function loadParticipantTimelineModule() {
    if (document.querySelector('script[src^="./participant-timeline-module.js"]')) return;
    const script = document.createElement('script');
    script.type = 'module';
    script.src = './participant-timeline-module.js?v=timeline-20260429-1';
    document.head.appendChild(script);
  }

  function installModernAuthScreen() {
    if (!document.querySelector('link[href="./auth-login.css"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = './auth-login.css?v=auth-20260429-1';
      document.head.appendChild(link);
    }

    const screen = document.getElementById('authScreen');
    if (!screen || screen.dataset.modernAuth === 'true') return;
    screen.dataset.modernAuth = 'true';
    screen.innerHTML = `
      <div class="auth-bg-mark auth-bg-mark-logo" aria-hidden="true"><img src="./assets/favicon.png" alt=""></div>
      <div class="auth-bg-mark auth-bg-mark-word" aria-hidden="true">Kerpen-<br>Manheim<br><span>2026</span></div>
      <div class="auth-card">
        <div class="auth-content">
          <img class="auth-logo-mark" src="./assets/favicon.png" alt="" aria-hidden="true">
          <div class="hero-mark">LMU / Lehrgrabung 2026</div>
          <div class="auth-brand">
            <div class="auth-brand-logo"><img src="./assets/favicon.png" alt="Kerpen-Manheim 2026 Lehrgrabung Planer"></div>
            <div class="auth-brand-text"><strong>Kerpen-<br>Manheim <span>2026</span></strong><small>Lehrgrabung Planer</small></div>
          </div>
          <h1>Willkommen zur&uuml;ck</h1>
          <p class="lead">Melden Sie sich an, um Ihren Lehrgrabungs-Planer zu verwalten, Rollen zu vergeben und den &Uuml;berblick zu behalten.</p>
          <div class="auth-tabs">
            <button class="auth-tab active" data-auth-tab="login" type="button"><span aria-hidden="true">&#128100;</span>Anmelden</button>
            <button class="auth-tab" data-auth-tab="signup" type="button"><span aria-hidden="true">+</span>Registrieren</button>
            <button class="auth-tab" data-auth-tab="magic" type="button"><span aria-hidden="true">&#8599;</span>Magic Link</button>
          </div>
          <form id="loginForm" class="auth-panel active">
            <label class="span-2" for="loginEmail">E-Mail-Adresse<span class="auth-field"><span class="auth-field-icon" aria-hidden="true">@</span><input id="loginEmail" type="email" name="email" autocomplete="email" placeholder="name@beispiel.de" required></span></label>
            <label class="span-2" for="loginPassword">Passwort<span class="auth-field"><span class="auth-field-icon" aria-hidden="true">&#9679;</span><input id="loginPassword" type="password" name="password" autocomplete="current-password" placeholder="Ihr Passwort" required><button id="passwordToggle" class="password-toggle" type="button" aria-label="Passwort anzeigen">&#9673;</button></span></label>
            <div class="auth-form-options span-2"><label class="auth-checkbox"><input type="checkbox" name="remember">Angemeldet bleiben</label><a href="#">Passwort vergessen?</a></div>
            <button class="btn primary wide" type="submit">Anmelden <span aria-hidden="true">&#8594;</span></button>
          </form>
          <form id="signupForm" class="auth-panel">
            <label class="span-2" for="signupName">Voller Name<span class="auth-field"><span class="auth-field-icon" aria-hidden="true">&#128100;</span><input id="signupName" type="text" name="full_name" autocomplete="name" placeholder="Ihr Name" required></span></label>
            <label class="span-2" for="signupEmail">E-Mail-Adresse<span class="auth-field"><span class="auth-field-icon" aria-hidden="true">@</span><input id="signupEmail" type="email" name="email" autocomplete="email" placeholder="name@beispiel.de" required></span></label>
            <label class="span-2" for="signupPassword">Passwort<span class="auth-field"><span class="auth-field-icon" aria-hidden="true">&#9679;</span><input id="signupPassword" type="password" name="password" autocomplete="new-password" placeholder="Mindestens 8 Zeichen" minlength="8" required></span></label>
            <button class="btn primary wide" type="submit">Registrieren <span aria-hidden="true">&#8594;</span></button>
          </form>
          <form id="magicForm" class="auth-panel">
            <label class="span-2" for="magicEmail">E-Mail-Adresse<span class="auth-field"><span class="auth-field-icon" aria-hidden="true">@</span><input id="magicEmail" type="email" name="email" autocomplete="email" placeholder="name@beispiel.de" required></span></label>
            <button class="btn primary wide" type="submit">Magic Link senden <span aria-hidden="true">&#8599;</span></button>
          </form>
          <div id="authMessage" class="message-box"></div>
          <div class="auth-divider"><span></span><em>oder</em><span></span></div>
          <div class="auth-help"><span class="auth-help-icon" aria-hidden="true">i</span><p><strong>Wichtig:</strong> Nach der Registrierung ist ein neues Konto standardm&auml;&szlig;ig <em>nicht freigeschaltet</em>. Sie als Admin aktivieren Teilnehmende und vergeben Rollen sp&auml;ter im Adminbereich.</p></div>
        </div>
      </div>
      <footer class="auth-footer">&copy; 2026 Lehrgrabung Kerpen-Manheim. Alle Rechte vorbehalten.</footer>
    `;
  }

  function installIdeaFormHotfix() {
    window.setTimeout(() => {
      const form = document.getElementById('ideaForm');
      const select = document.getElementById('ideaFormCategory');
      if (!form || !select || document.getElementById('ideaCategoryText')) return;
      const sub = form.querySelector('[name="subcategory"]');
      const title = form.querySelector('[name="title"]');
      const body = form.querySelector('[name="body"]');
      const box = document.getElementById('ideaSuggestionBox');
      const sync = document.getElementById('syncState');
      const button = form.querySelector('button[type="submit"]');
      let manualCategory = false;
      let manualSub = false;

      const list = document.createElement('datalist');
      list.id = 'ideaCategoryOptions';
      knownCategories.forEach(([, label]) => list.appendChild(new Option(label)));
      const input = document.createElement('input');
      input.id = 'ideaCategoryText';
      input.type = 'text';
      input.setAttribute('list', list.id);
      input.autocomplete = 'off';
      input.placeholder = 'Kategorie waehlen oder neu eintippen';
      input.style.width = '100%';
      select.insertAdjacentElement('afterend', list);
      select.insertAdjacentElement('afterend', input);
      select.style.display = 'none';
      input.value = labelFor(select.value || defaultSuggestion.category);

      const setSync = text => { if (sync) sync.textContent = text; };
      const syncCategory = () => {
        const label = input.value.trim() || labelFor(defaultSuggestion.category);
        const value = valueFor(label) || defaultSuggestion.category;
        if (![...select.options].some(option => option.value === value)) select.appendChild(new Option(label, value));
        select.value = value;
      };
      const suggest = () => {
        const suggestion = categorize(`${title?.value || ''} ${body?.value || ''}`);
        if (!manualCategory) {
          input.value = labelFor(suggestion.category);
          if (![...select.options].some(option => option.value === suggestion.category)) select.appendChild(new Option(input.value, suggestion.category));
          select.value = suggestion.category;
        } else syncCategory();
        if (!manualSub && sub && (!sub.value || sub.value === defaultSuggestion.subcategory)) sub.value = suggestion.subcategory;
        if (box) box.innerHTML = `Vorschlag: <strong>${escapeHtml(input.value)}</strong>  <strong>${escapeHtml(sub?.value || suggestion.subcategory)}</strong>`;
      };

      input.addEventListener('input', () => { manualCategory = true; syncCategory(); suggest(); });
      input.addEventListener('change', () => { manualCategory = true; syncCategory(); suggest(); });
      sub?.addEventListener('input', () => { manualSub = true; });
      form.addEventListener('input', event => {
        if (event.target?.name === 'subcategory') manualSub = true;
        window.setTimeout(suggest, 0);
      }, true);
      form.addEventListener('submit', async event => {
        event.preventDefault();
        event.stopImmediatePropagation();
        syncCategory();
        const payload = {
          title: String(title?.value || '').trim(),
          body: String(body?.value || '').trim(),
          category: String(select.value || defaultSuggestion.category),
          subcategory: String(sub?.value || '').trim() || null,
          note_type: 'idea',
          status: 'offen'
        };
        if (!payload.title) return alert('Bitte einen Titel eingeben.');
        if (!payload.body) return alert('Bitte einen Text zur Idee eingeben.');
        try {
          if (button) button.disabled = true;
          setSync('Speichere ...');
          if (box) box.textContent = 'Idee wird gespeichert ...';
          const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm');
          const client = window.getManheimSupabaseClient(createClient);
          const { data: sessionData, error: sessionError } = await withTimeout(client.auth.getSession(), 'Session laden');
          if (sessionError) throw sessionError;
          const userId = sessionData?.session?.user?.id;
          if (!userId) throw new Error('Keine aktive Anmeldung gefunden. Bitte neu anmelden.');
          const { error } = await withTimeout(client.from('notes').insert({ ...payload, created_by: userId }).select('id').single(), 'Idee speichern');
          if (error) throw error;
          form.reset();
          manualCategory = false;
          manualSub = false;
          input.value = labelFor(defaultSuggestion.category);
          setSync('Synchronisiert');
          if (box) box.textContent = 'Idee gespeichert. Daten werden neu geladen ...';
          window.setTimeout(() => window.location.reload(), 700);
        } catch (error) {
          const message = error?.message || String(error);
          if (box) box.innerHTML = `<span style="color:#b8342f">Speichern fehlgeschlagen: ${escapeHtml(message)}</span>`;
          alert('Idee konnte nicht gespeichert werden: ' + message);
          setSync('Fehler');
        } finally {
          if (button) button.disabled = false;
        }
      }, true);
      suggest();
    }, 0);
  }

  function installPasswordToggle() {
    const button = document.getElementById('passwordToggle');
    const input = document.getElementById('loginPassword');
    if (!button || !input) return;
    button.addEventListener('click', () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      button.innerHTML = show ? '&#9675;' : '&#9673;';
      button.setAttribute('aria-label', show ? 'Passwort verbergen' : 'Passwort anzeigen');
    });
  }

  function categorize(text) {
    const t = String(text || '').toLowerCase();
    const rules = [
      [gisWords, 'dokumentation', 'GIS / Kartenviewer'],
      [['befund','profil','planum','foto','sfm','dokumentation','nummer','fundliste','qc'], 'dokumentation', 'Qualitaetskontrolle'],
      [['schnitt','schnittleiter','antoniterhof','hofkapelle','marktplatz','villa','grabenstruktur','flaeche','flche'], 'schnitte', 'Feldorganisation'],
      [['teilnehmer','studierende','personal','zusage','verfuegbarkeit','verfgbarkeit','onboarding','schicht'], 'personal', 'Teilnehmendenmanagement'],
      [['buero','bro','haus','transport','fahrzeug','lager','material','warnweste','unterkunft'], 'logistik', 'Infrastruktur'],
      [['fund','probe','tierknochen','reinigung','datenbank'], 'funde', 'Fundbearbeitung'],
      [['notfall','erste hilfe','hitze','sicherheit','wetter','unfall'], 'sicherheit', 'Notfall'],
      [['landesamt','amt','professor','auflage','rueckmeldung','rckmeldung'], 'schnittstelle_amt', 'Professor als Schnittstelle']
    ];
    const hit = rules.find(([keys]) => keys.some(key => t.includes(key)));
    return hit ? { category: hit[1], subcategory: hit[2] } : defaultSuggestion;
  }
  function labelFor(value) { return knownCategories.find(([key]) => key === value)?.[1] || value || ''; }
  function valueFor(label) { return knownCategories.find(([, text]) => text.toLowerCase() === String(label).trim().toLowerCase())?.[0] || String(label || '').trim(); }
  function withTimeout(promise, label, ms = 15000) {
    let timeoutId;
    const timeout = new Promise((_, reject) => { timeoutId = window.setTimeout(() => reject(new Error(`${label} dauert zu lange. Bitte Verbindung und Supabase pruefen.`)), ms); });
    return Promise.race([Promise.resolve(promise).finally(() => window.clearTimeout(timeoutId)), timeout]);
  }
  function escapeHtml(value) { return String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'", '&#39;'); }
})();

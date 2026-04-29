window.APP_CONFIG = {
  SUPABASE_URL: 'https://qpondbcuoyaxsidyzddn.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_bdwHq4KzgvI0t8R2vTGYIQ_ezvqeG_8',
  PROJECT_SLUG: 'lehrgrabung-kerpen-manheim-2026'
};

(function bootExtensions() {
  document.addEventListener('DOMContentLoaded', () => {
    installIdeaFormHotfix();
    if (!document.querySelector('script[src="./map-module.js"]')) {
      const script = document.createElement('script');
      script.type = 'module';
      script.src = './map-module.js';
      document.body.appendChild(script);
    }
  });

  const knownCategories = [
    ['steuerung', 'Steuerung'], ['personal', 'Personal'], ['dokumentation', 'Dokumentation'],
    ['schnitte', 'Schnitte'], ['logistik', 'Logistik'], ['funde', 'Funde'],
    ['sicherheit', 'Sicherheit'], ['schnittstelle_amt', 'Schnittstelle Amt']
  ];
  const gisWords = ['karte','maps','google maps','geopackage','gis','layer','layerauswahl','ebene','projektion','viewer','upload'];
  const defaultSuggestion = { category: 'steuerung', subcategory: 'Leitungsstruktur' };

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
        if (box) box.innerHTML = `Vorschlag: <strong>${escapeHtml(input.value)}</strong> → <strong>${escapeHtml(sub?.value || suggestion.subcategory)}</strong>`;
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
          const client = createClient(window.APP_CONFIG.SUPABASE_URL, window.APP_CONFIG.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
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

  function categorize(text) {
    const t = String(text || '').toLowerCase();
    const rules = [
      [gisWords, 'dokumentation', 'GIS / Kartenviewer'],
      [['befund','profil','planum','foto','sfm','dokumentation','nummer','fundliste','qc'], 'dokumentation', 'Qualitaetskontrolle'],
      [['schnitt','schnittleiter','antoniterhof','hofkapelle','marktplatz','villa','grabenstruktur','flaeche','fläche'], 'schnitte', 'Feldorganisation'],
      [['teilnehmer','studierende','personal','zusage','verfuegbarkeit','verfügbarkeit','onboarding','schicht'], 'personal', 'Teilnehmendenmanagement'],
      [['buero','büro','haus','transport','fahrzeug','lager','material','warnweste','unterkunft'], 'logistik', 'Infrastruktur'],
      [['fund','probe','tierknochen','reinigung','datenbank'], 'funde', 'Fundbearbeitung'],
      [['notfall','erste hilfe','hitze','sicherheit','wetter','unfall'], 'sicherheit', 'Notfall'],
      [['landesamt','amt','professor','auflage','rueckmeldung','rückmeldung'], 'schnittstelle_amt', 'Professor als Schnittstelle']
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

window.APP_CONFIG = {
  SUPABASE_URL: 'https://qpondbcuoyaxsidyzddn.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_bdwHq4KzgvI0t8R2vTGYIQ_ezvqeG_8',
  PROJECT_SLUG: 'lehrgrabung-kerpen-manheim-2026'
};

(function installIdeaFormHotfix() {
  const gisWords = ['karte','maps','google maps','geopackage','gis','layer','layerauswahl','ebene','projektion','viewer','upload'];
  const defaultSuggestion = { category: 'steuerung', subcategory: 'Leitungsstruktur' };

  function escapeHtml(value) {
    return String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'", '&#39;');
  }

  function withTimeout(promise, label, ms = 15000) {
    let timeoutId;
    const timeout = new Promise((_, reject) => {
      timeoutId = window.setTimeout(() => reject(new Error(`${label} dauert zu lange. Bitte Verbindung und Supabase pruefen.`)), ms);
    });
    return Promise.race([
      Promise.resolve(promise).finally(() => window.clearTimeout(timeoutId)),
      timeout
    ]);
  }

  function categorizeIdea(text) {
    const lower = String(text || '').toLowerCase();
    if (gisWords.some(word => lower.includes(word))) {
      return { category: 'dokumentation', subcategory: 'GIS / Kartenviewer' };
    }
    if (['befund','profil','planum','foto','sfm','dokumentation','nummer','fundliste','qc'].some(word => lower.includes(word))) {
      return { category: 'dokumentation', subcategory: 'Qualitaetskontrolle' };
    }
    if (['schnitt','schnittleiter','antoniterhof','hofkapelle','marktplatz','villa','grabenstruktur','flaeche','fläche'].some(word => lower.includes(word))) {
      return { category: 'schnitte', subcategory: 'Feldorganisation' };
    }
    if (['teilnehmer','studierende','personal','zusage','verfuegbarkeit','verfügbarkeit','onboarding','schicht'].some(word => lower.includes(word))) {
      return { category: 'personal', subcategory: 'Teilnehmendenmanagement' };
    }
    if (['buero','büro','haus','transport','fahrzeug','lager','material','warnweste','unterkunft'].some(word => lower.includes(word))) {
      return { category: 'logistik', subcategory: 'Infrastruktur' };
    }
    if (['fund','probe','tierknochen','reinigung','datenbank'].some(word => lower.includes(word))) {
      return { category: 'funde', subcategory: 'Fundbearbeitung' };
    }
    if (['notfall','erste hilfe','hitze','sicherheit','wetter','unfall'].some(word => lower.includes(word))) {
      return { category: 'sicherheit', subcategory: 'Notfall' };
    }
    if (['landesamt','amt','professor','auflage','rueckmeldung','rückmeldung'].some(word => lower.includes(word))) {
      return { category: 'schnittstelle_amt', subcategory: 'Professor als Schnittstelle' };
    }
    return defaultSuggestion;
  }

  document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('ideaForm');
    if (!form) return;

    const category = document.getElementById('ideaFormCategory');
    const subcategory = form.querySelector('[name="subcategory"]');
    const title = form.querySelector('[name="title"]');
    const body = form.querySelector('[name="body"]');
    const suggestionBox = document.getElementById('ideaSuggestionBox');
    const syncState = document.getElementById('syncState');
    const submitButton = form.querySelector('button[type="submit"]');
    let manualCategory = false;
    let manualSubcategory = false;
    let selectedCategory = category?.value || defaultSuggestion.category;

    function setSync(text) {
      if (syncState) syncState.textContent = text;
    }

    function applySuggestion() {
      if (!category || !subcategory) return;
      const suggestion = categorizeIdea(`${title?.value || ''} ${body?.value || ''}`);
      if (!manualCategory) {
        selectedCategory = suggestion.category;
        category.value = suggestion.category;
      } else {
        category.value = selectedCategory;
      }
      if (!manualSubcategory && (!subcategory.value || subcategory.value === defaultSuggestion.subcategory)) {
        subcategory.value = suggestion.subcategory;
      }
      if (suggestionBox) {
        suggestionBox.innerHTML = `Vorschlag: <strong>${escapeHtml(category.options[category.selectedIndex]?.text || suggestion.category)}</strong> → <strong>${escapeHtml(subcategory.value || suggestion.subcategory)}</strong>`;
      }
    }

    form.addEventListener('input', event => {
      if (event.target?.name === 'category') {
        manualCategory = true;
        selectedCategory = category.value;
      }
      if (event.target?.name === 'subcategory') manualSubcategory = true;
      window.setTimeout(applySuggestion, 0);
    }, true);

    category?.addEventListener('change', () => {
      manualCategory = true;
      selectedCategory = category.value;
      window.setTimeout(applySuggestion, 0);
    }, true);

    subcategory?.addEventListener('input', () => {
      manualSubcategory = true;
    }, true);

    form.addEventListener('submit', async event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      applySuggestion();

      const data = {
        title: String(title?.value || '').trim(),
        body: String(body?.value || '').trim(),
        category: String(category?.value || defaultSuggestion.category),
        subcategory: String(subcategory?.value || '').trim() || null,
        note_type: 'idea',
        status: 'offen'
      };
      if (!data.title) return alert('Bitte einen Titel eingeben.');
      if (!data.body) return alert('Bitte einen Text zur Idee eingeben.');

      try {
        if (submitButton) submitButton.disabled = true;
        setSync('Speichere ...');
        if (suggestionBox) suggestionBox.textContent = 'Idee wird gespeichert ...';

        const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm');
        const client = createClient(window.APP_CONFIG.SUPABASE_URL, window.APP_CONFIG.SUPABASE_ANON_KEY, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
        });
        const { data: sessionData, error: sessionError } = await withTimeout(client.auth.getSession(), 'Session laden');
        if (sessionError) throw sessionError;
        const userId = sessionData?.session?.user?.id;
        if (!userId) throw new Error('Keine aktive Anmeldung gefunden. Bitte neu anmelden.');

        const { error } = await withTimeout(client.from('notes').insert({ ...data, created_by: userId }).select('id').single(), 'Idee speichern');
        if (error) throw error;

        form.reset();
        manualCategory = false;
        manualSubcategory = false;
        selectedCategory = defaultSuggestion.category;
        if (suggestionBox) suggestionBox.textContent = 'Idee gespeichert. Daten werden neu geladen ...';
        setSync('Synchronisiert');
        window.setTimeout(() => window.location.reload(), 700);
      } catch (error) {
        console.error(error);
        const message = error?.message || String(error);
        if (suggestionBox) suggestionBox.innerHTML = `<span style="color:#b8342f">Speichern fehlgeschlagen: ${escapeHtml(message)}</span>`;
        alert('Idee konnte nicht gespeichert werden: ' + message);
        setSync('Fehler');
      } finally {
        if (submitButton) submitButton.disabled = false;
      }
    }, true);
  });
})();

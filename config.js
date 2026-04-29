window.APP_CONFIG = {
  SUPABASE_URL: 'https://qpondbcuoyaxsidyzddn.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_bdwHq4KzgvI0t8R2vTGYIQ_ezvqeG_8',
  PROJECT_SLUG: 'lehrgrabung-kerpen-manheim-2026'
};

(function installIdeaFormHotfix() {
  const knownCategories = [
    ['steuerung', 'Steuerung'],
    ['personal', 'Personal'],
    ['dokumentation', 'Dokumentation'],
    ['schnitte', 'Schnitte'],
    ['logistik', 'Logistik'],
    ['funde', 'Funde'],
    ['sicherheit', 'Sicherheit'],
    ['schnittstelle_amt', 'Schnittstelle Amt']
  ];
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
    window.setTimeout(enhanceIdeaForm, 0);
  });

  function enhanceIdeaForm() {
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
    const categoryInput = replaceCategorySelect(category);
    categoryInput.value = labelForCategory(selectedCategory);

    function setSync(text) {
      if (syncState) syncState.textContent = text;
    }

    function replaceCategorySelect(select) {
      if (!select || document.getElementById('ideaCategoryText')) return document.getElementById('ideaCategoryText');
      const datalist = document.createElement('datalist');
      datalist.id = 'ideaCategoryOptions';
      knownCategories.forEach(([, label]) => {
        const option = document.createElement('option');
        option.value = label;
        datalist.appendChild(option);
      });
      const input = document.createElement('input');
      input.id = 'ideaCategoryText';
      input.type = 'text';
      input.setAttribute('list', datalist.id);
      input.setAttribute('autocomplete', 'off');
      input.placeholder = 'Kategorie waehlen oder neu eintippen';
      input.style.width = '100%';
      select.insertAdjacentElement('afterend', datalist);
      select.insertAdjacentElement('afterend', input);
      select.style.display = 'none';
      select.tabIndex = -1;
      return input;
    }

    function labelForCategory(value) {
      return knownCategories.find(([key]) => key === value)?.[1] || value || '';
    }

    function valueForCategoryInput(value) {
      const cleaned = String(value || '').trim();
      return knownCategories.find(([, label]) => label.toLowerCase() === cleaned.toLowerCase())?.[0] || cleaned;
    }

    function ensureSelectOption(value, label = value) {
      if (!category || !value) return;
      if (![...category.options].some(option => option.value === value)) {
        category.appendChild(new Option(label, value));
      }
      category.value = value;
      selectedCategory = value;
    }

    function syncCategoryFromInput() {
      const value = valueForCategoryInput(categoryInput.value);
      ensureSelectOption(value || defaultSuggestion.category, categoryInput.value || labelForCategory(defaultSuggestion.category));
    }

    function applySuggestion() {
      if (!category || !subcategory) return;
      const suggestion = categorizeIdea(`${title?.value || ''} ${body?.value || ''}`);
      if (!manualCategory) {
        selectedCategory = suggestion.category;
        ensureSelectOption(suggestion.category, labelForCategory(suggestion.category));
        categoryInput.value = labelForCategory(suggestion.category);
      } else {
        syncCategoryFromInput();
      }
      if (!manualSubcategory && (!subcategory.value || subcategory.value === defaultSuggestion.subcategory)) {
        subcategory.value = suggestion.subcategory;
      }
      if (suggestionBox) {
        suggestionBox.innerHTML = `Vorschlag: <strong>${escapeHtml(categoryInput.value || labelForCategory(suggestion.category))}</strong> → <strong>${escapeHtml(subcategory.value || suggestion.subcategory)}</strong>`;
      }
    }

    categoryInput?.addEventListener('input', () => {
      manualCategory = true;
      syncCategoryFromInput();
      applySuggestion();
    });

    categoryInput?.addEventListener('change', () => {
      manualCategory = true;
      syncCategoryFromInput();
      applySuggestion();
    });

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
      syncCategoryFromInput();

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
        categoryInput.value = labelForCategory(defaultSuggestion.category);
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
  }
})();

const SOURCE_LABELS = [
  ['lmu', 'LMU'],
  ['lvr', 'LVR'],
  ['privat', 'Privat']
];

installMaterialLayoutPolish();

function installMaterialLayoutPolish() {
  injectPolishStylesheet();
  polishMaterialLayout();
  const observer = new MutationObserver(polishMaterialLayout);
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

function injectPolishStylesheet() {
  if (document.querySelector('link[href^="./material-layout-polish.css"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = './material-layout-polish.css?v=source-columns-20260528-1';
  document.head.appendChild(link);
}

function polishMaterialLayout() {
  document.querySelectorAll('.material-source-section').forEach(section => {
    const label = section.querySelector('.material-source-head h3')?.textContent?.trim() || '';
    const source = SOURCE_LABELS.find(([, prefix]) => label.startsWith(prefix))?.[0];
    if (source) section.classList.add(`source-${source}`);
  });

  document.querySelectorAll('.material-card').forEach(card => {
    if (card.querySelector('.material-quantity')) return;
    const meta = card.querySelector('.material-meta');
    const spans = [...(meta?.querySelectorAll('span') || [])];
    const soll = takeFact(spans, 'Soll');
    const ist = takeFact(spans, 'Ist');
    const quantity = document.createElement('div');
    quantity.className = 'material-quantity';
    quantity.setAttribute('aria-label', 'Soll-Ist-Zustand');
    quantity.innerHTML = `
      <span><strong>Soll</strong>${escapeHtml(soll || '-')}</span>
      <span><strong>Ist</strong>${escapeHtml(ist || '-')}</span>
    `;
    const state = card.querySelector('.material-state');
    if (state) state.insertAdjacentElement('beforebegin', quantity);
    else card.querySelector('.material-actions')?.insertAdjacentElement('beforebegin', quantity);
  });
}

function takeFact(spans, label) {
  const span = spans.find(node => node.textContent.trim().startsWith(label));
  if (!span) return '';
  const value = span.textContent.trim().replace(label, '').replace(/^[:\s]+/, '');
  span.remove();
  return value;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

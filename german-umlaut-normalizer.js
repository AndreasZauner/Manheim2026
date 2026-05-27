const TEXT_REPLACEMENTS = [
  ['Qualit\u00c3\u00a4tskontrolle', 'Qualit\u00e4tskontrolle'],
  ['Kategorie w\u00c3\u00a4hlen', 'Kategorie w\u00e4hlen'],
  ['Supabase pr\u00c3\u00bcfen', 'Supabase pr\u00fcfen'],
  ['zur&uuml;ck', 'zur\u00fcck'],
  ['&Uuml;berblick', '\u00dcberblick'],
  ['&uuml;', '\u00fc'],
  ['&auml;', '\u00e4'],
  ['&ouml;', '\u00f6'],
  ['&Auml;', '\u00c4'],
  ['&Ouml;', '\u00d6'],
  ['&Uuml;', '\u00dc'],
  ['&szlig;', '\u00df'],
  ['Schlaemmstation', 'Schl\u00e4mmstation'],
  ['Schliessen', 'Schlie\u00dfen'],
  ['Ueberblick', '\u00dcberblick'],
  ['Muenchen', 'M\u00fcnchen'],
  ['Gegenstaende', 'Gegenst\u00e4nde'],
  ['Prioritaet', 'Priorit\u00e4t'],
  ['Ausfaelle', 'Ausf\u00e4lle'],
  ['verfuegbar', 'verf\u00fcgbar'],
  ['geoeffnet', 'ge\u00f6ffnet'],
  ['ausfuehren', 'ausf\u00fchren'],
  ['klaeren', 'kl\u00e4ren'],
  ['pruefen', 'pr\u00fcfen'],
  ['waehlen', 'w\u00e4hlen'],
  ['zurueck', 'zur\u00fcck'],
  ['fuer', 'f\u00fcr'],
  ['Fuer', 'F\u00fcr'],
  ['entfaellt', 'entf\u00e4llt'],
  ['regulaer', 'regul\u00e4r'],
  ['Massstab', 'Ma\u00dfstab'],
  ['Mass', 'Ma\u00df'],
  ['Strasse', 'Stra\u00dfe'],
  ['gross', 'gro\u00df'],
  ['Gross', 'Gro\u00df']
];

const ATTRIBUTE_NAMES = ['aria-label', 'title', 'placeholder', 'alt'];
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'CODE', 'PRE', 'TEXTAREA']);

installGermanUmlautNormalizer();

function installGermanUmlautNormalizer() {
  normalizeTree(document.body || document.documentElement);
  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) normalizeTree(node);
      if (mutation.type === 'characterData') normalizeTextNode(mutation.target);
      if (mutation.type === 'attributes') normalizeAttributes(mutation.target);
    }
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ATTRIBUTE_NAMES
  });
}

function normalizeTree(root) {
  if (!root) return;
  if (root.nodeType === Node.TEXT_NODE) {
    normalizeTextNode(root);
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE || SKIP_TAGS.has(root.tagName)) return;
  normalizeAttributes(root);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return shouldSkip(node.parentElement) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
    }
  });
  while (walker.nextNode()) normalizeTextNode(walker.currentNode);
  root.querySelectorAll?.('*').forEach(normalizeAttributes);
}

function normalizeTextNode(node) {
  const next = normalizeText(node.nodeValue);
  if (next !== node.nodeValue) node.nodeValue = next;
}

function normalizeAttributes(element) {
  if (!element || shouldSkip(element)) return;
  for (const name of ATTRIBUTE_NAMES) {
    const value = element.getAttribute?.(name);
    if (!value) continue;
    const next = normalizeText(value);
    if (next !== value) element.setAttribute(name, next);
  }
}

function shouldSkip(element) {
  return !element || SKIP_TAGS.has(element.tagName);
}

function normalizeText(value) {
  let text = String(value ?? '');
  for (const [from, to] of TEXT_REPLACEMENTS) text = text.replaceAll(from, to);
  return text;
}

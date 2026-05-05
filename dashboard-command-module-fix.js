const state = {
  collapsed: localStorage.getItem('leitstandPersonnelCollapsed') === 'true',
  timer: null,
  clipId: 0
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', installLeitstandChartFix);
} else {
  installLeitstandChartFix();
}

function installLeitstandChartFix() {
  if (window.__leitstandChartFixInstalled) return;
  window.__leitstandChartFixInstalled = true;
  installStyles();
  document.addEventListener('click', event => {
    const button = event.target?.closest?.('[data-leitstand-chart-action="collapse-personnel"]');
    if (!button) return;
    state.collapsed = !state.collapsed;
    localStorage.setItem('leitstandPersonnelCollapsed', String(state.collapsed));
    enhance();
  });
  const observer = new MutationObserver(() => scheduleEnhance());
  observer.observe(document.body, { childList: true, subtree: true });
  scheduleEnhance(100);
  scheduleEnhance(800);
}

function scheduleEnhance(delay = 80) {
  window.clearTimeout(state.timer);
  state.timer = window.setTimeout(enhance, delay);
}

function enhance() {
  const module = document.getElementById('leitstandPersonnelModule');
  if (!module) return;
  module.classList.toggle('is-collapsed', state.collapsed);
  removeCompactButton(module);
  ensureCollapseButton(module);
  colorizeChart(module);
}

function removeCompactButton(module) {
  module.querySelector('[data-leitstand-module-action="toggle-size"]')?.remove();
}

function ensureCollapseButton(module) {
  const actions = module.querySelector('.module-actions') || module.querySelector('.module-head');
  if (!actions) return;
  let button = actions.querySelector('[data-leitstand-chart-action="collapse-personnel"]');
  if (!button) {
    button = document.createElement('button');
    button.type = 'button';
    button.className = 'mini-btn';
    button.dataset.leitstandChartAction = 'collapse-personnel';
    actions.appendChild(button);
  }
  button.textContent = state.collapsed ? 'öffnen' : 'min';
}

function colorizeChart(module) {
  const svg = module.querySelector('.leitstand-chart svg');
  if (!svg || svg.dataset.leitstandColorized === 'true') return;
  if (svg.querySelector('.line-red, .line-blue, .line-green')) return;
  const original = svg.querySelector('path.line');
  const targetLine = svg.querySelector('line.target');
  const criticalBand = svg.querySelector('rect.critical-band');
  if (!original || !targetLine || !criticalBand) return;

  const targetY = numberAttr(targetLine, 'y1');
  const redTop = numberAttr(criticalBand, 'y');
  const redBottom = redTop + numberAttr(criticalBand, 'height');
  const chartX = numberAttr(criticalBand, 'x');
  const chartW = numberAttr(criticalBand, 'width');
  if (![targetY, redTop, redBottom, chartX, chartW].every(Number.isFinite)) return;

  const defs = svg.querySelector('defs') || svg.insertBefore(document.createElementNS('http://www.w3.org/2000/svg', 'defs'), svg.firstChild);
  const id = `leitstandColor${state.clipId += 1}`;
  defs.appendChild(clip(`${id}Green`, chartX, 0, chartW, targetY));
  defs.appendChild(clip(`${id}Blue`, chartX, targetY, chartW, redTop - targetY));
  defs.appendChild(clip(`${id}Red`, chartX, redTop, chartW, redBottom - redTop));

  original.style.display = 'none';
  original.after(clonePath(original, 'line-green', `${id}Green`), clonePath(original, 'line-blue', `${id}Blue`), clonePath(original, 'line-red', `${id}Red`));
  svg.dataset.leitstandColorized = 'true';
}

function clip(id, x, y, width, height) {
  const clipPath = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
  clipPath.id = id;
  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.setAttribute('x', x);
  rect.setAttribute('y', y);
  rect.setAttribute('width', width);
  rect.setAttribute('height', Math.max(height, 0));
  clipPath.appendChild(rect);
  return clipPath;
}

function clonePath(path, className, clipId) {
  const clone = path.cloneNode(true);
  clone.style.display = '';
  clone.classList.add(className);
  clone.setAttribute('clip-path', `url(#${clipId})`);
  return clone;
}

function numberAttr(element, name) {
  return Number.parseFloat(element.getAttribute(name) || '');
}

function installStyles() {
  if (document.getElementById('leitstandChartFixStyles')) return;
  const style = document.createElement('style');
  style.id = 'leitstandChartFixStyles';
  style.textContent = `
    #leitstandPersonnelModule.is-collapsed{min-height:72px;align-self:start}
    #leitstandPersonnelModule.is-collapsed .mini-kpis,
    #leitstandPersonnelModule.is-collapsed .leitstand-chart{display:none}
    #leitstandPersonnelModule .line-red{stroke:#dc2626!important}
    #leitstandPersonnelModule .line-blue{stroke:#2563eb!important}
    #leitstandPersonnelModule .line-green{stroke:#16a34a!important}
  `;
  document.head.appendChild(style);
}

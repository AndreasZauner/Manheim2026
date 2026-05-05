if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', installPersonnelChartPlacementFix);
} else {
  installPersonnelChartPlacementFix();
}

function installPersonnelChartPlacementFix() {
  if (window.__personnelChartPlacementFixInstalled) return;
  window.__personnelChartPlacementFixInstalled = true;
  injectPlacementStyles();
  bindPlacementEvents();
  observeChartMoves();
  schedulePlacement(80);
  schedulePlacement(700);
  schedulePlacement(1600);
}

function bindPlacementEvents() {
  document.addEventListener('click', event => {
    if (event.target?.closest?.('.nav-btn, .participant-planning-tab')) schedulePlacement(60);
  });
  document.addEventListener('participant-absences-changed', () => schedulePlacement(80));
  window.addEventListener('resize', () => schedulePlacement(120));
}

function observeChartMoves() {
  const observer = new MutationObserver(() => schedulePlacement(0));
  observer.observe(document.body, { childList: true, subtree: true });
}

function schedulePlacement(delay = 0) {
  window.clearTimeout(window.__personnelChartPlacementTimer);
  window.__personnelChartPlacementTimer = window.setTimeout(anchorChart, delay);
}

function anchorChart() {
  const chart = document.getElementById('personnelAttendanceChart');
  if (!chart) return;

  if (!isPersonalActive()) {
    chart.classList.add('hidden');
    return;
  }

  const slot = ensureChartSlot();
  if (!slot) return;
  if (chart.parentElement !== slot) slot.appendChild(chart);
  chart.classList.remove('hidden');
}

function ensureChartSlot() {
  const participantsTab = document.getElementById('participantsTab');
  const planningTabs = document.getElementById('participantPlanningTabs');
  if (!participantsTab || !planningTabs) return null;

  let slot = document.getElementById('personnelAttendanceChartSlot');
  if (!slot) {
    slot = document.createElement('div');
    slot.id = 'personnelAttendanceChartSlot';
    slot.className = 'personnel-attendance-chart-slot';
    planningTabs.insertAdjacentElement('afterend', slot);
  }
  return slot;
}

function isPersonalActive() {
  const app = document.getElementById('app');
  if (!app || app.classList.contains('hidden')) return false;
  const navActive = document.querySelector('.nav-btn[data-tab="participants"]')?.classList.contains('active');
  const participantsTab = document.getElementById('participantsTab');
  return Boolean(navActive && participantsTab?.classList.contains('active'));
}

function injectPlacementStyles() {
  if (document.getElementById('personnelChartPlacementFixStyles')) return;
  const style = document.createElement('style');
  style.id = 'personnelChartPlacementFixStyles';
  style.textContent = `
    body:has(.nav-btn[data-tab="participants"].active) .topbar {
      align-items: center;
      min-height: 0;
      margin-bottom: 10px;
    }
    body:has(.nav-btn[data-tab="participants"].active) .topbar > div:first-child {
      flex: 1 1 auto;
      min-width: 0;
    }
    body:has(.nav-btn[data-tab="participants"].active) .topbar > div:first-child p {
      white-space: normal;
    }
    .personnel-attendance-chart-slot {
      display: flex;
      justify-content: flex-end;
      align-items: flex-start;
      width: 100%;
      margin: 2px 0 10px;
    }
    .personnel-attendance-chart-slot .personnel-attendance-chart.chart-card {
      position: relative !important;
      inset: auto !important;
      top: auto !important;
      right: auto !important;
      flex: 0 1 clamp(520px, 42vw, 650px) !important;
      width: clamp(520px, 42vw, 650px) !important;
      max-width: 100% !important;
      min-width: 0 !important;
      margin: 0 !important;
    }
    @media (max-width: 1180px) {
      .personnel-attendance-chart-slot {
        justify-content: stretch;
      }
      .personnel-attendance-chart-slot .personnel-attendance-chart.chart-card {
        flex-basis: 100% !important;
        width: 100% !important;
        max-width: none !important;
      }
    }
  `;
  document.head.appendChild(style);
}

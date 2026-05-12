if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', installParticipantBootstrap);
} else {
  installParticipantBootstrap();
}

async function installParticipantBootstrap() {
  if (window.__participantBootstrapInstalled) return;
  window.__participantBootstrapInstalled = true;
  import('./auth-login-stabilizer.js?v=login-stabil-20260508-1')
    .catch(error => console.error('Login-Stabilisierung konnte nicht geladen werden', error));
  import('./personal-share-view.js?v=personal-chart-anchor-20260512-1')
    .catch(error => console.error('Personal-Freigabe konnte nicht geladen werden', error));
  waitForAppShell().then(loadAppModules);
}

function isPersonalShareRoute() {
  return new URLSearchParams(window.location.search).get('share') === 'personal';
}

function isAppVisible() {
  const app = document.getElementById('app');
  return Boolean(app && !app.classList.contains('hidden'));
}

function waitForAppShell() {
  if (isPersonalShareRoute() || isAppVisible()) return Promise.resolve();
  return new Promise(resolve => {
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      if (isAppVisible() || Date.now() - startedAt > 120000) {
        window.clearInterval(timer);
        resolve();
      }
    }, 300);
  });
}

async function loadAppModules() {
  if (isPersonalShareRoute() || window.__manheimAppModulesLoaded) return;
  window.__manheimAppModulesLoaded = true;
  const imports = [];
  imports.push(
    import('./personaleinsatz-cleanup-fix.js?v=personaleinsatz-cleanup-20260508-1')
      .catch(error => console.error('Personaleinsatz-Stabilisierung konnte nicht geladen werden', error))
  );
  if (!window.__participantPlanningInstalled) {
    imports.push(
      import('./participant-planning-module.js?v=external-helpers-20260512-1')
        .catch(error => console.error('Teilnehmerplanung konnte nicht geladen werden', error))
    );
  }
  imports.push(
    import('./participant-role-order-module.js?v=role-order-20260504-2')
      .catch(error => console.error('Rollenreihenfolge konnte nicht geladen werden', error))
  );
  imports.push(
    import('./personnel-attendance-chart-module.js?v=personal-chart-anchor-20260512-1')
      .catch(error => console.error('Anwesenheitsdiagramm konnte nicht geladen werden', error))
      .finally(() => import('./personnel-chart-placement-fix.js?v=chart-anchor-20260505-5')
        .catch(error => console.error('Diagrammplatzierung konnte nicht stabilisiert werden', error)))
  );
  imports.push(
    import('./v21-phase12-module.js?v=calendar-nav-fix-20260511-1')
      .catch(error => console.error('v2.1-Umstellung konnte nicht geladen werden', error))
  );
  imports.push(
    import('./idea-lab-module.js?v=idea-lab-20260507-2')
      .then(() => import('./idea-lab-edit-focus-fix.js?v=idea-lab-focus-20260507-2')
        .catch(error => console.error('Ideenlabor-Fokusfix konnte nicht geladen werden', error)))
      .catch(error => console.error('Ideenlabor konnte nicht geladen werden', error))
  );
  imports.push(
    import('./dashboard-command-module.js?v=leitstand-personnel-chart-20260512-1')
      .then(() => import('./dashboard-command-module-fix.js?v=leitstand-fix-20260505-1')
        .catch(error => console.error('Leitstand-Diagrammfix konnte nicht geladen werden', error)))
      .then(() => import('./dashboard-leitstand-layout-fix.js?v=leitstand-layout-20260506-1')
        .catch(error => console.error('Leitstand-Layout konnte nicht stabilisiert werden', error)))
      .then(() => import('./dashboard-weather-module.js?v=weather-v2-20260505-1')
        .catch(error => console.error('Wettermodul konnte nicht geladen werden', error)))
      .then(() => import('./dashboard-weather-map-fix.js?v=weather-map-24h-20260506-1')
        .catch(error => console.error('Interaktive Wetterkarte konnte nicht geladen werden', error)))
      .catch(error => console.error('Leitstandmodule konnten nicht geladen werden', error))
  );
  await Promise.allSettled(imports);
}

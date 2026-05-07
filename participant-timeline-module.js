if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', installParticipantBootstrap);
} else {
  installParticipantBootstrap();
}

async function installParticipantBootstrap() {
  if (window.__participantBootstrapInstalled) return;
  window.__participantBootstrapInstalled = true;
  window.setTimeout(async () => {
    const imports = [];
    if (!window.__participantPlanningInstalled) {
      imports.push(
        import('./participant-planning-module.js?v=authlock-20260501-1')
          .catch(error => console.error('Teilnehmerplanung konnte nicht geladen werden', error))
      );
    }
    imports.push(
      import('./participant-role-order-module.js?v=role-order-20260504-2')
        .catch(error => console.error('Rollenreihenfolge konnte nicht geladen werden', error))
    );
    imports.push(
      import('./personnel-attendance-chart-module.js?v=attendance-chart-20260504-1')
        .catch(error => console.error('Anwesenheitsdiagramm konnte nicht geladen werden', error))
        .finally(() => import('./personnel-chart-placement-fix.js?v=chart-anchor-20260505-5')
          .catch(error => console.error('Diagrammplatzierung konnte nicht stabilisiert werden', error)))
    );
    imports.push(
      import('./v21-phase12-module.js?v=v21-copy-20260505-1')
        .catch(error => console.error('v2.1-Umstellung konnte nicht geladen werden', error))
    );
    imports.push(
      import('./idea-lab-module.js?v=idea-lab-20260507-2')
        .then(() => import('./idea-lab-edit-focus-fix.js?v=idea-lab-focus-20260507-1')
          .catch(error => console.error('Ideenlabor-Fokusfix konnte nicht geladen werden', error)))
        .catch(error => console.error('Ideenlabor konnte nicht geladen werden', error))
    );
    imports.push(
      import('./dashboard-command-module.js?v=weather-v2-20260505-1')
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
  }, 500);
}

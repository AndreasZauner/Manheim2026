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
    await Promise.allSettled(imports);
  }, 500);
}

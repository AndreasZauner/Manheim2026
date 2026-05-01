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
      import('./v21-phase12-module.js?v=authlock-20260501-1')
        .catch(error => console.error('v2.1-Umstellung konnte nicht geladen werden', error))
    );
    await Promise.allSettled(imports);
  }, 500);
}

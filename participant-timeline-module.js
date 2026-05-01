if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', installParticipantBootstrap);
} else {
  installParticipantBootstrap();
}

async function installParticipantBootstrap() {
  if (window.__participantBootstrapInstalled) return;
  window.__participantBootstrapInstalled = true;
  window.setTimeout(async () => {
    try {
      if (!window.__participantPlanningInstalled) {
        await import('./participant-planning-module.js?v=planning-20260501-2');
      }
      await import('./v21-phase12-module.js?v=v21-phase12-1');
    } catch (error) {
      console.error('Teilnehmerplanung konnte nicht geladen werden', error);
    }
  }, 500);
}

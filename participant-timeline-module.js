if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', installParticipantPlanningBootstrap);
} else {
  installParticipantPlanningBootstrap();
}

function installParticipantPlanningBootstrap() {
  if (window.__participantPlanningBootstrapInstalled) return;
  window.__participantPlanningBootstrapInstalled = true;
  window.setTimeout(() => {
    if (window.__participantPlanningInstalled) return;
    import('./participant-planning-module.js?v=planning-20260501-2')
      .catch(error => console.error('Teilnehmerplanung konnte nicht geladen werden', error));
  }, 500);
}

installParticipantCancelledPolish();

function installParticipantCancelledPolish() {
  injectCancelledStyles();
  polishCancelledRows();
  const observer = new MutationObserver(polishCancelledRows);
  observer.observe(document.body, { childList: true, subtree: true });
  window.setInterval(polishCancelledRows, 900);
}

function polishCancelledRows() {
  const host = document.querySelector('#personnelDeploymentView .personnel-rows');
  if (!host) return;
  const rows = [...host.querySelectorAll('.personnel-row')];

  rows.forEach(row => {
    const isCancelled = row.querySelector('.status-abgesagt, .personnel-status-edit-btn.status-abgesagt');
    row.classList.toggle('is-cancelled', Boolean(isCancelled));
    if (!isCancelled) return;

    const wrap = row.querySelector('.personnel-timeline-wrap');
    if (wrap && !wrap.querySelector('.personnel-cancelled-note')) {
      wrap.querySelector('.personnel-timeline')?.remove();
      wrap.insertAdjacentHTML('afterbegin', '<div class="personnel-cancelled-note">Abgesagt - nicht in Auswertung und Diagramm enthalten</div>');
    }
  });

  rows
    .filter(row => row.classList.contains('is-cancelled'))
    .sort((a, b) => a.textContent.localeCompare(b.textContent, 'de'))
    .forEach(row => host.appendChild(row));

  updateVisibleStatistics(host);
}

function updateVisibleStatistics(host) {
  const activeRows = [...host.querySelectorAll('.personnel-row:not(.is-cancelled)')];
  const stats = document.querySelectorAll('#personnelDeploymentView .personnel-stat');
  stats.forEach(card => {
    const label = card.querySelector('span')?.textContent?.trim();
    const value = card.querySelector('strong');
    if (!label || !value) return;

    if (label === 'Gesamt') value.textContent = String(activeRows.length);
    if (label === 'Regul\u00e4r') value.textContent = String(activeRows.filter(row => /regul\u00e4r/i.test(row.textContent)).length);
    if (label === 'Extern') value.textContent = String(activeRows.filter(row => /extern/i.test(row.textContent)).length);
    if (label === 'Kl\u00e4rungsbedarf') value.textContent = String(activeRows.filter(row => row.querySelector('.personnel-badge.warning')).length);
    if (label === 'Mit Anmerkung') value.textContent = String(activeRows.filter(row => row.querySelector('.personnel-note')).length);
  });
}

function injectCancelledStyles() {
  if (document.getElementById('participantCancelledPolishStyles')) return;
  const style = document.createElement('style');
  style.id = 'participantCancelledPolishStyles';
  style.textContent = `
    .personnel-row.is-cancelled { background: #fff5f5; }
    .personnel-row.is-cancelled .personnel-person { border-left: 4px solid #d92d20; }
    .personnel-badge.status-abgesagt { background: #fee4e2; color: #b42318; }
    .personnel-swatch.red { background: #e53e3e; }
    .personnel-cancelled-note {
      border: 1px solid #f7b4ad;
      background: #fee4e2;
      color: #b42318;
      border-radius: 12px;
      padding: 8px 10px;
      font-size: .82rem;
      font-weight: 900;
    }
  `;
  document.head.appendChild(style);
}

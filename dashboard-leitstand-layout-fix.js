(function () {
  if (window.__leitstandLayoutFixInstalled) return;
  window.__leitstandLayoutFixInstalled = true;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installLeitstandLayoutFix);
  } else {
    installLeitstandLayoutFix();
  }

  function installLeitstandLayoutFix() {
    installStyles();
    applyLayout();
    const observer = new MutationObserver(() => window.requestAnimationFrame(applyLayout));
    observer.observe(document.body, { childList: true, subtree: true });
    window.setTimeout(applyLayout, 500);
    window.setTimeout(applyLayout, 1400);
  }

  function applyLayout() {
    const dashboard = document.getElementById('dashboardTab');
    const header = document.getElementById('leitstandCommandHeader');
    const kpiGrid = document.getElementById('kpiGrid');
    const modules = document.querySelector('#leitstandCommandHeader .leitstand-command-modules');
    if (!dashboard || !header || !kpiGrid || !modules) return;

    let title = header.querySelector('.leitstand-layout-title');
    if (!title) {
      title = document.createElement('div');
      title.className = 'leitstand-layout-title';
    }
    if (title.dataset.rendered !== 'true') {
      title.innerHTML = '<span>Leitstand</span><strong>Tages- und Wochenlage</strong>';
      title.dataset.rendered = 'true';
    }

    let kpiHost = header.querySelector('.leitstand-layout-kpis');
    if (!kpiHost) {
      kpiHost = document.createElement('div');
      kpiHost.className = 'leitstand-layout-kpis';
    }

    const oldCopy = header.querySelector('.leitstand-command-copy');
    if (oldCopy) oldCopy.remove();

    if (header.firstElementChild !== title) header.insertAdjacentElement('afterbegin', title);
    if (modules.previousElementSibling !== kpiHost) modules.insertAdjacentElement('beforebegin', kpiHost);
    if (kpiGrid.parentElement !== kpiHost) kpiHost.appendChild(kpiGrid);

    kpiGrid.classList.add('leitstand-kpi-strip', 'is-layout-rail');
    header.classList.add('is-layout-fixed');
    dashboard.classList.add('has-leitstand-layout-fix');
  }

  function installStyles() {
    if (document.getElementById('leitstandLayoutFixStyles')) return;
    const style = document.createElement('style');
    style.id = 'leitstandLayoutFixStyles';
    style.textContent = `
      #dashboardTab.has-leitstand-layout-fix .leitstand-command-header.is-layout-fixed{
        display:grid;
        grid-template-columns:minmax(150px,190px) minmax(0,1fr);
        gap:10px 14px;
        align-items:start;
        margin-bottom:14px;
        max-width:100%;
      }
      #dashboardTab.has-leitstand-layout-fix .leitstand-layout-title{
        grid-column:1/-1;
        display:flex;
        align-items:baseline;
        gap:8px;
        min-width:0;
      }
      #dashboardTab.has-leitstand-layout-fix .leitstand-layout-title span{
        color:#64758a;
        font-size:.7rem;
        font-weight:800;
        letter-spacing:.08em;
        text-transform:uppercase;
      }
      #dashboardTab.has-leitstand-layout-fix .leitstand-layout-title strong{
        color:var(--text);
        font-size:1.08rem;
        line-height:1.15;
      }
      #dashboardTab.has-leitstand-layout-fix .leitstand-layout-kpis{
        grid-column:1;
        min-width:0;
      }
      #dashboardTab.has-leitstand-layout-fix .leitstand-layout-kpis .leitstand-kpi-strip{
        display:grid;
        grid-template-columns:1fr !important;
        gap:7px !important;
        margin:0 !important;
      }
      #dashboardTab.has-leitstand-layout-fix .leitstand-layout-kpis .panel{
        min-height:0;
        padding:8px 9px !important;
        border-radius:8px !important;
      }
      #dashboardTab.has-leitstand-layout-fix .leitstand-layout-kpis .kpi-label{
        font-size:.66rem !important;
        line-height:1.1;
        white-space:normal;
      }
      #dashboardTab.has-leitstand-layout-fix .leitstand-layout-kpis .value{
        font-size:1.15rem !important;
        line-height:1;
        margin-top:2px;
      }
      #dashboardTab.has-leitstand-layout-fix .leitstand-layout-kpis .kpi-note{
        font-size:.65rem !important;
        line-height:1.15;
        margin-top:3px;
      }
      #dashboardTab.has-leitstand-layout-fix .leitstand-command-modules{
        grid-column:2;
        display:grid;
        grid-template-columns:minmax(300px,.88fr) minmax(400px,1.12fr);
        gap:12px;
        min-width:0;
        max-width:100%;
      }
      #dashboardTab.has-leitstand-layout-fix #leitstandPersonnelModule,
      #dashboardTab.has-leitstand-layout-fix #leitstandWeatherModule{
        min-width:0;
      }
      @media (max-width:1500px){
        #dashboardTab.has-leitstand-layout-fix .leitstand-command-header.is-layout-fixed{
          grid-template-columns:1fr;
        }
        #dashboardTab.has-leitstand-layout-fix .leitstand-layout-kpis,
        #dashboardTab.has-leitstand-layout-fix .leitstand-command-modules{
          grid-column:1;
        }
        #dashboardTab.has-leitstand-layout-fix .leitstand-layout-kpis .leitstand-kpi-strip{
          grid-template-columns:repeat(4,minmax(110px,1fr)) !important;
        }
        #dashboardTab.has-leitstand-layout-fix .leitstand-command-modules{
          grid-template-columns:minmax(300px,.9fr) minmax(390px,1.1fr);
        }
      }
      @media (max-width:1180px){
        #dashboardTab.has-leitstand-layout-fix .leitstand-command-modules{
          grid-template-columns:1fr;
        }
      }
      @media (max-width:980px){
        #dashboardTab.has-leitstand-layout-fix .leitstand-layout-kpis .leitstand-kpi-strip{
          grid-template-columns:repeat(2,minmax(0,1fr)) !important;
        }
      }
    `;
    document.head.appendChild(style);
  }
})();

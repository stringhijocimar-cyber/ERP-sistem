// public/js/nav_safety.js
// ============================================================
// Rede de segurança de navegação (anti-crash / anti-spinner).
// Usado por app.js: navigate() envolve cada render de página nestes
// helpers para que NENHUM módulo possa deixar a tela quebrada ou presa
// num spinner eterno — a causa exata do bug histórico da aba Fornecedores.
//
//  - _renderPageError: troca o conteúdo por um card de erro com
//    "Tentar novamente" (re-dispara navigate para a mesma página).
//  - _armSpinnerWatchdog: se, N segundos após navegar, o conteúdo ainda
//    for apenas um placeholder de carregamento, assume travamento e
//    mostra o card de erro.
//
// window.__navToken é incrementado a cada navegação; watchdogs e catches
// tardios comparam o token para não sobrescrever uma página já trocada.
// ============================================================
(function () {
  if (window.__navSafety) return;
  window.__navToken = window.__navToken || 0;

  // Tempo (ms) até o watchdog considerar um spinner como travado.
  const WATCHDOG_MS = (window.NAV_WATCHDOG_MS != null) ? window.NAV_WATCHDOG_MS : 12000;

  function esc(v) {
    return (window.NexusAPI && window.NexusAPI.escapeHtml)
      ? window.NexusAPI.escapeHtml(v)
      : String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function pageIsStuck(main) {
    if (!main) return false;
    const txt = (main.textContent || '').trim();
    const soSpinner = main.querySelector('.spinner, .loading, .loading-spinner');
    const pareceCarregando = /carregando|carregamento/i.test(txt) && txt.length < 140;
    return pareceCarregando || (!!soSpinner && txt.length < 140);
  }

  function _renderPageError(main, meta, err, page) {
    if (!main) return;
    try { console.error(`[navigate] falha ao renderizar "${page}":`, err); } catch (e) {}
    const label = (meta && meta.label) || page || 'módulo';
    const msg = (err && err.message) ? String(err.message) : 'Erro inesperado ao carregar a página.';
    const safePage = String(page || '').replace(/[^a-zA-Z0-9_]/g, '');
    main.innerHTML = `
      <div class="empty-state" style="padding-top:70px">
        <i class="fas fa-triangle-exclamation" style="color:#E8A13A"></i>
        <p style="margin-top:12px;font-size:16px;font-weight:600">Não foi possível carregar ${esc(label)}</p>
        <p style="font-size:13px;margin-top:4px;opacity:.8">${esc(msg)}</p>
        <button class="btn btn-primary" style="margin-top:16px" onclick="navigate('${safePage}')">
          <i class="fas fa-rotate-right"></i> Tentar novamente
        </button>
      </div>`;
  }

  function _armSpinnerWatchdog(main, meta, page, token) {
    setTimeout(() => {
      if (token !== window.__navToken || !main) return; // usuário já navegou
      if (pageIsStuck(main)) {
        _renderPageError(main, meta, new Error('Tempo esgotado ao carregar os dados.'), page);
      }
    }, WATCHDOG_MS);
  }

  window._renderPageError = _renderPageError;
  window._armSpinnerWatchdog = _armSpinnerWatchdog;
  window.__navSafetyPageIsStuck = pageIsStuck; // exposto p/ teste
  window.__navSafety = true;
})();

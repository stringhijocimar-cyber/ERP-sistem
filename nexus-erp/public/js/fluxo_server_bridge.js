/**
 * fluxo_server_bridge.js — Liga o Fluxo de Compras ao backend (aprovação no servidor)
 * ADITIVO. Carregar APÓS pages/fluxo_compras.js E APÓS js/nexus_melhorias.js.
 * Estratégia: a APROVAÇÃO vai ao servidor; depois recarregamos o cache local e
 * re-renderizamos. As leituras seguem síncronas (não mexe nas telas existentes).
 */
(function () {
  'use strict';
  if (typeof window.apiAuth !== 'function') {
    console.warn('[bridge] apiAuth ausente — carregue js/nexus_melhorias.js antes deste arquivo.');
  }

  // -- Sincroniza local -> servidor ao salvar (aditivo: chama o original e envia) --
  function wrapSave(nome, apiPath) {
    const orig = window[nome];
    if (typeof orig !== 'function') return;
    window[nome] = function (d) {
      const r = orig.apply(this, arguments); // mantém o comportamento atual (localStorage)
      try {
        if (window.NEXUS_DEMO_MODE !== true && Array.isArray(d)) {
          apiAuth(apiPath, { method: 'POST', body: JSON.stringify({ data: d }) }).catch(() => {});
        }
      } catch (_) {}
      return r;
    };
  }
  wrapSave('_saveRC',        '/api/rc/sync');
  wrapSave('_saveMapasComp', '/api/mapas/sync');
  wrapSave('_saveRFQFlow',   '/api/rfq/sync');

  // -- Recarrega cache do servidor e re-renderiza --
  async function refreshRC(tab) {
    try { const arr = await apiAuth('/api/rc');    if (Array.isArray(arr)) localStorage.setItem('fa_rcs', JSON.stringify(arr)); } catch (_) {}
    if (typeof switchFluxoTab === 'function') switchFluxoTab(tab || 'processo1');
  }
  async function refreshMapas(tab) {
    try { const arr = await apiAuth('/api/mapas'); if (Array.isArray(arr)) localStorage.setItem('fa_mapas_comp', JSON.stringify(arr)); } catch (_) {}
    if (typeof switchFluxoTab === 'function') switchFluxoTab(tab || 'processo3');
  }

  // ===== PROCESSO 1 — Aprovação da RC (substitui as ações por versões no servidor) =====
  window.abrirAprovarRC = function (id) {
    openModal('Aprovar Requisição', `
      <p style="font-size:13px;color:var(--text-secondary)">Confirmar a aprovação do seu estágio nesta RC? O servidor validará seu perfil e avançará o fluxo.</p>
      <div class="form-group"><label>Observação (opcional)</label><input class="form-control" id="aprc_obs" type="text" placeholder="Comentário do aprovador"></div>
    `, `
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-success" onclick="confirmarAprovarRCServer('${id}')"><i class="fas fa-check"></i> Aprovar</button>
    `);
  };
  window.confirmarAprovarRCServer = async function (id) {
    try {
      await apiAuth('/api/rc/' + id + '/aprovar', { method: 'POST', body: JSON.stringify({ obs: (document.getElementById('aprc_obs') || {}).value || '' }) });
      closeModal(); showToast('Estágio aprovado.', 'success'); await refreshRC('processo1');
    } catch (e) { showToast('Aprovação não efetuada: ' + e.message, 'error'); }
  };
  window.reprovarRC = function (id) {
    openModal('Reprovar Requisição', `
      <div class="form-group"><label>Motivo da reprovação *</label><textarea class="form-control" id="reprc_motivo" rows="3" placeholder="Explique o motivo"></textarea></div>
    `, `
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-danger" onclick="confirmarReprovarRCServer('${id}')"><i class="fas fa-times"></i> Reprovar</button>
    `);
  };
  window.confirmarReprovarRCServer = async function (id) {
    const motivo = (document.getElementById('reprc_motivo') || {}).value || '';
    if (!motivo.trim()) { showToast('Informe o motivo.', 'warning'); return; }
    try { await apiAuth('/api/rc/' + id + '/reprovar', { method: 'POST', body: JSON.stringify({ motivo }) }); closeModal(); showToast('RC reprovada.', 'info'); await refreshRC('processo1'); }
    catch (e) { showToast('Não foi possível reprovar: ' + e.message, 'error'); }
  };

  // ===== PROCESSOS 2–4 — funções de servidor PRONTAS (ligar aos botões) =====
  // Aponte os botões dos Processos 2, 3 e 4 (em _renderProcesso2/3/4) para estas:
  window.aceitarCompradorServer = async function (id) {
    try { await apiAuth('/api/rc/' + id + '/aceitar-comprador', { method: 'POST' }); showToast('RC aceita pelo comprador.', 'success'); await refreshRC('processo2'); }
    catch (e) { showToast('Não foi possível aceitar: ' + e.message, 'error'); }
  };
  window.aprovarMapaServer = async function (id) {
    try { await apiAuth('/api/mapas/' + id + '/aprovar', { method: 'POST' }); showToast('Estágio do mapa aprovado.', 'success'); await refreshMapas('processo3'); }
    catch (e) { showToast('Aprovação não efetuada: ' + e.message, 'error'); }
  };
  window.reprovarMapaServerUI = function (id) {
    openModal('Reprovar Mapa', `
      <div class="form-group"><label>Motivo *</label><textarea class="form-control" id="repmapa_motivo" rows="3"></textarea></div>
    `, `
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-danger" onclick="confirmarReprovarMapaServer('${id}')"><i class="fas fa-times"></i> Reprovar</button>
    `);
  };
  window.confirmarReprovarMapaServer = async function (id) {
    const motivo = (document.getElementById('repmapa_motivo') || {}).value || '';
    if (!motivo.trim()) { showToast('Informe o motivo.', 'warning'); return; }
    try { await apiAuth('/api/mapas/' + id + '/reprovar', { method: 'POST', body: JSON.stringify({ motivo }) }); closeModal(); showToast('Mapa reprovado.', 'info'); await refreshMapas('processo3'); }
    catch (e) { showToast('Não foi possível reprovar: ' + e.message, 'error'); }
  };
  window.emitirPCServer = async function (id) {
    // Canonico via DB.mapas.emitirPC (trava de status "Aprovado" no servidor).
    try { const pc = await DB.mapas.emitirPC(id); showToast('Pedido de compra emitido: ' + ((pc && pc.id) || ''), 'success'); await refreshMapas('processo4'); }
    catch (e) { showToast('Não foi possível emitir o PC: ' + e.message, 'error'); }
  };

  // ===== RELIGAÇÃO DO CAMINHO DO DINHEIRO (NEXUS_SERVER_MODE) =====
  // Aditivo: quando o modo servidor está LIGADO, as ações locais do caminho do
  // dinheiro (que gravavam só no localStorage) passam a delegar ao servidor.
  // Com o modo DESLIGADO (padrão), o comportamento legado é mantido intacto.
  function wrapMoney(nome, serverFn) {
    const orig = window[nome];
    window[nome] = function () {
      if (window.NEXUS_SERVER_MODE === true) return serverFn.apply(this, arguments);
      if (typeof orig === 'function') return orig.apply(this, arguments);
      console.warn('[bridge] função local ausente e modo servidor desligado:', nome);
    };
  }
  // Aprovar mapa → servidor (recheca papel, alçada por estágio, no-double-approval)
  wrapMoney('aprovarMapa2',       function (id) { return window.aprovarMapaServer(id); });
  // Emitir PC a partir do mapa aprovado → servidor (trava de status)
  wrapMoney('emitirPedidoDoMapa', function (id) { return window.emitirPCServer(id); });
  wrapMoney('gerarPedidoDeMapa',  function (id) { return window.emitirPCServer(id); });

  console.info('[NEXUS] bridge de aprovação no servidor ativo. Server mode:', window.NEXUS_SERVER_MODE === true);
})();

/**
 * aceite_servico.js — Aceite de serviço pelo requisitante (fluxo B2).
 * Serviço não entra no almoxarifado: o requisitante atesta a prestação com um
 * checklist técnico previamente acordado. Sem aceite, o pagamento é bloqueado.
 */
const ACEITE_CHECKLIST_PADRAO = [
  'Escopo executado conforme especificação técnica',
  'Prazo de execução cumprido',
  'Qualidade/acabamento conforme acordado',
  'Documentação/relatório entregue',
  'SSMA: sem pendências de segurança',
];

function abrirAceiteServico(pedidoId, numero) {
  if (typeof openModal !== 'function') return;
  const linhas = ACEITE_CHECKLIST_PADRAO.map((txt, i) => `
    <label style="display:flex;gap:8px;align-items:flex-start;padding:6px 0;font-size:13px;cursor:pointer">
      <input type="checkbox" class="ac-item" data-item="${txt.replace(/"/g, '&quot;')}" checked style="margin-top:3px;accent-color:var(--fa-teal)">
      <span>${txt}</span>
    </label>`).join('');
  openModal(`Aceite de Serviço — ${numero || pedidoId}`, `
    <p style="font-size:12px;color:var(--text-muted)">Marque os itens conformes. O aceite só é registrado com <b>todos</b> conformes (regra do gate de pagamento).</p>
    <div id="ac_checklist" style="margin:8px 0">${linhas}</div>
    <div class="form-group"><label>Observações</label><textarea class="form-control" id="ac_obs" rows="2" placeholder="Ressalvas, nº do relatório, etc."></textarea></div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="confirmarAceiteServico('${pedidoId}')"><i class="fas fa-check-circle"></i> Registrar aceite</button>
  `);
}

async function confirmarAceiteServico(pedidoId) {
  const checklist = Array.from(document.querySelectorAll('#ac_checklist .ac-item')).map(el => ({ item: el.dataset.item, conforme: el.checked }));
  const observacoes = document.getElementById('ac_obs')?.value || '';
  if (typeof apiAuth !== 'function') { showToast('Indisponível offline.', 'error'); return; }
  try {
    await apiAuth(`/api/pedidos/${pedidoId}/aceite-servico`, { method: 'POST', body: JSON.stringify({ checklist, observacoes }) });
    closeModal();
    showToast('Aceite de serviço registrado — pagamento liberado pelo gate.', 'success', 6000);
  } catch (e) {
    showToast('Aceite não registrado: ' + e.message, 'error', 7000);
  }
}

window.abrirAceiteServico = abrirAceiteServico;
window.confirmarAceiteServico = confirmarAceiteServico;

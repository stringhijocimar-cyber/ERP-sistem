/**
 * pages/lgpd.js — Painel de Conformidade LGPD
 * Usa js/lib/lgpd.js. Cobre: RoPA (registro de operações de tratamento) com
 * base legal e retenção, solicitações do titular (DSAR) e anonimização de
 * dados pessoais de fornecedor (direito de eliminação).
 */
function _lgpdGet(key) { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) { return []; } }

// RoPA — catálogo das operações de tratamento de dados pessoais do ERP.
const LGPD_ROPA = [
  { dado: 'Fornecedores — contato, e-mail, telefone', finalidade: 'Comunicação comercial e operacional', base: 'Execução de contrato', retencao_meses: 60 },
  { dado: 'Usuários — nome, e-mail', finalidade: 'Controle de acesso e autenticação', base: 'Legítimo interesse', retencao_meses: 24 },
  { dado: 'Logs/auditoria — autor da ação', finalidade: 'Segurança da informação e trilha de auditoria', base: 'Cumprimento de obrigação legal/regulatória', retencao_meses: 60 },
  { dado: 'Avaliações IDF — responsável', finalidade: 'Gestão de desempenho de fornecedores', base: 'Legítimo interesse', retencao_meses: 36 },
];

function renderLGPD() {
  const main = document.getElementById('mainContent') || document.getElementById('main');
  if (!main) return;
  const L = window.LGPD;
  const solicitacoes = _lgpdGet('fa_lgpd_solicitacoes');

  const ropaRows = LGPD_ROPA.map(r => {
    const baseOk = L ? L.validarBaseLegal(r.base) : true;
    return `<tr>
      <td style="padding:6px 8px">${r.dado}</td>
      <td style="padding:6px 8px">${r.finalidade}</td>
      <td style="padding:6px 8px">${r.base} ${baseOk ? '' : '⚠️'}</td>
      <td style="padding:6px 8px;text-align:center">${r.retencao_meses} meses</td>
    </tr>`;
  }).join('');

  const solRows = solicitacoes.map(s => `<tr>
    <td style="padding:6px 8px">${s.tipo || '—'}</td>
    <td style="padding:6px 8px">${(s.titular || '').replace(/</g, '&lt;')}</td>
    <td style="padding:6px 8px">${s.criado_em ? new Date(s.criado_em).toLocaleDateString('pt-BR') : '—'}</td>
    <td style="padding:6px 8px">${s.status || 'Aberta'}</td>
  </tr>`).join('');

  main.innerHTML = `
    <div class="page-header" style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px">
      <div>
        <h2><i class="fas fa-user-shield" style="color:var(--fa-teal);margin-right:10px"></i>Conformidade LGPD</h2>
        <p>Base legal, retenção e direitos do titular. Anonimização de dados pessoais.</p>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-secondary btn-sm" onclick="lgpdNovaSolicitacao()"><i class="fas fa-inbox"></i> Solicitação do titular</button>
        <button class="btn btn-primary btn-sm" onclick="lgpdAnonimizarFornecedor()"><i class="fas fa-user-slash"></i> Anonimizar fornecedor</button>
      </div>
    </div>

    <div class="info-card" style="padding:16px;margin-bottom:16px">
      <strong style="font-size:14px"><i class="fas fa-clipboard-list" style="margin-right:6px"></i>RoPA — Registro de Operações de Tratamento</strong>
      <table class="table" style="width:100%;margin-top:10px;font-size:12px;border-collapse:collapse">
        <thead><tr style="color:var(--text-muted);text-align:left">
          <th style="padding:6px 8px">Dado pessoal</th><th style="padding:6px 8px">Finalidade</th><th style="padding:6px 8px">Base legal (art. 7)</th><th style="padding:6px 8px">Retenção</th>
        </tr></thead>
        <tbody>${ropaRows}</tbody>
      </table>
    </div>

    <div class="info-card" style="padding:16px">
      <strong style="font-size:14px"><i class="fas fa-inbox" style="margin-right:6px"></i>Solicitações do Titular (DSAR)</strong>
      ${solicitacoes.length ? `
      <table class="table" style="width:100%;margin-top:10px;font-size:12px;border-collapse:collapse">
        <thead><tr style="color:var(--text-muted);text-align:left"><th style="padding:6px 8px">Tipo</th><th style="padding:6px 8px">Titular</th><th style="padding:6px 8px">Data</th><th style="padding:6px 8px">Status</th></tr></thead>
        <tbody>${solRows}</tbody>
      </table>` : '<p style="font-size:12px;color:var(--text-muted);margin-top:8px">Nenhuma solicitação registrada. Use "Solicitação do titular" para registrar pedidos de acesso, correção, eliminação ou portabilidade.</p>'}
    </div>

    <div class="info-card" style="padding:16px;margin-top:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <strong style="font-size:14px"><i class="fas fa-clock-rotate-left" style="margin-right:6px"></i>Retenção e expurgo</strong>
        <button class="btn btn-secondary btn-sm" onclick="lgpdPreviewRetencao()"><i class="fas fa-search"></i> Ver vencidos</button>
      </div>
      <p style="font-size:12px;color:var(--text-muted);margin-top:8px">Anonimiza, de forma irreversível, os dados pessoais de fornecedores <strong>inativos</strong> além do período de retenção. Veja a lista antes de executar.</p>
      <div id="lgpd_retencao_result" style="margin-top:8px"></div>
    </div>
  `;
}

function lgpdNovaSolicitacao() {
  if (typeof openModal !== 'function') return;
  openModal('Solicitação do titular (LGPD)', `
    <div class="form-group"><label>Tipo *</label>
      <select class="form-control" id="lgpd_tipo">
        <option>Acesso aos dados</option><option>Correção</option><option>Eliminação/Anonimização</option><option>Portabilidade</option><option>Revogação de consentimento</option>
      </select>
    </div>
    <div class="form-group"><label>Titular (nome/identificação) *</label><input class="form-control" id="lgpd_titular"></div>
    <div class="form-group"><label>Observações</label><textarea class="form-control" id="lgpd_obs" rows="2"></textarea></div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="lgpdSalvarSolicitacao()"><i class="fas fa-save"></i> Registrar</button>
  `);
}

function lgpdSalvarSolicitacao() {
  const titular = (document.getElementById('lgpd_titular')?.value || '').trim();
  if (!titular) { showToast('Informe o titular', 'warning'); return; }
  const lista = _lgpdGet('fa_lgpd_solicitacoes');
  lista.unshift({
    id: 'DSAR-' + Date.now(),
    tipo: document.getElementById('lgpd_tipo')?.value || '',
    titular,
    observacoes: document.getElementById('lgpd_obs')?.value || '',
    status: 'Aberta',
    criado_em: new Date().toISOString(),
  });
  try { localStorage.setItem('fa_lgpd_solicitacoes', JSON.stringify(lista)); } catch (e) {}
  if (typeof logAction === 'function') logAction('Solicitação LGPD', 'LGPD', titular.slice(0, 50));
  closeModal();
  showToast('Solicitação registrada (prazo legal: 15 dias).', 'success');
  renderLGPD();
}

function lgpdAnonimizarFornecedor() {
  if (typeof openModal !== 'function') return;
  openModal('Anonimizar dados de fornecedor', `
    <p style="font-size:13px;color:var(--text-secondary)">Mascara de forma <strong>irreversível</strong> contato, e-mail e telefone do fornecedor (direito de eliminação). A ação fica na trilha de auditoria.</p>
    <div class="form-group"><label>ID do fornecedor *</label><input class="form-control" id="lgpd_forn_id" placeholder="Ex.: 12"></div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-danger" onclick="lgpdConfirmarAnonimizar()"><i class="fas fa-user-slash"></i> Anonimizar</button>
  `);
}

async function lgpdConfirmarAnonimizar() {
  const id = (document.getElementById('lgpd_forn_id')?.value || '').trim();
  if (!id) { showToast('Informe o ID do fornecedor', 'warning'); return; }
  if (typeof apiAuth !== 'function') { showToast('Ação indisponível offline.', 'error'); return; }
  try {
    const f = await apiAuth(`/api/lgpd/anonimizar/fornecedores/${id}`, { method: 'POST' });
    closeModal();
    showToast(`Fornecedor anonimizado: ${f?.email || ''}`, 'success', 5000);
    if (typeof loadFornecedores === 'function') { try { await loadFornecedores(); } catch (e) {} }
  } catch (e) {
    showToast('Não foi possível anonimizar: ' + e.message, 'error');
  }
}

async function lgpdPreviewRetencao() {
  const box = document.getElementById('lgpd_retencao_result');
  if (!box || typeof apiAuth !== 'function') { showToast('Indisponível offline.', 'warning'); return; }
  box.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Buscando vencidos...';
  try {
    const r = await apiAuth('/api/lgpd/retencao/fornecedores');
    if (!r.total) { box.innerHTML = `<div style="font-size:12px;color:#16a34a"><i class="fas fa-check"></i> Nenhum fornecedor vencido (política: ${r.politica_meses} meses).</div>`; return; }
    box.innerHTML = `
      <div style="font-size:12px;margin-bottom:6px"><strong>${r.total}</strong> fornecedor(es) vencido(s) (política: ${r.politica_meses} meses):</div>
      <ul style="font-size:12px;color:var(--text-muted);margin:0 0 8px;padding-left:18px">
        ${r.fornecedores.slice(0, 20).map(f => `<li>#${f.id} — ${(f.nome || '').replace(/</g, '&lt;')} (desde ${String(f.created_at || '').slice(0, 10)})</li>`).join('')}
      </ul>
      <button class="btn btn-danger btn-sm" onclick="lgpdExecutarRetencao()"><i class="fas fa-user-slash"></i> Anonimizar ${r.total} agora</button>`;
  } catch (e) {
    box.innerHTML = `<div style="font-size:12px;color:#dc2626">Erro: ${e.message}</div>`;
  }
}

async function lgpdExecutarRetencao() {
  if (typeof apiAuth !== 'function') return;
  if (!window.confirm('Anonimizar TODOS os fornecedores vencidos? Ação irreversível e auditada.')) return;
  try {
    const r = await apiAuth('/api/lgpd/retencao/fornecedores/executar', { method: 'POST' });
    showToast(`${r.anonimizados} fornecedor(es) anonimizado(s) por retenção.`, 'success', 5000);
    lgpdPreviewRetencao();
  } catch (e) {
    showToast('Falha na execução: ' + e.message, 'error');
  }
}

window.renderLGPD = renderLGPD;
window.lgpdPreviewRetencao = lgpdPreviewRetencao;
window.lgpdExecutarRetencao = lgpdExecutarRetencao;
window.lgpdNovaSolicitacao = lgpdNovaSolicitacao;
window.lgpdSalvarSolicitacao = lgpdSalvarSolicitacao;
window.lgpdAnonimizarFornecedor = lgpdAnonimizarFornecedor;
window.lgpdConfirmarAnonimizar = lgpdConfirmarAnonimizar;

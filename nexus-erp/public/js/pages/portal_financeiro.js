// ============================================================
// Portal do Fornecedor · Dashboard + Financeiro (somente leitura).
// Consome /api/portal/dashboard e /api/portal/financeiro. O servidor
// garante o escopo por fornecedor; aqui é só apresentação.
// ============================================================

const _pfmt = v => typeof fmt === 'function' ? fmt(v) : ('R$ ' + Number(v || 0).toLocaleString('pt-BR'))

// Render puro (testável) dos cards do dashboard do fornecedor.
function _portalDashboardHTML(d) {
  if (!d) return ''
  const card = (icone, titulo, valor, sub, cor) => `
    <div class="info-card" style="padding:14px;flex:1;min-width:170px">
      <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.03em"><i class="fas ${icone}" style="margin-right:5px"></i>${titulo}</div>
      <div style="font-size:20px;font-weight:800;color:${cor || 'var(--text-primary)'};margin-top:4px">${valor}</div>
      ${sub ? `<div style="font-size:11px;color:var(--text-muted)">${sub}</div>` : ''}
    </div>`
  const rfqs = d.rfqs_aguardando || {}
  const ped = d.pedidos_ativos || {}
  const pend = d.pendencias || {}
  const pag = d.pagamentos_proximos || {}
  return `<div style="display:flex;gap:12px;flex-wrap:wrap">
    ${card('fa-file-signature', 'Cotações a responder', rfqs.qtd || 0, rfqs.qtd ? 'responda antes do prazo' : 'nenhuma pendente', rfqs.qtd ? '#d97706' : '#16a34a')}
    ${card('fa-file-invoice', 'Pedidos ativos', ped.qtd || 0, _pfmt(ped.valor))}
    ${card('fa-upload', 'NF a enviar', pend.nf_a_enviar || 0, pend.nf_a_enviar ? 'pedidos sem nota' : 'tudo enviado', pend.nf_a_enviar ? '#dc2626' : '#16a34a')}
    ${card('fa-hand-holding-usd', 'A receber (30 dias)', _pfmt(pag.valor), (pag.qtd || 0) + ' fatura(s)', '#16a34a')}
  </div>`
}

async function _portalCarregarDashboard() {
  const box = document.getElementById('portal_dashboard')
  if (!box || typeof apiAuth !== 'function') return
  try { box.innerHTML = _portalDashboardHTML(await apiAuth('/api/portal/dashboard')) }
  catch (e) { box.style.display = 'none' }
}

// Render puro (testável) do extrato financeiro do fornecedor.
function _portalFinanceiroHTML(d) {
  if (!d) return ''
  const esc = (window.NexusAPI && NexusAPI.escapeHtml) ? NexusAPI.escapeHtml : (s => String(s == null ? '' : s))
  const r = d.resumo || {}
  const faturas = Array.isArray(d.faturas) ? d.faturas : []
  const status = f => f.status === 'Pago'
    ? `<span style="color:#16a34a;font-size:11px;font-weight:600">✓ Pago${f.data_pagamento ? ' em ' + esc(f.data_pagamento) : ''}</span>`
    : `<span style="color:#d97706;font-size:11px;font-weight:600">${esc(f.status || 'Pendente')}</span>`
  const linhas = faturas.length ? faturas.map(f => `<tr>
      <td style="padding:6px 8px">${esc(f.pc_numero || f.numero || '—')}</td>
      <td style="padding:6px 8px">${esc(f.nota_fiscal || '—')}</td>
      <td style="padding:6px 8px">${_pfmt(f.valor)}</td>
      <td style="padding:6px 8px">${esc(f.data_vencimento || '—')}</td>
      <td style="padding:6px 8px">${status(f)}</td>
    </tr>`).join('') : `<tr><td colspan="5" style="padding:8px;color:var(--text-muted)">Nenhuma fatura registrada.</td></tr>`
  const prox = r.proximo_pagamento
  return `
    <strong style="font-size:14px"><i class="fas fa-wallet" style="margin-right:6px"></i>Meu Financeiro</strong>
    <div style="display:flex;gap:24px;flex-wrap:wrap;margin:8px 0 4px;font-size:13px">
      <span>A receber: <b style="color:#d97706">${_pfmt(r.a_receber_total)}</b> (${r.a_receber_qtd || 0})</span>
      <span>Recebido: <b style="color:#16a34a">${_pfmt(r.recebido_total)}</b> (${r.recebido_qtd || 0})</span>
      ${prox ? `<span>Próximo pagamento: <b>${_pfmt(prox.valor)}</b> em ${esc(prox.data_vencimento)}</span>` : ''}
    </div>
    <table class="table" style="width:100%;margin-top:8px;font-size:12px;border-collapse:collapse">
      <thead><tr style="color:var(--text-muted);text-align:left">
        <th style="padding:6px 8px">Pedido</th><th style="padding:6px 8px">NF</th>
        <th style="padding:6px 8px">Valor</th><th style="padding:6px 8px">Vencimento</th><th style="padding:6px 8px">Status</th>
      </tr></thead><tbody>${linhas}</tbody>
    </table>
    <small style="color:var(--text-muted)">Dados somente leitura — divergências, fale com o financeiro da contratante.</small>`
}

async function _portalCarregarFinanceiro() {
  const box = document.getElementById('portal_financeiro')
  if (!box || typeof apiAuth !== 'function') return
  try { box.innerHTML = _portalFinanceiroHTML(await apiAuth('/api/portal/financeiro')) }
  catch (e) { box.style.display = 'none' }
}

window._portalDashboardHTML = _portalDashboardHTML
window._portalCarregarDashboard = _portalCarregarDashboard
window._portalFinanceiroHTML = _portalFinanceiroHTML
window._portalCarregarFinanceiro = _portalCarregarFinanceiro

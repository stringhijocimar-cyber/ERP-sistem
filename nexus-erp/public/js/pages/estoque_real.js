// ============================================================
// Painel real de estoque (servidor): ponto de reposição + valorização
// por custo médio. Injetado na página Almoxarifado (#estoqueRealPanel).
// Consome /api/almoxarifado/reposicao e /valorizacao.
// ============================================================

// Render puro (testável) do painel a partir de {reposicao, valorizacao}.
function _estoqueRealHTML(reposicao, valorizacao) {
  const esc = (window.NexusAPI && NexusAPI.escapeHtml) ? NexusAPI.escapeHtml : (s => String(s == null ? '' : s))
  const m = v => typeof fmt === 'function' ? fmt(v) : ('R$ ' + Number(v || 0).toLocaleString('pt-BR'))
  const rep = (reposicao && reposicao.itens) || []
  const val = valorizacao || { total: 0, por_categoria: [] }

  const linhasRep = rep.length
    ? rep.map(i => `<tr>
        <td style="padding:5px 8px">${esc(i.codigo || '')}</td>
        <td style="padding:5px 8px">${esc(i.descricao || '')}</td>
        <td style="padding:5px 8px;text-align:right;color:#dc2626">${i.quantidade_atual}</td>
        <td style="padding:5px 8px;text-align:right">${i.quantidade_minima}</td>
        <td style="padding:5px 8px;text-align:right;font-weight:700">${i.sugestao_compra}</td>
        <td style="padding:5px 8px;text-align:right">${m(i.custo_estimado)}</td>
      </tr>`).join('')
    : `<tr><td colspan="6" style="padding:8px;color:#16a34a">Nenhum item abaixo do mínimo. 👍</td></tr>`

  const cats = (val.por_categoria || []).map(c => `<div style="display:flex;justify-content:space-between;font-size:12px"><span>${esc(c.categoria)}</span><b>${m(c.valor)}</b></div>`).join('')

  return `
    <div style="display:grid;grid-template-columns:2fr 1fr;gap:12px;margin-bottom:16px">
      <div class="card"><div class="card-body">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
          <h4 style="margin:0 0 6px"><i class="fas fa-cart-arrow-down" style="color:#dc2626"></i> Ponto de reposição (${rep.length})</h4>
          ${rep.length ? `<button class="btn btn-primary btn-sm" onclick="gerarRequisicaoReposicao()"><i class="fas fa-file-invoice"></i> Gerar requisição de compra</button>` : ''}
        </div>
        <table style="width:100%;border-collapse:collapse">
          <thead><tr style="font-size:11px;color:var(--text-muted);text-transform:uppercase">
            <th style="padding:4px 8px;text-align:left">Código</th><th style="padding:4px 8px;text-align:left">Item</th>
            <th style="padding:4px 8px;text-align:right">Saldo</th><th style="padding:4px 8px;text-align:right">Mín</th>
            <th style="padding:4px 8px;text-align:right">Comprar</th><th style="padding:4px 8px;text-align:right">Custo est.</th>
          </tr></thead><tbody>${linhasRep}</tbody>
        </table>
        ${rep.length ? `<small style="color:var(--text-muted)">Custo estimado de reposição: <b>${m(reposicao.custo_estimado_total)}</b></small>` : ''}
      </div></div>
      <div class="card"><div class="card-body">
        <h4 style="margin:0 0 6px"><i class="fas fa-coins" style="color:var(--orange)"></i> Valorização do estoque</h4>
        <div style="font-size:22px;font-weight:800;color:var(--fa-teal)">${m(val.total)}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px">${val.itens || 0} itens · custo médio</div>
        ${cats}
      </div></div>
    </div>`
}

async function _carregarEstoqueReal() {
  const box = document.getElementById('estoqueRealPanel')
  if (!box || typeof apiAuth !== 'function') return
  try {
    const [reposicao, valorizacao] = await Promise.all([
      apiAuth('/api/almoxarifado/reposicao'),
      apiAuth('/api/almoxarifado/valorizacao'),
    ])
    box.innerHTML = _estoqueRealHTML(reposicao, valorizacao)
  } catch (e) { box.innerHTML = '' /* silencioso: página local segue funcionando */ }
}

// Gera uma requisição de compra a partir do ponto de reposição (elo estoque→
// suprimentos) e recarrega o painel.
async function gerarRequisicaoReposicao() {
  try {
    const rc = await apiAuth('/api/almoxarifado/requisicao-reposicao', { method: 'POST', body: {} })
    if (typeof showToast === 'function') showToast(`Requisição ${rc && rc.numero ? rc.numero : ''} gerada (${(rc && rc.itens_repostos) || 0} itens)`, 'success')
    if (typeof logAction === 'function') logAction('Gerar RC reposição', 'almoxarifado')
    await _carregarEstoqueReal()
  } catch (e) {
    if (typeof showToast === 'function') showToast(e && e.message ? e.message : 'Falha ao gerar requisição', 'error')
  }
}

window._estoqueRealHTML = _estoqueRealHTML
window._carregarEstoqueReal = _carregarEstoqueReal
window.gerarRequisicaoReposicao = gerarRequisicaoReposicao

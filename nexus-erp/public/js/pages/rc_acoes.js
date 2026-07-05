// ============================================================
// Ações server-backed da requisição de compra (RC): aprovar e gerar o
// pedido de compra (PC) a partir da RC aprovada. Fecha o caminho
// requisição → pedido. Exposto em window.* para as telas de suprimentos.
// ============================================================

// Aprova a RC no servidor (registra aprovador). Retorna a RC atualizada.
async function aprovarRequisicao(id, opts = {}) {
  try {
    const rc = await apiAuth(`/api/rc/${id}/aprovar`, { method: 'POST', body: {} })
    if (typeof showToast === 'function') showToast(`Requisição aprovada`, 'success')
    if (typeof logAction === 'function') logAction('Aprovar RC', 'rc')
    if (typeof opts.onDone === 'function') opts.onDone(rc)
    return rc
  } catch (e) {
    if (typeof showToast === 'function') showToast(e && e.message ? e.message : 'Falha ao aprovar a requisição', 'error')
    throw e
  }
}

// Gera o pedido de compra a partir da RC aprovada. Exige fornecedor_id
// (homologado). Retorna { pedido, rc }.
async function gerarPedidoDaRequisicao(id, fornecedorId, extra = {}) {
  if (!fornecedorId) {
    if (typeof showToast === 'function') showToast('Selecione o fornecedor para gerar o pedido', 'warning')
    return
  }
  try {
    const r = await apiAuth(`/api/rc/${id}/gerar-pedido`, { method: 'POST', body: { fornecedor_id: fornecedorId, ...extra } })
    const num = r && r.pedido && r.pedido.numero ? r.pedido.numero : ''
    if (typeof showToast === 'function') showToast(`Pedido de compra ${num} gerado`, 'success')
    if (typeof logAction === 'function') logAction('Gerar PC da RC', 'pedidos')
    if (typeof extra.onDone === 'function') extra.onDone(r)
    return r
  } catch (e) {
    if (typeof showToast === 'function') showToast(e && e.message ? e.message : 'Falha ao gerar o pedido', 'error')
    throw e
  }
}

window.aprovarRequisicao = aprovarRequisicao
window.gerarPedidoDaRequisicao = gerarPedidoDaRequisicao

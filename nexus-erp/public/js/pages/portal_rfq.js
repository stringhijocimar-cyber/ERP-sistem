// ============================================================
// Portal do Fornecedor · RFQ (cotação self-service).
// Lista as RFQs onde o fornecedor foi convidado e permite responder/
// revisar a cotação dentro do prazo. Consome /api/portal/rfq*.
// O servidor garante o escopo (convite) — aqui é só apresentação.
// ============================================================

// Render puro (testável) da lista de RFQs do fornecedor.
function _portalRfqHTML(rfqs) {
  const lista = Array.isArray(rfqs) ? rfqs : []
  const esc = (window.NexusAPI && NexusAPI.escapeHtml) ? NexusAPI.escapeHtml : (s => String(s == null ? '' : s))
  if (!lista.length) return `<strong style="font-size:14px"><i class="fas fa-file-signature" style="margin-right:6px"></i>Cotações (RFQ)</strong>
    <p style="font-size:13px;color:var(--text-muted);margin:8px 0 0">Nenhuma solicitação de cotação no momento.</p>`
  const chip = r => {
    if (r.convite_status === 'Respondida') return '<span style="color:#16a34a;font-size:11px;font-weight:600">✓ Respondida</span>'
    if (r.prazo_expirado) return '<span style="color:#dc2626;font-size:11px;font-weight:600">Prazo expirado</span>'
    if (r.pode_responder) return '<span style="color:#d97706;font-size:11px;font-weight:600">Aguardando resposta</span>'
    return `<span style="color:var(--text-muted);font-size:11px">${esc(r.status || '—')}</span>`
  }
  const acao = r => {
    if (r.pode_responder) {
      const rotulo = r.convite_status === 'Respondida' ? 'Revisar cotação' : 'Responder'
      return `<button class="btn btn-primary btn-sm" style="padding:2px 8px;font-size:11px" onclick="portalAbrirCotacao(${r.id})"><i class="fas fa-pen"></i> ${rotulo}</button>`
    }
    return `<button class="btn btn-secondary btn-sm" style="padding:2px 8px;font-size:11px" onclick="portalAbrirCotacao(${r.id})">Ver</button>`
  }
  return `
    <strong style="font-size:14px"><i class="fas fa-file-signature" style="margin-right:6px"></i>Cotações (RFQ) — ${lista.length}</strong>
    <table class="table" style="width:100%;margin-top:10px;font-size:12px;border-collapse:collapse">
      <thead><tr style="color:var(--text-muted);text-align:left">
        <th style="padding:6px 8px">RFQ</th><th style="padding:6px 8px">Título</th>
        <th style="padding:6px 8px">Prazo p/ responder</th><th style="padding:6px 8px">Situação</th><th></th>
      </tr></thead>
      <tbody>${lista.map(r => `<tr>
        <td style="padding:6px 8px">${esc(r.numero)}</td>
        <td style="padding:6px 8px">${esc(r.titulo)}</td>
        <td style="padding:6px 8px">${esc(r.prazo_resposta || '—')}</td>
        <td style="padding:6px 8px">${chip(r)}</td>
        <td style="padding:6px 8px;text-align:right">${acao(r)}</td>
      </tr>`).join('')}</tbody>
    </table>`
}

async function _portalCarregarRFQs() {
  const box = document.getElementById('portal_rfq')
  if (!box || typeof apiAuth !== 'function') return
  try {
    const rfqs = await apiAuth('/api/portal/rfq')
    box.innerHTML = _portalRfqHTML(rfqs)
  } catch (e) { box.style.display = 'none' }
}

// Abre o formulário de cotação (modal) com os dados da RFQ e a cotação
// anterior (se houver) pré-carregada para revisão.
async function portalAbrirCotacao(id) {
  if (typeof openModal !== 'function' || typeof apiAuth !== 'function') return
  let d
  try { d = await apiAuth(`/api/portal/rfq/${id}`) } catch (e) { showToast(e.message, 'error'); return }
  const esc = (window.NexusAPI && NexusAPI.escapeHtml) ? NexusAPI.escapeHtml : (s => String(s == null ? '' : s))
  const cot = d.minha_cotacao
  const itens = (cot && cot.itens && cot.itens.length) ? cot.itens : [{ descricao: '', quantidade: 1, unidade: 'UN', valor_unitario: 0 }]
  const linha = (it, i) => `
    <div class="prfq-item" style="display:grid;grid-template-columns:3fr 70px 60px 110px;gap:6px;margin-bottom:6px">
      <input class="form-control prfq-desc" placeholder="Descrição do item" value="${esc(it.descricao || '')}">
      <input class="form-control prfq-qtd" type="number" min="0" step="0.01" value="${it.quantidade ?? 1}" title="Quantidade">
      <input class="form-control prfq-un" value="${esc(it.unidade || 'UN')}" title="Unidade">
      <input class="form-control prfq-vu" type="number" min="0" step="0.01" value="${it.valor_unitario ?? 0}" title="Preço unitário R$">
    </div>`
  const soLeitura = !d.pode_responder
  openModal(`Cotação — ${esc(d.numero)} · ${esc(d.titulo)}`, `
    ${d.descricao ? `<p style="font-size:12px;color:var(--text-muted)">${esc(d.descricao)}</p>` : ''}
    <p style="font-size:12px">Prazo para responder: <strong>${esc(d.prazo_resposta || '—')}</strong>
      ${d.prazo_expirado ? ' <span style="color:#dc2626">(expirado)</span>' : ''}</p>
    ${soLeitura ? `<p style="font-size:12px;color:#dc2626"><i class="fas fa-lock"></i> RFQ fechada para novas respostas.</p>` : ''}
    <div id="prfq_itens">${itens.map(linha).join('')}</div>
    ${soLeitura ? '' : `<button class="btn btn-secondary btn-sm" onclick="portalAddItemCotacao()"><i class="fas fa-plus"></i> Item</button>`}
    <div class="form-row" style="margin-top:10px">
      <div class="form-group"><label>Prazo de entrega (dias)</label>
        <input class="form-control" id="prfq_prazo" type="number" min="1" value="${(cot && cot.prazo_entrega) || 7}" ${soLeitura ? 'disabled' : ''}></div>
      <div class="form-group"><label>Condição de pagamento</label>
        <input class="form-control" id="prfq_cond" value="${esc((cot && cot.condicao_pagamento) || '28 dias')}" ${soLeitura ? 'disabled' : ''}></div>
    </div>
    <div class="form-group"><label>Observações técnicas</label>
      <textarea class="form-control" id="prfq_obs" rows="2" ${soLeitura ? 'disabled' : ''}>${esc((cot && cot.observacoes) || '')}</textarea></div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
    ${soLeitura ? '' : `<button class="btn btn-primary" onclick="portalEnviarCotacao(${id})"><i class="fas fa-paper-plane"></i> ${cot ? 'Revisar cotação' : 'Enviar cotação'}</button>`}
  `)
}

function portalAddItemCotacao() {
  const box = document.getElementById('prfq_itens')
  if (!box) return
  const div = document.createElement('div')
  div.className = 'prfq-item'
  div.style.cssText = 'display:grid;grid-template-columns:3fr 70px 60px 110px;gap:6px;margin-bottom:6px'
  div.innerHTML = `
    <input class="form-control prfq-desc" placeholder="Descrição do item">
    <input class="form-control prfq-qtd" type="number" min="0" step="0.01" value="1" title="Quantidade">
    <input class="form-control prfq-un" value="UN" title="Unidade">
    <input class="form-control prfq-vu" type="number" min="0" step="0.01" value="0" title="Preço unitário R$">`
  box.appendChild(div)
}

// Coleta os itens do formulário (puro sobre o DOM; testável).
function _portalColetarItens() {
  return Array.from(document.querySelectorAll('.prfq-item')).map(row => ({
    descricao: (row.querySelector('.prfq-desc') || {}).value || '',
    quantidade: Number((row.querySelector('.prfq-qtd') || {}).value) || 1,
    unidade: (row.querySelector('.prfq-un') || {}).value || 'UN',
    valor_unitario: Number((row.querySelector('.prfq-vu') || {}).value) || 0,
  })).filter(i => i.descricao.trim() && i.valor_unitario > 0)
}

async function portalEnviarCotacao(id) {
  const itens = _portalColetarItens()
  if (!itens.length) { showToast('Informe ao menos um item com descrição e preço', 'warning'); return }
  try {
    const r = await apiAuth(`/api/portal/rfq/${id}/cotacao`, { method: 'POST', body: JSON.stringify({
      itens,
      prazo_entrega: Number((document.getElementById('prfq_prazo') || {}).value) || 7,
      condicao_pagamento: (document.getElementById('prfq_cond') || {}).value || '',
      observacoes: (document.getElementById('prfq_obs') || {}).value || '',
    }) })
    if (typeof closeModal === 'function') closeModal()
    showToast(`Cotação ${r && r.revisada ? 'revisada' : 'enviada'} — R$ ${Number((r && r.valor_total) || 0).toLocaleString('pt-BR')}`, 'success')
    _portalCarregarRFQs()
  } catch (e) { showToast(e && e.message ? e.message : 'Falha ao enviar cotação', 'error') }
}

window._portalRfqHTML = _portalRfqHTML
window._portalCarregarRFQs = _portalCarregarRFQs
window._portalColetarItens = _portalColetarItens
window.portalAbrirCotacao = portalAbrirCotacao
window.portalAddItemCotacao = portalAddItemCotacao
window.portalEnviarCotacao = portalEnviarCotacao

// ============================================================
// Portal do Fornecedor · Entregas & OTIF.
// O fornecedor confirma o prazo ou replaneja com justificativa; a entrega
// real vem do recebimento interno. Consome /api/portal/entregas.
// ============================================================

// Render puro (testável) da seção de entregas.
function _portalEntregasHTML(d) {
  if (!d) return ''
  const esc = (window.NexusAPI && NexusAPI.escapeHtml) ? NexusAPI.escapeHtml : (s => String(s == null ? '' : s))
  const m = v => typeof fmt === 'function' ? fmt(v) : ('R$ ' + Number(v || 0).toLocaleString('pt-BR'))
  const lista = Array.isArray(d.entregas) ? d.entregas : []
  const r = d.resumo || {}
  const chip = s => ({
    'Entregue': '<span style="color:#16a34a;font-size:11px;font-weight:600">✓ Entregue</span>',
    'Atrasada': '<span style="color:#dc2626;font-size:11px;font-weight:600">⚠ Atrasada</span>',
    'Replanejada': '<span style="color:#d97706;font-size:11px;font-weight:600">Replanejada</span>',
    'Confirmada': '<span style="color:#0e7c86;font-size:11px;font-weight:600">Confirmada</span>',
  }[s] || `<span style="color:var(--text-muted);font-size:11px">${esc(s || 'Programada')}</span>`)
  const acao = e => e.data_entregue ? '' : `
    <button class="btn btn-primary btn-sm" style="padding:2px 8px;font-size:11px" onclick="portalConfirmarEntrega(${e.id})"><i class="fas fa-check"></i> Confirmar</button>
    <button class="btn btn-secondary btn-sm" style="padding:2px 8px;font-size:11px" onclick="portalReplanejarEntrega(${e.id})">Replanejar</button>`
  const otif = r.otif_pct == null ? 'sem histórico'
    : `<b style="color:${r.otif_pct >= 95 ? '#16a34a' : (r.otif_pct >= 80 ? '#d97706' : '#dc2626')}">${r.otif_pct}%</b>`
  const linhas = lista.length ? lista.map(e => `<tr>
      <td style="padding:6px 8px">${esc(e.pc_numero || '—')}</td>
      <td style="padding:6px 8px">${m(e.valor)}</td>
      <td style="padding:6px 8px">${esc(e.data_prometida || '—')}</td>
      <td style="padding:6px 8px">${esc(e.data_confirmada || '—')}</td>
      <td style="padding:6px 8px">${chip(e.status_efetivo)}</td>
      <td style="padding:6px 8px;text-align:right;white-space:nowrap">${acao(e)}</td>
    </tr>`).join('') : `<tr><td colspan="6" style="padding:8px;color:var(--text-muted)">Nenhuma entrega programada.</td></tr>`
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
      <strong style="font-size:14px"><i class="fas fa-truck" style="margin-right:6px"></i>Minhas Entregas</strong>
      <span style="font-size:12px">OTIF: ${otif} · ${r.atrasadas_abertas || 0} atrasada(s) em aberto</span>
    </div>
    <table class="table" style="width:100%;margin-top:10px;font-size:12px;border-collapse:collapse">
      <thead><tr style="color:var(--text-muted);text-align:left">
        <th style="padding:6px 8px">Pedido</th><th style="padding:6px 8px">Valor</th>
        <th style="padding:6px 8px">Prometida</th><th style="padding:6px 8px">Confirmada</th>
        <th style="padding:6px 8px">Situação</th><th></th>
      </tr></thead><tbody>${linhas}</tbody>
    </table>`
}

// Gráfico de barras puro (testável) da tendência mensal de OTIF.
function _portalOtifTendenciaHTML(buckets) {
  const lista = Array.isArray(buckets) ? buckets : []
  if (!lista.length) return ''
  const cor = p => p == null ? 'var(--border)' : (p >= 95 ? '#16a34a' : (p >= 80 ? '#d97706' : '#dc2626'))
  const barras = lista.map(b => {
    const h = b.otif_pct == null ? 3 : Math.max(3, Math.round(b.otif_pct * 0.6)) // 100% → 60px
    const rot = String(b.mes || '').slice(5) // MM
    return `<div style="display:flex;flex-direction:column;align-items:center;justify-content:flex-end;flex:1;gap:3px">
      <div style="font-size:10px;color:var(--text-muted)">${b.otif_pct == null ? '—' : b.otif_pct + '%'}</div>
      <div title="${b.entregues} entrega(s)" style="width:60%;height:${h}px;background:${cor(b.otif_pct)};border-radius:2px 2px 0 0"></div>
      <div style="font-size:10px;color:var(--text-muted)">${rot}</div>
    </div>`
  }).join('')
  return `<div style="margin-top:12px">
    <div style="font-size:12px;font-weight:700;margin-bottom:4px">Tendência de OTIF (6 meses)</div>
    <div style="display:flex;align-items:flex-end;gap:6px;height:80px;padding:4px 0">${barras}</div>
  </div>`
}

async function _portalCarregarEntregas() {
  const box = document.getElementById('portal_entregas')
  if (!box || typeof apiAuth !== 'function') return
  try {
    let html = _portalEntregasHTML(await apiAuth('/api/portal/entregas'))
    try { html += _portalOtifTendenciaHTML(await apiAuth('/api/portal/otif-tendencia?meses=6')) } catch (e) { /* tendência é opcional */ }
    box.innerHTML = html
  } catch (e) { box.style.display = 'none' }
}

async function portalConfirmarEntrega(id) {
  try {
    await apiAuth(`/api/portal/entregas/${id}/confirmar`, { method: 'POST', body: JSON.stringify({}) })
    showToast('Prazo de entrega confirmado', 'success')
    _portalCarregarEntregas()
  } catch (e) { showToast(e && e.message ? e.message : 'Falha ao confirmar', 'error') }
}

function portalReplanejarEntrega(id) {
  if (typeof openModal !== 'function') return
  openModal('Replanejar entrega', `
    <div class="form-group"><label>Nova data de entrega *</label><input class="form-control" id="pent_data" type="date"></div>
    <div class="form-group"><label>Justificativa * (o comprador será avisado)</label><textarea class="form-control" id="pent_just" rows="2"></textarea></div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="portalEnviarReplanejamento(${id})"><i class="fas fa-calendar-alt"></i> Replanejar</button>
  `)
}

async function portalEnviarReplanejamento(id) {
  const data = (document.getElementById('pent_data') || {}).value || ''
  const just = ((document.getElementById('pent_just') || {}).value || '').trim()
  if (!data || !just) { showToast('Informe a nova data e a justificativa', 'warning'); return }
  try {
    await apiAuth(`/api/portal/entregas/${id}/confirmar`, { method: 'POST', body: JSON.stringify({ data_confirmada: data, justificativa: just }) })
    if (typeof closeModal === 'function') closeModal()
    showToast('Entrega replanejada — o comprador foi avisado', 'success')
    _portalCarregarEntregas()
  } catch (e) { showToast(e && e.message ? e.message : 'Falha ao replanejar', 'error') }
}

window._portalEntregasHTML = _portalEntregasHTML
window._portalOtifTendenciaHTML = _portalOtifTendenciaHTML
window._portalCarregarEntregas = _portalCarregarEntregas
window.portalConfirmarEntrega = portalConfirmarEntrega
window.portalReplanejarEntrega = portalReplanejarEntrega
window.portalEnviarReplanejamento = portalEnviarReplanejamento

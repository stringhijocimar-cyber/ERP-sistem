// ============================================================
// WMS — endereçamento físico do estoque + separação (picking).
// O almoxarifado sabe QUANTO; o WMS sabe ONDE. Consome /api/wms/* e
// /api/almoxarifado/:id/(enderecos|alocar|mover|picking).
// ============================================================

const _WMS_COR = c => c ? '#dc2626' : '#16a34a'

// Render puro da lista de endereços com ocupação.
function _wmsEnderecosHTML(enderecos) {
  const esc = (window.NexusAPI && NexusAPI.escapeHtml) ? NexusAPI.escapeHtml : (s => String(s == null ? '' : s))
  const l = enderecos || []
  const rows = l.map(e => `<tr>
    <td style="font-size:12px;color:var(--fa-teal);font-weight:600">${esc(e.codigo)}</td>
    <td style="font-size:12px">${esc(e.zona || '—')}</td>
    <td style="font-size:12px">${esc(e.descricao || '—')}</td>
    <td style="font-size:12px;text-align:right">${esc(e.usado)}${e.capacidade ? ' / ' + esc(e.capacidade) : ''}</td>
    <td style="min-width:90px">${e.ocupacao_pct == null ? '<span style="font-size:11px;color:var(--text-muted)">s/ cap.</span>' : `<div style="height:6px;background:var(--border-color);border-radius:3px;overflow:hidden"><div style="height:100%;width:${Math.min(100, e.ocupacao_pct)}%;background:${_WMS_COR(e.cheio)}"></div></div><span style="font-size:10px;color:var(--text-muted)">${esc(e.ocupacao_pct)}%${e.cheio ? ' · cheio' : ''}</span>`}</td>
  </tr>`).join('')
  return `<div class="ss-table-wrap"><table class="ss-table">
    <thead><tr><th>Endereço</th><th>Zona</th><th>Descrição</th><th style="text-align:right">Usado/Cap.</th><th>Ocupação</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text-muted)">Nenhum endereço cadastrado</td></tr>'}</tbody>
  </table></div>`
}

// Render puro da posição de um item (onde está + não endereçado).
function _wmsPosicaoHTML(p) {
  const esc = (window.NexusAPI && NexusAPI.escapeHtml) ? NexusAPI.escapeHtml : (s => String(s == null ? '' : s))
  if (!p) return ''
  const rows = (p.posicoes || []).map(x => `<tr>
    <td style="font-size:12px;color:var(--fa-teal)">${esc(x.codigo)}</td>
    <td style="font-size:12px">${esc(x.zona || '—')}</td>
    <td style="font-size:12px;text-align:right;font-weight:700">${esc(x.quantidade)}</td>
  </tr>`).join('')
  return `<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px;font-size:12px">
      <span>Saldo total: <b>${esc(p.quantidade_atual)}</b></span>
      <span>Endereçado: <b style="color:#16a34a">${esc(p.saldo_enderecado)}</b></span>
      <span>A guardar: <b style="color:${p.saldo_nao_enderecado > 0 ? '#d97706' : '#16a34a'}">${esc(p.saldo_nao_enderecado)}</b></span>
    </div>
    ${(p.posicoes || []).length ? `<div class="ss-table-wrap"><table class="ss-table">
      <thead><tr><th>Endereço</th><th>Zona</th><th style="text-align:right">Qtd</th></tr></thead><tbody>${rows}</tbody></table></div>`
      : '<p style="font-size:12px;color:var(--text-muted)">Item ainda não endereçado.</p>'}`
}

function renderWMS() {
  const main = document.getElementById('mainContent')
  if (!main) return
  main.innerHTML = `
    <div class="page-header">
      <div class="page-title"><h2><i class="fas fa-warehouse" style="color:var(--fa-teal);margin-right:8px"></i>WMS — Endereçamento & Separação</h2>
        <p>Onde cada item está fisicamente · alocação · picking sugerido</p></div>
      <div class="page-actions"><button class="btn btn-primary btn-sm" onclick="wmsNovoEndereco()"><i class="fas fa-plus"></i> Novo endereço</button></div>
    </div>
    <div class="ss-card"><div class="ss-card-head"><div class="ss-card-title"><i class="fas fa-map-location-dot" style="color:#0891b2"></i>Endereços do armazém</div></div>
      <div style="padding:10px 14px" id="wmsEnderecos"></div></div>
    <div class="ss-card" style="margin-top:16px"><div class="ss-card-head"><div class="ss-card-title"><i class="fas fa-cubes" style="color:#7c3aed"></i>Posição de item</div>
        <select class="form-control" id="wmsItemSel" style="max-width:280px" onchange="wmsVerPosicao(this.value)"><option value="">Selecione um item…</option></select></div>
      <div style="padding:10px 14px" id="wmsPosicao"><p style="font-size:12px;color:var(--text-muted)">Escolha um item para ver onde está.</p></div></div>`
  _carregarWMS()
}

async function _carregarWMS() {
  if (typeof apiAuth !== 'function') return
  try { document.getElementById('wmsEnderecos').innerHTML = _wmsEnderecosHTML(await apiAuth('/api/wms/enderecos')) } catch (e) {}
  try {
    const itens = await apiAuth('/api/almoxarifado')
    const esc = (window.NexusAPI && NexusAPI.escapeHtml) ? NexusAPI.escapeHtml : (s => String(s == null ? '' : s))
    const sel = document.getElementById('wmsItemSel')
    if (sel) sel.innerHTML = '<option value="">Selecione um item…</option>' + (itens || []).map(i => `<option value="${i.id}">${esc(i.codigo || '')} ${esc(i.descricao || '')}</option>`).join('')
  } catch (e) {}
}

async function wmsVerPosicao(itemId) {
  const box = document.getElementById('wmsPosicao')
  if (!box) return
  if (!itemId) { box.innerHTML = '<p style="font-size:12px;color:var(--text-muted)">Escolha um item para ver onde está.</p>'; return }
  try {
    const p = await apiAuth(`/api/almoxarifado/${itemId}/enderecos`)
    box.innerHTML = _wmsPosicaoHTML(p) +
      `<div style="margin-top:8px"><button class="btn btn-secondary btn-sm" onclick="wmsAlocar(${Number(itemId)})"><i class="fas fa-box"></i> Endereçar</button></div>`
  } catch (e) { box.innerHTML = '<p style="color:#dc2626">Falha ao carregar a posição.</p>' }
}

async function wmsNovoEndereco() {
  if (typeof openModal !== 'function') return
  openModal('Novo endereço de armazém', `
    <div class="form-row">
      <div class="form-group"><label>Código *</label><input class="form-control" id="wms-cod" placeholder="A-01-03"></div>
      <div class="form-group"><label>Zona</label><input class="form-control" id="wms-zona" placeholder="Picking / Recebimento"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Descrição</label><input class="form-control" id="wms-desc"></div>
      <div class="form-group"><label>Capacidade</label><input class="form-control" type="number" id="wms-cap" value="0" min="0"></div>
    </div>`, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="wmsSalvarEndereco()"><i class="fas fa-save"></i> Criar</button>`)
}
async function wmsSalvarEndereco() {
  const g = id => document.getElementById(id)
  try {
    await apiAuth('/api/wms/enderecos', { method: 'POST', body: { codigo: g('wms-cod')?.value?.trim(), zona: g('wms-zona')?.value?.trim() || null, descricao: g('wms-desc')?.value?.trim() || null, capacidade: Number(g('wms-cap')?.value) || 0 } })
    if (typeof showToast === 'function') showToast('Endereço criado', 'success')
    if (typeof closeModal === 'function') closeModal()
    _carregarWMS()
  } catch (e) { if (typeof showToast === 'function') showToast(e && e.message ? e.message : 'Falha ao criar', 'error') }
}

async function wmsAlocar(itemId) {
  let ends = []
  try { ends = await apiAuth('/api/wms/enderecos') } catch (e) {}
  const esc = (window.NexusAPI && NexusAPI.escapeHtml) ? NexusAPI.escapeHtml : (s => String(s == null ? '' : s))
  openModal('Endereçar item', `
    <div class="form-group"><label>Endereço *</label><select class="form-control" id="wms-al-end">${(ends || []).map(e => `<option value="${e.id}">${esc(e.codigo)}${e.zona ? ' — ' + esc(e.zona) : ''}</option>`).join('') || '<option value="">Cadastre um endereço</option>'}</select></div>
    <div class="form-group"><label>Quantidade *</label><input class="form-control" type="number" id="wms-al-qtd" min="0" step="any"></div>`, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="wmsConfirmarAlocacao(${Number(itemId)})"><i class="fas fa-box"></i> Guardar</button>`)
}
async function wmsConfirmarAlocacao(itemId) {
  const g = id => document.getElementById(id)
  try {
    await apiAuth(`/api/almoxarifado/${itemId}/alocar`, { method: 'POST', body: { endereco_id: g('wms-al-end')?.value, quantidade: Number(g('wms-al-qtd')?.value) } })
    if (typeof showToast === 'function') showToast('Item endereçado', 'success')
    if (typeof closeModal === 'function') closeModal()
    wmsVerPosicao(itemId); _carregarWMS()
  } catch (e) { if (typeof showToast === 'function') showToast(e && e.message ? e.message : 'Falha ao endereçar', 'error') }
}

window.renderWMS = renderWMS
window._wmsEnderecosHTML = _wmsEnderecosHTML
window._wmsPosicaoHTML = _wmsPosicaoHTML
window._carregarWMS = _carregarWMS
window.wmsVerPosicao = wmsVerPosicao
window.wmsNovoEndereco = wmsNovoEndereco
window.wmsSalvarEndereco = wmsSalvarEndereco
window.wmsAlocar = wmsAlocar
window.wmsConfirmarAlocacao = wmsConfirmarAlocacao

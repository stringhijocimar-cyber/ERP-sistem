// ============================================================
// PP — Ordens de produção: Planejada → Liberada (gate PPAP+MRP) → Em
// Produção → Concluída. Apontar produção baixa o estoque pela BOM.
// Consome /api/pp/ordens*. Render puro testável + loaders.
// ============================================================

const _PP_COR = { 'Planejada': '#64748b', 'Liberada': '#0ea5e9', 'Em Produção': '#d97706', 'Concluída': '#16a34a', 'Cancelada': '#dc2626' }

// Render puro da lista de ordens (com progresso e ações por status).
function _ppOrdensHTML(ordens) {
  const esc = (window.NexusAPI && NexusAPI.escapeHtml) ? NexusAPI.escapeHtml : (s => String(s == null ? '' : s))
  const l = ordens || []
  const total = l.reduce((s, o) => s + (o.veiculos_plan || 0), 0)
  const prod = l.reduce((s, o) => s + (o.veiculos_produzidos || 0), 0)
  const kpi = (t, v, c) => `<div class="stat-card" style="flex:1;min-width:130px"><div class="stat-label">${t}</div><div class="stat-value" style="color:${c}">${v}</div></div>`
  const rows = l.map(o => {
    const pct = o.veiculos_plan ? Math.round((o.veiculos_produzidos / o.veiculos_plan) * 100) : 0
    const cor = _PP_COR[o.status] || '#64748b'
    return `<tr>
      <td style="font-size:12px;color:var(--fa-teal);font-weight:600">${esc(o.numero)}</td>
      <td style="font-size:12px">${esc(o.projeto || '—')}</td>
      <td style="font-size:12px;text-align:right">${esc(o.veiculos_produzidos)}/${esc(o.veiculos_plan)}</td>
      <td style="min-width:110px"><div style="height:6px;background:var(--border-color);border-radius:3px;overflow:hidden"><div style="height:100%;width:${pct}%;background:${cor}"></div></div><span style="font-size:10px;color:var(--text-muted)">${pct}%</span></td>
      <td><span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:6px;background:${cor}22;color:${cor}">${esc(o.status)}</span></td>
      <td style="white-space:nowrap">
        ${o.status === 'Planejada' ? `<button class="btn btn-sm" style="font-size:11px;padding:3px 8px;background:rgba(14,165,233,.1);color:#0ea5e9" onclick="ppLiberar(${Number(o.id)})"><i class="fas fa-unlock"></i> Liberar</button>` : ''}
        ${['Liberada', 'Em Produção'].includes(o.status) ? `<button class="btn btn-sm" style="font-size:11px;padding:3px 8px;background:rgba(22,163,74,.1);color:#16a34a" onclick="ppApontar(${Number(o.id)})"><i class="fas fa-industry"></i> Apontar</button>` : ''}
      </td>
    </tr>`
  }).join('')
  return `
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px">
      ${kpi('Ordens', l.length, '#0f172a')}
      ${kpi('Veículos planejados', total, '#0ea5e9')}
      ${kpi('Produzidos', prod, '#16a34a')}
      ${kpi('% realizado', total ? Math.round((prod / total) * 100) + '%' : '—', (prod >= total && total ? '#16a34a' : '#d97706'))}
    </div>
    <div class="ss-table-wrap"><table class="ss-table">
      <thead><tr><th>Ordem</th><th>Projeto</th><th style="text-align:right">Prod/Plan</th><th>Progresso</th><th>Status</th><th></th></tr></thead>
      <tbody>${rows || '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-muted)">Nenhuma ordem de produção</td></tr>'}</tbody>
    </table></div>`
}

function renderPP() {
  const main = document.getElementById('mainContent')
  if (!main) return
  main.innerHTML = `
    <div class="page-header">
      <div class="page-title"><h2><i class="fas fa-industry" style="color:var(--fa-teal);margin-right:8px"></i>PP — Ordens de Produção</h2>
        <p>Planejada → Liberada (gate PPAP+MRP) → Em Produção → Concluída · baixa automática da BOM</p></div>
      <div class="page-actions"><button class="btn btn-primary btn-sm" onclick="ppNovaOrdem()"><i class="fas fa-plus"></i> Nova ordem</button></div>
    </div>
    <div id="ppOrdens"></div>`
  _carregarPP()
}

async function _carregarPP() {
  const box = document.getElementById('ppOrdens')
  if (!box || typeof apiAuth !== 'function') return
  try { box.innerHTML = _ppOrdensHTML(await apiAuth('/api/pp/ordens')) }
  catch (e) { box.innerHTML = '<p style="padding:20px;color:var(--text-muted)">Falha ao carregar ordens.</p>' }
}

async function ppNovaOrdem() {
  if (typeof openModal !== 'function') return
  openModal('Nova ordem de produção', `
    <div class="form-row">
      <div class="form-group"><label>Veículos planejados *</label><input class="form-control" type="number" id="pp-qtd" value="1" min="1"></div>
      <div class="form-group"><label>Projeto</label><input class="form-control" id="pp-projeto" placeholder="Ex.: Guarani"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Início</label><input class="form-control" type="date" id="pp-inicio" value="${new Date().toISOString().slice(0,10)}"></div>
      <div class="form-group"><label>Fim previsto</label><input class="form-control" type="date" id="pp-fim"></div>
    </div>
    <div class="form-group"><label>Descrição</label><input class="form-control" id="pp-desc"></div>`, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="ppSalvarOrdem()"><i class="fas fa-save"></i> Criar</button>`)
}
async function ppSalvarOrdem() {
  const g = id => document.getElementById(id)
  try {
    const op = await apiAuth('/api/pp/ordens', { method: 'POST', body: {
      veiculos_plan: parseInt(g('pp-qtd')?.value) || 0, projeto: g('pp-projeto')?.value?.trim() || null,
      data_inicio: g('pp-inicio')?.value || null, data_fim_prevista: g('pp-fim')?.value || null,
      descricao: g('pp-desc')?.value?.trim() || null,
    } })
    if (typeof showToast === 'function') showToast(`${op.numero} criada`, 'success')
    if (typeof closeModal === 'function') closeModal()
    _carregarPP()
  } catch (e) { if (typeof showToast === 'function') showToast(e && e.message ? e.message : 'Falha ao criar ordem', 'error') }
}

async function ppLiberar(id) {
  try {
    const op = await apiAuth(`/api/pp/ordens/${id}/liberar`, { method: 'POST', body: {} })
    if (typeof showToast === 'function') showToast(`${op.numero} liberada para produção`, 'success')
    _carregarPP()
  } catch (e) { if (typeof showToast === 'function') showToast(e && e.message ? e.message : 'Liberação bloqueada', 'error') }
}

async function ppApontar(id) {
  if (typeof openModal !== 'function') return
  openModal('Apontar produção', `
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">Os componentes BUY serão baixados do estoque conforme a BOM (tudo-ou-nada).</div>
    <div class="form-group"><label>Veículos produzidos *</label><input class="form-control" type="number" id="pp-apontar-qtd" value="1" min="1"></div>`, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="ppConfirmarApontamento(${Number(id)})"><i class="fas fa-industry"></i> Apontar</button>`)
}
async function ppConfirmarApontamento(id) {
  try {
    const op = await apiAuth(`/api/pp/ordens/${id}/apontar`, { method: 'POST', body: { veiculos: parseInt(document.getElementById('pp-apontar-qtd')?.value) || 0 } })
    if (typeof showToast === 'function') showToast(`${op.numero}: ${op.veiculos_produzidos}/${op.veiculos_plan}${op.status === 'Concluída' ? ' — concluída!' : ''}`, 'success')
    if (typeof closeModal === 'function') closeModal()
    _carregarPP()
  } catch (e) { if (typeof showToast === 'function') showToast(e && e.message ? e.message : 'Falha no apontamento', 'error') }
}

window.renderPP = renderPP
window._ppOrdensHTML = _ppOrdensHTML
window._carregarPP = _carregarPP
window.ppNovaOrdem = ppNovaOrdem
window.ppSalvarOrdem = ppSalvarOrdem
window.ppLiberar = ppLiberar
window.ppApontar = ppApontar
window.ppConfirmarApontamento = ppConfirmarApontamento

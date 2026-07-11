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
        ${!['Concluída', 'Cancelada'].includes(o.status) ? `<button class="btn-icon" style="background:rgba(220,38,38,.08);color:#dc2626" onclick="ppCancelar(${Number(o.id)})" title="Cancelar ordem"><i class="fas fa-ban"></i></button>` : ''}
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
    <div id="ppOrdens"></div>
    <div id="ppCalendario" style="margin-top:16px"></div>`
  _carregarPP()
  _carregarPPCalendario()
}

const _PP_CAL_COR = { 'Concluído': '#16a34a', 'Em andamento': '#0ea5e9', 'Atrasado': '#dc2626', 'Planejado': '#64748b' }

// Render puro do calendário de produção (plan × real por mês + acumulados).
function _ppCalendarioHTML(d) {
  const esc = (window.NexusAPI && NexusAPI.escapeHtml) ? NexusAPI.escapeHtml : (s => String(s == null ? '' : s))
  if (!d || !Array.isArray(d.meses)) return ''
  const r = d.resumo || {}
  const fmt = v => typeof window.fmt === 'function' ? window.fmt(v) : ('R$ ' + Number(v || 0).toLocaleString('pt-BR'))
  const rows = d.meses.map(m => `<tr>
    <td style="font-size:12px;font-weight:600">${esc(m.label)}</td>
    <td style="font-size:12px;text-align:right">${esc(m.plan)}</td>
    <td style="font-size:12px;text-align:right;font-weight:700">${esc(m.real)}</td>
    <td style="font-size:12px;text-align:right">${m.pct == null ? '—' : esc(m.pct) + '%'}</td>
    <td style="font-size:12px;text-align:right;color:var(--text-muted)">${esc(m.acum_plan)}</td>
    <td style="font-size:12px;text-align:right;color:var(--text-muted)">${esc(m.acum_real)}</td>
    <td><span style="font-size:10px;font-weight:700;color:${_PP_CAL_COR[m.status] || '#64748b'}">${esc(m.status)}</span></td>
  </tr>`).join('')
  return `<div class="ss-card"><div class="ss-card-head">
      <div class="ss-card-title"><i class="fas fa-calendar-days" style="color:#0891b2"></i>Calendário de produção · ${esc(d.ano)}</div>
      <button class="btn btn-secondary btn-sm" onclick="ppDefinirPlano()"><i class="fas fa-pen"></i> Definir plano mensal</button>
    </div>
    <div style="padding:10px 14px">
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:10px;font-size:12px">
        <span>Plano: <b>${esc(r.total_plan || 0)}</b></span>
        <span>Real: <b style="color:#16a34a">${esc(r.total_real || 0)}</b></span>
        <span>Realizado: <b>${r.pct == null ? '—' : esc(r.pct) + '%'}</b></span>
        ${r.atrasados ? `<span style="color:#dc2626">Meses atrasados: <b>${esc(r.atrasados)}</b></span>` : ''}
        <span>Custo de produção: <b>${fmt(r.custo_producao)}</b></span>
      </div>
      <div class="ss-table-wrap"><table class="ss-table">
        <thead><tr><th>Mês</th><th style="text-align:right">Plan</th><th style="text-align:right">Real</th><th style="text-align:right">%</th><th style="text-align:right">Acum. Plan</th><th style="text-align:right">Acum. Real</th><th>Status</th></tr></thead>
        <tbody>${rows}</tbody></table></div>
    </div></div>`
}

async function _carregarPPCalendario() {
  const box = document.getElementById('ppCalendario')
  if (!box || typeof apiAuth !== 'function') return
  try { box.innerHTML = _ppCalendarioHTML(await apiAuth('/api/pp/calendario')) }
  catch (e) { box.innerHTML = '' }
}

async function ppDefinirPlano() {
  if (typeof openModal !== 'function') return
  const mesAtual = new Date().toISOString().slice(0, 7)
  openModal('Definir plano mensal de produção', `
    <div class="form-row">
      <div class="form-group"><label>Mês (YYYY-MM) *</label><input class="form-control" id="pp-plano-mes" value="${mesAtual}" placeholder="2027-01"></div>
      <div class="form-group"><label>Veículos planejados *</label><input class="form-control" type="number" id="pp-plano-qtd" value="0" min="0"></div>
    </div>`, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="ppSalvarPlano()"><i class="fas fa-save"></i> Salvar</button>`)
}
async function ppSalvarPlano() {
  const g = id => document.getElementById(id)
  try {
    await apiAuth('/api/pp/plano', { method: 'POST', body: { mes: g('pp-plano-mes')?.value?.trim(), veiculos_plan: parseInt(g('pp-plano-qtd')?.value) } })
    if (typeof showToast === 'function') showToast('Plano salvo', 'success')
    if (typeof closeModal === 'function') closeModal()
    _carregarPPCalendario()
  } catch (e) { if (typeof showToast === 'function') showToast(e && e.message ? e.message : 'Falha ao salvar plano', 'error') }
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

// Cancelamento congela o restante da ordem (material consumido permanece).
async function ppCancelar(id) {
  try {
    const op = await apiAuth(`/api/pp/ordens/${id}/cancelar`, { method: 'POST', body: {} })
    if (typeof showToast === 'function') showToast(`${op.numero} cancelada`, 'warning')
    _carregarPP()
  } catch (e) { if (typeof showToast === 'function') showToast(e && e.message ? e.message : 'Falha ao cancelar', 'error') }
}
window.ppCancelar = ppCancelar
window._ppCalendarioHTML = _ppCalendarioHTML
window._carregarPPCalendario = _carregarPPCalendario
window.ppDefinirPlano = ppDefinirPlano
window.ppSalvarPlano = ppSalvarPlano

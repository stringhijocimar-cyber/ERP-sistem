// ============================================================
// MM — Materials Management (inspirado em SAP MM). Material master + BOM
// multinível + explosão de necessidade + gate de engenharia (sem liberação
// não compra). Consome /api/mm/*. Render puro testável + loaders.
// ============================================================

const _MM_CRIT_COR = { 'Alta': '#dc2626', 'Média': '#d97706', 'Baixa': '#16a34a' }

// KPIs do MM a partir da lista de materiais (puro, testável).
function _mmResumo(materiais) {
  const l = materiais || []
  const buy = l.filter(m => String(m.make_buy).toUpperCase() === 'BUY')
  const semEng = buy.filter(m => !m.eng_liberado_compras)
  const criticos = l.filter(m => m.criticidade === 'Alta')
  return { total: l.length, buy: buy.length, make: l.length - buy.length, sem_eng: semEng.length, criticos: criticos.length }
}

// Render puro da tabela de materiais (BOM achatada com indentação por nível).
function _mmMateriaisHTML(materiais) {
  const esc = (window.NexusAPI && NexusAPI.escapeHtml) ? NexusAPI.escapeHtml : (s => String(s == null ? '' : s))
  const r = _mmResumo(materiais)
  const kpi = (t, v, c) => `<div class="stat-card" style="flex:1;min-width:130px"><div class="stat-label">${t}</div><div class="stat-value" style="color:${c}">${v}</div></div>`
  const rows = (materiais || []).map(m => {
    const mb = String(m.make_buy || '').toUpperCase()
    const eng = mb === 'BUY'
      ? (m.eng_liberado_compras
        ? '<span style="color:#16a34a;font-weight:700">Liberado</span>'
        : '<span style="color:#dc2626;font-weight:700">Bloqueado</span>')
      : '<span style="color:var(--text-muted)">—</span>'
    const ind = Math.max(0, (Number(m.nivel) || 1) - 1) * 16
    const cc = _MM_CRIT_COR[m.criticidade] || '#64748b'
    return `<tr>
      <td style="font-size:12px"><span style="padding-left:${ind}px;color:var(--fa-teal);font-weight:600">${esc(m.part_number)}</span></td>
      <td style="font-size:12px">${esc(m.descricao || '—')}</td>
      <td style="font-size:12px">${esc(m.sistema || '—')}</td>
      <td><span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:6px;background:${mb === 'MAKE' ? '#6366f122;color:#6366f1' : '#0ea5e922;color:#0ea5e9'}">${esc(mb || '—')}</span></td>
      <td style="font-size:12px;text-align:right">${esc(m.qtd_veiculo)}</td>
      <td><span style="font-size:10px;font-weight:700;color:${cc}">${esc(m.criticidade || '—')}</span></td>
      <td style="font-size:12px">${eng}</td>
      <td style="white-space:nowrap">
        ${mb === 'BUY' && !m.eng_liberado_compras ? `<button class="btn btn-sm" style="font-size:11px;padding:3px 8px;background:rgba(34,197,94,.1);color:#16a34a" onclick="mmLiberarEng(${Number(m.id)})"><i class="fas fa-unlock"></i> Liberar</button>` : ''}
        <button class="btn-icon view" onclick="mmExplodir(${Number(m.id)})" title="Explodir BOM"><i class="fas fa-sitemap"></i></button>
      </td>
    </tr>`
  }).join('')
  return `
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px">
      ${kpi('Materiais', r.total, '#0f172a')}
      ${kpi('BUY / MAKE', r.buy + ' / ' + r.make, '#0ea5e9')}
      ${kpi('BUY sem engenharia', r.sem_eng, (r.sem_eng ? '#dc2626' : '#16a34a'))}
      ${kpi('Críticos (Alta)', r.criticos, (r.criticos ? '#d97706' : '#16a34a'))}
    </div>
    ${r.sem_eng > 0 ? `<div class="ss-alert danger" style="margin-bottom:14px"><i class="fas fa-lock" style="color:#dc2626;margin-top:2px"></i>
      <div><div style="font-weight:700;color:#dc2626">${r.sem_eng} item(ns) BUY sem engenharia liberada</div>
      <div style="font-size:12px;color:var(--text-secondary)">Regra MM: sem desenho liberado para compras, o item não pode ir a sourcing/pedido.</div></div></div>` : ''}
    <div class="ss-table-wrap"><table class="ss-table">
      <thead><tr><th>Part Number</th><th>Descrição</th><th>Sistema</th><th>M/B</th><th style="text-align:right">Qtd/Veíc</th><th>Criticidade</th><th>Engenharia</th><th></th></tr></thead>
      <tbody>${rows || '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--text-muted)">Nenhum material cadastrado</td></tr>'}</tbody>
    </table></div>`
}

function renderMM() {
  const main = document.getElementById('mainContent')
  if (!main) return
  main.innerHTML = `
    <div class="page-header">
      <div class="page-title"><h2><i class="fas fa-sitemap" style="color:var(--fa-teal);margin-right:8px"></i>MM — Gestão de Materiais</h2>
        <p>Material master · BOM multinível · gate de engenharia · explosão de necessidade</p></div>
      <div class="page-actions"><button class="btn btn-primary btn-sm" onclick="mmNovoMaterial()"><i class="fas fa-plus"></i> Novo material</button></div>
    </div>
    <div style="display:flex;gap:10px;align-items:center;margin-bottom:12px;flex-wrap:wrap">
      <label style="font-size:12px;color:var(--text-muted)">Explodir por <input type="number" id="mm-veiculos" value="50" min="1" style="width:70px" class="form-control" style="display:inline-block"> veículo(s)
      <button class="btn btn-secondary btn-sm" onclick="mmExplodirTudo()"><i class="fas fa-calculator"></i> Necessidade total</button></label>
    </div>
    <div id="mmMateriais"></div>
    <div id="mmSourcingBox" style="margin-top:16px"></div>
    <div id="mmExplosaoBox" style="margin-top:16px"></div>`
  _carregarMM()
  _carregarMMSourcing()
}

const _MM_SRC_COR = { 'MAKE': '#6366f1', 'Bloqueado': '#dc2626', 'A cotar': '#d97706', 'Em cotação': '#16a34a' }

// Render puro do painel de sourcing (status por material + RFQ ligada).
function _mmSourcingHTML(d) {
  const esc = (window.NexusAPI && NexusAPI.escapeHtml) ? NexusAPI.escapeHtml : (s => String(s == null ? '' : s))
  if (!d || !d.resumo) return ''
  const r = d.resumo
  const kpi = (t, v, c) => `<div class="stat-card" style="flex:1;min-width:110px"><div class="stat-label">${t}</div><div class="stat-value" style="color:${c}">${v}</div></div>`
  const rows = (d.materiais || []).filter(m => m.status_sourcing !== 'MAKE').map(m => `<tr>
    <td style="font-size:12px;color:var(--fa-teal);font-weight:600">${esc(m.part_number)}</td>
    <td style="font-size:12px">${esc(m.descricao || '—')}</td>
    <td><span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:6px;background:${_MM_SRC_COR[m.status_sourcing] || '#64748b'}22;color:${_MM_SRC_COR[m.status_sourcing] || '#64748b'}">${esc(m.status_sourcing)}</span></td>
    <td style="font-size:12px">${m.rfq_numero ? esc(m.rfq_numero) : '—'}</td>
    <td>${m.status_sourcing === 'A cotar' ? `<button class="btn btn-sm" style="font-size:11px;padding:3px 8px;background:rgba(14,165,233,.1);color:#0ea5e9" onclick="mmGerarRFQ(${Number(m.id)})"><i class="fas fa-paper-plane"></i> Gerar RFQ</button>` : ''}</td>
  </tr>`).join('')
  return `<div class="ss-card"><div class="ss-card-head">
      <div class="ss-card-title"><i class="fas fa-paper-plane" style="color:#0ea5e9"></i>Sourcing — explosão → RFQ automática</div>
      <button class="btn btn-primary btn-sm" onclick="mmGerarRFQsLote()"${r.a_cotar ? '' : ' disabled'}><i class="fas fa-bolt"></i> Gerar RFQs em lote (${r.a_cotar})</button>
    </div>
    <div style="padding:10px 14px">
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px">
        ${kpi('A cotar', r.a_cotar, (r.a_cotar ? '#d97706' : '#16a34a'))}
        ${kpi('Em cotação', r.em_cotacao, '#16a34a')}
        ${kpi('Bloqueados (s/ eng.)', r.bloqueado, (r.bloqueado ? '#dc2626' : '#16a34a'))}
        ${kpi('MAKE (interno)', r.make, '#6366f1')}
      </div>
      <div class="ss-table-wrap"><table class="ss-table">
        <thead><tr><th>Part Number</th><th>Descrição</th><th>Status</th><th>RFQ</th><th></th></tr></thead>
        <tbody>${rows || '<tr><td colspan="5" style="text-align:center;padding:16px;color:var(--text-muted)">Sem itens de compra</td></tr>'}</tbody>
      </table></div>
    </div></div>`
}

async function _carregarMMSourcing() {
  const box = document.getElementById('mmSourcingBox')
  if (!box || typeof apiAuth !== 'function') return
  try { box.innerHTML = _mmSourcingHTML(await apiAuth('/api/mm/sourcing')) }
  catch (e) { box.innerHTML = '' }
}

async function mmGerarRFQ(id) {
  try {
    const rfq = await apiAuth(`/api/mm/materiais/${id}/gerar-rfq`, { method: 'POST', body: { veiculos: _mmVeiculos() } })
    if (typeof showToast === 'function') showToast(`${rfq.numero} gerada`, 'success')
    _carregarMM(); _carregarMMSourcing()
  } catch (e) { if (typeof showToast === 'function') showToast(e && e.message ? e.message : 'Falha ao gerar RFQ', 'error') }
}
async function mmGerarRFQsLote() {
  try {
    const r = await apiAuth('/api/mm/bom/gerar-rfqs', { method: 'POST', body: { veiculos: _mmVeiculos() } })
    const msg = `${r.criadas} RFQ(s) gerada(s)` + (r.puladas ? `, ${r.puladas} ignorada(s)` : '')
    if (typeof showToast === 'function') showToast(msg, r.criadas ? 'success' : 'warning')
    _carregarMM(); _carregarMMSourcing()
  } catch (e) { if (typeof showToast === 'function') showToast(e && e.message ? e.message : 'Falha ao gerar RFQs', 'error') }
}

async function _carregarMM() {
  const box = document.getElementById('mmMateriais')
  if (!box || typeof apiAuth !== 'function') return
  try { box.innerHTML = _mmMateriaisHTML(await apiAuth('/api/mm/materiais')) }
  catch (e) { box.innerHTML = '<p style="padding:20px;color:var(--text-muted)">Falha ao carregar materiais.</p>' }
}

function _mmVeiculos() { return Math.max(1, parseInt(document.getElementById('mm-veiculos')?.value) || 1) }

// Explosão de um material (subárvore) → tabela de necessidade.
async function mmExplodir(id) {
  try {
    const ex = await apiAuth(`/api/mm/materiais/${id}/explosao?veiculos=${_mmVeiculos()}`)
    _mmRenderExplosao(ex, `Explosão do material #${id}`)
  } catch (e) { if (typeof showToast === 'function') showToast('Falha ao explodir BOM', 'error') }
}
async function mmExplodirTudo() {
  try {
    const ex = await apiAuth(`/api/mm/bom/explosao?veiculos=${_mmVeiculos()}`)
    _mmRenderExplosao(ex, `Necessidade total (${_mmVeiculos()} veículos)`)
  } catch (e) { if (typeof showToast === 'function') showToast('Falha ao explodir BOM', 'error') }
}
function _mmRenderExplosao(ex, titulo) {
  const esc = (window.NexusAPI && NexusAPI.escapeHtml) ? NexusAPI.escapeHtml : (s => String(s == null ? '' : s))
  const box = document.getElementById('mmExplosaoBox')
  if (!box) return
  const rows = (ex || []).map(e => `<tr>
    <td style="font-size:12px"><span style="padding-left:${(Number(e.profundidade) || 0) * 16}px;color:var(--fa-teal)">${esc(e.part_number)}</span></td>
    <td style="font-size:12px">${esc(e.descricao || '—')}</td>
    <td><span style="font-size:10px;font-weight:700">${esc(e.make_buy)}</span></td>
    <td style="font-size:12px;text-align:right">${esc(e.qtd_por_veiculo)}</td>
    <td style="font-size:12px;text-align:right;font-weight:700">${esc(e.qtd_total)}</td>
  </tr>`).join('')
  box.innerHTML = `<div class="ss-card"><div class="ss-card-head"><div class="ss-card-title"><i class="fas fa-calculator" style="color:#6366f1"></i>${esc(titulo)}</div></div>
    <div class="ss-table-wrap" style="padding:8px"><table class="ss-table">
    <thead><tr><th>Part Number</th><th>Descrição</th><th>M/B</th><th style="text-align:right">Qtd/Veíc</th><th style="text-align:right">Qtd Total</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="5" style="text-align:center;padding:16px;color:var(--text-muted)">Sem itens</td></tr>'}</tbody></table></div></div>`
}

async function mmLiberarEng(id) {
  if (typeof openModal !== 'function') return
  openModal('Liberar engenharia p/ compras', `
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">Sem desenho + revisão o item não pode ir a sourcing (regra MM).</div>
    <div class="form-row">
      <div class="form-group"><label>Nº do desenho *</label><input class="form-control" id="mm-eng-desenho" placeholder="DWG-MEC-100-001"></div>
      <div class="form-group"><label>Revisão *</label><input class="form-control" id="mm-eng-rev" placeholder="01"></div>
    </div>`, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="mmConfirmarLiberacao(${Number(id)})"><i class="fas fa-unlock"></i> Liberar</button>`)
}
async function mmConfirmarLiberacao(id) {
  const body = { eng_desenho: document.getElementById('mm-eng-desenho')?.value?.trim(), eng_revisao: document.getElementById('mm-eng-rev')?.value?.trim() }
  try {
    await apiAuth(`/api/mm/materiais/${id}/liberar-engenharia`, { method: 'POST', body })
    if (typeof showToast === 'function') showToast('Engenharia liberada para compras', 'success')
    if (typeof closeModal === 'function') closeModal()
    _carregarMM()
  } catch (e) { if (typeof showToast === 'function') showToast(e && e.message ? e.message : 'Falha ao liberar', 'error') }
}

async function mmNovoMaterial() {
  if (typeof openModal !== 'function') return
  let mats = []
  try { mats = await apiAuth('/api/mm/materiais') } catch (e) { mats = [] }
  const esc = (window.NexusAPI && NexusAPI.escapeHtml) ? NexusAPI.escapeHtml : (s => String(s == null ? '' : s))
  const opts = (mats || []).map(m => `<option value="${m.id}">${esc(m.part_number)} — ${esc(m.descricao || '')}</option>`).join('')
  openModal('Novo material (BOM)', `
    <div class="form-row">
      <div class="form-group"><label>Part Number *</label><input class="form-control" id="mm-pn" placeholder="MEC-100-001"></div>
      <div class="form-group"><label>Make / Buy</label><select class="form-control" id="mm-mb"><option>BUY</option><option>MAKE</option></select></div>
    </div>
    <div class="form-group"><label>Descrição</label><input class="form-control" id="mm-desc"></div>
    <div class="form-row">
      <div class="form-group"><label>Sistema</label><input class="form-control" id="mm-sistema" placeholder="Mecânica"></div>
      <div class="form-group"><label>Subsistema</label><input class="form-control" id="mm-subsistema" placeholder="Powertrain"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Peça pai</label><select class="form-control" id="mm-pai"><option value="">— (raiz)</option>${opts}</select></div>
      <div class="form-group"><label>Nível</label><input class="form-control" type="number" id="mm-nivel" value="1" min="1"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Qtd por veículo</label><input class="form-control" type="number" id="mm-qtd" value="1" step="any"></div>
      <div class="form-group"><label>Criticidade</label><select class="form-control" id="mm-crit"><option>Média</option><option>Alta</option><option>Baixa</option></select></div>
    </div>`, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="mmSalvarMaterial()"><i class="fas fa-save"></i> Cadastrar</button>`)
}
async function mmSalvarMaterial() {
  const g = id => document.getElementById(id)
  const body = {
    part_number: g('mm-pn')?.value?.trim(), make_buy: g('mm-mb')?.value, descricao: g('mm-desc')?.value?.trim() || null,
    sistema: g('mm-sistema')?.value?.trim() || null, subsistema: g('mm-subsistema')?.value?.trim() || null,
    peca_pai_id: g('mm-pai')?.value || null, nivel: parseInt(g('mm-nivel')?.value) || 1,
    qtd_veiculo: Number(g('mm-qtd')?.value) || 1, criticidade: g('mm-crit')?.value,
  }
  if (!body.part_number) { if (typeof showToast === 'function') showToast('Informe o Part Number', 'warning'); return }
  try {
    await apiAuth('/api/mm/materiais', { method: 'POST', body })
    if (typeof showToast === 'function') showToast('Material cadastrado', 'success')
    if (typeof closeModal === 'function') closeModal()
    _carregarMM()
  } catch (e) { if (typeof showToast === 'function') showToast(e && e.message ? e.message : 'Falha ao cadastrar', 'error') }
}

window.renderMM = renderMM
window._mmMateriaisHTML = _mmMateriaisHTML
window._mmResumo = _mmResumo
window._carregarMM = _carregarMM
window.mmExplodir = mmExplodir
window.mmExplodirTudo = mmExplodirTudo
window.mmLiberarEng = mmLiberarEng
window.mmConfirmarLiberacao = mmConfirmarLiberacao
window.mmNovoMaterial = mmNovoMaterial
window.mmSalvarMaterial = mmSalvarMaterial
window._mmSourcingHTML = _mmSourcingHTML
window._carregarMMSourcing = _carregarMMSourcing
window.mmGerarRFQ = mmGerarRFQ
window.mmGerarRFQsLote = mmGerarRFQsLote

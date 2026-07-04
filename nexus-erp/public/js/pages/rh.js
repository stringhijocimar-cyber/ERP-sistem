// ============================================================
// RH — Colaboradores & Apontamento de Horas.
// Consome /api/colaboradores e /api/apontamentos-hora. A mão de obra
// apontada compõe o custo dos serviços na DRE real.
// ============================================================

// Cache dos colaboradores carregados (evita injetar dados no onclick).
let _rhColabs = []

// Helper puro (testável): agrega colaboradores em números de topo.
function _rhResumo(colabs) {
  const lista = Array.isArray(colabs) ? colabs : []
  const ativos = lista.filter(c => c.status === 'Ativo').length
  const custoHoraMedio = lista.length
    ? Math.round(lista.reduce((s, c) => s + (Number(c.custo_hora) || 0), 0) / lista.length * 100) / 100
    : 0
  return { total: lista.length, ativos, inativos: lista.length - ativos, custoHoraMedio }
}

async function renderRH() {
  const el = document.getElementById('mainContent')
  if (!el) return
  el.innerHTML = `
    <div class="page-header">
      <div>
        <h1><i class="fas fa-users"></i> RH — Colaboradores</h1>
        <p class="page-subtitle">Cadastro com custo/hora e apontamento de horas em contratos (alimenta a margem da DRE).</p>
      </div>
      <div>
        <button class="btn btn-primary" onclick="abrirNovoColaborador()"><i class="fas fa-user-plus"></i> Novo colaborador</button>
        <button class="btn btn-secondary btn-sm" onclick="renderRH()"><i class="fas fa-sync-alt"></i> Atualizar</button>
      </div>
    </div>
    <div id="rhResumo"></div>
    <div id="rhLista" class="card"><p style="padding:20px;color:#888">Carregando colaboradores...</p></div>
    <div id="rhForm"></div>
  `
  await _carregarRH()
}

async function _carregarRH() {
  const box = document.getElementById('rhLista')
  try {
    const colabs = await apiAuth('/api/colaboradores') || []
    _rhColabs = Array.isArray(colabs) ? colabs : []
    document.getElementById('rhResumo').innerHTML = _rhResumoHTML(_rhResumo(colabs))
    if (!colabs.length) {
      box.innerHTML = '<p style="padding:20px;color:#888">Nenhum colaborador cadastrado. Clique em “Novo colaborador”.</p>'
      return
    }
    const esc = (window.NexusAPI && NexusAPI.escapeHtml) ? NexusAPI.escapeHtml : (s => String(s == null ? '' : s))
    const rows = colabs.map(c => `<tr>
      <td>${esc(c.nome)}</td>
      <td>${esc(c.cargo || '—')}</td>
      <td>${esc(c.departamento || '—')}</td>
      <td style="text-align:right">${fmt(c.custo_hora)}/h</td>
      <td><span class="badge">${esc(c.status || 'Ativo')}</span></td>
      <td style="white-space:nowrap">
        <button class="btn btn-primary btn-sm" onclick="abrirApontarHoras(${c.id})">Apontar horas</button>
      </td>
    </tr>`).join('')
    box.innerHTML = `
      <h3 style="margin-top:0"><i class="fas fa-id-badge"></i> Colaboradores (${colabs.length})</h3>
      <table class="data-table"><thead><tr>
        <th>Nome</th><th>Cargo</th><th>Departamento</th><th style="text-align:right">Custo/hora</th><th>Status</th><th>Ações</th>
      </tr></thead><tbody>${rows}</tbody></table>`
  } catch (e) {
    box.innerHTML = `<p style="padding:20px;color:#dc2626">Não foi possível carregar (módulo não conectado).</p>`
  }
}

function _rhResumoHTML(r) {
  if (!r) return ''
  const card = (t, v, c) => `<div class="stat-card" style="flex:1"><div class="stat-label">${t}</div><div class="stat-value" style="color:${c}">${v}</div></div>`
  return `<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px">
    ${card('Colaboradores', r.total, '#0f172a')}
    ${card('Ativos', r.ativos, '#16a34a')}
    ${card('Inativos', r.inativos, '#9ca3af')}
    ${card('Custo/hora médio', fmt(r.custoHoraMedio), '#2563eb')}
  </div>`
}

function abrirNovoColaborador() {
  document.getElementById('rhForm').innerHTML = `
    <div class="card" style="margin-top:16px">
      <h3 style="margin-top:0">Novo colaborador</h3>
      <div style="display:flex;gap:12px;flex-wrap:wrap">
        <div><label>Nome *</label><br><input id="rh_nome" class="input"></div>
        <div><label>Cargo</label><br><input id="rh_cargo" class="input"></div>
        <div><label>Departamento</label><br><input id="rh_dep" class="input"></div>
        <div><label>Custo/hora (R$) *</label><br><input id="rh_custo" class="input" type="number" step="0.01" min="0" value="0"></div>
      </div>
      <div style="margin-top:12px">
        <button class="btn btn-primary" onclick="salvarColaborador()">Salvar</button>
        <button class="btn btn-secondary" onclick="document.getElementById('rhForm').innerHTML=''">Cancelar</button>
      </div>
    </div>`
}

async function salvarColaborador() {
  const nome = (document.getElementById('rh_nome') || {}).value || ''
  const custo = (document.getElementById('rh_custo') || {}).value || '0'
  if (!nome.trim()) { showToast('Informe o nome', 'warning'); return }
  try {
    await apiAuth('/api/colaboradores', { method: 'POST', body: {
      nome: nome.trim(),
      cargo: (document.getElementById('rh_cargo') || {}).value || '',
      departamento: (document.getElementById('rh_dep') || {}).value || '',
      custo_hora: Number(custo) || 0,
    } })
    showToast('Colaborador cadastrado', 'success')
    document.getElementById('rhForm').innerHTML = ''
    await _carregarRH()
  } catch (e) {
    showToast(e && e.message ? e.message : 'Falha ao salvar', 'error')
  }
}

function abrirApontarHoras(id) {
  const esc = (window.NexusAPI && NexusAPI.escapeHtml) ? NexusAPI.escapeHtml : (s => String(s == null ? '' : s))
  const colab = _rhColabs.find(c => String(c.id) === String(id))
  const nome = colab ? esc(colab.nome) : ''
  document.getElementById('rhForm').innerHTML = `
    <div class="card" style="margin-top:16px">
      <h3 style="margin-top:0">Apontar horas — ${nome}</h3>
      <div style="display:flex;gap:12px;flex-wrap:wrap">
        <div><label>Contrato</label><br><input id="ap_contrato" class="input" placeholder="CT-..."></div>
        <div><label>Data</label><br><input id="ap_data" class="input" type="date"></div>
        <div><label>Horas *</label><br><input id="ap_horas" class="input" type="number" step="0.5" min="0"></div>
        <div style="flex:1"><label>Descrição</label><br><input id="ap_desc" class="input" style="width:100%"></div>
      </div>
      <div style="margin-top:12px">
        <button class="btn btn-primary" onclick="salvarApontamento(${id})">Lançar</button>
        <button class="btn btn-secondary" onclick="document.getElementById('rhForm').innerHTML=''">Cancelar</button>
      </div>
    </div>`
}

async function salvarApontamento(colaboradorId) {
  const horas = (document.getElementById('ap_horas') || {}).value || ''
  if (!(Number(horas) > 0)) { showToast('Informe as horas', 'warning'); return }
  try {
    await apiAuth('/api/apontamentos-hora', { method: 'POST', body: {
      colaborador_id: colaboradorId,
      contrato_id: (document.getElementById('ap_contrato') || {}).value || '',
      data: (document.getElementById('ap_data') || {}).value || '',
      horas: Number(horas),
      descricao: (document.getElementById('ap_desc') || {}).value || '',
    } })
    showToast('Horas apontadas — custo lançado', 'success')
    document.getElementById('rhForm').innerHTML = ''
  } catch (e) {
    showToast(e && e.message ? e.message : 'Falha ao apontar', 'error')
  }
}

// Exposição global (o app chama por window.*).
window.renderRH = renderRH
window._carregarRH = _carregarRH
window._rhResumo = _rhResumo
window._rhResumoHTML = _rhResumoHTML
window.abrirNovoColaborador = abrirNovoColaborador
window.salvarColaborador = salvarColaborador
window.abrirApontarHoras = abrirApontarHoras
window.salvarApontamento = salvarApontamento

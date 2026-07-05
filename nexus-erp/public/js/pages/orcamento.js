// ============================================================
// Orçamento Anual (budget) × Realizado. Define metas mensais e compara
// com o realizado da DRE (desvio e % atingido). Consome /api/orcamento.
// ============================================================

const _MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

// Render puro (testável) da grade orçado × realizado.
function _orcamentoHTML(o) {
  if (!o) return ''
  const m = v => typeof fmt === 'function' ? fmt(v) : ('R$ ' + Number(v || 0).toLocaleString('pt-BR'))
  const corReceita = p => p >= 100 ? '#16a34a' : (p >= 80 ? '#d97706' : '#dc2626')
  const corCusto = d => d <= 0 ? '#16a34a' : '#dc2626' // custo abaixo da meta é bom
  const linhas = (o.meses || []).map((mm, i) => `<tr>
    <td style="padding:5px 8px;font-weight:600">${_MESES[i]}</td>
    <td style="padding:5px 8px;text-align:right">${m(mm.receita.meta)}</td>
    <td style="padding:5px 8px;text-align:right">${m(mm.receita.real)}</td>
    <td style="padding:5px 8px;text-align:right;font-weight:700;color:${corReceita(mm.receita.atingido_pct)}">${mm.receita.atingido_pct}%</td>
    <td style="padding:5px 8px;text-align:right">${m(mm.custo.real)}</td>
    <td style="padding:5px 8px;text-align:right;color:${corCusto(mm.custo.desvio)}">${m(mm.custo.desvio)}</td>
    <td style="padding:5px 8px;text-align:right;font-weight:700;color:${mm.resultado_real >= mm.resultado_meta ? '#16a34a' : '#dc2626'}">${m(mm.resultado_real)}</td>
    <td style="padding:5px 8px;text-align:center"><button class="btn btn-xs btn-secondary" onclick="abrirMetaMes(${mm.mes})">Meta</button></td>
  </tr>`).join('')
  const t = o.total
  return `
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px">
      <div class="stat-card" style="flex:1"><div class="stat-label">Receita — meta</div><div class="stat-value">${m(t.receita.meta)}</div></div>
      <div class="stat-card" style="flex:1"><div class="stat-label">Receita — realizada</div><div class="stat-value" style="color:${corReceita(t.receita.atingido_pct)}">${m(t.receita.real)} (${t.receita.atingido_pct}%)</div></div>
      <div class="stat-card" style="flex:1"><div class="stat-label">Resultado — meta</div><div class="stat-value">${m(t.resultado_meta)}</div></div>
      <div class="stat-card" style="flex:1"><div class="stat-label">Resultado — realizado</div><div class="stat-value" style="color:${t.resultado_real >= t.resultado_meta ? '#16a34a' : '#dc2626'}">${m(t.resultado_real)}</div></div>
    </div>
    <div class="card"><div class="card-body">
      <table style="width:100%;border-collapse:collapse">
        <thead><tr style="font-size:11px;color:var(--text-muted);text-transform:uppercase">
          <th style="padding:4px 8px;text-align:left">Mês</th>
          <th style="padding:4px 8px;text-align:right">Receita meta</th>
          <th style="padding:4px 8px;text-align:right">Receita real</th>
          <th style="padding:4px 8px;text-align:right">Atingido</th>
          <th style="padding:4px 8px;text-align:right">Custo real</th>
          <th style="padding:4px 8px;text-align:right">Desvio custo</th>
          <th style="padding:4px 8px;text-align:right">Resultado</th>
          <th style="padding:4px 8px;text-align:center">—</th>
        </tr></thead>
        <tbody>${linhas}</tbody>
      </table>
    </div></div>`
}

async function renderOrcamento() {
  const el = document.getElementById('mainContent')
  if (!el) return
  window._orcamentoAno = window._orcamentoAno || new Date().getFullYear()
  el.innerHTML = `
    <div class="page-header">
      <div>
        <h1><i class="fas fa-bullseye"></i> Orçamento Anual</h1>
        <p class="page-subtitle">Metas mensais × realizado da DRE — desvio e % de atingimento.</p>
      </div>
      <div>
        <input id="orcAno" class="input" type="number" value="${window._orcamentoAno}" style="width:90px" onchange="window._orcamentoAno=parseInt(this.value)||new Date().getFullYear();renderOrcamento()">
        <button class="btn btn-secondary btn-sm" onclick="renderOrcamento()"><i class="fas fa-sync-alt"></i> Atualizar</button>
      </div>
    </div>
    <div id="orcConteudo"><p style="padding:20px;color:#888">Carregando orçamento...</p></div>
    <div id="orcForm"></div>
  `
  await _carregarOrcamento()
}

async function _carregarOrcamento() {
  const box = document.getElementById('orcConteudo')
  try {
    const o = await apiAuth(`/api/orcamento?ano=${window._orcamentoAno}`)
    window._orcamentoAtual = o
    box.innerHTML = _orcamentoHTML(o)
  } catch (e) {
    box.innerHTML = `<p style="padding:20px;color:#dc2626">Não foi possível carregar (módulo não conectado).</p>`
  }
}

function abrirMetaMes(mes) {
  const o = window._orcamentoAtual
  const atual = (o && o.meses && o.meses[mes - 1]) || {}
  const rv = (atual.receita && atual.receita.meta) || 0
  const cv = (atual.custo && atual.custo.meta) || 0
  const dv = (atual.despesa && atual.despesa.meta) || 0
  document.getElementById('orcForm').innerHTML = `
    <div class="card" style="margin-top:16px"><div class="card-body">
      <h3 style="margin-top:0">Meta de ${_MESES[mes - 1]}/${window._orcamentoAno}</h3>
      <div style="display:flex;gap:12px;flex-wrap:wrap">
        <div><label>Receita meta</label><br><input id="meta_receita" class="input" type="number" step="0.01" min="0" value="${rv}"></div>
        <div><label>Custo meta</label><br><input id="meta_custo" class="input" type="number" step="0.01" min="0" value="${cv}"></div>
        <div><label>Despesa meta</label><br><input id="meta_despesa" class="input" type="number" step="0.01" min="0" value="${dv}"></div>
      </div>
      <div style="margin-top:12px">
        <button class="btn btn-primary" onclick="salvarMetaMes(${mes})">Salvar meta</button>
        <button class="btn btn-secondary" onclick="document.getElementById('orcForm').innerHTML=''">Cancelar</button>
      </div>
    </div></div>`
}

async function salvarMetaMes(mes) {
  try {
    await apiAuth('/api/orcamento', { method: 'POST', body: {
      ano: window._orcamentoAno, mes,
      receita_meta: Number((document.getElementById('meta_receita') || {}).value) || 0,
      custo_meta: Number((document.getElementById('meta_custo') || {}).value) || 0,
      despesa_meta: Number((document.getElementById('meta_despesa') || {}).value) || 0,
    } })
    if (typeof showToast === 'function') showToast('Meta salva', 'success')
    document.getElementById('orcForm').innerHTML = ''
    await _carregarOrcamento()
  } catch (e) {
    if (typeof showToast === 'function') showToast(e && e.message ? e.message : 'Falha ao salvar meta', 'error')
  }
}

window._orcamentoHTML = _orcamentoHTML
window.renderOrcamento = renderOrcamento
window._carregarOrcamento = _carregarOrcamento
window.abrirMetaMes = abrirMetaMes
window.salvarMetaMes = salvarMetaMes

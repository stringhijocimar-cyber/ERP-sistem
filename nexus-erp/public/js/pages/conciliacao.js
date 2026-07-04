// ============================================================
// Conciliação Bancária — importa extrato (CSV/OFX), sugere o casamento
// com contas a pagar/receber e baixa o título ao conciliar.
// Consome /api/conciliacao/*. Nada de seed: 100% servidor.
// ============================================================

// Helper puro (testável): agrega os itens de /sugestoes em números de topo.
function _conciliacaoResumo(sugestoes) {
  const lista = Array.isArray(sugestoes) ? sugestoes : []
  let comSugestao = 0, semSugestao = 0, creditos = 0, debitos = 0, valorCred = 0, valorDeb = 0
  for (const s of lista) {
    const l = s.lancamento || {}
    if (s.sugestao) comSugestao++; else semSugestao++
    if (l.tipo === 'credito') { creditos++; valorCred += Number(l.valor) || 0 }
    else { debitos++; valorDeb += Number(l.valor) || 0 }
  }
  return { total: lista.length, comSugestao, semSugestao, creditos, debitos, valorCred, valorDeb }
}

async function renderConciliacao() {
  const el = document.getElementById('mainContent')
  if (!el) return
  el.innerHTML = `
    <div class="page-header">
      <div>
        <h1><i class="fas fa-random"></i> Conciliação Bancária</h1>
        <p class="page-subtitle">Importe o extrato do banco e case cada lançamento com suas contas a pagar/receber.</p>
      </div>
      <button class="btn btn-secondary btn-sm" onclick="renderConciliacao()"><i class="fas fa-sync-alt"></i> Atualizar</button>
    </div>
    <div class="card" style="margin-bottom:16px">
      <h3 style="margin-top:0"><i class="fas fa-file-upload"></i> Importar extrato</h3>
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end">
        <div><label>Banco</label><br><input id="conc_banco" class="input" placeholder="Ex.: Itaú" style="width:140px"></div>
        <div><label>Formato</label><br>
          <select id="conc_formato" class="input" style="width:120px">
            <option value="auto">Auto</option><option value="csv">CSV</option><option value="ofx">OFX</option>
          </select></div>
        <div><label>Arquivo (CSV/OFX)</label><br><input id="conc_arquivo" type="file" accept=".csv,.ofx,.txt"></div>
        <button class="btn btn-primary" onclick="importarExtrato()"><i class="fas fa-upload"></i> Importar</button>
      </div>
      <small style="color:#888">Dica: exporte o extrato do internet banking em CSV ou OFX. Nenhum dado sai do seu servidor.</small>
    </div>
    <div id="concResumo"></div>
    <div id="concLista" class="card"><p style="padding:20px;color:#888">Carregando lançamentos...</p></div>
  `
  await _carregarConciliacao()
}

async function _carregarConciliacao() {
  const box = document.getElementById('concLista')
  try {
    const sugestoes = await apiAuth('/api/conciliacao/sugestoes') || []
    document.getElementById('concResumo').innerHTML = _conciliacaoResumoHTML(_conciliacaoResumo(sugestoes))
    if (!sugestoes.length) {
      box.innerHTML = '<p style="padding:20px;color:#888">Nenhum lançamento pendente. Importe um extrato para começar.</p>'
      return
    }
    const esc = (window.NexusAPI && NexusAPI.escapeHtml) ? NexusAPI.escapeHtml : (s => String(s == null ? '' : s))
    const rows = sugestoes.map(s => {
      const l = s.lancamento, sig = l.tipo === 'credito' ? '+' : '−'
      const cor = l.tipo === 'credito' ? '#16a34a' : '#dc2626'
      const sug = s.sugestao
        ? `<div><strong>${esc(sug_num(s.sugestao))}</strong> <small style="color:#888">${esc(s.sugestao.parte || '')}</small><br>
           <span class="badge" style="background:#dcfce7;color:#166534">match ${s.sugestao.score}%</span></div>`
        : `<span style="color:#999">sem sugestão</span>`
      const acoes = s.sugestao
        ? `<button class="btn btn-primary btn-sm" onclick="conciliarLanc(${l.id}, '${s.sugestao.tipo}', ${s.sugestao.ref_id})">Conciliar</button>
           <button class="btn btn-secondary btn-sm" onclick="ignorarLanc(${l.id})">Ignorar</button>`
        : `<button class="btn btn-secondary btn-sm" onclick="ignorarLanc(${l.id})">Ignorar</button>`
      return `<tr>
        <td>${esc(l.data)}</td>
        <td>${esc(l.descricao)}</td>
        <td style="text-align:right;color:${cor};font-weight:600">${sig} ${fmt(l.valor)}</td>
        <td>${sug}</td>
        <td style="white-space:nowrap">${acoes}</td>
      </tr>`
    }).join('')
    box.innerHTML = `
      <h3 style="margin-top:0"><i class="fas fa-list-check"></i> Lançamentos pendentes (${sugestoes.length})</h3>
      <table class="data-table"><thead><tr>
        <th>Data</th><th>Histórico</th><th style="text-align:right">Valor</th><th>Sugestão de baixa</th><th>Ações</th>
      </tr></thead><tbody>${rows}</tbody></table>`
  } catch (e) {
    box.innerHTML = `<p style="padding:20px;color:#dc2626">Não foi possível carregar (módulo não conectado).</p>`
  }
}

function sug_num(s) { return (s && (s.numero || ('#' + s.ref_id))) || '' }

function _conciliacaoResumoHTML(r) {
  if (!r) return ''
  const card = (t, v, c) => `<div class="stat-card" style="flex:1"><div class="stat-label">${t}</div><div class="stat-value" style="color:${c}">${v}</div></div>`
  return `<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px">
    ${card('Pendentes', r.total, '#0f172a')}
    ${card('Com sugestão', r.comSugestao, '#16a34a')}
    ${card('Sem sugestão', r.semSugestao, '#d97706')}
    ${card('Créditos (entradas)', fmt(r.valorCred), '#16a34a')}
    ${card('Débitos (saídas)', fmt(r.valorDeb), '#dc2626')}
  </div>`
}

async function importarExtrato() {
  const fileEl = document.getElementById('conc_arquivo')
  const file = fileEl && fileEl.files && fileEl.files[0]
  if (!file) { showToast('Selecione um arquivo CSV ou OFX', 'warning'); return }
  const conteudo = await file.text()
  const formato = document.getElementById('conc_formato').value
  const banco = document.getElementById('conc_banco').value
  try {
    const r = await apiAuth('/api/conciliacao/importar', { method: 'POST', body: { formato, banco, arquivo_nome: file.name, conteudo } })
    showToast(`${(r && r.importados) || 0} lançamento(s) importado(s)`, 'success')
    if (window.logAction) logAction('Importar extrato', 'conciliacao')
    await _carregarConciliacao()
  } catch (e) {
    showToast(e && e.message ? e.message : 'Falha ao importar extrato', 'error')
  }
}

async function conciliarLanc(id, tipo, refId) {
  try {
    await apiAuth(`/api/conciliacao/${id}/conciliar`, { method: 'POST', body: { tipo, ref_id: refId } })
    showToast('Lançamento conciliado — título baixado', 'success')
    await _carregarConciliacao()
  } catch (e) {
    showToast(e && e.message ? e.message : 'Falha ao conciliar', 'error')
  }
}

async function ignorarLanc(id) {
  try {
    await apiAuth(`/api/conciliacao/${id}/ignorar`, { method: 'POST', body: {} })
    showToast('Lançamento ignorado', 'info')
    await _carregarConciliacao()
  } catch (e) {
    showToast(e && e.message ? e.message : 'Falha ao ignorar', 'error')
  }
}

// Exposição global (o app chama por window.*).
window.renderConciliacao = renderConciliacao
window._carregarConciliacao = _carregarConciliacao
window._conciliacaoResumo = _conciliacaoResumo
window._conciliacaoResumoHTML = _conciliacaoResumoHTML
window.importarExtrato = importarExtrato
window.conciliarLanc = conciliarLanc
window.ignorarLanc = ignorarLanc

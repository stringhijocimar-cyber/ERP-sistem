// ============================================================
// Dashboard Financeiro CONSOLIDADO — o cockpit executivo.
// Junta DRE real + projeção de caixa + posição AR/AP + ranking de
// contratos numa visão única. Consome /api/dashboard-financeiro.
// ============================================================

// Render puro (testável) do cockpit a partir do payload consolidado.
function _dashFinHTML(d) {
  if (!d) return ''
  const esc = (window.NexusAPI && NexusAPI.escapeHtml) ? NexusAPI.escapeHtml : (s => String(s == null ? '' : s))
  const m = v => typeof fmt === 'function' ? fmt(v) : ('R$ ' + Number(v || 0).toLocaleString('pt-BR'))
  const cor = v => v >= 0 ? '#16a34a' : '#dc2626'
  const kpi = (t, v, c, sub) => `<div class="stat-card" style="flex:1;min-width:150px">
    <div class="stat-label">${t}</div>
    <div class="stat-value" style="color:${c || '#0f172a'}">${v}</div>
    ${sub ? `<div style="font-size:11px;color:var(--text-muted)">${sub}</div>` : ''}
  </div>`

  const apertoBadge = d.projecao.aperto_previsto
    ? `<span style="color:#dc2626;font-weight:700"><i class="fas fa-triangle-exclamation"></i> aperto de caixa previsto — menor saldo ${m(d.projecao.menor_saldo)} (semana ${esc(d.projecao.semana_critica)})</span>`
    : `<span style="color:#16a34a">caixa positivo nas próximas 12 semanas</span>`

  const linhaContrato = (c, negativo) => `<tr>
    <td style="padding:5px 8px">${esc(c.numero || ('#' + c.contrato_id))}</td>
    <td style="padding:5px 8px">${esc(c.titulo || '')}</td>
    <td style="padding:5px 8px;text-align:right">${m(c.receita)}</td>
    <td style="padding:5px 8px;text-align:right;color:${cor(c.resultado)}">${m(c.resultado)}</td>
    <td style="padding:5px 8px;text-align:right;font-weight:700;color:${cor(c.margem_pct)}">${c.margem_pct}%</td>
  </tr>`
  const top = (d.contratos.top || []).map(c => linhaContrato(c)).join('') || `<tr><td colspan="5" style="padding:8px;color:#888">Sem contratos com movimento.</td></tr>`
  const piores = (d.contratos.prejuizo || [])
  const blocoPiores = piores.length ? `
    <div class="card" style="margin-top:12px;border-left:4px solid #dc2626"><div class="card-body">
      <h4 style="margin:0 0 6px"><i class="fas fa-arrow-trend-down" style="color:#dc2626"></i> Contratos no prejuízo (${piores.length})</h4>
      <table style="width:100%;border-collapse:collapse"><tbody>${piores.map(c => linhaContrato(c, true)).join('')}</tbody></table>
    </div></div>` : ''

  return `
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px">
      ${kpi('Receita (ano ' + esc(d.periodo) + ')', m(d.dre.receita), '#0f172a')}
      ${kpi('Resultado operacional', m(d.dre.resultado_operacional), cor(d.dre.resultado_operacional), 'margem ' + d.dre.margem_liquida_pct + '%')}
      ${kpi('Capital de giro', m(d.posicao.capital_giro), cor(d.posicao.capital_giro), 'a receber − a pagar')}
      ${kpi('Saldo projetado (12 sem)', m(d.projecao.saldo_final), cor(d.projecao.saldo_final))}
      ${kpi('Conciliação pendente', d.conciliacao_pendente, d.conciliacao_pendente ? '#d97706' : '#16a34a', 'lançamentos')}
    </div>

    <div class="card" style="margin-bottom:12px;border-left:4px solid ${d.projecao.aperto_previsto ? '#dc2626' : '#16a34a'}"><div class="card-body">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <div style="font-weight:800"><i class="fas fa-water" style="color:var(--fa-teal)"></i> Projeção de caixa</div>
        ${apertoBadge}
      </div>
      <div style="display:flex;gap:24px;flex-wrap:wrap;margin-top:8px;font-size:13px">
        <span>Entradas previstas: <b style="color:#16a34a">${m(d.projecao.entradas_previstas)}</b></span>
        <span>Saídas previstas: <b style="color:#dc2626">${m(d.projecao.saidas_previstas)}</b></span>
        <span>Saldo inicial: <b>${m(d.projecao.saldo_inicial)}</b></span>
      </div>
    </div></div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="card"><div class="card-body">
        <h4 style="margin:0 0 6px"><i class="fas fa-file-invoice-dollar"></i> Contas a receber</h4>
        <div style="display:flex;justify-content:space-between;font-size:13px"><span>Em aberto (${d.posicao.a_receber_qtd})</span><b>${m(d.posicao.a_receber)}</b></div>
        <div style="display:flex;justify-content:space-between;font-size:13px"><span>Vencido</span><b style="color:#dc2626">${m(d.posicao.a_receber_vencido)}</b></div>
      </div></div>
      <div class="card"><div class="card-body">
        <h4 style="margin:0 0 6px"><i class="fas fa-hand-holding-usd"></i> Contas a pagar</h4>
        <div style="display:flex;justify-content:space-between;font-size:13px"><span>Em aberto (${d.posicao.a_pagar_qtd})</span><b>${m(d.posicao.a_pagar)}</b></div>
        <div style="display:flex;justify-content:space-between;font-size:13px"><span>Vencido</span><b style="color:#dc2626">${m(d.posicao.a_pagar_vencido)}</b></div>
      </div></div>
    </div>

    <div class="card" style="margin-top:12px"><div class="card-body">
      <h4 style="margin:0 0 6px"><i class="fas fa-trophy" style="color:var(--orange)"></i> Contratos por resultado (top 5 de ${d.contratos.total_avaliados})</h4>
      <table style="width:100%;border-collapse:collapse">
        <thead><tr style="font-size:11px;color:var(--text-muted);text-transform:uppercase">
          <th style="padding:4px 8px;text-align:left">Contrato</th><th style="padding:4px 8px;text-align:left">Título</th>
          <th style="padding:4px 8px;text-align:right">Receita</th><th style="padding:4px 8px;text-align:right">Resultado</th><th style="padding:4px 8px;text-align:right">Margem</th>
        </tr></thead>
        <tbody>${top}</tbody>
      </table>
    </div></div>
    ${blocoPiores}`
}

async function renderDashboardFinanceiro() {
  const el = document.getElementById('mainContent')
  if (!el) return
  el.innerHTML = `
    <div class="page-header">
      <div>
        <h1><i class="fas fa-gauge-high"></i> Dashboard Financeiro</h1>
        <p class="page-subtitle">Cockpit executivo: resultado, caixa projetado, posição e margem por contrato.</p>
      </div>
      <div>
        <button class="btn btn-secondary btn-sm" onclick="baixarCSVFinanceiro('/api/dashboard-financeiro/export.csv','dashboard-financeiro.csv')"><i class="fas fa-file-csv"></i> Exportar CSV</button>
        <button class="btn btn-secondary btn-sm" onclick="window.print()"><i class="fas fa-print"></i> Imprimir / PDF</button>
        <button class="btn btn-secondary btn-sm" onclick="renderDashboardFinanceiro()"><i class="fas fa-sync-alt"></i> Atualizar</button>
      </div>
    </div>
    <div id="dashFinConteudo"><p style="padding:20px;color:#888">Carregando cockpit financeiro...</p></div>
  `
  const box = document.getElementById('dashFinConteudo')
  try {
    const d = await apiAuth('/api/dashboard-financeiro')
    box.innerHTML = _dashFinHTML(d)
  } catch (e) {
    box.innerHTML = `<p style="padding:20px;color:#dc2626">Não foi possível carregar (módulo não conectado).</p>`
  }
}

// Baixa um CSV de um endpoint autenticado (fetch com token + blob download).
// Compartilhado com a página DRE. Testável via injeção de fetch/URL.
async function baixarCSVFinanceiro(path, filename) {
  try {
    const token = (function () { try { return sessionStorage.getItem('fa_token') || localStorage.getItem('fa_token') || '' } catch { return '' } })()
    const resp = await fetch(path, { headers: { 'Authorization': `Bearer ${token}` } })
    if (!resp.ok) throw new Error('HTTP ' + resp.status)
    const blob = await resp.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename || 'export.csv'
    document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
    if (typeof showToast === 'function') showToast('Exportação gerada', 'success')
  } catch (e) {
    if (typeof showToast === 'function') showToast('Falha ao exportar CSV', 'error')
  }
}

window._dashFinHTML = _dashFinHTML
window.renderDashboardFinanceiro = renderDashboardFinanceiro
window.baixarCSVFinanceiro = baixarCSVFinanceiro

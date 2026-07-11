// ============================================================
// Painel Executivo (visão CEO) — costura financeiro + suprimentos +
// fornecedores/OTIF + riscos num só cockpit. Consome /api/painel-executivo.
// ============================================================

const _peFmt = v => typeof fmt === 'function' ? fmt(v) : ('R$ ' + Number(v || 0).toLocaleString('pt-BR'))

// Render puro (testável) do painel a partir do payload consolidado.
function _painelExecutivoHTML(d) {
  if (!d) return ''
  const esc = (window.NexusAPI && NexusAPI.escapeHtml) ? NexusAPI.escapeHtml : (s => String(s == null ? '' : s))
  const f = d.financeiro || {}, s = d.suprimentos || {}, fo = d.fornecedores || {}
  const cor = v => v >= 0 ? '#16a34a' : '#dc2626'
  const kpi = (t, v, sub, c) => `<div class="stat-card" style="flex:1;min-width:150px">
    <div class="stat-label">${t}</div>
    <div class="stat-value" style="color:${c || '#0f172a'}">${v}</div>
    ${sub ? `<div style="font-size:11px;color:var(--text-muted)">${sub}</div>` : ''}
  </div>`
  const secao = (icone, titulo, cards) => `
    <div style="margin-bottom:6px;font-size:12px;font-weight:800;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em"><i class="fas ${icone}"></i> ${titulo}</div>
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px">${cards}</div>`

  const nivelCor = { alto: '#dc2626', medio: '#d97706', baixo: '#0e7c86' }
  const riscos = (d.riscos || []).length
    ? (d.riscos || []).map(r => `<div style="display:flex;gap:10px;align-items:flex-start;padding:8px 0;border-top:1px solid var(--border)">
        <span style="width:8px;height:8px;border-radius:50%;background:${nivelCor[r.nivel] || '#999'};margin-top:5px;flex:none"></span>
        <div><div style="font-size:13px;font-weight:600">${esc(r.titulo)} <span style="font-size:10px;color:var(--text-muted);text-transform:uppercase">· ${esc(r.area)}</span></div>
          <div style="font-size:12px;color:var(--text-muted)">${esc(r.detalhe || '')}</div></div>
      </div>`).join('')
    : '<p style="font-size:13px;color:#16a34a;padding:8px 0">Nenhum risco crítico no momento. 👍</p>'

  return `
    ${secao('fa-chart-line', 'Financeiro', `
      ${kpi('Receita (ano ' + esc(d.periodo) + ')', _peFmt(f.receita), '', '#0f172a')}
      ${kpi('Resultado', _peFmt(f.resultado), 'margem ' + (f.margem_pct != null ? f.margem_pct + '%' : '—'), cor(f.resultado))}
      ${kpi('Capital de giro', _peFmt(f.capital_giro), 'a receber − a pagar', cor(f.capital_giro))}
      ${kpi('Caixa projetado', _peFmt(f.saldo_projetado), f.aperto_previsto ? '⚠ aperto previsto' : 'sob controle', f.aperto_previsto ? '#dc2626' : cor(f.saldo_projetado))}
    `)}
    ${secao('fa-truck-loading', 'Suprimentos', `
      ${kpi('Pedidos ativos', s.pedidos_ativos || 0, _peFmt(s.pedidos_valor))}
      ${kpi('RCs pendentes', s.rcs_pendentes || 0, 'a processar')}
      ${kpi('Estoque', _peFmt(s.estoque_valor), (s.itens_reposicao || 0) + ' a repor', (s.itens_reposicao ? '#d97706' : '#0f172a'))}
      ${kpi('Anomalias de compra', s.anomalias_abertas || 0, s.anomalias_abertas ? 'em aberto' : 'nenhuma', s.anomalias_abertas ? '#dc2626' : '#16a34a')}
    `)}
    ${secao('fa-handshake', 'Fornecedores & Entregas', `
      ${kpi('OTIF', fo.otif_pct == null ? '—' : fo.otif_pct + '%', (fo.entregas_atrasadas || 0) + ' atrasada(s)', fo.otif_pct != null && fo.otif_pct < 90 ? '#d97706' : '#16a34a')}
      ${kpi('Homologados', (fo.homologados || 0) + '/' + (fo.total || 0), 'fornecedores ativos')}
      ${kpi('Cotações pendentes', fo.cotacoes_pendentes || 0, 'aguardando fornecedor')}
      ${kpi('Convites pendentes', fo.convites_pendentes || 0, 'onboarding em aberto')}
    `)}
    ${d.industrial ? secao('fa-industry', 'Industrial (MM)', `
      ${kpi('Disponibilidade MRP', (d.industrial.disponibilidade_pct != null ? d.industrial.disponibilidade_pct + '%' : '—'), d.industrial.mrp_faltantes + ' faltante(s)', d.industrial.mrp_faltantes ? '#dc2626' : '#16a34a')}
      ${kpi('Veículos possíveis', d.industrial.veiculos_possiveis + '/' + d.industrial.veiculos_alvo, 'cobertos pelo estoque', d.industrial.veiculos_possiveis < d.industrial.veiculos_alvo ? '#dc2626' : '#16a34a')}
      ${kpi('Sem engenharia', d.industrial.sem_engenharia, 'bloqueiam o sourcing', d.industrial.sem_engenharia ? '#dc2626' : '#16a34a')}
      ${kpi('Sem PPAP', d.industrial.sem_ppap, 'bloqueiam a produção', d.industrial.sem_ppap ? '#d97706' : '#16a34a')}
      ${kpi('Críticos (Alta)', d.industrial.criticos, d.industrial.materiais + ' materiais na BOM', d.industrial.criticos ? '#d97706' : '#16a34a')}
    `) : ''}
    <div class="card"><div class="card-body">
      <h4 style="margin:0"><i class="fas fa-triangle-exclamation" style="color:#d97706"></i> Riscos que exigem decisão</h4>
      ${riscos}
    </div></div>`
}

async function renderPainelExecutivo() {
  const el = document.getElementById('mainContent')
  if (!el) return
  el.innerHTML = `
    <div class="page-header">
      <div><h1><i class="fas fa-gauge-high"></i> Painel Executivo</h1>
        <p class="page-subtitle">A empresa em uma tela: resultado, caixa, suprimentos, entregas e riscos.</p></div>
      <button class="btn btn-secondary btn-sm" onclick="renderPainelExecutivo()"><i class="fas fa-sync-alt"></i> Atualizar</button>
    </div>
    <div id="painelExecConteudo"><p style="padding:20px;color:#888">Carregando visão executiva...</p></div>`
  const box = document.getElementById('painelExecConteudo')
  try {
    box.innerHTML = _painelExecutivoHTML(await apiAuth('/api/painel-executivo'))
  } catch (e) {
    box.innerHTML = `<p style="padding:20px;color:#dc2626">Não foi possível carregar (sem acesso ou módulo não conectado).</p>`
  }
}

window._painelExecutivoHTML = _painelExecutivoHTML
window.renderPainelExecutivo = renderPainelExecutivo

// =====================================================
// Fraser Alexander – Módulo Relatórios Customizados
// Relatórios dinâmicos, gráficos, exportação CSV/PDF
// =====================================================

let relatorioAtual = null;
let relChart1 = null, relChart2 = null, relChart3 = null;

function renderRelatorios() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `
    <div class="page-header">
      <div class="page-title">
        <h2><i class="fas fa-chart-bar" style="color:var(--fa-teal);margin-right:10px"></i>Central de Relatórios</h2>
        <p>Relatórios gerenciais customizáveis com exportação</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary btn-sm" onclick="showToast('Agendando relatório periódico...','info')">
          <i class="fas fa-clock"></i> Agendar
        </button>
      </div>
    </div>

    <!-- Categorias de relatórios -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px;margin-bottom:20px">
      ${[
        { key:'financeiro', icon:'chart-line', cor:'var(--green-light)', title:'Financeiro e Faturamento', desc:'DRE, Fluxo de Caixa, Contas a Pagar, Margens por contrato', count:6 },
        { key:'contratos', icon:'file-contract', cor:'var(--blue-light)', title:'Contratos e Medições', desc:'Carteira de contratos, medições, avanço físico e financeiro', count:4 },
        { key:'operacional', icon:'clipboard-list', cor:'var(--orange)', title:'Operacional / OS', desc:'Ordens de serviço, produtividade, backlog, tempo médio', count:5 },
        { key:'compras', icon:'shopping-cart', cor:'var(--fa-teal)', title:'Compras e Suprimentos', desc:'Pedidos de compra, fornecedores, gastos por categoria', count:4 },
        { key:'ssma', icon:'hard-hat', cor:'var(--yellow-light)', title:'SSMA e Compliance', desc:'Incidentes, KPIs de segurança, vencimentos, taxas', count:5 },
        { key:'equipe', icon:'users', cor:'var(--purple)', title:'Equipe e Mobilização', desc:'Headcount, documentação, efetivo por contrato', count:3 }
      ].map(r => `
        <div class="info-card rel-category-card" onclick="abrirRelatorio('${r.key}')">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
            <div style="width:44px;height:44px;border-radius:10px;background:${r.cor}22;display:flex;align-items:center;justify-content:center">
              <i class="fas fa-${r.icon}" style="color:${r.cor};font-size:18px"></i>
            </div>
            <div>
              <div style="font-weight:700;font-size:14px">${r.title}</div>
              <div style="font-size:11px;color:var(--text-muted)">${r.count} relatórios disponíveis</div>
            </div>
          </div>
          <div style="font-size:12px;color:var(--text-secondary);line-height:1.5">${r.desc}</div>
          <div style="margin-top:10px;text-align:right">
            <span class="badge badge-info">Ver Relatórios <i class="fas fa-arrow-right" style="font-size:9px"></i></span>
          </div>
        </div>
      `).join('')}
    </div>

    <!-- Relatório rápido: Resumo Executivo -->
    <div id="relatorioConteudo">
      ${_buildResumoExecutivo()}
    </div>
  `;

  setTimeout(() => _initChartsResumo(), 100);
}

function abrirRelatorio(categoria) {
  relatorioAtual = categoria;
  const map = {
    financeiro: _buildRelFinanceiro,
    contratos: _buildRelContratos,
    operacional: _buildRelOperacional,
    compras: _buildRelCompras,
    ssma: _buildRelSSMA,
    equipe: _buildRelEquipe
  };
  const el = document.getElementById('relatorioConteudo');
  if (!el) return;
  el.innerHTML = `<div class="empty-state"><i class="fas fa-spinner fa-spin" style="color:var(--fa-teal)"></i></div>`;
  setTimeout(() => {
    if (map[categoria]) {
      el.innerHTML = map[categoria]();
      setTimeout(() => _initChartsCategoria(categoria), 100);
    }
  }, 300);
}

// ─── RESUMO EXECUTIVO ──────────────────────────────────────
function _buildResumoExecutivo() {
  const contrAtivos = ERP_DATA.contratos.filter(c => c.status === 'Ativo').length;
  const totalCarteira = ERP_DATA.contratos.reduce((a, c) => a + c.valor, 0);
  const totalMedido = ERP_DATA.contratos.reduce((a, c) => a + c.medidoAcum, 0);
  const totalCusto = ERP_DATA.contratos.reduce((a, c) => a + c.custoAcum, 0);
  const margemMedia = totalMedido > 0 ? ((totalMedido - totalCusto) / totalMedido * 100).toFixed(1) : 0;
  const osPendentes = ERP_DATA.ordens.filter(o => o.status !== 'Concluída' && o.status !== 'Cancelada').length;

  return `
    <div class="card">
      <div class="card-header" style="display:flex;align-items:center;justify-content:space-between">
        <h3><i class="fas fa-tachometer-alt" style="color:var(--fa-teal);margin-right:8px"></i>Resumo Executivo – Fraser Alexander</h3>
        <div style="display:flex;gap:8px">
          <span style="font-size:12px;color:var(--text-muted)">Competência: Mar/2025</span>
          <button class="btn btn-secondary btn-sm" onclick="exportarRelCSV('resumo')"><i class="fas fa-file-csv"></i> CSV</button>
          <button class="btn btn-primary btn-sm" onclick="imprimirRelatorio()"><i class="fas fa-print"></i> Imprimir</button>
        </div>
      </div>
      <div class="card-body">
        <!-- KPIs Principais -->
        <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:12px;margin-bottom:20px">
          <div class="kpi-mini"><div class="kpi-mini-val">${contrAtivos}</div><div class="kpi-mini-label">Contratos Ativos</div></div>
          <div class="kpi-mini"><div class="kpi-mini-val">${fmtK(totalCarteira)}</div><div class="kpi-mini-label">Carteira Total</div></div>
          <div class="kpi-mini"><div class="kpi-mini-val">${fmtK(totalMedido)}</div><div class="kpi-mini-label">Total Medido</div></div>
          <div class="kpi-mini"><div class="kpi-mini-val" style="color:var(--green-light)">${margemMedia}%</div><div class="kpi-mini-label">Margem Média</div></div>
          <div class="kpi-mini"><div class="kpi-mini-val">${ERP_DATA.colaboradores.length}</div><div class="kpi-mini-label">Efetivo Total</div></div>
          <div class="kpi-mini"><div class="kpi-mini-val" style="color:var(--orange)">${osPendentes}</div><div class="kpi-mini-label">OS em Aberto</div></div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
          <div>
            <div style="font-weight:600;font-size:12px;color:var(--text-secondary);margin-bottom:8px">FATURAMENTO MENSAL (R$)</div>
            <div style="height:200px"><canvas id="chartFatMensal"></canvas></div>
          </div>
          <div>
            <div style="font-weight:600;font-size:12px;color:var(--text-secondary);margin-bottom:8px">RECEITA × CUSTO (R$)</div>
            <div style="height:200px"><canvas id="chartRecCusto"></canvas></div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <div>
            <div style="font-weight:600;font-size:12px;color:var(--text-secondary);margin-bottom:8px">VALOR POR CONTRATO (R$)</div>
            <div style="height:200px"><canvas id="chartContratos"></canvas></div>
          </div>
          <div>
            <div style="font-weight:600;font-size:12px;color:var(--text-secondary);margin-bottom:8px">STATUS DAS ORDENS DE SERVIÇO</div>
            <div style="height:200px"><canvas id="chartOSStatus"></canvas></div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function _initChartsResumo() {
  const defaults = { color: '#fff', plugins: { legend: { labels: { color: '#8b949e', font: { size: 11 } } } }, scales: { x: { ticks: { color: '#8b949e', font: { size: 10 } }, grid: { color: '#21262d' } }, y: { ticks: { color: '#8b949e', font: { size: 10 } }, grid: { color: '#21262d' } } } };

  // Faturamento Mensal
  const c1 = document.getElementById('chartFatMensal');
  if (c1) {
    if (relChart1) relChart1.destroy();
    relChart1 = new Chart(c1, { type: 'bar', data: {
      labels: CHART_DATA.faturamentoMensal.labels,
      datasets: [
        { label: 'Previsto', data: CHART_DATA.faturamentoMensal.previsto, backgroundColor: 'rgba(26,115,232,0.5)', borderColor: '#1a73e8', borderWidth: 2, borderRadius: 4 },
        { label: 'Realizado', data: CHART_DATA.faturamentoMensal.realizado, backgroundColor: 'rgba(0,180,184,0.7)', borderColor: '#00b4d8', borderWidth: 2, borderRadius: 4 }
      ]
    }, options: { ...defaults, responsive: true, maintainAspectRatio: false } });
  }

  // Receita x Custo
  const c2 = document.getElementById('chartRecCusto');
  if (c2) {
    if (relChart2) relChart2.destroy();
    relChart2 = new Chart(c2, { type: 'line', data: {
      labels: CHART_DATA.custoReceita.labels,
      datasets: [
        { label: 'Receita', data: CHART_DATA.custoReceita.receita, borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.1)', tension: 0.4, fill: true },
        { label: 'Custo', data: CHART_DATA.custoReceita.custo, borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)', tension: 0.4, fill: true }
      ]
    }, options: { ...defaults, responsive: true, maintainAspectRatio: false } });
  }

  // Contratos
  const c3 = document.getElementById('chartContratos');
  if (c3) {
    relChart3 = new Chart(c3, { type: 'bar', data: {
      labels: CHART_DATA.contratoValor.labels,
      datasets: [{ label: 'Valor Contrato', data: CHART_DATA.contratoValor.values, backgroundColor: ['#1a73e8','#e67e22','#22c55e','#9b59b6','#8b949e'], borderRadius: 4 }]
    }, options: { ...defaults, responsive: true, maintainAspectRatio: false, indexAxis: 'y' } });
  }

  // OS Status
  const c4 = document.getElementById('chartOSStatus');
  if (c4) {
    new Chart(c4, { type: 'doughnut', data: {
      labels: CHART_DATA.osStatus.labels,
      datasets: [{ data: CHART_DATA.osStatus.values, backgroundColor: CHART_DATA.osStatus.colors, borderWidth: 0, hoverOffset: 4 }]
    }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#8b949e', font: { size: 11 }, padding: 10 } } } } });
  }
}

// ─── RELATÓRIO FINANCEIRO ─────────────────────────────────
function _buildRelFinanceiro() {
  const d = CHART_DATA;
  const totalFat = d.faturamentoMensal.realizado.reduce((a,b)=>a+b,0);
  const totalCusto = d.custoReceita.custo.reduce((a,b)=>a+b,0);
  const lucro = totalFat - totalCusto;
  const margemGlobal = (lucro / totalFat * 100).toFixed(1);

  const contas = typeof FA_CONTAS_PAGAR !== 'undefined' ? FA_CONTAS_PAGAR : [];

  const totalCP = contas.reduce((a,c)=>a+c.valor,0);
  const pagas = contas.filter(c=>c.status==='Pago').reduce((a,c)=>a+c.valor,0);
  const apagar = contas.filter(c=>c.status!=='Pago').reduce((a,c)=>a+c.valor,0);

  return `
    <div class="page-header" style="margin-top:0">
      <div class="page-title">
        <h3><i class="fas fa-chart-line" style="color:var(--green-light);margin-right:8px"></i>Relatórios Financeiros</h3>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary btn-sm" onclick="abrirRelatorio(null);renderRelatorios()"><i class="fas fa-arrow-left"></i> Voltar</button>
        <select class="filter-select" id="relFinPeriodo">
          <option>Março/2025</option><option>Fevereiro/2025</option><option>Janeiro/2025</option><option>Acumulado 2025</option>
        </select>
        <button class="btn btn-primary btn-sm" onclick="exportarRelCSV('financeiro')"><i class="fas fa-download"></i> Exportar CSV</button>
      </div>
    </div>

    <!-- KPIs Financeiros -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
      <div class="kpi-card kpi-green"><div class="kpi-icon"><i class="fas fa-chart-line"></i></div><div class="kpi-value">${fmtK(totalFat)}</div><div class="kpi-label">Receita Acumulada</div></div>
      <div class="kpi-card kpi-red"><div class="kpi-icon"><i class="fas fa-minus-circle"></i></div><div class="kpi-value">${fmtK(totalCusto)}</div><div class="kpi-label">Custo Acumulado</div></div>
      <div class="kpi-card kpi-blue"><div class="kpi-icon"><i class="fas fa-plus-circle"></i></div><div class="kpi-value">${fmtK(lucro)}</div><div class="kpi-label">Lucro Bruto</div></div>
      <div class="kpi-card kpi-teal"><div class="kpi-icon"><i class="fas fa-percentage"></i></div><div class="kpi-value">${margemGlobal}%</div><div class="kpi-label">Margem Global</div></div>
    </div>

    <div style="display:grid;grid-template-columns:2fr 1fr;gap:14px;margin-bottom:16px">
      <!-- DRE Resumida -->
      <div class="card">
        <div class="card-header"><h3><i class="fas fa-file-alt" style="color:var(--fa-teal);margin-right:8px"></i>DRE – Demonstrativo de Resultados</h3></div>
        <div class="card-body">
          ${[
            { label: 'Receita Bruta (Medições Aprovadas)', val: 1628000, style:'font-weight:700' },
            { label: '(-) Deduções / Glosas', val: -26250, style:'color:var(--red-light)' },
            { label: '= Receita Líquida', val: 1601750, style:'font-weight:700;border-top:1px solid var(--border);padding-top:6px' },
            { label: '(-) Custo de Mão de Obra (CMO)', val: -760000, style:'color:var(--red-light)' },
            { label: '(-) Custo de Materiais', val: -41755, style:'color:var(--red-light)' },
            { label: '(-) Custo de Subcontratados', val: -85000, style:'color:var(--red-light)' },
            { label: '(-) Custos Diretos Outros', val: -180000, style:'color:var(--red-light)' },
            { label: '= Lucro Bruto (GPT)', val: 534995, style:'font-weight:700;color:var(--green-light);border-top:1px solid var(--border);padding-top:6px' },
            { label: '(-) Despesas Administrativas', val: -95000, style:'color:var(--red-light)' },
            { label: '(-) Depreciação de Equipamentos', val: -24000, style:'color:var(--red-light)' },
            { label: '= EBITDA', val: 415995, style:'font-weight:700;color:var(--fa-teal);font-size:15px;border-top:1px solid var(--border);padding-top:6px' }
          ].map(r => `
            <div class="stat-row" style="${r.style||''}">
              <span class="stat-label">${r.label}</span>
              <span class="stat-value" style="${r.val < 0 ? 'color:var(--red-light)' : (r.label.includes('EBITDA')||r.label.includes('Bruto') ? 'color:var(--green-light);font-weight:700' : '')}">${fmt(r.val)}</span>
            </div>
          `).join('')}
          <div style="margin-top:12px;background:rgba(22,163,74,0.08);border-radius:8px;padding:12px;border:1px solid rgba(22,163,74,0.2)">
            <div style="text-align:center;color:var(--green-light);font-size:18px;font-weight:700">Margem EBITDA: 26%</div>
          </div>
        </div>
      </div>

      <!-- Fluxo Caixa -->
      <div class="card">
        <div class="card-header"><h3><i class="fas fa-water" style="color:var(--blue-light);margin-right:8px"></i>Fluxo de Caixa</h3></div>
        <div class="card-body">
          <div style="height:200px"><canvas id="chartFluxoCaixa"></canvas></div>
          <div style="margin-top:12px">
            <div class="stat-row"><span class="stat-label">Saldo Inicial</span><span class="stat-value" style="color:var(--fa-teal)">${fmt(285000)}</span></div>
            <div class="stat-row"><span class="stat-label">Entradas (NFs Receb.)</span><span class="stat-value" style="color:var(--green-light)">+ ${fmt(662188)}</span></div>
            <div class="stat-row"><span class="stat-label">Saídas (Fornec.+RH)</span><span class="stat-value" style="color:var(--red-light)">- ${fmt(581755)}</span></div>
            <div class="stat-row" style="border-top:1px solid var(--border);padding-top:8px;margin-top:8px"><span class="stat-label" style="font-weight:700">Saldo Final</span><span class="stat-value" style="font-size:16px;font-weight:700;color:var(--fa-teal)">${fmt(365433)}</span></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Contas a Pagar -->
    <div class="card">
      <div class="card-header" style="justify-content:space-between">
        <h3><i class="fas fa-hand-holding-usd" style="color:var(--orange);margin-right:8px"></i>Contas a Pagar – Detalhamento</h3>
        <div style="display:flex;gap:8px;font-size:12px">
          <span>Total: <strong style="color:var(--fa-teal)">${fmtK(totalCP)}</strong></span>
          <span>· Pago: <strong style="color:var(--green-light)">${fmtK(pagas)}</strong></span>
          <span>· A Pagar: <strong style="color:var(--orange)">${fmtK(apagar)}</strong></span>
        </div>
      </div>
      <div class="table-wrapper">
        <table>
          <thead><tr><th>Descrição</th><th>Tipo</th><th>Vencimento</th><th>Valor</th><th>Status</th><th>Ações</th></tr></thead>
          <tbody>
            ${contas.map(c => `
              <tr>
                <td style="font-size:12px">${c.desc}</td>
                <td><span class="badge badge-muted" style="font-size:10px">${c.tipo}</span></td>
                <td style="font-size:12px">${c.venc}</td>
                <td style="font-weight:600;color:var(--fa-teal)">${fmt(c.valor)}</td>
                <td>${statusBadge(c.status)}</td>
                <td>
                  ${c.status !== 'Pago' ? `<button class="btn btn-success btn-sm" onclick="baixarPagamento(this,'${c.desc}')"><i class="fas fa-check"></i> Baixar</button>` : '<span style="color:var(--green-light);font-size:12px"><i class="fas fa-check-circle"></i> Pago</span>'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Margem por Contrato -->
    <div class="card" style="margin-top:14px">
      <div class="card-header"><h3><i class="fas fa-percentage" style="color:var(--fa-teal);margin-right:8px"></i>Margem Bruta por Contrato</h3></div>
      <div class="card-body">
        ${ERP_DATA.contratos.filter(c=>c.status!=='Encerrado').map(c => {
          const margem = c.medidoAcum > 0 ? ((c.medidoAcum - c.custoAcum) / c.medidoAcum * 100).toFixed(1) : 0;
          const cor = margem >= 20 ? 'var(--green-light)' : margem >= 15 ? 'var(--yellow-light)' : 'var(--red-light)';
          return `
            <div style="margin-bottom:14px">
              <div style="display:flex;justify-content:space-between;margin-bottom:4px">
                <span style="font-size:13px;font-weight:600">${c.id} – ${c.cliente}</span>
                <span style="font-weight:700;color:${cor}">${margem}%</span>
              </div>
              <div style="display:flex;gap:12px;font-size:11px;color:var(--text-secondary);margin-bottom:6px">
                <span>Medido: ${fmtK(c.medidoAcum)}</span>
                <span>Custo: ${fmtK(c.custoAcum)}</span>
                <span>Resultado: ${fmtK(c.medidoAcum - c.custoAcum)}</span>
              </div>
              <div style="height:8px;background:var(--bg-card2);border-radius:4px;overflow:hidden">
                <div style="height:100%;width:${Math.min(margem,100)}%;background:${cor};border-radius:4px;transition:width 0.5s"></div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

// ─── RELATÓRIO CONTRATOS ──────────────────────────────────
function _buildRelContratos() {
  return `
    <div class="page-header" style="margin-top:0">
      <div class="page-title">
        <h3><i class="fas fa-file-contract" style="color:var(--blue-light);margin-right:8px"></i>Relatórios de Contratos e Medições</h3>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary btn-sm" onclick="renderRelatorios()"><i class="fas fa-arrow-left"></i> Voltar</button>
        <button class="btn btn-primary btn-sm" onclick="exportarRelCSV('contratos')"><i class="fas fa-download"></i> Exportar</button>
      </div>
    </div>

    <!-- Carteira de contratos -->
    <div class="card">
      <div class="card-header"><h3><i class="fas fa-briefcase" style="color:var(--blue-light);margin-right:8px"></i>Carteira de Contratos Ativos</h3></div>
      <div class="card-body">
        <div style="height:220px;margin-bottom:16px"><canvas id="chartCarteiraContr"></canvas></div>
        <div class="table-wrapper">
          <table>
            <thead><tr><th>Contrato</th><th>Cliente</th><th>Tipo</th><th>Valor Total</th><th>Medido Acum.</th><th>Custo Acum.</th><th>Margem</th><th>Prazo</th><th>Status</th></tr></thead>
            <tbody>
              ${ERP_DATA.contratos.map(c => {
                const margem = c.medidoAcum > 0 ? ((c.medidoAcum - c.custoAcum) / c.medidoAcum * 100).toFixed(1) : '—';
                const cor = parseFloat(margem) >= 20 ? 'var(--green-light)' : parseFloat(margem) >= 15 ? 'var(--yellow-light)' : 'var(--text-muted)';
                return `
                  <tr>
                    <td style="color:var(--fa-teal);font-weight:700;font-size:12px">${c.id}</td>
                    <td style="font-weight:600">${c.cliente}</td>
                    <td><span class="badge badge-muted" style="font-size:10px">${c.tipo}</span></td>
                    <td style="font-weight:600">${fmtK(c.valor)}</td>
                    <td style="color:var(--blue-light)">${fmtK(c.medidoAcum)}</td>
                    <td style="color:var(--orange)">${fmtK(c.custoAcum)}</td>
                    <td style="color:${cor};font-weight:700">${margem !== '—' ? margem + '%' : '—'}</td>
                    <td style="font-size:11px;color:var(--text-secondary)">${c.inicio} → ${c.fim}</td>
                    <td>${statusBadge(c.status)}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Medições -->
    <div class="card" style="margin-top:14px">
      <div class="card-header"><h3><i class="fas fa-ruler-combined" style="color:var(--fa-teal);margin-right:8px"></i>Relatório de Medições</h3></div>
      <div class="table-wrapper">
        <table>
          <thead><tr><th>ID Medição</th><th>Contrato</th><th>Cliente</th><th>Competência</th><th>Valor Bruto</th><th>Glosa</th><th>Valor Líquido</th><th>Status</th></tr></thead>
          <tbody>
            ${ERP_DATA.medicoes.map(m => `
              <tr>
                <td style="color:var(--fa-teal);font-weight:600;font-size:12px">${m.id}</td>
                <td style="font-size:12px">${m.contrato}</td>
                <td>${m.cliente}</td>
                <td>${m.competencia}</td>
                <td>${fmt(m.valorBruto)}</td>
                <td style="color:${m.glosa>0?'var(--red-light)':'var(--text-muted)'}">${m.glosa > 0 ? '- ' + fmt(m.glosa) : '—'}</td>
                <td style="font-weight:700;color:var(--fa-teal)">${fmt(m.valorLiquido)}</td>
                <td>${statusBadge(m.status)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ─── RELATÓRIO OPERACIONAL ────────────────────────────────
function _buildRelOperacional() {
  const concluidas = ERP_DATA.ordens.filter(o=>o.status==='Concluída').length;
  const emAndamento = ERP_DATA.ordens.filter(o=>o.status==='Em Andamento').length;
  const atrasadas = ERP_DATA.ordens.filter(o=>o.status==='Aguardando Peça'||o.status==='Pausada').length;
  const totalHoras = ERP_DATA.ordens.reduce((a,o)=>a+(o.horas||0),0);

  return `
    <div class="page-header" style="margin-top:0">
      <div class="page-title">
        <h3><i class="fas fa-clipboard-list" style="color:var(--orange);margin-right:8px"></i>Relatórios Operacionais</h3>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary btn-sm" onclick="renderRelatorios()"><i class="fas fa-arrow-left"></i> Voltar</button>
        <button class="btn btn-primary btn-sm" onclick="exportarRelCSV('operacional')"><i class="fas fa-download"></i> Exportar</button>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
      <div class="kpi-card kpi-blue"><div class="kpi-icon"><i class="fas fa-clipboard-list"></i></div><div class="kpi-value">${ERP_DATA.ordens.length}</div><div class="kpi-label">Total OS</div></div>
      <div class="kpi-card kpi-green"><div class="kpi-icon"><i class="fas fa-check-circle"></i></div><div class="kpi-value">${concluidas}</div><div class="kpi-label">Concluídas</div></div>
      <div class="kpi-card kpi-orange"><div class="kpi-icon"><i class="fas fa-spinner"></i></div><div class="kpi-value">${emAndamento}</div><div class="kpi-label">Em Andamento</div></div>
      <div class="kpi-card kpi-red"><div class="kpi-icon"><i class="fas fa-pause-circle"></i></div><div class="kpi-value">${atrasadas}</div><div class="kpi-label">Bloqueadas/Pausadas</div></div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px">
      <div class="card">
        <div class="card-header"><h3><i class="fas fa-chart-pie" style="color:var(--fa-teal);margin-right:8px"></i>OS por Tipo</h3></div>
        <div class="card-body"><div style="height:200px"><canvas id="chartOSTipo"></canvas></div></div>
      </div>
      <div class="card">
        <div class="card-header"><h3><i class="fas fa-building" style="color:var(--blue-light);margin-right:8px"></i>OS por Contrato</h3></div>
        <div class="card-body"><div style="height:200px"><canvas id="chartOSContrato"></canvas></div></div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h3><i class="fas fa-list" style="color:var(--fa-teal);margin-right:8px"></i>Listagem de Ordens de Serviço</h3>
        <span style="font-size:12px;color:var(--text-secondary)">Total de Horas: <strong style="color:var(--fa-teal)">${totalHoras}h</strong></span>
      </div>
      <div class="table-wrapper">
        <table>
          <thead><tr><th>OS</th><th>Contrato</th><th>Descrição</th><th>Tipo</th><th>Responsável</th><th>Horas</th><th>Prioridade</th><th>Status</th></tr></thead>
          <tbody>
            ${ERP_DATA.ordens.map(o => `
              <tr>
                <td style="color:var(--fa-teal);font-weight:700;font-size:12px">${o.id}</td>
                <td style="font-size:11px;color:var(--text-secondary)">${o.contrato}</td>
                <td style="font-size:12px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${o.descricao}</td>
                <td><span class="badge badge-muted" style="font-size:10px">${o.tipo}</span></td>
                <td style="font-size:12px">${o.responsavel}</td>
                <td style="text-align:center;font-weight:600">${o.horas}h</td>
                <td>${prioridade(o.prioridade)}</td>
                <td>${statusBadge(o.status)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ─── RELATÓRIO COMPRAS ────────────────────────────────────
function _buildRelCompras() {
  const categorias = {};
  if (FA_PEDIDOS && FA_PEDIDOS.length) {
    FA_PEDIDOS.forEach(p => {
      const cat = p.conta_contabil || 'Outros';
      categorias[cat] = (categorias[cat]||0) + (p.valor_total||0);
    });
  }

  return `
    <div class="page-header" style="margin-top:0">
      <div class="page-title">
        <h3><i class="fas fa-shopping-cart" style="color:var(--fa-teal);margin-right:8px"></i>Relatórios de Compras e Suprimentos</h3>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary btn-sm" onclick="renderRelatorios()"><i class="fas fa-arrow-left"></i> Voltar</button>
        <button class="btn btn-primary btn-sm" onclick="exportarRelCSV('compras')"><i class="fas fa-download"></i> Exportar</button>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px">
      <div class="card">
        <div class="card-header"><h3><i class="fas fa-chart-pie" style="color:var(--fa-teal);margin-right:8px"></i>Gastos por Categoria</h3></div>
        <div class="card-body"><div style="height:220px"><canvas id="chartGatosCat"></canvas></div></div>
      </div>
      <div class="card">
        <div class="card-header"><h3><i class="fas fa-building" style="color:var(--orange);margin-right:8px"></i>Top Fornecedores por Volume</h3></div>
        <div class="card-body">
          <div style="height:220px"><canvas id="chartTopFor"></canvas></div>
        </div>
      </div>
    </div>

    <!-- Pedidos de Compra -->
    <div class="card">
      <div class="card-header"><h3><i class="fas fa-file-invoice" style="color:var(--fa-teal);margin-right:8px"></i>Histórico de Pedidos de Compra</h3></div>
      <div class="table-wrapper">
        <table>
          <thead><tr><th>Pedido</th><th>Fornecedor</th><th>Contrato</th><th>Descrição</th><th>Valor</th><th>Emissão</th><th>Entrega</th><th>Status</th></tr></thead>
          <tbody>
            ${(FA_PEDIDOS && FA_PEDIDOS.length ? FA_PEDIDOS : []).map(p => `
              <tr>
                <td style="color:var(--fa-teal);font-weight:700;font-size:12px">${p.numero}</td>
                <td style="font-weight:600">${p.fornecedor_nome}</td>
                <td style="font-size:11px;color:var(--text-secondary)">${p.contrato_id}</td>
                <td style="font-size:12px">${p.descricao}</td>
                <td style="font-weight:600;color:var(--fa-teal)">${fmt(p.valor_total)}</td>
                <td style="font-size:11px;color:var(--text-secondary)">${p.data_emissao||'—'}</td>
                <td style="font-size:11px;color:var(--text-secondary)">${p.data_entrega_prev||'—'}</td>
                <td>${statusBadge(p.status)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Fornecedores -->
    <div class="card" style="margin-top:14px">
      <div class="card-header"><h3><i class="fas fa-building" style="color:var(--orange);margin-right:8px"></i>Análise de Fornecedores Homologados</h3></div>
      <div class="table-wrapper">
        <table>
          <thead><tr><th>Fornecedor</th><th>Categoria</th><th>UF</th><th>Avaliação</th><th>Pedidos</th><th>Total Gasto</th><th>Docs</th><th>Status</th></tr></thead>
          <tbody>
            ${(FA_FORNECEDORES && FA_FORNECEDORES.length ? FA_FORNECEDORES : []).map(f => `
              <tr>
                <td style="font-weight:600">${f.nome_fantasia||f.razao_social}</td>
                <td><span class="badge badge-muted" style="font-size:10px">${f.categoria}</span></td>
                <td style="font-size:12px">${f.estado}</td>
                <td>${stars(f.avaliacao)}</td>
                <td style="text-align:center;font-weight:600">${f.total_pedidos||0}</td>
                <td style="font-weight:600;color:var(--fa-teal)">${fmtK(f.total_gasto||0)}</td>
                <td>${f.documentos_ok ? '<span class="badge badge-success" style="font-size:10px">OK</span>' : '<span class="badge badge-warning" style="font-size:10px">Pendente</span>'}</td>
                <td>${statusBadge(f.status)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ─── RELATÓRIO SSMA ───────────────────────────────────────
function _buildRelSSMA() {
  return `
    <div class="page-header" style="margin-top:0">
      <div class="page-title">
        <h3><i class="fas fa-hard-hat" style="color:var(--yellow-light);margin-right:8px"></i>Relatórios SSMA e Compliance</h3>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary btn-sm" onclick="renderRelatorios()"><i class="fas fa-arrow-left"></i> Voltar</button>
        <button class="btn btn-primary btn-sm" onclick="exportarRelCSV('ssma')"><i class="fas fa-download"></i> Exportar</button>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:16px">
      <div class="kpi-card kpi-green"><div class="kpi-icon"><i class="fas fa-calendar-check"></i></div><div class="kpi-value">142</div><div class="kpi-label">Dias sem Acidente</div></div>
      <div class="kpi-card kpi-blue"><div class="kpi-icon"><i class="fas fa-clipboard-check"></i></div><div class="kpi-value">97.2%</div><div class="kpi-label">Conformidade Docs</div></div>
      <div class="kpi-card kpi-yellow"><div class="kpi-icon"><i class="fas fa-exclamation-triangle"></i></div><div class="kpi-value">${ERP_DATA.incidentes.length}</div><div class="kpi-label">Incidentes Registrados</div></div>
      <div class="kpi-card kpi-teal"><div class="kpi-icon"><i class="fas fa-graduation-cap"></i></div><div class="kpi-value">88%</div><div class="kpi-label">Treinamentos OK</div></div>
      <div class="kpi-card kpi-red"><div class="kpi-icon"><i class="fas fa-times-circle"></i></div><div class="kpi-value">2</div><div class="kpi-label">Docs Vencidos</div></div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px">
      <div class="card">
        <div class="card-header"><h3><i class="fas fa-chart-pie" style="color:var(--yellow-light);margin-right:8px"></i>Incidentes por Tipo</h3></div>
        <div class="card-body"><div style="height:200px"><canvas id="chartIncidentes"></canvas></div></div>
      </div>
      <div class="card">
        <div class="card-header"><h3><i class="fas fa-chart-bar" style="color:var(--fa-teal);margin-right:8px"></i>Conformidade por Contrato</h3></div>
        <div class="card-body"><div style="height:200px"><canvas id="chartConformidade"></canvas></div></div>
      </div>
    </div>

    <div class="card">
      <div class="card-header"><h3><i class="fas fa-list" style="color:var(--fa-teal);margin-right:8px"></i>Registro de Incidentes</h3></div>
      <div class="table-wrapper">
        <table>
          <thead><tr><th>ID</th><th>Data</th><th>Tipo</th><th>Contrato</th><th>Descrição</th><th>Gravidade</th><th>Status</th><th>Responsável</th></tr></thead>
          <tbody>
            ${ERP_DATA.incidentes.map(i => `
              <tr>
                <td style="color:var(--yellow-light);font-weight:700;font-size:12px">${i.id}</td>
                <td style="font-size:12px">${i.data}</td>
                <td><span class="badge badge-warning" style="font-size:10px">${i.tipo}</span></td>
                <td style="font-size:11px;color:var(--text-secondary)">${i.contrato}</td>
                <td style="font-size:12px">${i.descricao}</td>
                <td><span class="badge ${i.gravidade==='Alta'?'badge-danger':i.gravidade==='Média'?'badge-warning':'badge-muted'}" style="font-size:10px">${i.gravidade}</span></td>
                <td>${statusBadge(i.status)}</td>
                <td style="font-size:12px">${i.responsavel}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Status documentação colaboradores -->
    <div class="card" style="margin-top:14px">
      <div class="card-header"><h3><i class="fas fa-id-card" style="color:var(--fa-teal);margin-right:8px"></i>Status de Documentação – Equipe</h3></div>
      <div class="table-wrapper">
        <table>
          <thead><tr><th>Colaborador</th><th>Função</th><th>Contrato</th><th>ASO</th><th>NR-10</th><th>NR-35</th><th>Doc. Geral</th><th>Status</th></tr></thead>
          <tbody>
            ${ERP_DATA.colaboradores.map(c => `
              <tr>
                <td style="font-weight:600">${c.nome}</td>
                <td style="font-size:12px">${c.funcao}</td>
                <td style="font-size:11px;color:var(--text-secondary)">${c.contrato}</td>
                <td>${statusBadge(c.aso.includes('2025')&&parseInt(c.aso.split('/')[1].split('/')[0])<4?'Vencendo':'Válido')}</td>
                <td>${statusBadge(c.nr10)}</td>
                <td>${statusBadge(c.nr35)}</td>
                <td>${statusBadge(c.docs)}</td>
                <td>${statusBadge(c.status)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ─── RELATÓRIO EQUIPE ─────────────────────────────────────
function _buildRelEquipe() {
  const ativos = ERP_DATA.colaboradores.filter(c=>c.status==='Ativo').length;
  const bloqueados = ERP_DATA.colaboradores.filter(c=>c.status==='Bloqueado').length;

  return `
    <div class="page-header" style="margin-top:0">
      <div class="page-title">
        <h3><i class="fas fa-users" style="color:var(--purple);margin-right:8px"></i>Relatórios de Equipe e Mobilização</h3>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary btn-sm" onclick="renderRelatorios()"><i class="fas fa-arrow-left"></i> Voltar</button>
        <button class="btn btn-primary btn-sm" onclick="exportarRelCSV('equipe')"><i class="fas fa-download"></i> Exportar</button>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
      <div class="kpi-card kpi-blue"><div class="kpi-icon"><i class="fas fa-users"></i></div><div class="kpi-value">${ERP_DATA.colaboradores.length}</div><div class="kpi-label">Total Efetivo</div></div>
      <div class="kpi-card kpi-green"><div class="kpi-icon"><i class="fas fa-user-check"></i></div><div class="kpi-value">${ativos}</div><div class="kpi-label">Ativos</div></div>
      <div class="kpi-card kpi-red"><div class="kpi-icon"><i class="fas fa-user-lock"></i></div><div class="kpi-value">${bloqueados}</div><div class="kpi-label">Bloqueados</div></div>
      <div class="kpi-card kpi-teal"><div class="kpi-icon"><i class="fas fa-hard-hat"></i></div><div class="kpi-value">${ERP_DATA.colaboradores.filter(c=>c.nr10==='Válido'||c.nr35==='Válido').length}</div><div class="kpi-label">Com NRs Válidas</div></div>
    </div>

    <div class="card">
      <div class="card-header"><h3><i class="fas fa-chart-bar" style="color:var(--purple);margin-right:8px"></i>Efetivo por Contrato</h3></div>
      <div class="card-body"><div style="height:200px"><canvas id="chartEfetivoContr"></canvas></div></div>
    </div>

    <div class="card" style="margin-top:14px">
      <div class="card-header"><h3><i class="fas fa-id-card" style="color:var(--fa-teal);margin-right:8px"></i>Relação de Colaboradores</h3></div>
      <div class="table-wrapper">
        <table>
          <thead><tr><th>ID</th><th>Nome</th><th>Função</th><th>Contrato</th><th>Turno</th><th>NR-10</th><th>NR-35</th><th>Status</th></tr></thead>
          <tbody>
            ${ERP_DATA.colaboradores.map(c => `
              <tr>
                <td style="color:var(--fa-teal);font-size:11px;font-weight:600">${c.id}</td>
                <td style="font-weight:600">${c.nome}</td>
                <td style="font-size:12px">${c.funcao}</td>
                <td style="font-size:11px;color:var(--text-secondary)">${c.contrato}</td>
                <td><span class="badge badge-muted" style="font-size:10px">${c.turno}</span></td>
                <td>${statusBadge(c.nr10)}</td>
                <td>${statusBadge(c.nr35)}</td>
                <td>${statusBadge(c.status)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ─── CHARTS POR CATEGORIA ─────────────────────────────────
function _initChartsCategoria(cat) {
  const co = { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#8b949e', font: { size: 10 } } } }, scales: { x: { ticks: { color: '#8b949e', font: { size: 10 } }, grid: { color: '#21262d' } }, y: { ticks: { color: '#8b949e', font: { size: 10 } }, grid: { color: '#21262d' } } } };
  const coNoscale = { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#8b949e', font: { size: 11 }, padding: 8 } } } };

  if (cat === 'financeiro') {
    const cf = document.getElementById('chartFluxoCaixa');
    if (cf) new Chart(cf, { type: 'bar', data: {
      labels: ['Semana 1','Semana 2','Semana 3','Semana 4'],
      datasets: [
        { label: 'Entradas', data: [0, 428750, 115000, 118438], backgroundColor: 'rgba(34,197,94,0.7)', borderRadius: 4 },
        { label: 'Saídas', data: [32025, 186000, 211130, 152600], backgroundColor: 'rgba(239,68,68,0.7)', borderRadius: 4 }
      ]
    }, options: { ...co } });
  }

  if (cat === 'contratos') {
    const cc = document.getElementById('chartCarteiraContr');
    if (cc) new Chart(cc, { type: 'bar', data: {
      labels: ERP_DATA.contratos.map(c=>c.cliente),
      datasets: [
        { label: 'Valor Contrato', data: ERP_DATA.contratos.map(c=>c.valor), backgroundColor: 'rgba(26,115,232,0.6)', borderRadius: 4 },
        { label: 'Medido', data: ERP_DATA.contratos.map(c=>c.medidoAcum), backgroundColor: 'rgba(0,180,184,0.8)', borderRadius: 4 }
      ]
    }, options: { ...co } });
  }

  if (cat === 'operacional') {
    const tipos = {};
    ERP_DATA.ordens.forEach(o => { tipos[o.tipo] = (tipos[o.tipo]||0)+1; });
    const ct = document.getElementById('chartOSTipo');
    if (ct) new Chart(ct, { type: 'doughnut', data: {
      labels: Object.keys(tipos), datasets: [{ data: Object.values(tipos), backgroundColor: ['#1a73e8','#e67e22','#22c55e','#9b59b6'], borderWidth: 0 }]
    }, options: { ...coNoscale } });

    const porContrato = {};
    ERP_DATA.ordens.forEach(o => { porContrato[o.contrato] = (porContrato[o.contrato]||0)+1; });
    const coc = document.getElementById('chartOSContrato');
    if (coc) new Chart(coc, { type: 'bar', data: {
      labels: Object.keys(porContrato),
      datasets: [{ label: 'Qtd OS', data: Object.values(porContrato), backgroundColor: ['#1a73e8','#e67e22','#22c55e','#9b59b6','#00b4d8'], borderRadius: 4 }]
    }, options: { ...co, indexAxis: 'y' } });
  }

  if (cat === 'compras') {
    const pedidos = FA_PEDIDOS && FA_PEDIDOS.length ? FA_PEDIDOS : [
      { conta_contabil:'1.1.3.06 – Combustível', valor_total:29025 },
      { conta_contabil:'1.1.3.01 – Lubrificantes', valor_total:3830 },
      { conta_contabil:'1.1.3.03 – Material Elétrico', valor_total:4530 },
      { conta_contabil:'1.1.3.05 – EPI e Segurança', valor_total:2520 },
      { conta_contabil:'1.1.3.02 – Manutenção', valor_total:1850 }
    ];
    const catGastos = {};
    pedidos.forEach(p => {
      const k = (p.conta_contabil||'Outros').split('–').pop().trim();
      catGastos[k] = (catGastos[k]||0)+(p.valor_total||0);
    });
    const cgc = document.getElementById('chartGatosCat');
    if (cgc) new Chart(cgc, { type: 'doughnut', data: {
      labels: Object.keys(catGastos),
      datasets: [{ data: Object.values(catGastos), backgroundColor: ['#1a73e8','#e67e22','#22c55e','#9b59b6','#00b4d8','#d97706'], borderWidth: 0 }]
    }, options: { ...coNoscale } });

    const fors = FA_FORNECEDORES && FA_FORNECEDORES.length ? FA_FORNECEDORES : [];
    const ctf = document.getElementById('chartTopFor');
    if (ctf) new Chart(ctf, { type: 'bar', data: {
      labels: fors.slice(0,5).map(f=>f.nome_fantasia||f.razao_social),
      datasets: [{ label: 'Total Gasto', data: fors.slice(0,5).map(f=>f.total_gasto), backgroundColor: ['#e67e22','#1a73e8','#22c55e','#9b59b6','#00b4d8'], borderRadius: 4 }]
    }, options: { ...co, indexAxis: 'y' } });
  }

  if (cat === 'ssma') {
    const tiposInc = {};
    ERP_DATA.incidentes.forEach(i => { tiposInc[i.tipo] = (tiposInc[i.tipo]||0)+1; });
    const ci = document.getElementById('chartIncidentes');
    if (ci) new Chart(ci, { type: 'doughnut', data: {
      labels: Object.keys(tiposInc),
      datasets: [{ data: Object.values(tiposInc), backgroundColor: ['#f59e0b','#ef4444','#1a73e8'], borderWidth: 0 }]
    }, options: { ...coNoscale } });

    const cc2 = document.getElementById('chartConformidade');
    if (cc2) new Chart(cc2, { type: 'bar', data: {
      labels: ERP_DATA.contratos.filter(c=>c.status==='Ativo').map(c=>c.cliente),
      datasets: [{ label: 'Conformidade (%)', data: [98, 92, 97], backgroundColor: ['#22c55e','#f59e0b','#22c55e'], borderRadius: 4 }]
    }, options: { ...co } });
  }

  if (cat === 'equipe') {
    const porContrato2 = {};
    ERP_DATA.colaboradores.forEach(c => { porContrato2[c.contrato] = (porContrato2[c.contrato]||0)+1; });
    const ce = document.getElementById('chartEfetivoContr');
    if (ce) new Chart(ce, { type: 'bar', data: {
      labels: Object.keys(porContrato2),
      datasets: [{ label: 'Efetivo', data: Object.values(porContrato2), backgroundColor: '#9b59b6', borderRadius: 4 }]
    }, options: { ...co } });
  }
}

// ─── EXPORTAÇÃO CSV COMPLETA ──────────────────────────────
function exportarRelCSV(tipo) {
  const agora = new Date().toLocaleDateString('pt-BR');

  const mapas = {
    resumo: () => {
      const cA = ERP_DATA.contratos.filter(c=>c.status==='Ativo').length;
      const cT = ERP_DATA.contratos.reduce((a,c)=>a+c.valor,0);
      const mT = ERP_DATA.contratos.reduce((a,c)=>a+c.medidoAcum,0);
      const cuT = ERP_DATA.contratos.reduce((a,c)=>a+c.custoAcum,0);
      const mg = mT > 0 ? ((mT-cuT)/mT*100).toFixed(1) : 0;
      return [
        ['RELATÓRIO: RESUMO EXECUTIVO – FRASER ALEXANDER', '', '', '', ''],
        ['Gerado em:', agora, '', '', ''],
        [''],
        ['INDICADOR', 'VALOR'],
        ['Contratos Ativos', cA],
        ['Carteira Total (R$)', cT],
        ['Total Medido/Faturado (R$)', mT],
        ['Total de Custos (R$)', cuT],
        ['Margem Bruta Global (%)', mg+'%'],
        ['Equipe Ativa', ERP_DATA.colaboradores.filter(c=>c.status==='Ativo').length],
        ['OS em Andamento', ERP_DATA.ordens.filter(o=>o.status==='Em Andamento').length],
        ['Pedidos Aguardando Aprovação', (FA_PEDIDOS||[]).filter(p=>p.status==='Aguardando Aprovação').length],
        [''],
        ['CONTRATOS', 'CLIENTE', 'VALOR', 'MEDIDO', 'MARGEM%', 'STATUS'],
        ...ERP_DATA.contratos.map(c=>[c.id, c.cliente, c.valor, c.medidoAcum, c.margem+'%', c.status])
      ];
    },
    financeiro: () => {
      const rows = [
        ['RELATÓRIO: FINANCEIRO E FATURAMENTO – FRASER ALEXANDER', '', '', '', '', ''],
        ['Gerado em:', agora, '', '', '', ''],
        [''],
        ['DRE RESUMIDA', 'VALOR (R$)'],
        ['Receita Bruta (Medições Aprovadas)', 1628000],
        ['(-) Deduções / Glosas', -26250],
        ['= Receita Líquida', 1601750],
        ['(-) Custo de Mão de Obra', -760000],
        ['(-) Custo de Materiais', -41755],
        ['(-) Custo de Subcontratados', -85000],
        ['(-) Custos Diretos Outros', -180000],
        ['= Lucro Bruto (GPT)', 534995],
        ['(-) Despesas Administrativas', -95000],
        ['(-) Depreciação de Equipamentos', -24000],
        ['= EBITDA', 415995],
        ['Margem EBITDA', '26%'],
        [''],
        ['FATURAMENTO MENSAL', 'PREVISTO (R$)', 'REALIZADO (R$)'],
        ...CHART_DATA.faturamentoMensal.labels.map((l,i)=>[l, CHART_DATA.faturamentoMensal.previsto[i], CHART_DATA.faturamentoMensal.realizado[i]]),
        [''],
        ['CONTAS A PAGAR', 'VALOR', 'VENCIMENTO', 'STATUS', 'TIPO'],
        ['Fornecedores (Combustível)', 29025, '2025-04-05', 'Aprovado', 'Fornecedor'],
        ['Folha de Pagamento Mar/25', 186000, '2025-04-05', 'Aprovado', 'RH'],
        ['Aluguel Equipamentos Brumadinho', 32000, '2025-04-10', 'Aprovado', 'Equip.'],
        ['Seguro Frota – Trim. 1', 8400, '2025-04-15', 'Pendente', 'Seguro'],
        ...(typeof FA_CONTAS_PAGAR !== 'undefined' && FA_CONTAS_PAGAR ? FA_CONTAS_PAGAR.map(cp=>[cp.descricao||'', cp.valor||0, cp.vencimento||'', cp.status||'', cp.tipo||'']) : [])
      ];
      return rows;
    },
    contratos: () => {
      const rows = [
        ['RELATÓRIO: CONTRATOS E MEDIÇÕES – FRASER ALEXANDER', '', '', '', '', '', '', ''],
        ['Gerado em:', agora, '', '', '', '', '', ''],
        [''],
        ['CONTRATO', 'CLIENTE', 'UNIDADE', 'GESTOR', 'TIPO', 'VALOR (R$)', 'MEDIDO ACUM. (R$)', 'CUSTO ACUM. (R$)', 'MARGEM%', 'PROGRESSO%', 'INÍCIO', 'FIM', 'STATUS'],
        ...ERP_DATA.contratos.map(c=>[c.id, c.cliente, c.unidade||'', c.gestor||'', c.tipo||'', c.valor, c.medidoAcum, c.custoAcum, c.margem+'%', c.progress+'%', c.inicio, c.fim, c.status]),
        [''],
        ['MEDIÇÕES', 'CONTRATO', 'PERÍODO', 'VALOR MEDIDO', 'GLOSA', 'VALOR LÍQUIDO', 'STATUS'],
        ...ERP_DATA.medicoes.map(m=>[m.id||'', m.contrato, m.periodo||m.mes||'', m.valor||0, m.glosa||0, (m.valor||0)-(m.glosa||0), m.status||''])
      ];
      return rows;
    },
    operacional: () => {
      const rows = [
        ['RELATÓRIO: OPERACIONAL / ORDENS DE SERVIÇO – FRASER ALEXANDER', '', '', '', '', ''],
        ['Gerado em:', agora, '', '', '', ''],
        [''],
        ['OS', 'CONTRATO', 'TIPO', 'DESCRIÇÃO', 'RESPONSÁVEL', 'HORAS', 'PRIORIDADE', 'STATUS'],
        ...ERP_DATA.ordens.map(o=>[o.id, o.contrato, o.tipo, o.descricao||'', o.responsavel||'', o.horas||0, o.prioridade||'', o.status])
      ];
      return rows;
    },
    compras: () => {
      const pedidos = (typeof FA_PEDIDOS !== 'undefined' && FA_PEDIDOS && FA_PEDIDOS.length) ? FA_PEDIDOS : [];
      const fornecedores = (typeof FA_FORNECEDORES !== 'undefined' && FA_FORNECEDORES && FA_FORNECEDORES.length) ? FA_FORNECEDORES : [];
      const rows = [
        ['RELATÓRIO: COMPRAS E SUPRIMENTOS – FRASER ALEXANDER', '', '', '', '', '', ''],
        ['Gerado em:', agora, '', '', '', '', ''],
        [''],
        ['PEDIDOS DE COMPRA', '', '', '', '', '', ''],
        ['Nº PEDIDO', 'FORNECEDOR', 'CONTRATO', 'DESCRIÇÃO', 'VALOR (R$)', 'DATA EMISSÃO', 'DATA ENTREGA', 'PRIORIDADE', 'STATUS'],
        ...pedidos.map(p=>[p.numero||p.id, p.fornecedor_nome||'', p.contrato_id||'', p.descricao||'', p.valor_total||0, p.data_emissao||'', p.data_entrega_prev||'', p.prioridade||'', p.status||'']),
        [''],
        ['FORNECEDORES HOMOLOGADOS', '', '', '', '', ''],
        ['FORNECEDOR', 'RAZÃO SOCIAL', 'CNPJ', 'CATEGORIA', 'CIDADE/UF', 'AVALIAÇÃO', 'TOTAL PEDIDOS', 'TOTAL GASTO (R$)', 'STATUS'],
        ...fornecedores.map(f=>[f.nome_fantasia||f.razao_social||'', f.razao_social||'', f.cnpj||'', f.categoria||'', `${f.cidade||''}/${f.estado||''}`, f.avaliacao||0, f.total_pedidos||0, f.total_gasto||0, f.status||''])
      ];
      return rows;
    },
    ssma: () => {
      const rows = [
        ['RELATÓRIO: SSMA E COMPLIANCE – FRASER ALEXANDER', '', '', '', '', ''],
        ['Gerado em:', agora, '', '', '', ''],
        [''],
        ['INDICADORES SSMA', 'VALOR'],
        ['Colaboradores com Docs OK', ERP_DATA.colaboradores.filter(c=>c.docs==='OK').length],
        ['Colaboradores com Atenção', ERP_DATA.colaboradores.filter(c=>c.docs==='Atenção').length],
        ['Colaboradores Crítico', ERP_DATA.colaboradores.filter(c=>c.docs==='Crítico').length],
        ['Total de Incidentes', ERP_DATA.incidentes.length],
        [''],
        ['REGISTRO DE INCIDENTES', '', '', '', '', ''],
        ['ID', 'DATA', 'TIPO', 'CONTRATO', 'DESCRIÇÃO', 'GRAVIDADE', 'STATUS', 'RESPONSÁVEL'],
        ...ERP_DATA.incidentes.map(i=>[i.id, i.data||'', i.tipo||'', i.contrato||'', i.descricao||'', i.gravidade||'', i.status||'', i.responsavel||'']),
        [''],
        ['STATUS DOCUMENTAÇÃO EQUIPE', '', '', '', '', ''],
        ['ID', 'NOME', 'FUNÇÃO', 'CONTRATO', 'ASO', 'NR-10', 'NR-35', 'DOC. GERAL', 'STATUS'],
        ...ERP_DATA.colaboradores.map(c=>[c.id||'', c.nome||'', c.funcao||'', c.contrato||'', c.aso||'', c.nr10||'', c.nr35||'', c.docs||'', c.status||''])
      ];
      return rows;
    },
    equipe: () => {
      const rows = [
        ['RELATÓRIO: EQUIPE E MOBILIZAÇÃO – FRASER ALEXANDER', '', '', '', '', ''],
        ['Gerado em:', agora, '', '', '', ''],
        [''],
        ['RESUMO DE EFETIVO', 'VALOR'],
        ['Total de Colaboradores', ERP_DATA.colaboradores.length],
        ['Ativos', ERP_DATA.colaboradores.filter(c=>c.status==='Ativo').length],
        ['Bloqueados', ERP_DATA.colaboradores.filter(c=>c.status==='Bloqueado').length],
        ['Mobilizando', ERP_DATA.colaboradores.filter(c=>c.status==='Mobilizando').length],
        [''],
        ['RELAÇÃO DE COLABORADORES', '', '', '', '', ''],
        ['ID', 'NOME', 'FUNÇÃO', 'CONTRATO', 'TURNO', 'NR-10', 'NR-35', 'DOC. GERAL', 'STATUS'],
        ...ERP_DATA.colaboradores.map(c=>[c.id||'', c.nome||'', c.funcao||'', c.contrato||'', c.turno||'', c.nr10||'', c.nr35||'', c.docs||'', c.status||''])
      ];
      return rows;
    }
  };

  const fn = mapas[tipo];
  if (!fn) { showToast('Exportando dados...', 'info'); return; }

  try {
    const rows = fn();
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(';')).join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(csv);
    a.download = `rel_${tipo}_fraser_alexander_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast(`✅ Relatório de ${tipo} exportado com sucesso! (${agora})`, 'success');
    logAction('Exportação CSV', 'Relatórios', `Relatório exportado: ${tipo}`);
  } catch(err) {
    showToast('Erro ao exportar relatório. Tente novamente.', 'error');
    console.error('Erro exportação CSV:', err);
  }
}

function imprimirRelatorio() {
  showToast('Abrindo janela de impressão/PDF...', 'info');
  const conteudo = document.getElementById('relatorioConteudo');
  if (!conteudo) { window.print(); return; }

  const win = window.open('', '_blank', 'width=1000,height=750,scrollbars=yes');
  if (!win) { showToast('Bloqueador de pop-up ativo! Permita pop-ups para este site.', 'warning', 5000); return; }

  const agora = new Date().toLocaleDateString('pt-BR');
  win.document.write(`<!DOCTYPE html><html lang="pt-BR"><head>
    <meta charset="UTF-8">
    <title>Relatório Fraser Alexander – ${agora}</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css">
    <style>
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family:Arial,sans-serif; background:#fff; color:#1a1a1a; font-size:12px; padding:20px; }
      h2,h3,h4 { color:#1a1a2e; margin-bottom:8px; }
      table { width:100%; border-collapse:collapse; margin-bottom:16px; }
      th { background:#1a1a2e; color:white; padding:6px 8px; font-size:11px; text-align:left; }
      td { padding:5px 8px; border-bottom:1px solid #eee; font-size:11px; }
      tr:nth-child(even) td { background:#f9f9f9; }
      .header-print { background:#1a1a2e; color:white; padding:14px 20px; margin:-20px -20px 20px; display:flex; justify-content:space-between; align-items:center; }
      .badge { display:inline-block; padding:2px 6px; border-radius:8px; font-size:10px; font-weight:600; }
      .kpi-row { display:flex; gap:12px; margin-bottom:16px; }
      .kpi { flex:1; background:#f0f4f8; border-radius:6px; padding:10px; text-align:center; }
      .kpi-val { font-size:18px; font-weight:700; color:#1a1a2e; }
      .kpi-lbl { font-size:10px; color:#666; margin-top:2px; }
      @media print { body { padding:10px; } .header-print { margin:-10px -10px 16px; } }
    </style>
  </head><body>
    <div class="header-print">
      <div>
        <div style="font-size:18px;font-weight:800;letter-spacing:1px">FRASER ALEXANDER</div>
        <div style="font-size:11px;opacity:0.6">Mineração Ltda. · Sistema de Gestão Integrado</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:14px;font-weight:700;color:#e67e22">RELATÓRIO GERENCIAL</div>
        <div style="font-size:11px;opacity:0.6">Emitido em: ${agora}</div>
      </div>
    </div>
    ${conteudo.innerHTML}
    <div style="margin-top:20px;padding-top:12px;border-top:2px solid #e67e22;font-size:10px;color:#888;display:flex;justify-content:space-between">
      <span>Fraser Alexander Mineração Ltda. · CNPJ 00.000.000/0001-00</span>
      <span>Sistema ERP v3.1 · ${agora}</span>
    </div>
  </body></html>`);
  win.document.close();
  win.onload = () => setTimeout(() => { win.focus(); win.print(); }, 500);
  logAction('Impressão Relatório', 'Relatórios', 'Relatório enviado para impressão/PDF');
}

function baixarPagamento(btn, desc) {
  btn.closest('tr').querySelector('td:last-child').innerHTML = '<span style="color:var(--green-light);font-size:12px"><i class="fas fa-check-circle"></i> Pago</span>';
  showToast(`Baixa realizada: ${desc}`, 'success');
  logAction('Baixa Pagamento', 'Financeiro', `Conta baixada: ${desc}`);
}

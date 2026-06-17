// =====================================================
// ERP – Módulo DRE + Fluxo de Caixa Projetado v1.0
// Demonstração do Resultado do Exercício + Projeção
// =====================================================

// ─── Helpers de dados ─────────────────────────────
function _dreGet(k, def) {
  try { return JSON.parse(localStorage.getItem(k) || JSON.stringify(def)); } catch(e) { return def; }
}
function _dreSave(k, v) { localStorage.setItem(k, JSON.stringify(v)); }

function _dreGetLancamentos() { return _dreGet('fa_dre_lancamentos', []); }
function _dreSaveLancamentos(d) { _dreSave('fa_dre_lancamentos', d); }
function _dreGetOrcamentos() { return _dreGet('fa_dre_orcamentos', []); }
function _dreSaveOrcamentos(d) { _dreSave('fa_dre_orcamentos', d); }
function _dreGetProjecoes() { return _dreGet('fa_fluxo_projecoes', []); }
function _dreSaveProjecoes(d) { _dreSave('fa_fluxo_projecoes', d); }

let _dreAba = 'dre';
let _dreChartFluxo = null, _dreChartDRE = null, _dreChartWaterfall = null;

// ─── Estrutura DRE padrão ─────────────────────────
const DRE_ESTRUTURA = [
  { id: 'rec_bruta',   label: 'Receita Bruta de Serviços/Vendas', tipo: 'receita', nivel: 1 },
  { id: 'ded_rec',     label: '(-) Deduções da Receita (Impostos s/ Receita)', tipo: 'deducao', nivel: 2 },
  { id: 'rec_liq',     label: '= Receita Líquida', tipo: 'resultado', nivel: 1 },
  { id: 'cpmv',        label: '(-) Custo dos Produtos/Serviços (CPMV)', tipo: 'custo', nivel: 2 },
  { id: 'lucro_bruto', label: '= Lucro Bruto', tipo: 'resultado', nivel: 1 },
  { id: 'desp_oper',   label: '(-) Despesas Operacionais', tipo: 'custo', nivel: 2 },
  { id: 'desp_vendas', label: '   Despesas com Vendas', tipo: 'custo', nivel: 3 },
  { id: 'desp_adm',    label: '   Despesas Administrativas', tipo: 'custo', nivel: 3 },
  { id: 'desp_pessoal',label: '   Despesas com Pessoal', tipo: 'custo', nivel: 3 },
  { id: 'ebitda',      label: '= EBITDA', tipo: 'resultado', nivel: 1 },
  { id: 'depreciacao', label: '(-) Depreciação e Amortização', tipo: 'custo', nivel: 2 },
  { id: 'ebit',        label: '= EBIT (Resultado Operacional)', tipo: 'resultado', nivel: 1 },
  { id: 'res_fin',     label: '+/- Resultado Financeiro', tipo: 'neutro', nivel: 2 },
  { id: 'rec_fin',     label: '   Receitas Financeiras', tipo: 'receita', nivel: 3 },
  { id: 'desp_fin',    label: '   Despesas Financeiras', tipo: 'custo', nivel: 3 },
  { id: 'lair',        label: '= LAIR (Resultado Antes do IR)', tipo: 'resultado', nivel: 1 },
  { id: 'ir_csll',     label: '(-) IR e CSLL', tipo: 'custo', nivel: 2 },
  { id: 'luc_liq',     label: '= Lucro Líquido do Período', tipo: 'resultado destaque', nivel: 1 },
];

// ─── Calcula valores DRE a partir dos lançamentos ─
function _dreCalcular(lancamentos, mes, ano) {
  const lMes = lancamentos.filter(l => {
    if (!l.competencia) return false;
    const [am, ym] = l.competencia.split('/');
    return parseInt(am) === mes && parseInt(ym) === ano;
  });

  const soma = (tipo) => lMes.filter(l => l.conta === tipo).reduce((a,b) => a + (parseFloat(b.valor)||0), 0);

  const rec_bruta   = soma('rec_bruta') + soma('rec_servicos') + soma('rec_vendas');
  const ded_rec     = soma('ded_rec') + soma('impostos_receita');
  const rec_liq     = rec_bruta - ded_rec;
  const cpmv        = soma('cpmv') + soma('custo_servicos') + soma('custo_produtos');
  const lucro_bruto = rec_liq - cpmv;
  const desp_vendas = soma('desp_vendas');
  const desp_adm    = soma('desp_adm');
  const desp_pessoal= soma('desp_pessoal');
  const desp_oper   = desp_vendas + desp_adm + desp_pessoal + soma('desp_outras');
  const ebitda      = lucro_bruto - desp_oper;
  const depreciacao = soma('depreciacao') + soma('amortizacao');
  const ebit        = ebitda - depreciacao;
  const rec_fin     = soma('rec_fin');
  const desp_fin    = soma('desp_fin');
  const res_fin     = rec_fin - desp_fin;
  const lair        = ebit + res_fin;
  const ir_csll     = soma('ir_csll');
  const luc_liq     = lair - ir_csll;

  return { rec_bruta, ded_rec, rec_liq, cpmv, lucro_bruto, desp_vendas, desp_adm,
           desp_pessoal, desp_oper, ebitda, depreciacao, ebit, rec_fin, desp_fin,
           res_fin, lair, ir_csll, luc_liq };
}

// ─── Render principal ──────────────────────────────
function renderDRE() {
  if (!hasPermission('financeiro', 'view')) { renderAcessoNegado(); return; }
  const main = document.getElementById('mainContent');

  main.innerHTML = `
    <div class="page-header">
      <div class="page-title">
        <h2><i class="fas fa-chart-line" style="color:var(--fa-teal);margin-right:10px"></i>DRE & Fluxo de Caixa</h2>
        <p>Demonstração do Resultado do Exercício, Projeção e Análise de Rentabilidade</p>
      </div>
      <div class="page-actions" style="gap:8px;display:flex;flex-wrap:wrap">
        ${hasPermission('financeiro','create') ? `
        <button class="btn btn-success btn-sm" onclick="_dreNovoLancamento()">
          <i class="fas fa-plus"></i> Lançamento
        </button>` : ''}
        <button class="btn btn-secondary btn-sm" onclick="_dreExportar()">
          <i class="fas fa-file-excel"></i> Exportar
        </button>
      </div>
    </div>

    <!-- Abas -->
    <div class="tab-bar" style="margin-bottom:16px">
      <button class="tab-btn ${_dreAba==='dre'?'active':''}" onclick="_dreSetAba('dre')">
        <i class="fas fa-table"></i> DRE Mensal
      </button>
      <button class="tab-btn ${_dreAba==='acumulado'?'active':''}" onclick="_dreSetAba('acumulado')">
        <i class="fas fa-layer-group"></i> DRE Acumulado
      </button>
      <button class="tab-btn ${_dreAba==='fluxo'?'active':''}" onclick="_dreSetAba('fluxo')">
        <i class="fas fa-water"></i> Fluxo de Caixa
      </button>
      <button class="tab-btn ${_dreAba==='projecao'?'active':''}" onclick="_dreSetAba('projecao')">
        <i class="fas fa-magic"></i> Projeção 12M
      </button>
      <button class="tab-btn ${_dreAba==='lancamentos'?'active':''}" onclick="_dreSetAba('lancamentos')">
        <i class="fas fa-list-alt"></i> Lançamentos
      </button>
    </div>

    <div id="dreConteudo"></div>
  `;

  _dreRenderAba();
}

function _dreSetAba(aba) {
  _dreAba = aba;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  const btns = document.querySelectorAll('.tab-btn');
  const idx = ['dre','acumulado','fluxo','projecao','lancamentos'].indexOf(aba);
  if (btns[idx]) btns[idx].classList.add('active');
  _dreRenderAba();
}

function _dreRenderAba() {
  const el = document.getElementById('dreConteudo');
  if (!el) return;
  if (_dreAba === 'dre') _dreRenderDRE(el);
  else if (_dreAba === 'acumulado') _dreRenderAcumulado(el);
  else if (_dreAba === 'fluxo') _dreRenderFluxo(el);
  else if (_dreAba === 'projecao') _dreRenderProjecao(el);
  else if (_dreAba === 'lancamentos') _dreRenderLancamentos(el);
}

// ─── Aba DRE Mensal ───────────────────────────────
function _dreRenderDRE(el) {
  const hoje = new Date();
  const mesAtual = hoje.getMonth() + 1;
  const anoAtual = hoje.getFullYear();
  const mesAnterior = mesAtual === 1 ? 12 : mesAtual - 1;
  const anoAnterior = mesAtual === 1 ? anoAtual - 1 : anoAtual;

  const lancamentos = _dreGetLancamentos();
  const valAtual = _dreCalcular(lancamentos, mesAtual, anoAtual);
  const valAnt   = _dreCalcular(lancamentos, mesAnterior, anoAnterior);

  // Injeta dados do financeiro existente se vazio
  const contas   = _dreGet('fa_contas_pagar', []);
  const faturas  = (window.ERP_DATA?.faturas) || [];
  const cpMes    = contas.filter(c => {
    const venc = c.vencimento || c.data_pagamento || '';
    return venc.includes(`/${anoAtual}`);
  });

  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

  // KPIs rápidos
  const margem = valAtual.rec_liq > 0 ? ((valAtual.luc_liq / valAtual.rec_liq) * 100).toFixed(1) : 0;
  const ebitdaMarg = valAtual.rec_liq > 0 ? ((valAtual.ebitda / valAtual.rec_liq) * 100).toFixed(1) : 0;
  const varLucro = valAnt.luc_liq !== 0 ? (((valAtual.luc_liq - valAnt.luc_liq) / Math.abs(valAnt.luc_liq)) * 100).toFixed(1) : 0;

  el.innerHTML = `
    <div class="kpi-grid" style="grid-template-columns:repeat(5,1fr);margin-bottom:16px">
      <div class="kpi-card kpi-teal">
        <div class="kpi-icon"><i class="fas fa-arrow-up"></i></div>
        <div class="kpi-value">${fmt(valAtual.rec_liq)}</div>
        <div class="kpi-label">Receita Líquida</div>
        <div class="kpi-delta">${meses[mesAtual-1]}/${anoAtual}</div>
      </div>
      <div class="kpi-card kpi-green">
        <div class="kpi-icon"><i class="fas fa-percentage"></i></div>
        <div class="kpi-value">${ebitdaMarg}%</div>
        <div class="kpi-label">Margem EBITDA</div>
        <div class="kpi-delta delta-up">Meta: 25%</div>
      </div>
      <div class="kpi-card ${parseFloat(margem) >= 15 ? 'kpi-green' : 'kpi-red'}">
        <div class="kpi-icon"><i class="fas fa-chart-pie"></i></div>
        <div class="kpi-value">${margem}%</div>
        <div class="kpi-label">Margem Líquida</div>
        <div class="kpi-delta">Meta: 15%</div>
      </div>
      <div class="kpi-card ${parseFloat(varLucro) >= 0 ? 'kpi-green' : 'kpi-orange'}">
        <div class="kpi-icon"><i class="fas fa-chart-line"></i></div>
        <div class="kpi-value">${fmt(valAtual.luc_liq)}</div>
        <div class="kpi-label">Lucro Líquido</div>
        <div class="kpi-delta ${parseFloat(varLucro)>=0?'delta-up':'delta-down'}">${parseFloat(varLucro)>=0?'▲':'▼'} ${Math.abs(varLucro)}% vs mês ant.</div>
      </div>
      <div class="kpi-card kpi-blue">
        <div class="kpi-icon"><i class="fas fa-layer-group"></i></div>
        <div class="kpi-value">${fmt(valAtual.ebitda)}</div>
        <div class="kpi-label">EBITDA</div>
        <div class="kpi-delta">${meses[mesAtual-1]}/${anoAtual}</div>
      </div>
    </div>

    <!-- Seletor de período -->
    <div class="card" style="margin-bottom:14px">
      <div class="card-header" style="display:flex;justify-content:space-between;align-items:center">
        <h4><i class="fas fa-table" style="color:var(--fa-teal);margin-right:6px"></i>DRE – ${meses[mesAtual-1]}/${anoAtual}</h4>
        <div style="display:flex;gap:8px">
          <select class="form-control" id="dreMesSel" style="width:100px;font-size:12px" onchange="_dreAtualizarTabela()">
            ${meses.map((m,i)=>`<option value="${i+1}" ${i+1===mesAtual?'selected':''}>${m}</option>`).join('')}
          </select>
          <select class="form-control" id="dreAnoSel" style="width:80px;font-size:12px" onchange="_dreAtualizarTabela()">
            ${[2023,2024,2025,2026].map(a=>`<option value="${a}" ${a===anoAtual?'selected':''}>${a}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="table-wrapper">
        <table id="dreTabela">
          <thead>
            <tr>
              <th style="width:40%">Conta / Linha</th>
              <th style="text-align:right">Realizado</th>
              <th style="text-align:right">Orçado</th>
              <th style="text-align:right">Variação</th>
              <th style="text-align:right">Mês Ant.</th>
              <th style="text-align:right">Var. M/M</th>
            </tr>
          </thead>
          <tbody id="dreTbody">
            ${_dreGerarLinhas(valAtual, valAnt)}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Gráfico Waterfall -->
    <div class="card">
      <div class="card-header">
        <h4><i class="fas fa-chart-bar" style="color:var(--fa-teal);margin-right:6px"></i>Composição do Resultado</h4>
      </div>
      <div class="card-body">
        <div style="height:260px"><canvas id="dreChartBar"></canvas></div>
      </div>
    </div>
  `;

  setTimeout(() => _dreInicializarChart(valAtual), 100);
}

function _dreGerarLinhas(val, valAnt) {
  const map = {
    rec_bruta: val.rec_bruta, ded_rec: val.ded_rec, rec_liq: val.rec_liq,
    cpmv: val.cpmv, lucro_bruto: val.lucro_bruto,
    desp_vendas: val.desp_vendas, desp_adm: val.desp_adm,
    desp_pessoal: val.desp_pessoal, desp_oper: val.desp_oper,
    ebitda: val.ebitda, depreciacao: val.depreciacao, ebit: val.ebit,
    rec_fin: val.rec_fin, desp_fin: val.desp_fin, res_fin: val.res_fin,
    lair: val.lair, ir_csll: val.ir_csll, luc_liq: val.luc_liq
  };
  const mapAnt = {
    rec_bruta: valAnt.rec_bruta, ded_rec: valAnt.ded_rec, rec_liq: valAnt.rec_liq,
    cpmv: valAnt.cpmv, lucro_bruto: valAnt.lucro_bruto,
    desp_vendas: valAnt.desp_vendas, desp_adm: valAnt.desp_adm,
    desp_pessoal: valAnt.desp_pessoal, desp_oper: valAnt.desp_oper,
    ebitda: valAnt.ebitda, depreciacao: valAnt.depreciacao, ebit: valAnt.ebit,
    rec_fin: valAnt.rec_fin, desp_fin: valAnt.desp_fin, res_fin: valAnt.res_fin,
    lair: valAnt.lair, ir_csll: valAnt.ir_csll, luc_liq: valAnt.luc_liq
  };

  return DRE_ESTRUTURA.map(linha => {
    const v = map[linha.id] || 0;
    const vAnt = mapAnt[linha.id] || 0;
    const varPct = vAnt !== 0 ? (((v - vAnt) / Math.abs(vAnt)) * 100).toFixed(1) : '—';
    const isResult = linha.tipo.includes('resultado');
    const indentPx = (linha.nivel - 1) * 16;
    const cor = isResult ? 'var(--fa-teal)' : v < 0 ? 'var(--red)' : 'var(--text-primary)';
    const varCor = varPct === '—' ? '' : (parseFloat(varPct) >= 0 ? 'color:var(--green)' : 'color:var(--red)');

    return `<tr style="${isResult ? 'font-weight:700;background:var(--bg-secondary)' : ''}">
      <td style="padding-left:${12+indentPx}px;font-size:${isResult?'13':'12'}px;color:${cor}">${linha.label}</td>
      <td style="text-align:right;font-weight:${isResult?'700':'400'};color:${v<0?'var(--red)':'inherit'}">${fmt(v)}</td>
      <td style="text-align:right;font-size:12px;color:var(--text-muted)">—</td>
      <td style="text-align:right;font-size:12px;color:var(--text-muted)">—</td>
      <td style="text-align:right;font-size:12px;color:var(--text-muted)">${fmt(vAnt)}</td>
      <td style="text-align:right;font-size:11px;${varCor}">${varPct !== '—' ? (parseFloat(varPct)>=0?'▲':'▼')+' '+Math.abs(varPct)+'%' : '—'}</td>
    </tr>`;
  }).join('');
}

function _dreAtualizarTabela() {
  const mes = parseInt(document.getElementById('dreMesSel')?.value || new Date().getMonth()+1);
  const ano = parseInt(document.getElementById('dreAnoSel')?.value || new Date().getFullYear());
  const mesAnt = mes === 1 ? 12 : mes - 1;
  const anoAnt = mes === 1 ? ano - 1 : ano;
  const lancamentos = _dreGetLancamentos();
  const valAtual = _dreCalcular(lancamentos, mes, ano);
  const valAnt   = _dreCalcular(lancamentos, mesAnt, anoAnt);
  const tbody = document.getElementById('dreTbody');
  if (tbody) tbody.innerHTML = _dreGerarLinhas(valAtual, valAnt);
}

function _dreInicializarChart(val) {
  if (_dreChartDRE) { _dreChartDRE.destroy(); _dreChartDRE = null; }
  const ctx = document.getElementById('dreChartBar');
  if (!ctx) return;
  _dreChartDRE = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Receita Líq.', 'Custo Prod.', 'Lucro Bruto', 'Desp. Oper.', 'EBITDA', 'Deprec.', 'EBIT', 'Res. Fin.', 'IR/CSLL', 'Lucro Líq.'],
      datasets: [{
        label: 'R$',
        data: [val.rec_liq, -val.cpmv, val.lucro_bruto, -val.desp_oper, val.ebitda, -val.depreciacao, val.ebit, val.res_fin, -val.ir_csll, val.luc_liq],
        backgroundColor: [val.rec_liq>=0?'#00b4b8':'#ef4444', '#f97316', val.lucro_bruto>=0?'#22c55e':'#ef4444',
          '#f97316', val.ebitda>=0?'#00b4b8':'#ef4444', '#94a3b8', val.ebit>=0?'#22c55e':'#ef4444',
          val.res_fin>=0?'#22c55e':'#ef4444', '#f97316', val.luc_liq>=0?'#22c55e':'#ef4444'],
        borderRadius: 4
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: {
        callbacks: { label: ctx => 'R$ ' + ctx.raw.toLocaleString('pt-BR', {minimumFractionDigits:0}) }
      }},
      scales: {
        y: { ticks: { callback: v => 'R$'+Math.abs(v/1000).toFixed(0)+'k', color:'var(--text-muted)', font:{size:10} }, grid:{color:'var(--border)'} },
        x: { ticks: { color:'var(--text-muted)', font:{size:10} }, grid:{display:false} }
      }
    }
  });
}

// ─── Aba DRE Acumulado ────────────────────────────
function _dreRenderAcumulado(el) {
  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  const lancamentos = _dreGetLancamentos();
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

  // Calcula para cada mês do ano
  const dados = meses.map((m, i) => ({
    mes: m, ...(_dreCalcular(lancamentos, i+1, anoAtual))
  }));

  const receitasArr = dados.map(d => d.rec_liq);
  const ebitdaArr   = dados.map(d => d.ebitda);
  const lucroArr    = dados.map(d => d.luc_liq);

  el.innerHTML = `
    <div class="card" style="margin-bottom:14px">
      <div class="card-header" style="display:flex;justify-content:space-between;align-items:center">
        <h4><i class="fas fa-layer-group" style="color:var(--fa-teal);margin-right:6px"></i>DRE Acumulado ${anoAtual}</h4>
        <select class="form-control" id="dreAnoAcum" style="width:80px;font-size:12px" onchange="renderDRE()">
          ${[2023,2024,2025,2026].map(a=>`<option value="${a}" ${a===anoAtual?'selected':''}>${a}</option>`).join('')}
        </select>
      </div>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Conta</th>
              ${meses.map(m=>`<th style="text-align:right;font-size:11px">${m}</th>`).join('')}
              <th style="text-align:right">Total YTD</th>
            </tr>
          </thead>
          <tbody>
            ${['rec_bruta','rec_liq','cpmv','lucro_bruto','desp_oper','ebitda','ebit','luc_liq'].map(id => {
              const linha = DRE_ESTRUTURA.find(l => l.id === id);
              const vals = dados.map(d => d[id] || 0);
              const total = vals.reduce((a,b) => a+b, 0);
              const isResult = linha?.tipo?.includes('resultado');
              return `<tr style="${isResult?'font-weight:700;background:var(--bg-secondary)':''}">
                <td style="font-size:12px">${linha?.label || id}</td>
                ${vals.map(v => `<td style="text-align:right;font-size:11px;color:${v<0?'var(--red)':'inherit'}">${v!==0?fmt(v):'—'}</td>`).join('')}
                <td style="text-align:right;font-weight:700;color:${total<0?'var(--red)':'var(--fa-teal)'}">${fmt(total)}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><h4><i class="fas fa-chart-area" style="color:var(--fa-teal);margin-right:6px"></i>Evolução Mensal</h4></div>
      <div class="card-body"><div style="height:260px"><canvas id="dreChartAcum"></canvas></div></div>
    </div>
  `;

  setTimeout(() => {
    if (_dreChartDRE) { _dreChartDRE.destroy(); _dreChartDRE = null; }
    const ctx = document.getElementById('dreChartAcum');
    if (!ctx) return;
    _dreChartDRE = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: meses,
        datasets: [
          { label: 'Receita Líquida', data: receitasArr, backgroundColor: 'rgba(0,180,184,0.7)', borderRadius: 3 },
          { label: 'EBITDA', data: ebitdaArr, backgroundColor: 'rgba(34,197,94,0.7)', borderRadius: 3 },
          { label: 'Lucro Líquido', data: lucroArr, backgroundColor: 'rgba(249,115,22,0.8)', borderRadius: 3 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color:'var(--text-primary)', font:{size:11} } } },
        scales: {
          y: { ticks: { callback: v => 'R$'+Math.abs(v/1000).toFixed(0)+'k', color:'var(--text-muted)', font:{size:10} }, grid:{color:'var(--border)'} },
          x: { ticks: { color:'var(--text-muted)', font:{size:10} }, grid:{display:false} }
        }
      }
    });
  }, 100);
}

// ─── Aba Fluxo de Caixa ───────────────────────────
function _dreRenderFluxo(el) {
  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

  // Lê contas a pagar e faturas
  const contas  = _dreGet('fa_contas_pagar', []);
  const faturas = (window.ERP_DATA?.faturas) || [];

  const fluxo = meses.map((m, i) => {
    const mes = i + 1;
    const mesStr = String(mes).padStart(2,'0');

    const entradas = faturas.filter(f => {
      const d = f.data_pagamento || f.data_emissao || '';
      return d.includes(`/${anoAtual}`) && (d.startsWith(mesStr) || d.includes(`/${String(mes).padStart(2,'0')}/`));
    }).reduce((a,b) => a + (parseFloat(b.liquido)||0), 0);

    const saidas = contas.filter(c => {
      const d = c.data_pagamento || c.vencimento || '';
      return d.includes(`/${anoAtual}`) && (d.includes(`/${mesStr}/`) || d.includes(`-${mesStr}-`));
    }).reduce((a,b) => a + (parseFloat(b.valor)||0), 0);

    return { mes: m, entradas, saidas, saldo: entradas - saidas };
  });

  let saldoAcum = 0;
  const saldoAcumArr = fluxo.map(f => { saldoAcum += f.saldo; return saldoAcum; });

  el.innerHTML = `
    <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
      <div class="kpi-card kpi-green">
        <div class="kpi-icon"><i class="fas fa-arrow-circle-up"></i></div>
        <div class="kpi-value">${fmt(fluxo.reduce((a,b)=>a+b.entradas,0))}</div>
        <div class="kpi-label">Total Entradas ${anoAtual}</div>
      </div>
      <div class="kpi-card kpi-red">
        <div class="kpi-icon"><i class="fas fa-arrow-circle-down"></i></div>
        <div class="kpi-value">${fmt(fluxo.reduce((a,b)=>a+b.saidas,0))}</div>
        <div class="kpi-label">Total Saídas ${anoAtual}</div>
      </div>
      <div class="kpi-card ${saldoAcum>=0?'kpi-teal':'kpi-orange'}">
        <div class="kpi-icon"><i class="fas fa-balance-scale"></i></div>
        <div class="kpi-value">${fmt(saldoAcum)}</div>
        <div class="kpi-label">Saldo Acumulado</div>
      </div>
      <div class="kpi-card kpi-blue">
        <div class="kpi-icon"><i class="fas fa-calendar-check"></i></div>
        <div class="kpi-value">${fluxo.filter(f=>f.saldo>0).length}</div>
        <div class="kpi-label">Meses Positivos</div>
      </div>
    </div>

    <div class="grid-2" style="gap:14px;margin-bottom:14px">
      <div class="card">
        <div class="card-header"><h4><i class="fas fa-chart-area" style="color:var(--fa-teal);margin-right:6px"></i>Fluxo Mensal</h4></div>
        <div class="card-body"><div style="height:240px"><canvas id="dreFluxoChart"></canvas></div></div>
      </div>
      <div class="card">
        <div class="card-header"><h4><i class="fas fa-chart-line" style="color:var(--green);margin-right:6px"></i>Saldo Acumulado</h4></div>
        <div class="card-body"><div style="height:240px"><canvas id="dreAcumChart"></canvas></div></div>
      </div>
    </div>

    <div class="card">
      <div class="card-header"><h4><i class="fas fa-table" style="color:var(--fa-teal);margin-right:6px"></i>Fluxo Detalhado por Mês</h4></div>
      <div class="table-wrapper">
        <table>
          <thead><tr>
            <th>Mês</th><th style="text-align:right">Entradas</th>
            <th style="text-align:right">Saídas</th>
            <th style="text-align:right">Saldo Mês</th>
            <th style="text-align:right">Saldo Acum.</th>
            <th>Status</th>
          </tr></thead>
          <tbody>
            ${(() => {
              let acum = 0;
              return fluxo.map(f => {
                acum += f.saldo;
                const ok = f.saldo >= 0;
                return `<tr>
                  <td style="font-weight:600">${f.mes}/${anoAtual}</td>
                  <td style="text-align:right;color:var(--green)">${fmt(f.entradas)}</td>
                  <td style="text-align:right;color:var(--red)">${fmt(f.saidas)}</td>
                  <td style="text-align:right;font-weight:700;color:${ok?'var(--green)':'var(--red)'}">${fmt(f.saldo)}</td>
                  <td style="text-align:right;color:${acum>=0?'var(--fa-teal)':'var(--red)'}">${fmt(acum)}</td>
                  <td><span class="badge ${ok?'badge-success':'badge-danger'}">${ok?'Positivo':'Negativo'}</span></td>
                </tr>`;
              }).join('');
            })()}
          </tbody>
        </table>
      </div>
    </div>
  `;

  setTimeout(() => {
    if (_dreChartFluxo) { _dreChartFluxo.destroy(); }
    const ctx1 = document.getElementById('dreFluxoChart');
    if (ctx1) {
      _dreChartFluxo = new Chart(ctx1, {
        type: 'bar',
        data: {
          labels: meses,
          datasets: [
            { label: 'Entradas', data: fluxo.map(f=>f.entradas), backgroundColor: 'rgba(34,197,94,0.7)', borderRadius:3 },
            { label: 'Saídas',   data: fluxo.map(f=>-f.saidas),  backgroundColor: 'rgba(239,68,68,0.7)', borderRadius:3 }
          ]
        },
        options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{labels:{color:'var(--text-primary)',font:{size:11}}} },
          scales:{ y:{ticks:{callback:v=>'R$'+Math.abs(v/1000).toFixed(0)+'k',color:'var(--text-muted)',font:{size:10}},grid:{color:'var(--border)'}},
            x:{ticks:{color:'var(--text-muted)',font:{size:10}},grid:{display:false}} } }
      });
    }
    if (_dreChartWaterfall) { _dreChartWaterfall.destroy(); }
    const ctx2 = document.getElementById('dreAcumChart');
    if (ctx2) {
      _dreChartWaterfall = new Chart(ctx2, {
        type: 'line',
        data: {
          labels: meses,
          datasets: [{
            label: 'Saldo Acumulado', data: saldoAcumArr,
            borderColor: 'var(--fa-teal)', backgroundColor: 'rgba(0,180,184,0.1)',
            fill: true, tension: 0.4, pointRadius: 4
          }]
        },
        options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{display:false} },
          scales:{ y:{ticks:{callback:v=>'R$'+Math.abs(v/1000).toFixed(0)+'k',color:'var(--text-muted)',font:{size:10}},grid:{color:'var(--border)'}},
            x:{ticks:{color:'var(--text-muted)',font:{size:10}},grid:{display:false}} } }
      });
    }
  }, 100);
}

// ─── Aba Projeção 12M ─────────────────────────────
function _dreRenderProjecao(el) {
  const projecoes = _dreGetProjecoes();
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const hoje = new Date();
  const anoBase = hoje.getFullYear();

  // Gera projeção automática baseada nos últimos 3 meses (tendência linear simples)
  const lancamentos = _dreGetLancamentos();
  const historicoRecLiq = meses.map((_,i) => _dreCalcular(lancamentos, i+1, anoBase).rec_liq);
  const historicoLucro  = meses.map((_,i) => _dreCalcular(lancamentos, i+1, anoBase).luc_liq);

  const mediaRec  = historicoRecLiq.slice(0,3).reduce((a,b)=>a+b,0)/3 || 500000;
  const mediaLucro= historicoLucro.slice(0,3).reduce((a,b)=>a+b,0)/3 || 75000;

  // Projeção com crescimento de 3% ao mês (ajustável)
  const crescimento = 1.03;
  const projetadoRec  = meses.map((_,i) => Math.round(mediaRec * Math.pow(crescimento, i)));
  const projetadoLucro= meses.map((_,i) => Math.round(mediaLucro * Math.pow(crescimento, i)));
  const projetadoEBITDA = projetadoRec.map(r => Math.round(r * 0.22));

  const totalRecProj  = projetadoRec.reduce((a,b)=>a+b,0);
  const totalLucProj  = projetadoLucro.reduce((a,b)=>a+b,0);

  el.innerHTML = `
    <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
      <div class="kpi-card kpi-teal">
        <div class="kpi-icon"><i class="fas fa-chart-line"></i></div>
        <div class="kpi-value">${fmt(totalRecProj)}</div>
        <div class="kpi-label">Receita Projetada 12M</div>
        <div class="kpi-delta delta-up">▲ 3% a.m. estimado</div>
      </div>
      <div class="kpi-card kpi-green">
        <div class="kpi-icon"><i class="fas fa-dollar-sign"></i></div>
        <div class="kpi-value">${fmt(totalLucProj)}</div>
        <div class="kpi-label">Lucro Projetado 12M</div>
      </div>
      <div class="kpi-card kpi-blue">
        <div class="kpi-icon"><i class="fas fa-percent"></i></div>
        <div class="kpi-value">${totalRecProj > 0 ? ((totalLucProj/totalRecProj)*100).toFixed(1) : 0}%</div>
        <div class="kpi-label">Margem Média Projetada</div>
      </div>
      <div class="kpi-card kpi-orange">
        <div class="kpi-icon"><i class="fas fa-magic"></i></div>
        <div class="kpi-value">${fmt(projetadoEBITDA.reduce((a,b)=>a+b,0))}</div>
        <div class="kpi-label">EBITDA Projetado 12M</div>
      </div>
    </div>

    <div class="card" style="margin-bottom:14px">
      <div class="card-header" style="display:flex;justify-content:space-between;align-items:center">
        <h4><i class="fas fa-magic" style="color:var(--fa-teal);margin-right:6px"></i>Projeção 12 Meses – ${anoBase}</h4>
        <div style="font-size:12px;color:var(--text-muted)">
          <i class="fas fa-info-circle"></i> Modelo: tendência + 3% a.m. sobre média histórica
        </div>
      </div>
      <div class="card-body"><div style="height:280px"><canvas id="dreProjecaoChart"></canvas></div></div>
    </div>

    <div class="card">
      <div class="card-header"><h4><i class="fas fa-table" style="color:var(--fa-teal);margin-right:6px"></i>Detalhamento Mensal Projetado</h4></div>
      <div class="table-wrapper">
        <table>
          <thead><tr><th>Mês</th><th style="text-align:right">Receita Proj.</th>
            <th style="text-align:right">EBITDA Proj.</th><th style="text-align:right">Lucro Proj.</th>
            <th style="text-align:right">Margem</th></tr></thead>
          <tbody>
            ${meses.map((m,i) => {
              const marg = projetadoRec[i]>0 ? ((projetadoLucro[i]/projetadoRec[i])*100).toFixed(1) : 0;
              return `<tr>
                <td style="font-weight:600">${m}/${anoBase}</td>
                <td style="text-align:right">${fmt(projetadoRec[i])}</td>
                <td style="text-align:right;color:var(--fa-teal)">${fmt(projetadoEBITDA[i])}</td>
                <td style="text-align:right;color:var(--green)">${fmt(projetadoLucro[i])}</td>
                <td style="text-align:right"><span class="badge ${parseFloat(marg)>=15?'badge-success':'badge-warning'}">${marg}%</span></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  setTimeout(() => {
    const ctx = document.getElementById('dreProjecaoChart');
    if (!ctx) return;
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: meses,
        datasets: [
          { label: 'Receita Projetada', data: projetadoRec, borderColor:'#00b4b8', backgroundColor:'rgba(0,180,184,0.1)', fill:true, tension:0.4, pointRadius:4 },
          { label: 'EBITDA Projetado',  data: projetadoEBITDA, borderColor:'#22c55e', backgroundColor:'rgba(34,197,94,0.1)', fill:true, tension:0.4, pointRadius:4 },
          { label: 'Lucro Projetado',   data: projetadoLucro, borderColor:'#f97316', backgroundColor:'rgba(249,115,22,0.1)', fill:true, tension:0.4, pointRadius:4 }
        ]
      },
      options: {
        responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{ labels:{ color:'var(--text-primary)', font:{size:11} } } },
        scales:{ y:{ticks:{callback:v=>'R$'+Math.abs(v/1000).toFixed(0)+'k',color:'var(--text-muted)',font:{size:10}},grid:{color:'var(--border)'}},
          x:{ticks:{color:'var(--text-muted)',font:{size:10}},grid:{display:false}} }
      }
    });
  }, 100);
}

// ─── Aba Lançamentos ──────────────────────────────
function _dreRenderLancamentos(el) {
  const lancamentos = _dreGetLancamentos();
  const busca = '';

  const contas = [
    { id:'rec_bruta', label:'Receita Bruta de Serviços' },
    { id:'rec_servicos', label:'Receita de Serviços' },
    { id:'rec_vendas', label:'Receita de Vendas' },
    { id:'impostos_receita', label:'Impostos s/ Receita (PIS/COFINS/ISS)' },
    { id:'cpmv', label:'Custo de Produtos/Serviços (CPMV)' },
    { id:'desp_vendas', label:'Despesas com Vendas' },
    { id:'desp_adm', label:'Despesas Administrativas' },
    { id:'desp_pessoal', label:'Despesas com Pessoal' },
    { id:'desp_outras', label:'Outras Despesas Operacionais' },
    { id:'depreciacao', label:'Depreciação e Amortização' },
    { id:'rec_fin', label:'Receitas Financeiras' },
    { id:'desp_fin', label:'Despesas Financeiras' },
    { id:'ir_csll', label:'IR e CSLL' },
  ];

  el.innerHTML = `
    <div class="card">
      <div class="card-header" style="display:flex;justify-content:space-between;align-items:center">
        <h4><i class="fas fa-list-alt" style="color:var(--fa-teal);margin-right:6px"></i>Lançamentos DRE (${lancamentos.length})</h4>
        ${hasPermission('financeiro','create') ? `
        <button class="btn btn-success btn-sm" onclick="_dreNovoLancamento()">
          <i class="fas fa-plus"></i> Novo Lançamento
        </button>` : ''}
      </div>
      <div class="table-wrapper">
        <table>
          <thead><tr>
            <th>Data</th><th>Competência</th><th>Conta</th>
            <th>Descrição</th><th style="text-align:right">Valor</th>
            <th>Empresa</th><th>Ações</th>
          </tr></thead>
          <tbody>
            ${lancamentos.length ? lancamentos.slice(0,100).map(l => `
              <tr>
                <td style="font-size:11px">${l.data||'—'}</td>
                <td style="font-size:11px">${l.competencia||'—'}</td>
                <td style="font-size:12px">${contas.find(c=>c.id===l.conta)?.label || l.conta || '—'}</td>
                <td style="font-size:12px">${l.descricao||'—'}</td>
                <td style="text-align:right;font-weight:700;color:${(parseFloat(l.valor)||0)<0?'var(--red)':'inherit'}">${fmt(parseFloat(l.valor)||0)}</td>
                <td style="font-size:11px">${l.empresa||'—'}</td>
                <td>
                  <button class="btn btn-xs btn-secondary" onclick="_dreEditarLancamento('${l.id}')"><i class="fas fa-edit"></i></button>
                  <button class="btn btn-xs" style="background:var(--red);color:#fff" onclick="_dreExcluirLancamento('${l.id}')"><i class="fas fa-trash"></i></button>
                </td>
              </tr>
            `).join('') : `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:30px">
              <i class="fas fa-inbox" style="font-size:24px;margin-bottom:8px;display:block"></i>
              Nenhum lançamento. Clique em "Novo Lançamento" para adicionar.
            </td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ─── Modal Novo Lançamento ────────────────────────
function _dreNovoLancamento(id) {
  const lancamentos = _dreGetLancamentos();
  const l = id ? lancamentos.find(x => x.id === id) : null;
  const hoje = new Date().toISOString().split('T')[0];
  const mesAno = `${String(new Date().getMonth()+1).padStart(2,'0')}/${new Date().getFullYear()}`;

  const contas = [
    { id:'rec_bruta', label:'Receita Bruta de Serviços' },
    { id:'rec_servicos', label:'Receita de Serviços' },
    { id:'rec_vendas', label:'Receita de Vendas' },
    { id:'impostos_receita', label:'Impostos s/ Receita (PIS/COFINS/ISS)' },
    { id:'cpmv', label:'Custo de Produtos/Serviços (CPMV)' },
    { id:'custo_servicos', label:'Custo de Serviços Prestados' },
    { id:'desp_vendas', label:'Despesas com Vendas' },
    { id:'desp_adm', label:'Despesas Administrativas' },
    { id:'desp_pessoal', label:'Despesas com Pessoal' },
    { id:'desp_outras', label:'Outras Despesas Operacionais' },
    { id:'depreciacao', label:'Depreciação e Amortização' },
    { id:'rec_fin', label:'Receitas Financeiras' },
    { id:'desp_fin', label:'Despesas Financeiras' },
    { id:'ir_csll', label:'IR e CSLL' },
  ];

  openModal(`<i class="fas fa-plus-circle" style="color:var(--fa-teal);margin-right:8px"></i>${l?'Editar':'Novo'} Lançamento DRE`,`
    <div class="grid-2" style="gap:12px">
      <div class="form-group">
        <label>Conta DRE *</label>
        <select class="form-control" id="dreLC_conta">
          ${contas.map(c=>`<option value="${c.id}" ${l?.conta===c.id?'selected':''}>${c.label}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Competência (MM/AAAA) *</label>
        <input class="form-control" id="dreLC_comp" placeholder="03/2025" value="${l?.competencia||mesAno}">
      </div>
      <div class="form-group">
        <label>Data do Lançamento</label>
        <input type="date" class="form-control" id="dreLC_data" value="${l?.data||hoje}">
      </div>
      <div class="form-group">
        <label>Valor (R$) *</label>
        <input type="number" step="0.01" class="form-control" id="dreLC_valor" placeholder="0.00" value="${l?.valor||''}">
      </div>
      <div class="form-group" style="grid-column:1/-1">
        <label>Descrição</label>
        <input class="form-control" id="dreLC_desc" placeholder="Ex.: Receita contrato CONT-001 Mar/2025" value="${l?.descricao||''}">
      </div>
      <div class="form-group">
        <label>Empresa</label>
        <input class="form-control" id="dreLC_empresa" placeholder="Nome ou CNPJ da empresa" value="${l?.empresa||''}">
      </div>
      <div class="form-group">
        <label>Centro de Custo</label>
        <input class="form-control" id="dreLC_cc" placeholder="Ex.: CONT-001, Administrativo..." value="${l?.centro_custo||''}">
      </div>
    </div>
  `,`
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-success" onclick="_dreSalvarLancamento('${l?.id||''}')">
      <i class="fas fa-save"></i> Salvar
    </button>
  `);
}

function _dreSalvarLancamento(idExist) {
  const conta  = document.getElementById('dreLC_conta')?.value;
  const comp   = document.getElementById('dreLC_comp')?.value?.trim();
  const data   = document.getElementById('dreLC_data')?.value;
  const valor  = parseFloat(document.getElementById('dreLC_valor')?.value || 0);
  const desc   = document.getElementById('dreLC_desc')?.value?.trim();
  const empresa= document.getElementById('dreLC_empresa')?.value?.trim();
  const cc     = document.getElementById('dreLC_cc')?.value?.trim();

  if (!conta || !comp || !valor) { showToast('Preencha Conta, Competência e Valor.','error'); return; }

  const lancamentos = _dreGetLancamentos();
  if (idExist) {
    const idx = lancamentos.findIndex(l => l.id === idExist);
    if (idx >= 0) Object.assign(lancamentos[idx], { conta, competencia:comp, data, valor, descricao:desc, empresa, centro_custo:cc });
  } else {
    lancamentos.unshift({ id: gerarId('DRE'), conta, competencia:comp, data, valor, descricao:desc, empresa, centro_custo:cc, criado_em: new Date().toISOString() });
  }
  _dreSaveLancamentos(lancamentos);
  closeModal();
  showToast('Lançamento salvo!','success');
  renderDRE();
}

function _dreEditarLancamento(id) { _dreNovoLancamento(id); }

function _dreExcluirLancamento(id) {
  if (!confirm('Excluir este lançamento?')) return;
  const lancamentos = _dreGetLancamentos().filter(l => l.id !== id);
  _dreSaveLancamentos(lancamentos);
  showToast('Lançamento excluído.','success');
  _dreRenderAba();
}

// ─── Exportar CSV ─────────────────────────────────
function _dreExportar() {
  const lancamentos = _dreGetLancamentos();
  const headers = ['ID','Conta','Competência','Data','Valor','Descrição','Empresa','Centro de Custo'];
  const rows = lancamentos.map(l => [l.id, l.conta, l.competencia, l.data, l.valor, l.descricao, l.empresa, l.centro_custo]);
  const csv  = [headers, ...rows].map(r => r.map(v => '"'+(v||'').toString().replace(/"/g,'""')+'"').join(';')).join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(csv);
  a.download = 'dre_lancamentos.csv';
  a.click();
  showToast('Exportação concluída!','success');
}

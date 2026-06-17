// =====================================================
// ERP – Módulo KPI Executivo / BI Estratégico v1.0
// Dashboard Multi-empresa, Scorecard, Alertas IA
// =====================================================

// ─── Helpers ─────────────────────────────────────
function _kpiGet(k, def) { try { return JSON.parse(localStorage.getItem(k)||JSON.stringify(def)); } catch(e) { return def; } }
function _kpiSave(k, v) { localStorage.setItem(k, JSON.stringify(v)); }

let _kpiCharts = {};
let _kpiAba    = 'scorecard';
let _kpiPeriodo = 'mes';

// ─── Coleta de dados cross-módulos ────────────────
function _kpiColetarDados() {
  const hoje    = new Date();
  const mesAtual = hoje.getMonth() + 1;
  const anoAtual = hoje.getFullYear();

  // Contratos
  const contratos  = _kpiGet('fa_contratos', []);
  const contAtivos = contratos.filter(c => c.status === 'Ativo' || c.status === 'Em Andamento');
  const receitaContratada = contAtivos.reduce((s,c) => s + (parseFloat(c.valor_total||c.valor||0)), 0);

  // Faturamento / Medições
  const medicoes = _kpiGet('fa_medicoes', []);
  const medMes   = medicoes.filter(m => {
    if (!m.data_medicao && !m.data) return false;
    const d = new Date(m.data_medicao || m.data);
    return d.getMonth()+1 === mesAtual && d.getFullYear() === anoAtual;
  });
  const faturadoMes = medMes.reduce((s,m) => s + parseFloat(m.valor_medido||m.valor||0), 0);

  // Contas a Pagar
  const cp       = _kpiGet('fraser_contas_pagar', []).concat(_kpiGet('fa_contas_pagar', []));
  const cpMes    = cp.filter(p => {
    if (!p.vencimento) return false;
    const d = new Date(p.vencimento);
    return d.getMonth()+1 === mesAtual && d.getFullYear() === anoAtual;
  });
  const cpTotal   = cpMes.reduce((s,p) => s + parseFloat(p.valor||0), 0);
  const cpPendente= cpMes.filter(p => p.status !== 'Pago').reduce((s,p) => s + parseFloat(p.valor||0), 0);
  const cpVencido = cp.filter(p => {
    if (!p.vencimento || p.status === 'Pago') return false;
    return new Date(p.vencimento) < hoje;
  }).reduce((s,p) => s + parseFloat(p.valor||0), 0);

  // Pedidos de Compra
  const pedidos   = _kpiGet('fa_pedidos_v2', []);
  const pedMes    = pedidos.filter(p => {
    const d = new Date(p.data_pedido || p.criado_em || '');
    return d.getMonth()+1 === mesAtual && d.getFullYear() === anoAtual;
  });
  const vlrPedMes = pedMes.reduce((s,p) => s + parseFloat(p.valor_total||p.valor||0), 0);
  const pedPendente = pedidos.filter(p => ['Pendente','Aprovação','Em Aberto'].includes(p.status)).length;

  // OS
  const ordens     = _kpiGet('fa_ordens_servico', []);
  const osAbertas  = ordens.filter(o => !['Concluída','Cancelada'].includes(o.status)).length;
  const osMes      = ordens.filter(o => {
    const d = new Date(o.data_abertura||o.criado_em||'');
    return d.getMonth()+1 === mesAtual && d.getFullYear() === anoAtual;
  }).length;

  // Equipe / Mobilização
  const equipe     = _kpiGet('fa_colaboradores', []);
  const ativos     = equipe.filter(e => e.status === 'Ativo' || !e.status).length;

  // Fornecedores
  const forn       = _kpiGet('fa_fornecedores_v2', []).concat(_kpiGet('fa_fornecedores', []));
  const fornAtivos = [...new Map(forn.map(f=>[f.id||f.cnpj,f])).values()].filter(f => f.status !== 'Inativo').length;

  // Almoxarifado
  const estoque    = _kpiGet('fa_estoque', {});
  const mats       = _kpiGet('fa_materiais_v2', []).concat(_kpiGet('fa_materiais', []));
  const matsUni    = [...new Map(mats.map(m=>[m.id,m])).values()];
  const itemsCriticos = matsUni.filter(m => {
    const qt = estoque[m.id] || m.estoque_atual || 0;
    return qt <= (m.estoque_minimo || 0) && (m.estoque_minimo || 0) > 0;
  }).length;

  // SSMA Incidentes
  const incidentes = _kpiGet('fa_incidentes', []);
  const incMes     = incidentes.filter(i => {
    const d = new Date(i.data||i.criado_em||'');
    return d.getMonth()+1 === mesAtual && d.getFullYear() === anoAtual;
  }).length;

  // Projetos Gantt
  const projetos   = _kpiGet('fa_projetos', []);
  const projAtivos = projetos.filter(p => p.status !== 'Concluído' && p.status !== 'Cancelado').length;

  // Ativo Fixo
  const ativos_fixos = _kpiGet('fa_ativos_fixos', []);
  const vlrPatrimonio = ativos_fixos.reduce((s,a) => s + parseFloat(a.valor_aquisicao||0), 0);

  // DRE Lançamentos
  const lancDRE    = _kpiGet('fa_dre_lancamentos', []);
  const recBrutaMes = lancDRE.filter(l => l.tipo === 'receita' && l.competencia) .reduce((s,l) => {
    const [lm,ly] = (l.competencia||'').split('/');
    if (parseInt(lm)===mesAtual && parseInt(ly)===anoAtual) return s + parseFloat(l.valor||0);
    return s;
  }, 0);
  const despTotalMes = lancDRE.filter(l => l.tipo !== 'receita' && l.competencia).reduce((s,l) => {
    const [lm,ly] = (l.competencia||'').split('/');
    if (parseInt(lm)===mesAtual && parseInt(ly)===anoAtual) return s + parseFloat(l.valor||0);
    return s;
  }, 0);
  const margemBruta = recBrutaMes > 0 ? ((recBrutaMes - despTotalMes) / recBrutaMes * 100) : 0;

  return {
    receitaContratada, faturadoMes, cpTotal, cpPendente, cpVencido,
    vlrPedMes, pedPendente, osAbertas, osMes,
    equipeAtivos: ativos, fornAtivos, itemsCriticos, incMes,
    projAtivos, vlrPatrimonio, recBrutaMes, despTotalMes, margemBruta
  };
}

// ─── Gera alertas automáticos ─────────────────────
function _kpiGerarAlertas(dados) {
  const alertas = [];
  if (dados.cpVencido > 0)
    alertas.push({ tipo:'danger', icone:'exclamation-triangle', msg:`Contas a pagar vencidas: ${_fmt(dados.cpVencido)}`, link:'contas_pagar' });
  if (dados.itemsCriticos > 0)
    alertas.push({ tipo:'warning', icone:'boxes', msg:`${dados.itemsCriticos} materiais abaixo do estoque mínimo`, link:'estoque' });
  if (dados.pedPendente > 5)
    alertas.push({ tipo:'warning', icone:'shopping-cart', msg:`${dados.pedPendente} pedidos aguardando aprovação`, link:'pedidos' });
  if (dados.incMes > 0)
    alertas.push({ tipo:'danger', icone:'hard-hat', msg:`${dados.incMes} incidente(s) SSMA no mês`, link:'ssma' });
  if (dados.osAbertas > 10)
    alertas.push({ tipo:'info', icone:'clipboard-list', msg:`${dados.osAbertas} ordens de serviço em aberto`, link:'os' });
  if (dados.margemBruta < 15 && dados.recBrutaMes > 0)
    alertas.push({ tipo:'danger', icone:'chart-line', msg:`Margem bruta abaixo do limite: ${dados.margemBruta.toFixed(1)}%`, link:'dre' });
  if (alertas.length === 0)
    alertas.push({ tipo:'success', icone:'check-circle', msg:'Todos os indicadores dentro dos parâmetros normais', link:null });
  return alertas;
}

function _fmt(v) { return 'R$ ' + (parseFloat(v)||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function _pct(v) { return (parseFloat(v)||0).toFixed(1) + '%'; }

// ─── Render principal ─────────────────────────────
function renderKPIExecutivo() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `
  <div class="page-header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
    <div>
      <h2 style="margin:0;font-size:1.35rem;font-weight:700;display:flex;align-items:center;gap:8px">
        <i class="fas fa-chart-pie" style="color:#7c3aed"></i> KPI Executivo &amp; Business Intelligence
      </h2>
      <p style="margin:4px 0 0;font-size:.82rem;color:var(--text-muted)">Painel estratégico consolidado · atualizado em tempo real</p>
    </div>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <select class="form-control" style="width:auto;font-size:.8rem" id="kpiPeriodoSel" onchange="_kpiChangePeriodo(this.value)">
        <option value="mes" ${_kpiPeriodo==='mes'?'selected':''}>Mês Atual</option>
        <option value="tri" ${_kpiPeriodo==='tri'?'selected':''}>Trimestre</option>
        <option value="ano" ${_kpiPeriodo==='ano'?'selected':''}>Ano</option>
      </select>
      <button class="btn btn-outline-secondary btn-sm" onclick="renderKPIExecutivo()">
        <i class="fas fa-sync-alt"></i> Atualizar
      </button>
      <button class="btn btn-primary btn-sm" onclick="_kpiExportarPDF()">
        <i class="fas fa-file-pdf"></i> Exportar
      </button>
    </div>
  </div>

  <!-- Abas -->
  <div style="display:flex;gap:4px;margin:16px 0 20px;border-bottom:2px solid var(--border-color)">
    ${[
      {id:'scorecard', label:'Scorecard', icone:'tachometer-alt'},
      {id:'financeiro', label:'Financeiro', icone:'chart-line'},
      {id:'operacional', label:'Operacional', icone:'cogs'},
      {id:'alertas', label:'Alertas IA', icone:'robot'},
      {id:'metas', label:'Metas & OKRs', icone:'bullseye'},
    ].map(a=>`
      <button onclick="_kpiNavAba('${a.id}')" id="kpiTab_${a.id}"
        style="padding:8px 16px;border:none;background:none;cursor:pointer;font-size:.83rem;font-weight:600;
               color:${_kpiAba===a.id?'#7c3aed':'var(--text-muted)'};
               border-bottom:${_kpiAba===a.id?'3px solid #7c3aed':'3px solid transparent'};
               margin-bottom:-2px;transition:all .2s">
        <i class="fas fa-${a.icone}"></i> ${a.label}
      </button>
    `).join('')}
  </div>

  <div id="kpiAbaContent"></div>`;

  _kpiRenderAba();
}

function _kpiChangePeriodo(v) { _kpiPeriodo = v; _kpiRenderAba(); }
function _kpiNavAba(aba) { _kpiAba = aba; renderKPIExecutivo(); }

function _kpiRenderAba() {
  const el = document.getElementById('kpiAbaContent');
  if (!el) return;
  if (_kpiAba === 'scorecard')  _kpiRenderScorecard(el);
  else if (_kpiAba === 'financeiro') _kpiRenderFinanceiro(el);
  else if (_kpiAba === 'operacional') _kpiRenderOperacional(el);
  else if (_kpiAba === 'alertas') _kpiRenderAlertas(el);
  else if (_kpiAba === 'metas') _kpiRenderMetas(el);
}

// ─── ABA: Scorecard ───────────────────────────────
function _kpiRenderScorecard(el) {
  const d = _kpiColetarDados();
  const alertas = _kpiGerarAlertas(d);
  const corAlerta = alertas.some(a=>a.tipo==='danger') ? '#ef4444' : alertas.some(a=>a.tipo==='warning') ? '#f59e0b' : '#10b981';
  const totalAlerta = alertas.filter(a=>a.tipo!=='success').length;

  const cards = [
    { label:'Receita Contratada',  valor: _fmt(d.receitaContratada), icone:'file-contract',      cor:'#7c3aed', sub:`${_fmt(d.faturadoMes)} faturado/mês` },
    { label:'Margem Bruta',        valor: _pct(d.margemBruta),       icone:'percentage',          cor: d.margemBruta >= 20 ? '#10b981' : d.margemBruta >= 10 ? '#f59e0b' : '#ef4444', sub:`Rec: ${_fmt(d.recBrutaMes)} | Desp: ${_fmt(d.despTotalMes)}` },
    { label:'Contas a Pagar (Mês)',valor: _fmt(d.cpTotal),           icone:'hand-holding-usd',    cor:'#0891b2', sub:`${_fmt(d.cpVencido)} vencido` },
    { label:'Pedidos de Compra',   valor: _fmt(d.vlrPedMes),         icone:'shopping-cart',       cor:'#f59e0b', sub:`${d.pedPendente} aguardando aprovação` },
    { label:'Ordens de Serviço',   valor: d.osAbertas + ' abertas',  icone:'clipboard-list',      cor:'#ec4899', sub:`${d.osMes} abertas no mês` },
    { label:'Equipe Ativa',        valor: d.equipeAtivos + ' colabs',icone:'users',               cor:'#10b981', sub:`${d.fornAtivos} fornecedores ativos` },
    { label:'Patrimônio (AF)',     valor: _fmt(d.vlrPatrimonio),     icone:'building',            cor:'#6366f1', sub:`${_kpiGet('fa_ativos_fixos',[]).length} bens cadastrados` },
    { label:'Alertas Ativos',      valor: totalAlerta + ' alertas',  icone:'exclamation-triangle', cor: corAlerta, sub:'Clique para ver detalhes', link:'alertas' },
  ];

  el.innerHTML = `
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px;margin-bottom:24px">
    ${cards.map(c=>`
      <div class="card" onclick="${c.link?`_kpiNavAba('${c.link}')`:'void(0)'}" style="cursor:${c.link?'pointer':'default'};
           border-left:4px solid ${c.cor};padding:16px;transition:transform .15s" 
           onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <span style="font-size:.75rem;color:var(--text-muted);font-weight:600;text-transform:uppercase">${c.label}</span>
          <i class="fas fa-${c.icone}" style="color:${c.cor};font-size:1.1rem"></i>
        </div>
        <div style="font-size:1.35rem;font-weight:700;color:var(--text-color)">${c.valor}</div>
        <div style="font-size:.72rem;color:var(--text-muted);margin-top:4px">${c.sub}</div>
      </div>
    `).join('')}
  </div>

  <!-- Alertas inline -->
  ${alertas.length ? `
  <div class="card" style="margin-bottom:20px;padding:16px">
    <h6 style="margin:0 0 12px;font-weight:700;display:flex;align-items:center;gap:6px">
      <i class="fas fa-robot" style="color:#7c3aed"></i> Alertas Inteligentes
    </h6>
    ${alertas.map(a=>`
      <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:6px;margin-bottom:6px;
           background:${a.tipo==='danger'?'rgba(239,68,68,.08)':a.tipo==='warning'?'rgba(245,158,11,.08)':a.tipo==='success'?'rgba(16,185,129,.08)':'rgba(59,130,246,.08)'}">
        <i class="fas fa-${a.icone}" style="color:${a.tipo==='danger'?'#ef4444':a.tipo==='warning'?'#f59e0b':a.tipo==='success'?'#10b981':'#3b82f6'}"></i>
        <span style="font-size:.82rem;flex:1">${a.msg}</span>
        ${a.link ? `<button class="btn btn-outline-secondary btn-sm" style="font-size:.7rem" onclick="navigate('${a.link}')">Ver</button>` : ''}
      </div>
    `).join('')}
  </div>` : ''}

  <!-- Gráfico Radar de Saúde Empresarial -->
  <div class="card" style="padding:20px">
    <h6 style="margin:0 0 16px;font-weight:700"><i class="fas fa-spider" style="color:#7c3aed"></i> Saúde Empresarial – Radar</h6>
    <canvas id="kpiRadarChart" height="280"></canvas>
  </div>`;

  // Radar Chart
  setTimeout(() => {
    const ctx = document.getElementById('kpiRadarChart');
    if (!ctx || typeof Chart === 'undefined') return;
    if (_kpiCharts.radar) _kpiCharts.radar.destroy();
    const scoreFinanc  = Math.min(100, d.margemBruta * 3);
    const scoreOper    = Math.max(0, 100 - d.osAbertas * 3);
    const scoreCompras = Math.max(0, 100 - d.pedPendente * 5);
    const scoreSegur   = Math.max(0, 100 - d.incMes * 20);
    const scoreEstoque = Math.max(0, 100 - d.itemsCriticos * 10);
    const scorePessoas = Math.min(100, d.equipeAtivos * 5);
    _kpiCharts.radar = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: ['Financeiro','Operacional','Compras','Segurança','Estoque','Pessoas'],
        datasets: [{
          label: 'Score de Saúde (%)',
          data: [scoreFinanc, scoreOper, scoreCompras, scoreSegur, scoreEstoque, scorePessoas],
          borderColor: '#7c3aed',
          backgroundColor: 'rgba(124,58,237,0.15)',
          pointBackgroundColor: '#7c3aed',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        scales: { r: { min:0, max:100, ticks:{ stepSize:20 } } },
        plugins: { legend:{ position:'bottom' } }
      }
    });
  }, 200);
}

// ─── ABA: Financeiro ──────────────────────────────
function _kpiRenderFinanceiro(el) {
  const d = _kpiColetarDados();
  const cp = _kpiGet('fraser_contas_pagar',[]).concat(_kpiGet('fa_contas_pagar',[]));
  const lancDRE = _kpiGet('fa_dre_lancamentos',[]);
  const hoje = new Date();

  // Últimos 6 meses de dados
  const meses6 = Array.from({length:6}, (_,i) => {
    const dt = new Date(hoje.getFullYear(), hoje.getMonth()-5+i, 1);
    return { mes: dt.getMonth()+1, ano: dt.getFullYear(), label: dt.toLocaleString('pt-BR',{month:'short', year:'2-digit'}) };
  });

  const recSeries = meses6.map(m => lancDRE.filter(l => {
    const [lm,ly] = (l.competencia||'').split('/');
    return parseInt(lm)===m.mes && parseInt(ly)===m.ano && l.tipo==='receita';
  }).reduce((s,l)=>s+parseFloat(l.valor||0),0));

  const despSeries = meses6.map(m => lancDRE.filter(l => {
    const [lm,ly] = (l.competencia||'').split('/');
    return parseInt(lm)===m.mes && parseInt(ly)===m.ano && l.tipo!=='receita';
  }).reduce((s,l)=>s+parseFloat(l.valor||0),0));

  const cpSeries = meses6.map(m => cp.filter(p => {
    if (!p.vencimento) return false;
    const dt = new Date(p.vencimento);
    return dt.getMonth()+1===m.mes && dt.getFullYear()===m.ano;
  }).reduce((s,p)=>s+parseFloat(p.valor||0),0));

  el.innerHTML = `
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
    <div class="card" style="padding:16px">
      <h6 style="margin:0 0 4px;font-weight:700"><i class="fas fa-chart-bar" style="color:#7c3aed"></i> Receita vs Despesa (6 meses)</h6>
      <canvas id="kpiFinChart1" height="220"></canvas>
    </div>
    <div class="card" style="padding:16px">
      <h6 style="margin:0 0 4px;font-weight:700"><i class="fas fa-hand-holding-usd" style="color:#0891b2"></i> Contas a Pagar (6 meses)</h6>
      <canvas id="kpiFinChart2" height="220"></canvas>
    </div>
  </div>
  <div class="card" style="padding:16px">
    <h6 style="margin:0 0 4px;font-weight:700"><i class="fas fa-balance-scale" style="color:#10b981"></i> Margem Operacional por Mês (%)</h6>
    <canvas id="kpiFinChart3" height="140"></canvas>
  </div>`;

  setTimeout(() => {
    if (typeof Chart === 'undefined') return;
    const labels = meses6.map(m=>m.label);

    if (_kpiCharts.fin1) _kpiCharts.fin1.destroy();
    _kpiCharts.fin1 = new Chart(document.getElementById('kpiFinChart1'), {
      type:'bar',
      data:{ labels, datasets:[
        { label:'Receita', data:recSeries, backgroundColor:'rgba(16,185,129,.7)', borderRadius:4 },
        { label:'Despesa', data:despSeries, backgroundColor:'rgba(239,68,68,.6)', borderRadius:4 }
      ]},
      options:{ responsive:true, plugins:{ legend:{ position:'bottom' } }, scales:{ y:{ ticks:{ callback: v => 'R$'+v.toLocaleString('pt-BR') } } } }
    });

    if (_kpiCharts.fin2) _kpiCharts.fin2.destroy();
    _kpiCharts.fin2 = new Chart(document.getElementById('kpiFinChart2'), {
      type:'line',
      data:{ labels, datasets:[
        { label:'A Pagar', data:cpSeries, borderColor:'#0891b2', backgroundColor:'rgba(8,145,178,.1)', tension:.4, fill:true }
      ]},
      options:{ responsive:true, plugins:{ legend:{ position:'bottom' } }, scales:{ y:{ ticks:{ callback: v => 'R$'+v.toLocaleString('pt-BR') } } } }
    });

    const margemSeries = recSeries.map((r,i) => r > 0 ? ((r - despSeries[i]) / r * 100).toFixed(1) : 0);
    if (_kpiCharts.fin3) _kpiCharts.fin3.destroy();
    _kpiCharts.fin3 = new Chart(document.getElementById('kpiFinChart3'), {
      type:'bar',
      data:{ labels, datasets:[
        { label:'Margem %', data:margemSeries,
          backgroundColor: margemSeries.map(v => parseFloat(v) >= 20 ? 'rgba(16,185,129,.7)' : parseFloat(v) >= 10 ? 'rgba(245,158,11,.7)' : 'rgba(239,68,68,.7)'),
          borderRadius:4 }
      ]},
      options:{ responsive:true, plugins:{ legend:{ position:'bottom' } }, scales:{ y:{ max:100, ticks:{ callback: v => v+'%' } } } }
    });
  }, 200);
}

// ─── ABA: Operacional ─────────────────────────────
function _kpiRenderOperacional(el) {
  const d = _kpiColetarDados();
  const ordens = _kpiGet('fa_ordens_servico',[]);
  const projetos = _kpiGet('fa_projetos',[]);

  const osStatus = {};
  ordens.forEach(o => { osStatus[o.status||'Sem Status'] = (osStatus[o.status||'Sem Status']||0)+1; });
  const projStatus = {};
  projetos.forEach(p => { projStatus[p.status||'Sem Status'] = (projStatus[p.status||'Sem Status']||0)+1; });

  el.innerHTML = `
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;margin-bottom:20px">
    ${[
      { label:'OS Abertas',       valor:d.osAbertas,       cor:'#ec4899', icone:'clipboard-list' },
      { label:'Projetos Ativos',  valor:d.projAtivos,      cor:'#7c3aed', icone:'project-diagram' },
      { label:'Incidentes/Mês',   valor:d.incMes,          cor: d.incMes>0?'#ef4444':'#10b981', icone:'hard-hat' },
      { label:'Itens Críticos',   valor:d.itemsCriticos,   cor: d.itemsCriticos>0?'#f59e0b':'#10b981', icone:'boxes' },
      { label:'Equipe Ativa',     valor:d.equipeAtivos,    cor:'#10b981', icone:'users' },
      { label:'Fornecedores',     valor:d.fornAtivos,      cor:'#0891b2', icone:'building' },
    ].map(c=>`
      <div class="card" style="padding:14px;border-left:3px solid ${c.cor}">
        <div style="font-size:.72rem;color:var(--text-muted);font-weight:600;text-transform:uppercase;margin-bottom:6px">
          <i class="fas fa-${c.icone}"></i> ${c.label}
        </div>
        <div style="font-size:1.6rem;font-weight:700;color:${c.cor}">${c.valor}</div>
      </div>
    `).join('')}
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
    <div class="card" style="padding:16px">
      <h6 style="margin:0 0 12px;font-weight:700"><i class="fas fa-clipboard-list" style="color:#ec4899"></i> OS por Status</h6>
      <canvas id="kpiOsChart" height="220"></canvas>
    </div>
    <div class="card" style="padding:16px">
      <h6 style="margin:0 0 12px;font-weight:700"><i class="fas fa-project-diagram" style="color:#7c3aed"></i> Projetos por Status</h6>
      <canvas id="kpiProjChart" height="220"></canvas>
    </div>
  </div>`;

  setTimeout(() => {
    if (typeof Chart === 'undefined') return;
    const cores = ['#7c3aed','#10b981','#f59e0b','#ef4444','#0891b2','#ec4899'];

    if (_kpiCharts.os) _kpiCharts.os.destroy();
    _kpiCharts.os = new Chart(document.getElementById('kpiOsChart'), {
      type:'doughnut',
      data:{ labels:Object.keys(osStatus), datasets:[{ data:Object.values(osStatus), backgroundColor:cores }]},
      options:{ responsive:true, plugins:{ legend:{ position:'bottom' } } }
    });

    if (_kpiCharts.proj) _kpiCharts.proj.destroy();
    _kpiCharts.proj = new Chart(document.getElementById('kpiProjChart'), {
      type:'doughnut',
      data:{ labels:Object.keys(projStatus), datasets:[{ data:Object.values(projStatus), backgroundColor:cores }]},
      options:{ responsive:true, plugins:{ legend:{ position:'bottom' } } }
    });
  }, 200);
}

// ─── ABA: Alertas IA ──────────────────────────────
function _kpiRenderAlertas(el) {
  const d = _kpiColetarDados();
  const alertas = _kpiGerarAlertas(d);

  // Alertas detalhados por módulo
  const cp = _kpiGet('fraser_contas_pagar',[]).concat(_kpiGet('fa_contas_pagar',[]));
  const hoje = new Date();
  const vencidos = cp.filter(p => p.status !== 'Pago' && p.vencimento && new Date(p.vencimento) < hoje);
  const mats = _kpiGet('fa_materiais_v2',[]).concat(_kpiGet('fa_materiais',[]));
  const estoque = _kpiGet('fa_estoque',{});
  const criticos = mats.filter(m => {
    const qt = estoque[m.id] || m.estoque_atual || 0;
    return qt <= (m.estoque_minimo||0) && (m.estoque_minimo||0)>0;
  });

  el.innerHTML = `
  <div style="margin-bottom:20px">
    <h6 style="font-weight:700;margin-bottom:12px"><i class="fas fa-robot" style="color:#7c3aed"></i> Centro de Alertas Inteligentes</h6>
    ${alertas.map(a=>`
      <div style="display:flex;align-items:flex-start;gap:12px;padding:12px 16px;border-radius:8px;margin-bottom:8px;border:1px solid;
           border-color:${a.tipo==='danger'?'rgba(239,68,68,.3)':a.tipo==='warning'?'rgba(245,158,11,.3)':a.tipo==='success'?'rgba(16,185,129,.3)':'rgba(59,130,246,.3)'};
           background:${a.tipo==='danger'?'rgba(239,68,68,.05)':a.tipo==='warning'?'rgba(245,158,11,.05)':a.tipo==='success'?'rgba(16,185,129,.05)':'rgba(59,130,246,.05)'}">
        <i class="fas fa-${a.icone} fa-lg" style="color:${a.tipo==='danger'?'#ef4444':a.tipo==='warning'?'#f59e0b':a.tipo==='success'?'#10b981':'#3b82f6'};margin-top:2px"></i>
        <div style="flex:1">
          <div style="font-size:.88rem;font-weight:600">${a.msg}</div>
          ${a.link ? `<button class="btn btn-sm btn-outline-secondary" style="margin-top:6px;font-size:.75rem" onclick="navigate('${a.link}')"><i class="fas fa-arrow-right"></i> Ir para o módulo</button>` : ''}
        </div>
      </div>
    `).join('')}
  </div>

  ${vencidos.length ? `
  <div class="card" style="padding:16px;margin-bottom:16px">
    <h6 style="font-weight:700;margin-bottom:10px;color:#ef4444"><i class="fas fa-exclamation-circle"></i> Títulos Vencidos (${vencidos.length})</h6>
    <div style="overflow-x:auto">
      <table class="table table-sm">
        <thead><tr><th>Descrição</th><th>Fornecedor</th><th>Vencimento</th><th class="text-right">Valor</th></tr></thead>
        <tbody>
          ${vencidos.slice(0,10).map(p=>`
            <tr>
              <td>${p.descricao||p.desc||'-'}</td>
              <td>${p.fornecedor||'-'}</td>
              <td style="color:#ef4444">${p.vencimento||'-'}</td>
              <td class="text-right">${_fmt(p.valor)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ${vencidos.length>10?`<div style="font-size:.75rem;color:var(--text-muted);text-align:center;margin-top:4px">+${vencidos.length-10} títulos adicionais</div>`:''}
  </div>` : ''}

  ${criticos.length ? `
  <div class="card" style="padding:16px">
    <h6 style="font-weight:700;margin-bottom:10px;color:#f59e0b"><i class="fas fa-boxes"></i> Materiais Abaixo do Mínimo (${criticos.length})</h6>
    <div style="overflow-x:auto">
      <table class="table table-sm">
        <thead><tr><th>Material</th><th>Estoque Atual</th><th>Estoque Mínimo</th><th>Deficit</th></tr></thead>
        <tbody>
          ${criticos.slice(0,10).map(m=>{
            const qt = estoque[m.id]||m.estoque_atual||0;
            const deficit = (m.estoque_minimo||0) - qt;
            return `<tr>
              <td>${m.nome||m.descricao||m.codigo||'-'}</td>
              <td style="color:#ef4444">${qt} ${m.unidade||'UN'}</td>
              <td>${m.estoque_minimo||0} ${m.unidade||'UN'}</td>
              <td style="color:#f59e0b">${deficit} ${m.unidade||'UN'}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  </div>` : ''}`;
}

// ─── ABA: Metas & OKRs ───────────────────────────
function _kpiRenderMetas(el) {
  const metas = _kpiGet('fa_kpi_metas', _kpiMetasDefault());

  el.innerHTML = `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
    <h6 style="font-weight:700;margin:0"><i class="fas fa-bullseye" style="color:#7c3aed"></i> Metas & OKRs Estratégicos</h6>
    <button class="btn btn-primary btn-sm" onclick="_kpiModalMeta()">
      <i class="fas fa-plus"></i> Nova Meta
    </button>
  </div>

  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px">
    ${metas.map((m,i) => {
      const pct = Math.min(100, m.meta > 0 ? (m.atual / m.meta * 100) : 0);
      const cor = pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
      return `
      <div class="card" style="padding:16px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
          <div>
            <div style="font-weight:700;font-size:.88rem">${m.nome}</div>
            <div style="font-size:.72rem;color:var(--text-muted)">${m.modulo} · ${m.periodo}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:1.1rem;font-weight:700;color:${cor}">${pct.toFixed(0)}%</div>
            <button class="btn btn-sm" style="padding:1px 6px;font-size:.7rem" onclick="_kpiEditarMeta(${i})">
              <i class="fas fa-edit"></i>
            </button>
          </div>
        </div>
        <div style="background:var(--border-color);border-radius:4px;height:8px;overflow:hidden;margin-bottom:8px">
          <div style="height:100%;width:${pct}%;background:${cor};transition:width .5s;border-radius:4px"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:.75rem;color:var(--text-muted)">
          <span>Atual: <strong>${m.atual}${m.unidade}</strong></span>
          <span>Meta: <strong>${m.meta}${m.unidade}</strong></span>
        </div>
        ${m.descricao ? `<div style="font-size:.72rem;color:var(--text-muted);margin-top:6px;font-style:italic">${m.descricao}</div>` : ''}
      </div>`;
    }).join('')}
  </div>`;
}

function _kpiMetasDefault() {
  return [
    { nome:'Margem Bruta', modulo:'Financeiro', periodo:'Anual', meta:25, atual:0, unidade:'%', descricao:'Meta de margem bruta mínima anual' },
    { nome:'Faturamento Mensal', modulo:'DRE', periodo:'Mensal', meta:500000, atual:0, unidade:' R$', descricao:'Meta de receita bruta mensal' },
    { nome:'Ordens de Serviço Concluídas', modulo:'OS', periodo:'Mensal', meta:20, atual:0, unidade:'', descricao:'OS finalizadas no prazo' },
    { nome:'Índice Zero Acidente', modulo:'SSMA', periodo:'Anual', meta:0, atual:0, unidade:' incidentes', descricao:'Meta de zero acidentes no ano' },
    { nome:'Prazo Médio de Compras', modulo:'Compras', periodo:'Mensal', meta:7, atual:12, unidade:' dias', descricao:'Prazo médio da RQ ao pedido' },
    { nome:'Fornecedores Qualificados', modulo:'IDF', periodo:'Anual', meta:30, atual:0, unidade:'', descricao:'Fornecedores com IDF ≥ 70%' },
  ];
}

function _kpiModalMeta(idx) {
  const metas = _kpiGet('fa_kpi_metas', _kpiMetasDefault());
  const m = idx !== undefined ? metas[idx] : {};
  const titulo = idx !== undefined ? 'Editar Meta' : 'Nova Meta';
  showModal(titulo, `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="form-group" style="grid-column:1/-1">
        <label>Nome da Meta *</label>
        <input class="form-control" id="kpiMetaNome" value="${m.nome||''}" placeholder="Ex: Margem Bruta">
      </div>
      <div class="form-group">
        <label>Módulo</label>
        <select class="form-control" id="kpiMetaModulo">
          ${['Financeiro','DRE','OS','Compras','SSMA','Projetos','Equipe','IDF','Geral'].map(s=>`<option ${m.modulo===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Período</label>
        <select class="form-control" id="kpiMetaPeriodo">
          ${['Mensal','Trimestral','Semestral','Anual'].map(s=>`<option ${m.periodo===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Valor da Meta</label>
        <input class="form-control" type="number" id="kpiMetaMeta" value="${m.meta||0}">
      </div>
      <div class="form-group">
        <label>Valor Atual</label>
        <input class="form-control" type="number" id="kpiMetaAtual" value="${m.atual||0}">
      </div>
      <div class="form-group">
        <label>Unidade (ex: %, R$, dias)</label>
        <input class="form-control" id="kpiMetaUnidade" value="${m.unidade||''}" placeholder="%">
      </div>
      <div class="form-group" style="grid-column:1/-1">
        <label>Descrição</label>
        <textarea class="form-control" id="kpiMetaDesc" rows="2">${m.descricao||''}</textarea>
      </div>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    ${idx !== undefined ? `<button class="btn btn-danger" onclick="_kpiExcluirMeta(${idx})"><i class="fas fa-trash"></i></button>` : ''}
    <button class="btn btn-primary" onclick="_kpiSalvarMeta(${idx !== undefined ? idx : 'null'})"><i class="fas fa-save"></i> Salvar</button>
  `);
}

function _kpiEditarMeta(idx) { _kpiModalMeta(idx); }

function _kpiSalvarMeta(idx) {
  const metas = _kpiGet('fa_kpi_metas', _kpiMetasDefault());
  const nova = {
    nome:     document.getElementById('kpiMetaNome')?.value?.trim(),
    modulo:   document.getElementById('kpiMetaModulo')?.value,
    periodo:  document.getElementById('kpiMetaPeriodo')?.value,
    meta:     parseFloat(document.getElementById('kpiMetaMeta')?.value||0),
    atual:    parseFloat(document.getElementById('kpiMetaAtual')?.value||0),
    unidade:  document.getElementById('kpiMetaUnidade')?.value||'',
    descricao:document.getElementById('kpiMetaDesc')?.value?.trim(),
  };
  if (!nova.nome) { showToast('Nome da meta é obrigatório','error'); return; }
  if (idx === null || idx === undefined) metas.push(nova);
  else metas[idx] = nova;
  _kpiSave('fa_kpi_metas', metas);
  closeModal();
  showToast('Meta salva!','success');
  _kpiNavAba('metas');
}

function _kpiExcluirMeta(idx) {
  if (!confirm('Excluir esta meta?')) return;
  const metas = _kpiGet('fa_kpi_metas', _kpiMetasDefault());
  metas.splice(idx,1);
  _kpiSave('fa_kpi_metas', metas);
  closeModal();
  showToast('Meta removida','info');
  _kpiNavAba('metas');
}

function _kpiExportarPDF() {
  const d = _kpiColetarDados();
  const linhas = [
    'RELATÓRIO KPI EXECUTIVO',
    '='.repeat(40),
    `Data: ${new Date().toLocaleDateString('pt-BR')}`,
    '',
    'SCORECARD FINANCEIRO',
    `Receita Contratada: ${_fmt(d.receitaContratada)}`,
    `Faturado no Mês: ${_fmt(d.faturadoMes)}`,
    `Margem Bruta: ${_pct(d.margemBruta)}`,
    `Contas a Pagar (Mês): ${_fmt(d.cpTotal)}`,
    `Contas Vencidas: ${_fmt(d.cpVencido)}`,
    '',
    'SCORECARD OPERACIONAL',
    `OS Abertas: ${d.osAbertas}`,
    `Projetos Ativos: ${d.projAtivos}`,
    `Incidentes SSMA (Mês): ${d.incMes}`,
    `Itens Críticos Estoque: ${d.itemsCriticos}`,
    `Equipe Ativa: ${d.equipeAtivos}`,
    `Fornecedores Ativos: ${d.fornAtivos}`,
    '',
    'PATRIMÔNIO',
    `Ativo Fixo Total: ${_fmt(d.vlrPatrimonio)}`,
  ];
  const txt = linhas.join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/plain;charset=utf-8,\uFEFF' + encodeURIComponent(txt);
  a.download = `kpi_executivo_${new Date().toISOString().slice(0,10)}.txt`;
  a.click();
  showToast('Relatório exportado!','success');
}

// =====================================================
// Fraser Alexander ERP – Dashboard Principal v3
// KPIs dinâmicos + dados do localStorage em tempo real
// =====================================================

/* ── Helpers de dados localStorage ─────────────────── */
function _dbGet(k) {
  try { const v = JSON.parse(localStorage.getItem(k)||'null'); return Array.isArray(v)?v:[]; } catch(e){ return []; }
}
function _dbGetColabs() {
  const ls = _dbGet('fraser_colaboradores');
  return ls.length > 0 ? ls : (ERP_DATA.colaboradores||[]);
}
function _dbSnapshot() {
  const hoje = Date.now();
  const d7   = hoje + 7*86400000;
  const d30  = hoje + 30*86400000;
  const os        = [..._dbGet('fa_os_list'),..._dbGet('fa_fluxo_os'),..._dbGet('fa_ordens_servico')];
  const pedidos   = [..._dbGet('fa_pedidos'),..._dbGet('fa_pedidos_v2'),...(window.FA_PEDIDOS||[])];
  const contas    = [..._dbGet('fa_contas_pagar'),..._dbGet('fa_contas_pagar_v2')];
  const colabs    = _dbGetColabs();
  const incidentes= [..._dbGet('fa_incidentes'),..._dbGet('fraser_incidentes')];
  const matrizes  = _dbGet('fa_matrizes');
  const rfqs      = [..._dbGet('fa_rfqs'),..._dbGet('fa_rfq_flow')];
  const projetos  = _dbGet('fa_projetos_gantt');
  const medicoes  = [..._dbGet('fa_medicoes'),..._dbGet('fa_medicoes_v2'),..._dbGet('fraser_medicoes')];
  const treinamentos = _dbGet('fa_treinamentos');
  const contratos = ERP_DATA.contratos || [];

  const dedup = arr => { const s=new Set(); return arr.filter(x=>{if(!x||s.has(x.id))return false;s.add(x.id);return true;}); };

  const osList   = dedup(os);
  const pedList  = dedup(pedidos);
  const cpList   = dedup(contas);
  const incList  = dedup(incidentes);
  const colList  = dedup(colabs);
  const matList  = dedup(matrizes);
  const rfqList  = dedup(rfqs);
  const projList = dedup(projetos);
  const medList  = dedup(medicoes);

  return {
    contratos, os: osList, pedidos: pedList, contas: cpList, colabs: colList,
    incidentes: incList, matrizes: matList, rfqs: rfqList, projetos: projList,
    medicoes: medList, treinamentos: dedup(treinamentos), hoje, d7, d30,
    // Computed
    get osAbertas()     { return this.os.filter(o=>/Aberta|Execução|Andamento/i.test(o.status||'')); },
    get cpVencidas()    { return this.contas.filter(c=>{if(/Paga|Cancel/i.test(c.status||''))return false;const v=c.data_vencimento||c.vencimento;return v&&new Date(v).getTime()<this.hoje;}); },
    get cpProximas()    { return this.contas.filter(c=>{if(/Paga|Cancel/i.test(c.status||''))return false;const v=c.data_vencimento||c.vencimento;if(!v)return false;const t=new Date(v).getTime();return t>=this.hoje&&t<=this.d7;}); },
    get pedPend()       { return this.pedidos.filter(p=>/Aguardando/i.test(p.status||'')); },
    get mapPend()       { return this.matrizes.filter(m=>/Aguardando|Análise/i.test(m.status||'')); },
    get incAbertos()    { return this.incidentes.filter(i=>/Aberto|Investigação|Plano/i.test(i.status||'')); },
    get colAtivos()     { return this.colabs.filter(c=>/^Ativo$/i.test(c.status||'')); },
    get colDocCritico() { return this.colabs.filter(c=>c.docs==='Crítico'); },
    get colDocAtencao() { return this.colabs.filter(c=>c.docs==='Atenção'); },
    get projAtrasados() { return this.projetos.filter(p=>{if(/Conclu|Cancel/i.test(p.status||''))return false;const f=p.data_fim||p.end_date;return f&&new Date(f).getTime()<this.hoje;}); },
    get rfqAtivos()     { return this.rfqs.filter(r=>!/Aprovada|Cancelada|PC Emitido/i.test(r.status||'')); },
    get contVencer()    { return this.contratos.filter(c=>{if(/Encerrado|Suspenso/i.test(c.status||''))return false;const f=c.data_fim||c.vigencia_fim||c.fim;if(!f)return false;const ts=new Date(f).getTime();return ts>this.hoje&&ts<=this.d30;}); },
    get contVencer60()   { return this.contratos.filter(c=>{if(/Encerrado|Suspenso/i.test(c.status||''))return false;const f=c.data_fim||c.vigencia_fim||c.fim;if(!f)return false;const ts=new Date(f).getTime();return ts>this.hoje&&ts>this.d30&&ts<=(this.hoje+60*86400000);}); },
    get contVencer90()   { return this.contratos.filter(c=>{if(/Encerrado|Suspenso/i.test(c.status||''))return false;const f=c.data_fim||c.vigencia_fim||c.fim;if(!f)return false;const ts=new Date(f).getTime();return ts>this.hoje&&ts>(this.hoje+60*86400000)&&ts<=(this.hoje+90*86400000);}); },
    get contVencidos()   { return this.contratos.filter(c=>{if(/Encerrado|Suspenso/i.test(c.status||''))return false;const f=c.data_fim||c.vigencia_fim||c.fim;if(!f)return false;return new Date(f).getTime()<=this.hoje;}); },
    get medPend()       { return this.medicoes.filter(m=>/Pendente|Aguardando/i.test(m.status||'')); },
    get treinVencidos() { return this.treinamentos.filter(t=>{const v=t.validade||t.data_validade;return v&&new Date(v).getTime()<this.hoje;}); },
    get valorContratos(){ return this.contratos.reduce((s,c)=>s+(c.valor||0),0); },
    get valorCpVencido(){ return this.cpVencidas.reduce((s,c)=>s+(c.valor||c.valor_total||0),0); },
    get alertasTotal()  { return this.cpVencidas.length+this.incAbertos.length+this.pedPend.length+this.mapPend.length+this.treinVencidos.length+this.contVencer.length+this.contVencidos.length+this.projAtrasados.length+this.colDocCritico.length; },
  };
}

function renderDashboard() {
  const main = document.getElementById('mainContent');
  const d = _dbSnapshot();

  const contratosAtivos = ERP_DATA.contratos.filter(c => !/Encerrado|Suspenso/i.test(c.status||'')).length;
  const valorTotal = d.valorContratos;

  main.innerHTML = `
    <style>
    .db-alert-band { display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;padding:12px 16px;background:${d.alertasTotal>0?'rgba(239,68,68,.06)':'rgba(34,197,94,.05)'};border:1px solid ${d.alertasTotal>0?'rgba(239,68,68,.25)':'rgba(34,197,94,.2)'};border-radius:12px;align-items:center; }
    .db-alert-pill { display:inline-flex;align-items:center;gap:5px;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap; }
    .db-kpi-extra { display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px;margin-top:14px; }
    .db-kpi-mini { background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:10px;padding:10px 12px;text-align:center;cursor:pointer;transition:border-color .2s }
    .db-kpi-mini:hover { border-color:var(--fa-teal); }
    .db-kpi-mini-num { font-size:20px;font-weight:900;line-height:1; }
    .db-kpi-mini-lbl { font-size:10px;color:var(--text-muted);margin-top:3px; }
    </style>

    <div class="page-header">
      <div class="page-title">
        <h2><i class="fas fa-tachometer-alt" style="color:var(--fa-teal)"></i> Dashboard</h2>
        <p>Visão geral das operações · ${new Date().toLocaleDateString('pt-BR', {weekday:'long', day:'2-digit', month:'long', year:'numeric'})}</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary btn-sm" onclick="renderDashboard()">
          <i class="fas fa-sync-alt"></i> Atualizar
        </button>
        <button class="btn btn-primary btn-sm" onclick="navigate('meu_painel')">
          <i class="fas fa-robot"></i> Meu Painel AI
        </button>
      </div>
    </div>

    <!-- Faixa de alertas dinâmicos -->
    <div class="db-alert-band">
      ${d.alertasTotal > 0
        ? `<span style="font-size:12px;font-weight:700;color:${d.alertasTotal>3?'#ef4444':'#f59e0b'}"><i class="fas fa-exclamation-triangle"></i> ${d.alertasTotal} alerta(s) ativo(s):</span>`
        : `<span style="font-size:12px;font-weight:700;color:#22c55e"><i class="fas fa-check-circle"></i> Operação normalizada – sem alertas críticos</span>`}
      ${d.cpVencidas.length>0?`<span class="db-alert-pill" style="background:rgba(239,68,68,.12);color:#ef4444;border:1px solid rgba(239,68,68,.3)" onclick="navigate('contas_pagar')"><i class="fas fa-dollar-sign"></i> ${d.cpVencidas.length} CP vencida(s)</span>`:''}
      ${d.incAbertos.length>0?`<span class="db-alert-pill" style="background:rgba(239,68,68,.12);color:#ef4444;border:1px solid rgba(239,68,68,.3)" onclick="navigate('ssma')"><i class="fas fa-hard-hat"></i> ${d.incAbertos.length} incidente(s)</span>`:''}
      ${d.pedPend.length>0?`<span class="db-alert-pill" style="background:rgba(245,158,11,.12);color:#f59e0b;border:1px solid rgba(245,158,11,.3)" onclick="navigate('pedidos')"><i class="fas fa-shopping-cart"></i> ${d.pedPend.length} PC(s) pendente(s)</span>`:''}
      ${d.mapPend.length>0?`<span class="db-alert-pill" style="background:rgba(99,102,241,.12);color:#6366f1;border:1px solid rgba(99,102,241,.3)" onclick="navigate('mapa_cotacao')"><i class="fas fa-balance-scale"></i> ${d.mapPend.length} mapa(s) aguardando</span>`:''}
      ${d.treinVencidos.length>0?`<span class="db-alert-pill" style="background:rgba(245,158,11,.12);color:#f59e0b;border:1px solid rgba(245,158,11,.3)" onclick="navigate('treinamentos')"><i class="fas fa-graduation-cap"></i> ${d.treinVencidos.length} trein. vencido(s)</span>`:''}
      ${d.colDocCritico.length>0?`<span class="db-alert-pill" style="background:rgba(239,68,68,.12);color:#ef4444;border:1px solid rgba(239,68,68,.3)" onclick="navigate('equipe')"><i class="fas fa-id-card"></i> ${d.colDocCritico.length} colab. doc. crítico</span>`:''}
      ${d.projAtrasados.length>0?`<span class="db-alert-pill" style="background:rgba(239,68,68,.12);color:#ef4444;border:1px solid rgba(239,68,68,.3)" onclick="navigate('projetos_gantt')"><i class="fas fa-project-diagram"></i> ${d.projAtrasados.length} proj. atrasado(s)</span>`:''}
      ${d.contVencidos.length>0?`<span class="db-alert-pill" style="background:rgba(239,68,68,.12);color:#ef4444;border:1px solid rgba(239,68,68,.3)" onclick="navigate('contratos')"><i class="fas fa-file-contract"></i> ${d.contVencidos.length} contrato(s) VENCIDO(s)</span>`:''}
      ${d.contVencer.length>0?`<span class="db-alert-pill" style="background:rgba(239,68,68,.12);color:#ef4444;border:1px solid rgba(239,68,68,.3)" onclick="navigate('contratos')"><i class="fas fa-file-contract"></i> ${d.contVencer.length} contrato(s) ≤30d</span>`:''}
      ${d.contVencer60.length>0?`<span class="db-alert-pill" style="background:rgba(245,158,11,.12);color:#f59e0b;border:1px solid rgba(245,158,11,.3)" onclick="navigate('contratos')"><i class="fas fa-file-contract"></i> ${d.contVencer60.length} contrato(s) ≤60d</span>`:''}
      ${d.contVencer90.length>0?`<span class="db-alert-pill" style="background:rgba(234,179,8,.12);color:#ca8a04;border:1px solid rgba(234,179,8,.3)" onclick="navigate('contratos')"><i class="fas fa-file-contract"></i> ${d.contVencer90.length} contrato(s) ≤90d</span>`:''}
    </div>

    <!-- KPIs principais -->
    <div class="kpi-grid">
      <div class="kpi-card kpi-blue" onclick="navigate('contratos')" style="cursor:pointer">
        <div class="kpi-icon"><i class="fas fa-file-contract"></i></div>
        <div class="kpi-value">${contratosAtivos}</div>
        <div class="kpi-label">Contratos Ativos</div>
        <div class="kpi-delta delta-up">R$ ${(valorTotal/1000000).toFixed(1)}M portfólio</div>
      </div>
      <div class="kpi-card ${d.osAbertas.length>5?'kpi-orange':'kpi-yellow'}" onclick="navigate('os')" style="cursor:pointer">
        <div class="kpi-icon"><i class="fas fa-wrench"></i></div>
        <div class="kpi-value">${d.osAbertas.length}</div>
        <div class="kpi-label">OS em Andamento</div>
        <div class="kpi-delta ${d.osAbertas.length>5?'delta-down':'delta-up'}">${d.os.length} ordens no total</div>
      </div>
      <div class="kpi-card kpi-teal" onclick="navigate('equipe')" style="cursor:pointer">
        <div class="kpi-icon"><i class="fas fa-users"></i></div>
        <div class="kpi-value">${d.colAtivos.length}</div>
        <div class="kpi-label">Colaboradores Ativos</div>
        <div class="kpi-delta delta-up">${d.colabs.length} cadastrados total</div>
      </div>
      <div class="kpi-card ${d.cpVencidas.length>0?'kpi-red':'kpi-green'}" onclick="navigate('contas_pagar')" style="cursor:pointer">
        <div class="kpi-icon"><i class="fas fa-dollar-sign"></i></div>
        <div class="kpi-value">${d.cpVencidas.length}</div>
        <div class="kpi-label">CP Vencidas</div>
        <div class="kpi-delta ${d.cpVencidas.length>0?'delta-down':'delta-up'}">
          ${d.cpVencidas.length>0?`R$ ${(d.valorCpVencido/1000).toFixed(1)}k em atraso`:'Zero pendências'}
        </div>
      </div>
      <div class="kpi-card ${d.incAbertos.length>0?'kpi-red':'kpi-green'}" onclick="navigate('ssma')" style="cursor:pointer">
        <div class="kpi-icon"><i class="fas fa-shield-alt"></i></div>
        <div class="kpi-value">${d.incAbertos.length}</div>
        <div class="kpi-label">Incidentes SSMA Abertos</div>
        <div class="kpi-delta ${d.incAbertos.length>0?'delta-down':'delta-up'}">${d.incidentes.length} registros total</div>
      </div>
      <div class="kpi-card ${d.pedPend.length>3?'kpi-orange':'kpi-blue'}" onclick="navigate('pedidos')" style="cursor:pointer">
        <div class="kpi-icon"><i class="fas fa-shopping-cart"></i></div>
        <div class="kpi-value">${d.pedPend.length}</div>
        <div class="kpi-label">PCs p/ Aprovar</div>
        <div class="kpi-delta ${d.pedPend.length>3?'delta-down':'delta-up'}">${d.pedidos.length} pedidos total</div>
      </div>
    </div>

    <!-- KPIs adicionais -->
    <div class="db-kpi-extra">
      <div class="db-kpi-mini" onclick="navigate('mapa_cotacao')">
        <div class="db-kpi-mini-num" style="color:${d.mapPend.length>0?'#f59e0b':'#22c55e'}">${d.mapPend.length}</div>
        <div class="db-kpi-mini-lbl">Mapas Pendentes</div>
      </div>
      <div class="db-kpi-mini" onclick="navigate('rfq')">
        <div class="db-kpi-mini-num" style="color:#6366f1">${d.rfqAtivos.length}</div>
        <div class="db-kpi-mini-lbl">RFQs Ativas</div>
      </div>
      <div class="db-kpi-mini" onclick="navigate('medicao')">
        <div class="db-kpi-mini-num" style="color:${d.medPend.length>0?'#f59e0b':'#22c55e'}">${d.medPend.length}</div>
        <div class="db-kpi-mini-lbl">Medições Pendentes</div>
      </div>
      <div class="db-kpi-mini" onclick="navigate('treinamentos')">
        <div class="db-kpi-mini-num" style="color:${d.treinVencidos.length>0?'#f59e0b':'#22c55e'}">${d.treinVencidos.length}</div>
        <div class="db-kpi-mini-lbl">Trein. Vencidos</div>
      </div>
      <div class="db-kpi-mini" onclick="navigate('projetos_gantt')">
        <div class="db-kpi-mini-num" style="color:${d.projAtrasados.length>0?'#ef4444':'#22c55e'}">${d.projAtrasados.length}</div>
        <div class="db-kpi-mini-lbl">Proj. Atrasados</div>
      </div>
      <div class="db-kpi-mini" onclick="navigate('contratos')" title="Contratos: ${d.contVencidos.length} vencidos | ${d.contVencer.length} ≤30d | ${d.contVencer60.length} ≤60d | ${d.contVencer90.length} ≤90d">
        <div class="db-kpi-mini-num" style="color:${d.contVencidos.length>0?'#ef4444':d.contVencer.length>0?'#ef4444':d.contVencer60.length>0?'#f59e0b':'#22c55e'}">${d.contVencidos.length+d.contVencer.length+d.contVencer60.length+d.contVencer90.length}</div>
        <div class="db-kpi-mini-lbl">Contratos c/ Prazo</div>
        <div style="font-size:9px;color:var(--text-muted);margin-top:2px">${d.contVencidos.length>0?d.contVencidos.length+' vencido(s)':d.contVencer.length>0?d.contVencer.length+' ≤30d':d.contVencer60.length>0?d.contVencer60.length+' ≤60d':d.contVencer90.length>0?d.contVencer90.length+' ≤90d':'OK'}</div>
      </div>
      <div class="db-kpi-mini" onclick="navigate('equipe')">
        <div class="db-kpi-mini-num" style="color:${d.colDocCritico.length>0?'#ef4444':'#22c55e'}">${d.colDocCritico.length+d.colDocAtencao.length}</div>
        <div class="db-kpi-mini-lbl">Docs. Irregulares</div>
      </div>
      <div class="db-kpi-mini" onclick="navigate('contas_pagar')">
        <div class="db-kpi-mini-num" style="color:#0ea5e9">${d.cpProximas.length}</div>
        <div class="db-kpi-mini-lbl">CP Vencem 7d</div>
      </div>
    </div>

    <!-- Gráficos principais -->
    <div class="grid-3-1 page-section">
      <div class="card">
        <div class="card-header">
          <h3><i class="fas fa-chart-bar" style="color:var(--orange);margin-right:8px"></i>Faturamento Previsto × Realizado</h3>
          <span class="badge badge-muted">Últimos 6 meses</span>
        </div>
        <div class="card-body">
          <div class="chart-container" style="height:220px">
            <canvas id="chartFaturamento"></canvas>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3><i class="fas fa-chart-pie" style="color:var(--blue-light);margin-right:8px"></i>OS por Status</h3>
        </div>
        <div class="card-body">
          <div class="chart-container" style="height:220px">
            <canvas id="chartOS"></canvas>
          </div>
        </div>
      </div>
    </div>

    <!-- Linha 2 -->
    <div class="grid-2 page-section">
      <!-- Contratos ativos -->
      <div class="card">
        <div class="card-header">
          <h3><i class="fas fa-file-contract" style="color:var(--orange);margin-right:8px"></i>Contratos Ativos</h3>
          <button class="btn btn-secondary btn-sm" onclick="navigate('contratos')">Ver todos</button>
        </div>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Tipo</th>
                <th>Progresso</th>
                <th>Valor</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${ERP_DATA.contratos.filter(c => !/Encerrado/i.test(c.status||'')).map(c => {
                const pct = c.valor > 0 ? Math.round(((c.medidoAcum||c.valor_medido_acumulado||0)/c.valor)*100) : (c.progress||0);
                return `
                <tr onclick="navigate('contratos')" style="cursor:pointer">
                  <td>
                    <div style="font-weight:600">${c.cliente}</div>
                    <div style="font-size:11px;color:var(--text-muted)">${c.id}</div>
                  </td>
                  <td style="font-size:12px">${c.tipo||'—'}</td>
                  <td>
                    <div style="font-size:12px;font-weight:600;margin-bottom:3px">${pct}%</div>
                    <div class="progress"><div class="progress-bar" style="width:${pct}%"></div></div>
                  </td>
                  <td style="font-size:12px;font-weight:600">R$ ${((c.valor||0)/1000000).toFixed(1)}M</td>
                  <td>${statusBadge(c.status)}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Coluna direita -->
      <div style="display:flex;flex-direction:column;gap:16px">

        <!-- Alertas dinâmicos -->
        <div class="card">
          <div class="card-header">
            <h3><i class="fas fa-exclamation-triangle" style="color:var(--yellow-light);margin-right:8px"></i>Alertas e Pendências</h3>
            <span class="badge ${d.alertasTotal>0?'badge-danger':'badge-success'}">${d.alertasTotal}</span>
          </div>
          <div class="card-body" style="padding:12px 16px;max-height:260px;overflow-y:auto">
            ${d.alertasTotal === 0 ? `
              <div class="alert alert-success">
                <span class="alert-icon"><i class="fas fa-check-circle"></i></span>
                <div><div class="alert-title">Operação Normalizada</div><div class="alert-desc">Nenhum alerta crítico identificado no momento.</div></div>
              </div>` : ''}
            ${d.cpVencidas.length > 0 ? `
              <div class="alert alert-danger" style="cursor:pointer" onclick="navigate('contas_pagar')">
                <span class="alert-icon"><i class="fas fa-dollar-sign"></i></span>
                <div><div class="alert-title">${d.cpVencidas.length} Conta(s) a Pagar Vencida(s)</div><div class="alert-desc">R$ ${(d.valorCpVencido/1000).toFixed(1)}k em atraso. Risco de multa e bloqueio de fornecedor.</div></div>
              </div>` : ''}
            ${d.incAbertos.length > 0 ? `
              <div class="alert alert-danger" style="cursor:pointer;margin-top:6px" onclick="navigate('ssma')">
                <span class="alert-icon"><i class="fas fa-hard-hat"></i></span>
                <div><div class="alert-title">${d.incAbertos.length} Incidente(s) SSMA em Aberto</div><div class="alert-desc">Planos de ação pendentes. Exigência ISO 45001 §10.2.</div></div>
              </div>` : ''}
            ${d.pedPend.length > 0 ? `
              <div class="alert alert-warning" style="cursor:pointer;margin-top:6px" onclick="navigate('pedidos')">
                <span class="alert-icon"><i class="fas fa-shopping-cart"></i></span>
                <div><div class="alert-title">${d.pedPend.length} Pedido(s) Aguardando Aprovação</div><div class="alert-desc">Aprovação pendente pode atrasar entregas e gerar compras emergenciais.</div></div>
              </div>` : ''}
            ${d.treinVencidos.length > 0 ? `
              <div class="alert alert-warning" style="cursor:pointer;margin-top:6px" onclick="navigate('treinamentos')">
                <span class="alert-icon"><i class="fas fa-graduation-cap"></i></span>
                <div><div class="alert-title">${d.treinVencidos.length} Treinamento(s) Vencido(s)</div><div class="alert-desc">NRs vencidas impedem atividade em campo (NR-35, NR-10, NR-33).</div></div>
              </div>` : ''}
            ${d.colDocCritico.length > 0 ? `
              <div class="alert alert-danger" style="cursor:pointer;margin-top:6px" onclick="navigate('equipe')">
                <span class="alert-icon"><i class="fas fa-id-card"></i></span>
                <div><div class="alert-title">${d.colDocCritico.length} Colaborador(es) com Doc. Crítica</div><div class="alert-desc">Não podem ser mobilizados sem regularização (CLT Art. 29, NR-7).</div></div>
              </div>` : ''}
            ${d.projAtrasados.length > 0 ? `
              <div class="alert alert-danger" style="cursor:pointer;margin-top:6px" onclick="navigate('projetos_gantt')">
                <span class="alert-icon"><i class="fas fa-project-diagram"></i></span>
                <div><div class="alert-title">${d.projAtrasados.length} Projeto(s) com Cronograma Atrasado</div><div class="alert-desc">Risco de multa contratual (LDs) e perda de receita.</div></div>
              </div>` : ''}
            ${d.contVencidos.length > 0 ? `
              <div class="alert alert-danger" style="cursor:pointer;margin-top:6px" onclick="navigate('contratos')">
                <span class="alert-icon"><i class="fas fa-file-contract"></i></span>
                <div><div class="alert-title">${d.contVencidos.length} Contrato(s) Vencido(s) — Renovação Urgente</div><div class="alert-desc">Contratos expirados sem renovação geram risco jurídico e financeiro imediato.</div></div>
              </div>` : ''}
            ${d.contVencer.length > 0 ? `
              <div class="alert alert-danger" style="cursor:pointer;margin-top:6px" onclick="navigate('contratos')">
                <span class="alert-icon"><i class="fas fa-clock"></i></span>
                <div><div class="alert-title">${d.contVencer.length} Contrato(s) vencem em ≤ 30 dias</div><div class="alert-desc">Iniciar processo de renovação ou encerramento imediatamente.</div></div>
              </div>` : ''}
            ${d.contVencer60.length > 0 ? `
              <div class="alert alert-warning" style="cursor:pointer;margin-top:6px" onclick="navigate('contratos')">
                <span class="alert-icon"><i class="fas fa-clock"></i></span>
                <div><div class="alert-title">${d.contVencer60.length} Contrato(s) vencem em ≤ 60 dias</div><div class="alert-desc">Planejamento de renovação necessário para evitar lacuna contratual.</div></div>
              </div>` : ''}
            ${d.contVencer90.length > 0 ? `
              <div class="alert alert-info" style="cursor:pointer;margin-top:6px" onclick="navigate('contratos')">
                <span class="alert-icon"><i class="fas fa-calendar-alt"></i></span>
                <div><div class="alert-title">${d.contVencer90.length} Contrato(s) vencem em ≤ 90 dias</div><div class="alert-desc">Aviso preventivo: iniciar revisão de escopo e negociação com antecedência.</div></div>
              </div>` : ''}
          </div>
        </div>

        <!-- Ações rápidas -->
        <div class="card">
          <div class="card-header">
            <h3><i class="fas fa-bolt" style="color:#f59e0b;margin-right:8px"></i>Acesso Rápido</h3>
          </div>
          <div class="card-body" style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            ${[
              {icon:'hard-hat',label:'Nova OS',cor:'#0ea5e9',acao:"navigate('os')"},
              {icon:'shopping-cart',label:'Novo PC',cor:'#f59e0b',acao:"navigate('pedidos')"},
              {icon:'file-invoice-dollar',label:'Faturamento',cor:'#22c55e',acao:"navigate('faturamento')"},
              {icon:'shield-alt',label:'SSMA',cor:'#ef4444',acao:"navigate('ssma')"},
              {icon:'users',label:'Equipe',cor:'var(--fa-teal)',acao:"navigate('equipe')"},
              {icon:'robot',label:'Meu Painel AI',cor:'#6366f1',acao:"navigate('meu_painel')"},
            ].map(a=>`
              <button onclick="${a.acao}" style="display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:8px;border:1px solid var(--border-color);background:var(--bg-primary);color:var(--text-primary);cursor:pointer;font-size:12px;font-weight:600;transition:all .2s" onmouseover="this.style.borderColor='${a.cor}';this.style.color='${a.cor}'" onmouseout="this.style.borderColor='var(--border-color)';this.style.color='var(--text-primary)'">
                <i class="fas fa-${a.icon}" style="color:${a.cor}"></i>${a.label}
              </button>`).join('')}
          </div>
        </div>

      </div>
    </div>

    <!-- Gráfico de custo vs receita -->
    <div class="grid-2 page-section">
      <div class="card">
        <div class="card-header">
          <h3><i class="fas fa-chart-area" style="color:var(--green-light);margin-right:8px"></i>Receita × Custo Operacional</h3>
          <span class="badge badge-muted">Últimos 6 meses</span>
        </div>
        <div class="card-body">
          <div style="height:200px">
            <canvas id="chartCusto"></canvas>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3><i class="fas fa-chart-bar" style="color:var(--purple);margin-right:8px"></i>Valor por Contrato</h3>
        </div>
        <div class="card-body">
          <div style="height:200px">
            <canvas id="chartContratos"></canvas>
          </div>
        </div>
      </div>
    </div>

    <!-- OS Recentes (do localStorage) -->
    <div class="card page-section">
      <div class="card-header">
        <h3><i class="fas fa-clipboard-list" style="color:var(--orange);margin-right:8px"></i>Últimas Ordens de Serviço</h3>
        <button class="btn btn-secondary btn-sm" onclick="navigate('os')">Ver todas</button>
      </div>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Nº OS</th>
              <th>Descrição</th>
              <th>Contrato</th>
              <th>Prioridade</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${(d.os.length > 0 ? d.os : ERP_DATA.ordens||[]).slice(0, 6).map(os => `
              <tr onclick="navigate('os')" style="cursor:pointer">
                <td><span style="color:var(--orange);font-weight:600">${os.id||os.numero||'—'}</span></td>
                <td>
                  <div style="font-weight:500">${(os.descricao||os.titulo||'—').substring(0,50)}</div>
                  <div style="font-size:11px;color:var(--text-muted)">${os.local||os.contrato||'—'}</div>
                </td>
                <td style="font-size:12px">${os.os_contrato||os.contrato||os.cliente||'—'}</td>
                <td>${prioridade ? prioridade(os.prioridade||'Normal') : (os.prioridade||'—')}</td>
                <td>${statusBadge(os.status||'—')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Renderiza gráficos
  setTimeout(() => {
    renderChartFaturamento();
    renderChartOS(d);
    renderChartCusto();
    renderChartContratos();
  }, 50);
}

function renderChartFaturamento() {
  const ctx = document.getElementById('chartFaturamento');
  if (!ctx) return;
  if (ctx._chartInstance) ctx._chartInstance.destroy();
  const isDark = document.body.classList.contains('theme-dark') || document.documentElement.classList.contains('dark');
  const tc = isDark?'#c9d1d9':'#374151';
  const gc = isDark?'rgba(255,255,255,.06)':'rgba(0,0,0,.06)';
  ctx._chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: CHART_DATA.faturamentoMensal.labels,
      datasets: [
        { label:'Previsto',  data:CHART_DATA.faturamentoMensal.previsto,  backgroundColor:'rgba(26,115,232,0.3)', borderColor:'#1a73e8', borderWidth:1.5, borderRadius:4 },
        { label:'Realizado', data:CHART_DATA.faturamentoMensal.realizado, backgroundColor:'rgba(230,126,34,0.6)', borderColor:'#e67e22', borderWidth:1.5, borderRadius:4 }
      ]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ labels:{ color:tc, font:{size:11} } } },
      scales:{
        x:{ ticks:{ color:tc, font:{size:10} }, grid:{ color:gc } },
        y:{ ticks:{ color:tc, font:{size:10}, callback:v=>'R$'+(v/1000).toFixed(0)+'K' }, grid:{ color:gc } }
      }
    }
  });
}

function renderChartOS(d) {
  const ctx = document.getElementById('chartOS');
  if (!ctx) return;
  if (ctx._chartInstance) ctx._chartInstance.destroy();
  const isDark = document.body.classList.contains('theme-dark') || document.documentElement.classList.contains('dark');
  const tc = isDark?'#c9d1d9':'#374151';

  // Usa dados do localStorage se disponível
  let labels, values, colors;
  if (d && d.os && d.os.length > 0) {
    const status = {};
    d.os.forEach(o => { const s=o.status||'—'; status[s]=(status[s]||0)+1; });
    labels = Object.keys(status);
    values = Object.values(status);
    colors = ['#22c55e','#f59e0b','#0ea5e9','#ef4444','#6366f1','#8b949e'];
  } else {
    labels = CHART_DATA.osStatus.labels;
    values = CHART_DATA.osStatus.values;
    colors = CHART_DATA.osStatus.colors;
  }

  ctx._chartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets:[{ data:values, backgroundColor:colors, borderColor:isDark?'#161b22':'#fff', borderWidth:3, hoverOffset:6 }] },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ position:'bottom', labels:{ color:tc, font:{size:11}, padding:10 } } },
      cutout:'62%'
    }
  });
}

function renderChartCusto() {
  const ctx = document.getElementById('chartCusto');
  if (!ctx) return;
  if (ctx._chartInstance) ctx._chartInstance.destroy();
  const isDark = document.body.classList.contains('theme-dark') || document.documentElement.classList.contains('dark');
  const tc = isDark?'#c9d1d9':'#374151';
  const gc = isDark?'rgba(255,255,255,.06)':'rgba(0,0,0,.06)';
  ctx._chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: CHART_DATA.custoReceita.labels,
      datasets: [
        { label:'Receita', data:CHART_DATA.custoReceita.receita, borderColor:'#22c55e', backgroundColor:'rgba(34,197,94,0.08)', fill:true, tension:0.4, borderWidth:2, pointBackgroundColor:'#22c55e', pointRadius:4 },
        { label:'Custo',   data:CHART_DATA.custoReceita.custo,   borderColor:'#ef4444', backgroundColor:'rgba(239,68,68,0.08)',  fill:true, tension:0.4, borderWidth:2, pointBackgroundColor:'#ef4444', pointRadius:4 }
      ]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ labels:{ color:tc, font:{size:11} } } },
      scales:{
        x:{ ticks:{ color:tc, font:{size:10} }, grid:{ color:gc } },
        y:{ ticks:{ color:tc, font:{size:10}, callback:v=>'R$'+(v/1000).toFixed(0)+'K' }, grid:{ color:gc } }
      }
    }
  });
}

function renderChartContratos() {
  const ctx = document.getElementById('chartContratos');
  if (!ctx) return;
  if (ctx._chartInstance) ctx._chartInstance.destroy();
  const isDark = document.body.classList.contains('theme-dark') || document.documentElement.classList.contains('dark');
  const tc = isDark?'#c9d1d9':'#374151';
  const gc = isDark?'rgba(255,255,255,.06)':'rgba(0,0,0,.06)';

  // Usa contratos reais
  const cs = ERP_DATA.contratos.filter(c=>!/Encerrado/i.test(c.status||'')).slice(0,6);
  ctx._chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: cs.map(c=>(c.cliente||c.id||'').slice(0,16)),
      datasets: [{
        label:'Valor Contratual (R$)',
        data: cs.map(c=>c.valor||0),
        backgroundColor:['rgba(230,126,34,.6)','rgba(26,115,232,.6)','rgba(13,148,136,.6)','rgba(124,58,237,.6)','rgba(217,119,6,.6)','rgba(14,165,233,.6)'],
        borderRadius:6, borderWidth:0
      }]
    },
    options: {
      responsive:true, maintainAspectRatio:false, indexAxis:'y',
      plugins:{ legend:{ display:false } },
      scales:{
        x:{ ticks:{ color:tc, font:{size:10}, callback:v=>'R$'+(v/1000000).toFixed(1)+'M' }, grid:{ color:gc } },
        y:{ ticks:{ color:tc, font:{size:11} }, grid:{ display:false } }
      }
    }
  });
}



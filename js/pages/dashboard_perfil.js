// =====================================================================
// Fraser Alexander ERP – Meu Painel (v3 – AI Completo)
// Dashboard personalizado por perfil com análise AI + Gráficos ricos
// =====================================================================

/* ── ENTRY POINT ──────────────────────────────────────────────── */
function renderMeuPainel() {
  const main = document.getElementById('mainContent');
  if (!main) return;

  main.innerHTML = `
    <style>
    /* ── Painel Styles ─────────────────────────────────────── */
    .mp-wrap { max-width: 1400px; margin: 0 auto; }
    .mp-header {
      display: flex; align-items: flex-start; justify-content: space-between;
      flex-wrap: wrap; gap: 12px; margin-bottom: 20px;
    }
    .mp-header h2 { margin: 0; font-size: clamp(15px,3.5vw,22px); display:flex;align-items:center;gap:10px; }
    .mp-header p  { margin: 4px 0 0; font-size: 12px; color: var(--text-secondary); }
    .mp-perfil-chip {
      display: inline-flex; align-items: center; gap: 6px;
      background: linear-gradient(135deg,rgba(0,180,184,.15),rgba(99,102,241,.15));
      border: 1px solid rgba(0,180,184,.35); border-radius: 20px;
      padding: 5px 14px; font-size: 12px; font-weight: 700; color: var(--fa-teal);
    }
    /* Score geral */
    .mp-score-bar {
      display: flex; align-items: center; gap: 20px; flex-wrap: wrap;
      background: linear-gradient(135deg,rgba(0,180,184,.06),rgba(99,102,241,.06));
      border: 1px solid rgba(0,180,184,.2); border-radius: 14px;
      padding: 18px 22px; margin-bottom: 20px;
    }
    .mp-score-circle { position:relative; flex-shrink:0; }
    .mp-score-circle svg { display:block; }
    .mp-score-num {
      position:absolute; inset:0; display:flex; flex-direction:column;
      align-items:center; justify-content:center;
    }
    .mp-score-num span { font-size:22px; font-weight:900; line-height:1; }
    .mp-score-num small { font-size:9px; color:var(--text-muted); font-weight:700; }
    .mp-score-info { flex:1; min-width:160px; }
    .mp-score-title { font-size:clamp(14px,3vw,20px); font-weight:800; }
    .mp-score-desc { font-size:12px; color:var(--text-secondary); margin-top:6px; line-height:1.6; }
    .mp-score-prog { height:8px; background:var(--border-color); border-radius:4px; overflow:hidden; margin-top:10px; }
    .mp-score-prog-fill { height:100%; border-radius:4px; transition:width 1.2s ease; }
    .mp-score-checks { display:flex; flex-wrap:wrap; gap:6px; margin-top:10px; }
    .mp-score-check { font-size:10px; padding:2px 8px; border-radius:10px; font-weight:700; }
    /* KPI grid */
    .mp-kpi-grid {
      display: grid; grid-template-columns: repeat(auto-fill,minmax(150px,1fr));
      gap: 10px; margin-bottom: 20px;
    }
    .mp-kpi {
      background: var(--bg-secondary); border: 1px solid var(--border-color);
      border-radius: 12px; padding: 14px 12px; cursor:pointer;
      transition: border-color .2s, transform .15s;
      display:flex; flex-direction:column; gap:6px;
    }
    .mp-kpi:hover { border-color:var(--fa-teal); transform:translateY(-2px); }
    .mp-kpi-top { display:flex; align-items:center; justify-content:space-between; }
    .mp-kpi-icon { width:34px;height:34px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:15px; }
    .mp-kpi-trend { font-size:10px; font-weight:700; border-radius:6px; padding:2px 6px; }
    .mp-kpi-num { font-size:24px; font-weight:900; line-height:1; }
    .mp-kpi-lbl { font-size:10px; color:var(--text-muted); line-height:1.3; }
    /* Seção de análise AI */
    .mp-ai-section { margin-bottom: 22px; }
    .mp-ai-section-title {
      font-size:13px; font-weight:800; color:var(--text-primary);
      display:flex; align-items:center; gap:8px; margin-bottom:12px;
      padding-bottom:8px; border-bottom:2px solid rgba(99,102,241,.2);
    }
    /* AI Insights */
    .mp-ai-box {
      background: linear-gradient(135deg,rgba(99,102,241,.06),rgba(0,180,184,.04));
      border: 1px solid rgba(99,102,241,.2); border-radius:14px;
      padding: 16px 18px; margin-bottom:20px;
    }
    .mp-ai-header { display:flex;align-items:center;gap:8px;margin-bottom:14px; font-size:13px;font-weight:800;color:#6366f1; }
    .mp-ai-header .ai-badge { font-size:9px;background:rgba(99,102,241,.18);border-radius:8px;padding:2px 8px;font-weight:700; }
    .mp-ai-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:10px; }
    .mp-ai-item {
      display:flex;gap:10px;align-items:flex-start;
      background:var(--bg-primary);border:1px solid var(--border-color);
      border-radius:10px;padding:12px 14px;
    }
    .mp-ai-item-ico { width:36px;height:36px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0; }
    .mp-ai-item-body { flex:1;min-width:0; }
    .mp-ai-item-title { font-size:12px;font-weight:800;color:var(--text-primary);margin-bottom:3px; }
    .mp-ai-item-desc { font-size:11px;color:var(--text-secondary);line-height:1.6; }
    .mp-ai-item-norma { font-size:10px;color:var(--text-muted);margin-top:5px;font-style:italic; }
    .mp-ai-item-badge { font-size:9px;font-weight:700;border-radius:5px;padding:2px 7px;margin-top:5px;display:inline-block;cursor:pointer; }
    /* Análise de Risco */
    .mp-risk-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); gap:10px; margin-bottom:20px; }
    .mp-risk-card {
      border-radius:12px; padding:16px;
      border: 1px solid var(--border-color);
      background: var(--bg-secondary);
    }
    .mp-risk-header { display:flex; align-items:center; gap:10px; margin-bottom:10px; }
    .mp-risk-icon { width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0; }
    .mp-risk-title { font-size:13px; font-weight:800; }
    .mp-risk-subtitle { font-size:10px; color:var(--text-muted); margin-top:2px; }
    .mp-risk-score { height:6px; background:var(--border-color); border-radius:3px; margin:10px 0; }
    .mp-risk-score-fill { height:100%; border-radius:3px; transition:width 1s ease; }
    .mp-risk-texto { font-size:11px; color:var(--text-secondary); line-height:1.6; }
    .mp-risk-acao { margin-top:10px; }
    /* Seções */
    .mp-sections { display:grid; grid-template-columns:repeat(auto-fill,minmax(340px,1fr)); gap:16px; margin-bottom:20px; }
    .mp-card { background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:12px;overflow:hidden; }
    .mp-card-head { display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--border-color); }
    .mp-card-title { font-size:13px;font-weight:700;color:var(--text-primary);display:flex;align-items:center;gap:8px; }
    .mp-card-badge { font-size:11px;font-weight:700;border-radius:10px;padding:2px 9px;min-width:22px;text-align:center; }
    .mp-item { display:flex;align-items:center;gap:10px;padding:9px 14px;border-bottom:1px solid var(--border-color);cursor:pointer;transition:background .15s; }
    .mp-item:last-child { border-bottom:none; }
    .mp-item:hover { background:rgba(255,255,255,.04); }
    .mp-item-dot { width:8px;height:8px;border-radius:50%;flex-shrink:0; }
    .mp-item-body { flex:1;min-width:0; }
    .mp-item-label { font-size:12px;font-weight:600;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
    .mp-item-sub { font-size:10px;color:var(--text-muted);margin-top:1px; }
    .mp-item-right { text-align:right;flex-shrink:0; }
    .mp-item-val { font-size:11px;font-weight:700;color:var(--text-primary); }
    .mp-item-date { font-size:10px;color:var(--text-muted); }
    .mp-empty { text-align:center;padding:24px;color:var(--text-muted);font-size:12px; }
    .mp-empty i { font-size:24px;color:#22c55e;display:block;margin-bottom:6px; }
    .mp-more { padding:8px 14px;font-size:11px;color:var(--text-muted);text-align:center;border-top:1px solid var(--border-color); }
    /* Gráficos */
    .mp-charts { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:16px; margin-bottom:20px; }
    .mp-chart-card { background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:12px;padding:16px; }
    .mp-chart-title { font-size:13px;font-weight:700;color:var(--text-primary);margin-bottom:12px;display:flex;align-items:center;gap:8px; }
    .mp-chart-desc { font-size:11px;color:var(--text-secondary);margin-bottom:10px;line-height:1.6;padding:8px;background:rgba(0,0,0,.04);border-radius:6px; }
    .mp-chart-wrap { position:relative; }
    /* Timeline processos */
    .mp-timeline { padding:12px 16px; }
    .mp-tl-item { display:flex;gap:12px;margin-bottom:14px; }
    .mp-tl-item:last-child { margin-bottom:0; }
    .mp-tl-left { display:flex;flex-direction:column;align-items:center;gap:0; }
    .mp-tl-dot { width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0; }
    .mp-tl-line { width:2px;flex:1;background:var(--border-color);margin-top:2px; }
    .mp-tl-body { flex:1;min-width:0;padding-top:2px; }
    .mp-tl-proc { font-size:12px;font-weight:700;color:var(--text-primary); }
    .mp-tl-desc { font-size:11px;color:var(--text-secondary);margin-top:2px;line-height:1.5; }
    .mp-tl-norma { font-size:10px;color:var(--text-muted);margin-top:3px;font-style:italic; }
    .mp-tl-date { font-size:10px;color:var(--text-muted);margin-top:3px; }
    /* Termômetro de Risco */
    .mp-termometro-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr)); gap:10px; margin-bottom:20px; }
    .mp-termo-item { background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:10px;padding:12px; }
    .mp-termo-label { font-size:11px;font-weight:700;color:var(--text-primary);margin-bottom:6px;display:flex;align-items:center;gap:6px; }
    .mp-termo-bar { height:10px;background:var(--border-color);border-radius:5px;overflow:hidden;margin-bottom:4px; }
    .mp-termo-fill { height:100%;border-radius:5px;transition:width 1.2s ease; }
    .mp-termo-vals { display:flex;justify-content:space-between;font-size:10px;color:var(--text-muted); }
    /* Normas e compliance */
    .mp-norma-box { background:rgba(99,102,241,.05);border:1px solid rgba(99,102,241,.2);border-radius:10px;padding:12px 16px;margin-top:8px; }
    .mp-norma-title { font-size:11px;font-weight:700;color:#6366f1;margin-bottom:6px; }
    .mp-norma-list { list-style:none;margin:0;padding:0; }
    .mp-norma-list li { font-size:11px;color:var(--text-secondary);padding:3px 0;border-bottom:1px dashed var(--border-color);display:flex;gap:8px;align-items:flex-start; }
    .mp-norma-list li:last-child { border-bottom:none; }
    .mp-norma-list li i { color:#6366f1;flex-shrink:0;margin-top:1px; }
    /* Responsivo */
    @media(max-width:640px){
      .mp-kpi-grid { grid-template-columns:repeat(2,1fr); }
      .mp-sections  { grid-template-columns:1fr; }
      .mp-charts    { grid-template-columns:1fr; }
      .mp-ai-grid   { grid-template-columns:1fr; }
      .mp-risk-grid { grid-template-columns:1fr; }
      .mp-termometro-grid { grid-template-columns:repeat(2,1fr); }
      .mp-score-circle { display:none; }
      .mp-kpi-num { font-size:20px; }
    }
    @keyframes mp-spin { to { transform:rotate(360deg) } }
    </style>

    <div class="mp-wrap">
      <!-- Header -->
      <div class="mp-header">
        <div>
          <h2><i class="fas fa-th-large" style="color:var(--fa-teal)"></i> Meu Painel</h2>
          <p>Análise inteligente personalizada pelo seu perfil · Fraser Alexander ERP</p>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <div class="mp-perfil-chip" id="mp-perfil-chip">
            <i class="fas fa-user-circle"></i> <span id="mp-user-label">Carregando…</span>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="renderMeuPainel()">
            <i class="fas fa-sync-alt"></i> Atualizar
          </button>
        </div>
      </div>

      <div id="mp-loading" style="text-align:center;padding:60px 20px">
        <div style="width:44px;height:44px;border:4px solid var(--border-color);border-top-color:var(--fa-teal);border-radius:50%;animation:mp-spin .8s linear infinite;margin:0 auto 14px"></div>
        <div style="font-size:14px;color:var(--text-secondary)">Analisando dados do seu perfil com IA…</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:6px">Verificando processos, riscos e conformidade normativa</div>
      </div>

      <div id="mp-conteudo" style="display:none"></div>
    </div>
  `;

  // Aguarda seed carregar e então renderiza
  // Polling robusto: verifica se os dados já estão no localStorage
  // (o db.js pode ter limpado e o seed recarregar em ~400ms)
  function _mpAguardaSeed(tentativa) {
    tentativa = tentativa || 0;
    // Considera ok se tiver contratos OU colaboradores (seed já rodou)
    const contratos    = JSON.parse(localStorage.getItem('fa_contratos_cliente') || 'null') || [];
    const colaboradores= JSON.parse(localStorage.getItem('fa_colaboradores') || 'null') || [];
    const temDados = contratos.length > 0 || colaboradores.length > 0;

    if (temDados || tentativa >= 25) {
      // Mais um pequeno delay para garantir que todos os dados foram gravados
      setTimeout(_mpRenderConteudo, tentativa < 5 ? 200 : 0);
    } else {
      setTimeout(() => _mpAguardaSeed(tentativa + 1), 300);
    }
  }
  // Inicia polling após 200ms (seed demora ~400ms pós-DOMContentLoaded)
  setTimeout(() => _mpAguardaSeed(0), 200);
}

/* ── COLETA DADOS ─────────────────────────────────────────────── */
function _mpGet(k) {
  try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return Array.isArray(v) ? v : []; }
  catch(e) { return []; }
}

function _mpGetObj(k) {
  try { return JSON.parse(localStorage.getItem(k) || '{}'); } catch(e) { return {}; }
}

function _mpSnapshot() {
  const hoje = Date.now();
  const d7   = hoje + 7  * 86400000;
  const d30  = hoje + 30 * 86400000;
  const d60  = hoje + 60 * 86400000;

  const contratos    = [..._mpGet('fa_contratos'), ...(_mpGet('fa_contratos_cliente').length ? _mpGet('fa_contratos_cliente') : [])];
  const os           = [..._mpGet('fa_os_list'), ..._mpGet('fa_fluxo_os'), ..._mpGet('fa_ordens_servico')];
  const rcs          = [..._mpGet('fa_requisicoes'), ..._mpGet('fa_rcs'), ..._mpGet('fa_rc'), ..._mpGet('fraser_rcs')];
  const rfqs         = [..._mpGet('fa_rfqs'), ..._mpGet('fa_rfq_flow')];
  const matrizes     = _mpGet('fa_matrizes');
  const pedidos      = [..._mpGet('fa_pedidos'), ..._mpGet('fa_pedidos_v2'), ...(window.FA_PEDIDOS || [])];
  const contas       = [..._mpGet('fa_contas_pagar'), ..._mpGet('fa_contas_pagar_v2')];
  const colaboradores= [..._mpGet('fa_colaboradores'), ...(_mpGet('fraser_colaboradores').length ? _mpGet('fraser_colaboradores') : [])];
  const equipamentos = [..._mpGet('fa_equipamentos'), ...(_mpGet('fraser_equipamentos').length ? _mpGet('fraser_equipamentos') : [])];
  const incidentes   = [..._mpGet('fa_incidentes'), ...(_mpGet('fraser_incidentes').length ? _mpGet('fraser_incidentes') : [])];
  const treinamentos = _mpGet('fa_treinamentos');
  const documentos   = _mpGet('fa_documentos');
  const medicoes     = [..._mpGet('fa_medicoes'), ..._mpGet('fa_medicoes_v2'), ...(_mpGet('fraser_medicoes').length ? _mpGet('fraser_medicoes') : [])];
  const projetos     = _mpGet('fa_projetos_gantt');
  const fornecedores = [..._mpGet('fa_fornecedores_cache'), ..._mpGet('fa_fornecedores')];
  const avaliacoes   = _mpGet('fa_avaliacoes_forn');
  const idf          = _mpGet('fa_idf_avaliacoes');
  const faturas      = [..._mpGet('fa_faturas'), ...(_mpGet('fraser_faturas').length ? _mpGet('fraser_faturas') : [])];
  const crm          = _mpGet('fa_crm_data');
  const apontamentos = _mpGet('fa_apontamentos_os');
  const contrFornec  = _mpGet('fa_contratos_fornecimento');

  // Deduplicar por id
  const dedup = (arr) => {
    const seen = new Set();
    return arr.filter(x => { if (!x || seen.has(x.id)) return false; seen.add(x.id); return true; });
  };

  const snap = {
    contratos:    dedup(contratos),
    os:           dedup(os),
    rcs:          dedup(rcs),
    rfqs:         dedup(rfqs),
    matrizes:     dedup(matrizes),
    pedidos:      dedup(pedidos),
    contas:       dedup(contas),
    colaboradores:dedup(colaboradores),
    equipamentos: dedup(equipamentos),
    incidentes:   dedup(incidentes),
    treinamentos: dedup(treinamentos),
    documentos:   dedup(documentos),
    medicoes:     dedup(medicoes),
    projetos:     dedup(projetos),
    fornecedores: dedup(fornecedores),
    avaliacoes:   dedup(avaliacoes),
    idf:          dedup(idf),
    faturas:      dedup(faturas),
    crm,
    apontamentos: dedup(apontamentos),
    contrFornec:  dedup(contrFornec),
    hoje, d7, d30, d60,
  };

  // Computed getters
  Object.defineProperties(snap, {
    pedidosAguardando: { get(){ return this.pedidos.filter(p => /Aguardando/i.test(p.status||'')); }},
    pedidosEmitidos:   { get(){ return this.pedidos.filter(p => /Emitido|Entregue Parcial/i.test(p.status||'')); }},
    mapasAguardando:   { get(){ return this.matrizes.filter(m => /Aguardando|Análise/i.test(m.status||'')); }},
    mapasAprovados:    { get(){ return this.matrizes.filter(m => /Aprovado/i.test(m.status||'')); }},
    rfqsAtivos:        { get(){ return this.rfqs.filter(r => !/Aprovada|Cancelada|PC Emitido/i.test(r.status||'')); }},
    rcsAbertas:        { get(){ return this.rcs.filter(r => !/Cancelada|Atendida|Aprovada.*Compra/i.test(r.status||'')); }},
    contasVencidas: { get(){ return this.contas.filter(cp => {
      if(/Paga|Cancelada/i.test(cp.status||'')) return false;
      const v=cp.data_vencimento||cp.vencimento; return v && new Date(v).getTime()<this.hoje;
    });}},
    contasProximas: { get(){ return this.contas.filter(cp => {
      if(/Paga|Cancelada/i.test(cp.status||'')) return false;
      const v=cp.data_vencimento||cp.vencimento; if(!v) return false;
      const t=new Date(v).getTime(); return t>=this.hoje && t<=this.d7;
    });}},
    contratosVencer: { get(){ return this.contratos.filter(c => {
      if(/Encerrado|Suspenso/i.test(c.status||'')) return false;
      const f=c.data_fim||c.vigencia_fim||c.fim; if(!f) return false;
      return new Date(f+'T23:59:59').getTime()<=this.d30;
    });}},
    incidentesAbertos: { get(){ return this.incidentes.filter(i => /Aberto|Investigação|Plano|Investigacao/i.test(i.status||'')); }},
    treinVencidos:     { get(){ return this.treinamentos.filter(t => { const v=t.validade||t.data_validade; return v && new Date(v).getTime()<this.hoje; }); }},
    docsVencidos:      { get(){ return this.documentos.filter(d => { const v=d.validade||d.data_validade; return v && new Date(v).getTime()<this.hoje && !/Arquivado/i.test(d.status||''); }); }},
    eqpManutencao:     { get(){ return this.equipamentos.filter(e => /Manuten/i.test(e.status||'')); }},
    colabAtivos:       { get(){ return this.colaboradores.filter(c => /Ativo|Mobiliz/i.test(c.status||'')); }},
    projetosAtrasados: { get(){ return this.projetos.filter(p => { if(/Conclu|Cancel/i.test(p.status||'')) return false; const f=p.data_fim||p.end_date; return f && new Date(f).getTime()<this.hoje; }); }},
    faturasAbertas:    { get(){ return this.faturas.filter(f => /Aberta|Pendente|Emitida/i.test(f.status||'')); }},
    rfqsVencidos:      { get(){ return this.rfqsAtivos.filter(r => { const dt=r.prazo_cotacao||r.deadline; return dt && new Date(dt).getTime()<this.hoje; }); }},
    pedidosSemMapa:    { get(){ return this.pedidos.filter(p => { if(/Cancelado|Rascunho/i.test(p.status||'')) return false; const val=p.valor_total||0; return val>5000 && !p.mapa_id && !p.mapa_cotacao_id; }); }},
    osAbertas:         { get(){ return this.os.filter(o => /Aberta|Aprovada|Execução/i.test(o.status||'')); }},
    medicoesPend:      { get(){ return this.medicoes.filter(m => /Pendente|Aguardando/i.test(m.status||'')); }},
    colabDocCritico:   { get(){ return this.colaboradores.filter(c => c.docs==='Crítico'||c.docs==='Atenção'); }},
    contratosAtivos:   { get(){ return this.contratos.filter(c => /Ativo|Mobilização/i.test(c.status||'')); }},
    fornSemCNPJ:       { get(){ return this.fornecedores.filter(f => !f.cnpj && !/Físic|CPF/i.test(f.tipo||'')); }},
    pedidosAnticipado: { get(){ return this.pedidos.filter(p => /Antecipado/i.test(p.cond_pagamento||'') && (p.valor_total||0)>10000); }},
  });

  return snap;
}

/* ── USUÁRIO ATUAL ────────────────────────────────────────────── */
function _mpGetUsuario() {
  // Tenta múltiplas fontes: window.currentUser (via app.js loginAs),
  // ou currentUser direto se disponível no mesmo escopo
  const cu = window.currentUser || (typeof currentUser !== 'undefined' ? currentUser : null);
  if (cu && cu.name) {
    return {
      nome:   cu.name,
      perfil: cu.profile || 'geral',
      role:   cu.role || '',
      avatar: cu.avatar || '??',
    };
  }
  // Fallback: tenta ler do DOM
  try {
    const nameEl   = document.getElementById('userName');
    const roleEl   = document.getElementById('userRole');
    const avatarEl = document.getElementById('userAvatar');
    if (nameEl && nameEl.textContent && nameEl.textContent !== 'Usuário') {
      return {
        nome:   nameEl.textContent.trim(),
        perfil: 'geral',
        role:   roleEl ? roleEl.textContent.trim() : '',
        avatar: avatarEl ? avatarEl.textContent.trim() : '?',
      };
    }
  } catch(e) {}
  return { nome: 'Usuário', perfil: 'geral', role: 'Usuário', avatar: '??' };
}

/* ── RENDER CONTEÚDO ──────────────────────────────────────────── */
function _mpRenderConteudo() {
  const loading = document.getElementById('mp-loading');
  const conteudo= document.getElementById('mp-conteudo');
  const chip    = document.getElementById('mp-user-label');
  if (!conteudo) return;

  const usuario = _mpGetUsuario();
  const d       = _mpSnapshot();
  const perfil  = (usuario.perfil || '').toLowerCase();

  if (chip) chip.textContent = `${usuario.nome} · ${usuario.role || usuario.perfil}`;

  // Escolhe módulo pelo perfil
  let modulo;
  if      (/compra|suprimento|procurement|buyer/i.test(perfil))           modulo = _mpModuloComprador(d);
  else if (/financeiro|contas|tesour/i.test(perfil))                       modulo = _mpModuloFinanceiro(d);
  else if (/diretor|gerente|gestor|manager|director|admin/i.test(perfil))  modulo = _mpModuloGerente(d);
  else if (/ssma|seguran|safety/i.test(perfil))                            modulo = _mpModuloSSMA(d);
  else if (/operac|engenhe|supervisor|campo/i.test(perfil))                modulo = _mpModuloOperacao(d);
  else if (/rh|human|recurso/i.test(perfil))                               modulo = _mpModuloRH(d);
  else                                                                      modulo = _mpModuloGerente(d);

  // Score geral de saúde
  const scoreData = _mpCalcScore(d);

  if (loading)  loading.style.display  = 'none';
  conteudo.style.display = 'block';
  conteudo.innerHTML = `
    ${_mpHtmlScore(scoreData)}
    ${_mpHtmlResumoExecutivo(d, usuario)}
    ${_mpHtmlTermometro(d)}
    ${_mpHtmlAcoesRapidas(d)}
    ${_mpHtmlKpis(modulo.kpis)}
    ${_mpHtmlAI(modulo.insights, d, perfil)}
    ${_mpHtmlProcessos(modulo.processos, d)}
    ${_mpHtmlCharts(modulo.charts, d)}
    ${_mpHtmlChartScorePorProcesso(scoreData)}
    ${_mpHtmlCards(modulo.cards)}
    ${_mpHtmlNormas(perfil, d)}
  `;

  // Renderiza gráficos após DOM
  setTimeout(() => {
    _mpRenderCharts(modulo.charts, d);
    _mpRenderScoreChart(scoreData);
  }, 150);
}

/* ── RESUMO EXECUTIVO ───────────────────────────────────────── */
function _mpHtmlResumoExecutivo(d, usuario) {
  const valorContratos = d.contratos.reduce((s,c)=>s+(c.valor||0),0);
  const valorMedido    = d.contratos.reduce((s,c)=>s+(c.medidoAcum||c.valor_medido_acumulado||0),0);
  const percMedido     = valorContratos>0?Math.round((valorMedido/valorContratos)*100):0;
  const colabAtivos    = d.colabAtivos.length;
  const contratosAtivos= d.contratosAtivos.length;
  const osAbertas      = d.osAbertas.length;
  const incAbertos     = d.incidentesAbertos.length;
  const pedPend        = d.pedidosAguardando.length;
  const valorVencido   = d.contasVencidas.reduce((s,c)=>s+(c.valor||c.valor_total||0),0);

  const now = new Date();
  const h = now.getHours();
  const saudacao = h<12?'Bom dia':h<18?'Boa tarde':'Boa noite';
  const hora = now.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  const data = now.toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'});

  return `
    <div style="background:linear-gradient(135deg,rgba(0,180,184,.08),rgba(99,102,241,.08));border:1px solid rgba(0,180,184,.25);border-radius:14px;padding:16px 20px;margin-bottom:18px">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:14px">
        <div>
          <div style="font-size:15px;font-weight:800;color:var(--text-primary)">
            <i class="fas fa-user-circle" style="color:var(--fa-teal);margin-right:8px"></i>
            ${saudacao}, ${(usuario.nome||'').split(' ')[0]}!
          </div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:3px">
            <i class="fas fa-calendar-alt" style="margin-right:5px"></i>${data} · ${hora}
            · <span style="color:var(--fa-teal);font-weight:700">${usuario.role||usuario.perfil||'Usuário'}</span>
          </div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${incAbertos>0?`<span style="background:rgba(239,68,68,.15);color:#ef4444;border-radius:20px;padding:4px 12px;font-size:11px;font-weight:700;cursor:pointer" onclick="navigate('ssma')"><i class="fas fa-exclamation-circle"></i> ${incAbertos} incidente(s) aberto(s)</span>`:''}
          ${pedPend>0?`<span style="background:rgba(245,158,11,.15);color:#f59e0b;border-radius:20px;padding:4px 12px;font-size:11px;font-weight:700;cursor:pointer" onclick="navigate('pedidos')"><i class="fas fa-shopping-cart"></i> ${pedPend} PC(s) pendente(s)</span>`:''}
          ${valorVencido>0?`<span style="background:rgba(239,68,68,.12);color:#ef4444;border-radius:20px;padding:4px 12px;font-size:11px;font-weight:700;cursor:pointer" onclick="navigate('contas_pagar')"><i class="fas fa-dollar-sign"></i> R$${(valorVencido/1000).toFixed(1)}k vencido</span>`:''}
          ${incAbertos===0&&pedPend===0&&valorVencido===0?`<span style="background:rgba(34,197,94,.15);color:#22c55e;border-radius:20px;padding:4px 12px;font-size:11px;font-weight:700"><i class="fas fa-check-circle"></i> Operação normalizada</span>`:''}
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px">
        <div style="background:var(--bg-primary);border-radius:10px;padding:12px;text-align:center;border:1px solid var(--border-color)">
          <div style="font-size:22px;font-weight:900;color:var(--fa-teal)">${contratosAtivos}</div>
          <div style="font-size:10px;color:var(--text-muted)">Contratos Ativos</div>
          <div style="font-size:10px;color:#6366f1;margin-top:2px">R$ ${(valorContratos/1000000).toFixed(1)}M total</div>
        </div>
        <div style="background:var(--bg-primary);border-radius:10px;padding:12px;text-align:center;border:1px solid var(--border-color)">
          <div style="font-size:22px;font-weight:900;color:#6366f1">${percMedido}%</div>
          <div style="font-size:10px;color:var(--text-muted)">Medido Acumulado</div>
          <div style="height:4px;background:var(--border-color);border-radius:2px;margin-top:6px;overflow:hidden">
            <div style="height:100%;width:${percMedido}%;background:linear-gradient(90deg,var(--fa-teal),#6366f1);border-radius:2px"></div>
          </div>
        </div>
        <div style="background:var(--bg-primary);border-radius:10px;padding:12px;text-align:center;border:1px solid var(--border-color)">
          <div style="font-size:22px;font-weight:900;color:#22c55e">${colabAtivos}</div>
          <div style="font-size:10px;color:var(--text-muted)">Colaboradores Ativos</div>
          <div style="font-size:10px;color:var(--text-muted);margin-top:2px">${d.colaboradores.length} cadastrados</div>
        </div>
        <div style="background:var(--bg-primary);border-radius:10px;padding:12px;text-align:center;border:1px solid var(--border-color)">
          <div style="font-size:22px;font-weight:900;color:#0ea5e9">${osAbertas}</div>
          <div style="font-size:10px;color:var(--text-muted)">OS em Andamento</div>
          <div style="font-size:10px;color:var(--text-muted);margin-top:2px">${d.os.length} total</div>
        </div>
        <div style="background:var(--bg-primary);border-radius:10px;padding:12px;text-align:center;border:1px solid var(--border-color)">
          <div style="font-size:22px;font-weight:900;color:${d.incidentesAbertos.length>0?'#ef4444':'#22c55e'}">${d.incidentesAbertos.length}</div>
          <div style="font-size:10px;color:var(--text-muted)">Incidentes Abertos</div>
          <div style="font-size:10px;color:var(--text-muted);margin-top:2px">${d.incidentes.length} total registros</div>
        </div>
        <div style="background:var(--bg-primary);border-radius:10px;padding:12px;text-align:center;border:1px solid var(--border-color)">
          <div style="font-size:22px;font-weight:900;color:${d.contasVencidas.length>0?'#ef4444':'#22c55e'}">${d.contasVencidas.length}</div>
          <div style="font-size:10px;color:var(--text-muted)">CP Vencidas</div>
          <div style="font-size:10px;color:${valorVencido>0?'#ef4444':'var(--text-muted)'};margin-top:2px">R$ ${_mpFmt(valorVencido)}</div>
        </div>
        <div style="background:var(--bg-primary);border-radius:10px;padding:12px;text-align:center;border:1px solid var(--border-color)">
          <div style="font-size:22px;font-weight:900;color:#f59e0b">${d.pedidosAguardando.length}</div>
          <div style="font-size:10px;color:var(--text-muted)">PCs p/ Aprovar</div>
          <div style="font-size:10px;color:var(--text-muted);margin-top:2px">${d.pedidos.length} total</div>
        </div>
        <div style="background:var(--bg-primary);border-radius:10px;padding:12px;text-align:center;border:1px solid var(--border-color)">
          <div style="font-size:22px;font-weight:900;color:#8b5cf6">${d.projetos.length}</div>
          <div style="font-size:10px;color:var(--text-muted)">Projetos Ativos</div>
          <div style="font-size:10px;color:${d.projetosAtrasados.length>0?'#ef4444':'#22c55e'};margin-top:2px">${d.projetosAtrasados.length} atrasado(s)</div>
        </div>
      </div>
    </div>`;
}

/* ── AÇÕES RÁPIDAS ───────────────────────────────────────────── */
function _mpHtmlAcoesRapidas(d) {
  const acoes = [];

  if (d.contasVencidas.length > 0)
    acoes.push({ icon:'exclamation-circle', label:'Regularizar CPs', sub:`${d.contasVencidas.length} vencida(s)`, cor:'#ef4444', bg:'rgba(239,68,68,.1)', acao:"navigate('contas_pagar')" });
  if (d.pedidosAguardando.length > 0)
    acoes.push({ icon:'shopping-cart', label:'Aprovar Pedidos', sub:`${d.pedidosAguardando.length} aguardando`, cor:'#f59e0b', bg:'rgba(245,158,11,.1)', acao:"navigate('pedidos')" });
  if (d.incidentesAbertos.length > 0)
    acoes.push({ icon:'hard-hat', label:'Fechar Incidentes', sub:`${d.incidentesAbertos.length} aberto(s)`, cor:'#ef4444', bg:'rgba(239,68,68,.1)', acao:"navigate('ssma')" });
  if (d.mapasAguardando.length > 0)
    acoes.push({ icon:'balance-scale', label:'Aprovar Mapas', sub:`${d.mapasAguardando.length} pendente(s)`, cor:'#6366f1', bg:'rgba(99,102,241,.1)', acao:"navigate('mapa_cotacao')" });
  if (d.treinVencidos.length > 0)
    acoes.push({ icon:'graduation-cap', label:'Renovar Treinamentos', sub:`${d.treinVencidos.length} vencido(s)`, cor:'#f59e0b', bg:'rgba(245,158,11,.1)', acao:"navigate('treinamentos')" });
  if (d.contratosVencer.length > 0)
    acoes.push({ icon:'file-contract', label:'Renovar Contratos', sub:`${d.contratosVencer.length} a vencer`, cor:'#f59e0b', bg:'rgba(245,158,11,.1)', acao:"navigate('contratos')" });
  if (d.rfqsVencidos.length > 0)
    acoes.push({ icon:'file-signature', label:'Encerrar RFQs', sub:`${d.rfqsVencidos.length} expirado(s)`, cor:'#0ea5e9', bg:'rgba(14,165,233,.1)', acao:"navigate('rfq')" });
  if (d.projetosAtrasados.length > 0)
    acoes.push({ icon:'project-diagram', label:'Replanejar Projetos', sub:`${d.projetosAtrasados.length} atrasado(s)`, cor:'#ef4444', bg:'rgba(239,68,68,.1)', acao:"navigate('projetos_gantt')" });
  if (d.colabDocCritico.length > 0)
    acoes.push({ icon:'id-card', label:'Regularizar Docs', sub:`${d.colabDocCritico.length} colaborador(es)`, cor:'#f59e0b', bg:'rgba(245,158,11,.1)', acao:"navigate('equipe')" });

  // Ações de rotina sempre visíveis
  acoes.push({ icon:'chart-line', label:'Ver Dashboard', sub:'Visão geral', cor:'var(--fa-teal)', bg:'rgba(0,180,184,.08)', acao:"navigate('dashboard')" });
  acoes.push({ icon:'file-alt', label:'Relatórios', sub:'Exportar dados', cor:'#8b5cf6', bg:'rgba(139,92,246,.08)', acao:"navigate('relatorios')" });
  acoes.push({ icon:'robot', label:'Auditoria AI', sub:'Análise completa', cor:'#6366f1', bg:'rgba(99,102,241,.08)', acao:"navigate('auditoria_ai')" });

  return `
    <div class="mp-ai-section">
      <div class="mp-ai-section-title">
        <i class="fas fa-bolt" style="color:#f59e0b"></i>
        Ações Rápidas
        <span style="font-size:10px;font-weight:400;color:var(--text-muted);margin-left:auto">${acoes.filter(a=>a.cor==='#ef4444'||a.cor==='#f59e0b').length} ação(ões) urgente(s)</span>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px">
        ${acoes.map(a=>`
          <button onclick="${a.acao}" style="display:inline-flex;align-items:center;gap:8px;padding:8px 14px;border-radius:20px;border:1px solid ${a.cor};background:${a.bg};color:${a.cor};font-size:11px;font-weight:700;cursor:pointer;transition:all .2s;white-space:nowrap" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform=''">
            <i class="fas fa-${a.icon}"></i>
            <span>${a.label}</span>
            <span style="font-size:9px;opacity:.7">${a.sub}</span>
          </button>`).join('')}
      </div>
    </div>`;
}

/* ── GRÁFICO SCORE POR PROCESSO ─────────────────────────────── */
function _mpHtmlChartScorePorProcesso(scoreData) {
  return `
    <div class="mp-ai-section">
      <div class="mp-ai-section-title">
        <i class="fas fa-chart-radar" style="color:#6366f1"></i>
        Score Detalhado por Processo
        <span style="font-size:10px;font-weight:400;color:var(--text-muted);margin-left:auto">8 dimensões avaliadas</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px;margin-bottom:20px">
        <div class="mp-chart-card">
          <div class="mp-chart-title"><i class="fas fa-chart-bar" style="color:#6366f1"></i>Pontuação por Área</div>
          <div class="mp-chart-desc"><i class="fas fa-lightbulb" style="color:#f59e0b;margin-right:5px"></i>Cada processo tem peso específico. Áreas em vermelho precisam de ação imediata. O score final é uma média ponderada.</div>
          <div class="mp-chart-wrap" style="height:240px">
            <canvas id="chart-score-processo" style="max-height:240px"></canvas>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${scoreData.checks.map(c=>{
            const pct = c.ok ? 100 : 0;
            const cor = c.ok ? '#22c55e' : c.peso>=15 ? '#ef4444' : '#f59e0b';
            const msg = c.ok ? 'Conforme' : c.peso>=15 ? 'Crítico – ação imediata' : 'Atenção recomendada';
            return `
              <div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:10px;padding:12px;border-left:3px solid ${cor}">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
                  <div style="font-size:12px;font-weight:700;display:flex;align-items:center;gap:6px">
                    <i class="fas fa-${c.icon}" style="color:${cor}"></i>${c.label}
                  </div>
                  <div style="display:flex;align-items:center;gap:6px">
                    <span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:8px;background:${c.ok?'rgba(34,197,94,.12)':c.peso>=15?'rgba(239,68,68,.12)':'rgba(245,158,11,.12)'};color:${cor}">${msg}</span>
                    <span style="font-size:10px;color:var(--text-muted)">Peso: ${c.peso}%</span>
                  </div>
                </div>
                <div style="height:6px;background:var(--border-color);border-radius:3px;overflow:hidden">
                  <div style="height:100%;width:${pct}%;background:${cor};border-radius:3px;transition:width 1s ease"></div>
                </div>
                <div style="font-size:10px;color:var(--text-muted);margin-top:4px">
                  ${c.ok ? `<i class="fas fa-check" style="color:#22c55e;margin-right:4px"></i>Sem pendências nessa dimensão` : `<i class="fas fa-times" style="color:${cor};margin-right:4px"></i>Pendência detectada – representa ${c.peso}% do score`}
                </div>
              </div>`;
          }).join('')}
        </div>
      </div>
    </div>`;
}

function _mpRenderScoreChart(scoreData) {
  const canvas = document.getElementById('chart-score-processo');
  if (!canvas || !window.Chart) return;
  const ctx = canvas.getContext('2d');
  if (canvas._chartInstance) canvas._chartInstance.destroy();

  const isDark = (window.getComputedStyle(document.documentElement).getPropertyValue('--bg-primary')||'').trim().startsWith('#0')
    || (window.getComputedStyle(document.documentElement).getPropertyValue('--bg-primary')||'').trim().startsWith('rgb(1')
    || (window.getComputedStyle(document.documentElement).getPropertyValue('--bg-primary')||'').trim().startsWith('rgb(2');
  const textColor = isDark ? '#c9d1d9' : '#374151';
  const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';

  canvas._chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: scoreData.checks.map(c=>c.label),
      datasets: [{
        label: 'Score (%)',
        data: scoreData.checks.map(c=>c.ok?c.peso:0),
        backgroundColor: scoreData.checks.map(c=>c.ok?'rgba(34,197,94,.7)':c.peso>=15?'rgba(239,68,68,.7)':'rgba(245,158,11,.7)'),
        borderRadius: 6,
      },{
        label: 'Peso máx (%)',
        data: scoreData.checks.map(c=>c.peso),
        backgroundColor: scoreData.checks.map(c=>c.ok?'rgba(34,197,94,.15)':c.peso>=15?'rgba(239,68,68,.15)':'rgba(245,158,11,.15)'),
        borderRadius: 6,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: textColor, font:{ size:11 }, boxWidth:12 } },
        tooltip: { titleFont:{size:12}, bodyFont:{size:11} }
      },
      scales: {
        x: { ticks:{ color:textColor, font:{size:9} }, grid:{ color:gridColor } },
        y: { ticks:{ color:textColor, font:{size:10} }, grid:{ color:gridColor }, beginAtZero:true, max:25 }
      }
    }
  });
}

/* ── SCORE GERAL ─────────────────────────────────────────────── */
function _mpCalcScore(d) {
  const checks = [
    { label:'Pagamentos', ok: d.contasVencidas.length === 0, peso: 20, icon:'dollar-sign' },
    { label:'Segurança',  ok: d.incidentesAbertos.length === 0, peso: 20, icon:'hard-hat' },
    { label:'Contratos',  ok: d.contratosVencer.length === 0, peso: 15, icon:'file-contract' },
    { label:'Aprovações', ok: d.pedidosAguardando.length < 3, peso: 10, icon:'check-circle' },
    { label:'Cotações',   ok: d.mapasAguardando.length < 2, peso: 10, icon:'balance-scale' },
    { label:'Treinamentos',ok: d.treinVencidos.length === 0, peso: 10, icon:'graduation-cap' },
    { label:'Documentos', ok: d.docsVencidos.length === 0, peso: 5, icon:'folder-open' },
    { label:'Cronograma', ok: d.projetosAtrasados.length === 0, peso: 10, icon:'project-diagram' },
  ];
  const totalPeso = checks.reduce((s,c) => s+c.peso, 0);
  const pesoOk    = checks.filter(c=>c.ok).reduce((s,c) => s+c.peso, 0);
  const score     = Math.round((pesoOk/totalPeso)*100);
  return { score, checks };
}

function _mpHtmlScore({ score, checks }) {
  const cor   = score>=80?'#22c55e':score>=60?'#f59e0b':'#ef4444';
  const label = score>=80?'Saúde Operacional Boa':score>=60?'Atenção Necessária':'Situação Crítica';
  const icon  = score>=80?'shield-alt':score>=60?'exclamation-triangle':'times-circle';
  const r=40; const circ=2*Math.PI*r;

  const checksHtml = checks.map(c => `
    <span class="mp-score-check" style="background:${c.ok?'rgba(34,197,94,.12)':'rgba(239,68,68,.12)'};color:${c.ok?'#22c55e':'#ef4444'}">
      <i class="fas fa-${c.ok?'check':'times'}" style="margin-right:3px"></i>${c.label}
    </span>`).join('');

  return `
    <div class="mp-score-bar">
      <div class="mp-score-circle">
        <svg width="110" height="110" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="${r}" fill="none" stroke="var(--border-color)" stroke-width="9"/>
          <circle cx="50" cy="50" r="${r}" fill="none" stroke="${cor}" stroke-width="9"
            stroke-dasharray="${circ}" stroke-dashoffset="${circ*(1-score/100)}"
            stroke-linecap="round" transform="rotate(-90 50 50)"
            style="transition:stroke-dashoffset 1.2s ease"/>
        </svg>
        <div class="mp-score-num">
          <span style="color:${cor}">${score}</span>
          <small>/100</small>
        </div>
      </div>
      <div class="mp-score-info" style="flex:1">
        <div class="mp-score-title" style="color:${cor}">
          <i class="fas fa-${icon}" style="margin-right:8px"></i>${label}
        </div>
        <div class="mp-score-desc">
          Score calculado com base em <strong>8 indicadores</strong> de saúde operacional.
          Cada indicador representa um pilar crítico para conformidade e eficiência.
        </div>
        <div class="mp-score-prog">
          <div class="mp-score-prog-fill" style="width:${score}%;background:linear-gradient(90deg,${cor},${cor}aa)"></div>
        </div>
        <div class="mp-score-checks">${checksHtml}</div>
        <div style="font-size:10px;color:var(--text-muted);margin-top:5px">
          <i class="fas fa-clock" style="margin-right:4px"></i>Gerado em ${new Date().toLocaleString('pt-BR')} pela IA Fraser Alexander
        </div>
      </div>
    </div>`;
}

/* ── TERMÔMETRO DE RISCOS ─────────────────────────────────────── */
function _mpHtmlTermometro(d) {
  const itens = [
    {
      label: 'Risco Financeiro',
      icon: 'dollar-sign',
      cor: d.contasVencidas.length > 3 ? '#ef4444' : d.contasVencidas.length > 0 ? '#f59e0b' : '#22c55e',
      valor: Math.min(100, (d.contasVencidas.length / 5) * 100),
      atual: `${d.contasVencidas.length} CP vencidas`,
      meta: '0 vencidas'
    },
    {
      label: 'Risco SSMA',
      icon: 'hard-hat',
      cor: d.incidentesAbertos.length > 2 ? '#ef4444' : d.incidentesAbertos.length > 0 ? '#f59e0b' : '#22c55e',
      valor: Math.min(100, (d.incidentesAbertos.length / 4) * 100),
      atual: `${d.incidentesAbertos.length} incidentes abertos`,
      meta: '0 incidentes'
    },
    {
      label: 'Risco Contratos',
      icon: 'file-contract',
      cor: d.contratosVencer.length > 2 ? '#ef4444' : d.contratosVencer.length > 0 ? '#f59e0b' : '#22c55e',
      valor: Math.min(100, (d.contratosVencer.length / 5) * 100),
      atual: `${d.contratosVencer.length} vencendo 30d`,
      meta: '0 a vencer'
    },
    {
      label: 'Risco Compras',
      icon: 'shopping-cart',
      cor: d.pedidosAguardando.length > 5 ? '#ef4444' : d.pedidosAguardando.length > 2 ? '#f59e0b' : '#22c55e',
      valor: Math.min(100, (d.pedidosAguardando.length / 8) * 100),
      atual: `${d.pedidosAguardando.length} PCs aguardando`,
      meta: '< 3 aguardando'
    },
    {
      label: 'Risco Treinamentos',
      icon: 'graduation-cap',
      cor: d.treinVencidos.length > 3 ? '#ef4444' : d.treinVencidos.length > 0 ? '#f59e0b' : '#22c55e',
      valor: Math.min(100, (d.treinVencidos.length / 5) * 100),
      atual: `${d.treinVencidos.length} vencidos`,
      meta: '0 vencidos'
    },
    {
      label: 'Risco Cronograma',
      icon: 'project-diagram',
      cor: d.projetosAtrasados.length > 2 ? '#ef4444' : d.projetosAtrasados.length > 0 ? '#f59e0b' : '#22c55e',
      valor: Math.min(100, (d.projetosAtrasados.length / 4) * 100),
      atual: `${d.projetosAtrasados.length} proj. atrasados`,
      meta: '0 atrasados'
    },
  ];

  return `
    <div class="mp-ai-section">
      <div class="mp-ai-section-title">
        <i class="fas fa-thermometer-half" style="color:#ef4444"></i>
        Termômetro de Riscos Operacionais
        <span style="font-size:10px;font-weight:400;color:var(--text-muted);margin-left:auto">Análise em tempo real · 6 dimensões</span>
      </div>
      <div class="mp-termometro-grid">
        ${itens.map(it => `
          <div class="mp-termo-item">
            <div class="mp-termo-label">
              <i class="fas fa-${it.icon}" style="color:${it.cor}"></i>
              ${it.label}
              <span style="margin-left:auto;font-size:10px;font-weight:900;color:${it.cor}">${Math.round(it.valor)}%</span>
            </div>
            <div class="mp-termo-bar">
              <div class="mp-termo-fill" style="width:${it.valor}%;background:${it.cor}"></div>
            </div>
            <div class="mp-termo-vals">
              <span>${it.atual}</span>
              <span>Meta: ${it.meta}</span>
            </div>
          </div>`).join('')}
      </div>
    </div>`;
}

/* ── HELPER: formata R$ e data ───────────────────────────────── */
function _mpFmt(v) { return (v||0).toLocaleString('pt-BR',{minimumFractionDigits:2}); }
function _mpDt(d)  { if(!d) return '—'; try{return new Date(d).toLocaleDateString('pt-BR');}catch(e){return d;} }
function _mpDias(d){ if(!d) return null; return Math.round((new Date(d).getTime()-Date.now())/86400000); }

/* ── KPIs ────────────────────────────────────────────────────── */
function _mpHtmlKpis(kpis) {
  return `
    <div class="mp-ai-section">
      <div class="mp-ai-section-title">
        <i class="fas fa-tachometer-alt" style="color:var(--fa-teal)"></i>
        Indicadores do Seu Perfil
      </div>
      <div class="mp-kpi-grid">
        ${kpis.map(k => `
          <div class="mp-kpi" onclick="${k.acao||''}">
            <div class="mp-kpi-top">
              <div class="mp-kpi-icon" style="background:${k.bg};color:${k.cor}">
                <i class="fas fa-${k.icon}"></i>
              </div>
              <span class="mp-kpi-trend" style="background:${k.val>0?(k.urgente?'rgba(239,68,68,.15)':'rgba(245,158,11,.15)'):'rgba(34,197,94,.15)'};color:${k.val>0?(k.urgente?'#ef4444':'#f59e0b'):'#22c55e'}">
                ${k.val>0?(k.urgente?'⚠ Urgente':'● Pendente'):'✓ OK'}
              </span>
            </div>
            <div class="mp-kpi-num" style="color:${k.cor}">${typeof k.val==='string'?k.val:k.val}</div>
            <div class="mp-kpi-lbl">${k.label}</div>
          </div>`).join('')}
      </div>
    </div>`;
}

/* ── AI INSIGHTS ─────────────────────────────────────────────── */
function _mpHtmlAI(insights, d, perfil) {
  // Insights automáticos baseados em dados reais
  const auto = [];

  if (d.contasVencidas.length > 0) {
    const total = d.contasVencidas.reduce((s,c)=>s+(c.valor||c.valor_total||0),0);
    auto.push({
      nivel:'critico', icon:'exclamation-circle', titulo:'Contas a Pagar Vencidas',
      desc:`${d.contasVencidas.length} conta(s) vencida(s) totalizam R$ ${_mpFmt(total)}. Cada dia de atraso pode gerar multa de 0,033% a.d. + juros, além de risco de bloqueio no CADIN e perda de crédito com fornecedores estratégicos.`,
      norma:'ISO 9001:8.4 · Controle de Fornecedores · Política de Pagamento §3.2',
      acao:"navigate('contas_pagar')", acaoLabel:'Regularizar Agora'
    });
  }
  if (d.incidentesAbertos.length > 0) {
    auto.push({
      nivel:'critico', icon:'hard-hat', titulo:'Incidentes SSMA sem Plano Encerrado',
      desc:`${d.incidentesAbertos.length} incidente(s) com plano de ação em aberto. A ISO 45001 exige ação corretiva com responsável, prazo e evidência de eficácia. Risco de auditoria e penalidades do MTE.`,
      norma:'ISO 45001:2018 §10.2 · NR-1 · OHSAS 18001',
      acao:"navigate('ssma')", acaoLabel:'Ver Incidentes'
    });
  }
  if (d.contratosVencer.length > 0) {
    auto.push({
      nivel:'atencao', icon:'file-contract', titulo:'Contratos a Vencer em 30 Dias',
      desc:`${d.contratosVencer.length} contrato(s) com término próximo. A renovação sem continuidade operacional pode gerar multa contratual e paralisação de obras. Inicie negociação com 45 dias de antecedência.`,
      norma:'ISO 9001:8.4.3 · Política de Gestão de Contratos §5',
      acao:"navigate('contratos')", acaoLabel:'Ver Contratos'
    });
  }
  if (d.pedidosAguardando.length > 0) {
    const total = d.pedidosAguardando.reduce((s,p)=>s+(p.valor_total||0),0);
    auto.push({
      nivel:'atencao', icon:'shopping-cart', titulo:'Pedidos de Compra Aguardando Aprovação',
      desc:`${d.pedidosAguardando.length} PC(s) em fila de aprovação, totalizando R$ ${_mpFmt(total)}. Atrasos na aprovação impactam o prazo de entrega e podem gerar compras emergenciais com sobrepreço.`,
      norma:'ISO 9001:8.4 · Procedimento de Compras §4.1 · Alçada de Aprovação',
      acao:"navigate('pedidos')", acaoLabel:'Aprovar Pedidos'
    });
  }
  if (d.mapasAguardando.length > 0) {
    auto.push({
      nivel:'atencao', icon:'balance-scale', titulo:'Mapas Comparativos Pendentes',
      desc:`${d.mapasAguardando.length} mapa(s) de cotação aguardam aprovação. Sem aprovação, não é possível emitir o PC vinculado. A análise comparativa é obrigatória para compras acima do limite de dispensa.`,
      norma:'ISO 9001:8.4 · Procedimento de RFQ §6 · Regulamento de Licitação Interna',
      acao:"navigate('mapa_cotacao')", acaoLabel:'Analisar Mapas'
    });
  }
  if (d.treinVencidos.length > 0) {
    auto.push({
      nivel:'atencao', icon:'graduation-cap', titulo:'Treinamentos com Validade Expirada',
      desc:`${d.treinVencidos.length} treinamento(s) vencido(s). Colaboradores com NR-35, NR-10, NR-33 ou PPRA vencidos não podem executar atividades de risco. Risco de embargo de obra e auditoria do MTE.`,
      norma:'NR-1 §1.7 · NR-7 (PCMSO) · NR-35 · ISO 9001:7.2',
      acao:"navigate('treinamentos')", acaoLabel:'Renovar Treinamentos'
    });
  }
  if (d.rfqsVencidos.length > 0) {
    auto.push({
      nivel:'atencao', icon:'file-signature', titulo:'RFQs com Prazo Expirado',
      desc:`${d.rfqsVencidos.length} cotação(ões) com prazo vencido sem aprovação ou encerramento. Cotações em aberto impactam o ranking de fornecedores e podem resultar em compras sem comparativo de mercado.`,
      norma:'ISO 9001:8.4 · Procedimento de Cotação §3.5',
      acao:"navigate('rfq')", acaoLabel:'Ver RFQs'
    });
  }
  if (d.projetosAtrasados.length > 0) {
    auto.push({
      nivel:'atencao', icon:'project-diagram', titulo:'Projetos com Cronograma Atrasado',
      desc:`${d.projetosAtrasados.length} projeto(s) com data de conclusão ultrapassada. Atrasos geram multas contratuais (LDs), desgaste com o cliente e podem impactar o faturamento do período.`,
      norma:'ISO 9001:8.5 · Contrato de Prestação de Serviços §7 · PMBoK',
      acao:"navigate('projetos_gantt')", acaoLabel:'Ver Projetos'
    });
  }
  if (d.pedidosSemMapa.length > 0) {
    auto.push({
      nivel:'atencao', icon:'exclamation-triangle', titulo:'Pedidos Acima de R$5.000 sem Mapa',
      desc:`${d.pedidosSemMapa.length} PC(s) acima de R$5.000 emitidos sem mapa comparativo aprovado. Isso caracteriza irregularidade de processo e pode ser apontado em auditorias de conformidade.`,
      norma:'ISO 9001:8.4 · Procedimento de Compras §4.2 · Controle de Fornecedores',
      acao:"navigate('pedidos')", acaoLabel:'Ver Pedidos'
    });
  }
  if (d.colabDocCritico.length > 0) {
    auto.push({
      nivel:'atencao', icon:'users', titulo:'Colaboradores com Documentação Crítica',
      desc:`${d.colabDocCritico.length} colaborador(es) com documentação pendente ou crítica. Colaboradores sem ASO, CTPS, ou documentos admissionais regulares não podem ser mobilizados conforme a CLT.`,
      norma:'CLT Art. 29 · NR-7 (ASO) · ISO 9001:7.2 · eSocial',
      acao:"navigate('equipe')", acaoLabel:'Ver Equipe'
    });
  }
  if (d.eqpManutencao.length > 0) {
    auto.push({
      nivel:'info', icon:'tools', titulo:'Equipamentos em Manutenção',
      desc:`${d.eqpManutencao.length} equipamento(s) em manutenção. Verifique previsão de retorno para não comprometer a produção. Mantenha registros de manutenção atualizados conforme ISO 14001 e NR-12.`,
      norma:'ISO 14001 · NR-12 · Plano de Manutenção Preventiva',
      acao:"navigate('frota')", acaoLabel:'Ver Frota'
    });
  }
  if (d.faturasAbertas.length > 0) {
    const total = d.faturasAbertas.reduce((s,f)=>s+(f.valor||0),0);
    auto.push({
      nivel:'info', icon:'file-invoice-dollar', titulo:'Faturas em Aberto',
      desc:`${d.faturasAbertas.length} fatura(s) pendente(s) de R$ ${_mpFmt(total)} a receber. Monitore o prazo de recebimento para manter o fluxo de caixa positivo e evitar necessidade de capital de giro adicional.`,
      norma:'Procedimento Financeiro §2 · Política de Crédito e Cobrança',
      acao:"navigate('faturamento')", acaoLabel:'Ver Faturas'
    });
  }
  if (d.fornSemCNPJ.length > 0) {
    auto.push({
      nivel:'info', icon:'building', titulo:'Fornecedores sem CNPJ Cadastrado',
      desc:`${d.fornSemCNPJ.length} fornecedor(es) sem CNPJ informado. Cadastro incompleto impede consultas de idoneidade, emissão correta de NF e pode ser apontado em auditoria de conformidade fiscal.`,
      norma:'ISO 9001:8.4.1 · Regulamento de Cadastro de Fornecedores §2.1 · Receita Federal',
      acao:"navigate('fornecedores')", acaoLabel:'Completar Cadastro'
    });
  }

  if (auto.length === 0 && insights.length === 0) {
    auto.push({
      nivel:'ok', icon:'check-circle', titulo:'Todos os Indicadores em Conformidade!',
      desc:'Parabéns! Nenhuma pendência crítica foi identificada. Continue monitorando diariamente para manter a excelência operacional e a conformidade com normas ISO e NRs aplicáveis.',
      norma:'ISO 9001 · ISO 45001 · Normas Regulamentadoras MTE',
      acao:'', acaoLabel:''
    });
  }

  const todos = [...insights, ...auto];
  const corMap   = { critico:'#ef4444', atencao:'#f59e0b', info:'#6366f1', ok:'#22c55e' };
  const bgMap    = { critico:'rgba(239,68,68,.12)', atencao:'rgba(245,158,11,.12)', info:'rgba(99,102,241,.12)', ok:'rgba(34,197,94,.12)' };
  const labelMap = { critico:'🔴 Crítico', atencao:'🟡 Atenção', info:'🔵 Info', ok:'🟢 OK' };

  const criticos = todos.filter(i=>i.nivel==='critico').length;
  const atencoes = todos.filter(i=>i.nivel==='atencao').length;
  const infos    = todos.filter(i=>i.nivel==='info').length;

  return `
    <div class="mp-ai-box">
      <div class="mp-ai-header">
        <i class="fas fa-robot" style="font-size:18px"></i>
        Análise AI – Pontos de Atenção e Conformidade
        <span class="ai-badge">${todos.length} análise(s)</span>
        ${criticos>0 ? `<span style="font-size:10px;background:rgba(239,68,68,.15);color:#ef4444;border-radius:8px;padding:2px 8px;font-weight:700">${criticos} crítico(s)</span>` : ''}
        ${atencoes>0 ? `<span style="font-size:10px;background:rgba(245,158,11,.15);color:#f59e0b;border-radius:8px;padding:2px 8px;font-weight:700">${atencoes} atenção</span>` : ''}
        <span style="font-size:10px;color:var(--text-muted);margin-left:auto">${new Date().toLocaleDateString('pt-BR')}</span>
      </div>
      <div style="font-size:11px;color:var(--text-secondary);margin-bottom:14px;padding:10px;background:rgba(99,102,241,.05);border-radius:8px;line-height:1.6">
        <i class="fas fa-info-circle" style="color:#6366f1;margin-right:6px"></i>
        A IA analisa <strong>todos os dados do sistema</strong> e classifica os riscos por criticidade, impacto operacional e conformidade normativa (ISO 9001, ISO 45001, CLT, NRs).
        Itens em <strong style="color:#ef4444">vermelho</strong> requerem ação imediata; em <strong style="color:#f59e0b">amarelo</strong>, atenção planejada.
      </div>
      <div class="mp-ai-grid">
        ${todos.map(ins => `
          <div class="mp-ai-item" style="border-left:3px solid ${corMap[ins.nivel]||corMap.info}">
            <div class="mp-ai-item-ico" style="background:${bgMap[ins.nivel]||bgMap.info};color:${corMap[ins.nivel]||corMap.info}">
              <i class="fas fa-${ins.icon}"></i>
            </div>
            <div class="mp-ai-item-body">
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">
                <div class="mp-ai-item-title">${ins.titulo}</div>
                <span style="font-size:9px;font-weight:700;border-radius:5px;padding:1px 6px;background:${bgMap[ins.nivel]};color:${corMap[ins.nivel]}">${labelMap[ins.nivel]}</span>
              </div>
              <div class="mp-ai-item-desc">${ins.desc}</div>
              ${ins.norma ? `<div class="mp-ai-item-norma"><i class="fas fa-book" style="margin-right:4px;color:#6366f1"></i>${ins.norma}</div>` : ''}
              ${ins.acao ? `<div class="mp-ai-item-badge" style="background:${bgMap[ins.nivel]};color:${corMap[ins.nivel]};border:1px solid ${corMap[ins.nivel]}40" onclick="${ins.acao}">
                <i class="fas fa-arrow-right" style="margin-right:3px"></i>${ins.acaoLabel}
              </div>` : ''}
            </div>
          </div>`).join('')}
      </div>
    </div>`;
}

/* ── PROCESSOS CRÍTICOS TIMELINE ─────────────────────────────── */
function _mpHtmlProcessos(processos, d) {
  if (!processos || processos.length === 0) return '';
  return `
    <div class="mp-ai-section">
      <div class="mp-ai-section-title">
        <i class="fas fa-route" style="color:#6366f1"></i>
        Processos que Precisam de Ação Imediata
        <span style="font-size:10px;font-weight:400;color:var(--text-muted);margin-left:auto">${processos.length} processo(s) identificado(s)</span>
      </div>
      <div class="mp-card" style="border-top:3px solid #6366f1;margin-bottom:20px">
        <div class="mp-timeline">
          ${processos.map((p,i) => `
            <div class="mp-tl-item">
              <div class="mp-tl-left">
                <div class="mp-tl-dot" style="background:${p.corBg};color:${p.cor}">
                  <i class="fas fa-${p.icon}" style="font-size:11px"></i>
                </div>
                ${i < processos.length-1 ? '<div class="mp-tl-line"></div>' : ''}
              </div>
              <div class="mp-tl-body">
                <div class="mp-tl-proc">
                  ${p.processo}
                  <span style="font-size:10px;color:${p.cor};background:${p.corBg};border-radius:5px;padding:1px 6px;margin-left:5px">${p.status}</span>
                </div>
                <div class="mp-tl-desc">${p.descricao}</div>
                ${p.norma ? `<div class="mp-tl-norma"><i class="fas fa-book-open" style="margin-right:3px;color:#6366f1"></i>${p.norma}</div>` : ''}
                ${p.acao ? `<div style="margin-top:6px">
                  <button class="btn btn-sm" style="font-size:10px;padding:3px 10px;background:${p.corBg};color:${p.cor};border:1px solid ${p.cor}40" onclick="${p.acao}">${p.acaoLabel}</button>
                </div>` : ''}
                <div class="mp-tl-date"><i class="fas fa-clock" style="margin-right:3px"></i>${p.data||'Hoje'}</div>
              </div>
            </div>`).join('')}
        </div>
      </div>
    </div>`;
}

/* ── CARDS DE PENDÊNCIAS ─────────────────────────────────────── */
function _mpHtmlCards(cards) {
  if (!cards || cards.length === 0) return '';
  return `
    <div class="mp-ai-section">
      <div class="mp-ai-section-title">
        <i class="fas fa-tasks" style="color:var(--fa-teal)"></i>
        Pendências por Área
      </div>
      <div class="mp-sections">
        ${cards.map(card => {
          const itens = card.itens||[];
          const corBorda = card.urgente?'#ef4444':(card.cor||'var(--border-color)');
          return `
            <div class="mp-card" style="border-top:3px solid ${corBorda}">
              <div class="mp-card-head">
                <div class="mp-card-title">
                  <i class="fas fa-${card.icon}" style="color:${card.cor||'var(--fa-teal)'}"></i>
                  ${card.titulo}
                </div>
                ${itens.length>0
                  ? `<span class="mp-card-badge" style="background:${card.urgente?'rgba(239,68,68,.12)':'rgba(0,180,184,.12)'};color:${card.urgente?'#ef4444':'var(--fa-teal)'}">${itens.length}</span>`
                  : `<span class="mp-card-badge" style="background:rgba(34,197,94,.12);color:#22c55e">✓ OK</span>`}
              </div>
              ${itens.length===0
                ? `<div class="mp-empty"><i class="fas fa-check-circle"></i>Sem pendências nesta área</div>`
                : `${itens.slice(0,6).map(it=>`
                  <div class="mp-item" onclick="${it.acao||''}">
                    <div class="mp-item-dot" style="background:${it.cor||card.cor||'var(--fa-teal)'}"></div>
                    <div class="mp-item-body">
                      <div class="mp-item-label">${it.label}</div>
                      ${it.sub ? `<div class="mp-item-sub">${it.sub}</div>` : ''}
                    </div>
                    <div class="mp-item-right">
                      ${it.valor ? `<div class="mp-item-val">${it.valor}</div>` : ''}
                      ${it.prazo ? `<div class="mp-item-date" style="color:${it.vencido?'#ef4444':'var(--text-muted)'}">${it.prazo}</div>` : ''}
                    </div>
                  </div>`).join('')}
              ${itens.length>6 ? `<div class="mp-more">… e mais ${itens.length-6} item(ns) <button class="btn btn-link btn-sm" onclick="${card.acaoVer||''}" style="font-size:11px;padding:0 4px">Ver todos →</button></div>` : ''}`}
            </div>`;}).join('')}
      </div>
    </div>`;
}

/* ── GRÁFICOS (Chart.js via CDN) ─────────────────────────────── */
function _mpHtmlCharts(charts, d) {
  if (!charts || charts.length === 0) return '';
  return `
    <div class="mp-ai-section">
      <div class="mp-ai-section-title">
        <i class="fas fa-chart-pie" style="color:var(--fa-teal)"></i>
        Dashboards Analíticos
      </div>
      <div class="mp-charts">
        ${charts.map(c => `
          <div class="mp-chart-card">
            <div class="mp-chart-title"><i class="fas fa-${c.icon||'chart-bar'}" style="color:var(--fa-teal)"></i>${c.titulo}</div>
            ${c.desc ? `<div class="mp-chart-desc"><i class="fas fa-lightbulb" style="color:#f59e0b;margin-right:5px"></i>${c.desc}</div>` : ''}
            <div class="mp-chart-wrap" style="height:${c.altura||200}px">
              <canvas id="chart-${c.id}" style="max-height:${c.altura||200}px"></canvas>
            </div>
            ${c.legenda ? `<div style="font-size:10px;color:var(--text-muted);text-align:center;margin-top:8px">${c.legenda}</div>` : ''}
          </div>`).join('')}
      </div>
    </div>`;
}

function _mpRenderCharts(charts, d) {
  if (!charts || charts.length === 0) return;
  if (!window.Chart) {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
    s.onload = () => charts.forEach(c => _mpDrawChart(c, d));
    document.head.appendChild(s);
  } else {
    charts.forEach(c => _mpDrawChart(c, d));
  }
}

function _mpDrawChart(cfg, d) {
  const canvas = document.getElementById('chart-' + cfg.id);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (canvas._chartInstance) { canvas._chartInstance.destroy(); }

  const isDark = (window.getComputedStyle(document.documentElement).getPropertyValue('--bg-primary')||'').trim().startsWith('#0')
    || (window.getComputedStyle(document.documentElement).getPropertyValue('--bg-primary')||'').trim().startsWith('rgb(1')
    || (window.getComputedStyle(document.documentElement).getPropertyValue('--bg-primary')||'').trim().startsWith('rgb(2');

  const textColor = isDark ? '#c9d1d9' : '#374151';
  const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';

  const defaults = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: textColor, font: { size: 11 }, boxWidth: 12 } },
      tooltip: { titleFont: { size: 12 }, bodyFont: { size: 11 } }
    }
  };
  const scaleDefaults = {
    ticks: { color: textColor, font: { size: 10 } },
    grid:  { color: gridColor }
  };

  let chartOpts = {};
  if (cfg.type === 'doughnut' || cfg.type === 'pie') {
    chartOpts = { type: cfg.type, data: cfg.data, options: { ...defaults, cutout: cfg.type==='doughnut'?'60%':undefined } };
  } else if (cfg.type === 'horizontalBar') {
    chartOpts = {
      type: 'bar', data: cfg.data,
      options: { ...defaults, indexAxis:'y', scales: { x:{...scaleDefaults,stacked:cfg.stacked||false}, y:{...scaleDefaults,stacked:cfg.stacked||false} } }
    };
  } else {
    chartOpts = {
      type: cfg.type || 'bar', data: cfg.data,
      options: { ...defaults, scales: { x:{...scaleDefaults,stacked:cfg.stacked||false}, y:{...scaleDefaults,stacked:cfg.stacked||false,beginAtZero:true} } }
    };
  }
  canvas._chartInstance = new Chart(ctx, chartOpts);
}

/* ── NORMAS E COMPLIANCE ─────────────────────────────────────── */
function _mpHtmlNormas(perfil, d) {
  const totalProblemas = d.incidentesAbertos.length + d.treinVencidos.length + d.docsVencidos.length
    + d.contasVencidas.length + d.pedidosSemMapa.length + d.pedidosAguardando.length;

  const normasGerais = [
    { norma:'ISO 9001:2015', area:'Gestão da Qualidade', risco: d.pedidosSemMapa.length>0||d.mapasAguardando.length>0?'alto':'baixo',
      desc:'Auditorias ISO 9001 verificam conformidade em compras (8.4), rastreabilidade de fornecedores, aprovação de pedidos acima do limite, uso de mapas comparativos e avaliação de fornecedores críticos.' },
    { norma:'ISO 45001:2018', area:'Saúde e Segurança', risco: d.incidentesAbertos.length>0||d.treinVencidos.length>0?'alto':'baixo',
      desc:'Requer plano de ação para cada incidente, treinamentos em dia (NR-35, NR-10, NR-33), ASO vigente para todos colaboradores ativos e análise de causa raiz documentada.' },
    { norma:'CLT / eSocial', area:'Relações Trabalhistas', risco: d.colabDocCritico.length>0?'medio':'baixo',
      desc:'Exige CTPS assinada, FGTS em dia, ASO admissional e periódico, EPI fornecido com recibo, e documentação de todos os colaboradores cadastrados no eSocial.' },
    { norma:'ISO 14001:2015', area:'Meio Ambiente', risco: d.eqpManutencao.length>3?'medio':'baixo',
      desc:'Requer registro de manutenção de equipamentos, descarte correto de resíduos industriais, conformidade com PNRS e licenças ambientais vigentes.' },
  ];

  const corRisco = { alto:'#ef4444', medio:'#f59e0b', baixo:'#22c55e' };
  const bgRisco  = { alto:'rgba(239,68,68,.1)', medio:'rgba(245,158,11,.1)', baixo:'rgba(34,197,94,.1)' };

  return `
    <div class="mp-ai-section">
      <div class="mp-ai-section-title">
        <i class="fas fa-certificate" style="color:#6366f1"></i>
        Painel de Conformidade Normativa
        <span style="font-size:10px;font-weight:400;color:var(--text-muted);margin-left:auto">
          ${totalProblemas} não-conformidade(s) potencial(ais) identificada(s)
        </span>
      </div>
      <div class="mp-risk-grid">
        ${normasGerais.map(n => `
          <div class="mp-risk-card" style="border-left:4px solid ${corRisco[n.risco]}">
            <div class="mp-risk-header">
              <div class="mp-risk-icon" style="background:${bgRisco[n.risco]};color:${corRisco[n.risco]}">
                <i class="fas fa-certificate"></i>
              </div>
              <div>
                <div class="mp-risk-title" style="color:${corRisco[n.risco]}">${n.norma}</div>
                <div class="mp-risk-subtitle">${n.area}</div>
              </div>
              <span style="margin-left:auto;font-size:10px;font-weight:700;padding:2px 8px;border-radius:8px;background:${bgRisco[n.risco]};color:${corRisco[n.risco]}">
                Risco ${n.risco.toUpperCase()}
              </span>
            </div>
            <div class="mp-risk-texto">${n.desc}</div>
            <div class="mp-risk-score">
              <div class="mp-risk-score-fill" style="width:${n.risco==='alto'?80:n.risco==='medio'?45:15}%;background:${corRisco[n.risco]}"></div>
            </div>
          </div>`).join('')}
      </div>

      <div style="background:rgba(99,102,241,.05);border:1px solid rgba(99,102,241,.2);border-radius:12px;padding:16px;margin-top:4px">
        <div style="font-size:13px;font-weight:700;color:#6366f1;margin-bottom:10px;display:flex;align-items:center;gap:8px">
          <i class="fas fa-lightbulb"></i> Recomendações da IA para Próxima Auditoria
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:8px;font-size:11px;color:var(--text-secondary)">
          <div style="padding:10px;background:var(--bg-primary);border-radius:8px;border:1px solid var(--border-color)">
            <div style="font-weight:700;color:var(--text-primary);margin-bottom:4px"><i class="fas fa-check-double" style="color:#22c55e;margin-right:5px"></i>Antes da Auditoria</div>
            <ul style="margin:0;padding-left:14px;line-height:2">
              <li>Feche todos os incidentes SSMA com evidência</li>
              <li>Regularize treinamentos vencidos</li>
              <li>Aprove todos os PCs aguardando</li>
              <li>Atualize cadastro de fornecedores (CNPJ)</li>
              <li>Revise documentos controlados vencidos</li>
            </ul>
          </div>
          <div style="padding:10px;background:var(--bg-primary);border-radius:8px;border:1px solid var(--border-color)">
            <div style="font-weight:700;color:var(--text-primary);margin-bottom:4px"><i class="fas fa-folder-open" style="color:#6366f1;margin-right:5px"></i>Evidências Necessárias</div>
            <ul style="margin:0;padding-left:14px;line-height:2">
              <li>Mapas comparativos de cotação aprovados</li>
              <li>Avaliações de fornecedores críticos (últimos 12m)</li>
              <li>ASO vigente para toda equipe mobilizada</li>
              <li>Contratos com gestor designado</li>
              <li>Planos de ação com data de encerramento</li>
            </ul>
          </div>
          <div style="padding:10px;background:var(--bg-primary);border-radius:8px;border:1px solid var(--border-color)">
            <div style="font-weight:700;color:var(--text-primary);margin-bottom:4px"><i class="fas fa-shield-alt" style="color:#f59e0b;margin-right:5px"></i>Pontos Críticos ISO 9001</div>
            <ul style="margin:0;padding-left:14px;line-height:2">
              <li>Cláusula 8.4: controle de fornecedores externos</li>
              <li>Cláusula 8.5: controle de produção e serviços</li>
              <li>Cláusula 10.2: não-conformidade e ação corretiva</li>
              <li>Cláusula 7.2: competência e treinamentos</li>
              <li>Cláusula 7.5: informação documentada</li>
            </ul>
          </div>
        </div>
      </div>
    </div>`;
}

/* ══════════════════════════════════════════════════════════
   MÓDULOS POR PERFIL
   ══════════════════════════════════════════════════════════ */

/* ── COMPRADOR ───────────────────────────────────────────────── */
function _mpModuloComprador(d) {
  const fornSemAval = _mpFornSemAval(d);
  const kpis = [
    { label:'RFQs Ativas',      val:d.rfqsAtivos.length,        icon:'file-signature', cor:'#f59e0b', bg:'rgba(245,158,11,.12)', urgente:d.rfqsAtivos.length>3,         acao:"navigate('rfq')" },
    { label:'Mapas p/ Aprovar', val:d.mapasAguardando.length,   icon:'balance-scale',  cor:'#6366f1', bg:'rgba(99,102,241,.12)', urgente:d.mapasAguardando.length>0,    acao:"navigate('mapa_cotacao')" },
    { label:'PC Aguardando',    val:d.pedidosAguardando.length, icon:'shopping-cart',  cor:'#ef4444', bg:'rgba(239,68,68,.12)',  urgente:d.pedidosAguardando.length>0,  acao:"navigate('pedidos')" },
    { label:'RCs Abertas',      val:d.rcsAbertas.length,        icon:'clipboard-list', cor:'#0ea5e9', bg:'rgba(14,165,233,.12)', urgente:false,                          acao:"navigate('requisicoes')" },
    { label:'PC Emitidos',      val:d.pedidosEmitidos.length,   icon:'truck',          cor:'#6366f1', bg:'rgba(99,102,241,.12)', urgente:false,                          acao:"navigate('pedidos')" },
    { label:'Forn. s/ Aval.',   val:fornSemAval,                icon:'star',           cor:'#f59e0b', bg:'rgba(245,158,11,.12)', urgente:fornSemAval>3,                  acao:"navigate('avaliacao_forn')" },
    { label:'RFQs Vencidas',    val:d.rfqsVencidos.length,      icon:'exclamation',    cor:'#ef4444', bg:'rgba(239,68,68,.12)',  urgente:d.rfqsVencidos.length>0,        acao:"navigate('rfq')" },
    { label:'PC s/ Mapa',       val:d.pedidosSemMapa.length,    icon:'exclamation-triangle', cor:'#ef4444', bg:'rgba(239,68,68,.12)', urgente:d.pedidosSemMapa.length>0, acao:"navigate('pedidos')" },
  ];

  const insights = [
    ...(fornSemAval>3 ? [{
      nivel:'atencao', icon:'star', titulo:'Avaliação de Fornecedores Pendente',
      desc:`${fornSemAval} fornecedor(es) com pedidos recentes (últimos 6 meses) sem avaliação de desempenho no ano. A ISO 9001:8.4 exige avaliação periódica de fornecedores críticos.`,
      norma:'ISO 9001:8.4.1 · Procedimento de Avaliação de Fornecedores §3',
      acao:"navigate('avaliacao_forn')", acaoLabel:'Avaliar Fornecedores'
    }] : []),
  ];

  const processos = [];
  d.pedidosAguardando.slice(0,4).forEach(p => {
    processos.push({
      processo:`PC ${p.numero||p.id}`, status:'Aguardando Aprovação',
      descricao:`Fornecedor: ${p.fornecedor_nome||p.fornecedor||'—'} · Valor: R$ ${_mpFmt(p.valor_total||0)} · ${p.cond_pagamento||''}`,
      norma:'Procedimento de Compras §4.1 · Alçada de Aprovação',
      cor:'#ef4444', corBg:'rgba(239,68,68,.1)', icon:'shopping-cart', data:_mpDt(p.data_emissao||p.data_criacao),
      acao:"navigate('pedidos')", acaoLabel:'Aprovar'
    });
  });
  d.mapasAguardando.slice(0,2).forEach(m => {
    processos.push({
      processo:`Mapa ${m.id||m.numero||'—'}`, status:'Aguardando Aprovação',
      descricao:`${m.titulo||m.descricao||''} · RFQ vinculada: ${m.rfq_id||'—'}`,
      norma:'ISO 9001:8.4 · Procedimento de Cotação §6',
      cor:'#6366f1', corBg:'rgba(99,102,241,.1)', icon:'balance-scale', data:_mpDt(m.data_criacao),
      acao:"navigate('mapa_cotacao')", acaoLabel:'Analisar'
    });
  });
  d.rfqsVencidos.slice(0,2).forEach(r => {
    processos.push({
      processo:`RFQ ${r.numero_rfq||r.numero||r.id}`, status:'Prazo Expirado',
      descricao:`${r.titulo||'—'} · Prazo era: ${_mpDt(r.prazo_cotacao||r.deadline)}`,
      norma:'Procedimento de RFQ §3.5 · Controle de Cotações',
      cor:'#ef4444', corBg:'rgba(239,68,68,.1)', icon:'file-signature', data:_mpDt(r.prazo_cotacao||r.deadline),
      acao:"navigate('rfq')", acaoLabel:'Ver RFQ'
    });
  });

  const statusCount = {};
  d.pedidos.forEach(p => { const s=p.status||'Sem Status'; statusCount[s]=(statusCount[s]||0)+1; });

  const rfqStatus = {
    'Aguardando Envio': d.rfqs.filter(r=>/Aguardando Envio/i.test(r.status||'')).length,
    'Em Cotação':       d.rfqs.filter(r=>/Em Cotação/i.test(r.status||'')).length,
    'Recebidas':        d.rfqs.filter(r=>/Recebidas/i.test(r.status||'')).length,
    'Aprovada':         d.rfqs.filter(r=>/^Aprovada$/i.test(r.status||'')).length,
    'PC Emitido':       d.rfqs.filter(r=>/PC Emitido/i.test(r.status||'')).length,
  };

  const charts = [
    {
      id:'cmp-status', titulo:'Status dos Pedidos de Compra', icon:'shopping-cart', altura:210,
      type:'doughnut',
      desc:'Distribuição dos pedidos por status. Monitore o volume em "Aguardando" para evitar gargalos no processo de aprovação.',
      data: {
        labels: Object.keys(statusCount),
        datasets:[{ data:Object.values(statusCount), backgroundColor:['#22c55e','#f59e0b','#ef4444','#6366f1','#0ea5e9','#8b5cf6','#ec4899'], borderWidth:0 }]
      }
    },
    {
      id:'cmp-rfq', titulo:'Funil de Cotações (RFQs)', icon:'filter', altura:210,
      type:'bar',
      desc:'Funil do processo de compras. Cotações devem fluir de "Em Cotação" para "PC Emitido" dentro do prazo estabelecido.',
      data: {
        labels: Object.keys(rfqStatus),
        datasets:[{ label:'RFQs', data:Object.values(rfqStatus), backgroundColor:['#f59e0b','#0ea5e9','#6366f1','#22c55e','#8b5cf6'], borderRadius:6 }]
      }
    },
    {
      id:'cmp-valor', titulo:'Valor de Pedidos por Mês (R$)', icon:'chart-line', altura:210,
      type:'bar',
      desc:'Volume financeiro de compras nos últimos 6 meses. Útil para gestão de orçamento e benchmarking de fornecedores.',
      data: _mpValorPorMes(d.pedidos),
      legenda:'Últimos 6 meses'
    },
    {
      id:'cmp-forn', titulo:'Top Fornecedores por Volume (R$)', icon:'building', altura:210,
      type:'horizontalBar',
      desc:'Fornecedores com maior volume de compras. Alta concentração em poucos fornecedores representa risco de dependência.',
      data: _mpTopFornecedores(d.pedidos),
    },
  ];

  const cards = [
    {
      titulo:'Pedidos Aguardando Aprovação', icon:'shopping-cart', cor:'#ef4444', urgente:d.pedidosAguardando.length>0,
      acaoVer:"navigate('pedidos')",
      itens:d.pedidosAguardando.map(p=>({ label:`${p.numero||p.id} – ${p.fornecedor_nome||p.fornecedor||'—'}`, sub:`Valor: R$ ${_mpFmt(p.valor_total||0)} · ${p.cond_pagamento||''}`, valor:`R$ ${_mpFmt(p.valor_total||0)}`, cor:'#ef4444', acao:"navigate('pedidos')", prazo:_mpDt(p.data_emissao), vencido:false })),
    },
    {
      titulo:'RFQs com Prazo Próximo ou Expirado', icon:'file-signature', cor:'#f59e0b', urgente:d.rfqsVencidos.length>0,
      acaoVer:"navigate('rfq')",
      itens:d.rfqsAtivos.filter(r=>r.prazo_cotacao||r.deadline).sort((a,b)=>new Date(a.prazo_cotacao||a.deadline)-new Date(b.prazo_cotacao||b.deadline)).slice(0,6).map(r=>{
        const dias=_mpDias(r.prazo_cotacao||r.deadline);
        return { label:`${r.numero_rfq||r.numero||r.id} – ${r.titulo||'—'}`, sub:`Status: ${r.status||'—'}`, cor:dias!==null&&dias<0?'#ef4444':'#f59e0b', acao:"navigate('rfq')", prazo:dias!==null?(dias<0?`Venceu ${Math.abs(dias)}d atrás`:`${dias}d restantes`):'', vencido:dias!==null&&dias<0 };
      }),
    },
    {
      titulo:'Mapas Comparativos Pendentes', icon:'balance-scale', cor:'#6366f1', urgente:d.mapasAguardando.length>0,
      acaoVer:"navigate('mapa_cotacao')",
      itens:d.mapasAguardando.map(m=>({ label:`${m.id||m.numero||'—'} – ${m.titulo||m.descricao||'—'}`, sub:`RFQ: ${m.rfq_id||'—'} · ${_mpDt(m.data_criacao)}`, cor:'#6366f1', acao:"navigate('mapa_cotacao')" })),
    },
    {
      titulo:'Requisições de Compra em Aberto', icon:'clipboard-list', cor:'#0ea5e9', urgente:false,
      acaoVer:"navigate('requisicoes')",
      itens:d.rcsAbertas.slice(0,8).map(r=>({ label:`${r.numero||r.id} – ${r.titulo||r.descricao||'—'}`, sub:`Solicitante: ${r.solicitante||r.criado_por||'—'} · ${r.status||'—'}`, cor:'#0ea5e9', acao:"navigate('requisicoes')" })),
    },
  ];

  return { kpis, insights, processos, charts, cards };
}

/* ── FINANCEIRO ──────────────────────────────────────────────── */
function _mpModuloFinanceiro(d) {
  const totalVencido  = d.contasVencidas.reduce((s,c)=>s+(c.valor||c.valor_total||0),0);
  const totalProximos = d.contasProximas.reduce((s,c)=>s+(c.valor||c.valor_total||0),0);
  const totalFaturas  = d.faturasAbertas.reduce((s,f)=>s+(f.valor||0),0);

  const kpis = [
    { label:'CP Vencidas',       val:d.contasVencidas.length,   icon:'exclamation-circle', cor:'#ef4444', bg:'rgba(239,68,68,.12)', urgente:d.contasVencidas.length>0,   acao:"navigate('contas_pagar')" },
    { label:'Vencendo 7 dias',   val:d.contasProximas.length,   icon:'clock',              cor:'#f59e0b', bg:'rgba(245,158,11,.12)', urgente:d.contasProximas.length>2,   acao:"navigate('contas_pagar')" },
    { label:'Total Vencido',     val:`R$${(totalVencido/1000).toFixed(1)}k`, icon:'dollar-sign', cor:'#ef4444', bg:'rgba(239,68,68,.12)', urgente:totalVencido>10000, acao:"navigate('contas_pagar')" },
    { label:'Faturas Abertas',   val:d.faturasAbertas.length,   icon:'file-invoice',       cor:'#6366f1', bg:'rgba(99,102,241,.12)', urgente:false,                        acao:"navigate('faturamento')" },
    { label:'PC p/ Aprovar',     val:d.pedidosAguardando.length,icon:'shopping-cart',      cor:'#ef4444', bg:'rgba(239,68,68,.12)', urgente:d.pedidosAguardando.length>0, acao:"navigate('pedidos')" },
    { label:'A Receber (R$)',    val:`R$${(totalFaturas/1000).toFixed(1)}k`, icon:'chart-line', cor:'#22c55e', bg:'rgba(34,197,94,.12)', urgente:false, acao:"navigate('faturamento')" },
  ];

  const insights = [
    ...(d.pedidosAnticipado.length>0 ? [{
      nivel:'critico', icon:'credit-card', titulo:'Pagamentos Antecipados sem Aprovação Diretoria',
      desc:`${d.pedidosAnticipado.length} PC(s) com pagamento antecipado acima de R$10.000 detectado(s). Pagamentos antecipados de grande valor exigem aprovação da diretoria e garantia bancária para mitigar risco de fraude.`,
      norma:'Política de Compras §8.3 · Controle Financeiro · ISO 9001:8.4',
      acao:"navigate('pedidos')", acaoLabel:'Ver PCs'
    }] : []),
  ];

  const processos = [];
  d.contasVencidas.slice(0,4).forEach(cp => {
    const diasAtraso = Math.abs(_mpDias(cp.data_vencimento||cp.vencimento)||0);
    processos.push({
      processo:`CP ${cp.numero||cp.id}`, status:`${diasAtraso}d em atraso`,
      descricao:`${cp.fornecedor||cp.descricao||'—'} · R$ ${_mpFmt(cp.valor||cp.valor_total||0)}`,
      norma:'Política de Pagamento §3.2 · Controle de Inadimplência',
      cor:'#ef4444', corBg:'rgba(239,68,68,.1)', icon:'exclamation-circle', data:_mpDt(cp.data_vencimento||cp.vencimento),
      acao:"navigate('contas_pagar')", acaoLabel:'Regularizar'
    });
  });
  d.contasProximas.slice(0,3).forEach(cp => {
    const dias = _mpDias(cp.data_vencimento||cp.vencimento)||0;
    processos.push({
      processo:`CP ${cp.numero||cp.id}`, status:`Vence em ${dias}d`,
      descricao:`${cp.fornecedor||cp.descricao||'—'} · R$ ${_mpFmt(cp.valor||cp.valor_total||0)}`,
      norma:'Procedimento Financeiro §5 · Agenda de Pagamentos',
      cor:'#f59e0b', corBg:'rgba(245,158,11,.1)', icon:'clock', data:_mpDt(cp.data_vencimento||cp.vencimento),
      acao:"navigate('contas_pagar')", acaoLabel:'Programar'
    });
  });

  const cpStatus = {};
  d.contas.forEach(c=>{ const s=c.status||'—'; cpStatus[s]=(cpStatus[s]||0)+1; });

  const charts = [
    {
      id:'fin-status', titulo:'Contas a Pagar por Status', icon:'dollar-sign', altura:210,
      type:'doughnut',
      desc:'Distribuição do passivo por status. Mantenha "Vencidas" em zero para evitar multas e bloqueio de fornecedores.',
      data: { labels: Object.keys(cpStatus), datasets:[{ data:Object.values(cpStatus), backgroundColor:['#22c55e','#f59e0b','#ef4444','#6366f1','#0ea5e9'], borderWidth:0 }] }
    },
    {
      id:'fin-vencimentos', titulo:'Fluxo de Pagamentos por Mês (R$)', icon:'chart-bar', altura:210,
      type:'bar',
      desc:'Comparativo entre valores pagos e valores a pagar. Identifique meses com concentração de vencimentos.',
      data: _mpVencimentosPorMes(d.contas),
      legenda:'Últimos 6 meses'
    },
    {
      id:'fin-receita', titulo:'Receita vs Custo por Contrato (R$)', icon:'chart-line', altura:210,
      type:'horizontalBar',
      desc:'Relação entre valor contratado e medições acumuladas. Contratos com baixo percentual medido podem indicar problemas de execução.',
      data: _mpReceitaCusto(d),
    },
    {
      id:'fin-faturas', titulo:'Faturas por Status', icon:'file-invoice', altura:210,
      type:'doughnut',
      desc:'Ciclo de faturamento. Monitore faturas "Emitidas" para garantir recebimento dentro do prazo contratual.',
      data: (() => {
        const fat = {};
        d.faturas.forEach(f=>{ const s=f.status||'—'; fat[s]=(fat[s]||0)+1; });
        return { labels:Object.keys(fat), datasets:[{ data:Object.values(fat), backgroundColor:['#22c55e','#f59e0b','#ef4444','#6366f1','#0ea5e9'], borderWidth:0 }] };
      })()
    },
  ];

  const cards = [
    {
      titulo:'Contas a Pagar Vencidas', icon:'exclamation-circle', cor:'#ef4444', urgente:d.contasVencidas.length>0,
      acaoVer:"navigate('contas_pagar')",
      itens:d.contasVencidas.map(cp=>({ label:`${cp.numero||cp.id} – ${cp.fornecedor||cp.descricao||'—'}`, sub:`Venceu: ${_mpDt(cp.data_vencimento||cp.vencimento)}`, valor:`R$ ${_mpFmt(cp.valor||cp.valor_total||0)}`, cor:'#ef4444', acao:"navigate('contas_pagar')", prazo:_mpDt(cp.data_vencimento||cp.vencimento), vencido:true })),
    },
    {
      titulo:'Vencimentos nos Próximos 7 Dias', icon:'clock', cor:'#f59e0b', urgente:d.contasProximas.length>2,
      acaoVer:"navigate('contas_pagar')",
      itens:d.contasProximas.map(cp=>({ label:`${cp.numero||cp.id} – ${cp.fornecedor||cp.descricao||'—'}`, sub:`Vence: ${_mpDt(cp.data_vencimento||cp.vencimento)}`, valor:`R$ ${_mpFmt(cp.valor||cp.valor_total||0)}`, cor:'#f59e0b', acao:"navigate('contas_pagar')", prazo:_mpDt(cp.data_vencimento||cp.vencimento), vencido:false })),
    },
    {
      titulo:'Faturas Abertas (A Receber)', icon:'file-invoice', cor:'#22c55e', urgente:false,
      acaoVer:"navigate('faturamento')",
      itens:d.faturasAbertas.slice(0,6).map(f=>({ label:`${f.numero||f.id} – ${f.cliente||f.contrato||'—'}`, sub:`Status: ${f.status||'—'}`, valor:`R$ ${_mpFmt(f.valor||0)}`, cor:'#22c55e', acao:"navigate('faturamento')" })),
    },
    {
      titulo:'PCs com Pagamento Antecipado (> R$10k)', icon:'credit-card', cor:'#ef4444', urgente:d.pedidosAnticipado.length>0,
      acaoVer:"navigate('pedidos')",
      itens:d.pedidosAnticipado.map(p=>({ label:`${p.numero||p.id} – ${p.fornecedor_nome||p.fornecedor||'—'}`, sub:`Cond: ${p.cond_pagamento} · ${p.status||'—'}`, valor:`R$ ${_mpFmt(p.valor_total||0)}`, cor:'#ef4444', acao:"navigate('pedidos')" })),
    },
  ];

  return { kpis, insights, processos, charts, cards };
}

/* ── GERENTE / DIRETOR / ADMIN ───────────────────────────────── */
function _mpModuloGerente(d) {
  const totalPend = d.pedidosAguardando.length + d.mapasAguardando.length + d.incidentesAbertos.length + d.contasVencidas.length;
  const valorContratosAtivos = d.contratosAtivos.reduce((s,c)=>s+(c.valor||0),0);

  const kpis = [
    { label:'Total Pendências',   val:totalPend,                   icon:'bell',           cor:totalPend>0?'#ef4444':'#22c55e', bg:totalPend>0?'rgba(239,68,68,.12)':'rgba(34,197,94,.12)', urgente:totalPend>5 },
    { label:'PC p/ Aprovação',    val:d.pedidosAguardando.length,  icon:'shopping-cart',  cor:'#ef4444', bg:'rgba(239,68,68,.12)', urgente:d.pedidosAguardando.length>0, acao:"navigate('pedidos')" },
    { label:'Contratos 30d',      val:d.contratosVencer.length,    icon:'file-contract',  cor:'#f59e0b', bg:'rgba(245,158,11,.12)', urgente:d.contratosVencer.length>0, acao:"navigate('contratos')" },
    { label:'Incidentes SSMA',    val:d.incidentesAbertos.length,  icon:'hard-hat',       cor:d.incidentesAbertos.length>0?'#ef4444':'#22c55e', bg:'rgba(239,68,68,.12)', urgente:d.incidentesAbertos.length>0, acao:"navigate('ssma')" },
    { label:'CP Vencidas',        val:d.contasVencidas.length,     icon:'dollar-sign',    cor:'#ef4444', bg:'rgba(239,68,68,.12)', urgente:d.contasVencidas.length>0, acao:"navigate('contas_pagar')" },
    { label:'Proj. Atrasados',    val:d.projetosAtrasados.length,  icon:'project-diagram',cor:d.projetosAtrasados.length>0?'#f59e0b':'#22c55e', bg:'rgba(245,158,11,.12)', urgente:false, acao:"navigate('projetos_gantt')" },
    { label:'Contr. Ativos',      val:d.contratosAtivos.length,    icon:'handshake',      cor:'#22c55e', bg:'rgba(34,197,94,.12)', urgente:false, acao:"navigate('contratos')" },
    { label:'Portfólio (R$)',     val:`R$${(valorContratosAtivos/1000000).toFixed(1)}M`, icon:'chart-line', cor:'#0ea5e9', bg:'rgba(14,165,233,.12)', urgente:false, acao:"navigate('contratos')" },
  ];

  const insights = [];

  const processos = [];
  d.pedidosAguardando.slice(0,3).forEach(p => {
    processos.push({
      processo:`PC ${p.numero||p.id}`, status:'Aguarda sua Aprovação',
      descricao:`${p.fornecedor_nome||'—'} · R$ ${_mpFmt(p.valor_total||0)} · Alçada: ${p.nivel_aprovacao||'Diretoria'}`,
      norma:'Alçada de Aprovação · Procedimento de Compras §4.1',
      cor:'#ef4444', corBg:'rgba(239,68,68,.1)', icon:'shopping-cart', data:_mpDt(p.data_emissao||p.data_criacao),
      acao:"navigate('pedidos')", acaoLabel:'Aprovar'
    });
  });
  d.contratosVencer.slice(0,2).forEach(c => {
    const dias = _mpDias(c.data_fim||c.vigencia_fim||c.fim);
    processos.push({
      processo:`Contrato ${c.numero||c.id}`, status:dias!==null&&dias<0?'Vencido':`Vence em ${dias}d`,
      descricao:`Cliente: ${c.cliente||c.contratante||'—'} · ${c.objeto||''}`,
      norma:'Política de Gestão de Contratos §5 · ISO 9001:8.4.3',
      cor:dias!==null&&dias<0?'#ef4444':'#f59e0b', corBg:dias!==null&&dias<0?'rgba(239,68,68,.1)':'rgba(245,158,11,.1)', icon:'file-contract',
      data:_mpDt(c.data_fim||c.vigencia_fim||c.fim), acao:"navigate('contratos')", acaoLabel:'Renovar'
    });
  });
  d.incidentesAbertos.slice(0,2).forEach(i => {
    processos.push({
      processo:`Incidente ${i.numero||i.id}`, status:'Plano de Ação Aberto',
      descricao:`Tipo: ${i.tipo||''} · ${(i.descricao||'').slice(0,60)} · Gravidade: ${i.gravidade||'—'}`,
      norma:'ISO 45001:2018 §10.2 · NR-1 · Obrigatório reportar ao MTE',
      cor:'#ef4444', corBg:'rgba(239,68,68,.1)', icon:'hard-hat', data:_mpDt(i.data),
      acao:"navigate('ssma')", acaoLabel:'Acompanhar'
    });
  });

  const contratosStatus = {};
  d.contratos.forEach(c=>{ const s=c.status||'—'; contratosStatus[s]=(contratosStatus[s]||0)+1; });

  const charts = [
    {
      id:'ger-contratos', titulo:'Portfólio de Contratos por Status', icon:'file-contract', altura:210,
      type:'doughnut',
      desc:'Saúde do portfólio de contratos. Contratos em mobilização representam investimento inicial sem retorno imediato.',
      data: { labels: Object.keys(contratosStatus), datasets:[{ data:Object.values(contratosStatus), backgroundColor:['#22c55e','#f59e0b','#ef4444','#6366f1','#0ea5e9'], borderWidth:0 }] }
    },
    {
      id:'ger-valor-contratos', titulo:'Valor Contratado vs Medido Acum. (R$)', icon:'chart-bar', altura:210,
      type:'horizontalBar',
      desc:'Performance de faturamento por contrato. Contratos com baixo percentual medido em relação ao total podem indicar atrasos na execução.',
      data: {
        labels: d.contratos.slice(0,6).map(c=>(c.numero||c.id||'').slice(0,10)),
        datasets:[
          { label:'Valor Contratado', data:d.contratos.slice(0,6).map(c=>c.valor||0), backgroundColor:'rgba(0,180,184,.7)', borderRadius:4 },
          { label:'Medido Acumulado', data:d.contratos.slice(0,6).map(c=>c.medidoAcum||c.valor_medido||0), backgroundColor:'rgba(99,102,241,.7)', borderRadius:4 },
        ]
      }
    },
    {
      id:'ger-pendencias', titulo:'Pendências por Categoria', icon:'exclamation-triangle', altura:210,
      type:'bar',
      desc:'Visão gerencial de todas as pendências do sistema. Priorize as categorias com maior volume para reduzir o risco operacional.',
      data: {
        labels:['CP Vencidas','Incidentes','PC Aguardando','Mapas','RFQs Vencidas','Trein. Vencidos','Proj. Atrasados'],
        datasets:[{ label:'Quantidade', data:[
          d.contasVencidas.length, d.incidentesAbertos.length, d.pedidosAguardando.length,
          d.mapasAguardando.length, d.rfqsVencidos.length, d.treinVencidos.length, d.projetosAtrasados.length
        ], backgroundColor:['#ef4444','#ef4444','#f59e0b','#6366f1','#f59e0b','#f59e0b','#f59e0b'], borderRadius:6 }]
      }
    },
    {
      id:'ger-eqp', titulo:'Status da Frota / Equipamentos', icon:'truck', altura:210,
      type:'doughnut',
      desc:'Disponibilidade operacional da frota. Mantenha disponibilidade acima de 85% para garantir produtividade nas frentes de trabalho.',
      data: {
        labels:['Operacional','Em Manutenção','Parado','Outros'],
        datasets:[{ data:[
          d.equipamentos.filter(e=>/Operac/i.test(e.status||'')).length,
          d.equipamentos.filter(e=>/Manuten/i.test(e.status||'')).length,
          d.equipamentos.filter(e=>/Parado/i.test(e.status||'')).length,
          d.equipamentos.filter(e=>!/Operac|Manu|Parado/i.test(e.status||'')).length,
        ], backgroundColor:['#22c55e','#f59e0b','#ef4444','#8b949e'], borderWidth:0 }]
      }
    },
  ];

  const cards = [
    {
      titulo:'Pedidos Aguardando sua Aprovação', icon:'shopping-cart', cor:'#ef4444', urgente:d.pedidosAguardando.length>0,
      acaoVer:"navigate('pedidos')",
      itens:d.pedidosAguardando.map(p=>({ label:`${p.numero||p.id} – ${p.fornecedor_nome||p.descricao||'—'}`, sub:`R$ ${_mpFmt(p.valor_total||0)} · Alçada: ${p.nivel_aprovacao||'Diretoria'}`, valor:`R$ ${_mpFmt(p.valor_total||0)}`, cor:'#ef4444', acao:"navigate('pedidos')" })),
    },
    {
      titulo:'Contratos a Vencer em 30 dias', icon:'file-contract', cor:'#f59e0b', urgente:d.contratosVencer.length>0,
      acaoVer:"navigate('contratos')",
      itens:d.contratosVencer.map(c=>{ const dias=_mpDias(c.data_fim||c.vigencia_fim||c.fim); return { label:`${c.numero||c.id} – ${c.cliente||c.contratante||'—'}`, sub:`Vence: ${_mpDt(c.data_fim||c.vigencia_fim||c.fim)} · Gestor: ${c.gestor||'—'}`, cor:dias!==null&&dias<0?'#ef4444':'#f59e0b', acao:"navigate('contratos')", prazo:dias!==null?(dias<0?'VENCIDO':`${dias}d`):'', vencido:dias!==null&&dias<0 }; }),
    },
    {
      titulo:'Incidentes SSMA sem Encerramento', icon:'hard-hat', cor:'#ef4444', urgente:d.incidentesAbertos.length>0,
      acaoVer:"navigate('ssma')",
      itens:d.incidentesAbertos.map(i=>({ label:`${i.numero||i.id} – ${i.tipo||''}: ${(i.descricao||'').slice(0,45)}`, sub:`Data: ${_mpDt(i.data)} · Gravidade: ${i.gravidade||'—'}`, cor:'#ef4444', acao:"navigate('ssma')" })),
    },
    {
      titulo:'Projetos com Cronograma Atrasado', icon:'project-diagram', cor:'#f59e0b', urgente:d.projetosAtrasados.length>0,
      acaoVer:"navigate('projetos_gantt')",
      itens:d.projetosAtrasados.map(p=>({ label:`${p.codigo||p.id} – ${p.nome||p.titulo||'—'}`, sub:`Previsto: ${_mpDt(p.data_fim||p.end_date)} · Status: ${p.status||''}`, cor:'#f59e0b', acao:"navigate('projetos_gantt')", prazo:'ATRASADO', vencido:true })),
    },
  ];

  return { kpis, insights, processos, charts, cards };
}

/* ── SSMA ────────────────────────────────────────────────────── */
function _mpModuloSSMA(d) {
  const kpis = [
    { label:'Incidentes Abertos',  val:d.incidentesAbertos.length, icon:'hard-hat',       cor:d.incidentesAbertos.length>0?'#ef4444':'#22c55e', bg:'rgba(239,68,68,.12)', urgente:d.incidentesAbertos.length>0, acao:"navigate('ssma')" },
    { label:'Trein. Vencidos',     val:d.treinVencidos.length,     icon:'graduation-cap', cor:d.treinVencidos.length>0?'#f59e0b':'#22c55e', bg:'rgba(245,158,11,.12)', urgente:d.treinVencidos.length>2, acao:"navigate('treinamentos')" },
    { label:'Docs Vencidos',       val:d.docsVencidos.length,      icon:'folder-open',    cor:d.docsVencidos.length>0?'#f59e0b':'#22c55e', bg:'rgba(245,158,11,.12)', urgente:false, acao:"navigate('documentos')" },
    { label:'Colab. Ativos',       val:d.colabAtivos.length,       icon:'users',          cor:'#0ea5e9', bg:'rgba(14,165,233,.12)', urgente:false, acao:"navigate('equipe')" },
    { label:'Eqp. Manutenção',     val:d.eqpManutencao.length,     icon:'tools',          cor:'#f59e0b', bg:'rgba(245,158,11,.12)', urgente:false, acao:"navigate('frota')" },
    { label:'Docs Críticos',       val:d.colabDocCritico.length,   icon:'id-card',        cor:d.colabDocCritico.length>0?'#ef4444':'#22c55e', bg:'rgba(239,68,68,.12)', urgente:d.colabDocCritico.length>0, acao:"navigate('equipe')" },
  ];

  const insights = [
    ...(d.incidentesAbertos.length>0 ? [{
      nivel:'critico', icon:'hard-hat', titulo:'ATENÇÃO: Incidentes sem Plano Encerrado',
      desc:`${d.incidentesAbertos.length} incidente(s) com investigação em aberto. A lei exige CAT (Comunicação de Acidente de Trabalho) em até 1 dia útil para acidentes com afastamento. Plano de ação deve ter responsável, prazo e evidência.`,
      norma:'ISO 45001:2018 §10.2 · NR-1 §1.5 · Lei 8.213/91 (CAT) · OHSAS 18001',
      acao:"navigate('ssma')", acaoLabel:'Abrir Planos de Ação'
    }] : []),
    ...(d.treinVencidos.length>0 ? [{
      nivel:'atencao', icon:'graduation-cap', titulo:'Treinamentos Obrigatórios Vencidos',
      desc:`${d.treinVencidos.length} colaborador(es) com treinamentos NR vencidos. A empresa é responsável por garantir validade das NRs. Colaboradores sem treinamento vigente não podem exercer atividades de risco – exposição a auto de infração do MTE.`,
      norma:'NR-1 §1.7 · NR-7 (PCMSO) · NR-35 (Trabalho em Altura) · NR-10 (Elétrica)',
      acao:"navigate('treinamentos')", acaoLabel:'Agendar Treinamentos'
    }] : []),
  ];

  const processos = [];
  d.incidentesAbertos.forEach(i => {
    processos.push({
      processo:`Incidente ${i.numero||i.id}`, status:i.status||'Aberto',
      descricao:`Tipo: ${i.tipo||''} · ${(i.descricao||'').slice(0,70)} · Gravidade: ${i.gravidade||'—'}`,
      norma:'ISO 45001 §10.2 · CAT deve ser emitida em 1 dia útil · NR-1',
      cor:'#ef4444', corBg:'rgba(239,68,68,.1)', icon:'hard-hat', data:_mpDt(i.data),
      acao:"navigate('ssma')", acaoLabel:'Tratar Incidente'
    });
  });
  d.treinVencidos.slice(0,3).forEach(t => {
    processos.push({
      processo:`Treinamento – ${t.colaborador||t.nome||'—'}`, status:'Vencido',
      descricao:`Curso: ${t.curso||t.treinamento||'—'} · Venceu: ${_mpDt(t.validade||t.data_validade)}`,
      norma:`${t.curso||'NR Obrigatória'} · Validade máxima conforme NR aplicável`,
      cor:'#f59e0b', corBg:'rgba(245,158,11,.1)', icon:'graduation-cap', data:_mpDt(t.validade||t.data_validade),
      acao:"navigate('treinamentos')", acaoLabel:'Renovar'
    });
  });

  const incTipo = {};
  d.incidentes.forEach(i=>{ const t=i.tipo||'—'; incTipo[t]=(incTipo[t]||0)+1; });
  const incMes = _mpIncidentesPorMes(d.incidentes);

  const charts = [
    {
      id:'ssma-tipo', titulo:'Incidentes por Tipo', icon:'hard-hat', altura:210,
      type:'doughnut',
      desc:'Classifique os tipos de incidente para direcionar ações preventivas. Acidentes com afastamento têm registro obrigatório no eSocial.',
      data: { labels:Object.keys(incTipo), datasets:[{ data:Object.values(incTipo), backgroundColor:['#ef4444','#f59e0b','#6366f1','#0ea5e9','#22c55e','#8b5cf6'], borderWidth:0 }] }
    },
    {
      id:'ssma-mes', titulo:'Incidentes por Mês', icon:'chart-bar', altura:210,
      type:'bar',
      desc:'Evolução mensal dos incidentes. Analise tendências para identificar períodos críticos e acionar campanhas preventivas.',
      data: incMes,
      legenda:'Últimos 6 meses'
    },
    {
      id:'ssma-status-col', titulo:'Colaboradores por Status', icon:'users', altura:210,
      type:'doughnut',
      desc:'Composição atual da força de trabalho. Colaboradores em mobilização precisam ter documentação admissional completa antes de iniciar.',
      data: {
        labels:['Ativos','Mobilizando','Desmobilizados','Outros'],
        datasets:[{ data:[
          d.colaboradores.filter(c=>/^Ativo$/i.test(c.status||'')).length,
          d.colaboradores.filter(c=>/Mobiliz/i.test(c.status||'')).length,
          d.colaboradores.filter(c=>/Desmobiliz/i.test(c.status||'')).length,
          d.colaboradores.filter(c=>!/Ativo|Mobiliz|Desmob/i.test(c.status||'')).length,
        ], backgroundColor:['#22c55e','#f59e0b','#6366f1','#8b949e'], borderWidth:0 }]
      }
    },
    {
      id:'ssma-eqp', titulo:'Equipamentos: Disponibilidade', icon:'tools', altura:210,
      type:'bar',
      desc:'Taxa de disponibilidade da frota. Mantenha manutenção preventiva em dia conforme NR-12 para garantir segurança e produtividade.',
      data: {
        labels:['Operacional','Manutenção','Parado','Outros'],
        datasets:[{ label:'Quantidade', data:[
          d.equipamentos.filter(e=>/Operac/i.test(e.status||'')).length,
          d.equipamentos.filter(e=>/Manuten/i.test(e.status||'')).length,
          d.equipamentos.filter(e=>/Parado/i.test(e.status||'')).length,
          d.equipamentos.filter(e=>!/Operac|Manu|Parado/i.test(e.status||'')).length,
        ], backgroundColor:['#22c55e','#f59e0b','#ef4444','#8b949e'], borderRadius:6 }]
      }
    },
  ];

  const cards = [
    {
      titulo:'Incidentes sem Plano de Ação Encerrado', icon:'hard-hat', cor:'#ef4444', urgente:d.incidentesAbertos.length>0,
      acaoVer:"navigate('ssma')",
      itens:d.incidentesAbertos.map(i=>({ label:`${i.numero||i.id} – ${i.tipo||''}: ${(i.descricao||'').slice(0,45)}`, sub:`Data: ${_mpDt(i.data)} · Gravidade: ${i.gravidade||'—'} · Status: ${i.status||'—'}`, cor:'#ef4444', acao:"navigate('ssma')" })),
    },
    {
      titulo:'Treinamentos Vencidos', icon:'graduation-cap', cor:'#f59e0b', urgente:d.treinVencidos.length>0,
      acaoVer:"navigate('treinamentos')",
      itens:d.treinVencidos.slice(0,8).map(t=>({ label:`${t.colaborador||t.nome||'—'} – ${t.curso||t.treinamento||'—'}`, sub:`Venceu: ${_mpDt(t.validade||t.data_validade)}`, cor:'#f59e0b', acao:"navigate('treinamentos')", prazo:_mpDt(t.validade||t.data_validade), vencido:true })),
    },
    {
      titulo:'Documentos Controlados Vencidos', icon:'folder-open', cor:'#f59e0b', urgente:d.docsVencidos.length>0,
      acaoVer:"navigate('documentos')",
      itens:d.docsVencidos.slice(0,8).map(doc=>({ label:doc.titulo||doc.nome||doc.id, sub:`Venceu: ${_mpDt(doc.validade||doc.data_validade)}`, cor:'#f59e0b', acao:"navigate('documentos')", prazo:_mpDt(doc.validade||doc.data_validade), vencido:true })),
    },
    {
      titulo:'Colaboradores com Documentação Crítica', icon:'id-card', cor:'#ef4444', urgente:d.colabDocCritico.length>0,
      acaoVer:"navigate('equipe')",
      itens:d.colabDocCritico.map(c=>({ label:`${c.nome||c.id} – ${c.cargo||'—'}`, sub:`Docs: ${c.docs} · Status: ${c.status||'—'} · Contrato: ${c.contrato||'—'}`, cor:c.docs==='Crítico'?'#ef4444':'#f59e0b', acao:"navigate('equipe')" })),
    },
  ];

  return { kpis, insights, processos, charts, cards };
}

/* ── OPERAÇÃO / ENGENHARIA ───────────────────────────────────── */
function _mpModuloOperacao(d) {
  const osEmExecucao  = d.os.filter(o=>/Execução|Andamento|Em andamento/i.test(o.status||''));
  const medicoesPend  = d.medicoes.filter(m=>/Pendente|Aguardando/i.test(m.status||''));

  const kpis = [
    { label:'OS em Execução',    val:osEmExecucao.length,         icon:'hard-hat',       cor:'#0ea5e9', bg:'rgba(14,165,233,.12)', urgente:false, acao:"navigate('os')" },
    { label:'Proj. Atrasados',   val:d.projetosAtrasados.length,  icon:'project-diagram',cor:d.projetosAtrasados.length>0?'#ef4444':'#22c55e', bg:'rgba(239,68,68,.12)', urgente:d.projetosAtrasados.length>0, acao:"navigate('projetos_gantt')" },
    { label:'Medições Pendentes',val:medicoesPend.length,          icon:'ruler',          cor:'#f59e0b', bg:'rgba(245,158,11,.12)', urgente:medicoesPend.length>2, acao:"navigate('medicao')" },
    { label:'Eqp. Manutenção',   val:d.eqpManutencao.length,      icon:'tools',          cor:'#f59e0b', bg:'rgba(245,158,11,.12)', urgente:false, acao:"navigate('frota')" },
    { label:'RCs Abertas',       val:d.rcsAbertas.length,          icon:'clipboard-list', cor:'#6366f1', bg:'rgba(99,102,241,.12)', urgente:false, acao:"navigate('requisicoes')" },
    { label:'Colaboradores',     val:d.colabAtivos.length,         icon:'users',          cor:'#22c55e', bg:'rgba(34,197,94,.12)', urgente:false, acao:"navigate('equipe')" },
    { label:'Incidentes Abertos',val:d.incidentesAbertos.length,  icon:'shield-alt',     cor:d.incidentesAbertos.length>0?'#ef4444':'#22c55e', bg:'rgba(239,68,68,.12)', urgente:d.incidentesAbertos.length>0, acao:"navigate('ssma')" },
    { label:'Eqp. Operacionais', val:d.equipamentos.filter(e=>/Operac/i.test(e.status||'')).length, icon:'cog', cor:'#22c55e', bg:'rgba(34,197,94,.12)', urgente:false, acao:"navigate('frota')" },
  ];

  const insights = [];

  const processos = [];
  d.projetosAtrasados.slice(0,3).forEach(p=>{
    processos.push({
      processo:`Projeto ${p.codigo||p.id}`, status:'Cronograma Atrasado',
      descricao:`${p.nome||p.titulo||'—'} · Término previsto: ${_mpDt(p.data_fim||p.end_date)}`,
      norma:'ISO 9001:8.5 · Contrato de Prestação de Serviços §7 (LDs) · PMBoK',
      cor:'#ef4444', corBg:'rgba(239,68,68,.1)', icon:'project-diagram', data:_mpDt(p.data_fim||p.end_date),
      acao:"navigate('projetos_gantt')", acaoLabel:'Replanejar'
    });
  });
  medicoesPend.slice(0,3).forEach(m=>{
    processos.push({
      processo:`Medição ${m.numero||m.id}`, status:'Aguardando Aprovação',
      descricao:`Contrato: ${m.contrato||'—'} · Valor: R$ ${_mpFmt(m.valor||0)}`,
      norma:'Procedimento de Medição §3 · Contrato de Prestação §9 (Faturamento)',
      cor:'#f59e0b', corBg:'rgba(245,158,11,.1)', icon:'ruler', data:_mpDt(m.data_envio||m.data_criacao),
      acao:"navigate('medicao')", acaoLabel:'Aprovar Medição'
    });
  });

  const osStatus = {};
  d.os.forEach(o=>{ const s=o.status||'—'; osStatus[s]=(osStatus[s]||0)+1; });

  const charts = [
    {
      id:'op-os', titulo:'Ordens de Serviço por Status', icon:'hard-hat', altura:210,
      type:'doughnut',
      desc:'Distribuição das OS. Monitore o volume "Em Execução" vs "Atrasada" para garantir cumprimento de prazos contratuais.',
      data: { labels:Object.keys(osStatus), datasets:[{ data:Object.values(osStatus), backgroundColor:['#22c55e','#0ea5e9','#f59e0b','#ef4444','#6366f1','#8b949e'], borderWidth:0 }] }
    },
    {
      id:'op-projetos', titulo:'Progresso dos Projetos (%)', icon:'project-diagram', altura:210,
      type:'horizontalBar',
      desc:'Percentual de conclusão por projeto. Projetos abaixo de 50% com prazo próximo precisam de aceleração ou renegociação de escopo.',
      data: {
        labels:d.projetos.slice(0,6).map(p=>(p.codigo||p.nome||p.id||'').slice(0,14)),
        datasets:[{ label:'% Concluído', data:d.projetos.slice(0,6).map(p=>p.percentual_conclusao||p.progresso||p.progress||0), backgroundColor:'rgba(0,180,184,.7)', borderRadius:4 }]
      }
    },
    {
      id:'op-medicoes', titulo:'Medições por Status', icon:'ruler', altura:210,
      type:'bar',
      desc:'Fluxo de medições e faturamento. Medições aprovadas devem ser faturadas dentro do prazo para manter fluxo de caixa.',
      data: (() => {
        const ms = {}; d.medicoes.forEach(m=>{ const s=m.status||'—'; ms[s]=(ms[s]||0)+1; });
        return { labels:Object.keys(ms), datasets:[{ label:'Medições', data:Object.values(ms), backgroundColor:['#22c55e','#f59e0b','#0ea5e9','#ef4444','#6366f1'], borderRadius:6 }] };
      })()
    },
    {
      id:'op-eqp', titulo:'Disponibilidade da Frota', icon:'truck', altura:210,
      type:'doughnut',
      desc:'Disponibilidade operacional dos equipamentos. Meta recomendada: acima de 85% de disponibilidade para garantir metas de produção.',
      data: {
        labels:['Operacional','Manutenção','Parado'],
        datasets:[{ data:[
          d.equipamentos.filter(e=>/Operac/i.test(e.status||'')).length,
          d.equipamentos.filter(e=>/Manuten/i.test(e.status||'')).length,
          d.equipamentos.filter(e=>/Parado/i.test(e.status||'')).length,
        ], backgroundColor:['#22c55e','#f59e0b','#ef4444'], borderWidth:0 }]
      }
    },
  ];

  const cards = [
    {
      titulo:'OS em Execução', icon:'hard-hat', cor:'#0ea5e9', urgente:false,
      acaoVer:"navigate('os')",
      itens:osEmExecucao.slice(0,8).map(o=>({ label:`${o.id||o.numero||'—'} – ${(o.descricao||'').slice(0,45)}`, sub:`Contrato: ${o.contrato||o.os_contrato||'—'} · ${o.status||''}`, cor:'#0ea5e9', acao:"navigate('os')" })),
    },
    {
      titulo:'Projetos com Cronograma Atrasado', icon:'project-diagram', cor:'#ef4444', urgente:d.projetosAtrasados.length>0,
      acaoVer:"navigate('projetos_gantt')",
      itens:d.projetosAtrasados.map(p=>({ label:`${p.codigo||p.id} – ${p.nome||p.titulo||'—'}`, sub:`Previsto: ${_mpDt(p.data_fim||p.end_date)} · ${p.status||''}`, cor:'#ef4444', acao:"navigate('projetos_gantt')", prazo:'ATRASADO', vencido:true })),
    },
    {
      titulo:'Medições Aguardando Aprovação', icon:'ruler', cor:'#f59e0b', urgente:medicoesPend.length>0,
      acaoVer:"navigate('medicao')",
      itens:medicoesPend.slice(0,8).map(m=>({ label:`${m.numero||m.id} – Contrato: ${m.contrato||'—'}`, sub:`Status: ${m.status||'—'}`, valor:`R$ ${_mpFmt(m.valor||0)}`, cor:'#f59e0b', acao:"navigate('medicao')" })),
    },
    {
      titulo:'Equipamentos em Manutenção', icon:'tools', cor:'#f59e0b', urgente:false,
      acaoVer:"navigate('frota')",
      itens:d.eqpManutencao.slice(0,8).map(e=>({ label:`${e.codigo||e.id} – ${e.descricao||'—'}`, sub:`${e.marca||''} ${e.modelo||''} · Próx. manut: ${_mpDt(e.proxManut)}`, cor:'#f59e0b', acao:"navigate('frota')", prazo:_mpDt(e.proxManut), vencido:e.proxManut&&new Date(e.proxManut).getTime()<Date.now() })),
    },
  ];

  return { kpis, insights, processos, charts, cards };
}

/* ── RH ──────────────────────────────────────────────────────── */
function _mpModuloRH(d) {
  const kpis = [
    { label:'Colab. Ativos',      val:d.colabAtivos.length,       icon:'users',          cor:'#22c55e', bg:'rgba(34,197,94,.12)', urgente:false, acao:"navigate('equipe')" },
    { label:'Doc. Críticos',      val:d.colabDocCritico.length,   icon:'id-card',        cor:d.colabDocCritico.length>0?'#ef4444':'#22c55e', bg:'rgba(239,68,68,.12)', urgente:d.colabDocCritico.length>0, acao:"navigate('equipe')" },
    { label:'Trein. Vencidos',    val:d.treinVencidos.length,     icon:'graduation-cap', cor:d.treinVencidos.length>0?'#f59e0b':'#22c55e', bg:'rgba(245,158,11,.12)', urgente:d.treinVencidos.length>0, acao:"navigate('treinamentos')" },
    { label:'Contratos Ativos',   val:d.contratosAtivos.length,   icon:'briefcase',      cor:'#0ea5e9', bg:'rgba(14,165,233,.12)', urgente:false, acao:"navigate('contratos')" },
    { label:'Incidentes SSMA',    val:d.incidentesAbertos.length, icon:'hard-hat',       cor:d.incidentesAbertos.length>0?'#ef4444':'#22c55e', bg:'rgba(239,68,68,.12)', urgente:d.incidentesAbertos.length>0, acao:"navigate('ssma')" },
    { label:'Total Equipe',       val:d.colaboradores.length,     icon:'user-friends',   cor:'#6366f1', bg:'rgba(99,102,241,.12)', urgente:false, acao:"navigate('equipe')" },
  ];

  const insights = [];
  const processos = [];

  d.colabDocCritico.slice(0,4).forEach(c => {
    processos.push({
      processo:`${c.nome||c.id}`, status:`Doc: ${c.docs}`,
      descricao:`Cargo: ${c.cargo||'—'} · Contrato: ${c.contrato||'—'} · Admissão: ${_mpDt(c.admissao)}`,
      norma:'CLT Art. 29 · NR-7 (ASO) · eSocial · Processo Admissional §3',
      cor:c.docs==='Crítico'?'#ef4444':'#f59e0b', corBg:c.docs==='Crítico'?'rgba(239,68,68,.1)':'rgba(245,158,11,.1)', icon:'id-card',
      data:_mpDt(c.admissao), acao:"navigate('equipe')", acaoLabel:'Regularizar'
    });
  });

  const colabContrato = {};
  d.colaboradores.forEach(c=>{ const ct=c.contrato||'Sem Contrato'; colabContrato[ct]=(colabContrato[ct]||0)+1; });

  const charts = [
    {
      id:'rh-status', titulo:'Colaboradores por Status', icon:'users', altura:210,
      type:'doughnut',
      desc:'Situação atual da força de trabalho. "Mobilizando" requer atenção para documentação admissional completa antes do início.',
      data: {
        labels:['Ativos','Mobilizando','Desmobilizados'],
        datasets:[{ data:[
          d.colaboradores.filter(c=>/^Ativo$/i.test(c.status||'')).length,
          d.colaboradores.filter(c=>/Mobiliz/i.test(c.status||'')).length,
          d.colaboradores.filter(c=>/Desmob/i.test(c.status||'')).length,
        ], backgroundColor:['#22c55e','#f59e0b','#8b949e'], borderWidth:0 }]
      }
    },
    {
      id:'rh-contrato', titulo:'Colaboradores por Contrato', icon:'briefcase', altura:210,
      type:'horizontalBar',
      desc:'Distribuição da equipe por contrato. Contratos com baixo headcount podem indicar risco de não-cumprimento do escopo previsto.',
      data: {
        labels:Object.keys(colabContrato).slice(0,6),
        datasets:[{ label:'Colaboradores', data:Object.values(colabContrato).slice(0,6), backgroundColor:'rgba(0,180,184,.7)', borderRadius:4 }]
      }
    },
    {
      id:'rh-docs', titulo:'Status de Documentação', icon:'id-card', altura:210,
      type:'doughnut',
      desc:'Qualidade do cadastro de colaboradores. Todos devem ter documentação "OK" antes da mobilização para campo.',
      data: (() => {
        const ds = {};
        d.colaboradores.forEach(c=>{ const s=c.docs||'—'; ds[s]=(ds[s]||0)+1; });
        return { labels:Object.keys(ds), datasets:[{ data:Object.values(ds), backgroundColor:['#22c55e','#f59e0b','#ef4444','#8b949e'], borderWidth:0 }] };
      })()
    },
  ];

  const cards = [
    {
      titulo:'Colaboradores com Doc. Crítica', icon:'id-card', cor:'#ef4444', urgente:d.colabDocCritico.length>0,
      acaoVer:"navigate('equipe')",
      itens:d.colabDocCritico.map(c=>({ label:`${c.nome||c.id} – ${c.cargo||'—'}`, sub:`Docs: ${c.docs} · Contrato: ${c.contrato||'—'}`, cor:c.docs==='Crítico'?'#ef4444':'#f59e0b', acao:"navigate('equipe')" })),
    },
    {
      titulo:'Treinamentos Vencidos', icon:'graduation-cap', cor:'#f59e0b', urgente:d.treinVencidos.length>0,
      acaoVer:"navigate('treinamentos')",
      itens:d.treinVencidos.slice(0,8).map(t=>({ label:`${t.colaborador||t.nome||'—'} – ${t.curso||t.treinamento||'—'}`, sub:`Venceu: ${_mpDt(t.validade||t.data_validade)}`, cor:'#f59e0b', acao:"navigate('treinamentos')", prazo:_mpDt(t.validade||t.data_validade), vencido:true })),
    },
  ];

  return { kpis, insights, processos, charts, cards };
}

/* ── VISÃO GERAL (fallback) ──────────────────────────────────── */
function _mpModuloGeral(d) {
  return _mpModuloGerente(d);
}

/* ── HELPERS DE DADOS PARA GRÁFICOS ─────────────────────────── */
function _mpValorPorMes(pedidos) {
  const meses = _mpUltimosMeses(6);
  const vals  = meses.map(([y,m]) => pedidos.filter(p=>{
    const dt=p.data_emissao||p.data_criacao; if(!dt) return false;
    const d=new Date(dt); return d.getFullYear()===y&&d.getMonth()===m;
  }).reduce((s,p)=>s+(p.valor_total||0),0));
  return {
    labels: meses.map(([y,m])=>_mpMesLabel(y,m)),
    datasets:[{ label:'Valor Emitido (R$)', data:vals, backgroundColor:'rgba(0,180,184,.7)', borderRadius:6 }]
  };
}

function _mpVencimentosPorMes(contas) {
  const meses = _mpUltimosMeses(6);
  const pagas = meses.map(([y,m]) => contas.filter(c=>{
    const dt=c.data_pagamento||c.data_vencimento; if(!dt||!/Paga/i.test(c.status||'')) return false;
    const d=new Date(dt); return d.getFullYear()===y&&d.getMonth()===m;
  }).reduce((s,c)=>s+(c.valor||c.valor_total||0),0));
  const abertas = meses.map(([y,m]) => contas.filter(c=>{
    const dt=c.data_vencimento||c.vencimento; if(!dt||/Paga|Cancelada/i.test(c.status||'')) return false;
    const d=new Date(dt); return d.getFullYear()===y&&d.getMonth()===m;
  }).reduce((s,c)=>s+(c.valor||c.valor_total||0),0));
  return {
    labels: meses.map(([y,m])=>_mpMesLabel(y,m)),
    datasets:[
      { label:'Pagas (R$)',  data:pagas,  backgroundColor:'rgba(34,197,94,.7)',  borderRadius:4 },
      { label:'A Pagar (R$)',data:abertas,backgroundColor:'rgba(239,68,68,.7)',  borderRadius:4 },
    ]
  };
}

function _mpReceitaCusto(d) {
  const cs = d.contratos.slice(0,5);
  return {
    labels: cs.map(c=>(c.numero||c.id||'').slice(0,10)),
    datasets:[
      { label:'Valor Contratado (R$)', data:cs.map(c=>c.valor||0),         backgroundColor:'rgba(0,180,184,.7)',  borderRadius:4 },
      { label:'Medido Acum. (R$)',     data:cs.map(c=>c.medidoAcum||0),    backgroundColor:'rgba(99,102,241,.7)', borderRadius:4 },
    ]
  };
}

function _mpTopFornecedores(pedidos) {
  const forn = {};
  pedidos.forEach(p => {
    const nome = p.fornecedor_nome||p.fornecedor||'—';
    if (nome==='—') return;
    forn[nome] = (forn[nome]||0) + (p.valor_total||0);
  });
  const sorted = Object.entries(forn).sort((a,b)=>b[1]-a[1]).slice(0,6);
  return {
    labels: sorted.map(([n])=>n.slice(0,18)),
    datasets:[{ label:'Volume (R$)', data:sorted.map(([,v])=>v), backgroundColor:'rgba(99,102,241,.7)', borderRadius:4 }]
  };
}

function _mpIncidentesPorMes(incidentes) {
  const meses = _mpUltimosMeses(6);
  const vals  = meses.map(([y,m]) => incidentes.filter(i=>{
    const dt=i.data||i.data_ocorrencia; if(!dt) return false;
    const d=new Date(dt); return d.getFullYear()===y&&d.getMonth()===m;
  }).length);
  return {
    labels: meses.map(([y,m])=>_mpMesLabel(y,m)),
    datasets:[{ label:'Incidentes', data:vals, backgroundColor:'rgba(239,68,68,.7)', borderRadius:6 }]
  };
}

function _mpUltimosMeses(n) {
  const res=[]; const now=new Date();
  for(let i=n-1;i>=0;i--){
    const d=new Date(now.getFullYear(),now.getMonth()-i,1);
    res.push([d.getFullYear(),d.getMonth()]);
  }
  return res;
}

function _mpMesLabel(y,m) {
  return ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][m]+'/'+String(y).slice(2);
}

function _mpFornSemAval(d) {
  const seisMeses = Date.now()-180*86400000;
  const umAno     = Date.now()-365*86400000;
  const recentes  = new Set(d.pedidos.filter(p=>p.data_emissao&&new Date(p.data_emissao).getTime()>seisMeses).map(p=>p.fornecedor_id||p.fornecedor).filter(Boolean));
  const avaliados = new Set(d.avaliacoes.filter(a=>a.data&&new Date(a.data).getTime()>umAno).map(a=>a.fornecedor_id||a.id_fornecedor||a.id));
  return [...recentes].filter(id=>!avaliados.has(id)).length;
}

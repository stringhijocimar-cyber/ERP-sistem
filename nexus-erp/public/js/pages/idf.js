// =====================================================
// Fraser Alexander ERP – IDF: Índice de Desenvolvimento de Fornecedores
// Baseado no documento IDF_Fraser_Alexander_Codigo_Completo
// Critérios completos: Geral(80%) + Serviço(20%) + Equipamento(20%) + Material(20%)
// =====================================================

// ─── STORAGE HELPERS ───
function _getIDF()      { try { return JSON.parse(localStorage.getItem('fa_idf_avaliacoes') || '[]'); } catch(e) { return []; } }
function _saveIDF(d)    { localStorage.setItem('fa_idf_avaliacoes', JSON.stringify(d)); }
function _getIDFConfig(){ try { return JSON.parse(localStorage.getItem('fa_idf_config') || 'null'); } catch(e) { return null; } }
function _saveIDFConfig(d){ localStorage.setItem('fa_idf_config', JSON.stringify(d)); }

// ─── CARREGA FORNECEDORES DA API D1 E ATUALIZA CACHE LOCAL ───────────────────
async function _idfCarregarFornecedoresAPI() {
  try {
    const token = sessionStorage.getItem('fa_token') || localStorage.getItem('fa_token') || '';
    const res = await fetch('/api/fornecedores?ativo=todos', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) return;
    const json = await res.json();
    if (!json.success || !Array.isArray(json.data)) return;

    // Normaliza para o formato interno (igual _normalizarFornecedor em fornecedores.js)
    const normalizados = json.data.map(f => ({
      id:               f.id,
      razao_social:     f.razao_social || f.nome || '',
      nome_fantasia:    f.nome || f.razao_social || '',
      nome:             f.nome || f.razao_social || '',
      cnpj:             f.cnpj || '',
      categoria:        f.categoria || 'Outros',
      contato_nome:     f.contato_nome || '',
      contato_email:    f.email || f.contato_email || '',
      contato_telefone: f.telefone || f.contato_telefone || '',
      cidade:           f.cidade || '',
      estado:           f.estado || '',
      status:           f.status || (f.ativo ? 'Ativo' : 'Em Homologação'),
      prazo_pagamento:  f.prazo_pagamento != null ? Number(f.prazo_pagamento) : 30,
      limite_credito:   f.limite_credito  != null ? Number(f.limite_credito)  : 0,
      avaliacao:        f.score_medio || 0,
      idf_score:        f.score_idf   || 0,
      total_pedidos:    f.total_pedidos || 0,
      total_gasto:      f.total_gasto   || 0,
      documentos_ok:    f.documentos_ok !== undefined ? Boolean(f.documentos_ok) : true,
    }));

    // Atualiza cache local e variável global
    localStorage.setItem('fa_fornecedores_cache', JSON.stringify(normalizados));
    localStorage.setItem('fraser_fornecedores',   JSON.stringify(normalizados));
    if (typeof FA_FORNECEDORES !== 'undefined') {
      FA_FORNECEDORES.length = 0;
      normalizados.forEach(f => FA_FORNECEDORES.push(f));
    }
  } catch(e) {
    // Fallback silencioso – usa localStorage existente
  }
}

// ─── HELPER: garante lista atualizada de fornecedores (API D1 + fallback cache) ─
// Sempre busca da API para garantir que fornecedores recém-cadastrados apareçam.
async function _idfGetFornecedoresAtualizados() {
  // Se FA_FORNECEDORES estiver desatualizado (sem dados ou com poucos), busca da API
  const cacheAge = parseInt(sessionStorage.getItem('_idf_forn_cache_ts') || '0');
  const agora = Date.now();
  const CACHE_TTL = 30 * 1000; // 30 segundos – evita múltiplas chamadas em sequência rápida

  if (agora - cacheAge > CACHE_TTL) {
    await _idfCarregarFornecedoresAPI();
    sessionStorage.setItem('_idf_forn_cache_ts', String(agora));
  }

  // Retorna sempre a lista mais completa disponível
  if (typeof FA_FORNECEDORES !== 'undefined' && FA_FORNECEDORES.length > 0) {
    return FA_FORNECEDORES;
  }
  try {
    return JSON.parse(localStorage.getItem('fa_fornecedores_cache') || '[]');
  } catch(e) { return []; }
}

// Força recarga imediata (ignora cache TTL) – usado após cadastrar novo fornecedor
function _idfInvalidarCacheFornecedores() {
  sessionStorage.removeItem('_idf_forn_cache_ts');
}

// ─── SINCRONIZAÇÃO BIDIRECIONAL FORNECEDORES ↔ IDF ───────────────────────────
// Chamada automaticamente ao salvar uma avaliação IDF ou ao renderizar o módulo.
// Garante que:
//   1) Todo fornecedor com avaliação IDF tem seu idf_score atualizado na lista
//   2) Todo IDF que referencie um fornecedor inexistente cria o registro básico
function _syncFornecedoresIDF() {
  try {
    const fors  = JSON.parse(localStorage.getItem('fa_fornecedores_cache') || '[]');
    const idfs  = _getIDF();
    let changed = false;

    // 1) Atualiza idf_score de cada fornecedor com a avaliação mais recente
    fors.forEach(f => {
      const evals = idfs.filter(i => i.fornecedor_id === f.id || i.fornecedor === f.razao_social);
      if (!evals.length) return;
      const latest = evals.sort((a, b) => (b.data || '').localeCompare(a.data || ''))[0];
      const newScore = typeof latest.score === 'number' ? latest.score : parseFloat(latest.score) || 0;
      if (f.idf_score !== newScore) {
        f.idf_score = newScore;
        f.avaliacao_geral = newScore >= 90 ? 'A' : newScore >= 70 ? 'B' : newScore >= 50 ? 'C' : 'D';
        // Garante que fornecedor_id fica salvo no IDF para futuros lookups
        evals.forEach(e => { if (!e.fornecedor_id) e.fornecedor_id = f.id; });
        changed = true;
      }
    });

    // 2) IDF referencia fornecedor inexistente → cria entrada básica
    idfs.forEach(idf => {
      const fid = idf.fornecedor_id;
      if (fid && !fors.find(f => f.id === fid)) {
        const sc = typeof idf.score === 'number' ? idf.score : 0;
        fors.push({
          id: fid,
          razao_social: idf.fornecedor || fid,
          nome_fantasia: idf.fornecedor || fid,
          cnpj: '00.000.000/0001-00',
          categoria: 'Não informado',
          status: 'Ativo',
          contato: '', telefone: '', email: '',
          cidade: '', estado: '',
          idf_score: sc,
          homologado: sc >= 70,
          prazo_entrega: 0,
          avaliacao_geral: sc >= 90 ? 'A' : sc >= 70 ? 'B' : sc >= 50 ? 'C' : 'D',
          limite_credito: 0,
          condicao_pagamento: 'A definir',
          banco: '', agencia: '', conta: '',
          tipo: 'Não informado',
          categoria_fiscal: 'PJ Nacional',
          inscricao_estadual: 'Isento'
        });
        changed = true;
      }
    });

    if (changed) {
      localStorage.setItem('fa_fornecedores_cache', JSON.stringify(fors));
      localStorage.setItem('fraser_fornecedores', JSON.stringify(fors));
      // Atualiza também a variável global em memória se existir
      if (typeof FA_FORNECEDORES !== 'undefined') {
        FA_FORNECEDORES.length = 0;
        fors.forEach(f => FA_FORNECEDORES.push(f));
      }
    }
    return { total_fors: fors.length, total_idfs: idfs.length, changed };
  } catch(e) {
    console.warn('[IDF SYNC] Erro:', e);
    return { error: e.message };
  }
}

// ─── CRITÉRIOS DE AVALIAÇÃO (conforme IDF Fraser Alexander) ───
const IDF_CRITERIA = {
  // GERAL (80% total = 5 critérios)
  gen_0: { id:'gen_0', name:'Pontualidade',           weight:20, group:'Geral',       desc:'% de entregas/serviços realizados no prazo acordado. Escala 1-5: 1=<60%, 2=60-74%, 3=75-84%, 4=85-94%, 5=≥95%' },
  gen_1: { id:'gen_1', name:'Qualidade/Conformidade', weight:20, group:'Geral',       desc:'% de itens/serviços sem não-conformidades. Escala 1-5: 1=<60%, 2=60-74%, 3=75-84%, 4=85-94%, 5=≥95%' },
  gen_2: { id:'gen_2', name:'Competitividade',        weight:15, group:'Geral',       desc:'% de respostas a cotações e competitividade de preço. Escala 1-5: 1=Muito acima mercado, 5=Melhor preço' },
  gen_3: { id:'gen_3', name:'Sustentabilidade/ESG',   weight:15, group:'Geral',       desc:'Presença de certificações ambientais, práticas ESG. Escala 1-5: 1=Nenhuma prática, 5=Certificado ISO 14001+' },
  gen_4: { id:'gen_4', name:'Capacidade Financeira',  weight:10, group:'Geral',       desc:'Saúde financeira: balanços, certidões negativas, capital de giro. Escala 1-5: 1=Alto risco, 5=Excelente saúde financeira' },
  // SERVIÇO (20%)
  serv_0: { id:'serv_0', name:'SSMA',                          weight:4, group:'Serviço',      desc:'Segurança, Saúde e Meio Ambiente: conformidade com normas NR, uso de EPI. Escala 1-5: 1=Não conformidade crítica, 5=Zero incidentes, certificado' },
  serv_1: { id:'serv_1', name:'Resposta a Emergências',        weight:4, group:'Serviço',      desc:'Tempo e eficácia de resposta a chamados emergenciais. Escala 1-5: 1=>24h sem plano, 5=<2h com plano estruturado' },
  serv_2: { id:'serv_2', name:'Qualidade na Execução',         weight:4, group:'Serviço',      desc:'Qualidade técnica na execução dos serviços contratados. Escala 1-5: 1=Retrabalho frequente, 5=Execução perfeita na 1ª vez' },
  serv_3: { id:'serv_3', name:'Experiência em Projetos Similares', weight:4, group:'Serviço', desc:'Histórico comprovado em projetos de escopo similar. Escala 1-5: 1=Sem experiência, 5=>10 projetos similares' },
  serv_4: { id:'serv_4', name:'Escalabilidade',                weight:4, group:'Serviço',      desc:'Capacidade de ampliar equipe/recursos sem perda de qualidade. Escala 1-5: 1=Sem capacidade, 5=Escalabilidade total comprovada' },
  // EQUIPAMENTO (20%)
  equip_0: { id:'equip_0', name:'Disponibilidade de Peças',       weight:4, group:'Equipamento', desc:'Estoque local e prazo de entrega de peças de reposição. Escala 1-5: 1=>30 dias, 5=Peças em estoque local' },
  equip_1: { id:'equip_1', name:'Garantia e Suporte Técnico',     weight:4, group:'Equipamento', desc:'Cobertura de garantia e qualidade do suporte técnico pós-venda. Escala 1-5: 1=Sem garantia, 5=Garantia estendida + suporte 24/7' },
  equip_2: { id:'equip_2', name:'Eficiência Operacional',         weight:4, group:'Equipamento', desc:'Desempenho do equipamento em condições reais de operação. Escala 1-5: 1=<70% eficiência nominal, 5=≥95% eficiência nominal' },
  equip_3: { id:'equip_3', name:'Custo Total de Propriedade',     weight:4, group:'Equipamento', desc:'TCO: custo de aquisição + manutenção + operação ao longo do ciclo de vida. Escala 1-5: 1=Alto TCO, 5=Menor TCO do mercado' },
  equip_4: { id:'equip_4', name:'Flexibilidade e Personalização', weight:4, group:'Equipamento', desc:'Capacidade de adaptar o equipamento às necessidades específicas. Escala 1-5: 1=Produto padrão sem adaptação, 5=Totalmente personalizável' },
  // MATERIAL (20%)
  mat_0: { id:'mat_0', name:'Especificações Técnicas',              weight:4, group:'Material', desc:'Conformidade do material com as especificações técnicas exigidas. Escala 1-5: 1=Não atende, 5=Supera todas as especificações' },
  mat_1: { id:'mat_1', name:'Certificação de Qualidade',            weight:4, group:'Material', desc:'Possuir certificações ISO, INMETRO ou equivalentes. Escala 1-5: 1=Sem certificação, 5=Múltiplas certificações reconhecidas' },
  mat_2: { id:'mat_2', name:'Sustentabilidade Transporte/Embalagem',weight:4, group:'Material', desc:'Práticas sustentáveis em embalagem e logística. Escala 1-5: 1=Embalagem excessiva sem reciclagem, 5=100% sustentável' },
  mat_3: { id:'mat_3', name:'Prazo de Entrega',                     weight:4, group:'Material', desc:'Cumprimento do prazo acordado para entrega dos materiais. Escala 1-5: 1=>5 dias atraso, 5=Entrega antecipada/no prazo sempre' },
  mat_4: { id:'mat_4', name:'Garantia e Suporte',                   weight:4, group:'Material', desc:'Política de garantia, troca e suporte ao produto. Escala 1-5: 1=Sem garantia, 5=Garantia completa com suporte dedicado' }
};

// Tipos de fornecedor: 1=Serviço, 2=Equipamento, 3=Material, 4=Todas
const IDF_TIPOS = { 1:'Serviço', 2:'Equipamento', 3:'Material', 4:'Todas' };
// Categorias
const IDF_CATEGORIAS = { 1:'Crítico', 2:'Estratégico', 3:'Comum', 4:'Spot' };

// ─── CÁLCULO DE PONTUAÇÃO IDF ───
function _idfCalcScore(scores, tipo) {
  // scores = { gen_0:val, gen_1:val, ..., serv_0:val, ... }
  // Geral: cada critério contribui (val/5)*peso
  let genScore = 0;
  ['gen_0','gen_1','gen_2','gen_3','gen_4'].forEach(k => {
    const v = parseInt(scores[k]) || 0;
    if (v > 0) genScore += (v / 5) * IDF_CRITERIA[k].weight;
  });

  // Específicos: (soma dos pontos / soma das máximas) * 20
  const specGroups = {
    1: ['serv_0','serv_1','serv_2','serv_3','serv_4'],
    2: ['equip_0','equip_1','equip_2','equip_3','equip_4'],
    3: ['mat_0','mat_1','mat_2','mat_3','mat_4'],
    4: ['serv_0','serv_1','serv_2','serv_3','serv_4','equip_0','equip_1','equip_2','equip_3','equip_4','mat_0','mat_1','mat_2','mat_3','mat_4']
  };

  const group = specGroups[tipo] || [];
  let specScore = 0, specMax = 0;
  group.forEach(k => {
    const v = parseInt(scores[k]) || 0;
    if (v > 0) { specScore += v; specMax += 5; }
  });

  const specComp = specMax > 0 ? (specScore / specMax) * 20 : 0;
  const total = Math.round((genScore + specComp) * 10) / 10;
  return total;
}

// Classificação IDF
function _idfClassificacao(nota) {
  if (nota >= 80) return { label: 'Homologado Nível A', color: '#16a34a', bg: '#dcfce7', icon: 'fa-star' };
  if (nota >= 60) return { label: 'Homologado Nível B', color: '#2563eb', bg: '#dbeafe', icon: 'fa-thumbs-up' };
  if (nota >= 40) return { label: 'Em Desenvolvimento', color: '#d97706', bg: '#fef3c7', icon: 'fa-tools' };
  return { label: 'Crítico / Suspender', color: '#dc2626', bg: '#fee2e2', icon: 'fa-exclamation-triangle' };
}

// Recomendações para notas baixas
function _idfRecomendacao(criterioKey, nota) {
  if (nota >= 4) return '';
  const recs = {
    gen_0: 'Implementar monitoramento de prazos e SLA formal.',
    gen_1: 'Exigir plano de ação para redução de não-conformidades.',
    gen_2: 'Solicitar histórico de cotações; negociar melhores condições.',
    gen_3: 'Requerer política ESG e certificação ambiental.',
    gen_4: 'Solicitar balanços e certidões negativas atualizadas.',
    serv_0: 'Exigir treinamento NR e DDS periódicos; auditar EPI.',
    serv_1: 'Estabelecer plano de atendimento emergencial com SLA.',
    serv_2: 'Aplicar check-list de qualidade pós-execução.',
    serv_3: 'Solicitar portfólio comprovado de projetos similares.',
    serv_4: 'Avaliar capacidade de banco de mão-de-obra e subcontratação.',
    equip_0: 'Exigir estoque mínimo de peças críticas no contrato.',
    equip_1: 'Negociar extensão de garantia e SLA de suporte técnico.',
    equip_2: 'Realizar teste de desempenho em campo antes de homologação.',
    equip_3: 'Comparar TCO total com concorrentes; negociar manutenção inclusa.',
    equip_4: 'Verificar capacidade de customização e adaptação técnica.',
    mat_0: 'Realizar ensaios de conformidade técnica com laudos.',
    mat_1: 'Exigir certificados ISO/INMETRO válidos; auditar rastreabilidade.',
    mat_2: 'Requerer política de embalagem sustentável e logística reversa.',
    mat_3: 'Monitorar OTD (On-Time Delivery); aplicar penalidades contratuais.',
    mat_4: 'Formalizar política de garantia e assistência técnica.'
  };
  return recs[criterioKey] || '';
}

// ─── RENDER PRINCIPAL ───
async function renderIDF() {
  const isGestor = currentUser && ['admin','compras','diretor','operacao','supervisor'].includes(currentUser.profile);
  if (!isGestor) {
    document.getElementById('mainContent').innerHTML = `<div class="empty-state"><i class="fas fa-lock"></i><p>Acesso restrito.</p></div>`;
    return;
  }

  // ── Garante fornecedores atualizados do D1 antes de renderizar ──
  await _idfCarregarFornecedoresAPI();

  // Sincroniza listas de Fornecedores e IDF antes de renderizar
  _syncFornecedoresIDF();

  const idfList = _getIDF();
  const total = idfList.length;
  const nivA = idfList.filter(i => (i.score||0) >= 80).length;
  const nivB = idfList.filter(i => (i.score||0) >= 60 && (i.score||0) < 80).length;
  const emDes = idfList.filter(i => (i.score||0) >= 40 && (i.score||0) < 60).length;
  const critico = idfList.filter(i => (i.score||0) < 40 && (i.score||0) > 0).length;
  const mediaScore = total ? (idfList.reduce((s,i) => s + (i.score||0), 0) / total).toFixed(1) : '—';

  // Calcula fornecedores não avaliados
  let fornAll = [];
  try {
    if (typeof FA_FORNECEDORES !== 'undefined' && FA_FORNECEDORES.length > 0) {
      fornAll = FA_FORNECEDORES;
    } else {
      fornAll = JSON.parse(localStorage.getItem('fa_fornecedores_cache') || '[]');
    }
  } catch(e) {}
  const fornAtivos = fornAll.filter(f => f.status !== 'Inativo' && f.status !== 'Bloqueado' && f.status !== 'Suspenso');
  const fornAvaliados = new Set(idfList.map(i => i.fornecedor_id || i.fornecedor));
  const fornNaoAvaliados = fornAtivos.filter(f => !fornAvaliados.has(f.id) && !fornAvaliados.has(f.razao_social));
  const qtdNaoAval = fornNaoAvaliados.length;

  document.getElementById('mainContent').innerHTML = `
    <div class="page-header">
      <div class="page-title">
        <h2><i class="fas fa-chart-bar" style="color:#2563eb;margin-right:8px"></i>IDF – Índice de Desenvolvimento de Fornecedores</h2>
        <p>Avaliação completa de desempenho por critérios Geral, Serviço, Equipamento e Material</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary btn-sm" onclick="idfExportarExcel()"><i class="fas fa-file-excel"></i> Excel</button>
        <button class="btn btn-secondary btn-sm" onclick="idfGerarRelatorio()"><i class="fas fa-file-pdf"></i> Relatório PDF</button>
        <button class="btn btn-primary btn-sm" onclick="idfNovaAvaliacao()"><i class="fas fa-plus"></i> Nova Avaliação IDF</button>
      </div>
    </div>

    ${qtdNaoAval > 0 ? `
    <!-- Alerta fornecedores não avaliados -->
    <div style="background:linear-gradient(135deg,#fffbeb,#fef3c7);border:1px solid #fcd34d;border-radius:10px;padding:12px 18px;margin-bottom:16px;display:flex;align-items:center;gap:14px;cursor:pointer" onclick="idfSwitchTab('idf-tab-nao-aval')">
      <div style="width:42px;height:42px;background:#f59e0b;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <i class="fas fa-exclamation-triangle" style="color:#fff;font-size:18px"></i>
      </div>
      <div style="flex:1">
        <div style="font-weight:700;color:#92400e;font-size:14px"><span style="background:#ef4444;color:#fff;border-radius:12px;padding:2px 8px;font-size:12px;margin-right:8px">${qtdNaoAval}</span>fornecedor(es) ainda não avaliados</div>
        <div style="font-size:12px;color:#b45309;margin-top:2px">
          ${fornNaoAvaliados.slice(0,4).map(f => f.razao_social).join(', ')}${qtdNaoAval > 4 ? ` e mais ${qtdNaoAval-4}...` : ''}
        </div>
      </div>
      <button onclick="event.stopPropagation();idfNovaAvaliacao()" class="btn btn-sm" style="background:#f59e0b;color:#fff;border:none;padding:6px 14px;border-radius:8px;font-size:12px;white-space:nowrap">
        <i class="fas fa-plus"></i> Avaliar Agora
      </button>
    </div>` : `
    <div style="background:linear-gradient(135deg,#f0fdf4,#dcfce7);border:1px solid #86efac;border-radius:10px;padding:10px 18px;margin-bottom:16px;display:flex;align-items:center;gap:10px">
      <i class="fas fa-check-circle" style="color:#16a34a;font-size:20px"></i>
      <span style="color:#166534;font-weight:600;font-size:13px">Todos os fornecedores ativos estão avaliados no IDF!</span>
    </div>`}

    <!-- KPIs -->
    <div class="kpi-grid" style="grid-template-columns:repeat(6,1fr);margin-bottom:20px">
      <div class="kpi-card kpi-blue">
        <div class="kpi-icon"><i class="fas fa-building"></i></div>
        <div class="kpi-value">${total}</div>
        <div class="kpi-label">Avaliações IDF</div>
      </div>
      <div class="kpi-card kpi-blue">
        <div class="kpi-icon"><i class="fas fa-chart-line"></i></div>
        <div class="kpi-value">${mediaScore}</div>
        <div class="kpi-label">Score Médio</div>
      </div>
      <div class="kpi-card" style="border-left:4px solid #16a34a;background:var(--bg-primary)">
        <div class="kpi-icon" style="color:#16a34a"><i class="fas fa-star"></i></div>
        <div class="kpi-value" style="color:#16a34a">${nivA}</div>
        <div class="kpi-label">Nível A (≥80)</div>
      </div>
      <div class="kpi-card" style="border-left:4px solid #2563eb;background:var(--bg-primary)">
        <div class="kpi-icon" style="color:#2563eb"><i class="fas fa-thumbs-up"></i></div>
        <div class="kpi-value" style="color:#2563eb">${nivB}</div>
        <div class="kpi-label">Nível B (60-79)</div>
      </div>
      <div class="kpi-card" style="border-left:4px solid #d97706;background:var(--bg-primary)">
        <div class="kpi-icon" style="color:#d97706"><i class="fas fa-tools"></i></div>
        <div class="kpi-value" style="color:#d97706">${emDes}</div>
        <div class="kpi-label">Em Desenvolvimento</div>
      </div>
      <div class="kpi-card" style="border-left:4px solid #dc2626;background:var(--bg-primary)">
        <div class="kpi-icon" style="color:#dc2626"><i class="fas fa-exclamation-triangle"></i></div>
        <div class="kpi-value" style="color:#dc2626">${critico}</div>
        <div class="kpi-label">Crítico (&lt;40)</div>
      </div>
    </div>

    <!-- Tabs IDF -->
    <div style="display:flex;gap:4px;margin-bottom:16px;border-bottom:2px solid var(--border-color);padding-bottom:0;flex-wrap:wrap">
      <button id="idf-tab-lista-btn" onclick="idfSwitchTab('idf-tab-lista')"
        style="padding:10px 18px;border:none;cursor:pointer;font-size:13px;font-weight:600;border-bottom:3px solid #2563eb;color:#2563eb;background:transparent;display:flex;align-items:center;gap:6px;transition:all 0.2s">
        <i class="fas fa-list"></i>Avaliações
      </button>
      <button id="idf-tab-consolidado-btn" onclick="idfSwitchTab('idf-tab-consolidado')"
        style="padding:10px 18px;border:none;cursor:pointer;font-size:13px;font-weight:600;border-bottom:3px solid transparent;color:var(--text-secondary);background:transparent;display:flex;align-items:center;gap:6px;transition:all 0.2s">
        <i class="fas fa-table"></i>Consolidado
      </button>
      <button id="idf-tab-ranking-btn" onclick="idfSwitchTab('idf-tab-ranking')"
        style="padding:10px 18px;border:none;cursor:pointer;font-size:13px;font-weight:600;border-bottom:3px solid transparent;color:var(--text-secondary);background:transparent;display:flex;align-items:center;gap:6px;transition:all 0.2s">
        <i class="fas fa-trophy"></i>Ranking
      </button>
      <button id="idf-tab-nao-aval-btn" onclick="idfSwitchTab('idf-tab-nao-aval')"
        style="padding:10px 18px;border:none;cursor:pointer;font-size:13px;font-weight:600;border-bottom:3px solid transparent;color:var(--text-secondary);background:transparent;display:flex;align-items:center;gap:6px;transition:all 0.2s">
        <i class="fas fa-clock"></i>Não Avaliados
        ${qtdNaoAval > 0 ? `<span style="background:#ef4444;color:#fff;border-radius:10px;padding:1px 7px;font-size:11px">${qtdNaoAval}</span>` : ''}
      </button>
    </div>

    <div id="idf-tab-lista" class="idf-tab-content">
      ${_idfRenderLista(idfList)}
    </div>
    <div id="idf-tab-consolidado" class="idf-tab-content" style="display:none">
      ${_idfRenderConsolidado(idfList)}
    </div>
    <div id="idf-tab-ranking" class="idf-tab-content" style="display:none">
      ${_idfRenderRanking(idfList)}
    </div>
    <div id="idf-tab-nao-aval" class="idf-tab-content" style="display:none">
      ${_idfRenderNaoAvaliados(fornNaoAvaliados)}
    </div>
  `;
}

function idfSwitchTab(tabId) {
  document.querySelectorAll('.idf-tab-content').forEach(el => el.style.display = 'none');
  const el = document.getElementById(tabId);
  if (el) el.style.display = 'block';
  // Update button styles
  ['idf-tab-lista','idf-tab-consolidado','idf-tab-ranking','idf-tab-nao-aval'].forEach(id => {
    const btn = document.getElementById(id+'-btn');
    if (!btn) return;
    if (id === tabId) {
      btn.style.borderBottom = '3px solid #2563eb';
      btn.style.color = '#2563eb';
    } else {
      btn.style.borderBottom = '3px solid transparent';
      btn.style.color = 'var(--text-secondary)';
    }
  });
}

// ─── TAB LISTA DE AVALIAÇÕES ───
function _idfRenderLista(idfList) {
  if (!idfList.length) return `
    <div class="card" style="text-align:center;padding:48px">
      <i class="fas fa-clipboard-list" style="font-size:48px;color:var(--text-muted);margin-bottom:16px"></i>
      <div style="font-size:16px;font-weight:600;color:var(--text-secondary)">Nenhuma avaliação IDF registrada</div>
      <div style="font-size:13px;color:var(--text-muted);margin-top:8px">Clique em "Nova Avaliação IDF" para começar</div>
    </div>`;

  return `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">
        <div style="font-size:14px;font-weight:600;color:var(--text-primary)">${idfList.length} avaliações registradas</div>
        <div style="display:flex;gap:8px;align-items:center">
          <select onchange="_idfFiltrarLista(this.value)" style="padding:7px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px">
            <option value="">Todos os tipos</option>
            <option value="1">Serviço</option>
            <option value="2">Equipamento</option>
            <option value="3">Material</option>
            <option value="4">Todas</option>
          </select>
          <input type="text" id="idf-busca" placeholder="Buscar fornecedor..." oninput="_idfFiltrarBusca(this.value)"
            style="padding:7px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px">
        </div>
      </div>
      <div id="idf-lista-body" style="overflow-x:auto">
        ${_idfTabelaLista(idfList)}
      </div>
    </div>`;
}

function _idfTabelaLista(idfList) {
  if (!idfList.length) return `<div style="text-align:center;padding:30px;color:var(--text-muted)">Nenhum resultado encontrado.</div>`;
  return `
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead>
        <tr style="background:var(--bg-tertiary)">
          <th style="padding:9px 12px;text-align:left;color:var(--text-secondary);font-size:11px;text-transform:uppercase">Fornecedor</th>
          <th style="padding:9px 12px;text-align:center;color:var(--text-secondary);font-size:11px;text-transform:uppercase">Tipo</th>
          <th style="padding:9px 12px;text-align:center;color:var(--text-secondary);font-size:11px;text-transform:uppercase">Score IDF</th>
          <th style="padding:9px 12px;text-align:center;color:var(--text-secondary);font-size:11px;text-transform:uppercase">Classificação</th>
          <th style="padding:9px 12px;text-align:center;color:var(--text-secondary);font-size:11px;text-transform:uppercase">Avaliador</th>
          <th style="padding:9px 12px;text-align:center;color:var(--text-secondary);font-size:11px;text-transform:uppercase">Data</th>
          <th style="padding:9px 12px;text-align:center;color:var(--text-secondary);font-size:11px;text-transform:uppercase">Ações</th>
        </tr>
      </thead>
      <tbody>
        ${idfList.map(item => {
          const cls = _idfClassificacao(item.score || 0);
          return `
          <tr style="border-bottom:1px solid var(--border-color);transition:background 0.15s" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background=''">
            <td style="padding:10px 12px;font-weight:600;color:var(--text-primary)">${item.fornecedor}</td>
            <td style="padding:10px 12px;text-align:center">
              <span style="padding:3px 8px;border-radius:12px;font-size:11px;font-weight:600;background:${
                item.tipo==1?'#dbeafe':item.tipo==2?'#fef3c7':item.tipo==3?'#dcfce7':'#f3e8ff'};
                color:${item.tipo==1?'#1d4ed8':item.tipo==2?'#92400e':item.tipo==3?'#166534':'#7c3aed'}">
                ${IDF_TIPOS[item.tipo]||'—'}
              </span>
            </td>
            <td style="padding:10px 12px;text-align:center">
              <div style="display:flex;align-items:center;justify-content:center;gap:8px">
                <div style="width:80px;height:8px;background:var(--bg-tertiary);border-radius:4px;overflow:hidden">
                  <div style="height:100%;border-radius:4px;background:${cls.color};width:${Math.min(item.score||0,100)}%"></div>
                </div>
                <span style="font-weight:700;font-size:14px;color:${cls.color}">${(item.score||0).toFixed(1)}</span>
              </div>
            </td>
            <td style="padding:10px 12px;text-align:center">
              <span style="padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;background:${cls.bg};color:${cls.color}">
                <i class="fas ${cls.icon}" style="margin-right:4px"></i>${cls.label}
              </span>
            </td>
            <td style="padding:10px 12px;text-align:center;color:var(--text-secondary);font-size:12px">${item.avaliador||'—'}</td>
            <td style="padding:10px 12px;text-align:center;color:var(--text-secondary);font-size:12px">${item.data||'—'}</td>
            <td style="padding:10px 12px;text-align:center">
              <button onclick="idfVerDetalhe('${item.id}')" class="btn btn-secondary" style="padding:4px 10px;font-size:11px;margin-right:4px">
                <i class="fas fa-eye"></i> Ver
              </button>
              <button onclick="idfGerarPDF('${item.id}')" class="btn btn-secondary" style="padding:4px 10px;font-size:11px;margin-right:4px">
                <i class="fas fa-file-pdf"></i>
              </button>
              <button onclick="idfExcluir('${item.id}')" class="btn" style="padding:4px 10px;font-size:11px;background:#fee2e2;color:#dc2626;border:1px solid #fecaca">
                <i class="fas fa-trash"></i>
              </button>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;
}

function _idfFiltrarBusca(busca) {
  const all = _getIDF();
  const filtered = all.filter(i => i.fornecedor?.toLowerCase().includes(busca.toLowerCase()));
  const el = document.getElementById('idf-lista-body');
  if (el) el.innerHTML = _idfTabelaLista(filtered);
}

function _idfFiltrarLista(tipo) {
  const all = _getIDF();
  const filtered = tipo ? all.filter(i => String(i.tipo) === String(tipo)) : all;
  const el = document.getElementById('idf-lista-body');
  if (el) el.innerHTML = _idfTabelaLista(filtered);
}

// ─── TAB CONSOLIDADO (Tabela com todos os critérios por linha) ───
function _idfRenderConsolidado(idfList) {
  if (!idfList.length) return `<div class="card" style="text-align:center;padding:48px;color:var(--text-muted)">Nenhuma avaliação registrada.</div>`;

  const genKeys   = ['gen_0','gen_1','gen_2','gen_3','gen_4'];
  const servKeys  = ['serv_0','serv_1','serv_2','serv_3','serv_4'];
  const equipKeys = ['equip_0','equip_1','equip_2','equip_3','equip_4'];
  const matKeys   = ['mat_0','mat_1','mat_2','mat_3','mat_4'];

  const scoreColor = v => {
    if (!v) return '#e5e7eb';
    if (v >= 4) return '#22c55e';
    if (v >= 3) return '#f59e0b';
    if (v >= 2) return '#fb923c';
    return '#ef4444';
  };
  const scoreCell = v => v ? `<td style="text-align:center;background:${scoreColor(v)}22;color:${scoreColor(v)};font-weight:700;font-size:12px;padding:6px 4px">${v}</td>` : `<td style="text-align:center;color:#ccc;font-size:11px;padding:6px 4px">—</td>`;

  return `
    <div class="card" style="overflow-x:auto">
      <div style="font-size:13px;font-weight:600;color:var(--text-primary);margin-bottom:12px">
        Tabela Consolidada — todos os critérios por fornecedor
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:11px;min-width:1100px">
        <thead>
          <tr>
            <th rowspan="2" style="text-align:left;padding:8px;background:#1e3a5f;color:#fff;min-width:150px">Fornecedor</th>
            <th rowspan="2" style="text-align:center;padding:8px;background:#1e3a5f;color:#fff">Tipo</th>
            <th colspan="5" style="text-align:center;padding:8px;background:#4472c4;color:#fff">Critérios Gerais (80%)</th>
            <th colspan="5" style="text-align:center;padding:8px;background:#548235;color:#fff">Serviço (20%)</th>
            <th colspan="5" style="text-align:center;padding:8px;background:#bf8f00;color:#fff">Equipamento (20%)</th>
            <th colspan="5" style="text-align:center;padding:8px;background:#c55a11;color:#fff">Material (20%)</th>
            <th rowspan="2" style="text-align:center;padding:8px;background:#1e3a5f;color:#fff;min-width:70px">Score IDF</th>
            <th rowspan="2" style="text-align:center;padding:8px;background:#1e3a5f;color:#fff;min-width:120px">Classificação</th>
          </tr>
          <tr>
            ${genKeys.map(k   => `<th style="background:#d6e4f7;color:#1e3a5f;padding:4px 6px;font-size:10px;text-align:center;max-width:60px" title="${IDF_CRITERIA[k].desc}">${IDF_CRITERIA[k].name.split(' ')[0]}<br><span style="font-weight:400">${IDF_CRITERIA[k].weight}%</span></th>`).join('')}
            ${servKeys.map(k  => `<th style="background:#e2efda;color:#386119;padding:4px 6px;font-size:10px;text-align:center;max-width:60px" title="${IDF_CRITERIA[k].desc}">${IDF_CRITERIA[k].name.split(' ')[0]}<br><span style="font-weight:400">${IDF_CRITERIA[k].weight}%</span></th>`).join('')}
            ${equipKeys.map(k => `<th style="background:#fff2cc;color:#7f5800;padding:4px 6px;font-size:10px;text-align:center;max-width:60px" title="${IDF_CRITERIA[k].desc}">${IDF_CRITERIA[k].name.split(' ')[0]}<br><span style="font-weight:400">${IDF_CRITERIA[k].weight}%</span></th>`).join('')}
            ${matKeys.map(k   => `<th style="background:#fce4d6;color:#843c0c;padding:4px 6px;font-size:10px;text-align:center;max-width:60px" title="${IDF_CRITERIA[k].desc}">${IDF_CRITERIA[k].name.split(' ')[0]}<br><span style="font-weight:400">${IDF_CRITERIA[k].weight}%</span></th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${idfList.map(item => {
            const cls = _idfClassificacao(item.score || 0);
            return `<tr style="border-bottom:1px solid var(--border-color)">
              <td style="padding:8px;font-weight:600;color:var(--text-primary)">${item.fornecedor}</td>
              <td style="padding:8px;text-align:center;font-size:11px">${IDF_TIPOS[item.tipo]||'—'}</td>
              ${genKeys.map(k   => scoreCell(item.scores?.[k])).join('')}
              ${servKeys.map(k  => scoreCell(item.scores?.[k])).join('')}
              ${equipKeys.map(k => scoreCell(item.scores?.[k])).join('')}
              ${matKeys.map(k   => scoreCell(item.scores?.[k])).join('')}
              <td style="padding:8px;text-align:center;font-weight:700;font-size:14px;color:${cls.color}">${(item.score||0).toFixed(1)}</td>
              <td style="padding:8px;text-align:center">
                <span style="padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600;background:${cls.bg};color:${cls.color}">${cls.label}</span>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

// ─── TAB RANKING ───
function _idfRenderRanking(idfList) {
  // Agrupar por fornecedor (última avaliação de cada)
  const byForn = {};
  idfList.forEach(item => {
    if (!byForn[item.fornecedor] || item.data > byForn[item.fornecedor].data) {
      byForn[item.fornecedor] = item;
    }
  });
  const ranking = Object.values(byForn).sort((a,b) => (b.score||0) - (a.score||0));

  if (!ranking.length) return `<div class="card" style="text-align:center;padding:48px;color:var(--text-muted)">Nenhuma avaliação registrada.</div>`;

  return `
    <div class="card">
      <div style="font-size:14px;font-weight:700;color:var(--text-primary);margin-bottom:20px">
        <i class="fas fa-trophy" style="color:#f59e0b;margin-right:8px"></i>Ranking IDF – Última Avaliação por Fornecedor
      </div>
      ${ranking.map((item, idx) => {
        const cls = _idfClassificacao(item.score || 0);
        const medal = idx===0?'🥇':idx===1?'🥈':idx===2?'🥉':`<span style="font-weight:700;color:var(--text-muted)">${idx+1}º</span>`;
        return `
          <div style="display:flex;align-items:center;gap:16px;padding:14px 0;border-bottom:1px solid var(--border-color)">
            <div style="width:36px;text-align:center;font-size:22px">${medal}</div>
            <div style="flex:1">
              <div style="font-weight:700;color:var(--text-primary);font-size:14px">${item.fornecedor}</div>
              <div style="font-size:11px;color:var(--text-muted)">${IDF_TIPOS[item.tipo]||'—'} · Avaliado em ${item.data||'—'} por ${item.avaliador||'—'}</div>
            </div>
            <div style="width:160px">
              <div style="display:flex;align-items:center;gap:8px">
                <div style="flex:1;height:10px;background:var(--bg-tertiary);border-radius:5px;overflow:hidden">
                  <div style="height:100%;border-radius:5px;background:${cls.color};width:${Math.min(item.score||0,100)}%;transition:width 0.5s"></div>
                </div>
                <span style="font-weight:800;font-size:16px;color:${cls.color};min-width:40px">${(item.score||0).toFixed(1)}</span>
              </div>
            </div>
            <span style="padding:4px 12px;border-radius:12px;font-size:11px;font-weight:600;background:${cls.bg};color:${cls.color};min-width:130px;text-align:center">
              <i class="fas ${cls.icon}" style="margin-right:4px"></i>${cls.label}
            </span>
            <button onclick="idfVerDetalhe('${item.id}')" class="btn btn-secondary" style="padding:5px 12px;font-size:12px">
              <i class="fas fa-eye"></i> Detalhe
            </button>
          </div>`;
      }).join('')}
    </div>`;
}

// ─── TAB NÃO AVALIADOS ───
function _idfRenderNaoAvaliados(fornNaoAval) {
  if (!fornNaoAval || !fornNaoAval.length) {
    return `
      <div class="card" style="text-align:center;padding:48px">
        <i class="fas fa-check-circle" style="font-size:48px;color:#16a34a;margin-bottom:16px"></i>
        <div style="font-size:16px;font-weight:600;color:var(--text-primary)">Todos os fornecedores ativos foram avaliados!</div>
        <div style="font-size:13px;color:var(--text-muted);margin-top:8px">Nenhum fornecedor ativo sem avaliação IDF.</div>
      </div>`;
  }

  const statusColor = s => s==='Ativo'?'#16a34a':s==='Em Homologação'||s==='Homologação'?'#d97706':'#6b7280';
  const statusBg    = s => s==='Ativo'?'#dcfce7':s==='Em Homologação'||s==='Homologação'?'#fef3c7':'#f3f4f6';

  return `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">
        <div style="font-size:14px;font-weight:600;color:var(--text-primary)">
          <i class="fas fa-clock" style="color:#f59e0b;margin-right:8px"></i>
          ${fornNaoAval.length} fornecedor(es) sem avaliação IDF
        </div>
        <div style="display:flex;gap:8px">
          <input type="text" id="idf-nao-aval-busca" placeholder="Filtrar por nome..."
            oninput="_idfFiltrarNaoAvaliados(this.value)"
            style="padding:7px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px">
        </div>
      </div>
      <div id="idf-nao-aval-body">
        ${_idfTabelaNaoAvaliados(fornNaoAval)}
      </div>
    </div>`;
}

function _idfTabelaNaoAvaliados(fornList) {
  if (!fornList || !fornList.length) return `<div style="text-align:center;padding:30px;color:var(--text-muted)">Nenhum resultado encontrado.</div>`;

  const statusColor = s => s==='Ativo'?'#16a34a':s==='Em Homologação'||s==='Homologação'?'#d97706':'#6b7280';
  const statusBg    = s => s==='Ativo'?'#dcfce7':s==='Em Homologação'||s==='Homologação'?'#fef3c7':'#f3f4f6';

  return `
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead>
        <tr style="background:var(--bg-tertiary)">
          <th style="padding:9px 12px;text-align:left;color:var(--text-secondary);font-size:11px;text-transform:uppercase">Fornecedor</th>
          <th style="padding:9px 12px;text-align:left;color:var(--text-secondary);font-size:11px;text-transform:uppercase">Categoria</th>
          <th style="padding:9px 12px;text-align:center;color:var(--text-secondary);font-size:11px;text-transform:uppercase">Status</th>
          <th style="padding:9px 12px;text-align:center;color:var(--text-secondary);font-size:11px;text-transform:uppercase">UF</th>
          <th style="padding:9px 12px;text-align:center;color:var(--text-secondary);font-size:11px;text-transform:uppercase">Prazo Entrega</th>
          <th style="padding:9px 12px;text-align:center;color:var(--text-secondary);font-size:11px;text-transform:uppercase">Ação</th>
        </tr>
      </thead>
      <tbody>
        ${fornList.map(f => `
          <tr style="border-bottom:1px solid var(--border-color)" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background=''">
            <td style="padding:10px 12px">
              <div style="font-weight:600;color:var(--text-primary)">${f.razao_social}</div>
              <div style="font-size:11px;color:var(--text-muted)">${f.cnpj||'—'}</div>
            </td>
            <td style="padding:10px 12px;color:var(--text-secondary);font-size:12px">${f.categoria||'—'}</td>
            <td style="padding:10px 12px;text-align:center">
              <span style="padding:3px 8px;border-radius:12px;font-size:11px;font-weight:600;background:${statusBg(f.status)};color:${statusColor(f.status)}">${f.status}</span>
            </td>
            <td style="padding:10px 12px;text-align:center;color:var(--text-secondary);font-size:12px">${f.estado||'—'}</td>
            <td style="padding:10px 12px;text-align:center;color:var(--text-secondary);font-size:12px">${f.prazo_entrega ? f.prazo_entrega + ' dias' : '—'}</td>
            <td style="padding:10px 12px;text-align:center">
              <button onclick="idfNovaAvaliacao('${f.razao_social.replace(/'/g,"\\'")}')" class="btn btn-primary btn-sm" style="font-size:11px">
                <i class="fas fa-plus"></i> Avaliar
              </button>
            </td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

function _idfFiltrarNaoAvaliados(busca) {
  // Usa dados já carregados em memória (renderIDF já garantiu carga prévia da API)
  let fornAll = [];
  try {
    if (typeof FA_FORNECEDORES !== 'undefined' && FA_FORNECEDORES.length > 0) {
      fornAll = FA_FORNECEDORES;
    } else {
      fornAll = JSON.parse(localStorage.getItem('fa_fornecedores_cache') || '[]');
    }
  } catch(e) {}
  const idfList = _getIDF();
  const fornAvaliados = new Set(idfList.map(i => i.fornecedor_id || i.fornecedor));
  const fornNaoAval = fornAll.filter(f =>
    f.status !== 'Inativo' && f.status !== 'Bloqueado' && f.status !== 'Suspenso' &&
    !fornAvaliados.has(f.id) && !fornAvaliados.has(f.razao_social) &&
    (!busca || f.razao_social?.toLowerCase().includes(busca.toLowerCase()) || f.categoria?.toLowerCase().includes(busca.toLowerCase()))
  );
  const el = document.getElementById('idf-nao-aval-body');
  if (el) el.innerHTML = _idfTabelaNaoAvaliados(fornNaoAval);
}

// ─── NOVA AVALIAÇÃO (Modal completo com todos os critérios) ───
async function idfNovaAvaliacao(fornecedorPresel) {
  // Garante lista atualizada do D1 antes de abrir o modal
  const fornAll = await _idfGetFornecedoresAtualizados();
  const fornList = fornAll.filter(f => f.status !== 'Inativo' && f.status !== 'Bloqueado');

  // Verifica quais já têm avaliação IDF
  const idfExistentes = _getIDF();
  const fornJaAval = new Set(idfExistentes.map(i => i.fornecedor_id || i.fornecedor));

  const renderCriterioGroup = (keys, groupColor, groupBg) => keys.map(k => {
    const c = IDF_CRITERIA[k];
    return `
      <div style="margin-bottom:12px">
        <label style="font-size:12px;font-weight:600;color:var(--text-primary);display:block;margin-bottom:4px" title="${c.desc}">
          ${c.name} <span style="color:var(--text-muted);font-weight:400">(${c.weight}%)</span>
          <i class="fas fa-info-circle" style="color:${groupColor};font-size:10px;cursor:help" title="${c.desc}"></i>
        </label>
        <div style="font-size:10px;color:var(--text-muted);margin-bottom:6px;line-height:1.3">${c.desc}</div>
        <div style="display:flex;gap:6px" id="idf_wrap_${k}">
          ${[1,2,3,4,5].map(n => {
            const labels = ['','Muito Ruim','Ruim','Regular','Bom','Excelente'];
            const colors = ['','#ef4444','#f97316','#f59e0b','#22c55e','#16a34a'];
            return `<button onclick="idfSelecionarNota('${k}',${n})" id="idf_btn_${k}_${n}"
              style="flex:1;height:36px;border:1px solid var(--border-color);border-radius:6px;
              background:var(--bg-primary);color:var(--text-secondary);cursor:pointer;font-weight:700;font-size:13px;transition:all 0.15s;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:1px"
              title="${n} – ${labels[n]}">${n}</button>`;
          }).join('')}
          <input type="hidden" id="idf_score_${k}" value="">
        </div>
        <div id="idf_lbl_${k}" style="font-size:10px;color:var(--text-muted);margin-top:3px;text-align:center;min-height:14px"></div>
      </div>`;
  }).join('');

  // Constrói opções do select com indicador de já avaliado
  const buildOptions = (filter='') => {
    return fornList
      .filter(f => !filter || f.razao_social.toLowerCase().includes(filter.toLowerCase()) || (f.categoria||'').toLowerCase().includes(filter.toLowerCase()))
      .map(f => {
        const jaAval = fornJaAval.has(f.id) || fornJaAval.has(f.razao_social);
        const label = f.razao_social + (f.categoria ? ' · ' + f.categoria : '') + (jaAval ? ' ✓' : ' ★');
        const style = jaAval ? 'color:#6b7280' : 'color:inherit;font-weight:600';
        const isSelected = f.razao_social === fornecedorPresel || f.id === fornecedorPresel;
        return `<option value="${f.razao_social}" ${isSelected?'selected':''} style="${style}">${label}</option>`;
      }).join('');
  };

  openModalWide('Nova Avaliação IDF – Índice de Desenvolvimento de Fornecedores', `
    <div style="max-height:75vh;overflow-y:auto;padding-right:8px">

      <!-- Cabeçalho -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:20px">
        <div>
          <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">
            Fornecedor *
            <span style="font-size:10px;font-weight:400;margin-left:4px">
              (✓ = já avaliado · ★ = não avaliado)
            </span>
          </label>
          ${fornList.length > 0 ? `
            <input type="text" id="idf_forn_search" placeholder="Filtrar fornecedor..."
              oninput="_idfFiltrarFornecedores(this.value)"
              value="${fornecedorPresel||''}"
              style="width:100%;padding:7px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px 8px 0 0;color:var(--text-primary);font-size:13px">
            <select id="idf_forn" size="5"
              style="width:100%;padding:4px 0;background:var(--bg-secondary);border:1px solid var(--border-color);border-top:none;border-radius:0 0 8px 8px;color:var(--text-primary);font-size:13px;max-height:120px;overflow-y:auto"
              onchange="_idfOnSelectFornecedor(this)">
              <option value="">-- Selecione o fornecedor --</option>
              ${buildOptions()}
            </select>
            <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text-muted);margin-top:3px">
              <span>${fornList.length} fornecedores disponíveis</span>
              <span id="idf_forn_status_info" style="font-size:10px"></span>
            </div>
          ` : `<input type="text" id="idf_forn" value="${fornecedorPresel||''}" placeholder="Nome do fornecedor" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px">`}
        </div>
        <div>
          <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Tipo de Fornecimento *</label>
          <select id="idf_tipo" onchange="idfAtualizarCamposEspecificos()" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px">
            <option value="">Selecione...</option>
            <option value="1">Serviço</option>
            <option value="2">Equipamento</option>
            <option value="3">Material</option>
            <option value="4">Todas as categorias</option>
          </select>
        </div>
        <div>
          <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Categoria</label>
          <select id="idf_categoria" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px">
            <option value="1">Crítico</option>
            <option value="2">Estratégico</option>
            <option value="3">Comum</option>
            <option value="4">Spot</option>
          </select>
        </div>
      </div>
      <div style="margin-bottom:12px">
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Período de Avaliação</label>
        <input type="text" id="idf_periodo" placeholder="Ex: Jan-Mar 2025, Q1 2025, 2025..." style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px">
      </div>

      <!-- Score em tempo real -->
      <div id="idf_score_preview" style="background:linear-gradient(135deg,#1e3a5f,#2563eb);color:#fff;border-radius:10px;padding:16px;margin-bottom:20px;display:flex;align-items:center;gap:20px">
        <div style="text-align:center">
          <div style="font-size:36px;font-weight:800" id="idf_score_live">—</div>
          <div style="font-size:12px;opacity:0.8">Score IDF</div>
        </div>
        <div style="flex:1">
          <div style="height:12px;background:rgba(255,255,255,0.2);border-radius:6px;overflow:hidden;margin-bottom:8px">
            <div id="idf_score_bar" style="height:100%;background:#22c55e;border-radius:6px;width:0%;transition:width 0.4s"></div>
          </div>
          <div id="idf_score_label" style="font-size:12px;opacity:0.9">Preencha os critérios para calcular o score</div>
        </div>
      </div>

      <!-- CRITÉRIOS GERAIS -->
      <div style="background:#dbeafe;border-radius:10px;padding:16px;margin-bottom:16px">
        <div style="font-size:13px;font-weight:700;color:#1d4ed8;margin-bottom:12px;display:flex;align-items:center;gap:8px">
          <i class="fas fa-chart-bar"></i> Critérios Gerais (80%)
          <span style="font-size:11px;font-weight:400;color:#3b82f6">Aplicáveis a todos os fornecedores</span>
        </div>
        ${renderCriterioGroup(['gen_0','gen_1','gen_2','gen_3','gen_4'], '#1d4ed8', '#dbeafe')}
      </div>

      <!-- CRITÉRIOS ESPECÍFICOS (visibilidade por tipo) -->
      <div id="idf_sect_serv" style="background:#dcfce7;border-radius:10px;padding:16px;margin-bottom:16px;display:none">
        <div style="font-size:13px;font-weight:700;color:#15803d;margin-bottom:12px;display:flex;align-items:center;gap:8px">
          <i class="fas fa-hard-hat"></i> Serviço (20%)
        </div>
        ${renderCriterioGroup(['serv_0','serv_1','serv_2','serv_3','serv_4'], '#15803d', '#dcfce7')}
      </div>

      <div id="idf_sect_equip" style="background:#fef3c7;border-radius:10px;padding:16px;margin-bottom:16px;display:none">
        <div style="font-size:13px;font-weight:700;color:#92400e;margin-bottom:12px;display:flex;align-items:center;gap:8px">
          <i class="fas fa-cogs"></i> Equipamento (20%)
        </div>
        ${renderCriterioGroup(['equip_0','equip_1','equip_2','equip_3','equip_4'], '#92400e', '#fef3c7')}
      </div>

      <div id="idf_sect_mat" style="background:#fee2e2;border-radius:10px;padding:16px;margin-bottom:16px;display:none">
        <div style="font-size:13px;font-weight:700;color:#991b1b;margin-bottom:12px;display:flex;align-items:center;gap:8px">
          <i class="fas fa-boxes"></i> Material (20%)
        </div>
        ${renderCriterioGroup(['mat_0','mat_1','mat_2','mat_3','mat_4'], '#991b1b', '#fee2e2')}
      </div>

      <!-- Observações -->
      <div style="margin-top:4px">
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Observações / Justificativas</label>
        <textarea id="idf_obs" rows="3" placeholder="Pontos positivos, negativos, ações recomendadas..." style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;resize:vertical"></textarea>
      </div>

    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="idfSalvarAvaliacao()"><i class="fas fa-save"></i> Salvar Avaliação IDF</button>
  `);
}

function idfSelecionarNota(campo, nota) {
  const noteColors = { 1: '#ef4444', 2: '#f97316', 3: '#f59e0b', 4: '#22c55e', 5: '#16a34a' };
  const noteLabels = { 1: 'Muito Ruim', 2: 'Ruim', 3: 'Regular', 4: 'Bom', 5: 'Excelente' };

  for (let n = 1; n <= 5; n++) {
    const btn = document.getElementById(`idf_btn_${campo}_${n}`);
    if (!btn) continue;
    if (n <= nota) {
      const cor = noteColors[nota] || '#2563eb';
      btn.style.background = cor;
      btn.style.color = '#fff';
      btn.style.borderColor = cor;
      btn.style.transform = n === nota ? 'scale(1.1)' : 'scale(1)';
    } else {
      btn.style.background = 'var(--bg-primary)';
      btn.style.color = 'var(--text-secondary)';
      btn.style.borderColor = 'var(--border-color)';
      btn.style.transform = 'scale(1)';
    }
  }

  // Atualiza label textual
  const lblEl = document.getElementById(`idf_lbl_${campo}`);
  if (lblEl) {
    const cor = noteColors[nota] || '#2563eb';
    lblEl.innerHTML = `<span style="color:${cor};font-weight:600">${nota}/5 – ${noteLabels[nota]}</span>`;
  }

  const hidden = document.getElementById(`idf_score_${campo}`);
  if (hidden) hidden.value = nota;
  _idfAtualizarScoreLive();
}

function idfAtualizarCamposEspecificos() {
  const tipo = parseInt(document.getElementById('idf_tipo')?.value || 0);
  const show = (id, vis) => {
    const el = document.getElementById(id);
    if (el) el.style.display = vis ? 'block' : 'none';
  };
  show('idf_sect_serv',  tipo === 1 || tipo === 4);
  show('idf_sect_equip', tipo === 2 || tipo === 4);
  show('idf_sect_mat',   tipo === 3 || tipo === 4);
  _idfAtualizarScoreLive();
}

function _idfColetarScores() {
  const scores = {};
  Object.keys(IDF_CRITERIA).forEach(k => {
    const el = document.getElementById(`idf_score_${k}`);
    if (el && el.value) scores[k] = parseInt(el.value);
  });
  return scores;
}

function _idfAtualizarScoreLive() {
  const tipo = parseInt(document.getElementById('idf_tipo')?.value || 0);
  if (!tipo) return;
  const scores = _idfColetarScores();
  const score = _idfCalcScore(scores, tipo);
  const cls = _idfClassificacao(score);
  const el = document.getElementById('idf_score_live');
  const bar = document.getElementById('idf_score_bar');
  const lbl = document.getElementById('idf_score_label');
  if (el) el.textContent = score.toFixed(1);
  if (bar) bar.style.width = Math.min(score, 100) + '%';
  if (lbl) lbl.textContent = cls.label;
}

function idfSalvarAvaliacao() {
  const fornEl = document.getElementById('idf_forn');
  const forn = fornEl?.value?.trim();
  if (!forn) { showToast('Selecione o fornecedor.', 'error'); return; }
  const tipo = parseInt(document.getElementById('idf_tipo')?.value || 0);
  if (!tipo) { showToast('Selecione o tipo de fornecimento.', 'error'); return; }

  const scores = _idfColetarScores();
  const genFilled = ['gen_0','gen_1','gen_2','gen_3','gen_4'].some(k => scores[k]);
  if (!genFilled) { showToast('Preencha ao menos um critério geral.', 'error'); return; }

  const score = _idfCalcScore(scores, tipo);
  const cls = _idfClassificacao(score);

  const nova = {
    id: gerarId('IDF'),
    fornecedor: forn,
    tipo,
    categoria: parseInt(document.getElementById('idf_categoria')?.value || 3),
    periodo: document.getElementById('idf_periodo')?.value || '',
    scores,
    score,
    classificacao: cls.label,
    avaliador: currentUser?.name || '',
    obs: document.getElementById('idf_obs')?.value || '',
    data: new Date().toLocaleDateString('pt-BR'),
    ts: Date.now()
  };

  const all = _getIDF();
  all.unshift(nova);
  _saveIDF(all);

  // Sincroniza listas Fornecedores ↔ IDF (atualiza idf_score do fornecedor)
  _syncFornecedoresIDF();

  // Sincroniza com a avaliação antiga (fa_avaliacoes_forn) para compatibilidade
  _idfSincronizarComAvaliacaoForn(nova);

  // Sincroniza score IDF com a API D1 (fornecedor no banco)
  _idfSincronizarComAPI(nova);

  logAction('Criar', 'IDF', `${forn} avaliado – Score: ${score.toFixed(1)} – ${cls.label}`);
  // Invalida cache de fornecedores para que renderIDF() recarregue da API
  _idfInvalidarCacheFornecedores();
  closeModal();
  showToast(`IDF salvo! Score: ${score.toFixed(1)} — ${cls.label}`, 'success');
  renderIDF();
}

// Sincronizar score IDF com a API D1 para que apareça no fechamento comercial
// mesmo quando o fornecedor foi cadastrado via API (não via localStorage)
async function _idfSincronizarComAPI(idfItem) {
  try {
    // Busca o fornecedor na lista carregada do D1 pelo nome
    const forn = (typeof FA_FORNECEDORES !== 'undefined' ? FA_FORNECEDORES : [])
      .find(f => f.razao_social === idfItem.fornecedor || f.nome === idfItem.fornecedor);
    if (!forn || !forn.id) return; // fornecedor só em localStorage, não precisa sincronizar
    // Envia score para a API (com token de autenticação)
    const token = sessionStorage.getItem('fa_token') || localStorage.getItem('fa_token') || '';
    await fetch(`/api/fornecedores/${forn.id}/idf`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        score:          idfItem.score,
        classificacao:  idfItem.classificacao,
        avaliado_em:    new Date().toISOString()
      })
    });
    // Atualiza o objeto local também
    forn.score_idf = idfItem.score;
    forn.idf_classificacao = idfItem.classificacao;
  } catch(e) { /* silencioso – não impede o fluxo */ }
}

// Sincronizar com fa_avaliacoes_forn para que o score apareça no fluxo de compras
function _idfSincronizarComAvaliacaoForn(idfItem) {
  try {
    const key = 'fa_avaliacoes_forn';
    const avals = JSON.parse(localStorage.getItem(key) || '[]');
    // Converte score IDF (0-100) para escala 1-5
    const nota15 = Math.max(1, Math.min(5, (idfItem.score / 100) * 5));
    const nova = {
      id: idfItem.id,
      fornecedor: idfItem.fornecedor,
      qualidade:   parseInt(idfItem.scores?.gen_1) || Math.round(nota15),
      prazo:       parseInt(idfItem.scores?.gen_0) || Math.round(nota15),
      preco:       parseInt(idfItem.scores?.gen_2) || Math.round(nota15),
      atendimento: parseInt(idfItem.scores?.serv_2 || idfItem.scores?.gen_0) || Math.round(nota15),
      nota_geral:  parseFloat(nota15.toFixed(2)),
      score_idf:   idfItem.score,
      classificacao_idf: idfItem.classificacao,
      pedido_ref:  '',
      avaliador:   idfItem.avaliador,
      obs:         idfItem.obs,
      data:        idfItem.data
    };
    avals.unshift(nova);
    localStorage.setItem(key, JSON.stringify(avals));
  } catch(e) {}
}

// ─── VER DETALHE ───
function idfVerDetalhe(id) {
  const item = _getIDF().find(x => x.id === id);
  if (!item) return;
  const cls = _idfClassificacao(item.score || 0);

  const renderGrupo = (titulo, keys, headerColor) => {
    const filled = keys.filter(k => item.scores?.[k]);
    if (!filled.length) return '';
    return `
      <div style="margin-bottom:16px">
        <div style="font-size:12px;font-weight:700;color:${headerColor};margin-bottom:10px;text-transform:uppercase;letter-spacing:0.5px">${titulo}</div>
        ${keys.map(k => {
          const val = item.scores?.[k];
          if (!val) return '';
          const c = IDF_CRITERIA[k];
          const rec = _idfRecomendacao(k, val);
          const colors = ['','#ef4444','#fb923c','#f59e0b','#22c55e','#16a34a'];
          return `
            <div style="display:flex;align-items:flex-start;gap:12px;padding:8px 0;border-bottom:1px solid var(--border-color)">
              <div style="flex:1">
                <div style="font-size:13px;font-weight:600;color:var(--text-primary)">${c.name}</div>
                <div style="font-size:10px;color:var(--text-muted);margin-top:2px">${c.desc}</div>
                ${rec ? `<div style="font-size:10px;color:#d97706;margin-top:4px;padding:4px 8px;background:#fef3c7;border-radius:4px"><i class="fas fa-lightbulb" style="margin-right:4px"></i>${rec}</div>` : ''}
              </div>
              <div style="display:flex;gap:2px;align-items:center">
                ${[1,2,3,4,5].map(n => `<div style="width:20px;height:20px;border-radius:4px;background:${n<=val?colors[val]:'var(--bg-tertiary)'};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:${n<=val?'#fff':'var(--text-muted)'}">${n}</div>`).join('')}
              </div>
              <div style="font-weight:800;font-size:16px;color:${colors[val]};min-width:24px;text-align:center">${val}</div>
            </div>`;
        }).join('')}
      </div>`;
  };

  openModalWide(`IDF – ${item.fornecedor}`, `
    <div style="max-height:80vh;overflow-y:auto">
      <!-- Header Score -->
      <div style="background:linear-gradient(135deg,#1e3a5f,#2563eb);border-radius:12px;padding:20px;margin-bottom:20px;color:#fff;display:flex;align-items:center;gap:20px">
        <div style="text-align:center;min-width:100px">
          <div style="font-size:48px;font-weight:800">${(item.score||0).toFixed(1)}</div>
          <div style="font-size:12px;opacity:0.8">Score IDF</div>
        </div>
        <div style="flex:1">
          <div style="font-size:20px;font-weight:700">${item.fornecedor}</div>
          <div style="font-size:13px;opacity:0.8;margin-top:4px">
            ${IDF_TIPOS[item.tipo]||'—'} · ${IDF_CATEGORIAS[item.categoria]||'—'} · ${item.periodo||''}
          </div>
          <div style="height:10px;background:rgba(255,255,255,0.2);border-radius:5px;margin-top:12px;overflow:hidden">
            <div style="height:100%;background:${cls.color};border-radius:5px;width:${Math.min(item.score||0,100)}%"></div>
          </div>
          <div style="margin-top:8px">
            <span style="padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;background:${cls.bg};color:${cls.color}">
              <i class="fas ${cls.icon}" style="margin-right:4px"></i>${cls.label}
            </span>
          </div>
        </div>
        <div style="text-align:right;font-size:11px;opacity:0.8">
          <div>Avaliador: ${item.avaliador||'—'}</div>
          <div>Data: ${item.data||'—'}</div>
        </div>
      </div>

      <!-- Critérios por grupo -->
      ${renderGrupo('Critérios Gerais (80%)', ['gen_0','gen_1','gen_2','gen_3','gen_4'], '#1d4ed8')}
      ${renderGrupo('Serviço (20%)', ['serv_0','serv_1','serv_2','serv_3','serv_4'], '#15803d')}
      ${renderGrupo('Equipamento (20%)', ['equip_0','equip_1','equip_2','equip_3','equip_4'], '#92400e')}
      ${renderGrupo('Material (20%)', ['mat_0','mat_1','mat_2','mat_3','mat_4'], '#991b1b')}

      <!-- Observações -->
      ${item.obs ? `
        <div style="background:var(--bg-secondary);border-radius:8px;padding:12px;margin-top:8px">
          <div style="font-size:12px;font-weight:600;color:var(--text-secondary);margin-bottom:6px">Observações</div>
          <div style="font-size:13px;color:var(--text-primary)">${item.obs}</div>
        </div>` : ''}
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
    <button class="btn btn-secondary" onclick="closeModal();idfGerarPDF('${item.id}')"><i class="fas fa-file-pdf"></i> Exportar PDF</button>
  `);
}

// ─── EXCLUIR ───
function idfExcluir(id) {
  const item = _getIDF().find(x => x.id === id);
  if (!item) return;
  openModal('Confirmar Exclusão', `<p>Excluir avaliação IDF de <strong>${item.fornecedor}</strong>?</p>`, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn" style="background:#ef4444;color:#fff" onclick="_idfConfirmarExcluir('${id}')">
      <i class="fas fa-trash"></i> Excluir
    </button>
  `);
}

function _idfConfirmarExcluir(id) {
  let all = _getIDF().filter(x => x.id !== id);
  _saveIDF(all);
  closeModal();
  showToast('Avaliação IDF excluída.', 'info');
  renderIDF();
}

// ─── GERAR PDF ───
function idfGerarPDF(id) {
  const item = _getIDF().find(x => x.id === id);
  if (!item) return;
  const cls = _idfClassificacao(item.score || 0);

  const renderGrupoTabela = (titulo, keys, headerBg, headerColor) => {
    const filled = keys.filter(k => item.scores?.[k]);
    if (!filled.length) return '';
    const rows = keys.map(k => {
      const val = item.scores?.[k] || '—';
      const c = IDF_CRITERIA[k];
      const colors = ['','#ef4444','#fb923c','#f59e0b','#22c55e','#16a34a'];
      const cellBg = val !== '—' ? colors[val]+'22' : '';
      const cellColor = val !== '—' ? colors[val] : '#666';
      return `<tr>
        <td style="padding:6px 10px;font-size:11px;border:1px solid #ddd">${c.name}</td>
        <td style="padding:6px 10px;font-size:11px;border:1px solid #ddd;text-align:center">${c.weight}%</td>
        <td style="padding:6px 10px;font-size:12px;border:1px solid #ddd;text-align:center;background:${cellBg};color:${cellColor};font-weight:700">${val}</td>
        <td style="padding:6px 10px;font-size:10px;border:1px solid #ddd;color:#666">${val !== '—' ? _idfRecomendacao(k, val) || 'Nível adequado' : '—'}</td>
      </tr>`;
    }).join('');
    return `
      <div style="margin-bottom:20px">
        <div style="background:${headerBg};color:${headerColor};font-weight:700;font-size:12px;padding:8px 12px;border-radius:4px 4px 0 0">${titulo}</div>
        <table style="width:100%;border-collapse:collapse">
          <thead><tr style="background:#f5f5f5">
            <th style="padding:6px 10px;font-size:10px;border:1px solid #ddd;text-align:left">Critério</th>
            <th style="padding:6px 10px;font-size:10px;border:1px solid #ddd;text-align:center">Peso</th>
            <th style="padding:6px 10px;font-size:10px;border:1px solid #ddd;text-align:center">Nota</th>
            <th style="padding:6px 10px;font-size:10px;border:1px solid #ddd;text-align:left">Recomendação</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  };

  const html = `<!DOCTYPE html><html lang="pt-BR"><head>
    <meta charset="UTF-8">
    <title>IDF – ${item.fornecedor}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 30px; color: #333; }
      @media print { body { padding: 0; } }
    </style>
  </head><body>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;border-bottom:3px solid #1e3a5f;padding-bottom:16px">
      <div>
        <div style="font-size:22px;font-weight:700;color:#1e3a5f">Fraser Alexander</div>
        <div style="font-size:16px;font-weight:600;color:#d4a843">IDF – Índice de Desenvolvimento de Fornecedores</div>
      </div>
      <div style="text-align:right;font-size:11px;color:#666">
        <div>Avaliador: ${item.avaliador||'—'}</div>
        <div>Data: ${item.data||'—'}</div>
        <div>Período: ${item.periodo||'—'}</div>
      </div>
    </div>

    <div style="background:#1e3a5f;color:#fff;border-radius:8px;padding:20px;margin-bottom:24px;display:flex;align-items:center;gap:24px">
      <div style="text-align:center;min-width:120px">
        <div style="font-size:52px;font-weight:900">${(item.score||0).toFixed(1)}</div>
        <div style="font-size:11px;opacity:0.8">Score IDF (0–100)</div>
      </div>
      <div style="flex:1">
        <div style="font-size:22px;font-weight:700">${item.fornecedor}</div>
        <div style="font-size:13px;opacity:0.8;margin-top:6px">Tipo: ${IDF_TIPOS[item.tipo]||'—'} · Categoria: ${IDF_CATEGORIAS[item.categoria]||'—'}</div>
        <div style="margin-top:12px;font-size:15px;font-weight:700;color:${cls.color};background:${cls.bg};padding:6px 16px;border-radius:20px;display:inline-block">${cls.label}</div>
      </div>
    </div>

    ${renderGrupoTabela('Critérios Gerais (80%)', ['gen_0','gen_1','gen_2','gen_3','gen_4'], '#4472c4', '#fff')}
    ${renderGrupoTabela('Serviço (20%)', ['serv_0','serv_1','serv_2','serv_3','serv_4'], '#548235', '#fff')}
    ${renderGrupoTabela('Equipamento (20%)', ['equip_0','equip_1','equip_2','equip_3','equip_4'], '#bf8f00', '#fff')}
    ${renderGrupoTabela('Material (20%)', ['mat_0','mat_1','mat_2','mat_3','mat_4'], '#c55a11', '#fff')}

    ${item.obs ? `<div style="margin-top:20px;padding:12px;background:#f9f9f9;border-left:4px solid #1e3a5f;border-radius:4px"><strong>Observações:</strong><br><span style="font-size:12px">${item.obs}</span></div>` : ''}

    <div style="margin-top:30px;border-top:1px solid #ddd;padding-top:12px;font-size:10px;color:#999;text-align:center">
      Documento gerado pelo sistema Fraser Alexander ERP · IDF v2.0 · ${new Date().toLocaleDateString('pt-BR')}
    </div>
  </body></html>`;

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 800);
}

// ─── EXPORTAR EXCEL ───
function idfExportarExcel() {
  const all = _getIDF();
  if (!all.length) { showToast('Nenhuma avaliação para exportar.', 'info'); return; }

  const headers = ['Fornecedor','Tipo','Categoria','Período','Score IDF','Classificação','Avaliador','Data',
    'Pontualidade','Qualidade/Conformidade','Competitividade','Sustentabilidade/ESG','Capacidade Financeira',
    'SSMA','Resposta Emergências','Qualidade Execução','Exp Projetos Similares','Escalabilidade',
    'Disponib Peças','Garantia Suporte Tec','Eficiência Operacional','Custo Propriedade','Flexibilidade',
    'Especificações Técnicas','Certificação Qualidade','Sustent Transporte','Prazo Entrega','Garantia Suporte Mat',
    'Observações'];

  const rows = all.map(i => [
    i.fornecedor, IDF_TIPOS[i.tipo]||'', IDF_CATEGORIAS[i.categoria]||'', i.periodo||'',
    (i.score||0).toFixed(1), i.classificacao||'', i.avaliador||'', i.data||'',
    i.scores?.gen_0||'', i.scores?.gen_1||'', i.scores?.gen_2||'', i.scores?.gen_3||'', i.scores?.gen_4||'',
    i.scores?.serv_0||'', i.scores?.serv_1||'', i.scores?.serv_2||'', i.scores?.serv_3||'', i.scores?.serv_4||'',
    i.scores?.equip_0||'', i.scores?.equip_1||'', i.scores?.equip_2||'', i.scores?.equip_3||'', i.scores?.equip_4||'',
    i.scores?.mat_0||'', i.scores?.mat_1||'', i.scores?.mat_2||'', i.scores?.mat_3||'', i.scores?.mat_4||'',
    i.obs||''
  ]);

  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `IDF_Fraser_${new Date().toLocaleDateString('pt-BR').replace(/\//g,'-')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Exportação CSV concluída!', 'success');
}

// ─── RELATÓRIO PDF CONSOLIDADO ───
function idfGerarRelatorio() {
  const all = _getIDF();
  if (!all.length) { showToast('Nenhuma avaliação registrada.', 'info'); return; }

  // Ranking por fornecedor (última avaliação)
  const byForn = {};
  all.forEach(i => { if (!byForn[i.fornecedor] || i.data > byForn[i.fornecedor].data) byForn[i.fornecedor] = i; });
  const ranking = Object.values(byForn).sort((a,b) => (b.score||0) - (a.score||0));

  const nivA = ranking.filter(i => (i.score||0) >= 80).length;
  const nivB = ranking.filter(i => (i.score||0) >= 60 && (i.score||0) < 80).length;
  const emDes = ranking.filter(i => (i.score||0) >= 40 && (i.score||0) < 60).length;
  const critico = ranking.filter(i => (i.score||0) < 40).length;
  const media = ranking.length ? (ranking.reduce((s,i) => s + (i.score||0), 0) / ranking.length).toFixed(1) : '—';

  const rows = ranking.map((item, idx) => {
    const cls = _idfClassificacao(item.score||0);
    return `<tr style="border-bottom:1px solid #eee">
      <td style="padding:8px 10px;text-align:center;font-weight:700">${idx+1}º</td>
      <td style="padding:8px 10px;font-weight:600">${item.fornecedor}</td>
      <td style="padding:8px 10px;text-align:center">${IDF_TIPOS[item.tipo]||'—'}</td>
      <td style="padding:8px 10px;text-align:center;font-weight:700;font-size:14px;color:${cls.color}">${(item.score||0).toFixed(1)}</td>
      <td style="padding:8px 10px;text-align:center"><span style="padding:3px 10px;border-radius:10px;font-size:11px;background:${cls.bg};color:${cls.color};font-weight:600">${cls.label}</span></td>
      <td style="padding:8px 10px;text-align:center">${item.data||'—'}</td>
    </tr>`;
  }).join('');

  const html = `<!DOCTYPE html><html lang="pt-BR"><head>
    <meta charset="UTF-8"><title>Relatório IDF – Fraser Alexander</title>
    <style>body{font-family:Arial,sans-serif;padding:30px;color:#333}table{width:100%;border-collapse:collapse}th{background:#1e3a5f;color:#fff;padding:8px 10px;font-size:11px}</style>
  </head><body>
    <div style="display:flex;justify-content:space-between;border-bottom:3px solid #1e3a5f;padding-bottom:16px;margin-bottom:24px">
      <div>
        <div style="font-size:24px;font-weight:700;color:#1e3a5f">Fraser Alexander</div>
        <div style="font-size:18px;color:#d4a843">Relatório IDF – Índice de Desenvolvimento de Fornecedores</div>
      </div>
      <div style="text-align:right;font-size:11px;color:#666">
        <div>Gerado em: ${new Date().toLocaleDateString('pt-BR')}</div>
        <div>Usuário: ${currentUser?.name||'—'}</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:15px;margin-bottom:24px">
      ${[
        ['Total Avaliados', ranking.length, '#1e3a5f'],
        ['Score Médio', media, '#2563eb'],
        ['Nível A (≥80)', nivA, '#16a34a'],
        ['Nível B (60-79)', nivB, '#2563eb'],
        ['Críticos (<40)', critico, '#dc2626']
      ].map(([lbl,val,cor]) => `
        <div style="background:#f8f9fa;border-left:4px solid ${cor};padding:12px;border-radius:4px">
          <div style="font-size:22px;font-weight:800;color:${cor}">${val}</div>
          <div style="font-size:10px;color:#666;text-transform:uppercase">${lbl}</div>
        </div>`).join('')}
    </div>

    <h3 style="color:#1e3a5f;margin-bottom:12px">Ranking de Fornecedores</h3>
    <table>
      <thead><tr>
        <th style="width:50px">Pos.</th>
        <th style="text-align:left">Fornecedor</th>
        <th>Tipo</th>
        <th>Score IDF</th>
        <th>Classificação</th>
        <th>Última Avaliação</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>

    <div style="margin-top:30px;border-top:1px solid #ddd;padding-top:12px;font-size:10px;color:#999;text-align:center">
      Fraser Alexander ERP · IDF v2.0 · ${new Date().toLocaleDateString('pt-BR')}
    </div>
  </body></html>`;

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 800);
}

// Filtra fornecedores no select do modal IDF
// (usa dados já em memória – modal só abre após idfNovaAvaliacao() que carrega da API)
function _idfFiltrarFornecedores(busca) {
  let fornAll = [];
  if (typeof FA_FORNECEDORES !== 'undefined' && FA_FORNECEDORES.length > 0) {
    fornAll = FA_FORNECEDORES;
  } else {
    try { fornAll = JSON.parse(localStorage.getItem('fa_fornecedores_cache') || '[]'); } catch(e) {}
  }
  const fornList = fornAll.filter(f => f.status !== 'Inativo' && f.status !== 'Bloqueado');
  const idfExistentes = _getIDF();
  const fornJaAval = new Set(idfExistentes.map(i => i.fornecedor_id || i.fornecedor));

  const sel = document.getElementById('idf_forn');
  if (!sel) return;
  const termo = (busca || '').toLowerCase();
  const filtrados = termo ? fornList.filter(f =>
    f.razao_social?.toLowerCase().includes(termo) ||
    f.nome_fantasia?.toLowerCase().includes(termo) ||
    f.categoria?.toLowerCase().includes(termo) ||
    f.cnpj?.includes(termo)
  ) : fornList;

  // Ordena: não avaliados primeiro, depois avaliados
  filtrados.sort((a,b) => {
    const aAval = fornJaAval.has(a.id) || fornJaAval.has(a.razao_social);
    const bAval = fornJaAval.has(b.id) || fornJaAval.has(b.razao_social);
    if (aAval !== bAval) return aAval ? 1 : -1;
    return a.razao_social.localeCompare(b.razao_social);
  });

  sel.innerHTML = `<option value="">-- Selecione o fornecedor --</option>` + filtrados.map(f => {
    const jaAval = fornJaAval.has(f.id) || fornJaAval.has(f.razao_social);
    const label = f.razao_social + (f.categoria ? ' · ' + f.categoria : '') + (jaAval ? ' ✓' : ' ★');
    return `<option value="${f.razao_social}" style="${jaAval?'color:#6b7280':'font-weight:600'}">${label}</option>`;
  }).join('');
}

// Handler de seleção do fornecedor no modal IDF
function _idfOnSelectFornecedor(selEl) {
  const val = selEl.value;
  const searchEl = document.getElementById('idf_forn_search');
  const infoEl   = document.getElementById('idf_forn_status_info');
  if (searchEl) searchEl.value = val.split(' · ')[0] || '';

  // Mostra info se já tem avaliação
  if (infoEl && val) {
    const idfExistentes = _getIDF();
    const avals = idfExistentes.filter(i => i.fornecedor === val || i.fornecedor_id === val);
    if (avals.length > 0) {
      const ultima = avals.sort((a,b) => (b.data||'').localeCompare(a.data||''))[0];
      infoEl.innerHTML = `<span style="color:#f59e0b"><i class="fas fa-info-circle"></i> Última avaliação: ${ultima.data||'—'} · Score: ${(ultima.score||0).toFixed(1)}</span>`;
    } else {
      infoEl.innerHTML = `<span style="color:#16a34a"><i class="fas fa-star"></i> Primeira avaliação para este fornecedor</span>`;
    }
  } else if (infoEl) {
    infoEl.innerHTML = '';
  }
}

// ─── EXPOR GLOBAIS ───
window.renderIDF                       = renderIDF;
window._idfFiltrarFornecedores         = _idfFiltrarFornecedores;
window._idfOnSelectFornecedor          = _idfOnSelectFornecedor;
window._idfFiltrarNaoAvaliados         = _idfFiltrarNaoAvaliados;
window.idfSwitchTab                    = idfSwitchTab;
window.idfNovaAvaliacao                = idfNovaAvaliacao;
window.idfSelecionarNota               = idfSelecionarNota;
window.idfAtualizarCamposEspecificos   = idfAtualizarCamposEspecificos;
window.idfSalvarAvaliacao              = idfSalvarAvaliacao;
window.idfVerDetalhe                   = idfVerDetalhe;
window.idfExcluir                      = idfExcluir;
window._idfConfirmarExcluir            = _idfConfirmarExcluir;
window.idfGerarPDF                     = idfGerarPDF;
window.idfExportarExcel                = idfExportarExcel;
window.idfGerarRelatorio               = idfGerarRelatorio;
window._idfFiltrarBusca                = _idfFiltrarBusca;
window._idfFiltrarLista                = _idfFiltrarLista;
window._idfCalcScore                   = _idfCalcScore;
window._idfClassificacao               = _idfClassificacao;
window._getIDF                         = _getIDF;
window._saveIDF                        = _saveIDF;

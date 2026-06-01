// =====================================================
// Fraser Alexander ERP – WBS Manager
// Gerenciamento de WBS por Projeto/Proposta/Contrato
// Usado por: CRM, Contratos, OS, Custos
// =====================================================

// ─── CHAVES DE STORAGE ───────────────────────────────
const WBS_KEY       = 'fraser_custos_wbs';
const WBS_PROJ_KEY  = 'fraser_custos_projetos';
const WBS_MAP_KEY   = 'fraser_wbs_contrato_map'; // contrato_id → projeto_id

// ─── HELPERS DE STORAGE ──────────────────────────────
function wbsGetAllItens() {
  try {
    const raw = localStorage.getItem(WBS_KEY);
    if (raw) { const d = JSON.parse(raw); if (Array.isArray(d)) return d; }
  } catch(e) {}
  if (typeof _custosGetWBSSeed === 'function') return _custosGetWBSSeed();
  return [];
}
function wbsSaveAllItens(itens) {
  localStorage.setItem(WBS_KEY, JSON.stringify(itens));
}
function wbsGetProjetos() {
  try {
    const raw = localStorage.getItem(WBS_PROJ_KEY);
    if (raw) { const d = JSON.parse(raw); if (Array.isArray(d) && d.length) return d; }
  } catch(e) {}
  return [];
}
function wbsSaveProjetos(list) {
  localStorage.setItem(WBS_PROJ_KEY, JSON.stringify(list));
}
function wbsGetMap() {
  try { return JSON.parse(localStorage.getItem(WBS_MAP_KEY) || '{}'); } catch(e) { return {}; }
}
function wbsSaveMap(m) { localStorage.setItem(WBS_MAP_KEY, JSON.stringify(m)); }

// ─── VÍNCULOS CONTRATO ↔ PROJETO ─────────────────────
function wbsGetProjetoIdForContrato(contratoId) {
  const m = wbsGetMap();
  if (m[contratoId]) return m[contratoId];
  // Busca na lista de projetos também
  const projs = wbsGetProjetos();
  const p = projs.find(x => x.contrato === contratoId);
  if (p) { m[contratoId] = p.id; wbsSaveMap(m); return p.id; }
  return null;
}
function wbsVincularContratoAoProjeto(contratoId, projetoId) {
  const m = wbsGetMap();
  m[contratoId] = projetoId;
  wbsSaveMap(m);
}

// ─── ITENS POR PROJETO ────────────────────────────────
function wbsGetItensByProjeto(projetoId) {
  const all = wbsGetAllItens();
  if (!projetoId) return all;
  return all.filter(i => i.projeto_id === projetoId || (!i.projeto_id && projetoId === 'PROJ-001'));
}

function wbsGetItensByContrato(contratoId) {
  const pid = wbsGetProjetoIdForContrato(contratoId);
  if (!pid) return [];
  return wbsGetItensByProjeto(pid);
}

function wbsGetItensByPropostaLead(propLead) {
  const pid = wbsGetProjetoIdForProposta(propLead);
  if (!pid) return [];
  return wbsGetItensByProjeto(pid);
}

function wbsGetProjetoIdForProposta(propId) {
  const m = wbsGetMap();
  if (m['prop_' + propId]) return m['prop_' + propId];
  const projs = wbsGetProjetos();
  const p = projs.find(x => x.proposta === propId || x.lead === propId);
  if (p) { m['prop_' + propId] = p.id; wbsSaveMap(m); return p.id; }
  return null;
}

// ─── CRIAR PROJETO VINCULADO ─────────────────────────
function wbsCriarProjetoParaContrato(contrato) {
  const ano = new Date().getFullYear();
  const projs = wbsGetProjetos();
  const seq = projs.length + 1;
  const novoId = `PROJ-${ano}-${String(seq).padStart(3,'0')}`;
  const novo = {
    id: novoId,
    nome: `${contrato.id} – ${contrato.cliente}`,
    contrato: contrato.id,
    cliente: contrato.cliente,
    status: 'Ativo',
    inicio: contrato.inicio || '',
    fim: contrato.fim || '',
    valor_contrato: contrato.valor || 0,
    criado_em: new Date().toISOString()
  };
  projs.push(novo);
  wbsSaveProjetos(projs);
  wbsVincularContratoAoProjeto(contrato.id, novoId);
  // Cria WBS inicial baseada no contrato
  _wbsCriarEstruturaPadrao(novoId, contrato);
  return novoId;
}

function wbsCriarProjetoParaProposta(proposta) {
  const ano = new Date().getFullYear();
  const projs = wbsGetProjetos();
  const seq = projs.length + 1;
  const novoId = `PROJ-PROP-${ano}-${String(seq).padStart(3,'0')}`;
  const novo = {
    id: novoId,
    nome: `Proposta ${proposta.id || proposta.numero} – ${proposta.cliente}`,
    proposta: proposta.id || proposta.numero,
    lead: proposta.lead || null,
    cliente: proposta.cliente,
    status: 'Proposta',
    inicio: new Date().toISOString().split('T')[0],
    fim: '',
    valor_proposta: proposta.valor || proposta.valor_total || 0,
    criado_em: new Date().toISOString()
  };
  projs.push(novo);
  wbsSaveProjetos(projs);
  const m = wbsGetMap();
  m['prop_' + (proposta.id || proposta.numero)] = novoId;
  wbsSaveMap(m);
  _wbsCriarEstruturaProposta(novoId, proposta);
  return novoId;
}

function _wbsCriarEstruturaPadrao(projetoId, contrato) {
  const tipo = contrato.tipo || 'Manutenção';
  const estruturas = {
    'Manutenção':    ['Mão de Obra', 'Materiais e Insumos', 'Equipamentos e Ferramentas', 'Segurança e SSMA', 'Custos Administrativos'],
    'Operação':      ['Operação de Campo', 'Mão de Obra Direta', 'Consumíveis e Insumos', 'Manutenção de Frota', 'SSMA e Conformidade'],
    'Construção':    ['Serviços Civis', 'Estruturas Metálicas', 'Instalações', 'Equipamentos Locados', 'Gestão e Overhead'],
    'Processamento': ['Operação de Britagem', 'Manutenção de Equipamentos', 'Insumos de Processo', 'Energia e Utilidades', 'SSMA'],
    'Perfuração e Fogo': ['Planejamento de Lavra', 'Perfuração', 'Carregamento e Detonação', 'Fragmentação', 'Segurança']
  };
  const cats = estruturas[tipo] || estruturas['Manutenção'];
  const itens = [];
  cats.forEach((cat, gi) => {
    const g1 = String(gi + 1);
    // G1 (Grupo)
    itens.push({
      id: g1, projeto_id: projetoId, nivel: 1, g1, g2: '', g3: '', item: '',
      descricao: cat, natureza: 'Grupo', expenditure: 'OPEX', tipo: 'OPEX',
      unidade: '—', qtd: 0, v_unit_est: 0, v_total_est: 0, est_total: 0,
      custo_real: 0, custo_proj: 0, custo_spot: 0, variacao: 0, variacao_pct: 0,
      preco_venda: 0, nao_previsto: false
    });
    // G2 sub-itens
    const subitens = _wbsSubitensPadrao(tipo, gi);
    subitens.forEach((sub, si) => {
      const g2 = String(si + 1);
      itens.push({
        id: `${g1}.${g2}`, projeto_id: projetoId, nivel: 2, g1, g2, g3: '', item: '',
        descricao: sub.desc, natureza: sub.nat, expenditure: sub.exp, tipo: sub.exp,
        unidade: sub.un, qtd: sub.qtd, v_unit_est: sub.vu, v_total_est: sub.vt,
        est_total: sub.vt, custo_real: 0, custo_proj: sub.vt, custo_spot: 0,
        variacao: 0, variacao_pct: 0, preco_venda: sub.vt * 1.15, nao_previsto: false
      });
      // G3 detalhes
      sub.detalhes && sub.detalhes.forEach((det, di) => {
        const g3 = String(di + 1);
        itens.push({
          id: `${g1}.${g2}.${g3}`, projeto_id: projetoId, nivel: 3, g1, g2, g3, item: '',
          descricao: det.desc, natureza: det.nat, expenditure: det.exp, tipo: det.exp,
          unidade: det.un, qtd: det.qtd, v_unit_est: det.vu, v_total_est: det.vt,
          est_total: det.vt, custo_real: 0, custo_proj: det.vt, custo_spot: 0,
          variacao: 0, variacao_pct: 0, preco_venda: det.vt * 1.15, nao_previsto: false
        });
      });
    });
  });

  const all = wbsGetAllItens();
  const filtered = all.filter(i => i.projeto_id !== projetoId);
  wbsSaveAllItens([...filtered, ...itens]);
  return itens;
}

function _wbsCriarEstruturaProposta(projetoId, proposta) {
  const valor = proposta.valor || proposta.valor_total || 0;
  const itens = [
    { id:'1', nivel:1, g1:'1', g2:'', g3:'', item:'', descricao:'Recursos Humanos', natureza:'Grupo', expenditure:'OPEX', tipo:'OPEX', unidade:'—', qtd:0, v_unit_est:0, v_total_est:0, est_total:0 },
    { id:'1.1', nivel:2, g1:'1', g2:'1', g3:'', item:'', descricao:'Mão de Obra Direta – Supervisão', natureza:'MOD', expenditure:'OPEX', tipo:'OPEX', unidade:'HH', qtd:1200, v_unit_est:95, v_total_est:114000, est_total:114000 },
    { id:'1.2', nivel:2, g1:'1', g2:'2', g3:'', item:'', descricao:'Mão de Obra Direta – Operacional', natureza:'MOD', expenditure:'OPEX', tipo:'OPEX', unidade:'HH', qtd:4800, v_unit_est:55, v_total_est:264000, est_total:264000 },
    { id:'1.3', nivel:2, g1:'1', g2:'3', g3:'', item:'', descricao:'Encargos e Benefícios', natureza:'MOI', expenditure:'OPEX', tipo:'OPEX', unidade:'vb', qtd:1, v_unit_est:Math.round(valor*0.08), v_total_est:Math.round(valor*0.08), est_total:Math.round(valor*0.08) },
    { id:'2', nivel:1, g1:'2', g2:'', g3:'', item:'', descricao:'Materiais e Insumos', natureza:'Grupo', expenditure:'OPEX', tipo:'OPEX', unidade:'—', qtd:0, v_unit_est:0, v_total_est:0, est_total:0 },
    { id:'2.1', nivel:2, g1:'2', g2:'1', g3:'', item:'', descricao:'Materiais de Consumo', natureza:'MAT', expenditure:'OPEX', tipo:'OPEX', unidade:'vb', qtd:1, v_unit_est:Math.round(valor*0.06), v_total_est:Math.round(valor*0.06), est_total:Math.round(valor*0.06) },
    { id:'2.2', nivel:2, g1:'2', g2:'2', g3:'', item:'', descricao:'Peças e Componentes', natureza:'MAT', expenditure:'OPEX', tipo:'OPEX', unidade:'vb', qtd:1, v_unit_est:Math.round(valor*0.09), v_total_est:Math.round(valor*0.09), est_total:Math.round(valor*0.09) },
    { id:'3', nivel:1, g1:'3', g2:'', g3:'', item:'', descricao:'Equipamentos e Frota', natureza:'Grupo', expenditure:'CAPEX', tipo:'CAPEX', unidade:'—', qtd:0, v_unit_est:0, v_total_est:0, est_total:0 },
    { id:'3.1', nivel:2, g1:'3', g2:'1', g3:'', item:'', descricao:'Locação de Equipamentos', natureza:'EQP', expenditure:'CAPEX', tipo:'CAPEX', unidade:'mês', qtd:12, v_unit_est:Math.round(valor*0.04), v_total_est:Math.round(valor*0.04*12), est_total:Math.round(valor*0.04*12) },
    { id:'4', nivel:1, g1:'4', g2:'', g3:'', item:'', descricao:'SSMA e Qualidade', natureza:'Grupo', expenditure:'OPEX', tipo:'OPEX', unidade:'—', qtd:0, v_unit_est:0, v_total_est:0, est_total:0 },
    { id:'4.1', nivel:2, g1:'4', g2:'1', g3:'', item:'', descricao:'EPIs e Equipamentos de Segurança', natureza:'SSMA', expenditure:'OPEX', tipo:'OPEX', unidade:'vb', qtd:1, v_unit_est:Math.round(valor*0.02), v_total_est:Math.round(valor*0.02), est_total:Math.round(valor*0.02) },
    { id:'5', nivel:1, g1:'5', g2:'', g3:'', item:'', descricao:'Administração e Overhead', natureza:'Grupo', expenditure:'OPEX', tipo:'OPEX', unidade:'—', qtd:0, v_unit_est:0, v_total_est:0, est_total:0 },
    { id:'5.1', nivel:2, g1:'5', g2:'1', g3:'', item:'', descricao:'Custos Administrativos', natureza:'ADM', expenditure:'OPEX', tipo:'OPEX', unidade:'%', qtd:1, v_unit_est:Math.round(valor*0.05), v_total_est:Math.round(valor*0.05), est_total:Math.round(valor*0.05) }
  ];
  itens.forEach(i => { i.projeto_id = projetoId; i.custo_real = 0; i.custo_proj = i.est_total; i.custo_spot = 0; i.variacao = 0; i.variacao_pct = 0; i.preco_venda = i.est_total * 1.15; i.nao_previsto = false; });
  const all = wbsGetAllItens();
  const filtered = all.filter(i => i.projeto_id !== projetoId);
  wbsSaveAllItens([...filtered, ...itens]);
  return itens;
}

function _wbsSubitensPadrao(tipo, gi) {
  const map = {
    'Manutenção': [
      [
        { desc:'Mecânico de Manutenção – MO', nat:'MOD', exp:'OPEX', un:'HH', qtd:1920, vu:55, vt:105600, detalhes:[
          { desc:'Mecânico Pleno – Preventiva', nat:'MOD', exp:'OPEX', un:'HH', qtd:960, vu:55, vt:52800 },
          { desc:'Mecânico Sênior – Corretiva', nat:'MOD', exp:'OPEX', un:'HH', qtd:960, vu:72, vt:69120 }
        ]},
        { desc:'Eletricista Industrial', nat:'MOD', exp:'OPEX', un:'HH', qtd:480, vu:62, vt:29760 },
        { desc:'Ajudante Geral', nat:'MOD', exp:'OPEX', un:'HH', qtd:800, vu:35, vt:28000 }
      ],
      [
        { desc:'Óleo Lubrificante e Fluidos', nat:'MAT', exp:'OPEX', un:'L', qtd:500, vu:18, vt:9000 },
        { desc:'Filtros (Ar, Óleo, Combustível)', nat:'MAT', exp:'OPEX', un:'Kit', qtd:24, vu:220, vt:5280 },
        { desc:'Rolamentos e Retentores', nat:'MAT', exp:'OPEX', un:'un', qtd:30, vu:350, vt:10500 },
        { desc:'Peças Diversas (Reserva)', nat:'MAT', exp:'OPEX', un:'vb', qtd:1, vu:25000, vt:25000 }
      ],
      [
        { desc:'Ferramentas e Calibração', nat:'EQP', exp:'OPEX', un:'vb', qtd:1, vu:8000, vt:8000 },
        { desc:'Guindaste (locação eventual)', nat:'EQP', exp:'CAPEX', un:'dia', qtd:5, vu:2200, vt:11000 }
      ],
      [
        { desc:'EPIs (capacete, luva, óculos)', nat:'SSMA', exp:'OPEX', un:'Kit/mês', qtd:12, vu:320, vt:3840 },
        { desc:'Sinalização e Bloqueio', nat:'SSMA', exp:'OPEX', un:'vb', qtd:1, vu:2500, vt:2500 }
      ],
      [
        { desc:'Overhead Administrativo', nat:'ADM', exp:'OPEX', un:'%', qtd:1, vu:12000, vt:12000 },
        { desc:'Uniformes e Identificação', nat:'ADM', exp:'OPEX', un:'un', qtd:20, vu:180, vt:3600 }
      ]
    ],
    'Operação': [
      [
        { desc:'Operação de Equipamentos', nat:'MOD', exp:'OPEX', un:'HH', qtd:4000, vu:48, vt:192000 },
        { desc:'Supervisão de Turno', nat:'MOD', exp:'OPEX', un:'HH', qtd:800, vu:72, vt:57600 }
      ],
      [
        { desc:'Operadores de Máquinas Pesadas', nat:'MOD', exp:'OPEX', un:'HH', qtd:3200, vu:42, vt:134400 },
        { desc:'Motoristas', nat:'MOD', exp:'OPEX', un:'HH', qtd:2400, vu:38, vt:91200 }
      ],
      [
        { desc:'Combustível Diesel S10', nat:'INS', exp:'OPEX', un:'L', qtd:12000, vu:5.90, vt:70800 },
        { desc:'Lubrificantes e Fluidos', nat:'INS', exp:'OPEX', un:'L', qtd:800, vu:18, vt:14400 }
      ],
      [
        { desc:'Manutenção Preventiva Frota', nat:'MAN', exp:'OPEX', un:'vb/mês', qtd:12, vu:18000, vt:216000 },
        { desc:'Pneus e Câmaras', nat:'MAN', exp:'CAPEX', un:'un', qtd:16, vu:4500, vt:72000 }
      ],
      [
        { desc:'PCMSO e Exames Periódicos', nat:'SSMA', exp:'OPEX', un:'un', qtd:25, vu:250, vt:6250 },
        { desc:'Treinamentos de Segurança', nat:'SSMA', exp:'OPEX', un:'H/H', qtd:200, vu:60, vt:12000 }
      ]
    ]
  };
  const t = map[tipo] || map['Manutenção'];
  return (t[gi] || t[0] || []);
}

// ─── RENDERIZAÇÃO DA ÁRVORE WBS ──────────────────────
function wbsRenderTree(containerId, itens, opts = {}) {
  const {
    editable = true,
    showCustos = true,
    contratoId = null,
    projetoId = null,
    onSave = null
  } = opts;

  if (!itens || !itens.length) {
    const el = document.getElementById(containerId);
    if (el) el.innerHTML = `
      <div style="text-align:center;padding:40px 20px;color:var(--text-muted)">
        <i class="fas fa-sitemap" style="font-size:36px;opacity:0.3;display:block;margin-bottom:12px"></i>
        <p style="font-size:14px;margin-bottom:16px">Nenhuma estrutura WBS cadastrada para este projeto.</p>
        ${editable && contratoId ? `
          <button onclick="wbsIniciarEstrutura('${contratoId}')" class="btn btn-primary btn-sm">
            <i class="fas fa-magic"></i> Criar Estrutura WBS
          </button>
        ` : ''}
      </div>`;
    return;
  }

  // Organiza por g1/g2/g3/item
  const grupos = {};
  itens.forEach(it => {
    if (!it.g2) {
      grupos[it.g1] = { info: it, g2s: {} };
    } else if (!it.g3) {
      if (!grupos[it.g1]) grupos[it.g1] = { info: null, g2s: {} };
      grupos[it.g1].g2s[it.g2] = { info: it, g3s: {}, itens: [] };
    } else if (!it.item) {
      if (!grupos[it.g1]) grupos[it.g1] = { info: null, g2s: {} };
      if (!grupos[it.g1].g2s[it.g2]) grupos[it.g1].g2s[it.g2] = { info: null, g3s: {}, itens: [] };
      grupos[it.g1].g2s[it.g2].g3s[it.g3] = { info: it, itens: [] };
    } else {
      if (!grupos[it.g1]) grupos[it.g1] = { info: null, g2s: {} };
      if (!grupos[it.g1].g2s[it.g2]) grupos[it.g1].g2s[it.g2] = { info: null, g3s: {}, itens: [] };
      if (!grupos[it.g1].g2s[it.g2].g3s[it.g3]) grupos[it.g1].g2s[it.g2].g3s[it.g3] = { info: null, itens: [] };
      grupos[it.g1].g2s[it.g2].g3s[it.g3].itens.push(it);
    }
  });

  const stateKey = contratoId || projetoId || 'global';
  if (!window._wbsTreeState) window._wbsTreeState = {};
  if (!window._wbsTreeState[stateKey]) window._wbsTreeState[stateKey] = {};
  const state = window._wbsTreeState[stateKey];

  function fmtBRL(v) {
    if (!v || isNaN(v)) return '—';
    return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }
  function fmtPct(v, t) {
    if (!t || !v) return '—';
    return ((v / t) * 100).toFixed(1) + '%';
  }
  function varCol(real, est) {
    if (!est) return '#64748b';
    const r = real / est;
    if (r > 1.1) return '#ef4444';
    if (r > 1) return '#f59e0b';
    return '#22c55e';
  }
  function natBadge(nat) {
    const m = { MOD:'#3b82f6', MAT:'#f59e0b', EQP:'#8b5cf6', SSMA:'#22c55e', ADM:'#6366f1', MOI:'#10b981', INS:'#0ea5e9', MAN:'#f97316', Grupo:'#374151' };
    const c = m[nat] || '#64748b';
    return `<span style="background:${c}22;color:${c};border-radius:4px;padding:2px 6px;font-size:10px;font-weight:600;white-space:nowrap">${nat||'—'}</span>`;
  }
  function tipoBadge(t) {
    const c = t === 'CAPEX' ? '#8b5cf6' : '#3b82f6';
    return `<span style="background:${c}22;color:${c};border-radius:4px;padding:2px 5px;font-size:10px">${t||'—'}</span>`;
  }
  function naBadge() {
    return `<span style="background:#ef444422;color:#ef4444;border-radius:4px;padding:2px 6px;font-size:10px;font-weight:600">⚠ N/P</span>`;
  }

  function rowHTML(it, indent = 0, highlight = false) {
    const isGroup = !it.g2 || (!it.g3 && !it.item);
    const real = it.custo_real || 0;
    const est  = it.est_total || it.v_total_est || 0;
    const vari = est - real;
    const pctU = est > 0 ? ((real / est) * 100).toFixed(1) : '0.0';
    const rColor = varCol(real, est);
    const bg = highlight ? 'rgba(239,68,68,0.08)' : (isGroup ? 'var(--bg-tertiary)' : 'transparent');
    const fw = isGroup ? '600' : '400';
    const editBtn = editable && !isGroup ? `
      <button onclick="wbsEditarLinha('${it.id}','${stateKey}')" class="btn btn-sm btn-secondary" style="padding:2px 6px;font-size:11px" title="Editar">
        <i class="fas fa-edit"></i>
      </button>` : '';
    const npBadge = it.nao_previsto ? naBadge() : '';

    const descColStyle = `padding:8px 8px 8px ${8 + indent * 16}px;font-weight:${fw};color:var(--text-primary);font-size:${isGroup?'12.5':'12'}px`;
    const tdStyle = `padding:7px 8px;text-align:right;font-size:12px;color:var(--text-secondary)`;

    return `
      <tr style="background:${bg};border-bottom:1px solid var(--border-color)" class="wbs-row" data-id="${it.id}">
        <td style="${descColStyle}">
          <span style="display:inline-flex;align-items:center;gap:6px">
            ${isGroup ? `<span style="color:var(--text-muted);font-size:11px">${it.id}</span>` : `<span style="color:var(--text-muted);font-size:10px">${it.id}</span>`}
            <span>${it.descricao}</span>
            ${npBadge}
          </span>
        </td>
        <td style="padding:7px 8px;text-align:center">${!isGroup ? natBadge(it.natureza) : ''}</td>
        <td style="padding:7px 8px;text-align:center">${!isGroup ? tipoBadge(it.expenditure||it.tipo) : ''}</td>
        ${showCustos ? `
          <td style="${tdStyle}">${isGroup ? '' : (it.unidade||'—')}</td>
          <td style="${tdStyle}">${isGroup ? '' : (it.qtd||'—')}</td>
          <td style="${tdStyle}">${isGroup ? '' : fmtBRL(it.v_unit_est)}</td>
          <td style="${tdStyle};color:var(--fa-teal);font-weight:${isGroup?700:400}">${fmtBRL(est)}</td>
          <td style="${tdStyle};color:${real>0?rColor:'var(--text-muted)'};font-weight:${real>0?600:400}">${real > 0 ? fmtBRL(real) : '—'}</td>
          <td style="${tdStyle};color:${real>0?rColor:'var(--text-muted)'}">
            ${real > 0 ? `
              <div style="display:flex;flex-direction:column;align-items:flex-end;gap:2px">
                <span style="font-size:11px">${pctU}%</span>
                <div style="width:50px;height:3px;background:var(--bg-tertiary);border-radius:2px">
                  <div style="width:${Math.min(parseFloat(pctU),100)}%;height:100%;background:${rColor};border-radius:2px"></div>
                </div>
              </div>
            ` : '—'}
          </td>
          <td style="${tdStyle};color:${vari<0?'#ef4444':'#22c55e'}">${real>0 ? fmtBRL(Math.abs(vari)) + (vari<0?'<span style="font-size:10px;color:#ef4444"> ▲</span>':'<span style="font-size:10px;color:#22c55e"> ▼</span>') : '—'}</td>
        ` : ''}
        <td style="padding:7px 8px;text-align:center">${editBtn}</td>
      </tr>`;
  }

  // Calcula totais por grupo
  function calcTotais(grupo) {
    let est = 0, real = 0;
    Object.values(grupo.g2s || {}).forEach(g2 => {
      est  += g2.info?.est_total || 0;
      real += g2.info?.custo_real || 0;
      Object.values(g2.g3s || {}).forEach(g3 => {
        est  += g3.info?.est_total || 0;
        real += g3.info?.custo_real || 0;
        (g3.itens || []).forEach(it => { est += it.est_total||0; real += it.custo_real||0; });
      });
      (g2.itens || []).forEach(it => { est += it.est_total||0; real += it.custo_real||0; });
    });
    return { est, real };
  }

  let html = `
    <div style="overflow-x:auto">
      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center">
        <button onclick="wbsExpandAll('${stateKey}')" class="btn btn-sm btn-secondary" style="font-size:11px"><i class="fas fa-expand-alt"></i> Expandir Tudo</button>
        <button onclick="wbsCollapseAll('${stateKey}')" class="btn btn-sm btn-secondary" style="font-size:11px"><i class="fas fa-compress-alt"></i> Recolher Tudo</button>
        ${editable ? `<button onclick="wbsNovaLinha('${contratoId||projetoId}','${stateKey}')" class="btn btn-sm btn-primary" style="font-size:11px"><i class="fas fa-plus"></i> Nova Linha</button>` : ''}
        ${editable && contratoId ? `<button onclick="wbsNovaLinhaOS('${contratoId}','${stateKey}')" class="btn btn-sm" style="font-size:11px;background:rgba(239,68,68,0.1);color:#ef4444;border:1px solid rgba(239,68,68,0.3)"><i class="fas fa-exclamation-triangle"></i> Item Não Previsto</button>` : ''}
        <span style="margin-left:auto;font-size:11px;color:var(--text-muted)">${itens.filter(i=>i.g2).length} itens · ${itens.filter(i=>i.nao_previsto).length > 0 ? `<span style="color:#ef4444">${itens.filter(i=>i.nao_previsto).length} não previstos</span>` : 'sem itens não previstos'}</span>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:12px;min-width:${showCustos?'900':'500'}px">
        <thead>
          <tr style="background:var(--bg-tertiary);border-bottom:2px solid var(--border-color)">
            <th style="padding:8px 10px;text-align:left;color:var(--text-secondary);font-size:11px;text-transform:uppercase;font-weight:600">Descrição / Código</th>
            <th style="padding:8px 10px;text-align:center;color:var(--text-secondary);font-size:11px;text-transform:uppercase;font-weight:600">Natureza</th>
            <th style="padding:8px 10px;text-align:center;color:var(--text-secondary);font-size:11px;text-transform:uppercase;font-weight:600">Tipo</th>
            ${showCustos ? `
              <th style="padding:8px 10px;text-align:right;color:var(--text-secondary);font-size:11px;text-transform:uppercase;font-weight:600">Un</th>
              <th style="padding:8px 10px;text-align:right;color:var(--text-secondary);font-size:11px;text-transform:uppercase;font-weight:600">Qtd</th>
              <th style="padding:8px 10px;text-align:right;color:var(--text-secondary);font-size:11px;text-transform:uppercase;font-weight:600">V.Unit</th>
              <th style="padding:8px 10px;text-align:right;color:var(--fa-teal);font-size:11px;text-transform:uppercase;font-weight:600">Estimado</th>
              <th style="padding:8px 10px;text-align:right;color:var(--text-secondary);font-size:11px;text-transform:uppercase;font-weight:600">Realizado</th>
              <th style="padding:8px 10px;text-align:right;color:var(--text-secondary);font-size:11px;text-transform:uppercase;font-weight:600">Burn</th>
              <th style="padding:8px 10px;text-align:right;color:var(--text-secondary);font-size:11px;text-transform:uppercase;font-weight:600">Variação</th>
            ` : ''}
            <th style="padding:8px 10px;text-align:center;width:50px"></th>
          </tr>
        </thead>
        <tbody id="wbs-tbody-${stateKey}">`;

  Object.keys(grupos).sort().forEach(g1key => {
    const grupo = grupos[g1key];
    const info  = grupo.info;
    const tots  = calcTotais(grupo);
    const g1Open = state['g1_' + g1key] !== false; // padrão aberto
    const g1Est  = info?.est_total || tots.est;
    const g1Real = info?.custo_real || tots.real;

    html += `
      <tr style="background:var(--bg-secondary);border-bottom:1px solid var(--border-color);cursor:pointer" onclick="wbsToggle('g1_${g1key}','${stateKey}')">
        <td colspan="${showCustos ? 11 : 4}" style="padding:9px 12px">
          <span style="display:inline-flex;align-items:center;gap:8px">
            <i class="fas fa-chevron-${g1Open ? 'down' : 'right'}" style="color:var(--text-muted);font-size:10px;width:12px" id="wbs-ico-g1_${g1key}_${stateKey}"></i>
            <span style="font-size:13px;font-weight:700;color:var(--text-primary)">${g1key}. ${info?.descricao || 'Grupo ' + g1key}</span>
            ${showCustos && tots.est > 0 ? `
              <span style="margin-left:auto;font-size:12px;color:var(--fa-teal);font-weight:600">Est: ${fmtBRL(tots.est)}</span>
              ${tots.real > 0 ? `<span style="font-size:12px;color:${varCol(tots.real,tots.est)};font-weight:600">Real: ${fmtBRL(tots.real)}</span>` : ''}
            ` : ''}
          </span>
        </td>
      </tr>`;

    if (g1Open) {
      Object.keys(grupo.g2s).sort().forEach(g2key => {
        const g2 = grupo.g2s[g2key];
        const g2Open = state[`g2_${g1key}_${g2key}`] !== false;
        const hasChildren = Object.keys(g2.g3s).length > 0 || g2.itens.length > 0;

        if (g2.info) {
          html += `
            <tr style="background:rgba(0,0,0,0.12);border-bottom:1px solid var(--border-color);cursor:${hasChildren?'pointer':'default'}" ${hasChildren?`onclick="wbsToggle('g2_${g1key}_${g2key}','${stateKey}')"`:''}>
              <td colspan="${showCustos ? 11 : 4}" style="padding:8px 8px 8px 24px">
                <span style="display:inline-flex;align-items:center;gap:6px">
                  ${hasChildren ? `<i class="fas fa-chevron-${g2Open?'down':'right'}" style="color:var(--text-muted);font-size:10px;width:12px" id="wbs-ico-g2_${g1key}_${g2key}_${stateKey}"></i>` : '<span style="width:18px"></span>'}
                  <span style="font-size:11px;color:var(--text-muted)">${g2.info.id}</span>
                  <span style="font-size:12.5px;font-weight:600;color:var(--text-primary)">${g2.info.descricao}</span>
                  ${g2.info.nao_previsto ? naBadge() : ''}
                  ${natBadge(g2.info.natureza)}
                  ${tipoBadge(g2.info.expenditure||g2.info.tipo)}
                  ${showCustos && g2.info.est_total ? `<span style="margin-left:auto;font-size:11px;color:var(--fa-teal)">${fmtBRL(g2.info.est_total)}</span>` : ''}
                  ${editable ? `<button onclick="event.stopPropagation();wbsEditarLinha('${g2.info.id}','${stateKey}')" class="btn btn-sm btn-secondary" style="padding:1px 5px;font-size:10px;margin-left:4px"><i class="fas fa-edit"></i></button>` : ''}
                </span>
              </td>
            </tr>`;

          if (g2Open) {
            Object.keys(g2.g3s).sort().forEach(g3key => {
              const g3 = g2.g3s[g3key];
              const g3Open = state[`g3_${g1key}_${g2key}_${g3key}`] !== false;
              const hasLeafs = g3.itens.length > 0;
              if (g3.info) {
                html += `
                  <tr style="border-bottom:1px solid var(--border-color);cursor:${hasLeafs?'pointer':'default'}" ${hasLeafs?`onclick="wbsToggle('g3_${g1key}_${g2key}_${g3key}','${stateKey}')"`:''}>
                    <td colspan="${showCustos ? 11 : 4}" style="padding:7px 8px 7px 40px">
                      <span style="display:inline-flex;align-items:center;gap:6px">
                        ${hasLeafs ? `<i class="fas fa-chevron-${g3Open?'down':'right'}" style="color:var(--text-muted);font-size:10px;width:12px" id="wbs-ico-g3_${g1key}_${g2key}_${g3key}_${stateKey}"></i>` : '<span style="width:18px"></span>'}
                        <span style="font-size:10px;color:var(--text-muted)">${g3.info.id}</span>
                        <span style="font-size:12px;font-weight:500;color:var(--text-secondary)">${g3.info.descricao}</span>
                        ${g3.info.nao_previsto ? naBadge() : ''}
                        ${natBadge(g3.info.natureza)}
                        ${showCustos && g3.info.est_total ? `<span style="margin-left:auto;font-size:11px;color:var(--fa-teal)">${fmtBRL(g3.info.est_total)}</span>` : ''}
                        ${editable ? `<button onclick="event.stopPropagation();wbsEditarLinha('${g3.info.id}','${stateKey}')" class="btn btn-sm btn-secondary" style="padding:1px 5px;font-size:10px;margin-left:4px"><i class="fas fa-edit"></i></button>` : ''}
                      </span>
                    </td>
                  </tr>`;
                if (g3Open) {
                  g3.itens.forEach(it => { html += rowHTML(it, 4, it.nao_previsto); });
                }
              }
            });
            g2.itens.forEach(it => { html += rowHTML(it, 3, it.nao_previsto); });
          }
        } else {
          // g2 sem header próprio – mostra g3 diretamente
          Object.keys(g2.g3s).sort().forEach(g3key => {
            const g3 = g2.g3s[g3key];
            if (g3.info) html += rowHTML(g3.info, 2, g3.info.nao_previsto);
            g3.itens.forEach(it => { html += rowHTML(it, 3, it.nao_previsto); });
          });
          g2.itens.forEach(it => { html += rowHTML(it, 2, it.nao_previsto); });
        }
      });
    }
  });

  html += `</tbody></table></div>`;

  const el = document.getElementById(containerId);
  if (el) el.innerHTML = html;
}

// ─── TOGGLE / EXPAND / COLLAPSE ──────────────────────
function wbsToggle(key, stateKey) {
  if (!window._wbsTreeState) window._wbsTreeState = {};
  if (!window._wbsTreeState[stateKey]) window._wbsTreeState[stateKey] = {};
  const s = window._wbsTreeState[stateKey];
  s[key] = !((s[key] !== false)); // toggle: padrão aberto → fecha; fechado → abre
  const ico = document.getElementById(`wbs-ico-${key}_${stateKey}`);
  // Re-render
  const contratoId = key.startsWith('g1_') ? window._wbsTreeLastContrato : null;
  _wbsRerender(stateKey);
}
function wbsExpandAll(stateKey) {
  if (!window._wbsTreeState) window._wbsTreeState = {};
  window._wbsTreeState[stateKey] = {};
  _wbsRerender(stateKey);
}
function wbsCollapseAll(stateKey) {
  if (!window._wbsTreeState) window._wbsTreeState = {};
  const s = window._wbsTreeState[stateKey] = {};
  // Fecha todos os g1
  document.querySelectorAll('[id^="wbs-ico-g1_"]').forEach(el => { const k = el.id.replace('wbs-ico-','').replace('_'+stateKey,''); s[k] = false; });
  _wbsRerender(stateKey);
}
window._wbsRerenderContext = {};
function _wbsRerender(stateKey) {
  const ctx = window._wbsRerenderContext[stateKey];
  if (!ctx) return;
  wbsRenderTree(ctx.containerId, ctx.itens, ctx.opts);
  // Restaura itens após re-render
  ctx.itens = wbsGetItensByContrato ? wbsGetItensByContrato(ctx.opts.contratoId) : ctx.itens;
}

// ─── MODAL EDITAR LINHA ──────────────────────────────
function wbsEditarLinha(itemId, stateKey) {
  const all = wbsGetAllItens();
  const it  = all.find(i => i.id === itemId);
  if (!it) { showToast('Item não encontrado.', 'error'); return; }

  openModalWide('Editar Linha WBS – ' + itemId, `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div style="grid-column:1/-1">
        <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">Descrição *</label>
        <input type="text" id="ewbs_desc" value="${it.descricao||''}" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
      </div>
      <div>
        <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">Natureza</label>
        <select id="ewbs_nat" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
          ${['MOD','MAT','EQP','SSMA','ADM','MOI','INS','MAN','Grupo'].map(n=>`<option ${it.natureza===n?'selected':''}>${n}</option>`).join('')}
        </select>
      </div>
      <div>
        <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">Tipo</label>
        <select id="ewbs_tipo" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
          <option ${(it.expenditure||it.tipo)==='OPEX'?'selected':''}>OPEX</option>
          <option ${(it.expenditure||it.tipo)==='CAPEX'?'selected':''}>CAPEX</option>
        </select>
      </div>
      <div>
        <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">Unidade</label>
        <input type="text" id="ewbs_un" value="${it.unidade||''}" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
      </div>
      <div>
        <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">Quantidade</label>
        <input type="number" id="ewbs_qtd" value="${it.qtd||0}" min="0" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
      </div>
      <div>
        <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">Valor Unitário Estimado (R$)</label>
        <input type="number" id="ewbs_vunit" value="${it.v_unit_est||0}" min="0" step="0.01" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box" oninput="wbsCalcTotal()">
      </div>
      <div>
        <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">Valor Total Estimado (R$)</label>
        <input type="number" id="ewbs_vtotal" value="${it.est_total||it.v_total_est||0}" min="0" step="0.01" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
      </div>
      <div>
        <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">Custo Realizado (R$)</label>
        <input type="number" id="ewbs_real" value="${it.custo_real||0}" min="0" step="0.01" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
      </div>
      <div>
        <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">Fornecedor / Referência</label>
        <input type="text" id="ewbs_forn" value="${it.fornecedor||''}" placeholder="Nome do fornecedor ou referência" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
      </div>
      <div style="grid-column:1/-1">
        <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">Observações</label>
        <textarea id="ewbs_obs" rows="2" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:12px;box-sizing:border-box;resize:vertical">${it.obs||''}</textarea>
      </div>
      ${it.nao_previsto ? `
        <div style="grid-column:1/-1;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.3);border-radius:8px;padding:10px">
          <i class="fas fa-exclamation-triangle" style="color:#ef4444;margin-right:6px"></i>
          <span style="font-size:12px;color:#ef4444;font-weight:600">Item Não Previsto</span>
          <span style="font-size:11px;color:var(--text-secondary);margin-left:8px">Criado automaticamente a partir de OS fora de escopo.</span>
        </div>
      ` : ''}
    </div>
    <div id="ewbs_erro" style="display:none;color:#ef4444;font-size:12px;margin-top:8px;background:rgba(239,68,68,0.1);padding:8px 12px;border-radius:6px"></div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="wbsSalvarEdicao('${itemId}','${stateKey}')"><i class="fas fa-save"></i> Salvar</button>
  `);
}

function wbsCalcTotal() {
  const qtd  = parseFloat(document.getElementById('ewbs_qtd')?.value || 0);
  const vunit = parseFloat(document.getElementById('ewbs_vunit')?.value || 0);
  if (qtd > 0 && vunit > 0) {
    const el = document.getElementById('ewbs_vtotal');
    if (el) el.value = (qtd * vunit).toFixed(2);
  }
}

function wbsSalvarEdicao(itemId, stateKey) {
  const all = wbsGetAllItens();
  const idx = all.findIndex(i => i.id === itemId);
  if (idx < 0) { showToast('Item não encontrado.', 'error'); return; }

  const desc = document.getElementById('ewbs_desc')?.value?.trim();
  if (!desc) { const e = document.getElementById('ewbs_erro'); if(e){e.style.display='block';e.textContent='Descrição é obrigatória.';} return; }

  const qtd   = parseFloat(document.getElementById('ewbs_qtd')?.value || 0);
  const vunit = parseFloat(document.getElementById('ewbs_vunit')?.value || 0);
  const vtotal = parseFloat(document.getElementById('ewbs_vtotal')?.value || qtd * vunit || 0);
  const real  = parseFloat(document.getElementById('ewbs_real')?.value || 0);

  Object.assign(all[idx], {
    descricao: desc,
    natureza: document.getElementById('ewbs_nat')?.value || all[idx].natureza,
    expenditure: document.getElementById('ewbs_tipo')?.value || all[idx].expenditure,
    tipo: document.getElementById('ewbs_tipo')?.value || all[idx].tipo,
    unidade: document.getElementById('ewbs_un')?.value || all[idx].unidade,
    qtd, v_unit_est: vunit, v_total_est: vtotal, est_total: vtotal,
    custo_real: real, custo_proj: vtotal,
    variacao: vtotal - real, variacao_pct: vtotal > 0 ? (vtotal - real) / vtotal : 0,
    fornecedor: document.getElementById('ewbs_forn')?.value || '',
    obs: document.getElementById('ewbs_obs')?.value || '',
    atualizado_em: new Date().toISOString()
  });
  wbsSaveAllItens(all);
  if (typeof logAction === 'function') logAction('WBS', 'WBS Manager', `Linha ${itemId} atualizada`);
  closeModal();
  showToast(`Linha WBS ${itemId} atualizada!`, 'success');
  _wbsRerender(stateKey);
}

// ─── NOVA LINHA ──────────────────────────────────────
function wbsNovaLinha(refId, stateKey, naoPrevistoOS) {
  const itens = stateKey.startsWith('CONT') ? wbsGetItensByContrato(refId) : wbsGetItensByProjeto(refId);
  const g1max = Math.max(0, ...itens.filter(i=>!i.g2).map(i=>parseInt(i.g1)||0));
  const naoP  = !!naoPrevistoOS;

  openModalWide((naoP ? '⚠ Item Não Previsto – ' : 'Nova Linha WBS – ') + refId, `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:12px">
      <div>
        <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">G1 (Grupo)</label>
        <input type="number" id="nwbs_g1" value="${g1max+1}" min="1" max="99" style="width:100%;padding:8px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box" oninput="wbsAutoCode()">
      </div>
      <div>
        <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">G2 (Subgrupo)</label>
        <input type="number" id="nwbs_g2" value="1" min="0" max="99" style="width:100%;padding:8px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box" oninput="wbsAutoCode()">
      </div>
      <div>
        <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">G3 (Nível 3)</label>
        <input type="number" id="nwbs_g3" value="0" min="0" max="99" style="width:100%;padding:8px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box" oninput="wbsAutoCode()">
      </div>
      <div>
        <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">Item</label>
        <input type="number" id="nwbs_item" value="0" min="0" max="99" style="width:100%;padding:8px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box" oninput="wbsAutoCode()">
      </div>
    </div>
    <div style="margin-bottom:12px">
      <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">Código gerado</label>
      <input type="text" id="nwbs_code" value="${g1max+1}.1" style="width:100%;padding:8px;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:8px;color:var(--fa-teal);font-size:14px;font-weight:600;box-sizing:border-box" placeholder="Código automático">
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div style="grid-column:1/-1">
        <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">Descrição *</label>
        <input type="text" id="nwbs_desc" placeholder="Descrição do item de custo..." style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box" ${naoP ? `value="Item Não Previsto – OS Corretiva"` : ''}>
      </div>
      <div>
        <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">Natureza</label>
        <select id="nwbs_nat" style="width:100%;padding:8px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
          ${['MOD','MAT','EQP','SSMA','ADM','MOI','INS','MAN','Grupo'].map(n=>`<option>${n}</option>`).join('')}
        </select>
      </div>
      <div>
        <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">Tipo</label>
        <select id="nwbs_tipo" style="width:100%;padding:8px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
          <option>OPEX</option><option>CAPEX</option>
        </select>
      </div>
      <div>
        <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">Unidade</label>
        <input type="text" id="nwbs_un" value="vb" placeholder="vb, HH, m², etc." style="width:100%;padding:8px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
      </div>
      <div>
        <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">Quantidade</label>
        <input type="number" id="nwbs_qtd" value="1" min="0" step="1" style="width:100%;padding:8px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box" oninput="wbsNovaCalcTotal()">
      </div>
      <div>
        <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">Valor Unitário (R$)</label>
        <input type="number" id="nwbs_vunit" value="0" min="0" step="0.01" style="width:100%;padding:8px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box" oninput="wbsNovaCalcTotal()">
      </div>
      <div>
        <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">Valor Total Estimado (R$)</label>
        <input type="number" id="nwbs_vtotal" value="0" min="0" step="0.01" style="width:100%;padding:8px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
      </div>
      <div>
        <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">Custo Realizado (R$) <span style="color:var(--text-muted);font-weight:400;font-size:10px">se já ocorreu</span></label>
        <input type="number" id="nwbs_real" value="0" min="0" step="0.01" style="width:100%;padding:8px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
      </div>
      <div style="grid-column:1/-1">
        <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">Observações / Justificativa</label>
        <textarea id="nwbs_obs" rows="2" placeholder="${naoP ? 'Justificativa do item não previsto (obrigatória)...' : 'Observações...'}" style="width:100%;padding:8px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:12px;box-sizing:border-box;resize:vertical"></textarea>
      </div>
    </div>
    ${naoP ? `
      <div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.3);border-radius:8px;padding:10px;margin-top:8px">
        <i class="fas fa-exclamation-triangle" style="color:#ef4444;margin-right:6px"></i>
        <span style="font-size:12px;color:#ef4444;font-weight:600">Item Não Previsto</span>
        <p style="font-size:11px;color:var(--text-secondary);margin:6px 0 0 0">Esta linha será marcada como <b>não prevista</b> e destacada em vermelho na WBS. Uma aprovação de nível gerencial pode ser necessária para liberação do orçamento.</p>
      </div>
    ` : ''}
    <div id="nwbs_erro" style="display:none;color:#ef4444;font-size:12px;margin-top:8px;background:rgba(239,68,68,0.1);padding:8px 12px;border-radius:6px"></div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="wbsSalvarNovaLinha('${refId}','${stateKey}',${naoP})" ${naoP ? `style="background:#ef4444;border-color:#ef4444"` : ''}>
      <i class="fas fa-plus"></i> ${naoP ? 'Registrar Item N/P' : 'Adicionar Linha'}
    </button>
  `);
}

function wbsAutoCode() {
  const g1 = document.getElementById('nwbs_g1')?.value || '1';
  const g2 = document.getElementById('nwbs_g2')?.value || '0';
  const g3 = document.getElementById('nwbs_g3')?.value || '0';
  const it = document.getElementById('nwbs_item')?.value || '0';
  let code = g1;
  if (g2 !== '0' && g2 !== '') code += '.' + g2;
  if (g3 !== '0' && g3 !== '') code += '.' + g3;
  if (it !== '0' && it !== '') code += '.' + it;
  const el = document.getElementById('nwbs_code');
  if (el) el.value = code;
}

function wbsNovaCalcTotal() {
  const qtd  = parseFloat(document.getElementById('nwbs_qtd')?.value || 0);
  const vunit = parseFloat(document.getElementById('nwbs_vunit')?.value || 0);
  if (qtd > 0 && vunit > 0) {
    const el = document.getElementById('nwbs_vtotal');
    if (el) el.value = (qtd * vunit).toFixed(2);
  }
}

function wbsSalvarNovaLinha(refId, stateKey, naoP) {
  const desc = document.getElementById('nwbs_desc')?.value?.trim();
  const erro = document.getElementById('nwbs_erro');
  if (!desc) { if(erro){erro.style.display='block';erro.textContent='Descrição é obrigatória.';} return; }
  if (naoP && !document.getElementById('nwbs_obs')?.value?.trim()) {
    if(erro){erro.style.display='block';erro.textContent='Justificativa é obrigatória para itens não previstos.';} return;
  }

  const g1 = document.getElementById('nwbs_g1')?.value || '1';
  const g2 = document.getElementById('nwbs_g2')?.value || '1';
  const g3 = document.getElementById('nwbs_g3')?.value || '0';
  const item = document.getElementById('nwbs_item')?.value || '0';
  const code = document.getElementById('nwbs_code')?.value || `${g1}.${g2}`;
  const qtd  = parseFloat(document.getElementById('nwbs_qtd')?.value || 1);
  const vu   = parseFloat(document.getElementById('nwbs_vunit')?.value || 0);
  const vt   = parseFloat(document.getElementById('nwbs_vtotal')?.value || qtd * vu || 0);
  const real = parseFloat(document.getElementById('nwbs_real')?.value || 0);

  // Determina projeto_id
  let pid = refId;
  if (refId.startsWith('CONT')) {
    let p = wbsGetProjetoIdForContrato(refId);
    if (!p) { showToast('Crie um projeto WBS para este contrato primeiro.', 'warning'); closeModal(); return; }
    pid = p;
  }

  const all = wbsGetAllItens();
  if (all.find(i => i.id === code)) {
    if(erro){erro.style.display='block';erro.textContent=`Código ${code} já existe. Ajuste os campos G1/G2/G3/Item.`;} return;
  }

  const novaLinha = {
    id: code, projeto_id: pid, nivel: g3!=='0'&&g3!=='' ? (item!=='0'&&item!=='' ? 4 : 3) : 2,
    g1, g2: g2!=='0'?g2:'', g3: g3!=='0'&&g3!==''?g3:'', item: item!=='0'&&item!==''?item:'',
    descricao: desc,
    natureza: document.getElementById('nwbs_nat')?.value || 'MAT',
    expenditure: document.getElementById('nwbs_tipo')?.value || 'OPEX',
    tipo: document.getElementById('nwbs_tipo')?.value || 'OPEX',
    unidade: document.getElementById('nwbs_un')?.value || 'vb',
    qtd, v_unit_est: vu, v_total_est: vt, est_total: vt,
    custo_real: real, custo_proj: vt, custo_spot: real, custo_contrato: vt,
    variacao: vt - real, variacao_pct: vt > 0 ? (vt - real) / vt : 0,
    preco_venda: vt * 1.15,
    obs: document.getElementById('nwbs_obs')?.value || '',
    nao_previsto: !!naoP,
    criado_em: new Date().toISOString(),
    criado_por: typeof currentUser !== 'undefined' ? currentUser?.name || 'Usuário' : 'Usuário'
  };

  all.push(novaLinha);
  wbsSaveAllItens(all);
  if (typeof logAction === 'function') logAction('WBS', 'WBS Manager', `Nova linha WBS ${code}${naoP?' [NÃO PREVISTO]':''}`);
  closeModal();
  showToast(`Linha WBS ${code} adicionada${naoP?' como item não previsto':''}!`, naoP ? 'warning' : 'success');
  _wbsRerender(stateKey);
}

// ─── LINHA NÃO PREVISTA DA OS ────────────────────────
function wbsNovaLinhaOS(contratoId, stateKey) {
  wbsNovaLinha(contratoId, stateKey, true);
}

// ─── INICIALIZAR ESTRUTURA ────────────────────────────
function wbsIniciarEstrutura(contratoId) {
  const c = ERP_DATA?.contratos?.find(x => x.id === contratoId);
  if (!c) { showToast('Contrato não encontrado.', 'error'); return; }
  const pid = wbsCriarProjetoParaContrato(c);
  showToast(`Estrutura WBS criada para ${contratoId}!`, 'success');
  // Re-render na aba WBS do contrato
  if (typeof switchTabContrato === 'function') switchTabContrato('wbs');
}

// ─── SELECT OPTIONS PARA OS (filtrado por contrato) ──
function wbsGetOptionsForContrato(contratoId, selectedId) {
  const itens = wbsGetItensByContrato(contratoId);
  if (!itens.length) {
    // Fallback: usa todos os itens do WBS global
    const all = wbsGetAllItens();
    if (!all.length) return '<option value="">— WBS não configurado para este contrato —</option>';
    let html = '<option value="">Selecione a linha WBS...</option>';
    html += '<option value="NP" style="color:#ef4444">⚠ Item Não Previsto (nova linha)</option>';
    all.forEach(it => {
      if (!it.g2) return;
      html += `<option value="${it.id}" ${selectedId === it.id ? 'selected':''}>${it.id} – ${it.descricao} (${it.natureza||'—'})</option>`;
    });
    return html;
  }
  let html = '<option value="">Selecione a linha WBS...</option>';
  html += '<option value="NP" style="color:#ef4444">⚠ Item Não Previsto (criar nova linha)</option>';
  itens.forEach(it => {
    if (!it.g2) return; // Pula grupos
    const np = it.nao_previsto ? '⚠ ' : '';
    html += `<option value="${it.id}" ${selectedId === it.id ? 'selected':''}>${np}${it.id} – ${it.descricao} (${it.natureza||'—'} | ${it.expenditure||it.tipo||'—'})</option>`;
  });
  return html;
}

// ─── RESUMO WBS PARA CRM/PROPOSTA ────────────────────
function wbsRenderResumoForLead(leadId, containerId) {
  const pid = wbsGetProjetoIdForProposta(leadId);
  const itens = pid ? wbsGetItensByProjeto(pid) : [];

  const el = document.getElementById(containerId);
  if (!el) return;

  if (!itens.length) {
    el.innerHTML = `
      <div style="text-align:center;padding:24px 16px;color:var(--text-muted)">
        <i class="fas fa-sitemap" style="font-size:28px;opacity:0.3;display:block;margin-bottom:8px"></i>
        <p style="font-size:13px;margin-bottom:12px">Nenhuma WBS vinculada a esta proposta.</p>
        <button onclick="wbsCriarWBSParaLead('${leadId}')" class="btn btn-sm btn-primary">
          <i class="fas fa-magic"></i> Criar Estimativa WBS
        </button>
      </div>`;
    return;
  }

  const projs = wbsGetProjetos();
  const proj  = projs.find(p => p.id === pid);
  const totalEst  = itens.reduce((a,i) => a + (i.est_total||0), 0);
  const totalReal = itens.reduce((a,i) => a + (i.custo_real||0), 0);
  const g1s = itens.filter(i => !i.g2);

  const fmtBRL = v => v > 0 ? 'R$ ' + Number(v).toLocaleString('pt-BR',{minimumFractionDigits:0,maximumFractionDigits:0}) : '—';

  el.innerHTML = `
    <div style="background:rgba(0,180,184,0.05);border:1px solid rgba(0,180,184,0.2);border-radius:8px;padding:12px;margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div>
          <span style="font-size:12px;font-weight:600;color:var(--fa-teal)"><i class="fas fa-sitemap" style="margin-right:4px"></i>WBS: ${pid}</span>
          ${proj ? `<span style="font-size:11px;color:var(--text-muted);margin-left:8px">${proj.nome}</span>` : ''}
        </div>
        <div style="display:flex;gap:6px">
          <button onclick="wbsVerDetalheCompleto('${leadId}','lead')" class="btn btn-sm btn-secondary" style="font-size:11px"><i class="fas fa-expand"></i> Detalhar</button>
          <button onclick="wbsEditarEstimativa('${leadId}')" class="btn btn-sm btn-secondary" style="font-size:11px"><i class="fas fa-edit"></i> Editar</button>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:8px">
        <div style="background:var(--bg-tertiary);border-radius:6px;padding:8px;text-align:center">
          <div style="font-size:10px;color:var(--text-muted)">Valor Estimado</div>
          <div style="font-size:14px;font-weight:700;color:var(--fa-teal)">${fmtBRL(totalEst)}</div>
        </div>
        <div style="background:var(--bg-tertiary);border-radius:6px;padding:8px;text-align:center">
          <div style="font-size:10px;color:var(--text-muted)">Itens WBS</div>
          <div style="font-size:14px;font-weight:700;color:var(--text-primary)">${itens.filter(i=>i.g2).length}</div>
        </div>
        <div style="background:var(--bg-tertiary);border-radius:6px;padding:8px;text-align:center">
          <div style="font-size:10px;color:var(--text-muted)">Grupos</div>
          <div style="font-size:14px;font-weight:700;color:var(--text-primary)">${g1s.length || itens.filter(i=>!i.g2||!i.g3).length}</div>
        </div>
      </div>
      <div style="font-size:11px;color:var(--text-muted)">Estrutura por grupo:</div>
      ${g1s.length ? g1s.map(g => {
        const itensG = itens.filter(i => i.g1 === g.g1 && i.g2);
        const estG = itensG.reduce((a,i)=>a+(i.est_total||0),0);
        const pct = totalEst > 0 ? ((estG/totalEst)*100).toFixed(0) : 0;
        return `
          <div style="display:flex;align-items:center;gap:8px;margin-top:6px">
            <span style="font-size:11px;color:var(--text-secondary);width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${g.descricao}">${g.g1}. ${g.descricao}</span>
            <div style="flex:1;background:var(--bg-tertiary);border-radius:2px;height:4px">
              <div style="width:${pct}%;height:100%;background:var(--fa-teal);border-radius:2px"></div>
            </div>
            <span style="font-size:10px;color:var(--fa-teal);width:70px;text-align:right">${fmtBRL(estG)}</span>
            <span style="font-size:10px;color:var(--text-muted);width:30px;text-align:right">${pct}%</span>
          </div>`;
      }).join('') : itens.filter(i=>i.g2).slice(0,5).map(i=>`
        <div style="display:flex;align-items:center;gap:6px;margin-top:4px">
          <span style="font-size:10px;color:var(--text-muted);width:50px">${i.id}</span>
          <span style="font-size:11px;color:var(--text-secondary);flex:1">${i.descricao}</span>
          <span style="font-size:10px;color:var(--fa-teal)">${fmtBRL(i.est_total)}</span>
        </div>`).join('')}
    </div>`;
}

function wbsCriarWBSParaLead(leadId) {
  // Busca proposta associada ao lead
  let proposta = null;
  try {
    const crm = JSON.parse(localStorage.getItem('fa_crm_data') || '{}');
    proposta = crm.propostas?.find(p => p.lead === leadId);
    if (!proposta) {
      const leads = crm.leads || [];
      const lead = leads.find(l => l.id === leadId);
      proposta = { id: leadId, cliente: lead?.empresa || leadId, valor: lead?.potencial || 0, lead: leadId };
    }
  } catch(e) { proposta = { id: leadId, cliente: leadId, valor: 0, lead: leadId }; }

  const pid = wbsCriarProjetoParaProposta(proposta);
  showToast(`Estimativa WBS criada (${pid}) para a proposta!`, 'success');
  // Refresh
  if (typeof verDetalheLead === 'function') verDetalheLead(leadId);
}

function wbsVerDetalheCompleto(refId, tipo) {
  const pid = tipo === 'lead' ? wbsGetProjetoIdForProposta(refId) : wbsGetProjetoIdForContrato(refId);
  const itens = pid ? wbsGetItensByProjeto(pid) : [];
  const projs = wbsGetProjetos();
  const proj  = projs.find(p => p.id === pid);

  openModalWide('WBS Detalhada – ' + (proj?.nome || refId), `
    <div id="wbs-modal-tree" style="min-height:300px">
      <div style="text-align:center;padding:24px;color:var(--text-muted)"><i class="fas fa-spinner fa-spin"></i> Carregando...</div>
    </div>
  `, `<button class="btn btn-primary" onclick="closeModal()">Fechar</button>`);

  setTimeout(() => {
    const stateKey = 'modal_' + refId;
    window._wbsRerenderContext[stateKey] = {
      containerId: 'wbs-modal-tree',
      itens,
      opts: { editable: true, showCustos: true, contratoId: tipo === 'contrato' ? refId : null, projetoId: pid }
    };
    wbsRenderTree('wbs-modal-tree', itens, { editable: true, showCustos: true, contratoId: tipo === 'contrato' ? refId : null, projetoId: pid });
  }, 100);
}

function wbsEditarEstimativa(leadId) {
  wbsVerDetalheCompleto(leadId, 'lead');
}

// ─── SELECT WBS INTELIGENTE PARA OS ──────────────────
function wbsSelectOnChange(selectEl, contratoId, infoContainerId) {
  const val = selectEl.value;
  const info = document.getElementById(infoContainerId);
  if (!info) return;

  if (val === 'NP') {
    info.style.display = 'block';
    info.style.background = 'rgba(239,68,68,0.1)';
    info.style.color = '#ef4444';
    info.style.borderColor = 'rgba(239,68,68,0.3)';
    info.innerHTML = `<i class="fas fa-exclamation-triangle" style="margin-right:6px"></i><strong>Item Não Previsto:</strong> Uma nova linha WBS será criada ao salvar esta OS. Justificativa obrigatória nas observações.`;
    return;
  }
  if (!val) { info.style.display = 'none'; return; }

  const all = wbsGetAllItens();
  const it = all.find(i => i.id === val);
  if (!it) { info.style.display = 'none'; return; }

  const burnPct = it.est_total > 0 ? ((it.custo_real||0) / it.est_total * 100).toFixed(1) : 0;
  const disponivel = (it.est_total||0) - (it.custo_real||0);
  const dispColor = disponivel >= 0 ? '#22c55e' : '#ef4444';

  info.style.display = 'block';
  info.style.background = 'rgba(16,185,129,0.08)';
  info.style.color = '#10b981';
  info.style.borderColor = 'rgba(16,185,129,0.25)';
  info.innerHTML = `
    <div style="display:flex;flex-wrap:wrap;gap:12px">
      <div><span style="font-size:10px;color:var(--text-muted)">LINHA</span><div style="font-size:12px;font-weight:600;color:#10b981">${it.id}</div></div>
      <div><span style="font-size:10px;color:var(--text-muted)">NATUREZA</span><div style="font-size:12px;font-weight:600">${it.natureza||'—'}</div></div>
      <div><span style="font-size:10px;color:var(--text-muted)">ORÇADO</span><div style="font-size:12px;font-weight:600;color:var(--fa-teal)">R$ ${Number(it.est_total||0).toLocaleString('pt-BR',{minimumFractionDigits:0,maximumFractionDigits:0})}</div></div>
      <div><span style="font-size:10px;color:var(--text-muted)">REALIZADO</span><div style="font-size:12px;font-weight:600">R$ ${Number(it.custo_real||0).toLocaleString('pt-BR',{minimumFractionDigits:0,maximumFractionDigits:0})}</div></div>
      <div><span style="font-size:10px;color:var(--text-muted)">DISPONÍVEL</span><div style="font-size:12px;font-weight:600;color:${dispColor}">R$ ${Math.abs(disponivel).toLocaleString('pt-BR',{minimumFractionDigits:0,maximumFractionDigits:0})}${disponivel<0?' (estourado)':''}</div></div>
      <div><span style="font-size:10px;color:var(--text-muted)">BURN</span><div style="font-size:12px;font-weight:600">${burnPct}%</div></div>
    </div>`;
}

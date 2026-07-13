// Guarda: idf.js carrega DEPOIS deste arquivo; garante _idfClassificacao para
// evitar ReferenceError no render (idf.js sobrescreve com a versão completa).
if (typeof window !== 'undefined' && typeof window._idfClassificacao !== 'function') {
  window._idfClassificacao = function (nota) {
    const n = Number(nota) || 0;
    if (n >= 85) return { color: '#16a34a', bg: 'rgba(22,163,74,.12)', label: 'A — Excelente', icon: 'fa-star' };
    if (n >= 70) return { color: '#2563eb', bg: 'rgba(37,99,235,.12)', label: 'B — Bom', icon: 'fa-thumbs-up' };
    if (n >= 50) return { color: '#d97706', bg: 'rgba(217,119,6,.12)', label: 'C — Regular', icon: 'fa-exclamation' };
    return { color: '#6b7280', bg: 'rgba(107,114,128,.12)', label: '— Sem dados', icon: 'fa-circle' };
  };
}

// =====================================================
// Fraser Alexander – Módulo Fornecedores
// CRUD completo via /api/fornecedores (D1)
// Integrado ao IDF: score exibido em detalhes e
// no fechamento comercial (mapa/pedido)
// =====================================================

let FA_FORNECEDORES = [];
let forDetalheAtivo = null;

// ─── VALIDAÇÃO DE CNPJ (DÍGITOS VERIFICADORES) ──────────────
function _validarDigitosCNPJ(c) {
  if (!c || c.length !== 14) return false;
  if (/^(\d)\1+$/.test(c)) return false; // sequência repetida
  const calc = (s, n) => {
    let soma = 0, pos = n - 7;
    for (let i = n; i >= 1; i--) {
      soma += parseInt(s.charAt(n - i)) * pos--;
      if (pos < 2) pos = 9;
    }
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(c, 12) === parseInt(c.charAt(12)) && calc(c, 13) === parseInt(c.charAt(13));
}

// ─── HELPERS DE IDF PARA FORNECEDOR ─────────────────────────
// Retorna a última avaliação IDF de um fornecedor pelo nome ou ID
function _idfDoFornecedor(nomeOuId) {
  try {
    const idfs = JSON.parse(localStorage.getItem('fa_idf_avaliacoes') || '[]');
    // Tenta localizar o objeto de fornecedor na lista D1
    const forn = FA_FORNECEDORES.find(f =>
      f.id === nomeOuId || f.nome === nomeOuId || f.razao_social === nomeOuId
    );
    const nomeBusca    = forn ? (forn.razao_social || forn.nome) : nomeOuId;
    const nomeFallback = forn ? (forn.nome || forn.razao_social) : null;

    // 1) Busca no localStorage pelo nome (razão social ou nome fantasia)
    const matches = idfs.filter(i =>
      i.fornecedor === nomeBusca ||
      (nomeFallback && i.fornecedor === nomeFallback)
    );
    if (matches.length) return matches.sort((a, b) => (b.ts || 0) - (a.ts || 0))[0];

    // 2) Fallback: usa score_idf salvo na API D1 (campo sincronizado)
    if (forn && forn.score_idf > 0) {
      return {
        id:           forn.id + '_api',
        fornecedor:   nomeBusca,
        score:        forn.score_idf,
        classificacao:forn.idf_classificacao || null,
        data:         forn.idf_avaliado_em ? new Date(forn.idf_avaliado_em).toLocaleDateString('pt-BR') : '—',
        avaliador:    '—',
        ts:           0,
        _fromApi:     true
      };
    }
    return null;
  } catch (e) { return null; }
}

// Badge visual do Score IDF
function _idfScoreBadge(idf) {
  if (!idf) return `<span style="font-size:11px;color:var(--text-muted);padding:2px 8px;border-radius:10px;background:var(--bg-tertiary)"><i class="fas fa-chart-bar" style="margin-right:4px"></i>Sem IDF</span>`;
  const cls = _idfClassificacao ? _idfClassificacao(idf.score || 0) : { color: '#888', bg: '#f0f0f0', label: '—' };
  return `<span style="padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700;background:${cls.bg};color:${cls.color};cursor:pointer" onclick="idfVerDetalhe('${idf.id}')" title="Ver detalhes IDF">
    <i class="fas fa-chart-bar" style="margin-right:4px"></i>IDF ${(idf.score || 0).toFixed(1)} — ${cls.label}
  </span>`;
}

// ─── EXPÕE FORNECEDORES PARA OUTROS MÓDULOS ─────────────────
function _getFornecedores() {
  if (FA_FORNECEDORES.length > 0) return FA_FORNECEDORES;
  try {
    const raw = localStorage.getItem('fa_fornecedores_cache');
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return FA_FORNECEDORES;
}

// ─── NORMALIZA RETORNO DA API PARA O FORMATO INTERNO ────────
function _normalizarFornecedor(f) {
  // Status: prioriza coluna 'status' do D1; fallback por 'ativo'
  const statusNorm = f.status ||
    (f.ativo === 0 ? 'Inativo' : f.ativo === 1 ? 'Ativo' : 'Em Homologação');
  return {
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
    status:           statusNorm,
    prazo_pagamento:  f.prazo_pagamento != null ? Number(f.prazo_pagamento) : 30,
    limite_credito:   f.limite_credito != null  ? Number(f.limite_credito)  : 0,
    avaliacao:        f.score_medio || f.avaliacao || 0,
    score_medio:      f.score_medio || 0,
    total_avaliacoes: f.total_avaliacoes || 0,
    total_pedidos:    f.total_pedidos || 0,
    total_gasto:      f.total_gasto || 0,
    documentos_ok:    f.documentos_ok !== undefined ? Boolean(f.documentos_ok) : true,
    banco:            f.banco || '',
    agencia:          f.agencia || '',
    conta:            f.conta || '',
    tipo_conta:       f.tipo_conta || 'Corrente',
    pix:              f.pix || '',
    pix_tipo:         f.pix_tipo || 'CNPJ',
    criado_em:        f.criado_em || '',
    ativo:            f.ativo !== 0,
    // IDF sincronizado via API PATCH /api/fornecedores/:id/idf
    score_idf:        f.score_idf != null ? Number(f.score_idf) : 0,
    idf_classificacao:f.idf_classificacao || null,
    idf_avaliado_em:  f.idf_avaliado_em || null,
  };
}

// ─── CARREGAR FORNECEDORES DA API D1 ────────────────────────
async function loadFornecedores() {
  try {
    const token = sessionStorage.getItem('fa_token') || localStorage.getItem('fa_token') || '';
    // Timeout para a chamada não pendurar a tela indefinidamente.
    const res = await fetch('/api/fornecedores?ativo=todos', { headers: { 'Authorization': `Bearer ${token}` }, signal: AbortSignal.timeout(12000) });
    const json = await res.json();
    if (json.success && Array.isArray(json.data)) {
      FA_FORNECEDORES = json.data.map(_normalizarFornecedor);
      // Atualiza cache local
      try { localStorage.setItem('fa_fornecedores_cache', JSON.stringify(FA_FORNECEDORES)); } catch (e) {}
      return;
    }
  } catch (e) {}
  // Fallback: tenta cache local
  try {
    const raw = localStorage.getItem('fa_fornecedores_cache');
    if (raw) { FA_FORNECEDORES = JSON.parse(raw); return; }
  } catch (e) {}
  FA_FORNECEDORES = [];
}

// ─── RENDER PRINCIPAL ────────────────────────────────────────
function renderFornecedores() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `<div class="empty-state"><i class="fas fa-spinner fa-spin" style="color:var(--fa-teal)"></i><p>Carregando fornecedores...</p></div>`;

  loadFornecedores().then(() => {
    const ativos  = FA_FORNECEDORES.filter(f => f.status === 'Ativo').length;
    const homolog = FA_FORNECEDORES.filter(f => f.status === 'Em Homologação').length;
    const totalGasto = FA_FORNECEDORES.reduce((a, f) => a + (f.total_gasto || 0), 0);
    const comIDF  = FA_FORNECEDORES.filter(f => _idfDoFornecedor(f.id) !== null).length;

    main.innerHTML = `
      <div class="page-header">
        <div class="page-title">
          <h2>Gestão de Fornecedores</h2>
          <p>${FA_FORNECEDORES.length} fornecedores cadastrados · ${ativos} ativos · ${comIDF} com IDF</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-secondary btn-sm" onclick="exportFornecedores()">
            <i class="fas fa-download"></i> Exportar
          </button>
          <button class="btn btn-secondary btn-sm" onclick="abrirCadastroMassaFornecedores()" style="background:rgba(0,180,184,0.15);border-color:var(--fa-teal);color:var(--fa-teal)">
            <i class="fas fa-file-upload"></i> Importar em Massa
          </button>
          <button class="btn btn-secondary btn-sm" onclick="abrirBuscaCNPJ()" style="background:rgba(79,70,229,0.12);border-color:#4f46e5;color:#4f46e5">
            <i class="fas fa-search"></i> Buscar por CNPJ
          </button>
          <button class="btn btn-primary btn-sm" onclick="openNovoFornecedor()">
            <i class="fas fa-plus"></i> Novo Fornecedor
          </button>
        </div>
      </div>

      <!-- KPIs -->
      <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr)">
        <div class="kpi-card kpi-orange">
          <div class="kpi-icon"><i class="fas fa-building"></i></div>
          <div class="kpi-value">${FA_FORNECEDORES.length}</div>
          <div class="kpi-label">Total Cadastrados</div>
        </div>
        <div class="kpi-card kpi-green">
          <div class="kpi-icon"><i class="fas fa-check-circle"></i></div>
          <div class="kpi-value">${ativos}</div>
          <div class="kpi-label">Ativos / Homologados</div>
        </div>
        <div class="kpi-card kpi-yellow">
          <div class="kpi-icon"><i class="fas fa-hourglass-half"></i></div>
          <div class="kpi-value">${homolog}</div>
          <div class="kpi-label">Em Homologação</div>
        </div>
        <div class="kpi-card kpi-blue">
          <div class="kpi-icon"><i class="fas fa-chart-bar"></i></div>
          <div class="kpi-value">${comIDF}</div>
          <div class="kpi-label">Com Avaliação IDF</div>
        </div>
      </div>

      <!-- Busca e Filtros -->
      <div class="card page-section">
        <div class="search-bar">
          <div class="search-input-wrapper">
            <i class="fas fa-search"></i>
            <input class="search-input" type="text" placeholder="Buscar por nome, CNPJ, cidade..." id="searchFor" oninput="filterFornecedores()">
          </div>
          <select class="filter-select" id="filterForStatus" onchange="filterFornecedores()">
            <option value="">Todos os Status</option>
            <option>Ativo</option><option>Em Homologação</option><option>Bloqueado</option><option>Inativo</option>
          </select>
          <select class="filter-select" id="filterForCat" onchange="filterFornecedores()">
            <option value="">Todas as Categorias</option>
            <option>Peças e Componentes</option><option>Lubrificantes</option><option>EPI e Segurança</option>
            <option>Material Elétrico</option><option>Ferramentas</option><option>Combustível</option>
            <option>Transporte e Logística</option><option>TI e Software</option>
          </select>
          <select class="filter-select" id="filterForIDF" onchange="filterFornecedores()">
            <option value="">Todos (IDF)</option>
            <option value="com">Com avaliação IDF</option>
            <option value="sem">Sem avaliação IDF</option>
          </select>
        </div>
        <div id="tabelaFornecedores">${renderTabelaFornecedores(FA_FORNECEDORES)}</div>
      </div>

      <!-- Top fornecedores por IDF -->
      ${_renderTopFornecedoresIDF()}
    `;
  }).catch((e) => {
    console.error('[Fornecedores] falha ao renderizar:', e);
    main.innerHTML = `
      <div class="empty-state" style="padding:60px 24px;text-align:center">
        <i class="fas fa-triangle-exclamation" style="font-size:42px;color:#d97706;opacity:.6"></i>
        <p style="font-size:15px;font-weight:600;margin-top:12px">Não foi possível carregar os fornecedores</p>
        <p style="font-size:12px;color:var(--text-muted)">${(e && e.message) || 'Erro inesperado'}</p>
        <div style="margin-top:16px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
          <button class="btn btn-secondary btn-sm" onclick="renderFornecedores()"><i class="fas fa-rotate-right"></i> Tentar novamente</button>
          <button class="btn btn-primary btn-sm" onclick="openNovoFornecedor()"><i class="fas fa-plus"></i> Novo Fornecedor</button>
        </div>
      </div>`;
  });
}

// ─── TOP FORNECEDORES POR IDF ────────────────────────────────
function _renderTopFornecedoresIDF() {
  const comIDF = FA_FORNECEDORES.map(f => {
    const idf = _idfDoFornecedor(f.id);
    return idf ? { ...f, _idf: idf } : null;
  }).filter(Boolean).sort((a, b) => (b._idf.score || 0) - (a._idf.score || 0)).slice(0, 4);

  if (!comIDF.length) return `
    <div class="card page-section">
      <div class="card-header">
        <h3><i class="fas fa-chart-bar" style="color:#2563eb;margin-right:8px"></i>Ranking IDF de Fornecedores</h3>
      </div>
      <div class="card-body">
        <div class="empty-state" style="padding:32px">
          <i class="fas fa-clipboard-list" style="color:var(--text-muted)"></i>
          <p>Nenhuma avaliação IDF realizada ainda.</p>
          <button class="btn btn-primary btn-sm" onclick="navigate('idf')"><i class="fas fa-plus"></i> Iniciar Avaliação IDF</button>
        </div>
      </div>
    </div>`;

  return `
    <div class="card page-section">
      <div class="card-header">
        <h3><i class="fas fa-trophy" style="color:#f59e0b;margin-right:8px"></i>Top Fornecedores – Score IDF</h3>
        <button class="btn btn-secondary btn-sm" onclick="navigate('idf')"><i class="fas fa-external-link-alt"></i> Ver IDF Completo</button>
      </div>
      <div class="card-body">
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px">
          ${comIDF.map((f, idx) => {
            const cls = _idfClassificacao ? _idfClassificacao(f._idf.score || 0) : { color: '#888', bg: '#eee', label: '—', icon: 'fa-circle' };
            const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `<span style="font-weight:700;color:var(--text-muted)">${idx+1}º</span>`;
            return `
              <div class="info-card" onclick="abrirDetalheFor('${f.id}')" style="cursor:pointer">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
                  <div class="for-logo" style="width:36px;height:36px;font-size:13px">
                    ${(f.nome_fantasia||f.nome).substring(0,2).toUpperCase()}
                  </div>
                  <span style="font-size:18px">${medal}</span>
                </div>
                <div class="info-card-title">${f.nome_fantasia || f.nome}</div>
                <div class="info-card-sub">${f.categoria}</div>
                <div style="margin-top:10px;display:flex;align-items:center;gap:8px">
                  <div style="flex:1;height:8px;background:var(--bg-tertiary);border-radius:4px;overflow:hidden">
                    <div style="height:100%;background:${cls.color};border-radius:4px;width:${Math.min(f._idf.score||0,100)}%"></div>
                  </div>
                  <span style="font-weight:800;font-size:16px;color:${cls.color}">${(f._idf.score||0).toFixed(1)}</span>
                </div>
                <div style="margin-top:6px">
                  <span style="padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600;background:${cls.bg};color:${cls.color}">
                    <i class="fas ${cls.icon}" style="margin-right:3px"></i>${cls.label}
                  </span>
                </div>
                <div style="margin-top:6px;font-size:10px;color:var(--text-muted)">Avaliado em ${f._idf.data || '—'}</div>
              </div>`;
          }).join('')}
        </div>
      </div>
    </div>`;
}

// ─── TABELA DE FORNECEDORES ──────────────────────────────────
function renderTabelaFornecedores(lista) {
  if (!lista.length) return `<div class="empty-state"><i class="fas fa-building"></i><p>Nenhum fornecedor encontrado</p></div>`;
  return `
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Fornecedor</th><th>CNPJ</th><th>Categoria</th>
            <th>Cidade/UF</th><th>Score IDF</th><th>Docs.</th><th>Status</th><th>Ações</th>
          </tr>
        </thead>
        <tbody>
          ${lista.map(f => {
            const idf = _idfDoFornecedor(f.id);
            return `
            <tr>
              <td>
                <div style="display:flex;align-items:center;gap:8px">
                  <div style="width:32px;height:32px;min-width:32px;background:rgba(0,184,184,0.1);border-radius:6px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;color:var(--fa-teal)">
                    ${(f.nome_fantasia||f.nome).substring(0,2).toUpperCase()}
                  </div>
                  <div>
                    <div style="font-weight:600;font-size:13px">${f.nome_fantasia || f.nome}</div>
                    <div style="font-size:11px;color:var(--text-muted)">${f.razao_social !== f.nome_fantasia ? f.razao_social : ''}</div>
                  </div>
                </div>
              </td>
              <td style="font-size:11px;color:var(--text-muted)">${f.cnpj || '—'}</td>
              <td><span class="badge badge-muted" style="font-size:10px">${f.categoria || '—'}</span></td>
              <td style="font-size:12px">${f.cidade || '—'}${f.estado ? '/'+f.estado : ''}</td>
              <td>${idf ? `
                <div style="display:flex;align-items:center;gap:6px">
                  <div style="width:50px;height:6px;background:var(--bg-tertiary);border-radius:3px;overflow:hidden">
                    <div style="height:100%;background:${(_idfClassificacao||(() => ({color:'#888'})))(idf.score||0).color};width:${Math.min(idf.score||0,100)}%"></div>
                  </div>
                  <span style="font-weight:700;font-size:13px;color:${(_idfClassificacao||(() => ({color:'#888'})))(idf.score||0).color}">${(idf.score||0).toFixed(1)}</span>
                  <button onclick="event.stopPropagation();idfVerDetalhe('${idf.id}')" class="btn btn-secondary btn-sm btn-icon" style="padding:2px 5px;font-size:10px" title="Ver IDF">
                    <i class="fas fa-eye"></i>
                  </button>
                </div>
              ` : `<span style="font-size:11px;color:var(--text-muted)">—</span>`}</td>
              <td>
                ${f.documentos_ok
                  ? '<span class="badge badge-success"><i class="fas fa-check"></i> OK</span>'
                  : '<span class="badge badge-warning"><i class="fas fa-exclamation"></i> Pendente</span>'
                }
              </td>
              <td>${statusBadge(f.status)}</td>
              <td>
                <div class="actions-cell">
                  <button class="btn btn-secondary btn-sm btn-icon" onclick="abrirDetalheFor('${f.id}')" title="Ver detalhes">
                    <i class="fas fa-eye"></i>
                  </button>
                  <button class="btn btn-secondary btn-sm btn-icon" onclick="idfNovaAvaliacao('${f.razao_social||f.nome}')" title="Avaliar IDF" style="background:rgba(37,99,235,0.1);border-color:#2563eb;color:#2563eb">
                    <i class="fas fa-chart-bar"></i>
                  </button>
                  <button class="btn btn-primary btn-sm btn-icon" onclick="openNovoPedidoFor('${f.id}')" title="Novo pedido">
                    <i class="fas fa-shopping-cart"></i>
                  </button>
                  <button class="btn btn-secondary btn-sm btn-icon" onclick="editarFornecedor('${f.id}')" title="Editar">
                    <i class="fas fa-edit"></i>
                  </button>
                </div>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// ─── FILTROS ─────────────────────────────────────────────────
function filterFornecedores() {
  const search = (document.getElementById('searchFor')?.value || '').toLowerCase();
  const status = document.getElementById('filterForStatus')?.value || '';
  const cat    = document.getElementById('filterForCat')?.value || '';
  const idfFil = document.getElementById('filterForIDF')?.value || '';

  const filtered = FA_FORNECEDORES.filter(f => {
    const ms  = !search || (f.razao_social + f.nome + (f.cnpj||'') + (f.cidade||'')).toLowerCase().includes(search);
    const mst = !status || f.status === status;
    const mc  = !cat || f.categoria === cat;
    const mi  = !idfFil || (idfFil === 'com' ? _idfDoFornecedor(f.id) !== null : _idfDoFornecedor(f.id) === null);
    return ms && mst && mc && mi;
  });
  document.getElementById('tabelaFornecedores').innerHTML = renderTabelaFornecedores(filtered);
}

// ─── DETALHE DO FORNECEDOR ───────────────────────────────────
// Painel de homologação (dupla aprovação Financeiro + Compliance) no detalhe.
function _homologacaoPanel(f) {
  const homologado = f.status === 'Homologado' || (f.aprovado_financeiro_por && f.aprovado_compliance_por);
  const role = (currentUser && (currentUser.profile || currentUser.role)) || '';
  const podeFin = ['admin', 'financeiro'].includes(role);
  const podeComp = ['admin', 'diretor', 'compliance'].includes(role);
  const etapa = (ok, quem) => ok
    ? `<span style="color:#16a34a;font-weight:600"><i class="fas fa-check-circle"></i> ${quem}</span>`
    : `<span style="color:#d97706"><i class="fas fa-clock"></i> pendente</span>`;
  const btn = (cond, etp, label) => cond && !homologado
    ? `<button class="btn btn-primary btn-sm" onclick="homologarFor('${f.id}','${etp}')"><i class="fas fa-check"></i> ${label}</button>` : '';
  return `
    <div style="border:1px solid ${homologado ? 'rgba(22,163,74,.3)' : 'rgba(217,119,6,.3)'};background:${homologado ? 'rgba(22,163,74,.05)' : 'rgba(217,119,6,.05)'};border-radius:10px;padding:12px;margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <strong style="font-size:13px"><i class="fas fa-user-shield" style="margin-right:6px"></i>Homologação de cadastro
          ${homologado ? '<span class="badge badge-success" style="margin-left:6px">HOMOLOGADO</span>' : '<span class="badge badge-warning" style="margin-left:6px">não pode ser usado em pedidos</span>'}
        </strong>
        <div style="display:flex;gap:6px">
          ${btn(podeFin, 'financeiro', 'Aprovar (Financeiro)')}
          ${btn(podeComp, 'compliance', 'Aprovar (Compliance)')}
          ${!homologado && (podeFin || podeComp) ? `<button class="btn btn-secondary btn-sm" onclick="reprovarHomologacaoFor('${f.id}')">Reprovar</button>` : ''}
        </div>
      </div>
      <div style="font-size:12px;color:var(--text-muted);margin-top:8px;display:flex;gap:20px;flex-wrap:wrap">
        <span>Financeiro: ${etapa(f.aprovado_financeiro_por, f.aprovado_financeiro_por)}</span>
        <span>Compliance: ${etapa(f.aprovado_compliance_por, f.aprovado_compliance_por)}</span>
        <span id="idf_srv_${f.id}" style="color:var(--text-muted)"><i class="fas fa-gauge"></i> IDF: <span style="opacity:.6">carregando…</span></span>
      </div>
    </div>`;
}

// Carrega o IDF autoritativo do servidor (OTD + avaliações) no painel do detalhe.
async function _carregarIdfServer(id) {
  const el = document.getElementById(`idf_srv_${id}`);
  if (!el || !(window.DB && typeof DB.idfFornecedor === 'function')) return;
  try {
    const idf = await DB.idfFornecedor(id);
    if (!idf) { el.innerHTML = '<i class="fas fa-gauge"></i> IDF: —'; return; }
    const cor = idf.classificacao === 'A' ? '#16a34a' : idf.classificacao === 'B' ? '#2563eb' : idf.classificacao === 'C' ? '#d97706' : (idf.classificacao === 'D' ? '#dc2626' : 'var(--text-muted)');
    const scoreTxt = idf.score != null ? `${idf.score}/100` : 'sem dados';
    const otdTxt = idf.otd_pct != null ? ` · OTD ${idf.otd_pct}%` : '';
    el.innerHTML = `<i class="fas fa-gauge"></i> IDF: <strong style="color:${cor}">${idf.classificacao}</strong> (${scoreTxt})${otdTxt}`;
  } catch (e) { el.innerHTML = '<i class="fas fa-gauge"></i> IDF: —'; }
}

async function homologarFor(id, etapa) {
  try {
    const r = await DB.homologarFornecedor(id, etapa);
    const item = FA_FORNECEDORES.find(x => String(x.id) === String(id));
    if (item && r) Object.assign(item, r);
    showToast(`Aprovação ${etapa} registrada${r && r.status === 'Homologado' ? ' · fornecedor HOMOLOGADO' : ''}.`, 'success');
    closeModal(); setTimeout(() => abrirDetalheFor(id), 150);
  } catch (e) {
    showToast('Falha ao aprovar: ' + (e.message || 'verifique seu perfil'), 'error');
  }
}

async function reprovarHomologacaoFor(id) {
  const motivo = prompt('Motivo da reprovação (opcional):') || '';
  try {
    const r = await DB.reprovarHomologacao(id, motivo);
    const item = FA_FORNECEDORES.find(x => String(x.id) === String(id));
    if (item && r) Object.assign(item, r);
    showToast('Homologação reprovada.', 'warning');
    closeModal(); setTimeout(() => abrirDetalheFor(id), 150);
  } catch (e) { showToast('Falha: ' + (e.message || ''), 'error'); }
}

function abrirDetalheFor(id) {
  const f = FA_FORNECEDORES.find(x => x.id === id);
  if (!f) return;
  forDetalheAtivo = f;

  const pedidos = (typeof FA_PEDIDOS !== 'undefined' ? FA_PEDIDOS : []).filter(p => p.fornecedor_id === id);
  const idf = _idfDoFornecedor(id);
  const idfCls = idf && _idfClassificacao ? _idfClassificacao(idf.score || 0) : null;

  openModalWide(`Fornecedor – ${f.nome_fantasia || f.nome}`, `
    <div class="for-header" style="border-radius:8px;margin-bottom:16px">
      <div class="for-logo" style="width:60px;height:60px;font-size:20px">
        ${(f.nome_fantasia||f.nome).substring(0,2).toUpperCase()}
      </div>
      <div style="flex:1">
        <div style="font-size:16px;font-weight:700">${f.razao_social}</div>
        <div style="font-size:12px;color:var(--text-secondary)">${f.nome_fantasia !== f.razao_social ? f.nome_fantasia+' · ' : ''}${f.categoria}</div>
        <div style="display:flex;gap:8px;margin-top:6px;align-items:center;flex-wrap:wrap">
          ${statusBadge(f.status)}
          ${f.documentos_ok ? '<span class="badge badge-success"><i class="fas fa-check"></i> Docs OK</span>' : '<span class="badge badge-warning"><i class="fas fa-exclamation"></i> Docs Pendentes</span>'}
          ${_idfScoreBadge(idf)}
        </div>
      </div>
      <div style="text-align:right">
        <div style="font-size:20px;font-weight:700;color:var(--fa-teal)">${fmtK(f.total_gasto)}</div>
        <div style="font-size:11px;color:var(--text-muted)">Total histórico</div>
      </div>
    </div>

    ${_homologacaoPanel(f)}

    <!-- Bloco IDF destacado -->
    ${idf ? `
    <div style="background:linear-gradient(135deg,#1e3a5f,#2563eb);border-radius:10px;padding:16px;margin-bottom:16px;color:#fff;display:flex;align-items:center;gap:16px">
      <div style="text-align:center;min-width:80px">
        <div style="font-size:40px;font-weight:800">${(idf.score||0).toFixed(1)}</div>
        <div style="font-size:11px;opacity:0.8">Score IDF</div>
      </div>
      <div style="flex:1">
        <div style="height:10px;background:rgba(255,255,255,0.2);border-radius:5px;overflow:hidden;margin-bottom:8px">
          <div style="height:100%;background:${idfCls.color};border-radius:5px;width:${Math.min(idf.score||0,100)}%"></div>
        </div>
        <div style="font-weight:700;font-size:14px">${idfCls.label}</div>
        <div style="font-size:11px;opacity:0.8;margin-top:4px">Tipo: ${idf.tipo == 1 ? 'Serviço' : idf.tipo == 2 ? 'Equipamento' : idf.tipo == 3 ? 'Material' : 'Múltiplo'} · Avaliado em ${idf.data||'—'} por ${idf.avaliador||'—'}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">
        <button onclick="idfVerDetalhe('${idf.id}')" class="btn btn-sm" style="background:rgba(255,255,255,0.15);color:#fff;border:1px solid rgba(255,255,255,0.3)">
          <i class="fas fa-eye"></i> Ver IDF
        </button>
        <button onclick="idfNovaAvaliacao('${f.razao_social||f.nome}')" class="btn btn-sm" style="background:rgba(255,255,255,0.15);color:#fff;border:1px solid rgba(255,255,255,0.3)">
          <i class="fas fa-redo"></i> Reavaliar
        </button>
      </div>
    </div>` : `
    <div style="background:var(--bg-secondary);border:1px dashed var(--border-color);border-radius:10px;padding:14px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between">
      <div style="display:flex;align-items:center;gap:12px">
        <i class="fas fa-chart-bar" style="font-size:24px;color:var(--text-muted)"></i>
        <div>
          <div style="font-weight:600;font-size:13px;color:var(--text-secondary)">Sem avaliação IDF</div>
          <div style="font-size:11px;color:var(--text-muted)">Este fornecedor ainda não foi avaliado pelo Índice de Desenvolvimento de Fornecedores.</div>
        </div>
      </div>
      <button onclick="closeModal();setTimeout(()=>idfNovaAvaliacao('${f.razao_social||f.nome}'),200)" class="btn btn-primary btn-sm">
        <i class="fas fa-plus"></i> Avaliar IDF
      </button>
    </div>`}

    <div class="grid-2">
      <div>
        <div class="section-divider"><h4>Dados Cadastrais</h4></div>
        <div class="stat-row"><span class="stat-label">CNPJ</span><span class="stat-value">${f.cnpj || '—'}</span></div>
        <div class="stat-row"><span class="stat-label">Cidade/UF</span><span class="stat-value">${f.cidade || '—'}${f.estado ? '/'+f.estado : ''}</span></div>
        <div class="stat-row"><span class="stat-label">Contato</span><span class="stat-value">${f.contato_nome || '—'}</span></div>
        <div class="stat-row"><span class="stat-label">E-mail</span><span class="stat-value" style="font-size:12px">${f.contato_email || '—'}</span></div>
        <div class="stat-row"><span class="stat-label">Telefone</span><span class="stat-value">${f.contato_telefone || '—'}</span></div>
      </div>
      <div>
        <div class="section-divider"><h4>Condições Comerciais</h4></div>
        <div class="stat-row"><span class="stat-label">Prazo de Pagamento</span><span class="stat-value">${f.prazo_pagamento || 30} dias</span></div>
        <div class="stat-row"><span class="stat-label">Limite de Crédito</span><span class="stat-value" style="color:var(--fa-teal)">${fmt(f.limite_credito || 0)}</span></div>
        <div class="stat-row"><span class="stat-label">Total de Pedidos</span><span class="stat-value">${f.total_pedidos || 0}</span></div>
        <div class="stat-row"><span class="stat-label">Total Gasto</span><span class="stat-value" style="color:var(--fa-teal);font-weight:700">${fmt(f.total_gasto || 0)}</span></div>
      </div>
    </div>

    ${(f.banco || f.pix) ? `
    <div class="section-divider" style="margin-top:16px"><h4><i class="fas fa-university" style="color:var(--fa-teal);margin-right:6px"></i>Dados Bancários / PIX</h4></div>
    <div class="grid-2">
      <div>
        ${f.banco ? `<div class="stat-row"><span class="stat-label">Banco</span><span class="stat-value">${f.banco}</span></div>` : ''}
        ${f.agencia ? `<div class="stat-row"><span class="stat-label">Agência</span><span class="stat-value">${f.agencia}</span></div>` : ''}
        ${f.conta ? `<div class="stat-row"><span class="stat-label">Conta</span><span class="stat-value">${f.conta} (${f.tipo_conta||'Corrente'})</span></div>` : ''}
      </div>
      <div>
        ${f.pix ? `
        <div class="stat-row">
          <span class="stat-label">Chave PIX (${f.pix_tipo||''})</span>
          <span class="stat-value" style="color:var(--fa-teal);font-weight:600">
            ${f.pix}
            <button onclick="navigator.clipboard.writeText('${f.pix}');showToast('PIX copiado!','success')" class="btn btn-secondary btn-sm" style="margin-left:4px;padding:2px 6px"><i class="fas fa-copy" style="font-size:10px"></i></button>
          </span>
        </div>` : '<div style="font-size:12px;color:var(--text-muted)">PIX não cadastrado</div>'}
      </div>
    </div>` : ''}

    ${pedidos.length > 0 ? `
      <div class="section-divider" style="margin-top:16px"><h4>Pedidos de Compra Recentes</h4></div>
      <div class="table-wrapper">
        <table>
          <thead><tr><th>Pedido</th><th>Descrição</th><th>Valor</th><th>Status</th></tr></thead>
          <tbody>
            ${pedidos.slice(0, 4).map(p => `
              <tr>
                <td style="color:var(--fa-teal);font-weight:600;font-size:12px">${p.numero}</td>
                <td style="font-size:12px">${p.descricao || '—'}</td>
                <td style="font-weight:600">${fmt(p.valor_total || 0)}</td>
                <td>${statusBadge(p.status)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : ''}
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
    <button class="btn btn-secondary" onclick="closeModal();setTimeout(()=>idfNovaAvaliacao('${f.razao_social||f.nome}'),200)" style="background:rgba(37,99,235,0.1);border-color:#2563eb;color:#2563eb">
      <i class="fas fa-chart-bar"></i> ${idf ? 'Reavaliar IDF' : 'Avaliar IDF'}
    </button>
    <button class="btn btn-primary" onclick="openNovoPedidoFor('${f.id}');closeModal()">
      <i class="fas fa-shopping-cart"></i> Novo Pedido
    </button>
  `);
  setTimeout(() => _carregarIdfServer(id), 60);
}

// ─── CONSULTA CNPJ via Receita Federal (PUBLICA API) ─────────────
async function consultarCNPJ(cnpj) {
  const clean = (cnpj || '').replace(/\D/g, '');
  if (clean.length !== 14) { showToast('CNPJ inválido – digite 14 dígitos', 'warning'); return null; }

  const btn = document.getElementById('btn_consultar_cnpj');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Consultando...'; }

  const card = document.getElementById('cnpj_result_card');
  if (card) { card.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted)"><i class="fas fa-spinner fa-spin fa-2x"></i><br><br>Consultando Receita Federal...</div>'; card.style.display='block'; }

  // API pública ReceitaWS (sem CORS em browser — usa proxy/edge)
  // Fallback para dados simulados quando offline
  const apis = [
    `https://brasilapi.com.br/api/cnpj/v1/${clean}`,
    `https://receitaws.com.br/v1/cnpj/${clean}`,
  ];

  let data = null;
  for (const url of apis) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const json = await res.json();
        if (json && (json.razao_social || json.nome)) { data = json; break; }
      }
    } catch(e) { /* tenta próxima */ }
  }

  if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-search"></i> Consultar'; }

  if (!data) {
    if (card) card.innerHTML = `
      <div style="background:rgba(220,38,38,0.08);border:1px solid rgba(220,38,38,0.2);border-radius:8px;padding:12px;font-size:12px;color:var(--text-secondary)">
        <i class="fas fa-exclamation-triangle" style="color:#dc2626;margin-right:6px"></i>
        Não foi possível consultar o CNPJ automaticamente. 
        Isso pode ocorrer por bloqueio de CORS no browser ou CNPJ inexistente na Receita Federal.
        <br><br>Você pode preencher os dados manualmente abaixo.
      </div>`;
    return null;
  }

  // Normaliza entre BrasilAPI e ReceitaWS
  const r = {
    razao:    data.razao_social || data.nome || '',
    fantasia: data.nome_fantasia || data.fantasia || '',
    situacao: data.descricao_situacao_cadastral || data.situacao || '',
    cnpj_fmt: data.cnpj || cnpj,
    logradouro: data.logradouro || data.endereco || '',
    numero:   data.numero || '',
    bairro:   data.bairro || '',
    cidade:   data.municipio || data.municipio || '',
    uf:       data.uf || data.uf || '',
    cep:      data.cep || '',
    email:    data.email || '',
    telefone: data.ddd_telefone_1 ? `(${data.ddd_telefone_1}) ${data.telefone_1||''}` : (data.telefone||''),
    porte:    data.descricao_porte || data.porte || '',
    atividade: data.cnae_fiscal_descricao || (data.atividade_principal?.[0]?.text) || '',
    abertura:  data.data_inicio_atividade || data.abertura || '',
    capital:  data.capital_social || 0,
    natureza: data.descricao_natureza_juridica || data.natureza_juridica || '',
    ok: true,
  };

  const ok = r.situacao.toUpperCase().includes('ATIVA') || r.situacao.toUpperCase().includes('BAIXADA') === false;

  if (card) card.innerHTML = `
    <div style="background:${ok?'rgba(22,163,74,0.06)':'rgba(220,38,38,0.06)'};border:1px solid ${ok?'rgba(22,163,74,0.2)':'rgba(220,38,38,0.2)'};border-radius:10px;padding:14px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
        <div style="width:32px;height:32px;border-radius:8px;background:${ok?'#dcfce7':'#fee2e2'};display:flex;align-items:center;justify-content:center">
          <i class="fas ${ok?'fa-check-circle':'fa-times-circle'}" style="color:${ok?'#16a34a':'#dc2626'}"></i>
        </div>
        <div>
          <div style="font-size:13px;font-weight:700;color:var(--text-primary)">${r.razao}</div>
          <div style="font-size:11px;color:var(--text-muted)">${r.fantasia ? 'Nome Fantasia: ' + r.fantasia + ' · ' : ''}Situação: <strong style="color:${ok?'#16a34a':'#dc2626'}">${r.situacao||'—'}</strong></div>
        </div>
        <button onclick="_preencherDadosCNPJ()" style="margin-left:auto;padding:6px 14px;background:#4f46e5;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer">
          <i class="fas fa-magic" style="margin-right:4px"></i>Preencher Campos
        </button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;font-size:11px">
        ${[
          ['CNPJ', r.cnpj_fmt],
          ['Abertura', r.abertura],
          ['Porte', r.porte],
          ['Atividade', r.atividade.substring(0,40)+(r.atividade.length>40?'...':'')],
          ['Natureza', r.natureza.substring(0,35)+(r.natureza.length>35?'...':'')],
          ['Capital', r.capital ? 'R$ ' + Number(r.capital).toLocaleString('pt-BR',{minimumFractionDigits:2}) : '—'],
          ['Endereço', `${r.logradouro}${r.numero?' '+r.numero:''}, ${r.bairro}`],
          ['Cidade/UF', `${r.cidade}/${r.uf}`],
          ['CEP', r.cep],
        ].map(([l,v])=>`<div style="background:var(--bg-card);border-radius:6px;padding:6px 8px"><div style="color:var(--text-muted);margin-bottom:1px">${l}</div><div style="font-weight:600;color:var(--text-primary)">${v||'—'}</div></div>`).join('')}
      </div>
    </div>`;

  // Armazena para preencher campos
  window._cnpjConsultaResult = r;
  return r;
}

function _preencherDadosCNPJ() {
  const r = window._cnpjConsultaResult;
  if (!r) return;
  const set = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
  set('nf_razao',   r.razao);
  set('nf_fantasia',r.fantasia);
  set('nf_email',   r.email);
  set('nf_tel',     r.telefone);
  set('nf_cidade',  r.cidade);
  // UF
  const ufSel = document.getElementById('nf_uf');
  if (ufSel && r.uf) {
    const opt = Array.from(ufSel.options).find(o => o.value === r.uf || o.text === r.uf);
    if (opt) opt.selected = true; else { const o = new Option(r.uf, r.uf); ufSel.add(o); o.selected = true; }
  }
  // Categoria por CNAE
  const atividade = (r.atividade || '').toLowerCase();
  let cat = 'Outros';
  if (atividade.includes('transport')) cat = 'Transporte e Logística';
  else if (atividade.includes('constru') || atividade.includes('engenharia')) cat = 'Serviços de Engenharia';
  else if (atividade.includes('softw') || atividade.includes('inform') || atividade.includes('tecnologia')) cat = 'TI e Software';
  else if (atividade.includes('combustíveis') || atividade.includes('petro')) cat = 'Combustível';
  else if (atividade.includes('epi') || atividade.includes('segurança')) cat = 'EPI e Segurança';
  const catSel = document.getElementById('nf_cat');
  if (catSel) {
    const opt = Array.from(catSel.options).find(o => o.value === cat || o.text === cat);
    if (opt) opt.selected = true;
  }
  showToast('✅ Dados preenchidos automaticamente da Receita Federal!', 'success');
}

// ─── BUSCA RÁPIDA POR CNPJ (standalone) ──────────────────────────
function abrirBuscaCNPJ() {
  openModalWide('🔍 Pesquisa de Fornecedor por CNPJ', `
    <div style="margin-bottom:16px">
      <p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px">
        Consulte o CNPJ diretamente na <strong>Receita Federal</strong> e cadastre o fornecedor automaticamente.
      </p>
      <div style="display:flex;gap:8px;align-items:flex-end">
        <div class="form-group" style="flex:1;margin:0">
          <label style="font-size:12px;font-weight:600">CNPJ</label>
          <input class="form-control" id="busca_cnpj_input" type="text" placeholder="00.000.000/0000-00"
            oninput="mascararCNPJ(this)" onkeydown="if(event.key==='Enter') consultarCNPJBusca()"
            style="font-size:16px;letter-spacing:2px">
        </div>
        <button id="btn_busca_cnpj" onclick="consultarCNPJBusca()" class="btn btn-primary" style="white-space:nowrap">
          <i class="fas fa-search"></i> Consultar Receita
        </button>
      </div>
    </div>
    <div id="cnpj_busca_result"></div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
    <button class="btn btn-primary" id="btn_cadastrar_cnpj" style="display:none" onclick="_cadastrarDoCNPJ()">
      <i class="fas fa-user-plus"></i> Cadastrar este Fornecedor
    </button>
  `);
  setTimeout(()=>document.getElementById('busca_cnpj_input')?.focus(), 200);
}

async function consultarCNPJBusca() {
  const input = document.getElementById('busca_cnpj_input');
  const cnpj = input?.value || '';
  const clean = cnpj.replace(/\D/g,'');
  if (clean.length !== 14) { showToast('CNPJ incompleto – 14 dígitos necessários', 'warning'); return; }

  const btn = document.getElementById('btn_busca_cnpj');
  const card = document.getElementById('cnpj_busca_result');
  if (btn) { btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Consultando...'; }
  if (card) card.innerHTML = '<div style="text-align:center;padding:28px;color:var(--text-muted)"><i class="fas fa-spinner fa-spin fa-2x"></i><br><br>Consultando Receita Federal...</div>';

  const data = await _fetchCNPJ(clean);
  if (btn) { btn.disabled=false; btn.innerHTML='<i class="fas fa-search"></i> Consultar Receita'; }

  if (!data) {
    if (card) card.innerHTML = `
      <div style="background:rgba(220,38,38,0.06);border:1px solid rgba(220,38,38,0.2);border-radius:10px;padding:16px;text-align:center">
        <i class="fas fa-exclamation-triangle fa-2x" style="color:#dc2626;margin-bottom:8px"></i>
        <div style="font-size:13px;font-weight:600;color:var(--text-primary);margin-bottom:4px">CNPJ não encontrado</div>
        <div style="font-size:12px;color:var(--text-muted)">
          O CNPJ pode estar inativo, incorreto ou a consulta foi bloqueada por CORS.<br>
          Você ainda pode <strong>cadastrar manualmente</strong>.
        </div>
        <button onclick="openNovoFornecedorCNPJ('${cnpj}')" class="btn btn-outline-primary btn-sm" style="margin-top:12px">
          <i class="fas fa-edit"></i> Cadastrar Manualmente
        </button>
      </div>`;
    return;
  }

  window._cnpjConsultaResult = data;
  const ok = data.situacao.toUpperCase().includes('ATIVA');
  const existente = FA_FORNECEDORES.find(f => (f.cnpj||'').replace(/\D/g,'') === clean);

  if (card) card.innerHTML = `
    <div style="border-radius:12px;overflow:hidden;border:2px solid ${ok?'#16a34a':'#f59e0b'}">
      <!-- Header -->
      <div style="background:${ok?'linear-gradient(135deg,#16a34a,#059669)':'linear-gradient(135deg,#d97706,#b45309)'};padding:14px 18px;color:#fff">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="font-size:28px">🏢</div>
          <div>
            <div style="font-size:15px;font-weight:800">${data.razao}</div>
            ${data.fantasia?`<div style="font-size:11px;opacity:0.85">Nome Fantasia: ${data.fantasia}</div>`:''}
            <div style="font-size:12px;opacity:0.85;margin-top:2px">
              Situação: <strong>${data.situacao||'—'}</strong> · CNPJ: ${data.cnpj_fmt}
            </div>
          </div>
        </div>
      </div>
      <!-- Dados -->
      <div style="padding:14px;background:var(--bg-card)">
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;margin-bottom:14px">
          ${[
            ['🏭 Atividade', data.atividade.substring(0,50)+(data.atividade.length>50?'...':'')],
            ['📅 Abertura', data.abertura||'—'],
            ['📏 Porte', data.porte||'—'],
            ['🏛️ Natureza', data.natureza.substring(0,35)+(data.natureza.length>35?'...':'')],
            ['💰 Capital', data.capital?'R$ '+Number(data.capital).toLocaleString('pt-BR',{minimumFractionDigits:2}):'—'],
            ['📧 E-mail', data.email||'—'],
            ['📞 Telefone', data.telefone||'—'],
            ['📍 Endereço', `${data.logradouro}${data.numero?' '+data.numero:''}, ${data.bairro}`],
            ['🏙️ Cidade/UF', `${data.cidade}/${data.uf}`],
            ['📮 CEP', data.cep||'—'],
          ].map(([l,v])=>`
            <div style="background:var(--bg-tertiary);border-radius:8px;padding:8px 10px">
              <div style="font-size:11px;color:var(--text-muted);margin-bottom:2px">${l}</div>
              <div style="font-size:12px;font-weight:600;color:var(--text-primary);word-break:break-word">${v||'—'}</div>
            </div>
          `).join('')}
        </div>
        ${existente ? `
          <div style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);border-radius:8px;padding:10px;font-size:12px;color:#92400e">
            <i class="fas fa-info-circle" style="margin-right:6px"></i>
            Este CNPJ já está cadastrado como <strong>${existente.razao_social||existente.nome}</strong>.
            <button onclick="verDetalheFornecedor('${existente.id}');closeModal()" style="margin-left:8px;padding:3px 10px;background:#f59e0b;color:#fff;border:none;border-radius:6px;font-size:11px;cursor:pointer">
              Ver Fornecedor
            </button>
          </div>
        ` : ''}
      </div>
    </div>`;

  const btnCad = document.getElementById('btn_cadastrar_cnpj');
  if (btnCad && !existente) btnCad.style.display='inline-flex';
}

async function _fetchCNPJ(clean) {
  // PRIMEIRO: tenta proxy backend (sem CORS)
  try {
    const _tk = sessionStorage.getItem('fa_token') || localStorage.getItem('fa_token') || '';
    const res = await fetch(`/api/cnpj/${clean}`, { signal: AbortSignal.timeout(12000), headers: { 'Authorization': `Bearer ${_tk}` } });
    if (res.ok) {
      const json = await res.json();
      if (json?.success && json?.data) return json.data;
    }
  } catch(e) { /* fallback para APIs públicas */ }

  // FALLBACK: tenta APIs públicas diretamente (pode falhar por CORS)
  const apis = [
    `https://brasilapi.com.br/api/cnpj/v1/${clean}`,
    `https://receitaws.com.br/v1/cnpj/${clean}`,
  ];
  for (const url of apis) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const json = await res.json();
        if (json && (json.razao_social || json.nome)) {
          return {
            razao:    json.razao_social || json.nome || '',
            fantasia: json.nome_fantasia || json.fantasia || '',
            situacao: json.descricao_situacao_cadastral || json.situacao || 'ATIVA',
            cnpj_fmt: json.cnpj || clean,
            logradouro: json.logradouro || '',
            numero:   json.numero || '',
            bairro:   json.bairro || '',
            cidade:   json.municipio || '',
            uf:       json.uf || '',
            cep:      json.cep || '',
            email:    json.email || '',
            telefone: json.ddd_telefone_1 ? `(${json.ddd_telefone_1}) ${json.telefone_1||''}` : (json.telefone||''),
            porte:    json.descricao_porte || json.porte || '',
            atividade: json.cnae_fiscal_descricao || (json.atividade_principal?.[0]?.text) || '',
            abertura:  json.data_inicio_atividade || json.abertura || '',
            capital:  json.capital_social || 0,
            natureza: json.descricao_natureza_juridica || json.natureza_juridica || '',
            ok: true,
          };
        }
      }
    } catch(e) { /* ignora */ }
  }
  return null;
}

async function _cadastrarDoCNPJ() {
  const r = window._cnpjConsultaResult;
  if (!r) return;
  closeModal();
  // Abre modal de cadastro pré-preenchido
  openNovoFornecedorCNPJ('');
  setTimeout(() => {
    window._cnpjConsultaResult = r;
    _preencherDadosCNPJ();
    // Preenche CNPJ
    const cnpjEl = document.getElementById('nf_cnpj');
    if (cnpjEl) { cnpjEl.value = r.cnpj_fmt; }
  }, 200);
}

function openNovoFornecedorCNPJ(cnpjPre) {
  openNovoFornecedor();
  if (cnpjPre) {
    setTimeout(() => {
      const el = document.getElementById('nf_cnpj');
      if (el) el.value = cnpjPre;
    }, 100);
  }
}

// ─── CADASTRO DE NOVO FORNECEDOR ─────────────────────────────
function openNovoFornecedor() {
  window._cnpjConsultaResult = null;
  window._bureauResult = null;
  openModalWide('Cadastrar Novo Fornecedor', `
    <!-- Busca CNPJ rápida -->
    <div style="background:linear-gradient(135deg,rgba(79,70,229,0.06),rgba(124,58,237,0.04));border:1px solid rgba(79,70,229,0.2);border-radius:10px;padding:14px;margin-bottom:16px">
      <div style="font-size:13px;font-weight:700;color:#4f46e5;margin-bottom:8px">
        <i class="fas fa-search" style="margin-right:6px"></i>Consultar CNPJ na Receita Federal
      </div>
      <div style="display:flex;gap:8px;align-items:flex-end">
        <div style="flex:1">
          <input class="form-control" id="nf_cnpj" type="text" placeholder="00.000.000/0000-00"
            oninput="mascararCNPJ(this)" style="font-size:14px;letter-spacing:1px">
        </div>
        <button id="btn_consultar_cnpj" onclick="consultarCNPJNoCadastro()" class="btn btn-outline-primary" style="white-space:nowrap">
          <i class="fas fa-search"></i> Consultar
        </button>
      </div>
      <div id="cnpj_result_card" style="display:none;margin-top:10px"></div>
    </div>

    <div class="section-divider"><h4>Dados da Empresa</h4></div>
    <div class="form-row">
      <div class="form-group"><label>Razão Social *</label><input class="form-control" id="nf_razao" type="text" placeholder="Razão social completa"></div>
      <div class="form-group"><label>Nome Fantasia</label><input class="form-control" id="nf_fantasia" type="text" placeholder="Nome comercial"></div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Categoria *</label>
        <select class="form-control" id="nf_cat">
          <option>Peças e Componentes</option><option>Lubrificantes</option><option>EPI e Segurança</option>
          <option>Material Elétrico</option><option>Ferramentas</option><option>Combustível</option>
          <option>Transporte e Logística</option><option>TI e Software</option>
          <option>Serviços de Engenharia</option><option>Outros</option>
        </select>
      </div>
      <div class="form-group">
        <label>Status de Cadastro</label>
        <select class="form-control" id="nf_status">
          <option value="Em Homologação">Em Homologação</option>
          <option value="Ativo">Ativo</option>
        </select>
      </div>
    </div>

    <div class="section-divider"><h4>Contato Principal</h4></div>
    <div class="form-row">
      <div class="form-group"><label>Nome do Contato</label><input class="form-control" id="nf_contato" type="text" placeholder="Nome do responsável comercial"></div>
      <div class="form-group"><label>E-mail</label><input class="form-control" id="nf_email" type="email" placeholder="email@fornecedor.com.br"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Telefone</label><input class="form-control" id="nf_tel" type="text" placeholder="(00) 00000-0000"></div>
      <div class="form-group">
        <label>Estado</label>
        <select class="form-control" id="nf_uf">
          <option value="">Selecione...</option>
          <option>AC</option><option>AL</option><option>AM</option><option>AP</option><option>BA</option>
          <option>CE</option><option>DF</option><option>ES</option><option>GO</option><option>MA</option>
          <option>MG</option><option>MS</option><option>MT</option><option>PA</option><option>PB</option>
          <option>PE</option><option>PI</option><option>PR</option><option>RJ</option><option>RN</option>
          <option>RO</option><option>RR</option><option>RS</option><option>SC</option><option>SE</option>
          <option>SP</option><option>TO</option>
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Cidade</label><input class="form-control" id="nf_cidade" type="text" placeholder="Cidade"></div>
      <div class="form-group"><label>Prazo de Pagamento (dias)</label><input class="form-control" id="nf_prazo" type="number" value="30" min="0"></div>
    </div>
    <div class="section-divider"><h4>Dados Financeiros e Crédito</h4></div>
    <div class="form-row">
      <div class="form-group"><label>Faturamento Anual (R$)</label><input class="form-control" id="nf_faturamento" type="number" placeholder="0" min="0" oninput="_marcarCreditoDesatualizado()"></div>
      <div class="form-group"><label>Limite de Crédito Solicitado (R$)</label><input class="form-control" id="nf_limite" type="number" placeholder="0" min="0" oninput="_marcarCreditoDesatualizado()"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Banco</label><input class="form-control" id="nf_banco" type="text" placeholder="Banco"></div>
      <div class="form-group"><label>Agência</label><input class="form-control" id="nf_agencia" type="text" placeholder="0000"></div>
      <div class="form-group"><label>Conta</label><input class="form-control" id="nf_conta" type="text" placeholder="00000-0"></div>
    </div>

    <div style="margin-top:8px">
      <button type="button" onclick="analisarCreditoNoCadastro()" class="btn btn-outline-primary btn-sm">
        <i class="fas fa-gauge-high"></i> Analisar crédito
      </button>
      <button type="button" id="btn_bureau" onclick="consultarBureauNoCadastro()" class="btn btn-secondary btn-sm" style="margin-left:6px">
        <i class="fas fa-building-columns"></i> Consultar bureau
      </button>
      <button type="button" id="btn_receita" onclick="consultarReceitaNoCadastro()" class="btn btn-secondary btn-sm" style="margin-left:6px">
        <i class="fas fa-id-card"></i> Situação cadastral
      </button>
      <button type="button" id="btn_analise" onclick="analiseFinanceiraNoCadastro()" class="btn btn-secondary btn-sm" style="margin-left:6px;background:rgba(37,99,235,.1);border-color:#2563eb;color:#2563eb">
        <i class="fas fa-scale-balanced"></i> Análise financeira
      </button>
      <span style="font-size:11px;color:var(--text-muted);margin-left:8px">Score interno + consulta externa (bureau/Receita) por CNPJ.</span>
      <div id="credito_result" style="display:none;margin-top:10px"></div>
      <div id="analise_result" style="display:none;margin-top:10px"></div>
    </div>

    <div style="margin-top:12px;padding:10px;background:rgba(37,99,235,0.06);border-radius:8px;border:1px solid rgba(37,99,235,0.15)">
      <div style="font-size:12px;color:#2563eb;font-weight:600;margin-bottom:4px"><i class="fas fa-info-circle" style="margin-right:4px"></i>Avaliação IDF</div>
      <div style="font-size:11px;color:var(--text-muted)">Após cadastrar, acesse <strong>IDF Fornecedores</strong> para avaliação completa. O score IDF será exibido nos pedidos e no fechamento comercial.</div>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="salvarNovoFornecedor()">
      <i class="fas fa-save"></i> Cadastrar Fornecedor
    </button>
  `);
}

async function consultarCNPJNoCadastro() {
  const cnpj = document.getElementById('nf_cnpj')?.value || '';
  const clean = cnpj.replace(/\D/g,'');
  if (clean.length !== 14) { showToast('Digite o CNPJ completo (14 dígitos) antes de consultar', 'warning'); return; }

  const btn = document.getElementById('btn_consultar_cnpj');
  const card = document.getElementById('cnpj_result_card');
  if (btn) { btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Consultando...'; }
  if (card) {
    card.style.display='block';
    card.innerHTML='<div style="text-align:center;padding:14px;color:var(--text-muted)"><i class="fas fa-spinner fa-spin"></i> Consultando Receita Federal...</div>';
  }

  const data = await _fetchCNPJ(clean);
  if (btn) { btn.disabled=false; btn.innerHTML='<i class="fas fa-search"></i> Consultar'; }

  if (!data) {
    if (card) card.innerHTML = `<div style="background:rgba(220,38,38,0.06);border:1px dashed rgba(220,38,38,0.3);border-radius:8px;padding:10px;font-size:12px;color:#dc2626">
      <i class="fas fa-exclamation-triangle" style="margin-right:4px"></i>
      CNPJ não localizado ou erro de conexão. Preencha os dados manualmente.
    </div>`;
    return;
  }
  window._cnpjConsultaResult = data;
  const ok = data.situacao.toUpperCase().includes('ATIVA');
  if (card) card.innerHTML = `
    <div style="background:${ok?'rgba(22,163,74,0.06)':'rgba(220,38,38,0.06)'};border:1px solid ${ok?'rgba(22,163,74,0.25)':'rgba(220,38,38,0.25)'};border-radius:8px;padding:10px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:13px;font-weight:700;color:var(--text-primary)">${data.razao}</div>
          <div style="font-size:11px;color:var(--text-muted)">${data.fantasia?'Fantasia: '+data.fantasia+' · ':''}Situação: <strong style="color:${ok?'#16a34a':'#dc2626'}">${data.situacao}</strong> · ${data.cidade}/${data.uf}</div>
        </div>
        <button onclick="_preencherDadosCNPJ()" style="padding:6px 14px;background:#4f46e5;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap">
          <i class="fas fa-magic" style="margin-right:4px"></i>Auto-preencher
        </button>
      </div>
    </div>`;
}

// Máscara CNPJ
function mascararCNPJ(input) {
  let v = input.value.replace(/\D/g, '').substring(0, 14);
  v = v.replace(/^(\d{2})(\d)/, '$1.$2');
  v = v.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
  v = v.replace(/\.(\d{3})(\d)/, '.$1/$2');
  v = v.replace(/(\d{4})(\d)/, '$1-$2');
  input.value = v;
}

// ─── ANÁLISE DE CRÉDITO (no cadastro) ────────────────────────
function _coletarDadosCredito() {
  const consulta = window._cnpjConsultaResult || {};
  const bureau = window._bureauResult || {};
  const statusCad = document.getElementById('nf_status')?.value || '';
  return {
    situacaoCnpj:      bureau.situacao || consulta.situacao || (statusCad === 'Ativo' ? 'ATIVA' : ''),
    dataAbertura:      consulta.abertura || consulta.data_abertura || consulta.inicio_atividade || null,
    faturamentoAnual:  parseFloat(document.getElementById('nf_faturamento')?.value) || bureau.faturamento_estimado || 0,
    limiteSolicitado:  parseFloat(document.getElementById('nf_limite')?.value) || 0,
    scoreInternoIDF:   null,
    // Pendências/protestos do bureau penalizam o score interno.
    pendenciasFinanceiras: (Number(bureau.pendencias) || 0) + (Number(bureau.protestos) || 0),
  };
}

// Consulta o bureau de crédito e realimenta a análise com os dados externos.
async function consultarBureauNoCadastro() {
  const cnpj = document.getElementById('nf_cnpj')?.value || '';
  if (cnpj.replace(/\D/g, '').length !== 14) { showToast('Informe o CNPJ completo antes de consultar o bureau', 'warning'); return; }
  if (!(window.DB && typeof DB.consultarCredito === 'function')) { showToast('Consulta de bureau indisponível.', 'error'); return; }
  const btn = document.getElementById('btn_bureau');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Consultando...'; }
  const r = await DB.consultarCredito(cnpj);
  if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-building-columns"></i> Consultar bureau'; }
  if (!r) { showToast('Bureau indisponível no momento.', 'error'); return; }
  window._bureauResult = r;
  if (!document.getElementById('nf_faturamento').value && r.faturamento_estimado) {
    document.getElementById('nf_faturamento').value = r.faturamento_estimado;
  }
  analisarCreditoNoCadastro(); // reavalia já com os dados do bureau
  showToast(`Bureau (${r.fonte}): score ${r.score_externo} · ${r.situacao} · ${r.pendencias} pendência(s)`, 'info', 6000);
}

async function consultarReceitaNoCadastro() {
  const cnpj = document.getElementById('nf_cnpj')?.value || '';
  if (cnpj.replace(/\D/g, '').length !== 14) { showToast('Informe o CNPJ completo antes de consultar a situação cadastral', 'warning'); return; }
  if (!(window.DB && typeof DB.consultarReceita === 'function')) { showToast('Consulta de situação cadastral indisponível.', 'error'); return; }
  const btn = document.getElementById('btn_receita');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Consultando...'; }
  const r = await DB.consultarReceita(cnpj);
  if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-id-card"></i> Situação cadastral'; }
  if (!r) { showToast('Consulta de situação cadastral indisponível no momento.', 'error'); return; }
  window._receitaResult = r;
  const tipo = r.regular ? 'success' : 'error';
  const aviso = r.regular ? '' : ' — emissão de pedido será bloqueada';
  showToast(`Receita (${r.fonte}): situação ${r.situacao_cadastral}${aviso}`, tipo, 7000);
}

async function analiseFinanceiraNoCadastro() {
  const cnpj = document.getElementById('nf_cnpj')?.value || '';
  if (cnpj.replace(/\D/g, '').length !== 14) { showToast('Informe o CNPJ completo antes da análise financeira', 'warning'); return; }
  if (!(window.DB && typeof DB.analiseFinanceira === 'function')) { showToast('Análise financeira indisponível.', 'error'); return; }
  const btn = document.getElementById('btn_analise');
  const box = document.getElementById('analise_result');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analisando...'; }
  const r = await DB.analiseFinanceira(cnpj);
  if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-scale-balanced"></i> Análise financeira'; }
  if (!r) { showToast('Não foi possível gerar a análise agora.', 'error'); return; }
  window._analiseResult = r;
  const cor = r.recomendacao === 'Aprovar' ? '#16a34a' : (r.recomendacao === 'Recusar' ? '#dc2626' : '#d97706');
  const fatores = (r.fatores || []).map(f => `
    <li style="display:flex;justify-content:space-between;gap:8px;padding:2px 0;font-size:12px">
      <span>${f.fator} ${f.detalhe ? `<span style="color:var(--text-muted)">(${f.detalhe})</span>` : ''}</span>
      <strong style="color:${f.impacto >= 0 ? '#16a34a' : '#dc2626'}">${f.impacto > 0 ? '+' : ''}${f.impacto}</strong>
    </li>`).join('');
  if (box) {
    box.style.display = 'block';
    box.innerHTML = `
      <div style="border:1px solid ${cor}40;background:${cor}0d;border-radius:10px;padding:12px">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
          <div>
            <span style="font-size:24px;font-weight:800;color:${cor}">${r.score}</span><span style="font-size:11px;color:var(--text-muted)">/100</span>
            <span style="margin-left:8px;padding:3px 10px;border-radius:12px;font-size:12px;font-weight:700;background:${cor}1f;color:${cor}">${r.recomendacao} · risco ${r.nivel}</span>
          </div>
          <div style="font-size:11px;color:var(--text-muted)">Situação: ${r.situacao_cadastral} · ${r.pendencias} pend. · ${r.protestos} prot.</div>
        </div>
        <ul style="list-style:none;padding:0;margin:8px 0 0">${fatores}</ul>
        <div style="font-size:10px;color:var(--text-muted);margin-top:6px">Parecer automático (bureau + Receita) — apoio à homologação Financeiro/Compliance.</div>
      </div>`;
  }
  showToast(`Análise: ${r.recomendacao} (score ${r.score}/100, risco ${r.nivel})`, r.recomendacao === 'Recusar' ? 'error' : 'info', 6000);
}

function _renderCreditoResult(res) {
  const box = document.getElementById('credito_result');
  if (!box) return;
  box.style.display = 'block';
  const fatoresHtml = (res.fatores || []).map(f =>
    `<li style="display:flex;justify-content:space-between;gap:8px;padding:2px 0">
       <span>${f.fator}${f.detalhe ? ` <span style="color:var(--text-muted)">(${f.detalhe})</span>` : ''}</span>
       <strong style="color:${f.impacto >= 0 ? '#16a34a' : '#dc2626'}">${f.impacto >= 0 ? '+' : ''}${f.impacto}</strong>
     </li>`).join('');
  box.innerHTML = `
    <div style="border:1px solid ${res.cor}40;background:${res.cor}0d;border-radius:10px;padding:12px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px">
        <div>
          <span style="font-size:26px;font-weight:800;color:${res.cor}">${res.score}</span>
          <span style="font-size:12px;color:var(--text-muted)">/100</span>
          <span style="margin-left:8px;padding:3px 10px;border-radius:12px;font-size:12px;font-weight:700;background:${res.cor}1f;color:${res.cor}">Classe ${res.classe} · ${res.risco}</span>
        </div>
        ${res.limiteSugerido > 0 ? `<button type="button" class="btn btn-secondary btn-sm" onclick="_usarLimiteSugerido(${res.limiteSugerido})"><i class="fas fa-wand-magic-sparkles"></i> Usar limite sugerido: R$ ${res.limiteSugerido.toLocaleString('pt-BR')}</button>` : ''}
      </div>
      ${fatoresHtml ? `<ul style="list-style:none;margin:10px 0 0;padding:0;font-size:12px">${fatoresHtml}</ul>` : ''}
    </div>`;
}

function analisarCreditoNoCadastro() {
  if (typeof window.analisarCreditoFornecedor !== 'function') {
    showToast('Motor de análise de crédito não carregado.', 'error'); return;
  }
  const res = window.analisarCreditoFornecedor(_coletarDadosCredito());
  window._creditoResult = res;
  _renderCreditoResult(res);
}

function _usarLimiteSugerido(valor) {
  const el = document.getElementById('nf_limite');
  if (el) { el.value = valor; _marcarCreditoDesatualizado(); }
}

// Quando o usuário muda faturamento/limite, a análise exibida fica obsoleta.
function _marcarCreditoDesatualizado() { window._creditoResult = null; }

async function salvarNovoFornecedor() {
  const razao = (document.getElementById('nf_razao')?.value || '').trim();
  if (!razao) { showToast('Informe a Razão Social', 'warning'); return; }

  const cnpj = document.getElementById('nf_cnpj')?.value || '';
  if (cnpj) {
    const cnpjLimpo = cnpj.replace(/\D/g, '');
    if (cnpjLimpo.length !== 14) { showToast('CNPJ deve ter 14 dígitos', 'warning'); return; }
    if (!_validarDigitosCNPJ(cnpjLimpo)) {
      showToast('⚠️ CNPJ inválido — verifique os dígitos verificadores.', 'error'); return;
    }
    const existente = FA_FORNECEDORES.find(f => f.cnpj && f.cnpj.replace(/\D/g,'') === cnpjLimpo);
    if (existente) {
      showToast(`⚠️ CNPJ já cadastrado para "${existente.nome_fantasia || existente.razao_social || existente.nome}". Verifique antes de continuar.`, 'error', 6000);
      return;
    }
  }

  // Validação de e-mail (quando informado)
  const email = document.getElementById('nf_email')?.value?.trim() || '';
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showToast('E-mail inválido — verifique o formato.', 'warning'); return;
  }

  // Garante uma análise de crédito atual (recalcula se o usuário não clicou).
  const credito = window._creditoResult || window.analisarCreditoFornecedor(_coletarDadosCredito());

  const btn = document.querySelector('[onclick="salvarNovoFornecedor()"]');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...'; }

  const statusSelecionado = document.getElementById('nf_status')?.value || 'Em Homologação';
  const prazo = parseInt(document.getElementById('nf_prazo')?.value) || 30;
  const contato = document.getElementById('nf_contato')?.value?.trim() || null;
  const payload = {
    nome:            document.getElementById('nf_fantasia')?.value?.trim() || razao,
    razao_social:    razao,
    nome_fantasia:   document.getElementById('nf_fantasia')?.value?.trim() || null,
    cnpj:            cnpj,
    categoria:       document.getElementById('nf_cat')?.value || 'Outros',
    // Envia os dois nomes de campo p/ compatibilidade Express (contato/prazo_entrega)
    contato:         contato,
    contato_nome:    contato,
    email:           email || null,
    telefone:        document.getElementById('nf_tel')?.value?.trim() || null,
    cidade:          document.getElementById('nf_cidade')?.value?.trim() || null,
    estado:          document.getElementById('nf_uf')?.value || null,
    prazo_entrega:   prazo,
    prazo_pagamento: prazo,
    banco:           document.getElementById('nf_banco')?.value?.trim() || null,
    agencia:         document.getElementById('nf_agencia')?.value?.trim() || null,
    conta:           document.getElementById('nf_conta')?.value?.trim() || null,
    faturamento_anual: parseFloat(document.getElementById('nf_faturamento')?.value) || 0,
    limite_credito:    parseFloat(document.getElementById('nf_limite')?.value) || 0,
    score_credito:        credito.score,
    classificacao_credito: credito.classe,
    analise_credito:   JSON.stringify(credito),
    status:          statusSelecionado,
    ativo:           statusSelecionado === 'Ativo' ? 1 : (statusSelecionado === 'Inativo' ? 0 : 1),
  };

  try {
    // Camada DB: funciona tanto no Worker (canônico) quanto no Express.
    // Robusto ao formato de resposta (não depende de json.success).
    const novo = await DB.fornecedores.criar(payload);
    if (novo && novo._local) {
      showToast('Salvo localmente (servidor indisponível). Sincroniza quando voltar.', 'warning', 5000);
    } else {
      showToast(`Fornecedor "${payload.nome}" cadastrado · crédito ${credito.score}/100 (classe ${credito.classe}).`, 'success', 5000);
    }
    logAction('Cadastro', 'Fornecedores', `Novo fornecedor: ${razao} (crédito ${credito.score}/${credito.classe})`);
    closeModal();
    await loadFornecedores();
    if (typeof _syncFornecedoresIDF === 'function') _syncFornecedoresIDF();
    renderFornecedores();
  } catch (e) {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Cadastrar Fornecedor'; }
    showToast('Erro ao cadastrar fornecedor: ' + e.message, 'error');
  }
}

// ─── EDIÇÃO DE FORNECEDOR ────────────────────────────────────
function editarFornecedor(id) {
  const f = FA_FORNECEDORES.find(x => x.id === id);
  if (!f) return;
  openModalWide(`Editar Fornecedor – ${f.nome_fantasia || f.nome}`, `
    <div class="form-row">
      <div class="form-group"><label>Razão Social</label><input class="form-control" id="ef_razao" type="text" value="${f.razao_social || ''}"></div>
      <div class="form-group"><label>Nome Fantasia</label><input class="form-control" id="ef_fantasia" type="text" value="${f.nome_fantasia||f.nome||''}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>CNPJ</label><input class="form-control" id="ef_cnpj" type="text" value="${f.cnpj||''}"></div>
      <div class="form-group"><label>Categoria</label>
        <select class="form-control" id="ef_cat">
          ${['Peças e Componentes','Lubrificantes','EPI e Segurança','Material Elétrico','Ferramentas','Combustível','Transporte e Logística','TI e Software','Outros'].map(c => `<option ${f.categoria===c?'selected':''}>${c}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>E-mail</label><input class="form-control" id="ef_email" type="email" value="${f.contato_email||''}"></div>
      <div class="form-group"><label>Telefone</label><input class="form-control" id="ef_tel" type="text" value="${f.contato_telefone||''}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Cidade</label><input class="form-control" id="ef_cidade" type="text" value="${f.cidade||''}"></div>
      <div class="form-group"><label>Estado</label>
        <select class="form-control" id="ef_uf">
          ${['MG','SP','RJ','GO','MT','PA','BA','PE','AM','PR','RS','SC','Outro'].map(e => `<option ${f.estado===e?'selected':''}>${e}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Prazo Pgto. (dias)</label><input class="form-control" id="ef_prazo" type="number" value="${f.prazo_pagamento||30}"></div>
      <div class="form-group"><label>Limite de Crédito (R$)</label><input class="form-control" id="ef_limite" type="number" value="${f.limite_credito||0}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Status</label>
        <select class="form-control" id="ef_status">
          ${['Ativo','Em Homologação','Inativo','Bloqueado','Suspenso'].map(s => `<option value="${s}" ${f.status===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label>Documentos OK?</label>
        <select class="form-control" id="ef_docs">
          <option value="true" ${f.documentos_ok?'selected':''}>Sim – Documentação Completa</option>
          <option value="false" ${!f.documentos_ok?'selected':''}>Não – Pendências</option>
        </select>
      </div>
    </div>
    <div style="margin:12px 0 8px;font-size:12px;font-weight:700;color:var(--fa-teal)"><i class="fas fa-university" style="margin-right:6px"></i>Dados Bancários / PIX</div>
    <div class="form-row">
      <div class="form-group"><label>Banco</label><input class="form-control" id="ef_banco" type="text" value="${f.banco||''}" placeholder="Ex: Bradesco, Itaú..."></div>
      <div class="form-group"><label>Agência</label><input class="form-control" id="ef_agencia" type="text" value="${f.agencia||''}" placeholder="0000-0"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Conta</label><input class="form-control" id="ef_conta" type="text" value="${f.conta||''}" placeholder="00000-0"></div>
      <div class="form-group"><label>Tipo de Conta</label>
        <select class="form-control" id="ef_tipo_conta">
          ${['Corrente','Poupança','Pagamento'].map(t=>`<option ${(f.tipo_conta||'Corrente')===t?'selected':''}>${t}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Chave PIX</label><input class="form-control" id="ef_pix" type="text" value="${f.pix||''}" placeholder="CNPJ, e-mail, telefone ou chave aleatória"></div>
      <div class="form-group"><label>Tipo da Chave PIX</label>
        <select class="form-control" id="ef_pix_tipo">
          ${['CNPJ','E-mail','Telefone','Aleatória'].map(t=>`<option ${(f.pix_tipo||'CNPJ')===t?'selected':''}>${t}</option>`).join('')}
        </select>
      </div>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="salvarEdicaoFornecedor('${id}')">
      <i class="fas fa-save"></i> Salvar Alterações
    </button>
  `);
}

async function salvarEdicaoFornecedor(id) {
  const btn = document.querySelector('[onclick="salvarEdicaoFornecedor(\''+id+'\')"]');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...'; }

  const statusSel = document.getElementById('ef_status')?.value || 'Ativo';
  const novoCNPJ  = (document.getElementById('ef_cnpj')?.value || '').trim();
  const novoEmail = (document.getElementById('ef_email')?.value || '').trim();
  const novoBanco = (document.getElementById('ef_banco')?.value || '').trim();
  const novaConta = (document.getElementById('ef_conta')?.value || '').trim();

  // Verifica se campos críticos foram alterados → exige confirmação (2 níveis)
  const fAtual = FA_FORNECEDORES.find(f => f.id === id);
  if (fAtual) {
    const mudouCNPJ  = novoCNPJ  && novoCNPJ  !== (fAtual.cnpj    || '').trim();
    const mudouEmail = novoEmail && novoEmail !== (fAtual.email    || fAtual.contato_email || '').trim();
    const mudouBanco = novoBanco && novoBanco !== (fAtual.banco    || '').trim();
    const mudouConta = novaConta && novaConta !== (fAtual.conta    || '').trim();
    const camposCriticos = [
      mudouCNPJ  && 'CNPJ',
      mudouEmail && 'E-mail',
      mudouBanco && 'Banco',
      mudouConta && 'Conta Bancária',
    ].filter(Boolean);

    if (camposCriticos.length > 0 && !window._forn_confirmouAlteracaoCritica) {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Salvar Alterações'; }
      openModal('⚠️ Alteração de Dados Críticos – Confirmação Necessária',
        `<div style="background:#fef3c7;border:1px solid #fde68a;border-radius:10px;padding:14px 18px;margin-bottom:16px">
          <div style="font-size:13px;font-weight:700;color:#92400e;margin-bottom:8px">
            <i class="fas fa-exclamation-triangle" style="margin-right:8px"></i>Política de Dados — Aprovação em 2 Níveis
          </div>
          <div style="font-size:12px;color:#78350f;line-height:1.7">
            Os seguintes campos <strong>críticos</strong> foram alterados:<br>
            <strong style="color:#dc2626">${camposCriticos.join(', ')}</strong><br><br>
            Alterações em dados críticos de fornecedor requerem confirmação explícita para evitar fraudes e pagamentos indevidos.
          </div>
        </div>
        <div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px">
          <i class="fas fa-info-circle" style="color:#3b82f6;margin-right:6px"></i>
          Confirme que você autorizou esta alteração e que ela foi verificada por um segundo responsável.
        </div>`,
        `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
         <button class="btn btn-warning" onclick="window._forn_confirmouAlteracaoCritica=true;closeModal();salvarEdicaoFornecedor('${id}')">
           <i class="fas fa-check-double"></i> Confirmar Alteração Crítica
         </button>`
      );
      return;
    }
    // Reset flag após uso
    window._forn_confirmouAlteracaoCritica = false;
  }

  const payload = {
    nome:            document.getElementById('ef_fantasia')?.value?.trim() || document.getElementById('ef_razao')?.value?.trim(),
    razao_social:    document.getElementById('ef_razao')?.value?.trim(),
    cnpj:            document.getElementById('ef_cnpj')?.value?.trim(),
    categoria:       document.getElementById('ef_cat')?.value,
    email:           document.getElementById('ef_email')?.value?.trim(),
    telefone:        document.getElementById('ef_tel')?.value?.trim(),
    cidade:          document.getElementById('ef_cidade')?.value?.trim(),
    estado:          document.getElementById('ef_uf')?.value,
    prazo_pagamento: parseInt(document.getElementById('ef_prazo')?.value) || 30,
    limite_credito:  parseFloat(document.getElementById('ef_limite')?.value) || 0,
    ativo:           ['Ativo', 'Em Homologação'].includes(statusSel) ? 1 : 0,
    status:          statusSel,
    documentos_ok:   document.getElementById('ef_docs')?.value === 'true',
    banco:           document.getElementById('ef_banco')?.value?.trim(),
    agencia:         document.getElementById('ef_agencia')?.value?.trim(),
    conta:           document.getElementById('ef_conta')?.value?.trim(),
    tipo_conta:      document.getElementById('ef_tipo_conta')?.value,
    pix:             document.getElementById('ef_pix')?.value?.trim(),
    pix_tipo:        document.getElementById('ef_pix_tipo')?.value
  };

  try {
    const token = sessionStorage.getItem('fa_token') || localStorage.getItem('fa_token') || '';
    const res = await fetch(`/api/fornecedores/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Erro ao salvar');

    logAction('Edição', 'Fornecedores', `Fornecedor atualizado: ${payload.nome}`);
    closeModal();
    showToast('Fornecedor atualizado com sucesso!', 'success');
    await loadFornecedores();
    renderFornecedores();
  } catch (e) {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Salvar Alterações'; }
    showToast('Erro ao salvar: ' + e.message, 'error');
  }
}

// ─── EXPORTAR ────────────────────────────────────────────────
// Exportação para Excel (.xlsx real, backend multi-tenant) — substitui o CSV
// que não neutralizava fórmulas.
function exportFornecedores(ev) { nexusBaixarXLSX('/api/fornecedores/export.xlsx', ev); }

function openNovoPedidoFor(forId) {
  navigate('pedidos');
  setTimeout(() => openNovoPedido(forId), 300);
}

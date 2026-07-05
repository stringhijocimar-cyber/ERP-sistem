// =====================================================
// Fraser Alexander ERP v6.1 – Módulo Almoxarifado
// Estoque, Movimentos, Empréstimos, Inventário, Rastreabilidade
// =====================================================

// ─── Helpers de storage ────────────────────────────

// Normaliza material do formato antigo (seed_demo) para o formato v6.1
function _normalizarMaterial(m) {
  if (!m) return m;
  // Já está no novo formato
  if (m.nome !== undefined) return m;
  // Converte do formato antigo { descricao, estoque, min, max, custo_medio, local, ... }
  return {
    id:              m.id,
    codigo:          m.codigo || m.id,
    nome:            m.descricao || m.nome || '—',
    categoria:       m.categoria || 'Geral',
    tipo:            m.tipo || 'Material',
    unidade:         m.unidade || 'un',
    estoque_atual:   typeof m.estoque_atual !== 'undefined' ? m.estoque_atual : (typeof m.estoque !== 'undefined' ? m.estoque : 0),
    estoque_minimo:  typeof m.estoque_minimo !== 'undefined' ? m.estoque_minimo : (m.min || 0),
    estoque_maximo:  typeof m.estoque_maximo !== 'undefined' ? m.estoque_maximo : (m.max || 0),
    preco_unitario:  m.preco_unitario || m.custo_medio || 0,
    localizacao:     m.localizacao || m.local || '',
    marca:           m.marca || '',
    modelo:          m.modelo || '',
    numero_serie:    m.numero_serie || '',
    descricao:       m.descricao || m.nome || '',
    ativo:           typeof m.ativo !== 'undefined' ? m.ativo : true,
    ultima_mov:      m.ultima_mov || m.ultima_entrada || null,
    criado_em:       m.criado_em || m.ultima_mov || new Date().toISOString(),
  };
}

// Normaliza movimento do formato antigo (seed_demo) para o formato v6.1
function _normalizarMovimento(mov) {
  if (!mov) return mov;
  // Já está no novo formato (tem material_nome ou tipo correto)
  if (mov.material_nome !== undefined) return mov;
  // Converte do formato antigo { material_id, material, qtd, destino, ... }
  return {
    id:             mov.id,
    numero:         mov.numero || mov.id,
    tipo:           mov.tipo === 'Entrada' ? 'Entrada' : 'Saída',
    subtipo:        mov.subtipo || '',
    material_id:    mov.material_id,
    material_nome:  mov.material || mov.material_nome || '—',
    material_codigo:mov.material_codigo || mov.material_id || '',
    quantidade:     mov.quantidade || mov.qtd || 0,
    unidade:        mov.unidade || 'un',
    local_destino:  mov.local_destino || mov.destino || '',
    responsavel:    mov.responsavel || 'Sistema',
    solicitante:    mov.solicitante || mov.responsavel || '',
    pedido_numero:  mov.pedido_numero || mov.pedido || '',
    nota_fiscal:    mov.nota_fiscal || '',
    status:         mov.status || 'Ativo',
    estoque_antes:  mov.estoque_antes ?? null,
    estoque_depois: mov.estoque_depois ?? null,
    observacoes:    mov.observacoes || mov.obs || '',
    data:           mov.data || mov.criado_em,
    criado_em:      mov.criado_em || mov.data || new Date().toISOString(),
  };
}

function _getMovimentos() {
  // Lê tanto fa_almox_movimentos (v6.1) quanto fa_mov_almox (seed_demo) e une os dois
  const novo   = JSON.parse(localStorage.getItem('fa_almox_movimentos') || '[]');
  const antigo = JSON.parse(localStorage.getItem('fa_mov_almox') || '[]');
  // Junta evitando duplicatas por id
  const ids = new Set(novo.map(m => m.id));
  const unidos = [...novo, ...antigo.filter(m => !ids.has(m.id)).map(_normalizarMovimento)];
  return unidos;
}
function _saveMovimentos(d)   { return localStorage.setItem('fa_almox_movimentos', JSON.stringify(d)); }

function _getEstoque() {
  // fa_estoque_v2 pode ser object {id: qty} ou array de materiais (formato antigo)
  const raw = JSON.parse(localStorage.getItem('fa_estoque_v2') || '{}');
  if (Array.isArray(raw)) {
    // Converte array para object { id: estoque_atual }
    const obj = {};
    raw.forEach(m => { obj[m.id] = typeof m.estoque_atual !== 'undefined' ? m.estoque_atual : (m.estoque || 0); });
    return obj;
  }
  return raw;
}
function _saveEstoque(d)      { return localStorage.setItem('fa_estoque_v2', JSON.stringify(d)); }

function _getMateriais() {
  const dados = JSON.parse(localStorage.getItem('fa_materiais') || '[]');
  return dados.map(_normalizarMaterial);
}
function _saveMateriais(d)    { return localStorage.setItem('fa_materiais', JSON.stringify(d)); }
function _getEmprestimos()    { return JSON.parse(localStorage.getItem('fa_emprestimos') || '[]'); }
function _saveEmprestimos(d)  { return localStorage.setItem('fa_emprestimos', JSON.stringify(d)); }
function _getInventarios()    { return JSON.parse(localStorage.getItem('fa_inventarios') || '[]'); }
function _saveInventarios(d)  { return localStorage.setItem('fa_inventarios', JSON.stringify(d)); }

// ─── Estado da aba ativa ───────────────────────────
let _almoxAba = 'estoque'; // estoque | movimentos | emprestimos | inventario | cadastro

// =====================================================
// RENDER PRINCIPAL
// =====================================================
function renderAlmoxarifado() {
  if (!hasPermission('almoxarifado', 'view')) { renderAcessoNegado(); return; }

  // Usa dados do localStorage IMEDIATAMENTE (sem await)
  const materiais  = _getMateriais();
  const movimentos = _getMovimentos();
  const emprestimos = _getEmprestimos();
  const estoque    = _getEstoque();
  const canCreate  = hasPermission('almoxarifado', 'create');

  // KPIs
  const entradas     = movimentos.filter(m => m.tipo === 'Entrada').length;
  const saidas       = movimentos.filter(m => m.tipo === 'Saída').length;
  const empAtivos    = emprestimos.filter(e => e.status === 'Ativo').length;
  const empAtrasados = emprestimos.filter(e => {
    if (e.status !== 'Ativo' || !e.data_prevista_devolucao) return false;
    return new Date(e.data_prevista_devolucao) < new Date();
  }).length;
  const itensBaixo   = materiais.filter(m => {
    const qty = estoque[m.id] ?? m.estoque_atual ?? 0;
    return qty < (m.estoque_minimo || 0);
  }).length;

  // Sincroniza API em background sem bloquear a renderização
  _almoxSincronizarAPI();
  // Painel real do servidor (reposição + valorização por custo médio).
  if (typeof _carregarEstoqueReal === 'function') setTimeout(_carregarEstoqueReal, 0);

  document.getElementById('mainContent').innerHTML = `
    <div class="page-header">
      <div class="page-title">
        <h2><i class="fas fa-boxes" style="color:var(--fa-teal);margin-right:8px"></i>Almoxarifado</h2>
        <p>Estoque · Movimentações · Empréstimos · Inventário</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary btn-sm" onclick="exportarMovimentos()">
          <i class="fas fa-download"></i> Exportar
        </button>
        ${canCreate ? `
        <button class="btn btn-primary btn-sm" onclick="abrirCadastroMaterial()">
          <i class="fas fa-plus"></i> Novo Item
        </button>
        <button class="btn btn-success btn-sm" onclick="abrirEntradaMaterial()">
          <i class="fas fa-arrow-down"></i> Entrada
        </button>
        <button class="btn btn-warning btn-sm" onclick="abrirSaidaMaterial()">
          <i class="fas fa-arrow-up"></i> Saída
        </button>
        <button class="btn btn-info btn-sm" onclick="abrirEmprestimo()">
          <i class="fas fa-hand-holding"></i> Empréstimo
        </button>` : ''}
      </div>
    </div>

    <!-- KPIs -->
    <div class="kpi-grid" style="grid-template-columns:repeat(5,1fr);margin-bottom:20px">
      <div class="kpi-card">
        <div class="kpi-label">Itens Cadastrados</div>
        <div class="kpi-value">${materiais.length}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Entradas</div>
        <div class="kpi-value" style="color:var(--green)">${entradas}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Saídas</div>
        <div class="kpi-value" style="color:var(--orange)">${saidas}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Empréstimos Ativos</div>
        <div class="kpi-value" style="color:${empAtrasados>0?'var(--red)':'var(--fa-teal)'}">${empAtivos}${empAtrasados>0?` <span style="font-size:12px;color:var(--red)">(${empAtrasados} atrasados)</span>`:''}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Abaixo do Mínimo</div>
        <div class="kpi-value" style="color:${itensBaixo>0?'var(--red)':'var(--green)'}">${itensBaixo}</div>
      </div>
    </div>

    <!-- Painel real do servidor: reposição + valorização (custo médio) -->
    <div id="estoqueRealPanel"></div>

    <!-- Barra de pesquisa rápida global -->
    <div class="search-bar" style="margin-bottom:16px;border-radius:var(--radius);border:1.5px solid var(--border);background:var(--bg-secondary)">
      <div class="search-input-wrapper" style="flex:1">
        <i class="fas fa-search"></i>
        <input type="text" class="search-input" id="almoxQuickSearch"
          placeholder="Pesquisa rápida: item, código, categoria, localização…"
          oninput="_almoxQuickFilter(this.value)"
          autocomplete="off">
      </div>
      <select class="filter-select" id="almoxQuickCategoria" onchange="_almoxQuickFilter(document.getElementById('almoxQuickSearch').value)">
        <option value="">Todas as Categorias</option>
        <option>Material</option>
        <option>Equipamento</option>
        <option>EPI</option>
        <option>Ferramenta</option>
        <option>Consumivel</option>
      </select>
      <button class="btn btn-secondary btn-sm" onclick="_almoxQuickSearch()" title="Busca global completa">
        <i class="fas fa-expand-alt"></i> Busca Completa
      </button>
    </div>

    <!-- Abas -->
    <div style="display:flex;gap:4px;margin-bottom:16px;border-bottom:2px solid var(--border-color);padding-bottom:0">
      ${[
        ['estoque','fas fa-cube','Estoque'],
        ['movimentos','fas fa-exchange-alt','Movimentações'],
        ['emprestimos','fas fa-hand-holding','Empréstimos'],
        ['inventario','fas fa-clipboard-list','Inventário'],
        ['cadastro','fas fa-th-list','Catálogo'],
      ].map(([aba, icon, label]) => `
        <button onclick="_almoxSetAba('${aba}')" id="almoxTab_${aba}"
          style="border:none;background:none;padding:8px 18px;cursor:pointer;font-size:13px;font-weight:600;
                 color:${_almoxAba===aba?'var(--fa-teal)':'var(--text-muted)'};
                 border-bottom:${_almoxAba===aba?'2px solid var(--fa-teal)':'2px solid transparent'};
                 margin-bottom:-2px;transition:all .2s">
          <i class="${icon}" style="margin-right:5px"></i>${label}
        </button>`).join('')}
    </div>

    <!-- Conteúdo das abas -->
    <div id="almoxConteudo"></div>`;

  _almoxRenderAba();
}

// Quick-filter: bridges the global search bar to the active tab's search input
function _almoxQuickFilter(val) {
  const aba = _almoxAba;
  // Propagate value to active tab's dedicated search input if it exists
  const mapInput = {
    estoque:     'almoxBuscaEstoque',
    movimentos:  'almoxBuscaMov',
    emprestimos: 'almoxBuscaEmp',
    inventario:  'almoxBuscaInv',
    cadastro:    'almoxBuscaCatalogo',
  };
  const targetId = mapInput[aba];
  if (targetId) {
    const el = document.getElementById(targetId);
    if (el) {
      el.value = val;
      el.dispatchEvent(new Event('input'));
      return;
    }
  }
  // Fallback: re-render active tab (it will read almoxQuickSearch value)
  _almoxRenderAba();
}

// Button: navigate to busca_global with pre-filled query
function _almoxQuickSearch() {
  const q = (document.getElementById('almoxQuickSearch')?.value || '').trim();
  if (typeof _bgQuery !== 'undefined') window._bgQuery = q;
  if (typeof navigate === 'function') navigate('busca_global');
}
function _almoxSincronizarAPI() {
  Promise.all([
    fetch('/api/materiais').then(r => r.json()).catch(() => null),
    fetch('/api/movimentos-estoque?limit=500').then(r => r.json()).catch(() => null),
    fetch('/api/emprestimos').then(r => r.json()).catch(() => null),
  ]).then(function(results) {
    var resMat = results[0], resMov = results[1], resEmp = results[2];
    var atualizado = false;
    if (resMat && resMat.success && Array.isArray(resMat.data) && resMat.data.length) {
      _saveMateriais(resMat.data); atualizado = true;
    }
    if (resMov && resMov.success && Array.isArray(resMov.data) && resMov.data.length) {
      _saveMovimentos(resMov.data); atualizado = true;
    }
    if (resEmp && resEmp.success && Array.isArray(resEmp.data) && resEmp.data.length) {
      _saveEmprestimos(resEmp.data); atualizado = true;
    }
    if (atualizado && document.getElementById('almoxConteudo')) {
      _almoxRenderAba();
    }
  }).catch(function() { /* silencioso */ });
}

function _almoxSetAba(aba) {
  _almoxAba = aba;
  // Atualiza estilo das abas
  ['estoque','movimentos','emprestimos','inventario','cadastro'].forEach(a => {
    const btn = document.getElementById(`almoxTab_${a}`);
    if (!btn) return;
    btn.style.color = a === aba ? 'var(--fa-teal)' : 'var(--text-muted)';
    btn.style.borderBottom = a === aba ? '2px solid var(--fa-teal)' : '2px solid transparent';
  });
  _almoxRenderAba();
}

function _almoxRenderAba() {
  const el = document.getElementById('almoxConteudo');
  if (!el) return;
  switch (_almoxAba) {
    case 'estoque':     _renderAbaEstoque(el); break;
    case 'movimentos':  _renderAbaMovimentos(el); break;
    case 'emprestimos': _renderAbaEmprestimos(el); break;
    case 'inventario':  _renderAbaInventario(el); break;
    case 'cadastro':    _renderAbaCatalogo(el); break;
  }
}

// =====================================================
// ABA: POSIÇÃO DE ESTOQUE
// =====================================================
function _renderAbaEstoque(el) {
  const materiais = _getMateriais();
  const estoque   = _getEstoque();
  const busca     = (document.getElementById('almoxBuscaEstoque')?.value ||
                     document.getElementById('almoxQuickSearch')?.value || '').toLowerCase();
  const catFiltro = (document.getElementById('almoxFiltroTipo')?.value ||
                     document.getElementById('almoxQuickCategoria')?.value || '');

  let lista = materiais.filter(m => m.ativo !== 0 && m.ativo !== false);
  if (busca) lista = lista.filter(m =>
    (m.nome||'').toLowerCase().includes(busca) ||
    (m.codigo||'').toLowerCase().includes(busca) ||
    (m.categoria||'').toLowerCase().includes(busca) ||
    (m.localizacao||'').toLowerCase().includes(busca)
  );
  if (catFiltro) lista = lista.filter(m => (m.tipo||m.categoria||'') === catFiltro);

  const categorias = [...new Set(materiais.map(m => m.categoria).filter(Boolean))];

  el.innerHTML = `
    <div class="card">
      <div class="card-header" style="display:flex;justify-content:space-between;align-items:center">
        <h4><i class="fas fa-cube" style="color:var(--fa-teal);margin-right:6px"></i>Posição de Estoque (${lista.length})</h4>
        <div style="display:flex;gap:8px;align-items:center">
          <input type="text" id="almoxBuscaEstoque" class="form-control" style="width:220px;font-size:12px"
            placeholder="Buscar item..." value="${busca}"
            oninput="_renderAbaEstoque(document.getElementById('almoxConteudo'))">
          <select class="form-control" id="almoxFiltroTipo" style="width:140px;font-size:12px"
            onchange="_renderAbaEstoque(document.getElementById('almoxConteudo'))">
            <option value="">Todos os tipos</option>
            ${['Material','Equipamento','EPI','Ferramenta','Consumivel'].map(t =>
              `<option value="${t}">${t}</option>`).join('')}
          </select>
        </div>
      </div>
      <div style="overflow-x:auto">
        <table class="data-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Item / Descrição</th>
              <th>Tipo</th>
              <th>Localização</th>
              <th>Estoque</th>
              <th>Mín.</th>
              <th>Valor Unit.</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            ${lista.length ? lista.map(mat => {
              const qty = estoque[mat.id] ?? mat.estoque_atual ?? 0;
              const low  = qty < (mat.estoque_minimo || 0);
              const zero = qty <= 0;
              const statusColor = zero ? 'var(--red)' : low ? 'var(--orange)' : 'var(--green)';
              const statusLabel = zero ? 'Zerado' : low ? 'Baixo' : 'OK';
              return `<tr>
                <td style="font-size:11px;font-family:monospace;color:var(--text-muted)">${mat.codigo||'—'}</td>
                <td>
                  <strong style="font-size:13px">${mat.nome}</strong>
                  ${mat.marca ? `<br><span style="font-size:11px;color:var(--text-muted)">${mat.marca}${mat.modelo?' – '+mat.modelo:''}</span>` : ''}
                  ${mat.numero_serie ? `<br><span style="font-size:10px;color:var(--text-muted)"><i class="fas fa-barcode"></i> ${mat.numero_serie}</span>` : ''}
                </td>
                <td><span class="badge" style="font-size:10px">${mat.tipo||'Material'}</span></td>
                <td style="font-size:11px;color:var(--text-muted)">${mat.localizacao||'—'}</td>
                <td style="font-weight:700;font-size:14px;color:${statusColor}">${qty} <span style="font-size:11px;font-weight:400">${mat.unidade||'UN'}</span></td>
                <td style="font-size:11px;color:var(--text-muted)">${mat.estoque_minimo||0}</td>
                <td style="font-size:12px">R$ ${fmt(mat.valor_unitario||0)}</td>
                <td><span style="color:${statusColor};font-weight:700;font-size:11px">● ${statusLabel}</span></td>
                <td>
                  <div style="display:flex;gap:4px;flex-wrap:wrap">
                    <button class="btn btn-xs btn-secondary" onclick="_verHistoricoItem('${mat.id}')" title="Histórico">
                      <i class="fas fa-history"></i>
                    </button>
                    ${hasPermission('almoxarifado','create') ? `
                    <button class="btn btn-xs btn-success" onclick="abrirEntradaMaterial('${mat.id}')" title="Entrada">
                      <i class="fas fa-arrow-down"></i>
                    </button>
                    <button class="btn btn-xs btn-warning" onclick="abrirSaidaMaterial('${mat.id}')" title="Saída">
                      <i class="fas fa-arrow-up"></i>
                    </button>
                    <button class="btn btn-xs btn-info" onclick="abrirEmprestimo('${mat.id}')" title="Empréstimo">
                      <i class="fas fa-hand-holding"></i>
                    </button>
                    <button class="btn btn-xs" onclick="editarMaterial('${mat.id}')" title="Editar" style="background:var(--fa-gold);color:#000">
                      <i class="fas fa-pen"></i>
                    </button>` : ''}
                  </div>
                </td>
              </tr>`;
            }).join('') : `<tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:30px">
              <i class="fas fa-box-open" style="font-size:32px;margin-bottom:8px;display:block;opacity:.3"></i>
              Nenhum item cadastrado
            </td></tr>`}
          </tbody>
        </table>
      </div>
    </div>`;
}

// =====================================================
// ABA: MOVIMENTAÇÕES
// =====================================================
function _renderAbaMovimentos(el) {
  const movimentos = _getMovimentos();
  const busca      = (document.getElementById('almoxBuscaMov')?.value || '').toLowerCase();
  const filtroTipo = document.getElementById('almoxFiltroMovTipo')?.value || '';

  let lista = [...movimentos];
  if (filtroTipo) lista = lista.filter(m => m.tipo === filtroTipo);
  if (busca) lista = lista.filter(m =>
    (m.material_nome||'').toLowerCase().includes(busca) ||
    (m.numero||'').toLowerCase().includes(busca) ||
    (m.responsavel||'').toLowerCase().includes(busca) ||
    (m.nota_fiscal||'').toLowerCase().includes(busca)
  );

  el.innerHTML = `
    <div class="card">
      <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <h4><i class="fas fa-exchange-alt" style="color:var(--fa-teal);margin-right:6px"></i>Histórico de Movimentações (${lista.length})</h4>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <input type="text" id="almoxBuscaMov" class="form-control" style="width:200px;font-size:12px"
            placeholder="Buscar..." value="${busca}"
            oninput="_renderAbaMovimentos(document.getElementById('almoxConteudo'))">
          <select class="form-control" id="almoxFiltroMovTipo" style="width:130px;font-size:12px"
            onchange="_renderAbaMovimentos(document.getElementById('almoxConteudo'))">
            <option value="">Todos</option>
            ${['Entrada','Saída','Ajuste','Devolução','Transferência'].map(t =>
              `<option value="${t}" ${filtroTipo===t?'selected':''}>${t}</option>`).join('')}
          </select>
          <button class="btn btn-secondary btn-sm" onclick="exportarMovimentos()">
            <i class="fas fa-download"></i> CSV
          </button>
        </div>
      </div>
      <div style="overflow-x:auto">
        <table class="data-table">
          <thead>
            <tr>
              <th>Nº</th>
              <th>Tipo</th>
              <th>Material</th>
              <th>Qtd</th>
              <th>Estoque Após</th>
              <th>Ref/NF</th>
              <th>Pedido</th>
              <th>Recebimento</th>
              <th>Responsável</th>
              <th>Data</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            ${lista.length ? lista.slice(0, 200).map(m => {
              const isCancelado = m.status === 'Cancelado';
              const cor  = m.tipo==='Entrada'||m.tipo==='Devolução' ? 'var(--green)' : m.tipo==='Ajuste' ? 'var(--fa-teal)' : 'var(--orange)';
              const icon = m.tipo==='Entrada' ? 'fa-arrow-down' : m.tipo==='Devolução' ? 'fa-undo' : m.tipo==='Ajuste' ? 'fa-sliders-h' : 'fa-arrow-up';
              return `<tr style="${isCancelado?'opacity:.5;text-decoration:line-through':''}">
                <td style="font-size:11px;font-family:monospace">${m.numero||m.id?.slice(0,10)||'—'}</td>
                <td><span style="color:${cor};font-weight:700;font-size:12px;white-space:nowrap">
                  <i class="fas ${icon}"></i> ${m.tipo}
                  ${m.subtipo ? `<br><span style="font-weight:400;font-size:10px;color:var(--text-muted)">${m.subtipo}</span>` : ''}
                </span></td>
                <td style="font-size:12px">
                  <strong>${m.material_nome||m.material_id||'—'}</strong>
                  ${m.material_codigo ? `<br><span style="font-size:10px;color:var(--text-muted)">${m.material_codigo}</span>` : ''}
                </td>
                <td style="font-weight:700;color:${cor}">${m.quantidade} <span style="font-size:10px;color:var(--text-muted)">${m.unidade||''}</span></td>
                <td style="font-size:12px;color:var(--text-muted)">${m.estoque_depois !== undefined ? m.estoque_depois : '—'}</td>
                <td style="font-size:11px">${m.nota_fiscal||'—'}</td>
                <td style="font-size:11px">${m.pedido_numero ? `<a href="#" onclick="_almoxVerPedido('${m.pedido_id||''}')" style="color:var(--fa-teal)">${m.pedido_numero}</a>` : '—'}</td>
                <td style="font-size:11px">${m.recebimento_num ? `<span style="color:var(--fa-teal);cursor:pointer" onclick="_almoxVerRecebimento('${m.recebimento_id||''}')">${m.recebimento_num}</span>` : '—'}</td>
                <td style="font-size:11px">${m.responsavel||'—'}</td>
                <td style="font-size:11px;white-space:nowrap">${fmtDate(m.criado_em||m.data)}</td>
                <td>${isCancelado
                  ? '<span style="color:var(--red);font-size:11px;font-weight:700">Cancelado</span>'
                  : '<span style="color:var(--green);font-size:11px">Efetivado</span>'}</td>
                <td>
                  <button class="btn btn-xs btn-secondary" onclick="_verDetalheMovimento('${m.id}')" title="Detalhes">
                    <i class="fas fa-eye"></i>
                  </button>
                  ${!isCancelado && hasPermission('almoxarifado','create') ? `
                  <button class="btn btn-xs" onclick="_cancelarMovimento('${m.id}')"
                    style="background:var(--red);color:#fff" title="Cancelar">
                    <i class="fas fa-times"></i>
                  </button>` : ''}
                </td>
              </tr>`;
            }).join('') : `<tr><td colspan="12" style="text-align:center;color:var(--text-muted);padding:30px">Nenhuma movimentação encontrada</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>`;
}

// =====================================================
// ABA: EMPRÉSTIMOS / COMODATOS
// =====================================================
function _renderAbaEmprestimos(el) {
  const emprestimos = _getEmprestimos();
  const busca       = (document.getElementById('almoxBuscaEmp')?.value || '').toLowerCase();
  const filtroStatus = document.getElementById('almoxFiltroEmpStatus')?.value || '';
  const hoje        = new Date();

  let lista = [...emprestimos];
  if (filtroStatus) lista = lista.filter(e => e.status === filtroStatus);
  if (busca) lista = lista.filter(e =>
    (e.responsavel_retirada||'').toLowerCase().includes(busca) ||
    (e.material_nome||'').toLowerCase().includes(busca) ||
    (e.numero||'').toLowerCase().includes(busca) ||
    (e.setor_retirada||'').toLowerCase().includes(busca)
  );

  el.innerHTML = `
    <div class="card">
      <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <h4><i class="fas fa-hand-holding" style="color:var(--fa-teal);margin-right:6px"></i>Empréstimos / Comodatos (${lista.length})</h4>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <input type="text" id="almoxBuscaEmp" class="form-control" style="width:200px;font-size:12px"
            placeholder="Buscar responsável/item..." value="${busca}"
            oninput="_renderAbaEmprestimos(document.getElementById('almoxConteudo'))">
          <select class="form-control" id="almoxFiltroEmpStatus" style="width:130px;font-size:12px"
            onchange="_renderAbaEmprestimos(document.getElementById('almoxConteudo'))">
            <option value="">Todos</option>
            ${['Ativo','Devolvido','Atrasado','Perdido'].map(s =>
              `<option value="${s}" ${filtroStatus===s?'selected':''}>${s}</option>`).join('')}
          </select>
          ${hasPermission('almoxarifado','create') ? `
          <button class="btn btn-info btn-sm" onclick="abrirEmprestimo()">
            <i class="fas fa-plus"></i> Novo Empréstimo
          </button>` : ''}
        </div>
      </div>
      <div style="overflow-x:auto">
        <table class="data-table">
          <thead>
            <tr>
              <th>Nº</th>
              <th>Item</th>
              <th>Qtd</th>
              <th>Retirada por</th>
              <th>Setor</th>
              <th>Finalidade / OS</th>
              <th>Retirada em</th>
              <th>Prev. Devolução</th>
              <th>Devolvido em</th>
              <th>Condição</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            ${lista.length ? lista.map(e => {
              const atrasado = e.status === 'Ativo' && e.data_prevista_devolucao && new Date(e.data_prevista_devolucao) < hoje;
              const statusColor = {
                'Ativo': atrasado ? 'var(--red)' : 'var(--fa-teal)',
                'Devolvido': 'var(--green)',
                'Atrasado': 'var(--red)',
                'Perdido': 'var(--red)'
              }[e.status] || 'var(--text-muted)';
              return `<tr>
                <td style="font-size:11px;font-family:monospace">${e.numero||e.id?.slice(0,8)||'—'}</td>
                <td>
                  <strong style="font-size:12px">${e.material_nome||'—'}</strong>
                  ${e.numero_serie ? `<br><span style="font-size:10px;color:var(--text-muted)"><i class="fas fa-barcode"></i> ${e.numero_serie}</span>` : ''}
                </td>
                <td style="font-weight:700">${e.quantidade} <span style="font-size:10px;color:var(--text-muted)">${e.unidade||''}</span></td>
                <td style="font-size:12px">
                  <strong>${e.responsavel_retirada||'—'}</strong>
                  ${e.matricula_retirada ? `<br><span style="font-size:10px;color:var(--text-muted)">Mat: ${e.matricula_retirada}</span>` : ''}
                </td>
                <td style="font-size:11px;color:var(--text-muted)">${e.setor_retirada||'—'}</td>
                <td style="font-size:11px">
                  ${e.finalidade||'—'}
                  ${e.os_numero ? `<br><span style="color:var(--fa-teal);font-size:10px"><i class="fas fa-wrench"></i> OS: ${e.os_numero}</span>` : ''}
                </td>
                <td style="font-size:11px;white-space:nowrap">${fmtDate(e.data_retirada)}</td>
                <td style="font-size:11px;white-space:nowrap;color:${atrasado?'var(--red)':'inherit'};font-weight:${atrasado?'700':'400'}">
                  ${e.data_prevista_devolucao ? fmtDate(e.data_prevista_devolucao) : '—'}
                  ${atrasado ? '<br><span style="color:var(--red);font-size:10px">⚠ Atrasado</span>' : ''}
                </td>
                <td style="font-size:11px;white-space:nowrap">${e.data_devolucao ? fmtDate(e.data_devolucao) : '—'}</td>
                <td style="font-size:11px">${e.condicao_devolucao || e.condicao_retirada||'—'}</td>
                <td><span style="color:${statusColor};font-weight:700;font-size:11px">
                  ${atrasado && e.status==='Ativo' ? '⚠ Atrasado' : e.status}
                </span></td>
                <td>
                  <div style="display:flex;gap:4px">
                    <button class="btn btn-xs btn-secondary" onclick="_verDetalheEmprestimo('${e.id}')" title="Detalhes">
                      <i class="fas fa-eye"></i>
                    </button>
                    ${e.status === 'Ativo' && hasPermission('almoxarifado','create') ? `
                    <button class="btn btn-xs btn-success" onclick="abrirDevolucao('${e.id}')" title="Registrar Devolução">
                      <i class="fas fa-undo"></i> Devolver
                    </button>` : ''}
                  </div>
                </td>
              </tr>`;
            }).join('') : `<tr><td colspan="12" style="text-align:center;color:var(--text-muted);padding:30px">Nenhum empréstimo encontrado</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>`;
}

// =====================================================
// ABA: INVENTÁRIO
// =====================================================
function _renderAbaInventario(el) {
  const inventarios = _getInventarios();
  const canCreate   = hasPermission('almoxarifado', 'create');

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h4 style="margin:0"><i class="fas fa-clipboard-list" style="color:var(--fa-teal);margin-right:6px"></i>Inventários (${inventarios.length})</h4>
      ${canCreate ? `<button class="btn btn-primary btn-sm" onclick="abrirNovoInventario()">
        <i class="fas fa-plus"></i> Novo Inventário
      </button>` : ''}
    </div>
    ${inventarios.length ? inventarios.map(inv => {
      const pct = inv.total_itens > 0 ? Math.round((inv.itens_contados||0)/inv.total_itens*100) : 0;
      const statusColor = {
        'Aberto': 'var(--fa-teal)', 'Em Contagem': 'var(--orange)',
        'Concluído': 'var(--green)', 'Cancelado': 'var(--text-muted)'
      }[inv.status] || 'var(--text-muted)';
      return `
      <div class="card" style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;padding:14px 18px">
          <div>
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">
              <strong style="font-size:14px">${inv.numero||inv.id?.slice(0,8)}</strong>
              <span style="color:${statusColor};font-weight:700;font-size:12px">● ${inv.status}</span>
            </div>
            <div style="font-size:12px;color:var(--text-muted)">${inv.descricao||inv.tipo||'Inventário Geral'}</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:4px">
              <i class="fas fa-user" style="margin-right:4px"></i>${inv.responsavel||'—'} &nbsp;
              <i class="fas fa-calendar" style="margin-right:4px"></i>${fmtDate(inv.data_inicio)}
              ${inv.data_fim ? ` → ${fmtDate(inv.data_fim)}` : ''}
            </div>
          </div>
          <div style="text-align:right">
            <div style="font-size:12px;margin-bottom:6px">
              <span style="color:var(--text-muted)">Contados:</span>
              <strong style="color:var(--fa-teal)">${inv.itens_contados||0}/${inv.total_itens||0}</strong>
              <span style="color:var(--text-muted);margin-left:8px">Divergências:</span>
              <strong style="color:${(inv.divergencias||0)>0?'var(--red)':'var(--green)'}">${inv.divergencias||0}</strong>
            </div>
            <div style="background:var(--bg-card);border-radius:4px;height:6px;width:180px;overflow:hidden;margin-bottom:8px">
              <div style="height:100%;width:${pct}%;background:var(--fa-teal);transition:width .4s"></div>
            </div>
            <div style="display:flex;gap:6px;justify-content:flex-end">
              ${inv.status !== 'Cancelado' && inv.status !== 'Concluído' ? `
              <button class="btn btn-xs btn-primary" onclick="abrirContagem('${inv.id||inv.numero}')">
                <i class="fas fa-clipboard-check"></i> Lançar Contagem
              </button>
              <button class="btn btn-xs btn-success" onclick="concluirInventario('${inv.id||inv.numero}')">
                <i class="fas fa-check"></i> Concluir
              </button>` : ''}
              <button class="btn btn-xs btn-secondary" onclick="_verRelatorioInventario('${inv.id||inv.numero}')">
                <i class="fas fa-file-alt"></i> Relatório
              </button>
            </div>
          </div>
        </div>
        ${pct > 0 ? `<div style="background:rgba(0,180,184,0.06);padding:6px 18px;border-top:1px solid var(--border-color);font-size:11px;color:var(--text-muted)">
          ${pct}% concluído
        </div>` : ''}
      </div>`;
    }).join('') : `
    <div class="card" style="text-align:center;padding:40px;color:var(--text-muted)">
      <i class="fas fa-clipboard-list" style="font-size:40px;margin-bottom:12px;display:block;opacity:.3"></i>
      <p>Nenhum inventário registrado</p>
      ${canCreate ? `<button class="btn btn-primary" onclick="abrirNovoInventario()">
        <i class="fas fa-plus"></i> Criar Primeiro Inventário
      </button>` : ''}
    </div>`}`;
}

// =====================================================
// ABA: CATÁLOGO DE MATERIAIS
// =====================================================
function _renderAbaCatalogo(el) {
  const materiais  = _getMateriais();
  const busca      = (document.getElementById('almoxBuscaCat')?.value || '').toLowerCase();
  const filtroTipo = document.getElementById('almoxFiltroCatTipo')?.value || '';

  let lista = materiais.filter(m => m.ativo !== 0 && m.ativo !== false);
  if (filtroTipo) lista = lista.filter(m => m.tipo === filtroTipo);
  if (busca) lista = lista.filter(m =>
    (m.nome||'').toLowerCase().includes(busca) ||
    (m.codigo||'').toLowerCase().includes(busca) ||
    (m.descricao||'').toLowerCase().includes(busca)
  );

  el.innerHTML = `
    <div class="card">
      <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <h4><i class="fas fa-th-list" style="color:var(--fa-teal);margin-right:6px"></i>Catálogo de Itens (${lista.length})</h4>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <input type="text" id="almoxBuscaCat" class="form-control" style="width:200px;font-size:12px"
            placeholder="Buscar..." value="${busca}"
            oninput="_renderAbaCatalogo(document.getElementById('almoxConteudo'))">
          <select class="form-control" id="almoxFiltroCatTipo" style="width:140px;font-size:12px"
            onchange="_renderAbaCatalogo(document.getElementById('almoxConteudo'))">
            <option value="">Todos os tipos</option>
            ${['Material','Equipamento','EPI','Ferramenta','Consumivel'].map(t =>
              `<option value="${t}" ${filtroTipo===t?'selected':''}>${t}</option>`).join('')}
          </select>
          ${hasPermission('almoxarifado','create') ? `
          <button class="btn btn-primary btn-sm" onclick="abrirCadastroMaterial()">
            <i class="fas fa-plus"></i> Novo Item
          </button>` : ''}
        </div>
      </div>
      <div style="overflow-x:auto">
        <table class="data-table">
          <thead>
            <tr>
              <th>Código</th><th>Nome</th><th>Tipo</th><th>Categoria</th>
              <th>Unidade</th><th>Marca/Modelo</th><th>Nº Série</th>
              <th>Localização</th><th>Valor Unit.</th><th>Estoque</th><th>Ações</th>
            </tr>
          </thead>
          <tbody>
            ${lista.length ? lista.map(m => {
              const estoque = _getEstoque();
              const qty = estoque[m.id] ?? m.estoque_atual ?? 0;
              return `<tr>
                <td style="font-size:11px;font-family:monospace">${m.codigo||'—'}</td>
                <td><strong style="font-size:12px">${m.nome}</strong>
                  ${m.descricao ? `<br><span style="font-size:10px;color:var(--text-muted)">${m.descricao.slice(0,50)}</span>` : ''}
                </td>
                <td style="font-size:11px">${m.tipo||'Material'}</td>
                <td style="font-size:11px;color:var(--text-muted)">${m.categoria||'—'}</td>
                <td style="font-size:11px">${m.unidade||'UN'}</td>
                <td style="font-size:11px">${m.marca||'—'}${m.modelo?' / '+m.modelo:''}</td>
                <td style="font-size:11px;font-family:monospace">${m.numero_serie||'—'}</td>
                <td style="font-size:11px;color:var(--text-muted)">${m.localizacao||'—'}</td>
                <td style="font-size:12px">R$ ${fmt(m.valor_unitario||0)}</td>
                <td style="font-weight:700;color:${qty<=0?'var(--red)':qty<(m.estoque_minimo||0)?'var(--orange)':'var(--green)'}">${qty}</td>
                <td>
                  <div style="display:flex;gap:4px">
                    <button class="btn btn-xs btn-secondary" onclick="_verHistoricoItem('${m.id}')" title="Histórico">
                      <i class="fas fa-history"></i>
                    </button>
                    ${hasPermission('almoxarifado','create') ? `
                    <button class="btn btn-xs" onclick="editarMaterial('${m.id}')"
                      style="background:var(--fa-gold);color:#000" title="Editar">
                      <i class="fas fa-pen"></i>
                    </button>` : ''}
                  </div>
                </td>
              </tr>`;
            }).join('') : `<tr><td colspan="11" style="text-align:center;color:var(--text-muted);padding:30px">Nenhum item encontrado</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>`;
}

// =====================================================
// CADASTRO / EDIÇÃO DE MATERIAL
// =====================================================
function abrirCadastroMaterial(materialIdPre) {
  let mat = null;
  if (materialIdPre) {
    mat = _getMateriais().find(m => m.id === materialIdPre);
  }

  const pedidos      = JSON.parse(localStorage.getItem('fa_pedidos') || '[]');
  const recebimentos = JSON.parse(localStorage.getItem('fa_recebimentos') || '[]');

  openModal(mat ? 'Editar Item' : 'Novo Item no Catálogo', `
    <form id="formMaterial">
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
        <div class="form-group">
          <label>Código *</label>
          <input type="text" class="form-control" id="matCodigo" value="${mat?.codigo||''}" placeholder="Ex: MAT-001" required>
        </div>
        <div class="form-group" style="grid-column:span 2">
          <label>Nome *</label>
          <input type="text" class="form-control" id="matNome" value="${mat?.nome||''}" placeholder="Nome do item" required>
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label>Descrição</label>
          <input type="text" class="form-control" id="matDescricao" value="${mat?.descricao||''}" placeholder="Descrição detalhada">
        </div>
        <div class="form-group">
          <label>Tipo *</label>
          <select class="form-control" id="matTipo">
            ${['Material','Equipamento','EPI','Ferramenta','Consumivel'].map(t =>
              `<option value="${t}" ${(mat?.tipo||'Material')===t?'selected':''}>${t}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Categoria</label>
          <input type="text" class="form-control" id="matCategoria" value="${mat?.categoria||''}" placeholder="Ex: Elétrico, Hidráulico...">
        </div>
        <div class="form-group">
          <label>Unidade</label>
          <select class="form-control" id="matUnidade">
            ${['UN','KG','L','M','M²','M³','CX','PC','PAR','RL','GL','SC','T'].map(u =>
              `<option value="${u}" ${(mat?.unidade||'UN')===u?'selected':''}>${u}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Marca</label>
          <input type="text" class="form-control" id="matMarca" value="${mat?.marca||''}" placeholder="Fabricante">
        </div>
        <div class="form-group">
          <label>Modelo</label>
          <input type="text" class="form-control" id="matModelo" value="${mat?.modelo||''}" placeholder="Modelo/Referência">
        </div>
        <div class="form-group">
          <label>Número de Série</label>
          <input type="text" class="form-control" id="matSerie" value="${mat?.numero_serie||''}" placeholder="S/N (para equipamentos)">
        </div>
        <div class="form-group">
          <label>Localização</label>
          <input type="text" class="form-control" id="matLocalizacao" value="${mat?.localizacao||''}" placeholder="Ex: Prateleira A1, Galpão 2">
        </div>
        <div class="form-group">
          <label>Estoque Mínimo</label>
          <input type="number" class="form-control" id="matEstMinimo" value="${mat?.estoque_minimo||0}" min="0" step="0.01">
        </div>
        <div class="form-group">
          <label>Valor Unitário (R$)</label>
          <input type="number" class="form-control" id="matValor" value="${mat?.valor_unitario||0}" min="0" step="0.01">
        </div>
        ${!mat ? `
        <div class="form-group">
          <label>Estoque Inicial</label>
          <input type="number" class="form-control" id="matEstInicial" value="0" min="0" step="0.01">
        </div>` : ''}
        <div class="form-group">
          <label>Pedido de Compra Vinculado</label>
          <select class="form-control" id="matPedidoId">
            <option value="">Nenhum</option>
            ${pedidos.map(p => `<option value="${p.id}" ${mat?.pedido_id===p.id?'selected':''}>${p.numero||p.id} – ${p.fornecedor_nome||''}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Recebimento Vinculado</label>
          <select class="form-control" id="matRecebimentoId">
            <option value="">Nenhum</option>
            ${recebimentos.map(r => `<option value="${r.id}" ${mat?.recebimento_id===r.id?'selected':''}>${r.numero||r.id} – NF: ${r.nf_numero||'S/N'}</option>`).join('')}
          </select>
        </div>
      </div>
    </form>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
     <button class="btn btn-primary" onclick="salvarMaterial(${mat ? `'${mat.id}'` : 'null'})">
       <i class="fas fa-save"></i> ${mat ? 'Salvar Alterações' : 'Cadastrar Item'}
     </button>`);
}

function editarMaterial(id) { abrirCadastroMaterial(id); }

async function salvarMaterial(editId) {
  const codigo    = document.getElementById('matCodigo')?.value?.trim();
  const nome      = document.getElementById('matNome')?.value?.trim();
  if (!codigo || !nome) { showToast('Código e nome são obrigatórios', 'error'); return; }

  const materiais = _getMateriais();
  const estoque   = _getEstoque();

  const obj = {
    id:              editId || gerarId('MAT'),
    codigo,
    nome,
    descricao:       document.getElementById('matDescricao')?.value?.trim() || '',
    tipo:            document.getElementById('matTipo')?.value || 'Material',
    categoria:       document.getElementById('matCategoria')?.value?.trim() || '',
    unidade:         document.getElementById('matUnidade')?.value || 'UN',
    marca:           document.getElementById('matMarca')?.value?.trim() || '',
    modelo:          document.getElementById('matModelo')?.value?.trim() || '',
    numero_serie:    document.getElementById('matSerie')?.value?.trim() || '',
    localizacao:     document.getElementById('matLocalizacao')?.value?.trim() || '',
    estoque_minimo:  parseFloat(document.getElementById('matEstMinimo')?.value) || 0,
    valor_unitario:  parseFloat(document.getElementById('matValor')?.value) || 0,
    pedido_id:       document.getElementById('matPedidoId')?.value || '',
    recebimento_id:  document.getElementById('matRecebimentoId')?.value || '',
    ativo:           true,
    criado_por:      (currentUser?.nome || currentUser?.name || 'Sistema'),
    criado_em:       editId ? (materiais.find(m=>m.id===editId)?.criado_em || new Date().toISOString()) : new Date().toISOString(),
    atualizado_em:   new Date().toISOString(),
  };

  if (!editId) {
    const estInicial = parseFloat(document.getElementById('matEstInicial')?.value) || 0;
    obj.estoque_atual = estInicial;
    estoque[obj.id]   = estInicial;
    _saveEstoque(estoque);
    // Registra movimento de estoque inicial se houver
    if (estInicial > 0) {
      const movimentos = _getMovimentos();
      movimentos.unshift({
        id: gerarId('MOV'), tipo: 'Entrada', subtipo: 'Cadastro',
        material_id: obj.id, material_nome: nome, material_codigo: codigo,
        quantidade: estInicial, unidade: obj.unidade,
        estoque_antes: 0, estoque_depois: estInicial,
        responsavel: (currentUser?.nome || currentUser?.name || 'Sistema'), criado_em: new Date().toISOString()
      });
      _saveMovimentos(movimentos);
    }
    materiais.unshift(obj);
  } else {
    const idx = materiais.findIndex(m => m.id === editId);
    if (idx !== -1) {
      obj.estoque_atual = materiais[idx].estoque_atual;
      materiais[idx] = { ...materiais[idx], ...obj };
    } else {
      materiais.unshift(obj);
    }
  }
  _saveMateriais(materiais);

  // Persiste na API
  try {
    const method = editId ? 'PUT' : 'POST';
    const url    = editId ? `/api/materiais/${editId}` : '/api/materiais';
    await fetch(url, { method, headers: {'Content-Type':'application/json'}, body: JSON.stringify(obj) });
  } catch(e) { /* offline */ }

  logAction(editId ? 'Editou item' : 'Cadastrou item', 'almoxarifado', `${nome} (${codigo})`);
  showToast(`Item "${nome}" ${editId?'atualizado':'cadastrado'} com sucesso!`, 'success');
  closeModal();
  _almoxAba = 'cadastro';
  renderAlmoxarifado();
}

// =====================================================
// ENTRADA DE MATERIAL
// =====================================================
function abrirEntradaMaterial(materialIdPre) {
  const materiais = _getMateriais();
  const pedidos   = JSON.parse(localStorage.getItem('fa_pedidos') || '[]').filter(p =>
    ['Emitido','Em Trânsito','Entregue Parcial','Aprovado','Enviado ao Fornecedor'].includes(p.status));
  const recebimentos = JSON.parse(localStorage.getItem('fa_recebimentos') || '[]');

  openModal('Registrar Entrada de Material', `
    <form id="formEntrada">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group" style="grid-column:1/-1">
          <label>Material *</label>
          <select class="form-control" id="entMaterial" required onchange="_entradaPreencheInfo()">
            <option value="">Selecione o material...</option>
            ${materiais.map(m => `<option value="${m.id}" data-unidade="${m.unidade||'UN'}"
              data-nome="${m.nome}" data-codigo="${m.codigo||''}"
              ${materialIdPre===m.id?'selected':''}>${m.nome} (${m.codigo||m.id})</option>`).join('')}
            <option value="__novo__">+ Cadastrar novo item</option>
          </select>
        </div>
        <div id="entInfoItem" style="grid-column:1/-1;display:none;background:rgba(0,180,184,0.06);padding:10px;border-radius:8px;font-size:12px"></div>
        <div class="form-group">
          <label>Quantidade *</label>
          <input type="number" class="form-control" id="entQtd" placeholder="0" min="0.01" step="0.01" required>
        </div>
        <div class="form-group">
          <label>Unidade</label>
          <input type="text" class="form-control" id="entUnidade" placeholder="UN">
        </div>
        <div class="form-group">
          <label>Valor Total (R$)</label>
          <input type="number" class="form-control" id="entValor" placeholder="0.00" step="0.01">
        </div>
        <div class="form-group">
          <label>Valor Unitário (R$)</label>
          <input type="number" class="form-control" id="entValUnit" placeholder="Auto" step="0.01">
        </div>
        <div class="form-group">
          <label>Número da Nota Fiscal</label>
          <input type="text" class="form-control" id="entNF" placeholder="Ex: 000456">
        </div>
        <div class="form-group">
          <label>Data de Recebimento *</label>
          <input type="date" class="form-control" id="entData" value="${new Date().toISOString().slice(0,10)}" required>
        </div>
        <div class="form-group">
          <label>Pedido de Compra (vínculo)</label>
          <select class="form-control" id="entPedido">
            <option value="">Sem vínculo</option>
            ${pedidos.map(p => `<option value="${p.id}" data-numero="${p.numero||p.id}">${p.numero||p.id} – ${p.fornecedor_nome||''}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Recebimento (vínculo)</label>
          <select class="form-control" id="entRecebimento">
            <option value="">Sem vínculo</option>
            ${recebimentos.map(r => `<option value="${r.id}" data-numero="${r.numero||r.id}">${r.numero||r.id} – NF: ${r.nf_numero||'S/N'}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Local de Destino</label>
          <input type="text" class="form-control" id="entLocalDest" placeholder="Ex: Prateleira A1">
        </div>
        <div class="form-group">
          <label>Número de Série (se aplicável)</label>
          <input type="text" class="form-control" id="entSerie" placeholder="S/N do equipamento">
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label>Observações</label>
          <input type="text" class="form-control" id="entObs" placeholder="Opcional">
        </div>
      </div>
      <div style="background:rgba(0,180,184,0.08);border:1px solid rgba(0,180,184,0.3);border-radius:8px;padding:10px;margin-top:8px;font-size:12px;color:var(--text-secondary)">
        <i class="fas fa-info-circle" style="color:var(--fa-teal)"></i>
        A entrada atualiza o estoque e gera histórico de movimentação rastreável.
      </div>
    </form>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
     <button class="btn btn-success" onclick="salvarEntrada()"><i class="fas fa-arrow-down"></i> Registrar Entrada</button>`);

  if (materialIdPre) setTimeout(() => _entradaPreencheInfo(), 100);
}

function _entradaPreencheInfo() {
  const sel = document.getElementById('entMaterial');
  if (!sel) return;
  const matId = sel.value;
  if (matId === '__novo__') {
    closeModal();
    abrirCadastroMaterial();
    return;
  }
  const mat = _getMateriais().find(m => m.id === matId);
  const info = document.getElementById('entInfoItem');
  const uniInput = document.getElementById('entUnidade');
  if (mat) {
    const estoque = _getEstoque();
    const qty = estoque[mat.id] ?? mat.estoque_atual ?? 0;
    if (info) {
      info.style.display = 'block';
      info.innerHTML = `<i class="fas fa-info-circle" style="color:var(--fa-teal)"></i>
        <strong>${mat.nome}</strong> — Estoque atual: <strong style="color:var(--fa-teal)">${qty} ${mat.unidade||'UN'}</strong>
        ${mat.localizacao ? ` | Localização: <strong>${mat.localizacao}</strong>` : ''}
        ${mat.numero_serie ? ` | S/N: <strong>${mat.numero_serie}</strong>` : ''}`;
    }
    if (uniInput) uniInput.value = mat.unidade || 'UN';
  } else if (info) { info.style.display = 'none'; }
}

async function salvarEntrada() {
  const matId = document.getElementById('entMaterial')?.value;
  const qtd   = parseFloat(document.getElementById('entQtd')?.value);
  const data  = document.getElementById('entData')?.value;
  if (!matId || matId === '__novo__' || !qtd || !data) {
    showToast('Material, quantidade e data são obrigatórios', 'error'); return;
  }

  const materiais = _getMateriais();
  const mat       = materiais.find(m => m.id == matId);
  const estoque   = _getEstoque();
  const estoqueAntes  = estoque[matId] || 0;
  const estoqueDepois = estoqueAntes + qtd;

  const pedidoEl  = document.getElementById('entPedido');
  const recebEl   = document.getElementById('entRecebimento');
  const pedidoId  = pedidoEl?.value || '';
  const pedidoNum = pedidoEl?.options[pedidoEl.selectedIndex]?.dataset?.numero || '';
  const recebId   = recebEl?.value || '';
  const recebNum  = recebEl?.options[recebEl.selectedIndex]?.dataset?.numero || '';
  const nf        = document.getElementById('entNF')?.value || '';
  const valor     = parseFloat(document.getElementById('entValor')?.value) || 0;
  const valUnit   = parseFloat(document.getElementById('entValUnit')?.value) || (qtd > 0 ? valor / qtd : 0);
  const unidade   = document.getElementById('entUnidade')?.value || mat?.unidade || 'UN';
  const localDest = document.getElementById('entLocalDest')?.value || '';
  const serie     = document.getElementById('entSerie')?.value || '';
  const obs       = document.getElementById('entObs')?.value || '';

  const movimentos = _getMovimentos();
  const movId = gerarId('MOV');
  const ano   = new Date().getFullYear();
  const num   = `MOV-${ano}-${String(movimentos.length + 1).padStart(4, '0')}`;

  const mov = {
    id: movId, numero: num,
    tipo: 'Entrada', subtipo: recebId ? 'Recebimento' : (pedidoId ? 'Compra' : 'Manual'),
    material_id: matId, material_nome: mat?.nome || matId, material_codigo: mat?.codigo || '',
    quantidade: qtd, unidade,
    valor_unitario: valUnit, valor_total: valor,
    estoque_antes: estoqueAntes, estoque_depois: estoqueDepois,
    pedido_id: pedidoId, pedido_numero: pedidoNum,
    recebimento_id: recebId, recebimento_num: recebNum,
    nota_fiscal: nf,
    local_destino: localDest, numero_serie: serie,
    responsavel: (currentUser?.nome || currentUser?.name || 'Sistema'),
    observacoes: obs, status: 'Efetivado',
    enviado_cp: false, criado_em: new Date().toISOString()
  };
  movimentos.unshift(mov);
  _saveMovimentos(movimentos);

  // Atualiza estoque
  estoque[matId] = estoqueDepois;
  _saveEstoque(estoque);
  const matIdx = materiais.findIndex(m => m.id == matId);
  if (matIdx !== -1) { materiais[matIdx].estoque_atual = estoqueDepois; _saveMateriais(materiais); }

  // Persiste na API
  try {
    await fetch('/api/movimentos-estoque', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify(mov)
    });
  } catch(e) { /* offline */ }

  logAction('Registrou entrada', 'almoxarifado', `${mat?.nome} – qtd: ${qtd} – NF: ${nf||'S/N'}`);
  showToast(`✅ Entrada registrada! Estoque de <strong>${mat?.nome}</strong>: ${estoqueDepois} ${unidade}`, 'success', 4000);
  closeModal();
  renderAlmoxarifado();
}

// =====================================================
// SAÍDA DE MATERIAL
// =====================================================
function abrirSaidaMaterial(materialIdPre) {
  const materiais = _getMateriais();
  const oss       = JSON.parse(localStorage.getItem('fa_ordens_servico') || '[]');
  const estoque   = _getEstoque();

  openModal('Registrar Saída de Material', `
    <form id="formSaida">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group" style="grid-column:1/-1">
          <label>Material *</label>
          <select class="form-control" id="saidaMaterial" required onchange="_saidaPreencheInfo()">
            <option value="">Selecione...</option>
            ${materiais.map(m => {
              const qty = estoque[m.id] ?? m.estoque_atual ?? 0;
              return `<option value="${m.id}" data-unidade="${m.unidade||'UN'}" data-estoque="${qty}"
                ${materialIdPre===m.id?'selected':''}>${m.nome} (Estoque: ${qty} ${m.unidade||'UN'})</option>`;
            }).join('')}
          </select>
        </div>
        <div id="saidaInfoItem" style="grid-column:1/-1;display:none;background:rgba(255,140,0,0.08);padding:10px;border-radius:8px;font-size:12px"></div>
        <div class="form-group">
          <label>Quantidade *</label>
          <input type="number" class="form-control" id="saidaQtd" placeholder="0" min="0.01" step="0.01" required>
        </div>
        <div class="form-group">
          <label>Unidade</label>
          <input type="text" class="form-control" id="saidaUnidade" placeholder="UN">
        </div>
        <div class="form-group">
          <label>Retirado por *</label>
          <input type="text" class="form-control" id="saidaSolicitante" value="${(currentUser?.nome || currentUser?.name || 'Sistema')||''}" placeholder="Nome de quem retirou" required>
        </div>
        <div class="form-group">
          <label>Setor / Destino</label>
          <input type="text" class="form-control" id="saidaSetor" placeholder="Ex: Manutenção, Projetos...">
        </div>
        <div class="form-group">
          <label>Ordem de Serviço (vínculo)</label>
          <select class="form-control" id="saidaOS">
            <option value="">Sem vínculo</option>
            ${oss.map(o => `<option value="${o.id}" data-numero="${o.numero||o.id}">${o.numero||o.id} – ${o.titulo||''}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Data *</label>
          <input type="date" class="form-control" id="saidaData" value="${new Date().toISOString().slice(0,10)}" required>
        </div>
        <div class="form-group">
          <label>Local de Uso / Destino</label>
          <input type="text" class="form-control" id="saidaLocalDest" placeholder="Ex: Oficina, Mina Norte...">
        </div>
        <div class="form-group">
          <label>Número de Série (se específico)</label>
          <input type="text" class="form-control" id="saidaSerie" placeholder="S/N">
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label>Motivo / Observações *</label>
          <input type="text" class="form-control" id="saidaObs" placeholder="Descreva o motivo da saída" required>
        </div>
      </div>
    </form>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
     <button class="btn btn-warning" onclick="salvarSaida()"><i class="fas fa-arrow-up"></i> Registrar Saída</button>`);

  if (materialIdPre) setTimeout(() => _saidaPreencheInfo(), 100);
}

function _saidaPreencheInfo() {
  const sel   = document.getElementById('saidaMaterial');
  const matId = sel?.value;
  const mat   = _getMateriais().find(m => m.id === matId);
  const info  = document.getElementById('saidaInfoItem');
  const uniInput = document.getElementById('saidaUnidade');
  if (mat && info) {
    const estoque = _getEstoque();
    const qty = estoque[matId] ?? mat.estoque_atual ?? 0;
    info.style.display = 'block';
    info.innerHTML = `<i class="fas fa-box" style="color:var(--orange)"></i>
      <strong>${mat.nome}</strong> — Estoque disponível: <strong style="color:${qty<=0?'var(--red)':'var(--orange)'}">${qty} ${mat.unidade||'UN'}</strong>
      ${mat.localizacao ? ` | Localização: <strong>${mat.localizacao}</strong>` : ''}`;
    if (uniInput) uniInput.value = mat.unidade || 'UN';
  } else if (info) { info.style.display = 'none'; }
}

async function salvarSaida() {
  const matId     = document.getElementById('saidaMaterial')?.value;
  const qtd       = parseFloat(document.getElementById('saidaQtd')?.value);
  const data      = document.getElementById('saidaData')?.value;
  const solicit   = document.getElementById('saidaSolicitante')?.value?.trim();
  const obs       = document.getElementById('saidaObs')?.value?.trim();

  if (!matId || !qtd || !data || !solicit || !obs) {
    showToast('Preencha todos os campos obrigatórios', 'error'); return;
  }

  const estoque = _getEstoque();
  const materiais = _getMateriais();
  const mat     = materiais.find(m => m.id == matId);
  const estoqueAntes  = estoque[matId] || 0;

  if (qtd > estoqueAntes) {
    showToast(`Estoque insuficiente. Disponível: ${estoqueAntes} ${mat?.unidade||'UN'}`, 'error'); return;
  }

  const estoqueDepois = estoqueAntes - qtd;
  const osEl          = document.getElementById('saidaOS');
  const osId          = osEl?.value || '';
  const osNum         = osEl?.options[osEl.selectedIndex]?.dataset?.numero || '';
  const unidade       = document.getElementById('saidaUnidade')?.value || mat?.unidade || 'UN';
  const localDest     = document.getElementById('saidaLocalDest')?.value || '';
  const setor         = document.getElementById('saidaSetor')?.value || '';
  const serie         = document.getElementById('saidaSerie')?.value || '';

  const movimentos = _getMovimentos();
  const movId = gerarId('MOV');
  const ano   = new Date().getFullYear();
  const num   = `MOV-${ano}-${String(movimentos.length + 1).padStart(4, '0')}`;

  const mov = {
    id: movId, numero: num,
    tipo: 'Saída', subtipo: osId ? 'OS' : 'Manual',
    material_id: matId, material_nome: mat?.nome || matId, material_codigo: mat?.codigo || '',
    quantidade: qtd, unidade,
    estoque_antes: estoqueAntes, estoque_depois: estoqueDepois,
    os_id: osId, os_numero: osNum,
    local_destino: localDest || setor,
    numero_serie: serie,
    responsavel: (currentUser?.nome || currentUser?.name || 'Sistema'),
    solicitante: solicit,
    observacoes: obs, status: 'Efetivado',
    criado_em: new Date().toISOString()
  };
  movimentos.unshift(mov);
  _saveMovimentos(movimentos);

  estoque[matId] = estoqueDepois;
  _saveEstoque(estoque);
  const matIdx = materiais.findIndex(m => m.id == matId);
  if (matIdx !== -1) { materiais[matIdx].estoque_atual = estoqueDepois; _saveMateriais(materiais); }

  // Persiste na API
  try {
    await fetch('/api/movimentos-estoque', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify(mov)
    });
  } catch(e) { /* offline */ }

  logAction('Registrou saída', 'almoxarifado', `${mat?.nome} – qtd: ${qtd} – por: ${solicit}`);
  showToast(`✅ Saída registrada! Estoque de <strong>${mat?.nome}</strong>: ${estoqueDepois} ${unidade}`, 'success', 4000);
  closeModal();
  renderAlmoxarifado();
}

// =====================================================
// EMPRÉSTIMO / COMODATO
// =====================================================
function abrirEmprestimo(materialIdPre) {
  const materiais = _getMateriais();
  const oss       = JSON.parse(localStorage.getItem('fa_ordens_servico') || '[]');
  const estoque   = _getEstoque();
  const projetos  = JSON.parse(localStorage.getItem('fa_projetos') || '[]');

  openModal('Registrar Empréstimo / Comodato', `
    <form id="formEmprestimo">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group" style="grid-column:1/-1">
          <label>Material / Equipamento *</label>
          <select class="form-control" id="empMaterial" required onchange="_empPreencheInfo()">
            <option value="">Selecione...</option>
            ${materiais.map(m => {
              const qty = estoque[m.id] ?? m.estoque_atual ?? 0;
              return `<option value="${m.id}" data-unidade="${m.unidade||'UN'}" data-estoque="${qty}"
                ${materialIdPre===m.id?'selected':''}>${m.nome}${m.numero_serie?' (S/N: '+m.numero_serie+')':''} — Disponível: ${qty}</option>`;
            }).join('')}
          </select>
        </div>
        <div id="empInfoItem" style="grid-column:1/-1;display:none;background:rgba(0,180,184,0.06);padding:10px;border-radius:8px;font-size:12px"></div>

        <div class="form-group">
          <label>Quantidade *</label>
          <input type="number" class="form-control" id="empQtd" value="1" min="0.01" step="0.01" required>
        </div>
        <div class="form-group">
          <label>Número de Série</label>
          <input type="text" class="form-control" id="empSerie" placeholder="S/N (se específico)">
        </div>

        <div style="grid-column:1/-1;border-top:1px solid var(--border-color);padding-top:10px;margin-top:4px">
          <strong style="font-size:13px;color:var(--fa-teal)"><i class="fas fa-user"></i> Responsável pela Retirada</strong>
        </div>
        <div class="form-group">
          <label>Nome *</label>
          <input type="text" class="form-control" id="empResponsavel" value="${(currentUser?.nome || currentUser?.name || 'Sistema')||''}" required>
        </div>
        <div class="form-group">
          <label>Matrícula</label>
          <input type="text" class="form-control" id="empMatricula" placeholder="Matrícula do funcionário">
        </div>
        <div class="form-group">
          <label>Setor</label>
          <input type="text" class="form-control" id="empSetor" placeholder="Ex: Manutenção, Produção">
        </div>
        <div class="form-group">
          <label>Autorizado por</label>
          <input type="text" class="form-control" id="empAutorizado" placeholder="Responsável que autorizou">
        </div>

        <div style="grid-column:1/-1;border-top:1px solid var(--border-color);padding-top:10px;margin-top:4px">
          <strong style="font-size:13px;color:var(--fa-teal)"><i class="fas fa-calendar"></i> Datas e Destino</strong>
        </div>
        <div class="form-group">
          <label>Data de Retirada *</label>
          <input type="date" class="form-control" id="empDataRet" value="${new Date().toISOString().slice(0,10)}" required>
        </div>
        <div class="form-group">
          <label>Previsão de Devolução</label>
          <input type="date" class="form-control" id="empDataPrev">
        </div>
        <div class="form-group">
          <label>Local de Uso</label>
          <input type="text" class="form-control" id="empLocal" placeholder="Ex: Oficina Norte, Mina 3">
        </div>
        <div class="form-group">
          <label>Finalidade / Motivo *</label>
          <input type="text" class="form-control" id="empFinalidade" placeholder="Descreva a finalidade" required>
        </div>
        <div class="form-group">
          <label>Ordem de Serviço</label>
          <select class="form-control" id="empOS">
            <option value="">Sem vínculo</option>
            ${oss.map(o => `<option value="${o.id}" data-numero="${o.numero||o.id}">${o.numero||o.id} – ${o.titulo||''}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Condição na Retirada</label>
          <select class="form-control" id="empCondicao">
            ${['Bom','Regular','Danificado'].map(c => `<option value="${c}">${c}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label>Observações</label>
          <input type="text" class="form-control" id="empObs" placeholder="Opcional">
        </div>
      </div>
    </form>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
     <button class="btn btn-info" onclick="salvarEmprestimo()"><i class="fas fa-hand-holding"></i> Registrar Empréstimo</button>`);

  if (materialIdPre) setTimeout(() => _empPreencheInfo(), 100);
}

function _empPreencheInfo() {
  const sel   = document.getElementById('empMaterial');
  const matId = sel?.value;
  const mat   = _getMateriais().find(m => m.id === matId);
  const info  = document.getElementById('empInfoItem');
  if (mat && info) {
    const estoque = _getEstoque();
    const qty = estoque[matId] ?? mat.estoque_atual ?? 0;
    info.style.display = 'block';
    info.innerHTML = `<i class="fas fa-info-circle" style="color:var(--fa-teal)"></i>
      <strong>${mat.nome}</strong> — Disponível: <strong style="color:${qty<=0?'var(--red)':'var(--fa-teal)'}">${qty} ${mat.unidade||'UN'}</strong>
      ${mat.localizacao ? ` | Local: <strong>${mat.localizacao}</strong>` : ''}
      ${mat.numero_serie ? ` | S/N: <strong>${mat.numero_serie}</strong>` : ''}`;
    const serieInput = document.getElementById('empSerie');
    if (serieInput && mat.numero_serie) serieInput.value = mat.numero_serie;
  } else if (info) { info.style.display = 'none'; }
}

async function salvarEmprestimo() {
  const matId      = document.getElementById('empMaterial')?.value;
  const qtd        = parseFloat(document.getElementById('empQtd')?.value) || 1;
  const responsavel = document.getElementById('empResponsavel')?.value?.trim();
  const finalidade = document.getElementById('empFinalidade')?.value?.trim();
  if (!matId || !responsavel || !finalidade) {
    showToast('Material, responsável e finalidade são obrigatórios', 'error'); return;
  }

  const estoque   = _getEstoque();
  const materiais = _getMateriais();
  const mat       = materiais.find(m => m.id === matId);
  const qtyDisp   = estoque[matId] ?? mat?.estoque_atual ?? 0;

  if (qtd > qtyDisp) {
    showToast(`Estoque insuficiente. Disponível: ${qtyDisp} ${mat?.unidade||'UN'}`, 'error'); return;
  }

  const osEl  = document.getElementById('empOS');
  const osId  = osEl?.value || '';
  const osNum = osEl?.options[osEl.selectedIndex]?.dataset?.numero || '';
  const empId = gerarId('EMP');
  const ano   = new Date().getFullYear();
  const emprestimos = _getEmprestimos();
  const num   = `EMP-${ano}-${String(emprestimos.length + 1).padStart(4, '0')}`;

  const emp = {
    id: empId, numero: num,
    material_id: matId, material_nome: mat?.nome || matId, material_codigo: mat?.codigo || '',
    numero_serie: document.getElementById('empSerie')?.value || mat?.numero_serie || '',
    quantidade: qtd, unidade: mat?.unidade || 'UN',
    responsavel_retirada: responsavel,
    matricula_retirada: document.getElementById('empMatricula')?.value || '',
    setor_retirada: document.getElementById('empSetor')?.value || '',
    autorizado_por: document.getElementById('empAutorizado')?.value || (currentUser?.nome || currentUser?.name || 'Sistema') || '',
    data_retirada: document.getElementById('empDataRet')?.value || new Date().toISOString().slice(0,10),
    data_prevista_devolucao: document.getElementById('empDataPrev')?.value || '',
    local_uso: document.getElementById('empLocal')?.value || '',
    os_id: osId, os_numero: osNum,
    finalidade,
    condicao_retirada: document.getElementById('empCondicao')?.value || 'Bom',
    status: 'Ativo',
    obs_retirada: document.getElementById('empObs')?.value || '',
    criado_por: (currentUser?.nome || currentUser?.name || 'Sistema'),
    criado_em: new Date().toISOString()
  };

  emprestimos.unshift(emp);
  _saveEmprestimos(emprestimos);

  // Debita estoque
  estoque[matId] = qtyDisp - qtd;
  _saveEstoque(estoque);
  const matIdx = materiais.findIndex(m => m.id === matId);
  if (matIdx !== -1) { materiais[matIdx].estoque_atual = estoque[matId]; _saveMateriais(materiais); }

  // Registra movimento
  const movimentos = _getMovimentos();
  const movId = gerarId('MOV');
  movimentos.unshift({
    id: movId, numero: `MOV-EMP-${num}`,
    tipo: 'Saída', subtipo: 'Empréstimo',
    material_id: matId, material_nome: mat?.nome || matId,
    quantidade: qtd, unidade: mat?.unidade || 'UN',
    estoque_antes: qtyDisp, estoque_depois: qtyDisp - qtd,
    emprestimo_id: empId,
    responsavel: (currentUser?.nome || currentUser?.name || 'Sistema'), solicitante: responsavel,
    local_destino: emp.local_uso,
    observacoes: `Empréstimo ${num} para ${responsavel}${finalidade ? ' – '+finalidade : ''}`,
    status: 'Efetivado', criado_em: new Date().toISOString()
  });
  _saveMovimentos(movimentos);

  // Persiste na API
  try {
    await fetch('/api/emprestimos', {
      method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(emp)
    });
  } catch(e) { /* offline */ }

  logAction('Registrou empréstimo', 'almoxarifado', `${mat?.nome} para ${responsavel}`);
  showToast(`✅ Empréstimo <strong>${num}</strong> registrado para <strong>${responsavel}</strong>`, 'success', 4000);
  closeModal();
  _almoxAba = 'emprestimos';
  renderAlmoxarifado();
}

// ─── Devolução ─────────────────────────────────────
function abrirDevolucao(empId) {
  const emp = _getEmprestimos().find(e => e.id === empId);
  if (!emp) { showToast('Empréstimo não encontrado', 'error'); return; }

  openModal(`Devolução – ${emp.numero}`, `
    <div style="background:rgba(0,180,184,0.06);padding:12px;border-radius:8px;margin-bottom:16px;font-size:13px">
      <strong>${emp.material_nome}</strong>
      ${emp.numero_serie ? ` <span style="color:var(--text-muted)">S/N: ${emp.numero_serie}</span>` : ''}
      <br>
      <span style="color:var(--text-muted)">Retirado por <strong>${emp.responsavel_retirada}</strong> em ${fmtDate(emp.data_retirada)}</span>
      ${emp.data_prevista_devolucao ? `<br><span style="color:var(--text-muted)">Previsão: ${fmtDate(emp.data_prevista_devolucao)}</span>` : ''}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="form-group">
        <label>Data de Devolução *</label>
        <input type="date" class="form-control" id="devData" value="${new Date().toISOString().slice(0,10)}" required>
      </div>
      <div class="form-group">
        <label>Devolvido por *</label>
        <input type="text" class="form-control" id="devResponsavel" value="${emp.responsavel_retirada}" required>
      </div>
      <div class="form-group">
        <label>Condição na Devolução</label>
        <select class="form-control" id="devCondicao">
          ${['Bom','Regular','Danificado','Perdido'].map(c =>
            `<option value="${c}">${c}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Observações</label>
        <input type="text" class="form-control" id="devObs" placeholder="Condições, avarias, etc.">
      </div>
    </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
     <button class="btn btn-success" onclick="salvarDevolucao('${empId}')"><i class="fas fa-undo"></i> Confirmar Devolução</button>`);
}

async function salvarDevolucao(empId) {
  const emprestimos = _getEmprestimos();
  const empIdx      = emprestimos.findIndex(e => e.id === empId);
  if (empIdx === -1) { showToast('Empréstimo não encontrado', 'error'); return; }
  const emp = emprestimos[empIdx];

  const dataDevol   = document.getElementById('devData')?.value || new Date().toISOString().slice(0,10);
  const respDevol   = document.getElementById('devResponsavel')?.value?.trim();
  const condicao    = document.getElementById('devCondicao')?.value || 'Bom';
  const obs         = document.getElementById('devObs')?.value || '';
  if (!respDevol) { showToast('Informe quem está devolvendo', 'error'); return; }

  emprestimos[empIdx] = {
    ...emp,
    status: 'Devolvido',
    data_devolucao: dataDevol,
    responsavel_devolucao: respDevol,
    condicao_devolucao: condicao,
    obs_devolucao: obs,
    atualizado_em: new Date().toISOString()
  };
  _saveEmprestimos(emprestimos);

  // Credita estoque
  const estoque = _getEstoque();
  const materiais = _getMateriais();
  estoque[emp.material_id] = (estoque[emp.material_id] || 0) + emp.quantidade;
  _saveEstoque(estoque);
  const matIdx2 = materiais.findIndex(m => m.id === emp.material_id);
  if (matIdx2 !== -1) { materiais[matIdx2].estoque_atual = estoque[emp.material_id]; _saveMateriais(materiais); }

  // Registra movimento de devolução
  const movimentos = _getMovimentos();
  const movId = gerarId('MOV');
  movimentos.unshift({
    id: movId, numero: `MOV-DEV-${emp.numero}`,
    tipo: 'Entrada', subtipo: 'Devolução',
    material_id: emp.material_id, material_nome: emp.material_nome,
    quantidade: emp.quantidade, unidade: emp.unidade,
    estoque_antes: estoque[emp.material_id] - emp.quantidade,
    estoque_depois: estoque[emp.material_id],
    emprestimo_id: empId,
    responsavel: (currentUser?.nome || currentUser?.name || 'Sistema'), solicitante: respDevol,
    observacoes: `Devolução do empréstimo ${emp.numero}${obs ? ' – '+obs : ''}`,
    status: 'Efetivado', criado_em: new Date().toISOString()
  });
  _saveMovimentos(movimentos);

  // Persiste na API
  try {
    await fetch(`/api/emprestimos/${empId}/devolucao`, {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ data_devolucao: dataDevol, responsavel_devolucao: respDevol, condicao_devolucao: condicao, obs_devolucao: obs })
    });
  } catch(e) { /* offline */ }

  logAction('Registrou devolução', 'almoxarifado', `${emp.material_nome} – ${emp.numero}`);
  showToast(`✅ Devolução de <strong>${emp.material_nome}</strong> registrada!`, 'success', 4000);
  closeModal();
  renderAlmoxarifado();
}

// =====================================================
// INVENTÁRIO
// =====================================================
function abrirNovoInventario() {
  const categorias = [...new Set(_getMateriais().map(m => m.categoria).filter(Boolean))];

  openModal('Novo Inventário', `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="form-group">
        <label>Tipo de Inventário</label>
        <select class="form-control" id="invTipo" onchange="_invTipoChange()">
          <option value="Geral">Geral (todos os itens)</option>
          <option value="Parcial">Parcial (por categoria/local)</option>
          <option value="Cíclico">Cíclico</option>
        </select>
      </div>
      <div class="form-group">
        <label>Responsável</label>
        <input type="text" class="form-control" id="invResponsavel" value="${(currentUser?.nome || currentUser?.name || 'Sistema')||''}">
      </div>
      <div class="form-group" style="grid-column:1/-1">
        <label>Descrição</label>
        <input type="text" class="form-control" id="invDesc" placeholder="Ex: Inventário mensal maio/2026">
      </div>
      <div id="invFiltroArea" style="display:none;grid-column:1/-1">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-group">
            <label>Filtrar por Categoria</label>
            <select class="form-control" id="invCategoria">
              <option value="">Todas</option>
              ${categorias.map(c => `<option value="${c}">${c}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Filtrar por Localização</label>
            <input type="text" class="form-control" id="invLocal" placeholder="Ex: Galpão A">
          </div>
        </div>
      </div>
      <div class="form-group">
        <label>Data de Início</label>
        <input type="date" class="form-control" id="invData" value="${new Date().toISOString().slice(0,10)}">
      </div>
      <div class="form-group">
        <label>Observações</label>
        <input type="text" class="form-control" id="invObs" placeholder="Opcional">
      </div>
    </div>
    <div style="background:rgba(0,180,184,0.08);border-radius:8px;padding:10px;font-size:12px;color:var(--text-secondary);margin-top:8px">
      <i class="fas fa-info-circle" style="color:var(--fa-teal)"></i>
      Ao criar o inventário, todos os itens serão listados com o estoque atual do sistema para contagem física.
    </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
     <button class="btn btn-primary" onclick="salvarNovoInventario()"><i class="fas fa-clipboard-list"></i> Criar Inventário</button>`);
}

function _invTipoChange() {
  const tipo = document.getElementById('invTipo')?.value;
  const area = document.getElementById('invFiltroArea');
  if (area) area.style.display = tipo === 'Parcial' ? 'block' : 'none';
}

async function salvarNovoInventario() {
  const tipo       = document.getElementById('invTipo')?.value || 'Geral';
  const responsavel = document.getElementById('invResponsavel')?.value?.trim() || (currentUser?.nome || currentUser?.name || 'Sistema') || 'Sistema';
  const descricao  = document.getElementById('invDesc')?.value?.trim() || '';
  const dataInicio = document.getElementById('invData')?.value || new Date().toISOString().slice(0,10);
  const obs        = document.getElementById('invObs')?.value || '';
  const catFiltro  = document.getElementById('invCategoria')?.value || '';
  const localFiltro = document.getElementById('invLocal')?.value || '';

  const materiais  = _getMateriais();
  const estoque    = _getEstoque();
  const inventarios = _getInventarios();

  const invId  = gerarId('INV');
  const ano    = new Date().getFullYear();
  const num    = `INV-${ano}-${String(inventarios.length + 1).padStart(3, '0')}`;

  let listaItens = materiais.filter(m => m.ativo !== false && m.ativo !== 0);
  if (catFiltro)   listaItens = listaItens.filter(m => m.categoria === catFiltro);
  if (localFiltro) listaItens = listaItens.filter(m => (m.localizacao||'').toLowerCase().includes(localFiltro.toLowerCase()));

  const itens = listaItens.map(m => ({
    id: gerarId('IINV'), inventario_id: invId,
    material_id: m.id, material_nome: m.nome, material_codigo: m.codigo || '',
    unidade: m.unidade, localizacao: m.localizacao || '',
    estoque_sistema: estoque[m.id] ?? m.estoque_atual ?? 0,
    estoque_contado: null, divergencia: null,
    status: 'Pendente'
  }));

  const inv = {
    id: invId, numero: num,
    descricao: descricao || `Inventário ${tipo} – ${new Date().toLocaleDateString('pt-BR')}`,
    tipo, status: 'Aberto',
    data_inicio: dataInicio, data_fim: null,
    responsavel,
    total_itens: itens.length, itens_contados: 0, divergencias: 0,
    local_filtro: localFiltro, categoria_filtro: catFiltro,
    obs, itens,
    criado_em: new Date().toISOString()
  };

  inventarios.unshift(inv);
  _saveInventarios(inventarios);

  // Persiste na API
  try {
    await fetch('/api/inventarios', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ ...inv, itens: undefined })
    });
  } catch(e) { /* offline */ }

  logAction('Criou inventário', 'almoxarifado', `${num} – ${itens.length} itens`);
  showToast(`✅ Inventário <strong>${num}</strong> criado com <strong>${itens.length}</strong> itens!`, 'success', 4000);
  closeModal();
  _almoxAba = 'inventario';
  renderAlmoxarifado();
}

function abrirContagem(invId) {
  const inventarios = _getInventarios();
  const inv = inventarios.find(i => i.id === invId);
  if (!inv) { showToast('Inventário não encontrado', 'error'); return; }

  const itensPendentes = (inv.itens || []).filter(i => i.status === 'Pendente' || i.status === 'Contado');

  openModal(`Lançar Contagem – ${inv.numero}`, `
    <div style="margin-bottom:12px;font-size:12px;color:var(--text-muted)">
      ${inv.descricao} | ${itensPendentes.length} itens para contar
    </div>
    <div style="overflow-y:auto;max-height:420px">
      <table class="data-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Código</th>
            <th>Localização</th>
            <th style="text-align:right">Sist.</th>
            <th>Contado *</th>
            <th>Divergência</th>
            <th>Obs</th>
          </tr>
        </thead>
        <tbody>
          ${itensPendentes.map((item, i) => `<tr>
            <td style="font-size:12px"><strong>${item.material_nome}</strong></td>
            <td style="font-size:11px;color:var(--text-muted)">${item.material_codigo||'—'}</td>
            <td style="font-size:11px;color:var(--text-muted)">${item.localizacao||'—'}</td>
            <td style="font-size:12px;font-weight:700;text-align:right;color:var(--fa-teal)">${item.estoque_sistema} ${item.unidade||''}</td>
            <td>
              <input type="number" class="form-control" id="cnt_qtd_${item.id}"
                value="${item.estoque_contado !== null ? item.estoque_contado : ''}"
                min="0" step="0.01" style="width:80px;font-size:12px"
                oninput="_calcDivergencia('${item.id}', ${item.estoque_sistema})">
            </td>
            <td id="cnt_div_${item.id}" style="font-size:12px;font-weight:700;text-align:center;color:var(--text-muted)">—</td>
            <td>
              <input type="text" class="form-control" id="cnt_obs_${item.id}"
                value="${item.obs||''}" placeholder="obs" style="width:120px;font-size:11px">
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
     <button class="btn btn-primary" onclick="salvarContagem('${invId}')"><i class="fas fa-save"></i> Salvar Contagem</button>`);
}

function _calcDivergencia(itemId, estoquesSistema) {
  const input = document.getElementById(`cnt_qtd_${itemId}`);
  const divEl = document.getElementById(`cnt_div_${itemId}`);
  if (!input || !divEl) return;
  const contado = parseFloat(input.value);
  if (isNaN(contado)) { divEl.textContent = '—'; divEl.style.color = 'var(--text-muted)'; return; }
  const div = contado - estoquesSistema;
  divEl.textContent = (div > 0 ? '+' : '') + div;
  divEl.style.color = div === 0 ? 'var(--green)' : div > 0 ? 'var(--fa-teal)' : 'var(--red)';
}

async function salvarContagem(invId) {
  const inventarios = _getInventarios();
  const invIdx = inventarios.findIndex(i => i.id === invId);
  if (invIdx === -1) { showToast('Inventário não encontrado', 'error'); return; }
  const inv = inventarios[invIdx];

  let contados = 0;
  let divergencias = 0;
  const itensAtualiz = (inv.itens || []).map(item => {
    const inputEl = document.getElementById(`cnt_qtd_${item.id}`);
    const obsEl   = document.getElementById(`cnt_obs_${item.id}`);
    if (!inputEl) return item;
    const contado = parseFloat(inputEl.value);
    if (isNaN(contado)) return item;
    const div = contado - item.estoque_sistema;
    contados++;
    if (div !== 0) divergencias++;
    return {
      ...item,
      estoque_contado: contado,
      divergencia: div,
      status: 'Contado',
      obs: obsEl?.value || item.obs || '',
      contado_por: (currentUser?.nome || currentUser?.name || 'Sistema'),
      contado_em: new Date().toISOString()
    };
  });

  inventarios[invIdx] = {
    ...inv, itens: itensAtualiz,
    itens_contados: contados, divergencias,
    status: 'Em Contagem', atualizado_em: new Date().toISOString()
  };
  _saveInventarios(inventarios);

  logAction('Lançou contagem', 'almoxarifado', `${inv.numero} – ${contados} itens contados, ${divergencias} divergências`);
  showToast(`✅ Contagem salva! ${contados} itens contados, ${divergencias} divergência(s)`, 'success', 4000);
  closeModal();
  _almoxAba = 'inventario';
  renderAlmoxarifado();
}

async function concluirInventario(invId) {
  const inventarios = _getInventarios();
  const invIdx = inventarios.findIndex(i => i.id === invId);
  if (invIdx === -1) { showToast('Inventário não encontrado', 'error'); return; }
  const inv = inventarios[invIdx];

  const itensDiverg = (inv.itens || []).filter(i => i.status === 'Contado' && i.divergencia !== null && i.divergencia !== 0);
  if (!confirm(`Concluir inventário ${inv.numero}?\n\n${itensDiverg.length} item(ns) com divergência terão o estoque ajustado.\n\nEssa ação não pode ser desfeita.`)) return;

  const estoque   = _getEstoque();
  const materiais = _getMateriais();
  const movimentos = _getMovimentos();

  for (const item of itensDiverg) {
    // Ajusta estoque
    estoque[item.material_id] = item.estoque_contado;
    const matIdx = materiais.findIndex(m => m.id === item.material_id);
    if (matIdx !== -1) { materiais[matIdx].estoque_atual = item.estoque_contado; }
    // Registra movimento de ajuste
    movimentos.unshift({
      id: gerarId('MOV'), numero: `MOV-INV-${inv.numero}-${item.id.slice(-4)}`,
      tipo: 'Ajuste', subtipo: 'Inventário',
      material_id: item.material_id, material_nome: item.material_nome,
      quantidade: item.estoque_contado,
      estoque_antes: item.estoque_sistema, estoque_depois: item.estoque_contado,
      inventario_id: invId,
      responsavel: (currentUser?.nome || currentUser?.name || 'Sistema'),
      observacoes: `Ajuste de inventário ${inv.numero}`,
      status: 'Efetivado', criado_em: new Date().toISOString()
    });
  }

  _saveEstoque(estoque);
  _saveMateriais(materiais);
  _saveMovimentos(movimentos);

  inventarios[invIdx] = {
    ...inv,
    status: 'Concluído', data_fim: new Date().toISOString().slice(0,10),
    aprovador: (currentUser?.nome || currentUser?.name || 'Sistema'), aprovado_em: new Date().toISOString(),
    itens: (inv.itens||[]).map(i => i.divergencia !== null && i.divergencia !== 0 ? {...i, status:'Ajustado', ajustado:true} : i),
    atualizado_em: new Date().toISOString()
  };
  _saveInventarios(inventarios);

  // Persiste na API
  try {
    await fetch(`/api/inventarios/${invId}/concluir`, { method: 'POST' });
  } catch(e) { /* offline */ }

  logAction('Concluiu inventário', 'almoxarifado', `${inv.numero} – ${itensDiverg.length} ajuste(s)`);
  showToast(`✅ Inventário <strong>${inv.numero}</strong> concluído! ${itensDiverg.length} ajuste(s) aplicado(s)`, 'success', 5000);
  renderAlmoxarifado();
}

// =====================================================
// HISTÓRICO DO ITEM (rastreabilidade)
// =====================================================
function _verHistoricoItem(matId) {
  const materiais  = _getMateriais();
  const mat        = materiais.find(m => m.id === matId);
  const movimentos = _getMovimentos().filter(m => m.material_id === matId);
  const emprestimos = _getEmprestimos().filter(e => e.material_id === matId);
  const estoque    = _getEstoque();
  const qtdAtual   = estoque[matId] ?? mat?.estoque_atual ?? 0;

  openModal(`Histórico – ${mat?.nome || matId}`, `
    <div style="background:rgba(0,180,184,0.06);padding:12px;border-radius:8px;margin-bottom:16px">
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;text-align:center">
        <div><div style="font-size:11px;color:var(--text-muted)">Código</div><strong>${mat?.codigo||'—'}</strong></div>
        <div><div style="font-size:11px;color:var(--text-muted)">Estoque Atual</div><strong style="color:var(--fa-teal)">${qtdAtual} ${mat?.unidade||'UN'}</strong></div>
        <div><div style="font-size:11px;color:var(--text-muted)">Tipo</div><strong>${mat?.tipo||'—'}</strong></div>
        <div><div style="font-size:11px;color:var(--text-muted)">Localização</div><strong>${mat?.localizacao||'—'}</strong></div>
      </div>
      ${mat?.numero_serie ? `<div style="font-size:11px;color:var(--text-muted);margin-top:6px;text-align:center"><i class="fas fa-barcode"></i> Nº Série: <strong>${mat.numero_serie}</strong></div>` : ''}
    </div>

    <div style="display:grid;grid-template-columns:1.2fr 1fr;gap:16px">
      <!-- Movimentações -->
      <div>
        <h5 style="color:var(--fa-teal);margin-bottom:10px"><i class="fas fa-exchange-alt" style="margin-right:5px"></i>Movimentações (${movimentos.length})</h5>
        <div style="max-height:320px;overflow-y:auto">
          ${movimentos.length ? `<table class="data-table" style="font-size:11px">
            <thead><tr><th>Tipo</th><th>Qtd</th><th>Est. Após</th><th>Responsável</th><th>Ref</th><th>Data</th></tr></thead>
            <tbody>
            ${movimentos.map(m => {
              const cor = m.tipo==='Entrada'||m.tipo==='Devolução' ? 'var(--green)' : m.tipo==='Ajuste' ? 'var(--fa-teal)' : 'var(--orange)';
              return `<tr>
                <td style="color:${cor};font-weight:700">${m.tipo}<br><span style="font-weight:400;font-size:10px">${m.subtipo||''}</span></td>
                <td style="color:${cor};font-weight:700">${m.tipo==='Saída'?'-':'+'} ${m.quantidade}</td>
                <td style="color:var(--text-muted)">${m.estoque_depois ?? '—'}</td>
                <td>${m.responsavel||'—'}${m.solicitante&&m.solicitante!==m.responsavel?`<br><span style="color:var(--text-muted)">por: ${m.solicitante}</span>`:''}</td>
                <td style="color:var(--text-muted)">${m.pedido_numero||m.recebimento_num||m.nota_fiscal||m.os_numero||'—'}</td>
                <td style="white-space:nowrap">${fmtDate(m.criado_em||m.data)}</td>
              </tr>`;
            }).join('')}
            </tbody>
          </table>` : '<div style="text-align:center;color:var(--text-muted);padding:20px">Sem movimentações</div>'}
        </div>
      </div>

      <!-- Empréstimos -->
      <div>
        <h5 style="color:var(--fa-teal);margin-bottom:10px"><i class="fas fa-hand-holding" style="margin-right:5px"></i>Empréstimos (${emprestimos.length})</h5>
        <div style="max-height:320px;overflow-y:auto">
          ${emprestimos.length ? emprestimos.map(e => {
            const isAtivo = e.status === 'Ativo';
            const isAtrasado = isAtivo && e.data_prevista_devolucao && new Date(e.data_prevista_devolucao) < new Date();
            return `<div style="border:1px solid var(--border-color);border-radius:8px;padding:10px;margin-bottom:8px;
              ${isAtrasado?'border-color:var(--red);background:rgba(220,53,69,0.04)':''}">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                <strong style="font-size:12px">${e.numero}</strong>
                <span style="font-size:11px;font-weight:700;color:${isAtrasado?'var(--red)':isAtivo?'var(--fa-teal)':'var(--green)'}">
                  ${isAtrasado ? '⚠ Atrasado' : e.status}
                </span>
              </div>
              <div style="font-size:11px;color:var(--text-muted)">
                <div><i class="fas fa-user" style="width:14px"></i> <strong>${e.responsavel_retirada}</strong>${e.setor_retirada?' – '+e.setor_retirada:''}</div>
                <div><i class="fas fa-calendar" style="width:14px"></i> ${fmtDate(e.data_retirada)} ${e.data_prevista_devolucao?' → Prev: '+fmtDate(e.data_prevista_devolucao):''}</div>
                ${e.data_devolucao ? `<div style="color:var(--green)"><i class="fas fa-check" style="width:14px"></i> Devolvido: ${fmtDate(e.data_devolucao)} por ${e.responsavel_devolucao||'—'}</div>` : ''}
                ${e.finalidade ? `<div><i class="fas fa-info-circle" style="width:14px"></i> ${e.finalidade}</div>` : ''}
                ${e.condicao_devolucao ? `<div>Condição devolvida: <strong>${e.condicao_devolucao}</strong></div>` : ''}
              </div>
            </div>`;
          }).join('') : '<div style="text-align:center;color:var(--text-muted);padding:20px">Sem empréstimos</div>'}
        </div>
      </div>
    </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
     ${hasPermission('almoxarifado','create') ? `
     <button class="btn btn-success" onclick="closeModal();abrirEntradaMaterial('${matId}')">
       <i class="fas fa-arrow-down"></i> Entrada
     </button>
     <button class="btn btn-warning" onclick="closeModal();abrirSaidaMaterial('${matId}')">
       <i class="fas fa-arrow-up"></i> Saída
     </button>` : ''}`);
}

// =====================================================
// DETALHES DE MOVIMENTO
// =====================================================
function _verDetalheMovimento(movId) {
  const mov = _getMovimentos().find(m => m.id === movId);
  if (!mov) { showToast('Movimento não encontrado', 'error'); return; }

  const isCancelado = mov.status === 'Cancelado';
  const cor  = mov.tipo==='Entrada'||mov.tipo==='Devolução' ? 'var(--green)' : mov.tipo==='Ajuste' ? 'var(--fa-teal)' : 'var(--orange)';
  const icon = mov.tipo==='Entrada' ? 'fa-arrow-down' : mov.tipo==='Devolução' ? 'fa-undo' : mov.tipo==='Ajuste' ? 'fa-sliders-h' : 'fa-arrow-up';

  openModal(`Detalhe – ${mov.numero||mov.id?.slice(0,10)}`, `
    <div style="background:rgba(0,180,184,0.06);padding:16px;border-radius:10px;margin-bottom:16px;text-align:center">
      <i class="fas ${icon}" style="font-size:32px;color:${cor};margin-bottom:8px;display:block"></i>
      <div style="font-size:22px;font-weight:700;color:${cor}">${mov.tipo} ${mov.subtipo ? `(${mov.subtipo})` : ''}</div>
      <div style="font-size:28px;font-weight:900;margin-top:4px">${mov.quantidade} ${mov.unidade||''}</div>
      <div style="font-size:12px;color:var(--text-muted);margin-top:4px">${mov.material_nome}</div>
      ${isCancelado ? '<div style="color:var(--red);font-weight:700;margin-top:6px">CANCELADO</div>' : ''}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px">
      ${[
        ['Número', mov.numero||'—'],
        ['Material', mov.material_nome+(mov.material_codigo?' ('+mov.material_codigo+')':'')],
        ['Responsável', mov.responsavel||'—'],
        ['Solicitante', mov.solicitante||'—'],
        ['Estoque Antes', mov.estoque_antes ?? '—'],
        ['Estoque Depois', mov.estoque_depois ?? '—'],
        ['Nota Fiscal', mov.nota_fiscal||'—'],
        ['Valor Total', mov.valor_total ? 'R$ '+fmt(mov.valor_total) : '—'],
        ['Pedido', mov.pedido_numero||'—'],
        ['Recebimento', mov.recebimento_num||'—'],
        ['OS', mov.os_numero||'—'],
        ['Nº Série', mov.numero_serie||'—'],
        ['Destino', mov.local_destino||'—'],
        ['Data', fmtDate(mov.criado_em||mov.data)],
        ['Observações', mov.observacoes||'—'],
      ].filter(([,v]) => v && v !== '—' || ['Observações'].includes(String(arguments[0]))).map(([k,v]) => `
        <div style="background:var(--bg-card);padding:8px 12px;border-radius:6px">
          <div style="font-size:10px;color:var(--text-muted);margin-bottom:2px">${k}</div>
          <div style="font-weight:500">${v}</div>
        </div>`).join('')}
    </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
     ${!isCancelado && hasPermission('almoxarifado','create') ? `
     <button class="btn btn-sm" onclick="closeModal();_cancelarMovimento('${movId}')"
       style="background:var(--red);color:#fff"><i class="fas fa-times"></i> Cancelar Movimento</button>` : ''}`);
}

// =====================================================
// DETALHE DE EMPRÉSTIMO
// =====================================================
function _verDetalheEmprestimo(empId) {
  const emp = _getEmprestimos().find(e => e.id === empId);
  if (!emp) { showToast('Empréstimo não encontrado', 'error'); return; }

  const atrasado    = emp.status === 'Ativo' && emp.data_prevista_devolucao && new Date(emp.data_prevista_devolucao) < new Date();
  const statusColor = emp.status === 'Devolvido' ? 'var(--green)' : atrasado ? 'var(--red)' : 'var(--fa-teal)';

  openModal(`Empréstimo – ${emp.numero}`, `
    <div style="background:rgba(0,180,184,0.06);padding:14px;border-radius:10px;margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <strong style="font-size:15px">${emp.material_nome}</strong>
        <span style="font-weight:700;color:${statusColor}">${atrasado?'⚠ Atrasado':emp.status}</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px">
        ${[
          ['Qtd', emp.quantidade+' '+(emp.unidade||'')],
          ['Nº Série', emp.numero_serie||'—'],
          ['Retirado por', emp.responsavel_retirada],
          ['Matrícula', emp.matricula_retirada||'—'],
          ['Setor', emp.setor_retirada||'—'],
          ['Autorizado por', emp.autorizado_por||'—'],
          ['Retirada em', fmtDate(emp.data_retirada)],
          ['Prev. Devolução', emp.data_prevista_devolucao ? fmtDate(emp.data_prevista_devolucao) : '—'],
          ['Local de Uso', emp.local_uso||'—'],
          ['OS', emp.os_numero||'—'],
          ['Finalidade', emp.finalidade||'—'],
          ['Condição Retirada', emp.condicao_retirada||'—'],
          ...(emp.data_devolucao ? [
            ['Devolvido em', fmtDate(emp.data_devolucao)],
            ['Devolvido por', emp.responsavel_devolucao||'—'],
            ['Condição Devolvida', emp.condicao_devolucao||'—'],
          ] : []),
        ].map(([k,v]) => `
          <div style="background:var(--bg-card);padding:6px 10px;border-radius:6px">
            <div style="font-size:10px;color:var(--text-muted)">${k}</div>
            <div style="font-weight:500">${v}</div>
          </div>`).join('')}
      </div>
      ${emp.obs_retirada ? `<div style="margin-top:8px;font-size:12px;color:var(--text-muted)">Obs retirada: ${emp.obs_retirada}</div>` : ''}
      ${emp.obs_devolucao ? `<div style="font-size:12px;color:var(--text-muted)">Obs devolução: ${emp.obs_devolucao}</div>` : ''}
    </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
     ${emp.status === 'Ativo' && hasPermission('almoxarifado','create') ? `
     <button class="btn btn-success" onclick="closeModal();abrirDevolucao('${emp.id}')">
       <i class="fas fa-undo"></i> Registrar Devolução
     </button>` : ''}`);
}

// =====================================================
// CANCELAR MOVIMENTO
// =====================================================
async function _cancelarMovimento(movId) {
  const mov = _getMovimentos().find(m => m.id === movId);
  if (!mov) { showToast('Movimento não encontrado', 'error'); return; }
  if (mov.status === 'Cancelado') { showToast('Movimento já cancelado', 'warning'); return; }

  const motivo = prompt(`Motivo do cancelamento do movimento ${mov.numero}:`);
  if (motivo === null) return;

  const movimentos = _getMovimentos();
  const movIdx     = movimentos.findIndex(m => m.id === movId);
  if (movIdx === -1) return;

  // Estorna estoque
  const estoque   = _getEstoque();
  const materiais = _getMateriais();
  const estornoQtd = mov.tipo === 'Saída' ? +mov.quantidade : -mov.quantidade;
  estoque[mov.material_id] = (estoque[mov.material_id] || 0) + estornoQtd;
  _saveEstoque(estoque);
  const matIdx = materiais.findIndex(m => m.id === mov.material_id);
  if (matIdx !== -1) { materiais[matIdx].estoque_atual = estoque[mov.material_id]; _saveMateriais(materiais); }

  movimentos[movIdx] = {
    ...mov, status: 'Cancelado',
    cancelado_por: (currentUser?.nome || currentUser?.name || 'Sistema'),
    cancelado_em: new Date().toISOString(),
    motivo_cancelamento: motivo
  };
  _saveMovimentos(movimentos);

  // Persiste na API
  try {
    await fetch(`/api/movimentos-estoque/${movId}/cancelar`, {
      method: 'PATCH', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ motivo })
    });
  } catch(e) { /* offline */ }

  logAction('Cancelou movimento', 'almoxarifado', `${mov.numero} – motivo: ${motivo}`);
  showToast(`Movimento ${mov.numero} cancelado. Estoque estornado.`, 'success', 4000);
  _almoxRenderAba();
}

// =====================================================
// RELATÓRIO DE INVENTÁRIO
// =====================================================
function _verRelatorioInventario(invId) {
  const inventarios = _getInventarios();
  const inv = inventarios.find(i => i.id === invId);
  if (!inv) { showToast('Inventário não encontrado', 'error'); return; }

  const itensContados  = (inv.itens || []).filter(i => i.status !== 'Pendente');
  const itensDiverg    = itensContados.filter(i => i.divergencia !== null && i.divergencia !== 0);
  const itensOk        = itensContados.filter(i => i.divergencia === 0);

  openModal(`Relatório – ${inv.numero}`, `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px">
      ${[
        ['Total Itens', inv.total_itens||0, 'var(--text-primary)'],
        ['Contados', inv.itens_contados||0, 'var(--fa-teal)'],
        ['Divergências', inv.divergencias||0, (inv.divergencias||0)>0?'var(--red)':'var(--green)'],
        ['OK', itensOk.length, 'var(--green)'],
      ].map(([l,v,c]) => `
        <div class="kpi-card" style="text-align:center">
          <div class="kpi-label">${l}</div>
          <div class="kpi-value" style="font-size:22px;color:${c}">${v}</div>
        </div>`).join('')}
    </div>

    ${itensDiverg.length ? `
    <h5 style="color:var(--red);margin-bottom:8px"><i class="fas fa-exclamation-triangle"></i> Divergências</h5>
    <div style="overflow-y:auto;max-height:250px;margin-bottom:12px">
      <table class="data-table" style="font-size:12px">
        <thead><tr><th>Item</th><th>Cód.</th><th>Sistema</th><th>Contado</th><th>Divergência</th><th>Status</th></tr></thead>
        <tbody>
          ${itensDiverg.map(i => `<tr>
            <td><strong>${i.material_nome}</strong></td>
            <td style="color:var(--text-muted)">${i.material_codigo||'—'}</td>
            <td style="font-weight:700">${i.estoque_sistema} ${i.unidade||''}</td>
            <td style="font-weight:700;color:var(--fa-teal)">${i.estoque_contado} ${i.unidade||''}</td>
            <td style="font-weight:700;color:${i.divergencia>0?'var(--fa-teal)':'var(--red)'}">
              ${i.divergencia > 0 ? '+' : ''}${i.divergencia}
            </td>
            <td>${i.ajustado ? '<span style="color:var(--green)">Ajustado</span>' : '<span style="color:var(--orange)">Pendente</span>'}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>` : `<div style="text-align:center;color:var(--green);padding:16px">
      <i class="fas fa-check-circle" style="font-size:24px;margin-bottom:6px;display:block"></i>
      Nenhuma divergência encontrada!
    </div>`}

    <div style="font-size:12px;color:var(--text-muted);margin-top:8px">
      <strong>Responsável:</strong> ${inv.responsavel||'—'} &nbsp;|&nbsp;
      <strong>Início:</strong> ${fmtDate(inv.data_inicio)} &nbsp;|&nbsp;
      <strong>Fim:</strong> ${inv.data_fim ? fmtDate(inv.data_fim) : '—'} &nbsp;|&nbsp;
      <strong>Status:</strong> ${inv.status}
    </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Fechar</button>`);
}

// =====================================================
// LINKS RASTREÁVEIS (navegação cruzada)
// =====================================================
function _almoxVerPedido(pedidoId) {
  if (!pedidoId) return;
  closeModal();
  if (typeof verDetalhePedido === 'function') {
    setTimeout(() => { navigate('pedidos'); setTimeout(() => verDetalhePedido(pedidoId), 400); }, 200);
  } else {
    showToast('Navegando para Pedidos...', 'info');
  }
}

function _almoxVerRecebimento(recebId) {
  if (!recebId) return;
  closeModal();
  showToast('Navegando para Recebimento...', 'info');
  setTimeout(() => { navigate('procurement'); }, 300);
}

// =====================================================
// INTEGRAÇÃO: ENTRADA AUTOMÁTICA PÓS-RECEBIMENTO
// =====================================================
function almoxEntradaAutomaticaDeRecebimento(recebimento, pedido) {
  // Chamada pela função _salvarRecebimentoPedido do pedidos.js
  if (!recebimento || !pedido) return;

  const itensInsp = recebimento.itens_inspecao || [];
  if (!itensInsp.length) return;

  const movimentos = _getMovimentos();
  const estoque    = _getEstoque();
  const materiais  = _getMateriais();

  let qtdItens = 0;
  for (const item of itensInsp) {
    // Aceita qualquer campo de identificação: material_id, nome, ou descricao
    const itemNome = item.nome || item.descricao || item.material || item.desc || '';
    if (!item.material_id && !itemNome) continue;

    // Ignora itens recusados na inspeção
    if ((item.status || '').toLowerCase() === 'recusado') continue;

    const qtdRec = parseFloat(item.qtd_recebida || item.quantidade || item.qtd || 0);
    if (qtdRec <= 0) continue;

    // Tenta encontrar material pelo id, nome ou descricao no catálogo
    let mat = (item.material_id ? materiais.find(m => m.id === item.material_id) : null) ||
              (itemNome ? materiais.find(m => m.nome?.toLowerCase() === itemNome.toLowerCase()) : null) ||
              (itemNome ? materiais.find(m => m.descricao?.toLowerCase() === itemNome.toLowerCase()) : null) ||
              (itemNome ? materiais.find(m => {
                const primeirasPalavras = itemNome.toLowerCase().split(' ').slice(0,3).join(' ');
                return m.nome?.toLowerCase().includes(primeirasPalavras) || m.descricao?.toLowerCase().includes(primeirasPalavras);
              }) : null);

    const matId   = mat?.id || item.material_id || gerarId('MAT');
    const matNome = mat?.nome || itemNome || 'Item s/ cadastro';
    const unidade = mat?.unidade || item.unidade || item.un || 'UN';

    // Se o material não existe no catálogo, cria automaticamente
    if (!mat) {
      mat = {
        id: matId, codigo: `REC-${recebimento.numero}-${qtdItens+1}`,
        nome: matNome, unidade,
        tipo: 'Material', ativo: true,
        estoque_atual: 0, estoque_minimo: 0,
        pedido_id: pedido.id, recebimento_id: recebimento.id,
        criado_em: new Date().toISOString(), atualizado_em: new Date().toISOString()
      };
      materiais.push(mat);
    }

    const estoqueAntes  = estoque[matId] || 0;
    const estoqueDepois = estoqueAntes + qtdRec;
    const movId         = gerarId('MOV');
    const ano           = new Date().getFullYear();
    const num           = `MOV-${ano}-${String(movimentos.length + 1).padStart(4,'0')}`;

    movimentos.unshift({
      id: movId, numero: num,
      tipo: 'Entrada', subtipo: 'Recebimento',
      material_id: matId, material_nome: matNome, material_codigo: mat.codigo || '',
      quantidade: qtdRec, unidade,
      valor_unitario: item.valor_unitario || 0,
      valor_total: (item.valor_unitario || 0) * qtdRec,
      estoque_antes: estoqueAntes, estoque_depois: estoqueDepois,
      pedido_id: pedido.id, pedido_numero: pedido.numero,
      recebimento_id: recebimento.id, recebimento_num: recebimento.numero,
      nota_fiscal: recebimento.nf_numero,
      fornecedor_id: pedido.fornecedor_id, fornecedor_nome: pedido.fornecedor_nome,
      local_destino: recebimento.local_entrega || '',
      responsavel: recebimento.conferente || (currentUser?.nome || currentUser?.name || 'Sistema') || 'Sistema',
      observacoes: `Entrada automática – Recebimento ${recebimento.numero} – NF: ${recebimento.nf_numero}`,
      status: 'Efetivado', criado_em: new Date().toISOString()
    });

    estoque[matId] = estoqueDepois;
    const matIdx  = materiais.findIndex(m => m.id === matId);
    if (matIdx !== -1) { materiais[matIdx].estoque_atual = estoqueDepois; }
    qtdItens++;
  }

  if (qtdItens > 0) {
    _saveMovimentos(movimentos);
    _saveEstoque(estoque);
    _saveMateriais(materiais);
    console.log(`[Almoxarifado] Entrada automática: ${qtdItens} item(ns) após recebimento ${recebimento.numero}`);
  }
}

// =====================================================
// EXPORTAR MOVIMENTOS CSV
// =====================================================
function exportarMovimentos() {
  const campos = ['numero','tipo','subtipo','material_nome','material_codigo','quantidade','unidade',
    'valor_total','estoque_antes','estoque_depois','nota_fiscal','pedido_numero','recebimento_num',
    'os_numero','responsavel','solicitante','local_destino','observacoes','status','criado_em'];
  const labels = ['Nº Movimento','Tipo','Subtipo','Material','Código','Quantidade','Unidade',
    'Valor Total','Est. Antes','Est. Depois','NF','Pedido','Recebimento',
    'OS','Responsável','Solicitante','Destino','Observações','Status','Data'];
  const movimentos = _getMovimentos();
  const rows = [labels];
  movimentos.forEach(m => rows.push(campos.map(k => (m[k] || ''))));
  const csv = rows.map(r => r.map(v => '"' + String(v).replace(/"/g,'""') + '"').join(';')).join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(csv);
  a.download = 'movimentacoes_estoque.csv';
  a.click();
  showToast('Exportação concluída!', 'success');
}

// =====================================================
// LEGACY – compatibilidade com código antigo
// =====================================================
function enviarParaContasPagar(movId) {
  const movimentos = _getMovimentos();
  const mov = movimentos.find(m => m.id === movId);
  if (!mov) return;
  const pedidos = JSON.parse(localStorage.getItem('fa_pedidos') || '[]');
  const pedido  = pedidos.find(p => p.id === mov.pedido_compra_id || p.id === mov.pedido_id);
  const cp      = JSON.parse(localStorage.getItem('fa_contas_pagar_v2') || '[]');
  const cpId    = gerarId('CP');
  cp.unshift({
    id: cpId, pedido_id: mov.pedido_id || mov.pedido_compra_id || '',
    fornecedor_id: pedido?.fornecedor_id || '',
    fornecedor_nome: pedido?.fornecedor_nome || 'Não identificado',
    descricao: `Recebimento – ${mov.material_nome} – NF: ${mov.nota_fiscal || 'S/N'}`,
    valor: mov.valor_total || 0, nota_fiscal: mov.nota_fiscal || '',
    data_lancamento: new Date().toISOString().slice(0,10),
    vencimento: pedido?.prazo_pagamento || '',
    status: 'Pendente', pix_chave: pedido?.pix_chave || '',
    dados_bancarios: pedido?.dados_bancarios || '',
    movimento_id: movId, criado_por: (currentUser?.nome || currentUser?.name || 'Sistema'),
    criado_em: new Date().toISOString()
  });
  localStorage.setItem('fa_contas_pagar_v2', JSON.stringify(cp));
  const idx = movimentos.findIndex(m => m.id === movId);
  if (idx !== -1) { movimentos[idx].enviado_cp = true; _saveMovimentos(movimentos); }
  logAction('Enviou para Contas a Pagar', 'almoxarifado', cpId);
  showToast('Lançado em Contas a Pagar!', 'success');
  renderAlmoxarifado();
}

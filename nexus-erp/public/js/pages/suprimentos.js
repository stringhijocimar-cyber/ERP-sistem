// =====================================================
// Fraser Alexander – Módulo Suprimentos Completo
// Materiais, Requisições, Mapa Comparativo, Pedidos, Contratos
// =====================================================

// ─── ARMAZENAMENTO LOCAL ────────────────────────────────────────────────────
function _getMateriais()    { try { const r=localStorage.getItem('fa_materiais');    return r?JSON.parse(r):[]; } catch(e){return[];} }
function _saveMateriais(d)  { localStorage.setItem('fa_materiais', JSON.stringify(d)); }
function _getRequisicoes()  { try { const r=localStorage.getItem('fa_requisicoes');  return r?JSON.parse(r):[]; } catch(e){return[];} }
function _saveRequisicoes(d){ localStorage.setItem('fa_requisicoes', JSON.stringify(d)); }
function _getMapasCot()     { try { const r=localStorage.getItem('fa_mapas_cotacao'); return r?JSON.parse(r):[]; } catch(e){return[];} }
function _saveMapasCot(d)   { localStorage.setItem('fa_mapas_cotacao', JSON.stringify(d)); }
function _getContratosFor() { try { const r=localStorage.getItem('fa_contratos_fornecimento'); return r?JSON.parse(r):[]; } catch(e){return[];} }
function _saveContratosFor(d){ localStorage.setItem('fa_contratos_fornecimento', JSON.stringify(d)); }

// Sem pré-carga de dados fictícios – dados carregados via API/localStorage conforme uso

// ─── MÓDULO PRINCIPAL COMPRAS ─────────────────────────────────────────────────
function renderCompras() {
  if (!hasPermission('requisicoes', 'view') && !hasPermission('pedidos', 'view')) {
    renderAcessoNegado(); return;
  }
  const main = document.getElementById('mainContent');
  const reqs = _getRequisicoes();
  const materiais = _getMateriais();
  const contratos = _getContratosFor();

  const reqsPendentes = reqs.filter(r => r.status.includes('Pendente')).length;
  const reqsAprovadas = reqs.filter(r => r.status === 'Aprovada Gestor').length;
  const matCriticos = materiais.filter(m => m.status === 'Crítico').length;
  const matAlerta = materiais.filter(m => m.status === 'Alerta').length;

  main.innerHTML = `
    <div class="page-header">
      <div class="page-title">
        <h2><i class="fas fa-shopping-cart" style="color:var(--orange);margin-right:8px"></i>Suprimentos</h2>
        <p>Requisições, Compras, Materiais e Contratos</p>
      </div>
    </div>

    <!-- KPIs -->
    <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr)">
      <div class="kpi-card ${reqsPendentes>0?'kpi-yellow':'kpi-green'}">
        <div class="kpi-icon"><i class="fas fa-file-alt"></i></div>
        <div class="kpi-value">${reqsPendentes}</div>
        <div class="kpi-label">Requisições Pendentes</div>
      </div>
      <div class="kpi-card kpi-blue">
        <div class="kpi-icon"><i class="fas fa-check-double"></i></div>
        <div class="kpi-value">${reqsAprovadas}</div>
        <div class="kpi-label">Aprovadas p/ Cotação</div>
      </div>
      <div class="kpi-card ${matCriticos>0?'kpi-red':'kpi-orange'}">
        <div class="kpi-icon"><i class="fas fa-exclamation-circle"></i></div>
        <div class="kpi-value">${matCriticos + matAlerta}</div>
        <div class="kpi-label">Materiais c/ Estoque Baixo</div>
      </div>
      <div class="kpi-card kpi-green">
        <div class="kpi-icon"><i class="fas fa-handshake"></i></div>
        <div class="kpi-value">${contratos.filter(c=>c.status==='Ativo').length}</div>
        <div class="kpi-label">Contratos Ativos</div>
      </div>
    </div>

    <!-- Abas de navegação -->
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
      ${hasPermission('requisicoes','view') ? `<button class="btn btn-primary btn-sm" onclick="navigate('requisicoes')"><i class="fas fa-file-alt"></i> Requisições de Compra</button>` : ''}
      ${hasPermission('mapa_cotacao','view') ? `<button class="btn btn-secondary btn-sm" onclick="navigate('mapa_cotacao')"><i class="fas fa-balance-scale"></i> Mapa Comparativo</button>` : ''}
      ${hasPermission('pedidos','view') ? `<button class="btn btn-secondary btn-sm" onclick="navigate('pedidos')"><i class="fas fa-shopping-cart"></i> Pedidos de Compra</button>` : ''}
      ${hasPermission('materiais','view') ? `<button class="btn btn-secondary btn-sm" onclick="navigate('materiais')"><i class="fas fa-cube"></i> Cadastro de Materiais</button>` : ''}
      ${hasPermission('contratos_sup','view') ? `<button class="btn btn-secondary btn-sm" onclick="navigate('contratos_sup')"><i class="fas fa-handshake"></i> Contratos Fornecimento</button>` : ''}
      ${hasPermission('almoxarifado','view') ? `<button class="btn btn-secondary btn-sm" onclick="navigate('almoxarifado_')"><i class="fas fa-boxes"></i> Almoxarifado</button>` : ''}
    </div>

    <!-- Requisições pendentes de aprovação -->
    ${reqsPendentes > 0 ? `
    <div class="card page-section" style="border-color:var(--yellow)">
      <div class="card-header"><h3><i class="fas fa-clock" style="color:var(--yellow-light);margin-right:8px"></i>Requisições Aguardando Aprovação</h3></div>
      ${reqs.filter(r => r.status.includes('Pendente')).map(r => `
        <div class="alert alert-warning" style="margin:4px 16px;cursor:pointer" onclick="verDetalheRequisicao('${r.id}')">
          <span class="alert-icon"><i class="fas fa-file-alt"></i></span>
          <div style="flex:1">
            <div style="font-weight:600">${r.id} – ${r.titulo}</div>
            <div style="font-size:12px;color:var(--text-secondary)">${r.contrato} · ${r.solicitante} · ${fmt(r.valor_estimado)} · ${r.status}</div>
          </div>
          <div style="display:flex;gap:6px">
            ${r.status === 'Pendente Supervisor' && hasPermission('requisicoes','approve') ? `<button class="btn btn-success btn-sm" onclick="event.stopPropagation();aprovarRequisicao('${r.id}','supervisor')"><i class="fas fa-check"></i> Aprovar</button>` : ''}
            ${r.status === 'Aprovada Supervisor' && hasPermission('requisicoes','approve') ? `<button class="btn btn-success btn-sm" onclick="event.stopPropagation();aprovarRequisicao('${r.id}','gestor')"><i class="fas fa-check-double"></i> Aprovar (Gestor)</button>` : ''}
          </div>
        </div>
      `).join('')}
      <div style="height:8px"></div>
    </div>` : ''}

    <!-- Materiais críticos -->
    ${(matCriticos + matAlerta) > 0 ? `
    <div class="card page-section" style="border-color:var(--red)">
      <div class="card-header"><h3><i class="fas fa-exclamation-triangle" style="color:var(--red-light);margin-right:8px"></i>Materiais com Estoque Crítico</h3></div>
      <div class="table-wrapper">
        <table>
          <thead><tr><th>Código</th><th>Descrição</th><th>Categoria</th><th>Estoque Atual</th><th>Estoque Mínimo</th><th>Status</th><th>Ações</th></tr></thead>
          <tbody>
            ${materiais.filter(m => m.status === 'Crítico' || m.status === 'Alerta').map(m => `
              <tr>
                <td style="color:var(--orange);font-weight:600">${m.codigo}</td>
                <td>${m.descricao}</td>
                <td><span class="badge badge-muted">${m.categoria}</span></td>
                <td style="color:${m.status==='Crítico'?'var(--red-light)':'var(--yellow-light)'};font-weight:700">${m.estoque_atual} ${m.unidade}</td>
                <td style="color:var(--text-muted)">${m.estoque_min} ${m.unidade}</td>
                <td>${statusBadge(m.status)}</td>
                <td><button class="btn btn-primary btn-sm" onclick="gerarRequisicaoDeMaterial('${m.id}')"><i class="fas fa-plus"></i> Gerar Requisição</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>` : ''}
  `;
}

// ─── CADASTRO DE MATERIAIS ────────────────────────────────────────────────────
function renderMateriais() {
  if (!hasPermission('materiais', 'view')) { renderAcessoNegado(); return; }
  const materiais = _getMateriais();
  const main = document.getElementById('mainContent');

  main.innerHTML = `
    <div class="page-header">
      <div class="page-title">
        <h2><i class="fas fa-cube" style="color:var(--orange);margin-right:8px"></i>Cadastro de Materiais</h2>
        <p>${materiais.length} materiais cadastrados</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary btn-sm" onclick="navigate('compras')"><i class="fas fa-arrow-left"></i> Suprimentos</button>
        <button class="btn btn-secondary btn-sm" onclick="exportarMateriais()"><i class="fas fa-file-excel"></i> Exportar</button>
        ${hasPermission('materiais','create') ? `
          <button class="btn btn-secondary btn-sm" onclick="abrirCadastroMassaMateriais()" style="background:rgba(230,126,34,0.15);border-color:var(--orange);color:var(--orange)">
            <i class="fas fa-file-upload"></i> Importar em Massa
          </button>
          <button class="btn btn-primary btn-sm" onclick="openNovoMaterial()"><i class="fas fa-plus"></i> Novo Material</button>
        ` : ''}
      </div>
    </div>

    <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr)">
      <div class="kpi-card kpi-blue"><div class="kpi-icon"><i class="fas fa-cube"></i></div><div class="kpi-value">${materiais.length}</div><div class="kpi-label">Total Cadastrados</div></div>
      <div class="kpi-card kpi-green"><div class="kpi-icon"><i class="fas fa-check-circle"></i></div><div class="kpi-value">${materiais.filter(m=>m.status==='Ativo').length}</div><div class="kpi-label">Em Estoque OK</div></div>
      <div class="kpi-card kpi-yellow"><div class="kpi-icon"><i class="fas fa-exclamation"></i></div><div class="kpi-value">${materiais.filter(m=>m.status==='Alerta').length}</div><div class="kpi-label">Estoque Alerta</div></div>
      <div class="kpi-card kpi-red"><div class="kpi-icon"><i class="fas fa-times-circle"></i></div><div class="kpi-value">${materiais.filter(m=>m.status==='Crítico').length}</div><div class="kpi-label">Estoque Crítico</div></div>
    </div>

    <div class="card">
      <div class="search-bar" style="padding:12px 16px">
        <div class="search-input-wrapper">
          <i class="fas fa-search"></i>
          <input class="search-input" id="searchMat" type="text" placeholder="Buscar material..." oninput="filterMateriais()">
        </div>
        <select class="filter-select" id="filterMatCat" onchange="filterMateriais()">
          <option value="">Todas as Categorias</option>
          <option>Lubrificantes</option><option>Abrasivos</option><option>Rolamentos</option>
          <option>EPI</option><option>Fixação</option><option>Material Elétrico</option><option>Ferramentas</option>
        </select>
        <select class="filter-select" id="filterMatStatus" onchange="filterMateriais()">
          <option value="">Todos os Status</option>
          <option>Ativo</option><option>Alerta</option><option>Crítico</option><option>Inativo</option>
        </select>
      </div>
      <div id="tabelaMateriais">${renderTabelaMateriais(materiais)}</div>
    </div>
  `;
}

function renderTabelaMateriais(lista) {
  if (!lista.length) return `<div class="empty-state" style="padding:40px"><p>Nenhum material encontrado</p></div>`;
  return `
    <div class="table-wrapper">
      <table>
        <thead><tr><th>Código</th><th>Descrição</th><th>Categoria</th><th>Un</th><th>Estoque Atual</th><th>Estoque Min.</th><th>Valor Unit.</th><th>Contrato</th><th>Status</th><th>Ações</th></tr></thead>
        <tbody>
          ${lista.map(m => `
            <tr>
              <td style="color:var(--orange);font-weight:600;font-size:12px">${m.codigo}</td>
              <td style="font-size:13px">${m.descricao}</td>
              <td><span class="badge badge-muted">${m.categoria}</span></td>
              <td style="font-size:12px;text-align:center">${m.unidade}</td>
              <td style="text-align:center;font-weight:700;color:${m.status==='Crítico'?'var(--red-light)':m.status==='Alerta'?'var(--yellow-light)':'var(--green-light)'}">${m.estoque_atual}</td>
              <td style="text-align:center;font-size:12px;color:var(--text-muted)">${m.estoque_min}</td>
              <td style="font-size:12px">${fmt(m.valor_unitario)}</td>
              <td style="font-size:11px;color:var(--text-muted)">${m.contrato || '—'}</td>
              <td>${statusBadge(m.status)}</td>
              <td>
                <div class="actions-cell">
                  ${hasPermission('materiais','edit') ? `<button class="btn btn-info btn-sm btn-icon" onclick="editarMaterial('${m.id}')" title="Editar"><i class="fas fa-edit"></i></button>` : ''}
                  <button class="btn btn-primary btn-sm btn-icon" onclick="gerarRequisicaoDeMaterial('${m.id}')" title="Gerar Requisição"><i class="fas fa-file-alt"></i></button>
                  ${hasPermission('materiais','delete') ? `<button class="btn btn-danger btn-sm btn-icon" onclick="excluirMaterial('${m.id}')" title="Excluir"><i class="fas fa-trash"></i></button>` : ''}
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function filterMateriais() {
  const s = (document.getElementById('searchMat')?.value||'').toLowerCase();
  const cat = document.getElementById('filterMatCat')?.value||'';
  const st = document.getElementById('filterMatStatus')?.value||'';
  const f = _getMateriais().filter(m =>
    (!s || (m.codigo+m.descricao+m.categoria).toLowerCase().includes(s)) &&
    (!cat || m.categoria === cat) && (!st || m.status === st)
  );
  document.getElementById('tabelaMateriais').innerHTML = renderTabelaMateriais(f);
}

function openNovoMaterial() {
  openModalWide('Novo Material', `
    <div class="form-row">
      <div class="form-group"><label>Código *</label><input class="form-control" id="nm_cod" placeholder="Ex: ROL-6208"></div>
      <div class="form-group"><label>Categoria *</label>
        <select class="form-control" id="nm_cat">
          <option>Lubrificantes</option><option>Abrasivos</option><option>Rolamentos</option><option>EPI</option>
          <option>Fixação</option><option>Material Elétrico</option><option>Ferramentas</option><option>Outros</option>
        </select>
      </div>
    </div>
    <div class="form-group"><label>Descrição *</label><input class="form-control" id="nm_desc" placeholder="Descrição completa do material"></div>
    <div class="form-row">
      <div class="form-group"><label>Unidade</label><input class="form-control" id="nm_un" placeholder="Un, Cx, Bld, Par..."></div>
      <div class="form-group"><label>Valor Unitário (R$)</label><input class="form-control" id="nm_val" type="number" min="0" step="0.01"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Estoque Atual</label><input class="form-control" id="nm_est" type="number" min="0" value="0"></div>
      <div class="form-group"><label>Estoque Mínimo</label><input class="form-control" id="nm_min" type="number" min="0" value="0"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Contrato</label>
        <select class="form-control" id="nm_ctr">
          <option value="Geral">Geral</option>
          ${ERP_DATA.contratos.filter(c=>c.status==='Ativo').map(c=>`<option value="${c.id}">${c.id} – ${c.cliente}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label>Observações</label><input class="form-control" id="nm_obs" placeholder="Observações opcionais"></div>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="salvarNovoMaterial()"><i class="fas fa-save"></i> Cadastrar</button>
  `);
}

function salvarNovoMaterial() {
  const cod = document.getElementById('nm_cod').value.trim();
  const desc = document.getElementById('nm_desc').value.trim();
  if (!cod || !desc) { showToast('Preencha código e descrição', 'warning'); return; }
  const est = parseInt(document.getElementById('nm_est').value)||0;
  const min = parseInt(document.getElementById('nm_min').value)||0;
  const novoStatus = est === 0 ? 'Crítico' : est < min ? 'Alerta' : 'Ativo';
  const lista = _getMateriais();
  lista.push({
    id: gerarId('MAT'),
    codigo: cod.toUpperCase(),
    descricao: desc,
    categoria: document.getElementById('nm_cat').value,
    unidade: document.getElementById('nm_un').value.trim() || 'Un',
    valor_unitario: parseFloat(document.getElementById('nm_val').value)||0,
    estoque_atual: est,
    estoque_min: min,
    contrato: document.getElementById('nm_ctr').value,
    status: novoStatus,
    observacoes: document.getElementById('nm_obs').value.trim()
  });
  _saveMateriais(lista);
  closeModal();
  showToast('Material cadastrado com sucesso!', 'success');
  renderMateriais();
}

function editarMaterial(id) {
  const lista = _getMateriais();
  const m = lista.find(x => x.id === id);
  if (!m) return;
  openModalWide(`Editar Material – ${m.codigo}`, `
    <div class="form-row">
      <div class="form-group"><label>Código</label><input class="form-control" id="em_cod" value="${m.codigo}"></div>
      <div class="form-group"><label>Categoria</label>
        <select class="form-control" id="em_cat">
          ${['Lubrificantes','Abrasivos','Rolamentos','EPI','Fixação','Material Elétrico','Ferramentas','Outros'].map(c=>`<option ${m.categoria===c?'selected':''}>${c}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-group"><label>Descrição</label><input class="form-control" id="em_desc" value="${m.descricao}"></div>
    <div class="form-row">
      <div class="form-group"><label>Unidade</label><input class="form-control" id="em_un" value="${m.unidade}"></div>
      <div class="form-group"><label>Valor Unitário (R$)</label><input class="form-control" id="em_val" type="number" value="${m.valor_unitario}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Estoque Atual</label><input class="form-control" id="em_est" type="number" value="${m.estoque_atual}"></div>
      <div class="form-group"><label>Estoque Mínimo</label><input class="form-control" id="em_min" type="number" value="${m.estoque_min}"></div>
    </div>
    <div class="form-group"><label>Observações</label><input class="form-control" id="em_mobs" value="${m.observacoes||''}"></div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-danger" onclick="excluirMaterial('${id}');closeModal()"><i class="fas fa-trash"></i> Excluir</button>
    <button class="btn btn-primary" onclick="salvarEdicaoMaterial('${id}')"><i class="fas fa-save"></i> Salvar</button>
  `);
}

function salvarEdicaoMaterial(id) {
  const lista = _getMateriais();
  const idx = lista.findIndex(x => x.id === id);
  if (idx < 0) return;
  const est = parseInt(document.getElementById('em_est').value)||0;
  const min = parseInt(document.getElementById('em_min').value)||0;
  lista[idx] = { ...lista[idx],
    codigo: document.getElementById('em_cod').value.trim(),
    categoria: document.getElementById('em_cat').value,
    descricao: document.getElementById('em_desc').value.trim(),
    unidade: document.getElementById('em_un').value.trim(),
    valor_unitario: parseFloat(document.getElementById('em_val').value)||0,
    estoque_atual: est, estoque_min: min,
    status: est===0?'Crítico':est<min?'Alerta':'Ativo',
    observacoes: document.getElementById('em_mobs').value.trim()
  };
  _saveMateriais(lista);
  closeModal();
  showToast('Material atualizado!', 'success');
  renderMateriais();
}

function excluirMaterial(id) {
  const lista = _getMateriais().filter(x => x.id !== id);
  _saveMateriais(lista);
  showToast('Material removido.', 'warning');
  renderMateriais();
}

function exportarMateriais() {
  const lista = _getMateriais();
  const csv = [['Código','Descrição','Categoria','Unidade','Estoque Atual','Estoque Min.','Valor Unit.','Contrato','Status'],
    ...lista.map(m => [m.codigo,m.descricao,m.categoria,m.unidade,m.estoque_atual,m.estoque_min,m.valor_unitario,m.contrato,m.status])
  ].map(r=>r.map(c=>`"${c}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\ufeff'+csv], {type:'text/csv;charset=utf-8'}));
  a.download = `Materiais_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  showToast('Materiais exportados!', 'success');
}

// ─── REQUISIÇÕES DE COMPRA ─────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════
// EMISSÃO DE REQUISIÇÕES DE COMPRA – usa sistema fa_rcs (fluxo único)
// ════════════════════════════════════════════════════════════════════

// helpers locais para fa_rcs (compatíveis com fluxo_aprovacao_rc.js)
// Fonte de verdade: API multi-tenant (/api/rc). RCs locais legadas (demo)
// continuam visíveis via merge até a migração completa da emissão.
function _reqGetRCLocais() { try { return JSON.parse(localStorage.getItem('fa_rcs')||'[]'); } catch(e){ return []; } }
function _reqGetRC() {
  const api = (window._reqRCsCache && window._reqRCsCache.dados) || null;
  const locais = _reqGetRCLocais();
  return api ? [...api, ...locais] : locais;
}
// Nunca persistir linhas da API no localStorage (duplicaria no próximo merge).
function _reqSaveRC(d)     { localStorage.setItem('fa_rcs', JSON.stringify((d||[]).filter(r => r.origem !== 'api'))); }
// Adapta a RC do servidor para o formato que a tela sempre usou.
function _reqAdaptarRC(r) {
  return {
    id: r.id, numero: r.numero,
    titulo: r.observacoes || (r.itens && r.itens[0] && r.itens[0].descricao) || r.tipo || 'Requisição',
    contrato: r.wbs || '', os_vinculada: r.os_numero || '',
    solicitante: r.solicitante_nome || '', tipo: r.tipo || 'Material',
    urgencia: r.prioridade || 'Normal', valor_total: r.valor_total || 0,
    status: r.status, data_criacao: String(r.created_at || '').slice(0, 10),
    itens: (r.itens || []).map(i => ({ descricao: i.descricao, qtd: i.quantidade, quantidade: i.quantidade, unidade: i.unidade, valor_unit: i.valor_unitario_estimado, preco_unit: i.valor_unitario_estimado })),
    origem: 'api',
  };
}
// Carrega as RCs do servidor para o cache (silencioso: sem API → modo local).
// Cria a RC no SERVIDOR (fonte de verdade). Retorna a RC criada; null quando
// não há servidor (o chamador cai no fluxo local/demo); { erro:true } quando o
// servidor REJEITOU por validação (não deve salvar local algo inválido).
async function _reqCriarRCViaAPI({ tipo, wbs, observacoes, departamento, prioridade, itens, os_id, os_numero }) {
  if (typeof apiAuth !== 'function') return null;
  try {
    return await apiAuth('/api/rc', { method: 'POST', body: {
      tipo, wbs, observacoes: observacoes || null, departamento: departamento || null,
      prioridade: prioridade || 'Normal', os_id: os_id || null, os_numero: os_numero || null,
      itens: (itens || []).map(i => ({
        descricao: i.descricao,
        quantidade: (i.qtd != null ? i.qtd : i.quantidade) || 1,
        unidade: i.unidade || 'Un',
        valor_unitario_estimado: (i.valor_unit != null ? i.valor_unit : i.valor_unitario_estimado) || 0,
      })),
    } });
  } catch (e) {
    const msg = (e && e.message) || '';
    if (msg && !/fetch|network|load failed/i.test(msg)) {
      if (typeof showToast === 'function') showToast(msg, 'error');
      return { erro: true };
    }
    return null; // sem servidor → modo local
  }
}
window._reqCriarRCViaAPI = _reqCriarRCViaAPI;

async function _reqCarregarRCsAPI() {
  if (typeof apiAuth !== 'function') return false;
  try {
    const dados = (await apiAuth('/api/rc')).map(_reqAdaptarRC);
    window._reqRCsCache = { dados, em: Date.now() };
    return true;
  } catch (e) { window._reqRCsCache = null; return false; }
}
function _reqGetFluxoOS()  { try { return JSON.parse(localStorage.getItem('fa_fluxo_os')||'[]'); } catch(e){ return []; } }

// badge de status da RC
function _reqStatusBadge(s) {
  const m = {
    'Aguardando Aprovação':           { bg:'#f59e0b22', c:'#f59e0b' },
    'Rascunho':                       { bg:'#94a3b822', c:'#64748b' },
    'Pendente':                       { bg:'#f59e0b22', c:'#f59e0b' },
    'Aprovada':                       { bg:'#22c55e22', c:'#22c55e' },
    'Atendida':                       { bg:'#3b82f622', c:'#3b82f6' },
    'Cancelada':                      { bg:'#ef444422', c:'#ef4444' },
    'Aprovada – Aguardando Comprador':{ bg:'#3b82f622', c:'#3b82f6' },
    'RFQ Criado':                     { bg:'#6366f122', c:'#6366f1' },
    'Em Cotação':                     { bg:'#6366f122', c:'#6366f1' },
    'Cotações Recebidas':             { bg:'#8b5cf622', c:'#8b5cf6' },
    'Mapa Criado':                    { bg:'#7c3aed22', c:'#7c3aed' },
    'Mapa Aprovado':                  { bg:'#10b98122', c:'#10b981' },
    'PC Emitido':                     { bg:'#22c55e22', c:'#22c55e' },
    'Rejeitada':                      { bg:'#ef444422', c:'#ef4444' },
    'Rascunho':                       { bg:'#6b728022', c:'#6b7280' },
  };
  const t = m[s]||{ bg:'#8b949e22', c:'#8b949e' };
  return `<span style="background:${t.bg};color:${t.c};border-radius:6px;padding:3px 9px;font-size:10px;font-weight:700;white-space:nowrap">${s||'—'}</span>`;
}

// badge de status por item
function _reqItemBadge(s) {
  const m = { 'Aprovado':'#22c55e','Pendente':'#f59e0b','Em Cotação':'#6366f1','Cotado':'#3b82f6','Pedido Emitido':'#10b981','Rejeitado':'#ef4444' };
  const c = m[s]||'#8b949e';
  return `<span style="background:${c}22;color:${c};border-radius:5px;padding:2px 7px;font-size:10px;font-weight:700">${s||'Pendente'}</span>`;
}

function _reqFmt(v) {
  if (!v && v!==0) return '—';
  return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v);
}

// ─────────────────────────────────────────────────────────────────
// SEED: dados de demonstração realistas para exibição inicial
// ─────────────────────────────────────────────────────────────────
function _reqSeedDemo() {
  const rcs = _reqGetRC();
  if (rcs.some(r => r._demo === true)) return;

  const ano = new Date().getFullYear();
  const anoAnt = ano - 1;

  const demos = [
    {
      id: 'rc_demo_001', numero: `RC-${anoAnt}-0001`,
      titulo: 'Correias e rolamentos — Mina Norte',
      contrato: `CTR-${anoAnt}-001`, solicitante: 'Carlos Técnico', departamento: 'Manutenção',
      data_criacao: new Date(anoAnt, 2, 13).toISOString(),
      prazo: new Date(anoAnt, 2, 27).toISOString().split('T')[0],
      urgencia: 'Alto', tipo: 'Material', status: 'Aprovada – Aguardando Comprador',
      os_vinculada: `OS-${anoAnt}-001`,
      itens: [
        { descricao:'Correia transportadora 40m', qtd:2, unidade:'rolo', valor_unit:3500, total:7000, status_item:'Aprovado' },
        { descricao:'Rolamento SKF 6308', qtd:10, unidade:'Un', valor_unit:350, total:3500, status_item:'Aprovado' },
        { descricao:'Graxa industrial 5kg', qtd:4, unidade:'lata', valor_unit:250, total:1000, status_item:'Aprovado' },
      ],
      valor_total: 12500, observacoes: 'Reposição preventiva – parada programada.', _demo: true,
      historico: [
        { acao:'RC criada a partir da OS', usuario:'Carlos Técnico', data: new Date(anoAnt,2,13).toLocaleString('pt-BR') },
        { acao:'Aprovada pelo supervisor', usuario:'Supervisor Mina', data: new Date(anoAnt,2,15).toLocaleString('pt-BR') },
      ]
    },
    {
      id: 'rc_demo_002', numero: `RC-${anoAnt}-0002`,
      titulo: 'EPIs — Operação Paracatu',
      contrato: `CTR-${anoAnt}-002`, solicitante: 'Ana Técnica', departamento: 'SSMA',
      data_criacao: new Date(anoAnt, 2, 25).toISOString(),
      prazo: new Date(anoAnt, 3, 10).toISOString().split('T')[0],
      urgencia: 'Normal', tipo: 'Material', status: 'PC Emitido',
      os_vinculada: null,
      itens: [
        { descricao:'Capacete Protork ABS', qtd:20, unidade:'Un', valor_unit:45, total:900, status_item:'Pedido Emitido' },
        { descricao:'Óculos de segurança', qtd:30, unidade:'Un', valor_unit:28, total:840, status_item:'Pedido Emitido' },
        { descricao:'Luva nitrílica', qtd:100, unidade:'Par', valor_unit:12, total:1200, status_item:'Pedido Emitido' },
        { descricao:'Botina de segurança CA', qtd:20, unidade:'Par', valor_unit:190, total:3800, status_item:'Pedido Emitido' },
      ],
      valor_total: 8750, observacoes: 'Reposição periódica trimestral.', _demo: true,
      historico: [
        { acao:'RC criada', usuario:'Ana Técnica', data: new Date(anoAnt,2,25).toLocaleString('pt-BR') },
        { acao:'Aprovada – Aguardando Comprador', usuario:'Gestor SSMA', data: new Date(anoAnt,2,27).toLocaleString('pt-BR') },
        { acao:'PC emitido pelo comprador', usuario:'Comprador Fraser', data: new Date(anoAnt,3,5).toLocaleString('pt-BR') },
      ]
    },
    {
      id: 'rc_demo_003', numero: `RC-${anoAnt}-0003`,
      titulo: 'Lubrificantes e Filtros — Manutenção preventiva',
      contrato: `CTR-${ano}-003`, solicitante: 'Roberto Técnico', departamento: 'Manutenção',
      data_criacao: new Date(anoAnt, 2, 23).toISOString(),
      prazo: new Date(anoAnt, 3, 5).toISOString().split('T')[0],
      urgencia: 'Normal', tipo: 'Material', status: 'Em Cotação',
      os_vinculada: `OS-${anoAnt}-003`,
      itens: [
        { descricao:'Óleo Lubrax 15W40 1000L', qtd:1, unidade:'Tambor', valor_unit:5800, total:5800, status_item:'Em Cotação' },
        { descricao:'Filtro de óleo HF6553', qtd:8, unidade:'Un', valor_unit:320, total:2560, status_item:'Em Cotação' },
        { descricao:'Filtro de ar AF25466', qtd:4, unidade:'Un', valor_unit:380, total:1520, status_item:'Em Cotação' },
      ],
      valor_total: 9860, observacoes: 'Parada de manutenção mensal programada.', _demo: true,
      historico: [
        { acao:'RC criada', usuario:'Roberto Técnico', data: new Date(anoAnt,2,23).toLocaleString('pt-BR') },
        { acao:'Aprovada', usuario:'Supervisor', data: new Date(anoAnt,2,25).toLocaleString('pt-BR') },
        { acao:'RFQ criado – cotando com 3 fornecedores', usuario:'Comprador Fraser', data: new Date(anoAnt,2,28).toLocaleString('pt-BR') },
      ]
    },
    {
      id: 'rc_demo_004', numero: `RC-${anoAnt}-0004`,
      titulo: 'Cabos elétricos — Expansão Painel',
      contrato: `CTR-${anoAnt}-001`, solicitante: 'Pedro Elétrica', departamento: 'Elétrica',
      data_criacao: new Date(anoAnt, 2, 8).toISOString(),
      prazo: new Date(anoAnt, 2, 20).toISOString().split('T')[0],
      urgencia: 'Urgente', tipo: 'Material', status: 'Em Cotação',
      os_vinculada: `OS-${anoAnt}-004`,
      itens: [
        { descricao:'Cabo flexível 10mm² 100m', qtd:4, unidade:'Rolo', valor_unit:2800, total:11200, status_item:'Em Cotação' },
        { descricao:'Cabo rígido 6mm² 100m', qtd:3, unidade:'Rolo', valor_unit:1600, total:4800, status_item:'Em Cotação' },
        { descricao:'Disjuntor trifásico 100A', qtd:2, unidade:'Un', valor_unit:3000, total:6000, status_item:'Em Cotação' },
      ],
      valor_total: 22000, observacoes: 'URGENTE – Parada de produção se não atendida até 20/03.', _demo: true,
      historico: [
        { acao:'RC criada – URGENTE', usuario:'Pedro Elétrica', data: new Date(anoAnt,2,8).toLocaleString('pt-BR') },
        { acao:'Aprovação emergencial pelo gestor', usuario:'Gestor Operações', data: new Date(anoAnt,2,9).toLocaleString('pt-BR') },
      ]
    },
    {
      id: 'rc_demo_005', numero: `RC-${ano}-0005`,
      titulo: 'Reagentes para laboratório – Q1',
      contrato: `CTR-${ano}-002`, solicitante: 'Mariana Lab', departamento: 'Laboratório',
      data_criacao: new Date(ano, 0, 15).toISOString(),
      prazo: new Date(ano, 1, 1).toISOString().split('T')[0],
      urgencia: 'Normal', tipo: 'Material', status: 'Aguardando Aprovação',
      os_vinculada: null,
      itens: [
        { descricao:'Ácido nítrico PA 2,5L', qtd:6, unidade:'Un', valor_unit:280, total:1680, status_item:'Pendente' },
        { descricao:'Hidróxido de sódio 1kg', qtd:10, unidade:'Un', valor_unit:45, total:450, status_item:'Pendente' },
      ],
      valor_total: 2130, observacoes: 'Estoque crítico – laboratório parado.', _demo: true,
      historico: [
        { acao:'RC criada – aguardando aprovação supervisor', usuario:'Mariana Lab', data: new Date(ano,0,15).toLocaleString('pt-BR') },
      ]
    },
  ];

  // Garante OS demo no fluxo
  const fluxo = _reqGetFluxoOS();
  demos.filter(d => d.os_vinculada).forEach(d => {
    if (!fluxo.some(f => f.os_id === d.os_vinculada)) {
      fluxo.unshift({
        id: `fluxo_${d.id}`, os_id: d.os_vinculada,
        os_descricao: d.titulo, contrato: d.contrato, status: d.status,
        itens: d.itens.map(it => ({ ...it, status_item: 'Aprovado' })),
        rcs: [{ rc_id: d.id, rc_numero: d.numero, data: new Date().toLocaleString('pt-BR'), criado_por: d.solicitante }],
        _demo: true
      });
    }
  });
  localStorage.setItem('fa_fluxo_os', JSON.stringify(fluxo));

  demos.forEach(d => rcs.unshift(d));
  _reqSaveRC(rcs);
}

// ─────────────────────────────────────────────────────────────────
// RENDER PRINCIPAL  (layout limpo – estilo imagem de referência)
// ─────────────────────────────────────────────────────────────────
async function renderRequisicoes() {
  if (!hasPermission('requisicoes', 'view')) { renderAcessoNegado(); return; }
  // Dados reais do servidor (multi-tenant); sem servidor, cai no modo local.
  const _mainLoading = document.getElementById('mainContent');
  if (_mainLoading && !window._reqRCsCache) _mainLoading.innerHTML = '<p style="padding:40px;color:#64748b"><i class="fas fa-spinner fa-spin"></i> Carregando requisições…</p>';
  await _reqCarregarRCsAPI();

  // _reqSeedDemo(); // DADOS DEMO DESATIVADOS – uso com dados reais

  const rcs        = _reqGetRC();
  const fluxoOS    = _reqGetFluxoOS();
  const main       = document.getElementById('mainContent');
  const podeEmitir = (typeof _podeEmitirRC === 'function') ? _podeEmitirRC() : hasPermission('requisicoes','create');

  // KPIs
  const kpiTotal    = rcs.length;
  const kpiAguard   = rcs.filter(r => ['Aguardando Aprovação','Rascunho','Pendente'].includes(r.status)).length;
  const kpiAprov    = rcs.filter(r => ['Aprovada – Aguardando Comprador','RFQ Criado','Em Cotação','Cotações Recebidas','Mapa Criado','Mapa Aprovado','PC Emitido','Aprovada','Atendida'].includes(r.status)).length;
  const kpiValTotal = rcs.reduce((s, r) => s + (r.valor_total || 0), 0);
  const aguardMinhas = rcs.filter(r => ['Aguardando Aprovação','Rascunho','Pendente'].includes(r.status));

  main.innerHTML = `
  <div style="padding:24px 28px;max-width:1400px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">

    <!-- ══ ALERTAS RFQ OCIOSAS ════════════════════════════════════════ -->
    <div id="sup_alertas_rfq"></div>

    <!-- ══ HEADER ══════════════════════════════════════════════════ -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:22px;gap:12px;flex-wrap:wrap;">
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="width:40px;height:40px;border-radius:10px;background:#f97316;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <i class="fas fa-file-alt" style="color:#fff;font-size:17px;"></i>
        </div>
        <div>
          <h1 style="font-size:19px;font-weight:700;color:#0f172a;margin:0;line-height:1.2;">Requisições de Compra</h1>
          <p style="margin:2px 0 0;font-size:12px;color:#64748b;">${kpiTotal} RC(s) registrada(s)</p>
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
        <button id="reqBtnExportar" onclick="_reqExportarRC()"
          title="Gera um arquivo .xlsx com os registros filtrados (planilha Processos)"
          style="padding:8px 16px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;color:#475569;font-size:13px;font-weight:500;cursor:pointer;display:flex;align-items:center;gap:6px;transition:border-color .15s;"
          onmouseover="this.style.borderColor='#cbd5e1'" onmouseout="this.style.borderColor='#e2e8f0'">
          <i class="fas fa-file-excel" style="font-size:12px;color:#16a34a;"></i> Exportar para Excel
        </button>
        ${podeEmitir ? `
        <button onclick="reqEmitirRCAvulsa()"
          style="padding:8px 20px;border:none;border-radius:8px;background:#2563eb;color:#fff;font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:7px;box-shadow:0 1px 4px rgba(37,99,235,.3);transition:background .15s;"
          onmouseover="this.style.background='#1d4ed8'" onmouseout="this.style.background='#2563eb'">
          <i class="fas fa-plus" style="font-size:11px;"></i> + Novo RC
        </button>
        <button onclick="typeof supAbrirCompraEmergencia==='function'&&supAbrirCompraEmergencia()"
          style="padding:8px 16px;border:none;border-radius:8px;background:#dc2626;color:#fff;font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:7px;box-shadow:0 1px 4px rgba(220,38,38,.3);transition:background .15s;"
          onmouseover="this.style.background='#b91c1c'" onmouseout="this.style.background='#dc2626'"
          title="Compra emergencial — requer justificativa e aprovação de Diretor">
          <i class="fas fa-bolt" style="font-size:11px;"></i> Emergência
        </button>` : ''}
      </div>
    </div>

    <!-- ══ KPI CARDS ═══════════════════════════════════════════════ -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:18px;">
      ${_reqKpiCard('Total RCs',            kpiTotal,             '#f97316', 'file-alt')}
      ${_reqKpiCard('Aguardando Aprovação', kpiAguard,            '#f59e0b', 'clock')}
      ${_reqKpiCard('Aprovadas',            kpiAprov,             '#22c55e', 'check-circle')}
      ${_reqKpiCard('Valor Total',          _reqFmtK(kpiValTotal),'#3b82f6', 'dollar-sign')}
    </div>

    <!-- ══ BANNER DE ALERTA ════════════════════════════════════════ -->
    ${aguardMinhas.length > 0 ? `
    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:12px 18px;margin-bottom:18px;display:flex;align-items:center;gap:12px;">
      <i class="fas fa-bell" style="color:#f59e0b;font-size:15px;flex-shrink:0;"></i>
      <span style="font-size:13px;color:#92400e;">
        Você tem <strong>${aguardMinhas.length} RC(s)</strong> aguardando aprovação.
      </span>
      <button onclick="_reqFiltrarStatus('aguard_aprv')"
        style="margin-left:auto;padding:5px 16px;border:none;border-radius:7px;background:#f59e0b;color:#fff;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;">
        <i class="fas fa-eye" style="margin-right:5px;font-size:11px;"></i>Ver Aprovações
      </button>
    </div>` : ''}

    <!-- ══ OS COM ITENS APROVADOS – PENDENTES DE RC ══════════════════════════ -->
    ${(() => {
      // Busca OS no fluxo com itens aprovados (prontos para RC)
      let osAprovadas = [];
      let osAguardando = [];
      try {
        const fluxo = JSON.parse(localStorage.getItem('fa_fluxo_os') || '[]');
        // OS com itens aprovados ainda sem RC
        osAprovadas = fluxo.filter(f =>
          (f.itens||[]).some(it => it.status_item === 'Aprovado')
        );
        // OS ainda aguardando aprovação (informativo)
        osAguardando = fluxo.filter(f =>
          f.status === 'Aguardando Aprovação' && (f.itens||[]).length > 0
        ).slice(0, 3);
      } catch(e) {}

      // Fallback: se não tem nada no fluxo, mostra OS da lista com precisa_compra
      if (!osAprovadas.length && !osAguardando.length) {
        try {
          const osList = JSON.parse(localStorage.getItem('fa_ordens_servico') || '[]');
          const osRaw = osList.filter(o =>
            o.precisa_compra && (o.itens_compra || []).length > 0
          ).slice(0, 5);
          if (!osRaw.length) return '';
          return `
          <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:14px;margin-bottom:18px;overflow:hidden;">
            <div style="padding:12px 18px;border-bottom:1px solid #fed7aa;background:linear-gradient(90deg,#fff7ed,#fff);">
              <div style="font-size:13px;font-weight:700;color:#9a3412;">OS com Necessidade de Compra (sem fluxo)</div>
              <div style="font-size:11px;color:#c2410c;margin-top:3px">${osRaw.length} OS(s) com itens de compra</div>
            </div>
            <div style="padding:10px 14px;">
              ${osRaw.map(os => `
              <div style="padding:10px 12px;margin-bottom:6px;background:#fff;border:1px solid #fed7aa;border-left:3px solid #f97316;border-radius:10px;">
                <div style="font-size:12px;font-weight:700;color:#9a3412">${os.id}</div>
                <div style="font-size:12px;color:#374151">${(os.descricao||'').substring(0,80)}</div>
                <div style="font-size:11px;color:#6b7280;margin-top:2px">${(os.itens_compra||[]).length} item(ns) · ${os.contrato||''} · Status: ${os.status}</div>
              </div>`).join('')}
            </div>
          </div>`;
        } catch(e) { return ''; }
      }

      if (!osAprovadas.length && !osAguardando.length) return '';

      // ── Monta painel expandido de OS com agrupamento de RCs ──────────────────
      function _reqOsStatusBadge(status) {
        const m = {
          'Aprovada – Aguardando Comprador': { bg:'#22c55e', label:'Aprovada' },
          'Aguardando Aprovação': { bg:'#f59e0b', label:'Aguard. Aprovação' },
          'RC Emitida': { bg:'#3b82f6', label:'RC Emitida' },
          'PC Emitido': { bg:'#10b981', label:'PC Emitido' },
          'Rejeitada': { bg:'#ef4444', label:'Rejeitada' },
        };
        const c = m[status] || { bg:'#64748b', label: status||'—' };
        return `<span style="background:${c.bg}22;color:${c.bg};border-radius:5px;padding:2px 8px;font-size:10px;font-weight:700">${c.label}</span>`;
      }
      function _reqRcStatusBadge(status) {
        const m = {
          'Aprovada – Aguardando Comprador': { bg:'#3b82f6', label:'Aguard. Comprador' },
          'Em Cotação': { bg:'#6366f1', label:'Em Cotação' },
          'RFQ Criado': { bg:'#0ea5e9', label:'RFQ Criado' },
          'Cotações Recebidas': { bg:'#8b5cf6', label:'Cotações Recebidas' },
          'Mapa Criado': { bg:'#7c3aed', label:'Mapa Criado' },
          'Mapa Aprovado': { bg:'#059669', label:'Mapa Aprovado' },
          'PC Emitido': { bg:'#22c55e', label:'PC Emitido' },
          'Rejeitada': { bg:'#ef4444', label:'Rejeitada' },
          'Aguardando Aprovação': { bg:'#f59e0b', label:'Aguard. Aprovação' },
          'Rascunho': { bg:'#8b949e', label:'Rascunho' },
        };
        const c = m[status] || { bg:'#64748b', label: status||'—' };
        return `<span style="background:${c.bg}22;color:${c.bg};border-radius:5px;padding:2px 7px;font-size:10px;font-weight:700">${c.label}</span>`;
      }

      return `
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;margin-bottom:18px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.05);">
      <!-- Header do painel -->
      <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 20px;border-bottom:1px solid #f1f5f9;background:linear-gradient(90deg,#fff7ed,#fff);flex-wrap:wrap;gap:10px;">
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#fb923c,#f97316);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            <i class="fas fa-clipboard-check" style="color:#fff;font-size:15px;"></i>
          </div>
          <div>
            <div style="font-size:14px;font-weight:700;color:#9a3412;">OS Aprovadas – Aguardando Emissão de RC</div>
            <div style="font-size:11px;color:#c2410c;margin-top:1px;">
              ${osAprovadas.length} OS com itens prontos para requisição
              ${osAguardando.length > 0 ? ` · <span style="color:#d97706">${osAguardando.length} ainda em aprovação</span>` : ''}
            </div>
          </div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <div style="position:relative;">
            <i class="fas fa-search" style="position:absolute;left:8px;top:50%;transform:translateY(-50%);color:#94a3b8;font-size:11px;pointer-events:none;"></i>
            <input id="reqOsSearch" placeholder="Filtrar OS..." oninput="_reqFiltrarOsPanel()"
              style="padding:6px 10px 6px 26px;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;color:#374151;outline:none;width:150px;">
          </div>
          <button onclick="navigate('fluxo_aprovacao_rc')"
            style="padding:7px 14px;border:none;border-radius:8px;background:#f97316;color:#fff;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;display:flex;align-items:center;gap:6px">
            <i class="fas fa-stream" style="font-size:10px"></i>Ver Fluxo Completo
          </button>
        </div>
      </div>

      <!-- Legenda de informação -->
      <div style="padding:8px 20px;background:#fffbeb;border-bottom:1px solid #fde68a;font-size:11px;color:#92400e;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <i class="fas fa-info-circle" style="color:#d97706;"></i>
        <span><strong>Serviços</strong> e <strong>Materiais</strong> devem estar em RCs <strong>separadas</strong>.</span>
        <span>·</span>
        <span>Verifique disponibilidade em <strong>estoque</strong> antes de emitir RC de materiais.</span>
        <span>·</span>
        <span>Uma OS pode gerar <strong>múltiplas RCs</strong>.</span>
      </div>

      <!-- Lista de OS -->
      <div id="reqOsPanelList" style="padding:14px 16px;">
        ${osAprovadas.map(f => {
          const itensAprov     = (f.itens||[]).filter(it => it.status_item === 'Aprovado');
          const itensRC        = (f.itens||[]).filter(it => it.status_item === 'RC Criada');
          const itensMat       = itensAprov.filter(it => !['servico','serviço externo','serviço'].includes((it.tipo||it.tipo_item||'').toLowerCase()));
          const itensServ      = itensAprov.filter(it => ['servico','serviço externo','serviço'].includes((it.tipo||it.tipo_item||'').toLowerCase()));
          const rcsVinc        = rcs.filter(r => r.os_vinculada === f.os_id);
          const temItensDisp   = itensAprov.length > 0;
          const borderColor    = temItensDisp ? '#22c55e' : '#e5e7eb';
          const bgColor        = temItensDisp ? '#f0fdf4' : '#fff';

          // Mini pipeline de status das RCs vinculadas
          const pipelineRCs = rcsVinc.length > 0 ? rcsVinc.map(r => `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 10px;background:#fff;border:1px solid #e5e7eb;border-radius:7px;margin-top:5px;gap:8px;flex-wrap:wrap">
              <div style="display:flex;align-items:center;gap:6px">
                <i class="fas fa-file-alt" style="color:#3b82f6;font-size:12px;flex-shrink:0"></i>
                <span style="font-size:12px;font-weight:700;color:#1e40af">${r.numero}</span>
                ${r.tipo_rc_label ? `<span style="font-size:10px;background:${r.tipo_rc==='servico'?'#6366f122':'#0ea5e922'};color:${r.tipo_rc==='servico'?'#6366f1':'#0ea5e9'};border-radius:5px;padding:1px 6px;font-weight:700">${r.tipo_rc_label}</span>` : ''}
              </div>
              <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                <span style="font-size:11px;color:#64748b">${r.itens?.length||0} itens</span>
                ${_reqRcStatusBadge(r.status)}
                <button onclick="reqVerDetalheRC('${r.id}')" style="padding:3px 8px;border:1px solid #e2e8f0;border-radius:6px;background:#fff;color:#475569;font-size:11px;cursor:pointer;display:flex;align-items:center;gap:4px">
                  <i class="fas fa-eye" style="font-size:10px"></i> Ver
                </button>
                ${['Aprovada – Aguardando Comprador','RFQ Criado'].includes(r.status) ? `
                <button onclick="navigate('rfq')" style="padding:3px 8px;border:none;border-radius:6px;background:#6366f122;color:#6366f1;font-size:11px;font-weight:600;cursor:pointer;">
                  <i class="fas fa-paper-plane" style="font-size:10px;margin-right:3px"></i>Cotações
                </button>` : ''}
              </div>
            </div>`).join('') : '';

          return `
          <div class="req-os-row" data-os="${(f.os_id||f.id||'').toLowerCase()}"
            style="background:${bgColor};border:1px solid ${borderColor};border-left:4px solid ${temItensDisp?'#22c55e':'#e5e7eb'};border-radius:10px;margin-bottom:10px;overflow:hidden;">
            <!-- Cabeçalho da OS -->
            <div style="display:flex;align-items:flex-start;justify-content:space-between;padding:12px 14px;gap:10px;flex-wrap:wrap">
              <div style="flex:1;min-width:200px">
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px">
                  <span style="font-size:13px;font-weight:700;color:#1e293b">${f.os_id||f.id}</span>
                  ${_reqOsStatusBadge(f.status)}
                  ${f.contrato ? `<span style="font-size:10px;color:#64748b;background:#f1f5f9;border-radius:4px;padding:1px 6px">${f.contrato}</span>` : ''}
                </div>
                <div style="font-size:12px;color:#475569;margin-bottom:6px">${(f.os_descricao||'').substring(0,80)}</div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;font-size:11px">
                  ${temItensDisp ? `<span style="color:#22c55e;font-weight:600"><i class="fas fa-check-circle" style="margin-right:3px"></i>${itensAprov.length} item(ns) aguardando RC</span>` : ''}
                  ${itensMat.length > 0 ? `<span style="color:#0ea5e9"><i class="fas fa-box" style="margin-right:3px"></i>${itensMat.length} Material(is)</span>` : ''}
                  ${itensServ.length > 0 ? `<span style="color:#6366f1"><i class="fas fa-tools" style="margin-right:3px"></i>${itensServ.length} Serviço(s)</span>` : ''}
                  ${itensRC.length > 0 ? `<span style="color:#64748b"><i class="fas fa-lock" style="margin-right:3px"></i>${itensRC.length} já em RC</span>` : ''}
                  ${rcsVinc.length > 0 ? `<span style="color:#3b82f6;font-weight:600"><i class="fas fa-file-alt" style="margin-right:3px"></i>${rcsVinc.length} RC(s) emitida(s)</span>` : ''}
                </div>
              </div>
              <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end;flex-shrink:0">
                ${podeEmitir && temItensDisp ? `
                <button onclick="reqAbrirNovaRCdeOS('${f.id}')"
                  style="padding:8px 16px;border:none;border-radius:8px;background:#22c55e;color:#fff;font-size:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:5px;white-space:nowrap"
                  onmouseover="this.style.background='#16a34a'" onmouseout="this.style.background='#22c55e'">
                  <i class="fas fa-plus" style="font-size:11px"></i> Nova RC
                </button>` : (!podeEmitir ? `
                <span style="font-size:11px;color:#94a3b8;background:#f8fafc;border:1px solid #e2e8f0;border-radius:7px;padding:6px 12px">
                  <i class="fas fa-lock" style="margin-right:4px"></i>Sem permissão para emitir RC
                </span>` : `
                <span style="font-size:11px;color:#64748b;background:#f1f5f9;border-radius:7px;padding:6px 12px">Todos itens já em RC</span>`)}
                ${rcsVinc.length > 0 ? `
                <button onclick="_reqToggleRCsOS('${f.os_id||f.id}')" id="btn_rcs_${f.os_id||f.id}"
                  style="padding:5px 12px;border:1px solid #e2e8f0;border-radius:7px;background:#fff;color:#475569;font-size:11px;cursor:pointer;display:flex;align-items:center;gap:4px;white-space:nowrap">
                  <i class="fas fa-chevron-down" style="font-size:10px"></i> ${rcsVinc.length} RC(s) vinculada(s)
                </button>` : ''}
              </div>
            </div>

            <!-- Mini itens disponíveis -->
            ${temItensDisp ? `
            <div style="padding:0 14px 10px;border-top:1px solid #f1f5f9">
              <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;margin:8px 0 5px">Itens aguardando RC:</div>
              <div style="display:flex;flex-wrap:wrap;gap:5px">
                ${itensAprov.slice(0,6).map(it => {
                  const tipoIt = (it.tipo||it.tipo_item||'').toLowerCase();
                  const isServ = ['servico','serviço externo','serviço'].includes(tipoIt);
                  const cor = isServ ? '#6366f1' : '#0ea5e9';
                  return `<span style="background:${cor}11;border:1px solid ${cor}33;border-radius:6px;padding:3px 9px;font-size:11px;color:${cor}">
                    <i class="fas ${isServ?'fa-tools':'fa-box'}" style="margin-right:4px;font-size:10px"></i>${it.descricao?.substring(0,35)||''}
                    <span style="color:#94a3b8;font-size:10px;margin-left:3px">${it.qtd||1} ${it.unidade||'Un'}</span>
                  </span>`;
                }).join('')}
                ${itensAprov.length > 6 ? `<span style="font-size:11px;color:#94a3b8;padding:3px 8px">+${itensAprov.length-6} mais...</span>` : ''}
              </div>
            </div>` : ''}

            <!-- RCs vinculadas (expansível) -->
            ${rcsVinc.length > 0 ? `
            <div id="rcs_os_${f.os_id||f.id}" style="display:none;padding:0 14px 12px;border-top:1px solid #e2e8f0">
              <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;margin:8px 0 5px">
                <i class="fas fa-file-alt" style="margin-right:5px;color:#3b82f6"></i>Requisições Emitidas para esta OS:
              </div>
              ${pipelineRCs}
            </div>` : ''}
          </div>`;
        }).join('')}

        ${osAguardando.length > 0 ? `
        <div style="padding:10px 14px;background:#fffbeb;border:1px dashed #fde68a;border-radius:10px;margin-top:4px;font-size:11px;color:#92400e;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <i class="fas fa-hourglass-half" style="color:#d97706;flex-shrink:0"></i>
          <strong>${osAguardando.length} OS</strong> ainda aguardando aprovação:
          <span>${osAguardando.map(f => `<code style="background:#fef3c7;padding:1px 5px;border-radius:3px">${f.os_id||f.id}</code>`).join(' ')}</span>
          <button onclick="navigate('fluxo_aprovacao_rc')" style="margin-left:auto;padding:4px 12px;border:none;border-radius:6px;background:#d97706;color:#fff;font-size:11px;font-weight:600;cursor:pointer">
            <i class="fas fa-clipboard-check" style="margin-right:4px"></i>Ir para Aprovação de OS
          </button>
        </div>` : ''}
      </div>
    </div>`;
    })()}

    <!-- ══ CARD COM FILTROS + TABELA ══════════════════════════════ -->
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06);">

      <!-- Barra de filtros -->
      <div style="display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid #f1f5f9;flex-wrap:wrap;">
        <div style="position:relative;flex:1;min-width:180px;max-width:300px;">
          <i class="fas fa-search" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:#94a3b8;font-size:12px;pointer-events:none;"></i>
          <input id="reqSearch" placeholder="Buscar RC..." oninput="_reqFiltrarTexto()"
            style="width:100%;padding:8px 10px 8px 32px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;color:#0f172a;outline:none;box-sizing:border-box;transition:border-color .15s;"
            onfocus="this.style.borderColor='#2563eb'" onblur="this.style.borderColor='#e2e8f0'">
        </div>
        <select id="reqStatusSel" onchange="_reqFiltrarStatus(this.value)"
          style="padding:8px 14px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;color:#475569;cursor:pointer;background:#fff;outline:none;appearance:auto;">
          <option value="todas">Todos Status</option>
          <option value="aguard_aprv">Aguardando Aprovação</option>
          <option value="aprovada">Aprovada / Em Andamento</option>
          <option value="em_cotacao">Em Cotação / RFQ</option>
          <option value="concluida">Concluída (PC Emitido)</option>
          <option value="rejeitada">Rejeitada</option>
        </select>
        <button onclick="_reqLimparFiltros()" title="Limpar filtros"
          style="padding:8px 11px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;color:#94a3b8;cursor:pointer;font-size:13px;transition:all .15s;"
          onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='#fff'">
          <i class="fas fa-times"></i>
        </button>
        <span style="margin-left:auto;font-size:12px;color:#94a3b8;" id="reqContador">${rcs.length} resultado(s)</span>
      </div>

      <!-- Tabela -->
      <div id="reqTabelaRC">
        ${_reqTabelaRC(rcs, podeEmitir)}
      </div>
    </div>

  </div>`;
  // Injetar alertas de RFQ ociosas
  if (typeof supRenderAlertasRFQ === 'function') supRenderAlertasRFQ();
}

// ─── KPI CARD – cores sólidas conforme design de referência ──────────────────
function _reqKpiCard(label, value, color, icon) {
  // Cada card tem fundo colorido sólido no ícone, fundo branco no texto
  const iconBg = {
    '#f97316': 'linear-gradient(135deg,#fb923c,#f97316)',
    '#f59e0b': 'linear-gradient(135deg,#fbbf24,#f59e0b)',
    '#22c55e': 'linear-gradient(135deg,#4ade80,#22c55e)',
    '#3b82f6': 'linear-gradient(135deg,#60a5fa,#3b82f6)',
  }[color] || `linear-gradient(135deg,${color},${color})`;
  return `
  <div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:18px 20px;display:flex;align-items:center;gap:14px;box-shadow:0 1px 3px rgba(0,0,0,.05);">
    <div style="width:48px;height:48px;border-radius:12px;background:${iconBg};display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 2px 8px ${color}55;">
      <i class="fas fa-${icon}" style="color:#fff;font-size:18px;"></i>
    </div>
    <div>
      <div style="font-size:24px;font-weight:800;color:#0f172a;line-height:1;letter-spacing:-.5px;">${value}</div>
      <div style="font-size:11.5px;color:#64748b;margin-top:4px;font-weight:500;">${label}</div>
    </div>
  </div>`;
}

function _reqFmtK(v) {
  if (!v) return 'R$ 0';
  if (v >= 1000000) return 'R$ ' + (v/1000000).toFixed(1) + 'M';
  if (v >= 1000)    return 'R$ ' + Math.round(v/1000) + 'k';
  return 'R$ ' + v;
}

// ─── TABELA DE RCs (design fiel à imagem de referência) ─────────────────────
function _reqTabelaRC(lista, podeEditar) {
  // Atualizar contador visível
  const contador = document.getElementById('reqContador');
  if (contador) contador.textContent = lista.length + ' resultado(s)';

  if (!lista.length) return `
    <div style="text-align:center;padding:60px 24px;color:#94a3b8;">
      <div style="width:64px;height:64px;border-radius:50%;background:#f8fafc;display:flex;align-items:center;justify-content:center;margin:0 auto 14px;">
        <i class="fas fa-inbox" style="font-size:28px;color:#cbd5e1;"></i>
      </div>
      <div style="font-size:14px;font-weight:600;color:#475569;margin-bottom:6px;">Nenhuma RC encontrada</div>
      <div style="font-size:12px;color:#94a3b8;">Crie uma Nova RC ou ajuste os filtros aplicados.</div>
    </div>`;

  const statusEditaveis = ['Rascunho','Aguardando Aprovação','Aprovada – Aguardando Comprador'];

  // helpers de badge de urgência
  function _urgBadge(urg) {
    const map = {
      'Urgente':  { bg:'#fef2f2', c:'#dc2626', dot:'#ef4444' },
      'Crítico':  { bg:'#fdf4ff', c:'#7c3aed', dot:'#a855f7' },
      'Alto':     { bg:'#fff7ed', c:'#c2410c', dot:'#f97316' },
      'Normal':   { bg:'#f8fafc', c:'#64748b', dot:'#94a3b8' },
      'Baixo':    { bg:'#f0fdf4', c:'#15803d', dot:'#22c55e' },
    };
    const s = map[urg] || map['Normal'];
    return `<span style="display:inline-flex;align-items:center;gap:4px;background:${s.bg};color:${s.c};border-radius:20px;padding:3px 10px;font-size:11px;font-weight:600;white-space:nowrap;">
      <span style="width:6px;height:6px;border-radius:50%;background:${s.dot};flex-shrink:0;"></span>${urg}
    </span>`;
  }

  // helper de badge de tipo
  function _tipoBadge(tipo) {
    const map = {
      'Material': { bg:'#eff6ff', c:'#2563eb' },
      'Serviço':  { bg:'#f5f3ff', c:'#7c3aed' },
      'Misto':    { bg:'#fdf4ff', c:'#a21caf' },
    };
    const s = map[tipo] || { bg:'#f8fafc', c:'#475569' };
    return `<span style="background:${s.bg};color:${s.c};border-radius:6px;padding:3px 9px;font-size:11px;font-weight:600;">${tipo}</span>`;
  }

  return `
  <div style="overflow-x:auto;">
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead>
        <tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0;">
          ${['NÚMERO','TÍTULO','CONTRATO','SOLICITANTE','TIPO','URGÊNCIA','VALOR','STATUS','DATA','AÇÕES']
            .map(c=>`<th style="padding:11px 14px;text-align:left;font-size:10.5px;font-weight:700;color:#64748b;letter-spacing:.06em;white-space:nowrap;user-select:none;">${c}</th>`)
            .join('')}
        </tr>
      </thead>
      <tbody>
        ${lista.map(r => {
          const pEdit  = podeEditar && statusEditaveis.includes(r.status);
          const urg    = r.urgencia || 'Normal';
          const tipo   = r.tipo || 'Material';
          const dataFmt = r.data_criacao
            ? new Date(r.data_criacao).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'})
            : r.data_abertura || '—';
          const hasRFQ = ['Aprovada – Aguardando Comprador','RFQ Criado','Em Cotação'].includes(r.status);
          // badge de vincuado a RFQ/PC
          const hasPCBadge = ['Mapa Aprovado','PC Emitido'].includes(r.status);
          return `
          <tr style="border-bottom:1px solid #f1f5f9;transition:background .1s;"
            onmouseover="this.style.background='#fafbff'" onmouseout="this.style.background='transparent'">
            <td style="padding:12px 14px;">
              <span style="font-weight:700;color:#f97316;font-family:'Courier New',monospace;font-size:12px;">${r.numero||'—'}</span>
              ${hasPCBadge ? `<span style="display:block;margin-top:3px;font-size:10px;background:#dcfce7;color:#15803d;border-radius:4px;padding:1px 6px;width:fit-content;font-weight:600;">PC</span>` : ''}
            </td>
            <td style="padding:12px 14px;max-width:240px;">
              <span style="display:block;color:#0f172a;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${(r.titulo||'').replace(/"/g,'&quot;')}">${r.titulo||'—'}</span>
              ${r.os_vinculada ? `
                <button onclick="_reqVerDetalheOSRapida('${r.os_vinculada}')" title="Ver detalhes da OS"
                  style="display:inline-flex;align-items:center;gap:4px;margin-top:3px;padding:2px 8px;background:#f0fdfa;border:1px solid #99f6e4;border-radius:6px;cursor:pointer;font-size:10px;font-weight:600;color:#0d9488;transition:all .12s;"
                  onmouseover="this.style.background='#ccfbf1';this.style.borderColor='#5eead4'" onmouseout="this.style.background='#f0fdfa';this.style.borderColor='#99f6e4'">
                  <i class="fas fa-file-medical-alt" style="font-size:8px;"></i>
                  ${r.os_vinculada}
                  <i class="fas fa-eye" style="font-size:8px;opacity:.7;"></i>
                </button>` : ''}
            </td>
            <td style="padding:12px 14px;color:#64748b;font-size:12px;white-space:nowrap;">${r.contrato||'—'}</td>
            <td style="padding:12px 14px;">
              <span style="display:flex;align-items:center;gap:6px;font-size:12px;color:#475569;">
                <span style="width:26px;height:26px;border-radius:50%;background:#e0e7ff;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:10px;font-weight:700;color:#4338ca;">
                  ${(r.solicitante||'?').charAt(0).toUpperCase()}
                </span>
                ${r.solicitante||'—'}
              </span>
            </td>
            <td style="padding:12px 14px;">${_tipoBadge(tipo)}</td>
            <td style="padding:12px 14px;">${_urgBadge(urg)}</td>
            <td style="padding:12px 14px;font-weight:700;color:#0f172a;white-space:nowrap;">${_reqFmt(r.valor_total)}</td>
            <td style="padding:12px 14px;">${_reqStatusBadge(r.status)}</td>
            <td style="padding:12px 14px;color:#94a3b8;font-size:12px;white-space:nowrap;">${dataFmt}</td>
            <td style="padding:12px 14px;">
              <div style="display:flex;gap:5px;align-items:center;flex-wrap:nowrap;">
                <button onclick="reqVerDetalheRC('${r.id}')" title="Ver detalhes"
                  style="width:30px;height:30px;border:1px solid #e2e8f0;border-radius:7px;background:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .12s;"
                  onmouseover="this.style.borderColor='#93c5fd';this.style.background='#eff6ff'" onmouseout="this.style.borderColor='#e2e8f0';this.style.background='#fff'">
                  <i class="fas fa-eye" style="font-size:11px;color:#64748b;"></i>
                </button>
                ${hasRFQ ? `
                <button onclick="navigate('rfq')" title="Ir para RFQ/Cotação"
                  style="padding:5px 11px;border:none;border-radius:7px;background:#2563eb;color:#fff;cursor:pointer;font-size:11px;font-weight:600;white-space:nowrap;display:flex;align-items:center;gap:4px;transition:background .12s;"
                  onmouseover="this.style.background='#1d4ed8'" onmouseout="this.style.background='#2563eb'">
                  RFQ <i class="fas fa-arrow-right" style="font-size:9px;"></i>
                </button>` : ''}
                ${pEdit ? `
                <button onclick="reqEditarRC('${r.id}')" title="Editar RC"
                  style="width:30px;height:30px;border:1px solid #e2e8f0;border-radius:7px;background:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .12s;"
                  onmouseover="this.style.borderColor='#fcd34d';this.style.background='#fffbeb'" onmouseout="this.style.borderColor='#e2e8f0';this.style.background='#fff'">
                  <i class="fas fa-pen" style="font-size:10px;color:#f59e0b;"></i>
                </button>` : ''}
                ${['Aguardando Aprovação','Rascunho','Pendente'].includes(r.status) && podeEditar ? `
                <button onclick="reqAprovarRC && reqAprovarRC('${r.id}')" title="Aprovar RC"
                  style="width:30px;height:30px;border:1px solid #bbf7d0;border-radius:7px;background:#f0fdf4;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .12s;"
                  onmouseover="this.style.background='#dcfce7'" onmouseout="this.style.background='#f0fdf4'">
                  <i class="fas fa-check" style="font-size:10px;color:#16a34a;"></i>
                </button>` : ''}
              </div>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>`;
}

// ─── FILTROS ─────────────────────────────────────────────────────────────────
function _reqAplicarFiltros() {
  const s   = (document.getElementById('reqSearch')?.value || '').toLowerCase().trim();
  const sel = document.getElementById('reqStatusSel')?.value || 'todas';
  const rcs = _reqGetRC();
  const podeEditar = (typeof _podeEmitirRC === 'function') ? _podeEmitirRC() : hasPermission('requisicoes','create');
  let f = rcs;
  switch(sel) {
    case 'aguard_aprv': f = rcs.filter(r => ['Aguardando Aprovação','Rascunho','Pendente'].includes(r.status)); break;
    case 'aprovada':    f = rcs.filter(r => ['Aprovada – Aguardando Comprador','RFQ Criado','Em Cotação','Cotações Recebidas','Mapa Criado','Mapa Aprovado','Aprovada'].includes(r.status)); break;
    case 'em_cotacao':  f = rcs.filter(r => ['RFQ Criado','Em Cotação','Cotações Recebidas'].includes(r.status)); break;
    case 'concluida':   f = rcs.filter(r => ['PC Emitido','Atendida'].includes(r.status)); break;
    case 'rejeitada':   f = rcs.filter(r => r.status === 'Rejeitada'); break;
  }
  if (s) f = f.filter(r =>
    (r.numero||'').toLowerCase().includes(s) ||
    (r.titulo||'').toLowerCase().includes(s) ||
    (r.solicitante||'').toLowerCase().includes(s) ||
    (r.contrato||'').toLowerCase().includes(s) ||
    (r.os_vinculada||'').toLowerCase().includes(s)
  );
  const el = document.getElementById('reqTabelaRC');
  if (el) el.innerHTML = _reqTabelaRC(f, podeEditar);
}

function _reqFiltrarStatus(statusKey) {
  const sel = document.getElementById('reqStatusSel');
  if (sel) sel.value = statusKey;
  _reqAplicarFiltros();
}

function _reqFiltrarTexto() {
  _reqAplicarFiltros();
}

function _reqLimparFiltros() {
  const inp = document.getElementById('reqSearch');
  const sel = document.getElementById('reqStatusSel');
  if (inp) inp.value = '';
  if (sel) sel.value = 'todas';
  _reqAplicarFiltros();
}

// ─── PAINEL OS: filtra por texto ─────────────────────────────────────────────
function _reqFiltrarOsPanel() {
  const s = (document.getElementById('reqOsSearch')?.value||'').toLowerCase().trim();
  const rows = document.querySelectorAll('.req-os-row');
  rows.forEach(row => {
    const osId = row.dataset.os || '';
    row.style.display = (!s || osId.includes(s)) ? '' : 'none';
  });
}

// ─── PAINEL OS: toggle das RCs vinculadas ────────────────────────────────────
function _reqToggleRCsOS(osId) {
  const panel = document.getElementById(`rcs_os_${osId}`);
  const btn   = document.getElementById(`btn_rcs_${osId}`);
  if (!panel) return;
  const isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : 'block';
  if (btn) {
    const icon = btn.querySelector('i');
    if (icon) icon.className = isOpen ? 'fas fa-chevron-down' : 'fas fa-chevron-up';
    icon.style.fontSize = '10px';
  }
}

function _reqFiltrarOS() {
  const s = (document.getElementById('reqOSSearch')?.value||'').toLowerCase();
  const fluxoOS = _reqGetFluxoOS();
  const rcs     = _reqGetRC();
  const rcsDeOS = rcs.filter(r => r.os_vinculada);
  const podeEmitir = (typeof _podeEmitirRC === 'function') ? _podeEmitirRC() : hasPermission('requisicoes','create');
  const lista = fluxoOS.filter(f =>
    (f.itens||[]).some(it => it.status_item === 'Aprovado') &&
    (!s || (f.os_id+f.os_descricao).toLowerCase().includes(s))
  );
  const el = document.getElementById('reqOSLista');
  if (el) el.innerHTML = _reqRenderOSCards(lista, rcsDeOS, podeEmitir);
}

// ─── CARDS DE OS (mantido para compat) ──────────────────────────────────────
function _reqRenderOSCards(lista, rcsDeOS, podeEmitir) {
  if (!lista.length) return `
    <div style="text-align:center;padding:24px;color:#94a3b8;border:1px dashed #e2e8f0;border-radius:8px;">
      <i class="fas fa-clipboard-list" style="font-size:26px;display:block;margin-bottom:8px;opacity:.3;"></i>
      <div style="font-size:12px;">Nenhuma OS com itens aprovados pendentes</div>
    </div>`;
  const statusColor = {
    'Aprovada – Aguardando Comprador':'#3b82f6','Em Cotação':'#6366f1',
    'RFQ Criado':'#0ea5e9','Mapa Criado':'#7c3aed','Mapa Aprovado':'#10b981','PC Emitido':'#22c55e'
  };
  return lista.map(f => {
    const itensAprov = (f.itens||[]).filter(it => it.status_item === 'Aprovado');
    const rcsVinc    = rcsDeOS.filter(r => r.os_vinculada === f.os_id);
    const cor        = statusColor[f.status] || '#f59e0b';
    const temRC      = rcsVinc.length > 0;
    return `
    <div style="border:1px solid #e2e8f0;border-left:3px solid ${cor};border-radius:10px;margin-bottom:10px;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
        <span style="font-size:13px;font-weight:700;color:${cor};">${f.os_id}</span>
        <span style="font-size:12px;color:#475569;">${(f.os_descricao||'').substring(0,60)}</span>
        ${_reqStatusBadge(f.status)}
        <span style="font-size:11px;background:#dcfce7;color:#16a34a;border-radius:5px;padding:2px 8px;font-weight:600;">
          ${itensAprov.length} item(ns) aprovado(s)
        </span>
      </div>
      <div>
        ${podeEmitir ? (temRC
          ? `<button onclick="reqAbrirNovaRCdeOS('${f.id}',true)" style="padding:7px 14px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;color:#475569;font-size:12px;cursor:pointer;">
               <i class="fas fa-plus" style="margin-right:4px;"></i>Nova RC adicional
             </button>`
          : `<button onclick="reqAbrirNovaRCdeOS('${f.id}',false)" style="padding:7px 14px;border:none;border-radius:8px;background:#f97316;color:#fff;font-size:12px;font-weight:600;cursor:pointer;">
               <i class="fas fa-plus" style="margin-right:4px;"></i>Nova RC
             </button>`
        ) : ''}
      </div>
    </div>`;
  }).join('');
}

// ─── SWITCH DE ABAS (compat) ─────────────────────────────────────────────────
function _reqSwitchTab(tab) { renderRequisicoes(); }

// ─── EXPORTAR ────────────────────────────────────────────────────────────────
// Exportação para Excel (.xlsx REAL, gerado no backend a partir dos dados do
// servidor — multi-tenant e por perfil). Respeita a busca e o filtro de status
// ativos na tela. Substitui o CSV antigo, que ignorava os filtros e não
// neutralizava fórmulas (=cmd executava no Excel).
const _REQ_STATUS_EXPORT = {
  aguard_aprv: 'Aguardando Aprovação',
  aprovada: 'Aprovada – Aguardando Comprador|RFQ Criado|Em Cotação|Cotações Recebidas|Mapa Criado|Mapa Aprovado|Aprovada',
  em_cotacao: 'RFQ Criado|Em Cotação|Cotações Recebidas',
  concluida: 'PC Emitido|Atendida',
  rejeitada: 'Rejeitada',
};
async function _reqExportarRC() {
  const btn = document.getElementById('reqBtnExportar');
  if (btn && btn.disabled) return; // impede cliques simultâneos
  const original = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.style.opacity = '.6'; btn.innerHTML = '<i class="fas fa-spinner fa-spin" style="font-size:12px;"></i> Gerando…'; }
  try {
    const params = new URLSearchParams();
    const q = (document.getElementById('reqSearch')?.value || '').trim();
    const statusKey = document.getElementById('reqStatusSel')?.value || 'todas';
    if (q) params.set('q', q);
    if (_REQ_STATUS_EXPORT[statusKey]) params.set('status', _REQ_STATUS_EXPORT[statusKey]);
    const token = sessionStorage.getItem('fa_token') || localStorage.getItem('fa_token') || '';
    const resp = await fetch(`/api/rc/export.xlsx?${params}`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!resp.ok) {
      let msg = 'Falha na exportação';
      try { msg = (await resp.json()).error || msg; } catch (e) {}
      if (typeof showToast === 'function') showToast(msg, resp.status === 404 ? 'warning' : 'error');
      return;
    }
    const nome = (resp.headers.get('Content-Disposition') || '').match(/filename="([^"]+)"/)?.[1]
      || `processos_${new Date().toISOString().slice(0, 10)}.xlsx`;
    const blob = await resp.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nome;
    a.click();
    URL.revokeObjectURL(a.href);
    if (typeof showToast === 'function') showToast('Exportação concluída: ' + nome, 'success');
  } catch (e) {
    if (typeof showToast === 'function') showToast('Erro na exportação: ' + ((e && e.message) || 'rede'), 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.style.opacity = '1'; btn.innerHTML = original; }
  }
}

// ─── VER OS ──────────────────────────────────────────────────────────────────
function _reqVerDetalheOS(fluxoId) {
  const f = _reqGetFluxoOS().find(x => x.id === fluxoId);
  if (!f) { showToast('OS não encontrada.','error'); return; }
  openModalWide(`OS ${f.os_id} – Detalhes`, `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;margin-bottom:14px">
      <div style="padding:10px;background:var(--bg-card2);border-radius:8px">
        <div style="font-size:10px;color:var(--text-muted)">OS</div>
        <div style="font-size:13px;font-weight:700;color:var(--fa-teal)">${f.os_id}</div>
      </div>
      <div style="padding:10px;background:var(--bg-card2);border-radius:8px">
        <div style="font-size:10px;color:var(--text-muted)">Status</div>
        <div>${_reqStatusBadge(f.status)}</div>
      </div>
    </div>
    <div style="font-size:13px;font-weight:600;margin-bottom:8px">${f.os_descricao||'—'}</div>
    <div style="font-size:12px;font-weight:700;color:var(--text-muted);margin-bottom:6px">ITENS APROVADOS</div>
    ${(f.itens||[]).filter(it=>it.status_item==='Aprovado').map(it=>`
      <div style="display:flex;gap:8px;align-items:center;padding:6px 10px;background:var(--bg-secondary);border-radius:6px;margin-bottom:4px;font-size:12px">
        <i class="fas fa-check-circle" style="color:#22c55e"></i>
        <span style="flex:1">${it.descricao}</span>
        <span style="color:var(--text-muted)">${it.qtd||1} ${it.unidade||'Un'}</span>
        ${it.valor_unit>0?`<span style="font-weight:600">R$ ${(it.valor_unit||0).toFixed(2)}/un</span>`:''}
      </div>`).join('')}
  `, `<button class="btn btn-secondary" onclick="closeModal()">Fechar</button>`);
}

// ─── VER OS RÁPIDA (a partir do ID da OS) ────────────────────────────────────
function _reqVerDetalheOSRapida(osId) {
  if (!osId) return;
  // Tenta carregar OS do localStorage
  let os = null;
  try {
    const lista = JSON.parse(localStorage.getItem('fa_ordens_servico') || '[]');
    os = lista.find(o => o.id === osId || o.numero === osId);
  } catch(e) {}

  // Também busca no fluxo OS
  const fluxoOS = _reqGetFluxoOS();
  const fluxo = fluxoOS.find(f => f.os_id === osId);

  // RCs existentes para esta OS
  const rcsDeOS = _reqGetRC().filter(r => r.os_vinculada === osId);
  const podeEmitir = (typeof _podeEmitirRC === 'function') ? _podeEmitirRC() : hasPermission('requisicoes','create');

  // Busca apontamentos
  let totalHH = 0, aponts = [];
  try {
    aponts = JSON.parse(localStorage.getItem('fa_apontamentos_os') || '[]').filter(a => a.os_id === osId);
    totalHH = aponts.reduce((s, a) => s + (a.horas || 0), 0);
  } catch(e) {}

  // Status badge OS
  const statusColors = {
    'Em Andamento': '#3b82f6', 'Concluída': '#22c55e', 'Pausada': '#f59e0b',
    'Aguardando Peça': '#ef4444', 'Agendada': '#8b5cf6', 'Cancelada': '#6b7280'
  };
  const priorColors = { 'Crítica': '#dc2626', 'Alta': '#f97316', 'Normal': '#64748b' };
  const osStatus = os?.status || fluxo?.status || '—';
  const osPrior = os?.prioridade || '—';
  const osStatusColor = statusColors[osStatus] || '#64748b';
  const osPriorColor = priorColors[osPrior] || '#64748b';
  const progress = os?.progress || 0;

  const itensAprov = (fluxo?.itens || os?.itens_compra || []).filter(it =>
    it.status_item === 'Aprovado' || it.status === 'Aprovado'
  );

  openModalWide(`Ordem de Serviço – ${osId}`, `
    <!-- Cabeçalho da OS -->
    <div style="display:grid;grid-template-columns:1fr auto;gap:14px;margin-bottom:16px;padding-bottom:14px;border-bottom:2px solid #e2e8f0;">
      <div>
        <div style="font-size:17px;font-weight:800;color:#0f172a;margin-bottom:4px;">${os?.descricao || fluxo?.os_descricao || osId}</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;font-size:12px;color:#64748b;">
          <span><i class="fas fa-file-contract" style="margin-right:3px;color:#94a3b8;"></i>${os?.contrato || '—'}</span>
          <span><i class="fas fa-map-marker-alt" style="margin-right:3px;color:#94a3b8;"></i>${os?.local || '—'}</span>
          <span><i class="fas fa-user" style="margin-right:3px;color:#94a3b8;"></i>${os?.responsavel || '—'}</span>
          ${os?.tipo ? `<span style="background:#f1f5f9;border-radius:5px;padding:2px 8px;font-size:11px;">${os.tipo}</span>` : ''}
        </div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;">
        <span style="background:${osStatusColor}22;color:${osStatusColor};border:1px solid ${osStatusColor}44;border-radius:8px;padding:5px 12px;font-size:11px;font-weight:700;">${osStatus}</span>
        <span style="background:${osPriorColor}15;color:${osPriorColor};border-radius:8px;padding:3px 10px;font-size:10px;font-weight:600;"><i class="fas fa-flag" style="margin-right:3px;font-size:9px;"></i>Prioridade: ${osPrior}</span>
        <span style="font-size:10px;color:#94a3b8;">${osId}</span>
      </div>
    </div>

    <!-- Grid de dados da OS -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:16px;">
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px;">
        <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;font-weight:700;margin-bottom:4px;">Horas Previstas</div>
        <div style="font-size:16px;font-weight:700;color:#0f172a;">${os?.horas || 0}h</div>
      </div>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px;">
        <div style="font-size:10px;color:#16a34a;text-transform:uppercase;font-weight:700;margin-bottom:4px;">HH Apontadas</div>
        <div style="font-size:16px;font-weight:700;color:#15803d;">${totalHH}h</div>
      </div>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px;">
        <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;font-weight:700;margin-bottom:4px;">Equipe</div>
        <div style="font-size:16px;font-weight:700;color:#0f172a;">${os?.equipe || 0} <span style="font-size:11px;color:#64748b;">pessoas</span></div>
      </div>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px;">
        <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;font-weight:700;margin-bottom:4px;">Prazo</div>
        <div style="font-size:13px;font-weight:700;color:${osPrior==='Crítica'?'#dc2626':'#0f172a'};">${os?.prazo || '—'}</div>
      </div>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px;">
        <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;font-weight:700;margin-bottom:4px;">RCs Emitidas</div>
        <div style="font-size:16px;font-weight:700;color:${rcsDeOS.length>0?'#2563eb':'#94a3b8'};">${rcsDeOS.length}</div>
      </div>
    </div>

    <!-- Barra de progresso -->
    <div style="margin-bottom:16px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:5px;">
        <span style="font-size:11px;font-weight:600;color:#475569;">Progresso da OS</span>
        <span style="font-size:11px;font-weight:700;color:${progress>=100?'#16a34a':'#f97316'};">${progress}%</span>
      </div>
      <div style="height:8px;background:#e2e8f0;border-radius:99px;overflow:hidden;">
        <div style="height:100%;width:${progress}%;background:${progress>=100?'#22c55e':progress>=60?'#3b82f6':'#f97316'};border-radius:99px;transition:width .3s;"></div>
      </div>
    </div>

    <!-- Itens de compra aprovados -->
    ${itensAprov.length > 0 ? `
    <div style="margin-bottom:16px;">
      <div style="font-size:12px;font-weight:700;color:#0f172a;margin-bottom:8px;display:flex;align-items:center;gap:6px;">
        <i class="fas fa-check-circle" style="color:#22c55e;"></i>
        Itens Aprovados para Compra (${itensAprov.length})
      </div>
      <div style="border:1px solid #bbf7d0;border-radius:10px;overflow:hidden;">
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead>
            <tr style="background:#f0fdf4;border-bottom:1px solid #bbf7d0;">
              <th style="padding:8px 12px;text-align:left;font-size:10px;color:#16a34a;font-weight:700;text-transform:uppercase;">Descrição</th>
              <th style="padding:8px 12px;text-align:center;font-size:10px;color:#16a34a;font-weight:700;text-transform:uppercase;">Qtd</th>
              <th style="padding:8px 12px;text-align:center;font-size:10px;color:#16a34a;font-weight:700;text-transform:uppercase;">Unidade</th>
              <th style="padding:8px 12px;text-align:right;font-size:10px;color:#16a34a;font-weight:700;text-transform:uppercase;">Valor Unit.</th>
              <th style="padding:8px 12px;text-align:center;font-size:10px;color:#16a34a;font-weight:700;text-transform:uppercase;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${itensAprov.map((it, i) => `
              <tr style="border-bottom:1px solid #dcfce7;${i%2===0?'background:#fff':'background:#f9fffe'}">
                <td style="padding:8px 12px;font-weight:500;color:#0f172a;">${it.descricao || '—'}</td>
                <td style="padding:8px 12px;text-align:center;font-weight:700;">${it.qtd || 1}</td>
                <td style="padding:8px 12px;text-align:center;color:#64748b;">${it.unidade || 'Un'}</td>
                <td style="padding:8px 12px;text-align:right;font-weight:600;">${it.valor_unit>0?_reqFmt(it.valor_unit):'A cotar'}</td>
                <td style="padding:8px 12px;text-align:center;"><span style="background:#dcfce7;color:#15803d;border-radius:5px;padding:2px 8px;font-size:10px;font-weight:700;">Aprovado</span></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>` : ''}

    <!-- Observações da OS -->
    ${os?.observacoes ? `
    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:#92400e;">
      <i class="fas fa-sticky-note" style="margin-right:6px;"></i>
      <strong>Obs:</strong> ${os.observacoes}
    </div>` : ''}

    <!-- RCs existentes para esta OS -->
    ${rcsDeOS.length > 0 ? `
    <div style="margin-bottom:14px;">
      <div style="font-size:12px;font-weight:700;color:#0f172a;margin-bottom:8px;display:flex;align-items:center;gap:6px;">
        <i class="fas fa-file-alt" style="color:#f97316;"></i>
        Requisições de Compra Vinculadas (${rcsDeOS.length})
      </div>
      <div style="border:1px solid #fed7aa;border-radius:10px;overflow:hidden;">
        ${rcsDeOS.map(rc => `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:9px 14px;border-bottom:1px solid #fed7aa;background:#fff7ed;font-size:12px;">
            <div style="display:flex;align-items:center;gap:10px;">
              <span style="font-weight:700;color:#f97316;font-family:'Courier New',monospace;">${rc.numero||rc.id}</span>
              <span style="color:#475569;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:220px;">${rc.titulo||'—'}</span>
              ${_reqStatusBadge(rc.status)}
            </div>
            <div style="display:flex;gap:6px;align-items:center;">
              <span style="font-size:11px;font-weight:700;color:#0f172a;">${_reqFmt(rc.valor_total)}</span>
              <button onclick="reqVerDetalheRC('${rc.id}')" title="Ver RC"
                style="width:28px;height:28px;border:1px solid #e2e8f0;border-radius:6px;background:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:10px;">
                <i class="fas fa-eye" style="color:#64748b;"></i>
              </button>
            </div>
          </div>`).join('')}
      </div>
    </div>` : ''}
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
    ${podeEmitir && itensAprov.length > 0 && fluxo ? `
    <button class="btn btn-primary" onclick="closeModal();reqAbrirNovaRCdeOS('${fluxo.id}',${rcsDeOS.length>0})"
      style="background:linear-gradient(135deg,#f97316,#ea580c);border:none;">
      <i class="fas fa-plus" style="margin-right:6px;"></i>
      ${rcsDeOS.length > 0 ? 'Nova RC Adicional' : 'Criar RC para esta OS'}
    </button>` : ''}
    ${podeEmitir && (!fluxo || itensAprov.length === 0) ? `
    <button class="btn btn-primary" onclick="closeModal();reqEmitirRCAvulsa()"
      style="background:linear-gradient(135deg,#2563eb,#1d4ed8);border:none;">
      <i class="fas fa-plus" style="margin-right:6px;"></i>Nova RC Manual
    </button>` : ''}
  `);
}

// ─── VER DETALHE RC ──────────────────────────────────────────────────────────
function reqVerDetalheRC(rcId) {
  if (typeof farcVerDetalheRC === 'function') { farcVerDetalheRC(rcId); return; }
  const r = _reqGetRC().find(x => x.id === rcId);
  if (!r) { showToast('RC não encontrada.','error'); return; }
  const podeEditar = (typeof _podeEmitirRC === 'function') ? _podeEmitirRC() : hasPermission('requisicoes','create');
  const statusEditaveis = ['Rascunho','Aguardando Aprovação','Aprovada – Aguardando Comprador'];

  openModalWide(`RC ${r.numero} – Detalhes`, `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-bottom:14px">
      <div style="padding:10px;background:var(--bg-card2);border-radius:8px">
        <div style="font-size:10px;color:var(--text-muted)">Solicitante</div>
        <div style="font-size:13px;font-weight:700">${r.solicitante||'—'}</div>
      </div>
      <div style="padding:10px;background:var(--bg-card2);border-radius:8px">
        <div style="font-size:10px;color:var(--text-muted)">Prazo</div>
        <div style="font-size:13px;font-weight:700">${r.prazo||r.prazo_necessidade||'—'}</div>
      </div>
      <div style="padding:10px;background:var(--bg-card2);border-radius:8px">
        <div style="font-size:10px;color:var(--text-muted)">Valor Estimado</div>
        <div style="font-size:13px;font-weight:700;color:var(--orange)">${_reqFmt(r.valor_total)}</div>
      </div>
      <div style="padding:10px;background:var(--bg-card2);border-radius:8px;text-align:center">
        <div style="font-size:10px;color:var(--text-muted)">Status</div>
        ${_reqStatusBadge(r.status)}
      </div>
      ${r.os_vinculada?`<div style="padding:10px;background:rgba(20,184,166,0.06);border:1px solid rgba(20,184,166,0.2);border-radius:8px;display:flex;flex-direction:column;gap:5px;">
        <div style="font-size:10px;color:var(--text-muted)">OS Vinculada</div>
        <div style="font-size:13px;font-weight:700;color:var(--fa-teal)">${r.os_vinculada}</div>
        <button onclick="_reqVerDetalheOSRapida('${r.os_vinculada}')"
          style="padding:4px 10px;border:1px solid rgba(20,184,166,0.3);border-radius:6px;background:rgba(20,184,166,0.08);color:var(--fa-teal);font-size:11px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:5px;width:fit-content;"
          onmouseover="this.style.background='rgba(20,184,166,0.15)'" onmouseout="this.style.background='rgba(20,184,166,0.08)'">
          <i class="fas fa-eye" style="font-size:9px;"></i>Ver OS Completa
        </button>
      </div>`:''}
    </div>

    <div style="font-size:13px;font-weight:700;margin-bottom:8px">
      <i class="fas fa-list-check" style="color:#3b82f6;margin-right:6px"></i>
      Itens (${r.itens?.length||0})
      <span style="display:inline-flex;gap:4px;margin-left:8px">
        ${['Aprovado','Pendente','Em Cotação','Pedido Emitido','Rejeitado'].map(s=>{
          const cnt=(r.itens||[]).filter(it=>(it.status_item||it.status||'Pendente')===s).length;
          return cnt>0?`<span style="background:${({'Aprovado':'#22c55e','Pendente':'#f59e0b','Em Cotação':'#6366f1','Pedido Emitido':'#10b981','Rejeitado':'#ef4444'}[s]||'#8b949e')}22;color:${({'Aprovado':'#22c55e','Pendente':'#f59e0b','Em Cotação':'#6366f1','Pedido Emitido':'#10b981','Rejeitado':'#ef4444'}[s]||'#8b949e')};border-radius:5px;padding:2px 7px;font-size:10px;font-weight:700">${s} ×${cnt}</span>`:''
        }).join('')}
      </span>
    </div>
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr style="background:var(--bg-tertiary)">
          <th style="padding:7px 10px;text-align:left;font-size:10px;color:var(--text-muted)">#</th>
          <th style="padding:7px 10px;text-align:left;font-size:10px;color:var(--text-muted)">Descrição</th>
          <th style="padding:7px 10px;text-align:center;font-size:10px;color:var(--text-muted)">Qtd</th>
          <th style="padding:7px 10px;text-align:center;font-size:10px;color:var(--text-muted)">Un</th>
          <th style="padding:7px 10px;text-align:right;font-size:10px;color:var(--text-muted)">V. Unit.</th>
          <th style="padding:7px 10px;text-align:right;font-size:10px;color:var(--text-muted)">Total</th>
          <th style="padding:7px 10px;text-align:center;font-size:10px;color:var(--text-muted)">Status Item</th>
        </tr></thead>
        <tbody>
          ${(r.itens||[]).map((it,i)=>{
            const si=it.status_item||it.status||'Pendente';
            const sc={'Aprovado':'#22c55e','Pendente':'#f59e0b','Em Cotação':'#6366f1','Pedido Emitido':'#10b981','Rejeitado':'#ef4444'}[si]||'#8b949e';
            return `<tr style="border-bottom:1px solid var(--border-color);border-left:3px solid ${sc}44">
              <td style="padding:7px 10px;color:var(--text-muted)">${i+1}</td>
              <td style="padding:7px 10px;font-weight:500">${it.descricao||'—'}</td>
              <td style="padding:7px 10px;text-align:center">${it.qtd||1}</td>
              <td style="padding:7px 10px;text-align:center;color:var(--text-muted)">${it.unidade||'Un'}</td>
              <td style="padding:7px 10px;text-align:right">${it.valor_unit>0?_reqFmt(it.valor_unit):'—'}</td>
              <td style="padding:7px 10px;text-align:right;font-weight:600">${it.total>0?_reqFmt(it.total):'—'}</td>
              <td style="padding:7px 10px;text-align:center">${_reqItemBadge(si)}</td>
            </tr>`;
          }).join('')}
          <tr style="background:var(--bg-card2);font-weight:700">
            <td colspan="6" style="padding:8px 10px;text-align:right;color:var(--text-secondary)">TOTAL ESTIMADO</td>
            <td style="padding:8px 10px;text-align:right;color:var(--orange);font-size:13px">${_reqFmt(r.valor_total)}</td>
          </tr>
        </tbody>
      </table>
    </div>
    ${(r.historico||[]).length>0?`
      <div style="margin-top:14px">
        <div style="font-size:12px;font-weight:700;margin-bottom:6px"><i class="fas fa-history" style="color:var(--text-muted);margin-right:6px"></i>Histórico</div>
        ${(r.historico||[]).slice(0,5).map(h=>`
          <div style="display:flex;gap:10px;padding:5px 0;border-bottom:1px solid var(--border-color);font-size:11px">
            <div style="color:var(--text-muted);min-width:120px">${h.data||'—'}</div>
            <div style="flex:1;color:var(--text-secondary)">${h.acao||'—'}</div>
            <div style="color:var(--text-muted)">${h.usuario||'—'}</div>
          </div>`).join('')}
      </div>`:''
    }
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
    ${podeEditar && statusEditaveis.includes(r.status)
      ?`<button class="btn btn-warning" onclick="closeModal();reqEditarRC('${r.id}')"><i class="fas fa-edit"></i> Editar RC</button>` :''}
    ${r.status==='Aguardando Aprovação'
      ?`<button class="btn btn-success" onclick="closeModal();reqAprovarRC('${r.id}')"><i class="fas fa-check"></i> Aprovar RC</button>` :''}
    ${r.status==='Aprovada – Aguardando Comprador'
      ?`<button class="btn btn-primary" onclick="closeModal();navigate('rfq')"><i class="fas fa-paper-plane"></i> Cotações (RFQ)</button>` :''}
  `);
}

// ─── APROVAR RC (Gestor/Comprador aprova RC avulsa) ────────────────────────────
function reqAprovarRC(rcId) {
  const rcs = _reqGetRC();
  const r = rcs.find(x => String(x.id) === String(rcId));
  if (!r) { showToast('RC não encontrada.', 'error'); return; }
  // RC do servidor: aprovação vai pelo endpoint real (auditada, multi-tenant).
  if (r.origem === 'api') {
    if (!['Rascunho', 'Pendente'].includes(r.status)) { showToast(`RC já está com status: ${r.status}`, 'info', 3000); return; }
    if (typeof aprovarRequisicao !== 'function') { showToast('Ação de aprovação não carregada.', 'error'); return; }
    aprovarRequisicao(r.id).then(ok => { if (ok) renderRequisicoes(); });
    return;
  }
  if (r.status !== 'Aguardando Aprovação') {
    showToast(`RC já está com status: ${r.status}`, 'info', 3000);
    return;
  }

  const itens = r.itens || [];
  const total = itens.reduce((s, i) => s + ((i.valor_unit || i.preco_unit || 0) * (i.qtd || i.quantidade || 1)), 0);

  openModal(`Aprovar RC – ${r.numero || r.id}`, `
    <div style="background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.2);border-radius:10px;padding:12px;margin-bottom:14px">
      <div style="font-size:13px;font-weight:700;color:var(--text-primary);margin-bottom:4px">
        <i class="fas fa-file-alt" style="color:#22c55e;margin-right:6px"></i>${r.numero || r.id} – ${r.titulo || r.descricao || ''}
      </div>
      <div style="font-size:12px;color:var(--text-secondary)">
        ${itens.length} item(ns) · Valor estimado: <strong style="color:#22c55e">${_reqFmt(total)}</strong>
      </div>
      <div style="font-size:12px;color:var(--text-muted);margin-top:4px">
        Solicitante: ${r.solicitante || r.criado_por || '—'} · Prazo: ${r.prazo || r.prazo_necessidade || '—'}
      </div>
    </div>
    <p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px">
      Ao aprovar, esta RC ficará disponível na aba <strong>Cotações (RFQ)</strong> para o Comprador iniciar o processo de cotação.
    </p>
    <div style="margin-bottom:8px">
      <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">Observação da aprovação (opcional)</label>
      <input type="text" id="reqAprovarObs" placeholder="Ex: Aprovado conforme orçamento previsto"
        style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-success" onclick="_reqConfirmarAprovarRC('${rcId}')">
      <i class="fas fa-check"></i> Aprovar RC
    </button>
  `);
}

function _reqConfirmarAprovarRC(rcId) {
  const obs = document.getElementById('reqAprovarObs')?.value?.trim() || '';
  const rcs = _reqGetRC();
  const idx = rcs.findIndex(x => x.id === rcId);
  if (idx < 0) { showToast('RC não encontrada.', 'error'); return; }

  rcs[idx].status = 'Aprovada – Aguardando Comprador';
  rcs[idx].estagio_atual = 4;
  if (!rcs[idx].historico) rcs[idx].historico = [];
  rcs[idx].historico.push({
    acao: `RC aprovada pelo gestor${obs ? ' – ' + obs : ''}. Disponível para cotação.`,
    usuario: currentUser?.name || 'Gestor',
    data: new Date().toLocaleString('pt-BR')
  });

  // Salva em fa_rcs via localStorage direto + via db.js
  try { localStorage.setItem('fa_rcs', JSON.stringify(rcs)); } catch(e) {}
  if (typeof window._saveRC === 'function') window._saveRC(rcs);

  logAction && logAction('Aprovar RC', 'Compras', `RC ${rcs[idx].numero || rcId} aprovada`);
  closeModal();
  showToast(`✅ RC ${rcs[idx].numero || rcId} aprovada! Redirecionando para Cotações…`, 'success', 4000);
  // Redireciona para aba Cotações onde o comprador pode iniciar o processo de RFQ
  setTimeout(() => {
    if (typeof navigate === 'function') navigate('rfq');
    else renderRequisicoes();
  }, 600);
}

// ─── EDITAR RC ───────────────────────────────────────────────────────────────
function reqEditarRC(rcId) {
  // delegar para função do fluxo se disponível
  if (typeof farcEditarRC === 'function') { farcEditarRC(rcId); return; }
  showToast('Módulo de edição não carregado. Acesse pelo Fluxo de Aprovação.','info');
}

// ─── ABRIR NOVA RC DE OS (com controle de bloqueio) ───────────────────────────
function reqAbrirNovaRCdeOS(fluxoId, adicional) {
  // Se função do fluxo disponível, delegar
  if (typeof farcAbrirNovaRCdeOS === 'function') {
    if (adicional) {
      // Informa que é RC adicional para a mesma OS
      showToast('Abrindo nova RC adicional para a mesma OS…','info',2000);
    }
    farcAbrirNovaRCdeOS(fluxoId);
    return;
  }
  showToast('Módulo de emissão não carregado. Acesse pelo Fluxo de Aprovação.','info');
}

// ─── NOVA RC AVULSA ──────────────────────────────────────────────────────────
function reqEmitirRCAvulsa() {
  if (typeof farcEmitirRCAvulsa === 'function') { farcEmitirRCAvulsa(); return; }
  showToast('Módulo de emissão não carregado. Acesse pelo Fluxo de Aprovação.','info');
}

// ─── filterRequisicoes (legacy compat) ───────────────────────────────────────
function filterRequisicoes() { _reqFiltrarTexto(); }

function openNovaRequisicao() {
  openModalWide('Nova Requisição de Compra', `
    <div class="form-row">
      <div class="form-group"><label>Título da Requisição *</label><input class="form-control" id="nr_titulo" placeholder="Ex: Reposição de rolamentos britador"></div>
      <div class="form-group"><label>Nº Processo</label><input class="form-control" id="nr_proc" placeholder="PROC-2025-..."></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Contrato *</label>
        <select class="form-control" id="nr_ctr">
          <option value="Geral">Geral</option>
          ${ERP_DATA.contratos.filter(c=>c.status==='Ativo').map(c=>`<option value="${c.id}">${c.id} – ${c.cliente}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label>Prazo de Necessidade *</label><input class="form-control" id="nr_prazo" type="date"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Solicitante</label><input class="form-control" id="nr_sol" value="${currentUser?currentUser.name:''}"></div>
      <div class="form-group"><label>Departamento</label><input class="form-control" id="nr_depto" value="${currentUser?currentUser.role:''}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Tipo *</label>
        <select class="form-control" id="nr_tipo">
          <option value="Material">Material</option>
          <option value="Serviço">Serviço</option>
          <option value="Equipamento">Equipamento</option>
        </select>
      </div>
      <div class="form-group"><label>WBS / Linha de custo *</label><input class="form-control" id="nr_wbs" placeholder="Ex: 1.2.3 – rastreabilidade de custo"></div>
    </div>

    <div style="margin-top:16px;margin-bottom:8px;font-size:13px;font-weight:600;color:var(--text-primary)">
      <i class="fas fa-list" style="color:var(--orange);margin-right:6px"></i>Itens da Requisição
    </div>
    <div id="itensReq">
      <div class="form-row" style="background:var(--bg-card2);padding:8px;border-radius:6px;margin-bottom:6px">
        <div class="form-group" style="flex:3"><label style="font-size:11px">Descrição do Item</label><input class="form-control item-desc" placeholder="Material/Serviço"></div>
        <div class="form-group"><label style="font-size:11px">Qtd</label><input class="form-control item-qtd" type="number" min="1" value="1" oninput="calcTotalReq()"></div>
        <div class="form-group"><label style="font-size:11px">Un</label><input class="form-control item-un" placeholder="Un"></div>
        <div class="form-group"><label style="font-size:11px">Valor Est. (R$)</label><input class="form-control item-val" type="number" min="0" step="0.01" oninput="calcTotalReq()"></div>
        <div class="form-group" style="flex:0.3;align-self:flex-end"><button class="btn btn-danger btn-sm" onclick="this.closest('.form-row').remove();calcTotalReq()"><i class="fas fa-trash"></i></button></div>
      </div>
    </div>
    <button class="btn btn-secondary btn-sm" onclick="adicionarItemReq()" style="margin-bottom:12px"><i class="fas fa-plus"></i> Adicionar Item</button>
    <div style="display:flex;justify-content:flex-end;align-items:center;gap:12px;padding:8px;background:rgba(0,180,184,0.06);border-radius:8px">
      <span style="font-size:13px;color:var(--text-muted)">Valor Total Estimado:</span>
      <span id="totalReq" style="font-size:18px;font-weight:700;color:var(--fa-teal)">R$ 0,00</span>
    </div>
    <div class="form-group" style="margin-top:12px"><label>Observações</label><textarea class="form-control" id="nr_obs" rows="2" placeholder="Justificativa, urgência, etc."></textarea></div>
    <div id="nr_erro" style="display:none;color:var(--red-light);font-size:12px;margin-top:8px;padding:8px;border-radius:6px;background:rgba(239,68,68,0.1)"></div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="salvarNovaRequisicao()"><i class="fas fa-save"></i> Salvar Requisição</button>
  `);
}

function adicionarItemReq() {
  const cont = document.getElementById('itensReq');
  const div = document.createElement('div');
  div.className = 'form-row';
  div.style.cssText = 'background:var(--bg-card2);padding:8px;border-radius:6px;margin-bottom:6px';
  div.innerHTML = `
    <div class="form-group" style="flex:3"><input class="form-control item-desc" placeholder="Material/Serviço"></div>
    <div class="form-group"><input class="form-control item-qtd" type="number" min="1" value="1" oninput="calcTotalReq()"></div>
    <div class="form-group"><input class="form-control item-un" placeholder="Un"></div>
    <div class="form-group"><input class="form-control item-val" type="number" min="0" step="0.01" oninput="calcTotalReq()"></div>
    <div class="form-group" style="flex:0.3;align-self:flex-end"><button class="btn btn-danger btn-sm" onclick="this.closest('.form-row').remove();calcTotalReq()"><i class="fas fa-trash"></i></button></div>
  `;
  cont.appendChild(div);
}

function calcTotalReq() {
  const vals = document.querySelectorAll('#itensReq .item-val');
  const qtds = document.querySelectorAll('#itensReq .item-qtd');
  let total = 0;
  vals.forEach((v, i) => { total += (parseFloat(v.value)||0) * (parseFloat(qtds[i]?.value)||1); });
  const el = document.getElementById('totalReq');
  if (el) el.textContent = fmt(total);
}

async function salvarNovaRequisicao() {
  const titulo = document.getElementById('nr_titulo').value.trim();
  const prazo = document.getElementById('nr_prazo').value;
  const erroEl = document.getElementById('nr_erro');
  if (!titulo) { erroEl.textContent = 'Informe o título.'; erroEl.style.display = 'block'; return; }
  if (!prazo) { erroEl.textContent = 'Informe o prazo de necessidade.'; erroEl.style.display = 'block'; return; }
  // Compliance: tipo e WBS são obrigatórios (rastreabilidade de custo).
  const tipo = document.getElementById('nr_tipo')?.value;
  const wbs = (document.getElementById('nr_wbs')?.value || '').trim();
  if (!wbs) { erroEl.textContent = 'Informe a WBS / linha de custo (obrigatória).'; erroEl.style.display = 'block'; return; }

  const itens = [];
  const descs = document.querySelectorAll('#itensReq .item-desc');
  const qtds = document.querySelectorAll('#itensReq .item-qtd');
  const uns = document.querySelectorAll('#itensReq .item-un');
  const vals = document.querySelectorAll('#itensReq .item-val');
  descs.forEach((d, i) => {
    if (d.value.trim()) {
      const qtd = parseFloat(qtds[i]?.value)||1;
      const val = parseFloat(vals[i]?.value)||0;
      itens.push({ descricao: d.value.trim(), qtd, unidade: uns[i]?.value||'Un', valor_unit: val, total: qtd*val });
    }
  });
  if (!itens.length) { erroEl.textContent = 'Adicione pelo menos um item.'; erroEl.style.display = 'block'; return; }

  // Fonte de verdade: cria no servidor; sem servidor cai no fluxo local (demo).
  const _obsApi = titulo + ((document.getElementById('nr_obs')?.value || '').trim() ? ' — ' + document.getElementById('nr_obs').value.trim() : '');
  const viaApi = await _reqCriarRCViaAPI({ tipo, wbs, observacoes: _obsApi, departamento: document.getElementById('nr_depto')?.value?.trim(), prioridade: 'Normal', itens });
  if (viaApi && viaApi.erro) return; // servidor rejeitou por validação
  if (viaApi) {
    logAction('Nova Requisição', 'Suprimentos', `Requisição criada no servidor: ${viaApi.numero} – ${titulo}`);
    closeModal();
    showToast(`Requisição ${viaApi.numero} criada no servidor!`, 'success');
    renderRequisicoes();
    return;
  }

  const total = itens.reduce((a, i) => a + i.total, 0);
  const lista = _getRequisicoes();
  const ano = new Date().getFullYear();
  const novaReq = {
    id: `REQ-${ano}-${String(lista.length+1).padStart(3,'0')}`,
    titulo,
    numero_processo: document.getElementById('nr_proc').value.trim() || `PROC-${ano}-${String(lista.length+1).padStart(4,'0')}`,
    contrato: document.getElementById('nr_ctr').value,
    tipo,
    wbs,
    solicitante: document.getElementById('nr_sol').value.trim(),
    departamento: document.getElementById('nr_depto').value.trim(),
    data_abertura: new Date().toLocaleDateString('pt-BR'),
    prazo_necessidade: new Date(prazo+'T12:00:00').toLocaleDateString('pt-BR'),
    status: 'Pendente Supervisor',
    valor_estimado: total,
    itens,
    aprovacao_supervisor: { nome: '', data: '', status: 'Pendente' },
    aprovacao_gestor: { nome: '', data: '', status: 'Pendente' },
    observacoes: document.getElementById('nr_obs').value.trim(),
    criadoPor: currentUser?.name,
    criadoEm: new Date().toISOString()
  };
  lista.unshift(novaReq);
  _saveRequisicoes(lista);
  logAction('Nova Requisição', 'Suprimentos', `Requisição criada: ${novaReq.id} – ${titulo}`);
  closeModal();
  showToast(`Requisição ${novaReq.id} criada! Aguardando aprovação do Supervisor.`, 'success');
  renderRequisicoes();
}

function verDetalheRequisicao(id) {
  const r = _getRequisicoes().find(x => x.id === id);
  if (!r) return;
  openModalWide(`Requisição ${r.id}`, `
    <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
      ${statusBadge(r.status)}
      <span class="badge badge-muted">${r.contrato}</span>
      <span class="badge badge-info">${r.numero_processo||'—'}</span>
    </div>
    <div class="form-row">
      <div>
        <div class="stat-row"><span class="stat-label">Título</span><span class="stat-value" style="font-size:12px;max-width:200px;text-align:right">${r.titulo}</span></div>
        <div class="stat-row"><span class="stat-label">Solicitante</span><span class="stat-value">${r.solicitante} (${r.departamento})</span></div>
        <div class="stat-row"><span class="stat-label">Abertura</span><span class="stat-value">${r.data_abertura}</span></div>
        <div class="stat-row"><span class="stat-label">Prazo Necessidade</span><span class="stat-value">${r.prazo_necessidade}</span></div>
        <div class="stat-row"><span class="stat-label">Valor Estimado</span><span class="stat-value" style="font-weight:700;color:var(--fa-teal)">${fmt(r.valor_estimado)}</span></div>
      </div>
      <div>
        <div style="font-size:12px;font-weight:700;color:var(--text-primary);margin-bottom:8px">Fluxo de Aprovação:</div>
        <div style="display:flex;flex-direction:column;gap:6px">
          <div style="display:flex;align-items:center;gap:8px;padding:8px;background:${r.aprovacao_supervisor.status==='Aprovado'?'rgba(34,197,94,0.08)':'var(--bg-card2)'};border-radius:8px;border:1px solid ${r.aprovacao_supervisor.status==='Aprovado'?'rgba(34,197,94,0.3)':'var(--border)'}">
            <i class="fas fa-user-check" style="color:${r.aprovacao_supervisor.status==='Aprovado'?'var(--green-light)':'var(--text-muted)'}"></i>
            <div style="flex:1;font-size:12px">
              <div style="font-weight:600">Supervisor de Campo</div>
              <div style="color:var(--text-muted)">${r.aprovacao_supervisor.status} ${r.aprovacao_supervisor.nome ? '– '+r.aprovacao_supervisor.nome+' em '+r.aprovacao_supervisor.data : ''}</div>
            </div>
            ${statusBadge(r.aprovacao_supervisor.status||'Pendente')}
          </div>
          <div style="display:flex;align-items:center;gap:8px;padding:8px;background:${r.aprovacao_gestor.status==='Aprovado'?'rgba(34,197,94,0.08)':'var(--bg-card2)'};border-radius:8px;border:1px solid ${r.aprovacao_gestor.status==='Aprovado'?'rgba(34,197,94,0.3)':'var(--border)'}">
            <i class="fas fa-user-tie" style="color:${r.aprovacao_gestor.status==='Aprovado'?'var(--green-light)':'var(--text-muted)'}"></i>
            <div style="flex:1;font-size:12px">
              <div style="font-weight:600">Gestor de Operações</div>
              <div style="color:var(--text-muted)">${r.aprovacao_gestor.status} ${r.aprovacao_gestor.nome ? '– '+r.aprovacao_gestor.nome+' em '+r.aprovacao_gestor.data : ''}</div>
            </div>
            ${statusBadge(r.aprovacao_gestor.status||'Pendente')}
          </div>
        </div>
      </div>
    </div>

    <div style="margin-top:12px">
      <div style="font-size:12px;font-weight:700;margin-bottom:8px">Itens da Requisição:</div>
      <div class="table-wrapper" style="max-height:200px">
        <table style="font-size:12px">
          <thead><tr><th>Descrição</th><th>Qtd</th><th>Un</th><th>Valor Unit.</th><th>Total</th></tr></thead>
          <tbody>
            ${(r.itens||[]).map(i=>`<tr><td>${i.descricao}</td><td style="text-align:center">${i.qtd}</td><td>${i.unidade}</td><td>${fmt(i.valor_unit)}</td><td style="font-weight:600;color:var(--fa-teal)">${fmt(i.total)}</td></tr>`).join('')}
            <tr style="background:rgba(0,180,184,0.06)"><td colspan="4" style="text-align:right;font-weight:700">TOTAL ESTIMADO:</td><td style="font-weight:700;color:var(--fa-teal)">${fmt(r.valor_estimado)}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
    ${r.observacoes ? `<div class="alert alert-info" style="margin-top:12px"><span class="alert-icon"><i class="fas fa-info-circle"></i></span><div>${r.observacoes}</div></div>` : ''}
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
    ${r.status === 'Pendente Supervisor' && hasPermission('requisicoes','approve') ? `<button class="btn btn-danger" onclick="reprovarRequisicao('${r.id}')"><i class="fas fa-times"></i> Reprovar</button><button class="btn btn-success" onclick="closeModal();aprovarRequisicao('${r.id}','supervisor')"><i class="fas fa-check"></i> Aprovar (Supervisor)</button>` : ''}
    ${r.status === 'Aprovada Supervisor' && hasPermission('requisicoes','approve') ? `<button class="btn btn-danger" onclick="reprovarRequisicao('${r.id}')"><i class="fas fa-times"></i> Reprovar</button><button class="btn btn-success" onclick="closeModal();aprovarRequisicao('${r.id}','gestor')"><i class="fas fa-check-double"></i> Aprovar (Gestor)</button>` : ''}
    ${r.status === 'Aprovada Gestor' && hasPermission('mapa_cotacao','create') ? `<button class="btn btn-primary" onclick="closeModal();criarMapaComRequisicao('${r.id}')"><i class="fas fa-balance-scale"></i> Ir para Cotação</button>` : ''}
  `);
}

function aprovarRequisicao(id, nivel) {
  const lista = _getRequisicoes();
  const idx = lista.findIndex(x => x.id === id);
  if (idx < 0) return;
  const hoje = new Date().toLocaleDateString('pt-BR');
  const aprov = { nome: currentUser?.name||'—', data: hoje, status: 'Aprovado' };

  if (nivel === 'supervisor') {
    lista[idx].aprovacao_supervisor = aprov;
    lista[idx].status = 'Aprovada Supervisor';
    logAction('Aprovação', 'Suprimentos', `Requisição ${id} aprovada pelo Supervisor`);
    showToast(`Requisição aprovada pelo Supervisor! Aguardando Gestor de Operações.`, 'success');
  } else {
    lista[idx].aprovacao_gestor = aprov;
    lista[idx].status = 'Aprovada Gestor';
    logAction('Aprovação', 'Suprimentos', `Requisição ${id} aprovada pelo Gestor`);
    showToast(`Requisição totalmente aprovada! Pronta para cotação.`, 'success');
  }
  _saveRequisicoes(lista);
  if (typeof renderRequisicoes === 'function' && document.getElementById('tabelaReqs')) renderRequisicoes();
  else navigate('requisicoes');
}

function reprovarRequisicao(id) {
  const lista = _getRequisicoes();
  const idx = lista.findIndex(x => x.id === id);
  if (idx < 0) return;
  lista[idx].status = 'Reprovada';
  _saveRequisicoes(lista);
  closeModal();
  logAction('Reprovação', 'Suprimentos', `Requisição ${id} reprovada`);
  showToast(`Requisição ${id} reprovada.`, 'warning');
  renderRequisicoes();
}

function editarRequisicao(id) {
  const lista = _getRequisicoes();
  const r = lista.find(x => x.id === id);
  if (!r) return;
  openModal(`Editar Requisição – ${id}`, `
    <div class="form-group"><label>Título</label><input class="form-control" id="er_titulo" value="${r.titulo}"></div>
    <div class="form-row">
      <div class="form-group"><label>Status</label>
        <select class="form-control" id="er_status">
          ${['Rascunho','Pendente Supervisor','Aprovada Supervisor','Aprovada Gestor','Em Cotação','Pedido Emitido','Concluída','Reprovada'].map(s=>`<option ${r.status===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label>Nº Processo</label><input class="form-control" id="er_proc" value="${r.numero_processo||''}"></div>
    </div>
    <div class="form-group"><label>Observações</label><textarea class="form-control" id="er_obs" rows="2">${r.observacoes||''}</textarea></div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="salvarEdicaoRequisicao('${id}')"><i class="fas fa-save"></i> Salvar</button>
  `);
}

function salvarEdicaoRequisicao(id) {
  const lista = _getRequisicoes();
  const idx = lista.findIndex(x => x.id === id);
  if (idx < 0) return;
  lista[idx].titulo = document.getElementById('er_titulo').value.trim();
  lista[idx].status = document.getElementById('er_status').value;
  lista[idx].numero_processo = document.getElementById('er_proc').value.trim();
  lista[idx].observacoes = document.getElementById('er_obs').value.trim();
  _saveRequisicoes(lista);
  closeModal();
  showToast('Requisição atualizada!', 'success');
  renderRequisicoes();
}

function gerarRequisicaoDeMaterial(matId) {
  const m = _getMateriais().find(x => x.id === matId);
  if (!m) return;
  // Pré-preenche o modal de nova requisição
  openNovaRequisicao();
  setTimeout(() => {
    const titulo = document.getElementById('nr_titulo');
    if (titulo) titulo.value = `Reposição – ${m.descricao}`;
    const desc = document.querySelector('#itensReq .item-desc');
    const qtd = document.querySelector('#itensReq .item-qtd');
    const un = document.querySelector('#itensReq .item-un');
    const val = document.querySelector('#itensReq .item-val');
    if (desc) desc.value = m.descricao;
    if (qtd) qtd.value = Math.max(1, m.estoque_min - m.estoque_atual + m.estoque_min);
    if (un) un.value = m.unidade;
    if (val) val.value = m.valor_unitario;
    calcTotalReq();
  }, 100);
}

function exportarRequisicoes() {
  const lista = _getRequisicoes();
  const csv = [['ID','Título','Contrato','Processo','Solicitante','Abertura','Prazo','Status','Valor Estimado'],
    ...lista.map(r=>[r.id,r.titulo,r.contrato,r.numero_processo||'—',r.solicitante,r.data_abertura,r.prazo_necessidade,r.status,r.valor_estimado])
  ].map(r=>r.map(c=>`"${c}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));
  a.download = `Requisicoes_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  showToast('Requisições exportadas!', 'success');
}

// ─── MAPA COMPARATIVO DE COTAÇÕES ─────────────────────────────────────────────
function renderMapaCotacao() {
  if (!hasPermission('mapa_cotacao', 'view')) { renderAcessoNegado(); return; }
  const mapas = _getMapasCot();
  const main = document.getElementById('mainContent');

  main.innerHTML = `
    <div class="page-header">
      <div class="page-title">
        <h2><i class="fas fa-balance-scale" style="color:var(--orange);margin-right:8px"></i>Mapa Comparativo de Propostas</h2>
        <p>${mapas.length} mapas · Análise e seleção de fornecedores</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary btn-sm" onclick="navigate('compras')"><i class="fas fa-arrow-left"></i> Suprimentos</button>
        ${hasPermission('mapa_cotacao','create') ? `<button class="btn btn-primary btn-sm" onclick="openNovoMapa()"><i class="fas fa-plus"></i> Novo Mapa</button>` : ''}
      </div>
    </div>

    ${!mapas.length ? `<div class="empty-state" style="padding-top:60px"><i class="fas fa-balance-scale" style="color:var(--text-muted)"></i><p>Nenhum mapa de cotação cadastrado</p><button class="btn btn-primary" style="margin-top:16px" onclick="openNovoMapa()"><i class="fas fa-plus"></i> Criar Primeiro Mapa</button></div>` : `
    <div class="card">
      <div class="card-header"><h3><i class="fas fa-list" style="color:var(--orange);margin-right:8px"></i>Mapas Comparativos</h3></div>
      <div class="table-wrapper">
        <table>
          <thead><tr><th>ID</th><th>Título</th><th>Requisição</th><th>Qtd Fornecedores</th><th>Critério</th><th>Fornecedor Selecionado</th><th>Valor</th><th>Status</th><th>Ações</th></tr></thead>
          <tbody>
            ${mapas.map(m => `
              <tr>
                <td style="color:var(--orange);font-weight:700;font-size:12px">${m.id}</td>
                <td style="font-size:13px">${m.titulo}</td>
                <td style="font-size:11px;color:var(--text-muted)">${m.requisicao_id||'—'}</td>
                <td style="text-align:center">${(m.fornecedores||[]).length}</td>
                <td><span class="badge badge-info">${m.criterio||'—'}</span></td>
                <td style="font-size:12px;color:var(--green-light);font-weight:600">${m.fornecedor_selecionado||'—'}</td>
                <td style="font-weight:600">${m.valor_selecionado ? fmt(m.valor_selecionado) : '—'}</td>
                <td>${statusBadge(m.status)}</td>
                <td>
                  <div class="actions-cell">
                    <button class="btn btn-secondary btn-sm btn-icon" onclick="verDetalheMapa('${m.id}')" title="Detalhar"><i class="fas fa-eye"></i></button>
                    ${hasPermission('mapa_cotacao','edit') ? `<button class="btn btn-info btn-sm btn-icon" onclick="editarMapa('${m.id}')" title="Editar"><i class="fas fa-edit"></i></button>` : ''}
                    ${m.status === 'Em Análise' && hasPermission('pedidos','create') ? `<button class="btn btn-primary btn-sm" style="font-size:11px;padding:4px 8px" onclick="gerarPedidoDeMapa('${m.id}')"><i class="fas fa-shopping-cart"></i> Gerar PC</button>` : ''}
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>`}
  `;
}

function openNovoMapa() {
  const reqs = _getRequisicoes().filter(r => r.status === 'Aprovada Gestor' || r.status === 'Em Cotação');
  openModalWide('Novo Mapa Comparativo de Propostas', `
    <div class="form-row">
      <div class="form-group"><label>Título do Mapa *</label><input class="form-control" id="nm2_titulo" placeholder="Ex: Cotação Rolamentos Britador"></div>
      <div class="form-group"><label>Requisição de Origem</label>
        <select class="form-control" id="nm2_req">
          <option value="">Sem vínculo</option>
          ${reqs.map(r=>`<option value="${r.id}">${r.id} – ${r.titulo}</option>`).join('')}
        </select>
      </div>
    </div>

    <div style="margin-top:12px;margin-bottom:8px;font-size:13px;font-weight:600;color:var(--text-primary)">
      <i class="fas fa-building" style="color:var(--orange);margin-right:6px"></i>Fornecedores Cotados (até 5)
    </div>
    <div id="fornecedoresMapa">
      ${[0,1,2].map(i => _renderLinhaMapa(i)).join('')}
    </div>
    <button class="btn btn-secondary btn-sm" onclick="adicionarFornecedorMapa()" style="margin-bottom:12px"><i class="fas fa-plus"></i> Adicionar Fornecedor</button>

    <div style="margin-top:8px;padding:12px;background:rgba(0,180,184,0.06);border-radius:8px">
      <div class="form-row">
        <div class="form-group">
          <label>Critério de Seleção *</label>
          <select class="form-control" id="nm2_criterio" onchange="calcularMelhorOferta()">
            <option value="menor_preco">Menor Preço</option>
            <option value="menor_prazo">Menor Prazo de Entrega</option>
            <option value="tecnico_comercial">Melhor Técnico-Comercial</option>
            <option value="manual">Indicação Manual do Comprador</option>
          </select>
        </div>
        <div class="form-group">
          <label>Fornecedor Indicado pelo Comprador</label>
          <input class="form-control" id="nm2_indicado" placeholder="Nome do fornecedor selecionado">
        </div>
      </div>
      <div class="form-group">
        <label>Justificativa da Seleção</label>
        <textarea class="form-control" id="nm2_justif" rows="2" placeholder="Justifique a escolha do fornecedor..."></textarea>
      </div>
    </div>
    <div id="nm2_erro" style="display:none;color:var(--red-light);font-size:12px;margin-top:8px;padding:8px;border-radius:6px;background:rgba(239,68,68,0.1)"></div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="salvarNovoMapa()"><i class="fas fa-save"></i> Salvar Mapa</button>
  `);
}

function _renderLinhaMapa(i) {
  const fors = FA_FORNECEDORES || [];
  return `
    <div class="form-row mapa-linha" style="background:var(--bg-card2);padding:8px;border-radius:6px;margin-bottom:6px">
      <div class="form-group" style="flex:2">
        ${i===0?'<label style="font-size:11px">Fornecedor</label>':''}
        <input class="form-control mapa-for" placeholder="Nome do fornecedor" list="listaFornecedores${i}">
        <datalist id="listaFornecedores${i}">${fors.map(f=>`<option value="${f.razao_social||f.nome_fantasia}">`).join('')}</datalist>
      </div>
      <div class="form-group">
        ${i===0?'<label style="font-size:11px">Valor Total (R$)</label>':''}
        <input class="form-control mapa-val" type="number" min="0" step="0.01" placeholder="0,00">
      </div>
      <div class="form-group">
        ${i===0?'<label style="font-size:11px">Prazo Entrega</label>':''}
        <input class="form-control mapa-prazo" placeholder="Ex: 7 dias">
      </div>
      <div class="form-group">
        ${i===0?'<label style="font-size:11px">Cond. Pagamento</label>':''}
        <input class="form-control mapa-cond" placeholder="Ex: 30 dias">
      </div>
      <div class="form-group" style="flex:0.3;align-self:flex-end">
        <button class="btn btn-danger btn-sm" onclick="this.closest('.mapa-linha').remove()"><i class="fas fa-trash"></i></button>
      </div>
    </div>
  `;
}

function adicionarFornecedorMapa() {
  const cont = document.getElementById('fornecedoresMapa');
  const div = document.createElement('div');
  div.innerHTML = _renderLinhaMapa(cont.children.length);
  cont.appendChild(div.firstElementChild);
}

function salvarNovoMapa() {
  const titulo = document.getElementById('nm2_titulo').value.trim();
  const erroEl = document.getElementById('nm2_erro');
  if (!titulo) { erroEl.textContent = 'Informe o título.'; erroEl.style.display='block'; return; }

  const fornecedores = [];
  const fors = document.querySelectorAll('#fornecedoresMapa .mapa-for');
  const vals = document.querySelectorAll('#fornecedoresMapa .mapa-val');
  const prazos = document.querySelectorAll('#fornecedoresMapa .mapa-prazo');
  const conds = document.querySelectorAll('#fornecedoresMapa .mapa-cond');

  fors.forEach((f, i) => {
    if (f.value.trim()) {
      fornecedores.push({
        nome: f.value.trim(),
        valor: parseFloat(vals[i]?.value)||0,
        prazo: prazos[i]?.value||'—',
        cond_pagamento: conds[i]?.value||'—'
      });
    }
  });

  if (fornecedores.length < 1) { erroEl.textContent = 'Adicione pelo menos 1 fornecedor.'; erroEl.style.display='block'; return; }

  const criterio = document.getElementById('nm2_criterio').value;
  const indicado = document.getElementById('nm2_indicado').value.trim();

  // Determina melhor oferta
  let selecionado = indicado;
  let valorSel = 0;
  if (!indicado && fornecedores.length > 0) {
    if (criterio === 'menor_preco') {
      const melhor = fornecedores.filter(f=>f.valor>0).sort((a,b)=>a.valor-b.valor)[0];
      selecionado = melhor?.nome||'—';
      valorSel = melhor?.valor||0;
    } else {
      selecionado = fornecedores[0].nome;
      valorSel = fornecedores[0].valor;
    }
  } else if (indicado) {
    const f = fornecedores.find(x=>x.nome===indicado);
    valorSel = f?.valor||0;
  }

  const lista = _getMapasCot();
  const reqId = document.getElementById('nm2_req').value;
  const novoMapa = {
    id: `MC-${new Date().getFullYear()}-${String(lista.length+1).padStart(3,'0')}`,
    titulo,
    requisicao_id: reqId,
    fornecedores,
    criterio,
    fornecedor_selecionado: selecionado,
    valor_selecionado: valorSel,
    justificativa: document.getElementById('nm2_justif').value.trim(),
    status: 'Em Análise',
    criadoPor: currentUser?.name,
    criadoEm: new Date().toISOString()
  };
  lista.unshift(novoMapa);
  _saveMapasCot(lista);

  // Atualiza requisição de origem
  if (reqId) {
    const reqs = _getRequisicoes();
    const ri = reqs.findIndex(x=>x.id===reqId);
    if (ri>=0) { reqs[ri].status = 'Em Cotação'; _saveRequisicoes(reqs); }
  }

  logAction('Mapa Cotação', 'Suprimentos', `Mapa criado: ${novoMapa.id} – ${titulo}`);
  closeModal();
  showToast(`Mapa Comparativo ${novoMapa.id} criado!`, 'success');
  renderMapaCotacao();
}

function verDetalheMapa(id) {
  const m = _getMapasCot().find(x=>x.id===id);
  if (!m) return;
  openModalWide(`Mapa Comparativo – ${m.id}`, `
    <div style="display:flex;gap:8px;margin-bottom:12px">${statusBadge(m.status)}<span class="badge badge-info">${m.criterio}</span>${m.requisicao_id?`<span class="badge badge-muted">${m.requisicao_id}</span>`:''}</div>
    <div style="font-size:16px;font-weight:700;margin-bottom:16px">${m.titulo}</div>

    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th style="text-align:center">Selecionado?</th>
            <th>Fornecedor</th><th>Valor Total</th><th>Prazo Entrega</th><th>Cond. Pagamento</th>
          </tr>
        </thead>
        <tbody>
          ${(m.fornecedores||[]).map(f => `
            <tr style="background:${f.nome===m.fornecedor_selecionado?'rgba(34,197,94,0.08)':''}">
              <td style="text-align:center">${f.nome===m.fornecedor_selecionado?'<span class="badge badge-success"><i class="fas fa-check-circle"></i> Selecionado</span>':''}</td>
              <td style="font-weight:${f.nome===m.fornecedor_selecionado?'700':'400'}">${f.nome}</td>
              <td style="font-weight:700;color:${f.nome===m.fornecedor_selecionado?'var(--green-light)':'var(--text-primary)'}">${fmt(f.valor)}</td>
              <td>${f.prazo}</td>
              <td>${f.cond_pagamento}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ${m.justificativa ? `<div class="alert alert-info" style="margin-top:12px"><span class="alert-icon"><i class="fas fa-info-circle"></i></span><div><strong>Justificativa:</strong> ${m.justificativa}</div></div>` : ''}
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
    ${m.status === 'Em Análise' && hasPermission('pedidos','create') ? `<button class="btn btn-primary" onclick="closeModal();gerarPedidoDeMapa('${m.id}')"><i class="fas fa-shopping-cart"></i> Gerar Pedido de Compra</button>` : ''}
  `);
}

function editarMapa(id) {
  const lista = _getMapasCot();
  const m = lista.find(x=>x.id===id);
  if (!m) return;
  openModal(`Editar Mapa – ${id}`, `
    <div class="form-group"><label>Status</label>
      <select class="form-control" id="em2_status">
        ${['Em Análise','Aprovado','Pedido Emitido','Cancelado'].map(s=>`<option ${m.status===s?'selected':''}>${s}</option>`).join('')}
      </select>
    </div>
    <div class="form-group"><label>Fornecedor Selecionado</label>
      <input class="form-control" id="em2_sel" value="${m.fornecedor_selecionado||''}">
    </div>
    <div class="form-group"><label>Justificativa</label>
      <textarea class="form-control" id="em2_justif" rows="2">${m.justificativa||''}</textarea>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="salvarEdicaoMapa('${id}')"><i class="fas fa-save"></i> Salvar</button>
  `);
}

function salvarEdicaoMapa(id) {
  const lista = _getMapasCot();
  const idx = lista.findIndex(x=>x.id===id);
  if (idx<0) return;
  lista[idx].status = document.getElementById('em2_status').value;
  lista[idx].fornecedor_selecionado = document.getElementById('em2_sel').value.trim();
  lista[idx].justificativa = document.getElementById('em2_justif').value.trim();
  _saveMapasCot(lista);
  closeModal();
  showToast('Mapa atualizado!', 'success');
  renderMapaCotacao();
}

function gerarPedidoDeMapa(mapaId) {
  const m = _getMapasCot().find(x=>x.id===mapaId);
  if (!m) return;
  showToast(`Redirecionando para Pedidos de Compra com base no Mapa ${mapaId}...`, 'info');
  navigate('pedidos');
  setTimeout(() => {
    if (typeof abrirNovoPedidoComDados === 'function') {
      abrirNovoPedidoComDados({ fornecedor: m.fornecedor_selecionado, valor: m.valor_selecionado, mapaId, reqId: m.requisicao_id });
    }
  }, 300);
}

function criarMapaComRequisicao(reqId) {
  openNovoMapa();
  setTimeout(() => {
    const sel = document.getElementById('nm2_req');
    if (sel) {
      sel.value = reqId;
      const r = _getRequisicoes().find(x=>x.id===reqId);
      if (r) {
        const titulo = document.getElementById('nm2_titulo');
        if (titulo) titulo.value = `Cotação – ${r.titulo}`;
      }
    }
  }, 100);
}

// ─── CONTRATOS DE FORNECIMENTO ─────────────────────────────────────────────────
function renderContratosFor() {
  if (!hasPermission('contratos_sup', 'view')) { renderAcessoNegado(); return; }
  const lista = _getContratosFor();
  const main = document.getElementById('mainContent');
  const tab = window._ctrForTab || 'contratos';

  const ativos = lista.filter(c=>c.status==='Ativo');
  const valorMensal = ativos.reduce((a,c)=>a+(c.valor_mensal||0),0);
  const saldoPago = lista.reduce((a,c)=>a+(c.saldo_pago||0),0);
  const saldoDisp = lista.reduce((a,c)=>a+((c.saldo_total||0)-(c.saldo_pago||0)),0);

  // KPIs de checklist (via criterios_medicao se disponível)
  const checklistAll = JSON.parse(localStorage.getItem('fa_checklist_contrato') || '{}');
  const CM_ITEMS = typeof CM_CHECKLIST_CONTRATO !== 'undefined' ? CM_CHECKLIST_CONTRATO : [];
  const contComChecklist = lista.filter(c => checklistAll[c.id]).length;
  const contCompletos = lista.filter(c => {
    const cl = checklistAll[c.id];
    if (!cl || !cl.itens) return false;
    return CM_ITEMS.filter(t => t.obrigatorio).every(t => cl.itens[t.id]);
  }).length;

  main.innerHTML = `
    <div class="page-header">
      <div class="page-title">
        <h2><i class="fas fa-handshake" style="color:var(--orange);margin-right:8px"></i>Contratos de Fornecimento</h2>
        <p>${lista.length} contratos cadastrados · ${ativos.length} ativos</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary btn-sm" onclick="navigate('compras')"><i class="fas fa-arrow-left"></i> Suprimentos</button>
        <button class="btn btn-secondary btn-sm" onclick="exportarContratosFor()"><i class="fas fa-file-excel"></i> Exportar</button>
        ${hasPermission('contratos_sup','create') ? `<button class="btn btn-primary btn-sm" onclick="openNovoContratoFor()"><i class="fas fa-plus"></i> Novo Contrato</button>` : ''}
      </div>
    </div>

    <!-- KPIs globais -->
    <div class="kpi-grid" style="grid-template-columns:repeat(6,1fr);margin-bottom:16px">
      <div class="kpi-card kpi-blue">
        <div class="kpi-icon"><i class="fas fa-handshake"></i></div>
        <div class="kpi-value">${ativos.length}</div>
        <div class="kpi-label">Contratos Ativos</div>
      </div>
      <div class="kpi-card kpi-orange">
        <div class="kpi-icon"><i class="fas fa-calendar-alt"></i></div>
        <div class="kpi-value">${fmtK(valorMensal)}</div>
        <div class="kpi-label">Compromisso Mensal</div>
      </div>
      <div class="kpi-card kpi-green">
        <div class="kpi-icon"><i class="fas fa-check-circle"></i></div>
        <div class="kpi-value">${fmtK(saldoPago)}</div>
        <div class="kpi-label">Total Pago</div>
      </div>
      <div class="kpi-card kpi-yellow">
        <div class="kpi-icon"><i class="fas fa-wallet"></i></div>
        <div class="kpi-value">${fmtK(saldoDisp)}</div>
        <div class="kpi-label">Saldo Disponível</div>
      </div>
      <div class="kpi-card" style="border-left:4px solid #2563eb">
        <div class="kpi-icon" style="background:rgba(37,99,235,0.1)"><i class="fas fa-clipboard-check" style="color:#2563eb"></i></div>
        <div class="kpi-value" style="color:#2563eb">${contCompletos}</div>
        <div class="kpi-label">Checklists OK</div>
      </div>
      <div class="kpi-card" style="border-left:4px solid #f59e0b">
        <div class="kpi-icon" style="background:rgba(245,158,11,0.1)"><i class="fas fa-exclamation-triangle" style="color:#f59e0b"></i></div>
        <div class="kpi-value" style="color:#f59e0b">${lista.length - contComChecklist}</div>
        <div class="kpi-label">Sem Checklist</div>
      </div>
    </div>

    <!-- Alertas de vencimento de contratos (automático 90/60/30 dias) -->
    <div id="ctr_alertas_vencimento"></div>

    <!-- Abas de navegação -->
    <div style="display:flex;gap:4px;border-bottom:2px solid var(--border-color);margin-bottom:20px;overflow-x:auto">
      ${[
        { k:'contratos',  i:'fa-list-alt',       l:'Contratos' },
        { k:'checklist',  i:'fa-clipboard-check', l:'Critérios & Checklist' },
        { k:'criterios',  i:'fa-sliders-h',       l:'KPIs de Medição' },
        { k:'grafico',    i:'fa-chart-bar',        l:'Gráfico de Saldo' },
      ].map(t => `
        <button onclick="window._ctrForTab='${t.k}';renderContratosFor()"
          style="padding:8px 16px;border:none;background:transparent;cursor:pointer;font-size:13px;font-weight:600;white-space:nowrap;
          color:${tab===t.k?'var(--primary)':'var(--text-secondary)'};
          border-bottom:3px solid ${tab===t.k?'var(--primary)':'transparent'};
          margin-bottom:-2px;border-radius:6px 6px 0 0;transition:all .2s">
          <i class="fas ${t.i}" style="margin-right:6px"></i>${t.l}
        </button>
      `).join('')}
    </div>

    <!-- Conteúdo das abas -->
    <div id="ctr-for-tab-content">
      ${tab === 'contratos' ? _ctrForRenderTabContratos(lista) : ''}
      ${tab === 'checklist' ? _ctrForRenderTabChecklist(lista, checklistAll, CM_ITEMS) : ''}
      ${tab === 'criterios' ? _ctrForRenderTabCriterios() : ''}
      ${tab === 'grafico'   ? _ctrForRenderTabGrafico(ativos) : ''}
    </div>
  `;

  // Inicializa gráfico se necessário
  if (tab === 'grafico' && ativos.length) {
    setTimeout(() => {
      const ctx = document.getElementById('chartContratosFor');
      if (!ctx) return;
      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: ativos.map(c => c.fornecedor.substring(0, 20)),
          datasets: [
            { label: 'Pago', data: ativos.map(c => c.saldo_pago||0), backgroundColor: 'rgba(34,197,94,0.7)', borderRadius: 4 },
            { label: 'Saldo Disp.', data: ativos.map(c => (c.saldo_total||0)-(c.saldo_pago||0)), backgroundColor: 'rgba(0,180,184,0.5)', borderRadius: 4 }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { labels: { color: '#c9d1d9', font: { size: 11 } } } },
          scales: {
            x: { ticks: { color: '#6e7681', font: { size: 10 } }, grid: { color: '#21262d' }, stacked: true },
            y: { ticks: { color: '#6e7681', font: { size: 10 }, callback: v=>'R$'+(v/1000).toFixed(0)+'K' }, grid: { color: '#21262d' }, stacked: true }
          }
        }
      });
    }, 80);
  }

  // Alertas de vencimento (90/60/30 dias) — chamada após DOM montado
  setTimeout(() => {
    if (typeof ctrRenderAlertasVencimento === 'function') {
      ctrRenderAlertasVencimento('ctr_alertas_vencimento');
    }
  }, 50);
}

// ─── ABA: LISTA DE CONTRATOS ──────────────────────────────────────────
function _ctrForRenderTabContratos(lista) {
  if (!lista.length) return `
    <div style="text-align:center;padding:60px;color:var(--text-muted)">
      <div style="font-size:48px;margin-bottom:16px">🤝</div>
      <div style="font-size:15px;font-weight:600">Nenhum contrato cadastrado</div>
      <p style="font-size:13px;margin-top:8px">Clique em "Novo Contrato" para cadastrar o primeiro contrato de fornecimento.</p>
    </div>`;

  return `
    <div class="card">
      <div class="table-wrapper">
        <table>
          <thead><tr>
            <th>ID</th><th>Fornecedor</th><th>Objeto</th><th>Tipo</th>
            <th>Valor Mensal</th><th>Vigência</th><th>Total</th><th>Pago</th>
            <th>Saldo</th><th>Checklist</th><th>Status</th><th>Ações</th>
          </tr></thead>
          <tbody>
            ${lista.map(c => {
              const saldo = (c.saldo_total||0) - (c.saldo_pago||0);
              const pct = c.saldo_total > 0 ? Math.round(c.saldo_pago/c.saldo_total*100) : 0;
              const checklistAll = JSON.parse(localStorage.getItem('fa_checklist_contrato') || '{}');
              const CM_ITEMS = typeof CM_CHECKLIST_CONTRATO !== 'undefined' ? CM_CHECKLIST_CONTRATO : [];
              const cl = checklistAll[c.id];
              const obrigTotal = CM_ITEMS.filter(t=>t.obrigatorio).length;
              const obrigOk = CM_ITEMS.filter(t=>t.obrigatorio && cl?.itens?.[t.id]).length;
              const pctCL = obrigTotal > 0 ? Math.round(obrigOk/obrigTotal*100) : 0;
              const corCL = pctCL===100 ? '#16a34a' : pctCL>=50 ? '#f59e0b' : '#dc2626';
              const labelCL = !cl ? 'Sem checklist' : pctCL===100 ? 'Conforme' : `${pctCL}% obrig.`;
              return `
                <tr>
                  <td style="color:var(--orange);font-weight:700;font-size:12px">${c.id}</td>
                  <td style="font-size:13px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.fornecedor}</td>
                  <td style="font-size:12px;color:var(--text-secondary);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.objeto}</td>
                  <td><span class="badge ${c.tipo==='Contrato'?'badge-info':'badge-muted'}">${c.tipo}</span></td>
                  <td style="font-size:12px">${c.valor_mensal > 0 ? fmt(c.valor_mensal) : '—'}</td>
                  <td style="font-size:11px">${c.inicio||'—'} ${c.fim ? '→ '+c.fim : ''}</td>
                  <td>${fmt(c.saldo_total)}</td>
                  <td style="color:var(--green-light)">${fmt(c.saldo_pago)}</td>
                  <td>
                    <div style="font-size:12px;font-weight:600;color:${saldo>0?'var(--fa-teal)':'var(--red-light)'}">${fmt(saldo)}</div>
                    <div class="progress" style="height:4px;margin-top:2px">
                      <div class="progress-bar ${pct>=80?'green':''}" style="width:${pct}%"></div>
                    </div>
                  </td>
                  <td>
                    <button onclick="window._ctrForTab='checklist';renderContratosFor();setTimeout(()=>cmAbrirChecklistContrato('${c.id}'),200)"
                      style="font-size:11px;padding:3px 8px;border:1px solid ${corCL};border-radius:6px;background:transparent;cursor:pointer;color:${corCL};font-weight:600">
                      <i class="fas ${!cl?'fa-plus-circle':pctCL===100?'fa-check-circle':'fa-exclamation-circle'}" style="margin-right:3px"></i>${labelCL}
                    </button>
                  </td>
                  <td>${statusBadge(c.status)}</td>
                  <td>
                    <div class="actions-cell">
                      ${hasPermission('contratos_sup','edit') ? `<button class="btn btn-info btn-sm btn-icon" onclick="editarContratoFor('${c.id}')" title="Editar"><i class="fas fa-edit"></i></button>` : ''}
                      <button class="btn btn-success btn-sm btn-icon" onclick="lancarPagamentoContrato('${c.id}')" title="Lançar Pagamento"><i class="fas fa-dollar-sign"></i></button>
                      <button class="btn btn-warning btn-sm btn-icon" onclick="exportarRelContratoFor('${c.id}')" title="Relatório"><i class="fas fa-file-pdf"></i></button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

// ─── ABA: CRITÉRIOS & CHECKLIST DE CONTROLE ────────────────────────────
function _ctrForRenderTabChecklist(lista, checklistAll, CM_ITEMS) {
  if (typeof cmRenderContratosFornecimento === 'function') {
    // Usa o módulo completo se disponível
    return cmRenderContratosFornecimento();
  }

  // Fallback simplificado se o módulo não estiver disponível
  if (!lista.length) return `
    <div style="text-align:center;padding:60px;color:var(--text-muted)">
      <div style="font-size:48px;margin-bottom:12px">📋</div>
      <div style="font-size:15px">Nenhum contrato para controlar.</div>
    </div>`;

  return `
    <div style="background:rgba(37,99,235,0.06);border:1px solid rgba(37,99,235,0.2);border-radius:10px;padding:14px 18px;margin-bottom:20px;display:flex;gap:12px;align-items:flex-start">
      <i class="fas fa-info-circle" style="color:#2563eb;font-size:18px;margin-top:1px;flex-shrink:0"></i>
      <div>
        <div style="font-weight:700;font-size:13px;color:var(--text-primary);margin-bottom:4px">Critérios de Controle de Fornecimento</div>
        <div style="font-size:12px;color:var(--text-muted)">
          Controle os critérios obrigatórios para cada contrato: seleção, pedidos, recebimento e desempenho.
          Itens com <span style="color:#dc2626;font-weight:700">*</span> são obrigatórios.
        </div>
      </div>
    </div>
    <div style="display:grid;gap:14px">
      ${lista.map(c => {
        const cl = checklistAll[c.id];
        const itens = cl?.itens || {};
        const obrigTotal = CM_ITEMS.filter(t=>t.obrigatorio).length;
        const obrigOk = CM_ITEMS.filter(t=>t.obrigatorio && itens[t.id]).length;
        const pct = obrigTotal > 0 ? Math.round(obrigOk/obrigTotal*100) : 0;
        const cor = pct===100 ? '#16a34a' : pct>=50 ? '#f59e0b' : '#dc2626';
        const status = pct===100 ? 'Conforme' : pct>=50 ? 'Em Andamento' : 'Pendente';
        return `
          <div style="background:var(--bg-card);border-radius:12px;border:1px solid var(--border-color);border-left:4px solid ${cor};overflow:hidden">
            <div style="padding:14px 18px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
              <div style="flex:1;min-width:180px">
                <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:4px">
                  <span style="font-size:14px;font-weight:700;color:var(--text-primary)">${c.id}</span>
                  <span style="font-size:11px;color:var(--text-muted)">${c.objeto||'—'}</span>
                  <span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;background:${cor}18;color:${cor}">${status}</span>
                </div>
                <div style="font-size:11px;color:var(--text-muted)">${c.fornecedor} · ${c.status}</div>
              </div>
              <div style="text-align:center;min-width:80px">
                <div style="font-size:22px;font-weight:900;color:${cor}">${pct}%</div>
                <div style="font-size:10px;color:var(--text-muted)">Obrigatórios</div>
              </div>
              <button onclick="cmAbrirChecklistContrato('${c.id}')" class="btn btn-primary btn-sm">
                <i class="fas fa-clipboard-check"></i> Gerenciar
              </button>
            </div>
            <div style="height:4px;background:var(--bg-tertiary)">
              <div style="height:100%;width:${pct}%;background:${cor};transition:width .5s ease"></div>
            </div>
          </div>`;
      }).join('')}
    </div>`;
}

// ─── ABA: CRITÉRIOS KPI ────────────────────────────────────────────────
function _ctrForRenderTabCriterios() {
  if (typeof cmRenderCriterios === 'function') {
    const criterios = typeof _getCriterios === 'function' ? _getCriterios() : [];
    return `
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-bottom:16px">
        <button class="btn btn-outline-primary btn-sm" onclick="cmGerarRelatorio()">
          <i class="fas fa-file-pdf"></i> Relatório
        </button>
        <button class="btn btn-primary btn-sm" onclick="cmAbrirNovoCriterio()">
          <i class="fas fa-plus"></i> Novo Critério KPI
        </button>
      </div>
      ${cmRenderCriterios(criterios)}`;
  }
  return `<div style="padding:40px;text-align:center;color:var(--text-muted)">
    <i class="fas fa-tasks" style="font-size:40px;opacity:0.3;margin-bottom:12px;display:block"></i>
    <p>Módulo de critérios não carregado. Acesse via menu <strong>Critérios de Medição</strong>.</p>
  </div>`;
}

// ─── ABA: GRÁFICO ──────────────────────────────────────────────────────
function _ctrForRenderTabGrafico(ativos) {
  if (!ativos.length) return `
    <div style="text-align:center;padding:60px;color:var(--text-muted)">
      <i class="fas fa-chart-bar" style="font-size:40px;opacity:0.3;display:block;margin-bottom:12px"></i>
      <p>Nenhum contrato ativo para exibir no gráfico.</p>
    </div>`;
  return `
    <div class="card page-section">
      <div class="card-header">
        <h3><i class="fas fa-chart-bar" style="color:var(--orange);margin-right:8px"></i>Saldo dos Contratos Ativos</h3>
      </div>
      <div class="card-body" style="height:300px"><canvas id="chartContratosFor"></canvas></div>
    </div>`;
}

function openNovoContratoFor() {
  openModalWide('Novo Contrato de Fornecimento', `
    <div class="form-row">
      <div class="form-group"><label>Fornecedor *</label>
        <input class="form-control" id="ncf_for" list="listaFornecedoresNovoCF" placeholder="Nome do fornecedor">
        <datalist id="listaFornecedoresNovoCF">${(FA_FORNECEDORES||[]).map(f=>`<option value="${f.razao_social}">`).join('')}</datalist>
      </div>
      <div class="form-group"><label>Tipo de Contrato *</label>
        <select class="form-control" id="ncf_tipo" onchange="toggleCamposContrato()">
          <option value="Contrato">Contrato (recorrente)</option>
          <option value="Spot">Spot (pontual)</option>
        </select>
      </div>
    </div>
    <div class="form-group"><label>Objeto do Contrato *</label><input class="form-control" id="ncf_obj" placeholder="Descreva o objeto do fornecimento"></div>
    <div class="form-row" id="camposContrato">
      <div class="form-group"><label>Valor Mensal (R$) *</label><input class="form-control" id="ncf_mensal" type="number" min="0" step="0.01" oninput="calcTotalContratoFor()"></div>
      <div class="form-group"><label>Duração (meses) *</label><input class="form-control" id="ncf_dur" type="number" min="1" oninput="calcTotalContratoFor()"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Início Vigência</label><input class="form-control" id="ncf_ini" type="date" value="${new Date().toISOString().split('T')[0]}"></div>
      <div class="form-group"><label>Fim Vigência</label><input class="form-control" id="ncf_fim" type="date"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Valor Total do Contrato (R$)</label><input class="form-control" id="ncf_total" type="number" min="0" step="0.01"></div>
      <div class="form-group"><label>Status</label>
        <select class="form-control" id="ncf_status"><option>Ativo</option><option>Pendente Assinatura</option><option>Encerrado</option></select>
      </div>
    </div>
    <div class="form-group"><label>Observações</label><textarea class="form-control" id="ncf_obs" rows="2" placeholder="Condições especiais, SLA, etc."></textarea></div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="salvarNovoContratoFor()"><i class="fas fa-save"></i> Salvar Contrato</button>
  `);
}

function calcTotalContratoFor() {
  const mensal = parseFloat(document.getElementById('ncf_mensal')?.value)||0;
  const dur = parseInt(document.getElementById('ncf_dur')?.value)||0;
  const totalEl = document.getElementById('ncf_total');
  if (totalEl && mensal && dur) totalEl.value = (mensal * dur).toFixed(2);
}

function toggleCamposContrato() {
  const tipo = document.getElementById('ncf_tipo')?.value;
  const camposContrato = document.getElementById('camposContrato');
  if (camposContrato) camposContrato.style.display = tipo === 'Spot' ? 'none' : '';
}

function salvarNovoContratoFor() {
  const ok = _validarCampos([
    { id:'ncf_for',    label:'Fornecedor',    required:true },
    { id:'ncf_obj',    label:'Objeto',        required:true, minLen:5 },
    { id:'ncf_mensal', label:'Valor Mensal',  required:true, minVal:0.01 },
    { id:'ncf_dur',    label:'Duração (meses)', required:true, minVal:1 },
    { id:'ncf_ini',    label:'Início',        required:true },
  ]);
  if (!ok) return;

  const fornecedor = document.getElementById('ncf_for').value.trim();
  const objeto     = document.getElementById('ncf_obj').value.trim();
  const ini        = document.getElementById('ncf_ini').value;
  const fim        = document.getElementById('ncf_fim').value;
  const lista      = _getContratosFor();
  lista.unshift({
    id: `CF-${new Date().getFullYear()}-${String(lista.length+1).padStart(3,'0')}`,
    fornecedor,
    objeto,
    tipo: document.getElementById('ncf_tipo').value,
    valor_mensal: parseFloat(document.getElementById('ncf_mensal')?.value)||0,
    duracao_meses: parseInt(document.getElementById('ncf_dur')?.value)||0,
    inicio: ini ? new Date(ini+'T12:00:00').toLocaleDateString('pt-BR') : '—',
    fim: fim ? new Date(fim+'T12:00:00').toLocaleDateString('pt-BR') : '',
    saldo_total: parseFloat(document.getElementById('ncf_total')?.value)||0,
    saldo_pago: 0,
    status: document.getElementById('ncf_status').value,
    observacoes: document.getElementById('ncf_obs').value.trim(),
    gestor: currentUser?.name || '',
    criado_em: new Date().toISOString()
  });
  _saveContratosFor(lista);
  closeModal();
  showToast('Contrato de fornecimento cadastrado!', 'success');
  renderContratosFor();
}

function editarContratoFor(id) {
  const lista = _getContratosFor();
  const c = lista.find(x=>x.id===id);
  if (!c) return;
  openModalWide(`Editar Contrato – ${id}`, `
    <div class="form-group"><label>Fornecedor</label><input class="form-control" id="ecf_for" value="${c.fornecedor}"></div>
    <div class="form-group"><label>Objeto</label><input class="form-control" id="ecf_obj" value="${c.objeto}"></div>
    <div class="form-row">
      <div class="form-group"><label>Tipo</label>
        <select class="form-control" id="ecf_tipo"><option ${c.tipo==='Contrato'?'selected':''}>Contrato</option><option ${c.tipo==='Spot'?'selected':''}>Spot</option></select>
      </div>
      <div class="form-group"><label>Status</label>
        <select class="form-control" id="ecf_status">
          ${['Ativo','Pendente Assinatura','Encerrado','Suspenso'].map(s=>`<option ${c.status===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Valor Mensal (R$)</label><input class="form-control" id="ecf_mensal" type="number" value="${c.valor_mensal||0}"></div>
      <div class="form-group"><label>Saldo Total (R$)</label><input class="form-control" id="ecf_total" type="number" value="${c.saldo_total||0}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Saldo Pago (R$)</label><input class="form-control" id="ecf_pago" type="number" value="${c.saldo_pago||0}"></div>
      <div class="form-group"><label>Vigência Fim</label><input class="form-control" id="ecf_fim" type="text" value="${c.fim||''}"></div>
    </div>
    <div class="form-group"><label>Observações</label><textarea class="form-control" id="ecf_obs" rows="2">${c.observacoes||''}</textarea></div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="salvarEdicaoContratoFor('${id}')"><i class="fas fa-save"></i> Salvar</button>
  `);
}

function salvarEdicaoContratoFor(id) {
  const lista = _getContratosFor();
  const idx = lista.findIndex(x=>x.id===id);
  if (idx<0) return;
  lista[idx] = { ...lista[idx],
    fornecedor: document.getElementById('ecf_for').value.trim(),
    objeto: document.getElementById('ecf_obj').value.trim(),
    tipo: document.getElementById('ecf_tipo').value,
    status: document.getElementById('ecf_status').value,
    valor_mensal: parseFloat(document.getElementById('ecf_mensal').value)||0,
    saldo_total: parseFloat(document.getElementById('ecf_total').value)||0,
    saldo_pago: parseFloat(document.getElementById('ecf_pago').value)||0,
    fim: document.getElementById('ecf_fim').value.trim(),
    observacoes: document.getElementById('ecf_obs').value.trim()
  };
  _saveContratosFor(lista);
  closeModal();
  showToast('Contrato atualizado!', 'success');
  renderContratosFor();
}

function lancarPagamentoContrato(id) {
  const c = _getContratosFor().find(x=>x.id===id);
  if (!c) return;
  openModal(`Lançar Pagamento – ${id}`, `
    <div style="margin-bottom:12px;font-size:12px;color:var(--text-secondary)">
      <strong>${c.fornecedor}</strong> · ${c.objeto}<br>
      Saldo Disponível: <strong style="color:var(--fa-teal)">${fmt((c.saldo_total||0)-(c.saldo_pago||0))}</strong>
    </div>
    <div class="form-group"><label>Valor do Pagamento (R$) *</label><input class="form-control" id="lp_val" type="number" min="0" step="0.01" placeholder="0,00"></div>
    <div class="form-group"><label>Data do Pagamento</label><input class="form-control" id="lp_data" type="date" value="${new Date().toISOString().split('T')[0]}"></div>
    <div class="form-group"><label>Descrição</label><input class="form-control" id="lp_desc" placeholder="Ex: Parcela Mar/2025"></div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="confirmarPagamentoContrato('${id}')"><i class="fas fa-dollar-sign"></i> Confirmar</button>
  `);
}

function confirmarPagamentoContrato(id) {
  const val = parseFloat(document.getElementById('lp_val').value)||0;
  if (!val) { showToast('Informe o valor', 'warning'); return; }
  const lista = _getContratosFor();
  const idx = lista.findIndex(x=>x.id===id);
  if (idx<0) return;
  lista[idx].saldo_pago = (lista[idx].saldo_pago||0) + val;
  if (lista[idx].saldo_pago >= lista[idx].saldo_total) lista[idx].status = 'Encerrado';
  _saveContratosFor(lista);
  logAction('Pagamento Contrato', 'Suprimentos', `Pagamento de ${fmt(val)} lançado no contrato ${id}`);
  closeModal();
  showToast(`Pagamento de ${fmt(val)} registrado!`, 'success');
  renderContratosFor();
}

function exportarRelContratoFor(id) {
  const c = _getContratosFor().find(x=>x.id===id);
  if (!c) return;
  const saldo = (c.saldo_total||0) - (c.saldo_pago||0);
  const txt = `FRASER ALEXANDER – RELATÓRIO DE CONTRATO DE FORNECIMENTO\n${'='.repeat(56)}\nID: ${c.id}\nFornecedor: ${c.fornecedor}\nObjeto: ${c.objeto}\nTipo: ${c.tipo}\nStatus: ${c.status}\nVigência: ${c.inicio} → ${c.fim||'—'}\nValor Mensal: ${fmt(c.valor_mensal)}\nSaldo Total: ${fmt(c.saldo_total)}\nTotal Pago: ${fmt(c.saldo_pago)}\nSaldo Disponível: ${fmt(saldo)}\nObservações: ${c.observacoes||'—'}\n${'='.repeat(56)}\nEmitido em: ${new Date().toLocaleDateString('pt-BR')} por ${currentUser?.name||'—'}`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([txt],{type:'text/plain;charset=utf-8'}));
  a.download = `Contrato_${id}_${new Date().toISOString().split('T')[0]}.txt`;
  a.click();
  showToast('Relatório exportado!', 'success');
}

function exportarContratosFor() {
  const lista = _getContratosFor();
  const csv = [['ID','Fornecedor','Objeto','Tipo','Valor Mensal','Início','Fim','Saldo Total','Saldo Pago','Saldo Disp.','Status'],
    ...lista.map(c=>[c.id,c.fornecedor,c.objeto,c.tipo,c.valor_mensal,c.inicio,c.fim||'—',c.saldo_total,c.saldo_pago,(c.saldo_total||0)-(c.saldo_pago||0),c.status])
  ].map(r=>r.map(c=>`"${c}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));
  a.download = `Contratos_Fornecimento_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  showToast('Contratos exportados!', 'success');
}

// ─── EXPORTS GLOBAIS – Emissão de Requisições ────────────────────────────────
window.renderRequisicoes      = renderRequisicoes;
window._reqSwitchTab          = _reqSwitchTab;
window._reqFiltrarStatus      = _reqFiltrarStatus;
window._reqAdaptarRC          = _reqAdaptarRC;
window._reqGetRC              = _reqGetRC;
window._reqSaveRC             = _reqSaveRC;
window._reqCarregarRCsAPI     = _reqCarregarRCsAPI;
window._reqFiltrarTexto       = _reqFiltrarTexto;
window._reqFiltrarOS          = _reqFiltrarOS;
window._reqFiltrarOsPanel     = _reqFiltrarOsPanel;
window._reqToggleRCsOS        = _reqToggleRCsOS;
window._reqExportarRC         = _reqExportarRC;
window._reqVerDetalheOS       = _reqVerDetalheOS;
window.reqVerDetalheRC        = reqVerDetalheRC;
window.reqEditarRC            = reqEditarRC;
window.reqAbrirNovaRCdeOS     = reqAbrirNovaRCdeOS;
window.reqEmitirRCAvulsa      = reqEmitirRCAvulsa;
window._reqRenderOSCards      = _reqRenderOSCards;
window.reqAprovarRC           = reqAprovarRC;
window._reqConfirmarAprovarRC = _reqConfirmarAprovarRC;

// ─── EXPORTS GLOBAIS – Contratos de Fornecimento ─────────────────────────────
window.renderContratosFor         = renderContratosFor;
window._ctrForRenderTabContratos  = _ctrForRenderTabContratos;
window._ctrForRenderTabChecklist  = _ctrForRenderTabChecklist;
window._ctrForRenderTabCriterios  = _ctrForRenderTabCriterios;
window._ctrForRenderTabGrafico    = _ctrForRenderTabGrafico;
window.openNovoContratoFor        = openNovoContratoFor;
window.calcTotalContratoFor       = calcTotalContratoFor;
window.salvarNovoContratoFor      = salvarNovoContratoFor;
window.editarContratoFor          = editarContratoFor;
window.salvarEdicaoContratoFor    = salvarEdicaoContratoFor;
window.lancarPagamentoContrato    = lancarPagamentoContrato;
window.salvarPagamentoContrato    = confirmarPagamentoContrato;
window.exportarRelContratoFor     = exportarRelContratoFor;
window.exportarContratosFor       = exportarContratosFor;
window.toggleCamposContrato       = toggleCamposContrato;

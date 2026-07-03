// =====================================================
// ERP Serviços e Operações — Módulo Contratos
// Horizontal para serviços e operações — parametrizável por segmento
// =====================================================

// ─── TIPOS DE CONTRATO PARAMETRIZÁVEIS ────────────────────────────────────────
// Os tipos são carregados de configuração (localStorage) ou usam o padrão abaixo.
// Para customizar: ir em Configurações → Parâmetros → Tipos de Contrato
function _ctrGetTiposContrato() {
  try {
    const cfg = JSON.parse(localStorage.getItem('erp_cfg_tipos_contrato') || 'null');
    if (Array.isArray(cfg) && cfg.length) return cfg;
  } catch(e) {}
  return [
    'Manutenção Industrial', 'Operação com Equipes', 'Serviços Técnicos Especializados',
    'Facilities', 'Engenharia e Execução', 'Utilidades', 'Logística Operacional',
    'Serviços Ambientais', 'Locação com Operação', 'Contrato Recorrente',
    'Contrato Spot', 'Serviços por SLA', 'Prestação de Serviços por Produtividade',
    'Prestação de Serviços por Volume', 'Prestação por Homem-Hora',
    'Subcontratação', 'Consultoria Técnica', 'Mineração / Campo'
  ];
}
function _ctrTiposOpts(selected) {
  return _ctrGetTiposContrato().map(t =>
    `<option value="${t}" ${t===selected?'selected':''}>${t}</option>`
  ).join('');
}


// ── Contratos REAIS (cache do servidor via boot do db.js) ─────────────────
// Normaliza o shape do backend (titulo/valor_total/objeto/responsavel_nome)
// para o que a página usa, e mescla com o seed demo (reais primeiro).
function _ctrContratos() {
  let reais = [];
  try { reais = JSON.parse(localStorage.getItem('fa_contratos') || '[]'); } catch (e) {}
  const norm = reais.map(c => ({
    id: c.id, numero: c.numero || String(c.id),
    cliente: c.cliente || c.titulo || c.fornecedor_nome || '—',
    descricao: c.descricao || c.objeto || '',
    tipo: c.tipo || 'Serviço',
    valor: c.valor ?? c.valor_total ?? 0,
    medidoAcum: c.medidoAcum ?? c.valor_medido_acumulado ?? 0,
    status: c.status || 'Ativo',
    inicio: c.inicio || c.data_inicio || '', fim: c.fim || c.data_fim || '',
    gestor: c.gestor || c.responsavel_nome || '—', unidade: c.unidade || '—',
    margem: c.margem ?? 0, progress: c.progress ?? 0, ssmaStatus: c.ssmaStatus || 'N/A',
    _servidor: !c._local, _local: !!c._local,
  }));
  const seed = (window.ERP_DATA && ERP_DATA.contratos) || [];
  if (!norm.length) return seed;
  const ids = new Set(norm.map(c => String(c.id)));
  return [...norm, ...seed.filter(c => !ids.has(String(c.id)))];
}
function _ctrById(id) { return _ctrContratos().find(x => String(x.id) === String(id)) || null; }
window._ctrContratos = _ctrContratos;

function renderContratos() {
  const main = document.getElementById('mainContent');

  const contratos = _ctrContratos();
  const ativos = contratos.filter(c => c.status === 'Ativo').length;
  const valorTotal = contratos.filter(c => c.status !== 'Encerrado').reduce((a, b) => a + (b.valor || 0), 0);
  const medidoTotal = contratos.filter(c => c.status !== 'Encerrado').reduce((a, b) => a + (b.medidoAcum || 0), 0);
  const saldoTotal = valorTotal - medidoTotal;

  main.innerHTML = `
    <div class="page-header">
      <div class="page-title">
        <h2>Gestão de Contratos</h2>
        <p>${contratos.length} contratos cadastrados · ${ativos} ativos</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary btn-sm" onclick="showToast('Exportando contratos...','info')">
          <i class="fas fa-download"></i> Exportar
        </button>
        <button class="btn btn-outline-primary btn-sm" onclick="ctrAgendarReuniao()">
          <i class="fas fa-calendar-plus"></i> Agendar Reunião
        </button>
        <button class="btn btn-primary btn-sm" onclick="openNovoContrato()">
          <i class="fas fa-plus"></i> Novo Contrato
        </button>
      </div>
    </div>

    <!-- Alertas de Vencimento -->
    <div id="ctr_alertas_vencimento"></div>

    <!-- KPIs de Contratos -->
    <div class="kpi-grid" style="grid-template-columns: repeat(4, 1fr)">
      <div class="kpi-card kpi-blue">
        <div class="kpi-icon"><i class="fas fa-file-signature"></i></div>
        <div class="kpi-value">${ativos}</div>
        <div class="kpi-label">Contratos Ativos</div>
      </div>
      <div class="kpi-card kpi-orange">
        <div class="kpi-icon"><i class="fas fa-dollar-sign"></i></div>
        <div class="kpi-value">${fmtK(valorTotal)}</div>
        <div class="kpi-label">Valor Total Carteira</div>
      </div>
      <div class="kpi-card kpi-green">
        <div class="kpi-icon"><i class="fas fa-chart-line"></i></div>
        <div class="kpi-value">${fmtK(medidoTotal)}</div>
        <div class="kpi-label">Medido Acumulado</div>
      </div>
      <div class="kpi-card kpi-teal">
        <div class="kpi-icon"><i class="fas fa-balance-scale"></i></div>
        <div class="kpi-value">${fmtK(saldoTotal)}</div>
        <div class="kpi-label">Saldo a Executar</div>
      </div>
    </div>

    <!-- Filtros -->
    <div class="card page-section">
      <div class="search-bar">
        <div class="search-input-wrapper">
          <i class="fas fa-search"></i>
          <input class="search-input" type="text" placeholder="Buscar por cliente, contrato ou gestor..." id="searchContratos" oninput="filterContratos()">
        </div>
        <select class="filter-select" id="filterStatus" onchange="filterContratos()">
          <option value="">Todos os Status</option>
          <option>Ativo</option>
          <option>Mobilização</option>
          <option>Encerrado</option>
          <option>Suspenso</option>
        </select>
        <select class="filter-select" id="filterTipo" onchange="filterContratos()">
          <option value="">Todos os Tipos</option>
          ${_ctrTiposOpts('')}
        </select>
      </div>

      <div class="table-wrapper" id="tabelaContratos">
        ${renderTabelaContratos(contratos)}
      </div>
    </div>

    <!-- Detalhe do contrato destacado -->
    <div class="card page-section" id="detalheContrato" style="display:none"></div>
  `;
  // Injetar alertas de vencimento
  if (typeof ctrRenderAlertasVencimento === 'function') ctrRenderAlertasVencimento('ctr_alertas_vencimento');
}

function renderTabelaContratos(contratos) {
  const isAdmin = currentUser && currentUser.profile === 'admin';
  const canEdit = currentUser && ['admin','diretor','operacao'].includes(currentUser.profile);
  return `
    <table>
      <thead>
        <tr>
          <th>ID</th>
          <th>Cliente</th>
          <th>Descrição / Tipo</th>
          <th>Gestor</th>
          <th>Vigência</th>
          <th>Valor</th>
          <th>Progresso</th>
          <th>SSMA</th>
          <th>Status do Projeto</th>
          <th>Ações</th>
        </tr>
      </thead>
      <tbody>
        ${contratos.map(c => `
          <tr>
            <td><span style="color:var(--orange);font-weight:600;font-size:12px">${c.id}</span></td>
            <td>
              <div style="font-weight:600">${c.cliente}</div>
              <div style="font-size:11px;color:var(--text-muted)">${c.unidade}</div>
            </td>
            <td>
              <div style="font-size:12px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.descricao}</div>
              <span class="badge badge-muted" style="margin-top:3px">${c.tipo}</span>
            </td>
            <td style="font-size:12px">${c.gestor}</td>
            <td>
              <div style="font-size:12px;color:var(--text-secondary)">${c.inicio}</div>
              <div style="font-size:12px;color:var(--text-muted)">até ${c.fim}</div>
            </td>
            <td>
              <div style="font-weight:600;font-size:13px">${fmtK(c.valor)}</div>
              <div style="font-size:11px;color:var(--green-light)">Margem: ${c.margem}%</div>
            </td>
            <td style="min-width:100px">
              <div style="font-size:12px;font-weight:600;margin-bottom:3px">${c.progress}%</div>
              <div class="progress"><div class="progress-bar ${c.progress >= 80 ? 'green' : ''}" style="width:${c.progress}%"></div></div>
            </td>
            <td>${statusBadge(c.ssmaStatus)}</td>
            <td>
              ${canEdit ? `
                <select onchange="alterarStatusContrato('${c.id}', this.value)"
                  style="padding:3px 8px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:6px;color:var(--text-primary);font-size:12px;cursor:pointer">
                  ${['Ativo','Mobilização','Suspenso','Encerrado'].map(s =>
                    `<option ${c.status===s?'selected':''}>${s}</option>`
                  ).join('')}
                </select>
              ` : statusBadge(c.status)}
            </td>
            <td>
              <div class="actions-cell">
                <button class="btn btn-secondary btn-sm btn-icon" onclick="verDetalheContrato('${c.id}')" title="Ver detalhes">
                  <i class="fas fa-eye"></i>
                </button>
                <button class="btn btn-info btn-sm btn-icon" onclick="editarContrato('${c.id}')" title="Editar contrato">
                  <i class="fas fa-edit"></i>
                </button>
                ${isAdmin ? `
                  <button class="btn btn-danger btn-sm btn-icon" onclick="excluirContrato('${c.id}')" title="Excluir contrato (Admin)">
                    <i class="fas fa-trash"></i>
                  </button>
                ` : ''}
              </div>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

// Alterar status do contrato (Gestor de Operações / Admin / Diretor)
function alterarStatusContrato(id, novoStatus) {
  const c = ERP_DATA.contratos.find(x => x.id === id);
  if (!c) return;
  const anterior = c.status;
  c.status = novoStatus;
  logAction('Editar', 'Contratos', `Contrato ${id}: status alterado de ${anterior} para ${novoStatus}`);
  showToast(`Status do contrato ${id} atualizado para: ${novoStatus}`, 'success');
  // Atualiza contagem na sidebar
  const badge = document.getElementById('badge-contratos');
  if (badge) badge.textContent = ERP_DATA.contratos.filter(c => c.status === 'Ativo').length;
}

// Excluir contrato (somente Admin)
function excluirContrato(id) {
  if (!currentUser || currentUser.profile !== 'admin') {
    showToast('Apenas o Administrador pode excluir contratos.', 'error');
    return;
  }
  const c = ERP_DATA.contratos.find(x => x.id === id);
  if (!c) return;
  confirmarAcao(
    'Excluir Contrato',
    `Tem certeza que deseja excluir o contrato <strong>${id}</strong> – ${c.cliente}? Esta ação não pode ser desfeita e removerá todos os dados vinculados.`,
    `_confirmarExclusaoContrato('${id}')`,
    true
  );
}

function _confirmarExclusaoContrato(id) {
  const idx = ERP_DATA.contratos.findIndex(x => x.id === id);
  if (idx < 0) return;
  const cliente = ERP_DATA.contratos[idx].cliente;
  ERP_DATA.contratos.splice(idx, 1);
  logAction('Excluir', 'Contratos', `Contrato ${id} (${cliente}) excluído pelo Admin`);
  showToast(`Contrato ${id} excluído com sucesso.`, 'warning');
  renderContratos();
}

// Editar contrato
function editarContrato(id) {
  const c = _ctrById(id);
  if (!c) return;
  const canEdit = currentUser && ['admin','diretor','operacao'].includes(currentUser.profile);
  if (!canEdit) { showToast('Sem permissão para editar contratos.', 'error'); return; }

  openModalWide('Editar Contrato – ' + c.id, `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Cliente *</label>
        <input type="text" id="ecCliente" value="${c.cliente}" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
      </div>
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Tipo de Serviço</label>
        <select id="ecTipo" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
          ${['Manutenção','Operação','Técnico','Elétrico','Industrial','Construção','Serviços'].map(t=>`<option ${c.tipo===t?'selected':''}>${t}</option>`).join('')}
        </select>
      </div>
      <div style="grid-column:1/-1">
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Objeto / Descrição</label>
        <input type="text" id="ecDescricao" value="${c.descricao}" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
      </div>
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Valor Contratual (R$)</label>
        <input type="number" id="ecValor" value="${c.valor}" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
      </div>
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Margem Prevista (%)</label>
        <input type="number" id="ecMargem" value="${c.margem}" min="0" max="100" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
      </div>
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Gestor Responsável</label>
        <input type="text" id="ecGestor" value="${c.gestor}" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
      </div>
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Unidade / Localização</label>
        <input type="text" id="ecUnidade" value="${c.unidade}" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
      </div>
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Status do Projeto</label>
        <select id="ecStatus" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
          ${['Ativo','Mobilização','Suspenso','Encerrado'].map(s=>`<option ${c.status===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </div>
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Status SSMA</label>
        <select id="ecSsma" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
          ${['Conforme','Alerta','Pendente','N/A'].map(s=>`<option ${c.ssmaStatus===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </div>
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Progresso (%)</label>
        <input type="number" id="ecProgress" value="${c.progress}" min="0" max="100" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
      </div>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="salvarEdicaoContrato('${id}')"><i class="fas fa-save"></i> Salvar Alterações</button>
  `);
}

async function salvarEdicaoContrato(id) {
  const seed = (window.ERP_DATA && ERP_DATA.contratos || []).find(x => x.id === id);
  const c = seed || _ctrById(id);
  if (!c) return;
  const val = (el, cur) => document.getElementById(el)?.value ?? cur;
  c.cliente = val('ecCliente', c.cliente);
  c.tipo = val('ecTipo', c.tipo);
  c.descricao = val('ecDescricao', c.descricao);
  c.valor = parseFloat(val('ecValor', c.valor)) || 0;
  c.margem = parseFloat(val('ecMargem', c.margem)) || 0;
  c.gestor = val('ecGestor', c.gestor);
  c.unidade = val('ecUnidade', c.unidade);
  c.status = val('ecStatus', c.status);
  c.ssmaStatus = val('ecSsma', c.ssmaStatus);
  c.progress = parseInt(val('ecProgress', c.progress)) || 0;
  // Contrato REAL (cache do servidor): persiste via PUT e atualiza o cache.
  if (!seed) {
    try {
      if (window.NexusAPI) {
        await NexusAPI.put(`/api/contratos/${id}`, {
          titulo: c.cliente, tipo: c.tipo, status: c.status,
          valor_total: c.valor, data_inicio: c.inicio || null, data_fim: c.fim || null,
          objeto: c.descricao,
        });
      }
    } catch (e) { /* offline → mantém só o cache local */ }
    try {
      const cache = JSON.parse(localStorage.getItem('fa_contratos') || '[]');
      const i = cache.findIndex(x => String(x.id) === String(id));
      if (i >= 0) { cache[i] = { ...cache[i], titulo: c.cliente, tipo: c.tipo, status: c.status, valor_total: c.valor, objeto: c.descricao, gestor: c.gestor, unidade: c.unidade, margem: c.margem, progress: c.progress, ssmaStatus: c.ssmaStatus }; localStorage.setItem('fa_contratos', JSON.stringify(cache)); }
    } catch (e) {}
  }
  logAction('Editar', 'Contratos', `Contrato ${id} editado`);
  closeModal();
  showToast(`Contrato ${id} atualizado com sucesso!`, 'success');
  renderContratos();
}

function filterContratos() {
  const search = document.getElementById('searchContratos').value.toLowerCase();
  const status = document.getElementById('filterStatus').value;
  const tipo = document.getElementById('filterTipo').value;

  let filtered = _ctrContratos().filter(c => {
    const matchSearch = !search || c.cliente.toLowerCase().includes(search) ||
      c.id.toLowerCase().includes(search) || c.gestor.toLowerCase().includes(search) ||
      c.descricao.toLowerCase().includes(search);
    const matchStatus = !status || c.status === status;
    const matchTipo = !tipo || c.tipo === tipo;
    return matchSearch && matchStatus && matchTipo;
  });

  document.getElementById('tabelaContratos').innerHTML = renderTabelaContratos(filtered);
}

function verDetalheContrato(id) {
  const c = _ctrById(id);
  if (!c) return;

  const detalhe = document.getElementById('detalheContrato');
  detalhe.style.display = 'block';

  // Calcula dados financeiros
  const saldo = c.valor - c.medidoAcum;
  const lucro = c.medidoAcum - c.custoAcum;

  detalhe.innerHTML = `
    <div class="card-header">
      <div>
        <h3><i class="fas fa-file-contract" style="color:var(--orange);margin-right:8px"></i>${c.id} — ${c.cliente}</h3>
        <p style="font-size:12px;color:var(--text-muted);margin-top:3px">${c.descricao}</p>
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        ${statusBadge(c.status)}
        ${currentUser && ['admin','diretor','operacao'].includes(currentUser.profile) ? `
          <button class="btn btn-secondary btn-sm" onclick="editarContrato('${c.id}')"><i class="fas fa-edit"></i> Editar</button>
        ` : ''}
        ${currentUser && currentUser.profile === 'admin' ? `
          <button class="btn btn-danger btn-sm" onclick="excluirContrato('${c.id}')"><i class="fas fa-trash"></i></button>
        ` : ''}
        <button class="btn btn-secondary btn-sm" onclick="document.getElementById('detalheContrato').style.display='none'">
          <i class="fas fa-times"></i>
        </button>
      </div>
    </div>

    <!-- Tabs simuladas -->
    <div style="padding:0 20px">
      <div class="tabs" style="margin-bottom:0">
        <button class="tab-btn active" id="tabVisao" onclick="switchTabContrato('visao')">Visão Geral</button>
        <button class="tab-btn" id="tabWbs" onclick="switchTabContrato('wbs')"><i class="fas fa-sitemap" style="margin-right:4px"></i>WBS / Custos</button>
        <button class="tab-btn" id="tabItens" onclick="switchTabContrato('itens')">Itens Contratuais</button>
        <button class="tab-btn" id="tabMedicoes" onclick="switchTabContrato('medicoes')">Medições</button>
        <button class="tab-btn" id="tabOS" onclick="switchTabContrato('os')">OS</button>
        <button class="tab-btn" id="tabEquipe" onclick="switchTabContrato('equipe')">Equipe</button>
        <button class="tab-btn" id="tabFinanceiro" onclick="switchTabContrato('financeiro')">Financeiro</button>
      </div>
    </div>

    <div id="tabContentContrato" style="padding:20px">
      ${renderTabVisaoContrato(c, saldo, lucro)}
    </div>
  `;

  // Scroll suave
  detalhe.scrollIntoView({ behavior: 'smooth', block: 'start' });
  window._contratoAtivo = c;
  window._contratoSaldo = saldo;
  window._contratoLucro = lucro;
}

function switchTabContrato(tab) {
  document.querySelectorAll('#detalheContrato .tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab' + tab.charAt(0).toUpperCase() + tab.slice(1)).classList.add('active');

  const c = window._contratoAtivo;
  const content = document.getElementById('tabContentContrato');

  if (tab === 'visao') content.innerHTML = renderTabVisaoContrato(c, window._contratoSaldo, window._contratoLucro);
  else if (tab === 'wbs') { content.innerHTML = renderTabWBSContrato(c); setTimeout(() => _renderContratoWBSTree(c), 50); }
  else if (tab === 'itens') content.innerHTML = renderTabItensContrato(c);
  else if (tab === 'medicoes') content.innerHTML = renderTabMedicoesContrato(c);
  else if (tab === 'os') content.innerHTML = renderTabOSContrato(c);
  else if (tab === 'equipe') content.innerHTML = renderTabEquipeContrato(c);
  else if (tab === 'financeiro') content.innerHTML = renderTabFinanceiroContrato(c);
}

function renderTabVisaoContrato(c, saldo, lucro) {
  return `
    <div class="grid-3">
      <!-- Info -->
      <div>
        <div class="section-divider"><h4>Informações</h4></div>
        <div class="stat-row"><span class="stat-label">Cliente</span><span class="stat-value">${c.cliente}</span></div>
        <div class="stat-row"><span class="stat-label">Unidade / Mina</span><span class="stat-value">${c.unidade}</span></div>
        <div class="stat-row"><span class="stat-label">Tipo de Serviço</span><span class="stat-value">${c.tipo}</span></div>
        <div class="stat-row"><span class="stat-label">Início</span><span class="stat-value">${c.inicio}</span></div>
        <div class="stat-row"><span class="stat-label">Término</span><span class="stat-value">${c.fim}</span></div>
        <div class="stat-row"><span class="stat-label">Gestor</span><span class="stat-value">${c.gestor}</span></div>
        <div class="stat-row"><span class="stat-label">Equipe Alocada</span><span class="stat-value">${c.equipe} colaboradores</span></div>
        <div class="stat-row"><span class="stat-label">Equipamentos</span><span class="stat-value">${c.equipamentos} unidades</span></div>
      </div>

      <!-- Financeiro -->
      <div>
        <div class="section-divider"><h4>Financeiro</h4></div>
        <div class="stat-row"><span class="stat-label">Valor Contratual</span><span class="stat-value" style="color:var(--blue-light)">${fmt(c.valor)}</span></div>
        <div class="stat-row"><span class="stat-label">Medido Acumulado</span><span class="stat-value" style="color:var(--orange)">${fmt(c.medidoAcum)}</span></div>
        <div class="stat-row"><span class="stat-label">Custo Acumulado</span><span class="stat-value" style="color:var(--red-light)">${fmt(c.custoAcum)}</span></div>
        <div class="stat-row"><span class="stat-label">Lucro Bruto</span><span class="stat-value" style="color:var(--green-light)">${fmt(lucro)}</span></div>
        <div class="stat-row"><span class="stat-label">Saldo a Executar</span><span class="stat-value">${fmt(saldo)}</span></div>
        <div class="stat-row">
          <span class="stat-label">Margem Real</span>
          <span class="stat-value" style="color:var(--green-light)">${c.margem}%</span>
        </div>
        <div style="margin-top:10px">
          <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px">Progresso Financeiro</div>
          <div class="progress" style="height:8px">
            <div class="progress-bar" style="width:${c.progress}%"></div>
          </div>
          <div style="font-size:11px;color:var(--text-secondary);margin-top:3px">${c.progress}% executado</div>
        </div>
      </div>

      <!-- SSMA e Alertas -->
      <div>
        <div class="section-divider"><h4>SSMA e Conformidade</h4></div>
        <div class="stat-row"><span class="stat-label">Status SSMA</span>${statusBadge(c.ssmaStatus)}</div>
        <div class="stat-row"><span class="stat-label">Incidentes no Mês</span><span class="stat-value">1</span></div>
        <div class="stat-row"><span class="stat-label">Auditoria Pendente</span><span class="stat-value">Não</span></div>
        <div class="stat-row"><span class="stat-label">Docs. Vencidos</span>
          <span class="stat-value" style="color:var(--green-light)">OK</span>
        </div>
        <div style="margin-top:12px">
          <div class="alert alert-${c.ssmaStatus === 'Conforme' ? 'success' : c.ssmaStatus === 'Alerta' ? 'warning' : 'warning'}">
            <span class="alert-icon"><i class="fas fa-${c.ssmaStatus === 'Conforme' ? 'check-circle' : 'exclamation-triangle'}"></i></span>
            <div>
              <div class="alert-title">SSMA: ${c.ssmaStatus}</div>
              <div class="alert-desc">
                ${c.ssmaStatus === 'Conforme' ? 'Toda documentação e treinamentos em dia' :
                  c.ssmaStatus === 'Alerta' ? 'Documentos pendentes de atualização' :
                  'Mobilização em andamento – pendências esperadas'}
              </div>
            </div>
          </div>
        </div>
        <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-secondary btn-sm" onclick="navigate('os')">
            <i class="fas fa-clipboard-list"></i> Ver OS
          </button>
          <button class="btn btn-secondary btn-sm" onclick="navigate('medicao')">
            <i class="fas fa-ruler-combined"></i> Medições
          </button>
          <button class="btn btn-secondary btn-sm" onclick="navigate('ssma')">
            <i class="fas fa-hard-hat"></i> SSMA
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderTabItensContrato(c) {
  const itens = [
    { cod: '001', desc: 'Mão de Obra – Mecânico de Manutenção', un: 'HH', qtdContr: 4800, qtdExec: c.progress * 48, preco: 85, total: 85 * 4800 },
    { cod: '002', desc: 'Mão de Obra – Eletricista Industrial', un: 'HH', qtdContr: 2400, qtdExec: c.progress * 24, preco: 95, total: 95 * 2400 },
    { cod: '003', desc: 'Mão de Obra – Supervisor', un: 'HH', qtdContr: 1200, qtdExec: c.progress * 12, preco: 120, total: 120 * 1200 },
    { cod: '004', desc: 'Operação de Caminhão Munck', un: 'Hora', qtdContr: 600, qtdExec: c.progress * 6, preco: 350, total: 350 * 600 },
    { cod: '005', desc: 'Fornecimento de Materiais de Consumo', un: 'Vb', qtdContr: 1, qtdExec: c.progress / 100, preco: 180000, total: 180000 }
  ];

  return `
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Cód.</th>
            <th>Descrição do Serviço</th>
            <th>Un.</th>
            <th>Qtd. Contratada</th>
            <th>Qtd. Executada</th>
            <th>Saldo</th>
            <th>Preço Unit.</th>
            <th>Valor Total</th>
            <th>% Exec.</th>
          </tr>
        </thead>
        <tbody>
          ${itens.map(i => {
            const exec = Math.round(i.qtdExec);
            const saldo = i.qtdContr - exec;
            const pct = Math.round((exec / i.qtdContr) * 100);
            return `
              <tr>
                <td style="color:var(--text-muted);font-size:12px">${i.cod}</td>
                <td style="font-size:13px">${i.desc}</td>
                <td>${i.un}</td>
                <td>${i.qtdContr.toLocaleString('pt-BR')}</td>
                <td style="color:var(--orange);font-weight:500">${exec.toLocaleString('pt-BR')}</td>
                <td style="color:var(--text-secondary)">${saldo.toLocaleString('pt-BR')}</td>
                <td>R$ ${i.preco.toLocaleString('pt-BR')}</td>
                <td style="font-weight:600">${fmtK(i.total)}</td>
                <td>
                  <div style="display:flex;align-items:center;gap:6px">
                    <span style="font-size:12px;font-weight:600;min-width:32px">${pct}%</span>
                    <div class="progress" style="flex:1;min-width:60px">
                      <div class="progress-bar" style="width:${pct}%"></div>
                    </div>
                  </div>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderTabMedicoesContrato(c) {
  const meds = ERP_DATA.medicoes.filter(m => m.contrato === c.id);
  if (!meds.length) return `<div class="empty-state"><i class="fas fa-ruler-combined"></i><p>Nenhuma medição registrada</p></div>`;

  return `
    <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
      <button class="btn btn-primary btn-sm" onclick="showToast('Abrindo nova medição...','info')">
        <i class="fas fa-plus"></i> Nova Medição
      </button>
    </div>
    <div class="table-wrapper">
      <table>
        <thead>
          <tr><th>ID</th><th>Competência</th><th>Valor Bruto</th><th>Glosa</th><th>Valor Líquido</th><th>Envio</th><th>Prev. Pgto.</th><th>Status</th></tr>
        </thead>
        <tbody>
          ${meds.map(m => `
            <tr>
              <td style="color:var(--orange);font-weight:600;font-size:12px">${m.id}</td>
              <td style="font-weight:500">${m.competencia}</td>
              <td>${fmt(m.valorBruto)}</td>
              <td style="color:${m.glosa > 0 ? 'var(--red-light)' : 'var(--text-muted)'}">
                ${m.glosa > 0 ? fmt(m.glosa) : '—'}
              </td>
              <td style="font-weight:600;color:var(--green-light)">${fmt(m.valorLiquido)}</td>
              <td style="font-size:12px;color:var(--text-secondary)">${m.envio}</td>
              <td style="font-size:12px;color:var(--text-secondary)">${m.previsaoPgto}</td>
              <td>${statusBadge(m.status)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderTabOSContrato(c) {
  const os = ERP_DATA.ordens.filter(o => o.contrato === c.id);
  if (!os.length) return `<div class="empty-state"><i class="fas fa-clipboard-list"></i><p>Nenhuma OS registrada</p></div>`;

  return `
    <div class="table-wrapper">
      <table>
        <thead>
          <tr><th>Nº OS</th><th>Descrição</th><th>Tipo</th><th>Prioridade</th><th>Prazo</th><th>Responsável</th><th>Status</th></tr>
        </thead>
        <tbody>
          ${os.map(o => `
            <tr>
              <td style="color:var(--orange);font-weight:600;font-size:12px">${o.id}</td>
              <td style="font-size:12px;max-width:200px">${o.descricao.substring(0,50)}...</td>
              <td><span class="badge badge-muted">${o.tipo}</span></td>
              <td>${prioridade(o.prioridade)}</td>
              <td style="font-size:12px;color:var(--text-secondary)">${o.prazo}</td>
              <td style="font-size:12px">${o.responsavel}</td>
              <td>${statusBadge(o.status)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderTabEquipeContrato(c) {
  const equipe = ERP_DATA.colaboradores.filter(col => col.contrato === c.id);
  if (!equipe.length) return `<div class="empty-state"><i class="fas fa-users"></i><p>Nenhum colaborador alocado</p></div>`;

  return `
    <div class="table-wrapper">
      <table>
        <thead>
          <tr><th>Nome</th><th>Função</th><th>Turno</th><th>ASO</th><th>NR-10</th><th>NR-35</th><th>Docs</th><th>Status</th></tr>
        </thead>
        <tbody>
          ${equipe.map(e => `
            <tr>
              <td style="font-weight:500">${e.nome}</td>
              <td style="font-size:12px;color:var(--text-secondary)">${e.funcao}</td>
              <td>${e.turno}</td>
              <td style="font-size:12px">${e.aso}</td>
              <td>${statusBadge(e.nr10)}</td>
              <td>${statusBadge(e.nr35)}</td>
              <td>${statusBadge(e.docs)}</td>
              <td>${statusBadge(e.status)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderTabFinanceiroContrato(c) {
  const meses = ['Out/24', 'Nov/24', 'Dez/24', 'Jan/25', 'Fev/25', 'Mar/25'];
  const factor = c.valor / 8750000;
  const receita = [437500, 458000, 350000, 460000, 437500, 437500].map(v => Math.round(v * factor));
  const custo = receita.map(v => Math.round(v * (1 - c.margem/100)));

  // Medições do contrato
  const meds = ERP_DATA.medicoes.filter(m => m.contrato === c.id);
  const medicoesRecebidas = meds.filter(m => m.status === 'Paga').reduce((a,m) => a + m.valorLiquido, 0);

  // Contas a pagar do contrato
  const cp = window.FA_CONTAS_PAGAR ? window.FA_CONTAS_PAGAR.filter(x => x.contrato_id === c.id) : [];
  const cpTotal = cp.reduce((a,x) => a+(x.valor||0), 0);
  const cpPago = cp.filter(x=>x.data_pagamento).reduce((a,x) => a+(x.valor||0), 0);
  const cpPendente = cpTotal - cpPago;

  // Pedidos de compra do contrato
  const pedidos = window.FA_PEDIDOS ? window.FA_PEDIDOS.filter(p => p.contrato_id === c.id) : [];
  const pedidosTotal = pedidos.reduce((a,p) => a+(p.valor_total||0), 0);

  const html = `
    <div class="grid-2">
      <div>
        <div class="section-divider"><h4>Resumo Financeiro do Contrato</h4></div>
        <div class="stat-row"><span class="stat-label">Valor Contratual</span><span class="stat-value" style="color:var(--blue-light)">${fmt(c.valor)}</span></div>
        <div class="stat-row"><span class="stat-label">Receita Acumulada (Medido)</span><span class="stat-value" style="color:var(--green-light)">${fmt(c.medidoAcum)}</span></div>
        <div class="stat-row"><span class="stat-label">Custo Acumulado</span><span class="stat-value" style="color:var(--red-light)">${fmt(c.custoAcum)}</span></div>
        <div class="stat-row"><span class="stat-label">Lucro Bruto</span><span class="stat-value" style="color:var(--green-light);font-weight:700">${fmt(c.medidoAcum - c.custoAcum)}</span></div>
        <div class="stat-row"><span class="stat-label">Margem Bruta</span><span class="stat-value" style="color:${c.margem>=20?'var(--green-light)':'var(--yellow-light)'};font-weight:700">${c.margem}%</span></div>
        <div class="stat-row"><span class="stat-label">Saldo a Executar</span><span class="stat-value">${fmt(c.valor - c.medidoAcum)}</span></div>
        <div style="margin-top:12px;padding:12px;background:rgba(0,180,184,0.06);border:1px solid rgba(0,180,184,0.2);border-radius:8px">
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px">EXECUÇÃO FINANCEIRA</div>
          <div class="progress" style="height:10px">
            <div class="progress-bar green" style="width:${c.progress}%"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-muted);margin-top:4px">
            <span>Executado: <strong style="color:var(--fa-teal)">${c.progress}%</strong></span>
            <span>Saldo: ${100-c.progress}%</span>
          </div>
        </div>
      </div>
      <div>
        <div class="section-divider"><h4>Evolução Mensal (Receita × Custo)</h4></div>
        <div style="height:220px">
          <canvas id="chartDetalheContrato"></canvas>
        </div>
      </div>
    </div>

    <!-- Integração com Financeiro -->
    <div class="section-divider" style="margin-top:20px"><h4>Integração Financeira – Contas a Pagar do Contrato</h4></div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px">
      <div style="background:var(--bg-card2);border:1px solid var(--border);border-radius:8px;padding:14px;text-align:center">
        <div style="font-size:11px;color:var(--text-muted)">TOTAL CP GERADO</div>
        <div style="font-size:20px;font-weight:700;color:var(--orange);margin:4px 0">${fmtK(cpTotal || pedidosTotal)}</div>
        <div style="font-size:11px;color:var(--text-muted)">${cp.length || pedidos.length} lançamentos</div>
      </div>
      <div style="background:var(--bg-card2);border:1px solid var(--border);border-radius:8px;padding:14px;text-align:center">
        <div style="font-size:11px;color:var(--text-muted)">PAGO</div>
        <div style="font-size:20px;font-weight:700;color:var(--green-light);margin:4px 0">${fmtK(cpPago)}</div>
        <div style="font-size:11px;color:var(--text-muted)">Baixado no período</div>
      </div>
      <div style="background:var(--bg-card2);border:1px solid var(--border);border-radius:8px;padding:14px;text-align:center">
        <div style="font-size:11px;color:var(--text-muted)">SALDO A PAGAR</div>
        <div style="font-size:20px;font-weight:700;color:var(--yellow-light);margin:4px 0">${fmtK(cpPendente)}</div>
        <div style="font-size:11px;color:var(--text-muted)">Títulos em aberto</div>
      </div>
    </div>

    ${cp.length > 0 ? `
      <div class="table-wrapper">
        <table>
          <thead><tr><th>ID</th><th>Descrição</th><th>Fornecedor</th><th>Valor</th><th>Vencimento</th><th>Pgto.</th><th>Status</th></tr></thead>
          <tbody>
            ${cp.map(x => `
              <tr>
                <td style="color:var(--fa-teal);font-size:11px;font-weight:600">${x.id}</td>
                <td style="font-size:12px">${x.descricao}</td>
                <td style="font-size:12px">${x.fornecedor_nome}</td>
                <td style="font-weight:700;color:var(--orange)">${fmt(x.valor)}</td>
                <td style="font-size:12px">${x.vencimento}</td>
                <td style="font-size:12px;color:${x.data_pagamento?'var(--green-light)':'var(--text-muted)'}">${x.data_pagamento||'—'}</td>
                <td>${statusBadge(x.data_pagamento ? 'Pago' : x.status)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : `
      <div class="alert alert-info">
        <span class="alert-icon"><i class="fas fa-info-circle"></i></span>
        <div>
          <div class="alert-title">Contas a Pagar Integradas</div>
          <div class="alert-desc">Ao aprovar pedidos de compra vinculados a este contrato, as contas serão listadas aqui automaticamente. <a href="#" onclick="navigate('contas_pagar');return false;" style="color:var(--fa-teal)">Ver todas as contas a pagar →</a></div>
        </div>
      </div>
    `}

    <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-secondary btn-sm" onclick="navigate('faturamento')">
        <i class="fas fa-file-invoice-dollar"></i> Faturamento
      </button>
      <button class="btn btn-secondary btn-sm" onclick="navigate('contas_pagar')">
        <i class="fas fa-hand-holding-usd"></i> Contas a Pagar
      </button>
      <button class="btn btn-secondary btn-sm" onclick="navigate('relatorios');setTimeout(()=>abrirRelatorio('financeiro'),400)">
        <i class="fas fa-chart-bar"></i> Relatório Financeiro
      </button>
    </div>
  `;

  setTimeout(() => {
    const ctx = document.getElementById('chartDetalheContrato');
    if (!ctx) return;
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: meses,
        datasets: [
          { label: 'Receita', data: receita, backgroundColor: 'rgba(34,197,94,0.5)', borderColor: '#22c55e', borderWidth: 1.5, borderRadius: 4 },
          { label: 'Custo', data: custo, backgroundColor: 'rgba(239,68,68,0.4)', borderColor: '#ef4444', borderWidth: 1.5, borderRadius: 4 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#8b949e', font: { size: 10 } } } },
        scales: {
          x: { ticks: { color: '#6e7681', font: { size: 10 } }, grid: { color: '#21262d' } },
          y: { ticks: { color: '#6e7681', font: { size: 10 }, callback: v => 'R$' + (v/1000).toFixed(0) + 'K' }, grid: { color: '#21262d' } }
        }
      }
    });
  }, 100);

  return html;
}

function openNovoContrato() {
  openModal('Novo Contrato', `
    <div class="form-row">
      <div class="form-group">
        <label>Cliente</label>
        <input class="form-control" type="text" id="ctr_novo_cliente" placeholder="Razão social do cliente">
      </div>
      <div class="form-group">
        <label>Tipo de Serviço</label>
        <select class="form-control" id="ctr_novo_tipo">
          <option value="">Selecione o tipo de serviço</option>
          ${_ctrTiposOpts('')}
        </select>
      </div>
    </div>
    <div class="form-group">
      <label>Objeto do Contrato</label>
      <input class="form-control" type="text" id="ctr_novo_objeto" placeholder="Descrição resumida dos serviços">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Data de Início</label>
        <input class="form-control" type="date" id="ctr_novo_inicio">
      </div>
      <div class="form-group">
        <label>Data de Término</label>
        <input class="form-control" type="date" id="ctr_novo_fim">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Valor Total (R$)</label>
        <input class="form-control" type="number" id="ctr_novo_valor" placeholder="0,00">
      </div>
      <div class="form-group">
        <label>Gestor Responsável</label>
        <input class="form-control" id="ctr_novo_gestor" placeholder="Nome do gestor responsável">
      </div>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="salvarNovoContrato()">
      <i class="fas fa-save"></i> Salvar Contrato
    </button>
  `);
}

// ══════════════════════════════════════════════════════════════
//  ABA WBS / CUSTOS POR CONTRATO
//  Usa wbs_manager.js como backend central
// ══════════════════════════════════════════════════════════════

// Helpers legados – delegam ao wbs_manager.js
// Cria o contrato de VERDADE: POST /api/contratos (tenant-isolado) com
// fallback local honesto quando offline. Antes o botão era só um toast.
async function salvarNovoContrato() {
  const v = id => (document.getElementById(id)?.value || '').trim();
  const cliente = v('ctr_novo_cliente');
  if (!cliente) { showToast('Informe o cliente do contrato.', 'error'); return; }
  const payload = {
    titulo: cliente,
    tipo: v('ctr_novo_tipo') || 'Serviço',
    objeto: v('ctr_novo_objeto'),
    data_inicio: v('ctr_novo_inicio') || null,
    data_fim: v('ctr_novo_fim') || null,
    valor_total: parseFloat(v('ctr_novo_valor')) || 0,
  };
  let salvo = null;
  try {
    if (window.NexusAPI) {
      const r = await NexusAPI.post('/api/contratos', payload);
      if (r && r.id != null && !r._stub) salvo = r;
    }
  } catch (e) { /* offline → fallback local abaixo */ }
  let cache = [];
  try { cache = JSON.parse(localStorage.getItem('fa_contratos') || '[]'); } catch (e) {}
  if (!salvo) salvo = { id: 'CT-local-' + Date.now(), numero: 'CT (local)', status: 'Ativo', _local: true, ...payload };
  cache.unshift({ ...salvo, gestor: v('ctr_novo_gestor') || null });
  try { localStorage.setItem('fa_contratos', JSON.stringify(cache)); } catch (e) {}
  if (typeof logAction === 'function') logAction('Criar', 'Contratos', `Contrato ${salvo.numero || salvo.id} criado`);
  closeModal();
  showToast(salvo._local ? 'Sem servidor: contrato salvo localmente.' : `Contrato ${salvo.numero} cadastrado no servidor!`, salvo._local ? 'info' : 'success');
  renderContratos();
}
window.salvarNovoContrato = salvarNovoContrato;
window.salvarEdicaoContrato = salvarEdicaoContrato;

function _ctrGetProjetoId(contratoId) {
  if (typeof wbsGetProjetoIdForContrato === 'function') {
    const pid = wbsGetProjetoIdForContrato(contratoId);
    if (pid) return pid;
  }
  try {
    const projetos = JSON.parse(localStorage.getItem('fraser_custos_projetos') || '[]');
    const p = projetos.find(p => p.contrato === contratoId || p.id === contratoId);
    if (p) return p.id;
    const map = { 'CONT-001':'PROJ-001','CONT-002':'PROJ-002','CONT-003':'PROJ-003' };
    return map[contratoId] || null;
  } catch(e) { return null; }
}

function _ctrGetWBSItens(contratoId) {
  if (typeof wbsGetItensByContrato === 'function') {
    const r = wbsGetItensByContrato(contratoId);
    if (r && r.length) return r;
  }
  try {
    const pid = _ctrGetProjetoId(contratoId);
    const todos = JSON.parse(localStorage.getItem('fraser_custos_wbs') || '[]');
    if (!pid) return todos.filter(i => !i.projeto_id || i.projeto_id === 'PROJ-001');
    return todos.filter(i => i.projeto_id === pid || (!i.projeto_id && pid === 'PROJ-001'));
  } catch(e) { return []; }
}

function _ctrSaveWBSItens(contratoId, novosItens) {
  if (typeof wbsSaveAllItens === 'function') {
    const pid = _ctrGetProjetoId(contratoId);
    const all = typeof wbsGetAllItens === 'function' ? wbsGetAllItens() : [];
    const outros = all.filter(i => i.projeto_id !== pid && !(pid === 'PROJ-001' && !i.projeto_id));
    wbsSaveAllItens([...outros, ...novosItens]);
    return;
  }
  try {
    const pid = _ctrGetProjetoId(contratoId);
    const todos = JSON.parse(localStorage.getItem('fraser_custos_wbs') || '[]');
    const outros = todos.filter(i => {
      if (!pid) return (i.projeto_id && i.projeto_id !== 'PROJ-001');
      return i.projeto_id !== pid && !(pid === 'PROJ-001' && !i.projeto_id);
    });
    localStorage.setItem('fraser_custos_wbs', JSON.stringify([...outros, ...novosItens]));
  } catch(e) {}
}

function renderTabWBSContrato(c) {
  const pid   = _ctrGetProjetoId(c.id);
  const itens = _ctrGetWBSItens(c.id);
  const totEst  = itens.reduce((s,i) => s + (Number(i.est_total)||Number(i.v_total_est)||0), 0);
  const totReal = itens.reduce((s,i) => s + (Number(i.custo_real)||0), 0);
  const burnPct = totEst > 0 ? (totReal/totEst*100) : 0;
  const naoPrevistos = itens.filter(i => i.nao_previsto).length;
  const fmtBRL = v => Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0});

  return `
  <div>
    <!-- KPIs -->
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:16px">
      <div class="kpi-card kpi-blue" style="padding:10px 12px">
        <div class="kpi-icon" style="font-size:16px"><i class="fas fa-coins"></i></div>
        <div class="kpi-value" style="font-size:16px">${fmtBRL(totEst)}</div>
        <div class="kpi-label" style="font-size:10px">Budget WBS</div>
      </div>
      <div class="kpi-card kpi-orange" style="padding:10px 12px">
        <div class="kpi-icon" style="font-size:16px"><i class="fas fa-chart-line"></i></div>
        <div class="kpi-value" style="font-size:16px">${fmtBRL(totReal)}</div>
        <div class="kpi-label" style="font-size:10px">Realizado</div>
      </div>
      <div class="kpi-card kpi-green" style="padding:10px 12px">
        <div class="kpi-icon" style="font-size:16px"><i class="fas fa-balance-scale"></i></div>
        <div class="kpi-value" style="font-size:16px">${fmtBRL(totEst - totReal)}</div>
        <div class="kpi-label" style="font-size:10px">Saldo WBS</div>
      </div>
      <div class="kpi-card ${burnPct>90?'kpi-red':burnPct>70?'kpi-orange':'kpi-teal'}" style="padding:10px 12px">
        <div class="kpi-icon" style="font-size:16px"><i class="fas fa-fire"></i></div>
        <div class="kpi-value" style="font-size:16px">${burnPct.toFixed(1)}%</div>
        <div class="kpi-label" style="font-size:10px">Burn Rate</div>
      </div>
      <div class="kpi-card ${naoPrevistos>0?'kpi-red':'kpi-teal'}" style="padding:10px 12px">
        <div class="kpi-icon" style="font-size:16px"><i class="fas fa-exclamation-triangle"></i></div>
        <div class="kpi-value" style="font-size:16px">${naoPrevistos}</div>
        <div class="kpi-label" style="font-size:10px">Itens N/Previstos</div>
      </div>
    </div>

    <!-- Barra de progresso -->
    <div style="background:var(--bg-tertiary);border-radius:100px;height:8px;margin-bottom:16px;overflow:hidden">
      <div style="width:${Math.min(burnPct,100)}%;background:${burnPct>90?'#ef4444':burnPct>70?'#f59e0b':'#10b981'};height:100%;border-radius:100px;transition:width 0.6s"></div>
    </div>

    <!-- Info projeto + botões -->
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px">
      ${pid ? `
        <div style="font-size:12px;color:var(--text-secondary)">
          <i class="fas fa-project-diagram" style="color:var(--fa-teal);margin-right:4px"></i>
          Projeto WBS: <strong style="color:var(--fa-teal)">${pid}</strong>
          &nbsp;·&nbsp; <span style="color:var(--text-muted)">${itens.length} linhas · ${itens.filter(i=>i.g2).length} itens de custo</span>
          ${naoPrevistos > 0 ? `<span style="margin-left:8px;background:rgba(239,68,68,0.1);color:#ef4444;border-radius:6px;padding:2px 8px;font-size:11px">⚠ ${naoPrevistos} não previstos</span>` : ''}
        </div>
      ` : `
        <div style="font-size:12px;color:var(--text-muted)">
          <i class="fas fa-exclamation-triangle" style="color:#f59e0b;margin-right:4px"></i>
          Nenhum projeto WBS vinculado a este contrato.
        </div>
      `}
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${!pid ? `<button onclick="wbsIniciarEstrutura('${c.id}')" class="btn btn-primary btn-sm"><i class="fas fa-magic"></i> Criar Estrutura WBS</button>` : ''}
        <button onclick="wbsExpandAll('${c.id}')" class="btn btn-secondary btn-sm" style="font-size:11px"><i class="fas fa-expand-alt"></i> Expandir</button>
        <button onclick="wbsCollapseAll('${c.id}')" class="btn btn-secondary btn-sm" style="font-size:11px"><i class="fas fa-compress-alt"></i> Recolher</button>
        <button onclick="wbsNovaLinha('${c.id}','${c.id}')" class="btn btn-primary btn-sm"><i class="fas fa-plus"></i> Nova Linha</button>
        <button onclick="wbsNovaLinhaOS('${c.id}','${c.id}')" class="btn btn-sm" style="background:rgba(239,68,68,0.1);color:#ef4444;border:1px solid rgba(239,68,68,0.3);padding:6px 10px;border-radius:6px;font-size:12px;cursor:pointer"><i class="fas fa-exclamation-triangle"></i> Item N/Previsto</button>
        <button onclick="navigate('custos')" class="btn btn-secondary btn-sm"><i class="fas fa-external-link-alt"></i> Módulo Custos</button>
      </div>
    </div>

    <!-- Árvore WBS (renderizada via wbs_manager.js após mount) -->
    <div id="ctr-wbs-tree-v2" style="min-height:80px">
      <div style="text-align:center;padding:20px;color:var(--text-muted)"><i class="fas fa-spinner fa-spin"></i> Carregando estrutura WBS...</div>
    </div>
  </div>`;
}

// Estado de expansão por contrato
window._ctrWBSExp = {};

function _ctrWBSExpandirTudo(expandir) {
  const el = document.getElementById('ctr-wbs-tree-v2') || document.getElementById('ctr-wbs-tree');
  if (!el) return;
  _renderContratoWBSTree(window._contratoAtivo);
}

function _renderContratoWBSTree(c) {
  if (!c) return;
  // Usa o wbs_manager.js para renderizar a árvore (container principal v2)
  const elV2 = document.getElementById('ctr-wbs-tree-v2');
  if (elV2 && typeof wbsRenderTree === 'function') {
    const itens = _ctrGetWBSItens(c.id);
    const stateKey = c.id;
    window._wbsRerenderContext = window._wbsRerenderContext || {};
    window._wbsRerenderContext[stateKey] = {
      containerId: 'ctr-wbs-tree-v2',
      itens,
      opts: { editable: true, showCustos: true, contratoId: c.id }
    };
    wbsRenderTree('ctr-wbs-tree-v2', itens, { editable: true, showCustos: true, contratoId: c.id });
    return;
  }

  // Fallback legado (sem wbs_manager.js)
  const el = document.getElementById('ctr-wbs-tree-v2') || document.getElementById('ctr-wbs-tree');
  if (!el) return;
  const itens = _ctrGetWBSItens(c.id);
  const fmtBRL = v => Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0});
  const fmtPct = v => Number(v||0).toFixed(1) + '%';

  // Agrupar G1→G2→G3→items
  const tree = {};
  itens.forEach(i => {
    const g1 = i.g1 || '1';
    const g2 = i.g2 || '1';
    const g3 = i.g3 || '1';
    if (!tree[g1]) tree[g1] = { est:0, real:0, subs:{} };
    if (!tree[g1].subs[g2]) tree[g1].subs[g2] = { est:0, real:0, subs:{} };
    if (!tree[g1].subs[g2].subs[g3]) tree[g1].subs[g2].subs[g3] = { est:0, real:0, items:[] };
    const est = Number(i.v_total_est||i.est_total||0);
    const real = Number(i.custo_real||0);
    tree[g1].est += est; tree[g1].real += real;
    tree[g1].subs[g2].est += est; tree[g1].subs[g2].real += real;
    tree[g1].subs[g2].subs[g3].est += est; tree[g1].subs[g2].subs[g3].real += real;
    tree[g1].subs[g2].subs[g3].items.push(i);
  });

  const L1_LABELS = { '1':'Equipamentos e Operação','2':'Pessoal','3':'Alimentação e Acomodação','4':'EPI e Segurança','5':'Administração','6':'Outros' };
  const rows = [];

  Object.entries(tree).sort((a,b)=>Number(a[0])-Number(b[0])).forEach(([g1, d1]) => {
    const keyG1 = `g1-${g1}`;
    const exp1 = window._ctrWBSExp[keyG1] !== false; // default expandido
    const burn1 = d1.est > 0 ? (d1.real/d1.est*100) : 0;
    const var1 = d1.real - d1.est;

    rows.push(`
    <div data-wbs-group="${keyG1}"
      style="display:grid;grid-template-columns:28px 1fr 110px 110px 90px 80px 80px;gap:0;padding:9px 10px;background:#f0f9ff;border-bottom:1px solid #e2e8f0;cursor:pointer;user-select:none;"
      onclick="_ctrWBSToggle('${keyG1}')">
      <span style="font-size:13px;color:#0891b2;text-align:center;line-height:20px;">
        <i class="fas fa-chevron-${exp1?'down':'right'}"></i>
      </span>
      <span style="font-size:13px;font-weight:700;color:#0f172a;">${g1}. ${L1_LABELS[g1]||'Grupo '+g1}</span>
      <span style="font-size:12px;font-weight:600;color:#1e40af;text-align:right;">${fmtBRL(d1.est)}</span>
      <span style="font-size:12px;font-weight:600;color:#b91c1c;text-align:right;">${fmtBRL(d1.real)}</span>
      <span style="font-size:12px;text-align:right;color:${var1<=0?'#10b981':'#ef4444'};font-weight:600;">${var1<=0?'▼':'▲'} ${fmtBRL(Math.abs(var1))}</span>
      <span style="text-align:center;">
        <span style="background:${burn1>90?'#fef2f2':burn1>70?'#fff7ed':'#f0fdf4'};color:${burn1>90?'#ef4444':burn1>70?'#f59e0b':'#10b981'};border-radius:20px;padding:2px 8px;font-size:11px;font-weight:600;">${burn1.toFixed(0)}%</span>
      </span>
      <span></span>
    </div>`);

    if (!exp1) return;

    Object.entries(d1.subs).sort((a,b)=>Number(a[0])-Number(b[0])).forEach(([g2, d2]) => {
      const keyG2 = `g2-${g1}-${g2}`;
      const exp2 = window._ctrWBSExp[keyG2] !== false;
      const burn2 = d2.est > 0 ? (d2.real/d2.est*100) : 0;
      const var2 = d2.real - d2.est;

      rows.push(`
      <div data-wbs-group="${keyG2}"
        style="display:grid;grid-template-columns:28px 1fr 110px 110px 90px 80px 80px;gap:0;padding:8px 10px 8px 26px;background:#f8fafc;border-bottom:1px solid #e2e8f0;cursor:pointer;user-select:none;"
        onclick="_ctrWBSToggle('${keyG2}')">
        <span style="font-size:12px;color:#64748b;text-align:center;line-height:18px;">
          <i class="fas fa-chevron-${exp2?'down':'right'}"></i>
        </span>
        <span style="font-size:12px;font-weight:600;color:#334155;">${g1}.${g2} Sub-grupo</span>
        <span style="font-size:12px;color:#475569;text-align:right;">${fmtBRL(d2.est)}</span>
        <span style="font-size:12px;color:#475569;text-align:right;">${fmtBRL(d2.real)}</span>
        <span style="font-size:12px;text-align:right;color:${var2<=0?'#10b981':'#ef4444'};">${var2<=0?'▼':'▲'} ${fmtBRL(Math.abs(var2))}</span>
        <span style="text-align:center;">
          <span style="background:${burn2>90?'#fef2f2':burn2>70?'#fff7ed':'#f0fdf4'};color:${burn2>90?'#ef4444':burn2>70?'#f59e0b':'#10b981'};border-radius:20px;padding:2px 7px;font-size:10px;font-weight:600;">${burn2.toFixed(0)}%</span>
        </span>
        <span></span>
      </div>`);

      if (!exp2) return;

      Object.entries(d2.subs).sort((a,b)=>Number(a[0])-Number(b[0])).forEach(([g3, d3]) => {
        const keyG3 = `g3-${g1}-${g2}-${g3}`;
        const exp3 = window._ctrWBSExp[keyG3] !== false;
        const burn3 = d3.est > 0 ? (d3.real/d3.est*100) : 0;

        rows.push(`
        <div data-wbs-group="${keyG3}"
          style="display:grid;grid-template-columns:28px 1fr 110px 110px 90px 80px 80px;gap:0;padding:7px 10px 7px 44px;background:#fff;border-bottom:1px solid #f1f5f9;cursor:pointer;user-select:none;"
          onclick="_ctrWBSToggle('${keyG3}')">
          <span style="font-size:11px;color:#94a3b8;text-align:center;line-height:16px;">
            <i class="fas fa-chevron-${exp3?'down':'right'}"></i>
          </span>
          <span style="font-size:12px;color:#475569;">${g1}.${g2}.${g3} Pacote</span>
          <span style="font-size:12px;color:#64748b;text-align:right;">${fmtBRL(d3.est)}</span>
          <span style="font-size:12px;color:#64748b;text-align:right;">${fmtBRL(d3.real)}</span>
          <span style="font-size:11px;text-align:right;color:#64748b;">${fmtBRL(Math.abs(d3.real-d3.est))}</span>
          <span style="text-align:center;">
            <span style="font-size:10px;color:${burn3>90?'#ef4444':burn3>70?'#f59e0b':'#64748b'};font-weight:600;">${burn3.toFixed(0)}%</span>
          </span>
          <span></span>
        </div>`);

        if (!exp3) return;

        d3.items.forEach(item => {
          const est = Number(item.v_total_est||item.est_total||0);
          const real = Number(item.custo_real||0);
          const burn = est > 0 ? (real/est*100) : 0;
          const varVal = real - est;
          const isNP = item.nao_previsto;

          rows.push(`
          <div style="display:grid;grid-template-columns:28px 1fr 110px 110px 90px 80px 80px;gap:0;padding:7px 10px 7px 60px;background:${isNP?'#fff7ed':'#fff'};border-bottom:1px solid #f1f5f9;">
            <span style="text-align:center;">
              ${isNP ? '<span title="Item não previsto" style="color:#f59e0b;font-size:10px;"><i class="fas fa-exclamation-triangle"></i></span>' : ''}
            </span>
            <div>
              <span style="font-size:12px;font-weight:600;color:${isNP?'#92400e':'#0f172a'};">${item.id}</span>
              <span style="font-size:11px;color:${isNP?'#92400e':'#475569'};margin-left:6px;">${item.descricao}</span>
              ${isNP ? '<span style="font-size:10px;background:#fef3c7;color:#92400e;border-radius:4px;padding:1px 5px;margin-left:6px;">Não Previsto</span>' : ''}
              <br><span style="font-size:10px;color:#94a3b8;">${item.natureza||''} · ${item.fornecedor||'—'} · ${item.expenditure||item.tipo||''}</span>
              ${item.os_vinculadas && item.os_vinculadas.length ? `<br><span style="font-size:10px;color:#0891b2;"><i class="fas fa-link" style="margin-right:3px;"></i>${item.os_vinculadas.map(o=>`<a onclick="verDetalheOS_fromContratos('${o}')" style="cursor:pointer;color:#0891b2;text-decoration:underline;">${o}</a>`).join(', ')}</span>` : ''}
            </div>
            <span style="font-size:12px;text-align:right;color:#1e40af;align-self:center;">${fmtBRL(est)}</span>
            <span style="font-size:12px;font-weight:600;text-align:right;color:#b91c1c;align-self:center;">${fmtBRL(real)}</span>
            <span style="font-size:12px;text-align:right;color:${varVal<=0?'#10b981':'#ef4444'};align-self:center;font-weight:600;">${varVal<=0?'▼':'▲'} ${fmtBRL(Math.abs(varVal))}</span>
            <span style="text-align:center;align-self:center;">
              <div style="background:#f1f5f9;border-radius:100px;height:6px;width:60px;margin:0 auto;">
                <div style="width:${Math.min(burn,100)}%;background:${burn>90?'#ef4444':burn>70?'#f59e0b':'#10b981'};height:100%;border-radius:100px;"></div>
              </div>
              <span style="font-size:10px;color:#64748b;">${burn.toFixed(0)}%</span>
            </span>
            <span style="text-align:center;align-self:center;">
              <button onclick="_ctrWBSEditarLinha('${item.id}','${c.id}')" title="Editar" style="background:none;border:none;cursor:pointer;color:#64748b;padding:3px;"><i class="fas fa-edit" style="font-size:12px;"></i></button>
            </span>
          </div>`);
        });
      });
    });
  });

  if (rows.length === 0) {
    el.innerHTML = `<div style="text-align:center;padding:40px;color:#94a3b8;">
      <i class="fas fa-sitemap" style="font-size:32px;margin-bottom:12px;display:block;"></i>
      Nenhuma linha WBS cadastrada para este contrato.<br>
      <button onclick="_ctrWBSNovaLinha('${c.id}')" style="margin-top:12px;padding:8px 16px;background:#0891b2;color:#fff;border:none;border-radius:7px;cursor:pointer;font-size:13px;">
        <i class="fas fa-plus"></i> Adicionar Primeira Linha
      </button>
    </div>`;
    return;
  }

  el.innerHTML = rows.join('');
}

function _ctrWBSToggle(key) {
  window._ctrWBSExp[key] = !( window._ctrWBSExp[key] !== false );
  _renderContratoWBSTree(window._contratoAtivo);
}

function _ctrWBSEditarLinha(itemId, contratoId) {
  const itens = _ctrGetWBSItens(contratoId);
  const item = itens.find(i => i.id === itemId);
  if (!item) return;
  const fmtN = v => Number(v||0);

  openModalWide('Editar Linha WBS — ' + itemId, `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px;">
      <div>
        <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px;">Código WBS</label>
        <input id="ewbs_id" class="form-control" value="${item.id}" style="font-size:12px;" readonly style="background:#f8fafc;">
      </div>
      <div style="grid-column:span 2;">
        <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px;">Descrição *</label>
        <input id="ewbs_desc" class="form-control" value="${item.descricao||''}" style="font-size:12px;">
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px;margin-bottom:12px;">
      <div>
        <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px;">Natureza</label>
        <input id="ewbs_nat" class="form-control" value="${item.natureza||''}" style="font-size:12px;">
      </div>
      <div>
        <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px;">Fornecedor</label>
        <input id="ewbs_forn" class="form-control" value="${item.fornecedor||''}" style="font-size:12px;">
      </div>
      <div>
        <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px;">Tipo</label>
        <select id="ewbs_tipo" class="form-control" style="font-size:12px;">
          <option ${(item.expenditure||item.tipo)==='OPEX'?'selected':''}>OPEX</option>
          <option ${(item.expenditure||item.tipo)==='CAPEX'?'selected':''}>CAPEX</option>
        </select>
      </div>
      <div>
        <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px;">Unidade</label>
        <input id="ewbs_un" class="form-control" value="${item.unidade||item.unit||'vb'}" style="font-size:12px;">
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px;margin-bottom:12px;">
      <div>
        <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px;">Qtd</label>
        <input id="ewbs_qtd" class="form-control" type="number" value="${fmtN(item.qtd||item.qty_unit||1)}" style="font-size:12px;">
      </div>
      <div>
        <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px;">Valor Unit. Estimado (R$)</label>
        <input id="ewbs_vunit" class="form-control" type="number" value="${fmtN(item.v_unit_est||item.unit_value_est||0)}" oninput="_ewbsCalcTotal()" style="font-size:12px;">
      </div>
      <div>
        <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px;">Valor Total Estimado (R$)</label>
        <input id="ewbs_vtotal" class="form-control" type="number" value="${fmtN(item.v_total_est||item.est_total||0)}" style="font-size:12px;background:#f8fafc;" readonly>
      </div>
      <div>
        <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px;">Custo Real (R$)</label>
        <input id="ewbs_real" class="form-control" type="number" value="${fmtN(item.custo_real||0)}" style="font-size:12px;">
      </div>
    </div>
    <div>
      <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px;">Observações</label>
      <textarea id="ewbs_obs" class="form-control" rows="2" style="font-size:12px;">${item.obs||''}</textarea>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="_ctrWBSSalvarEdicao('${itemId}','${contratoId}')">
      <i class="fas fa-save"></i> Salvar Linha WBS
    </button>
  `);
}

function _ewbsCalcTotal() {
  const qtd = Number(document.getElementById('ewbs_qtd')?.value||1);
  const vunit = Number(document.getElementById('ewbs_vunit')?.value||0);
  const vt = document.getElementById('ewbs_vtotal');
  if (vt) vt.value = (qtd * vunit).toFixed(2);
}

function _ctrWBSSalvarEdicao(itemId, contratoId) {
  const itens = _ctrGetWBSItens(contratoId);
  const idx = itens.findIndex(i => i.id === itemId);
  if (idx < 0) return;
  itens[idx] = {
    ...itens[idx],
    descricao: document.getElementById('ewbs_desc')?.value || itens[idx].descricao,
    natureza:  document.getElementById('ewbs_nat')?.value  || itens[idx].natureza,
    fornecedor:document.getElementById('ewbs_forn')?.value || itens[idx].fornecedor,
    expenditure: document.getElementById('ewbs_tipo')?.value || itens[idx].expenditure,
    tipo:        document.getElementById('ewbs_tipo')?.value || itens[idx].tipo,
    unidade:   document.getElementById('ewbs_un')?.value   || itens[idx].unidade,
    qtd:       Number(document.getElementById('ewbs_qtd')?.value  || itens[idx].qtd),
    v_unit_est:Number(document.getElementById('ewbs_vunit')?.value || itens[idx].v_unit_est||0),
    v_total_est:Number(document.getElementById('ewbs_vtotal')?.value || itens[idx].v_total_est||0),
    est_total:  Number(document.getElementById('ewbs_vtotal')?.value || itens[idx].est_total||0),
    custo_real:Number(document.getElementById('ewbs_real')?.value  || itens[idx].custo_real||0),
    obs:       document.getElementById('ewbs_obs')?.value  || itens[idx].obs || ''
  };
  _ctrSaveWBSItens(contratoId, itens);
  closeModal();
  showToast('Linha WBS atualizada!', 'success');
  setTimeout(() => { _renderContratoWBSTree(window._contratoAtivo); }, 100);
}

function _ctrWBSNovaLinha(contratoId) {
  const itens = _ctrGetWBSItens(contratoId);
  const pid = _ctrGetProjetoId(contratoId);

  // Detectar próximo G1/G2/G3/item disponível
  const maxG1 = itens.reduce((m,i) => Math.max(m, Number(i.g1||1)), 0) || 1;
  const defaultG1 = String(maxG1);
  const sameG1 = itens.filter(i => i.g1 === defaultG1);
  const maxG2 = sameG1.reduce((m,i) => Math.max(m, Number(i.g2||1)), 0) || 1;
  const defaultG2 = String(maxG2);
  const sameG2 = sameG1.filter(i => i.g2 === defaultG2);
  const maxG3 = sameG2.reduce((m,i) => Math.max(m, Number(i.g3||1)), 0) || 1;
  const defaultG3 = String(maxG3);
  const sameG3 = sameG2.filter(i => i.g3 === defaultG3);
  const maxItem = sameG3.reduce((m,i) => Math.max(m, Number(i.item||0)), 0) + 1;
  const defaultCode = `${defaultG1}.${defaultG2}.${defaultG3}.${maxItem}`;

  openModalWide('Nova Linha WBS — Contrato ' + contratoId, `
    <div style="background:#f0f9ff;border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:#0369a1;">
      <i class="fas fa-info-circle" style="margin-right:6px;"></i>
      A nova linha será adicionada ao projeto <strong>${pid||contratoId}</strong> e ficará visível no módulo de Custos.
    </div>
    <div style="display:grid;grid-template-columns:80px 80px 80px 80px 1fr;gap:10px;margin-bottom:12px;">
      <div>
        <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px;">Grupo L1</label>
        <input id="nwbs_g1" class="form-control" value="${defaultG1}" type="number" min="1" max="9" style="font-size:13px;font-weight:700;" oninput="_nwbsUpdateCode()">
      </div>
      <div>
        <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px;">Sub-grupo L2</label>
        <input id="nwbs_g2" class="form-control" value="${defaultG2}" type="number" min="1" style="font-size:13px;" oninput="_nwbsUpdateCode()">
      </div>
      <div>
        <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px;">Pacote L3</label>
        <input id="nwbs_g3" class="form-control" value="${defaultG3}" type="number" min="1" style="font-size:13px;" oninput="_nwbsUpdateCode()">
      </div>
      <div>
        <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px;">Item</label>
        <input id="nwbs_item" class="form-control" value="${maxItem}" type="number" min="1" style="font-size:13px;" oninput="_nwbsUpdateCode()">
      </div>
      <div>
        <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px;">Código WBS (auto)</label>
        <input id="nwbs_code" class="form-control" value="${defaultCode}" style="font-size:13px;font-weight:700;color:#0891b2;background:#f0f9ff;" readonly>
      </div>
    </div>
    <div style="margin-bottom:12px;">
      <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px;">Descrição *</label>
      <input id="nwbs_desc" class="form-control" placeholder="Ex: Manutenção preventiva – Escavadeira PC800" style="font-size:13px;">
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;margin-bottom:12px;">
      <div>
        <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px;">Natureza</label>
        <input id="nwbs_nat" class="form-control" placeholder="Ex: Consumíveis" style="font-size:12px;">
      </div>
      <div>
        <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px;">Fornecedor</label>
        <input id="nwbs_forn" class="form-control" placeholder="Nome do fornecedor" style="font-size:12px;">
      </div>
      <div>
        <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px;">Tipo</label>
        <select id="nwbs_tipo" class="form-control" style="font-size:12px;">
          <option value="OPEX">OPEX</option>
          <option value="CAPEX">CAPEX</option>
        </select>
      </div>
      <div>
        <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px;">Unidade</label>
        <input id="nwbs_un" class="form-control" value="vb" style="font-size:12px;">
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:12px;">
      <div>
        <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px;">Qtd</label>
        <input id="nwbs_qtd" class="form-control" type="number" value="1" oninput="_nwbsCalcTotal()" style="font-size:12px;">
      </div>
      <div>
        <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px;">Valor Unitário Est. (R$)</label>
        <input id="nwbs_vunit" class="form-control" type="number" value="0" oninput="_nwbsCalcTotal()" style="font-size:12px;">
      </div>
      <div>
        <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px;">Total Estimado (R$)</label>
        <input id="nwbs_vtotal" class="form-control" type="number" value="0" style="font-size:12px;background:#f8fafc;" readonly>
      </div>
    </div>
    <div>
      <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px;">Observações</label>
      <textarea id="nwbs_obs" class="form-control" rows="2" style="font-size:12px;" placeholder="Vinculação com OS, RC, etc."></textarea>
    </div>
    <div id="nwbs_erro" style="display:none;color:#ef4444;font-size:12px;margin-top:8px;background:#fef2f2;padding:8px 12px;border-radius:6px;"></div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="_ctrWBSSalvarNova('${contratoId}')">
      <i class="fas fa-plus"></i> Adicionar Linha WBS
    </button>
  `);
}

function _nwbsUpdateCode() {
  const g1 = document.getElementById('nwbs_g1')?.value||'1';
  const g2 = document.getElementById('nwbs_g2')?.value||'1';
  const g3 = document.getElementById('nwbs_g3')?.value||'1';
  const it = document.getElementById('nwbs_item')?.value||'1';
  const el = document.getElementById('nwbs_code');
  if (el) el.value = `${g1}.${g2}.${g3}.${it}`;
}

function _nwbsCalcTotal() {
  const qtd = Number(document.getElementById('nwbs_qtd')?.value||1);
  const vu  = Number(document.getElementById('nwbs_vunit')?.value||0);
  const vt = document.getElementById('nwbs_vtotal');
  if (vt) vt.value = (qtd * vu).toFixed(2);
}

function _ctrWBSSalvarNova(contratoId) {
  const desc = document.getElementById('nwbs_desc')?.value?.trim();
  const erro = document.getElementById('nwbs_erro');
  if (!desc) { if(erro){erro.style.display='block';erro.textContent='Descrição é obrigatória.';} return; }

  const pid  = _ctrGetProjetoId(contratoId);
  const g1   = document.getElementById('nwbs_g1')?.value||'1';
  const g2   = document.getElementById('nwbs_g2')?.value||'1';
  const g3   = document.getElementById('nwbs_g3')?.value||'1';
  const item = document.getElementById('nwbs_item')?.value||'1';
  const code = document.getElementById('nwbs_code')?.value || `${g1}.${g2}.${g3}.${item}`;
  const qtd  = Number(document.getElementById('nwbs_qtd')?.value||1);
  const vu   = Number(document.getElementById('nwbs_vunit')?.value||0);
  const vt   = Number(document.getElementById('nwbs_vtotal')?.value||0);

  const novaLinha = {
    id: code,
    projeto_id: pid || contratoId,
    g1, g2, g3, item,
    descricao: desc,
    natureza:  document.getElementById('nwbs_nat')?.value||'',
    fornecedor:document.getElementById('nwbs_forn')?.value||'',
    expenditure: document.getElementById('nwbs_tipo')?.value||'OPEX',
    tipo:        document.getElementById('nwbs_tipo')?.value||'OPEX',
    unidade:   document.getElementById('nwbs_un')?.value||'vb',
    qtd, v_unit_est: vu, v_total_est: vt, est_total: vt,
    custo_real: 0, custo_proj: vt, custo_spot: 0, custo_contrato: vt,
    variacao: 0, variacao_pct: 0, preco_venda: 0,
    medicao: false, obs: document.getElementById('nwbs_obs')?.value||'',
    nao_previsto: false,
    criado_em: new Date().toISOString(), criado_por: 'Usuário'
  };

  const itens = _ctrGetWBSItens(contratoId);
  // Verifica duplicata de código
  if (itens.find(i => i.id === code)) {
    if(erro){erro.style.display='block';erro.textContent=`Código ${code} já existe. Ajuste os campos G1/G2/G3/Item.`;} return;
  }
  itens.push(novaLinha);
  _ctrSaveWBSItens(contratoId, itens);
  closeModal();
  showToast(`Linha WBS ${code} adicionada!`, 'success');
  if(typeof logAction==='function') logAction('WBS', 'Contratos', `Nova linha WBS ${code} no contrato ${contratoId}`);
  setTimeout(() => { _renderContratoWBSTree(window._contratoAtivo); }, 100);
}

function _ctrCriarProjetoWBS(contratoId) {
  const c = ERP_DATA.contratos.find(x => x.id === contratoId);
  if (!c) return;
  const ano = new Date().getFullYear();
  const projetos = JSON.parse(localStorage.getItem('fraser_custos_projetos') || '[]');
  const novoId = 'PROJ-' + ano + '-' + String(projetos.length + 1).padStart(3, '0');
  projetos.push({
    id: novoId, nome: c.id + ' – ' + c.cliente, contrato: contratoId,
    cliente: c.cliente, status: 'Ativo', inicio: c.inicio, fim: c.fim,
    valor_contrato: c.valor, criado_em: new Date().toISOString()
  });
  localStorage.setItem('fraser_custos_projetos', JSON.stringify(projetos));
  showToast(`Projeto ${novoId} criado e vinculado ao ${contratoId}!`, 'success');
  switchTabContrato('wbs');
}

// Permite abrir OS a partir do link na linha WBS de contratos
function verDetalheOS_fromContratos(osId) {
  navigate('os');
  setTimeout(() => { if(typeof verDetalheOS === 'function') verDetalheOS(osId); }, 500);
}

// ══════════════════════════════════════════════════════════════════
// ALERTAS DE VENCIMENTO DE CONTRATO (90 / 60 / 30 dias)
// ══════════════════════════════════════════════════════════════════

/**
 * ctrRenderAlertasVencimento – renderiza alertas de contratos próximos
 * do vencimento dentro do elemento `containerId`.
 * Níveis: 30 dias → crítico (vermelho), 60 dias → alerta (laranja),
 *          90 dias → aviso (amarelo).
 */
function ctrRenderAlertasVencimento(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  // Coleta contratos ativos com data de término (campo `fim`)
  const contratos = (typeof ERP_DATA !== 'undefined' ? ERP_DATA.contratos : [])
    .concat((() => { try { return JSON.parse(localStorage.getItem('fa_contratos') || '[]'); } catch(e){ return []; } })())
    .filter(c => {
      if (!c.fim) return false;
      if (['Encerrado', 'Suspenso'].includes(c.status)) return false;
      return true;
    });

  // Deduplica por ID
  const vistos = new Set();
  const contratosFiltrados = contratos.filter(c => {
    if (vistos.has(c.id)) return false;
    vistos.add(c.id);
    return true;
  });

  const alertas = [];
  contratosFiltrados.forEach(c => {
    // Aceita formatos: "DD/MM/AAAA", "AAAA-MM-DD", "DD/MM/AA"
    let dtFim;
    const fimStr = String(c.fim || '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(fimStr)) {
      dtFim = new Date(fimStr + 'T00:00:00');
    } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(fimStr)) {
      const [d, m, a] = fimStr.split('/');
      dtFim = new Date(`${a}-${m}-${d}T00:00:00`);
    } else if (/^\d{2}\/\d{2}\/\d{2}$/.test(fimStr)) {
      const [d, m, a] = fimStr.split('/');
      dtFim = new Date(`20${a}-${m}-${d}T00:00:00`);
    } else {
      return; // formato desconhecido
    }
    if (isNaN(dtFim.getTime())) return;

    const diasRestantes = Math.round((dtFim.getTime() - hoje.getTime()) / (24 * 60 * 60 * 1000));

    let nivel = null;
    if (diasRestantes < 0)       nivel = 'vencido';
    else if (diasRestantes <= 30) nivel = 'critico';
    else if (diasRestantes <= 60) nivel = 'alerta';
    else if (diasRestantes <= 90) nivel = 'aviso';

    if (nivel) alertas.push({ ...c, _diasRestantes: diasRestantes, _nivel: nivel });
  });

  if (alertas.length === 0) { el.innerHTML = ''; return; }

  // Ordena: vencidos → críticos → alertas → avisos
  const ordemNivel = { vencido: 0, critico: 1, alerta: 2, aviso: 3 };
  alertas.sort((a, b) => (ordemNivel[a._nivel] - ordemNivel[b._nivel]) || (a._diasRestantes - b._diasRestantes));

  const corNivel = {
    vencido: { bg: 'rgba(127,29,29,0.15)', borda: 'rgba(239,68,68,0.5)',  texto: '#ef4444', badge: '#7f1d1d', icone: 'fa-ban' },
    critico: { bg: 'rgba(239,68,68,0.08)', borda: 'rgba(239,68,68,0.35)', texto: '#ef4444', badge: 'rgba(239,68,68,0.15)', icone: 'fa-exclamation-circle' },
    alerta:  { bg: 'rgba(245,158,11,0.07)', borda: 'rgba(245,158,11,0.3)', texto: '#f59e0b', badge: 'rgba(245,158,11,0.15)', icone: 'fa-exclamation-triangle' },
    aviso:   { bg: 'rgba(234,179,8,0.07)',  borda: 'rgba(234,179,8,0.3)',  texto: '#eab308', badge: 'rgba(234,179,8,0.15)',   icone: 'fa-clock' }
  };

  const labelNivel = { vencido: 'VENCIDO', critico: '≤ 30 dias', alerta: '≤ 60 dias', aviso: '≤ 90 dias' };

  el.innerHTML = `
    <div style="background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.25);border-radius:10px;padding:14px 16px;margin-bottom:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:10px">
        <div style="display:flex;align-items:center;gap:8px">
          <i class="fas fa-calendar-times" style="color:#ef4444;font-size:18px"></i>
          <span style="font-size:14px;font-weight:700;color:#ef4444">
            ${alertas.length} contrato${alertas.length > 1 ? 's' : ''} próximo${alertas.length > 1 ? 's' : ''} do vencimento
          </span>
        </div>
        <span style="font-size:11px;color:var(--text-muted)">Alertas: 30 / 60 / 90 dias antes do término</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${alertas.map(c => {
          const cor = corNivel[c._nivel];
          const diasLabel = c._diasRestantes < 0
            ? `Vencido há ${Math.abs(c._diasRestantes)} dias`
            : `${c._diasRestantes} dias restantes`;
          return `
          <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;
            padding:9px 12px;background:${cor.bg};border:1px solid ${cor.borda};border-radius:8px;flex-wrap:wrap">
            <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0">
              <i class="fas ${cor.icone}" style="color:${cor.texto};font-size:14px;flex-shrink:0"></i>
              <div style="min-width:0">
                <div style="font-weight:700;color:var(--text-primary);font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                  ${c.id} – ${c.cliente || '—'}
                </div>
                <div style="font-size:11px;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                  ${c.descricao || c.tipo || ''} · Gestor: ${c.gestor || '—'} · Término: ${c.fim}
                </div>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
              <span style="font-size:11px;background:${cor.badge};color:${cor.texto};padding:3px 8px;border-radius:10px;font-weight:700;white-space:nowrap">
                <i class="fas fa-hourglass-half" style="margin-right:3px"></i>${diasLabel}
              </span>
              <span style="font-size:10px;background:${cor.bg};color:${cor.texto};padding:2px 7px;border-radius:8px;border:1px solid ${cor.borda};font-weight:700">
                ${labelNivel[c._nivel]}
              </span>
              <button onclick="verContrato('${c.id}')" class="btn btn-sm btn-secondary" style="padding:3px 8px;font-size:11px">
                <i class="fas fa-eye"></i> Ver
              </button>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>
  `;
}

window.ctrRenderAlertasVencimento = ctrRenderAlertasVencimento;

// =====================================================
// Fraser Alexander – Módulo Ordens de Serviço
// Totalmente funcional: CRUD, apontamento, checklist, exportação
// Vinculação com linhas WBS do Projeto (Controle de Custos)
// =====================================================

// ── HELPERS WBS ──────────────────────────────────────────────
// Retorna lista de itens WBS disponíveis (seed + localStorage)
function _osGetWBSItens() {
  try {
    const raw = localStorage.getItem('fraser_custos_wbs');
    if (raw) {
      const d = JSON.parse(raw);
      if (d && d.length > 0) return d;
    }
  } catch(e) {}
  // Fallback: usa o seed direto se _custosGetWBSSeed estiver disponível
  if (typeof _custosGetWBSSeed === 'function') return _custosGetWBSSeed();
  return [];
}

// Monta opções HTML para o select de linha WBS (filtrado por contrato se disponível)
function _osWBSOptions(selectedId, contratoId) {
  // Usa o wbs_manager.js quando disponível (filtra por contrato)
  if (typeof wbsGetOptionsForContrato === 'function' && contratoId) {
    return wbsGetOptionsForContrato(contratoId, selectedId);
  }
  const itens = _osGetWBSItens();
  if (!itens.length) return '<option value="">— WBS não carregado —</option>';
  let html = '<option value="">Selecione a linha WBS...</option>';
  html += '<option value="NP" style="color:#ef4444">⚠ Item Não Previsto (criar nova linha)</option>';
  itens.forEach(it => {
    if (!it.g2) return; // pula grupos
    const np = it.nao_previsto ? '⚠ ' : '';
    const label = `${np}${it.id} – ${it.descricao} (${it.natureza||''})`;
    html += `<option value="${it.id}" ${selectedId === it.id ? 'selected' : ''}>${label}</option>`;
  });
  return html;
}

/**
 * Gera <option>s para selects WBS inline por item de OS.
 * Consolida projetos Gantt + WBS do contrato em uma lista flat.
 * @param {string} [selectedId] – valor pré-selecionado
 */
function _osWBSInlineOptions(selectedId) {
  try {
    const projetos  = JSON.parse(localStorage.getItem('fa_projetos_gantt') || '[]');
    const wbsItems  = JSON.parse(localStorage.getItem('fa_wbs_items') || '[]');
    let html = '<option value="">— Linha WBS (opcional) —</option>';

    // WBS estático (fa_wbs_items)
    if (wbsItems.length) {
      html += '<optgroup label="WBS / Contrato">';
      wbsItems.forEach(it => {
        if (it.g2) return; // pula grupos de 2º nível
        const sel = selectedId === it.id ? 'selected' : '';
        html += `<option value="${it.id}" data-desc="${it.descricao}" ${sel}>${it.id} – ${it.descricao}</option>`;
      });
      html += '</optgroup>';
    }

    // Projetos Gantt → fases e tarefas
    projetos.forEach(proj => {
      if (!(proj.fases||[]).length) return;
      html += `<optgroup label="📋 ${proj.nome||proj.id}">`;
      (proj.fases||[]).forEach((fase, fi) => {
        (fase.tarefas||[]).forEach((t, ti) => {
          const codigo = `${proj.id}.${fi+1}.${ti+1}`;
          const sel    = selectedId === codigo ? 'selected' : '';
          html += `<option value="${codigo}" data-desc="${t.nome}" data-projeto="${proj.id}" data-cc="${proj.contrato_id||proj.id}" ${sel}>${fi+1}.${ti+1} ${t.nome}</option>`;
        });
        // Fase como opção nível 1 (se não tiver tarefas)
        if (!(fase.tarefas||[]).length) {
          const codigo = `${proj.id}.${fi+1}`;
          const sel    = selectedId === codigo ? 'selected' : '';
          html += `<option value="${codigo}" data-desc="${fase.nome}" data-projeto="${proj.id}" data-cc="${proj.contrato_id||proj.id}" ${sel}>${fi+1}. ${fase.nome}</option>`;
        }
      });
      html += '</optgroup>';
    });

    return html;
  } catch(e) {
    return '<option value="">— WBS não disponível —</option>';
  }
}

// Vincula custo realizado de uma OS a uma linha WBS (acumula no custo_real)
function _osAtualizarCustoWBS(os, valorCusto) {
  if (!os.wbs_id || !valorCusto || valorCusto <= 0) return;
  try {
    const raw = localStorage.getItem('fraser_custos_wbs');
    if (!raw) return;
    const itens = JSON.parse(raw);
    const idx = itens.findIndex(i => i.id === os.wbs_id);
    if (idx < 0) return;
    // Acumula no custo_real e recalcula spot/variação
    const custoAnterior = itens[idx].custo_real || 0;
    itens[idx].custo_real = custoAnterior + valorCusto;
    itens[idx].custo_spot = (itens[idx].custo_spot || 0) + valorCusto;
    // Recalcula variação
    const est = itens[idx].est_total || 0;
    itens[idx].variacao = est - itens[idx].custo_real;
    itens[idx].variacao_pct = est > 0 ? ((est - itens[idx].custo_real) / est) : 0;
    // Registra referência da OS
    if (!itens[idx].os_vinculadas) itens[idx].os_vinculadas = [];
    const jaVinculada = itens[idx].os_vinculadas.find(v => v.os_id === os.id);
    if (!jaVinculada) {
      itens[idx].os_vinculadas.push({
        os_id: os.id,
        descricao: os.descricao,
        valor: valorCusto,
        data: new Date().toLocaleDateString('pt-BR')
      });
    }
    localStorage.setItem('fraser_custos_wbs', JSON.stringify(itens));
    logAction('WBS Custo', 'Controle de Custos', `OS ${os.id} vinculou R$ ${valorCusto.toLocaleString('pt-BR')} à linha WBS ${os.wbs_id}`);
    showToast(`Custo de R$ ${valorCusto.toLocaleString('pt-BR', {minimumFractionDigits:2})} registrado na linha WBS ${os.wbs_id}!`, 'info', 5000);
  } catch(e) {
    console.error('Erro ao atualizar WBS:', e);
  }
}

// Armazenamento local de OS (persistido em localStorage)
function _getOSList() {
  try {
    const raw = localStorage.getItem('fa_ordens_servico');
    if (raw) return JSON.parse(raw);
  } catch(e) {}
  return JSON.parse(JSON.stringify(ERP_DATA.ordens)); // clone do inicial
}

function _saveOSList(list) {
  localStorage.setItem('fa_ordens_servico', JSON.stringify(list));
}

// Inicializa se vazio
(function() {
  const existing = localStorage.getItem('fa_ordens_servico');
  if (!existing) _saveOSList(ERP_DATA.ordens);
})();

// Gerador de número de OS
function _gerarNumeroOS() {
  const lista = _getOSList();
  const ano = new Date().getFullYear();
  const nums = lista.filter(o => o.id.startsWith('OS-' + ano)).map(o => {
    const parts = o.id.split('-');
    return parseInt(parts[2]) || 0;
  });
  const proximo = (nums.length ? Math.max(...nums) : 300) + 1;
  return `OS-${ano}-${String(proximo).padStart(4, '0')}`;
}

// ─── ALÇADAS DE APROVAÇÃO OS (mesmas regras de Pedidos de Compra) ────────────
const OS_LIMITE_GERENTE = 50000; // R$ 50.000 – igual ao limite de PC

function _podeAprovarOS(os) {
  const profile = currentUser?.profile;
  if (!profile) return false;
  if (profile === 'admin' || profile === 'diretor') return true;
  const custo = os.custo_estimado || 0;
  if (profile === 'operacao' && custo <= OS_LIMITE_GERENTE) return true;
  return false;
}

function _nivelAprovacaoOS(custo) {
  return custo > OS_LIMITE_GERENTE ? 'Diretor' : 'Gerente de Projeto';
}

function aprovarOS(id) {
  const lista = _getOSList();
  const idx   = lista.findIndex(o => o.id === id);
  if (idx < 0) { showToast('OS não encontrada.', 'error'); return; }
  const os = lista[idx];

  if (!_podeAprovarOS(os)) {
    const nivel = _nivelAprovacaoOS(os.custo_estimado || 0);
    openModal('⚠️ Aprovação Bloqueada', `
      <div style="text-align:center;padding:16px 0">
        <i class="fas fa-lock" style="color:#ef4444;font-size:40px;margin-bottom:12px"></i>
        <div style="font-size:15px;font-weight:700;color:#ef4444">Alçada Insuficiente</div>
      </div>
      <div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.3);border-radius:8px;padding:14px;margin:12px 0;font-size:13px;color:var(--text-secondary);line-height:1.6">
        <strong>OS:</strong> ${os.id}<br>
        <strong>Custo Estimado:</strong> R$ ${(os.custo_estimado||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}<br>
        <strong>Aprovação requerida:</strong> <span style="color:#f59e0b;font-weight:700">${nivel}</span><br><br>
        <i class="fas fa-info-circle" style="color:var(--fa-teal)"></i>
        OS até R$ ${OS_LIMITE_GERENTE.toLocaleString('pt-BR',{minimumFractionDigits:2})} → Gerente de Projeto<br>
        OS acima de R$ ${OS_LIMITE_GERENTE.toLocaleString('pt-BR',{minimumFractionDigits:2})} → Diretor
      </div>
    `, `<button class="btn btn-secondary" onclick="closeModal()">Entendido</button>`);
    return;
  }

  lista[idx].status = lista[idx].status_anterior_aprovacao || 'Em Andamento';
  delete lista[idx].status_anterior_aprovacao;
  lista[idx].aprovado_por = currentUser?.name || 'Sistema';
  lista[idx].data_aprovacao = new Date().toISOString();
  lista[idx].historico_aprovacoes = [...(lista[idx].historico_aprovacoes || []), {
    etapa: 'Aprovação OS', aprovado_por: currentUser?.name || 'Sistema',
    data: new Date().toLocaleDateString('pt-BR'), obs: 'Aprovado via painel'
  }];
  _saveOSList(lista);
  logAction('Aprovação OS', 'Ordens de Serviço', `${id} aprovada por ${lista[idx].aprovado_por}`);

  // ── Auto-geração de RC para itens de terceiros ──────────────────────────
  const osAprov = lista[idx];
  const itensCompra = osAprov.itens_compra || [];
  if (itensCompra.length > 0 && (osAprov.precisa_compra || osAprov.precisa_servico)) {
    // Filtra itens que ainda não geraram RC
    const itensSemRC = itensCompra.filter(it => !it.rc_gerada);
    if (itensSemRC.length > 0) {
      setTimeout(() => {
        if (typeof _criarRequisicaoDeOS === 'function') {
          _criarRequisicaoDeOS(osAprov, itensSemRC, osAprov.tipo_compra || 'Material');
          // Marca itens como RC gerada
          const listaAtual = _getOSList();
          const idxAt = listaAtual.findIndex(o => o.id === id);
          if (idxAt >= 0) {
            (listaAtual[idxAt].itens_compra || []).forEach(it => { it.rc_gerada = true; });
            _saveOSList(listaAtual);
          }
          showToast(`📋 RC gerada automaticamente para ${itensSemRC.length} item(ns) da OS ${id}!`, 'info', 6000);
        } else if (typeof reqEmitirRCAvulsa === 'function') {
          showToast(`📋 OS ${id} aprovada com ${itensSemRC.length} item(ns) pendentes de RC — acesse Suprimentos para emitir.`, 'info', 7000);
        }
      }, 500);
    }
  }

  showToast(`✅ OS ${id} aprovada! Status: ${lista[idx].status}`, 'success');
  renderOS();
}

function reprovarOS(id) {
  const lista = _getOSList();
  const idx   = lista.findIndex(o => o.id === id);
  if (idx < 0) return;
  lista[idx].status = 'Cancelada';
  lista[idx].reprovado_por = currentUser?.name || 'Sistema';
  lista[idx].data_reprovacao = new Date().toISOString();
  _saveOSList(lista);
  logAction('Reprovação OS', 'Ordens de Serviço', `${id} reprovada`);
  showToast(`OS ${id} reprovada e cancelada.`, 'warning');
  renderOS();
}

function renderOS() {
  // Verifica permissão padrão E a config customizada de perfis
  const podeVerOS = (typeof _podeAcessarOS === 'function') ? _podeAcessarOS() : hasPermission('os', 'view');
  if (!podeVerOS) {
    renderAcessoNegado(); return;
  }
  const ordens = _getOSList();
  const main = document.getElementById('mainContent');

  const totais = {
    total: ordens.length,
    andamento: ordens.filter(o => o.status === 'Em Andamento').length,
    concluidas: ordens.filter(o => o.status === 'Concluída').length,
    criticas: ordens.filter(o => o.prioridade === 'Crítica').length,
    agendadas: ordens.filter(o => o.status === 'Agendada').length,
    aguardAprov: ordens.filter(o => o.status === 'Aguardando Aprovação').length,
  };

  // OS aguardando aprovação que o usuário atual pode aprovar
  const osAguardAprov = ordens.filter(o => o.status === 'Aguardando Aprovação');

  main.innerHTML = `
    <div class="page-header">
      <div class="page-title">
        <h2><i class="fas fa-clipboard-list" style="color:var(--orange);margin-right:8px"></i>Ordens de Serviço</h2>
        <p>${totais.total} ordens no sistema · ${totais.andamento} em andamento · ${totais.aguardAprov} aguardando aprovação</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary btn-sm" onclick="exportarOSExcel()">
          <i class="fas fa-file-excel"></i> Excel
        </button>
        ${hasPermission('os', 'create') ? `
        <button class="btn btn-primary btn-sm" onclick="openNovaOS()">
          <i class="fas fa-plus"></i> Nova OS
        </button>` : ''}
      </div>
    </div>

    <!-- KPIs -->
    <div class="kpi-grid" style="grid-template-columns: repeat(6, 1fr)">
      <div class="kpi-card kpi-blue">
        <div class="kpi-icon"><i class="fas fa-clipboard-list"></i></div>
        <div class="kpi-value">${totais.total}</div>
        <div class="kpi-label">Total OS</div>
      </div>
      <div class="kpi-card kpi-orange">
        <div class="kpi-icon"><i class="fas fa-spinner"></i></div>
        <div class="kpi-value">${totais.andamento}</div>
        <div class="kpi-label">Em Andamento</div>
      </div>
      <div class="kpi-card kpi-green">
        <div class="kpi-icon"><i class="fas fa-check-circle"></i></div>
        <div class="kpi-value">${totais.concluidas}</div>
        <div class="kpi-label">Concluídas</div>
      </div>
      <div class="kpi-card kpi-red">
        <div class="kpi-icon"><i class="fas fa-exclamation-circle"></i></div>
        <div class="kpi-value">${totais.criticas}</div>
        <div class="kpi-label">Prioridade Crítica</div>
      </div>
      <div class="kpi-card kpi-yellow">
        <div class="kpi-icon"><i class="fas fa-calendar-alt"></i></div>
        <div class="kpi-value">${totais.agendadas}</div>
        <div class="kpi-label">Agendadas</div>
      </div>
      <div class="kpi-card ${totais.aguardAprov > 0 ? 'kpi-orange' : 'kpi-green'}" style="cursor:${totais.aguardAprov>0?'pointer':'default'}"
        onclick="${totais.aguardAprov>0?"document.getElementById('secOSAprovacao').scrollIntoView({behavior:'smooth'})":""}">
        <div class="kpi-icon"><i class="fas fa-user-check"></i></div>
        <div class="kpi-value">${totais.aguardAprov}</div>
        <div class="kpi-label">Aguard. Aprovação</div>
      </div>
    </div>

    <!-- Seção: OS aguardando aprovação -->
    ${osAguardAprov.length > 0 ? `
    <div id="secOSAprovacao" class="card" style="margin-bottom:16px;border-left:4px solid #f59e0b">
      <div class="card-header" style="background:rgba(245,158,11,0.06)">
        <h3 style="margin:0;color:#b45309">
          <i class="fas fa-user-check" style="margin-right:8px"></i>OS Aguardando Aprovação
        </h3>
        <span class="badge badge-warning">${osAguardAprov.length} pendente(s)</span>
      </div>
      <div style="padding:7px 16px 4px;font-size:11px;color:var(--text-muted);background:rgba(245,158,11,0.04)">
        <i class="fas fa-info-circle" style="color:#f59e0b;margin-right:4px"></i>
        <strong>Alçada:</strong> Até R$ ${OS_LIMITE_GERENTE.toLocaleString('pt-BR',{minimumFractionDigits:2})} → Gerente &nbsp;| Acima → Diretor
      </div>
      ${osAguardAprov.map(os => {
        const nivel = _nivelAprovacaoOS(os.custo_estimado || 0);
        const podeApr = _podeAprovarOS(os);
        return `
        <div class="alert alert-warning" style="margin:4px 16px">
          <span class="alert-icon"><i class="fas fa-clipboard-list"></i></span>
          <div style="flex:1">
            <div class="alert-title">${os.id} – ${os.descricao}</div>
            <div class="alert-desc">${os.contrato || '—'} · ${os.tipo || '—'} · <strong style="color:#b45309">
              ${os.custo_estimado > 0 ? 'R$ '+os.custo_estimado.toLocaleString('pt-BR',{minimumFractionDigits:2}) : 'Sem custo estimado'}
            </strong>
            &nbsp;·&nbsp;<span class="badge ${nivel==='Diretor'?'badge-danger':'badge-warning'}" style="font-size:9px"><i class="fas fa-user-tie"></i> ${nivel}</span>
            </div>
          </div>
          <div style="display:flex;gap:6px;margin-left:8px;flex-shrink:0">
            <button class="btn btn-secondary btn-sm btn-icon" onclick="verDetalheOS('${os.id}')" title="Ver detalhes"><i class="fas fa-eye"></i></button>
            ${podeApr
              ? `<button class="btn btn-success btn-sm" onclick="aprovarOS('${os.id}')"><i class="fas fa-check"></i> Aprovar</button>`
              : `<button class="btn btn-secondary btn-sm" disabled title="Sem alçada suficiente"><i class="fas fa-lock"></i> Sem Alçada</button>`
            }
            <button class="btn btn-danger btn-sm" onclick="reprovarOS('${os.id}')"><i class="fas fa-times"></i> Reprovar</button>
          </div>
        </div>`;
      }).join('')}
      <div style="height:8px"></div>
    </div>
    ` : ''}

    <!-- Busca e Filtros -->
    <div class="card page-section">
      <div class="search-bar">
        <div class="search-input-wrapper">
          <i class="fas fa-search"></i>
          <input class="search-input" type="text" placeholder="Buscar OS por número, descrição, cliente..." id="searchOS" oninput="filterOS()">
        </div>
        <select class="filter-select" id="filterOSStatus" onchange="filterOS()">
          <option value="">Todos os Status</option>
          <option>Aguardando Aprovação</option>
          <option>Em Andamento</option>
          <option>Concluída</option>
          <option>Agendada</option>
          <option>Pausada</option>
          <option>Aguardando Peça</option>
          <option>Cancelada</option>
        </select>
        <select class="filter-select" id="filterOSTipo" onchange="filterOS()">
          <option value="">Todos os Tipos</option>
          <option>Preventiva</option>
          <option>Corretiva</option>
          <option>Inspeção</option>
          <option>Projeto</option>
        </select>
        <select class="filter-select" id="filterOSPrioridade" onchange="filterOS()">
          <option value="">Todas as Prioridades</option>
          <option>Crítica</option>
          <option>Alta</option>
          <option>Normal</option>
        </select>
      </div>

      <div id="tabelaOS">
        ${renderTabelaOS(_getOSList())}
      </div>
    </div>
  `;
}

function renderTabelaOS(ordens) {
  if (!ordens.length) return `<div class="empty-state" style="padding:40px"><i class="fas fa-clipboard-list" style="color:var(--text-muted)"></i><p>Nenhuma OS encontrada</p></div>`;
  return `
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Nº OS</th>
            <th>Descrição</th>
            <th>Cliente</th>
            <th>Tipo</th>
            <th>Prioridade</th>
            <th>Equipe</th>
            <th>HH</th>
            <th>Prazo</th>
            <th>Progresso</th>
            <th>Status</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          ${ordens.map(os => `
            <tr>
              <td>
                <span style="color:var(--orange);font-weight:700;font-size:12px">${os.id}</span>
                <div style="font-size:10px;color:var(--text-muted)">${os.contrato || ''}</div>
              </td>
              <td>
                <div style="font-weight:500;font-size:13px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${os.descricao}">${os.descricao}</div>
                <div style="font-size:11px;color:var(--text-muted)"><i class="fas fa-map-marker-alt" style="font-size:9px"></i> ${os.local || ''}</div>
              </td>
              <td style="font-size:12px">${os.cliente || '—'}</td>
              <td><span class="badge badge-muted">${os.tipo || ''}</span></td>
              <td>${prioridade(os.prioridade)}</td>
              <td style="text-align:center">
                <span style="display:inline-flex;align-items:center;gap:4px;font-size:12px">
                  <i class="fas fa-users" style="color:var(--text-muted)"></i> ${os.equipe || 0}
                </span>
              </td>
              <td style="text-align:center;font-size:12px">${os.horas || 0}h</td>
              <td style="font-size:12px;color:${os.prioridade === 'Crítica' ? 'var(--red-light)' : 'var(--text-secondary)'}">
                ${os.prazo || '—'}
              </td>
              <td style="min-width:80px">
                <div style="font-size:11px;font-weight:600;margin-bottom:2px">${os.progress || 0}%</div>
                <div class="progress">
                  <div class="progress-bar ${(os.progress||0) === 100 ? 'green' : (os.progress||0) >= 50 ? '' : 'red'}" style="width:${os.progress||0}%"></div>
                </div>
              </td>
              <td>${statusBadge(os.status)}</td>
              <td>
                <div class="actions-cell">
                  <button class="btn btn-secondary btn-sm btn-icon" onclick="verDetalheOS('${os.id}')" title="Ver Detalhes">
                    <i class="fas fa-eye"></i>
                  </button>
                  ${os.status === 'Aguardando Aprovação' ? `
                    ${_podeAprovarOS(os) ? `<button class="btn btn-success btn-sm btn-icon" onclick="aprovarOS('${os.id}')" title="Aprovar OS"><i class="fas fa-check"></i></button>` : ''}
                    <button class="btn btn-danger btn-sm btn-icon" onclick="reprovarOS('${os.id}')" title="Reprovar OS"><i class="fas fa-times"></i></button>
                  ` : `
                  ${hasPermission('os', 'edit') ? `
                  <button class="btn btn-info btn-sm btn-icon" onclick="editarOS('${os.id}')" title="Editar OS">
                    <i class="fas fa-edit"></i>
                  </button>` : ''}
                  <button class="btn btn-success btn-sm btn-icon" onclick="apontarHorasOS('${os.id}')" title="Apontar Horas">
                    <i class="fas fa-clock"></i>
                  </button>
                  <button class="btn btn-warning btn-sm btn-icon" onclick="abrirChecklistOS('${os.id}')" title="Checklist">
                    <i class="fas fa-tasks"></i>
                  </button>
                  <button class="btn btn-sm btn-icon" onclick="abrirAcaoMaterialOS('${os.id}','${os.descricao.replace(/'/g,"\\'")||''}')" title="Compras / RC" style="background:rgba(230,126,34,0.2);color:var(--orange);border:1px solid rgba(230,126,34,0.4)">
                    <i class="fas fa-shopping-cart"></i>
                  </button>
                  `}
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function filterOS() {
  const search = (document.getElementById('searchOS').value || '').toLowerCase();
  const status = document.getElementById('filterOSStatus').value;
  const tipo = document.getElementById('filterOSTipo').value;
  const prior = document.getElementById('filterOSPrioridade').value;

  let filtered = _getOSList().filter(o => {
    const matchSearch = !search || (o.id + o.descricao + (o.cliente||'')).toLowerCase().includes(search);
    const matchStatus = !status || o.status === status;
    const matchTipo = !tipo || o.tipo === tipo;
    const matchPrior = !prior || o.prioridade === prior;
    return matchSearch && matchStatus && matchTipo && matchPrior;
  });

  document.getElementById('tabelaOS').innerHTML = renderTabelaOS(filtered);
}

function verDetalheOS(id) {
  const os = _getOSList().find(o => o.id === id);
  if (!os) return;

  // Apontamentos existentes
  const aponts = _getApontamentosOS(id);
  const totalHH = aponts.reduce((a, x) => a + (x.horas || 0), 0);

  openModalWide(`OS ${os.id}`, `
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
      ${statusBadge(os.status)}
      ${prioridade(os.prioridade)}
      <span class="badge badge-muted">${os.tipo}</span>
    </div>

    <div class="form-row">
      <div>
        <div class="stat-row"><span class="stat-label">Descrição</span><span class="stat-value" style="font-size:12px;max-width:280px;text-align:right">${os.descricao}</span></div>
        <div class="stat-row"><span class="stat-label">Contrato</span><span class="stat-value" style="color:var(--orange)">${os.contrato || '—'}</span></div>
        <div class="stat-row"><span class="stat-label">Cliente</span><span class="stat-value">${os.cliente || '—'}</span></div>
        <div class="stat-row"><span class="stat-label">Local</span><span class="stat-value">${os.local || '—'}</span></div>
        <div class="stat-row"><span class="stat-label">Responsável</span><span class="stat-value">${os.responsavel || '—'}</span></div>
        <div class="stat-row"><span class="stat-label">Equipe</span><span class="stat-value">${os.equipe || 0} colaboradores</span></div>
      </div>
      <div>
        <div class="stat-row"><span class="stat-label">Horas Previstas</span><span class="stat-value">${os.horas || 0}h</span></div>
        <div class="stat-row"><span class="stat-label">HH Apontadas</span><span class="stat-value" style="color:var(--green-light)">${totalHH}h</span></div>
        <div class="stat-row"><span class="stat-label">Abertura</span><span class="stat-value">${os.abertura || '—'}</span></div>
        <div class="stat-row"><span class="stat-label">Prazo</span><span class="stat-value" style="color:${os.prioridade === 'Crítica' ? 'var(--red-light)' : ''}">${os.prazo || '—'}</span></div>
        ${os.observacoes ? `<div class="stat-row"><span class="stat-label">Observações</span><span class="stat-value" style="font-size:11px;max-width:200px;text-align:right">${os.observacoes}</span></div>` : ''}
      </div>
    </div>

    ${os.wbs_id ? (() => {
      // Busca dados da linha WBS para mostrar status de burn/atraso
      const wbsAll = (() => { try { return JSON.parse(localStorage.getItem('fraser_custos_wbs')||'[]'); } catch(e){ return []; } })();
      const wbsItem = wbsAll.find(i => i.id === os.wbs_id);
      const wbsBurn = wbsItem && wbsItem.est_total > 0 ? ((wbsItem.custo_real||0) / wbsItem.est_total * 100).toFixed(1) : null;
      const wbsDisp = wbsItem ? ((wbsItem.est_total||0) - (wbsItem.custo_real||0)) : null;
      const isNP = os.wbs_nao_previsto || (wbsItem?.nao_previsto);
      const isAtrasada = os.prioridade === 'Crítica' && os.status !== 'Concluída';
      const burnColor = wbsBurn > 100 ? '#ef4444' : wbsBurn > 90 ? '#f59e0b' : '#10b981';
      const borderColor = isNP ? 'rgba(239,68,68,0.35)' : 'rgba(16,185,129,0.25)';
      const bgColor = isNP ? 'rgba(239,68,68,0.06)' : 'rgba(16,185,129,0.07)';
      const titleColor = isNP ? '#ef4444' : '#10b981';
      return `
    <div style="background:${bgColor};border:1px solid ${borderColor};border-radius:8px;padding:14px;margin-top:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div style="font-size:12px;font-weight:700;color:${titleColor}">
          <i class="fas fa-sitemap" style="margin-right:6px"></i>Linha WBS Vinculada
          ${isNP ? '<span style="background:rgba(239,68,68,0.15);color:#ef4444;border-radius:4px;padding:2px 6px;font-size:10px;margin-left:6px">⚠ Item Não Previsto</span>' : ''}
        </div>
        ${wbsBurn !== null ? `<span style="font-size:11px;font-weight:600;background:${burnColor}22;color:${burnColor};border-radius:6px;padding:2px 8px">Burn: ${wbsBurn}%</span>` : ''}
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px">
        <div>
          <div style="font-size:10px;color:var(--text-muted)">CÓDIGO WBS</div>
          <div style="font-size:14px;font-weight:700;color:${titleColor}">${os.wbs_id}</div>
        </div>
        <div>
          <div style="font-size:10px;color:var(--text-muted)">DESCRIÇÃO</div>
          <div style="font-size:12px;color:var(--text-primary)">${os.wbs_descricao || wbsItem?.descricao || '—'}</div>
        </div>
        <div>
          <div style="font-size:10px;color:var(--text-muted)">NATUREZA</div>
          <div style="font-size:12px;color:var(--text-secondary)">${os.wbs_natureza || wbsItem?.natureza || '—'}</div>
        </div>
        <div>
          <div style="font-size:10px;color:var(--text-muted)">ORÇADO WBS</div>
          <div style="font-size:13px;font-weight:600;color:var(--fa-teal)">${wbsItem ? (wbsItem.est_total||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}) : '—'}</div>
        </div>
        <div>
          <div style="font-size:10px;color:var(--text-muted)">REALIZADO WBS</div>
          <div style="font-size:13px;font-weight:600;color:${wbsBurn > 100 ? '#ef4444' : 'var(--text-primary)'}">${wbsItem ? (wbsItem.custo_real||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}) : (os.custo_realizado||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0})}</div>
        </div>
        ${wbsDisp !== null ? `
        <div>
          <div style="font-size:10px;color:var(--text-muted)">DISPONÍVEL</div>
          <div style="font-size:13px;font-weight:700;color:${wbsDisp >= 0 ? '#22c55e' : '#ef4444'}">${Math.abs(wbsDisp).toLocaleString('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0})}${wbsDisp < 0 ? ' ⚠' : ''}</div>
        </div>` : ''}
        <div>
          <div style="font-size:10px;color:var(--text-muted)">CUSTO ESTA OS</div>
          <div style="font-size:12px;color:var(--text-secondary)">${(os.custo_estimado||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0})} est. / ${(os.custo_realizado||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0})} real.</div>
        </div>
      </div>
      ${wbsBurn > 90 ? `<div style="margin-top:8px;padding:6px 10px;background:${wbsBurn>100?'rgba(239,68,68,0.1)':'rgba(245,158,11,0.1)'};border-radius:6px;font-size:11px;color:${wbsBurn>100?'#ef4444':'#f59e0b'}"><i class="fas fa-exclamation-triangle" style="margin-right:4px"></i>${wbsBurn>100?'ORÇAMENTO ESTOURADO! Solicite aprovação adicional.':'Atenção: burn rate elevado. Monitore os custos.'}</div>` : ''}
      <div style="margin-top:8px;display:flex;gap:6px">
        <button class="btn btn-sm" style="background:#10b981;color:#fff;font-size:11px;padding:4px 10px" onclick="closeModal();navigate('custos')"><i class="fas fa-chart-line" style="margin-right:4px"></i>Ver no Módulo Custos</button>
        <button class="btn btn-sm btn-secondary" style="font-size:11px" onclick="closeModal();switchTabContrato('wbs');navigate('contratos')"><i class="fas fa-sitemap" style="margin-right:4px"></i>Ver WBS do Contrato</button>
      </div>
    </div>`;
    })() : `
    <div style="background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.2);border-radius:8px;padding:10px;margin-top:10px;font-size:11px;color:#f59e0b">
      <i class="fas fa-exclamation-triangle" style="margin-right:6px"></i>OS não vinculada a nenhuma linha WBS. Edite a OS para vincular ao controle de custos do projeto.
    </div>`}

    <div style="margin-top:12px">
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px">Progresso da OS</div>
      <div class="progress" style="height:10px">
        <div class="progress-bar ${(os.progress||0) === 100 ? 'green' : ''}" style="width:${os.progress||0}%"></div>
      </div>
      <div style="font-size:12px;color:var(--text-secondary);margin-top:4px">${os.progress || 0}% concluído</div>
    </div>

    ${aponts.length ? `
      <div style="margin-top:16px">
        <div style="font-size:12px;font-weight:700;color:var(--text-primary);margin-bottom:8px"><i class="fas fa-clock" style="color:var(--fa-teal);margin-right:6px"></i>Apontamentos de Horas</div>
        <div class="table-wrapper" style="max-height:150px;overflow-y:auto">
          <table style="font-size:11px">
            <thead><tr><th>Data</th><th>Colaborador</th><th>Horas</th><th>Atividade</th></tr></thead>
            <tbody>
              ${aponts.map(a => `<tr><td>${a.data}</td><td>${a.colaborador}</td><td style="color:var(--green-light);font-weight:600">${a.horas}h</td><td>${a.atividade || ''}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    ` : ''}

    ${(os.itens_compra && os.itens_compra.length > 0) ? `
      <div style="margin-top:14px;background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.25);border-radius:8px;padding:12px">
        <div style="font-size:12px;font-weight:700;color:#f59e0b;margin-bottom:8px"><i class="fas fa-boxes" style="margin-right:6px"></i>Itens de Compra / Serviço (${os.itens_compra.length})</div>
        <div class="table-wrapper" style="max-height:180px;overflow-y:auto">
          <table style="font-size:11px;width:100%">
            <thead><tr style="background:var(--bg-tertiary)">
              <th style="padding:5px 8px;text-align:left">Descrição</th>
              <th style="padding:5px 8px;text-align:center;width:45px">Qtd</th>
              <th style="padding:5px 8px;text-align:center;width:40px">Un</th>
              <th style="padding:5px 8px;text-align:left"><i class="fas fa-sitemap" style="color:#3b82f6;margin-right:3px"></i>WBS Vinculado</th>
            </tr></thead>
            <tbody>
              ${os.itens_compra.map(it => `<tr>
                <td style="padding:4px 8px;font-weight:500">${it.descricao || '—'}</td>
                <td style="padding:4px 8px;text-align:center">${it.qtd || 1}</td>
                <td style="padding:4px 8px;text-align:center;color:var(--text-muted)">${it.unidade || 'Un'}</td>
                <td style="padding:4px 8px">${it.wbs_codigo
                  ? `<span style="font-size:10px;background:rgba(59,130,246,0.12);color:#3b82f6;border-radius:4px;padding:2px 7px;font-weight:600">${it.wbs_codigo}</span>${it.wbs_descricao ? ` <span style="font-size:10px;color:var(--text-muted)">${it.wbs_descricao}</span>` : ''}`
                  : '<span style="font-size:10px;color:var(--text-muted)">— Sem WBS —</span>'
                }</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    ` : ''}

    ${os.status === 'Aguardando Peça' ? `
      <div class="alert alert-danger" style="margin-top:12px">
        <span class="alert-icon"><i class="fas fa-exclamation-circle"></i></span>
        <div><div class="alert-title">Aguardando Material</div><div class="alert-desc">OS bloqueada por falta de peça. Verificar almoxarifado ou gerar requisição de compra.</div></div>
      </div>
    ` : ''}
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
    <button class="btn btn-info" onclick="closeModal();editarOS('${os.id}')">
      <i class="fas fa-edit"></i> Editar
    </button>
    <button class="btn btn-success" onclick="closeModal();apontarHorasOS('${os.id}')">
      <i class="fas fa-clock"></i> Apontar Horas
    </button>
    <button class="btn btn-warning" onclick="closeModal();abrirChecklistOS('${os.id}')">
      <i class="fas fa-tasks"></i> Checklist
    </button>
    <button class="btn btn-primary" onclick="closeModal();abrirAcaoMaterialOS('${os.id}','${os.descricao.replace(/'/g,"\\'").replace(/"/g,"&quot;")}')" title="Comprar Material ou contratar Serviço Externo" style="background:linear-gradient(135deg,var(--orange),#e67e22)">
      <i class="fas fa-shopping-cart"></i> Compras/RC
    </button>
  `);
}

function openNovaOS() {
  if (!hasPermission('os', 'create')) { showToast('Sem permissão para criar OS', 'error'); return; }

  openModalWide('Nova Ordem de Serviço', `
    <div class="form-row">
      <div class="form-group">
        <label>Contrato *</label>
        <select class="form-control" id="nos_contrato" onchange="_nosContratoChange()">
          <option value="">Selecione...</option>
          ${ERP_DATA.contratos.filter(c => c.status === 'Ativo' || c.status === 'Mobilização').map(c =>
            `<option value="${c.id}">${c.id} – ${c.cliente}</option>`
          ).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Tipo *</label>
        <select class="form-control" id="nos_tipo">
          <option>Preventiva</option>
          <option>Corretiva</option>
          <option>Inspeção</option>
          <option>Projeto</option>
        </select>
      </div>
    </div>
    <div class="form-group">
      <label>Descrição do Serviço *</label>
      <input class="form-control" id="nos_descricao" type="text" placeholder="Descreva o serviço a ser executado">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Prioridade</label>
        <select class="form-control" id="nos_prioridade">
          <option>Normal</option>
          <option>Alta</option>
          <option>Crítica</option>
        </select>
      </div>
      <div class="form-group">
        <label>Status Inicial</label>
        <select class="form-control" id="nos_status">
          <option>Agendada</option>
          <option>Em Andamento</option>
          <option>Pausada</option>
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Responsável</label>
        <input class="form-control" id="nos_responsavel" type="text" placeholder="Nome do responsável">
      </div>
      <div class="form-group">
        <label>Equipe (nº pessoas)</label>
        <input class="form-control" id="nos_equipe" type="number" min="1" placeholder="0">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Prazo de Conclusão *</label>
        <input class="form-control" id="nos_prazo" type="date">
      </div>
      <div class="form-group">
        <label>Horas Previstas (HH)</label>
        <input class="form-control" id="nos_horas" type="number" min="1" placeholder="0">
      </div>
    </div>
    <div class="form-group">
      <label>Local / Área</label>
      <input class="form-control" id="nos_local" type="text" placeholder="Ex: Área 07 – Britagem">
    </div>

    <!-- VÍNCULO WBS -->
    <div style="background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.25);border-radius:8px;padding:14px;margin-top:4px;margin-bottom:4px">
      <div style="font-size:12px;font-weight:600;color:#10b981;margin-bottom:10px"><i class="fas fa-sitemap" style="margin-right:6px"></i>Linha de Custo WBS do Projeto</div>
      <div class="form-group" style="margin-bottom:8px">
        <label style="font-size:12px">Linha WBS vinculada <span style="color:var(--text-muted);font-weight:400">(filtrada pelo contrato selecionado)</span></label>
        <select class="form-control" id="nos_wbs_id" style="font-size:12px" onchange="_nosWBSChange()">
          <option value="">— Selecione o contrato primeiro —</option>
        </select>
        <div style="font-size:10px;color:var(--text-muted);margin-top:4px">
          <i class="fas fa-info-circle" style="margin-right:3px"></i>O custo real desta OS será lançado automaticamente na linha WBS selecionada ao concluir.
          <span style="color:#ef4444;margin-left:6px">Se não encontrar a linha, selecione <b>⚠ Item Não Previsto</b>.</span>
        </div>
      </div>
      <div id="nos_wbs_info" style="display:none;border:1px solid rgba(16,185,129,0.25);border-radius:6px;padding:8px;font-size:11px;margin-bottom:8px"></div>
      <div class="form-row" style="margin-top:8px">
        <div class="form-group" style="margin-bottom:0">
          <label style="font-size:12px">Custo Estimado da OS (R$)</label>
          <input class="form-control" id="nos_custo_est" type="number" min="0" step="0.01" placeholder="0,00" style="font-size:12px">
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label style="font-size:12px">Custo Realizado (R$) <span style="color:var(--text-muted);font-weight:400">preencher ao concluir</span></label>
          <input class="form-control" id="nos_custo_real" type="number" min="0" step="0.01" placeholder="0,00" style="font-size:12px">
        </div>
      </div>
    </div>

    <div class="form-group">
      <label>Observações</label>
      <textarea class="form-control" id="nos_obs" rows="2" placeholder="Informações adicionais..."></textarea>
    </div>

    <!-- NECESSIDADE DE COMPRA / SERVIÇO EXTERNO -->
    <div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.3);border-radius:8px;padding:14px;margin-top:10px">
      <div style="font-size:12px;font-weight:600;color:#f59e0b;margin-bottom:10px"><i class="fas fa-shopping-cart"></i> Necessidade de Compra ou Serviço Externo</div>
      <div style="display:flex;gap:16px;margin-bottom:10px">
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;color:var(--text-secondary)">
          <input type="checkbox" id="nos_compra_material" style="accent-color:var(--orange)"> Compra de Material
        </label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;color:var(--text-secondary)">
          <input type="checkbox" id="nos_servico_externo" style="accent-color:var(--orange)"> Serviço Externo / Locação
        </label>
      </div>
      <div id="nos_itens_compra_wrap" style="display:none">
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px">
          Informe os itens a requisitar. Vincule cada item à linha WBS correspondente do projeto.
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:12px" id="nos_itens_table">
          <thead><tr style="background:var(--bg-tertiary)">
            <th style="padding:6px 8px;text-align:left">Descrição do Item</th>
            <th style="padding:6px 8px;text-align:center;width:55px">Qtd</th>
            <th style="padding:6px 8px;text-align:center;width:52px">Un</th>
            <th style="padding:6px 8px;text-align:left;min-width:160px">
              <i class="fas fa-sitemap" style="color:#3b82f6;margin-right:4px"></i>Linha WBS
            </th>
            <th style="padding:6px 8px;text-align:center;width:36px"></th>
          </tr></thead>
          <tbody id="nos_itens_body">
            <tr>
              <td style="padding:4px"><input type="text" placeholder="Ex: Rolamento 6208-ZZ" class="form-control nos-item-desc" style="font-size:12px;padding:5px 8px"></td>
              <td style="padding:4px"><input type="number" value="1" min="1" class="form-control nos-item-qtd" style="font-size:12px;padding:5px 8px;text-align:center"></td>
              <td style="padding:4px"><input type="text" value="Un" class="form-control nos-item-un" style="font-size:12px;padding:5px 8px;text-align:center"></td>
              <td style="padding:4px">
                <select class="form-control nos-item-wbs" style="font-size:11px;padding:4px 6px">
                  ${_osWBSInlineOptions()}
                </select>
              </td>
              <td style="padding:4px;text-align:center"><button onclick="this.closest('tr').remove()" class="btn btn-sm btn-danger"><i class="fas fa-trash"></i></button></td>
            </tr>
          </tbody>
        </table>
        <button onclick="addItemNosCompra()" class="btn btn-secondary btn-sm" style="margin-top:6px"><i class="fas fa-plus"></i> Item</button>
      </div>
    </div>

    <div id="nos_erro" style="display:none;color:var(--red-light);font-size:12px;margin-top:8px;background:rgba(239,68,68,0.1);padding:8px 12px;border-radius:6px"></div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="salvarNovaOS()">
      <i class="fas fa-save"></i> Criar OS
    </button>
  `);

  // Mostrar/esconder campo de itens conforme checkbox
  setTimeout(() => {
    const cbMat = document.getElementById('nos_compra_material');
    const cbSvc = document.getElementById('nos_servico_externo');
    const wrap = document.getElementById('nos_itens_compra_wrap');
    const toggleWrap = () => {
      if (wrap) wrap.style.display = (cbMat?.checked || cbSvc?.checked) ? 'block' : 'none';
    };
    if (cbMat) cbMat.addEventListener('change', toggleWrap);
    if (cbSvc) cbSvc.addEventListener('change', toggleWrap);
  }, 100);
}

// Atualiza o select WBS quando o contrato muda
function _nosContratoChange() {
  const contrato = document.getElementById('nos_contrato')?.value;
  const selWbs = document.getElementById('nos_wbs_id');
  const info   = document.getElementById('nos_wbs_info');
  if (!selWbs) return;
  if (!contrato) {
    selWbs.innerHTML = '<option value="">— Selecione o contrato primeiro —</option>';
    if (info) info.style.display = 'none';
    return;
  }
  // Usa wbs_manager se disponível (filtrado por contrato)
  if (typeof wbsGetOptionsForContrato === 'function') {
    selWbs.innerHTML = wbsGetOptionsForContrato(contrato, '');
  } else {
    selWbs.innerHTML = _osWBSOptions('', contrato);
  }
  if (info) info.style.display = 'none';
}

// Exibe info da linha WBS selecionada no form Nova OS
function _nosWBSChange() {
  const sel = document.getElementById('nos_wbs_id');
  const info = document.getElementById('nos_wbs_info');
  const contratoId = document.getElementById('nos_contrato')?.value;
  if (!sel || !info) return;
  const wbsId = sel.value;

  // Item não previsto
  if (wbsId === 'NP') {
    info.style.display = 'block';
    info.style.background = 'rgba(239,68,68,0.08)';
    info.style.color = '#ef4444';
    info.innerHTML = `<i class="fas fa-exclamation-triangle" style="margin-right:6px"></i><strong>Item Não Previsto:</strong> Uma nova linha WBS será criada automaticamente ao salvar esta OS. Preencha as observações com a justificativa.`;
    return;
  }

  if (!wbsId) { info.style.display = 'none'; return; }

  // Usa wbs_manager se disponível
  if (typeof wbsSelectOnChange === 'function') {
    wbsSelectOnChange(sel, contratoId, 'nos_wbs_info');
    return;
  }

  const itens = _osGetWBSItens();
  const item = itens.find(i => i.id === wbsId);
  if (!item) { info.style.display = 'none'; return; }
  const est  = Number(item.est_total || 0).toLocaleString('pt-BR', {style:'currency', currency:'BRL', maximumFractionDigits:0});
  const real = Number(item.custo_real || 0).toLocaleString('pt-BR', {style:'currency', currency:'BRL', maximumFractionDigits:0});
  const disp = (item.est_total||0) - (item.custo_real||0);
  const dispColor = disp >= 0 ? '#22c55e' : '#ef4444';
  info.style.display = 'block';
  info.style.background = 'rgba(16,185,129,0.08)';
  info.style.color = '#10b981';
  info.innerHTML = `
    <div style="display:flex;flex-wrap:wrap;gap:12px;font-size:11px">
      <div><span style="color:var(--text-muted)">LINHA</span><br><strong>${item.id}</strong></div>
      <div><span style="color:var(--text-muted)">NATUREZA</span><br><strong>${item.natureza||'—'}</strong></div>
      <div><span style="color:var(--text-muted)">ORÇADO</span><br><strong style="color:var(--fa-teal)">${est}</strong></div>
      <div><span style="color:var(--text-muted)">REALIZADO</span><br><strong>${real}</strong></div>
      <div><span style="color:var(--text-muted)">DISPONÍVEL</span><br><strong style="color:${dispColor}">R$ ${Math.abs(disp).toLocaleString('pt-BR',{maximumFractionDigits:0})}${disp<0?' (estourado)':''}</strong></div>
    </div>`;
  if (item.nao_previsto) {
    info.innerHTML += '<div style="margin-top:4px"><span style="background:rgba(239,68,68,0.1);color:#ef4444;border-radius:4px;padding:2px 6px;font-size:10px">⚠ Item anteriormente não previsto</span></div>';
  }
}
window._nosWBSChange = _nosWBSChange;

function salvarNovaOS() {
  const contrato = document.getElementById('nos_contrato').value;
  const descricao = document.getElementById('nos_descricao').value.trim();
  const prazo = document.getElementById('nos_prazo').value;
  const erroEl = document.getElementById('nos_erro');

  const mostrarErro = (msg) => { erroEl.textContent = msg; erroEl.style.display = 'block'; };

  if (!contrato) { mostrarErro('Selecione um contrato.'); return; }
  if (!descricao) { mostrarErro('Informe a descrição do serviço.'); return; }
  if (!prazo) { mostrarErro('Informe o prazo de conclusão.'); return; }

  // ── BLOQUEIO OBRIGATÓRIO: Estrutura de Rastreabilidade ──────────────
  // Toda OS deve estar vinculada a uma estrutura de rastreabilidade (WBS/linha).
  // Sem esse vínculo, custos e execução não podem ser rastreados.
  const wbsIdCheck = document.getElementById('nos_wbs_id')?.value || '';
  if (!wbsIdCheck) {
    mostrarErro('⚠️ Vínculo obrigatório: selecione a Linha da Estrutura de Rastreabilidade antes de salvar a OS.');
    document.getElementById('nos_wbs_id')?.focus();
    return;
  }

  erroEl.style.display = 'none';

  const contratoDados = ERP_DATA.contratos.find(c => c.id === contrato);
  const wbsIdRaw = document.getElementById('nos_wbs_id')?.value || '';
  const isNaoP   = wbsIdRaw === 'NP';
  const wbsItens = !isNaoP && wbsIdRaw ? _osGetWBSItens() : [];
  const wbsItem  = !isNaoP && wbsIdRaw ? wbsItens.find(i => i.id === wbsIdRaw) : null;
  const custoEst  = parseFloat(document.getElementById('nos_custo_est')?.value) || 0;
  const custoReal = parseFloat(document.getElementById('nos_custo_real')?.value) || 0;
  const osId = _gerarNumeroOS();

  // Se Item Não Previsto: cria nova linha WBS automaticamente
  let wbsIdFinal = wbsIdRaw;
  if (isNaoP) {
    // Cria linha NP via wbs_manager (se disponível) ou inline
    const pid = typeof wbsGetProjetoIdForContrato === 'function' ? wbsGetProjetoIdForContrato(contrato) : null;
    if (pid) {
      const all = typeof wbsGetAllItens === 'function' ? wbsGetAllItens() :
        (() => { try { return JSON.parse(localStorage.getItem('fraser_custos_wbs') || '[]'); } catch(e) { return []; } })();
      const npItens = all.filter(i => i.projeto_id === pid && i.nao_previsto);
      const npSeq = String(npItens.length + 1).padStart(2, '0');
      // Determina o próximo G1 (grupos L1 existentes + 1 para área "Não Previstos")
      const g1groups = all.filter(i => i.projeto_id === pid && !i.g2).map(i => parseInt(i.g1) || 0);
      const g1max = g1groups.length ? Math.max(...g1groups) : 0;
      // Verifica se já existe grupo "Não Previstos" (último G1)
      const npGrupoExistente = all.find(i => i.projeto_id === pid && !i.g2 && (i.descricao||'').toLowerCase().includes('não previsto'));
      const npG1 = npGrupoExistente ? npGrupoExistente.g1 : String(g1max + 1);
      const npG2 = String(npItens.length + 1).padStart(2, '0');
      const npCode = `${npG1}.${npG2}`;

      // Cria grupo "Não Previstos" se não existir
      let toAdd = [];
      if (!npGrupoExistente && npItens.length === 0) {
        toAdd.push({
          id: npG1, projeto_id: pid, nivel: 1, g1: npG1, g2: '', g3: '', item: '',
          descricao: 'Itens Não Previstos', natureza: 'Grupo', expenditure: 'OPEX', tipo: 'OPEX',
          unidade: '—', qtd: 0, v_unit_est: 0, v_total_est: 0, est_total: 0,
          custo_real: 0, custo_proj: 0, custo_spot: 0, variacao: 0, variacao_pct: 0,
          preco_venda: 0, nao_previsto: false, criado_em: new Date().toISOString(), criado_por: 'Sistema'
        });
      }

      const npLinha = {
        id: npCode, projeto_id: pid, nivel: 2, g1: npG1, g2: npG2, g3: '', item: '',
        descricao: `Item Não Previsto – ${descricao.substring(0, 40)}`,
        natureza: 'MAT', expenditure: 'OPEX', tipo: 'OPEX', unidade: 'vb',
        qtd: 1, v_unit_est: custoEst, v_total_est: custoEst, est_total: custoEst,
        custo_real: custoReal, custo_proj: custoEst, custo_spot: custoReal,
        variacao: custoEst - custoReal, variacao_pct: custoEst > 0 ? (custoEst - custoReal)/custoEst : 0,
        preco_venda: custoEst * 1.15, nao_previsto: true,
        os_origem: osId,
        obs: `Criado automaticamente pela OS ${osId}. ${document.getElementById('nos_obs')?.value || ''}`.trim(),
        criado_em: new Date().toISOString(), criado_por: currentUser?.name || 'Sistema'
      };
      toAdd.push(npLinha);
      const allNovo = [...all, ...toAdd];
      if (typeof wbsSaveAllItens === 'function') wbsSaveAllItens(allNovo);
      else { try { localStorage.setItem('fraser_custos_wbs', JSON.stringify(allNovo)); } catch(e) {} }
      wbsIdFinal = npCode;
      showToast(`Linha WBS não prevista ${npCode} criada automaticamente!`, 'warning', 5000);
    } else {
      // Sem projeto WBS vinculado ao contrato – registra na WBS global como NP
      wbsIdFinal = null;
      showToast('Contrato sem WBS vinculado. OS criada sem vínculo WBS.', 'warning', 4000);
    }
  }

  const wbsItemFinal = wbsIdFinal && !isNaoP ? wbsItens.find(i => i.id === wbsIdFinal) : (isNaoP ? { id: wbsIdFinal, descricao: 'Item Não Previsto', natureza: 'MAT' } : null);

  // Determina status inicial: operadores enviam para aprovação, gerentes/admin criam diretamente
  const profile = currentUser?.profile || '';
  const custoEstNova = parseFloat(document.getElementById('nos_custo_est')?.value) || 0;
  const _statusSelecionado = document.getElementById('nos_status').value;
  let _statusInicial = _statusSelecionado;
  // Se não for admin/diretor/operacao-gerente, envia para aprovação
  if (!['admin', 'diretor'].includes(profile)) {
    _statusInicial = 'Aguardando Aprovação';
  }

  const novaOS = {
    id: osId,
    contrato,
    cliente: contratoDados ? contratoDados.cliente : '—',
    descricao,
    tipo: document.getElementById('nos_tipo').value,
    prioridade: document.getElementById('nos_prioridade').value,
    status: _statusInicial,
    status_anterior_aprovacao: _statusSelecionado !== 'Aguardando Aprovação' ? _statusSelecionado : 'Em Andamento',
    responsavel: document.getElementById('nos_responsavel').value.trim() || (currentUser ? currentUser.name : '—'),
    equipe: parseInt(document.getElementById('nos_equipe').value) || 1,
    horas: parseInt(document.getElementById('nos_horas').value) || 0,
    prazo: prazo ? new Date(prazo + 'T12:00:00').toLocaleDateString('pt-BR') : '—',
    local: document.getElementById('nos_local').value.trim() || '—',
    observacoes: document.getElementById('nos_obs').value.trim(),
    abertura: new Date().toLocaleDateString('pt-BR'),
    progress: 0,
    criadoPor: currentUser ? currentUser.name : 'Sistema',
    criadoEm: new Date().toISOString(),
    // Vínculo WBS
    wbs_id: wbsIdFinal || null,
    wbs_nao_previsto: isNaoP,
    wbs_descricao: wbsItemFinal ? `${wbsItemFinal.id} – ${wbsItemFinal.descricao}` : null,
    wbs_natureza: wbsItemFinal ? wbsItemFinal.natureza : null,
    custo_estimado: custoEst,
    custo_realizado: custoReal
  };

  // Verifica necessidade de compra de material ou serviço externo
  const precisaCompra = document.getElementById('nos_compra_material')?.checked;
  const precisaServico = document.getElementById('nos_servico_externo')?.checked;

  // Coleta itens de compra ANTES de salvar para incluir na OS
  if (precisaCompra || precisaServico) {
    const tipoCompra = precisaServico ? 'Serviço Externo' : 'Material';
    const itens = [];
    document.querySelectorAll('#nos_itens_body tr').forEach(row => {
      const d = row.querySelector('.nos-item-desc')?.value?.trim();
      const q = parseFloat(row.querySelector('.nos-item-qtd')?.value || 1);
      const u = row.querySelector('.nos-item-un')?.value || 'Un';
      if (!d) return;
      // Captura vínculo WBS por item
      const wbsSel    = row.querySelector('.nos-item-wbs');
      const wbsCodigo = wbsSel?.value || '';
      const wbsOpt    = wbsSel?.options[wbsSel.selectedIndex];
      const wbsDesc   = wbsOpt?.dataset?.desc || wbsOpt?.text || '';
      const projetoId = wbsOpt?.dataset?.projeto || '';
      const centroCusto = wbsOpt?.dataset?.cc || '';
      itens.push({
        descricao:    d,
        qtd:          q,
        unidade:      u,
        valor_unit:   0,
        total:        0,
        wbs_codigo:   wbsCodigo,
        wbs_descricao: wbsDesc,
        projeto_id:   projetoId,
        centro_custo: centroCusto
      });
    });

    // Garante que a OS salva já tem os campos de compra corretamente preenchidos
    novaOS.itens_compra = itens.length > 0 ? itens : [{ descricao: tipoCompra + ' – detalhar', qtd: 1, unidade: 'Un', valor_unit: 0, total: 0 }];
    novaOS.precisa_compra = !precisaServico;
    novaOS.precisa_servico = !!precisaServico;
    novaOS.tipo_compra = tipoCompra;
  }

  const lista = _getOSList();
  lista.unshift(novaOS);
  _saveOSList(lista);

  // Se custo realizado foi informado na criação, já lança no WBS
  if (novaOS.wbs_id && novaOS.custo_realizado > 0) {
    _osAtualizarCustoWBS(novaOS, novaOS.custo_realizado);
  }

  logAction('Nova OS', 'Ordens de Serviço', `OS criada: ${novaOS.id} – ${descricao}${novaOS.wbs_id ? ' | WBS: ' + novaOS.wbs_id + (novaOS.wbs_nao_previsto ? ' [NÃO PREVISTO]' : '') : ''}`);
  closeModal();
  showToast(`OS ${novaOS.id} criada com sucesso!${novaOS.wbs_id ? ' · WBS: ' + novaOS.wbs_id + (novaOS.wbs_nao_previsto ? ' ⚠ (Não Previsto)' : '') : ''}`, novaOS.wbs_nao_previsto ? 'warning' : 'success');

  if (precisaCompra || precisaServico) {
    // Notifica o fluxo de aprovação de requisições (usa versão do fluxo_aprovacao_rc.js se disponível)
    if (typeof _notificarOSParaFluxo === 'function') {
      _notificarOSParaFluxo(novaOS, 'Nova OS com necessidade de compra');
      showToast(`OS ${novaOS.id} enviada para aprovação no Fluxo de Requisições!`, 'info', 5000);
    } else {
      showToast(`OS ${novaOS.id} criada! Vá ao Fluxo de Aprovação para aprovar os itens.`, 'info', 6000);
    }
  } else {
    // OS de trabalho interno: também entra no fluxo de aprovação
    if (typeof _notificarOSParaFluxo === 'function') {
      _notificarOSParaFluxo(novaOS, 'Nova OS de trabalho interno');
      showToast(`OS ${novaOS.id} enviada para aprovação (trabalho interno)!`, 'info', 4000);
    }
  }

  renderOS();
}

function addItemNosCompra() {
  const body = document.getElementById('nos_itens_body');
  if (!body) return;
  const row = document.createElement('tr');
  row.innerHTML = `
    <td style="padding:4px"><input type="text" placeholder="Descrição do item" class="form-control nos-item-desc" style="font-size:12px;padding:5px 8px"></td>
    <td style="padding:4px"><input type="number" value="1" min="1" class="form-control nos-item-qtd" style="font-size:12px;padding:5px 8px;text-align:center"></td>
    <td style="padding:4px"><input type="text" value="Un" class="form-control nos-item-un" style="font-size:12px;padding:5px 8px;text-align:center"></td>
    <td style="padding:4px">
      <select class="form-control nos-item-wbs" style="font-size:11px;padding:4px 6px">
        ${_osWBSInlineOptions()}
      </select>
    </td>
    <td style="padding:4px;text-align:center"><button onclick="this.closest('tr').remove()" class="btn btn-sm btn-danger"><i class="fas fa-trash"></i></button></td>
  `;
  body.appendChild(row);
}

// Cria requisição de compra automaticamente a partir de uma OS
function _criarRequisicaoDeOS(os, itens, tipoNecessidade) {
  if (typeof _getRequisicoes !== 'function' || typeof _saveRequisicoes !== 'function') {
    showToast(`OS criada! Vá ao módulo Requisições para criar a solicitação de ${tipoNecessidade}.`, 'info', 6000);
    return;
  }

  const reqs = _getRequisicoes();
  const numProc = 'PROC-' + new Date().getFullYear() + '-' + String(reqs.length + 1).padStart(4,'0');
  const novaReq = {
    id: gerarId('REQ'),
    titulo: `${tipoNecessidade} para OS ${os.id} – ${os.descricao.substring(0,40)}`,
    contrato: os.contrato,
    solicitante: os.responsavel || currentUser?.name || '',
    departamento: 'Operações',
    data_abertura: new Date().toLocaleDateString('pt-BR'),
    prazo_necessidade: os.prazo || '',
    status: 'Pendente Supervisor',
    valor_estimado: itens.reduce((a, i) => a + (i.total || 0), 0),
    numero_processo: numProc,
    origem_os: os.id,
    aprovacao_supervisor: { nome: '', data: '', status: 'Pendente' },
    aprovacao_gestor: { nome: '', data: '', status: 'Pendente' },
    itens: itens.length > 0 ? itens : [{ descricao: tipoNecessidade + ' – detalhar no módulo Requisições', qtd: 1, unidade: 'Un', valor_unit: 0, total: 0 }],
    observacoes: `Originada da OS ${os.id}: ${os.descricao}`
  };

  reqs.unshift(novaReq);
  _saveRequisicoes(reqs);
  logAction('Criar', 'Requisições', `Requisição ${numProc} criada automaticamente a partir da OS ${os.id}`);

  showToast(
    `✅ Requisição ${numProc} criada automaticamente! Acesse Suprimentos > Requisições para aprovar.`,
    'success',
    7000
  );

  // Atualiza badge de requisições
  const badge = document.getElementById('badge-reqs');
  if (badge) badge.textContent = reqs.filter(r => r.status.includes('Pendente')).length;
}

function editarOS(id) {
  if (!hasPermission('os', 'edit')) { showToast('Sem permissão para editar OS', 'error'); return; }
  const lista = _getOSList();
  const os = lista.find(o => o.id === id);
  if (!os) return;

  // Itens de compra existentes na OS
  const itensExistentes = os.itens_compra || [];

  openModalWide(`Editar OS – ${os.id}`, `
    <div class="form-row">
      <div class="form-group">
        <label>Status</label>
        <select class="form-control" id="eos_status">
          ${['Agendada','Em Andamento','Pausada','Aguardando Peça','Concluída','Cancelada'].map(s =>
            `<option ${os.status===s?'selected':''}>${s}</option>`
          ).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Prioridade</label>
        <select class="form-control" id="eos_prioridade">
          ${['Normal','Alta','Crítica'].map(p => `<option ${os.prioridade===p?'selected':''}>${p}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-group">
      <label>Descrição</label>
      <input class="form-control" id="eos_descricao" type="text" value="${os.descricao}">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Responsável</label>
        <input class="form-control" id="eos_responsavel" type="text" value="${os.responsavel || ''}">
      </div>
      <div class="form-group">
        <label>Equipe (nº pessoas)</label>
        <input class="form-control" id="eos_equipe" type="number" value="${os.equipe || 1}">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Prazo</label>
        <input class="form-control" id="eos_prazo" type="text" value="${os.prazo || ''}">
      </div>
      <div class="form-group">
        <label>Horas Previstas</label>
        <input class="form-control" id="eos_horas" type="number" value="${os.horas || 0}">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Local / Área</label>
        <input class="form-control" id="eos_local" type="text" value="${os.local || ''}">
      </div>
      <div class="form-group">
        <label>Progresso (%)</label>
        <input class="form-control" id="eos_progress" type="number" min="0" max="100" value="${os.progress || 0}">
      </div>
    </div>
    <div class="form-group">
      <label>Observações</label>
      <textarea class="form-control" id="eos_obs" rows="2">${os.observacoes || ''}</textarea>
    </div>

    <!-- VÍNCULO WBS -->
    <div style="background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.25);border-radius:8px;padding:14px;margin-top:4px;margin-bottom:8px">
      <div style="font-size:12px;font-weight:600;color:#10b981;margin-bottom:10px"><i class="fas fa-sitemap" style="margin-right:6px"></i>Linha de Custo WBS do Projeto</div>
      <div class="form-group" style="margin-bottom:8px">
        <label style="font-size:12px">Linha WBS vinculada</label>
        <select class="form-control" id="eos_wbs_id" style="font-size:12px" onchange="_eosWBSChange()">
          ${_osWBSOptions(os.wbs_id || '')}
        </select>
      </div>
      <div id="eos_wbs_info" style="${os.wbs_id ? '' : 'display:none;'}background:rgba(16,185,129,0.1);border-radius:6px;padding:8px;font-size:11px;color:#10b981;margin-bottom:8px">
        ${os.wbs_id ? `<i class="fas fa-chart-bar" style="margin-right:4px"></i> Atualmente vinculada: <strong>${os.wbs_descricao || os.wbs_id}</strong>` : ''}
      </div>
      <div class="form-row">
        <div class="form-group" style="margin-bottom:0">
          <label style="font-size:12px">Custo Estimado (R$)</label>
          <input class="form-control" id="eos_custo_est" type="number" min="0" step="0.01" value="${os.custo_estimado || ''}" placeholder="0,00" style="font-size:12px">
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label style="font-size:12px">Custo Realizado (R$)</label>
          <input class="form-control" id="eos_custo_real" type="number" min="0" step="0.01" value="${os.custo_realizado || ''}" placeholder="0,00" style="font-size:12px">
          <div style="font-size:10px;color:var(--text-muted);margin-top:2px">Ao salvar, a diferença em relação ao valor anterior será lançada no WBS.</div>
        </div>
      </div>
    </div>

    <!-- ADICIONAR NOVOS ITENS DE COMPRA -->
    <div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.3);border-radius:8px;padding:14px;margin-top:12px">
      <div style="font-size:12px;font-weight:700;color:#f59e0b;margin-bottom:8px">
        <i class="fas fa-shopping-cart" style="margin-right:6px"></i>
        Itens de Compra / Serviço Externo
        ${itensExistentes.length > 0 ? `<span style="font-size:10px;font-weight:400;color:var(--text-muted);margin-left:8px">${itensExistentes.length} item(ns) já no fluxo</span>` : ''}
      </div>

      ${itensExistentes.length > 0 ? `
        <div style="margin-bottom:10px;padding:8px;background:rgba(0,0,0,0.15);border-radius:6px;font-size:11px;color:var(--text-muted)">
          <strong style="color:var(--text-secondary)">Itens existentes (já aprovados ou em aprovação):</strong>
          ${itensExistentes.map(it => `<div style="padding:3px 0">• ${it.descricao} (${it.qtd||1} ${it.unidade||'Un'})</div>`).join('')}
        </div>
      ` : ''}

      <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px">
        ${itensExistentes.length > 0
          ? '<i class="fas fa-info-circle" style="color:#f59e0b;margin-right:4px"></i>Adicione <strong>novos itens</strong> abaixo. Os já aprovados serão mantidos. Os novos iniciarão reapro vação.'
          : 'Adicione itens que precisam de compra ou contratação de serviço externo:'}
      </div>

      <div style="display:flex;gap:12px;margin-bottom:8px">
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;color:var(--text-secondary)">
          <input type="checkbox" id="eos_tem_compra" style="accent-color:var(--orange)" ${itensExistentes.length>0?'':''}> Adicionar itens de compra/serviço
        </label>
      </div>

      <div id="eos_itens_novos_wrap" style="display:none">
        <div style="display:flex;gap:8px;margin-bottom:6px">
          <select class="form-control" id="eos_tipo_compra_novo" style="flex:1;font-size:12px">
            <option value="Material">Compra de Material</option>
            <option value="Serviço Externo">Serviço Externo / Locação</option>
            <option value="Misto">Material + Serviço</option>
          </select>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:12px" id="eos_itens_novos_table">
          <thead><tr style="background:var(--bg-tertiary)">
            <th style="padding:6px 8px;text-align:left">Descrição do Item</th>
            <th style="padding:6px 8px;text-align:center;width:55px">Qtd</th>
            <th style="padding:6px 8px;text-align:center;width:52px">Un</th>
            <th style="padding:6px 8px;text-align:left;min-width:160px">
              <i class="fas fa-sitemap" style="color:#3b82f6;margin-right:4px"></i>Linha WBS
            </th>
            <th style="padding:6px 8px;text-align:center;width:36px"></th>
          </tr></thead>
          <tbody id="eos_itens_novos_body">
            <tr>
              <td style="padding:4px"><input type="text" placeholder="Ex: Rolamento 6208-ZZ" class="form-control eos-novo-desc" style="font-size:12px;padding:5px 8px"></td>
              <td style="padding:4px"><input type="number" value="1" min="1" class="form-control eos-novo-qtd" style="font-size:12px;padding:5px 8px;text-align:center"></td>
              <td style="padding:4px"><input type="text" value="Un" class="form-control eos-novo-un" style="font-size:12px;padding:5px 8px;text-align:center"></td>
              <td style="padding:4px">
                <select class="form-control eos-novo-wbs" style="font-size:11px;padding:4px 6px">
                  ${_osWBSInlineOptions()}
                </select>
              </td>
              <td style="padding:4px;text-align:center"><button onclick="this.closest('tr').remove()" class="btn btn-sm btn-danger"><i class="fas fa-trash"></i></button></td>
            </tr>
          </tbody>
        </table>
        <button onclick="_addItemNosEdicao()" class="btn btn-secondary btn-sm" style="margin-top:6px"><i class="fas fa-plus"></i> Item</button>
        <div style="margin-top:8px;padding:8px;background:rgba(245,158,11,0.12);border-radius:6px;font-size:11px;color:#f59e0b">
          <i class="fas fa-exclamation-triangle" style="margin-right:4px"></i>
          Ao salvar, os novos itens iniciarão o <strong>fluxo de aprovação</strong> a partir do Estágio 1. Itens anteriores já aprovados serão mantidos.
        </div>
      </div>
    </div>

    <div id="eos_edit_erro" style="display:none;color:#ef4444;font-size:12px;margin-top:8px;background:rgba(239,68,68,0.1);padding:8px 12px;border-radius:6px"></div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-danger" onclick="confirmarExcluirOS('${id}')"><i class="fas fa-trash"></i> Excluir</button>
    <button class="btn btn-primary" onclick="salvarEdicaoOS('${id}')"><i class="fas fa-save"></i> Salvar</button>
  `);

  // Mostrar/esconder novos itens
  setTimeout(() => {
    const cb = document.getElementById('eos_tem_compra');
    const wrap = document.getElementById('eos_itens_novos_wrap');
    if (cb && wrap) cb.addEventListener('change', () => {
      wrap.style.display = cb.checked ? 'block' : 'none';
    });
  }, 100);
}

function salvarEdicaoOS(id) {
  const lista = _getOSList();
  const idx = lista.findIndex(o => o.id === id);
  if (idx < 0) return;

  // Captura vínculo WBS
  const eosWbsId = document.getElementById('eos_wbs_id')?.value || lista[idx].wbs_id || '';
  const eosWbsItens = eosWbsId ? _osGetWBSItens() : [];
  const eosWbsItem = eosWbsId ? eosWbsItens.find(i => i.id === eosWbsId) : null;
  const eosCustoEst = parseFloat(document.getElementById('eos_custo_est')?.value) || 0;
  const eosCustoReal = parseFloat(document.getElementById('eos_custo_real')?.value) || 0;
  const custoRealAnterior = lista[idx].custo_realizado || 0;

  const osAtualizada = {
    ...lista[idx],
    status: document.getElementById('eos_status').value,
    prioridade: document.getElementById('eos_prioridade').value,
    descricao: document.getElementById('eos_descricao').value.trim(),
    responsavel: document.getElementById('eos_responsavel').value.trim(),
    equipe: parseInt(document.getElementById('eos_equipe').value) || lista[idx].equipe,
    prazo: document.getElementById('eos_prazo').value.trim(),
    horas: parseInt(document.getElementById('eos_horas').value) || 0,
    local: document.getElementById('eos_local').value.trim(),
    progress: Math.min(100, Math.max(0, parseInt(document.getElementById('eos_progress').value) || 0)),
    observacoes: document.getElementById('eos_obs').value.trim(),
    atualizadoEm: new Date().toISOString(),
    // Vínculo WBS atualizado
    wbs_id: eosWbsId || null,
    wbs_descricao: eosWbsItem ? `${eosWbsItem.id} – ${eosWbsItem.descricao}` : (lista[idx].wbs_descricao || null),
    wbs_natureza: eosWbsItem ? eosWbsItem.natureza : (lista[idx].wbs_natureza || null),
    custo_estimado: eosCustoEst,
    custo_realizado: eosCustoReal
  };

  // Verifica novos itens de compra adicionados na edição
  const temNovaCompra = document.getElementById('eos_tem_compra')?.checked;
  if (temNovaCompra) {
    const tipoCompra = document.getElementById('eos_tipo_compra_novo')?.value || 'Material';
    const novosItens = [];
    document.querySelectorAll('#eos_itens_novos_body tr').forEach(row => {
      const d = row.querySelector('.eos-novo-desc')?.value?.trim();
      const q = parseFloat(row.querySelector('.eos-novo-qtd')?.value || 1);
      const u = row.querySelector('.eos-novo-un')?.value || 'Un';
      if (!d) return;
      const wbsSel     = row.querySelector('.eos-novo-wbs');
      const wbsCodigo  = wbsSel?.value || '';
      const wbsOpt     = wbsSel?.options[wbsSel?.selectedIndex];
      const wbsDesc    = wbsOpt?.dataset?.desc || wbsOpt?.text || '';
      const projetoId  = wbsOpt?.dataset?.projeto || '';
      const centroCusto = wbsOpt?.dataset?.cc || '';
      novosItens.push({
        descricao:     d,
        qtd:           q,
        unidade:       u,
        valor_unit:    0,
        total:         0,
        wbs_codigo:    wbsCodigo,
        wbs_descricao: wbsDesc,
        projeto_id:    projetoId,
        centro_custo:  centroCusto
      });
    });

    if (novosItens.length > 0) {
      // Mescla com itens já existentes
      const itensAnteriores = lista[idx].itens_compra || [];
      osAtualizada.itens_compra = [...itensAnteriores, ...novosItens];
      osAtualizada.tipo_compra = tipoCompra;
      osAtualizada.precisa_compra = true;

      lista[idx] = osAtualizada;
      _saveOSList(lista);

      // Notifica o fluxo de aprovação – novos itens iniciarão reaprovação
      if (typeof _notificarOSParaFluxo === 'function') {
        _notificarOSParaFluxo(osAtualizada, `Edição da OS: ${novosItens.length} novo(s) item(ns) adicionado(s)`);
      }

      logAction('Edição OS', 'Ordens de Serviço', `OS ${id} editada – ${novosItens.length} novo(s) item(ns) adicionado(s) ao fluxo`);
      closeModal();
      showToast(`✅ OS ${id} atualizada! ${novosItens.length} novo(s) item(ns) enviado(s) para aprovação no Fluxo de Requisições.`, 'success', 6000);
      renderOS();
      return;
    }
  }

  lista[idx] = osAtualizada;
  _saveOSList(lista);

  // Se custo realizado aumentou e há WBS vinculado, lança a diferença no WBS
  const deltaCusto = eosCustoReal - custoRealAnterior;
  if (osAtualizada.wbs_id && deltaCusto > 0) {
    _osAtualizarCustoWBS(osAtualizada, deltaCusto);
  }

  logAction('Edição OS', 'Ordens de Serviço', `OS editada: ${id}${osAtualizada.wbs_id ? ' | WBS: ' + osAtualizada.wbs_id : ''}`);
  closeModal();
  showToast(`OS ${id} atualizada com sucesso!${osAtualizada.wbs_id ? ' · Vinculada ao WBS ' + osAtualizada.wbs_id : ''}`, 'success');
  renderOS();
}

function _addItemNosEdicao() {
  const body = document.getElementById('eos_itens_novos_body');
  if (!body) return;
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td style="padding:4px"><input type="text" placeholder="Descrição do item" class="form-control eos-novo-desc" style="font-size:12px;padding:5px 8px"></td>
    <td style="padding:4px"><input type="number" value="1" min="1" class="form-control eos-novo-qtd" style="font-size:12px;padding:5px 8px;text-align:center"></td>
    <td style="padding:4px"><input type="text" value="Un" class="form-control eos-novo-un" style="font-size:12px;padding:5px 8px;text-align:center"></td>
    <td style="padding:4px">
      <select class="form-control eos-novo-wbs" style="font-size:11px;padding:4px 6px">
        ${_osWBSInlineOptions()}
      </select>
    </td>
    <td style="padding:4px;text-align:center"><button onclick="this.closest('tr').remove()" class="btn btn-sm btn-danger"><i class="fas fa-trash"></i></button></td>
  `;
  body.appendChild(tr);
}
window._addItemNosEdicao = _addItemNosEdicao;

// Exibe info da linha WBS selecionada no form Editar OS
function _eosWBSChange() {
  const sel = document.getElementById('eos_wbs_id');
  const info = document.getElementById('eos_wbs_info');
  if (!sel || !info) return;
  const wbsId = sel.value;
  if (!wbsId) { info.style.display = 'none'; return; }
  const itens = _osGetWBSItens();
  const item = itens.find(i => i.id === wbsId);
  if (!item) { info.style.display = 'none'; return; }
  const est = Number(item.est_total || 0).toLocaleString('pt-BR', {style:'currency', currency:'BRL', maximumFractionDigits:0});
  const real = Number(item.custo_real || 0).toLocaleString('pt-BR', {style:'currency', currency:'BRL', maximumFractionDigits:0});
  info.style.display = 'block';
  info.innerHTML = `<i class="fas fa-chart-bar" style="margin-right:4px"></i> <strong>${item.id}</strong> – ${item.descricao} &nbsp;|&nbsp; Estimado: <strong>${est}</strong> &nbsp;|&nbsp; Realizado: <strong>${real}</strong> &nbsp;|&nbsp; ${item.natureza||''} &nbsp;|&nbsp; ${item.expenditure||''}`;
}
window._eosWBSChange = _eosWBSChange;

function confirmarExcluirOS(id) {
  closeModal();
  confirmarAcao('Excluir OS', `Deseja realmente excluir a OS <strong>${id}</strong>? Esta ação não pode ser desfeita.`,
    `_excluirOS('${id}')`, true);
}

function _excluirOS(id) {
  const lista = _getOSList().filter(o => o.id !== id);
  _saveOSList(lista);
  logAction('Exclusão OS', 'Ordens de Serviço', `OS excluída: ${id}`);
  showToast('OS excluída.', 'warning');
  renderOS();
}

// ── APONTAMENTO DE HORAS ──────────────────────────────

function _getApontamentosOS(osId) {
  try {
    const raw = localStorage.getItem('fa_apontamentos_os');
    const all = raw ? JSON.parse(raw) : {};
    return all[osId] || [];
  } catch(e) { return []; }
}

function _saveApontamentoOS(osId, apontamento) {
  try {
    const raw = localStorage.getItem('fa_apontamentos_os');
    const all = raw ? JSON.parse(raw) : {};
    if (!all[osId]) all[osId] = [];
    all[osId].push(apontamento);
    localStorage.setItem('fa_apontamentos_os', JSON.stringify(all));
  } catch(e) {}
}

function apontarHorasOS(id) {
  const os = _getOSList().find(o => o.id === id);
  if (!os) return;

  const aponts = _getApontamentosOS(id);
  const totalHH = aponts.reduce((a, x) => a + (x.horas || 0), 0);

  openModal(`Apontamento de Horas – ${id}`, `
    <div style="background:rgba(0,180,184,0.06);border:1px solid rgba(0,180,184,0.2);border-radius:8px;padding:12px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center">
      <div>
        <div style="font-size:12px;color:var(--text-muted)">HH Apontadas até agora</div>
        <div style="font-size:24px;font-weight:700;color:var(--fa-teal)">${totalHH}h</div>
      </div>
      <div>
        <div style="font-size:12px;color:var(--text-muted)">HH Previstas</div>
        <div style="font-size:24px;font-weight:700;color:var(--orange)">${os.horas || 0}h</div>
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label>Data *</label>
        <input class="form-control" id="apt_data" type="date" value="${new Date().toISOString().split('T')[0]}">
      </div>
      <div class="form-group">
        <label>Horas Trabalhadas *</label>
        <input class="form-control" id="apt_horas" type="number" min="0.5" max="24" step="0.5" placeholder="Ex: 8">
      </div>
    </div>
    <div class="form-group">
      <label>Colaborador *</label>
      <input class="form-control" id="apt_colaborador" type="text" value="${currentUser ? currentUser.name : ''}" placeholder="Nome do colaborador">
    </div>
    <div class="form-group">
      <label>Atividade Realizada</label>
      <input class="form-control" id="apt_atividade" type="text" placeholder="Descreva brevemente a atividade">
    </div>
    <div class="form-group">
      <label>Progresso da OS (%)</label>
      <input class="form-control" id="apt_progress" type="number" min="0" max="100" value="${os.progress || 0}">
    </div>
    ${os.wbs_id ? `
    <div style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.25);border-radius:8px;padding:12px;margin-top:8px">
      <div style="font-size:11px;font-weight:600;color:#10b981;margin-bottom:8px"><i class="fas fa-sitemap" style="margin-right:4px"></i>Custo WBS – ${os.wbs_descricao || os.wbs_id}</div>
      <div class="form-row" style="margin-bottom:0">
        <div class="form-group" style="margin-bottom:0">
          <label style="font-size:12px">Custo deste apontamento (R$)</label>
          <input class="form-control" id="apt_custo_wbs" type="number" min="0" step="0.01" placeholder="0,00" style="font-size:12px">
          <div style="font-size:10px;color:var(--text-muted);margin-top:2px">Será lançado no custo realizado do WBS ${os.wbs_id}</div>
        </div>
      </div>
    </div>` : `<input type="hidden" id="apt_custo_wbs" value="0">`}
    <div id="apt_erro" style="display:none;color:var(--red-light);font-size:12px;margin-top:8px;background:rgba(239,68,68,0.1);padding:8px;border-radius:6px"></div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="salvarApontamentoOS('${id}')"><i class="fas fa-clock"></i> Registrar Horas</button>
  `);
}

function salvarApontamentoOS(osId) {
  const data = document.getElementById('apt_data').value;
  const horas = parseFloat(document.getElementById('apt_horas').value);
  const colaborador = document.getElementById('apt_colaborador').value.trim();
  const erroEl = document.getElementById('apt_erro');

  if (!data) { erroEl.textContent = 'Informe a data.'; erroEl.style.display = 'block'; return; }
  if (!horas || horas <= 0) { erroEl.textContent = 'Informe as horas trabalhadas.'; erroEl.style.display = 'block'; return; }
  if (!colaborador) { erroEl.textContent = 'Informe o colaborador.'; erroEl.style.display = 'block'; return; }

  const custoApontamento = parseFloat(document.getElementById('apt_custo_wbs')?.value) || 0;

  const apontamento = {
    id: gerarId('APT'),
    data: new Date(data + 'T12:00:00').toLocaleDateString('pt-BR'),
    horas,
    colaborador,
    atividade: document.getElementById('apt_atividade').value.trim(),
    custo: custoApontamento,
    registradoPor: currentUser ? currentUser.name : 'Sistema',
    registradoEm: new Date().toISOString()
  };

  _saveApontamentoOS(osId, apontamento);

  // Atualiza progresso da OS e acumula custo realizado
  const novoProgress = Math.min(100, Math.max(0, parseInt(document.getElementById('apt_progress').value) || 0));
  const lista = _getOSList();
  const idx = lista.findIndex(o => o.id === osId);
  if (idx >= 0) {
    lista[idx].progress = novoProgress;
    if (novoProgress === 100) lista[idx].status = 'Concluída';
    // Acumula custo realizado na OS
    if (custoApontamento > 0) {
      lista[idx].custo_realizado = (lista[idx].custo_realizado || 0) + custoApontamento;
    }
    _saveOSList(lista);
    // Lança custo no WBS se vinculado
    if (custoApontamento > 0 && lista[idx].wbs_id) {
      _osAtualizarCustoWBS(lista[idx], custoApontamento);
    }
  }

  logAction('Apontamento HH', 'Ordens de Serviço', `${horas}h apontadas para ${osId} por ${colaborador}${custoApontamento > 0 ? ' | Custo R$ ' + custoApontamento.toLocaleString('pt-BR') : ''}`);
  closeModal();
  showToast(`${horas}h registradas para a OS ${osId}!${custoApontamento > 0 ? ' · R$ ' + custoApontamento.toLocaleString('pt-BR', {minimumFractionDigits:2}) + ' lançado no WBS' : ''}`, 'success');
  renderOS();
}

// ── CHECKLIST ──────────────────────────────────────────

function _getChecklistOS(osId) {
  try {
    const raw = localStorage.getItem('fa_checklist_os');
    const all = raw ? JSON.parse(raw) : {};
    if (all[osId]) return all[osId];
  } catch(e) {}
  // Checklist padrão por tipo
  const os = _getOSList().find(o => o.id === osId);
  const tipo = os ? os.tipo : '';
  const checklistsPadrao = {
    Preventiva: ['Verificar condições de segurança da área','Separar ferramentas e materiais','Executar limpeza inicial','Verificar e lubrificar pontos de manutenção','Verificar folgas e apertos','Testar funcionamento após manutenção','Preencher tag de manutenção','Limpar e organizar a área','Registrar ocorrências no relatório'],
    Corretiva: ['Identificar e isolar o equipamento','Realizar análise de causa raiz','Separar peças necessárias','Executar reparo','Testar antes de religar','Verificar conformidade','Registrar peças substituídas','Liberar equipamento','Emitir relatório de reparo'],
    Inspeção: ['Verificar EPIs','Acessar ponto de inspeção','Verificar parâmetros operacionais','Verificar condições mecânicas','Verificar condições elétricas','Fotografar anomalias encontradas','Registrar leituras','Emitir relatório de inspeção'],
    Projeto: ['Verificar escopo do projeto','Reunir equipe e materiais','Executar etapa 1','Executar etapa 2','Teste de comissionamento','Validar resultados','Documentar alterações realizadas','Entregar ao cliente']
  };
  return (checklistsPadrao[tipo] || ['Verificar condições de segurança','Executar atividade','Testar resultado','Limpar área','Registrar no relatório']).map(item => ({ texto: item, ok: false }));
}

function _saveChecklistOS(osId, checklist) {
  try {
    const raw = localStorage.getItem('fa_checklist_os');
    const all = raw ? JSON.parse(raw) : {};
    all[osId] = checklist;
    localStorage.setItem('fa_checklist_os', JSON.stringify(all));
  } catch(e) {}
}

function abrirChecklistOS(id) {
  const os = _getOSList().find(o => o.id === id);
  if (!os) return;
  const checklist = _getChecklistOS(id);
  const concluidos = checklist.filter(c => c.ok).length;

  openModalWide(`Checklist – ${id}`, `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div>
        <div style="font-size:13px;font-weight:500">${os.descricao}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${concluidos}/${checklist.length} itens concluídos</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:24px;font-weight:700;color:${concluidos === checklist.length ? 'var(--green-light)' : 'var(--fa-teal)'}">${Math.round(concluidos/checklist.length*100)}%</div>
      </div>
    </div>
    <div class="progress" style="height:8px;margin-bottom:16px">
      <div class="progress-bar ${concluidos===checklist.length?'green':''}" style="width:${Math.round(concluidos/checklist.length*100)}%"></div>
    </div>

    <div id="checklistItems" style="display:flex;flex-direction:column;gap:8px">
      ${checklist.map((item, i) => `
        <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:${item.ok ? 'rgba(34,197,94,0.08)' : 'var(--bg-card2)'};border:1px solid ${item.ok ? 'rgba(34,197,94,0.3)' : 'var(--border)'};border-radius:8px;cursor:pointer" onclick="toggleCheckItem('${id}',${i})">
          <div style="width:20px;height:20px;border:2px solid ${item.ok ? 'var(--green-light)' : 'var(--border)'};border-radius:4px;background:${item.ok ? 'var(--green-light)' : 'transparent'};display:flex;align-items:center;justify-content:center;flex-shrink:0">
            ${item.ok ? '<i class="fas fa-check" style="color:white;font-size:11px"></i>' : ''}
          </div>
          <span style="font-size:13px;color:${item.ok ? 'var(--text-muted)' : 'var(--text-primary)'};text-decoration:${item.ok ? 'line-through' : 'none'}">${item.texto}</span>
        </div>
      `).join('')}
    </div>

    <div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--border);display:flex;gap:8px">
      <input class="form-control" id="novoItemChecklist" type="text" placeholder="Adicionar novo item ao checklist..." style="flex:1">
      <button class="btn btn-secondary btn-sm" onclick="adicionarItemChecklist('${id}')"><i class="fas fa-plus"></i></button>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
    <button class="btn btn-success" onclick="exportarChecklistPDF('${id}')"><i class="fas fa-file-pdf"></i> Exportar PDF</button>
    <button class="btn btn-primary" onclick="closeModal()"><i class="fas fa-check"></i> Salvar e Fechar</button>
  `);
}

function toggleCheckItem(osId, idx) {
  const checklist = _getChecklistOS(osId);
  checklist[idx].ok = !checklist[idx].ok;
  _saveChecklistOS(osId, checklist);
  // Re-abre o checklist
  abrirChecklistOS(osId);
}

function adicionarItemChecklist(osId) {
  const input = document.getElementById('novoItemChecklist');
  const texto = (input.value || '').trim();
  if (!texto) return;
  const checklist = _getChecklistOS(osId);
  checklist.push({ texto, ok: false });
  _saveChecklistOS(osId, checklist);
  abrirChecklistOS(osId);
}

function exportarChecklistPDF(id) {
  const os = _getOSList().find(o => o.id === id);
  const checklist = _getChecklistOS(id);
  const concluidos = checklist.filter(c => c.ok).length;

  const conteudo = `
FRASER ALEXANDER – CHECKLIST DE ORDEM DE SERVIÇO
=================================================
OS: ${os.id}
Contrato: ${os.contrato} | Cliente: ${os.cliente}
Descrição: ${os.descricao}
Responsável: ${os.responsavel} | Data: ${new Date().toLocaleDateString('pt-BR')}
Progresso: ${concluidos}/${checklist.length} itens (${Math.round(concluidos/checklist.length*100)}%)
=================================================

ITENS DO CHECKLIST:
${checklist.map((item, i) => `${i+1}. [${item.ok ? 'X' : ' '}] ${item.texto}`).join('\n')}

=================================================
Assinatura Responsável: _________________________ Data: ___/___/______
Assinatura Supervisor:  _________________________ Data: ___/___/______
`;
  const blob = new Blob([conteudo], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Checklist_${id}_${new Date().toISOString().split('T')[0]}.txt`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Checklist exportado!', 'success');
}

// ── EXPORTAR EXCEL / CSV ─────────────────────────────

function exportarOSExcel() {
  const lista = _getOSList();
  const header = ['Nº OS','Contrato','Cliente','Tipo','Prioridade','Status','Responsável','Equipe','HH Previstas','Abertura','Prazo','Progresso %','Local','Observações'];
  const rows = lista.map(os => [
    os.id, os.contrato||'', os.cliente||'', os.tipo||'', os.prioridade||'', os.status||'',
    os.responsavel||'', os.equipe||0, os.horas||0, os.abertura||'', os.prazo||'',
    os.progress||0, os.local||'', (os.observacoes||'').replace(/,/g,' ')
  ]);

  const csv = [header, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `OS_Fraser_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  logAction('Exportação', 'Ordens de Serviço', `Exportou ${lista.length} OS em CSV`);
  showToast(`${lista.length} ordens exportadas com sucesso!`, 'success');
}

// ── MEDIÇÃO (mantida no mesmo arquivo) ──────────────────

function _getMedicoesList() {
  try {
    const raw = localStorage.getItem('fa_medicoes');
    if (raw) return JSON.parse(raw);
  } catch(e) {}
  return JSON.parse(JSON.stringify(ERP_DATA.medicoes));
}

function _saveMedicoesList(list) {
  localStorage.setItem('fa_medicoes', JSON.stringify(list));
}

(function() {
  if (!localStorage.getItem('fa_medicoes')) _saveMedicoesList(ERP_DATA.medicoes);
})();

function renderMedicao() {
  if (!hasPermission('medicao', 'view')) {
    renderAcessoNegado(); return;
  }
  const medicoes = _getMedicoesList();
  const main = document.getElementById('mainContent');

  const totalBruto = medicoes.reduce((a, m) => a + (m.valorBruto || 0), 0);
  const totalGlosa = medicoes.reduce((a, m) => a + (m.glosa || 0), 0);
  const totalLiq = medicoes.reduce((a, m) => a + (m.valorLiquido || 0), 0);
  const pendentes = medicoes.filter(m => m.status === 'Rascunho' || m.status === 'Em Análise').length;

  main.innerHTML = `
    <div class="page-header">
      <div class="page-title">
        <h2><i class="fas fa-ruler-combined" style="color:var(--orange);margin-right:8px"></i>Medição Contratual</h2>
        <p>${medicoes.length} medições cadastradas · ${pendentes} pendentes</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary btn-sm" onclick="exportarMedicoes()">
          <i class="fas fa-file-excel"></i> Exportar
        </button>
        ${hasPermission('medicao', 'create') ? `
        <button class="btn btn-primary btn-sm" onclick="openNovaMedicao()">
          <i class="fas fa-plus"></i> Nova Medição
        </button>` : ''}
      </div>
    </div>

    <!-- KPIs -->
    <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr)">
      <div class="kpi-card kpi-blue"><div class="kpi-icon"><i class="fas fa-file-invoice-dollar"></i></div><div class="kpi-value">${medicoes.length}</div><div class="kpi-label">Total de Medições</div></div>
      <div class="kpi-card kpi-orange"><div class="kpi-icon"><i class="fas fa-dollar-sign"></i></div><div class="kpi-value">${fmtK(totalBruto)}</div><div class="kpi-label">Valor Bruto Total</div></div>
      <div class="kpi-card kpi-red"><div class="kpi-icon"><i class="fas fa-minus-circle"></i></div><div class="kpi-value">${fmtK(totalGlosa)}</div><div class="kpi-label">Total de Glosas</div></div>
      <div class="kpi-card kpi-green"><div class="kpi-icon"><i class="fas fa-check-circle"></i></div><div class="kpi-value">${fmtK(totalLiq)}</div><div class="kpi-label">Valor Líquido Total</div></div>
    </div>

    <!-- Pipeline -->
    <div class="card page-section">
      <div class="card-body">
        <div style="display:flex;align-items:center;gap:0;margin-bottom:8px">
          ${['Rascunho','Em Análise','Enviada','Aprovada','Faturada','Paga'].map((s, i, arr) => {
            const cnt = medicoes.filter(m => m.status === s).length;
            return `
            <div style="flex:1;text-align:center">
              <div style="padding:8px 4px;background:${cnt > 0 ? 'rgba(230,126,34,0.15)' : 'var(--bg-card2)'};border:1px solid ${cnt > 0 ? 'var(--orange)' : 'var(--border)'};font-size:11px;font-weight:600;color:${cnt > 0 ? 'var(--orange)' : 'var(--text-muted)'};border-radius:${i===0?'6px 0 0 6px':i===arr.length-1?'0 6px 6px 0':'0'};border-left-width:${i>0?'0':'1px'}">
                ${s} ${cnt > 0 ? `<span style="background:var(--orange);color:white;border-radius:8px;padding:1px 6px;font-size:10px">${cnt}</span>` : ''}
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>
    </div>

    <!-- Tabela -->
    <div class="card">
      <div class="card-header">
        <h3><i class="fas fa-ruler-combined" style="color:var(--orange);margin-right:8px"></i>Medições</h3>
        <div style="display:flex;gap:8px">
          <select class="filter-select" id="filterMedStatus" onchange="filterMedicoes()" style="font-size:12px;padding:4px 8px">
            <option value="">Todos os Status</option>
            ${['Rascunho','Em Análise','Enviada','Aprovada','Faturada','Paga'].map(s => `<option>${s}</option>`).join('')}
          </select>
        </div>
      </div>
      <div id="tabelaMedicoes">
        ${renderTabelaMedicoes(medicoes)}
      </div>
    </div>
  `;
}

function renderTabelaMedicoes(medicoes) {
  if (!medicoes.length) return `<div class="empty-state" style="padding:40px"><p>Nenhuma medição encontrada</p></div>`;
  return `
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>ID Medição</th><th>Contrato</th><th>Cliente</th><th>Competência</th>
            <th>Valor Bruto</th><th>Glosa</th><th>Valor Líquido</th>
            <th>Envio</th><th>Prev. Pgto.</th><th>Status</th><th>Ações</th>
          </tr>
        </thead>
        <tbody>
          ${medicoes.map(m => `
            <tr>
              <td style="color:var(--orange);font-weight:600;font-size:12px">${m.id}</td>
              <td style="font-size:12px;color:var(--text-secondary)">${m.contrato || '—'}</td>
              <td>${m.cliente || '—'}</td>
              <td style="font-weight:500">${m.competencia || '—'}</td>
              <td>${fmt(m.valorBruto)}</td>
              <td style="color:${(m.glosa||0) > 0 ? 'var(--red-light)' : 'var(--text-muted)'}">
                ${(m.glosa||0) > 0 ? fmt(m.glosa) : '—'}
              </td>
              <td style="font-weight:600;color:var(--green-light)">${fmt(m.valorLiquido)}</td>
              <td style="font-size:12px">${m.envio || '—'}</td>
              <td style="font-size:12px">${m.previsaoPgto || '—'}</td>
              <td>${statusBadge(m.status)}</td>
              <td>
                <div class="actions-cell">
                  <button class="btn btn-secondary btn-sm btn-icon" onclick="verDetalheMedicao('${m.id}')" title="Detalhe"><i class="fas fa-eye"></i></button>
                  ${hasPermission('medicao', 'edit') ? `<button class="btn btn-info btn-sm btn-icon" onclick="editarMedicao('${m.id}')" title="Editar"><i class="fas fa-edit"></i></button>` : ''}
                  ${m.status === 'Rascunho' ? `<button class="btn btn-primary btn-sm" style="font-size:11px;padding:4px 8px" onclick="enviarMedicao('${m.id}')"><i class="fas fa-paper-plane"></i> Enviar</button>` : ''}
                  ${m.status === 'Em Análise' || m.status === 'Enviada' ? `<button class="btn btn-success btn-sm" style="font-size:11px;padding:4px 8px" onclick="aprovarMedicao('${m.id}')"><i class="fas fa-check"></i> Aprovar</button>` : ''}
                  <button class="btn btn-warning btn-sm btn-icon" onclick="relatorioMedicao('${m.id}')" title="Relatório"><i class="fas fa-file-pdf"></i></button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function filterMedicoes() {
  const st = (document.getElementById('filterMedStatus')?.value || '');
  const lista = _getMedicoesList().filter(m => !st || m.status === st);
  document.getElementById('tabelaMedicoes').innerHTML = renderTabelaMedicoes(lista);
}

function verDetalheMedicao(id) {
  const m = _getMedicoesList().find(x => x.id === id);
  if (!m) return;
  openModal(`Medição ${m.id}`, `
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">${statusBadge(m.status)}</div>
    <div class="stat-row"><span class="stat-label">Contrato</span><span class="stat-value" style="color:var(--orange)">${m.contrato}</span></div>
    <div class="stat-row"><span class="stat-label">Cliente</span><span class="stat-value">${m.cliente}</span></div>
    <div class="stat-row"><span class="stat-label">Competência</span><span class="stat-value">${m.competencia}</span></div>
    <div class="stat-row"><span class="stat-label">Valor Bruto</span><span class="stat-value">${fmt(m.valorBruto)}</span></div>
    <div class="stat-row"><span class="stat-label">Glosa</span><span class="stat-value" style="color:var(--red-light)">${(m.glosa||0) > 0 ? fmt(m.glosa) : '—'}</span></div>
    <div class="stat-row"><span class="stat-label">Valor Líquido</span><span class="stat-value" style="color:var(--green-light);font-weight:700">${fmt(m.valorLiquido)}</span></div>
    <div class="stat-row"><span class="stat-label">Data de Envio</span><span class="stat-value">${m.envio || '—'}</span></div>
    <div class="stat-row"><span class="stat-label">Prev. Pagamento</span><span class="stat-value">${m.previsaoPgto || '—'}</span></div>
    ${m.observacoes ? `<div class="stat-row"><span class="stat-label">Observações</span><span class="stat-value" style="font-size:11px;text-align:right;max-width:200px">${m.observacoes}</span></div>` : ''}
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
    <button class="btn btn-info" onclick="closeModal();editarMedicao('${m.id}')"><i class="fas fa-edit"></i> Editar</button>
    <button class="btn btn-warning" onclick="relatorioMedicao('${m.id}')"><i class="fas fa-file-pdf"></i> Relatório</button>
  `);
}

function editarMedicao(id) {
  if (!hasPermission('medicao', 'edit')) { showToast('Sem permissão para editar medições', 'error'); return; }
  const m = _getMedicoesList().find(x => x.id === id);
  if (!m) return;

  openModalWide(`Editar Medição – ${id}`, `
    <div class="form-row">
      <div class="form-group">
        <label>Status</label>
        <select class="form-control" id="em_status">
          ${['Rascunho','Em Análise','Enviada','Aprovada','Faturada','Paga'].map(s => `<option ${m.status===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Competência</label>
        <input class="form-control" id="em_comp" type="text" value="${m.competencia || ''}">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Valor Bruto (R$)</label>
        <input class="form-control" id="em_bruto" type="number" min="0" step="0.01" value="${m.valorBruto || 0}">
      </div>
      <div class="form-group">
        <label>Glosa (R$)</label>
        <input class="form-control" id="em_glosa" type="number" min="0" step="0.01" value="${m.glosa || 0}" oninput="calcularLiquidoMedicao()">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Valor Líquido (R$)</label>
        <input class="form-control" id="em_liq" type="number" min="0" step="0.01" value="${m.valorLiquido || 0}">
      </div>
      <div class="form-group">
        <label>Data de Envio</label>
        <input class="form-control" id="em_envio" type="text" value="${m.envio || '—'}">
      </div>
    </div>
    <div class="form-group">
      <label>Previsão de Pagamento</label>
      <input class="form-control" id="em_prevpgto" type="text" value="${m.previsaoPgto || ''}">
    </div>
    <div class="form-group">
      <label>Observações</label>
      <textarea class="form-control" id="em_obs" rows="2">${m.observacoes || ''}</textarea>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="salvarEdicaoMedicao('${id}')"><i class="fas fa-save"></i> Salvar</button>
  `);
}

function calcularLiquidoMedicao() {
  const bruto = parseFloat(document.getElementById('em_bruto')?.value) || 0;
  const glosa = parseFloat(document.getElementById('em_glosa')?.value) || 0;
  if (document.getElementById('em_liq')) document.getElementById('em_liq').value = (bruto - glosa).toFixed(2);
}

function salvarEdicaoMedicao(id) {
  const lista = _getMedicoesList();
  const idx = lista.findIndex(x => x.id === id);
  if (idx < 0) return;
  const bruto = parseFloat(document.getElementById('em_bruto').value) || 0;
  const glosa = parseFloat(document.getElementById('em_glosa').value) || 0;
  lista[idx] = {
    ...lista[idx],
    status: document.getElementById('em_status').value,
    competencia: document.getElementById('em_comp').value.trim(),
    valorBruto: bruto,
    glosa,
    valorLiquido: bruto - glosa,
    envio: document.getElementById('em_envio').value.trim(),
    previsaoPgto: document.getElementById('em_prevpgto').value.trim(),
    observacoes: document.getElementById('em_obs').value.trim()
  };
  _saveMedicoesList(lista);
  logAction('Edição Medição', 'Medição', `Medição editada: ${id}`);
  closeModal();
  showToast(`Medição ${id} atualizada!`, 'success');
  renderMedicao();
}

function openNovaMedicao() {
  if (!hasPermission('medicao', 'create')) { showToast('Sem permissão', 'error'); return; }
  const today = new Date();
  const mesAnterior = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const compPadrao = `${meses[mesAnterior.getMonth()]}/${mesAnterior.getFullYear()}`;

  openModalWide('Nova Medição', `
    <div class="form-row">
      <div class="form-group">
        <label>Contrato *</label>
        <select class="form-control" id="nm_contrato" onchange="preencherClienteMedicao()">
          <option value="">Selecione...</option>
          ${ERP_DATA.contratos.filter(c => c.status === 'Ativo').map(c =>
            `<option value="${c.id}" data-cliente="${c.cliente}">${c.id} – ${c.cliente}</option>`
          ).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Cliente</label>
        <input class="form-control" id="nm_cliente" type="text" readonly placeholder="Preenchido automaticamente">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Competência *</label>
        <input class="form-control" id="nm_comp" type="text" value="${compPadrao}" placeholder="Ex: Mar/2025">
      </div>
      <div class="form-group">
        <label>Status Inicial</label>
        <select class="form-control" id="nm_status">
          <option>Rascunho</option><option>Em Análise</option>
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Valor Bruto (R$) *</label>
        <input class="form-control" id="nm_bruto" type="number" min="0" step="0.01" oninput="calcNovaMed()">
      </div>
      <div class="form-group">
        <label>Glosa (R$)</label>
        <input class="form-control" id="nm_glosa" type="number" min="0" step="0.01" value="0" oninput="calcNovaMed()">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Valor Líquido (R$)</label>
        <input class="form-control" id="nm_liq" type="number" readonly>
      </div>
      <div class="form-group">
        <label>Previsão de Pagamento</label>
        <input class="form-control" id="nm_pgto" type="text" placeholder="Ex: 30/05/2025">
      </div>
    </div>
    <div class="form-group">
      <label>Observações</label>
      <textarea class="form-control" id="nm_obs" rows="2" placeholder="Informações adicionais..."></textarea>
    </div>
    <div id="nm_erro" style="display:none;color:var(--red-light);font-size:12px;margin-top:8px;padding:8px;border-radius:6px;background:rgba(239,68,68,0.1)"></div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="salvarNovaMedicao()"><i class="fas fa-save"></i> Criar Medição</button>
  `);
}

function preencherClienteMedicao() {
  const sel = document.getElementById('nm_contrato');
  const opt = sel.options[sel.selectedIndex];
  if (opt && opt.dataset.cliente) {
    document.getElementById('nm_cliente').value = opt.dataset.cliente;
  }
}

function calcNovaMed() {
  const bruto = parseFloat(document.getElementById('nm_bruto')?.value) || 0;
  const glosa = parseFloat(document.getElementById('nm_glosa')?.value) || 0;
  if (document.getElementById('nm_liq')) document.getElementById('nm_liq').value = (bruto - glosa).toFixed(2);
}

function salvarNovaMedicao() {
  const contrato = document.getElementById('nm_contrato').value;
  const comp = document.getElementById('nm_comp').value.trim();
  const bruto = parseFloat(document.getElementById('nm_bruto').value) || 0;
  const glosa = parseFloat(document.getElementById('nm_glosa').value) || 0;
  const erroEl = document.getElementById('nm_erro');

  if (!contrato) { erroEl.textContent = 'Selecione um contrato.'; erroEl.style.display = 'block'; return; }
  if (!comp) { erroEl.textContent = 'Informe a competência.'; erroEl.style.display = 'block'; return; }
  if (bruto <= 0) { erroEl.textContent = 'Informe o valor bruto.'; erroEl.style.display = 'block'; return; }

  const lista = _getMedicoesList();
  const ano = new Date().getFullYear().toString().slice(-2);
  const idNova = `MED-${ano}-${String(lista.length + 1).padStart(3, '0')}X`;

  const novaMed = {
    id: idNova,
    contrato,
    cliente: document.getElementById('nm_cliente').value,
    competencia: comp,
    status: document.getElementById('nm_status').value,
    valorBruto: bruto,
    glosa,
    valorLiquido: bruto - glosa,
    envio: '—',
    previsaoPgto: document.getElementById('nm_pgto').value.trim() || '—',
    observacoes: document.getElementById('nm_obs').value.trim(),
    criadoPor: currentUser ? currentUser.name : 'Sistema',
    criadoEm: new Date().toISOString()
  };

  lista.unshift(novaMed);
  _saveMedicoesList(lista);
  logAction('Nova Medição', 'Medição', `Medição criada: ${idNova} – ${contrato} – ${comp}`);
  closeModal();
  showToast(`Medição ${idNova} criada com sucesso!`, 'success');
  renderMedicao();
}

function enviarMedicao(id) {
  const lista = _getMedicoesList();
  const idx = lista.findIndex(x => x.id === id);
  if (idx < 0) return;
  lista[idx].status = 'Enviada';
  lista[idx].envio = new Date().toLocaleDateString('pt-BR');
  _saveMedicoesList(lista);
  logAction('Envio Medição', 'Medição', `Medição enviada: ${id}`);
  showToast(`Medição ${id} enviada ao cliente!`, 'success');
  renderMedicao();
}

function aprovarMedicao(id) {
  const lista = _getMedicoesList();
  const idx = lista.findIndex(x => x.id === id);
  if (idx < 0) return;
  lista[idx].status = 'Aprovada';
  _saveMedicoesList(lista);
  logAction('Aprovação Medição', 'Medição', `Medição aprovada: ${id}`);
  showToast(`Medição ${id} aprovada!`, 'success');
  renderMedicao();
}

function relatorioMedicao(id) {
  // Usa o gerador de PDF com logo Fraser Alexander (módulo avaliacoes.js)
  if (typeof gerarRelatorioPDFMedicao === 'function') {
    gerarRelatorioPDFMedicao(id);
  } else {
    // Fallback: gera texto simples
    const m = _getMedicoesList().find(x => x.id === id);
    if (!m) return;
    const conteudo = `FRASER ALEXANDER – RELATÓRIO DE MEDIÇÃO\n========================================\nID Medição: ${m.id}\nContrato:   ${m.contrato}\nCliente:    ${m.cliente}\nCompetência: ${m.competencia}\nStatus:     ${m.status}\n----------------------------------------\nValor Bruto:   ${fmt(m.valorBruto)}\nGlosa:         ${fmt(m.glosa || 0)}\nValor Líquido: ${fmt(m.valorLiquido)}\n----------------------------------------\nEmitido em: ${new Date().toLocaleDateString('pt-BR')}\nEmitido por: ${currentUser ? currentUser.name : '—'}\n`;
    const blob = new Blob([conteudo], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Relatorio_Medicao_${id}.txt`;
    a.click();
    showToast('Relatório exportado!', 'success');
  }
}

function exportarMedicoes() {
  const lista = _getMedicoesList();
  const header = ['ID','Contrato','Cliente','Competência','Status','Valor Bruto','Glosa','Valor Líquido','Envio','Prev. Pgto.'];
  const rows = lista.map(m => [m.id, m.contrato, m.cliente, m.competencia, m.status,
    m.valorBruto, m.glosa||0, m.valorLiquido, m.envio||'—', m.previsaoPgto||'—']);
  const csv = [header, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `Medicoes_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  showToast('Medições exportadas!', 'success');
}

// =====================================================
// Fraser Alexander ERP – Módulo Equipe e Mobilização v2
// Com dados do localStorage + edição funcional
// =====================================================

/* ── Helpers de storage ─────────────────────────── */
function _eqGetColabs() {
  try {
    const v = JSON.parse(localStorage.getItem('fraser_colaboradores') || 'null');
    if (Array.isArray(v) && v.length > 0) return v;
  } catch(e) {}
  return ERP_DATA.colaboradores || [];
}

function _eqSaveColabs(list) {
  localStorage.setItem('fraser_colaboradores', JSON.stringify(list));
  // Atualiza o ERP_DATA também
  if (ERP_DATA) ERP_DATA.colaboradores = list;
}

/* ── Render principal ──────────────────────────── */
function renderEquipe() {
  const main = document.getElementById('mainContent');
  const colabs = _eqGetColabs();

  const ativos     = colabs.filter(c => c.status === 'Ativo').length;
  const bloqueados = colabs.filter(c => c.status === 'Bloqueado').length;
  const mobilizando= colabs.filter(c => c.status === 'Mobilizando').length;
  const docCritico = colabs.filter(c => c.docs === 'Crítico').length;
  const docAtencao = colabs.filter(c => c.docs === 'Atenção').length;
  const docOk      = colabs.filter(c => c.docs === 'OK').length;

  main.innerHTML = `
    <style>
    .eq-kpi-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(130px,1fr)); gap:10px; margin-bottom:20px; }
    .eq-kpi { background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:12px;padding:14px 12px;text-align:center; }
    .eq-kpi-num { font-size:26px;font-weight:900;line-height:1; }
    .eq-kpi-lbl { font-size:10px;color:var(--text-muted);margin-top:4px;line-height:1.3; }
    .eq-doc-bar { display:flex;gap:4px;margin:12px 0; }
    .eq-doc-seg { height:12px;border-radius:3px;transition:width .6s ease; }
    .eq-status-summary { display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px;padding:14px 16px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:12px; }
    .eq-status-seg { display:flex;align-items:center;gap:6px;font-size:12px; }
    .eq-status-dot { width:10px;height:10px;border-radius:50%; }
    </style>

    <div class="page-header">
      <div class="page-title">
        <h2><i class="fas fa-users" style="color:var(--fa-teal)"></i> Equipe e Mobilização</h2>
        <p>${colabs.length} colaboradores cadastrados · ${ativos} ativos em campo</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary btn-sm" onclick="_eqExportarCSV()">
          <i class="fas fa-download"></i> Exportar CSV
        </button>
        <button class="btn btn-primary btn-sm" onclick="openNovoColaborador()">
          <i class="fas fa-user-plus"></i> Novo Colaborador
        </button>
      </div>
    </div>

    <!-- KPIs -->
    <div class="eq-kpi-grid">
      <div class="eq-kpi">
        <div class="eq-kpi-num" style="color:var(--fa-teal)">${colabs.length}</div>
        <div class="eq-kpi-lbl">Total Cadastrados</div>
      </div>
      <div class="eq-kpi">
        <div class="eq-kpi-num" style="color:#22c55e">${ativos}</div>
        <div class="eq-kpi-lbl">Ativos em Campo</div>
      </div>
      <div class="eq-kpi">
        <div class="eq-kpi-num" style="color:#f59e0b">${mobilizando}</div>
        <div class="eq-kpi-lbl">Em Mobilização</div>
      </div>
      <div class="eq-kpi">
        <div class="eq-kpi-num" style="color:#ef4444">${bloqueados}</div>
        <div class="eq-kpi-lbl">Bloqueados</div>
      </div>
      <div class="eq-kpi">
        <div class="eq-kpi-num" style="color:#22c55e">${docOk}</div>
        <div class="eq-kpi-lbl">Docs OK</div>
      </div>
      <div class="eq-kpi">
        <div class="eq-kpi-num" style="color:#f59e0b">${docAtencao}</div>
        <div class="eq-kpi-lbl">Docs Atenção</div>
      </div>
      <div class="eq-kpi">
        <div class="eq-kpi-num" style="color:#ef4444">${docCritico}</div>
        <div class="eq-kpi-lbl">Docs Crítico</div>
      </div>
      <div class="eq-kpi">
        <div class="eq-kpi-num" style="color:#6366f1">${ERP_DATA.contratos.filter(c=>c.status!=='Encerrado').length}</div>
        <div class="eq-kpi-lbl">Contratos Ativos</div>
      </div>
    </div>

    <!-- Barra de docs -->
    <div class="eq-status-summary">
      <div style="flex:1;min-width:200px">
        <div style="font-size:11px;font-weight:700;margin-bottom:6px">Conformidade Documental</div>
        <div class="eq-doc-bar">
          ${docOk>0?`<div class="eq-doc-seg" style="width:${Math.round(docOk/colabs.length*100)}%;background:#22c55e" title="${docOk} OK"></div>`:''}
          ${docAtencao>0?`<div class="eq-doc-seg" style="width:${Math.round(docAtencao/colabs.length*100)}%;background:#f59e0b" title="${docAtencao} Atenção"></div>`:''}
          ${docCritico>0?`<div class="eq-doc-seg" style="width:${Math.round(docCritico/colabs.length*100)}%;background:#ef4444" title="${docCritico} Crítico"></div>`:''}
        </div>
        <div style="display:flex;gap:10px;font-size:10px;color:var(--text-muted)">
          <span><span style="color:#22c55e">●</span> ${docOk} OK (${Math.round(docOk/colabs.length*100)}%)</span>
          <span><span style="color:#f59e0b">●</span> ${docAtencao} Atenção</span>
          <span><span style="color:#ef4444">●</span> ${docCritico} Crítico</span>
        </div>
      </div>
      <div class="eq-status-seg"><div class="eq-status-dot" style="background:#22c55e"></div>Ativos: <b>${ativos}</b></div>
      <div class="eq-status-seg"><div class="eq-status-dot" style="background:#f59e0b"></div>Mobilizando: <b>${mobilizando}</b></div>
      <div class="eq-status-seg"><div class="eq-status-dot" style="background:#ef4444"></div>Bloqueados: <b>${bloqueados}</b></div>
      <div class="eq-status-seg"><div class="eq-status-dot" style="background:#8b949e"></div>Outros: <b>${colabs.length - ativos - mobilizando - bloqueados}</b></div>
    </div>

    ${docCritico > 0 ? `
      <div style="background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.3);border-radius:10px;padding:12px 16px;margin-bottom:16px;display:flex;align-items:center;gap:12px">
        <i class="fas fa-exclamation-triangle" style="color:#ef4444;font-size:20px"></i>
        <div>
          <div style="font-size:13px;font-weight:700;color:#ef4444">${docCritico} colaborador(es) com documentação CRÍTICA</div>
          <div style="font-size:11px;color:var(--text-secondary);margin-top:2px">Colaboradores com documentação crítica não podem ser mobilizados. Regularize CTPS, ASO e NRs obrigatórias.</div>
        </div>
        <button class="btn btn-sm" style="background:#ef4444;color:#fff;border:none;margin-left:auto;flex-shrink:0" onclick="document.getElementById('filterEquipeDoc').value='Crítico';filterEquipe()">
          <i class="fas fa-filter"></i> Filtrar Críticos
        </button>
      </div>` : ''}

    <!-- Tabela -->
    <div class="card page-section">
      <div class="search-bar">
        <div class="search-input-wrapper">
          <i class="fas fa-search"></i>
          <input class="search-input" type="text" placeholder="Buscar por nome, função, contrato, ID..." id="searchEquipe" oninput="filterEquipe()">
        </div>
        <select class="filter-select" id="filterEquipeStatus" onchange="filterEquipe()">
          <option value="">Todos os Status</option>
          <option>Ativo</option>
          <option>Bloqueado</option>
          <option>Mobilizando</option>
          <option>Desmobilizado</option>
        </select>
        <select class="filter-select" id="filterEquipeContrato" onchange="filterEquipe()">
          <option value="">Todos os Contratos</option>
          ${ERP_DATA.contratos.map(c => `<option value="${c.id}">${c.id} – ${c.cliente}</option>`).join('')}
        </select>
        <select class="filter-select" id="filterEquipeDoc" onchange="filterEquipe()">
          <option value="">Todos os Docs</option>
          <option>OK</option>
          <option>Atenção</option>
          <option>Crítico</option>
        </select>
      </div>
      <div id="tabelaEquipe">
        ${renderTabelaEquipe(_eqGetColabs())}
      </div>
    </div>

    <!-- Alocação por contrato -->
    <div class="card page-section">
      <div class="card-header">
        <h3><i class="fas fa-map-marked-alt" style="color:var(--orange);margin-right:8px"></i>Alocação por Contrato</h3>
      </div>
      <div class="card-body">
        <div class="grid-3">
          ${ERP_DATA.contratos.filter(c => c.status !== 'Encerrado' && c.equipe > 0).map(c => {
            const colsContrato = _eqGetColabs().filter(e => e.contrato === c.id);
            const okDocs = colsContrato.filter(e => e.docs === 'OK').length;
            const critico= colsContrato.filter(e => e.docs === 'Crítico').length;
            const pct = colsContrato.length > 0 ? Math.round((okDocs/colsContrato.length)*100) : 100;
            return `
              <div style="background:var(--bg-card2);border:1px solid ${critico>0?'rgba(239,68,68,.4)':'var(--border)'};border-radius:var(--radius);padding:16px">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
                  <div>
                    <div style="font-weight:600;font-size:13px">${c.cliente}</div>
                    <div style="font-size:11px;color:var(--text-muted)">${c.id}</div>
                  </div>
                  ${statusBadge(c.status)}
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px">
                  <div style="text-align:center">
                    <div style="font-size:20px;font-weight:700;color:var(--orange)">${c.equipe}</div>
                    <div style="font-size:10px;color:var(--text-muted)">Planejados</div>
                  </div>
                  <div style="text-align:center">
                    <div style="font-size:20px;font-weight:700;color:var(--green-light)">${colsContrato.length}</div>
                    <div style="font-size:10px;color:var(--text-muted)">Cadastrados</div>
                  </div>
                  <div style="text-align:center">
                    <div style="font-size:20px;font-weight:700;color:${critico>0?'#ef4444':'#22c55e'}">${okDocs}</div>
                    <div style="font-size:10px;color:var(--text-muted)">Docs OK</div>
                  </div>
                </div>
                <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">Conformidade documental ${pct}%</div>
                <div class="progress">
                  <div class="progress-bar ${pct===100?'green':pct>60?'':'red'}" style="width:${pct}%;background:${critico>0?'#ef4444':pct>80?'#22c55e':'#f59e0b'}"></div>
                </div>
                <div style="font-size:11px;color:var(--text-secondary);margin-top:3px">${okDocs}/${colsContrato.length} conformes${critico>0?` · <span style="color:#ef4444">${critico} crítico(s)</span>`:''}</div>
                <div style="margin-top:10px;display:flex;gap:6px">
                  <button class="btn btn-secondary btn-sm" style="flex:1;font-size:11px" onclick="document.getElementById('filterEquipeContrato').value='${c.id}';filterEquipe();document.querySelector('.card.page-section').scrollIntoView({behavior:'smooth'})">
                    <i class="fas fa-eye"></i> Ver equipe
                  </button>
                </div>
              </div>`;
          }).join('')}
        </div>
      </div>
    </div>
  `;
}

function renderTabelaEquipe(colaboradores) {
  if (!colaboradores || colaboradores.length === 0) {
    return `<div style="text-align:center;padding:32px;color:var(--text-muted)"><i class="fas fa-search" style="font-size:24px;margin-bottom:8px;display:block"></i>Nenhum colaborador encontrado com os filtros aplicados.</div>`;
  }
  return `
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Nome</th>
            <th>Função</th>
            <th>Contrato</th>
            <th>Turno</th>
            <th>ASO</th>
            <th>NR-10</th>
            <th>NR-35</th>
            <th>Docs.</th>
            <th>Status</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          ${colaboradores.map(c => `
            <tr style="${c.status === 'Bloqueado' ? 'background:rgba(220,38,38,0.05)' : c.docs==='Crítico'?'background:rgba(239,68,68,0.03)':''}">
              <td>
                <div style="display:flex;align-items:center;gap:8px">
                  <div style="width:32px;height:32px;min-width:32px;background:${c.status==='Bloqueado'?'rgba(220,38,38,0.2)':c.docs==='Crítico'?'rgba(239,68,68,0.15)':'rgba(0,180,184,0.15)'};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:${c.status==='Bloqueado'?'var(--red-light)':'var(--fa-teal)'}">
                    ${(c.nome||'?').split(' ').map(n=>n[0]).slice(0,2).join('')}
                  </div>
                  <div>
                    <div style="font-weight:600;font-size:13px">${c.nome}</div>
                    <div style="font-size:10px;color:var(--text-muted)">${c.id}</div>
                  </div>
                </div>
              </td>
              <td style="font-size:12px;color:var(--text-secondary)">${c.funcao||c.cargo||'—'}</td>
              <td style="font-size:11px;color:var(--orange)">${c.contrato||'—'}</td>
              <td>
                <span style="display:inline-flex;align-items:center;gap:4px;font-size:12px">
                  <i class="fas fa-${c.turno==='Noturno'?'moon':'sun'}" style="color:${c.turno==='Noturno'?'var(--blue-light)':'var(--yellow-light)'}"></i>
                  ${c.turno||'—'}
                </span>
              </td>
              <td style="font-size:12px">${c.aso||'—'}</td>
              <td>${statusBadge(c.nr10||'N/A')}</td>
              <td>${statusBadge(c.nr35||'N/A')}</td>
              <td>${statusBadge(c.docs||'—')}</td>
              <td>${statusBadge(c.status||'—')}</td>
              <td>
                <div class="actions-cell">
                  <button class="btn btn-secondary btn-sm btn-icon" onclick="verDetalheColaborador('${c.id}')" title="Ver Ficha">
                    <i class="fas fa-id-card"></i>
                  </button>
                  <button class="btn btn-info btn-sm btn-icon" onclick="editarColaborador('${c.id}')" title="Editar">
                    <i class="fas fa-edit"></i>
                  </button>
                  <button class="btn btn-sm btn-icon" onclick="_eqAlterarStatus('${c.id}')" title="Alterar Status" style="background:rgba(99,102,241,.1);color:#6366f1;border:1px solid rgba(99,102,241,.2)">
                    <i class="fas fa-exchange-alt"></i>
                  </button>
                </div>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function filterEquipe() {
  const search   = (document.getElementById('searchEquipe')?.value || '').toLowerCase();
  const status   = document.getElementById('filterEquipeStatus')?.value || '';
  const contrato = document.getElementById('filterEquipeContrato')?.value || '';
  const doc      = document.getElementById('filterEquipeDoc')?.value || '';

  const filtered = _eqGetColabs().filter(c => {
    const nome = (c.nome||'').toLowerCase();
    const func = (c.funcao||c.cargo||'').toLowerCase();
    const id   = (c.id||'').toLowerCase();
    const matchSearch  = !search  || nome.includes(search) || func.includes(search) || id.includes(search) || (c.contrato||'').toLowerCase().includes(search);
    const matchStatus  = !status  || c.status === status;
    const matchContrat = !contrato|| c.contrato === contrato;
    const matchDoc     = !doc     || c.docs === doc;
    return matchSearch && matchStatus && matchContrat && matchDoc;
  });

  const el = document.getElementById('tabelaEquipe');
  if (el) el.innerHTML = renderTabelaEquipe(filtered);
}

function verDetalheColaborador(id) {
  const colabs = _eqGetColabs();
  const c = colabs.find(x => x.id === id);
  if (!c) return;
  const contrato = ERP_DATA.contratos.find(x => x.id === c.contrato);

  openModal(`Ficha – ${c.nome}`, `
    <div style="display:flex;align-items:center;gap:14px;padding:16px;background:var(--bg-dark);border-radius:8px;margin-bottom:16px">
      <div style="width:56px;height:56px;background:${c.status==='Bloqueado'?'rgba(220,38,38,0.2)':'rgba(0,180,184,0.15)'};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;color:${c.status==='Bloqueado'?'var(--red-light)':'var(--fa-teal)'}">
        ${(c.nome||'?').split(' ').map(n=>n[0]).slice(0,2).join('')}
      </div>
      <div>
        <div style="font-size:16px;font-weight:700">${c.nome}</div>
        <div style="font-size:12px;color:var(--text-secondary)">${c.funcao||c.cargo||'—'}</div>
        <div style="margin-top:4px;display:flex;gap:6px">${statusBadge(c.status)}</div>
      </div>
    </div>
    <div class="stat-row"><span class="stat-label">ID</span><span class="stat-value" style="color:var(--orange)">${c.id}</span></div>
    <div class="stat-row"><span class="stat-label">Contrato Alocado</span><span class="stat-value">${c.contrato||'—'}${contrato?' – '+contrato.cliente:''}</span></div>
    <div class="stat-row"><span class="stat-label">Turno</span><span class="stat-value">${c.turno||'—'}</span></div>
    <div class="stat-row"><span class="stat-label">Admissão</span><span class="stat-value">${c.admissao||'—'}</span></div>
    <div class="stat-row"><span class="stat-label">Salário Base</span><span class="stat-value">${c.salario?'R$ '+Number(c.salario).toLocaleString('pt-BR',{minimumFractionDigits:2}):'—'}</span></div>
    <div class="stat-row"><span class="stat-label">ASO Válido até</span><span class="stat-value">${c.aso||'—'}</span></div>
    <div class="stat-row"><span class="stat-label">NR-10</span>${statusBadge(c.nr10||'N/A')}</div>
    <div class="stat-row"><span class="stat-label">NR-35</span>${statusBadge(c.nr35||'N/A')}</div>
    <div class="stat-row"><span class="stat-label">NR-33</span>${statusBadge(c.nr33||'N/A')}</div>
    <div class="stat-row"><span class="stat-label">Status Documentos</span>${statusBadge(c.docs||'—')}</div>
    ${c.status === 'Bloqueado' ? `
      <div class="alert alert-danger" style="margin-top:12px">
        <span class="alert-icon"><i class="fas fa-ban"></i></span>
        <div>
          <div class="alert-title">Colaborador Bloqueado</div>
          <div class="alert-desc">Não pode operar até regularização dos documentos obrigatórios. Verifique NR-10, ASO e CTPS.</div>
        </div>
      </div>` : ''}
    ${c.docs === 'Crítico' ? `
      <div class="alert alert-danger" style="margin-top:12px">
        <span class="alert-icon"><i class="fas fa-exclamation-triangle"></i></span>
        <div>
          <div class="alert-title">Documentação Crítica</div>
          <div class="alert-desc">Este colaborador possui documentos vencidos ou ausentes. Regularize urgentemente conforme CLT Art. 29 e NR-7.</div>
        </div>
      </div>` : ''}
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
    <button class="btn btn-primary" onclick="closeModal();editarColaborador('${c.id}')">
      <i class="fas fa-edit"></i> Editar
    </button>
  `);
}

function editarColaborador(id) {
  const colabs = _eqGetColabs();
  const c = colabs.find(x => x.id === id);
  if (!c) return;

  openModal(`Editar – ${c.nome}`, `
    <div class="form-row">
      <div class="form-group">
        <label>Nome Completo</label>
        <input class="form-control" type="text" id="editNome" value="${c.nome||''}">
      </div>
      <div class="form-group">
        <label>Função / Cargo</label>
        <input class="form-control" type="text" id="editFuncao" value="${c.funcao||c.cargo||''}">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Turno</label>
        <select class="form-control" id="editTurno">
          <option ${c.turno==='Diurno'?'selected':''}>Diurno</option>
          <option ${c.turno==='Noturno'?'selected':''}>Noturno</option>
          <option ${c.turno==='Revezamento 12x36'?'selected':''}>Revezamento 12x36</option>
          <option ${c.turno==='Administrativo'?'selected':''}>Administrativo</option>
        </select>
      </div>
      <div class="form-group">
        <label>Contrato de Alocação</label>
        <select class="form-control" id="editContrato">
          <option value="">Sem contrato</option>
          ${ERP_DATA.contratos.map(ct=>`<option value="${ct.id}" ${c.contrato===ct.id?'selected':''}>${ct.id} – ${ct.cliente}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Status do Colaborador</label>
        <select class="form-control" id="editStatus">
          <option ${c.status==='Ativo'?'selected':''}>Ativo</option>
          <option ${c.status==='Mobilizando'?'selected':''}>Mobilizando</option>
          <option ${c.status==='Bloqueado'?'selected':''}>Bloqueado</option>
          <option ${c.status==='Desmobilizado'?'selected':''}>Desmobilizado</option>
        </select>
      </div>
      <div class="form-group">
        <label>Status Documentação</label>
        <select class="form-control" id="editDocs">
          <option ${c.docs==='OK'?'selected':''}>OK</option>
          <option ${c.docs==='Atenção'?'selected':''}>Atenção</option>
          <option ${c.docs==='Crítico'?'selected':''}>Crítico</option>
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>ASO – Validade</label>
        <input class="form-control" type="text" id="editASO" value="${c.aso||''}" placeholder="Ex: 2026-03-15">
      </div>
      <div class="form-group">
        <label>NR-10 Status</label>
        <select class="form-control" id="editNR10">
          <option ${c.nr10==='Válido'?'selected':''}>Válido</option>
          <option ${c.nr10==='Vencendo'?'selected':''}>Vencendo</option>
          <option ${c.nr10==='Vencido'?'selected':''}>Vencido</option>
          <option ${c.nr10==='N/A'?'selected':''}>N/A</option>
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>NR-35 Status</label>
        <select class="form-control" id="editNR35">
          <option ${c.nr35==='Válido'?'selected':''}>Válido</option>
          <option ${c.nr35==='Vencendo'?'selected':''}>Vencendo</option>
          <option ${c.nr35==='Vencido'?'selected':''}>Vencido</option>
          <option ${c.nr35==='N/A'?'selected':''}>N/A</option>
        </select>
      </div>
      <div class="form-group">
        <label>Admissão</label>
        <input class="form-control" type="date" id="editAdmissao" value="${c.admissao||''}">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Salário Base (R$)</label>
        <input class="form-control" type="number" id="editSalario" value="${c.salario||''}" placeholder="0,00">
      </div>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="_eqSalvarEdicao('${c.id}')">
      <i class="fas fa-save"></i> Salvar Alterações
    </button>
  `);
}

function _eqSalvarEdicao(id) {
  const colabs = _eqGetColabs();
  const idx = colabs.findIndex(x => x.id === id);
  if (idx < 0) return;

  const nome    = document.getElementById('editNome')?.value.trim();
  const funcao  = document.getElementById('editFuncao')?.value.trim();
  const turno   = document.getElementById('editTurno')?.value;
  const contrato= document.getElementById('editContrato')?.value;
  const status  = document.getElementById('editStatus')?.value;
  const docs    = document.getElementById('editDocs')?.value;
  const aso     = document.getElementById('editASO')?.value.trim();
  const nr10    = document.getElementById('editNR10')?.value;
  const nr35    = document.getElementById('editNR35')?.value;
  const admissao= document.getElementById('editAdmissao')?.value;
  const salario = document.getElementById('editSalario')?.value;

  if (!nome) { showToast('Nome é obrigatório!', 'error'); return; }

  colabs[idx] = {
    ...colabs[idx],
    nome, funcao, turno, contrato, status, docs, aso, nr10, nr35,
    admissao: admissao || colabs[idx].admissao,
    salario: salario ? Number(salario) : colabs[idx].salario,
  };

  _eqSaveColabs(colabs);
  closeModal();
  showToast(`Colaborador ${nome} atualizado com sucesso!`, 'success');
  renderEquipe();
}

function _eqAlterarStatus(id) {
  const colabs = _eqGetColabs();
  const c = colabs.find(x => x.id === id);
  if (!c) return;

  const statusList = ['Ativo', 'Mobilizando', 'Bloqueado', 'Desmobilizado'];
  const atual = c.status || 'Ativo';

  openModal(`Alterar Status – ${c.nome}`, `
    <div style="padding:8px 0">
      <div style="font-size:13px;color:var(--text-secondary);margin-bottom:16px">
        Status atual: ${statusBadge(atual)}
      </div>
      <div style="display:grid;gap:8px">
        ${statusList.map(s => `
          <button onclick="_eqDefinirStatus('${id}','${s}')" style="display:flex;align-items:center;gap:10px;padding:12px 16px;border-radius:10px;border:2px solid ${s===atual?'var(--fa-teal)':'var(--border-color)'};background:${s===atual?'rgba(0,180,184,.08)':'var(--bg-primary)'};cursor:pointer;width:100%;text-align:left">
            <div style="width:10px;height:10px;border-radius:50%;background:${s==='Ativo'?'#22c55e':s==='Mobilizando'?'#f59e0b':s==='Bloqueado'?'#ef4444':'#8b949e'}"></div>
            <div>
              <div style="font-weight:700;font-size:13px">${s}</div>
              <div style="font-size:10px;color:var(--text-muted)">${
                s==='Ativo'?'Colaborador em campo, documentação OK':
                s==='Mobilizando'?'Em processo de mobilização para o contrato':
                s==='Bloqueado'?'Impedido de operar – docs/NRs pendentes':
                'Finalizado ou desligado do contrato'
              }</div>
            </div>
            ${s===atual?'<i class="fas fa-check" style="color:var(--fa-teal);margin-left:auto"></i>':''}
          </button>`).join('')}
      </div>
    </div>
  `, `<button class="btn btn-secondary" onclick="closeModal()">Fechar</button>`);
}

function _eqDefinirStatus(id, novoStatus) {
  const colabs = _eqGetColabs();
  const idx = colabs.findIndex(x => x.id === id);
  if (idx < 0) return;
  const nome = colabs[idx].nome;
  colabs[idx].status = novoStatus;
  _eqSaveColabs(colabs);
  closeModal();
  showToast(`Status de ${nome} alterado para: ${novoStatus}`, 'success');
  renderEquipe();
}

function openNovoColaborador() {
  const colabs = _eqGetColabs();
  const proxId = 'COL-' + String(colabs.length + 1).padStart(3, '0');

  openModal('Novo Colaborador', `
    <div class="form-row">
      <div class="form-group">
        <label>Nome Completo *</label>
        <input class="form-control" type="text" id="novoNome" placeholder="Nome do colaborador">
      </div>
      <div class="form-group">
        <label>CPF</label>
        <input class="form-control" type="text" id="novoCPF" placeholder="000.000.000-00">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Função / Cargo *</label>
        <input class="form-control" type="text" id="novoFuncao" placeholder="Ex: Mecânico de Manutenção">
      </div>
      <div class="form-group">
        <label>Turno</label>
        <select class="form-control" id="novoTurno">
          <option>Diurno</option>
          <option>Noturno</option>
          <option>Revezamento 12x36</option>
          <option>Administrativo</option>
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Contrato de Alocação *</label>
        <select class="form-control" id="novoContrato">
          <option value="">Selecione um contrato</option>
          ${ERP_DATA.contratos.filter(c=>c.status!=='Encerrado').map(c=>`<option value="${c.id}">${c.id} – ${c.cliente}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Data de Admissão</label>
        <input class="form-control" type="date" id="novoAdmissao" value="${new Date().toISOString().slice(0,10)}">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>ASO – Validade</label>
        <input class="form-control" type="text" id="novoASO" placeholder="Ex: 2026-12-31">
      </div>
      <div class="form-group">
        <label>Salário Base (R$)</label>
        <input class="form-control" type="number" id="novoSalario" placeholder="0,00">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>NR-10</label>
        <select class="form-control" id="novoNR10">
          <option>N/A</option>
          <option>Válido</option>
          <option>Vencendo</option>
          <option>Vencido</option>
        </select>
      </div>
      <div class="form-group">
        <label>NR-35</label>
        <select class="form-control" id="novoNR35">
          <option>N/A</option>
          <option>Válido</option>
          <option>Vencendo</option>
          <option>Vencido</option>
        </select>
      </div>
    </div>
    <div style="font-size:11px;color:var(--text-muted);padding:8px;background:var(--bg-dark);border-radius:6px">
      <i class="fas fa-info-circle" style="color:#6366f1;margin-right:6px"></i>
      ID gerado automaticamente: <strong>${proxId}</strong> · Status inicial: Mobilizando · Documentação: Atenção (completar após cadastro)
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="_eqCadastrarNovo('${proxId}')">
      <i class="fas fa-user-plus"></i> Cadastrar
    </button>
  `);
}

function _eqCadastrarNovo(proxId) {
  const nome    = document.getElementById('novoNome')?.value.trim();
  const funcao  = document.getElementById('novoFuncao')?.value.trim();
  const turno   = document.getElementById('novoTurno')?.value;
  const contrato= document.getElementById('novoContrato')?.value;
  const admissao= document.getElementById('novoAdmissao')?.value;
  const aso     = document.getElementById('novoASO')?.value.trim();
  const salario = document.getElementById('novoSalario')?.value;
  const nr10    = document.getElementById('novoNR10')?.value;
  const nr35    = document.getElementById('novoNR35')?.value;

  if (!nome)    { showToast('Informe o nome do colaborador!', 'error'); return; }
  if (!funcao)  { showToast('Informe a função/cargo!', 'error'); return; }
  if (!contrato){ showToast('Selecione um contrato!', 'error'); return; }

  const colabs = _eqGetColabs();
  const novo = {
    id: proxId, nome, funcao, cargo: funcao, turno, contrato,
    admissao: admissao || new Date().toISOString().slice(0,10),
    status: 'Mobilizando',
    docs: 'Atenção',
    aso: aso || 'A definir',
    nr10, nr35, nr33: 'N/A',
    salario: salario ? Number(salario) : 0,
  };

  colabs.push(novo);
  _eqSaveColabs(colabs);
  closeModal();
  showToast(`Colaborador ${nome} cadastrado com sucesso! ID: ${proxId}`, 'success');
  renderEquipe();
}

function _eqExportarCSV() {
  const colabs = _eqGetColabs();
  const header = ['ID','Nome','Função','Contrato','Turno','Status','Docs','ASO','NR-10','NR-35','Admissão','Salário'];
  const rows = colabs.map(c => [
    c.id, c.nome, c.funcao||c.cargo||'', c.contrato||'', c.turno||'',
    c.status||'', c.docs||'', c.aso||'', c.nr10||'', c.nr35||'',
    c.admissao||'', c.salario||''
  ]);
  const csv = [header, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF'+csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `equipe_fraser_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  showToast('CSV exportado com sucesso!', 'success');
}

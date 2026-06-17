// =====================================================
// Fraser Alexander – Módulos Editáveis
// Equipe, Frota, SSMA, Almoxarifado, Fornecedores (patch)
// =====================================================

// ─── PERSISTÊNCIA LOCAL ────────────────────────────────────────────────────
function _getColaboradores() {
  try { const r = localStorage.getItem('fa_colaboradores'); return r ? JSON.parse(r) : null; } catch(e) { return null; }
}
function _saveColaboradores(d) { localStorage.setItem('fa_colaboradores', JSON.stringify(d)); }
function _getEquipeData() {
  return _getColaboradores() || JSON.parse(JSON.stringify(ERP_DATA.colaboradores));
}

function _getEquipamentosData() {
  try { const r = localStorage.getItem('fa_equipamentos'); return r ? JSON.parse(r) : null; } catch(e) { return null; }
}
function _saveEquipamentos(d) { localStorage.setItem('fa_equipamentos', JSON.stringify(d)); }
function _getEquipData() { return _getEquipamentosData() || JSON.parse(JSON.stringify(ERP_DATA.equipamentos)); }

function _getIncidentesData() {
  try { const r = localStorage.getItem('fa_incidentes'); return r ? JSON.parse(r) : null; } catch(e) { return null; }
}
function _saveIncidentes(d) { localStorage.setItem('fa_incidentes', JSON.stringify(d)); }
function _getIncData() { return _getIncidentesData() || JSON.parse(JSON.stringify(ERP_DATA.incidentes)); }

function _getMovAlmox() { try { const r = localStorage.getItem('fa_mov_almox'); return r ? JSON.parse(r) : []; } catch(e) { return []; } }
function _saveMovAlmox(d) { localStorage.setItem('fa_mov_almox', JSON.stringify(d)); }

// ─── MÓDULO EQUIPE (SOBRESCREVE renderEquipe) ────────────────────────────────
function renderEquipe() {
  if (!hasPermission('equipe', 'view')) { renderAcessoNegado(); return; }
  const colab = _getEquipeData();
  const main = document.getElementById('mainContent');

  const ativos = colab.filter(c => c.status === 'Ativo').length;
  const bloqueados = colab.filter(c => c.status === 'Bloqueado').length;
  const mobilizando = colab.filter(c => c.status === 'Mobilizando').length;
  const alertaDocs = colab.filter(c => c.docs === 'Crítico' || c.docs === 'Atenção').length;

  main.innerHTML = `
    <div class="page-header">
      <div class="page-title">
        <h2><i class="fas fa-users" style="color:var(--orange);margin-right:8px"></i>Equipe e Mobilização</h2>
        <p>${colab.length} colaboradores · ${ativos} ativos</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary btn-sm" onclick="exportarEquipe()"><i class="fas fa-file-excel"></i> Exportar</button>
        ${hasPermission('equipe','create') ? `<button class="btn btn-primary btn-sm" onclick="openNovoColaborador()"><i class="fas fa-user-plus"></i> Novo Colaborador</button>` : ''}
      </div>
    </div>

    <div class="kpi-grid" style="grid-template-columns:repeat(5,1fr)">
      <div class="kpi-card kpi-blue"><div class="kpi-icon"><i class="fas fa-users"></i></div><div class="kpi-value">${colab.length}</div><div class="kpi-label">Total Cadastrados</div></div>
      <div class="kpi-card kpi-green"><div class="kpi-icon"><i class="fas fa-hard-hat"></i></div><div class="kpi-value">${ativos}</div><div class="kpi-label">Ativos em Campo</div></div>
      <div class="kpi-card kpi-orange"><div class="kpi-icon"><i class="fas fa-truck-moving"></i></div><div class="kpi-value">${mobilizando}</div><div class="kpi-label">Em Mobilização</div></div>
      <div class="kpi-card kpi-red"><div class="kpi-icon"><i class="fas fa-user-slash"></i></div><div class="kpi-value">${bloqueados}</div><div class="kpi-label">Bloqueados</div></div>
      <div class="kpi-card ${alertaDocs>0?'kpi-yellow':'kpi-green'}"><div class="kpi-icon"><i class="fas fa-id-card"></i></div><div class="kpi-value">${alertaDocs}</div><div class="kpi-label">Docs. Vencendo/Vencidos</div></div>
    </div>

    <!-- Alertas documentação -->
    ${alertaDocs > 0 ? `
    <div class="card page-section" style="border-color:var(--yellow)">
      <div class="card-header"><h3><i class="fas fa-exclamation-triangle" style="color:var(--yellow-light);margin-right:8px"></i>Documentação em Alerta</h3></div>
      ${colab.filter(c=>c.docs==='Crítico'||c.docs==='Atenção').map(c=>`
        <div class="alert ${c.docs==='Crítico'?'alert-danger':'alert-warning'}" style="margin:4px 16px">
          <span class="alert-icon"><i class="fas fa-id-card"></i></span>
          <div style="flex:1">
            <strong>${c.nome}</strong> – ${c.funcao} | ${c.contrato}
            <div style="font-size:11px;margin-top:2px">ASO: ${c.aso} · NR-10: ${c.nr10} · NR-35: ${c.nr35}</div>
          </div>
          <div style="display:flex;gap:4px">
            ${statusBadge(c.docs)}
            ${hasPermission('equipe','edit') ? `<button class="btn btn-info btn-sm btn-icon" onclick="editarColaborador('${c.id}')" title="Editar"><i class="fas fa-edit"></i></button>` : ''}
          </div>
        </div>
      `).join('')}
      <div style="height:8px"></div>
    </div>` : ''}

    <div class="card page-section">
      <div class="search-bar">
        <div class="search-input-wrapper">
          <i class="fas fa-search"></i>
          <input class="search-input" id="searchEq" type="text" placeholder="Buscar colaborador..." oninput="filterEquipe()">
        </div>
        <select class="filter-select" id="filterEqStatus" onchange="filterEquipe()">
          <option value="">Todos os Status</option>
          <option>Ativo</option><option>Mobilizando</option><option>Bloqueado</option><option>Inativo</option>
        </select>
        <select class="filter-select" id="filterEqCtr" onchange="filterEquipe()">
          <option value="">Todos os Contratos</option>
          ${[...new Set(colab.map(c=>c.contrato))].map(c=>`<option>${c}</option>`).join('')}
        </select>
      </div>
      <div id="tabelaEquipe">${renderTabelaEquipe(colab)}</div>
    </div>
  `;
}

function renderTabelaEquipe(lista) {
  if (!lista.length) return `<div class="empty-state" style="padding:40px"><p>Nenhum colaborador encontrado</p></div>`;
  return `
    <div class="table-wrapper">
      <table>
        <thead><tr><th>ID</th><th>Nome</th><th>Função</th><th>Contrato</th><th>Turno</th><th>ASO</th><th>NR-10</th><th>NR-35</th><th>Status</th><th>Docs</th><th>Ações</th></tr></thead>
        <tbody>
          ${lista.map(c => `
            <tr>
              <td style="color:var(--fa-teal);font-size:11px">${c.id}</td>
              <td style="font-weight:500">${c.nome}</td>
              <td style="font-size:12px;color:var(--text-secondary)">${c.funcao}</td>
              <td style="font-size:11px;color:var(--text-muted)">${c.contrato}</td>
              <td><span class="badge badge-muted">${c.turno}</span></td>
              <td style="font-size:11px;color:${_docColor(c.aso)}">${c.aso}</td>
              <td>${statusBadge(c.nr10)}</td>
              <td>${statusBadge(c.nr35)}</td>
              <td>${statusBadge(c.status)}</td>
              <td>${statusBadge(c.docs)}</td>
              <td>
                <div class="actions-cell">
                  ${hasPermission('equipe','edit') ? `<button class="btn btn-info btn-sm btn-icon" onclick="editarColaborador('${c.id}')" title="Editar"><i class="fas fa-edit"></i></button>` : ''}
                  ${c.status==='Ativo' && hasPermission('equipe','edit') ? `<button class="btn btn-danger btn-sm btn-icon" onclick="alterarStatusColab('${c.id}','Bloqueado')" title="Bloquear"><i class="fas fa-lock"></i></button>` : ''}
                  ${c.status==='Bloqueado' && hasPermission('equipe','edit') ? `<button class="btn btn-success btn-sm btn-icon" onclick="alterarStatusColab('${c.id}','Ativo')" title="Desbloquear"><i class="fas fa-unlock"></i></button>` : ''}
                  ${hasPermission('equipe','delete') ? `<button class="btn btn-danger btn-sm btn-icon" onclick="excluirColaborador('${c.id}')" title="Excluir"><i class="fas fa-trash"></i></button>` : ''}
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function _docColor(aso) {
  const hoje = new Date();
  const partes = aso?.split('/');
  if (!partes || partes.length < 3) return 'var(--text-muted)';
  const data = new Date(`${partes[2]}-${partes[1]}-${partes[0]}`);
  const diff = (data - hoje) / (1000 * 60 * 60 * 24);
  if (diff < 0) return 'var(--red-light)';
  if (diff < 30) return 'var(--yellow-light)';
  return 'var(--green-light)';
}

function filterEquipe() {
  const s = (document.getElementById('searchEq')?.value||'').toLowerCase();
  const st = document.getElementById('filterEqStatus')?.value||'';
  const ct = document.getElementById('filterEqCtr')?.value||'';
  const f = _getEquipeData().filter(c =>
    (!s || (c.nome+c.funcao).toLowerCase().includes(s)) && (!st||c.status===st) && (!ct||c.contrato===ct)
  );
  document.getElementById('tabelaEquipe').innerHTML = renderTabelaEquipe(f);
}

function openNovoColaborador() {
  openModalWide('Novo Colaborador', `
    <div class="form-row">
      <div class="form-group"><label>Nome Completo *</label><input class="form-control" id="nc_nome" placeholder="Nome completo"></div>
      <div class="form-group"><label>Função *</label><input class="form-control" id="nc_func" placeholder="Ex: Soldador N2, Eletricista..."></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Contrato *</label>
        <select class="form-control" id="nc_ctr">
          ${ERP_DATA.contratos.filter(c=>c.status==='Ativo'||c.status==='Mobilização').map(c=>`<option value="${c.id}">${c.id} – ${c.cliente}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label>Turno</label>
        <select class="form-control" id="nc_turno"><option>Diurno</option><option>Noturno</option><option>12x36</option></select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Status</label>
        <select class="form-control" id="nc_status"><option>Ativo</option><option>Mobilizando</option><option>Inativo</option></select>
      </div>
      <div class="form-group"><label>ASO (validade)</label><input class="form-control" id="nc_aso" type="date"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>NR-10</label>
        <select class="form-control" id="nc_nr10"><option>Válido</option><option>Vencendo</option><option>Vencido</option><option>N/A</option></select>
      </div>
      <div class="form-group"><label>NR-35</label>
        <select class="form-control" id="nc_nr35"><option>Válido</option><option>Vencendo</option><option>Vencido</option><option>N/A</option></select>
      </div>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="salvarNovoColaborador()"><i class="fas fa-save"></i> Cadastrar</button>
  `);
}

function salvarNovoColaborador() {
  const nome = document.getElementById('nc_nome').value.trim();
  const func = document.getElementById('nc_func').value.trim();
  if (!nome || !func) { showToast('Preencha nome e função', 'warning'); return; }
  const asoVal = document.getElementById('nc_aso').value;
  const asoFmt = asoVal ? new Date(asoVal+'T12:00:00').toLocaleDateString('pt-BR') : '—';
  const nr10 = document.getElementById('nc_nr10').value;
  const nr35 = document.getElementById('nc_nr35').value;
  let docs = 'OK';
  if (nr10 === 'Vencido' || nr35 === 'Vencido') docs = 'Crítico';
  else if (nr10 === 'Vencendo' || nr35 === 'Vencendo') docs = 'Atenção';

  const lista = _getEquipeData();
  lista.push({
    id: gerarId('COL'),
    nome, funcao: func,
    contrato: document.getElementById('nc_ctr').value,
    turno: document.getElementById('nc_turno').value,
    status: document.getElementById('nc_status').value,
    aso: asoFmt, nr10, nr35, docs
  });
  _saveColaboradores(lista);
  closeModal();
  showToast('Colaborador cadastrado!', 'success');
  renderEquipe();
}

function editarColaborador(id) {
  const lista = _getEquipeData();
  const c = lista.find(x => x.id === id);
  if (!c) return;
  openModalWide(`Editar Colaborador – ${c.nome}`, `
    <div class="form-row">
      <div class="form-group"><label>Nome</label><input class="form-control" id="ec_nome" value="${c.nome}"></div>
      <div class="form-group"><label>Função</label><input class="form-control" id="ec_func" value="${c.funcao}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Contrato</label>
        <select class="form-control" id="ec_ctr">
          ${ERP_DATA.contratos.filter(ct=>ct.status==='Ativo'||ct.status==='Mobilização').map(ct=>`<option value="${ct.id}" ${c.contrato===ct.id?'selected':''}>${ct.id} – ${ct.cliente}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label>Turno</label>
        <select class="form-control" id="ec_turno">
          ${['Diurno','Noturno','12x36'].map(t=>`<option ${c.turno===t?'selected':''}>${t}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Status</label>
        <select class="form-control" id="ec_status">
          ${['Ativo','Mobilizando','Bloqueado','Inativo'].map(s=>`<option ${c.status===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label>ASO (validade)</label><input class="form-control" id="ec_aso" type="text" value="${c.aso||'—'}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>NR-10</label>
        <select class="form-control" id="ec_nr10">${['Válido','Vencendo','Vencido','N/A'].map(v=>`<option ${c.nr10===v?'selected':''}>${v}</option>`).join('')}</select>
      </div>
      <div class="form-group"><label>NR-35</label>
        <select class="form-control" id="ec_nr35">${['Válido','Vencendo','Vencido','N/A'].map(v=>`<option ${c.nr35===v?'selected':''}>${v}</option>`).join('')}</select>
      </div>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-danger" onclick="excluirColaborador('${id}');closeModal()"><i class="fas fa-trash"></i> Excluir</button>
    <button class="btn btn-primary" onclick="salvarEdicaoColaborador('${id}')"><i class="fas fa-save"></i> Salvar</button>
  `);
}

function salvarEdicaoColaborador(id) {
  const lista = _getEquipeData();
  const idx = lista.findIndex(x=>x.id===id);
  if (idx<0) return;
  const nr10 = document.getElementById('ec_nr10').value;
  const nr35 = document.getElementById('ec_nr35').value;
  let docs = 'OK';
  if (nr10==='Vencido'||nr35==='Vencido') docs = 'Crítico';
  else if (nr10==='Vencendo'||nr35==='Vencendo') docs = 'Atenção';
  lista[idx] = { ...lista[idx],
    nome: document.getElementById('ec_nome').value.trim(),
    funcao: document.getElementById('ec_func').value.trim(),
    contrato: document.getElementById('ec_ctr').value,
    turno: document.getElementById('ec_turno').value,
    status: document.getElementById('ec_status').value,
    aso: document.getElementById('ec_aso').value.trim(),
    nr10, nr35, docs
  };
  _saveColaboradores(lista);
  closeModal();
  showToast('Colaborador atualizado!', 'success');
  renderEquipe();
}

function alterarStatusColab(id, novoStatus) {
  const lista = _getEquipeData();
  const idx = lista.findIndex(x=>x.id===id);
  if (idx<0) return;
  lista[idx].status = novoStatus;
  _saveColaboradores(lista);
  showToast(`Status alterado para ${novoStatus}`, 'info');
  renderEquipe();
}

function excluirColaborador(id) {
  const lista = _getEquipeData().filter(x=>x.id!==id);
  _saveColaboradores(lista);
  showToast('Colaborador removido.', 'warning');
  renderEquipe();
}

function exportarEquipe() {
  const lista = _getEquipeData();
  const csv = [['ID','Nome','Função','Contrato','Turno','Status','ASO','NR-10','NR-35','Docs'],
    ...lista.map(c=>[c.id,c.nome,c.funcao,c.contrato,c.turno,c.status,c.aso,c.nr10,c.nr35,c.docs])
  ].map(r=>r.map(c=>`"${c}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));
  a.download = `Equipe_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  showToast('Equipe exportada!', 'success');
}

// ─── MÓDULO FROTA (SOBRESCREVE renderFrota) ──────────────────────────────────
function renderFrota() {
  if (!hasPermission('frota', 'view')) { renderAcessoNegado(); return; }
  const equipamentos = _getEquipData();
  const main = document.getElementById('mainContent');

  const opCount = equipamentos.filter(e=>e.status==='Operacional').length;
  const maintCount = equipamentos.filter(e=>e.status==='Em Manutenção').length;

  main.innerHTML = `
    <div class="page-header">
      <div class="page-title">
        <h2><i class="fas fa-truck" style="color:var(--orange);margin-right:8px"></i>Frota e Equipamentos</h2>
        <p>${equipamentos.length} ativos · ${opCount} operacionais</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary btn-sm" onclick="exportarFrota()"><i class="fas fa-file-excel"></i> Exportar</button>
        ${hasPermission('frota','create') ? `<button class="btn btn-primary btn-sm" onclick="openNovoEquipamento()"><i class="fas fa-plus"></i> Novo Equipamento</button>` : ''}
      </div>
    </div>

    <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr)">
      <div class="kpi-card kpi-blue"><div class="kpi-icon"><i class="fas fa-truck"></i></div><div class="kpi-value">${equipamentos.length}</div><div class="kpi-label">Total de Ativos</div></div>
      <div class="kpi-card kpi-green"><div class="kpi-icon"><i class="fas fa-check-circle"></i></div><div class="kpi-value">${opCount}</div><div class="kpi-label">Operacionais</div></div>
      <div class="kpi-card kpi-yellow"><div class="kpi-icon"><i class="fas fa-wrench"></i></div><div class="kpi-value">${maintCount}</div><div class="kpi-label">Em Manutenção</div></div>
      <div class="kpi-card kpi-orange"><div class="kpi-icon"><i class="fas fa-tachometer-alt"></i></div><div class="kpi-value">${opCount > 0 ? Math.round(opCount/equipamentos.length*100) : 0}%</div><div class="kpi-label">Disponibilidade</div></div>
    </div>

    <div class="card page-section">
      <div class="search-bar">
        <div class="search-input-wrapper">
          <i class="fas fa-search"></i>
          <input class="search-input" id="searchFrota" type="text" placeholder="Buscar equipamento..." oninput="filterFrota()">
        </div>
        <select class="filter-select" id="filterFrotaStatus" onchange="filterFrota()">
          <option value="">Todos os Status</option>
          <option>Operacional</option><option>Em Manutenção</option><option>Disponível</option><option>Inativo</option>
        </select>
      </div>
      <div id="tabelaFrota">${renderTabelaFrota(equipamentos)}</div>
    </div>
  `;
}

function renderTabelaFrota(lista) {
  if (!lista.length) return `<div class="empty-state" style="padding:40px"><p>Nenhum equipamento encontrado</p></div>`;
  return `
    <div class="table-wrapper">
      <table>
        <thead><tr><th>ID</th><th>Descrição</th><th>Placa/Serial</th><th>Contrato</th><th>KM/Horas</th><th>Próx. Manutenção</th><th>Status</th><th>Ações</th></tr></thead>
        <tbody>
          ${lista.map(e => `
            <tr>
              <td style="color:var(--orange);font-weight:600;font-size:12px">${e.id}</td>
              <td style="font-weight:500">${e.descricao}</td>
              <td style="font-size:12px;color:var(--text-secondary)">${e.placa||'—'}</td>
              <td style="font-size:11px;color:var(--text-muted)">${e.contrato}</td>
              <td style="font-size:12px">${e.km ? e.km.toLocaleString('pt-BR') + ' km' : '—'}</td>
              <td style="font-size:12px;color:${e.status==='Em Manutenção'?'var(--yellow-light)':'var(--text-secondary)'}">${e.proxMaint||'—'}</td>
              <td>${statusBadge(e.status)}</td>
              <td>
                <div class="actions-cell">
                  ${hasPermission('frota','edit') ? `<button class="btn btn-info btn-sm btn-icon" onclick="editarEquipamento('${e.id}')" title="Editar"><i class="fas fa-edit"></i></button>` : ''}
                  <button class="btn btn-warning btn-sm btn-icon" onclick="registrarManutencao('${e.id}')" title="Registrar Manutenção"><i class="fas fa-wrench"></i></button>
                  ${hasPermission('frota','delete') ? `<button class="btn btn-danger btn-sm btn-icon" onclick="excluirEquipamento('${e.id}')" title="Excluir"><i class="fas fa-trash"></i></button>` : ''}
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function filterFrota() {
  const s = (document.getElementById('searchFrota')?.value||'').toLowerCase();
  const st = document.getElementById('filterFrotaStatus')?.value||'';
  const f = _getEquipData().filter(e => (!s||(e.descricao+e.placa||'').toLowerCase().includes(s))&&(!st||e.status===st));
  document.getElementById('tabelaFrota').innerHTML = renderTabelaFrota(f);
}

function openNovoEquipamento() {
  openModalWide('Novo Equipamento', `
    <div class="form-row">
      <div class="form-group"><label>Descrição *</label><input class="form-control" id="ne_desc" placeholder="Ex: Caminhão Munck 25T"></div>
      <div class="form-group"><label>Placa/Serial</label><input class="form-control" id="ne_placa" placeholder="Ex: ABC-1234 ou N/A"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Contrato</label>
        <select class="form-control" id="ne_ctr">
          ${ERP_DATA.contratos.filter(c=>c.status==='Ativo'||c.status==='Mobilização').map(c=>`<option value="${c.id}">${c.id} – ${c.cliente}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label>Status</label>
        <select class="form-control" id="ne_status">
          <option>Operacional</option><option>Em Manutenção</option><option>Disponível</option><option>Inativo</option>
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>KM/Horas</label><input class="form-control" id="ne_km" type="number" min="0" placeholder="0"></div>
      <div class="form-group"><label>Próx. Manutenção</label><input class="form-control" id="ne_maint" type="date"></div>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="salvarNovoEquipamento()"><i class="fas fa-save"></i> Cadastrar</button>
  `);
}

function salvarNovoEquipamento() {
  const desc = document.getElementById('ne_desc').value.trim();
  if (!desc) { showToast('Informe a descrição', 'warning'); return; }
  const maintVal = document.getElementById('ne_maint').value;
  const lista = _getEquipData();
  lista.push({
    id: gerarId('EQ'),
    descricao: desc,
    placa: document.getElementById('ne_placa').value.trim() || 'N/A',
    contrato: document.getElementById('ne_ctr').value,
    status: document.getElementById('ne_status').value,
    km: parseInt(document.getElementById('ne_km').value) || null,
    proxMaint: maintVal ? new Date(maintVal+'T12:00:00').toLocaleDateString('pt-BR') : '—'
  });
  _saveEquipamentos(lista);
  closeModal();
  showToast('Equipamento cadastrado!', 'success');
  renderFrota();
}

function editarEquipamento(id) {
  const lista = _getEquipData();
  const e = lista.find(x=>x.id===id);
  if (!e) return;
  openModalWide(`Editar Equipamento – ${e.id}`, `
    <div class="form-row">
      <div class="form-group"><label>Descrição</label><input class="form-control" id="ee_desc" value="${e.descricao}"></div>
      <div class="form-group"><label>Placa/Serial</label><input class="form-control" id="ee_placa" value="${e.placa||''}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Contrato</label>
        <select class="form-control" id="ee_ctr">
          ${ERP_DATA.contratos.filter(c=>c.status==='Ativo'||c.status==='Mobilização').map(c=>`<option value="${c.id}" ${e.contrato===c.id?'selected':''}>${c.id} – ${c.cliente}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label>Status</label>
        <select class="form-control" id="ee_status">
          ${['Operacional','Em Manutenção','Disponível','Inativo'].map(s=>`<option ${e.status===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>KM/Horas</label><input class="form-control" id="ee_km" type="number" value="${e.km||0}"></div>
      <div class="form-group"><label>Próx. Manutenção</label><input class="form-control" id="ee_maint" type="text" value="${e.proxMaint||'—'}"></div>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-danger" onclick="excluirEquipamento('${id}');closeModal()"><i class="fas fa-trash"></i> Excluir</button>
    <button class="btn btn-primary" onclick="salvarEdicaoEquipamento('${id}')"><i class="fas fa-save"></i> Salvar</button>
  `);
}

function salvarEdicaoEquipamento(id) {
  const lista = _getEquipData();
  const idx = lista.findIndex(x=>x.id===id);
  if (idx<0) return;
  lista[idx] = { ...lista[idx],
    descricao: document.getElementById('ee_desc').value.trim(),
    placa: document.getElementById('ee_placa').value.trim(),
    contrato: document.getElementById('ee_ctr').value,
    status: document.getElementById('ee_status').value,
    km: parseInt(document.getElementById('ee_km').value)||null,
    proxMaint: document.getElementById('ee_maint').value.trim()
  };
  _saveEquipamentos(lista);
  closeModal();
  showToast('Equipamento atualizado!', 'success');
  renderFrota();
}

function excluirEquipamento(id) {
  const lista = _getEquipData().filter(x=>x.id!==id);
  _saveEquipamentos(lista);
  showToast('Equipamento removido.', 'warning');
  renderFrota();
}

function registrarManutencao(id) {
  const e = _getEquipData().find(x=>x.id===id);
  if (!e) return;
  openModal(`Registrar Manutenção – ${e.descricao}`, `
    <div class="form-group"><label>Tipo de Manutenção</label>
      <select class="form-control" id="rm_tipo"><option>Preventiva</option><option>Corretiva</option><option>Inspeção</option></select>
    </div>
    <div class="form-group"><label>Descrição</label><textarea class="form-control" id="rm_desc" rows="2" placeholder="Descreva a manutenção realizada"></textarea></div>
    <div class="form-row">
      <div class="form-group"><label>Data</label><input class="form-control" id="rm_data" type="date" value="${new Date().toISOString().split('T')[0]}"></div>
      <div class="form-group"><label>Próxima Manutenção</label><input class="form-control" id="rm_prox" type="date"></div>
    </div>
    <div class="form-group"><label>KM/Horas Atual</label><input class="form-control" id="rm_km" type="number" value="${e.km||0}"></div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="salvarManutencao('${id}')"><i class="fas fa-save"></i> Registrar</button>
  `);
}

function salvarManutencao(id) {
  const lista = _getEquipData();
  const idx = lista.findIndex(x=>x.id===id);
  if (idx<0) return;
  const proxVal = document.getElementById('rm_prox').value;
  lista[idx].status = 'Operacional';
  lista[idx].km = parseInt(document.getElementById('rm_km').value)||lista[idx].km;
  lista[idx].proxMaint = proxVal ? new Date(proxVal+'T12:00:00').toLocaleDateString('pt-BR') : lista[idx].proxMaint;
  _saveEquipamentos(lista);
  logAction('Manutenção', 'Frota', `Manutenção registrada: ${id} – ${document.getElementById('rm_tipo').value}`);
  closeModal();
  showToast('Manutenção registrada!', 'success');
  renderFrota();
}

function exportarFrota() {
  const lista = _getEquipData();
  const csv = [['ID','Descrição','Placa','Contrato','KM','Próx. Manutenção','Status'],
    ...lista.map(e=>[e.id,e.descricao,e.placa,e.contrato,e.km||'—',e.proxMaint||'—',e.status])
  ].map(r=>r.map(c=>`"${c}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));
  a.download = `Frota_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  showToast('Frota exportada!', 'success');
}

// ─── MÓDULO SSMA (SOBRESCREVE renderSSMA) ──────────────────────────────────
function renderSSMA() {
  if (!hasPermission('ssma', 'view')) { renderAcessoNegado(); return; }
  const incidentes = _getIncData();
  const colab = _getEquipeData();
  const main = document.getElementById('mainContent');

  const criticos = colab.filter(c=>c.docs==='Crítico').length;
  const atencao = colab.filter(c=>c.docs==='Atenção').length;
  const ok = colab.filter(c=>c.docs==='OK').length;
  const bloqueados = colab.filter(c=>c.status==='Bloqueado').length;

  main.innerHTML = `
    <div class="page-header">
      <div class="page-title">
        <h2><i class="fas fa-hard-hat" style="color:var(--orange);margin-right:8px"></i>SSMA – Saúde, Segurança e Meio Ambiente</h2>
        <p>Conformidade, incidentes e gestão de riscos</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary btn-sm" onclick="exportarSSMA()"><i class="fas fa-file-excel"></i> Relatório</button>
        ${hasPermission('ssma','create') ? `<button class="btn btn-danger btn-sm" onclick="openRegistrarIncidente()"><i class="fas fa-exclamation-triangle"></i> Registrar Incidente</button>` : ''}
      </div>
    </div>

    <div class="kpi-grid" style="grid-template-columns:repeat(5,1fr)">
      <div class="kpi-card ${criticos>0?'kpi-red':'kpi-green'}"><div class="kpi-icon"><i class="fas fa-times-circle"></i></div><div class="kpi-value">${criticos}</div><div class="kpi-label">Docs. Vencidos</div></div>
      <div class="kpi-card ${atencao>0?'kpi-yellow':'kpi-green'}"><div class="kpi-icon"><i class="fas fa-exclamation-circle"></i></div><div class="kpi-value">${atencao}</div><div class="kpi-label">Docs. a Vencer</div></div>
      <div class="kpi-card kpi-green"><div class="kpi-icon"><i class="fas fa-check-circle"></i></div><div class="kpi-value">${ok}</div><div class="kpi-label">Conformes</div></div>
      <div class="kpi-card ${bloqueados>0?'kpi-red':'kpi-green'}"><div class="kpi-icon"><i class="fas fa-user-slash"></i></div><div class="kpi-value">${bloqueados}</div><div class="kpi-label">Bloqueados</div></div>
      <div class="kpi-card kpi-orange"><div class="kpi-icon"><i class="fas fa-file-alt"></i></div><div class="kpi-value">${incidentes.length}</div><div class="kpi-label">Incidentes Registrados</div></div>
    </div>

    <!-- Incidentes -->
    <div class="card">
      <div class="card-header">
        <h3><i class="fas fa-exclamation-triangle" style="color:var(--red-light);margin-right:8px"></i>Registro de Incidentes</h3>
        ${hasPermission('ssma','create') ? `<button class="btn btn-danger btn-sm" onclick="openRegistrarIncidente()"><i class="fas fa-plus"></i> Novo Incidente</button>` : ''}
      </div>
      <div id="tabelaIncidentes">${renderTabelaIncidentes(incidentes)}</div>
    </div>

    <!-- Status documentação -->
    <div class="card page-section">
      <div class="card-header">
        <h3><i class="fas fa-id-card" style="color:var(--blue-light);margin-right:8px"></i>Status de Documentação da Equipe</h3>
      </div>
      <div class="table-wrapper" style="max-height:300px;overflow-y:auto">
        <table>
          <thead><tr><th>Nome</th><th>Função</th><th>Contrato</th><th>ASO</th><th>NR-10</th><th>NR-35</th><th>Status Doc</th></tr></thead>
          <tbody>
            ${colab.filter(c=>c.docs!=='OK').map(c=>`
              <tr>
                <td style="font-weight:500">${c.nome}</td>
                <td style="font-size:12px">${c.funcao}</td>
                <td style="font-size:11px;color:var(--text-muted)">${c.contrato}</td>
                <td style="font-size:12px;color:${_docColor(c.aso)}">${c.aso}</td>
                <td>${statusBadge(c.nr10)}</td>
                <td>${statusBadge(c.nr35)}</td>
                <td>${statusBadge(c.docs)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderTabelaIncidentes(lista) {
  if (!lista.length) return `<div class="empty-state" style="padding:40px"><p>Nenhum incidente registrado</p></div>`;
  return `
    <div class="table-wrapper">
      <table>
        <thead><tr><th>ID</th><th>Tipo</th><th>Data</th><th>Contrato</th><th>Descrição</th><th>Gravidade</th><th>Status</th><th>Responsável</th><th>Ações</th></tr></thead>
        <tbody>
          ${lista.map(i => `
            <tr>
              <td style="color:var(--red-light);font-weight:700;font-size:11px">${i.id}</td>
              <td style="font-size:11px"><span class="badge badge-danger">${i.tipo}</span></td>
              <td style="font-size:12px">${i.data}</td>
              <td style="font-size:11px;color:var(--text-muted)">${i.contrato}</td>
              <td style="font-size:12px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${i.descricao}">${i.descricao}</td>
              <td>${statusBadge(i.gravidade)}</td>
              <td>${statusBadge(i.status)}</td>
              <td style="font-size:12px">${i.responsavel}</td>
              <td>
                <div class="actions-cell">
                  ${hasPermission('ssma','edit') ? `<button class="btn btn-info btn-sm btn-icon" onclick="editarIncidente('${i.id}')" title="Editar"><i class="fas fa-edit"></i></button>` : ''}
                  ${hasPermission('ssma','delete') ? `<button class="btn btn-danger btn-sm btn-icon" onclick="excluirIncidente('${i.id}')" title="Excluir"><i class="fas fa-trash"></i></button>` : ''}
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function openRegistrarIncidente() {
  openModalWide('Registrar Incidente', `
    <div class="form-row">
      <div class="form-group"><label>Tipo *</label>
        <select class="form-control" id="ri_tipo">
          <option>Quase-Acidente</option><option>Acidente sem Afastamento</option>
          <option>Acidente com Afastamento</option><option>Incidente Ambiental</option><option>Não-Conformidade</option>
        </select>
      </div>
      <div class="form-group"><label>Data *</label><input class="form-control" id="ri_data" type="date" value="${new Date().toISOString().split('T')[0]}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Contrato</label>
        <select class="form-control" id="ri_ctr">
          ${ERP_DATA.contratos.map(c=>`<option value="${c.id}">${c.id} – ${c.cliente}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label>Gravidade</label>
        <select class="form-control" id="ri_grav">
          <option>Baixa</option><option>Leve</option><option>Média</option><option>Alta</option><option>Crítica</option>
        </select>
      </div>
    </div>
    <div class="form-group"><label>Descrição do Incidente *</label><textarea class="form-control" id="ri_desc" rows="3" placeholder="Descreva o que aconteceu..."></textarea></div>
    <div class="form-row">
      <div class="form-group"><label>Responsável pela Investigação</label><input class="form-control" id="ri_resp" value="${currentUser?.name||''}"></div>
      <div class="form-group"><label>Status</label>
        <select class="form-control" id="ri_status">
          <option>Em Investigação</option><option>Plano de Ação Aberto</option><option>Concluído</option>
        </select>
      </div>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-danger" onclick="salvarIncidente()"><i class="fas fa-save"></i> Registrar</button>
  `);
}

function salvarIncidente() {
  const desc = document.getElementById('ri_desc').value.trim();
  if (!desc) { showToast('Descreva o incidente', 'warning'); return; }
  const dataVal = document.getElementById('ri_data').value;
  const lista = _getIncData();
  lista.unshift({
    id: `INC-${new Date().getFullYear()}-${String(lista.length+1).padStart(3,'0')}`,
    tipo: document.getElementById('ri_tipo').value,
    data: dataVal ? new Date(dataVal+'T12:00:00').toLocaleDateString('pt-BR') : '—',
    contrato: document.getElementById('ri_ctr').value,
    descricao: desc,
    gravidade: document.getElementById('ri_grav').value,
    status: document.getElementById('ri_status').value,
    responsavel: document.getElementById('ri_resp').value.trim(),
    criadoEm: new Date().toISOString()
  });
  _saveIncidentes(lista);
  logAction('Incidente SSMA', 'SSMA', `Incidente registrado: ${desc.substring(0,50)}`);
  closeModal();
  showToast('Incidente registrado!', 'warning');
  renderSSMA();
}

function editarIncidente(id) {
  const lista = _getIncData();
  const inc = lista.find(x=>x.id===id);
  if (!inc) return;
  openModalWide(`Editar Incidente – ${id}`, `
    <div class="form-row">
      <div class="form-group"><label>Tipo</label>
        <select class="form-control" id="ei_tipo">
          ${['Quase-Acidente','Acidente sem Afastamento','Acidente com Afastamento','Incidente Ambiental','Não-Conformidade'].map(t=>`<option ${inc.tipo===t?'selected':''}>${t}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label>Status</label>
        <select class="form-control" id="ei_status">
          ${['Em Investigação','Plano de Ação Aberto','Concluído','Concluída'].map(s=>`<option ${inc.status===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Gravidade</label>
        <select class="form-control" id="ei_grav">
          ${['Baixa','Leve','Média','Alta','Crítica'].map(g=>`<option ${inc.gravidade===g?'selected':''}>${g}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label>Responsável</label><input class="form-control" id="ei_resp" value="${inc.responsavel}"></div>
    </div>
    <div class="form-group"><label>Descrição</label><textarea class="form-control" id="ei_desc" rows="3">${inc.descricao}</textarea></div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-danger" onclick="excluirIncidente('${id}');closeModal()"><i class="fas fa-trash"></i> Excluir</button>
    <button class="btn btn-primary" onclick="salvarEdicaoIncidente('${id}')"><i class="fas fa-save"></i> Salvar</button>
  `);
}

function salvarEdicaoIncidente(id) {
  const lista = _getIncData();
  const idx = lista.findIndex(x=>x.id===id);
  if (idx<0) return;
  lista[idx] = { ...lista[idx],
    tipo: document.getElementById('ei_tipo').value,
    status: document.getElementById('ei_status').value,
    gravidade: document.getElementById('ei_grav').value,
    responsavel: document.getElementById('ei_resp').value.trim(),
    descricao: document.getElementById('ei_desc').value.trim()
  };
  _saveIncidentes(lista);
  closeModal();
  showToast('Incidente atualizado!', 'success');
  renderSSMA();
}

function excluirIncidente(id) {
  const lista = _getIncData().filter(x=>x.id!==id);
  _saveIncidentes(lista);
  showToast('Incidente removido.', 'warning');
  renderSSMA();
}

function exportarSSMA() {
  const lista = _getIncData();
  const csv = [['ID','Tipo','Data','Contrato','Descrição','Gravidade','Status','Responsável'],
    ...lista.map(i=>[i.id,i.tipo,i.data,i.contrato,i.descricao,i.gravidade,i.status,i.responsavel])
  ].map(r=>r.map(c=>`"${c}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));
  a.download = `SSMA_Incidentes_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  showToast('Relatório SSMA exportado!', 'success');
}

// ─── ALMOXARIFADO FUNCIONAL ────────────────────────────────────────────────
function renderEstoque() {
  if (!hasPermission('almoxarifado', 'view')) { renderAcessoNegado(); return; }
  const materiais = _getMateriais ? _getMateriais() : [];
  const movimentos = _getMovAlmox();
  const main = document.getElementById('mainContent');

  const valorTotal = materiais.reduce((a,m)=>(a+(m.estoque_atual||0)*(m.valor_unitario||0)),0);
  const criticos = materiais.filter(m=>m.status==='Crítico').length;
  const alerta = materiais.filter(m=>m.status==='Alerta').length;

  main.innerHTML = `
    <div class="page-header">
      <div class="page-title">
        <h2><i class="fas fa-boxes" style="color:var(--orange);margin-right:8px"></i>Almoxarifado</h2>
        <p>Controle de entrada e saída de materiais</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary btn-sm" onclick="navigate('materiais')"><i class="fas fa-cube"></i> Cadastro de Materiais</button>
        ${hasPermission('almoxarifado','create') ? `
        <button class="btn btn-success btn-sm" onclick="openMovAlmox('entrada')"><i class="fas fa-arrow-down"></i> Entrada</button>
        <button class="btn btn-danger btn-sm" onclick="openMovAlmox('saida')"><i class="fas fa-arrow-up"></i> Saída</button>` : ''}
      </div>
    </div>

    <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr)">
      <div class="kpi-card kpi-blue"><div class="kpi-icon"><i class="fas fa-boxes"></i></div><div class="kpi-value">${materiais.length}</div><div class="kpi-label">Itens Cadastrados</div></div>
      <div class="kpi-card kpi-orange"><div class="kpi-icon"><i class="fas fa-dollar-sign"></i></div><div class="kpi-value">${fmtK(valorTotal)}</div><div class="kpi-label">Valor em Estoque</div></div>
      <div class="kpi-card ${criticos>0?'kpi-red':'kpi-green'}"><div class="kpi-icon"><i class="fas fa-exclamation-circle"></i></div><div class="kpi-value">${criticos}</div><div class="kpi-label">Estoque Crítico (zero)</div></div>
      <div class="kpi-card ${alerta>0?'kpi-yellow':'kpi-green'}"><div class="kpi-icon"><i class="fas fa-exclamation-triangle"></i></div><div class="kpi-value">${alerta}</div><div class="kpi-label">Estoque em Alerta</div></div>
    </div>

    <!-- Posição atual -->
    <div class="card">
      <div class="card-header">
        <h3><i class="fas fa-list" style="color:var(--orange);margin-right:8px"></i>Posição de Estoque</h3>
        <button class="btn btn-secondary btn-sm" onclick="exportarAlmox()"><i class="fas fa-file-excel"></i> Exportar</button>
      </div>
      <div class="search-bar" style="padding:8px 16px">
        <div class="search-input-wrapper">
          <i class="fas fa-search"></i>
          <input class="search-input" id="searchAlmox" type="text" placeholder="Buscar material..." oninput="filterAlmox()">
        </div>
        <select class="filter-select" id="filterAlmoxStatus" onchange="filterAlmox()">
          <option value="">Todos</option><option>Ativo</option><option>Alerta</option><option>Crítico</option>
        </select>
      </div>
      <div id="tabelaAlmox">${renderTabelaAlmox(materiais)}</div>
    </div>

    <!-- Histórico de movimentações -->
    <div class="card page-section">
      <div class="card-header"><h3><i class="fas fa-exchange-alt" style="color:var(--fa-teal);margin-right:8px"></i>Histórico de Movimentações</h3></div>
      ${movimentos.length === 0 ? `<div class="empty-state" style="padding:40px"><p>Nenhuma movimentação registrada</p></div>` : `
      <div class="table-wrapper" style="max-height:300px;overflow-y:auto">
        <table>
          <thead><tr><th>Data</th><th>Tipo</th><th>Material</th><th>Qtd</th><th>Motivo</th><th>Usuário</th></tr></thead>
          <tbody>
            ${movimentos.slice(0,30).map(m=>`
              <tr>
                <td style="font-size:12px">${m.data}</td>
                <td><span class="badge ${m.tipo==='entrada'?'badge-success':'badge-danger'}">${m.tipo==='entrada'?'⬇ Entrada':'⬆ Saída'}</span></td>
                <td style="font-size:12px">${m.material}</td>
                <td style="text-align:center;font-weight:700;color:${m.tipo==='entrada'?'var(--green-light)':'var(--red-light)'}">${m.tipo==='entrada'?'+':'−'}${m.qtd}</td>
                <td style="font-size:12px;color:var(--text-muted)">${m.motivo||'—'}</td>
                <td style="font-size:11px">${m.usuario||'—'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>`}
    </div>
  `;
}

function renderTabelaAlmox(lista) {
  return `
    <div class="table-wrapper">
      <table>
        <thead><tr><th>Código</th><th>Descrição</th><th>Categoria</th><th>Estoque</th><th>Un</th><th>Valor Unit.</th><th>Valor Total</th><th>Status</th><th>Ações</th></tr></thead>
        <tbody>
          ${lista.map(m => `
            <tr>
              <td style="color:var(--orange);font-weight:600;font-size:12px">${m.codigo}</td>
              <td style="font-size:12px">${m.descricao}</td>
              <td><span class="badge badge-muted">${m.categoria}</span></td>
              <td style="text-align:center;font-weight:700;color:${m.status==='Crítico'?'var(--red-light)':m.status==='Alerta'?'var(--yellow-light)':'var(--green-light)'}">${m.estoque_atual}</td>
              <td style="font-size:12px;text-align:center">${m.unidade}</td>
              <td style="font-size:12px">${fmt(m.valor_unitario)}</td>
              <td style="font-weight:600">${fmt((m.estoque_atual||0)*(m.valor_unitario||0))}</td>
              <td>${statusBadge(m.status)}</td>
              <td>
                <div class="actions-cell">
                  ${hasPermission('almoxarifado','create') ? `
                  <button class="btn btn-success btn-sm btn-icon" onclick="openMovAlmoxMat('entrada','${m.id}')" title="Entrada"><i class="fas fa-arrow-down"></i></button>
                  <button class="btn btn-danger btn-sm btn-icon" onclick="openMovAlmoxMat('saida','${m.id}')" title="Saída"><i class="fas fa-arrow-up"></i></button>` : ''}
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function filterAlmox() {
  const s = (document.getElementById('searchAlmox')?.value||'').toLowerCase();
  const st = document.getElementById('filterAlmoxStatus')?.value||'';
  const f = (_getMateriais ? _getMateriais() : []).filter(m =>
    (!s||(m.codigo+m.descricao).toLowerCase().includes(s)) && (!st||m.status===st)
  );
  document.getElementById('tabelaAlmox').innerHTML = renderTabelaAlmox(f);
}

function openMovAlmox(tipo) { _openMovAlmoxModal(tipo, null); }
function openMovAlmoxMat(tipo, matId) { _openMovAlmoxModal(tipo, matId); }

function _openMovAlmoxModal(tipo, matIdPre) {
  const materiais = _getMateriais ? _getMateriais() : [];
  openModal(`${tipo==='entrada'?'⬇ Entrada':'⬆ Saída'} de Material`, `
    <div class="form-group"><label>Material *</label>
      <select class="form-control" id="mov_mat">
        ${materiais.map(m=>`<option value="${m.id}" ${m.id===matIdPre?'selected':''}>${m.codigo} – ${m.descricao} (${m.estoque_atual} ${m.unidade})</option>`).join('')}
      </select>
    </div>
    <div class="form-group"><label>Quantidade *</label><input class="form-control" id="mov_qtd" type="number" min="1" placeholder="0"></div>
    <div class="form-group"><label>Motivo / Destino</label><input class="form-control" id="mov_motivo" placeholder="${tipo==='entrada'?'Ex: número do pedido de compra':'Ex: número da OS, consumo, etc.'}"></div>
    <div class="form-group"><label>Data</label><input class="form-control" id="mov_data" type="date" value="${new Date().toISOString().split('T')[0]}"></div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-${tipo==='entrada'?'success':'danger'}" onclick="confirmarMovAlmox('${tipo}')"><i class="fas fa-${tipo==='entrada'?'arrow-down':'arrow-up'}"></i> Confirmar ${tipo==='entrada'?'Entrada':'Saída'}</button>
  `);
}

function confirmarMovAlmox(tipo) {
  const matId = document.getElementById('mov_mat').value;
  const qtd = parseInt(document.getElementById('mov_qtd').value) || 0;
  if (!matId || qtd <= 0) { showToast('Preencha material e quantidade', 'warning'); return; }

  const materiais = _getMateriais ? _getMateriais() : [];
  const idx = materiais.findIndex(m=>m.id===matId);
  if (idx < 0) return;

  if (tipo === 'saida' && materiais[idx].estoque_atual < qtd) {
    showToast('Estoque insuficiente para saída!', 'error'); return;
  }

  const novaQtd = tipo === 'entrada'
    ? materiais[idx].estoque_atual + qtd
    : materiais[idx].estoque_atual - qtd;

  materiais[idx].estoque_atual = novaQtd;
  const min = materiais[idx].estoque_min || 0;
  materiais[idx].status = novaQtd === 0 ? 'Crítico' : novaQtd < min ? 'Alerta' : 'Ativo';

  if (_saveMateriais) _saveMateriais(materiais);

  const mov = _getMovAlmox();
  const dataVal = document.getElementById('mov_data').value;
  mov.unshift({
    id: gerarId('MOV'),
    tipo,
    material: materiais[idx].codigo + ' – ' + materiais[idx].descricao,
    matId,
    qtd,
    motivo: document.getElementById('mov_motivo').value.trim(),
    data: dataVal ? new Date(dataVal+'T12:00:00').toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR'),
    usuario: currentUser?.name || 'Sistema'
  });
  _saveMovAlmox(mov);

  logAction(`${tipo==='entrada'?'Entrada':'Saída'} Almoxarifado`, 'Almoxarifado', `${tipo} de ${qtd} ${materiais[idx].unidade} de ${materiais[idx].descricao}`);
  closeModal();
  showToast(`${tipo==='entrada'?'Entrada':'Saída'} de ${qtd} ${materiais[idx].unidade} registrada!`, 'success');
  renderEstoque();
}

function exportarAlmox() {
  const lista = _getMateriais ? _getMateriais() : [];
  const csv = [['Código','Descrição','Categoria','Unidade','Estoque Atual','Estoque Min.','Valor Unit.','Valor Total','Status'],
    ...lista.map(m=>[m.codigo,m.descricao,m.categoria,m.unidade,m.estoque_atual,m.estoque_min,m.valor_unitario,(m.estoque_atual||0)*(m.valor_unitario||0),m.status])
  ].map(r=>r.map(c=>`"${c}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));
  a.download = `Almoxarifado_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  showToast('Almoxarifado exportado!', 'success');
}

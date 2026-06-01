// Fraser Alexander ERP v6.0 – Frota e Equipamentos
// Módulo totalmente editável

function _getFrota() { return _storageGet('fa_frota_v2', []); }
function _saveFrota(d) { return _storageSave('fa_frota_v2', d); }

function renderFrota() {
  if (!hasPermission('frota', 'view')) { renderAcessoNegado(); return; }
  
  // Usar dados editáveis se existirem, senão usar dados padrão
  let frota = _getFrota();
  if (!frota.length && typeof ERP_DATA !== 'undefined' && ERP_DATA.equipamentos) {
    frota = ERP_DATA.equipamentos.map(e => ({ ...e, id: e.id || gerarId('EQP') }));
    _saveFrota(frota);
  }

  const opTotal = frota.filter(f => f.status === 'Operacional').length;
  const manutTotal = frota.filter(f => f.status === 'Em Manutenção').length;
  const veiculos = frota.filter(f => f.tipo === 'Veículo' || !f.tipo || f.categoria === 'Veículo').length;
  const equips = frota.filter(f => f.tipo === 'Equipamento' || f.categoria === 'Equipamento').length;

  const canEdit = hasPermission('frota', 'edit');

  document.getElementById('mainContent').innerHTML = `
    <div class="page-header">
      <div class="page-title">
        <h2><i class="fas fa-truck" style="color:var(--fa-teal);margin-right:8px"></i>Frota e Equipamentos</h2>
        <p>${frota.length} ativos cadastrados</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary btn-sm" onclick="exportarFrota()"><i class="fas fa-download"></i> Exportar</button>
        ${canEdit ? `<button class="btn btn-primary btn-sm" onclick="novoEquipamento()"><i class="fas fa-plus"></i> Novo Ativo</button>` : ''}
      </div>
    </div>
    <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px">
      <div class="kpi-card"><div class="kpi-label">Total de Ativos</div><div class="kpi-value">${frota.length}</div></div>
      <div class="kpi-card"><div class="kpi-label">Operacional</div><div class="kpi-value" style="color:var(--green)">${opTotal}</div></div>
      <div class="kpi-card"><div class="kpi-label">Em Manutenção</div><div class="kpi-value" style="color:var(--yellow-light)">${manutTotal}</div></div>
      <div class="kpi-card"><div class="kpi-label">Veículos / Equip.</div><div class="kpi-value">${veiculos} / ${equips}</div></div>
    </div>
    <div class="card">
      <div style="padding:12px 16px;border-bottom:1px solid var(--border)">
        <input type="text" class="form-control" placeholder="Buscar ativo..." style="max-width:300px" oninput="filtrarFrota(this.value)">
      </div>
      <div style="overflow-x:auto">
        <table class="data-table">
          <thead><tr><th>Código</th><th>Descrição</th><th>Tipo</th><th>Placa/Série</th><th>Status</th><th>Manutenção</th><th>Projeto</th><th>Ações</th></tr></thead>
          <tbody id="frotaBody">${_renderFrotaRows(frota)}</tbody>
        </table>
      </div>
    </div>`;
}

function _renderFrotaRows(lista) {
  if (!lista.length) return `<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:24px">Nenhum ativo cadastrado</td></tr>`;
  const canEdit = hasPermission('frota', 'edit');
  return lista.map(f => `
    <tr>
      <td><strong style="color:var(--fa-teal)">${f.codigo || f.id}</strong></td>
      <td>
        <div style="font-weight:600">${f.descricao || f.nome}</div>
        <div style="font-size:11px;color:var(--text-muted)">${f.modelo || ''} ${f.ano ? '('+f.ano+')' : ''}</div>
      </td>
      <td style="font-size:12px">${f.tipo || f.categoria || '—'}</td>
      <td style="font-size:12px">${f.placa || f.serie || '—'}</td>
      <td>${fmtStatus(f.status)}</td>
      <td style="font-size:11px;color:var(--text-muted)">${f.proxima_manutencao ? fmtDate(f.proxima_manutencao) : '—'}</td>
      <td style="font-size:12px">${f.projeto || f.contrato || '—'}</td>
      <td>
        <div class="table-actions">
          ${canEdit ? `<button class="btn-icon edit" onclick="editarFrota('${f.id}')" title="Editar"><i class="fas fa-edit"></i></button>` : ''}
          <button class="btn-icon view" onclick="verFrota('${f.id}')" title="Detalhes"><i class="fas fa-eye"></i></button>
        </div>
      </td>
    </tr>`).join('');
}

function filtrarFrota(busca) {
  const frota = _getFrota();
  const txt = busca.toLowerCase();
  const filtrada = frota.filter(f => JSON.stringify(f).toLowerCase().includes(txt));
  const body = document.getElementById('frotaBody');
  if (body) body.innerHTML = _renderFrotaRows(filtrada);
}

function exportarFrota() {
  exportarCSV(_getFrota(), 'frota_equipamentos', [
    { key: 'codigo', label: 'Código' }, { key: 'descricao', label: 'Descrição' },
    { key: 'tipo', label: 'Tipo' }, { key: 'placa', label: 'Placa' },
    { key: 'status', label: 'Status' }, { key: 'projeto', label: 'Projeto' }
  ]);
}

function novoEquipamento() {
  openModal(modalHTML('Novo Ativo', `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="form-group"><label>Tipo *</label>
        <select class="form-control" id="frotaTipo">
          <option>Veículo</option><option>Equipamento</option><option>Ferramenta</option>
        </select>
      </div>
      <div class="form-group"><label>Descrição *</label>
        <input type="text" class="form-control" id="frotaDesc" placeholder="Ex: Caminhão Basculante" required>
      </div>
      <div class="form-group"><label>Modelo</label>
        <input type="text" class="form-control" id="frotaModelo" placeholder="Ex: Volvo FMX">
      </div>
      <div class="form-group"><label>Ano</label>
        <input type="number" class="form-control" id="frotaAno" placeholder="2024">
      </div>
      <div class="form-group"><label>Placa / Série</label>
        <input type="text" class="form-control" id="frotaPlaca" placeholder="Ex: ABC-1234">
      </div>
      <div class="form-group"><label>Status *</label>
        <select class="form-control" id="frotaStatus">
          <option>Operacional</option><option>Em Manutenção</option><option>Inativo</option><option>Em Trânsito</option>
        </select>
      </div>
      <div class="form-group"><label>Próxima Manutenção</label>
        <input type="date" class="form-control" id="frotaManut">
      </div>
      <div class="form-group"><label>Projeto/Contrato</label>
        <input type="text" class="form-control" id="frotaProjeto" placeholder="Ex: Vale – Mina Norte">
      </div>
      <div class="form-group" style="grid-column:1/-1"><label>Observações</label>
        <input type="text" class="form-control" id="frotaObs">
      </div>
    </div>`,
    `<button class="btn btn-secondary" onclick="closeModalForce()">Cancelar</button>
     <button class="btn btn-primary" onclick="salvarFrota()"><i class="fas fa-save"></i> Salvar</button>`,
    'fa-truck'));
}

function salvarFrota() {
  const desc = document.getElementById('frotaDesc')?.value;
  if (!desc) { showToast('Descrição obrigatória', 'error'); return; }
  const frota = _getFrota();
  const id = gerarId('EQP');
  frota.unshift({
    id, codigo: id,
    tipo: document.getElementById('frotaTipo')?.value,
    descricao: desc,
    modelo: document.getElementById('frotaModelo')?.value || '',
    ano: document.getElementById('frotaAno')?.value || '',
    placa: document.getElementById('frotaPlaca')?.value || '',
    status: document.getElementById('frotaStatus')?.value || 'Operacional',
    proxima_manutencao: document.getElementById('frotaManut')?.value || '',
    projeto: document.getElementById('frotaProjeto')?.value || '',
    observacoes: document.getElementById('frotaObs')?.value || '',
    criado_por: currentUser.nome,
    criado_em: new Date().toISOString()
  });
  if (_saveFrota(frota)) {
    showToast('Ativo cadastrado!', 'success');
    closeModalForce();
    renderFrota();
  }
}

function editarFrota(id) {
  const frota = _getFrota();
  const f = frota.find(x => x.id === id);
  if (!f) return;

  openModal(modalHTML(`Editar – ${f.descricao}`, `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="form-group"><label>Descrição</label>
        <input type="text" class="form-control" id="ef_desc" value="${f.descricao||''}">
      </div>
      <div class="form-group"><label>Status</label>
        <select class="form-control" id="ef_status">
          ${['Operacional','Em Manutenção','Inativo','Em Trânsito'].map(s => `<option ${f.status===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label>Placa / Série</label>
        <input type="text" class="form-control" id="ef_placa" value="${f.placa||''}">
      </div>
      <div class="form-group"><label>Próxima Manutenção</label>
        <input type="date" class="form-control" id="ef_manut" value="${f.proxima_manutencao||''}">
      </div>
      <div class="form-group"><label>Projeto</label>
        <input type="text" class="form-control" id="ef_projeto" value="${f.projeto||''}">
      </div>
      <div class="form-group"><label>Observações</label>
        <input type="text" class="form-control" id="ef_obs" value="${f.observacoes||''}">
      </div>
    </div>`,
    `<button class="btn btn-secondary" onclick="closeModalForce()">Cancelar</button>
     <button class="btn btn-primary" onclick="confirmarEditFrota('${id}')"><i class="fas fa-save"></i> Salvar</button>`,
    'fa-edit'));
}

function confirmarEditFrota(id) {
  const frota = _getFrota();
  const idx = frota.findIndex(f => f.id === id);
  if (idx === -1) return;
  frota[idx].descricao = document.getElementById('ef_desc')?.value || frota[idx].descricao;
  frota[idx].status = document.getElementById('ef_status')?.value || frota[idx].status;
  frota[idx].placa = document.getElementById('ef_placa')?.value || frota[idx].placa;
  frota[idx].proxima_manutencao = document.getElementById('ef_manut')?.value || frota[idx].proxima_manutencao;
  frota[idx].projeto = document.getElementById('ef_projeto')?.value || frota[idx].projeto;
  frota[idx].observacoes = document.getElementById('ef_obs')?.value || frota[idx].observacoes;
  frota[idx].atualizado_em = new Date().toISOString();
  if (_saveFrota(frota)) {
    showToast('Ativo atualizado!', 'success');
    closeModalForce();
    renderFrota();
  }
}

function verFrota(id) {
  const frota = _getFrota();
  const f = frota.find(x => x.id === id);
  if (!f) return;
  openModal(modalHTML(`Detalhes – ${f.descricao}`, `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:13px">
      <div><span style="color:var(--text-muted)">Tipo</span><br><strong>${f.tipo||'—'}</strong></div>
      <div><span style="color:var(--text-muted)">Status</span><br>${fmtStatus(f.status)}</div>
      <div><span style="color:var(--text-muted)">Modelo</span><br>${f.modelo||'—'} ${f.ano||''}</div>
      <div><span style="color:var(--text-muted)">Placa/Série</span><br>${f.placa||'—'}</div>
      <div><span style="color:var(--text-muted)">Próx. Manutenção</span><br>${fmtDate(f.proxima_manutencao)}</div>
      <div><span style="color:var(--text-muted)">Projeto</span><br>${f.projeto||'—'}</div>
      <div style="grid-column:1/-1"><span style="color:var(--text-muted)">Observações</span><br>${f.observacoes||'—'}</div>
    </div>`,
    `<button class="btn btn-secondary" onclick="closeModalForce()">Fechar</button>`,
    'fa-truck'));
}

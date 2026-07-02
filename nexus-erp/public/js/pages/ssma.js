// =====================================================
// Fraser Alexander ERP – Módulo SSMA v2
// Incidentes, Documentos, Treinamentos – dados reais
// =====================================================

/* ── Storage helpers ───────────────────────────────── */
function _ssGet(k, def) {
  try { const v = JSON.parse(localStorage.getItem(k)); return v ?? def; } catch { return def; }
}
function _ssSave(k, v) { localStorage.setItem(k, JSON.stringify(v)); }

function _ssGetIncidentes() {
  const a = _ssGet('fa_incidentes', null) || _ssGet('fraser_incidentes', null);
  if (a && a.length) return a;
  return JSON.parse(JSON.stringify(ERP_DATA.incidentes || []));
}
function _ssSaveIncidentes(list) { _ssSave('fa_incidentes', list); _ssSave('fraser_incidentes', list); try { window._syncSnapshot && window._syncSnapshot('ssma', list); } catch(e){} }

function _ssGetColabs() {
  const a = _ssGet('fa_colaboradores', null) || _ssGet('fraser_colaboradores', null);
  if (a && a.length) return a;
  return JSON.parse(JSON.stringify(ERP_DATA.colaboradores || []));
}
function _ssSaveColabs(list) { _ssSave('fa_colaboradores', list); _ssSave('fraser_colaboradores', list); }

function _ssGetDocs() {
  return _ssGet('fa_documentos', []);
}
function _ssSaveDocs(list) { _ssSave('fa_documentos', list); }

function _ssGetTreinamentos() {
  return _ssGet('fa_treinamentos', []);
}
function _ssSaveTreinamentos(list) { _ssSave('fa_treinamentos', list); }

function _ssGerarId(prefix) {
  return prefix + '-' + Date.now().toString(36).toUpperCase();
}

/* ── Formatadores ───────────────────────────────────── */
function _ssFmtDate(d) { if (!d) return '—'; try { return new Date(d).toLocaleDateString('pt-BR'); } catch { return d; } }
function _ssFmt(v)     { return (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 }); }
function _ssDias(d)    { if (!d) return null; return Math.round((new Date(d).getTime() - Date.now()) / 86400000); }

function _ssBadge(status) {
  const map = {
    'Aberto':        'background:rgba(239,68,68,.15);color:#ef4444',
    'Investigação':  'background:rgba(245,158,11,.15);color:#f59e0b',
    'Plano de Ação': 'background:rgba(99,102,241,.15);color:#6366f1',
    'Concluído':     'background:rgba(34,197,94,.15);color:#22c55e',
    'Alta':          'background:rgba(239,68,68,.15);color:#ef4444',
    'Média':         'background:rgba(245,158,11,.15);color:#f59e0b',
    'Baixa':         'background:rgba(34,197,94,.15);color:#22c55e',
    'Crítica':       'background:rgba(220,38,38,.2);color:#dc2626',
    'Vencido':       'background:rgba(239,68,68,.15);color:#ef4444',
    'Vigente':       'background:rgba(34,197,94,.15);color:#22c55e',
    'A Vencer':      'background:rgba(245,158,11,.15);color:#f59e0b',
  };
  const style = map[status] || 'background:rgba(100,100,100,.12);color:#8b949e';
  return `<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:6px;${style}">${status}</span>`;
}

/* ═══════════════════════════════════════════════════
   RENDERIZAÇÃO PRINCIPAL – SSMA
   ═══════════════════════════════════════════════════ */
function renderSSMA() {
  const main = document.getElementById('mainContent');
  if (!main) return;

  const incidentes   = _ssGetIncidentes();
  const colaboradores= _ssGetColabs();
  const hoje = Date.now();
  const d30  = hoje + 30 * 86400000;

  const abertos    = incidentes.filter(i => /Aberto|Investigação|Plano/i.test(i.status || ''));
  const concluidos = incidentes.filter(i => /Concluído/i.test(i.status || ''));
  const criticos   = colaboradores.filter(c => c.docs === 'Crítico').length;
  const atencao    = colaboradores.filter(c => c.docs === 'Atenção').length;
  const colabAtivos= colaboradores.filter(c => /Ativo|Mobiliz/i.test(c.status || '')).length;

  const incPorTipo = {};
  incidentes.forEach(i => { const t = i.tipo || '—'; incPorTipo[t] = (incPorTipo[t] || 0) + 1; });

  const incPorGrav = { Alta: 0, Média: 0, Baixa: 0, Crítica: 0 };
  incidentes.forEach(i => { const g = i.gravidade || 'Baixa'; incPorGrav[g] = (incPorGrav[g] || 0) + 1; });

  main.innerHTML = `
  <style>
    .ss-tabs { display:flex; gap:4px; margin-bottom:20px; flex-wrap:wrap; border-bottom:2px solid var(--border-color); padding-bottom:0; }
    .ss-tab  { padding:9px 16px; font-size:13px; font-weight:600; border:none; background:none; color:var(--text-muted); cursor:pointer; border-bottom:3px solid transparent; margin-bottom:-2px; transition:all .2s; border-radius:4px 4px 0 0; }
    .ss-tab:hover   { color:var(--text-primary); background:rgba(0,180,184,.06); }
    .ss-tab.active  { color:var(--fa-teal); border-bottom-color:var(--fa-teal); background:rgba(0,180,184,.06); }
    .ss-section     { display:none; }
    .ss-section.active { display:block; }
    .ss-kpi-grid    { display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:10px; margin-bottom:20px; }
    .ss-kpi         { background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:12px; padding:14px 16px; }
    .ss-kpi-val     { font-size:28px; font-weight:900; line-height:1; }
    .ss-kpi-lbl     { font-size:11px; color:var(--text-muted); margin-top:4px; }
    .ss-kpi-ico     { width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px;margin-bottom:8px; }
    .ss-table-wrap  { overflow-x:auto; }
    .ss-table       { width:100%; border-collapse:collapse; font-size:13px; }
    .ss-table th    { text-align:left; padding:9px 12px; font-size:11px; font-weight:700; color:var(--text-muted); border-bottom:1px solid var(--border-color); white-space:nowrap; }
    .ss-table td    { padding:9px 12px; border-bottom:1px solid var(--border-color); vertical-align:middle; }
    .ss-table tr:last-child td { border-bottom:none; }
    .ss-table tr:hover td { background:rgba(255,255,255,.03); }
    .ss-card        { background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:12px; overflow:hidden; margin-bottom:16px; }
    .ss-card-head   { display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--border-color); }
    .ss-card-title  { font-size:13px;font-weight:700;display:flex;align-items:center;gap:8px; }
    .ss-alert       { display:flex;align-items:flex-start;gap:10px;padding:10px 14px;border-radius:8px;margin-bottom:8px;border-left:4px solid; }
    .ss-alert.danger{ background:rgba(239,68,68,.08);border-color:#ef4444; }
    .ss-alert.warn  { background:rgba(245,158,11,.08);border-color:#f59e0b; }
    .ss-alert.info  { background:rgba(99,102,241,.08);border-color:#6366f1; }
    .ss-nr-grid     { display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;margin-bottom:16px; }
    .ss-nr-card     { background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:10px;padding:14px 16px; }
    .ss-nr-header   { display:flex;align-items:center;gap:8px;margin-bottom:10px; }
    .ss-nr-badge    { font-size:11px;font-weight:800;padding:3px 9px;border-radius:6px; }
    .ss-nr-bar      { height:6px;background:var(--border-color);border-radius:3px;overflow:hidden;margin:8px 0; }
    .ss-nr-fill     { height:100%;border-radius:3px;transition:width 1s; }
    .ss-nr-stats    { display:flex;gap:12px;font-size:11px; }
    .ss-charts      { display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px;margin-bottom:16px; }
    .ss-chart-card  { background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:12px;padding:14px; }
    .ss-chart-title { font-size:12px;font-weight:700;margin-bottom:10px;display:flex;align-items:center;gap:6px; }
    @media(max-width:600px){
      .ss-kpi-grid { grid-template-columns:repeat(2,1fr); }
      .ss-nr-grid  { grid-template-columns:1fr; }
      .ss-charts   { grid-template-columns:1fr; }
    }
  </style>

  <div class="page-header">
    <div class="page-title">
      <h2><i class="fas fa-hard-hat" style="color:var(--fa-teal);margin-right:8px"></i>SSMA – Saúde, Segurança e Meio Ambiente</h2>
      <p>Incidentes, documentos, treinamentos e conformidade · ISO 45001</p>
    </div>
    <div class="page-actions" style="flex-wrap:wrap;gap:6px">
      <button class="btn btn-danger btn-sm" onclick="ssOpenNovoIncidente()">
        <i class="fas fa-exclamation-triangle"></i> Registrar Incidente
      </button>
      <button class="btn btn-secondary btn-sm" onclick="ssExportarRelatorio()">
        <i class="fas fa-download"></i> Relatório PDF
      </button>
    </div>
  </div>

  <!-- KPIs Gerais -->
  <div class="ss-kpi-grid">
    <div class="ss-kpi" style="border-left:4px solid ${abertos.length > 0 ? '#ef4444' : '#22c55e'}">
      <div class="ss-kpi-ico" style="background:${abertos.length > 0 ? 'rgba(239,68,68,.12)' : 'rgba(34,197,94,.12)'};color:${abertos.length > 0 ? '#ef4444' : '#22c55e'}">
        <i class="fas fa-hard-hat"></i>
      </div>
      <div class="ss-kpi-val" style="color:${abertos.length > 0 ? '#ef4444' : '#22c55e'}">${abertos.length}</div>
      <div class="ss-kpi-lbl">Incidentes em Aberto</div>
    </div>
    <div class="ss-kpi" style="border-left:4px solid #22c55e">
      <div class="ss-kpi-ico" style="background:rgba(34,197,94,.12);color:#22c55e"><i class="fas fa-check-circle"></i></div>
      <div class="ss-kpi-val" style="color:#22c55e">${concluidos.length}</div>
      <div class="ss-kpi-lbl">Incidentes Concluídos</div>
    </div>
    <div class="ss-kpi" style="border-left:4px solid ${criticos > 0 ? '#ef4444' : '#f59e0b'}">
      <div class="ss-kpi-ico" style="background:rgba(239,68,68,.12);color:#ef4444"><i class="fas fa-id-card"></i></div>
      <div class="ss-kpi-val" style="color:#ef4444">${criticos}</div>
      <div class="ss-kpi-lbl">Docs. Críticos</div>
    </div>
    <div class="ss-kpi" style="border-left:4px solid #f59e0b">
      <div class="ss-kpi-ico" style="background:rgba(245,158,11,.12);color:#f59e0b"><i class="fas fa-exclamation-circle"></i></div>
      <div class="ss-kpi-val" style="color:#f59e0b">${atencao}</div>
      <div class="ss-kpi-lbl">Docs. em Atenção</div>
    </div>
    <div class="ss-kpi" style="border-left:4px solid #0ea5e9">
      <div class="ss-kpi-ico" style="background:rgba(14,165,233,.12);color:#0ea5e9"><i class="fas fa-users"></i></div>
      <div class="ss-kpi-val" style="color:#0ea5e9">${colabAtivos}</div>
      <div class="ss-kpi-lbl">Colaboradores Ativos</div>
    </div>
    <div class="ss-kpi" style="border-left:4px solid #6366f1">
      <div class="ss-kpi-ico" style="background:rgba(99,102,241,.12);color:#6366f1"><i class="fas fa-list-alt"></i></div>
      <div class="ss-kpi-val" style="color:#6366f1">${incidentes.length}</div>
      <div class="ss-kpi-lbl">Total Incidentes</div>
    </div>
  </div>

  <!-- Alertas críticos -->
  ${abertos.length > 0 ? `
  <div class="ss-alert danger" style="margin-bottom:16px">
    <i class="fas fa-exclamation-triangle" style="color:#ef4444;margin-top:2px;flex-shrink:0"></i>
    <div>
      <div style="font-weight:700;color:#ef4444;margin-bottom:3px">⚠ ${abertos.length} incidente(s) com plano de ação em aberto</div>
      <div style="font-size:12px;color:var(--text-secondary)">
        A ISO 45001:2018 §10.2 exige ação corretiva com responsável, prazo e evidência de eficácia para todos os incidentes.
        Acidentes com afastamento devem ter CAT emitida em até 1 dia útil (Lei 8.213/91).
      </div>
    </div>
  </div>` : ''}
  ${criticos > 0 ? `
  <div class="ss-alert warn" style="margin-bottom:16px">
    <i class="fas fa-id-card" style="color:#f59e0b;margin-top:2px;flex-shrink:0"></i>
    <div>
      <div style="font-weight:700;color:#f59e0b;margin-bottom:3px">${criticos} colaborador(es) com documentação crítica</div>
      <div style="font-size:12px;color:var(--text-secondary)">
        Colaboradores com ASO, NR-35, NR-10 ou PPRA vencidos não podem exercer atividades de risco (NR-1 §1.7 · NR-7).
      </div>
    </div>
  </div>` : ''}

  <!-- Abas -->
  <div class="ss-tabs">
    <button class="ss-tab active" onclick="ssMudarAba('incidentes',this)">
      <i class="fas fa-hard-hat" style="margin-right:6px"></i>Incidentes
      ${abertos.length > 0 ? `<span style="background:#ef4444;color:#fff;font-size:9px;border-radius:8px;padding:1px 6px;margin-left:4px">${abertos.length}</span>` : ''}
    </button>
    <button class="ss-tab" onclick="ssMudarAba('inspecoes',this)">
      <i class="fas fa-clipboard-check" style="margin-right:6px"></i>Inspeções
    </button>
    <button class="ss-tab" onclick="ssMudarAba('causa_raiz',this)">
      <i class="fas fa-search" style="margin-right:6px"></i>Causa Raiz
    </button>
    <button class="ss-tab" onclick="ssMudarAba('documentos',this)">
      <i class="fas fa-folder-open" style="margin-right:6px"></i>Documentos
      ${criticos > 0 ? `<span style="background:#f59e0b;color:#fff;font-size:9px;border-radius:8px;padding:1px 6px;margin-left:4px">${criticos + atencao}</span>` : ''}
    </button>
    <button class="ss-tab" onclick="ssMudarAba('treinamentos',this)">
      <i class="fas fa-graduation-cap" style="margin-right:6px"></i>Treinamentos
    </button>
    <button class="ss-tab" onclick="ssMudarAba('graficos',this)">
      <i class="fas fa-chart-bar" style="margin-right:6px"></i>Análises
    </button>
  </div>

  <!-- Seção: Incidentes -->
  <div id="ss-incidentes" class="ss-section active">
    <!-- Barra de pesquisa rápida -->
    <div class="search-bar" style="margin-bottom:14px;border-radius:var(--radius);border:1.5px solid var(--border);background:var(--bg-secondary)">
      <div class="search-input-wrapper" style="flex:1">
        <i class="fas fa-search"></i>
        <input type="text" class="search-input" id="ss-busca-inc"
          placeholder="Buscar incidente por ID, tipo, local, descrição, responsável…"
          oninput="ssFiltrarIncidentes(this.value)" autocomplete="off">
      </div>
      <select class="filter-select" id="ss-status-inc" onchange="ssFiltrarIncidentesStatus(this.value)">
        <option value="">Todos os Status</option>
        <option value="Aberto">Abertos</option>
        <option value="Investigação">Em Investigação</option>
        <option value="Plano">Com Plano de Ação</option>
        <option value="Concluído">Concluídos</option>
      </select>
      <select class="filter-select" id="ss-grav-inc" onchange="_ssFiltrarGravidade(this.value)">
        <option value="">Todas as Gravidades</option>
        <option value="Crítica">Crítica</option>
        <option value="Alta">Alta</option>
        <option value="Média">Média</option>
        <option value="Baixa">Baixa</option>
      </select>
      <button class="btn btn-outline-primary btn-sm" onclick="ssmaAbrirCausaRaiz('',null)">
        <i class="fas fa-search"></i> Causa Raiz
      </button>
    </div>
    <div class="ss-card">
      <div class="ss-card-head">
        <div class="ss-card-title"><i class="fas fa-hard-hat" style="color:#ef4444"></i>Registro de Incidentes</div>
      </div>
      <div class="ss-table-wrap">
        <table class="ss-table" id="tbl-incidentes">
          <thead>
            <tr>
              <th>ID</th><th>Tipo</th><th>Data</th><th>Contrato</th><th>Descrição</th>
              <th>Gravidade</th><th>Status</th><th>Responsável</th><th>Ações</th>
            </tr>
          </thead>
          <tbody id="tbody-incidentes">
            ${_ssTblIncidentesRows(_ssGetIncidentes())}
          </tbody>
        </table>
        ${_ssGetIncidentes().length === 0 ? `<div style="text-align:center;padding:32px;color:var(--text-muted)"><i class="fas fa-check-circle" style="font-size:28px;color:#22c55e;display:block;margin-bottom:8px"></i>Nenhum incidente registrado</div>` : ''}
      </div>
    </div>
  </div>

  <!-- Seção: Inspeções -->
  <div id="ss-inspecoes" class="ss-section">
    ${_ssRenderInspecoesHtml()}
  </div>

  <!-- Seção: Causa Raiz -->
  <div id="ss-causa_raiz" class="ss-section">
    ${_ssRenderCausaRaizHtml()}
  </div>

  <!-- Seção: Documentos -->
  <div id="ss-documentos" class="ss-section">
    ${_ssRenderDocumentosHtml()}
  </div>

  <!-- Seção: Treinamentos -->
  <div id="ss-treinamentos" class="ss-section">
    ${_ssRenderTreinamentosHtml()}
  </div>

  <!-- Seção: Gráficos/Análises -->
  <div id="ss-graficos" class="ss-section">
    <div class="ss-charts">
      <div class="ss-chart-card">
        <div class="ss-chart-title"><i class="fas fa-chart-pie" style="color:#ef4444"></i>Incidentes por Tipo</div>
        <div style="height:200px"><canvas id="ss-chart-tipo"></canvas></div>
      </div>
      <div class="ss-chart-card">
        <div class="ss-chart-title"><i class="fas fa-chart-bar" style="color:#f59e0b"></i>Incidentes por Gravidade</div>
        <div style="height:200px"><canvas id="ss-chart-grav"></canvas></div>
      </div>
      <div class="ss-chart-card">
        <div class="ss-chart-title"><i class="fas fa-chart-line" style="color:#6366f1"></i>Evolução Mensal</div>
        <div style="height:200px"><canvas id="ss-chart-mes"></canvas></div>
      </div>
      <div class="ss-chart-card">
        <div class="ss-chart-title"><i class="fas fa-users" style="color:#0ea5e9"></i>Colaboradores por Situação Doc.</div>
        <div style="height:200px"><canvas id="ss-chart-docs"></canvas></div>
      </div>
    </div>
  </div>
  `;

  // Carrega Chart.js e renderiza gráficos quando clicar na aba
  window._ssIncidentesData = _ssGetIncidentes();
}

/* ── Tabela de Incidentes ──────────────────────────── */
function _ssTblIncidentesRows(list) {
  if (!list.length) return `<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--text-muted)">Nenhum incidente encontrado</td></tr>`;
  return list.map(i => `
    <tr id="inc-row-${i.id}">
      <td><strong style="color:var(--fa-teal);font-size:12px">${i.id}</strong></td>
      <td style="font-size:12px">${i.tipo || '—'}</td>
      <td style="font-size:12px;white-space:nowrap">${_ssFmtDate(i.data)}</td>
      <td style="font-size:12px">${i.contrato || '—'}</td>
      <td style="max-width:180px">
        <div style="font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:180px" title="${(i.descricao||'').replace(/"/g,'&quot;')}">${(i.descricao || '').slice(0, 60)}${(i.descricao || '').length > 60 ? '…' : ''}</div>
        ${i.responsavel ? `<div style="font-size:10px;color:var(--text-muted)">${i.responsavel}</div>` : ''}
      </td>
      <td>${_ssBadge(i.gravidade || 'Baixa')}</td>
      <td>${_ssBadge(i.status || 'Aberto')}</td>
      <td style="font-size:12px">${i.responsavel || '—'}</td>
      <td>
        <div style="display:flex;gap:4px">
          <button class="btn-icon view" onclick="ssVerIncidente('${i.id}')" title="Ver detalhes"><i class="fas fa-eye"></i></button>
          <button class="btn-icon edit" onclick="ssEditarIncidente('${i.id}')" title="Editar"><i class="fas fa-edit"></i></button>
          ${!/Concluído/i.test(i.status || '') ? `<button class="btn-icon" style="background:rgba(34,197,94,.1);color:#22c55e" onclick="ssConcluirIncidente('${i.id}')" title="Marcar como Concluído"><i class="fas fa-check"></i></button>` : ''}
        </div>
      </td>
    </tr>`).join('');
}

function ssMudarAba(aba, btn) {
  document.querySelectorAll('.ss-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.ss-tab').forEach(t => t.classList.remove('active'));
  const sec = document.getElementById(`ss-${aba}`);
  if (sec) sec.classList.add('active');
  if (btn) btn.classList.add('active');
  // Renderizar matriz se aba treinamentos
  if (aba === 'treinamentos' && typeof ssmaRenderMatrizTreinamento === 'function') {
    setTimeout(() => ssmaRenderMatrizTreinamento('ss_matriz_trein'), 100);
  }
}

function _ssRenderInspecoesHtml() {
  const inspecoes = (typeof _v3Get === 'function') ? _v3Get('fa_inspecoes_ssma', []) : [];
  return `
    <div class="ss-card">
      <div class="ss-card-head">
        <div class="ss-card-title"><i class="fas fa-clipboard-check" style="color:#059669"></i>Inspeções Semanais SSMA</div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-primary btn-sm" onclick="ssmaAbrirChecklistInspecao('')">
            <i class="fas fa-plus"></i> Nova Inspeção
          </button>
        </div>
      </div>
      ${inspecoes.length === 0 ? `
        <div style="text-align:center;padding:40px;color:var(--text-muted)">
          <i class="fas fa-clipboard-check" style="font-size:32px;color:#059669;display:block;margin-bottom:10px"></i>
          <div style="font-weight:600;margin-bottom:6px">Nenhuma inspeção registrada</div>
          <div style="font-size:12px;margin-bottom:14px">Realize inspeções semanais com checklist digital para garantir conformidade SSMA</div>
          <button class="btn btn-primary btn-sm" onclick="ssmaAbrirChecklistInspecao('')"><i class="fas fa-plus"></i> Realizar Primeira Inspeção</button>
        </div>
      ` : `
        <div style="overflow-x:auto">
          <table class="ss-table">
            <thead><tr>
              <th>ID</th><th>Data</th><th>Local/Contrato</th><th>Inspetor</th>
              <th style="text-align:center">OK</th><th style="text-align:center">NC</th>
              <th style="text-align:center">N/A</th><th>Status</th><th>Ações</th>
            </tr></thead>
            <tbody>
              ${inspecoes.map(i => `
                <tr>
                  <td><strong style="color:var(--fa-teal);font-size:12px">${i.id}</strong></td>
                  <td style="font-size:12px">${i.data ? new Date(i.data+'T12:00:00').toLocaleDateString('pt-BR') : '—'}</td>
                  <td style="font-size:12px">${i.contrato||'—'}</td>
                  <td style="font-size:12px">${i.responsavel||'—'}</td>
                  <td style="text-align:center;color:#22c55e;font-weight:700">${i.totalOk||0}</td>
                  <td style="text-align:center;color:${(i.totalNc||0)>0?'#ef4444':'#22c55e'};font-weight:700">${i.totalNc||0}</td>
                  <td style="text-align:center;color:var(--text-muted)">${i.totalNa||0}</td>
                  <td><span style="padding:3px 8px;border-radius:5px;font-size:10px;font-weight:700;background:${i.status==='Conforme'?'rgba(34,197,94,0.1)':'rgba(239,68,68,0.1)'};color:${i.status==='Conforme'?'#16a34a':'#dc2626'}">${i.status||'—'}</span></td>
                  <td>
                    <div style="display:flex;gap:4px">
                      ${(i.totalNc||0)>0 ? `<button class="btn-icon" style="background:rgba(249,115,22,.1);color:#f97316" onclick="ssmaAbrirCausaRaiz('${i.id}',null)" title="Causa Raiz"><i class="fas fa-search"></i></button>` : ''}
                    </div>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      `}
    </div>`;
}

function _ssRenderCausaRaizHtml() {
  const analises = (typeof _v3Get === 'function') ? _v3Get('fa_causa_raiz', []) : [];
  return `
    <div class="ss-card">
      <div class="ss-card-head">
        <div class="ss-card-title"><i class="fas fa-search" style="color:#7c3aed"></i>Análises de Causa Raiz (5 Por Quês)</div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-primary btn-sm" onclick="ssmaAbrirCausaRaiz('',null)">
            <i class="fas fa-plus"></i> Nova Análise
          </button>
        </div>
      </div>
      ${analises.length === 0 ? `
        <div style="text-align:center;padding:40px;color:var(--text-muted)">
          <i class="fas fa-search" style="font-size:32px;color:#7c3aed;display:block;margin-bottom:10px"></i>
          <div style="font-weight:600;margin-bottom:6px">Nenhuma análise registrada</div>
          <div style="font-size:12px;margin-bottom:14px">Registre análises de causa raiz para todos os incidentes e não conformidades</div>
          <button class="btn btn-primary btn-sm" onclick="ssmaAbrirCausaRaiz('',null)"><i class="fas fa-plus"></i> Nova Análise</button>
        </div>
      ` : `
        <div style="overflow-x:auto">
          <table class="ss-table">
            <thead><tr>
              <th>ID</th><th>Referência</th><th>Data</th><th>Causa Raiz</th>
              <th>Responsável</th><th>Prazo</th><th>Status</th>
            </tr></thead>
            <tbody>
              ${analises.map(a => `
                <tr>
                  <td><strong style="color:#7c3aed;font-size:12px">${a.id}</strong></td>
                  <td style="font-size:12px;color:var(--fa-teal)">${a.referencia||'—'}</td>
                  <td style="font-size:12px">${a.data ? new Date(a.data+'T12:00:00').toLocaleDateString('pt-BR') : '—'}</td>
                  <td style="font-size:12px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${a.causaRaiz||''}">${(a.causaRaiz||'—').substring(0,60)}${(a.causaRaiz||'').length>60?'…':''}</td>
                  <td style="font-size:12px">${a.responsavel||'—'}</td>
                  <td style="font-size:12px">${a.prazo ? new Date(a.prazo+'T12:00:00').toLocaleDateString('pt-BR') : '—'}</td>
                  <td><span style="padding:3px 8px;border-radius:5px;font-size:10px;font-weight:700;background:${a.status==='Fechada'?'rgba(34,197,94,0.1)':'rgba(245,158,11,0.1)'};color:${a.status==='Fechada'?'#16a34a':'#d97706'}">${a.status||'Aberta'}</span></td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      `}
    </div>`;
}

function ssFiltrarIncidentes(busca) {
  const todos  = _ssGetIncidentes();
  const txt    = busca.toLowerCase();
  const status = document.getElementById('ss-status-inc')?.value || '';
  const grav   = document.getElementById('ss-grav-inc')?.value   || '';
  let filtrado = txt ? todos.filter(i =>
    (i.id||'').toLowerCase().includes(txt) ||
    (i.tipo||'').toLowerCase().includes(txt) ||
    (i.descricao||'').toLowerCase().includes(txt) ||
    (i.contrato||'').toLowerCase().includes(txt) ||
    (i.responsavel||'').toLowerCase().includes(txt)
  ) : todos;
  if (status) filtrado = filtrado.filter(i => (i.status||'').toLowerCase().includes(status.toLowerCase()));
  if (grav)   filtrado = filtrado.filter(i => (i.gravidade||'') === grav);
  const tbody = document.getElementById('tbody-incidentes');
  if (tbody) tbody.innerHTML = _ssTblIncidentesRows(filtrado);
}

function ssFiltrarIncidentesStatus(status) {
  const todos = _ssGetIncidentes();
  const filtrado = status ? todos.filter(i => (i.status || '').toLowerCase().includes(status.toLowerCase())) : todos;
  const tbody = document.getElementById('tbody-incidentes');
  if (tbody) tbody.innerHTML = _ssTblIncidentesRows(filtrado);
}

function _ssFiltrarGravidade(grav) {
  const busca  = (document.getElementById('ss-busca-inc')?.value || '').toLowerCase();
  const status = document.getElementById('ss-status-inc')?.value || '';
  let todos = _ssGetIncidentes();
  if (busca) todos = todos.filter(i =>
    (i.id||'').toLowerCase().includes(busca) ||
    (i.tipo||'').toLowerCase().includes(busca) ||
    (i.descricao||'').toLowerCase().includes(busca) ||
    (i.contrato||'').toLowerCase().includes(busca) ||
    (i.responsavel||'').toLowerCase().includes(busca)
  );
  if (status) todos = todos.filter(i => (i.status||'').toLowerCase().includes(status.toLowerCase()));
  if (grav)   todos = todos.filter(i => (i.gravidade||'') === grav);
  const tbody = document.getElementById('tbody-incidentes');
  if (tbody) tbody.innerHTML = _ssTblIncidentesRows(todos);
}

// ── Filtros Documentos & Treinamentos ──────────────
function _ssFiltrarDocs(busca) {
  // Re-render the documentos section with filter applied
  const status = document.getElementById('ss-status-docs')?.value || '';
  const sec = document.getElementById('ss-documentos');
  if (!sec) return;
  const txt = (busca||'').toLowerCase();
  let colabs = _ssGetColabs();
  if (status) colabs = colabs.filter(c => (c.docs||'') === status);
  if (txt)    colabs = colabs.filter(c =>
    (c.nome||'').toLowerCase().includes(txt) ||
    (c.id||'').toLowerCase().includes(txt) ||
    (c.cargo||'').toLowerCase().includes(txt) ||
    (c.contrato||'').toLowerCase().includes(txt)
  );
  // Update only the problema table body if it exists
  const tbody = sec.querySelector('tbody');
  if (tbody) {
    tbody.innerHTML = colabs.filter(c => c.docs === 'Crítico' || c.docs === 'Atenção').map(c => `
      <tr>
        <td style="font-weight:600;font-size:12px">${c.nome||c.id}</td>
        <td style="font-size:12px">${c.cargo||'—'}</td>
        <td style="font-size:12px;color:var(--fa-teal)">${c.contrato||'—'}</td>
        <td>${_ssBadge(c.docs||'—')}</td>
        <td>${_ssBadge(c.nr10||'—')}</td>
        <td>${_ssBadge(c.nr35||'—')}</td>
        <td>${_ssBadge(c.status||'—')}</td>
        <td><button class="btn btn-sm" style="font-size:11px;padding:3px 10px;background:rgba(0,180,184,.1);color:var(--fa-teal)" onclick="ssRenovarDoc('${c.id}')">
          <i class="fas fa-sync-alt"></i> Renovar
        </button></td>
      </tr>`).join('') || '<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--text-muted)">Nenhum resultado</td></tr>';
  }
}

function _ssFiltrarTreinNR(nr) {
  const busca = (document.getElementById('ss-busca-trein')?.value || '').toLowerCase();
  ssFiltrarColabsTrein(busca); // existing function — also pass nr hint via DOM
}

/* ── Ver / Editar / Concluir Incidente ─────────────── */
function ssVerIncidente(id) {
  const list = _ssGetIncidentes();
  const i = list.find(x => x.id === id);
  if (!i) return;
  openModal(`Incidente ${i.id} – Detalhes`, `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:13px">
      <div><span style="color:var(--text-muted);font-size:11px">Tipo</span><div style="font-weight:600;margin-top:2px">${i.tipo || '—'}</div></div>
      <div><span style="color:var(--text-muted);font-size:11px">Data</span><div style="font-weight:600;margin-top:2px">${_ssFmtDate(i.data)}</div></div>
      <div><span style="color:var(--text-muted);font-size:11px">Contrato</span><div style="font-weight:600;margin-top:2px;color:var(--fa-teal)">${i.contrato || '—'}</div></div>
      <div><span style="color:var(--text-muted);font-size:11px">Responsável</span><div style="font-weight:600;margin-top:2px">${i.responsavel || '—'}</div></div>
      <div><span style="color:var(--text-muted);font-size:11px">Gravidade</span><div style="margin-top:2px">${_ssBadge(i.gravidade || '—')}</div></div>
      <div><span style="color:var(--text-muted);font-size:11px">Status</span><div style="margin-top:2px">${_ssBadge(i.status || '—')}</div></div>
    </div>
    <div style="margin-top:12px">
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">Descrição</div>
      <div style="background:var(--bg-primary);border:1px solid var(--border-color);padding:10px 12px;border-radius:8px;font-size:13px;line-height:1.6">${i.descricao || '—'}</div>
    </div>
    ${i.acoes ? `<div style="margin-top:12px"><div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">Ações Tomadas</div><div style="background:var(--bg-primary);border:1px solid var(--border-color);padding:10px 12px;border-radius:8px;font-size:13px;line-height:1.6">${i.acoes}</div></div>` : ''}
    ${!/Concluído/i.test(i.status || '') ? `
    <div style="margin-top:12px;padding:10px 14px;background:rgba(239,68,68,.07);border:1px solid rgba(239,68,68,.2);border-radius:8px">
      <div style="font-weight:700;color:#ef4444;font-size:12px;margin-bottom:3px"><i class="fas fa-exclamation-triangle" style="margin-right:5px"></i>Ação Corretiva Necessária</div>
      <div style="font-size:11px;color:var(--text-secondary)">Este incidente requer plano de ação corretiva com responsável, prazo e evidência de eficácia (ISO 45001:2018 §10.2).</div>
    </div>` : ''}
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
    ${!/Concluído/i.test(i.status || '') ? `<button class="btn btn-primary" onclick="closeModal();ssEditarIncidente('${i.id}')"><i class="fas fa-tasks"></i> Abrir Plano de Ação</button>` : ''}
  `);
}

function ssEditarIncidente(id) {
  const list = _ssGetIncidentes();
  const i = list.find(x => x.id === id);
  if (!i) return;
  const contratos = JSON.parse(localStorage.getItem('fa_contratos_cliente') || '[]')
    .concat(JSON.parse(localStorage.getItem('fa_contratos') || '[]'));
  const contratosAtivos = contratos.filter(c => !/Encerrado|Suspenso/i.test(c.status || ''));

  openModal(`Editar Incidente ${i.id}`, `
    <div class="form-row">
      <div class="form-group">
        <label>Tipo de Ocorrência *</label>
        <select class="form-control" id="ei-tipo">
          ${['Quase-Acidente','Acidente sem Afastamento','Acidente com Afastamento','Incidente Ambiental','Condição Insegura','Doença Ocupacional'].map(t =>
            `<option ${i.tipo===t?'selected':''}>${t}</option>`
          ).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Gravidade *</label>
        <select class="form-control" id="ei-grav">
          ${['Baixa','Leve','Média','Alta','Crítica'].map(g =>
            `<option ${i.gravidade===g?'selected':''}>${g}</option>`
          ).join('')}
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Data da Ocorrência *</label>
        <input class="form-control" type="date" id="ei-data" value="${i.data||''}">
      </div>
      <div class="form-group">
        <label>Status</label>
        <select class="form-control" id="ei-status">
          ${['Aberto','Investigação','Plano de Ação','Concluído'].map(s =>
            `<option ${i.status===s?'selected':''}>${s}</option>`
          ).join('')}
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Contrato / Local</label>
        <select class="form-control" id="ei-contrato">
          <option value="">— Selecione —</option>
          ${contratosAtivos.map(c => `<option value="${c.id||c.numero}" ${(i.contrato===c.id||i.contrato===c.numero)?'selected':''}>${c.id||c.numero} – ${c.cliente||c.contratante||''}</option>`).join('')}
          ${!contratosAtivos.find(c=>c.id===i.contrato||c.numero===i.contrato) && i.contrato ? `<option value="${i.contrato}" selected>${i.contrato}</option>` : ''}
        </select>
      </div>
      <div class="form-group">
        <label>Responsável pelo Tratamento</label>
        <input class="form-control" id="ei-resp" type="text" value="${i.responsavel||''}">
      </div>
    </div>
    <div class="form-group">
      <label>Descrição da Ocorrência *</label>
      <textarea class="form-control" id="ei-desc" rows="3" style="resize:vertical">${i.descricao||''}</textarea>
    </div>
    <div class="form-group">
      <label>Ações Corretivas / Plano de Ação</label>
      <textarea class="form-control" id="ei-acoes" rows="3" style="resize:vertical" placeholder="Descreva as ações corretivas, preventivas e o prazo de implementação...">${i.acoes||''}</textarea>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="ssSalvarEdicaoIncidente('${i.id}')">
      <i class="fas fa-save"></i> Salvar Alterações
    </button>
  `);
}

function ssSalvarEdicaoIncidente(id) {
  const list = _ssGetIncidentes();
  const idx = list.findIndex(x => x.id === id);
  if (idx < 0) return;
  list[idx].tipo       = document.getElementById('ei-tipo')?.value;
  list[idx].gravidade  = document.getElementById('ei-grav')?.value;
  list[idx].data       = document.getElementById('ei-data')?.value;
  list[idx].status     = document.getElementById('ei-status')?.value;
  list[idx].contrato   = document.getElementById('ei-contrato')?.value;
  list[idx].responsavel= document.getElementById('ei-resp')?.value;
  list[idx].descricao  = document.getElementById('ei-desc')?.value;
  list[idx].acoes      = document.getElementById('ei-acoes')?.value;
  _ssSaveIncidentes(list);
  if (typeof logAction === 'function') logAction('SSMA', 'Incidente', `Incidente ${id} atualizado`);
  showToast('Incidente atualizado com sucesso!', 'success');
  closeModal();
  renderSSMA();
}

function ssConcluirIncidente(id) {
  const list = _ssGetIncidentes();
  const idx = list.findIndex(x => x.id === id);
  if (idx < 0) return;
  list[idx].status = 'Concluído';
  list[idx].data_conclusao = new Date().toISOString().split('T')[0];
  _ssSaveIncidentes(list);
  if (typeof logAction === 'function') logAction('SSMA', 'Incidente', `Incidente ${id} concluído`);
  showToast(`Incidente ${id} marcado como Concluído!`, 'success');
  renderSSMA();
}

/* ── Novo Incidente ─────────────────────────────────── */
function ssOpenNovoIncidente() {
  const contratos = (JSON.parse(localStorage.getItem('fa_contratos_cliente') || '[]')
    .concat(JSON.parse(localStorage.getItem('fa_contratos') || '[]')))
    .filter(c => !/Encerrado|Suspenso/i.test(c.status || ''));

  openModal('Registrar Novo Incidente / Quase-Acidente', `
    <div class="form-row">
      <div class="form-group">
        <label>Tipo de Ocorrência *</label>
        <select class="form-control" id="ni-tipo">
          <option>Quase-Acidente</option>
          <option>Acidente sem Afastamento</option>
          <option>Acidente com Afastamento</option>
          <option>Incidente Ambiental</option>
          <option>Condição Insegura</option>
          <option>Doença Ocupacional</option>
        </select>
      </div>
      <div class="form-group">
        <label>Gravidade *</label>
        <select class="form-control" id="ni-grav">
          <option>Baixa</option><option>Leve</option><option>Média</option><option>Alta</option><option>Crítica</option>
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Data da Ocorrência *</label>
        <input class="form-control" type="date" id="ni-data" value="${new Date().toISOString().split('T')[0]}">
      </div>
      <div class="form-group">
        <label>Contrato / Local</label>
        <select class="form-control" id="ni-contrato">
          <option value="">— Selecione —</option>
          ${contratos.map(c => `<option value="${c.id||c.numero}">${c.id||c.numero} – ${c.cliente||c.contratante||''}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-group">
      <label>Descrição da Ocorrência *</label>
      <textarea class="form-control" id="ni-desc" rows="3" style="resize:vertical" placeholder="Descreva detalhadamente o que ocorreu, condições do ambiente, equipamentos envolvidos..."></textarea>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Colaboradores Envolvidos</label>
        <input class="form-control" id="ni-colabs" type="text" placeholder="Nome(s) dos colaborador(es)">
      </div>
      <div class="form-group">
        <label>Responsável pelo Tratamento</label>
        <input class="form-control" id="ni-resp" type="text" placeholder="Responsável SSMA">
      </div>
    </div>
    <div class="form-group">
      <label>Medidas Imediatas Tomadas</label>
      <textarea class="form-control" id="ni-acoes" rows="2" style="resize:vertical" placeholder="Primeiros socorros, isolamento da área, comunicação ao gestor..."></textarea>
    </div>
    <div style="background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2);border-radius:8px;padding:10px 12px;font-size:11px;color:var(--text-secondary);margin-top:6px">
      <i class="fas fa-info-circle" style="color:#f59e0b;margin-right:5px"></i>
      <strong>Lembre-se:</strong> Acidentes com afastamento exigem emissão de CAT em até 1 dia útil (Lei 8.213/91).
      Incidentes devem ser registrados no eSocial conforme tabela S-2210.
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-danger" onclick="ssSalvarNovoIncidente()">
      <i class="fas fa-save"></i> Registrar Incidente
    </button>
  `);
}

function ssSalvarNovoIncidente() {
  const tipo  = document.getElementById('ni-tipo')?.value;
  const desc  = document.getElementById('ni-desc')?.value?.trim();
  const data  = document.getElementById('ni-data')?.value;
  if (!tipo || !desc || !data) { showToast('Preencha os campos obrigatórios (*)', 'warning'); return; }

  const list = _ssGetIncidentes();
  const novoId = 'INC-' + String(list.length + 1).padStart(3, '0');
  list.unshift({
    id:          novoId,
    tipo,
    gravidade:   document.getElementById('ni-grav')?.value || 'Baixa',
    data,
    contrato:    document.getElementById('ni-contrato')?.value || '',
    descricao:   desc,
    responsavel: document.getElementById('ni-resp')?.value || '',
    envolvidos:  document.getElementById('ni-colabs')?.value || '',
    acoes:       document.getElementById('ni-acoes')?.value || '',
    status:      'Aberto',
    criado_em:   new Date().toISOString(),
  });
  _ssSaveIncidentes(list);
  if (typeof logAction === 'function') logAction('SSMA', 'Incidente', `Novo incidente ${novoId} registrado: ${tipo}`);
  showToast(`Incidente ${novoId} registrado! Notificação enviada ao SSMA.`, 'success');
  closeModal();
  renderSSMA();
}

/* ── Documentos ─────────────────────────────────────── */
function _ssRenderDocumentosHtml() {
  const colabs = _ssGetColabs();
  const hoje = Date.now();
  const d30  = hoje + 30 * 86400000;

  // Classifica situação de cada colab
  const comProblema = colabs.filter(c => c.docs === 'Crítico' || c.docs === 'Atenção');
  const ok = colabs.filter(c => c.docs === 'OK');

  const nrs = [
    { nr:'NR-10', label:'Segurança em Instalações Elétricas',  ch:'40h', validade:'2 anos', campo:'nr10' },
    { nr:'NR-35', label:'Trabalho em Altura',                   ch:'8h',  validade:'2 anos', campo:'nr35' },
    { nr:'NR-33', label:'Espaços Confinados',                   ch:'16h', validade:'1 ano',  campo:'nr33' },
    { nr:'NR-22', label:'Mineração – Saúde Ocupacional',        ch:'8h',  validade:'1 ano',  campo:'nr22' },
    { nr:'NR-12', label:'Segurança em Máquinas e Equipamentos', ch:'20h', validade:'3 anos', campo:'nr12' },
    { nr:'ASO',   label:'Atestado de Saúde Ocupacional',        ch:'—',   validade:'1 ano',  campo:'aso'  },
  ];

  return `
  <!-- Pesquisa rápida: Documentos -->
  <div class="search-bar" style="margin-bottom:14px;border-radius:var(--radius);border:1.5px solid var(--border);background:var(--bg-secondary)">
    <div class="search-input-wrapper" style="flex:1">
      <i class="fas fa-search"></i>
      <input type="text" class="search-input" id="ss-busca-docs"
        placeholder="Buscar colaborador por nome, cargo, contrato, situação doc…"
        oninput="_ssFiltrarDocs(this.value)" autocomplete="off">
    </div>
    <select class="filter-select" id="ss-status-docs" onchange="_ssFiltrarDocs(document.getElementById('ss-busca-docs')?.value||'')">
      <option value="">Toda a Situação Documental</option>
      <option value="Crítico">Crítico</option>
      <option value="Atenção">Atenção</option>
      <option value="OK">OK</option>
    </select>
  </div>
  <div class="ss-card" style="margin-bottom:14px">
      <span style="font-size:11px;font-weight:700;background:rgba(239,68,68,.12);color:#ef4444;border-radius:8px;padding:2px 8px">${comProblema.length} pendente(s)</span>
    </div>
    ${comProblema.length === 0
      ? `<div style="text-align:center;padding:24px;color:var(--text-muted)"><i class="fas fa-check-circle" style="font-size:24px;color:#22c55e;display:block;margin-bottom:6px"></i>Todos os documentos em ordem!</div>`
      : `<div class="ss-table-wrap"><table class="ss-table">
          <thead><tr><th>Colaborador</th><th>Cargo</th><th>Contrato</th><th>Situação Doc.</th><th>NR-10</th><th>NR-35</th><th>Status</th><th>Ações</th></tr></thead>
          <tbody>
            ${comProblema.map(c => `
              <tr>
                <td style="font-weight:600;font-size:12px">${c.nome||c.id}</td>
                <td style="font-size:12px">${c.cargo||'—'}</td>
                <td style="font-size:12px;color:var(--fa-teal)">${c.contrato||'—'}</td>
                <td>${_ssBadge(c.docs||'—')}</td>
                <td>${_ssBadge(c.nr10||'—')}</td>
                <td>${_ssBadge(c.nr35||'—')}</td>
                <td>${_ssBadge(c.status||'—')}</td>
                <td>
                  <button class="btn btn-sm" style="font-size:11px;padding:3px 10px;background:rgba(0,180,184,.1);color:var(--fa-teal)" onclick="ssRenovarDoc('${c.id}')">
                    <i class="fas fa-redo" style="margin-right:4px"></i>Renovar
                  </button>
                </td>
              </tr>`).join('')}
          </tbody>
        </table></div>`}
  </div>

  <div class="ss-nr-grid">
    ${nrs.map(n => {
      const com = colabs.filter(c => c[n.campo] === 'Vencido' || c[n.campo] === 'Crítico').length;
      const avencer = colabs.filter(c => c[n.campo] === 'Vencendo' || c[n.campo] === 'Atenção').length;
      const total = colabs.length;
      const pct = total > 0 ? Math.round(((total - com - avencer) / total) * 100) : 100;
      const cor = com > 0 ? '#ef4444' : avencer > 0 ? '#f59e0b' : '#22c55e';
      return `
        <div class="ss-nr-card" style="border-left:3px solid ${cor}">
          <div class="ss-nr-header">
            <span class="ss-nr-badge" style="background:${cor === '#ef4444' ? 'rgba(239,68,68,.15)' : cor === '#f59e0b' ? 'rgba(245,158,11,.15)' : 'rgba(34,197,94,.15)'};color:${cor}">${n.nr}</span>
            <div>
              <div style="font-size:13px;font-weight:700">${n.label}</div>
              <div style="font-size:10px;color:var(--text-muted)">CH: ${n.ch} · Validade: ${n.validade}</div>
            </div>
          </div>
          <div class="ss-nr-bar">
            <div class="ss-nr-fill" style="width:${pct}%;background:${cor}"></div>
          </div>
          <div class="ss-nr-stats">
            <span style="color:#22c55e"><i class="fas fa-check" style="margin-right:3px"></i>${total - com - avencer} OK</span>
            ${avencer > 0 ? `<span style="color:#f59e0b"><i class="fas fa-clock" style="margin-right:3px"></i>${avencer} A vencer</span>` : ''}
            ${com > 0 ? `<span style="color:#ef4444"><i class="fas fa-times" style="margin-right:3px"></i>${com} Vencido(s)</span>` : ''}
          </div>
        </div>`;
    }).join('')}
  </div>`;
}

function ssRenovarDoc(colabId) {
  const colabs = _ssGetColabs();
  const c = colabs.find(x => x.id === colabId);
  if (!c) return;
  openModal(`Renovar Documentação – ${c.nome}`, `
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:12px">
      Cargo: <strong>${c.cargo || '—'}</strong> · Contrato: <strong>${c.contrato || '—'}</strong>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>NR-10 Status</label>
        <select class="form-control" id="rd-nr10">
          ${['OK','Vencendo','Vencido','Não Aplicável'].map(s=>`<option ${c.nr10===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>NR-35 Status</label>
        <select class="form-control" id="rd-nr35">
          ${['OK','Vencendo','Vencido','Não Aplicável'].map(s=>`<option ${c.nr35===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-group">
      <label>Situação Geral dos Documentos</label>
      <select class="form-control" id="rd-docs">
        ${['OK','Atenção','Crítico'].map(s=>`<option ${c.docs===s?'selected':''}>${s}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label>Observações</label>
      <input class="form-control" id="rd-obs" type="text" value="${c.obs||''}" placeholder="Ex: ASO emitido em 01/04/2025, válido por 12 meses">
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="ssSalvarRenovacaoDoc('${colabId}')"><i class="fas fa-save"></i> Salvar</button>
  `);
}

function ssSalvarRenovacaoDoc(colabId) {
  const colabs = _ssGetColabs();
  const idx = colabs.findIndex(x => x.id === colabId);
  if (idx < 0) return;
  colabs[idx].nr10 = document.getElementById('rd-nr10')?.value;
  colabs[idx].nr35 = document.getElementById('rd-nr35')?.value;
  colabs[idx].docs = document.getElementById('rd-docs')?.value;
  colabs[idx].obs  = document.getElementById('rd-obs')?.value;
  _ssSaveColabs(colabs);
  showToast('Documentação atualizada!', 'success');
  closeModal();
  renderDocumentos();
}

/* ── Documentos (standalone) ─────────────────────────── */
function renderDocumentos() {
  const main = document.getElementById('mainContent');
  if (!main) return;
  main.innerHTML = `
    <div class="page-header">
      <div class="page-title">
        <h2><i class="fas fa-folder-open" style="color:var(--fa-teal);margin-right:8px"></i>Gestão de Documentos</h2>
        <p>ASOs, certificados NR, contratos e documentos controlados</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary btn-sm" onclick="ssOpenNovoDocumento()">
          <i class="fas fa-plus"></i> Novo Documento
        </button>
      </div>
    </div>
    ${_ssRenderDocumentosHtml()}
  `;
}

/* ── Treinamentos ─────────────────────────────────────── */
function _ssRenderTreinamentosHtml() {
  const colabs = _ssGetColabs();
  const nrs = [
    { nr:'NR-10', label:'Segurança em Instalações Elétricas',  ch:'40h', validade:'2 anos', cor:'#f59e0b' },
    { nr:'NR-35', label:'Trabalho em Altura',                   ch:'8h',  validade:'2 anos', cor:'#ef4444' },
    { nr:'NR-33', label:'Espaços Confinados',                   ch:'16h', validade:'1 ano',  cor:'#6366f1' },
    { nr:'NR-22', label:'Mineração – Saúde Ocupacional',        ch:'8h',  validade:'1 ano',  cor:'#0ea5e9' },
    { nr:'NR-12', label:'Segurança em Máquinas',                ch:'20h', validade:'3 anos', cor:'#22c55e' },
    { nr:'NR-18', label:'Construção Civil',                     ch:'6h',  validade:'1 ano',  cor:'#8b5cf6' },
    { nr:'PCMSO', label:'Prog. Controle Médico Saúde Ocupacional', ch:'—', validade:'1 ano', cor:'#ec4899' },
    { nr:'PPRA',  label:'Programa Prevenção Riscos Ambientais', ch:'—',   validade:'1 ano',  cor:'#14b8a6' },
  ];

  const vencidosNR10  = colabs.filter(c => c.nr10 === 'Vencido').length;
  const vencidosNR35  = colabs.filter(c => c.nr35 === 'Vencido').length;
  const semNR = colabs.filter(c => c.nr10 === 'Vencido' || c.nr35 === 'Vencido').length;

  return `
  <!-- Pesquisa rápida: Treinamentos -->
  <div class="search-bar" style="margin-bottom:14px;border-radius:var(--radius);border:1.5px solid var(--border);background:var(--bg-secondary)">
    <div class="search-input-wrapper" style="flex:1">
      <i class="fas fa-search"></i>
      <input type="text" class="search-input" id="ss-busca-trein"
        placeholder="Buscar treinamento por colaborador, NR, cargo, contrato…"
        oninput="ssFiltrarColabsTrein(this.value)" autocomplete="off">
    </div>
    <select class="filter-select" id="ss-nr-trein" onchange="_ssFiltrarTreinNR(this.value)">
      <option value="">Todas as NRs</option>
      <option value="NR-10">NR-10 – Elétrica</option>
      <option value="NR-35">NR-35 – Altura</option>
      <option value="NR-33">NR-33 – Espaços Confinados</option>
      <option value="NR-22">NR-22 – Mineração</option>
      <option value="NR-12">NR-12 – Máquinas</option>
    </select>
  </div>
  <div class="ss-kpi-grid" style="margin-bottom:16px">
    <div class="ss-kpi" style="border-left:4px solid #6366f1">
      <div class="ss-kpi-ico" style="background:rgba(99,102,241,.12);color:#6366f1"><i class="fas fa-graduation-cap"></i></div>
      <div class="ss-kpi-val" style="color:#6366f1">${nrs.length}</div>
      <div class="ss-kpi-lbl">NRs Monitoradas</div>
    </div>
    <div class="ss-kpi" style="border-left:4px solid #22c55e">
      <div class="ss-kpi-ico" style="background:rgba(34,197,94,.12);color:#22c55e"><i class="fas fa-users"></i></div>
      <div class="ss-kpi-val" style="color:#22c55e">${colabs.filter(c=>c.docs==='OK').length}</div>
      <div class="ss-kpi-lbl">Colaboradores OK</div>
    </div>
    <div class="ss-kpi" style="border-left:4px solid #ef4444">
      <div class="ss-kpi-ico" style="background:rgba(239,68,68,.12);color:#ef4444"><i class="fas fa-times"></i></div>
      <div class="ss-kpi-val" style="color:#ef4444">${semNR}</div>
      <div class="ss-kpi-lbl">Com NR Vencida</div>
    </div>
    <div class="ss-kpi" style="border-left:4px solid #f59e0b">
      <div class="ss-kpi-ico" style="background:rgba(245,158,11,.12);color:#f59e0b"><i class="fas fa-clock"></i></div>
      <div class="ss-kpi-val" style="color:#f59e0b">${colabs.filter(c=>c.docs==='Atenção').length}</div>
      <div class="ss-kpi-lbl">A Vencer em Breve</div>
    </div>
  </div>

  <div class="ss-nr-grid">
    ${nrs.map(n => {
      const campo = n.nr.toLowerCase().replace(/-/g,'').replace(/ /g,'');
      const comVencido = colabs.filter(c => c[campo] === 'Vencido').length;
      const aVencer    = colabs.filter(c => c[campo] === 'Vencendo').length;
      const comOk      = colabs.filter(c => c[campo] === 'OK' || (!c[campo] && c.docs==='OK')).length;
      const cor = comVencido > 0 ? n.cor : aVencer > 0 ? '#f59e0b' : '#22c55e';
      return `
        <div class="ss-nr-card" style="border-top:3px solid ${cor}">
          <div class="ss-nr-header">
            <span class="ss-nr-badge" style="background:${cor}20;color:${cor}">${n.nr}</span>
            <div>
              <div style="font-size:12px;font-weight:700">${n.label}</div>
              <div style="font-size:10px;color:var(--text-muted)">CH: ${n.ch} · Renovação: a cada ${n.validade}</div>
            </div>
          </div>
          <div class="ss-nr-bar">
            <div class="ss-nr-fill" style="width:${colabs.length > 0 ? Math.round((comOk/colabs.length)*100) : 100}%;background:${cor}"></div>
          </div>
          <div class="ss-nr-stats">
            ${comOk > 0 ? `<span style="color:#22c55e"><i class="fas fa-check"></i> ${comOk} OK</span>` : ''}
            ${aVencer > 0 ? `<span style="color:#f59e0b"><i class="fas fa-clock"></i> ${aVencer} Vencendo</span>` : ''}
            ${comVencido > 0 ? `<span style="color:#ef4444"><i class="fas fa-times"></i> ${comVencido} Vencido(s)</span>` : ''}
            ${comOk === 0 && aVencer === 0 && comVencido === 0 ? `<span style="color:var(--text-muted)">Sem dados</span>` : ''}
          </div>
          ${comVencido > 0 ? `<div style="margin-top:8px">
            <button class="btn btn-sm" style="font-size:10px;padding:2px 10px;background:rgba(239,68,68,.1);color:#ef4444;width:100%" onclick="ssVerColabsNRVencida('${n.nr}','${campo}')">
              <i class="fas fa-list"></i> Ver ${comVencido} colaborador(es) vencido(s)
            </button>
          </div>` : ''}
        </div>`;
    }).join('')}
  </div>

  <div class="ss-card">
    <div class="ss-card-head">
      <div class="ss-card-title"><i class="fas fa-list" style="color:var(--fa-teal)"></i>Colaboradores – Situação de Treinamentos</div>
    </div>
    <div class="ss-table-wrap">
      <table class="ss-table" id="tbl-trein-colabs">
        <thead>
          <tr><th>Colaborador</th><th>Cargo</th><th>Contrato</th><th>NR-10</th><th>NR-35</th><th>Situação Geral</th><th>Ações</th></tr>
        </thead>
        <tbody id="tbody-trein-colabs">
          ${_ssTreinColabsRows(colabs)}
        </tbody>
      </table>
    </div>
  </div>

  <!-- Matriz de Treinamentos por Função -->
  <div id="ss_matriz_trein"></div>
  `;
}

function _ssTreinColabsRows(colabs) {
  return colabs.map(c => `
    <tr>
      <td><div style="font-weight:600;font-size:12px">${c.nome || c.id}</div></td>
      <td style="font-size:12px">${c.cargo || '—'}</td>
      <td style="font-size:12px;color:var(--fa-teal)">${c.contrato || '—'}</td>
      <td>${_ssBadge(c.nr10 || '—')}</td>
      <td>${_ssBadge(c.nr35 || '—')}</td>
      <td>${_ssBadge(c.docs || '—')}</td>
      <td>
        <button class="btn-icon edit" onclick="ssRenovarDoc('${c.id}')" title="Atualizar documentação"><i class="fas fa-edit"></i></button>
      </td>
    </tr>`).join('');
}

function ssFiltrarColabsTrein(busca) {
  const nr    = document.getElementById('ss-nr-trein')?.value || '';
  const colabs = _ssGetColabs();
  const txt = (busca||'').toLowerCase();
  let filtrado = txt ? colabs.filter(c =>
    (c.nome || '').toLowerCase().includes(txt) ||
    (c.cargo || '').toLowerCase().includes(txt) ||
    (c.contrato || '').toLowerCase().includes(txt)
  ) : colabs;
  // Apply NR filter: map NR label to field name
  if (nr) {
    const nrField = { 'NR-10':'nr10','NR-35':'nr35','NR-33':'nr33','NR-22':'nr22','NR-12':'nr12' }[nr];
    if (nrField) filtrado = filtrado.filter(c => c[nrField] === 'Vencido' || c[nrField] === 'A Vencer');
  }
  const tbody = document.getElementById('tbody-trein-colabs');
  if (tbody) tbody.innerHTML = _ssTreinColabsRows(filtrado);
}

function ssVerColabsNRVencida(nr, campo) {
  const colabs = _ssGetColabs().filter(c => c[campo] === 'Vencido');
  openModal(`${nr} – Colaboradores com Treinamento Vencido`, `
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:12px">
      ${colabs.length} colaborador(es) com ${nr} vencido. Estes colaboradores não podem exercer atividades que exijam esta certificação.
    </div>
    <table class="ss-table">
      <thead><tr><th>Colaborador</th><th>Cargo</th><th>Contrato</th><th>Status</th></tr></thead>
      <tbody>${colabs.map(c=>`
        <tr>
          <td style="font-weight:600">${c.nome||c.id}</td>
          <td style="font-size:12px">${c.cargo||'—'}</td>
          <td style="font-size:12px;color:var(--fa-teal)">${c.contrato||'—'}</td>
          <td>${_ssBadge(c.docs||'—')}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  `, `<button class="btn btn-secondary" onclick="closeModal()">Fechar</button>`);
}

/* ── Treinamentos (standalone) ───────────────────────── */
function renderTreinamentos() {
  const main = document.getElementById('mainContent');
  if (!main) return;
  main.innerHTML = `
    <div class="page-header">
      <div class="page-title">
        <h2><i class="fas fa-graduation-cap" style="color:var(--fa-teal);margin-right:8px"></i>Gestão de Treinamentos</h2>
        <p>Certificações NR, treinamentos obrigatórios e conformidade NR-1</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary btn-sm" onclick="ssOpenNovoTreinamento()">
          <i class="fas fa-plus"></i> Novo Treinamento
        </button>
      </div>
    </div>
    ${_ssRenderTreinamentosHtml()}
  `;
}

function ssOpenNovoTreinamento() {
  const colabs = _ssGetColabs().filter(c => /Ativo|Mobiliz/i.test(c.status || ''));
  openModal('Registrar Treinamento Realizado', `
    <div class="form-row">
      <div class="form-group">
        <label>Tipo de Treinamento / NR *</label>
        <select class="form-control" id="nt-tipo">
          <option>NR-10 – Segurança Elétrica</option>
          <option>NR-35 – Trabalho em Altura</option>
          <option>NR-33 – Espaço Confinado</option>
          <option>NR-22 – Mineração</option>
          <option>NR-12 – Máquinas e Equipamentos</option>
          <option>NR-18 – Construção Civil</option>
          <option>PCMSO – Controle Médico</option>
          <option>Integração SSMA</option>
          <option>Outro</option>
        </select>
      </div>
      <div class="form-group">
        <label>Colaborador *</label>
        <select class="form-control" id="nt-colab">
          <option value="">— Selecione —</option>
          ${colabs.map(c=>`<option value="${c.id}">${c.nome||c.id} – ${c.cargo||''}</option>`).join('')}
          <option value="TODOS">Todos os colaboradores ativos</option>
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Data de Realização *</label>
        <input class="form-control" type="date" id="nt-data" value="${new Date().toISOString().split('T')[0]}">
      </div>
      <div class="form-group">
        <label>Validade (data expiração) *</label>
        <input class="form-control" type="date" id="nt-validade">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Carga Horária</label>
        <input class="form-control" id="nt-ch" type="text" placeholder="Ex: 8h">
      </div>
      <div class="form-group">
        <label>Instrutor / Empresa</label>
        <input class="form-control" id="nt-instrutor" type="text" placeholder="Nome do instrutor ou empresa">
      </div>
    </div>
    <div class="form-group">
      <label>Observações</label>
      <textarea class="form-control" id="nt-obs" rows="2" style="resize:vertical" placeholder="Conteúdo, metodologia, local..."></textarea>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="ssSalvarNovoTreinamento()"><i class="fas fa-save"></i> Registrar</button>
  `);
}

function ssSalvarNovoTreinamento() {
  const tipo     = document.getElementById('nt-tipo')?.value;
  const colabId  = document.getElementById('nt-colab')?.value;
  const data     = document.getElementById('nt-data')?.value;
  const validade = document.getElementById('nt-validade')?.value;
  if (!tipo || !colabId || !data) { showToast('Preencha os campos obrigatórios', 'warning'); return; }

  const trein = _ssGetTreinamentos();
  const novo = {
    id:         _ssGerarId('TRN'),
    tipo,
    colaborador_id: colabId,
    data,
    validade,
    ch:         document.getElementById('nt-ch')?.value || '—',
    instrutor:  document.getElementById('nt-instrutor')?.value || '',
    obs:        document.getElementById('nt-obs')?.value || '',
    status:     validade && new Date(validade).getTime() > Date.now() ? 'Vigente' : 'Vencido',
  };

  // Atualiza status NR do colaborador
  const colabs = _ssGetColabs();
  if (colabId !== 'TODOS') {
    const idx = colabs.findIndex(c => c.id === colabId);
    if (idx >= 0) {
      if (/NR-10/i.test(tipo)) { colabs[idx].nr10 = 'OK'; }
      if (/NR-35/i.test(tipo)) { colabs[idx].nr35 = 'OK'; }
      if (colabs[idx].nr10 === 'OK' && colabs[idx].nr35 === 'OK') colabs[idx].docs = 'OK';
      else if (colabs[idx].nr10 === 'Vencido' || colabs[idx].nr35 === 'Vencido') colabs[idx].docs = 'Crítico';
      else colabs[idx].docs = 'Atenção';
      _ssSaveColabs(colabs);
    }
  }
  trein.unshift(novo);
  _ssSaveTreinamentos(trein);
  if (typeof logAction === 'function') logAction('SSMA', 'Treinamento', `Treinamento ${tipo} registrado para ${colabId}`);
  showToast('Treinamento registrado com sucesso!', 'success');
  closeModal();
  renderTreinamentos();
}

/* ── Gráficos ───────────────────────────────────────── */
function _ssRenderCharts() {
  const incidentes   = _ssGetIncidentes();
  const colaboradores= _ssGetColabs();

  const byTipo = {};
  incidentes.forEach(i => { const t = i.tipo || '—'; byTipo[t] = (byTipo[t] || 0) + 1; });

  const byGrav = { Baixa: 0, Leve: 0, Média: 0, Alta: 0, Crítica: 0 };
  incidentes.forEach(i => { const g = i.gravidade || 'Baixa'; byGrav[g] = (byGrav[g] || 0) + 1; });

  const meses = [];
  const now = new Date();
  const byMes = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const lbl = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][d.getMonth()] + '/' + String(d.getFullYear()).slice(2);
    meses.push(lbl);
    byMes.push(incidentes.filter(inc => {
      const dt = new Date(inc.data || '');
      return dt.getFullYear() === d.getFullYear() && dt.getMonth() === d.getMonth();
    }).length);
  }

  const docStatus = {
    'OK': colaboradores.filter(c => c.docs === 'OK').length,
    'Atenção': colaboradores.filter(c => c.docs === 'Atenção').length,
    'Crítico': colaboradores.filter(c => c.docs === 'Crítico').length,
  };

  const textColor = '#8b949e';
  const gridColor = 'rgba(255,255,255,0.07)';

  function makeChart(id, cfg) {
    const el = document.getElementById(id);
    if (!el) return;
    if (el._chart) el._chart.destroy();
    el._chart = new Chart(el.getContext('2d'), cfg);
  }

  const loadCharts = () => {
    makeChart('ss-chart-tipo', {
      type: 'doughnut',
      data: {
        labels: Object.keys(byTipo),
        datasets: [{ data: Object.values(byTipo), backgroundColor: ['#ef4444','#f59e0b','#6366f1','#0ea5e9','#22c55e','#8b5cf6'], borderWidth: 0 }]
      },
      options: { responsive: true, maintainAspectRatio: false, cutout: '60%', plugins: { legend: { labels: { color: textColor, font: { size: 10 }, boxWidth: 10 } } } }
    });
    makeChart('ss-chart-grav', {
      type: 'bar',
      data: {
        labels: Object.keys(byGrav),
        datasets: [{ label: 'Incidentes', data: Object.values(byGrav), backgroundColor: ['#22c55e','#0ea5e9','#f59e0b','#ef4444','#dc2626'], borderRadius: 6 }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: textColor, font: { size: 10 } }, grid: { color: gridColor } }, y: { ticks: { color: textColor, font: { size: 10 } }, grid: { color: gridColor }, beginAtZero: true } } }
    });
    makeChart('ss-chart-mes', {
      type: 'bar',
      data: {
        labels: meses,
        datasets: [{ label: 'Incidentes', data: byMes, backgroundColor: 'rgba(239,68,68,.6)', borderRadius: 6 }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: textColor, font: { size: 10 } }, grid: { color: gridColor } }, y: { ticks: { color: textColor, font: { size: 10 } }, grid: { color: gridColor }, beginAtZero: true, stepSize: 1 } } }
    });
    makeChart('ss-chart-docs', {
      type: 'doughnut',
      data: {
        labels: Object.keys(docStatus),
        datasets: [{ data: Object.values(docStatus), backgroundColor: ['#22c55e','#f59e0b','#ef4444'], borderWidth: 0 }]
      },
      options: { responsive: true, maintainAspectRatio: false, cutout: '60%', plugins: { legend: { labels: { color: textColor, font: { size: 10 }, boxWidth: 10 } } } }
    });
  };

  if (window.Chart) {
    loadCharts();
  } else {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
    s.onload = loadCharts;
    document.head.appendChild(s);
  }
}

function ssExportarRelatorio() {
  const inc = _ssGetIncidentes();
  const col = _ssGetColabs();
  const abertos = inc.filter(i => !/Concluído/i.test(i.status || '')).length;
  const problemas = col.filter(c => c.docs !== 'OK').length;

  const html = `<!DOCTYPE html><html><head><title>Relatório SSMA – Fraser Alexander</title>
  <style>body{font-family:Arial,sans-serif;margin:30px;color:#333}h1{color:#00b4b8}table{width:100%;border-collapse:collapse;margin:16px 0}
  th,td{border:1px solid #ddd;padding:8px 12px;font-size:12px}th{background:#f5f5f5;font-weight:700}
  .badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700}
  .red{background:#fee2e2;color:#dc2626}.yellow{background:#fef3c7;color:#d97706}.green{background:#dcfce7;color:#16a34a}
  </style></head><body>
  <h1>Relatório SSMA – Fraser Alexander</h1>
  <p>Gerado em: ${new Date().toLocaleString('pt-BR')}</p>
  <h2>Resumo</h2>
  <table><tr><th>Indicador</th><th>Valor</th></tr>
  <tr><td>Total de Incidentes</td><td>${inc.length}</td></tr>
  <tr><td>Incidentes em Aberto</td><td>${abertos}</td></tr>
  <tr><td>Colaboradores com Doc. Pendente</td><td>${problemas}</td></tr>
  <tr><td>Total Colaboradores</td><td>${col.length}</td></tr>
  </table>
  <h2>Incidentes</h2>
  <table><thead><tr><th>ID</th><th>Tipo</th><th>Data</th><th>Gravidade</th><th>Status</th><th>Descrição</th></tr></thead>
  <tbody>${inc.map(i=>`<tr><td>${i.id}</td><td>${i.tipo||'—'}</td><td>${_ssFmtDate(i.data)}</td><td>${i.gravidade||'—'}</td><td>${i.status||'—'}</td><td>${(i.descricao||'').slice(0,80)}</td></tr>`).join('')}</tbody></table>
  <h2>Documentação de Colaboradores</h2>
  <table><thead><tr><th>Nome</th><th>Cargo</th><th>Contrato</th><th>NR-10</th><th>NR-35</th><th>Situação</th></tr></thead>
  <tbody>${col.map(c=>`<tr><td>${c.nome||c.id}</td><td>${c.cargo||'—'}</td><td>${c.contrato||'—'}</td><td>${c.nr10||'—'}</td><td>${c.nr35||'—'}</td><td>${c.docs||'—'}</td></tr>`).join('')}</tbody></table>
  <button onclick="window.print()" style="margin-top:16px;padding:8px 18px;background:#00b4b8;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px">Imprimir / Salvar PDF</button>
  </body></html>`;

  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); }
}

function ssOpenNovoDocumento() {
  showToast('Funcionalidade de upload em desenvolvimento', 'info');
}

// ═══════════════════════════════════════════════════════════════════════
//  ANÁLISE DE CAUSA RAIZ — ISHIKAWA + PLANO DE AÇÃO
//  Módulo completo: abertura, diagrama, causas, ações, IA, encerramento
// ═══════════════════════════════════════════════════════════════════════

function _crGet(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }
function _crSave(k, v) { localStorage.setItem(k, JSON.stringify(v)); }
function _getCausaRaizList() {
  const a = _crGet('fa_causa_raiz', null) || _crGet('erp_causa_raiz', null);
  return Array.isArray(a) ? a : [];
}
function _saveCausaRaizList(l) {
  _crSave('fa_causa_raiz', l);
  _crSave('erp_causa_raiz', l);
}

// Categorias Ishikawa — parametrizáveis via configuração
function _crGetCategorias() {
  try {
    const cfg = JSON.parse(localStorage.getItem('erp_cfg_ishikawa_categorias') || 'null');
    if (Array.isArray(cfg) && cfg.length) return cfg;
  } catch(e) {}
  return [
    { id:'mao_obra',   label:'Mão de Obra',              icon:'fa-users',          cor:'#ef4444' },
    { id:'metodo',     label:'Método / Processo',         icon:'fa-sitemap',        cor:'#f97316' },
    { id:'maquina',    label:'Máquina / Equipamento',     icon:'fa-cogs',           cor:'#eab308' },
    { id:'material',   label:'Material / Insumo',         icon:'fa-box',            cor:'#22c55e' },
    { id:'meio',       label:'Meio Ambiente / Condições', icon:'fa-cloud',          cor:'#3b82f6' },
    { id:'medicao',    label:'Medição / Controle',        icon:'fa-ruler',          cor:'#8b5cf6' },
    { id:'gestao',     label:'Gestão / Liderança',        icon:'fa-user-tie',       cor:'#ec4899' },
    { id:'documento',  label:'Documentação / Procedimento',icon:'fa-file-alt',      cor:'#14b8a6' }
  ];
}

function ssmaAbrirCausaRaiz(incidenteId, analiseId) {
  const incidentes = _ssGetIncidentes();
  const incidente  = incidenteId ? incidentes.find(i => i.id === incidenteId) : null;

  let analise = null;
  if (analiseId) {
    analise = _getCausaRaizList().find(a => a.id === analiseId) || null;
  }

  const categorias = _crGetCategorias();
  const hoje = new Date().toISOString().split('T')[0];
  const novoId = analise?.id || `CR-${new Date().getFullYear()}-${String(_getCausaRaizList().length+1).padStart(4,'0')}`;

  const tabsHtml = `
    <div style="display:flex;gap:3px;flex-wrap:wrap;border-bottom:2px solid var(--border-color);margin-bottom:16px;padding-bottom:0">
      ${['Identificação','Ishikawa','Causa Raiz','Plano de Ação','Evidências','IA Copiloto'].map((t,i)=>`
        <button onclick="crMudarAba(${i},this)" class="cr-tab${i===0?' cr-tab-active':''}"
          style="padding:8px 14px;font-size:12px;font-weight:600;border:none;background:none;cursor:pointer;border-bottom:3px solid ${i===0?'var(--fa-teal)':'transparent'};color:${i===0?'var(--fa-teal)':'var(--text-muted)'};border-radius:4px 4px 0 0;transition:.15s">
          ${t}
        </button>`).join('')}
    </div>`;

  const aba0 = `
    <div class="cr-aba" id="cr-aba-0" style="display:block">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
        <div><label style="font-size:11px;color:var(--text-muted)">Nº da Análise</label>
          <input class="form-control" id="cr_id" value="${novoId}" readonly style="background:var(--bg-tertiary)"></div>
        <div><label style="font-size:11px;color:var(--text-muted)">Data de Abertura</label>
          <input class="form-control" id="cr_data" type="date" value="${analise?.data_abertura||hoje}"></div>
        <div><label style="font-size:11px;color:var(--text-muted)">Evento de Origem</label>
          <input class="form-control" id="cr_evento" value="${analise?.evento_origem||incidente?.id||''}" placeholder="Nº do incidente / não conformidade"></div>
        <div><label style="font-size:11px;color:var(--text-muted)">Responsável</label>
          <input class="form-control" id="cr_responsavel" value="${analise?.responsavel||currentUser?.name||''}" placeholder="Responsável pela investigação"></div>
        <div><label style="font-size:11px;color:var(--text-muted)">Área / Contrato</label>
          <input class="form-control" id="cr_area" value="${analise?.area||incidente?.contrato||''}" placeholder="Área, contrato ou unidade operacional"></div>
        <div><label style="font-size:11px;color:var(--text-muted)">Gravidade</label>
          <select class="form-control" id="cr_gravidade">
            ${['Baixa','Média','Alta','Crítica'].map(g=>`<option ${(analise?.gravidade||'Média')===g?'selected':''}>${g}</option>`).join('')}
          </select></div>
        <div><label style="font-size:11px;color:var(--text-muted)">Prazo da Investigação</label>
          <input class="form-control" id="cr_prazo" type="date" value="${analise?.prazo||''}"></div>
        <div><label style="font-size:11px;color:var(--text-muted)">Status</label>
          <select class="form-control" id="cr_status">
            ${['Em Investigação','Aguardando Validação','Plano em Andamento','Encerrada'].map(s=>`<option ${(analise?.status||'Em Investigação')===s?'selected':''}>${s}</option>`).join('')}
          </select></div>
      </div>
      <div style="margin-bottom:10px"><label style="font-size:11px;color:var(--text-muted)">Descrição Objetiva do Problema *</label>
        <textarea class="form-control" id="cr_descricao" rows="3" placeholder="Descreva o problema de forma objetiva: O quê aconteceu? Quando? Onde?">${analise?.descricao_problema||incidente?.descricao||''}</textarea></div>
      <div style="margin-bottom:10px"><label style="font-size:11px;color:var(--text-muted)">Efeito Observado</label>
        <textarea class="form-control" id="cr_efeito" rows="2" placeholder="Qual foi o impacto real observado?">${analise?.efeito_observado||''}</textarea></div>
      <div style="margin-bottom:10px"><label style="font-size:11px;color:var(--text-muted)">Causa Imediata</label>
        <input class="form-control" id="cr_causa_imediata" value="${analise?.causa_imediata||''}" placeholder="O que diretamente desencadeou o evento?"></div>
    </div>`;

  const aba1 = `
    <div class="cr-aba" id="cr-aba-1" style="display:none">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">
        <div style="background:rgba(59,130,246,0.06);border:1px solid rgba(59,130,246,0.2);border-radius:8px;padding:10px 14px;font-size:12px;flex:1">
          <i class="fas fa-info-circle" style="color:#3b82f6;margin-right:6px"></i>
          Registre as causas potenciais identificadas em cada categoria. Use "+" para adicionar causas em cada espinha do diagrama.
        </div>
        <button onclick="crAbrirDiagramaIshikawa('')" class="btn btn-secondary btn-sm" style="white-space:nowrap">
          <i class="fas fa-project-diagram" style="color:#8b5cf6"></i> Ver Diagrama SVG
        </button>
      </div>
      ${categorias.map(cat => `
        <div style="background:var(--bg-card2);border:1px solid var(--border-color);border-radius:8px;padding:12px;margin-bottom:10px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
            <div style="display:flex;align-items:center;gap:8px">
              <span style="background:${cat.cor}22;color:${cat.cor};border-radius:6px;padding:4px 10px;font-size:11px;font-weight:700">
                <i class="fas ${cat.icon}" style="margin-right:4px"></i>${cat.label}
              </span>
            </div>
            <button onclick="crAdicionarCausa('${cat.id}')" class="btn btn-secondary btn-sm" style="font-size:11px">
              <i class="fas fa-plus"></i> Adicionar causa
            </button>
          </div>
          <div id="cr_causas_${cat.id}" style="display:flex;flex-direction:column;gap:5px">
            ${(analise?.categorias_ishikawa?.[cat.id]||[]).map((c,ci)=>`
              <div class="cr-causa-row" style="display:flex;gap:6px;align-items:center">
                <input class="form-control cr-causa-input" data-cat="${cat.id}" value="${c}" style="font-size:12px" placeholder="Causa potencial...">
                <button onclick="this.closest('.cr-causa-row').remove()" class="btn btn-danger btn-sm btn-icon"><i class="fas fa-times"></i></button>
              </div>`).join('')}
          </div>
        </div>`).join('')}
    </div>`;

  const aba2 = `
    <div class="cr-aba" id="cr-aba-2" style="display:none">
      <div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.3);border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:#92400e">
        <i class="fas fa-exclamation-triangle" style="color:#d97706;margin-right:6px"></i>
        A causa raiz validada deve ser aprovada pelo responsável — a IA pode sugerir hipóteses, mas a validação é sempre humana.
      </div>
      <div style="margin-bottom:12px"><label style="font-size:11px;font-weight:700;color:var(--text-secondary)">Causa Raiz Validada *</label>
        <textarea class="form-control" id="cr_causa_raiz" rows="4" placeholder="Descreva a causa raiz confirmada pela equipe de investigação após análise do diagrama Ishikawa...">${analise?.causa_raiz_validada||''}</textarea></div>
      <div style="margin-bottom:12px"><label style="font-size:11px;color:var(--text-muted)">Validado por</label>
        <input class="form-control" id="cr_validado_por" value="${analise?.validado_por||''}" placeholder="Nome do responsável pela validação da causa raiz"></div>
      <div><label style="font-size:11px;color:var(--text-muted)">Data da Validação</label>
        <input class="form-control" id="cr_data_validacao" type="date" value="${analise?.data_validacao||''}"></div>
    </div>`;

  const aba3 = `
    <div class="cr-aba" id="cr-aba-3" style="display:none">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div style="font-size:13px;font-weight:700;color:var(--text-primary)">Ações Corretivas e Preventivas</div>
        <button onclick="crAdicionarAcao()" class="btn btn-primary btn-sm"><i class="fas fa-plus"></i> Nova Ação</button>
      </div>
      <div id="cr_acoes_lista">
        ${(analise?.acoes||[]).map((a,ai)=>_crRenderAcaoRow(a,ai)).join('')}
      </div>
      ${!(analise?.acoes||[]).length ? `<div style="text-align:center;padding:30px;color:var(--text-muted);font-size:12px">
        <i class="fas fa-tasks" style="font-size:28px;display:block;margin-bottom:8px"></i>
        Nenhuma ação cadastrada. Clique em "Nova Ação" para adicionar.
      </div>` : ''}
    </div>`;

  const aba4 = `
    <div class="cr-aba" id="cr-aba-4" style="display:none">
      <div style="margin-bottom:12px"><label style="font-size:11px;color:var(--text-muted)">Evidências e Observações</label>
        <textarea class="form-control" id="cr_evidencias" rows="5" placeholder="Registre evidências coletadas, fotos anexadas, depoimentos, medições, dados de sistema...">${analise?.evidencias||''}</textarea></div>
      <div style="background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.2);border-radius:8px;padding:10px 14px;font-size:12px;color:var(--text-muted)">
        <i class="fas fa-paperclip" style="color:#10b981;margin-right:6px"></i>
        Upload de arquivos/fotos disponível na versão com backend. Nesta versão, registre as evidências em texto.
      </div>
    </div>`;

  const aba5 = `
    <div class="cr-aba" id="cr-aba-5" style="display:none">
      <div style="background:linear-gradient(135deg,rgba(139,92,246,0.08),rgba(59,130,246,0.06));border:1px solid rgba(139,92,246,0.25);border-radius:10px;padding:14px;margin-bottom:14px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <i class="fas fa-robot" style="color:#8b5cf6;font-size:18px"></i>
          <span style="font-size:14px;font-weight:700;color:var(--text-primary)">IA Copiloto — Análise de Causa Raiz</span>
          <span style="font-size:10px;background:rgba(139,92,246,0.15);color:#8b5cf6;border-radius:4px;padding:2px 8px;font-weight:600">SUGESTÃO — Validação Humana Obrigatória</span>
        </div>
        <p style="font-size:12px;color:var(--text-muted);margin:0 0 10px">
          A IA analisa as informações preenchidas e sugere hipóteses de causa raiz, ações corretivas e preventivas.
          <strong style="color:#d97706">A IA não encerra investigações nem valida causa raiz sozinha.</strong>
        </p>
        <button onclick="crGerarSugestaoIA()" class="btn btn-primary btn-sm" style="background:linear-gradient(135deg,#8b5cf6,#6366f1)">
          <i class="fas fa-magic"></i> Gerar Análise com IA
        </button>
      </div>
      <div id="cr_ia_resultado" style="display:none">
        <div style="font-size:12px;font-weight:700;color:var(--text-secondary);margin-bottom:8px;text-transform:uppercase">Resultado da Análise IA</div>
        <div id="cr_ia_conteudo" style="background:var(--bg-card2);border:1px solid var(--border-color);border-radius:8px;padding:14px;font-size:12px;color:var(--text-primary);line-height:1.7"></div>
        <div style="margin-top:8px;padding:8px 12px;background:rgba(245,158,11,0.08);border-radius:6px;font-size:11px;color:#92400e">
          <i class="fas fa-exclamation-triangle" style="color:#d97706;margin-right:4px"></i>
          Sugestão gerada em: <span id="cr_ia_data">—</span> | Nível de confiança: Médio (baseado nos dados preenchidos)
          <br>Premissas: informações do formulário + categorias Ishikawa preenchidas. Decisão final é sempre humana.
        </div>
      </div>
    </div>`;

  openModalWide(`Análise de Causa Raiz — ${novoId}`, `
    <div style="max-height:75vh;overflow-y:auto;padding-right:4px">
      <style>
        .cr-tab { padding:8px 14px;font-size:12px;font-weight:600;border:none;background:none;cursor:pointer;border-bottom:3px solid transparent;color:var(--text-muted);border-radius:4px 4px 0 0;transition:.15s }
        .cr-tab-active { color:var(--fa-teal)!important;border-bottom-color:var(--fa-teal)!important }
        .cr-aba { display:none }
      </style>
      ${tabsHtml}${aba0}${aba1}${aba2}${aba3}${aba4}${aba5}
    </div>`,
  `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="crSalvarAnalise('${novoId}','${incidenteId||''}')">
      <i class="fas fa-save"></i> Salvar Análise
    </button>
  `);
}

function crMudarAba(idx, btn) {
  document.querySelectorAll('.cr-aba').forEach((a,i) => a.style.display = i===idx ? 'block' : 'none');
  document.querySelectorAll('.cr-tab').forEach(b => { b.classList.remove('cr-tab-active'); b.style.color='var(--text-muted)'; b.style.borderBottomColor='transparent'; });
  btn.classList.add('cr-tab-active');
  btn.style.color = 'var(--fa-teal)';
  btn.style.borderBottomColor = 'var(--fa-teal)';
}

function crAdicionarCausa(catId) {
  const cont = document.getElementById(`cr_causas_${catId}`);
  if (!cont) return;
  const div = document.createElement('div');
  div.className = 'cr-causa-row';
  div.style.cssText = 'display:flex;gap:6px;align-items:center';
  div.innerHTML = `<input class="form-control cr-causa-input" data-cat="${catId}" style="font-size:12px" placeholder="Causa potencial..."><button onclick="this.closest('.cr-causa-row').remove()" class="btn btn-danger btn-sm btn-icon"><i class="fas fa-times"></i></button>`;
  cont.appendChild(div);
  div.querySelector('input')?.focus();
}

function _crRenderAcaoRow(acao, idx) {
  const tipos = ['Corretiva','Preventiva'];
  return `
    <div class="cr-acao-row" data-idx="${idx}" style="background:var(--bg-card2);border:1px solid var(--border-color);border-radius:8px;padding:12px;margin-bottom:8px">
      <div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:8px;align-items:end;flex-wrap:wrap">
        <div><label style="font-size:10px;color:var(--text-muted)">Descrição da Ação</label>
          <input class="form-control cr-acao-desc" value="${acao?.descricao||''}" placeholder="Descrição da ação" style="font-size:12px"></div>
        <div><label style="font-size:10px;color:var(--text-muted)">Tipo</label>
          <select class="form-control cr-acao-tipo" style="font-size:12px">
            ${tipos.map(t=>`<option ${(acao?.tipo||'Corretiva')===t?'selected':''}>${t}</option>`).join('')}
          </select></div>
        <div><label style="font-size:10px;color:var(--text-muted)">Responsável</label>
          <input class="form-control cr-acao-resp" value="${acao?.responsavel||''}" placeholder="Responsável" style="font-size:12px"></div>
        <div><label style="font-size:10px;color:var(--text-muted)">Prazo</label>
          <input class="form-control cr-acao-prazo" type="date" value="${acao?.prazo||''}" style="font-size:12px"></div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px">
        <select class="form-control cr-acao-status" style="font-size:11px;max-width:150px">
          ${['Pendente','Em Andamento','Concluída','Cancelada'].map(s=>`<option ${(acao?.status||'Pendente')===s?'selected':''}>${s}</option>`).join('')}
        </select>
        <button onclick="this.closest('.cr-acao-row').remove()" class="btn btn-danger btn-sm" style="font-size:11px"><i class="fas fa-trash"></i></button>
      </div>
    </div>`;
}

function crAdicionarAcao() {
  const lista = document.getElementById('cr_acoes_lista');
  if (!lista) return;
  const idx = lista.querySelectorAll('.cr-acao-row').length;
  const div = document.createElement('div');
  div.innerHTML = _crRenderAcaoRow({}, idx);
  lista.appendChild(div.firstElementChild);
}

function crGerarSugestaoIA() {
  const descricao = document.getElementById('cr_descricao')?.value.trim() || '';
  const efeito    = document.getElementById('cr_efeito')?.value.trim() || '';
  const causaImed = document.getElementById('cr_causa_imediata')?.value.trim() || '';
  const gravidade = document.getElementById('cr_gravidade')?.value || '';
  const categorias = _crGetCategorias();

  if (!descricao) {
    showToast('Preencha a descrição do problema antes de gerar a análise.', 'error');
    return;
  }

  // Coleta causas preenchidas por categoria
  const causasCat = {};
  categorias.forEach(cat => {
    const inputs = document.querySelectorAll(`#cr_causas_${cat.id} .cr-causa-input`);
    causasCat[cat.label] = Array.from(inputs).map(i => i.value.trim()).filter(Boolean);
  });
  const totalCausas = Object.values(causasCat).flat().length;

  // Gera análise estruturada baseada nos dados preenchidos
  const btn = document.querySelector('[onclick="crGerarSugestaoIA()"]');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analisando...'; }

  setTimeout(() => {
    const resultado = document.getElementById('cr_ia_resultado');
    const conteudo  = document.getElementById('cr_ia_conteudo');
    const dataEl    = document.getElementById('cr_ia_data');

    const catComCausas = Object.entries(causasCat).filter(([,v])=>v.length>0);
    const catSemCausas = categorias.filter(c => !causasCat[c.label]?.length).map(c=>c.label);

    let html = `<div style="margin-bottom:12px">
      <strong style="color:#8b5cf6">📊 Diagnóstico com base nos dados fornecidos:</strong><br>
      <span style="color:var(--text-muted)">Problema: </span>${descricao}<br>
      ${efeito ? `<span style="color:var(--text-muted)">Efeito: </span>${efeito}<br>` : ''}
      ${causaImed ? `<span style="color:var(--text-muted)">Causa imediata: </span>${causaImed}<br>` : ''}
      <span style="color:var(--text-muted)">Gravidade: </span><strong>${gravidade}</strong> | 
      <span style="color:var(--text-muted)">Causas registradas: </span><strong>${totalCausas}</strong>
    </div>`;

    if (catComCausas.length) {
      html += `<div style="margin-bottom:12px"><strong style="color:#8b5cf6">🔍 Hipóteses de causa raiz (baseadas nas causas registradas):</strong><ul style="margin:6px 0 0 16px;padding:0">`;
      catComCausas.forEach(([cat, causas]) => {
        html += `<li><strong>${cat}:</strong> ${causas.join(' / ')}</li>`;
      });
      html += `</ul></div>`;
    }

    html += `<div style="margin-bottom:12px"><strong style="color:#8b5cf6">✅ Ações corretivas sugeridas:</strong><ul style="margin:6px 0 0 16px;padding:0">`;
    if (causaImed) html += `<li>Tratamento imediato: reverter ou neutralizar o efeito de "${causaImed}"</li>`;
    catComCausas.slice(0,3).forEach(([cat,causas]) => {
      html += `<li>Em ${cat}: investigar e eliminar "${causas[0]}"</li>`;
    });
    html += `</ul></div>`;

    html += `<div style="margin-bottom:12px"><strong style="color:#8b5cf6">🛡️ Ações preventivas sugeridas:</strong><ul style="margin:6px 0 0 16px;padding:0">
      <li>Revisar procedimentos operacionais relacionados ao evento</li>
      <li>Avaliar necessidade de treinamento/reciclagem da equipe envolvida</li>
      ${gravidade === 'Alta' || gravidade === 'Crítica' ? '<li>Considerar auditoria de processo na área afetada</li>' : ''}
      <li>Verificar se há outros pontos vulneráveis com o mesmo padrão</li>
    </ul></div>`;

    if (catSemCausas.length) {
      html += `<div style="background:rgba(245,158,11,0.08);border-radius:6px;padding:8px 12px;font-size:11px;color:#92400e">
        <i class="fas fa-exclamation-triangle" style="color:#d97706;margin-right:4px"></i>
        <strong>Categorias sem causas registradas (sugestão: investigar):</strong> ${catSemCausas.join(', ')}
      </div>`;
    }

    html += `<div style="margin-top:10px;padding:8px;background:rgba(139,92,246,0.06);border-radius:6px;font-size:11px;color:var(--text-muted)">
      <i class="fas fa-info-circle" style="color:#8b5cf6;margin-right:4px"></i>
      Esta análise foi gerada com base nas informações preenchidas no formulário. Não representa diagnóstico definitivo.
      A causa raiz deve ser validada pela equipe de investigação antes do encerramento.
    </div>`;

    if (conteudo) conteudo.innerHTML = html;
    if (dataEl) dataEl.textContent = new Date().toLocaleString('pt-BR');
    if (resultado) resultado.style.display = 'block';
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-sync"></i> Atualizar Análise'; }
  }, 1200);
}

function crSalvarAnalise(analiseId, incidenteId) {
  const descricao = document.getElementById('cr_descricao')?.value.trim() || '';
  if (!descricao) {
    showToast('Preencha a descrição do problema antes de salvar.', 'error');
    crMudarAba(0, document.querySelectorAll('.cr-tab')[0]);
    return;
  }

  const categorias = _crGetCategorias();
  const categoriasIshikawa = {};
  categorias.forEach(cat => {
    const inputs = document.querySelectorAll(`#cr_causas_${cat.id} .cr-causa-input`);
    const vals = Array.from(inputs).map(i => i.value.trim()).filter(Boolean);
    if (vals.length) categoriasIshikawa[cat.id] = vals;
  });

  const acoes = [];
  document.querySelectorAll('.cr-acao-row').forEach(row => {
    const desc = row.querySelector('.cr-acao-desc')?.value.trim();
    if (desc) acoes.push({
      descricao: desc,
      tipo:        row.querySelector('.cr-acao-tipo')?.value || 'Corretiva',
      responsavel: row.querySelector('.cr-acao-resp')?.value.trim() || '',
      prazo:       row.querySelector('.cr-acao-prazo')?.value || '',
      status:      row.querySelector('.cr-acao-status')?.value || 'Pendente'
    });
  });

  const lista = _getCausaRaizList();
  const existIdx = lista.findIndex(a => a.id === analiseId);
  const nova = {
    id:                  analiseId,
    data_abertura:       document.getElementById('cr_data')?.value || new Date().toISOString().split('T')[0],
    evento_origem:       document.getElementById('cr_evento')?.value || incidenteId || '',
    responsavel:         document.getElementById('cr_responsavel')?.value || '',
    area:                document.getElementById('cr_area')?.value || '',
    gravidade:           document.getElementById('cr_gravidade')?.value || 'Média',
    prazo:               document.getElementById('cr_prazo')?.value || '',
    status:              document.getElementById('cr_status')?.value || 'Em Investigação',
    descricao_problema:  descricao,
    efeito_observado:    document.getElementById('cr_efeito')?.value.trim() || '',
    causa_imediata:      document.getElementById('cr_causa_imediata')?.value.trim() || '',
    categorias_ishikawa: categoriasIshikawa,
    causa_raiz_validada: document.getElementById('cr_causa_raiz')?.value.trim() || '',
    validado_por:        document.getElementById('cr_validado_por')?.value.trim() || '',
    data_validacao:      document.getElementById('cr_data_validacao')?.value || '',
    acoes,
    evidencias:          document.getElementById('cr_evidencias')?.value.trim() || '',
    criado_por:          currentUser?.name || '',
    atualizado_em:       new Date().toISOString(),
    historico: [{
      acao: existIdx >= 0 ? 'Análise atualizada' : 'Análise criada',
      usuario: currentUser?.name || '—',
      data: new Date().toLocaleString('pt-BR')
    }]
  };

  if (existIdx >= 0) {
    nova.historico = [...(lista[existIdx].historico||[]), ...nova.historico];
    lista[existIdx] = nova;
  } else {
    lista.unshift(nova);
  }
  _saveCausaRaizList(lista);

  // Se a análise tem causa raiz validada e ações, gera alerta de plano de ação
  if (nova.causa_raiz_validada && acoes.length > 0 && nova.status !== 'Encerrada') {
    showToast(`✅ Análise ${analiseId} salva! ${acoes.length} ação(ões) registrada(s). Acompanhe o plano de ação.`, 'success', 5000);
  } else {
    showToast(`✅ Análise ${analiseId} salva com sucesso.`, 'success');
  }

  logAction && logAction('Causa Raiz', 'SSMA', `Análise ${analiseId} salva — ${nova.status}`);
  closeModal();
  if (typeof renderSSMA === 'function') {
    renderSSMA();
    setTimeout(() => ssMudarAba('causa_raiz', document.querySelector('.ss-tab[onclick*="causa_raiz"]')), 100);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  DIAGRAMA ISHIKAWA — Visualização SVG Interativa
// ═══════════════════════════════════════════════════════════════════════════

function crAbrirDiagramaIshikawa(analiseId) {
  const analise = _getCausaRaizList().find(a => a.id === analiseId);
  const categorias = _crGetCategorias();

  // Causas da análise ou do modal aberto
  const catData = {};
  categorias.forEach(cat => {
    const fromAnalise = analise?.categorias_ishikawa?.[cat.id] || [];
    // Tenta capturar do modal se estiver aberto
    const inputs = document.querySelectorAll(`#cr_causas_${cat.id} .cr-causa-input`);
    const fromModal = Array.from(inputs).map(i => i.value.trim()).filter(Boolean);
    catData[cat.id] = fromModal.length ? fromModal : fromAnalise;
  });

  const problema = analise?.descricao_problema ||
    document.getElementById('cr_descricao')?.value?.trim() || 'Efeito / Problema';

  openModalWide(`Diagrama de Ishikawa — ${analiseId||'Análise'}`, `
    <div style="overflow:auto;max-height:80vh">
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px;text-align:center">
        Diagrama de Causa e Efeito (Espinha de Peixe) — gerado a partir das causas registradas
      </div>
      ${_crGerarSVGIshikawa(problema, categorias, catData)}
      <div style="margin-top:14px">
        <div style="font-size:12px;font-weight:700;color:var(--text-secondary);margin-bottom:8px">
          Legenda de Categorias
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:8px">
          ${categorias.map(cat => {
            const qtd = (catData[cat.id]||[]).length;
            return `<div style="display:flex;align-items:center;gap:5px;padding:4px 10px;border-radius:6px;background:${cat.cor}18;border:1px solid ${cat.cor}44">
              <span style="width:10px;height:10px;border-radius:50%;background:${cat.cor};display:inline-block"></span>
              <span style="font-size:11px;font-weight:600;color:${cat.cor}">${cat.label}</span>
              <span style="font-size:10px;color:var(--text-muted)">(${qtd})</span>
            </div>`;
          }).join('')}
        </div>
      </div>
    </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
     <button class="btn btn-primary" onclick="crImprimirDiagrama()"><i class="fas fa-print"></i> Imprimir Diagrama</button>`
  );
}

function _crGerarSVGIshikawa(problema, categorias, catData) {
  const W = 900, H = 500;
  const espinhaY   = H / 2;
  const cabecaX    = W - 60;
  const espinhaX0  = 60;
  const corpoLen   = cabecaX - espinhaX0 - 100;

  // Dividir categorias: topo (índices pares) e base (ímpares)
  const catsTop = categorias.filter((_,i) => i % 2 === 0);
  const catsBot = categorias.filter((_,i) => i % 2 !== 0);

  const espLen = corpoLen / Math.max(catsTop.length, catsBot.length);

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" 
    style="width:100%;max-width:900px;height:auto;display:block;margin:0 auto;background:var(--bg-primary);border-radius:12px;border:1px solid var(--border-color)">
    <defs>
      <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
        <path d="M0,0 L0,6 L8,3 z" fill="#64748b"/>
      </marker>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="2" dy="2" stdDeviation="3" flood-opacity="0.2"/>
      </filter>
    </defs>

    <!-- Espinha principal -->
    <line x1="${espinhaX0}" y1="${espinhaY}" x2="${cabecaX - 10}" y2="${espinhaY}" 
      stroke="#64748b" stroke-width="3" marker-end="url(#arrow)"/>

    <!-- Caixa do efeito (cabeça) -->
    <rect x="${cabecaX - 10}" y="${espinhaY - 30}" width="70" height="60" rx="6"
      fill="rgba(239,68,68,0.15)" stroke="#ef4444" stroke-width="2" filter="url(#shadow)"/>
    <foreignObject x="${cabecaX - 8}" y="${espinhaY - 28}" width="66" height="56">
      <div xmlns="http://www.w3.org/1999/xhtml" style="font-size:9px;font-weight:700;color:#dc2626;text-align:center;word-wrap:break-word;padding:2px;line-height:1.3;display:flex;align-items:center;justify-content:center;height:100%">
        ${problema.substring(0,40)}${problema.length>40?'…':''}
      </div>
    </foreignObject>`;

  // Função para renderizar espinha
  function renderEspinha(cat, idx, total, isTop) {
    const x = espinhaX0 + (idx + 0.5) * (corpoLen / total) + 40;
    const y1 = isTop ? espinhaY - 110 : espinhaY + 110;
    const y2 = espinhaY;
    const causas = catData[cat.id] || [];

    // Linha da espinha diagonal
    svg += `<line x1="${x}" y1="${y1}" x2="${x + (isTop?50:-50)}" y2="${y2}" 
      stroke="${cat.cor}" stroke-width="2" opacity="0.8"/>`;

    // Caixa da categoria
    svg += `<rect x="${x - 48}" y="${isTop ? y1 - 28 : y1 + 2}" width="96" height="26" rx="5"
      fill="${cat.cor}22" stroke="${cat.cor}" stroke-width="1.5"/>
    <text x="${x}" y="${isTop ? y1 - 10 : y1 + 19}" text-anchor="middle" font-size="9" font-weight="700" fill="${cat.cor}"
      style="font-family:Arial,sans-serif">${cat.label.substring(0,16)}</text>`;

    // Causas como galhos
    causas.slice(0,4).forEach((causa, ci) => {
      const ox    = (ci - causas.length/2 + 0.5) * 20;
      const cx    = x + ox;
      const cy1   = isTop ? y1 + 30 + ci * 14 : y1 - 30 - ci * 14;
      const cy2   = isTop ? cy1 + 12 : cy1 - 12;
      const tx    = cx + (isTop ? 10 : 10);
      const ty    = isTop ? cy1 + 8 : cy1 - 4;

      svg += `<line x1="${cx}" y1="${y1 + (isTop?28:-28)}" x2="${cx}" y2="${cy2}"
        stroke="${cat.cor}" stroke-width="1" opacity="0.6" stroke-dasharray="3,2"/>
      <text x="${tx}" y="${ty}" font-size="8" fill="var(--text-secondary,#64748b)" 
        style="font-family:Arial,sans-serif" text-anchor="start">${causa.substring(0,18)}${causa.length>18?'…':''}</text>`;
    });

    if (causas.length > 4) {
      const extraY = isTop ? y1 + 86 : y1 - 86;
      svg += `<text x="${x}" y="${extraY}" font-size="8" fill="${cat.cor}" text-anchor="middle" opacity="0.7">+${causas.length-4} mais</text>`;
    }
  }

  catsTop.forEach((cat, i) => renderEspinha(cat, i, catsTop.length, true));
  catsBot.forEach((cat, i) => renderEspinha(cat, i, catsBot.length, false));

  svg += `</svg>`;
  return svg;
}

function crImprimirDiagrama() {
  const svgEl = document.querySelector('.modal-body svg, .modal-content svg');
  if (!svgEl) return;
  const svgStr = new XMLSerializer().serializeToString(svgEl);
  const w = window.open('','_blank');
  if (w) {
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Diagrama Ishikawa</title>
      <style>body{margin:20px;font-family:Arial,sans-serif;background:#fff}svg{max-width:100%;height:auto}</style></head>
      <body>${svgStr}
      <p style="margin-top:20px;font-size:11px;color:#999">ERP Serviços e Operações — Diagrama Ishikawa gerado em ${new Date().toLocaleString('pt-BR')}</p>
      <button onclick="window.print()" style="margin-top:10px;padding:8px 16px;background:#00b4b8;color:#fff;border:none;border-radius:6px;cursor:pointer">Imprimir / Salvar PDF</button>
      </body></html>`);
    w.document.close();
  }
}

// Adicionar botão de diagrama visual na aba Ishikawa (injeta se o modal estiver aberto)
function crInjetarBotaoDiagrama(analiseId) {
  const aba1 = document.getElementById('cr-aba-1');
  if (!aba1) return;
  const existing = aba1.querySelector('.cr-btn-diagrama');
  if (existing) return;
  const btn = document.createElement('button');
  btn.className = 'btn btn-secondary btn-sm cr-btn-diagrama';
  btn.style.cssText = 'margin-bottom:10px;float:right';
  btn.innerHTML = '<i class="fas fa-project-diagram"></i> Ver Diagrama Visual';
  btn.onclick = () => crAbrirDiagramaIshikawa(analiseId||'');
  aba1.insertBefore(btn, aba1.firstChild);
}

// Expõe globalmente
window.ssmaAbrirCausaRaiz    = ssmaAbrirCausaRaiz;
window.crMudarAba            = crMudarAba;
window.crAdicionarCausa      = crAdicionarCausa;
window.crAdicionarAcao       = crAdicionarAcao;
window.crGerarSugestaoIA     = crGerarSugestaoIA;
window.crSalvarAnalise       = crSalvarAnalise;
window.crAbrirDiagramaIshikawa = crAbrirDiagramaIshikawa;
window.crImprimirDiagrama    = crImprimirDiagrama;

// ═══════════════════════════════════════════════════════════════════════════
// ERP Serviços e Operações — Módulo Apontamento Operacional Diário
// Versão: 1.0 | Fase 1 | Competências: turno, equipe, horas, produção, custo
// ═══════════════════════════════════════════════════════════════════════════

'use strict';

/* ── Storage helpers ─────────────────────────────────────────────────────── */
function _apGet(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }
function _apSave(k, v) { localStorage.setItem(k, JSON.stringify(v)); }

function _getApontamentos()  { return _apGet('fa_apontamentos_os', []); }
function _saveApontamentos(l){ _apSave('fa_apontamentos_os', l); }

function _getOSList()   { return _apGet('fa_ordens_servico', []); }
function _getContratos(){ return _apGet('fa_contratos_cliente', []); }
function _getEquipe()   { return _apGet('fa_equipe', []); }

/* ── Formatters ─────────────────────────────────────────────────────────── */
function _apFmtDate(d) {
  if (!d) return '—';
  try { return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR'); } catch { return d; }
}
function _apFmtBRL(v) {
  return new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' }).format(Number(v)||0);
}
function _apFmtHH(h) {
  const horas = Math.floor(Number(h)||0);
  const min   = Math.round(((Number(h)||0) - horas) * 60);
  return `${horas}h${min > 0 ? String(min).padStart(2,'0') + 'm' : ''}`;
}

/* ── Badge ──────────────────────────────────────────────────────────────── */
function _apBadge(status) {
  const map = {
    'Rascunho'          : { bg:'rgba(107,114,128,0.15)',  color:'#6b7280' },
    'Aprovado'          : { bg:'rgba(34,197,94,0.12)',    color:'#16a34a' },
    'Aguardando Aprovação': { bg:'rgba(245,158,11,0.12)', color:'#d97706' },
    'Rejeitado'         : { bg:'rgba(239,68,68,0.12)',    color:'#dc2626' },
  };
  const s = map[status] || { bg:'rgba(99,102,241,0.12)', color:'#6366f1' };
  return `<span style="padding:3px 9px;border-radius:5px;font-size:10px;font-weight:700;background:${s.bg};color:${s.color}">${status||'—'}</span>`;
}

/* ── Gerar ID sequencial ────────────────────────────────────────────────── */
function _apGerarId() {
  const todos = _getApontamentos();
  const ano   = new Date().getFullYear();
  const seq   = String(todos.filter(a => (a.id||'').startsWith(`AP-${ano}`)).length + 1).padStart(4, '0');
  return `AP-${ano}-${seq}`;
}

/* ── Permissões ─────────────────────────────────────────────────────────── */
function _apPodeAprovar() {
  const r = (currentUser?.role || '').toLowerCase();
  return ['admin', 'diretor', 'supervisor', 'gerente', 'compras'].includes(r);
}
function _apPodeCriar() {
  const r = (currentUser?.role || '').toLowerCase();
  return ['admin', 'diretor', 'supervisor', 'gerente', 'compras', 'engenheiro', 'tecnico'].includes(r);
}

/* ═══════════════════════════════════════════════════════════════════════════
   RENDER PRINCIPAL
   ═══════════════════════════════════════════════════════════════════════════ */
function renderApontamento() {
  const main = document.getElementById('mainContent');
  if (!main) return;

  const todos     = _getApontamentos();
  const contratos = _getContratos();
  const osList    = _getOSList();

  // KPIs
  const totalHH       = todos.reduce((s, a) => s + (Number(a.total_hh) || 0), 0);
  const totalCusto    = todos.reduce((s, a) => s + (Number(a.custo_total) || 0), 0);
  const aprov         = todos.filter(a => a.status === 'Aprovado').length;
  const aguardando    = todos.filter(a => a.status === 'Aguardando Aprovação').length;
  const hoje          = new Date().toISOString().split('T')[0];
  const hojeCount     = todos.filter(a => a.data === hoje).length;

  main.innerHTML = `
    <div style="padding:20px 24px;max-width:1400px">

      <!-- Header -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px">
        <div>
          <h1 style="font-size:22px;font-weight:700;color:var(--text-primary);margin:0">
            <i class="fas fa-clock" style="color:var(--fa-teal);margin-right:10px"></i>
            Apontamento Operacional Diário
          </h1>
          <div style="font-size:12px;color:var(--text-muted);margin-top:4px">
            Registro de horas, equipe, produção e custos por turno
          </div>
        </div>
        ${_apPodeCriar() ? `
        <button class="btn btn-primary" onclick="apAbrir(null, null)">
          <i class="fas fa-plus"></i> Novo Apontamento
        </button>` : ''}
      </div>

      <!-- KPI Cards -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;margin-bottom:20px">
        <div class="ss-card" style="padding:16px;text-align:center">
          <div style="font-size:24px;font-weight:800;color:var(--fa-teal)">${todos.length}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:3px">Total de Apontamentos</div>
        </div>
        <div class="ss-card" style="padding:16px;text-align:center">
          <div style="font-size:24px;font-weight:800;color:#f59e0b">${hojeCount}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:3px">Hoje</div>
        </div>
        <div class="ss-card" style="padding:16px;text-align:center">
          <div style="font-size:20px;font-weight:800;color:#6366f1">${_apFmtHH(totalHH)}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:3px">HH Apontadas (total)</div>
        </div>
        <div class="ss-card" style="padding:16px;text-align:center">
          <div style="font-size:18px;font-weight:800;color:#10b981">${_apFmtBRL(totalCusto)}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:3px">Custo Registrado</div>
        </div>
        <div class="ss-card" style="padding:16px;text-align:center">
          <div style="font-size:24px;font-weight:800;color:#16a34a">${aprov}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:3px">Aprovados</div>
        </div>
        <div class="ss-card" style="padding:16px;text-align:center">
          <div style="font-size:24px;font-weight:800;color:#d97706">${aguardando}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:3px">Aguard. Aprovação</div>
        </div>
      </div>

      <!-- Filtros -->
      <div class="ss-card" style="padding:14px 16px;margin-bottom:16px">
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
          <input class="form-control" id="ap-busca" placeholder="🔍 Buscar por OS, contrato, turno, colaborador..." 
            style="max-width:320px;font-size:13px" oninput="apFiltrar()">
          <select class="form-control" id="ap-filtro-status" style="max-width:180px;font-size:13px" onchange="apFiltrar()">
            <option value="">Todos os Status</option>
            <option>Rascunho</option>
            <option>Aguardando Aprovação</option>
            <option>Aprovado</option>
            <option>Rejeitado</option>
          </select>
          <select class="form-control" id="ap-filtro-turno" style="max-width:160px;font-size:13px" onchange="apFiltrar()">
            <option value="">Todos os Turnos</option>
            <option>Diurno</option>
            <option>Vespertino</option>
            <option>Noturno</option>
            <option>12h</option>
          </select>
          <input type="date" class="form-control" id="ap-filtro-data" style="max-width:160px;font-size:13px" onchange="apFiltrar()">
          <button class="btn btn-secondary btn-sm" onclick="apLimparFiltros()">
            <i class="fas fa-times"></i> Limpar
          </button>
        </div>
      </div>

      <!-- Tabela -->
      <div class="ss-card" style="padding:0;overflow:hidden">
        <div style="overflow-x:auto">
          <table class="ss-table" id="ap-tabela">
            <thead>
              <tr>
                <th>Nº</th>
                <th>Data</th>
                <th>OS / Contrato</th>
                <th>Turno</th>
                <th>Supervisor</th>
                <th>Equipe</th>
                <th>HH Total</th>
                <th>Custo</th>
                <th>Produção</th>
                <th>Status</th>
                <th style="text-align:center">Ações</th>
              </tr>
            </thead>
            <tbody id="ap-tbody">
              ${_apRenderLinhas(todos)}
            </tbody>
          </table>
          ${todos.length === 0 ? `
          <div style="text-align:center;padding:60px;color:var(--text-muted)">
            <i class="fas fa-clock" style="font-size:36px;color:var(--fa-teal);display:block;margin-bottom:12px"></i>
            <div style="font-weight:600;font-size:15px;margin-bottom:6px">Nenhum apontamento registrado</div>
            <div style="font-size:12px;margin-bottom:16px">Registre apontamentos diários de horas, equipe e produção por OS e turno</div>
            ${_apPodeCriar() ? `<button class="btn btn-primary" onclick="apAbrir(null,null)"><i class="fas fa-plus"></i> Novo Apontamento</button>` : ''}
          </div>` : ''}
        </div>
      </div>

    </div>`;
}

/* ── Linhas da tabela ───────────────────────────────────────────────────── */
function _apRenderLinhas(lista) {
  if (!lista.length) return '';
  return lista.map(a => `
    <tr>
      <td><strong style="color:var(--fa-teal);font-size:12px">${a.id||'—'}</strong></td>
      <td style="font-size:12px">${_apFmtDate(a.data)}</td>
      <td style="font-size:12px">
        <div style="font-weight:600;color:var(--text-primary)">${a.os_numero||'—'}</div>
        <div style="color:var(--text-muted);font-size:11px">${(a.contrato_nome||'').substring(0,30)}</div>
      </td>
      <td><span style="padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;background:rgba(99,102,241,0.12);color:#6366f1">${a.turno||'—'}</span></td>
      <td style="font-size:12px">${a.supervisor||'—'}</td>
      <td style="font-size:12px;text-align:center">
        <span style="background:rgba(16,185,129,0.12);color:#059669;padding:2px 8px;border-radius:4px;font-weight:600">${(a.equipe||[]).length} col.</span>
      </td>
      <td style="font-size:12px;font-weight:700;color:#6366f1">${_apFmtHH(a.total_hh)}</td>
      <td style="font-size:12px">${_apFmtBRL(a.custo_total)}</td>
      <td style="font-size:12px;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${a.producao_descricao||''}">${(a.producao_descricao||'—').substring(0,30)}</td>
      <td>${_apBadge(a.status)}</td>
      <td style="text-align:center">
        <div style="display:flex;gap:4px;justify-content:center">
          <button class="btn btn-secondary btn-sm btn-icon" onclick="apVer('${a.id}')" title="Visualizar">
            <i class="fas fa-eye"></i>
          </button>
          ${a.status === 'Rascunho' || a.status === 'Rejeitado' ? `
          <button class="btn btn-secondary btn-sm btn-icon" onclick="apAbrir('${a.id}', null)" title="Editar">
            <i class="fas fa-edit"></i>
          </button>` : ''}
          ${_apPodeAprovar() && a.status === 'Aguardando Aprovação' ? `
          <button class="btn btn-primary btn-sm btn-icon" onclick="apAprovar('${a.id}')" title="Aprovar" style="background:#16a34a">
            <i class="fas fa-check"></i>
          </button>
          <button class="btn btn-danger btn-sm btn-icon" onclick="apRejeitar('${a.id}')" title="Rejeitar">
            <i class="fas fa-times"></i>
          </button>` : ''}
        </div>
      </td>
    </tr>`).join('');
}

/* ── Filtrar ────────────────────────────────────────────────────────────── */
function apFiltrar() {
  const busca  = (document.getElementById('ap-busca')?.value || '').toLowerCase();
  const status = document.getElementById('ap-filtro-status')?.value || '';
  const turno  = document.getElementById('ap-filtro-turno')?.value || '';
  const data   = document.getElementById('ap-filtro-data')?.value || '';

  let lista = _getApontamentos();
  if (busca)  lista = lista.filter(a =>
    (a.id||'').toLowerCase().includes(busca) ||
    (a.os_numero||'').toLowerCase().includes(busca) ||
    (a.contrato_nome||'').toLowerCase().includes(busca) ||
    (a.supervisor||'').toLowerCase().includes(busca) ||
    (a.equipe||[]).some(e => (e.nome||'').toLowerCase().includes(busca))
  );
  if (status) lista = lista.filter(a => a.status === status);
  if (turno)  lista = lista.filter(a => a.turno === turno);
  if (data)   lista = lista.filter(a => a.data === data);

  const tbody = document.getElementById('ap-tbody');
  if (tbody) tbody.innerHTML = _apRenderLinhas(lista);
}

function apLimparFiltros() {
  ['ap-busca','ap-filtro-status','ap-filtro-turno','ap-filtro-data'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const tbody = document.getElementById('ap-tbody');
  if (tbody) tbody.innerHTML = _apRenderLinhas(_getApontamentos());
}

/* ═══════════════════════════════════════════════════════════════════════════
   MODAL DE APONTAMENTO — Formulário por abas
   ═══════════════════════════════════════════════════════════════════════════ */
function apAbrir(apontamentoId, osId) {
  const existing = apontamentoId ? _getApontamentos().find(a => a.id === apontamentoId) : null;
  const osList   = _getOSList();
  const equipe   = _getEquipe();
  const novoId   = existing?.id || _apGerarId();
  const hoje     = new Date().toISOString().split('T')[0];

  // Pré-selecionar OS se passado como parâmetro
  const osPresel = osId ? osList.find(o => o.id === osId) : null;

  /* ─ Aba 0: Identificação ─ */
  const aba0 = `
    <div class="ap-aba" id="ap-aba-0" style="display:block">
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px">
        <div>
          <label class="form-label-sm">Nº do Apontamento</label>
          <input class="form-control" id="ap_id" value="${novoId}" readonly style="background:var(--bg-tertiary)">
        </div>
        <div>
          <label class="form-label-sm">Data *</label>
          <input class="form-control" id="ap_data" type="date" value="${existing?.data||hoje}">
        </div>
        <div>
          <label class="form-label-sm">Turno *</label>
          <select class="form-control" id="ap_turno">
            ${['Diurno','Vespertino','Noturno','12h'].map(t =>
              `<option ${(existing?.turno||'Diurno')===t?'selected':''}>${t}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="form-label-sm">Ordem de Serviço *</label>
          <select class="form-control" id="ap_os" onchange="apOnChangeOS(this)">
            <option value="">Selecione a OS...</option>
            ${osList.map(o => `<option value="${o.id}" ${(existing?.os_id||osId)===o.id?'selected':''}>${o.numero||o.id} — ${(o.descricao||o.titulo||'').substring(0,40)}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="form-label-sm">Contrato</label>
          <input class="form-control" id="ap_contrato" value="${existing?.contrato_nome||osPresel?.contrato||''}" readonly style="background:var(--bg-tertiary)">
        </div>
        <div>
          <label class="form-label-sm">Supervisor *</label>
          <input class="form-control" id="ap_supervisor" value="${existing?.supervisor||currentUser?.name||''}" placeholder="Nome do supervisor de turno">
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div>
          <label class="form-label-sm">Condição Climática</label>
          <select class="form-control" id="ap_clima">
            ${['Bom','Nublado','Chuva Leve','Chuva Intensa','Neblina','Vento Forte'].map(c =>
              `<option ${(existing?.clima||'Bom')===c?'selected':''}>${c}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="form-label-sm">Status</label>
          <select class="form-control" id="ap_status">
            ${['Rascunho','Aguardando Aprovação'].map(s =>
              `<option ${(existing?.status||'Rascunho')===s?'selected':''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>
    </div>`;

  /* ─ Aba 1: Equipe & HH ─ */
  const membrosSeed = existing?.equipe || [{ nome:'', cargo:'', hh_normal:8, hh_extra:0, valor_hh:0 }];
  const aba1 = `
    <div class="ap-aba" id="ap-aba-1" style="display:none">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div style="font-size:13px;font-weight:700;color:var(--text-primary)">
          <i class="fas fa-users" style="color:#6366f1;margin-right:6px"></i>Equipe Alocada no Turno
        </div>
        <button onclick="apAddMembro()" class="btn btn-primary btn-sm"><i class="fas fa-plus"></i> Adicionar Membro</button>
      </div>
      <div id="ap_equipe_lista">
        ${membrosSeed.map((m, i) => _apRenderMembroRow(m, i)).join('')}
      </div>
      <div style="margin-top:14px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;padding:12px;background:rgba(99,102,241,0.06);border-radius:8px;border:1px solid rgba(99,102,241,0.2)">
        <div style="text-align:center">
          <div style="font-size:10px;color:var(--text-muted)">Total HH Normal</div>
          <div id="ap_total_hh_normal" style="font-size:18px;font-weight:800;color:#6366f1">0h</div>
        </div>
        <div style="text-align:center">
          <div style="font-size:10px;color:var(--text-muted)">Total HH Extra</div>
          <div id="ap_total_hh_extra" style="font-size:18px;font-weight:800;color:#f59e0b">0h</div>
        </div>
        <div style="text-align:center">
          <div style="font-size:10px;color:var(--text-muted)">Custo Total MO</div>
          <div id="ap_total_custo_mo" style="font-size:18px;font-weight:800;color:#10b981">R$ 0,00</div>
        </div>
      </div>
    </div>`;

  /* ─ Aba 2: Atividades & Produção ─ */
  const atividadesSeed = existing?.atividades || [{ descricao:'', un:'m²', qtd_prevista:0, qtd_realizada:0 }];
  const aba2 = `
    <div class="ap-aba" id="ap-aba-2" style="display:none">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div style="font-size:13px;font-weight:700;color:var(--text-primary)">
          <i class="fas fa-tasks" style="color:#10b981;margin-right:6px"></i>Atividades Executadas
        </div>
        <button onclick="apAddAtividade()" class="btn btn-primary btn-sm"><i class="fas fa-plus"></i> Adicionar Atividade</button>
      </div>
      <div id="ap_atividades_lista">
        ${atividadesSeed.map((a, i) => _apRenderAtividadeRow(a, i)).join('')}
      </div>
      <div style="margin-top:16px">
        <label class="form-label-sm">Descrição da Produção / Relatório Resumido</label>
        <textarea class="form-control" id="ap_producao_descricao" rows="3" 
          placeholder="Descreva o que foi executado no turno, dificuldades, pendências...">${existing?.producao_descricao||''}</textarea>
      </div>
      <div style="margin-top:10px;display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div>
          <label class="form-label-sm">% Previsto Acumulado</label>
          <input class="form-control" id="ap_pct_previsto" type="number" min="0" max="100" step="0.1" value="${existing?.pct_previsto||0}" placeholder="Ex: 45.5">
        </div>
        <div>
          <label class="form-label-sm">% Realizado Acumulado</label>
          <input class="form-control" id="ap_pct_realizado" type="number" min="0" max="100" step="0.1" value="${existing?.pct_realizado||0}" placeholder="Ex: 43.2">
        </div>
      </div>
    </div>`;

  /* ─ Aba 3: Equipamentos & Materiais ─ */
  const equipSeed = existing?.equipamentos || [];
  const matSeed   = existing?.materiais || [];
  const aba3 = `
    <div class="ap-aba" id="ap-aba-3" style="display:none">
      <div style="margin-bottom:16px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
          <div style="font-size:13px;font-weight:700;color:var(--text-primary)">
            <i class="fas fa-cogs" style="color:#f59e0b;margin-right:6px"></i>Equipamentos Utilizados
          </div>
          <button onclick="apAddEquipamento()" class="btn btn-secondary btn-sm"><i class="fas fa-plus"></i> Adicionar</button>
        </div>
        <div id="ap_equip_lista">
          ${equipSeed.map((e, i) => _apRenderEquipRow(e, i)).join('')}
          ${!equipSeed.length ? `<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:12px">Nenhum equipamento. Clique em "Adicionar".</div>` : ''}
        </div>
      </div>
      <div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
          <div style="font-size:13px;font-weight:700;color:var(--text-primary)">
            <i class="fas fa-box" style="color:#10b981;margin-right:6px"></i>Materiais Consumidos
          </div>
          <button onclick="apAddMaterial()" class="btn btn-secondary btn-sm"><i class="fas fa-plus"></i> Adicionar</button>
        </div>
        <div id="ap_mat_lista">
          ${matSeed.map((m, i) => _apRenderMatRow(m, i)).join('')}
          ${!matSeed.length ? `<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:12px">Nenhum material. Clique em "Adicionar".</div>` : ''}
        </div>
      </div>
    </div>`;

  /* ─ Aba 4: SSMA & Ocorrências ─ */
  const aba4 = `
    <div class="ap-aba" id="ap-aba-4" style="display:none">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
        <div>
          <label class="form-label-sm">DDS Realizado? *</label>
          <select class="form-control" id="ap_dds">
            <option ${(existing?.dds||'Sim')==='Sim'?'selected':''}>Sim</option>
            <option ${(existing?.dds||'')==='Não'?'selected':''}>Não</option>
            <option ${(existing?.dds||'')==='Parcial'?'selected':''}>Parcial</option>
          </select>
        </div>
        <div>
          <label class="form-label-sm">Uso de EPI Verificado?</label>
          <select class="form-control" id="ap_epi">
            <option ${(existing?.epi||'Sim')==='Sim'?'selected':''}>Sim</option>
            <option ${(existing?.epi||'')==='Não'?'selected':''}>Não</option>
            <option ${(existing?.epi||'')==='Parcial'?'selected':''}>Parcial</option>
          </select>
        </div>
        <div>
          <label class="form-label-sm">Houve Ocorrência SSMA?</label>
          <select class="form-control" id="ap_ocorrencia_ssma" onchange="apToggleOcorrencia(this.value)">
            <option ${(existing?.ocorrencia_ssma||'Não')==='Não'?'selected':''}>Não</option>
            <option ${(existing?.ocorrencia_ssma||'')==='Sim'?'selected':''}>Sim</option>
          </select>
        </div>
        <div>
          <label class="form-label-sm">Nº Trabalhadores sem Acidente</label>
          <input class="form-control" id="ap_sem_acidente" type="number" min="0" value="${existing?.sem_acidente||0}">
        </div>
      </div>
      <div id="ap_ocorrencia_detalhe" style="display:${(existing?.ocorrencia_ssma||'Não')==='Sim'?'block':'none'}">
        <label class="form-label-sm">Descrição da Ocorrência SSMA</label>
        <textarea class="form-control" id="ap_ocorrencia_desc" rows="3" 
          placeholder="Descreva o tipo, local, envolvidos e ações imediatas tomadas...">${existing?.ocorrencia_desc||''}</textarea>
        <div style="margin-top:8px;padding:8px 12px;background:rgba(239,68,68,0.07);border:1px solid rgba(239,68,68,.2);border-radius:6px;font-size:11px;color:#dc2626">
          <i class="fas fa-exclamation-triangle" style="margin-right:4px"></i>
          Registre também o incidente no módulo SSMA para acompanhamento com plano de ação corretiva.
        </div>
      </div>
      <div style="margin-top:12px">
        <label class="form-label-sm">Observações Gerais do Turno</label>
        <textarea class="form-control" id="ap_observacoes" rows="4" 
          placeholder="Pendências, interferências, necessidades de material, comunicados para o próximo turno...">${existing?.observacoes||''}</textarea>
      </div>
    </div>`;

  /* ─ Montar modal ─ */
  const tabsHtml = ['Identificação','Equipe & HH','Atividades','Equip. / Materiais','SSMA & Obs'].map((t, i) => `
    <button onclick="apMudarAba(${i},this)" class="ap-tab${i===0?' ap-tab-active':''}"
      style="padding:7px 13px;font-size:12px;font-weight:600;border:none;background:none;cursor:pointer;
      border-bottom:3px solid ${i===0?'var(--fa-teal)':'transparent'};
      color:${i===0?'var(--fa-teal)':'var(--text-muted)'};border-radius:4px 4px 0 0;transition:.15s">
      ${t}
    </button>`).join('');

  openModalWide(`${existing ? 'Editar' : 'Novo'} Apontamento — ${novoId}`, `
    <div style="max-height:80vh;overflow-y:auto;padding-right:4px">
      <style>
        .ap-tab { }
        .ap-tab-active { color:var(--fa-teal)!important; border-bottom-color:var(--fa-teal)!important }
        .ap-aba { display:none }
        .form-label-sm { font-size:11px; color:var(--text-muted); display:block; margin-bottom:4px; font-weight:600 }
      </style>
      <div style="display:flex;gap:2px;flex-wrap:wrap;border-bottom:2px solid var(--border-color);margin-bottom:16px">
        ${tabsHtml}
      </div>
      ${aba0}${aba1}${aba2}${aba3}${aba4}
    </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
     <button class="btn btn-secondary" onclick="apSalvar('${novoId}','${existing?.id||''}','rascunho')">
       <i class="fas fa-save"></i> Salvar Rascunho
     </button>
     <button class="btn btn-primary" onclick="apSalvar('${novoId}','${existing?.id||''}','enviar')">
       <i class="fas fa-paper-plane"></i> Enviar para Aprovação
     </button>`
  );

  // Recalcular totais ao abrir em edição
  setTimeout(() => apCalcTotaisEquipe(), 100);
}

/* ── Auto-preencher contrato ao mudar OS ────────────────────────────────── */
function apOnChangeOS(sel) {
  const osId     = sel.value;
  const osList   = _getOSList();
  const os       = osList.find(o => o.id === osId);
  const contEl   = document.getElementById('ap_contrato');
  if (contEl) contEl.value = os?.contrato || os?.contrato_nome || '';
}

/* ── Toggle ocorrência ──────────────────────────────────────────────────── */
function apToggleOcorrencia(val) {
  const d = document.getElementById('ap_ocorrencia_detalhe');
  if (d) d.style.display = val === 'Sim' ? 'block' : 'none';
}

/* ── Abas ───────────────────────────────────────────────────────────────── */
function apMudarAba(idx, btn) {
  document.querySelectorAll('.ap-aba').forEach((a, i) => a.style.display = i === idx ? 'block' : 'none');
  document.querySelectorAll('.ap-tab').forEach(b => {
    b.classList.remove('ap-tab-active');
    b.style.color = 'var(--text-muted)';
    b.style.borderBottomColor = 'transparent';
  });
  if (btn) {
    btn.classList.add('ap-tab-active');
    btn.style.color = 'var(--fa-teal)';
    btn.style.borderBottomColor = 'var(--fa-teal)';
  }
}

/* ── Render row: Membro da equipe ───────────────────────────────────────── */
function _apRenderMembroRow(m, idx) {
  return `
    <div class="ap-membro-row" style="display:grid;grid-template-columns:2fr 1.5fr 0.8fr 0.8fr 1fr auto;gap:8px;align-items:end;margin-bottom:8px;background:var(--bg-card2);padding:10px;border-radius:8px;border:1px solid var(--border-color)">
      <div>
        <label style="font-size:10px;color:var(--text-muted)">Nome *</label>
        <input class="form-control ap-membro-nome" value="${m.nome||''}" style="font-size:12px" placeholder="Nome do colaborador" oninput="apCalcTotaisEquipe()">
      </div>
      <div>
        <label style="font-size:10px;color:var(--text-muted)">Cargo / Função</label>
        <input class="form-control ap-membro-cargo" value="${m.cargo||''}" style="font-size:12px" placeholder="Cargo">
      </div>
      <div>
        <label style="font-size:10px;color:var(--text-muted)">HH Normal</label>
        <input class="form-control ap-membro-hh-normal" type="number" min="0" step="0.5" value="${m.hh_normal||8}" style="font-size:12px" oninput="apCalcTotaisEquipe()">
      </div>
      <div>
        <label style="font-size:10px;color:var(--text-muted)">HH Extra</label>
        <input class="form-control ap-membro-hh-extra" type="number" min="0" step="0.5" value="${m.hh_extra||0}" style="font-size:12px" oninput="apCalcTotaisEquipe()">
      </div>
      <div>
        <label style="font-size:10px;color:var(--text-muted)">Valor HH (R$)</label>
        <input class="form-control ap-membro-valor" type="number" min="0" step="0.01" value="${m.valor_hh||0}" style="font-size:12px" oninput="apCalcTotaisEquipe()">
      </div>
      <div style="padding-top:18px">
        <button onclick="this.closest('.ap-membro-row').remove();apCalcTotaisEquipe()" class="btn btn-danger btn-sm btn-icon"><i class="fas fa-times"></i></button>
      </div>
    </div>`;
}

function apAddMembro() {
  const lista = document.getElementById('ap_equipe_lista');
  if (!lista) return;
  const idx  = lista.querySelectorAll('.ap-membro-row').length;
  const div  = document.createElement('div');
  div.innerHTML = _apRenderMembroRow({}, idx);
  lista.appendChild(div.firstElementChild);
  apCalcTotaisEquipe();
}

function apCalcTotaisEquipe() {
  let hhNorm = 0, hhExtra = 0, custo = 0;
  document.querySelectorAll('.ap-membro-row').forEach(row => {
    const hn = parseFloat(row.querySelector('.ap-membro-hh-normal')?.value) || 0;
    const he = parseFloat(row.querySelector('.ap-membro-hh-extra')?.value) || 0;
    const vh = parseFloat(row.querySelector('.ap-membro-valor')?.value) || 0;
    hhNorm  += hn;
    hhExtra += he;
    custo   += (hn + he * 1.5) * vh;
  });
  const elN = document.getElementById('ap_total_hh_normal');
  const elE = document.getElementById('ap_total_hh_extra');
  const elC = document.getElementById('ap_total_custo_mo');
  if (elN) elN.textContent = _apFmtHH(hhNorm);
  if (elE) elE.textContent = _apFmtHH(hhExtra);
  if (elC) elC.textContent = _apFmtBRL(custo);
}

/* ── Render row: Atividade ──────────────────────────────────────────────── */
function _apRenderAtividadeRow(a, idx) {
  return `
    <div class="ap-atividade-row" style="display:grid;grid-template-columns:2fr 0.8fr 1fr 1fr auto;gap:8px;align-items:end;margin-bottom:8px;background:var(--bg-card2);padding:10px;border-radius:8px;border:1px solid var(--border-color)">
      <div>
        <label style="font-size:10px;color:var(--text-muted)">Atividade / Descrição *</label>
        <input class="form-control" value="${a.descricao||''}" style="font-size:12px" placeholder="Ex: Concretagem laje, Montagem estrutural...">
      </div>
      <div>
        <label style="font-size:10px;color:var(--text-muted)">UN</label>
        <input class="form-control" value="${a.un||'m²'}" style="font-size:12px" placeholder="m², m³, un">
      </div>
      <div>
        <label style="font-size:10px;color:var(--text-muted)">Qtd Prevista</label>
        <input class="form-control" type="number" min="0" step="0.01" value="${a.qtd_prevista||0}" style="font-size:12px">
      </div>
      <div>
        <label style="font-size:10px;color:var(--text-muted)">Qtd Realizada</label>
        <input class="form-control" type="number" min="0" step="0.01" value="${a.qtd_realizada||0}" style="font-size:12px">
      </div>
      <div style="padding-top:18px">
        <button onclick="this.closest('.ap-atividade-row').remove()" class="btn btn-danger btn-sm btn-icon"><i class="fas fa-times"></i></button>
      </div>
    </div>`;
}

function apAddAtividade() {
  const lista = document.getElementById('ap_atividades_lista');
  if (!lista) return;
  const idx  = lista.querySelectorAll('.ap-atividade-row').length;
  const div  = document.createElement('div');
  div.innerHTML = _apRenderAtividadeRow({}, idx);
  lista.appendChild(div.firstElementChild);
}

/* ── Render row: Equipamento ────────────────────────────────────────────── */
function _apRenderEquipRow(e, idx) {
  return `
    <div class="ap-equip-row" style="display:grid;grid-template-columns:2fr 1fr 1fr auto;gap:8px;align-items:end;margin-bottom:8px;background:var(--bg-card2);padding:10px;border-radius:8px;border:1px solid var(--border-color)">
      <div>
        <label style="font-size:10px;color:var(--text-muted)">Equipamento *</label>
        <input class="form-control" value="${e.descricao||''}" style="font-size:12px" placeholder="Ex: Escavadeira PC200, Caminhão Munck...">
      </div>
      <div>
        <label style="font-size:10px;color:var(--text-muted)">Horas de Uso</label>
        <input class="form-control" type="number" min="0" step="0.5" value="${e.horas||0}" style="font-size:12px">
      </div>
      <div>
        <label style="font-size:10px;color:var(--text-muted)">Status</label>
        <select class="form-control" style="font-size:12px">
          ${['Operando','Parado','Em Manutenção'].map(s =>
            `<option ${(e.status||'Operando')===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </div>
      <div style="padding-top:18px">
        <button onclick="this.closest('.ap-equip-row').remove()" class="btn btn-danger btn-sm btn-icon"><i class="fas fa-times"></i></button>
      </div>
    </div>`;
}

function apAddEquipamento() {
  const lista = document.getElementById('ap_equip_lista');
  if (!lista) return;
  const div  = document.createElement('div');
  div.innerHTML = _apRenderEquipRow({}, lista.querySelectorAll('.ap-equip-row').length);
  lista.appendChild(div.firstElementChild);
}

/* ── Render row: Material ───────────────────────────────────────────────── */
function _apRenderMatRow(m, idx) {
  return `
    <div class="ap-mat-row" style="display:grid;grid-template-columns:2fr 0.8fr 1fr 1fr auto;gap:8px;align-items:end;margin-bottom:8px;background:var(--bg-card2);padding:10px;border-radius:8px;border:1px solid var(--border-color)">
      <div>
        <label style="font-size:10px;color:var(--text-muted)">Material *</label>
        <input class="form-control" value="${m.descricao||''}" style="font-size:12px" placeholder="Descrição do material consumido">
      </div>
      <div>
        <label style="font-size:10px;color:var(--text-muted)">UN</label>
        <input class="form-control" value="${m.un||'un'}" style="font-size:12px" placeholder="un, kg, m">
      </div>
      <div>
        <label style="font-size:10px;color:var(--text-muted)">Qtd Consumida</label>
        <input class="form-control" type="number" min="0" step="0.01" value="${m.qtd||0}" style="font-size:12px">
      </div>
      <div>
        <label style="font-size:10px;color:var(--text-muted)">Valor Unit (R$)</label>
        <input class="form-control" type="number" min="0" step="0.01" value="${m.valor_unit||0}" style="font-size:12px">
      </div>
      <div style="padding-top:18px">
        <button onclick="this.closest('.ap-mat-row').remove()" class="btn btn-danger btn-sm btn-icon"><i class="fas fa-times"></i></button>
      </div>
    </div>`;
}

function apAddMaterial() {
  const lista = document.getElementById('ap_mat_lista');
  if (!lista) return;
  const div  = document.createElement('div');
  div.innerHTML = _apRenderMatRow({}, lista.querySelectorAll('.ap-mat-row').length);
  lista.appendChild(div.firstElementChild);
}

/* ═══════════════════════════════════════════════════════════════════════════
   SALVAR APONTAMENTO
   ═══════════════════════════════════════════════════════════════════════════ */
function apSalvar(novoId, existingId, acao) {
  // Coletar campos Aba 0
  const data       = document.getElementById('ap_data')?.value?.trim() || '';
  const turno      = document.getElementById('ap_turno')?.value || '';
  const osId       = document.getElementById('ap_os')?.value || '';
  const contratoNm = document.getElementById('ap_contrato')?.value || '';
  const supervisor = document.getElementById('ap_supervisor')?.value?.trim() || '';
  const clima      = document.getElementById('ap_clima')?.value || '';
  let   statusVal  = document.getElementById('ap_status')?.value || 'Rascunho';

  if (acao === 'enviar') statusVal = 'Aguardando Aprovação';

  // Validações
  const erros = [];
  if (!data)      erros.push('Data é obrigatória');
  if (!turno)     erros.push('Turno é obrigatório');
  if (!osId)      erros.push('Selecione a Ordem de Serviço');
  if (!supervisor) erros.push('Supervisor é obrigatório');

  // Equipe
  const equipe = [];
  document.querySelectorAll('.ap-membro-row').forEach(row => {
    const nome = row.querySelector('.ap-membro-nome')?.value?.trim() || '';
    if (!nome) return;
    equipe.push({
      nome,
      cargo:     row.querySelector('.ap-membro-cargo')?.value?.trim() || '',
      hh_normal: parseFloat(row.querySelector('.ap-membro-hh-normal')?.value) || 0,
      hh_extra:  parseFloat(row.querySelector('.ap-membro-hh-extra')?.value) || 0,
      valor_hh:  parseFloat(row.querySelector('.ap-membro-valor')?.value) || 0,
    });
  });
  if (!equipe.length && acao === 'enviar') erros.push('Informe ao menos um membro da equipe');

  if (erros.length) {
    showToast('⚠️ ' + erros.join(' | '), 'error');
    return;
  }

  // Calcular totais de HH e custo MO
  let totalHHNormal = 0, totalHHExtra = 0, custoMO = 0;
  equipe.forEach(m => {
    totalHHNormal += m.hh_normal;
    totalHHExtra  += m.hh_extra;
    custoMO       += (m.hh_normal + m.hh_extra * 1.5) * m.valor_hh;
  });

  // Atividades
  const atividades = [];
  document.querySelectorAll('.ap-atividade-row').forEach(row => {
    const inputs = row.querySelectorAll('input,select');
    const desc = inputs[0]?.value?.trim() || '';
    if (!desc) return;
    atividades.push({
      descricao:    desc,
      un:           inputs[1]?.value || 'm²',
      qtd_prevista: parseFloat(inputs[2]?.value) || 0,
      qtd_realizada: parseFloat(inputs[3]?.value) || 0,
    });
  });

  // Equipamentos
  const equipamentos = [];
  document.querySelectorAll('.ap-equip-row').forEach(row => {
    const inputs = row.querySelectorAll('input,select');
    const desc = inputs[0]?.value?.trim() || '';
    if (!desc) return;
    equipamentos.push({
      descricao: desc,
      horas:     parseFloat(inputs[1]?.value) || 0,
      status:    inputs[2]?.value || 'Operando',
    });
  });

  // Materiais
  const materiais = [];
  let custoMat = 0;
  document.querySelectorAll('.ap-mat-row').forEach(row => {
    const inputs = row.querySelectorAll('input,select');
    const desc = inputs[0]?.value?.trim() || '';
    if (!desc) return;
    const qtd = parseFloat(inputs[2]?.value) || 0;
    const vun = parseFloat(inputs[3]?.value) || 0;
    custoMat += qtd * vun;
    materiais.push({ descricao: desc, un: inputs[1]?.value || 'un', qtd, valor_unit: vun });
  });

  // SSMA
  const dds            = document.getElementById('ap_dds')?.value || 'Sim';
  const epi            = document.getElementById('ap_epi')?.value || 'Sim';
  const ocorrenciaSsma = document.getElementById('ap_ocorrencia_ssma')?.value || 'Não';
  const ocorrenciaDesc = document.getElementById('ap_ocorrencia_desc')?.value?.trim() || '';
  const semAcidente    = parseInt(document.getElementById('ap_sem_acidente')?.value) || 0;
  const observacoes    = document.getElementById('ap_observacoes')?.value?.trim() || '';
  const producaoDesc   = document.getElementById('ap_producao_descricao')?.value?.trim() || '';
  const pctPrevisto    = parseFloat(document.getElementById('ap_pct_previsto')?.value) || 0;
  const pctRealizado   = parseFloat(document.getElementById('ap_pct_realizado')?.value) || 0;

  // OS info
  const osList = _getOSList();
  const os     = osList.find(o => o.id === osId);

  const custoTotal = custoMO + custoMat;

  const novoAp = {
    id:                novoId,
    data,
    turno,
    os_id:             osId,
    os_numero:         os?.numero || os?.id || osId,
    contrato_nome:     contratoNm || os?.contrato || '',
    supervisor,
    clima,
    equipe,
    atividades,
    equipamentos,
    materiais,
    producao_descricao: producaoDesc,
    pct_previsto:      pctPrevisto,
    pct_realizado:     pctRealizado,
    total_hh:          totalHHNormal + totalHHExtra,
    total_hh_normal:   totalHHNormal,
    total_hh_extra:    totalHHExtra,
    custo_mo:          custoMO,
    custo_materiais:   custoMat,
    custo_total:       custoTotal,
    dds,
    epi,
    ocorrencia_ssma:   ocorrenciaSsma,
    ocorrencia_desc:   ocorrenciaDesc,
    sem_acidente:      semAcidente,
    observacoes,
    status:            statusVal,
    criado_por:        currentUser?.id || '',
    criado_por_nome:   currentUser?.name || '',
    criado_em:         existingId ? undefined : new Date().toISOString(),
    atualizado_em:     new Date().toISOString(),
    historico:         [{ acao: statusVal === 'Aguardando Aprovação' ? 'Enviado para aprovação' : 'Rascunho salvo',
                         por: currentUser?.name || '', em: new Date().toISOString() }],
  };

  // Salvar
  let todos = _getApontamentos();
  if (existingId) {
    const idx = todos.findIndex(a => a.id === existingId);
    if (idx >= 0) {
      novoAp.criado_em = todos[idx].criado_em;
      novoAp.historico = [...(todos[idx].historico || []), ...novoAp.historico];
      todos[idx] = novoAp;
    } else {
      todos.unshift(novoAp);
    }
  } else {
    todos.unshift(novoAp);
  }
  _saveApontamentos(todos);

  // Também atualizar fa_apontamentos_os (formato legado)
  const legado = _apGet('fa_apontamentos_os', {});
  if (typeof legado === 'object' && !Array.isArray(legado)) {
    if (!legado[osId]) legado[osId] = [];
    const legIdx = legado[osId].findIndex(x => x.id === novoId);
    const legItem = { id: novoId, os_id: osId, data, turno, supervisor, total_hh: novoAp.total_hh, custo_total: custoTotal };
    if (legIdx >= 0) legado[osId][legIdx] = legItem; else legado[osId].push(legItem);
    _apSave('fa_apontamentos_os', legado);
  }

  closeModal();
  showToast(statusVal === 'Aguardando Aprovação' ? '✅ Apontamento enviado para aprovação!' : '💾 Rascunho salvo!', 'success');
  renderApontamento();
}

/* ═══════════════════════════════════════════════════════════════════════════
   VER APONTAMENTO (read-only)
   ═══════════════════════════════════════════════════════════════════════════ */
function apVer(id) {
  const a = _getApontamentos().find(x => x.id === id);
  if (!a) return;

  const equipHtml = (a.equipe || []).map(m => `
    <tr>
      <td style="font-size:12px">${m.nome}</td>
      <td style="font-size:12px">${m.cargo||'—'}</td>
      <td style="font-size:12px;text-align:center">${_apFmtHH(m.hh_normal)}</td>
      <td style="font-size:12px;text-align:center">${_apFmtHH(m.hh_extra)}</td>
      <td style="font-size:12px;text-align:right">${_apFmtBRL(m.valor_hh)}/h</td>
    </tr>`).join('');

  const atividHtml = (a.atividades || []).map(at => `
    <tr>
      <td style="font-size:12px">${at.descricao}</td>
      <td style="font-size:12px;text-align:center">${at.un}</td>
      <td style="font-size:12px;text-align:center">${at.qtd_prevista}</td>
      <td style="font-size:12px;text-align:center">${at.qtd_realizada}</td>
      <td style="font-size:12px;text-align:center;color:${at.qtd_realizada >= at.qtd_prevista ? '#16a34a':'#dc2626'}">
        ${at.qtd_prevista > 0 ? Math.round(at.qtd_realizada/at.qtd_prevista*100) + '%' : '—'}
      </td>
    </tr>`).join('');

  openModalWide(`Apontamento ${a.id} — ${_apFmtDate(a.data)}`, `
    <div style="max-height:80vh;overflow-y:auto">
      <!-- Header info -->
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px;font-size:12px">
        <div style="background:var(--bg-card2);padding:10px;border-radius:8px">
          <div style="color:var(--text-muted);font-size:10px">OS / Contrato</div>
          <div style="font-weight:700;color:var(--fa-teal)">${a.os_numero||'—'}</div>
          <div style="color:var(--text-muted);font-size:11px">${a.contrato_nome||'—'}</div>
        </div>
        <div style="background:var(--bg-card2);padding:10px;border-radius:8px">
          <div style="color:var(--text-muted);font-size:10px">Turno / Supervisor</div>
          <div style="font-weight:700">${a.turno||'—'}</div>
          <div style="color:var(--text-muted);font-size:11px">${a.supervisor||'—'}</div>
        </div>
        <div style="background:var(--bg-card2);padding:10px;border-radius:8px">
          <div style="color:var(--text-muted);font-size:10px">HH Total / Custo</div>
          <div style="font-weight:700;color:#6366f1">${_apFmtHH(a.total_hh)}</div>
          <div style="color:var(--text-muted);font-size:11px">${_apFmtBRL(a.custo_total)}</div>
        </div>
        <div style="background:var(--bg-card2);padding:10px;border-radius:8px">
          <div style="color:var(--text-muted);font-size:10px">Status</div>
          <div style="margin-top:4px">${_apBadge(a.status)}</div>
        </div>
        <div style="background:var(--bg-card2);padding:10px;border-radius:8px">
          <div style="color:var(--text-muted);font-size:10px">DDS / EPI</div>
          <div style="font-weight:700">${a.dds||'—'} / ${a.epi||'—'}</div>
        </div>
        <div style="background:var(--bg-card2);padding:10px;border-radius:8px">
          <div style="color:var(--text-muted);font-size:10px">Clima</div>
          <div style="font-weight:700">${a.clima||'—'}</div>
        </div>
      </div>

      <!-- Progresso -->
      ${(a.pct_previsto || a.pct_realizado) ? `
      <div style="background:var(--bg-card2);padding:12px;border-radius:8px;margin-bottom:12px">
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px">Avanço Físico Acumulado</div>
        <div style="display:flex;gap:16px">
          <div style="flex:1">
            <div style="font-size:10px;color:var(--text-muted)">Previsto: ${a.pct_previsto}%</div>
            <div style="height:8px;background:var(--border-color);border-radius:4px;overflow:hidden">
              <div style="height:100%;width:${Math.min(a.pct_previsto,100)}%;background:#6366f1;border-radius:4px"></div>
            </div>
          </div>
          <div style="flex:1">
            <div style="font-size:10px;color:var(--text-muted)">Realizado: ${a.pct_realizado}%</div>
            <div style="height:8px;background:var(--border-color);border-radius:4px;overflow:hidden">
              <div style="height:100%;width:${Math.min(a.pct_realizado,100)}%;background:${a.pct_realizado>=a.pct_previsto?'#16a34a':'#dc2626'};border-radius:4px"></div>
            </div>
          </div>
        </div>
      </div>` : ''}

      <!-- Equipe -->
      ${equipHtml ? `
      <div style="margin-bottom:12px">
        <div style="font-size:12px;font-weight:700;margin-bottom:6px"><i class="fas fa-users" style="color:#6366f1;margin-right:4px"></i>Equipe (${(a.equipe||[]).length} colaboradores)</div>
        <table class="ss-table">
          <thead><tr><th>Nome</th><th>Cargo</th><th>HH Normal</th><th>HH Extra</th><th>Valor/h</th></tr></thead>
          <tbody>${equipHtml}</tbody>
        </table>
      </div>` : ''}

      <!-- Atividades -->
      ${atividHtml ? `
      <div style="margin-bottom:12px">
        <div style="font-size:12px;font-weight:700;margin-bottom:6px"><i class="fas fa-tasks" style="color:#10b981;margin-right:4px"></i>Atividades Executadas</div>
        <table class="ss-table">
          <thead><tr><th>Atividade</th><th>UN</th><th>Previsto</th><th>Realizado</th><th>%</th></tr></thead>
          <tbody>${atividHtml}</tbody>
        </table>
      </div>` : ''}

      <!-- Produção -->
      ${a.producao_descricao ? `
      <div style="margin-bottom:12px;background:var(--bg-card2);padding:12px;border-radius:8px">
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">Relatório de Produção</div>
        <div style="font-size:12px;line-height:1.6">${a.producao_descricao}</div>
      </div>` : ''}

      <!-- SSMA -->
      ${a.ocorrencia_ssma === 'Sim' ? `
      <div style="margin-bottom:12px;background:rgba(239,68,68,.07);border:1px solid rgba(239,68,68,.2);padding:12px;border-radius:8px">
        <div style="font-size:11px;font-weight:700;color:#dc2626;margin-bottom:4px"><i class="fas fa-exclamation-triangle" style="margin-right:4px"></i>Ocorrência SSMA Registrada</div>
        <div style="font-size:12px">${a.ocorrencia_desc||'—'}</div>
      </div>` : ''}

      <!-- Observações -->
      ${a.observacoes ? `
      <div style="background:var(--bg-card2);padding:12px;border-radius:8px">
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">Observações do Turno</div>
        <div style="font-size:12px;line-height:1.6">${a.observacoes}</div>
      </div>` : ''}
    </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
     ${a.status === 'Rascunho' || a.status === 'Rejeitado' ? `<button class="btn btn-primary" onclick="closeModal();apAbrir('${a.id}',null)"><i class="fas fa-edit"></i> Editar</button>` : ''}
     ${_apPodeAprovar() && a.status === 'Aguardando Aprovação' ? `
       <button class="btn btn-primary" onclick="closeModal();apAprovar('${a.id}')" style="background:#16a34a"><i class="fas fa-check"></i> Aprovar</button>
       <button class="btn btn-danger" onclick="closeModal();apRejeitar('${a.id}')"><i class="fas fa-times"></i> Rejeitar</button>` : ''}`
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   APROVAR / REJEITAR
   ═══════════════════════════════════════════════════════════════════════════ */
function apAprovar(id) {
  if (!_apPodeAprovar()) { showToast('Sem permissão para aprovar.', 'error'); return; }
  const todos = _getApontamentos();
  const idx   = todos.findIndex(a => a.id === id);
  if (idx < 0) return;
  todos[idx].status = 'Aprovado';
  todos[idx].aprovado_por  = currentUser?.name || '';
  todos[idx].aprovado_em   = new Date().toISOString();
  todos[idx].historico = [...(todos[idx].historico||[]), { acao:'Aprovado', por: currentUser?.name||'', em: new Date().toISOString() }];
  _saveApontamentos(todos);
  showToast('✅ Apontamento aprovado!', 'success');
  renderApontamento();
}

function apRejeitar(id) {
  if (!_apPodeAprovar()) { showToast('Sem permissão.', 'error'); return; }
  const motivo = prompt('Motivo da rejeição (obrigatório):');
  if (!motivo) return;
  const todos = _getApontamentos();
  const idx   = todos.findIndex(a => a.id === id);
  if (idx < 0) return;
  todos[idx].status = 'Rejeitado';
  todos[idx].motivo_rejeicao = motivo;
  todos[idx].historico = [...(todos[idx].historico||[]), { acao:`Rejeitado: ${motivo}`, por: currentUser?.name||'', em: new Date().toISOString() }];
  _saveApontamentos(todos);
  showToast('Apontamento rejeitado.', 'warning');
  renderApontamento();
}

/* ── Exports ────────────────────────────────────────────────────────────── */
window.renderApontamento    = renderApontamento;
window.apAbrir              = apAbrir;
window.apFiltrar            = apFiltrar;
window.apLimparFiltros      = apLimparFiltros;
window.apMudarAba           = apMudarAba;
window.apOnChangeOS         = apOnChangeOS;
window.apToggleOcorrencia   = apToggleOcorrencia;
window.apAddMembro          = apAddMembro;
window.apCalcTotaisEquipe   = apCalcTotaisEquipe;
window.apAddAtividade       = apAddAtividade;
window.apAddEquipamento     = apAddEquipamento;
window.apAddMaterial        = apAddMaterial;
window.apSalvar             = apSalvar;
window.apVer                = apVer;
window.apAprovar            = apAprovar;
window.apRejeitar           = apRejeitar;

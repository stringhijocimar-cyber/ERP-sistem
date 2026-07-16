// ═══════════════════════════════════════════════════════════════════════════
// ERP Serviços e Operações — Módulo Medição (v2.0 — Refatorado)
// Medição de Cliente, Fornecedor, Checklist, Aprovação, Faturamento, PDF
// ═══════════════════════════════════════════════════════════════════════════

'use strict';

/* ── Storage ────────────────────────────────────────────────────────────── */
function _getMedicoes()      { try { return JSON.parse(localStorage.getItem('fa_medicoes_v2') || '[]'); } catch { return []; } }
function _saveMedicoes(d)    { localStorage.setItem('fa_medicoes_v2', JSON.stringify(d)); try { window._syncSnapshot && window._syncSnapshot('medicoes', d); } catch(e){} }
function _getMedForn()       { try { return JSON.parse(localStorage.getItem('fa_medicoes_forn_v2') || '[]'); } catch { return []; } }
function _saveMedForn(d)     { localStorage.setItem('fa_medicoes_forn_v2', JSON.stringify(d)); }
function _getContratosMed()  { return JSON.parse(localStorage.getItem('fa_contratos_cliente') || '[]'); }
function _getContForn()      { return JSON.parse(localStorage.getItem('fa_contratos_fornecedor') || '[]').concat(JSON.parse(localStorage.getItem('fa_contratos') || '[]')); }
function _getCritMed()       { try { return JSON.parse(localStorage.getItem('fa_criterios_medicao') || '[]'); } catch { return []; } }

/* ── Formatters ─────────────────────────────────────────────────────────── */
function _mFmtBRL(v)  { return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0); }
function _mFmtDate(d) { if(!d) return '—'; try { return new Date(d+'T12:00:00').toLocaleDateString('pt-BR'); } catch { return d; } }
function _mBadge(s) {
  const m = {
    'Rascunho':           {bg:'rgba(107,114,128,0.12)',c:'#6b7280'},
    'Pendente':           {bg:'rgba(245,158,11,0.12)', c:'#d97706'},
    'Em Aprovação':       {bg:'rgba(99,102,241,0.12)', c:'#6366f1'},
    'Aprovada':           {bg:'rgba(34,197,94,0.12)',  c:'#16a34a'},
    'Faturada':           {bg:'rgba(20,184,166,0.12)', c:'#0d9488'},
    'Paga':               {bg:'rgba(16,185,129,0.12)', c:'#059669'},
    'Reprovada':          {bg:'rgba(239,68,68,0.12)',  c:'#dc2626'},
    'Contestada':         {bg:'rgba(239,68,68,0.12)',  c:'#dc2626'},
  };
  const st = m[s]||{bg:'rgba(99,102,241,0.12)',c:'#6366f1'};
  return `<span style="padding:3px 9px;border-radius:5px;font-size:10px;font-weight:700;background:${st.bg};color:${st.c}">${s||'—'}</span>`;
}

/* ── Gerar ID ───────────────────────────────────────────────────────────── */
function _mGerarId(pref, lista) {
  const ano = new Date().getFullYear();
  const seq = String(lista.filter(x=>(x.id||'').startsWith(`${pref}-${ano}`)).length+1).padStart(4,'0');
  return `${pref}-${ano}-${seq}`;
}

/* ── Permissões ─────────────────────────────────────────────────────────── */
function _mPodeCriar()   { const r=(currentUser?.role||'').toLowerCase(); return ['admin','diretor','supervisor','gerente','engenheiro','medicao'].includes(r)||hasPermission('medicao','create'); }
function _mPodeAprovar() { const r=(currentUser?.role||'').toLowerCase(); return ['admin','diretor','supervisor','gerente'].includes(r)||hasPermission('medicao','approve'); }

/* ═══════════════════════════════════════════════════════════════════════════
   RENDER PRINCIPAL — Abas: Cliente | Fornecedor
   ═══════════════════════════════════════════════════════════════════════════ */
function renderMedicao() {
  if (typeof hasPermission === 'function' && !hasPermission('medicao','view')) {
    if (typeof renderAcessoNegado === 'function') renderAcessoNegado();
    return;
  }

  const mc = _getMedicoes();
  const mf = _getMedForn();

  // KPIs cliente
  const totalCliente    = mc.reduce((s,m)=>s+(Number(m.valor)||0),0);
  const aprovCliente    = mc.filter(m=>m.status==='Aprovada').length;
  const pendCliente     = mc.filter(m=>['Pendente','Em Aprovação','Rascunho'].includes(m.status)).length;
  const faturCliente    = mc.filter(m=>m.status==='Faturada'||m.status==='Paga').length;

  // KPIs fornecedor
  const totalForn       = mf.reduce((s,m)=>s+(Number(m.valor)||0),0);
  const aprovForn       = mf.filter(m=>m.status==='Aprovada').length;
  const pendForn        = mf.filter(m=>['Pendente','Em Aprovação','Rascunho'].includes(m.status)).length;

  const main = document.getElementById('mainContent');
  main.innerHTML = `
    <div style="padding:20px 24px;max-width:1400px">
      <!-- Header -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px">
        <div>
          <h1 style="font-size:22px;font-weight:700;color:var(--text-primary);margin:0">
            <i class="fas fa-ruler-combined" style="color:var(--fa-teal);margin-right:10px"></i>
            Medições
          </h1>
          <div style="font-size:12px;color:var(--text-muted);margin-top:4px">
            Medições de cliente e fornecedor · Aprovação · Faturamento
          </div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${_mPodeCriar() ? `
          <button class="btn btn-primary" id="med-btn-nova" onclick="medNovaCliente()">
            <i class="fas fa-plus"></i> Nova Medição Cliente
          </button>
          <button class="btn btn-secondary" onclick="medNovaFornecedor()">
            <i class="fas fa-plus"></i> Medição Fornecedor
          </button>` : ''}
        </div>
      </div>

      <!-- Abas -->
      <div style="display:flex;gap:2px;border-bottom:2px solid var(--border-color);margin-bottom:20px">
        <button onclick="medMudarAba('cliente',this)" id="med-tab-cliente"
          style="padding:9px 18px;font-size:13px;font-weight:600;border:none;background:none;cursor:pointer;
          border-bottom:3px solid var(--fa-teal);color:var(--fa-teal);border-radius:4px 4px 0 0">
          <i class="fas fa-user-tie" style="margin-right:6px"></i>Cliente (${mc.length})
        </button>
        <button onclick="medMudarAba('fornecedor',this)" id="med-tab-forn"
          style="padding:9px 18px;font-size:13px;font-weight:600;border:none;background:none;cursor:pointer;
          border-bottom:3px solid transparent;color:var(--text-muted);border-radius:4px 4px 0 0">
          <i class="fas fa-building" style="margin-right:6px"></i>Fornecedor (${mf.length})
        </button>
      </div>

      <!-- Painel Cliente -->
      <div id="med-painel-cliente">
        <!-- KPIs -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin-bottom:18px">
          <div class="ss-card" style="padding:14px;text-align:center">
            <div style="font-size:18px;font-weight:800;color:var(--fa-teal)">${_mFmtBRL(totalCliente)}</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:3px">Total Medido</div>
          </div>
          <div class="ss-card" style="padding:14px;text-align:center">
            <div style="font-size:24px;font-weight:800;color:#16a34a">${aprovCliente}</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:3px">Aprovadas</div>
          </div>
          <div class="ss-card" style="padding:14px;text-align:center">
            <div style="font-size:24px;font-weight:800;color:#d97706">${pendCliente}</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:3px">Pendentes</div>
          </div>
          <div class="ss-card" style="padding:14px;text-align:center">
            <div style="font-size:24px;font-weight:800;color:#0d9488">${faturCliente}</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:3px">Faturadas/Pagas</div>
          </div>
        </div>

        <!-- Filtros -->
        <div class="search-bar" style="margin-bottom:14px;border-radius:var(--radius);border:1.5px solid var(--border);background:var(--bg-secondary)">
          <div class="search-input-wrapper" style="flex:1">
            <i class="fas fa-search"></i>
            <input class="search-input" id="med-busca-c" placeholder="Buscar medição por número, contrato, cliente, período…"
              oninput="medFiltrarCliente()" autocomplete="off">
          </div>
          <select class="filter-select" id="med-status-c" onchange="medFiltrarCliente()">
            <option value="">Todos os Status</option>
            ${['Rascunho','Pendente','Em Aprovação','Aprovada','Faturada','Paga','Reprovada','Contestada'].map(s=>`<option>${s}</option>`).join('')}
          </select>
          <select class="filter-select" id="med-tipo-c" onchange="medFiltrarCliente()">
            <option value="">Todos os Tipos</option>
            ${['Mensal','Avulsa','Final','Parcial','Por Etapa'].map(t=>`<option>${t}</option>`).join('')}
          </select>
        </div>

        <!-- Tabela -->
        <div class="ss-card" style="padding:0;overflow:hidden">
          <div style="overflow-x:auto">
            <table class="ss-table">
              <thead><tr>
                <th>Nº</th><th>Período</th><th>Contrato / Cliente</th><th>Tipo</th>
                <th>Valor</th><th>Avanço Físico</th><th>Status</th><th style="text-align:center">Ações</th>
              </tr></thead>
              <tbody id="med-tbody-c">${_mRenderLinhasCliente(mc)}</tbody>
            </table>
            ${mc.length===0?`<div style="text-align:center;padding:50px;color:var(--text-muted)">
              <i class="fas fa-ruler-combined" style="font-size:32px;color:var(--fa-teal);display:block;margin-bottom:10px"></i>
              <div style="font-weight:600;margin-bottom:6px">Nenhuma medição de cliente cadastrada</div>
              ${_mPodeCriar()?`<button class="btn btn-primary btn-sm" onclick="medNovaCliente()"><i class="fas fa-plus"></i> Nova Medição</button>`:''}
            </div>`:''}
          </div>
        </div>
      </div>

      <!-- Painel Fornecedor -->
      <div id="med-painel-forn" style="display:none">
        <!-- KPIs -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin-bottom:18px">
          <div class="ss-card" style="padding:14px;text-align:center">
            <div style="font-size:18px;font-weight:800;color:#6366f1">${_mFmtBRL(totalForn)}</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:3px">Total Medido Forn.</div>
          </div>
          <div class="ss-card" style="padding:14px;text-align:center">
            <div style="font-size:24px;font-weight:800;color:#16a34a">${aprovForn}</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:3px">Aprovadas</div>
          </div>
          <div class="ss-card" style="padding:14px;text-align:center">
            <div style="font-size:24px;font-weight:800;color:#d97706">${pendForn}</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:3px">Pendentes</div>
          </div>
        </div>

        <!-- Filtros -->
        <div class="search-bar" style="margin-bottom:14px;border-radius:var(--radius);border:1.5px solid var(--border);background:var(--bg-secondary)">
          <div class="search-input-wrapper" style="flex:1">
            <i class="fas fa-search"></i>
            <input class="search-input" id="med-busca-f" placeholder="Buscar medição por número, fornecedor, contrato, período…"
              oninput="medFiltrarForn()" autocomplete="off">
          </div>
          <select class="filter-select" id="med-status-f" onchange="medFiltrarForn()">
            <option value="">Todos os Status</option>
            ${['Rascunho','Pendente','Em Aprovação','Aprovada','Paga','Contestada'].map(s=>`<option>${s}</option>`).join('')}
          </select>
        </div>

        <!-- Tabela -->
        <div class="ss-card" style="padding:0;overflow:hidden">
          <div style="overflow-x:auto">
            <table class="ss-table">
              <thead><tr>
                <th>Nº</th><th>Período</th><th>Fornecedor / Contrato</th>
                <th>Valor</th><th>Status</th><th>Responsável</th><th style="text-align:center">Ações</th>
              </tr></thead>
              <tbody id="med-tbody-f">${_mRenderLinhasForn(mf)}</tbody>
            </table>
            ${mf.length===0?`<div style="text-align:center;padding:50px;color:var(--text-muted)">
              <i class="fas fa-building" style="font-size:32px;color:#6366f1;display:block;margin-bottom:10px"></i>
              <div style="font-weight:600;margin-bottom:6px">Nenhuma medição de fornecedor cadastrada</div>
              ${_mPodeCriar()?`<button class="btn btn-primary btn-sm" onclick="medNovaFornecedor()"><i class="fas fa-plus"></i> Nova Medição Fornecedor</button>`:''}
            </div>`:''}
          </div>
        </div>
      </div>

    </div>`;
}

/* ── Render linhas ──────────────────────────────────────────────────────── */
function _mRenderLinhasCliente(lista) {
  if (!lista.length) return '';
  return lista.map(m => {
    const pct = m.pct_realizado || 0;
    return `<tr>
      <td><strong style="color:var(--fa-teal);font-size:12px">${m.numero||m.id}</strong></td>
      <td style="font-size:12px">${m.periodo||_mFmtDate(m.data_referencia)||'—'}</td>
      <td style="font-size:12px">
        <div style="font-weight:600">${(m.contrato_nome||'—').substring(0,30)}</div>
        <div style="color:var(--text-muted);font-size:11px">${m.cliente||''}</div>
      </td>
      <td><span style="padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;background:rgba(20,184,166,0.1);color:#0d9488">${m.tipo||'Mensal'}</span></td>
      <td style="font-weight:700;color:var(--fa-teal)">${_mFmtBRL(m.valor)}</td>
      <td style="min-width:120px">
        ${pct > 0 ? `
        <div style="display:flex;align-items:center;gap:6px">
          <div style="flex:1;height:6px;background:var(--border-color);border-radius:3px;overflow:hidden">
            <div style="height:100%;width:${Math.min(pct,100)}%;background:${pct>=100?'#16a34a':'var(--fa-teal)'};border-radius:3px"></div>
          </div>
          <span style="font-size:11px;font-weight:700;color:var(--text-secondary)">${pct}%</span>
        </div>` : '<span style="font-size:11px;color:var(--text-muted)">—</span>'}
      </td>
      <td>${_mBadge(m.status)}</td>
      <td style="text-align:center">
        <div style="display:flex;gap:4px;justify-content:center">
          <button class="btn btn-secondary btn-sm btn-icon" onclick="medVerCliente('${m.id}')" title="Visualizar"><i class="fas fa-eye"></i></button>
          ${(m.status==='Rascunho'||m.status==='Reprovada')&&_mPodeCriar() ? `<button class="btn btn-secondary btn-sm btn-icon" onclick="medEditarCliente('${m.id}')" title="Editar"><i class="fas fa-edit"></i></button>` : ''}
          ${m.status==='Rascunho'&&_mPodeCriar() ? `<button class="btn btn-primary btn-sm btn-icon" onclick="medEnviarAprovacao('${m.id}')" title="Enviar" style="font-size:10px"><i class="fas fa-paper-plane"></i></button>` : ''}
          ${(m.status==='Pendente'||m.status==='Em Aprovação')&&_mPodeAprovar() ? `
            <button class="btn btn-sm btn-icon" onclick="medAprovarCliente('${m.id}')" title="Aprovar" style="background:#16a34a;color:#fff"><i class="fas fa-check"></i></button>
            <button class="btn btn-danger btn-sm btn-icon" onclick="medReprovarCliente('${m.id}')" title="Reprovar"><i class="fas fa-times"></i></button>` : ''}
          ${m.status==='Aprovada'&&_mPodeCriar() ? `<button class="btn btn-sm btn-icon" onclick="medFaturar('${m.id}')" title="Faturar" style="background:#0d9488;color:#fff"><i class="fas fa-file-invoice-dollar"></i></button>` : ''}
          <button class="btn btn-secondary btn-sm btn-icon" onclick="medGerarPDF('${m.id}','cliente')" title="PDF"><i class="fas fa-file-pdf" style="color:#ef4444"></i></button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function _mRenderLinhasForn(lista) {
  if (!lista.length) return '';
  return lista.map(m => `
    <tr>
      <td><strong style="color:#6366f1;font-size:12px">${m.numero||m.id}</strong></td>
      <td style="font-size:12px">${m.periodo||_mFmtDate(m.data_referencia)||'—'}</td>
      <td style="font-size:12px">
        <div style="font-weight:600">${(m.fornecedor_nome||m.contrato_nome||'—').substring(0,30)}</div>
        <div style="color:var(--text-muted);font-size:11px">${m.contrato_nome||''}</div>
      </td>
      <td style="font-weight:700;color:#6366f1">${_mFmtBRL(m.valor)}</td>
      <td>${_mBadge(m.status)}</td>
      <td style="font-size:12px">${m.responsavel||'—'}</td>
      <td style="text-align:center">
        <div style="display:flex;gap:4px;justify-content:center">
          <button class="btn btn-secondary btn-sm btn-icon" onclick="medVerForn('${m.id}')" title="Visualizar"><i class="fas fa-eye"></i></button>
          ${(m.status==='Rascunho'||m.status==='Contestada')&&_mPodeCriar() ? `<button class="btn btn-secondary btn-sm btn-icon" onclick="medEditarForn('${m.id}')" title="Editar"><i class="fas fa-edit"></i></button>` : ''}
          ${(m.status==='Pendente'||m.status==='Em Aprovação')&&_mPodeAprovar() ? `
            <button class="btn btn-sm btn-icon" onclick="medAprovarForn('${m.id}')" title="Aprovar" style="background:#16a34a;color:#fff"><i class="fas fa-check"></i></button>
            <button class="btn btn-danger btn-sm btn-icon" onclick="medContestarForn('${m.id}')" title="Contestar"><i class="fas fa-times"></i></button>` : ''}
        </div>
      </td>
    </tr>`).join('');
}

/* ── Abas ───────────────────────────────────────────────────────────────── */
function medMudarAba(aba, btn) {
  document.getElementById('med-painel-cliente').style.display = aba==='cliente' ? 'block' : 'none';
  document.getElementById('med-painel-forn').style.display    = aba==='fornecedor' ? 'block' : 'none';
  document.getElementById('med-btn-nova').textContent = aba==='cliente' ? '+ Nova Medição Cliente' : '+ Medição Fornecedor';
  document.getElementById('med-btn-nova').onclick = aba==='cliente' ? medNovaCliente : medNovaFornecedor;

  ['med-tab-cliente','med-tab-forn'].forEach(id => {
    const t = document.getElementById(id);
    if (!t) return;
    const active = (aba==='cliente'&&id==='med-tab-cliente')||(aba==='fornecedor'&&id==='med-tab-forn');
    t.style.borderBottomColor = active ? 'var(--fa-teal)' : 'transparent';
    t.style.color = active ? 'var(--fa-teal)' : 'var(--text-muted)';
  });
}

/* ── Filtros ─────────────────────────────────────────────────────────────── */
function medFiltrarCliente() {
  const busca  = (document.getElementById('med-busca-c')?.value||'').toLowerCase();
  const status = document.getElementById('med-status-c')?.value||'';
  const tipo   = document.getElementById('med-tipo-c')?.value||'';
  let lista = _getMedicoes();
  if (busca)  lista = lista.filter(m=>JSON.stringify(m).toLowerCase().includes(busca));
  if (status) lista = lista.filter(m=>m.status===status);
  if (tipo)   lista = lista.filter(m=>m.tipo===tipo);
  const tbody = document.getElementById('med-tbody-c');
  if (tbody) tbody.innerHTML = _mRenderLinhasCliente(lista);
}

function medFiltrarForn() {
  const busca  = (document.getElementById('med-busca-f')?.value||'').toLowerCase();
  const status = document.getElementById('med-status-f')?.value||'';
  let lista = _getMedForn();
  if (busca)  lista = lista.filter(m=>JSON.stringify(m).toLowerCase().includes(busca));
  if (status) lista = lista.filter(m=>m.status===status);
  const tbody = document.getElementById('med-tbody-f');
  if (tbody) tbody.innerHTML = _mRenderLinhasForn(lista);
}

/* ═══════════════════════════════════════════════════════════════════════════
   NOVA MEDIÇÃO CLIENTE — Formulário multi-etapas
   ═══════════════════════════════════════════════════════════════════════════ */
function medNovaCliente() {
  if (!_mPodeCriar()) { showToast('Sem permissão.','error'); return; }
  medAbrirFormCliente(null);
}

function medEditarCliente(id) {
  if (!_mPodeCriar()) return;
  medAbrirFormCliente(id);
}

function medAbrirFormCliente(existingId) {
  const existing  = existingId ? _getMedicoes().find(m=>m.id===existingId) : null;
  const contratos = _getContratosMed();
  const criterios = _getCritMed();
  const novoId    = existing?.id || _mGerarId('MED', _getMedicoes());
  const hoje      = new Date().toISOString().split('T')[0];
  const anoMes    = new Date().toISOString().slice(0,7);

  const contOptsHtml = contratos.map(c =>
    `<option value="${c.id}" ${existing?.contrato_id===c.id?'selected':''}>${c.numero||c.id} — ${c.cliente||c.empresa||'—'}</option>`
  ).join('');

  // Linhas de checklist de critérios de medição
  const critLinhas = (existing?.itens_checklist||[{descricao:'',un:'m²',qtd_contrato:0,qtd_anterior:0,qtd_periodo:0,valor_unit:0}]).map((it,i)=>
    _mRenderItemLinha(it, i)
  ).join('');

  openModalWide(`${existing?'Editar':'Nova'} Medição de Cliente — ${novoId}`, `
    <div style="max-height:80vh;overflow-y:auto;padding-right:4px">
      <style>.med-tab{padding:7px 13px;font-size:12px;font-weight:600;border:none;background:none;cursor:pointer;border-bottom:3px solid transparent;color:var(--text-muted);border-radius:4px 4px 0 0;transition:.15s}
      .med-tab-active{color:var(--fa-teal)!important;border-bottom-color:var(--fa-teal)!important}
      .med-aba{display:none}.form-label-sm{font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;font-weight:600}</style>
      <div style="display:flex;gap:2px;border-bottom:2px solid var(--border-color);margin-bottom:16px">
        ${['Identificação','Itens & Valores','Avanço Físico','Documentos & Obs'].map((t,i)=>`
          <button onclick="medMudarAbaForm(${i},this)" class="med-tab${i===0?' med-tab-active':''}">${t}</button>`).join('')}
      </div>

      <!-- Aba 0: Identificação -->
      <div class="med-aba" id="mf-aba-0" style="display:block">
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px">
          <div><label class="form-label-sm">Nº da Medição</label>
            <input class="form-control" id="mf_id" value="${novoId}" readonly style="background:var(--bg-tertiary)"></div>
          <div><label class="form-label-sm">Tipo de Medição *</label>
            <select class="form-control" id="mf_tipo">
              ${['Mensal','Avulsa','Final','Parcial','Por Etapa'].map(t=>`<option ${(existing?.tipo||'Mensal')===t?'selected':''}>${t}</option>`).join('')}
            </select></div>
          <div><label class="form-label-sm">Período *</label>
            <input class="form-control" id="mf_periodo" type="month" value="${existing?.periodo||anoMes}"></div>
          <div style="grid-column:1/-1"><label class="form-label-sm">Contrato / Cliente *</label>
            <select class="form-control" id="mf_contrato" onchange="medOnChangeContrato(this)">
              <option value="">Selecione o contrato...</option>
              ${contOptsHtml}
            </select></div>
          <div><label class="form-label-sm">Data de Referência</label>
            <input class="form-control" id="mf_data" type="date" value="${existing?.data_referencia||hoje}"></div>
          <div><label class="form-label-sm">Responsável</label>
            <input class="form-control" id="mf_responsavel" value="${existing?.responsavel||currentUser?.name||''}" placeholder="Responsável pela medição"></div>
          <div><label class="form-label-sm">Status</label>
            <select class="form-control" id="mf_status">
              ${['Rascunho','Pendente','Em Aprovação'].map(s=>`<option ${(existing?.status||'Rascunho')===s?'selected':''}>${s}</option>`).join('')}
            </select></div>
        </div>
        <div><label class="form-label-sm">Descrição / Objeto</label>
          <textarea class="form-control" id="mf_descricao" rows="3" 
            placeholder="Descreva os serviços/etapas contemplados nesta medição...">${existing?.descricao||''}</textarea></div>
      </div>

      <!-- Aba 1: Itens & Valores -->
      <div class="med-aba" id="mf-aba-1">
        <div style="background:rgba(20,184,166,0.06);border:1px solid rgba(20,184,166,0.2);border-radius:8px;padding:10px 14px;margin-bottom:12px;font-size:12px">
          <i class="fas fa-info-circle" style="color:var(--fa-teal);margin-right:5px"></i>
          Registre cada item/serviço medido com quantidade no período. O valor total é calculado automaticamente.
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <span style="font-size:13px;font-weight:700">Itens Medidos</span>
          <button onclick="medAddItemLinha()" class="btn btn-primary btn-sm"><i class="fas fa-plus"></i> Adicionar Item</button>
        </div>
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-size:12px" id="mf_itens_tbl">
            <thead><tr style="background:var(--bg-card2)">
              <th style="padding:6px 8px;text-align:left;font-size:10px;color:var(--text-muted)">Descrição *</th>
              <th style="padding:6px 8px;text-align:center;font-size:10px;color:var(--text-muted)">UN</th>
              <th style="padding:6px 8px;text-align:center;font-size:10px;color:var(--text-muted)">Qtd Contrato</th>
              <th style="padding:6px 8px;text-align:center;font-size:10px;color:var(--text-muted)">Qtd Anterior</th>
              <th style="padding:6px 8px;text-align:center;font-size:10px;color:var(--text-muted)">Qtd Período *</th>
              <th style="padding:6px 8px;text-align:right;font-size:10px;color:var(--text-muted)">Valor Unit *</th>
              <th style="padding:6px 8px;text-align:right;font-size:10px;color:var(--text-muted)">Total</th>
              <th></th>
            </tr></thead>
            <tbody id="mf_itens_body">${critLinhas}</tbody>
          </table>
        </div>
        <div style="margin-top:12px;display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
          <div style="background:var(--bg-card2);padding:10px;border-radius:8px;text-align:center">
            <div style="font-size:10px;color:var(--text-muted)">Subtotal</div>
            <div id="mf_subtotal" style="font-size:16px;font-weight:800;color:var(--fa-teal)">R$ 0,00</div>
          </div>
          <div style="background:var(--bg-card2);padding:10px;border-radius:8px">
            <label class="form-label-sm">Desconto (R$)</label>
            <input class="form-control" id="mf_desconto" type="number" min="0" step="0.01" value="${existing?.desconto||0}" oninput="medCalcTotal()">
          </div>
          <div style="background:rgba(20,184,166,0.08);padding:10px;border-radius:8px;text-align:center">
            <div style="font-size:10px;color:var(--text-muted)">Valor Total Medição</div>
            <div id="mf_total" style="font-size:18px;font-weight:800;color:var(--fa-teal)">R$ 0,00</div>
          </div>
        </div>
      </div>

      <!-- Aba 2: Avanço Físico -->
      <div class="med-aba" id="mf-aba-2">
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px">
          <div><label class="form-label-sm">% Previsto Contratual</label>
            <input class="form-control" id="mf_pct_contrato" type="number" min="0" max="100" step="0.01" value="${existing?.pct_contrato||0}"></div>
          <div><label class="form-label-sm">% Acumulado Anterior</label>
            <input class="form-control" id="mf_pct_anterior" type="number" min="0" max="100" step="0.01" value="${existing?.pct_anterior||0}"></div>
          <div><label class="form-label-sm">% Realizado no Período</label>
            <input class="form-control" id="mf_pct_periodo" type="number" min="0" max="100" step="0.01" value="${existing?.pct_periodo||0}" oninput="medCalcPctRealizado()"></div>
          <div><label class="form-label-sm">% Realizado Acumulado</label>
            <input class="form-control" id="mf_pct_realizado" type="number" min="0" max="100" step="0.01" value="${existing?.pct_realizado||0}" readonly style="background:var(--bg-tertiary)"></div>
          <div><label class="form-label-sm">Desvio de Prazo (dias)</label>
            <input class="form-control" id="mf_desvio_prazo" type="number" value="${existing?.desvio_prazo||0}"></div>
          <div><label class="form-label-sm">SPI (Índice de Desempenho Prazo)</label>
            <input class="form-control" id="mf_spi" type="number" step="0.01" value="${existing?.spi||1.0}" placeholder="1.0 = no prazo"></div>
        </div>
        <div><label class="form-label-sm">Comentários do Avanço Físico</label>
          <textarea class="form-control" id="mf_comentarios_avanco" rows="4" 
            placeholder="Justifique desvios, descreva conquistas do período, riscos identificados...">${existing?.comentarios_avanco||''}</textarea></div>
      </div>

      <!-- Aba 3: Documentos & Obs -->
      <div class="med-aba" id="mf-aba-3">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
          <div><label class="form-label-sm">Nº NF / Nota Fiscal (se aplicável)</label>
            <input class="form-control" id="mf_nf" value="${existing?.nf||''}" placeholder="Número da NF"></div>
          <div><label class="form-label-sm">Prazo para Pagamento</label>
            <input class="form-control" id="mf_prazo_pagamento" type="date" value="${existing?.prazo_pagamento||''}"></div>
        </div>
        <div style="margin-bottom:10px"><label class="form-label-sm">Documentos Comprobatórios (descreva nomes)</label>
          <textarea class="form-control" id="mf_documentos" rows="3" 
            placeholder="Liste os documentos comprobatórios: fotos, RDOs, boletins, ART, etc...">${existing?.documentos||''}</textarea></div>
        <div><label class="form-label-sm">Observações Gerais</label>
          <textarea class="form-control" id="mf_observacoes" rows="3" 
            placeholder="Observações, pendências, condicionantes do cliente...">${existing?.observacoes||''}</textarea></div>
      </div>
    </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
     <button class="btn btn-secondary" onclick="medSalvarCliente('${novoId}','${existingId||''}','rascunho')">
       <i class="fas fa-save"></i> Salvar Rascunho
     </button>
     <button class="btn btn-primary" onclick="medSalvarCliente('${novoId}','${existingId||''}','enviar')">
       <i class="fas fa-paper-plane"></i> Enviar para Aprovação
     </button>`
  );

  setTimeout(() => medCalcTotal(), 100);
}

/* ── Helpers formulário ─────────────────────────────────────────────────── */
function medMudarAbaForm(idx, btn) {
  document.querySelectorAll('.med-aba').forEach((a,i)=>a.style.display=i===idx?'block':'none');
  document.querySelectorAll('.med-tab').forEach(b=>{b.classList.remove('med-tab-active');b.style.color='var(--text-muted)';b.style.borderBottomColor='transparent';});
  if(btn){btn.classList.add('med-tab-active');btn.style.color='var(--fa-teal)';btn.style.borderBottomColor='var(--fa-teal)';}
}

function medOnChangeContrato(sel) {
  const cid = sel.value;
  const contratos = _getContratosMed();
  const c = contratos.find(x=>x.id===cid);
}

function _mRenderItemLinha(it, idx) {
  const tot = ((Number(it.qtd_periodo)||0) * (Number(it.valor_unit)||0)).toFixed(2);
  return `
    <tr class="mf-item-row">
      <td style="padding:4px"><input class="form-control mf-item-desc" value="${it.descricao||''}" style="font-size:12px;min-width:180px" placeholder="Descrição do item" oninput="medCalcTotal()"></td>
      <td style="padding:4px"><input class="form-control mf-item-un" value="${it.un||'m²'}" style="font-size:12px;width:60px;text-align:center"></td>
      <td style="padding:4px"><input class="form-control mf-item-qtd-cont" type="number" min="0" step="0.01" value="${it.qtd_contrato||0}" style="font-size:12px;width:90px;text-align:center"></td>
      <td style="padding:4px"><input class="form-control mf-item-qtd-ant" type="number" min="0" step="0.01" value="${it.qtd_anterior||0}" style="font-size:12px;width:90px;text-align:center"></td>
      <td style="padding:4px"><input class="form-control mf-item-qtd" type="number" min="0" step="0.01" value="${it.qtd_periodo||0}" style="font-size:12px;width:90px;text-align:center" oninput="medCalcTotal()"></td>
      <td style="padding:4px"><input class="form-control mf-item-vun" type="number" min="0" step="0.01" value="${it.valor_unit||0}" style="font-size:12px;width:100px;text-align:right" oninput="medCalcTotal()"></td>
      <td style="padding:4px;text-align:right;font-weight:700;color:var(--fa-teal);white-space:nowrap" class="mf-item-tot">${_mFmtBRL(tot)}</td>
      <td style="padding:4px"><button onclick="this.closest('.mf-item-row').remove();medCalcTotal()" class="btn btn-danger btn-sm btn-icon"><i class="fas fa-times"></i></button></td>
    </tr>`;
}

function medAddItemLinha() {
  const tbody = document.getElementById('mf_itens_body');
  if (!tbody) return;
  const idx = tbody.querySelectorAll('.mf-item-row').length;
  const tr  = document.createElement('tr');
  tr.innerHTML = _mRenderItemLinha({}, idx);
  tbody.appendChild(tr.firstElementChild);
}

function medCalcTotal() {
  let subtotal = 0;
  document.querySelectorAll('.mf-item-row').forEach(row => {
    const qtd = parseFloat(row.querySelector('.mf-item-qtd')?.value)||0;
    const vun = parseFloat(row.querySelector('.mf-item-vun')?.value)||0;
    const tot = qtd * vun;
    const totEl = row.querySelector('.mf-item-tot');
    if (totEl) totEl.textContent = _mFmtBRL(tot);
    subtotal += tot;
  });
  const desc    = parseFloat(document.getElementById('mf_desconto')?.value)||0;
  const total   = Math.max(0, subtotal - desc);
  const subEl   = document.getElementById('mf_subtotal');
  const totEl   = document.getElementById('mf_total');
  if (subEl) subEl.textContent = _mFmtBRL(subtotal);
  if (totEl) totEl.textContent = _mFmtBRL(total);
}

function medCalcPctRealizado() {
  const ant   = parseFloat(document.getElementById('mf_pct_anterior')?.value)||0;
  const per   = parseFloat(document.getElementById('mf_pct_periodo')?.value)||0;
  const el    = document.getElementById('mf_pct_realizado');
  if (el) el.value = Math.min(100, ant + per).toFixed(2);
}

/* ── Salvar Medição Cliente ─────────────────────────────────────────────── */
function medSalvarCliente(novoId, existingId, acao) {
  const tipo       = document.getElementById('mf_tipo')?.value||'Mensal';
  const periodo    = document.getElementById('mf_periodo')?.value||'';
  const contratoId = document.getElementById('mf_contrato')?.value||'';
  const descricao  = document.getElementById('mf_descricao')?.value?.trim()||'';
  const responsavel= document.getElementById('mf_responsavel')?.value?.trim()||'';
  let   status     = document.getElementById('mf_status')?.value||'Rascunho';
  if (acao==='enviar') status = 'Em Aprovação';

  const erros = [];
  if (!periodo)     erros.push('Período é obrigatório');
  if (!contratoId)  erros.push('Selecione o contrato');

  // Itens
  const itens = [];
  let subtotal = 0;
  document.querySelectorAll('.mf-item-row').forEach(row => {
    const desc2 = row.querySelector('.mf-item-desc')?.value?.trim()||'';
    if (!desc2) return;
    const qtd  = parseFloat(row.querySelector('.mf-item-qtd')?.value)||0;
    const vun  = parseFloat(row.querySelector('.mf-item-vun')?.value)||0;
    const tot  = qtd * vun;
    subtotal  += tot;
    itens.push({
      descricao: desc2,
      un:        row.querySelector('.mf-item-un')?.value||'m²',
      qtd_contrato: parseFloat(row.querySelector('.mf-item-qtd-cont')?.value)||0,
      qtd_anterior: parseFloat(row.querySelector('.mf-item-qtd-ant')?.value)||0,
      qtd_periodo:  qtd,
      valor_unit:   vun,
      total:        tot,
    });
  });
  // Checklist obrigatório ao enviar para aprovação
  if (acao==='enviar') {
    if (!itens.length) erros.push('⛔ Checklist obrigatório: adicione ao menos um item medido antes de enviar para aprovação');
    else if (itens.every(it => it.qtd_periodo <= 0)) erros.push('⛔ Ao menos um item deve ter quantidade no período maior que zero');
    else if (itens.every(it => !it.descricao || !it.descricao.trim())) erros.push('⛔ Preencha a descrição dos itens do checklist');
  }

  if (erros.length) { showToast('⚠️ '+erros.join(' | '), 'error'); return; }

  const desconto = parseFloat(document.getElementById('mf_desconto')?.value)||0;
  const valor    = Math.max(0, subtotal - desconto);

  // Contrato info
  const contratos = _getContratosMed();
  const c  = contratos.find(x=>x.id===contratoId);

  const nova = {
    id:             novoId,
    numero:         novoId,
    tipo,
    periodo,
    contrato_id:    contratoId,
    contrato_nome:  c?.numero||c?.id||contratoId,
    cliente:        c?.cliente||c?.empresa||'',
    data_referencia:document.getElementById('mf_data')?.value||'',
    responsavel,
    descricao,
    itens_checklist:itens,
    subtotal,
    desconto,
    valor,
    pct_contrato:   parseFloat(document.getElementById('mf_pct_contrato')?.value)||0,
    pct_anterior:   parseFloat(document.getElementById('mf_pct_anterior')?.value)||0,
    pct_periodo:    parseFloat(document.getElementById('mf_pct_periodo')?.value)||0,
    pct_realizado:  parseFloat(document.getElementById('mf_pct_realizado')?.value)||0,
    desvio_prazo:   parseInt(document.getElementById('mf_desvio_prazo')?.value)||0,
    spi:            parseFloat(document.getElementById('mf_spi')?.value)||1,
    comentarios_avanco: document.getElementById('mf_comentarios_avanco')?.value?.trim()||'',
    nf:             document.getElementById('mf_nf')?.value?.trim()||'',
    prazo_pagamento:document.getElementById('mf_prazo_pagamento')?.value||'',
    documentos:     document.getElementById('mf_documentos')?.value?.trim()||'',
    observacoes:    document.getElementById('mf_observacoes')?.value?.trim()||'',
    status,
    criado_por:     currentUser?.id||'',
    criado_por_nome:currentUser?.name||'',
    criado_em:      existingId ? undefined : new Date().toISOString(),
    atualizado_em:  new Date().toISOString(),
    historico:      [{ acao: acao==='enviar'?'Enviada para aprovação':'Rascunho salvo', por: currentUser?.name||'', em: new Date().toISOString() }],
  };

  let todos = _getMedicoes();
  if (existingId) {
    const idx = todos.findIndex(x=>x.id===existingId);
    if (idx>=0) { nova.criado_em=todos[idx].criado_em; nova.historico=[...(todos[idx].historico||[]),...nova.historico]; todos[idx]=nova; }
    else todos.unshift(nova);
  } else {
    todos.unshift(nova);
  }
  _saveMedicoes(todos);

  closeModal();
  showToast(acao==='enviar'?'✅ Medição enviada para aprovação!':'💾 Rascunho salvo!','success');
  renderMedicao();
}

/* ── Enviar para Aprovação ──────────────────────────────────────────────── */
function medEnviarAprovacao(id) {
  const todos = _getMedicoes();
  const idx   = todos.findIndex(x=>x.id===id);
  if (idx<0) return;
  // Bloqueio: checklist obrigatório antes de enviar para aprovação
  const itensCheck = todos[idx].itens_checklist || [];
  if (!itensCheck.length || itensCheck.every(it => (it.qtd_periodo || 0) <= 0)) {
    showToast('⛔ Checklist obrigatório: preencha ao menos um item com quantidade antes de enviar para aprovação.', 'error', 6000);
    return;
  }
  todos[idx].status = 'Em Aprovação';
  todos[idx].historico = [...(todos[idx].historico||[]), {acao:'Enviada para aprovação', por: currentUser?.name||'', em: new Date().toISOString()}];
  _saveMedicoes(todos);
  showToast('✅ Medição enviada para aprovação.','success');
  renderMedicao();
}

/* ── Aprovar / Reprovar ─────────────────────────────────────────────────── */
function medAprovarCliente(id) {
  if (!_mPodeAprovar()) { showToast('Sem permissão.','error'); return; }
  const todos = _getMedicoes();
  const idx   = todos.findIndex(x=>x.id===id);
  if (idx<0) return;
  // Bloqueio: obrigatório ter checklist com ao menos 1 item com quantidade > 0
  const itensCheck = todos[idx].itens_checklist || [];
  if (!itensCheck.length || itensCheck.every(it => (it.qtd_periodo || 0) <= 0)) {
    showToast('⛔ Medição sem checklist preenchido — preencha ao menos um item com quantidade antes de aprovar.', 'error', 6000);
    return;
  }
  todos[idx].status       = 'Aprovada';
  todos[idx].aprovado_por = currentUser?.name||'';
  todos[idx].aprovado_em  = new Date().toISOString();
  todos[idx].historico    = [...(todos[idx].historico||[]), {acao:'Aprovada', por: currentUser?.name||'', em: new Date().toISOString()}];
  _saveMedicoes(todos);
  showToast('✅ Medição aprovada!','success');
  renderMedicao();
}

function medReprovarCliente(id) {
  if (!_mPodeAprovar()) { showToast('Sem permissão.','error'); return; }
  const motivo = prompt('Motivo da reprovação (obrigatório):');
  if (!motivo) return;
  const todos = _getMedicoes();
  const idx   = todos.findIndex(x=>x.id===id);
  if (idx<0) return;
  todos[idx].status         = 'Reprovada';
  todos[idx].motivo_reprova = motivo;
  todos[idx].historico      = [...(todos[idx].historico||[]), {acao:`Reprovada: ${motivo}`, por: currentUser?.name||'', em: new Date().toISOString()}];
  _saveMedicoes(todos);
  showToast('Medição reprovada.','warning');
  renderMedicao();
}

/* ── Faturar ────────────────────────────────────────────────────────────── */
function medFaturar(id) {
  if (!_mPodeCriar()) return;
  openModal('Faturar Medição', `
    <div style="display:grid;gap:12px">
      <div><label style="font-size:11px;color:var(--text-muted)">Número da NF</label>
        <input class="form-control" id="ftr_nf" placeholder="Ex: 001234"></div>
      <div><label style="font-size:11px;color:var(--text-muted)">Data de Emissão da NF</label>
        <input class="form-control" type="date" id="ftr_data_nf" value="${new Date().toISOString().split('T')[0]}"></div>
      <div><label style="font-size:11px;color:var(--text-muted)">Prazo de Vencimento</label>
        <input class="form-control" type="date" id="ftr_vencimento"></div>
      <div><label style="font-size:11px;color:var(--text-muted)">Observações</label>
        <textarea class="form-control" id="ftr_obs" rows="2" placeholder="Observações do faturamento..."></textarea></div>
    </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
     <button class="btn btn-primary" onclick="medConfirmarFaturamento('${id}')"><i class="fas fa-file-invoice-dollar"></i> Confirmar Faturamento</button>`
  );
}

function medConfirmarFaturamento(id) {
  const nf          = document.getElementById('ftr_nf')?.value?.trim()||'';
  const dataNF      = document.getElementById('ftr_data_nf')?.value||'';
  const vencimento  = document.getElementById('ftr_vencimento')?.value||'';
  const obs         = document.getElementById('ftr_obs')?.value?.trim()||'';

  if (!nf) { showToast('Informe o número da NF.','error'); return; }

  const todos = _getMedicoes();
  const idx   = todos.findIndex(x=>x.id===id);
  if (idx<0) return;
  todos[idx].status       = 'Faturada';
  todos[idx].nf           = nf;
  todos[idx].data_nf      = dataNF;
  todos[idx].vencimento   = vencimento;
  todos[idx].historico    = [...(todos[idx].historico||[]), {acao:`Faturada – NF ${nf}`, por: currentUser?.name||'', em: new Date().toISOString()}];
  _saveMedicoes(todos);
  closeModal();
  showToast(`✅ Medição faturada! NF: ${nf}`,'success');
  renderMedicao();
}

/* ═══════════════════════════════════════════════════════════════════════════
   MEDIÇÃO DE FORNECEDOR
   ═══════════════════════════════════════════════════════════════════════════ */
function medNovaFornecedor() { medAbrirFormForn(null); }
function medEditarForn(id)   { medAbrirFormForn(id); }

function medAbrirFormForn(existingId) {
  const existing  = existingId ? _getMedForn().find(m=>m.id===existingId) : null;
  const contForn  = _getContForn();
  const novoId    = existing?.id || _mGerarId('MDF', _getMedForn());
  const hoje      = new Date().toISOString().split('T')[0];
  const anoMes    = new Date().toISOString().slice(0,7);

  const contOptsHtml = contForn.map(c =>
    `<option value="${c.id}" ${existing?.contrato_id===c.id?'selected':''}>${c.numero||c.id} — ${c.fornecedor||c.empresa||c.nome||'—'}</option>`
  ).join('');

  openModalWide(`${existing?'Editar':'Nova'} Medição de Fornecedor — ${novoId}`, `
    <div style="max-height:75vh;overflow-y:auto">
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px">
        <div><label style="font-size:11px;color:var(--text-muted)">Nº Medição Fornecedor</label>
          <input class="form-control" value="${novoId}" readonly style="background:var(--bg-tertiary)"></div>
        <div><label style="font-size:11px;color:var(--text-muted)">Período *</label>
          <input class="form-control" id="mff_periodo" type="month" value="${existing?.periodo||anoMes}"></div>
        <div><label style="font-size:11px;color:var(--text-muted)">Data de Referência</label>
          <input class="form-control" id="mff_data" type="date" value="${existing?.data_referencia||hoje}"></div>
        <div style="grid-column:1/-1"><label style="font-size:11px;color:var(--text-muted)">Contrato de Fornecimento *</label>
          <select class="form-control" id="mff_contrato">
            <option value="">Selecione o contrato de fornecimento...</option>
            ${contOptsHtml}
          </select></div>
        <div><label style="font-size:11px;color:var(--text-muted)">Valor Medido (R$) *</label>
          <input class="form-control" id="mff_valor" type="number" min="0" step="0.01" value="${existing?.valor||0}"></div>
        <div><label style="font-size:11px;color:var(--text-muted)">Responsável</label>
          <input class="form-control" id="mff_responsavel" value="${existing?.responsavel||currentUser?.name||''}"></div>
        <div><label style="font-size:11px;color:var(--text-muted)">Status</label>
          <select class="form-control" id="mff_status">
            ${['Rascunho','Pendente','Em Aprovação'].map(s=>`<option ${(existing?.status||'Rascunho')===s?'selected':''}>${s}</option>`).join('')}
          </select></div>
      </div>
      <div style="margin-bottom:10px"><label style="font-size:11px;color:var(--text-muted)">Descrição dos Serviços/Itens</label>
        <textarea class="form-control" id="mff_descricao" rows="3" placeholder="Descreva os serviços do fornecedor medidos no período...">${existing?.descricao||''}</textarea></div>
      <div><label style="font-size:11px;color:var(--text-muted)">Observações / Contestações</label>
        <textarea class="form-control" id="mff_obs" rows="2" placeholder="Observações, pendências, pontos a contestar...">${existing?.observacoes||''}</textarea></div>
    </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
     <button class="btn btn-primary" onclick="medSalvarForn('${novoId}','${existingId||''}')">
       <i class="fas fa-save"></i> Salvar Medição Fornecedor
     </button>`
  );
}

function medSalvarForn(novoId, existingId) {
  const periodo    = document.getElementById('mff_periodo')?.value||'';
  const contratoId = document.getElementById('mff_contrato')?.value||'';
  const valor      = parseFloat(document.getElementById('mff_valor')?.value)||0;
  const status     = document.getElementById('mff_status')?.value||'Rascunho';
  const responsavel= document.getElementById('mff_responsavel')?.value?.trim()||'';

  const erros = [];
  if (!periodo)    erros.push('Período obrigatório');
  if (!contratoId) erros.push('Selecione o contrato');
  if (valor<=0)    erros.push('Informe o valor');
  if (erros.length){ showToast('⚠️ '+erros.join(' | '),'error'); return; }

  const contForn = _getContForn();
  const c = contForn.find(x=>x.id===contratoId);

  const nova = {
    id:              novoId,
    numero:          novoId,
    periodo,
    data_referencia: document.getElementById('mff_data')?.value||'',
    contrato_id:     contratoId,
    contrato_nome:   c?.numero||c?.id||contratoId,
    fornecedor_nome: c?.fornecedor||c?.empresa||c?.nome||'',
    valor,
    descricao:       document.getElementById('mff_descricao')?.value?.trim()||'',
    observacoes:     document.getElementById('mff_obs')?.value?.trim()||'',
    responsavel,
    status,
    criado_por:      currentUser?.id||'',
    criado_por_nome: currentUser?.name||'',
    criado_em:       existingId ? undefined : new Date().toISOString(),
    atualizado_em:   new Date().toISOString(),
    historico:       [{acao:'Criada', por: currentUser?.name||'', em: new Date().toISOString()}],
  };

  let todos = _getMedForn();
  if (existingId) {
    const idx = todos.findIndex(x=>x.id===existingId);
    if (idx>=0) { nova.criado_em=todos[idx].criado_em; todos[idx]=nova; }
    else todos.unshift(nova);
  } else {
    todos.unshift(nova);
  }
  _saveMedForn(todos);
  closeModal();
  showToast('✅ Medição de fornecedor salva!','success');
  renderMedicao();
}

function medAprovarForn(id) {
  if (!_mPodeAprovar()) { showToast('Sem permissão.','error'); return; }
  const todos = _getMedForn();
  const idx   = todos.findIndex(x=>x.id===id);
  if (idx<0) return;
  todos[idx].status      = 'Aprovada';
  todos[idx].aprovado_em = new Date().toISOString();
  todos[idx].historico   = [...(todos[idx].historico||[]), {acao:'Aprovada', por: currentUser?.name||'', em: new Date().toISOString()}];
  _saveMedForn(todos);
  showToast('✅ Medição de fornecedor aprovada!','success');
  renderMedicao();
}

function medContestarForn(id) {
  const motivo = prompt('Motivo da contestação:');
  if (!motivo) return;
  const todos = _getMedForn();
  const idx   = todos.findIndex(x=>x.id===id);
  if (idx<0) return;
  todos[idx].status     = 'Contestada';
  todos[idx].historico  = [...(todos[idx].historico||[]), {acao:`Contestada: ${motivo}`, por: currentUser?.name||'', em: new Date().toISOString()}];
  _saveMedForn(todos);
  showToast('Medição contestada.','warning');
  renderMedicao();
}

/* ═══════════════════════════════════════════════════════════════════════════
   VER DETALHES
   ═══════════════════════════════════════════════════════════════════════════ */
function medVerCliente(id) {
  const m = _getMedicoes().find(x=>x.id===id);
  if (!m) return;

  const itensHtml = (m.itens_checklist||[]).map(it=>`
    <tr>
      <td style="font-size:12px">${it.descricao}</td>
      <td style="text-align:center;font-size:12px">${it.un}</td>
      <td style="text-align:center;font-size:12px">${it.qtd_periodo}</td>
      <td style="text-align:right;font-size:12px">${_mFmtBRL(it.valor_unit)}</td>
      <td style="text-align:right;font-weight:700;color:var(--fa-teal);font-size:12px">${_mFmtBRL(it.total)}</td>
    </tr>`).join('');

  const histHtml = (m.historico||[]).slice().reverse().map(h=>`
    <div style="display:flex;gap:8px;padding:6px 0;border-bottom:1px solid var(--border-color)">
      <i class="fas fa-circle" style="color:var(--fa-teal);font-size:6px;margin-top:6px"></i>
      <div>
        <div style="font-size:12px;font-weight:600">${h.acao}</div>
        <div style="font-size:10px;color:var(--text-muted)">${h.por} — ${h.em?new Date(h.em).toLocaleString('pt-BR'):'—'}</div>
      </div>
    </div>`).join('');

  openModalWide(`Medição ${m.numero||m.id}`, `
    <div style="max-height:80vh;overflow-y:auto">
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px;font-size:12px">
        <div style="background:var(--bg-card2);padding:10px;border-radius:8px">
          <div style="color:var(--text-muted);font-size:10px">Contrato / Cliente</div>
          <div style="font-weight:700;color:var(--fa-teal)">${m.contrato_nome||'—'}</div>
          <div style="color:var(--text-muted);font-size:11px">${m.cliente||'—'}</div>
        </div>
        <div style="background:var(--bg-card2);padding:10px;border-radius:8px">
          <div style="color:var(--text-muted);font-size:10px">Período / Tipo</div>
          <div style="font-weight:700">${m.periodo||'—'} · ${m.tipo||'—'}</div>
          <div style="color:var(--text-muted);font-size:11px">Ref: ${_mFmtDate(m.data_referencia)}</div>
        </div>
        <div style="background:var(--bg-card2);padding:10px;border-radius:8px">
          <div style="color:var(--text-muted);font-size:10px">Valor Total</div>
          <div style="font-weight:800;font-size:16px;color:var(--fa-teal)">${_mFmtBRL(m.valor)}</div>
          <div style="margin-top:4px">${_mBadge(m.status)}</div>
        </div>
        ${m.pct_realizado ? `
        <div style="background:var(--bg-card2);padding:10px;border-radius:8px;grid-column:1/-1">
          <div style="font-size:10px;color:var(--text-muted);margin-bottom:6px">Avanço Físico Acumulado</div>
          <div style="height:10px;background:var(--border-color);border-radius:5px;overflow:hidden">
            <div style="height:100%;width:${Math.min(m.pct_realizado,100)}%;background:var(--fa-teal);border-radius:5px"></div>
          </div>
          <div style="font-size:11px;margin-top:4px;text-align:right;font-weight:700">${m.pct_realizado}%</div>
        </div>` : ''}
      </div>

      ${itensHtml ? `
      <div style="margin-bottom:14px">
        <div style="font-size:12px;font-weight:700;margin-bottom:6px"><i class="fas fa-list" style="color:var(--fa-teal);margin-right:4px"></i>Itens Medidos</div>
        <table class="ss-table">
          <thead><tr><th>Descrição</th><th style="text-align:center">UN</th><th style="text-align:center">Qtd</th><th style="text-align:right">V.Unit</th><th style="text-align:right">Total</th></tr></thead>
          <tbody>${itensHtml}</tbody>
        </table>
      </div>` : ''}

      ${m.descricao ? `
      <div style="margin-bottom:14px;background:var(--bg-card2);padding:12px;border-radius:8px">
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">Descrição</div>
        <div style="font-size:12px;line-height:1.6">${m.descricao}</div>
      </div>` : ''}

      ${histHtml ? `
      <div>
        <div style="font-size:12px;font-weight:700;margin-bottom:6px">Histórico</div>
        ${histHtml}
      </div>` : ''}
    </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
     ${(m.status==='Rascunho'||m.status==='Reprovada')&&_mPodeCriar()?`<button class="btn btn-primary" onclick="closeModal();medEditarCliente('${m.id}')"><i class="fas fa-edit"></i> Editar</button>`:''}
     ${(m.status==='Pendente'||m.status==='Em Aprovação')&&_mPodeAprovar()?`<button class="btn btn-primary" onclick="closeModal();medAprovarCliente('${m.id}')" style="background:#16a34a"><i class="fas fa-check"></i> Aprovar</button>`:''}
     <button class="btn btn-secondary" onclick="medGerarPDF('${m.id}','cliente')"><i class="fas fa-file-pdf" style="color:#ef4444"></i> PDF</button>`
  );
}

function medVerForn(id) {
  const m = _getMedForn().find(x=>x.id===id);
  if (!m) return;
  openModal(`Medição Fornecedor — ${m.numero||m.id}`, `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;font-size:12px">
      <div><span style="color:var(--text-muted);font-size:10px">Fornecedor</span><div style="font-weight:700">${m.fornecedor_nome||'—'}</div></div>
      <div><span style="color:var(--text-muted);font-size:10px">Período</span><div style="font-weight:700">${m.periodo||'—'}</div></div>
      <div><span style="color:var(--text-muted);font-size:10px">Valor</span><div style="font-weight:700;color:#6366f1">${_mFmtBRL(m.valor)}</div></div>
      <div><span style="color:var(--text-muted);font-size:10px">Status</span><div style="margin-top:4px">${_mBadge(m.status)}</div></div>
    </div>
    ${m.descricao?`<div style="background:var(--bg-card2);padding:10px;border-radius:8px;font-size:12px;line-height:1.6">${m.descricao}</div>`:''}`,
    `<button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
     ${_mPodeAprovar()&&(m.status==='Pendente'||m.status==='Em Aprovação')?`<button class="btn btn-primary" onclick="closeModal();medAprovarForn('${m.id}')" style="background:#16a34a"><i class="fas fa-check"></i> Aprovar</button>`:''}
    `
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   GERAR PDF
   ═══════════════════════════════════════════════════════════════════════════ */
function medGerarPDF(id, tipo) {
  const m = tipo==='fornecedor' ? _getMedForn().find(x=>x.id===id) : _getMedicoes().find(x=>x.id===id);
  if (!m) return;

  const itensTable = (m.itens_checklist||[]).length ? `
    <h3>Itens Medidos</h3>
    <table border="1" cellpadding="6" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:12px">
      <thead style="background:#f0f0f0">
        <tr><th>Descrição</th><th>UN</th><th>Qtd</th><th>Valor Unit</th><th>Total</th></tr>
      </thead>
      <tbody>
        ${(m.itens_checklist||[]).map(it=>`
          <tr><td>${it.descricao}</td><td style="text-align:center">${it.un}</td>
          <td style="text-align:center">${it.qtd_periodo}</td>
          <td style="text-align:right">${_mFmtBRL(it.valor_unit)}</td>
          <td style="text-align:right;font-weight:bold">${_mFmtBRL(it.total)}</td></tr>`).join('')}
        <tr style="background:#f9f9f9"><td colspan="4" style="text-align:right;font-weight:bold">TOTAL</td>
          <td style="text-align:right;font-weight:bold;color:#00b4b8">${_mFmtBRL(m.valor)}</td></tr>
      </tbody>
    </table>` : '';

  const html = `
    <h2 style="color:#00b4b8">RELATÓRIO DE MEDIÇÃO</h2>
    <table border="0" cellpadding="6" style="width:100%;font-size:13px">
      <tr><td><strong>Número:</strong></td><td>${m.numero||m.id}</td>
          <td><strong>Período:</strong></td><td>${m.periodo||'—'}</td></tr>
      <tr><td><strong>Contrato:</strong></td><td>${m.contrato_nome||'—'}</td>
          <td><strong>Cliente:</strong></td><td>${m.cliente||m.fornecedor_nome||'—'}</td></tr>
      <tr><td><strong>Status:</strong></td><td>${m.status}</td>
          <td><strong>Responsável:</strong></td><td>${m.responsavel||'—'}</td></tr>
      <tr><td><strong>Valor Total:</strong></td><td><strong style="color:#00b4b8;font-size:16px">${_mFmtBRL(m.valor)}</strong></td>
          ${m.pct_realizado?`<td><strong>Avanço Físico:</strong></td><td>${m.pct_realizado}%</td>`:'<td colspan="2"></td>'}
      </tr>
    </table>
    ${m.descricao?`<h3>Descrição</h3><p style="background:#f9f9f9;padding:10px;border-radius:4px">${m.descricao}</p>`:''}
    ${itensTable}
    ${m.observacoes?`<h3>Observações</h3><p>${m.observacoes}</p>`:''}
    <h3>Histórico</h3>
    <table border="1" cellpadding="5" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:11px">
      <thead style="background:#f0f0f0"><tr><th>Ação</th><th>Por</th><th>Em</th></tr></thead>
      <tbody>${(m.historico||[]).map(h=>`<tr><td>${h.acao}</td><td>${h.por||h.usuario||'—'}</td><td>${h.em?new Date(h.em).toLocaleString('pt-BR'):'—'}</td></tr>`).join('')}</tbody>
    </table>
    <p style="margin-top:40px;font-size:11px;color:#999">Gerado em: ${new Date().toLocaleString('pt-BR')} | ERP Serviços e Operações</p>`;

  if (typeof gerarPDF === 'function') { gerarPDF(`Medição – ${m.numero||m.id}`, html); return; }
  const w = window.open('','_blank');
  if (w) {
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Medição ${m.numero||m.id}</title>
      <style>body{font-family:Arial,sans-serif;padding:24px;color:#222}table{border-collapse:collapse}th,td{padding:6px 10px;border:1px solid #ddd}h2{color:#00b4b8}</style></head><body>${html}
      <button onclick="window.print()" style="margin-top:16px;padding:8px 18px;background:#00b4b8;color:#fff;border:none;border-radius:6px;cursor:pointer">Imprimir / PDF</button>
      </body></html>`);
    w.document.close();
  }
}

/* ── Exports ────────────────────────────────────────────────────────────── */
window.renderMedicao        = renderMedicao;
window.medMudarAba          = medMudarAba;
window.medFiltrarCliente    = medFiltrarCliente;
window.medFiltrarForn       = medFiltrarForn;
window.medNovaCliente       = medNovaCliente;
window.medNovaFornecedor    = medNovaFornecedor;
window.medEditarCliente     = medEditarCliente;
window.medEditarForn        = medEditarForn;
window.medAbrirFormCliente  = medAbrirFormCliente;
window.medAbrirFormForn     = medAbrirFormForn;
window.medMudarAbaForm      = medMudarAbaForm;
window.medOnChangeContrato  = medOnChangeContrato;
window.medAddItemLinha      = medAddItemLinha;
window.medCalcTotal         = medCalcTotal;
window.medCalcPctRealizado  = medCalcPctRealizado;
window.medSalvarCliente     = medSalvarCliente;
window.medSalvarForn        = medSalvarForn;
window.medEnviarAprovacao   = medEnviarAprovacao;
window.medAprovarCliente    = medAprovarCliente;
window.medReprovarCliente   = medReprovarCliente;
window.medFaturar           = medFaturar;
window.medConfirmarFaturamento = medConfirmarFaturamento;
window.medAprovarForn       = medAprovarForn;
window.medContestarForn     = medContestarForn;
window.medVerCliente        = medVerCliente;
window.medVerForn           = medVerForn;
window.medGerarPDF          = medGerarPDF;

// Compatibilidade com chamadas legadas
window.abrirNovaMedicao  = medNovaCliente;
window.verDetalhesMedicao = medVerCliente;
window.aprovarMedicao    = medAprovarCliente;
window.exportarMedicoes  = function() {
  if (typeof exportarCSV === 'function') {
    exportarCSV(_getMedicoes(), 'medicoes', [
      {key:'numero',label:'Número'},{key:'periodo',label:'Período'},
      {key:'contrato_nome',label:'Contrato'},{key:'cliente',label:'Cliente'},
      {key:'valor',label:'Valor'},{key:'status',label:'Status'}
    ]);
  }
};

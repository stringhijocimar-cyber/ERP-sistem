// =====================================================================
// Fraser Alexander ERP – Módulo: Projetos / Gantt
// Gestão completa de projetos: WBS, Gantt, Recursos, Medições, Curva S
// =====================================================================

// ─── STORAGE HELPERS ─────────────────────────────────────────────────
function _getProjetos()   { try { return JSON.parse(localStorage.getItem('fa_projetos_gantt') || '[]'); } catch(e) { return []; } }
function _saveProjetos(d) { localStorage.setItem('fa_projetos_gantt', JSON.stringify(d)); try { window._syncSnapshot && window._syncSnapshot('projetos', d); } catch(e){} }
function _getProjetoById(id) { return _getProjetos().find(p => p.id === id) || null; }

// ─── ESTADO DO MÓDULO ─────────────────────────────────────────────────
let _pgProjetoAtivo = null;   // ID do projeto selecionado
let _pgAbaAtiva     = 'gantt'; // gantt | wbs | recursos | medicoes | curvas | os

// ─── CORES POR FASE ───────────────────────────────────────────────────
const PG_FASE_CORES = {
  'Mobilização':      { bg: '#3b82f6', light: 'rgba(59,130,246,0.15)', text: '#1d4ed8' },
  'Construção':       { bg: '#f59e0b', light: 'rgba(245,158,11,0.15)', text: '#b45309' },
  'Instalações':      { bg: '#8b5cf6', light: 'rgba(139,92,246,0.15)', text: '#6d28d9' },
  'Comissionamento':  { bg: '#06b6d4', light: 'rgba(6,182,212,0.15)',  text: '#0e7490' },
  'Operação':         { bg: '#10b981', light: 'rgba(16,185,129,0.15)', text: '#047857' },
  'Desmobilização':   { bg: '#ef4444', light: 'rgba(239,68,68,0.15)',  text: '#b91c1c' },
  'Marco':            { bg: '#f97316', light: 'rgba(249,115,22,0.15)', text: '#c2410c' },
};

const PG_STATUS_BADGE = {
  'Não Iniciada': { bg:'#64748b', icon:'fa-circle' },
  'Em Andamento': { bg:'#3b82f6', icon:'fa-spinner' },
  'Concluída':    { bg:'#10b981', icon:'fa-check-circle' },
  'Atrasada':     { bg:'#ef4444', icon:'fa-exclamation-circle' },
  'Suspensa':     { bg:'#f59e0b', icon:'fa-pause-circle' },
};

// ─── RENDER PRINCIPAL ─────────────────────────────────────────────────
function renderProjetosGantt() {
  const mc = document.getElementById('mainContent');
  if (!mc) return;

  const projetos = _getProjetos();

  mc.innerHTML = `
  <div style="padding:0;background:#0f172a;min-height:100vh">

    <!-- HEADER -->
    <div style="background:linear-gradient(135deg,#1e293b 0%,#0f172a 100%);
                border-bottom:1px solid rgba(255,255,255,0.07);
                padding:20px 28px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
      <div>
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:4px">
          <div style="width:40px;height:40px;background:linear-gradient(135deg,#10b981,#059669);
                      border-radius:10px;display:flex;align-items:center;justify-content:center">
            <i class="fas fa-project-diagram" style="color:#fff;font-size:18px"></i>
          </div>
          <div>
            <h1 style="margin:0;font-size:22px;font-weight:700;color:#f1f5f9">Projetos & Gantt</h1>
            <p style="margin:0;font-size:12px;color:#64748b">Acompanhamento por fases WBS · Recursos · Medições</p>
          </div>
        </div>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button onclick="pgNovoProjetoModal()"
          style="background:linear-gradient(135deg,#10b981,#059669);color:#fff;border:none;
                 border-radius:8px;padding:9px 18px;font-size:13px;font-weight:600;cursor:pointer;
                 display:flex;align-items:center;gap:8px">
          <i class="fas fa-plus"></i> Novo Projeto
        </button>
        <button onclick="pgExportarPDF()"
          style="background:#1e293b;color:#94a3b8;border:1px solid rgba(255,255,255,0.1);
                 border-radius:8px;padding:9px 18px;font-size:13px;cursor:pointer">
          <i class="fas fa-file-pdf"></i> PDF
        </button>
      </div>
    </div>

    <!-- LISTA DE PROJETOS (cards) -->
    <div style="padding:20px 28px">
      ${projetos.length === 0 ? _pgEmptyState() : _pgListaProjetos(projetos)}
    </div>

    <!-- DETALHE DO PROJETO (oculto inicialmente) -->
    <div id="pg-detalhe" style="display:none;padding:0 28px 28px"></div>
  </div>`;

  // Abre automaticamente o primeiro projeto ativo
  if (projetos.length > 0 && !_pgProjetoAtivo) {
    const ativo = projetos.find(p => p.status === 'Em Andamento') || projetos[0];
    setTimeout(() => pgAbrirProjeto(ativo.id), 100);
  } else if (_pgProjetoAtivo) {
    setTimeout(() => pgAbrirProjeto(_pgProjetoAtivo), 100);
  }
}

// ─── EMPTY STATE ──────────────────────────────────────────────────────
function _pgEmptyState() {
  return `<div style="text-align:center;padding:80px 20px;color:#475569">
    <i class="fas fa-project-diagram" style="font-size:56px;margin-bottom:16px;opacity:.3"></i>
    <h3 style="color:#94a3b8;margin-bottom:8px">Nenhum projeto cadastrado</h3>
    <p style="font-size:14px;margin-bottom:24px">Crie o primeiro projeto para começar o acompanhamento por fases WBS</p>
    <button onclick="pgNovoProjetoModal()"
      style="background:linear-gradient(135deg,#10b981,#059669);color:#fff;border:none;
             border-radius:8px;padding:12px 28px;font-size:14px;font-weight:600;cursor:pointer">
      <i class="fas fa-plus"></i> Criar Primeiro Projeto
    </button>
  </div>`;
}

// ─── LISTA CARDS DE PROJETOS ──────────────────────────────────────────
function _pgListaProjetos(projetos) {
  return `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px;margin-bottom:24px">
    ${projetos.map(p => {
      const totalTarefas = (p.fases || []).reduce((s, f) => s + (f.tarefas || []).length, 0);
      const concluidas   = (p.fases || []).reduce((s, f) => s + (f.tarefas || []).filter(t => t.status === 'Concluída').length, 0);
      const pct = totalTarefas > 0 ? Math.round((concluidas / totalTarefas) * 100) : (p.avanco_geral || 0);
      const st  = PG_STATUS_BADGE[p.status] || PG_STATUS_BADGE['Em Andamento'];
      const ativo = _pgProjetoAtivo === p.id;
      return `
      <div onclick="pgAbrirProjeto('${p.id}')" style="
        background:${ativo ? 'linear-gradient(135deg,rgba(16,185,129,0.12),rgba(5,150,105,0.06))' : '#1e293b'};
        border:${ativo ? '2px solid #10b981' : '1px solid rgba(255,255,255,0.07)'};
        border-radius:12px;padding:20px;cursor:pointer;transition:all .2s;position:relative;overflow:hidden">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
          <div>
            <div style="font-size:11px;color:#64748b;margin-bottom:4px">${p.id} · ${p.contrato_id || '–'}</div>
            <div style="font-size:15px;font-weight:700;color:#f1f5f9;line-height:1.3">${p.nome}</div>
            <div style="font-size:12px;color:#64748b;margin-top:2px">${p.cliente || 'Fraser Alexander'}</div>
          </div>
          <span style="background:${st.bg};color:#fff;font-size:10px;font-weight:600;
                       padding:3px 8px;border-radius:20px;white-space:nowrap">
            <i class="fas ${st.icon}" style="margin-right:4px"></i>${p.status}
          </span>
        </div>
        <div style="margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;font-size:11px;color:#64748b;margin-bottom:4px">
            <span>Avanço físico</span><span style="color:#10b981;font-weight:700">${pct}%</span>
          </div>
          <div style="background:rgba(255,255,255,0.06);border-radius:4px;height:6px;overflow:hidden">
            <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#10b981,#059669);border-radius:4px;transition:width .6s"></div>
          </div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:11px;color:#64748b">
          <span><i class="fas fa-tasks" style="margin-right:4px"></i>${concluidas}/${totalTarefas} tarefas</span>
          <span><i class="fas fa-calendar" style="margin-right:4px"></i>${p.data_inicio || '–'} → ${p.data_fim || '–'}</span>
        </div>
        ${ativo ? '<div style="position:absolute;top:0;right:0;width:4px;height:100%;background:#10b981;border-radius:0 12px 12px 0"></div>' : ''}
      </div>`;
    }).join('')}
  </div>`;
}

// ─── ABRIR PROJETO (carrega detalhe) ─────────────────────────────────
function pgAbrirProjeto(id) {
  _pgProjetoAtivo = id;
  const proj = _getProjetoById(id);
  if (!proj) return;

  // Re-renderiza lista para atualizar seleção
  const listDiv = document.querySelector('#mainContent > div > div');
  if (listDiv) {
    const ps = _getProjetos();
    listDiv.innerHTML = ps.length ? _pgListaProjetos(ps) : _pgEmptyState();
  }

  const det = document.getElementById('pg-detalhe');
  if (!det) return;
  det.style.display = 'block';
  det.innerHTML = _pgDetalheHTML(proj);
  pgSwitchAba(_pgAbaAtiva, proj.id);
}

// ─── DETALHE: HEADER + ABAS ───────────────────────────────────────────
function _pgDetalheHTML(proj) {
  const abas = [
    { id:'gantt',       icon:'fa-stream',          label:'Gantt' },
    { id:'wbs',         icon:'fa-sitemap',          label:'WBS / Tarefas' },
    { id:'recursos',    icon:'fa-users-cog',        label:'Recursos' },
    { id:'medicoes',    icon:'fa-ruler-combined',   label:'Medições' },
    { id:'curvas',      icon:'fa-chart-area',       label:'Curva S' },
    { id:'os',          icon:'fa-clipboard-list',   label:'OS Vinculadas' },
    { id:'suprimentos', icon:'fa-shopping-cart',    label:'Suprimentos' },
  ];
  return `
  <div style="background:#1e293b;border:1px solid rgba(255,255,255,0.07);border-radius:14px;overflow:hidden;margin-top:8px">

    <!-- Cabeçalho do projeto -->
    <div style="background:linear-gradient(135deg,#0f172a,#1e293b);padding:20px 24px;
                border-bottom:1px solid rgba(255,255,255,0.07)">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
        <div>
          <div style="font-size:12px;color:#10b981;font-weight:600;margin-bottom:4px">
            <i class="fas fa-folder-open" style="margin-right:6px"></i>${proj.id} · ${proj.contrato_id || ''}
          </div>
          <h2 style="margin:0;font-size:20px;font-weight:700;color:#f1f5f9">${proj.nome}</h2>
          <div style="font-size:13px;color:#64748b;margin-top:4px">
            ${proj.descricao || ''}
          </div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button onclick="pgEditarProjeto('${proj.id}')"
            style="background:#1e293b;color:#94a3b8;border:1px solid rgba(255,255,255,0.1);
                   border-radius:8px;padding:7px 14px;font-size:12px;cursor:pointer">
            <i class="fas fa-edit"></i> Editar
          </button>
          <button onclick="pgNovaTarefaModal('${proj.id}')"
            style="background:linear-gradient(135deg,#3b82f6,#2563eb);color:#fff;border:none;
                   border-radius:8px;padding:7px 14px;font-size:12px;font-weight:600;cursor:pointer">
            <i class="fas fa-plus"></i> Nova Tarefa
          </button>
          <button onclick="pgNovasMedicaoModal('${proj.id}')"
            style="background:linear-gradient(135deg,#10b981,#059669);color:#fff;border:none;
                   border-radius:8px;padding:7px 14px;font-size:12px;font-weight:600;cursor:pointer">
            <i class="fas fa-ruler-combined"></i> Nova Medição
          </button>
        </div>
      </div>

      <!-- KPIs rápidos -->
      ${_pgKPIsHTML(proj)}
    </div>

    <!-- Abas -->
    <div style="display:flex;gap:0;border-bottom:1px solid rgba(255,255,255,0.07);overflow-x:auto">
      ${abas.map(a => `
        <button id="pg-aba-btn-${a.id}" onclick="pgSwitchAba('${a.id}','${proj.id}')"
          style="background:transparent;border:none;border-bottom:2px solid transparent;
                 color:#64748b;padding:12px 18px;font-size:12px;font-weight:600;
                 cursor:pointer;white-space:nowrap;transition:all .2s">
          <i class="fas ${a.icon}" style="margin-right:6px"></i>${a.label}
        </button>`).join('')}
    </div>

    <!-- Conteúdo das abas -->
    <div id="pg-aba-content" style="padding:24px;min-height:300px"></div>
  </div>`;
}

// ─── KPIs DO PROJETO ──────────────────────────────────────────────────
function _pgKPIsHTML(proj) {
  const fases = proj.fases || [];
  const tarefas = fases.flatMap(f => f.tarefas || []);
  const total    = tarefas.length;
  const conc     = tarefas.filter(t => t.status === 'Concluída').length;
  const and      = tarefas.filter(t => t.status === 'Em Andamento').length;
  const atras    = tarefas.filter(t => t.status === 'Atrasada').length;
  const pct      = total > 0 ? Math.round((conc / total) * 100) : (proj.avanco_geral || 0);

  const medicoes = proj.medicoes || [];
  const vlrMedido = medicoes.reduce((s, m) => s + (m.valor_medido || 0), 0);
  const vlrContr  = proj.valor_contrato || 0;
  const pctFin    = vlrContr > 0 ? Math.round((vlrMedido / vlrContr) * 100) : 0;

  const kpis = [
    { label:'Avanço Físico',   val:`${pct}%`,               icon:'fa-chart-line',      cor:'#10b981' },
    { label:'Tarefas',         val:`${conc}/${total}`,       icon:'fa-tasks',           cor:'#3b82f6' },
    { label:'Em Andamento',    val:and,                      icon:'fa-spinner',         cor:'#f59e0b' },
    { label:'Atrasadas',       val:atras,                    icon:'fa-exclamation',     cor:atras>0?'#ef4444':'#64748b' },
    { label:'Valor Medido',    val:`R$ ${_pgFmt(vlrMedido)}`,icon:'fa-ruler-combined',  cor:'#8b5cf6' },
    { label:'% Financeiro',    val:`${pctFin}%`,             icon:'fa-percentage',      cor:'#06b6d4' },
  ];

  return `<div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:16px">
    ${kpis.map(k => `
      <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);
                  border-radius:10px;padding:10px 16px;min-width:110px;flex:1">
        <div style="font-size:10px;color:#64748b;margin-bottom:4px;text-transform:uppercase;letter-spacing:.5px">
          <i class="fas ${k.icon}" style="margin-right:4px;color:${k.cor}"></i>${k.label}
        </div>
        <div style="font-size:20px;font-weight:700;color:${k.cor}">${k.val}</div>
      </div>`).join('')}
  </div>`;
}

// ─── SWITCH DE ABAS ───────────────────────────────────────────────────
function pgSwitchAba(abaId, projId) {
  _pgAbaAtiva = abaId;
  document.querySelectorAll('[id^="pg-aba-btn-"]').forEach(b => {
    b.style.borderBottomColor = 'transparent';
    b.style.color = '#64748b';
  });
  const btn = document.getElementById(`pg-aba-btn-${abaId}`);
  if (btn) { btn.style.borderBottomColor = '#10b981'; btn.style.color = '#10b981'; }

  const proj = _getProjetoById(projId || _pgProjetoAtivo);
  const cont = document.getElementById('pg-aba-content');
  if (!cont || !proj) return;

  switch(abaId) {
    case 'gantt':    cont.innerHTML = _pgRenderGantt(proj);    break;
    case 'wbs':      cont.innerHTML = _pgRenderWBS(proj);      break;
    case 'recursos': cont.innerHTML = _pgRenderRecursos(proj); break;
    case 'medicoes': cont.innerHTML = _pgRenderMedicoes(proj); break;
    case 'curvas':   cont.innerHTML = _pgRenderCurvas(proj);   break;
    case 'os':          cont.innerHTML = _pgRenderOS(proj);          break;
    case 'suprimentos': cont.innerHTML = _pgRenderSuprimentos(proj); break;
  }
  if (abaId === 'curvas') setTimeout(() => _pgDrawCurvaS(proj), 100);
}

// ─── ABA: GANTT ────────────────────────────────────────────────────────
function _pgRenderGantt(proj) {
  const fases = proj.fases || [];
  if (!fases.length) return _pgVazio('Nenhuma fase/tarefa cadastrada. Use "Nova Tarefa" para começar.');

  // Calcular intervalo de datas
  const toDate = s => { if (!s) return null; const [d,m,a] = s.split('/'); return new Date(`${a}-${m}-${d}`); };
  const fmtD   = d => d ? d.toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}) : '–';
  const fmtFull= d => d ? d.toLocaleDateString('pt-BR') : '–';

  let minD = null, maxD = null;
  fases.forEach(f => (f.tarefas||[]).forEach(t => {
    const i = toDate(t.inicio), e = toDate(t.fim);
    if (i && (!minD || i < minD)) minD = i;
    if (e && (!maxD || e > maxD)) maxD = e;
  }));
  if (!minD) { minD = new Date(); maxD = new Date(minD); maxD.setMonth(maxD.getMonth() + 6); }
  const totalDias = Math.max(1, Math.round((maxD - minD) / 86400000)) + 14;

  // Cabeçalho de meses e semanas
  let meses = [], trimestres = [];
  let cur = new Date(minD); cur.setDate(1);
  while (cur <= maxD) {
    const leftPct = Math.max(0, Math.round((cur - minD) / 86400000) / totalDias * 100);
    meses.push({ label: cur.toLocaleDateString('pt-BR',{month:'short', year:'2-digit'}), left: leftPct, date: new Date(cur) });
    const q = Math.floor(cur.getMonth() / 3) + 1;
    const qLabel = `T${q}/${cur.getFullYear().toString().slice(2)}`;
    if (!trimestres.length || trimestres[trimestres.length-1].label !== qLabel) {
      trimestres.push({ label: qLabel, left: leftPct });
    }
    cur.setMonth(cur.getMonth() + 1);
  }

  const hoje = new Date();
  const hojeOffset = Math.round((hoje - minD) / 86400000);
  const hojeX = Math.min(100, Math.max(0, (hojeOffset / totalDias) * 100));

  // Resumo por fase para a barra de progresso lateral
  let rows = '';
  let totalTarefas = 0, totalConc = 0;

  fases.forEach((fase, fi) => {
    const cor = (PG_FASE_CORES[fase.nome] || PG_FASE_CORES['Operação']);
    const tarefas = fase.tarefas || [];
    const faseConc = tarefas.filter(t => t.status === 'Concluída').length;
    const faseAnd  = tarefas.filter(t => t.status === 'Em Andamento').length;
    const fasePct  = tarefas.length ? Math.round(tarefas.reduce((s,t) => s+(t.avanco||0), 0) / tarefas.length) : 0;
    totalTarefas += tarefas.length;
    totalConc    += faseConc;

    // Calcular span da fase no Gantt
    let fIni = null, fFim = null;
    tarefas.forEach(t => {
      const i = toDate(t.inicio), e = toDate(t.fim);
      if (i && (!fIni || i < fIni)) fIni = i;
      if (e && (!fFim || e > fFim)) fFim = e;
    });
    const fLeft  = fIni ? Math.max(0, Math.round((fIni - minD) / 86400000) / totalDias * 100) : 0;
    const fWidth = (fIni && fFim) ? Math.max(1, Math.round((fFim - fIni) / 86400000 + 1) / totalDias * 100) : 0;

    rows += `
    <tr>
      <td colspan="2" style="background:${cor.light};border-bottom:1px solid rgba(255,255,255,0.05)">
        <div style="display:flex;align-items:center;gap:8px;padding:7px 14px">
          <span style="background:${cor.bg};color:#fff;font-size:9px;font-weight:700;padding:2px 8px;border-radius:10px;white-space:nowrap">${fase.nome.toUpperCase()}</span>
          <span style="font-size:10px;color:${cor.text};font-weight:600">${fasePct}%</span>
          <div style="flex:1;background:rgba(255,255,255,0.08);border-radius:3px;height:4px;max-width:80px">
            <div style="height:100%;width:${fasePct}%;background:${cor.bg};border-radius:3px"></div>
          </div>
          <span style="font-size:10px;color:#475569">${faseConc}/${tarefas.length} concl.</span>
        </div>
      </td>
      <td style="background:${cor.light};border-bottom:1px solid rgba(255,255,255,0.05);position:relative;height:34px;padding:0">
        ${fWidth > 0 ? `<div title="${fase.nome}: ${fmtFull(fIni)} → ${fmtFull(fFim)}"
          style="position:absolute;left:${fLeft}%;width:${fWidth}%;height:8px;top:13px;
                 background:${cor.bg};opacity:.25;border-radius:4px"></div>` : ''}
      </td>
    </tr>`;

    tarefas.forEach((t, ti) => {
      const ini = toDate(t.inicio), fim = toDate(t.fim);
      let left = 0, width = 0;
      if (ini && fim) {
        left  = Math.max(0, Math.round((ini - minD) / 86400000) / totalDias * 100);
        width = Math.max(0.5, Math.round((fim - ini) / 86400000 + 1) / totalDias * 100);
      }
      const st     = PG_STATUS_BADGE[t.status] || PG_STATUS_BADGE['Não Iniciada'];
      const pct    = t.avanco || 0;
      const barCor = t.status === 'Atrasada' ? '#ef4444' : t.status === 'Concluída' ? '#10b981' : cor.bg;
      const isMarco= t.tipo === 'Marco';
      // Dias de duração
      const duracao = (ini && fim) ? Math.round((fim - ini) / 86400000) + 1 : 0;
      // Tooltip
      const tooltip = `${t.nome} | ${fmtD(ini)} → ${fmtD(fim)} (${duracao}d) | ${pct}% concluído | ${t.responsavel||'–'}`;

      rows += `
      <tr style="border-bottom:1px solid rgba(255,255,255,0.03)" id="trow-${t.id}"
          onmouseover="this.style.background='rgba(255,255,255,0.03)';_pgShowTarefaTooltip('${t.id}')"
          onmouseout="this.style.background='';_pgHideTooltip()">
        <td style="padding:6px 12px 6px 26px;min-width:220px;max-width:260px">
          <div style="display:flex;align-items:center;gap:7px">
            ${isMarco
              ? `<span style="width:10px;height:10px;background:#f97316;transform:rotate(45deg);display:inline-block;border-radius:1px;flex-shrink:0"></span>`
              : `<i class="fas ${st.icon}" style="color:${st.bg};font-size:10px;flex-shrink:0"></i>`}
            <span style="font-size:12px;color:#cbd5e1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${t.nome}">${t.nome}</span>
          </div>
          <div style="display:flex;align-items:center;gap:6px;padding-left:17px;margin-top:2px">
            ${t.responsavel ? `<span style="font-size:9px;color:#475569"><i class="fas fa-user" style="margin-right:2px"></i>${t.responsavel}</span>` : ''}
            ${(t.recursos||[]).length ? `<span style="font-size:9px;color:#334155;border-left:1px solid rgba(255,255,255,0.06);padding-left:4px"><i class="fas fa-cogs" style="margin-right:2px"></i>${t.recursos.length} rec.</span>` : ''}
          </div>
        </td>
        <td style="padding:4px 8px;white-space:nowrap;font-size:10px;color:#475569;min-width:130px">
          <div style="color:#64748b">${fmtD(ini)} → ${fmtD(fim)}</div>
          <div style="display:flex;align-items:center;gap:4px;margin-top:2px">
            <div style="background:rgba(255,255,255,0.08);border-radius:3px;height:4px;width:50px">
              <div style="height:100%;width:${pct}%;background:${barCor};border-radius:3px"></div>
            </div>
            <span style="color:${barCor};font-weight:700;font-size:9px">${pct}%</span>
          </div>
        </td>
        <td style="position:relative;height:38px;padding:4px 0" title="${tooltip}">
          <div style="position:relative;height:24px;margin:3px 2px">
            ${isMarco
              ? `<!-- Marco: losango -->
                 <div style="position:absolute;left:calc(${left}% - 8px);top:4px;
                   width:16px;height:16px;background:#f97316;transform:rotate(45deg);border-radius:2px;
                   box-shadow:0 0 8px rgba(249,115,22,0.5)" title="${t.nome}"></div>`
              : `<!-- Barra fundo -->
                 <div style="position:absolute;left:${left}%;width:${width}%;height:100%;
                             background:rgba(255,255,255,0.05);border-radius:5px;border:1px solid rgba(255,255,255,0.04)"></div>
                 <!-- Barra avanço -->
                 <div style="position:absolute;left:${left}%;width:${Math.min(width, width*pct/100)}%;
                             height:100%;background:${barCor};border-radius:5px 0 0 5px;
                             opacity:.9;transition:width .3s ease;
                             ${pct===100?'border-radius:5px':''}"></div>
                 <!-- Label % na barra -->
                 ${pct > 20 ? `<div style="position:absolute;left:${left}%;width:${Math.min(width, width*pct/100)}%;
                   height:100%;display:flex;align-items:center;justify-content:center;pointer-events:none">
                   <span style="font-size:9px;color:#fff;font-weight:700;white-space:nowrap;text-shadow:0 1px 2px rgba(0,0,0,0.5)">${pct}%</span>
                 </div>` : ''}`}
          </div>
        </td>
      </tr>`;
    });
  });

  // Cabeçalho de meses
  const mesHeader = meses.map(m => {
    return `<div style="position:absolute;left:${m.left}%;font-size:9px;color:#64748b;white-space:nowrap;
                        border-left:1px dashed rgba(255,255,255,0.07);padding-left:3px;top:2px">${m.label}</div>`;
  }).join('');

  const triHeader = trimestres.map(t => {
    return `<div style="position:absolute;left:${t.left}%;font-size:9px;color:#94a3b8;font-weight:700;white-space:nowrap;
                        padding:2px 4px;top:0">${t.label}</div>`;
  }).join('');

  return `
  <div>
    <!-- Mini tooltip flutuante -->
    <div id="pg-tooltip" style="display:none;position:fixed;background:#1e293b;border:1px solid rgba(255,255,255,0.12);
      border-radius:8px;padding:8px 12px;font-size:11px;color:#e2e8f0;z-index:9999;pointer-events:none;
      box-shadow:0 8px 32px rgba(0,0,0,0.5);max-width:280px"></div>

    <!-- Legenda + Filtros -->
    <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px;
                background:#0f172a;border-radius:8px;padding:10px 14px">
      <div style="display:flex;gap:10px;flex-wrap:wrap;flex:1">
        ${Object.entries(PG_FASE_CORES).filter(([k])=>k!=='Marco').map(([k,v])=>`
          <span style="display:flex;align-items:center;gap:4px;font-size:10px;color:#94a3b8">
            <span style="width:10px;height:10px;border-radius:2px;background:${v.bg};display:inline-block"></span>${k}
          </span>`).join('')}
        <span style="display:flex;align-items:center;gap:4px;font-size:10px;color:#94a3b8">
          <span style="width:10px;height:10px;background:#f97316;transform:rotate(45deg);display:inline-block;border-radius:1px"></span>Marco
        </span>
      </div>
      <div style="display:flex;gap:12px;align-items:center">
        <span style="font-size:10px;color:#f59e0b;font-weight:700">
          <i class="fas fa-ruler-vertical" style="margin-right:3px"></i>Hoje: ${hoje.toLocaleDateString('pt-BR')}
        </span>
        <span style="font-size:10px;color:#64748b">${totalConc}/${totalTarefas} tarefas concluídas</span>
      </div>
    </div>

    <div style="overflow-x:auto;border:1px solid rgba(255,255,255,0.06);border-radius:10px;overflow:hidden">
      <table style="width:100%;border-collapse:collapse;table-layout:fixed;min-width:700px">
        <colgroup>
          <col style="width:250px">
          <col style="width:130px">
          <col style="min-width:420px;width:auto">
        </colgroup>
        <thead>
          <!-- Trimestres -->
          <tr style="background:#070e1a">
            <th style="border-bottom:1px solid rgba(255,255,255,0.06);padding:4px 12px;text-align:left">
              <span style="font-size:9px;color:#334155;text-transform:uppercase;letter-spacing:.5px">Atividade</span>
            </th>
            <th style="border-bottom:1px solid rgba(255,255,255,0.06);padding:4px 8px;text-align:left">
              <span style="font-size:9px;color:#334155;text-transform:uppercase;letter-spacing:.5px">Período · Avanço</span>
            </th>
            <th style="border-bottom:1px solid rgba(255,255,255,0.06);padding:0;position:relative;height:22px">
              <div style="position:relative;height:22px;overflow:hidden">${triHeader}</div>
            </th>
          </tr>
          <!-- Meses + Linha do hoje -->
          <tr style="background:#0a1525">
            <th style="border-bottom:1px solid rgba(255,255,255,0.08);padding:4px 12px;text-align:left">
              <span style="font-size:9px;color:#3b82f6"><i class="fas fa-calendar-week" style="margin-right:3px"></i>${proj.nome.slice(0,30)}</span>
            </th>
            <th style="border-bottom:1px solid rgba(255,255,255,0.08);padding:4px 8px"></th>
            <th style="border-bottom:1px solid rgba(255,255,255,0.08);padding:0;position:relative;height:20px">
              <div style="position:relative;height:20px;overflow:hidden">${mesHeader}</div>
              <!-- Linha vermelha do hoje -->
              <div style="position:absolute;top:0;left:${hojeX}%;width:2px;height:100vh;
                          background:linear-gradient(180deg,#fbbf24,rgba(251,191,36,.1));
                          z-index:2;pointer-events:none;margin-top:-1px"></div>
            </th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>

    <!-- Resumo de duração -->
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:12px;font-size:11px;color:#475569">
      <span><i class="fas fa-calendar-alt" style="color:#3b82f6;margin-right:4px"></i>Início: <strong style="color:#94a3b8">${proj.data_inicio||'–'}</strong></span>
      <span><i class="fas fa-flag-checkered" style="color:#10b981;margin-right:4px"></i>Fim previsto: <strong style="color:#94a3b8">${proj.data_fim||'–'}</strong></span>
      <span><i class="fas fa-clock" style="color:#f59e0b;margin-right:4px"></i>Duração total: <strong style="color:#94a3b8">${totalDias-14} dias</strong></span>
      <span style="margin-left:auto;cursor:pointer;color:#3b82f6" onclick="pgSwitchAba('wbs','${proj.id}')">
        <i class="fas fa-table" style="margin-right:3px"></i>Ver tabela WBS detalhada →
      </span>
    </div>
  </div>`;
}

// ─── ABA: WBS / TAREFAS ────────────────────────────────────────────────
function _pgRenderWBS(proj) {
  const fases = proj.fases || [];
  if (!fases.length) return _pgVazio('Nenhuma tarefa. Clique em "Nova Tarefa" para adicionar.');

  const rows = fases.map((fase, fi) => {
    const cor = PG_FASE_CORES[fase.nome] || PG_FASE_CORES['Operação'];
    const tarefas = fase.tarefas || [];
    const pctFase = tarefas.length ? Math.round(tarefas.reduce((s,t)=>s+(t.avanco||0),0)/tarefas.length) : 0;
    return `
    <div style="margin-bottom:16px;border:1px solid rgba(255,255,255,0.07);border-radius:10px;overflow:hidden">
      <!-- Header da fase -->
      <div style="background:${cor.light};padding:12px 16px;display:flex;align-items:center;
                  justify-content:space-between;border-bottom:1px solid rgba(255,255,255,0.06)">
        <div style="display:flex;align-items:center;gap:12px">
          <span style="background:${cor.bg};color:#fff;font-size:11px;font-weight:700;
                       padding:3px 10px;border-radius:20px">${fi+1}. ${fase.nome}</span>
          <span style="font-size:12px;color:#94a3b8">${tarefas.length} tarefa(s)</span>
        </div>
        <div style="display:flex;align-items:center;gap:12px">
          <div style="font-size:11px;color:${cor.text};font-weight:700">${pctFase}% concluído</div>
          <div style="background:rgba(255,255,255,0.08);border-radius:4px;height:6px;width:80px">
            <div style="height:100%;width:${pctFase}%;background:${cor.bg};border-radius:4px"></div>
          </div>
          <button onclick="pgNovaTarefaModal('${proj.id}','${fase.id}')"
            style="background:${cor.bg};color:#fff;border:none;border-radius:6px;
                   padding:4px 10px;font-size:11px;cursor:pointer">
            <i class="fas fa-plus"></i>
          </button>
        </div>
      </div>
      <!-- Tarefas -->
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="background:#0f172a">
            <th style="color:#475569;font-size:10px;padding:6px 12px;text-align:left;font-weight:600">Cód.</th>
            <th style="color:#475569;font-size:10px;padding:6px 12px;text-align:left;font-weight:600">Tarefa</th>
            <th style="color:#475569;font-size:10px;padding:6px 8px;text-align:center;font-weight:600">Início</th>
            <th style="color:#475569;font-size:10px;padding:6px 8px;text-align:center;font-weight:600">Fim</th>
            <th style="color:#475569;font-size:10px;padding:6px 8px;text-align:center;font-weight:600">Responsável</th>
            <th style="color:#475569;font-size:10px;padding:6px 8px;text-align:center;font-weight:600">Avanço</th>
            <th style="color:#475569;font-size:10px;padding:6px 8px;text-align:center;font-weight:600">Status</th>
            <th style="color:#475569;font-size:10px;padding:6px 8px;text-align:center;font-weight:600">Ações</th>
          </tr>
        </thead>
        <tbody>
          ${tarefas.map((t, ti) => {
            const st = PG_STATUS_BADGE[t.status] || PG_STATUS_BADGE['Não Iniciada'];
            return `
            <tr style="border-top:1px solid rgba(255,255,255,0.04)"
                onmouseover="this.style.background='rgba(255,255,255,0.025)'"
                onmouseout="this.style.background=''">
              <td style="padding:8px 12px;font-size:11px;color:#475569;white-space:nowrap">
                ${fi+1}.${ti+1}
              </td>
              <td style="padding:8px 12px">
                <div style="font-size:12px;color:#cbd5e1;font-weight:600">${t.nome}</div>
                ${t.descricao ? `<div style="font-size:10px;color:#475569;margin-top:2px">${t.descricao}</div>` : ''}
                ${(t.recursos||[]).length ? `<div style="margin-top:4px;display:flex;gap:4px;flex-wrap:wrap">
                  ${t.recursos.map(r=>`<span style="background:rgba(59,130,246,0.15);color:#93c5fd;
                    font-size:9px;padding:1px 6px;border-radius:10px">${r}</span>`).join('')}
                </div>` : ''}
              </td>
              <td style="padding:8px;text-align:center;font-size:11px;color:#64748b">${t.inicio||'–'}</td>
              <td style="padding:8px;text-align:center;font-size:11px;color:#64748b">${t.fim||'–'}</td>
              <td style="padding:8px;text-align:center;font-size:11px;color:#94a3b8">${t.responsavel||'–'}</td>
              <td style="padding:8px;text-align:center">
                <div style="display:flex;align-items:center;gap:6px;justify-content:center">
                  <div style="background:rgba(255,255,255,0.08);border-radius:4px;height:5px;width:60px">
                    <div style="height:100%;width:${t.avanco||0}%;background:${st.bg};border-radius:4px"></div>
                  </div>
                  <span style="font-size:10px;color:${st.bg};font-weight:700">${t.avanco||0}%</span>
                </div>
              </td>
              <td style="padding:8px;text-align:center">
                <span style="background:${st.bg}22;color:${st.bg};font-size:10px;
                             padding:2px 8px;border-radius:10px;border:1px solid ${st.bg}44">
                  ${t.status||'Não Iniciada'}
                </span>
              </td>
              <td style="padding:8px;text-align:center">
                <button onclick="pgEditarTarefaModal('${proj.id}','${fase.id}','${t.id}')"
                  style="background:rgba(59,130,246,0.15);color:#93c5fd;border:none;
                         border-radius:6px;padding:4px 8px;font-size:10px;cursor:pointer">
                  <i class="fas fa-edit"></i>
                </button>
                <button onclick="pgAtualizarAvanco('${proj.id}','${fase.id}','${t.id}')"
                  style="background:rgba(16,185,129,0.15);color:#6ee7b7;border:none;
                         border-radius:6px;padding:4px 8px;font-size:10px;cursor:pointer;margin-left:4px">
                  <i class="fas fa-chart-line"></i>
                </button>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
  }).join('');

  return `<div>${rows}</div>`;
}

// ─── TOOLTIP HELPERS ──────────────────────────────────────────────────
function _pgShowTarefaTooltip(tarefaId) {
  // Encontra tarefa em todos os projetos
  const proj = _getProjetoById(_pgProjetoAtivo);
  if (!proj) return;
  let tarefa = null;
  for (const fase of (proj.fases||[])) {
    tarefa = (fase.tarefas||[]).find(t => t.id === tarefaId);
    if (tarefa) break;
  }
  if (!tarefa) return;
  const tt = document.getElementById('pg-tooltip');
  if (!tt) return;
  const toDate = s => { if (!s) return null; const [d,m,a] = s.split('/'); return new Date(`${a}-${m}-${d}`); };
  const ini = toDate(tarefa.inicio), fim = toDate(tarefa.fim);
  const duracao = (ini && fim) ? Math.round((fim - ini) / 86400000) + 1 : 0;
  const stCor = (PG_STATUS_BADGE[tarefa.status]||PG_STATUS_BADGE['Não Iniciada']).bg;
  tt.innerHTML = `
    <div style="font-weight:700;color:#f1f5f9;margin-bottom:6px;font-size:12px">${tarefa.nome}</div>
    <div style="display:grid;grid-template-columns:auto 1fr;gap:3px 8px;font-size:10px">
      <span style="color:#475569">Status</span><span style="color:${stCor};font-weight:600">${tarefa.status||'–'}</span>
      <span style="color:#475569">Período</span><span style="color:#94a3b8">${tarefa.inicio||'–'} → ${tarefa.fim||'–'} (${duracao}d)</span>
      <span style="color:#475569">Avanço</span><span style="color:#10b981;font-weight:700">${tarefa.avanco||0}%</span>
      ${tarefa.responsavel ? `<span style="color:#475569">Resp.</span><span style="color:#94a3b8">${tarefa.responsavel}</span>` : ''}
      ${tarefa.descricao ? `<span style="color:#475569;grid-column:1/-1;padding-top:4px;border-top:1px solid rgba(255,255,255,0.06)">${tarefa.descricao.slice(0,100)}${tarefa.descricao.length>100?'...':''}</span>` : ''}
      ${(tarefa.recursos||[]).length ? `<span style="color:#475569">Recursos</span><span style="color:#93c5fd">${tarefa.recursos.slice(0,3).join(', ')}${tarefa.recursos.length>3?'...':''}</span>` : ''}
    </div>`;
  tt.style.display = 'block';

  const row = document.getElementById(`trow-${tarefaId}`);
  if (row) {
    const rect = row.getBoundingClientRect();
    tt.style.top = `${rect.bottom + 4}px`;
    tt.style.left = `${Math.min(rect.left, window.innerWidth - 300)}px`;
  }
}

function _pgHideTooltip() {
  const tt = document.getElementById('pg-tooltip');
  if (tt) tt.style.display = 'none';
}

// ─── ABA: RECURSOS ────────────────────────────────────────────────────
function _pgRenderRecursos(proj) {
  const recursos = proj.recursos || [];

  const iconG = { 'Equipe':'fa-users', 'Equipamento':'fa-cogs', 'Material':'fa-boxes', 'Serviço':'fa-handshake' };
  const corG  = { 'Equipe':'#3b82f6', 'Equipamento':'#f59e0b', 'Material':'#10b981', 'Serviço':'#8b5cf6' };

  // Calcula distribuição por tipo
  const porTipo = {};
  recursos.forEach(r => { porTipo[r.tipo] = (porTipo[r.tipo]||[]).concat(r); });
  const totalCusto = recursos.reduce((s, r) => s + (r.custo_total || 0), 0);

  // Histograma de alocação por fase
  const fases = proj.fases || [];
  const fasesNomes = fases.map(f => f.nome);
  const custosFase = {};
  const recursosFase = {};
  fases.forEach(f => {
    custosFase[f.nome] = 0;
    recursosFase[f.nome] = 0;
  });
  recursos.forEach(r => {
    const fn = r.fase;
    if (fn && custosFase[fn] !== undefined) {
      custosFase[fn] += (r.custo_total || 0);
      recursosFase[fn]++;
    }
  });
  const maxCustoFase = Math.max(1, ...Object.values(custosFase));

  // Contar recursos por fase (tarefas)
  const equipeTotal = (porTipo['Equipe']||[]).reduce((s,r) => s + (r.quantidade||0), 0);
  const equipTotal  = (porTipo['Equipamento']||[]).length;
  const matTotal    = (porTipo['Material']||[]).length;
  const servTotal   = (porTipo['Serviço']||[]).length;

  return `
  <div>
    <!-- KPIs de recursos -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:20px">
      ${[
        { label:'Pessoas Alocadas', val:equipeTotal, icon:'fa-users', cor:'#3b82f6' },
        { label:'Equipamentos',     val:equipTotal,  icon:'fa-cogs',  cor:'#f59e0b' },
        { label:'Materiais/Insumos',val:matTotal,    icon:'fa-boxes', cor:'#10b981' },
        { label:'Serviços Externos',val:servTotal,   icon:'fa-handshake', cor:'#8b5cf6' },
        { label:'Custo Total',  val:`R$ ${_pgFmt(totalCusto)}`, icon:'fa-dollar-sign', cor:'#06b6d4' },
        { label:'% do Contrato',val:proj.valor_contrato ? Math.round(totalCusto/proj.valor_contrato*100)+'%' : '–', icon:'fa-percentage', cor:totalCusto>proj.valor_contrato?'#ef4444':'#10b981' }
      ].map(k=>`
        <div style="background:#0f172a;border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:12px 14px">
          <div style="font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">
            <i class="fas ${k.icon}" style="color:${k.cor};margin-right:4px"></i>${k.label}
          </div>
          <div style="font-size:${typeof k.val === 'string' && k.val.startsWith('R$') ? '16px' : '22px'};font-weight:700;color:${k.cor}">${k.val}</div>
        </div>`).join('')}
    </div>

    <!-- Histograma de custo por fase -->
    ${fasesNomes.length > 0 ? `
    <div style="background:#0f172a;border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:16px;margin-bottom:20px">
      <h4 style="color:#94a3b8;font-size:12px;font-weight:700;margin-bottom:14px;display:flex;align-items:center;gap:8px">
        <i class="fas fa-chart-bar" style="color:#3b82f6"></i> Distribuição de Recursos por Fase
      </h4>
      <div style="display:flex;gap:8px;align-items:flex-end;height:100px">
        ${fasesNomes.map(fn => {
          const custo = custosFase[fn] || 0;
          const pct = Math.round((custo / maxCustoFase) * 100);
          const cor = (PG_FASE_CORES[fn] || PG_FASE_CORES['Operação']).bg;
          return `
          <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">
            <div style="font-size:9px;color:#10b981;font-weight:700">${custo > 0 ? 'R$'+Math.round(custo/1000)+'k' : ''}</div>
            <div style="flex:1;width:100%;display:flex;align-items:flex-end">
              <div title="${fn}: R$ ${_pgFmt(custo)} | ${recursosFase[fn]||0} recurso(s)"
                style="width:100%;background:${cor};height:${Math.max(4, pct)}%;border-radius:4px 4px 0 0;
                       opacity:.8;cursor:default;transition:opacity .2s"
                onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='.8'"></div>
            </div>
            <div style="font-size:8px;color:#475569;text-align:center;line-height:1.2">${fn.slice(0,8)}</div>
          </div>`;
        }).join('')}
      </div>
    </div>` : ''}

    <!-- Botão adicionar -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h4 style="margin:0;color:#94a3b8;font-size:13px;font-weight:700">
        <i class="fas fa-list" style="color:#3b82f6;margin-right:6px"></i>Lista de Recursos (${recursos.length})
      </h4>
      <button onclick="pgAdicionarRecursoModal('${proj.id}')"
        style="background:linear-gradient(135deg,#3b82f6,#2563eb);color:#fff;border:none;
               border-radius:8px;padding:8px 16px;font-size:12px;font-weight:600;cursor:pointer">
        <i class="fas fa-plus" style="margin-right:6px"></i>Adicionar Recurso
      </button>
    </div>

    ${recursos.length === 0 ? _pgVazio('Nenhum recurso alocado. Use "Adicionar Recurso" para cadastrar equipe, equipamentos, materiais ou serviços.') : `
    <!-- Tabela de recursos -->
    <div style="border:1px solid rgba(255,255,255,0.07);border-radius:10px;overflow:hidden">
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="background:#0f172a">
            <th style="color:#475569;font-size:10px;padding:8px 12px;text-align:left">Tipo</th>
            <th style="color:#475569;font-size:10px;padding:8px 12px;text-align:left">Recurso</th>
            <th style="color:#475569;font-size:10px;padding:8px 12px;text-align:left">Especificação / Função</th>
            <th style="color:#475569;font-size:10px;padding:8px 8px;text-align:center">Qtd</th>
            <th style="color:#475569;font-size:10px;padding:8px 8px;text-align:right">Custo Unit.</th>
            <th style="color:#475569;font-size:10px;padding:8px 12px;text-align:right">Total</th>
            <th style="color:#475569;font-size:10px;padding:8px 8px;text-align:left">Fase</th>
            <th style="color:#475569;font-size:10px;padding:8px 8px;text-align:left">Fornecedor</th>
          </tr>
        </thead>
        <tbody>
          ${recursos.map(r => {
            const cor = corG[r.tipo] || '#64748b';
            const icon = iconG[r.tipo] || 'fa-cube';
            const pctBar = totalCusto > 0 ? Math.round((r.custo_total||0) / totalCusto * 100) : 0;
            return `
            <tr style="border-top:1px solid rgba(255,255,255,0.04)"
                onmouseover="this.style.background='rgba(255,255,255,0.025)'"
                onmouseout="this.style.background=''">
              <td style="padding:10px 12px">
                <span style="background:${cor}22;color:${cor};font-size:9px;padding:2px 7px;border-radius:10px;font-weight:600;white-space:nowrap">
                  <i class="fas ${icon}" style="margin-right:3px"></i>${r.tipo}
                </span>
              </td>
              <td style="padding:10px 12px;font-size:12px;color:#f1f5f9;font-weight:600">${r.nome}</td>
              <td style="padding:10px 12px;font-size:11px;color:#64748b">${r.funcao||r.especificacao||'–'}</td>
              <td style="padding:10px 8px;text-align:center;font-size:11px;color:#94a3b8">${r.quantidade||'–'} ${r.unidade||''}</td>
              <td style="padding:10px 8px;text-align:right;font-size:11px;color:#64748b">${r.custo_unit ? 'R$ '+_pgFmt(r.custo_unit) : '–'}</td>
              <td style="padding:10px 12px;text-align:right">
                ${r.custo_total ? `
                <div style="font-size:12px;color:#10b981;font-weight:700">R$ ${_pgFmt(r.custo_total)}</div>
                <div style="background:rgba(255,255,255,0.06);border-radius:3px;height:3px;margin-top:3px">
                  <div style="height:100%;width:${pctBar}%;background:${cor};border-radius:3px"></div>
                </div>` : '<span style="color:#475569">–</span>'}
              </td>
              <td style="padding:10px 8px;font-size:10px">
                ${r.fase ? `<span style="background:${(PG_FASE_CORES[r.fase]||PG_FASE_CORES['Operação']).light};
                  color:${(PG_FASE_CORES[r.fase]||PG_FASE_CORES['Operação']).text};
                  padding:2px 7px;border-radius:10px;font-size:9px;font-weight:600">${r.fase}</span>` : '–'}
              </td>
              <td style="padding:10px 8px;font-size:10px;color:#64748b">${r.fornecedor||'–'}</td>
            </tr>`;
          }).join('')}
        </tbody>
        <tfoot>
          <tr style="background:#0f172a;border-top:2px solid rgba(255,255,255,0.08)">
            <td colspan="5" style="padding:10px 12px;font-size:11px;color:#64748b;font-weight:700">TOTAL RECURSOS ALOCADOS</td>
            <td style="padding:10px 12px;text-align:right;font-size:14px;color:#10b981;font-weight:700">R$ ${_pgFmt(totalCusto)}</td>
            <td colspan="2"></td>
          </tr>
        </tfoot>
      </table>
    </div>`}

    <!-- Resumo de custos (gráfico) -->
    ${_pgResumoCustos(proj)}
  </div>`;
}

function _pgResumoCustos(proj) {
  const rs = proj.recursos || [];
  const total = rs.reduce((s, r) => s + (r.custo_total || 0), 0);
  const porTipo = {};
  rs.forEach(r => { porTipo[r.tipo] = (porTipo[r.tipo] || 0) + (r.custo_total || 0); });
  const corG = { 'Equipe':'#3b82f6', 'Equipamento':'#f59e0b', 'Material':'#10b981', 'Serviço':'#8b5cf6' };

  return `
  <div style="background:#0f172a;border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:16px;margin-top:8px">
    <h4 style="color:#94a3b8;font-size:12px;font-weight:700;margin-bottom:12px;text-transform:uppercase;letter-spacing:.5px">
      <i class="fas fa-calculator" style="margin-right:6px;color:#10b981"></i>Resumo de Custos
    </h4>
    <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:center">
      ${Object.entries(porTipo).map(([tipo, val]) => `
        <div style="display:flex;flex-direction:column">
          <span style="font-size:10px;color:#64748b">${tipo}</span>
          <span style="font-size:16px;font-weight:700;color:${corG[tipo]||'#94a3b8'}">R$ ${_pgFmt(val)}</span>
        </div>`).join('')}
      <div style="margin-left:auto;text-align:right">
        <div style="font-size:11px;color:#64748b">Total Alocado</div>
        <div style="font-size:22px;font-weight:700;color:#f1f5f9">R$ ${_pgFmt(total)}</div>
        ${proj.valor_contrato ? `<div style="font-size:11px;color:${total>proj.valor_contrato?'#ef4444':'#10b981'}">
          ${Math.round(total/proj.valor_contrato*100)}% do contrato (R$ ${_pgFmt(proj.valor_contrato)})
        </div>` : ''}
      </div>
    </div>
  </div>`;
}

// ─── ABA: MEDIÇÕES ─────────────────────────────────────────────────────
function _pgRenderMedicoes(proj) {
  const medicoes = (proj.medicoes || []).sort((a,b) => (b.numero||0) - (a.numero||0));
  const vlrContrato = proj.valor_contrato || 0;
  const totalMedido = medicoes.reduce((s, m) => s + (m.valor_medido || 0), 0);
  const saldo = vlrContrato - totalMedido;

  return `
  <div>
    <!-- Resumo financeiro -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:20px">
      ${[
        { label:'Valor do Contrato',  val:`R$ ${_pgFmt(vlrContrato)}`,  cor:'#3b82f6', icon:'fa-file-contract' },
        { label:'Total Medido',       val:`R$ ${_pgFmt(totalMedido)}`,  cor:'#10b981', icon:'fa-check-circle' },
        { label:'Saldo a Medir',      val:`R$ ${_pgFmt(saldo)}`,        cor:saldo<0?'#ef4444':'#f59e0b', icon:'fa-balance-scale' },
        { label:'Medições Realizadas',val:medicoes.length,              cor:'#8b5cf6', icon:'fa-list-ol' },
      ].map(k=>`
        <div style="background:#0f172a;border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:14px">
          <div style="font-size:10px;color:#64748b;margin-bottom:6px"><i class="fas ${k.icon}" style="color:${k.cor};margin-right:4px"></i>${k.label}</div>
          <div style="font-size:20px;font-weight:700;color:${k.cor}">${k.val}</div>
        </div>`).join('')}
    </div>

    <!-- Botão nova medição -->
    <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
      <button onclick="pgNovasMedicaoModal('${proj.id}')"
        style="background:linear-gradient(135deg,#10b981,#059669);color:#fff;border:none;
               border-radius:8px;padding:9px 18px;font-size:13px;font-weight:600;cursor:pointer">
        <i class="fas fa-plus" style="margin-right:6px"></i>Nova Medição
      </button>
    </div>

    <!-- Tabela de medições -->
    ${medicoes.length === 0 ? _pgVazio('Nenhuma medição registrada ainda.') : `
    <div style="border:1px solid rgba(255,255,255,0.07);border-radius:10px;overflow:hidden">
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="background:#0f172a">
            <th style="color:#475569;font-size:10px;padding:10px 14px;text-align:left">Nº</th>
            <th style="color:#475569;font-size:10px;padding:10px 14px;text-align:left">Período</th>
            <th style="color:#475569;font-size:10px;padding:10px 14px;text-align:left">Descrição</th>
            <th style="color:#475569;font-size:10px;padding:10px 14px;text-align:right">Valor Medido</th>
            <th style="color:#475569;font-size:10px;padding:10px 14px;text-align:center">Avanço Físico</th>
            <th style="color:#475569;font-size:10px;padding:10px 14px;text-align:center">Status</th>
            <th style="color:#475569;font-size:10px;padding:10px 14px;text-align:center">OS/RC</th>
            <th style="color:#475569;font-size:10px;padding:10px 14px;text-align:center">Ações</th>
          </tr>
        </thead>
        <tbody>
          ${medicoes.map(m => {
            const stCores = { 'Aprovada':'#10b981','Pendente':'#f59e0b','Rejeitada':'#ef4444','Em Análise':'#3b82f6' };
            const stCor = stCores[m.status] || '#64748b';
            const pctAcum = vlrContrato > 0 ? Math.round(m.valor_acumulado / vlrContrato * 100) : 0;
            return `
            <tr style="border-top:1px solid rgba(255,255,255,0.04)"
                onmouseover="this.style.background='rgba(255,255,255,0.025)'"
                onmouseout="this.style.background=''">
              <td style="padding:10px 14px;font-size:12px;color:#94a3b8;font-weight:700">${m.numero}</td>
              <td style="padding:10px 14px;font-size:11px;color:#64748b">${m.periodo || '–'}</td>
              <td style="padding:10px 14px;font-size:12px;color:#cbd5e1">${m.descricao || '–'}</td>
              <td style="padding:10px 14px;font-size:13px;color:#10b981;font-weight:700;text-align:right">
                R$ ${_pgFmt(m.valor_medido)}
              </td>
              <td style="padding:10px 14px;text-align:center">
                <div style="display:flex;align-items:center;gap:6px;justify-content:center">
                  <div style="background:rgba(255,255,255,0.08);border-radius:4px;height:5px;width:60px">
                    <div style="height:100%;width:${m.avanco_fisico||0}%;background:#10b981;border-radius:4px"></div>
                  </div>
                  <span style="font-size:11px;color:#10b981;font-weight:700">${m.avanco_fisico||0}%</span>
                </div>
                <div style="font-size:10px;color:#475569;margin-top:2px">Acum.: ${pctAcum}%</div>
              </td>
              <td style="padding:10px 14px;text-align:center">
                <span style="background:${stCor}22;color:${stCor};font-size:10px;
                             padding:3px 10px;border-radius:10px;border:1px solid ${stCor}44;font-weight:600">
                  ${m.status}
                </span>
              </td>
              <td style="padding:10px 14px;text-align:center;font-size:11px;color:#64748b">
                ${m.os_ids ? m.os_ids.map(o=>`<span style="background:rgba(59,130,246,0.15);color:#93c5fd;padding:1px 5px;border-radius:4px;font-size:10px">${o}</span>`).join(' ') : '–'}
              </td>
              <td style="padding:10px 14px;text-align:center">
                <button onclick="pgVerMedicao('${proj.id}','${m.id}')"
                  style="background:rgba(16,185,129,0.15);color:#6ee7b7;border:none;
                         border-radius:6px;padding:4px 10px;font-size:10px;cursor:pointer">
                  <i class="fas fa-eye"></i>
                </button>
                <button onclick="pgImprimirMedicao('${proj.id}','${m.id}')"
                  style="background:rgba(139,92,246,0.15);color:#c4b5fd;border:none;
                         border-radius:6px;padding:4px 10px;font-size:10px;cursor:pointer;margin-left:4px">
                  <i class="fas fa-print"></i>
                </button>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
        <tfoot>
          <tr style="background:#0f172a;border-top:2px solid rgba(255,255,255,0.1)">
            <td colspan="3" style="padding:10px 14px;font-size:12px;color:#64748b;font-weight:700">TOTAL MEDIDO</td>
            <td style="padding:10px 14px;font-size:14px;color:#10b981;font-weight:700;text-align:right">
              R$ ${_pgFmt(totalMedido)}
            </td>
            <td style="padding:10px 14px;text-align:center;font-size:12px;color:#10b981;font-weight:700">
              ${vlrContrato > 0 ? Math.round(totalMedido/vlrContrato*100) : 0}%
            </td>
            <td colspan="3"></td>
          </tr>
        </tfoot>
      </table>
    </div>`}
  </div>`;
}

// ─── ABA: CURVA S ─────────────────────────────────────────────────────
function _pgRenderCurvas(proj) {
  return `
  <div>
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px;flex-wrap:wrap">
      <h4 style="margin:0;color:#f1f5f9;font-size:14px;font-weight:700">
        <i class="fas fa-chart-area" style="color:#10b981;margin-right:8px"></i>Curva S – Avanço Físico e Financeiro
      </h4>
      <div style="display:flex;gap:12px;margin-left:auto">
        <span style="display:flex;align-items:center;gap:6px;font-size:11px;color:#94a3b8">
          <span style="width:20px;height:2px;background:#3b82f6;display:inline-block"></span>Planejado
        </span>
        <span style="display:flex;align-items:center;gap:6px;font-size:11px;color:#94a3b8">
          <span style="width:20px;height:2px;background:#10b981;display:inline-block"></span>Realizado
        </span>
        <span style="display:flex;align-items:center;gap:6px;font-size:11px;color:#94a3b8">
          <span style="width:20px;height:2px;background:#f59e0b;border-top:2px dashed;display:inline-block"></span>Financeiro
        </span>
      </div>
    </div>
    <canvas id="pg-curva-s" style="width:100%;height:340px;max-height:340px"></canvas>
  </div>`;
}

function _pgDrawCurvaS(proj) {
  const canvas = document.getElementById('pg-curva-s');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width  = canvas.offsetWidth;
  canvas.height = 340;

  const curvaPlan = proj.curva_planejada || [];
  const medicoes  = (proj.medicoes || []).sort((a,b) => (a.numero||0) - (b.numero||0));

  // Usa curva_planejada se existir (mais rica)
  let labels, planejado, realizado, financeiro;
  if (curvaPlan.length > 0) {
    labels     = curvaPlan.map(c => c.mes || c.periodo || `M${curvaPlan.indexOf(c)+1}`);
    planejado  = curvaPlan.map(c => c.pct_plan || 0);
    realizado  = curvaPlan.map(c => (c.pct_real !== null && c.pct_real !== undefined) ? c.pct_real : null);
    // Financeiro: interpola a partir das medições
    const medMap = {};
    medicoes.forEach(m => { if (m.periodo) medMap[m.periodo] = m.valor_acumulado || 0; });
    financeiro = labels.map(l => {
      const v = medMap[l];
      return v !== undefined && proj.valor_contrato > 0 ? Math.round(v / proj.valor_contrato * 100) : null;
    });
  } else if (medicoes.length > 0) {
    labels     = medicoes.map(m => m.periodo || `Med.${m.numero}`);
    planejado  = labels.map((_, i) => Math.min(100, Math.round(((i+1)/labels.length)*100)));
    realizado  = medicoes.map(m => m.avanco_fisico || 0);
    financeiro = medicoes.map(m => proj.valor_contrato > 0 ? Math.round((m.valor_acumulado||0)/proj.valor_contrato*100) : 0);
  } else {
    labels = ['–']; planejado = [0]; realizado = [0]; financeiro = [0];
  }

  const W = canvas.width, H = canvas.height;
  const pad = { top:30, right:40, bottom:56, left:52 };
  const cw = W - pad.left - pad.right;
  const ch = H - pad.top  - pad.bottom;

  // Fundo
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, W, H);

  // Grid horizontal
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 10; i++) {
    const y = pad.top + ch - (i/10)*ch;
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + cw, y); ctx.stroke();
    ctx.fillStyle = '#334155'; ctx.font = '10px sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(`${i*10}%`, pad.left - 6, y + 4);
  }

  const step = labels.length > 1 ? cw / (labels.length - 1) : cw;

  // Linhas verticais + labels
  labels.forEach((lbl, i) => {
    const x = pad.left + i * step;
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, pad.top); ctx.lineTo(x, pad.top + ch); ctx.stroke();
    ctx.fillStyle = '#334155'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(lbl, x, pad.top + ch + 14);
    // Linha extra para label longo: inclinar
  });

  // Eixo
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(pad.left, pad.top); ctx.lineTo(pad.left, pad.top + ch); ctx.lineTo(pad.left + cw, pad.top + ch); ctx.stroke();

  // Helper: desenhar área preenchida + linha
  const drawArea = (data, color, dash = [], fillAlpha = 0.08) => {
    const filtered = data.map((v, i) => ({ v, i })).filter(p => p.v !== null && p.v !== undefined);
    if (filtered.length < 1) return;

    // Área preenchida
    if (fillAlpha > 0 && filtered.length > 1) {
      ctx.beginPath();
      ctx.moveTo(pad.left + filtered[0].i * step, pad.top + ch);
      filtered.forEach(p => { ctx.lineTo(pad.left + p.i * step, pad.top + ch - (p.v/100)*ch); });
      ctx.lineTo(pad.left + filtered[filtered.length-1].i * step, pad.top + ch);
      ctx.closePath();
      ctx.fillStyle = color + Math.round(fillAlpha * 255).toString(16).padStart(2,'0');
      ctx.fill();
    }

    // Linha principal
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.setLineDash(dash);
    filtered.forEach((p, idx) => {
      const x = pad.left + p.i * step;
      const y = pad.top  + ch - (p.v/100)*ch;
      idx === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.setLineDash([]);

    // Pontos
    filtered.forEach(p => {
      const x = pad.left + p.i * step;
      const y = pad.top  + ch - (p.v/100)*ch;
      ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI*2);
      ctx.fillStyle = '#0f172a'; ctx.fill();
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI*2);
      ctx.fillStyle = color; ctx.fill();
      // Valor
      ctx.fillStyle = color; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(`${p.v}%`, x, y - 8);
    });
  };

  drawArea(planejado,  '#3b82f6', [], 0.07);
  drawArea(financeiro, '#f59e0b', [5,3], 0.04);
  drawArea(realizado,  '#10b981', [], 0.12);

  // Linha "Hoje" vertical
  const hoje = new Date();
  // Verificamos se o projeto tem data de início/fim para desenhar onde está "hoje" na curva
  // (simplificado: apenas anotamos o mês atual como % do período)

  // Título
  ctx.fillStyle = '#94a3b8';
  ctx.font = '11px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText(`Curva S – ${proj.nome.slice(0,40)}`, pad.left, pad.top - 10);

  // Legenda no canto superior direito
  const legenda = [
    { label: 'Planejado',  color: '#3b82f6' },
    { label: 'Realizado',  color: '#10b981' },
    { label: 'Financeiro', color: '#f59e0b' },
  ];
  legenda.forEach((l, i) => {
    const lx = W - pad.right - 90;
    const ly = pad.top + i * 16;
    ctx.fillStyle = l.color; ctx.fillRect(lx, ly, 14, 3);
    ctx.fillStyle = '#475569'; ctx.font = '9px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(l.label, lx + 18, ly + 4);
  });
}

// ─── ABA: OS VINCULADAS ────────────────────────────────────────────────
function _pgRenderOS(proj) {
  const fluxoOS = JSON.parse(localStorage.getItem('fa_fluxo_os') || '[]');
  const osList  = JSON.parse(localStorage.getItem('fa_os_list') || '[]');
  const rcList  = JSON.parse(localStorage.getItem('fa_rc_list') || '[]').filter(r => r.contrato_id === proj.contrato_id);
  const pedList = JSON.parse(localStorage.getItem('fa_pedidos') || '[]').filter(p => p.contrato_id === proj.contrato_id);

  const osVinculadas = [
    ...fluxoOS.filter(o => o.contrato_id === proj.contrato_id || (proj.os_ids||[]).includes(o.id)),
    ...osList.filter(o => !fluxoOS.find(f=>f.id===o.id) && (o.contrato_id===proj.contrato_id || (proj.os_ids||[]).includes(o.id)))
  ];

  if (!osVinculadas.length) return _pgVazio(`Nenhuma OS vinculada ao contrato ${proj.contrato_id||'–'}. As OS criadas para este contrato aparecerão aqui automaticamente.`);

  // Estatísticas
  const osConcluidas  = osVinculadas.filter(o=>o.status==='Concluída').length;
  const osEmAndamento = osVinculadas.filter(o=>o.status==='Em Andamento').length;
  const osAgendadas   = osVinculadas.filter(o=>o.status==='Agendada').length;

  const stCores = { 'Concluída':'#10b981','Em Andamento':'#3b82f6','Aprovada – Aguardando Comprador':'#f59e0b',
    'Aguardando Aprovação':'#64748b','PC Emitido':'#8b5cf6','Rejeitada':'#ef4444',
    'Agendada':'#f59e0b', 'Mobilização':'#8b5cf6' };

  return `
  <div>
    <!-- Resumo rápido -->
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px">
      <div style="background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.2);border-radius:8px;padding:8px 16px;text-align:center">
        <div style="font-size:10px;color:#64748b">Concluídas</div>
        <div style="font-size:18px;font-weight:700;color:#10b981">${osConcluidas}</div>
      </div>
      <div style="background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.2);border-radius:8px;padding:8px 16px;text-align:center">
        <div style="font-size:10px;color:#64748b">Em Andamento</div>
        <div style="font-size:18px;font-weight:700;color:#3b82f6">${osEmAndamento}</div>
      </div>
      <div style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.2);border-radius:8px;padding:8px 16px;text-align:center">
        <div style="font-size:10px;color:#64748b">Agendadas</div>
        <div style="font-size:18px;font-weight:700;color:#f59e0b">${osAgendadas}</div>
      </div>
      <div style="background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.2);border-radius:8px;padding:8px 16px;text-align:center">
        <div style="font-size:10px;color:#64748b">RC(s) Geradas</div>
        <div style="font-size:18px;font-weight:700;color:#8b5cf6">${rcList.length}</div>
      </div>
      <div style="background:rgba(6,182,212,0.1);border:1px solid rgba(6,182,212,0.2);border-radius:8px;padding:8px 16px;text-align:center">
        <div style="font-size:10px;color:#64748b">Pedidos</div>
        <div style="font-size:18px;font-weight:700;color:#06b6d4">${pedList.length}</div>
      </div>
    </div>
    <div style="display:grid;gap:12px">
      ${osVinculadas.map(os => {
        const itens = os.itens_compra || os.itens || [];
        const stCor = stCores[os.status] || '#64748b';
        const rcsOS = rcList.filter(r => r.os_id === os.id || (os.rcs_geradas||[]).includes(r.id));
        const pedsOS = pedList.filter(p => rcsOS.some(r => r.id === p.rc_id));
        const progresso = os.progresso ?? os.avanco ?? 0;
        return `
        <div style="background:#0f172a;border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:16px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px">
            <div style="flex:1">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                <span style="font-size:10px;color:#64748b;background:rgba(255,255,255,0.05);padding:2px 7px;border-radius:5px">${os.os_numero||os.id}</span>
                ${os.tipo?`<span style="font-size:10px;color:#94a3b8;background:rgba(255,255,255,0.04);padding:2px 7px;border-radius:5px">${os.tipo}</span>`:''}
                ${os.prioridade && os.prioridade !== 'Normal' ? `<span style="font-size:10px;font-weight:600;background:rgba(239,68,68,0.1);color:#ef4444;padding:2px 7px;border-radius:5px">${os.prioridade}</span>` : ''}
              </div>
              <div style="font-size:14px;color:#f1f5f9;font-weight:600">${os.descricao||os.titulo||'–'}</div>
              <div style="font-size:11px;color:#64748b;margin-top:4px">
                ${os.responsavel?`<i class="fas fa-user" style="margin-right:3px"></i>${os.responsavel}`:''}
                ${os.prazo?`<span style="margin-left:10px"><i class="fas fa-calendar"></i> Prazo: ${os.prazo}</span>`:''}
                ${os.horas?`<span style="margin-left:10px"><i class="fas fa-clock"></i> ${os.horas}h estimadas</span>`:''}
              </div>
              <!-- Barra de progresso -->
              <div style="margin-top:8px">
                <div style="display:flex;justify-content:space-between;margin-bottom:3px">
                  <span style="font-size:10px;color:#64748b">Progresso</span>
                  <span style="font-size:10px;font-weight:600;color:${stCor}">${progresso}%</span>
                </div>
                <div style="background:rgba(255,255,255,0.1);border-radius:4px;height:5px">
                  <div style="background:${stCor};width:${progresso}%;height:100%;border-radius:4px;transition:width .3s"></div>
                </div>
              </div>
            </div>
            <span style="background:${stCor}22;color:${stCor};font-size:10px;
                         padding:3px 10px;border-radius:10px;border:1px solid ${stCor}44;font-weight:600">
              ${os.status}
            </span>
          </div>
          ${itens.length ? `
          <div style="margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.06)">
            <div style="font-size:10px;color:#475569;margin-bottom:6px;text-transform:uppercase">Itens de Compra (${itens.length})</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              ${itens.slice(0,5).map(it=>`
                <span style="background:rgba(255,255,255,0.05);color:#94a3b8;font-size:10px;
                             padding:2px 8px;border-radius:6px">${it.descricao||it.nome||'–'} × ${it.qtd||it.quantidade||1} ${it.unidade||'un'}</span>
              `).join('')}
              ${itens.length > 5 ? `<span style="color:#475569;font-size:10px">+${itens.length-5} mais</span>` : ''}
            </div>
          </div>` : ''}
          <div style="margin-top:10px;display:flex;gap:12px;font-size:11px;color:#64748b;flex-wrap:wrap">
            ${os.criado_por ? `<span><i class="fas fa-user" style="margin-right:3px"></i>${os.criado_por}</span>` : ''}
            ${os.data_criacao ? `<span><i class="fas fa-calendar" style="margin-right:3px"></i>${os.data_criacao}</span>` : ''}
            ${rcsOS.length ? `<span style="color:#f59e0b"><i class="fas fa-file-alt" style="margin-right:3px"></i>${rcsOS.length} RC(s) gerada(s)</span>` : ''}
            ${pedsOS.length ? `<span style="color:#10b981"><i class="fas fa-shopping-cart" style="margin-right:3px"></i>${pedsOS.length} Pedido(s) emitido(s)</span>` : ''}
            ${os.observacoes ? `<span style="color:#475569;font-style:italic">${os.observacoes}</span>` : ''}
          </div>
        </div>`;
      }).join('')}
    </div>
  </div>`;
}

// ─── ABA: SUPRIMENTOS (OS → RC → RFQ → MAPA → PEDIDO → PAGAMENTO) ────
function _pgRenderSuprimentos(proj) {
  const cid = proj.contrato_id;
  // Carrega todos os dados de suprimentos
  const osList   = JSON.parse(localStorage.getItem('fa_os_list')     || '[]').filter(o => o.contrato === cid || o.contrato_id === cid);
  const rcList   = JSON.parse(localStorage.getItem('fa_rc_list')     || '[]').filter(r => r.contrato_id === cid);
  const rfqList  = JSON.parse(localStorage.getItem('fa_rfqs')        || '[]').filter(r => r.contrato_id === cid);
  const mapaList = JSON.parse(localStorage.getItem('fa_mapas_comp')  || '[]').filter(m => m.contrato_id === cid);
  const pedList  = JSON.parse(localStorage.getItem('fa_pedidos')     || '[]').filter(p => p.contrato_id === cid);
  const cpList   = JSON.parse(localStorage.getItem('fa_contas_pagar')|| '[]').filter(c => c.contrato_id === cid || c.centro_custo === cid);

  if (!osList.length && !rcList.length && !pedList.length) {
    return _pgVazio(`Nenhum registro de suprimentos para o contrato ${cid||'–'}. OS e RC geradas para este contrato aparecerão aqui.`);
  }

  // Totalizadores financeiros
  const totalPedidos  = pedList.reduce((s,p) => s+(p.valor_total||0), 0);
  const totalPago     = cpList.filter(c=>c.status==='Pago').reduce((s,c)=>s+(c.valor||0),0);
  const totalAVencer  = cpList.filter(c=>c.status==='A Vencer').reduce((s,c)=>s+(c.valor||0),0);
  const totalCP       = cpList.reduce((s,c)=>s+(c.valor||0),0);

  const stCorOS  = { 'Concluída':'#10b981','Em Andamento':'#3b82f6','Agendada':'#f59e0b','Mobilização':'#8b5cf6','Corretiva':'#ef4444' };
  const stCorRC  = { 'Pedido Emitido':'#10b981','Aprovada – Aguardando Comprador':'#f59e0b','Aguardando Aprovação':'#64748b','Rascunho':'#475569' };
  const stCorPed = { 'Recebida':'#10b981','Em Trânsito':'#3b82f6','Parcial':'#f59e0b','Cancelado':'#ef4444','Aguardando':'#64748b' };
  const stCorCP  = { 'Pago':'#10b981','A Vencer':'#f59e0b','Vencido':'#ef4444','Cancelado':'#64748b' };

  return `
  <div style="display:flex;flex-direction:column;gap:24px">

    <!-- KPIs Suprimentos -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px">
      ${[
        { l:'OS', v:osList.length,   icon:'fa-clipboard-list', cor:'#3b82f6' },
        { l:'RC', v:rcList.length,   icon:'fa-file-alt',       cor:'#f59e0b' },
        { l:'RFQ', v:rfqList.length, icon:'fa-envelope-open',  cor:'#8b5cf6' },
        { l:'Mapas', v:mapaList.length,icon:'fa-table',        cor:'#06b6d4' },
        { l:'Pedidos', v:pedList.length,icon:'fa-shopping-cart',cor:'#10b981' },
        { l:'Total Pedidos', v:'R$ '+_pgFmt(totalPedidos), icon:'fa-dollar-sign', cor:'#10b981' },
        { l:'Total CP', v:'R$ '+_pgFmt(totalCP), icon:'fa-money-bill', cor:'#f59e0b' },
        { l:'Pago', v:'R$ '+_pgFmt(totalPago), icon:'fa-check-circle', cor:'#10b981' },
      ].map(k=>`
        <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:10px 14px">
          <div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">
            <i class="fas ${k.icon}" style="color:${k.cor};margin-right:4px"></i>${k.l}
          </div>
          <div style="font-size:${typeof k.v === 'string' ? '13px' : '22px'};font-weight:700;color:${k.cor}">${k.v}</div>
        </div>`).join('')}
    </div>

    <!-- Fluxo Visual OS → RC → RFQ → Mapa → Pedido -->
    <div style="background:#0f172a;border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:16px">
      <div style="font-size:12px;color:#94a3b8;font-weight:600;margin-bottom:12px;text-transform:uppercase;letter-spacing:.5px">
        <i class="fas fa-route" style="color:#10b981;margin-right:6px"></i>Fluxo de Suprimentos – ${cid}
      </div>
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:center;padding:8px 0">
        ${[
          { label:'OS', count:osList.length, cor:'#3b82f6', icon:'fa-clipboard-list', ok: osList.length>0 },
          { label:'RC', count:rcList.length, cor:'#f59e0b', icon:'fa-file-alt', ok: rcList.length>0 },
          { label:'RFQ', count:rfqList.length, cor:'#8b5cf6', icon:'fa-envelope-open', ok: rfqList.length>0 },
          { label:'Mapa', count:mapaList.length, cor:'#06b6d4', icon:'fa-table', ok: mapaList.length>0 },
          { label:'Pedido', count:pedList.length, cor:'#10b981', icon:'fa-shopping-cart', ok: pedList.length>0 },
          { label:'Pagamento', count:cpList.filter(c=>c.status==='Pago').length+'/'+cpList.length, cor:'#ec4899', icon:'fa-money-check-alt', ok: cpList.filter(c=>c.status==='Pago').length>0 },
        ].map((s,i,arr)=>`
          <div style="display:flex;align-items:center;gap:6px">
            <div style="background:${s.ok ? s.cor+'22' : 'rgba(255,255,255,0.04)'};
                        border:1px solid ${s.ok ? s.cor+'44' : 'rgba(255,255,255,0.07)'};
                        border-radius:10px;padding:10px 14px;text-align:center;min-width:72px">
              <i class="fas ${s.icon}" style="color:${s.ok ? s.cor : '#475569'};font-size:16px;display:block;margin-bottom:4px"></i>
              <div style="font-size:11px;font-weight:700;color:${s.ok ? s.cor : '#475569'}">${s.label}</div>
              <div style="font-size:10px;color:#64748b">${s.count}</div>
            </div>
            ${i<arr.length-1 ? `<i class="fas fa-chevron-right" style="color:${s.ok ? '#64748b' : '#334155'};font-size:12px"></i>` : ''}
          </div>`).join('')}
      </div>
    </div>

    <!-- OS vinculadas (detalhes) -->
    ${osList.length ? `
    <div>
      <div style="font-size:12px;color:#94a3b8;font-weight:600;margin-bottom:10px;text-transform:uppercase;letter-spacing:.5px">
        <i class="fas fa-clipboard-list" style="color:#3b82f6;margin-right:6px"></i>Ordens de Serviço (${osList.length})
      </div>
      <div style="display:grid;gap:8px">
        ${osList.map(os=>{
          const cor = stCorOS[os.tipo]||stCorOS[os.status]||'#64748b';
          const stCor2 = { 'Concluída':'#10b981','Em Andamento':'#3b82f6','Agendada':'#f59e0b','Mobilização':'#8b5cf6' }[os.status]||'#64748b';
          const rcs = rcList.filter(r=>r.os_id===os.id);
          return `
          <div style="background:#0f172a;border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:14px">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
              <div>
                <span style="font-size:10px;color:#64748b">${os.id}</span>
                <div style="font-size:13px;color:#f1f5f9;font-weight:600">${os.descricao||os.titulo||'–'}</div>
                <div style="font-size:11px;color:#64748b;margin-top:3px">
                  <span style="background:rgba(255,255,255,0.06);padding:2px 7px;border-radius:5px;margin-right:6px">${os.tipo||'–'}</span>
                  <i class="fas fa-user" style="margin-right:3px"></i>${os.responsavel||'–'}
                  ${os.prazo?`<span style="margin-left:8px"><i class="fas fa-calendar"></i> ${os.prazo}</span>`:''}
                  ${os.horas?`<span style="margin-left:8px"><i class="fas fa-clock"></i> ${os.horas}h</span>`:''}
                </div>
              </div>
              <div style="display:flex;align-items:center;gap:8px">
                ${rcs.length?`<span style="background:rgba(245,158,11,0.15);color:#f59e0b;font-size:10px;padding:3px 8px;border-radius:6px;border:1px solid rgba(245,158,11,0.3)">${rcs.length} RC(s)</span>`:''}
                <span style="background:${stCor2}22;color:${stCor2};font-size:10px;padding:3px 10px;border-radius:10px;border:1px solid ${stCor2}44;font-weight:600">${os.status||'–'}</span>
                <div style="text-align:center">
                  <div style="font-size:11px;color:#64748b;margin-bottom:2px">Progresso</div>
                  <div style="font-size:14px;font-weight:700;color:${stCor2}">${os.progresso||0}%</div>
                </div>
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>` : ''}

    <!-- RCs -->
    ${rcList.length ? `
    <div>
      <div style="font-size:12px;color:#94a3b8;font-weight:600;margin-bottom:10px;text-transform:uppercase;letter-spacing:.5px">
        <i class="fas fa-file-alt" style="color:#f59e0b;margin-right:6px"></i>Requisições de Compra – RC (${rcList.length})
      </div>
      <div style="display:grid;gap:8px">
        ${rcList.map(rc=>{
          const stCor3 = stCorRC[rc.status]||'#64748b';
          const rfqs = rfqList.filter(r=>r.rc_id===rc.id);
          return `
          <div style="background:#0f172a;border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:14px">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px">
              <div>
                <span style="font-size:10px;color:#64748b">${rc.id} · OS: ${rc.os_id||'–'}</span>
                <div style="font-size:13px;color:#f1f5f9;font-weight:600">${rc.descricao||'–'}</div>
                <div style="font-size:11px;color:#64748b;margin-top:3px">
                  <i class="fas fa-user" style="margin-right:3px"></i>${rc.solicitante||'–'}
                  <span style="margin-left:8px"><i class="fas fa-calendar"></i> ${rc.data||'–'}</span>
                  ${rfqs.length?`<span style="margin-left:8px;color:#8b5cf6"><i class="fas fa-envelope-open"></i> ${rfqs.length} RFQ(s)</span>`:''}
                </div>
                ${(rc.itens||[]).length?`
                <div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px">
                  ${(rc.itens||[]).slice(0,3).map(it=>`<span style="background:rgba(255,255,255,0.05);color:#94a3b8;font-size:10px;padding:2px 7px;border-radius:5px">${it.descricao} (${it.qtd} ${it.unidade})</span>`).join('')}
                  ${(rc.itens||[]).length>3?`<span style="color:#475569;font-size:10px">+${(rc.itens||[]).length-3} mais</span>`:''}
                </div>`:''}
              </div>
              <div style="text-align:right">
                <span style="background:${stCor3}22;color:${stCor3};font-size:10px;padding:3px 10px;border-radius:10px;border:1px solid ${stCor3}44;font-weight:600;display:block;margin-bottom:6px">${rc.status||'–'}</span>
                <div style="font-size:16px;font-weight:700;color:#10b981">R$ ${_pgFmt(rc.valor_total||0)}</div>
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>` : ''}

    <!-- Mapas de Cotação -->
    ${mapaList.length ? `
    <div>
      <div style="font-size:12px;color:#94a3b8;font-weight:600;margin-bottom:10px;text-transform:uppercase;letter-spacing:.5px">
        <i class="fas fa-table" style="color:#06b6d4;margin-right:6px"></i>Mapas de Cotação (${mapaList.length})
      </div>
      <div style="display:grid;gap:8px">
        ${mapaList.map(m=>{
          const stCorM = m.status==='Aprovado'?'#10b981':m.status==='Pendente'?'#f59e0b':'#64748b';
          return `
          <div style="background:#0f172a;border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:14px">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px">
              <div>
                <span style="font-size:10px;color:#64748b">${m.id} · RC: ${m.rc_id||'–'}</span>
                <div style="font-size:13px;color:#f1f5f9;font-weight:600">${m.descricao||'–'}</div>
                <div style="font-size:11px;color:#64748b;margin-top:3px">
                  <i class="fas fa-user" style="margin-right:3px"></i>${m.responsavel||'–'}
                  <span style="margin-left:8px"><i class="fas fa-calendar"></i> ${m.data||'–'}</span>
                  <span style="margin-left:8px;color:#10b981"><i class="fas fa-check"></i> Aprovado: ${m.aprovado_por||'–'} em ${m.data_aprovacao||'–'}</span>
                </div>
                <div style="margin-top:6px;display:flex;gap:10px;font-size:11px">
                  <span style="color:#94a3b8">Fornecedores: ${(m.fornecedores||[]).join(', ')}</span>
                </div>
              </div>
              <div style="text-align:right">
                <span style="background:${stCorM}22;color:${stCorM};font-size:10px;padding:3px 10px;border-radius:10px;border:1px solid ${stCorM}44;font-weight:600;display:block;margin-bottom:6px">${m.status||'–'}</span>
                <div style="font-size:13px;font-weight:600;color:#10b981">Melhor: R$ ${_pgFmt(m.valor_total_melhor||0)}</div>
                ${m.economia?`<div style="font-size:11px;color:#06b6d4">Economia: R$ ${_pgFmt(m.economia)}</div>`:''}
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>` : ''}

    <!-- Pedidos de Compra -->
    ${pedList.length ? `
    <div>
      <div style="font-size:12px;color:#94a3b8;font-weight:600;margin-bottom:10px;text-transform:uppercase;letter-spacing:.5px">
        <i class="fas fa-shopping-cart" style="color:#10b981;margin-right:6px"></i>Pedidos de Compra (${pedList.length})
      </div>
      <div style="display:grid;gap:8px">
        ${pedList.map(p=>{
          const stCor4 = stCorPed[p.status]||'#64748b';
          return `
          <div style="background:#0f172a;border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:14px">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px">
              <div>
                <span style="font-size:10px;color:#64748b">${p.id} · ${p.fornecedor||'–'}</span>
                <div style="font-size:13px;color:#f1f5f9;font-weight:600">${p.descricao||'–'}</div>
                <div style="font-size:11px;color:#64748b;margin-top:3px">
                  Emissão: ${p.data_emissao||'–'} · Entrega Prev.: ${p.data_entrega_prev||'–'}
                  ${p.data_entrega_real?` · <span style="color:#10b981">Recebido: ${p.data_entrega_real}</span>`:''}
                  ${p.nota_fiscal?` · NF: ${p.nota_fiscal}`:''}
                </div>
                ${p.condicao_pagamento?`<div style="font-size:11px;color:#64748b;margin-top:3px"><i class="fas fa-calendar-check" style="margin-right:3px;color:#f59e0b"></i>Pgto: ${p.condicao_pagamento}</div>`:''}
              </div>
              <div style="text-align:right">
                <span style="background:${stCor4}22;color:${stCor4};font-size:10px;padding:3px 10px;border-radius:10px;border:1px solid ${stCor4}44;font-weight:600;display:block;margin-bottom:6px">${p.status||'–'}</span>
                <div style="font-size:18px;font-weight:700;color:#10b981">R$ ${_pgFmt(p.valor_total||0)}</div>
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>` : ''}

    <!-- Contas a Pagar -->
    ${cpList.length ? `
    <div>
      <div style="font-size:12px;color:#94a3b8;font-weight:600;margin-bottom:10px;text-transform:uppercase;letter-spacing:.5px">
        <i class="fas fa-money-bill-wave" style="color:#ec4899;margin-right:6px"></i>Contas a Pagar / Financeiro (${cpList.length})
      </div>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead>
            <tr style="background:rgba(255,255,255,0.05)">
              ${['ID','Fornecedor','Descrição','Vencimento','Valor','Status','Categoria'].map(h=>`<th style="padding:8px 12px;text-align:left;color:#64748b;font-weight:600;white-space:nowrap">${h}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${cpList.map(c=>{
              const stCor5 = stCorCP[c.status]||'#64748b';
              return `<tr style="border-top:1px solid rgba(255,255,255,0.05)">
                <td style="padding:8px 12px;color:#64748b;white-space:nowrap">${c.id}</td>
                <td style="padding:8px 12px;color:#94a3b8">${c.fornecedor||'–'}</td>
                <td style="padding:8px 12px;color:#f1f5f9">${c.descricao||'–'}</td>
                <td style="padding:8px 12px;color:#94a3b8;white-space:nowrap">${c.vencimento||'–'}</td>
                <td style="padding:8px 12px;color:#10b981;font-weight:600;white-space:nowrap">R$ ${_pgFmt(c.valor||0)}</td>
                <td style="padding:8px 12px">
                  <span style="background:${stCor5}22;color:${stCor5};font-size:10px;padding:2px 8px;border-radius:6px;border:1px solid ${stCor5}44">${c.status||'–'}</span>
                </td>
                <td style="padding:8px 12px;color:#64748b">${c.categoria||'–'}</td>
              </tr>`;
            }).join('')}
          </tbody>
          <tfoot>
            <tr style="background:rgba(255,255,255,0.05);border-top:2px solid rgba(255,255,255,0.1)">
              <td colspan="4" style="padding:10px 12px;color:#94a3b8;font-weight:600">TOTAIS</td>
              <td style="padding:10px 12px;font-weight:700;color:#10b981;white-space:nowrap">R$ ${_pgFmt(totalCP)}</td>
              <td colspan="2" style="padding:10px 12px">
                <span style="background:rgba(16,185,129,0.15);color:#10b981;font-size:10px;padding:2px 8px;border-radius:6px;margin-right:6px">Pago: R$ ${_pgFmt(totalPago)}</span>
                <span style="background:rgba(245,158,11,0.15);color:#f59e0b;font-size:10px;padding:2px 8px;border-radius:6px">A Vencer: R$ ${_pgFmt(totalAVencer)}</span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>` : ''}

  </div>`;
}

// ─── MODAIS ────────────────────────────────────────────────────────────

// MODAL: Novo Projeto
function pgNovoProjetoModal() {
  const contratos = JSON.parse(localStorage.getItem('fa_contratos') || '[]');
  const optsContr = contratos.map(c => `<option value="${c.id}">${c.id} – ${c.nome||c.cliente||''}</option>`).join('');

  openModalWide('Novo Projeto', `
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
    <div class="form-group" style="grid-column:1/-1">
      <label style="color:#94a3b8;font-size:12px">Nome do Projeto *</label>
      <input id="np_nome" class="form-control" placeholder="Ex: Implantação Britagem CONT-003" style="background:#0f172a;border:1px solid rgba(255,255,255,0.1);color:#f1f5f9;padding:10px;border-radius:8px;width:100%">
    </div>
    <div class="form-group">
      <label style="color:#94a3b8;font-size:12px">Contrato Vinculado</label>
      <select id="np_contrato" class="form-control" style="background:#0f172a;border:1px solid rgba(255,255,255,0.1);color:#f1f5f9;padding:10px;border-radius:8px;width:100%">
        <option value="">Sem vínculo</option>${optsContr}
      </select>
    </div>
    <div class="form-group">
      <label style="color:#94a3b8;font-size:12px">Status</label>
      <select id="np_status" class="form-control" style="background:#0f172a;border:1px solid rgba(255,255,255,0.1);color:#f1f5f9;padding:10px;border-radius:8px;width:100%">
        <option>Em Andamento</option><option>Não Iniciada</option><option>Concluída</option><option>Suspensa</option>
      </select>
    </div>
    <div class="form-group">
      <label style="color:#94a3b8;font-size:12px">Data Início</label>
      <input id="np_inicio" type="date" class="form-control" style="background:#0f172a;border:1px solid rgba(255,255,255,0.1);color:#f1f5f9;padding:10px;border-radius:8px;width:100%">
    </div>
    <div class="form-group">
      <label style="color:#94a3b8;font-size:12px">Data Fim (prevista)</label>
      <input id="np_fim" type="date" class="form-control" style="background:#0f172a;border:1px solid rgba(255,255,255,0.1);color:#f1f5f9;padding:10px;border-radius:8px;width:100%">
    </div>
    <div class="form-group">
      <label style="color:#94a3b8;font-size:12px">Valor do Contrato (R$)</label>
      <input id="np_valor" type="number" class="form-control" placeholder="0,00" style="background:#0f172a;border:1px solid rgba(255,255,255,0.1);color:#f1f5f9;padding:10px;border-radius:8px;width:100%">
    </div>
    <div class="form-group">
      <label style="color:#94a3b8;font-size:12px">Gerente do Projeto</label>
      <input id="np_gerente" class="form-control" placeholder="Nome do responsável" style="background:#0f172a;border:1px solid rgba(255,255,255,0.1);color:#f1f5f9;padding:10px;border-radius:8px;width:100%">
    </div>
    <div class="form-group" style="grid-column:1/-1">
      <label style="color:#94a3b8;font-size:12px">Descrição</label>
      <textarea id="np_desc" rows="2" class="form-control" placeholder="Breve descrição do projeto..." style="background:#0f172a;border:1px solid rgba(255,255,255,0.1);color:#f1f5f9;padding:10px;border-radius:8px;width:100%;resize:vertical"></textarea>
    </div>
    <div class="form-group" style="grid-column:1/-1">
      <label style="color:#94a3b8;font-size:12px">Fases do Projeto (WBS) – marque as que se aplicam</label>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
        ${['Mobilização','Construção','Instalações','Comissionamento','Operação','Desmobilização'].map(f=>`
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;
                        background:rgba(255,255,255,0.05);border-radius:6px;padding:6px 10px">
            <input type="checkbox" name="np_fase" value="${f}" checked style="accent-color:#10b981">
            <span style="font-size:12px;color:#cbd5e1">${f}</span>
          </label>`).join('')}
      </div>
    </div>
  </div>
  <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:20px">
    <button onclick="closeModal()" style="background:#1e293b;color:#94a3b8;border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:10px 20px;cursor:pointer">Cancelar</button>
    <button onclick="pgSalvarNovoProjeto()" style="background:linear-gradient(135deg,#10b981,#059669);color:#fff;border:none;border-radius:8px;padding:10px 24px;font-weight:600;cursor:pointer"><i class="fas fa-save" style="margin-right:6px"></i>Criar Projeto</button>
  </div>`);
}

function pgSalvarNovoProjeto() {
  const nome = document.getElementById('np_nome')?.value?.trim();
  if (!nome) { showToast('Informe o nome do projeto', 'warning'); return; }

  const fasesMarcadas = [...document.querySelectorAll('input[name="np_fase"]:checked')].map(el => el.value);
  const toISO = v => { if (!v) return ''; const [a,m,d] = v.split('-'); return `${d}/${m}/${a}`; };

  const proj = {
    id:             gerarId('PROJ'),
    nome,
    descricao:      document.getElementById('np_desc')?.value?.trim() || '',
    contrato_id:    document.getElementById('np_contrato')?.value || '',
    status:         document.getElementById('np_status')?.value || 'Em Andamento',
    data_inicio:    toISO(document.getElementById('np_inicio')?.value),
    data_fim:       toISO(document.getElementById('np_fim')?.value),
    valor_contrato: parseFloat(document.getElementById('np_valor')?.value) || 0,
    gerente:        document.getElementById('np_gerente')?.value?.trim() || '',
    avanco_geral:   0,
    fases:          fasesMarcadas.map((f, i) => ({ id: `FASE-${i+1}`, nome: f, tarefas: [] })),
    recursos:       [],
    medicoes:       [],
    curva_planejada:[],
    os_ids:         [],
    criado_em:      new Date().toLocaleDateString('pt-BR'),
    criado_por:     currentUser?.name || 'Sistema',
  };

  const ps = _getProjetos();
  ps.push(proj);
  _saveProjetos(ps);
  closeModal();
  showToast(`Projeto "${nome}" criado com sucesso!`, 'success');
  _pgProjetoAtivo = proj.id;
  renderProjetosGantt();
}

// MODAL: Nova Tarefa
function pgNovaTarefaModal(projId, faseId) {
  const proj  = _getProjetoById(projId);
  if (!proj) return;
  const fases = proj.fases || [];
  const optsFase = fases.map(f => `<option value="${f.id}" ${f.id===faseId?'selected':''}>${f.nome}</option>`).join('');

  openModalWide('Nova Tarefa / Marco', `
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
    <div class="form-group" style="grid-column:1/-1">
      <label style="color:#94a3b8;font-size:12px">Nome da Tarefa *</label>
      <input id="nt_nome" class="form-control" placeholder="Ex: Montagem da estrutura metálica" style="background:#0f172a;border:1px solid rgba(255,255,255,0.1);color:#f1f5f9;padding:10px;border-radius:8px;width:100%">
    </div>
    <div class="form-group">
      <label style="color:#94a3b8;font-size:12px">Fase</label>
      <select id="nt_fase" class="form-control" style="background:#0f172a;border:1px solid rgba(255,255,255,0.1);color:#f1f5f9;padding:10px;border-radius:8px;width:100%">${optsFase}</select>
    </div>
    <div class="form-group">
      <label style="color:#94a3b8;font-size:12px">Tipo</label>
      <select id="nt_tipo" class="form-control" style="background:#0f172a;border:1px solid rgba(255,255,255,0.1);color:#f1f5f9;padding:10px;border-radius:8px;width:100%">
        <option>Tarefa</option><option>Marco</option><option>Entrega</option>
      </select>
    </div>
    <div class="form-group">
      <label style="color:#94a3b8;font-size:12px">Data Início</label>
      <input id="nt_inicio" type="date" class="form-control" style="background:#0f172a;border:1px solid rgba(255,255,255,0.1);color:#f1f5f9;padding:10px;border-radius:8px;width:100%">
    </div>
    <div class="form-group">
      <label style="color:#94a3b8;font-size:12px">Data Fim</label>
      <input id="nt_fim" type="date" class="form-control" style="background:#0f172a;border:1px solid rgba(255,255,255,0.1);color:#f1f5f9;padding:10px;border-radius:8px;width:100%">
    </div>
    <div class="form-group">
      <label style="color:#94a3b8;font-size:12px">Responsável</label>
      <input id="nt_resp" class="form-control" placeholder="Nome do responsável" style="background:#0f172a;border:1px solid rgba(255,255,255,0.1);color:#f1f5f9;padding:10px;border-radius:8px;width:100%">
    </div>
    <div class="form-group">
      <label style="color:#94a3b8;font-size:12px">Status</label>
      <select id="nt_status" class="form-control" style="background:#0f172a;border:1px solid rgba(255,255,255,0.1);color:#f1f5f9;padding:10px;border-radius:8px;width:100%">
        <option>Não Iniciada</option><option>Em Andamento</option><option>Concluída</option><option>Atrasada</option><option>Suspensa</option>
      </select>
    </div>
    <div class="form-group">
      <label style="color:#94a3b8;font-size:12px">% Avanço Físico</label>
      <input id="nt_avanco" type="range" min="0" max="100" value="0" oninput="document.getElementById('nt_avanco_val').textContent=this.value+'%'" style="width:100%;accent-color:#10b981">
      <span id="nt_avanco_val" style="color:#10b981;font-weight:700;font-size:13px">0%</span>
    </div>
    <div class="form-group" style="grid-column:1/-1">
      <label style="color:#94a3b8;font-size:12px">Recursos Alocados (separados por vírgula)</label>
      <input id="nt_recursos" class="form-control" placeholder="Ex: Equipe mecânica, Guindaste 50t, Parafusos M16" style="background:#0f172a;border:1px solid rgba(255,255,255,0.1);color:#f1f5f9;padding:10px;border-radius:8px;width:100%">
    </div>
    <div class="form-group" style="grid-column:1/-1">
      <label style="color:#94a3b8;font-size:12px">Descrição / Observações</label>
      <textarea id="nt_desc" rows="2" class="form-control" style="background:#0f172a;border:1px solid rgba(255,255,255,0.1);color:#f1f5f9;padding:10px;border-radius:8px;width:100%;resize:vertical"></textarea>
    </div>
  </div>
  <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:20px">
    <button onclick="closeModal()" style="background:#1e293b;color:#94a3b8;border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:10px 20px;cursor:pointer">Cancelar</button>
    <button onclick="pgSalvarNovaTarefa('${projId}')" style="background:linear-gradient(135deg,#3b82f6,#2563eb);color:#fff;border:none;border-radius:8px;padding:10px 24px;font-weight:600;cursor:pointer"><i class="fas fa-save" style="margin-right:6px"></i>Salvar Tarefa</button>
  </div>`);
}

function pgSalvarNovaTarefa(projId) {
  const nome = document.getElementById('nt_nome')?.value?.trim();
  if (!nome) { showToast('Informe o nome da tarefa', 'warning'); return; }
  const faseId = document.getElementById('nt_fase')?.value;
  const toISO  = v => { if (!v) return ''; const [a,m,d] = v.split('-'); return `${d}/${m}/${a}`; };

  const tarefa = {
    id:          gerarId('TAR'),
    nome,
    tipo:        document.getElementById('nt_tipo')?.value || 'Tarefa',
    inicio:      toISO(document.getElementById('nt_inicio')?.value),
    fim:         toISO(document.getElementById('nt_fim')?.value),
    responsavel: document.getElementById('nt_resp')?.value?.trim() || '',
    status:      document.getElementById('nt_status')?.value || 'Não Iniciada',
    avanco:      parseInt(document.getElementById('nt_avanco')?.value) || 0,
    descricao:   document.getElementById('nt_desc')?.value?.trim() || '',
    recursos:    (document.getElementById('nt_recursos')?.value || '').split(',').map(s=>s.trim()).filter(Boolean),
    criado_em:   new Date().toLocaleDateString('pt-BR'),
  };

  const ps   = _getProjetos();
  const proj = ps.find(p => p.id === projId);
  if (!proj) return;
  const fase = proj.fases.find(f => f.id === faseId);
  if (fase) { fase.tarefas = fase.tarefas || []; fase.tarefas.push(tarefa); }
  _saveProjetos(ps);
  closeModal();
  showToast(`Tarefa "${nome}" adicionada!`, 'success');
  pgAbrirProjeto(projId);
}

// MODAL: Atualizar Avanço
function pgAtualizarAvanco(projId, faseId, tarefaId) {
  const proj  = _getProjetoById(projId);
  const fase  = proj?.fases?.find(f => f.id === faseId);
  const tar   = fase?.tarefas?.find(t => t.id === tarefaId);
  if (!tar) return;

  openModal(`Atualizar Avanço – ${tar.nome}`, `
  <div style="text-align:center;padding:10px">
    <div style="font-size:48px;font-weight:700;color:#10b981;margin-bottom:8px" id="av_display">${tar.avanco||0}%</div>
    <input type="range" min="0" max="100" value="${tar.avanco||0}" id="av_range"
      oninput="document.getElementById('av_display').textContent=this.value+'%'"
      style="width:100%;accent-color:#10b981;height:8px;margin-bottom:16px">
    <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
      ${[0,25,50,75,100].map(v=>`<button onclick="document.getElementById('av_range').value=${v};document.getElementById('av_display').textContent='${v}%'"
        style="background:rgba(16,185,129,0.15);color:#6ee7b7;border:1px solid rgba(16,185,129,0.3);
               border-radius:6px;padding:6px 12px;cursor:pointer;font-weight:600">${v}%</button>`).join('')}
    </div>
    <div style="margin-top:16px">
      <select id="av_status" style="background:#0f172a;border:1px solid rgba(255,255,255,0.1);color:#f1f5f9;
                                    padding:8px;border-radius:8px;width:100%">
        <option ${tar.status==='Não Iniciada'?'selected':''}>Não Iniciada</option>
        <option ${tar.status==='Em Andamento'?'selected':''}>Em Andamento</option>
        <option ${tar.status==='Concluída'?'selected':''}>Concluída</option>
        <option ${tar.status==='Atrasada'?'selected':''}>Atrasada</option>
      </select>
    </div>
  </div>
  <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px">
    <button onclick="closeModal()" style="background:#1e293b;color:#94a3b8;border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:9px 18px;cursor:pointer">Cancelar</button>
    <button onclick="pgConfirmarAvanco('${projId}','${faseId}','${tarefaId}')"
      style="background:linear-gradient(135deg,#10b981,#059669);color:#fff;border:none;border-radius:8px;padding:9px 20px;font-weight:600;cursor:pointer">
      <i class="fas fa-save"></i> Salvar Avanço
    </button>
  </div>`);
}

function pgConfirmarAvanco(projId, faseId, tarefaId) {
  const ps    = _getProjetos();
  const proj  = ps.find(p => p.id === projId);
  const fase  = proj?.fases?.find(f => f.id === faseId);
  const tar   = fase?.tarefas?.find(t => t.id === tarefaId);
  if (!tar) return;
  tar.avanco = parseInt(document.getElementById('av_range')?.value) || 0;
  tar.status = document.getElementById('av_status')?.value || tar.status;
  if (tar.avanco === 100) tar.status = 'Concluída';
  // Recalcula avanço geral do projeto
  const todas = proj.fases.flatMap(f => f.tarefas||[]);
  proj.avanco_geral = todas.length ? Math.round(todas.reduce((s,t)=>s+(t.avanco||0),0)/todas.length) : 0;
  _saveProjetos(ps);
  closeModal();
  showToast(`Avanço atualizado: ${tar.avanco}%`, 'success');
  pgAbrirProjeto(projId);
}

// MODAL: Nova Medição
function pgNovasMedicaoModal(projId) {
  const proj = _getProjetoById(projId);
  if (!proj) return;
  const numMed = (proj.medicoes||[]).length + 1;
  const mesAtual = new Date().toLocaleDateString('pt-BR',{month:'long',year:'numeric'});

  openModalWide(`Nova Medição – ${proj.nome}`, `
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
    <div class="form-group">
      <label style="color:#94a3b8;font-size:12px">Número da Medição</label>
      <input id="med_num" type="number" value="${numMed}" class="form-control" style="background:#0f172a;border:1px solid rgba(255,255,255,0.1);color:#f1f5f9;padding:10px;border-radius:8px;width:100%">
    </div>
    <div class="form-group">
      <label style="color:#94a3b8;font-size:12px">Período de Referência</label>
      <input id="med_periodo" class="form-control" value="${mesAtual}" style="background:#0f172a;border:1px solid rgba(255,255,255,0.1);color:#f1f5f9;padding:10px;border-radius:8px;width:100%">
    </div>
    <div class="form-group" style="grid-column:1/-1">
      <label style="color:#94a3b8;font-size:12px">Descrição dos Serviços Medidos</label>
      <textarea id="med_desc" rows="2" class="form-control" placeholder="Descreva os serviços realizados no período..." style="background:#0f172a;border:1px solid rgba(255,255,255,0.1);color:#f1f5f9;padding:10px;border-radius:8px;width:100%;resize:vertical"></textarea>
    </div>
    <div class="form-group">
      <label style="color:#94a3b8;font-size:12px">Valor Medido (R$) *</label>
      <input id="med_valor" type="number" class="form-control" placeholder="0,00" style="background:#0f172a;border:1px solid rgba(255,255,255,0.1);color:#f1f5f9;padding:10px;border-radius:8px;width:100%">
    </div>
    <div class="form-group">
      <label style="color:#94a3b8;font-size:12px">Avanço Físico no Período (%)</label>
      <input id="med_avanco" type="number" min="0" max="100" value="0" class="form-control" style="background:#0f172a;border:1px solid rgba(255,255,255,0.1);color:#f1f5f9;padding:10px;border-radius:8px;width:100%">
    </div>
    <div class="form-group">
      <label style="color:#94a3b8;font-size:12px">Status</label>
      <select id="med_status" class="form-control" style="background:#0f172a;border:1px solid rgba(255,255,255,0.1);color:#f1f5f9;padding:10px;border-radius:8px;width:100%">
        <option>Pendente</option><option>Em Análise</option><option>Aprovada</option><option>Rejeitada</option>
      </select>
    </div>
    <div class="form-group">
      <label style="color:#94a3b8;font-size:12px">Responsável pela Medição</label>
      <input id="med_resp" class="form-control" value="${currentUser?.name||''}" style="background:#0f172a;border:1px solid rgba(255,255,255,0.1);color:#f1f5f9;padding:10px;border-radius:8px;width:100%">
    </div>
    <div class="form-group" style="grid-column:1/-1">
      <label style="color:#94a3b8;font-size:12px">OS Vinculadas (separadas por vírgula)</label>
      <input id="med_os" class="form-control" placeholder="OS-2025-0001, OS-2025-0002" style="background:#0f172a;border:1px solid rgba(255,255,255,0.1);color:#f1f5f9;padding:10px;border-radius:8px;width:100%">
    </div>
    <div class="form-group" style="grid-column:1/-1">
      <label style="color:#94a3b8;font-size:12px">Observações / Ressalvas</label>
      <textarea id="med_obs" rows="2" class="form-control" style="background:#0f172a;border:1px solid rgba(255,255,255,0.1);color:#f1f5f9;padding:10px;border-radius:8px;width:100%;resize:vertical"></textarea>
    </div>
  </div>
  <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:20px">
    <button onclick="closeModal()" style="background:#1e293b;color:#94a3b8;border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:10px 20px;cursor:pointer">Cancelar</button>
    <button onclick="pgSalvarMedicao('${projId}')" style="background:linear-gradient(135deg,#10b981,#059669);color:#fff;border:none;border-radius:8px;padding:10px 24px;font-weight:600;cursor:pointer"><i class="fas fa-save" style="margin-right:6px"></i>Registrar Medição</button>
  </div>`);
}

function pgSalvarMedicao(projId) {
  const valor = parseFloat(document.getElementById('med_valor')?.value);
  if (!valor || valor <= 0) { showToast('Informe o valor medido', 'warning'); return; }

  const ps   = _getProjetos();
  const proj = ps.find(p => p.id === projId);
  if (!proj) return;

  proj.medicoes = proj.medicoes || [];
  const totalAnterior = proj.medicoes.reduce((s, m) => s + (m.valor_medido || 0), 0);

  const med = {
    id:              gerarId('MED'),
    numero:          parseInt(document.getElementById('med_num')?.value) || proj.medicoes.length + 1,
    periodo:         document.getElementById('med_periodo')?.value || '',
    descricao:       document.getElementById('med_desc')?.value?.trim() || '',
    valor_medido:    valor,
    valor_acumulado: totalAnterior + valor,
    avanco_fisico:   parseInt(document.getElementById('med_avanco')?.value) || 0,
    avanco_acumulado:0,
    status:          document.getElementById('med_status')?.value || 'Pendente',
    responsavel:     document.getElementById('med_resp')?.value?.trim() || '',
    os_ids:          (document.getElementById('med_os')?.value || '').split(',').map(s=>s.trim()).filter(Boolean),
    obs:             document.getElementById('med_obs')?.value?.trim() || '',
    data:            new Date().toLocaleDateString('pt-BR'),
    criado_por:      currentUser?.name || '',
  };
  // Calcular avanço acumulado
  const totalMed = totalAnterior + valor;
  med.avanco_acumulado = proj.valor_contrato > 0 ? Math.round(totalMed / proj.valor_contrato * 100) : 0;

  proj.medicoes.push(med);
  // Adicionar ponto na curva S
  proj.curva_planejada = proj.curva_planejada || [];

  _saveProjetos(ps);
  closeModal();
  showToast(`Medição Nº${med.numero} registrada – R$ ${_pgFmt(valor)}`, 'success');
  _pgAbaAtiva = 'medicoes';
  pgAbrirProjeto(projId);
}

// MODAL: Adicionar Recurso
function pgAdicionarRecursoModal(projId) {
  openModal('Adicionar Recurso', `
  <div style="display:grid;gap:12px">
    <div class="form-group">
      <label style="color:#94a3b8;font-size:12px">Tipo de Recurso</label>
      <select id="rec_tipo" class="form-control" style="background:#0f172a;border:1px solid rgba(255,255,255,0.1);color:#f1f5f9;padding:10px;border-radius:8px;width:100%">
        <option>Equipe</option><option>Equipamento</option><option>Material</option><option>Serviço</option>
      </select>
    </div>
    <div class="form-group">
      <label style="color:#94a3b8;font-size:12px">Nome / Descrição *</label>
      <input id="rec_nome" class="form-control" placeholder="Ex: Soldador qualificado, Escavadeira CAT 320..." style="background:#0f172a;border:1px solid rgba(255,255,255,0.1);color:#f1f5f9;padding:10px;border-radius:8px;width:100%">
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
      <div class="form-group">
        <label style="color:#94a3b8;font-size:12px">Quantidade</label>
        <input id="rec_qtd" type="number" value="1" class="form-control" style="background:#0f172a;border:1px solid rgba(255,255,255,0.1);color:#f1f5f9;padding:10px;border-radius:8px;width:100%">
      </div>
      <div class="form-group">
        <label style="color:#94a3b8;font-size:12px">Unidade</label>
        <input id="rec_un" class="form-control" placeholder="un, h, m³..." style="background:#0f172a;border:1px solid rgba(255,255,255,0.1);color:#f1f5f9;padding:10px;border-radius:8px;width:100%">
      </div>
      <div class="form-group">
        <label style="color:#94a3b8;font-size:12px">Custo Unitário (R$)</label>
        <input id="rec_custo" type="number" value="0" class="form-control" style="background:#0f172a;border:1px solid rgba(255,255,255,0.1);color:#f1f5f9;padding:10px;border-radius:8px;width:100%"
          oninput="document.getElementById('rec_total').textContent='R$ '+_pgFmt((parseFloat(this.value)||0)*(parseFloat(document.getElementById('rec_qtd').value)||1))">
      </div>
    </div>
    <div style="text-align:right;font-size:14px;color:#10b981;font-weight:700">
      Total: <span id="rec_total">R$ 0,00</span>
    </div>
    <div class="form-group">
      <label style="color:#94a3b8;font-size:12px">Fase de Alocação</label>
      <select id="rec_fase" class="form-control" style="background:#0f172a;border:1px solid rgba(255,255,255,0.1);color:#f1f5f9;padding:10px;border-radius:8px;width:100%">
        <option value="">Todas as fases</option>
        ${(_getProjetoById(projId)?.fases||[]).map(f=>`<option>${f.nome}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label style="color:#94a3b8;font-size:12px">Fornecedor / Empresa</label>
      <input id="rec_forn" class="form-control" placeholder="Nome do fornecedor ou empresa" style="background:#0f172a;border:1px solid rgba(255,255,255,0.1);color:#f1f5f9;padding:10px;border-radius:8px;width:100%">
    </div>
  </div>
  <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px">
    <button onclick="closeModal()" style="background:#1e293b;color:#94a3b8;border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:9px 18px;cursor:pointer">Cancelar</button>
    <button onclick="pgSalvarRecurso('${projId}')" style="background:linear-gradient(135deg,#3b82f6,#2563eb);color:#fff;border:none;border-radius:8px;padding:9px 20px;font-weight:600;cursor:pointer"><i class="fas fa-save"></i> Salvar</button>
  </div>`);
}

function pgSalvarRecurso(projId) {
  const nome = document.getElementById('rec_nome')?.value?.trim();
  if (!nome) { showToast('Informe o nome do recurso', 'warning'); return; }
  const qtd  = parseFloat(document.getElementById('rec_qtd')?.value) || 1;
  const custo= parseFloat(document.getElementById('rec_custo')?.value) || 0;

  const recurso = {
    id:          gerarId('REC'),
    tipo:        document.getElementById('rec_tipo')?.value || 'Equipe',
    nome,
    quantidade:  qtd,
    unidade:     document.getElementById('rec_un')?.value || 'un',
    custo_unit:  custo,
    custo_total: qtd * custo,
    fase:        document.getElementById('rec_fase')?.value || '',
    fornecedor:  document.getElementById('rec_forn')?.value?.trim() || '',
  };

  const ps   = _getProjetos();
  const proj = ps.find(p => p.id === projId);
  if (!proj) return;
  proj.recursos = proj.recursos || [];
  proj.recursos.push(recurso);
  _saveProjetos(ps);
  closeModal();
  showToast(`Recurso "${nome}" adicionado!`, 'success');
  _pgAbaAtiva = 'recursos';
  pgAbrirProjeto(projId);
}

// MODAL: Ver Medição
function pgVerMedicao(projId, medId) {
  const proj = _getProjetoById(projId);
  const med  = proj?.medicoes?.find(m => m.id === medId);
  if (!med) return;

  openModalWide(`Medição Nº${med.numero} – ${proj.nome}`, `
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
    ${[
      ['Número', med.numero], ['Período', med.periodo], ['Data', med.data],
      ['Status', med.status], ['Responsável', med.responsavel],
      ['Valor Medido', `R$ ${_pgFmt(med.valor_medido)}`],
      ['Valor Acumulado', `R$ ${_pgFmt(med.valor_acumulado)}`],
      ['Avanço Físico', `${med.avanco_fisico}%`],
      ['Avanço Acumulado', `${med.avanco_acumulado}%`],
    ].map(([l,v])=>`
      <div style="background:#0f172a;border-radius:8px;padding:12px">
        <div style="font-size:10px;color:#64748b;margin-bottom:4px">${l}</div>
        <div style="font-size:14px;color:#f1f5f9;font-weight:600">${v||'–'}</div>
      </div>`).join('')}
    <div style="grid-column:1/-1;background:#0f172a;border-radius:8px;padding:12px">
      <div style="font-size:10px;color:#64748b;margin-bottom:4px">Descrição</div>
      <div style="font-size:13px;color:#cbd5e1">${med.descricao||'–'}</div>
    </div>
    ${med.obs ? `<div style="grid-column:1/-1;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.2);border-radius:8px;padding:12px">
      <div style="font-size:10px;color:#f59e0b;margin-bottom:4px"><i class="fas fa-exclamation-triangle"></i> Observações</div>
      <div style="font-size:13px;color:#fcd34d">${med.obs}</div>
    </div>` : ''}
  </div>
  <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px">
    <button onclick="closeModal()" style="background:#1e293b;color:#94a3b8;border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:9px 18px;cursor:pointer">Fechar</button>
    <button onclick="pgImprimirMedicao('${projId}','${medId}')" style="background:linear-gradient(135deg,#8b5cf6,#7c3aed);color:#fff;border:none;border-radius:8px;padding:9px 18px;cursor:pointer"><i class="fas fa-print"></i> Imprimir</button>
  </div>`);
}

function pgImprimirMedicao(projId, medId) {
  const proj = _getProjetoById(projId);
  const med  = proj?.medicoes?.find(m => m.id === medId);
  if (!med) return;
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><title>Medição Nº${med.numero}</title>
  <style>body{font-family:Arial;padding:30px;color:#1e293b}h1{color:#10b981}table{width:100%;border-collapse:collapse}
  th{background:#10b981;color:#fff;padding:8px;text-align:left}td{padding:8px;border-bottom:1px solid #e2e8f0}
  .total{font-weight:700;color:#10b981;font-size:18px}.header{display:flex;justify-content:space-between;margin-bottom:20px}
  .badge{background:#10b981;color:#fff;padding:3px 10px;border-radius:20px;font-size:12px}</style>
  </head><body>
  <div class="header"><div><h2 style="margin:0">Fraser Alexander</h2><p style="margin:0;color:#64748b">Sistema de Gestão Integrado</p></div>
  <div style="text-align:right"><div style="font-size:24px;font-weight:700;color:#10b981">MEDIÇÃO Nº${med.numero}</div>
  <span class="badge">${med.status}</span></div></div>
  <h1>${proj.nome}</h1>
  <table><tr><th>Campo</th><th>Valor</th></tr>
  <tr><td>Período</td><td>${med.periodo}</td></tr>
  <tr><td>Data de Emissão</td><td>${med.data}</td></tr>
  <tr><td>Descrição</td><td>${med.descricao||'–'}</td></tr>
  <tr><td>Avanço Físico do Período</td><td>${med.avanco_fisico}%</td></tr>
  <tr><td>Avanço Físico Acumulado</td><td>${med.avanco_acumulado}%</td></tr>
  <tr><td>Valor Medido</td><td class="total">R$ ${_pgFmt(med.valor_medido)}</td></tr>
  <tr><td>Valor Acumulado</td><td>R$ ${_pgFmt(med.valor_acumulado)}</td></tr>
  <tr><td>Responsável</td><td>${med.responsavel||'–'}</td></tr>
  ${med.obs ? `<tr><td>Observações</td><td>${med.obs}</td></tr>` : ''}
  </table>
  <div style="margin-top:60px;display:flex;justify-content:space-between">
  <div style="text-align:center"><div style="border-top:1px solid #1e293b;padding-top:8px;width:200px">${med.responsavel||'Responsável'}</div></div>
  <div style="text-align:center"><div style="border-top:1px solid #1e293b;padding-top:8px;width:200px">Aprovação do Cliente</div></div>
  </div>
  <p style="margin-top:40px;font-size:11px;color:#94a3b8;text-align:center">Emitido em ${new Date().toLocaleDateString('pt-BR')} via Fraser Alexander ERP</p>
  </body></html>`);
  win.document.close();
  win.print();
}

function pgExportarPDF() {
  showToast('Gerando PDF do projeto...', 'info');
  window.print();
}

function pgEditarProjeto(projId) {
  showToast('Modo de edição em desenvolvimento. Use os botões de tarefa e medição.', 'info');
}

function pgEditarTarefaModal(projId, faseId, tarefaId) {
  pgAtualizarAvanco(projId, faseId, tarefaId);
}

// ─── HELPERS ─────────────────────────────────────────────────────────
function _pgFmt(v) {
  return (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function _pgVazio(msg) {
  return `<div style="text-align:center;padding:60px 20px;color:#475569">
    <i class="fas fa-inbox" style="font-size:40px;margin-bottom:12px;opacity:.3"></i>
    <p style="font-size:14px">${msg}</p>
  </div>`;
}

// ─── EXPORTS GLOBAIS ─────────────────────────────────────────────────
window.renderProjetosGantt    = renderProjetosGantt;
window.pgAbrirProjeto         = pgAbrirProjeto;
window.pgSwitchAba            = pgSwitchAba;
window.pgNovoProjetoModal     = pgNovoProjetoModal;
window.pgSalvarNovoProjeto    = pgSalvarNovoProjeto;
window.pgNovaTarefaModal      = pgNovaTarefaModal;
window.pgSalvarNovaTarefa     = pgSalvarNovaTarefa;
window.pgAtualizarAvanco      = pgAtualizarAvanco;
window.pgConfirmarAvanco      = pgConfirmarAvanco;
window.pgNovasMedicaoModal    = pgNovasMedicaoModal;
window.pgSalvarMedicao        = pgSalvarMedicao;
window.pgAdicionarRecursoModal= pgAdicionarRecursoModal;
window.pgSalvarRecurso        = pgSalvarRecurso;
window.pgVerMedicao           = pgVerMedicao;
window.pgImprimirMedicao      = pgImprimirMedicao;
window.pgExportarPDF          = pgExportarPDF;
window.pgEditarProjeto        = pgEditarProjeto;
window.pgEditarTarefaModal    = pgEditarTarefaModal;
window._pgFmt                 = _pgFmt;
window._pgShowTarefaTooltip   = _pgShowTarefaTooltip;
window._pgHideTooltip         = _pgHideTooltip;

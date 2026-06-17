// =====================================================================
// Fraser Alexander ERP – Módulo: BUSCA GLOBAL & TIMELINE v3.0
// Pesquisa dinâmica unificada com rastreamento de fluxo completo:
// OS → RC → RFQ → Mapa → PED → Recebimento → Almoxarifado
// =====================================================================

let _bgQuery   = '';
let _bgFiltros = { tipo: 'todos', status: 'todos', periodo: 'todos' };
let _bgResultados = [];
let _bgLoading  = false;
let _bgTimelineMode = false;
let _bgHistorico = [];
let _bgDebounce = null;

// ─── RASTREAMENTO DE FLUXO ────────────────────────────────────────────
// Monta o fluxo completo de um processo (OS, RC, etc.) através de todos os módulos
function _bgRastrearFluxo(id, tipo) {
  const fluxo = [];
  try {
    // Coleta dados de todas as fontes
    const osMap = _bgColetarOS();
    const rcMap = _bgColetarRC();
    const rfqMap = _bgColetarRFQ();
    const pedMap = _bgColetarPedidos();
    const recMap = _bgColetarRecebimentos();
    const almoxMap = _bgColetarAlmoxarifado();

    if (tipo === 'os') {
      const os = osMap.get(id);
      if (os) {
        fluxo.push({ etapa: 'OS', id: os.id, status: os.status, data: os.data_abertura || os.criado_em, desc: os.descricao, tipo: 'os' });
        // RC vinculadas
        [...rcMap.values()].filter(rc => rc.os_id === id || rc.os_vinculada === id).forEach(rc => {
          fluxo.push({ etapa: 'RC', id: rc.id, status: rc.status, data: rc.data || rc.data_criacao, desc: rc.descricao || rc.titulo, tipo: 'rc' });
          // RFQs da RC
          [...rfqMap.values()].filter(rfq => rfq.rc_id === rc.id || rfq.rc_numero === rc.numero).forEach(rfq => {
            fluxo.push({ etapa: 'RFQ', id: rfq.id, status: rfq.status, data: rfq.data || rfq.data_criacao, desc: rfq.titulo || rfq.descricao, tipo: 'rfq' });
            // Pedidos do RFQ
            [...pedMap.values()].filter(p => p.rfq_id === rfq.id || p.rfq_numero === rfq.numero || p.rfq_numero === rfq.id).forEach(ped => {
              fluxo.push({ etapa: 'Pedido', id: ped.id, status: ped.status, data: ped.data_emissao || ped.data, desc: ped.fornecedor_nome || ped.fornecedor, tipo: 'pedido', valor: ped.valor_total || ped.total });
              // Recebimentos do Pedido
              [...recMap.values()].filter(r => r.pedido_id === ped.id || r.pedido_numero === ped.numero).forEach(rec => {
                fluxo.push({ etapa: 'Recebimento', id: rec.id, status: rec.status, data: rec.data_recebimento, desc: `NF ${rec.nf_numero||'?'}`, tipo: 'recebimento', etapa_rec: rec.etapa });
                if (rec.etapa === 'Entrada Almoxarifado') {
                  fluxo.push({ etapa: 'Almoxarifado', id: rec.id, status: 'Entrada Confirmada', data: rec.data_entrada_almox || rec.data_recebimento, desc: rec.local_armazenamento || 'Estoque', tipo: 'almoxarifado' });
                }
              });
            });
          });
        });
      }
    }
  } catch(e) { console.warn('[BuscaGlobal] Erro ao rastrear fluxo:', e); }
  return fluxo;
}

// ─── COLETORES DE DADOS ───────────────────────────────────────────────
function _bgColetarOS() {
  const m = new Map();
  ['fa_ordens_servico','fa_os_list','fraser_os'].forEach(k => {
    try { JSON.parse(localStorage.getItem(k)||'[]').forEach(o => { if(o.id&&!m.has(o.id)) m.set(o.id,o); }); } catch(e){}
  });
  if (typeof ERP_DATA !== 'undefined' && Array.isArray(ERP_DATA.ordens)) {
    ERP_DATA.ordens.forEach(o => { if(o.id&&!m.has(o.id)) m.set(o.id,o); });
  }
  return m;
}
function _bgColetarRC() {
  const m = new Map();
  ['fa_requisicoes','fa_rcs','fa_rc','fraser_rcs'].forEach(k => {
    try { JSON.parse(localStorage.getItem(k)||'[]').forEach(r => { if(r.id&&!m.has(r.id)) m.set(r.id,r); }); } catch(e){}
  });
  return m;
}
function _bgColetarRFQ() {
  const m = new Map();
  ['fa_rfqs','fa_rfq_flow','fraser_rfqs'].forEach(k => {
    try { JSON.parse(localStorage.getItem(k)||'[]').forEach(r => { if(r.id&&!m.has(r.id)) m.set(r.id,r); }); } catch(e){}
  });
  return m;
}
function _bgColetarPedidos() {
  const m = new Map();
  ['fa_pedidos','fraser_pedidos'].forEach(k => {
    try { JSON.parse(localStorage.getItem(k)||'[]').forEach(p => { if(p.id&&!m.has(p.id)) m.set(p.id,p); }); } catch(e){}
  });
  if (typeof FA_PEDIDOS !== 'undefined' && Array.isArray(FA_PEDIDOS)) {
    FA_PEDIDOS.forEach(p => { if(p.id&&!m.has(p.id)) m.set(p.id,p); });
  }
  return m;
}
function _bgColetarRecebimentos() {
  const m = new Map();
  ['fa_recebimentos','fraser_recebimentos'].forEach(k => {
    try { JSON.parse(localStorage.getItem(k)||'[]').forEach(r => { if(r.id&&!m.has(r.id)) m.set(r.id,r); }); } catch(e){}
  });
  return m;
}
function _bgColetarAlmoxarifado() {
  const m = new Map();
  ['fa_almox_movimentos','fa_estoque_v2'].forEach(k => {
    try { JSON.parse(localStorage.getItem(k)||'[]').forEach(r => { if(r.id&&!m.has(r.id)) m.set(r.id,r); }); } catch(e){}
  });
  return m;
}

// ─── RENDER PRINCIPAL ─────────────────────────────────────────────────
function renderBuscaGlobal() {
  const el = document.getElementById('mainContent');
  if (!el) { console.warn('[BuscaGlobal] mainContent não encontrado'); return; }

  const tipos = [
    { k:'todos',       i:'fa-th',                l:'Todos' },
    { k:'os',          i:'fa-clipboard-list',    l:'OS' },
    { k:'rc',          i:'fa-file-alt',          l:'RC' },
    { k:'rfq',         i:'fa-envelope-open-text',l:'RFQ' },
    { k:'pedido',      i:'fa-shopping-bag',      l:'Pedidos' },
    { k:'recebimento', i:'fa-dolly',             l:'Recebimento' },
    { k:'fornecedor',  i:'fa-building',          l:'Fornecedores' },
    { k:'contrato',    i:'fa-file-contract',     l:'Contratos' },
    { k:'medicao',     i:'fa-ruler-combined',    l:'Medições' },
    { k:'equipe',      i:'fa-users',             l:'Equipe' },
    { k:'frota',       i:'fa-truck',             l:'Frota' },
  ];

  const periodos = [
    { k:'todos',     l:'Qualquer data' },
    { k:'hoje',      l:'Hoje' },
    { k:'semana',    l:'Esta semana' },
    { k:'mes',       l:'Este mês' },
    { k:'trimestre', l:'Trimestre' },
    { k:'ano',       l:'Este ano' },
  ];

  el.innerHTML = `
    <!-- CABEÇALHO -->
    <div class="page-header" style="margin-bottom:20px">
      <div class="page-title">
        <i class="fas fa-search page-icon" style="color:var(--primary)"></i>
        <div>
          <h1>Busca Global & Timeline</h1>
          <p class="page-subtitle">Pesquise em todos os módulos: OS, RC, Pedidos, Fornecedores, Contratos e mais</p>
        </div>
      </div>
      <div style="display:flex;gap:8px">
        <button onclick="_bgToggleTimeline()" class="btn ${_bgTimelineMode ? 'btn-primary' : 'btn-secondary'}" title="Alternar modo Timeline">
          <i class="fas fa-stream"></i> ${_bgTimelineMode ? 'Timeline' : 'Modo Timeline'}
        </button>
      </div>
    </div>

    <!-- BARRA DE BUSCA PRINCIPAL -->
    <div style="background:var(--bg-card);border-radius:18px;border:2px solid var(--border);padding:28px 28px 22px;margin-bottom:16px;box-shadow:0 6px 32px rgba(0,0,0,0.13)">

      <!-- Campo de busca grande + botão limpar sempre presente -->
      <div style="position:relative;margin-bottom:16px">
        <i class="fas fa-search" id="bg_search_icon" style="position:absolute;left:22px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:22px;pointer-events:none;transition:color .2s"></i>
        <input type="text" id="bg_search_input"
          placeholder="Digite aqui: OS-001, fornecedor, CNPJ, contrato, status, medição…"
          value="${_bgQuery}"
          style="width:100%;padding:22px 64px 22px 64px;font-size:20px;line-height:1.5;border:2.5px solid ${_bgQuery ? 'var(--orange)' : 'var(--border)'};border-radius:16px;background:var(--bg-dark);color:var(--text-primary);outline:none;transition:border-color .2s,box-shadow .2s;box-sizing:border-box;font-family:inherit;box-shadow:${_bgQuery ? '0 0 0 4px rgba(249,115,22,0.13)' : 'none'}"
          oninput="_bgOnInput(this.value)"
          onkeydown="if(event.key==='Enter'){_bgBuscar(this.value)} else if(event.key==='Escape'){_bgLimpar()}"
          onfocus="this.style.borderColor='var(--orange)';this.style.boxShadow='0 0 0 4px rgba(249,115,22,0.15)';document.getElementById('bg_search_icon').style.color='var(--orange)'"
          onblur="if(!this.value){this.style.borderColor='var(--border)';this.style.boxShadow='none';document.getElementById('bg_search_icon').style.color='var(--text-muted)'}"
          autocomplete="off" spellcheck="false">
        <!-- Botão limpar: sempre no DOM, visibilidade controlada por JS -->
        <button id="bg_clear_btn" onclick="_bgLimpar()"
          style="position:absolute;right:14px;top:50%;transform:translateY(-50%);border:none;background:rgba(255,255,255,.08);color:var(--text-secondary);cursor:pointer;font-size:18px;width:38px;height:38px;border-radius:50%;display:${_bgQuery ? 'flex' : 'none'};align-items:center;justify-content:center;line-height:1;transition:background .15s,color .15s;flex-shrink:0"
          onmouseover="this.style.background='var(--orange)';this.style.color='#fff'"
          onmouseout="this.style.background='rgba(255,255,255,.08)';this.style.color='var(--text-secondary)'"
          title="Limpar pesquisa (Esc)">
          <i class="fas fa-times"></i>
        </button>
      </div>

      <!-- Barra de status: query atual + contagem + botão buscar -->
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap">
        <div id="bg_status_bar" style="flex:1;font-size:13px;color:var(--text-muted);min-height:24px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          ${_bgQuery
            ? `<span style="color:var(--text-secondary)">Pesquisando:</span><strong style="color:var(--orange);font-size:15px">"${_bgQuery}"</strong>${_bgResultados.length > 0 ? `<span style="background:rgba(249,115,22,.15);color:var(--orange);font-size:12px;font-weight:700;padding:3px 12px;border-radius:12px;border:1px solid rgba(249,115,22,.3)">${_bgResultados.length} resultado${_bgResultados.length!==1?'s':''}</span>` : ''}`
            : `<span style="opacity:.6;display:flex;align-items:center;gap:6px"><i class="fas fa-lightbulb"></i>Digite qualquer termo — OS, fornecedor, contrato, RC, pedido, medição… e pressione <kbd style="background:var(--bg-dark);border:1px solid var(--border);border-radius:5px;padding:2px 8px;font-size:11px;font-family:monospace">Enter</kbd></span>`
          }
        </div>
        <button onclick="_bgBuscar(document.getElementById('bg_search_input').value)" class="btn btn-primary" style="padding:12px 28px;font-size:15px;border-radius:12px;white-space:nowrap;font-weight:700;flex-shrink:0;letter-spacing:.3px">
          <i class="fas fa-search" style="margin-right:8px"></i>Buscar
        </button>
      </div>

      <!-- Filtros de tipo -->
      <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:10px">
        <span style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-right:4px">Tipo:</span>
        ${tipos.map(f => `
          <button onclick="_bgSetFiltro('tipo','${f.k}')" 
            style="padding:5px 14px;border-radius:20px;border:1.5px solid ${_bgFiltros.tipo===f.k ? 'var(--orange)' : 'var(--border)'};background:${_bgFiltros.tipo===f.k ? 'var(--orange)' : 'transparent'};color:${_bgFiltros.tipo===f.k ? '#fff' : 'var(--text-secondary)'};font-size:12px;font-weight:600;cursor:pointer;transition:all .18s;white-space:nowrap">
            <i class="fas ${f.i}" style="margin-right:4px;font-size:10px"></i>${f.l}
          </button>
        `).join('')}
      </div>

      <!-- Filtros de período -->
      <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
        <span style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-right:4px">Período:</span>
        ${periodos.map(p => `
          <button onclick="_bgSetFiltro('periodo','${p.k}')"
            style="padding:5px 14px;border-radius:20px;border:1.5px solid ${_bgFiltros.periodo===p.k ? 'var(--orange)' : 'var(--border)'};background:${_bgFiltros.periodo===p.k ? 'var(--orange)' : 'transparent'};color:${_bgFiltros.periodo===p.k ? '#fff' : 'var(--text-secondary)'};font-size:12px;font-weight:600;cursor:pointer;transition:all .18s">
            ${p.l}
          </button>
        `).join('')}
      </div>

    </div>

    <!-- ÁREA DE RESULTADOS -->
    <div id="bg_results_area" style="min-height:200px">
      ${_bgQuery ? '<div style="text-align:center;padding:40px;color:var(--text-muted)"><i class="fas fa-spinner fa-spin" style="font-size:24px"></i><br><br>Buscando...</div>' : _bgRenderSugestoes()}
    </div>
  `;

  // Auto-foco
  requestAnimationFrame(() => {
    const inp = document.getElementById('bg_search_input');
    if (inp) { inp.focus(); if (_bgQuery) inp.select(); }
  });

  // Se há query, executa busca imediatamente
  if (_bgQuery) {
    setTimeout(() => _bgBuscar(_bgQuery), 80);
  }
}

function _bgOnInput(val) {
  _bgQuery = val;

  // Mostra/esconde botão limpar dinamicamente
  const clearBtn = document.getElementById('bg_clear_btn');
  if (clearBtn) clearBtn.style.display = val ? 'flex' : 'none';

  // Muda cor da borda e ícone conforme estado
  const inp = document.getElementById('bg_search_input');
  const ico = document.getElementById('bg_search_icon');
  if (inp) {
    inp.style.borderColor = val ? 'var(--orange)' : 'var(--border)';
    inp.style.boxShadow   = val ? '0 0 0 4px rgba(249,115,22,0.13)' : 'none';
  }
  if (ico) ico.style.color = val ? 'var(--orange)' : 'var(--text-muted)';

  // Atualiza barra de status ao vivo
  const sb = document.getElementById('bg_status_bar');
  if (sb) {
    if (!val) {
      sb.innerHTML = `<span style="opacity:.6;display:flex;align-items:center;gap:6px"><i class="fas fa-lightbulb"></i>Digite qualquer termo — OS, fornecedor, contrato, RC, pedido, medição… e pressione <kbd style="background:var(--bg-dark);border:1px solid var(--border);border-radius:5px;padding:2px 8px;font-size:11px;font-family:monospace">Enter</kbd></span>`;
    } else {
      sb.innerHTML = `<span style="color:var(--text-secondary)">Pesquisando:</span> <strong style="color:var(--orange);font-size:15px">"${val}"</strong> <span style="opacity:.5;font-size:12px">— aguardando…</span>`;
    }
  }

  clearTimeout(_bgDebounce);
  if (!val) {
    const el = document.getElementById('bg_results_area');
    if (el) el.innerHTML = _bgRenderSugestoes();
    return;
  }
  _bgDebounce = setTimeout(() => {
    if (val.length >= 2) _bgBuscar(val);
  }, 280);
}

function _bgLimpar() {
  _bgQuery = '';
  _bgResultados = [];
  // Tenta limpar sem re-render completo (mais suave)
  const inp = document.getElementById('bg_search_input');
  const clearBtn = document.getElementById('bg_clear_btn');
  const ico = document.getElementById('bg_search_icon');
  const sb  = document.getElementById('bg_status_bar');
  const res = document.getElementById('bg_results_area');
  if (inp) {
    inp.value = '';
    inp.style.borderColor = 'var(--orange)'; // mantém foco
    inp.style.boxShadow = '0 0 0 4px rgba(249,115,22,0.15)';
    inp.focus();
  }
  if (clearBtn) clearBtn.style.display = 'none';
  if (ico) ico.style.color = 'var(--orange)';
  if (sb) sb.innerHTML = `<span style="opacity:.6;display:flex;align-items:center;gap:6px"><i class="fas fa-lightbulb"></i>Digite qualquer termo — OS, fornecedor, contrato, RC, pedido, medição… e pressione <kbd style="background:var(--bg-dark);border:1px solid var(--border);border-radius:5px;padding:2px 8px;font-size:11px;font-family:monospace">Enter</kbd></span>`;
  if (res) res.innerHTML = _bgRenderSugestoes();
}

function _bgSetFiltro(key, val) {
  _bgFiltros[key] = val;
  const el = document.getElementById('bg_results_area');
  // Atualiza botões de filtro visualmente
  renderBuscaGlobal();
  if (_bgQuery) setTimeout(() => _bgBuscar(_bgQuery), 50);
}

function _bgToggleTimeline() {
  _bgTimelineMode = !_bgTimelineMode;
  if (_bgResultados.length > 0) {
    const el = document.getElementById('bg_results_area');
    if (el) el.innerHTML = _bgRenderResultados();
  }
  // Atualiza botão
  renderBuscaGlobal();
}

// ─── MOTOR DE BUSCA ───────────────────────────────────────────────────
function _bgBuscar(query) {
  if (!query || query.trim().length < 1) return;
  _bgQuery = query.trim();
  const q = _bgQuery.toLowerCase();

  // Adiciona ao histórico
  if (q && !_bgHistorico.includes(q)) {
    _bgHistorico.unshift(q);
    _bgHistorico = _bgHistorico.slice(0, 10);
  }

  const resultados = [];

  const relevancia = (texto, q) => {
    if (!texto) return 0;
    const t = String(texto).toLowerCase();
    if (t === q) return 20;
    if (t.startsWith(q)) return 10;
    if (t.includes(q)) return 5;
    const words = q.split(/\s+/);
    let score = 0;
    words.forEach(w => { if (w.length > 2 && t.includes(w)) score += 2; });
    return score;
  };

  const now = new Date();
  const filtrarPeriodo = (dataStr) => {
    if (_bgFiltros.periodo === 'todos' || !dataStr) return true;
    const d = new Date(dataStr);
    if (isNaN(d.getTime())) return true;
    const diff = (now - d) / (1000*60*60*24);
    const limites = { hoje: 1, semana: 7, mes: 30, trimestre: 90, ano: 365 };
    return diff < (limites[_bgFiltros.periodo] || Infinity);
  };

  const filtrarTipo = (tipo) => _bgFiltros.tipo === 'todos' || _bgFiltros.tipo === tipo;

  // ── OS ──
  if (filtrarTipo('os')) {
    try {
      const osMap = _bgColetarOS();
      const rcMap = _bgColetarRC();
      const rfqMap = _bgColetarRFQ();
      const pedMap = _bgColetarPedidos();
      const recMap = _bgColetarRecebimentos();
      const ordens = [...osMap.values()];
      ordens.forEach(os => {
        const texto = [os.id, os.numero, os.descricao, os.tipo, os.contrato,
          os.responsavel, os.local, os.equipamento, os.cliente, os.prioridade,
          os.wbs_id, os.wbs_descricao, os.status].filter(Boolean).join(' ');
        const rel = relevancia(texto, q);
        if (rel > 0 && filtrarPeriodo(os.data_abertura || os.criado_em || os.prazo || os.created_at)) {
          // Monta mini-fluxo para exibição inline no card
          const rcsVinc = [...rcMap.values()].filter(rc => rc.os_id === os.id || rc.os_vinculada === os.id);
          const pedidos = rcsVinc.flatMap(rc => [...rfqMap.values()]
            .filter(rfq => rfq.rc_id === rc.id)
            .flatMap(rfq => [...pedMap.values()].filter(p => p.rfq_id === rfq.id || p.rfq_numero === rfq.id || p.rfq_numero === rfq.numero))
          );
          const recebimentos = pedidos.flatMap(p => [...recMap.values()].filter(r => r.pedido_id === p.id || r.pedido_numero === p.numero));
          const fluxoMini = [];
          if (rcsVinc.length) fluxoMini.push({ label: 'RC', cnt: rcsVinc.length, cor: '#7c3aed' });
          if (pedidos.length) fluxoMini.push({ label: 'PED', cnt: pedidos.length, cor: '#16a34a' });
          if (recebimentos.length) {
            const almoxConf = recebimentos.filter(r => r.etapa === 'Entrada Almoxarifado').length;
            fluxoMini.push({ label: almoxConf === recebimentos.length ? '✅ Almox' : '⏳ Receb.', cnt: recebimentos.length, cor: almoxConf > 0 ? '#16a34a' : '#ca8a04' });
          }
          resultados.push({
            tipo: 'os', icone: 'fa-clipboard-list', cor: '#2563eb', label: 'OS',
            id: os.id, numero: os.numero || os.id,
            titulo: os.descricao || 'Ordem de Serviço',
            subtitulo: [os.tipo, os.contrato, os.responsavel, os.prioridade].filter(Boolean).join(' · '),
            status: os.status, data: os.data_abertura || os.criado_em || os.prazo,
            rel, acao: () => navigate('os'),
            badge: os.status,
            badgeCor: os.status === 'Concluída' ? '#16a34a' : os.status === 'Em Andamento' ? '#2563eb' : '#f59e0b',
            fluxoMini,
          });
        }
      });
    } catch(e) {}
  }

  // ── RC – Requisições de Compra ──
  if (filtrarTipo('rc')) {
    try {
      const rcMap = _bgColetarRC();
      const rcs = [...rcMap.values()];
      rcs.forEach(rc => {
        const itensTexto = (rc.itens || []).map(it => it.descricao || it.material || it.desc || '').join(' ');
        const texto = [rc.numero, rc.titulo || rc.descricao || rc.objeto, rc.solicitante,
          rc.contrato, rc.os_id, rc.os_vinculada, rc.projeto, itensTexto].filter(Boolean).join(' ');
        const rel = relevancia(texto, q);
        if (rel > 0 && filtrarPeriodo(rc.data || rc.data_criacao || rc.created_at)) {
          const total = rc.valor_total || rc.total || 0;
          resultados.push({
            tipo: 'rc', icone: 'fa-file-alt', cor: '#7c3aed', label: 'RC',
            id: rc.id, numero: rc.numero || `RC-${rc.id}`,
            titulo: rc.titulo || rc.descricao || rc.objeto || 'Requisição de Compra',
            subtitulo: [rc.solicitante, rc.contrato, rc.os_id ? `OS: ${rc.os_id}` : null,
              total > 0 ? `R$ ${Number(total).toLocaleString('pt-BR',{minimumFractionDigits:2})}` : null].filter(Boolean).join(' · '),
            status: rc.status || 'Pendente', data: rc.data || rc.data_criacao || rc.created_at,
            rel, acao: () => navigate('requisicoes'),
            badge: rc.status || 'Pendente', badgeCor: '#7c3aed',
          });
        }
      });
    } catch(e) {}
  }

  // ── RFQ ──
  if (filtrarTipo('rfq')) {
    try {
      const rfqMap = _bgColetarRFQ();
      const rfqs = [...rfqMap.values()];
      rfqs.forEach(rfq => {
        const fornsTexto = (rfq.fornecedores_convidados || rfq.fornecedores || [])
          .map(f => (typeof f === 'string' ? f : f.nome || f.id || '')).join(' ');
        const cotTexto = (rfq.cotacoes || []).map(c => c.fornecedor || c.fornecedor_nome || '').join(' ');
        const texto = [rfq.id, rfq.numero, rfq.numero_rfq, rfq.titulo || rfq.descricao,
          rfq.contrato, rfq.rc_id, fornsTexto, cotTexto].filter(Boolean).join(' ');
        const rel = relevancia(texto, q);
        if (rel > 0 && filtrarPeriodo(rfq.data || rfq.data_criacao || rfq.created_at)) {
          const nForn = (rfq.fornecedores_convidados || rfq.fornecedores || []).length;
          resultados.push({
            tipo: 'rfq', icone: 'fa-envelope-open-text', cor: '#0891b2', label: 'RFQ',
            id: rfq.id, numero: rfq.numero || rfq.numero_rfq || rfq.id || `RFQ-?`,
            titulo: rfq.titulo || rfq.descricao || 'Solicitação de Cotação',
            subtitulo: [rfq.contrato, rfq.rc_id ? `RC: ${rfq.rc_id}` : null,
              nForn > 0 ? `${nForn} fornecedor(es)` : null].filter(Boolean).join(' · '),
            status: rfq.status || 'Em Cotação', data: rfq.data || rfq.data_criacao || rfq.created_at,
            rel, acao: () => navigate('mapa_cotacao'),
            badge: rfq.status || 'Em Cotação', badgeCor: '#0891b2',
          });
        }
      });
    } catch(e) {}
  }

  // ── Pedidos de Compra ──
  if (filtrarTipo('pedido')) {
    try {
      const pedMap = _bgColetarPedidos();
      const recMap2 = _bgColetarRecebimentos();
      const pedidos = [...pedMap.values()];
      pedidos.forEach(ped => {
        let itensTexto = '';
        try {
          const its = typeof ped.itens === 'string' ? JSON.parse(ped.itens) : (ped.itens || []);
          itensTexto = its.map(it => it.desc || it.descricao || '').join(' ');
        } catch(e) {}
        const texto = [ped.numero, ped.id,
          ped.fornecedor_nome || ped.fornecedor,
          ped.contrato_id || ped.contrato,
          ped.descricao, ped.solicitante,
          ped.rfq_numero || ped.rfq_id, itensTexto].filter(Boolean).join(' ');
        const rel = relevancia(texto, q);
        if (rel > 0 && filtrarPeriodo(ped.data_emissao || ped.data || ped.created_at)) {
          const valor = ped.valor_total || ped.total || 0;
          const fornNome = ped.fornecedor_nome || ped.fornecedor || '—';
          // Verifica recebimentos vinculados
          const recsVinc = [...recMap2.values()].filter(r => r.pedido_id === ped.id || r.pedido_numero === ped.numero);
          const almoxConf = recsVinc.filter(r => r.etapa === 'Entrada Almoxarifado').length;
          const fluxoMini = [];
          if (ped.rfq_numero || ped.rfq_id) fluxoMini.push({ label: 'RFQ', cnt: 1, cor: '#0891b2' });
          if (recsVinc.length) fluxoMini.push({ label: almoxConf > 0 ? '✅ Almox' : '⏳ Receb', cnt: recsVinc.length, cor: almoxConf > 0 ? '#16a34a' : '#ca8a04' });
          resultados.push({
            tipo: 'pedido', icone: 'fa-shopping-bag', cor: '#16a34a', label: 'Pedido',
            id: ped.id, numero: ped.numero || ped.id || `PC-?`,
            titulo: fornNome !== '—' ? `Pedido – ${fornNome}` : 'Pedido de Compra',
            subtitulo: [ped.contrato_id || ped.contrato,
              valor > 0 ? `R$ ${Number(valor).toLocaleString('pt-BR',{minimumFractionDigits:2})}` : '',
              ped.solicitante].filter(Boolean).join(' · '),
            status: ped.status || 'Pendente', data: ped.data_emissao || ped.data || ped.created_at,
            rel, acao: () => navigate('pedidos'),
            badge: ped.status || 'Pendente', badgeCor: '#16a34a',
            fluxoMini,
          });
        }
      });
    } catch(e) {}
  }

  // ── Recebimentos ──
  if (filtrarTipo('recebimento')) {
    try {
      const recMap = _bgColetarRecebimentos();
      const recs = [...recMap.values()];
      recs.forEach(r => {
        const texto = [r.id, r.numero, r.pedido_numero, r.nf_numero, r.fornecedor, r.conferente, r.local_armazenamento, r.status, r.etapa].filter(Boolean).join(' ');
        const rel = relevancia(texto, q);
        if (rel > 0 && filtrarPeriodo(r.data_recebimento || r.created_at)) {
          const etapa = r.etapa || 'Recebimento Físico';
          const etapaCor = etapa === 'Entrada Almoxarifado' ? '#16a34a' : '#ca8a04';
          resultados.push({
            tipo: 'recebimento', icone: 'fa-dolly', cor: etapaCor, label: 'Recebimento',
            id: r.id, numero: r.numero || r.id || 'REC-?',
            titulo: r.nf_numero ? `NF ${r.nf_numero} – ${r.fornecedor || '?'}` : `Recebimento ${r.numero || r.id}`,
            subtitulo: [r.pedido_numero ? `Pedido: ${r.pedido_numero}` : null, etapa, r.conferente].filter(Boolean).join(' · '),
            status: r.status || 'Conforme', data: r.data_recebimento || r.created_at,
            rel, acao: () => navigate('recebimento'),
            badge: etapa === 'Entrada Almoxarifado' ? '✅ Almox' : '⏳ Aguard. Almox',
            badgeCor: etapaCor,
            extra: r.etapa === 'Entrada Almoxarifado' ? `📦 ${r.local_armazenamento || 'Estoque confirmado'}` : null,
          });
        }
      });
    } catch(e) {}
  }

  // ── Fornecedores ──
  if (filtrarTipo('fornecedor')) {
    try {
      // Busca em múltiplas chaves (fa_fornecedores, fa_fornecedores_cache, API cache, ERP_DATA)
      const fornMap = new Map();
      ['fa_fornecedores', 'fa_fornecedores_cache', 'fraser_fornecedores'].forEach(key => {
        try {
          const arr = JSON.parse(localStorage.getItem(key) || '[]');
          arr.forEach(f => { if (f.id && !fornMap.has(f.id)) fornMap.set(f.id, f); });
        } catch(e) {}
      });
      // Inclui também fornecedores do FA_FORNECEDORES global (se disponível)
      if (typeof FA_FORNECEDORES !== 'undefined' && Array.isArray(FA_FORNECEDORES)) {
        FA_FORNECEDORES.forEach(f => { if (f.id && !fornMap.has(f.id)) fornMap.set(f.id, f); });
      }
      const forns = [...fornMap.values()];
      forns.forEach(forn => {
        const texto = [forn.razao_social, forn.nome_fantasia, forn.cnpj, forn.categoria,
          forn.cidade, forn.estado, forn.email, forn.contato, forn.telefone,
          forn.segmento, forn.obs].filter(Boolean).join(' ');
        const rel = relevancia(texto, q);
        if (rel > 0) {
          const scoreIdf = forn.idf_score || forn.score_idf || forn.idf || null;
          resultados.push({
            tipo: 'fornecedor', icone: 'fa-building', cor: '#d97706', label: 'Fornecedor',
            id: forn.id, numero: forn.cnpj ? forn.cnpj.substring(0,14) : forn.id,
            titulo: forn.razao_social || forn.nome_fantasia || 'Fornecedor',
            subtitulo: [forn.categoria || forn.segmento,
              forn.cidade && forn.estado ? `${forn.cidade}/${forn.estado}` : forn.cidade || forn.estado,
              forn.status].filter(Boolean).join(' · '),
            status: forn.status || 'Ativo', data: forn.created_at,
            rel, acao: () => navigate('fornecedores'),
            badge: forn.status || 'Ativo',
            badgeCor: forn.status === 'Ativo' ? '#16a34a' : forn.status === 'Bloqueado' ? '#dc2626' : '#f59e0b',
            extra: scoreIdf ? `IDF: ${scoreIdf}` : null,
          });
        }
      });
    } catch(e) {}
  }

  // ── Contratos ──
  if (filtrarTipo('contrato')) {
    try {
      // Busca contratos do localStorage e do ERP_DATA (dados seeded)
      const contMap = new Map();
      ['fa_contratos', 'fraser_contratos'].forEach(key => {
        try {
          const arr = JSON.parse(localStorage.getItem(key) || '[]');
          arr.forEach(c => { if (c.id && !contMap.has(c.id)) contMap.set(c.id, c); });
        } catch(e) {}
      });
      // Inclui contratos do ERP_DATA global
      if (typeof ERP_DATA !== 'undefined' && Array.isArray(ERP_DATA.contratos)) {
        ERP_DATA.contratos.forEach(c => { if (c.id && !contMap.has(c.id)) contMap.set(c.id, c); });
      }
      const contratos = [...contMap.values()];
      contratos.forEach(c => {
        const texto = [c.id, c.numero, c.nome, c.objeto, c.descricao, c.cliente,
          c.tipo, c.responsavel || c.gestor, c.unidade].filter(Boolean).join(' ');
        const rel = relevancia(texto, q);
        if (rel > 0 && filtrarPeriodo(c.data_inicio || c.inicio || c.created_at)) {
          const valor = c.valor || c.valor_total || 0;
          resultados.push({
            tipo: 'contrato', icone: 'fa-file-contract', cor: '#dc2626', label: 'Contrato',
            id: c.id, numero: c.id || c.numero || `CONT-${c.id}`,
            titulo: c.objeto || c.descricao || c.nome || c.cliente || 'Contrato',
            subtitulo: [c.tipo, c.cliente, c.gestor || c.responsavel,
              valor > 0 ? `R$ ${Number(valor).toLocaleString('pt-BR',{minimumFractionDigits:2})}` : ''].filter(Boolean).join(' · '),
            status: c.status || 'Ativo', data: c.data_inicio || c.inicio || c.created_at,
            rel, acao: () => navigate('contratos'),
            badge: c.status || 'Ativo', badgeCor: '#dc2626',
          });
        }
      });
    } catch(e) {}
  }

  // ── Medições ──
  if (filtrarTipo('medicao')) {
    try {
      const medMap = new Map();
      ['fa_medicoes', 'fraser_medicoes'].forEach(key => {
        try {
          const arr = JSON.parse(localStorage.getItem(key) || '[]');
          arr.forEach(m => { if (m.id && !medMap.has(m.id)) medMap.set(m.id, m); });
        } catch(e) {}
      });
      // Inclui medições do ERP_DATA global
      if (typeof ERP_DATA !== 'undefined' && Array.isArray(ERP_DATA.medicoes)) {
        ERP_DATA.medicoes.forEach(m => { if (m.id && !medMap.has(m.id)) medMap.set(m.id, m); });
      }
      const medicoes = [...medMap.values()];
      medicoes.forEach(m => {
        const texto = [m.id, m.numero, m.contrato, m.projeto, m.responsavel,
          m.periodo || m.referencia, m.status].filter(Boolean).join(' ');
        const rel = relevancia(texto, q);
        if (rel > 0 && filtrarPeriodo(m.data || m.dataEnvio || m.created_at)) {
          const valor = m.valor_total || m.valor || m.bruto || m.liquido || 0;
          resultados.push({
            tipo: 'medicao', icone: 'fa-ruler-combined', cor: '#6d28d9', label: 'Medição',
            id: m.id, numero: m.id || m.numero || `MED-?`,
            titulo: `Medição – ${m.contrato || m.projeto || m.id}`,
            subtitulo: [m.periodo || m.referencia,
              valor > 0 ? `R$ ${Number(valor).toLocaleString('pt-BR',{minimumFractionDigits:2})}` : '',
              m.responsavel].filter(Boolean).join(' · '),
            status: m.status || 'Pendente', data: m.data || m.dataEnvio || m.created_at,
            rel, acao: () => navigate('medicao'),
            badge: m.status || 'Pendente', badgeCor: '#6d28d9',
          });
        }
      });
    } catch(e) {}
  }

  // ── Equipe ──
  if (filtrarTipo('equipe')) {
    try {
      // Busca colaboradores de múltiplas fontes
      const equipeMap = new Map();
      ['fa_equipe', 'fraser_equipe'].forEach(key => {
        try {
          const arr = JSON.parse(localStorage.getItem(key) || '[]');
          arr.forEach(p => { if (p.id && !equipeMap.has(p.id)) equipeMap.set(p.id, p); });
        } catch(e) {}
      });
      // Inclui colaboradores do ERP_DATA global
      if (typeof ERP_DATA !== 'undefined' && Array.isArray(ERP_DATA.colaboradores)) {
        ERP_DATA.colaboradores.forEach(p => { if (p.id && !equipeMap.has(p.id)) equipeMap.set(p.id, p); });
      }
      const equipe = [...equipeMap.values()];
      equipe.forEach(p => {
        const texto = [p.nome, p.cargo, p.departamento, p.email, p.cpf, p.matricula,
          p.contrato, p.id].filter(Boolean).join(' ');
        const rel = relevancia(texto, q);
        if (rel > 0) {
          resultados.push({
            tipo: 'equipe', icone: 'fa-user-hard-hat', cor: '#0284c7', label: 'Equipe',
            id: p.id, numero: p.matricula || p.id || `COL-?`,
            titulo: p.nome || 'Colaborador',
            subtitulo: [p.cargo, p.departamento || p.contrato].filter(Boolean).join(' · '),
            status: p.status || 'Ativo', data: p.data_admissao || p.admissao,
            rel, acao: () => navigate('equipe'),
            badge: p.status || 'Ativo', badgeCor: '#0284c7',
          });
        }
      });
    } catch(e) {}
  }

  // ── Frota / Equipamentos ──
  if (filtrarTipo('frota')) {
    try {
      const frotaMap = new Map();
      ['fa_equipamentos', 'fraser_frota'].forEach(key => {
        try {
          const arr = JSON.parse(localStorage.getItem(key) || '[]');
          arr.forEach(f => { if (f.id && !frotaMap.has(f.id)) frotaMap.set(f.id, f); });
        } catch(e) {}
      });
      // Inclui equipamentos do ERP_DATA global
      if (typeof ERP_DATA !== 'undefined' && Array.isArray(ERP_DATA.equipamentos)) {
        ERP_DATA.equipamentos.forEach(f => { if (f.id && !frotaMap.has(f.id)) frotaMap.set(f.id, f); });
      }
      const frota = [...frotaMap.values()];
      frota.forEach(f => {
        const texto = [f.nome || f.descricao, f.modelo, f.placa, f.tipo, f.patrimonio,
          f.codigo, f.marca, f.contrato, f.id].filter(Boolean).join(' ');
        const rel = relevancia(texto, q);
        if (rel > 0) {
          resultados.push({
            tipo: 'frota', icone: 'fa-truck', cor: '#374151', label: 'Frota',
            id: f.id, numero: f.placa || f.codigo || f.patrimonio || f.id,
            titulo: f.modelo ? `${f.tipo || 'Equipamento'} – ${f.modelo}` : f.descricao || f.nome || 'Equipamento',
            subtitulo: [f.marca, f.tipo, f.contrato, f.status].filter(Boolean).join(' · '),
            status: f.status || 'Operacional', data: f.data_aquis || f.ultimaManut,
            rel, acao: () => navigate('frota'),
            badge: f.status || 'Operacional', badgeCor: '#374151',
          });
        }
      });
    } catch(e) {}
  }



  // Ordenar por relevância
  _bgResultados = resultados.sort((a, b) => b.rel - a.rel || new Date(b.data||0) - new Date(a.data||0));

  // Atualiza barra de status com contagem real
  const sb = document.getElementById('bg_status_bar');
  if (sb) {
    if (_bgResultados.length === 0) {
      sb.innerHTML = `<span style="color:var(--text-secondary)">Pesquisando:</span> <strong style="color:var(--orange);font-size:15px">"${_bgQuery}"</strong> <span style="background:rgba(220,38,38,.12);color:#ef4444;font-size:12px;font-weight:700;padding:3px 12px;border-radius:12px;border:1px solid rgba(220,38,38,.25)"><i class="fas fa-times-circle" style="margin-right:4px"></i>Nenhum resultado</span>`;
    } else {
      sb.innerHTML = `<span style="color:var(--text-secondary)">Pesquisando:</span> <strong style="color:var(--orange);font-size:15px">"${_bgQuery}"</strong> <span style="background:rgba(249,115,22,.15);color:var(--orange);font-size:12px;font-weight:700;padding:3px 12px;border-radius:12px;border:1px solid rgba(249,115,22,.3)"><i class="fas fa-check-circle" style="margin-right:4px"></i>${_bgResultados.length} resultado${_bgResultados.length!==1?'s':''}</span>`;
    }
  }

  const el = document.getElementById('bg_results_area');
  if (el) {
    el.style.opacity = '0';
    setTimeout(() => {
      el.innerHTML = _bgRenderResultados();
      el.style.transition = 'opacity .2s';
      el.style.opacity = '1';
    }, 60);
  }
}

// ─── HELPERS DE TIPO ─────────────────────────────────────────────────
function _bgCorTipo(tipo) {
  const cores = { os:'#2563eb', rc:'#7c3aed', rfq:'#0891b2', pedido:'#16a34a', recebimento:'#ca8a04', fornecedor:'#d97706', contrato:'#dc2626', medicao:'#6d28d9', equipe:'#0284c7', frota:'#374151' };
  return cores[tipo] || '#4f46e5';
}
function _bgIconeTipo(tipo) {
  const icones = { os:'fa-clipboard-list', rc:'fa-file-alt', rfq:'fa-envelope-open-text', pedido:'fa-shopping-bag', recebimento:'fa-dolly', fornecedor:'fa-building', contrato:'fa-file-contract', medicao:'fa-ruler-combined', equipe:'fa-user-hard-hat', frota:'fa-truck' };
  return icones[tipo] || 'fa-circle';
}
function _bgLabelTipo(tipo) {
  const labels = { os:'OS', rc:'RC', rfq:'RFQ', pedido:'Pedidos', recebimento:'Recebimento', fornecedor:'Fornecedores', contrato:'Contratos', medicao:'Medições', equipe:'Equipe', frota:'Frota' };
  return labels[tipo] || tipo;
}
function _bgFormatData(dataStr) {
  if (!dataStr) return '';
  const d = new Date(dataStr);
  if (isNaN(d.getTime())) return dataStr;
  return d.toLocaleDateString('pt-BR', { day:'2-digit', month:'short', year:'numeric' });
}

// ─── RENDER DE RESULTADOS ─────────────────────────────────────────────
function _bgRenderResultados() {
  const total = _bgResultados.length;
  if (!_bgQuery && total === 0) return _bgRenderSugestoes();

  if (_bgQuery && total === 0) {
    return `
      <div style="text-align:center;padding:60px 20px;color:var(--text-muted)">
        <div style="font-size:56px;margin-bottom:16px">🔍</div>
        <div style="font-size:17px;font-weight:700;color:var(--text-primary);margin-bottom:8px">Nenhum resultado para "<em style="color:var(--primary)">${_bgQuery}</em>"</div>
        <div style="font-size:13px;margin-bottom:20px">Tente outros termos, verifique a ortografia ou use filtros diferentes</div>
        <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
          ${['OS-001','RC-001','CONT-001','Fraser'].map(s=>`
            <button onclick="document.getElementById('bg_search_input').value='${s}';_bgBuscar('${s}')" 
              style="padding:7px 18px;border-radius:20px;border:1.5px solid var(--border-color);background:transparent;color:var(--text-secondary);font-size:13px;cursor:pointer;transition:all .18s">
              Tentar "${s}"
            </button>
          `).join('')}
        </div>
      </div>`;
  }

  // Contagem por tipo
  const counts = {};
  _bgResultados.forEach(r => { counts[r.tipo] = (counts[r.tipo]||0) + 1; });

  // Verifica se há apenas 1 resultado do tipo OS ou Pedido (para mostrar rastreio de fluxo)
  const osResults = _bgResultados.filter(r => r.tipo === 'os');
  const showFluxoBtn = osResults.length === 1;

  const header = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px">
      <div>
        <span style="font-size:16px;font-weight:700;color:var(--text-primary)">${total} resultado${total !== 1 ? 's' : ''}</span>
        <span style="font-size:13px;color:var(--text-muted);margin-left:8px">para "<em style="color:var(--primary)">${_bgQuery}</em>"</span>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${Object.entries(counts).map(([tipo,cnt]) => `
          <span style="font-size:11px;background:${_bgCorTipo(tipo)}18;color:${_bgCorTipo(tipo)};border:1px solid ${_bgCorTipo(tipo)}40;padding:3px 10px;border-radius:12px;font-weight:700;cursor:pointer" onclick="_bgSetFiltro('tipo','${tipo}')">
            <i class="fas ${_bgIconeTipo(tipo)}" style="margin-right:3px"></i>${_bgLabelTipo(tipo)}: ${cnt}
          </span>
        `).join('')}
        ${showFluxoBtn ? `
          <button onclick="_bgMostrarFluxoCompleto('${osResults[0].id}')" style="font-size:11px;background:#2563eb;color:#fff;border:none;padding:3px 12px;border-radius:12px;cursor:pointer;font-weight:600">
            <i class="fas fa-project-diagram" style="margin-right:4px"></i>Ver Fluxo Completo
          </button>
        ` : ''}
        <button onclick="_bgToggleTimeline()" style="font-size:11px;background:var(--bg-tertiary);color:var(--text-secondary);border:1px solid var(--border-color);padding:3px 12px;border-radius:12px;cursor:pointer;font-weight:600">
          <i class="fas fa-stream" style="margin-right:4px"></i>${_bgTimelineMode ? 'Cards' : 'Timeline'}
        </button>
      </div>
    </div>`;

  if (_bgTimelineMode) {
    return header + _bgRenderTimeline();
  }

  // Agrupa por tipo
  if (_bgFiltros.tipo === 'todos') {
    const grupos = {};
    _bgResultados.forEach(r => {
      if (!grupos[r.tipo]) grupos[r.tipo] = [];
      grupos[r.tipo].push(r);
    });

    return header + Object.entries(grupos).map(([tipo, items]) => `
      <div style="margin-bottom:24px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
          <div style="width:32px;height:32px;border-radius:8px;background:${_bgCorTipo(tipo)}18;display:flex;align-items:center;justify-content:center">
            <i class="fas ${_bgIconeTipo(tipo)}" style="color:${_bgCorTipo(tipo)};font-size:14px"></i>
          </div>
          <span style="font-size:14px;font-weight:700;color:var(--text-primary)">${_bgLabelTipo(tipo)}</span>
          <span style="font-size:11px;background:${_bgCorTipo(tipo)}18;color:${_bgCorTipo(tipo)};padding:2px 8px;border-radius:10px;font-weight:700">${items.length}</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:10px">
          ${items.map(r => _bgRenderCard(r)).join('')}
        </div>
      </div>
    `).join('');
  }

  return header + `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:10px">
      ${_bgResultados.map(r => _bgRenderCard(r)).join('')}
    </div>`;
}

// ─── CARD DE RESULTADO ────────────────────────────────────────────────
function _bgRenderCard(r) {
  const cor = r.cor || '#4f46e5';
  const fluxoHtml = (r.fluxoMini && r.fluxoMini.length > 0) ? `
    <div style="display:flex;align-items:center;gap:4px;margin-top:6px;flex-wrap:wrap">
      <span style="font-size:10px;color:var(--text-muted);font-weight:600">Fluxo:</span>
      ${r.fluxoMini.map((f,i) => `
        ${i > 0 ? '<i class="fas fa-arrow-right" style="font-size:8px;color:var(--text-muted)"></i>' : ''}
        <span style="font-size:10px;font-weight:700;padding:1px 6px;border-radius:6px;background:${f.cor}18;color:${f.cor};border:1px solid ${f.cor}30">
          ${f.label}${f.cnt > 1 ? ` (${f.cnt})` : ''}
        </span>
      `).join('')}
    </div>` : '';

  return `
    <div onclick="${r.acao ? r.acao.toString().replace('() => ', '').replace('()=>','') : 'void 0'}"
      style="background:var(--bg-card);border-radius:12px;border:1.5px solid var(--border-color);padding:14px 16px;cursor:pointer;transition:all .2s;position:relative;overflow:hidden"
      onmouseover="this.style.borderColor='${cor}';this.style.transform='translateY(-2px)';this.style.boxShadow='0 6px 20px rgba(0,0,0,0.12)'"
      onmouseout="this.style.borderColor='var(--border-color)';this.style.transform='none';this.style.boxShadow='none'">
      <div style="position:absolute;left:0;top:0;bottom:0;width:3px;background:${cor};border-radius:12px 0 0 12px"></div>
      <div style="display:flex;align-items:flex-start;gap:10px;padding-left:6px">
        <div style="width:36px;height:36px;border-radius:9px;background:${cor}18;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px">
          <i class="fas ${r.icone}" style="color:${cor};font-size:15px"></i>
        </div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;flex-wrap:wrap">
            <span style="font-size:10px;font-weight:800;color:${cor};text-transform:uppercase;letter-spacing:.5px;background:${cor}18;padding:2px 7px;border-radius:8px">${r.label || r.tipo.toUpperCase()}</span>
            <span style="font-size:12px;font-weight:700;color:var(--text-muted)">${r.numero}</span>
            ${r.badge ? `<span style="font-size:10px;font-weight:700;color:${r.badgeCor||cor};background:${(r.badgeCor||cor)}15;padding:2px 7px;border-radius:8px;border:1px solid ${(r.badgeCor||cor)}30">${r.badge}</span>` : ''}
          </div>
          <div style="font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${r.titulo}">${r.titulo}</div>
          ${r.subtitulo ? `<div style="font-size:12px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.subtitulo}</div>` : ''}
          ${r.extra ? `<div style="font-size:11px;font-weight:700;color:${cor};margin-top:4px">${r.extra}</div>` : ''}
          ${fluxoHtml}
          ${r.data ? `<div style="font-size:11px;color:var(--text-muted);margin-top:5px"><i class="fas fa-calendar-alt" style="margin-right:4px"></i>${_bgFormatData(r.data)}</div>` : ''}
        </div>
        <i class="fas fa-chevron-right" style="color:var(--text-muted);font-size:12px;margin-top:4px;flex-shrink:0"></i>
      </div>
    </div>`;
}

// ─── MODO TIMELINE ────────────────────────────────────────────────────
function _bgRenderTimeline() {
  if (_bgResultados.length === 0) return '<div style="text-align:center;padding:40px;color:var(--text-muted)">Nenhum resultado para exibir na timeline</div>';

  const comData = _bgResultados.filter(r => r.data).sort((a,b) => new Date(b.data) - new Date(a.data));
  const semData = _bgResultados.filter(r => !r.data);

  if (comData.length === 0) {
    return `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:10px">${semData.map(_bgRenderCard).join('')}</div>`;
  }

  // Agrupa por mês/ano
  const grupos = {};
  comData.forEach(r => {
    const d = new Date(r.data);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const label = d.toLocaleDateString('pt-BR', { month:'long', year:'numeric' });
    if (!grupos[key]) grupos[key] = { label, items: [] };
    grupos[key].items.push(r);
  });

  return `
    <div style="position:relative">
      <div style="position:absolute;left:19px;top:0;bottom:0;width:2px;background:var(--border-color)"></div>
      ${Object.entries(grupos).map(([key, g]) => `
        <div style="margin-bottom:28px">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;position:relative">
            <div style="width:40px;height:40px;border-radius:50%;background:var(--primary);display:flex;align-items:center;justify-content:center;flex-shrink:0;z-index:1;box-shadow:0 0 0 4px var(--bg-main)">
              <i class="fas fa-calendar-alt" style="color:#fff;font-size:14px"></i>
            </div>
            <div style="font-size:14px;font-weight:800;color:var(--text-primary);text-transform:capitalize">${g.label}</div>
            <span style="font-size:11px;color:var(--text-muted);background:var(--bg-tertiary);border:1px solid var(--border-color);padding:2px 8px;border-radius:10px">${g.items.length} registro${g.items.length!==1?'s':''}</span>
          </div>
          <div style="margin-left:52px;display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:8px">
            ${g.items.map(r => _bgRenderCard(r)).join('')}
          </div>
        </div>
      `).join('')}
      ${semData.length > 0 ? `
        <div style="margin-left:52px;margin-top:8px">
          <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">Sem data registrada (${semData.length})</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:8px">
            ${semData.map(_bgRenderCard).join('')}
          </div>
        </div>
      ` : ''}
    </div>`;
}

// ─── FLUXO COMPLETO DE UM PROCESSO ───────────────────────────────────
function _bgMostrarFluxoCompleto(osId) {
  const fluxo = _bgRastrearFluxo(osId, 'os');
  const osMap = _bgColetarOS();
  const os = osMap.get(osId);

  if (!os) { showToast && showToast('OS não encontrada.', 'warning'); return; }

  const etapaCores = {
    'OS':             '#2563eb',
    'RC':             '#7c3aed',
    'RFQ':            '#0891b2',
    'Pedido':         '#16a34a',
    'Recebimento':    '#ca8a04',
    'Almoxarifado':   '#16a34a',
  };
  const etapaIcones = {
    'OS':             'fa-clipboard-list',
    'RC':             'fa-file-alt',
    'RFQ':            'fa-envelope-open-text',
    'Pedido':         'fa-shopping-bag',
    'Recebimento':    'fa-dolly',
    'Almoxarifado':   'fa-warehouse',
  };

  const etapasEsperadas = ['OS','RC','RFQ','Pedido','Recebimento','Almoxarifado'];
  const etapasPresentes = new Set(fluxo.map(f => f.etapa));

  const fluxoHtml = fluxo.length === 0 ? `
    <div style="text-align:center;padding:30px;color:var(--text-muted)">
      <i class="fas fa-info-circle" style="font-size:32px;margin-bottom:12px;display:block;color:#2563eb"></i>
      <div style="font-size:14px;font-weight:600">OS encontrada, mas sem RCs/Pedidos vinculados</div>
      <div style="font-size:12px;margin-top:6px">Esta OS não gerou compras ainda ou os dados não estão sincronizados.</div>
    </div>
  ` : fluxo.map((f, i) => {
    const cor = etapaCores[f.etapa] || '#4f46e5';
    const icone = etapaIcones[f.etapa] || 'fa-circle';
    const statusCor = f.status === 'Concluída' || f.status === 'Conforme' || f.status === 'Entrada Confirmada' ? '#16a34a'
      : f.status === 'Em Andamento' || f.status === 'Emitido' ? '#2563eb'
      : f.status === 'Aguardando' || f.status === 'Recebimento Físico' ? '#ca8a04'
      : '#6b7280';
    return `
      <div style="display:flex;align-items:flex-start;gap:0;position:relative">
        <!-- Linha vertical -->
        ${i < fluxo.length - 1 ? `<div style="position:absolute;left:19px;top:40px;width:2px;height:calc(100% - 10px);background:linear-gradient(${cor},${etapaCores[fluxo[i+1]?.etapa]||cor});z-index:0"></div>` : ''}
        <!-- Ícone -->
        <div style="width:40px;height:40px;border-radius:50%;background:${cor};display:flex;align-items:center;justify-content:center;flex-shrink:0;z-index:1;box-shadow:0 0 0 4px var(--bg-main);margin-top:4px">
          <i class="fas ${icone}" style="color:#fff;font-size:15px"></i>
        </div>
        <!-- Conteúdo -->
        <div style="flex:1;margin-left:14px;margin-bottom:20px;background:var(--bg-card);border-radius:10px;border:1px solid var(--border-color);padding:12px 16px">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px">
            <span style="font-size:11px;font-weight:800;color:${cor};text-transform:uppercase;letter-spacing:.5px">${f.etapa}</span>
            <span style="font-size:12px;font-weight:700;color:var(--text-muted)">${f.id}</span>
            <span style="font-size:10px;font-weight:700;color:${statusCor};background:${statusCor}18;padding:2px 7px;border-radius:8px;border:1px solid ${statusCor}30">${f.status || '—'}</span>
            ${f.valor ? `<span style="font-size:11px;font-weight:700;color:#16a34a">R$ ${Number(f.valor).toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>` : ''}
          </div>
          <div style="font-size:13px;color:var(--text-primary);font-weight:500">${f.desc || '—'}</div>
          ${f.data ? `<div style="font-size:11px;color:var(--text-muted);margin-top:4px"><i class="fas fa-calendar-alt" style="margin-right:4px"></i>${_bgFormatData(f.data)}</div>` : ''}
          ${f.etapa_rec ? `<div style="font-size:11px;color:${f.etapa_rec === 'Entrada Almoxarifado' ? '#16a34a' : '#ca8a04'};margin-top:4px;font-weight:600"><i class="fas fa-warehouse" style="margin-right:4px"></i>Etapa: ${f.etapa_rec}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');

  // Etapas faltando (status incompleto)
  const etapasFaltando = etapasEsperadas.filter(e => !etapasPresentes.has(e));
  const faltandoHtml = etapasFaltando.length > 0 && fluxo.length > 0 ? `
    <div style="margin-top:16px;padding:12px 16px;background:rgba(245,158,11,0.08);border:1px solid #ca8a04;border-radius:10px">
      <div style="font-weight:700;font-size:13px;color:#ca8a04;margin-bottom:6px"><i class="fas fa-exclamation-triangle" style="margin-right:6px"></i>Etapas ainda não iniciadas:</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${etapasFaltando.map(e => `
          <span style="font-size:11px;font-weight:700;color:#ca8a04;background:rgba(202,138,4,0.1);padding:3px 10px;border-radius:8px;border:1px solid rgba(202,138,4,0.3)">
            <i class="fas ${etapaIcones[e]||'fa-circle'}" style="margin-right:4px"></i>${e}
          </span>
        `).join('')}
      </div>
    </div>
  ` : '';

  const titulo = `<i class="fas fa-project-diagram" style="color:#2563eb;margin-right:8px"></i>Fluxo Completo – ${os.id}`;
  const corpo = `
    <div style="margin-bottom:16px;padding:12px 16px;background:rgba(37,99,235,0.06);border-radius:10px;border:1px solid rgba(37,99,235,0.2)">
      <div style="font-size:14px;font-weight:700;color:var(--text-primary)">${os.descricao || 'Ordem de Serviço'}</div>
      <div style="font-size:12px;color:var(--text-muted);margin-top:3px">${[os.contrato, os.responsavel, os.status].filter(Boolean).join(' · ')}</div>
    </div>
    <div style="position:relative;padding-left:0">
      ${fluxoHtml}
    </div>
    ${faltandoHtml}
  `;
  const rodape = `<button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
    <button class="btn btn-primary" onclick="closeModal();navigate('os')"><i class="fas fa-clipboard-list"></i> Ir para OS</button>`;

  if (typeof openModalWide === 'function') {
    openModalWide(titulo, corpo, rodape);
  } else if (typeof openModal === 'function') {
    openModal(titulo, corpo, rodape);
  }
}

// ─── TELA DE SUGESTÕES (estado vazio) ────────────────────────────────
function _bgRenderSugestoes() {
  // Carrega contagens reais do localStorage
  const counts = {
    os:          [..._bgColetarOS().values()].length,
    rc:          [..._bgColetarRC().values()].length,
    pedido:      [..._bgColetarPedidos().values()].length,
    recebimento: [..._bgColetarRecebimentos().values()].length,
    fornecedor:  (() => { try {
      const m = new Map();
      ['fa_fornecedores','fa_fornecedores_cache'].forEach(k => { try { JSON.parse(localStorage.getItem(k)||'[]').forEach(f => { if(f.id) m.set(f.id,1); }); } catch(e){} });
      if (typeof FA_FORNECEDORES !== 'undefined') FA_FORNECEDORES.forEach(f => { if(f.id) m.set(f.id,1); });
      return m.size;
    } catch(e) { return 0; } })(),
    contrato:    (() => { try {
      const m = new Map();
      ['fa_contratos'].forEach(k => { try { JSON.parse(localStorage.getItem(k)||'[]').forEach(c => { if(c.id) m.set(c.id,1); }); } catch(e){} });
      if (typeof ERP_DATA !== 'undefined' && Array.isArray(ERP_DATA.contratos)) ERP_DATA.contratos.forEach(c => { if(c.id) m.set(c.id,1); });
      return m.size;
    } catch(e) { return 0; } })(),
    medicao:     (() => { try {
      const m = new Map();
      ['fa_medicoes'].forEach(k => { try { JSON.parse(localStorage.getItem(k)||'[]').forEach(x => { if(x.id) m.set(x.id,1); }); } catch(e){} });
      if (typeof ERP_DATA !== 'undefined' && Array.isArray(ERP_DATA.medicoes)) ERP_DATA.medicoes.forEach(x => { if(x.id) m.set(x.id,1); });
      return m.size;
    } catch(e) { return 0; } })(),
  };

  const modulos = [
    { tipo:'os',          label:'Ordens de Serviço',     icone:'fa-clipboard-list',     cor:'#2563eb',  cnt: counts.os,          nav:'os',              atalhos:['OS-001','OS-002','Em Andamento'] },
    { tipo:'rc',          label:'Requisições de Compra', icone:'fa-file-alt',            cor:'#7c3aed',  cnt: counts.rc,          nav:'requisicoes',     atalhos:['RC-001','Urgente','Aprovada'] },
    { tipo:'pedido',      label:'Pedidos de Compra',     icone:'fa-shopping-bag',        cor:'#16a34a',  cnt: counts.pedido,      nav:'pedidos',         atalhos:['PED-','Pendente','Entregue'] },
    { tipo:'recebimento', label:'Recebimentos',          icone:'fa-dolly',               cor:'#ca8a04',  cnt: counts.recebimento, nav:'recebimento',     atalhos:['NF-','Conforme','Almox'] },
    { tipo:'fornecedor',  label:'Fornecedores',          icone:'fa-building',            cor:'#d97706',  cnt: counts.fornecedor,  nav:'fornecedores',    atalhos:['CNPJ','Ativo','Em Homologação'] },
    { tipo:'contrato',    label:'Contratos',             icone:'fa-file-contract',       cor:'#dc2626',  cnt: counts.contrato,    nav:'contratos',       atalhos:['CONT-001','Ativo','Vencendo'] },
    { tipo:'medicao',     label:'Medições',              icone:'fa-ruler-combined',      cor:'#6d28d9',  cnt: counts.medicao,     nav:'medicao',         atalhos:['MED-','Aprovado','Pendente'] },
  ];

  return `
    <!-- Hero de busca -->
    <div style="text-align:center;padding:40px 20px 32px;background:linear-gradient(135deg,var(--bg-card) 0%,var(--bg-tertiary) 100%);border-radius:16px;border:1px solid var(--border-color);margin-bottom:24px">
      <div style="font-size:52px;margin-bottom:16px">🔍</div>
      <h2 style="font-size:22px;font-weight:800;color:var(--text-primary);margin-bottom:8px">Busca Inteligente Unificada</h2>
      <p style="font-size:14px;color:var(--text-muted);max-width:500px;margin:0 auto 20px">
        Pesquise em todos os módulos do sistema de uma só vez. 
        Use número do documento, CNPJ, nome, status ou qualquer termo relevante.
      </p>
      <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
        ${['OS-001','RC-001','CONT-001','Fraser','Pendente','R$ 50.000'].map(s=>`
          <button onclick="document.getElementById('bg_search_input').value='${s}';_bgBuscar('${s}')" 
            style="padding:7px 18px;border-radius:20px;border:1.5px solid var(--border-color);background:var(--bg-card);color:var(--text-secondary);font-size:12px;cursor:pointer;transition:all .18s;font-weight:600"
            onmouseover="this.style.borderColor='var(--primary)';this.style.color='var(--primary)'"
            onmouseout="this.style.borderColor='var(--border-color)';this.style.color='var(--text-secondary)'">
            "${s}"
          </button>
        `).join('')}
      </div>
    </div>

    <!-- Cards de módulos com contagens reais -->
    <div style="margin-bottom:20px">
      <div style="font-size:13px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:12px">
        <i class="fas fa-th" style="margin-right:6px"></i>Módulos disponíveis para busca
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px">
        ${modulos.map(m => `
          <div style="background:var(--bg-card);border-radius:12px;border:1.5px solid var(--border-color);padding:14px 16px;transition:all .2s;cursor:pointer"
            onclick="_bgSetFiltro('tipo','${m.tipo}')"
            onmouseover="this.style.borderColor='${m.cor}';this.style.transform='translateY(-2px)'"
            onmouseout="this.style.borderColor='var(--border-color)';this.style.transform='none'">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
              <div style="width:36px;height:36px;border-radius:9px;background:${m.cor}18;display:flex;align-items:center;justify-content:center;flex-shrink:0">
                <i class="fas ${m.icone}" style="color:${m.cor};font-size:16px"></i>
              </div>
              <div>
                <div style="font-size:12px;font-weight:700;color:var(--text-primary)">${m.label}</div>
                <div style="font-size:18px;font-weight:900;color:${m.cor};line-height:1">${m.cnt}</div>
              </div>
            </div>
            <div style="display:flex;gap:4px;flex-wrap:wrap">
              ${m.atalhos.slice(0,2).map(a=>`
                <button onclick="event.stopPropagation();document.getElementById('bg_search_input').value='${a}';_bgBuscar('${a}')" 
                  style="font-size:10px;padding:2px 8px;border-radius:10px;border:1px solid ${m.cor}30;background:${m.cor}10;color:${m.cor};cursor:pointer;font-weight:600">
                  ${a}
                </button>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Histórico de buscas -->
    ${_bgHistorico.length > 0 ? `
      <div style="background:var(--bg-card);border-radius:12px;border:1px solid var(--border-color);padding:14px 16px">
        <div style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">
          <i class="fas fa-history" style="margin-right:6px"></i>Buscas recentes
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${_bgHistorico.map(h=>`
            <button onclick="document.getElementById('bg_search_input').value='${h}';_bgBuscar('${h}')"
              style="padding:5px 14px;border-radius:20px;border:1px solid var(--border-color);background:transparent;color:var(--text-secondary);font-size:12px;cursor:pointer;display:flex;align-items:center;gap:6px;font-weight:500;transition:all .18s"
              onmouseover="this.style.background='var(--bg-tertiary)'"
              onmouseout="this.style.background='transparent'">
              <i class="fas fa-history" style="font-size:10px;opacity:.6"></i>${h}
            </button>
          `).join('')}
          <button onclick="_bgHistorico=[];renderBuscaGlobal()" 
            style="padding:5px 12px;border-radius:20px;border:1px solid var(--border-color);background:transparent;color:var(--text-muted);font-size:11px;cursor:pointer">
            Limpar
          </button>
        </div>
      </div>
    ` : ''}

    <!-- Dicas de busca -->
    <div style="margin-top:20px;background:var(--bg-card);border-radius:12px;border:1px solid var(--border-color);padding:16px">
      <div style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">
        <i class="fas fa-lightbulb" style="margin-right:6px;color:#f59e0b"></i>Dicas de busca
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:8px">
        ${[
          { icon:'fa-hashtag', cor:'#2563eb', tip:'Use o número do documento (OS-001, RC-002, CONT-005)' },
          { icon:'fa-id-card', cor:'#d97706', tip:'Pesquise fornecedor por CNPJ (parcial funciona: 12.345)' },
          { icon:'fa-filter',  cor:'#7c3aed', tip:'Use filtros de tipo e período para refinar resultados' },
          { icon:'fa-stream',  cor:'#16a34a', tip:'Ative "Timeline" para ver resultados em ordem cronológica' },
        ].map(t=>`
          <div style="display:flex;gap:8px;align-items:flex-start">
            <i class="fas ${t.icon}" style="color:${t.cor};font-size:12px;margin-top:2px;flex-shrink:0"></i>
            <span style="font-size:12px;color:var(--text-secondary)">${t.tip}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

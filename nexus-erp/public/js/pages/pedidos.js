// =====================================================
// Fraser Alexander – Módulo Pedidos de Compra
// Emissão, Aprovação, Rastreamento, Integração Financeira
// =====================================================

let FA_PEDIDOS = [];

// Scroll suave para seção pelo id
function scrollToSection(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth' });
}

// Helpers de storage para compatibilidade com fluxo_compras.js
function _getPedidos() {
  try {
    const raw = localStorage.getItem('fa_pedidos');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch(e) {}
  return FA_PEDIDOS;
}

function _savePedidos(lista) {
  localStorage.setItem('fa_pedidos', JSON.stringify(lista));
  FA_PEDIDOS = lista;
}

// Normaliza estrutura de itens (unifica formatos desc/descricao, preco/valor_unit, un/unidade)
function _normalizarItens(itens) {
  if (!Array.isArray(itens)) return [];
  return itens.map(i => ({
    desc:  i.desc || i.descricao || i.nome || '—',
    qtd:   Number(i.qtd || i.quantidade || 1),
    un:    i.un || i.unidade || 'Un',
    preco: Number(i.preco || i.valor_unit || i.preco_unit || 0),
    total: Number(i.total || ((i.qtd || 1) * (i.preco || i.valor_unit || 0)))
  }));
}

// Lê e normaliza itens de um pedido (suporta string JSON e array direto)
function _pedidoGetItens(pedido) {
  let itens = [];
  try {
    if (typeof pedido.itens === 'string') itens = JSON.parse(pedido.itens);
    else if (Array.isArray(pedido.itens)) itens = pedido.itens;
  } catch(e) {}
  return _normalizarItens(itens);
}

// Badge de tipo de pedido (Material, Serviço, Equipamento, etc.)
function _pcTipoBadge(tipo) {
  if (!tipo) return '<span style="font-size:10px;color:var(--text-muted)">—</span>';
  const cores = {
    'Material':      { bg: 'rgba(59,130,246,0.12)',  cor: '#3b82f6', icon: 'fa-boxes' },
    'Serviço':       { bg: 'rgba(0,180,184,0.12)',   cor: 'var(--fa-teal)', icon: 'fa-tools' },
    'Equipamento':   { bg: 'rgba(139,92,246,0.12)',  cor: '#8b5cf6', icon: 'fa-industry' },
    'EPI/Segurança': { bg: 'rgba(245,158,11,0.12)',  cor: '#f59e0b', icon: 'fa-hard-hat' },
    'Combustível':   { bg: 'rgba(239,68,68,0.12)',   cor: '#ef4444', icon: 'fa-gas-pump' },
    'TI/Software':   { bg: 'rgba(6,182,212,0.12)',   cor: '#06b6d4', icon: 'fa-laptop-code' },
    'Outro':         { bg: 'rgba(156,163,175,0.15)', cor: '#6b7280', icon: 'fa-ellipsis-h' }
  };
  const c = cores[tipo] || { bg: 'rgba(156,163,175,0.15)', cor: '#6b7280', icon: 'fa-tag' };
  return `<span style="background:${c.bg};color:${c.cor};padding:3px 8px;border-radius:8px;font-size:10px;font-weight:700;white-space:nowrap">
    <i class="fas ${c.icon}" style="margin-right:3px"></i>${tipo}
  </span>`;
}

async function loadPedidos() {
  try {
    const res = await fetch('/api/pedidos');
    if (res.ok) {
      const data = await res.json();
      // API retorna { success: true, data: [...] } ou { ok: true, data: [...] } ou array direto
      const lista = data.data || (Array.isArray(data) ? data : []);
      if (lista.length > 0) {
        // Normaliza campos para compatibilidade com a UI
        const normalizados = lista.map(p => ({
          ...p,
          fornecedor_nome: p.fornecedor_nome || p.fornecedor || '—',
          tipo_pedido:     p.tipo_pedido || p.tipo || '',
          rfq_numero:      p.rfq_numero || p.rfq_id || '',
          matriz_id:       p.matriz_id || p.mapa_id || '',
          cond_pagamento:  p.cond_pagamento || p.condicao_pagamento || '—',
          data_entrega_prev: p.data_entrega_prev || p.prazo_entrega || '',
          data_entrega_real: p.data_entrega_real || p.data_entrega || '',
          descricao:       p.descricao || p.rfq_numero || '—',
          // Mantém itens como array (a API já retorna array, não string JSON)
          itens: Array.isArray(p.itens) ? JSON.stringify(p.itens) : (p.itens || '[]')
        }));
        FA_PEDIDOS = normalizados;
        console.info('[Pedidos] ' + FA_PEDIDOS.length + ' pedido(s) carregado(s) do D1.');
      }
    }
  } catch(e) { /* mantém FA_PEDIDOS com dados anteriores em memória */ }
}

function renderPedidos() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `<div class="empty-state"><i class="fas fa-spinner fa-spin" style="color:var(--fa-teal)"></i><p>Carregando pedidos...</p></div>`;
  loadPedidos().then(() => {
    // Mescla pedidos do localStorage com os da API (sem duplicatas)
    try {
      const raw = localStorage.getItem('fa_pedidos');
      if (raw) {
        const local = JSON.parse(raw);
        const existingIds = new Set(FA_PEDIDOS.map(p => p.id));
        local.forEach(p => {
          if (p.id && !existingIds.has(p.id)) {
            FA_PEDIDOS.unshift(p);
            existingIds.add(p.id);
          }
        });
      }
    } catch(e) {}
    _renderPedidosUI();
  });
}

function _renderPedidosUI() {
  const main = document.getElementById('mainContent');

  // ── Mescla pedidos do localStorage com array em memória ──────────────────
  try {
    const raw = localStorage.getItem('fa_pedidos');
    if (raw) {
      const local = JSON.parse(raw);
      const existingIds = new Set(FA_PEDIDOS.map(p => p.id));
      local.forEach(p => { if (p.id && !existingIds.has(p.id)) { FA_PEDIDOS.unshift(p); existingIds.add(p.id); } });
    }
  } catch(e) {}

  // ── Busca mapas aprovados sem PC emitido ───────────────────────────────────
  let mapasAprovadosSemPC = [];
  try {
    // Mescla fa_matrizes + fa_mapas_comp sem duplicatas
    const matrizesMap = new Map();
    ['fa_matrizes', 'fa_mapas_comp', 'fa_mapas_comparativos'].forEach(key => {
      try { (JSON.parse(localStorage.getItem(key) || '[]')).forEach(m => { if (m.id && !matrizesMap.has(m.id)) matrizesMap.set(m.id, m); }); } catch(e) {}
    });
    const matrizes = [...matrizesMap.values()];
    // Mescla fa_rfqs + fa_rfq_flow sem duplicatas
    const rfqsSet  = new Map();
    [localStorage.getItem('fa_rfqs'), localStorage.getItem('fa_rfq_flow')].forEach(raw => {
      try { (JSON.parse(raw || '[]')).forEach(r => { if (!rfqsSet.has(r.id)) rfqsSet.set(r.id, r); }); } catch(e) {}
    });
    const rfqsAll  = [...rfqsSet.values()];
    const pcRfqIds = new Set(FA_PEDIDOS.map(p => p.rfq_id).filter(Boolean));
    const pcMatIds = new Set(FA_PEDIDOS.map(p => p.matriz_id).filter(Boolean));
    // Normaliza: inclui tanto 'Aprovada' (novo) quanto 'Aprovado' (legado)
    const _isAprovada = m => m.status === 'Aprovada' || m.status === 'Aprovado';
    // Inclui também pedidos com campo legado 'mapa_id' como referência
    const pcMapaIds = new Set(FA_PEDIDOS.map(p => p.mapa_id).filter(Boolean));
    mapasAprovadosSemPC = matrizes
      .filter(m =>
        _isAprovada(m) &&
        !m.pc_emitido &&                  // flag setada após emissão
        !pcRfqIds.has(m.rfq_id) &&
        !pcMatIds.has(m.id) &&
        !pcMapaIds.has(m.id)
      )
      .map(m => {
        const rfq = rfqsAll.find(r => r.id === m.rfq_id) || {};
        return { ...m, _rfq: rfq };
      });
  } catch(e) {}

  const aguardando = FA_PEDIDOS.filter(p => p.status === 'Aguardando Aprovação').length;
  const emitidos   = FA_PEDIDOS.filter(p => p.status === 'Emitido').length;
  const aprovados  = FA_PEDIDOS.filter(p => p.status === 'Aprovado').length;
  const entregues  = FA_PEDIDOS.filter(p => ['Entregue Total','Entregue Parcial','Pago'].includes(p.status)).length;
  const anoMes     = new Date().toISOString().slice(0, 7);
  const totalMes   = FA_PEDIDOS.filter(p => p.data_emissao && p.data_emissao.startsWith(anoMes)).reduce((a,b) => a+(b.valor_total||0), 0);
  const totalGeral = FA_PEDIDOS.reduce((a,b) => a+(b.valor_total||0), 0);

  main.innerHTML = `
    <div class="page-header">
      <div class="page-title">
        <h2><i class="fas fa-shopping-cart" style="color:var(--fa-teal);margin-right:8px"></i>Pedidos de Compra</h2>
        <p>${FA_PEDIDOS.length} pedido(s) total · ${emitidos} emitido(s) · ${entregues} entregue(s)</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary btn-sm" onclick="exportPedidos()"><i class="fas fa-download"></i> Exportar</button>
        <button class="btn btn-primary btn-sm" onclick="openNovoPedido()"><i class="fas fa-plus"></i> Novo Pedido</button>
      </div>
    </div>

    <!-- KPIs -->
    <div class="kpi-grid" style="grid-template-columns:repeat(6,1fr);margin-bottom:20px">
      <div class="kpi-card kpi-blue" style="cursor:pointer" onclick="document.getElementById('secTodosPedidos').scrollIntoView({behavior:'smooth'})">
        <div class="kpi-icon"><i class="fas fa-shopping-cart"></i></div>
        <div class="kpi-value">${FA_PEDIDOS.length}</div>
        <div class="kpi-label">Total Pedidos</div>
      </div>
      <div class="kpi-card ${mapasAprovadosSemPC.length > 0 ? 'kpi-orange' : 'kpi-green'}" style="cursor:${mapasAprovadosSemPC.length>0?'pointer':'default'}" onclick="${mapasAprovadosSemPC.length>0 ? 'scrollToSection(\"secMapasAprovados\")' : ''}">
        <div class="kpi-icon"><i class="fas fa-balance-scale"></i></div>
        <div class="kpi-value">${mapasAprovadosSemPC.length}</div>
        <div class="kpi-label">Mapas p/ Emitir PC</div>
      </div>
      <div class="kpi-card ${aguardando > 0 ? 'kpi-yellow' : 'kpi-green'}" style="cursor:${aguardando>0?'pointer':'default'}" onclick="${aguardando>0 ? 'scrollToSection(\"secAguardandoAprov\")' : ''}">
        <div class="kpi-icon"><i class="fas fa-clock"></i></div>
        <div class="kpi-value">${aguardando}</div>
        <div class="kpi-label">Aguard. Aprovação</div>
      </div>
      <div class="kpi-card kpi-teal">
        <div class="kpi-icon"><i class="fas fa-paper-plane"></i></div>
        <div class="kpi-value">${emitidos}</div>
        <div class="kpi-label">Emitidos</div>
      </div>
      <div class="kpi-card kpi-purple">
        <div class="kpi-icon"><i class="fas fa-calendar-alt"></i></div>
        <div class="kpi-value">${fmtK(totalMes)}</div>
        <div class="kpi-label">Valor ${new Date().toLocaleDateString('pt-BR',{month:'short',year:'2-digit'})}</div>
      </div>
      <div class="kpi-card kpi-green">
        <div class="kpi-icon"><i class="fas fa-dollar-sign"></i></div>
        <div class="kpi-value">${fmtK(totalGeral)}</div>
        <div class="kpi-label">Total Histórico</div>
      </div>
    </div>

    <!-- ═══ PAINEL DO APROVADOR (visível para admin/diretor/operacao) ══════ -->
    ${['admin','diretor','operacao'].includes(currentUser?.profile) ? `
    <div class="card" style="margin-bottom:16px;border-left:4px solid #6366f1">
      <div class="card-header" style="background:rgba(99,102,241,0.05)">
        <h3 style="margin:0;color:#6366f1">
          <i class="fas fa-user-shield" style="margin-right:8px"></i>Painel do Aprovador
        </h3>
        <button class="btn btn-sm btn-secondary" onclick="_togglePainelAprovador()" id="btn-painel-aprov" style="font-size:11px">
          <i class="fas fa-eye"></i> Ver Histórico
        </button>
      </div>
      <div id="painel-aprovador-body" style="display:none;padding:12px 16px">
        <!-- KPIs do aprovador -->
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px">
          <div style="background:var(--bg-secondary);border-radius:10px;padding:12px;text-align:center;border:1px solid var(--border-color)">
            <div style="font-size:22px;font-weight:800;color:#6366f1">${FA_PEDIDOS.filter(p=>p.status==='Aguardando Aprovação').length}</div>
            <div style="font-size:11px;color:var(--text-muted)">Aguardando minha aprovação</div>
          </div>
          <div style="background:var(--bg-secondary);border-radius:10px;padding:12px;text-align:center;border:1px solid var(--border-color)">
            <div style="font-size:22px;font-weight:800;color:#16a34a">${FA_PEDIDOS.filter(p=>p.status==='Aprovado' && p.aprovador === currentUser?.name).length}</div>
            <div style="font-size:11px;color:var(--text-muted)">Aprovados por mim</div>
          </div>
          <div style="background:var(--bg-secondary);border-radius:10px;padding:12px;text-align:center;border:1px solid var(--border-color)">
            <div style="font-size:22px;font-weight:800;color:#ef4444">${FA_PEDIDOS.filter(p=>p.status==='Cancelado' && p.aprovador_reprovador === currentUser?.name).length}</div>
            <div style="font-size:11px;color:var(--text-muted)">Reprovados por mim</div>
          </div>
          <div style="background:var(--bg-secondary);border-radius:10px;padding:12px;text-align:center;border:1px solid var(--border-color)">
            <div style="font-size:22px;font-weight:800;color:#f59e0b">${FA_PEDIDOS.filter(p=>p.modalidade==='Emergencial' && p.status==='Aguardando Aprovação').length}</div>
            <div style="font-size:11px;color:var(--text-muted)">Emergenciais pendentes</div>
          </div>
        </div>
        <!-- Histórico de aprovações (últimas 10) -->
        <div style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.4px;margin-bottom:8px">
          <i class="fas fa-history" style="margin-right:4px"></i>Histórico de Aprovações / Reprovações
        </div>
        <div style="max-height:260px;overflow-y:auto">
          ${(() => {
            const hist = FA_PEDIDOS
              .filter(p => (p.status === 'Aprovado' || p.status === 'Cancelado') && (p.historico_aprovacao||[]).length > 0)
              .flatMap(p => (p.historico_aprovacao||[]).map(h => ({...h, pedido_numero: p.numero, pedido_valor: p.valor_total, modalidade: p.modalidade})))
              .sort((a,b) => new Date(b.data_iso||b.data||0) - new Date(a.data_iso||a.data||0))
              .slice(0,15);
            if (!hist.length) return '<div style="text-align:center;padding:16px;color:var(--text-muted);font-size:12px"><i class="fas fa-inbox" style="display:block;margin-bottom:6px"></i>Nenhum histórico ainda.</div>';
            return hist.map(h => {
              const isAprov = h.acao && h.acao.toLowerCase().includes('aprovad');
              const cor = isAprov ? '#16a34a' : '#ef4444';
              const ico = isAprov ? 'fa-check-circle' : 'fa-times-circle';
              return `<div style="display:flex;align-items:flex-start;gap:8px;padding:7px 10px;margin-bottom:4px;background:var(--bg-secondary);border-radius:8px;border:1px solid var(--border-color)">
                <i class="fas ${ico}" style="color:${cor};margin-top:2px;font-size:14px;flex-shrink:0"></i>
                <div style="flex:1;min-width:0">
                  <div style="font-size:12px;font-weight:700;color:var(--text-primary)">${h.pedido_numero||'—'}
                    ${(h.modalidade||'')!=='Cotação' && h.modalidade ? `<span style="font-size:9px;background:${cor}18;color:${cor};padding:1px 6px;border-radius:6px;margin-left:4px">${h.modalidade}</span>` : ''}
                    &nbsp;<span style="font-weight:400;font-size:11px;color:var(--text-muted)">${fmt(h.pedido_valor||0)}</span>
                  </div>
                  <div style="font-size:11px;color:var(--text-secondary)">${h.acao||'—'} &nbsp;·&nbsp; ${h.usuario||'—'}</div>
                  ${h.motivo ? `<div style="font-size:10px;color:#ef4444;font-style:italic">${h.motivo}</div>` : ''}
                </div>
                <div style="font-size:10px;color:var(--text-muted);flex-shrink:0;text-align:right">${h.data||'—'}</div>
              </div>`;
            }).join('');
          })()}
        </div>
      </div>
    </div>
    ` : ''}

    <!-- ═══ SEÇÃO 1: Mapas Aprovados Aguardando Emissão de PC ═══════════════ -->
    ${mapasAprovadosSemPC.length > 0 ? `
    <div id="secMapasAprovados" class="card" style="margin-bottom:16px;border-left:4px solid #22c55e">
      <div class="card-header" style="background:rgba(34,197,94,0.06)">
        <h3 style="margin:0;color:#16a34a">
          <i class="fas fa-balance-scale" style="margin-right:8px"></i>
          Mapas Comparativos Aprovados — Aguardando Emissão de PC
        </h3>
        <span style="background:#22c55e;color:#fff;padding:3px 12px;border-radius:12px;font-size:11px;font-weight:700">${mapasAprovadosSemPC.length} mapa(s)</span>
      </div>
      <div style="padding:8px 16px 6px;font-size:11px;color:var(--text-muted);background:rgba(34,197,94,0.04)">
        <i class="fas fa-info-circle" style="color:#22c55e;margin-right:4px"></i>
        Estes mapas foram <strong>aprovados</strong>. Clique em <strong style="color:#16a34a"><i class="fas fa-file-invoice"></i> Emitir PC</strong> para iniciar a emissão do Pedido de Compra, ou em <strong><i class="fas fa-table"></i></strong> para ver o mapa comparativo completo.
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr style="background:var(--bg-tertiary)">
          <th style="padding:9px 12px;text-align:left;font-size:11px;color:var(--text-secondary)">Mapa / RFQ</th>
          <th style="padding:9px 12px;text-align:left;font-size:11px;color:var(--text-secondary)">Processo / Descrição</th>
          <th style="padding:9px 12px;text-align:left;font-size:11px;color:var(--text-secondary)">Fornecedor Selecionado</th>
          <th style="padding:9px 12px;text-align:center;font-size:11px;color:var(--text-secondary)">Critério</th>
          <th style="padding:9px 12px;text-align:right;font-size:11px;color:var(--text-secondary)">Valor Final</th>
          <th style="padding:9px 12px;text-align:left;font-size:11px;color:var(--text-secondary)">Aprovado por / Data</th>
          <th style="padding:9px 12px;text-align:center;font-size:11px;color:var(--text-secondary)">Ações</th>
        </tr></thead>
        <tbody>
          ${mapasAprovadosSemPC.map(m => {
            const rfq = m._rfq || {};
            const solicitante = rfq.solicitante || rfq.criado_por || '—';
            // Tenta resolver nome do fornecedor com todos os campos possíveis (novo e legado)
            const fornId = m.forn_recomendado_id || m.forn_recomendado || m.fornecedor_selecionado || '';
            const fornNomeResolvido = typeof _rfqNomeForn === 'function' ? _rfqNomeForn(fornId) : fornId;
            const fornNome = (fornNomeResolvido && fornNomeResolvido !== fornId)
              ? fornNomeResolvido
              : (m.forn_recomendado_nome || m.fornecedor_selecionado_nome || fornId || '—');
            // Valor: suporta campo valor_aprovado (novo), valor (legado), valor_total
            const valorFmt = fmt(m.valor_aprovado || m.valor_final || m.valor_total || m.valor || 0);
            return `
            <tr style="border-bottom:1px solid var(--border-color)" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='transparent'">
              <td style="padding:10px 12px">
                <div style="font-weight:800;color:#22c55e;font-size:12px">${m.id}</div>
                ${rfq.numero_rfq ? `<div style="font-size:10px;color:var(--text-muted)"><i class="fas fa-clipboard-list" style="margin-right:3px"></i>${rfq.numero_rfq}</div>` : ''}
              </td>
              <td style="padding:10px 12px">
                <div style="font-weight:600;color:var(--text-primary);max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${rfq.titulo || m.titulo || '(sem título)'}</div>
                <div style="font-size:10px;color:var(--text-muted);margin-top:2px">${solicitante} · ${m.aprovado_em || '—'}</div>
              </td>
              <td style="padding:10px 12px">
                <div style="font-weight:600;color:var(--fa-teal)">${fornNome}</div>
              </td>
              <td style="padding:10px 12px;text-align:center">
                <span style="background:rgba(99,102,241,0.12);color:#6366f1;padding:3px 8px;border-radius:8px;font-size:10px;font-weight:700">${m.criterio || 'Menor Preço'}</span>
              </td>
              <td style="padding:10px 12px;text-align:right;font-weight:800;color:var(--fa-teal);font-size:13px">${valorFmt}</td>
              <td style="padding:10px 12px;font-size:11px;color:var(--text-secondary)">${m.aprovado_por || '—'}<br><span style="font-size:10px;color:var(--text-muted)">${m.aprovado_em || ''}</span></td>
              <td style="padding:10px 12px;text-align:center">
                <button onclick="verMapaAnexado('${m.id}')" class="btn btn-secondary btn-sm" style="margin:2px" title="Ver mapa comparativo completo">
                  <i class="fas fa-table"></i> Ver Mapa
                </button>
                <button onclick="emitirPedidoRFQ('${m.rfq_id || m.id}')" class="btn btn-sm" style="margin:2px;background:#22c55e;color:#fff;border:none;font-weight:700;padding:6px 12px;border-radius:6px;cursor:pointer" title="Emitir Pedido de Compra">
                  <i class="fas fa-file-invoice"></i> Emitir PC
                </button>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}

    <!-- ═══ SEÇÃO 2: Pedidos Aguardando Aprovação ══════════════════════════ -->
    ${aguardando > 0 ? `
    <div id="secAguardandoAprov" class="card" style="margin-bottom:16px;border-left:4px solid var(--yellow)">
      <div class="card-header">
        <h3><i class="fas fa-bell" style="color:var(--yellow-light);margin-right:8px"></i>Aguardando Aprovação</h3>
        <span class="badge badge-warning">${aguardando} pendente(s)</span>
      </div>
      <div style="padding:7px 16px 4px;font-size:11px;color:var(--text-muted)">
        <i class="fas fa-info-circle" style="color:var(--fa-teal);margin-right:4px"></i>
        <strong>Alçada:</strong> Até USD 10.000 (≈ R$ 50.000) → Gerente &nbsp;| Acima → Diretor
      </div>
      ${FA_PEDIDOS.filter(p => p.status === 'Aguardando Aprovação').map(p => {
        const nivel = _nivelAprovacaoRequerido(p.valor_total);
        const podeAprovar = _podePedidoAprovar(p);
        const isEmergencial = (p.modalidade || '') === 'Emergencial';
        const tagModalidade = isEmergencial
          ? `<span class="badge badge-danger" style="font-size:9px;margin-left:4px"><i class="fas fa-bolt"></i> EMERGENCIAL</span>`
          : (p.modalidade && p.modalidade !== 'Cotação'
              ? `<span class="badge badge-warning" style="font-size:9px;margin-left:4px">${p.modalidade}</span>` : '');
        return `
        <div class="alert alert-warning" style="margin:4px 16px;${isEmergencial?'border-left:3px solid #ef4444;':''}">
          <span class="alert-icon"><i class="fas fa-shopping-cart" style="${isEmergencial?'color:#ef4444':''}"></i></span>
          <div style="flex:1">
            <div class="alert-title">${p.numero} – ${p.descricao}${tagModalidade}</div>
            <div class="alert-desc">${p.solicitante||'—'} · ${p.fornecedor_nome||'—'} · <strong style="color:var(--fa-teal)">${fmt(p.valor_total)}</strong>
              &nbsp;·&nbsp;<span class="badge ${nivel==='Diretor'?'badge-danger':'badge-warning'}" style="font-size:9px"><i class="fas fa-user-tie"></i> ${nivel}</span>
              ${isEmergencial && p.autorizado_por ? `&nbsp;·&nbsp;<span style="font-size:10px;color:#ef4444"><i class="fas fa-phone"></i> Aut: ${p.autorizado_por}</span>` : ''}
            </div>
            ${isEmergencial && p.justificativa_emergencial ? `<div style="font-size:11px;color:#ef4444;margin-top:3px;font-style:italic"><i class="fas fa-exclamation-circle" style="margin-right:3px"></i>${p.justificativa_emergencial}</div>` : ''}
          </div>
          <div style="display:flex;gap:6px;margin-left:8px;flex-shrink:0">
            <button class="btn btn-secondary btn-sm btn-icon" onclick="verDetalhePedido('${p.id}')" title="Ver detalhes"><i class="fas fa-eye"></i></button>
            ${podeAprovar
              ? `<button class="btn btn-success btn-sm" onclick="aprovarPedido('${p.id}')"><i class="fas fa-check"></i> Aprovar</button>`
              : `<button class="btn btn-secondary btn-sm" disabled title="Alçada insuficiente para este valor/modalidade"><i class="fas fa-lock"></i> Sem Alçada</button>`
            }
            <button class="btn btn-danger btn-sm" onclick="reprovarPedidoComMotivo('${p.id}')"><i class="fas fa-times"></i> Reprovar</button>
          </div>
        </div>`;
      }).join('')}
      <div style="height:8px"></div>
    </div>
    ` : ''}

    <!-- ═══ SEÇÃO 3: Todos os Pedidos ════════════════════════════════════════ -->
    <div id="secTodosPedidos" class="card">
      <div class="card-header">
        <h3><i class="fas fa-list" style="margin-right:8px;color:var(--fa-teal)"></i>Todos os Pedidos de Compra</h3>
        <span style="font-size:11px;color:var(--text-muted)">${FA_PEDIDOS.length} registro(s)</span>
      </div>
      <div class="search-bar">
        <div class="search-input-wrapper">
          <i class="fas fa-search"></i>
          <input class="search-input" type="text" placeholder="Buscar por nº, fornecedor, RFQ, contrato, OS..." id="searchPC" oninput="filterPedidos()">
        </div>
        <select class="filter-select" id="filterPCStatus" onchange="filterPedidos()">
          <option value="">Todos os Status</option>
          <option>Rascunho</option><option>Aguardando Aprovação</option><option>Aprovado</option>
          <option>Emitido</option><option>Entregue Parcial</option><option>Entregue Total</option><option>Pago</option><option>Cancelado</option>
        </select>
        <select class="filter-select" id="filterPCPrior" onchange="filterPedidos()">
          <option value="">Todas Prioridades</option>
          <option>Urgente</option><option>Alta</option><option>Normal</option>
        </select>
      </div>
      <div id="tabelaPC">${renderTabelaPC(FA_PEDIDOS)}</div>
    </div>
  `;
}

function renderTabelaPC(lista) {
  if (!lista.length) return `<div class="empty-state" style="padding:40px"><i class="fas fa-shopping-cart" style="font-size:32px;color:var(--text-muted)"></i><p>Nenhum pedido encontrado</p></div>`;
  return `
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th style="min-width:130px">Nº Pedido / Origem</th>
            <th>Tipo</th>
            <th>Fornecedor</th>
            <th style="min-width:160px">Descrição</th>
            <th>Pagamento</th>
            <th style="text-align:right">Valor</th>
            <th>Emissão</th>
            <th>Prev. Entrega</th>
            <th>Prioridade</th>
            <th>Status</th>
            <th style="min-width:130px">Ações</th>
          </tr>
        </thead>
        <tbody>
          ${lista.map(p => {
            const rowBg = p.status==='Aguardando Aprovação' ? 'rgba(217,119,6,0.04)'
              : p.status==='Emitido' ? 'rgba(0,180,184,0.03)'
              : p.status==='Entregue Total' ? 'rgba(34,197,94,0.03)' : '';
            const entregaPrev = p.data_entrega_prev
              ? (p.data_entrega_prev.includes('-') ? new Date(p.data_entrega_prev+'T12:00:00').toLocaleDateString('pt-BR') : p.data_entrega_prev)
              : '—';
            return `
            <tr style="border-bottom:1px solid var(--border-color);${rowBg?'background:'+rowBg:''}" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='${rowBg||'transparent'}'">
              <td style="padding:9px 12px">
                <div style="color:var(--fa-teal);font-weight:800;font-size:12px;cursor:pointer" onclick="verDetalhePedido('${p.id}')">${p.numero}</div>
                ${p.rfq_numero ? `<div style="font-size:9px;color:var(--text-muted);margin-top:1px"><i class="fas fa-clipboard-list" style="margin-right:2px"></i>RFQ: ${p.rfq_numero}</div>` : ''}
                ${p.matriz_id ? `<div style="font-size:9px;color:#22c55e;margin-top:1px"><i class="fas fa-balance-scale" style="margin-right:2px"></i>Mapa: ${p.matriz_id}</div>` : ''}
              </td>
              <td style="padding:9px 12px;white-space:nowrap">${_pcTipoBadge(p.tipo_pedido)}</td>
              <td style="padding:9px 12px">
                <div style="font-weight:600;font-size:12px;color:var(--text-primary)">${p.fornecedor_nome || p.fornecedor || '—'}</div>
              </td>
              <td style="padding:9px 12px;max-width:200px">
                <div style="font-size:12px;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${(p.descricao||'').replace(/"/g,"'")}">${p.descricao}</div>
                ${p.contrato_id ? `<div style="font-size:9px;color:var(--text-muted);margin-top:1px"><i class="fas fa-file-contract" style="margin-right:2px"></i>${p.contrato_id}</div>` : ''}
              </td>
              <td style="padding:9px 12px;font-size:11px;color:${p.cond_pagamento==='Antecipado'?'#ef4444':'var(--text-secondary)'};font-weight:${p.cond_pagamento==='Antecipado'?'700':'400'}">
                ${p.cond_pagamento || '—'}
              </td>
              <td style="padding:9px 12px;text-align:right;font-weight:700;color:var(--fa-teal);font-size:13px">${fmt(p.valor_total)}</td>
              <td style="padding:9px 12px;font-size:11px;color:var(--text-secondary)">${p.data_emissao||'—'}</td>
              <td style="padding:9px 12px;font-size:11px;color:var(--text-secondary)">${entregaPrev}</td>
              <td style="padding:9px 12px">${prioridade(p.prioridade)}</td>
              <td style="padding:9px 12px">${statusBadge(p.status)}</td>
              <td style="padding:9px 12px">
                <div class="actions-cell">
                  <button class="btn btn-secondary btn-sm btn-icon" onclick="verDetalhePedido('${p.id}')" title="Ver histórico completo"><i class="fas fa-eye"></i></button>
                  <button class="btn btn-danger btn-sm btn-icon" onclick="gerarPdfPorId('${p.id}')" title="Gerar PDF"><i class="fas fa-file-pdf"></i></button>
                  ${p.status==='Aguardando Aprovação' ? `
                    <button class="btn btn-success btn-sm btn-icon" onclick="aprovarPedido('${p.id}')" title="Aprovar"><i class="fas fa-check"></i></button>
                    <button class="btn btn-danger btn-sm btn-icon" onclick="reprovarPedido('${p.id}')" title="Reprovar"><i class="fas fa-times"></i></button>
                  ` : ''}
                  ${p.status==='Aprovado' ? `
                    <button class="btn btn-info btn-sm btn-icon" onclick="emitirPedido('${p.id}')" title="Emitir para Fornecedor"><i class="fas fa-paper-plane"></i></button>
                  ` : ''}
                  ${(p.status==='Emitido'||p.status==='Entregue Parcial') ? `
                    <button class="btn btn-success btn-sm btn-icon" onclick="navigate('recebimento');setTimeout(()=>{ if(typeof abrirRecebimento==='function') abrirRecebimento('${p.id}'); },400)" title="Ir para Recebimento de Material"><i class="fas fa-dolly"></i></button>
                  ` : ''}
                  ${p.status==='Emitido' ? `
                    <button class="btn btn-primary btn-sm btn-icon" onclick="_abrirModalEnvioEmail('${p.id}')" title="Enviar por e-mail"><i class="fas fa-envelope"></i></button>
                  ` : ''}
                </div>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}
function filterPedidos() {
  const s = document.getElementById('searchPC').value.toLowerCase();
  const st = document.getElementById('filterPCStatus').value;
  const pr = document.getElementById('filterPCPrior').value;
  const f = FA_PEDIDOS.filter(p =>
    (!s || (p.numero+p.fornecedor_nome+p.descricao+p.contrato_id).toLowerCase().includes(s)) &&
    (!st || p.status === st) &&
    (!pr || p.prioridade === pr)
  );
  document.getElementById('tabelaPC').innerHTML = renderTabelaPC(f);
}

function verDetalhePedido(id) {
  // Busca em memória e no localStorage (caso FA_PEDIDOS não esteja sincronizado)
  let p = FA_PEDIDOS.find(x => x.id === id);
  if (!p) {
    try {
      const raw = localStorage.getItem('fa_pedidos');
      if (raw) {
        const local = JSON.parse(raw);
        p = local.find(x => x.id === id);
        // Sincroniza com memória para evitar buscas repetidas
        if (p && !FA_PEDIDOS.find(x => x.id === id)) FA_PEDIDOS.unshift(p);
      }
    } catch(e) {}
  }
  // Suporte a campos legados do seed
  if (p) {
    if (!p.fornecedor_nome && p.fornecedor) p.fornecedor_nome = p.fornecedor;
    if (!p.matriz_id && p.mapa_id) p.matriz_id = p.mapa_id;
    if (!p.rfq_id && p.rc_id) p.rfq_id = p.rc_id;
  }
  if (!p) { showToast('Pedido não encontrado.', 'warning'); return; }
  const itens = _pedidoGetItens(p);

  // ── Busca mapa comparativo vinculado ──────────────────────────────────────
  let mapaData = null;
  try {
    const matrizes = JSON.parse(localStorage.getItem('fa_matrizes') || '[]');
    mapaData = matrizes.find(m => m.id === p.matriz_id || m.rfq_id === p.rfq_id);
  } catch(e) {}

  // ── Busca recebimentos vinculados ao pedido ───────────────────────────────
  let recebimentos = [];
  try {
    const todosRec = JSON.parse(localStorage.getItem('fa_recebimentos') || '[]');
    recebimentos = todosRec.filter(r => r.pedido_id === p.id || r.pedido_numero === p.numero);
  } catch(e) {}

  // ── Histórico completo do processo (RC → RFQ → Mapa → PC) ─────────────────
  // Mescla historico_aprovacoes (legado) + historico (novo – inclui aprovações, reprovações, etc.)
  const _histLegado = Array.isArray(p.historico_aprovacoes) ? p.historico_aprovacoes : [];
  const _histNovo = Array.isArray(p.historico) ? p.historico.map(h => ({
    etapa: h.acao || '—',
    aprovado_por: h.usuario || '—',
    data: h.data || '—',
    obs: ''
  })) : [];
  const historicoAprov = [..._histNovo, ..._histLegado];

  // ── Mapa Comparativo como Anexo ───────────────────────────────────────────
  const mapaAnexoHtml = mapaData ? (() => {
    const cotacoes = mapaData.cotacoes || [];
    const rfqsAll  = (() => { try { return JSON.parse(localStorage.getItem('fa_rfqs') || localStorage.getItem('fa_rfq_flow') || '[]'); } catch(e) { return []; } })();
    const rfq      = rfqsAll.find(r => r.id === mapaData.rfq_id) || {};
    return `
    <div style="margin-top:20px;padding:14px 16px;background:rgba(34,197,94,0.05);border:1px solid rgba(34,197,94,0.25);border-radius:10px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div style="font-weight:700;font-size:13px;color:#16a34a">
          <i class="fas fa-balance-scale" style="margin-right:7px"></i>Mapa Comparativo Aprovado — ${mapaData.id}
        </div>
        <div style="display:flex;gap:6px">
          <span style="background:#22c55e;color:#fff;padding:3px 10px;border-radius:8px;font-size:10px;font-weight:700">✓ Aprovado</span>
          <button onclick="verMapaAnexado('${mapaData.id}')" class="btn btn-secondary btn-sm" style="font-size:11px">
            <i class="fas fa-expand-alt"></i> Ver Mapa Completo
          </button>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px;font-size:11px">
        <div style="background:var(--bg-secondary);border-radius:6px;padding:8px 10px">
          <div style="font-size:9px;color:var(--text-muted);text-transform:uppercase;font-weight:700">Processo RFQ</div>
          <div style="font-weight:700;color:var(--fa-teal)">${rfq.numero_rfq || mapaData.rfq_id || '—'}</div>
        </div>
        <div style="background:var(--bg-secondary);border-radius:6px;padding:8px 10px">
          <div style="font-size:9px;color:var(--text-muted);text-transform:uppercase;font-weight:700">Critério</div>
          <div style="font-weight:700;color:var(--text-primary)">${mapaData.criterio || 'Menor Preço'}</div>
        </div>
        <div style="background:var(--bg-secondary);border-radius:6px;padding:8px 10px">
          <div style="font-size:9px;color:var(--text-muted);text-transform:uppercase;font-weight:700">Aprovado por</div>
          <div style="font-weight:700;color:var(--text-primary)">${mapaData.aprovado_por || '—'} · ${mapaData.aprovado_em || '—'}</div>
        </div>
      </div>
      ${cotacoes.length > 0 ? `
      <div style="font-size:11px;font-weight:700;color:var(--text-secondary);margin-bottom:6px;text-transform:uppercase;letter-spacing:.4px">
        <i class="fas fa-building" style="margin-right:4px"></i>Fornecedores Cotados
      </div>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:11px">
          <thead><tr style="background:var(--bg-tertiary)">
            <th style="padding:6px 8px;text-align:left;font-size:10px;color:var(--text-secondary)">#</th>
            <th style="padding:6px 8px;text-align:left;font-size:10px;color:var(--text-secondary)">Fornecedor</th>
            <th style="padding:6px 8px;text-align:right;font-size:10px;color:var(--text-secondary)">Valor Total</th>
            <th style="padding:6px 8px;text-align:center;font-size:10px;color:var(--text-secondary)">Prazo</th>
            <th style="padding:6px 8px;text-align:center;font-size:10px;color:var(--text-secondary)">Pagamento</th>
            <th style="padding:6px 8px;text-align:center;font-size:10px;color:var(--text-secondary)">Selecionado</th>
          </tr></thead>
          <tbody>
            ${cotacoes.map((c, idx) => {
              const nome = typeof _rfqNomeForn === 'function' ? _rfqNomeForn(c.fornecedor || '') : (c.fornecedor_nome || c.fornecedor || '—');
              const valorTotal = c.total_negociado != null ? c.total_negociado : (c.total || 0);
              const isSel = idx === (mapaData.forn_recomendado_idx || 0);
              return `
              <tr style="border-bottom:1px solid var(--border-color);${isSel?'background:rgba(34,197,94,0.07);':''}">
                <td style="padding:5px 8px;color:var(--text-muted)">${idx+1}</td>
                <td style="padding:5px 8px;font-weight:${isSel?'700':'400'};color:${isSel?'#16a34a':'var(--text-primary)'}">${nome}</td>
                <td style="padding:5px 8px;text-align:right;font-weight:700;color:${isSel?'#16a34a':'var(--fa-teal)'}">${fmt(valorTotal)}</td>
                <td style="padding:5px 8px;text-align:center;color:var(--text-secondary)">${c.prazo_entrega || '—'} dias</td>
                <td style="padding:5px 8px;text-align:center;color:var(--text-secondary)">${c.cond_pagamento || '—'}</td>
                <td style="padding:5px 8px;text-align:center">${isSel ? '<span style="color:#22c55e;font-size:14px;font-weight:800">✓</span>' : '<span style="color:var(--text-muted)">·</span>'}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>` : '<div style="font-size:11px;color:var(--text-muted);font-style:italic">Detalhes das cotações não disponíveis nesta visualização.</div>'}
    </div>`;
  })() : '';

  const entregaPrev = p.data_entrega_prev
    ? (p.data_entrega_prev.includes('-') ? new Date(p.data_entrega_prev+'T12:00:00').toLocaleDateString('pt-BR') : p.data_entrega_prev)
    : '—';

  openModalWide(`Pedido de Compra – ${p.numero}`, `
    <!-- Linha de status e badges -->
    <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;align-items:center">
      ${statusBadge(p.status)} ${prioridade(p.prioridade)}
      ${p.tipo_pedido ? _pcTipoBadge(p.tipo_pedido) : ''}
      ${p.rfq_numero ? `<span class="badge" style="background:rgba(0,180,184,0.12);color:var(--fa-teal);border:1px solid rgba(0,180,184,0.3)"><i class="fas fa-clipboard-list" style="margin-right:4px"></i>RFQ: ${p.rfq_numero}</span>` : ''}
      ${p.matriz_id ? `<span class="badge" style="background:rgba(34,197,94,0.12);color:#16a34a;border:1px solid rgba(34,197,94,0.3)"><i class="fas fa-balance-scale" style="margin-right:4px"></i>Mapa: ${p.matriz_id}</span>` : ''}
      ${p.contrato_id ? `<span class="badge badge-muted"><i class="fas fa-file-contract" style="margin-right:4px"></i>${p.contrato_id}</span>` : ''}
      ${p.criterio_selecao ? `<span class="badge badge-muted"><i class="fas fa-star" style="margin-right:4px;color:var(--orange)"></i>Critério: ${p.criterio_selecao}</span>` : ''}
    </div>

    <!-- Grid info principal -->
    <div class="grid-2">
      <div>
        <div class="section-divider"><h4>Informações do Pedido</h4></div>
        <div class="stat-row"><span class="stat-label">Fornecedor</span><span class="stat-value" style="color:var(--fa-teal);font-weight:700">${p.fornecedor_nome || p.fornecedor || '—'}</span></div>
        <div class="stat-row"><span class="stat-label">Descrição</span><span class="stat-value" style="font-size:12px;max-width:220px;text-align:right">${p.descricao}</span></div>
        <div class="stat-row"><span class="stat-label">Cond. Pagamento</span><span class="stat-value" style="font-weight:700;color:${p.cond_pagamento==='Antecipado'?'#ef4444':'var(--fa-teal)'}">${p.cond_pagamento || '—'}</span></div>
        <div class="stat-row"><span class="stat-label">Solicitante</span><span class="stat-value">${p.solicitante || '—'}</span></div>
        <div class="stat-row"><span class="stat-label">Aprovador</span><span class="stat-value" style="color:${p.aprovador ? 'var(--green-light)' : 'var(--text-muted)'}">${p.aprovador || 'Pendente'}</span></div>
        ${p.modalidade && p.modalidade !== 'Cotação' ? `<div class="stat-row"><span class="stat-label">Modalidade</span><span class="stat-value"><span class="badge ${p.modalidade==='Emergencial'?'badge-danger':'badge-warning'}" style="font-size:10px">${p.modalidade}</span></span></div>` : ''}
        ${p.motivo_reprovacao ? `<div class="stat-row"><span class="stat-label">Motivo Reprovação</span><span class="stat-value" style="color:#ef4444;font-size:11px">${p.motivo_reprovacao}</span></div>` : ''}
        ${p.conta_contabil ? `<div class="stat-row"><span class="stat-label">Conta Contábil</span><span class="stat-value" style="font-size:11px">${p.conta_contabil}</span></div>` : ''}
        ${p.desconto_aplicado ? `<div class="stat-row"><span class="stat-label">Desconto</span><span class="stat-value" style="color:var(--green-light)">${p.desconto_aplicado}%</span></div>` : ''}
      </div>
      <div>
        <div class="section-divider"><h4>Datas e Valores</h4></div>
        <div class="stat-row"><span class="stat-label">Data Emissão</span><span class="stat-value">${p.data_emissao||'—'}</span></div>
        <div class="stat-row"><span class="stat-label">Prev. Entrega</span><span class="stat-value">${entregaPrev}</span></div>
        <div class="stat-row"><span class="stat-label">Entrega Real</span><span class="stat-value" style="color:${p.data_entrega_real?'var(--green-light)':'var(--text-muted)'}">${p.data_entrega_real||'Pendente'}</span></div>
        <div class="stat-row" style="margin-top:8px"><span class="stat-label">Valor Total</span><span class="stat-value" style="font-size:22px;font-weight:800;color:var(--fa-teal)">${fmt(p.valor_total)}</span></div>
      </div>
    </div>

    <!-- Itens do Pedido -->
    ${itens.length > 0 ? `
      <div class="section-divider"><h4><i class="fas fa-list" style="margin-right:6px"></i>Itens do Pedido (${itens.length})</h4></div>
      <div class="table-wrapper">
        <table>
          <thead><tr>
            <th style="text-align:center;width:32px">#</th>
            <th>Descrição</th>
            <th style="text-align:center">Qtd</th>
            <th>Un.</th>
            <th style="text-align:right">Preço Unit.</th>
            <th style="text-align:right">Total</th>
          </tr></thead>
          <tbody>
            ${itens.map((i, idx) => `
              <tr style="${idx%2===1?'background:var(--bg-secondary)':''}">
                <td style="text-align:center;color:var(--text-muted);font-size:11px">${String(idx+1).padStart(2,'0')}</td>
                <td style="font-size:12px">${i.desc}</td>
                <td style="text-align:center">${i.qtd}</td>
                <td style="color:var(--text-muted)">${i.un}</td>
                <td style="text-align:right">${fmt(i.preco)}</td>
                <td style="text-align:right;font-weight:600;color:var(--fa-teal)">${fmt(i.total)}</td>
              </tr>
            `).join('')}
            <tr style="background:rgba(0,180,184,0.08)">
              <td colspan="5" style="font-weight:700;text-align:right;padding-right:16px;color:var(--text-primary)">TOTAL</td>
              <td style="font-weight:800;font-size:15px;color:var(--fa-teal);text-align:right">${fmt(p.valor_total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    ` : `
      <div class="alert alert-info" style="margin:12px 0">
        <span class="alert-icon"><i class="fas fa-info-circle"></i></span>
        <div><div class="alert-title">Descrição do Pedido</div><div class="alert-desc">${p.descricao}</div></div>
      </div>
    `}

    <!-- Histórico do Processo de Aprovação -->
    ${historicoAprov.length > 0 ? `
      <div class="section-divider" style="margin-top:18px"><h4><i class="fas fa-history" style="margin-right:6px;color:var(--fa-teal)"></i>Histórico do Processo (Linha do Tempo)</h4></div>
      <div style="position:relative;padding-left:24px;margin-bottom:12px">
        <div style="position:absolute;left:9px;top:0;bottom:0;width:2px;background:linear-gradient(to bottom, var(--fa-teal), #8b5cf6, #22c55e);border-radius:2px"></div>
        ${historicoAprov.map((h, i) => {
          const isLast = i === historicoAprov.length - 1;
          const colors = ['var(--fa-teal)', '#6366f1', '#22c55e', '#f59e0b', '#ef4444'];
          const cor = colors[i % colors.length];
          return `
          <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:${isLast?'0':'12px'};position:relative">
            <div style="position:absolute;left:-19px;width:20px;height:20px;border-radius:50%;background:${cor};color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0">${i+1}</div>
            <div style="flex:1;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;padding:9px 12px;border-left:3px solid ${cor}">
              <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
                <span style="font-weight:700;font-size:12px;color:var(--text-primary)">${h.etapa || '—'}</span>
                <span style="font-size:10px;color:var(--text-muted)">${h.data || '—'}</span>
              </div>
              <div style="font-size:11px;color:var(--text-secondary);margin-top:3px">
                <i class="fas fa-user" style="margin-right:4px;color:${cor}"></i>${h.aprovado_por || '—'}
                ${h.obs ? `&nbsp;·&nbsp;<em style="color:var(--text-muted)">${h.obs}</em>` : ''}
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>
    ` : ''}

    <!-- Mapa Comparativo como Anexo -->
    ${mapaAnexoHtml}

    <!-- Recebimentos vinculados ao pedido -->
    ${(() => {
      try {
        const recsLocal = JSON.parse(localStorage.getItem('fa_recebimentos') || '[]');
        const recsVinc  = recsLocal.filter(r => r.pedido_id === p.id || r.pedido_numero === p.numero);
        if (recsVinc.length === 0) return '';
        const colorMap = { Conforme:'#22c55e', Parcial:'#f59e0b', Divergente:'#ef4444', Recusado:'#6b7280' };
        return `
        <div style="margin-top:18px">
          <div class="section-divider">
            <h4><i class="fas fa-box-open" style="margin-right:6px;color:#22c55e"></i>Recebimentos Registrados (${recsVinc.length})</h4>
          </div>
          ${recsVinc.map(r => {
            const col = colorMap[r.status] || '#6b7280';
            return `
            <div style="display:flex;align-items:flex-start;gap:12px;padding:10px 12px;border:1px solid ${col}30;border-radius:8px;margin-bottom:8px;background:${col}08">
              <i class="fas fa-file-invoice" style="color:${col};font-size:18px;margin-top:2px"></i>
              <div style="flex:1">
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                  <span style="font-weight:700;font-size:12px;color:var(--fa-teal)">${r.numero || r.id}</span>
                  <span style="padding:2px 7px;border-radius:5px;font-size:10px;font-weight:700;background:${col}20;color:${col};border:1px solid ${col}40">${r.status}</span>
                  ${r.cp_gerado ? `<span style="font-size:10px;color:#22c55e"><i class="fas fa-check"></i> CP Gerado</span>` : `<span style="font-size:10px;color:#f59e0b"><i class="fas fa-clock"></i> Sem CP</span>`}
                </div>
                <div style="display:flex;gap:16px;margin-top:4px;font-size:11px;color:var(--text-secondary);flex-wrap:wrap">
                  <span>NF: <strong>${r.nf_numero || '—'}</strong></span>
                  <span>Valor: <strong style="color:var(--fa-teal)">${fmt(r.valor_nf)}</strong></span>
                  <span>Data: <strong>${r.data_recebimento || '—'}</strong></span>
                  <span>Conferente: <strong>${r.conferente || '—'}</strong></span>
                </div>
                ${r.obs ? `<div style="font-size:11px;color:var(--text-muted);margin-top:3px;font-style:italic">${r.obs}</div>` : ''}
              </div>
            </div>`;
          }).join('')}
        </div>`;
      } catch(e) { return ''; }
    })()}

    <!-- Observações -->
    ${p.observacoes ? `
      <div class="alert alert-info" style="margin-top:12px">
        <span class="alert-icon"><i class="fas fa-sticky-note"></i></span>
        <div><div class="alert-title">Observações</div><div class="alert-desc">${p.observacoes}</div></div>
      </div>
    ` : ''}
  `, `
    <button class="btn btn-secondary" onclick="closeModal()"><i class="fas fa-times"></i> Fechar</button>
    ${mapaData ? `<button class="btn btn-secondary" onclick="closeModal();verMapaAnexado('${mapaData.id}')"><i class="fas fa-balance-scale"></i> Ver Mapa</button>` : ''}
    <button class="btn btn-danger" onclick="closeModal();gerarPdfPedido(FA_PEDIDOS.find(x=>x.id==='${p.id}'))"><i class="fas fa-file-pdf"></i> Gerar PDF</button>
    <button class="btn btn-primary" onclick="closeModal();_abrirModalEnvioEmail('${p.id}')"><i class="fas fa-envelope"></i> Enviar ao Fornecedor</button>
    ${p.status==='Aguardando Aprovação' ? `
      <button class="btn btn-success" onclick="aprovarPedido('${p.id}');closeModal()"><i class="fas fa-check"></i> Aprovar</button>
      <button class="btn btn-danger" onclick="reprovarPedido('${p.id}');closeModal()"><i class="fas fa-times"></i> Reprovar</button>
    ` : ''}
    ${p.status==='Aprovado' ? `<button class="btn btn-primary" onclick="emitirPedido('${p.id}');closeModal()"><i class="fas fa-paper-plane"></i> Emitir para Fornecedor</button>` : ''}
    ${(p.status==='Emitido'||p.status==='Entregue Parcial') ? `
      <button class="btn btn-success" onclick="closeModal();navigate('recebimento');setTimeout(()=>{ if(typeof abrirRecebimento==='function') abrirRecebimento('${p.id}'); },400)">
        <i class="fas fa-dolly"></i> Ir para Recebimento
      </button>
    ` : ''}
    ${(p.status==='Entregue Total'||p.status==='Pago'||p.status==='Entregue Parcial') ? `<button class="btn btn-secondary" onclick="closeModal();navigate('recebimento')"><i class="fas fa-dolly"></i> Ver Recebimentos</button>` : ''}
  `);
}

// Abre modal fullscreen com o mapa comparativo completo vinculado ao pedido
function verMapaAnexado(mapaId) {
  let mapaData = null;
  try {
    // Busca em múltiplas fontes: fa_matrizes, fa_mapas_comp, fa_mapas_comparativos
    for (const key of ['fa_matrizes', 'fa_mapas_comp', 'fa_mapas_comparativos']) {
      try {
        const arr = JSON.parse(localStorage.getItem(key) || '[]');
        mapaData = arr.find(m => m.id === mapaId);
        if (mapaData) break;
      } catch(e) {}
    }
    // Fallback: tenta window.verDetalheMatriz se disponível
    if (!mapaData && typeof window.verDetalheMatriz === 'function') {
      window.verDetalheMatriz(mapaId);
      return;
    }
  } catch(e) {}

  if (!mapaData) { showToast('Mapa não encontrado.', 'warning'); return; }

  const rfqsAll = (() => {
    const set = new Map();
    ['fa_rfqs','fa_rfq_flow'].forEach(k => {
      try { (JSON.parse(localStorage.getItem(k) || '[]')).forEach(r => { if (!set.has(r.id)) set.set(r.id, r); }); } catch(e) {}
    });
    return [...set.values()];
  })();
  const rfq = rfqsAll.find(r => r.id === mapaData.rfq_id) || {};
  const cotacoes = mapaData.cotacoes || [];

  const mc = document.getElementById('modalContainer');
  if (mc) { mc.style.maxWidth = '98vw'; mc.style.width = '98vw'; }

  openModal(`<i class="fas fa-balance-scale" style="color:#22c55e;margin-right:8px"></i>Mapa Comparativo — ${mapaData.id}`, `
    <!-- Cabeçalho do mapa -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px">
      <div style="background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.25);border-radius:8px;padding:10px 12px">
        <div style="font-size:9px;color:var(--text-muted);text-transform:uppercase;font-weight:700">Status</div>
        <div style="font-weight:800;font-size:13px;color:#16a34a">✓ ${mapaData.status}</div>
      </div>
      <div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;padding:10px 12px">
        <div style="font-size:9px;color:var(--text-muted);text-transform:uppercase;font-weight:700">RFQ</div>
        <div style="font-weight:700;color:var(--fa-teal)">${rfq.numero_rfq || mapaData.rfq_id || '—'}</div>
      </div>
      <div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;padding:10px 12px">
        <div style="font-size:9px;color:var(--text-muted);text-transform:uppercase;font-weight:700">Critério</div>
        <div style="font-weight:700;color:var(--text-primary)">${mapaData.criterio || 'Menor Preço'}</div>
      </div>
      <div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;padding:10px 12px">
        <div style="font-size:9px;color:var(--text-muted);text-transform:uppercase;font-weight:700">Aprovado por</div>
        <div style="font-weight:700;color:var(--text-primary);font-size:11px">${mapaData.aprovado_por || '—'}<br><span style="font-size:10px;color:var(--text-muted)">${mapaData.aprovado_em || ''}</span></div>
      </div>
    </div>

    <div style="font-weight:700;font-size:12px;color:var(--text-secondary);margin-bottom:8px">
      <i class="fas fa-tag" style="margin-right:5px;color:var(--fa-teal)"></i>${rfq.titulo || '(sem título)'}
    </div>

    <!-- Tabela comparativa de cotações -->
    ${cotacoes.length > 0 ? `
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead>
          <tr style="background:var(--bg-tertiary)">
            <th style="padding:9px 10px;text-align:left;font-size:10px;color:var(--text-secondary);border-bottom:2px solid var(--border-color)">#</th>
            <th style="padding:9px 10px;text-align:left;font-size:10px;color:var(--text-secondary);border-bottom:2px solid var(--border-color)">Fornecedor</th>
            <th style="padding:9px 10px;text-align:right;font-size:10px;color:var(--text-secondary);border-bottom:2px solid var(--border-color)">Valor Original</th>
            <th style="padding:9px 10px;text-align:center;font-size:10px;color:var(--text-secondary);border-bottom:2px solid var(--border-color)">Desconto</th>
            <th style="padding:9px 10px;text-align:right;font-size:10px;color:var(--text-secondary);border-bottom:2px solid var(--border-color)">Valor Negociado</th>
            <th style="padding:9px 10px;text-align:center;font-size:10px;color:var(--text-secondary);border-bottom:2px solid var(--border-color)">Prazo (dias)</th>
            <th style="padding:9px 10px;text-align:center;font-size:10px;color:var(--text-secondary);border-bottom:2px solid var(--border-color)">Pagamento</th>
            <th style="padding:9px 10px;text-align:center;font-size:10px;color:var(--text-secondary);border-bottom:2px solid var(--border-color)">Frete</th>
            <th style="padding:9px 10px;text-align:center;font-size:10px;color:var(--text-secondary);border-bottom:2px solid var(--border-color)">Selecionado</th>
          </tr>
        </thead>
        <tbody>
          ${cotacoes.map((c, idx) => {
            const nome = typeof _rfqNomeForn === 'function' ? _rfqNomeForn(c.fornecedor || '') : (c.fornecedor_nome || c.fornecedor || '—');
            const valorOrig = c.total || 0;
            const valorNeg  = c.total_negociado != null ? c.total_negociado : valorOrig;
            const desc = c.desconto_pct || 0;
            const isSel = idx === (mapaData.forn_recomendado_idx || 0);
            return `
            <tr style="border-bottom:1px solid var(--border-color);${isSel?'background:rgba(34,197,94,0.07);border-left:3px solid #22c55e;':''}">
              <td style="padding:8px 10px;color:var(--text-muted);font-size:11px">${idx+1}</td>
              <td style="padding:8px 10px;font-weight:${isSel?'700':'500'};color:${isSel?'#16a34a':'var(--text-primary)'}">
                ${nome}
                ${isSel ? '<span style="margin-left:6px;background:#22c55e;color:#fff;padding:1px 6px;border-radius:6px;font-size:9px;font-weight:700">SELECIONADO</span>' : ''}
              </td>
              <td style="padding:8px 10px;text-align:right;color:var(--text-secondary)">${fmt(valorOrig)}</td>
              <td style="padding:8px 10px;text-align:center;color:${desc>0?'#22c55e':'var(--text-muted)'};font-weight:${desc>0?'700':'400'}">${desc > 0 ? desc+'%' : '—'}</td>
              <td style="padding:8px 10px;text-align:right;font-weight:700;color:${isSel?'#16a34a':'var(--fa-teal)'};font-size:13px">${fmt(valorNeg)}</td>
              <td style="padding:8px 10px;text-align:center;color:var(--text-secondary)">${c.prazo_entrega || '—'}</td>
              <td style="padding:8px 10px;text-align:center;font-size:11px;color:${c.cond_pagamento==='Antecipado'?'#ef4444':'var(--text-secondary)'};font-weight:${c.cond_pagamento==='Antecipado'?'700':'400'}">${c.cond_pagamento || '—'}</td>
              <td style="padding:8px 10px;text-align:center;color:var(--text-secondary)">${c.frete || '—'}</td>
              <td style="padding:8px 10px;text-align:center;font-size:16px">${isSel ? '✅' : '<span style="color:var(--text-muted)">·</span>'}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
    ` : '<div style="font-size:12px;color:var(--text-muted);font-style:italic;padding:16px">Nenhuma cotação registrada neste mapa.</div>'}

    ${mapaData.observacoes ? `
      <div style="margin-top:12px;padding:10px 14px;background:rgba(245,158,11,0.07);border:1px solid rgba(245,158,11,0.25);border-radius:8px;font-size:12px">
        <strong style="color:#b45309"><i class="fas fa-sticky-note" style="margin-right:6px"></i>Observações do Mapa:</strong>
        <span style="color:var(--text-secondary)">${mapaData.observacoes}</span>
      </div>
    ` : ''}
  `, `<button class="btn btn-secondary" onclick="closeModal()"><i class="fas fa-times"></i> Fechar</button>`);
}
function _abrirModalEnvioEmail(pedidoId) {
  const pedido = FA_PEDIDOS.find(p => p.id === pedidoId);
  if (!pedido) { showToast('Pedido não encontrado.', 'error'); return; }
  const fornecedor = typeof FA_FORNECEDORES !== 'undefined'
    ? FA_FORNECEDORES.find(f => f.id === (pedido.fornecedor_id || pedido.fornecedor))
    : null;
  openModalPosCriacao(pedido, fornecedor);
}

function openNovoPedido(forId = '') {
  loadFornecedores();
  openModalWide('Novo Pedido de Compra', `
    <div class="form-row">
      <div class="form-group">
        <label>Fornecedor *</label>
        <select class="form-control" id="np_for">
          <option value="">Selecione...</option>
          ${FA_FORNECEDORES.filter(f => f.status === 'Ativo').map(f =>
            `<option value="${f.id}" ${f.id===forId?'selected':''}>${f.nome_fantasia||f.razao_social}</option>`
          ).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Contrato de Origem</label>
        <select class="form-control" id="np_contrato">
          <option value="Geral">Geral</option>
          ${ERP_DATA.contratos.filter(c => c.status==='Ativo').map(c =>
            `<option value="${c.id}">${c.id} – ${c.cliente}</option>`
          ).join('')}
        </select>
      </div>
    </div>
    <div class="form-group">
      <label>Descrição do Pedido *</label>
      <input class="form-control" id="np_desc" type="text" placeholder="Resumo do pedido (materiais, serviços, finalidade)">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Prioridade</label>
        <select class="form-control" id="np_prior">
          <option>Normal</option><option>Alta</option><option>Urgente</option>
        </select>
      </div>
      <div class="form-group">
        <label>Modalidade de Compra</label>
        <select class="form-control" id="np_modalidade" onchange="_pedidoToggleEmergencia()">
          <option value="Cotação">Cotação (padrão)</option>
          <option value="Dispensa">Dispensa de Cotação</option>
          <option value="Emergencial">Compra Emergencial</option>
          <option value="Contrato">Contrato Vigente</option>
        </select>
      </div>
      <div class="form-group">
        <label>Data de Entrega Prevista</label>
        <input class="form-control" id="np_entrega" type="date">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Conta Contábil</label>
        <select class="form-control" id="np_conta">
          <option>1.1.3.01 – Lubrificantes</option>
          <option>1.1.3.02 – Material de Manutenção</option>
          <option>1.1.3.03 – Material Elétrico</option>
          <option>1.1.3.04 – Ferramentas</option>
          <option>1.1.3.05 – EPI e Segurança</option>
          <option>1.1.3.06 – Combustível</option>
          <option>1.1.3.07 – Serviços Externos</option>
          <option>1.1.3.99 – Outros</option>
        </select>
      </div>
      <div class="form-group">
        <label>Valor Total Estimado (R$)</label>
        <input class="form-control" id="np_valor" type="number" placeholder="0,00">
      </div>
    </div>

    <div class="section-divider"><h4>Itens do Pedido</h4></div>
    <div id="itensPedido">
      <div class="form-row" style="gap:8px;align-items:end" id="item_0">
        <div class="form-group" style="flex:3"><label>Descrição</label><input class="form-control" type="text" placeholder="Item/Produto/Serviço" id="i0_desc"></div>
        <div class="form-group" style="flex:1"><label>Qtd</label><input class="form-control" type="number" value="1" id="i0_qtd"></div>
        <div class="form-group" style="flex:1"><label>Un</label><input class="form-control" type="text" value="Un" id="i0_un"></div>
        <div class="form-group" style="flex:2"><label>Preço Unit. R$</label><input class="form-control" type="number" placeholder="0,00" id="i0_preco" oninput="calcTotal()"></div>
        <div class="form-group" style="flex:2"><label>Total</label><input class="form-control" type="text" id="i0_total" readonly style="color:var(--fa-teal);font-weight:600"></div>
      </div>
    </div>
    <button type="button" class="btn btn-secondary btn-sm" onclick="addItemPedido()" style="margin-top:8px">
      <i class="fas fa-plus"></i> Adicionar Item
    </button>
    <div style="text-align:right;margin-top:8px;font-size:14px;font-weight:700;color:var(--fa-teal)" id="totalPedido">Total: R$ 0,00</div>

    <div class="form-group" style="margin-top:12px">
      <label>Observações</label>
      <input class="form-control" id="np_obs" type="text" placeholder="Referência de OS, urgência, instruções de entrega...">
    </div>

    <!-- Justificativa de compra emergencial (exibida apenas quando modalidade = Emergencial) -->
    <div id="bloco_emergencial" style="display:none;margin-top:12px;padding:14px;background:rgba(239,68,68,0.07);border:1px solid rgba(239,68,68,0.3);border-radius:8px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
        <i class="fas fa-exclamation-triangle" style="color:#ef4444;font-size:16px"></i>
        <span style="font-weight:700;color:#ef4444;font-size:13px">Política de Compra Emergencial</span>
      </div>
      <div style="font-size:12px;color:var(--text-secondary);margin-bottom:10px;line-height:1.6">
        Compras emergenciais <strong>dispensam cotação prévia</strong>, mas exigem autorização do Diretor e justificativa técnica obrigatória.
        O pedido será escalado automaticamente para aprovação da diretoria.
      </div>
      <div class="form-group">
        <label style="color:#ef4444;font-weight:700">Justificativa Técnica * <span style="font-size:11px;font-weight:400;color:var(--text-muted)">(obrigatório – mínimo 30 caracteres)</span></label>
        <textarea class="form-control" id="np_justificativa_emerg" rows="3"
          placeholder="Descreva o motivo da urgência: qual risco operacional, qual equipamento parado, qual o impacto se não comprar agora..."
          style="resize:vertical;min-height:70px"></textarea>
      </div>
      <div class="form-group">
        <label style="color:#ef4444;font-weight:700">Autorização Verbal de * </label>
        <select class="form-control" id="np_autorizado_por">
          <option value="">Selecione quem autorizou verbalmente...</option>
          <option>Diretor de Operações</option>
          <option>Diretor Geral</option>
          <option>General Manager</option>
          <option>Gerente Sênior de Projeto</option>
        </select>
      </div>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-warning" onclick="salvarPedido('Rascunho')"><i class="fas fa-save"></i> Salvar Rascunho</button>
    <button class="btn btn-primary" onclick="salvarPedido('Aguardando Aprovação')"><i class="fas fa-paper-plane"></i> Enviar para Aprovação</button>
  `);
  window._numItens = 1;
}

let _numItens = 1;

// ── Toggle: exibe/oculta bloco de compra emergencial ──
function _pedidoToggleEmergencia() {
  const modalidade = document.getElementById('np_modalidade')?.value;
  const bloco = document.getElementById('bloco_emergencial');
  if (bloco) bloco.style.display = modalidade === 'Emergencial' ? 'block' : 'none';
}

function addItemPedido() {
  const n = _numItens++;
  window._numItens = _numItens;
  const div = document.createElement('div');
  div.className = 'form-row';
  div.style.cssText = 'gap:8px;align-items:end';
  div.id = `item_${n}`;
  div.innerHTML = `
    <div class="form-group" style="flex:3"><input class="form-control" type="text" placeholder="Item/Produto" id="i${n}_desc"></div>
    <div class="form-group" style="flex:1"><input class="form-control" type="number" value="1" id="i${n}_qtd"></div>
    <div class="form-group" style="flex:1"><input class="form-control" type="text" value="Un" id="i${n}_un"></div>
    <div class="form-group" style="flex:2"><input class="form-control" type="number" placeholder="0,00" id="i${n}_preco" oninput="calcTotal()"></div>
    <div class="form-group" style="flex:2"><input class="form-control" type="text" id="i${n}_total" readonly style="color:var(--fa-teal);font-weight:600"></div>
    <button type="button" class="btn btn-danger btn-sm btn-icon" onclick="this.closest('.form-row').remove();calcTotal()" style="margin-bottom:0"><i class="fas fa-trash"></i></button>
  `;
  document.getElementById('itensPedido').appendChild(div);
}

function calcTotal() {
  let total = 0;
  const num = window._numItens || 1;
  for (let i = 0; i < num + 10; i++) {
    const qtd = document.getElementById(`i${i}_qtd`);
    const preco = document.getElementById(`i${i}_preco`);
    const totalEl = document.getElementById(`i${i}_total`);
    if (!qtd || !preco || !totalEl) continue;
    const t = parseFloat(qtd.value||0) * parseFloat(preco.value||0);
    totalEl.value = 'R$ ' + t.toLocaleString('pt-BR', {minimumFractionDigits:2});
    total += t;
  }
  const el = document.getElementById('totalPedido');
  if (el) el.textContent = 'Total: ' + fmt(total);
  const vEl = document.getElementById('np_valor');
  if (vEl) vEl.value = total.toFixed(2);
}

async function salvarPedido(status) {
  const forId = document.getElementById('np_for').value;
  const desc = document.getElementById('np_desc').value;
  if (!forId) { showToast('Selecione um fornecedor', 'warning'); return; }
  if (!desc) { showToast('Informe a descrição', 'warning'); return; }

  // ── Validação: compra emergencial exige justificativa ──
  const modalidade = document.getElementById('np_modalidade')?.value || 'Cotação';
  if (modalidade === 'Emergencial') {
    const justif = (document.getElementById('np_justificativa_emerg')?.value || '').trim();
    const autorPor = document.getElementById('np_autorizado_por')?.value || '';
    if (justif.length < 30) {
      showToast('⚠️ Compra Emergencial: informe a justificativa técnica (mínimo 30 caracteres).', 'warning', 5000);
      document.getElementById('np_justificativa_emerg')?.focus();
      return;
    }
    if (!autorPor) {
      showToast('⚠️ Compra Emergencial: selecione quem autorizou verbalmente.', 'warning', 5000);
      document.getElementById('np_autorizado_por')?.focus();
      return;
    }
    // Compra emergencial sempre vai para aprovação da diretoria
    status = 'Aguardando Aprovação';
  }

  const for_ = FA_FORNECEDORES.find(f => f.id === forId);
  const itens = [];
  const num = window._numItens || 1;
  for (let i = 0; i < num + 10; i++) {
    const descEl = document.getElementById(`i${i}_desc`);
    const qtdEl = document.getElementById(`i${i}_qtd`);
    const unEl = document.getElementById(`i${i}_un`);
    const precoEl = document.getElementById(`i${i}_preco`);
    if (!descEl || !descEl.value) continue;
    itens.push({
      desc: descEl.value, qtd: parseFloat(qtdEl.value||1),
      un: unEl.value||'Un', preco: parseFloat(precoEl.value||0),
      total: parseFloat(qtdEl.value||1) * parseFloat(precoEl.value||0)
    });
  }

  const valor = parseFloat(document.getElementById('np_valor').value) || itens.reduce((a,b)=>a+b.total,0);
  // Numeração ATÔMICA no servidor (sem corrida do length+1). Fallback local só
  // se o servidor estiver indisponível (modo offline/demo).
  let numPedido = null;
  try { const _seq = await DB.sequencia('PC'); numPedido = _seq && _seq.numero; } catch (e) {}
  if (!numPedido) numPedido = 'PC-' + new Date().getFullYear() + '-' + String(FA_PEDIDOS.length + 43).padStart(4,'0');

  const novo = {
    id: gerarId('PC'),
    numero: numPedido,
    fornecedor_id: forId,
    fornecedor_nome: for_ ? (for_.nome_fantasia || for_.razao_social) : forId,
    contrato_id: document.getElementById('np_contrato').value,
    solicitante: currentUser ? currentUser.name : 'Sistema',
    aprovador: '',
    descricao: desc,
    itens: JSON.stringify(itens),
    valor_total: valor,
    status,
    prioridade: document.getElementById('np_prior').value,
    modalidade: document.getElementById('np_modalidade')?.value || 'Cotação',
    justificativa_emergencial: document.getElementById('np_justificativa_emerg')?.value || '',
    autorizado_por: document.getElementById('np_autorizado_por')?.value || '',
    data_emissao: new Date().toISOString().split('T')[0],
    data_entrega_prev: document.getElementById('np_entrega').value,
    data_entrega_real: '',
    observacoes: document.getElementById('np_obs').value,
    conta_contabil: document.getElementById('np_conta').value,
    centro_custo: document.getElementById('np_contrato').value
  };

  // ── Detecção de anomalias (fracionamento, valor atípico, crédito, duplicidade) ──
  // Interliga com o cadastro de fornecedor (score/classe de crédito). Risco alto
  // pede confirmação explícita e fica registrado no log de auditoria.
  if (typeof window.detectarAnomalias === 'function') {
    const _hist = FA_PEDIDOS.map(p => ({ fornecedor_id: p.fornecedor_id, valor: p.valor_total, data: p.data_emissao, id: p.id }));
    const _an = window.detectarAnomalias(
      { fornecedor_id: forId, valor, data: novo.data_emissao, categoria: for_ && for_.categoria },
      _hist, for_ || {}
    );
    if (_an.risco !== 'Nenhum') {
      logAction('Anomalia', 'Pedidos', `Risco ${_an.risco} em ${numPedido}: ${_an.alertas.map(a => a.tipo).join(', ')}`);
      novo.anomalia_risco = _an.risco;
      novo.anomalia_alertas = JSON.stringify(_an.alertas);
      if (_an.risco === 'Alto') {
        const _msg = _an.alertas.map(a => '• ' + a.mensagem + (a.detalhe ? ' — ' + a.detalhe : '')).join('\n');
        const segue = window.confirm(`⚠️ RISCO ALTO neste pedido:\n\n${_msg}\n\nRegistrar mesmo assim? A ação ficará no log de auditoria.`);
        if (!segue) { showToast('Pedido não registrado — revise os alertas de risco.', 'info'); return; }
      } else {
        showToast(`Atenção (risco ${_an.risco}): ${_an.alertas[0].mensagem}`, 'warning', 6000);
      }
    }
  }

  try {
    await fetch('/api/pedidos', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(novo) });
  } catch(e) {}

  FA_PEDIDOS.unshift(novo);

  // Persiste no localStorage para sobreviver a recarregamentos de página
  try {
    const _rawPed = localStorage.getItem('fa_pedidos');
    const _localPed = _rawPed ? JSON.parse(_rawPed) : [];
    if (!_localPed.find(p => p.id === novo.id)) _localPed.unshift(novo);
    localStorage.setItem('fa_pedidos', JSON.stringify(_localPed));
  } catch(eSave) {}

  logAction('Criação PC', 'Pedidos', `${numPedido} criado – ${for_?.nome_fantasia} – ${fmt(valor)}`);
  closeModal();

  // Após salvar, abre modal de opções: PDF / Email / Ignorar
  if (status !== 'Rascunho') {
    setTimeout(() => openModalPosCriacao(novo, for_), 200);
  } else {
    showToast(`Rascunho ${numPedido} salvo!`, 'info');
    _renderPedidosUI();
  }
}

// ─── DELEGAÇÃO POR VALOR:
// Até USD 10.000 (≈ R$ 50.000) → Gerente de Projeto pode aprovar
// Acima de USD 10.000 → Apenas Diretor pode aprovar
const LIMITE_APROVACAO_GERENTE_USD = 10000;
const TAXA_USD_BRL = 5.0; // taxa de referência

function _podePedidoAprovar(pedido) {
  const profile = currentUser?.profile;
  if (!profile) return false;
  if (profile === 'admin' || profile === 'diretor') return true;

  const limiteBRL = LIMITE_APROVACAO_GERENTE_USD * TAXA_USD_BRL;
  const valor = pedido.valor_total || 0;

  // Gerente de operações pode aprovar até R$ 50.000
  if (profile === 'operacao' && valor <= limiteBRL) return true;

  return false;
}

function _nivelAprovacaoRequerido(valor) {
  const limiteBRL = LIMITE_APROVACAO_GERENTE_USD * TAXA_USD_BRL;
  if (valor <= limiteBRL) return 'Gerente de Projeto';
  return 'Diretor';
}

async function aprovarPedido(id) {
  const idx = FA_PEDIDOS.findIndex(p => p.id === id);
  if (idx < 0) return;

  const pedido = FA_PEDIDOS[idx];

  // Verifica permissão de aprovação por valor
  if (!_podePedidoAprovar(pedido)) {
    const nivel = _nivelAprovacaoRequerido(pedido.valor_total);
    const limiteBRL = LIMITE_APROVACAO_GERENTE_USD * TAXA_USD_BRL;
    openModal('⚠️ Aprovação Bloqueada', `
      <div style="text-align:center;padding:16px 0">
        <i class="fas fa-lock" style="color:var(--red-light);font-size:40px;margin-bottom:12px"></i>
        <div style="font-size:16px;font-weight:700;color:var(--red-light)">Alçada Insuficiente</div>
      </div>
      <div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.3);border-radius:8px;padding:14px;margin:12px 0">
        <div style="font-size:13px;color:var(--text-secondary);line-height:1.6">
          <strong>Pedido:</strong> ${pedido.numero}<br>
          <strong>Valor:</strong> ${fmt(pedido.valor_total)}<br>
          <strong>Aprovação requerida:</strong> <span style="color:var(--orange);font-weight:700">${nivel}</span><br>
          <br>
          <i class="fas fa-info-circle" style="color:var(--fa-teal)"></i>
          Pedidos <strong>até USD ${LIMITE_APROVACAO_GERENTE_USD.toLocaleString()} (≈ ${fmt(limiteBRL)})</strong> → Gerente de Projeto<br>
          Pedidos <strong>acima de USD ${LIMITE_APROVACAO_GERENTE_USD.toLocaleString()}</strong> → Diretor
        </div>
      </div>
    `, `<button class="btn btn-secondary" onclick="closeModal()">Entendido</button>`);
    return;
  }

  // Segregação de funções: quem solicita não pode aprovar o próprio pedido.
  const aprovadorNome = currentUser ? currentUser.name : 'Sistema';
  if (pedido.solicitante && pedido.solicitante === aprovadorNome) {
    openModal('⚠️ Segregação de Funções', `
      <div style="text-align:center;padding:16px 0">
        <i class="fas fa-user-shield" style="color:var(--orange);font-size:40px;margin-bottom:12px"></i>
        <div style="font-size:16px;font-weight:700;color:var(--orange)">Aprovação não permitida</div>
      </div>
      <div style="font-size:13px;color:var(--text-secondary);line-height:1.6;padding:0 8px">
        O solicitante do pedido <strong>${pedido.numero}</strong> não pode aprová-lo.
        A aprovação deve ser feita por outra pessoa com alçada.
      </div>
    `, `<button class="btn btn-secondary" onclick="closeModal()">Entendido</button>`);
    return;
  }

  FA_PEDIDOS[idx].status = 'Aprovado';
  FA_PEDIDOS[idx].aprovador = currentUser ? currentUser.name : 'Sistema';
  FA_PEDIDOS[idx].data_aprovacao = new Date().toISOString();

  // Registra no histórico do pedido
  FA_PEDIDOS[idx].historico = FA_PEDIDOS[idx].historico || [];
  FA_PEDIDOS[idx].historico.unshift({
    acao: `Aprovado por ${FA_PEDIDOS[idx].aprovador} (${_nivelAprovacaoRequerido(FA_PEDIDOS[idx].valor_total)})`,
    usuario: FA_PEDIDOS[idx].aprovador,
    data: new Date().toLocaleString('pt-BR')
  });

  // Histórico específico de aprovações (para o painel do aprovador)
  FA_PEDIDOS[idx].historico_aprovacao = FA_PEDIDOS[idx].historico_aprovacao || [];
  FA_PEDIDOS[idx].historico_aprovacao.unshift({
    acao: `Aprovado (${_nivelAprovacaoRequerido(FA_PEDIDOS[idx].valor_total)})`,
    usuario: FA_PEDIDOS[idx].aprovador,
    data: new Date().toLocaleString('pt-BR'),
    data_iso: new Date().toISOString()
  });

  try {
    await fetch(`tables/fa_pedidos_compra/${id}`, { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ status: 'Aprovado', aprovador: FA_PEDIDOS[idx].aprovador }) });
  } catch(e) {}

  // Persiste alteração no localStorage
  _savePedidos(FA_PEDIDOS);

  // Cria conta a pagar automaticamente (integração financeira)
  criarContaPagarFromPedido(FA_PEDIDOS[idx]);

  logAction('Aprovação PC', 'Pedidos', `${FA_PEDIDOS[idx].numero} aprovado por ${FA_PEDIDOS[idx].aprovador} – ${fmt(FA_PEDIDOS[idx].valor_total)}`);
  showToast(`Pedido ${FA_PEDIDOS[idx].numero} aprovado! Conta a pagar gerada automaticamente.`, 'success');
  _renderPedidosUI();
}

async function reprovarPedido(id) {
  const idx = FA_PEDIDOS.findIndex(p => p.id === id);
  if (idx < 0) return;
  FA_PEDIDOS[idx].status = 'Cancelado';
  try {
    await fetch(`tables/fa_pedidos_compra/${id}`, { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ status: 'Cancelado' }) });
  } catch(e) {}
  _savePedidos(FA_PEDIDOS);
  logAction('Reprovação PC', 'Pedidos', `${FA_PEDIDOS[idx].numero} reprovado`);
  showToast(`Pedido ${FA_PEDIDOS[idx].numero} reprovado.`, 'warning');
  _renderPedidosUI();
}

// Reprovar com solicitação de motivo
function reprovarPedidoComMotivo(id) {
  const pedido = FA_PEDIDOS.find(p => p.id === id);
  if (!pedido) return;
  openModal('Reprovar Pedido – ' + pedido.numero,
    `<div style="text-align:center;padding:10px 0 14px">
      <i class="fas fa-times-circle" style="color:#ef4444;font-size:36px;margin-bottom:8px"></i>
      <div style="font-size:14px;font-weight:700;color:#ef4444">Confirmar Reprovação</div>
    </div>
    <div style="background:rgba(239,68,68,0.07);border:1px solid rgba(239,68,68,0.25);border-radius:8px;padding:12px;margin-bottom:12px;font-size:13px;color:var(--text-secondary)">
      <strong>${pedido.numero}</strong> – ${pedido.descricao}<br>
      Fornecedor: ${pedido.fornecedor_nome || '—'} · Valor: <strong style="color:var(--fa-teal)">${fmt(pedido.valor_total)}</strong>
    </div>
    <div class="form-group">
      <label style="font-weight:700">Motivo da Reprovação *</label>
      <select class="form-control" id="reprova_motivo_select" onchange="_pedidoAtualizarMotivoCustom()">
        <option value="">Selecione o motivo...</option>
        <option>Preço acima do mercado – solicitar nova cotação</option>
        <option>Fornecedor não homologado</option>
        <option>Sem justificativa adequada</option>
        <option>Necessidade cancelada</option>
        <option>Excede o orçamento disponível</option>
        <option>Documentação incompleta</option>
        <option>Outro (especificar abaixo)</option>
      </select>
    </div>
    <div class="form-group" id="reprova_outro_bloco" style="display:none">
      <label>Especifique o motivo</label>
      <input class="form-control" type="text" id="reprova_motivo_custom" placeholder="Descreva o motivo da reprovação...">
    </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
     <button class="btn btn-danger" onclick="_confirmarReprovacao('${id}')"><i class="fas fa-times"></i> Confirmar Reprovação</button>`
  );
}

function _pedidoAtualizarMotivoCustom() {
  const sel = document.getElementById('reprova_motivo_select')?.value;
  const bloco = document.getElementById('reprova_outro_bloco');
  if (bloco) bloco.style.display = sel === 'Outro (especificar abaixo)' ? 'block' : 'none';
}

async function _confirmarReprovacao(id) {
  const motivoSel = document.getElementById('reprova_motivo_select')?.value;
  const motivoCustom = document.getElementById('reprova_motivo_custom')?.value?.trim();
  if (!motivoSel) { showToast('Selecione o motivo da reprovação.', 'warning'); return; }
  const motivo = motivoSel === 'Outro (especificar abaixo)' ? (motivoCustom || 'Outro') : motivoSel;

  const idx = FA_PEDIDOS.findIndex(p => p.id === id);
  if (idx < 0) { closeModal(); return; }

  FA_PEDIDOS[idx].status = 'Cancelado';
  FA_PEDIDOS[idx].motivo_reprovacao = motivo;
  FA_PEDIDOS[idx].data_reprovacao = new Date().toISOString();
  FA_PEDIDOS[idx].reprovado_por = currentUser?.name || 'Sistema';
  FA_PEDIDOS[idx].aprovador_reprovador = currentUser?.name || 'Sistema';

  // Adiciona ao histórico do pedido
  FA_PEDIDOS[idx].historico = FA_PEDIDOS[idx].historico || [];
  FA_PEDIDOS[idx].historico.unshift({
    acao: `Reprovado por ${FA_PEDIDOS[idx].reprovado_por}. Motivo: ${motivo}`,
    usuario: FA_PEDIDOS[idx].reprovado_por,
    data: new Date().toLocaleString('pt-BR')
  });

  // Histórico específico para o painel do aprovador
  FA_PEDIDOS[idx].historico_aprovacao = FA_PEDIDOS[idx].historico_aprovacao || [];
  FA_PEDIDOS[idx].historico_aprovacao.unshift({
    acao: `Reprovado`,
    usuario: FA_PEDIDOS[idx].reprovado_por,
    motivo,
    data: new Date().toLocaleString('pt-BR'),
    data_iso: new Date().toISOString()
  });

  try {
    await fetch(`tables/fa_pedidos_compra/${id}`, { method: 'PATCH',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ status: 'Cancelado', motivo_reprovacao: motivo })
    });
  } catch(e) {}
  _savePedidos(FA_PEDIDOS);
  logAction('Reprovação PC', 'Pedidos', `${FA_PEDIDOS[idx].numero} reprovado. Motivo: ${motivo}`);
  closeModal();
  showToast(`Pedido ${FA_PEDIDOS[idx].numero} reprovado. Motivo: ${motivo}`, 'warning', 6000);
  _renderPedidosUI();
}

async function emitirPedido(id) {
  const idx = FA_PEDIDOS.findIndex(p => p.id === id);
  if (idx < 0) return;
  FA_PEDIDOS[idx].status = 'Emitido';
  try {
    await fetch(`tables/fa_pedidos_compra/${id}`, { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ status: 'Emitido' }) });
  } catch(e) {}
  _savePedidos(FA_PEDIDOS);
  logAction('Emissão PC', 'Pedidos', `${FA_PEDIDOS[idx].numero} emitido para ${FA_PEDIDOS[idx].fornecedor_nome}`);
  showToast(`Pedido ${FA_PEDIDOS[idx].numero} emitido para o fornecedor!`, 'success');
  _renderPedidosUI();
}

// ═══════════════════════════════════════════════════════════
// MODAL DE RECEBIMENTO COMPLETO
// ═══════════════════════════════════════════════════════════

function confirmarEntrega(id) {
  const pedido = FA_PEDIDOS.find(p => p.id === id);
  if (!pedido) { showToast('Pedido não encontrado.', 'error'); return; }
  abrirModalRecebimento(pedido);
}

function abrirModalRecebimento(pedido) {
  const itens = _pedidoGetItens(pedido);
  const hoje = new Date().toISOString().split('T')[0];
  const condPagto = pedido.cond_pagamento || pedido.condicao_pagamento || '';
  const isAntecipado = condPagto === 'Antecipado';

  // Monta linhas de itens para inspeção
  const itensRows = itens.length > 0 ? itens.map((it, i) => `
    <tr style="border-bottom:1px solid var(--border-color)">
      <td style="padding:8px 10px;font-size:13px">${it.descricao || '—'}</td>
      <td style="padding:8px 10px;text-align:center;font-size:13px">${it.qtd || it.quantidade || 1} ${it.unidade || it.un || 'un'}</td>
      <td style="padding:8px 10px;text-align:center">
        <input type="number" id="rec_qtd_recebida_${i}" value="${it.qtd || it.quantidade || 1}" min="0"
          step="0.01" style="width:80px;padding:4px 8px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:6px;color:var(--text-primary);font-size:13px;text-align:center">
      </td>
      <td style="padding:8px 10px;text-align:center">
        <select id="rec_status_item_${i}" style="padding:4px 8px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:6px;color:var(--text-primary);font-size:12px">
          <option value="Conforme">✅ Conforme</option>
          <option value="Divergente">⚠️ Divergente</option>
          <option value="Recusado">❌ Recusado</option>
        </select>
      </td>
      <td style="padding:8px 10px">
        <input type="text" id="rec_obs_item_${i}" placeholder="Observação..."
          style="width:100%;padding:4px 8px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:6px;color:var(--text-primary);font-size:12px">
      </td>
    </tr>
  `).join('') : `
    <tr><td colspan="5" style="padding:16px;text-align:center;color:var(--text-muted);font-size:13px">
      <i class="fas fa-info-circle"></i> Nenhum item detalhado no pedido.
    </td></tr>
  `;

  openModalWide(`Registrar Recebimento — ${pedido.numero}`, `
    <div style="display:flex;flex-direction:column;gap:16px">

      <!-- Cabeçalho do Pedido -->
      <div style="background:rgba(0,180,184,0.07);border:1px solid rgba(0,180,184,0.25);border-radius:10px;padding:14px 16px;display:flex;gap:24px;flex-wrap:wrap">
        <div><span style="font-size:11px;color:var(--text-muted);display:block">Pedido</span><strong style="color:var(--fa-teal)">${pedido.numero}</strong></div>
        <div><span style="font-size:11px;color:var(--text-muted);display:block">Fornecedor</span><strong>${pedido.fornecedor_nome || pedido.fornecedor || '—'}</strong></div>
        <div><span style="font-size:11px;color:var(--text-muted);display:block">Valor Total</span><strong>${fmt(pedido.valor_total)}</strong></div>
        <div><span style="font-size:11px;color:var(--text-muted);display:block">Cond. Pagto</span><strong>${condPagto || '—'}</strong></div>
        <div><span style="font-size:11px;color:var(--text-muted);display:block">Entrega Prevista</span><strong>${pedido.prazo_entrega || pedido.data_entrega_prevista || '—'}</strong></div>
      </div>

      <!-- Dados do Recebimento -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
        <div>
          <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Número da NF *</label>
          <input type="text" id="rec_nf_numero" placeholder="Ex: NF-001234"
            style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
        </div>
        <div>
          <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Valor da NF (R$) *</label>
          <input type="number" id="rec_valor_nf" placeholder="0.00" min="0" step="0.01"
            value="${pedido.valor_total || ''}"
            style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
        </div>
        <div>
          <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Data de Recebimento</label>
          <input type="date" id="rec_data" value="${hoje}"
            style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
        </div>
        <div>
          <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Conferente / Recebido por</label>
          <input type="text" id="rec_conferente" value="${(typeof currentUser !== 'undefined' && currentUser?.name) || ''}"
            style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
        </div>
        <div>
          <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Status Geral do Recebimento</label>
          <select id="rec_status_geral" onchange="_recebimentoStatusChange()"
            style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
            <option value="Conforme">✅ Conforme — Entrega Total</option>
            <option value="Parcial">⚠️ Parcial — Entrega Parcial</option>
            <option value="Divergente">🔴 Divergente — Itens com problema</option>
          </select>
        </div>
        <div>
          <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Local de Entrega</label>
          <input type="text" id="rec_local" placeholder="Ex: Almoxarifado Central, Canteiro A..."
            style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
        </div>
      </div>

      <!-- Inspeção de Itens -->
      ${itens.length > 0 ? `
      <div>
        <div style="font-weight:600;font-size:13px;color:var(--text-primary);margin-bottom:8px">
          <i class="fas fa-clipboard-check" style="color:var(--fa-teal);margin-right:6px"></i>Inspeção de Itens Recebidos
        </div>
        <div style="border:1px solid var(--border-color);border-radius:8px;overflow:hidden">
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead>
              <tr style="background:var(--bg-tertiary)">
                <th style="padding:8px 10px;text-align:left;color:var(--text-secondary);font-size:11px">Item</th>
                <th style="padding:8px 10px;text-align:center;color:var(--text-secondary);font-size:11px;width:100px">Qtd Pedida</th>
                <th style="padding:8px 10px;text-align:center;color:var(--text-secondary);font-size:11px;width:100px">Qtd Recebida</th>
                <th style="padding:8px 10px;text-align:center;color:var(--text-secondary);font-size:11px;width:120px">Status</th>
                <th style="padding:8px 10px;text-align:left;color:var(--text-secondary);font-size:11px">Observação</th>
              </tr>
            </thead>
            <tbody>${itensRows}</tbody>
          </table>
        </div>
      </div>
      ` : ''}

      <!-- Anexo NF -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div>
          <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Arquivo da NF (simulação)</label>
          <div style="display:flex;gap:8px;align-items:center">
            <input type="text" id="rec_anexo_nf" placeholder="Nome do arquivo NF..."
              style="flex:1;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
            <button class="btn btn-secondary btn-sm" onclick="document.getElementById('rec_anexo_nf').value='NF-'+Date.now()+'.pdf';showToast('NF simulada anexada','info')">
              <i class="fas fa-paperclip"></i>
            </button>
          </div>
        </div>
        <div>
          <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Observações Gerais</label>
          <textarea id="rec_obs_geral" rows="2" placeholder="Notas sobre a entrega..."
            style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box;resize:vertical"></textarea>
        </div>
      </div>

      <!-- Info automação -->
      <div id="rec_info_automacao" style="padding:12px 14px;background:rgba(0,180,184,0.06);border:1px solid rgba(0,180,184,0.2);border-radius:8px;font-size:12px;color:var(--text-secondary)">
        <i class="fas fa-magic" style="color:var(--fa-teal);margin-right:6px"></i>
        <strong>Ações automáticas ao confirmar:</strong>
        <ul style="margin:6px 0 0 20px;line-height:1.8">
          ${!isAntecipado ? `<li>💰 Conta a pagar será gerada (${condPagto})</li>` : '<li>ℹ️ Pagamento antecipado — CP já existe</li>'}
          ${itens.length > 0 ? '<li>📦 Entrada no estoque/almoxarifado dos itens</li>' : ''}
          <li>📋 Registro de recebimento vinculado ao pedido</li>
          <li>✅ Status do pedido atualizado</li>
        </ul>
      </div>

    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-success" onclick="_salvarRecebimentoPedido('${pedido.id}', ${itens.length})">
      <i class="fas fa-check-circle"></i> Confirmar Recebimento
    </button>
  `);
}

function _recebimentoStatusChange() {
  const status = document.getElementById('rec_status_geral')?.value;
  const info = document.getElementById('rec_info_automacao');
  if (!info) return;
  if (status === 'Parcial') {
    info.style.background = 'rgba(245,158,11,0.07)';
    info.style.borderColor = 'rgba(245,158,11,0.3)';
  } else if (status === 'Divergente') {
    info.style.background = 'rgba(239,68,68,0.07)';
    info.style.borderColor = 'rgba(239,68,68,0.3)';
  } else {
    info.style.background = 'rgba(0,180,184,0.06)';
    info.style.borderColor = 'rgba(0,180,184,0.2)';
  }
}

async function _salvarRecebimentoPedido(pedidoId, numItens) {
  const nfNum = document.getElementById('rec_nf_numero')?.value?.trim();
  const valorNF = parseFloat(document.getElementById('rec_valor_nf')?.value || 0);
  const dataRaw = document.getElementById('rec_data')?.value;
  const conferente = document.getElementById('rec_conferente')?.value?.trim();
  const statusGeral = document.getElementById('rec_status_geral')?.value || 'Conforme';
  const local = document.getElementById('rec_local')?.value?.trim() || '';
  const obsGeral = document.getElementById('rec_obs_geral')?.value?.trim() || '';
  const anexoNF = document.getElementById('rec_anexo_nf')?.value?.trim() || '';

  if (!nfNum) { showToast('Informe o número da NF.', 'error'); return; }
  if (!valorNF || valorNF <= 0) { showToast('Informe o valor da NF.', 'error'); return; }

  const idx = FA_PEDIDOS.findIndex(p => p.id === pedidoId);
  if (idx < 0) { showToast('Pedido não encontrado.', 'error'); return; }
  const pedido = FA_PEDIDOS[idx];

  const dataFmt = dataRaw ? new Date(dataRaw + 'T12:00:00').toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR');
  const dataISO = dataRaw || new Date().toISOString().split('T')[0];

  // Coleta inspeção dos itens
  const itens = _pedidoGetItens(pedido);
  const itensInspecao = itens.map((it, i) => ({
    descricao: it.descricao || it.desc || it.nome || '—',
    nome: it.descricao || it.desc || it.nome || '—',          // campo nome para almoxarifado.js
    material_id: it.material_id || it.id || '',                // link para catálogo se existir
    qtd_pedida: it.qtd || it.quantidade || 1,
    qtd_recebida: parseFloat(document.getElementById(`rec_qtd_recebida_${i}`)?.value || it.qtd || 1),
    status: document.getElementById(`rec_status_item_${i}`)?.value || 'Conforme',
    obs: document.getElementById(`rec_obs_item_${i}`)?.value || '',
    unidade: it.unidade || it.un || 'un',
    valor_unitario: it.valor_unitario || it.preco_unitario || 0
  }));

  // Determina novo status do pedido
  const novoStatusPedido = statusGeral === 'Parcial' ? 'Entregue Parcial' : 'Entregue Total';

  // Cria registro de recebimento
  const recId = 'REC-' + new Date().toISOString().replace(/\D/g,'').slice(0,14);
  const novoRec = {
    id: recId,
    numero: recId,
    pedido_id: pedidoId,
    pedido_numero: pedido.numero,
    fornecedor_id: pedido.fornecedor_id || '',
    fornecedor: pedido.fornecedor_nome || pedido.fornecedor || '—',
    nf_numero: nfNum,
    valor_nf: valorNF,
    data_recebimento: dataFmt,
    data_recebimento_iso: dataISO,
    conferente: conferente || '',
    status: statusGeral,
    local_entrega: local,
    obs: obsGeral,
    anexo_nf: anexoNF,
    itens_inspecao: itensInspecao,
    cp_gerado: false
  };

  // 1. Atualiza pedido na memória
  FA_PEDIDOS[idx].status = novoStatusPedido;
  FA_PEDIDOS[idx].data_entrega_real = dataISO;
  FA_PEDIDOS[idx].nf_numero = nfNum;
  FA_PEDIDOS[idx].recebimento_id = recId;
  _savePedidos(FA_PEDIDOS);

  // 2. Persiste na API
  try {
    await fetch(`/api/pedidos/${pedidoId}/entrega`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: novoStatusPedido,
        data_entrega_real: dataISO,
        recebido_por: conferente,
        nf_numero: nfNum,
        valor_nf: valorNF,
        obs_recebimento: obsGeral
      })
    });
  } catch(e) { console.warn('API entrega:', e); }

  // 3. Salva recebimento em fa_recebimentos (localStorage + API D1)
  try {
    const recs = JSON.parse(localStorage.getItem('fa_recebimentos') || '[]');
    recs.unshift(novoRec);
    localStorage.setItem('fa_recebimentos', JSON.stringify(recs));
  } catch(e) {}

  // Persiste também na API D1
  try {
    const _resp = await fetch('/api/recebimentos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id:               recId,
        numero:           recId,
        pedido_id:        pedidoId,
        pedido_numero:    pedido.numero,
        fornecedor_id:    pedido.fornecedor_id || '',
        fornecedor:       pedido.fornecedor_nome || pedido.fornecedor || '',
        nf_numero:        nfNum,
        valor_nf:         valorNF,
        data_recebimento: dataISO,
        conferente:       conferente,
        status:           statusGeral,
        local_entrega:    local,
        obs:              obsGeral,
        anexo_nf:         anexoNF,
        itens_inspecao:   itensInspecao,
        cp_gerado:        false
      })
    });
    // Guarda a(s) conta(s) a pagar do SERVIDOR para o resumo persistente.
    try {
      const _j = await _resp.json();
      const _cp = _j && _j.data && _j.data.contas_pagar;
      if (Array.isArray(_cp) && _cp.length) novoRec._contasServidor = _cp;
    } catch(_) {}
  } catch(e) { console.warn('API recebimentos:', e); }

  // 4. Gera Conta a Pagar automaticamente (se não for antecipado)
  const condPagto = pedido.cond_pagamento || pedido.condicao_pagamento || '';
  const isAntecipado = condPagto === 'Antecipado';
  if (!isAntecipado) {
    novoRec.cp_gerado = true;
    await _gerarCPRecebimento(pedido, nfNum, valorNF, dataISO, condPagto);
  }

  // 5. Movimenta estoque — integração com módulo Almoxarifado (rastreabilidade completa)
  let acoes_almox = '';
  novoRec.itens_inspecao = itensInspecao;
  if (itensInspecao.length > 0) {
    if (typeof almoxEntradaAutomaticaDeRecebimento === 'function') {
      // Nova função integrada do almoxarifado.js v6.1
      almoxEntradaAutomaticaDeRecebimento(novoRec, pedido);
      const nEntradas = itensInspecao.filter(i => parseFloat(i.qtd_recebida||0) > 0).length;
      if (nEntradas > 0) acoes_almox = `, ${nEntradas} item(ns) no estoque (Almoxarifado)`;
    } else {
      // Fallback legado
      _registrarEntradaEstoque(itensInspecao, pedido, nfNum, dataISO);
    }
  }

  // 6. Log
  logAction('Recebimento', 'Pedidos', `${pedido.numero} — NF ${nfNum} — ${fmt(valorNF)} — ${statusGeral}`);

  closeModal();

  // Feedback visual completo
  const acoes = [];
  if (!isAntecipado) acoes.push('Conta a pagar gerada');
  if (itensInspecao.length > 0) acoes.push('Estoque atualizado' + acoes_almox);
  acoes.push(`Status: ${novoStatusPedido}`);
  showToast(`Recebimento confirmado! ${acoes.join(' · ')}`, 'success', 6000);

  // Mostra resumo do recebimento
  setTimeout(() => _mostrarResumoRecebimento(novoRec, pedido, !isAntecipado, novoRec._contasServidor || []), 500);
}

async function _gerarCPRecebimento(pedido, nfNum, valorNF, dataISO, condPagto) {
  // Calcula data de vencimento baseada na condição de pagamento
  const diasMap = {
    '7 dias': 7, '14 dias': 14, '15 dias': 15, '21 dias': 21,
    '28 dias': 28, '30 dias': 30, '45 dias': 45, '60 dias': 60, '90 dias': 90,
    'À entrega': 0, 'Parcelado (2x)': 30, 'Parcelado (3x)': 30
  };
  const diasPagto = diasMap[condPagto] ?? 30;
  const dataBase = new Date(dataISO + 'T12:00:00');
  dataBase.setDate(dataBase.getDate() + diasPagto);
  const vencISO = dataBase.toISOString().split('T')[0];
  const vencFmt = dataBase.toLocaleDateString('pt-BR');

  const cpId = gerarId('CP');
  const cp = {
    id: cpId,
    descricao: `${pedido.numero} – ${pedido.descricao || 'Pedido de Compra'} – NF ${nfNum}`,
    fornecedor_id: pedido.fornecedor_id || '',
    fornecedor_nome: pedido.fornecedor_nome || pedido.fornecedor || '',
    pedido_id: pedido.id,
    pedido_numero: pedido.numero,
    contrato_id: pedido.contrato_id || '',
    valor: valorNF,
    vencimento: vencFmt,
    vencimento_iso: vencISO,
    data_emissao: new Date().toLocaleDateString('pt-BR'),
    data_pagamento: '',
    status: 'Pendente',
    tipo: 'Fornecedor',
    centro_custo: pedido.centro_custo || pedido.contrato_id || 'Geral',
    nota_fiscal: nfNum,
    conta_contabil: pedido.conta_contabil || '2.1.1.01',
    cond_pagamento: condPagto,
    origem: 'Recebimento PC'
  };

  // Remove o placeholder "Aguardando NF" deste pedido (evita título em dobro).
  const ehPlaceholder = c => c.pedido_id === pedido.id && (c.aguardando_nf || !c.nota_fiscal);

  // Salva no localStorage
  try {
    let cps = JSON.parse(localStorage.getItem('fa_contas_pagar') || '[]');
    cps = cps.filter(c => !ehPlaceholder(c));
    if (!cps.find(c => c.pedido_id === pedido.id && c.nota_fiscal === nfNum)) {
      cps.unshift(cp);
    }
    localStorage.setItem('fa_contas_pagar', JSON.stringify(cps));
  } catch(e) {}

  // Atualiza array global
  if (typeof window.FA_CONTAS_PAGAR !== 'undefined') {
    const i = window.FA_CONTAS_PAGAR.length - 1;
    for (let k = i; k >= 0; k--) {
      if (ehPlaceholder(window.FA_CONTAS_PAGAR[k])) window.FA_CONTAS_PAGAR.splice(k, 1);
    }
    if (!window.FA_CONTAS_PAGAR.find(c => c.pedido_id === pedido.id && c.nota_fiscal === nfNum)) {
      window.FA_CONTAS_PAGAR.unshift(cp);
    }
  }

  // Persiste na API
  try {
    await fetch('/api/contas-pagar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cp)
    });
  } catch(e) { console.warn('API CP:', e); }

  return cp;
}

function _registrarEntradaEstoque(itensInspecao, pedido, nfNum, dataISO) {
  try {
    const mats = JSON.parse(localStorage.getItem('fa_materiais') || '[]');
    const movs = JSON.parse(localStorage.getItem('fa_movimentacoes') || '[]');
    const dataFmt = new Date(dataISO + 'T12:00:00').toLocaleDateString('pt-BR');

    itensInspecao.forEach((it, i) => {
      if (it.status === 'Recusado' || it.qtd_recebida <= 0) return;

      // Tenta localizar material no estoque
      const mat = mats.find(m =>
        m.descricao?.toLowerCase().includes(it.descricao?.toLowerCase().split(' ')[0]?.toLowerCase()) ||
        m.nome?.toLowerCase().includes(it.descricao?.toLowerCase().split(' ')[0]?.toLowerCase())
      );
      if (mat) {
        mat.estoque_atual = (parseFloat(mat.estoque_atual) || 0) + it.qtd_recebida;
        mat.ultima_entrada = dataISO;
      }

      // Registra movimentação
      movs.unshift({
        id: 'MOV-' + Date.now() + '-' + i,
        data: dataFmt,
        data_iso: dataISO,
        tipo: 'Entrada',
        material_id: mat?.id || '',
        material: it.descricao,
        qtd: it.qtd_recebida,
        unidade: it.unidade,
        destino: 'Recebimento ' + pedido.numero,
        responsavel: (typeof currentUser !== 'undefined' && currentUser?.name) || 'Sistema',
        pedido: pedido.numero,
        nota_fiscal: nfNum,
        valor_unitario: it.valor_unitario,
        status_inspecao: it.status,
        obs: it.obs
      });
    });

    localStorage.setItem('fa_materiais', JSON.stringify(mats));
    localStorage.setItem('fa_movimentacoes', JSON.stringify(movs));
  } catch(e) { console.warn('Estoque:', e); }
}

// Bloco com as contas a pagar REAIS do servidor (numero/valor/vencimento) —
// helper puro exposto para teste; escapa HTML (dados vêm do banco).
function _cpResumoHTML(contas) {
  if (!Array.isArray(contas) || !contas.length) return '';
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const m = v => typeof fmt === 'function' ? fmt(v) : ('R$ ' + (v || 0).toLocaleString('pt-BR'));
  return contas.map(c => `
    <div style="display:flex;align-items:center;gap:10px;padding:8px 14px;background:var(--bg-secondary);border-radius:8px;font-size:12px">
      <i class="fas fa-file-invoice-dollar" style="color:#22c55e"></i>
      <b>${esc(c.numero)}</b>
      <span style="flex:1">${m(c.valor)}</span>
      <span style="color:var(--text-muted)">${c.data_vencimento ? 'venc. ' + esc(c.data_vencimento) : ''} · ${esc(c.status || '')}</span>
    </div>`).join('');
}
window._cpResumoHTML = _cpResumoHTML;

function _mostrarResumoRecebimento(rec, pedido, cpGerado, contasServidor) {
  const statusColor = rec.status === 'Conforme' ? '#22c55e' : rec.status === 'Parcial' ? '#f59e0b' : '#ef4444';
  const statusIcon = rec.status === 'Conforme' ? 'check-circle' : rec.status === 'Parcial' ? 'exclamation-triangle' : 'times-circle';

  openModal('Recebimento Registrado com Sucesso', `
    <div style="text-align:center;margin-bottom:20px">
      <i class="fas fa-${statusIcon}" style="font-size:48px;color:${statusColor};margin-bottom:12px;display:block"></i>
      <h3 style="font-size:18px;margin:0 0 4px 0">Recebimento Confirmado</h3>
      <p style="color:var(--text-muted);font-size:14px;margin:0">${pedido.numero} — ${rec.nf_numero}</p>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
      <div style="background:var(--bg-secondary);border-radius:8px;padding:12px">
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">Nº Recebimento</div>
        <div style="font-weight:700;color:var(--fa-teal)">${rec.numero}</div>
      </div>
      <div style="background:var(--bg-secondary);border-radius:8px;padding:12px">
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">Status</div>
        <div style="font-weight:700;color:${statusColor}">${rec.status}</div>
      </div>
      <div style="background:var(--bg-secondary);border-radius:8px;padding:12px">
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">NF</div>
        <div style="font-weight:600">${rec.nf_numero}</div>
      </div>
      <div style="background:var(--bg-secondary);border-radius:8px;padding:12px">
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">Valor NF</div>
        <div style="font-weight:600">${fmt(rec.valor_nf)}</div>
      </div>
    </div>

    <div style="display:flex;flex-direction:column;gap:8px">
      ${cpGerado ? `
        <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.25);border-radius:8px">
          <i class="fas fa-check-circle" style="color:#22c55e;font-size:18px"></i>
          <div>
            <div style="font-weight:600;font-size:13px">Conta a Pagar Gerada</div>
            <div style="font-size:12px;color:var(--text-muted)">Condição: ${pedido.cond_pagamento || pedido.condicao_pagamento || '—'}</div>
          </div>
        </div>
        ${_cpResumoHTML(contasServidor)}
      ` : ''}
      ${rec.itens_inspecao?.length > 0 ? `
        <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:rgba(0,180,184,0.08);border:1px solid rgba(0,180,184,0.25);border-radius:8px">
          <i class="fas fa-boxes" style="color:var(--fa-teal);font-size:18px"></i>
          <div>
            <div style="font-weight:600;font-size:13px">Estoque Atualizado</div>
            <div style="font-size:12px;color:var(--text-muted)">${rec.itens_inspecao.filter(i => i.status !== 'Recusado').length} item(s) entrada no almoxarifado</div>
          </div>
        </div>
      ` : ''}
      <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.25);border-radius:8px">
        <i class="fas fa-file-alt" style="color:#6366f1;font-size:18px"></i>
        <div>
          <div style="font-weight:600;font-size:13px">Recebimento Registrado</div>
          <div style="font-size:12px;color:var(--text-muted)">ID: ${rec.numero}</div>
        </div>
      </div>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
    ${cpGerado ? `<button class="btn btn-success" onclick="closeModal();navigate('contas_pagar')">
      <i class="fas fa-file-invoice-dollar"></i> Ir para Contas a Pagar
    </button>` : ''}
    <button class="btn btn-primary" onclick="closeModal();navigate('pedidos')">
      <i class="fas fa-list"></i> Ver Pedidos
    </button>
  `);
  _renderPedidosUI();
}

// INTEGRAÇÃO FINANCEIRA: Cria conta a pagar ao aprovar pedido
async function criarContaPagarFromPedido(pedido) {
  // ⚠️ "Nada paga sem lastro": a CP NÃO nasce pagável na aprovação.
  // Cria-se apenas um título "Pendente – Aguardando NF", SEM nota fiscal, que
  // o gate de pagamento (servidor: gateContaPagar / ENFORCE_NF) bloqueia. A CP
  // pagável de verdade só surge no recebimento, com NF (_gerarCPRecebimento).
  // Dedup: não cria placeholder se já existe qualquer CP para este pedido.
  const jaExiste = (window.FA_CONTAS_PAGAR || []).some(c => c.pedido_id === pedido.id)
    || _cpsLocal().some(c => c.pedido_id === pedido.id);
  if (jaExiste) return;

  const for_ = FA_FORNECEDORES.find(f => f.id === pedido.fornecedor_id);
  const prazo = for_ ? (for_.prazo_pagamento || 30) : 30;
  const venc = new Date();
  venc.setDate(venc.getDate() + prazo);

  const cp = {
    id: gerarId('CP'),
    descricao: `${pedido.numero} – ${pedido.descricao} – Aguardando NF`,
    fornecedor_id: pedido.fornecedor_id,
    fornecedor_nome: pedido.fornecedor_nome,
    pedido_id: pedido.id,
    contrato_id: pedido.contrato_id,
    valor: pedido.valor_total,
    vencimento: venc.toISOString().split('T')[0],
    data_pagamento: '',
    status: 'Pendente',          // NÃO 'Aprovado' — não pagável
    aguardando_nf: true,
    tipo: 'Fornecedor',
    centro_custo: pedido.centro_custo,
    nota_fiscal: '',             // sem NF — o gate bloqueia o pagamento
    origem: 'Aprovação PC (aguardando NF)'
  };

  try {
    const cps = _cpsLocal();
    cps.unshift(cp);
    localStorage.setItem('fa_contas_pagar', JSON.stringify(cps));
  } catch(e) {}

  try {
    await fetch('/api/contas-pagar', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(cp) });
  } catch(e) {}

  // Atualiza array local de contas
  if (window.FA_CONTAS_PAGAR) window.FA_CONTAS_PAGAR.unshift(cp);
}

// Helper: lê o array de contas a pagar do localStorage com fallback seguro.
function _cpsLocal() {
  try { return JSON.parse(localStorage.getItem('fa_contas_pagar') || '[]'); }
  catch(e) { return []; }
}

// Abertura de novo pedido com dados pré-preenchidos (do mapa de cotação)
function abrirNovoPedidoComDados(dados) {
  if (!dados) { openNovoPedido(); return; }
  openNovoPedido();
  setTimeout(() => {
    const desc = document.getElementById('np_desc');
    if (desc && dados.mapaId) desc.value = `Pedido baseado no Mapa ${dados.mapaId}`;
    if (dados.valor) {
      const valEl = document.getElementById('np_valor');
      if (valEl) valEl.value = dados.valor;
    }
  }, 150);
}

function exportPedidos() {
  const rows = [['Nº Pedido','Fornecedor','Descrição','Contrato','Valor','Emissão','Status']];
  FA_PEDIDOS.forEach(p => rows.push([p.numero, p.fornecedor_nome, p.descricao, p.contrato_id, p.valor_total, p.data_emissao, p.status]));
  const csv = rows.map(r => r.join(';')).join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(csv);
  a.download = 'pedidos_compra_fraser_alexander.csv';
  a.click();
  showToast('Relatório de pedidos exportado!', 'success');
}

// ═══════════════════════════════════════════════════════════
// MODAL PÓS-CRIAÇÃO: OPÇÕES DE PDF E ENVIO DE EMAIL
// ═══════════════════════════════════════════════════════════

function openModalPosCriacao(pedido, fornecedor) {
  const emailFor = fornecedor ? (fornecedor.contato_email || '') : '';
  const nomeFor  = fornecedor
    ? (fornecedor.nome_fantasia || fornecedor.razao_social || pedido.fornecedor_nome)
    : (pedido.fornecedor_nome || pedido.fornecedor || '—');

  const mc = document.getElementById('modalContainer');
  if (mc) mc.style.maxWidth = '640px';

  const itens = _pedidoGetItens(pedido);
  const itensSummary = itens.length > 0
    ? `<div style="margin-top:8px;border-top:1px solid var(--border);padding-top:8px">
        ${itens.slice(0, 4).map(i => `
          <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-secondary);padding:2px 0">
            <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:240px">${i.desc}</span>
            <span style="font-weight:600;color:var(--fa-teal);white-space:nowrap;margin-left:8px">${fmt(i.total)}</span>
          </div>`).join('')}
        ${itens.length > 4 ? `<div style="font-size:10px;color:var(--text-muted);margin-top:4px">+ ${itens.length - 4} item(ns) adicional(is)...</div>` : ''}
      </div>`
    : '';

  document.getElementById('modalTitle').textContent = `✅ Pedido ${pedido.numero} — Emitir ao Fornecedor`;
  document.getElementById('modalBody').innerHTML = `

    <!-- Painel resumo do pedido -->
    <div style="background:linear-gradient(135deg,rgba(0,180,184,0.08),rgba(230,126,34,0.05));border:1px solid rgba(0,180,184,0.25);border-radius:12px;padding:14px 16px;margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
        <div>
          <div style="font-size:18px;font-weight:800;color:var(--text-primary);letter-spacing:0.5px">${pedido.numero}</div>
          <div style="font-size:12px;color:var(--text-secondary);margin-top:3px">
            <i class="fas fa-building" style="color:var(--fa-teal);margin-right:5px"></i>${nomeFor}
          </div>
          ${pedido.rfq_numero ? `<div style="font-size:11px;color:var(--text-muted);margin-top:2px"><i class="fas fa-clipboard-list" style="margin-right:4px"></i>RFQ: ${pedido.rfq_numero}</div>` : ''}
          ${pedido.criterio_selecao ? `<div style="font-size:11px;color:var(--orange);margin-top:2px"><i class="fas fa-star" style="margin-right:4px"></i>Critério: ${pedido.criterio_selecao}</div>` : ''}
        </div>
        <div style="text-align:right">
          <div style="font-size:22px;font-weight:800;color:var(--fa-teal)">${fmt(pedido.valor_total)}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${pedido.cond_pagamento || 'Pgto. a definir'}</div>
          ${pedido.data_entrega_prev ? `<div style="font-size:11px;color:var(--text-muted)">Entrega: ${pedido.data_entrega_prev.includes('-') ? new Date(pedido.data_entrega_prev+'T12:00:00').toLocaleDateString('pt-BR') : pedido.data_entrega_prev}</div>` : ''}
        </div>
      </div>
      ${itensSummary}
    </div>

    <!-- Opções de envio -->
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:var(--text-muted);margin-bottom:10px">
      <i class="fas fa-share-alt" style="color:var(--fa-teal);margin-right:6px"></i>Escolha como emitir o pedido ao fornecedor:
    </div>

    <!-- Opção 1: E-mail via sistema -->
    <div style="margin-bottom:8px">
      <label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;padding:12px;border:1px solid var(--border);border-radius:8px;transition:all 0.2s" id="optEmailLabel" onclick="selectOpcaoEmail('sistema')">
        <input type="radio" name="opcaoEnvio" id="optSistema" value="sistema" style="margin-top:3px;accent-color:var(--fa-teal)">
        <div style="flex:1">
          <div style="font-weight:600;font-size:13px"><i class="fas fa-envelope" style="color:var(--fa-teal);margin-right:6px"></i>Enviar por e-mail ao fornecedor</div>
          <div style="font-size:11px;color:var(--text-secondary);margin-top:3px">Sistema registra o envio no log e gera o PDF para anexo.</div>
          <div style="margin-top:8px" id="campoEmailSistema">
            <div style="display:flex;gap:8px;align-items:center">
              <i class="fas fa-at" style="color:var(--text-muted);font-size:13px"></i>
              <input class="form-control" id="emailDestinatario" type="email"
                value="${emailFor}"
                placeholder="email@fornecedor.com.br"
                style="font-size:12px;flex:1"
                onclick="event.stopPropagation()">
            </div>
            ${emailFor
              ? `<div style="font-size:10px;color:var(--green-light);margin-top:4px"><i class="fas fa-check-circle"></i> E-mail do fornecedor detectado no cadastro</div>`
              : `<div style="font-size:10px;color:var(--orange);margin-top:4px"><i class="fas fa-exclamation-circle"></i> Informe o e-mail manualmente</div>`}
          </div>
        </div>
      </label>
    </div>

    <!-- Opção 2: Gerar PDF -->
    <div style="margin-bottom:8px">
      <label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;padding:12px;border:1px solid var(--border);border-radius:8px;transition:all 0.2s" id="optSalvarLabel" onclick="selectOpcaoEmail('salvar')">
        <input type="radio" name="opcaoEnvio" id="optSalvar" value="salvar" style="margin-top:3px;accent-color:var(--fa-teal)">
        <div>
          <div style="font-weight:600;font-size:13px"><i class="fas fa-file-pdf" style="color:#ef4444;margin-right:6px"></i>Gerar e baixar PDF</div>
          <div style="font-size:11px;color:var(--text-secondary);margin-top:3px">Abre o PDF em nova aba para impressão ou salvamento. Você envia ao fornecedor manualmente.</div>
        </div>
      </label>
    </div>

    <!-- Opção 3: Outro email -->
    <div style="margin-bottom:8px">
      <label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;padding:12px;border:1px solid var(--border);border-radius:8px;transition:all 0.2s" id="optOutroLabel" onclick="selectOpcaoEmail('outro')">
        <input type="radio" name="opcaoEnvio" id="optOutro" value="outro" style="margin-top:3px;accent-color:var(--fa-teal)">
        <div style="flex:1">
          <div style="font-weight:600;font-size:13px"><i class="fas fa-at" style="color:var(--orange);margin-right:6px"></i>Enviar para outro e-mail</div>
          <div style="font-size:11px;color:var(--text-secondary);margin-top:3px">Informe um endereço diferente do cadastrado no sistema</div>
          <div style="margin-top:8px" id="campoEmailOutro">
            <input class="form-control" id="emailManual" type="email"
              placeholder="destinatario@empresa.com.br"
              style="font-size:12px"
              onclick="event.stopPropagation()">
          </div>
        </div>
      </label>
    </div>

    <div style="font-size:11px;color:var(--text-muted);text-align:center;margin-top:4px">
      <i class="fas fa-info-circle" style="margin-right:4px"></i>O PDF pode ser gerado a qualquer momento em <strong>Pedidos → Ver Detalhes → Gerar PDF</strong>
    </div>
  `;

  document.getElementById('modalFooter').innerHTML = `
    <button class="btn btn-secondary" onclick="fecharModalPosCriacao()">
      <i class="fas fa-times"></i> Deixar para depois
    </button>
    <button class="btn btn-danger" onclick="gerarPdfPedido(FA_PEDIDOS.find(p=>p.id==='${pedido.id}'),true)" title="Gerar PDF agora">
      <i class="fas fa-file-pdf"></i> PDF
    </button>
    <button class="btn btn-primary" onclick="executarEnvioPedido('${pedido.id}')">
      <i class="fas fa-paper-plane"></i> Confirmar e Enviar
    </button>
  `;

  document.getElementById('globalModal').classList.add('show');

  // Pré-seleciona opção conforme disponibilidade do email
  if (emailFor) {
    selectOpcaoEmail('sistema');
  } else {
    selectOpcaoEmail('salvar');
  }

  // Guarda referência do pedido
  window._pedidoParaEnvio = pedido;

  _renderPedidosUI();
}


function selectOpcaoEmail(opcao) {
  // Marca o radio correto
  const radios = ['optSistema','optOutro','optSalvar'];
  radios.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.checked = (el.value === opcao);
  });

  // Destaca a label selecionada
  const labels = { sistema:'optEmailLabel', outro:'optOutroLabel', salvar:'optSalvarLabel' };
  Object.entries(labels).forEach(([k, id]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.borderColor = (k === opcao) ? 'var(--fa-teal)' : 'var(--border)';
    el.style.background   = (k === opcao) ? 'rgba(0,180,184,0.05)' : 'transparent';
  });

  // Mostra/esconde campos extras
  const campoSistema = document.getElementById('campoEmailSistema');
  const campoOutro   = document.getElementById('campoEmailOutro');
  if (campoSistema) campoSistema.style.display = (opcao === 'sistema') ? 'block' : 'none';
  if (campoOutro)   campoOutro.style.display   = (opcao === 'outro')   ? 'block' : 'none';
}

function fecharModalPosCriacao() {
  closeModal();
  showToast('Pedido salvo. Você pode baixar o PDF a qualquer momento em "Ver Detalhes".', 'info', 4000);
}

async function executarEnvioPedido(pedidoId) {
  const pedido = FA_PEDIDOS.find(p => p.id === pedidoId) || window._pedidoParaEnvio;
  if (!pedido) { closeModal(); return; }

  const opcaoSel = document.querySelector('input[name="opcaoEnvio"]:checked');
  const opcao    = opcaoSel ? opcaoSel.value : 'salvar';

  if (opcao === 'sistema') {
    const emailDest = document.getElementById('emailDestinatario')?.value?.trim();
    if (!emailDest || !emailDest.includes('@')) {
      showToast('Informe um e-mail válido para o destinatário', 'warning'); return;
    }
    closeModal();
    await _simularEnvioEmail(pedido, emailDest);
    _marcarEmailEnviado(pedido.id);
    gerarPdfPedido(pedido, false); // também baixa PDF localmente
  } else if (opcao === 'outro') {
    const emailMan = document.getElementById('emailManual')?.value?.trim();
    if (!emailMan || !emailMan.includes('@')) {
      showToast('Informe um e-mail válido', 'warning'); return;
    }
    closeModal();
    await _simularEnvioEmail(pedido, emailMan);
    _marcarEmailEnviado(pedido.id);
    gerarPdfPedido(pedido, false);
  } else {
    // Apenas salvar PDF
    closeModal();
    gerarPdfPedido(pedido, true);
    // Marca PDF como gerado (remove do banner de "aguardando envio")
    _marcarEmailEnviado(pedido.id);
  }
}

// Marca pedido como "envio concluído" para remover do banner de ação
function _marcarEmailEnviado(pedidoId) {
  const idx = FA_PEDIDOS.findIndex(p => p.id === pedidoId);
  if (idx >= 0) {
    FA_PEDIDOS[idx].email_enviado = true;
    // Persiste no localStorage
    try {
      const lista = JSON.parse(localStorage.getItem('fa_pedidos') || '[]');
      const li = lista.findIndex(p => p.id === pedidoId);
      if (li >= 0) lista[li].email_enviado = true;
      localStorage.setItem('fa_pedidos', JSON.stringify(lista));
    } catch(e) {}
    // Atualiza banner sem recarregar toda a tela
    setTimeout(_renderPedidosUI, 300);
  }
}

async function _simularEnvioEmail(pedido, destinatario) {
  let itens = [];
  try { itens = JSON.parse(pedido.itens || '[]'); } catch(e) {}

  // Simula envio (em produção Power Automate faria o envio real)
  showToast(`Enviando e-mail para ${destinatario}...`, 'info', 2000);

  await new Promise(r => setTimeout(r, 1500));

  // Log do envio
  logAction('Envio Email PC', 'Pedidos', `${pedido.numero} enviado para ${destinatario}`);
  showToast(`✅ E-mail enviado com sucesso para ${destinatario}!`, 'success', 5000);

  // Exibe prévia do email enviado
  _mostrarPreviaEmail(pedido, destinatario, itens);
}

function _mostrarPreviaEmail(pedido, destinatario, itensRaw) {
  const itens = _normalizarItens(Array.isArray(itensRaw) ? itensRaw : []);
  const dataEmissao = new Date().toLocaleDateString('pt-BR');
  const dataHora    = new Date().toLocaleString('pt-BR');
  const remetente   = currentUser ? currentUser.name : 'Compras Fraser Alexander';
  let dataEntrega   = pedido.data_entrega_prev || 'A combinar';
  if (dataEntrega.includes('-')) {
    try { dataEntrega = new Date(dataEntrega + 'T12:00:00').toLocaleDateString('pt-BR'); } catch(e) {}
  }

  openModalWide(`<i class="fas fa-envelope-open" style="color:var(--fa-teal);margin-right:8px"></i>Prévia do E-mail Enviado ao Fornecedor`, `

    <!-- Cabeçalho metadados do email -->
    <div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:10px;padding:14px 16px;margin-bottom:16px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <span class="badge badge-success" style="font-size:11px"><i class="fas fa-check-circle"></i> E-mail enviado com sucesso</span>
        <span style="font-size:10px;color:var(--text-muted);margin-left:auto">${dataHora}</span>
      </div>
      <div style="display:grid;grid-template-columns:auto 1fr;gap:4px 12px;font-size:11px">
        <span style="color:var(--text-muted);font-weight:600">De:</span>
        <span style="color:var(--text-primary)">compras@fraseralexander.com.br <span style="color:var(--text-muted)">(Fraser Alexander – Compras)</span></span>
        <span style="color:var(--text-muted);font-weight:600">Para:</span>
        <span style="color:var(--fa-teal);font-weight:600">${destinatario}</span>
        <span style="color:var(--text-muted);font-weight:600">Assunto:</span>
        <span style="color:var(--text-primary)"><strong>Pedido de Compra ${pedido.numero}</strong> — Fraser Alexander Mineração Ltda.</span>
        <span style="color:var(--text-muted);font-weight:600">Anexo:</span>
        <span style="color:var(--text-secondary)"><i class="fas fa-file-pdf" style="color:#ef4444;margin-right:4px"></i>Pedido_${pedido.numero}.pdf</span>
      </div>
    </div>

    <!-- Corpo do e-mail simulado -->
    <div style="border:1px solid var(--border-color);border-radius:10px;overflow:hidden">

      <!-- Header do email corpo -->
      <div style="background:linear-gradient(135deg,#0d1b2a,#1a3a5c);color:#fff;padding:14px 18px;display:flex;align-items:center;gap:12px">
        <div style="width:36px;height:36px;background:#e67e22;border-radius:6px;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-weight:900;font-size:14px">FA</div>
        <div>
          <div style="font-weight:800;font-size:13px">Fraser Alexander Mineração Ltda.</div>
          <div style="font-size:10px;color:rgba(255,255,255,0.6)">Departamento de Compras e Suprimentos</div>
        </div>
      </div>

      <!-- Conteúdo -->
      <div style="padding:20px 18px;background:var(--bg-card);color:var(--text-secondary);font-size:12px;line-height:1.8">

        <p style="margin-bottom:12px">Prezado(a) <strong style="color:var(--text-primary)">${pedido.fornecedor_nome||'Fornecedor'}</strong>,</p>

        <p style="margin-bottom:12px">
          Encaminhamos o <strong style="color:var(--fa-teal)">Pedido de Compra nº ${pedido.numero}</strong>, emitido em
          <strong>${dataEmissao}</strong>, conforme cotação aprovada. Solicitamos a confirmação do recebimento
          e do prazo de entrega.
        </p>

        <!-- Box resumo do pedido -->
        <div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;padding:14px;margin:14px 0">
          <div style="font-weight:700;color:var(--fa-teal);font-size:11px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px">
            <i class="fas fa-shopping-cart" style="margin-right:6px"></i>Resumo do Pedido
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:11px;margin-bottom:12px">
            <div><span style="color:var(--text-muted)">Nº do Pedido:</span> <strong style="color:var(--fa-teal)">${pedido.numero}</strong></div>
            <div><span style="color:var(--text-muted)">Data de Emissão:</span> <strong>${dataEmissao}</strong></div>
            <div><span style="color:var(--text-muted)">Entrega Prevista:</span> <strong style="color:var(--orange)">${dataEntrega}</strong></div>
            <div><span style="color:var(--text-muted)">Cond. Pagamento:</span> <strong>${pedido.cond_pagamento||'—'}</strong></div>
            <div><span style="color:var(--text-muted)">Contrato/CC:</span> <strong>${pedido.contrato_id||'—'}</strong></div>
            <div><span style="color:var(--text-muted)">Prioridade:</span> <strong>${pedido.prioridade||'Normal'}</strong></div>
          </div>

          <!-- Tabela de itens -->
          ${itens.length > 0 ? `
          <table style="width:100%;border-collapse:collapse;font-size:11px">
            <thead>
              <tr style="background:rgba(0,0,0,0.1)">
                <th style="padding:6px 8px;text-align:left;color:var(--text-muted);font-weight:600">#</th>
                <th style="padding:6px 8px;text-align:left;color:var(--text-muted);font-weight:600">Descrição</th>
                <th style="padding:6px 8px;text-align:center;color:var(--text-muted);font-weight:600">Qtd</th>
                <th style="padding:6px 8px;text-align:center;color:var(--text-muted);font-weight:600">Un</th>
                <th style="padding:6px 8px;text-align:right;color:var(--text-muted);font-weight:600">Unit.</th>
                <th style="padding:6px 8px;text-align:right;color:var(--text-muted);font-weight:600">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itens.map((i, idx) => `
                <tr style="border-bottom:1px solid var(--border-color)">
                  <td style="padding:5px 8px;color:var(--text-muted)">${String(idx+1).padStart(2,'0')}</td>
                  <td style="padding:5px 8px;color:var(--text-primary)">${i.desc}</td>
                  <td style="padding:5px 8px;text-align:center">${i.qtd}</td>
                  <td style="padding:5px 8px;text-align:center;color:var(--text-muted)">${i.un}</td>
                  <td style="padding:5px 8px;text-align:right">${fmt(i.preco)}</td>
                  <td style="padding:5px 8px;text-align:right;font-weight:700;color:var(--fa-teal)">${fmt(i.total)}</td>
                </tr>
              `).join('')}
              <tr style="background:rgba(0,180,184,0.08);border-top:2px solid rgba(0,180,184,0.3)">
                <td colspan="5" style="padding:8px;font-weight:700;text-align:right;color:var(--text-primary)">VALOR TOTAL</td>
                <td style="padding:8px;font-weight:800;font-size:13px;text-align:right;color:var(--fa-teal)">${fmt(pedido.valor_total)}</td>
              </tr>
            </tbody>
          </table>
          ` : `<p style="color:var(--text-muted);font-style:italic">${pedido.descricao}</p>
               <div style="font-size:13px;font-weight:700;color:var(--fa-teal);margin-top:6px">Total: ${fmt(pedido.valor_total)}</div>`}
        </div>

        ${pedido.observacoes ? `
        <div style="background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.3);border-radius:6px;padding:10px;margin:12px 0;font-size:11px">
          <strong style="color:var(--orange)"><i class="fas fa-sticky-note" style="margin-right:4px"></i>Observações:</strong>
          <span style="color:var(--text-secondary);margin-left:4px">${pedido.observacoes}</span>
        </div>
        ` : ''}

        <p style="margin-top:14px;margin-bottom:6px">
          Por favor, <strong>responda este e-mail</strong> confirmando o recebimento e o prazo de entrega acordado,
          ou entre em contato pelo telefone <strong>(31) 3000-0000</strong>.
        </p>
        <p style="margin-bottom:14px">O <strong>PDF completo do pedido</strong> está em anexo a este e-mail.</p>

        <div style="border-top:1px solid var(--border-color);padding-top:12px;font-size:11px;color:var(--text-muted)">
          Atenciosamente,<br>
          <strong style="color:var(--text-primary)">${remetente}</strong><br>
          Compras e Suprimentos — Fraser Alexander Mineração Ltda.<br>
          compras@fraseralexander.com.br · (31) 3000-0000
        </div>
      </div>
    </div>

  `, `
    <button class="btn btn-secondary" onclick="closeModal()"><i class="fas fa-times"></i> Fechar</button>
    <button class="btn btn-danger" onclick="gerarPdfPedido(FA_PEDIDOS.find(p=>p.id==='${pedido.id}')||FA_PEDIDOS.find(p=>p.numero==='${pedido.numero}'));closeModal()">
      <i class="fas fa-file-pdf"></i> Baixar PDF
    </button>
  `);
}

// ═══════════════════════════════════════════════════════════
// GERADOR DE PDF DO PEDIDO DE COMPRA
// ═══════════════════════════════════════════════════════════

function gerarPdfPedido(pedido, mostrarToast = true) {
  if (!pedido) { showToast('Pedido não encontrado', 'error'); return; }

  const itens = _pedidoGetItens(pedido);

  const dataAtual   = new Date().toLocaleDateString('pt-BR');
  const horaAtual   = new Date().toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
  const dataEmissao = pedido.data_emissao
    ? (pedido.data_emissao.includes('/')
        ? pedido.data_emissao
        : new Date(pedido.data_emissao + 'T00:00:00').toLocaleDateString('pt-BR'))
    : dataAtual;

  // Entrega prevista formatada
  let dataEntrega = 'A combinar';
  if (pedido.data_entrega_prev) {
    dataEntrega = pedido.data_entrega_prev.includes('-')
      ? new Date(pedido.data_entrega_prev + 'T12:00:00').toLocaleDateString('pt-BR')
      : pedido.data_entrega_prev;
  }

  // Dados do fornecedor (busca cadastro completo se disponível)
  let fornCNPJ = '—', fornContato = '—', fornCidade = '—', fornRazao = pedido.fornecedor_nome || '—';
  if (typeof FA_FORNECEDORES !== 'undefined') {
    const f = FA_FORNECEDORES.find(x =>
      x.id === (pedido.fornecedor_id || pedido.fornecedor) ||
      x.razao_social === pedido.fornecedor_nome ||
      x.nome_fantasia === pedido.fornecedor_nome
    );
    if (f) {
      fornRazao   = f.razao_social || f.nome_fantasia || pedido.fornecedor_nome;
      fornCNPJ    = f.cnpj || '—';
      fornContato = [f.contato_nome, f.contato_email, f.contato_fone].filter(Boolean).join(' · ') || '—';
      fornCidade  = [f.cidade, f.estado].filter(Boolean).join('/') || '—';
    }
  }

  // Histórico de aprovações (badge por etapa)
  const historico = Array.isArray(pedido.historico_aprovacoes) ? pedido.historico_aprovacoes : [];
  const historicoRows = historico.map((h, i) => `
    <tr style="border-bottom:1px solid #eee">
      <td style="padding:7px 10px;font-size:11px;color:#555">${String(i+1).padStart(2,'0')}</td>
      <td style="padding:7px 10px;font-size:11px;font-weight:600;color:#1a1a2e">${h.etapa || '—'}</td>
      <td style="padding:7px 10px;font-size:11px;color:#555">${h.aprovado_por || '—'}</td>
      <td style="padding:7px 10px;font-size:11px;color:#888">${h.data || '—'}</td>
    </tr>
  `).join('');

  // Monta linhas dos itens
  const itensRows = itens.length > 0
    ? itens.map((item, idx) => `
        <tr style="border-bottom:1px solid #e8e8e8;${idx%2===1?'background:#fafafa':''}">
          <td style="padding:9px 10px;color:#777;font-size:11px;text-align:center">${String(idx+1).padStart(2,'0')}</td>
          <td style="padding:9px 10px;font-size:12px;color:#1a1a1a">${item.desc}</td>
          <td style="padding:9px 10px;text-align:center;font-size:12px;color:#333">${Number(item.qtd).toLocaleString('pt-BR')}</td>
          <td style="padding:9px 10px;text-align:center;font-size:11px;color:#777">${item.un}</td>
          <td style="padding:9px 10px;text-align:right;font-size:12px;color:#333">R$&nbsp;${Number(item.preco).toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
          <td style="padding:9px 10px;text-align:right;font-weight:700;font-size:12px;color:#e67e22">R$&nbsp;${Number(item.total).toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
        </tr>
      `).join('')
    : `<tr><td colspan="6" style="padding:20px;text-align:center;color:#888;font-size:12px;font-style:italic">${pedido.descricao}</td></tr>`;

  // ── HTML DO PDF — Layout Profissional v4 ──────────────────────────────────
  const htmlPdf = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Pedido de Compra ${pedido.numero}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: 'Arial', Helvetica, sans-serif; background:#fff; color:#1a1a1a; font-size:13px; line-height:1.5; }

    /* ── CABEÇALHO ── */
    .header { background:linear-gradient(135deg,#0d1b2a 0%,#1a3a5c 100%); color:#fff; padding:0; display:flex; min-height:90px; }
    .header-accent { width:6px; background:linear-gradient(180deg,#e67e22,#f39c12); flex-shrink:0; }
    .header-body   { flex:1; padding:18px 28px; display:flex; align-items:center; justify-content:space-between; gap:20px; }
    .company-name  { font-size:24px; font-weight:900; letter-spacing:2px; color:#fff; }
    .company-tagline { font-size:10px; color:rgba(255,255,255,0.55); letter-spacing:0.5px; margin-top:3px; }
    .doc-badge { text-align:right; }
    .doc-badge-label { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:#e67e22; }
    .doc-badge-num { font-size:28px; font-weight:900; color:#fff; letter-spacing:1px; line-height:1.1; }
    .doc-badge-date { font-size:10px; color:rgba(255,255,255,0.5); margin-top:4px; }

    /* ── FAIXA DE STATUS ── */
    .status-bar { background:#f4f5f7; padding:7px 28px; display:flex; gap:8px; align-items:center; border-bottom:1px solid #dde0e5; flex-wrap:wrap; font-size:11px; }
    .badge { display:inline-flex; align-items:center; gap:4px; padding:3px 10px; border-radius:20px; font-size:10px; font-weight:700; border:1px solid; }
    .badge-verde    { background:#d1fae5; color:#065f46; border-color:#6ee7b7; }
    .badge-azul     { background:#dbeafe; color:#1e40af; border-color:#93c5fd; }
    .badge-amarelo  { background:#fef3c7; color:#92400e; border-color:#fcd34d; }
    .badge-vermelho { background:#fee2e2; color:#991b1b; border-color:#fca5a5; }
    .badge-cinza    { background:#f3f4f6; color:#374151; border-color:#d1d5db; }

    /* ── FAIXA RFQ/MAPA ── */
    .rfq-bar { background:#fffbeb; border-bottom:2px solid #f59e0b; padding:8px 28px; display:flex; gap:16px; align-items:center; flex-wrap:wrap; }
    .rfq-bar-label { font-size:10px; font-weight:800; text-transform:uppercase; color:#b45309; letter-spacing:0.5px; }
    .rfq-bar-item  { font-size:11px; color:#555; }
    .rfq-bar-item strong { color:#b45309; }
    .rfq-desconto  { font-size:11px; font-weight:700; color:#059669; margin-left:auto; }

    /* ── SEÇÕES ── */
    .section { padding:16px 28px; border-bottom:1px solid #eee; }
    .section-title { font-size:9px; font-weight:800; text-transform:uppercase; letter-spacing:1px; color:#94a3b8; margin-bottom:10px; display:flex; align-items:center; gap:6px; }
    .section-title::after { content:''; flex:1; height:1px; background:#eee; }
    .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
    .grid3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:16px; }
    .grid4 { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; }
    .field-label { font-size:9px; color:#94a3b8; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:3px; }
    .field-value { font-size:13px; font-weight:600; color:#1a1a2e; }
    .field-value.teal { color:#0891b2; }
    .field-value.orange { color:#ea580c; }
    .field-value.red  { color:#dc2626; }

    /* ── CAIXA FORNECEDOR ── */
    .forn-box { border:1px solid #e2e8f0; border-radius:8px; padding:14px; background:#f8fafc; }
    .forn-name { font-size:16px; font-weight:800; color:#0d1b2a; margin-bottom:4px; }
    .forn-detail { font-size:11px; color:#64748b; margin-top:2px; }

    /* ── TABELA DE ITENS ── */
    .items-table { width:100%; border-collapse:collapse; }
    .items-table thead tr { background:#0d1b2a; color:#fff; }
    .items-table thead th { padding:10px 10px; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; }
    .items-table thead th:nth-child(1) { text-align:center; width:36px; }
    .items-table thead th:nth-child(2) { text-align:left; }
    .items-table thead th:nth-child(3) { text-align:center; width:55px; }
    .items-table thead th:nth-child(4) { text-align:center; width:45px; }
    .items-table thead th:nth-child(5) { text-align:right; width:110px; }
    .items-table thead th:nth-child(6) { text-align:right; width:120px; }
    .items-table .total-row { background:#0d1b2a; color:#fff; }
    .items-table .total-row td { padding:11px 10px; font-size:14px; font-weight:800; }
    .items-table .total-row td:nth-child(2) { text-align:right; color:rgba(255,255,255,0.6); font-size:11px; font-weight:400; }
    .items-table .total-row td:last-child { text-align:right; color:#f59e0b; }

    /* ── OBSERVAÇÕES ── */
    .obs-box { background:#fffbeb; border:1px solid #fcd34d; border-radius:6px; padding:12px 16px; margin:0 28px 16px; }
    .obs-label { font-size:9px; font-weight:800; text-transform:uppercase; color:#b45309; letter-spacing:0.5px; margin-bottom:5px; }

    /* ── HISTÓRICO DE APROVAÇÕES ── */
    .hist-table { width:100%; border-collapse:collapse; font-size:11px; }
    .hist-table th { background:#f1f5f9; padding:7px 10px; text-align:left; font-size:9px; text-transform:uppercase; color:#64748b; border-bottom:1px solid #e2e8f0; }
    .hist-table td { padding:7px 10px; color:#334155; border-bottom:1px solid #f1f5f9; }

    /* ── ASSINATURAS ── */
    .sign-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:24px; padding:20px 28px 10px; }
    .sign-box { border-top:2px solid #0d1b2a; padding-top:8px; text-align:center; }
    .sign-name  { font-size:12px; font-weight:700; color:#0d1b2a; margin-top:4px; }
    .sign-title { font-size:10px; color:#64748b; }
    .sign-line  { height:32px; border-bottom:1px dashed #cbd5e1; margin-bottom:4px; }

    /* ── RODAPÉ ── */
    .footer { padding:12px 28px; background:#f8fafc; border-top:3px solid #e67e22; display:flex; justify-content:space-between; align-items:center; }
    .footer-l { font-size:10px; color:#64748b; line-height:1.7; }
    .footer-r { text-align:right; font-size:10px; color:#64748b; }
    .footer-r .num { color:#e67e22; font-weight:800; font-size:12px; }

    /* ── WATERMARK ── */
    .watermark { text-align:center; font-size:9px; color:#cbd5e1; padding:6px 28px; letter-spacing:0.5px; }

    /* ── PRINT ── */
    @media print {
      body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      .no-print { display:none !important; }
    }

    /* ── BOTÃO IMPRIMIR (apenas na tela) ── */
    .print-btn { position:fixed; top:16px; right:16px; background:#e67e22; color:#fff; border:none; padding:10px 20px; border-radius:8px; font-size:13px; font-weight:700; cursor:pointer; box-shadow:0 4px 12px rgba(0,0,0,0.2); z-index:999; display:flex; align-items:center; gap:8px; }
    .print-btn:hover { background:#d35400; }
    @media print { .print-btn { display:none; } }
  </style>
</head>
<body>

  <!-- BOTÃO IMPRIMIR (somente tela) -->
  <button class="print-btn no-print" onclick="window.print()">
    &#128438; Imprimir / Salvar PDF
  </button>

  <!-- ═══ CABEÇALHO ═══════════════════════════════════════════════════════ -->
  <div class="header">
    <div class="header-accent"></div>
    <div class="header-body">
      <div>
        <div class="company-name">FRASER ALEXANDER</div>
        <div class="company-tagline">Mineração Ltda. · CNPJ 00.000.000/0001-00</div>
        <div class="company-tagline">Av. Contorno, 1234 – Belo Horizonte / MG · (31) 3000-0000</div>
        <div class="company-tagline" style="margin-top:4px;color:rgba(255,255,255,0.4)">compras@fraseralexander.com.br</div>
      </div>
      <div class="doc-badge">
        <div class="doc-badge-label">Pedido de Compra</div>
        <div class="doc-badge-num">${pedido.numero}</div>
        <div class="doc-badge-date">Emitido em ${dataEmissao}</div>
      </div>
    </div>
  </div>

  <!-- ═══ FAIXA DE STATUS ══════════════════════════════════════════════════ -->
  <div class="status-bar">
    <span style="color:#64748b">Status:</span>
    <span class="badge ${pedido.status==='Emitido'||pedido.status==='Aprovado'?'badge-verde':pedido.status==='Cancelado'?'badge-vermelho':'badge-amarelo'}">
      ${pedido.status}
    </span>
    ${pedido.tipo_pedido ? `
      <span style="color:#64748b;margin-left:6px">Tipo:</span>
      <span class="badge badge-azul">${pedido.tipo_pedido}</span>
    ` : ''}
    <span style="color:#64748b;margin-left:6px">Prioridade:</span>
    <span class="badge ${pedido.prioridade==='Urgente'?'badge-vermelho':pedido.prioridade==='Alta'?'badge-amarelo':'badge-cinza'}">${pedido.prioridade||'Normal'}</span>
    ${pedido.cond_pagamento ? `
      <span style="color:#64748b;margin-left:6px">Pagamento:</span>
      <span class="badge ${pedido.cond_pagamento==='Antecipado'?'badge-vermelho':'badge-verde'}">${pedido.cond_pagamento}</span>
    ` : ''}
    <span style="margin-left:auto;color:#94a3b8;font-size:10px">
      Solicitante: <strong style="color:#334155">${pedido.solicitante||'—'}</strong>
      &nbsp;·&nbsp;
      Aprovador: <strong style="color:#334155">${pedido.aprovador||'Pendente'}</strong>
    </span>
  </div>

  <!-- ═══ BANNER RFQ / MAPA COMPARATIVO (quando aplicável) ════════════════ -->
  ${pedido.rfq_numero ? `
  <div class="rfq-bar">
    <span class="rfq-bar-label">&#128202; Origem: Mapa Comparativo Aprovado</span>
    <span class="rfq-bar-item">RFQ: <strong>${pedido.rfq_numero}</strong></span>
    ${pedido.matriz_id ? `<span class="rfq-bar-item">Mapa: <strong>${pedido.matriz_id}</strong></span>` : ''}
    ${pedido.criterio_selecao ? `<span class="rfq-bar-item">Critério de Seleção: <strong>${pedido.criterio_selecao}</strong></span>` : ''}
    ${pedido.desconto_aplicado && Number(pedido.desconto_aplicado) > 0 ? `<span class="rfq-desconto">&#10003; Desconto negociado: ${pedido.desconto_aplicado}%</span>` : ''}
  </div>
  ` : ''}

  <!-- ═══ DADOS DO FORNECEDOR ═════════════════════════════════════════════ -->
  <div class="section">
    <div class="section-title">Fornecedor</div>
    <div class="grid2">
      <div class="forn-box">
        <div class="forn-name">${pedido.fornecedor_nome||fornRazao}</div>
        ${fornRazao !== (pedido.fornecedor_nome||fornRazao) ? `<div class="forn-detail">Razão Social: ${fornRazao}</div>` : ''}
        <div class="forn-detail">CNPJ: ${fornCNPJ}</div>
        <div class="forn-detail">Contato: ${fornContato}</div>
        <div class="forn-detail">Localidade: ${fornCidade}</div>
        <div class="forn-detail" style="margin-top:6px;color:#94a3b8;font-size:10px">ID Cadastro: ${pedido.fornecedor_id||pedido.fornecedor||'—'}</div>
      </div>
      <div>
        <div class="grid2" style="gap:14px">
          <div>
            <div class="field-label">Contrato / Centro de Custo</div>
            <div class="field-value teal">${pedido.contrato_id||pedido.centro_custo||'—'}</div>
          </div>
          <div>
            <div class="field-label">Conta Contábil</div>
            <div class="field-value" style="font-size:11px">${pedido.conta_contabil||'—'}</div>
          </div>
          <div>
            <div class="field-label">Data de Emissão</div>
            <div class="field-value">${dataEmissao}</div>
          </div>
          <div>
            <div class="field-label">Entrega Prevista</div>
            <div class="field-value orange">${dataEntrega}</div>
          </div>
          ${pedido.cond_pagamento ? `
          <div style="grid-column:span 2">
            <div class="field-label">Condição de Pagamento</div>
            <div class="field-value ${pedido.cond_pagamento==='Antecipado'?'red':''}">${pedido.cond_pagamento}</div>
          </div>` : ''}
        </div>
      </div>
    </div>
  </div>

  <!-- ═══ DESCRIÇÃO DO OBJETO ════════════════════════════════════════════ -->
  <div style="padding:10px 28px 12px;background:#fffbf5;border-bottom:1px solid #eee">
    <span style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:0.7px;color:#94a3b8">Objeto do Pedido: </span>
    <span style="font-size:13px;font-weight:600;color:#1a1a2e">${pedido.descricao}</span>
  </div>

  <!-- ═══ TABELA DE ITENS ════════════════════════════════════════════════ -->
  <div style="padding:16px 0 0">
    <div style="padding:0 28px 10px;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;display:flex;align-items:center;gap:6px">
      Itens do Pedido
      <span style="flex:1;height:1px;background:#eee;display:block"></span>
    </div>
    <table class="items-table">
      <thead>
        <tr>
          <th>#</th>
          <th style="text-align:left">Descrição do Item / Produto / Serviço</th>
          <th>Qtd.</th>
          <th>Un.</th>
          <th style="text-align:right">Preço Unit.</th>
          <th style="text-align:right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itensRows}
        <tr class="total-row">
          <td></td>
          <td>VALOR TOTAL DO PEDIDO DE COMPRA</td>
          <td colspan="3"></td>
          <td style="text-align:right">R$&nbsp;${Number(pedido.valor_total).toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- ═══ OBSERVAÇÕES ══════════════════════════════════════════════════ -->
  ${pedido.observacoes ? `
  <div style="padding:14px 28px 4px">
    <div class="obs-box">
      <div class="obs-label">&#9888; Observações / Instruções Especiais</div>
      <div style="font-size:12px;color:#555;margin-top:4px">${pedido.observacoes}</div>
    </div>
  </div>
  ` : '<div style="height:12px"></div>'}

  <!-- ═══ HISTÓRICO DE APROVAÇÕES (se existir) ═══════════════════════ -->
  ${historico.length > 0 ? `
  <div class="section">
    <div class="section-title">Histórico de Aprovações</div>
    <table class="hist-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Etapa</th>
          <th>Responsável</th>
          <th>Data</th>
        </tr>
      </thead>
      <tbody>
        ${historicoRows}
      </tbody>
    </table>
  </div>
  ` : ''}

  <!-- ═══ ASSINATURAS ══════════════════════════════════════════════════ -->
  <div class="sign-grid">
    <div class="sign-box">
      <div class="sign-line"></div>
      <div class="sign-title">Solicitante</div>
      <div class="sign-name">${pedido.solicitante||'—'}</div>
    </div>
    <div class="sign-box">
      <div class="sign-line"></div>
      <div class="sign-title">Aprovado por</div>
      <div class="sign-name">${pedido.aprovador||'________________________________'}</div>
    </div>
    <div class="sign-box">
      <div class="sign-line"></div>
      <div class="sign-title">Recebido pelo Fornecedor</div>
      <div class="sign-name" style="color:#94a3b8">________________________________</div>
      <div style="font-size:10px;color:#94a3b8;margin-top:2px">Data: ____/____/________</div>
    </div>
  </div>

  <!-- ═══ RODAPÉ ════════════════════════════════════════════════════════ -->
  <div class="footer">
    <div class="footer-l">
      <div><strong style="color:#0d1b2a">Fraser Alexander Mineração Ltda.</strong></div>
      <div>CNPJ: 00.000.000/0001-00 · IE: 000.000.000/0000</div>
      <div>Av. Contorno, 1234 – Belo Horizonte / MG – CEP 30110-000</div>
      <div>compras@fraseralexander.com.br · (31) 3000-0000</div>
    </div>
    <div class="footer-r">
      <div>Documento gerado em ${dataAtual} às ${horaAtual}</div>
      <div>Sistema Fraser Alexander ERP v3.1</div>
      <div class="num" style="margin-top:4px">${pedido.numero}</div>
    </div>
  </div>
  <div class="watermark">
    Documento oficial de pedido de compra · Fraser Alexander Mineração Ltda.
    · Gerado automaticamente pelo sistema de gestão integrado · Não requer assinatura eletrônica para validade interna
  </div>

</body>
</html>`;

  // Abre janela de impressão/PDF
  const win = window.open('', '_blank', 'width=960,height=750,scrollbars=yes,resizable=yes');
  if (!win) {
    // Fallback: baixa como arquivo HTML
    const blob = new Blob([htmlPdf], { type: 'text/html;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `Pedido_${pedido.numero.replace(/[^a-zA-Z0-9-]/g,'_')}.html`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    showToast('⚠️ Pop-up bloqueado. PDF baixado como arquivo HTML. Abra e imprima com Ctrl+P.', 'warning', 7000);
    return;
  }
  win.document.write(htmlPdf);
  win.document.close();

  // Aguarda carregamento e abre diálogo de impressão
  win.onload = () => {
    setTimeout(() => {
      win.focus();
      win.print();
    }, 500);
  };

  if (mostrarToast) showToast(`📄 PDF do ${pedido.numero} aberto! Use <strong>Ctrl+P → Salvar como PDF</strong> para baixar.`, 'success', 6000);
  logAction('Geração PDF', 'Pedidos', `PDF gerado: ${pedido.numero}`);
}

// Atalho para gerar PDF a partir do ID
function gerarPdfPorId(id) {
  let p = FA_PEDIDOS.find(x => x.id === id);
  if (!p) {
    try {
      const local = JSON.parse(localStorage.getItem('fa_pedidos') || '[]');
      p = local.find(x => x.id === id);
    } catch(e) {}
  }
  if (p) gerarPdfPedido(p, true);
  else showToast('Pedido não encontrado para gerar PDF.', 'warning');
}

window._pedidoToggleEmergencia = _pedidoToggleEmergencia;
window.reprovarPedidoComMotivo = reprovarPedidoComMotivo;

// ── Toggle painel do aprovador ──
function _togglePainelAprovador() {
  const body = document.getElementById('painel-aprovador-body');
  const btn  = document.getElementById('btn-painel-aprov');
  if (!body) return;
  const visible = body.style.display !== 'none';
  body.style.display = visible ? 'none' : 'block';
  if (btn) btn.innerHTML = visible
    ? '<i class="fas fa-eye"></i> Ver Histórico'
    : '<i class="fas fa-eye-slash"></i> Ocultar';
}
window._togglePainelAprovador = _togglePainelAprovador;
window._pedidoAtualizarMotivoCustom = _pedidoAtualizarMotivoCustom;
window._confirmarReprovacao = _confirmarReprovacao;

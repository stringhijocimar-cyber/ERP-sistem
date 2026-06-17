// =====================================================
// Fraser Alexander ERP – Procurement Flow v4.0
// OS → Requisição → RFQ (Cotação) → Matriz Comparativa
//    → Aprovação → Emissão de Pedido(s) → Recebimento → CP
// =====================================================

// ─── STORAGE ───
function _getRFQs()   { try { return JSON.parse(localStorage.getItem('fa_rfqs') || '[]'); } catch(e) { return []; } }
function _saveRFQs(d) { localStorage.setItem('fa_rfqs', JSON.stringify(d)); }

/**
 * _mergeRFQs – mesclagem centralizada e robusta de fa_rfqs + fa_rfq_flow
 * Regras:
 *  1. Lê ambos os storages.
 *  2. Deduplica por ID (primeiro ocorrência vence, priorizando fa_rfqs).
 *  3. Para RFQs com mesmo número mas IDs diferentes, mantém o de status
 *     mais avançado (evita mostrar duplicados de versões diferentes).
 *  4. Normaliza campos obrigatórios: numero, fornecedores, status.
 *  5. Sincroniza ambos os storages para manter consistência.
 */
function _mergeRFQs() {
  const STATUS_ORDER = [
    'Aguardando Envio','Em Cotação','Aguardando Cotações','Negociando',
    'Cotações Recebidas','Mapa Criado','Mapa em Análise','Aprovada',
    'PC Emitido','Pedido Emitido','Cancelada'
  ];
  const statusRank = (s) => { const i = STATUS_ORDER.indexOf(s); return i >= 0 ? i : 99; };

  let rfqsProc = [];
  let rfqsFlow = [];
  try { rfqsProc = JSON.parse(localStorage.getItem('fa_rfqs')    || '[]'); } catch(e) { rfqsProc = []; }
  try { rfqsFlow = JSON.parse(localStorage.getItem('fa_rfq_flow')|| '[]'); } catch(e) { rfqsFlow = []; }

  // Constrói mapa por ID (fa_rfqs tem prioridade)
  const byId  = new Map();
  // Mapa por numero para detectar duplicatas cross-storage
  const byNum = new Map();

  const _norm = (r) => {
    // 'Aguardando Envio' foi removido do fluxo — qualquer RFQ nesse status
    // já passou pela aceitação do comprador, portanto é 'Em Cotação'
    let status = r.status || 'Em Cotação';
    if (status === 'Aguardando Envio') status = 'Em Cotação';
    return {
      ...r,
      numero:      r.numero      || r.numero_rfq || r.id,
      numero_rfq:  r.numero_rfq  || r.numero     || r.id,
      status,
      fornecedores: r.fornecedores || (r.fornecedores_detalhes||[]).map(f=>({...f}))
    };
  };

  // 1ª passagem: fa_rfqs (maior prioridade)
  rfqsProc.forEach(r => {
    const n = _norm(r);
    byId.set(n.id, n);
    if (!byNum.has(n.numero) || statusRank(n.status) > statusRank(byNum.get(n.numero).status)) {
      byNum.set(n.numero, n);
    }
  });

  // 2ª passagem: fa_rfq_flow (apenas adiciona o que não existe por ID)
  rfqsFlow.forEach(r => {
    const n = _norm(r);
    if (byId.has(n.id)) {
      // mesmo ID: mantém o de status mais avançado
      const existing = byId.get(n.id);
      if (statusRank(n.status) > statusRank(existing.status)) {
        byId.set(n.id, n);
        byNum.set(n.numero, n);
      }
      return;
    }
    // ID diferente mas mesmo número: é o mesmo processo, mantém o mais avançado
    if (byNum.has(n.numero)) {
      const existing = byNum.get(n.numero);
      if (statusRank(n.status) > statusRank(existing.status)) {
        byId.delete(existing.id);
        byId.set(n.id, n);
        byNum.set(n.numero, n);
      }
      return;
    }
    // Novo RFQ não existente em fa_rfqs — adiciona
    byId.set(n.id, n);
    byNum.set(n.numero, n);
  });

  // Resultado final ordenado por data de criação (mais recente primeiro)
  const merged = Array.from(byId.values()).sort((a,b) =>
    new Date(b.data_criacao||0) - new Date(a.data_criacao||0)
  );

  // Sincroniza fa_rfqs com o resultado mesclado para manter consistência
  try { localStorage.setItem('fa_rfqs', JSON.stringify(merged)); } catch(e) {}
  // Sincroniza fa_rfq_flow também
  try { localStorage.setItem('fa_rfq_flow', JSON.stringify(merged)); } catch(e) {}

  return merged;
}
function _getMatrizes() {
  try {
    // Lê de fa_matrizes (fonte principal), mescla com fa_mapas_comp e fa_mapas_comparativos
    const main  = JSON.parse(localStorage.getItem('fa_matrizes') || '[]');
    const comp  = JSON.parse(localStorage.getItem('fa_mapas_comp') || '[]');
    const comp2 = JSON.parse(localStorage.getItem('fa_mapas_comparativos') || '[]');
    // Recupera backup de mapas do usuário (preservados durante limpeza de cache)
    const backup = JSON.parse(localStorage.getItem('_fa_user_matrizes_backup') || '[]');
    const allExtra = [...comp, ...comp2, ...backup];
    if (!allExtra.length) return main;
    const ids = new Set(main.map(m => m.id));
    const extras = allExtra.filter(m => !ids.has(m.id));
    return extras.length ? [...main, ...extras] : main;
  } catch(e) { return []; }
}
function _saveMatrizes(d) {
  localStorage.setItem('fa_matrizes', JSON.stringify(d));
  // Sincroniza fa_mapas_comp e fa_mapas_comparativos para compatibilidade total
  localStorage.setItem('fa_mapas_comp', JSON.stringify(d));
  localStorage.setItem('fa_mapas_comparativos', JSON.stringify(d));
}

// ─── ALÇADA DE APROVAÇÃO ────────────────────────────────────────────────────
// Config padrão: limite USD 10.000, gerente aprova abaixo, General Manager acima
function _getAlcadaConfig() {
  try {
    const cfg = JSON.parse(localStorage.getItem('fa_alcada_config') || 'null');
    if (cfg) return cfg;
  } catch(e) {}
  // Defaults
  return {
    limite_usd:         10000,          // limite em USD
    perfil_gerente:     'diretor',      // profile que representa o Gerente
    nome_gerente:       'Gerente',      // label exibido
    perfil_gm:          'admin',        // profile que representa o General Manager
    nome_gm:            'General Manager',
    cotacao_manual:     null,           // null = busca automática; número = manual (R$/USD)
    cotacao_atualizada: null            // data da última atualização
  };
}
function _saveAlcadaConfig(cfg) { localStorage.setItem('fa_alcada_config', JSON.stringify(cfg)); }

// Cache da cotação USD para não buscar em toda chamada
let _usdCache = null;
// Expõe o cache globalmente para que o admin.js possa resetar
window._clearUsdCache = function() { _usdCache = null; };
async function _getCotacaoUSD() {
  // Retorna cotação R$/USD: manual > cache > API > fallback
  const cfg = _getAlcadaConfig();
  if (cfg.cotacao_manual && cfg.cotacao_manual > 0) return cfg.cotacao_manual;
  if (_usdCache && _usdCache.ts > Date.now() - 3600000) return _usdCache.val; // 1h cache
  try {
    const r = await fetch('https://economia.awesomeapi.com.br/last/USD-BRL');
    const j = await r.json();
    const val = parseFloat(j.USDBRL?.bid || 0);
    if (val > 0) {
      _usdCache = { val, ts: Date.now() };
      // Salva cotação e data na config para exibir no admin
      const c2 = _getAlcadaConfig();
      c2.cotacao_api      = val;
      c2.cotacao_atualizada = new Date().toLocaleString('pt-BR');
      _saveAlcadaConfig(c2);
      return val;
    }
  } catch(e) {}
  return _usdCache?.val || 5.70; // fallback conservador
}

// Retorna { podeAprovar, nivelNecessario, labelNecessario, limiteUSD, valorUSD, cotacao }
async function _verificarAlcada(valorBRL) {
  const cfg    = _getAlcadaConfig();
  const cotacao = await _getCotacaoUSD();
  const valorUSD = valorBRL / cotacao;
  const perfil   = currentUser?.profile || '';

  if (valorUSD <= cfg.limite_usd) {
    // Gerente pode aprovar
    const podeAprovar = [cfg.perfil_gerente, cfg.perfil_gm, 'admin'].includes(perfil);
    return { podeAprovar, nivelNecessario: 'gerente', labelNecessario: cfg.nome_gerente,
             limiteUSD: cfg.limite_usd, valorUSD, cotacao };
  } else {
    // Requer General Manager
    const podeAprovar = [cfg.perfil_gm, 'admin'].includes(perfil);
    return { podeAprovar, nivelNecessario: 'gm', labelNecessario: cfg.nome_gm,
             limiteUSD: cfg.limite_usd, valorUSD, cotacao };
  }
}
function _getRecebimentos()   { try { return JSON.parse(localStorage.getItem('fa_recebimentos') || '[]'); } catch(e) { return []; } }
function _saveRecebimentos(d) { localStorage.setItem('fa_recebimentos', JSON.stringify(d)); }
function _getAvaliacoesForn()   { try { return JSON.parse(localStorage.getItem('fa_avaliacoes_forn') || '[]'); } catch(e) { return []; } }
function _saveAvaliacoesForn(d) { localStorage.setItem('fa_avaliacoes_forn', JSON.stringify(d)); }

// ─── RFQ FLOW RENDERER ───
// ─── HELPERS PARA RCs DO FLUXO DE APROVAÇÃO ───
function _procGetRCs() {
  try { return JSON.parse(localStorage.getItem('fa_rcs') || '[]'); } catch(e) { return []; }
}
function _procSaveRCs(d) { localStorage.setItem('fa_rcs', JSON.stringify(d)); }

// ─── HELPER: resolve nome exibível do fornecedor ───
// Entrada: id string (cadastrado) ou nome manual
// Saída: "F1 – Nome Empresa" no cabeçalho ou "Nome Empresa (não cadastrado)"
function _rfqNomeForn(fornId) {
  if (!fornId) return 'Fornecedor';
  // Tenta resolver pelo FA_FORNECEDORES (global) ou localStorage
  let lista = [];
  try {
    if (typeof FA_FORNECEDORES !== 'undefined' && FA_FORNECEDORES.length > 0) {
      lista = FA_FORNECEDORES;
    } else {
      const raw = localStorage.getItem('fa_fornecedores_cache') || localStorage.getItem('fa_fornecedores');
      if (raw) lista = JSON.parse(raw);
    }
  } catch(e) { lista = []; }

  const f = lista.find(x => x.id === fornId || String(x.id) === String(fornId));
  if (f) {
    // Prioridade: nome_fantasia (se diferente da razao_social) → razao_social → nome
    const nomeFantasia = (f.nome_fantasia || '').trim();
    const razaoSocial  = (f.razao_social  || '').trim();
    const nomeGenerico = (f.nome          || '').trim();
    if (nomeFantasia && razaoSocial && nomeFantasia.toLowerCase() !== razaoSocial.toLowerCase()) {
      return `${nomeFantasia} (${razaoSocial})`;
    }
    return nomeFantasia || razaoSocial || nomeGenerico || fornId;
  }
  // Verifica se é um UUID/ID sem correspondência – não exibe o ID bruto
  if (typeof fornId === 'string' && fornId.length > 20 && /^[a-f0-9-]+$/i.test(fornId)) {
    return 'Fornecedor (não identificado)';
  }
  return fornId;
}

// Rótulo curto para cabeçalho: "F1 – Nome (14 chars)"
function _rfqLabelForn(fornId, idx) {
  const nome = _rfqNomeForn(fornId);
  const curto = nome.length > 18 ? nome.substring(0, 18) + '…' : nome;
  return `F${idx + 1} – ${curto}`;
}

// Rótulo completo para cards e seleções
function _rfqLabelFornFull(fornId, idx) {
  const nome = _rfqNomeForn(fornId);
  return `F${idx + 1}: ${nome}`;
}

// ─── HELPER: fornecedores cadastrados para autocomplete ────────────────────
function _rfqGetFornecedoresCadastrados() {
  try {
    const raw = localStorage.getItem('fa_fornecedores_cache');
    return raw ? JSON.parse(raw) : [];
  } catch(e) { return []; }
}

function renderRFQ() {
  // Perfis que podem gerenciar cotações (criar RFQ, selecionar fornecedores, aprovar mapa)
  const isCompras = currentUser && ['admin','compras','diretor'].includes(currentUser.profile);
  // Perfis que podem visualizar a aba (supervisores e operação também acompanham o processo)
  const podeVer   = currentUser && ['admin','compras','diretor','supervisor','operacao','gerente'].includes(currentUser.profile);
  if (!podeVer) {
    document.getElementById('mainContent').innerHTML = `
      <div class="empty-state" style="padding-top:80px">
        <i class="fas fa-lock" style="color:var(--red-light);font-size:48px"></i>
        <p style="margin-top:16px;font-size:16px;font-weight:600">Acesso Restrito</p>
        <p style="font-size:13px;color:var(--text-secondary)">Módulo de Cotações disponível apenas para Compras / Suprimentos.</p>
      </div>`;
    return;
  }

  // Mescla robusta de fa_rfqs + fa_rfq_flow (deduplicação por ID e número)
  const rfqs = _mergeRFQs();
  const rcs = _procGetRCs();
  // Apenas status que realmente aguardam ação do comprador
  const STATUS_AGUARDANDO = ['Aprovada – Aguardando Comprador'];
  const STATUS_JA_ACEITA  = ['Em Cotação','RFQ Criado','Aguardando Cotações','Negociando','Cotações Recebidas','Mapa Criado','Mapa Aprovado','PC Emitido','Pedido Emitido','Cancelada'];
  // Apenas RCs com pelo menos 1 item para cotação externa
  const rcsAguardandoComprador = rcs.filter(r =>
    STATUS_AGUARDANDO.includes(r.status) &&
    (r.itens || []).length > 0
  );

  // OS aprovadas aguardando emissão de RC pelo comprador (fluxo via OS)
  const fluxoOS = (() => { try { return JSON.parse(localStorage.getItem('fa_fluxo_os')||'[]'); } catch(e){ return []; } })();
  // Filtra OS aprovadas que ainda não têm RC emitida (status 'Aprovada – Aguardando Comprador')
  // Regra: excluir OS sem itens aprovados e OS de tipo 'Serviço Interno' (sem necessidade de cotação externa)
  const TIPOS_COTACAO_EXTERNA = ['Material', 'Misto', 'Serviço Externo'];
  const osAguardandoRC = fluxoOS.filter(f => {
    if (f.status !== 'Aprovada – Aguardando Comprador') return false;
    if (f.rcs_geradas && f.rcs_geradas.length > 0) return false;
    // Verifica se há ao menos 1 item aprovado
    const itensAprovados = (f.itens || []).filter(i => i.status_item === 'Aprovado');
    if (itensAprovados.length === 0) return false;
    // Exclui OS de serviço interno (não precisam de cotação externa)
    const tipo = (f.os_tipo_compra || '').trim();
    if (tipo && !TIPOS_COTACAO_EXTERNA.includes(tipo)) return false;
    return true;
  });
  // OS aprovadas que NÃO vão a cotação (serviço interno ou sem itens aprovados) – para exibir aviso informativo
  const osServInternoOuSemItens = fluxoOS.filter(f => {
    if (f.status !== 'Aprovada – Aguardando Comprador') return false;
    if (f.rcs_geradas && f.rcs_geradas.length > 0) return false;
    const itensAprovados = (f.itens || []).filter(i => i.status_item === 'Aprovado');
    const tipo = (f.os_tipo_compra || '').trim();
    // Inclui se não tem itens aprovados OU se é serviço interno
    return itensAprovados.length === 0 || (tipo && !TIPOS_COTACAO_EXTERNA.includes(tipo));
  });

  // 'Aguardando Envio' e 'Em Cotação' são ambos considerados ativos
  const rfqsAbertos = rfqs.filter(r => ['Em Cotação','Cotações Recebidas','Aguardando Cotações','Negociando','Mapa Criado','Mapa em Análise'].includes(r.status));
  const rfqsAprovados = rfqs.filter(r => r.status === 'Aprovada' || r.status === 'Pedido Emitido');

  document.getElementById('mainContent').innerHTML = `
    <div class="page-header">
      <div class="page-title">
        <h2><i class="fas fa-file-signature" style="color:var(--fa-teal);margin-right:8px"></i>Cotações (RFQ)</h2>
        <p>Processo de cotação, seleção de fornecedores e emissão de pedidos</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary btn-sm" onclick="exportRFQs()"><i class="fas fa-download"></i> Exportar</button>
        <button class="btn btn-primary btn-sm" onclick="novoProcessoRFQ()"><i class="fas fa-plus"></i> Novo Processo</button>
        <!-- MELHORIA 2: Botão de emissão removido desta aba - use aba Pedidos de Compra -->
      </div>
      <!-- AVISO INFORMATIVO -->
      <div class="proc-info-banner" style="background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.25);border-radius:10px;padding:10px 16px;margin-bottom:16px;font-size:12px">
        <i class="fas fa-info-circle" style="color:#3b82f6;font-size:14px;flex-shrink:0"></i>
        <span style="color:var(--text-secondary)">
          <strong>Esta aba é exclusiva para gestão de cotações.</strong>
          Para emitir Pedido de Compra após aprovação do Mapa, acesse
          <a href="#" onclick="navigate('pedidos')" style="color:#3b82f6;font-weight:700"><i class="fas fa-file-invoice" style="margin:0 3px"></i>Pedidos de Compra</a>.
        </span>
      </div>
    </div>

    <!-- KPIs -->
    <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px">
      <div class="kpi-card kpi-orange" style="cursor:${(rcsAguardandoComprador.length+osAguardandoRC.length)>0?'pointer':'default'}" onclick="${(rcsAguardandoComprador.length+osAguardandoRC.length)>0?'document.getElementById(\'sec-pendentes\').scrollIntoView({behavior:\'smooth\'})':''}">
        <div class="kpi-icon"><i class="fas fa-inbox"></i></div>
        <div class="kpi-value">${rcsAguardandoComprador.length + osAguardandoRC.length}</div>
        <div class="kpi-label">Pendentes p/ Comprador</div>
      </div>
      <div class="kpi-card kpi-blue">
        <div class="kpi-icon"><i class="fas fa-paper-plane"></i></div>
        <div class="kpi-value">${rfqsAbertos.length}</div>
        <div class="kpi-label">Cotações em Andamento</div>
      </div>
      <div class="kpi-card kpi-teal">
        <div class="kpi-icon"><i class="fas fa-balance-scale"></i></div>
        <div class="kpi-value">${rfqs.filter(r=>r.status==='Aprovada').length}</div>
        <div class="kpi-label">Mapas Aprovados</div>
      </div>
      <div class="kpi-card kpi-green">
        <div class="kpi-icon"><i class="fas fa-check-circle"></i></div>
        <div class="kpi-value">${rfqsAprovados.length}</div>
        <div class="kpi-label">Pedidos Emitidos</div>
      </div>
    </div>

    <!-- Alertas: RFQs ociosas > 15 dias -->
    <div id="rfq_alertas_ociosas"></div>

    <!-- SEÇÃO UNIFICADA: Pendentes para o Comprador (OS aprovadas + RCs avulsas) -->
    ${(rcsAguardandoComprador.length + osAguardandoRC.length) > 0 ? `
      <div id="sec-pendentes" class="card" style="margin-bottom:16px;border-left:4px solid #f59e0b">
        <div class="card-header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
          <h3 style="margin:0">
            <i class="fas fa-inbox" style="color:#f59e0b;margin-right:8px"></i>
            Pendentes – Aguardando Ação do Comprador
          </h3>
          <span style="font-size:11px;color:var(--text-muted);background:var(--bg-tertiary);padding:3px 10px;border-radius:10px">
            ${rcsAguardandoComprador.length + osAguardandoRC.length} item(s)
          </span>
        </div>
        <div style="padding:8px 16px;font-size:12px;color:var(--text-muted)">
          <i class="fas fa-info-circle" style="color:#3b82f6;margin-right:4px"></i>
          Clique em <strong style="color:#f59e0b">Iniciar Cotação</strong> para selecionar fornecedores e criar o RFQ.
        </div>

        <!-- VERSÃO MOBILE: cartões empilhados -->
        <div class="pend-card-list">
          ${rcsAguardandoComprador.map(rc => {
            const valorRC = (rc.itens||[]).reduce((s,i)=>s+(parseFloat(i.valor_unit||i.preco_unit||0)*parseFloat(i.qtd||i.quantidade||1)),0);
            return `
            <div class="pend-mob-card">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
                <div>
                  <div class="pend-mob-card-num">${rc.numero || rc.id}
                    ${rc.os_id || rc.os_vinculada ? `<span style="color:#8b5cf6;font-size:10px;margin-left:6px"><i class="fas fa-link"></i> ${rc.os_id||rc.os_vinculada}</span>` : '<span style="font-size:10px;color:var(--text-muted);margin-left:6px">RC avulsa</span>'}
                  </div>
                  <div class="pend-mob-card-title">${rc.titulo || rc.descricao || '(sem título)'}</div>
                </div>
                <div style="text-align:right;font-size:11px;color:var(--text-muted)">
                  <div style="font-weight:700;color:var(--fa-teal)">${valorRC > 0 ? fmt(valorRC) : '—'}</div>
                  <div>${(rc.itens||[]).length} item(s)</div>
                </div>
              </div>
              <div class="pend-mob-card-actions">
                <button onclick="verDetalheRC_RFQ('${rc.id}')" class="btn btn-secondary btn-sm"><i class="fas fa-eye"></i> Ver</button>
                <button onclick="aceitarRC_Comprador('${rc.id}')" class="btn btn-sm" style="background:#f59e0b;color:#000;border-color:#f59e0b;font-weight:700"><i class="fas fa-play"></i> Iniciar</button>
                <button onclick="rejeitarRC_Comprador('${rc.id}')" class="btn btn-danger btn-sm"><i class="fas fa-undo"></i></button>
              </div>
            </div>`;
          }).join('')}
          ${osAguardandoRC.map(f => {
            const itensAprov = (f.itens||[]).filter(i => i.status_item === 'Aprovado');
            const totalOS = itensAprov.reduce((s,i)=>s+(parseFloat(i.valor_unit||0)*parseFloat(i.qtd||1)),0);
            return `
            <div class="pend-mob-card" style="border-left-color:#8b5cf6;border-color:rgba(139,92,246,.3)">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
                <div>
                  <div class="pend-mob-card-num" style="color:#8b5cf6">${f.os_id || f.id}
                    <span style="font-size:10px;color:var(--text-muted);margin-left:6px">via OS</span>
                  </div>
                  <div class="pend-mob-card-title">${f.os_descricao || f.descricao || '(sem descrição)'}</div>
                  ${f.os_contrato ? `<div style="font-size:10px;color:var(--text-muted)">${f.os_contrato}</div>` : ''}
                </div>
                <div style="text-align:right;font-size:11px;color:var(--text-muted)">
                  <div style="font-weight:700;color:var(--fa-teal)">${totalOS > 0 ? fmt(totalOS) : '—'}</div>
                  <div>${itensAprov.length} item(s)</div>
                </div>
              </div>
              <div class="pend-mob-card-actions">
                <button onclick="_procEmitirRCdaOS('${f.id}')" class="btn btn-sm" style="background:#8b5cf6;color:#fff;border-color:#8b5cf6;font-weight:700;flex:1"><i class="fas fa-play"></i> Iniciar Cotação</button>
              </div>
            </div>`;
          }).join('')}
        </div>

        <!-- VERSÃO DESKTOP: tabela -->
        <div style="overflow-x:auto;-webkit-overflow-scrolling:touch">
          <table style="width:100%;border-collapse:collapse;font-size:13px;min-width:580px">
            <thead><tr style="background:var(--bg-tertiary)">
              <th style="padding:9px 12px;text-align:left;color:var(--text-secondary);font-size:11px">Nº / OS</th>
              <th style="padding:9px 12px;text-align:left;color:var(--text-secondary);font-size:11px">Descrição</th>
              <th style="padding:9px 12px;text-align:left;color:var(--text-secondary);font-size:11px">Solicitante</th>
              <th style="padding:9px 12px;text-align:center;color:var(--text-secondary);font-size:11px">Itens</th>
              <th style="padding:9px 12px;text-align:right;color:var(--text-secondary);font-size:11px">Valor Est.</th>
              <th style="padding:9px 12px;text-align:center;color:var(--text-secondary);font-size:11px">Ações</th>
            </tr></thead>
            <tbody>
              ${rcsAguardandoComprador.map(rc => {
                const valorRC = (rc.itens||[]).reduce((s,i)=>s+(parseFloat(i.valor_unit||i.preco_unit||0)*parseFloat(i.qtd||i.quantidade||1)),0);
                return `
                <tr style="border-bottom:1px solid var(--border-color)" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='transparent'">
                  <td style="padding:9px 12px">
                    <div style="font-weight:700;color:#f59e0b">${rc.numero || rc.id}</div>
                    ${rc.os_id || rc.os_vinculada ? `<div style="font-size:11px;color:#8b5cf6"><i class="fas fa-link" style="margin-right:3px"></i>${rc.os_id || rc.os_vinculada}</div>` : '<div style="font-size:11px;color:var(--text-muted)">RC avulsa</div>'}
                  </td>
                  <td style="padding:9px 12px"><div style="font-weight:600;color:var(--text-primary)">${rc.titulo || rc.descricao || '(sem título)'}</div></td>
                  <td style="padding:9px 12px;color:var(--text-secondary);font-size:12px">${rc.criado_por || rc.solicitante || '—'}</td>
                  <td style="padding:9px 12px;text-align:center;font-weight:600;color:var(--fa-teal)">${(rc.itens||[]).length}</td>
                  <td style="padding:9px 12px;text-align:right;font-weight:600">${valorRC > 0 ? fmt(valorRC) : '—'}</td>
                  <td style="padding:9px 12px;text-align:center">
                    <button onclick="verDetalheRC_RFQ('${rc.id}')" class="btn btn-secondary btn-sm" style="margin:2px" title="Ver detalhes"><i class="fas fa-eye"></i></button>
                    <button onclick="aceitarRC_Comprador('${rc.id}')" class="btn btn-primary btn-sm" style="margin:2px;background:#f59e0b;border-color:#f59e0b"><i class="fas fa-play"></i> Iniciar</button>
                    <button onclick="rejeitarRC_Comprador('${rc.id}')" class="btn btn-danger btn-sm" style="margin:2px" title="Devolver RC"><i class="fas fa-undo"></i></button>
                  </td>
                </tr>`;
              }).join('')}
              ${osAguardandoRC.map(f => {
                const itensAprov = (f.itens||[]).filter(i => i.status_item === 'Aprovado');
                const totalOS = itensAprov.reduce((s,i)=>s+(parseFloat(i.valor_unit||0)*parseFloat(i.qtd||1)),0);
                return `
                <tr style="border-bottom:1px solid var(--border-color)" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='transparent'">
                  <td style="padding:9px 12px">
                    <div style="font-weight:700;color:#8b5cf6">${f.os_id || f.id}</div>
                    <div style="font-size:11px;color:var(--text-muted)">via OS</div>
                  </td>
                  <td style="padding:9px 12px">
                    <div style="font-weight:600;color:var(--text-primary)">${f.os_descricao || f.descricao || '(sem descrição)'}</div>
                    <div style="font-size:11px;color:var(--text-muted)">${f.os_contrato || f.contrato || ''}</div>
                  </td>
                  <td style="padding:9px 12px;color:var(--text-secondary);font-size:12px">${f.criado_por || f.solicitante || '—'}</td>
                  <td style="padding:9px 12px;text-align:center;font-weight:600;color:var(--fa-teal)">${itensAprov.length}</td>
                  <td style="padding:9px 12px;text-align:right;font-weight:600">${totalOS > 0 ? fmt(totalOS) : '—'}</td>
                  <td style="padding:9px 12px;text-align:center">
                    <button onclick="_procEmitirRCdaOS('${f.id}')" class="btn btn-primary btn-sm" style="background:#f59e0b;border-color:#f59e0b"><i class="fas fa-play"></i> Iniciar</button>
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    ` : `
      <div style="background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.2);border-radius:10px;padding:12px 16px;margin-bottom:16px;display:flex;align-items:center;gap:10px;font-size:13px">
        <i class="fas fa-check-circle" style="color:#22c55e;font-size:16px;flex-shrink:0"></i>
        <span style="color:var(--text-secondary)">Nenhuma requisição pendente de ação do comprador no momento.</span>
      </div>
    `}

    <!-- Aviso: OS de Serviço Interno ou sem itens aprovados (não vão a cotação) -->
    ${osServInternoOuSemItens.length > 0 ? `
      <div style="background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.25);border-radius:10px;padding:10px 16px;margin-bottom:14px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <i class="fas fa-info-circle" style="color:#6366f1;font-size:14px;flex-shrink:0"></i>
          <strong style="font-size:12px;color:#6366f1">${osServInternoOuSemItens.length} OS aprovada(s) sem necessidade de cotação externa</strong>
        </div>
        <div style="font-size:11px;color:var(--text-muted);padding-left:22px">
          ${osServInternoOuSemItens.map(f => {
            const tipo = f.os_tipo_compra || 'Sem tipo';
            const itensAprov = (f.itens||[]).filter(i => i.status_item === 'Aprovado').length;
            const motivo = itensAprov === 0 ? 'sem itens aprovados' : 'tipo: ' + tipo;
            return '<div style="padding:2px 0"><i class="fas fa-minus-circle" style="color:#a78bfa;margin-right:4px"></i><strong>' + (f.os_id||f.id) + '</strong> – ' + (f.os_descricao||f.descricao||'(sem descrição)') + ' <span style="color:#a78bfa">(' + motivo + ')</span></div>';
          }).join('')}
        </div>
      </div>
    ` : ''}

    <!-- Tabs -->
    <div class="card">
      <div class="rfq-tabs-wrap" style="border-bottom:1px solid var(--border-color)">
        <div style="display:flex;gap:0;min-width:max-content">
          ${['em_cotacao','mapa_aprovado','emitidas'].map((t,i) => `
            <button onclick="switchRFQTab('${t}')" id="rfq-tab-${t}" style="padding:11px 16px;border:none;background:${i===0?'var(--bg-tertiary)':'transparent'};color:${i===0?'var(--fa-teal)':'var(--text-secondary)'};font-weight:${i===0?'600':'400'};border-bottom:${i===0?'2px solid var(--fa-teal)':'2px solid transparent'};cursor:pointer;font-size:13px;white-space:nowrap;flex-shrink:0">
              <i class="fas fa-${['paper-plane','balance-scale','shopping-bag'][i]}" style="margin-right:5px"></i>
              ${'Em Cotação (RFQ),Mapa Aprovado,Pedidos Emitidos'.split(',')[i]}
              <span style="background:var(--bg-primary);border-radius:10px;padding:1px 7px;font-size:11px;margin-left:4px">${[
                rfqs.filter(r=>!['Aprovada','Pedido Emitido','Cancelada'].includes(r.status)).length,
                rfqs.filter(r=>r.status==='Aprovada').length,
                rfqs.filter(r=>r.status==='Pedido Emitido').length
              ][i]}</span>
            </button>
          `).join('')}
        </div>
      </div>
      <div id="rfq-tab-content" style="padding:16px">
        ${_renderRFQTable(rfqs.filter(r=>!['Aprovada','Pedido Emitido','Cancelada'].includes(r.status)),'em_cotacao')}
      </div>
    </div>
  `;
  // Injeta alertas de RFQs ociosas após renderizar o HTML
  _rfqRenderAlertasOciosas('rfq_alertas_ociosas');
}

function switchRFQTab(tab) {
  ['em_cotacao','mapa_aprovado','emitidas'].forEach(t => {
    const btn = document.getElementById(`rfq-tab-${t}`);
    if (!btn) return;
    const active = t === tab;
    btn.style.background = active ? 'var(--bg-tertiary)' : 'transparent';
    btn.style.color = active ? 'var(--fa-teal)' : 'var(--text-secondary)';
    btn.style.fontWeight = active ? '600' : '400';
    btn.style.borderBottom = active ? '2px solid var(--fa-teal)' : '2px solid transparent';
  });
  // Mescla robusta de fa_rfqs + fa_rfq_flow
  const rfqs = _mergeRFQs(); // qualquer status exceto Aprovada/Pedido Emitido/Cancelada
  const filterFn = {
    'em_cotacao':    r => !['Aprovada','Pedido Emitido','Cancelada'].includes(r.status),
    'mapa_aprovado': r => r.status === 'Aprovada',
    'emitidas':      r => r.status === 'Pedido Emitido'
  };
  const content = document.getElementById('rfq-tab-content');
  if (content) content.innerHTML = _renderRFQTable(rfqs.filter(filterFn[tab] || (() => false)), tab);
}

function _renderRFQTable(rfqs, tabId) {
  if (!rfqs.length) return `<div style="text-align:center;padding:40px;color:var(--text-muted)"><i class="fas fa-inbox" style="font-size:32px;margin-bottom:12px;display:block"></i>Nenhum processo nesta etapa.</div>`;

  // ── Helper de ações por status ──────────────────────────────────────────────
  const _acoes = (r) => `
    <button onclick="verDetalheRFQ('${r.id}')" class="btn btn-sm btn-secondary" title="Ver detalhe"><i class="fas fa-eye"></i></button>
    ${r.status === 'Aguardando Envio' ? `<button onclick="selecionarFornecedoresRFQ('${r.id}')" class="btn btn-sm btn-warning" title="Definir fornecedores"><i class="fas fa-users"></i> <span class="btn-lbl">Fornecedores</span></button>` : ''}
    ${['Em Cotação','Aguardando Cotações','Aguardando Envio','Negociando'].includes(r.status) ? `<button onclick="_procEnviarEmailRFQ('${r.id}')" class="btn btn-sm btn-primary" title="Enviar por e-mail / PDF"><i class="fas fa-envelope"></i> <span class="btn-lbl">E-mail</span></button>` : ''}
    ${['Em Cotação','Aguardando Cotações','Cotações Recebidas','Mapa em Análise','Negociando'].includes(r.status) ? `<button onclick="registrarCotacoes('${r.id}')" class="btn btn-sm btn-info" title="Registrar / Editar cotações"><i class="fas fa-pencil-alt"></i> <span class="btn-lbl">Cotar</span></button>` : ''}
    ${['Cotações Recebidas','Mapa Criado'].includes(r.status) ? `<button onclick="abrirMatrizComparativa('${r.id}')" class="btn btn-sm btn-secondary" title="Abrir mapa comparativo" style="background:var(--bg-tertiary)"><i class="fas fa-balance-scale"></i> <span class="btn-lbl">Mapa</span></button>` : ''}
    ${r.status === 'Mapa em Análise' ? `<button onclick="abrirMatrizComparativa('${r.id}')" class="btn btn-sm btn-secondary" title="Ver/editar mapa em análise"><i class="fas fa-eye"></i> <span class="btn-lbl">Mapa</span></button>` : ''}
    ${r.status === 'Aprovada' ? `<button onclick="navigate('pedidos')" class="btn btn-sm" style="background:rgba(59,130,246,0.1);color:#3b82f6;border:1px solid rgba(59,130,246,0.3)"><i class="fas fa-arrow-right"></i> <span class="btn-lbl">Pedidos</span></button>` : ''}
  `;

  // ── VERSÃO MOBILE: lista de cartões ─────────────────────────────────────────
  const cartoesHtml = `
    <div class="rfq-card-list">
      ${rfqs.map(r => `
        <div class="rfq-mob-card">
          <div class="rfq-mob-card-head">
            <div>
              <div class="rfq-mob-card-num">${r.numero || r.numero_rfq || r.id}</div>
              <div class="rfq-mob-card-title">${r.titulo || '—'}</div>
            </div>
            <div>${_rfqStatusBadge(r.status)}</div>
          </div>
          <div class="rfq-mob-card-meta">
            <div class="rfq-mob-card-meta-item">
              <span class="rfq-mob-card-meta-label">Contrato / RC</span>
              <span class="rfq-mob-card-meta-val">${r.rc_numero || r.contrato || '—'}</span>
            </div>
            <div class="rfq-mob-card-meta-item">
              <span class="rfq-mob-card-meta-label">Fornecedores</span>
              <span class="rfq-mob-card-meta-val">${(r.fornecedores||r.fornecedores_convidados||[]).length} conv.</span>
            </div>
            <div class="rfq-mob-card-meta-item">
              <span class="rfq-mob-card-meta-label">Valor Est.</span>
              <span class="rfq-mob-card-meta-val" style="color:var(--fa-teal)">${fmt(r.valor_estimado || r.valor_total || 0)}</span>
            </div>
            <div class="rfq-mob-card-meta-item">
              <span class="rfq-mob-card-meta-label">Prazo</span>
              <span class="rfq-mob-card-meta-val">${r.prazo_cotacao || '—'}</span>
            </div>
          </div>
          <div class="rfq-mob-card-actions">
            ${_acoes(r)}
          </div>
        </div>
      `).join('')}
    </div>
  `;

  // ── VERSÃO DESKTOP: tabela ───────────────────────────────────────────────────
  const tabelaHtml = `
    <div class="rfq-mob-table-wrap" style="overflow-x:auto;-webkit-overflow-scrolling:touch">
      <table style="width:100%;border-collapse:collapse;font-size:13px;min-width:680px">
        <thead>
          <tr style="background:var(--bg-tertiary)">
            <th style="padding:9px 12px;text-align:left;color:var(--text-secondary);font-size:11px">Nº Processo</th>
            <th style="padding:9px 12px;text-align:left;color:var(--text-secondary);font-size:11px">Título</th>
            <th style="padding:9px 12px;text-align:left;color:var(--text-secondary);font-size:11px">Contrato</th>
            <th style="padding:9px 12px;text-align:center;color:var(--text-secondary);font-size:11px">Fornecedores</th>
            <th style="padding:9px 12px;text-align:right;color:var(--text-secondary);font-size:11px">Valor Est.</th>
            <th style="padding:9px 12px;text-align:center;color:var(--text-secondary);font-size:11px">Prazo</th>
            <th style="padding:9px 12px;text-align:center;color:var(--text-secondary);font-size:11px">Status</th>
            <th style="padding:9px 12px;text-align:center;color:var(--text-secondary);font-size:11px">Ações</th>
          </tr>
        </thead>
        <tbody>
          ${rfqs.map(r => `
            <tr style="border-bottom:1px solid var(--border-color)" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='transparent'">
              <td style="padding:9px 12px;font-weight:600;color:var(--fa-teal)">${r.numero || r.numero_rfq || r.id}</td>
              <td style="padding:9px 12px;color:var(--text-primary)">${r.titulo || '—'}</td>
              <td style="padding:9px 12px;color:var(--text-muted);font-size:12px">${r.rc_numero || r.contrato || '—'}</td>
              <td style="padding:9px 12px;text-align:center">
                ${(r.fornecedores||r.fornecedores_convidados||[]).length} conv.
                ${r.status === 'Aguardando Envio' ? `<div style="font-size:10px;color:#f59e0b"><i class="fas fa-users" style="margin-right:2px"></i>Def. fornec.</div>` : ''}
                ${r.status === 'Em Cotação' ? `<div style="font-size:10px;color:#3b82f6"><i class="fas fa-paper-plane" style="margin-right:2px"></i>Em cotação</div>` : ''}
              </td>
              <td style="padding:9px 12px;text-align:right;font-weight:600">${fmt(r.valor_estimado || r.valor_total || 0)}</td>
              <td style="padding:9px 12px;text-align:center;color:var(--text-muted);font-size:12px">${r.prazo_cotacao || '—'}</td>
              <td style="padding:9px 12px;text-align:center">${_rfqStatusBadge(r.status)}</td>
              <td style="padding:9px 12px;text-align:center">
                <div style="display:flex;gap:4px;justify-content:center;flex-wrap:wrap">
                  ${_acoes(r)}
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  return cartoesHtml + tabelaHtml;
}

function _rfqStatusBadge(s) {
  const map = {
    'Aguardando Envio':      '#f59e0b',
    'Em Cotação':            '#3b82f6',
    'Aguardando Cotações':   '#6366f1',
    'Negociando':            '#8b5cf6',
    'Cotações Recebidas':    '#f59e0b',
    'Mapa Criado':           '#7c3aed',
    'Mapa em Análise':       '#8b5cf6',
    'Aguardando Aprovação':  '#f59e0b',
    'Aprovada':              '#22c55e',
    'Aprovado':              '#22c55e',  // variante sem acento (mapas CONT-006)
    'PC Emitido':            '#10b981',
    'Pedido Emitido':        '#10b981',
    'Cancelada':             '#ef4444',
    'Cancelada – Revisão Solicitada': '#ef4444',
    'Cancelada – Cotações Revisadas': '#ef4444',
    'Rejeitada':             '#ef4444'
  };
  const cor = map[s] || '#8b949e';
  return `<span style="background:${cor}22;color:${cor};border-radius:6px;padding:3px 8px;font-size:11px;font-weight:600">${s || '—'}</span>`;
}

// ─── ACEITAR / REJEITAR REQUISIÇÃO (COMPRADOR) ───
function aceitarRequisicaoComprador(reqId) {
  const reqs = _getRequisicoes();
  const req = reqs.find(r => r.id === reqId);
  if (!req) return;

  // Cria RFQ automaticamente
  const rfqNum = 'RFQ-' + new Date().getFullYear() + '-' + String(_getRFQs().length + 1).padStart(4,'0');
  const novoRFQ = {
    id: gerarId('RFQ'),
    numero_rfq: rfqNum,
    requisicao_id: reqId,
    titulo: req.titulo,
    contrato: req.contrato,
    solicitante: req.solicitante,
    valor_estimado: req.valor_estimado,
    itens: req.itens || [],
    fornecedores_convidados: [],
    cotacoes: [],
    prazo_cotacao: '',
    status: 'Em Cotação',
    criado_em: new Date().toLocaleDateString('pt-BR'),
    criado_por: currentUser?.name || 'Comprador',
    observacoes: ''
  };

  const rfqs = _getRFQs();
  rfqs.unshift(novoRFQ);
  _saveRFQs(rfqs);

  // Atualiza status da requisição
  req.status = 'Em Cotação';
  req.rfq_numero = rfqNum;
  _saveRequisicoes(reqs);

  logAction('Criar', 'RFQ', `Processo ${rfqNum} criado a partir da requisição ${req.numero_processo}`);
  showToast(`✅ Requisição aceita! Processo de cotação ${rfqNum} criado.`, 'success', 5000);
  renderRFQ();

  // Abre tela de seleção de fornecedores
  setTimeout(() => selecionarFornecedoresRFQ(novoRFQ.id), 500);
}

function rejeitarRequisicaoComprador(reqId) {
  openModal('Rejeitar Requisição', `
    <p style="color:var(--text-secondary);font-size:13px;margin-bottom:12px">Informe o motivo da rejeição:</p>
    <textarea id="motRejeicao" rows="3" placeholder="Ex: Escopo insuficiente, valores fora do previsto..." style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box;resize:vertical"></textarea>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-danger" onclick="_confirmarRejeicaoReq('${reqId}')"><i class="fas fa-times"></i> Rejeitar</button>
  `);
}

function _confirmarRejeicaoReq(reqId) {
  const motivo = document.getElementById('motRejeicao')?.value?.trim() || 'Sem motivo informado';
  const reqs = _getRequisicoes();
  const req = reqs.find(r => r.id === reqId);
  if (req) {
    req.status = 'Rejeitada Comprador';
    req.motivo_rejeicao = motivo;
    _saveRequisicoes(reqs);
  }
  logAction('Rejeitar', 'RFQ', `Requisição ${req?.numero_processo} rejeitada pelo comprador: ${motivo}`);
  closeModal();
  showToast('Requisição rejeitada. Solicitante será notificado.', 'warning');
  renderRFQ();
}

// ─── EMITIR RC A PARTIR DE UMA OS APROVADA + ABRIR ACEITE DIRETO ─────────────
// Cria RC automaticamente com os itens aprovados da OS e abre modal de aceite/RFQ
function _procEmitirRCdaOS(fluxoId) {
  const fluxoOS = (() => { try { return JSON.parse(localStorage.getItem('fa_fluxo_os')||'[]'); } catch(e){ return []; } })();
  const f = fluxoOS.find(x => x.id === fluxoId);
  if (!f) { showToast('OS não encontrada.', 'error'); return; }

  const itensAprov = (f.itens||[]).filter(i => i.status_item === 'Aprovado');
  if (!itensAprov.length) { showToast('Esta OS não possui itens aprovados para cotação externa.', 'warning'); return; }

  // Valida tipo de compra: Serviço Interno não vai a cotação
  const tipoCompra = (f.os_tipo_compra || '').trim();
  const TIPOS_COTACAO = ['Material', 'Misto', 'Serviço Externo', ''];
  if (tipoCompra && !TIPOS_COTACAO.includes(tipoCompra)) {
    showToast(`OS do tipo "${tipoCompra}" não requer cotação externa.`, 'warning');
    return;
  }

  // Verifica se já existe RC para esta OS (evita duplicata)
  const rcLista = _procGetRCs();
  const rcExistente = rcLista.find(r =>
    (r.os_vinculada === f.os_id || r.os_id === f.os_id || r.os_vinculada === fluxoId) &&
    r.status === 'Aprovada – Aguardando Comprador'
  );
  if (rcExistente) {
    showToast(`RC ${rcExistente.numero} já criada para esta OS. Abrindo aceite…`, 'info', 3000);
    setTimeout(() => aceitarRC_Comprador(rcExistente.id), 400);
    return;
  }

  // Gera número de RC
  const ano = new Date().getFullYear();
  const numero = `RC-${ano}-${String(rcLista.length+1).padStart(4,'0')}`;
  const novaRC = {
    id: 'RC-'+Date.now(),
    numero,
    titulo: (f.os_descricao || `RC – ${f.os_id||fluxoId}`).substring(0, 80),
    contrato: f.os_contrato || f.contrato || 'Geral',
    solicitante: f.criado_por || f.solicitante || currentUser?.name || 'Sistema',
    departamento: currentUser?.role || '',
    prazo_necessidade: new Date(Date.now()+7*864e5).toLocaleDateString('pt-BR'),
    tipo: f.os_tipo_compra || 'material',
    urgencia: 'Normal',
    observacoes: `Gerada automaticamente a partir da OS ${f.os_id||fluxoId}`,
    itens: itensAprov.map(it => ({
      descricao: it.descricao, qtd: it.qtd||1, unidade: it.unidade||'Un',
      valor_unit: it.valor_unit||0, total: (it.qtd||1)*(it.valor_unit||0),
      tipo_item: it.tipo_item||'material', status_item: 'Aprovado'
    })),
    valor_total: itensAprov.reduce((s,i)=>s+(parseFloat(i.valor_unit||0)*parseFloat(i.qtd||1)),0),
    status: 'Aprovada – Aguardando Comprador',
    estagio_atual: 4,
    os_vinculada: f.os_id || fluxoId,
    os_id: f.os_id || '',
    fluxo_id: fluxoId,
    criado_por: currentUser?.name,
    data_criacao: new Date().toISOString(),
    historico: [{ acao: `RC gerada automaticamente pela aba Cotações (OS ${f.os_id||fluxoId})`, usuario: currentUser?.name, data: new Date().toLocaleString('pt-BR') }]
  };

  rcLista.unshift(novaRC);
  _procSaveRCs(rcLista);
  if (typeof window._saveRC === 'function') window._saveRC(rcLista);

  // Marca a OS como RC Emitida no fluxo
  const fIdx = fluxoOS.findIndex(x => x.id === fluxoId);
  if (fIdx >= 0) {
    if (!fluxoOS[fIdx].rcs_geradas) fluxoOS[fIdx].rcs_geradas = [];
    fluxoOS[fIdx].rcs_geradas.push(numero);
    fluxoOS[fIdx].status = 'RC Emitida';
    fluxoOS[fIdx].historico = fluxoOS[fIdx].historico || [];
    fluxoOS[fIdx].historico.unshift({ acao: `RC ${numero} gerada automaticamente pelo comprador`, usuario: currentUser?.name, data: new Date().toLocaleString('pt-BR') });
    localStorage.setItem('fa_fluxo_os', JSON.stringify(fluxoOS));
    if (typeof window._saveFluxoOS === 'function') window._saveFluxoOS(fluxoOS);
  }

  logAction && logAction('Emissão RC', 'Compras', `${numero} criada automaticamente para OS ${f.os_id||fluxoId}`);
  showToast(`✅ RC ${numero} gerada! Abrindo seleção de fornecedores…`, 'success', 3000);
  // Abre direto o modal de aceite (seleção de fornecedores) para criar o RFQ
  setTimeout(() => aceitarRC_Comprador(novaRC.id), 500);
}
window._procEmitirRCdaOS = _procEmitirRCdaOS;

// ─── VER DETALHE DE UMA RC (antes de aceitar) ───
function verDetalheRC_RFQ(rcId) {
  const rc = _procGetRCs().find(r => r.id === rcId);
  if (!rc) return;
  const itens = rc.itens || [];
  const total = itens.reduce((s, i) => s + (parseFloat(i.valor_unit||i.preco_unit||0) * parseFloat(i.qtd||i.quantidade||1)), 0);
  openModalWide(`Requisição de Compra – ${rc.numero || rc.id}`, `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;font-size:13px">
      <div><span style="color:var(--text-muted)">Número:</span> <strong style="color:#f59e0b">${rc.numero || rc.id}</strong></div>
      <div><span style="color:var(--text-muted)">Status:</span> <span style="background:#3b82f622;color:#3b82f6;border-radius:6px;padding:3px 8px;font-size:11px;font-weight:600">${rc.status}</span></div>
      <div><span style="color:var(--text-muted)">Descrição:</span> <strong>${rc.titulo || rc.descricao || '—'}</strong></div>
      <div><span style="color:var(--text-muted)">OS Vinculada:</span> <strong>${rc.os_id || rc.os_vinculada || '—'}</strong></div>
      <div><span style="color:var(--text-muted)">Criado por:</span> ${rc.criado_por || rc.solicitante || '—'}</div>
      <div><span style="color:var(--text-muted)">Data:</span> ${rc.criado_em || rc.data_criacao || rc.data || '—'}</div>
    </div>
    <div style="font-size:12px;font-weight:600;color:var(--text-primary);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px">Itens da Requisição</div>
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead>
        <tr style="background:var(--bg-tertiary)">
          <th style="padding:8px 10px;text-align:left;color:var(--text-secondary)">#</th>
          <th style="padding:8px 10px;text-align:left;color:var(--text-secondary)">Descrição</th>
          <th style="padding:8px 10px;text-align:center;color:var(--text-secondary)">Qtd</th>
          <th style="padding:8px 10px;text-align:center;color:var(--text-secondary)">Un</th>
          <th style="padding:8px 10px;text-align:right;color:var(--text-secondary)">Vl. Unit.</th>
          <th style="padding:8px 10px;text-align:right;color:var(--text-secondary)">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itens.map((it, idx) => {
          const qtd  = parseFloat(it.qtd || it.quantidade || 1);
          const vunit = parseFloat(it.valor_unit || it.preco_unit || 0);
          return `
          <tr style="border-bottom:1px solid var(--border-color)">
            <td style="padding:7px 10px;color:var(--text-muted)">${idx+1}</td>
            <td style="padding:7px 10px;color:var(--text-primary)">${it.descricao || it.nome || '—'}</td>
            <td style="padding:7px 10px;text-align:center">${qtd}</td>
            <td style="padding:7px 10px;text-align:center;color:var(--text-muted)">${it.unidade || it.un || 'Un'}</td>
            <td style="padding:7px 10px;text-align:right">${vunit > 0 ? fmt(vunit) : '—'}</td>
            <td style="padding:7px 10px;text-align:right;font-weight:600">${vunit > 0 ? fmt(qtd * vunit) : '—'}</td>
          </tr>`;
        }).join('')}
      </tbody>
      <tfoot>
        <tr style="background:var(--bg-secondary)">
          <td colspan="5" style="padding:9px 10px;text-align:right;font-size:12px;color:var(--text-secondary)">Valor Estimado Total:</td>
          <td style="padding:9px 10px;text-align:right;font-weight:700;color:var(--fa-teal)">${total > 0 ? fmt(total) : 'A cotar'}</td>
        </tr>
      </tfoot>
    </table>
    ${rc.historico && rc.historico.length ? `
      <div style="margin-top:16px;font-size:12px;font-weight:600;color:var(--text-primary);margin-bottom:6px">HISTÓRICO</div>
      ${rc.historico.slice(-3).map(h => `
        <div style="padding:5px 0;border-bottom:1px solid var(--border-color);font-size:12px;color:var(--text-secondary)">
          <i class="fas fa-clock" style="margin-right:4px;color:var(--text-muted)"></i>
          <strong>${h.usuario || '—'}</strong> – ${h.acao || h.descricao || '—'} · <span style="color:var(--text-muted)">${h.data || ''}</span>
        </div>
      `).join('')}
    ` : ''}
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
    ${['Aprovada – Aguardando Comprador'].includes(rc.status) ? `
      <button class="btn btn-danger" onclick="closeModal();rejeitarRC_Comprador('${rcId}')"><i class="fas fa-undo"></i> Devolver RC</button>
      <button class="btn btn-primary" onclick="closeModal();aceitarRC_Comprador('${rcId}')"><i class="fas fa-check"></i> Aceitar e Iniciar Cotação</button>
    ` : `<span style="font-size:12px;color:var(--text-muted);padding:6px 12px;background:var(--bg-secondary);border-radius:8px">
      <i class="fas fa-check-circle" style="color:#22c55e;margin-right:4px"></i>RC já aceita – Status: ${rc.status}
    </span>`}
  `);
}

// ─── ACEITAR RC DO FLUXO DE APROVAÇÃO (comprador inicia cotação) ───
function aceitarRC_Comprador(rcId) {
  const rc = _procGetRCs().find(r => r.id === rcId);
  if (!rc) { showToast('RC não encontrada.', 'error'); return; }

  // Bloqueia se RC já foi aceita/processada
  const statusJaProcessado = ['Em Cotação','RFQ Criado','Aguardando Cotações','Mapa Criado','Mapa Aprovado','PC Emitido','Pedido Emitido','Cancelada'];
  if (statusJaProcessado.includes(rc.status)) {
    showToast(`Esta RC já foi processada (status atual: ${rc.status}).`, 'warning', 4000);
    return;
  }

  const itens = rc.itens || [];
  const total = itens.reduce((s, i) => s + (parseFloat(i.valor_unit||i.preco_unit||0) * parseFloat(i.qtd||i.quantidade||1)), 0);

  openModalWide(`Aceitar RC e Iniciar Cotação – ${rc.numero || rc.id}`, `
    <!-- Info da RC -->
    <div style="background:rgba(59,130,246,0.06);border:1px solid rgba(59,130,246,0.2);border-radius:10px;padding:14px;margin-bottom:14px">
      <div style="font-size:13px;font-weight:700;color:var(--text-primary);margin-bottom:5px">
        <i class="fas fa-file-alt" style="color:#3b82f6;margin-right:6px"></i>${rc.numero || rc.id} – ${rc.titulo || rc.descricao || ''}
      </div>
      <div style="display:flex;gap:16px;font-size:12px;color:var(--text-secondary);flex-wrap:wrap">
        <span><i class="fas fa-box" style="margin-right:4px"></i>${itens.length} item(s)</span>
        ${rc.os_id ? `<span><i class="fas fa-link" style="margin-right:4px"></i>OS: ${rc.os_id}</span>` : ''}
        ${total > 0 ? `<span><i class="fas fa-tag" style="margin-right:4px"></i>Valor est.: ${fmt(total)}</span>` : ''}
        <span><i class="fas fa-user" style="margin-right:4px"></i>Solicitante: ${rc.criado_por || '—'}</span>
      </div>
    </div>

    <!-- Itens da RC -->
    <div style="margin-bottom:14px">
      <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:6px">
        <i class="fas fa-list" style="margin-right:4px"></i>Itens a Cotar
      </div>
      <div style="max-height:140px;overflow-y:auto;border:1px solid var(--border-color);border-radius:8px">
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          ${itens.map((it, idx) => `
            <tr style="border-bottom:1px solid var(--border-color)" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='transparent'">
              <td style="padding:6px 10px;color:var(--text-muted);width:26px">${idx+1}</td>
              <td style="padding:6px 10px;color:var(--text-primary)">${it.descricao || it.nome || '—'}</td>
              <td style="padding:6px 10px;text-align:center;color:var(--text-secondary);white-space:nowrap">${parseFloat(it.qtd||it.quantidade||1)} ${it.unidade||it.un||'Un'}</td>
            </tr>
          `).join('')}
        </table>
      </div>
    </div>

    <!-- Prazo e Obs -->
    <div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap">
      <div style="min-width:160px">
        <label style="font-size:10px;color:var(--text-muted);display:block;margin-bottom:4px;text-transform:uppercase">Prazo para Cotação</label>
        <input type="date" id="acRfqPrazo" value="${new Date(Date.now()+7*24*60*60*1000).toISOString().split('T')[0]}"
          style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
      </div>
      <div style="flex:2;min-width:200px">
        <label style="font-size:10px;color:var(--text-muted);display:block;margin-bottom:4px;text-transform:uppercase">Observações (opcional)</label>
        <input type="text" id="acRfqObs" placeholder="Ex: Prioridade alta, entrega em campo..."
          style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
      </div>
    </div>

    <!-- ── SUGESTÕES DA IA ── -->
    <div style="margin-bottom:14px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <div style="flex:1;font-size:12px;font-weight:700;color:var(--text-primary)">
          <i class="fas fa-robot" style="color:#8b5cf6;margin-right:6px"></i>Sugestões da IA – Fornecedores com Histórico
        </div>
        <span style="font-size:10px;color:var(--text-muted);background:rgba(139,92,246,0.1);border-radius:6px;padding:2px 8px;border:1px solid rgba(139,92,246,0.2)">
          Baseado em cotações e pedidos anteriores
        </span>
      </div>
      <div id="ac_sugestoes_painel" style="display:flex;flex-direction:column;gap:5px;max-height:260px;overflow-y:auto;padding-right:2px">
        <div style="font-size:11px;color:var(--text-muted);text-align:center;padding:14px">
          <i class="fas fa-spinner fa-spin" style="margin-right:4px"></i>Analisando histórico...
        </div>
      </div>
    </div>

    <!-- Seleção de Fornecedores -->
    <div style="font-size:12px;font-weight:700;color:var(--text-primary);margin-bottom:10px">
      <i class="fas fa-building" style="color:#6366f1;margin-right:6px"></i>Convidar Outros Fornecedores
    </div>

    <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:12px;align-items:start;margin-bottom:10px">

      <!-- Col 1: Autocomplete cadastrados -->
      <div>
        <label style="font-size:10px;color:#6366f1;font-weight:700;display:block;margin-bottom:5px;text-transform:uppercase;letter-spacing:.4px">
          <i class="fas fa-building" style="margin-right:4px"></i>Selecionar Cadastrado
        </label>
        <div style="position:relative">
          <input type="text" id="ac_forn_busca"
            placeholder="🔍 Nome, CNPJ ou categoria..."
            oninput="_acFiltrarFornecedores()"
            onfocus="_acFiltrarFornecedores()"
            style="width:100%;padding:8px 10px;background:var(--bg-secondary);border:1px solid rgba(99,102,241,0.35);border-radius:8px;color:var(--text-primary);font-size:12px;box-sizing:border-box">
          <div id="ac_forn_dropdown"
            style="display:none;position:absolute;top:100%;left:0;right:0;background:var(--bg-card);border:1px solid var(--border-color);border-radius:8px;max-height:220px;overflow-y:auto;z-index:9999;box-shadow:0 8px 24px rgba(0,0,0,.25);margin-top:2px"></div>
        </div>
        <button onclick="_acAdicionarFornSelecionado()"
          style="margin-top:6px;width:100%;padding:7px 12px;border:none;border-radius:7px;background:#6366f1;color:#fff;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px">
          <i class="fas fa-plus"></i> Adicionar Selecionado
        </button>
        <div style="font-size:10px;color:var(--text-muted);margin-top:4px;text-align:center">
          <i class="fas fa-envelope" style="color:#22c55e"></i> = tem e-mail &nbsp;|&nbsp;
          <i class="fas fa-exclamation-triangle" style="color:#ef4444"></i> = sem e-mail (manual)
        </div>
      </div>

      <!-- Divisor -->
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding-top:28px;gap:6px;min-width:40px">
        <div style="width:1px;height:30px;background:var(--border-color)"></div>
        <span style="font-size:10px;color:var(--text-muted);font-weight:700;background:var(--bg-card);padding:2px 6px;border-radius:6px;border:1px solid var(--border-color)">OU</span>
        <div style="width:1px;height:30px;background:var(--border-color)"></div>
      </div>

      <!-- Col 2: Novo manual -->
      <div>
        <label style="font-size:10px;color:#f59e0b;font-weight:700;display:block;margin-bottom:5px;text-transform:uppercase;letter-spacing:.4px">
          <i class="fas fa-pencil-alt" style="margin-right:4px"></i>Fornecedor Não Cadastrado
        </label>
        <input type="text" id="ac_novo_nome"
          placeholder="Nome / razão social"
          style="width:100%;padding:8px 10px;background:var(--bg-secondary);border:1px solid rgba(245,158,11,0.35);border-radius:8px;color:var(--text-primary);font-size:12px;box-sizing:border-box;margin-bottom:5px">
        <input type="text" id="ac_novo_email"
          placeholder="E-mail de contato (opcional)"
          style="width:100%;padding:8px 10px;background:var(--bg-secondary);border:1px solid rgba(245,158,11,0.25);border-radius:8px;color:var(--text-primary);font-size:12px;box-sizing:border-box">
        <button onclick="_acAdicionarFornNovo()"
          style="margin-top:6px;width:100%;padding:7px 12px;border:1px solid rgba(245,158,11,0.4);border-radius:7px;background:rgba(245,158,11,0.12);color:#f59e0b;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px">
          <i class="fas fa-plus"></i> Inserir Novo
        </button>
      </div>
    </div>

    <!-- Lista de fornecedores adicionados -->
    <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:5px;letter-spacing:.4px">
      <i class="fas fa-users" style="margin-right:4px"></i>Fornecedores no Processo
    </div>
    <div id="ac_forn_lista"
      style="display:flex;flex-direction:column;gap:6px;min-height:46px;padding:8px;background:var(--bg-card2);border:1px dashed var(--border-color);border-radius:8px">
      <div id="ac_lista_vazia" style="font-size:12px;color:var(--text-muted);text-align:center;padding:8px">
        <i class="fas fa-user-plus" style="margin-right:4px;opacity:.4"></i>Adicione fornecedores acima para convidá-los
      </div>
    </div>

  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-danger" onclick="closeModal();rejeitarRC_Comprador('${rcId}')"><i class="fas fa-undo"></i> Devolver RC</button>
    <button class="btn btn-primary" onclick="_confirmarAceitarRC('${rcId}')"><i class="fas fa-paper-plane"></i> Criar Processo de Cotação</button>
  `);

  // Fecha dropdown ao clicar fora (addEventListener precisa ser adicionado após renderização do modal)
  setTimeout(function() {
    document.addEventListener('click', function _acCloseDropdown(e) {
      if (!e.target.closest('#ac_forn_busca') && !e.target.closest('#ac_forn_dropdown')) {
        var d = document.getElementById('ac_forn_dropdown');
        if (d) d.style.display = 'none';
      }
      // Remove o listener quando o modal fechar (ao clicar fora do modal ou em Cancelar)
      if (!document.getElementById('globalModal')?.classList.contains('show')) {
        document.removeEventListener('click', _acCloseDropdown);
      }
    });
    // Carrega sugestões da IA
    if (typeof _acRenderSugestoes === 'function') {
      _acRenderSugestoes(rc, 'ac_forn_lista', 'ac_lista_vazia');
    }
  }, 300);
}

// ── IA: Sugestão de fornecedores baseada em histórico ──────────────────────────
/**
 * Analisa RFQs/pedidos anteriores e retorna lista de fornecedores sugeridos
 * com score de relevância, IDF e motivo da sugestão.
 * @param {object} rc - RC objeto (tem itens, categoria, tipo)
 * @returns {Array} lista ordenada por relevância
 */
function _acGerarSugestoesIA(rc) {
  try {
    // Carrega dados
    let fornLista = [];
    if (typeof FA_FORNECEDORES !== 'undefined' && FA_FORNECEDORES.length > 0) {
      fornLista = FA_FORNECEDORES;
    } else {
      const raw = localStorage.getItem('fa_fornecedores_cache') || localStorage.getItem('fa_fornecedores');
      if (raw) fornLista = JSON.parse(raw);
    }

    const todosRFQs   = _getRFQs();
    const flowRFQs    = JSON.parse(localStorage.getItem('fa_rfq_flow') || '[]');
    const rfqsTodos   = [...todosRFQs, ...flowRFQs];
    const pedidos     = JSON.parse(localStorage.getItem('fa_pedidos') || '[]');
    const matrizes    = JSON.parse(localStorage.getItem('fa_matrizes') || localStorage.getItem('fa_mapas_comparativos') || '[]');
    const idfList     = JSON.parse(localStorage.getItem('fa_idf_avaliacoes') || '[]');

    // Palavras-chave da RC para match de categoria/descrição
    const itensRC   = rc.itens || [];
    const tituloRC  = (rc.titulo || rc.descricao || '').toLowerCase();
    const keywordsRC = [
      tituloRC,
      ...itensRC.map(i => (i.descricao || i.nome || '').toLowerCase())
    ].join(' ');

    // Para cada fornecedor, calcula score de relevância
    const scoreMap = {}; // fornId -> {score, motivos[], vezes, idf, email, nome}

    function ensureEntry(fornId, fornNome, fornEmail) {
      if (!scoreMap[fornId]) {
        scoreMap[fornId] = { fornId, fornNome, fornEmail, score: 0, motivos: [], vezes: 0, processosFechados: 0, idf: null };
      }
    }

    // 1. Analisa pedidos (PO emitidos – peso alto)
    pedidos.forEach(ped => {
      const fornId   = ped.fornecedor_id || ped.fornecedor || '';
      const fornNome = ped.fornecedor_nome || ped.fornecedor || '';
      if (!fornId && !fornNome) return;
      const key = fornId || fornNome;
      // Busca no cadastro
      const fCad = fornLista.find(f => f.id === fornId || (f.razao_social||f.nome||'').toLowerCase() === fornNome.toLowerCase());
      ensureEntry(key, fCad ? (fCad.nome_fantasia || fCad.razao_social || fCad.nome) : fornNome, fCad?.contato_email || fCad?.email || '');
      scoreMap[key].score += 30;
      scoreMap[key].processosFechados++;
      scoreMap[key].vezes++;
      scoreMap[key].motivos.push('Pedido emitido anteriormente');
    });

    // 2. Analisa mapas comparativos (fornecedor selecionado no mapa – peso alto)
    matrizes.forEach(m => {
      const fornId = m.fornecedor_id || m.fornecedor_selecionado || '';
      if (!fornId) return;
      const fCad = fornLista.find(f => f.id === fornId);
      const nome = fCad ? (fCad.nome_fantasia || fCad.razao_social) : (m.fornecedor_nome || fornId);
      ensureEntry(fornId, nome, fCad?.contato_email || fCad?.email || '');
      scoreMap[fornId].score += 25;
      scoreMap[fornId].processosFechados++;
      scoreMap[fornId].motivos.push('Selecionado no quadro comparativo');
    });

    // 3. Analisa RFQs anteriores (fornecedores convidados que cotaram – peso médio)
    rfqsTodos.forEach(rfq => {
      const convidados = rfq.fornecedores_convidados || [];
      const detalhes   = rfq.fornecedores_detalhes   || [];
      const cotacoes   = rfq.cotacoes || [];

      convidados.forEach((fornId, idx) => {
        if (!fornId) return;
        const det  = detalhes[idx] || {};
        const fCad = fornLista.find(f => f.id === fornId);
        const nome = fCad ? (fCad.nome_fantasia || fCad.razao_social) : (det.nome || fornId);
        const email= fCad?.contato_email || fCad?.email || det.email || '';

        // Verifica se tem categorias/items similares
        const cats = (fCad?.categoria || fCad?.segmento || '').toLowerCase();
        const temMatch = cats && keywordsRC.includes(cats.split(',')[0]) || false;

        ensureEntry(fornId, nome, email);
        const cot = cotacoes.find(c => c.fornecedor === fornId);
        if (cot && !cot.declinou) {
          scoreMap[fornId].score += 15;
          scoreMap[fornId].vezes++;
          scoreMap[fornId].motivos.push('Participou de cotação anterior');
        } else if (cot && cot.declinou) {
          scoreMap[fornId].score += 3;
          scoreMap[fornId].motivos.push('Convidado (declinou anteriormente)');
        } else {
          scoreMap[fornId].score += 8;
          scoreMap[fornId].vezes++;
          scoreMap[fornId].motivos.push('Convidado em processo anterior');
        }
        if (temMatch) { scoreMap[fornId].score += 10; scoreMap[fornId].motivos.push('Categoria compatível'); }
      });
    });

    // 4. Aplica IDF score
    Object.keys(scoreMap).forEach(key => {
      const entry = scoreMap[key];
      // Tenta achar no idfList
      const fCad = fornLista.find(f => f.id === key);
      const nomeBusca = fCad ? (fCad.razao_social || fCad.nome || '') : entry.fornNome;
      const idfEntry = idfList.find(x =>
        (x.fornecedor || '').toLowerCase().includes(nomeBusca.toLowerCase().substring(0,8))
        || (nomeBusca.toLowerCase().includes((x.fornecedor||'').toLowerCase().substring(0,8)))
      );
      if (idfEntry) {
        entry.idf = { score: idfEntry.score, classificacao: idfEntry.classificacao };
        if (idfEntry.score >= 80) { entry.score += 20; entry.motivos.push(`IDF excelente (${idfEntry.score})`); }
        else if (idfEntry.score >= 60) { entry.score += 10; entry.motivos.push(`IDF bom (${idfEntry.score})`); }
        else if (idfEntry.score < 40) { entry.score -= 5; entry.motivos.push(`IDF baixo (${idfEntry.score})`); }
      } else if (fCad?.idf_score != null) {
        entry.idf = { score: fCad.idf_score, classificacao: fCad.idf_score>=80?'Excelente':fCad.idf_score>=60?'Bom':fCad.idf_score>=40?'Regular':'Baixo' };
        if (fCad.idf_score >= 80) entry.score += 20;
        else if (fCad.idf_score >= 60) entry.score += 10;
      }
      // Remove motivos duplicados
      entry.motivos = [...new Set(entry.motivos)];
    });

    // 5. Ordena por score desc, retorna top 8
    return Object.values(scoreMap)
      .filter(e => e.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
  } catch(e) {
    console.warn('_acGerarSugestoesIA error:', e);
    return [];
  }
}

/**
 * Renderiza o painel de sugestões da IA dentro do modal de convidar fornecedores.
 * @param {object} rc - RC objeto
 * @param {string} listaId - id do container de cards adicionados (ac_forn_lista ou sfr_lista)
 * @param {string} vaziaId - id do placeholder vazio
 */
function _acRenderSugestoes(rc, listaId, vaziaId) {
  const painel = document.getElementById('ac_sugestoes_painel');
  if (!painel) return;
  const sugestoes = _acGerarSugestoesIA(rc);

  if (!sugestoes.length) {
    painel.innerHTML = `<div style="font-size:11px;color:var(--text-muted);text-align:center;padding:10px">
      <i class="fas fa-robot" style="margin-right:4px;opacity:.4"></i>Nenhum histórico encontrado para sugestão.
    </div>`;
    return;
  }

  painel.innerHTML = sugestoes.map((s, idx) => {
    const idfColor = !s.idf ? '#8b949e'
      : s.idf.score >= 80 ? '#22c55e'
      : s.idf.score >= 60 ? '#3b82f6'
      : s.idf.score >= 40 ? '#f59e0b' : '#ef4444';
    const idfBadge = s.idf
      ? `<span style="font-size:10px;font-weight:700;color:${idfColor};background:${idfColor}18;border-radius:5px;padding:2px 6px">IDF ${s.idf.score?.toFixed?s.idf.score.toFixed(0):s.idf.score} · ${s.idf.classificacao}</span>`
      : `<span style="font-size:10px;color:var(--text-muted);background:var(--bg-tertiary);border-radius:5px;padding:2px 6px">Não avaliado</span>`;
    const emailBadge = s.fornEmail
      ? `<span style="font-size:10px;color:#22c55e"><i class="fas fa-envelope"></i> ${s.fornEmail}</span>`
      : `<span style="font-size:10px;color:#ef4444"><i class="fas fa-exclamation-triangle"></i> Sem e-mail</span>`;
    const motivoPrincipal = s.motivos[0] || '';
    const vezesBadge = s.vezes > 1
      ? `<span style="font-size:9px;background:rgba(99,102,241,0.12);color:#6366f1;border-radius:4px;padding:1px 5px">${s.vezes}× cotado</span>` : '';
    const fechadoBadge = s.processosFechados > 0
      ? `<span style="font-size:9px;background:rgba(16,185,129,0.12);color:#10b981;border-radius:4px;padding:1px 5px">${s.processosFechados} pedido(s)</span>` : '';
    const starColor = idx === 0 ? '#f59e0b' : idx === 1 ? '#94a3b8' : '#cd7c32';
    const starTitle = idx === 0 ? '🥇 1ª sugestão' : idx === 1 ? '🥈 2ª sugestão' : `${idx+1}ª sugestão`;
    const safeNome  = (s.fornNome||'').replace(/'/g,"\\'").replace(/"/g,'&quot;');
    const safeEmail = (s.fornEmail||'').replace(/'/g,"\\'");
    const safeId    = (s.fornId||'').replace(/'/g,"\\'");
    return `<div style="display:flex;align-items:center;gap:8px;padding:9px 12px;background:var(--bg-card2);border:1px solid ${idx===0?'rgba(245,158,11,0.3)':'var(--border-color)'};border-radius:8px;transition:background .12s"
      onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='var(--bg-card2)'">
      <div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:flex;align-items:center;justify-content:center;flex-shrink:0;position:relative">
        <span style="color:#fff;font-size:11px;font-weight:700">${(s.fornNome||'?').charAt(0).toUpperCase()}</span>
        <span style="position:absolute;top:-4px;right:-4px;font-size:10px" title="${starTitle}">⭐</span>
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:700;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${s.fornNome}</div>
        <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:2px">${vezesBadge}${fechadoBadge}${idfBadge}</div>
        <div style="margin-top:2px">${emailBadge}</div>
        <div style="font-size:10px;color:var(--text-muted);margin-top:1px;font-style:italic">${motivoPrincipal}</div>
      </div>
      <button
        onclick="_acAdicionarSugestao('${safeId}','${safeNome}','${safeEmail}','${listaId}','${vaziaId}')"
        title="Adicionar ao processo"
        style="flex-shrink:0;background:linear-gradient(135deg,#6366f1,#8b5cf6);border:none;border-radius:7px;color:#fff;padding:6px 10px;cursor:pointer;font-size:11px;font-weight:600;display:flex;align-items:center;gap:4px">
        <i class="fas fa-plus"></i> Adicionar
      </button>
    </div>`;
  }).join('');
}

function _acAdicionarSugestao(fornId, fornNome, fornEmail, listaId, vaziaId) {
  const lista = document.getElementById(listaId);
  if (!lista) return;
  // Verificar duplicata
  if (lista.querySelector(`[data-ac-id="${fornId||fornNome}"], [data-sfr-id="${fornId||fornNome}"]`)) {
    showToast(`"${fornNome}" já foi adicionado.`, 'warning', 2000); return;
  }
  // Usa a função correta dependendo do painel
  if (listaId === 'ac_forn_lista') {
    _acCriarCard(fornId, fornNome, fornEmail, 'cadastrado');
  } else {
    _sfrCriarCard(fornId, fornNome, fornEmail, 'cadastrado');
  }
  showToast(`✅ "${fornNome}" adicionado ao processo!`, 'success', 2000);
}

// ── Autocomplete helpers para modal aceitarRC_Comprador ──

function _acFiltrarFornecedores() {
  const input    = document.getElementById('ac_forn_busca');
  const dropdown = document.getElementById('ac_forn_dropdown');
  if (!input || !dropdown) return;

  const busca = (input.value || '').toLowerCase().trim();
  let lista = [];
  try {
    if (typeof FA_FORNECEDORES !== 'undefined' && FA_FORNECEDORES.length > 0) {
      lista = FA_FORNECEDORES;
    } else {
      const raw = localStorage.getItem('fa_fornecedores_cache') || localStorage.getItem('fa_fornecedores');
      if (raw) lista = JSON.parse(raw);
    }
  } catch(e) { lista = []; }

  const ativos = lista.filter(f => f.status === 'Ativo' || f.status === 'Homologado');
  let filtrados = busca.length >= 1
    ? ativos.filter(f => {
        const nf   = (f.nome_fantasia || '').toLowerCase();
        const rs   = (f.razao_social  || f.nome || '').toLowerCase();
        const cnpj = (f.cnpj || '').replace(/\D/g,'');
        const cat  = (f.categoria || f.segmento || '').toLowerCase();
        return nf.includes(busca) || rs.includes(busca) || cnpj.includes(busca.replace(/\D/g,'')) || cat.includes(busca);
      })
    : ativos.slice(0, 12);

  if (filtrados.length === 0) {
    dropdown.innerHTML = `<div style="padding:12px;font-size:12px;color:var(--text-muted);text-align:center">
      <i class="fas fa-search" style="margin-right:4px;opacity:.5"></i>Nenhum fornecedor encontrado${busca ? ` para "<b>${busca}</b>"` : ''}.
    </div>`;
    dropdown.style.display = 'block'; return;
  }

  dropdown.innerHTML = filtrados.slice(0, 15).map(f => {
    const nf = f.nome_fantasia || '';
    const rs = f.razao_social || f.nome || 'Fornecedor';
    const nome = nf || rs;
    const sub  = nf && nf !== rs ? rs : '';
    const cat  = f.categoria || f.segmento || '';
    const temEmail = !!(f.contato_email || f.email);
    const emailBadge = temEmail
      ? `<span style="font-size:10px;color:#22c55e" title="${f.contato_email||f.email}"><i class="fas fa-envelope"></i></span>`
      : `<span style="font-size:10px;color:#ef4444" title="Sem e-mail"><i class="fas fa-exclamation-triangle"></i></span>`;
    // IDF enriquecido com cor por faixa
    const idfScoreAc = f.idf_score ?? f.score_idf ?? null;
    const idfBadgeAc = idfScoreAc != null ? (() => {
      const sc  = Number(idfScoreAc);
      const cor = sc >= 80 ? '#22c55e' : sc >= 60 ? '#3b82f6' : sc >= 40 ? '#f59e0b' : '#ef4444';
      const lbl = sc >= 80 ? 'Ótimo' : sc >= 60 ? 'Bom' : sc >= 40 ? 'Regular' : 'Crítico';
      return `<span title="IDF: ${lbl}" style="font-size:10px;font-weight:700;background:${cor}1a;color:${cor};border-radius:4px;padding:1px 6px;white-space:nowrap">IDF ${sc.toFixed(0)} · ${lbl}</span>`;
    })() : '';
    const safeNome  = nome.replace(/'/g,"\\'").replace(/"/g,'&quot;');
    const safeEmail = (f.contato_email||f.email||'').replace(/'/g,"\\'");
    return `<div
      onclick="_acSelecionarForn('${f.id}','${safeNome}','${safeEmail}',this)"
      data-forn-id="${f.id}"
      style="padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--border-color);display:flex;align-items:center;gap:8px"
      onmouseover="this.style.background='var(--bg-secondary)'"
      onmouseout="this.style.background='transparent'">
      <div style="width:26px;height:26px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <span style="color:#fff;font-size:10px;font-weight:700">${nome.charAt(0).toUpperCase()}</span>
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:600;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${nome}</div>
        ${sub ? `<div style="font-size:10px;color:var(--text-muted);font-style:italic">${sub}</div>` : ''}
        <div style="display:flex;gap:4px;margin-top:2px;flex-wrap:wrap;align-items:center">
          ${cat ? `<span style="font-size:9px;background:var(--bg-tertiary);color:var(--text-muted);border-radius:4px;padding:1px 4px">${cat}</span>` : ''}
          ${idfBadgeAc}
        </div>
      </div>
      ${emailBadge}
    </div>`;
  }).join('');

  if (filtrados.length > 15) {
    dropdown.innerHTML += `<div style="padding:6px 12px;font-size:11px;color:var(--text-muted);text-align:center">+${filtrados.length-15} mais. Refine a busca.</div>`;
  }
  dropdown.style.display = 'block';
}

function _acSelecionarForn(id, nome, email, el) {
  const input    = document.getElementById('ac_forn_busca');
  const dropdown = document.getElementById('ac_forn_dropdown');
  if (input) {
    input.value = nome;
    input.dataset.fornId    = id;
    input.dataset.fornNome  = nome;
    input.dataset.fornEmail = email;
    input.style.borderColor = '#22c55e';
  }
  if (dropdown) dropdown.style.display = 'none';
  if (el) { el.style.background = 'rgba(99,102,241,0.1)'; el.style.borderLeft = '3px solid #6366f1'; }
}

function _acAdicionarFornSelecionado() {
  const input = document.getElementById('ac_forn_busca');
  if (!input) return;
  const fornId    = input.dataset.fornId;
  const fornNome  = input.dataset.fornNome || input.value.trim();
  const fornEmail = input.dataset.fornEmail || '';
  if (!fornNome) {
    showToast('Selecione um fornecedor na lista antes de adicionar.', 'warning', 2500);
    input.focus(); return;
  }
  const lista = document.getElementById('ac_forn_lista');
  if (!lista) return;
  if (lista.querySelector(`[data-ac-id="${fornId||fornNome}"]`)) {
    showToast(`"${fornNome}" já foi adicionado.`, 'warning', 2000); return;
  }
  _acCriarCard(fornId, fornNome, fornEmail, 'cadastrado');
  input.value = '';
  delete input.dataset.fornId;
  delete input.dataset.fornNome;
  delete input.dataset.fornEmail;
  input.style.borderColor = 'rgba(99,102,241,0.35)';
  const drop = document.getElementById('ac_forn_dropdown');
  if (drop) drop.style.display = 'none';
  showToast(`✅ "${fornNome}" adicionado!`, 'success', 2000);
}

function _acAdicionarFornNovo() {
  const nomeEl  = document.getElementById('ac_novo_nome');
  const emailEl = document.getElementById('ac_novo_email');
  const nome    = (nomeEl?.value || '').trim();
  const email   = (emailEl?.value || '').trim();
  if (!nome) { showToast('Informe o nome do fornecedor.', 'warning', 2500); nomeEl?.focus(); return; }
  const lista = document.getElementById('ac_forn_lista');
  if (lista && lista.querySelector(`[data-ac-id="${nome}"]`)) {
    showToast(`"${nome}" já foi adicionado.`, 'warning', 2000); return;
  }
  _acCriarCard(null, nome, email, 'externo');
  if (nomeEl)  nomeEl.value  = '';
  if (emailEl) emailEl.value = '';
  showToast(`✅ "${nome}" adicionado!`, 'success', 2000);
}

/* ── Helper: busca score IDF de um fornecedor pelo id/nome ─────────────── */
function _procGetIdfBadge(id, nome) {
  try {
    const idfList = JSON.parse(localStorage.getItem('fa_idf') || '[]');
    const match = idfList.find(x =>
      (id && (x.fornecedor_id === id || x.id === id)) ||
      (nome && (x.nome || x.razao_social || '').toLowerCase() === nome.toLowerCase())
    );
    if (!match) return '';
    const score = match.score_final ?? match.idf_score ?? match.score ?? null;
    if (score === null) return '';
    const color = score >= 80 ? '#22c55e' : score >= 60 ? '#3b82f6' : score >= 40 ? '#f59e0b' : '#ef4444';
    const label = score >= 80 ? 'Ótimo' : score >= 60 ? 'Bom' : score >= 40 ? 'Regular' : 'Crítico';
    return `<span title="IDF: ${label}" style="font-size:10px;font-weight:700;background:${color}1a;color:${color};border-radius:4px;padding:2px 6px;white-space:nowrap">IDF ${Number(score).toFixed(0)} · ${label}</span>`;
  } catch(e) { return ''; }
}

function _acCriarCard(id, nome, email, tipo) {
  const lista = document.getElementById('ac_forn_lista');
  if (!lista) return;
  const vazia = document.getElementById('ac_lista_vazia');
  if (vazia) vazia.style.display = 'none';
  const temEmail = !!email;
  const card = document.createElement('div');
  card.dataset.acId    = id || nome;
  card.dataset.acNome  = nome;
  card.dataset.acEmail = email || '';
  card.dataset.acTipo  = tipo || 'cadastrado';
  card.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 12px;background:rgba(99,102,241,0.05);border:1px solid rgba(99,102,241,0.2);border-radius:8px;font-size:12px';
  const badgeTipo = tipo === 'cadastrado'
    ? `<span style="font-size:10px;background:rgba(99,102,241,0.15);color:#6366f1;border-radius:4px;padding:2px 6px">Cadastrado</span>`
    : `<span style="font-size:10px;background:rgba(245,158,11,0.15);color:#f59e0b;border-radius:4px;padding:2px 6px">Externo</span>`;
  const idfBadge = _procGetIdfBadge(id, nome);
  card.innerHTML = `
    <div style="width:26px;height:26px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:flex;align-items:center;justify-content:center;flex-shrink:0">
      <span style="color:#fff;font-size:10px;font-weight:700">${nome.charAt(0).toUpperCase()}</span>
    </div>
    <div style="flex:1;min-width:0">
      <div style="font-weight:600;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${nome}</div>
      <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:2px">
        ${temEmail
          ? `<span style="font-size:11px;color:#22c55e"><i class="fas fa-envelope" style="font-size:10px"></i> ${email}</span>`
          : `<span style="font-size:11px;color:#ef4444"><i class="fas fa-exclamation-triangle" style="font-size:10px"></i> Sem e-mail – envio manual</span>`
        }
        ${idfBadge}
      </div>
    </div>
    ${badgeTipo}
    <button onclick="this.closest('[data-ac-id]').remove();var l=document.getElementById('ac_forn_lista');if(l&&!l.querySelector('[data-ac-id]')){var v=document.getElementById('ac_lista_vazia');if(v)v.style.display=''}" style="background:rgba(239,68,68,0.12);border:none;border-radius:6px;color:#ef4444;padding:4px 7px;cursor:pointer" title="Remover">
      <i class="fas fa-times"></i>
    </button>
  `;
  lista.appendChild(card);
}

function _confirmarAceitarRC(rcId) {
  const rcs = _procGetRCs();
  const rc  = rcs.find(r => r.id === rcId);
  if (!rc) return;

  // Coleta fornecedores dos cards do autocomplete
  const cards = document.querySelectorAll('#ac_forn_lista [data-ac-id]');
  if (cards.length === 0) {
    showToast('Adicione ao menos 1 fornecedor para iniciar a cotação.', 'warning', 3000);
    return;
  }

  const fornecedoresConvidados = [];
  const fornecedoresDetalhes   = [];
  cards.forEach(card => {
    const id    = card.dataset.acId;
    const nome  = card.dataset.acNome;
    const email = card.dataset.acEmail;
    const tipo  = card.dataset.acTipo;
    fornecedoresConvidados.push(id);
    fornecedoresDetalhes.push({ id, nome, email, tipo });
  });

  const prazoRaw = document.getElementById('acRfqPrazo')?.value;
  const obs      = document.getElementById('acRfqObs')?.value?.trim() || '';
  const prazoFmt = prazoRaw ? new Date(prazoRaw + 'T12:00:00').toLocaleDateString('pt-BR') : '';

  // Gera número de RFQ usando contagem combinada de ambos os storages
  const _rfqCountAll = () => {
    const a = _getRFQs().length;
    let b = 0; try { b = JSON.parse(localStorage.getItem('fa_rfq_flow')||'[]').length; } catch(e) {}
    return Math.max(a, b);
  };
  const rfqNum = 'RFQ-' + new Date().getFullYear() + '-' + String(_rfqCountAll() + 1).padStart(4,'0');

  // Calcula valor estimado a partir dos itens
  const itens = rc.itens || [];
  const valorEst = itens.reduce((s, i) => s + (parseFloat(i.valor_unit||i.preco_unit||0) * parseFloat(i.qtd||i.quantidade||1)), 0);

  // Conta fornecedores com/sem e-mail
  const comEmail = fornecedoresDetalhes.filter(f => f.email).length;
  const semEmail = fornecedoresDetalhes.length - comEmail;

  // Cria o processo RFQ com campos compatíveis com fluxo_aprovacao_rc.js E procurement.js
  const rfqId = gerarId('RFQ');
  const itensFormatados = itens.map(i => ({
    descricao: i.descricao || i.nome || '',
    qtd: parseFloat(i.qtd || i.quantidade || 1),
    unidade: i.unidade || i.un || 'Un',
    valor_unit: parseFloat(i.valor_unit || i.preco_unit || 0),
    tipo_item: i.tipo_item || 'Material'
  }));

  // Monta lista de fornecedores no formato esperado por fluxo_aprovacao_rc.js
  // Marca cotacao_enviada=true para TODOS (o processo de cotação já foi iniciado)
  const agora = new Date().toLocaleString('pt-BR');
  const fornecedoresFlow = fornecedoresDetalhes.map(f => ({
    id:    f.id,
    nome:  f.nome,
    email: f.email || '',
    tipo:  f.tipo || 'cadastrado',
    cotacao_enviada:  true,           // cotação iniciada ao aceitar a RC
    cotacao_recebida: false,
    data_envio: agora,
    metodo_envio: f.email ? 'email' : 'manual'
  }));

  const novoRFQ = {
    id: rfqId,
    // campos usados por fluxo_aprovacao_rc.js
    numero:        rfqNum,
    titulo:        rc.titulo || rc.descricao || rfqNum,
    rc_id:         rcId,
    rc_numero:     rc.numero || rc.id,
    os_vinculada:  rc.os_vinculada || rc.os_id || '',
    prazo_cotacao: prazoFmt,
    prazo_iso:     prazoRaw || '',
    // Status direto 'Em Cotação' — ao aceitar a RC o comprador já está iniciando o processo
    status:        'Em Cotação',
    fornecedores:  fornecedoresFlow,
    itens_cotados: itensFormatados,
    instrucoes:    obs,
    metodo_envio:  comEmail > 0 ? 'email' : 'manual',
    criado_por:    currentUser?.name || 'Comprador',
    data_criacao:  new Date().toISOString(),
    historico: [
      {
        acao: `RFQ criado – RC aceita pelo comprador`,
        usuario: currentUser?.name || 'Comprador',
        data: agora
      },
      {
        acao: `Cotação iniciada: ${fornecedoresDetalhes.length} fornecedor(es) convidado(s)${ comEmail > 0 ? ` (${comEmail} por e-mail, ${semEmail} manual)` : ' (envio manual)'}`,
        usuario: currentUser?.name || 'Comprador',
        data: agora
      }
    ],
    // campos adicionais usados por procurement.js
    numero_rfq:              rfqNum,
    os_id:                   rc.os_id || '',
    contrato:                rc.contrato || '',
    solicitante:             rc.criado_por || currentUser?.name || '',
    valor_estimado:          valorEst,
    itens:                   itensFormatados,
    fornecedores_convidados: fornecedoresConvidados,
    fornecedores_detalhes:   fornecedoresDetalhes,
    cotacoes:                [],
    observacoes:             obs,
    criado_em:               new Date().toLocaleDateString('pt-BR')
  };

  // Salva em fa_rfqs (usado por procurement.js)
  const rfqs = _getRFQs();
  rfqs.unshift(novoRFQ);
  _saveRFQs(rfqs);

  // Salva também em fa_rfq_flow (usado por fluxo_aprovacao_rc.js)
  try {
    const flowRFQs = JSON.parse(localStorage.getItem('fa_rfq_flow') || '[]');
    flowRFQs.unshift(novoRFQ);
    localStorage.setItem('fa_rfq_flow', JSON.stringify(flowRFQs));
    // Sincroniza via db.js se disponível
    if (typeof window._saveRFQFlow === 'function') window._saveRFQFlow(flowRFQs);
  } catch(e) { console.warn('Erro ao sincronizar fa_rfq_flow:', e); }

  // ── Atualiza status da RC para "Em Cotação" ──────────────────────────────────
  // Garante que a mutação está no objeto que está DENTRO do array 'rcs'
  const rcIdx = rcs.findIndex(r => r.id === rcId);
  if (rcIdx < 0) { showToast('Erro interno: RC não encontrada no array.', 'error'); return; }
  rcs[rcIdx].status     = 'Em Cotação';
  rcs[rcIdx].rfq_numero = rfqNum;
  rcs[rcIdx].rfq_id     = novoRFQ.id;
  if (!rcs[rcIdx].historico) rcs[rcIdx].historico = [];
  rcs[rcIdx].historico.push({
    acao: `Cotação iniciada – ${rfqNum} – ${fornecedoresConvidados.length} fornecedor(es) convidado(s)`,
    usuario: currentUser?.name || 'Comprador',
    data: new Date().toLocaleDateString('pt-BR')
  });

  // Persiste em fa_rcs via localStorage DIRETO + via db.js (garante ambos)
  try { localStorage.setItem('fa_rcs', JSON.stringify(rcs)); } catch(e) {}
  _procSaveRCs(rcs);
  if (typeof window._saveRC === 'function') window._saveRC(rcs);

  // Confirma que o save funcionou relendo o storage
  const verificacao = _procGetRCs().find(r => r.id === rcId);
  if (verificacao && verificacao.status !== 'Em Cotação') {
    // Fallback: força o status diretamente via localStorage
    console.warn('[RC] Save não refletiu, forçando via localStorage direto...');
    try {
      const fresh = JSON.parse(localStorage.getItem('fa_rcs') || '[]');
      const fi = fresh.findIndex(r => r.id === rcId);
      if (fi >= 0) { fresh[fi].status = 'Em Cotação'; fresh[fi].rfq_id = novoRFQ.id; fresh[fi].rfq_numero = rfqNum; }
      localStorage.setItem('fa_rcs', JSON.stringify(fresh));
    } catch(e) {}
  }

  logAction('Criar', 'RFQ', `Processo ${rfqNum} criado a partir da RC ${rc.numero || rcId}`);
  closeModal();

  let msg = `✅ Cotação iniciada! ${rfqNum} – ${fornecedoresConvidados.length} fornecedor(es) em cotação. Prazo: ${prazoFmt}`;
  if (comEmail > 0) msg += ` · ${comEmail} por e-mail`;
  if (semEmail > 0) msg += ` · ${semEmail} manual`;
  showToast(msg, 'success', 7000);

  // Re-renderiza todas as telas que possam estar visíveis
  renderRFQ();
  if (typeof renderFluxoAprovacaoRC === 'function') {
    setTimeout(() => {
      renderFluxoAprovacaoRC();
      if (typeof farcSwitchTab === 'function') setTimeout(() => farcSwitchTab('cotacoes'), 150);
    }, 100);
  }

  // Abre modal de e-mail automaticamente se houver fornecedores com e-mail
  if (comEmail > 0) {
    setTimeout(() => {
      if (typeof window._rfqAbrirModalEmail === 'function') {
        window._rfqAbrirModalEmail(rfqId);
      } else if (typeof _procEnviarEmailRFQ === 'function') {
        _procEnviarEmailRFQ(rfqId);
      }
    }, 900);
  }
}

// ─── DEVOLVER RC AO SOLICITANTE ───
function rejeitarRC_Comprador(rcId) {
  const rc = _procGetRCs().find(r => r.id === rcId);
  if (!rc) return;
  openModal('Devolver RC ao Solicitante', `
    <p style="color:var(--text-secondary);font-size:13px;margin-bottom:12px">
      RC: <strong>${rc.numero || rcId}</strong> – ${rc.titulo || rc.descricao || ''}
    </p>
    <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Motivo da devolução *</label>
    <textarea id="motDevolucaoRC" rows="3"
      placeholder="Ex: Especificação incompleta, itens já em estoque, valor acima do orçado..."
      style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box;resize:vertical"></textarea>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-danger" onclick="_confirmarDevolucaoRC('${rcId}')"><i class="fas fa-undo"></i> Devolver RC</button>
  `);
}

function _confirmarDevolucaoRC(rcId) {
  const motivo = document.getElementById('motDevolucaoRC')?.value?.trim();
  if (!motivo) { showToast('Informe o motivo da devolução.', 'warning'); return; }

  const rcs = _procGetRCs();
  const rc  = rcs.find(r => r.id === rcId);
  if (rc) {
    rc.status = 'Devolvida – Comprador';
    rc.motivo_devolucao = motivo;
    if (!rc.historico) rc.historico = [];
    rc.historico.push({
      acao: `RC devolvida pelo Comprador: ${motivo}`,
      usuario: currentUser?.name || 'Comprador',
      data: new Date().toLocaleDateString('pt-BR')
    });
    _procSaveRCs(rcs);
  }
  logAction('Devolver', 'RC', `RC ${rc?.numero || rcId} devolvida pelo comprador: ${motivo}`);
  closeModal();
  showToast('RC devolvida ao solicitante com o motivo registrado.', 'warning', 4000);
  renderRFQ();
}

// ─── SELECIONAR FORNECEDORES ───
function selecionarFornecedoresRFQ(rfqId) {
  const rfqs = _getRFQs();
  const rfq = rfqs.find(r => r.id === rfqId);
  if (!rfq) return;

  // Fornecedores já convidados (para pré-popular os cards)
  const jaConvidados = rfq.fornecedores_convidados || [];

  openModalWide('Convidar Fornecedores – ' + (rfq.numero_rfq || rfq.numero || rfqId), `
    <!-- Cabeçalho info -->
    <div style="background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.2);border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:12px">
      <div style="font-weight:700;color:#6366f1;margin-bottom:3px">
        <i class="fas fa-paper-plane" style="margin-right:6px"></i>${rfq.titulo || '—'}
      </div>
      <div style="color:var(--text-muted)">${(rfq.itens||[]).length} itens · Prazo atual: ${rfq.prazo_cotacao||'—'}</div>
    </div>

    <!-- Prazo -->
    <div style="display:flex;gap:10px;margin-bottom:14px;align-items:center;flex-wrap:wrap">
      <div>
        <label style="font-size:10px;color:var(--text-muted);display:block;margin-bottom:3px;text-transform:uppercase">Novo Prazo para Receber Cotações</label>
        <input type="date" id="rfqPrazoCotacao"
          value="${new Date(Date.now()+7*24*60*60*1000).toISOString().split('T')[0]}"
          style="padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px">
      </div>
    </div>

    <!-- ── SUGESTÕES DA IA ── -->
    <div style="margin-bottom:14px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <div style="flex:1;font-size:12px;font-weight:700;color:var(--text-primary)">
          <i class="fas fa-robot" style="color:#8b5cf6;margin-right:6px"></i>Sugestões da IA – Fornecedores com Histórico
        </div>
        <span style="font-size:10px;color:var(--text-muted);background:rgba(139,92,246,0.1);border-radius:6px;padding:2px 8px;border:1px solid rgba(139,92,246,0.2)">
          Baseado em cotações e pedidos anteriores
        </span>
      </div>
      <div id="ac_sugestoes_painel" style="display:flex;flex-direction:column;gap:5px;max-height:250px;overflow-y:auto;padding-right:2px">
        <div style="font-size:11px;color:var(--text-muted);text-align:center;padding:14px">
          <i class="fas fa-spinner fa-spin" style="margin-right:4px"></i>Analisando histórico...
        </div>
      </div>
    </div>

    <!-- Layout em 2 colunas -->
    <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:12px;align-items:start;margin-bottom:12px">

      <!-- Col 1: Busca autocomplete cadastrados -->
      <div>
        <label style="font-size:10px;color:#6366f1;font-weight:700;display:block;margin-bottom:5px;text-transform:uppercase;letter-spacing:.4px">
          <i class="fas fa-building" style="margin-right:4px"></i>Buscar Fornecedor Cadastrado
        </label>
        <div style="position:relative">
          <input type="text" id="sfr_busca"
            placeholder="🔍 Nome, CNPJ ou categoria..."
            oninput="_sfrFiltrarFornecedores()"
            onfocus="_sfrFiltrarFornecedores()"
            style="width:100%;padding:8px 10px;background:var(--bg-secondary);border:1px solid rgba(99,102,241,0.35);border-radius:8px;color:var(--text-primary);font-size:12px;box-sizing:border-box">
          <div id="sfr_dropdown"
            style="display:none;position:absolute;top:100%;left:0;right:0;background:var(--bg-card);border:1px solid var(--border-color);border-radius:8px;max-height:240px;overflow-y:auto;z-index:9999;box-shadow:0 8px 24px rgba(0,0,0,.25);margin-top:2px"></div>
        </div>
        <button onclick="_sfrAdicionarSelecionado()"
          style="margin-top:6px;width:100%;padding:7px 12px;border:none;border-radius:7px;background:#6366f1;color:#fff;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px">
          <i class="fas fa-plus"></i> Adicionar Selecionado
        </button>
        <div style="font-size:10px;color:var(--text-muted);margin-top:5px;text-align:center">
          <i class="fas fa-envelope" style="color:#22c55e"></i> = tem e-mail &nbsp;|&nbsp;
          <i class="fas fa-exclamation-triangle" style="color:#ef4444"></i> = sem e-mail (convite manual)
        </div>
      </div>

      <!-- Divisor -->
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding-top:28px;gap:6px;min-width:40px">
        <div style="width:1px;height:30px;background:var(--border-color)"></div>
        <span style="font-size:10px;color:var(--text-muted);font-weight:700;background:var(--bg-card);padding:2px 6px;border-radius:6px;border:1px solid var(--border-color)">OU</span>
        <div style="width:1px;height:30px;background:var(--border-color)"></div>
      </div>

      <!-- Col 2: Fornecedor não cadastrado -->
      <div>
        <label style="font-size:10px;color:#f59e0b;font-weight:700;display:block;margin-bottom:5px;text-transform:uppercase;letter-spacing:.4px">
          <i class="fas fa-pencil-alt" style="margin-right:4px"></i>Fornecedor Não Cadastrado
        </label>
        <input type="text" id="sfr_novo_nome"
          placeholder="Nome / razão social"
          style="width:100%;padding:8px 10px;background:var(--bg-secondary);border:1px solid rgba(245,158,11,0.35);border-radius:8px;color:var(--text-primary);font-size:12px;box-sizing:border-box;margin-bottom:5px">
        <input type="text" id="sfr_novo_email"
          placeholder="E-mail de contato (opcional)"
          style="width:100%;padding:8px 10px;background:var(--bg-secondary);border:1px solid rgba(245,158,11,0.25);border-radius:8px;color:var(--text-primary);font-size:12px;box-sizing:border-box">
        <button onclick="_sfrAdicionarNovo()"
          style="margin-top:6px;width:100%;padding:7px 12px;border:1px solid rgba(245,158,11,0.4);border-radius:7px;background:rgba(245,158,11,0.12);color:#f59e0b;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px">
          <i class="fas fa-plus"></i> Inserir Novo
        </button>
      </div>
    </div>

    <!-- Lista de fornecedores adicionados -->
    <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:6px;letter-spacing:.4px">
      <i class="fas fa-users" style="margin-right:4px"></i>Fornecedores no Processo
    </div>
    <div id="sfr_lista"
      style="display:flex;flex-direction:column;gap:6px;min-height:50px;padding:8px;background:var(--bg-card2);border:1px dashed var(--border-color);border-radius:8px">
      <div id="sfr_lista_vazia" style="font-size:12px;color:var(--text-muted);text-align:center;padding:10px">
        <i class="fas fa-user-plus" style="margin-right:4px;opacity:.4"></i>Adicione fornecedores acima
      </div>
    </div>

    <script>
      // Fecha dropdown ao clicar fora
      document.addEventListener('click', function(e) {
        if (!e.target.closest('#sfr_busca') && !e.target.closest('#sfr_dropdown')) {
          var d = document.getElementById('sfr_dropdown');
          if (d) d.style.display = 'none';
        }
      });
      // Pré-popula fornecedores já convidados
      (function() {
        var jaConv = ${JSON.stringify(jaConvidados)};
        if (!jaConv || !jaConv.length) return;
        var lista = [];
        try {
          if (typeof FA_FORNECEDORES !== 'undefined' && FA_FORNECEDORES.length) lista = FA_FORNECEDORES;
          else { var raw = localStorage.getItem('fa_fornecedores_cache') || localStorage.getItem('fa_fornecedores'); if (raw) lista = JSON.parse(raw); }
        } catch(e) {}
        jaConv.forEach(function(idOuNome) {
          var f = lista.find(function(x) { return x.id === idOuNome; });
          var nome = f ? (f.nome_fantasia || f.razao_social || f.nome || idOuNome) : idOuNome;
          var email = f ? (f.contato_email || f.email || '') : '';
          _sfrCriarCard(f ? f.id : null, nome, email, f ? 'cadastrado' : 'externo');
        });
      })();
      // Carrega sugestões da IA
      setTimeout(function() {
        if (typeof _acRenderSugestoes === 'function') {
          var rcDataSfr = ${JSON.stringify({
            id: rfq.rc_id || rfqId,
            titulo: rfq.titulo || '',
            itens: (rfq.itens||[]).map(i => ({ descricao: i.descricao||'' }))
          })};
          _acRenderSugestoes(rcDataSfr, 'sfr_lista', 'sfr_lista_vazia');
        }
      }, 250);
    </script>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="salvarFornecedoresRFQ('${rfqId}')">
      <i class="fas fa-paper-plane"></i> Confirmar e Enviar Convites
    </button>
  `);
}

// ── Helpers do modal selecionarFornecedoresRFQ ──

function _sfrCarregarLista() {
  let lista = [];
  try {
    if (typeof FA_FORNECEDORES !== 'undefined' && FA_FORNECEDORES.length > 0) {
      lista = FA_FORNECEDORES;
    } else {
      const raw = localStorage.getItem('fa_fornecedores_cache') || localStorage.getItem('fa_fornecedores');
      if (raw) lista = JSON.parse(raw);
    }
    if (!lista.length && typeof _getFornecedores === 'function') {
      lista = _getFornecedores().filter(f => f.status === 'Ativo' || f.status === 'Homologado');
    }
  } catch(e) { lista = []; }
  return lista;
}

function _sfrFiltrarFornecedores() {
  const input    = document.getElementById('sfr_busca');
  const dropdown = document.getElementById('sfr_dropdown');
  if (!input || !dropdown) return;

  const busca = (input.value || '').toLowerCase().trim();
  const lista = _sfrCarregarLista().filter(f => f.status === 'Ativo' || f.status === 'Homologado');

  let filtrados = busca.length >= 1
    ? lista.filter(f => {
        const nf   = (f.nome_fantasia || '').toLowerCase();
        const rs   = (f.razao_social  || f.nome || '').toLowerCase();
        const cnpj = (f.cnpj         || '').toLowerCase().replace(/\D/g,'');
        const cat  = (f.categoria    || f.segmento || '').toLowerCase();
        return nf.includes(busca) || rs.includes(busca) || cnpj.includes(busca.replace(/\D/g,'')) || cat.includes(busca);
      })
    : lista.slice(0, 12);

  if (filtrados.length === 0) {
    dropdown.innerHTML = `<div style="padding:12px 14px;font-size:12px;color:var(--text-muted);text-align:center">
      <i class="fas fa-search" style="margin-right:6px;opacity:.5"></i>
      Nenhum fornecedor encontrado${busca ? ` para "<b>${busca}</b>"` : ''}.
    </div>`;
    dropdown.style.display = 'block';
    return;
  }

  dropdown.innerHTML = filtrados.slice(0, 15).map(f => {
    const nf   = f.nome_fantasia || '';
    const rs   = f.razao_social  || f.nome || 'Fornecedor';
    const nome = nf || rs;
    const sub  = nf && nf !== rs ? rs : '';
    const cat  = f.categoria || f.segmento || '';
    const temEmail = !!(f.contato_email || f.email);
    const emailBadge = temEmail
      ? `<span style="font-size:10px;color:#22c55e" title="${f.contato_email||f.email}"><i class="fas fa-envelope"></i></span>`
      : `<span style="font-size:10px;color:#ef4444" title="Sem e-mail cadastrado"><i class="fas fa-exclamation-triangle"></i></span>`;
    // IDF/Score enriquecido com faixa de cor para tomada de decisão rápida
    const idfScore = f.idf_score ?? f.score_idf ?? null;
    const idfFull = idfScore != null ? (() => {
      const sc  = Number(idfScore);
      const cor = sc >= 80 ? '#22c55e' : sc >= 60 ? '#3b82f6' : sc >= 40 ? '#f59e0b' : '#ef4444';
      const lbl = sc >= 80 ? 'Ótimo' : sc >= 60 ? 'Bom' : sc >= 40 ? 'Regular' : 'Crítico';
      return `<span title="IDF: ${lbl}" style="font-size:10px;font-weight:700;background:${cor}1a;color:${cor};border-radius:4px;padding:2px 7px;white-space:nowrap">IDF ${sc.toFixed(0)} · ${lbl}</span>`;
    })() : `<span style="font-size:9px;color:var(--text-muted);background:var(--bg-tertiary);border-radius:4px;padding:1px 5px">Não avaliado</span>`;
    const catBadge = cat
      ? `<span style="font-size:9px;background:var(--bg-tertiary);color:var(--text-muted);border-radius:4px;padding:1px 5px">${cat}</span>` : '';
    const safeNome  = nome.replace(/'/g,"\\'").replace(/"/g,'&quot;');
    const safeEmail = (f.contato_email||f.email||'').replace(/'/g,"\\'");
    return `<div
      onclick="_sfrSelecionarForn('${f.id}','${safeNome}','${safeEmail}',this)"
      data-forn-id="${f.id}"
      style="padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--border-color);transition:background .12s;display:flex;align-items:center;gap:8px"
      onmouseover="this.style.background='var(--bg-secondary)'"
      onmouseout="this.style.background='transparent'">
      <div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <span style="color:#fff;font-size:11px;font-weight:700">${nome.charAt(0).toUpperCase()}</span>
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:600;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${nome}</div>
        ${sub ? `<div style="font-size:10px;color:var(--text-muted);font-style:italic;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${sub}</div>` : ''}
        <div style="display:flex;gap:4px;margin-top:2px;flex-wrap:wrap;align-items:center">${catBadge}${idfFull}</div>
      </div>
      ${emailBadge}
    </div>`;
  }).join('');

  if (filtrados.length > 15) {
    dropdown.innerHTML += `<div style="padding:6px 12px;font-size:11px;color:var(--text-muted);text-align:center">+${filtrados.length-15} outros. Refine a busca.</div>`;
  }
  dropdown.style.display = 'block';
}

function _sfrSelecionarForn(id, nome, email, el) {
  const input    = document.getElementById('sfr_busca');
  const dropdown = document.getElementById('sfr_dropdown');
  if (input) {
    input.value = nome;
    input.dataset.fornId    = id;
    input.dataset.fornNome  = nome;
    input.dataset.fornEmail = email;
    input.style.borderColor = '#22c55e';
  }
  if (dropdown) dropdown.style.display = 'none';
  if (el) { el.style.background = 'rgba(99,102,241,0.12)'; el.style.borderLeft = '3px solid #6366f1'; }
}

function _sfrAdicionarSelecionado() {
  const input = document.getElementById('sfr_busca');
  if (!input) return;
  const fornId    = input.dataset.fornId;
  const fornNome  = input.dataset.fornNome || input.value.trim();
  const fornEmail = input.dataset.fornEmail || '';
  if (!fornNome) {
    showToast('Selecione um fornecedor na lista antes de adicionar.', 'warning', 2500);
    input.focus(); return;
  }
  const lista = document.getElementById('sfr_lista');
  if (!lista) return;
  if (lista.querySelector(`[data-sfr-id="${fornId||fornNome}"]`)) {
    showToast(`"${fornNome}" já foi adicionado.`, 'warning', 2500); return;
  }
  _sfrCriarCard(fornId, fornNome, fornEmail, 'cadastrado');
  input.value = '';
  delete input.dataset.fornId;
  delete input.dataset.fornNome;
  delete input.dataset.fornEmail;
  input.style.borderColor = 'rgba(99,102,241,0.35)';
  const drop = document.getElementById('sfr_dropdown');
  if (drop) drop.style.display = 'none';
  showToast(`✅ "${fornNome}" adicionado!`, 'success', 2000);
}

function _sfrAdicionarNovo() {
  const nomeEl  = document.getElementById('sfr_novo_nome');
  const emailEl = document.getElementById('sfr_novo_email');
  const nome    = (nomeEl?.value || '').trim();
  const email   = (emailEl?.value || '').trim();
  if (!nome) {
    showToast('Informe o nome do fornecedor.', 'warning', 2500);
    nomeEl?.focus(); return;
  }
  const lista = document.getElementById('sfr_lista');
  if (!lista) return;
  if (lista.querySelector(`[data-sfr-id="${nome}"]`)) {
    showToast(`"${nome}" já foi adicionado.`, 'warning', 2500); return;
  }
  _sfrCriarCard(null, nome, email, 'externo');
  if (nomeEl)  nomeEl.value  = '';
  if (emailEl) emailEl.value = '';
  showToast(`✅ "${nome}" adicionado!`, 'success', 2000);
}

function _sfrCriarCard(id, nome, email, tipo) {
  const lista = document.getElementById('sfr_lista');
  if (!lista) return;
  const vazia = document.getElementById('sfr_lista_vazia');
  if (vazia) vazia.style.display = 'none';

  const card = document.createElement('div');
  card.dataset.sfrId    = id || nome;
  card.dataset.sfrNome  = nome;
  card.dataset.sfrEmail = email || '';
  card.dataset.sfrTipo  = tipo || 'cadastrado';
  const temEmail = !!email;
  const badgeTipo = tipo === 'cadastrado'
    ? `<span style="font-size:10px;background:rgba(99,102,241,0.15);color:#6366f1;border-radius:4px;padding:2px 6px">Cadastrado</span>`
    : `<span style="font-size:10px;background:rgba(245,158,11,0.15);color:#f59e0b;border-radius:4px;padding:2px 6px">Externo</span>`;
  const idfBadge = _procGetIdfBadge(id, nome);
  card.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 12px;background:rgba(99,102,241,0.05);border:1px solid rgba(99,102,241,0.2);border-radius:8px;font-size:12px';
  card.innerHTML = `
    <div style="width:26px;height:26px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:flex;align-items:center;justify-content:center;flex-shrink:0">
      <span style="color:#fff;font-size:10px;font-weight:700">${nome.charAt(0).toUpperCase()}</span>
    </div>
    <div style="flex:1;min-width:0">
      <div style="font-weight:600;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${nome}</div>
      <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:2px">
        ${temEmail
          ? `<span style="font-size:11px;color:#22c55e"><i class="fas fa-envelope" style="font-size:10px"></i> ${email}</span>`
          : `<span style="font-size:11px;color:#ef4444"><i class="fas fa-exclamation-triangle" style="font-size:10px"></i> Sem e-mail – envio manual</span>`
        }
        ${idfBadge}
      </div>
    </div>
    ${badgeTipo}
    <button onclick="this.closest('[data-sfr-id]').remove();var v=document.getElementById('sfr_lista');if(v&&!v.querySelector('[data-sfr-id]')){var e=document.getElementById('sfr_lista_vazia');if(e)e.style.display='';}" style="background:rgba(239,68,68,0.12);border:none;border-radius:6px;color:#ef4444;padding:4px 7px;cursor:pointer;font-size:11px" title="Remover">
      <i class="fas fa-times"></i>
    </button>
  `;
  lista.appendChild(card);
}

function salvarFornecedoresRFQ(rfqId) {
  const rfqs = _getRFQs();
  const rfqIdx = rfqs.findIndex(r => r.id === rfqId);
  if (rfqIdx < 0) return;
  const rfq = rfqs[rfqIdx];

  // Coleta fornecedores dos cards
  const cards = document.querySelectorAll('#sfr_lista [data-sfr-id]');
  if (cards.length === 0) {
    showToast('Adicione ao menos 1 fornecedor antes de confirmar.', 'warning', 3000);
    return;
  }

  // ── POLÍTICA: cotações > R$10.000 exigem mínimo 3 fornecedores ──────────────
  const rfqValorEstimado = rfq.valor_estimado || rfq.valor_total ||
    (rfq.itens || []).reduce((s, i) => s + (parseFloat(i.valor_unit || i.preco_unit || 0) * parseFloat(i.qtd || i.quantidade || 1)), 0);
  const LIMITE_3_FORN = 10000;
  if (rfqValorEstimado > LIMITE_3_FORN && cards.length < 3) {
    openModal('⚠️ Mínimo de Fornecedores',
      `<div style="text-align:center;padding:12px 0">
        <i class="fas fa-users" style="color:#f59e0b;font-size:40px;margin-bottom:10px"></i>
        <div style="font-size:15px;font-weight:700;color:#f59e0b;margin-bottom:8px">Política de Cotação — Mínimo 3 Fornecedores</div>
      </div>
      <div style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);border-radius:8px;padding:14px;font-size:13px;color:var(--text-secondary);line-height:1.7">
        <i class="fas fa-info-circle" style="color:#f59e0b;margin-right:6px"></i>
        Cotações com valor estimado <strong>acima de R$ ${LIMITE_3_FORN.toLocaleString('pt-BR')}</strong> exigem
        <strong style="color:#f59e0b">no mínimo 3 fornecedores</strong> convidados, conforme política de controle de suprimentos.<br><br>
        <strong>Valor estimado:</strong> R$ ${rfqValorEstimado.toLocaleString('pt-BR', {minimumFractionDigits:2})}<br>
        <strong>Fornecedores adicionados:</strong> <span style="color:#ef4444;font-weight:700">${cards.length}</span> (necessário: 3)
      </div>`,
      `<button class="btn btn-secondary" onclick="closeModal()">Entendido – Vou adicionar mais fornecedores</button>`
    );
    return;
  }

  const fornecedoresConvidados = [];
  const fornecedoresDetalhes   = [];
  cards.forEach(card => {
    const id    = card.dataset.sfrId;
    const nome  = card.dataset.sfrNome;
    const email = card.dataset.sfrEmail || '';
    const tipo  = card.dataset.sfrTipo  || 'cadastrado';
    fornecedoresConvidados.push(id);
    fornecedoresDetalhes.push({ id, nome, email, tipo });
  });

  rfq.fornecedores_convidados = fornecedoresConvidados;
  rfq.fornecedores_detalhes   = fornecedoresDetalhes;

  // Normaliza também o campo 'fornecedores' usado pelo fluxo_aprovacao_rc.js
  rfq.fornecedores = fornecedoresDetalhes.map(f => ({
    id:               f.id,
    nome:             f.nome,
    email:            f.email || '',
    tipo:             f.tipo  || 'cadastrado',
    cotacao_enviada:  false,
    cotacao_recebida: false,
    data_envio:       null,
    valor_total:      null,
    itens_cotados:    (rfq.itens || []).map(it => ({
      descricao: it.descricao || it.nome || '',
      qtd:       it.qtd || it.quantidade || 1,
      unidade:   it.unidade || it.un || 'Un',
      preco_unit: null,
      total:      null
    }))
  }));

  const prazoRaw = document.getElementById('rfqPrazoCotacao')?.value;
  if (prazoRaw) {
    rfq.prazo_cotacao = new Date(prazoRaw + 'T12:00:00').toLocaleDateString('pt-BR');
    rfq.prazo_iso     = prazoRaw;
  }

  // ── MUDANÇA PRINCIPAL: status → "Em Cotação" imediatamente ──────────────────
  rfq.status = 'Em Cotação';
  rfq.historico = rfq.historico || [];
  rfq.historico.unshift({
    acao: `${fornecedoresConvidados.length} fornecedor(es) definido(s). Cotação iniciada por ${currentUser?.name || 'Comprador'}`,
    usuario: currentUser?.name || 'Comprador',
    data: new Date().toLocaleString('pt-BR')
  });

  // Conta quantos têm e-mail
  const comEmail = fornecedoresDetalhes.filter(f => f.email).length;
  const semEmail = fornecedoresDetalhes.length - comEmail;

  // Salva em fa_rfqs (procurement)
  rfqs[rfqIdx] = rfq;
  _saveRFQs(rfqs);

  // Sincroniza em fa_rfq_flow (fluxo_aprovacao_rc.js)
  try {
    const flowRFQs = JSON.parse(localStorage.getItem('fa_rfq_flow') || '[]');
    const fi = flowRFQs.findIndex(r => r.id === rfqId);
    if (fi >= 0) {
      flowRFQs[fi] = { ...flowRFQs[fi], ...rfq };
    } else {
      flowRFQs.unshift(rfq);
    }
    localStorage.setItem('fa_rfq_flow', JSON.stringify(flowRFQs));
    if (typeof window._saveRFQFlow === 'function') window._saveRFQFlow(flowRFQs);
  } catch(e) { console.warn('Erro ao sincronizar fa_rfq_flow:', e); }

  logAction('Enviar', 'RFQ', `Cotação ${rfq.numero_rfq||rfq.numero} – ${fornecedoresConvidados.length} fornecedor(es) – status: Em Cotação`);
  closeModal();

  let msg = `✅ ${fornecedoresConvidados.length} fornecedor(es) definido(s)! RFQ ${rfq.numero_rfq||rfq.numero} em cotação.`;
  if (comEmail > 0) msg += ` · ${comEmail} com e-mail`;
  if (semEmail > 0) msg += ` · ${semEmail} sem e-mail (PDF manual)`;
  showToast(msg, 'success', 6000);

  // Abre modal de envio por e-mail se houver fornecedores com e-mail
  // Tenta usar a função do fluxo_aprovacao_rc.js (compartilhada)
  if (comEmail > 0 && typeof window._rfqAbrirModalEmail === 'function') {
    setTimeout(() => window._rfqAbrirModalEmail(rfqId), 700);
  } else if (comEmail === 0) {
    // Sem e-mails: gera PDF automaticamente para envio manual
    setTimeout(() => {
      if (typeof window._rfqGerarPDF_id === 'function') window._rfqGerarPDF_id(rfqId);
    }, 500);
  }

  renderRFQ();
}

// ─── REGISTRAR / EDITAR COTAÇÕES ───
// MELHORIA 2: Layout redesenhado — campos organizados por coluna de fornecedor
// Inclui: seletor de fornecedores cadastrados, valor negociado com cálculo automático,
//         flag "Declinou", critérios, e alinhamento visual por coluna
function registrarCotacoes(rfqId) {
  let rfqs = _getRFQs();
  let rfq  = rfqs.find(r => r.id === rfqId);
  // Fallback: tenta buscar no storage do fluxo de aprovação (fa_rfq_flow)
  if (!rfq) {
    try {
      const flowRFQs = JSON.parse(localStorage.getItem('fa_rfq_flow') || '[]');
      const flowRFQ  = flowRFQs.find(r => r.id === rfqId);
      if (flowRFQ) {
        // Normaliza campos para o formato do procurement
        rfq = {
          ...flowRFQ,
          numero_rfq: flowRFQ.numero_rfq || flowRFQ.numero || rfqId,
          titulo:     flowRFQ.titulo || flowRFQ.descricao || '—',
        };
      }
    } catch(e) {}
  }
  if (!rfq) {
    showToast('Processo RFQ não encontrado.', 'error');
    return;
  }

  const isEdicao = rfq.status !== 'Em Cotação';
  const itens    = rfq.itens || [];
  const forns    = rfq.fornecedores_convidados || [];
  const cotacoes = rfq.cotacoes || [];
  const criteriosExist = rfq.criterios_avaliacao || [];

  // ── largura mínima por coluna de fornecedor ──
  const colW = 150;
  const numForns = forns.length;

  const rfqLabel = rfq.numero_rfq || rfq.numero || rfqId;
  openModalWide((isEdicao ? '✏️ Editar Cotações' : '📝 Registrar Cotações') + ' — ' + rfqLabel, `
    <style>
      .cot-modal-wrap { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
      .cot-section { border-radius:10px; margin-bottom:14px; overflow:hidden; }
      .cot-section-hdr { padding:10px 14px; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; display:flex; align-items:center; gap:8px; }
      .cot-tbl { width:100%; border-collapse:collapse; font-size:12px; }
      .cot-tbl thead th { padding:10px 8px; font-size:10.5px; font-weight:700; text-align:center; border-bottom:2px solid var(--border-color); white-space:nowrap; }
      .cot-tbl thead th.lbl-col { text-align:left; min-width:170px; }
      .cot-tbl tbody tr { border-bottom:1px solid var(--border-color); }
      .cot-tbl tbody td { padding:7px 8px; vertical-align:middle; }
      .cot-tbl tbody td.lbl-cell { font-size:11px; font-weight:600; color:var(--text-secondary); min-width:170px; padding-left:10px; }
      .cot-inp { width:100%; padding:7px 8px; background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:6px; color:var(--text-primary); font-size:12px; box-sizing:border-box; text-align:right; }
      .cot-inp:focus { border-color:var(--fa-teal); outline:none; }
      .cot-inp.disabled { opacity:.45; cursor:not-allowed; }
      .forn-header-badge { display:inline-flex; align-items:center; justify-content:center; width:26px; height:26px; border-radius:50%; font-size:11px; font-weight:800; margin-bottom:4px; }
    </style>

    <div class="cot-modal-wrap">
    ${isEdicao ? `
      <div style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:#f59e0b;display:flex;gap:10px;align-items:center">
        <i class="fas fa-exclamation-triangle"></i>
        <span><strong>Modo edição</strong> — status atual: <em>${rfq.status}</em>. Ao salvar, o mapa comparativo será recriado e aprovações anteriores <strong>canceladas</strong>.</span>
      </div>
    ` : ''}

    <!-- ══ SEÇÃO 1: CRITÉRIOS DE AVALIAÇÃO ══ -->
    <div class="cot-section" style="background:rgba(0,180,184,0.05);border:1px solid rgba(0,180,184,0.2)">
      <div class="cot-section-hdr" style="background:rgba(0,180,184,0.08);color:var(--fa-teal)">
        <i class="fas fa-sliders-h"></i>Critérios de Avaliação
      </div>
      <div style="padding:10px 14px">
        <div style="display:flex;flex-wrap:wrap;gap:7px;margin-bottom:8px">
          ${[{v:'preco',l:'💰 Menor Preço'},{v:'prazo',l:'⏱ Prazo'},{v:'pagamento',l:'💳 Pagamento'},{v:'frete',l:'🚚 Frete'},{v:'historico',l:'⭐ Histórico'},{v:'tecnico',l:'🔧 Técnico'},{v:'total_negociado',l:'🤝 Total Negociado'}].map(c => `
            <label style="display:flex;align-items:center;gap:5px;padding:5px 10px;background:var(--bg-card);border:1px solid var(--border-color);border-radius:20px;cursor:pointer;font-size:11px;white-space:nowrap;transition:.15s"
              onmouseover="this.style.borderColor='var(--fa-teal)'" onmouseout="this.style.borderColor='var(--border-color)'">
              <input type="checkbox" class="rfq-criterio-cb" value="${c.v}" style="accent-color:var(--fa-teal)" ${criteriosExist.includes(c.v)?'checked':''}>
              ${c.l}
            </label>
          `).join('')}
        </div>
        <input type="text" id="rfqCriterioObs" placeholder="Observação adicional (opcional)"
          value="${rfq.criterios_obs || ''}"
          style="width:100%;padding:7px 10px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:6px;color:var(--text-primary);font-size:12px;box-sizing:border-box">
      </div>
    </div>

    <!-- ══ SEÇÃO 2: ADICIONAR FORNECEDOR ══ -->
    <div class="cot-section" style="background:rgba(139,92,246,0.04);border:1px solid rgba(139,92,246,0.25)">
      <div class="cot-section-hdr" style="background:rgba(139,92,246,0.08);color:#8b5cf6">
        <i class="fas fa-user-plus"></i>Adicionar Fornecedor ao Processo
        <span style="font-size:10px;color:var(--text-muted);font-weight:400">${numForns} fornecedor(es) no processo</span>
      </div>
      <div style="padding:10px 14px;display:grid;grid-template-columns:1fr auto 1fr;gap:12px;align-items:start">

        <!-- Col 1: Fornecedores cadastrados -->
        <div>
          <label style="font-size:10px;color:#8b5cf6;font-weight:700;display:block;margin-bottom:5px;text-transform:uppercase;letter-spacing:.4px">
            <i class="fas fa-building" style="margin-right:4px"></i>Selecionar Cadastrado
          </label>
          <div style="position:relative">
            <input type="text" id="rfqFornCadInput"
              placeholder="🔍 Digite o nome, CNPJ ou categoria..."
              oninput="_rfqFiltrarFornecedoresCad()"
              onfocus="_rfqFiltrarFornecedoresCad()"
              onclick="_rfqFiltrarFornecedoresCad()"
              autocomplete="off"
              style="width:100%;padding:8px 10px;background:var(--bg-secondary);border:1px solid rgba(139,92,246,0.35);border-radius:8px;color:var(--text-primary);font-size:12px;box-sizing:border-box">
            <div id="rfqFornCadDropdown" style="display:none;position:absolute;top:100%;left:0;right:0;background:var(--bg-card);border:1px solid var(--border-color);border-radius:8px;max-height:180px;overflow-y:auto;z-index:999;box-shadow:0 8px 24px rgba(0,0,0,.25);margin-top:2px"></div>
          </div>
          <button onclick="_rfqAdicionarFornCadastrado('${rfqId}')" style="margin-top:6px;width:100%;padding:7px 12px;border:none;border-radius:7px;background:#8b5cf6;color:#fff;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px">
            <i class="fas fa-plus"></i> Adicionar Selecionado
          </button>
        </div>

        <!-- Divisor central -->
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding-top:24px;gap:6px;min-width:40px">
          <div style="width:1px;height:30px;background:var(--border-color)"></div>
          <span style="font-size:10px;color:var(--text-muted);font-weight:700;background:var(--bg-card);padding:2px 6px;border-radius:6px;border:1px solid var(--border-color)">OU</span>
          <div style="width:1px;height:30px;background:var(--border-color)"></div>
        </div>

        <!-- Col 2: Novo fornecedor -->
        <div>
          <label style="font-size:10px;color:#f59e0b;font-weight:700;display:block;margin-bottom:5px;text-transform:uppercase;letter-spacing:.4px">
            <i class="fas fa-pencil-alt" style="margin-right:4px"></i>Inserir Novo Fornecedor
          </label>
          <input type="text" id="rfqNovoFornInput"
            placeholder="Nome / razão social do novo fornecedor"
            style="width:100%;padding:8px 10px;background:var(--bg-secondary);border:1px solid rgba(245,158,11,0.35);border-radius:8px;color:var(--text-primary);font-size:12px;box-sizing:border-box">
          <button onclick="_rfqAdicionarFornAoCotacao('${rfqId}')" style="margin-top:6px;width:100%;padding:7px 12px;border:1px solid rgba(245,158,11,0.4);border-radius:7px;background:rgba(245,158,11,0.12);color:#f59e0b;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px">
            <i class="fas fa-plus"></i> Inserir Novo
          </button>
        </div>
      </div>
    </div>
    <script>
      // Fechar dropdown ao clicar fora
      document.addEventListener('click',function(e){
        if(!e.target.closest('#rfqFornCadInput')&&!e.target.closest('#rfqFornCadDropdown')){
          var d=document.getElementById('rfqFornCadDropdown');
          if(d)d.style.display='none';
        }
      });
      // Garantir campo vazio ao abrir o modal
      (function(){
        var inp = document.getElementById('rfqFornCadInput');
        if(inp){ inp.value=''; delete inp.dataset.fornId; delete inp.dataset.fornNome; inp.style.borderColor='rgba(139,92,246,0.35)'; }
      })();
    </script>

    ${numForns === 0 ? `
      <div style="text-align:center;padding:30px;background:var(--bg-secondary);border-radius:10px;border:2px dashed var(--border-color)">
        <i class="fas fa-users" style="font-size:32px;color:var(--text-muted);display:block;margin-bottom:10px;opacity:.4"></i>
        <div style="font-size:13px;font-weight:600;color:var(--text-secondary)">Nenhum fornecedor adicionado</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:4px">Adicione fornecedores acima para preencher as cotações</div>
      </div>
    ` : `

    <!-- ══ SEÇÃO 3+4: PREÇOS POR ITEM E CONDIÇÕES COMERCIAIS (tabela unificada) ══ -->
    <div class="cot-section" style="border:1px solid var(--border-color)">
      <div class="cot-section-hdr" style="background:var(--bg-tertiary);color:var(--text-secondary)">
        <i class="fas fa-table" style="color:var(--fa-teal)"></i>Preços por Item &amp; Condições Comerciais
        <span style="font-size:10px;font-weight:400;color:var(--text-muted)">${itens.length} item(ns) · ${numForns} fornecedor(es)</span>
      </div>
      <div style="overflow-x:auto">
        <table class="cot-tbl">
          <!-- Cabeçalho único de fornecedores -->
          <thead>
            <tr style="background:var(--bg-tertiary)">
              <th class="lbl-col" style="text-align:left;padding-left:12px">ITEM / CONDIÇÃO</th>
              <th style="min-width:80px">QTD / UN</th>
              ${forns.map((f, fi) => {
                const cot = cotacoes.find(c => c.forn_idx === fi);
                const declinou = cot?.declinou === true;
                const nomeForn = _rfqNomeForn(f);
                const labelF = _rfqLabelForn(f, fi);
                return `<th style="min-width:${colW}px;${declinou?'opacity:.45;':''}padding:10px 8px;border-left:1px solid var(--border-color)">
                  <div class="forn-header-badge" style="background:${declinou?'rgba(239,68,68,.12)':'rgba(0,180,184,.12)'};color:${declinou?'#ef4444':'var(--fa-teal)'};">${fi+1}</div>
                  <div style="font-size:11px;font-weight:700;color:${declinou?'#ef4444':'var(--text-primary)'};max-width:${colW-10}px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:3px" title="${nomeForn}">${nomeForn.length>22?nomeForn.substring(0,22)+'…':nomeForn}</div>
                  <div style="font-size:9px;color:var(--text-muted);margin-top:2px">${labelF}</div>
                  ${declinou ? '<div style="background:#ef444422;color:#ef4444;border-radius:4px;padding:1px 6px;font-size:9px;font-weight:700;margin-top:3px;display:inline-block">🚫 DECLINOU</div>' : ''}
                </th>`;
              }).join('')}
            </tr>
          </thead>
          <tbody>

            <!-- ══ BLOCO A: PREÇOS POR ITEM ══ -->
            <tr style="background:rgba(0,180,184,0.06)">
              <td colspan="${numForns+2}" style="padding:6px 12px;font-size:10px;font-weight:800;color:var(--fa-teal);text-transform:uppercase;letter-spacing:.6px;border-top:2px solid rgba(0,180,184,.2);border-bottom:1px solid rgba(0,180,184,.15)">
                <i class="fas fa-tag" style="margin-right:5px"></i>Preços Unitários por Item
              </td>
            </tr>
            ${itens.length === 0 ? `
              <tr><td colspan="${numForns+2}" style="text-align:center;padding:20px;color:var(--text-muted);font-size:12px">
                <i class="fas fa-inbox" style="display:block;font-size:22px;margin-bottom:6px;opacity:.3"></i>Nenhum item no processo
              </td></tr>
            ` : itens.map((item, idx) => `
              <tr style="${idx%2===0?'background:var(--bg-card)':'background:var(--bg-secondary)'}">
                <td class="lbl-cell" style="padding-left:12px">
                  <div style="font-weight:600;color:var(--text-primary)">${item.descricao}</div>
                  ${item.especificacao ? `<div style="font-size:10px;color:var(--text-muted)">${item.especificacao}</div>` : ''}
                </td>
                <td style="text-align:center;color:var(--text-muted);font-size:11px;font-weight:600">
                  <span style="background:var(--bg-tertiary);border-radius:5px;padding:3px 8px">${item.qtd || 1} ${item.unidade || 'Un'}</span>
                </td>
                ${forns.map((f, fi) => {
                  const cot = cotacoes.find(c => c.forn_idx === fi);
                  const declinou = cot?.declinou === true;
                  const existing = cot?.itens?.[idx]?.preco || '';
                  return `<td style="padding:5px 8px;min-width:${colW}px;border-left:1px solid var(--border-color)">
                    <input type="number" data-item="${idx}" data-forn="${fi}" data-qtd="${item.qtd||1}" class="cot-inp cot-input"
                      placeholder="R$ unit." value="${existing}" min="0" step="0.01"
                      ${declinou ? 'disabled' : `oninput="_rfqCalcNegociado(${fi})"`}
                      style="width:100%;padding:7px 8px;background:${declinou?'var(--bg-tertiary)':'var(--bg-secondary)'};border:1px solid ${declinou?'var(--border-color)':'rgba(0,180,184,.25)'};border-radius:6px;color:${declinou?'var(--text-muted)':'var(--text-primary)'};font-size:12px;box-sizing:border-box;text-align:right;${declinou?'opacity:.45;cursor:not-allowed;':''}"
                    >
                  </td>`;
                }).join('')}
              </tr>
            `).join('')}

            <!-- ── Subtotal dos itens (em tempo real) ── -->
            ${itens.length > 0 ? `
            <tr style="background:var(--fa-dark)">
              <td style="padding:9px 12px;font-weight:800;font-size:11px;color:#fff;text-transform:uppercase;letter-spacing:.5px">
                <i class="fas fa-calculator" style="margin-right:5px;color:var(--fa-teal)"></i>SUBTOTAL ITENS
              </td>
              <td style="border-left:0"></td>
              ${forns.map((f, fi) => {
                const cot = cotacoes.find(c => c.forn_idx === fi);
                const declinou = cot?.declinou === true;
                const subInit = declinou ? 0 : (cot?.itens || []).reduce((s, it, idx2) => s + (parseFloat(it?.total || 0) || parseFloat(it?.preco || 0) * parseFloat(itens[idx2]?.qtd || 1)), 0);
                return `<td id="rfqSubtotalF${fi}" style="padding:9px 12px;text-align:right;font-weight:800;font-size:13px;color:${declinou?'#fca5a5':'#4ade80'};border-left:1px solid rgba(255,255,255,.1)">
                  ${declinou ? '<span style="font-size:10px">DECLINOU</span>' : (subInit > 0 ? subInit.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}) : '<span style="opacity:.4;font-size:11px">—</span>')}
                </td>`;
              }).join('')}
            </tr>
            ` : ''}

            <!-- ══ BLOCO B: CONDIÇÕES COMERCIAIS ══ -->
            <tr style="background:rgba(99,102,241,0.07)">
              <td colspan="${numForns+2}" style="padding:6px 12px;font-size:10px;font-weight:800;color:#6366f1;text-transform:uppercase;letter-spacing:.6px;border-top:2px solid rgba(99,102,241,.2);border-bottom:1px solid rgba(99,102,241,.15)">
                <i class="fas fa-handshake" style="margin-right:5px"></i>Condições Comerciais
              </td>
            </tr>

            <!-- ── Linha: DECLINOU ── -->
            <tr style="background:rgba(239,68,68,0.04)">
              <td class="lbl-cell" style="padding-left:12px" colspan="2">
                <span style="color:#ef4444"><i class="fas fa-ban" style="margin-right:5px"></i>DECLINOU DO PROCESSO</span>
              </td>
              ${forns.map((f, fi) => {
                const cot = cotacoes.find(c=>c.forn_idx===fi);
                const checked = cot?.declinou === true;
                return `<td style="text-align:center;padding:7px 8px;min-width:${colW}px;border-left:1px solid var(--border-color)">
                  <label style="display:inline-flex;align-items:center;gap:7px;cursor:pointer;padding:5px 10px;background:${checked?'rgba(239,68,68,.1)':'var(--bg-secondary)'};border:1px solid ${checked?'rgba(239,68,68,.4)':'var(--border-color)'};border-radius:7px;transition:.15s">
                    <input type="checkbox" data-declinou="${fi}" class="declinou-input" ${checked?'checked':''}
                      style="accent-color:#ef4444;width:15px;height:15px"
                      onchange="_rfqToggleDeclinou(${fi})">
                    <span style="color:#ef4444;font-size:11px;font-weight:600">Declinou</span>
                  </label>
                </td>`;
              }).join('')}
            </tr>
            <!-- ── Linha: PRAZO ENTREGA ── -->
            <tr>
              <td class="lbl-cell" style="padding-left:12px" colspan="2"><i class="fas fa-truck" style="margin-right:6px;color:#f59e0b"></i>PRAZO ENTREGA (dias)</td>
              ${forns.map((f, fi) => {
                const cot = cotacoes.find(c=>c.forn_idx===fi);
                const ex = cot?.prazo_entrega || '';
                const declinou = cot?.declinou === true;
                return `<td style="padding:5px 8px;min-width:${colW}px;border-left:1px solid var(--border-color)">
                  <input type="number" data-prazo="${fi}" class="prazo-input"
                    placeholder="dias" value="${ex}" min="1" ${declinou?'disabled':''}
                    style="width:100%;padding:7px 8px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:6px;color:var(--text-primary);font-size:12px;text-align:center;box-sizing:border-box;${declinou?'opacity:.45;cursor:not-allowed;':''}">
                </td>`;
              }).join('')}
            </tr>
            <!-- ── Linha: COND. PAGAMENTO ── -->
            <tr style="background:var(--bg-secondary)">
              <td class="lbl-cell" style="padding-left:12px" colspan="2"><i class="fas fa-credit-card" style="margin-right:6px;color:#3b82f6"></i>COND. PAGAMENTO</td>
              ${forns.map((f, fi) => {
                const cot = cotacoes.find(c=>c.forn_idx===fi);
                const ex = cot?.cond_pagamento || '';
                const declinou = cot?.declinou === true;
                return `<td style="padding:5px 8px;min-width:${colW}px;border-left:1px solid var(--border-color)">
                  <select data-cond="${fi}" class="cond-input" ${declinou?'disabled':''}
                    style="width:100%;padding:7px 8px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:6px;color:var(--text-primary);font-size:11px;box-sizing:border-box;${declinou?'opacity:.45;cursor:not-allowed;':''}">
                    <option value="">Selecionar</option>
                    <option ${ex==='Antecipado'?'selected':''}>Antecipado</option>
                    <option ${ex==='À entrega'?'selected':''}>À entrega</option>
                    <option ${ex==='15 dias'?'selected':''}>15 dias</option>
                    <option ${ex==='30 dias'?'selected':''}>30 dias</option>
                    <option ${ex==='45 dias'?'selected':''}>45 dias</option>
                    <option ${ex==='60 dias'?'selected':''}>60 dias</option>
                    <option ${ex==='90 dias'?'selected':''}>90 dias</option>
                  </select>
                </td>`;
              }).join('')}
            </tr>
            <!-- ── Linha: TIPO FRETE ── -->
            <tr>
              <td class="lbl-cell" style="padding-left:12px" colspan="2"><i class="fas fa-shipping-fast" style="margin-right:6px;color:#8b5cf6"></i>TIPO DE FRETE</td>
              ${forns.map((f, fi) => {
                const cot = cotacoes.find(c=>c.forn_idx===fi);
                const ex = cot?.frete || 'CIF';
                const declinou = cot?.declinou === true;
                return `<td style="padding:5px 8px;min-width:${colW}px;border-left:1px solid var(--border-color)">
                  <select data-frete="${fi}" class="frete-input" ${declinou?'disabled':''}
                    style="width:100%;padding:7px 8px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:6px;color:var(--text-primary);font-size:11px;box-sizing:border-box;${declinou?'opacity:.45;cursor:not-allowed;':''}">
                    <option ${ex==='CIF'?'selected':''}>CIF</option>
                    <option ${ex==='FOB'?'selected':''}>FOB</option>
                    <option ${ex==='A combinar'?'selected':''}>A combinar</option>
                  </select>
                </td>`;
              }).join('')}
            </tr>
            <!-- ── Linha: VALOR FRETE ── -->
            <tr style="background:var(--bg-secondary)">
              <td class="lbl-cell" style="padding-left:12px" colspan="2"><i class="fas fa-dollar-sign" style="margin-right:6px;color:#8b5cf6"></i>VALOR FRETE (R$)</td>
              ${forns.map((f, fi) => {
                const cot = cotacoes.find(c=>c.forn_idx===fi);
                const ex = cot?.valor_frete || '';
                const declinou = cot?.declinou === true;
                return `<td style="padding:5px 8px;min-width:${colW}px;border-left:1px solid var(--border-color)">
                  <input type="number" data-frete-val="${fi}" class="frete-val-input"
                    placeholder="0,00" value="${ex}" min="0" step="0.01" ${declinou?'disabled':''}
                    style="width:100%;padding:7px 8px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:6px;color:var(--text-primary);font-size:12px;text-align:right;box-sizing:border-box;${declinou?'opacity:.45;cursor:not-allowed;':''}"
                    ${declinou?'':'oninput="_rfqCalcNegociado('+fi+')"'}>
                </td>`;
              }).join('')}
            </tr>
            <!-- ── Linha: TOTAL BRUTO (subtotal + frete, tempo real) ── -->
            <tr style="background:rgba(99,102,241,0.06)">
              <td class="lbl-cell" style="padding-left:12px;border-left:3px solid #6366f1" colspan="2">
                <span style="color:#6366f1;font-weight:700"><i class="fas fa-sigma" style="margin-right:5px"></i>TOTAL BRUTO (R$)</span>
                <div style="font-size:10px;color:var(--text-muted);font-weight:400;margin-top:1px">Subtotal + frete</div>
              </td>
              ${forns.map((f, fi) => {
                const cot = cotacoes.find(c=>c.forn_idx===fi);
                const declinou = cot?.declinou === true;
                const subInit = declinou ? 0 : (cot?.itens || []).reduce((s, it, idx2) => s + (parseFloat(it?.total || 0) || parseFloat(it?.preco || 0) * parseFloat(itens[idx2]?.qtd || 1)), 0);
                const freteInit = parseFloat(cot?.valor_frete || 0);
                const totalBrutoInit = subInit + freteInit;
                return `<td style="padding:5px 8px;min-width:${colW}px;border-left:1px solid var(--border-color)">
                  <div id="rfqTotalBrutoF${fi}" style="padding:7px 10px;background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.3);border-radius:6px;color:${declinou?'#ef4444':'#6366f1'};font-size:13px;font-weight:800;text-align:right;min-height:34px;display:flex;align-items:center;justify-content:flex-end">
                    ${declinou ? '<span style="font-size:10px">DECLINOU</span>' : (totalBrutoInit > 0 ? totalBrutoInit.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}) : '<span style="opacity:.4;font-size:11px">—</span>')}
                  </div>
                </td>`;
              }).join('')}
            </tr>
            <!-- ── Linha: VALOR NEGOCIADO ── -->
            <tr style="background:rgba(34,197,94,0.05)">
              <td class="lbl-cell" style="padding-left:12px;border-left:3px solid #22c55e" colspan="2">
                <span style="color:#22c55e;font-weight:700"><i class="fas fa-handshake" style="margin-right:5px"></i>VALOR NEGOCIADO (R$)</span>
                <div style="font-size:10px;color:var(--text-muted);font-weight:400;margin-top:1px">Total final acordado (desc. automático)</div>
              </td>
              ${forns.map((f, fi) => {
                const cot = cotacoes.find(c=>c.forn_idx===fi);
                const exNeg = cot?.valor_negociado_final != null ? cot.valor_negociado_final : (cot?.total_negociado || '');
                const declinou = cot?.declinou === true;
                return `<td style="padding:5px 8px;min-width:${colW}px;border-left:1px solid var(--border-color)">
                  <input type="number" data-neg-val="${fi}" class="neg-val-input"
                    placeholder="Valor negociado" value="${exNeg}" min="0" step="0.01" ${declinou?'disabled':''}
                    style="width:100%;padding:7px 8px;background:${declinou?'var(--bg-secondary)':'rgba(34,197,94,0.08)'};border:2px solid ${declinou?'var(--border-color)':'rgba(34,197,94,0.4)'};border-radius:6px;color:var(--text-primary);font-size:12px;text-align:right;box-sizing:border-box;font-weight:700;${declinou?'opacity:.45;cursor:not-allowed;':''}"
                    ${declinou?'':'oninput="_rfqCalcNegociado('+fi+')"'}>
                  <div id="rfqDescAutoF${fi}" style="font-size:10px;color:#22c55e;text-align:right;margin-top:2px;font-weight:600"></div>
                </td>`;
              }).join('')}
            </tr>
            <!-- ── Linha: OBS. NEGOCIAÇÃO ── -->
            <tr>
              <td class="lbl-cell" style="padding-left:12px" colspan="2"><i class="fas fa-comment-dots" style="margin-right:6px;color:#64748b"></i>OBS. NEGOCIAÇÃO</td>
              ${forns.map((f, fi) => {
                const cot = cotacoes.find(c=>c.forn_idx===fi);
                const ex = cot?.obs_negociacao || '';
                const declinou = cot?.declinou === true;
                return `<td style="padding:5px 8px;min-width:${colW}px;border-left:1px solid var(--border-color)">
                  <input type="text" data-obs="${fi}" class="obs-input"
                    placeholder="Ex: desconto negociado..." value="${ex}" ${declinou?'disabled':''}
                    style="width:100%;padding:7px 8px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:6px;color:var(--text-primary);font-size:11px;box-sizing:border-box;${declinou?'opacity:.45;cursor:not-allowed;':''}">
                </td>`;
              }).join('')}
            </tr>

          </tbody>
        </table>
      </div>
    </div>

    <div style="font-size:11px;color:var(--text-muted);padding:8px 12px;background:rgba(0,180,184,0.05);border:1px solid rgba(0,180,184,0.2);border-radius:8px;display:flex;gap:10px;align-items:flex-start">
      <i class="fas fa-info-circle" style="color:var(--fa-teal);flex-shrink:0;margin-top:1px"></i>
      <span>O <strong>Valor Negociado</strong> é o total final acordado (produto + frete + desconto). O sistema calcula o % de desconto automaticamente.
      Fornecedores marcados como <strong>Declinou</strong> aparecem no mapa com indicação visual mas não são considerados na recomendação.</span>
    </div>
    `}
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    ${isEdicao ? `<button class="btn btn-warning" onclick="salvarCotacoes('${rfqId}', true)" style="background:#f59e0b;color:#fff;border:none"><i class="fas fa-save"></i> Salvar e Recriar Mapa</button>` : ''}
    <button class="btn btn-primary" onclick="salvarCotacoes('${rfqId}', false)"><i class="fas fa-save"></i> Salvar Cotações</button>
  `);
}

function salvarCotacoes(rfqId, recriarMapa) {
  const rfqs = _getRFQs();
  const rfq = rfqs.find(r => r.id === rfqId);
  if (!rfq) return;

  // Salva os critérios de avaliação escolhidos
  const criteriosCbs = document.querySelectorAll('.rfq-criterio-cb:checked');
  rfq.criterios_avaliacao = Array.from(criteriosCbs).map(cb => cb.value);
  rfq.criterios_obs = document.getElementById('rfqCriterioObs')?.value?.trim() || '';

  const cotacoes = [];
  const fornArray = rfq.fornecedores_convidados || [];
  fornArray.forEach((f, fi) => {
    const itensInput  = document.querySelectorAll(`.cot-input[data-forn="${fi}"]`);
    const prazoInput  = document.querySelector(`.prazo-input[data-prazo="${fi}"]`);
    const condInput   = document.querySelector(`.cond-input[data-cond="${fi}"]`);
    const freteInput  = document.querySelector(`.frete-input[data-frete="${fi}"]`);
    const freteValInp = document.querySelector(`.frete-val-input[data-frete-val="${fi}"]`);
    const negValInp   = document.querySelector(`.neg-val-input[data-neg-val="${fi}"]`);
    const obsInput    = document.querySelector(`.obs-input[data-obs="${fi}"]`);
    const declinouCb  = document.querySelector(`.declinou-input[data-declinou="${fi}"]`);

    const declinou = declinouCb?.checked === true;

    const itensCot = Array.from(itensInput).map((inp, idx) => ({
      item_idx:  idx,
      descricao: rfq.itens[idx]?.descricao || '',
      qtd:       rfq.itens[idx]?.qtd || 1,
      unidade:   rfq.itens[idx]?.unidade || 'Un',
      preco:     parseFloat(inp.value || 0),
      total:     parseFloat(inp.value || 0) * (rfq.itens[idx]?.qtd || 1)
    }));

    const subtotal   = itensCot.reduce((a,x) => a + x.total, 0);
    const valorFrete = parseFloat(freteValInp?.value || 0);
    const totalBruto = subtotal + valorFrete;

    // Valor negociado final digitado pelo comprador
    const valorNegFinal = parseFloat(negValInp?.value || 0);
    // Se valor negociado foi informado e é menor que o bruto → calcula desconto %
    let desconto_pct = 0;
    let desconto_valor = 0;
    let total_negociado = totalBruto;

    if (valorNegFinal > 0) {
      total_negociado = valorNegFinal;
      if (totalBruto > 0 && valorNegFinal < totalBruto) {
        desconto_valor = totalBruto - valorNegFinal;
        desconto_pct   = parseFloat(((desconto_valor / totalBruto) * 100).toFixed(2));
      }
    }

    cotacoes.push({
      forn_idx:               fi,
      fornecedor:             f,
      itens:                  itensCot,
      subtotal,
      valor_frete:            valorFrete,
      frete:                  freteInput?.value || 'CIF',
      total:                  subtotal,          // bruto sem negociação
      total_bruto_c_frete:    totalBruto,
      valor_negociado_final:  valorNegFinal > 0 ? valorNegFinal : totalBruto,
      desconto_pct,
      desconto_valor,
      total_negociado,        // valor final negociado
      prazo_entrega:          prazoInput?.value  || '',
      cond_pagamento:         condInput?.value   || '',
      obs_negociacao:         obsInput?.value    || '',
      declinou,
      data_registro:          new Date().toLocaleDateString('pt-BR')
    });
  });

  rfq.cotacoes = cotacoes;

  // Se estava em Mapa em Análise e escolheu recriar → cancela mapa existente
  if (recriarMapa) {
    const matrizes = _getMatrizes();
    const matrizAnt = matrizes.find(m => m.rfq_id === rfqId);
    if (matrizAnt) {
      const statusAnterior = matrizAnt.status;
      matrizAnt.status = 'Cancelada – Cotações Revisadas';
      matrizAnt.cancelado_em = new Date().toLocaleDateString('pt-BR');
      matrizAnt.cancelado_por = currentUser?.name || '';
      _saveMatrizes(matrizes);

      if (['Aprovada', 'Aguardando Aprovação'].includes(statusAnterior)) {
        rfq.status = 'Cotações Recebidas';
        rfq.matriz_id = null;
        _saveRFQs(rfqs);
        logAction('Cancelar', 'Mapa', `Mapa anterior cancelado por revisão de cotações – ${rfq.numero_rfq}`);
        closeModal();
        showToast(`⚠️ Mapa anterior (${statusAnterior}) cancelado. Cotações atualizadas. Crie um novo mapa comparativo.`, 'warning', 7000);
        renderRFQ();
        return;
      }
    }
    rfq.status = 'Cotações Recebidas';
    rfq.matriz_id = null;
  } else {
    rfq.status = 'Cotações Recebidas';
  }

  _saveRFQs(rfqs);
  logAction('Registrar', 'RFQ', `Cotações ${recriarMapa?'atualizadas':'registradas'} para ${rfq.numero_rfq}`);
  closeModal();
  showToast(recriarMapa
    ? 'Cotações atualizadas! Crie o novo mapa comparativo.'
    : 'Cotações salvas! Acesse "Cotações Recebidas" para abrir o mapa comparativo.',
    'success', 5000);
  renderRFQ();
}

// Helper: calcula e exibe desconto automático ao digitar o valor negociado
function _rfqCalcNegociado(fi) {
  const cotInputs   = document.querySelectorAll(`.cot-input[data-forn="${fi}"]`);
  const freteValInp = document.querySelector(`.frete-val-input[data-frete-val="${fi}"]`);
  const negValInp   = document.querySelector(`.neg-val-input[data-neg-val="${fi}"]`);
  const display     = document.getElementById(`rfqDescAutoF${fi}`);
  const subtotalEl  = document.getElementById(`rfqSubtotalF${fi}`);

  let subtotal = 0;
  cotInputs.forEach(inp => {
    const preco = parseFloat(inp.value || 0);
    const qtd   = parseFloat(inp.getAttribute('data-qtd') || 1);
    subtotal += preco * qtd;
  });

  // Atualiza célula de subtotal em tempo real
  if (subtotalEl) {
    if (subtotal > 0) {
      subtotalEl.innerHTML = subtotal.toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
      subtotalEl.style.color = '#4ade80';
    } else {
      subtotalEl.innerHTML = '<span style="opacity:.4;font-size:11px">—</span>';
    }
  }

  const frete      = parseFloat(freteValInp?.value || 0);
  const totalBruto = subtotal + frete;
  const valorNeg   = parseFloat(negValInp?.value || 0);

  // Atualiza TOTAL BRUTO em tempo real
  const totalBrutoEl = document.getElementById(`rfqTotalBrutoF${fi}`);
  if (totalBrutoEl) {
    if (totalBruto > 0) {
      totalBrutoEl.innerHTML = totalBruto.toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
      totalBrutoEl.style.color = '#6366f1';
    } else {
      totalBrutoEl.innerHTML = '<span style="opacity:.4;font-size:11px">—</span>';
    }
  }

  if (display) {
    if (valorNeg > 0 && totalBruto > 0) {
      if (valorNeg < totalBruto) {
        const descValor = totalBruto - valorNeg;
        const descPct   = ((descValor / totalBruto) * 100).toFixed(1);
        display.innerHTML = `↓ Desc. ${descPct}% = -R$ ${descValor.toFixed(2).replace('.',',')} automático`;
        display.style.color = '#22c55e';
      } else if (valorNeg > totalBruto) {
        display.innerHTML = `⚠ Valor negociado maior que o bruto`;
        display.style.color = '#f59e0b';
      } else {
        display.innerHTML = `= Sem desconto`;
        display.style.color = 'var(--text-muted)';
      }
    } else {
      display.innerHTML = '';
    }
  }
}

// Helper: toggle visual do fornecedor que declinou
function _rfqToggleDeclinou(fi) {
  const declinou = document.querySelector(`.declinou-input[data-declinou="${fi}"]`)?.checked;
  // Desabilita/habilita todos os inputs deste fornecedor
  const selectors = [
    `.cot-input[data-forn="${fi}"]`,
    `.prazo-input[data-prazo="${fi}"]`,
    `.cond-input[data-cond="${fi}"]`,
    `.frete-input[data-frete="${fi}"]`,
    `.frete-val-input[data-frete-val="${fi}"]`,
    `.neg-val-input[data-neg-val="${fi}"]`,
    `.obs-input[data-obs="${fi}"]`
  ];
  selectors.forEach(sel => {
    document.querySelectorAll(sel).forEach(el => {
      el.disabled = declinou;
      el.style.opacity = declinou ? '0.4' : '1';
    });
  });
}

// ─── HELPER: carrega lista consolidada de fornecedores de todas as fontes ─────
function _rfqCarregarListaFornecedores() {
  let lista = [];
  // 1) Variável global em memória (carregada pelo módulo fornecedores.js)
  try {
    if (typeof FA_FORNECEDORES !== 'undefined' && Array.isArray(FA_FORNECEDORES) && FA_FORNECEDORES.length > 0) {
      return FA_FORNECEDORES;
    }
  } catch(e) {}
  // 2) Cache localStorage (gravado pelo módulo fornecedores.js)
  try {
    const raw = localStorage.getItem('fa_fornecedores_cache');
    if (raw) { lista = JSON.parse(raw); if (lista.length > 0) return lista; }
  } catch(e) {}
  // 3) Chave principal
  try {
    const raw2 = localStorage.getItem('fa_fornecedores');
    if (raw2) { lista = JSON.parse(raw2); if (lista.length > 0) return lista; }
  } catch(e) {}
  // 4) Chave alternativa usada por alguns módulos
  try {
    const raw3 = localStorage.getItem('fa_forn');
    if (raw3) { lista = JSON.parse(raw3); if (lista.length > 0) return lista; }
  } catch(e) {}
  return lista;
}

// ─── AUTOCOMPLETE DE FORNECEDORES CADASTRADOS NA TELA DE COTAÇÕES ─────────────
// Filtra e exibe dropdown de fornecedores ao digitar/clicar no campo rfqFornCadInput
function _rfqFiltrarFornecedoresCad() {
  const input    = document.getElementById('rfqFornCadInput');
  const dropdown = document.getElementById('rfqFornCadDropdown');
  if (!input || !dropdown) return;

  const busca = (input.value || '').toLowerCase().trim();

  // Carrega lista de todas as fontes disponíveis
  const lista = _rfqCarregarListaFornecedores();

  // Se não há nenhum fornecedor cadastrado no sistema
  if (lista.length === 0) {
    dropdown.innerHTML = `<div style="padding:14px 16px;font-size:12px;color:var(--text-muted);text-align:center">
      <i class="fas fa-building" style="font-size:22px;display:block;margin-bottom:8px;opacity:.35"></i>
      <strong>Nenhum fornecedor cadastrado</strong><br>
      <span style="font-size:11px">Acesse o módulo <b>Fornecedores</b> para cadastrar.<br>Ou use "Inserir Novo" à direita para adicionar manualmente.</span>
    </div>`;
    dropdown.style.display = 'block';
    return;
  }

  // Filtra por busca (mostra todos os primeiros 12 se campo vazio)
  let filtrados = lista;
  if (busca.length >= 1) {
    filtrados = lista.filter(f => {
      const nome = (f.razao_social || f.nome || f.nome_fantasia || '').toLowerCase();
      const cnpj = (f.cnpj || '').toLowerCase();
      const cat  = (f.categoria || f.segmento || '').toLowerCase();
      const cod  = (f.codigo || f.id || '').toString().toLowerCase();
      return nome.includes(busca) || cnpj.includes(busca) || cat.includes(busca) || cod.includes(busca);
    });
  } else {
    filtrados = lista.slice(0, 12);
  }

  if (filtrados.length === 0) {
    dropdown.innerHTML = `<div style="padding:12px 14px;font-size:12px;color:var(--text-muted);text-align:center">
      <i class="fas fa-search" style="margin-right:6px;opacity:.5"></i>
      Nenhum resultado para "<strong>${busca}</strong>".<br>
      <span style="font-size:11px">Tente o nome completo, CNPJ ou use "Inserir Novo".</span>
    </div>`;
    dropdown.style.display = 'block';
    return;
  }

  dropdown.innerHTML = filtrados.slice(0, 15).map(f => {
    // Nome fantasia em destaque + razão social como subtítulo (se diferente)
    const nomeFantasia = (f.nome_fantasia || '').trim();
    const razaoSocial  = (f.razao_social  || f.nome || '').trim();
    const nomePrincipal = nomeFantasia || razaoSocial || 'Fornecedor';
    const nomeSecundario = (nomeFantasia && razaoSocial && nomeFantasia.toLowerCase() !== razaoSocial.toLowerCase())
      ? razaoSocial : '';
    // O nome usado para seleção e armazenamento
    const nomeSelecao = nomePrincipal;
    const safeNome = nomeSelecao.replace(/'/g,"\\'").replace(/"/g,'&quot;');
    const cnpjTxt  = f.cnpj ? `<span style="color:var(--text-muted);font-size:10px;margin-left:6px">${f.cnpj}</span>` : '';
    const cat      = f.categoria || f.segmento || '';
    const catBadge = cat ? `<span style="background:rgba(99,102,241,.12);color:#6366f1;border-radius:4px;padding:1px 6px;font-size:10px;margin-left:4px">${cat}</span>` : '';
    const idfScore = f.idf_score != null ? f.idf_score : null;
    const idfColor = idfScore >= 80 ? '#22c55e' : idfScore >= 60 ? '#3b82f6' : idfScore >= 40 ? '#f59e0b' : '#ef4444';
    const idfHtml  = idfScore != null ? `<span style="font-size:10px;font-weight:700;color:${idfColor};background:${idfColor}18;border-radius:4px;padding:1px 5px;margin-left:auto;white-space:nowrap">IDF ${idfScore}</span>` : '';
    const statusBadge = f.status && f.status !== 'Ativo'
      ? `<span style="font-size:10px;color:#f59e0b;border-radius:4px;padding:1px 5px;background:rgba(245,158,11,.1)">${f.status}</span>` : '';
    const emailBadge = f.contato_email
      ? `<span style="font-size:10px;color:#22c55e;margin-left:4px"><i class="fas fa-envelope"></i></span>`
      : `<span style="font-size:10px;color:#ef4444;margin-left:4px" title="Sem e-mail"><i class="fas fa-exclamation-triangle"></i></span>`;
    return `<div
      onclick="_rfqSelecionarFornCad('${f.id}', '${safeNome}', this)"
      data-forn-id="${f.id}"
      data-forn-nome="${nomeSelecao.replace(/"/g,'&quot;')}"
      style="padding:9px 12px;cursor:pointer;border-bottom:1px solid var(--border-color);transition:background .12s;display:flex;align-items:center;gap:8px"
      onmouseover="this.style.background='var(--bg-secondary)'"
      onmouseout="this.style.background='transparent'">
      <div style="width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,#8b5cf6,#6366f1);display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <span style="color:#fff;font-size:12px;font-weight:800">${nomePrincipal.charAt(0).toUpperCase()}</span>
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:600;color:var(--text-primary);display:flex;align-items:center;flex-wrap:wrap;gap:3px">
          ${nomePrincipal}${cnpjTxt}${catBadge}${statusBadge}${emailBadge}
        </div>
        ${nomeSecundario ? `<div style="font-size:10px;color:var(--text-muted);margin-top:1px;font-style:italic">${nomeSecundario}</div>` : ''}
        ${f.cidade || f.uf ? `<div style="font-size:10px;color:var(--text-muted);margin-top:1px">${[f.cidade,f.uf].filter(Boolean).join(' / ')}</div>` : ''}
      </div>
      ${idfHtml}
    </div>`;
  }).join('');

  if (filtrados.length > 15) {
    dropdown.innerHTML += `<div style="padding:7px 12px;font-size:11px;color:var(--text-muted);text-align:center;border-top:1px solid var(--border-color)">
      <i class="fas fa-ellipsis-h" style="margin-right:4px"></i>+${filtrados.length - 15} outros. Refine a busca.
    </div>`;
  }

  dropdown.style.display = 'block';
}

// Seleciona um fornecedor do dropdown e preenche o input
function _rfqSelecionarFornCad(id, nome, el) {
  const input    = document.getElementById('rfqFornCadInput');
  const dropdown = document.getElementById('rfqFornCadDropdown');
  if (input) {
    input.value = nome;
    input.dataset.fornId   = id;
    input.dataset.fornNome = nome;
    input.style.borderColor = '#22c55e';
  }
  if (dropdown) dropdown.style.display = 'none';
  // Destaca o item selecionado
  if (el) {
    el.style.background = 'rgba(139,92,246,0.15)';
    el.style.borderLeft = '3px solid #8b5cf6';
  }
}

// Adiciona o fornecedor selecionado no autocomplete ao processo RFQ
function _rfqAdicionarFornCadastrado(rfqId) {
  const input = document.getElementById('rfqFornCadInput');
  if (!input) return;

  const fornId   = input.dataset.fornId;
  const fornNome = input.dataset.fornNome || input.value?.trim();

  if (!fornNome) {
    showToast('Selecione um fornecedor na lista antes de adicionar.', 'warning', 3000);
    input.style.borderColor = '#ef4444';
    input.focus();
    setTimeout(() => { if (input) input.style.borderColor = 'rgba(139,92,246,0.35)'; }, 2000);
    return;
  }

  // Tenta localizar o RFQ em fa_rfqs primeiro, depois em fa_rfq_flow
  let rfqs  = _getRFQs();
  let rfq   = rfqs.find(r => r.id === rfqId);
  let isFlow = false;
  let flowRFQs;
  if (!rfq) {
    try {
      flowRFQs = JSON.parse(localStorage.getItem('fa_rfq_flow') || '[]');
      rfq      = flowRFQs.find(r => r.id === rfqId);
      if (rfq) isFlow = true;
    } catch(e) {}
  }
  if (!rfq) {
    showToast('Processo RFQ não encontrado.', 'error', 3000);
    return;
  }

  rfq.fornecedores_convidados = rfq.fornecedores_convidados || [];

  // Verifica duplicata por id ou nome
  const jaExiste = rfq.fornecedores_convidados.some(f => {
    if (fornId && (f === fornId || String(f) === String(fornId))) return true;
    if (_rfqNomeForn(f).toLowerCase() === fornNome.toLowerCase()) return true;
    return false;
  });

  if (jaExiste) {
    showToast(`"${fornNome}" já está no processo.`, 'warning', 3000);
    return;
  }

  // Adiciona: usa o ID se disponível (melhor rastreabilidade), senão o nome
  rfq.fornecedores_convidados.push(fornId || fornNome);
  if (isFlow) {
    localStorage.setItem('fa_rfq_flow', JSON.stringify(flowRFQs));
  } else {
    _saveRFQs(rfqs);
  }

  // Limpa campo
  input.value = '';
  delete input.dataset.fornId;
  delete input.dataset.fornNome;
  input.style.borderColor = 'rgba(139,92,246,0.35)';
  const dropdown = document.getElementById('rfqFornCadDropdown');
  if (dropdown) dropdown.style.display = 'none';

  showToast(`✅ Fornecedor "${fornNome}" adicionado ao processo!`, 'success', 3000);
  closeModal();
  setTimeout(() => registrarCotacoes(rfqId), 350);
}

// Helper: adiciona novo fornecedor manual ao processo RFQ (salva e reabre tela)
function _rfqAdicionarFornAoCotacao(rfqId) {
  const input = document.getElementById('rfqNovoFornInput');
  const nome  = input?.value?.trim();
  if (!nome) { showToast('Informe o nome ou e-mail do fornecedor.', 'warning'); return; }

  // Tenta localizar em fa_rfqs, depois em fa_rfq_flow
  let rfqs   = _getRFQs();
  let rfq    = rfqs.find(r => r.id === rfqId);
  let isFlow = false;
  let flowRFQs;
  if (!rfq) {
    try {
      flowRFQs = JSON.parse(localStorage.getItem('fa_rfq_flow') || '[]');
      rfq      = flowRFQs.find(r => r.id === rfqId);
      if (rfq) isFlow = true;
    } catch(e) {}
  }
  if (!rfq) {
    showToast('Processo RFQ não encontrado.', 'error', 3000);
    return;
  }

  // Verifica duplicata
  if ((rfq.fornecedores_convidados || []).some(f => f === nome || _rfqNomeForn(f).toLowerCase() === nome.toLowerCase())) {
    showToast('Este fornecedor já está no processo.', 'warning');
    return;
  }

  rfq.fornecedores_convidados = rfq.fornecedores_convidados || [];
  rfq.fornecedores_convidados.push(nome);
  if (isFlow) {
    localStorage.setItem('fa_rfq_flow', JSON.stringify(flowRFQs));
  } else {
    _saveRFQs(rfqs);
  }

  showToast(`✅ Fornecedor "${nome}" adicionado ao processo!`, 'success', 3000);
  closeModal();
  setTimeout(() => registrarCotacoes(rfqId), 400);
}

// ─── MATRIZ COMPARATIVA (MAPA DE COTAÇÕES) ───
function abrirMatrizComparativa(rfqId) {
  const rfqs = _getRFQs();
  const rfq = rfqs.find(r => r.id === rfqId);
  if (!rfq || !rfq.cotacoes?.length) {
    showToast('Registre as cotações recebidas antes de abrir a matriz.', 'warning');
    return;
  }

  const cotacoes = rfq.cotacoes;
  const cotacoesAtivas = cotacoes.filter(c => !c.declinou);
  const totaisComp = cotacoesAtivas.map(c => c.total_negociado != null ? c.total_negociado : c.total);
  const menorTotal = totaisComp.filter(t => t > 0).length ? Math.min(...totaisComp.filter(t => t > 0)) : 0;
  const matrizes = _getMatrizes();
  const matrizExist = matrizes.find(m => m.rfq_id === rfqId &&
    !['Cancelada \u2013 Cota\u00e7\u00f5es Revisadas','Cancelada \u2013 Revis\u00e3o Solicitada'].includes(m.status));
  const isMapaAprovOuAprova = matrizExist && ['Aprovada','Aguardando Aprova\u00e7\u00e3o'].includes(matrizExist.status);

  const criteriosLabels = {
    preco:'Menor Pre\u00e7o', prazo:'Prazo de Entrega', pagamento:'Cond. Pagamento',
    frete:'Frete / Log\u00edstica', historico:'Hist\u00f3rico do Forn.', tecnico:'Crit\u00e9rio T\u00e9cnico',
    total_negociado:'Total Negociado'
  };
  const criteriosEscolhidos = (rfq.criterios_avaliacao || []).map(c => criteriosLabels[c] || c);

  // Expandir modal para matriz completa
  const mc = document.getElementById('modalContainer');
  if (mc) mc.style.maxWidth = '1120px';

  // helper: fornecedor com melhor total
  const idxMelhor = cotacoes.reduce((bestIdx, c, i) => {
    if (c.declinou) return bestIdx;
    const tn = c.total_negociado != null ? c.total_negociado : c.total;
    if (bestIdx === -1) return i;
    const bestC = cotacoes[bestIdx];
    const bestTn = bestC.total_negociado != null ? bestC.total_negociado : bestC.total;
    return (tn > 0 && tn < bestTn) ? i : bestIdx;
  }, -1);

  // \u2500\u2500 Recomenda\u00e7\u00e3o inteligente multicrit\u00e9rio (custo \u00d7 IDF \u00d7 cr\u00e9dito \u00d7 prazo) \u2500\u2500
  // Auxiliar: nunca quebra o mapa. Usa os fornecedores (com cr\u00e9dito) + IDF.
  window._rfqMapaAtualId = rfqId;
  let recIAHtml = '';
  try {
    if (typeof window.recomendarFornecedor === 'function') {
      const _forns = (typeof FA_FORNECEDORES !== 'undefined' && FA_FORNECEDORES) ? FA_FORNECEDORES : [];
      const _achaForn = (ref) => _forns.find(f => f.id === ref || f.nome === ref || f.razao_social === ref || f.nome_fantasia === ref);
      const _opcoes = cotacoes.map(c => {
        const f = _achaForn(c.fornecedor) || {};
        return {
          forn_idx: c.forn_idx,
          fornecedor_id: c.fornecedor,
          fornecedor_nome: _rfqNomeForn(c.fornecedor),
          preco: c.total_negociado != null ? c.total_negociado : c.total,
          prazo_dias: parseFloat(c.prazo_entrega) || null,
          idf: f.score_medio != null ? f.score_medio : (f.score != null ? f.score : null),
          score_credito: f.score_credito,
          classificacao_credito: f.classificacao_credito,
          declinou: c.declinou,
        };
      });
      const _rec = window.recomendarFornecedor(_opcoes);
      if (_rec.recomendado) {
        window._rfqUltimaRec = _rec;
        const _top = _rec.ranking.slice(0, 3).map(r => {
          const cor = r.recomendado ? '#16a34a' : 'var(--text-muted)';
          return `<div style="display:flex;justify-content:space-between;gap:8px;font-size:12px;padding:2px 0">
            <span style="color:${cor}">${r.posicao}\u00ba ${r.fornecedor_nome}${r.recomendado ? ' \u2b50' : ''}</span>
            <span style="font-weight:700;color:${cor}">${r.scoreFinal}/100</span></div>`;
        }).join('');
        const _f = _rec.recomendado.fatores;
        recIAHtml = `
        <div style="background:linear-gradient(135deg,rgba(16,185,129,0.08),rgba(37,99,235,0.05));border:1px solid rgba(16,185,129,0.3);border-radius:10px;padding:12px;margin-bottom:12px">
          <div style="font-size:12px;font-weight:800;color:#16a34a;margin-bottom:6px"><i class="fas fa-brain"></i> RECOMENDA\u00c7\u00c3O INTELIGENTE (custo \u00d7 IDF \u00d7 cr\u00e9dito \u00d7 prazo)</div>
          <div style="font-size:13px;margin-bottom:6px">${(window.explicarRecomendacao ? window.explicarRecomendacao(_rec) : '')}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px">Fatores do 1\u00ba: custo ${_f.custo} \u00b7 IDF ${_f.idf} \u00b7 cr\u00e9dito ${_f.credito} \u00b7 prazo ${_f.prazo}</div>
          ${_top}
          ${!isMapaAprovOuAprova ? `<button onclick="_rfqAplicarRecomendado()" class="btn btn-sm" style="margin-top:8px;background:#16a34a;color:#fff;border:none;padding:4px 12px;border-radius:6px;font-size:11px"><i class="fas fa-check"></i> Aplicar recomenda\u00e7\u00e3o</button>` : ''}
        </div>`;
      }
    }
  } catch (e) { /* recomenda\u00e7\u00e3o \u00e9 auxiliar */ }

  openModal('\ud83d\uddc2\ufe0f Mapa de Coleta de Pre\u00e7o \u2013 ' + rfq.numero_rfq, `
    <!-- CABe\u00c7ALHO ESTILO MAPA PROFISSIONAL -->
    <div style="border:1px solid var(--border-color);border-radius:10px;overflow:hidden;margin-bottom:14px">
      <div style="display:grid;grid-template-columns:1fr auto;align-items:center;gap:16px;padding:12px 16px;background:linear-gradient(135deg,var(--fa-dark),#0e3a4a);color:#fff">
        <div>
          <div style="font-size:15px;font-weight:800;letter-spacing:0.5px">MAPA DE COLETA DE PRE\u00c7O</div>
          <div style="font-size:11px;opacity:0.75;margin-top:2px">${rfq.titulo}</div>
        </div>
        <div style="text-align:right;font-size:11px;opacity:0.85;line-height:1.6">
          <div><strong>Data:</strong> ${new Date().toLocaleDateString('pt-BR')}</div>
          <div><strong>RFQ:</strong> ${rfq.numero_rfq}</div>
          <div><strong>Usu\u00e1rio:</strong> ${currentUser?.name || '\u2014'}</div>
          ${isMapaAprovOuAprova ? '<div style="margin-top:4px;background:rgba(34,197,94,0.3);border-radius:4px;padding:2px 8px;font-weight:700">\u2713 ' + matrizExist.status + '</div>' : ''}
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));border-top:1px solid var(--border-color)">
        ${[
          ['Contrato', rfq.contrato || '\u2014'],
          ['Solicitante', (rfq.solicitante || '\u2014').substring(0,22)],
          ['Prazo Cota\u00e7\u00e3o', rfq.prazo_cotacao || '\u2014'],
          ['Valor Estimado', fmt(rfq.valor_estimado || 0)],
          ['Crit\u00e9rio', (criteriosEscolhidos[0] || '\u2014').substring(0,20)],
          ['Itens', (rfq.itens||[]).length + ' item(ns)']
        ].map(([lbl, val]) => `
          <div style="padding:7px 12px;border-right:1px solid var(--border-color)">
            <div style="font-size:9px;font-weight:700;color:var(--text-muted);text-transform:uppercase">${lbl}</div>
            <div style="font-size:11px;font-weight:600;color:var(--text-primary)">${val}</div>
          </div>
        `).join('')}
      </div>
      ${criteriosEscolhidos.length ? `
        <div style="padding:7px 16px;background:rgba(0,180,184,0.06);border-top:1px solid var(--border-color);display:flex;flex-wrap:wrap;gap:5px;align-items:center">
          <span style="font-size:10px;font-weight:700;color:var(--fa-teal);text-transform:uppercase;margin-right:4px"><i class="fas fa-sliders-h"></i> Crit\u00e9rios:</span>
          ${criteriosEscolhidos.map(c => '<span style="background:rgba(0,180,184,0.12);color:var(--fa-teal);border:1px solid rgba(0,180,184,0.25);border-radius:12px;padding:2px 8px;font-size:10px;font-weight:600">' + c + '</span>').join('')}
          ${rfq.criterios_obs ? '<span style="font-size:10px;color:var(--text-muted);font-style:italic;margin-left:4px">"' + rfq.criterios_obs + '"</span>' : ''}
        </div>
      ` : ''}
    </div>

    ${isMapaAprovOuAprova ? `
      <div style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);border-radius:8px;padding:9px 14px;margin-bottom:12px;font-size:12px;color:#f59e0b">
        <i class="fas fa-lock" style="margin-right:6px"></i>
        <strong>Mapa ${matrizExist.status}</strong> \u2013 Para alterar, clique em <strong>"Revisar Mapa"</strong>.
      </div>
    ` : ''}

    <!-- TABELA MATRIZ COMPLETA -->
    <div style="overflow-x:auto;margin-bottom:14px">
      <table style="width:100%;border-collapse:collapse;font-size:11px;min-width:600px">
        <thead>
          <!-- Linha 1: Fornecedores -->
          <tr>
            <td rowspan="2" style="padding:8px 10px;font-weight:700;font-size:10px;color:var(--text-muted);text-transform:uppercase;border:1px solid var(--border-color);background:var(--bg-tertiary);vertical-align:middle;min-width:180px">Fornecedor / Item</td>
            ${cotacoes.map((c, i) => {
              const nome = _rfqNomeForn(c.fornecedor);
              const isRec = i === idxMelhor;
              return '<td colspan="2" style="padding:7px 10px;text-align:center;border:1px solid var(--border-color);background:' + (c.declinou ? 'rgba(239,68,68,0.07)' : isRec ? 'rgba(0,180,184,0.1)' : 'var(--bg-secondary)') + ';font-weight:700;color:' + (c.declinou ? '#ef4444' : isRec ? 'var(--fa-teal)' : 'var(--text-primary)') + '" title="F' + (i+1) + ': ' + nome + '">'
                + (c.declinou ? '\ud83d\udeab ' : isRec ? '\u2605 ' : '')
                + (nome.length > 18 ? nome.substring(0,18)+'\u2026' : nome)
                + (c.declinou ? '<br><span style="font-size:9px;color:#ef4444;font-weight:700">DECLINOU</span>' : '')
                + '</td>';
            }).join('')}
            <td colspan="2" style="padding:7px 10px;text-align:center;border:1px solid var(--border-color);background:#1e3a5f;color:#fff;font-weight:800;font-size:10px;text-transform:uppercase;letter-spacing:0.5px">MELHOR<br>COTA\u00c7\u00c3O</td>
          </tr>
          <!-- Linha 2: Unid/Total sub-header -->
          <tr>
            ${cotacoes.map(() => `
              <td style="padding:4px 8px;text-align:right;font-size:9px;font-weight:700;color:var(--text-muted);border:1px solid var(--border-color);text-transform:uppercase;background:var(--bg-tertiary)">Unit.</td>
              <td style="padding:4px 8px;text-align:right;font-size:9px;font-weight:700;color:var(--text-muted);border:1px solid var(--border-color);text-transform:uppercase;background:var(--bg-tertiary)">Total</td>
            `).join('')}
            <td style="padding:4px 8px;text-align:center;font-size:9px;font-weight:700;color:#fff;border:1px solid var(--border-color);text-transform:uppercase;background:#1e3a5f">Forn.</td>
            <td style="padding:4px 8px;text-align:right;font-size:9px;font-weight:700;color:#fff;border:1px solid var(--border-color);text-transform:uppercase;background:#1e3a5f">Valor</td>
          </tr>
          <!-- Linhas de cabe\u00e7alho condi\u00e7\u00f5es -->
          ${[
            ['Cota\u00e7\u00e3o N\u00ba', c => c.declinou ? '\u2014' : ('Q' + String(cotacoes.indexOf(c)+1).padStart(4,'0'))],
            ['Cond. Pagto', c => c.declinou ? '\u2014' : (c.cond_pagamento || '\u2014')],
            ['Frete', c => c.declinou ? '\u2014' : (c.frete || '\u2014')],
            ['Prazo Entrega', c => c.declinou ? '\u2014' : (c.prazo_entrega ? c.prazo_entrega + ' dias' : '\u2014')]
          ].map(([lbl, fn], rowIdx) => `
            <tr style="background:${rowIdx % 2 === 0 ? 'var(--bg-secondary)' : 'transparent'}">
              <td style="padding:5px 10px;font-size:10px;color:var(--text-muted);border:1px solid var(--border-color);font-weight:600">${lbl}</td>
              ${cotacoes.map(c => '<td colspan="2" style="padding:5px 10px;text-align:center;border:1px solid var(--border-color);font-size:10px;color:var(--text-secondary)">' + fn(c) + '</td>').join('')}
              <td colspan="2" style="border:1px solid var(--border-color);background:rgba(30,58,95,0.08)"></td>
            </tr>
          `).join('')}
        </thead>

        <!-- ITENS LINHA A LINHA -->
        <tbody>
          ${(rfq.itens || []).map((item, idx) => {
            let melhorFornIdx = -1, melhorPrc = Infinity;
            cotacoes.forEach((c, ci) => {
              if (c.declinou) return;
              const pi = parseFloat(c.itens?.[idx]?.preco) || 0;
              if (pi > 0 && pi < melhorPrc) { melhorPrc = pi; melhorFornIdx = ci; }
            });
            const menorPrc = melhorFornIdx >= 0 ? melhorPrc : 0;
            const melhorNome = melhorFornIdx >= 0 ? _rfqNomeForn(cotacoes[melhorFornIdx].fornecedor) : '\u2014';
            const melhorTotalItem = melhorFornIdx >= 0
              ? (parseFloat(cotacoes[melhorFornIdx].itens?.[idx]?.total) || melhorPrc * parseFloat(item.qtd))
              : 0;
            const rowBg = idx % 2 === 0 ? 'var(--bg-secondary)' : 'transparent';
            return `
              <tr style="background:${rowBg}">
                <td style="padding:7px 10px;border:1px solid var(--border-color);color:var(--text-primary)">
                  <div style="font-weight:600;font-size:11px">${item.descricao}</div>
                  <div style="font-size:9px;color:var(--text-muted);margin-top:1px">Qtd: <strong>${item.qtd}</strong> ${item.unidade || 'un'}</div>
                </td>
                ${cotacoes.map(c => {
                  if (c.declinou) return '<td colspan="2" style="padding:7px 8px;text-align:center;border:1px solid var(--border-color);background:rgba(239,68,68,0.04)"><span style="font-size:9px;color:#ef4444;font-style:italic">Declinou</span></td>';
                  const pi = parseFloat(c.itens?.[idx]?.preco) || 0;
                  const ti = parseFloat(c.itens?.[idx]?.total) || (pi * parseFloat(item.qtd));
                  const isMin = pi > 0 && pi === menorPrc;
                  return '<td style="padding:7px 8px;text-align:right;border:1px solid var(--border-color);font-size:11px;color:' + (isMin ? '#16a34a' : 'var(--text-secondary)') + ';font-weight:' + (isMin ? '700' : '400') + ';background:' + (isMin ? 'rgba(22,163,74,0.04)' : '') + '">'
                    + (pi ? fmt(pi) : '<span style="color:var(--text-muted)">\u2014</span>')
                    + '</td>'
                    + '<td style="padding:7px 8px;text-align:right;border:1px solid var(--border-color);font-weight:600;font-size:11px;color:' + (isMin ? '#16a34a' : 'var(--text-primary)') + ';background:' + (isMin ? 'rgba(22,163,74,0.06)' : '') + '">'
                    + (ti ? fmt(ti) : '<span style="color:var(--text-muted)">\u2014</span>')
                    + '</td>';
                }).join('')}
                <td style="padding:7px 8px;text-align:center;border:1px solid var(--border-color);background:#eef7fb;font-size:9px;font-weight:700;color:#1e3a5f;white-space:nowrap">
                  ${melhorNome.length > 12 ? melhorNome.substring(0,12)+'\u2026' : melhorNome}
                </td>
                <td style="padding:7px 8px;text-align:right;border:1px solid var(--border-color);background:#eef7fb;font-weight:800;color:#16a34a;font-size:12px">
                  ${melhorTotalItem ? fmt(melhorTotalItem) : '\u2014'}
                </td>
              </tr>`;
          }).join('')}

          <!-- SUBTOTAL BRUTO -->
          <tr style="background:var(--bg-tertiary)">
            <td style="padding:8px 10px;font-weight:700;font-size:11px;border:1px solid var(--border-color);text-transform:uppercase;color:var(--text-primary)">Subtotal (Bruto)</td>
            ${cotacoes.map(c => {
              if (c.declinou) return '<td colspan="2" style="padding:8px 10px;text-align:center;border:1px solid var(--border-color);color:#ef4444;font-size:10px;opacity:0.5">Declinou</td>';
              return '<td style="border:1px solid var(--border-color)"></td>'
                + '<td style="padding:8px 10px;text-align:right;border:1px solid var(--border-color);font-weight:700">' + fmt(c.subtotal || c.total || 0) + '</td>';
            }).join('')}
            <td colspan="2" style="padding:8px 10px;border:1px solid var(--border-color);background:#eef7fb"></td>
          </tr>

          ${cotacoes.some(c=>!c.declinou && c.valor_frete>0) ? `
          <tr style="background:rgba(245,158,11,0.04)">
            <td style="padding:6px 10px;font-size:11px;font-weight:600;color:#b45309;border:1px solid var(--border-color)">(+) Frete</td>
            ${cotacoes.map(c => {
              if (c.declinou) return '<td colspan="2" style="border:1px solid var(--border-color);opacity:0.4"></td>';
              return '<td style="border:1px solid var(--border-color)"></td>'
                + '<td style="padding:6px 10px;text-align:right;border:1px solid var(--border-color);color:#b45309">' + (c.valor_frete>0 ? '+'+fmt(c.valor_frete) : '\u2014') + '</td>';
            }).join('')}
            <td colspan="2" style="border:1px solid var(--border-color);background:#eef7fb"></td>
          </tr>` : ''}

          ${cotacoes.some(c=>!c.declinou && c.desconto_pct>0) ? `
          <tr style="background:rgba(22,163,74,0.04)">
            <td style="padding:6px 10px;font-size:11px;font-weight:600;color:#16a34a;border:1px solid var(--border-color)">(-) Desconto Negociado</td>
            ${cotacoes.map(c => {
              if (c.declinou) return '<td colspan="2" style="border:1px solid var(--border-color);opacity:0.4"></td>';
              return '<td style="border:1px solid var(--border-color)"></td>'
                + '<td style="padding:6px 10px;text-align:right;border:1px solid var(--border-color);color:#16a34a;font-weight:600">'
                + (c.desconto_pct > 0 ? '-' + c.desconto_pct + '% = -' + fmt(c.desconto_valor||0) : '\u2014')
                + '</td>';
            }).join('')}
            <td colspan="2" style="border:1px solid var(--border-color);background:#eef7fb"></td>
          </tr>` : ''}

          <!-- TOTAL NEGOCIADO FINAL -->
          <tr style="background:var(--fa-dark)">
            <td style="padding:10px 12px;font-weight:800;font-size:12px;color:#fff;border:1px solid rgba(255,255,255,0.1);text-transform:uppercase;letter-spacing:0.5px">TOTAL NEGOCIADO FINAL</td>
            ${cotacoes.map(c => {
              if (c.declinou) return '<td colspan="2" style="padding:10px;text-align:center;border:1px solid rgba(255,255,255,0.1);color:#fca5a5;font-weight:700;font-size:11px">DECLINOU</td>';
              const tn = c.total_negociado != null ? c.total_negociado : c.total;
              const isMen = tn === menorTotal && tn > 0;
              return '<td style="border:1px solid rgba(255,255,255,0.1)"></td>'
                + '<td style="padding:10px 12px;text-align:right;border:1px solid rgba(255,255,255,0.1);font-weight:800;font-size:14px;color:' + (isMen ? '#4ade80' : '#e2e8f0') + '">'
                + fmt(tn) + (isMen ? ' <span style="font-size:10px">\u2713</span>' : '')
                + '</td>';
            }).join('')}
            <td colspan="2" style="padding:10px 12px;text-align:right;border:1px solid rgba(255,255,255,0.1);background:#16a34a;font-weight:800;font-size:14px;color:#fff">
              ${fmt(menorTotal)}
            </td>
          </tr>

          ${cotacoes.some(c=>!c.declinou && c.obs_negociacao) ? `
          <tr>
            <td style="padding:5px 10px;font-size:10px;color:var(--text-muted);border:1px solid var(--border-color);font-weight:600">Obs. Negocia\u00e7\u00e3o</td>
            ${cotacoes.map(c => {
              if (c.declinou) return '<td colspan="2" style="border:1px solid var(--border-color);opacity:0.4"></td>';
              return '<td colspan="2" style="padding:5px 10px;border:1px solid var(--border-color);font-size:10px;color:var(--text-secondary);font-style:italic">' + (c.obs_negociacao || '\u2014') + '</td>';
            }).join('')}
            <td colspan="2" style="border:1px solid var(--border-color);background:#eef7fb"></td>
          </tr>` : ''}
        </tbody>
      </table>
    </div>

    <!-- PAINEL CRIT\u00c9RIO DE SELE\u00c7\u00c3O E RECOMENDA\u00c7\u00c3O -->
    <div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:10px;padding:14px;margin-bottom:12px">
      <div style="font-size:12px;font-weight:800;color:var(--text-primary);margin-bottom:12px;text-transform:uppercase;letter-spacing:0.5px;display:flex;align-items:center;gap:8px">
        <i class="fas fa-gavel" style="color:var(--fa-teal)"></i> Crit\u00e9rio de Sele\u00e7\u00e3o e Recomenda\u00e7\u00e3o
      </div>
      ${recIAHtml}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
        <div>
          <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">Crit\u00e9rio Principal *</label>
          <select id="matrizCriterio" style="width:100%;padding:7px 10px;background:var(--bg-primary);border:1px solid var(--border-color);border-radius:6px;color:var(--text-primary);font-size:12px;box-sizing:border-box" ${isMapaAprovOuAprova?'disabled':''}>
            ${criteriosEscolhidos.length ? criteriosEscolhidos.map(c => '<option>' + c + '</option>').join('') : ''}
            <option>Menor Pre\u00e7o Total Negociado</option>
            <option>Menor Pre\u00e7o Unit\u00e1rio</option>
            <option>Melhor Prazo de Entrega</option>
            <option>Melhor Condi\u00e7\u00e3o de Pagamento</option>
            <option>Menor Custo Total (pre\u00e7o + frete)</option>
            <option>Fornecedor \u00danico / Crit\u00e9rio T\u00e9cnico</option>
            <option>Hist\u00f3rico e Desempenho</option>
            <option>Combina\u00e7\u00e3o Pre\u00e7o + Prazo</option>
          </select>
        </div>
        <div>
          <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">Fornecedor Recomendado *</label>
          <select id="matrizFornRecomendado" style="width:100%;padding:7px 10px;background:var(--bg-primary);border:1px solid var(--border-color);border-radius:6px;color:var(--text-primary);font-size:12px;box-sizing:border-box" ${isMapaAprovOuAprova?'disabled':''}>
            ${cotacoesAtivas.map((c) => {
              const i = c.forn_idx;
              const tn = c.total_negociado != null ? c.total_negociado : c.total;
              return '<option value="' + i + '">' + _rfqLabelFornFull(c.fornecedor, i) + ' \u2013 ' + fmt(tn) + '</option>';
            }).join('')}
          </select>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap">
        <input type="checkbox" id="matrizFornUnico" style="accent-color:var(--fa-teal)" ${isMapaAprovOuAprova?'disabled':''} onchange="if(!${isMapaAprovOuAprova?'true':'false'}) _rfqGerarTextoIA('${rfqId}')">
        <label for="matrizFornUnico" style="font-size:12px;color:var(--text-secondary);cursor:pointer">Compra por fornecedor \u00fanico (pacote \u00fanico)</label>
        <input type="checkbox" id="matrizMultiploPed" style="accent-color:var(--fa-teal);margin-left:16px" ${isMapaAprovOuAprova?'disabled':''} onchange="if(!${isMapaAprovOuAprova?'true':'false'}) _rfqGerarTextoIA('${rfqId}')">
        <label for="matrizMultiploPed" style="font-size:12px;color:var(--text-secondary);cursor:pointer">Gerar pedidos separados por fornecedor</label>
      </div>
      <div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap">
          <label style="font-size:11px;font-weight:700;color:var(--text-muted)">Texto de Recomenda\u00e7\u00e3o / Justificativa</label>
          ${!isMapaAprovOuAprova ? `
            <span style="font-size:10px;color:var(--text-muted);font-style:italic">— atualiza ao mudar crit\u00e9rio ou fornecedor</span>
            <button onclick="_rfqGerarTextoIA('${rfqId}')" class="btn btn-sm" style="background:linear-gradient(135deg,#8b5cf6,#3b82f6);color:#fff;border:none;padding:3px 10px;font-size:11px;border-radius:6px;margin-left:auto">
              <i class="fas fa-magic"></i> Regenerar
            </button>
          ` : ''}
        </div>
        <textarea id="matrizJustificativa" rows="5"
          placeholder="Selecione o crit\u00e9rio e o fornecedor acima — o texto ser\u00e1 gerado automaticamente..."
          style="width:100%;padding:8px 10px;background:var(--bg-primary);border:1px solid var(--border-color);border-radius:6px;color:var(--text-primary);font-size:12px;box-sizing:border-box;resize:vertical;line-height:1.6"
          ${isMapaAprovOuAprova?'readonly':''}>${matrizExist?.justificativa||''}</textarea>
      </div>
    </div>
    ${!isMapaAprovOuAprova ? `
    <script>
      (function() {
        var c = document.getElementById('matrizCriterio');
        var f = document.getElementById('matrizFornRecomendado');
        if (c) c.addEventListener('change', function(){ _rfqGerarTextoIA('${rfqId}'); });
        if (f) f.addEventListener('change', function(){ _rfqGerarTextoIA('${rfqId}'); });
        var txt = document.getElementById('matrizJustificativa');
        if (txt && !txt.value.trim()) setTimeout(function(){ _rfqGerarTextoIA('${rfqId}'); }, 250);
      })();
    <\/script>
    ` : ''}
    <div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.25);border-radius:8px;padding:10px 14px;font-size:12px;color:#b45309;display:flex;align-items:flex-start;gap:8px">
      <i class="fas fa-info-circle" style="margin-top:1px"></i>
      <span>Ap\u00f3s enviar para aprova\u00e7\u00e3o, o mapa seguir\u00e1 para o Gestor / Diretor conforme al\u00e7ada. Valores <strong>&gt; R$ 10.000</strong> requerem aprova\u00e7\u00e3o do Diretor.</span>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
    <button class="btn btn-secondary" onclick="closeModal();registrarCotacoes('${rfqId}')"><i class="fas fa-pencil-alt"></i> Editar Cota\u00e7\u00f5es</button>
    ${isMapaAprovOuAprova
      ? `<button class="btn btn-warning" onclick="closeModal();revisarMapaAprovado('${rfqId}','${matrizExist.id}')" style="background:#f59e0b;color:#fff;border:none"><i class="fas fa-redo"></i> Revisar Mapa</button>`
      : `<button class="btn btn-primary" onclick="salvarMatrizComparativa('${rfqId}')"><i class="fas fa-paper-plane"></i> Enviar para Aprova\u00e7\u00e3o</button>`
    }
  `);
}


// ─── GERAR TEXTO DE RECOMENDAÇÃO COM IA (local, sem chamada externa) ───
// Aplica a recomendação inteligente ao seletor de fornecedor recomendado.
function _rfqAplicarRecomendado() {
  const rec = window._rfqUltimaRec;
  if (!rec || !rec.recomendado) return;
  const sel = document.getElementById('matrizFornRecomendado');
  if (sel) sel.value = String(rec.recomendado.forn_idx);
  if (typeof _rfqGerarTextoIA === 'function' && window._rfqMapaAtualId) _rfqGerarTextoIA(window._rfqMapaAtualId);
  if (typeof showToast === 'function') showToast('Recomendação aplicada: ' + (rec.recomendado.fornecedor_nome || ''), 'success');
}
window._rfqAplicarRecomendado = _rfqAplicarRecomendado;

function _rfqGerarTextoIA(rfqId) {
  const rfqs = _getRFQs();
  const rfq  = rfqs.find(r => r.id === rfqId);
  if (!rfq) return;

  const cotacoesAtivas = (rfq.cotacoes || []).filter(c => !c.declinou);
  if (!cotacoesAtivas.length) {
    showToast('Nenhuma cotação ativa para gerar recomendação.', 'warning');
    return;
  }

  // Identifica seleções do usuário no painel
  const selIdx     = parseInt(document.getElementById('matrizFornRecomendado')?.value ?? 0);
  const cotSel     = rfq.cotacoes[selIdx] || cotacoesAtivas[0];
  const criterio   = document.getElementById('matrizCriterio')?.value || 'Menor Preço Total Negociado';
  const isPacote   = document.getElementById('matrizFornUnico')?.checked || false;
  const isMultiPed = document.getElementById('matrizMultiploPed')?.checked || false;

  // Totais ativos para comparação
  const totaisAtivos = cotacoesAtivas.map(c => c.total_negociado != null ? c.total_negociado : (c.total || 0));
  const valoresPos   = totaisAtivos.filter(t => t > 0);
  const menorT  = valoresPos.length ? Math.min(...valoresPos) : 0;
  const maiorT  = valoresPos.length ? Math.max(...valoresPos) : 0;
  const totalSel = cotSel.total_negociado != null ? cotSel.total_negociado : (cotSel.total || 0);
  const nomeForn = _rfqNomeForn(cotSel.fornecedor);

  // Prazos para comparação (critério prazo)
  const prazosAtivos = cotacoesAtivas.map(c => parseInt(c.prazo_entrega || 999)).filter(p => p < 999);
  const menorPrazo   = prazosAtivos.length ? Math.min(...prazosAtivos) : null;
  const isMelhorPrazo = menorPrazo !== null && parseInt(cotSel.prazo_entrega || 999) === menorPrazo;

  // Critérios marcados na avaliação
  const criteriosLabels = {
    preco:'menor preço', prazo:'prazo de entrega', pagamento:'condição de pagamento',
    frete:'frete / logística', historico:'histórico e desempenho', tecnico:'critério técnico',
    total_negociado:'menor valor negociado total'
  };
  const criteriosEscolhidos = (rfq.criterios_avaliacao || []).map(c => criteriosLabels[c] || c);
  const criteriosTxt = criteriosEscolhidos.length
    ? criteriosEscolhidos.join(', ')
    : criterio.toLowerCase();

  // Fornecedores que declinaram
  const declinaram = (rfq.cotacoes || []).filter(c => c.declinou).map(c => _rfqNomeForn(c.fornecedor));

  // Flags de contexto
  const isMenorPreco  = totalSel > 0 && totalSel === menorT;
  const economiaVsMaior = maiorT > totalSel && maiorT > 0 ? ((maiorT - totalSel) / maiorT * 100).toFixed(1) : null;
  const economiaReais   = maiorT > totalSel && maiorT > 0 ? (maiorT - totalSel) : null;

  // Detecta o tipo principal de seleção com base no critério escolhido
  const crit = criterio.toLowerCase();
  const tipoPreco  = crit.includes('preço') || crit.includes('negociado') || criteriosEscolhidos.some(c=>c.includes('preço')||c.includes('negociado'));
  const tipoPrazo  = crit.includes('prazo') || criteriosEscolhidos.some(c=>c.includes('prazo'));
  const tipoTecnico= crit.includes('técnico') || crit.includes('único') || criteriosEscolhidos.some(c=>c.includes('técnico'));
  const tipoCombo  = crit.includes('combinação') || crit.includes('preco') && crit.includes('prazo');

  // ── Parágrafo 1: introdução ──────────────────────────────────────────────
  let texto = `Após análise comparativa das propostas recebidas no processo ${rfq.numero_rfq}`;
  if (rfq.titulo) texto += ` – ${rfq.titulo}`;
  texto += `, foram avaliados os seguintes critérios: ${criteriosTxt}.
`;

  if (declinaram.length) {
    texto += `
Nota: o(s) fornecedor(es) ${declinaram.join(', ')} declinou(aram) de participar do processo.
`;
  }

  // ── Parágrafo 2: contexto comparativo (resumo das propostas) ────────────
  if (cotacoesAtivas.length > 1) {
    texto += `
Foram recebidas ${cotacoesAtivas.length} propostas válidas`;
    if (valoresPos.length) {
      texto += `, com valores variando de ${fmt(menorT)} a ${fmt(maiorT)}`;
    }
    texto += `.
`;
  }

  // ── Parágrafo 3: recomendação principal ─────────────────────────────────
  texto += `
Recomendamos a contratação de ${nomeForn}`;

  if (isPacote) {
    texto += ` para fornecimento do pacote completo de itens`;
  }

  if (totalSel > 0) {
    texto += ` pelo valor total`;
    if (cotSel.total_negociado != null && cotSel.desconto_pct > 0) {
      texto += ` negociado de ${fmt(totalSel)}`;
    } else {
      texto += ` de ${fmt(totalSel)}`;
    }
  }
  texto += `.`;

  // Detalhes do desconto negociado
  if (cotSel.desconto_pct > 0) {
    const descVal = cotSel.desconto_valor || (cotSel.total || 0) - totalSel;
    texto += ` Foi obtido desconto de ${cotSel.desconto_pct}% após negociação, representando uma economia de ${fmt(descVal)}.`;
  }
  if (cotSel.obs_negociacao) {
    texto += ` Condição negociada: "${cotSel.obs_negociacao}".`;
  }
  texto += `
`;

  // Detalhes comerciais
  const detalhes = [];
  if (cotSel.prazo_entrega) detalhes.push(`prazo de entrega: ${cotSel.prazo_entrega} dias`);
  if (cotSel.cond_pagamento) detalhes.push(`condição de pagamento: ${cotSel.cond_pagamento}`);
  if (cotSel.frete)          detalhes.push(`modalidade de frete: ${cotSel.frete}`);
  if (detalhes.length) texto += `
Condições comerciais: ${detalhes.join(' | ')}.`;

  // ── Parágrafo 4: justificativa específica por tipo de seleção ───────────
  texto += `

Justificativa da seleção:
`;

  if (isPacote) {
    // Pacote único
    texto += `A compra foi estruturada como pacote único junto a ${nomeForn}, `;
    if (isMenorPreco) {
      texto += `pois este fornecedor apresentou o menor valor total negociado entre os participantes`;
      if (economiaVsMaior) texto += `, com economia de ${economiaVsMaior}% (${fmt(economiaReais)}) frente à proposta mais cara`;
      texto += `. A consolidação em pacote único simplifica a gestão de fornecimento, reduz custos logísticos e facilita o acompanhamento do pedido.`;
    } else {
      texto += `visando simplificação logística, redução de custos administrativos e melhor gestão do contrato. `;
      texto += `Embora não seja o menor preço, o custo-benefício total justifica a consolidação, considerando: ${criteriosTxt}.`;
    }
  } else if (tipoPrazo && isMelhorPrazo && !tipoPreco) {
    // Seleção por melhor prazo
    texto += `O principal critério foi o prazo de entrega. ${nomeForn} ofereceu o melhor prazo entre os participantes: ${cotSel.prazo_entrega} dias${cotacoesAtivas.length>1?' frente às demais propostas':''}.`;
    if (!isMenorPreco && totalSel > menorT && menorT > 0) {
      const difPreco = ((totalSel - menorT) / menorT * 100).toFixed(1);
      texto += ` O valor apresentado é ${difPreco}% acima da proposta mais econômica, porém a urgência operacional e o menor prazo justificam a escolha.`;
    }
  } else if (tipoTecnico) {
    // Critério técnico ou fornecedor único
    texto += `A seleção baseou-se em critério técnico / homologação específica. ${nomeForn} é o fornecedor habilitado/homologado para atender aos requisitos técnicos do processo, conforme especificações do requisitante.`;
    if (totalSel > 0) texto += ` Valor total: ${fmt(totalSel)}.`;
  } else if (tipoCombo) {
    // Combinação preço + prazo
    texto += `A decisão considerou a melhor combinação entre preço e prazo. ${nomeForn} apresentou `;
    if (isMenorPreco) texto += `o menor preço total (${fmt(totalSel)})`;
    else texto += `preço competitivo (${fmt(totalSel)})`;
    if (isMelhorPrazo) texto += ` e o menor prazo de entrega (${cotSel.prazo_entrega} dias)`;
    else if (cotSel.prazo_entrega) texto += ` com prazo de entrega de ${cotSel.prazo_entrega} dias`;
    texto += `, resultando no melhor custo-benefício global entre os participantes.`;
  } else if (isMenorPreco) {
    // Seleção por menor preço
    texto += `${nomeForn} apresentou o menor valor total negociado (${fmt(totalSel)})`;
    if (economiaVsMaior && parseFloat(economiaVsMaior) > 0) {
      texto += `, com economia de ${economiaVsMaior}% em relação à proposta mais cara (${fmt(maiorT)})`;
      if (economiaReais) texto += `, equivalente a ${fmt(economiaReais)}`;
    }
    texto += `.`;
    if (cotacoesAtivas.length > 1) {
      texto += ` A proposta foi avaliada dentro dos parâmetros de mercado e está em conformidade com os critérios definidos para este processo.`;
    }
  } else {
    // Seleção por outros critérios (não é o menor preço)
    texto += `Embora ${nomeForn} não apresente o menor preço, a seleção fundamenta-se na superioridade dos seguintes critérios: ${criteriosTxt}.`;
    if (totalSel > menorT && menorT > 0) {
      const difPct = ((totalSel - menorT) / menorT * 100).toFixed(1);
      texto += ` A diferença de ${difPct}% em relação ao menor preço é justificada pelas vantagens nos critérios selecionados.`;
    }
  }

  if (isMultiPed && !isPacote) {
    // ── Pedidos separados: análise item-a-item para identificar melhor fornecedor por item ──
    const itensRFQ = rfq.itens || [];

    // Para cada item, mapeia os preços de cada cotação ativa
    // Estrutura: fornSelecPorItem[itemIdx] = { fornIdx, nome, preco, total, criterioVencedor }
    const itensCrit = criterio.toLowerCase();
    const usarPrazo = itensCrit.includes('prazo') || criteriosEscolhidos.some(c=>c.includes('prazo'));

    // Mapeia por item qual fornecedor tem melhor oferta
    const fornSelecPorItem = itensRFQ.map((item, itemIdx) => {
      const ofertas = cotacoesAtivas
        .map(c => ({
          fornIdx:  c.forn_idx,
          nome:     _rfqNomeForn(c.fornecedor),
          preco:    parseFloat(c.itens?.[itemIdx]?.preco || 0),
          total:    parseFloat(c.itens?.[itemIdx]?.total || 0) || (parseFloat(c.itens?.[itemIdx]?.preco || 0) * parseFloat(item.qtd || 1)),
          prazo:    parseInt(c.prazo_entrega || 999),
          cond:     c.cond_pagamento || ''
        }))
        .filter(o => o.preco > 0);

      if (!ofertas.length) return null;

      let melhor;
      if (usarPrazo) {
        // Critério prazo: menor prazo, em empate usa menor preço
        melhor = ofertas.reduce((a, b) => {
          if (a.prazo !== b.prazo) return a.prazo < b.prazo ? a : b;
          return a.preco <= b.preco ? a : b;
        });
      } else {
        // Critério preço: menor preço unitário
        melhor = ofertas.reduce((a, b) => a.preco <= b.preco ? a : b);
      }

      const menorPrecoItem = Math.min(...ofertas.map(o=>o.preco));
      const economia = melhor.preco === menorPrecoItem && ofertas.length > 1
        ? ofertas.filter(o=>o.fornIdx!==melhor.fornIdx).reduce((max,o)=>o.total>max?o.total:max, 0) - melhor.total
        : null;

      return {
        itemIdx,
        descricao: item.descricao || `Item ${itemIdx+1}`,
        qtd:       item.qtd || 1,
        unidade:   item.unidade || 'Un',
        ...melhor,
        economia
      };
    }).filter(Boolean);

    // Agrupa itens por fornecedor vencedor
    const fornGrupos = {};
    fornSelecPorItem.forEach(sel => {
      if (!fornGrupos[sel.fornIdx]) {
        fornGrupos[sel.fornIdx] = { nome: sel.nome, itens: [], totalItens: 0 };
      }
      fornGrupos[sel.fornIdx].itens.push(sel);
      fornGrupos[sel.fornIdx].totalItens += sel.total;
    });

    const gruposList = Object.values(fornGrupos).sort((a,b)=>b.totalItens-a.totalItens);
    const totalGeralSeparado = gruposList.reduce((s,g)=>s+g.totalItens, 0);

    texto += `

Estratégia de pedidos separados por fornecedor:
Foram analisadas as propostas item a item com base no critério "${criterio}". A distribuição dos itens entre fornecedores resulta no menor custo total e/ou melhor atendimento por linha de fornecimento:
`;

    gruposList.forEach((g, gi) => {
      const pctTotal = totalGeralSeparado > 0 ? ((g.totalItens / totalGeralSeparado)*100).toFixed(1) : '—';
      texto += `
[Pedido ${gi+1}] ${g.nome} — ${g.itens.length} item(s) — Total: ${fmt(g.totalItens)} (${pctTotal}% do valor global)
`;
      g.itens.forEach(it => {
        texto += `  • ${it.descricao} (${it.qtd} ${it.unidade}) → ${fmt(it.preco)}/un = ${fmt(it.total)}`;
        if (it.economia && it.economia > 0) texto += ` [economia de ${fmt(it.economia)} vs. demais]`;
        texto += `
`;
      });
    });

    if (gruposList.length > 1) {
      texto += `
Total consolidado dos ${gruposList.length} pedidos: ${fmt(totalGeralSeparado)}.
A distribuição acima foi determinada pela análise comparativa de cada item, garantindo o menor custo unitário (ou melhor prazo) para cada linha do processo.`;
    }

    // Itens sem cotação de nenhum fornecedor
    const itensSemCotacao = itensRFQ.filter((_, idx) => !fornSelecPorItem.find(s=>s.itemIdx===idx));
    if (itensSemCotacao.length) {
      texto += `

Atenção: ${itensSemCotacao.length} item(s) não possui(em) cotação de nenhum fornecedor ativo e deverão ser tratados separadamente.`;
    }
  }

  if (rfq.criterios_obs && rfq.criterios_obs.trim()) {
    texto += `

Observações adicionais: ${rfq.criterios_obs}.`;
  }

  // Remove eventuais tags HTML residuais
  const textoLimpo = texto.replace(/<[^>]+>/g, '');

  const el = document.getElementById('matrizJustificativa');
  if (el) {
    el.value = textoLimpo;
    el.style.border = '1px solid #8b5cf6';
    setTimeout(() => { if (el) el.style.border = ''; }, 2500);
  }
  showToast('✨ Recomendação gerada com análise da seleção!', 'success', 4000);
}

function salvarMatrizComparativa(rfqId) {
  const rfqs = _getRFQs();
  const rfq = rfqs.find(r => r.id === rfqId);
  if (!rfq) return;

  const fornRecomIdx = parseInt(document.getElementById('matrizFornRecomendado')?.value || 0);
  const cotForn      = rfq.cotacoes[fornRecomIdx];
  const matrizes     = _getMatrizes();
  const criterio     = document.getElementById('matrizCriterio')?.value     || 'Menor Preço Total Negociado';
  const justif       = document.getElementById('matrizJustificativa')?.value || '';
  const multiploPed  = document.getElementById('matrizMultiploPed')?.checked  || false;
  const fornUnico    = document.getElementById('matrizFornUnico')?.checked    || false;

  // usa total_negociado se disponível
  const valorAprov = cotForn?.total_negociado != null ? cotForn.total_negociado : (cotForn?.total || 0);

  const novaMatriz = {
    id:                   gerarId('MAT'),
    rfq_id:               rfqId,
    numero_rfq:           rfq.numero_rfq,
    titulo:               rfq.titulo,
    cotacoes:             rfq.cotacoes,
    forn_recomendado_idx: fornRecomIdx,
    forn_recomendado:     cotForn?.fornecedor || '',
    forn_recomendado_nome: _rfqNomeForn(cotForn?.fornecedor || ''),
    valor_aprovado:       valorAprov,
    criterio,
    criterios_avaliacao:  rfq.criterios_avaliacao || [],
    criterios_obs:        rfq.criterios_obs || '',
    justificativa:        justif,
    multiplos_pedidos:    multiploPed,
    fornecedor_unico:     fornUnico,
    status:               'Aguardando Aprovação',
    criado_em:            new Date().toLocaleDateString('pt-BR'),
    criado_por:           currentUser?.name || '',
    aprovado_em:          '',
    aprovado_por:         ''
  };

  matrizes.unshift(novaMatriz);
  _saveMatrizes(matrizes);

  rfq.status    = 'Mapa em Análise';
  rfq.matriz_id = novaMatriz.id;
  _saveRFQs(rfqs);

  logAction('Criar', 'Mapa Comparativo', `Mapa ${novaMatriz.id} enviado para aprovação – ${rfq.numero_rfq}`);
  closeModal();

  // Determina label da alçada para o toast (sem await – apenas estimativa rápida)
  _getCotacaoUSD().then(cotacao => {
    const cfg     = _getAlcadaConfig();
    const valorUSD = valorAprov / cotacao;
    const quem    = valorUSD > cfg.limite_usd ? cfg.nome_gm : cfg.nome_gerente;
    const limFmt  = new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(cfg.limite_usd);
    const valFmt  = new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(valorUSD);
    if (valorUSD > cfg.limite_usd) {
      showToast(`Mapa enviado! ${valFmt} excede ${limFmt} – requer aprovação do <strong>${quem}</strong>.`, 'warning', 7000);
    } else {
      showToast(`Mapa enviado para aprovação. Aguarda: <strong>${quem}</strong>.`, 'success', 5000);
    }
  });
  renderMapaCotacao();
}

// ─── REVISAR MAPA JÁ APROVADO / EM APROVAÇÃO ───
// Cancela a aprovação atual e volta o RFQ para Cotações Recebidas
function revisarMapaAprovado(rfqId, matrizId) {
  openModal('Revisar Mapa Aprovado', `
    <div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.3);border-radius:8px;padding:12px;margin-bottom:14px;font-size:13px;color:#ef4444">
      <i class="fas fa-exclamation-triangle" style="margin-right:8px"></i>
      <strong>Atenção!</strong> Ao confirmar, a aprovação atual será <strong>cancelada</strong> e o processo voltará para o estágio de cotações.
      Qualquer aprovação já concedida precisará ser refeita.
    </div>
    <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Motivo da revisão *</label>
    <textarea id="motivoRevisaoMapa" rows="3"
      placeholder="Ex: Novo fornecedor identificado, revisão de preços negociados, mudança no escopo..."
      style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box;resize:vertical"></textarea>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-danger" onclick="_confirmarRevisaoMapa('${rfqId}','${matrizId}')"><i class="fas fa-redo"></i> Confirmar Revisão</button>
  `);
}

function _confirmarRevisaoMapa(rfqId, matrizId) {
  const motivo = document.getElementById('motivoRevisaoMapa')?.value?.trim();
  if (!motivo) { showToast('Informe o motivo da revisão.', 'warning'); return; }

  const rfqs     = _getRFQs();
  const rfq      = rfqs.find(r => r.id === rfqId);
  const matrizes = _getMatrizes();
  const matriz   = matrizes.find(m => m.id === matrizId);

  if (!rfq || !matriz) return;

  const statusAnterior = matriz.status;
  matriz.status        = 'Cancelada – Revisão Solicitada';
  matriz.cancelado_em  = new Date().toLocaleDateString('pt-BR');
  matriz.cancelado_por = currentUser?.name || '';
  matriz.motivo_cancelamento = motivo;
  _saveMatrizes(matrizes);

  rfq.status    = 'Cotações Recebidas';
  rfq.matriz_id = null;
  _saveRFQs(rfqs);

  logAction('Revisar', 'Mapa Comparativo',
    `Mapa ${matrizId} (${statusAnterior}) cancelado para revisão – ${rfq.numero_rfq}: ${motivo}`);
  closeModal();
  showToast(`Mapa cancelado. Processo voltou para "Cotações Recebidas". Atualize as cotações e envie novo mapa.`, 'warning', 7000);
  renderRFQ();
}

// ─── EMITIR PEDIDO(S) A PARTIR DO RFQ ───
// ═══════════════════════════════════════════════════════════════════════════
// EMISSÃO DE PEDIDO DE COMPRA A PARTIR DO MAPA COMPARATIVO APROVADO
// Wizard 3 etapas:
//   1 – Verificar / confirmar condições de pagamento
//   2 – Classificar tipo de pedido (Material / Serviço / Equipamento)
//   3 – Revisar, emitir e enviar ao(s) fornecedor(es)
// ═══════════════════════════════════════════════════════════════════════════

// Estado do wizard (mantido entre steps)
window._pcWizard = {};

function emitirPedidoRFQ(rfqId) {
  // ── Busca RFQ em todas as fontes possíveis ─────────────────────────────────
  let rfqs = _getRFQs();
  let rfq  = rfqs.find(r => r.id === rfqId);

  // Fallback: tenta fa_rfq_flow (RFQs originados de OS)
  if (!rfq) {
    try {
      const flow = JSON.parse(localStorage.getItem('fa_rfq_flow') || '[]');
      rfq = flow.find(r => r.id === rfqId);
      if (rfq) { rfqs = flow; }
    } catch(e) {}
  }

  // Fallback adicional: fa_rcs (requisições de compra)
  if (!rfq) {
    try {
      const rcs = JSON.parse(localStorage.getItem('fa_rcs') || '[]');
      rfq = rcs.find(r => r.id === rfqId);
    } catch(e) {}
  }

  if (!rfq) {
    showToast('RFQ não encontrado. Tente recarregar a página.', 'danger');
    return;
  }

  // ── Busca matriz aprovada (suporta múltiplas chaves de busca) ─────────────
  const matrizes = _getMatrizes();
  // Normaliza status para compatibilidade com mapas legados ('Aprovado' → 'Aprovada')
  const _isAprovada = m => m.status === 'Aprovada' || m.status === 'Aprovado';
  // Busca primeiro por rfq_id, depois por numero_rfq, e por fim pelo próprio id
  const matriz = matrizes.find(m => m.rfq_id === rfqId && _isAprovada(m))
    || matrizes.find(m => m.id === rfqId && _isAprovada(m))
    || matrizes.find(m => m.numero_rfq === rfqId && _isAprovada(m));
  if (!matriz) {
    showToast('Mapa comparativo ainda não aprovado para este RFQ.', 'warning');
    return;
  }

  // ── Busca cotação principal (suporta formato novo e legado) ───────────────
  // Formato NOVO: rfq.cotacoes[] com forn_idx, total_negociado, itens[], etc.
  // Formato LEGADO: matriz.cotacoes_comparadas[] ou rfq.cotacoes[] simples
  const cotacoes = rfq.cotacoes || [];
  const ativas   = cotacoes.filter(c => !c.declinou);

  // Tenta resolver pelo forn_idx guardado na matriz (formato novo)
  const fornRecIdx = matriz.forn_recomendado_idx;
  let cotPrinc = null;

  // Estratégia 1: forn_idx explícito no array de cotações (formato novo)
  if (fornRecIdx != null) {
    cotPrinc = cotacoes.find(c => c.forn_idx === fornRecIdx && !c.declinou)
      || cotacoes[fornRecIdx];
  }

  // Estratégia 2: por forn_recomendado (id do fornecedor) no array de cotações
  if (!cotPrinc && matriz.forn_recomendado) {
    cotPrinc = cotacoes.find(c =>
      (c.fornecedor === matriz.forn_recomendado || c.fornecedor_id === matriz.forn_recomendado) && !c.declinou
    );
  }

  // Estratégia 3: por fornecedor_selecionado (campo legado do mapa)
  if (!cotPrinc && matriz.fornecedor_selecionado) {
    cotPrinc = cotacoes.find(c =>
      c.fornecedor === matriz.fornecedor_selecionado ||
      c.fornecedor_id === matriz.fornecedor_selecionado
    );
  }

  // Estratégia 4: cotação recomendada nas cotacoes_comparadas (formato legado do mapa)
  if (!cotPrinc && (matriz.cotacoes_comparadas || []).length > 0) {
    const recLegado = matriz.cotacoes_comparadas.find(c => c.recomendado);
    if (recLegado) {
      // Tenta achar no rfq.cotacoes pelo id
      cotPrinc = cotacoes.find(c =>
        c.fornecedor === recLegado.fornecedor || c.fornecedor_id === recLegado.fornecedor_id
      );
      // Se não achou nas cotacoes do rfq, cria um objeto sintético a partir do legado
      if (!cotPrinc) {
        cotPrinc = {
          fornecedor:      recLegado.fornecedor_id || recLegado.fornecedor || '',
          fornecedor_id:   recLegado.fornecedor_id || recLegado.fornecedor || '',
          total:           recLegado.valor || recLegado.valor_total || 0,
          total_negociado: recLegado.valor || recLegado.valor_total || null,
          prazo_entrega:   recLegado.prazo || 15,
          cond_pagamento:  '30 dias',
          frete:           'CIF',
          desconto_pct:    0,
          itens:           rfq.itens || []
        };
      }
    }
  }

  // Estratégia 5: fallback final — primeira cotação ativa, depois qualquer uma
  if (!cotPrinc) {
    cotPrinc = ativas[0] || cotacoes[0] || {};
  }

  // ── Calcula valor final ───────────────────────────────────────────────────
  // Prioridade: total_negociado > valor_aprovado do mapa > valor/valor_total > total bruto
  const valorFinal =
    (cotPrinc.total_negociado != null && cotPrinc.total_negociado > 0)
      ? cotPrinc.total_negociado
    : (matriz.valor_aprovado  > 0 ? matriz.valor_aprovado
    : (cotPrinc.total         > 0 ? cotPrinc.total
    : (cotPrinc.valor_total   > 0 ? cotPrinc.valor_total
    : (matriz.valor > 0 ? matriz.valor : 0))));

  const numeroPedido = 'PC-' + new Date().getFullYear() + '-' + String(Date.now()).slice(-4);

  // Salva estado do wizard para os próximos steps
  window._pcWizard = {
    rfqId, matrizId: matriz.id, rfq, matriz,
    cotPrinc, ativas, valorFinal, numeroPedido,
    // Será preenchido nos steps:
    condPagtoConfirmada: false,
    tipoPedido: '',
    step: 1
  };

  _pcStep1();
}

// ─── STEP 1: Verificar / confirmar condições de pagamento ──────────────────
function _pcStep1() {
  const w = window._pcWizard;
  const { rfq, matriz, cotPrinc, valorFinal, numeroPedido } = w;
  const cotacaoPagto = cotPrinc.cond_pagamento || 'A combinar';
  const prazoEntregaDias = cotPrinc.prazo_entrega || 15;
  const prazoDate = new Date(Date.now() + prazoEntregaDias * 86400000).toISOString().split('T')[0];
  const fornNome = _rfqNomeForn(cotPrinc.fornecedor || '');

  // Alerta especial para Antecipado
  const isAntecipado = cotacaoPagto === 'Antecipado';
  const alertaAntecipado = isAntecipado ? `
    <div style="background:rgba(239,68,68,0.10);border:1px solid rgba(239,68,68,0.40);border-radius:10px;padding:12px 14px;margin-bottom:16px;display:flex;gap:10px;align-items:flex-start">
      <i class="fas fa-exclamation-triangle" style="color:#ef4444;font-size:16px;margin-top:2px;flex-shrink:0"></i>
      <div style="font-size:12px;color:var(--text-secondary);line-height:1.6">
        <strong style="color:#ef4444">Atenção — Pagamento Antecipado!</strong><br>
        A condição negociada exige pagamento antes da entrega. Isso gerará uma
        <strong>Conta a Pagar imediata</strong> ao emitir o pedido. Confirme que o
        fluxo de caixa está aprovado antes de prosseguir.
      </div>
    </div>` : '';

  // Amplia modal
  const mc = document.getElementById('modalContainer');
  if (mc) { mc.style.maxWidth = '820px'; mc.style.width = '820px'; }

  openModal(
    `<span style="display:flex;align-items:center;gap:10px"><span style="background:var(--fa-teal);color:#fff;border-radius:50%;width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex-shrink:0">1</span> Emissão de PC — Verificar Condições de Pagamento</span>`,
    `
    <!-- Progress bar -->
    <div style="display:flex;gap:0;margin-bottom:20px;border-radius:8px;overflow:hidden;border:1px solid var(--border-color)">
      <div style="flex:1;padding:8px 0;text-align:center;font-size:11px;font-weight:700;background:var(--fa-teal);color:#fff">
        <i class="fas fa-file-invoice-dollar" style="margin-right:5px"></i>1. Condições
      </div>
      <div style="flex:1;padding:8px 0;text-align:center;font-size:11px;font-weight:600;background:var(--bg-tertiary);color:var(--text-muted)">
        <i class="fas fa-tags" style="margin-right:5px"></i>2. Tipo de Pedido
      </div>
      <div style="flex:1;padding:8px 0;text-align:center;font-size:11px;font-weight:600;background:var(--bg-tertiary);color:var(--text-muted)">
        <i class="fas fa-paper-plane" style="margin-right:5px"></i>3. Emitir & Enviar
      </div>
    </div>

    <!-- Banner mapa aprovado -->
    <div style="background:rgba(34,197,94,0.07);border:1px solid rgba(34,197,94,0.30);border-radius:10px;padding:12px 16px;margin-bottom:18px;display:flex;align-items:center;gap:12px">
      <i class="fas fa-check-circle" style="color:#22c55e;font-size:20px;flex-shrink:0"></i>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:700;color:#22c55e">Mapa Comparativo Aprovado — ${matriz.id}</div>
        <div style="font-size:11px;color:var(--text-secondary);margin-top:2px">
          ${rfq.numero_rfq} · ${rfq.titulo} · Fornecedor: <strong>${fornNome}</strong>
          · Critério: <strong>${matriz.criterio || 'Menor Preço'}</strong>
          · Valor: <strong style="color:var(--fa-teal)">${fmt(valorFinal)}</strong>
          ${cotPrinc.desconto_pct > 0 ? `<span style="color:#22c55e"> (desc. ${cotPrinc.desconto_pct}%)</span>` : ''}
        </div>
      </div>
    </div>

    ${alertaAntecipado}

    <!-- Condições negociadas (somente-leitura, do mapa) -->
    <div style="margin-bottom:16px">
      <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:10px;letter-spacing:.5px">
        <i class="fas fa-handshake" style="color:var(--fa-teal);margin-right:6px"></i>Condições Negociadas no Mapa
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px">
        <div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:10px;padding:10px 14px">
          <div style="font-size:9px;color:var(--text-muted);text-transform:uppercase;font-weight:700;margin-bottom:4px">Cond. Pagamento (cotação)</div>
          <div style="font-size:14px;font-weight:700;color:${isAntecipado?'#ef4444':'var(--fa-teal)'}">${cotacaoPagto}</div>
        </div>
        <div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:10px;padding:10px 14px">
          <div style="font-size:9px;color:var(--text-muted);text-transform:uppercase;font-weight:700;margin-bottom:4px">Prazo de Entrega</div>
          <div style="font-size:14px;font-weight:700;color:var(--text-primary)">${prazoEntregaDias} dias</div>
        </div>
        <div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:10px;padding:10px 14px">
          <div style="font-size:9px;color:var(--text-muted);text-transform:uppercase;font-weight:700;margin-bottom:4px">Frete</div>
          <div style="font-size:13px;font-weight:700;color:var(--text-primary)">${cotPrinc.frete || 'CIF'}</div>
        </div>
        <div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:10px;padding:10px 14px">
          <div style="font-size:9px;color:var(--text-muted);text-transform:uppercase;font-weight:700;margin-bottom:4px">Desconto</div>
          <div style="font-size:14px;font-weight:700;color:${cotPrinc.desconto_pct>0?'#22c55e':'var(--text-muted)'}">${cotPrinc.desconto_pct > 0 ? cotPrinc.desconto_pct + '%' : '—'}</div>
        </div>
      </div>
    </div>

    <!-- Confirmação / ajuste das condições do PC -->
    <div style="margin-bottom:16px">
      <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:10px;letter-spacing:.5px">
        <i class="fas fa-edit" style="color:#f59e0b;margin-right:6px"></i>Confirmar Condições do Pedido de Compra
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">

        <div>
          <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:5px">
            Condição de Pagamento <span style="color:#ef4444">*</span>
            <span id="pc-pagto-alerta" style="display:none;margin-left:6px;font-size:10px;color:#ef4444;font-weight:700">⚠ Verifique!</span>
          </label>
          <select id="pcCondPagto"
            style="width:100%;padding:9px 12px;background:var(--bg-secondary);border:2px solid var(--fa-teal);border-radius:8px;color:var(--text-primary);font-size:13px;font-weight:600;box-sizing:border-box"
            onchange="_pcValidarCondPagto()">
            ${['Antecipado','À entrega','7 dias','14 dias','15 dias','21 dias','28 dias','30 dias','45 dias','60 dias','90 dias','Parcelado (2x)','Parcelado (3x)','Outro']
              .map(o => `<option value="${o}" ${cotacaoPagto===o?'selected':''}>${o}</option>`).join('')}
          </select>
          <div id="pc-pagto-obs" style="font-size:10px;color:var(--text-muted);margin-top:4px">
            ${isAntecipado ? '<span style="color:#ef4444;font-weight:600">⚠ Requer confirmação do financeiro antes de emitir.</span>' : 'Confirme com a cotação negociada.'}
          </div>
        </div>

        <div>
          <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:5px">Número do Pedido</label>
          <input type="text" id="pcNumero" value="${numeroPedido}"
            style="width:100%;padding:9px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
        </div>

        <div>
          <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:5px">Prazo de Entrega Previsto</label>
          <input type="date" id="pcPrazoEntrega" value="${prazoDate}"
            style="width:100%;padding:9px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
        </div>

        <div>
          <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:5px">Contrato / Centro de Custo</label>
          <select id="pcContrato" style="width:100%;padding:9px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
            <option value="${rfq.contrato||'Geral'}" selected>${rfq.contrato||'Geral'}</option>
            ${(typeof ERP_DATA !== 'undefined' ? ERP_DATA.contratos || [] : [])
              .filter(c => c.status==='Ativo' && c.id !== rfq.contrato)
              .map(c => `<option value="${c.id}">${c.id} – ${c.cliente}</option>`).join('')}
          </select>
        </div>

        <div style="grid-column:1/-1">
          <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:5px">Observações / Instruções de Entrega</label>
          <textarea id="pcObs" rows="2" placeholder="Endereço de entrega, instruções especiais, referência de OS..."
            style="width:100%;padding:9px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box;resize:vertical"></textarea>
        </div>
      </div>
    </div>

    <!-- Checkbox de confirmação -->
    <div style="background:rgba(0,180,184,0.06);border:1px solid rgba(0,180,184,0.25);border-radius:10px;padding:12px 16px">
      <label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer">
        <input type="checkbox" id="pcConfirmacaoCondicoes" style="margin-top:3px;accent-color:var(--fa-teal);width:16px;height:16px;flex-shrink:0" onchange="_pcValidarConfirmacao()">
        <span style="font-size:12px;color:var(--text-secondary);line-height:1.6">
          Confirmo que as <strong>condições de pagamento</strong> acima estão corretas e de acordo com a cotação aprovada no mapa comparativo.
          ${isAntecipado ? '<br><strong style="color:#ef4444">Confirmo também que o pagamento antecipado foi autorizado pelo financeiro.</strong>' : ''}
        </span>
      </label>
    </div>
    `,
    `<button class="btn btn-secondary" onclick="closeModal()"><i class="fas fa-times"></i> Cancelar</button>
     <button id="pcBtnProximo1" class="btn btn-primary" onclick="_pcAvancarStep2()" disabled style="opacity:0.5">
       Próximo: Tipo de Pedido <i class="fas fa-arrow-right" style="margin-left:6px"></i>
     </button>`
  );

  // Roda validação inicial
  setTimeout(_pcValidarCondPagto, 100);
}

// ─── helpers de validação do Step 1 ──────────────────────────────────────────
function _pcValidarCondPagto() {
  const sel = document.getElementById('pcCondPagto')?.value || '';
  const isAntec = sel === 'Antecipado';
  const alertEl = document.getElementById('pc-pagto-alerta');
  const obsEl   = document.getElementById('pc-pagto-obs');
  if (alertEl) alertEl.style.display = isAntec ? 'inline' : 'none';
  if (obsEl) {
    if (isAntec) {
      obsEl.innerHTML = '<span style="color:#ef4444;font-weight:600">⚠ Requer confirmação do financeiro antes de emitir.</span>';
    } else if (sel === 'Outro') {
      obsEl.innerHTML = '<span style="color:#f59e0b">Especifique nas observações abaixo.</span>';
    } else {
      obsEl.innerHTML = '<span style="color:var(--text-muted)">Condição padrão.</span>';
    }
  }
  _pcValidarConfirmacao();
}

function _pcValidarConfirmacao() {
  const checked = document.getElementById('pcConfirmacaoCondicoes')?.checked;
  const btn = document.getElementById('pcBtnProximo1');
  if (btn) {
    btn.disabled = !checked;
    btn.style.opacity = checked ? '1' : '0.5';
  }
}

function _pcAvancarStep2() {
  const w = window._pcWizard;
  // Salva dados do step 1
  w.condPagto    = document.getElementById('pcCondPagto')?.value || 'À entrega';
  w.numeroPedido = document.getElementById('pcNumero')?.value || w.numeroPedido;
  w.prazoEntrega = document.getElementById('pcPrazoEntrega')?.value || '';
  w.contrato     = document.getElementById('pcContrato')?.value || w.rfq.contrato || 'Geral';
  w.obs          = document.getElementById('pcObs')?.value || '';
  w.step         = 2;
  _pcStep2();
}

// ─── STEP 2: Classificar tipo de pedido ───────────────────────────────────────
function _pcStep2() {
  const w = window._pcWizard;
  const { rfq, cotPrinc, valorFinal, condPagto } = w;

  // Conta contábil sugerida por tipo
  const contasPorTipo = {
    'Material':     '1.1.3.02 – Material de Manutenção / Insumos',
    'Serviço':      '1.1.3.07 – Serviços Externos',
    'Equipamento':  '1.2.1.01 – Ativo Imobilizado – Equipamentos',
    'EPI/Segurança':'1.1.3.05 – EPI e Segurança',
    'Combustível':  '1.1.3.06 – Combustível e Lubrificantes',
    'TI/Software':  '1.1.3.08 – Tecnologia da Informação',
    'Outro':        '1.1.3.99 – Outros'
  };

  openModal(
    `<span style="display:flex;align-items:center;gap:10px"><span style="background:var(--fa-teal);color:#fff;border-radius:50%;width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex-shrink:0">2</span> Emissão de PC — Tipo de Pedido & Classificação Contábil</span>`,
    `
    <!-- Progress bar -->
    <div style="display:flex;gap:0;margin-bottom:20px;border-radius:8px;overflow:hidden;border:1px solid var(--border-color)">
      <div style="flex:1;padding:8px 0;text-align:center;font-size:11px;font-weight:600;background:rgba(0,180,184,0.20);color:var(--fa-teal)">
        <i class="fas fa-check" style="margin-right:5px"></i>1. Condições ✓
      </div>
      <div style="flex:1;padding:8px 0;text-align:center;font-size:11px;font-weight:700;background:var(--fa-teal);color:#fff">
        <i class="fas fa-tags" style="margin-right:5px"></i>2. Tipo de Pedido
      </div>
      <div style="flex:1;padding:8px 0;text-align:center;font-size:11px;font-weight:600;background:var(--bg-tertiary);color:var(--text-muted)">
        <i class="fas fa-paper-plane" style="margin-right:5px"></i>3. Emitir & Enviar
      </div>
    </div>

    <!-- Seleção de tipo -->
    <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:12px;letter-spacing:.5px">
      <i class="fas fa-tags" style="color:var(--fa-teal);margin-right:6px"></i>Qual é a natureza deste pedido?
    </div>

    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px" id="pcTipoGrid">
      ${[
        { tipo:'Material',     icon:'fa-boxes',           cor:'#3b82f6', desc:'Insumos, peças, materiais de consumo e reposição' },
        { tipo:'Serviço',      icon:'fa-tools',           cor:'var(--fa-teal)', desc:'Mão de obra, serviços técnicos, manutenção, consultoria' },
        { tipo:'Equipamento',  icon:'fa-industry',        cor:'#8b5cf6', desc:'Máquinas, veículos, ativos imobilizados e instalações' },
        { tipo:'EPI/Segurança',icon:'fa-hard-hat',        cor:'#f59e0b', desc:'Equipamentos de proteção, segurança e saúde do trabalho' },
        { tipo:'Combustível',  icon:'fa-gas-pump',        cor:'#ef4444', desc:'Combustível, lubrificantes e fluidos operacionais' },
        { tipo:'TI/Software',  icon:'fa-laptop-code',     cor:'#06b6d4', desc:'Hardware, software, licenças e serviços de tecnologia' },
        { tipo:'Outro',        icon:'fa-ellipsis-h',      cor:'#9ca3af', desc:'Outros tipos não classificados acima' }
      ].map(t => `
        <div id="pcTipoCard_${t.tipo.replace('/','_')}"
          onclick="_pcSelecionarTipo('${t.tipo.replace('/','_')}','${t.tipo}')"
          style="border:2px solid var(--border-color);border-radius:12px;padding:14px;cursor:pointer;transition:all .15s;text-align:center;background:var(--bg-card)"
          onmouseover="this.style.borderColor='${t.cor}';this.style.background='rgba(0,0,0,0.03)'"
          onmouseout="if(!this.classList.contains('pc-tipo-sel')){this.style.borderColor='var(--border-color)';this.style.background='var(--bg-card)'}">
          <i class="fas ${t.icon}" style="font-size:22px;color:${t.cor};margin-bottom:8px;display:block"></i>
          <div style="font-size:12px;font-weight:700;color:var(--text-primary)">${t.tipo}</div>
          <div style="font-size:10px;color:var(--text-muted);margin-top:4px;line-height:1.4">${t.desc}</div>
        </div>
      `).join('')}
    </div>

    <!-- Conta contábil (preenchida automaticamente conforme tipo) -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
      <div>
        <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:5px">
          Conta Contábil <span style="color:#ef4444">*</span>
        </label>
        <select id="pcContaContabil"
          style="width:100%;padding:9px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:12px;box-sizing:border-box">
          <option value="">— Selecione o tipo acima —</option>
          ${Object.entries(contasPorTipo).map(([,v]) => `<option value="${v}">${v}</option>`).join('')}
        </select>
      </div>
      <div>
        <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:5px">Prioridade</label>
        <select id="pcPrioridade"
          style="width:100%;padding:9px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
          <option value="Normal">Normal</option>
          <option value="Alta">Alta</option>
          <option value="Urgente">Urgente</option>
        </select>
      </div>
    </div>

    <!-- Resumo step1 -->
    <div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;padding:10px 14px;font-size:11px;color:var(--text-muted)">
      <i class="fas fa-info-circle" style="color:var(--fa-teal);margin-right:6px"></i>
      <strong style="color:var(--text-primary)">Condições confirmadas:</strong>
      Pagamento <strong>${condPagto}</strong> · Entrega em
      <strong>${w.prazoEntrega ? new Date(w.prazoEntrega+'T12:00:00').toLocaleDateString('pt-BR') : '—'}</strong>
      · Valor: <strong style="color:var(--fa-teal)">${fmt(valorFinal)}</strong>
    </div>

    <div id="pcTipoAlerta" style="display:none;margin-top:10px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.3);border-radius:8px;padding:9px 12px;font-size:11px;color:#ef4444">
      <i class="fas fa-exclamation-circle" style="margin-right:6px"></i>Selecione o tipo do pedido para continuar.
    </div>
    `,
    `<button class="btn btn-secondary" onclick="_pcStep1()"><i class="fas fa-arrow-left" style="margin-right:6px"></i>Voltar</button>
     <button id="pcBtnProximo2" class="btn btn-primary" onclick="_pcAvancarStep3()" disabled style="opacity:0.5">
       Próximo: Revisar & Emitir <i class="fas fa-arrow-right" style="margin-left:6px"></i>
     </button>`
  );

  // Salva o mapa de contas para uso na seleção
  window._pcContasPorTipo = {
    'Material':     '1.1.3.02 – Material de Manutenção / Insumos',
    'Servico':      '1.1.3.07 – Serviços Externos',
    'Equipamento':  '1.2.1.01 – Ativo Imobilizado – Equipamentos',
    'EPI_Seguranca':'1.1.3.05 – EPI e Segurança',
    'Combustivel':  '1.1.3.06 – Combustível e Lubrificantes',
    'TI_Software':  '1.1.3.08 – Tecnologia da Informação',
    'Outro':        '1.1.3.99 – Outros'
  };
}

function _pcSelecionarTipo(tipoKey, tipoLabel) {
  // Remove seleção anterior
  document.querySelectorAll('[id^="pcTipoCard_"]').forEach(el => {
    el.classList.remove('pc-tipo-sel');
    el.style.borderColor = 'var(--border-color)';
    el.style.background  = 'var(--bg-card)';
    el.style.transform   = '';
  });
  // Marca o selecionado
  const card = document.getElementById('pcTipoCard_' + tipoKey);
  if (card) {
    card.classList.add('pc-tipo-sel');
    card.style.borderColor = 'var(--fa-teal)';
    card.style.background  = 'rgba(0,180,184,0.07)';
    card.style.transform   = 'scale(1.02)';
  }
  // Preenche conta contábil automaticamente
  const conta = window._pcContasPorTipo[tipoKey] || '';
  const contaEl = document.getElementById('pcContaContabil');
  if (contaEl && conta) {
    Array.from(contaEl.options).forEach(o => { o.selected = (o.value === conta); });
  }
  // Salva no wizard
  window._pcWizard.tipoPedido    = tipoLabel;
  window._pcWizard.tipoPedidoKey = tipoKey;
  // Habilita botão
  const btn = document.getElementById('pcBtnProximo2');
  if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
  const al = document.getElementById('pcTipoAlerta');
  if (al) al.style.display = 'none';
}

function _pcAvancarStep3() {
  const w = window._pcWizard;
  if (!w.tipoPedido) {
    const al = document.getElementById('pcTipoAlerta');
    if (al) al.style.display = 'block';
    return;
  }
  w.contaContabil = document.getElementById('pcContaContabil')?.value || '1.1.3.99 – Outros';
  w.prioridade    = document.getElementById('pcPrioridade')?.value || 'Normal';
  w.step = 3;
  _pcStep3();
}

// ─── STEP 3: Revisar, emitir e enviar ao fornecedor ──────────────────────────
function _pcStep3() {
  const w      = window._pcWizard;
  const { rfq, matriz, cotPrinc, ativas, valorFinal } = w;
  const fornNome = _rfqNomeForn(cotPrinc.fornecedor || '');
  const itens    = cotPrinc.itens || rfq.itens || [];

  // Ícone por tipo
  const tipoIconMap = {
    'Material':'fa-boxes','Serviço':'fa-tools','Equipamento':'fa-industry',
    'EPI/Segurança':'fa-hard-hat','Combustível':'fa-gas-pump','TI/Software':'fa-laptop-code','Outro':'fa-ellipsis-h'
  };
  const tipoIcon = tipoIconMap[w.tipoPedido] || 'fa-shopping-bag';
  const prazoFormatado = w.prazoEntrega
    ? new Date(w.prazoEntrega + 'T12:00:00').toLocaleDateString('pt-BR') : '—';

  // Detecta email do fornecedor cadastrado
  const fornObj = typeof FA_FORNECEDORES !== 'undefined'
    ? FA_FORNECEDORES.find(f => f.id === cotPrinc.fornecedor || f.razao_social === cotPrinc.fornecedor || f.nome_fantasia === cotPrinc.fornecedor)
    : null;
  const emailForn = fornObj?.contato_email || '';

  openModal(
    `<span style="display:flex;align-items:center;gap:10px"><span style="background:var(--fa-teal);color:#fff;border-radius:50%;width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex-shrink:0">3</span> Emissão de PC — Revisar, Emitir & Enviar ao Fornecedor</span>`,
    `
    <!-- Progress bar -->
    <div style="display:flex;gap:0;margin-bottom:20px;border-radius:8px;overflow:hidden;border:1px solid var(--border-color)">
      <div style="flex:1;padding:8px 0;text-align:center;font-size:11px;font-weight:600;background:rgba(0,180,184,0.20);color:var(--fa-teal)">
        <i class="fas fa-check"></i> 1. Condições ✓
      </div>
      <div style="flex:1;padding:8px 0;text-align:center;font-size:11px;font-weight:600;background:rgba(0,180,184,0.20);color:var(--fa-teal)">
        <i class="fas fa-check"></i> 2. Tipo ✓
      </div>
      <div style="flex:1;padding:8px 0;text-align:center;font-size:11px;font-weight:700;background:var(--fa-teal);color:#fff">
        <i class="fas fa-paper-plane"></i> 3. Emitir & Enviar
      </div>
    </div>

    <!-- Resumo do pedido -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
      <div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:10px;padding:12px 16px;grid-column:1/-1">
        <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:8px">Resumo do Pedido de Compra</div>
        <div style="display:flex;flex-wrap:wrap;gap:16px;font-size:12px">
          <div><span style="color:var(--text-muted)">Nº PC: </span><strong style="color:var(--fa-teal)">${w.numeroPedido}</strong></div>
          <div><span style="color:var(--text-muted)">Fornecedor: </span><strong>${fornNome}</strong></div>
          <div><span style="color:var(--text-muted)">Tipo: </span>
            <strong><i class="fas ${tipoIcon}" style="color:var(--fa-teal);margin-right:4px"></i>${w.tipoPedido}</strong>
          </div>
          <div><span style="color:var(--text-muted)">Pagamento: </span><strong>${w.condPagto}</strong></div>
          <div><span style="color:var(--text-muted)">Entrega: </span><strong>${prazoFormatado}</strong></div>
          <div><span style="color:var(--text-muted)">Prioridade: </span><strong>${w.prioridade}</strong></div>
          <div><span style="color:var(--text-muted)">Conta: </span><strong style="font-size:11px">${w.contaContabil}</strong></div>
          <div><span style="color:var(--text-muted)">Valor Total: </span><strong style="color:var(--fa-teal);font-size:15px">${fmt(valorFinal)}</strong></div>
        </div>
      </div>
    </div>

    <!-- Itens do pedido (preview) -->
    <div style="margin-bottom:16px">
      <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:8px">
        <i class="fas fa-list-ul" style="color:var(--fa-teal);margin-right:6px"></i>Itens do Pedido
      </div>
      <div style="max-height:200px;overflow-y:auto;border:1px solid var(--border-color);border-radius:8px">
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead>
            <tr style="background:var(--bg-tertiary);position:sticky;top:0">
              <th style="padding:7px 10px;text-align:left;color:var(--text-secondary);font-size:10px">#</th>
              <th style="padding:7px 10px;text-align:left;color:var(--text-secondary);font-size:10px">Descrição</th>
              <th style="padding:7px 10px;text-align:center;color:var(--text-secondary);font-size:10px">Qtd</th>
              <th style="padding:7px 10px;text-align:center;color:var(--text-secondary);font-size:10px">Un</th>
              <th style="padding:7px 10px;text-align:right;color:var(--text-secondary);font-size:10px">Unit.</th>
              <th style="padding:7px 10px;text-align:right;color:var(--text-secondary);font-size:10px">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itens.length > 0 ? itens.map((it, i) => {
              const preco = it.preco || it.valor_unit || 0;
              const total = it.total || (it.qtd * preco);
              return `<tr style="border-bottom:1px solid var(--border-color)">
                <td style="padding:6px 10px;color:var(--text-muted)">${String(i+1).padStart(2,'0')}</td>
                <td style="padding:6px 10px">${it.descricao || it.desc || '—'}</td>
                <td style="padding:6px 10px;text-align:center">${it.qtd}</td>
                <td style="padding:6px 10px;text-align:center">${it.unidade || it.un || 'Un'}</td>
                <td style="padding:6px 10px;text-align:right">${fmt(preco)}</td>
                <td style="padding:6px 10px;text-align:right;font-weight:600;color:var(--fa-teal)">${fmt(total)}</td>
              </tr>`;
            }).join('') : `<tr><td colspan="6" style="padding:12px;text-align:center;color:var(--text-muted)">Itens do RFQ: ${rfq.titulo}</td></tr>`}
            <tr style="background:rgba(0,180,184,0.08);font-weight:700">
              <td colspan="5" style="padding:8px 10px;text-align:right;color:var(--text-primary)">TOTAL NEGOCIADO</td>
              <td style="padding:8px 10px;text-align:right;color:var(--fa-teal);font-size:14px">${fmt(valorFinal)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Opções de envio ao fornecedor -->
    <div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:10px;padding:14px 16px;margin-bottom:4px">
      <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:12px">
        <i class="fas fa-paper-plane" style="color:var(--fa-teal);margin-right:6px"></i>Envio ao Fornecedor após emissão
      </div>
      <div style="display:flex;flex-direction:column;gap:8px">
        <label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:10px 12px;border:1px solid var(--border-color);border-radius:8px;background:var(--bg-card)" onclick="_pcSelectEnvio('email')">
          <input type="radio" name="pcEnvio" value="email" id="pcEnvioEmail" ${emailForn?'checked':''} style="accent-color:var(--fa-teal)">
          <div style="flex:1">
            <div style="font-size:12px;font-weight:600"><i class="fas fa-envelope" style="color:var(--fa-teal);margin-right:6px"></i>Enviar por e-mail</div>
            <div style="margin-top:6px;display:flex;gap:8px;align-items:center">
              <input id="pcEmailForn" type="email" value="${emailForn}" placeholder="email@fornecedor.com"
                class="form-control" style="flex:1;font-size:12px;max-width:280px" onclick="event.stopPropagation()">
              <span style="font-size:10px;color:var(--text-muted)">PDF anexado automaticamente</span>
            </div>
          </div>
        </label>
        <label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:10px 12px;border:1px solid var(--border-color);border-radius:8px;background:var(--bg-card)" onclick="_pcSelectEnvio('pdf')">
          <input type="radio" name="pcEnvio" value="pdf" id="pcEnvioPDF" ${emailForn?'':'checked'} style="accent-color:var(--fa-teal)">
          <div>
            <div style="font-size:12px;font-weight:600"><i class="fas fa-file-pdf" style="color:#ef4444;margin-right:6px"></i>Apenas gerar PDF</div>
            <div style="font-size:10px;color:var(--text-muted);margin-top:2px">Faz o download do PDF sem enviar por e-mail. Você poderá enviar depois.</div>
          </div>
        </label>
        <label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:10px 12px;border:1px solid var(--border-color);border-radius:8px;background:var(--bg-card)" onclick="_pcSelectEnvio('depois')">
          <input type="radio" name="pcEnvio" value="depois" id="pcEnvioDepois" style="accent-color:var(--fa-teal)">
          <div>
            <div style="font-size:12px;font-weight:600"><i class="fas fa-clock" style="color:#f59e0b;margin-right:6px"></i>Enviar depois</div>
            <div style="font-size:10px;color:var(--text-muted);margin-top:2px">Salva o pedido como emitido. Envio manual pela tela de Pedidos de Compra.</div>
          </div>
        </label>
      </div>
    </div>
    `,
    `<button class="btn btn-secondary" onclick="_pcStep2()"><i class="fas fa-arrow-left" style="margin-right:6px"></i>Voltar</button>
     <button class="btn btn-success" onclick="_pcEmitirConfirmar()">
       <i class="fas fa-shopping-bag" style="margin-right:6px"></i>Emitir Pedido de Compra
     </button>`
  );

  // Destaca a opção com e-mail se disponível
  setTimeout(() => { _pcSelectEnvio(emailForn ? 'email' : 'pdf'); }, 50);
}

function _pcSelectEnvio(opcao) {
  ['email','pdf','depois'].forEach(v => {
    const radio = document.getElementById('pcEnvio' + v.charAt(0).toUpperCase() + v.slice(1));
    if (radio) radio.checked = (v === opcao);
    const label = radio?.closest('label');
    if (label) {
      label.style.borderColor = (v === opcao) ? 'var(--fa-teal)' : 'var(--border-color)';
      label.style.background  = (v === opcao) ? 'rgba(0,180,184,0.06)' : 'var(--bg-card)';
    }
  });
}

async function _pcEmitirConfirmar() {
  const w      = window._pcWizard;
  const { rfq, matriz, cotPrinc, ativas, valorFinal } = w;

  // ── Busca RFQ atualizado em todas as fontes ─────────────────────────────
  let rfqsAll = _getRFQs();
  let rfqLive = rfqsAll.find(r => r.id === rfq.id);
  if (!rfqLive) {
    try {
      const flow = JSON.parse(localStorage.getItem('fa_rfq_flow') || '[]');
      rfqLive = flow.find(r => r.id === rfq.id);
      if (rfqLive) rfqsAll = flow;
    } catch(e) {}
  }

  const hoje = new Date().toLocaleDateString('pt-BR');
  const prazoFmt = w.prazoEntrega
    ? new Date(w.prazoEntrega + 'T12:00:00').toLocaleDateString('pt-BR') : '';

  // ── Normaliza itens (suporta formato novo e legado) ──────────────────────
  const itensRaw = cotPrinc.itens || rfq.itens || [];
  const itensSalvos = itensRaw.map(it => ({
    desc:  it.descricao || it.desc || it.nome || '—',
    qtd:   Number(it.qtd || it.quantidade || 1),
    un:    it.unidade || it.un || 'Un',
    preco: Number(it.preco || it.valor_unit || it.preco_unit || 0),
    total: Number(it.total || it.valor_total || ((it.qtd || 1) * (it.preco || it.valor_unit || 0)))
  }));

  // ── Normaliza identificação do fornecedor (suporta formatos antigos e novos) ─
  // Formato novo: cotPrinc.fornecedor = id cadastrado (ex: 'FOR-001')
  // Formato legado: cotPrinc.fornecedor_id, cotPrinc.fornecedor = nome direto
  const fornId   = cotPrinc.fornecedor_id || cotPrinc.fornecedor || matriz.fornecedor_selecionado || '';
  const fornNome = _rfqNomeForn(fornId) !== fornId
    ? _rfqNomeForn(fornId)
    : (cotPrinc.fornecedor_nome || matriz.forn_recomendado_nome || matriz.fornecedor_selecionado_nome || _rfqNomeForn(fornId));

  const novoPedido = {
    id:               gerarId('PC'),
    numero:           w.numeroPedido,
    fornecedor:       fornId,
    fornecedor_id:    fornId,
    fornecedor_nome:  fornNome,
    contrato_id:      w.contrato,
    solicitante:      rfq.solicitante || rfq.criado_por || currentUser?.name || '',
    aprovador:        matriz.aprovado_por || matriz.aprovador || currentUser?.name || '',
    descricao:        rfq.titulo || rfq.descricao || '—',
    tipo_pedido:      w.tipoPedido,
    conta_contabil:   w.contaContabil,
    criterio_selecao: matriz.criterio || '',
    desconto_aplicado:cotPrinc.desconto_pct || 0,
    itens:            JSON.stringify(itensSalvos),
    valor_total:      valorFinal,
    status:           'Emitido',
    prioridade:       w.prioridade,
    data_emissao:     new Date().toISOString().split('T')[0],
    data_entrega_prev: w.prazoEntrega || '',
    cond_pagamento:   w.condPagto,
    observacoes:      w.obs,
    rfq_numero:       rfq.numero_rfq || rfq.numero || rfq.id,
    rfq_id:           rfq.id,
    matriz_id:        matriz.id,
    historico_aprovacoes: [
      { etapa: 'Requisição',       aprovado_por: rfq.solicitante || rfq.criado_por || '—', data: rfq.data_abertura || rfq.data_criacao || hoje },
      { etapa: 'Mapa Comparativo', aprovado_por: matriz.aprovado_por || matriz.aprovador || currentUser?.name || '—', data: matriz.aprovado_em || matriz.data_aprovacao || hoje }
    ]
  };

  // ── Persiste pedido de forma atômica (sem duplicação) ─────────────────────────
  // 1. Lê o estado atual do localStorage
  let pedidosList = [];
  try {
    const raw = localStorage.getItem('fa_pedidos');
    if (raw) pedidosList = JSON.parse(raw);
  } catch(e) { pedidosList = []; }

  // 2. Insere apenas se não existir ainda (evita duplicata)
  if (!pedidosList.find(p => p.id === novoPedido.id)) {
    pedidosList.unshift(novoPedido);
  }

  // 3. Persiste no localStorage (funciona offline e entre sessões)
  localStorage.setItem('fa_pedidos', JSON.stringify(pedidosList));

  // 4. Persiste também na API D1 (para sincronização entre dispositivos)
  try {
    // Mapeia campos do wizard para o formato esperado pela API
    const payloadApi = {
      fornecedor_id:     novoPedido.fornecedor_id || novoPedido.fornecedor,
      fornecedor:        novoPedido.fornecedor_nome || novoPedido.fornecedor_id,
      mapa_id:           novoPedido.matriz_id || null,
      mapa_numero:       novoPedido.matriz_id || null,
      rfq_id:            novoPedido.rfq_id || null,
      rfq_numero:        novoPedido.rfq_numero || null,
      valor_total:       novoPedido.valor_total,
      condicao_pagamento:novoPedido.cond_pagamento || '—',
      prazo_entrega:     novoPedido.data_entrega_prev || null,
      observacoes:       novoPedido.observacoes || null,
      emitido_por:       novoPedido.aprovador || novoPedido.solicitante || '',
      itens: (() => {
        try {
          const raw = typeof novoPedido.itens === 'string' ? JSON.parse(novoPedido.itens) : (novoPedido.itens || []);
          return raw.map(it => ({
            descricao:  it.desc || it.descricao || '—',
            qtd:        Number(it.qtd || 1),
            unidade:    it.un || it.unidade || 'Un',
            preco_unit: Number(it.preco || it.preco_unit || 0),
            total:      Number(it.total || 0)
          }));
        } catch(e) { return []; }
      })()
    };
    fetch('/api/pedidos', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(payloadApi)
    }).catch(() => {}); // falha silenciosa — localStorage é o fallback
  } catch(eApi) {}

  // 5. Atualiza o array em memória do módulo pedidos (se carregado)
  if (typeof FA_PEDIDOS !== 'undefined') {
    if (!FA_PEDIDOS.find(p => p.id === novoPedido.id)) {
      FA_PEDIDOS.unshift(novoPedido);
    }
  }

  // Atualiza RFQ — suporta fa_rfqs e fa_rfq_flow
  if (rfqLive) {
    rfqLive.status        = 'Pedido Emitido';
    rfqLive.pedido_numero = w.numeroPedido;
    // Salva na mesma source que foi encontrado
    _saveRFQs(rfqsAll);
    // Também sincroniza o fa_rfq_flow se diferente
    try {
      const flow = JSON.parse(localStorage.getItem('fa_rfq_flow') || '[]');
      const fi = flow.findIndex(r => r.id === rfq.id);
      if (fi >= 0) {
        flow[fi].status = 'Pedido Emitido';
        flow[fi].pedido_numero = w.numeroPedido;
        localStorage.setItem('fa_rfq_flow', JSON.stringify(flow));
      }
    } catch(e) {}
    // Atualiza status do mapa para refletir que PC foi emitido
    const matzAll = _getMatrizes();
    const matzLive = matzAll.find(m => m.id === matriz.id);
    if (matzLive) {
      matzLive.pc_emitido = true;
      matzLive.pc_numero  = w.numeroPedido;
      _saveMatrizes(matzAll);
    }
  }

  // Gera CP se antecipado
  if (w.condPagto === 'Antecipado') {
    _gerarContaPagar(novoPedido, 'Antecipado');
  }

  logAction('Emitir PC', 'Pedidos', `Pedido ${w.numeroPedido} (${w.tipoPedido}) emitido – ${novoPedido.fornecedor_nome} – ${rfq.numero_rfq || rfq.id}`);

  // Verifica opção de envio
  const opcaoEnvio = document.querySelector('input[name="pcEnvio"]:checked')?.value || 'depois';
  closeModal();

  if (opcaoEnvio === 'email') {
    const emailDest = document.getElementById('pcEmailForn')?.value?.trim() || '';
    if (emailDest && emailDest.includes('@')) {
      await _pcSimularEnvioFornecedor(novoPedido, emailDest);
    } else {
      showToast('E-mail do fornecedor não informado. Pedido emitido sem envio.', 'warning', 4000);
      _abrirModalEnvioPedido(novoPedido);
    }
  } else if (opcaoEnvio === 'pdf') {
    setTimeout(() => gerarPdfPedido(novoPedido, true), 400);
    _notificarPedidoCriado(novoPedido);
  } else {
    // "Enviar depois" → abre modal de opções completo na aba Pedidos
    _abrirModalEnvioPedido(novoPedido);
  }

  // ── Navega para aba Pedidos e recarrega a lista ──────────────────────────
  // O delay varia: email espera simulação terminar, pdf/depois navega rápido
  const delay = opcaoEnvio === 'email' ? 2800 : 600;
  setTimeout(() => {
    // Garante que estamos na aba Pedidos de Compra
    if (typeof navigate === 'function') {
      navigate('pedidos');
    } else if (typeof renderPedidos === 'function') {
      renderPedidos();
    }
    // Atualiza a UI da lista após a aba carregar
    setTimeout(() => {
      if (typeof _renderPedidosUI === 'function') _renderPedidosUI();
    }, 350);
  }, delay);
}

function _pcExibirSucessoEmissao(pedido) {
  showToast(
    `✅ Pedido <strong>${pedido.numero}</strong> emitido! Tipo: ${pedido.tipo_pedido} · ${fmt(pedido.valor_total)} · Cond.: ${pedido.cond_pagamento}`,
    'success', 7000
  );
}

// Notificação leve após emissão (sem abrir modal)
function _notificarPedidoCriado(pedido) {
  showToast(
    `✅ Pedido <strong>${pedido.numero}</strong> emitido com sucesso! Acesse a aba <strong>Pedidos de Compra</strong> para mais opções.`,
    'success', 7000
  );
}

// Abre modal completo de envio de pedido (PDF + Email)
function _abrirModalEnvioPedido(pedido) {
  if (typeof openModalPosCriacao === 'function') {
    const fornecedor = typeof FA_FORNECEDORES !== 'undefined'
      ? FA_FORNECEDORES.find(f => f.id === pedido.fornecedor_id)
      : null;
    openModalPosCriacao(pedido, fornecedor);
  } else {
    _pcExibirSucessoEmissao(pedido);
  }
}

async function _pcSimularEnvioFornecedor(pedido, emailDest) {
  showToast(`Enviando pedido ${pedido.numero} para ${emailDest}…`, 'info', 2000);
  await new Promise(r => setTimeout(r, 1200));
  logAction('Envio Email PC', 'Pedidos', `${pedido.numero} enviado para ${emailDest}`);
  showToast(`📧 Pedido ${pedido.numero} enviado para <strong>${emailDest}</strong>!`, 'success', 6000);
  // Abre prévia do e-mail
  let itensArr = [];
  try { itensArr = JSON.parse(pedido.itens || '[]'); } catch(e){}
  _mostrarPreviaEmail(pedido, emailDest, itensArr);
}

// ─── LEGADO: mantido para compatibilidade ─────────────────────────────────────
function confirmarEmissaoPedidoRFQ(rfqId, matrizId) {
  const rfqs = _getRFQs();
  const rfq = rfqs.find(r => r.id === rfqId);
  const matrizes = _getMatrizes();
  const matriz = matrizes.find(m => m.id === matrizId);
  if (!rfq || !matriz) return;

  const cotForn    = rfq.cotacoes[matriz.forn_recomendado_idx] || rfq.cotacoes[0];
  const valorFinalPC = cotForn?.total_negociado != null ? cotForn.total_negociado : (cotForn?.total || 0);
  const prazoRaw = document.getElementById('pcPrazoEntrega')?.value;
  const prazoFmt = prazoRaw ? new Date(prazoRaw + 'T12:00:00').toLocaleDateString('pt-BR') : '';
  const condPagto = document.getElementById('pcCondPagto')?.value || 'À entrega';
  const numeroPedido = document.getElementById('pcNumero')?.value || '';
  const cliente = document.getElementById('pcCliente')?.value || 'Fraser Alexander';
  const obs = document.getElementById('pcObs')?.value || '';

  // Cria pedido no módulo de pedidos
  const hoje = new Date().toLocaleDateString('pt-BR');
  const novoPedido = {
    id: gerarId('PC'),
    numero: numeroPedido,
    fornecedor: cotForn?.fornecedor || '',
    contrato_id: rfq.contrato,
    solicitante: rfq.solicitante,
    aprovador: currentUser?.name || '',
    cliente_final: cliente,
    descricao: rfq.titulo,
    criterio_selecao: matriz.criterio || '',
    desconto_aplicado: cotForn?.desconto_pct || 0,
    itens: (cotForn?.itens || rfq.itens || []).map(it => ({
      descricao: it.descricao,
      qtd: it.qtd,
      unidade: it.unidade,
      preco_unit: it.preco || it.valor_unit || 0,
      total: it.total || (it.qtd * (it.preco || it.valor_unit || 0))
    })),
    valor_total: valorFinalPC,
    status: 'Emitido',
    prioridade: 'Normal',
    data_emissao: hoje,
    prazo_entrega: prazoFmt,
    cond_pagamento: condPagto,
    observacoes: obs,
    rfq_numero: rfq.numero_rfq,
    historico_aprovacoes: [
      { etapa: 'Requisição', aprovado_por: rfq.solicitante, data: rfq.data_abertura || hoje },
      { etapa: 'Supervisor', aprovado_por: 'Supervisor de Campo', data: hoje },
      { etapa: 'Gestor de Operações', aprovado_por: currentUser?.name || 'Gestor', data: hoje },
      { etapa: 'Mapa Comparativo', aprovado_por: currentUser?.name || '', data: hoje }
    ]
  };

  // Salva no array de pedidos
  if (typeof FA_PEDIDOS !== 'undefined') {
    FA_PEDIDOS.unshift(novoPedido);
  }

  rfq.status = 'Pedido Emitido';
  rfq.pedido_numero = numeroPedido;
  _saveRFQs(rfqs);

  // Se pagamento antecipado → gera CP imediatamente
  if (condPagto === 'Antecipado') {
    _gerarContaPagar(novoPedido, 'Antecipado');
    showToast(`Pedido ${numeroPedido} emitido! Pagamento ANTECIPADO – CP gerada automaticamente. Total: ${fmt(valorFinalPC)}`, 'warning', 6000);
  } else {
    showToast(`Pedido ${numeroPedido} emitido com sucesso! Condição: ${condPagto} · Total: ${fmt(valorFinalPC)}`, 'success', 5000);
  }

  logAction('Emitir', 'Pedidos', `Pedido ${numeroPedido} emitido para ${cotForn?.fornecedor} – ${rfq.numero_rfq}`);
  closeModal();
  renderRFQ();
}

function _gerarContaPagar(pedido, tipoPagamento) {
  if (typeof FA_CONTAS_PAGAR !== 'undefined') {
    const hoje = new Date();
    FA_CONTAS_PAGAR.unshift({
      id: gerarId('CP'),
      descricao: pedido.descricao,
      fornecedor_nome: pedido.fornecedor,
      tipo: 'Fornecedor',
      contrato_id: pedido.contrato_id || '',
      valor: pedido.valor_total,
      vencimento: tipoPagamento === 'Antecipado' ? hoje.toLocaleDateString('pt-BR') : (() => {
        const dias = tipoPagamento === '30 dias' ? 30 : tipoPagamento === '60 dias' ? 60 : 15;
        return new Date(hoje.getTime() + dias*24*60*60*1000).toLocaleDateString('pt-BR');
      })(),
      nf: '',
      status: 'Pendente',
      pedido_id: pedido.id,
      cond_pagamento: tipoPagamento,
      conta_contabil: 'Fornecedores',
      centro_custo: pedido.contrato_id || 'Geral'
    });
  }
}

// ─── RECEBIMENTO DE MATERIAIS ───
async function renderRecebimento() {
  const isAlm = currentUser && ['admin','compras','operacao','diretor'].includes(currentUser.profile);
  if (!isAlm) {
    document.getElementById('mainContent').innerHTML = `<div class="empty-state"><i class="fas fa-lock"></i><p>Acesso restrito ao Almoxarifado.</p></div>`;
    return;
  }

  // Busca recebimentos: API + localStorage merged
  let rec = [];
  try {
    const resp = await fetch('/api/recebimentos?limit=200');
    if (resp.ok) {
      const data = await resp.json();
      if (data.success && Array.isArray(data.data)) rec = data.data;
    }
  } catch(e) {}

  // Merge com localStorage (recebimentos criados localmente)
  try {
    const local = JSON.parse(localStorage.getItem('fa_recebimentos') || '[]');
    const ids = new Set(rec.map(r => r.id || r.numero));
    local.forEach(r => { if (!ids.has(r.id) && !ids.has(r.numero)) rec.unshift(r); });
  } catch(e) {}

  // KPIs
  const totalValor       = rec.reduce((s, r) => s + (parseFloat(r.valor_nf) || 0), 0);
  const conformes        = rec.filter(r => r.status === 'Conforme').length;
  const parciais         = rec.filter(r => r.status === 'Parcial').length;
  const divergentes      = rec.filter(r => r.status === 'Divergente').length;
  const semCP            = rec.filter(r => !r.cp_gerado).length;
  const aguardAlmox      = rec.filter(r => r.etapa === 'Recebimento Físico' && r.status === 'Conforme').length;

  document.getElementById('mainContent').innerHTML = `
    <div class="page-header">
      <div class="page-title">
        <h2><i class="fas fa-dolly" style="color:var(--orange);margin-right:8px"></i>Recebimento de Materiais</h2>
        <p>Fluxo em 2 etapas: Conferência Física → Entrada no Almoxarifado</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary btn-sm" onclick="renderRecebimento()"><i class="fas fa-sync-alt"></i> Atualizar</button>
        <button class="btn btn-primary btn-sm" onclick="abrirRecebimento()"><i class="fas fa-plus"></i> Registrar Recebimento</button>
      </div>
    </div>

    <!-- Fluxo visual 2 etapas -->
    <div style="display:flex;align-items:center;gap:0;margin-bottom:20px;background:var(--bg-card);border-radius:12px;border:1px solid var(--border-color);padding:16px;overflow-x:auto">
      <div style="display:flex;align-items:center;flex-shrink:0;gap:8px;padding:10px 16px;background:rgba(234,179,8,0.1);border-radius:8px;border:1.5px solid #ca8a04">
        <i class="fas fa-truck" style="color:#ca8a04;font-size:18px"></i>
        <div>
          <div style="font-weight:700;font-size:13px;color:#ca8a04">Etapa 1</div>
          <div style="font-size:12px;font-weight:600;color:var(--text-primary)">Conferência Física</div>
          <div style="font-size:11px;color:var(--text-muted)">Equipe de Recebimento</div>
        </div>
      </div>
      <div style="flex:1;height:2px;background:linear-gradient(to right,#ca8a04,#22c55e);min-width:30px"></div>
      <div style="display:flex;align-items:center;flex-shrink:0;gap:8px;padding:10px 16px;background:rgba(34,197,94,0.1);border-radius:8px;border:1.5px solid #16a34a">
        <i class="fas fa-warehouse" style="color:#16a34a;font-size:18px"></i>
        <div>
          <div style="font-weight:700;font-size:13px;color:#16a34a">Etapa 2</div>
          <div style="font-size:12px;font-weight:600;color:var(--text-primary)">Entrada Almoxarifado</div>
          <div style="font-size:11px;color:var(--text-muted)">Responsável Almoxarife</div>
        </div>
      </div>
      <div style="flex:1;height:2px;background:linear-gradient(to right,#22c55e,#6366f1);min-width:30px"></div>
      <div style="display:flex;align-items:center;flex-shrink:0;gap:8px;padding:10px 16px;background:rgba(99,102,241,0.1);border-radius:8px;border:1.5px solid #6366f1">
        <i class="fas fa-file-invoice-dollar" style="color:#6366f1;font-size:18px"></i>
        <div>
          <div style="font-weight:700;font-size:13px;color:#6366f1">Etapa 3</div>
          <div style="font-size:12px;font-weight:600;color:var(--text-primary)">Geração de CP</div>
          <div style="font-size:11px;color:var(--text-muted)">Financeiro</div>
        </div>
      </div>
    </div>

    <!-- Alerta: aguardando entrada almoxarifado -->
    ${aguardAlmox > 0 ? `
    <div style="background:rgba(234,179,8,0.08);border:1.5px solid #ca8a04;border-radius:10px;padding:12px 16px;margin-bottom:16px;display:flex;align-items:center;gap:12px">
      <i class="fas fa-warehouse" style="color:#ca8a04;font-size:20px"></i>
      <div style="flex:1">
        <div style="font-weight:700;font-size:13px;color:#ca8a04">${aguardAlmox} recebimento(s) aguardando confirmação do Almoxarifado</div>
        <div style="font-size:12px;color:var(--text-muted)">Conferência física concluída. Almoxarife deve confirmar entrada em estoque.</div>
      </div>
      <button onclick="_filtrarRecebPorEtapa('Recebimento Físico')" class="btn btn-sm" style="background:#ca8a04;color:#fff;border:none;padding:6px 14px;border-radius:6px;font-size:12px;cursor:pointer">
        <i class="fas fa-eye"></i> Ver Pendentes
      </button>
    </div>
    ` : ''}

    <!-- KPIs -->
    <div class="kpi-grid" style="grid-template-columns:repeat(6,1fr);margin-bottom:20px">
      <div class="kpi-card">
        <div class="kpi-label">Total Receb.</div>
        <div class="kpi-value">${rec.length}</div>
        <div class="kpi-sub">registros</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Valor Total NF</div>
        <div class="kpi-value" style="font-size:18px">${fmtK(totalValor)}</div>
        <div class="kpi-sub">recebido</div>
      </div>
      <div class="kpi-card" style="cursor:pointer" onclick="_filtrarRecebPorEtapa('Recebimento Físico')">
        <div class="kpi-label" style="color:#ca8a04">Aguard. Almoxarife</div>
        <div class="kpi-value" style="color:#ca8a04">${aguardAlmox}</div>
        <div class="kpi-sub">etapa 2</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Conformes</div>
        <div class="kpi-value" style="color:#22c55e">${conformes}</div>
        <div class="kpi-sub">entregas OK</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Divergentes</div>
        <div class="kpi-value" style="color:#f59e0b">${parciais + divergentes}</div>
        <div class="kpi-sub">em tratativa</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Sem CP</div>
        <div class="kpi-value" style="color:${semCP>0?'#ef4444':'#22c55e'}">${semCP}</div>
        <div class="kpi-sub">aguardando</div>
      </div>
    </div>

    <!-- Barra de filtro -->
    <div class="card" style="margin-bottom:16px;padding:12px 16px">
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <input id="rec_search" type="text" placeholder="🔍 Buscar por NF, Pedido, Fornecedor..."
          style="flex:1;min-width:200px;padding:7px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px"
          oninput="_filtrarRecebimentos()">
        <select id="rec_filter_etapa"
          style="padding:7px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px"
          onchange="_filtrarRecebimentos()">
          <option value="">Todas as Etapas</option>
          <option value="Recebimento Físico">⏳ Aguard. Almoxarife</option>
          <option value="Entrada Almoxarifado">✅ Entrada Confirmada</option>
        </select>
        <select id="rec_filter_status"
          style="padding:7px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px"
          onchange="_filtrarRecebimentos()">
          <option value="">Todos os status</option>
          <option value="Conforme">Conforme</option>
          <option value="Parcial">Parcial</option>
          <option value="Divergente">Divergente</option>
          <option value="Recusado">Recusado</option>
        </select>
        <select id="rec_filter_cp"
          style="padding:7px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px"
          onchange="_filtrarRecebimentos()">
          <option value="">Todos (CP)</option>
          <option value="sim">CP Gerado</option>
          <option value="nao">Sem CP</option>
        </select>
      </div>
    </div>

    <div class="card" id="recebimentosTabela">
      ${_renderTabelaRecebimentos(rec)}
    </div>
  `;

  // Salva dados para filtro posterior
  window._recebimentosData = rec;
}

function _filtrarRecebPorEtapa(etapa) {
  const el = document.getElementById('rec_filter_etapa');
  if (el) { el.value = etapa; _filtrarRecebimentos(); }
}

function _renderTabelaRecebimentos(rec) {
  if (!rec || rec.length === 0) return `
    <div style="text-align:center;padding:40px;color:var(--text-muted)">
      <i class="fas fa-dolly" style="font-size:36px;margin-bottom:12px;display:block"></i>
      Nenhum recebimento registrado. Clique em "Registrar Recebimento" para começar.
    </div>
  `;
  const statusColors = { Conforme:'#22c55e', Parcial:'#f59e0b', Divergente:'#ef4444', Recusado:'#6b7280' };
  return `
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Nº Recebimento</th>
            <th>Pedido</th>
            <th>Fornecedor</th>
            <th>NF</th>
            <th style="text-align:right">Valor NF</th>
            <th style="text-align:center">Data</th>
            <th style="text-align:center">Etapa</th>
            <th style="text-align:center">Status</th>
            <th style="text-align:center">CP</th>
            <th style="text-align:center">Ações</th>
          </tr>
        </thead>
        <tbody>
          ${rec.map(r => {
            const color = statusColors[r.status] || '#6b7280';
            const etapa = r.etapa || 'Entrada Almoxarifado';
            const etapaColor = etapa === 'Recebimento Físico' ? '#ca8a04' : '#16a34a';
            const etapaIcon  = etapa === 'Recebimento Físico' ? 'fa-truck' : 'fa-warehouse';
            return `
            <tr style="${etapa==='Recebimento Físico'?'background:rgba(234,179,8,0.03)':''}">
              <td style="font-weight:600;color:var(--fa-teal);font-size:12px">${r.numero || r.id}</td>
              <td style="font-size:12px;font-weight:600">${r.pedido_numero || r.pedido_numero_real || '—'}</td>
              <td style="font-size:12px;color:var(--text-secondary)">${r.fornecedor || r.fornecedor_nome_real || '—'}</td>
              <td style="font-size:12px">${r.nf_numero || '—'}</td>
              <td style="text-align:right;font-weight:600;color:var(--fa-teal)">${fmt(r.valor_nf)}</td>
              <td style="text-align:center;font-size:11px;color:var(--text-muted)">${r.data_recebimento || '—'}</td>
              <td style="text-align:center">
                <span style="padding:3px 8px;border-radius:6px;font-size:10px;font-weight:700;background:${etapaColor}1a;color:${etapaColor};border:1px solid ${etapaColor}40;white-space:nowrap">
                  <i class="fas ${etapaIcon}" style="margin-right:3px;font-size:9px"></i>${etapa}
                </span>
              </td>
              <td style="text-align:center">
                <span style="padding:3px 8px;border-radius:6px;font-size:10px;font-weight:700;background:${color}1a;color:${color};border:1px solid ${color}40">
                  ${r.status || 'Conforme'}
                </span>
              </td>
              <td style="text-align:center">
                ${r.cp_gerado
                  ? `<span style="color:#22c55e;font-size:12px"><i class="fas fa-check-circle"></i> Gerado</span>`
                  : `<button onclick="gerarCPRecebimento('${r.numero || r.id}')" class="btn btn-sm btn-primary" style="font-size:11px">Gerar CP</button>`
                }
              </td>
              <td style="text-align:center;white-space:nowrap">
                <button class="btn btn-secondary btn-sm btn-icon" onclick="_verDetalheRecebimento('${r.id || r.numero}')" title="Ver detalhes">
                  <i class="fas fa-eye"></i>
                </button>
                ${etapa === 'Recebimento Físico' && r.status === 'Conforme' ? `
                  <button class="btn btn-sm btn-icon" onclick="confirmarEntradaAlmoxarifado('${r.id || r.numero}')"
                    style="background:#16a34a;color:#fff;border:none;cursor:pointer" title="Confirmar Entrada Almoxarifado">
                    <i class="fas fa-warehouse"></i>
                  </button>
                ` : ''}
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function _filtrarRecebimentos() {
  const s       = (document.getElementById('rec_search')?.value || '').toLowerCase();
  const st      = document.getElementById('rec_filter_status')?.value || '';
  const cp      = document.getElementById('rec_filter_cp')?.value || '';
  const etapaF  = document.getElementById('rec_filter_etapa')?.value || '';
  const todos   = window._recebimentosData || [];
  const filtrados = todos.filter(r => {
    const matchS  = !s || [r.numero, r.pedido_numero, r.fornecedor, r.nf_numero].some(v => (v||'').toLowerCase().includes(s));
    const matchSt = !st || r.status === st;
    const matchCP = !cp || (cp === 'sim' ? r.cp_gerado : !r.cp_gerado);
    const matchEt = !etapaF || (r.etapa || 'Entrada Almoxarifado') === etapaF;
    return matchS && matchSt && matchCP && matchEt;
  });
  const tabela = document.getElementById('recebimentosTabela');
  if (tabela) tabela.innerHTML = _renderTabelaRecebimentos(filtrados);
}

function _verDetalheRecebimento(id) {
  const todos = window._recebimentosData || [];
  const r = todos.find(x => (x.id || x.numero) === id);
  if (!r) { showToast('Recebimento não encontrado.', 'warning'); return; }

  let itensHtml = '';
  const itens = r.itens_inspecao || r.itens_conferidos || [];
  if (itens.length > 0) {
    const parsed = typeof itens === 'string' ? JSON.parse(itens) : itens;
    itensHtml = `
      <div style="margin-top:14px">
        <div style="font-weight:600;font-size:13px;margin-bottom:8px"><i class="fas fa-clipboard-check" style="color:var(--fa-teal);margin-right:6px"></i>Itens Conferidos</div>
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead><tr style="background:var(--bg-tertiary)">
            <th style="padding:6px 10px;text-align:left">Item</th>
            <th style="padding:6px 10px;text-align:center">Qtd Pedida</th>
            <th style="padding:6px 10px;text-align:center">Qtd Recebida</th>
            <th style="padding:6px 10px;text-align:center">Status</th>
          </tr></thead>
          <tbody>
            ${parsed.map(it => `
              <tr style="border-top:1px solid var(--border-color)">
                <td style="padding:6px 10px">${it.descricao || it.desc || '—'}</td>
                <td style="padding:6px 10px;text-align:center">${it.qtd_pedida || it.qtd || 1}</td>
                <td style="padding:6px 10px;text-align:center">${it.qtd_recebida || it.qtd || 1}</td>
                <td style="padding:6px 10px;text-align:center">
                  <span style="font-size:10px;font-weight:700;color:${it.status==='Conforme'||it.conforme?'#22c55e':it.status==='Parcial'?'#f59e0b':'#ef4444'}">${it.status || (it.conforme?'Conforme':'Divergente')}</span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  const etapa = r.etapa || 'Recebimento Físico';
  const etapaCor = etapa === 'Entrada Almoxarifado' ? '#16a34a' : '#ca8a04';

  openModal(`<i class="fas fa-box-open" style="color:#22c55e;margin-right:8px"></i>Recebimento ${r.numero || r.id}`, `
    <!-- Fluxo do processo -->
    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:11px;margin-bottom:14px;padding:10px 12px;background:var(--bg-tertiary);border-radius:8px">
      <span style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase">Fluxo:</span>
      ${r.pedido_numero ? `<span style="padding:2px 8px;border-radius:8px;background:rgba(22,163,74,0.1);color:#16a34a;font-weight:700"><i class="fas fa-shopping-bag" style="margin-right:3px;font-size:9px"></i>${r.pedido_numero}</span><i class="fas fa-arrow-right" style="color:var(--text-muted);font-size:9px"></i>` : ''}
      <span style="padding:2px 8px;border-radius:8px;background:${etapa==='Recebimento Físico'?'rgba(202,138,4,0.2)':'rgba(202,138,4,0.1)'};color:#ca8a04;font-weight:700;border:${etapa==='Recebimento Físico'?'1.5px solid #ca8a04':'1px solid rgba(202,138,4,0.2)'}">
        <i class="fas fa-dolly" style="margin-right:3px;font-size:9px"></i>Receb. Físico ${etapa==='Recebimento Físico'?'⟵':' ✅'}
      </span>
      <i class="fas fa-arrow-right" style="color:var(--text-muted);font-size:9px"></i>
      <span style="padding:2px 8px;border-radius:8px;background:${etapa==='Entrada Almoxarifado'?'rgba(22,163,74,0.2)':'rgba(107,114,128,0.08)'};color:${etapa==='Entrada Almoxarifado'?'#16a34a':'#6b7280'};font-weight:700;border:${etapa==='Entrada Almoxarifado'?'1.5px solid #16a34a':'1px solid rgba(107,114,128,0.2)'}">
        <i class="fas fa-warehouse" style="margin-right:3px;font-size:9px"></i>Almoxarifado ${etapa==='Entrada Almoxarifado'?'✅':'⏳'}
      </span>
      <i class="fas fa-arrow-right" style="color:var(--text-muted);font-size:9px"></i>
      <span style="padding:2px 8px;border-radius:8px;background:${r.cp_gerado?'rgba(22,163,74,0.1)':'rgba(107,114,128,0.08)'};color:${r.cp_gerado?'#16a34a':'#6b7280'};font-weight:700">
        <i class="fas fa-file-invoice-dollar" style="margin-right:3px;font-size:9px"></i>CP ${r.cp_gerado?'✅':'⏳'}
      </span>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
      <div class="stat-row"><span class="stat-label">Pedido</span><span class="stat-value" style="color:var(--fa-teal);font-weight:700">${r.pedido_numero || '—'}</span></div>
      <div class="stat-row"><span class="stat-label">Fornecedor</span><span class="stat-value">${r.fornecedor || '—'}</span></div>
      <div class="stat-row"><span class="stat-label">NF</span><span class="stat-value">${r.nf_numero || '—'}</span></div>
      <div class="stat-row"><span class="stat-label">Valor NF</span><span class="stat-value" style="font-weight:700;color:var(--fa-teal)">${fmt(r.valor_nf)}</span></div>
      <div class="stat-row"><span class="stat-label">Data Recebimento</span><span class="stat-value">${r.data_recebimento || '—'}</span></div>
      <div class="stat-row"><span class="stat-label">Conferente</span><span class="stat-value">${r.conferente || '—'}</span></div>
      <div class="stat-row"><span class="stat-label">Status</span>
        <span class="stat-value" style="color:${r.status==='Conforme'?'#22c55e':r.status==='Divergente'?'#ef4444':'#f59e0b'}">${r.status || 'Conforme'}</span>
      </div>
      <div class="stat-row"><span class="stat-label">Etapa</span>
        <span class="stat-value" style="color:${etapaCor};font-weight:700"><i class="fas ${etapa==='Entrada Almoxarifado'?'fa-warehouse':'fa-dolly'}" style="margin-right:4px"></i>${etapa}</span>
      </div>
      <div class="stat-row"><span class="stat-label">CP Gerado</span><span class="stat-value" style="color:${r.cp_gerado?'#22c55e':'#f59e0b'}">${r.cp_gerado ? '✅ Sim' : '⏳ Não'}</span></div>
      ${r.etapa2_por ? `<div class="stat-row"><span class="stat-label">Almoxarife</span><span class="stat-value">${r.etapa2_por}</span></div>` : ''}
      ${r.local_entrega || r.local_armazenamento ? `<div class="stat-row"><span class="stat-label">Local Armazenagem</span><span class="stat-value">${r.local_armazenamento || r.local_entrega || '—'}</span></div>` : ''}
    </div>
    ${r.obs ? `<div class="alert alert-info" style="margin-bottom:10px"><span class="alert-icon"><i class="fas fa-sticky-note"></i></span><div>${r.obs}</div></div>` : ''}
    ${itensHtml}
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
    ${etapa === 'Recebimento Físico' && r.status === 'Conforme' ? `
      <button class="btn btn-success" onclick="closeModal();setTimeout(()=>confirmarEntradaAlmoxarifado('${r.id || r.numero}'),150)">
        <i class="fas fa-warehouse"></i> Confirmar Entrada Almoxarifado
      </button>
    ` : ''}
    ${!r.cp_gerado && etapa === 'Entrada Almoxarifado' ? `<button class="btn btn-primary" onclick="gerarCPRecebimento('${r.numero || r.id}');closeModal()"><i class="fas fa-plus"></i> Gerar CP</button>` : ''}
  `);
}

function abrirRecebimento(pedidoIdPre) {
  // Inclui pedidos Emitido, Entregue Parcial (aguardando complemento), e Aprovado
  const statusAbertos = ['Emitido','Em Trânsito','Entregue Parcial','Aprovado'];
  const pedidos = typeof FA_PEDIDOS !== 'undefined'
    ? FA_PEDIDOS.filter(p => statusAbertos.includes(p.status))
    : [];

  const mc = document.getElementById('modalContainer');
  if (mc) mc.style.maxWidth = '820px';

  openModal('Registrar Recebimento de Material', `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div style="grid-column:1/-1">
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Pedido de Compra *</label>
        <select id="recPedido" onchange="_recPedidoSelecionado(this.value)"
          style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
          <option value="">Selecionar pedido...</option>
          ${pedidos.map(p => `<option value="${p.id}" ${pedidoIdPre===p.id?'selected':''}>${p.numero} – ${p.fornecedor_nome||p.fornecedor||'—'} (${fmt(p.valor_total)})</option>`).join('')}
          <option value="manual">Inserir manualmente (sem PC vinculado)</option>
        </select>
      </div>
      <div id="recPedidoInfo" style="grid-column:1/-1;display:none;padding:10px 12px;background:rgba(0,180,184,0.06);border:1px solid rgba(0,180,184,0.2);border-radius:8px;font-size:12px"></div>
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Número da NF *</label>
        <input type="text" id="recNF" placeholder="Ex: 001234"
          style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
      </div>
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Valor da NF (R$) *</label>
        <input type="number" id="recValorNF" placeholder="0.00" min="0" step="0.01"
          style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
      </div>
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Data de Recebimento</label>
        <input type="date" id="recData" value="${new Date().toISOString().split('T')[0]}"
          style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
      </div>
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Conferente</label>
        <input type="text" id="recConferente" value="${currentUser?.name || ''}"
          style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
      </div>
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Status do Recebimento</label>
        <select id="recStatus"
          style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
          <option value="Conforme">✅ Conforme – Entrega completa</option>
          <option value="Parcial">⚠️ Parcial – Entrega incompleta</option>
          <option value="Divergente">🔴 Divergente – Itens com problema</option>
          <option value="Recusado">❌ Recusado – Não aceito</option>
        </select>
      </div>
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Local de Entrega</label>
        <input type="text" id="recLocal" placeholder="Ex: Almoxarifado Central"
          style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
      </div>
      <div style="grid-column:1/-1">
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Arquivo da NF (opcional)</label>
        <div style="display:flex;gap:8px;align-items:center">
          <input type="text" id="recAnexoNF" placeholder="Ex: NF-001234.pdf"
            style="flex:1;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
          <button class="btn btn-secondary btn-sm" onclick="document.getElementById('recAnexoNF').value='NF-'+Date.now()+'.pdf';showToast('NF simulada anexada','info')">
            <i class="fas fa-paperclip"></i> Simular Anexo
          </button>
        </div>
      </div>
      <div style="grid-column:1/-1">
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Observações</label>
        <textarea id="recObs" rows="2"
          style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box;resize:vertical"
          placeholder="Ex: Itens conferidos, sem avarias. NF dentro do prazo."></textarea>
      </div>
    </div>
    <div style="margin-top:10px;padding:10px;background:rgba(0,180,184,0.06);border:1px solid rgba(0,180,184,0.2);border-radius:8px;font-size:12px;color:var(--text-secondary)">
      <i class="fas fa-magic" style="color:var(--fa-teal)"></i>
      <strong>Automático ao registrar:</strong> atualiza status do pedido, lança entrada no almoxarifado e gera Conta a Pagar (se cond. pagamento pós-recebimento).
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="salvarRecebimento()"><i class="fas fa-check-circle"></i> Registrar Recebimento</button>
  `);

  // Pré-seleciona pedido se passado por parâmetro
  if (pedidoIdPre) {
    setTimeout(() => {
      const sel = document.getElementById('recPedido');
      if (sel) { sel.value = pedidoIdPre; _recPedidoSelecionado(pedidoIdPre); }
    }, 100);
  }
}

// Mostra info do pedido selecionado no modal de recebimento
window._recPedidoSelecionado = function(pedidoId) {
  const info = document.getElementById('recPedidoInfo');
  const valorEl = document.getElementById('recValorNF');
  if (!info) return;
  if (!pedidoId || pedidoId === 'manual') { info.style.display = 'none'; return; }
  const pedido = typeof FA_PEDIDOS !== 'undefined' ? FA_PEDIDOS.find(p => p.id === pedidoId) : null;
  if (!pedido) { info.style.display = 'none'; return; }
  info.style.display = 'block';
  info.innerHTML = `
    <div style="display:flex;gap:16px;flex-wrap:wrap">
      <div><span style="color:var(--text-muted)">Fornecedor:</span> <strong>${pedido.fornecedor_nome||pedido.fornecedor||'—'}</strong></div>
      <div><span style="color:var(--text-muted)">Valor PC:</span> <strong style="color:var(--fa-teal)">${fmt(pedido.valor_total)}</strong></div>
      <div><span style="color:var(--text-muted)">Cond. Pagto:</span> <strong>${pedido.cond_pagamento||'—'}</strong></div>
      <div><span style="color:var(--text-muted)">Prev. Entrega:</span> <strong>${pedido.prazo_entrega||pedido.data_entrega_prevista||'—'}</strong></div>
    </div>
  `;
  if (valorEl && !valorEl.value) valorEl.value = pedido.valor_total || '';
};

async function salvarRecebimento() {
  const pedidoId = document.getElementById('recPedido')?.value;
  const nfNum    = document.getElementById('recNF')?.value?.trim();
  const valorNF  = parseFloat(document.getElementById('recValorNF')?.value || 0);
  if (!nfNum) { showToast('Informe o número da NF.', 'error'); return; }
  if (valorNF <= 0) { showToast('Informe o valor da NF.', 'error'); return; }

  const pedido  = (typeof FA_PEDIDOS !== 'undefined' && pedidoId && pedidoId !== 'manual')
    ? FA_PEDIDOS.find(p => p.id === pedidoId) : null;
  const dataRaw = document.getElementById('recData')?.value;
  const dataFmt = dataRaw
    ? new Date(dataRaw + 'T12:00:00').toLocaleDateString('pt-BR')
    : new Date().toLocaleDateString('pt-BR');
  const status     = document.getElementById('recStatus')?.value || 'Conforme';
  const conferente = document.getElementById('recConferente')?.value?.trim() || currentUser?.name || '';
  const local      = document.getElementById('recLocal')?.value?.trim() || '';
  const obs        = document.getElementById('recObs')?.value?.trim() || '';
  const anexo      = document.getElementById('recAnexoNF')?.value?.trim() || '';

  const recId  = 'REC-' + new Date().toISOString().replace(/\D/g,'').slice(0,14);
  const novoRec = {
    id:               recId,
    numero:           recId,
    pedido_id:        pedido?.id || pedidoId || '',
    pedido_numero:    pedido?.numero || '—',
    fornecedor_id:    pedido?.fornecedor_id || '',
    fornecedor:       pedido?.fornecedor_nome || pedido?.fornecedor || '—',
    nf_numero:        nfNum,
    valor_nf:         valorNF,
    data_recebimento: dataFmt,
    conferente,
    status,
    local_entrega:    local,
    obs,
    anexo_nf:         anexo,
    cp_gerado:        false,
    etapa:            'Recebimento Físico',  // Etapa 1: aguarda confirmação do almoxarife
    etapa1_por:       currentUser?.name || conferente,
    etapa1_em:        new Date().toISOString(),
    criado_em:        new Date().toISOString()
  };

  // Gera CP automaticamente se pós-recebimento
  if (pedido && pedido.cond_pagamento !== 'Antecipado' && status !== 'Recusado') {
    _gerarContaPagar(
      { ...pedido, numero: pedido.numero || nfNum, nf: nfNum, descricao: pedido.descricao },
      pedido.cond_pagamento
    );
    novoRec.cp_gerado = true;
  }

  // Atualiza status do pedido em memória
  if (pedido) {
    const statusMap = { Conforme: 'Entregue Total', Parcial: 'Entregue Parcial', Divergente: 'Entregue Parcial', Recusado: 'Emitido' };
    pedido.status = statusMap[status] || 'Entregue Total';
    pedido.data_entrega_real = dataRaw || new Date().toISOString().split('T')[0];
    pedido.nf_numero = nfNum;
    pedido.recebimento_id = recId;
    if (typeof _savePedidos === 'function') _savePedidos(FA_PEDIDOS);
    // Persiste na API
    try {
      await fetch(`/api/pedidos/${pedido.id}/entrega`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: pedido.status, data_entrega_real: pedido.data_entrega_real, nf_numero: nfNum, valor_nf: valorNF, obs_recebimento: obs, recebido_por: conferente })
      });
    } catch(e) {}
  }

  // Persiste recebimento
  const recs = _getRecebimentos();
  recs.unshift(novoRec);
  _saveRecebimentos(recs);

  // Atualiza estoque via módulo Almoxarifado (rastreabilidade completa)
  if (status !== 'Recusado') {
    try {
      if (typeof processarEntradaRecebimento === 'function') {
        await processarEntradaRecebimento(novoRec);
      } else if (pedido?.itens) {
        // Fallback legado
        const itens = typeof pedido.itens === 'string' ? JSON.parse(pedido.itens) : pedido.itens;
        const mats  = JSON.parse(localStorage.getItem('fa_materiais') || '[]');
        itens.forEach(it => {
          const mat = mats.find(m =>
            m.descricao?.toLowerCase().includes((it.descricao||it.desc||'').toLowerCase().split(' ')[0]) ||
            m.nome?.toLowerCase().includes((it.descricao||it.desc||'').toLowerCase().split(' ')[0])
          );
          if (mat) mat.estoque_atual = (parseFloat(mat.estoque_atual)||0) + (parseFloat(it.qtd||1));
        });
        localStorage.setItem('fa_materiais', JSON.stringify(mats));
      }
    } catch(e) { console.warn('[Procurement] Erro ao atualizar estoque:', e); }
  }

  logAction('Recebimento', 'Recebimento', `NF ${nfNum} – ${fmt(valorNF)} – ${status}`);
  closeModal();

  const msgs = {
    Conforme:   `✅ Recebimento registrado! NF ${nfNum}${novoRec.cp_gerado ? ' · CP gerado automaticamente' : ''}.`,
    Parcial:    `⚠️ Recebimento parcial registrado para NF ${nfNum}.`,
    Divergente: `⚠️ Recebimento com divergências registrado. Aguardando tratativa.`,
    Recusado:   `❌ Entrega recusada. Pedido mantido em aberto.`
  };
  showToast(msgs[status] || msgs.Conforme, status==='Recusado'?'error':status==='Conforme'?'success':'warning', 6000);
  renderRecebimento();
}

// ═══════════════════════════════════════════════════════════
// ETAPA 2: CONFIRMAÇÃO DE ENTRADA DO ALMOXARIFADO
// ═══════════════════════════════════════════════════════════

function confirmarEntradaAlmoxarifado(recId) {
  const todos = window._recebimentosData || _getRecebimentos();
  const rec   = todos.find(r => (r.id || r.numero) === recId);
  if (!rec) { showToast('Recebimento não encontrado.', 'error'); return; }

  // Busca itens do pedido vinculado
  let pedidoItens = [];
  try {
    if (rec.pedido_id && typeof FA_PEDIDOS !== 'undefined') {
      const ped = FA_PEDIDOS.find(p => p.id === rec.pedido_id);
      if (ped) {
        const raw = typeof ped.itens === 'string' ? JSON.parse(ped.itens) : (ped.itens || []);
        pedidoItens = raw.map((it, i) => ({
          idx: i, desc: it.desc || it.descricao || it.nome || '—',
          qtd: it.qtd || it.quantidade || 1, un: it.un || it.unidade || 'un',
          qtd_recebida: it.qtd || it.quantidade || 1
        }));
      }
    }
  } catch(e) {}

  openModalWide(`<i class="fas fa-warehouse" style="color:#16a34a;margin-right:8px"></i>Confirmar Entrada – Almoxarifado | ${rec.numero}`, `
    <!-- Info do recebimento -->
    <div style="background:rgba(34,197,94,0.07);border:1px solid rgba(34,197,94,0.25);border-radius:10px;padding:14px;margin-bottom:16px;display:grid;grid-template-columns:repeat(4,1fr);gap:8px;font-size:12px">
      <div><div style="font-size:10px;color:var(--text-muted);font-weight:700">RECEBIMENTO</div><div style="font-weight:700;color:var(--fa-teal)">${rec.numero}</div></div>
      <div><div style="font-size:10px;color:var(--text-muted);font-weight:700">PEDIDO</div><div style="font-weight:700">${rec.pedido_numero || '—'}</div></div>
      <div><div style="font-size:10px;color:var(--text-muted);font-weight:700">FORNECEDOR</div><div style="font-weight:700">${rec.fornecedor || '—'}</div></div>
      <div><div style="font-size:10px;color:var(--text-muted);font-weight:700">VALOR NF</div><div style="font-weight:700;color:var(--fa-teal)">${fmt(rec.valor_nf)}</div></div>
    </div>

    <!-- Formulário de entrada -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Local de Armazenagem *</label>
        <input type="text" id="alm_local" placeholder="Ex: Estante A3, Galpão Central, Rack B2"
          value="${rec.local_entrega || ''}"
          style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
      </div>
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Responsável Almoxarife *</label>
        <input type="text" id="alm_responsavel" value="${currentUser?.name || ''}"
          style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
      </div>
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Data de Entrada</label>
        <input type="date" id="alm_data" value="${new Date().toISOString().split('T')[0]}"
          style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
      </div>
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Condição dos Materiais</label>
        <select id="alm_condicao"
          style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
          <option value="Conforme">✅ Conforme – Sem avarias</option>
          <option value="Avaria Parcial">⚠️ Avaria Parcial – Parte dos itens com dano</option>
          <option value="Avaria Total">❌ Avaria Total – Todos com dano</option>
        </select>
      </div>
    </div>

    <!-- Checklist de itens -->
    ${pedidoItens.length > 0 ? `
    <div style="margin-bottom:16px">
      <div style="font-weight:700;font-size:13px;color:var(--text-primary);margin-bottom:8px">
        <i class="fas fa-clipboard-list" style="color:var(--fa-teal);margin-right:6px"></i>Checklist de Itens para Entrada em Estoque
      </div>
      <div style="border:1px solid var(--border-color);border-radius:8px;overflow:hidden">
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead><tr style="background:var(--bg-tertiary)">
            <th style="padding:8px 10px;text-align:left">Item</th>
            <th style="padding:8px 10px;text-align:center">Qtd Pedida</th>
            <th style="padding:8px 10px;text-align:center">Qtd a Dar Entrada</th>
            <th style="padding:8px 10px;text-align:center">Endereço Estoque</th>
            <th style="padding:8px 10px;text-align:center">OK</th>
          </tr></thead>
          <tbody>
            ${pedidoItens.map(it => `
              <tr style="border-top:1px solid var(--border-color)">
                <td style="padding:8px 10px">${it.desc}</td>
                <td style="padding:8px 10px;text-align:center;color:var(--text-muted)">${it.qtd} ${it.un}</td>
                <td style="padding:8px 10px;text-align:center">
                  <input type="number" id="alm_qtd_${it.idx}" value="${it.qtd_recebida}" min="0" step="0.01"
                    style="width:80px;padding:4px 8px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:6px;color:var(--text-primary);font-size:12px;text-align:center">
                </td>
                <td style="padding:8px 10px;text-align:center">
                  <input type="text" id="alm_end_${it.idx}" placeholder="Ex: A3-2"
                    style="width:90px;padding:4px 8px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:6px;color:var(--text-primary);font-size:11px">
                </td>
                <td style="padding:8px 10px;text-align:center">
                  <input type="checkbox" id="alm_ok_${it.idx}" checked
                    style="width:16px;height:16px;cursor:pointer;accent-color:#22c55e">
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
    ` : ''}

    <!-- Observações -->
    <div>
      <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Observações do Almoxarife</label>
      <textarea id="alm_obs" rows="2" placeholder="Ex: Materiais armazenados conforme plano de estocagem. EPI entregue na portaria."
        style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box;resize:vertical"></textarea>
    </div>

    <!-- Fluxo de status do processo -->
    <div style="margin-top:12px;background:var(--bg-tertiary);border-radius:8px;padding:10px 14px;border:1px solid var(--border-color)">
      <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">
        <i class="fas fa-project-diagram" style="margin-right:4px;color:#2563eb"></i>Rastreabilidade do Processo
      </div>
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:11px">
        ${rec.pedido_numero ? `
          <span style="padding:3px 8px;border-radius:8px;background:rgba(22,163,74,0.1);color:#16a34a;font-weight:700;border:1px solid rgba(22,163,74,0.2)">
            <i class="fas fa-shopping-bag" style="margin-right:3px"></i>${rec.pedido_numero}
          </span>
          <i class="fas fa-arrow-right" style="color:var(--text-muted);font-size:9px"></i>
        ` : ''}
        <span style="padding:3px 8px;border-radius:8px;background:rgba(202,138,4,0.1);color:#ca8a04;font-weight:700;border:1px solid rgba(202,138,4,0.2)">
          <i class="fas fa-dolly" style="margin-right:3px"></i>Recebimento Físico ✅
        </span>
        <i class="fas fa-arrow-right" style="color:var(--text-muted);font-size:9px"></i>
        <span style="padding:3px 8px;border-radius:8px;background:rgba(22,163,74,0.15);color:#16a34a;font-weight:700;border:1.5px solid #16a34a;animation:pulse 1s infinite">
          <i class="fas fa-warehouse" style="margin-right:3px"></i>Entrada Almoxarifado ← AGORA
        </span>
        <i class="fas fa-arrow-right" style="color:var(--text-muted);font-size:9px"></i>
        <span style="padding:3px 8px;border-radius:8px;background:rgba(99,102,241,0.1);color:#6366f1;font-weight:700;border:1px solid rgba(99,102,241,0.2)">
          <i class="fas fa-file-invoice-dollar" style="margin-right:3px"></i>CP Automático
        </span>
      </div>
    </div>

    <div style="margin-top:10px;padding:10px 14px;background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.2);border-radius:8px;font-size:12px;color:var(--text-secondary)">
      <i class="fas fa-magic" style="color:#22c55e;margin-right:4px"></i>
      <strong>Ao confirmar:</strong> entrada de estoque registrada, endereços atualizados, CP gerado automaticamente (se aplicável), rastreabilidade completa atualizada na Busca Global.
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-success" onclick="salvarEntradaAlmoxarifado('${recId}')">
      <i class="fas fa-warehouse"></i> Confirmar Entrada Almoxarifado
    </button>
  `);
}

async function salvarEntradaAlmoxarifado(recId) {
  const local       = document.getElementById('alm_local')?.value?.trim();
  const responsavel = document.getElementById('alm_responsavel')?.value?.trim();
  const dataStr     = document.getElementById('alm_data')?.value;
  const condicao    = document.getElementById('alm_condicao')?.value || 'Conforme';
  const obs         = document.getElementById('alm_obs')?.value?.trim() || '';

  if (!local)       { showToast('Informe o local de armazenagem.', 'warning'); return; }
  if (!responsavel) { showToast('Informe o responsável almoxarife.', 'warning'); return; }

  // Atualiza recebimento no localStorage
  const recs = _getRecebimentos();
  const idx  = recs.findIndex(r => (r.id || r.numero) === recId);
  if (idx < 0) { showToast('Recebimento não encontrado.', 'error'); return; }

  const rec = recs[idx];

  // Coleta itens com qtd e endereços
  const itensEntrada = [];
  let i = 0;
  while (true) {
    const qtdEl = document.getElementById(`alm_qtd_${i}`);
    if (!qtdEl) break;
    const endEl = document.getElementById(`alm_end_${i}`);
    const okEl  = document.getElementById(`alm_ok_${i}`);
    itensEntrada.push({
      idx: i,
      qtd_entrada:  parseFloat(qtdEl.value || 0),
      endereco:     endEl?.value?.trim() || '',
      confirmado:   okEl?.checked ?? true
    });
    i++;
  }

  // Atualiza dados do recebimento
  recs[idx] = {
    ...rec,
    etapa:        'Entrada Almoxarifado',
    etapa2_por:   responsavel,
    etapa2_em:    new Date().toISOString(),
    local_entrega: local,
    alm_condicao: condicao,
    alm_obs:      obs,
    alm_itens:    itensEntrada,
  };

  // Gera CP se não foi gerado ainda
  if (!rec.cp_gerado && rec.pedido_id) {
    const pedido = typeof FA_PEDIDOS !== 'undefined' ? FA_PEDIDOS.find(p => p.id === rec.pedido_id) : null;
    if (pedido) {
      _gerarContaPagar({ ...pedido, nf: rec.nf_numero }, pedido.cond_pagamento);
      recs[idx].cp_gerado = true;
    }
  }

  // Atualiza estoque (entrada de materiais)
  try {
    if (rec.pedido_id && typeof FA_PEDIDOS !== 'undefined') {
      const pedido = FA_PEDIDOS.find(p => p.id === rec.pedido_id);
      if (pedido) {
        const pedItens = typeof pedido.itens === 'string' ? JSON.parse(pedido.itens) : (pedido.itens || []);
        const mats = JSON.parse(localStorage.getItem('fa_materiais') || '[]');
        pedItens.forEach((it, i) => {
          const entItem = itensEntrada.find(e => e.idx === i);
          const qtdAdd  = entItem ? entItem.qtd_entrada : (it.qtd || it.quantidade || 1);
          const desc    = (it.desc || it.descricao || '').toLowerCase();
          const mat = mats.find(m =>
            (m.descricao || m.nome || '').toLowerCase().includes(desc.split(' ')[0]) ||
            desc.includes((m.descricao || m.nome || '').toLowerCase().split(' ')[0])
          );
          if (mat && qtdAdd > 0) {
            mat.estoque_atual = (parseFloat(mat.estoque_atual) || 0) + qtdAdd;
            if (entItem?.endereco) mat.localizacao = entItem.endereco;
          }
        });
        localStorage.setItem('fa_materiais', JSON.stringify(mats));
      }
    }
  } catch(e) { console.warn('[Almox] Erro ao atualizar estoque:', e); }

  _saveRecebimentos(recs);
  window._recebimentosData = recs;

  logAction('Entrada Almoxarifado', 'Recebimento', `${recId} – Etapa 2 confirmada por ${responsavel} – Local: ${local}`);
  closeModal();
  showToast(`✅ Entrada no Almoxarifado confirmada! Estoque atualizado.${recs[idx].cp_gerado ? ' CP gerado automaticamente.' : ''}`, 'success', 5000);
  renderRecebimento();
}

async function gerarCPRecebimento(recNumero) {
  const recs = _getRecebimentos();
  const rec  = recs.find(r => r.numero === recNumero || r.id === recNumero);
  if (!rec) {
    // Tenta buscar de _recebimentosData (memória da tabela)
    const fromData = (window._recebimentosData || []).find(r => (r.numero || r.id) === recNumero);
    if (!fromData) { showToast('Recebimento não encontrado.', 'warning'); return; }
    // Gera CP a partir dos dados disponíveis
    await _gerarCPDeRecebimento(fromData);
    return;
  }
  rec.cp_gerado = true;
  _saveRecebimentos(recs);
  await _gerarCPDeRecebimento(rec);
  showToast(`Conta a pagar gerada para NF ${rec.nf_numero}!`, 'success');
  renderRecebimento();
}

async function _gerarCPDeRecebimento(rec) {
  // Busca pedido vinculado
  const pedido = typeof FA_PEDIDOS !== 'undefined'
    ? FA_PEDIDOS.find(p => p.id === rec.pedido_id)
    : null;
  const condPag = pedido?.cond_pagamento || '30 dias';

  // Calcula vencimento
  const diasMap = { 'À entrega':0, '7 dias':7, '14 dias':14, '15 dias':15, '30 dias':30, '45 dias':45, '60 dias':60, '90 dias':90 };
  const dias = diasMap[condPag] ?? 30;
  const hoje = new Date();
  const venc = new Date(hoje.getTime() + dias * 86400000);

  const cpId = gerarId ? gerarId('CP') : ('CP-' + Date.now());
  const cp = {
    id:           cpId,
    numero:       cpId,
    descricao:    `${rec.pedido_numero} – NF ${rec.nf_numero}`,
    fornecedor_id:   rec.fornecedor_id || pedido?.fornecedor_id || '',
    fornecedor_nome: rec.fornecedor || pedido?.fornecedor_nome || '—',
    pedido_id:    rec.pedido_id || '',
    pedido_numero: rec.pedido_numero || '—',
    contrato_id:  pedido?.contrato_id || '',
    valor:        rec.valor_nf || 0,
    vencimento:   venc.toLocaleDateString('pt-BR'),
    vencimento_iso: venc.toISOString().split('T')[0],
    data_emissao: hoje.toLocaleDateString('pt-BR'),
    data_pagamento: '',
    status:       'Pendente',
    tipo:         'Fornecedor',
    nota_fiscal:  rec.nf_numero || '',
    conta_contabil: pedido?.conta_contabil || '2.1.1.01',
    centro_custo: pedido?.contrato_id || 'Geral',
    cond_pagamento: condPag,
    origem:       'Recebimento PC'
  };

  // Salva em localStorage
  try {
    const cps = JSON.parse(localStorage.getItem('fa_contas_pagar') || '[]');
    if (!cps.find(c => c.nota_fiscal === cp.nota_fiscal && c.pedido_id === cp.pedido_id)) {
      cps.unshift(cp);
      localStorage.setItem('fa_contas_pagar', JSON.stringify(cps));
    }
  } catch(e) {}

  // Atualiza array global
  if (typeof window.FA_CONTAS_PAGAR !== 'undefined' &&
      !window.FA_CONTAS_PAGAR.find(c => c.nota_fiscal === cp.nota_fiscal && c.pedido_id === cp.pedido_id)) {
    window.FA_CONTAS_PAGAR.unshift(cp);
  }

  // Persiste na API
  try {
    await fetch('/api/contas-pagar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cp)
    });
  } catch(e) {}
}

// ─── EXPORTAR RFQs ───
function exportRFQs() {
  const rfqs = _getRFQs();
  if (!rfqs.length) { showToast('Nenhum RFQ para exportar.', 'warning'); return; }
  const rows = [['Nº RFQ','Título','Contrato','Fornecedores','Valor Est.','Prazo Cotação','Status']];
  rfqs.forEach(r => rows.push([r.numero_rfq, r.titulo, r.contrato, (r.fornecedores_convidados||[]).length, r.valor_estimado, r.prazo_cotacao, r.status]));
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent('\uFEFF' + csv);
  a.download = 'RFQs_Fraser_' + new Date().toISOString().split('T')[0] + '.csv';
  a.click();
  showToast('RFQs exportados!', 'success');
}

// ─── NOVO PROCESSO RFQ AVULSO ───
function novoProcessoRFQ() {
  openModalWide('Novo Processo de Cotação (RFQ)', `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
      <div style="grid-column:1/-1">
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Título do Processo *</label>
        <input type="text" id="nrTitulo" placeholder="Ex: Aquisição de materiais de manutenção – Março 2025" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
      </div>
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Contrato de Origem</label>
        <select id="nrContrato" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
          <option value="">Geral (sem contrato)</option>
          ${ERP_DATA.contratos.filter(c=>c.status==='Ativo').map(c=>`<option value="${c.id}">${c.id} – ${c.cliente}</option>`).join('')}
        </select>
      </div>
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Valor Estimado (R$)</label>
        <input type="number" id="nrValor" placeholder="0" min="0" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
      </div>
    </div>
    <div style="margin-top:12px">
      <div style="font-size:12px;font-weight:600;color:var(--text-primary);margin-bottom:8px">Itens a Cotar</div>
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr style="background:var(--bg-tertiary)">
          <th style="padding:7px 10px">Descrição</th>
          <th style="padding:7px 10px;text-align:center">Qtd</th>
          <th style="padding:7px 10px;text-align:center">Un</th>
          <th style="padding:7px 10px;text-align:center">Ação</th>
        </tr></thead>
        <tbody id="nrItensBody">
          <tr id="nrItemRow0">
            <td style="padding:5px"><input type="text" placeholder="Descrição do item" style="width:100%;padding:6px 8px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:6px;color:var(--text-primary);font-size:12px;box-sizing:border-box" class="nr-desc"></td>
            <td style="padding:5px"><input type="number" placeholder="1" min="1" value="1" style="width:70px;padding:6px 8px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:6px;color:var(--text-primary);font-size:12px;text-align:center" class="nr-qtd"></td>
            <td style="padding:5px"><input type="text" placeholder="Un" value="Un" style="width:60px;padding:6px 8px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:6px;color:var(--text-primary);font-size:12px;text-align:center" class="nr-un"></td>
            <td style="padding:5px;text-align:center"><button onclick="this.closest('tr').remove()" class="btn btn-sm btn-danger"><i class="fas fa-trash"></i></button></td>
          </tr>
        </tbody>
      </table>
      <button onclick="addItemRFQ()" class="btn btn-secondary btn-sm" style="margin-top:8px"><i class="fas fa-plus"></i> Adicionar Item</button>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="salvarNovoRFQ()"><i class="fas fa-save"></i> Criar Processo</button>
  `);
}

function addItemRFQ() {
  const body = document.getElementById('nrItensBody');
  if (!body) return;
  const row = document.createElement('tr');
  row.innerHTML = `
    <td style="padding:5px"><input type="text" placeholder="Descrição do item" style="width:100%;padding:6px 8px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:6px;color:var(--text-primary);font-size:12px;box-sizing:border-box" class="nr-desc"></td>
    <td style="padding:5px"><input type="number" placeholder="1" min="1" value="1" style="width:70px;padding:6px 8px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:6px;color:var(--text-primary);font-size:12px;text-align:center" class="nr-qtd"></td>
    <td style="padding:5px"><input type="text" placeholder="Un" value="Un" style="width:60px;padding:6px 8px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:6px;color:var(--text-primary);font-size:12px;text-align:center" class="nr-un"></td>
    <td style="padding:5px;text-align:center"><button onclick="this.closest('tr').remove()" class="btn btn-sm btn-danger"><i class="fas fa-trash"></i></button></td>
  `;
  body.appendChild(row);
}

function salvarNovoRFQ() {
  const titulo = document.getElementById('nrTitulo')?.value?.trim();
  if (!titulo) { showToast('Informe o título do processo.', 'error'); return; }
  const valor = parseFloat(document.getElementById('nrValor')?.value || 0);
  const contrato = document.getElementById('nrContrato')?.value || '';
  const itens = [];
  document.querySelectorAll('#nrItensBody tr').forEach(row => {
    const desc = row.querySelector('.nr-desc')?.value?.trim();
    const qtd = parseFloat(row.querySelector('.nr-qtd')?.value || 1);
    const un = row.querySelector('.nr-un')?.value || 'Un';
    if (desc) itens.push({ descricao: desc, qtd, unidade: un });
  });

  const rfqNum = 'RFQ-' + new Date().getFullYear() + '-' + String(_getRFQs().length + 1).padStart(4,'0');
  const rfq = {
    id: gerarId('RFQ'),
    numero_rfq: rfqNum,
    requisicao_id: '',
    titulo,
    contrato,
    solicitante: currentUser?.name || '',
    valor_estimado: valor,
    itens,
    fornecedores_convidados: [],
    cotacoes: [],
    prazo_cotacao: '',
    status: 'Em Cotação',
    criado_em: new Date().toLocaleDateString('pt-BR'),
    criado_por: currentUser?.name || '',
    observacoes: ''
  };
  const rfqs = _getRFQs();
  rfqs.unshift(rfq);
  _saveRFQs(rfqs);
  logAction('Criar', 'RFQ', `Processo ${rfqNum} criado manualmente`);
  closeModal();
  showToast(`Processo ${rfqNum} criado! Selecione os fornecedores para cotar.`, 'success');
  renderRFQ();
  setTimeout(() => selecionarFornecedoresRFQ(rfq.id), 600);
}

// ─── EXPORTAR MATRIZ ───
function exportarMatriz(rfqId) {
  showToast('Gerando PDF da Matriz Comparativa... (requer servidor para download)', 'info');
}

// ─── MAPA COMPARATIVO (página standalone) ───
function renderMapaCotacao() {
  const matrizes = _getMatrizes();
  const isCompras = currentUser && ['admin','compras','diretor','financeiro'].includes(currentUser.profile);

  // KPIs do mapa — normaliza status legado 'Aprovado' → trata como 'Aprovada'
  const totalMapas     = matrizes.length;
  const aguardAprov    = matrizes.filter(m => m.status === 'Aguardando Aprovação').length;
  const aprovados      = matrizes.filter(m => m.status === 'Aprovada' || m.status === 'Aprovado').length;
  const valorTotalBRL  = matrizes
    .filter(m => m.status === 'Aprovada' || m.status === 'Aprovado')
    .reduce((s, m) => s + (m.valor_aprovado || m.valor_total_melhor || m.valor || 0), 0);

  document.getElementById('mainContent').innerHTML = `
    <div class="page-header">
      <div class="page-title">
        <h2><i class="fas fa-balance-scale" style="color:var(--fa-teal);margin-right:8px"></i>Mapa Comparativo de Propostas</h2>
        <p>Avaliação técnica e aprovação dos mapas comparativos de cotação</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary btn-sm" onclick="navigate('rfq')"><i class="fas fa-paper-plane"></i> Ir para Cotações</button>
        <button class="btn btn-secondary btn-sm" onclick="navigate('pedidos')" title="Emitir Pedido de Compra na aba Pedidos">
          <i class="fas fa-shopping-bag"></i> Ir para Pedidos de Compra
        </button>
      </div>
    </div>

    <!-- MELHORIA 3: Aviso — emissão de PC somente na aba Pedidos -->
    <div style="background:rgba(59,130,246,0.07);border:1px solid rgba(59,130,246,0.25);border-radius:10px;padding:11px 16px;margin-bottom:16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
      <i class="fas fa-info-circle" style="color:#3b82f6;font-size:15px;flex-shrink:0"></i>
      <span style="font-size:12px;color:var(--text-secondary);flex:1">
        <strong>Esta aba é exclusiva para análise e aprovação de mapas comparativos.</strong>
        Após aprovar um mapa, acesse
        <a href="#" onclick="navigate('pedidos')" style="color:#3b82f6;font-weight:700"><i class="fas fa-shopping-bag" style="margin:0 3px"></i>Pedidos de Compra</a>
        para emitir o Pedido de Compra.
      </span>
      <button onclick="navigate('pedidos')" style="padding:6px 14px;border:none;border-radius:7px;background:#3b82f6;color:#fff;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap">
        <i class="fas fa-arrow-right" style="margin-right:5px"></i>Ir para Pedidos
      </button>
    </div>

    <!-- KPI Cards -->
    <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px">
      <div class="kpi-card" style="border:1px solid var(--border-color);border-left:4px solid #6366f1">
        <div class="kpi-icon" style="color:#6366f1"><i class="fas fa-balance-scale"></i></div>
        <div class="kpi-value" style="color:#6366f1">${totalMapas}</div>
        <div class="kpi-label">Total de Mapas</div>
      </div>
      <div class="kpi-card" style="border:1px solid var(--border-color);border-left:4px solid #f59e0b">
        <div class="kpi-icon" style="color:#f59e0b"><i class="fas fa-clock"></i></div>
        <div class="kpi-value" style="color:#f59e0b">${aguardAprov}</div>
        <div class="kpi-label">Aguardando Aprovação</div>
      </div>
      <div class="kpi-card" style="border:1px solid var(--border-color);border-left:4px solid #22c55e">
        <div class="kpi-icon" style="color:#22c55e"><i class="fas fa-check-circle"></i></div>
        <div class="kpi-value" style="color:#22c55e">${aprovados}</div>
        <div class="kpi-label">Aprovados</div>
      </div>
      <div class="kpi-card" style="border:1px solid var(--border-color);border-left:4px solid var(--fa-teal)">
        <div class="kpi-icon" style="color:var(--fa-teal)"><i class="fas fa-dollar-sign"></i></div>
        <div class="kpi-value" style="color:var(--fa-teal);font-size:14px">${fmt(valorTotalBRL)}</div>
        <div class="kpi-label">Valor Total Aprovado</div>
      </div>
    </div>

    ${matrizes.length === 0 ? `
      <div style="background:var(--bg-card);border:2px dashed var(--border-color);border-radius:14px;padding:60px 24px;text-align:center;">
        <div style="width:72px;height:72px;border-radius:50%;background:rgba(99,102,241,0.08);border:2px solid rgba(99,102,241,0.2);display:flex;align-items:center;justify-content:center;margin:0 auto 16px;">
          <i class="fas fa-balance-scale" style="font-size:28px;color:rgba(99,102,241,0.5);"></i>
        </div>
        <div style="font-size:15px;font-weight:700;color:var(--text-primary);margin-bottom:6px;">Nenhum mapa comparativo registrado</div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:20px;">Os mapas são gerados automaticamente a partir das cotações no módulo RFQ.</div>
        <button class="btn btn-primary btn-sm" onclick="navigate('rfq')"><i class="fas fa-paper-plane"></i> Ir para Cotações (RFQ)</button>
      </div>
    ` : `
      <!-- Tabela de Mapas com bordas definidas -->
      <div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:14px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.06);">

        <!-- Barra de busca/filtro -->
        <div style="display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:2px solid var(--border-color);background:var(--bg-secondary);">
          <i class="fas fa-table" style="color:var(--fa-teal);font-size:14px;"></i>
          <span style="font-size:13px;font-weight:700;color:var(--text-primary);">Mapas Comparativos</span>
          <span style="background:rgba(99,102,241,0.1);color:#6366f1;border-radius:99px;padding:2px 10px;font-size:11px;font-weight:700;">${matrizes.length} mapa(s)</span>
        </div>

        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead>
              <tr style="background:var(--bg-tertiary);border-bottom:2px solid var(--border-color);">
                <th style="padding:11px 14px;text-align:left;color:var(--text-secondary);font-size:10.5px;font-weight:700;letter-spacing:.05em;border-right:1px solid var(--border-color);">ID MAPA</th>
                <th style="padding:11px 14px;text-align:left;color:var(--text-secondary);font-size:10.5px;font-weight:700;letter-spacing:.05em;border-right:1px solid var(--border-color);">PROCESSO RFQ / TÍTULO</th>
                <th style="padding:11px 14px;text-align:left;color:var(--text-secondary);font-size:10.5px;font-weight:700;letter-spacing:.05em;border-right:1px solid var(--border-color);">FORNECEDOR RECOMENDADO</th>
                <th style="padding:11px 14px;text-align:right;color:var(--text-secondary);font-size:10.5px;font-weight:700;letter-spacing:.05em;border-right:1px solid var(--border-color);">VALOR (BRL / USD)</th>
                <th style="padding:11px 14px;text-align:center;color:var(--text-secondary);font-size:10.5px;font-weight:700;letter-spacing:.05em;border-right:1px solid var(--border-color);">ALÇADA / APROVADOR</th>
                <th style="padding:11px 14px;text-align:center;color:var(--text-secondary);font-size:10.5px;font-weight:700;letter-spacing:.05em;border-right:1px solid var(--border-color);">CRITÉRIO</th>
                <th style="padding:11px 14px;text-align:center;color:var(--text-secondary);font-size:10.5px;font-weight:700;letter-spacing:.05em;border-right:1px solid var(--border-color);">STATUS</th>
                <th style="padding:11px 14px;text-align:center;color:var(--text-secondary);font-size:10.5px;font-weight:700;letter-spacing:.05em;">AÇÕES</th>
              </tr>
            </thead>
            <tbody>
              ${matrizes.map((m, idx) => {
                const cfg        = _getAlcadaConfig();
                const cotacao    = cfg.cotacao_api || cfg.cotacao_manual || 5.70;
                // Normaliza valor: suporta formato novo (valor_aprovado) e legado (valor_total_melhor, valor)
                const valorMap   = m.valor_aprovado || m.valor_total_melhor || m.valor || 0;
                const valUSD     = valorMap / cotacao;
                const limUSD     = cfg.limite_usd || 10000;
                const isGM       = valUSD > limUSD;
                const alcadaLabel  = isGM ? cfg.nome_gm  : cfg.nome_gerente;
                const alcadaColor  = isGM ? '#f59e0b'    : 'var(--fa-teal)';
                const alcadaBg     = isGM ? 'rgba(245,158,11,0.10)' : 'rgba(0,180,184,0.10)';
                const alcadaBorder = isGM ? '#fde68a' : 'rgba(0,180,184,0.35)';
                const alcadaIcon   = isGM ? 'fa-user-tie' : 'fa-user-check';
                const usdFmt     = new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(valUSD);
                const limFmt     = new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(limUSD);
                const aprovInfo  = m.aprovado_por
                  ? `<div style="font-size:9px;color:#22c55e;font-weight:700;margin-top:3px;"><i class="fas fa-check-circle" style="margin-right:3px;"></i>${m.aprovado_por}</div>`
                  : `<div style="font-size:9px;color:var(--text-muted);margin-top:2px;">Aguarda aprovação</div>`;
                // Indicador de urgência de aprovação
                const isUrgente = m.status === 'Aguardando Aprovação';
                const rowBg = isUrgente ? 'rgba(245,158,11,0.03)' : 'transparent';
                const rowBorderLeft = isUrgente ? '3px solid #f59e0b' : (m.status === 'Aprovada' || m.status === 'Aprovado') ? '3px solid #22c55e' : '3px solid transparent';
                return `
                <tr style="border-bottom:1px solid var(--border-color);border-left:${rowBorderLeft};background:${rowBg};"
                  onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='${rowBg}'">
                  <!-- ID Mapa -->
                  <td style="padding:12px 14px;border-right:1px solid var(--border-color);">
                    <div style="font-weight:700;color:var(--fa-teal);font-family:'Courier New',monospace;font-size:12px;">${m.id}</div>
                    <div style="font-size:10px;color:var(--text-muted);margin-top:2px;">${m.criado_em || '—'}</div>
                  </td>
                  <!-- Processo / Título -->
                  <td style="padding:12px 14px;border-right:1px solid var(--border-color);max-width:200px;">
                    <div style="font-weight:700;color:var(--text-primary);font-size:12px;">${m.numero_rfq || m.numero || m.rfq_id || '—'}</div>
                    <div style="font-size:11px;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:190px;" title="${m.titulo || m.descricao || ''}">${m.titulo || m.descricao || '—'}</div>
                  </td>
                  <!-- Fornecedor Recomendado -->
                  <td style="padding:12px 14px;border-right:1px solid var(--border-color);">
                    <div style="display:flex;align-items:center;gap:6px;">
                      <div style="width:28px;height:28px;border-radius:6px;background:rgba(0,180,184,0.1);border:1px solid rgba(0,180,184,0.2);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                        <i class="fas fa-building" style="font-size:11px;color:var(--fa-teal);"></i>
                      </div>
                      <div>
                        <div style="font-weight:600;color:var(--text-primary);font-size:12px;">${m.forn_recomendado_nome || (typeof m.forn_recomendado === 'string' ? _rfqNomeForn(m.forn_recomendado).substring(0,25) : (m.fornecedor_selecionado ? _rfqNomeForn(m.fornecedor_selecionado).substring(0,25) : '—'))}</div>
                        ${(m.forn_recomendado || m.fornecedor_selecionado) ? `<div style="font-size:10px;color:var(--text-muted);">${_idfBadgeHTML(_getIDFScoreForn(m.forn_recomendado || m.fornecedor_selecionado))}</div>` : ''}
                      </div>
                    </div>
                  </td>
                  <!-- Valor BRL/USD -->
                  <td style="padding:12px 14px;text-align:right;border-right:1px solid var(--border-color);">
                    <div style="font-weight:800;color:var(--fa-teal);font-size:14px;">${fmt(valorMap)}</div>
                    <div style="font-size:10px;color:var(--text-secondary);margin-top:2px;">${usdFmt}</div>
                    <div style="font-size:9px;color:var(--text-muted);">câmbio R$ ${cotacao.toFixed(2)}</div>
                  </td>
                  <!-- Alçada -->
                  <td style="padding:12px 14px;text-align:center;border-right:1px solid var(--border-color);">
                    <div style="display:inline-flex;flex-direction:column;align-items:center;gap:2px;background:${alcadaBg};border:1px solid ${alcadaBorder};border-radius:8px;padding:7px 12px;min-width:118px;">
                      <div style="font-size:10px;font-weight:800;color:${alcadaColor};"><i class="fas ${alcadaIcon}" style="margin-right:4px;"></i>${alcadaLabel}</div>
                      <div style="font-size:8px;color:var(--text-muted);">limite ${limFmt}</div>
                      ${aprovInfo}
                    </div>
                  </td>
                  <!-- Critério -->
                  <td style="padding:12px 14px;text-align:center;border-right:1px solid var(--border-color);">
                    <span style="background:rgba(99,102,241,0.1);color:#6366f1;border-radius:6px;padding:3px 9px;font-size:11px;font-weight:600;">${m.criterio || '—'}</span>
                  </td>
                  <!-- Status -->
                  <td style="padding:12px 14px;text-align:center;border-right:1px solid var(--border-color);">
                    ${_rfqStatusBadge(m.status)}
                  </td>
                  <!-- Ações -->
                  <td style="padding:12px 14px;text-align:center;">
                    <div style="display:flex;gap:5px;justify-content:center;flex-wrap:wrap;">
                      ${m.status === 'Aguardando Aprovação' && isCompras ? `
                        <button onclick="aprovarMatriz('${m.id}')" class="btn btn-sm btn-success" title="Aprovar mapa"
                          style="padding:5px 10px;font-size:11px;"><i class="fas fa-check" style="margin-right:4px;"></i>Aprovar</button>
                        <button onclick="rejeitarMatriz('${m.id}')" class="btn btn-sm btn-danger" title="Rejeitar mapa"
                          style="padding:5px 8px;font-size:11px;"><i class="fas fa-times"></i></button>
                      ` : ''}
                      <button onclick="verDetalheMatriz('${m.id}')" class="btn btn-sm btn-secondary" title="Ver análise completa"
                        style="padding:5px 10px;font-size:11px;"><i class="fas fa-chart-bar" style="margin-right:4px;"></i>Analisar</button>
                      <button onclick="gerarPDFMapa('${m.id}')" title="Gerar PDF" class="btn btn-sm"
                        style="padding:5px 8px;font-size:11px;background:rgba(220,38,38,0.1);color:#dc2626;border:1px solid rgba(220,38,38,0.3);border-radius:6px;">
                        <i class="fas fa-file-pdf"></i></button>
                      ${['Aguardando Aprovação','Aprovada','Aprovado'].includes(m.status) && isCompras ? `
                        <button onclick="revisarMapaAprovado('${m.rfq_id}','${m.id}')" title="Revisar mapa" class="btn btn-sm"
                          style="padding:5px 8px;font-size:11px;background:rgba(245,158,11,0.1);color:#f59e0b;border:1px solid rgba(245,158,11,0.3);border-radius:6px;">
                          <i class="fas fa-redo"></i></button>
                      ` : ''}
                    </div>
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>

        <!-- Rodapé com totais -->
        <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:var(--bg-secondary);border-top:2px solid var(--border-color);">
          <span style="font-size:12px;color:var(--text-muted);">${matrizes.length} mapa(s) no total</span>
          <div style="display:flex;gap:16px;font-size:12px;">
            <span style="color:#f59e0b;font-weight:600;"><i class="fas fa-clock" style="margin-right:4px;"></i>${aguardAprov} aguardando</span>
            <span style="color:#22c55e;font-weight:600;"><i class="fas fa-check-circle" style="margin-right:4px;"></i>${aprovados} aprovados</span>
            <span style="color:var(--fa-teal);font-weight:700;"><i class="fas fa-dollar-sign" style="margin-right:4px;"></i>${fmt(valorTotalBRL)} aprovado</span>
          </div>
        </div>
      </div>
    `}
  `;
}

async function aprovarMatriz(matrizId) {
  const matrizes = _getMatrizes();
  const m = matrizes.find(x => x.id === matrizId);
  if (!m) return;

  // ── Verificar alçada de aprovação ──
  const alcada = await _verificarAlcada(m.valor_aprovado || 0);
  const cfg    = _getAlcadaConfig();

  if (!alcada.podeAprovar) {
    const limFmt = new Intl.NumberFormat('en-US', { style:'currency', currency:'USD' }).format(alcada.limiteUSD);
    const valFmt = new Intl.NumberFormat('en-US', { style:'currency', currency:'USD' }).format(alcada.valorUSD);
    const msg = alcada.nivelNecessario === 'gm'
      ? `Valor ${valFmt} (câmbio R$ ${alcada.cotacao.toFixed(2)}/USD) excede o limite de ${limFmt}. Requer aprovação do <strong>${cfg.nome_gm}</strong>.`
      : `Este mapa requer aprovação do <strong>${cfg.nome_gerente}</strong>.`;
    openModal('🔒 Alçada Insuficiente',
      `<div style="padding:8px 0;font-size:13px;line-height:1.7;color:var(--text-secondary)">
        <div style="font-size:32px;text-align:center;margin-bottom:12px">🔒</div>
        <p>${msg}</p>
        <div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;padding:12px;margin-top:12px;font-size:12px">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="color:var(--text-muted)">Valor do mapa (BRL):</span><strong>${fmt(m.valor_aprovado)}</strong></div>
          <div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="color:var(--text-muted)">Cotação USD:</span><strong>R$ ${alcada.cotacao.toFixed(2)}</strong></div>
          <div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="color:var(--text-muted)">Valor em USD:</span><strong>${new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(alcada.valorUSD)}</strong></div>
          <div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">Limite da sua alçada:</span><strong>${new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(alcada.limiteUSD)}</strong></div>
        </div>
        <p style="margin-top:12px;font-size:11px;color:var(--text-muted)">Encaminhe para <strong>${alcada.labelNecessario}</strong> realizar a aprovação.</p>
      </div>`,
      `<button class="btn btn-secondary" onclick="closeModal()">Fechar</button>`
    );
    return;
  }

  m.status       = 'Aprovada';
  m.aprovado_em  = new Date().toLocaleDateString('pt-BR');
  m.aprovado_por = currentUser?.name || '';
  m.aprovado_perfil = currentUser?.profile || '';
  m.alcada_nivel = alcada.nivelNecessario;
  m.cotacao_usd  = alcada.cotacao;
  m.valor_usd    = alcada.valorUSD;
  _saveMatrizes(matrizes);

  // Atualiza RFQ
  const rfqs = _getRFQs();
  const rfq  = rfqs.find(r => r.id === m.rfq_id);
  if (rfq) { rfq.status = 'Aprovada'; _saveRFQs(rfqs); }

  logAction('Aprovar', 'Mapa Comparativo', `Mapa ${matrizId} aprovado por ${currentUser?.name} (${alcada.labelNecessario}) – USD ${alcada.valorUSD.toFixed(0)}`);
  const valUSDFmt = new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(alcada.valorUSD);

  // ── MELHORIA 3: Após aprovação, NÃO emitir PC automaticamente ─────────────
  // O Pedido de Compra só pode ser emitido na aba "Pedidos de Compra"
  // Aqui apenas informamos o aprovador e re-renderizamos o mapa
  closeModal();

  showToast(
    `✅ Mapa <strong>${matrizId}</strong> aprovado — ${valUSDFmt}! Para emitir o Pedido de Compra, acesse a aba <strong>Pedidos de Compra</strong>.`,
    'success', 7000
  );

  // Re-renderiza o mapa para refletir o novo status (sem navegar)
  setTimeout(() => {
    renderMapaCotacao();
  }, 500);
}

function rejeitarMatriz(matrizId) {
  const matrizes = _getMatrizes();
  const m = matrizes.find(x => x.id === matrizId);
  if (!m) return;
  m.status = 'Cancelada';
  _saveMatrizes(matrizes);
  showToast('Mapa rejeitado.', 'warning');
  renderMapaCotacao();
}

// ─── HELPER: busca último IDF score de um fornecedor (por nome ou id) ───────
function _getIDFScoreForn(fornKey) {
  try {
    const idfList = typeof window._getIDF === 'function' ? window._getIDF()
      : JSON.parse(localStorage.getItem('fa_idf_avaliacoes') || '[]');
    if (!idfList.length) return null;
    // Tenta combinar por nome exato
    const nomeForn = typeof fornKey === 'string' && fornKey.startsWith('FORN-')
      ? (() => { const f = (typeof FA_FORNECEDORES !== 'undefined' ? FA_FORNECEDORES : []).find(x => x.id === fornKey); return f ? (f.razao_social || f.nome || '') : ''; })()
      : (fornKey || '');
    if (!nomeForn) return null;
    const match = idfList.find(x =>
      (x.fornecedor && x.fornecedor.toLowerCase().includes(nomeForn.toLowerCase())) ||
      (nomeForn.toLowerCase().includes((x.fornecedor||'').toLowerCase().substring(0, 10)))
    );
    return match ? { score: match.score, classificacao: match.classificacao, data: match.data } : null;
  } catch(e) { return null; }
}

// ─── HELPER: badge IDF colorido ─────────────────────────────────────────────
function _idfBadgeHTML(idf) {
  if (!idf) return `<span style="font-size:10px;color:var(--text-muted);background:var(--bg-tertiary);border-radius:6px;padding:2px 7px;display:inline-block">Não avaliado</span>`;
  let color = '#dc2626', bg = 'rgba(220,38,38,0.1)';
  if (idf.score >= 80) { color = '#16a34a'; bg = 'rgba(22,163,74,0.1)'; }
  else if (idf.score >= 60) { color = '#2563eb'; bg = 'rgba(37,99,235,0.1)'; }
  else if (idf.score >= 40) { color = '#d97706'; bg = 'rgba(217,119,6,0.1)'; }
  return `<span style="font-size:10px;font-weight:700;color:${color};background:${bg};border-radius:6px;padding:3px 8px;display:inline-block" title="${idf.classificacao} – ${idf.data}">IDF ${idf.score.toFixed(0)} · ${idf.classificacao}</span>`;
}

function verDetalheMatriz(matrizId) {
  try {
  // ── Busca o mapa em todas as fontes disponíveis ───────────────────────────
  let m = _getMatrizes().find(x => x.id === matrizId);

  // Fallback: busca também em fa_rfq_flow e fa_rfqs (o mapa pode estar embutido no RFQ)
  if (!m) {
    try {
      const rfqFlow = JSON.parse(localStorage.getItem('fa_rfq_flow') || '[]');
      const rfqAll  = JSON.parse(localStorage.getItem('fa_rfqs') || '[]');
      // Tenta achar em todos os arrays de matrizes que possam existir
      const allArrays = [
        JSON.parse(localStorage.getItem('fa_mapas_comparativos') || '[]'),
        JSON.parse(localStorage.getItem('fa_mapas_comp') || '[]'),
        JSON.parse(localStorage.getItem('fa_matrizes') || '[]')
      ];
      for (const arr of allArrays) {
        const found = arr.find(x => x.id === matrizId);
        if (found) { m = found; break; }
      }
    } catch(eFb) {}
  }

  if (!m) {
    openModal('⚠️ Mapa Não Encontrado', `
      <div style="text-align:center;padding:24px 0">
        <div style="font-size:48px;margin-bottom:12px">🔍</div>
        <div style="font-size:15px;font-weight:700;color:var(--text-primary);margin-bottom:6px">
          Mapa <code style="background:var(--bg-tertiary);padding:2px 6px;border-radius:4px">${matrizId}</code> não encontrado
        </div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:20px;max-width:380px;margin-left:auto;margin-right:auto">
          Este mapa pode ter sido criado em uma sessão anterior e não está disponível no armazenamento local atual.
          Isso pode ocorrer se o cache do navegador foi limpo ou se a sessão foi reiniciada.
        </div>
        <div style="background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.25);border-radius:8px;padding:12px;text-align:left;font-size:11px;color:var(--text-secondary);margin-bottom:16px">
          <strong>Sugestão:</strong> Acesse a aba RFQ, localize o processo correspondente, registre as cotações e gere um novo mapa comparativo.
        </div>
        <button class="btn btn-secondary" onclick="closeModal();navigate('rfq')">
          <i class="fas fa-paper-plane"></i> Ir para RFQ
        </button>
      </div>
    `, `<button class="btn btn-secondary" onclick="closeModal()">Fechar</button>`);
    return;
  }

  // ── Normaliza cotações — suporta TRÊS formatos ─────────────────────────────
  // Formato A (novo):   m.cotacoes[] com forn_idx, total_negociado, itens[], etc.
  // Formato B (legado): m.cotacoes_comparadas[] com fornecedor, valor, prazo, recomendado
  // Formato C (seed006): m.fornecedores[] + m.itens[].valores[] (mapas CONT-006)
  let cotacoes = m.cotacoes || [];

  // Formato B: cotacoes_comparadas
  if (!cotacoes.length && (m.cotacoes_comparadas || []).length) {
    cotacoes = (m.cotacoes_comparadas || []).map((c, i) => ({
      forn_idx:        i,
      fornecedor:      c.fornecedor_id || c.fornecedor || '',
      total:           c.valor || c.valor_total || 0,
      total_negociado: c.valor || c.valor_total || null,
      prazo_entrega:   c.prazo || 15,
      cond_pagamento:  '30 dias',
      frete:           'CIF',
      desconto_pct:    0,
      declinou:        false,
      itens:           m.itens || []
    }));
    if (m.forn_recomendado_idx == null) {
      const recIdx = (m.cotacoes_comparadas || []).findIndex(c => c.recomendado);
      m.forn_recomendado_idx = recIdx >= 0 ? recIdx : 0;
    }
  }

  // Formato C: fornecedores[] + itens[].valores[] (mapas CONT-006 / seed legada)
  if (!cotacoes.length && (m.fornecedores || []).length) {
    const forns = (m.fornecedores || []).filter(Boolean); // remove nulls/undefined
    cotacoes = forns.map((fornStr, fi) => {
      if (!fornStr) return null; // skip inválido
      // fornStr pode ser "NomeFornecedor FOR-XXX" ou apenas o nome
      const fornStr2 = String(fornStr);
      const fornIdMatch = fornStr2.match(/FOR-\w+/);
      const fornId = fornIdMatch ? fornIdMatch[0] : fornStr2;
      const fornSuffix = fornId.replace('FOR-', ''); // ex: '022'
      // Calcula total deste fornecedor somando os itens
      const itensForn = (m.itens || []).map(item => {
        // Busca por sufixo do ID OU por nome parcial do fornecedor
        const vEntry = (item.valores || []).find(v =>
          v.f && (v.f.includes(fornSuffix) || v.f.toLowerCase().includes(fornStr2.split(' ')[0].toLowerCase()))
        );
        const preco  = vEntry ? (vEntry.v || 0) : 0;
        const qty    = parseFloat(item.qtd) || 1;
        return { descricao: item.descricao || '', unidade: item.unidade || 'un', qtd: item.qtd || 1, preco, total: preco * qty };
      });
      const total = itensForn.reduce((s, it) => s + (it.total || 0), 0);
      const isMelhor = (m.itens || []).every(item => {
        const vEntry = (item.valores || []).find(v =>
          v.f && (v.f.includes(fornSuffix) || v.f.toLowerCase().includes(fornStr2.split(' ')[0].toLowerCase()))
        );
        if (!vEntry) return false;
        return (item.valores || []).every(v => !v.v || v.v >= vEntry.v);
      });
      return {
        forn_idx:        fi,
        fornecedor:      fornId,
        total:           total,
        total_negociado: total,
        prazo_entrega:   null,
        cond_pagamento:  '',
        frete:           'CIF',
        desconto_pct:    0,
        declinou:        false,
        itens:           itensForn
      };
    }).filter(Boolean); // remove entradas nulas
    // Recomendado: fornecedor que tem todos os melhores valores (melhor em todos itens)
    if (m.forn_recomendado_idx == null) {
      const recFornStr = (m.itens && m.itens[0] && m.itens[0].melhor) || forns[0] || '';
      // Usa split seguro — recFornStr pode ser undefined se itens estiver vazio
      const recPart = recFornStr ? String(recFornStr).split(' ')[0] : '';
      const recIdx = recPart
        ? forns.findIndex(f => f && (f.includes(recPart) || recFornStr.includes(String(f).split(' ')[0])))
        : 0;
      m.forn_recomendado_idx = recIdx >= 0 ? recIdx : 0;
    }
    // Preenche valor_aprovado se ausente
    if (!m.valor_aprovado && m.valor_total_melhor) m.valor_aprovado = m.valor_total_melhor;
  }

  // ── Busca RFQ em todas as fontes ────────────────────────────────────────
  let rfq = _getRFQs().find(r => r.id === m.rfq_id) || {};
  if (!rfq.id) {
    try {
      const flow = JSON.parse(localStorage.getItem('fa_rfq_flow') || '[]');
      rfq = flow.find(r => r.id === m.rfq_id) || {};
    } catch(e) {}
  }

  const isCompras  = currentUser && ['admin','compras','diretor'].includes(currentUser.profile);
  const cotAtivasM = cotacoes.filter(c => !c.declinou);
  const totaisComp = cotAtivasM.map(c => c.total_negociado != null ? c.total_negociado : c.total);
  const menorTotal = totaisComp.filter(t=>t>0).length ? Math.min(...totaisComp.filter(t=>t>0)) : 0;

  // OS vinculada
  let osInfo = null;
  if (rfq.os_id) {
    try {
      const osList = JSON.parse(localStorage.getItem('fa_os_list') || '[]');
      osInfo = osList.find(o => o.id === rfq.os_id || o.numero === rfq.os_id);
    } catch(e) {}
  }

  // Histórico do processo (RC → RFQ)
  let rcInfo = null;
  if (rfq.rc_id || rfq.rc_numero) {
    try {
      const rcs = JSON.parse(localStorage.getItem('fa_rcs') || '[]');
      rcInfo = rcs.find(r => r.id === rfq.rc_id || r.numero === rfq.rc_numero);
    } catch(e) {}
  }

  // Critérios labels
  const criteriosLabels = {
    preco:'Menor Preço', prazo:'Prazo de Entrega', pagamento:'Cond. Pagamento',
    frete:'Frete / Logística', historico:'Histórico do Forn.', tecnico:'Critério Técnico',
    total_negociado:'Total Negociado'
  };
  const criteriosExib = (m.criterios_avaliacao || rfq.criterios_avaliacao || []).map(c => criteriosLabels[c] || c);

  // Amplia o modal para análise completa — modo paisagem
  const mc = document.getElementById('modalContainer');
  if (mc) {
    mc.style.maxWidth = '98vw';
    mc.style.width    = '98vw';
    mc.style.maxHeight = '92vh';
    mc.style.display  = 'flex';
    mc.style.flexDirection = 'column';
  }
  // Garante scroll interno no body do modal
  const mb = document.getElementById('modalBody');
  if (mb) { mb.style.overflowY = 'auto'; mb.style.flex = '1'; }

  // ── Gera análise AI de todos os fornecedores (passa cotacoes normalizadas) ──
  const aiAnalise = _gerarAnaliseCompletaFornecedores({ ...m, cotacoes }, rfq, menorTotal);

  // ── Alçada: calcula sincrono com cache (exibe logo; atualiza via API após render) ──
  const cfgAlcada   = _getAlcadaConfig();
  const cotacaoSync = cfgAlcada.cotacao_api || cfgAlcada.cotacao_manual || 5.70;
  const valUSDSync  = (m.valor_aprovado || 0) / cotacaoSync;
  const isGMSync    = valUSDSync > (cfgAlcada.limite_usd || 10000);
  const alcadaNome  = isGMSync ? cfgAlcada.nome_gm : cfgAlcada.nome_gerente;
  const alcadaCor   = isGMSync ? '#f59e0b' : 'var(--fa-teal)';
  const alcadaBgC   = isGMSync ? 'rgba(245,158,11,0.13)' : 'rgba(0,180,184,0.13)';
  const alcadaBdr   = isGMSync ? 'rgba(245,158,11,0.40)' : 'rgba(0,180,184,0.40)';
  const alcadaIcone = isGMSync ? 'fa-user-tie' : 'fa-user-check';
  const usdSyncFmt  = new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(valUSDSync);
  const limUSDFmt   = new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(cfgAlcada.limite_usd||10000);
  const valorBRL    = m.valor_aprovado || 0;

  openModal('📊 Análise Completa – Mapa ' + m.id + ' · ' + (m.numero_rfq || m.numero || m.rfq_id || ''), `
    <!-- CABEÇALHO GERAL -->
    <div style="display:grid;grid-template-columns:1fr auto;gap:16px;align-items:flex-start;margin-bottom:18px;padding-bottom:14px;border-bottom:2px solid var(--border-color)">
      <div>
        <div style="font-size:18px;font-weight:800;color:var(--text-primary);margin-bottom:4px">${m.titulo || m.descricao || rfq.titulo || '(sem título)'}</div>
        <div style="font-size:12px;color:var(--text-muted);display:flex;flex-wrap:wrap;gap:12px">
          <span><i class="fas fa-hashtag" style="margin-right:4px"></i>${m.numero_rfq || m.numero || m.rfq_id || '—'}</span>
          <span><i class="fas fa-calendar" style="margin-right:4px"></i>Criado em ${m.criado_em || m.data || m.data_criacao || '—'} por ${m.criado_por || m.responsavel || '—'}</span>
          ${(rfq.contrato || m.contrato || m.contrato_id) ? `<span><i class="fas fa-file-contract" style="margin-right:4px"></i>${rfq.contrato || m.contrato || m.contrato_id}</span>` : ''}
          ${(rfq.solicitante || m.responsavel) ? `<span><i class="fas fa-user" style="margin-right:4px"></i>${rfq.solicitante || m.responsavel}</span>` : ''}
        </div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
        ${_rfqStatusBadge(m.status)}
        <div style="font-size:11px;color:var(--text-muted)">Criado: ${m.criado_em||'—'}</div>
        <!-- Badge de alçada (id para atualização async) -->
        <div id="alcada-badge-modal" style="background:${alcadaBgC};border:1px solid ${alcadaBdr};border-radius:8px;padding:6px 12px;text-align:center;min-width:168px">
          <div style="font-size:9px;color:var(--text-muted);text-transform:uppercase;font-weight:700;margin-bottom:2px">Alçada de Aprovação</div>
          <div id="alcada-badge-nome" style="font-size:12px;font-weight:800;color:${alcadaCor}"><i class="fas ${alcadaIcone}" style="margin-right:5px"></i>${alcadaNome}</div>
          <div id="alcada-badge-valor" style="font-size:10px;color:var(--text-muted);margin-top:2px">${usdSyncFmt} · limite ${limUSDFmt}</div>
          <div id="alcada-badge-cambio" style="font-size:9px;color:var(--text-muted)">USD/BRL: R$ ${cotacaoSync.toFixed(2)}</div>
          ${m.aprovado_por ? `<div style="font-size:10px;color:#22c55e;margin-top:3px;font-weight:700"><i class="fas fa-check-circle"></i> Aprovado por ${m.aprovado_por}</div>` : ''}
        </div>
      </div>
    </div>

    <!-- GRADE INFO: OS / Projeto / Linha de Custos / Critérios -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin-bottom:18px">

      <!-- OS e Projeto -->
      <div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:10px;padding:12px">
        <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:6px"><i class="fas fa-project-diagram" style="margin-right:4px"></i>Projeto / OS</div>
        ${osInfo ? `
          <div style="font-size:12px;font-weight:700;color:var(--fa-teal)">${osInfo.numero || osInfo.id}</div>
          <div style="font-size:11px;color:var(--text-secondary)">${osInfo.descricao || osInfo.titulo || '—'}</div>
          ${osInfo.contrato ? `<div style="font-size:10px;color:var(--text-muted)">Contrato: ${osInfo.contrato}</div>` : ''}
        ` : rfq.os_id ? `
          <div style="font-size:12px;font-weight:700;color:var(--fa-teal)">${rfq.os_id}</div>
          <div style="font-size:11px;color:var(--text-muted)">Dados completos no módulo OS</div>
        ` : `<div style="font-size:11px;color:var(--text-muted)">Sem OS vinculada</div>`}
      </div>

      <!-- RC de Origem -->
      <div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:10px;padding:12px">
        <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:6px"><i class="fas fa-file-alt" style="margin-right:4px"></i>Requisição de Origem</div>
        ${rcInfo ? `
          <div style="font-size:12px;font-weight:700;color:var(--fa-teal)">${rcInfo.numero || rfq.rc_numero || '—'}</div>
          <div style="font-size:11px;color:var(--text-secondary)">${(rcInfo.titulo || rcInfo.descricao || '').substring(0,60)}</div>
          <div style="font-size:10px;color:var(--text-muted)">Solicitante: ${rcInfo.solicitante || '—'}</div>
        ` : rfq.rc_numero ? `
          <div style="font-size:12px;font-weight:700;color:var(--fa-teal)">${rfq.rc_numero}</div>
          <div style="font-size:11px;color:var(--text-muted)">Processo RFQ: ${rfq.numero_rfq}</div>
        ` : `<div style="font-size:11px;color:var(--text-muted)">Sem RC vinculada</div>`}
      </div>

      <!-- Linha de Custos -->
      <div style="background:linear-gradient(135deg,rgba(99,102,241,0.08),rgba(139,92,246,0.08));border:1px dashed rgba(139,92,246,0.3);border-radius:10px;padding:12px">
        <div style="font-size:10px;font-weight:700;color:#8b5cf6;text-transform:uppercase;margin-bottom:6px"><i class="fas fa-sitemap" style="margin-right:4px"></i>Linha de Custos</div>
        <div style="font-size:11px;color:var(--text-muted);font-style:italic">
          <i class="fas fa-tools" style="margin-right:4px;color:#8b5cf6"></i>
          Módulo em desenvolvimento.<br>
          <span style="font-size:10px">A alocação de custos por centro de custo / WBS será configurada nesta seção.</span>
        </div>
        <div style="margin-top:6px;font-size:11px;font-weight:600;color:var(--fa-teal)">Valor total: ${fmt(m.valor_aprovado)}</div>
      </div>

      <!-- Critérios de Avaliação -->
      <div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:10px;padding:12px">
        <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:6px"><i class="fas fa-list-check" style="margin-right:4px"></i>Critérios de Avaliação</div>
        ${criteriosExib.length ? `
          <div style="display:flex;flex-wrap:wrap;gap:4px">
            ${criteriosExib.map(c => `<span style="background:rgba(0,180,184,0.1);color:var(--fa-teal);border-radius:6px;padding:2px 7px;font-size:10px;font-weight:600">${c}</span>`).join('')}
          </div>
        ` : `<div style="font-size:11px;color:var(--text-muted)">Critério: ${m.criterio}</div>`}
        ${rfq.criterios_obs ? `<div style="font-size:10px;color:var(--text-secondary);margin-top:6px;font-style:italic">"${rfq.criterios_obs}"</div>` : ''}
      </div>
    </div>

    <!-- MATRIZ COMPARATIVA ITEM A ITEM estilo Aethra -->
    <div style="margin-bottom:18px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;padding:10px 14px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:10px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <i class="fas fa-table" style="color:var(--fa-teal);font-size:14px;"></i>
          <span style="font-size:12px;font-weight:700;color:var(--text-primary);text-transform:uppercase;">Matriz Comparativa — Item a Item</span>
          <span style="background:rgba(0,180,184,0.1);color:var(--fa-teal);border-radius:99px;padding:2px 9px;font-size:11px;font-weight:700;">${cotAtivasM.length} cotações ativas</span>
        </div>
        <div style="font-size:11px;color:var(--text-muted);">
          <i class="fas fa-star" style="color:#5eead4;margin-right:4px;"></i>★ = Fornecedor recomendado
        </div>
      </div>
      <div style="overflow-x:auto;border-radius:10px;border:2px solid var(--border-color);box-shadow:0 2px 8px rgba(0,0,0,.07)">
        <table style="width:100%;border-collapse:collapse;font-size:11px;min-width:700px">
          <thead>
            <!-- ── Linha A: nomes dos fornecedores — cabeçalho azul, células brancas ── -->
            <tr>
              <td colspan="3" style="padding:9px 12px;background:#0B4F6C;color:#fff;font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;border:1px solid #09405a">
                <i class="fas fa-list-ul" style="margin-right:6px;opacity:0.8"></i>ITENS / FORNECEDORES
              </td>
              ${cotacoes.map((c, i) => {
                const nomeForn = _rfqNomeForn(c.fornecedor);
                const isRec   = i === m.forn_recomendado_idx;
                const idf     = _getIDFScoreForn(c.fornecedor);
                let idfColor = '#6b7280', idfLabel = 'Não avaliado';
                if (idf) {
                  idfLabel = 'IDF ' + idf.score.toFixed(0) + ' · ' + idf.classificacao.split(' ')[0];
                  if      (idf.score >= 80) idfColor = '#16a34a';
                  else if (idf.score >= 60) idfColor = '#2563eb';
                  else if (idf.score >= 40) idfColor = '#d97706';
                  else                      idfColor = '#dc2626';
                }
                return '<td colspan="2" style="padding:9px 10px;text-align:center;border:1px solid #09405a;background:#0B4F6C;vertical-align:middle">'
                  + '<div style="font-weight:700;color:#fff;font-size:11px;white-space:nowrap;margin-bottom:4px">'
                  + (isRec && !c.declinou ? '<span style="color:#5eead4;margin-right:3px">★</span>' : '')
                  + (c.declinou ? '<span style="color:#fca5a5;margin-right:3px">🚫</span>' : '')
                  + (nomeForn.length > 18 ? nomeForn.substring(0,18)+'…' : nomeForn)
                  + '</div>'
                  + '<div style="font-size:9px;font-weight:600;color:' + (idf ? (idf.score>=80?'#86efac':idf.score>=60?'#93c5fd':idf.score>=40?'#fde68a':'#fca5a5') : '#94a3b8') + '">'
                  + idfLabel + '</div>'
                  + (c.declinou ? '<div style="font-size:9px;color:#fca5a5;font-weight:700;margin-top:2px">DECLINOU</div>' : '')
                  + '</td>';
              }).join('')}
              <td colspan="2" style="padding:9px 10px;text-align:center;border:1px solid #09405a;background:#0B4F6C;color:#fff;font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;vertical-align:middle">
                MELHOR<br>COTAÇÃO
              </td>
            </tr>
            <!-- ── Linha B: sub-colunas Unit./Total — fundo azul mais claro ── -->
            <tr>
              <td style="padding:6px 10px;border:1px solid var(--border-color);background:#e8f0f5;font-size:9px;font-weight:700;color:#0B4F6C;text-transform:uppercase;width:28px;text-align:center">Nº</td>
              <td style="padding:6px 10px;border:1px solid var(--border-color);background:#e8f0f5;font-size:9px;font-weight:700;color:#0B4F6C;text-transform:uppercase">DESCRIÇÃO / MATERIAL</td>
              <td style="padding:6px 10px;border:1px solid var(--border-color);background:#e8f0f5;font-size:9px;font-weight:700;color:#0B4F6C;text-transform:uppercase;text-align:center">Qtd.</td>
              ${cotacoes.map(() => `
                <td style="padding:6px 8px;text-align:right;border:1px solid var(--border-color);background:#e8f0f5;font-size:9px;font-weight:700;color:#0B4F6C;text-transform:uppercase">Unit.</td>
                <td style="padding:6px 8px;text-align:right;border:1px solid var(--border-color);background:#e8f0f5;font-size:9px;font-weight:700;color:#0B4F6C;text-transform:uppercase">Total</td>
              `).join('')}
              <td style="padding:6px 8px;text-align:center;border:1px solid var(--border-color);background:#e8f0f5;font-size:9px;font-weight:700;color:#0B4F6C;text-transform:uppercase">Fornec.</td>
              <td style="padding:6px 8px;text-align:right;border:1px solid var(--border-color);background:#e8f0f5;font-size:9px;font-weight:700;color:#0B4F6C;text-transform:uppercase">Menor Valor</td>
            </tr>
            <!-- ── Linhas C: condições — fundo branco, label em azul ── -->
            ${[
              ['Cotação Nº',    (c,ci) => c.declinou ? '—' : 'Q' + String(ci+1).padStart(4,'0')],
              ['Cond. Pagto',   (c)    => c.declinou ? '—' : (c.cond_pagamento || '—')],
              ['Frete',         (c)    => c.declinou ? '—' : (c.frete||'—') + (c.valor_frete>0?' '+fmt(c.valor_frete):'')],
              ['Prazo Entrega', (c)    => c.declinou ? '—' : (c.prazo_entrega ? c.prazo_entrega+' dias' : '—')]
            ].map(([lbl, fn]) => `
              <tr>
                <td colspan="3" style="padding:5px 10px;font-size:10px;font-weight:600;color:#0B4F6C;border:1px solid var(--border-color)">${lbl}</td>
                ${cotacoes.map((c,ci) => '<td colspan="2" style="padding:5px 10px;text-align:center;border:1px solid var(--border-color);font-size:10px;color:var(--text-secondary)">'+fn(c,ci)+'</td>').join('')}
                <td colspan="2" style="border:1px solid var(--border-color)"></td>
              </tr>
            `).join('')}
          </thead>
          <tbody>
            ${(() => {
              const itens = rfq.itens || m.itens || [];
              if (!itens.length) {
                // Sem itens individuais: mostra linha total por fornecedor
                return `<tr><td colspan="${3 + cotacoes.length * 2 + 2}" style="padding:14px;text-align:center;border:1px solid var(--border-color);color:var(--text-muted);font-style:italic;font-size:11px">Itens detalhados não disponíveis. Veja os totais abaixo.</td></tr>`;
              }
              return itens.map((item, idx) => {
                // Calcula melhor preço unitário entre fornecedores ativos neste item
                let melhorPrcItem = Infinity, melhorFornIdxItem = -1;
                cotacoes.forEach((c, ci) => {
                  if (c.declinou) return;
                  const pu = parseFloat(c.itens?.[idx]?.preco) || 0;
                  if (pu > 0 && pu < melhorPrcItem) { melhorPrcItem = pu; melhorFornIdxItem = ci; }
                });
                const melhorNomeItem = melhorFornIdxItem >= 0 ? _rfqNomeForn(cotacoes[melhorFornIdxItem].fornecedor) : '—';
                const melhorTotalValItem = melhorFornIdxItem >= 0
                  ? (parseFloat(cotacoes[melhorFornIdxItem].itens?.[idx]?.total) || (melhorPrcItem * parseFloat(item.qtd || 1)))
                  : 0;
                const rowBg = idx % 2 === 0 ? 'var(--bg-secondary)' : 'transparent';
                return `
                  <tr style="background:${rowBg}">
                    <td style="padding:8px 10px;text-align:center;border:1px solid var(--border-color);color:var(--text-muted);font-size:10px;font-weight:700">${idx+1}</td>
                    <td style="padding:8px 10px;border:1px solid var(--border-color)">
                      <div style="font-weight:600;color:var(--text-primary);font-size:11px;line-height:1.4">${item.descricao}</div>
                      ${item.referencia ? '<div style="font-size:9px;color:var(--text-muted);margin-top:1px">Ref: '+item.referencia+'</div>' : ''}
                    </td>
                    <td style="padding:8px 10px;text-align:center;border:1px solid var(--border-color);font-size:11px;font-weight:600;color:var(--text-secondary);white-space:nowrap">
                      ${item.qtd} <span style="font-size:9px;color:var(--text-muted)">${item.unidade||'un'}</span>
                    </td>
                    ${cotacoes.map((c, ci) => {
                      if (c.declinou) return '<td colspan="2" style="padding:8px 10px;text-align:center;border:1px solid var(--border-color);background:rgba(239,68,68,0.04)">'
                        + '<span style="font-size:9px;color:#ef4444;font-style:italic;font-weight:600">Declinou</span></td>';
                      const pu = parseFloat(c.itens?.[idx]?.preco) || 0;
                      const tot = parseFloat(c.itens?.[idx]?.total) || (pu * parseFloat(item.qtd || 1));
                      const isBest = ci === melhorFornIdxItem && pu > 0;
                      const isRecC = ci === m.forn_recomendado_idx;
                      const unitColor = isBest ? '#16a34a' : 'var(--text-secondary)';
                      const totColor  = isBest ? '#16a34a' : (isRecC ? 'var(--fa-teal)' : 'var(--text-primary)');
                      const cellBg    = isBest ? 'rgba(22,163,74,0.05)' : '';
                      return '<td style="padding:8px 8px;text-align:right;border:1px solid var(--border-color);font-size:10px;color:'+unitColor+';background:'+cellBg+';font-weight:'+(isBest?'700':'400')+'">'
                        + (pu ? fmt(pu) : '<span style="color:var(--text-muted)">—</span>')
                        + '</td>'
                        + '<td style="padding:8px 8px;text-align:right;border:1px solid var(--border-color);font-size:11px;font-weight:'+(isBest?'800':'600')+';color:'+totColor+';background:'+cellBg+'">'
                        + (tot ? fmt(tot) : '<span style="color:var(--text-muted)">—</span>')
                        + '</td>';
                    }).join('')}
                    <td style="padding:8px 10px;text-align:center;border:1px solid var(--border-color);background:#eef7fb;font-size:9px;font-weight:700;color:#1e3a5f;white-space:nowrap">
                      ${melhorNomeItem.length > 12 ? melhorNomeItem.substring(0,12)+'…' : melhorNomeItem}
                    </td>
                    <td style="padding:8px 10px;text-align:right;border:1px solid var(--border-color);background:#eef7fb;font-weight:800;color:#16a34a;font-size:12px">
                      ${melhorTotalValItem ? fmt(melhorTotalValItem) : '—'}
                    </td>
                  </tr>`;
              }).join('');
            })()}

            <!-- SUBTOTAL BRUTO -->
            <tr style="background:var(--bg-tertiary)">
              <td colspan="3" style="padding:8px 12px;font-weight:700;font-size:11px;border:1px solid var(--border-color);text-transform:uppercase;color:var(--text-primary)">Subtotal (Bruto)</td>
              ${cotacoes.map(c => {
                if (c.declinou) return '<td colspan="2" style="padding:8px 10px;text-align:center;border:1px solid var(--border-color);color:#ef4444;font-size:10px;font-weight:600;opacity:0.6">Declinou</td>';
                return '<td style="border:1px solid var(--border-color)"></td>'
                  + '<td style="padding:8px 10px;text-align:right;border:1px solid var(--border-color);font-weight:700;font-size:12px;color:var(--text-primary)">' + fmt(c.subtotal||c.total||0) + '</td>';
              }).join('')}
              <td colspan="2" style="border:1px solid var(--border-color);background:#eef7fb"></td>
            </tr>

            ${cotacoes.some(c=>!c.declinou && c.valor_frete>0) ? `
            <tr>
              <td colspan="3" style="padding:6px 12px;font-size:11px;font-weight:600;color:#b45309;border:1px solid var(--border-color)">(+) Frete</td>
              ${cotacoes.map(c => {
                if (c.declinou) return '<td colspan="2" style="border:1px solid var(--border-color);opacity:0.4"></td>';
                return '<td style="border:1px solid var(--border-color)"></td>'
                  + '<td style="padding:6px 10px;text-align:right;border:1px solid var(--border-color);color:#b45309;font-weight:600">' + (c.valor_frete>0 ? '+'+fmt(c.valor_frete) : '—') + '</td>';
              }).join('')}
              <td colspan="2" style="border:1px solid var(--border-color);background:#eef7fb"></td>
            </tr>` : ''}

            ${cotacoes.some(c=>!c.declinou && c.desconto_pct>0) ? `
            <tr>
              <td colspan="3" style="padding:6px 12px;font-size:11px;font-weight:600;color:#16a34a;border:1px solid var(--border-color)">(-) Desconto Negociado</td>
              ${cotacoes.map(c => {
                if (c.declinou) return '<td colspan="2" style="border:1px solid var(--border-color);opacity:0.4"></td>';
                return '<td style="border:1px solid var(--border-color)"></td>'
                  + '<td style="padding:6px 10px;text-align:right;border:1px solid var(--border-color);color:#16a34a;font-weight:700">'
                  + (c.desconto_pct > 0 ? '-'+c.desconto_pct+'% = -'+fmt(c.desconto_valor||0) : '—')
                  + '</td>';
              }).join('')}
              <td colspan="2" style="border:1px solid var(--border-color);background:#eef7fb"></td>
            </tr>` : ''}

            <!-- TOTAL NEGOCIADO FINAL — rodapé destacado -->
            <tr style="background:var(--fa-dark)">
              <td colspan="3" style="padding:11px 14px;font-weight:800;font-size:12px;color:#fff;border:1px solid rgba(255,255,255,0.1);text-transform:uppercase;letter-spacing:0.5px">
                TOTAL NEGOCIADO FINAL
              </td>
              ${cotacoes.map(c => {
                if (c.declinou) return '<td colspan="2" style="padding:11px 10px;text-align:center;border:1px solid rgba(255,255,255,0.1);color:#fca5a5;font-weight:800;font-size:12px;letter-spacing:0.3px">DECLINOU</td>';
                const tn = c.total_negociado != null ? c.total_negociado : c.total;
                const isMen = tn === menorTotal && tn > 0;
                const isRec = cotacoes.indexOf(c) === m.forn_recomendado_idx;
                return '<td style="border:1px solid rgba(255,255,255,0.1)"></td>'
                  + '<td style="padding:11px 12px;text-align:right;border:1px solid rgba(255,255,255,0.1);font-weight:900;font-size:14px;color:'
                  + (isMen ? '#4ade80' : isRec ? '#7ffafa' : '#e2e8f0') + '">'
                  + fmt(tn) + (isMen ? ' <span style="font-size:10px;color:#86efac">✓</span>' : '')
                  + '</td>';
              }).join('')}
              <td colspan="2" style="padding:11px 14px;text-align:right;border:1px solid rgba(255,255,255,0.1);background:#16a34a;font-weight:900;font-size:15px;color:#fff">
                ${fmt(menorTotal)}
              </td>
            </tr>

            ${cotacoes.some(c=>!c.declinou && c.obs_negociacao) ? `
            <tr>
              <td colspan="3" style="padding:5px 12px;font-size:10px;color:var(--text-muted);border:1px solid var(--border-color);font-weight:600">Obs. Negociação</td>
              ${cotacoes.map(c => {
                if (c.declinou) return '<td colspan="2" style="border:1px solid var(--border-color);opacity:0.4"></td>';
                return '<td colspan="2" style="padding:5px 10px;border:1px solid var(--border-color);font-size:10px;color:var(--text-secondary);font-style:italic">' + (c.obs_negociacao || '—') + '</td>';
              }).join('')}
              <td colspan="2" style="border:1px solid var(--border-color);background:#eef7fb"></td>
            </tr>` : ''}
          </tbody>
        </table>
      </div>
    </div>

    <!-- ANÁLISE AI DOS FORNECEDORES -->
    <div style="margin-bottom:18px">
      <div style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:8px;display:flex;align-items:center;gap:8px">
        <i class="fas fa-robot" style="color:#8b5cf6"></i>
        Análise Comparativa dos Fornecedores (IA)
      </div>
      <div style="background:linear-gradient(135deg,rgba(139,92,246,0.06),rgba(59,130,246,0.06));border:1px solid rgba(139,92,246,0.25);border-radius:10px;padding:16px;font-size:12px;line-height:1.75;color:var(--text-secondary);white-space:pre-wrap">${aiAnalise}</div>
    </div>

    <!-- TEXTO DE RECOMENDAÇÃO DO COMPRADOR -->
    ${m.justificativa ? `
      <div style="margin-bottom:18px">
        <div style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:8px;display:flex;align-items:center;gap:8px">
          <i class="fas fa-file-signature" style="color:#8b5cf6"></i>
          Recomendação do Comprador
        </div>
        <div style="background:rgba(139,92,246,0.04);border:1px solid rgba(139,92,246,0.2);border-radius:10px;padding:14px;font-size:12px;color:var(--text-secondary);line-height:1.7;white-space:pre-wrap">${m.justificativa}</div>
      </div>
    ` : ''}

    <!-- HISTÓRICO DO PROCESSO -->
    ${_buildHistoricoProcesso(rfq, rcInfo, m)}

    <!-- APROVAÇÃO / REJEIÇÃO -->
    ${m.aprovado_por ? `
      <div style="background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.3);border-radius:8px;padding:10px 14px;font-size:12px;color:#22c55e;margin-bottom:10px">
        <i class="fas fa-check-circle" style="margin-right:6px"></i>
        <strong>Aprovado</strong> por ${m.aprovado_por} em ${m.aprovado_em}
      </div>
    ` : ''}

    ${m.cancelado_por ? `
      <div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.3);border-radius:8px;padding:10px 14px;font-size:12px;color:#ef4444;margin-bottom:10px">
        <i class="fas fa-ban" style="margin-right:6px"></i>
        <strong>Cancelado</strong> por ${m.cancelado_por} em ${m.cancelado_em}
        ${m.motivo_cancelamento ? ` — "${m.motivo_cancelamento}"` : ''}
      </div>
    ` : ''}
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
    <button class="btn btn-sm" onclick="gerarPDFMapa('${matrizId}')" style="background:rgba(220,38,38,0.12);color:#dc2626;border:1px solid rgba(220,38,38,0.3)"><i class="fas fa-file-pdf"></i> Gerar PDF</button>
    ${['Aguardando Aprovação','Aprovada','Aprovado'].includes(m.status) && isCompras
      ? `<button class="btn btn-warning" onclick="closeModal();revisarMapaAprovado('${m.rfq_id}','${matrizId}')" style="background:#f59e0b;color:#fff;border:none"><i class="fas fa-redo"></i> Revisar Mapa</button>`
      : ''}
    ${m.status==='Aguardando Aprovação' && isCompras
      ? `<button class="btn btn-danger" onclick="closeModal();rejeitarMatriz('${matrizId}')" style="margin-right:4px"><i class="fas fa-times"></i> Rejeitar</button>
         <button class="btn btn-success" onclick="closeModal();aprovarMatriz('${matrizId}')"><i class="fas fa-check"></i> Aprovar Mapa</button>`
      : ''}
  `);

  // ── Atualiza badge de alçada de forma assíncrona com câmbio real da API ──
  _getCotacaoUSD().then(cotacaoReal => {
    const cfgR    = _getAlcadaConfig();
    const valUSDR = valorBRL / cotacaoReal;
    const limR    = cfgR.limite_usd || 10000;
    const isGMR   = valUSDR > limR;
    const nomeR   = isGMR ? cfgR.nome_gm : cfgR.nome_gerente;
    const corR    = isGMR ? '#f59e0b' : 'var(--fa-teal)';
    const iconeR  = isGMR ? 'fa-user-tie' : 'fa-user-check';
    const usdFmtR = new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(valUSDR);
    const limFmtR = new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(limR);
    const badgeEl = document.getElementById('alcada-badge-modal');
    if (badgeEl) {
      badgeEl.style.background = isGMR ? 'rgba(245,158,11,0.13)' : 'rgba(0,180,184,0.13)';
      badgeEl.style.borderColor = isGMR ? 'rgba(245,158,11,0.40)' : 'rgba(0,180,184,0.40)';
    }
    const nEl = document.getElementById('alcada-badge-nome');
    if (nEl) nEl.innerHTML = `<i class="fas ${iconeR}" style="margin-right:5px;color:${corR}"></i><span style="color:${corR}">${nomeR}</span>`;
    const vEl = document.getElementById('alcada-badge-valor');
    if (vEl) { vEl.style.color = 'var(--text-muted)'; vEl.textContent = usdFmtR + ' · limite ' + limFmtR; }
    const cEl = document.getElementById('alcada-badge-cambio');
    if (cEl) cEl.textContent = 'USD/BRL: R$ ' + cotacaoReal.toFixed(2) + ' (ao vivo)';
  }).catch(() => {});
  } catch(errVerDetalhe) {
    console.error('[verDetalheMatriz] Erro ao renderizar mapa:', errVerDetalhe);
    // Fecha qualquer modal incompleto e mostra erro amigável
    try { closeModal(); } catch(eClose) {}
    openModal('⚠️ Erro ao Exibir Mapa', `
      <div style="text-align:center;padding:20px 0">
        <div style="font-size:40px;margin-bottom:12px">⚠️</div>
        <div style="font-size:14px;font-weight:700;color:var(--text-primary);margin-bottom:8px">
          Erro ao carregar análise do mapa
        </div>
        <div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);border-radius:8px;padding:10px;font-size:11px;font-family:monospace;color:#dc2626;text-align:left;margin:12px 0;word-break:break-all">
          ${errVerDetalhe.message || String(errVerDetalhe)}
        </div>
        <div style="font-size:11px;color:var(--text-muted)">
          Tente recarregar a página ou gere um novo mapa a partir da aba RFQ.
        </div>
      </div>
    `, `
      <button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
      <button class="btn btn-primary" onclick="closeModal();navigate('rfq')"><i class="fas fa-paper-plane"></i> Ir para RFQ</button>
    `);
  }
}

// ─── Gera análise comparativa dos fornecedores usando dados do mapa ──────────
function _gerarAnaliseCompletaFornecedores(m, rfq, menorTotal) {
  const cotacoes = m.cotacoes || [];
  const cotAtivas = cotacoes.filter(c => !c.declinou);
  const declinaram = cotacoes.filter(c => c.declinou);

  if (cotAtivas.length === 0) return 'Nenhuma cotação ativa para análise.';

  const criteriosLabels = {
    preco:'menor preço', prazo:'prazo de entrega', pagamento:'condição de pagamento',
    frete:'frete / logística', historico:'histórico do fornecedor', tecnico:'critério técnico',
    total_negociado:'menor valor negociado total'
  };
  const criteriosEscolhidos = (m.criterios_avaliacao || rfq.criterios_avaliacao || []).map(c => criteriosLabels[c] || c);
  const criterioTxt = criteriosEscolhidos.length ? criteriosEscolhidos.join(', ') : (m.criterio || 'menor preço').toLowerCase();

  // Fornecedor recomendado
  const fornRec = cotacoes[m.forn_recomendado_idx] || cotAtivas[0];
  const nomeRec = _rfqNomeForn(fornRec?.fornecedor || '');
  const totalRec = fornRec?.total_negociado != null ? fornRec.total_negociado : (fornRec?.total || 0);

  let txt = `ANÁLISE COMPARATIVA DE FORNECEDORES\n`;
  txt += `Processo: ${m.numero_rfq} — ${m.titulo}\n`;
  txt += `Data de emissão: ${m.criado_em || new Date().toLocaleDateString('pt-BR')}\n`;
  txt += `Critérios considerados: ${criterioTxt}\n\n`;

  txt += `── PARTICIPANTES DO PROCESSO ──\n`;
  cotAtivas.forEach((c, idx) => {
    const tn = c.total_negociado != null ? c.total_negociado : c.total;
    const nomeForn = _rfqNomeForn(c.fornecedor);
    const idf = _getIDFScoreForn(c.fornecedor);
    const isMenor = tn === menorTotal && tn > 0;
    const isRec = cotacoes.indexOf(c) === m.forn_recomendado_idx;

    txt += `\n${isRec ? '★ ' : ''}F${cotacoes.indexOf(c)+1}: ${nomeForn}\n`;
    txt += `   · Valor total negociado: ${fmt(tn)}${isMenor ? ' ← MENOR PREÇO' : ''}\n`;
    if (c.desconto_pct > 0) txt += `   · Desconto concedido: ${c.desconto_pct}% (economia de ${fmt(c.desconto_valor || 0)})\n`;
    if (c.prazo_entrega) txt += `   · Prazo de entrega: ${c.prazo_entrega} dias\n`;
    if (c.cond_pagamento) txt += `   · Condição de pagamento: ${c.cond_pagamento}\n`;
    if (c.frete) txt += `   · Frete: ${c.frete}${c.valor_frete > 0 ? ' – ' + fmt(c.valor_frete) : ''}\n`;
    if (idf) txt += `   · Score IDF: ${idf.score.toFixed(0)} pts — ${idf.classificacao} (avaliação de ${idf.data})\n`;
    else txt += `   · Score IDF: Não avaliado\n`;
    if (c.obs_negociacao) txt += `   · Nota de negociação: "${c.obs_negociacao}"\n`;
  });

  if (declinaram.length) {
    txt += `\n── DECLÍNIOS ──\n`;
    declinaram.forEach(c => {
      txt += `🚫 ${_rfqNomeForn(c.fornecedor)} declinou a participação no processo.\n`;
    });
  }

  txt += `\n── RECOMENDAÇÃO ──\n`;
  const totaisAtivos = cotAtivas.map(c => c.total_negociado != null ? c.total_negociado : c.total).filter(t => t > 0);
  const maiorT = totaisAtivos.length ? Math.max(...totaisAtivos) : 0;
  const economiaVsMaior = maiorT > totalRec && maiorT > 0 ? ((maiorT - totalRec) / maiorT * 100).toFixed(1) : null;

  txt += `Recomendamos a contratação de ${nomeRec} pelo valor de ${fmt(totalRec)}, com base nos critérios: ${criterioTxt}.\n`;
  if (economiaVsMaior) {
    txt += `Este fornecedor representa uma economia de ${economiaVsMaior}% frente à proposta mais elevada (${fmt(maiorT)}).\n`;
  }
  if (fornRec?.desconto_pct > 0) txt += `Desconto negociado: ${fornRec.desconto_pct}% — valor original: ${fmt(fornRec.subtotal || fornRec.total)}.\n`;
  if (fornRec?.prazo_entrega) txt += `Prazo acordado: ${fornRec.prazo_entrega} dias.\n`;
  if (fornRec?.cond_pagamento) txt += `Pagamento: ${fornRec.cond_pagamento}.\n`;

  const idfRec = _getIDFScoreForn(fornRec?.fornecedor || '');
  if (idfRec) txt += `O fornecedor recomendado possui IDF ${idfRec.score.toFixed(0)} pts (${idfRec.classificacao}), indicando desempenho ${idfRec.score >= 80 ? 'excelente' : idfRec.score >= 60 ? 'satisfatório' : 'em desenvolvimento'}.\n`;
  else txt += `Nota: Fornecedor recomendado ainda não possui avaliação IDF registrada no sistema.\n`;

  if (rfq.criterios_obs) txt += `\nObservações adicionais: ${rfq.criterios_obs}\n`;

  return txt;
}

// ─── Constrói bloco de histórico do processo ─────────────────────────────────
function _buildHistoricoProcesso(rfq, rcInfo, m) {
  const historico = [];

  // Coleta histórico da RC se disponível
  if (rcInfo && rcInfo.historico && rcInfo.historico.length) {
    rcInfo.historico.forEach(h => historico.push({ ...h, origem: 'RC' }));
  }

  // Histórico da RFQ se tiver
  if (rfq.historico && rfq.historico.length) {
    rfq.historico.forEach(h => historico.push({ ...h, origem: 'RFQ' }));
  }

  if (!historico.length) {
    // Monta timeline mínima com dados disponíveis
    const items = [];
    if (rcInfo) items.push({ icon: 'fa-file-alt', color: '#6366f1', label: 'RC criada', detalhe: rcInfo.numero || rfq.rc_numero, data: rcInfo.criado_em || '—' });
    items.push({ icon: 'fa-paper-plane', color: 'var(--fa-teal)', label: 'RFQ iniciada', detalhe: rfq.numero_rfq, data: rfq.criado_em || '—' });
    if (rfq.prazo_cotacao) items.push({ icon: 'fa-clock', color: '#f59e0b', label: 'Prazo cotação', detalhe: rfq.prazo_cotacao, data: '—' });
    items.push({ icon: 'fa-balance-scale', color: '#8b5cf6', label: 'Mapa gerado', detalhe: m.id, data: m.criado_em || '—' });
    if (m.aprovado_por) items.push({ icon: 'fa-check-circle', color: '#22c55e', label: 'Mapa aprovado', detalhe: 'por ' + m.aprovado_por, data: m.aprovado_em || '—' });

    return `
      <div style="margin-bottom:18px">
        <div style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:8px;display:flex;align-items:center;gap:8px">
          <i class="fas fa-history" style="color:var(--fa-teal)"></i>
          Histórico do Processo
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:8px">
          ${items.map((it, idx) => `
            <div style="display:flex;align-items:center;gap:6px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;padding:7px 12px">
              <i class="fas ${it.icon}" style="color:${it.color};font-size:14px"></i>
              <div>
                <div style="font-size:11px;font-weight:700;color:var(--text-primary)">${it.label}</div>
                <div style="font-size:10px;color:var(--text-muted)">${it.detalhe} · ${it.data}</div>
              </div>
              ${idx < items.length - 1 ? '<i class="fas fa-chevron-right" style="color:var(--border-color);font-size:10px;margin-left:2px"></i>' : ''}
            </div>
          `).join('')}
        </div>
      </div>`;
  }

  return `
    <div style="margin-bottom:18px">
      <div style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:8px;display:flex;align-items:center;gap:8px">
        <i class="fas fa-history" style="color:var(--fa-teal)"></i>
        Histórico do Processo
      </div>
      <div style="border:1px solid var(--border-color);border-radius:10px;overflow:hidden;max-height:200px;overflow-y:auto">
        ${historico.slice(-12).reverse().map(h => `
          <div style="display:grid;grid-template-columns:auto 1fr auto;gap:10px;padding:8px 12px;border-bottom:1px solid var(--border-color);font-size:11px;align-items:center">
            <span style="background:${h.origem==='RC'?'rgba(99,102,241,0.1)':'rgba(0,180,184,0.1)'};color:${h.origem==='RC'?'#6366f1':'var(--fa-teal)'};border-radius:4px;padding:2px 6px;font-size:9px;font-weight:700">${h.origem}</span>
            <span style="color:var(--text-secondary)">${h.acao || h.status || h.texto || '—'}</span>
            <span style="color:var(--text-muted);white-space:nowrap">${h.data || h.created_at || '—'} ${h.usuario ? '– ' + h.usuario : ''}</span>
          </div>
        `).join('')}
      </div>
    </div>`;
}

// ─── Gerar PDF do Mapa Comparativo ──────────────────────────────────────────
function gerarPDFMapa(matrizId) {
  const m = _getMatrizes().find(x => x.id === matrizId);
  if (!m) return showToast('Mapa não encontrado.', 'error');

  let rfq = _getRFQs().find(r => r.id === m.rfq_id) || {};
  if (!rfq.id) {
    try { const fl = JSON.parse(localStorage.getItem('fa_rfq_flow')||'[]'); rfq = fl.find(r => r.id === m.rfq_id) || {}; } catch(e) {}
  }

  // Normaliza cotações (suporta formato novo e legado)
  let cotacoes = m.cotacoes || [];
  if (!cotacoes.length && (m.cotacoes_comparadas||[]).length) {
    cotacoes = (m.cotacoes_comparadas||[]).map((c,i) => ({
      forn_idx: i, fornecedor: c.fornecedor_id||c.fornecedor||'',
      total: c.valor||c.valor_total||0, total_negociado: c.valor||c.valor_total||null,
      prazo_entrega: c.prazo||15, cond_pagamento:'30 dias', frete:'CIF', desconto_pct:0, declinou:false, itens: m.itens||[]
    }));
  }

  const cotAtivas = cotacoes.filter(c => !c.declinou);
  const totaisComp = cotAtivas.map(c => c.total_negociado != null ? c.total_negociado : c.total);
  const menorTotal = totaisComp.filter(t=>t>0).length ? Math.min(...totaisComp.filter(t=>t>0)) : 0;

  const criteriosLabels = {
    preco:'Menor Preço', prazo:'Prazo de Entrega', pagamento:'Cond. Pagamento',
    frete:'Frete / Logística', historico:'Histórico', tecnico:'Critério Técnico',
    total_negociado:'Total Negociado'
  };
  const criteriosExib = (m.criterios_avaliacao || rfq.criterios_avaliacao || []).map(c => criteriosLabels[c] || c);
  const aiAnalise = _gerarAnaliseCompletaFornecedores({ ...m, cotacoes }, rfq, menorTotal);
  const itens = rfq.itens || m.itens || [];

  // ── Monta cabeçalhos de fornecedores para a tabela ──
  const fornHeaders = cotacoes.map((c, i) => {
    const nm = _rfqNomeForn(c.fornecedor);
    const idf = _getIDFScoreForn(c.fornecedor);
    let idfCls = 'idf-na', idfTxt = 'Não avaliado';
    if (idf) {
      idfTxt = 'IDF ' + idf.score.toFixed(0) + ' – ' + (idf.classificacao.split(' ')[0]);
      idfCls = idf.score >= 80 ? 'idf-a' : idf.score >= 60 ? 'idf-b' : idf.score >= 40 ? 'idf-c' : 'idf-d';
    }
    const isRec = i === m.forn_recomendado_idx;
    return { nm, idf, idfCls, idfTxt, isRec };
  });

  // ── Gera linhas de itens ──
  const linhasItens = itens.length ? itens.map((item, idx) => {
    let melhorPrc = Infinity, melhorCI = -1;
    cotacoes.forEach((c, ci) => {
      if (c.declinou) return;
      const pu = parseFloat(c.itens?.[idx]?.preco) || 0;
      if (pu > 0 && pu < melhorPrc) { melhorPrc = pu; melhorCI = ci; }
    });
    const melhorNome = melhorCI >= 0 ? _rfqNomeForn(cotacoes[melhorCI].fornecedor) : '—';
    const melhorTot  = melhorCI >= 0
      ? (parseFloat(cotacoes[melhorCI].itens?.[idx]?.total) || (melhorPrc * parseFloat(item.qtd || 1)))
      : 0;

    const cells = cotacoes.map((c, ci) => {
      if (c.declinou) return `<td colspan="2" style="text-align:center;background:#fef2f2;color:#ef4444;font-size:9px;font-style:italic">Declinou</td>`;
      const pu  = parseFloat(c.itens?.[idx]?.preco) || 0;
      const tot = parseFloat(c.itens?.[idx]?.total) || (pu * parseFloat(item.qtd || 1));
      const isBest = ci === melhorCI && pu > 0;
      const isRecRow = ci === m.forn_recomendado_idx;
      const cls = isBest ? 'class="menor"' : isRecRow ? 'class="rec-cell"' : '';
      return `<td style="text-align:right" ${cls}>${pu ? fmt(pu) : '—'}</td>`
           + `<td style="text-align:right;font-weight:${isBest?'700':'400'}" ${cls}>${tot ? fmt(tot) : '—'}</td>`;
    }).join('');

    return `<tr class="${idx%2===0?'stripe':''}">
      <td style="text-align:center;color:#6b7280;font-size:10px">${idx+1}</td>
      <td><span style="font-weight:600;font-size:11px">${item.descricao}</span>${item.referencia?'<br><span style="font-size:9px;color:#9ca3af">Ref: '+item.referencia+'</span>':''}</td>
      <td style="text-align:center;white-space:nowrap">${item.qtd} <span style="font-size:9px;color:#9ca3af">${item.unidade||'un'}</span></td>
      ${cells}
      <td style="text-align:center;background:#eff6ff;font-size:9px;font-weight:700;color:#1e40af">${melhorNome.length>14?melhorNome.substring(0,14)+'…':melhorNome}</td>
      <td style="text-align:right;background:#eff6ff;font-weight:800;color:#16a34a">${melhorTot ? fmt(melhorTot) : '—'}</td>
    </tr>`;
  }).join('') : `<tr><td colspan="${3 + cotacoes.length * 2 + 2}" style="text-align:center;padding:12px;color:#6b7280;font-style:italic">Itens detalhados não disponíveis</td></tr>`;

  // ── Linha subtotal ──
  const subtotalCells = cotacoes.map(c => {
    if (c.declinou) return `<td colspan="2" style="text-align:center;color:#ef4444;font-style:italic;opacity:0.6">Declinou</td>`;
    return `<td></td><td style="text-align:right;font-weight:700">${fmt(c.subtotal||c.total||0)}</td>`;
  }).join('');

  // ── Linha frete ──
  const hasFrete = cotacoes.some(c=>!c.declinou && c.valor_frete>0);
  const freteCells = hasFrete ? cotacoes.map(c => {
    if (c.declinou) return `<td colspan="2" style="opacity:0.4"></td>`;
    return `<td></td><td style="text-align:right;color:#b45309">${c.valor_frete>0?'+'+fmt(c.valor_frete):'—'}</td>`;
  }).join('') : '';

  // ── Linha desconto ──
  const hasDesc = cotacoes.some(c=>!c.declinou && c.desconto_pct>0);
  const descCells = hasDesc ? cotacoes.map(c => {
    if (c.declinou) return `<td colspan="2" style="opacity:0.4"></td>`;
    return `<td></td><td style="text-align:right;color:#16a34a;font-weight:700">${c.desconto_pct>0?'-'+c.desconto_pct+'%':' —'}</td>`;
  }).join('') : '';

  // ── Linha total final ──
  const totalCells = cotacoes.map(c => {
    if (c.declinou) return `<td colspan="2" style="text-align:center;color:#ef4444;font-weight:700">DECLINOU</td>`;
    const tn = c.total_negociado != null ? c.total_negociado : c.total;
    const isMen = tn === menorTotal && tn > 0;
    const isRec = cotacoes.indexOf(c) === m.forn_recomendado_idx;
    return `<td></td><td style="text-align:right;font-weight:900;font-size:13px;color:${isMen?'#16a34a':isRec?'#0B4F6C':'#1f2937'}">${fmt(tn)}${isMen?' ✓':''}</td>`;
  }).join('');

  // ── Número de colunas dinâmico ──
  const colsCondHeader = cotacoes.map(c => `<td colspan="2" style="text-align:center">`);

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Mapa Comparativo – ${m.id}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #1f2937; margin: 0; padding: 16px; background: #fff; }
    /* Cabeçalho */
    .hdr { background: #0B4F6C; color: #fff; padding: 12px 16px; border-radius: 6px 6px 0 0; display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0; }
    .hdr h1 { margin: 0; font-size: 14px; font-weight: 800; letter-spacing: 0.5px; }
    .hdr-sub { font-size: 10px; opacity: 0.75; margin-top: 2px; }
    .hdr-info { font-size: 10px; text-align: right; line-height: 1.7; opacity: 0.9; }
    .meta-bar { background: #f8fafc; border: 1px solid #e5e7eb; border-top: none; display: flex; flex-wrap: wrap; gap: 0; margin-bottom: 12px; }
    .meta-cell { padding: 6px 12px; border-right: 1px solid #e5e7eb; font-size: 10px; }
    .meta-cell b { display: block; font-size: 9px; text-transform: uppercase; color: #6b7280; margin-bottom: 1px; }
    .criterios { margin-bottom: 10px; font-size: 10px; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 5px; padding: 6px 10px; }
    h2 { font-size: 11px; color: #374151; margin: 14px 0 5px; border-left: 3px solid #00b4b8; padding-left: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 0; font-size: 10px; page-break-inside: auto; }
    th, td { padding: 5px 7px; border: 1px solid #e5e7eb; vertical-align: middle; }
    .thead-dark { background: #0B4F6C; color: #fff; font-weight: 800; font-size: 10px; text-align: center; }
    .thead-sub { background: #f3f4f6; color: #374151; font-size: 9px; font-weight: 700; text-transform: uppercase; }
    .thead-cond { background: #f9fafb; font-size: 9px; color: #6b7280; }
    .rec-col { background: rgba(0,180,184,0.08); }
    .declinou-col { background: #fef2f2; }
    .melhor-col { background: #eff6ff; }
    .stripe { background: #f9fafb; }
    .rec { background: #ecfdf5; }
    .rec-cell { color: #0B4F6C; font-weight: 600; }
    .declinou { background: #fef2f2; color: #ef4444; }
    .menor { color: #16a34a; font-weight: 700; }
    .subtotal-row { background: #f3f4f6; font-weight: 700; }
    .total-row td { background: #0B4F6C; color: #fff; font-weight: 900; font-size: 12px; padding: 8px 7px; }
    .total-menor { color: #4ade80 !important; }
    .total-melhor { background: #16a34a !important; color: #fff !important; font-weight: 900 !important; }
    .idf-a { color: #16a34a; font-weight: 700; } .idf-b { color: #2563eb; font-weight: 700; }
    .idf-c { color: #d97706; font-weight: 700; } .idf-d { color: #dc2626; font-weight: 700; }
    .idf-na { color: #9ca3af; }
    .analise { background: #f5f3ff; border: 1px solid #c4b5fd; border-radius: 5px; padding: 10px 12px; font-size: 10px; white-space: pre-wrap; line-height: 1.6; margin-bottom: 12px; }
    .rec-box { background: #f0fdf4; border: 1px solid #86efac; border-radius: 5px; padding: 10px 12px; font-size: 10px; white-space: pre-wrap; line-height: 1.6; }
    .badge { display: inline-block; border-radius: 3px; padding: 1px 5px; font-size: 8px; font-weight: 700; }
    .footer { margin-top: 18px; border-top: 1px solid #e5e7eb; padding-top: 8px; font-size: 9px; color: #9ca3af; display: flex; justify-content: space-between; }
    @media print {
      body { padding: 8px; font-size: 10px; }
      .hdr { border-radius: 0; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <!-- CABEÇALHO ESTILO AETHRA -->
  <div class="hdr">
    <div>
      <div class="hdr h1" style="margin:0;font-size:14px;font-weight:800;letter-spacing:0.5px">MAPA DE COLETA DE PREÇO</div>
      <div class="hdr-sub">${m.titulo}</div>
    </div>
    <div class="hdr-info">
      <div><b>Data:</b> ${new Date().toLocaleDateString('pt-BR')}</div>
      <div><b>Processo RFQ:</b> ${m.numero_rfq}</div>
      <div><b>Mapa:</b> ${m.id}</div>
      <div><b>Status:</b> ${m.status}</div>
      ${m.aprovado_por ? `<div style="margin-top:3px;background:rgba(74,222,128,0.3);border-radius:3px;padding:1px 6px;font-weight:700">✓ Aprovado por ${m.aprovado_por}</div>` : ''}
    </div>
  </div>
  <div class="meta-bar">
    ${rfq.contrato ? `<div class="meta-cell"><b>Contrato</b>${rfq.contrato}</div>` : ''}
    ${rfq.solicitante ? `<div class="meta-cell"><b>Solicitante</b>${rfq.solicitante}</div>` : ''}
    ${rfq.prazo_cotacao ? `<div class="meta-cell"><b>Prazo Cotação</b>${rfq.prazo_cotacao}</div>` : ''}
    <div class="meta-cell"><b>Emitido por</b>${m.criado_por || currentUser?.name || '—'}</div>
    <div class="meta-cell"><b>Qtd. Itens</b>${itens.length || '—'}</div>
    <div class="meta-cell"><b>Fornecedores</b>${cotacoes.length} (${cotAtivas.length} ativos)</div>
  </div>

  ${criteriosExib.length ? `
  <div class="criterios"><b>Critérios de Avaliação:</b> ${criteriosExib.join(' · ')}</div>` : ''}

  <h2>Matriz Comparativa — Item a Item</h2>
  <table>
    <thead>
      <!-- Linha 1: Fornecedores -->
      <tr>
        <td colspan="3" class="thead-dark" style="text-align:left">ITENS / FORNECEDORES</td>
        ${fornHeaders.map((f, i) => `
          <td colspan="2" class="thead-dark ${f.isRec&&!cotacoes[i].declinou?'':''}${cotacoes[i].declinou?' declinou-col':f.isRec?' rec-col':''}" style="text-align:center">
            <div>${f.isRec&&!cotacoes[i].declinou?'★ ':''} ${f.nm.length>18?f.nm.substring(0,18)+'…':f.nm}</div>
            <div class="${f.idfCls}" style="font-size:9px;margin-top:2px">${f.idfTxt}</div>
            ${cotacoes[i].declinou?'<div style="font-size:9px;color:#fca5a5">DECLINOU</div>':''}
          </td>`).join('')}
        <td colspan="2" class="thead-dark melhor-col" style="text-align:center;background:#1e3a5f">MELHOR COTAÇÃO</td>
      </tr>
      <!-- Linha 2: Sub-cabeçalhos Unitário / Total -->
      <tr class="thead-sub">
        <td style="text-align:center;width:22px">Nº</td>
        <td>Descrição / Material</td>
        <td style="text-align:center">Qtd.</td>
        ${cotacoes.map(() => `<td style="text-align:right">Unit.</td><td style="text-align:right">Total</td>`).join('')}
        <td style="text-align:center;background:#eff6ff;color:#1e40af">Fornec.</td>
        <td style="text-align:right;background:#eff6ff;color:#1e40af">Valor</td>
      </tr>
      <!-- Linhas de condições -->
      ${[
        ['Cotação Nº',    (c,ci) => c.declinou ? '—' : 'Q' + String(ci+1).padStart(4,'0')],
        ['Cond. Pagto',   (c)    => c.declinou ? '—' : (c.cond_pagamento||'—')],
        ['Frete',         (c)    => c.declinou ? '—' : (c.frete||'—') + (c.valor_frete>0?' '+fmt(c.valor_frete):'')],
        ['Prazo Entrega', (c)    => c.declinou ? '—' : (c.prazo_entrega ? c.prazo_entrega+' dias':'—')]
      ].map(([lbl, fn]) => `
        <tr class="thead-cond">
          <td colspan="3" style="font-weight:600">${lbl}</td>
          ${cotacoes.map((c,ci) => `<td colspan="2" style="text-align:center">${fn(c,ci)}</td>`).join('')}
          <td colspan="2" style="background:#f8fafc"></td>
        </tr>`).join('')}
    </thead>
    <tbody>
      ${linhasItens}
      <!-- SUBTOTAL -->
      <tr class="subtotal-row">
        <td colspan="3">Subtotal (Bruto)</td>
        ${subtotalCells}
        <td colspan="2" style="background:#eff6ff"></td>
      </tr>
      ${hasFrete ? `<tr><td colspan="3" style="color:#b45309;font-weight:600">(+) Frete</td>${freteCells}<td colspan="2" style="background:#eff6ff"></td></tr>` : ''}
      ${hasDesc  ? `<tr><td colspan="3" style="color:#16a34a;font-weight:600">(-) Desconto</td>${descCells}<td colspan="2" style="background:#eff6ff"></td></tr>` : ''}
      <!-- TOTAL FINAL -->
      <tr class="total-row">
        <td colspan="3">TOTAL NEGOCIADO FINAL</td>
        ${totalCells}
        <td class="total-melhor" style="text-align:right;font-size:13px">${fmt(menorTotal)}</td>
        <td class="total-melhor"></td>
      </tr>
    </tbody>
  </table>

  <h2 style="margin-top:18px">Análise Comparativa (IA)</h2>
  <div class="analise">${aiAnalise}</div>

  ${m.justificativa ? `
  <h2>Recomendação do Comprador</h2>
  <div class="rec-box">${m.justificativa}</div>` : ''}

  ${m.aprovado_por ? `<div style="margin-top:10px;font-size:10px;color:#16a34a;font-weight:700">✓ Aprovado por ${m.aprovado_por} em ${m.aprovado_em}</div>` : ''}

  <div class="footer">
    <span>Fraser Alexander – Sistema de Gestão Integrado</span>
    <span>Gerado em ${new Date().toLocaleString('pt-BR')} por ${currentUser?.name || '—'}</span>
  </div>
</body>
</html>`;

  // Abre nova janela para impressão/PDF
  const w = window.open('', '_blank', 'width=1100,height=800,scrollbars=yes');
  if (!w) { showToast('Permita pop-ups para gerar o PDF.', 'warning', 5000); return; }
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); }, 700);
  showToast('📄 Janela de impressão aberta. Use "Salvar como PDF" no diálogo de impressão.', 'info', 6000);
}

function verDetalheRFQ(rfqId) {
  const rfq = _getRFQs().find(r => r.id === rfqId);
  if (!rfq) return;
  const podeEditar = !['Pedido Emitido','Cancelada'].includes(rfq.status);
  const matrizes   = _getMatrizes();
  const matrizAtiva = matrizes.find(m => m.rfq_id === rfqId && !m.status.startsWith('Cancelada'));

  openModalWide('Detalhe RFQ – ' + rfq.numero_rfq, `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;font-size:13px">
      <div><span style="color:var(--text-muted)">Processo:</span> <strong style="color:var(--fa-teal)">${rfq.numero_rfq}</strong></div>
      <div><span style="color:var(--text-muted)">Status:</span> ${_rfqStatusBadge(rfq.status)}</div>
      <div><span style="color:var(--text-muted)">Título:</span> <strong>${rfq.titulo}</strong></div>
      <div><span style="color:var(--text-muted)">Contrato:</span> ${rfq.contrato || '—'}</div>
      <div><span style="color:var(--text-muted)">Solicitante:</span> ${rfq.solicitante || '—'}</div>
      <div><span style="color:var(--text-muted)">Prazo Cotação:</span> ${rfq.prazo_cotacao || '—'}</div>
      <div><span style="color:var(--text-muted)">Valor Est.:</span> <strong style="color:var(--fa-teal)">${fmt(rfq.valor_estimado)}</strong></div>
      <div><span style="color:var(--text-muted)">Fornecedores:</span> ${(rfq.fornecedores_convidados||[]).length} convidado(s)</div>
      ${rfq.rc_numero ? `<div><span style="color:var(--text-muted)">RC Origem:</span> <strong>${rfq.rc_numero}</strong></div>` : ''}
      ${rfq.os_id ? `<div><span style="color:var(--text-muted)">OS:</span> ${rfq.os_id}</div>` : ''}
    </div>

    <!-- Fornecedores convidados -->
    ${(rfq.fornecedores_convidados||[]).length > 0 ? `
      <div style="margin-bottom:12px">
        <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:6px">Fornecedores Convidados</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          ${rfq.fornecedores_convidados.map((f,i) => {
            const cot = (rfq.cotacoes||[]).find(c => c.forn_idx === i);
            const declinou = cot?.declinou === true;
            const nome = _rfqNomeForn(f);
            return `
            <span style="background:${declinou?'rgba(239,68,68,0.08)':'var(--bg-tertiary)'};border:1px solid ${declinou?'rgba(239,68,68,0.3)':'var(--border-color)'};border-radius:6px;padding:3px 10px;font-size:11px;color:${declinou?'#ef4444':'var(--text-primary)'}">
              ${_rfqLabelForn(f, i)}${declinou?' 🚫 Declinou':''}
            </span>`;
          }).join('')}
        </div>
      </div>
    ` : ''}

    <!-- Itens -->
    <div style="margin-bottom:12px">
      <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:6px">Itens (${(rfq.itens||[]).length})</div>
      <div style="border:1px solid var(--border-color);border-radius:8px;overflow:hidden">
        ${(rfq.itens||[]).map((it,idx) => `
          <div style="display:flex;gap:12px;padding:7px 12px;border-bottom:1px solid var(--border-color);font-size:12px">
            <span style="color:var(--text-muted);min-width:20px">${idx+1}.</span>
            <span style="flex:1;color:var(--text-primary)">${it.descricao}</span>
            <span style="color:var(--text-muted)">${it.qtd} ${it.unidade}</span>
            ${it.valor_unit > 0 ? `<span style="color:var(--fa-teal);font-weight:600">${fmt(it.valor_unit)}/un</span>` : ''}
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Cotações recebidas -->
    ${rfq.cotacoes?.length ? `
      <div style="margin-bottom:12px">
        <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:6px">Cotações Registradas</div>
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-size:12px">
            <thead><tr style="background:var(--bg-tertiary)">
              <th style="padding:7px 10px;text-align:left">Fornecedor</th>
              <th style="padding:7px 10px;text-align:right">Subtotal</th>
              <th style="padding:7px 10px;text-align:center">Desc. %</th>
              <th style="padding:7px 10px;text-align:right">Total Neg.</th>
              <th style="padding:7px 10px;text-align:center">Prazo</th>
              <th style="padding:7px 10px;text-align:center">Cond. Pag.</th>
              <th style="padding:7px 10px;text-align:center">Frete</th>
            </tr></thead>
            <tbody>
              ${rfq.cotacoes.map((c,i) => {
                const tn = c.total_negociado != null ? c.total_negociado : c.total;
                return `
                <tr style="border-bottom:1px solid var(--border-color)">
                  <td style="padding:7px 10px;font-weight:600">F${i+1}: ${typeof c.fornecedor==='string'?c.fornecedor.substring(0,24):'Forn.'+(i+1)}</td>
                  <td style="padding:7px 10px;text-align:right">${fmt(c.subtotal||c.total)}</td>
                  <td style="padding:7px 10px;text-align:center;color:${c.desconto_pct>0?'#22c55e':'var(--text-muted)'}">${c.desconto_pct>0?c.desconto_pct+'%':'—'}</td>
                  <td style="padding:7px 10px;text-align:right;font-weight:700;color:var(--fa-teal)">${fmt(tn)}</td>
                  <td style="padding:7px 10px;text-align:center">${c.prazo_entrega||'—'}d</td>
                  <td style="padding:7px 10px;text-align:center">${c.cond_pagamento||'—'}</td>
                  <td style="padding:7px 10px;text-align:center">${c.frete||'—'}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    ` : '<div style="font-size:12px;color:var(--text-muted);margin-bottom:12px">Nenhuma cotação registrada ainda.</div>'}

    <!-- Mapa ativo -->
    ${matrizAtiva ? `
      <div style="background:rgba(0,180,184,0.06);border:1px solid rgba(0,180,184,0.2);border-radius:8px;padding:10px 14px;font-size:12px">
        <i class="fas fa-balance-scale" style="color:var(--fa-teal);margin-right:6px"></i>
        Mapa Comparativo <strong>${matrizAtiva.id}</strong> – Status: ${_rfqStatusBadge(matrizAtiva.status)}
        · Critério: <strong>${matrizAtiva.criterio}</strong>
        · Valor: <strong style="color:var(--fa-teal)">${fmt(matrizAtiva.valor_aprovado)}</strong>
      </div>
    ` : ''}
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
    ${podeEditar && rfq.status==='Em Cotação' ? `<button class="btn btn-secondary" onclick="closeModal();selecionarFornecedoresRFQ('${rfqId}')"><i class="fas fa-users"></i> Fornecedores</button>` : ''}
    ${podeEditar ? `<button class="btn btn-primary" onclick="closeModal();registrarCotacoes('${rfqId}')"><i class="fas fa-pencil-alt"></i> ${rfq.cotacoes?.length?'Editar Cotações':'Registrar Cotações'}</button>` : ''}
    ${rfq.status==='Cotações Recebidas'||rfq.status==='Mapa em Análise' ? `<button class="btn btn-secondary" onclick="closeModal();abrirMatrizComparativa('${rfqId}')"><i class="fas fa-balance-scale"></i> Ver Mapa</button>` : ''}
  `);
}

// ── Exportações globais para chamadas inline no HTML ──
window._rfqFiltrarFornecedoresCad   = _rfqFiltrarFornecedoresCad;
window._rfqSelecionarFornCad        = _rfqSelecionarFornCad;
window._rfqAdicionarFornCadastrado  = _rfqAdicionarFornCadastrado;
window._rfqAdicionarFornAoCotacao   = _rfqAdicionarFornAoCotacao;
window.registrarCotacoes            = registrarCotacoes;
window.salvarCotacoes               = salvarCotacoes;

// ─── ENVIAR EMAIL RFQ (procurement) ──────────────────────────────────────────
// Usa o modal compartilhado do fluxo_aprovacao_rc.js se disponível,
// caso contrário abre um modal próprio simplificado.
function _procEnviarEmailRFQ(rfqId) {
  // Primeiro tenta usar o modal completo do fluxo_aprovacao_rc.js
  if (typeof window._rfqAbrirModalEmail === 'function') {
    // Garante que o RFQ está em fa_rfq_flow para que o modal encontre os dados
    try {
      const rfqs = _getRFQs();
      const rfq  = rfqs.find(r => r.id === rfqId);
      if (rfq) {
        const flowRFQs = JSON.parse(localStorage.getItem('fa_rfq_flow') || '[]');
        const fi = flowRFQs.findIndex(r => r.id === rfqId);
        if (fi < 0) {
          flowRFQs.unshift(rfq);
          localStorage.setItem('fa_rfq_flow', JSON.stringify(flowRFQs));
          if (typeof window._saveRFQFlow === 'function') window._saveRFQFlow(flowRFQs);
        }
      }
    } catch(e) {}
    window._rfqAbrirModalEmail(rfqId);
    return;
  }

  // Fallback: modal simplificado de e-mail
  const rfqs = _getRFQs();
  const rfq  = rfqs.find(r => r.id === rfqId);
  if (!rfq) { showToast('RFQ não encontrado.', 'error'); return; }

  const forns    = rfq.fornecedores_detalhes || rfq.fornecedores || [];
  const comEmail = forns.filter(f => f.email).length;
  const emails   = forns.filter(f => f.email).map(f => f.email).join(';');
  const numero   = rfq.numero_rfq || rfq.numero || rfqId;
  const prazo    = rfq.prazo_cotacao || '—';
  const itens    = rfq.itens || [];

  const assunto = `Solicitação de Cotação – ${numero}: ${rfq.titulo || ''}`;
  const linhasItens = itens.map((it, i) =>
    `${i+1}. ${it.descricao || it.nome || '—'} – Qtd: ${it.qtd || it.quantidade || 1} ${it.unidade || it.un || 'Un'}`
  ).join('\n');
  const corpo = `Prezado(a) Fornecedor,\n\nSolicitamos sua proposta para os itens abaixo (documento ${numero} em anexo).\n\n──── ITENS ────\n${linhasItens || '(vide PDF)'}\n───────────────\n\nPRAZO: ${prazo}\n\nFavor informar preços, prazo de entrega e condições de pagamento.\n\nAtenciosamente,\n${currentUser?.name || 'Compras'} – Fraser Alexander`;

  openModalWide(`Enviar RFQ por E-mail – ${numero}`, `
    <div style="margin-bottom:10px;padding:10px 14px;background:var(--bg-card2);border-radius:8px;font-size:12px">
      <strong>${comEmail}</strong> fornecedor(es) com e-mail · <strong>${forns.length - comEmail}</strong> sem e-mail (PDF manual)
    </div>
    <div class="form-group" style="margin-bottom:10px">
      <label style="font-size:12px;color:var(--text-muted)">Assunto</label>
      <input class="form-control" id="proc_email_assunto" value="${assunto.replace(/"/g,'&quot;')}" style="font-size:12px">
    </div>
    <div class="form-group">
      <label style="font-size:12px;color:var(--text-muted)">Corpo do E-mail (editável)</label>
      <textarea class="form-control" id="proc_email_corpo" rows="12"
        style="font-size:12px;font-family:monospace;resize:vertical">${corpo.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</textarea>
    </div>
    <div style="margin-top:10px;padding:8px 12px;background:rgba(99,102,241,0.06);border-radius:8px;font-size:11px;color:var(--text-muted)">
      <i class="fas fa-info-circle" style="color:#6366f1;margin-right:5px"></i>
      Clique em "Abrir no E-mail" para abrir seu cliente de e-mail com o texto preenchido. Gere o PDF e anexe antes de enviar.
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
    ${typeof window._rfqGerarPDF_id === 'function' ? `<button class="btn btn-secondary" onclick="closeModal();window._rfqGerarPDF_id('${rfqId}')"><i class="fas fa-file-pdf" style="color:#ef4444"></i> Gerar PDF</button>` : ''}
    ${comEmail > 0 ? `<button class="btn btn-info" onclick="_procAbrirMailto('${rfqId}')"><i class="fas fa-external-link-alt"></i> Abrir no E-mail</button>` : ''}
    <button class="btn btn-primary" onclick="_procMarcarEnviadoSimples('${rfqId}')"><i class="fas fa-check-circle"></i> Marcar como Enviado</button>
  `);
}

function _procAbrirMailto(rfqId) {
  const rfqs  = _getRFQs();
  const rfq   = rfqs.find(r => r.id === rfqId);
  if (!rfq) return;
  const forns = rfq.fornecedores_detalhes || rfq.fornecedores || [];
  const emails = forns.filter(f => f.email).map(f => f.email).join(';');
  const assunto = document.getElementById('proc_email_assunto')?.value || `Solicitação de Cotação – ${rfq.numero_rfq||rfq.numero}`;
  const corpo   = document.getElementById('proc_email_corpo')?.value   || '';
  const corpoT  = corpo.length > 1800 ? corpo.substring(0, 1800) + '\n\n[... vide PDF anexo ...]' : corpo;
  if (!emails) { showToast('Nenhum fornecedor com e-mail.', 'warning'); return; }
  window.open(`mailto:${encodeURIComponent(emails)}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpoT)}`, '_blank');
  showToast('Cliente de e-mail aberto. Lembre-se de anexar o PDF!', 'info', 5000);
}

function _procMarcarEnviadoSimples(rfqId) {
  const rfqs = _getRFQs();
  const idx  = rfqs.findIndex(r => r.id === rfqId);
  if (idx < 0) return;
  const agora = new Date().toLocaleString('pt-BR');
  const comEmail = (rfqs[idx].fornecedores_detalhes || rfqs[idx].fornecedores || []).filter(f => f.email).length;
  rfqs[idx].status = 'Em Cotação';
  rfqs[idx].historico = rfqs[idx].historico || [];
  const nReenvios = rfqs[idx].historico.filter(h => h.acao && (h.acao.includes('E-mail') || h.acao.includes('enviado'))).length;
  rfqs[idx].historico.unshift({
    acao: nReenvios > 0
      ? `Reenvio de e-mail #${nReenvios + 1} por ${currentUser?.name||'—'} para ${comEmail} fornecedor(es)`
      : `E-mail enviado por ${currentUser?.name||'—'} para ${comEmail} fornecedor(es)`,
    usuario: currentUser?.name || '—',
    data: agora
  });
  _saveRFQs(rfqs);
  // Sincroniza fa_rfq_flow
  try {
    const fl = JSON.parse(localStorage.getItem('fa_rfq_flow')||'[]');
    const fi = fl.findIndex(r => r.id === rfqId);
    if (fi >= 0) {
      fl[fi].status    = 'Em Cotação';
      fl[fi].historico = rfqs[idx].historico;
      localStorage.setItem('fa_rfq_flow', JSON.stringify(fl));
      if (typeof window._saveRFQFlow === 'function') window._saveRFQFlow(fl);
    }
  } catch(e) {}
  closeModal();
  const reenvioMsg = nReenvios > 0 ? ` (Reenvio #${nReenvios + 1})` : '';
  showToast(`✅ RFQ ${rfqs[idx].numero_rfq||rfqs[idx].numero} marcado como enviado${reenvioMsg}!`, 'success', 4000);
  renderRFQ();
}

// ══════════════════════════════════════════════════════════════════
// ALERTAS DE RFQs OCIOSAS (>15 dias sem atualização)
// ══════════════════════════════════════════════════════════════════

/**
 * _rfqGetAlertasOciosas – retorna lista de RFQs sem atualização por
 * mais de DIAS_IDLE dias (padrão: 15), excluindo canceladas/concluídas.
 */
function _rfqGetAlertasOciosas(diasIdle) {
  diasIdle = diasIdle || 15;
  const rfqs = _mergeRFQs();
  const STATUS_ATIVOS = ['Em Cotação','Aguardando Cotações','Negociando','Cotações Recebidas','Mapa Criado','Mapa em Análise'];
  const agora = Date.now();
  const limiteMs = diasIdle * 24 * 60 * 60 * 1000;

  return rfqs.filter(r => {
    if (!STATUS_ATIVOS.includes(r.status)) return false;
    // Usa data de última atualização ou data de criação
    const dtRef = r.data_atualizacao || r.data_criacao || r.criado_em || r.created_at;
    if (!dtRef) return false;
    const ts = new Date(dtRef).getTime();
    if (isNaN(ts)) return false;
    return (agora - ts) >= limiteMs;
  }).map(r => {
    const dtRef = r.data_atualizacao || r.data_criacao || r.criado_em || r.created_at;
    const diasOciosa = Math.floor((agora - new Date(dtRef).getTime()) / (24 * 60 * 60 * 1000));
    return { ...r, _diasOciosa: diasOciosa };
  }).sort((a, b) => b._diasOciosa - a._diasOciosa);
}

/**
 * _rfqRenderAlertasOciosas – renderiza o painel de alertas de RFQs ociosas
 * dentro do elemento com id `containerId`.
 */
function _rfqRenderAlertasOciosas(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;

  const ociosas = _rfqGetAlertasOciosas(15);
  if (ociosas.length === 0) { el.innerHTML = ''; return; }

  el.innerHTML = `
    <div style="background:rgba(239,68,68,0.07);border:1px solid rgba(239,68,68,0.3);border-radius:10px;padding:14px 16px;margin-bottom:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:10px">
        <div style="display:flex;align-items:center;gap:8px">
          <i class="fas fa-clock" style="color:#ef4444;font-size:18px"></i>
          <span style="font-size:14px;font-weight:700;color:#ef4444">
            ⚠️ ${ociosas.length} RFQ${ociosas.length > 1 ? 's' : ''} ociosa${ociosas.length > 1 ? 's' : ''} há mais de 15 dias
          </span>
        </div>
        <span style="font-size:11px;color:var(--text-muted)">Política: RFQs em cotação não devem ficar paradas por mais de 15 dias</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${ociosas.map(r => `
          <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 12px;background:rgba(239,68,68,0.05);border:1px solid rgba(239,68,68,0.15);border-radius:8px;flex-wrap:wrap">
            <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0">
              <span style="font-weight:700;color:#ef4444;white-space:nowrap">${r.numero || r.numero_rfq || r.id}</span>
              <span style="font-size:12px;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.titulo || '—'}</span>
            </div>
            <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
              <span style="font-size:11px;background:rgba(239,68,68,0.15);color:#ef4444;padding:2px 8px;border-radius:10px;font-weight:700">
                <i class="fas fa-hourglass-half" style="margin-right:3px"></i>${r._diasOciosa} dias parada
              </span>
              <span style="font-size:11px;color:var(--text-muted)">${r.status}</span>
              <button onclick="verDetalheRFQ('${r.id}')" class="btn btn-sm btn-secondary" style="padding:3px 8px;font-size:11px">
                <i class="fas fa-eye"></i> Ver
              </button>
              <button onclick="registrarCotacoes('${r.id}')" class="btn btn-sm" style="padding:3px 8px;font-size:11px;background:#f59e0b;color:#000;border:none;border-radius:5px;cursor:pointer;font-weight:600">
                <i class="fas fa-pencil-alt"></i> Atualizar
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// ── Exportações: navegação e ações principais ──
window.renderRFQ                    = renderRFQ;
window.switchRFQTab                 = switchRFQTab;
window._rfqGetAlertasOciosas        = _rfqGetAlertasOciosas;
window._rfqRenderAlertasOciosas     = _rfqRenderAlertasOciosas;
window.verDetalheRC_RFQ             = verDetalheRC_RFQ;
window.verDetalheRFQ                = verDetalheRFQ;
window.novoProcessoRFQ              = novoProcessoRFQ;
window.exportRFQs                   = exportRFQs;
window.rejeitarRC_Comprador         = rejeitarRC_Comprador;
window._confirmarDevolucaoRC        = _confirmarDevolucaoRC;
window.abrirMatrizComparativa       = abrirMatrizComparativa;
window._procEmitirRCdaOS            = _procEmitirRCdaOS;
// ── Exportações: Selecionar Fornecedores RFQ (autocomplete) ──
window.selecionarFornecedoresRFQ    = selecionarFornecedoresRFQ;
window.salvarFornecedoresRFQ        = salvarFornecedoresRFQ;
window._procEnviarEmailRFQ          = _procEnviarEmailRFQ;
window._procAbrirMailto             = _procAbrirMailto;
window._procMarcarEnviadoSimples    = _procMarcarEnviadoSimples;
window._sfrFiltrarFornecedores      = _sfrFiltrarFornecedores;
window._sfrSelecionarForn           = _sfrSelecionarForn;
window._sfrAdicionarSelecionado     = _sfrAdicionarSelecionado;
window._sfrAdicionarNovo            = _sfrAdicionarNovo;
window._sfrCriarCard                = _sfrCriarCard;
// ── Exportações: Aceitar RC / Iniciar Cotação (autocomplete) ──
window.aceitarRC_Comprador          = aceitarRC_Comprador;
window._acFiltrarFornecedores       = _acFiltrarFornecedores;
window._acSelecionarForn            = _acSelecionarForn;
window._acAdicionarFornSelecionado  = _acAdicionarFornSelecionado;
window._acAdicionarFornNovo         = _acAdicionarFornNovo;
window._acCriarCard                 = _acCriarCard;
window._confirmarAceitarRC          = _confirmarAceitarRC;
// ── Exportações: IA de sugestão de fornecedores ──
window._acGerarSugestoesIA          = _acGerarSugestoesIA;
window._acRenderSugestoes           = _acRenderSugestoes;
window._acAdicionarSugestao         = _acAdicionarSugestao;
// ── Exportações: Emissão de Pedido de Compra (usadas por pedidos.js) ──
window.emitirPedidoRFQ              = emitirPedidoRFQ;
window._pcStep1                     = _pcStep1;
window._pcStep2                     = _pcStep2;
window._pcStep3                     = _pcStep3;
window._pcAvancarStep2              = _pcAvancarStep2;
window._pcAvancarStep3              = _pcAvancarStep3;
window._pcValidarCondPagto          = _pcValidarCondPagto;
window._pcValidarConfirmacao        = _pcValidarConfirmacao;
window._pcSelecionarTipo            = _pcSelecionarTipo;
window._pcEmitirConfirmar           = _pcEmitirConfirmar;
window._pcSelectEnvio               = _pcSelectEnvio;
// ── Exportações: Mapa Comparativo (usadas por pedidos.js e inline onclick) ──
window.aprovarMatriz                = aprovarMatriz;
window.rejeitarMatriz               = rejeitarMatriz;
window.renderMapaCotacao            = renderMapaCotacao;
window.verDetalheMatriz             = verDetalheMatriz;
window.gerarPDFMapa                 = gerarPDFMapa;
window.revisarMapaAprovado          = revisarMapaAprovado;
window.salvarMatrizComparativa      = salvarMatrizComparativa;
window._confirmarRevisaoMapa        = _confirmarRevisaoMapa;
// ── Exportações: RFQ — funções inline onclick ──
window._rfqGerarTextoIA             = _rfqGerarTextoIA;
window.addItemRFQ                   = addItemRFQ;
window.salvarNovoRFQ                = salvarNovoRFQ;
// ── Exportações: RC — funções inline onclick ──
window._confirmarRejeicaoReq        = _confirmarRejeicaoReq;
// ── Exportações: Recebimento ──
window.abrirRecebimento             = abrirRecebimento;
window.gerarCPRecebimento           = gerarCPRecebimento;
window.salvarRecebimento            = salvarRecebimento;
// ── Exportações: Helpers globais (usadas por múltiplos módulos) ──
window._rfqNomeForn                 = _rfqNomeForn;
window._getMatrizes                 = _getMatrizes;
window._saveMatrizes                = _saveMatrizes;
window._getRFQs                     = _getRFQs;
window._saveRFQs                    = _saveRFQs;

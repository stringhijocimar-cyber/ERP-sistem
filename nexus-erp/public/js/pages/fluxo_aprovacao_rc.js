// =====================================================
// Fraser Alexander ERP – Fluxo de Aprovação de Requisições de Compras v2.0
// Módulo: Fluxo Aprovação de Requisições de Compras
// Cobre: OS → Aprovação → Emissão RC → Cotações → Mapa → PO
// =====================================================

// ─── STORAGE HELPERS ──────────────────────────────────────────────────────────
function _getFluxoOS()       { try { return JSON.parse(localStorage.getItem('fa_fluxo_os') || '[]'); } catch(e) { return []; } }
function _saveFluxoOS(d)     { localStorage.setItem('fa_fluxo_os', JSON.stringify(d)); }

// ─── CONFIG DE PERFIS DA ABA OS ───────────────────────────────────────────────
// O admin pode configurar quais perfis têm acesso à aba OS
function _getConfigPerfisOS() {
  try {
    const raw = localStorage.getItem('fa_config_perfis_os');
    if (raw) return JSON.parse(raw);
  } catch(e) {}
  // Default: diretoria + operação + admin
  return { perfis: ['admin', 'diretor', 'operacao', 'supervisor'] };
}
function _saveConfigPerfisOS(cfg) {
  localStorage.setItem('fa_config_perfis_os', JSON.stringify(cfg));
}

// Verifica se o usuário atual pode acessar a aba OS
function _podeAcessarOS() {
  if (!currentUser) return false;
  if (currentUser.profile === 'admin') return true;
  const cfg = _getConfigPerfisOS();
  return (cfg.perfis || []).includes(currentUser.profile);
}

// ─── CONFIG DE PERFIS PARA EMITIR RC ─────────────────────────────────────────
// Perfis que podem abrir uma RC a partir de OS aprovada
function _getConfigPerfisEmissaoRC() {
  try {
    const raw = localStorage.getItem('fa_config_perfis_emissao_rc');
    if (raw) return JSON.parse(raw);
  } catch(e) {}
  // MELHORIA 1: Restrito a compras + admin + diretor por padrão
  return { perfis: ['admin', 'compras', 'diretor'] };
}
function _saveConfigPerfisEmissaoRC(cfg) {
  localStorage.setItem('fa_config_perfis_emissao_rc', JSON.stringify(cfg));
}

function _podeEmitirRC() {
  if (!currentUser) return false;
  if (currentUser.profile === 'admin') return true;
  // MELHORIA 1: Apenas perfil 'compras' pode criar RCs (além de admin)
  // A emissão só é habilitada na aba 'Emissão de Requisições' - não no fluxo de aprovação
  const cfg = _getConfigPerfisEmissaoRC();
  return (cfg.perfis || []).includes(currentUser.profile);
}

// Apenas compras/admin/diretor/supervisor processa RC (cria RFQ, cotação, etc.)
function _podeProcessarRC() {
  if (!currentUser) return false;
  return ['admin','compras','diretor','supervisor'].includes(currentUser.profile);
}

// Re-usa helpers do fluxo_compras.js (já existentes):
// _getRC() / _saveRC()
// _getRFQFlow() / _saveRFQFlow()
// _getMapasComp() / _saveMapasComp()
// _getAprovacaoConfig() / _saveAprovacaoConfig()
// _getConfigAprovacao()

// ─── HELPER INTERNO: salva RC garantindo consistência de chave ────────────────
// Centraliza o fallback local para evitar divergência entre 'fa_rcs' e 'fa_rc'
function _salvarRCLocal(lista) {
  if (typeof _saveRC === 'function') {
    _saveRC(lista); // salva em fa_rcs + fa_rc (compatibilidade)
  } else {
    localStorage.setItem('fa_rcs', JSON.stringify(lista));
    localStorage.setItem('fa_rc',  JSON.stringify(lista));
  }
}
function _obterRCLocal() {
  if (typeof _getRC === 'function') return _getRC();
  try { return JSON.parse(localStorage.getItem('fa_rcs') || localStorage.getItem('fa_rc') || '[]'); } catch(e) { return []; }
}

// ─── HELPERS GERAIS ───────────────────────────────────────────────────────────
function _fmtDate2(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR');
  } catch(e) { return iso; }
}

function _fmtVal(v) {
  if (v === null || v === undefined || isNaN(v)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

function _statusBadgeFluxo(s, extraStyle) {
  const map = {
    'Aguardando Aprovação': { bg: '#f59e0b', label: 'Aguardando Aprovação' },
    'Aguardando Aprovação Hierárquica': { bg: '#dc2626', label: '⚠️ Aguard. Diretoria' },
    'Aprovada – Aguardando Comprador': { bg: '#3b82f6', label: 'Aguard. Comprador' },
    'Aprovada – Trabalho Interno':     { bg: '#10b981', label: 'Aprovada · Interno' },
    'Em Cotação': { bg: '#6366f1', label: 'Em Cotação' },
    'RFQ Criado': { bg: '#0ea5e9', label: 'RFQ Criado' },
    'Cotações Recebidas': { bg: '#8b5cf6', label: 'Cotações Recebidas' },
    'Mapa Criado': { bg: '#7c3aed', label: 'Mapa Criado' },
    'Mapa Aprovado': { bg: '#10b981', label: 'Mapa Aprovado' },
    'PC Emitido': { bg: '#22c55e', label: 'PC Emitido' },
    'Rejeitada': { bg: '#ef4444', label: 'Rejeitada' },
    'Rascunho': { bg: '#8b949e', label: 'Rascunho' },
    'Itens Novos – Reaprovação': { bg: '#f97316', label: 'Itens Novos – Reaprovação' },
    'Cancelada': { bg: '#6b7280', label: 'Cancelada' },
  };
  const c = map[s] || { bg: '#8b949e', label: s };
  return `<span style="background:${c.bg}22;color:${c.bg};border-radius:6px;padding:3px 8px;font-size:10px;font-weight:700;white-space:nowrap;${extraStyle||''}">${c.label}</span>`;
}

// Obtém score do fornecedor do módulo de avaliação
function _getScoreFornecedor(nomeOuId) {
  try {
    // Primeiro verifica dados do IDF (score 0-100 → converte para 1-5)
    const idfAll = JSON.parse(localStorage.getItem('fa_idf_avaliacoes') || '[]');
    const idfForn = idfAll.filter(a => a.fornecedor === nomeOuId || a.fornecedor_id === nomeOuId);
    if (idfForn.length) {
      // Usa a última avaliação IDF para o score principal
      const ultima = idfForn.sort((a,b) => (b.ts||0)-(a.ts||0))[0];
      const scoreIDF = ultima.score || 0;
      // Converte IDF (0-100) para escala 1-5 para compatibilidade
      const media15 = parseFloat(((scoreIDF / 100) * 5).toFixed(1));
      return {
        media: media15,
        total: idfForn.length,
        score_idf: scoreIDF,
        classificacao_idf: ultima.classificacao || '',
        fonte: 'IDF'
      };
    }
    // Fallback: avaliação simples (fa_avaliacoes_forn)
    const avals = JSON.parse(localStorage.getItem('fa_avaliacoes_forn') || '[]');
    const avForn = avals.filter(a =>
      a.fornecedor === nomeOuId || a.fornecedor_id === nomeOuId
    );
    if (!avForn.length) return null;
    const media = avForn.reduce((s, a) => s + (a.nota_geral || 0), 0) / avForn.length;
    return { media: parseFloat(media.toFixed(1)), total: avForn.length, fonte: 'Avaliação' };
  } catch(e) { return null; }
}

function _renderScoreForn(nomeOuId) {
  const score = _getScoreFornecedor(nomeOuId);
  if (!score) return `<span style="color:var(--text-muted);font-size:11px">Não avaliado</span>`;
  const cor = score.media >= 4 ? '#22c55e' : score.media >= 3 ? '#f59e0b' : '#ef4444';
  const stars = Math.round(score.media);
  const starsHtml = '★'.repeat(stars) + '☆'.repeat(5 - stars);
  // Se tem score IDF, mostra também
  if (score.score_idf !== undefined) {
    return `<span style="color:${cor};font-size:11px;font-weight:700">${starsHtml} ${score.media}/5
      <span style="color:var(--text-muted);font-weight:400"> · IDF: <strong style="color:${cor}">${score.score_idf.toFixed(1)}</strong> <em style="font-size:10px">${score.classificacao_idf||''}</em></span></span>`;
  }
  return `<span style="color:${cor};font-size:11px;font-weight:700">${starsHtml} ${score.media}/5 <span style="color:var(--text-muted);font-weight:400">(${score.total} aval.)</span></span>`;
}

// ─── SINCRONIZA OS COM FLUXO ────────────────────────────────────────────────
// Chamada sempre que uma OS é criada ou editada.
// TODA OS entra no fluxo independente de ter ou não itens de compra.
// OS de trabalho interno (sem material/serviço externo) seguem aprovação
// simplificada e, após aprovadas, ficam como "Aprovada – Trabalho Interno"
// (sem necessidade de emitir RC/RFQ).
function _sincronizarOSnoFluxo(os, motivo) {
  const fluxo = _getFluxoOS();
  const idx = fluxo.findIndex(f => f.os_id === os.id);
  const hoje = new Date().toISOString();
  const cfg = _getConfigAprovacao();

  // Determina se OS requer compra/serviço externo
  const temCompraExterna = !!(
    os.precisa_compra || os.precisa_servico ||
    (os.itens_compra && os.itens_compra.length > 0)
  );

  if (idx >= 0) {
    // OS já existe no fluxo → verifica se houve adição de itens novos
    const anterior = fluxo[idx];
    const itensAnteriores = anterior.itens || [];
    const itensNovos = (os.itens_compra || []).filter(ni =>
      !itensAnteriores.some(ia => ia.descricao === ni.descricao)
    );

    if (itensNovos.length > 0) {
      // ── Reaprovação: mantém itens já aprovados, adiciona novos como Aguardando ──
      // Preserva itens anteriores (com seus status atuais)
      const itensAtualizados = itensAnteriores.map(ia => ({ ...ia, novo: false }));
      itensNovos.forEach(ni => {
        itensAtualizados.push({
          ...ni,
          status_item: 'Aguardando Aprovação',
          novo: true,
          adicionado_em: hoje
        });
      });

      // Reinicia o fluxo de aprovação: zera os estágios anteriores (nova rodada)
      // mas PRESERVA o histórico de aprovações anteriores para auditoria
      fluxo[idx].itens = itensAtualizados;
      fluxo[idx].status = 'Itens Novos – Reaprovação';
      fluxo[idx].estagio_atual = 1;
      fluxo[idx].estagios_aprovacao = [];  // zera – nova rodada de aprovação para os itens novos
      fluxo[idx].atualizado_em = hoje;
      fluxo[idx].tem_compra_externa = temCompraExterna;
      fluxo[idx].historico = fluxo[idx].historico || [];
      fluxo[idx].historico.unshift({
        acao: `⚠️ ${itensNovos.length} novo(s) item(ns) adicionado(s) → fluxo de aprovação reiniciado (Estágio 1)`,
        usuario: currentUser?.name || 'Sistema',
        data: new Date().toLocaleString('pt-BR')
      });
      if (motivo) fluxo[idx].motivo_edicao = motivo;
    } else {
      // Edição sem novos itens → apenas atualiza dados gerais
      fluxo[idx].os_descricao = os.descricao;
      fluxo[idx].os_contrato  = os.contrato;
      fluxo[idx].tem_compra_externa = temCompraExterna;
      fluxo[idx].atualizado_em = hoje;
    }
    _saveFluxoOS(fluxo);
  } else {
    // Nova OS → cria entrada no fluxo
    const itens = (os.itens_compra || []).map(it => ({
      ...it,
      status_item: 'Aguardando Aprovação',
      novo: false,
      adicionado_em: hoje
    }));

    // OS de trabalho interno: sem itens de compra, adiciona marcador especial
    const ehTrabalhoInterno = !temCompraExterna;

    const novaEntrada = {
      id: typeof gerarId === 'function' ? gerarId('FOS') : 'FOS-' + Date.now(),
      os_id: os.id,
      os_descricao: os.descricao,
      os_contrato: os.contrato || 'Geral',
      os_tipo: os.tipo || 'Preventiva',
      os_tipo_compra: os.tipo_compra || (temCompraExterna ? 'Material' : 'Trabalho Interno'),
      tem_compra_externa: temCompraExterna,
      trabalho_interno: ehTrabalhoInterno,
      criado_por: currentUser?.name || 'Sistema',
      criado_em: hoje,
      atualizado_em: hoje,
      status: 'Aguardando Aprovação',
      estagio_atual: 1,
      total_estagios: 3,
      estagios_aprovacao: [],
      itens,
      rcs_geradas: [],
      historico: [{
        acao: ehTrabalhoInterno
          ? 'OS de trabalho interno inserida no fluxo de aprovação'
          : 'OS inserida no fluxo de aprovação',
        usuario: currentUser?.name || 'Sistema',
        data: new Date().toLocaleString('pt-BR')
      }]
    };

    fluxo.unshift(novaEntrada);
    _saveFluxoOS(fluxo);
  }
}

// Hook: chamado pelo os.js após salvar OS (nova ou editada)
// REGRA: TODA OS entra no fluxo de aprovação.
// OS com compra/serviço externo seguem o fluxo completo (Aprovação → RC → RFQ → PO).
// OS de trabalho interno (sem material/serviço externo) seguem aprovação simplificada.
function _notificarOSParaFluxo(os, motivo) {
  if (!os) return;
  // Sempre sincroniza – independente de ter ou não itens de compra
  _sincronizarOSnoFluxo(os, motivo || '');
  logAction && logAction('Fluxo Compras', 'OS', `OS ${os.id} inserida/atualizada no fluxo de aprovação`);
}

// ─── AUTO-SINCRONIZA OS EXISTENTES QUE PRECISAM DE COMPRA MAS NÃO ESTÃO NO FLUXO ───
function _farcAutoSincronizarOS() {
  try {
    const osLista = JSON.parse(localStorage.getItem('fa_os_list') || '[]');
    const fluxo   = _getFluxoOS();
    const idsNoFluxo = new Set(fluxo.map(f => f.os_id));
    let sincronizadas = 0;

    osLista.forEach(os => {
      // TODA OS entra no fluxo (incluindo trabalho interno)
      if (!idsNoFluxo.has(os.id)) {
        _sincronizarOSnoFluxo(os, 'Sincronização automática');
        sincronizadas++;
      }
    });

    if (sincronizadas > 0) {
      console.log(`[Fluxo RC] ${sincronizadas} OS sincronizada(s) automaticamente no fluxo.`);
    }
  } catch(e) {
    console.warn('[Fluxo RC] Erro na auto-sincronização:', e);
  }
}

// Sincronização manual (botão)
function farcSincronizarOSManual() {
  try {
    const osLista = JSON.parse(localStorage.getItem('fa_os_list') || '[]');
    const fluxo   = _getFluxoOS();
    const idsNoFluxo = new Set(fluxo.map(f => f.os_id));
    let sincronizadas = 0;

    osLista.forEach(os => {
      // TODA OS entra no fluxo (incluindo trabalho interno)
      if (!idsNoFluxo.has(os.id)) {
        _sincronizarOSnoFluxo(os, 'Sincronização manual');
        sincronizadas++;
      }
    });

    if (sincronizadas > 0) {
      showToast(`✅ ${sincronizadas} OS importada(s) para o fluxo de aprovação!`, 'success', 5000);
    } else {
      showToast('Todas as OS já estão no fluxo. Nenhuma pendente de sincronização.', 'info', 4000);
    }
    renderFluxoAprovacaoRC();
  } catch(e) {
    showToast('Erro ao sincronizar OS.', 'error');
  }
}

// ─── SEED DE DEMONSTRAÇÃO ─────────────────────────────────────────────────────
// Garante OS de demo: uma em aprovação normal e uma em reaprovação (itens novos)
function _farcSeedDemo() {
  const fluxo = _getFluxoOS();
  const hoje  = new Date().toISOString();
  const hojeFmt = new Date().toLocaleString('pt-BR');
  let changed = false;

  // ── Demo 1: OS aguardando aprovação normal ──────────────────────────────────
  if (!fluxo.some(f => f.os_id === 'OS-DEMO-APR-001')) {
    fluxo.unshift({
      id:                 'fdemo_apr_001',
      os_id:              'OS-DEMO-APR-001',
      os_descricao:       'Britagem – Reposição de peças e materiais (DEMO)',
      os_contrato:        'Contrato Geral',
      os_tipo_compra:     'Material',
      criado_por:         'Sistema Demo',
      criado_em:          hoje,
      atualizado_em:      hoje,
      status:             'Aguardando Aprovação',
      estagio_atual:      1,
      total_estagios:     3,
      estagios_aprovacao: [],
      itens: [
        { descricao: 'Correia transportadora 600mm', qtd: 2, unidade: 'Un',  valor_unit: 850,  status_item: 'Aguardando Aprovação', novo: false, adicionado_em: hoje },
        { descricao: 'Óleo lubrificante 20L',        qtd: 5, unidade: 'Lata',valor_unit: 120,  status_item: 'Aguardando Aprovação', novo: false, adicionado_em: hoje },
        { descricao: 'Rolamento 6208-ZZ',            qtd: 4, unidade: 'Un',  valor_unit: 48,   status_item: 'Aguardando Aprovação', novo: false, adicionado_em: hoje },
      ],
      rcs_geradas: [],
      _demo: true,
      historico: [{ acao: 'OS inserida no fluxo de aprovação (demo)', usuario: 'Sistema', data: hojeFmt }]
    });
    changed = true;
  }

  // ── Demo 2: OS com itens novos → reaprovação ───────────────────────────────
  if (!fluxo.some(f => f.os_id === 'OS-DEMO-REAPR-001')) {
    fluxo.unshift({
      id:                 'fdemo_reapr_001',
      os_id:              'OS-DEMO-REAPR-001',
      os_descricao:       'Mobilização pessoal – Britagem (DEMO – reaprovação)',
      os_contrato:        'Contrato Operações',
      os_tipo_compra:     'Serviço Externo',
      criado_por:         'Sistema Demo',
      criado_em:          hoje,
      atualizado_em:      hoje,
      status:             'Itens Novos – Reaprovação',
      estagio_atual:      1,
      total_estagios:     3,
      estagios_aprovacao: [],
      motivo_edicao:      'Adicionado EPI Kit completo após aprovação inicial',
      itens: [
        { descricao: 'Contratação operador de britagem', qtd: 2, unidade: 'Un', valor_unit: 4500, status_item: 'Aprovado',              novo: false, adicionado_em: hoje },
        { descricao: 'Consulta admissional',             qtd: 2, unidade: 'Un', valor_unit: 180,  status_item: 'Aprovado',              novo: false, adicionado_em: hoje },
        { descricao: 'EPI – Kit completo operador',      qtd: 4, unidade: 'Kit',valor_unit: 350,  status_item: 'Aguardando Aprovação',  novo: true,  adicionado_em: hoje },
      ],
      rcs_geradas: [],
      _demo: true,
      historico: [
        { acao: '⚠️ 1 novo item adicionado → fluxo de aprovação reiniciado (Estágio 1)', usuario: 'Sistema Demo', data: hojeFmt },
        { acao: 'Estágio 2 aprovado (aprovação original) por Gestor Demo',               usuario: 'Gestor Demo',  data: hojeFmt },
        { acao: 'Estágio 1 aprovado (aprovação original) por Supervisor Demo',           usuario: 'Supervisor Demo', data: hojeFmt },
        { acao: 'OS inserida no fluxo de aprovação (demo)',                              usuario: 'Sistema',      data: hojeFmt },
      ]
    });
    changed = true;
  }

  if (changed) _saveFluxoOS(fluxo);

  // ── Demo 3: RC aprovada aguardando comprador (aparece na aba Cotações RFQ) ──
  try {
    const itensDemo = [
      { descricao: 'Correia transportadora 600mm', qtd: 2, unidade: 'Un',   valor_unit: 850,  tipo_item: 'material', status_item: 'Aprovado' },
      { descricao: 'Óleo lubrificante 20L',        qtd: 5, unidade: 'Lata', valor_unit: 120,  tipo_item: 'material', status_item: 'Aprovado' },
      { descricao: 'Rolamento 6208-ZZ',            qtd: 4, unidade: 'Un',   valor_unit: 48,   tipo_item: 'material', status_item: 'Aprovado' }
    ];
    // Recria se não existe ou se está sem valor_total (versão antiga)
    let rcs = _obterRCLocal();
    const existeOk = rcs.find(r => r.id === 'rc_demo_cotacao_001' && r.valor_total);
    if (!existeOk) {
      rcs = rcs.filter(r => r.id !== 'rc_demo_cotacao_001');
      rcs.unshift({
        id:            'rc_demo_cotacao_001',
        numero:        'RC-' + new Date().getFullYear() + '-DEMO1',
        titulo:        'Materiais de britagem – Reposição urgente (DEMO)',
        os_id:         'OS-DEMO-APR-001',
        os_vinculada:  'OS-DEMO-APR-001',
        contrato:      'Contrato Geral',
        solicitante:   'Supervisor Demo',
        departamento:  'Manutenção',
        data_abertura: new Date().toLocaleDateString('pt-BR'),
        data_criacao:  new Date().toISOString(),
        status:        'Aprovada – Aguardando Comprador',
        estagio_atual: 4,
        criado_por:    'Supervisor Demo',
        criado_em:     new Date().toLocaleDateString('pt-BR'),
        itens:         itensDemo,
        valor_total:   itensDemo.reduce((s,i) => s + (i.qtd * i.valor_unit), 0),
        historico: [{ acao: 'RC aprovada – aguardando Comprador iniciar cotação', usuario: 'Sistema', data: new Date().toLocaleString('pt-BR') }],
        _demo: true
      });
      _salvarRCLocal(rcs);
    }
  } catch(e) {}
}

// ─── RENDER PRINCIPAL ─────────────────────────────────────────────────────────
function renderFluxoAprovacaoRC() {
  const perfisPermitidos = ['admin','compras','diretor','operacao','supervisor'];
  if (!currentUser || !perfisPermitidos.includes(currentUser.profile)) {
    typeof renderAcessoNegado === 'function' && renderAcessoNegado();
    return;
  }

  _farcSeedDemo();
  _farcAutoSincronizarOS();

  // Verifica prazos de aprovação hierárquica ao renderizar (alerta se > 15 dias úteis)
  setTimeout(() => { if (typeof _farcVerificarPrazoHierarquico === 'function') _farcVerificarPrazoHierarquico(); }, 200);
  const fluxoOS  = _getFluxoOS();
  const rcs      = _obterRCLocal();
  const rfqs     = typeof _getRFQFlow === 'function' ? _getRFQFlow() : [];
  const mapas    = typeof _getMapasComp === 'function' ? _getMapasComp() : [];
  const pedidos  = typeof _getPedidos === 'function' ? _getPedidos() : [];
  const cfg      = _getConfigAprovacao();

  const pendAprv   = fluxoOS.filter(f => f.status === 'Aguardando Aprovação' || f.status === 'Itens Novos – Reaprovação').length;
  const reaprovacao= fluxoOS.filter(f => f.status === 'Itens Novos – Reaprovação').length;
  const aprovadas  = fluxoOS.filter(f => f.status === 'Aprovada' || f.status === 'Aprovada – Aguardando Comprador' || f.status === 'Aprovada – Trabalho Interno').length;
  const aprovInterno = fluxoOS.filter(f => f.status === 'Aprovada – Trabalho Interno').length;
  const rcAguardAprov = rcs.filter(r => r.status === 'Aguardando Aprovação').length;
  const rcAguardHierarq = rcs.filter(r => r.status === 'Aguardando Aprovação Hierárquica').length;
  const rejeitadas = fluxoOS.filter(f => f.status === 'Rejeitada').length;
  const rcComprad  = rcs.filter(r => r.status === 'Aprovada – Aguardando Comprador').length;
  const rfqAberto  = rfqs.filter(r => ['Aguardando Envio','Em Cotação','Aguardando Cotações','Cotações Recebidas','Negociando'].includes(r.status)).length;
  const mapaPend   = mapas.filter(m => m.status === 'Aguardando Aprovação').length;
  const pcPend     = pedidos.filter(p => p.status === 'Pendente' || p.status === 'Emitido').length;
  const isAdmin    = currentUser.profile === 'admin';

  // OS que o usuário atual pode aprovar agora
  const podeAprovarAgora = fluxoOS.filter(f => _farcPodeAprovarOS(f));

  const osAguardando = fluxoOS.filter(f =>
    f.status === 'Aguardando Aprovação' || f.status === 'Itens Novos – Reaprovação'
  );
  const osEmProcesso = fluxoOS.filter(f =>
    !['Aguardando Aprovação','Itens Novos – Reaprovação'].includes(f.status)
  );

  document.getElementById('mainContent').innerHTML = `
    <div class="page-header">
      <div class="page-title">
        <h2><i class="fas fa-clipboard-check" style="color:var(--fa-teal);margin-right:8px"></i>Aprovação de OS</h2>
        <p>Aprove ou rejeite Ordens de Serviço — apenas aprovadores autorizados podem atuar nesta tela</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary btn-sm" onclick="farcSincronizarOSManual()" title="Importa OS com itens de compra">
          <i class="fas fa-sync-alt"></i> Sincronizar OS
        </button>
        ${isAdmin ? `<button class="btn btn-secondary btn-sm" onclick="farcAbrirConfigAprovacao()"><i class="fas fa-cog"></i> Configurações</button>` : ''}
      </div>
    </div>

    <!-- ══ BANNER DE ATENÇÃO: ações pendentes para o usuário ══ -->
    ${podeAprovarAgora.length > 0 ? `
      <div style="background:linear-gradient(135deg,rgba(245,158,11,0.18),rgba(245,158,11,0.08));border:2px solid rgba(245,158,11,0.5);border-radius:12px;padding:14px 20px;margin-bottom:20px;display:flex;align-items:center;gap:16px;flex-wrap:wrap">
        <div style="width:44px;height:44px;background:#f59e0b;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 4px 12px rgba(245,158,11,0.4)">
          <i class="fas fa-bell" style="color:#fff;font-size:20px"></i>
        </div>
        <div style="flex:1;min-width:200px">
          <div style="font-size:14px;font-weight:800;color:#d97706">
            Você tem ${podeAprovarAgora.length} OS aguardando sua aprovação
          </div>
          <div style="font-size:12px;color:var(--text-secondary);margin-top:2px">
            ${podeAprovarAgora.map(f => `<span style="background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.3);border-radius:4px;padding:1px 7px;font-size:11px;font-weight:600;margin-right:4px;color:#d97706">${f.os_id}</span>`).join('')}
          </div>
        </div>
        <button onclick="_farcFiltroOS('pendentes')" class="btn btn-sm" style="background:#f59e0b;color:#fff;border:none;padding:8px 16px;font-weight:700">
          <i class="fas fa-check-circle" style="margin-right:5px"></i>Revisar e Aprovar
        </button>
      </div>
    ` : ''}

    <!-- ══ BANNER: RCs avulsas aguardando aprovação ══ -->
    ${rcAguardAprov > 0 && _podeProcessarRC() ? `
      <div style="background:linear-gradient(135deg,rgba(59,130,246,0.15),rgba(59,130,246,0.06));border:2px solid rgba(59,130,246,0.4);border-radius:12px;padding:14px 20px;margin-bottom:20px;display:flex;align-items:center;gap:16px;flex-wrap:wrap">
        <div style="width:44px;height:44px;background:#3b82f6;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 4px 12px rgba(59,130,246,0.35)">
          <i class="fas fa-file-alt" style="color:#fff;font-size:20px"></i>
        </div>
        <div style="flex:1;min-width:200px">
          <div style="font-size:14px;font-weight:800;color:#2563eb">
            ${rcAguardAprov} RC(s) aguardando sua aprovação
          </div>
          <div style="font-size:12px;color:var(--text-secondary);margin-top:2px">
            Acesse a aba <strong>Emissão de Requisições</strong> para aprovar as RCs pendentes.
          </div>
        </div>
        <button onclick="farcSwitchTab('emissao')" class="btn btn-sm" style="background:#3b82f6;color:#fff;border:none;padding:8px 16px;font-weight:700">
          <i class="fas fa-check-circle" style="margin-right:5px"></i>Revisar RCs
        </button>
      </div>
    ` : ''}

    <!-- ══ BANNER: RCs aguardando aprovação HIERÁRQUICA (> R$50.000) ══ -->
    ${rcAguardHierarq > 0 && ['admin','diretor'].includes(currentUser.profile) ? `
      <div style="background:linear-gradient(135deg,rgba(220,38,38,0.13),rgba(220,38,38,0.05));border:2px solid rgba(220,38,38,0.45);border-radius:12px;padding:14px 20px;margin-bottom:20px;display:flex;align-items:center;gap:16px;flex-wrap:wrap">
        <div style="width:44px;height:44px;background:#dc2626;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 4px 12px rgba(220,38,38,0.4)">
          <i class="fas fa-exclamation-triangle" style="color:#fff;font-size:20px"></i>
        </div>
        <div style="flex:1;min-width:200px">
          <div style="font-size:14px;font-weight:800;color:#b91c1c">
            ${rcAguardHierarq} RC(s) aguardando aprovação hierárquica (valor &gt; R$ 50.000)
          </div>
          <div style="font-size:12px;color:var(--text-secondary);margin-top:2px">
            Estas RCs exigem <strong>aprovação da Diretoria</strong> antes de ir para cotação. Prazo máximo: <strong>15 dias úteis</strong>.
          </div>
        </div>
        <button onclick="farcSwitchTab('emissao')" class="btn btn-sm" style="background:#dc2626;color:#fff;border:none;padding:8px 16px;font-weight:700">
          <i class="fas fa-gavel" style="margin-right:5px"></i>Aprovar Hierarquicamente
        </button>
      </div>
    ` : ''}

    <!-- ══ KPIs RESUMO ══ -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:20px">

      <div style="background:var(--bg-card2);border-radius:12px;padding:14px 16px;border:1px solid rgba(245,158,11,0.3);cursor:pointer;transition:.2s" onclick="_farcFiltroOS('pendentes')"
        onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 6px 20px rgba(245,158,11,0.18)'"
        onmouseout="this.style.transform='';this.style.boxShadow=''">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <div style="width:36px;height:36px;background:rgba(245,158,11,0.15);border-radius:8px;display:flex;align-items:center;justify-content:center">
            <i class="fas fa-hourglass-half" style="color:#f59e0b;font-size:15px"></i>
          </div>
          <span style="font-size:26px;font-weight:800;color:#f59e0b">${pendAprv}</span>
        </div>
        <div style="font-size:11px;font-weight:700;color:var(--text-secondary)">Aguardando Aprovação</div>
        ${reaprovacao > 0 ? `<div style="font-size:10px;color:#f97316;margin-top:3px"><i class="fas fa-exclamation-circle" style="margin-right:3px"></i>${reaprovacao} reaprovação</div>` : ''}
      </div>

      <div style="background:var(--bg-card2);border-radius:12px;padding:14px 16px;border:1px solid rgba(34,197,94,0.3);cursor:pointer;transition:.2s" onclick="_farcFiltroOS('aprovadas')"
        onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 6px 20px rgba(34,197,94,0.15)'"
        onmouseout="this.style.transform='';this.style.boxShadow=''">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <div style="width:36px;height:36px;background:rgba(34,197,94,0.15);border-radius:8px;display:flex;align-items:center;justify-content:center">
            <i class="fas fa-check-circle" style="color:#22c55e;font-size:15px"></i>
          </div>
          <span style="font-size:26px;font-weight:800;color:#22c55e">${aprovadas}</span>
        </div>
        <div style="font-size:11px;font-weight:700;color:var(--text-secondary)">OS Aprovadas</div>
        <div style="font-size:10px;color:var(--text-muted);margin-top:3px">${rcComprad} aguard. emissão RC${aprovInterno > 0 ? ` · ${aprovInterno} trabalho interno` : ''}</div>
      </div>

      <div style="background:var(--bg-card2);border-radius:12px;padding:14px 16px;border:1px solid rgba(239,68,68,0.25);cursor:pointer;transition:.2s" onclick="_farcFiltroOS('rejeitadas')"
        onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 6px 20px rgba(239,68,68,0.12)'"
        onmouseout="this.style.transform='';this.style.boxShadow=''">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <div style="width:36px;height:36px;background:rgba(239,68,68,0.12);border-radius:8px;display:flex;align-items:center;justify-content:center">
            <i class="fas fa-times-circle" style="color:#ef4444;font-size:15px"></i>
          </div>
          <span style="font-size:26px;font-weight:800;color:#ef4444">${rejeitadas}</span>
        </div>
        <div style="font-size:11px;font-weight:700;color:var(--text-secondary)">Rejeitadas</div>
        <div style="font-size:10px;color:var(--text-muted);margin-top:3px">Revisão necessária</div>
      </div>

      <div style="background:var(--bg-card2);border-radius:12px;padding:14px 16px;border:1px solid rgba(59,130,246,0.3);cursor:pointer;transition:.2s" onclick="navigate('requisicoes')"
        onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 6px 20px rgba(59,130,246,0.15)'"
        onmouseout="this.style.transform='';this.style.boxShadow=''">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <div style="width:36px;height:36px;background:rgba(59,130,246,0.15);border-radius:8px;display:flex;align-items:center;justify-content:center">
            <i class="fas fa-file-alt" style="color:#3b82f6;font-size:15px"></i>
          </div>
          <span style="font-size:26px;font-weight:800;color:#3b82f6">${rcComprad}</span>
        </div>
        <div style="font-size:11px;font-weight:700;color:var(--text-secondary)">RC Aguard. Emissão</div>
        <div style="font-size:10px;color:#3b82f6;margin-top:3px"><i class="fas fa-external-link-alt" style="font-size:9px;margin-right:3px"></i>Ir para Requisições</div>
      </div>

      <div style="background:var(--bg-card2);border-radius:12px;padding:14px 16px;border:1px solid rgba(99,102,241,0.3);cursor:pointer;transition:.2s" onclick="navigate('rfq')"
        onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 6px 20px rgba(99,102,241,0.15)'"
        onmouseout="this.style.transform='';this.style.boxShadow=''">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <div style="width:36px;height:36px;background:rgba(99,102,241,0.15);border-radius:8px;display:flex;align-items:center;justify-content:center">
            <i class="fas fa-paper-plane" style="color:#6366f1;font-size:15px"></i>
          </div>
          <span style="font-size:26px;font-weight:800;color:#6366f1">${rfqAberto}</span>
        </div>
        <div style="font-size:11px;font-weight:700;color:var(--text-secondary)">RFQs em Aberto</div>
        <div style="font-size:10px;color:#6366f1;margin-top:3px"><i class="fas fa-external-link-alt" style="font-size:9px;margin-right:3px"></i>Ir para Cotações</div>
      </div>

      <div style="background:var(--bg-card2);border-radius:12px;padding:14px 16px;border:1px solid rgba(139,92,246,0.3);cursor:pointer;transition:.2s" onclick="navigate('mapa_cotacao')"
        onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 6px 20px rgba(139,92,246,0.15)'"
        onmouseout="this.style.transform='';this.style.boxShadow=''">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <div style="width:36px;height:36px;background:rgba(139,92,246,0.15);border-radius:8px;display:flex;align-items:center;justify-content:center">
            <i class="fas fa-balance-scale" style="color:#8b5cf6;font-size:15px"></i>
          </div>
          <span style="font-size:26px;font-weight:800;color:#8b5cf6">${mapaPend}</span>
        </div>
        <div style="font-size:11px;font-weight:700;color:var(--text-secondary)">Mapas p/ Aprovar</div>
        <div style="font-size:10px;color:#8b5cf6;margin-top:3px"><i class="fas fa-external-link-alt" style="font-size:9px;margin-right:3px"></i>Ir para Mapas</div>
      </div>

    </div>

    <!-- ══ PIPELINE VISUAL COMPACTO ══ -->
    <div class="card" style="margin-bottom:20px">
      <div style="padding:14px 20px 6px;display:flex;align-items:center;gap:8px">
        <i class="fas fa-project-diagram" style="color:var(--fa-teal);font-size:13px"></i>
        <span style="font-size:11px;font-weight:700;color:var(--text-muted);letter-spacing:1px;text-transform:uppercase">Pipeline do Processo de Compras</span>
      </div>
      <div style="padding:10px 20px 18px;overflow-x:auto">
        <div style="display:flex;align-items:center;min-width:640px;gap:0">
          ${[
            { step:1, icon:'fa-clipboard-list', label:'OS + Demanda', color:'#64748b', count:fluxoOS.length, nav:null },
            { step:2, icon:'fa-user-check',     label:'Aprovação',    color:'#f59e0b', count:pendAprv,      nav:null },
            { step:3, icon:'fa-file-alt',        label:'Emissão RC',   color:'#3b82f6', count:rcComprad,     nav:'requisicoes' },
            { step:4, icon:'fa-paper-plane',     label:'RFQ / Cotação',color:'#6366f1', count:rfqAberto,     nav:'rfq' },
            { step:5, icon:'fa-balance-scale',   label:'Mapa Comp.',   color:'#8b5cf6', count:mapaPend,      nav:'mapa_cotacao' },
            { step:6, icon:'fa-shopping-bag',    label:'Pedido (PC)',  color:'#22c55e', count:pcPend,        nav:'pedidos' }
          ].map((s, i, arr) => {
            const hasCount = s.count > 0;
            const isLast   = i === arr.length - 1;
            return `
              <div style="display:flex;align-items:center;flex:1">
                <div style="flex:1;text-align:center;cursor:${s.nav?'pointer':'default'}"
                  ${s.nav ? `onclick="navigate('${s.nav}')" title="Ir para ${s.label}"` : ''}>
                  <div style="position:relative;display:inline-block">
                    <div style="width:44px;height:44px;background:${hasCount?s.color+'20':'var(--bg-secondary)'};border:2px solid ${hasCount?s.color:'var(--border-color)'};border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 6px;transition:transform .2s"
                      ${s.nav ? `onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform=''"` : ''}>
                      <i class="fas ${s.icon}" style="color:${hasCount?s.color:'var(--text-muted)'};font-size:15px"></i>
                    </div>
                    ${hasCount ? `<div style="position:absolute;top:-6px;right:-6px;background:${s.color};color:#fff;border-radius:10px;padding:1px 5px;font-size:9px;font-weight:800;min-width:16px;text-align:center;box-shadow:0 2px 6px ${s.color}66">${s.count}</div>` : ''}
                  </div>
                  <div style="font-size:9px;font-weight:700;color:${hasCount?s.color:'var(--text-muted)'};line-height:1.3">${s.label}</div>
                </div>
                ${!isLast ? `<div style="flex-shrink:0;width:20px;text-align:center;color:var(--text-muted);font-size:12px;margin-top:-14px">›</div>` : ''}
              </div>`;
          }).join('')}
        </div>
      </div>
    </div>

    <!-- ══ LISTA DE OS ══ -->
    <div class="card">
      <!-- Cabeçalho com filtros -->
      <div style="padding:16px 20px;border-bottom:1px solid var(--border-color);display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <div style="flex:1;min-width:180px">
          <div style="font-size:14px;font-weight:700;color:var(--text-primary)">
            <i class="fas fa-clipboard-list" style="color:#f59e0b;margin-right:7px"></i>
            Ordens de Serviço no Fluxo
          </div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${fluxoOS.length} OS cadastradas · Filtre abaixo</div>
        </div>
        <!-- Pills de filtro -->
        <div style="display:flex;gap:6px;flex-wrap:wrap" id="farc-filtros-bar">
          <button onclick="_farcFiltroOS('pendentes')" id="farc-filt-pend"
            style="padding:5px 13px;border:1.5px solid #f59e0b;border-radius:20px;background:rgba(245,158,11,0.12);color:#f59e0b;font-size:11px;font-weight:700;cursor:pointer;transition:.15s">
            <i class="fas fa-hourglass-half" style="margin-right:4px"></i>Pendentes (${pendAprv})
          </button>
          <button onclick="_farcFiltroOS('aprovadas')" id="farc-filt-aprov"
            style="padding:5px 13px;border:1.5px solid var(--border-color);border-radius:20px;background:transparent;color:var(--text-secondary);font-size:11px;cursor:pointer;transition:.15s">
            <i class="fas fa-check-circle" style="margin-right:4px"></i>Aprovadas (${aprovadas})
          </button>
          <button onclick="_farcFiltroOS('rejeitadas')" id="farc-filt-rej"
            style="padding:5px 13px;border:1.5px solid var(--border-color);border-radius:20px;background:transparent;color:var(--text-secondary);font-size:11px;cursor:pointer;transition:.15s">
            <i class="fas fa-times-circle" style="margin-right:4px"></i>Rejeitadas (${rejeitadas})
          </button>
          <button onclick="_farcFiltroOS('todos')" id="farc-filt-todos"
            style="padding:5px 13px;border:1.5px solid var(--border-color);border-radius:20px;background:transparent;color:var(--text-secondary);font-size:11px;cursor:pointer;transition:.15s">
            <i class="fas fa-list" style="margin-right:4px"></i>Todas (${fluxoOS.length})
          </button>
        </div>
        <!-- Campo de busca -->
        <div style="position:relative">
          <i class="fas fa-search" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:12px"></i>
          <input id="farc-busca" type="text" placeholder="Buscar OS, contrato..."
            style="padding:6px 10px 6px 30px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:12px;width:180px"
            oninput="_farcBuscarOS(this.value)">
        </div>
      </div>

      <!-- Lista de OS -->
      <div id="farc-os-lista" style="padding:16px 20px">
        ${_farcListaOSAprovacao(osAguardando, osEmProcesso, 'pendentes')}
      </div>
    </div>
  `;
}

// ── Filtra a lista de OS inline ────────────────────────────────────────────────
function _farcFiltroOS(modo) {
  window._farcFiltroAtual = modo;
  const fluxoOS    = _getFluxoOS();
  const busca      = document.getElementById('farc-busca')?.value?.toLowerCase() || '';
  _farcRenderOSFiltrada(fluxoOS, modo, busca);
  // Atualiza estilo dos botões
  const btns = {
    pendentes:  document.getElementById('farc-filt-pend'),
    aprovadas:  document.getElementById('farc-filt-aprov'),
    rejeitadas: document.getElementById('farc-filt-rej'),
    todos:      document.getElementById('farc-filt-todos')
  };
  Object.entries(btns).forEach(([key, btn]) => {
    if (!btn) return;
    const active = key === modo;
    const colors = {
      pendentes:  { border:'#f59e0b', bg:'rgba(245,158,11,0.15)', color:'#f59e0b' },
      aprovadas:  { border:'#22c55e', bg:'rgba(34,197,94,0.12)',  color:'#22c55e' },
      rejeitadas: { border:'#ef4444', bg:'rgba(239,68,68,0.1)',   color:'#ef4444' },
      todos:      { border:'var(--fa-teal)', bg:'rgba(0,180,184,0.1)', color:'var(--fa-teal)' }
    };
    if (active) {
      btn.style.borderColor  = colors[key].border;
      btn.style.background   = colors[key].bg;
      btn.style.color        = colors[key].color;
      btn.style.fontWeight   = '700';
    } else {
      btn.style.borderColor  = 'var(--border-color)';
      btn.style.background   = 'transparent';
      btn.style.color        = 'var(--text-secondary)';
      btn.style.fontWeight   = '400';
    }
  });
}

function _farcBuscarOS(termo) {
  const modo = window._farcFiltroAtual || 'pendentes';
  const fluxoOS = _getFluxoOS();
  _farcRenderOSFiltrada(fluxoOS, modo, termo.toLowerCase());
}

function _farcRenderOSFiltrada(fluxoOS, modo, busca) {
  let lista = fluxoOS;
  if (modo === 'pendentes')  lista = fluxoOS.filter(f => f.status === 'Aguardando Aprovação' || f.status === 'Itens Novos – Reaprovação');
  else if (modo === 'aprovadas') lista = fluxoOS.filter(f => f.status === 'Aprovada' || f.status === 'Aprovada – Aguardando Comprador' || f.status === 'Aprovada – Trabalho Interno');
  else if (modo === 'rejeitadas') lista = fluxoOS.filter(f => f.status === 'Rejeitada');
  // modo 'todos' usa lista completa

  if (busca) {
    lista = lista.filter(f =>
      f.os_id?.toLowerCase().includes(busca) ||
      f.os_descricao?.toLowerCase().includes(busca) ||
      f.os_contrato?.toLowerCase().includes(busca) ||
      f.criado_por?.toLowerCase().includes(busca)
    );
  }

  const el = document.getElementById('farc-os-lista');
  if (!el) return;

  if (lista.length === 0) {
    const msgs = {
      pendentes:  { icon:'fa-check-circle', color:'#22c55e', title:'Nenhuma OS aguardando aprovação', sub:'Todas as OS estão em andamento ou concluídas.' },
      aprovadas:  { icon:'fa-stream',       color:'var(--fa-teal)', title:'Nenhuma OS aprovada',   sub:'OS aprovadas aparecerão aqui.' },
      rejeitadas: { icon:'fa-check-circle', color:'#22c55e', title:'Nenhuma OS rejeitada',        sub:'Ótimo! Nenhuma rejeição registrada.' },
      todos:      { icon:'fa-inbox',        color:'var(--text-muted)', title:'Nenhuma OS no fluxo', sub:'Crie uma OS com demanda de compra ou sincronize.' }
    };
    const m = msgs[modo] || msgs.todos;
    el.innerHTML = `
      <div style="text-align:center;padding:52px 20px;color:var(--text-muted)">
        <i class="fas ${m.icon}" style="font-size:42px;display:block;margin-bottom:14px;color:${m.color};opacity:.5"></i>
        <div style="font-size:14px;font-weight:600;color:var(--text-secondary)">${busca ? 'Nenhuma OS encontrada para "'+busca+'"' : m.title}</div>
        <div style="font-size:12px;margin-top:6px">${m.sub}</div>
        ${modo === 'todos' && !busca ? `<button class="btn btn-primary" onclick="farcSincronizarOSManual()" style="margin-top:14px"><i class="fas fa-sync"></i> Sincronizar OS</button>` : ''}
      </div>`;
    return;
  }

  const cfg = _getConfigAprovacao();
  const pendentes   = lista.filter(f => f.status === 'Aguardando Aprovação' || f.status === 'Itens Novos – Reaprovação');
  const naoP        = lista.filter(f => !['Aguardando Aprovação','Itens Novos – Reaprovação'].includes(f.status));

  let html = '';
  if (modo === 'todos' || modo === 'pendentes') {
    if (pendentes.length > 0) {
      if (modo === 'todos') html += `<div style="font-size:11px;font-weight:700;color:#f59e0b;letter-spacing:.7px;text-transform:uppercase;margin-bottom:10px"><i class="fas fa-hourglass-half" style="margin-right:5px"></i>Aguardando Aprovação (${pendentes.length})</div>`;
      html += pendentes.map(f => _farcCardOSV2(f, cfg)).join('');
    }
    if (modo === 'todos' && naoP.length > 0) {
      html += `<div style="font-size:11px;font-weight:700;color:var(--text-muted);letter-spacing:.7px;text-transform:uppercase;margin-bottom:10px;margin-top:${pendentes.length?'18px':'0'}"><i class="fas fa-stream" style="margin-right:5px"></i>Em Processo / Histórico (${naoP.length})</div>`;
      html += naoP.map(f => _farcCardOSV2(f, cfg)).join('');
    }
  } else {
    html = lista.map(f => _farcCardOSV2(f, cfg)).join('');
  }
  el.innerHTML = html;
}

// ── Renderiza a lista de OS dentro do pipeline ─────────────────────────────────
function _farcListaOSAprovacao(osAguardando, osEmProcesso, modo) {
  const cfg = _getConfigAprovacao();

  if (modo === 'pendentes') {
    if (osAguardando.length === 0) {
      return `
        <div style="text-align:center;padding:48px 20px;color:var(--text-muted)">
          <i class="fas fa-check-circle" style="font-size:40px;display:block;margin-bottom:14px;color:#22c55e;opacity:.6"></i>
          <div style="font-size:14px;font-weight:600;color:var(--text-secondary)">Nenhuma OS aguardando aprovação</div>
          <div style="font-size:12px;margin-top:6px">Todas as OS estão em andamento ou já foram aprovadas.</div>
        </div>`;
    }
    return osAguardando.map(f => _farcCardOSPipeline(f, cfg, true)).join('');
  }

  // modo 'todos'
  if (osAguardando.length === 0 && osEmProcesso.length === 0) {
    return `
      <div style="text-align:center;padding:48px 20px;color:var(--text-muted)">
        <i class="fas fa-inbox" style="font-size:40px;display:block;margin-bottom:14px;opacity:.3"></i>
        <div style="font-size:14px;font-weight:600;color:var(--text-secondary)">Nenhuma OS no fluxo</div>
        <div style="font-size:12px;margin-top:6px;max-width:360px;margin-left:auto;margin-right:auto;line-height:1.6">
          Crie uma OS com <strong>"Necessita compra"</strong> ou clique em <strong>Sincronizar OS</strong>.
        </div>
        <button class="btn btn-primary" onclick="farcSincronizarOSManual()" style="margin-top:14px">
          <i class="fas fa-sync"></i> Sincronizar OS
        </button>
      </div>`;
  }

  let html = '';
  if (osAguardando.length > 0) {
    html += `<div style="font-size:11px;font-weight:700;color:#f59e0b;letter-spacing:.7px;text-transform:uppercase;margin-bottom:10px;margin-top:4px">
      <i class="fas fa-clock" style="margin-right:5px"></i>Aguardando Aprovação (${osAguardando.length})
    </div>`;
    html += osAguardando.map(f => _farcCardOSPipeline(f, cfg, true)).join('');
  }
  if (osEmProcesso.length > 0) {
    html += `<div style="font-size:11px;font-weight:700;color:var(--text-muted);letter-spacing:.7px;text-transform:uppercase;margin-bottom:10px;margin-top:${osAguardando.length?'18px':'4px'}">
      <i class="fas fa-stream" style="margin-right:5px"></i>Em Processo / Histórico (${osEmProcesso.length})
    </div>`;
    html += osEmProcesso.slice(0, 15).map(f => _farcCardOSPipeline(f, cfg, false)).join('');
  }
  return html;
}

// ── Card de OS no pipeline (clicável) ─────────────────────────────────────────
function _farcCardOSPipeline(f, cfg, destaque) {
  const itensAprov = (f.itens||[]).filter(i => i.status_item === 'Aprovado').length;
  const itensPend  = (f.itens||[]).filter(i => i.status_item !== 'Aprovado').length;
  const totalItens = (f.itens||[]).length;
  const itensNovos = (f.itens||[]).filter(i => i.novo && i.status_item !== 'Aprovado').length;
  const podAprov   = _farcPodeAprovarOS(f);
  const est        = f.estagio_atual || 1;

  const corBorda = destaque
    ? (f.status === 'Itens Novos – Reaprovação' ? '#f97316' : '#f59e0b')
    : 'var(--border-color)';
  const bgCard = destaque ? 'rgba(245,158,11,0.04)' : 'transparent';

  return `
    <div onclick="farcVerDetalheOS('${f.id}')"
      style="border:1px solid ${corBorda};border-radius:10px;padding:14px 16px;margin-bottom:10px;background:${bgCard};cursor:pointer;transition:.18s"
      onmouseover="this.style.borderColor='var(--fa-teal)';this.style.background='rgba(0,180,184,0.04)'"
      onmouseout="this.style.borderColor='${corBorda}';this.style.background='${bgCard}'">

      <div style="display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap">

        <!-- Info principal -->
        <div style="flex:1;min-width:180px">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:5px">
            <span style="font-size:13px;font-weight:800;color:var(--orange)">${f.os_id}</span>
            ${_statusBadgeFluxo(f.status)}
            ${itensNovos > 0 ? `<span style="background:#f97316;color:#fff;border-radius:6px;padding:2px 7px;font-size:10px;font-weight:700"><i class="fas fa-exclamation-triangle" style="margin-right:3px"></i>${itensNovos} novo(s)</span>` : ''}
            ${(f.trabalho_interno || totalItens === 0) ? `<span style="background:rgba(16,185,129,0.15);color:#10b981;border:1px solid rgba(16,185,129,0.4);border-radius:6px;padding:2px 7px;font-size:10px;font-weight:700"><i class="fas fa-tools" style="margin-right:3px"></i>Serviço Interno</span>` : ''}
          </div>
          <div style="font-size:12px;color:var(--text-secondary);margin-bottom:4px;font-weight:500">${f.os_descricao}</div>
          <div style="font-size:11px;color:var(--text-muted)">
            <i class="fas fa-briefcase" style="margin-right:3px;opacity:.6"></i>${f.os_contrato}
            &nbsp;·&nbsp;
            ${(f.trabalho_interno || totalItens === 0) ? '<span style="color:#10b981;font-weight:600">Sem itens de compra — aprovação simplificada</span>' : `${totalItens} item(ns) &nbsp;·&nbsp; <span style="color:#22c55e">${itensAprov} ✓</span>${itensPend > 0 ? ` &nbsp;·&nbsp;<span style="color:#f59e0b">${itensPend} pend.</span>` : ''}`}
          </div>
        </div>

        <!-- Progresso de estágios -->
        <div style="display:flex;gap:5px;align-items:center;flex-shrink:0">
          ${[1,2,3].map(i => {
            const cfgE = i===1?cfg.estagio1:i===2?cfg.estagio2:cfg.estagio3;
            const ap   = (f.estagios_aprovacao||[]).find(e => e.estagio === i);
            const isAtual  = f.estagio_atual === i && ['Aguardando Aprovação','Itens Novos – Reaprovação'].includes(f.status);
            const isDone   = ap?.status === 'Aprovado';
            const isReprov = ap?.status === 'Reprovado';
            const cor = isDone ? '#22c55e' : isReprov ? '#ef4444' : isAtual ? '#f59e0b' : '#374151';
            const ico = isDone ? 'fa-check' : isReprov ? 'fa-times' : isAtual ? 'fa-hourglass-half' : 'fa-circle';
            return `
              <div title="${cfgE?.nome||'Estágio '+i}: ${ap ? ap.status : isAtual?'Aguardando':'Pendente'}"
                style="width:26px;height:26px;border-radius:50%;background:${cor}22;border:2px solid ${cor};display:flex;align-items:center;justify-content:center;font-size:10px;color:${cor}">
                <i class="fas ${ico}" style="font-size:9px"></i>
              </div>
              ${i < 3 ? `<div style="color:var(--text-muted);font-size:9px">›</div>` : ''}`;
          }).join('')}
        </div>

        <!-- Dica clique + indicador de aprovador -->
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0">
          ${podAprov && (f.trabalho_interno || totalItens === 0) ? `
            <button onclick="event.stopPropagation();farcVerDetalheOS('${f.id}')"
              style="background:#16a34a;color:#fff;border:none;border-radius:8px;padding:6px 12px;font-size:11px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:5px">
              <i class="fas fa-check-circle"></i>Aprovar OS
            </button>
          ` : podAprov ? `
            <span style="background:rgba(34,197,94,0.15);color:#16a34a;border:1px solid rgba(34,197,94,0.3);border-radius:20px;padding:3px 10px;font-size:10px;font-weight:700">
              <i class="fas fa-gavel" style="margin-right:4px"></i>Você pode aprovar
            </span>
          ` : ''}
          <span style="font-size:10px;color:var(--text-muted)">
            <i class="fas fa-mouse-pointer" style="margin-right:3px;opacity:.5"></i>clique para ver detalhes
          </span>
        </div>

      </div>

      <!-- Banner de reaprovação (só aparece quando status é Itens Novos – Reaprovação) -->
      ${f.status === 'Itens Novos – Reaprovação' ? `
        <div style="margin-top:10px;padding:10px 14px;background:rgba(249,115,22,0.1);border:1px solid rgba(249,115,22,0.4);border-radius:8px;display:flex;align-items:flex-start;gap:10px">
          <i class="fas fa-exclamation-circle" style="color:#f97316;font-size:16px;flex-shrink:0;margin-top:1px"></i>
          <div style="flex:1">
            <div style="font-size:12px;font-weight:700;color:#f97316;margin-bottom:3px">
              Reaprovação necessária – ${itensNovos} novo(s) item(ns) adicionado(s)
            </div>
            <div style="font-size:11px;color:var(--text-secondary)">
              O fluxo foi <strong>reiniciado no Estágio 1</strong>. Os itens já aprovados serão mantidos;
              apenas os novos precisam de aprovação.
            </div>
          </div>
        </div>` : ''}

      ${f.motivo_edicao && f.status !== 'Itens Novos – Reaprovação' ? `
        <div style="margin-top:8px;padding:5px 10px;background:rgba(249,115,22,0.1);border-radius:6px;font-size:11px;color:#f97316">
          <i class="fas fa-info-circle" style="margin-right:4px"></i>${f.motivo_edicao}
        </div>` : ''}
    </div>
  `;
}

// ── Card OS V2 – design mais rico para a nova tela ─────────────────────────────
function _farcCardOSV2(f, cfg) {
  const itensAprov = (f.itens||[]).filter(i => i.status_item === 'Aprovado').length;
  const totalItens = (f.itens||[]).length;
  const itensNovos = (f.itens||[]).filter(i => i.novo && i.status_item !== 'Aprovado').length;
  const podAprov   = _farcPodeAprovarOS(f);
  const isCompras  = currentUser && ['admin','compras','diretor'].includes(currentUser.profile);
  const isPend     = f.status === 'Aguardando Aprovação' || f.status === 'Itens Novos – Reaprovação';
  const isAprov    = f.status === 'Aprovada' || f.status === 'Aprovada – Aguardando Comprador' || f.status === 'Aprovada – Trabalho Interno';
  const isRej      = f.status === 'Rejeitada';
  // Trabalho interno: sem itens → mostra % de estágios aprovados
  const isTrabalhoInternoCard = f.trabalho_interno || (!f.tem_compra_externa && totalItens === 0);
  const estagiosAprov = (f.estagios_aprovacao||[]).filter(e => e.status === 'Aprovado').length;
  const pct = isTrabalhoInternoCard
    ? (isAprov ? 100 : Math.round((estagiosAprov / (f.total_estagios||3)) * 100))
    : (totalItens ? Math.round((itensAprov/totalItens)*100) : (isAprov ? 100 : 0));
  const est = f.estagio_atual || 1;

  const corBorda = isPend ? (f.status === 'Itens Novos – Reaprovação' ? 'rgba(249,115,22,0.5)' : 'rgba(245,158,11,0.5)')
                 : isAprov ? 'rgba(34,197,94,0.3)'
                 : isRej ? 'rgba(239,68,68,0.3)'
                 : 'var(--border-color)';

  const bgLeft   = isPend ? (f.status === 'Itens Novos – Reaprovação' ? '#f97316' : '#f59e0b')
                 : isAprov ? '#22c55e'
                 : isRej ? '#ef4444'
                 : '#64748b';

  const lastHist = (f.historico||[]).length > 0 ? f.historico[0] : null;

  return `
    <div style="border:1px solid ${corBorda};border-radius:12px;margin-bottom:10px;overflow:hidden;transition:.2s;cursor:pointer"
      onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 6px 24px rgba(0,0,0,0.12)'"
      onmouseout="this.style.transform='';this.style.boxShadow=''"
      onclick="farcVerDetalheOS('${f.id}')">

      <div style="display:flex;align-items:stretch">

        <!-- Barra lateral colorida -->
        <div style="width:5px;background:${bgLeft};flex-shrink:0;border-radius:12px 0 0 12px"></div>

        <!-- Conteúdo principal -->
        <div style="flex:1;padding:14px 16px">
          <div style="display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap">

            <!-- Info OS -->
            <div style="flex:1;min-width:200px">
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:5px">
                <span style="font-size:14px;font-weight:900;color:var(--orange);font-family:monospace;letter-spacing:.5px">${f.os_id}</span>
                ${_statusBadgeFluxo(f.status)}
                ${itensNovos > 0 ? `<span style="background:#f97316;color:#fff;border-radius:20px;padding:2px 8px;font-size:10px;font-weight:700"><i class="fas fa-plus-circle" style="margin-right:3px"></i>${itensNovos} novo(s)</span>` : ''}
                ${podAprov ? `<span style="background:rgba(34,197,94,0.15);color:#16a34a;border:1px solid rgba(34,197,94,0.35);border-radius:20px;padding:2px 8px;font-size:10px;font-weight:700"><i class="fas fa-gavel" style="margin-right:3px"></i>Ação necessária</span>` : ''}
              </div>
              <div style="font-size:13px;color:var(--text-primary);font-weight:600;margin-bottom:5px;line-height:1.4">${f.os_descricao}</div>
              <div style="display:flex;gap:14px;font-size:11px;color:var(--text-muted);flex-wrap:wrap">
                <span><i class="fas fa-briefcase" style="margin-right:4px;opacity:.6"></i>${f.os_contrato}</span>
                <span><i class="fas fa-user" style="margin-right:4px;opacity:.6"></i>${f.criado_por||'—'}</span>
                <span><i class="fas fa-calendar" style="margin-right:4px;opacity:.6"></i>${_fmtDate2(f.criado_em)}</span>
                ${f.os_tipo_compra ? `<span><i class="fas fa-tag" style="margin-right:4px;opacity:.6"></i>${f.os_tipo_compra}</span>` : ''}
              </div>
            </div>

            <!-- Mini timeline de estágios -->
            <div style="display:flex;flex-direction:column;gap:4px;flex-shrink:0;min-width:160px">
              ${[1,2,3].map(i => {
                const cfgE = i===1?cfg.estagio1:i===2?cfg.estagio2:cfg.estagio3;
                const ap   = (f.estagios_aprovacao||[]).find(e => e.estagio === i);
                const isAtual  = f.estagio_atual === i && isPend;
                const isDone   = ap?.status === 'Aprovado';
                const isReprov = ap?.status === 'Reprovado';
                const cor = isDone ? '#22c55e' : isReprov ? '#ef4444' : isAtual ? '#f59e0b' : '#374151';
                const ico = isDone ? 'fa-check-circle' : isReprov ? 'fa-times-circle' : isAtual ? 'fa-hourglass-half' : 'fa-circle';
                const peso = isAtual || isDone ? '700' : '400';
                return `<div style="display:flex;align-items:center;gap:6px;font-size:11px;font-weight:${peso};color:${cor}">
                  <i class="fas ${ico}" style="font-size:12px;flex-shrink:0"></i>
                  <span style="color:${isDone||isAtual?cor:'var(--text-muted)'}">${cfgE?.nome||'Estágio '+i}</span>
                  ${isAtual ? `<span style="font-size:9px;background:${cor};color:#fff;border-radius:8px;padding:1px 5px;margin-left:auto">ATUAL</span>` : ''}
                  ${isDone && ap?.aprovador ? `<span style="font-size:9px;color:var(--text-muted);margin-left:auto;white-space:nowrap">${ap.aprovador.split(' ')[0]}</span>` : ''}
                </div>`;
              }).join('')}
            </div>

            <!-- Barra de progresso e ações rápidas -->
            <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end;flex-shrink:0">
              <!-- Progresso -->
              <div style="text-align:right">
                <div style="font-size:11px;color:var(--text-muted);margin-bottom:3px">
                  ${isTrabalhoInternoCard
                    ? `<i class="fas fa-tools" style="margin-right:3px;color:#10b981"></i>Trabalho Interno`
                    : `${itensAprov}/${totalItens} itens`
                  }
                </div>
                <div style="width:100px;height:5px;background:var(--border-color);border-radius:3px;overflow:hidden">
                  <div style="height:100%;background:${pct===100?'#22c55e':isPend?'#f59e0b':'var(--fa-teal)'};border-radius:3px;width:${pct}%;transition:width .4s"></div>
                </div>
                <div style="font-size:10px;color:${pct===100?'#22c55e':isPend?'#f59e0b':'var(--text-muted)'};margin-top:2px;text-align:right">${pct}%</div>
              </div>
              <!-- Botões de ação rápida (stopPropagation para não acionar o modal) -->
              <div style="display:flex;gap:5px" onclick="event.stopPropagation()">
                ${podAprov ? `
                  <button onclick="farcAprovarOS('${f.id}')" class="btn btn-success btn-sm" style="padding:5px 10px;font-size:11px">
                    <i class="fas fa-check"></i> Aprovar
                  </button>
                  <button onclick="farcReprovarOS('${f.id}')" class="btn btn-danger btn-sm" style="padding:5px 8px;font-size:11px">
                    <i class="fas fa-times"></i>
                  </button>
                ` : ''}
                ${f.status === 'Aprovada – Aguardando Comprador' && isCompras ? `
                  <button onclick="farcEmitirRC('${f.id}')" class="btn btn-primary btn-sm" style="padding:5px 10px;font-size:11px">
                    <i class="fas fa-file-alt"></i> Emitir RC
                  </button>
                ` : ''}
                ${f.status === 'Aprovada – Trabalho Interno' ? `
                  <span style="font-size:10px;padding:5px 8px;background:rgba(16,185,129,0.12);color:#10b981;border-radius:6px;font-weight:600">
                    <i class="fas fa-check-circle"></i> Exec. Autorizada
                  </span>
                ` : ''}
                <button onclick="farcVerRastreabilidade('${f.os_id}')" class="btn btn-secondary btn-sm btn-icon" title="Rastreabilidade" style="padding:5px 8px">
                  <i class="fas fa-route"></i>
                </button>
              </div>
            </div>
          </div>

          <!-- Linha inferior: último evento + motivo rejeição -->
          ${(isRej && f.motivo_rejeicao) ? `
            <div style="margin-top:10px;padding:8px 12px;background:rgba(239,68,68,0.07);border:1px solid rgba(239,68,68,0.2);border-radius:8px;font-size:11px;color:#ef4444;display:flex;gap:8px;align-items:flex-start">
              <i class="fas fa-ban" style="flex-shrink:0;margin-top:1px"></i>
              <span><strong>Motivo da rejeição:</strong> ${f.motivo_rejeicao}</span>
            </div>` : ''}
          ${(f.status === 'Itens Novos – Reaprovação') ? `
            <div style="margin-top:10px;padding:8px 12px;background:rgba(249,115,22,0.08);border:1px solid rgba(249,115,22,0.3);border-radius:8px;font-size:11px;color:#f97316;display:flex;gap:8px;align-items:flex-start">
              <i class="fas fa-exclamation-triangle" style="flex-shrink:0;margin-top:1px"></i>
              <span>Reaprovação em andamento — ${itensNovos} item(ns) novo(s) aguardando revisão. O fluxo reiniciou no Estágio 1.</span>
            </div>` : ''}
          ${lastHist && !isRej && f.status !== 'Itens Novos – Reaprovação' ? `
            <div style="margin-top:10px;padding:6px 10px;background:var(--bg-secondary);border-radius:6px;font-size:11px;color:var(--text-muted);display:flex;gap:6px;align-items:center">
              <i class="fas fa-history" style="opacity:.5;flex-shrink:0"></i>
              <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${lastHist.acao}</span>
              <span style="white-space:nowrap;opacity:.7">${lastHist.data}</span>
            </div>` : ''}
        </div>
      </div>
    </div>
  `;
}

// ─── SWITCH DE ABA (compatibilidade) ──────────────────────────────────────────
// A nova tela não tem abas; este stub mantém compatibilidade com chamadas legadas.
function farcSwitchTab(tab) {
  if (tab === 'cotacoes') { navigate('rfq');          return; }
  if (tab === 'mapa')     { navigate('mapa_cotacao'); return; }
  if (tab === 'pedido')   { navigate('pedidos');      return; }
  if (tab === 'emissao')  { navigate('requisicoes');  return; }
  // 'aprovacao' → re-renderiza a tela do fluxo
  renderFluxoAprovacaoRC();
}

// ─── KPIs SIMPLIFICADOS (SOMENTE APROVAÇÃO) ───────────────────────────────────
function _farcRenderKPIsAprovacao(fluxoOS, rcs, rfqAberto, mapaPend, pcPend) {
  const pendAprv  = fluxoOS.filter(f => f.status === 'Aguardando Aprovação' || f.status === 'Itens Novos – Reaprovação').length;
  const rcEmitido = rcs.filter(r => !['Rascunho','Aguardando Aprovação'].includes(r.status)).length;
  const rejRCs    = rcs.filter(r => r.status === 'Rejeitada').length;
  const taxaAprv  = rcs.length ? Math.round(((rcs.length - rejRCs) / rcs.length) * 100) : 100;

  return `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:18px">
      <div style="background:var(--bg-card2);padding:14px;border-radius:10px;border:1px solid rgba(245,158,11,0.3);text-align:center;cursor:pointer" onclick="farcSwitchTab('aprovacao')">
        <div style="font-size:24px;font-weight:700;color:#f59e0b">${pendAprv}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px">OS aguardando aprovação</div>
      </div>
      <div style="background:var(--bg-card2);padding:14px;border-radius:10px;border:1px solid rgba(59,130,246,0.3);text-align:center;cursor:pointer" onclick="navigate('requisicoes')">
        <div style="font-size:24px;font-weight:700;color:#3b82f6">${rcs.filter(r=>r.status==='Aprovada – Aguardando Comprador').length}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px">RC aguard. comprador</div>
        <div style="font-size:10px;color:#3b82f6;margin-top:2px"><i class="fas fa-external-link-alt" style="font-size:8px"></i> Emissão de RC</div>
      </div>
      <div style="background:var(--bg-card2);padding:14px;border-radius:10px;border:1px solid rgba(34,197,94,0.3);text-align:center">
        <div style="font-size:24px;font-weight:700;color:#22c55e">${rcEmitido}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px">RCs emitidas (total)</div>
      </div>
      <div style="background:var(--bg-card2);padding:14px;border-radius:10px;border:1px solid rgba(239,68,68,0.2);text-align:center">
        <div style="font-size:24px;font-weight:700;color:${taxaAprv<80?'#ef4444':taxaAprv<90?'#f59e0b':'#22c55e'}">${taxaAprv}%</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px">Taxa de aprovação RC</div>
      </div>
    </div>
  `;
}

// ════════════════════════════════════════════════════════════════════════════
// ABA 1 – EM APROVAÇÃO
// Exibe OS que entraram no fluxo com listas de materiais/serviços
// ════════════════════════════════════════════════════════════════════════════
function _farcRenderTabAprovacao(lista) {
  const cfg = _getConfigAprovacao();
  const pendentes = lista.filter(f =>
    f.status === 'Aguardando Aprovação' || f.status === 'Itens Novos – Reaprovação'
  );
  const emProcesso = lista.filter(f =>
    !['Aguardando Aprovação','Itens Novos – Reaprovação'].includes(f.status)
  );

  return `
    <div style="padding:16px">
      <!-- Info aprovadores -->
      <div style="background:rgba(0,180,184,0.06);border:1px solid rgba(0,180,184,0.2);border-radius:10px;padding:12px 16px;margin-bottom:16px;display:flex;gap:16px;flex-wrap:wrap;align-items:center">
        <div style="font-size:12px;font-weight:700;color:var(--fa-teal)"><i class="fas fa-users-cog" style="margin-right:6px"></i>Fluxo de Aprovação Configurado:</div>
        ${[1,2,3].map(i => {
          const e = i===1?cfg.estagio1:i===2?cfg.estagio2:cfg.estagio3;
          const aprovNom = e?.aprovadores_nomeados || [];
          return `<div style="display:flex;align-items:flex-start;gap:6px;font-size:11px;color:var(--text-secondary);flex-direction:column;max-width:200px">
            <div style="display:flex;align-items:center;gap:6px">
              <span style="background:var(--fa-teal);color:#fff;border-radius:50%;width:18px;height:18px;display:inline-flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;flex-shrink:0">${i}</span>
              <strong style="color:var(--text-primary)">${e?.nome||'Estágio '+i}</strong>
            </div>
            <div style="font-size:10px;color:var(--text-muted);padding-left:24px">${(e?.perfis||[]).join(', ')||'—'}</div>
            ${aprovNom.length ? `<div style="padding-left:24px">${aprovNom.map(a => `<div style="font-size:10px;color:var(--fa-teal)"><i class="fas fa-user" style="margin-right:3px;font-size:9px"></i>${a.nome}${a.email?` (${a.email})`:''}</div>`).join('')}</div>` : ''}
          </div>`;
        }).join('<span style="color:var(--text-muted);font-size:16px;align-self:center">›</span>')}
      </div>

      ${pendentes.length === 0 ? '' : `
        <div style="margin-bottom:20px">
          <div style="font-size:13px;font-weight:700;color:var(--text-primary);margin-bottom:10px">
            <i class="fas fa-clock" style="color:#f59e0b;margin-right:6px"></i>
            ${pendentes.length} OS aguardando aprovação
          </div>
          ${pendentes.map(f => _farcCardOS(f, cfg, true)).join('')}
        </div>
      `}

      ${emProcesso.length > 0 ? `
        <div>
          <div style="font-size:12px;font-weight:700;color:var(--text-muted);margin-bottom:10px;text-transform:uppercase;letter-spacing:.5px">
            Em Processo / Histórico
          </div>
          ${emProcesso.slice(0, 10).map(f => _farcCardOS(f, cfg, false)).join('')}
        </div>
      ` : ''}

      ${lista.length === 0 ? `
        <div style="text-align:center;padding:60px 20px;color:var(--text-muted)">
          <i class="fas fa-inbox" style="font-size:48px;display:block;margin-bottom:16px;opacity:.3"></i>
          <div style="font-size:15px;font-weight:600;color:var(--text-secondary)">Nenhuma OS com demanda de compras no fluxo</div>
          <div style="font-size:12px;margin-top:8px;max-width:400px;margin-left:auto;margin-right:auto;line-height:1.6">
            Crie uma OS marcando <strong>"Necessita compra de material"</strong> ou <strong>"Necessita serviço externo"</strong>.<br>
            Se já existem OS com itens de compra, clique em <strong>"Sincronizar OS"</strong> no topo da página.
          </div>
          <button class="btn btn-primary" onclick="farcSincronizarOSManual()" style="margin-top:16px">
            <i class="fas fa-sync"></i> Sincronizar OS agora
          </button>
        </div>
      ` : ''}
    </div>
  `;
}

function _farcCardOS(f, cfg, destaque) {
  const itensAprov   = (f.itens||[]).filter(i => i.status_item === 'Aprovado').length;
  const itensPend    = (f.itens||[]).filter(i => i.status_item === 'Aguardando Aprovação').length;
  const itensNovos   = (f.itens||[]).filter(i => i.novo && i.status_item !== 'Aprovado').length;
  const podAprov     = _farcPodeAprovarOS(f);
  const isCompras    = currentUser && ['admin','compras','diretor'].includes(currentUser.profile);

  const corBorda = destaque
    ? (f.status === 'Itens Novos – Reaprovação' ? '#f97316' : '#f59e0b')
    : 'var(--border-color)';

  return `
    <div style="border:1px solid ${corBorda};border-radius:10px;padding:14px;margin-bottom:10px;background:${destaque?'rgba(245,158,11,0.04)':'transparent'}">
      <div style="display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap">
        <div style="flex:1;min-width:200px">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px">
            <span style="font-size:13px;font-weight:700;color:var(--orange)">${f.os_id}</span>
            ${_statusBadgeFluxo(f.status)}
            ${itensNovos > 0 ? `<span style="background:#f97316;color:#fff;border-radius:6px;padding:2px 7px;font-size:10px;font-weight:700"><i class="fas fa-exclamation-triangle" style="margin-right:3px"></i>${itensNovos} item(ns) novo(s)</span>` : ''}
          </div>
          <div style="font-size:12px;color:var(--text-secondary);margin-bottom:4px">${f.os_descricao}</div>
          <div style="font-size:11px;color:var(--text-muted)">
            Contrato: <strong>${f.os_contrato}</strong> ·
            ${f.itens?.length||0} item(ns) total ·
            <span style="color:#22c55e">${itensAprov} aprovado(s)</span>
            ${itensPend > 0 ? ` · <span style="color:#f59e0b">${itensPend} pendente(s)</span>` : ''}
            · Criado em ${_fmtDate2(f.criado_em)}
          </div>
        </div>

        <!-- Progresso de aprovação -->
        <div style="display:flex;gap:6px;align-items:center">
          ${[1,2,3].map(i => {
            const cfgE = i===1?cfg.estagio1:i===2?cfg.estagio2:cfg.estagio3;
            const ap = (f.estagios_aprovacao||[]).find(e => e.estagio === i);
            const isAtual = f.estagio_atual === i && (f.status.includes('Aguardando') || f.status === 'Itens Novos – Reaprovação');
            const cor = ap ? (ap.status==='Aprovado'?'#22c55e':'#ef4444') : isAtual ? '#f59e0b' : '#374151';
            return `<div title="${cfgE?.nome||'Estágio '+i}: ${ap ? ap.status+' por '+ap.aprovador : isAtual?'Aguardando':'Pendente'}"
              style="width:28px;height:28px;border-radius:50%;background:${cor}22;border:2px solid ${cor};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:${cor}">${i}</div>`;
          }).join('<div style="color:var(--text-muted);font-size:10px">›</div>')}
        </div>

        <!-- Ações -->
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button onclick="farcVerDetalheOS('${f.id}')" class="btn btn-secondary btn-sm btn-icon" title="Ver detalhes"><i class="fas fa-eye"></i></button>
          <button onclick="farcVerRastreabilidade('${f.os_id}')" class="btn btn-secondary btn-sm btn-icon" title="Ver rastreabilidade completa"><i class="fas fa-route"></i></button>
          ${podAprov ? `
            <button onclick="farcAprovarOS('${f.id}')" class="btn btn-success btn-sm"><i class="fas fa-check"></i> Aprovar</button>
            <button onclick="farcReprovarOS('${f.id}')" class="btn btn-danger btn-sm"><i class="fas fa-times"></i> Reprovar</button>
          ` : ''}
          ${f.status === 'Aprovada – Aguardando Comprador' && isCompras ? `
            <button onclick="farcEmitirRC('${f.id}')" class="btn btn-primary btn-sm"><i class="fas fa-file-alt"></i> Emitir RC</button>
          ` : ''}
          ${f.status === 'Aprovada – Trabalho Interno' ? `
            <span style="font-size:10px;padding:5px 8px;background:rgba(16,185,129,0.12);color:#10b981;border-radius:6px;font-weight:600">
              <i class="fas fa-check-circle"></i> Execução Autorizada
            </span>
          ` : ''}
        </div>
      </div>

      ${f.motivo_edicao ? `<div style="margin-top:8px;padding:6px 10px;background:rgba(249,115,22,0.1);border-radius:6px;font-size:11px;color:#f97316"><i class="fas fa-info-circle" style="margin-right:4px"></i>Motivo edição: ${f.motivo_edicao}</div>` : ''}
    </div>
  `;
}

// Verifica se usuário pode aprovar o estágio atual
function _farcPodeAprovarOS(f) {
  if (!currentUser) return false;
  if (!['Aguardando Aprovação','Itens Novos – Reaprovação'].includes(f.status)) return false;

  // admin sempre pode aprovar qualquer estágio
  if (currentUser.profile === 'admin') return true;

  const cfg = _getConfigAprovacao();
  const est = f.estagio_atual || 1;
  const mapa = { 1: cfg.estagio1?.perfis||[], 2: cfg.estagio2?.perfis||[], 3: cfg.estagio3?.perfis||[] };
  // Garante que admin está sempre na lista de perfis permitidos
  const perfis = [...(mapa[est] || []), 'admin'];
  const jaAprovou = (f.estagios_aprovacao||[]).some(e =>
    e.estagio === est && e.aprovador === currentUser.name
  );
  return perfis.includes(currentUser.profile) && !jaAprovou;
}

// ─── VER DETALHE OS NO FLUXO ────────────────────────────────────────────────
function farcVerDetalheOS(fluxoId) {
  const f = _getFluxoOS().find(x => x.id === fluxoId);
  if (!f) return;
  const cfg = _getConfigAprovacao();
  const podAprov = _farcPodeAprovarOS(f);
  const isCompras = currentUser && ['admin','compras','diretor'].includes(currentUser.profile);
  const est = f.estagio_atual || 1;
  const nomeEst = est===1?cfg.estagio1?.nome:est===2?cfg.estagio2?.nome:cfg.estagio3?.nome;
  const itensAprov = (f.itens||[]).filter(i => i.status_item === 'Aprovado').length;
  const itensPend  = (f.itens||[]).filter(i => i.status_item !== 'Aprovado').length;
  const totalItens = (f.itens||[]).length;

  // Cor do status
  const statusColor = {
    'Aguardando Aprovação':        '#f59e0b',
    'Itens Novos – Reaprovação':   '#f97316',
    'Aprovada – Aguardando Comprador': '#3b82f6',
    'Aprovada':                    '#22c55e',
    'Rejeitada':                   '#ef4444',
  }[f.status] || '#64748b';

  const isReaprovacaoModal = f.status === 'Itens Novos – Reaprovação';
  const itensNovosModal    = (f.itens||[]).filter(i => i.novo);
  const itensJaAprovModal  = (f.itens||[]).filter(i => !i.novo && i.status_item === 'Aprovado');

  openModalWide(`Detalhes da OS no Fluxo – ${f.os_id}`, `
    <div style="max-height:82vh;overflow-y:auto;padding-right:4px">

      <!-- ── BANNER DE REAPROVAÇÃO (só aparece quando há itens novos) ── -->
      ${isReaprovacaoModal ? `
        <div style="background:linear-gradient(135deg,rgba(249,115,22,0.15),rgba(249,115,22,0.08));border:2px solid #f97316;border-radius:10px;padding:14px 18px;margin-bottom:16px;display:flex;align-items:flex-start;gap:14px">
          <div style="width:40px;height:40px;background:#f97316;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <i class="fas fa-exclamation-triangle" style="color:#fff;font-size:18px"></i>
          </div>
          <div style="flex:1">
            <div style="font-size:13px;font-weight:800;color:#f97316;margin-bottom:4px">
              ⚠️ Reaprovação Necessária – Itens Novos Adicionados
            </div>
            <div style="font-size:12px;color:var(--text-secondary);line-height:1.6">
              Esta OS já possuía itens aprovados anteriormente, mas foram adicionados
              <strong style="color:#f97316">${itensNovosModal.length} novo(s) item(ns)</strong> que precisam de aprovação.
              O fluxo foi <strong>reiniciado a partir do Estágio 1</strong> para os novos itens.
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
              ${itensNovosModal.map(it => `
                <span style="background:rgba(249,115,22,0.15);border:1px solid #f97316;color:#f97316;border-radius:6px;padding:3px 10px;font-size:11px;font-weight:600">
                  <i class="fas fa-plus-circle" style="margin-right:3px"></i>${it.descricao} (${it.qtd||1} ${it.unidade||'Un'})
                </span>`).join('')}
            </div>
            ${itensJaAprovModal.length > 0 ? `
              <div style="font-size:11px;color:var(--text-muted);margin-top:8px">
                <i class="fas fa-check-circle" style="color:#22c55e;margin-right:4px"></i>
                ${itensJaAprovModal.length} item(ns) já aprovado(s) anteriormente serão mantidos.
              </div>` : ''}
          </div>
        </div>
      ` : ''}

      <!-- ── CABEÇALHO COLORIDO ── -->
      <div style="background:linear-gradient(135deg,#1e3a5f 0%,#1e4d7b 100%);border-radius:10px;padding:18px 20px;margin-bottom:18px;color:#fff">
        <div style="display:flex;align-items:flex-start;gap:14px">
          <div style="background:rgba(255,255,255,0.12);border-radius:8px;padding:10px 14px;font-size:22px;font-weight:900;letter-spacing:1px;white-space:nowrap">${f.os_id}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:16px;font-weight:700;line-height:1.3;margin-bottom:6px">${f.os_descricao}</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
              <span style="background:${statusColor};color:#fff;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700">${f.status}</span>
              <span style="background:rgba(255,255,255,0.15);padding:3px 10px;border-radius:20px;font-size:11px"><i class="fas fa-briefcase" style="margin-right:4px;opacity:.7"></i>${f.os_contrato}</span>
              <span style="background:rgba(255,255,255,0.15);padding:3px 10px;border-radius:20px;font-size:11px"><i class="fas fa-tag" style="margin-right:4px;opacity:.7"></i>${f.os_tipo_compra||'Material'}</span>
              <span style="background:rgba(255,255,255,0.15);padding:3px 10px;border-radius:20px;font-size:11px"><i class="fas fa-user" style="margin-right:4px;opacity:.7"></i>${f.criado_por||'—'}</span>
            </div>
          </div>
          <div style="text-align:right;font-size:11px;opacity:.75;white-space:nowrap">
            <div>${new Date(f.criado_em||Date.now()).toLocaleDateString('pt-BR')}</div>
            <div style="margin-top:2px">${itensAprov}/${totalItens} itens aprovados</div>
          </div>
        </div>

        <!-- Barra de progresso de itens -->
        <div style="margin-top:14px">
          <div style="display:flex;justify-content:space-between;font-size:10px;opacity:.8;margin-bottom:4px">
            <span>${itensAprov} aprovados</span><span>${itensPend} pendentes</span>
          </div>
          <div style="height:6px;background:rgba(255,255,255,0.2);border-radius:3px;overflow:hidden">
            <div style="height:100%;background:#22c55e;border-radius:3px;width:${totalItens?Math.round((itensAprov/totalItens)*100):0}%;transition:width .4s"></div>
          </div>
        </div>
      </div>

      <!-- ── TIMELINE DE APROVAÇÃO ── -->
      <div style="margin-bottom:18px">
        <div style="font-size:11px;font-weight:700;color:var(--text-muted);letter-spacing:.8px;text-transform:uppercase;margin-bottom:14px">
          <i class="fas fa-stream" style="margin-right:6px;color:var(--fa-teal)"></i>Progresso do Fluxo de Aprovação
        </div>

        <!-- Timeline vertical -->
        <div style="position:relative;padding-left:36px">
          <!-- Linha vertical de fundo -->
          <div style="position:absolute;left:14px;top:8px;bottom:8px;width:2px;background:var(--border-color);border-radius:2px;z-index:0"></div>

          ${[1,2,3].map((i, idx) => {
            const cfgE     = i===1?cfg.estagio1:i===2?cfg.estagio2:cfg.estagio3;
            const ap       = (f.estagios_aprovacao||[]).find(e => e.estagio === i);
            const isAtual  = f.estagio_atual === i && ['Aguardando Aprovação','Itens Novos – Reaprovação'].includes(f.status);
            const isDone   = ap?.status === 'Aprovado';
            const isReprov = ap?.status === 'Reprovado';
            const isPend   = !isDone && !isReprov && !isAtual;
            const cor  = isDone ? '#22c55e' : isReprov ? '#ef4444' : isAtual ? '#f59e0b' : '#374151';
            const bg   = isDone ? 'rgba(34,197,94,0.1)' : isReprov ? 'rgba(239,68,68,0.08)' : isAtual ? 'rgba(245,158,11,0.08)' : 'var(--bg-secondary)';
            const ico  = isDone ? 'fa-check' : isReprov ? 'fa-times' : isAtual ? 'fa-hourglass-half' : 'fa-circle';
            const peso = isDone || isAtual ? '700' : '400';
            const aprovNomPerfis = (cfgE?.aprovadores_nomeados||[]).map(a => a.nome).join(', ');
            return `
              <div style="position:relative;margin-bottom:${idx<2?'12px':'0'};z-index:1">
                <!-- Círculo na timeline -->
                <div style="position:absolute;left:-36px;top:10px;width:28px;height:28px;border-radius:50%;background:${isDone?'#22c55e':isReprov?'#ef4444':isAtual?'#f59e0b':'var(--bg-tertiary)'};border:2px solid ${cor};display:flex;align-items:center;justify-content:center;z-index:2">
                  <i class="fas ${ico}" style="color:${isDone||isReprov||isAtual?'#fff':'var(--text-muted)'};font-size:10px"></i>
                </div>
                <!-- Conteúdo do estágio -->
                <div style="border:1.5px solid ${isAtual?cor:isDone?cor+'66':isReprov?cor+'66':'var(--border-color)'};border-radius:10px;padding:12px 14px;background:${bg}">
                  <div style="display:flex;align-items:center;gap:8px;margin-bottom:${isDone||isAtual?'8px':'0'}">
                    <div style="flex:1">
                      <span style="font-size:12px;font-weight:${peso};color:${cor}">${cfgE?.nome||'Estágio '+i}</span>
                      <span style="margin-left:8px;font-size:10px;color:var(--text-muted)">${(cfgE?.perfis||[]).join(', ')}</span>
                      ${aprovNomPerfis ? `<span style="margin-left:6px;font-size:10px;color:var(--fa-teal)">· ${aprovNomPerfis}</span>` : ''}
                    </div>
                    ${isAtual ? `<span style="background:#f59e0b;color:#fff;border-radius:20px;padding:2px 8px;font-size:9px;font-weight:700;white-space:nowrap"><i class="fas fa-hourglass-half" style="margin-right:3px"></i>AGUARDANDO</span>` : ''}
                    ${isDone  ? `<span style="background:rgba(34,197,94,0.15);color:#16a34a;border-radius:20px;padding:2px 8px;font-size:9px;font-weight:700;white-space:nowrap"><i class="fas fa-check-circle" style="margin-right:3px"></i>APROVADO</span>` : ''}
                    ${isReprov? `<span style="background:rgba(239,68,68,0.15);color:#ef4444;border-radius:20px;padding:2px 8px;font-size:9px;font-weight:700;white-space:nowrap"><i class="fas fa-times-circle" style="margin-right:3px"></i>REPROVADO</span>` : ''}
                    ${isPend  ? `<span style="background:var(--bg-tertiary);color:var(--text-muted);border-radius:20px;padding:2px 8px;font-size:9px;white-space:nowrap">Pendente</span>` : ''}
                  </div>
                  ${isDone ? `
                    <div style="display:flex;gap:14px;font-size:11px;color:var(--text-secondary);flex-wrap:wrap">
                      <span><i class="fas fa-user" style="color:#22c55e;margin-right:4px"></i><strong>${ap.aprovador}</strong></span>
                      <span><i class="fas fa-calendar" style="opacity:.6;margin-right:4px"></i>${ap.data}</span>
                      ${ap.obs ? `<span style="font-style:italic;color:var(--text-muted)"><i class="fas fa-comment" style="margin-right:4px;opacity:.6"></i>"${ap.obs}"</span>` : ''}
                      ${ap.reaprovacao ? `<span style="color:#f97316;font-size:10px"><i class="fas fa-redo" style="margin-right:3px"></i>Reaprovação</span>` : ''}
                    </div>` : ''}
                  ${isAtual ? `
                    <div style="font-size:11px;color:#d97706;font-style:italic;display:flex;align-items:center;gap:6px">
                      <i class="fas fa-clock" style="font-size:12px"></i>
                      Aguardando aprovação por: <strong>${(cfgE?.perfis||[]).join(' / ')}</strong>
                    </div>` : ''}
                </div>
              </div>`;
          }).join('')}

          <!-- Linha final: se aprovação completa, mostrar "RC disponível" -->
          ${(f.status === 'Aprovada – Aguardando Comprador' || f.status === 'Aprovada') ? `
            <div style="position:relative;margin-top:12px;z-index:1">
              <div style="position:absolute;left:-36px;top:10px;width:28px;height:28px;border-radius:50%;background:var(--fa-teal);border:2px solid var(--fa-teal);display:flex;align-items:center;justify-content:center">
                <i class="fas fa-file-alt" style="color:#fff;font-size:10px"></i>
              </div>
              <div style="border:1.5px solid var(--fa-teal);border-radius:10px;padding:10px 14px;background:rgba(0,180,184,0.06)">
                <span style="font-size:12px;font-weight:700;color:var(--fa-teal)">Aprovação Completa – Pronto para emissão de RC</span>
                <div style="font-size:11px;color:var(--text-secondary);margin-top:3px">Comprador pode agora emitir a Requisição de Compra.</div>
              </div>
            </div>
          ` : ''}
        </div>
      </div>

      <!-- ── PAINEL DE APROVAÇÃO (só aparece se o usuário pode aprovar) ── -->
      ${podAprov ? `
        <div id="farc-detalhe-aprov-panel" style="background:rgba(34,197,94,0.06);border:2px solid rgba(34,197,94,0.3);border-radius:10px;padding:16px;margin-bottom:18px">
          <div style="font-size:12px;font-weight:700;color:#16a34a;margin-bottom:12px;display:flex;align-items:center;gap:8px">
            <i class="fas fa-gavel"></i>
            Aprovar Estágio ${est} – ${nomeEst||'Estágio '+est}
            <span style="background:#16a34a;color:#fff;border-radius:10px;padding:1px 8px;font-size:10px">Você tem permissão</span>
          </div>

          <!-- Contexto de reaprovação -->
          ${isReaprovacaoModal ? `
            <div style="background:rgba(249,115,22,0.08);border:1px solid rgba(249,115,22,0.3);border-radius:8px;padding:10px 14px;margin-bottom:10px;font-size:11px;color:#f97316">
              <i class="fas fa-info-circle" style="margin-right:5px"></i>
              <strong>Reaprovação:</strong> apenas os itens <strong>NOVOS</strong> (marcados em laranja) precisam ser avaliados.
              Os itens já aprovados anteriormente estão bloqueados e serão mantidos automaticamente.
            </div>
          ` : `
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px">Selecione os itens a aprovar neste estágio:</div>
          `}

          <!-- Checklist de itens – NOVOS em destaque, aprovados bloqueados -->
          <div style="max-height:220px;overflow-y:auto;display:flex;flex-direction:column;gap:5px;margin-bottom:12px" id="farc-itens-aprov-lista">

            ${isReaprovacaoModal && itensNovosModal.length > 0 ? `
              <div style="font-size:10px;font-weight:700;color:#f97316;text-transform:uppercase;letter-spacing:.6px;padding:4px 0 2px">
                <i class="fas fa-plus-circle" style="margin-right:4px"></i>Itens novos – aguardando aprovação
              </div>` : ''}

            ${(f.itens||[]).map((it, itemIdx) => {
              const jaProv = it.status_item === 'Aprovado';
              const isNovo = !!it.novo;
              const corBorda = jaProv ? '#22c55e44' : isNovo ? 'rgba(249,115,22,0.4)' : 'var(--border-color)';
              const bgItem  = jaProv ? 'rgba(34,197,94,0.06)' : isNovo ? 'rgba(249,115,22,0.06)' : 'var(--bg-secondary)';
              return `
                <label style="display:flex;align-items:center;gap:10px;padding:9px 12px;border:1.5px solid ${corBorda};border-radius:8px;background:${bgItem};cursor:${jaProv?'default':'pointer'};transition:.15s"
                  ${!jaProv ? `onmouseover="this.style.borderColor='#22c55e'" onmouseout="this.style.borderColor='${corBorda}'"` : ''}>
                  <input type="checkbox" class="farc-det-item" data-real-idx="${itemIdx}" value="${itemIdx}"
                    ${jaProv ? 'checked disabled' : 'checked'}
                    style="width:16px;height:16px;accent-color:${isNovo?'#f97316':'#22c55e'};flex-shrink:0">
                  <div style="flex:1;min-width:0">
                    <div style="font-size:12px;font-weight:600;color:var(--text-primary)">${it.descricao}
                      ${isNovo ? '<span style="background:#f97316;color:#fff;border-radius:4px;padding:1px 6px;font-size:9px;margin-left:6px;font-weight:700">NOVO</span>' : ''}
                    </div>
                    <div style="font-size:11px;color:var(--text-muted)">${it.qtd||1} ${it.unidade||'Un'}
                      ${it.adicionado_em ? `<span style="margin-left:6px;opacity:.7">· adicionado ${new Date(it.adicionado_em).toLocaleDateString('pt-BR')}</span>` : ''}
                    </div>
                  </div>
                  <span style="font-size:10px;font-weight:700;${jaProv?'color:#22c55e':isNovo?'color:#f97316':'color:#f59e0b'}">
                    ${jaProv
                      ? '<i class="fas fa-check-circle"></i> Aprovado'
                      : isNovo
                        ? '<i class="fas fa-asterisk"></i> Novo'
                        : '<i class="fas fa-clock"></i> Pendente'}
                  </span>
                </label>`;
            }).join('')}
          </div>

          <!-- Observação -->
          <div style="margin-bottom:12px">
            <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">Observação (opcional)</label>
            <textarea id="farc_det_obs_aprov" rows="2" placeholder="${isReaprovacaoModal ? 'Comentário sobre a aprovação dos itens novos...' : 'Comentário sobre a aprovação...'}"
              style="width:100%;padding:8px 10px;background:var(--bg-primary);border:1px solid var(--border-color);border-radius:6px;color:var(--text-primary);font-size:12px;box-sizing:border-box;resize:vertical"></textarea>
          </div>

          <!-- Botões de ação direto no painel -->
          <div style="display:flex;gap:8px">
            <button onclick="_farcConfirmarAprovarDetalhe('${f.id}')" class="btn btn-success" style="flex:1;font-size:13px;padding:10px">
              <i class="fas fa-check-circle"></i> ${isReaprovacaoModal ? `Aprovar Itens Novos – Estágio ${est}` : `Confirmar Aprovação – Estágio ${est}`}
            </button>
            <button onclick="_farcAbrirReprovarDetalhe('${f.id}')" class="btn btn-danger" style="font-size:13px;padding:10px 16px">
              <i class="fas fa-times-circle"></i> Reprovar
            </button>
          </div>
        </div>
      ` : `
        ${['Aguardando Aprovação','Itens Novos – Reaprovação'].includes(f.status) ? `
          <div style="background:rgba(245,158,11,0.07);border:1px solid rgba(245,158,11,0.25);border-radius:8px;padding:12px 16px;margin-bottom:18px;font-size:12px;color:var(--text-secondary)">
            <i class="fas fa-lock" style="color:#f59e0b;margin-right:6px"></i>
            Aprovação do <strong>Estágio ${est}</strong> requer perfil: <strong>${(est===1?cfg.estagio1?.perfis:est===2?cfg.estagio2?.perfis:cfg.estagio3?.perfis||[]).join(', ')}</strong>.
            Seu perfil atual: <strong>${currentUser?.profile||'—'}</strong>.
          </div>
        ` : ''}
      `}

      <!-- ── PAINEL REPROVAR (oculto inicialmente) ── -->
      <div id="farc-det-reprov-panel" style="display:none;background:rgba(239,68,68,0.06);border:2px solid rgba(239,68,68,0.3);border-radius:10px;padding:16px;margin-bottom:18px">
        <div style="font-size:12px;font-weight:700;color:#dc2626;margin-bottom:10px"><i class="fas fa-times-circle"></i> Reprovar OS – Motivo</div>
        <textarea id="farc_det_motivo_reprov" rows="3" placeholder="Descreva o motivo da reprovação..."
          style="width:100%;padding:8px 10px;background:var(--bg-primary);border:1px solid #fca5a5;border-radius:6px;color:var(--text-primary);font-size:12px;box-sizing:border-box;resize:vertical;margin-bottom:10px"></textarea>
        <div style="display:flex;gap:8px">
          <button onclick="document.getElementById('farc-det-reprov-panel').style.display='none'" class="btn btn-secondary" style="flex:1">Cancelar</button>
          <button onclick="_farcConfirmarReprovarDetalhe('${f.id}')" class="btn btn-danger" style="flex:1"><i class="fas fa-times"></i> Confirmar Reprovação</button>
        </div>
      </div>

      <!-- ── ITENS DE COMPRA ── -->
      <div style="margin-bottom:18px">
        <div style="font-size:11px;font-weight:700;color:var(--text-muted);letter-spacing:.8px;text-transform:uppercase;margin-bottom:10px">
          <i class="fas fa-boxes" style="margin-right:6px"></i>Itens de Compra (${totalItens})
        </div>
        ${totalItens === 0 ? `
          <div style="background:linear-gradient(135deg,rgba(16,185,129,0.08),rgba(16,185,129,0.04));border:2px solid rgba(16,185,129,0.3);border-radius:10px;padding:18px 20px;display:flex;align-items:center;gap:14px">
            <div style="width:44px;height:44px;background:#10b981;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0">
              <i class="fas fa-tools" style="color:#fff;font-size:18px"></i>
            </div>
            <div>
              <div style="font-size:13px;font-weight:700;color:#10b981;margin-bottom:4px">
                <i class="fas fa-info-circle" style="margin-right:6px"></i>OS de Serviço/Trabalho Interno
              </div>
              <div style="font-size:12px;color:var(--text-secondary);line-height:1.6">
                Esta OS <strong>não possui itens de compra/material</strong>. O fluxo é simplificado:<br>
                após aprovação pelos estágios, a OS será marcada como <strong style="color:#10b981">Aprovada – Trabalho Interno</strong><br>
                e a execução estará automaticamente autorizada — <strong>sem necessidade de emitir RC</strong>.
              </div>
            </div>
          </div>
        ` : `
        <div style="border:1px solid var(--border-color);border-radius:8px;overflow:hidden">
          <table style="width:100%;border-collapse:collapse;font-size:12px">
            <thead>
              <tr style="background:var(--bg-tertiary)">
                <th style="padding:8px 12px;text-align:left;color:var(--text-secondary);font-size:11px">Descrição</th>
                <th style="padding:8px 12px;text-align:center;color:var(--text-secondary);font-size:11px">Qtd</th>
                <th style="padding:8px 12px;text-align:center;color:var(--text-secondary);font-size:11px">Un</th>
                <th style="padding:8px 12px;text-align:center;color:var(--text-secondary);font-size:11px">Vl. Unit.</th>
                <th style="padding:8px 12px;text-align:center;color:var(--text-secondary);font-size:11px">Status</th>
              </tr>
            </thead>
            <tbody>
              ${(f.itens||[]).map((it, idx) => {
                const aprov  = it.status_item === 'Aprovado';
                const isNovo = !!it.novo;
                const rowBg  = aprov ? 'rgba(34,197,94,0.03)' : isNovo ? 'rgba(249,115,22,0.05)' : '';
                const rowBorder = isNovo && !aprov ? 'border-left:3px solid #f97316;' : '';
                return `<tr style="border-top:1px solid var(--border-color);${rowBg?'background:'+rowBg+';':''}${rowBorder}">
                  <td style="padding:9px 12px">
                    <span style="font-weight:600;color:var(--text-primary)">${it.descricao}</span>
                    ${isNovo && !aprov ? `<span style="background:#f97316;color:#fff;border-radius:4px;padding:1px 6px;font-size:9px;margin-left:6px;font-weight:700"><i class="fas fa-plus" style="margin-right:2px"></i>NOVO</span>` : ''}
                    ${it.adicionado_em ? `<div style="font-size:10px;color:var(--text-muted);margin-top:2px">Adicionado em ${new Date(it.adicionado_em).toLocaleDateString('pt-BR')}</div>` : ''}
                  </td>
                  <td style="padding:9px 12px;text-align:center;color:var(--text-secondary)">${it.qtd||1}</td>
                  <td style="padding:9px 12px;text-align:center;color:var(--text-secondary)">${it.unidade||'Un'}</td>
                  <td style="padding:9px 12px;text-align:center;color:var(--text-secondary)">${it.valor_unit>0?'R$ '+it.valor_unit.toFixed(2):'—'}</td>
                  <td style="padding:9px 12px;text-align:center">
                    ${aprov
                      ? `<span style="display:inline-flex;align-items:center;gap:4px;background:#dcfce7;color:#16a34a;border-radius:20px;padding:3px 10px;font-size:11px;font-weight:700"><i class="fas fa-check-circle"></i> Aprovado</span>`
                      : isNovo
                        ? `<span style="display:inline-flex;align-items:center;gap:4px;background:rgba(249,115,22,0.15);color:#f97316;border-radius:20px;padding:3px 10px;font-size:11px;font-weight:700"><i class="fas fa-asterisk"></i> Novo – Aguardando</span>`
                        : `<span style="display:inline-flex;align-items:center;gap:4px;background:#fef3c7;color:#d97706;border-radius:20px;padding:3px 10px;font-size:11px;font-weight:700"><i class="fas fa-hourglass-half"></i> Pendente</span>`}
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
        `}
      </div>

      <!-- ── HISTÓRICO ── -->
      <div>
        <div style="font-size:11px;font-weight:700;color:var(--text-muted);letter-spacing:.8px;text-transform:uppercase;margin-bottom:10px">
          <i class="fas fa-history" style="margin-right:6px"></i>Histórico de Ações
        </div>
        <div style="max-height:160px;overflow-y:auto;border:1px solid var(--border-color);border-radius:8px;padding:4px 0">
          ${(f.historico||[]).length === 0 ? `<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:12px">Sem registros</div>` : ''}
          ${(f.historico||[]).map((h, i) => `
            <div style="display:flex;gap:10px;padding:8px 14px;${i>0?'border-top:1px solid var(--border-color)':''}">
              <div style="width:6px;height:6px;background:var(--fa-teal,#00b4b8);border-radius:50%;margin-top:5px;flex-shrink:0"></div>
              <div style="flex:1;font-size:12px;color:var(--text-primary)">${h.acao}</div>
              <div style="font-size:10px;color:var(--text-muted);white-space:nowrap;text-align:right">${h.usuario}<br>${h.data}</div>
            </div>
          `).join('')}
        </div>
      </div>

    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
    ${f.status === 'Aprovada – Aguardando Comprador' && isCompras ? `
      <button class="btn btn-primary" onclick="closeModal();farcEmitirRC('${f.id}')">
        <i class="fas fa-file-alt"></i> Emitir Requisição de Compra
      </button>
    ` : ''}
    ${f.status === 'Aprovada – Trabalho Interno' ? `
      <span style="font-size:11px;padding:7px 12px;background:rgba(16,185,129,0.12);color:#10b981;border-radius:8px;font-weight:600;display:inline-flex;align-items:center;gap:6px">
        <i class="fas fa-check-circle"></i> Execução Autorizada – Sem RC necessária
      </span>
    ` : ''}
    ${['Aguardando Aprovação','Itens Novos – Reaprovação'].includes(f.status) && isCompras ? `
      <button class="btn btn-secondary" onclick="_farcAbrirReprovarDetalhe('${f.id}')">
        <i class="fas fa-times"></i> Reprovar
      </button>
    ` : ''}
  `);
  // Se é trabalho interno e o usuário pode aprovar → rola automaticamente para o painel de aprovação
  const ehTrabalhoInterno = f.trabalho_interno || totalItens === 0;
  if (ehTrabalhoInterno && podAprov) {
    setTimeout(() => {
      const panel = document.getElementById('farc-detalhe-aprov-panel');
      if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 200);
  }
}

// Aprovar diretamente da tela de detalhe
function _farcConfirmarAprovarDetalhe(fluxoId) {
  const lista = _getFluxoOS();
  const idx = lista.findIndex(x => x.id === fluxoId);
  if (idx < 0) return;
  const f = lista[idx];
  const est = f.estagio_atual || 1;
  const isReaprovacao = f.status === 'Itens Novos – Reaprovação';
  const obs = document.getElementById('farc_det_obs_aprov')?.value.trim() || '';
  const hoje = new Date().toLocaleString('pt-BR');

  // Aprova os itens marcados (checkboxes não desabilitados)
  const checkboxes = document.querySelectorAll('.farc-det-item:not(:disabled):checked');
  if (checkboxes.length === 0) {
    showToast('Selecione ao menos um item para aprovar.', 'error');
    return;
  }

  checkboxes.forEach(cb => {
    const realIdx = parseInt(cb.dataset.realIdx);
    if (!isNaN(realIdx) && f.itens[realIdx]) {
      f.itens[realIdx].status_item = 'Aprovado';
      f.itens[realIdx].novo = false; // marca como não-novo após aprovação
    }
  });

  if (!f.estagios_aprovacao) f.estagios_aprovacao = [];
  const labelAcao = isReaprovacao
    ? `Estágio ${est} aprovado (reaprovação – itens novos) por ${currentUser?.name}${obs?' – "'+obs+'"':''}`
    : `Estágio ${est} aprovado por ${currentUser?.name}${obs?' – "'+obs+'"':''}`;
  f.estagios_aprovacao.push({ estagio: est, status: 'Aprovado', aprovador: currentUser?.name, data: hoje, obs, reaprovacao: isReaprovacao });
  f.historico = f.historico || [];
  f.historico.unshift({ acao: labelAcao, usuario: currentUser?.name, data: hoje });

  // Em reaprovação: verifica se todos os itens NOVOS foram aprovados
  // Em aprovação normal: verifica se todos os itens estão aprovados
  const itensPendentes = isReaprovacao
    ? f.itens.filter(i => i.novo && i.status_item !== 'Aprovado')
    : f.itens.filter(i => i.status_item !== 'Aprovado');

  const aprovacaoCompleta = itensPendentes.length === 0;

  if (est >= (f.total_estagios || 3) || aprovacaoCompleta) {
    // Todos os itens (ou todos os novos) aprovados → finaliza
    f.itens.forEach(it => { it.status_item = 'Aprovado'; it.novo = false; });
    f.estagio_atual = 4;

    // REGRA: OS de trabalho interno → encerra sem RC
    if (f.trabalho_interno || (!f.tem_compra_externa && !(f.itens||[]).some(it => it.descricao && it.descricao.trim()))) {
      f.status = 'Aprovada – Trabalho Interno';
      const msgAcao = isReaprovacao
        ? 'Reaprovação concluída – OS de trabalho interno aprovada (sem RC necessária)'
        : 'OS de trabalho interno aprovada – execução autorizada (sem necessidade de RC)';
      f.historico.unshift({ acao: msgAcao, usuario: currentUser?.name, data: hoje });
      const msgToast = isReaprovacao
        ? `✅ OS ${f.os_id} (trabalho interno) reaprovada! Execução autorizada.`
        : `✅ OS ${f.os_id} aprovada! Trabalho interno autorizado (sem emissão de RC).`;
      showToast(msgToast, 'success', 5000);
    } else {
      f.status = 'Aprovada – Aguardando Comprador';
      const msgAcao = isReaprovacao
        ? 'Reaprovação completa – novos itens aprovados · Aguardando emissão de RC pelo Comprador'
        : 'Aprovação completa – Aguardando emissão de RC pelo Comprador';
      f.historico.unshift({ acao: msgAcao, usuario: currentUser?.name, data: hoje });
      const msgToast = isReaprovacao
        ? `✅ Itens novos aprovados! OS ${f.os_id} volta ao Comprador para nova RC.`
        : `✅ OS ${f.os_id} totalmente aprovada! Comprador pode emitir a RC.`;
      showToast(msgToast, 'success', 5000);
    }
    logAction && logAction('Aprovação Final', 'Fluxo Compras', `OS ${f.os_id} aprovada em todos os estágios${isReaprovacao?' (reaprovação)':''}`);
  } else {
    // Ainda há estágios ou itens pendentes
    f.estagio_atual = est + 1;
    f.status = 'Aguardando Aprovação';
    const restantes = f.itens.filter(i => i.status_item !== 'Aprovado').length;
    showToast(`✅ Estágio ${est} aprovado! Avançando para Estágio ${est + 1}. (${restantes} item(ns) ainda pendente(s))`, 'success');
    logAction && logAction('Aprovação Estágio', 'Fluxo Compras', `OS ${f.os_id} – Estágio ${est} aprovado${isReaprovacao?' (reaprovação)':''}`);
  }

  lista[idx] = f;
  _saveFluxoOS(lista);
  closeModal();
  renderFluxoAprovacaoRC();
}

// Abrir painel de reprovação no detalhe
function _farcAbrirReprovarDetalhe(fluxoId) {
  const panel = document.getElementById('farc-det-reprov-panel');
  if (panel) {
    panel.style.display = 'block';
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    document.getElementById('farc_det_motivo_reprov')?.focus();
  }
}

// Confirmar reprovação diretamente do detalhe
function _farcConfirmarReprovarDetalhe(fluxoId) {
  const motivo = document.getElementById('farc_det_motivo_reprov')?.value.trim();
  if (!motivo) { showToast('Informe o motivo da reprovação.', 'error'); return; }
  const lista = _getFluxoOS();
  const idx = lista.findIndex(x => x.id === fluxoId);
  if (idx < 0) return;
  const hoje = new Date().toLocaleString('pt-BR');
  lista[idx].status = 'Rejeitada';
  lista[idx].motivo_rejeicao = motivo;
  lista[idx].historico = lista[idx].historico || [];
  lista[idx].historico.unshift({ acao: `Reprovado por ${currentUser?.name}: ${motivo}`, usuario: currentUser?.name, data: hoje });
  _saveFluxoOS(lista);
  logAction && logAction('Reprovação', 'Fluxo Compras', `OS ${lista[idx].os_id} reprovada: ${motivo}`);
  closeModal();
  showToast('OS reprovada. Solicitante deve revisar e reenviar.', 'warning');
  renderFluxoAprovacaoRC();
}

// ─── APROVAR ESTÁGIO OS ────────────────────────────────────────────────────
function farcAprovarOS(fluxoId) {
  const f = _getFluxoOS().find(x => x.id === fluxoId);
  if (!f) return;
  const cfg = _getConfigAprovacao();
  const est = f.estagio_atual || 1;
  const nomeEst = est===1?cfg.estagio1?.nome:est===2?cfg.estagio2?.nome:cfg.estagio3?.nome;
  const isTrabalhoInterno = f.trabalho_interno || (!f.tem_compra_externa && !(f.itens||[]).length);
  const itensPendentes = (f.itens||[]).filter(i => i.status_item !== 'Aprovado');

  openModal(`Aprovar – ${f.os_id} (${nomeEst||'Estágio '+est})`, `
    <div style="margin-bottom:12px">
      <div style="font-weight:700;color:var(--text-primary);margin-bottom:4px">${f.os_descricao}</div>
      <div style="font-size:12px;color:var(--text-secondary)">
        ${isTrabalhoInterno
          ? '<span style="background:rgba(16,185,129,0.12);color:#10b981;border-radius:6px;padding:2px 8px;font-size:11px;font-weight:700"><i class="fas fa-tools" style="margin-right:4px"></i>Trabalho Interno – sem itens de compra</span>'
          : `${itensPendentes.length} item(ns) aguardando`
        }
      </div>
    </div>

    ${isTrabalhoInterno ? `
    <div style="padding:12px;background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.3);border-radius:8px;margin-bottom:12px;font-size:12px">
      <i class="fas fa-info-circle" style="color:#10b981;margin-right:6px"></i>
      Esta OS é de <strong>trabalho interno</strong>. Após aprovação completa, a execução será autorizada
      <strong>sem necessidade de emitir RC ou RFQ</strong>.
    </div>` : `
    <!-- Itens a aprovar -->
    <div style="margin-bottom:12px;max-height:200px;overflow-y:auto">
      ${itensPendentes.map((it, idx) => `
        <div style="display:flex;align-items:center;gap:8px;padding:8px;border:1px solid var(--border-color);border-radius:8px;margin-bottom:6px">
          <input type="checkbox" id="aprov_item_${idx}" class="farc-aprov-item" value="${idx}" checked style="accent-color:var(--fa-teal)">
          <div style="flex:1;font-size:12px">
            <strong>${it.descricao}</strong>
            <span style="color:var(--text-muted)"> · ${it.qtd||1} ${it.unidade||'Un'}</span>
            ${it.novo ? '<span style="background:#f97316;color:#fff;border-radius:4px;padding:1px 5px;font-size:9px;margin-left:4px">NOVO</span>' : ''}
          </div>
        </div>
      `).join('')}
    </div>`}

    <div style="padding:10px;background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.3);border-radius:8px;margin-bottom:12px;font-size:12px">
      <i class="fas fa-info-circle" style="color:#22c55e;margin-right:6px"></i>
      Aprovando <strong>Estágio ${est}: ${nomeEst}</strong>.
      ${isTrabalhoInterno ? 'Autorize a execução do trabalho interno.' : 'Itens marcados serão aprovados.'}
    </div>
    <div>
      <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Observação (opcional)</label>
      <textarea id="obs_aprov_farc" rows="2" placeholder="Comentário sobre a aprovação..." style="width:100%;padding:8px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:6px;color:var(--text-primary);font-size:12px;box-sizing:border-box;resize:vertical"></textarea>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-danger" onclick="closeModal();farcReprovarOS('${fluxoId}')"><i class="fas fa-times"></i> Reprovar</button>
    <button class="btn btn-success" onclick="_farcConfirmarAprovar('${fluxoId}')"><i class="fas fa-check"></i> Confirmar Aprovação</button>
  `);
}

function _farcConfirmarAprovar(fluxoId) {
  const lista = _getFluxoOS();
  const idx = lista.findIndex(x => x.id === fluxoId);
  if (idx < 0) return;
  const f = lista[idx];
  const est = f.estagio_atual || 1;
  const isReaprovacao = f.status === 'Itens Novos – Reaprovação';
  const isTrabalhoInterno = f.trabalho_interno || (!f.tem_compra_externa && !(f.itens||[]).length);
  const obs = document.getElementById('obs_aprov_farc')?.value.trim() || '';
  const hoje = new Date().toLocaleString('pt-BR');

  // Aprova os itens marcados (somente se houver itens de compra)
  if (!isTrabalhoInterno && f.itens && f.itens.length > 0) {
    const checkboxes = document.querySelectorAll('.farc-aprov-item:checked');
    const itensPendentes = f.itens.filter(i => i.status_item !== 'Aprovado');
    checkboxes.forEach(cb => {
      const itIdx = parseInt(cb.value);
      if (itensPendentes[itIdx]) {
        const realIdx = f.itens.findIndex(i => i === itensPendentes[itIdx]);
        if (realIdx >= 0) {
          f.itens[realIdx].status_item = 'Aprovado';
          f.itens[realIdx].novo = false;
        }
      }
    });
  }

  if (!f.estagios_aprovacao) f.estagios_aprovacao = [];
  f.estagios_aprovacao.push({ estagio: est, status: 'Aprovado', aprovador: currentUser?.name, data: hoje, obs, reaprovacao: isReaprovacao });
  f.historico = f.historico || [];
  f.historico.unshift({ acao: `Estágio ${est} aprovado por ${currentUser?.name}${isReaprovacao?' (reaprovação)':''}`, usuario: currentUser?.name, data: hoje });

  // Em reaprovação verifica se todos os itens NOVOS foram aprovados
  const pendentesRestantes = isTrabalhoInterno
    ? []  // trabalho interno: sem itens, sempre passa
    : (isReaprovacao
      ? f.itens.filter(i => i.novo && i.status_item !== 'Aprovado')
      : f.itens.filter(i => i.status_item !== 'Aprovado'));

  if (est >= (f.total_estagios||3) || pendentesRestantes.length === 0) {
    f.itens && f.itens.forEach(it => { it.status_item = 'Aprovado'; it.novo = false; });
    f.estagio_atual = 4;

    // REGRA: OS de trabalho interno (sem compra externa) → aprovação encerra aqui
    if (isTrabalhoInterno) {
      f.status = 'Aprovada – Trabalho Interno';
      const msgAcao = isReaprovacao
        ? 'Reaprovação concluída – OS de trabalho interno aprovada (sem RC necessária)'
        : 'OS de trabalho interno aprovada – execução autorizada (sem necessidade de RC)';
      f.historico.unshift({ acao: msgAcao, usuario: currentUser?.name, data: hoje });
      showToast(`✅ OS ${f.os_id} aprovada! Trabalho interno autorizado (sem emissão de RC).`, 'success', 5000);
    } else {
      f.status = 'Aprovada – Aguardando Comprador';
      const msgAcao = isReaprovacao
        ? 'Reaprovação concluída – novos itens aprovados · Aguardando RC'
        : 'Aprovação completa – Aguardando emissão de RC pelo Comprador';
      f.historico.unshift({ acao: msgAcao, usuario: currentUser?.name, data: hoje });
      showToast(`✅ OS ${f.os_id} aprovada! Comprador pode emitir a RC.`, 'success', 5000);
    }
    logAction && logAction('Aprovação Final', 'Fluxo Compras', `OS ${f.os_id} aprovada${isReaprovacao?' (reaprovação)':''}`);
  } else {
    f.estagio_atual = est + 1;
    f.status = 'Aguardando Aprovação';
    showToast(`Estágio ${est} aprovado! Avançando para Estágio ${est+1}.`, 'success');
    logAction && logAction('Aprovação Estágio', 'Fluxo Compras', `OS ${f.os_id} – Estágio ${est} aprovado${isReaprovacao?' (reaprovação)':''}`);
  }

  lista[idx] = f;
  _saveFluxoOS(lista);
  closeModal();
  renderFluxoAprovacaoRC();
}

// ─── REPROVAR ESTÁGIO OS ──────────────────────────────────────────────────
function farcReprovarOS(fluxoId) {
  openModal('Reprovar OS no Fluxo', `
    <div style="font-size:13px;color:var(--text-secondary);margin-bottom:12px">
      Informe o motivo da reprovação. A OS voltará ao solicitante para correção/ajuste.
    </div>
    <textarea id="motivo_reprov_farc" rows="3" placeholder="Descreva o motivo da reprovação..." style="width:100%;padding:8px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:6px;color:var(--text-primary);font-size:13px;box-sizing:border-box;resize:vertical"></textarea>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-danger" onclick="_farcConfirmarReprovar('${fluxoId}')"><i class="fas fa-times"></i> Reprovar</button>
  `);
}

function _farcConfirmarReprovar(fluxoId) {
  const motivo = document.getElementById('motivo_reprov_farc')?.value.trim() || 'Sem motivo informado';
  const lista = _getFluxoOS();
  const idx = lista.findIndex(x => x.id === fluxoId);
  if (idx < 0) return;
  const hoje = new Date().toLocaleString('pt-BR');
  lista[idx].status = 'Rejeitada';
  lista[idx].motivo_rejeicao = motivo;
  lista[idx].historico = lista[idx].historico || [];
  lista[idx].historico.unshift({ acao: `Reprovado por ${currentUser?.name}: ${motivo}`, usuario: currentUser?.name, data: hoje });
  _saveFluxoOS(lista);
  logAction && logAction('Reprovação', 'Fluxo Compras', `OS ${lista[idx].os_id} reprovada: ${motivo}`);
  closeModal();
  showToast('OS reprovada. Solicitante deve revisar e reenviar.', 'warning');
  farcSwitchTab('aprovacao');
}

// ─── EMITIR RC (COMPRADOR) ─────────────────────────────────────────────────
function farcEmitirRC(fluxoId) {
  const f = _getFluxoOS().find(x => x.id === fluxoId);
  if (!f) return;
  const cfg = _getConfigAprovacao();
  const itensAprov = (f.itens||[]).filter(i => i.status_item === 'Aprovado');

  openModalWide(`Emitir Requisição de Compra – ${f.os_id}`, `
    <div style="background:rgba(59,130,246,0.06);border:1px solid rgba(59,130,246,0.2);border-radius:8px;padding:12px;margin-bottom:14px;font-size:12px;color:var(--blue-light)">
      <i class="fas fa-info-circle" style="margin-right:6px"></i>
      Todos os itens aprovados abaixo serão incluídos na RC. Você pode ajustar quantidades e preços unitários estimados.
    </div>

    <div style="display:flex;gap:12px;margin-bottom:12px;flex-wrap:wrap">
      <div style="flex:2;min-width:180px">
        <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">Título da RC *</label>
        <input class="form-control" id="farc_rc_titulo" value="RC – ${f.os_id}: ${f.os_descricao.substring(0,60)}">
      </div>
      <div style="flex:1;min-width:120px">
        <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">Contrato</label>
        <input class="form-control" id="farc_rc_contrato" value="${f.os_contrato}">
      </div>
      <div style="flex:1;min-width:120px">
        <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">Prazo de Necessidade *</label>
        <input class="form-control" id="farc_rc_prazo" type="date" value="${new Date(Date.now()+7*864e5).toISOString().split('T')[0]}">
      </div>
    </div>

    <div style="display:flex;gap:12px;margin-bottom:12px;flex-wrap:wrap">
      <div style="flex:1;min-width:120px">
        <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">Tipo</label>
        <select class="form-control" id="farc_rc_tipo">
          <option value="material">Material</option>
          <option value="servico">Serviço Externo</option>
          <option value="misto">Material + Serviço</option>
        </select>
      </div>
      <div style="flex:1;min-width:120px">
        <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">Urgência</label>
        <select class="form-control" id="farc_rc_urgencia">
          <option>Normal</option>
          <option>Urgente</option>
          <option>Crítico</option>
        </select>
      </div>
    </div>

    <!-- Itens aprovados -->
    <div style="font-size:12px;font-weight:700;color:var(--text-secondary);margin-bottom:8px">
      ITENS APROVADOS (${itensAprov.length})
    </div>
    <div id="farc_itens_rc">
      ${itensAprov.map((it, i) => `
        <div class="farc-item-rc" style="background:var(--bg-card2);padding:10px 12px;border-radius:8px;margin-bottom:6px;display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap">
          <div style="flex:3;min-width:180px">
            ${i===0?'<label style="font-size:10px;color:var(--text-muted)">Descrição</label>':''}
            <input class="form-control farc-item-desc" value="${it.descricao}" placeholder="Descrição">
          </div>
          <div style="flex:0.8;min-width:70px">
            ${i===0?'<label style="font-size:10px;color:var(--text-muted)">Qtd</label>':''}
            <input class="form-control farc-item-qtd" type="number" min="1" value="${it.qtd||1}" oninput="_farcCalcTotal()">
          </div>
          <div style="flex:0.6;min-width:55px">
            ${i===0?'<label style="font-size:10px;color:var(--text-muted)">Un</label>':''}
            <input class="form-control farc-item-un" value="${it.unidade||'Un'}">
          </div>
          <div style="flex:1.2;min-width:100px">
            ${i===0?'<label style="font-size:10px;color:var(--text-muted)">Valor Unit. (R$)</label>':''}
            <input class="form-control farc-item-val" type="number" min="0" step="0.01" value="${it.valor_unit||0}" oninput="_farcCalcTotal()">
          </div>
          <div style="flex:1;min-width:110px">
            ${i===0?'<label style="font-size:10px;color:var(--text-muted)">Tipo</label>':''}
            <select class="form-control farc-item-tipo" style="font-size:12px;padding:6px 8px">
              <option value="material" ${(it.tipo_item||'material')==='material'?'selected':''}>📦 Material</option>
              <option value="servico"  ${(it.tipo_item||'')==='servico'?'selected':''}>🔧 Serviço</option>
            </select>
          </div>
          <div style="flex:1.5;min-width:140px">
            ${i===0?'<label style="font-size:10px;color:#3b82f6;display:flex;align-items:center;gap:3px"><i class=\'fas fa-sitemap\'></i> Linha WBS</label>':''}
            <select class="form-control farc-item-wbs" style="font-size:11px;padding:4px 6px">
              ${_farcWBSInlineOptions(it.wbs_codigo||'')}
            </select>
          </div>
          <div style="flex:0.3">
            <button class="btn btn-danger btn-sm btn-icon" onclick="this.closest('.farc-item-rc').remove();_farcCalcTotal()" title="Remover"><i class="fas fa-trash"></i></button>
          </div>
        </div>
      `).join('')}
    </div>
    <button onclick="_farcAdicionarItemRC()" class="btn btn-secondary btn-sm" style="margin-top:6px"><i class="fas fa-plus"></i> Adicionar Item</button>

    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:rgba(59,130,246,0.06);border-radius:8px;margin-top:12px;margin-bottom:10px">
      <span style="font-size:12px;color:var(--text-muted)">Total Estimado:</span>
      <span id="farc_total_rc" style="font-size:20px;font-weight:700;color:#3b82f6">R$ 0,00</span>
    </div>

    <div>
      <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">Justificativa / Observações</label>
      <textarea class="form-control" id="farc_rc_obs" rows="2" placeholder="Motivo da compra, referências, etc..."></textarea>
    </div>
    <div id="farc_rc_erro" style="display:none;color:#ef4444;font-size:12px;padding:8px 12px;background:rgba(239,68,68,0.1);border-radius:6px;margin-top:8px"></div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="_farcSalvarRC('${fluxoId}')"><i class="fas fa-paper-plane"></i> Emitir Requisição</button>
  `);

  setTimeout(() => _farcCalcTotal(), 100);
}

function _farcAdicionarItemRC() {
  const cont = document.getElementById('farc_itens_rc');
  if (!cont) return;
  const div = document.createElement('div');
  div.innerHTML = `
    <div class="farc-item-rc" style="background:var(--bg-card2);padding:10px 12px;border-radius:8px;margin-bottom:6px;display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap">
      <div style="flex:3;min-width:180px"><input class="form-control farc-item-desc" placeholder="Descrição do item"></div>
      <div style="flex:0.8;min-width:70px"><input class="form-control farc-item-qtd" type="number" min="1" value="1" oninput="_farcCalcTotal()"></div>
      <div style="flex:0.6;min-width:55px"><input class="form-control farc-item-un" value="Un"></div>
      <div style="flex:1.2;min-width:100px"><input class="form-control farc-item-val" type="number" min="0" step="0.01" value="0" oninput="_farcCalcTotal()"></div>
      <div style="flex:1;min-width:110px"><select class="form-control farc-item-tipo" style="font-size:12px;padding:6px 8px"><option value="material">📦 Material</option><option value="servico">🔧 Serviço</option></select></div>
      <div style="flex:1.5;min-width:140px"><select class="form-control farc-item-wbs" style="font-size:11px;padding:4px 6px">${_farcWBSInlineOptions()}</select></div>
      <div style="flex:0.3"><button class="btn btn-danger btn-sm btn-icon" onclick="this.closest('.farc-item-rc').remove();_farcCalcTotal()"><i class="fas fa-trash"></i></button></div>
    </div>
  `;
  cont.appendChild(div.firstElementChild);
}

function _farcCalcTotal() {
  const qtds = document.querySelectorAll('#farc_itens_rc .farc-item-qtd');
  const vals = document.querySelectorAll('#farc_itens_rc .farc-item-val');
  let total = 0;
  qtds.forEach((q, i) => { total += (parseFloat(q.value)||0) * (parseFloat(vals[i]?.value)||0); });
  const el = document.getElementById('farc_total_rc');
  if (el) el.textContent = _fmtVal(total);
}

function _farcSalvarRC(fluxoId) {
  const titulo  = document.getElementById('farc_rc_titulo')?.value.trim();
  const prazo   = document.getElementById('farc_rc_prazo')?.value;
  const erroEl  = document.getElementById('farc_rc_erro');
  const mostrarErro = m => { if(erroEl){erroEl.textContent=m;erroEl.style.display='block';} };

  if (!titulo) { mostrarErro('Informe o título da RC.'); return; }
  if (!prazo)  { mostrarErro('Informe o prazo de necessidade.'); return; }

  const itens = [];
  document.querySelectorAll('#farc_itens_rc .farc-item-rc').forEach(row => {
    const desc = row.querySelector('.farc-item-desc')?.value.trim();
    if (desc) {
      const qtd      = parseFloat(row.querySelector('.farc-item-qtd')?.value)||1;
      const val      = parseFloat(row.querySelector('.farc-item-val')?.value)||0;
      const un       = row.querySelector('.farc-item-un')?.value.trim()||'Un';
      const tipoItem = row.querySelector('.farc-item-tipo')?.value || 'material';
      const wbsSel   = row.querySelector('.farc-item-wbs');
      const wbsCod   = wbsSel?.value || '';
      const wbsDesc  = wbsSel?.options[wbsSel?.selectedIndex]?.text?.replace(/^\s*└\s*/,'').trim() || '';
      itens.push({ descricao: desc, qtd, unidade: un, valor_unit: val, total: qtd*val,
                   tipo_item: tipoItem, status_item: 'Pendente',
                   wbs_codigo: wbsCod, wbs_descricao: wbsDesc });
    }
  });

  if (!itens.length) { mostrarErro('Adicione pelo menos um item.'); return; }

  const valorTotal = itens.reduce((a, i) => a+i.total, 0);
  const rcLista    = _obterRCLocal();
  const numero     = typeof _gerarNumeroRC === 'function' ? _gerarNumeroRC() : `RC-${new Date().getFullYear()}-${String(rcLista.length+1).padStart(4,'0')}`;

  const novaRC = {
    id: typeof gerarId === 'function' ? gerarId('RC') : 'RC-'+Date.now(),
    numero,
    titulo,
    contrato: document.getElementById('farc_rc_contrato')?.value || 'Geral',
    solicitante: currentUser?.name || 'Sistema',
    departamento: currentUser?.role || '',
    prazo_necessidade: new Date(prazo+'T12:00:00').toLocaleDateString('pt-BR'),
    tipo: document.getElementById('farc_rc_tipo')?.value || 'material',
    urgencia: document.getElementById('farc_rc_urgencia')?.value || 'Normal',
    observacoes: document.getElementById('farc_rc_obs')?.value.trim() || '',
    itens,
    valor_total: valorTotal,
    status: 'Aprovada – Aguardando Comprador',
    estagio_atual: 4,
    total_estagios: 3,
    estagios_aprovacao: [
      { estagio: 1, status:'Aprovado', aprovador:'Fluxo OS', data: new Date().toLocaleString('pt-BR'), obs:'Aprovado via fluxo de OS' },
      { estagio: 2, status:'Aprovado', aprovador:'Fluxo OS', data: new Date().toLocaleString('pt-BR'), obs:'Aprovado via fluxo de OS' },
      { estagio: 3, status:'Aprovado', aprovador:'Fluxo OS', data: new Date().toLocaleString('pt-BR'), obs:'Aprovado via fluxo de OS' }
    ],
    os_vinculada: (function() { const f = _getFluxoOS().find(x => x.id === fluxoId); return f?.os_id || ''; })(),
    criado_por: currentUser?.name,
    data_criacao: new Date().toISOString(),
    historico: [{ acao: `RC emitida pelo Comprador a partir do Fluxo – ${fluxoId}`, usuario: currentUser?.name, data: new Date().toLocaleString('pt-BR') }]
  };

  rcLista.unshift(novaRC);
  if (typeof _saveRC === 'function') _saveRC(rcLista);

  // Atualiza fluxo OS
  const fluxo = _getFluxoOS();
  const fIdx = fluxo.findIndex(x => x.id === fluxoId);
  if (fIdx >= 0) {
    if (!fluxo[fIdx].rcs_geradas) fluxo[fIdx].rcs_geradas = [];
    fluxo[fIdx].rcs_geradas.push(numero);
    fluxo[fIdx].status = 'RC Emitida';
    fluxo[fIdx].historico = fluxo[fIdx].historico || [];
    fluxo[fIdx].historico.unshift({ acao: `RC ${numero} emitida pelo comprador`, usuario: currentUser?.name, data: new Date().toLocaleString('pt-BR') });
    _saveFluxoOS(fluxo);
  }

  logAction && logAction('Emissão RC', 'Compras', `${numero} – ${titulo} (${_fmtVal(valorTotal)})`);
  closeModal();
  showToast(`✅ RC ${numero} emitida! Redirecionando para Cotações…`, 'success', 4000);
  // Redireciona para a aba Cotações (rfq) onde o comprador pode aceitar e criar RFQ
  setTimeout(() => {
    if (typeof navigate === 'function') navigate('rfq');
    else farcSwitchTab('cotacoes');
  }, 600);
}

// ════════════════════════════════════════════════════════════════════════════
// ABA 2 – EMISSÃO DE REQUISIÇÕES
// Exibe OS aprovadas (com itens aprovados) para o perfil autorizado abrir RC
// Solicitante só acompanha status – sem botão de cotação
// ════════════════════════════════════════════════════════════════════════════
function _farcRenderTabEmissao() {
  const rcs        = (_obterRCLocal());
  const fluxoOS    = _getFluxoOS();
  const podeEmitir = _podeEmitirRC();
  const podeProc   = _podeProcessarRC();

  // OS com pelo menos algum item aprovado OU já com RC criada (para mostrar histórico)
  const osComItensAprovados = fluxoOS.filter(f =>
    (f.itens||[]).some(it => it.status_item === 'Aprovado' || it.status_item === 'RC Criada')
  );
  // RC criadas a partir de OS (vinculadas)
  const rcsDeOS = rcs.filter(r => r.os_vinculada);

  // Contadores de status para as mini-abas
  const statusGroups = [
    { key: 'todas',       label: 'Todas',                    color: '#8b949e', count: rcs.length },
    { key: 'rascunho',    label: 'Rascunho',                 color: '#6b7280', count: rcs.filter(r=>r.status==='Rascunho').length },
    { key: 'aguard_aprv', label: 'Aguardando Aprovação',     color: '#f59e0b', count: rcs.filter(r=>r.status==='Aguardando Aprovação').length },
    { key: 'aguard_comp', label: 'Aprovada – Ag. Comprador', color: '#3b82f6', count: rcs.filter(r=>r.status==='Aprovada – Aguardando Comprador').length },
    { key: 'em_cotacao',  label: 'Em Cotação',               color: '#6366f1', count: rcs.filter(r=>['RFQ Criado','Em Cotação'].includes(r.status)).length },
    { key: 'em_andamento',label: 'Em Andamento',             color: '#10b981', count: rcs.filter(r=>['Mapa Criado','Mapa Aprovado','PC Emitido'].includes(r.status)).length },
    { key: 'rejeitada',   label: 'Rejeitada',                color: '#ef4444', count: rcs.filter(r=>r.status==='Rejeitada').length },
  ].filter(g => g.count > 0 || g.key === 'todas');

  return `
    <div style="padding:16px">

      <!-- ── MINI ABAS DE STATUS ── -->
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--border-color)">
        ${statusGroups.map(g => `
          <button onclick="_farcFiltrarEmissaoStatus('${g.key}')"
            id="farc_status_tab_${g.key}"
            style="padding:5px 12px;border-radius:20px;font-size:11px;font-weight:600;border:1px solid ${g.color}44;
                   background:${g.key==='todas'?g.color+'22':'transparent'};color:${g.color};cursor:pointer;transition:.2s;white-space:nowrap"
            onmouseover="this.style.background='${g.color}22'"
            onmouseout="if(!this.dataset.active) this.style.background='transparent'">
            ${g.label}
            ${g.count>0?`<span style="background:${g.color};color:#fff;border-radius:10px;padding:1px 6px;margin-left:4px;font-size:10px">${g.count}</span>`:''}
          </button>
        `).join('')}
        <div style="flex:1;min-width:160px;display:flex;gap:6px;justify-content:flex-end;align-items:center">
          <input type="text" id="farc_search_emissao" placeholder="Buscar RC..." oninput="_farcFiltrarEmissao()"
            style="padding:5px 10px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:12px;width:150px">
          <button onclick="_farcExportarRC()" class="btn btn-secondary btn-sm" title="Exportar CSV"><i class="fas fa-file-excel"></i></button>
          <!-- MELHORIA 1: Botão Nova RC removido do Fluxo de Aprovação. Use a aba Emissão de Requisições -->
        </div>
      </div>

      <!-- ── SEÇÃO: OS COM ITENS APROVADOS ── -->
      ${osComItensAprovados.length > 0 ? `
        <div style="margin-bottom:20px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">
            <div>
              <div style="font-size:13px;font-weight:700;color:var(--text-primary)">
                <i class="fas fa-clipboard-check" style="color:#22c55e;margin-right:8px"></i>
                OS com Itens Aprovados Pendentes de RC
                <span style="background:#22c55e22;color:#22c55e;border-radius:10px;padding:2px 8px;font-size:11px;margin-left:6px">${osComItensAprovados.length}</span>
              </div>
              <div style="font-size:11px;color:var(--text-muted);margin-top:2px">
                Para emitir uma RC, acesse a aba <a onclick="navigate('requisicoes')" href="#" style="color:#3b82f6;font-weight:700;"><i class="fas fa-external-link-alt" style="font-size:10px;margin-right:3px"></i>Emissão de Requisições</a> no menu lateral.
              </div>
            </div>
            <input type="text" id="farc_search_os_emissao" placeholder="Filtrar OS..." oninput="_farcFiltrarOSEmissao()"
              style="padding:6px 10px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:12px;width:160px">
          </div>
          <div id="farc_lista_os_emissao">
            ${_farcRenderOSParaEmissao(osComItensAprovados, rcsDeOS, podeEmitir)}
          </div>
        </div>
      ` : ''}

      <!-- ── SEÇÃO: RC GERADAS (ACOMPANHAMENTO DE STATUS) ── -->
      <div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:8px">
          <div style="font-size:13px;font-weight:700;color:var(--text-primary)">
            <i class="fas fa-file-alt" style="color:#3b82f6;margin-right:8px"></i>
            Requisições de Compra
            <span style="font-size:11px;color:var(--text-muted);font-weight:400;margin-left:6px">${rcs.length} RC(s)</span>
          </div>
        </div>

        ${podeProc && rcs.filter(r=>r.status==='Aprovada – Aguardando Comprador').length > 0 ? `
          <div style="background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.3);border-radius:10px;padding:12px 16px;margin-bottom:12px">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;flex-wrap:wrap;gap:8px">
              <div style="font-size:13px;font-weight:700;color:#3b82f6">
                <i class="fas fa-inbox" style="margin-right:6px"></i>
                ${rcs.filter(r=>r.status==='Aprovada – Aguardando Comprador').length} RC(s) aprovada(s) – prontas para cotação
              </div>
              <button onclick="navigate('rfq')" class="btn btn-primary btn-sm">
                <i class="fas fa-paper-plane" style="margin-right:5px"></i>Ir para Aba Cotações (RFQ)
              </button>
            </div>
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:10px">
              <i class="fas fa-info-circle" style="color:#3b82f6;margin-right:5px"></i>
              Para criar RFQ e iniciar cotação, acesse <strong style="color:#6366f1">Cotações (RFQ)</strong>.
            </div>
            ${rcs.filter(r=>r.status==='Aprovada – Aguardando Comprador').slice(0,3).map(r => `
              <div style="display:flex;align-items:center;gap:10px;padding:8px;background:rgba(0,0,0,0.2);border-radius:8px;margin-bottom:6px">
                <div style="flex:1">
                  <div style="font-size:12px;font-weight:600;color:var(--text-primary)">${r.numero} – ${r.titulo}</div>
                  <div style="font-size:11px;color:var(--text-muted)">${r.solicitante} · ${r.itens?.length||0} itens · ${_fmtVal(r.valor_total)}</div>
                </div>
                ${_statusBadgeFluxo(r.status)}
                <button onclick="farcVerDetalheRC('${r.id}')" class="btn btn-secondary btn-sm btn-icon" title="Ver detalhes da RC"><i class="fas fa-eye"></i></button>
              </div>
            `).join('')}
          </div>
        ` : ''}

        <!-- Tabela de RCs -->
        <div id="farc_tabela_emissao">
          ${_farcTabelaRC(rcs)}
        </div>
      </div>
    </div>
  `;
}

// Filtrar tabela de RCs por aba de status
function _farcFiltrarEmissaoStatus(statusKey) {
  // Atualiza visual das abas
  document.querySelectorAll('[id^="farc_status_tab_"]').forEach(btn => {
    btn.dataset.active = '';
    btn.style.background = 'transparent';
  });
  const ativo = document.getElementById(`farc_status_tab_${statusKey}`);
  if (ativo) { ativo.dataset.active = '1'; ativo.style.background = ativo.style.color + '22'; }

  const rcs = _obterRCLocal();
  let filtrado;
  switch (statusKey) {
    case 'rascunho':      filtrado = rcs.filter(r => r.status === 'Rascunho'); break;
    case 'aguard_aprv':   filtrado = rcs.filter(r => r.status === 'Aguardando Aprovação'); break;
    case 'aguard_comp':   filtrado = rcs.filter(r => r.status === 'Aprovada – Aguardando Comprador'); break;
    case 'em_cotacao':    filtrado = rcs.filter(r => ['RFQ Criado','Em Cotação'].includes(r.status)); break;
    case 'em_andamento':  filtrado = rcs.filter(r => ['Mapa Criado','Mapa Aprovado','PC Emitido'].includes(r.status)); break;
    case 'rejeitada':     filtrado = rcs.filter(r => r.status === 'Rejeitada'); break;
    default:              filtrado = rcs;
  }
  const el = document.getElementById('farc_tabela_emissao');
  if (el) el.innerHTML = _farcTabelaRC(filtrado);
}

// Renderiza cards de OS para emissão de RC
function _farcRenderOSParaEmissao(lista, rcsDeOS, podeEmitir) {
  if (!lista.length) {
    return `
      <div style="text-align:center;padding:30px;color:var(--text-muted);background:var(--bg-card2);border-radius:10px;border:1px dashed var(--border-color)">
        <i class="fas fa-clipboard-list" style="font-size:28px;display:block;margin-bottom:8px;opacity:.4"></i>
        <div style="font-size:13px;font-weight:600">Nenhuma OS com itens aprovados</div>
        <div style="font-size:11px;margin-top:4px">Quando OS forem aprovadas, os itens aparecerão aqui para emissão de RC</div>
      </div>
    `;
  }

  return lista.map(f => {
    const itensAprov    = (f.itens||[]).filter(it => it.status_item === 'Aprovado');
    const itensRCCriada = (f.itens||[]).filter(it => it.status_item === 'RC Criada');
    const rcsVinc    = rcsDeOS.filter(r => r.os_vinculada === f.os_id);
    // Também verifica RCs na lista do fluxo
    const rcsFluxo   = (f.rcs || []);
    const totalRCs   = Math.max(rcsVinc.length, rcsFluxo.length);
    const temItensDisp = itensAprov.length > 0;

    const statusColor = {
      'Aguardando Aprovação': '#f59e0b',
      'Aprovada – Aguardando Comprador': '#3b82f6',
      'Em Cotação': '#6366f1',
      'RFQ Criado': '#0ea5e9',
      'Mapa Criado': '#7c3aed',
      'Mapa Aprovado': '#10b981',
      'PC Emitido': '#22c55e',
      'RC Emitida': '#22c55e',
      'RC Criada': '#22c55e',
    };
    const cor = statusColor[f.status] || '#8b949e';

    return `
      <div style="border:1px solid var(--border-color);border-radius:10px;margin-bottom:12px;overflow:hidden;border-left:3px solid ${cor}">
        <!-- Header OS -->
        <div style="padding:12px 16px;background:var(--bg-card2);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
          <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
            <div>
              <span style="font-size:13px;font-weight:700;color:${cor}">${f.os_id || f.id}</span>
              <span style="font-size:12px;color:var(--text-secondary);margin-left:8px">${(f.os_descricao||'').substring(0,60)}${(f.os_descricao?.length||0)>60?'...':''}</span>
            </div>
            <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
              ${_statusBadgeFluxo(f.status)}
              ${temItensDisp ? `
                <span style="font-size:10px;background:rgba(34,197,94,0.15);color:#22c55e;border-radius:6px;padding:2px 7px;font-weight:700">
                  <i class="fas fa-check" style="margin-right:3px"></i>${itensAprov.length} disponível(is) para RC
                </span>
              ` : `
                <span style="font-size:10px;background:rgba(107,114,128,0.15);color:#6b7280;border-radius:6px;padding:2px 7px;font-weight:700">
                  <i class="fas fa-check-double" style="margin-right:3px"></i>Todos os itens em RC
                </span>
              `}
              ${itensRCCriada.length > 0 ? `
                <span style="font-size:10px;background:rgba(59,130,246,0.12);color:#3b82f6;border-radius:6px;padding:2px 7px;font-weight:700">
                  <i class="fas fa-file-alt" style="margin-right:3px"></i>${itensRCCriada.length} item(ns) em RC
                </span>
              ` : ''}
              ${totalRCs > 0 ? `<span style="font-size:10px;background:rgba(59,130,246,0.08);color:#3b82f6;border-radius:6px;padding:2px 7px">
                ${totalRCs} RC(s) gerada(s)
              </span>` : ''}
            </div>
          </div>
          <div style="display:flex;gap:6px">
            <button onclick="farcVerDetalheOS('${f.id}')" class="btn btn-secondary btn-sm btn-icon" title="Ver OS"><i class="fas fa-eye"></i></button>
            ${podeEmitir && temItensDisp ? `
              <button onclick="farcAbrirNovaRCdeOS('${f.id}')" class="btn btn-primary btn-sm" title="Criar nova RC com itens disponíveis">
                <i class="fas fa-plus"></i> Nova RC
              </button>
            ` : podeEmitir && !temItensDisp ? `
              <button class="btn btn-sm" style="background:var(--bg-tertiary);color:var(--text-muted);border:1px solid var(--border-color);cursor:not-allowed" disabled title="Todos os itens já possuem RC">
                <i class="fas fa-check-double"></i> RC(s) Criada(s)
              </button>
            ` : ''}
          </div>
        </div>

        <!-- Itens disponíveis para RC -->
        ${temItensDisp ? `
          <div style="padding:10px 16px">
            <div style="font-size:11px;color:#22c55e;font-weight:700;text-transform:uppercase;margin-bottom:8px;display:flex;align-items:center;gap:6px">
              <i class="fas fa-check-circle"></i>Disponíveis para RC
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:6px">
              ${itensAprov.map(it => `
                <div style="background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.25);border-radius:6px;padding:4px 10px;font-size:11px;color:var(--text-primary)">
                  <i class="fas fa-circle-check" style="color:#22c55e;margin-right:4px;font-size:10px"></i>
                  <strong>${it.descricao}</strong>
                  <span style="color:var(--text-muted)"> · ${it.qtd||1} ${it.unidade||'Un'}</span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Itens já em RC -->
        ${itensRCCriada.length > 0 ? `
          <div style="padding:${temItensDisp?'0':'10px'} 16px 10px;${temItensDisp?'border-top:1px solid var(--border-color)':''}">
            <div style="font-size:11px;color:var(--text-muted);font-weight:700;text-transform:uppercase;margin-bottom:8px;display:flex;align-items:center;gap:6px">
              <i class="fas fa-lock"></i>Já em Requisição de Compra
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:6px">
              ${itensRCCriada.map(it => `
                <div style="background:rgba(107,114,128,0.08);border:1px solid rgba(107,114,128,0.2);border-radius:6px;padding:4px 10px;font-size:11px;color:var(--text-muted)">
                  <i class="fas fa-file-alt" style="color:#6b7280;margin-right:4px;font-size:10px"></i>
                  ${it.descricao}
                  <span> · ${it.qtd||1} ${it.unidade||'Un'}</span>
                  ${it.rc_numero ? `<span style="color:#3b82f6;margin-left:4px">(${it.rc_numero})</span>` : ''}
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- RCs vinculadas (se houver) -->
        ${rcsVinc.length > 0 ? `
          <div style="padding:0 16px 10px;border-top:1px solid var(--border-color)">
            <div style="font-size:11px;color:var(--text-muted);font-weight:700;text-transform:uppercase;margin-bottom:6px">Requisições Abertas</div>
            <div style="display:flex;flex-direction:column;gap:4px">
              ${rcsVinc.map(r => `
                <div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:var(--bg-secondary);border-radius:6px;font-size:12px">
                  <span style="font-weight:700;color:#3b82f6">${r.numero}</span>
                  <span style="color:var(--text-secondary);flex:1">${(r.titulo||'').substring(0,50)}</span>
                  <span style="color:var(--text-muted)">${r.itens?.length||0} itens</span>
                  ${_statusBadgeFluxo(r.status)}
                  <button onclick="farcVerDetalheRC('${r.id}')" class="btn btn-secondary btn-sm btn-icon" title="Ver RC"><i class="fas fa-eye"></i></button>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

function _farcFiltrarOSEmissao() {
  const s = (document.getElementById('farc_search_os_emissao')?.value || '').toLowerCase();
  const fluxoOS   = _getFluxoOS();
  const rcsDeOS   = (_obterRCLocal()).filter(r => r.os_vinculada);
  const podeEmitir = _podeEmitirRC();
  const lista = fluxoOS.filter(f =>
    (f.itens||[]).some(it => it.status_item === 'Aprovado' || it.status_item === 'RC Criada') &&
    (!s || ((f.os_id||'')+(f.os_descricao||'')).toLowerCase().includes(s))
  );
  const el = document.getElementById('farc_lista_os_emissao');
  if (el) el.innerHTML = _farcRenderOSParaEmissao(lista, rcsDeOS, podeEmitir);
}

// ─── HELPER: busca estoque de um item no almoxarifado ─────────────────────────
function _farcChecarEstoqueItem(descricao) {
  try {
    const materiais = JSON.parse(localStorage.getItem('fa_materiais') || '[]');
    const estoque   = JSON.parse(localStorage.getItem('fa_estoque_v2') || '{}');
    const desc = (descricao || '').toLowerCase().trim();
    const mat = materiais.find(m =>
      (m.nome || '').toLowerCase().includes(desc) ||
      (m.descricao || '').toLowerCase().includes(desc) ||
      desc.includes((m.nome || '').toLowerCase())
    );
    if (!mat) return { encontrado: false, emEstoque: false, qtdEstoque: 0, estoqueMin: 0, mat: null };
    const qtdEstoque = estoque[mat.id] !== undefined ? Number(estoque[mat.id]) : (mat.estoque_atual || 0);
    const estoqueMin = mat.estoque_minimo || mat.estoque_min || 0;
    return { encontrado: true, emEstoque: qtdEstoque > 0, qtdEstoque, estoqueMin, mat };
  } catch(e) { return { encontrado: false, emEstoque: false, qtdEstoque: 0, estoqueMin: 0, mat: null }; }
}

// ─── HELPER: determina tipo de item (material ou serviço) ─────────────────────
function _farcTipoItem(it) {
  const tipo = (it.tipo || it.tipo_item || '').toLowerCase();
  const desc = (it.descricao || '').toLowerCase();
  if (tipo.includes('serv') || tipo.includes('ext') || tipo.includes('tercei')) return 'servico';
  if (tipo.includes('mat') || tipo.includes('mater')) return 'material';
  // Heurística pela descrição
  const palavrasServico = ['serviço','serviço','instalação','manutenção','consultoria','locação','aluguel','treinamento','transporte','limpeza','vigilância'];
  if (palavrasServico.some(p => desc.includes(p))) return 'servico';
  return 'material'; // padrão é material
}

// ─── MODAL PARA ABRIR RC A PARTIR DE OS APROVADA ──────────────────────────────
function farcAbrirNovaRCdeOS(fluxoId) {
  const f = _getFluxoOS().find(x => x.id === fluxoId);
  if (!f) return;

  if (!_podeEmitirRC()) {
    showToast('Seu perfil não tem permissão para emitir RC.', 'error');
    return;
  }

  // Itens ainda disponíveis para RC (status_item = 'Aprovado', não 'RC Criada')
  const itensAprov    = (f.itens||[]).filter(it => it.status_item === 'Aprovado');
  // Itens já convertidos em RC
  const itensRCCriada = (f.itens||[]).filter(it => it.status_item === 'RC Criada');

  if (itensAprov.length === 0) {
    showToast('Todos os itens aprovados desta OS já foram incluídos em RCs.', 'info', 4000);
    return;
  }

  const hoje = new Date().toISOString().split('T')[0];

  // Enriquecer itens com info de estoque e tipo
  const itensEnriquecidos = itensAprov.map(it => {
    const tipo = _farcTipoItem(it);
    const estoque = tipo === 'material' ? _farcChecarEstoqueItem(it.descricao) : null;
    return { ...it, _tipo: tipo, _estoque: estoque };
  });

  const itensMaterial = itensEnriquecidos.filter(it => it._tipo === 'material');
  const itensServico  = itensEnriquecidos.filter(it => it._tipo === 'servico');
  const itensComEstoque = itensMaterial.filter(it => it._estoque?.emEstoque);
  const itensSemEstoque = itensMaterial.filter(it => !it._estoque?.emEstoque);

  // Monta HTML das linhas de itens com badges de estoque/tipo
  function _rowItem(it, idx) {
    const est = it._estoque;
    let estoqueHTML = '';
    let alertaEstoque = '';
    if (it._tipo === 'material') {
      if (est?.encontrado && est?.emEstoque) {
        estoqueHTML = `<span style="background:#22c55e22;color:#22c55e;border-radius:5px;padding:2px 7px;font-size:10px;font-weight:700;margin-left:6px">
          <i class="fas fa-warehouse" style="margin-right:3px"></i>Em Estoque (${est.qtdEstoque} ${it.unidade||'Un'})
        </span>`;
        alertaEstoque = `<div style="font-size:10px;color:#22c55e;margin-top:3px">
          <i class="fas fa-info-circle" style="margin-right:3px"></i>
          Verificar se o estoque atende à demanda antes de emitir RC.
        </div>`;
      } else if (est?.encontrado && !est?.emEstoque) {
        estoqueHTML = `<span style="background:#f59e0b22;color:#d97706;border-radius:5px;padding:2px 7px;font-size:10px;font-weight:700;margin-left:6px">
          <i class="fas fa-exclamation-triangle" style="margin-right:3px"></i>Sem Estoque
        </span>`;
      } else {
        estoqueHTML = `<span style="background:#6b728022;color:#6b7280;border-radius:5px;padding:2px 7px;font-size:10px;font-weight:700;margin-left:6px">
          <i class="fas fa-question-circle" style="margin-right:3px"></i>Não cadastrado
        </span>`;
      }
    }
    const tipoBadge = it._tipo === 'servico'
      ? `<span style="background:#6366f122;color:#6366f1;border-radius:5px;padding:2px 7px;font-size:10px;font-weight:700;margin-left:4px"><i class="fas fa-tools" style="margin-right:3px"></i>Serviço</span>`
      : `<span style="background:#0ea5e922;color:#0ea5e9;border-radius:5px;padding:2px 7px;font-size:10px;font-weight:700;margin-left:4px"><i class="fas fa-box" style="margin-right:3px"></i>Material</span>`;

    // Campo grupo de compras (só para material)
    const grupoCompraField = it._tipo === 'material' ? `
      <div style="flex:1;min-width:120px">
        <label style="font-size:10px;color:var(--text-muted);display:block;margin-bottom:2px">Grupo de Compras</label>
        <input class="form-control rcOS-item-grupo" placeholder="Ex: EPI, Ferramentas..." value="${it.grupo_compra||''}"
          style="font-size:11px;padding:3px 6px" title="Grupo de compras para classificação">
      </div>` : `<input type="hidden" class="rcOS-item-grupo" value="${it.grupo_compra||'Serviços'}">`;

    // Botão "Marcar como em estoque" (para material sem cadastro)
    const btnEstoque = it._tipo === 'material' && !est?.emEstoque ? `
      <button onclick="_farcMarcarItemEmEstoque(${idx},'${fluxoId}')" class="btn btn-sm"
        style="background:#22c55e22;color:#22c55e;border:1px solid #22c55e44;font-size:10px;padding:3px 8px;white-space:nowrap"
        title="Marcar que este item tem estoque disponível — não precisará de RC">
        <i class="fas fa-check" style="margin-right:3px"></i>Tem Estoque
      </button>` : '';

    return `
      <div class="rcOS-item-row" data-idx="${idx}" data-tipo="${it._tipo}"
        style="padding:10px 14px;${idx>0?'border-top:1px solid var(--border-color)':''}">
        <div style="display:flex;align-items:flex-start;gap:10px;flex-wrap:wrap">
          <input type="checkbox" id="rcOS_chk_${idx}" class="rcOS-item-check" value="${idx}" checked
            style="accent-color:var(--fa-teal);width:16px;height:16px;cursor:pointer;margin-top:2px;flex-shrink:0">
          <div style="flex:1;min-width:180px">
            <div style="font-size:12px;font-weight:600;color:var(--text-primary);display:flex;align-items:center;flex-wrap:wrap;gap:2px">
              ${it.descricao}
              ${tipoBadge}
              ${estoqueHTML}
            </div>
            ${alertaEstoque}
            ${it._estoque?.mat ? `<div style="font-size:10px;color:var(--text-muted);margin-top:2px">
              <i class="fas fa-barcode" style="margin-right:3px"></i>Cód: ${it._estoque.mat.codigo||'—'}
              ${it._estoque.mat.categoria ? ` · Cat: ${it._estoque.mat.categoria}` : ''}
              ${it._estoque.mat.grupo_compra ? ` · Grupo: ${it._estoque.mat.grupo_compra}` : ''}
            </div>` : ''}
            <div style="display:flex;gap:10px;margin-top:6px;flex-wrap:wrap;align-items:center">
              <div style="display:flex;gap:4px;align-items:center">
                <label style="font-size:10px;color:var(--text-muted)">Qtd:</label>
                <input class="form-control rcOS-item-qtd" type="number" min="1" value="${it.qtd||1}"
                  style="width:65px;font-size:12px;padding:3px 6px;text-align:center">
                <span style="font-size:11px;color:var(--text-muted)">${it.unidade||'Un'}</span>
              </div>
              ${grupoCompraField}
              ${btnEstoque}
            </div>
          </div>
          ${it.valor_unit>0 ? `<div style="font-size:12px;font-weight:700;color:var(--fa-teal);white-space:nowrap;align-self:center">
            ${(it.valor_unit||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}/un
          </div>` : ''}
        </div>
      </div>`;
  }

  openModalWide(`Nova Requisição de Compra – OS ${f.os_id}`, `
    <!-- Banner informativo OS -->
    <div style="background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.25);border-radius:10px;padding:12px 16px;margin-bottom:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
        <div>
          <div style="font-size:13px;font-weight:700;color:#22c55e;margin-bottom:2px">
            <i class="fas fa-clipboard-check" style="margin-right:6px"></i>OS: ${f.os_id}
          </div>
          <div style="font-size:12px;color:var(--text-secondary)">${f.os_descricao||'—'}</div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:4px">
            <span style="font-size:11px;color:var(--text-muted)"><i class="fas fa-file-contract" style="margin-right:3px"></i>Contrato: ${f.contrato||'—'}</span>
            <span style="font-size:11px;color:#22c55e;font-weight:600"><i class="fas fa-check-circle" style="margin-right:3px"></i>${itensAprov.length} item(ns) disponíveis</span>
            ${itensRCCriada.length > 0 ? `<span style="font-size:11px;color:var(--text-muted)"><i class="fas fa-file-alt" style="margin-right:3px"></i>${itensRCCriada.length} já em RC</span>` : ''}
          </div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${itensServico.length>0 ? `<span style="background:#6366f122;color:#6366f1;border-radius:8px;padding:4px 10px;font-size:11px;font-weight:700"><i class="fas fa-tools" style="margin-right:4px"></i>${itensServico.length} Serviço(s)</span>` : ''}
          ${itensMaterial.length>0 ? `<span style="background:#0ea5e922;color:#0ea5e9;border-radius:8px;padding:4px 10px;font-size:11px;font-weight:700"><i class="fas fa-box" style="margin-right:4px"></i>${itensMaterial.length} Material(is)</span>` : ''}
          ${itensComEstoque.length>0 ? `<span style="background:#22c55e22;color:#22c55e;border-radius:8px;padding:4px 10px;font-size:11px;font-weight:700"><i class="fas fa-warehouse" style="margin-right:4px"></i>${itensComEstoque.length} c/ estoque</span>` : ''}
        </div>
      </div>
    </div>

    <!-- Alerta: serviços e materiais em RCs separadas -->
    ${itensServico.length > 0 && itensMaterial.length > 0 ? `
    <div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.35);border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:12px">
      <i class="fas fa-exclamation-triangle" style="color:#d97706;margin-right:6px"></i>
      <strong style="color:#d97706">Atenção:</strong> Esta OS possui itens de <strong>Material</strong> e <strong>Serviço Externo</strong>.
      Cada tipo deve ser incluído em RCs <strong>separadas</strong> — crie uma RC para materiais e outra para serviços.
    </div>` : ''}

    <!-- Alerta: itens com estoque disponível -->
    ${itensComEstoque.length > 0 ? `
    <div style="background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.25);border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:12px">
      <i class="fas fa-info-circle" style="color:#22c55e;margin-right:6px"></i>
      <strong style="color:#22c55e">${itensComEstoque.length} item(ns)</strong> possuem estoque no almoxarifado.
      Verifique se o estoque atual atende à demanda antes de emitir RC. Se atender, marque "Tem Estoque" e o item <strong>não</strong> precisará de RC.
    </div>` : ''}

    <!-- Tipo de RC (material / serviço / equipamento) -->
    <div style="margin-bottom:14px">
      <label style="font-size:11px;font-weight:700;color:var(--text-secondary);display:block;margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px">Tipo desta RC * <span style="font-size:10px;font-weight:400;color:var(--text-muted)">(tipos diferentes = RCs separadas)</span></label>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;padding:8px 16px;border:2px solid rgba(14,165,233,0.4);border-radius:8px;font-size:12px;font-weight:600;color:#0ea5e9;transition:.15s"
          id="rcOS_tipo_mat_label">
          <input type="radio" name="rcOS_tipo_rc" id="rcOS_tipo_mat" value="material"
            ${itensServico.length===0||itensMaterial.length>0?'checked':''}
            onchange="_farcFiltrarItensPorTipo()" style="accent-color:#0ea5e9">
          <i class="fas fa-box"></i> Materiais
        </label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;padding:8px 16px;border:2px solid rgba(99,102,241,0.4);border-radius:8px;font-size:12px;font-weight:600;color:#6366f1;transition:.15s"
          id="rcOS_tipo_serv_label">
          <input type="radio" name="rcOS_tipo_rc" id="rcOS_tipo_serv" value="servico"
            ${itensServico.length>0&&itensMaterial.length===0?'checked':''}
            onchange="_farcFiltrarItensPorTipo()" style="accent-color:#6366f1">
          <i class="fas fa-tools"></i> Serviços Externos
        </label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;padding:8px 16px;border:2px solid rgba(245,158,11,0.4);border-radius:8px;font-size:12px;font-weight:600;color:#d97706;transition:.15s"
          id="rcOS_tipo_equip_label">
          <input type="radio" name="rcOS_tipo_rc" id="rcOS_tipo_equip" value="equipamento"
            onchange="_farcFiltrarItensPorTipo()" style="accent-color:#d97706">
          <i class="fas fa-cogs"></i> Equipamentos
        </label>
      </div>
    </div>

    <!-- Modalidade: Spot vs Recorrente -->
    <div style="margin-bottom:14px">
      <label style="font-size:11px;font-weight:700;color:var(--text-secondary);display:block;margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px">Modalidade da Contratação *</label>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;padding:8px 16px;border:2px solid rgba(5,150,105,0.4);border-radius:8px;font-size:12px;font-weight:600;color:#059669">
          <input type="radio" name="rcOS_modalidade" id="rcOS_spot" value="Spot" checked style="accent-color:#059669">
          <i class="fas fa-bolt"></i> Spot (compra pontual)
        </label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;padding:8px 16px;border:2px solid rgba(124,58,237,0.4);border-radius:8px;font-size:12px;font-weight:600;color:#7c3aed">
          <input type="radio" name="rcOS_modalidade" id="rcOS_recorrente" value="Recorrente" style="accent-color:#7c3aed">
          <i class="fas fa-sync-alt"></i> Serviço Recorrente (contrato)
        </label>
      </div>
    </div>

    <!-- Campos da RC -->
    <div class="form-row" style="margin-bottom:10px">
      <div class="form-group">
        <label style="font-size:11px;font-weight:700;color:var(--text-secondary)">Título da RC *</label>
        <input class="form-control" id="rcOS_titulo" value="RC – ${f.os_id} – ${f.os_descricao?.substring(0,35)||''}" placeholder="Título da requisição">
      </div>
      <div class="form-group">
        <label style="font-size:11px;font-weight:700;color:var(--text-secondary)">Prazo de Necessidade *</label>
        <input class="form-control" id="rcOS_prazo" type="date" value="${hoje}">
      </div>
    </div>

    <div class="form-row" style="margin-bottom:14px">
      <div class="form-group">
        <label style="font-size:11px;font-weight:700;color:var(--text-secondary)">Solicitante</label>
        <input class="form-control" id="rcOS_solicitante" value="${currentUser?.name||''}" readonly style="background:var(--bg-tertiary)">
      </div>
      <div class="form-group">
        <label style="font-size:11px;font-weight:700;color:var(--text-secondary)">Observações</label>
        <input class="form-control" id="rcOS_obs" placeholder="Justificativa ou informações adicionais">
      </div>
    </div>

    <!-- Itens disponíveis -->
    <div style="margin-bottom:14px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;flex-wrap:wrap;gap:6px">
        <div style="font-size:13px;font-weight:700;color:var(--text-primary)">
          <i class="fas fa-list-check" style="color:#22c55e;margin-right:6px"></i>
          Itens Disponíveis para RC
          <span style="font-size:11px;color:var(--text-muted);font-weight:400;margin-left:6px">(somente o tipo selecionado aparecerá)</span>
        </div>
        <div style="display:flex;gap:6px">
          <button onclick="_farcSelecionarTodosItens(true)" class="btn btn-secondary btn-sm" style="font-size:10px;padding:3px 9px">
            <i class="fas fa-check-square"></i> Todos
          </button>
          <button onclick="_farcSelecionarTodosItens(false)" class="btn btn-secondary btn-sm" style="font-size:10px;padding:3px 9px">
            <i class="fas fa-square"></i> Nenhum
          </button>
        </div>
      </div>
      <div id="rcOS_itensAprov" style="border:1px solid var(--border-color);border-radius:10px;overflow:hidden">
        ${itensEnriquecidos.map((it, idx) => _rowItem(it, idx)).join('')}
      </div>
    </div>

    <!-- Itens já em RC (somente visualização) -->
    ${itensRCCriada.length > 0 ? `
      <div style="margin-bottom:14px">
        <div style="font-size:11px;font-weight:700;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase">
          <i class="fas fa-lock" style="color:#6b7280;margin-right:5px"></i>
          Itens já em RC (não disponíveis)
        </div>
        <div style="border:1px solid var(--border-color);border-radius:8px;overflow:hidden;opacity:0.55">
          ${itensRCCriada.map((it, idx) => `
            <div style="display:flex;align-items:center;gap:10px;padding:7px 14px;background:var(--bg-secondary);${idx>0?'border-top:1px solid var(--border-color)':''}">
              <i class="fas fa-check-square" style="color:#22c55e;font-size:13px"></i>
              <div style="flex:1;font-size:12px;color:var(--text-secondary)">
                <strong>${it.descricao}</strong>
                <span> · ${it.qtd||1} ${it.unidade||'Un'}</span>
              </div>
              <span style="font-size:10px;background:#22c55e22;color:#22c55e;border-radius:5px;padding:2px 8px;font-weight:700">${it.rc_numero||'Em RC'}</span>
            </div>`).join('')}
        </div>
      </div>
    ` : ''}

    <!-- Itens extras -->
    <div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div style="font-size:12px;font-weight:700;color:var(--text-secondary)">
          <i class="fas fa-plus-circle" style="color:var(--orange);margin-right:5px"></i>
          Itens Adicionais (opcional)
        </div>
        <button onclick="_farcAddItemExtraRC()" class="btn btn-secondary btn-sm" style="font-size:11px">
          <i class="fas fa-plus"></i> Adicionar
        </button>
      </div>
      <div id="rcOS_itensExtras"></div>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="_farcSalvarRCdeOS('${fluxoId}')">
      <i class="fas fa-save"></i> Criar Requisição de Compra
    </button>
  `);

  // Aplica filtro inicial baseado no tipo selecionado
  setTimeout(() => _farcFiltrarItensPorTipo(), 80);
}

function _farcAddItemExtraRC() {
  const cont = document.getElementById('rcOS_itensExtras');
  if (!cont) return;
  const div = document.createElement('div');
  div.className = 'rcOS-extra-row';
  div.style.cssText = 'display:flex;gap:6px;align-items:center;margin-bottom:6px;padding:8px 12px;background:rgba(230,126,34,0.06);border:1px solid rgba(230,126,34,0.2);border-radius:8px;flex-wrap:wrap';
  div.innerHTML = `
    <input class="form-control rcOS-extra-desc" placeholder="Descrição do item" style="flex:3;min-width:140px;font-size:12px;padding:5px 8px">
    <input class="form-control rcOS-extra-qtd" type="number" min="1" value="1" placeholder="Qtd" style="width:60px;font-size:12px;padding:5px 6px;text-align:center">
    <input class="form-control rcOS-extra-un" placeholder="Un" style="width:55px;font-size:12px;padding:5px 6px">
    <input class="form-control rcOS-extra-vl" type="number" min="0" step="0.01" value="0" placeholder="R$ Unit." style="width:90px;font-size:12px;padding:5px 6px">
    <input class="form-control rcOS-extra-grupo" placeholder="Grupo compras" style="width:110px;font-size:11px;padding:5px 6px" title="Grupo de compras">
    <button onclick="this.closest('.rcOS-extra-row').remove()" class="btn btn-danger btn-sm btn-icon" title="Remover"><i class="fas fa-trash"></i></button>
  `;
  cont.appendChild(div);
}

/**
 * Gera <option>s para selects WBS inline por item (RC Avulsa, etc).
 * Consolida projetos Gantt + WBS estático em lista flat.
 * @param {string} [selectedId]
 */
function _farcWBSInlineOptions(selectedId) {
  try {
    const projetos = JSON.parse(localStorage.getItem('fa_projetos_gantt') || '[]');
    const wbsItems = JSON.parse(localStorage.getItem('fa_wbs_items') || '[]');
    let html = '<option value="">— Linha WBS (opcional) —</option>';

    if (wbsItems.length) {
      html += '<optgroup label="WBS / Contrato">';
      wbsItems.forEach(it => {
        if (it.g2) return;
        const sel = selectedId === it.id ? 'selected' : '';
        html += `<option value="${it.id}" data-desc="${it.descricao}" data-cc="${it.contrato_id||''}" ${sel}>${it.id} – ${it.descricao}</option>`;
      });
      html += '</optgroup>';
    }

    projetos.forEach(proj => {
      if (!(proj.fases||[]).length) return;
      html += `<optgroup label="📋 ${proj.nome||proj.id}">`;
      (proj.fases||[]).forEach((fase, fi) => {
        if ((fase.tarefas||[]).length) {
          (fase.tarefas||[]).forEach((t, ti) => {
            const codigo = `${proj.id}.${fi+1}.${ti+1}`;
            const sel = selectedId === codigo ? 'selected' : '';
            html += `<option value="${codigo}" data-desc="${t.nome}" data-projeto="${proj.id}" data-cc="${proj.contrato_id||proj.id}" ${sel}>${fi+1}.${ti+1} ${t.nome}</option>`;
          });
        } else {
          const codigo = `${proj.id}.${fi+1}`;
          const sel = selectedId === codigo ? 'selected' : '';
          html += `<option value="${codigo}" data-desc="${fase.nome}" data-projeto="${proj.id}" data-cc="${proj.contrato_id||proj.id}" ${sel}>${fi+1}. ${fase.nome}</option>`;
        }
      });
      html += '</optgroup>';
    });

    return html;
  } catch(e) { return '<option value="">— WBS não disponível —</option>'; }
}

// Funções removidas (WBS agora é por item, não por formulário RC):
// _farcCarregarWBSdoProjeto → substituída por _farcWBSInlineOptions
// _farcPreencherCentroCusto → não é mais necessária
function _farcCarregarWBSdoProjeto() { /* deprecated */ }
function _farcPreencherCentroCusto() { /* deprecated */ }

// Filtra itens do modal RC pelo tipo selecionado (material ou serviço)
function _farcFiltrarItensPorTipo() {
  const tipoSel = document.querySelector('input[name="rcOS_tipo_rc"]:checked')?.value || 'material';
  const rows = document.querySelectorAll('.rcOS-item-row');
  rows.forEach(row => {
    const tipo = row.dataset.tipo || 'material';
    row.style.display = (tipo === tipoSel) ? '' : 'none';
    // Desmarca checkboxes ocultos para não incluir na RC
    const chk = row.querySelector('.rcOS-item-check');
    if (chk) {
      if (tipo !== tipoSel) {
        chk.checked = false;
        chk.disabled = true;
      } else {
        chk.disabled = false;
        chk.checked = true;
      }
    }
  });
  // Atualiza título sugerido da RC
  const tituloEl = document.getElementById('rcOS_titulo');
  if (tituloEl) {
    const base = tituloEl.value.replace(/ – Mat\.| – Serv\./g, '');
    tituloEl.value = base + (tipoSel === 'servico' ? ' – Serv.' : ' – Mat.');
  }
  // Destaca o label selecionado
  document.getElementById('rcOS_tipo_mat_label')?.style && (document.getElementById('rcOS_tipo_mat_label').style.borderColor = tipoSel === 'material' ? '#0ea5e9' : 'rgba(14,165,233,0.25)');
  document.getElementById('rcOS_tipo_serv_label')?.style && (document.getElementById('rcOS_tipo_serv_label').style.borderColor = tipoSel === 'servico' ? '#6366f1' : 'rgba(99,102,241,0.25)');
}

// Seleciona ou desmarca todos os itens visíveis
function _farcSelecionarTodosItens(selecionar) {
  const rows = document.querySelectorAll('.rcOS-item-row');
  rows.forEach(row => {
    if (row.style.display !== 'none') {
      const chk = row.querySelector('.rcOS-item-check');
      if (chk && !chk.disabled) chk.checked = selecionar;
    }
  });
}

// Marca item como disponível em estoque (não precisará de RC)
function _farcMarcarItemEmEstoque(idx, fluxoId) {
  const row = document.querySelector(`.rcOS-item-row[data-idx="${idx}"]`);
  if (!row) return;
  const chk = row.querySelector('.rcOS-item-check');
  if (chk) { chk.checked = false; chk.disabled = true; }
  // Adiciona overlay visual
  row.style.opacity = '0.45';
  row.style.background = 'rgba(34,197,94,0.04)';
  const badge = row.querySelector('.rcOS-item-check')?.parentElement?.querySelector('[data-em-estoque]');
  // Registra no fluxo que o item tem estoque (para exibir na OS aprovada)
  try {
    const fluxo = _getFluxoOS();
    const fIdx  = fluxo.findIndex(x => x.id === fluxoId);
    if (fIdx >= 0) {
      const itensAprov = (fluxo[fIdx].itens||[]).filter(it => it.status_item === 'Aprovado');
      if (itensAprov[idx]) {
        itensAprov[idx].tem_estoque   = true;
        itensAprov[idx].estoque_obs   = 'Confirmado pelo responsável de compras';
        // Atualiza no array original
        let globalIdx = 0;
        (fluxo[fIdx].itens||[]).forEach((it, i) => {
          if (it.status_item === 'Aprovado') {
            if (globalIdx === idx) fluxo[fIdx].itens[i] = { ...it, tem_estoque: true, estoque_obs: 'Confirmado' };
            globalIdx++;
          }
        });
        _saveFluxoOS(fluxo);
      }
    }
  } catch(e) {}
  showToast('Item marcado como disponível em estoque — não incluído na RC.', 'info', 3500);
}

function _farcSalvarRCdeOS(fluxoId) {
  const f = _getFluxoOS().find(x => x.id === fluxoId);
  if (!f) { showToast('OS não encontrada.', 'error'); return; }

  const titulo     = document.getElementById('rcOS_titulo')?.value.trim();
  const prazo      = document.getElementById('rcOS_prazo')?.value;
  const solicit    = document.getElementById('rcOS_solicitante')?.value || currentUser?.name || '';
  const obs        = document.getElementById('rcOS_obs')?.value.trim() || '';
  const tipoRC     = document.querySelector('input[name="rcOS_tipo_rc"]:checked')?.value || 'material';
  const modalidade = document.querySelector('input[name="rcOS_modalidade"]:checked')?.value || 'Spot';

  // WBS agora vem de cada item — centraliza o centro de custo pelo contrato da OS
  const centroCusto = f.os_contrato || '';

  if (!titulo) { showToast('Informe o título da RC.', 'error'); return; }
  if (!prazo)  { showToast('Informe o prazo de necessidade.', 'error'); return; }

  // Coleta itens aprovados VISÍVEIS e SELECIONADOS (apenas do tipo correto)
  const itensAprov = (f.itens||[]).filter(it => it.status_item === 'Aprovado');
  const checkboxes = document.querySelectorAll('.rcOS-item-check:checked:not(:disabled)');
  const itensSelecionados = [];

  checkboxes.forEach(cb => {
    const idx = parseInt(cb.value);
    if (isNaN(idx) || !itensAprov[idx]) return;
    const row       = cb.closest('.rcOS-item-row');
    const qtdEl     = row?.querySelector('.rcOS-item-qtd');
    const grupoEl   = row?.querySelector('.rcOS-item-grupo');
    const qtd       = qtdEl ? (parseInt(qtdEl.value) || 1) : (itensAprov[idx].qtd || 1);
    const grupo     = grupoEl?.value.trim() || itensAprov[idx].grupo_compra || '';
    const tipoItem  = row?.dataset.tipo || _farcTipoItem(itensAprov[idx]);
    // Propaga WBS do item original da OS (definido no momento da criação da OS)
    itensSelecionados.push({
      descricao:    itensAprov[idx].descricao,
      qtd,
      unidade:      itensAprov[idx].unidade || 'Un',
      valor_unit:   itensAprov[idx].valor_unit || 0,
      total:        qtd * (itensAprov[idx].valor_unit || 0),
      grupo_compra: grupo,
      tipo_item:    tipoItem,
      origem_os:    true,
      status_item:  'Aprovado',
      // Vínculo WBS herdado do item da OS
      wbs_codigo:    itensAprov[idx].wbs_codigo   || '',
      wbs_descricao: itensAprov[idx].wbs_descricao|| '',
      projeto_id:    itensAprov[idx].projeto_id   || '',
      centro_custo:  itensAprov[idx].centro_custo || centroCusto
    });
  });

  // Coleta itens extras
  const extrasRows = document.querySelectorAll('.rcOS-extra-row');
  extrasRows.forEach(row => {
    const desc = row.querySelector('.rcOS-extra-desc')?.value.trim();
    if (!desc) return;
    const qtd    = parseInt(row.querySelector('.rcOS-extra-qtd')?.value) || 1;
    const un     = row.querySelector('.rcOS-extra-un')?.value.trim() || 'Un';
    const vlUnit = parseFloat(row.querySelector('.rcOS-extra-vl')?.value) || 0;
    const grupo  = row.querySelector('.rcOS-extra-grupo')?.value.trim() || '';
    itensSelecionados.push({ descricao: desc, qtd, unidade: un, valor_unit: vlUnit, total: qtd*vlUnit, grupo_compra: grupo, tipo_item: tipoRC, origem_os: false, status_item: 'Pendente' });
  });

  if (itensSelecionados.length === 0) {
    showToast('Selecione ao menos um item para incluir na RC.', 'error');
    return;
  }

  // Validação: todos itens devem ser do mesmo tipo
  const tiposNaRC = [...new Set(itensSelecionados.map(it => it.tipo_item))];
  if (tiposNaRC.length > 1) {
    showToast('Não é permitido misturar tipos diferentes na mesma RC (Material / Serviço / Equipamento). Crie RCs separadas por tipo.', 'error', 6000);
    return;
  }

  // Gera número da RC
  const rcsAtual = (_obterRCLocal());
  const ano      = new Date().getFullYear();
  const numSeq   = String(rcsAtual.length + 1).padStart(4,'0');
  const numero   = `RC-${ano}-${numSeq}`;
  const sufixoTipoMap = { material: 'Materiais', servico: 'Serviços Externos', equipamento: 'Equipamentos' };
  const sufixoTipo = sufixoTipoMap[tipoRC] || 'Materiais';

  const valorTotal = itensSelecionados.reduce((s, it) => s + (it.total||0), 0);

  const novaRC = {
    id:              `rc_${Date.now()}`,
    numero,
    titulo,
    tipo_rc:         tipoRC,
    tipo_rc_label:   sufixoTipo,
    modalidade_contrato: modalidade,
    // WBS agora está por item (propagado da OS) — nível RC guarda apenas o contrato/CC
    centro_custo:    centroCusto,
    // ────────────────────────────────────────────────────────────────
    contrato:        f.contrato || f.os_contrato || centroCusto || 'Geral',
    solicitante:     solicit,
    departamento:    currentUser?.role || '',
    data_abertura:   new Date().toLocaleDateString('pt-BR'),
    data_criacao:    new Date().toISOString(),
    prazo,
    status:          'Aprovada – Aguardando Comprador',
    numero_processo: `PROC-${ano}-${numSeq}`,
    os_vinculada:    f.os_id,
    fluxo_id:        f.id,
    itens:           itensSelecionados,
    valor_total:     valorTotal,
    observacoes:     obs,
    criado_por:      currentUser?.email || '',
    criado_por_nome: currentUser?.name || ''
  };

  // Salva RC
  if (typeof _saveRC === 'function') {
    const lista = _obterRCLocal();
    lista.unshift(novaRC);
    _saveRC(lista);
  } else {
    const lista = _obterRCLocal();
    lista.unshift(novaRC);
    _salvarRCLocal(lista);
  }

  // Registra RC no fluxo da OS e marca itens selecionados como 'RC Criada'
  const listaFluxo = _getFluxoOS();
  const idxFluxo   = listaFluxo.findIndex(x => x.id === fluxoId);
  if (idxFluxo >= 0) {
    if (!listaFluxo[idxFluxo].rcs) listaFluxo[idxFluxo].rcs = [];
    listaFluxo[idxFluxo].rcs.push({ rc_id: novaRC.id, rc_numero: numero, data: new Date().toLocaleString('pt-BR'), criado_por: solicit });

    // Marca cada item selecionado como 'RC Criada' para não aparecer novamente
    const itensDoFluxo = listaFluxo[idxFluxo].itens || [];
    const descricoesSelecionadas = itensSelecionados
      .filter(it => it.origem_os)
      .map(it => it.descricao);
    itensDoFluxo.forEach((it, idx) => {
      if (it.status_item === 'Aprovado' && descricoesSelecionadas.includes(it.descricao)) {
        listaFluxo[idxFluxo].itens[idx] = {
          ...it,
          status_item: 'RC Criada',
          rc_numero:   numero,
          rc_id:       novaRC.id,
          rc_data:     new Date().toLocaleDateString('pt-BR')
        };
      }
    });

    if (!listaFluxo[idxFluxo].historico) listaFluxo[idxFluxo].historico = [];
    listaFluxo[idxFluxo].historico.unshift({ acao: `RC ${numero} emitida com ${itensSelecionados.length} item(ns) por ${solicit}`, usuario: solicit, data: new Date().toLocaleString('pt-BR') });
    _saveFluxoOS(listaFluxo);
  }

  logAction && logAction('Emissão RC', 'Fluxo Compras', `RC ${numero} criada para OS ${f.os_id} com ${itensSelecionados.length} item(ns)`);

  closeModal();
  showToast(`✅ RC ${numero} criada! ${itensSelecionados.length} item(ns). Comprador notificado.`, 'success', 5000);

  // Atualiza badge
  const badge = document.getElementById('badge-fluxo');
  if (badge) badge.style.background = 'var(--orange)';

  renderFluxoAprovacaoRC();
  // Volta para aba emissão
  setTimeout(() => farcSwitchTab && farcSwitchTab('emissao'), 100);
}

// Badge de status individual de item de RC
function _rcItemStatusBadge(status) {
  const m = {
    'Aprovado':        { color: '#22c55e', icon: 'fa-check-circle' },
    'Pendente':        { color: '#f59e0b', icon: 'fa-clock' },
    'Em Cotação':      { color: '#6366f1', icon: 'fa-paper-plane' },
    'Cotado':          { color: '#3b82f6', icon: 'fa-file-invoice-dollar' },
    'Pedido Emitido':  { color: '#10b981', icon: 'fa-shopping-bag' },
    'Rejeitado':       { color: '#ef4444', icon: 'fa-times-circle' },
    'Cancelado':       { color: '#6b7280', icon: 'fa-ban' },
  };
  const s = m[status] || { color: '#8b949e', icon: 'fa-circle' };
  return `<span style="background:${s.color}22;color:${s.color};border-radius:5px;padding:2px 7px;font-size:10px;font-weight:700;white-space:nowrap">
    <i class="fas ${s.icon}" style="margin-right:3px;font-size:9px"></i>${status||'Pendente'}
  </span>`;
}

function _farcTabelaRC(lista) {
  if (!lista.length) return `<div style="text-align:center;padding:40px;color:var(--text-muted)"><i class="fas fa-inbox" style="font-size:32px;display:block;margin-bottom:12px;opacity:.4"></i>Nenhuma RC encontrada.</div>`;
  const podeProc  = _podeProcessarRC();
  const podeEmitir = _podeEmitirRC();
  // Status que permitem edição da RC
  const statusEditaveis = ['Rascunho', 'Aguardando Aprovação', 'Aprovada – Aguardando Comprador'];
  return `
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead>
          <tr style="background:var(--bg-tertiary)">
            <th style="padding:9px 12px;text-align:left;font-size:11px;color:var(--text-secondary)">Número</th>
            <th style="padding:9px 12px;text-align:left;font-size:11px;color:var(--text-secondary)">Título</th>
            <th style="padding:9px 12px;text-align:left;font-size:11px;color:var(--text-secondary)">Tipo</th>
            <th style="padding:9px 12px;text-align:left;font-size:11px;color:var(--text-secondary)">Modalidade</th>
            <th style="padding:9px 12px;text-align:left;font-size:11px;color:var(--text-secondary)">OS / WBS</th>
            <th style="padding:9px 12px;text-align:left;font-size:11px;color:var(--text-secondary)">Solicitante</th>
            <th style="padding:9px 12px;text-align:center;font-size:11px;color:var(--text-secondary)">Itens</th>
            <th style="padding:9px 12px;text-align:right;font-size:11px;color:var(--text-secondary)">Valor Est.</th>
            <th style="padding:9px 12px;text-align:center;font-size:11px;color:var(--text-secondary)">Status RC</th>
            <th style="padding:9px 12px;text-align:center;font-size:11px;color:var(--text-secondary)">Ações</th>
          </tr>
        </thead>
        <tbody>
          ${lista.map(r => {
            const podeEditar = podeEmitir && statusEditaveis.includes(r.status);
            const totalItens = r.itens?.length || 0;
            const itensAprov = (r.itens||[]).filter(it => (it.status_item||it.status) === 'Aprovado').length;
            const tipoCorMap = { material:'#0ea5e9', servico:'#6366f1', equipamento:'#d97706' };
            const tipoIconMap = { material:'fa-box', servico:'fa-tools', equipamento:'fa-cogs' };
            const tipoColor = tipoCorMap[r.tipo_rc] || '#6b7280';
            const tipoIcon  = tipoIconMap[r.tipo_rc] || 'fa-file-alt';
            const modalidade = r.modalidade_contrato || r.modalidade || 'Spot';
            const modBadge  = modalidade === 'Recorrente'
              ? `<span style="background:#7c3aed22;color:#7c3aed;border-radius:5px;padding:2px 7px;font-size:10px;font-weight:700"><i class="fas fa-sync-alt" style="margin-right:3px"></i>Recorrente</span>`
              : `<span style="background:#05966922;color:#059669;border-radius:5px;padding:2px 7px;font-size:10px;font-weight:700"><i class="fas fa-bolt" style="margin-right:3px"></i>Spot</span>`;
            const wbsCod    = r.wbs_codigo || r.wbs_id || '';
            const projLabel = r.projeto_id ? (r.projeto_tipo === 'contrato' ? `<div style="font-size:10px;color:#d97706"><i class="fas fa-file-contract" style="margin-right:2px"></i>${r.projeto_id}</div>` : `<div style="font-size:10px;color:#3b82f6"><i class="fas fa-project-diagram" style="margin-right:2px"></i>${r.projeto_id}</div>`) : '';
            return `
            <tr style="border-bottom:1px solid var(--border-color)" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='transparent'">
              <td style="padding:9px 12px;font-weight:700;color:var(--orange)">${r.numero}</td>
              <td style="padding:9px 12px;color:var(--text-primary);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${r.titulo}">${r.titulo}</td>
              <td style="padding:9px 12px">
                <span style="background:${tipoColor}22;color:${tipoColor};border-radius:5px;padding:2px 8px;font-size:10px;font-weight:700">
                  <i class="fas ${tipoIcon}" style="margin-right:3px"></i>${r.tipo_rc_label||r.tipo_rc||'—'}
                </span>
              </td>
              <td style="padding:9px 12px">${modBadge}</td>
              <td style="padding:9px 12px;font-size:11px">
                ${r.os_vinculada ? `<div style="color:var(--fa-teal);font-weight:600">${r.os_vinculada}</div>` : ''}
                ${projLabel}
                ${wbsCod ? `<div style="color:#6366f1;font-size:10px;font-weight:600"><i class="fas fa-sitemap" style="margin-right:2px"></i>${wbsCod}</div>` : `<div style="color:var(--text-muted);font-size:10px"><i class="fas fa-exclamation-circle" style="margin-right:2px;color:#f59e0b"></i>Sem WBS</div>`}
              </td>
              <td style="padding:9px 12px;color:var(--text-secondary);font-size:11px">${r.solicitante||'—'}</td>
              <td style="padding:9px 12px;text-align:center">
                <span title="${totalItens} itens (${itensAprov} aprovados)">
                  ${totalItens}
                  ${itensAprov > 0 ? `<span style="font-size:10px;color:#22c55e;margin-left:2px">(${itensAprov}✓)</span>` : ''}
                </span>
              </td>
              <td style="padding:9px 12px;text-align:right;font-weight:600">${_fmtVal(r.valor_total)}</td>
              <td style="padding:9px 12px;text-align:center">${_statusBadgeFluxo(r.status)}</td>
              <td style="padding:9px 12px;text-align:center">
                <div style="display:flex;gap:4px;justify-content:center">
                  <button onclick="farcVerDetalheRC('${r.id}')" class="btn btn-secondary btn-sm btn-icon" title="Ver detalhes"><i class="fas fa-eye"></i></button>
                  ${podeEditar ? `<button onclick="farcEditarRC('${r.id}')" class="btn btn-warning btn-sm btn-icon" title="Editar RC"><i class="fas fa-edit"></i></button>` : ''}
                  ${r.status === 'Aguardando Aprovação' && podeProc
                    ? `<button onclick="reqAprovarRC('${r.id}')" class="btn btn-success btn-sm btn-icon" title="Aprovar RC"><i class="fas fa-check"></i></button>` : ''}
                  ${r.status === 'Aprovada – Aguardando Comprador' && podeProc
                    ? `<button onclick="farcCriarRFQ('${r.id}')" class="btn btn-primary btn-sm btn-icon" title="Criar RFQ / Solicitar Cotação" style="background:rgba(99,102,241,0.8)"><i class="fas fa-paper-plane"></i></button>` : ''}
                </div>
              </td>
            </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
    <div style="padding:10px 14px;font-size:11px;border-top:1px solid var(--border-color);color:var(--text-muted)">
      <i class="fas fa-info-circle" style="margin-right:5px;color:var(--fa-teal)"></i>
      ${podeProc
        ? `Para criar RFQ e iniciar o processo de cotação, acesse a aba <strong style="color:#6366f1">Cotações (RFQ)</strong>.`
        : `Você está no modo <strong>acompanhamento</strong>. O andamento da RC (cotação, mapa, pedido) é realizado pelo setor de Compras.`}
    </div>
  `;
}

function _farcFiltrarEmissao() {
  const s  = (document.getElementById('farc_search_emissao')?.value || '').toLowerCase();
  const st = document.getElementById('farc_filter_emissao')?.value || '';
  const f  = (_obterRCLocal()).filter(r =>
    (!s || (r.numero+r.titulo+r.solicitante+(r.os_vinculada||'')).toLowerCase().includes(s)) &&
    (!st || r.status === st)
  );
  const el = document.getElementById('farc_tabela_emissao');
  if (el) el.innerHTML = _farcTabelaRC(f);
}

function _farcExportarRC() {
  const lista = _obterRCLocal();
  const csv = [
    ['Número','Título','OS Vinculada','Solicitante','Itens','Valor Total','Status','Data'],
    ...lista.map(r => [r.numero, r.titulo, r.os_vinculada||'', r.solicitante, r.itens?.length||0, r.valor_total, r.status, r.data_criacao])
  ].map(row => row.map(c => `"${c}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\ufeff'+csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `RC_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  showToast('Exportado com sucesso!', 'success');
}

// Ver detalhe de RC (dentro do módulo Emissão)
function farcVerDetalheRC(rcId) {
  const r = (_obterRCLocal()).find(x => x.id === rcId);
  if (!r) { showToast('RC não encontrada.', 'error'); return; }
  const podeProc = _podeProcessarRC();

  // Busca RFQs vinculados
  const rfqsVinc = (typeof _getRFQFlow === 'function' ? _getRFQFlow() : []).filter(rfq => rfq.rc_id === r.id);

  // Timeline de status
  const timelineItens = (r.historico||[]).slice(0,5);

  openModalWide(`RC ${r.numero} – Detalhes`, `
    <!-- Cabeçalho -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-bottom:16px">
      <div style="padding:10px 14px;background:var(--bg-card2);border-radius:8px">
        <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;margin-bottom:2px">Solicitante</div>
        <div style="font-size:13px;font-weight:700;color:var(--text-primary)">${r.solicitante||'—'}</div>
      </div>
      <div style="padding:10px 14px;background:var(--bg-card2);border-radius:8px">
        <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;margin-bottom:2px">Prazo Necessidade</div>
        <div style="font-size:13px;font-weight:700;color:var(--text-primary)">${r.prazo_necessidade||'—'}</div>
      </div>
      <div style="padding:10px 14px;background:var(--bg-card2);border-radius:8px">
        <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;margin-bottom:2px">Valor Estimado</div>
        <div style="font-size:13px;font-weight:700;color:var(--orange)">${_fmtVal(r.valor_total)}</div>
      </div>
      <div style="padding:10px 14px;background:var(--bg-card2);border-radius:8px;text-align:center">
        <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px">Status</div>
        <div>${_statusBadgeFluxo(r.status)}</div>
      </div>
      ${r.os_vinculada ? `
        <div style="padding:10px 14px;background:rgba(20,184,166,0.06);border:1px solid rgba(20,184,166,0.2);border-radius:8px">
          <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;margin-bottom:2px">OS Vinculada</div>
          <div style="font-size:13px;font-weight:700;color:var(--fa-teal)">${r.os_vinculada}</div>
        </div>
      ` : ''}
      ${r.projeto_id ? `
        <div style="padding:10px 14px;background:rgba(59,130,246,0.06);border:1px solid rgba(59,130,246,0.2);border-radius:8px">
          <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;margin-bottom:2px">${r.projeto_tipo==='projeto'?'Projeto':'Centro de Custo'}</div>
          <div style="font-size:12px;font-weight:700;color:#3b82f6">${r.projeto_id}</div>
        </div>
      ` : ''}
      ${r.wbs_codigo ? `
        <div style="padding:10px 14px;background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.2);border-radius:8px">
          <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;margin-bottom:2px">Linha WBS</div>
          <div style="font-size:12px;font-weight:700;color:#6366f1">${r.wbs_codigo}</div>
          ${r.wbs_descricao ? `<div style="font-size:10px;color:var(--text-muted);margin-top:2px">${r.wbs_descricao}</div>` : ''}
        </div>
      ` : ''}
      ${r.centro_custo ? `
        <div style="padding:10px 14px;background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.2);border-radius:8px">
          <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;margin-bottom:2px">Centro de Custo</div>
          <div style="font-size:12px;font-weight:700;color:#d97706">${r.centro_custo}</div>
        </div>
      ` : ''}
      ${r.modalidade_contrato ? `
        <div style="padding:10px 14px;background:rgba(124,58,237,0.06);border:1px solid rgba(124,58,237,0.2);border-radius:8px">
          <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;margin-bottom:2px">Modalidade</div>
          <div style="font-size:12px;font-weight:700;color:#7c3aed">${r.modalidade_contrato==='Spot'?'⚡ Spot':'🔄 Recorrente'}</div>
        </div>
      ` : ''}
    </div>

    <!-- Itens da RC com status individual -->
    <div style="margin-bottom:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;flex-wrap:wrap;gap:8px">
        <div style="font-size:13px;font-weight:700;color:var(--text-primary)">
          <i class="fas fa-list-check" style="color:#3b82f6;margin-right:6px"></i>Itens (${r.itens?.length||0})
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${['Aprovado','Pendente','Em Cotação','Cotado','Pedido Emitido','Rejeitado'].map(s => {
            const cnt = (r.itens||[]).filter(it => (it.status_item||it.status||'Pendente') === s).length;
            return cnt > 0 ? _rcItemStatusBadge(s).replace('</span>', ` ×${cnt}</span>`) : '';
          }).join('')}
        </div>
      </div>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead><tr style="background:var(--bg-tertiary)">
            <th style="padding:7px 10px;text-align:left;font-size:10px;color:var(--text-muted)">#</th>
            <th style="padding:7px 10px;text-align:left;font-size:10px;color:var(--text-muted)">Descrição</th>
            <th style="padding:7px 10px;text-align:center;font-size:10px;color:var(--text-muted)">Qtd</th>
            <th style="padding:7px 10px;text-align:center;font-size:10px;color:var(--text-muted)">Un</th>
            <th style="padding:7px 10px;text-align:right;font-size:10px;color:var(--text-muted)">V. Unit. (R$)</th>
            <th style="padding:7px 10px;text-align:right;font-size:10px;color:var(--text-muted)">Total</th>
            <th style="padding:7px 10px;text-align:center;font-size:10px;color:var(--text-muted)">Status Item</th>
          </tr></thead>
          <tbody>
            ${(r.itens||[]).map((it,i) => {
              const statusItem = it.status_item || it.status || 'Pendente';
              const statusColors = {'Aprovado':'#22c55e','Pendente':'#f59e0b','Em Cotação':'#6366f1','Cotado':'#3b82f6','Pedido Emitido':'#10b981','Rejeitado':'#ef4444','Cancelado':'#6b7280'};
              const sc = statusColors[statusItem] || '#8b949e';
              return `
              <tr style="border-bottom:1px solid var(--border-color);border-left:3px solid ${sc}44" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='transparent'">
                <td style="padding:7px 10px;color:var(--text-muted)">${i+1}</td>
                <td style="padding:7px 10px;color:var(--text-primary);font-weight:500">${it.descricao||it.description||'—'}</td>
                <td style="padding:7px 10px;text-align:center">${it.qtd||it.quantidade||1}</td>
                <td style="padding:7px 10px;text-align:center;color:var(--text-muted)">${it.unidade||it.unit||'Un'}</td>
                <td style="padding:7px 10px;text-align:right">${it.valor_unit>0?_fmtVal(it.valor_unit):'—'}</td>
                <td style="padding:7px 10px;text-align:right;font-weight:600">${it.total>0||it.valor_total>0?_fmtVal(it.total||it.valor_total):'—'}</td>
                <td style="padding:7px 10px;text-align:center">${_rcItemStatusBadge(statusItem)}</td>
              </tr>
              `;
            }).join('')}
            <tr style="background:var(--bg-card2);font-weight:700">
              <td colspan="6" style="padding:8px 10px;text-align:right;color:var(--text-secondary)">TOTAL ESTIMADO</td>
              <td style="padding:8px 10px;text-align:right;color:var(--orange);font-size:13px">${_fmtVal(r.valor_total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- RFQs vinculados -->
    ${rfqsVinc.length > 0 ? `
      <div style="margin-bottom:16px">
        <div style="font-size:13px;font-weight:700;color:var(--text-primary);margin-bottom:8px">
          <i class="fas fa-paper-plane" style="color:#6366f1;margin-right:6px"></i>RFQ(s) Vinculados (${rfqsVinc.length})
        </div>
        ${rfqsVinc.map(rfq => `
          <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--bg-secondary);border-radius:8px;margin-bottom:4px;font-size:12px">
            <span style="font-weight:700;color:#6366f1">${rfq.numero}</span>
            <span style="flex:1;color:var(--text-secondary)">${rfq.titulo}</span>
            <span style="color:var(--text-muted);font-size:11px">Prazo: ${rfq.prazo_cotacao||'—'}</span>
            ${_rfqBadge(rfq.status)}
          </div>
        `).join('')}
      </div>
    ` : ''}

    <!-- Histórico / Timeline -->
    ${timelineItens.length > 0 ? `
      <div>
        <div style="font-size:13px;font-weight:700;color:var(--text-primary);margin-bottom:8px">
          <i class="fas fa-history" style="color:var(--text-muted);margin-right:6px"></i>Histórico
        </div>
        ${timelineItens.map(h => `
          <div style="display:flex;gap:10px;padding:6px 0;border-bottom:1px solid var(--border-color);font-size:11px">
            <div style="color:var(--text-muted);white-space:nowrap;min-width:130px">${h.data||'—'}</div>
            <div style="color:var(--text-secondary);flex:1">${h.acao||h.descricao||'—'}</div>
            <div style="color:var(--text-muted)">${h.usuario||'—'}</div>
          </div>
        `).join('')}
      </div>
    ` : ''}
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
    ${_podeEmitirRC() && ['Rascunho','Aguardando Aprovação','Aprovada – Aguardando Comprador'].includes(r.status) ? `
      <button class="btn btn-warning" onclick="closeModal();farcEditarRC('${r.id}')">
        <i class="fas fa-edit"></i> Editar RC
      </button>
    ` : ''}
    ${podeProc && r.status === 'Aguardando Aprovação' ? `
      <button class="btn btn-success" onclick="closeModal();reqAprovarRC('${r.id}')">
        <i class="fas fa-check"></i> Aprovar RC
      </button>
    ` : ''}
    ${podeProc && r.status === 'Aprovada – Aguardando Comprador' ? `
      <button class="btn btn-info" onclick="closeModal();navigate('rfq')" style="background:rgba(99,102,241,0.15);border-color:#6366f1;color:#818cf8">
        <i class="fas fa-list"></i> Ver Cotações
      </button>
      <button class="btn btn-primary" onclick="closeModal();farcCriarRFQ('${r.id}')">
        <i class="fas fa-paper-plane"></i> Criar RFQ
      </button>
    ` : ''}
  `);
}

// ─── EDITAR RC ────────────────────────────────────────────────────────────────
function farcEditarRC(rcId) {
  if (!_podeEmitirRC()) {
    showToast('Sem permissão para editar RC.', 'error');
    return;
  }
  const lista = _obterRCLocal();
  const r = lista.find(x => x.id === rcId);
  if (!r) { showToast('RC não encontrada.', 'error'); return; }

  const statusEditaveis = ['Rascunho','Aguardando Aprovação','Aprovada – Aguardando Comprador'];
  if (!statusEditaveis.includes(r.status)) {
    showToast(`Não é possível editar uma RC com status "${r.status}".`, 'error');
    return;
  }

  openModalWide(`Editar RC – ${r.numero}`, `
    <div style="background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.25);border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:12px">
      <i class="fas fa-edit" style="color:#f59e0b;margin-right:6px"></i>
      <strong style="color:#f59e0b">${r.numero}</strong>
      ${r.os_vinculada ? ` – OS: <span style="color:var(--fa-teal)">${r.os_vinculada}</span>` : ''}
      · Status atual: ${_statusBadgeFluxo(r.status)}
    </div>

    <div class="form-row" style="display:flex;gap:12px;margin-bottom:12px;flex-wrap:wrap">
      <div style="flex:2;min-width:200px">
        <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">Título da RC *</label>
        <input class="form-control" id="farcEdit_titulo" value="${(r.titulo||'').replace(/"/g,'&quot;')}">
      </div>
      <div style="flex:1;min-width:120px">
        <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">Prazo de Necessidade</label>
        <input class="form-control" id="farcEdit_prazo" type="date" value="${r.prazo||r.prazo_necessidade||''}">
      </div>
    </div>
    <div class="form-row" style="display:flex;gap:12px;margin-bottom:14px;flex-wrap:wrap">
      <div style="flex:1;min-width:120px">
        <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">Urgência</label>
        <select class="form-control" id="farcEdit_urgencia">
          ${['Normal','Urgente','Crítico'].map(u => `<option${(r.urgencia||'Normal')===u?' selected':''}>${u}</option>`).join('')}
        </select>
      </div>
      <div style="flex:2;min-width:200px">
        <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">Observações</label>
        <input class="form-control" id="farcEdit_obs" value="${(r.observacoes||'').replace(/"/g,'&quot;')}">
      </div>
    </div>

    <!-- Itens da RC com status individual -->
    <div style="font-size:13px;font-weight:700;color:var(--text-primary);margin-bottom:8px">
      <i class="fas fa-list-check" style="color:#3b82f6;margin-right:6px"></i>
      Itens da RC – Status Individual
    </div>
    <div id="farcEdit_itens">
      ${(r.itens||[]).map((it, i) => {
        const statusItem = it.status_item || it.status || 'Pendente';
        const statusColors = { 'Aprovado':'#22c55e','Pendente':'#f59e0b','Em Cotação':'#6366f1','Cotado':'#3b82f6','Pedido Emitido':'#10b981','Rejeitado':'#ef4444','Cancelado':'#6b7280' };
        const sc = statusColors[statusItem] || '#8b949e';
        const bloqueado = ['Em Cotação','Cotado','Pedido Emitido'].includes(statusItem);
        return `
          <div class="farcEdit-item-row" data-idx="${i}" style="background:var(--bg-card2);border:1px solid ${sc}33;border-left:3px solid ${sc};border-radius:8px;margin-bottom:6px;padding:10px 12px">
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
              <div style="flex:3;min-width:160px">
                ${i===0?'<label style="font-size:10px;color:var(--text-muted)">Descrição</label>':''}
                <input class="form-control farcEdit-item-desc" value="${(it.descricao||'').replace(/"/g,'&quot;')}" placeholder="Descrição" ${bloqueado?'readonly style="background:var(--bg-tertiary)"':''}>
              </div>
              <div style="flex:0.7;min-width:60px">
                ${i===0?'<label style="font-size:10px;color:var(--text-muted)">Qtd</label>':''}
                <input class="form-control farcEdit-item-qtd" type="number" min="1" value="${it.qtd||1}" oninput="_farcEditCalcTotal()" ${bloqueado?'readonly style="background:var(--bg-tertiary)"':''}>
              </div>
              <div style="flex:0.6;min-width:52px">
                ${i===0?'<label style="font-size:10px;color:var(--text-muted)">Un</label>':''}
                <input class="form-control farcEdit-item-un" value="${it.unidade||'Un'}" ${bloqueado?'readonly style="background:var(--bg-tertiary)"':''}>
              </div>
              <div style="flex:1.2;min-width:95px">
                ${i===0?'<label style="font-size:10px;color:var(--text-muted)">Valor Unit. (R$)</label>':''}
                <input class="form-control farcEdit-item-val" type="number" min="0" step="0.01" value="${it.valor_unit||0}" oninput="_farcEditCalcTotal()" ${bloqueado?'readonly style="background:var(--bg-tertiary)"':''}>
              </div>
              <div style="display:flex;flex-direction:column;align-items:center;gap:3px;min-width:90px">
                ${i===0?'<label style="font-size:10px;color:var(--text-muted)">Status Item</label>':''}
                ${_rcItemStatusBadge(statusItem)}
              </div>
              <div style="display:flex;flex-direction:column;align-items:center;gap:3px">
                ${i===0?'<label style="font-size:10px;color:var(--text-muted)">&nbsp;</label>':''}
                ${bloqueado
                  ? `<span style="font-size:10px;color:var(--text-muted)" title="Item em processo – não pode ser removido"><i class="fas fa-lock" style="color:#6b7280"></i></span>`
                  : `<button class="btn btn-danger btn-sm btn-icon" onclick="this.closest('.farcEdit-item-row').remove();_farcEditCalcTotal()" title="Remover item"><i class="fas fa-trash"></i></button>`
                }
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
    <div style="display:flex;gap:8px;align-items:center;margin-top:6px">
      <button onclick="_farcEditAddItem()" class="btn btn-secondary btn-sm"><i class="fas fa-plus"></i> Adicionar Item</button>
      <span style="font-size:11px;color:var(--text-muted)">Itens com status <em>Em Cotação/Cotado/Pedido Emitido</em> não podem ser alterados.</span>
    </div>

    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:rgba(59,130,246,0.06);border-radius:8px;margin-top:12px;margin-bottom:4px">
      <span style="font-size:12px;color:var(--text-muted)">Total Estimado:</span>
      <span id="farcEdit_total" style="font-size:20px;font-weight:700;color:#3b82f6">R$ 0,00</span>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="_farcSalvarEdicaoRC('${rcId}')">
      <i class="fas fa-save"></i> Salvar Alterações
    </button>
  `);
  setTimeout(() => _farcEditCalcTotal(), 100);
}

function _farcEditCalcTotal() {
  const qtds = document.querySelectorAll('#farcEdit_itens .farcEdit-item-qtd');
  const vals = document.querySelectorAll('#farcEdit_itens .farcEdit-item-val');
  let total = 0;
  qtds.forEach((q, i) => { total += (parseFloat(q.value)||0) * (parseFloat(vals[i]?.value)||0); });
  const el = document.getElementById('farcEdit_total');
  if (el) el.textContent = _fmtVal(total);
}

function _farcEditAddItem() {
  const cont = document.getElementById('farcEdit_itens');
  if (!cont) return;
  const div = document.createElement('div');
  div.innerHTML = `
    <div class="farcEdit-item-row" style="background:var(--bg-card2);border:1px solid rgba(230,126,34,0.3);border-left:3px solid #e67e22;border-radius:8px;margin-bottom:6px;padding:10px 12px">
      <div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap">
        <div style="flex:3;min-width:160px"><input class="form-control farcEdit-item-desc" placeholder="Descrição do item"></div>
        <div style="flex:0.7;min-width:60px"><input class="form-control farcEdit-item-qtd" type="number" min="1" value="1" oninput="_farcEditCalcTotal()"></div>
        <div style="flex:0.6;min-width:52px"><input class="form-control farcEdit-item-un" value="Un"></div>
        <div style="flex:1.2;min-width:95px"><input class="form-control farcEdit-item-val" type="number" min="0" step="0.01" value="0" oninput="_farcEditCalcTotal()"></div>
        <div style="display:flex;flex-direction:column;align-items:center;gap:3px;min-width:90px">
          ${_rcItemStatusBadge('Pendente')}
        </div>
        <div><button class="btn btn-danger btn-sm btn-icon" onclick="this.closest('.farcEdit-item-row').remove();_farcEditCalcTotal()" title="Remover"><i class="fas fa-trash"></i></button></div>
      </div>
    </div>
  `;
  cont.appendChild(div.firstElementChild);
}

function _farcSalvarEdicaoRC(rcId) {
  const titulo   = document.getElementById('farcEdit_titulo')?.value.trim();
  const prazo    = document.getElementById('farcEdit_prazo')?.value;
  const urgencia = document.getElementById('farcEdit_urgencia')?.value;
  const obs      = document.getElementById('farcEdit_obs')?.value.trim() || '';

  if (!titulo) { showToast('Informe o título da RC.', 'error'); return; }

  // Coleta itens do modal de edição
  const rows  = document.querySelectorAll('#farcEdit_itens .farcEdit-item-row');
  const itens = [];
  rows.forEach((row, i) => {
    const desc = row.querySelector('.farcEdit-item-desc')?.value.trim();
    if (!desc) return;
    const qtd      = parseFloat(row.querySelector('.farcEdit-item-qtd')?.value) || 1;
    const un       = row.querySelector('.farcEdit-item-un')?.value.trim() || 'Un';
    const vlUnit   = parseFloat(row.querySelector('.farcEdit-item-val')?.value) || 0;
    // Preserva status_item original se existir
    const origLista = _obterRCLocal();
    const origRC    = origLista.find(x => x.id === rcId);
    const origItem  = (origRC?.itens||[])[i];
    const statusItem = origItem?.status_item || origItem?.status || 'Pendente';
    itens.push({
      descricao:  desc,
      qtd,
      unidade:    un,
      valor_unit: vlUnit,
      total:      qtd * vlUnit,
      status_item: statusItem,
      origem_os:  origItem?.origem_os || false
    });
  });

  if (itens.length === 0) { showToast('Adicione ao menos um item na RC.', 'error'); return; }

  const valorTotal = itens.reduce((s, it) => s + (it.total||0), 0);

  // Atualiza lista de RCs
  const lista = _obterRCLocal();
  const idx   = lista.findIndex(x => x.id === rcId);
  if (idx < 0) { showToast('RC não encontrada para salvar.', 'error'); return; }

  const antes = { ...lista[idx] };
  lista[idx] = {
    ...lista[idx],
    titulo,
    prazo,
    prazo_necessidade: prazo,
    urgencia,
    observacoes:  obs,
    itens,
    valor_total:  valorTotal,
    editado_em:   new Date().toISOString(),
    editado_por:  currentUser?.name || ''
  };

  // Registra no histórico
  if (!lista[idx].historico) lista[idx].historico = [];
  lista[idx].historico.unshift({
    acao: `RC editada por ${currentUser?.name||'—'}: título, itens e/ou prazo atualizados`,
    usuario: currentUser?.name || '—',
    data: new Date().toLocaleString('pt-BR')
  });

  _salvarRCLocal(lista);

  logAction && logAction('Edição RC', 'Emissão de Requisições', `RC ${lista[idx].numero} editada por ${currentUser?.name||'—'}`);

  closeModal();
  showToast(`✅ RC ${lista[idx].numero} atualizada com sucesso!`, 'success', 4000);
  renderFluxoAprovacaoRC();
  setTimeout(() => farcSwitchTab && farcSwitchTab('emissao'), 100);
}

// ─── APROVAR RC DIRETA (sem OS vinculada ou RC avulsa) ───────────────────────
// Função chamada quando uma RC avulsa está em "Aguardando Aprovação"
// e um aprovador (admin/diretor/supervisor) clica em aprovar.
// ── reqAprovarRC: versão consolidada (usada pelo botão da tabela de RCs) ──────
// Definição final abaixo na seção "APROVAÇÃO DE RC AVULSA" (linha ~8130).
// Este bloco é um stub de compatibilidade para evitar ReferenceError em
// chamadas inline geradas antes da definição principal ser carregada.
// A definição real sobrescreve via window.reqAprovarRC no final do arquivo.

function _reqReprovarRCDireta(rcId) {
  const lista = _obterRCLocal();
  const idx   = lista.findIndex(r => r.id === rcId);
  if (idx < 0) return;
  openModal('Reprovar RC', `
    <p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px">
      Informe o motivo da reprovação. A RC voltará ao solicitante para revisão.
    </p>
    <textarea id="motivo_repr_rc" rows="3" placeholder="Motivo da reprovação..."
      style="width:100%;padding:8px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:6px;color:var(--text-primary);font-size:12px;box-sizing:border-box;resize:vertical"></textarea>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-danger" onclick="_reqConfirmarReprovarRC('${rcId}')"><i class="fas fa-times"></i> Confirmar Reprovação</button>
  `);
}

function _reqConfirmarReprovarRC(rcId) {
  const lista  = _obterRCLocal();
  const idx    = lista.findIndex(r => r.id === rcId);
  if (idx < 0) return;
  const motivo = document.getElementById('motivo_repr_rc')?.value.trim() || 'Sem justificativa';
  const hoje   = new Date().toLocaleString('pt-BR');
  lista[idx].status = 'Rejeitada';
  lista[idx].motivo_rejeicao = motivo;
  lista[idx].historico = lista[idx].historico || [];
  lista[idx].historico.unshift({ acao: `RC reprovada por ${currentUser?.name}: ${motivo}`, usuario: currentUser?.name, data: hoje });
  _salvarRCLocal(lista);
  logAction && logAction('Reprovação RC', 'Emissão de Requisições', `RC ${lista[idx].numero} reprovada: ${motivo}`);
  closeModal();
  showToast(`RC ${lista[idx].numero} reprovada. Solicitante deve revisar.`, 'warning');
  renderFluxoAprovacaoRC();
}

// Processar RC (comprador aceita e cria RFQ) → redireciona para aba Cotações
function farcProcessarRC(rcId) {
  if (!_podeProcessarRC()) {
    showToast('Sem permissão para processar RC.', 'error');
    return;
  }
  // Redireciona para aba Cotações e abre modal de criação de RFQ para esta RC
  farcSwitchTab('cotacoes');
  setTimeout(() => {
    if (typeof farcCriarRFQ === 'function') farcCriarRFQ(rcId);
  }, 150);
}

// ════════════════════════════════════════════════════════════════════════════
// ABA 3 – COTAÇÕES (RFQ)
// Fluxo: RC Aprovada → Criar RFQ → Fornecedores → Envio → Matriz → Quadro
// ════════════════════════════════════════════════════════════════════════════

// ─── BADGE DE STATUS RFQ ─────────────────────────────────────────────────────
function _rfqBadge(s) {
  const m = {
    'Aguardando Envio':    '#f59e0b',
    'Aguardando Cotações': '#6366f1',
    'Em Cotação':          '#3b82f6',
    'Negociando':          '#f97316',
    'Cotações Recebidas':  '#8b5cf6',
    'Mapa Criado':         '#7c3aed',
    'Aprovada':            '#10b981',
    'PC Emitido':          '#22c55e',
    'Cancelada':           '#6b7280'
  };
  const c = m[s]||'#8b949e';
  return `<span style="background:${c}22;color:${c};border-radius:6px;padding:3px 8px;font-size:10px;font-weight:700;white-space:nowrap">${s}</span>`;
}

function _farcRenderTabCotacoes() {
  // Lê de fa_rfq_flow (fonte principal) E de fa_rfqs (criados pelo procurement.js)
  // e mescla, evitando duplicatas por id
  const rfqsFlow = typeof _getRFQFlow === 'function' ? _getRFQFlow() : [];
  let   rfqsProc = [];
  try { rfqsProc = JSON.parse(localStorage.getItem('fa_rfqs') || '[]'); } catch(e) {}

  // Normaliza campos do procurement.js para o formato do fluxo_aprovacao_rc.js
  const _normRFQ = (r) => {
    // 'Aguardando Envio' foi removido do fluxo — qualquer RFQ nesse status
    // já passou pela aceitação do comprador, portanto é 'Em Cotação'
    let status = r.status || 'Em Cotação';
    if (status === 'Aguardando Envio') status = 'Em Cotação';
    return {
      ...r,
      // Garante campo 'numero' (fluxo usa r.numero, procurement usa r.numero_rfq)
      numero:        r.numero        || r.numero_rfq || r.id,
      numero_rfq:    r.numero_rfq    || r.numero     || r.id,
      // Garante campo 'fornecedores' (lista de objetos {id,nome,email})
      fornecedores:  r.fornecedores  || (r.fornecedores_detalhes || []).map(f => ({
        id: f.id, nome: f.nome, email: f.email || '', tipo: f.tipo || 'cadastrado',
        cotacao_enviada: !!f.email, cotacao_recebida: false
      })),
      // Garante campo de itens
      itens_cotados: r.itens_cotados || r.itens || [],
      status,
    };
  };

  // Mescla sem duplicatas (prioriza fa_rfq_flow)
  const idsFlow = new Set(rfqsFlow.map(r => r.id));
  const rfqsMerge = [...rfqsFlow, ...rfqsProc.filter(r => !idsFlow.has(r.id))].map(_normRFQ);

  // Ordena por data de criação (mais recente primeiro)
  rfqsMerge.sort((a, b) => new Date(b.data_criacao||0) - new Date(a.data_criacao||0));

  const rfqs      = rfqsMerge;
  const rcs       = _obterRCLocal();
  const isCompras = _podeProcessarRC();

  // RC aprovadas aguardando RFQ (status direto OU "Em Cotação" sem RFQ vinculado ainda)
  const rcParaRFQ  = rcs.filter(r => r.status === 'Aprovada – Aguardando Comprador');
  const rfqEnvio   = rfqs.filter(r => r.status === 'Aguardando Envio');
  const rfqAtivos  = rfqs.filter(r => ['Aguardando Cotações','Em Cotação','Negociando'].includes(r.status));
  const rfqProntos = rfqs.filter(r => r.status === 'Cotações Recebidas');
  const rfqMapa    = rfqs.filter(r => r.status === 'Mapa Criado');
  const rfqTodos   = rfqs;

  return `
    <div style="padding:16px">

      <!-- ── MINI PIPELINE DA ABA ── -->
      <div style="display:flex;gap:0;overflow-x:auto;margin-bottom:16px;padding:10px;background:var(--bg-card2);border-radius:10px;border:1px solid var(--border-color)">
        ${[
          { icon:'fa-inbox',        label:'RC Aprovadas', count: rcParaRFQ.length,  color:'#3b82f6', desc:'Aguard. RFQ' },
          { icon:'fa-paper-plane',  label:'Envio',        count: rfqEnvio.length,   color:'#f59e0b', desc:'Aguard. Envio' },
          { icon:'fa-clock',        label:'Em Cotação',   count: rfqAtivos.length,  color:'#6366f1', desc:'Prop. Abertas' },
          { icon:'fa-check-double', label:'Prop. Recebidas', count: rfqProntos.length, color:'#8b5cf6', desc:'Todas Recebi.' },
          { icon:'fa-balance-scale',label:'Mapa Criado',  count: rfqMapa.length,   color:'#7c3aed', desc:'Aguard. Aprova.' },
        ].map((s, i, arr) => `
          <div style="flex:1;text-align:center;position:relative;min-width:80px">
            <div style="width:40px;height:40px;background:${s.count>0?s.color+'22':'rgba(255,255,255,0.04)'};border:2px solid ${s.count>0?s.color:'var(--border-color)'};border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 5px;transition:.3s">
              <i class="fas ${s.icon}" style="color:${s.count>0?s.color:'var(--text-muted)'};font-size:14px"></i>
            </div>
            ${s.count>0 ? `<div style="position:absolute;top:-4px;right:calc(50% - 26px);background:${s.color};color:#fff;border-radius:10px;padding:1px 6px;font-size:10px;font-weight:700">${s.count}</div>` : ''}
            <div style="font-size:10px;font-weight:700;color:${s.count>0?s.color:'var(--text-muted)'}">${s.label}</div>
            <div style="font-size:9px;color:var(--text-muted)">${s.desc}</div>
            ${i < arr.length-1 ? `<div style="position:absolute;top:18px;right:-10px;color:var(--text-muted);font-size:16px;z-index:1">›</div>` : ''}
          </div>
        `).join('')}
      </div>

      <!-- ── ALERTA: RC aguardando RFQ ── -->
      ${!isCompras ? `
        <div style="padding:12px 16px;background:rgba(20,184,166,0.06);border:1px solid rgba(20,184,166,0.2);border-radius:10px;margin-bottom:16px;font-size:12px;color:var(--text-secondary)">
          <i class="fas fa-info-circle" style="color:var(--fa-teal);margin-right:6px"></i>
          Você está no modo <strong>visualização</strong>. O processo de cotação (criação de RFQ, seleção de fornecedores e quadro comparativo) é realizado pelo setor de <strong>Compras</strong>.
        </div>
      ` : ''}

      <!-- ── PAINEL: RC aguardando RFQ (visível para todos, ação só compras) ── -->
      ${rcParaRFQ.length > 0 ? `
        <div style="background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.3);border-radius:10px;padding:14px 16px;margin-bottom:16px">
          <div style="font-size:13px;font-weight:700;color:#3b82f6;margin-bottom:10px">
            <i class="fas fa-inbox" style="margin-right:6px"></i>
            ${rcParaRFQ.length} RC(s) aprovada(s) – prontas para criação de RFQ
          </div>
          <div style="display:flex;flex-direction:column;gap:6px">
            ${rcParaRFQ.slice(0,8).map(r => `
              <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:rgba(0,0,0,0.15);border-radius:8px">
                <div style="flex:1;min-width:0">
                  <div style="font-size:12px;font-weight:600;color:var(--text-primary)">${r.numero} – <span style="overflow:hidden;text-overflow:ellipsis">${r.titulo}</span></div>
                  <div style="font-size:11px;color:var(--text-muted)">
                    Solicitante: ${r.solicitante||'—'} · ${r.itens?.length||0} itens · ${_fmtVal(r.valor_total)}
                    ${r.os_vinculada ? `· <span style="color:var(--fa-teal)">OS: ${r.os_vinculada}</span>` : ''}
                    ${r.prazo_necessidade ? `· Prazo: ${r.prazo_necessidade}` : ''}
                  </div>
                </div>
                ${isCompras ? `
                  <button onclick="farcCriarRFQ('${r.id}')" class="btn btn-primary btn-sm" style="white-space:nowrap">
                    <i class="fas fa-paper-plane"></i> Criar RFQ
                  </button>
                ` : '<span style="font-size:10px;color:var(--text-muted);white-space:nowrap">Aguard. Compras</span>'}
                <button onclick="farcVerDetalheRC('${r.id}')" class="btn btn-secondary btn-sm btn-icon" title="Ver detalhes da RC">
                  <i class="fas fa-eye"></i>
                </button>
              </div>
            `).join('')}
            ${rcParaRFQ.length > 8 ? `<div style="font-size:11px;color:var(--text-muted);text-align:center;padding:4px">+ ${rcParaRFQ.length - 8} RC(s) adicionais aprovadas</div>` : ''}
          </div>
        </div>
      ` : (isCompras && rcParaRFQ.length === 0 && rfqTodos.length === 0 ? `
        <div style="text-align:center;padding:40px;color:var(--text-muted);background:var(--bg-card2);border-radius:10px;border:1px dashed var(--border-color);margin-bottom:16px">
          <i class="fas fa-paper-plane" style="font-size:32px;display:block;margin-bottom:10px;opacity:.3"></i>
          <div style="font-size:13px;font-weight:600">Nenhuma RC aguardando RFQ</div>
          <div style="font-size:11px;margin-top:4px">Quando RCs forem aprovadas no fluxo, aparecerão aqui para criação de RFQ.</div>
        </div>
      ` : '')}

      <!-- ── RFQs AGUARDANDO ENVIO ── -->
      ${rfqEnvio.length > 0 ? `
        <div style="background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.25);border-radius:10px;padding:14px 16px;margin-bottom:16px">
          <div style="font-size:13px;font-weight:700;color:#f59e0b;margin-bottom:10px">
            <i class="fas fa-hourglass-start" style="margin-right:6px"></i>
            ${rfqEnvio.length} RFQ(s) criado(s) – aguardando envio aos fornecedores
          </div>
          <div style="display:flex;flex-direction:column;gap:6px">
            ${rfqEnvio.map(r => `
              <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:rgba(0,0,0,0.15);border-radius:8px">
                <div style="flex:1;min-width:0">
                  <div style="font-size:12px;font-weight:600;color:var(--text-primary)">${r.numero} – ${r.titulo}</div>
                  <div style="font-size:11px;color:var(--text-muted)">RC: ${r.rc_numero||'—'} · ${(r.fornecedores||[]).length} fornecedor(es) · Prazo: ${r.prazo_cotacao||'—'}</div>
                </div>
                ${isCompras ? `
                  <button onclick="_rfqAbrirModalEmail('${r.id}')" class="btn btn-primary btn-sm" style="white-space:nowrap">
                    <i class="fas fa-envelope"></i> Enviar por E-mail
                  </button>
                  <button onclick="_rfqGerarPDF_id('${r.id}')" class="btn btn-secondary btn-sm btn-icon" title="Gerar PDF"><i class="fas fa-file-pdf" style="color:#ef4444"></i></button>
                  <button onclick="_rfqMarcarEnviado('${r.id}')" class="btn btn-secondary btn-sm btn-icon" title="Marcar como enviado manualmente"><i class="fas fa-check"></i></button>
                ` : ''}
                <button onclick="farcVerRFQ('${r.id}')" class="btn btn-secondary btn-sm btn-icon" title="Ver detalhes"><i class="fas fa-eye"></i></button>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- ── RFQs ATIVOS ── -->
      ${rfqAtivos.length > 0 ? `
        <div style="background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.25);border-radius:10px;padding:14px 16px;margin-bottom:16px">
          <div style="font-size:13px;font-weight:700;color:#6366f1;margin-bottom:10px">
            <i class="fas fa-clock" style="margin-right:6px"></i>
            ${rfqAtivos.length} RFQ(s) em andamento – aguardando propostas de fornecedores
          </div>
          <div style="display:flex;flex-direction:column;gap:6px">
            ${rfqAtivos.slice(0,5).map(r => {
              const cotRec = (r.fornecedores||[]).filter(f => f.cotacao_recebida).length;
              const total  = (r.fornecedores||[]).length;
              const pct    = total > 0 ? Math.round((cotRec/total)*100) : 0;
              return `
                <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:rgba(0,0,0,0.15);border-radius:8px">
                  <div style="flex:1;min-width:0">
                    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                      <span style="font-size:12px;font-weight:700;color:#6366f1">${r.numero}</span>
                      <span style="font-size:12px;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis">${r.titulo}</span>
                      ${_rfqBadge(r.status)}
                    </div>
                    <div style="font-size:11px;color:var(--text-muted);margin-top:2px">
                      RC: ${r.rc_numero||'—'} · Prazo: ${r.prazo_cotacao||'—'} · ${cotRec}/${total} propostas
                    </div>
                    <!-- Barra de progresso propostas -->
                    <div style="margin-top:5px;background:rgba(255,255,255,0.08);border-radius:4px;height:4px;overflow:hidden;width:200px">
                      <div style="height:100%;width:${pct}%;background:${pct===100?'#22c55e':'#6366f1'};transition:.3s"></div>
                    </div>
                  </div>
                  <div style="display:flex;gap:4px;flex-wrap:wrap">
                    ${isCompras ? `
                      <button onclick="farcMatrizCotacao('${r.id}')" class="btn btn-primary btn-sm" style="white-space:nowrap"><i class="fas fa-table"></i> Matriz</button>
                      <button onclick="_rfqAbrirModalEmail('${r.id}')" class="btn btn-info btn-sm btn-icon" title="Reenviar E-mail / PDF"><i class="fas fa-envelope"></i></button>
                    ` : ''}
                    <button onclick="farcVerRFQ('${r.id}')" class="btn btn-secondary btn-sm btn-icon" title="Ver detalhes"><i class="fas fa-eye"></i></button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      ` : ''}

      <!-- ── RFQs PRONTOS PARA MAPA ── -->
      ${rfqProntos.length > 0 ? `
        <div style="background:rgba(139,92,246,0.06);border:1px solid rgba(139,92,246,0.25);border-radius:10px;padding:14px 16px;margin-bottom:16px">
          <div style="font-size:13px;font-weight:700;color:#8b5cf6;margin-bottom:10px">
            <i class="fas fa-check-double" style="margin-right:6px"></i>
            ${rfqProntos.length} RFQ(s) com todas as cotações – prontos para Quadro Comparativo
          </div>
          <div style="display:flex;flex-direction:column;gap:6px">
            ${rfqProntos.map(r => `
              <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:rgba(0,0,0,0.15);border-radius:8px">
                <div style="flex:1">
                  <div style="font-size:12px;font-weight:600;color:var(--text-primary)">${r.numero} – ${r.titulo}</div>
                  <div style="font-size:11px;color:var(--text-muted)">${(r.fornecedores||[]).length} fornecedores · Melhor proposta: ${_fmtVal(Math.min(...(r.fornecedores||[]).map(f=>f.valor_total||Infinity).filter(v=>v!==Infinity)))}</div>
                </div>
                <div style="display:flex;gap:4px">
                  ${isCompras ? `<button onclick="farcGerarMapaComIA('${r.id}')" class="btn btn-success btn-sm" style="white-space:nowrap"><i class="fas fa-balance-scale"></i> Criar Quadro Comparativo</button>` : ''}
                  ${isCompras ? `<button onclick="farcMatrizCotacao('${r.id}')" class="btn btn-secondary btn-sm btn-icon" title="Editar cotações"><i class="fas fa-edit"></i></button>` : ''}
                  <button onclick="farcVerRFQ('${r.id}')" class="btn btn-secondary btn-sm btn-icon" title="Ver"><i class="fas fa-eye"></i></button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- ── BUSCA E TABELA COMPLETA ── -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">
        <div style="font-size:14px;font-weight:700;color:var(--text-primary)">
          <i class="fas fa-list" style="color:#6366f1;margin-right:8px"></i>Todos os RFQs
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <input type="text" id="farc_search_rfq" placeholder="Buscar..." oninput="_farcFiltrarRFQ()"
            style="padding:6px 10px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:12px;width:160px">
          <select id="farc_filter_rfq" onchange="_farcFiltrarRFQ()"
            style="padding:6px 10px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:12px">
            <option value="">Todos</option>
            <option>Aguardando Envio</option>
            <option>Aguardando Cotações</option>
            <option>Em Cotação</option>
            <option>Negociando</option>
            <option>Cotações Recebidas</option>
            <option>Mapa Criado</option>
            <option>PC Emitido</option>
          </select>
        </div>
      </div>
      <div id="farc_tabela_rfq">${_farcTabelaRFQ(rfqs)}</div>
    </div>
  `;
}

function _farcTabelaRFQ(lista) {
  if (!lista.length) return `
    <div style="text-align:center;padding:40px;color:var(--text-muted);background:var(--bg-card2);border-radius:10px;border:1px dashed var(--border-color)">
      <i class="fas fa-paper-plane" style="font-size:28px;display:block;margin-bottom:8px;opacity:.4"></i>
      <div style="font-size:13px;font-weight:600">Nenhum RFQ criado</div>
      <div style="font-size:11px;margin-top:4px">RFQs são criados a partir de RC aprovadas</div>
    </div>`;
  const isCompras = _podeProcessarRC();
  return `
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead>
          <tr style="background:var(--bg-tertiary)">
            <th style="padding:9px 12px;text-align:left;font-size:11px;color:var(--text-secondary)">Número</th>
            <th style="padding:9px 12px;text-align:left;font-size:11px;color:var(--text-secondary)">Título</th>
            <th style="padding:9px 12px;text-align:left;font-size:11px;color:var(--text-secondary)">RC</th>
            <th style="padding:9px 12px;text-align:center;font-size:11px;color:var(--text-secondary)">Forn.</th>
            <th style="padding:9px 12px;text-align:center;font-size:11px;color:var(--text-secondary)">Respostas</th>
            <th style="padding:9px 12px;text-align:center;font-size:11px;color:var(--text-secondary)">Prazo</th>
            <th style="padding:9px 12px;text-align:center;font-size:11px;color:var(--text-secondary)">Status</th>
            <th style="padding:9px 12px;text-align:center;font-size:11px;color:var(--text-secondary)">Ações</th>
          </tr>
        </thead>
        <tbody>
          ${lista.map(r => {
            const cotRec = (r.fornecedores||[]).filter(f => f.cotacao_recebida).length;
            const total  = (r.fornecedores||[]).length;
            return `
              <tr style="border-bottom:1px solid var(--border-color)" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='transparent'">
                <td style="padding:9px 12px;font-weight:700;color:#6366f1">${r.numero}</td>
                <td style="padding:9px 12px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${r.titulo}">${r.titulo}</td>
                <td style="padding:9px 12px;color:var(--orange);font-weight:600;font-size:11px">${r.rc_numero||'—'}</td>
                <td style="padding:9px 12px;text-align:center">${total}</td>
                <td style="padding:9px 12px;text-align:center">
                  <span style="color:${cotRec===total&&total>0?'#22c55e':cotRec>0?'#f59e0b':'var(--text-muted)'};font-weight:600">${cotRec}/${total}</span>
                </td>
                <td style="padding:9px 12px;text-align:center;color:var(--text-secondary);font-size:11px">${r.prazo_cotacao||'—'}</td>
                <td style="padding:9px 12px;text-align:center">${_rfqBadge(r.status)}</td>
                <td style="padding:9px 12px;text-align:center">
                  <div style="display:flex;gap:4px;justify-content:center;flex-wrap:wrap">
                    <button onclick="farcVerRFQ('${r.id}')" class="btn btn-secondary btn-sm btn-icon" title="Ver detalhes"><i class="fas fa-eye"></i></button>
                    ${isCompras && ['Em Cotação','Aguardando Cotações','Aguardando Envio','Negociando'].includes(r.status) ? `
                      <button onclick="_rfqAbrirModalEmail('${r.id}')" class="btn btn-primary btn-sm btn-icon" title="Enviar por E-mail / PDF"><i class="fas fa-envelope"></i></button>
                      <button onclick="_rfqGerarPDF_id('${r.id}')" class="btn btn-secondary btn-sm btn-icon" title="Gerar PDF"><i class="fas fa-file-pdf" style="color:#ef4444"></i></button>
                      <button onclick="farcMatrizCotacao('${r.id}')" class="btn btn-info btn-sm btn-icon" title="Matriz de Cotações"><i class="fas fa-table"></i></button>
                    ` : ''}
                    ${isCompras && r.status === 'Cotações Recebidas' ? `<button onclick="farcGerarMapaComIA('${r.id}')" class="btn btn-success btn-sm btn-icon" title="Criar Quadro Comparativo"><i class="fas fa-balance-scale"></i></button>` : ''}
                  </div>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function _farcFiltrarRFQ() {
  const s  = (document.getElementById('farc_search_rfq')?.value||'').toLowerCase();
  const st = document.getElementById('farc_filter_rfq')?.value||'';
  // Mescla ambos os storages
  const flowRFQs = typeof _getRFQFlow === 'function' ? _getRFQFlow() : [];
  let   procRFQs = []; try { procRFQs = JSON.parse(localStorage.getItem('fa_rfqs')||'[]'); } catch(e) {}
  const idsFlow = new Set(flowRFQs.map(r => r.id));
  const todos = [...flowRFQs, ...procRFQs.filter(r => !idsFlow.has(r.id))].map(r => ({
    ...r, numero: r.numero || r.numero_rfq || r.id,
    fornecedores: r.fornecedores || (r.fornecedores_detalhes||[]).map(f => ({...f}))
  }));
  const f  = todos.filter(r =>
    (!s || ((r.numero||'')+(r.titulo||'')+(r.rc_numero||'')).toLowerCase().includes(s)) &&
    (!st || r.status === st)
  );
  const el = document.getElementById('farc_tabela_rfq');
  if (el) el.innerHTML = _farcTabelaRFQ(f);
}

// ─── CRIAR RFQ A PARTIR DE RC ─────────────────────────────────────────────────
function farcCriarRFQ(rcId) {
  const rc = (_obterRCLocal()).find(r => r.id === rcId);
  if (!rc) { showToast('RC não encontrada.','error'); return; }

  const fornList = (typeof _getFornecedores === 'function' ? _getFornecedores() : []).filter(f => f.status === 'Ativo' || f.status === 'Homologado');
  const prazoDefault = new Date(Date.now() + 7*864e5).toISOString().split('T')[0];
  const ano  = new Date().getFullYear();
  const rfqs = typeof _getRFQFlow === 'function' ? _getRFQFlow() : [];
  const numSeq = String(rfqs.length + 1).padStart(4,'0');
  const rfqNum = `RFQ-${ano}-${numSeq}`;

  openModalWide(`Criar RFQ – ${rc.numero}`, `
    <div style="background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.25);border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:12px">
      <div style="font-weight:700;color:#6366f1;margin-bottom:4px">
        <i class="fas fa-link" style="margin-right:6px"></i>RC de Origem: ${rc.numero} – ${rc.titulo}
      </div>
      <div style="color:var(--text-muted)">${rc.itens?.length||0} itens · ${_fmtVal(rc.valor_total)} · Solicitante: ${rc.solicitante||'—'}</div>
    </div>

    <div class="form-row">
      <div class="form-group" style="flex:2"><label>Título do RFQ *</label>
        <input class="form-control" id="rfq_titulo" value="RFQ – ${rc.numero}: ${rc.titulo?.substring(0,50)||''}">
      </div>
      <div class="form-group"><label>Número</label>
        <input class="form-control" id="rfq_numero" value="${rfqNum}" readonly style="background:var(--bg-tertiary)">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Prazo para Cotação *</label>
        <input class="form-control" id="rfq_prazo" type="date" value="${prazoDefault}">
      </div>
      <div class="form-group"><label>Tipo</label>
        <select class="form-control" id="rfq_tipo">
          <option>Material</option><option>Serviço</option><option>Misto</option>
        </select>
      </div>
      <div class="form-group"><label>Urgência</label>
        <select class="form-control" id="rfq_urgencia">
          <option>Normal</option><option>Urgente</option><option>Crítico</option>
        </select>
      </div>
    </div>

    <!-- Critérios fechados para análise IA no Quadro Comparativo -->
    <div style="margin-bottom:14px;padding:12px;border:1px solid rgba(99,102,241,0.3);border-radius:8px;background:rgba(99,102,241,0.04)">
      <div style="font-size:12px;font-weight:700;color:#6366f1;margin-bottom:10px">
        <i class="fas fa-brain" style="margin-right:6px"></i>Critérios de Análise (usados pela IA no Quadro Comparativo)
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px">
        ${[
          {id:'crit_preco',     label:'Preço / Custo',       default: 40},
          {id:'crit_prazo',     label:'Prazo de Entrega',    default: 20},
          {id:'crit_qualidade', label:'Qualidade / Garantia',default: 20},
          {id:'crit_pagamento', label:'Condições de Pagamento', default: 10},
          {id:'crit_esg',       label:'ESG / Sustentabilidade', default: 5},
          {id:'crit_suporte',   label:'Suporte Técnico',     default: 5},
        ].map(c => `
          <div style="display:flex;align-items:center;gap:6px;font-size:12px">
            <label for="${c.id}" style="flex:1;color:var(--text-secondary)">${c.label}</label>
            <input id="${c.id}" type="number" min="0" max="100" value="${c.default}"
              style="width:55px;padding:4px 6px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:6px;color:var(--text-primary);font-size:12px;text-align:center">
            <span style="color:var(--text-muted);font-size:11px">%</span>
          </div>
        `).join('')}
      </div>
      <div style="font-size:10px;color:var(--text-muted);margin-top:8px">
        <i class="fas fa-info-circle" style="margin-right:4px"></i>A soma deve ser 100%. A IA usará estes pesos para recomendar o melhor fornecedor.
      </div>
    </div>

    <!-- Observações para fornecedores -->
    <div class="form-group" style="margin-bottom:14px">
      <label>Instruções para Fornecedores / Escopo</label>
      <textarea class="form-control" id="rfq_obs" rows="2" placeholder="Descreva o escopo, condições especiais, prazo de entrega, local de entrega, etc."></textarea>
    </div>

    <!-- ── SELEÇÃO DE FORNECEDORES ── -->
    <div style="margin-bottom:14px">
      <div style="font-size:13px;font-weight:700;color:var(--text-primary);margin-bottom:10px">
        <i class="fas fa-building" style="color:#6366f1;margin-right:8px"></i>
        Fornecedores no Processo
      </div>

      <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:12px;align-items:start;margin-bottom:10px">

        <!-- Col 1: Busca autocomplete de cadastrados -->
        <div>
          <label style="font-size:10px;color:#6366f1;font-weight:700;display:block;margin-bottom:5px;text-transform:uppercase;letter-spacing:.4px">
            <i class="fas fa-building" style="margin-right:4px"></i>Selecionar Cadastrado
          </label>
          <div style="position:relative">
            <input type="text" id="rfq_forn_busca"
              placeholder="🔍 Nome, CNPJ ou categoria..."
              oninput="_rfqFiltrarFornecedoresRFQ()"
              onfocus="_rfqFiltrarFornecedoresRFQ()"
              style="width:100%;padding:8px 10px;background:var(--bg-secondary);border:1px solid rgba(99,102,241,0.35);border-radius:8px;color:var(--text-primary);font-size:12px;box-sizing:border-box">
            <div id="rfq_forn_dropdown" style="display:none;position:absolute;top:100%;left:0;right:0;background:var(--bg-card);border:1px solid var(--border-color);border-radius:8px;max-height:200px;overflow-y:auto;z-index:9999;box-shadow:0 8px 24px rgba(0,0,0,.25);margin-top:2px"></div>
          </div>
          <button onclick="_rfqAdicionarFornSelecionadoRFQ()" style="margin-top:6px;width:100%;padding:7px 12px;border:none;border-radius:7px;background:#6366f1;color:#fff;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px">
            <i class="fas fa-plus"></i> Adicionar Selecionado
          </button>
        </div>

        <!-- Divisor -->
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding-top:24px;gap:6px;min-width:40px">
          <div style="width:1px;height:30px;background:var(--border-color)"></div>
          <span style="font-size:10px;color:var(--text-muted);font-weight:700;background:var(--bg-card);padding:2px 6px;border-radius:6px;border:1px solid var(--border-color)">OU</span>
          <div style="width:1px;height:30px;background:var(--border-color)"></div>
        </div>

        <!-- Col 2: Novo fornecedor manual -->
        <div>
          <label style="font-size:10px;color:#f59e0b;font-weight:700;display:block;margin-bottom:5px;text-transform:uppercase;letter-spacing:.4px">
            <i class="fas fa-pencil-alt" style="margin-right:4px"></i>Inserir Novo Fornecedor
          </label>
          <input type="text" id="rfq_forn_novo_nome"
            placeholder="Nome / razão social do novo fornecedor"
            style="width:100%;padding:8px 10px;background:var(--bg-secondary);border:1px solid rgba(245,158,11,0.35);border-radius:8px;color:var(--text-primary);font-size:12px;box-sizing:border-box">
          <button onclick="_rfqAddFornNovo()" style="margin-top:6px;width:100%;padding:7px 12px;border:1px solid rgba(245,158,11,0.4);border-radius:7px;background:rgba(245,158,11,0.12);color:#f59e0b;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px">
            <i class="fas fa-plus"></i> Inserir Novo
          </button>
        </div>
      </div>

      <!-- Lista de fornecedores adicionados ao RFQ -->
      <div id="rfq_forn_adicionados" style="display:flex;flex-direction:column;gap:6px;margin-bottom:8px"></div>

      <!-- Fornecedores manuais extras (linha nome/email/tel) -->
      <div id="rfq_forn_novos" style="display:flex;flex-direction:column;gap:6px"></div>

    </div>

    <!-- Método de envio -->
    <div style="padding:12px;border:1px solid var(--border-color);border-radius:8px;background:var(--bg-card2)">
      <div style="font-size:12px;font-weight:700;color:var(--text-primary);margin-bottom:8px">
        <i class="fas fa-paper-plane" style="color:#6366f1;margin-right:6px"></i>Método de Envio
      </div>
      <div style="display:flex;gap:14px;flex-wrap:wrap">
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer">
          <input type="radio" name="rfq_envio" value="email" checked style="accent-color:#6366f1"> Enviar por E-mail
        </label>
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer">
          <input type="radio" name="rfq_envio" value="pdf"> Gerar PDF para envio manual
        </label>
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer">
          <input type="radio" name="rfq_envio" value="ambos"> Ambos (E-mail + PDF)
        </label>
      </div>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-secondary" onclick="_rfqGerarPDF('${rcId}')" title="Gerar PDF da solicitação de cotação">
      <i class="fas fa-file-pdf"></i> Pré-visualizar PDF
    </button>
    <button class="btn btn-primary" onclick="_rfqSalvarEEnviar('${rcId}')">
      <i class="fas fa-paper-plane"></i> Criar RFQ e Enviar
    </button>
  `);

  // Listener para fechar dropdown ao clicar fora (após modal abrir)
  setTimeout(function() {
    document.addEventListener('click', function _rfqCloseDropdown(e) {
      if (!e.target.closest('#rfq_forn_busca') && !e.target.closest('#rfq_forn_dropdown')) {
        var d = document.getElementById('rfq_forn_dropdown');
        if (d) d.style.display = 'none';
      }
      if (!document.getElementById('globalModal')?.classList.contains('show')) {
        document.removeEventListener('click', _rfqCloseDropdown);
      }
    });
  }, 200);
}

// ── Autocomplete de fornecedores para o modal "Iniciar Cotações" (farcCriarRFQ) ──

function _rfqFiltrarFornecedores() {
  // Mantida por compatibilidade – delega para nova função
  _rfqFiltrarFornecedoresRFQ();
}

function _rfqFiltrarFornecedoresRFQ() {
  const input    = document.getElementById('rfq_forn_busca');
  const dropdown = document.getElementById('rfq_forn_dropdown');
  if (!input || !dropdown) return;

  const busca = (input.value || '').toLowerCase().trim();

  // Carrega lista de fornecedores
  let lista = [];
  try {
    if (typeof FA_FORNECEDORES !== 'undefined' && FA_FORNECEDORES.length > 0) {
      lista = FA_FORNECEDORES;
    } else {
      const raw = localStorage.getItem('fa_fornecedores_cache') || localStorage.getItem('fa_fornecedores');
      if (raw) lista = JSON.parse(raw);
    }
    // fallback: busca nos fornecedores do módulo
    if (!lista.length && typeof _getFornecedores === 'function') {
      lista = _getFornecedores().filter(f => f.status === 'Ativo' || f.status === 'Homologado');
    }
  } catch(e) { lista = []; }

  // Filtra por texto (mín 1 char) ou mostra os 12 primeiros
  let filtrados = busca.length >= 1
    ? lista.filter(f => {
        const nome = (f.razao_social || f.nome_fantasia || f.nome || '').toLowerCase();
        const cnpj = (f.cnpj || '').toLowerCase();
        const cat  = (f.categoria || f.segmento || '').toLowerCase();
        return nome.includes(busca) || cnpj.includes(busca) || cat.includes(busca);
      })
    : lista.slice(0, 12);

  if (filtrados.length === 0) {
    dropdown.innerHTML = `<div style="padding:12px 14px;font-size:12px;color:var(--text-muted);text-align:center">
      <i class="fas fa-search" style="margin-right:6px;opacity:.5"></i>
      Nenhum fornecedor encontrado${busca ? ` para "<b>${busca}</b>"` : ''}.<br>
      <span style="font-size:11px">Use "Inserir Novo" ao lado para adicionar.</span>
    </div>`;
    dropdown.style.display = 'block';
    return;
  }

  dropdown.innerHTML = filtrados.slice(0, 15).map(f => {
    const nome = f.razao_social || f.nome_fantasia || f.nome || 'Fornecedor';
    const cnpjBadge = f.cnpj ? `<span style="color:var(--text-muted);font-size:10px;margin-left:4px">${f.cnpj}</span>` : '';
    const cat  = f.categoria || f.segmento || '';
    const catBadge = cat ? `<span style="background:var(--bg-tertiary);color:var(--text-muted);border-radius:4px;padding:1px 5px;font-size:10px;margin-left:4px">${cat}</span>` : '';
    const emailBadge = f.contato_email
      ? `<span style="font-size:10px;color:#22c55e;margin-left:auto"><i class="fas fa-envelope"></i></span>`
      : `<span style="font-size:10px;color:#ef4444;margin-left:auto"><i class="fas fa-exclamation-triangle"></i></span>`;
    const idf = f.idf_score != null
      ? `<span style="font-size:10px;color:${f.idf_score>=80?'#22c55e':f.idf_score>=60?'#3b82f6':f.idf_score>=40?'#f59e0b':'#ef4444'}">IDF ${f.idf_score}</span>` : '';
    return `<div
      onclick="_rfqSelecionarFornRFQ('${f.id}','${nome.replace(/'/g,"\\'").replace(/"/g,'&quot;')}','${(f.contato_email||'').replace(/'/g,"\\'")}',this)"
      data-forn-id="${f.id}"
      style="padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--border-color);transition:background .12s;display:flex;align-items:center;gap:8px"
      onmouseover="this.style.background='var(--bg-secondary)'"
      onmouseout="this.style.background='transparent'">
      <div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <span style="color:#fff;font-size:11px;font-weight:700">${nome.charAt(0).toUpperCase()}</span>
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:600;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
          ${nome}${cnpjBadge}${catBadge}
        </div>
      </div>
      ${emailBadge}${idf}
    </div>`;
  }).join('');

  if (filtrados.length > 15) {
    dropdown.innerHTML += `<div style="padding:6px 12px;font-size:11px;color:var(--text-muted);text-align:center">
      +${filtrados.length - 15} outros resultados. Refine a busca.
    </div>`;
  }

  dropdown.style.display = 'block';
}

// Seleciona um fornecedor do dropdown e armazena no input
function _rfqSelecionarFornRFQ(id, nome, email, el) {
  const input    = document.getElementById('rfq_forn_busca');
  const dropdown = document.getElementById('rfq_forn_dropdown');
  if (input) {
    input.value = nome;
    input.dataset.fornId    = id;
    input.dataset.fornNome  = nome;
    input.dataset.fornEmail = email;
    input.style.borderColor = '#22c55e';
  }
  if (dropdown) dropdown.style.display = 'none';
  if (el) { el.style.background = 'rgba(99,102,241,0.15)'; el.style.borderLeft = '3px solid #6366f1'; }
}

// Adiciona o fornecedor selecionado (cadastrado) à lista do RFQ
function _rfqAdicionarFornSelecionadoRFQ() {
  const input = document.getElementById('rfq_forn_busca');
  if (!input) return;

  const fornId   = input.dataset.fornId;
  const fornNome = input.dataset.fornNome || input.value?.trim();
  const fornEmail= input.dataset.fornEmail || '';

  if (!fornNome) {
    showToast('Selecione um fornecedor na lista antes de adicionar.', 'warning', 3000);
    input.style.borderColor = '#ef4444';
    input.focus();
    setTimeout(() => { if(input) input.style.borderColor = 'rgba(99,102,241,0.35)'; }, 2000);
    return;
  }

  const cont = document.getElementById('rfq_forn_adicionados');
  if (!cont) return;

  // Verifica duplicata pelo data-id
  const jaExiste = Array.from(cont.querySelectorAll('[data-forn-item-id]'))
    .some(el => el.dataset.fornItemId === (fornId || fornNome));
  if (jaExiste) { showToast(`"${fornNome}" já foi adicionado.`, 'warning', 2500); return; }

  const div = document.createElement('div');
  div.dataset.fornItemId    = fornId || fornNome;
  div.dataset.fornItemNome  = fornNome;
  div.dataset.fornItemEmail = fornEmail;
  div.dataset.fornItemTipo  = 'cadastrado';
  div.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 12px;background:rgba(99,102,241,0.07);border:1px solid rgba(99,102,241,0.25);border-radius:8px;font-size:12px';
  div.innerHTML = `
    <div style="width:26px;height:26px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:flex;align-items:center;justify-content:center;flex-shrink:0">
      <span style="color:#fff;font-size:10px;font-weight:700">${fornNome.charAt(0).toUpperCase()}</span>
    </div>
    <div style="flex:1">
      <span style="font-weight:600;color:var(--text-primary)">${fornNome}</span>
      ${fornEmail ? `<span style="color:var(--text-muted);font-size:11px;margin-left:8px"><i class="fas fa-envelope" style="font-size:10px"></i> ${fornEmail}</span>` : '<span style="color:#ef4444;font-size:11px;margin-left:8px"><i class="fas fa-exclamation-triangle" style="font-size:10px"></i> Sem e-mail</span>'}
    </div>
    <span style="font-size:10px;background:rgba(99,102,241,0.15);color:#6366f1;border-radius:4px;padding:2px 6px">Cadastrado</span>
    <button onclick="this.closest('[data-forn-item-id]').remove()" style="background:rgba(239,68,68,0.12);border:none;border-radius:6px;color:#ef4444;padding:4px 7px;cursor:pointer;font-size:11px" title="Remover">
      <i class="fas fa-times"></i>
    </button>
  `;
  cont.appendChild(div);

  // Limpa input
  input.value = '';
  delete input.dataset.fornId;
  delete input.dataset.fornNome;
  delete input.dataset.fornEmail;
  input.style.borderColor = 'rgba(99,102,241,0.35)';
  const dropdown = document.getElementById('rfq_forn_dropdown');
  if (dropdown) dropdown.style.display = 'none';

  showToast(`✅ "${fornNome}" adicionado ao RFQ!`, 'success', 2500);
}

function _rfqAddFornNovo() {
  // Tenta usar o campo de novo fornecedor primeiro (col. 2 do grid)
  const novoInput = document.getElementById('rfq_forn_novo_nome');
  if (novoInput) {
    const nome = novoInput.value?.trim();
    if (nome) {
      const cont = document.getElementById('rfq_forn_novos');
      if (!cont) return;
      const div = document.createElement('div');
      div.className = 'rfq-forn-novo';
      div.style.cssText = 'display:flex;gap:6px;align-items:center;padding:8px 10px;background:rgba(245,158,11,0.07);border:1px solid rgba(245,158,11,0.3);border-radius:8px';
      div.innerHTML = `
        <i class="fas fa-user-plus" style="color:#f59e0b;font-size:13px;flex-shrink:0"></i>
        <span class="rfq-novo-nome" data-nome="${nome}" style="flex:2;font-size:12px;font-weight:600;color:var(--text-primary)">${nome}</span>
        <input class="form-control rfq-novo-email" type="email" placeholder="E-mail (opcional)" style="flex:2;font-size:12px;padding:5px 8px">
        <span style="font-size:10px;background:rgba(245,158,11,0.15);color:#f59e0b;border-radius:4px;padding:2px 6px">Novo</span>
        <button onclick="this.closest('.rfq-forn-novo').remove()" class="btn btn-danger btn-sm btn-icon" title="Remover"><i class="fas fa-trash"></i></button>
      `;
      cont.appendChild(div);
      novoInput.value = '';
      showToast(`"${nome}" inserido como novo fornecedor.`, 'info', 2000);
      return;
    }
  }
  // Fallback: abre campo genérico de linha
  const cont = document.getElementById('rfq_forn_novos');
  if (!cont) return;
  const div = document.createElement('div');
  div.className = 'rfq-forn-novo';
  div.style.cssText = 'display:flex;gap:6px;align-items:center;padding:8px 10px;background:rgba(245,158,11,0.07);border:1px solid rgba(245,158,11,0.3);border-radius:8px';
  div.innerHTML = `
    <i class="fas fa-user-plus" style="color:#f59e0b;font-size:13px;flex-shrink:0"></i>
    <input class="form-control rfq-novo-nome" placeholder="Nome / Razão Social *" style="flex:2;font-size:12px;padding:5px 8px">
    <input class="form-control rfq-novo-email" type="email" placeholder="E-mail de contato" style="flex:2;font-size:12px;padding:5px 8px">
    <span style="font-size:10px;background:rgba(245,158,11,0.15);color:#f59e0b;border-radius:4px;padding:2px 6px">Novo</span>
    <button onclick="this.closest('.rfq-forn-novo').remove()" class="btn btn-danger btn-sm btn-icon" title="Remover"><i class="fas fa-trash"></i></button>
  `;
  cont.appendChild(div);
}

function _rfqSalvarEEnviar(rcId) {
  const rc     = (_obterRCLocal()).find(r => r.id === rcId);
  if (!rc) { showToast('RC não encontrada.','error'); return; }

  const titulo  = document.getElementById('rfq_titulo')?.value.trim();
  const numero  = document.getElementById('rfq_numero')?.value.trim();
  const prazo   = document.getElementById('rfq_prazo')?.value;
  const obs     = document.getElementById('rfq_obs')?.value.trim()||'';
  const envio   = document.querySelector('input[name="rfq_envio"]:checked')?.value || 'email';

  if (!titulo) { showToast('Informe o título do RFQ.','error'); return; }
  if (!prazo)  { showToast('Informe o prazo para cotação.','error'); return; }

  // Coleta critérios
  const criterios = {
    preco:      parseInt(document.getElementById('crit_preco')?.value)||40,
    prazo_entr: parseInt(document.getElementById('crit_prazo')?.value)||20,
    qualidade:  parseInt(document.getElementById('crit_qualidade')?.value)||20,
    pagamento:  parseInt(document.getElementById('crit_pagamento')?.value)||10,
    esg:        parseInt(document.getElementById('crit_esg')?.value)||5,
    suporte:    parseInt(document.getElementById('crit_suporte')?.value)||5,
  };
  const somaC = Object.values(criterios).reduce((a,b)=>a+b,0);
  if (somaC !== 100) {
    showToast(`A soma dos critérios deve ser 100%. Atual: ${somaC}%`, 'error');
    return;
  }

  // Coleta fornecedores adicionados via autocomplete (cards)
  const fornecedores = [];
  document.querySelectorAll('#rfq_forn_adicionados [data-forn-item-id]').forEach(card => {
    const fId    = card.dataset.fornItemId;
    const fNome  = card.dataset.fornItemNome || fId;
    const fEmail = card.dataset.fornItemEmail || '';
    fornecedores.push({
      id:               fId,
      nome:             fNome,
      email:            fEmail,
      tipo:             'cadastrado',
      cotacao_recebida: false,
      cotacao_enviada:  false,
      data_envio:       null,
      valor_total:      null,
      itens_cotados:    [],
      desconto_pct:     0,
      valor_negociado:  null,
      observacoes:      ''
    });
  });
  // Fornecedores novos inseridos manualmente
  document.querySelectorAll('.rfq-forn-novo').forEach(row => {
    // Suporte para span.rfq-novo-nome (com data-nome) ou input.rfq-novo-nome
    const nomeEl = row.querySelector('.rfq-novo-nome');
    const nome = nomeEl?.dataset?.nome || nomeEl?.value?.trim() || '';
    if (!nome) return;
    fornecedores.push({
      id:               'ext-'+Date.now()+'-'+Math.random().toString(36).slice(2,6),
      nome,
      email:            row.querySelector('.rfq-novo-email')?.value?.trim() || '',
      tipo:             'externo',
      cotacao_recebida: false,
      cotacao_enviada:  false,
      data_envio:       null,
      valor_total:      null,
      itens_cotados:    [],
      desconto_pct:     0,
      valor_negociado:  null,
      observacoes:      ''
    });
  });

  if (fornecedores.length === 0) {
    showToast('Selecione ao menos um fornecedor.','error');
    return;
  }

  // ── POLÍTICA: cotações > R$10.000 exigem mínimo 3 fornecedores ──────────────
  const valorRC = rc.valor_total || rc.itens?.reduce((s,it)=>s+(it.total||0),0) || 0;
  if (valorRC > 10000 && fornecedores.length < 3) {
    const faltam = 3 - fornecedores.length;
    showToast(
      `⚠️ Política de Suprimentos: cotações acima de R$ 10.000 exigem no mínimo 3 fornecedores. Adicione mais ${faltam} fornecedor(es).`,
      'error', 7000
    );
    return;
  }
  const itensRC = rc.itens || [];
  fornecedores.forEach(f => {
    f.itens_cotados = itensRC.map(it => ({
      descricao: it.descricao,
      qtd:       it.qtd || 1,
      unidade:   it.unidade || 'Un',
      preco_unit: null,
      preco_unit_neg: null,  // pós-negociação
      total:     null
    }));
  });

  const agora = new Date().toLocaleString('pt-BR');
  const novoRFQ = {
    id:            `rfq_${Date.now()}`,
    numero,
    numero_rfq:    numero,
    titulo,
    rc_id:         rc.id,
    rc_numero:     rc.numero,
    os_vinculada:  rc.os_vinculada || '',
    prazo_cotacao: new Date(prazo+'T12:00:00').toLocaleDateString('pt-BR'),
    prazo_iso:     prazo,
    tipo:          document.getElementById('rfq_tipo')?.value || 'Material',
    urgencia:      document.getElementById('rfq_urgencia')?.value || 'Normal',
    instrucoes:    obs,
    criterios,
    fornecedores,
    fornecedores_convidados: fornecedores.map(f => f.id),
    fornecedores_detalhes:   fornecedores.map(f => ({ id: f.id, nome: f.nome, email: f.email||'', tipo: f.tipo||'cadastrado' })),
    valor_estimado: (rc.itens||[]).reduce((s,i) => s + (parseFloat(i.preco_unit||i.valor_unit||0)*parseFloat(i.qtd||i.quantidade||1)), 0),
    cotacoes:      [],
    metodo_envio:  envio,
    // Status 'Em Cotação' diretamente — fornecedores já foram definidos
    status:        'Em Cotação',
    criado_por:    currentUser?.name || '',
    data_criacao:  new Date().toISOString(),
    criado_em:     new Date().toLocaleDateString('pt-BR'),
    historico: [
      { acao: `RFQ criado por ${currentUser?.name}. ${fornecedores.length} fornecedor(es) convidado(s)`, usuario: currentUser?.name, data: agora },
      { acao: `Cotação iniciada – status: Em Cotação`, usuario: currentUser?.name, data: agora }
    ]
  };

  // Salva em fa_rfq_flow (fonte do fluxo_aprovacao_rc.js)
  const rfqLista = typeof _getRFQFlow === 'function' ? _getRFQFlow() : [];
  // Remove versão anterior com mesmo número (evita duplicatas)
  const idxExist = rfqLista.findIndex(r => r.numero === numero || r.numero_rfq === numero);
  if (idxExist >= 0) rfqLista.splice(idxExist, 1);
  rfqLista.unshift(novoRFQ);
  if (typeof _saveRFQFlow === 'function') _saveRFQFlow(rfqLista);

  // Salva em fa_rfqs (fonte do procurement.js) — remove duplicatas por número
  try {
    const rfqsProc = JSON.parse(localStorage.getItem('fa_rfqs') || '[]');
    const pIdx = rfqsProc.findIndex(r => r.id === novoRFQ.id || r.numero === numero || r.numero_rfq === numero);
    if (pIdx >= 0) rfqsProc.splice(pIdx, 1);
    rfqsProc.unshift(novoRFQ);
    localStorage.setItem('fa_rfqs', JSON.stringify(rfqsProc));
  } catch(e) { console.warn('Erro ao sincronizar fa_rfqs:', e); }

  // Atualiza status da RC para 'Em Cotação'
  const rcLista = _obterRCLocal();
  const rcIdx   = rcLista.findIndex(r => r.id === rcId);
  if (rcIdx >= 0) {
    rcLista[rcIdx].status     = 'Em Cotação';
    rcLista[rcIdx].rfq_numero = numero;
    rcLista[rcIdx].rfq_id     = novoRFQ.id;
    if (!rcLista[rcIdx].historico) rcLista[rcIdx].historico = [];
    rcLista[rcIdx].historico.unshift({ acao: `RFQ ${numero} criado – cotação iniciada`, usuario: currentUser?.name, data: agora });
    _salvarRCLocal(rcLista);
  }

  logAction && logAction('Criação RFQ', 'Compras', `${numero} – ${titulo} com ${fornecedores.length} fornecedor(es)`);
  closeModal();

  // Ação conforme método de envio
  if (envio === 'pdf' || envio === 'ambos') {
    setTimeout(() => _rfqGerarPDF_id(novoRFQ.id), 400);
  }
  if (envio === 'email' || envio === 'ambos') {
    // Abre modal de envio por email após pequeno delay
    setTimeout(() => _rfqAbrirModalEmail(novoRFQ.id), 600);
    showToast(`✅ RFQ ${numero} criado e em cotação! Abrindo janela de envio por e-mail…`, 'success', 5000);
  } else {
    showToast(`✅ RFQ ${numero} criado e em cotação! PDF disponível para envio manual.`, 'success', 5000);
  }

  renderFluxoAprovacaoRC();
  setTimeout(() => farcSwitchTab && farcSwitchTab('cotacoes'), 100);
}

// ─── ENVIAR SOLICITAÇÃO DE COTAÇÃO (MODAL DE EMAIL COMPLETO) ──────────────────
function _rfqEnviarSolicitacao(rfqId) {
  _rfqAbrirModalEmail(rfqId);
}

// ─── MODAL DE ENVIO POR EMAIL (TEXTO EDITÁVEL + PDF ANEXO) ───────────────────
function _rfqAbrirModalEmail(rfqId) {
  const rfqLista = typeof _getRFQFlow === 'function' ? _getRFQFlow() : [];
  const idx = rfqLista.findIndex(r => r.id === rfqId);
  if (idx < 0) { showToast('RFQ não encontrado.', 'error'); return; }
  const rfq = rfqLista[idx];
  const rc  = (_obterRCLocal()).find(r => r.id === rfq.rc_id) || {};

  const comEmail = (rfq.fornecedores||[]).filter(f => f.email);
  const semEmail = (rfq.fornecedores||[]).filter(f => !f.email);
  const prazo    = rfq.prazo_cotacao || '—';
  const hoje     = new Date().toLocaleDateString('pt-BR');

  // Tabela de itens para o corpo do email
  const itens = rc.itens || rfq.itens || [];
  const itensTexto = itens.map((it, i) =>
    `${i+1}. ${it.descricao} – Qtd: ${it.qtd||1} ${it.unidade||'Un'}`
  ).join('\n');

  const assuntoPadrao = `Solicitação de Cotação – ${rfq.numero}: ${rfq.titulo}`;
  const corpoPadrao = `Prezado(a) Fornecedor,

Somos da equipe de Suprimentos da Fraser Alexander e gostaríamos de solicitar sua melhor proposta para os itens abaixo, conforme detalhado no documento ${rfq.numero} em anexo.

──── ITENS PARA COTAR ────
${itensTexto || '(vide PDF anexo)'}
─────────────────────────

PRAZO LIMITE PARA RESPOSTA: ${prazo}

Ao responder, por favor informe:
• Preço unitário e total de cada item
• Prazo de entrega
• Condições de pagamento
• Validade da proposta

${rfq.instrucoes ? `OBSERVAÇÕES ADICIONAIS:\n${rfq.instrucoes}\n` : ''}
Pedimos que retorne este e-mail com sua proposta até a data indicada. O documento detalhado segue em anexo (PDF).

Atenciosamente,
${currentUser?.name || 'Equipe de Compras'}
Fraser Alexander – Suprimentos
Ref.: ${rfq.numero} | Emitido em: ${hoje}`;

  openModalWide(`Enviar RFQ por E-mail – ${rfq.numero}`, `
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px">
      <!-- Fornecedores -->
      <div style="flex:1;min-width:220px;padding:12px;background:var(--bg-card2);border-radius:8px;border:1px solid var(--border-color)">
        <div style="font-size:11px;font-weight:700;color:#6366f1;margin-bottom:8px;text-transform:uppercase;letter-spacing:.4px">
          <i class="fas fa-building" style="margin-right:5px"></i>Destinatários
        </div>
        ${comEmail.length > 0 ? comEmail.map(f => `
          <div style="display:flex;align-items:center;gap:6px;padding:5px 8px;background:rgba(34,197,94,0.06);border-radius:6px;margin-bottom:4px;font-size:11px">
            <i class="fas fa-check-circle" style="color:#22c55e;flex-shrink:0"></i>
            <div>
              <div style="font-weight:600;color:var(--text-primary)">${f.nome}</div>
              <div style="color:#22c55e">${f.email}</div>
            </div>
          </div>`).join('') : ''}
        ${semEmail.length > 0 ? `
          <div style="margin-top:6px;padding:6px 8px;background:rgba(245,158,11,0.06);border-radius:6px;font-size:11px;color:#f59e0b">
            <i class="fas fa-exclamation-triangle" style="margin-right:4px"></i>
            ${semEmail.length} fornecedor(es) sem e-mail – somente PDF manual
          </div>` : ''}
        ${comEmail.length === 0 ? `
          <div style="padding:10px;text-align:center;color:var(--text-muted);font-size:11px">
            <i class="fas fa-info-circle" style="display:block;font-size:20px;margin-bottom:6px;opacity:.5"></i>
            Nenhum fornecedor com e-mail cadastrado.<br>Use o PDF para envio manual.
          </div>` : ''}
      </div>

      <!-- Resumo RFQ -->
      <div style="flex:1;min-width:200px;padding:12px;background:var(--bg-card2);border-radius:8px;border:1px solid var(--border-color)">
        <div style="font-size:11px;font-weight:700;color:#6366f1;margin-bottom:8px;text-transform:uppercase;letter-spacing:.4px">
          <i class="fas fa-file-alt" style="margin-right:5px"></i>Documento
        </div>
        <div style="font-size:12px;line-height:1.8">
          <div><span style="color:var(--text-muted)">Número:</span> <strong style="color:#6366f1">${rfq.numero}</strong></div>
          <div><span style="color:var(--text-muted)">RC:</span> <strong>${rfq.rc_numero||'—'}</strong></div>
          <div><span style="color:var(--text-muted)">Itens:</span> <strong>${itens.length}</strong></div>
          <div><span style="color:var(--text-muted)">Prazo:</span> <strong style="color:#f59e0b">${prazo}</strong></div>
        </div>
        <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">
          <button onclick="_rfqGerarPDF_id('${rfqId}')" class="btn btn-secondary btn-sm" style="font-size:11px">
            <i class="fas fa-file-pdf" style="color:#ef4444"></i> Gerar PDF
          </button>
        </div>
        <div style="margin-top:6px;font-size:10px;color:var(--text-muted)">
          <i class="fas fa-paperclip" style="margin-right:3px"></i>
          Gere o PDF e anexe manualmente ao seu cliente de e-mail, ou use o botão "Abrir no E-mail" abaixo.
        </div>
      </div>
    </div>

    <!-- Assunto -->
    <div class="form-group" style="margin-bottom:10px">
      <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">
        <i class="fas fa-tag" style="margin-right:5px;color:#6366f1"></i>Assunto do E-mail
      </label>
      <input class="form-control" id="rfq_email_assunto" value="${assuntoPadrao.replace(/"/g,'&quot;')}" style="font-size:12px">
    </div>

    <!-- Corpo do email -->
    <div class="form-group" style="margin-bottom:12px">
      <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">
        <i class="fas fa-align-left" style="margin-right:5px;color:#6366f1"></i>Corpo do E-mail <span style="color:var(--text-muted);font-weight:400">(editável)</span>
      </label>
      <textarea class="form-control" id="rfq_email_corpo" rows="14"
        style="font-size:12px;font-family:monospace;resize:vertical;line-height:1.5">${corpoPadrao.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</textarea>
    </div>

    <div style="padding:8px 12px;background:rgba(99,102,241,0.06);border-radius:8px;font-size:11px;color:var(--text-muted)">
      <i class="fas fa-info-circle" style="color:#6366f1;margin-right:5px"></i>
      O botão <strong>"Abrir no E-mail"</strong> abre seu cliente de e-mail padrão (Outlook, Gmail, etc.) com os destinatários e o texto preenchidos.
      Gere o PDF separadamente e anexe manualmente antes de enviar.
      Cada envio fica registrado no histórico do processo.
    </div>

    <!-- Histórico de Envios -->
    ${(rfq.historico||[]).filter(h => h.acao && (h.acao.includes('E-mail') || h.acao.includes('enviado') || h.acao.includes('Cotação iniciada') || h.acao.includes('RFQ criado'))).length > 0 ? `
    <div style="margin-top:12px">
      <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:6px;letter-spacing:.4px">
        <i class="fas fa-history" style="margin-right:5px"></i>Histórico de Envios
      </div>
      <div style="max-height:110px;overflow-y:auto;display:flex;flex-direction:column;gap:4px">
        ${(rfq.historico||[]).filter(h => h.acao && (h.acao.includes('E-mail') || h.acao.includes('enviado') || h.acao.includes('Cotação iniciada') || h.acao.includes('RFQ criado'))).map(h => `
          <div style="display:flex;gap:8px;align-items:flex-start;padding:5px 8px;background:var(--bg-card2);border-radius:6px;font-size:11px">
            <i class="fas fa-circle-check" style="color:#22c55e;flex-shrink:0;margin-top:2px"></i>
            <div style="flex:1">
              <div style="color:var(--text-primary)">${h.acao}</div>
              <div style="color:var(--text-muted)">${h.usuario || ''} · ${h.data || ''}</div>
            </div>
          </div>`).join('')}
      </div>
    </div>` : ''}
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
    <button class="btn btn-secondary" onclick="_rfqGerarPDF_id('${rfqId}')">
      <i class="fas fa-file-pdf" style="color:#ef4444"></i> Gerar PDF (Anexo)
    </button>
    ${comEmail.length > 0 ? `
    <button class="btn btn-info" onclick="_rfqAbrirMailto('${rfqId}')">
      <i class="fas fa-external-link-alt"></i> Abrir no E-mail
    </button>` : ''}
    <button class="btn btn-primary" onclick="_rfqMarcarEnviado('${rfqId}')">
      <i class="fas fa-check-circle"></i> Marcar como Enviado
    </button>
  `);
}

// Abre mailto com assunto e corpo preenchidos
function _rfqAbrirMailto(rfqId) {
  const rfqLista = typeof _getRFQFlow === 'function' ? _getRFQFlow() : [];
  const rfq = rfqLista.find(r => r.id === rfqId);
  if (!rfq) return;

  const assunto = document.getElementById('rfq_email_assunto')?.value || `Solicitação de Cotação – ${rfq.numero}`;
  const corpo   = document.getElementById('rfq_email_corpo')?.value   || '';
  const emails  = (rfq.fornecedores||[]).filter(f => f.email).map(f => f.email).join(';');

  if (!emails) {
    showToast('Nenhum fornecedor com e-mail cadastrado. Envie o PDF manualmente.', 'warning');
    return;
  }

  // Limita corpo para evitar URLs muito longas (mailto tem limite ~2000 chars)
  const corpoTruncado = corpo.length > 1800
    ? corpo.substring(0, 1800) + '\n\n[... corpo completo disponível no PDF anexo ...]'
    : corpo;

  const mailto = `mailto:${encodeURIComponent(emails)}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpoTruncado)}`;
  window.open(mailto, '_blank');

  showToast('Cliente de e-mail aberto. Lembre-se de anexar o PDF antes de enviar!', 'info', 6000);
}

// Marca RFQ como enviado (após o usuário confirmar que enviou)
// Usa unshift para PRESERVAR o histórico anterior integralmente
function _rfqMarcarEnviado(rfqId) {
  const rfqLista = typeof _getRFQFlow === 'function' ? _getRFQFlow() : [];
  const idx = rfqLista.findIndex(r => r.id === rfqId);
  if (idx < 0) return;
  const rfq = rfqLista[idx];
  const agora = new Date().toLocaleString('pt-BR');
  const comEmailLista = (rfq.fornecedores||[]).filter(f => f.email);

  // Atualiza data de envio de cada fornecedor com e-mail (não sobrescreve cotacao_recebida)
  rfq.fornecedores.forEach(f => {
    if (f.email) {
      f.cotacao_enviada = true;
      // Mantém histórico de envios no próprio fornecedor
      if (!f.envios) f.envios = [];
      f.envios.push({ data: agora, usuario: currentUser?.name || '—' });
      f.data_envio = agora; // último envio
    }
  });

  // Status: se já tem cotações recebidas, mantém; caso contrário fica 'Em Cotação'
  const temCotacoes = (rfq.fornecedores||[]).some(f => f.cotacao_recebida);
  if (!temCotacoes) rfq.status = 'Em Cotação';

  // Adiciona entrada no histórico sem apagar as anteriores (unshift)
  if (!rfq.historico) rfq.historico = [];
  const nReenvios = rfq.historico.filter(h => h.acao && (h.acao.includes('E-mail') || h.acao.includes('enviado'))).length;
  rfq.historico.unshift({
    acao: nReenvios > 0
      ? `Reenvio de e-mail #${nReenvios + 1} por ${currentUser?.name||'—'} para ${comEmailLista.length} fornecedor(es)`
      : `E-mail enviado por ${currentUser?.name||'—'} para ${comEmailLista.length} fornecedor(es)`,
    usuario: currentUser?.name || '—',
    data: agora
  });

  rfqLista[idx] = rfq;
  if (typeof _saveRFQFlow === 'function') _saveRFQFlow(rfqLista);

  // Sincroniza também fa_rfqs
  try {
    const rfqsProc = JSON.parse(localStorage.getItem('fa_rfqs') || '[]');
    const pi = rfqsProc.findIndex(r => r.id === rfqId);
    if (pi >= 0) {
      rfqsProc[pi].status    = rfq.status;
      rfqsProc[pi].historico = rfq.historico;
      rfqsProc[pi].fornecedores = rfq.fornecedores;
      localStorage.setItem('fa_rfqs', JSON.stringify(rfqsProc));
    }
  } catch(e) {}

  logAction && logAction('Envio RFQ', 'Compras', `${rfq.numero} marcado como enviado (${nReenvios > 0 ? 'reenvio' : '1º envio'})`);
  closeModal();
  const reenvioMsg = nReenvios > 0 ? ` (Reenvio #${nReenvios + 1})` : '';
  showToast(`✅ RFQ ${rfq.numero} marcado como enviado${reenvioMsg}! Aguardando propostas.`, 'success', 5000);
  renderFluxoAprovacaoRC();
  setTimeout(() => farcSwitchTab && farcSwitchTab('cotacoes'), 100);
}

function _rfqConfirmarEnvio(rfqId) {
  _rfqMarcarEnviado(rfqId);
}

// ─── GERAR PDF DO RFQ ──────────────────────────────────────────────────────────
function _rfqGerarPDF(rcId) {
  const rc = (_obterRCLocal()).find(r => r.id === rcId);
  if (!rc) return;
  const titulo = document.getElementById('rfq_titulo')?.value || 'Solicitação de Cotação';
  const prazo  = document.getElementById('rfq_prazo')?.value || '—';
  const obs    = document.getElementById('rfq_obs')?.value || '';
  const html = _rfqGerarHTMLPDF({ titulo, numero: document.getElementById('rfq_numero')?.value, prazo, obs, itens: rc.itens || [] });
  const w = window.open('','_blank');
  if (w) { w.document.write(html); w.document.close(); w.print(); }
}

function _rfqGerarPDF_id(rfqId) {
  const rfq = (typeof _getRFQFlow === 'function' ? _getRFQFlow() : []).find(r => r.id === rfqId);
  if (!rfq) return;
  const rc  = (_obterRCLocal()).find(r => r.id === rfq.rc_id);
  const html = _rfqGerarHTMLPDF({ titulo: rfq.titulo, numero: rfq.numero, prazo: rfq.prazo_cotacao, obs: rfq.instrucoes, itens: rc?.itens || [] });
  const w = window.open('','_blank');
  if (w) { w.document.write(html); w.document.close(); w.print(); }
}

function _rfqGerarHTMLPDF({ titulo, numero, prazo, obs, itens }) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>Solicitação de Cotação – ${numero}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 12px; color: #1a1a1a; margin: 0; padding: 30px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #e8712a; padding-bottom: 16px; margin-bottom: 20px; }
    .company { font-size: 20px; font-weight: 900; color: #e8712a; }
    .doc-title { font-size: 15px; font-weight: 700; color: #1a1a1a; text-align: right; }
    .doc-num   { font-size: 13px; color: #666; text-align: right; }
    .section   { margin-bottom: 18px; }
    .section h3 { font-size: 12px; font-weight: 700; color: #e8712a; text-transform: uppercase; letter-spacing: .5px; border-bottom: 1px solid #e8712a33; padding-bottom: 4px; margin-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { background: #f5f5f5; padding: 8px 10px; text-align: left; font-size: 10px; text-transform: uppercase; color: #555; border: 1px solid #ddd; }
    td { padding: 8px 10px; border: 1px solid #ddd; vertical-align: middle; }
    .footer { margin-top: 30px; border-top: 1px solid #ddd; padding-top: 12px; font-size: 10px; color: #888; display: flex; justify-content: space-between; }
    .sign-area { display: flex; gap: 60px; margin-top: 40px; }
    .sign-box  { flex: 1; border-top: 1px solid #333; padding-top: 8px; text-align: center; font-size: 11px; }
    .obs       { background: #fff8f0; border-left: 3px solid #e8712a; padding: 10px 14px; font-size: 11px; color: #333; border-radius: 0 6px 6px 0; }
    @media print { body { margin: 0; padding: 20px; } }
  </style></head><body>
  <div class="header">
    <div>
      <div class="company">Fraser Alexander</div>
      <div style="font-size:11px;color:#666">Sistema de Gestão de Suprimentos</div>
    </div>
    <div>
      <div class="doc-title">SOLICITAÇÃO DE COTAÇÃO</div>
      <div class="doc-num">${numero||'—'}</div>
      <div class="doc-num">Gerado em: ${new Date().toLocaleDateString('pt-BR')}</div>
    </div>
  </div>

  <div class="section">
    <h3>Informações Gerais</h3>
    <table>
      <tr><th>Objeto da Cotação</th><td>${titulo}</td></tr>
      <tr><th>Número do Processo</th><td>${numero||'—'}</td></tr>
      <tr><th>Prazo para Envio da Proposta</th><td><strong>${prazo}</strong></td></tr>
      <tr><th>Emitido por</th><td>${(typeof currentUser!=='undefined'&&currentUser)?currentUser.name:'Compras'}</td></tr>
    </table>
  </div>

  <div class="section">
    <h3>Itens para Cotar</h3>
    <table>
      <thead><tr><th>#</th><th>Descrição</th><th>Quantidade</th><th>Unidade</th><th>Preço Unit. (R$)</th><th>Total (R$)</th></tr></thead>
      <tbody>
        ${(itens||[]).map((it,i) => `<tr><td>${i+1}</td><td>${it.descricao}</td><td>${it.qtd||1}</td><td>${it.unidade||'Un'}</td><td>______________</td><td>______________</td></tr>`).join('')}
        <tr style="background:#f5f5f5"><td colspan="5" style="text-align:right;font-weight:700">VALOR TOTAL PROPOSTO</td><td><strong>______________</strong></td></tr>
      </tbody>
    </table>
  </div>

  ${obs ? `<div class="section"><h3>Condições e Observações</h3><div class="obs">${obs}</div></div>` : ''}

  <div class="section">
    <h3>Instruções para Resposta</h3>
    <ul style="font-size:11px;padding-left:20px;color:#444;line-height:1.7">
      <li>Preencha os preços unitários e totais para cada item</li>
      <li>Informe prazo de entrega, condições de pagamento e validade da proposta</li>
      <li>Envie sua proposta até <strong>${prazo}</strong> para o e-mail do comprador responsável</li>
      <li>Propostas fora do prazo não serão consideradas</li>
    </ul>
  </div>

  <div class="sign-area">
    <div class="sign-box">Assinatura do Fornecedor<br><br>Nome: ______________________________<br>Data: ______________________________</div>
    <div class="sign-box">CNPJ / Razão Social<br><br>______________________________<br>______________________________</div>
  </div>

  <div class="footer">
    <span>Fraser Alexander ERP – ${new Date().toLocaleString('pt-BR')}</span>
    <span>Documento gerado automaticamente – Ref: ${numero||'—'}</span>
  </div>
  </body></html>`;
}

// ─── VER DETALHES RFQ ─────────────────────────────────────────────────────────
function farcVerRFQ(rfqId) {
  const rfq = (typeof _getRFQFlow === 'function' ? _getRFQFlow() : []).find(r => r.id === rfqId);
  if (!rfq) { showToast('RFQ não encontrado.','error'); return; }
  const isCompras = _podeProcessarRC();

  openModalWide(`${rfq.numero} – ${rfq.titulo}`, `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:16px">
      <div style="padding:10px;background:var(--bg-card2);border-radius:8px">
        <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase">RC Vinculada</div>
        <div style="font-size:13px;font-weight:700;color:var(--orange)">${rfq.rc_numero||'—'}</div>
      </div>
      <div style="padding:10px;background:var(--bg-card2);border-radius:8px">
        <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase">Prazo Cotação</div>
        <div style="font-size:13px;font-weight:700;color:var(--text-primary)">${rfq.prazo_cotacao||'—'}</div>
      </div>
      <div style="padding:10px;background:var(--bg-card2);border-radius:8px;text-align:center">
        <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase">Status</div>
        <div style="margin-top:4px">${_rfqBadge(rfq.status)}</div>
      </div>
    </div>

    <!-- Fornecedores -->
    <div style="margin-bottom:14px">
      <div style="font-size:12px;font-weight:700;color:var(--text-primary);margin-bottom:8px">
        <i class="fas fa-building" style="color:#6366f1;margin-right:6px"></i>
        Fornecedores (${(rfq.fornecedores||[]).length})
      </div>
      <div style="display:flex;flex-direction:column;gap:4px">
        ${(rfq.fornecedores||[]).map(f => `
          <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--bg-secondary);border-radius:8px;font-size:12px">
            <div style="width:8px;height:8px;border-radius:50%;background:${f.cotacao_recebida?'#22c55e':f.cotacao_enviada?'#f59e0b':'#6b7280'};flex-shrink:0"></div>
            <div style="flex:1">
              <strong>${f.nome}</strong>
              <span style="color:var(--text-muted);margin-left:6px">${f.email||'sem e-mail'}</span>
            </div>
            <div style="font-size:11px">
              ${f.cotacao_recebida
                ? `<span style="color:#22c55e"><i class="fas fa-check-circle"></i> Proposta recebida · ${_fmtVal(f.valor_negociado||f.valor_total)}</span>`
                : f.cotacao_enviada
                  ? `<span style="color:#f59e0b"><i class="fas fa-clock"></i> Aguardando (enviado em ${f.data_envio||'—'})</span>`
                  : `<span style="color:#6b7280"><i class="fas fa-minus-circle"></i> Aguardando envio</span>`}
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Critérios -->
    ${rfq.criterios ? `
      <div style="margin-bottom:14px;padding:12px;background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.2);border-radius:8px">
        <div style="font-size:11px;font-weight:700;color:#6366f1;margin-bottom:8px"><i class="fas fa-brain" style="margin-right:6px"></i>Critérios de Avaliação</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;font-size:11px">
          ${Object.entries(rfq.criterios).map(([k,v]) => {
            const labels = { preco:'Preço', prazo_entr:'Prazo Entrega', qualidade:'Qualidade', pagamento:'Pagamento', esg:'ESG', suporte:'Suporte' };
            return `<span style="background:rgba(99,102,241,0.12);color:#6366f1;border-radius:6px;padding:3px 8px"><strong>${v}%</strong> ${labels[k]||k}</span>`;
          }).join('')}
        </div>
      </div>
    ` : ''}

    ${rfq.instrucoes ? `
      <div style="padding:10px 14px;background:rgba(230,126,34,0.06);border-left:3px solid var(--orange);border-radius:0 8px 8px 0;font-size:12px;color:var(--text-secondary);margin-bottom:14px">
        <strong>Instruções:</strong> ${rfq.instrucoes}
      </div>
    ` : ''}
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
    ${isCompras ? `
      <button class="btn btn-secondary" onclick="closeModal();_rfqGerarPDF_id('${rfqId}')"><i class="fas fa-file-pdf" style="color:#ef4444"></i> Baixar PDF</button>
      <button class="btn btn-info" onclick="closeModal();_rfqAbrirModalEmail('${rfqId}')"><i class="fas fa-envelope"></i> Enviar E-mail</button>
      <button class="btn btn-primary" onclick="closeModal();farcMatrizCotacao('${rfqId}')"><i class="fas fa-table"></i> Abrir Matriz</button>
    ` : ''}
  `);
}

// ─── MATRIZ DE COTAÇÕES ────────────────────────────────────────────────────────
// Permite registrar e editar propostas recebidas + descontos negociados
function farcMatrizCotacao(rfqId) {
  const rfq = (typeof _getRFQFlow === 'function' ? _getRFQFlow() : []).find(r => r.id === rfqId);
  if (!rfq) { showToast('RFQ não encontrado.','error'); return; }
  const rc  = (_obterRCLocal()).find(r => r.id === rfq.rc_id);
  const itens     = rc?.itens || [];
  const forns     = rfq.fornecedores || [];

  openModalWide(`Matriz de Cotações – ${rfq.numero}`, `
    <div style="margin-bottom:14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">
      <div style="flex:1">
        <div style="font-size:13px;font-weight:700;color:var(--text-primary)">${rfq.titulo}</div>
        <div style="font-size:11px;color:var(--text-muted)">Prazo: ${rfq.prazo_cotacao} · ${forns.length} fornecedor(es) · ${itens.length} item(ns)</div>
      </div>
      ${_rfqBadge(rfq.status)}
    </div>

    <!-- Adicionar fornecedor extra à matriz -->
    <div style="margin-bottom:12px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <button onclick="_rfqMatrizAddForn('${rfqId}')" class="btn btn-secondary btn-sm">
        <i class="fas fa-user-plus"></i> Incluir Fornecedor na Matriz
      </button>
      <span style="font-size:11px;color:var(--text-muted)">Adicione fornecedores adicionais ao processo a qualquer momento</span>
    </div>

    <!-- Tabela Matriz -->
    <div style="overflow-x:auto" id="rfq_matriz_wrap">
      ${_rfqRenderMatriz(rfq, itens, forns)}
    </div>

    <div style="margin-top:14px;padding:10px 14px;background:rgba(99,102,241,0.06);border-radius:8px;font-size:11px;color:var(--text-muted)">
      <i class="fas fa-info-circle" style="color:#6366f1;margin-right:6px"></i>
      Preencha os preços unitários. Use o campo <strong>Negociado</strong> para registrar desconto pós-negociação (aparecerá no Quadro Comparativo).
      Marque <strong>Recebida</strong> quando a proposta for confirmada.
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
    <button class="btn btn-secondary" onclick="_rfqGerarPDF_id('${rfqId}')"><i class="fas fa-file-pdf"></i> PDF Solicitação</button>
    <button class="btn btn-primary" onclick="_rfqSalvarMatriz('${rfqId}')"><i class="fas fa-save"></i> Salvar Matriz</button>
    ${forns.filter(f=>f.cotacao_recebida).length > 0 ? `
      <button class="btn btn-success" onclick="_rfqSalvarMatriz('${rfqId}',true)" title="Salvar e criar o Quadro Comparativo">
        <i class="fas fa-balance-scale"></i> Salvar e Criar Quadro Comparativo
      </button>
    ` : ''}
  `);
}

function _rfqRenderMatriz(rfq, itens, forns) {
  if (!forns.length) return `<div style="padding:20px;text-align:center;color:var(--text-muted)">Nenhum fornecedor no processo</div>`;

  // Cabeçalho colunas: uma coluna por fornecedor (item unit + negociado + total)
  const thForn = forns.map((f,fi) => `
    <th colspan="3" style="padding:8px;background:rgba(99,102,241,0.12);color:#6366f1;font-weight:700;text-align:center;font-size:11px;border:1px solid var(--border-color);min-width:240px">
      <div style="display:flex;align-items:center;justify-content:center;gap:6px">
        <div>
          <div>${f.nome}</div>
          <div style="font-size:9px;color:var(--text-muted);font-weight:400">${f.email||'—'}</div>
        </div>
        <label style="display:flex;align-items:center;gap:3px;font-size:10px;cursor:pointer;font-weight:400;color:var(--text-secondary)">
          <input type="checkbox" id="rfq_forn_recv_${fi}" class="rfq-forn-recebida" data-fi="${fi}" ${f.cotacao_recebida?'checked':''} style="accent-color:#22c55e">
          Recebida
        </label>
      </div>
    </th>
  `).join('');

  const thSub = forns.map(() => `
    <th style="padding:6px 8px;font-size:10px;color:var(--text-muted);text-align:center;border:1px solid var(--border-color);background:var(--bg-tertiary)">Unit. (R$)</th>
    <th style="padding:6px 8px;font-size:10px;color:#22c55e;text-align:center;border:1px solid var(--border-color);background:var(--bg-tertiary)" title="Valor negociado pós-desconto">Negoc. (R$)</th>
    <th style="padding:6px 8px;font-size:10px;color:var(--text-muted);text-align:center;border:1px solid var(--border-color);background:var(--bg-tertiary)">Total</th>
  `).join('');

  const rows = itens.map((it, ii) => {
    const cells = forns.map((f, fi) => {
      const cotado = (f.itens_cotados||[])[ii] || {};
      return `
        <td style="padding:5px 6px;border:1px solid var(--border-color);text-align:center">
          <input type="number" min="0" step="0.01" class="rfq-unit-val" data-ii="${ii}" data-fi="${fi}"
            value="${cotado.preco_unit||''}" placeholder="0,00"
            oninput="_rfqCalcLinha(${ii},${fi})"
            style="width:80px;padding:4px 6px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:6px;color:var(--text-primary);font-size:11px;text-align:right">
        </td>
        <td style="padding:5px 6px;border:1px solid var(--border-color);text-align:center;background:rgba(34,197,94,0.04)">
          <input type="number" min="0" step="0.01" class="rfq-neg-val" data-ii="${ii}" data-fi="${fi}"
            value="${cotado.preco_unit_neg||''}" placeholder="—"
            oninput="_rfqCalcLinha(${ii},${fi})"
            style="width:80px;padding:4px 6px;background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.3);border-radius:6px;color:#22c55e;font-size:11px;text-align:right"
            title="Preencha apenas se houver desconto negociado">
        </td>
        <td style="padding:5px 6px;border:1px solid var(--border-color);text-align:right;font-size:11px;font-weight:600;color:var(--text-primary)" id="rfq_tot_${ii}_${fi}">
          ${(cotado.preco_unit_neg||cotado.preco_unit) ? _fmtVal((cotado.preco_unit_neg||cotado.preco_unit)*(it.qtd||1)) : '—'}
        </td>
      `;
    }).join('');
    return `
      <tr onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='transparent'">
        <td style="padding:7px 10px;border:1px solid var(--border-color);font-weight:600;color:var(--text-primary);min-width:180px">${it.descricao}</td>
        <td style="padding:7px 10px;border:1px solid var(--border-color);text-align:center;color:var(--text-muted)">${it.qtd||1}</td>
        <td style="padding:7px 10px;border:1px solid var(--border-color);text-align:center;color:var(--text-muted)">${it.unidade||'Un'}</td>
        ${cells}
      </tr>
    `;
  }).join('');

  // Linha de totais por fornecedor
  const totRow = `
    <tr style="background:var(--bg-tertiary);font-weight:700">
      <td colspan="3" style="padding:8px 10px;border:1px solid var(--border-color);text-align:right;color:var(--text-secondary)">TOTAL DA PROPOSTA</td>
      ${forns.map((f, fi) => {
        const tot = (f.itens_cotados||[]).reduce((s, it) => s + ((it.preco_unit_neg||it.preco_unit||0)*(it.qtd||1)), 0);
        const totNeg = (f.itens_cotados||[]).reduce((s, it) => s + ((it.preco_unit_neg||0)*(it.qtd||1)), 0);
        const temDesc = totNeg > 0 && totNeg < tot;
        return `
          <td colspan="2" style="padding:8px;border:1px solid var(--border-color);text-align:center" id="rfq_subtot_${fi}">
            ${tot > 0 ? `<span style="color:${f.cotacao_recebida?'#22c55e':'var(--orange)'};font-size:13px">${_fmtVal(tot)}</span>` : '<span style="color:var(--text-muted)">—</span>'}
          </td>
          <td style="padding:8px;border:1px solid var(--border-color);text-align:center">
            ${temDesc ? `<span style="font-size:10px;background:rgba(34,197,94,0.15);color:#22c55e;border-radius:4px;padding:2px 6px"><i class="fas fa-tag"></i> Desc.</span>` : ''}
          </td>
        `;
      }).join('')}
    </tr>
  `;

  return `
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead>
        <tr>
          <th style="padding:8px 10px;background:var(--bg-tertiary);border:1px solid var(--border-color);font-size:11px;color:var(--text-secondary)">Item</th>
          <th style="padding:8px 10px;background:var(--bg-tertiary);border:1px solid var(--border-color);font-size:11px;color:var(--text-secondary);text-align:center">Qtd</th>
          <th style="padding:8px 10px;background:var(--bg-tertiary);border:1px solid var(--border-color);font-size:11px;color:var(--text-secondary);text-align:center">Un</th>
          ${thForn}
        </tr>
        <tr>${'<th colspan="3" style="border:1px solid var(--border-color)"></th>'}${thSub}</tr>
      </thead>
      <tbody>${rows}${totRow}</tbody>
    </table>
  `;
}

function _rfqCalcLinha(ii, fi) {
  // Recalcula total da linha
  const unitEl = document.querySelector(`.rfq-unit-val[data-ii="${ii}"][data-fi="${fi}"]`);
  const negEl  = document.querySelector(`.rfq-neg-val[data-ii="${ii}"][data-fi="${fi}"]`);
  // Para saber a qtd, pega de algum lugar (hardcode via itens ou dataset)
  // Usaremos um hack: percorrendo a linha da tabela
  const cell = document.getElementById(`rfq_tot_${ii}_${fi}`);
  if (!cell) return;
  const unit = parseFloat(unitEl?.value)||0;
  const neg  = parseFloat(negEl?.value)||0;
  const effective = neg > 0 ? neg : unit;
  // Qtd: buscamos do elemento da mesma linha (coluna qtd está em data-qtd ou texto)
  // Como não salvamos, estimamos que o td[1] da linha tem a qtd
  const rows = cell.closest('tbody')?.querySelectorAll('tr');
  let qtd = 1;
  if (rows && rows[ii]) {
    const qtdTd = rows[ii].querySelectorAll('td')[1];
    if (qtdTd) qtd = parseInt(qtdTd.textContent)||1;
  }
  cell.textContent = effective > 0 ? _fmtVal(effective * qtd) : '—';
}

function _rfqSalvarMatriz(rfqId, gerarMapa) {
  const rfqLista = typeof _getRFQFlow === 'function' ? _getRFQFlow() : [];
  const idx = rfqLista.findIndex(r => r.id === rfqId);
  if (idx < 0) { showToast('RFQ não encontrado.','error'); return; }

  const rfq = rfqLista[idx];
  const rc  = (_obterRCLocal()).find(r => r.id === rfq.rc_id);
  const itens = rc?.itens || [];

  // Coleta dados da matriz
  rfq.fornecedores.forEach((f, fi) => {
    const recebEl = document.querySelector(`#rfq_forn_recv_${fi}`);
    f.cotacao_recebida = recebEl ? recebEl.checked : f.cotacao_recebida;

    // Itens
    f.itens_cotados = (f.itens_cotados||[]).map((_, ii) => {
      const unitEl = document.querySelector(`.rfq-unit-val[data-ii="${ii}"][data-fi="${fi}"]`);
      const negEl  = document.querySelector(`.rfq-neg-val[data-ii="${ii}"][data-fi="${fi}"]`);
      const unit   = parseFloat(unitEl?.value)||0;
      const neg    = parseFloat(negEl?.value)||0;
      const qtd    = itens[ii]?.qtd || 1;
      return {
        descricao:      itens[ii]?.descricao || `Item ${ii+1}`,
        qtd,
        unidade:        itens[ii]?.unidade || 'Un',
        preco_unit:     unit,
        preco_unit_neg: neg > 0 ? neg : null,
        total:          (neg > 0 ? neg : unit) * qtd
      };
    });
    f.valor_total   = f.itens_cotados.reduce((s, it) => s + (it.total||0), 0);
    f.valor_original = f.itens_cotados.reduce((s, it) => s + ((it.preco_unit||0)*(it.qtd||1)), 0);
    f.tem_desconto  = f.itens_cotados.some(it => it.preco_unit_neg && it.preco_unit_neg < it.preco_unit);
    if (f.tem_desconto) {
      f.desconto_pct = f.valor_original > 0 ? Math.round(((f.valor_original - f.valor_total)/f.valor_original)*100) : 0;
    }
  });

  // Define status do RFQ
  const todasRecebidas = rfq.fornecedores.length > 0 && rfq.fornecedores.every(f => f.cotacao_recebida);
  const algumaRecebida = rfq.fornecedores.some(f => f.cotacao_recebida);
  if (todasRecebidas)      rfq.status = 'Cotações Recebidas';
  else if (algumaRecebida) rfq.status = 'Negociando';
  else                     rfq.status = rfq.status === 'Aguardando Envio' ? 'Aguardando Cotações' : rfq.status;

  rfq.historico = rfq.historico || [];
  rfq.historico.unshift({ acao: `Matriz atualizada por ${currentUser?.name}. Status: ${rfq.status}`, usuario: currentUser?.name, data: new Date().toLocaleString('pt-BR') });

  rfqLista[idx] = rfq;
  if (typeof _saveRFQFlow === 'function') _saveRFQFlow(rfqLista);

  logAction && logAction('Matriz Cotação', 'Compras', `${rfq.numero} – matriz atualizada`);
  showToast('✅ Matriz de cotações salva!', 'success');

  if (gerarMapa) {
    closeModal();
    setTimeout(() => farcGerarMapaComIA(rfqId), 300);
  } else {
    closeModal();
    renderFluxoAprovacaoRC();
    setTimeout(() => farcSwitchTab && farcSwitchTab('cotacoes'), 100);
  }
}

// Adicionar fornecedor extra à matriz de um RFQ já existente
function _rfqMatrizAddForn(rfqId) {
  const fornList = (typeof _getFornecedores === 'function' ? _getFornecedores() : []).filter(f => f.status === 'Ativo' || f.status === 'Homologado');
  openModal('Incluir Fornecedor na Matriz', `
    <div style="margin-bottom:10px;font-size:12px;color:var(--text-muted)">Selecione ou insira manualmente</div>
    <select class="form-control" id="rfq_add_forn_sel" style="margin-bottom:10px">
      <option value="">— Selecionar fornecedor cadastrado —</option>
      ${fornList.map(f => `<option value="${f.id}" data-nome="${f.razao_social||f.nome_fantasia}" data-email="${f.contato_email||''}">${f.razao_social||f.nome_fantasia}</option>`).join('')}
    </select>
    <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px">— ou preencha manualmente —</div>
    <input class="form-control" id="rfq_add_forn_nome" placeholder="Nome / Razão Social" style="margin-bottom:6px">
    <input class="form-control" id="rfq_add_forn_email" type="email" placeholder="E-mail" style="margin-bottom:6px">
  `,`
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="_rfqConfirmarAddForn('${rfqId}')"><i class="fas fa-plus"></i> Incluir</button>
  `);
}

function _rfqConfirmarAddForn(rfqId) {
  const rfqLista = typeof _getRFQFlow === 'function' ? _getRFQFlow() : [];
  const idx = rfqLista.findIndex(r => r.id === rfqId);
  if (idx < 0) return;
  const rfq = rfqLista[idx];
  const rc  = (_obterRCLocal()).find(r => r.id === rfq.rc_id);

  const sel   = document.getElementById('rfq_add_forn_sel');
  const nome  = sel?.value ? (sel.selectedOptions[0]?.dataset.nome || '') : (document.getElementById('rfq_add_forn_nome')?.value.trim()||'');
  const email = sel?.value ? (sel.selectedOptions[0]?.dataset.email || '') : (document.getElementById('rfq_add_forn_email')?.value.trim()||'');
  if (!nome) { showToast('Informe o nome do fornecedor.','error'); return; }

  const itensRC = rc?.itens || [];
  rfq.fornecedores.push({
    id:               sel?.value || ('ext-'+Date.now()),
    nome,
    email,
    tipo:             sel?.value ? 'cadastrado' : 'externo',
    cotacao_recebida: false,
    cotacao_enviada:  false,
    data_envio:       null,
    valor_total:      null,
    itens_cotados:    itensRC.map(it => ({ descricao: it.descricao, qtd: it.qtd||1, unidade: it.unidade||'Un', preco_unit: null, preco_unit_neg: null, total: null })),
    desconto_pct:     0,
    valor_negociado:  null,
    observacoes:      ''
  });

  rfqLista[idx] = rfq;
  if (typeof _saveRFQFlow === 'function') _saveRFQFlow(rfqLista);
  showToast(`${nome} incluído na matriz!`, 'success');
  closeModal();
  setTimeout(() => farcMatrizCotacao(rfqId), 200);
}

// ─── GERAR QUADRO COMPARATIVO COM IA ─────────────────────────────────────────
function farcGerarMapaComIA(rfqId, modoPacoteForced) {
  const rfq = (typeof _getRFQFlow === 'function' ? _getRFQFlow() : []).find(r => r.id === rfqId);
  if (!rfq) { showToast('RFQ não encontrado.','error'); return; }

  const fornsComProposta = (rfq.fornecedores||[]).filter(f => f.valor_total > 0);
  if (fornsComProposta.length === 0) {
    showToast('Nenhuma proposta com valores. Preencha a Matriz de Cotações antes.','error');
    return;
  }

  // Calcula pontuação ponderada por critérios
  const menorValor = Math.min(...fornsComProposta.map(f => f.valor_total));
  const crit = rfq.criterios || { preco: 40, prazo_entr: 20, qualidade: 20, pagamento: 10, esg: 5, suporte: 5 };
  const scoreForns = fornsComProposta.map(f => {
    const scorePreco = menorValor > 0 ? (menorValor / f.valor_total) * 100 : 50;
    const scorePrazo = 70;
    const scoreQual  = typeof _getScoreFornecedor === 'function' ? (_getScoreFornecedor(f.nome)?.media || 3) * 20 : 60;
    const scorePag   = 70;
    const scoreESG   = 60;
    const scoreSup   = 60;
    const total =
      scorePreco * (crit.preco    / 100) +
      scorePrazo * (crit.prazo_entr / 100) +
      scoreQual  * (crit.qualidade / 100) +
      scorePag   * (crit.pagamento / 100) +
      scoreESG   * (crit.esg      / 100) +
      scoreSup   * (crit.suporte  / 100);
    return { ...f, score_total: Math.round(total), score_preco: Math.round(scorePreco), score_qualidade: Math.round(scoreQual) };
  }).sort((a, b) => b.score_total - a.score_total);

  // Detecta split (melhor por item em fornecedores diferentes)
  const splitInfo = _rfqAnalisarSplit(scoreForns, rfq);

  // Se há split e o comprador ainda não decidiu o modo → abre tela de decisão
  if (splitInfo.temSplit && modoPacoteForced === undefined) {
    _rfqAbrirDecisaoSplitOuPacote(rfqId, scoreForns, splitInfo, crit);
    return;
  }

  const modoPacote = modoPacoteForced !== false; // true = pacote, false = split (futuro)
  const recomendado = scoreForns[0];

  // Gera análise em parágrafo completo
  const motivoIA = _rfqGerarMotivacaoIA(recomendado, scoreForns, crit, rfq, modoPacote);

  // Cria o Mapa Comparativo
  const ano    = new Date().getFullYear();
  const mapas  = typeof _getMapasComp === 'function' ? _getMapasComp() : [];
  const numSeq = String(mapas.length + 1).padStart(4,'0');
  const mapaNum = `MAPA-${ano}-${numSeq}`;

  const novoMapa = {
    id:                     `mapa_${Date.now()}`,
    numero:                 mapaNum,
    titulo:                 `Quadro Comparativo – ${rfq.numero}`,
    rfq_id:                 rfq.id,
    rfq_numero:             rfq.numero,
    rc_id:                  rfq.rc_id,
    rc_numero:              rfq.rc_numero,
    os_vinculada:           rfq.os_vinculada || '',
    fornecedores_analise:   scoreForns,
    fornecedor_selecionado: recomendado.nome,
    fornecedor_id:          recomendado.id,
    valor_total:            recomendado.valor_total,
    valor_negociado:        recomendado.valor_negociado || recomendado.valor_total,
    criterios:              crit,
    recomendacao_ia:        motivoIA,
    tem_desconto:           recomendado.tem_desconto || false,
    desconto_pct:           recomendado.desconto_pct || 0,
    modo_fechamento:        splitInfo.temSplit ? (modoPacote ? 'pacote' : 'split') : 'pacote',
    split_info:             splitInfo.temSplit ? splitInfo : null,
    status:                 'Aguardando Aprovação',
    estagio_atual:          1,
    total_estagios:         3,
    estagios_aprovacao:     [],
    criado_por:             currentUser?.name || '',
    data_criacao:           new Date().toISOString(),
    historico: [{ acao: `Quadro Comparativo gerado por ${currentUser?.name}. IA recomendou: ${recomendado.nome}${splitInfo.temSplit ? ` (modo ${modoPacote?'pacote':'split'})` : ''}`, usuario: currentUser?.name, data: new Date().toLocaleString('pt-BR') }]
  };

  mapas.unshift(novoMapa);
  if (typeof _saveMapasComp === 'function') _saveMapasComp(mapas);

  // Atualiza status do RFQ
  const rfqLista = typeof _getRFQFlow === 'function' ? _getRFQFlow() : [];
  const ri = rfqLista.findIndex(r => r.id === rfqId);
  if (ri >= 0) { rfqLista[ri].status = 'Mapa Criado'; if (typeof _saveRFQFlow === 'function') _saveRFQFlow(rfqLista); }

  logAction && logAction('Quadro Comparativo', 'Compras', `${mapaNum} criado via IA. Recomendado: ${recomendado.nome}`);

  // ── Modal de resultado com análise completa ────────────────────────────────
  const splitBanner = splitInfo.temSplit ? `
    <div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.35);border-radius:8px;padding:10px 14px;margin-bottom:12px;font-size:12px">
      <div style="font-weight:700;color:#f59e0b;margin-bottom:4px">
        <i class="fas fa-code-branch" style="margin-right:6px"></i>
        ${modoPacote ? 'Fechamento como Pacote (único fornecedor)' : 'Fechamento Split (melhor por item)'}
      </div>
      <div style="color:var(--text-secondary)">
        ${modoPacote
          ? `A análise detectou que ${splitInfo.fornecedoresSplit.join(' e ')} oferecem as melhores condições por item individualmente. O comprador optou por fechar como <strong>pacote único</strong> com <strong>${recomendado.nome}</strong> — consolidando a operação logística e de pagamento.`
          : `Fechamento distribuído entre os melhores fornecedores por item. Economia estimada: <strong>${_fmtVal(splitInfo.valorPacote - splitInfo.valorSplit)}</strong> vs. pacote único.`
        }
      </div>
    </div>
  ` : '';

  openModalWide(`✅ Quadro Comparativo Gerado – ${mapaNum}`, `

    ${splitBanner}

    <!-- Tabela de scores -->
    <div style="overflow-x:auto;margin-bottom:14px">
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead>
          <tr style="background:var(--bg-tertiary)">
            <th style="padding:8px 12px;text-align:center;font-size:11px;color:var(--text-secondary);width:50px">Class.</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:var(--text-secondary)">Fornecedor</th>
            <th style="padding:8px 12px;text-align:right;font-size:11px;color:var(--text-secondary)">Valor Bruto</th>
            <th style="padding:8px 12px;text-align:right;font-size:11px;color:var(--text-secondary)">Valor Negociado</th>
            <th style="padding:8px 12px;text-align:center;font-size:11px;color:var(--text-secondary)">Score IA</th>
            <th style="padding:8px 12px;text-align:center;font-size:11px;color:var(--text-secondary)">Desconto</th>
          </tr>
        </thead>
        <tbody>
          ${scoreForns.map((f, i) => {
            const medalha = i===0
              ? `<span style="background:#22c55e;color:#fff;border-radius:50%;width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:700">1°</span>`
              : i===1
              ? `<span style="background:#f59e0b;color:#fff;border-radius:50%;width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:700">2°</span>`
              : `<span style="background:var(--bg-card2);color:var(--text-muted);border-radius:50%;width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center;font-size:11px">${i+1}°</span>`;
            const sc = f.score_total;
            const scColor = sc>=80?'#22c55e':sc>=60?'#f59e0b':'#ef4444';
            const rowBg   = i===0 ? 'background:rgba(34,197,94,0.04)' : '';
            return `<tr style="border-bottom:1px solid var(--border-color);${rowBg}" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='${i===0?'rgba(34,197,94,0.04)':'transparent'}'">
              <td style="padding:9px 12px;text-align:center">${medalha}</td>
              <td style="padding:9px 12px">
                <div style="font-weight:${i===0?'700':'500'};color:${i===0?'var(--text-primary)':'var(--text-secondary)'}">${f.nome}</div>
                ${f.tem_desconto ? `<div style="font-size:10px;color:#22c55e"><i class="fas fa-tag"></i> Desconto negociado</div>` : ''}
              </td>
              <td style="padding:9px 12px;text-align:right;color:var(--text-muted)">${_fmtVal(f.valor_original||f.valor_total)}</td>
              <td style="padding:9px 12px;text-align:right;font-weight:700;color:${i===0?'#22c55e':'var(--text-primary)'}">${_fmtVal(f.valor_total)}</td>
              <td style="padding:9px 12px;text-align:center">
                <span style="display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:50%;background:${scColor}22;border:2px solid ${scColor};font-size:12px;font-weight:800;color:${scColor}">${sc}</span>
              </td>
              <td style="padding:9px 12px;text-align:center">
                ${f.tem_desconto && f.desconto_pct > 0
                  ? `<span style="background:rgba(34,197,94,0.15);color:#22c55e;border-radius:6px;padding:3px 8px;font-size:11px;font-weight:700">-${f.desconto_pct}%</span>`
                  : '<span style="color:var(--text-muted);font-size:11px">—</span>'}
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>

    <!-- Análise completa da IA em parágrafo -->
    <div style="background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.2);border-radius:10px;padding:14px 16px;margin-bottom:12px">
      <div style="font-size:12px;font-weight:700;color:#6366f1;margin-bottom:10px">
        <i class="fas fa-brain" style="margin-right:6px"></i>Análise da IA — Texto Completo
      </div>
      <div style="font-size:12px;color:var(--text-secondary);line-height:1.75">${motivoIA}</div>
    </div>

    <div style="padding:8px 12px;background:rgba(34,197,94,0.05);border:1px solid rgba(34,197,94,0.2);border-radius:8px;font-size:11px;color:var(--text-muted)">
      <i class="fas fa-check-circle" style="color:#22c55e;margin-right:6px"></i>
      Quadro <strong>${mapaNum}</strong> criado e enviado para aprovação na aba <strong>Mapa Comparativo</strong>.
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
    <button class="btn btn-primary" onclick="closeModal();farcSwitchTab('mapa')"><i class="fas fa-balance-scale"></i> Ver no Mapa Comparativo</button>
  `);

  showToast(`✅ Quadro ${mapaNum} criado! Recomendado: ${recomendado.nome}`, 'success', 5000);
}

// ─── Modal de decisão: comprador escolhe Pacote ou Split ──────────────────────
function _rfqAbrirDecisaoSplitOuPacote(rfqId, scoreForns, splitInfo, crit) {
  const recomendado = scoreForns[0];
  const difValor = splitInfo.valorPacote - splitInfo.valorSplit;
  const difPct   = splitInfo.valorPacote > 0 ? Math.round((difValor / splitInfo.valorPacote) * 100) : 0;

  openModalWide(`⚖️ Decisão de Fechamento – Como deseja fechar as cotações?`, `
    <div style="font-size:13px;color:var(--text-secondary);margin-bottom:16px;line-height:1.6">
      A análise identificou que a <strong>melhor condição por item</strong> está distribuída entre fornecedores diferentes.
      Escolha como deseja fechar este processo:
    </div>

    <!-- Alerta split -->
    <div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.35);border-radius:10px;padding:12px 16px;margin-bottom:16px">
      <div style="font-size:12px;font-weight:700;color:#f59e0b;margin-bottom:8px">
        <i class="fas fa-exclamation-triangle" style="margin-right:6px"></i>Atenção — Melhores condições por item em fornecedores diferentes
      </div>
      <div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px">
        ${splitInfo.detalhes.map(d =>
          `<div style="padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.06)">• <strong>${d.item}</strong>: melhor oferta de <strong>${d.fornecedor}</strong> (${_fmtVal(d.valor)})</div>`
        ).join('')}
      </div>
      <div style="font-size:11px;color:var(--text-muted);margin-top:8px">
        Valor total split (por item): <strong style="color:#22c55e">${_fmtVal(splitInfo.valorSplit)}</strong> vs.
        Pacote único (${recomendado.nome}): <strong style="color:#6366f1">${_fmtVal(splitInfo.valorPacote)}</strong>
        — diferença de <strong style="color:#f59e0b">${_fmtVal(difValor)} (${difPct}%)</strong>
      </div>
    </div>

    <!-- Opções de fechamento -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">

      <!-- Opção Pacote -->
      <div style="border:2px solid rgba(99,102,241,0.4);border-radius:12px;padding:16px;background:rgba(99,102,241,0.05);cursor:pointer"
        onclick="document.getElementById('opt_pacote').checked=true;this.style.borderColor='#6366f1';document.getElementById('opt_split_card').style.borderColor='rgba(34,197,94,0.3)'"
        id="opt_pacote_card">
        <label style="cursor:pointer;display:flex;align-items:flex-start;gap:10px">
          <input type="radio" name="modo_fechamento" id="opt_pacote" value="pacote" checked style="margin-top:3px;accent-color:#6366f1">
          <div>
            <div style="font-size:13px;font-weight:700;color:#6366f1;margin-bottom:4px">
              <i class="fas fa-box" style="margin-right:6px"></i>Fechar como Pacote
            </div>
            <div style="font-size:11px;color:var(--text-secondary);line-height:1.5">
              Um único fornecedor para todos os itens.<br>
              <strong>Fornecedor recomendado:</strong> ${recomendado.nome}<br>
              <strong>Valor:</strong> ${_fmtVal(splitInfo.valorPacote)}<br>
              <em style="color:var(--text-muted)">Simplifica logística e pagamento. IA segue esta explicação.</em>
            </div>
          </div>
        </label>
      </div>

      <!-- Opção Split -->
      <div style="border:2px solid rgba(34,197,94,0.3);border-radius:12px;padding:16px;background:rgba(34,197,94,0.04);cursor:pointer"
        onclick="document.getElementById('opt_split').checked=true;this.style.borderColor='#22c55e';document.getElementById('opt_pacote_card').style.borderColor='rgba(99,102,241,0.2)'"
        id="opt_split_card">
        <label style="cursor:pointer;display:flex;align-items:flex-start;gap:10px">
          <input type="radio" name="modo_fechamento" id="opt_split" value="split" style="margin-top:3px;accent-color:#22c55e">
          <div>
            <div style="font-size:13px;font-weight:700;color:#22c55e;margin-bottom:4px">
              <i class="fas fa-code-branch" style="margin-right:6px"></i>Fechar como Split
            </div>
            <div style="font-size:11px;color:var(--text-secondary);line-height:1.5">
              Melhor fornecedor por item individualmente.<br>
              <strong>Fornecedores:</strong> ${splitInfo.fornecedoresSplit.join(', ')}<br>
              <strong>Valor estimado:</strong> ${_fmtVal(splitInfo.valorSplit)}<br>
              <em style="color:var(--text-muted)">Economia de ${_fmtVal(difValor)}, mas gera múltiplos pedidos.</em>
            </div>
          </div>
        </label>
      </div>
    </div>

    <div style="margin-top:12px;font-size:11px;color:var(--text-muted);padding:8px 12px;background:rgba(255,255,255,0.03);border-radius:6px">
      <i class="fas fa-info-circle" style="color:#6366f1;margin-right:4px"></i>
      Se optar por <strong>Pacote</strong>, a IA explica no quadro que a escolha prioriza simplicidade operacional mesmo havendo condições melhores por item.
      Se optar por <strong>Split</strong>, a IA documenta cada item com seu respectivo fornecedor.
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="_rfqConfirmarModoFechamento('${rfqId}')">
      <i class="fas fa-check"></i> Confirmar e Gerar Quadro
    </button>
  `);
}

// Confirma a escolha pacote/split e gera o mapa
function _rfqConfirmarModoFechamento(rfqId) {
  const modo = document.querySelector('input[name="modo_fechamento"]:checked')?.value || 'pacote';
  closeModal();
  setTimeout(() => farcGerarMapaComIA(rfqId, modo === 'pacote'), 200);
}

// ─── Análise completa em parágrafo – todos os fornecedores + recomendação ──────
function _rfqGerarMotivacaoIA(recomendado, todos, crit, rfq, modoPacote) {
  const menorPreco  = Math.min(...todos.map(f => f.valor_total));
  const maiorPreco  = Math.max(...todos.map(f => f.valor_total));
  const idfRec      = typeof _getScoreFornecedor === 'function' ? _getScoreFornecedor(recomendado.nome) : null;
  const scoreStr    = recomendado.score_total >= 80 ? 'excelente' : recomendado.score_total >= 65 ? 'bom' : 'satisfatório';

  const critLabels  = {
    preco:      `Preço/Custo (${crit.preco}%)`,
    prazo_entr: `Prazo de Entrega (${crit.prazo_entr}%)`,
    qualidade:  `Qualidade/Garantia (${crit.qualidade}%)`,
    pagamento:  `Condições de Pagamento (${crit.pagamento}%)`,
    esg:        `ESG/Sustentabilidade (${crit.esg}%)`,
    suporte:    `Suporte Técnico (${crit.suporte}%)`
  };
  const criteriosAtivos = Object.entries(crit).filter(([,v])=>v>0).map(([k])=>critLabels[k]).join(', ');

  // ── Parágrafo 1: Contexto geral da análise ──────────────────────────────────
  let texto = `Para o processo <strong>${rfq.numero}</strong>, foram avaliados ${todos.length} fornecedor(es) com base nos seguintes critérios ponderados: ${criteriosAtivos}. `;

  if (todos.length > 1) {
    const spread = maiorPreco > 0 ? Math.round(((maiorPreco - menorPreco)/menorPreco)*100) : 0;
    texto += `As propostas apresentaram variação de preço de <strong>${spread}%</strong> entre o menor e o maior valor cotado. `;
  }

  // ── Parágrafo 2: Análise individual de cada fornecedor ──────────────────────
  texto += `<br><br><strong>Análise por fornecedor:</strong><br>`;
  todos.forEach((f, i) => {
    const pos    = i + 1;
    const eMais  = f.valor_total === menorPreco ? ' — <em>menor preço</em>' : '';
    const eMaior = f.valor_total === maiorPreco && todos.length > 1 ? ' — <em>maior preço</em>' : '';
    const varPct = menorPreco > 0 && f.valor_total !== menorPreco
      ? ` (+${Math.round(((f.valor_total - menorPreco)/menorPreco)*100)}% acima do menor)` : '';
    const descInfo = f.tem_desconto && f.desconto_pct > 0
      ? `, com desconto negociado de <strong>${f.desconto_pct}%</strong>` : '';
    const idfF = typeof _getScoreFornecedor === 'function' ? _getScoreFornecedor(f.nome) : null;
    const idfInfo = idfF && idfF.media ? `, IDF histórico ${idfF.media.toFixed(1)}/5` : '';
    const scoreColor = f.score_total >= 80 ? '#22c55e' : f.score_total >= 60 ? '#f59e0b' : '#ef4444';
    texto += `<span style="display:block;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.06)">`;
    texto += `<strong style="color:${pos===1?'#22c55e':'var(--text-primary)'}">${pos}° ${f.nome}</strong> — `;
    texto += `Score <span style="color:${scoreColor};font-weight:700">${f.score_total}/100</span>, `;
    texto += `proposta de <strong>${_fmtVal(f.valor_total)}</strong>${eMais}${eMaior}${varPct}${descInfo}${idfInfo}.`;
    texto += `</span>`;
  });

  // ── Parágrafo 3: Detecção split vs pacote ───────────────────────────────────
  const splitInfo = _rfqAnalisarSplit(todos, rfq);
  if (splitInfo.temSplit && !modoPacote) {
    texto += `<br><strong style="color:#f59e0b"><i class="fas fa-exclamation-triangle" style="margin-right:4px"></i>Atenção — Melhor condição por item envolve fornecedores diferentes:</strong><br>`;
    texto += `<span style="font-size:12px;color:var(--text-secondary)">`;
    splitInfo.detalhes.forEach(d => {
      texto += `• <strong>${d.item}</strong>: melhor oferta de <strong>${d.fornecedor}</strong> (${_fmtVal(d.valor)})<br>`;
    });
    texto += `Fechar como "pacote" (um único fornecedor) resulta em custo total de <strong>${_fmtVal(splitInfo.valorPacote)}</strong> `;
    texto += `vs. <strong>${_fmtVal(splitInfo.valorSplit)}</strong> no modelo split — diferença de <strong>${_fmtVal(splitInfo.valorPacote - splitInfo.valorSplit)}</strong>. `;
    texto += `O comprador optou por fechar como <strong>pacote com ${recomendado.nome}</strong>, priorizando simplicidade operacional e critérios qualitativos.`;
    texto += `</span>`;
  } else if (splitInfo.temSplit && modoPacote) {
    texto += `<br><span style="font-size:12px;color:var(--text-muted)"><i class="fas fa-box" style="color:#6366f1;margin-right:4px"></i>`;
    texto += `O comprador optou por fechar como <strong>pacote único</strong> com <strong>${recomendado.nome}</strong>, `;
    texto += `consolidando todos os itens em um único fornecedor para simplificar a operação logística e de pagamento. `;
    texto += `O custo de pacote é <strong>${_fmtVal(splitInfo.valorPacote)}</strong> frente a <strong>${_fmtVal(splitInfo.valorSplit)}</strong> no modelo split.`;
    texto += `</span>`;
  }

  // ── Parágrafo 4: Recomendação final ─────────────────────────────────────────
  texto += `<br><br><strong>Recomendação final:</strong> `;
  texto += `Com base na análise ponderada dos critérios definidos, `;
  if (recomendado.valor_total === menorPreco) {
    texto += `<strong>${recomendado.nome}</strong> apresentou o <strong>menor valor total cotado</strong> (${_fmtVal(recomendado.valor_total)}) `;
  } else {
    const difPct = menorPreco > 0 ? Math.round(((recomendado.valor_total - menorPreco)/menorPreco)*100) : 0;
    texto += `<strong>${recomendado.nome}</strong> obteve o <strong>maior score global</strong> (${recomendado.score_total}/100), `;
    texto += `com valor de ${_fmtVal(recomendado.valor_total)} — ${difPct}% acima do menor preço, compensado por desempenho superior nos demais critérios `;
  }
  texto += `e score ${scoreStr} de <strong>${recomendado.score_total}/100</strong>. `;
  if (recomendado.tem_desconto && recomendado.desconto_pct > 0) {
    texto += `O desconto de ${recomendado.desconto_pct}% negociado reduz o custo final para <strong>${_fmtVal(recomendado.valor_total)}</strong>. `;
  }
  if (idfRec && idfRec.media >= 4) {
    texto += `O histórico de avaliação IDF do fornecedor é positivo (${idfRec.media.toFixed(1)}/5), reforçando a confiabilidade da escolha. `;
  }
  if (todos.length > 1) {
    texto += `Classificado em <strong>1° lugar</strong> entre ${todos.length} fornecedores avaliados, `;
  }
  texto += `recomenda-se a contratação de <strong>${recomendado.nome}</strong> para este processo.`;

  return texto;
}

// ─── Analisa se a melhor condição por item vem de fornecedores diferentes ──────
function _rfqAnalisarSplit(scoreForns, rfq) {
  // Precisa de pelo menos 2 fornecedores com propostas e itens individuais
  const comItens = scoreForns.filter(f => f.itens_cotados && f.itens_cotados.length > 0 && f.valor_total > 0);
  if (comItens.length < 2) return { temSplit: false };

  const numItens = comItens[0].itens_cotados.length;
  if (numItens === 0) return { temSplit: false };

  // Para cada item, acha o fornecedor com menor preço unitário
  let detalhes = [];
  let fornedoresUsadosSplit = new Set();
  let valorSplit = 0;

  for (let ii = 0; ii < numItens; ii++) {
    let melhorForn = null;
    let melhorValor = Infinity;
    comItens.forEach(f => {
      const it = f.itens_cotados[ii];
      const preco = it?.preco_unit_neg || it?.preco_unit || 0;
      if (preco > 0 && preco < melhorValor) {
        melhorValor = preco;
        melhorForn = f;
      }
    });
    if (melhorForn) {
      const it = melhorForn.itens_cotados[ii];
      const total = melhorValor * (it?.qtd || 1);
      detalhes.push({ item: it?.descricao || `Item ${ii+1}`, fornecedor: melhorForn.nome, valor: melhorValor, total });
      fornedoresUsadosSplit.add(melhorForn.nome);
      valorSplit += total;
    }
  }

  // Verifica se o split envolve mais de um fornecedor
  const temSplit = fornedoresUsadosSplit.size > 1;
  const valorPacote = scoreForns[0]?.valor_total || 0; // melhor fornecedor pacote = 1° do ranking

  return { temSplit, detalhes, valorSplit, valorPacote, fornecedoresSplit: [...fornedoresUsadosSplit] };
}

function farcRegistrarCotacao(rfqId) { farcMatrizCotacao(rfqId); }
function farcGerarMapa(rfqId)        { farcGerarMapaComIA(rfqId); }

// ════════════════════════════════════════════════════════════════════════════
// ABA 4 – MAPA COMPARATIVO
// Exibe mapas com score de fornecedores e fluxo de aprovação em 3 etapas
// ════════════════════════════════════════════════════════════════════════════
function _farcRenderTabMapa() {
  const mapas = typeof _getMapasComp === 'function' ? _getMapasComp() : [];
  const cfg = _getConfigAprovacao();
  const isCompras = currentUser && ['admin','compras','diretor'].includes(currentUser.profile);

  const pendentes  = mapas.filter(m => m.status === 'Aguardando Aprovação');
  const aprovados  = mapas.filter(m => m.status === 'Aprovado' || m.status === 'PC Emitido');
  const rejeitados = mapas.filter(m => m.status === 'Reprovado' || m.status === 'Rejeitado');

  return `
    <div style="padding:16px">
      ${pendentes.length > 0 ? `
        <div style="background:rgba(139,92,246,0.08);border:1px solid rgba(139,92,246,0.3);border-radius:10px;padding:12px 16px;margin-bottom:14px">
          <div style="font-size:13px;font-weight:700;color:#8b5cf6;margin-bottom:8px">
            <i class="fas fa-balance-scale" style="margin-right:6px"></i>${pendentes.length} Mapa(s) aguardando aprovação
          </div>
          ${pendentes.slice(0,3).map(m => `
            <div style="padding:10px;background:rgba(0,0,0,0.2);border-radius:8px;margin-bottom:8px">
              <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
                <div style="flex:1;min-width:200px">
                  <div style="font-size:12px;font-weight:700;color:var(--text-primary)">${m.numero} – ${m.titulo||m.rfq_numero||'—'}</div>
                  <div style="font-size:11px;color:var(--text-muted)">RFQ: ${m.rfq_numero||'—'} · Fornecedor indicado: <strong style="color:var(--fa-teal)">${m.fornecedor_selecionado||'—'}</strong></div>
                  <div style="font-size:11px;margin-top:4px">Score: ${_renderScoreForn(m.fornecedor_selecionado)}</div>
                </div>
                <!-- Aprovação 3 estágios do mapa -->
                <div style="display:flex;gap:6px;align-items:center">
                  ${[1,2,3].map(i => {
                    const cfgE = i===1?cfg.estagio1:i===2?cfg.estagio2:cfg.estagio3;
                    const ap = (m.estagios_aprovacao||[]).find(e=>e.estagio===i);
                    const isAtual = (m.estagio_atual||1)===i && m.status==='Aguardando Aprovação';
                    const cor = ap ? (ap.status==='Aprovado'?'#22c55e':'#ef4444') : isAtual?'#8b5cf6':'#374151';
                    return `<div title="${cfgE?.nome||'Estágio '+i}" style="width:26px;height:26px;border-radius:50%;background:${cor}22;border:2px solid ${cor};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:${cor}">${i}</div>`;
                  }).join('<span style="color:var(--text-muted);font-size:10px">›</span>')}
                </div>
                <div style="display:flex;gap:6px;flex-wrap:wrap">
                  <button onclick="farcVerMapa('${m.id}')" class="btn btn-secondary btn-sm btn-icon" title="Ver mapa"><i class="fas fa-eye"></i></button>
                  ${_farcPodeAprovarMapa(m) ? `
                    <button onclick="farcAprovarMapa('${m.id}')" class="btn btn-success btn-sm"><i class="fas fa-check"></i> Aprovar</button>
                    <button onclick="farcReprovarMapa('${m.id}')" class="btn btn-danger btn-sm"><i class="fas fa-times"></i> Reprovar</button>
                  ` : ''}
                  ${m.status === 'Aprovado' && isCompras ? `<button onclick="farcEmitirPedido('${m.id}')" class="btn btn-primary btn-sm"><i class="fas fa-shopping-bag"></i> Emitir PO</button>` : ''}
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      ` : ''}

      <!-- Tabela geral -->
      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
        <input type="text" id="farc_search_mapa" placeholder="Buscar mapa..." oninput="_farcFiltrarMapa()"
          style="padding:7px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;width:200px">
        <select id="farc_filter_mapa" onchange="_farcFiltrarMapa()"
          style="padding:7px 10px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:12px">
          <option value="">Todos</option>
          <option>Aguardando Aprovação</option>
          <option>Aprovado</option>
          <option>PC Emitido</option>
          <option>Reprovado</option>
        </select>
      </div>

      <div id="farc_tabela_mapa">${_farcTabelaMapa(mapas, cfg)}</div>
    </div>
  `;
}

function _farcTabelaMapa(lista, cfg) {
  if (!lista.length) return `<div style="text-align:center;padding:40px;color:var(--text-muted)"><i class="fas fa-balance-scale" style="font-size:32px;display:block;margin-bottom:12px;opacity:.4"></i>Nenhum mapa comparativo encontrado.</div>`;
  const isCompras = currentUser && ['admin','compras','diretor'].includes(currentUser.profile);

  const mapaBadge = s => {
    const m = { 'Aguardando Aprovação':'#8b5cf6','Aprovado':'#22c55e','PC Emitido':'#10b981','Reprovado':'#ef4444','Rejeitado':'#ef4444' };
    const c = m[s]||'#8b949e';
    return `<span style="background:${c}22;color:${c};border-radius:6px;padding:3px 7px;font-size:10px;font-weight:700">${s}</span>`;
  };

  return `
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead>
          <tr style="background:var(--bg-tertiary)">
            <th style="padding:9px 12px;text-align:left;font-size:11px;color:var(--text-secondary)">Número</th>
            <th style="padding:9px 12px;text-align:left;font-size:11px;color:var(--text-secondary)">RFQ</th>
            <th style="padding:9px 12px;text-align:left;font-size:11px;color:var(--text-secondary)">Fornecedor Indicado</th>
            <th style="padding:9px 12px;text-align:left;font-size:11px;color:var(--text-secondary)">Score</th>
            <th style="padding:9px 12px;text-align:right;font-size:11px;color:var(--text-secondary)">Valor</th>
            <th style="padding:9px 12px;text-align:center;font-size:11px;color:var(--text-secondary)">Aprovação</th>
            <th style="padding:9px 12px;text-align:center;font-size:11px;color:var(--text-secondary)">Status</th>
            <th style="padding:9px 12px;text-align:center;font-size:11px;color:var(--text-secondary)">Ações</th>
          </tr>
        </thead>
        <tbody>
          ${lista.map(m => `
            <tr style="border-bottom:1px solid var(--border-color)" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='transparent'">
              <td style="padding:9px 12px;font-weight:700;color:#8b5cf6">${m.numero||'—'}</td>
              <td style="padding:9px 12px;color:#6366f1;font-weight:600">${m.rfq_numero||'—'}</td>
              <td style="padding:9px 12px;color:var(--text-primary)">${m.fornecedor_selecionado||'—'}</td>
              <td style="padding:9px 12px">${_renderScoreForn(m.fornecedor_selecionado)}</td>
              <td style="padding:9px 12px;text-align:right;font-weight:600">${_fmtVal(m.valor_total||m.valor)}</td>
              <td style="padding:9px 12px;text-align:center">
                <div style="display:flex;gap:4px;justify-content:center">
                  ${[1,2,3].map(i => {
                    const ap = (m.estagios_aprovacao||[]).find(e=>e.estagio===i);
                    const isAtual = (m.estagio_atual||1)===i && m.status==='Aguardando Aprovação';
                    const cor = ap ? (ap.status==='Aprovado'?'#22c55e':'#ef4444') : isAtual?'#8b5cf6':'#374151';
                    return `<div style="width:20px;height:20px;border-radius:50%;background:${cor}22;border:1.5px solid ${cor};display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:${cor}">${i}</div>`;
                  }).join('')}
                </div>
              </td>
              <td style="padding:9px 12px;text-align:center">${mapaBadge(m.status)}</td>
              <td style="padding:9px 12px;text-align:center">
                <div style="display:flex;gap:4px;justify-content:center">
                  <button onclick="farcVerMapa('${m.id}')" class="btn btn-secondary btn-sm btn-icon" title="Ver"><i class="fas fa-eye"></i></button>
                  ${_farcPodeAprovarMapa(m) ? `<button onclick="farcAprovarMapa('${m.id}')" class="btn btn-success btn-sm btn-icon" title="Aprovar"><i class="fas fa-check"></i></button>` : ''}
                  ${m.status === 'Aprovado' && isCompras ? `<button onclick="farcEmitirPedido('${m.id}')" class="btn btn-primary btn-sm btn-icon" title="Emitir PO"><i class="fas fa-shopping-bag"></i></button>` : ''}
                  <button onclick="farcExportarMapaPDF('${m.id}')" class="btn btn-secondary btn-sm btn-icon" title="PDF"><i class="fas fa-file-pdf"></i></button>
                  ${m.fornecedor_selecionado ? `<button onclick="farcAuditarFornecedor('${m.fornecedor_selecionado}')" class="btn btn-secondary btn-sm btn-icon" title="Auditar Fornecedor" style="color:#8b5cf6"><i class="fas fa-shield-alt"></i></button>` : ''}
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function _farcFiltrarMapa() {
  const s  = (document.getElementById('farc_search_mapa')?.value||'').toLowerCase();
  const st = document.getElementById('farc_filter_mapa')?.value||'';
  const f  = (typeof _getMapasComp === 'function' ? _getMapasComp() : []).filter(m =>
    (!s || ((m.numero||'')+(m.rfq_numero||'')+(m.fornecedor_selecionado||'')).toLowerCase().includes(s)) &&
    (!st || m.status === st)
  );
  const cfg = _getConfigAprovacao();
  const el = document.getElementById('farc_tabela_mapa');
  if (el) el.innerHTML = _farcTabelaMapa(f, cfg);
}

function _farcPodeAprovarMapa(m) {
  if (!currentUser) return false;
  if (m.status !== 'Aguardando Aprovação') return false;
  const cfg = _getConfigAprovacao();
  const est = m.estagio_atual || 1;
  const mapa = { 1: cfg.estagio1?.perfis||[], 2: cfg.estagio2?.perfis||[], 3: cfg.estagio3?.perfis||[] };
  const perfis = mapa[est]||[];
  const jaAprovou = (m.estagios_aprovacao||[]).some(e =>
    e.estagio === est && e.aprovador === currentUser.name
  );
  return perfis.includes(currentUser.profile) && !jaAprovou;
}

function farcVerMapa(mapaId) {
  if (typeof verDetalheMapa2 === 'function') { verDetalheMapa2(mapaId); return; }
  const m = (typeof _getMapasComp === 'function' ? _getMapasComp() : []).find(x => x.id === mapaId);
  if (!m) return;

  const rfq = (typeof _getRFQFlow === 'function' ? _getRFQFlow() : []).find(r => r.id === m.rfq_id || r.numero === m.rfq_numero);
  const cfg = _getConfigAprovacao();

  // Banner split/pacote
  const splitBanner = m.split_info?.temSplit ? `
    <div style="background:rgba(245,158,11,0.07);border:1px solid rgba(245,158,11,0.3);border-radius:8px;padding:10px 14px;margin-bottom:12px;font-size:12px">
      <div style="font-weight:700;color:#f59e0b;margin-bottom:3px">
        <i class="fas fa-${m.modo_fechamento==='split'?'code-branch':'box'}" style="margin-right:5px"></i>
        Modo de Fechamento: ${m.modo_fechamento==='split' ? 'Split (melhor por item)' : 'Pacote (fornecedor único)'}
      </div>
      <div style="color:var(--text-secondary)">
        ${m.modo_fechamento==='pacote'
          ? `Fechado como pacote único com <strong>${m.fornecedor_selecionado}</strong>, mesmo havendo condições melhores por item individualmente.`
          : `Fechado em split — itens distribuídos entre ${m.split_info.fornecedoresSplit?.join(', ')||'múltiplos fornecedores'} para obter a melhor condição por item.`
        }
      </div>
    </div>
  ` : '';

  // Tabela de todos os fornecedores analisados
  const tabelaForns = (m.fornecedores_analise||[]).length > 0 ? `
    <div style="margin-bottom:14px">
      <div style="font-size:12px;font-weight:700;color:var(--text-secondary);margin-bottom:8px">FORNECEDORES ANALISADOS</div>
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead>
          <tr style="background:var(--bg-tertiary)">
            <th style="padding:7px 10px;text-align:center;font-size:10px;color:var(--text-muted)">Class.</th>
            <th style="padding:7px 10px;text-align:left;font-size:10px;color:var(--text-muted)">Fornecedor</th>
            <th style="padding:7px 10px;text-align:right;font-size:10px;color:var(--text-muted)">Valor</th>
            <th style="padding:7px 10px;text-align:center;font-size:10px;color:var(--text-muted)">Score IA</th>
          </tr>
        </thead>
        <tbody>
          ${(m.fornecedores_analise||[]).map((f,i) => {
            const sc = f.score_total||0;
            const scC = sc>=80?'#22c55e':sc>=60?'#f59e0b':'#ef4444';
            const isRec = f.nome === m.fornecedor_selecionado;
            return `<tr style="border-bottom:1px solid var(--border-color);${isRec?'background:rgba(34,197,94,0.04)':''}">
              <td style="padding:7px 10px;text-align:center">
                <span style="background:${isRec?'#22c55e':'var(--bg-card2)'};color:${isRec?'#fff':'var(--text-muted)'};border-radius:50%;width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:700">${i+1}°</span>
              </td>
              <td style="padding:7px 10px;font-weight:${isRec?'700':'400'};color:${isRec?'var(--text-primary)':'var(--text-secondary)'}">
                ${f.nome}${isRec ? ' <span style="font-size:9px;background:rgba(34,197,94,0.15);color:#22c55e;border-radius:4px;padding:1px 5px">✓ Recomendado</span>' : ''}
              </td>
              <td style="padding:7px 10px;text-align:right;font-weight:${isRec?'700':'400'};color:${isRec?'#22c55e':'var(--text-secondary)'}">${_fmtVal(f.valor_total)}</td>
              <td style="padding:7px 10px;text-align:center">
                <span style="color:${scC};font-weight:700;font-size:12px">${sc}</span>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  ` : '';

  openModalWide(`Mapa Comparativo – ${m.numero}`, `
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
      ${_farcRenderMapaBadge(m.status)}
      ${m.modo_fechamento ? `<span style="background:rgba(99,102,241,0.12);color:#6366f1;border-radius:6px;padding:3px 8px;font-size:10px;font-weight:700"><i class="fas fa-${m.modo_fechamento==='split'?'code-branch':'box'}" style="margin-right:4px"></i>${m.modo_fechamento==='split'?'Split':'Pacote'}</span>` : ''}
    </div>

    ${splitBanner}

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:14px">
      <div>
        <div style="font-size:11px;color:var(--text-muted)">RFQ de Origem</div>
        <div style="font-size:13px;font-weight:700;color:#6366f1">${m.rfq_numero||'—'}</div>
        <div style="margin-top:10px;font-size:11px;color:var(--text-muted)">Fornecedor Indicado pela IA</div>
        <div style="font-size:13px;font-weight:700;color:var(--text-primary)">${m.fornecedor_selecionado||'—'}</div>
        <div style="margin-top:4px">${_renderScoreForn(m.fornecedor_selecionado)}</div>
        <div style="margin-top:10px;font-size:11px;color:var(--text-muted)">Valor Total</div>
        <div style="font-size:16px;font-weight:700;color:var(--fa-teal)">${_fmtVal(m.valor_total||m.valor)}</div>
      </div>
      <div>
        <div style="font-size:12px;font-weight:700;color:var(--text-secondary);margin-bottom:8px">APROVAÇÃO DO MAPA</div>
        ${[1,2,3].map(i => {
          const cfgE = i===1?cfg.estagio1:i===2?cfg.estagio2:cfg.estagio3;
          const ap = (m.estagios_aprovacao||[]).find(e=>e.estagio===i);
          const isAtual = (m.estagio_atual||1)===i && m.status==='Aguardando Aprovação';
          const cor = ap ? (ap.status==='Aprovado'?'#22c55e':'#ef4444') : isAtual?'#8b5cf6':'#374151';
          return `<div style="display:flex;align-items:center;gap:8px;padding:8px;border:1px solid ${cor}44;border-radius:8px;margin-bottom:6px;background:${ap?.status==='Aprovado'?'rgba(34,197,94,0.06)':isAtual?'rgba(139,92,246,0.06)':'transparent'}">
            <div style="width:26px;height:26px;background:${cor};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;color:#fff;font-weight:700">${i}</div>
            <div style="flex:1;font-size:12px">
              <div style="font-weight:600">${cfgE?.nome||'Estágio '+i}</div>
              <div style="font-size:11px;color:var(--text-muted)">${ap ? ap.aprovador+' em '+ap.data : isAtual?'⏳ Aguardando...':'Pendente'}</div>
            </div>
            <span style="background:${cor}22;color:${cor};border-radius:6px;padding:2px 7px;font-size:10px;font-weight:700">${ap?.status||isAtual?'Pendente':'—'}</span>
          </div>`;
        }).join('')}
      </div>
    </div>

    ${tabelaForns}

    <!-- Análise da IA em parágrafo -->
    ${m.recomendacao_ia ? `
      <div style="background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.2);border-radius:10px;padding:14px 16px;margin-bottom:10px">
        <div style="font-size:12px;font-weight:700;color:#6366f1;margin-bottom:10px">
          <i class="fas fa-brain" style="margin-right:6px"></i>Análise da IA
        </div>
        <div style="font-size:12px;color:var(--text-secondary);line-height:1.75">${m.recomendacao_ia}</div>
      </div>
    ` : ''}

    ${m.justificativa ? `
      <div style="padding:10px 14px;background:rgba(255,255,255,0.04);border-radius:8px;font-size:12px;color:var(--text-muted)">
        <i class="fas fa-comment" style="margin-right:6px;color:var(--fa-teal)"></i>${m.justificativa}
      </div>
    ` : ''}
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
    <button class="btn btn-secondary" onclick="farcExportarMapaPDF('${m.id}')"><i class="fas fa-file-pdf"></i> PDF</button>
    ${_farcPodeAprovarMapa(m) ? `
      <button class="btn btn-danger" onclick="closeModal();farcReprovarMapa('${m.id}')"><i class="fas fa-times"></i> Reprovar</button>
      <button class="btn btn-success" onclick="farcAprovarMapa('${m.id}')"><i class="fas fa-check"></i> Aprovar Estágio ${m.estagio_atual||1}</button>
    ` : ''}
    ${m.status === 'Aprovado' && ['admin','compras','diretor'].includes(currentUser?.profile||'') ? `
      <button class="btn btn-primary" onclick="closeModal();farcEmitirPedido('${m.id}')"><i class="fas fa-shopping-bag"></i> Emitir Pedido</button>
    ` : ''}
  `);
}

function _farcRenderMapaBadge(s) {
  const m = { 'Aguardando Aprovação':'#8b5cf6','Aprovado':'#22c55e','PC Emitido':'#10b981','Reprovado':'#ef4444','Rejeitado':'#ef4444' };
  const c = m[s]||'#8b949e';
  return `<span style="background:${c}22;color:${c};border-radius:6px;padding:3px 8px;font-size:11px;font-weight:700">${s}</span>`;
}

// Aprovar mapa
function farcAprovarMapa(mapaId) {
  if (typeof aprovarMapa2 === 'function') { aprovarMapa2(mapaId); return; }
  const mapas = typeof _getMapasComp === 'function' ? _getMapasComp() : [];
  const m = mapas.find(x => x.id === mapaId);
  if (!m) return;
  const cfg = _getConfigAprovacao();
  const est = m.estagio_atual || 1;
  const nomeEst = est===1?cfg.estagio1?.nome:est===2?cfg.estagio2?.nome:cfg.estagio3?.nome;

  openModal(`Aprovar Mapa Comparativo (${nomeEst||'Estágio '+est})`, `
    <div style="margin-bottom:12px;font-size:13px;color:var(--text-secondary)">
      Você está aprovando o <strong>Estágio ${est}</strong> do mapa comparativo <strong>${m.numero}</strong>.<br>
      Fornecedor indicado: <strong style="color:var(--fa-teal)">${m.fornecedor_selecionado||'—'}</strong><br>
      Score: ${_renderScoreForn(m.fornecedor_selecionado)}
    </div>
    <div>
      <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Observação (opcional)</label>
      <textarea id="obs_aprov_mapa_farc" rows="2" style="width:100%;padding:8px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:6px;color:var(--text-primary);font-size:12px;box-sizing:border-box;resize:vertical"></textarea>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-success" onclick="_farcConfirmarAprovarMapa('${mapaId}')"><i class="fas fa-check"></i> Confirmar Aprovação</button>
  `);
}

function _farcConfirmarAprovarMapa(mapaId) {
  const mapas = typeof _getMapasComp === 'function' ? _getMapasComp() : [];
  const idx   = mapas.findIndex(x => x.id === mapaId);
  if (idx < 0) return;
  const m    = mapas[idx];
  const est  = m.estagio_atual || 1;
  const obs  = document.getElementById('obs_aprov_mapa_farc')?.value.trim() || '';
  const hoje = new Date().toLocaleString('pt-BR');

  if (!m.estagios_aprovacao) m.estagios_aprovacao = [];
  m.estagios_aprovacao.push({ estagio: est, status: 'Aprovado', aprovador: currentUser?.name, data: hoje, obs });
  m.historico = m.historico || [];
  m.historico.unshift({ acao: `Estágio ${est} aprovado por ${currentUser?.name}`, usuario: currentUser?.name, data: hoje });

  if (est >= (m.total_estagios||3)) {
    m.status = 'Aprovado';
    m.estagio_atual = 4;
    m.historico.unshift({ acao: 'Mapa totalmente aprovado – Aguardando emissão de Pedido de Compra', usuario: currentUser?.name, data: hoje });
    showToast(`✅ Mapa ${m.numero} aprovado! Comprador pode emitir o Pedido de Compra.`, 'success', 5000);
    logAction && logAction('Aprovação Mapa', 'Compras', `Mapa ${m.numero} aprovado`);
  } else {
    m.estagio_atual = est + 1;
    showToast(`Estágio ${est} aprovado! Avançando para Estágio ${est+1}.`, 'success');
    logAction && logAction('Aprovação Estágio Mapa', 'Compras', `Mapa ${m.numero} Estágio ${est} aprovado`);
  }

  mapas[idx] = m;
  if (typeof _saveMapasComp === 'function') _saveMapasComp(mapas);
  closeModal();
  farcSwitchTab('mapa');
}

function farcReprovarMapa(mapaId) {
  openModal('Reprovar Mapa Comparativo', `
    <div style="font-size:13px;color:var(--text-secondary);margin-bottom:12px">
      Informe o motivo da reprovação. O processo retornará para revisão.
    </div>
    <textarea id="motivo_reprov_mapa_farc" rows="3" placeholder="Motivo da reprovação..." style="width:100%;padding:8px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:6px;color:var(--text-primary);font-size:13px;box-sizing:border-box;resize:vertical"></textarea>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-danger" onclick="_farcConfirmarReprovarMapa('${mapaId}')"><i class="fas fa-times"></i> Reprovar</button>
  `);
}

function _farcConfirmarReprovarMapa(mapaId) {
  const motivo = document.getElementById('motivo_reprov_mapa_farc')?.value.trim() || 'Sem motivo';
  const mapas = typeof _getMapasComp === 'function' ? _getMapasComp() : [];
  const idx   = mapas.findIndex(x => x.id === mapaId);
  if (idx < 0) return;
  const hoje = new Date().toLocaleString('pt-BR');
  mapas[idx].status = 'Reprovado';
  mapas[idx].motivo_reprovacao = motivo;
  mapas[idx].historico = mapas[idx].historico || [];
  mapas[idx].historico.unshift({ acao: `Reprovado por ${currentUser?.name}: ${motivo}`, usuario: currentUser?.name, data: hoje });
  if (typeof _saveMapasComp === 'function') _saveMapasComp(mapas);
  logAction && logAction('Reprovação Mapa', 'Compras', `Mapa ${mapas[idx].numero}: ${motivo}`);
  closeModal();
  showToast('Mapa reprovado. Cotação deverá ser revisada.', 'warning');
  farcSwitchTab('mapa');
}

// Exportar mapa PDF
function farcExportarMapaPDF(mapaId) {
  if (typeof exportarMapaPDF2 === 'function') { exportarMapaPDF2(mapaId); return; }
  const m = (typeof _getMapasComp === 'function' ? _getMapasComp() : []).find(x => x.id === mapaId);
  if (!m) return;
  const rfq = (typeof _getRFQFlow === 'function' ? _getRFQFlow() : []).find(r => r.id === m.rfq_id || r.numero === m.rfq_numero);
  const score = _getScoreFornecedor(m.fornecedor_selecionado);

  const html = `
    <!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
    <title>Mapa Comparativo ${m.numero}</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 12px; color: #333; margin: 20px; }
      h1 { color: #0d6efd; border-bottom: 2px solid #0d6efd; padding-bottom: 8px; }
      h2 { color: #333; font-size: 14px; }
      table { width: 100%; border-collapse: collapse; margin: 12px 0; }
      th { background: #0d6efd; color: #fff; padding: 8px; text-align: left; font-size: 11px; }
      td { padding: 7px 8px; border-bottom: 1px solid #ddd; }
      .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; }
      .badge-green { background: #d4edda; color: #155724; }
      .badge-blue { background: #cce5ff; color: #004085; }
      .info { background: #f8f9fa; border: 1px solid #dee2e6; padding: 10px; border-radius: 6px; margin: 10px 0; }
      .footer { margin-top: 30px; font-size: 10px; color: #888; border-top: 1px solid #ddd; padding-top: 10px; }
    </style></head><body>
    <h1>Mapa Comparativo de Propostas</h1>
    <div class="info">
      <strong>${m.numero}</strong> – RFQ: ${m.rfq_numero||'—'} | Gerado em: ${new Date().toLocaleDateString('pt-BR')}
    </div>
    <h2>Fornecedor Indicado</h2>
    <table>
      <tr><th>Fornecedor</th><th>Critério</th><th>Valor Total</th><th>Score Avaliação</th></tr>
      <tr>
        <td>${m.fornecedor_selecionado||'—'}</td>
        <td>${m.criterio||'—'}</td>
        <td><strong>${_fmtVal(m.valor_total||m.valor)}</strong></td>
        <td>${score ? score.media+'/5 ('+score.total+' aval.)' : 'Não avaliado'}</td>
      </tr>
    </table>
    ${m.justificativa ? `<h2>Justificativa</h2><p>${m.justificativa}</p>` : ''}
    ${rfq && rfq.cotacoes?.length ? `
      <h2>Comparativo de Propostas</h2>
      <table>
        <tr><th>Fornecedor</th><th>Score</th>${(rfq.itens||[]).map(it=>`<th>${it.descricao}</th>`).join('')}<th>Total</th><th>Prazo</th><th>Cond. Pagto.</th></tr>
        ${rfq.cotacoes.map(cot => {
          const sc = _getScoreFornecedor(cot.fornecedor);
          return `<tr>
            <td>${cot.fornecedor}</td>
            <td>${sc ? sc.media+'/5' : 'Não avaliado'}</td>
            ${(cot.itens||[]).map(ci => `<td>${_fmtVal(ci.preco||0)}</td>`).join('')}
            <td><strong>${_fmtVal(cot.itens?.reduce((a,i)=>a+(i.total||0),0)||0)}</strong></td>
            <td>${cot.prazo_entrega||'—'}</td>
            <td>${cot.condicao_pagamento||'—'}</td>
          </tr>`;
        }).join('')}
      </table>
    ` : ''}
    <div class="footer">Fraser Alexander ERP – Documento gerado em ${new Date().toLocaleString('pt-BR')}</div>
    </body></html>
  `;

  const janela = window.open('', '_blank');
  if (janela) { janela.document.write(html); janela.document.close(); janela.print(); }
}

// ════════════════════════════════════════════════════════════════════════════
// ABA 5 – PEDIDOS DE COMPRA  (v3.0 – completo)
// ════════════════════════════════════════════════════════════════════════════
function _farcRenderTabPedidos() {
  const pedidos   = typeof _getPedidos   === 'function' ? _getPedidos()   : [];
  const isCompras = currentUser && ['admin','compras','diretor'].includes(currentUser.profile);

  // contadores por status
  const cEmitido    = pedidos.filter(p => p.status === 'Emitido').length;
  const cAguardEnv  = pedidos.filter(p => p.status === 'Aguardando Envio').length;
  const cEnviado    = pedidos.filter(p => p.status === 'Enviado ao Fornecedor').length;
  const cEntregue   = pedidos.filter(p => ['Entregue','Concluído'].includes(p.status)).length;
  const cCancelado  = pedidos.filter(p => p.status === 'Cancelado').length;
  const totalValor  = pedidos.reduce((a,p) => a + (p.valor_total||0), 0);

  // Pedidos com prazo vencido (não entregues/cancelados)
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const vencidos = pedidos.filter(p => {
    if (['Entregue','Concluído','Cancelado'].includes(p.status)) return false;
    if (!p.prazo_entrega) return false;
    const partes = p.prazo_entrega.split('/');
    if (partes.length < 3) return false;
    const d = new Date(partes[2], partes[1]-1, partes[0]); d.setHours(0,0,0,0);
    return d < hoje;
  });

  // Pedidos enviados há mais de 3 dias sem confirmação de entrega
  const aguardandoConf = pedidos.filter(p => {
    if (p.status !== 'Enviado ao Fornecedor') return false;
    if (!p.envio_data) return false;
    const partes = p.envio_data.split('/');
    if (partes.length < 3) return false;
    const dEnvio = new Date(partes[2], partes[1]-1, partes[0]);
    return (Date.now() - dEnvio.getTime()) > 3 * 86400000;
  });

  return `
    <div style="padding:16px">

      <!-- ── ALERTAS ───────────────────────────────────────────────────── -->
      ${vencidos.length > 0 ? `
        <div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.3);border-radius:10px;
          padding:10px 14px;margin-bottom:14px;display:flex;align-items:center;gap:10px">
          <i class="fas fa-exclamation-triangle" style="color:#ef4444;font-size:18px;flex-shrink:0"></i>
          <div style="flex:1">
            <div style="font-size:12px;font-weight:700;color:#ef4444">
              ${vencidos.length} pedido${vencidos.length>1?'s':''} com prazo vencido!
            </div>
            <div style="font-size:11px;color:var(--text-secondary);margin-top:2px">
              ${vencidos.map(p => `<span onclick="_farcFiltrarPedidosId('${p.id}')" style="cursor:pointer;color:#ef4444;font-weight:600;margin-right:8px;text-decoration:underline">${p.numero}</span>`).join('')}
            </div>
          </div>
          <button onclick="_farcFiltrarPedidosVencidos()" class="btn btn-sm"
            style="background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.35);color:#ef4444;white-space:nowrap;font-size:11px">
            Ver todos
          </button>
        </div>
      ` : ''}

      ${aguardandoConf.length > 0 ? `
        <div style="background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.3);border-radius:10px;
          padding:10px 14px;margin-bottom:14px;display:flex;align-items:center;gap:10px">
          <i class="fas fa-clock" style="color:#6366f1;font-size:18px;flex-shrink:0"></i>
          <div style="flex:1">
            <div style="font-size:12px;font-weight:700;color:#6366f1">
              ${aguardandoConf.length} pedido${aguardandoConf.length>1?'s':''} enviado${aguardandoConf.length>1?'s':''} aguardando confirmação de entrega
            </div>
            <div style="font-size:11px;color:var(--text-secondary);margin-top:2px">
              ${aguardandoConf.map(p => `<span style="color:#6366f1;font-weight:600;margin-right:8px">${p.numero} – ${p.fornecedor||''}</span>`).join('')}
            </div>
          </div>
        </div>
      ` : ''}

      <!-- ── PIPELINE VISUAL ───────────────────────────────────────────── -->
      <div style="display:flex;gap:0;margin-bottom:20px;overflow-x:auto">
        ${[
          { label:'Emitido',              icon:'file-invoice',    color:'#3b82f6', n: cEmitido,   status:'Emitido'                   },
          { label:'Aguard. Envio',        icon:'clock',           color:'#f59e0b', n: cAguardEnv, status:'Aguardando Envio'           },
          { label:'Enviado Fornecedor',   icon:'paper-plane',     color:'#6366f1', n: cEnviado,   status:'Enviado ao Fornecedor'      },
          { label:'Entregue/Concluído',   icon:'check-double',    color:'#22c55e', n: cEntregue,  status:'Entregue'                   },
          { label:'Cancelado',            icon:'times-circle',    color:'#ef4444', n: cCancelado, status:'Cancelado'                  },
        ].map((st, i, arr) => `
          <div style="flex:1;min-width:130px;display:flex;align-items:center">
            <div onclick="_farcFiltrarPedidosPorStatus('${st.status}')"
              style="flex:1;background:${st.n>0?st.color+'18':'rgba(255,255,255,0.03)'};
                border:1.5px solid ${st.n>0?st.color+'55':'var(--border-color)'};
                border-radius:10px;padding:12px 10px;text-align:center;cursor:pointer;transition:all .2s"
              onmouseover="this.style.background='${st.color}28'" onmouseout="this.style.background='${st.n>0?st.color+'18':'rgba(255,255,255,0.03)'}'">
              <i class="fas fa-${st.icon}" style="color:${st.color};font-size:18px;margin-bottom:6px;display:block"></i>
              <div style="font-size:22px;font-weight:800;color:${st.color};line-height:1">${st.n}</div>
              <div style="font-size:10px;color:var(--text-muted);margin-top:3px">${st.label}</div>
            </div>
            ${i < arr.length-1 ? `<div style="width:18px;min-width:18px;display:flex;align-items:center;justify-content:center"><i class="fas fa-chevron-right" style="color:var(--border-color);font-size:10px"></i></div>` : ''}
          </div>
        `).join('')}
      </div>

      <!-- ── KPIs ──────────────────────────────────────────────────────── -->
      <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
        <div class="kpi-card kpi-blue">
          <div class="kpi-icon"><i class="fas fa-shopping-bag"></i></div>
          <div class="kpi-value">${pedidos.length}</div>
          <div class="kpi-label">Total de Pedidos</div>
        </div>
        <div class="kpi-card kpi-orange">
          <div class="kpi-icon"><i class="fas fa-hourglass-half"></i></div>
          <div class="kpi-value">${cEmitido + cAguardEnv}</div>
          <div class="kpi-label">Pendentes de Envio</div>
        </div>
        <div class="kpi-card kpi-green">
          <div class="kpi-icon"><i class="fas fa-check-circle"></i></div>
          <div class="kpi-value">${cEntregue}</div>
          <div class="kpi-label">Concluídos</div>
        </div>
        <div class="kpi-card kpi-teal">
          <div class="kpi-icon"><i class="fas fa-dollar-sign"></i></div>
          <div class="kpi-value">${_fmtVal(totalValor)}</div>
          <div class="kpi-label">Volume Total em POs</div>
        </div>
      </div>

      <!-- ── TOOLBAR ───────────────────────────────────────────────────── -->
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;flex-wrap:wrap">
        <div style="position:relative;flex:1;min-width:200px">
          <i class="fas fa-search" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:12px"></i>
          <input type="text" id="farc_search_ped"
            placeholder="Buscar por número, fornecedor, mapa, RC..."
            oninput="_farcFiltrarPedidos()"
            style="width:100%;padding:7px 12px 7px 32px;background:var(--bg-secondary);
              border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:12px">
        </div>
        <select id="farc_fil_ped_status" onchange="_farcFiltrarPedidos()"
          style="padding:7px 10px;background:var(--bg-secondary);border:1px solid var(--border-color);
            border-radius:8px;color:var(--text-secondary);font-size:12px;min-width:160px">
          <option value="">Todos os Status</option>
          <option>Emitido</option>
          <option>Aguardando Envio</option>
          <option>Enviado ao Fornecedor</option>
          <option>Entregue</option>
          <option>Concluído</option>
          <option>Cancelado</option>
        </select>
        <select id="farc_fil_ped_periodo" onchange="_farcFiltrarPedidos()"
          style="padding:7px 10px;background:var(--bg-secondary);border:1px solid var(--border-color);
            border-radius:8px;color:var(--text-secondary);font-size:12px;min-width:130px">
          <option value="">Todos os períodos</option>
          <option value="7">Últimos 7 dias</option>
          <option value="30">Últimos 30 dias</option>
          <option value="90">Últimos 90 dias</option>
        </select>
        <div style="display:flex;gap:6px;flex-shrink:0">
          <button onclick="_farcExportarPedidos()" class="btn btn-secondary btn-sm" title="Exportar CSV">
            <i class="fas fa-file-excel"></i> Exportar
          </button>
          ${isCompras ? `
            <button onclick="farcNovoMapa()" class="btn btn-secondary btn-sm" title="Ir para Mapas para emitir novo pedido">
              <i class="fas fa-balance-scale"></i> Emitir do Mapa
            </button>
          ` : ''}
        </div>
      </div>

      <!-- ── TABELA ─────────────────────────────────────────────────────── -->
      <div id="farc_tabela_ped">${_farcTabelaPedidos(pedidos, isCompras)}</div>
    </div>
  `;
}

// ─── BADGE STATUS PEDIDO ─────────────────────────────────────────────────────
function _farcPedidoBadge(s) {
  const map = {
    'Emitido':               { c:'#3b82f6', icon:'file-invoice'  },
    'Aguardando Envio':      { c:'#f59e0b', icon:'clock'         },
    'Enviado ao Fornecedor': { c:'#6366f1', icon:'paper-plane'   },
    'Entregue':              { c:'#22c55e', icon:'box-open'      },
    'Concluído':             { c:'#10b981', icon:'check-double'  },
    'Cancelado':             { c:'#ef4444', icon:'times-circle'  },
  };
  const cfg = map[s] || { c:'#8b949e', icon:'circle' };
  return `<span style="background:${cfg.c}22;color:${cfg.c};border-radius:6px;padding:3px 8px;font-size:10px;font-weight:700;white-space:nowrap">
    <i class="fas fa-${cfg.icon}" style="margin-right:3px;font-size:9px"></i>${s}
  </span>`;
}

// ─── INDICADOR DE ENVIO ──────────────────────────────────────────────────────
function _farcEnvioBadge(p) {
  if (p.envio_agendado && p.status !== 'Enviado ao Fornecedor') {
    return `<span style="background:rgba(251,191,36,0.12);color:#f59e0b;border-radius:5px;padding:2px 6px;font-size:10px">
      <i class="fas fa-calendar-alt" style="margin-right:3px"></i>Agendado ${p.envio_data||''}
    </span>`;
  }
  if (p.status === 'Enviado ao Fornecedor') {
    return `<span style="background:rgba(99,102,241,0.12);color:#6366f1;border-radius:5px;padding:2px 6px;font-size:10px">
      <i class="fas fa-check" style="margin-right:3px"></i>Enviado ${p.envio_data||''}
    </span>`;
  }
  return '';
}

// ─── TABELA PRINCIPAL ────────────────────────────────────────────────────────
function _farcTabelaPedidos(lista, isCompras) {
  if (!lista || !lista.length) return `
    <div style="text-align:center;padding:60px 20px;color:var(--text-muted)">
      <i class="fas fa-shopping-bag" style="font-size:40px;display:block;margin-bottom:14px;opacity:.35"></i>
      <div style="font-size:14px;font-weight:600">Nenhum pedido de compra encontrado</div>
      <div style="font-size:12px;margin-top:6px">Os pedidos são gerados a partir de Mapas Comparativos aprovados.</div>
    </div>`;

  isCompras = isCompras !== undefined ? isCompras
    : (currentUser && ['admin','compras','diretor'].includes(currentUser.profile));

  const hoje = new Date(); hoje.setHours(0,0,0,0);

  return `
    <div style="overflow-x:auto;border-radius:10px;border:1px solid var(--border-color)">
      <table style="width:100%;border-collapse:collapse;font-size:12px;min-width:900px" id="tbl_pedidos_main">
        <thead>
          <tr style="background:var(--bg-tertiary)">
            <th style="padding:10px 8px;width:28px"></th>
            <th style="padding:10px 12px;text-align:left;font-size:10px;color:var(--text-muted);font-weight:700;text-transform:uppercase;letter-spacing:.4px">Pedido</th>
            <th style="padding:10px 12px;text-align:left;font-size:10px;color:var(--text-muted);font-weight:700;text-transform:uppercase;letter-spacing:.4px">Fornecedor</th>
            <th style="padding:10px 12px;text-align:left;font-size:10px;color:var(--text-muted);font-weight:700;text-transform:uppercase;letter-spacing:.4px">Referências</th>
            <th style="padding:10px 12px;text-align:center;font-size:10px;color:var(--text-muted);font-weight:700;text-transform:uppercase;letter-spacing:.4px">Itens</th>
            <th style="padding:10px 12px;text-align:right;font-size:10px;color:var(--text-muted);font-weight:700;text-transform:uppercase;letter-spacing:.4px">Valor Total</th>
            <th style="padding:10px 12px;text-align:center;font-size:10px;color:var(--text-muted);font-weight:700;text-transform:uppercase;letter-spacing:.4px">Prazo</th>
            <th style="padding:10px 12px;text-align:center;font-size:10px;color:var(--text-muted);font-weight:700;text-transform:uppercase;letter-spacing:.4px">Status</th>
            <th style="padding:10px 12px;text-align:center;font-size:10px;color:var(--text-muted);font-weight:700;text-transform:uppercase;letter-spacing:.4px">Envio</th>
            <th style="padding:10px 12px;text-align:center;font-size:10px;color:var(--text-muted);font-weight:700;text-transform:uppercase;letter-spacing:.4px">Ações</th>
          </tr>
        </thead>
        <tbody>
          ${lista.map((p, idx) => {
            // Calcula se está vencido
            let vencido = false;
            if (p.prazo_entrega && !['Entregue','Concluído','Cancelado'].includes(p.status)) {
              const partes = p.prazo_entrega.split('/');
              if (partes.length === 3) {
                const d = new Date(partes[2], partes[1]-1, partes[0]); d.setHours(0,0,0,0);
                vencido = d < hoje;
              }
            }
            const rowBg = idx % 2 === 0 ? '' : 'background:rgba(255,255,255,0.015)';
            const vencBorder = vencido ? 'border-left:3px solid #ef4444' : '';

            return `
            <!-- LINHA PRINCIPAL -->
            <tr id="ped_row_${p.id}" style="border-bottom:1px solid var(--border-color);${rowBg};${vencBorder};transition:background .15s;cursor:pointer"
              onmouseover="this.style.background='rgba(0,180,184,0.04)'"
              onmouseout="this.style.background='${idx%2===0?'transparent':'rgba(255,255,255,0.015)'}'">

              <!-- Expand toggle -->
              <td style="padding:10px 8px;text-align:center" onclick="_farcToggleDetalhesPedido('${p.id}')">
                <i id="ped_expand_icon_${p.id}" class="fas fa-chevron-right"
                  style="color:var(--text-muted);font-size:10px;transition:transform .2s"></i>
              </td>

              <!-- Número + data -->
              <td style="padding:10px 12px" onclick="_farcToggleDetalhesPedido('${p.id}')">
                <div style="font-weight:700;color:#22c55e;font-size:13px">${p.numero||p.id}</div>
                <div style="font-size:10px;color:var(--text-muted);margin-top:2px">${_fmtDate2(p.data_emissao)}</div>
                ${vencido ? `<div style="font-size:10px;color:#ef4444;font-weight:600;margin-top:2px"><i class="fas fa-exclamation-triangle" style="margin-right:2px"></i>VENCIDO</div>` : ''}
              </td>

              <!-- Fornecedor + score -->
              <td style="padding:10px 12px;max-width:180px" onclick="_farcToggleDetalhesPedido('${p.id}')">
                <div style="font-weight:600;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.fornecedor||'—'}</div>
                <div style="margin-top:3px">${_renderScoreForn(p.fornecedor)}</div>
              </td>

              <!-- Referências -->
              <td style="padding:10px 12px" onclick="_farcToggleDetalhesPedido('${p.id}')">
                ${p.mapa_numero ? `<div style="font-size:11px"><span style="color:var(--text-muted)">Mapa:</span> <span style="color:#8b5cf6;font-weight:600">${p.mapa_numero}</span></div>` : ''}
                ${p.rfq_numero  ? `<div style="font-size:11px"><span style="color:var(--text-muted)">RFQ:</span> <span style="color:#6366f1">${p.rfq_numero}</span></div>` : ''}
                ${p.rc_numero   ? `<div style="font-size:11px"><span style="color:var(--text-muted)">RC:</span> <span style="color:var(--fa-teal)">${p.rc_numero}</span></div>` : ''}
                ${!p.mapa_numero && !p.rfq_numero && !p.rc_numero ? `<span style="font-size:10px;color:var(--text-muted)">—</span>` : ''}
              </td>

              <!-- Itens -->
              <td style="padding:10px 12px;text-align:center" onclick="_farcToggleDetalhesPedido('${p.id}')">
                <span style="background:rgba(0,180,184,0.1);color:var(--fa-teal);border-radius:20px;padding:2px 8px;font-size:11px;font-weight:700">${p.itens?.length||0}</span>
              </td>

              <!-- Valor -->
              <td style="padding:10px 12px;text-align:right" onclick="_farcToggleDetalhesPedido('${p.id}')">
                <div style="font-weight:700;color:var(--fa-teal);font-size:13px">${_fmtVal(p.valor_total)}</div>
                ${p.condicao_pagamento ? `<div style="font-size:10px;color:var(--text-muted)">${p.condicao_pagamento}</div>` : ''}
              </td>

              <!-- Prazo -->
              <td style="padding:10px 12px;text-align:center" onclick="_farcToggleDetalhesPedido('${p.id}')">
                <div style="font-size:12px;color:${vencido?'#ef4444':'var(--text-secondary)'};font-weight:${vencido?700:400}">
                  ${p.prazo_entrega||'—'}
                </div>
                ${p.local_entrega ? `<div style="font-size:10px;color:var(--text-muted);max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.local_entrega}</div>` : ''}
              </td>

              <!-- Status -->
              <td style="padding:10px 12px;text-align:center">${_farcPedidoBadge(p.status)}</td>

              <!-- Envio -->
              <td style="padding:10px 12px;text-align:center">
                ${_farcEnvioBadge(p)}
                ${!p.envio_agendado && p.status !== 'Enviado ao Fornecedor' && !['Entregue','Concluído','Cancelado'].includes(p.status) && isCompras
                  ? `<span style="font-size:10px;color:var(--text-muted)">Não agendado</span>`
                  : ''}
              </td>

              <!-- Ações -->
              <td style="padding:10px 12px;text-align:center">
                <div style="display:flex;gap:4px;justify-content:center;flex-wrap:wrap">
                  <button onclick="event.stopPropagation();farcVerProcessoCompleto('${p.id}')"
                    class="btn btn-secondary btn-sm btn-icon"
                    title="Ver processo completo (OS → RC → RFQ → Mapa → PO)">
                    <i class="fas fa-project-diagram"></i>
                  </button>
                  ${isCompras && !['Entregue','Concluído','Cancelado'].includes(p.status) ? `
                    <button onclick="event.stopPropagation();farcEditarPedido('${p.id}')"
                      class="btn btn-warning btn-sm btn-icon" title="Editar pedido">
                      <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="event.stopPropagation();farcAgendarEnvio('${p.id}')"
                      class="btn btn-info btn-sm btn-icon"
                      style="background:rgba(99,102,241,0.15);border-color:rgba(99,102,241,0.3);color:#6366f1"
                      title="Programar envio ao fornecedor">
                      <i class="fas fa-paper-plane"></i>
                    </button>
                  ` : ''}
                  ${isCompras && p.status === 'Enviado ao Fornecedor' ? `
                    <button onclick="event.stopPropagation();farcRegistrarEntrega('${p.id}')"
                      class="btn btn-success btn-sm btn-icon" title="Registrar entrega">
                      <i class="fas fa-box-open"></i>
                    </button>
                  ` : ''}
                  ${isCompras && !['Entregue','Concluído','Cancelado'].includes(p.status) ? `
                    <button onclick="event.stopPropagation();farcCancelarPedido('${p.id}')"
                      class="btn btn-danger btn-sm btn-icon" title="Cancelar pedido"
                      style="background:rgba(239,68,68,0.12);border-color:rgba(239,68,68,0.3);color:#ef4444">
                      <i class="fas fa-times"></i>
                    </button>
                  ` : ''}
                  <button onclick="event.stopPropagation();farcExportarPedidoPDF('${p.id}')"
                    class="btn btn-secondary btn-sm btn-icon" title="Exportar PDF">
                    <i class="fas fa-file-pdf" style="color:#ef4444"></i>
                  </button>
                  ${(p.supplier||p.fornecedor||p.supplier_id) ? `
                  <button onclick="event.stopPropagation();farcAuditarFornecedor('${p.supplier_id||p.fornecedor_id||p.supplier||p.fornecedor||''}')"
                    class="btn btn-secondary btn-sm btn-icon" title="Auditar Fornecedor" style="color:#8b5cf6">
                    <i class="fas fa-shield-alt"></i>
                  </button>` : ''}
                </div>
              </td>
            </tr>

            <!-- LINHA DE DETALHES EXPANDIDA (oculta por padrão) -->
            <tr id="ped_details_${p.id}" style="display:none;background:var(--bg-secondary)">
              <td colspan="10" style="padding:0">
                <div style="padding:16px 20px;border-top:1px solid var(--border-color);border-left:3px solid var(--fa-teal)">
                  ${_farcDetalhesInlinePedido(p, isCompras)}
                </div>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>

    <!-- Rodapé com totais -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;font-size:11px;color:var(--text-muted)">
      <span>${lista.length} pedido${lista.length!==1?'s':''} exibido${lista.length!==1?'s':''}</span>
      <span>Valor total exibido: <strong style="color:var(--fa-teal)">${_fmtVal(lista.reduce((a,p)=>a+(p.valor_total||0),0))}</strong></span>
    </div>
  `;
}

// ─── DETALHES INLINE (linha expandida na tabela) ──────────────────────────────
function _farcDetalhesInlinePedido(p, isCompras) {
  const statusPipeline = [
    { s:'Emitido',              c:'#3b82f6', icon:'file-invoice',  ok: true },
    { s:'Aguardando Envio',     c:'#f59e0b', icon:'clock',          ok: ['Aguardando Envio','Enviado ao Fornecedor','Entregue','Concluído'].includes(p.status) },
    { s:'Enviado Fornecedor',   c:'#6366f1', icon:'paper-plane',    ok: ['Enviado ao Fornecedor','Entregue','Concluído'].includes(p.status) },
    { s:'Entregue/Concluído',   c:'#22c55e', icon:'check-double',   ok: ['Entregue','Concluído'].includes(p.status) },
  ];

  return `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px">

      <!-- COLUNA 1: Pipeline de status + info -->
      <div>
        <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">
          <i class="fas fa-route" style="margin-right:5px;color:var(--fa-teal)"></i>Progressão do Pedido
        </div>
        <div style="display:flex;align-items:center;gap:4px;margin-bottom:12px">
          ${statusPipeline.map((st, i, arr) => `
            <div style="display:flex;align-items:center;gap:3px">
              <div title="${st.s}" style="width:30px;height:30px;border-radius:50%;
                background:${st.ok ? st.c+'20' : 'rgba(255,255,255,0.04)'};
                border:2px solid ${st.ok ? st.c : 'var(--border-color)'};
                display:flex;align-items:center;justify-content:center"
                ${p.status === st.s ? 'style="box-shadow:0 0 0 3px '+st.c+'30"' : ''}>
                <i class="fas fa-${st.icon}" style="color:${st.ok ? st.c : 'var(--text-muted)'};font-size:11px"></i>
              </div>
              ${i < arr.length-1 ? `<div style="width:12px;height:2px;background:${st.ok?'var(--fa-teal)':'var(--border-color)'}"></div>` : ''}
            </div>
          `).join('')}
        </div>
        <div style="font-size:11px;color:var(--text-secondary)">
          ${p.status === 'Cancelado' ? `<div style="color:#ef4444;font-weight:600"><i class="fas fa-times-circle" style="margin-right:5px"></i>CANCELADO${p.motivo_cancelamento ? ' – '+p.motivo_cancelamento : ''}</div>` : ''}
          ${p.data_entrega ? `<div><i class="fas fa-box-open" style="color:#22c55e;margin-right:5px"></i>Entregue em ${p.data_entrega}${p.recebido_por ? ' por '+p.recebido_por : ''}</div>` : ''}
          <div style="margin-top:6px;font-size:10px;color:var(--text-muted)">
            <i class="fas fa-user" style="margin-right:4px"></i>Emitido por ${p.emitido_por||'—'} em ${_fmtDate2(p.data_emissao)}
          </div>
        </div>

        <!-- Dados do envio -->
        ${p.envio_log && p.envio_log.length ? `
          <div style="margin-top:12px;font-size:10px;color:var(--text-muted);font-weight:700;text-transform:uppercase;margin-bottom:4px">
            <i class="fas fa-paper-plane" style="color:#6366f1;margin-right:4px"></i>Registro de Envios
          </div>
          ${p.envio_log.slice(0,3).map(e => `
            <div style="font-size:11px;color:var(--text-secondary);padding:3px 0;border-bottom:1px solid var(--border-color)">
              <i class="fas fa-circle" style="color:#6366f1;font-size:5px;margin-right:5px"></i>${e.descricao||e.canal||''} <span style="color:var(--text-muted)">${e.data||''}</span>
            </div>
          `).join('')}
        ` : ''}
      </div>

      <!-- COLUNA 2: Itens do pedido -->
      <div>
        <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">
          <i class="fas fa-list" style="margin-right:5px;color:var(--orange)"></i>Itens do Pedido (${p.itens?.length||0})
        </div>
        ${(p.itens||[]).length ? `
          <div style="border:1px solid var(--border-color);border-radius:8px;overflow:hidden">
            ${(p.itens||[]).slice(0,5).map((it, i) => `
              <div style="display:flex;align-items:center;padding:6px 10px;${i>0?'border-top:1px solid var(--border-color)':''};font-size:11px">
                <div style="flex:1;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${it.descricao||''}">${it.descricao||'—'}</div>
                <div style="color:var(--text-muted);margin:0 8px;white-space:nowrap">${it.qtd||1} ${it.unidade||'Un'}</div>
                <div style="color:var(--fa-teal);font-weight:600;white-space:nowrap">${_fmtVal(it.total||0)}</div>
              </div>
            `).join('')}
            ${(p.itens||[]).length > 5 ? `
              <div style="padding:5px 10px;font-size:10px;color:var(--text-muted);text-align:center;border-top:1px solid var(--border-color)">
                +${p.itens.length - 5} item(ns)... <span onclick="farcVerPedido('${p.id}')" style="color:var(--fa-teal);cursor:pointer;text-decoration:underline">Ver todos</span>
              </div>
            ` : ''}
            <div style="padding:7px 10px;border-top:1px solid var(--border-color);display:flex;justify-content:space-between;background:rgba(0,180,184,0.06)">
              <span style="font-size:11px;font-weight:700;color:var(--text-secondary)">TOTAL</span>
              <span style="font-size:13px;font-weight:700;color:var(--fa-teal)">${_fmtVal(p.valor_total)}</span>
            </div>
          </div>
        ` : `<div style="font-size:11px;color:var(--text-muted);font-style:italic">Nenhum item registrado</div>`}

        ${p.observacoes ? `
          <div style="margin-top:8px;padding:8px;background:rgba(255,255,255,0.04);border-radius:6px;font-size:11px;color:var(--text-secondary)">
            <i class="fas fa-comment" style="color:var(--fa-teal);margin-right:5px"></i>${p.observacoes}
          </div>
        ` : ''}
      </div>

      <!-- COLUNA 3: Histórico -->
      <div>
        <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">
          <i class="fas fa-history" style="margin-right:5px;color:var(--fa-teal)"></i>Histórico
        </div>
        ${(p.historico||[]).length ? `
          <div style="border:1px solid var(--border-color);border-radius:8px;overflow:hidden;max-height:180px;overflow-y:auto">
            ${(p.historico||[]).slice(0,8).map((h,i) => `
              <div style="padding:6px 10px;${i>0?'border-top:1px solid var(--border-color)':''}">
                <div style="font-size:11px;color:var(--text-secondary)">${h.acao||''}</div>
                <div style="font-size:10px;color:var(--text-muted);margin-top:1px">${h.usuario||''} · ${h.data||''}</div>
              </div>
            `).join('')}
          </div>
        ` : `<div style="font-size:11px;color:var(--text-muted);font-style:italic">Sem histórico registrado</div>`}

        <!-- Ações rápidas no painel inline -->
        <div style="display:flex;gap:6px;margin-top:12px;flex-wrap:wrap">
          <button onclick="farcVerPedido('${p.id}')" class="btn btn-secondary btn-sm" style="font-size:11px">
            <i class="fas fa-eye"></i> Detalhes
          </button>
          ${isCompras && !['Entregue','Concluído','Cancelado'].includes(p.status) ? `
            <button onclick="farcEditarPedido('${p.id}')" class="btn btn-warning btn-sm" style="font-size:11px">
              <i class="fas fa-edit"></i> Editar
            </button>
            <button onclick="farcAgendarEnvio('${p.id}')" class="btn btn-sm"
              style="background:rgba(99,102,241,0.15);border:1px solid rgba(99,102,241,0.3);color:#6366f1;font-size:11px">
              <i class="fas fa-paper-plane"></i> Enviar
            </button>
          ` : ''}
          ${isCompras && p.status === 'Enviado ao Fornecedor' ? `
            <button onclick="farcRegistrarEntrega('${p.id}')" class="btn btn-success btn-sm" style="font-size:11px">
              <i class="fas fa-box-open"></i> Confirmar Entrega
            </button>
          ` : ''}
          <button onclick="farcExportarPedidoPDF('${p.id}')" class="btn btn-secondary btn-sm" style="font-size:11px">
            <i class="fas fa-file-pdf" style="color:#ef4444"></i> PDF
          </button>
        </div>
      </div>
    </div>
  `;
}

// ─── TOGGLE LINHA EXPANDIDA ───────────────────────────────────────────────────
function _farcToggleDetalhesPedido(pedidoId) {
  const details = document.getElementById('ped_details_'+pedidoId);
  const icon    = document.getElementById('ped_expand_icon_'+pedidoId);
  if (!details) return;
  const isOpen = details.style.display !== 'none';
  details.style.display = isOpen ? 'none' : 'table-row';
  if (icon) {
    icon.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(90deg)';
    icon.style.color     = isOpen ? 'var(--text-muted)' : 'var(--fa-teal)';
  }
}

// ─── FILTROS ─────────────────────────────────────────────────────────────────
function _farcFiltrarPedidos() {
  const s       = (document.getElementById('farc_search_ped')?.value||'').toLowerCase();
  const status  = document.getElementById('farc_fil_ped_status')?.value||'';
  const periodo = parseInt(document.getElementById('farc_fil_ped_periodo')?.value||'0');
  const agora   = Date.now();

  let lista = (typeof _getPedidos === 'function' ? _getPedidos() : []).filter(p => {
    const txt = ((p.numero||p.id)+(p.fornecedor||'')+(p.mapa_numero||'')+(p.rfq_numero||'')+(p.rc_numero||'')).toLowerCase();
    if (s && !txt.includes(s)) return false;
    if (status && p.status !== status) return false;
    if (periodo) {
      const d = new Date(p.data_emissao||0).getTime();
      if (agora - d > periodo * 86400000) return false;
    }
    return true;
  });

  const el = document.getElementById('farc_tabela_ped');
  if (el) el.innerHTML = _farcTabelaPedidos(lista);
}

function _farcFiltrarPedidosPorStatus(status) {
  const sel = document.getElementById('farc_fil_ped_status');
  if (sel) { sel.value = status; _farcFiltrarPedidos(); }
}

// Filtra e mostra somente pedidos vencidos (alerta)
function _farcFiltrarPedidosVencidos() {
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const lista = (typeof _getPedidos === 'function' ? _getPedidos() : []).filter(p => {
    if (['Entregue','Concluído','Cancelado'].includes(p.status)) return false;
    if (!p.prazo_entrega) return false;
    const partes = p.prazo_entrega.split('/');
    if (partes.length < 3) return false;
    const d = new Date(partes[2], partes[1]-1, partes[0]); d.setHours(0,0,0,0);
    return d < hoje;
  });
  const el = document.getElementById('farc_tabela_ped');
  if (el) el.innerHTML = _farcTabelaPedidos(lista);
  // Atualiza seletor de busca
  const inp = document.getElementById('farc_search_ped');
  if (inp) inp.value = '';
  showToast(`Exibindo ${lista.length} pedido(s) com prazo vencido`, 'warning');
}

// Destaca/abre detalhes de um pedido específico
function _farcFiltrarPedidosId(pedidoId) {
  const todos = typeof _getPedidos === 'function' ? _getPedidos() : [];
  const p = todos.find(x => x.id === pedidoId);
  if (!p) return;
  const el = document.getElementById('farc_tabela_ped');
  if (el) {
    el.innerHTML = _farcTabelaPedidos([p]);
    setTimeout(() => _farcToggleDetalhesPedido(pedidoId), 100);
  }
}

function _farcExportarPedidos() {
  const lista = typeof _getPedidos === 'function' ? _getPedidos() : [];
  const csv = [
    ['Número','Fornecedor','Mapa','RFQ','RC','Itens','Valor Total','Condição Pagamento','Prazo Entrega','Local Entrega','Status','Data Emissão','Emitido Por'],
    ...lista.map(p => [
      p.numero||p.id, p.fornecedor||'', p.mapa_numero||'', p.rfq_numero||'', p.rc_numero||'',
      p.itens?.length||0, p.valor_total||0, p.condicao_pagamento||'', p.prazo_entrega||'',
      p.local_entrega||'', p.status||'', p.data_emissao||'', p.emitido_por||''
    ])
  ].map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));
  a.download = `PedidosCompra_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  showToast('CSV exportado com sucesso!','success');
  logAction && logAction('Exportar PO', 'Compras', `${lista.length} pedidos exportados em CSV`);
}

// ════════════════════════════════════════════════════════════════════════════
// VER PROCESSO COMPLETO (OS → RC → RFQ → Mapa → PO)
// ════════════════════════════════════════════════════════════════════════════
function farcVerProcessoCompleto(pedidoId) {
  const pedidos = typeof _getPedidos   === 'function' ? _getPedidos()   : [];
  const rcs     = typeof _getRC        === 'function' ? _getRC()        : [];
  const rfqs    = typeof _getRFQFlow   === 'function' ? _getRFQFlow()   : [];
  const mapas   = typeof _getMapasComp === 'function' ? _getMapasComp() : [];
  const fluxo   = typeof _getFluxo     === 'function' ? _getFluxo()     : [];

  const po    = pedidos.find(x => x.id === pedidoId);
  if (!po) return;

  const mapa  = mapas.find(m => m.numero === po.mapa_numero || m.id === po.mapa_id);
  const rfq   = rfqs.find(r  => r.numero === po.rfq_numero  || r.id === po.rfq_id  ||
                                (mapa && (r.id === mapa.rfq_id || r.numero === mapa.rfq_numero)));
  const rc    = rcs.find(r   => r.numero === po.rc_numero   || r.id === po.rc_id   ||
                                (rfq && (r.id === rfq.rc_id || r.numero === rfq.rc_numero)));
  const os    = fluxo.find(f => rc && (f.rc_ids||[]).includes(rc.id));

  // Linha do tempo estilo pipeline
  const etapas = [
    {
      label: 'Ordem de Serviço', icon: 'clipboard-list', color: '#f59e0b',
      numero: os?.numero || (rc?.os_numero ? rc.os_numero : '—'),
      info: os ? `${os.descricao||''} · ${os.status||''}` : (rc?.os_numero ? 'OS vinculada à RC' : 'Não rastreado'),
      status: os ? os.status : (rc?.os_numero ? 'Vinculada' : '—'),
      ok: !!(os || rc?.os_numero)
    },
    {
      label: 'Req. de Compra', icon: 'file-alt', color: '#3b82f6',
      numero: rc?.numero || po.rc_numero || '—',
      info: rc ? `${rc.titulo||''} · ${rc.itens?.length||0} item(ns) · ${_fmtVal(rc.valor_total||0)}` : (po.rc_numero ? 'RC referenciada' : 'Não rastreado'),
      status: rc?.status || '—',
      ok: !!(rc || po.rc_numero)
    },
    {
      label: 'RFQ / Cotação', icon: 'envelope-open-text', color: '#6366f1',
      numero: rfq?.numero || po.rfq_numero || '—',
      info: rfq ? `${rfq.titulo||''} · ${rfq.fornecedores?.length||0} fornecedor(es)` : (po.rfq_numero ? 'RFQ referenciada' : 'Não rastreado'),
      status: rfq?.status || '—',
      ok: !!(rfq || po.rfq_numero)
    },
    {
      label: 'Mapa Comparativo', icon: 'balance-scale', color: '#8b5cf6',
      numero: mapa?.numero || po.mapa_numero || '—',
      info: mapa ? `Fornecedor: ${mapa.fornecedor_selecionado||'—'} · Score: ${mapa.score_ia||'—'}` : (po.mapa_numero ? 'Mapa referenciado' : 'Não rastreado'),
      status: mapa?.status || '—',
      ok: !!(mapa || po.mapa_numero)
    },
    {
      label: 'Pedido de Compra', icon: 'shopping-bag', color: '#22c55e',
      numero: po.numero || po.id,
      info: `${po.fornecedor||'—'} · ${_fmtVal(po.valor_total)} · ${po.condicao_pagamento||'—'}`,
      status: po.status,
      ok: true
    }
  ];

  openModalWide(`<i class="fas fa-project-diagram" style="color:#6366f1;margin-right:8px"></i>Processo Completo – ${po.numero}`, `
    <!-- PIPELINE HORIZONTAL -->
    <div style="display:flex;align-items:flex-start;gap:0;margin-bottom:20px;overflow-x:auto;padding:8px 0">
      ${etapas.map((e, i) => `
        <div style="display:flex;align-items:center;flex:1;min-width:140px">
          <div style="flex:1;text-align:center">
            <div style="width:52px;height:52px;border-radius:50%;margin:0 auto 8px;
              background:${e.ok ? e.color+'20' : 'rgba(255,255,255,0.04)'};
              border:2px solid ${e.ok ? e.color : 'var(--border-color)'};
              display:flex;align-items:center;justify-content:center">
              <i class="fas fa-${e.icon}" style="color:${e.ok ? e.color : 'var(--text-muted)'};font-size:18px"></i>
            </div>
            <div style="font-size:11px;font-weight:700;color:${e.ok?'var(--text-primary)':'var(--text-muted)'}">
              ${e.label}
            </div>
            <div style="font-size:12px;font-weight:700;color:${e.ok?e.color:'var(--text-muted)'};margin-top:2px">
              ${e.numero}
            </div>
            <div style="margin-top:4px">
              ${e.ok
                ? `<span style="background:${e.color}22;color:${e.color};border-radius:10px;padding:2px 7px;font-size:10px">${e.status}</span>`
                : `<span style="background:rgba(255,255,255,0.04);color:var(--text-muted);border-radius:10px;padding:2px 7px;font-size:10px">Não rastreado</span>`
              }
            </div>
          </div>
          ${i < etapas.length-1 ? `
            <div style="min-width:24px;display:flex;align-items:center;justify-content:center;padding-bottom:28px">
              <i class="fas fa-arrow-right" style="color:${e.ok?'var(--fa-teal)':'var(--border-color)'};font-size:12px"></i>
            </div>` : ''}
        </div>
      `).join('')}
    </div>

    <!-- DETALHES POR ETAPA -->
    <div style="display:grid;gap:10px">

      ${etapas.map(e => `
        <div style="border:1px solid ${e.ok ? e.color+'44' : 'var(--border-color)'};border-radius:10px;
          background:${e.ok ? e.color+'08' : 'rgba(255,255,255,0.02)'};padding:12px 16px;
          display:flex;align-items:center;gap:12px">
          <div style="width:36px;height:36px;min-width:36px;border-radius:50%;
            background:${e.ok ? e.color+'18' : 'rgba(255,255,255,0.04)'};
            border:1.5px solid ${e.ok ? e.color+'55' : 'var(--border-color)'};
            display:flex;align-items:center;justify-content:center">
            <i class="fas fa-${e.icon}" style="color:${e.ok ? e.color : 'var(--text-muted)'};font-size:14px"></i>
          </div>
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px">
              <span style="font-size:12px;font-weight:700;color:${e.ok?e.color:'var(--text-muted)'}">${e.numero}</span>
              <span style="font-size:10px;font-weight:600;color:var(--text-muted);text-transform:uppercase">${e.label}</span>
            </div>
            <div style="font-size:11px;color:var(--text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${e.info}</div>
          </div>
          <div style="text-align:right;flex-shrink:0">
            ${e.ok
              ? `<span style="background:${e.color}22;color:${e.color};border-radius:6px;padding:3px 8px;font-size:10px;font-weight:700">${e.status}</span>`
              : `<span style="background:rgba(255,255,255,0.04);color:var(--text-muted);border-radius:6px;padding:3px 8px;font-size:10px">Não rastreado</span>`
            }
          </div>
        </div>
      `).join('')}

    </div>

    <!-- HISTÓRICO DO PEDIDO -->
    ${(po.historico||[]).length > 0 ? `
      <div style="margin-top:16px">
        <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">
          <i class="fas fa-history" style="margin-right:6px;color:var(--fa-teal)"></i>Histórico do Pedido
        </div>
        <div style="border:1px solid var(--border-color);border-radius:8px;overflow:hidden">
          ${(po.historico||[]).map((h,i) => `
            <div style="display:flex;align-items:flex-start;gap:10px;padding:8px 14px;
              ${i<(po.historico.length-1)?'border-bottom:1px solid var(--border-color)':''}">
              <i class="fas fa-circle" style="color:var(--fa-teal);font-size:6px;margin-top:5px;flex-shrink:0"></i>
              <div style="flex:1;font-size:11px;color:var(--text-secondary)">${h.acao||''}</div>
              <div style="font-size:10px;color:var(--text-muted);flex-shrink:0">${h.usuario||''} · ${h.data||''}</div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}

    <!-- ENVIO AO FORNECEDOR -->
    ${po.envio_log && po.envio_log.length > 0 ? `
      <div style="margin-top:12px">
        <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">
          <i class="fas fa-paper-plane" style="margin-right:6px;color:#6366f1"></i>Registro de Envios
        </div>
        <div style="border:1px solid rgba(99,102,241,0.25);border-radius:8px;overflow:hidden;background:rgba(99,102,241,0.04)">
          ${(po.envio_log||[]).map((e,i) => `
            <div style="display:flex;align-items:center;gap:10px;padding:8px 14px;
              ${i<(po.envio_log.length-1)?'border-bottom:1px solid rgba(99,102,241,0.15)':''}">
              <i class="fas fa-paper-plane" style="color:#6366f1;font-size:11px;flex-shrink:0"></i>
              <div style="flex:1;font-size:11px;color:var(--text-secondary)">${e.descricao||e.canal||''}</div>
              <div style="font-size:10px;color:var(--text-muted)">${e.data||''}</div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
    <button class="btn btn-secondary" onclick="closeModal();farcVerPedido('${pedidoId}')">
      <i class="fas fa-eye"></i> Detalhes do Pedido
    </button>
    <button class="btn btn-primary" onclick="closeModal();farcExportarPedidoPDF('${pedidoId}')">
      <i class="fas fa-file-pdf"></i> Exportar PDF
    </button>
  `);
}

// ════════════════════════════════════════════════════════════════════════════
// EDITAR PEDIDO
// ════════════════════════════════════════════════════════════════════════════
function farcEditarPedido(pedidoId) {
  const pedidos = typeof _getPedidos === 'function' ? _getPedidos() : [];
  const idx = pedidos.findIndex(x => x.id === pedidoId);
  if (idx < 0) return;
  const p = pedidos[idx];

  openModalWide(`<i class="fas fa-edit" style="color:var(--fa-teal);margin-right:8px"></i>Editar Pedido – ${p.numero}`, `

    <!-- Cabeçalho informativo -->
    <div style="background:rgba(0,180,184,0.06);border:1px solid rgba(0,180,184,0.2);border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:12px;color:var(--text-secondary)">
      <i class="fas fa-info-circle" style="color:var(--fa-teal);margin-right:6px"></i>
      Edite as informações do pedido. O histórico registrará todas as alterações.
      Fornecedor e referências (Mapa/RFQ) não podem ser alterados após emissão.
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
      <div>
        <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">Fornecedor (somente leitura)</label>
        <input class="form-control" type="text" value="${p.fornecedor||''}" readonly
          style="background:var(--bg-secondary);opacity:.7;font-weight:600;color:var(--fa-teal)">
      </div>
      <div>
        <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">Número do Pedido</label>
        <input class="form-control" type="text" value="${p.numero||p.id}" readonly
          style="background:var(--bg-secondary);opacity:.7;font-weight:700;color:#22c55e">
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:14px">
      <div>
        <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">Condição de Pagamento *</label>
        <select class="form-control" id="ep_cond_pag">
          ${['30 dias','30/60 dias','À vista','Faturado 28 dias','45 dias','60 dias','Personalizado'].map(o =>
            `<option ${p.condicao_pagamento===o?'selected':''}>${o}</option>`
          ).join('')}
        </select>
      </div>
      <div>
        <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">Prazo de Entrega *</label>
        <input class="form-control" id="ep_prazo" type="date"
          value="${p.prazo_entrega ? p.prazo_entrega.split('/').reverse().join('-') : ''}">
      </div>
      <div>
        <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">Status</label>
        <select class="form-control" id="ep_status">
          ${['Emitido','Aguardando Envio','Enviado ao Fornecedor','Entregue','Concluído','Cancelado'].map(s =>
            `<option ${p.status===s?'selected':''}>${s}</option>`
          ).join('')}
        </select>
      </div>
    </div>

    <div style="margin-bottom:14px">
      <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">Local de Entrega</label>
      <input class="form-control" id="ep_local" type="text"
        value="${p.local_entrega||''}" placeholder="Ex: Almoxarifado Central – Área 3">
    </div>

    <!-- Itens editáveis -->
    <div style="font-size:12px;font-weight:700;color:var(--text-secondary);margin-bottom:8px;display:flex;align-items:center;justify-content:space-between">
      <span><i class="fas fa-list" style="margin-right:6px;color:var(--orange)"></i>ITENS DO PEDIDO</span>
      <button onclick="_farcAddItemEdicao()" class="btn btn-secondary btn-sm" style="font-size:11px">
        <i class="fas fa-plus"></i> Adicionar Item
      </button>
    </div>
    <div id="ep_itens_list" style="border:1px solid var(--border-color);border-radius:8px;overflow:hidden;margin-bottom:14px">
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead>
          <tr style="background:var(--bg-tertiary)">
            <th style="padding:8px 10px;text-align:left">Descrição</th>
            <th style="padding:8px 10px;text-align:center;width:70px">Qtd</th>
            <th style="padding:8px 10px;text-align:center;width:60px">Un</th>
            <th style="padding:8px 10px;text-align:right;width:110px">Preço Unit.</th>
            <th style="padding:8px 10px;text-align:right;width:110px">Total</th>
            <th style="padding:8px 10px;text-align:center;width:40px"></th>
          </tr>
        </thead>
        <tbody id="ep_itens_tbody">
          ${(p.itens||[]).map((it, i) => `
            <tr id="ep_row_${i}" style="border-bottom:1px solid var(--border-color)">
              <td style="padding:5px 8px"><input class="form-control" type="text" id="ep_desc_${i}" value="${it.descricao||''}" style="font-size:12px;padding:4px 8px"></td>
              <td style="padding:5px 8px"><input class="form-control" type="number" id="ep_qtd_${i}" value="${it.qtd||1}" min="1"
                oninput="_farcCalcEdicaoLinha(${i})" style="font-size:12px;padding:4px 8px;text-align:center"></td>
              <td style="padding:5px 8px"><input class="form-control" type="text" id="ep_un_${i}" value="${it.unidade||'Un'}" style="font-size:12px;padding:4px 8px;text-align:center"></td>
              <td style="padding:5px 8px"><input class="form-control" type="number" id="ep_unit_${i}" value="${it.preco_unit||0}" step="0.01"
                oninput="_farcCalcEdicaoLinha(${i})" style="font-size:12px;padding:4px 8px;text-align:right"></td>
              <td style="padding:5px 8px;text-align:right;font-weight:700;color:var(--fa-teal)" id="ep_tot_${i}">${_fmtVal(it.total||0)}</td>
              <td style="padding:5px 8px;text-align:center">
                <button onclick="_farcRemoverItemEdicao(${i})" class="btn btn-danger btn-sm btn-icon" style="width:22px;height:22px;padding:0" title="Remover">
                  <i class="fas fa-times" style="font-size:9px"></i>
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    <div style="text-align:right;font-size:12px;margin-bottom:14px">
      Total do Pedido: <strong id="ep_total_geral" style="color:var(--fa-teal);font-size:14px">${_fmtVal(p.valor_total)}</strong>
    </div>

    <div>
      <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">Observações</label>
      <textarea class="form-control" id="ep_obs" rows="2" placeholder="Instruções, condições especiais...">${p.observacoes||''}</textarea>
    </div>
    <div id="ep_erro" style="display:none;color:#ef4444;font-size:12px;margin-top:8px;padding:8px 12px;background:rgba(239,68,68,0.08);border-radius:6px"></div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="_farcSalvarEdicaoPedido('${pedidoId}')">
      <i class="fas fa-save"></i> Salvar Alterações
    </button>
  `);

  // guarda numero de itens para controle
  window._epItemCount = (p.itens||[]).length;
}

function _farcCalcEdicaoLinha(i) {
  const qtd  = parseFloat(document.getElementById('ep_qtd_'+i)?.value||0);
  const unit = parseFloat(document.getElementById('ep_unit_'+i)?.value||0);
  const tot  = qtd * unit;
  const el = document.getElementById('ep_tot_'+i);
  if (el) el.textContent = _fmtVal(tot);
  _farcRecalcTotalEdicao();
}

function _farcRecalcTotalEdicao() {
  let total = 0;
  const tbody = document.getElementById('ep_itens_tbody');
  if (!tbody) return;
  tbody.querySelectorAll('tr[id^="ep_row_"]').forEach(row => {
    const i = row.id.replace('ep_row_','');
    const qtd  = parseFloat(document.getElementById('ep_qtd_'+i)?.value||0);
    const unit = parseFloat(document.getElementById('ep_unit_'+i)?.value||0);
    total += qtd * unit;
  });
  const el = document.getElementById('ep_total_geral');
  if (el) el.textContent = _fmtVal(total);
}

function _farcAddItemEdicao() {
  const i = window._epItemCount || 0;
  window._epItemCount = i + 1;
  const tbody = document.getElementById('ep_itens_tbody');
  if (!tbody) return;
  const tr = document.createElement('tr');
  tr.id = 'ep_row_'+i;
  tr.style.borderBottom = '1px solid var(--border-color)';
  tr.innerHTML = `
    <td style="padding:5px 8px"><input class="form-control" type="text" id="ep_desc_${i}" placeholder="Descrição do item" style="font-size:12px;padding:4px 8px"></td>
    <td style="padding:5px 8px"><input class="form-control" type="number" id="ep_qtd_${i}" value="1" min="1" oninput="_farcCalcEdicaoLinha(${i})" style="font-size:12px;padding:4px 8px;text-align:center"></td>
    <td style="padding:5px 8px"><input class="form-control" type="text" id="ep_un_${i}" value="Un" style="font-size:12px;padding:4px 8px;text-align:center"></td>
    <td style="padding:5px 8px"><input class="form-control" type="number" id="ep_unit_${i}" value="0" step="0.01" oninput="_farcCalcEdicaoLinha(${i})" style="font-size:12px;padding:4px 8px;text-align:right"></td>
    <td style="padding:5px 8px;text-align:right;font-weight:700;color:var(--fa-teal)" id="ep_tot_${i}">R$ 0,00</td>
    <td style="padding:5px 8px;text-align:center">
      <button onclick="_farcRemoverItemEdicao(${i})" class="btn btn-danger btn-sm btn-icon" style="width:22px;height:22px;padding:0" title="Remover">
        <i class="fas fa-times" style="font-size:9px"></i>
      </button>
    </td>`;
  tbody.appendChild(tr);
}

function _farcRemoverItemEdicao(i) {
  const row = document.getElementById('ep_row_'+i);
  if (row) { row.remove(); _farcRecalcTotalEdicao(); }
}

function _farcSalvarEdicaoPedido(pedidoId) {
  const pedidos = typeof _getPedidos === 'function' ? _getPedidos() : [];
  const idx = pedidos.findIndex(x => x.id === pedidoId);
  if (idx < 0) return;

  const prazoVal = document.getElementById('ep_prazo')?.value;
  const erroEl   = document.getElementById('ep_erro');

  if (!prazoVal) {
    if (erroEl) { erroEl.textContent='Informe o prazo de entrega.'; erroEl.style.display='block'; }
    return;
  }

  // Coleta itens editados
  const tbody = document.getElementById('ep_itens_tbody');
  const itens = [];
  if (tbody) {
    tbody.querySelectorAll('tr[id^="ep_row_"]').forEach(row => {
      const i = row.id.replace('ep_row_','');
      const desc  = document.getElementById('ep_desc_'+i)?.value?.trim();
      const qtd   = parseFloat(document.getElementById('ep_qtd_'+i)?.value||1);
      const un    = document.getElementById('ep_un_'+i)?.value||'Un';
      const unit  = parseFloat(document.getElementById('ep_unit_'+i)?.value||0);
      if (desc) itens.push({ descricao:desc, qtd, unidade:un, preco_unit:unit, total:qtd*unit });
    });
  }

  const novoStatus = document.getElementById('ep_status')?.value || pedidos[idx].status;
  const totalNovo  = itens.reduce((a,it) => a + (it.total||0), 0) || pedidos[idx].valor_total;

  pedidos[idx] = {
    ...pedidos[idx],
    condicao_pagamento: document.getElementById('ep_cond_pag')?.value || pedidos[idx].condicao_pagamento,
    prazo_entrega: new Date(prazoVal+'T12:00:00').toLocaleDateString('pt-BR'),
    local_entrega: document.getElementById('ep_local')?.value?.trim() || pedidos[idx].local_entrega,
    status: novoStatus,
    itens: itens.length ? itens : pedidos[idx].itens,
    valor_total: totalNovo,
    observacoes: document.getElementById('ep_obs')?.value?.trim() || '',
    historico: [
      { acao: `Pedido editado por ${currentUser?.name||'Comprador'} – status: ${novoStatus}`, usuario: currentUser?.name, data: new Date().toLocaleString('pt-BR') },
      ...(pedidos[idx].historico||[])
    ]
  };

  if (typeof _savePedidos === 'function') _savePedidos(pedidos);
  else { try { localStorage.setItem('fa_pedidos', JSON.stringify(pedidos)); } catch(e){} }

  logAction && logAction('Edição PO', 'Compras', `${pedidos[idx].numero} editado – status: ${novoStatus}`);
  closeModal();
  showToast(`Pedido ${pedidos[idx].numero} atualizado!`, 'success');
  farcSwitchTab('pedido');
}

// ════════════════════════════════════════════════════════════════════════════
// AGENDAR / PROGRAMAR ENVIO AO FORNECEDOR
// ════════════════════════════════════════════════════════════════════════════
function farcAgendarEnvio(pedidoId) {
  const pedidos = typeof _getPedidos === 'function' ? _getPedidos() : [];
  const p = pedidos.find(x => x.id === pedidoId);
  if (!p) return;

  // Tenta obter e-mail do fornecedor
  const fornecedores = typeof FA_FORNECEDORES !== 'undefined' ? FA_FORNECEDORES
    : (typeof _getFornecedores === 'function' ? _getFornecedores() : []);
  const forn = fornecedores.find(f => f.nome === p.fornecedor || f.razao_social === p.fornecedor);
  const emailForn = forn?.email || forn?.contato_email || '';

  const hoje = new Date().toISOString().split('T')[0];

  openModalWide(`<i class="fas fa-paper-plane" style="color:#6366f1;margin-right:8px"></i>Programar Envio ao Fornecedor – ${p.numero}`, `

    <!-- Info do pedido -->
    <div style="background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.2);border-radius:10px;padding:14px;margin-bottom:16px">
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;font-size:12px">
        <div>
          <span style="color:var(--text-muted)">Pedido:</span>
          <strong style="color:#22c55e;margin-left:6px">${p.numero}</strong>
        </div>
        <div>
          <span style="color:var(--text-muted)">Fornecedor:</span>
          <strong style="margin-left:6px">${p.fornecedor||'—'}</strong>
        </div>
        <div>
          <span style="color:var(--text-muted)">Valor:</span>
          <strong style="color:var(--fa-teal);margin-left:6px">${_fmtVal(p.valor_total)}</strong>
        </div>
        <div>
          <span style="color:var(--text-muted)">Itens:</span>
          <strong style="margin-left:6px">${p.itens?.length||0} item(ns)</strong>
        </div>
        <div>
          <span style="color:var(--text-muted)">Prazo Entrega:</span>
          <strong style="color:var(--orange);margin-left:6px">${p.prazo_entrega||'—'}</strong>
        </div>
        <div>
          <span style="color:var(--text-muted)">Condição Pgto:</span>
          <strong style="margin-left:6px">${p.condicao_pagamento||'—'}</strong>
        </div>
      </div>
    </div>

    <!-- CANAL DE ENVIO -->
    <div style="font-size:12px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">
      Canal de Envio
    </div>
    <div style="display:flex;gap:8px;margin-bottom:16px">
      ${[
        { id:'canal_email',   icon:'envelope',   label:'E-mail',      desc:'Enviar PO por e-mail ao fornecedor', color:'#3b82f6' },
        { id:'canal_pdf',     icon:'file-pdf',   label:'PDF / Manual',desc:'Gerar PDF para envio manual',        color:'#ef4444' },
        { id:'canal_ambos',   icon:'layer-group',label:'E-mail + PDF', desc:'Envio digital e PDF para arquivo',  color:'#8b5cf6' },
      ].map(c => `
        <label style="flex:1;cursor:pointer">
          <input type="radio" name="canal_envio" value="${c.id}" id="${c.id}" ${c.id==='canal_email'?'checked':''}
            style="display:none" onchange="_farcToggleEnvioCanal()">
          <div class="canal-opt" id="opt_${c.id}"
            style="border:2px solid ${c.id==='canal_email'?c.color:'var(--border-color)'};
              border-radius:10px;padding:12px;text-align:center;transition:all .2s;
              background:${c.id==='canal_email'?c.color+'15':'rgba(255,255,255,0.03)'}">
            <i class="fas fa-${c.icon}" style="color:${c.color};font-size:20px;margin-bottom:6px;display:block"></i>
            <div style="font-size:12px;font-weight:700">${c.label}</div>
            <div style="font-size:10px;color:var(--text-muted);margin-top:2px">${c.desc}</div>
          </div>
        </label>
      `).join('')}
    </div>

    <!-- DADOS DE E-MAIL -->
    <div id="envio_email_block">
      <div style="font-size:12px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">
        Dados do E-mail
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
        <div>
          <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">
            E-mail do Fornecedor *
            ${emailForn ? `<span style="color:var(--green-light);margin-left:6px"><i class="fas fa-check-circle"></i> Cadastrado</span>` : `<span style="color:var(--yellow-light);margin-left:6px"><i class="fas fa-exclamation-triangle"></i> Não encontrado</span>`}
          </label>
          <input class="form-control" id="envio_email_dest" type="email"
            value="${emailForn}" placeholder="fornecedor@empresa.com.br">
        </div>
        <div>
          <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">CC (cópia)</label>
          <input class="form-control" id="envio_email_cc" type="email"
            placeholder="Ex: compras@fraseralexander.com.br" value="compras@fraseralexander.com.br">
        </div>
      </div>
      <div style="margin-bottom:12px">
        <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">Assunto do E-mail</label>
        <input class="form-control" id="envio_assunto" type="text"
          value="Pedido de Compra ${p.numero} – Fraser Alexander Mineração">
      </div>
      <div style="margin-bottom:12px">
        <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">Mensagem</label>
        <textarea class="form-control" id="envio_msg" rows="4"
          style="font-size:12px">Prezado(a) fornecedor,

Segue em anexo o Pedido de Compra ${p.numero} referente ao fornecimento de ${p.itens?.length||0} item(ns), no valor total de ${_fmtVal(p.valor_total)}.

Prazo de entrega: ${p.prazo_entrega||'—'}
Local de entrega: ${p.local_entrega||'—'}
Condição de pagamento: ${p.condicao_pagamento||'—'}

Favor confirmar o recebimento e a viabilidade do prazo.

Atenciosamente,
${currentUser?.name||'Compras'} – Fraser Alexander Mineração</textarea>
      </div>
    </div>

    <!-- AGENDAMENTO -->
    <div style="font-size:12px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;margin-top:4px">
      Data do Envio
    </div>
    <div style="display:flex;gap:12px;margin-bottom:12px;align-items:flex-end">
      <div style="flex:1">
        <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">Enviar em</label>
        <div style="display:flex;gap:8px">
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px">
            <input type="radio" name="envio_quando" value="agora" checked onchange="_farcToggleEnvioData()">
            <span>Imediatamente</span>
          </label>
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;margin-left:12px">
            <input type="radio" name="envio_quando" value="agendado" onchange="_farcToggleEnvioData()">
            <span>Agendar para</span>
          </label>
          <input class="form-control" id="envio_data_ag" type="date" value="${hoje}"
            style="width:160px;font-size:12px;display:none">
        </div>
      </div>
      <div style="flex:1">
        <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">Incluir PDF do PO no envio?</label>
        <select class="form-control" id="envio_incluir_pdf" style="font-size:12px">
          <option value="sim" selected>Sim – incluir PDF do Pedido de Compra</option>
          <option value="nao">Não</option>
        </select>
      </div>
    </div>

    <div id="envio_erro" style="display:none;color:#ef4444;font-size:12px;margin-top:8px;padding:8px 12px;background:rgba(239,68,68,0.08);border-radius:6px"></div>

  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-secondary" onclick="closeModal();farcGerarPOPDF_by_id('${pedidoId}')">
      <i class="fas fa-file-pdf"></i> Apenas PDF
    </button>
    <button class="btn btn-primary" onclick="_farcConfirmarEnvio('${pedidoId}')">
      <i class="fas fa-paper-plane"></i> Confirmar Envio
    </button>
  `);
}

function _farcToggleEnvioCanal() {
  const canal = document.querySelector('input[name="canal_envio"]:checked')?.value || 'canal_email';
  const cores = { canal_email:'#3b82f6', canal_pdf:'#ef4444', canal_ambos:'#8b5cf6' };
  ['canal_email','canal_pdf','canal_ambos'].forEach(id => {
    const opt = document.getElementById('opt_'+id);
    if (!opt) return;
    if (id === canal) {
      opt.style.borderColor = cores[id];
      opt.style.background  = cores[id]+'15';
    } else {
      opt.style.borderColor = 'var(--border-color)';
      opt.style.background  = 'rgba(255,255,255,0.03)';
    }
  });
  const emailBlock = document.getElementById('envio_email_block');
  if (emailBlock) emailBlock.style.display = canal === 'canal_pdf' ? 'none' : '';
}

function _farcToggleEnvioData() {
  const ag = document.querySelector('input[name="envio_quando"]:checked')?.value === 'agendado';
  const el = document.getElementById('envio_data_ag');
  if (el) el.style.display = ag ? '' : 'none';
}

function _farcConfirmarEnvio(pedidoId) {
  const pedidos = typeof _getPedidos === 'function' ? _getPedidos() : [];
  const idx = pedidos.findIndex(x => x.id === pedidoId);
  if (idx < 0) return;

  const canal    = document.querySelector('input[name="canal_envio"]:checked')?.value || 'canal_email';
  const quando   = document.querySelector('input[name="envio_quando"]:checked')?.value || 'agora';
  const dataAg   = document.getElementById('envio_data_ag')?.value || '';
  const email    = document.getElementById('envio_email_dest')?.value?.trim() || '';
  const assunto  = document.getElementById('envio_assunto')?.value?.trim() || '';
  const inclPDF  = document.getElementById('envio_incluir_pdf')?.value === 'sim';
  const erroEl   = document.getElementById('envio_erro');

  // Validações
  if (canal !== 'canal_pdf' && !email) {
    if (erroEl) { erroEl.textContent='Informe o e-mail do fornecedor.'; erroEl.style.display='block'; } return;
  }
  if (quando === 'agendado' && !dataAg) {
    if (erroEl) { erroEl.textContent='Informe a data de agendamento.'; erroEl.style.display='block'; } return;
  }

  const dataEnvio    = quando === 'agendado' ? new Date(dataAg+'T12:00:00').toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR');
  const horaEnvio    = new Date().toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'});
  const isAgendado   = quando === 'agendado';

  // Monta descrição do log
  const canalLabel = { canal_email:'E-mail', canal_pdf:'PDF Manual', canal_ambos:'E-mail + PDF' }[canal] || 'E-mail';
  let descLog = `Enviado via ${canalLabel}`;
  if (canal !== 'canal_pdf') descLog += ` para ${email}`;
  if (isAgendado) descLog = `Agendado para ${dataEnvio} via ${canalLabel}`;

  // Atualiza pedido
  pedidos[idx].status         = isAgendado ? 'Aguardando Envio' : 'Enviado ao Fornecedor';
  pedidos[idx].envio_agendado = isAgendado;
  pedidos[idx].envio_canal    = canalLabel;
  pedidos[idx].envio_data     = dataEnvio;
  pedidos[idx].envio_email    = email;
  pedidos[idx].historico      = [
    { acao: descLog, usuario: currentUser?.name, data: new Date().toLocaleString('pt-BR') },
    ...(pedidos[idx].historico || [])
  ];
  pedidos[idx].envio_log = [
    { descricao: descLog, canal: canalLabel, data: `${dataEnvio} ${!isAgendado?horaEnvio:''}`.trim() },
    ...(pedidos[idx].envio_log || [])
  ];

  if (typeof _savePedidos === 'function') _savePedidos(pedidos);
  else { try { localStorage.setItem('fa_pedidos', JSON.stringify(pedidos)); } catch(e){} }

  logAction && logAction('Envio PO', 'Compras', `${pedidos[idx].numero} → ${descLog}`);
  closeModal();

  // Se inclui PDF, abre
  if (inclPDF || canal === 'canal_pdf' || canal === 'canal_ambos') {
    setTimeout(() => farcGerarPOPDF_by_id(pedidoId), 300);
  }

  const msg = isAgendado
    ? `📅 Envio de ${pedidos[idx].numero} agendado para ${dataEnvio}!`
    : `✅ ${pedidos[idx].numero} enviado ao fornecedor ${canal !== 'canal_pdf' ? '– E-mail: '+email : 'via PDF'}!`;
  showToast(msg, 'success', 7000);
  farcSwitchTab('pedido');
}

// ─── REGISTRAR ENTREGA ───────────────────────────────────────────────────────
function farcRegistrarEntrega(pedidoId) {
  const pedidos = typeof _getPedidos === 'function' ? _getPedidos() : [];
  const idx = pedidos.findIndex(x => x.id === pedidoId);
  if (idx < 0) return;
  const p = pedidos[idx];
  const hoje = new Date().toISOString().split('T')[0];

  openModal(`<i class="fas fa-box-open" style="color:#22c55e;margin-right:8px"></i>Registrar Entrega – ${p.numero}`, `
    <div style="font-size:13px;color:var(--text-secondary);margin-bottom:16px">
      Confirme o recebimento do pedido <strong style="color:#22c55e">${p.numero}</strong>
      de <strong>${p.fornecedor||'—'}</strong>.
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
      <div>
        <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">Data de Entrega</label>
        <input class="form-control" id="ent_data" type="date" value="${hoje}">
      </div>
      <div>
        <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">Recebido por</label>
        <input class="form-control" id="ent_resp" type="text"
          value="${currentUser?.name||''}" placeholder="Nome do responsável">
      </div>
    </div>
    <div>
      <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">Observações do Recebimento</label>
      <textarea class="form-control" id="ent_obs" rows="2"
        placeholder="Ex: Itens conferidos, nota fiscal NF-123, sem avarias..."></textarea>
    </div>
    <div style="margin-top:12px">
      <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">Status Final</label>
      <select class="form-control" id="ent_status">
        <option>Entregue</option>
        <option>Concluído</option>
      </select>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-success" onclick="_farcConfirmarEntrega('${pedidoId}')">
      <i class="fas fa-check-double"></i> Confirmar Entrega
    </button>
  `);
}

function _farcConfirmarEntrega(pedidoId) {
  const pedidos = typeof _getPedidos === 'function' ? _getPedidos() : [];
  const idx = pedidos.findIndex(x => x.id === pedidoId);
  if (idx < 0) return;

  const dataEnt  = document.getElementById('ent_data')?.value;
  const resp     = document.getElementById('ent_resp')?.value?.trim() || currentUser?.name || '';
  const obs      = document.getElementById('ent_obs')?.value?.trim() || '';
  const status   = document.getElementById('ent_status')?.value || 'Entregue';
  const dataFmt  = dataEnt ? new Date(dataEnt+'T12:00:00').toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR');

  pedidos[idx].status        = status;
  pedidos[idx].data_entrega  = dataFmt;
  pedidos[idx].recebido_por  = resp;
  pedidos[idx].historico = [
    { acao: `Entrega registrada em ${dataFmt} por ${resp}${obs?' – '+obs:''}`, usuario: currentUser?.name, data: new Date().toLocaleString('pt-BR') },
    ...(pedidos[idx].historico || [])
  ];

  if (typeof _savePedidos === 'function') _savePedidos(pedidos);
  else { try { localStorage.setItem('fa_pedidos', JSON.stringify(pedidos)); } catch(e){} }

  logAction && logAction('Entrega PO', 'Compras', `${pedidos[idx].numero} – Entrega registrada em ${dataFmt} por ${resp}`);
  closeModal();
  showToast(`✅ Entrega do pedido ${pedidos[idx].numero} confirmada!`, 'success');
  farcSwitchTab('pedido');
}

function farcNovoMapa() {
  // Redireciona para a aba mapa
  farcSwitchTab('mapa');
  showToast('Selecione um Mapa Comparativo aprovado para emitir o Pedido.','info');
}

// ════════════════════════════════════════════════════════════════════════════
// CANCELAR PEDIDO
// ════════════════════════════════════════════════════════════════════════════
function farcCancelarPedido(pedidoId) {
  const pedidos = typeof _getPedidos === 'function' ? _getPedidos() : [];
  const p = pedidos.find(x => x.id === pedidoId);
  if (!p) return;

  openModal(
    `<i class="fas fa-times-circle" style="color:#ef4444;margin-right:8px"></i>Cancelar Pedido – ${p.numero}`,
    `
    <div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.3);border-radius:10px;padding:12px 14px;margin-bottom:16px">
      <div style="font-size:13px;font-weight:700;color:#ef4444;margin-bottom:6px">
        <i class="fas fa-exclamation-triangle" style="margin-right:6px"></i>Confirmar cancelamento do pedido?
      </div>
      <div style="font-size:12px;color:var(--text-secondary)">
        Pedido: <strong style="color:#22c55e">${p.numero}</strong> &nbsp;|&nbsp;
        Fornecedor: <strong>${p.fornecedor||'—'}</strong> &nbsp;|&nbsp;
        Valor: <strong style="color:var(--fa-teal)">${_fmtVal(p.valor_total)}</strong>
      </div>
    </div>

    <div style="margin-bottom:12px">
      <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:5px">Motivo do cancelamento *</label>
      <select class="form-control" id="cancel_tipo" onchange="_farcToggleCancelOutro()" style="font-size:12px;margin-bottom:8px">
        <option value="">Selecione o motivo...</option>
        <option>Pedido duplicado</option>
        <option>Fornecedor não confirmou</option>
        <option>Mudança de requisito</option>
        <option>Prazo inviável</option>
        <option>Orçamento cancelado</option>
        <option>Outro</option>
      </select>
      <div id="cancel_outro_block" style="display:none">
        <input class="form-control" id="cancel_outro" type="text" placeholder="Descreva o motivo..." style="font-size:12px">
      </div>
    </div>

    <div>
      <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:5px">Observações adicionais</label>
      <textarea class="form-control" id="cancel_obs" rows="2"
        placeholder="Informações complementares sobre o cancelamento..."></textarea>
    </div>

    ${p.status === 'Enviado ao Fornecedor' ? `
      <div style="margin-top:12px;background:rgba(251,191,36,0.1);border:1px solid rgba(251,191,36,0.3);border-radius:8px;padding:10px;font-size:12px;color:var(--text-secondary)">
        <i class="fas fa-exclamation" style="color:#f59e0b;margin-right:6px"></i>
        Este pedido já foi enviado ao fornecedor. Recomenda-se comunicar o cancelamento ao fornecedor antes de confirmar.
      </div>
    ` : ''}

    <div id="cancel_erro" style="display:none;color:#ef4444;font-size:12px;margin-top:8px;padding:8px 12px;background:rgba(239,68,68,0.08);border-radius:6px"></div>
    `,
    `
    <button class="btn btn-secondary" onclick="closeModal()">Voltar</button>
    <button class="btn btn-danger" onclick="_farcConfirmarCancelamento('${pedidoId}')">
      <i class="fas fa-times"></i> Confirmar Cancelamento
    </button>
    `
  );
}

function _farcToggleCancelOutro() {
  const v = document.getElementById('cancel_tipo')?.value;
  const bl = document.getElementById('cancel_outro_block');
  if (bl) bl.style.display = v === 'Outro' ? '' : 'none';
}

function _farcConfirmarCancelamento(pedidoId) {
  const pedidos = typeof _getPedidos === 'function' ? _getPedidos() : [];
  const idx = pedidos.findIndex(x => x.id === pedidoId);
  if (idx < 0) return;

  const tipo  = document.getElementById('cancel_tipo')?.value || '';
  const outro = document.getElementById('cancel_outro')?.value?.trim() || '';
  const obs   = document.getElementById('cancel_obs')?.value?.trim() || '';
  const erroEl = document.getElementById('cancel_erro');

  if (!tipo) {
    if (erroEl) { erroEl.textContent='Selecione o motivo do cancelamento.'; erroEl.style.display='block'; }
    return;
  }
  if (tipo === 'Outro' && !outro) {
    if (erroEl) { erroEl.textContent='Descreva o motivo do cancelamento.'; erroEl.style.display='block'; }
    return;
  }

  const motivo = tipo === 'Outro' ? outro : tipo;
  const descLog = `Pedido cancelado por ${currentUser?.name||'Comprador'} – Motivo: ${motivo}${obs?' – '+obs:''}`;

  pedidos[idx].status              = 'Cancelado';
  pedidos[idx].motivo_cancelamento = motivo;
  pedidos[idx].data_cancelamento   = new Date().toLocaleDateString('pt-BR');
  pedidos[idx].cancelado_por       = currentUser?.name || '';
  pedidos[idx].historico = [
    { acao: descLog, usuario: currentUser?.name, data: new Date().toLocaleString('pt-BR') },
    ...(pedidos[idx].historico || [])
  ];

  if (typeof _savePedidos === 'function') _savePedidos(pedidos);
  else { try { localStorage.setItem('fa_pedidos', JSON.stringify(pedidos)); } catch(e){} }

  logAction && logAction('Cancelamento PO', 'Compras', `${pedidos[idx].numero} cancelado – ${motivo}`);
  closeModal();
  showToast(`Pedido ${pedidos[idx].numero} cancelado.`, 'warning');
  farcSwitchTab('pedido');
}

// ─── EMITIR PEDIDO DE COMPRA ──────────────────────────────────────────────
function farcEmitirPedido(mapaId) {
  if (typeof emitirPedidoDoMapa === 'function') { emitirPedidoDoMapa(mapaId); return; }

  const m = (typeof _getMapasComp === 'function' ? _getMapasComp() : []).find(x => x.id === mapaId);
  if (!m) return;
  const rfq = (typeof _getRFQFlow === 'function' ? _getRFQFlow() : []).find(r => r.id === m.rfq_id || r.numero === m.rfq_numero);
  const score = _getScoreFornecedor(m.fornecedor_selecionado);

  openModalWide(`Emitir Pedido de Compra – ${m.numero}`, `
    <div style="background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.3);border-radius:10px;padding:14px;margin-bottom:16px">
      <div style="font-size:13px;font-weight:700;color:#22c55e;margin-bottom:8px"><i class="fas fa-check-circle" style="margin-right:6px"></i>Mapa Comparativo Aprovado – Emissão do Pedido de Compra</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:12px">
        <div>
          <span style="color:var(--text-muted)">Fornecedor:</span>
          <strong style="color:var(--text-primary);margin-left:6px">${m.fornecedor_selecionado||'—'}</strong>
        </div>
        <div>
          <span style="color:var(--text-muted)">Score do Fornecedor:</span>
          <span style="margin-left:6px">${_renderScoreForn(m.fornecedor_selecionado)}</span>
        </div>
        <div>
          <span style="color:var(--text-muted)">Valor Total:</span>
          <strong style="color:var(--fa-teal);margin-left:6px;font-size:14px">${_fmtVal(m.valor_total||m.valor)}</strong>
        </div>
        <div>
          <span style="color:var(--text-muted)">Critério Aprovado:</span>
          <strong style="color:var(--text-primary);margin-left:6px">${m.criterio||'—'}</strong>
        </div>
      </div>
    </div>

    <div style="display:flex;gap:12px;margin-bottom:12px;flex-wrap:wrap">
      <div style="flex:1;min-width:180px">
        <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">Condição de Pagamento</label>
        <select class="form-control" id="farc_po_cond_pag">
          <option>30 dias</option>
          <option>30/60 dias</option>
          <option>À vista</option>
          <option>Faturado 28 dias</option>
          <option>Personalizado</option>
        </select>
      </div>
      <div style="flex:1;min-width:150px">
        <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">Prazo de Entrega *</label>
        <input class="form-control" id="farc_po_prazo_ent" type="date" value="${new Date(Date.now()+14*864e5).toISOString().split('T')[0]}">
      </div>
      <div style="flex:1;min-width:150px">
        <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">Local de Entrega</label>
        <input class="form-control" id="farc_po_local" placeholder="Ex: Almoxarifado Principal">
      </div>
    </div>

    <!-- Itens -->
    <div style="font-size:12px;font-weight:700;color:var(--text-secondary);margin-bottom:8px">ITENS DO PEDIDO</div>
    <div style="overflow-x:auto;margin-bottom:12px;max-height:250px;overflow-y:auto">
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr style="background:var(--bg-tertiary)">
          <th style="padding:8px 10px;text-align:left">Descrição</th>
          <th style="padding:8px 10px;text-align:center">Qtd</th>
          <th style="padding:8px 10px;text-align:center">Un</th>
          <th style="padding:8px 10px;text-align:right">Preço Unit.</th>
          <th style="padding:8px 10px;text-align:right">Total</th>
        </tr></thead>
        <tbody>
          ${(() => {
            const cotForn = rfq?.cotacoes?.find(c => c.fornecedor === m.fornecedor_selecionado);
            const itens = cotForn?.itens || rfq?.itens || m.itens || [];
            return itens.map(it => `
              <tr style="border-bottom:1px solid var(--border-color)">
                <td style="padding:7px 10px">${it.descricao||it.item||'—'}</td>
                <td style="padding:7px 10px;text-align:center">${it.qtd||1}</td>
                <td style="padding:7px 10px;text-align:center">${it.unidade||'Un'}</td>
                <td style="padding:7px 10px;text-align:right">${_fmtVal(it.preco||it.valor_unit||0)}</td>
                <td style="padding:7px 10px;text-align:right;font-weight:600;color:var(--fa-teal)">${_fmtVal(it.total||(it.qtd||1)*(it.preco||it.valor_unit||0))}</td>
              </tr>
            `).join('') || '<tr><td colspan="5" style="padding:12px;text-align:center;color:var(--text-muted)">Itens não disponíveis</td></tr>';
          })()}
          <tr style="background:rgba(34,197,94,0.06)">
            <td colspan="4" style="padding:8px 10px;text-align:right;font-weight:700">TOTAL:</td>
            <td style="padding:8px 10px;text-align:right;font-weight:700;color:var(--fa-teal);font-size:14px">${_fmtVal(m.valor_total||m.valor)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div>
      <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">Observações do Pedido</label>
      <textarea class="form-control" id="farc_po_obs" rows="2" placeholder="Instruções especiais de entrega, embalagem, etc..."></textarea>
    </div>
    <div id="farc_po_erro" style="display:none;color:#ef4444;font-size:12px;padding:8px 12px;background:rgba(239,68,68,0.1);border-radius:6px;margin-top:8px"></div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-info" onclick="farcExportarMapaPDF('${mapaId}')"><i class="fas fa-file-pdf"></i> PDF do Mapa</button>
    <button class="btn btn-primary" onclick="_farcConfirmarEmitirPO('${mapaId}')"><i class="fas fa-shopping-bag"></i> Emitir Pedido de Compra</button>
  `);
}

function _farcConfirmarEmitirPO(mapaId) {
  const prazo = document.getElementById('farc_po_prazo_ent')?.value;
  const erroEl = document.getElementById('farc_po_erro');
  if (!prazo) { if(erroEl){erroEl.textContent='Informe o prazo de entrega.';erroEl.style.display='block';} return; }

  const mapas  = typeof _getMapasComp === 'function' ? _getMapasComp() : [];
  const mIdx   = mapas.findIndex(x => x.id === mapaId);
  if (mIdx < 0) return;
  const m = mapas[mIdx];

  const rfq    = (typeof _getRFQFlow === 'function' ? _getRFQFlow() : []).find(r => r.id === m.rfq_id || r.numero === m.rfq_numero);
  const cotForn = rfq?.cotacoes?.find(c => c.fornecedor === m.fornecedor_selecionado);
  const itens   = cotForn?.itens || rfq?.itens || m.itens || [];

  // Gera número de Pedido
  const pedidos = typeof _getPedidos === 'function' ? _getPedidos() : [];
  const numPed  = `PC-${new Date().getFullYear()}-${String(pedidos.length+1).padStart(4,'0')}`;
  const hoje    = new Date().toISOString();

  const novoPedido = {
    id: typeof gerarId === 'function' ? gerarId('PC') : 'PC-'+Date.now(),
    numero: numPed,
    fornecedor: m.fornecedor_selecionado,
    mapa_numero: m.numero,
    rfq_numero: m.rfq_numero,
    rc_numero: m.rc_numero || '',
    itens: itens.map(it => ({
      descricao: it.descricao || it.item || '',
      qtd: it.qtd || 1,
      unidade: it.unidade || 'Un',
      preco_unit: it.preco || it.valor_unit || 0,
      total: it.total || (it.qtd||1)*(it.preco||it.valor_unit||0)
    })),
    valor_total: m.valor_total || m.valor || 0,
    condicao_pagamento: document.getElementById('farc_po_cond_pag')?.value || '30 dias',
    prazo_entrega: new Date(prazo+'T12:00:00').toLocaleDateString('pt-BR'),
    local_entrega: document.getElementById('farc_po_local')?.value.trim() || 'A definir',
    observacoes: document.getElementById('farc_po_obs')?.value.trim() || '',
    status: 'Emitido',
    data_emissao: hoje,
    emitido_por: currentUser?.name || 'Sistema',
    historico: [{ acao: `Pedido emitido a partir do Mapa ${m.numero}`, usuario: currentUser?.name, data: new Date().toLocaleString('pt-BR') }]
  };

  // Salva pedido
  pedidos.unshift(novoPedido);
  if (typeof _savePedidos === 'function') _savePedidos(pedidos);
  else { try { localStorage.setItem('fa_pedidos', JSON.stringify(pedidos)); } catch(e){} }

  // Atualiza status do mapa
  mapas[mIdx].status = 'PC Emitido';
  mapas[mIdx].pc_numero = numPed;
  mapas[mIdx].historico = mapas[mIdx].historico || [];
  mapas[mIdx].historico.unshift({ acao: `Pedido ${numPed} emitido`, usuario: currentUser?.name, data: new Date().toLocaleString('pt-BR') });
  if (typeof _saveMapasComp === 'function') _saveMapasComp(mapas);

  // Atualiza RC
  if (m.rc_id) {
    const rcs = _obterRCLocal();
    const rIdx = rcs.findIndex(r => r.id === m.rc_id);
    if (rIdx >= 0) { rcs[rIdx].status = 'PC Emitido'; if(typeof _saveRC==='function')_saveRC(rcs); }
  }

  // Atualiza RFQ
  if (rfq) {
    const rfqs = typeof _getRFQFlow === 'function' ? _getRFQFlow() : [];
    const rIdx = rfqs.findIndex(r => r.id === rfq.id);
    if (rIdx >= 0) { rfqs[rIdx].status = 'PC Emitido'; if(typeof _saveRFQFlow==='function')_saveRFQFlow(rfqs); }
  }

  // Cria conta a pagar (opcional)
  try {
    const cp = JSON.parse(localStorage.getItem('fa_contas_pagar') || '[]');
    cp.unshift({
      id: 'CP-'+Date.now(),
      numero: `CP-${new Date().getFullYear()}-${String(cp.length+1).padStart(4,'0')}`,
      descricao: `Pedido ${numPed} – ${m.fornecedor_selecionado}`,
      fornecedor: m.fornecedor_selecionado,
      pedido: numPed,
      valor_total: novoPedido.valor_total,
      data_vencimento: new Date(prazo+'T12:00:00').toLocaleDateString('pt-BR'),
      status: 'A Pagar',
      tipo: 'Compra',
      criado_em: hoje
    });
    localStorage.setItem('fa_contas_pagar', JSON.stringify(cp));
  } catch(e) { /* não critica se falhar */ }

  logAction && logAction('Emissão PO', 'Compras', `${numPed} – ${m.fornecedor_selecionado} (${_fmtVal(novoPedido.valor_total)})`);
  closeModal();
  showToast(`✅ Pedido ${numPed} emitido! Fornecedor: ${m.fornecedor_selecionado}`, 'success', 6000);

  // Pergunta se quer gerar PDF
  setTimeout(() => {
    farcGerarPOPDF(novoPedido);
  }, 500);

  farcSwitchTab('pedido');
}

// ════════════════════════════════════════════════════════════════════════════
// VER PEDIDO – MODAL COMPLETO
// ════════════════════════════════════════════════════════════════════════════
function farcVerPedido(pedidoId) {
  const pedidos  = typeof _getPedidos === 'function' ? _getPedidos() : [];
  const p = pedidos.find(x => x.id === pedidoId);
  if (!p) return;

  const isCompras = currentUser && ['admin','compras','diretor'].includes(currentUser.profile);

  // Verifica prazo
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  let vencido = false;
  if (p.prazo_entrega && !['Entregue','Concluído','Cancelado'].includes(p.status)) {
    const partes = p.prazo_entrega.split('/');
    if (partes.length === 3) {
      const d = new Date(partes[2], partes[1]-1, partes[0]); d.setHours(0,0,0,0);
      vencido = d < hoje;
    }
  }

  openModalWide(`<i class="fas fa-shopping-bag" style="color:#22c55e;margin-right:8px"></i>Pedido de Compra – ${p.numero}`, `

    <!-- CABEÇALHO COM STATUS E ALERTAS -->
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px;padding:12px;background:var(--bg-secondary);border-radius:10px">
      ${_farcPedidoBadge(p.status)}
      ${vencido ? `<span style="background:rgba(239,68,68,0.12);color:#ef4444;border-radius:6px;padding:3px 8px;font-size:11px;font-weight:700"><i class="fas fa-exclamation-triangle" style="margin-right:4px"></i>PRAZO VENCIDO</span>` : ''}
      <span style="background:rgba(255,255,255,0.06);padding:3px 8px;border-radius:6px;font-size:11px;color:var(--text-secondary)"><i class="fas fa-credit-card" style="margin-right:4px;color:var(--fa-teal)"></i>${p.condicao_pagamento||'—'}</span>
      ${p.envio_canal ? `<span style="background:rgba(99,102,241,0.1);color:#6366f1;border-radius:6px;padding:3px 8px;font-size:11px"><i class="fas fa-paper-plane" style="margin-right:4px"></i>${p.envio_canal} em ${p.envio_data||'—'}</span>` : ''}
      ${p.status === 'Cancelado' && p.motivo_cancelamento ? `<span style="background:rgba(239,68,68,0.08);color:#ef4444;border-radius:6px;padding:3px 8px;font-size:11px"><i class="fas fa-times-circle" style="margin-right:4px"></i>Cancelado: ${p.motivo_cancelamento}</span>` : ''}
      <span style="margin-left:auto;font-size:11px;color:var(--text-muted)">Emitido por ${p.emitido_por||'—'} em ${_fmtDate2(p.data_emissao)}</span>
    </div>

    <!-- GRID PRINCIPAL -->
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:16px">
      <!-- Col 1: Dados do fornecedor -->
      <div style="padding:14px;background:var(--bg-secondary);border-radius:10px;border:1px solid var(--border-color)">
        <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">
          <i class="fas fa-building" style="margin-right:5px;color:#6366f1"></i>Fornecedor
        </div>
        <div style="font-size:15px;font-weight:700;margin-bottom:6px">${p.fornecedor||'—'}</div>
        <div>${_renderScoreForn(p.fornecedor)}</div>
        <div style="margin-top:10px;font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.4px">Referências</div>
        ${p.mapa_numero ? `<div style="font-size:12px;margin-top:3px"><span style="color:var(--text-muted)">Mapa:</span> <span style="color:#8b5cf6;font-weight:600">${p.mapa_numero}</span></div>` : ''}
        ${p.rfq_numero  ? `<div style="font-size:12px;margin-top:2px"><span style="color:var(--text-muted)">RFQ:</span> <span style="color:#6366f1">${p.rfq_numero}</span></div>` : ''}
        ${p.rc_numero   ? `<div style="font-size:12px;margin-top:2px"><span style="color:var(--text-muted)">RC:</span> <span style="color:var(--fa-teal)">${p.rc_numero}</span></div>` : ''}
      </div>

      <!-- Col 2: Logística -->
      <div style="padding:14px;background:var(--bg-secondary);border-radius:10px;border:1px solid var(--border-color)">
        <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">
          <i class="fas fa-truck" style="margin-right:5px;color:var(--orange)"></i>Logística
        </div>
        <div style="font-size:22px;font-weight:700;color:var(--fa-teal);margin-bottom:4px">${_fmtVal(p.valor_total)}</div>
        <div style="font-size:10px;color:var(--text-muted)">Valor Total</div>
        <div style="margin-top:10px">
          <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.4px">Prazo de Entrega</div>
          <div style="font-size:13px;color:${vencido?'#ef4444':'var(--orange)'};font-weight:600;margin-top:2px">
            ${vencido ? '<i class="fas fa-exclamation-triangle" style="margin-right:4px"></i>' : ''}${p.prazo_entrega||'—'}
          </div>
        </div>
        <div style="margin-top:8px">
          <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.4px">Local de Entrega</div>
          <div style="font-size:12px;color:var(--text-secondary);margin-top:2px">${p.local_entrega||'—'}</div>
        </div>
        ${p.data_entrega ? `
          <div style="margin-top:8px;padding:6px 8px;background:rgba(34,197,94,0.08);border-radius:6px">
            <div style="font-size:10px;color:#22c55e;font-weight:700"><i class="fas fa-box-open" style="margin-right:4px"></i>Entregue em ${p.data_entrega}</div>
            ${p.recebido_por ? `<div style="font-size:10px;color:var(--text-muted)">Recebido por ${p.recebido_por}</div>` : ''}
          </div>
        ` : ''}
      </div>

      <!-- Col 3: Rastreio do envio -->
      <div style="padding:14px;background:var(--bg-secondary);border-radius:10px;border:1px solid var(--border-color)">
        <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">
          <i class="fas fa-paper-plane" style="margin-right:5px;color:#6366f1"></i>Rastreio de Envio
        </div>
        ${(p.envio_log||[]).length ? `
          ${(p.envio_log||[]).map((e,i) => `
            <div style="padding:6px 8px;${i>0?'border-top:1px solid var(--border-color)':''}">
              <div style="font-size:11px;color:var(--text-secondary)"><i class="fas fa-paper-plane" style="color:#6366f1;margin-right:4px;font-size:10px"></i>${e.descricao||e.canal||''}</div>
              <div style="font-size:10px;color:var(--text-muted)">${e.data||''}</div>
            </div>
          `).join('')}
        ` : `<div style="font-size:11px;color:var(--text-muted);font-style:italic">Nenhum envio registrado</div>`}

        ${p.envio_email ? `
          <div style="margin-top:8px;padding:6px 8px;background:rgba(59,130,246,0.08);border-radius:6px;font-size:11px">
            <i class="fas fa-envelope" style="color:#3b82f6;margin-right:4px"></i>${p.envio_email}
          </div>
        ` : ''}
      </div>
    </div>

    <!-- ITENS DO PEDIDO -->
    <div style="font-size:11px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">
      <i class="fas fa-list" style="margin-right:6px;color:var(--orange)"></i>Itens do Pedido
    </div>
    <div style="overflow-x:auto;border:1px solid var(--border-color);border-radius:10px;margin-bottom:14px">
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead>
          <tr style="background:var(--bg-tertiary)">
            <th style="padding:9px 12px;text-align:left;font-size:10px;color:var(--text-muted);font-weight:700;text-transform:uppercase">#</th>
            <th style="padding:9px 12px;text-align:left;font-size:10px;color:var(--text-muted);font-weight:700;text-transform:uppercase">Descrição</th>
            <th style="padding:9px 12px;text-align:center;font-size:10px;color:var(--text-muted);font-weight:700;text-transform:uppercase">Qtd</th>
            <th style="padding:9px 12px;text-align:center;font-size:10px;color:var(--text-muted);font-weight:700;text-transform:uppercase">Un</th>
            <th style="padding:9px 12px;text-align:right;font-size:10px;color:var(--text-muted);font-weight:700;text-transform:uppercase">Preço Unit.</th>
            <th style="padding:9px 12px;text-align:right;font-size:10px;color:var(--text-muted);font-weight:700;text-transform:uppercase">Total</th>
          </tr>
        </thead>
        <tbody>
          ${(p.itens||[]).map((it,i) => `
            <tr style="border-bottom:1px solid var(--border-color)">
              <td style="padding:8px 12px;color:var(--text-muted);font-size:11px">${i+1}</td>
              <td style="padding:8px 12px">${it.descricao||'—'}</td>
              <td style="padding:8px 12px;text-align:center">${it.qtd||1}</td>
              <td style="padding:8px 12px;text-align:center;color:var(--text-muted)">${it.unidade||'Un'}</td>
              <td style="padding:8px 12px;text-align:right;color:var(--text-secondary)">${_fmtVal(it.preco_unit||0)}</td>
              <td style="padding:8px 12px;text-align:right;font-weight:600;color:var(--fa-teal)">${_fmtVal(it.total||0)}</td>
            </tr>
          `).join('')}
          <tr style="background:rgba(0,180,184,0.06)">
            <td colspan="5" style="padding:10px 12px;text-align:right;font-weight:700">VALOR TOTAL:</td>
            <td style="padding:10px 12px;text-align:right;font-weight:700;color:var(--fa-teal);font-size:15px">${_fmtVal(p.valor_total)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    ${p.observacoes ? `
      <div style="padding:10px 14px;background:rgba(255,255,255,0.04);border-radius:8px;font-size:12px;color:var(--text-secondary);margin-bottom:14px;border-left:3px solid var(--fa-teal)">
        <i class="fas fa-comment" style="margin-right:6px;color:var(--fa-teal)"></i>${p.observacoes}
      </div>
    ` : ''}

    <!-- HISTÓRICO -->
    ${(p.historico||[]).length ? `
      <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">
        <i class="fas fa-history" style="margin-right:6px;color:var(--fa-teal)"></i>Histórico do Pedido
      </div>
      <div style="border:1px solid var(--border-color);border-radius:10px;overflow:hidden;max-height:200px;overflow-y:auto">
        ${(p.historico||[]).map((h,i) => `
          <div style="display:flex;align-items:flex-start;gap:10px;padding:8px 14px;${i>0?'border-top:1px solid var(--border-color)':''}">
            <i class="fas fa-circle" style="color:var(--fa-teal);font-size:6px;margin-top:5px;flex-shrink:0"></i>
            <div style="flex:1;font-size:11px;color:var(--text-secondary)">${h.acao||''}</div>
            <div style="font-size:10px;color:var(--text-muted);flex-shrink:0;white-space:nowrap">${h.usuario||''} · ${h.data||''}</div>
          </div>
        `).join('')}
      </div>
    ` : ''}

  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
    <button class="btn btn-secondary" onclick="closeModal();farcVerProcessoCompleto('${p.id}')">
      <i class="fas fa-project-diagram"></i> Ver Processo
    </button>
    ${isCompras && !['Entregue','Concluído','Cancelado'].includes(p.status) ? `
      <button class="btn btn-warning" onclick="closeModal();farcEditarPedido('${p.id}')">
        <i class="fas fa-edit"></i> Editar
      </button>
      <button class="btn" onclick="closeModal();farcAgendarEnvio('${p.id}')"
        style="background:rgba(99,102,241,0.2);border:1px solid rgba(99,102,241,0.4);color:#6366f1">
        <i class="fas fa-paper-plane"></i> Enviar ao Fornecedor
      </button>
    ` : ''}
    ${isCompras && p.status === 'Enviado ao Fornecedor' ? `
      <button class="btn btn-success" onclick="closeModal();farcRegistrarEntrega('${p.id}')">
        <i class="fas fa-box-open"></i> Confirmar Entrega
      </button>
    ` : ''}
    <button class="btn btn-primary" onclick="closeModal();farcGerarPOPDF_by_id('${p.id}')">
      <i class="fas fa-file-pdf"></i> Exportar PDF
    </button>
  `);
}

function farcGerarPOPDF_by_id(pedidoId) {
  const p = (typeof _getPedidos === 'function' ? _getPedidos() : []).find(x => x.id === pedidoId);
  if (p) farcGerarPOPDF(p);
}

// Gera PDF do pedido de compra
function farcGerarPOPDF(pedido) {
  if (!pedido) return;
  const score = _getScoreFornecedor(pedido.fornecedor);

  const html = `
    <!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
    <title>Pedido de Compra ${pedido.numero}</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 12px; color: #333; margin: 0; padding: 24px; }
      .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #0d6efd; padding-bottom: 16px; margin-bottom: 20px; }
      .header h1 { color: #0d6efd; margin: 0; font-size: 20px; }
      .header .num { font-size: 14px; font-weight: bold; color: #333; }
      .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; padding: 14px; background: #f8f9fa; border-radius: 8px; }
      .info-item label { display: block; font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 3px; }
      .info-item span { font-size: 13px; font-weight: 600; color: #333; }
      table { width: 100%; border-collapse: collapse; margin: 12px 0; }
      thead th { background: #0d6efd; color: #fff; padding: 9px; text-align: left; font-size: 11px; }
      tbody td { padding: 8px 9px; border-bottom: 1px solid #e9ecef; }
      tbody tr:last-child td { border-bottom: none; font-weight: bold; background: #e7f1ff; }
      .badge { display: inline-block; padding: 3px 10px; border-radius: 4px; font-size: 11px; font-weight: bold; background: #cce5ff; color: #004085; }
      .footer { margin-top: 40px; display: flex; justify-content: space-between; font-size: 11px; color: #999; border-top: 1px solid #dee2e6; padding-top: 12px; }
      .sign { text-align: center; }
      .sign-line { border-top: 1px solid #333; width: 200px; margin: 40px auto 6px; }
      .obs { background: #fff3cd; border: 1px solid #ffc107; border-radius: 6px; padding: 10px; margin: 12px 0; font-size: 12px; }
      @media print { body { margin: 0; } }
    </style>
    </head><body>
    <div class="header">
      <div>
        <div style="font-size:10px;color:#888;margin-bottom:4px">FRASER ALEXANDER</div>
        <h1>PEDIDO DE COMPRA</h1>
        <div class="num">${pedido.numero}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:11px;color:#888">Emitido em</div>
        <div style="font-size:13px;font-weight:600">${_fmtDate2(pedido.data_emissao)}</div>
        <div style="margin-top:6px"><span class="badge">${pedido.status}</span></div>
      </div>
    </div>

    <div class="info-grid">
      <div>
        <div class="info-item"><label>Fornecedor</label><span>${pedido.fornecedor||'—'}</span></div>
        <div class="info-item" style="margin-top:10px"><label>Score do Fornecedor</label><span>${score ? score.media+'/5 ('+score.total+' avaliações)' : 'Não avaliado'}</span></div>
      </div>
      <div>
        <div class="info-item"><label>Prazo de Entrega</label><span>${pedido.prazo_entrega||'—'}</span></div>
        <div class="info-item" style="margin-top:10px"><label>Cond. de Pagamento</label><span>${pedido.condicao_pagamento||'—'}</span></div>
        <div class="info-item" style="margin-top:10px"><label>Local de Entrega</label><span>${pedido.local_entrega||'—'}</span></div>
      </div>
    </div>

    <table>
      <thead><tr>
        <th>Item</th><th>Descrição</th><th>Qtd</th><th>Un</th><th>Preço Unit.</th><th>Total</th>
      </tr></thead>
      <tbody>
        ${(pedido.itens||[]).map((it, i) => `
          <tr>
            <td>${i+1}</td>
            <td>${it.descricao||'—'}</td>
            <td>${it.qtd||1}</td>
            <td>${it.unidade||'Un'}</td>
            <td>R$ ${(it.preco_unit||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
            <td><strong>R$ ${(it.total||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</strong></td>
          </tr>
        `).join('')}
        <tr>
          <td colspan="5" style="text-align:right">VALOR TOTAL:</td>
          <td>R$ ${(pedido.valor_total||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
        </tr>
      </tbody>
    </table>

    ${pedido.observacoes ? `<div class="obs"><strong>Obs:</strong> ${pedido.observacoes}</div>` : ''}

    <div style="display:flex;justify-content:space-around;margin-top:40px">
      <div class="sign">
        <div class="sign-line"></div>
        <div>Comprador / Suprimentos</div>
        <div style="font-size:10px;color:#888">${pedido.emitido_por||'—'}</div>
      </div>
      <div class="sign">
        <div class="sign-line"></div>
        <div>Aprovação / Gerência</div>
      </div>
      <div class="sign">
        <div class="sign-line"></div>
        <div>Fornecedor – Acuse de Recebimento</div>
      </div>
    </div>

    <div class="footer">
      <span>Fraser Alexander ERP – Documento gerado em ${new Date().toLocaleString('pt-BR')}</span>
      <span>Referência Mapa: ${pedido.mapa_numero||'—'} | RFQ: ${pedido.rfq_numero||'—'}</span>
    </div>
    </body></html>
  `;

  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); w.print(); }
}

// ─── CONFIG APROVAÇÃO (MODAL ADMIN) ──────────────────────────────────────
function farcAbrirConfigAprovacao() {
  if (typeof abrirConfigAprovacao === 'function') { abrirConfigAprovacao(); return; }
  const cfg = _getConfigAprovacao();

  openModalWide('⚙️ Configuração do Fluxo de Aprovação', `
    <div style="font-size:12px;color:var(--text-secondary);margin-bottom:16px;padding:12px;background:rgba(0,180,184,0.06);border:1px solid rgba(0,180,184,0.2);border-radius:8px">
      <i class="fas fa-info-circle" style="color:var(--fa-teal);margin-right:6px"></i>
      Configure os <strong>3 estágios de aprovação</strong>. Você pode definir o nome do estágio, os perfis autorizados, e cadastrar aprovadores nomeados (nome + e-mail).
      Esta configuração se aplica ao fluxo de OS, RC e Mapa Comparativo.
    </div>

    ${[1,2,3].map(i => {
      const e = i===1?cfg.estagio1:i===2?cfg.estagio2:cfg.estagio3;
      const perfisOpts = ['supervisor','operacao','compras','financeiro','diretor','admin'];
      const aprovNom = e?.aprovadores_nomeados || [];
      return `
        <div style="padding:14px;border:1px solid var(--border-color);border-radius:10px;margin-bottom:14px">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
            <span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;background:var(--fa-teal);border-radius:50%;color:#fff;font-size:12px;font-weight:700;flex-shrink:0">${i}</span>
            <div style="font-size:14px;font-weight:700;color:var(--fa-teal)">Estágio ${i}</div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;flex-wrap:wrap">
            <!-- Coluna 1: Nome e Perfis -->
            <div>
              <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">Nome do Estágio</label>
              <input class="form-control" id="farc_cfg_e${i}_nome" value="${e?.nome||'Estágio '+i}" style="margin-bottom:10px">
              <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:6px">Perfis Autorizados</label>
              <div style="display:flex;flex-wrap:wrap;gap:6px">
                ${perfisOpts.map(p => `
                  <label style="display:flex;align-items:center;gap:4px;font-size:11px;cursor:pointer;padding:4px 8px;border:1px solid ${(e?.perfis||[]).includes(p)?'var(--fa-teal)':'var(--border-color)'};border-radius:6px;background:${(e?.perfis||[]).includes(p)?'rgba(0,180,184,0.12)':'transparent'}">
                    <input type="checkbox" class="farc-cfg-perfil-e${i}" value="${p}" ${(e?.perfis||[]).includes(p)?'checked':''} style="accent-color:var(--fa-teal)">
                    ${p}
                  </label>
                `).join('')}
              </div>
            </div>
            <!-- Coluna 2: Aprovadores Nomeados -->
            <div>
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
                <label style="font-size:11px;color:var(--text-muted)">Aprovadores Nomeados (opcional)</label>
                <button onclick="_farcAddAprovadorNomeado(${i})" class="btn btn-secondary btn-sm" style="font-size:10px;padding:2px 8px"><i class="fas fa-plus"></i> Adicionar</button>
              </div>
              <div id="farc_cfg_e${i}_aprovadores" style="max-height:160px;overflow-y:auto">
                ${aprovNom.length === 0
                  ? `<div style="font-size:11px;color:var(--text-muted);font-style:italic;padding:8px 0">Nenhum aprovador cadastrado</div>`
                  : aprovNom.map((ap, ai) => `
                    <div class="farc-aprov-nomeado-e${i}" style="display:flex;gap:6px;margin-bottom:6px;align-items:center">
                      <input class="form-control farc-aprov-nome-e${i}" placeholder="Nome" value="${ap.nome||''}" style="flex:1;font-size:11px;padding:5px 8px">
                      <input class="form-control farc-aprov-email-e${i}" placeholder="E-mail" value="${ap.email||''}" style="flex:1.5;font-size:11px;padding:5px 8px">
                      <button onclick="this.closest('.farc-aprov-nomeado-e${i}').remove()" class="btn btn-danger btn-sm btn-icon" style="flex-shrink:0"><i class="fas fa-trash"></i></button>
                    </div>
                  `).join('')
                }
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('')}

    <div style="padding:12px;border:1px solid rgba(0,180,184,0.3);border-radius:8px;background:rgba(0,180,184,0.06);margin-bottom:14px">
      <div style="font-size:12px;font-weight:700;color:var(--fa-teal);margin-bottom:4px"><i class="fas fa-user-tie" style="margin-right:6px"></i>Comprador / Suprimentos (fixo)</div>
      <div style="font-size:11px;color:var(--text-muted)">Perfis: compras, admin – Recebe RC aprovada e inicia processo de cotação (RFQ)</div>
    </div>

    <!-- ═══ SEÇÃO: PERFIS DA ABA OS ═══ -->
    <div style="margin-top:6px;padding:14px;border:2px solid rgba(230,126,34,0.4);border-radius:10px;background:rgba(230,126,34,0.04)">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
        <span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;background:var(--orange);border-radius:50%;color:#fff;font-size:14px;flex-shrink:0">
          <i class="fas fa-clipboard-list"></i>
        </span>
        <div style="font-size:14px;font-weight:700;color:var(--orange)">Acesso à Aba Ordens de Serviço</div>
      </div>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:10px">
        Selecione os perfis que podem visualizar e criar Ordens de Serviço. Por padrão: admin, diretor, operacao, supervisor.
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
        <div>
          <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:6px;font-weight:600">Perfis com acesso à aba OS</label>
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            ${['supervisor','operacao','compras','financeiro','diretor','ssma','rh','admin'].map(p => {
              const cfgOS = _getConfigPerfisOS();
              const checked = (cfgOS.perfis||['admin','diretor','operacao','supervisor']).includes(p);
              return `
                <label style="display:flex;align-items:center;gap:4px;font-size:11px;cursor:pointer;padding:4px 8px;border:1px solid ${checked?'var(--orange)':'var(--border-color)'};border-radius:6px;background:${checked?'rgba(230,126,34,0.12)':'transparent'}">
                  <input type="checkbox" class="farc-cfg-perfil-os" value="${p}" ${checked?'checked':''} style="accent-color:var(--orange)">
                  ${p}
                </label>
              `;
            }).join('')}
          </div>
        </div>
        <div>
          <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:6px;font-weight:600">Perfis que podem emitir RC (a partir de OS aprovada)</label>
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            ${['supervisor','operacao','compras','financeiro','diretor','ssma','admin'].map(p => {
              const cfgRC = _getConfigPerfisEmissaoRC();
              const checked = (cfgRC.perfis||['admin','compras','diretor','operacao','supervisor']).includes(p);
              return `
                <label style="display:flex;align-items:center;gap:4px;font-size:11px;cursor:pointer;padding:4px 8px;border:1px solid ${checked?'#3b82f6':'var(--border-color)'};border-radius:6px;background:${checked?'rgba(59,130,246,0.12)':'transparent'}">
                  <input type="checkbox" class="farc-cfg-perfil-rc" value="${p}" ${checked?'checked':''} style="accent-color:#3b82f6">
                  ${p}
                </label>
              `;
            }).join('')}
          </div>
          <div style="font-size:10px;color:var(--text-muted);margin-top:6px">
            <i class="fas fa-info-circle" style="margin-right:3px"></i>
            O perfil selecionado pode abrir RCs, mas só Compras/Admin/Diretor processa (RFQ, cotação, mapa, PO).
          </div>
        </div>
      </div>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="_farcSalvarConfigAprovacao()"><i class="fas fa-save"></i> Salvar Configuração</button>
  `);
}

function _farcAddAprovadorNomeado(estagio) {
  const cont = document.getElementById(`farc_cfg_e${estagio}_aprovadores`);
  if (!cont) return;
  // Remove mensagem vazia se existir
  const vazia = cont.querySelector('div[style*="font-style:italic"]');
  if (vazia) vazia.remove();

  const div = document.createElement('div');
  div.className = `farc-aprov-nomeado-e${estagio}`;
  div.style.cssText = 'display:flex;gap:6px;margin-bottom:6px;align-items:center';
  div.innerHTML = `
    <input class="form-control farc-aprov-nome-e${estagio}" placeholder="Nome do aprovador" style="flex:1;font-size:11px;padding:5px 8px">
    <input class="form-control farc-aprov-email-e${estagio}" placeholder="E-mail" style="flex:1.5;font-size:11px;padding:5px 8px">
    <button onclick="this.closest('.farc-aprov-nomeado-e${estagio}').remove()" class="btn btn-danger btn-sm btn-icon" style="flex-shrink:0"><i class="fas fa-trash"></i></button>
  `;
  cont.appendChild(div);
}

function _farcSalvarConfigAprovacao() {
  const coletarAprovadores = (estagio) => {
    const rows = document.querySelectorAll(`.farc-aprov-nomeado-e${estagio}`);
    const result = [];
    rows.forEach(row => {
      const nome = row.querySelector(`.farc-aprov-nome-e${estagio}`)?.value.trim();
      const email = row.querySelector(`.farc-aprov-email-e${estagio}`)?.value.trim();
      if (nome) result.push({ nome, email: email || '' });
    });
    return result;
  };

  const nova = {
    estagio1: {
      nome: document.getElementById('farc_cfg_e1_nome')?.value.trim()||'Estágio 1',
      perfis: Array.from(document.querySelectorAll('.farc-cfg-perfil-e1:checked')).map(cb=>cb.value),
      aprovadores_nomeados: coletarAprovadores(1)
    },
    estagio2: {
      nome: document.getElementById('farc_cfg_e2_nome')?.value.trim()||'Estágio 2',
      perfis: Array.from(document.querySelectorAll('.farc-cfg-perfil-e2:checked')).map(cb=>cb.value),
      aprovadores_nomeados: coletarAprovadores(2)
    },
    estagio3: {
      nome: document.getElementById('farc_cfg_e3_nome')?.value.trim()||'Estágio 3',
      perfis: Array.from(document.querySelectorAll('.farc-cfg-perfil-e3:checked')).map(cb=>cb.value),
      aprovadores_nomeados: coletarAprovadores(3)
    },
    comprador: { nome: 'Comprador (Suprimentos)', perfis: ['compras','admin'] }
  };
  if (typeof _saveAprovacaoConfig === 'function') _saveAprovacaoConfig(nova);
  else localStorage.setItem('fa_aprovacao_config', JSON.stringify(nova));

  // Salva configuração de perfis da aba OS
  const perfisOS = Array.from(document.querySelectorAll('.farc-cfg-perfil-os:checked')).map(cb => cb.value);
  if (perfisOS.length > 0) {
    _saveConfigPerfisOS({ perfis: perfisOS });
  }

  // Salva configuração de perfis para emissão de RC
  const perfisRC = Array.from(document.querySelectorAll('.farc-cfg-perfil-rc:checked')).map(cb => cb.value);
  if (perfisRC.length > 0) {
    _saveConfigPerfisEmissaoRC({ perfis: perfisRC });
  }

  logAction && logAction('Config Aprovação', 'Admin', `Fluxo de aprovação atualizado. Perfis OS: [${perfisOS.join(',')}]. Perfis RC: [${perfisRC.join(',')}]`);
  closeModal();
  showToast('✅ Configuração salva! Perfis de acesso e aprovadores registrados.', 'success');
  renderFluxoAprovacaoRC();
}

// ─── EXPORTAR PDF DO PEDIDO (alias de farcGerarPOPDF_by_id) ──────────────────
function farcExportarPedidoPDF(pedidoId) {
  farcGerarPOPDF_by_id(pedidoId);
}

// ─── RASTREABILIDADE COMPLETA OS→RC→RFQ→MAPA→PO ──────────────────────────────
function farcVerRastreabilidade(osId) {
  const fluxoOS = _getFluxoOS().find(f => f.os_id === osId);
  const rcs     = (_obterRCLocal()).filter(r => r.os_vinculada === osId);
  const rfqs    = (typeof _getRFQFlow === 'function' ? _getRFQFlow() : []).filter(r =>
    rcs.some(rc => rc.id === r.rc_id || rc.numero === r.rc_numero)
  );
  const mapas   = (typeof _getMapasComp === 'function' ? _getMapasComp() : []).filter(m =>
    rfqs.some(r => r.id === m.rfq_id || r.numero === m.rfq_numero)
  );
  const pedidos = (typeof _getPedidos === 'function' ? _getPedidos() : []).filter(p =>
    mapas.some(m => m.id === p.mapa_id || m.numero === p.mapa_numero)
  );

  const stepLine = (label, items, color, icon) => {
    if (!items.length && !label.includes('OS')) return '';
    return `
      <div style="margin-bottom:16px;padding:12px;border-left:3px solid ${color};background:${color}0d;border-radius:0 8px 8px 0">
        <div style="font-size:11px;font-weight:700;color:${color};text-transform:uppercase;margin-bottom:8px">
          <i class="fas ${icon}" style="margin-right:6px"></i>${label}
        </div>
        ${items.map(it => `<div style="font-size:12px;color:var(--text-secondary);padding:4px 0;border-bottom:1px solid ${color}22">${it}</div>`).join('') || '<div style="font-size:11px;color:var(--text-muted);font-style:italic">—</div>'}
      </div>
    `;
  };

  openModalWide(`Rastreabilidade – ${osId}`, `
    <div style="font-size:13px;font-weight:700;color:var(--text-secondary);margin-bottom:16px">
      Trilha completa: OS → Aprovação → RC → RFQ → Mapa Comparativo → Pedido de Compra
    </div>

    ${stepLine('OS – Ordem de Serviço', [
      fluxoOS
        ? `<strong>${osId}</strong> – ${fluxoOS.os_descricao} | Status: ${fluxoOS.status} | ${fluxoOS.itens?.length||0} item(ns)`
        : `${osId} (OS não encontrada no fluxo)`
    ], '#64748b', 'fa-clipboard-list')}

    ${stepLine('Estágios de Aprovação', [
      ...(fluxoOS?.estagios_aprovacao||[]).map(e =>
        `Estágio ${e.estagio}: <strong>${e.status}</strong> por ${e.aprovador} em ${e.data}${e.obs?' – '+e.obs:''}`
      )
    ], '#f59e0b', 'fa-user-check')}

    ${stepLine('RC – Requisições de Compra', rcs.map(r =>
      `<strong>${r.numero}</strong> – ${r.titulo.substring(0,60)} | ${r.itens?.length||0} itens | ${_fmtVal(r.valor_total)} | ${r.status}`
    ), '#3b82f6', 'fa-file-alt')}

    ${stepLine('RFQ – Processos de Cotação', rfqs.map(r =>
      `<strong>${r.numero}</strong> – ${r.titulo?.substring(0,50)||''} | ${r.fornecedores?.length||0} fornecedores | ${r.cotacoes?.length||0} propostas | ${r.status}`
    ), '#6366f1', 'fa-paper-plane')}

    ${stepLine('Mapa Comparativo', mapas.map(m =>
      `<strong>${m.numero}</strong> | Fornecedor: ${m.fornecedor_selecionado||'—'} | ${_fmtVal(m.valor_total||m.valor)} | ${m.status}`
    ), '#8b5cf6', 'fa-balance-scale')}

    ${stepLine('PO – Pedido de Compra', pedidos.map(p =>
      `<strong>${p.numero||p.id}</strong> | ${p.fornecedor||'—'} | ${_fmtVal(p.valor_total)} | ${p.status}`
    ), '#22c55e', 'fa-shopping-bag')}

    ${fluxoOS?.historico?.length ? `
      <div style="margin-top:8px;padding:12px;background:rgba(255,255,255,0.03);border-radius:8px">
        <div style="font-size:11px;font-weight:700;color:var(--text-muted);margin-bottom:8px;text-transform:uppercase">Log de Auditoria</div>
        ${fluxoOS.historico.slice(0,8).map(h => `
          <div style="font-size:11px;color:var(--text-secondary);padding:4px 0;border-bottom:1px solid var(--border-color)">
            <span style="color:var(--text-muted)">${h.data}</span> – ${h.acao} <span style="color:var(--fa-teal)">[${h.usuario||'Sistema'}]</span>
          </div>
        `).join('')}
      </div>
    ` : ''}
  `, `<button class="btn btn-secondary" onclick="closeModal()">Fechar</button>`);
}

// ─── KPIs DO FLUXO COMPLETO ──────────────────────────────────────────────────
function _farcRenderKPIs() {
  const fluxoOS = _getFluxoOS();
  const rcs     = _obterRCLocal();
  const rfqs    = typeof _getRFQFlow === 'function' ? _getRFQFlow() : [];
  const mapas   = typeof _getMapasComp === 'function' ? _getMapasComp() : [];
  const pedidos = typeof _getPedidos === 'function' ? _getPedidos() : [];

  const totalPO    = pedidos.reduce((a, p) => a + (p.valor_total||0), 0);
  const rejRCs     = rcs.filter(r => r.status === 'Rejeitada').length;
  const taxaRejeic = rcs.length ? Math.round((rejRCs/rcs.length)*100) : 0;

  // Lead time RC→PO (em dias)
  const leadTimes = pedidos.map(p => {
    const rc = rcs.find(r => r.numero === p.rc_numero || r.id === p.rc_id);
    if (!rc?.data_criacao || !p.data_emissao) return null;
    const diff = (new Date(p.data_emissao) - new Date(rc.data_criacao)) / (1000*60*60*24);
    return isNaN(diff) ? null : Math.round(diff);
  }).filter(x => x !== null);
  const avgLead = leadTimes.length ? Math.round(leadTimes.reduce((a,b)=>a+b,0)/leadTimes.length) : null;

  return `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:18px">
      <div style="background:var(--bg-card2);padding:14px;border-radius:10px;border:1px solid var(--border-color);text-align:center">
        <div style="font-size:22px;font-weight:700;color:#f59e0b">${fluxoOS.filter(f=>f.status.includes('Aguard')||f.status.includes('Novo')).length}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px">OS em Aprovação</div>
      </div>
      <div style="background:var(--bg-card2);padding:14px;border-radius:10px;border:1px solid var(--border-color);text-align:center">
        <div style="font-size:22px;font-weight:700;color:#3b82f6">${rcs.filter(r=>r.status==='Aprovada – Aguardando Comprador').length}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px">RC Aguard. Comprador</div>
      </div>
      <div style="background:var(--bg-card2);padding:14px;border-radius:10px;border:1px solid var(--border-color);text-align:center">
        <div style="font-size:22px;font-weight:700;color:#6366f1">${rfqs.filter(r=>['Em Cotação','Aguardando Cotações'].includes(r.status)).length}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px">RFQs em Cotação</div>
      </div>
      <div style="background:var(--bg-card2);padding:14px;border-radius:10px;border:1px solid var(--border-color);text-align:center">
        <div style="font-size:22px;font-weight:700;color:#8b5cf6">${mapas.filter(m=>m.status==='Aguardando Aprovação').length}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px">Mapas p/ Aprovar</div>
      </div>
      <div style="background:var(--bg-card2);padding:14px;border-radius:10px;border:1px solid var(--border-color);text-align:center">
        <div style="font-size:22px;font-weight:700;color:#22c55e">${pedidos.length}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px">Pedidos Emitidos</div>
      </div>
      <div style="background:var(--bg-card2);padding:14px;border-radius:10px;border:1px solid var(--border-color);text-align:center">
        <div style="font-size:18px;font-weight:700;color:var(--fa-teal)">${_fmtVal(totalPO)}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px">Volume Total em POs</div>
      </div>
      <div style="background:var(--bg-card2);padding:14px;border-radius:10px;border:1px solid var(--border-color);text-align:center">
        <div style="font-size:22px;font-weight:700;color:${taxaRejeic>20?'#ef4444':taxaRejeic>10?'#f59e0b':'#22c55e'}">${taxaRejeic}%</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px">Taxa de Rejeição RC</div>
      </div>
      <div style="background:var(--bg-card2);padding:14px;border-radius:10px;border:1px solid var(--border-color);text-align:center">
        <div style="font-size:22px;font-weight:700;color:${avgLead===null?'var(--text-muted)':avgLead>30?'#ef4444':avgLead>15?'#f59e0b':'#22c55e'}">${avgLead===null?'—':avgLead+'d'}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px">Lead Time RC→PO</div>
      </div>
    </div>
  `;
}

// ─── HOOK INTERNO PARA OS.JS: registra OS no fluxo ao criar/editar ──────────
// Esta função deve ser chamada por os.js após salvarNovaOS() e salvarEdicaoOS()
function _criarRequisicaoDeOS(os, itens, tipoCompra) {
  // Garante que a OS tem os itens_compra
  if (!os.itens_compra && itens && itens.length > 0) {
    os.itens_compra = itens;
  }
  os.precisa_compra = (tipoCompra === 'Material' || tipoCompra === 'material');
  os.precisa_servico = (tipoCompra === 'Serviço Externo' || tipoCompra === 'servico');
  os.tipo_compra = tipoCompra || 'Material';

  // Registra no fluxo de aprovação
  _notificarOSParaFluxo(os, '');
  showToast(`OS ${os.id} inserida na fila de Aprovação de OS!`, 'info', 4000);
}

// ─── RC AVULSA (sem OS vinculada) ─────────────────────────────────────────
function farcEmitirRCAvulsa() {
  if (!_podeEmitirRC()) {
    showToast('Seu perfil não tem permissão para emitir RC.', 'error');
    return;
  }
  const hoje = new Date().toISOString().split('T')[0];

  // Pré-carrega projetos e contratos para o select
  const projetoOpts = (() => {
    try {
      const projetos  = JSON.parse(localStorage.getItem('fa_projetos_gantt') || '[]');
      const contratos = JSON.parse(localStorage.getItem('fa_contratos') || '[]');
      let opts = '';
      if (projetos.length) {
        opts += '<optgroup label="Projetos">';
        projetos.forEach(p => {
          opts += `<option value="proj:${p.id}">📋 ${p.nome||p.id}${p.contrato_id?' ['+p.contrato_id+']':''}</option>`;
        });
        opts += '</optgroup>';
      }
      if (contratos.length) {
        opts += '<optgroup label="Contratos / Centro de Custo">';
        contratos.filter(c => !c.status || c.status === 'Ativo').forEach(c => {
          opts += `<option value="cont:${c.id}">📄 ${c.id} – ${c.cliente||c.objeto||''}</option>`;
        });
        opts += '</optgroup>';
      }
      return opts || '<option value="" disabled>Nenhum projeto/contrato cadastrado</option>';
    } catch(e) { return ''; }
  })();

  openModalWide('Nova Requisição de Compra', `
    <div style="max-height:80vh;overflow-y:auto;padding-right:4px">
    <div style="background:rgba(59,130,246,0.06);border:1px solid rgba(59,130,246,0.2);border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:var(--text-secondary)">
      <i class="fas fa-info-circle" style="color:#3b82f6;margin-right:6px"></i>
      Requisição avulsa (não vinculada a uma OS). Preencha os dados e adicione os itens.
    </div>
    ${['admin','compras','diretor'].includes(currentUser?.profile) ? `
    <div style="background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.25);border-radius:8px;padding:8px 14px;margin-bottom:12px;font-size:12px;color:#15803d">
      <i class="fas fa-check-circle" style="margin-right:6px"></i>
      <strong>Auto-aprovação ativa:</strong> sua RC será criada já como <em>Aprovada – Aguardando Comprador</em> e aparecerá imediatamente na aba Cotações.
    </div>` : ''}

    <!-- Campos básicos -->
    <div style="display:flex;gap:12px;margin-bottom:12px;flex-wrap:wrap">
      <div style="flex:2;min-width:200px">
        <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">Título da RC *</label>
        <input class="form-control" id="farcAvulsa_titulo" placeholder="Ex.: Materiais de escritório">
      </div>
      <div style="flex:1;min-width:120px">
        <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">Prazo de Necessidade *</label>
        <input class="form-control" id="farcAvulsa_prazo" type="date" value="${hoje}">
      </div>
      <div style="flex:1;min-width:120px">
        <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">Urgência</label>
        <select class="form-control" id="farcAvulsa_urgencia">
          <option>Normal</option><option>Urgente</option><option>Crítico</option>
        </select>
      </div>
    </div>
    <div style="margin-bottom:12px">
      <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">Observações</label>
      <input class="form-control" id="farcAvulsa_obs" placeholder="Justificativa ou detalhes adicionais">
    </div>

    <!-- Modalidade -->
    <div style="margin-bottom:12px">
      <label style="font-size:11px;font-weight:700;color:var(--text-secondary);display:block;margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px">Modalidade *</label>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;padding:7px 14px;border:2px solid rgba(5,150,105,0.4);border-radius:8px;font-size:12px;font-weight:600;color:#059669">
          <input type="radio" name="farcAvulsa_modalidade" value="Spot" checked style="accent-color:#059669">
          <i class="fas fa-bolt"></i> Spot (pontual)
        </label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;padding:7px 14px;border:2px solid rgba(124,58,237,0.4);border-radius:8px;font-size:12px;font-weight:600;color:#7c3aed">
          <input type="radio" name="farcAvulsa_modalidade" value="Recorrente" style="accent-color:#7c3aed">
          <i class="fas fa-sync-alt"></i> Recorrente
        </label>
      </div>
    </div>

    <!-- Itens -->
    <div style="font-size:12px;font-weight:700;color:var(--text-secondary);margin-bottom:8px">ITENS
      <span style="font-size:10px;font-weight:400;color:var(--text-muted);margin-left:6px">
        <i class="fas fa-sitemap" style="color:#3b82f6"></i> Vincule a linha WBS em cada item
      </span>
    </div>
    <div id="farcAvulsa_itens">
      <div class="farcAvulsa-item-row" style="background:var(--bg-card2);padding:10px 12px;border-radius:8px;margin-bottom:6px;display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap">
        <div style="flex:3;min-width:160px"><label style="font-size:10px;color:var(--text-muted)">Descrição</label><input class="form-control farcAvulsa-item-desc" placeholder="Descrição do item"></div>
        <div style="flex:0.7;min-width:60px"><label style="font-size:10px;color:var(--text-muted)">Qtd</label><input class="form-control farcAvulsa-item-qtd" type="number" min="1" value="1" oninput="_farcAvulsaCalcTotal()"></div>
        <div style="flex:0.6;min-width:52px"><label style="font-size:10px;color:var(--text-muted)">Un</label><input class="form-control farcAvulsa-item-un" value="Un"></div>
        <div style="flex:1.2;min-width:95px"><label style="font-size:10px;color:var(--text-muted)">Valor Unit. (R$)</label><input class="form-control farcAvulsa-item-val" type="number" min="0" step="0.01" value="0" oninput="_farcAvulsaCalcTotal()"></div>
        <div style="flex:0.9;min-width:100px"><label style="font-size:10px;color:var(--text-muted)">Tipo</label><select class="form-control farcAvulsa-item-tipo" style="font-size:12px;padding:6px 8px"><option value="material">📦 Material</option><option value="servico">🔧 Serviço</option><option value="equipamento">⚙️ Equipamento</option></select></div>
        <div style="flex:1.5;min-width:140px">
          <label style="font-size:10px;color:#3b82f6;display:flex;align-items:center;gap:3px"><i class="fas fa-sitemap"></i> Linha WBS</label>
          <select class="form-control farcAvulsa-item-wbs" style="font-size:11px;padding:4px 6px">
            ${_farcWBSInlineOptions()}
          </select>
        </div>
        <div style="flex:0.3"><button class="btn btn-danger btn-sm btn-icon" onclick="this.closest('.farcAvulsa-item-row').remove();_farcAvulsaCalcTotal()" title="Remover"><i class="fas fa-trash"></i></button></div>
      </div>
    </div>
    <button onclick="_farcAvulsaAddItem()" class="btn btn-secondary btn-sm" style="margin-top:4px"><i class="fas fa-plus"></i> Adicionar Item</button>
    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:rgba(59,130,246,0.06);border-radius:8px;margin-top:12px">
      <span style="font-size:12px;color:var(--text-muted)">Total Estimado:</span>
      <span id="farcAvulsa_total" style="font-size:20px;font-weight:700;color:#3b82f6">R$ 0,00</span>
    </div>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="_farcSalvarRCAvulsa()">
      <i class="fas fa-${['admin','compras','diretor'].includes(currentUser?.profile) ? 'paper-plane' : 'save'}"></i>
      ${['admin','compras','diretor'].includes(currentUser?.profile) ? 'Emitir RC e ir para Cotações' : 'Emitir RC'}
    </button>
  `);
}

// Carrega WBS para o formulário de RC Avulsa (reutiliza lógica da RC de OS)
// _farcAvulsaCarregarWBS removida — WBS agora é por item, não por formulário
// Helper mantido para compatibilidade mas sem efeito
function _farcAvulsaCarregarWBS() { /* deprecated: WBS por item */ }

function _farcAvulsaAddItem() {
  const cont = document.getElementById('farcAvulsa_itens');
  if (!cont) return;
  const div = document.createElement('div');
  div.innerHTML = `
    <div class="farcAvulsa-item-row" style="background:var(--bg-card2);padding:10px 12px;border-radius:8px;margin-bottom:6px;display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap">
      <div style="flex:3;min-width:160px"><input class="form-control farcAvulsa-item-desc" placeholder="Descri\u00e7\u00e3o do item"></div>
      <div style="flex:0.7;min-width:60px"><input class="form-control farcAvulsa-item-qtd" type="number" min="1" value="1" oninput="_farcAvulsaCalcTotal()"></div>
      <div style="flex:0.6;min-width:52px"><input class="form-control farcAvulsa-item-un" value="Un"></div>
      <div style="flex:1.2;min-width:95px"><input class="form-control farcAvulsa-item-val" type="number" min="0" step="0.01" value="0" oninput="_farcAvulsaCalcTotal()"></div>
      <div style="flex:0.9;min-width:100px"><select class="form-control farcAvulsa-item-tipo" style="font-size:12px;padding:6px 8px"><option value="material">\u{1F4E6} Material</option><option value="servico">\u{1F527} Servi\u00e7o</option><option value="equipamento">\u{2699}\uFE0F Equipamento</option></select></div>
      <div style="flex:1.5;min-width:140px">
        <select class="form-control farcAvulsa-item-wbs" style="font-size:11px;padding:4px 6px">
          ${_farcWBSInlineOptions()}
        </select>
      </div>
      <div style="flex:0.3"><button class="btn btn-danger btn-sm btn-icon" onclick="this.closest('.farcAvulsa-item-row').remove();_farcAvulsaCalcTotal()"><i class="fas fa-trash"></i></button></div>
    </div>`;
  cont.appendChild(div.firstElementChild);
}

function _farcAvulsaCalcTotal() {
  const qtds = document.querySelectorAll('#farcAvulsa_itens .farcAvulsa-item-qtd');
  const vals = document.querySelectorAll('#farcAvulsa_itens .farcAvulsa-item-val');
  let total = 0;
  qtds.forEach((q,i) => { total += (parseFloat(q.value)||0)*(parseFloat(vals[i]?.value)||0); });
  const el = document.getElementById('farcAvulsa_total');
  if (el) el.textContent = _fmtVal(total);
}

function _farcSalvarRCAvulsa() {
  const titulo     = document.getElementById('farcAvulsa_titulo')?.value.trim();
  const prazo      = document.getElementById('farcAvulsa_prazo')?.value;
  const urgencia   = document.getElementById('farcAvulsa_urgencia')?.value || 'Normal';
  const obs        = document.getElementById('farcAvulsa_obs')?.value.trim() || '';
  const modalidade = document.querySelector('input[name="farcAvulsa_modalidade"]:checked')?.value || 'Spot';

  // Validação com feedback visual
  const ok = _validarCampos([
    { id:'farcAvulsa_titulo', label:'Título da RC',         required:true, minLen:5 },
    { id:'farcAvulsa_prazo',  label:'Prazo de Necessidade', required:true },
  ]);
  if (!ok) return;

  const rows  = document.querySelectorAll('#farcAvulsa_itens .farcAvulsa-item-row');
  const itens = [];
  rows.forEach(row => {
    const desc = row.querySelector('.farcAvulsa-item-desc')?.value.trim();
    if (!desc) return;
    const qtd      = parseFloat(row.querySelector('.farcAvulsa-item-qtd')?.value) || 1;
    const un       = row.querySelector('.farcAvulsa-item-un')?.value.trim() || 'Un';
    const vlUnit   = parseFloat(row.querySelector('.farcAvulsa-item-val')?.value) || 0;
    const tipoItem = row.querySelector('.farcAvulsa-item-tipo')?.value || 'material';
    // WBS vinculado por linha de item
    const wbsSel   = row.querySelector('.farcAvulsa-item-wbs');
    const wbsCod   = wbsSel?.value || '';
    const wbsDesc  = wbsSel?.options[wbsSel?.selectedIndex]?.text?.replace(/^\s*└\s*/,'').trim() || '';
    itens.push({ descricao: desc, qtd, unidade: un, valor_unit: vlUnit, total: qtd*vlUnit,
                 tipo_item: tipoItem, status_item: 'Pendente', origem_os: false,
                 wbs_codigo: wbsCod, wbs_descricao: wbsDesc });
  });
  if (!itens.length) { showToast('Adicione ao menos um item.', 'error'); return; }

  // Validação: tipos não podem ser misturados
  const tiposNaRC = [...new Set(itens.map(it => it.tipo_item))];
  if (tiposNaRC.length > 1) {
    showToast('Não é permitido misturar tipos diferentes na mesma RC (Material / Serviço / Equipamento). Crie RCs separadas por tipo.', 'error', 6000);
    return;
  }

  // Validação: prazo mínimo de 15 dias úteis (política financeira)
  const hoje15 = new Date();
  const prazoDt = new Date(prazo);
  const diffDias = Math.floor((prazoDt - hoje15) / 86400000);
  if (diffDias >= 0 && diffDias < 5) {
    showToast('⚠️ Atenção: Prazo muito curto. A política recomenda mínimo de 5 dias úteis. Para urgências use "Compra de Emergência".', 'warning', 5000);
  }

  const lista  = _obterRCLocal();
  const ano    = new Date().getFullYear();
  const numero = `RC-${ano}-${String(lista.length+1).padStart(4,'0')}`;

  // Perfis de compras/admin auto-aprovam a RC (não precisam de aprovação extra)
  const perfilAutoAprova = ['admin','compras','diretor'].includes(currentUser?.profile);
  const statusInicial    = perfilAutoAprova ? 'Aprovada – Aguardando Comprador' : 'Aguardando Aprovação';
  const estagioInicial   = perfilAutoAprova ? 4 : 1;

  const historicoInicial = [{ acao: `RC criada por ${currentUser?.name||'—'}`, usuario: currentUser?.name||'—', data: new Date().toLocaleString('pt-BR') }];
  if (perfilAutoAprova) {
    historicoInicial.push({ acao: `RC auto-aprovada pelo Comprador – disponível para cotação`, usuario: currentUser?.name||'—', data: new Date().toLocaleString('pt-BR') });
  }

  const novaRC = {
    id: `rc_${Date.now()}`,
    numero,
    titulo,
    modalidade_contrato: modalidade,
    contrato:       'Geral',
    solicitante:    currentUser?.name || '',
    departamento:   currentUser?.role || '',
    data_abertura:  new Date().toLocaleDateString('pt-BR'),
    data_criacao:   new Date().toISOString(),
    prazo,
    prazo_necessidade: prazo,
    urgencia,
    status:         statusInicial,
    estagio_atual:  estagioInicial,
    numero_processo: `PROC-${ano}-${String(lista.length+1).padStart(4,'0')}`,
    itens,
    valor_total:    itens.reduce((s,it)=>s+(it.total||0),0),
    observacoes:    obs,
    criado_por:     currentUser?.name || '',
    criado_por_nome: currentUser?.name || '',
    historico:      historicoInicial
  };
  lista.unshift(novaRC);
  _salvarRCLocal(lista);
  logAction && logAction('Nova RC', 'Emissão de Requisições', `RC ${numero} criada com ${itens.length} item(ns)`);
  closeModal();

  if (perfilAutoAprova) {
    showToast(`✅ RC ${numero} criada e aprovada! Redirecionando para Cotações…`, 'success', 4000);
    // Redireciona direto para aba Cotações onde o comprador pode aceitar e criar RFQ
    setTimeout(() => {
      if (typeof navigate === 'function') navigate('rfq');
    }, 600);
  } else {
    showToast(`✅ RC ${numero} criada! Aguardando aprovação do gestor.`, 'success', 4000);
    renderFluxoAprovacaoRC();
    setTimeout(() => farcSwitchTab && farcSwitchTab('emissao'), 100);
  }
}

// ─── APROVAÇÃO DE RC AVULSA (sem OS vinculada) ────────────────────────────────
// ─── APROVAÇÃO DE RC (função principal consolidada) ────────────────────────────
// ─── CONSTANTE DE ALÇADA HIERÁRQUICA ──────────────────────────────────────
const _RC_LIMITE_HIERARQUICO = 50000; // R$ 50.000 — acima exige aprovação da Diretoria

// Chamada pelos botões da tabela de RCs com status "Aguardando Aprovação".
// Perfis autorizados: compras, admin, diretor, supervisor.
function reqAprovarRC(rcId) {
  // Verifica permissão: compras/admin/diretor/supervisor podem aprovar
  if (!_podeProcessarRC() && currentUser?.profile !== 'supervisor') {
    showToast('Sem permissão para aprovar RC. Perfis autorizados: Compras, Admin, Diretor, Supervisor.', 'error');
    return;
  }
  const rc = (_obterRCLocal()).find(r => r.id === rcId);
  if (!rc) { showToast('RC não encontrada.', 'error'); return; }

  // Ícone por tipo de item
  const temServico  = (rc.itens||[]).some(it => it.tipo_item === 'servico');
  const temMaterial = (rc.itens||[]).some(it => (it.tipo_item||'material') === 'material');
  const iconeRCTipo = temServico && !temMaterial ? 'fa-tools' : 'fa-box';

  // Verifica se precisa aprovação hierárquica (valor > R$50.000)
  const valorRC          = rc.valor_total || 0;
  const precisaHierarq   = valorRC > _RC_LIMITE_HIERARQUICO;
  const hierarqAprovada  = !!(rc.aprovado_diretoria || rc.aprovacao_hierarquica);
  const isPerfDiretor    = ['admin','diretor'].includes(currentUser?.profile);

  // Banner de alçada hierárquica
  const bannerHierarq = precisaHierarq ? `
    <div style="background:${hierarqAprovada?'rgba(34,197,94,0.08)':'rgba(239,68,68,0.07)'};border:1.5px solid ${hierarqAprovada?'rgba(34,197,94,0.3)':'rgba(239,68,68,0.35)'};border-radius:9px;padding:11px 14px;margin-bottom:12px;font-size:12px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:${hierarqAprovada?0:6}px">
        <i class="fas fa-${hierarqAprovada?'check-circle':'exclamation-triangle'}" style="color:${hierarqAprovada?'#22c55e':'#ef4444'};font-size:15px;flex-shrink:0"></i>
        <div>
          <strong style="color:${hierarqAprovada?'#15803d':'#b91c1c'}">Alçada Hierárquica — Valor acima de R$ 50.000</strong>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px">
            ${hierarqAprovada
              ? `Aprovação da Diretoria já registrada em ${rc.aprovado_diretoria_em||'—'} por ${rc.aprovado_diretoria_por||'Diretor'}.`
              : isPerfDiretor
                ? 'Como Diretor, você pode aprovar diretamente (aprovação hierárquica + aprovação RC simultâneas).'
                : 'Esta RC exige aprovação da <strong>Diretoria</strong> antes de prosseguir. Aguarde ou solicite ao Diretor/Admin que aprove.'}
          </div>
        </div>
      </div>
      ${!hierarqAprovada && !isPerfDiretor ? `
        <div style="margin-top:8px;padding:8px 10px;background:rgba(239,68,68,0.06);border-radius:6px;font-size:11px;color:#991b1b">
          <i class="fas fa-lock" style="margin-right:5px"></i>
          <strong>Bloqueado:</strong> aprovação pela Diretoria pendente. Clique em
          <strong>"Encaminhar à Diretoria"</strong> para registrar a solicitação.
        </div>` : ''}
    </div>` : '';

  const infoBanner = !precisaHierarq ? `
    <div style="padding:10px 14px;background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.3);border-radius:8px;margin-bottom:12px;font-size:12px">
      <i class="fas fa-info-circle" style="color:#22c55e;margin-right:6px"></i>
      Ao aprovar, a RC ficará <strong>Aprovada – Aguardando Comprador</strong> e aparecerá na aba
      <strong style="color:#6366f1">Cotações (RFQ)</strong> para o comprador criar o pedido de cotação.
    </div>` : '';

  // Monta botões conforme situação de alçada
  let botoesFooter = `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-danger" onclick="closeModal();_reqReprovarRCDireta('${rcId}')"><i class="fas fa-times"></i> Reprovar</button>`;

  if (precisaHierarq && !hierarqAprovada && !isPerfDiretor) {
    // Apenas pode encaminhar para diretoria
    botoesFooter += `
      <button class="btn btn-warning" onclick="_reqEncaminharDiretoria('${rcId}')">
        <i class="fas fa-arrow-up"></i> Encaminhar à Diretoria
      </button>`;
  } else if (precisaHierarq && !hierarqAprovada && isPerfDiretor) {
    // Diretor/Admin: aprovação hierárquica + aprovação RC juntas
    botoesFooter += `
      <button class="btn btn-success" onclick="_reqConfirmarAprovarRC('${rcId}', true)">
        <i class="fas fa-check-double"></i> Aprovar (Hierárquica + RC)
      </button>`;
  } else {
    // Sem exigência de alçada ou já aprovada pela diretoria
    botoesFooter += `
      <button class="btn btn-success" onclick="_reqConfirmarAprovarRC('${rcId}', false)">
        <i class="fas fa-check"></i> Aprovar RC
      </button>`;
  }

  openModal(`Aprovar RC – ${rc.numero}`, `
    <div style="margin-bottom:12px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <i class="fas ${iconeRCTipo}" style="color:var(--fa-teal);font-size:15px"></i>
        <div style="font-weight:700;color:var(--text-primary)">${rc.titulo}</div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:10px;font-size:12px;color:var(--text-secondary)">
        <span><i class="fas fa-user" style="margin-right:4px;color:var(--fa-teal)"></i>${rc.solicitante||'—'}</span>
        <span><i class="fas fa-calendar" style="margin-right:4px;color:var(--fa-teal)"></i>${rc.data_criacao ? new Date(rc.data_criacao).toLocaleDateString('pt-BR') : (rc.data_abertura||'—')}</span>
        <span><i class="fas fa-dollar-sign" style="margin-right:4px;color:var(--fa-teal)"></i>
          <strong style="color:${valorRC > _RC_LIMITE_HIERARQUICO ? '#ef4444' : 'var(--text-primary)'}">${_fmtVal(valorRC)}</strong>
          ${valorRC > _RC_LIMITE_HIERARQUICO ? '<span style="font-size:10px;background:rgba(239,68,68,0.12);color:#ef4444;padding:1px 6px;border-radius:4px;margin-left:4px;font-weight:700">⚠️ > R$50K</span>' : ''}
        </span>
        ${rc.wbs_codigo ? `<span style="color:#3b82f6"><i class="fas fa-sitemap" style="margin-right:4px"></i>WBS: ${rc.wbs_codigo}</span>` : ''}
        ${rc.centro_custo ? `<span><i class="fas fa-building" style="margin-right:4px;color:var(--fa-teal)"></i>CC: ${rc.centro_custo}</span>` : ''}
        ${rc.os_vinculada
          ? `<span style="color:var(--fa-teal)"><i class="fas fa-link" style="margin-right:4px"></i>OS: ${rc.os_vinculada}</span>`
          : `<span style="color:#f59e0b"><i class="fas fa-exclamation-circle" style="margin-right:4px"></i>RC Avulsa</span>`}
      </div>
    </div>
    ${bannerHierarq}
    <div style="max-height:180px;overflow-y:auto;margin-bottom:12px">
      ${(rc.itens||[]).length > 0
        ? (rc.itens||[]).map(it => `
            <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--bg-card2);border-radius:6px;margin-bottom:5px;font-size:12px">
              <i class="fas fa-${it.tipo_item==='servico'?'tools':'box'}" style="color:${it.tipo_item==='servico'?'#f59e0b':'#6366f1'};font-size:11px"></i>
              <div style="flex:1"><strong>${it.descricao}</strong></div>
              <span style="color:var(--text-muted);white-space:nowrap">${it.qtd||1} ${it.unidade||'Un'} · ${_fmtVal((it.qtd||1)*(it.valor_unit||0))}</span>
            </div>
          `).join('')
        : `<div style="text-align:center;padding:12px;color:var(--text-muted);font-size:12px">
             <i class="fas fa-info-circle" style="margin-right:6px"></i>Nenhum item detalhado.
           </div>`
      }
    </div>
    ${infoBanner}
    <div>
      <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Observação (opcional)</label>
      <textarea id="obs_aprov_rc_main" rows="2" placeholder="Justificativa ou notas ao comprador..."
        style="width:100%;padding:8px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:6px;color:var(--text-primary);font-size:12px;box-sizing:border-box;resize:vertical"></textarea>
    </div>
  `, botoesFooter);
}

// Encaminha RC para aprovação da Diretoria (quando valor > R$50.000 e usuário não é diretor)
function _reqEncaminharDiretoria(rcId) {
  const lista = _obterRCLocal();
  const idx   = lista.findIndex(r => r.id === rcId);
  if (idx < 0) return;
  const obs = document.getElementById('obs_aprov_rc_main')?.value.trim() || '';
  const hoje = new Date().toLocaleString('pt-BR');

  lista[idx].status         = 'Aguardando Aprovação Hierárquica';
  lista[idx].historico      = lista[idx].historico || [];
  lista[idx].historico.unshift({
    acao: `⬆️ RC encaminhada à Diretoria para aprovação hierárquica (valor > R$ ${_fmtVal(_RC_LIMITE_HIERARQUICO)})${obs?' · "'+obs+'"':''}`,
    usuario: currentUser?.name || '—',
    data: hoje
  });

  // Adiciona status ao mapa de status conhecidos (para badge)
  _salvarRCLocal(lista);
  logAction && logAction('Alçada Hierárquica', 'Aprovação RC',
    `RC ${lista[idx].numero} encaminhada à Diretoria (valor ${_fmtVal(lista[idx].valor_total)})`);
  closeModal();
  showToast(`🔼 RC ${lista[idx].numero} encaminhada à Diretoria. Aguardando aprovação hierárquica.`, 'info', 6000);
  renderFluxoAprovacaoRC();
}

// Confirma aprovação e redireciona para aba Cotações (RFQ)
// @param {boolean} [comHierarquia=false] – true quando o próprio Diretor aprova em alçada única
function _reqConfirmarAprovarRC(rcId, comHierarquia) {
  const lista = _obterRCLocal();
  const idx   = lista.findIndex(r => r.id === rcId);
  if (idx < 0) return;
  // Suporta múltiplos IDs de textarea (versão nova e legada)
  const obs = (
    document.getElementById('obs_aprov_rc_main')?.value.trim() ||
    document.getElementById('obs_aprov_rc_avulsa')?.value.trim() ||
    document.getElementById('obs_aprov_rc_direta')?.value.trim() ||
    ''
  );
  const hoje = new Date().toLocaleString('pt-BR');
  const rc   = lista[idx];

  // Registra aprovação hierárquica se aplicável
  if (comHierarquia || rc.status === 'Aguardando Aprovação Hierárquica') {
    lista[idx].aprovado_diretoria     = true;
    lista[idx].aprovacao_hierarquica  = true;
    lista[idx].aprovado_diretoria_por = currentUser?.name || '—';
    lista[idx].aprovado_diretoria_em  = hoje;
    lista[idx].historico = lista[idx].historico || [];
    lista[idx].historico.unshift({
      acao: `🏛️ Aprovação hierárquica registrada por ${currentUser?.name||'—'} (alçada > R$50.000)`,
      usuario: currentUser?.name || '—',
      data: hoje
    });
  }

  lista[idx].status        = 'Aprovada – Aguardando Comprador';
  lista[idx].estagio_atual = 4;
  lista[idx].aprovado_em   = new Date().toISOString();
  lista[idx].aprovado_por  = currentUser?.name || '—';
  lista[idx].historico     = lista[idx].historico || [];
  lista[idx].historico.unshift({
    acao: `✅ RC aprovada por ${currentUser?.name||'—'} – disponível para cotação${obs ? ' · "' + obs + '"' : ''}`,
    usuario: currentUser?.name || '—',
    data: hoje
  });
  lista[idx].estagios_aprovacao = lista[idx].estagios_aprovacao || [];
  lista[idx].estagios_aprovacao.push({
    estagio: 1, status: 'Aprovado',
    aprovador: currentUser?.name, data: hoje, obs,
    hierarquica: !!(comHierarquia || rc.status === 'Aguardando Aprovação Hierárquica')
  });

  _salvarRCLocal(lista);

  logAction && logAction('Aprovação RC', 'Emissão de Requisições',
    `RC ${lista[idx].numero} aprovada por ${currentUser?.name}${comHierarquia?' (aprovação hierárquica)':''}`);
  closeModal();
  showToast(`✅ RC ${lista[idx].numero} aprovada! Redirecionando para Cotações (RFQ)…`, 'success', 5000);
  renderFluxoAprovacaoRC();
  // Redireciona para aba Cotações onde o comprador cria o RFQ
  setTimeout(() => {
    if (typeof navigate === 'function') navigate('rfq');
    else if (typeof farcSwitchTab === 'function') farcSwitchTab('cotacoes');
  }, 400);
}

function reqReprovarRC(rcId) {
  closeModal();
  const lista = _obterRCLocal();
  const idx = lista.findIndex(r => r.id === rcId);
  if (idx < 0) return;
  const motivo = prompt('Motivo da reprovação:') || 'Reprovada pelo gestor';
  const hoje   = new Date().toLocaleString('pt-BR');

  lista[idx].status = 'Rejeitada';
  lista[idx].historico = lista[idx].historico || [];
  lista[idx].historico.unshift({
    acao: `RC reprovada por ${currentUser?.name||'—'} – "${motivo}"`,
    usuario: currentUser?.name || '—', data: hoje
  });
  _salvarRCLocal(lista);

  logAction && logAction('Reprovação RC', 'Emissão RC', `RC ${lista[idx].numero} reprovada`);
  showToast(`RC ${lista[idx].numero} reprovada. Solicitante será notificado.`, 'warning', 4000);
  renderFluxoAprovacaoRC();
}

// ─── EXPOR GLOBALMENTE ────────────────────────────────────────────────────
window.reqAprovarRC             = reqAprovarRC;
window._reqConfirmarAprovarRC   = _reqConfirmarAprovarRC;
window._reqEncaminharDiretoria  = _reqEncaminharDiretoria;
window.reqReprovarRC            = reqReprovarRC;
window.renderFluxoAprovacaoRC   = renderFluxoAprovacaoRC;
window.farcSwitchTab            = farcSwitchTab;
window.farcVerDetalheOS         = farcVerDetalheOS;
window.farcAprovarOS            = farcAprovarOS;
window.farcReprovarOS           = farcReprovarOS;
window.farcEmitirRC             = farcEmitirRC;
window.farcProcessarRC          = farcProcessarRC;
window.farcVerDetalheRC         = farcVerDetalheRC;
window.farcVerRFQ               = farcVerRFQ;
window.farcRegistrarCotacao     = farcRegistrarCotacao;
window.farcGerarMapa            = farcGerarMapa;
window.farcVerMapa              = farcVerMapa;
window.farcAprovarMapa          = farcAprovarMapa;
window.farcReprovarMapa         = farcReprovarMapa;
window.farcExportarMapaPDF      = farcExportarMapaPDF;
window.farcEmitirPedido         = farcEmitirPedido;
window.farcVerPedido            = farcVerPedido;
window.farcGerarPOPDF           = farcGerarPOPDF;
window.farcGerarPOPDF_by_id     = farcGerarPOPDF_by_id;
window.farcAbrirConfigAprovacao = farcAbrirConfigAprovacao;
window._notificarOSParaFluxo    = _notificarOSParaFluxo;
window._criarRequisicaoDeOS     = _criarRequisicaoDeOS;
window._sincronizarOSnoFluxo    = _sincronizarOSnoFluxo;
window.farcSincronizarOSManual        = farcSincronizarOSManual;
window._farcAutoSincronizarOS         = _farcAutoSincronizarOS;
window._farcConfirmarAprovarDetalhe   = _farcConfirmarAprovarDetalhe;
window._farcAbrirReprovarDetalhe      = _farcAbrirReprovarDetalhe;
window._farcConfirmarReprovarDetalhe  = _farcConfirmarReprovarDetalhe;
window._renderScoreForn         = _renderScoreForn;
window._getScoreFornecedor      = _getScoreFornecedor;

// Confirmações internas
window._farcConfirmarAprovar        = _farcConfirmarAprovar;
window._farcConfirmarReprovar       = _farcConfirmarReprovar;
window._farcSalvarRC                = _farcSalvarRC;
window._farcAdicionarItemRC         = _farcAdicionarItemRC;
window._farcCalcTotal               = _farcCalcTotal;
window._farcFiltrarEmissao          = _farcFiltrarEmissao;
window._farcFiltrarRFQ              = _farcFiltrarRFQ;
window._farcFiltrarMapa             = _farcFiltrarMapa;
window._farcFiltrarPedidos          = _farcFiltrarPedidos;
window._farcExportarRC              = _farcExportarRC;
window._farcExportarPedidos         = _farcExportarPedidos;
window._farcConfirmarAprovarMapa    = _farcConfirmarAprovarMapa;
window._farcConfirmarReprovarMapa   = _farcConfirmarReprovarMapa;
window._farcConfirmarEmitirPO       = _farcConfirmarEmitirPO;
window._farcSalvarConfigAprovacao   = _farcSalvarConfigAprovacao;
window.farcNovoMapa                 = farcNovoMapa;
window.farcExportarPedidoPDF        = farcExportarPedidoPDF;
window.farcVerRastreabilidade       = farcVerRastreabilidade;
window._farcRenderKPIs              = _farcRenderKPIs;
window._farcAddAprovadorNomeado     = _farcAddAprovadorNomeado;
window.farcEditarRC                 = farcEditarRC;
window._farcSalvarEdicaoRC          = _farcSalvarEdicaoRC;
window._farcEditCalcTotal           = _farcEditCalcTotal;
window._farcEditAddItem             = _farcEditAddItem;
window._rcItemStatusBadge           = _rcItemStatusBadge;
window._farcFiltrarEmissaoStatus    = _farcFiltrarEmissaoStatus;
window.farcEmitirRCAvulsa           = farcEmitirRCAvulsa;
window.reqAprovarRC                 = reqAprovarRC;
window._reqConfirmarAprovarRC       = _reqConfirmarAprovarRC;
window._reqEncaminharDiretoria      = _reqEncaminharDiretoria;
window._reqReprovarRCDireta         = _reqReprovarRCDireta;
window._reqConfirmarReprovarRC      = _reqConfirmarReprovarRC;
window._farcAvulsaAddItem           = _farcAvulsaAddItem;
window._farcAvulsaCalcTotal         = _farcAvulsaCalcTotal;
window._farcSalvarRCAvulsa          = _farcSalvarRCAvulsa;
window._farcAvulsaCarregarWBS       = _farcAvulsaCarregarWBS;

// RFQ / Cotações
window.farcCriarRFQ                      = farcCriarRFQ;
window._rfqFiltrarFornecedores           = _rfqFiltrarFornecedores;
window._rfqFiltrarFornecedoresRFQ        = _rfqFiltrarFornecedoresRFQ;
window._rfqSelecionarFornRFQ             = _rfqSelecionarFornRFQ;
window._rfqAdicionarFornSelecionadoRFQ   = _rfqAdicionarFornSelecionadoRFQ;
window._rfqAddFornNovo                   = _rfqAddFornNovo;
window._rfqSalvarEEnviar                 = _rfqSalvarEEnviar;
window._rfqAnalisarSplit                 = _rfqAnalisarSplit;
window._rfqGerarMotivacaoIA              = _rfqGerarMotivacaoIA;
window._rfqAbrirDecisaoSplitOuPacote    = _rfqAbrirDecisaoSplitOuPacote;
window._rfqConfirmarModoFechamento       = _rfqConfirmarModoFechamento;
window._rfqGerarPDF              = _rfqGerarPDF;
window._rfqGerarPDF_id           = _rfqGerarPDF_id;
window.farcMatrizCotacao         = farcMatrizCotacao;
window._rfqRenderMatriz          = _rfqRenderMatriz;
window._rfqCalcLinha             = _rfqCalcLinha;
window._rfqSalvarMatriz          = _rfqSalvarMatriz;
window._rfqMatrizAddForn         = _rfqMatrizAddForn;
window._rfqConfirmarAddForn      = _rfqConfirmarAddForn;
window.farcGerarMapaComIA        = farcGerarMapaComIA;
window._rfqEnviarSolicitacao     = _rfqEnviarSolicitacao;
window._rfqConfirmarEnvio        = _rfqConfirmarEnvio;
window._rfqAbrirModalEmail       = _rfqAbrirModalEmail;
window._rfqAbrirMailto           = _rfqAbrirMailto;
window._rfqMarcarEnviado         = _rfqMarcarEnviado;
window._farcFiltrarOSEmissao     = _farcFiltrarOSEmissao;
window.farcAbrirNovaRCdeOS          = farcAbrirNovaRCdeOS;
window._farcAddItemExtraRC          = _farcAddItemExtraRC;
window._farcSalvarRCdeOS            = _farcSalvarRCdeOS;
window._farcFiltrarItensPorTipo     = _farcFiltrarItensPorTipo;
window._farcSelecionarTodosItens    = _farcSelecionarTodosItens;
window._farcCarregarWBSdoProjeto    = _farcCarregarWBSdoProjeto;
window._farcPreencherCentroCusto    = _farcPreencherCentroCusto;
window._farcMarcarItemEmEstoque     = _farcMarcarItemEmEstoque;
window._farcChecarEstoqueItem       = _farcChecarEstoqueItem;
window._farcTipoItem                = _farcTipoItem;
window._farcFiltroOS             = _farcFiltroOS;
window._farcListaOSAprovacao     = _farcListaOSAprovacao;
window._farcCardOSPipeline       = _farcCardOSPipeline;
window._farcSeedDemo             = _farcSeedDemo;

// ─── CHECKLIST DIGITAL DE CONFORMIDADE ─────────────────────────────────────
// Valida RC, RFQ e PO contra critérios obrigatórios antes de avançar.
// ─────────────────────────────────────────────────────────────────────────────

const _CHECKLIST_RC = [
  { id:'cl_rc_01', label:'Título da RC preenchido (mín. 5 caracteres)', test: rc => (rc.titulo||'').trim().length >= 5 },
  { id:'cl_rc_02', label:'Tipo de item definido (material, serviço ou equipamento)', test: rc => (rc.itens||[]).every(it => it.tipo_item && it.tipo_item !== '') },
  { id:'cl_rc_03', label:'Itens de tipo único por RC (sem mix material+serviço)', test: rc => { const tipos = [...new Set((rc.itens||[]).map(it=>it.tipo_item).filter(Boolean))]; return tipos.length <= 1; } },
  { id:'cl_rc_04', label:'Pelo menos 1 item com descrição preenchida', test: rc => (rc.itens||[]).some(it => (it.descricao||'').trim().length > 0) },
  { id:'cl_rc_05', label:'Prazo de necessidade informado', test: rc => !!rc.prazo || !!rc.prazo_necessidade },
  { id:'cl_rc_06', label:'Contrato vinculado', test: rc => !!(rc.contrato && rc.contrato !== 'Geral') },
  { id:'cl_rc_07', label:'Modalidade Spot/Recorrente definida', test: rc => !!(rc.modalidade_contrato) },
  { id:'cl_rc_08', label:'WBS vinculado (custo rastreável)', test: rc => !!(rc.wbs_codigo) },
  { id:'cl_rc_09', label:'Justificativa/Observação preenchida para urgente/crítico', test: rc => rc.urgencia === 'Normal' || (rc.observacoes||'').trim().length >= 10 },
];

const _CHECKLIST_RFQ = [
  { id:'cl_rfq_01', label:'Pelo menos 1 fornecedor convidado', test: rfq => (rfq.fornecedores||rfq.suppliers||[]).length >= 1 },
  { id:'cl_rfq_02', label:'Mínimo 3 fornecedores para valor estimado >R$10.000', test: rfq => {
      const val = rfq.valor_estimado || rfq.valor_total || 0;
      const forn = (rfq.fornecedores||rfq.suppliers||[]).length;
      return val <= 10000 || forn >= 3;
  }},
  { id:'cl_rfq_03', label:'Prazo de resposta definido', test: rfq => !!rfq.prazo_resposta || !!rfq.data_limite },
  { id:'cl_rfq_04', label:'Descrição/objeto da cotação preenchida', test: rfq => (rfq.descricao||rfq.titulo||rfq.objeto||'').trim().length >= 5 },
  { id:'cl_rfq_05', label:'Itens/quantidades especificados', test: rfq => (rfq.itens||[]).length > 0 },
  { id:'cl_rfq_06', label:'Valor estimado informado', test: rfq => (rfq.valor_estimado||rfq.valor_total||0) > 0 },
];

const _CHECKLIST_PO = [
  { id:'cl_po_01', label:'Fornecedor selecionado', test: po => !!(po.fornecedor_id || po.supplier_id || po.fornecedor) },
  { id:'cl_po_02', label:'CNPJ do fornecedor válido (14 dígitos)', test: po => { const c=(po.cnpj||po.fornecedor_cnpj||'').replace(/\D/g,''); return c.length===14; } },
  { id:'cl_po_03', label:'Valor total > 0', test: po => (po.valor_total||po.total||0) > 0 },
  { id:'cl_po_04', label:'Prazo de pagamento informado', test: po => !!(po.prazo_pagamento || po.condicao_pagamento) },
  { id:'cl_po_05', label:'Contrato/WBS vinculado', test: po => !!(po.contrato_id || po.wbs_codigo || po.contrato) },
  { id:'cl_po_06', label:'Aprovação hierárquica para valores >R$50.000', test: po => {
      const val = po.valor_total || po.total || 0;
      return val <= 50000 || !!(po.aprovado_diretoria || po.aprovacao_hierarquica);
  }},
];

/**
 * Abre modal com checklist de conformidade para um objeto (RC, RFQ ou PO).
 * @param {object} obj  – objeto a validar
 * @param {'rc'|'rfq'|'po'} tipo – tipo de checklist
 * @param {function} onConfirm – callback chamado ao confirmar (se todos passarem)
 */
function farcAbrirChecklist(obj, tipo, onConfirm) {
  const LISTAS = { rc: _CHECKLIST_RC, rfq: _CHECKLIST_RFQ, po: _CHECKLIST_PO };
  const TITULOS = { rc: 'Checklist RC', rfq: 'Checklist RFQ', po: 'Checklist PO' };
  const checklist = LISTAS[tipo] || _CHECKLIST_RC;
  const titulo = TITULOS[tipo] || 'Checklist';

  const resultados = checklist.map(item => {
    let passou = false;
    try { passou = item.test(obj); } catch(e) { passou = false; }
    return { ...item, passou };
  });
  const total   = resultados.length;
  const ok      = resultados.filter(r => r.passou).length;
  const falhou  = resultados.filter(r => !r.passou);
  const pct     = Math.round((ok/total)*100);
  const corPct  = pct === 100 ? '#22c55e' : pct >= 70 ? '#f59e0b' : '#ef4444';
  const podeAvancar = falhou.length === 0;

  const html = `
    <div style="max-height:75vh;overflow-y:auto;padding-right:4px">
      <!-- Resumo -->
      <div style="display:flex;align-items:center;gap:16px;padding:14px 18px;background:${podeAvancar?'rgba(34,197,94,0.08)':'rgba(239,68,68,0.06)'};border:1.5px solid ${podeAvancar?'rgba(34,197,94,0.3)':'rgba(239,68,68,0.25)'};border-radius:10px;margin-bottom:16px">
        <div style="width:56px;height:56px;border-radius:50%;background:conic-gradient(${corPct} ${pct*3.6}deg,var(--bg-tertiary) 0);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:14px;font-weight:800;color:${corPct}">${pct}%</div>
        <div>
          <div style="font-size:14px;font-weight:700;color:var(--text-primary);margin-bottom:4px">
            ${podeAvancar ? '✅ Todos os critérios atendidos!' : `⚠️ ${falhou.length} item(s) com não conformidade`}
          </div>
          <div style="font-size:12px;color:var(--text-secondary)">${ok} de ${total} critérios OK</div>
        </div>
      </div>

      <!-- Lista de itens -->
      <div style="display:flex;flex-direction:column;gap:6px">
        ${resultados.map(r => `
          <div style="display:flex;align-items:center;gap:10px;padding:9px 12px;border:1px solid ${r.passou?'rgba(34,197,94,0.25)':'rgba(239,68,68,0.35)'};border-radius:8px;background:${r.passou?'rgba(34,197,94,0.04)':'rgba(239,68,68,0.05)'}">
            <div style="width:20px;height:20px;border-radius:50%;background:${r.passou?'#22c55e':'#ef4444'};display:flex;align-items:center;justify-content:center;flex-shrink:0">
              <i class="fas fa-${r.passou?'check':'times'}" style="color:#fff;font-size:10px"></i>
            </div>
            <span style="font-size:12px;color:var(--text-primary);flex:1">${r.label}</span>
            <span style="font-size:10px;font-weight:700;color:${r.passou?'#16a34a':'#dc2626'}">${r.passou?'OK':'FALHOU'}</span>
          </div>`).join('')}
      </div>

      ${!podeAvancar ? `
        <div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.3);border-radius:8px;padding:12px 16px;margin-top:14px;font-size:12px;color:#92400e">
          <i class="fas fa-info-circle" style="color:#f59e0b;margin-right:6px"></i>
          <strong>Atenção:</strong> Corrija os itens acima antes de prosseguir para garantir rastreabilidade e conformidade.
        </div>` : ''}
    </div>
  `;

  const buttons = podeAvancar
    ? `<button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
       <button class="btn btn-success" onclick="closeModal();(${onConfirm.toString()})()"><i class="fas fa-check-circle"></i> Confirmar e Avançar</button>`
    : `<button class="btn btn-secondary" onclick="closeModal()"><i class="fas fa-edit"></i> Corrigir Pendências</button>
       <button class="btn btn-warning" onclick="closeModal();(${onConfirm.toString()})()" style="background:#f59e0b;border-color:#f59e0b;color:#fff"><i class="fas fa-exclamation-triangle"></i> Avançar Mesmo Assim</button>`;

  openModal(titulo, html, buttons);
}

/**
 * Wrapper de validação rápida para RC — retorna lista de falhas (vazio = tudo OK).
 */
function farcValidarRC(rc) {
  return _CHECKLIST_RC
    .filter(item => { try { return !item.test(rc); } catch(e) { return true; } })
    .map(item => item.label);
}

/**
 * Wrapper de validação rápida para RFQ.
 */
function farcValidarRFQ(rfq) {
  return _CHECKLIST_RFQ
    .filter(item => { try { return !item.test(rfq); } catch(e) { return true; } })
    .map(item => item.label);
}

window.farcAbrirChecklist   = farcAbrirChecklist;
window.farcValidarRC        = farcValidarRC;
window.farcValidarRFQ       = farcValidarRFQ;

// ════════════════════════════════════════════════════════════════════════════
// AUDITORIA DE FORNECEDORES — painel de conformidade e histórico
// ════════════════════════════════════════════════════════════════════════════

/**
 * Abre modal de auditoria para um fornecedor específico.
 * Consolida: histórico de RCs, score IDF, alertas de conformidade, status cadastral.
 */
function farcAuditarFornecedor(fornId) {
  // Reúne dados
  const fornList = (typeof ERP_DATA !== 'undefined' ? (ERP_DATA.fornecedores || []) : [])
    .concat((() => { try { return JSON.parse(localStorage.getItem('fa_fornecedores') || '[]'); } catch(e){ return []; } })());

  // Deduplica por id
  const vistosF = new Set();
  const fornAll = fornList.filter(f => { if (vistosF.has(f.id)) return false; vistosF.add(f.id); return true; });
  const forn = fornAll.find(f => f.id === fornId || f.nome === fornId) || { id: fornId, nome: fornId };

  const rcs   = _obterRCLocal();
  const rfqs  = JSON.parse(localStorage.getItem('fa_rfqs') || '[]');
  const pedidos = JSON.parse(localStorage.getItem('fa_pedidos') || '[]');

  // RCs deste fornecedor (via RFQs/Pedidos associados)
  const rfqsForn  = rfqs.filter(r => r.fornecedores && r.fornecedores.some(f => (f.id||f.nome||f) === fornId || (f.id||f.nome||f) === forn.nome));
  const pedsForn  = pedidos.filter(p => p.supplier_id === fornId || p.fornecedor_id === fornId || p.fornecedor === fornId || p.fornecedor === forn.nome);

  const score = _getScoreFornecedor(fornId) || _getScoreFornecedor(forn.nome) || null;

  // Alertas de conformidade
  const alertas = [];
  const cnpj = (forn.cnpj || '').replace(/\D/g,'');
  if (!cnpj || cnpj.length !== 14) alertas.push({ tipo: 'erro', msg: 'CNPJ inválido ou ausente (14 dígitos)' });
  if (!forn.email && !forn.contato) alertas.push({ tipo: 'aviso', msg: 'E-mail ou contato não cadastrado' });
  if (!forn.categoria && !forn.tipo) alertas.push({ tipo: 'aviso', msg: 'Categoria/tipo do fornecedor não definido' });
  if (forn.bloqueado || forn.status === 'Bloqueado' || forn.status === 'Inativo') alertas.push({ tipo: 'erro', msg: 'Fornecedor BLOQUEADO / INATIVO no cadastro' });
  if (score !== null && score < 2.5) alertas.push({ tipo: 'alerta', msg: `Score IDF baixo (${score.toFixed(1)}/5.0) — avaliar desempenho` });
  if (pedsForn.length === 0 && rfqsForn.length === 0) alertas.push({ tipo: 'info', msg: 'Nenhum pedido/RFQ histórico encontrado para este fornecedor' });

  const corAlerta = { erro:'#ef4444', aviso:'#f59e0b', alerta:'#f97316', info:'#3b82f6' };
  const iconAlerta = { erro:'fa-ban', aviso:'fa-exclamation-triangle', alerta:'fa-exclamation-circle', info:'fa-info-circle' };

  const scoreHtml = score !== null ? `
    <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:rgba(34,197,94,0.07);border:1px solid rgba(34,197,94,0.25);border-radius:8px;margin-bottom:12px">
      <div style="font-size:24px;font-weight:800;color:${score>=4?'#22c55e':score>=3?'#f59e0b':'#ef4444'}">${score.toFixed(1)}</div>
      <div>
        <div style="font-size:13px;font-weight:700;color:var(--text-primary)">Score IDF</div>
        <div style="display:flex;gap:2px">${Array.from({length:5},(_,i)=>`<i class="fas fa-star" style="font-size:12px;color:${i<Math.round(score)?'#f59e0b':'rgba(100,116,139,0.4)'}"></i>`).join('')}</div>
      </div>
    </div>` : `<div style="font-size:12px;color:var(--text-muted);padding:8px 0;margin-bottom:12px"><i class="fas fa-info-circle" style="margin-right:5px"></i>Score IDF ainda não disponível para este fornecedor.</div>`;

  const alertasHtml = alertas.length ? alertas.map(a => `
    <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:${corAlerta[a.tipo]}14;border:1px solid ${corAlerta[a.tipo]}44;border-radius:7px;margin-bottom:5px;font-size:12px">
      <i class="fas ${iconAlerta[a.tipo]}" style="color:${corAlerta[a.tipo]};flex-shrink:0"></i>
      <span style="color:var(--text-primary)">${a.msg}</span>
    </div>`).join('') : `<div style="color:#22c55e;font-size:12px;padding:6px 0"><i class="fas fa-check-circle" style="margin-right:5px"></i>Nenhum alerta de conformidade.</div>`;

  const histPeds = pedsForn.slice(0,10).map(p => `
    <tr style="font-size:11px">
      <td style="padding:6px 8px">${p.numero||p.id||'—'}</td>
      <td style="padding:6px 8px">${p.data_emissao||p.created_at||'—'}</td>
      <td style="padding:6px 8px">${_fmtVal(p.valor_total||p.total||0)}</td>
      <td style="padding:6px 8px">${_statusBadgeFluxo(p.status||'—')}</td>
    </tr>`).join('') || `<tr><td colspan="4" style="text-align:center;padding:10px;color:var(--text-muted);font-size:12px">Nenhum pedido encontrado</td></tr>`;

  openModalWide(`Auditoria de Fornecedor — ${forn.nome||forn.id}`, `
    <div style="max-height:80vh;overflow-y:auto;padding-right:4px">
      <!-- Dados cadastrais -->
      <div style="background:var(--bg-card2);border:1px solid var(--border-color);border-radius:10px;padding:14px 16px;margin-bottom:14px">
        <div style="font-size:12px;font-weight:700;color:var(--text-secondary);margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px"><i class="fas fa-address-card" style="margin-right:5px"></i>Dados Cadastrais</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px;font-size:12px">
          <div><span style="color:var(--text-muted)">CNPJ:</span> <strong>${forn.cnpj || '—'}</strong></div>
          <div><span style="color:var(--text-muted)">Categoria:</span> <strong>${forn.categoria||forn.tipo||'—'}</strong></div>
          <div><span style="color:var(--text-muted)">E-mail:</span> <strong>${forn.email||'—'}</strong></div>
          <div><span style="color:var(--text-muted)">Telefone:</span> <strong>${forn.telefone||forn.contato||'—'}</strong></div>
          <div><span style="color:var(--text-muted)">Status:</span> <strong style="color:${forn.bloqueado||forn.status==='Bloqueado'||forn.status==='Inativo'?'#ef4444':'#22c55e'}">${forn.status||'Ativo'}</strong></div>
          <div><span style="color:var(--text-muted)">Total Pedidos:</span> <strong>${pedsForn.length}</strong></div>
        </div>
      </div>

      <!-- Score IDF -->
      ${scoreHtml}

      <!-- Alertas de conformidade -->
      <div style="margin-bottom:14px">
        <div style="font-size:12px;font-weight:700;color:var(--text-secondary);margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px"><i class="fas fa-shield-alt" style="margin-right:5px"></i>Conformidade Cadastral</div>
        ${alertasHtml}
      </div>

      <!-- Histórico de pedidos -->
      <div>
        <div style="font-size:12px;font-weight:700;color:var(--text-secondary);margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px"><i class="fas fa-history" style="margin-right:5px"></i>Histórico de Pedidos (últimos 10)</div>
        <div style="overflow-x:auto;border:1px solid var(--border-color);border-radius:8px">
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="background:var(--bg-tertiary);font-size:11px;color:var(--text-secondary)">
                <th style="padding:8px;text-align:left">Nº Pedido</th>
                <th style="padding:8px;text-align:left">Data</th>
                <th style="padding:8px;text-align:left">Valor</th>
                <th style="padding:8px;text-align:left">Status</th>
              </tr>
            </thead>
            <tbody>${histPeds}</tbody>
          </table>
        </div>
      </div>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
    ${['admin','compras','diretor'].includes(currentUser?.profile) && (forn.bloqueado || forn.status === 'Bloqueado') ? `
      <button class="btn btn-success" onclick="_farcDesbloquearFornecedor('${fornId}')"><i class="fas fa-unlock"></i> Desbloquear</button>
    ` : ''}
    ${['admin','compras','diretor'].includes(currentUser?.profile) && !forn.bloqueado && forn.status !== 'Bloqueado' ? `
      <button class="btn btn-danger" onclick="_farcBloquearFornecedor('${fornId}')"><i class="fas fa-ban"></i> Bloquear Fornecedor</button>
    ` : ''}
  `);
}

/**
 * Bloqueia um fornecedor (adiciona flag bloqueado = true)
 */
function _farcBloquearFornecedor(fornId) {
  const motivo = prompt('Informe o motivo do bloqueio:') || 'Bloqueado por conformidade';
  if (!motivo.trim()) return;
  const lista = (() => { try { return JSON.parse(localStorage.getItem('fa_fornecedores') || '[]'); } catch(e){ return []; } })();
  const idx = lista.findIndex(f => f.id === fornId || f.nome === fornId);
  if (idx >= 0) {
    lista[idx].bloqueado = true;
    lista[idx].status = 'Bloqueado';
    lista[idx].motivo_bloqueio = motivo;
    lista[idx].bloqueado_por = currentUser?.name || '—';
    lista[idx].bloqueado_em = new Date().toLocaleString('pt-BR');
    localStorage.setItem('fa_fornecedores', JSON.stringify(lista));
  }
  logAction && logAction('Bloqueio Fornecedor', 'Auditoria', `Fornecedor ${fornId} bloqueado: ${motivo}`);
  closeModal();
  showToast(`Fornecedor ${fornId} bloqueado. Não poderá ser selecionado em novos processos.`, 'warning', 5000);
}

/**
 * Desbloqueia um fornecedor
 */
function _farcDesbloquearFornecedor(fornId) {
  const lista = (() => { try { return JSON.parse(localStorage.getItem('fa_fornecedores') || '[]'); } catch(e){ return []; } })();
  const idx = lista.findIndex(f => f.id === fornId || f.nome === fornId);
  if (idx >= 0) {
    lista[idx].bloqueado = false;
    lista[idx].status = 'Ativo';
    lista[idx].motivo_desbloqueio = `Desbloqueado por ${currentUser?.name||'—'} em ${new Date().toLocaleString('pt-BR')}`;
    localStorage.setItem('fa_fornecedores', JSON.stringify(lista));
  }
  logAction && logAction('Desbloqueio Fornecedor', 'Auditoria', `Fornecedor ${fornId} desbloqueado por ${currentUser?.name}`);
  closeModal();
  showToast(`Fornecedor ${fornId} desbloqueado com sucesso.`, 'success');
}

/**
 * Valida se um fornecedor está bloqueado antes de selecioná-lo em RFQ/Mapa
 * Retorna true se o fornecedor PODE ser usado, false se BLOQUEADO.
 */
function _farcVerificarFornecedorBloqueado(fornId) {
  const lista = (() => { try { return JSON.parse(localStorage.getItem('fa_fornecedores') || '[]'); } catch(e){ return []; } })()
    .concat((typeof ERP_DATA !== 'undefined' ? (ERP_DATA.fornecedores || []) : []));
  const forn = lista.find(f => f.id === fornId || f.nome === fornId);
  if (forn && (forn.bloqueado || forn.status === 'Bloqueado' || forn.status === 'Inativo')) {
    showToast(`⛔ Fornecedor "${forn.nome||fornId}" está BLOQUEADO e não pode ser selecionado. Motivo: ${forn.motivo_bloqueio||'conformidade'}.`, 'error', 6000);
    return false;
  }
  return true;
}

window.farcAuditarFornecedor          = farcAuditarFornecedor;
window._farcBloquearFornecedor        = _farcBloquearFornecedor;
window._farcDesbloquearFornecedor     = _farcDesbloquearFornecedor;
window._farcVerificarFornecedorBloqueado = _farcVerificarFornecedorBloqueado;

// ── Validação de Prazo Mínimo para Aprovação Hierárquica (15 dias úteis) ──────
/**
 * Calcula dias úteis entre duas datas (ignora sábados e domingos).
 */
function _calcDiasUteis(dataInicio, dataFim) {
  let d = new Date(dataInicio);
  const fim = new Date(dataFim);
  d.setHours(0,0,0,0);
  fim.setHours(0,0,0,0);
  let count = 0;
  while (d < fim) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
}

/**
 * Verifica se RCs hierárquicas estão dentro do prazo máximo de 15 dias úteis.
 * Exibe alerta no dashboard de compras se houver RCs vencendo.
 */
function _farcVerificarPrazoHierarquico() {
  const lista = _obterRCLocal();
  const hoje  = new Date();
  const PRAZO_MAX_DIAS_UTEIS = 15;

  const atrasadas = lista.filter(r => {
    if (r.status !== 'Aguardando Aprovação Hierárquica') return false;
    const criacao = r.data_criacao ? new Date(r.data_criacao) : null;
    if (!criacao) return false;
    const diasUteis = _calcDiasUteis(criacao, hoje);
    return diasUteis > PRAZO_MAX_DIAS_UTEIS;
  });

  if (atrasadas.length > 0 && ['admin','diretor'].includes(currentUser?.profile)) {
    showToast(
      `⏰ ${atrasadas.length} RC(s) com aprovação hierárquica ATRASADA (>${PRAZO_MAX_DIAS_UTEIS} dias úteis)! Acesse o módulo de Compras urgentemente.`,
      'error',
      8000
    );
  }
  return atrasadas;
}

window._calcDiasUteis                  = _calcDiasUteis;
window._farcVerificarPrazoHierarquico  = _farcVerificarPrazoHierarquico;

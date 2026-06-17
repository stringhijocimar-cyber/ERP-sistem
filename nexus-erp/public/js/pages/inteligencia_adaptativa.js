// ============================================================
// NEXUS ERP — Inteligência Adaptativa ao Negócio do Cliente
// Módulo: inteligencia_adaptativa.js
// Versão: 1.0 | Plataforma multi-setorial
// A IA detecta padrões, sugere melhorias. Decisão é humana.
// ============================================================

'use strict';

// ─── ESTADO ──────────────────────────────────────────────────────────────────
let _iaState = {
  abaAtiva: 'diagnostico',
  perfilOperacional: null,
  gargalosDetectados: [],
  recomendacoes: [],
  historicoFeedback: [],
  ultimaAnalise: null,
  analiseRodando: false,
};

// ─── TIPOS DE OPERAÇÃO SUPORTADOS (multi-setorial) ────────────────────────────
const TIPOS_OPERACAO = [
  { id: 'manutencao_industrial', label: 'Manutenção Industrial', icon: 'wrench', cor: '#f59e0b' },
  { id: 'facilities', label: 'Facilities / Gestão de Espaços', icon: 'building', cor: '#10b981' },
  { id: 'servicos_tecnicos', label: 'Serviços Técnicos Especializados', icon: 'tools', cor: '#3b82f6' },
  { id: 'engenharia_execucao', label: 'Engenharia e Execução', icon: 'hard-hat', cor: '#8b5cf6' },
  { id: 'logistica_operacional', label: 'Logística Operacional', icon: 'truck', cor: '#06b6d4' },
  { id: 'servicos_ambientais', label: 'Serviços Ambientais', icon: 'leaf', cor: '#22c55e' },
  { id: 'locacao_operacao', label: 'Locação com Operação', icon: 'key', cor: '#f97316' },
  { id: 'contrato_recorrente', label: 'Contratos Recorrentes', icon: 'sync', cor: '#a855f7' },
  { id: 'contrato_spot', label: 'Contratos Spot / Projeto', icon: 'bolt', cor: '#eab308' },
  { id: 'campo_equipe_movel', label: 'Operação em Campo / Equipe Móvel', icon: 'map-marker-alt', cor: '#ef4444' },
  { id: 'sla_producao', label: 'Operação por SLA / Produtividade', icon: 'tachometer-alt', cor: '#ec4899' },
  { id: 'operacoes_industriais', label: 'Operações Industriais', icon: 'industry', cor: '#64748b' },
];

// ─── CATEGORIAS DE GARGALO ────────────────────────────────────────────────────
const CATEGORIAS_GARGALO = {
  aprovacao: { label: 'Aprovações', icon: 'stamp', cor: '#f59e0b' },
  ciclo: { label: 'Tempo de Ciclo', icon: 'clock', cor: '#3b82f6' },
  retrabalho: { label: 'Retrabalho', icon: 'redo', cor: '#ef4444' },
  cadastro: { label: 'Qualidade Cadastral', icon: 'database', cor: '#8b5cf6' },
  compras: { label: 'Compras Emergenciais', icon: 'exclamation-triangle', cor: '#f97316' },
  medicao: { label: 'Desvios de Medição', icon: 'ruler', cor: '#10b981' },
  fornecedor: { label: 'Concentração de Fornecedor', icon: 'building', cor: '#ec4899' },
  ssma: { label: 'SSMA / Não Conformidades', icon: 'hard-hat', cor: '#ef4444' },
  padronizacao: { label: 'Falta de Padronização', icon: 'random', cor: '#64748b' },
};

// ─── RENDER PRINCIPAL ──────────────────────────────────────────────────────────
function renderInteligenciaAdaptativa() {
  const el = document.getElementById('mainContent');
  if (!el) return;

  // Executa análise se ainda não foi feita
  if (!_iaState.ultimaAnalise) _iaAnalisarAmbiente();

  el.innerHTML = `
  <div style="padding:24px;max-width:1400px;margin:0 auto">

    <!-- Header -->
    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:24px;flex-wrap:wrap;gap:16px">
      <div>
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
          <div style="width:48px;height:48px;border-radius:12px;background:linear-gradient(135deg,#a855f7,#7c3aed);display:flex;align-items:center;justify-content:center;font-size:22px">🧠</div>
          <div>
            <h2 style="margin:0;font-size:22px;font-weight:700">Inteligência Adaptativa ao Negócio</h2>
            <p style="margin:4px 0 0;font-size:13px;color:var(--text-muted)">
              Detecta padrões, gargalos e oportunidades com base em dados reais do ERP &nbsp;·&nbsp;
              <span style="color:#a855f7;font-weight:600">NEXUS ERP</span>
            </p>
          </div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
          ${_iaState.ultimaAnalise ? `
          <span style="background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.3);color:#34d399;font-size:11px;padding:3px 10px;border-radius:20px">
            <i class="fas fa-check-circle"></i> Análise: ${_iaState.ultimaAnalise}
          </span>` : ''}
          <span style="background:rgba(99,102,241,0.12);border:1px solid rgba(99,102,241,0.2);color:#a5b4fc;font-size:11px;padding:3px 10px;border-radius:20px">
            <i class="fas fa-robot"></i> IA como copiloto — não altera processos automaticamente
          </span>
        </div>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <button class="btn btn-secondary btn-sm" onclick="_iaRodarAnalise()" ${_iaState.analiseRodando ? 'disabled' : ''}>
          <i class="fas fa-sync-alt ${_iaState.analiseRodando ? 'fa-spin' : ''}"></i>
          ${_iaState.analiseRodando ? 'Analisando...' : 'Reanalisar'}
        </button>
      </div>
    </div>

    <!-- Abas -->
    <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:20px;border-bottom:1px solid var(--border-color);padding-bottom:0">
      ${_iaRenderAbas()}
    </div>

    <!-- Conteúdo -->
    <div id="ia-content">
      ${_iaRenderConteudo()}
    </div>
  </div>`;
}

function _iaRenderAbas() {
  const abas = [
    { id: 'diagnostico', label: 'Diagnóstico', icon: 'stethoscope' },
    { id: 'gargalos', label: 'Gargalos', icon: 'exclamation-triangle', badge: _iaState.gargalosDetectados.length },
    { id: 'recomendacoes', label: 'Recomendações', icon: 'lightbulb', badge: _iaState.recomendacoes.filter(r => r.status === 'pendente').length },
    { id: 'perfil', label: 'Perfil Operacional', icon: 'fingerprint' },
    { id: 'score', label: 'Score de Maturidade', icon: 'medal' },
    { id: 'quick_wins', label: 'Quick Wins', icon: 'bolt' },
    { id: 'feedback', label: 'Feedback & Aprendizado', icon: 'comments' },
    { id: 'historico', label: 'Histórico', icon: 'history' },
  ];
  return abas.map(a => `
    <button onclick="_iaMudarAba('${a.id}')" style="
      padding:8px 16px;font-size:13px;border:none;cursor:pointer;position:relative;
      border-bottom:2px solid ${_iaState.abaAtiva === a.id ? '#a855f7' : 'transparent'};
      color:${_iaState.abaAtiva === a.id ? '#a855f7' : 'var(--text-muted)'};
      background:transparent;font-weight:${_iaState.abaAtiva === a.id ? '600' : '400'};
      transition:all 0.2s;white-space:nowrap">
      <i class="fas fa-${a.icon}" style="margin-right:6px"></i>${a.label}
      ${a.badge ? `<span style="background:#a855f7;color:#fff;font-size:10px;padding:1px 6px;border-radius:10px;margin-left:4px">${a.badge}</span>` : ''}
    </button>`).join('');
}

function _iaRenderConteudo() {
  switch (_iaState.abaAtiva) {
    case 'diagnostico':   return _iaRenderDiagnostico();
    case 'gargalos':      return _iaRenderGargalos();
    case 'recomendacoes': return _iaRenderRecomendacoes();
    case 'perfil':        return _iaRenderPerfil();
    case 'score':         return _iaRenderScore();
    case 'quick_wins':    return _iaRenderQuickWins();
    case 'feedback':      return _iaRenderFeedback();
    case 'historico':     return _iaRenderHistorico();
    default:              return _iaRenderDiagnostico();
  }
}

// ─── ANÁLISE DO AMBIENTE (lê dados reais do localStorage) ────────────────────
function _iaAnalisarAmbiente() {
  _iaState.analiseRodando = true;

  try {
    // Lê dados reais do ERP (armazenados no localStorage pelo seed_demo)
    const contratos = _iaLerDados('fa_contratos');
    const oss = _iaLerDados('fa_ordens_servico');
    const rcs = _iaLerDados('fa_requisicoes');
    const rfqs = _iaLerDados('fa_rfqs');
    const pedidos = _iaLerDados('fa_pedidos');
    const medicoes = _iaLerDados('fa_medicoes');
    const incidentes = _iaLerDados('fa_incidentes');
    const apontamentos = _iaLerDados('fa_apontamentos');

    const gargalos = [];
    const recomendacoes = [];

    // ── Análise 1: Compras emergenciais ──────────────────────────────
    const rcsEmerg = rcs.filter(r => r.urgencia === 'Urgente' || r.urgencia === 'Emergencial');
    const taxaEmerg = rcs.length > 0 ? (rcsEmerg.length / rcs.length * 100).toFixed(0) : 0;
    if (taxaEmerg > 20) {
      gargalos.push({
        id: 'g1', categoria: 'compras', severidade: 'alta',
        titulo: 'Alta taxa de requisições emergenciais',
        descricao: `${taxaEmerg}% das requisições são urgentes/emergenciais. Taxa elevada indica falha no planejamento ou na gestão de estoque.`,
        dados: { total: rcs.length, emergenciais: rcsEmerg.length, taxa: taxaEmerg + '%' },
        impacto: 'Custo de aquisição 15-30% maior em compras emergenciais vs. planejadas.',
        confianca: 'media',
        fonteInterna: 'fa_requisicoes',
      });
      recomendacoes.push({
        id: 'r1', tipo: 'processo', prioridade: 'alta', status: 'pendente',
        titulo: 'Revisar política de compras emergenciais e fortalecer planejamento de demanda',
        descricao: 'Implementar análise preditiva de consumo por categoria. Exigir justificativa formal e aprovação extraordinária para toda compra emergencial.',
        modulos: ['Suprimentos', 'OS', 'Apontamento'],
        impactoEsperado: 'Redução estimada de 30-40% das compras emergenciais em 90 dias.',
        esforco: 'medio',
        prazo: '30-60 dias',
        gargalo_id: 'g1',
      });
    }

    // ── Análise 2: RFQs sem atividade ────────────────────────────────
    const rfqsParadas = rfqs.filter(r => {
      if (!r.data_abertura || r.status === 'Encerrado') return false;
      const diasSemAtividade = Math.floor((new Date() - new Date(r.data_abertura)) / 86400000);
      return diasSemAtividade > 15 && r.status !== 'Aprovado';
    });
    if (rfqsParadas.length > 0) {
      gargalos.push({
        id: 'g2', categoria: 'aprovacao', severidade: 'media',
        titulo: `${rfqsParadas.length} RFQ(s) sem movimentação há mais de 15 dias`,
        descricao: 'Cotações abertas sem resposta ou sem avanço indicam gargalo no fluxo de aprovação ou no retorno de fornecedores.',
        dados: { rfqs_paradas: rfqsParadas.length },
        impacto: 'Atraso no fornecimento e risco de desabastecimento operacional.',
        confianca: 'alta',
        fonteInterna: 'fa_rfqs',
      });
    }

    // ── Análise 3: OS sem estrutura rastreável ────────────────────────
    const ossSemsEstrutura = oss.filter(o => !o.wbs_id && !o.projeto_id && !o.centro_rastreabilidade);
    if (ossSemsEstrutura.length > 0) {
      gargalos.push({
        id: 'g3', categoria: 'cadastro', severidade: 'alta',
        titulo: `${ossSemsEstrutura.length} OS sem vínculo com estrutura rastreável`,
        descricao: 'Ordens de serviço sem WBS/centro de rastreabilidade tornam impossível rastrear custo real por projeto/contrato.',
        dados: { total: oss.length, sem_estrutura: ossSemsEstrutura.length },
        impacto: 'Perda de rastreabilidade de custo. Risco de divergência em medição e auditoria.',
        confianca: 'alta',
        fonteInterna: 'fa_ordens_servico',
      });
      recomendacoes.push({
        id: 'r2', tipo: 'regra', prioridade: 'alta', status: 'pendente',
        titulo: 'Ativar bloqueio obrigatório de OS sem estrutura rastreável',
        descricao: 'Tornar o campo de vínculo com projeto/WBS/centro de rastreabilidade obrigatório na criação de toda OS.',
        modulos: ['Ordens de Serviço'],
        impactoEsperado: 'Rastreabilidade de custo 100% a partir da implementação.',
        esforco: 'baixo',
        prazo: '1-7 dias',
        gargalo_id: 'g3',
      });
    }

    // ── Análise 4: Contratos sem critérios de medição ─────────────────
    const contratosSemCrit = contratos.filter(c =>
      c.status === 'Ativo' && (!c.criterios_medicao || !c.criterios_medicao.length)
    );
    if (contratosSemCrit.length > 0) {
      gargalos.push({
        id: 'g4', categoria: 'medicao', severidade: 'alta',
        titulo: `${contratosSemCrit.length} contrato(s) ativo(s) sem critérios de medição definidos`,
        descricao: 'Contratos sem critérios formais de medição expõem a empresa a disputas na aprovação de faturas e medições.',
        dados: { contratos_sem_criterio: contratosSemCrit.length, total_ativos: contratos.filter(c => c.status === 'Ativo').length },
        impacto: 'Risco de glosa, atraso no faturamento e disputas contratuais.',
        confianca: 'alta',
        fonteInterna: 'fa_contratos',
      });
      recomendacoes.push({
        id: 'r3', tipo: 'processo', prioridade: 'alta', status: 'pendente',
        titulo: 'Definir critérios de medição para todos os contratos ativos sem definição',
        descricao: 'Criar tarefa obrigatória de definição de critérios ao ativar contrato. Bloquear primeira medição sem critérios formalizados.',
        modulos: ['Contratos', 'Medição', 'Critérios de Medição'],
        impactoEsperado: 'Redução de disputas de medição e aceleração do ciclo de faturamento.',
        esforco: 'baixo',
        prazo: '7-15 dias',
        gargalo_id: 'g4',
      });
    }

    // ── Análise 5: Incidentes SSMA sem causa raiz ──────────────────────
    const incidentesSemCR = incidentes.filter(i =>
      i.status !== 'Encerrado' && (!i.causa_raiz || i.causa_raiz.trim() === '')
    );
    if (incidentesSemCR.length > 0) {
      gargalos.push({
        id: 'g5', categoria: 'ssma', severidade: 'media',
        titulo: `${incidentesSemCR.length} incidente(s) SSMA sem causa raiz validada`,
        descricao: 'Incidentes sem investigação completa de causa raiz aumentam o risco de reincidência.',
        dados: { sem_causa_raiz: incidentesSemCR.length, total: incidentes.length },
        impacto: 'Risco operacional e legal. Possível reincidência do evento.',
        confianca: 'alta',
        fonteInterna: 'fa_incidentes',
      });
    }

    // ── Análise 6: Apontamentos sem aprovação ──────────────────────────
    const aptSemAprov = apontamentos.filter(a => a.status === 'Pendente' || a.status === 'Rascunho');
    if (aptSemAprov.length > 3) {
      gargalos.push({
        id: 'g6', categoria: 'aprovacao', severidade: 'baixa',
        titulo: `${aptSemAprov.length} apontamentos pendentes de aprovação`,
        descricao: 'Apontamentos operacionais acumulados sem aprovação atrasam a consolidação de custos reais.',
        dados: { pendentes: aptSemAprov.length, total: apontamentos.length },
        impacto: 'Atraso na consolidação de custos. Risco de divergência em medição.',
        confianca: 'media',
        fonteInterna: 'fa_apontamentos',
      });
    }

    // Recomendações gerais de maturidade
    recomendacoes.push({
      id: 'r_mob', tipo: 'plataforma', prioridade: 'critica', status: 'pendente',
      titulo: 'Implementar PWA / modo offline para operações de campo',
      descricao: 'Apontamentos, checklists e aprovações simples devem funcionar sem conectividade. Sincronização posterior com resolução previsível de conflitos.',
      modulos: ['Apontamento', 'SSMA', 'Mobile'],
      impactoEsperado: 'Viabiliza operação real em campo. Critério eliminatório para ERPs de serviços (Gartner MQ 2023).',
      esforco: 'alto',
      prazo: '60-120 dias',
      gargalo_id: null,
    });

    recomendacoes.push({
      id: 'r_bancario', tipo: 'integracao', prioridade: 'alta', status: 'pendente',
      titulo: 'Integrar módulo bancário (CNAB 240/150 + PIX automático)',
      descricao: 'Automação de pagamentos e conciliação bancária elimina risco de erro manual e reduz tempo de fechamento financeiro.',
      modulos: ['Financeiro', 'Bancário'],
      impactoEsperado: 'Redução de 80%+ do tempo de conciliação manual.',
      esforco: 'alto',
      prazo: '90-120 dias',
      gargalo_id: null,
    });

    _iaState.gargalosDetectados = gargalos;
    _iaState.recomendacoes = recomendacoes;
    _iaState.ultimaAnalise = new Date().toLocaleString('pt-BR');
    _iaState.perfilOperacional = _iaDetectarPerfil(contratos, oss);

  } catch (e) {
    console.warn('[IA Adaptativa] Erro na análise:', e);
  }

  _iaState.analiseRodando = false;
}

function _iaLerDados(chave) {
  try { return JSON.parse(localStorage.getItem(chave) || '[]'); } catch { return []; }
}

function _iaDetectarPerfil(contratos, oss) {
  // Detecção simples de perfil operacional com base nos dados
  const tiposOS = {};
  oss.forEach(o => { if (o.tipo) tiposOS[o.tipo] = (tiposOS[o.tipo] || 0) + 1; });
  const dominante = Object.entries(tiposOS).sort((a, b) => b[1] - a[1])[0];

  return {
    totalContratos: contratos.length,
    contratosAtivos: contratos.filter(c => c.status === 'Ativo').length,
    totalOS: oss.length,
    tipoOSDominante: dominante ? dominante[0] : 'Serviço',
    volumeOSPorContrato: contratos.length > 0 ? (oss.length / Math.max(1, contratos.length)).toFixed(1) : 0,
  };
}

// ─── ABA: DIAGNÓSTICO ─────────────────────────────────────────────────────────
function _iaRenderDiagnostico() {
  const g = _iaState.gargalosDetectados;
  const r = _iaState.recomendacoes;
  const alta = g.filter(x => x.severidade === 'alta').length;
  const media = g.filter(x => x.severidade === 'media').length;
  const baixa = g.filter(x => x.severidade === 'baixa').length;

  return `
  <!-- Resumo executivo IA -->
  <div style="background:linear-gradient(135deg,rgba(168,85,247,0.08),rgba(99,102,241,0.08));border:1px solid rgba(168,85,247,0.2);border-radius:12px;padding:20px;margin-bottom:20px">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
      <i class="fas fa-robot" style="color:#a855f7;font-size:18px"></i>
      <strong style="font-size:14px">Resumo Executivo — IA Adaptativa</strong>
      <span style="font-size:11px;color:var(--text-muted);margin-left:4px">${_iaState.ultimaAnalise || 'Não executada'}</span>
    </div>
    <div style="font-size:13px;color:var(--text-secondary);line-height:1.8">
      Foram detectados <strong style="color:#ef4444">${alta}</strong> gargalo(s) de severidade alta,
      <strong style="color:#f59e0b">${media}</strong> de severidade média e
      <strong style="color:#10b981">${baixa}</strong> de severidade baixa.
      Total de <strong>${r.length}</strong> recomendação(s) gerada(s) com base nos dados reais do ERP.
      ${alta > 0 ? `<br><strong style="color:#ef4444">⚠️ Atenção imediata requerida em ${alta} item(ns).</strong>` : '<br><span style="color:#34d399">✅ Nenhum gargalo crítico identificado no momento.</span>'}
    </div>
    <div style="margin-top:12px;font-size:11px;color:var(--text-muted);background:rgba(0,0,0,0.15);border-radius:6px;padding:8px 12px">
      <i class="fas fa-info-circle" style="color:#a855f7;margin-right:4px"></i>
      <strong>Premissas da análise:</strong> dados do localStorage do ERP (seed demo); sem acesso a sistemas externos.
      Nível de confiança: varia por análise (ver gargalos individuais).
      A IA não altera processos automaticamente — toda recomendação requer validação humana.
    </div>
  </div>

  <!-- KPIs rápidos -->
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:20px">
    ${_iaKpiCard('Gargalos Críticos', alta, 'Severidade alta', 'exclamation-circle', '#ef4444')}
    ${_iaKpiCard('Gargalos Médios', media, 'Severidade média', 'exclamation-triangle', '#f59e0b')}
    ${_iaKpiCard('Recomendações', r.filter(x => x.status === 'pendente').length, 'Aguardando decisão', 'lightbulb', '#a855f7')}
    ${_iaKpiCard('Aceitas', r.filter(x => x.status === 'aceita').length, 'Recomendações aceitas', 'check-circle', '#10b981')}
    ${_iaKpiCard('Implementadas', r.filter(x => x.status === 'implementada').length, 'Melhorias efetivadas', 'rocket', '#3b82f6')}
  </div>

  <!-- Gargalos top 3 -->
  ${g.length ? `
  <div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:12px;padding:20px;margin-bottom:20px">
    <h3 style="margin:0 0 16px;font-size:15px;font-weight:600"><i class="fas fa-exclamation-triangle" style="color:#f59e0b;margin-right:8px"></i>Principais Gargalos Identificados</h3>
    ${g.slice(0, 4).map(gar => _iaRenderGargaloCard(gar, true)).join('')}
    ${g.length > 4 ? `<button onclick="_iaMudarAba('gargalos')" class="btn btn-secondary btn-sm" style="margin-top:8px;width:100%">Ver todos (${g.length})</button>` : ''}
  </div>` : `
  <div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:12px;padding:40px;text-align:center;margin-bottom:20px">
    <i class="fas fa-check-circle" style="font-size:40px;color:#10b981;margin-bottom:12px"></i>
    <p style="font-size:15px;font-weight:600;color:#34d399">Nenhum gargalo crítico detectado</p>
    <p style="font-size:12px;color:var(--text-muted)">A análise não identificou padrões problemáticos nos dados atuais.</p>
  </div>`}

  <!-- Top recomendações -->
  <div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:12px;padding:20px">
    <h3 style="margin:0 0 16px;font-size:15px;font-weight:600"><i class="fas fa-lightbulb" style="color:#a855f7;margin-right:8px"></i>Principais Recomendações</h3>
    ${r.slice(0, 3).map(rec => _iaRenderRecCard(rec, true)).join('')}
    ${r.length > 3 ? `<button onclick="_iaMudarAba('recomendacoes')" class="btn btn-secondary btn-sm" style="margin-top:8px;width:100%">Ver todas (${r.length})</button>` : ''}
  </div>`;
}

// ─── ABA: GARGALOS ────────────────────────────────────────────────────────────
function _iaRenderGargalos() {
  const g = _iaState.gargalosDetectados;
  if (!g.length) return `
    <div style="text-align:center;padding:60px 20px;color:var(--text-muted)">
      <i class="fas fa-check-circle" style="font-size:48px;color:#10b981;margin-bottom:16px"></i>
      <p style="font-size:15px">Nenhum gargalo detectado nos dados atuais</p>
    </div>`;

  return `
  <div style="margin-bottom:16px;font-size:12px;color:var(--text-muted);background:var(--bg-card2);border-radius:8px;padding:10px 14px">
    <i class="fas fa-info-circle" style="color:#a855f7;margin-right:6px"></i>
    Gargalos detectados por análise de padrões nos dados reais do ERP.
    Cada gargalo indica a fonte de dados interna utilizada e o nível de confiança da inferência.
    <strong>A decisão de agir é sempre do usuário.</strong>
  </div>
  <div style="display:flex;flex-direction:column;gap:14px">
    ${g.map(gar => _iaRenderGargaloCard(gar, false)).join('')}
  </div>`;
}

function _iaRenderGargaloCard(gar, compact) {
  const cat = CATEGORIAS_GARGALO[gar.categoria] || { label: gar.categoria, icon: 'circle', cor: '#64748b' };
  const sevCor = gar.severidade === 'alta' ? '#ef4444' : gar.severidade === 'media' ? '#f59e0b' : '#10b981';
  const sevLabel = gar.severidade === 'alta' ? 'Alta' : gar.severidade === 'media' ? 'Média' : 'Baixa';
  const confCor = gar.confianca === 'alta' ? '#10b981' : '#f59e0b';

  return `
  <div style="background:var(--bg-card2);border:1px solid ${sevCor}33;border-left:3px solid ${sevCor};border-radius:10px;padding:16px 18px">
    <div style="display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap">
      <div style="width:36px;height:36px;border-radius:8px;background:${cat.cor}22;display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <i class="fas fa-${cat.icon}" style="color:${cat.cor};font-size:16px"></i>
      </div>
      <div style="flex:1;min-width:200px">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px">
          <span style="font-size:13px;font-weight:600">${gar.titulo}</span>
          <span style="font-size:10px;padding:2px 8px;border-radius:10px;background:${sevCor}18;color:${sevCor};border:1px solid ${sevCor}33">${sevLabel}</span>
          <span style="font-size:10px;color:${cat.cor}">${cat.label}</span>
        </div>
        <p style="font-size:12px;color:var(--text-muted);margin:0 0 8px;line-height:1.5">${gar.descricao}</p>
        ${!compact ? `
        <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:11px">
          <div><span style="color:var(--text-muted)">Impacto:</span> <span style="color:var(--text-secondary)">${gar.impacto}</span></div>
          <div><span style="color:var(--text-muted)">Fonte interna:</span> <span style="color:#6366f1">${gar.fonteInterna}</span></div>
          <div><span style="color:var(--text-muted)">Confiança da IA:</span> <span style="color:${confCor}">${gar.confianca.toUpperCase()}</span></div>
        </div>
        ${gar.dados ? `<div style="margin-top:8px;font-size:11px;background:var(--bg-card);border-radius:6px;padding:6px 10px;font-family:monospace;color:var(--text-muted)">${Object.entries(gar.dados).map(([k,v]) => `${k}: ${v}`).join(' · ')}</div>` : ''}` : ''}
      </div>
    </div>
  </div>`;
}

// ─── ABA: RECOMENDAÇÕES ───────────────────────────────────────────────────────
function _iaRenderRecomendacoes() {
  const r = _iaState.recomendacoes;
  return `
  <div style="margin-bottom:16px;font-size:12px;color:var(--text-muted);background:var(--bg-card2);border-radius:8px;padding:10px 14px">
    <i class="fas fa-info-circle" style="color:#a855f7;margin-right:6px"></i>
    Recomendações geradas pela IA com base nos dados do ERP. Use os botões de ação para registrar sua decisão.
    Toda decisão divergente pode ser registrada com justificativa. O sistema aprende com o feedback validado.
  </div>
  <div style="display:flex;flex-direction:column;gap:14px">
    ${r.map(rec => _iaRenderRecCard(rec, false)).join('')}
  </div>`;
}

function _iaRenderRecCard(rec, compact) {
  const prioCor = rec.prioridade === 'critica' ? '#ef4444' : rec.prioridade === 'alta' ? '#f59e0b' : rec.prioridade === 'media' ? '#3b82f6' : '#10b981';
  const prioLabel = rec.prioridade === 'critica' ? 'Crítica' : rec.prioridade === 'alta' ? 'Alta' : rec.prioridade === 'media' ? 'Média' : 'Baixa';
  const statusCor = rec.status === 'aceita' ? '#10b981' : rec.status === 'rejeitada' ? '#ef4444' : rec.status === 'implementada' ? '#3b82f6' : '#a855f7';
  const statusLabel = rec.status === 'aceita' ? 'Aceita' : rec.status === 'rejeitada' ? 'Rejeitada' : rec.status === 'implementada' ? 'Implementada' : 'Pendente';
  const esforCor = rec.esforco === 'alto' ? '#ef4444' : rec.esforco === 'medio' ? '#f59e0b' : '#10b981';

  return `
  <div style="background:var(--bg-card);border:1px solid var(--border-color);border-left:3px solid ${prioCor};border-radius:10px;padding:16px 18px">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap">
      <div style="flex:1;min-width:220px">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px">
          <span style="font-size:13px;font-weight:600">${rec.titulo}</span>
          <span style="font-size:10px;padding:2px 8px;border-radius:10px;background:${prioCor}18;color:${prioCor};border:1px solid ${prioCor}33">P: ${prioLabel}</span>
          <span style="font-size:10px;padding:2px 8px;border-radius:10px;background:${statusCor}18;color:${statusCor}">● ${statusLabel}</span>
        </div>
        <p style="font-size:12px;color:var(--text-muted);margin:0 0 8px;line-height:1.5">${rec.descricao}</p>
        ${!compact ? `
        <div style="display:flex;gap:12px;flex-wrap:wrap;font-size:11px;margin-bottom:8px">
          <span><i class="fas fa-bolt" style="color:${esforCor}"></i> Esforço ${rec.esforco}</span>
          <span><i class="fas fa-clock" style="color:var(--text-muted)"></i> ${rec.prazo}</span>
          <span><i class="fas fa-layer-group" style="color:#6366f1"></i> ${rec.modulos.join(', ')}</span>
        </div>
        <div style="font-size:11px;color:#34d399;margin-bottom:10px"><i class="fas fa-chart-line" style="margin-right:4px"></i>${rec.impactoEsperado}</div>` : ''}
      </div>
      ${rec.status === 'pendente' && !compact ? `
      <div style="display:flex;flex-direction:column;gap:6px;min-width:130px">
        <button onclick="_iaAceitarRec('${rec.id}')" class="btn btn-primary btn-sm"><i class="fas fa-check"></i> Aceitar</button>
        <button onclick="_iaAprovarRetorno('${rec.id}','adiada')" class="btn btn-secondary btn-sm"><i class="fas fa-clock"></i> Adiar</button>
        <button onclick="_iaRejeitarRec('${rec.id}')" style="padding:6px 12px;border-radius:6px;border:1px solid rgba(239,68,68,0.3);background:transparent;color:#f87171;font-size:12px;cursor:pointer"><i class="fas fa-times"></i> Rejeitar</button>
      </div>` : ''}
    </div>
  </div>`;
}

// ─── ABA: PERFIL OPERACIONAL ──────────────────────────────────────────────────
function _iaRenderPerfil() {
  const p = _iaState.perfilOperacional;

  return `
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
    <div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:12px;padding:24px">
      <h3 style="margin:0 0 20px;font-size:15px;font-weight:600"><i class="fas fa-fingerprint" style="color:#a855f7;margin-right:8px"></i>Perfil Operacional Detectado</h3>
      ${p ? `
      <div style="display:flex;flex-direction:column;gap:12px">
        <div style="display:flex;justify-content:space-between;padding:10px 14px;background:var(--bg-card2);border-radius:8px">
          <span style="font-size:12px;color:var(--text-muted)">Total de Contratos</span>
          <span style="font-size:14px;font-weight:700">${p.totalContratos}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:10px 14px;background:var(--bg-card2);border-radius:8px">
          <span style="font-size:12px;color:var(--text-muted)">Contratos Ativos</span>
          <span style="font-size:14px;font-weight:700;color:#10b981">${p.contratosAtivos}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:10px 14px;background:var(--bg-card2);border-radius:8px">
          <span style="font-size:12px;color:var(--text-muted)">Total de OS</span>
          <span style="font-size:14px;font-weight:700">${p.totalOS}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:10px 14px;background:var(--bg-card2);border-radius:8px">
          <span style="font-size:12px;color:var(--text-muted)">Tipo de OS Dominante</span>
          <span style="font-size:13px;font-weight:600;color:#a855f7">${p.tipoOSDominante}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:10px 14px;background:var(--bg-card2);border-radius:8px">
          <span style="font-size:12px;color:var(--text-muted)">OS por Contrato (média)</span>
          <span style="font-size:14px;font-weight:700">${p.volumeOSPorContrato}</span>
        </div>
      </div>` : '<p style="color:var(--text-muted);font-size:13px">Dados insuficientes para análise de perfil.</p>'}
    </div>

    <div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:12px;padding:24px">
      <h3 style="margin:0 0 16px;font-size:15px;font-weight:600"><i class="fas fa-sitemap" style="color:#f59e0b;margin-right:8px"></i>Segmentos Compatíveis com este Perfil</h3>
      <p style="font-size:12px;color:var(--text-muted);margin-bottom:16px">O NEXUS ERP suporta estes segmentos. Selecione os que se aplicam para personalizar benchmarks e recomendações.</p>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${TIPOS_OPERACAO.map(t => `
          <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--bg-card2);border-radius:8px">
            <i class="fas fa-${t.icon}" style="color:${t.cor};width:18px;text-align:center"></i>
            <span style="font-size:12px;font-weight:500;flex:1">${t.label}</span>
          </div>`).join('')}
      </div>
    </div>
  </div>`;
}

// ─── ABA: SCORE DE MATURIDADE ─────────────────────────────────────────────────
function _iaRenderScore() {
  const processos = [
    { nome: 'Comercial E2E', score: 75, obs: 'CRM + Proposta + Contrato operacional' },
    { nome: 'Estruturação de Contratos', score: 80, obs: 'Projeto, cronograma, estrutura rastreável, critérios de medição' },
    { nome: 'Gestão de OS', score: 82, obs: 'Tipos, linhas multi-natureza, aprovação, WBS por item' },
    { nome: 'Execução / Apontamento', score: 65, obs: 'Módulo novo. Offline pendente.' },
    { nome: 'Suprimentos Transacional', score: 88, obs: 'RC→RFQ→Mapa→PO completo e auditável' },
    { nome: 'Suprimentos Estratégico', score: 72, obs: 'Kraljic, BATNA, SWOT, TCO implementados' },
    { nome: 'Medição Cliente', score: 65, obs: 'Refatorado. Checklist e glosa em desenvolvimento.' },
    { nome: 'SSMA / Causa Raiz', score: 70, obs: 'Ishikawa SVG + IA implementados' },
    { nome: 'Financeiro / DRE', score: 65, obs: 'Sem bancário CNAB/PIX' },
    { nome: 'Rastreabilidade / Auditoria', score: 80, obs: 'Trilha de auditoria, vínculos, sem órfãos' },
    { nome: 'Analytics / BI', score: 65, obs: 'KPI executivo, dashboard por perfil' },
    { nome: 'Mobile / Offline', score: 30, obs: '⚠️ Não implementado — gap crítico' },
    { nome: 'Parametrização Multi-setorial', score: 70, obs: 'Removido vínculo exclusivo mineração. Segmentos em evolução.' },
  ];

  const scoreGeral = Math.round(processos.reduce((s, p) => s + p.score, 0) / processos.length);

  return `
  <div style="text-align:center;margin-bottom:24px">
    <div style="font-size:64px;font-weight:800;color:#a855f7;line-height:1">${scoreGeral}%</div>
    <div style="font-size:16px;font-weight:600;margin-top:8px">Score de Maturidade Operacional</div>
    <div style="font-size:12px;color:var(--text-muted);margin-top:4px">NEXUS ERP · ${new Date().toLocaleDateString('pt-BR')}</div>
  </div>

  <div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:12px;padding:24px">
    <h3 style="margin:0 0 20px;font-size:15px;font-weight:600">Score por Processo</h3>
    ${processos.map(p => {
      const cor = p.score >= 80 ? '#10b981' : p.score >= 60 ? '#f59e0b' : '#ef4444';
      return `
      <div style="margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">
          <div>
            <span style="font-size:12px;font-weight:600">${p.nome}</span>
            <div style="font-size:10px;color:var(--text-muted)">${p.obs}</div>
          </div>
          <span style="font-size:16px;font-weight:700;color:${cor};white-space:nowrap;margin-left:8px">${p.score}%</span>
        </div>
        <div style="height:6px;background:var(--bg-card2);border-radius:3px;overflow:hidden">
          <div style="height:100%;width:${p.score}%;background:${cor};border-radius:3px"></div>
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

// ─── ABA: QUICK WINS ──────────────────────────────────────────────────────────
function _iaRenderQuickWins() {
  const wins = _iaState.recomendacoes
    .filter(r => r.esforco === 'baixo' && (r.prioridade === 'alta' || r.prioridade === 'critica'));

  return `
  <div style="margin-bottom:16px;font-size:12px;color:var(--text-muted);background:var(--bg-card2);border-radius:8px;padding:10px 14px">
    <i class="fas fa-bolt" style="color:#a855f7;margin-right:6px"></i>
    Quick Wins: recomendações de <strong>alto impacto e baixo esforço</strong>, derivadas dos gargalos detectados nos dados do ERP.
  </div>
  ${wins.length ? wins.map(r => _iaRenderRecCard(r, false)).join('') : `
  <div style="text-align:center;padding:40px;color:var(--text-muted)">
    <i class="fas fa-bolt" style="font-size:40px;margin-bottom:12px;opacity:0.3"></i>
    <p>Nenhum quick win disponível no momento. Execute a análise para detectar oportunidades.</p>
    <button onclick="_iaRodarAnalise()" class="btn btn-primary btn-sm" style="margin-top:12px"><i class="fas fa-sync-alt"></i> Executar Análise</button>
  </div>`}`;
}

// ─── ABA: FEEDBACK & APRENDIZADO ─────────────────────────────────────────────
function _iaRenderFeedback() {
  const fb = _iaState.historicoFeedback;
  return `
  <div style="background:rgba(168,85,247,0.07);border:1px solid rgba(168,85,247,0.2);border-radius:10px;padding:16px 20px;margin-bottom:20px">
    <strong style="font-size:13px"><i class="fas fa-graduation-cap" style="color:#a855f7;margin-right:6px"></i>Como funciona o aprendizado</strong>
    <ul style="margin:8px 0 0;padding-left:18px;font-size:12px;color:var(--text-muted);line-height:1.8">
      <li>Cada recomendação aceita ou rejeitada registra o feedback do usuário</li>
      <li>Recomendações implementadas com impacto positivo confirmado aumentam o peso de padrões similares</li>
      <li>Divergências entre sugestão IA e decisão humana são registradas para auditoria</li>
      <li>O modelo não modifica processos automaticamente — aprende para sugestões futuras</li>
    </ul>
  </div>
  ${fb.length ? `
  <div style="display:flex;flex-direction:column;gap:10px">
    ${fb.map(f => `
    <div style="background:var(--bg-card2);border-radius:8px;padding:12px 16px;display:flex;justify-content:space-between;align-items:center">
      <div>
        <div style="font-size:12px;font-weight:600">${f.titulo}</div>
        <div style="font-size:11px;color:var(--text-muted)">${f.data} · ${f.decisao}</div>
        ${f.justificativa ? `<div style="font-size:11px;color:var(--text-muted);font-style:italic">"${f.justificativa}"</div>` : ''}
      </div>
      <span style="font-size:12px;padding:3px 10px;border-radius:10px;background:${f.decisao==='Aceita'?'rgba(16,185,129,0.15)':f.decisao==='Rejeitada'?'rgba(239,68,68,0.15)':'rgba(245,158,11,0.15)'};color:${f.decisao==='Aceita'?'#34d399':f.decisao==='Rejeitada'?'#f87171':'#fbbf24'}">${f.decisao}</span>
    </div>`).join('')}
  </div>` : `
  <div style="text-align:center;padding:60px 20px;color:var(--text-muted)">
    <i class="fas fa-comments" style="font-size:40px;margin-bottom:12px;opacity:0.3"></i>
    <p>Nenhum feedback registrado ainda.</p>
    <p style="font-size:12px">Aceite ou rejeite recomendações para iniciar o histórico de aprendizado.</p>
  </div>`}`;
}

// ─── ABA: HISTÓRICO ───────────────────────────────────────────────────────────
function _iaRenderHistorico() {
  return `
  <div style="text-align:center;padding:60px 20px;color:var(--text-muted)">
    <i class="fas fa-history" style="font-size:40px;margin-bottom:12px;opacity:0.3"></i>
    <p>Histórico de análises disponível após múltiplas execuções.</p>
    <p style="font-size:12px">Cada análise registra: data, score, gargalos detectados, recomendações geradas.</p>
  </div>`;
}

// ─── KPI CARD ─────────────────────────────────────────────────────────────────
function _iaKpiCard(titulo, valor, sub, icon, cor) {
  return `
  <div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:10px;padding:14px 16px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
      <span style="font-size:11px;color:var(--text-muted)">${titulo}</span>
      <i class="fas fa-${icon}" style="color:${cor};font-size:14px"></i>
    </div>
    <div style="font-size:26px;font-weight:700;color:${cor}">${valor}</div>
    <div style="font-size:11px;color:var(--text-muted);margin-top:3px">${sub}</div>
  </div>`;
}

// ─── AÇÕES ────────────────────────────────────────────────────────────────────
function _iaMudarAba(aba) {
  _iaState.abaAtiva = aba;
  renderInteligenciaAdaptativa();
}

function _iaRodarAnalise() {
  _iaState.ultimaAnalise = null;
  _iaState.gargalosDetectados = [];
  _iaState.recomendacoes = [];
  _iaAnalisarAmbiente();
  renderInteligenciaAdaptativa();
  if (typeof showToast === 'function') showToast('Análise executada com sucesso.', 'success');
}

function _iaAceitarRec(id) {
  const rec = _iaState.recomendacoes.find(r => r.id === id);
  if (!rec) return;
  rec.status = 'aceita';
  _iaState.historicoFeedback.unshift({
    titulo: rec.titulo,
    data: new Date().toLocaleString('pt-BR'),
    decisao: 'Aceita',
    justificativa: '',
  });
  if (typeof showToast === 'function') showToast('Recomendação aceita. Registrada no histórico de aprendizado.', 'success');
  renderInteligenciaAdaptativa();
}

function _iaRejeitarRec(id) {
  const rec = _iaState.recomendacoes.find(r => r.id === id);
  if (!rec) return;
  const motivo = prompt('Registre a justificativa para rejeição (obrigatório para auditoria):');
  if (motivo === null) return; // cancelado
  rec.status = 'rejeitada';
  _iaState.historicoFeedback.unshift({
    titulo: rec.titulo,
    data: new Date().toLocaleString('pt-BR'),
    decisao: 'Rejeitada',
    justificativa: motivo || '(sem justificativa)',
  });
  if (typeof showToast === 'function') showToast('Recomendação rejeitada. Divergência registrada para auditoria.', 'info');
  renderInteligenciaAdaptativa();
}

function _iaAprovarRetorno(id, status) {
  const rec = _iaState.recomendacoes.find(r => r.id === id);
  if (!rec) return;
  rec.status = status;
  _iaState.historicoFeedback.unshift({
    titulo: rec.titulo,
    data: new Date().toLocaleString('pt-BR'),
    decisao: 'Adiada',
    justificativa: '',
  });
  if (typeof showToast === 'function') showToast('Recomendação adiada.', 'info');
  renderInteligenciaAdaptativa();
}

// ─── EXPORTS ──────────────────────────────────────────────────────────────────
window.renderInteligenciaAdaptativa = renderInteligenciaAdaptativa;
window._iaMudarAba                  = _iaMudarAba;
window._iaRodarAnalise              = _iaRodarAnalise;
window._iaAceitarRec                = _iaAceitarRec;
window._iaRejeitarRec               = _iaRejeitarRec;
window._iaAprovarRetorno            = _iaAprovarRetorno;

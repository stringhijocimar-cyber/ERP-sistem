// src/modules/commercial_generation_sales_enablement.ts
// NEXUS ERP — Etapa 23: Geração Comercial, Propostas, Demonstrações e Pitch por Segmento
//
// Integração:
// import { registerCommercialGenerationRoutes } from './modules/commercial_generation_sales_enablement';
// registerCommercialGenerationRoutes(app, { requireOrg, auditLog });
//
// Regra crítica:
// Materiais comerciais devem separar evidência, premissas e afirmações comerciais.
// Não gerar promessa de resultado sem baseline/premissa.

import type { Hono } from 'hono';

type Ctx = any;
type Deps = {
  requireOrg: (c: Ctx) => Promise<{ user: any; org: any }>;
  auditLog?: (c: Ctx, input: any) => Promise<void>;
};

function uid(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}
function nowIso() { return new Date().toISOString(); }
async function body(c: Ctx) { try { return await c.req.json(); } catch { return {}; } }
function json(v: any) { return typeof v === 'string' ? v : JSON.stringify(v ?? {}); }
function parseJson(v: any, fallback: any = {}) { try { return typeof v === 'string' ? JSON.parse(v) : (v ?? fallback); } catch { return fallback; } }
function money(v: any) { return Number(v || 0).toLocaleString('pt-BR', { style:'currency', currency:'BRL' }); }

const DEFAULT_PERSONAS = [
  {
    codigo:'ceo_diretor',
    nome:'CEO / Diretor Executivo',
    cargo_alvo:'CEO, Diretor Geral, Diretor Executivo',
    dores:['baixa visibilidade da operação', 'decisões sem dado confiável', 'risco de crescimento desorganizado'],
    objetivos:['controle executivo', 'crescimento escalável', 'governança e previsibilidade'],
    criterios:['ROI', 'risco', 'tempo de implantação', 'aderência ao negócio'],
    mensagens:['ERP adaptado ao segmento com visão executiva e IA governada.']
  },
  {
    codigo:'cfo_financeiro',
    nome:'CFO / Financeiro',
    cargo_alvo:'CFO, Gerente Financeiro, Controller',
    dores:['custos sem rastreabilidade', 'margem pouco clara', 'forecast manual'],
    objetivos:['margem por contrato', 'controle de custos', 'forecast e auditoria'],
    criterios:['controle financeiro', 'compliance', 'integração', 'segurança'],
    mensagens:['Controle de margem, custos, medições e forecast com trilha auditável.']
  },
  {
    codigo:'compras_suprimentos',
    nome:'Compras / Suprimentos',
    cargo_alvo:'Gerente de Compras, Especialista de Sourcing',
    dores:['propostas difíceis de comparar', 'negociação sem método', 'falta de histórico'],
    objetivos:['saving', 'compliance', 'melhor decisão de sourcing'],
    criterios:['TCO', 'risco fornecedor', 'compliance', 'prazo'],
    mensagens:['Sourcing com BATNA, Kraljic, SWOT, evidências e IA governada.']
  },
  {
    codigo:'operacoes',
    nome:'Operações',
    cargo_alvo:'Gerente de Operações, Coordenador Operacional',
    dores:['SLA invisível', 'falhas recorrentes', 'backlog operacional'],
    objetivos:['SLA', 'produtividade', 'controle de campo'],
    criterios:['usabilidade', 'mobilidade', 'indicadores', 'tempo de resposta'],
    mensagens:['Operação com OS, SLA, aging, manutenção, SSMA e painéis por contrato.']
  }
];

const DEFAULT_TEMPLATES = [
  {
    codigo:'proposta_executiva_padrao',
    nome:'Proposta Executiva Padrão',
    tipo:'proposta',
    estrutura:['Resumo executivo','Contexto do cliente','Solução proposta','Escopo','Diferenciais','Benchmark','Plano de implantação','Investimento','Premissas e exclusões','Próximos passos']
  },
  {
    codigo:'one_pager_segmento',
    nome:'One-pager por Segmento',
    tipo:'one_pager',
    estrutura:['Headline','Problema','Solução','Diferenciais','Provas','CTA']
  },
  {
    codigo:'demo_script_executivo',
    nome:'Roteiro de Demonstração Executivo',
    tipo:'demo_script',
    estrutura:['Abertura','Descoberta','Fluxo principal','Diferenciais','Objeções','Fechamento']
  }
];

function buildExecutiveSummary(cliente: string, segmento: string, scope: any[], diffs: any[]) {
  const diffText = diffs.length ? diffs.slice(0,3).map((d:any)=>d.titulo || d.descricao || String(d)).join('; ') : 'ERP adaptável por segmento, analytics executivo e IA governada com evidências';
  return `Proposta para ${cliente}, orientada ao segmento ${segmento || 'serviços e operações'}. A solução NEXUS ERP busca aumentar controle operacional, governança, rastreabilidade e velocidade de decisão. Diferenciais principais: ${diffText}. As estimativas dependem das premissas e devem ser validadas na etapa de diagnóstico.`;
}

function proposalSections(input: any) {
  const cliente = input.cliente_nome || 'Cliente';
  const segmento = input.segmento_codigo || 'servicos_operacionais';
  const scope = input.escopo_json || ['Core operacional','Suprimentos','Contratos e Medições','Analytics Executivo'];
  const diffs = input.diferenciais || [];
  const benchmarks = input.benchmarks || [];
  return [
    { ordem:1, titulo:'Resumo Executivo', tipo:'texto', conteudo: buildExecutiveSummary(cliente, segmento, scope, diffs), evidencia_json: [] },
    { ordem:2, titulo:'Contexto e Desafios', tipo:'lista', conteudo:'Principais desafios: baixa rastreabilidade, processos manuais, dificuldade de comparar propostas, falta de visão executiva e risco de decisões sem evidência.', evidencia_json: [] },
    { ordem:3, titulo:'Solução Proposta', tipo:'lista', conteudo:`Módulos propostos: ${scope.join(', ')}.`, evidencia_json: [] },
    { ordem:4, titulo:'Diferenciais', tipo:'json', conteudo:'Diferenciais competitivos do NEXUS ERP.', dados_json: diffs, evidencia_json: diffs.flatMap((d:any)=>d.evidencia_json ? parseJson(d.evidencia_json, []) : []) },
    { ordem:5, titulo:'Benchmark e Posicionamento', tipo:'json', conteudo:'Comparativo baseado em fontes públicas cadastradas e evidências internas.', dados_json: benchmarks, evidencia_json: [] },
    { ordem:6, titulo:'Plano de Implantação', tipo:'lista', conteudo:'Diagnóstico, configuração, cadastros, workflows, treinamento, piloto e go-live.', evidencia_json: [] },
    { ordem:7, titulo:'Premissas e Exclusões', tipo:'lista', conteudo:'Premissas devem ser validadas. Integrações externas, migrações complexas e customizações fora do escopo dependem de avaliação técnica.', evidencia_json: [] },
    { ordem:8, titulo:'Próximos Passos', tipo:'lista', conteudo:'Validar escopo, confirmar responsáveis, aprovar cronograma, iniciar diagnóstico e definir ambiente de implantação.', evidencia_json: [] }
  ];
}

function calculateBusinessCase(d: any) {
  const baseline = d.baseline_json || {};
  const ganhos = d.ganhos_json || [];
  const custos = d.custos_json || [];
  const ganhoAnual = ganhos.reduce((s:number,g:any)=>s + Number(g.valor_anual || g.valor || 0), 0);
  const custoTotal = custos.reduce((s:number,c:any)=>s + Number(c.valor || c.valor_total || 0), 0);
  const roi = custoTotal > 0 ? ((ganhoAnual - custoTotal) / custoTotal) * 100 : 0;
  const ganhoMensal = ganhoAnual / 12;
  const payback = ganhoMensal > 0 ? custoTotal / ganhoMensal : 0;
  return { roi_percentual: Number(roi.toFixed(2)), payback_meses: Number(payback.toFixed(2)), ganho_anual: ganhoAnual, custo_total: custoTotal };
}

export function registerCommercialGenerationRoutes(app: Hono, deps: Deps) {
  const { requireOrg, auditLog } = deps;

  async function log(c: Ctx, action: string, entity: string, entityId: string, data?: any) {
    if (auditLog) await auditLog(c, { action, entity, entity_id: entityId, data });
  }

  app.post('/api/commercial/seed-defaults', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    let personas = 0, templates = 0;
    for (const p of DEFAULT_PERSONAS) {
      await c.env.DB.prepare(`
        INSERT OR IGNORE INTO commercial_personas
        (id, org_id, codigo, nome, cargo_alvo, dores_json, objetivos_json, criterios_decisao_json, mensagens_chave_json, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ativo')
      `).bind(uid('persona'), org.id, p.codigo, p.nome, p.cargo_alvo, JSON.stringify(p.dores), JSON.stringify(p.objetivos), JSON.stringify(p.criterios), JSON.stringify(p.mensagens)).run();
      personas++;
    }
    for (const t of DEFAULT_TEMPLATES) {
      await c.env.DB.prepare(`
        INSERT OR IGNORE INTO commercial_offer_templates
        (id, org_id, codigo, nome, tipo, idioma, estrutura_json, conteudo_base, status, created_by)
        VALUES (?, ?, ?, ?, ?, 'pt-BR', ?, ?, 'ativo', ?)
      `).bind(uid('ctpl'), org.id, t.codigo, t.nome, t.tipo, JSON.stringify(t.estrutura), `Template ${t.nome}`, user.id).run();
      templates++;
    }
    await log(c, 'SEED', 'commercial_defaults', org.id, { personas, templates });
    return c.json({ ok:true, personas, templates });
  });

  app.get('/api/commercial/dashboard', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const db = c.env.DB;
    const [proposals, onepagers, demos, decks, cases, assets] = await Promise.all([
      db.prepare(`SELECT status, COUNT(*) qtd FROM commercial_proposals WHERE org_id=? GROUP BY status`).bind(org.id).all(),
      db.prepare(`SELECT status, COUNT(*) qtd FROM commercial_one_pagers WHERE org_id=? GROUP BY status`).bind(org.id).all(),
      db.prepare(`SELECT status, COUNT(*) qtd FROM commercial_demo_scripts WHERE org_id=? GROUP BY status`).bind(org.id).all(),
      db.prepare(`SELECT status, COUNT(*) qtd FROM commercial_pitch_decks WHERE org_id=? GROUP BY status`).bind(org.id).all(),
      db.prepare(`SELECT status, COUNT(*) qtd FROM commercial_business_cases WHERE org_id=? GROUP BY status`).bind(org.id).all(),
      db.prepare(`SELECT tipo, COUNT(*) qtd FROM commercial_assets WHERE org_id=? GROUP BY tipo`).bind(org.id).all()
    ]);
    return c.json({ ok:true, proposals: proposals.results || [], one_pagers: onepagers.results || [], demos: demos.results || [], decks: decks.results || [], business_cases: cases.results || [], assets: assets.results || [] });
  });

  app.get('/api/commercial/templates', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`SELECT * FROM commercial_offer_templates WHERE org_id=? OR org_id IS NULL ORDER BY tipo, nome`).bind(org.id).all();
    return c.json({ ok:true, items: rs.results || [] });
  });

  app.get('/api/commercial/personas', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`SELECT * FROM commercial_personas WHERE org_id=? OR org_id IS NULL ORDER BY nome`).bind(org.id).all();
    return c.json({ ok:true, items: rs.results || [] });
  });

  app.post('/api/commercial/value-propositions', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    if (!d.titulo || !d.descricao) return c.json({ ok:false, error:'titulo e descricao são obrigatórios' }, 400);
    const id = uid('vprop');
    await c.env.DB.prepare(`
      INSERT INTO commercial_value_propositions
      (id, org_id, segmento_codigo, persona_id, titulo, descricao, problema, impacto_negocio, solucao, evidencia_json, diferenciais_json, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, org.id, d.segmento_codigo || null, d.persona_id || null, d.titulo, d.descricao, d.problema || null, d.impacto_negocio || null, d.solucao || null, d.evidencia_json ? json(d.evidencia_json) : '[]', d.diferenciais_json ? json(d.diferenciais_json) : '[]', d.status || 'ativo', user.id).run();
    return c.json({ ok:true, id }, 201);
  });

  app.post('/api/commercial/proposals/generate', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    if (!d.cliente_nome) return c.json({ ok:false, error:'cliente_nome é obrigatório' }, 400);

    const diffs = d.comparison_run_id
      ? (await c.env.DB.prepare(`SELECT * FROM competitive_differentiators WHERE org_id=? AND comparison_run_id=?`).bind(org.id, d.comparison_run_id).all()).results || []
      : [];
    const scores = d.comparison_run_id
      ? (await c.env.DB.prepare(`SELECT * FROM competitive_scores WHERE org_id=? AND comparison_run_id=? ORDER BY score_total DESC`).bind(org.id, d.comparison_run_id).all()).results || []
      : [];

    const codigo = d.codigo || `PROP-${Date.now()}`;
    const escopo = d.escopo_json || ['Core Operacional','Suprimentos','Contratos e Medições','Analytics Executivo','IA Governada'];
    const sections = proposalSections({ ...d, escopo_json: escopo, diferenciais: diffs, benchmarks: scores });
    const resumo = buildExecutiveSummary(d.cliente_nome, d.segmento_codigo || 'serviços e operações', escopo, diffs);
    const id = uid('prop');

    await c.env.DB.prepare(`
      INSERT INTO commercial_proposals
      (id, org_id, codigo, cliente_nome, segmento_codigo, titulo, status, template_id, comparison_run_id, valor_estimado, moeda, prazo_implantacao_dias, premissas_json, escopo_json, fora_escopo_json, riscos_json, conteudo_json, resumo_executivo, created_by)
      VALUES (?, ?, ?, ?, ?, ?, 'rascunho', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, org.id, codigo, d.cliente_nome, d.segmento_codigo || null, d.titulo || `Proposta NEXUS ERP — ${d.cliente_nome}`,
      d.template_id || null, d.comparison_run_id || null, Number(d.valor_estimado || 0), d.moeda || 'BRL',
      d.prazo_implantacao_dias || 30, d.premissas_json ? json(d.premissas_json) : JSON.stringify(['Escopo sujeito a diagnóstico inicial.', 'Integrações dependem de APIs e acessos do cliente.']),
      JSON.stringify(escopo), d.fora_escopo_json ? json(d.fora_escopo_json) : JSON.stringify(['Customizações não descritas no escopo.', 'Integrações fiscais/bancárias sem análise técnica.']),
      d.riscos_json ? json(d.riscos_json) : JSON.stringify(['Atraso na disponibilização de dados pelo cliente.', 'Mudança de escopo durante implantação.']),
      JSON.stringify({ sections, metodologia:'geracao_comercial_governada' }), resumo, user.id
    ).run();

    for (const s of sections) {
      await c.env.DB.prepare(`
        INSERT INTO commercial_proposal_sections
        (id, org_id, proposal_id, ordem, titulo, tipo, conteudo, dados_json, evidencia_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(uid('psec'), org.id, id, s.ordem, s.titulo, s.tipo, s.conteudo || null, s.dados_json ? JSON.stringify(s.dados_json) : null, s.evidencia_json ? JSON.stringify(s.evidencia_json) : '[]').run();
    }

    await log(c, 'CREATE', 'commercial_proposals', id, { codigo, cliente: d.cliente_nome });
    return c.json({ ok:true, id, codigo, resumo_executivo: resumo }, 201);
  });

  app.get('/api/commercial/proposals', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`SELECT * FROM commercial_proposals WHERE org_id=? ORDER BY created_at DESC`).bind(org.id).all();
    return c.json({ ok:true, items: rs.results || [] });
  });

  app.get('/api/commercial/proposals/:id', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const id = c.req.param('id');
    const proposal = await c.env.DB.prepare(`SELECT * FROM commercial_proposals WHERE org_id=? AND id=?`).bind(org.id, id).first();
    if (!proposal) return c.json({ ok:false, error:'Proposta não encontrada' }, 404);
    const sections = await c.env.DB.prepare(`SELECT * FROM commercial_proposal_sections WHERE org_id=? AND proposal_id=? ORDER BY ordem`).bind(org.id, id).all();
    return c.json({ ok:true, proposal, sections: sections.results || [] });
  });

  app.post('/api/commercial/proposals/:id/approve', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const id = c.req.param('id');
    const d = await body(c);
    await c.env.DB.prepare(`UPDATE commercial_proposals SET status='aprovada', approved_by=?, approved_at=?, updated_at=CURRENT_TIMESTAMP WHERE org_id=? AND id=?`).bind(user.id, nowIso(), org.id, id).run();
    await c.env.DB.prepare(`
      INSERT INTO commercial_approval_events
      (id, org_id, entidade_tipo, entidade_id, decisao, comentario, decided_by)
      VALUES (?, ?, 'commercial_proposal', ?, 'aprovar', ?, ?)
    `).bind(uid('capp'), org.id, id, d.comentario || null, user.id).run();
    return c.json({ ok:true, id, status:'aprovada' });
  });

  app.post('/api/commercial/one-pagers/generate', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    const diffs = d.comparison_run_id
      ? (await c.env.DB.prepare(`SELECT * FROM competitive_differentiators WHERE org_id=? AND comparison_run_id=?`).bind(org.id, d.comparison_run_id).all()).results || []
      : [];
    const id = uid('onep');
    const segmento = d.segmento_codigo || 'servicos_operacionais';
    const headline = d.headline || `NEXUS ERP para ${segmento}: operação, contratos, compras e IA governada em uma única plataforma.`;
    await c.env.DB.prepare(`
      INSERT INTO commercial_one_pagers
      (id, org_id, segmento_codigo, titulo, status, headline, problema, proposta_valor, diferenciais_json, provas_json, call_to_action, conteudo_json, created_by)
      VALUES (?, ?, ?, ?, 'rascunho', ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, org.id, segmento, d.titulo || `One-pager NEXUS ERP — ${segmento}`,
      headline,
      d.problema || 'Empresas de serviços e operações sofrem com dados dispersos, aprovações informais, baixa visibilidade de margem e decisões sem evidência.',
      d.proposta_valor || 'O NEXUS ERP conecta operação, suprimentos, contratos, SSMA, analytics e IA governada para dar controle executivo e rastreabilidade.',
      JSON.stringify(diffs),
      d.provas_json ? json(d.provas_json) : JSON.stringify(['Benchmark competitivo governado.', 'Módulos por segmento.', 'IA com evidências e validação humana.']),
      d.call_to_action || 'Agendar diagnóstico operacional e demonstração executiva.',
      JSON.stringify({ formato:'one_pager', segmento, diffs }),
      user.id
    ).run();
    return c.json({ ok:true, id }, 201);
  });

  app.get('/api/commercial/one-pagers', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`SELECT * FROM commercial_one_pagers WHERE org_id=? ORDER BY created_at DESC`).bind(org.id).all();
    return c.json({ ok:true, items: rs.results || [] });
  });

  app.post('/api/commercial/demo-scripts/generate', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    const segmento = d.segmento_codigo || 'servicos_operacionais';
    const roteiro = [
      { ordem:1, etapa:'Abertura', objetivo:'Confirmar contexto do cliente e objetivo da reunião.', fala:'Hoje vou mostrar como o NEXUS ERP conecta operação, suprimentos, contratos, analytics e IA governada.' },
      { ordem:2, etapa:'Diagnóstico rápido', objetivo:'Entender dores prioritárias.', perguntas:['Onde hoje vocês mais perdem tempo?', 'Quais decisões ainda dependem de planilha?', 'Quais aprovações geram maior risco?'] },
      { ordem:3, etapa:'Fluxo ponta a ponta', objetivo:'Demonstrar processo do pedido à decisão.', demo:['Dashboard executivo','Suprimentos/Sourcing','Contratos e Medições','Analytics','IA governada com evidências'] },
      { ordem:4, etapa:'Diferenciais', objetivo:'Conectar com benchmark e segmento.', demo:['Templates por segmento','RAG e evidências','Benchmark competitivo','Onboarding guiado'] },
      { ordem:5, etapa:'Fechamento', objetivo:'Converter para diagnóstico/proposta.', fala:'O próximo passo recomendado é validar escopo, dados e processo piloto.' }
    ];
    const objections = [
      { objecao:'Já temos ERP.', resposta:'O NEXUS pode atuar como camada operacional/vertical, integrando ou complementando o ERP existente.' },
      { objecao:'IA pode inventar resposta.', resposta:'A IA do NEXUS é governada: sem evidência, sem recomendação.' },
      { objecao:'Implantação pode ser longa.', resposta:'O onboarding por segmento reduz retrabalho e prioriza módulos por valor.' }
    ];
    const id = uid('demo');
    await c.env.DB.prepare(`
      INSERT INTO commercial_demo_scripts
      (id, org_id, segmento_codigo, persona_id, titulo, status, duracao_minutos, roteiro_json, perguntas_descoberta_json, objeções_respostas_json, evidencias_json, created_by)
      VALUES (?, ?, ?, ?, ?, 'rascunho', ?, ?, ?, ?, ?, ?)
    `).bind(
      id, org.id, segmento, d.persona_id || null, d.titulo || `Demo Script — ${segmento}`,
      d.duracao_minutos || 30, JSON.stringify(roteiro),
      JSON.stringify(['Quais KPIs a diretoria cobra hoje?', 'Onde há maior risco de compliance?', 'Quanto tempo se perde consolidando dados?']),
      JSON.stringify(objections),
      d.evidencias_json ? json(d.evidencias_json) : '[]',
      user.id
    ).run();
    return c.json({ ok:true, id }, 201);
  });

  app.get('/api/commercial/demo-scripts', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`SELECT * FROM commercial_demo_scripts WHERE org_id=? ORDER BY created_at DESC`).bind(org.id).all();
    return c.json({ ok:true, items: rs.results || [] });
  });

  app.post('/api/commercial/pitch-decks/generate', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    const segmento = d.segmento_codigo || 'servicos_operacionais';
    const slides = [
      { n:1, titulo:'NEXUS ERP', subtitulo:`ERP operacional adaptável para ${segmento}` },
      { n:2, titulo:'Problema', bullets:['Processos fragmentados', 'Decisões sem evidência', 'Baixa visibilidade de margem e SLA'] },
      { n:3, titulo:'Solução', bullets:['Operação + Suprimentos + Contratos + Analytics + IA governada', 'Configuração por segmento', 'Rastreabilidade ponta a ponta'] },
      { n:4, titulo:'Diferenciais', bullets:['IA com evidência obrigatória', 'Benchmark competitivo governado', 'Onboarding inteligente', 'Módulos por segmento'] },
      { n:5, titulo:'Valor para o Cliente', bullets:['Governança', 'Redução de retrabalho', 'Visão executiva', 'Controle de risco'] },
      { n:6, titulo:'Implantação', bullets:['Diagnóstico', 'Configuração', 'Piloto', 'Treinamento', 'Go-live'] },
      { n:7, titulo:'Próximo Passo', bullets:['Validar escopo piloto', 'Definir responsáveis', 'Iniciar diagnóstico'] }
    ];
    const id = uid('deck');
    await c.env.DB.prepare(`
      INSERT INTO commercial_pitch_decks
      (id, org_id, segmento_codigo, titulo, status, publico_alvo, slides_json, narrativa, created_by)
      VALUES (?, ?, ?, ?, 'rascunho', ?, ?, ?, ?)
    `).bind(id, org.id, segmento, d.titulo || `Pitch Deck — NEXUS ERP ${segmento}`, d.publico_alvo || 'executivo', JSON.stringify(slides), d.narrativa || 'Narrativa executiva orientada a dor, solução, diferencial, valor e implantação.', user.id).run();
    return c.json({ ok:true, id, slides }, 201);
  });

  app.get('/api/commercial/pitch-decks', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`SELECT * FROM commercial_pitch_decks WHERE org_id=? ORDER BY created_at DESC`).bind(org.id).all();
    return c.json({ ok:true, items: rs.results || [] });
  });

  app.post('/api/commercial/business-cases/generate', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    if (!d.titulo) return c.json({ ok:false, error:'titulo é obrigatório' }, 400);
    const calc = calculateBusinessCase(d);
    const id = uid('bcase');
    await c.env.DB.prepare(`
      INSERT INTO commercial_business_cases
      (id, org_id, cliente_nome, segmento_codigo, titulo, status, baseline_json, ganhos_json, custos_json, roi_percentual, payback_meses, premissas_json, riscos_json, created_by)
      VALUES (?, ?, ?, ?, ?, 'rascunho', ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, org.id, d.cliente_nome || null, d.segmento_codigo || null, d.titulo,
      d.baseline_json ? json(d.baseline_json) : '{}',
      d.ganhos_json ? json(d.ganhos_json) : '[]',
      d.custos_json ? json(d.custos_json) : '[]',
      calc.roi_percentual, calc.payback_meses,
      d.premissas_json ? json(d.premissas_json) : JSON.stringify(['Valores estimados devem ser validados com dados reais do cliente.']),
      d.riscos_json ? json(d.riscos_json) : JSON.stringify(['Benefícios dependem de adoção, qualidade dos dados e aderência do processo.']),
      user.id
    ).run();
    return c.json({ ok:true, id, ...calc }, 201);
  });

  app.get('/api/commercial/business-cases', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`SELECT * FROM commercial_business_cases WHERE org_id=? ORDER BY created_at DESC`).bind(org.id).all();
    return c.json({ ok:true, items: rs.results || [] });
  });

  app.post('/api/commercial/implementation-plans/generate', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    const fases = d.fases_json || [
      { fase:'Diagnóstico', dias:5, entregaveis:['Mapa de processo','Escopo validado','Riscos iniciais'] },
      { fase:'Configuração', dias:10, entregaveis:['Módulos configurados','Workflows','Perfis e permissões'] },
      { fase:'Dados e Integrações', dias:10, entregaveis:['Cadastros importados','Conectores avaliados','Validação de dados'] },
      { fase:'Piloto', dias:7, entregaveis:['Usuários-chave treinados','Processo piloto','Ajustes'] },
      { fase:'Go-live', dias:3, entregaveis:['Operação assistida','Checklist final','Plano de suporte'] }
    ];
    const total = fases.reduce((s:number,f:any)=>s+Number(f.dias || 0),0);
    const id = uid('impl');
    await c.env.DB.prepare(`
      INSERT INTO commercial_implementation_plans
      (id, org_id, proposal_id, segmento_codigo, titulo, status, fases_json, milestones_json, responsabilidades_json, riscos_json, duracao_total_dias, created_by)
      VALUES (?, ?, ?, ?, ?, 'rascunho', ?, ?, ?, ?, ?, ?)
    `).bind(
      id, org.id, d.proposal_id || null, d.segmento_codigo || null, d.titulo || 'Plano de Implantação NEXUS ERP',
      JSON.stringify(fases),
      d.milestones_json ? json(d.milestones_json) : JSON.stringify(['Kickoff','Configuração concluída','Piloto aprovado','Go-live']),
      d.responsabilidades_json ? json(d.responsabilidades_json) : JSON.stringify([{ papel:'Cliente', responsabilidade:'Disponibilizar dados e usuários-chave' }, { papel:'NEXUS', responsabilidade:'Configurar, treinar e apoiar implantação' }]),
      d.riscos_json ? json(d.riscos_json) : JSON.stringify(['Atraso no envio de dados', 'Mudança de escopo', 'Baixa adesão de usuários']),
      total || d.duracao_total_dias || 30, user.id
    ).run();
    return c.json({ ok:true, id, duracao_total_dias: total || d.duracao_total_dias || 30 }, 201);
  });

  app.get('/api/commercial/implementation-plans', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`SELECT * FROM commercial_implementation_plans WHERE org_id=? ORDER BY created_at DESC`).bind(org.id).all();
    return c.json({ ok:true, items: rs.results || [] });
  });

  app.post('/api/commercial/assets/export-json', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    if (!d.entidade_tipo || !d.entidade_id) return c.json({ ok:false, error:'entidade_tipo e entidade_id são obrigatórios' }, 400);
    let row: any = null;
    const tableMap: Record<string,string> = {
      proposal:'commercial_proposals',
      one_pager:'commercial_one_pagers',
      demo_script:'commercial_demo_scripts',
      pitch_deck:'commercial_pitch_decks',
      business_case:'commercial_business_cases',
      implementation_plan:'commercial_implementation_plans'
    };
    const table = tableMap[d.entidade_tipo];
    if (!table) return c.json({ ok:false, error:'entidade_tipo inválido' }, 400);
    row = await c.env.DB.prepare(`SELECT * FROM ${table} WHERE org_id=? AND id=?`).bind(org.id, d.entidade_id).first();
    if (!row) return c.json({ ok:false, error:'Entidade não encontrada' }, 404);

    const id = uid('casset');
    await c.env.DB.prepare(`
      INSERT INTO commercial_assets
      (id, org_id, tipo, entidade_tipo, entidade_id, titulo, formato, conteudo_json, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, 'json', ?, 'gerado', ?)
    `).bind(id, org.id, d.tipo || 'export_json', d.entidade_tipo, d.entidade_id, d.titulo || row.titulo || 'Asset comercial', JSON.stringify(row), user.id).run();
    return c.json({ ok:true, id, content: row }, 201);
  });

  app.get('/api/commercial/assets', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`SELECT * FROM commercial_assets WHERE org_id=? ORDER BY created_at DESC`).bind(org.id).all();
    return c.json({ ok:true, items: rs.results || [] });
  });
}

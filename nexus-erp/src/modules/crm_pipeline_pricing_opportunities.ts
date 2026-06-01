// src/modules/crm_pipeline_pricing_opportunities.ts
// NEXUS ERP — Etapa 24: CRM, Pipeline Comercial, Precificação, Aprovação Comercial e Gestão de Oportunidades
//
// Integração:
// import { registerCrmPipelinePricingRoutes } from './modules/crm_pipeline_pricing_opportunities';
// registerCrmPipelinePricingRoutes(app, { requireOrg, auditLog });
//
// Regra crítica:
// desconto/margem fora da política gera aprovação comercial obrigatória.

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
function num(v: any, fallback = 0) { const n = Number(v); return Number.isFinite(n) ? n : fallback; }

const DEFAULT_STAGES = [
  { codigo:'lead_qualificado', nome:'Lead Qualificado', ordem:1, probabilidade:10, tipo:'open', criterio:'Necessidade e contato identificados.' },
  { codigo:'descoberta', nome:'Descoberta', ordem:2, probabilidade:20, tipo:'open', criterio:'Dor, orçamento, autoridade e prazo mapeados.' },
  { codigo:'demo', nome:'Demonstração', ordem:3, probabilidade:35, tipo:'open', criterio:'Demonstração realizada e próximos passos definidos.' },
  { codigo:'proposta', nome:'Proposta', ordem:4, probabilidade:55, tipo:'open', criterio:'Proposta enviada.' },
  { codigo:'negociacao', nome:'Negociação', ordem:5, probabilidade:70, tipo:'open', criterio:'Termos comerciais em negociação.' },
  { codigo:'aprovacao', nome:'Aprovação', ordem:6, probabilidade:85, tipo:'open', criterio:'Aprovação interna/cliente em andamento.' },
  { codigo:'ganha', nome:'Ganha', ordem:7, probabilidade:100, tipo:'won', criterio:'Contrato ou pedido aprovado.' },
  { codigo:'perdida', nome:'Perdida', ordem:8, probabilidade:0, tipo:'lost', criterio:'Cliente recusou ou oportunidade encerrada.' }
];

function quoteItemCalc(qty: number, price: number, cost: number, discPct: number) {
  const subtotal = qty * price;
  const total = subtotal * (1 - discPct / 100);
  const totalCost = qty * cost;
  const margin = total > 0 ? ((total - totalCost) / total) * 100 : 0;
  return {
    subtotal: Number(subtotal.toFixed(2)),
    total: Number(total.toFixed(2)),
    margem_percentual: Number(margin.toFixed(2))
  };
}

async function recalcQuote(db: any, orgId: string, quoteId: string) {
  const items = await db.prepare(`SELECT * FROM crm_quote_items WHERE org_id=? AND quote_id=?`).bind(orgId, quoteId).all();
  let subtotal = 0, total = 0, cost = 0;
  for (const it of items.results || []) {
    subtotal += Number(it.subtotal || 0);
    total += Number(it.total || 0);
    cost += Number(it.custo_unitario || 0) * Number(it.quantidade || 0);
  }
  const discount = subtotal - total;
  const margin = total > 0 ? ((total - cost) / total) * 100 : 0;
  await db.prepare(`
    UPDATE crm_quotes SET subtotal=?, desconto_total=?, total=?, margem_percentual=?, updated_at=CURRENT_TIMESTAMP
    WHERE org_id=? AND id=?
  `).bind(Number(subtotal.toFixed(2)), Number(discount.toFixed(2)), Number(total.toFixed(2)), Number(margin.toFixed(2)), orgId, quoteId).run();
  return { subtotal, discount, total, margin };
}

export function registerCrmPipelinePricingRoutes(app: Hono, deps: Deps) {
  const { requireOrg, auditLog } = deps;

  async function log(c: Ctx, action: string, entity: string, entityId: string, data?: any) {
    if (auditLog) await auditLog(c, { action, entity, entity_id: entityId, data });
  }

  app.post('/api/crm/seed-defaults', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    let stages = 0;
    for (const s of DEFAULT_STAGES) {
      await c.env.DB.prepare(`
        INSERT OR IGNORE INTO crm_pipeline_stages
        (id, org_id, codigo, nome, ordem, probabilidade_padrao, tipo, criterio_saida)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(uid('stage'), org.id, s.codigo, s.nome, s.ordem, s.probabilidade, s.tipo, s.criterio).run();
      stages++;
    }
    await c.env.DB.prepare(`
      INSERT OR IGNORE INTO commercial_discount_policies
      (id, org_id, codigo, nome, desconto_max_sem_aprovacao, margem_minima_sem_aprovacao, aprovador_role, status)
      VALUES (?, ?, 'default', 'Política Comercial Padrão', 10, 30, 'diretor_comercial', 'ativo')
    `).bind(uid('dpol'), org.id).run();

    const items = [
      { codigo:'setup_implantacao', nome:'Setup de implantação', tipo:'one_time', unidade:'projeto', preco:30000, custo:12000, margem:35 },
      { codigo:'assinatura_core', nome:'Assinatura Core ERP', tipo:'recorrente', unidade:'mês', preco:5000, custo:1500, margem:40 },
      { codigo:'modulo_ia', nome:'Módulo IA Governada', tipo:'recorrente', unidade:'mês', preco:3000, custo:900, margem:40 },
      { codigo:'suporte_premium', nome:'Suporte Premium', tipo:'recorrente', unidade:'mês', preco:2500, custo:800, margem:35 }
    ];
    for (const it of items) {
      await c.env.DB.prepare(`
        INSERT OR IGNORE INTO pricing_items
        (id, org_id, codigo, nome, tipo, unidade, preco_unitario, custo_unitario, margem_minima_percentual, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ativo')
      `).bind(uid('pitem'), org.id, it.codigo, it.nome, it.tipo, it.unidade, it.preco, it.custo, it.margem).run();
    }

    await log(c, 'SEED', 'crm_defaults', org.id, { stages });
    return c.json({ ok:true, stages, pricing_items: items.length });
  });

  app.get('/api/crm/dashboard', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const db = c.env.DB;
    const [leads, opps, quotes, approvals, activities, forecast] = await Promise.all([
      db.prepare(`SELECT status, COUNT(*) qtd FROM crm_leads WHERE org_id=? GROUP BY status`).bind(org.id).all(),
      db.prepare(`SELECT status, COUNT(*) qtd, COALESCE(SUM(valor_estimado),0) valor FROM crm_opportunities WHERE org_id=? GROUP BY status`).bind(org.id).all(),
      db.prepare(`SELECT status, COUNT(*) qtd, COALESCE(SUM(total),0) valor FROM crm_quotes WHERE org_id=? GROUP BY status`).bind(org.id).all(),
      db.prepare(`SELECT status, COUNT(*) qtd FROM commercial_approval_requests WHERE org_id=? GROUP BY status`).bind(org.id).all(),
      db.prepare(`SELECT status, COUNT(*) qtd FROM crm_activities WHERE org_id=? GROUP BY status`).bind(org.id).all(),
      db.prepare(`SELECT * FROM sales_forecasts WHERE org_id=? ORDER BY generated_at DESC LIMIT 1`).bind(org.id).first()
    ]);
    return c.json({ ok:true, leads: leads.results || [], opportunities: opps.results || [], quotes: quotes.results || [], approvals: approvals.results || [], activities: activities.results || [], latest_forecast: forecast || null });
  });

  app.get('/api/crm/stages', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`SELECT * FROM crm_pipeline_stages WHERE org_id=? ORDER BY ordem`).bind(org.id).all();
    return c.json({ ok:true, items: rs.results || [] });
  });

  app.post('/api/crm/accounts', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    if (!d.razao_social) return c.json({ ok:false, error:'razao_social é obrigatório' }, 400);
    const id = uid('acct');
    const codigo = d.codigo || `ACC-${Date.now()}`;
    await c.env.DB.prepare(`
      INSERT INTO crm_accounts
      (id, org_id, codigo, razao_social, nome_fantasia, cnpj, segmento_codigo, porte, origem, status, website, cidade, estado, pais, owner_id, metadata_json, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, org.id, codigo, d.razao_social, d.nome_fantasia || null, d.cnpj || null, d.segmento_codigo || null, d.porte || 'medio', d.origem || 'manual', d.status || 'ativo', d.website || null, d.cidade || null, d.estado || null, d.pais || 'Brasil', d.owner_id || user.id, d.metadata_json ? json(d.metadata_json) : null, user.id).run();
    return c.json({ ok:true, id, codigo }, 201);
  });

  app.get('/api/crm/accounts', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`SELECT * FROM crm_accounts WHERE org_id=? ORDER BY created_at DESC LIMIT 300`).bind(org.id).all();
    return c.json({ ok:true, items: rs.results || [] });
  });

  app.post('/api/crm/contacts', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    if (!d.nome) return c.json({ ok:false, error:'nome é obrigatório' }, 400);
    const id = uid('cont');
    await c.env.DB.prepare(`
      INSERT INTO crm_contacts
      (id, org_id, account_id, nome, cargo, area, email, telefone, whatsapp, decisor, influenciador, status, observacao, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, org.id, d.account_id || null, d.nome, d.cargo || null, d.area || null, d.email || null, d.telefone || null, d.whatsapp || null, d.decisor ? 1 : 0, d.influenciador ? 1 : 0, d.status || 'ativo', d.observacao || null, user.id).run();
    return c.json({ ok:true, id }, 201);
  });

  app.get('/api/crm/contacts', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`SELECT * FROM crm_contacts WHERE org_id=? ORDER BY created_at DESC LIMIT 300`).bind(org.id).all();
    return c.json({ ok:true, items: rs.results || [] });
  });

  app.post('/api/crm/leads', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    if (!d.nome) return c.json({ ok:false, error:'nome é obrigatório' }, 400);
    const id = uid('lead');
    await c.env.DB.prepare(`
      INSERT INTO crm_leads
      (id, org_id, nome, empresa, email, telefone, segmento_codigo, origem, status, score, temperatura, necessidade, proximo_passo, owner_id, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, org.id, d.nome, d.empresa || null, d.email || null, d.telefone || null, d.segmento_codigo || null, d.origem || 'manual', d.status || 'novo', num(d.score, 0), d.temperatura || 'morno', d.necessidade || null, d.proximo_passo || null, d.owner_id || user.id, user.id).run();
    return c.json({ ok:true, id }, 201);
  });

  app.get('/api/crm/leads', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`SELECT * FROM crm_leads WHERE org_id=? ORDER BY created_at DESC LIMIT 300`).bind(org.id).all();
    return c.json({ ok:true, items: rs.results || [] });
  });

  app.post('/api/crm/leads/:id/convert', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const id = c.req.param('id');
    const lead = await c.env.DB.prepare(`SELECT * FROM crm_leads WHERE org_id=? AND id=?`).bind(org.id, id).first();
    if (!lead) return c.json({ ok:false, error:'Lead não encontrado' }, 404);

    const accountId = uid('acct');
    const accountCode = `ACC-${Date.now()}`;
    await c.env.DB.prepare(`
      INSERT INTO crm_accounts
      (id, org_id, codigo, razao_social, nome_fantasia, segmento_codigo, origem, status, owner_id, created_by)
      VALUES (?, ?, ?, ?, ?, ?, 'lead_conversion', 'ativo', ?, ?)
    `).bind(accountId, org.id, accountCode, lead.empresa || lead.nome, lead.empresa || null, lead.segmento_codigo || null, lead.owner_id || user.id, user.id).run();

    const stage = await c.env.DB.prepare(`SELECT * FROM crm_pipeline_stages WHERE org_id=? AND codigo='lead_qualificado'`).bind(org.id).first();
    const oppId = uid('opp');
    const oppCode = `OPP-${Date.now()}`;
    await c.env.DB.prepare(`
      INSERT INTO crm_opportunities
      (id, org_id, codigo, account_id, lead_id, titulo, segmento_codigo, stage_id, status, valor_estimado, probabilidade, origem, dor_principal, next_step, owner_id, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'aberta', 0, ?, 'lead_conversion', ?, ?, ?, ?)
    `).bind(oppId, org.id, oppCode, accountId, id, `Oportunidade — ${lead.empresa || lead.nome}`, lead.segmento_codigo || null, stage?.id || null, stage?.probabilidade_padrao || 10, lead.necessidade || null, lead.proximo_passo || 'Realizar descoberta comercial', lead.owner_id || user.id, user.id).run();

    await c.env.DB.prepare(`UPDATE crm_leads SET status='convertido', converted_account_id=?, converted_opportunity_id=?, converted_at=?, updated_at=CURRENT_TIMESTAMP WHERE org_id=? AND id=?`).bind(accountId, oppId, nowIso(), org.id, id).run();
    return c.json({ ok:true, account_id: accountId, opportunity_id: oppId }, 201);
  });

  app.post('/api/crm/opportunities', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    if (!d.account_id || !d.titulo) return c.json({ ok:false, error:'account_id e titulo são obrigatórios' }, 400);
    const id = uid('opp');
    const codigo = d.codigo || `OPP-${Date.now()}`;
    let stage = null;
    if (d.stage_id) stage = await c.env.DB.prepare(`SELECT * FROM crm_pipeline_stages WHERE org_id=? AND id=?`).bind(org.id, d.stage_id).first();
    if (!stage) stage = await c.env.DB.prepare(`SELECT * FROM crm_pipeline_stages WHERE org_id=? ORDER BY ordem LIMIT 1`).bind(org.id).first();
    await c.env.DB.prepare(`
      INSERT INTO crm_opportunities
      (id, org_id, codigo, account_id, contact_id, lead_id, titulo, segmento_codigo, stage_id, status, valor_estimado, moeda, probabilidade, expected_close_date, origem, dor_principal, proposta_valor, concorrentes_json, riscos_json, next_step, owner_id, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, org.id, codigo, d.account_id, d.contact_id || null, d.lead_id || null, d.titulo, d.segmento_codigo || null, stage?.id || null, d.status || 'aberta', num(d.valor_estimado, 0), d.moeda || 'BRL', d.probabilidade ?? stage?.probabilidade_padrao ?? 0, d.expected_close_date || null, d.origem || 'manual', d.dor_principal || null, d.proposta_valor || null, d.concorrentes_json ? json(d.concorrentes_json) : '[]', d.riscos_json ? json(d.riscos_json) : '[]', d.next_step || null, d.owner_id || user.id, user.id).run();
    return c.json({ ok:true, id, codigo }, 201);
  });

  app.get('/api/crm/opportunities', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`
      SELECT o.*, a.razao_social AS account_name, s.nome AS stage_name, s.ordem AS stage_order
      FROM crm_opportunities o
      JOIN crm_accounts a ON a.id=o.account_id
      LEFT JOIN crm_pipeline_stages s ON s.id=o.stage_id
      WHERE o.org_id=?
      ORDER BY o.created_at DESC
      LIMIT 500
    `).bind(org.id).all();
    return c.json({ ok:true, items: rs.results || [] });
  });

  app.post('/api/crm/opportunities/:id/move-stage', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const id = c.req.param('id');
    const d = await body(c);
    if (!d.stage_id) return c.json({ ok:false, error:'stage_id é obrigatório' }, 400);
    const opp = await c.env.DB.prepare(`SELECT * FROM crm_opportunities WHERE org_id=? AND id=?`).bind(org.id, id).first();
    const stage = await c.env.DB.prepare(`SELECT * FROM crm_pipeline_stages WHERE org_id=? AND id=?`).bind(org.id, d.stage_id).first();
    if (!opp || !stage) return c.json({ ok:false, error:'Oportunidade ou etapa não encontrada' }, 404);

    const status = stage.tipo === 'won' ? 'ganha' : stage.tipo === 'lost' ? 'perdida' : 'aberta';
    await c.env.DB.prepare(`
      UPDATE crm_opportunities
      SET stage_id=?, probabilidade=?, status=?, closed_at=?, won_reason=?, lost_reason=?, updated_at=CURRENT_TIMESTAMP
      WHERE org_id=? AND id=?
    `).bind(stage.id, stage.probabilidade_padrao, status, ['won','lost'].includes(stage.tipo) ? nowIso() : null, d.won_reason || null, d.lost_reason || null, org.id, id).run();

    await c.env.DB.prepare(`
      INSERT INTO crm_opportunity_stage_history
      (id, org_id, opportunity_id, from_stage_id, to_stage_id, changed_by, motivo)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(uid('sthist'), org.id, id, opp.stage_id || null, stage.id, user.id, d.motivo || null).run();

    return c.json({ ok:true, id, status, stage: stage.codigo });
  });

  app.get('/api/pricing/items', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`SELECT * FROM pricing_items WHERE org_id=? ORDER BY tipo, nome`).bind(org.id).all();
    return c.json({ ok:true, items: rs.results || [] });
  });

  app.post('/api/pricing/items', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    if (!d.codigo || !d.nome) return c.json({ ok:false, error:'codigo e nome são obrigatórios' }, 400);
    const id = uid('pitem');
    await c.env.DB.prepare(`
      INSERT INTO pricing_items
      (id, org_id, codigo, nome, tipo, unidade, preco_unitario, custo_unitario, margem_minima_percentual, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, org.id, d.codigo, d.nome, d.tipo || 'recorrente', d.unidade || 'mês', num(d.preco_unitario,0), num(d.custo_unitario,0), num(d.margem_minima_percentual,0), d.status || 'ativo', user.id).run();
    return c.json({ ok:true, id }, 201);
  });

  app.post('/api/crm/quotes', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    if (!d.opportunity_id) return c.json({ ok:false, error:'opportunity_id é obrigatório' }, 400);
    const id = uid('quote');
    const codigo = d.codigo || `Q-${Date.now()}`;
    await c.env.DB.prepare(`
      INSERT INTO crm_quotes
      (id, org_id, opportunity_id, proposal_id, codigo, status, moeda, validade_ate, premissas_json, observacao, created_by)
      VALUES (?, ?, ?, ?, ?, 'rascunho', ?, ?, ?, ?, ?)
    `).bind(id, org.id, d.opportunity_id, d.proposal_id || null, codigo, d.moeda || 'BRL', d.validade_ate || null, d.premissas_json ? json(d.premissas_json) : '[]', d.observacao || null, user.id).run();
    return c.json({ ok:true, id, codigo }, 201);
  });

  app.post('/api/crm/quotes/:id/items', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const quoteId = c.req.param('id');
    const d = await body(c);
    if (!d.descricao && !d.pricing_item_id) return c.json({ ok:false, error:'descricao ou pricing_item_id é obrigatório' }, 400);
    let item = null;
    if (d.pricing_item_id) item = await c.env.DB.prepare(`SELECT * FROM pricing_items WHERE org_id=? AND id=?`).bind(org.id, d.pricing_item_id).first();

    const descricao = d.descricao || item?.nome;
    const qty = num(d.quantidade, 1);
    const price = num(d.preco_unitario, item?.preco_unitario || 0);
    const cost = num(d.custo_unitario, item?.custo_unitario || 0);
    const disc = num(d.desconto_percentual, 0);
    const calc = quoteItemCalc(qty, price, cost, disc);
    const id = uid('qitem');
    await c.env.DB.prepare(`
      INSERT INTO crm_quote_items
      (id, org_id, quote_id, pricing_item_id, descricao, quantidade, unidade, preco_unitario, custo_unitario, desconto_percentual, subtotal, total, margem_percentual, ordem)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, org.id, quoteId, d.pricing_item_id || null, descricao, qty, d.unidade || item?.unidade || 'un', price, cost, disc, calc.subtotal, calc.total, calc.margem_percentual, d.ordem || 1).run();
    const totals = await recalcQuote(c.env.DB, org.id, quoteId);
    return c.json({ ok:true, id, item: calc, quote_totals: totals }, 201);
  });

  app.get('/api/crm/quotes', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`SELECT * FROM crm_quotes WHERE org_id=? ORDER BY created_at DESC`).bind(org.id).all();
    return c.json({ ok:true, items: rs.results || [] });
  });

  app.get('/api/crm/quotes/:id', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const id = c.req.param('id');
    const quote = await c.env.DB.prepare(`SELECT * FROM crm_quotes WHERE org_id=? AND id=?`).bind(org.id, id).first();
    if (!quote) return c.json({ ok:false, error:'Quote não encontrada' }, 404);
    const items = await c.env.DB.prepare(`SELECT * FROM crm_quote_items WHERE org_id=? AND quote_id=? ORDER BY ordem`).bind(org.id, id).all();
    return c.json({ ok:true, quote, items: items.results || [] });
  });

  app.post('/api/crm/quotes/:id/submit-approval', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const id = c.req.param('id');
    const quote = await c.env.DB.prepare(`SELECT * FROM crm_quotes WHERE org_id=? AND id=?`).bind(org.id, id).first();
    if (!quote) return c.json({ ok:false, error:'Quote não encontrada' }, 404);
    const policy = await c.env.DB.prepare(`SELECT * FROM commercial_discount_policies WHERE org_id=? AND status='ativo' ORDER BY created_at DESC LIMIT 1`).bind(org.id).first();
    const discountPct = quote.subtotal > 0 ? (Number(quote.desconto_total || 0) / Number(quote.subtotal)) * 100 : 0;
    const requires = discountPct > Number(policy?.desconto_max_sem_aprovacao || 0) || Number(quote.margem_percentual || 0) < Number(policy?.margem_minima_sem_aprovacao || 0);
    if (!requires) {
      await c.env.DB.prepare(`UPDATE crm_quotes SET status='aprovada_auto', approved_by=?, approved_at=?, updated_at=CURRENT_TIMESTAMP WHERE org_id=? AND id=?`).bind(user.id, nowIso(), org.id, id).run();
      return c.json({ ok:true, status:'aprovada_auto', requires_approval:false });
    }
    const reqId = uid('appr');
    await c.env.DB.prepare(`
      INSERT INTO commercial_approval_requests
      (id, org_id, entidade_tipo, entidade_id, tipo, status, motivo, valor_impacto, margem_percentual, desconto_percentual, requested_by)
      VALUES (?, ?, 'quote', ?, 'desconto_margem', 'pendente', ?, ?, ?, ?, ?)
    `).bind(reqId, org.id, id, 'Desconto ou margem fora da política comercial.', num(quote.desconto_total,0), num(quote.margem_percentual,0), discountPct, user.id).run();
    await c.env.DB.prepare(`UPDATE crm_quotes SET status='aguardando_aprovacao', updated_at=CURRENT_TIMESTAMP WHERE org_id=? AND id=?`).bind(org.id, id).run();
    return c.json({ ok:true, status:'aguardando_aprovacao', requires_approval:true, approval_request_id:reqId });
  });

  app.get('/api/commercial/approval-requests', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`SELECT * FROM commercial_approval_requests WHERE org_id=? ORDER BY created_at DESC`).bind(org.id).all();
    return c.json({ ok:true, items: rs.results || [] });
  });

  app.post('/api/commercial/approval-requests/:id/decide', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const id = c.req.param('id');
    const d = await body(c);
    if (!['aprovar','rejeitar'].includes(d.decisao)) return c.json({ ok:false, error:'decisão inválida' }, 400);
    const req = await c.env.DB.prepare(`SELECT * FROM commercial_approval_requests WHERE org_id=? AND id=?`).bind(org.id, id).first();
    if (!req) return c.json({ ok:false, error:'Solicitação não encontrada' }, 404);
    const status = d.decisao === 'aprovar' ? 'aprovada' : 'rejeitada';
    await c.env.DB.prepare(`
      UPDATE commercial_approval_requests SET status=?, decided_by=?, decided_at=?, decisao=?, comentario=?, updated_at=CURRENT_TIMESTAMP
      WHERE org_id=? AND id=?
    `).bind(status, user.id, nowIso(), d.decisao, d.comentario || null, org.id, id).run();
    if (req.entidade_tipo === 'quote') {
      await c.env.DB.prepare(`UPDATE crm_quotes SET status=?, approved_by=?, approved_at=?, updated_at=CURRENT_TIMESTAMP WHERE org_id=? AND id=?`).bind(d.decisao === 'aprovar' ? 'aprovada' : 'rejeitada', user.id, nowIso(), org.id, req.entidade_id).run();
    }
    return c.json({ ok:true, id, status });
  });

  app.post('/api/crm/activities', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    if (!d.titulo) return c.json({ ok:false, error:'titulo é obrigatório' }, 400);
    const id = uid('act');
    await c.env.DB.prepare(`
      INSERT INTO crm_activities
      (id, org_id, account_id, contact_id, opportunity_id, lead_id, tipo, titulo, descricao, data_atividade, due_at, status, owner_id, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, org.id, d.account_id || null, d.contact_id || null, d.opportunity_id || null, d.lead_id || null, d.tipo || 'nota', d.titulo, d.descricao || null, d.data_atividade || nowIso(), d.due_at || null, d.status || 'aberta', d.owner_id || user.id, user.id).run();
    return c.json({ ok:true, id }, 201);
  });

  app.get('/api/crm/activities', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`SELECT * FROM crm_activities WHERE org_id=? ORDER BY COALESCE(due_at, created_at) DESC LIMIT 300`).bind(org.id).all();
    return c.json({ ok:true, items: rs.results || [] });
  });

  app.post('/api/crm/interactions', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    const id = uid('int');
    await c.env.DB.prepare(`
      INSERT INTO crm_interactions
      (id, org_id, account_id, contact_id, opportunity_id, canal, assunto, resumo, sentimento, proximo_passo, interaction_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, org.id, d.account_id || null, d.contact_id || null, d.opportunity_id || null, d.canal || 'email', d.assunto || null, d.resumo || null, d.sentimento || 'neutro', d.proximo_passo || null, d.interaction_at || nowIso(), user.id).run();
    return c.json({ ok:true, id }, 201);
  });

  app.post('/api/sales/forecast/generate', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    const periodo = d.periodo || new Date().toISOString().slice(0,7);
    const rows = await c.env.DB.prepare(`
      SELECT o.*, s.codigo AS stage_codigo
      FROM crm_opportunities o
      LEFT JOIN crm_pipeline_stages s ON s.id=o.stage_id
      WHERE o.org_id=? AND o.status='aberta'
    `).bind(org.id).all();
    let pipeline = 0, weighted = 0, commit = 0, best = 0;
    const opps = [];
    for (const o of rows.results || []) {
      const val = num(o.valor_estimado,0);
      const prob = num(o.probabilidade,0) / 100;
      pipeline += val;
      weighted += val * prob;
      if (prob >= 0.75) commit += val * prob;
      if (prob >= 0.4) best += val;
      opps.push({ id:o.id, codigo:o.codigo, titulo:o.titulo, valor:val, probabilidade:o.probabilidade, weighted:val*prob });
    }
    const id = uid('sfc');
    await c.env.DB.prepare(`
      INSERT OR REPLACE INTO sales_forecasts
      (id, org_id, periodo, owner_id, pipeline_total, weighted_total, commit_total, best_case_total, oportunidades_json, generated_by, generated_at)
      VALUES (COALESCE((SELECT id FROM sales_forecasts WHERE org_id=? AND periodo=? AND owner_id IS NULL), ?), ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?)
    `).bind(org.id, periodo, id, org.id, periodo, pipeline, weighted, commit, best, JSON.stringify(opps), user.id, nowIso()).run();
    return c.json({ ok:true, periodo, pipeline_total:pipeline, weighted_total:weighted, commit_total:commit, best_case_total:best, opportunities:opps });
  });

  app.get('/api/sales/forecasts', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`SELECT * FROM sales_forecasts WHERE org_id=? ORDER BY generated_at DESC LIMIT 100`).bind(org.id).all();
    return c.json({ ok:true, items: rs.results || [] });
  });

  app.post('/api/crm/opportunities/:id/convert-to-contract', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const id = c.req.param('id');
    const d = await body(c);
    const opp = await c.env.DB.prepare(`SELECT * FROM crm_opportunities WHERE org_id=? AND id=?`).bind(org.id, id).first();
    if (!opp) return c.json({ ok:false, error:'Oportunidade não encontrada' }, 404);
    const quote = d.quote_id ? await c.env.DB.prepare(`SELECT * FROM crm_quotes WHERE org_id=? AND id=?`).bind(org.id, d.quote_id).first() : null;
    if (quote && !['aprovada','aprovada_auto'].includes(quote.status)) return c.json({ ok:false, error:'Quote precisa estar aprovada antes de converter' }, 400);

    const conversionId = uid('conv');
    const contractPayload = {
      origem:'crm_opportunity',
      opportunity_id:id,
      quote_id:d.quote_id || null,
      proposal_id:d.proposal_id || quote?.proposal_id || null,
      account_id:opp.account_id,
      titulo:opp.titulo,
      valor: quote?.total || opp.valor_estimado,
      status:'pendente_criacao_contrato'
    };
    await c.env.DB.prepare(`
      INSERT INTO crm_contract_conversions
      (id, org_id, opportunity_id, quote_id, proposal_id, contract_id, status, payload_json, converted_by, converted_at)
      VALUES (?, ?, ?, ?, ?, ?, 'pendente', ?, ?, ?)
    `).bind(conversionId, org.id, id, d.quote_id || null, d.proposal_id || quote?.proposal_id || null, d.contract_id || null, JSON.stringify(contractPayload), user.id, nowIso()).run();

    const wonStage = await c.env.DB.prepare(`SELECT * FROM crm_pipeline_stages WHERE org_id=? AND tipo='won' ORDER BY ordem LIMIT 1`).bind(org.id).first();
    if (wonStage) {
      await c.env.DB.prepare(`UPDATE crm_opportunities SET stage_id=?, status='ganha', probabilidade=100, closed_at=?, won_reason=?, updated_at=CURRENT_TIMESTAMP WHERE org_id=? AND id=?`).bind(wonStage.id, nowIso(), 'Convertida para contrato', org.id, id).run();
    }
    return c.json({ ok:true, conversion_id:conversionId, payload:contractPayload }, 201);
  });
}

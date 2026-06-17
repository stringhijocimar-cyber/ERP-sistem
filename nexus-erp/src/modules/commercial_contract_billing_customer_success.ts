// src/modules/commercial_contract_billing_customer_success.ts
// NEXUS ERP — Etapa 25: Contrato Comercial, Assinatura, Billing e Customer Success
//
// Integração:
// import { registerContractBillingCsRoutes } from './modules/commercial_contract_billing_customer_success';
// registerContractBillingCsRoutes(app, { requireOrg, auditLog });
//
// Regra crítica:
// Billing real depende de gateway externo. Esta etapa prepara integração e permite registro manual.
// Não simula pagamento real sem confirmação/registro explícito.

import type { Hono } from 'hono';

type Ctx = any;
type Deps = {
  requireOrg: (c: Ctx) => Promise<{ user: any; org: any }>;
  auditLog?: (c: Ctx, input: any) => Promise<void>;
};

function uid(prefix: string) { return `${prefix}_${crypto.randomUUID()}`; }
function nowIso() { return new Date().toISOString(); }
function today() { return new Date().toISOString().slice(0,10); }
async function body(c: Ctx) { try { return await c.req.json(); } catch { return {}; } }
function json(v: any) { return typeof v === 'string' ? v : JSON.stringify(v ?? {}); }
function parseJson(v: any, fallback: any = {}) { try { return typeof v === 'string' ? JSON.parse(v) : (v ?? fallback); } catch { return fallback; } }
function num(v: any, fallback = 0) { const n = Number(v); return Number.isFinite(n) ? n : fallback; }

function addMonths(dateStr: string, months: number) {
  const d = dateStr ? new Date(dateStr) : new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0,10);
}

function calcHealth(input: any) {
  let score = 70;
  score += num(input.onboarding_progress, 0) * 0.15;
  score += num(input.nps_score, 0) * 2;
  score -= num(input.open_critical_tickets, 0) * 12;
  score -= num(input.overdue_invoices, 0) * 15;
  score -= num(input.days_without_touch, 0) > 30 ? 10 : 0;
  score = Math.max(0, Math.min(100, score));
  const churn = Math.max(0, Math.min(100, 100 - score));
  return { health_score: Number(score.toFixed(1)), churn_risk_score: Number(churn.toFixed(1)) };
}

export function registerContractBillingCsRoutes(app: Hono, deps: Deps) {
  const { requireOrg, auditLog } = deps;

  async function log(c: Ctx, action: string, entity: string, entityId: string, data?: any) {
    if (auditLog) await auditLog(c, { action, entity, entity_id: entityId, data });
  }

  app.get('/api/customer-lifecycle/dashboard', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const db = c.env.DB;
    const [contracts, subs, invoices, cs, tickets, renewals, expansions] = await Promise.all([
      db.prepare(`SELECT status, COUNT(*) qtd, COALESCE(SUM(valor_total_contrato),0) valor FROM commercial_contracts WHERE org_id=? GROUP BY status`).bind(org.id).all(),
      db.prepare(`SELECT status, COUNT(*) qtd, COALESCE(SUM(mrr),0) mrr FROM saas_customer_subscriptions WHERE org_id=? GROUP BY status`).bind(org.id).all(),
      db.prepare(`SELECT status, COUNT(*) qtd, COALESCE(SUM(total),0) valor FROM billing_invoices WHERE org_id=? GROUP BY status`).bind(org.id).all(),
      db.prepare(`SELECT etapa, COUNT(*) qtd, AVG(health_score) avg_health FROM customer_success_accounts WHERE org_id=? GROUP BY etapa`).bind(org.id).all(),
      db.prepare(`SELECT status, COUNT(*) qtd FROM customer_success_tickets WHERE org_id=? GROUP BY status`).bind(org.id).all(),
      db.prepare(`SELECT status, COUNT(*) qtd, COALESCE(SUM(valor_potencial),0) valor FROM renewal_opportunities WHERE org_id=? GROUP BY status`).bind(org.id).all(),
      db.prepare(`SELECT status, COUNT(*) qtd, COALESCE(SUM(valor_potencial),0) valor FROM expansion_opportunities WHERE org_id=? GROUP BY status`).bind(org.id).all()
    ]);
    return c.json({ ok:true, contracts: contracts.results || [], subscriptions: subs.results || [], invoices: invoices.results || [], customer_success: cs.results || [], tickets: tickets.results || [], renewals: renewals.results || [], expansions: expansions.results || [] });
  });

  app.post('/api/contracts/from-crm-conversion/:conversionId', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const conversionId = c.req.param('conversionId');
    const d = await body(c);
    const conv = await c.env.DB.prepare(`SELECT * FROM crm_contract_conversions WHERE org_id=? AND id=?`).bind(org.id, conversionId).first();
    if (!conv) return c.json({ ok:false, error:'Conversão não encontrada' }, 404);
    const payload = parseJson(conv.payload_json, {});
    const accountId = payload.account_id || d.account_id;
    if (!accountId) return c.json({ ok:false, error:'account_id ausente no payload' }, 400);

    const quote = conv.quote_id ? await c.env.DB.prepare(`SELECT * FROM crm_quotes WHERE org_id=? AND id=?`).bind(org.id, conv.quote_id).first() : null;
    const codigo = d.codigo || `CTR-${Date.now()}`;
    const start = d.data_inicio || today();
    const prazo = Number(d.prazo_meses || 12);
    const end = d.data_fim || addMonths(start, prazo);
    const monthly = num(d.valor_mensal, quote ? quote.total : payload.valor || 0);
    const setup = num(d.valor_implantacao, 0);
    const total = setup + monthly * prazo;
    const id = uid('ctr');

    await c.env.DB.prepare(`
      INSERT INTO commercial_contracts
      (id, org_id, account_id, opportunity_id, quote_id, proposal_id, codigo, titulo, status, tipo, data_inicio, data_fim, prazo_meses, moeda, valor_mensal, valor_implantacao, valor_total_contrato, reajuste_indice, renovacao_automatica, termos_json, sla_json, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ativo', 'saas', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, org.id, accountId, conv.opportunity_id || null, conv.quote_id || null, conv.proposal_id || null,
      codigo, d.titulo || payload.titulo || 'Contrato NEXUS ERP', start, end, prazo, d.moeda || 'BRL',
      monthly, setup, total, d.reajuste_indice || 'IPCA', d.renovacao_automatica ? 1 : 0,
      d.termos_json ? json(d.termos_json) : JSON.stringify(['Escopo conforme proposta/quote aprovada.', 'Billing sujeito a configuração de gateway ou faturamento manual.']),
      d.sla_json ? json(d.sla_json) : JSON.stringify(['Suporte em horário comercial salvo contrato específico.']),
      user.id
    ).run();

    await c.env.DB.prepare(`UPDATE crm_contract_conversions SET status='convertido', contract_id=?, converted_at=? WHERE org_id=? AND id=?`).bind(id, nowIso(), org.id, conversionId).run();

    await log(c, 'CREATE', 'commercial_contracts', id, { conversion_id: conversionId, total });
    return c.json({ ok:true, id, codigo, valor_total_contrato: total }, 201);
  });

  app.post('/api/contracts', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    if (!d.account_id || !d.titulo) return c.json({ ok:false, error:'account_id e titulo são obrigatórios' }, 400);
    const codigo = d.codigo || `CTR-${Date.now()}`;
    const start = d.data_inicio || today();
    const prazo = Number(d.prazo_meses || 12);
    const end = d.data_fim || addMonths(start, prazo);
    const monthly = num(d.valor_mensal, 0);
    const setup = num(d.valor_implantacao, 0);
    const total = setup + monthly * prazo;
    const id = uid('ctr');
    await c.env.DB.prepare(`
      INSERT INTO commercial_contracts
      (id, org_id, account_id, opportunity_id, quote_id, proposal_id, codigo, titulo, status, tipo, data_inicio, data_fim, prazo_meses, moeda, valor_mensal, valor_implantacao, valor_total_contrato, reajuste_indice, renovacao_automatica, termos_json, sla_json, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, org.id, d.account_id, d.opportunity_id || null, d.quote_id || null, d.proposal_id || null, codigo, d.titulo, d.status || 'rascunho', d.tipo || 'saas', start, end, prazo, d.moeda || 'BRL', monthly, setup, total, d.reajuste_indice || 'IPCA', d.renovacao_automatica ? 1 : 0, d.termos_json ? json(d.termos_json) : '[]', d.sla_json ? json(d.sla_json) : '[]', user.id).run();
    return c.json({ ok:true, id, codigo, valor_total_contrato: total }, 201);
  });

  app.get('/api/contracts', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`
      SELECT ctr.*, acc.razao_social AS account_name
      FROM commercial_contracts ctr
      JOIN crm_accounts acc ON acc.id=ctr.account_id
      WHERE ctr.org_id=?
      ORDER BY ctr.created_at DESC
    `).bind(org.id).all();
    return c.json({ ok:true, items: rs.results || [] });
  });

  app.post('/api/contracts/:id/sign', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const id = c.req.param('id');
    const d = await body(c);
    await c.env.DB.prepare(`
      UPDATE commercial_contracts SET assinatura_status='assinado', status='ativo', signed_by_customer=?, signed_at=?, approved_by=?, approved_at=?, updated_at=CURRENT_TIMESTAMP
      WHERE org_id=? AND id=?
    `).bind(d.signed_by_customer || 'Cliente', nowIso(), user.id, nowIso(), org.id, id).run();
    return c.json({ ok:true, id, assinatura_status:'assinado' });
  });

  app.post('/api/billing/gateways', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    if (!d.codigo || !d.nome) return c.json({ ok:false, error:'codigo e nome são obrigatórios' }, 400);
    const id = uid('bgw');
    await c.env.DB.prepare(`
      INSERT INTO billing_gateways
      (id, org_id, codigo, nome, provider, status, credentials_ref, config_json, sandbox, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, org.id, d.codigo, d.nome, d.provider || 'manual', d.status || 'configurado', d.credentials_ref || null, d.config_json ? json(d.config_json) : '{}', d.sandbox === false ? 0 : 1, user.id).run();
    return c.json({ ok:true, id }, 201);
  });

  app.get('/api/billing/gateways', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`SELECT * FROM billing_gateways WHERE org_id=? ORDER BY created_at DESC`).bind(org.id).all();
    return c.json({ ok:true, items: rs.results || [] });
  });

  app.post('/api/subscriptions/from-contract/:contractId', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const contractId = c.req.param('contractId');
    const d = await body(c);
    const ctr = await c.env.DB.prepare(`SELECT * FROM commercial_contracts WHERE org_id=? AND id=?`).bind(org.id, contractId).first();
    if (!ctr) return c.json({ ok:false, error:'Contrato não encontrado' }, 404);
    const start = d.start_date || ctr.data_inicio || today();
    const id = uid('sub');
    const mrr = num(d.mrr, ctr.valor_mensal);
    await c.env.DB.prepare(`
      INSERT INTO saas_customer_subscriptions
      (id, org_id, account_id, contract_id, plano_codigo, status, billing_cycle, start_date, current_period_start, current_period_end, trial_end, mrr, arr, users_included, modules_json, external_subscription_id, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, org.id, ctr.account_id, contractId, d.plano_codigo || 'enterprise', d.status || 'ativo', d.billing_cycle || 'monthly', start, start, addMonths(start, 1), d.trial_end || null, mrr, mrr * 12, d.users_included || 5, d.modules_json ? json(d.modules_json) : '[]', d.external_subscription_id || null, user.id).run();
    return c.json({ ok:true, id, mrr, arr:mrr*12 }, 201);
  });

  app.get('/api/subscriptions', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`
      SELECT s.*, a.razao_social AS account_name
      FROM saas_customer_subscriptions s
      JOIN crm_accounts a ON a.id=s.account_id
      WHERE s.org_id=?
      ORDER BY s.created_at DESC
    `).bind(org.id).all();
    return c.json({ ok:true, items: rs.results || [] });
  });

  app.post('/api/billing/customers', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const d = await body(c);
    if (!d.account_id || !d.billing_name) return c.json({ ok:false, error:'account_id e billing_name são obrigatórios' }, 400);
    const id = uid('bcust');
    await c.env.DB.prepare(`
      INSERT OR REPLACE INTO billing_customers
      (id, org_id, account_id, gateway_id, external_customer_id, billing_name, billing_email, document_number, address_json, status, updated_at)
      VALUES (COALESCE((SELECT id FROM billing_customers WHERE org_id=? AND account_id=?), ?), ?, ?, ?, ?, ?, ?, ?, ?, 'ativo', CURRENT_TIMESTAMP)
    `).bind(org.id, d.account_id, id, org.id, d.account_id, d.gateway_id || null, d.external_customer_id || null, d.billing_name, d.billing_email || null, d.document_number || null, d.address_json ? json(d.address_json) : null).run();
    return c.json({ ok:true, id });
  });

  app.post('/api/billing/invoices/from-subscription/:subscriptionId', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const subscriptionId = c.req.param('subscriptionId');
    const d = await body(c);
    const sub = await c.env.DB.prepare(`SELECT * FROM saas_customer_subscriptions WHERE org_id=? AND id=?`).bind(org.id, subscriptionId).first();
    if (!sub) return c.json({ ok:false, error:'Assinatura não encontrada' }, 404);
    let cust = await c.env.DB.prepare(`SELECT * FROM billing_customers WHERE org_id=? AND account_id=?`).bind(org.id, sub.account_id).first();
    if (!cust) {
      const acc = await c.env.DB.prepare(`SELECT * FROM crm_accounts WHERE org_id=? AND id=?`).bind(org.id, sub.account_id).first();
      const custId = uid('bcust');
      await c.env.DB.prepare(`
        INSERT INTO billing_customers
        (id, org_id, account_id, billing_name, status)
        VALUES (?, ?, ?, ?, 'ativo')
      `).bind(custId, org.id, sub.account_id, acc?.razao_social || 'Cliente').run();
      cust = await c.env.DB.prepare(`SELECT * FROM billing_customers WHERE org_id=? AND id=?`).bind(org.id, custId).first();
    }

    const subtotal = num(d.subtotal, sub.mrr);
    const taxes = num(d.taxes, 0);
    const discount = num(d.discount, 0);
    const total = subtotal + taxes - discount;
    const id = uid('inv');
    const numero = d.numero || `INV-${Date.now()}`;
    await c.env.DB.prepare(`
      INSERT INTO billing_invoices
      (id, org_id, subscription_id, contract_id, billing_customer_id, gateway_id, numero, status, competencia, issue_date, due_date, moeda, subtotal, taxes, discount, total, metadata_json, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'emitida', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, org.id, subscriptionId, sub.contract_id || null, cust.id, d.gateway_id || cust.gateway_id || null, numero, d.competencia || today().slice(0,7), d.issue_date || today(), d.due_date || addMonths(today(), 1), d.moeda || 'BRL', subtotal, taxes, discount, total, d.metadata_json ? json(d.metadata_json) : null, user.id).run();

    await c.env.DB.prepare(`
      INSERT INTO billing_invoice_items
      (id, org_id, invoice_id, descricao, quantidade, preco_unitario, total, tipo)
      VALUES (?, ?, ?, ?, 1, ?, ?, 'recorrente')
    `).bind(uid('invitem'), org.id, id, d.descricao || `Assinatura ${sub.plano_codigo}`, subtotal, subtotal).run();

    return c.json({ ok:true, id, numero, total }, 201);
  });

  app.get('/api/billing/invoices', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`SELECT * FROM billing_invoices WHERE org_id=? ORDER BY created_at DESC`).bind(org.id).all();
    return c.json({ ok:true, items: rs.results || [] });
  });

  app.post('/api/billing/invoices/:id/register-payment', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const id = c.req.param('id');
    const d = await body(c);
    const inv = await c.env.DB.prepare(`SELECT * FROM billing_invoices WHERE org_id=? AND id=?`).bind(org.id, id).first();
    if (!inv) return c.json({ ok:false, error:'Fatura não encontrada' }, 404);
    const payId = uid('pay');
    await c.env.DB.prepare(`
      INSERT INTO billing_payments
      (id, org_id, invoice_id, gateway_id, status, metodo, valor, paid_at, external_payment_id, comprovante_url, metadata_json, created_by)
      VALUES (?, ?, ?, ?, 'pago', ?, ?, ?, ?, ?, ?, ?)
    `).bind(payId, org.id, id, d.gateway_id || inv.gateway_id || null, d.metodo || 'manual', num(d.valor, inv.total), d.paid_at || nowIso(), d.external_payment_id || null, d.comprovante_url || null, d.metadata_json ? json(d.metadata_json) : null, user.id).run();
    await c.env.DB.prepare(`UPDATE billing_invoices SET status='paga', paid_at=?, updated_at=CURRENT_TIMESTAMP WHERE org_id=? AND id=?`).bind(d.paid_at || nowIso(), org.id, id).run();
    return c.json({ ok:true, payment_id: payId, invoice_status:'paga' });
  });

  app.post('/api/post-sale/handovers', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    if (!d.account_id) return c.json({ ok:false, error:'account_id é obrigatório' }, 400);
    const id = uid('handover');
    await c.env.DB.prepare(`
      INSERT INTO post_sale_handovers
      (id, org_id, account_id, opportunity_id, contract_id, status, comercial_owner_id, implementation_owner_id, cs_owner_id, resumo_contexto, escopo_vendido_json, riscos_json, compromissos_json, proximos_passos_json, created_by)
      VALUES (?, ?, ?, ?, ?, 'pendente', ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, org.id, d.account_id, d.opportunity_id || null, d.contract_id || null, d.comercial_owner_id || user.id, d.implementation_owner_id || null, d.cs_owner_id || null, d.resumo_contexto || null, d.escopo_vendido_json ? json(d.escopo_vendido_json) : '[]', d.riscos_json ? json(d.riscos_json) : '[]', d.compromissos_json ? json(d.compromissos_json) : '[]', d.proximos_passos_json ? json(d.proximos_passos_json) : '[]', user.id).run();
    return c.json({ ok:true, id }, 201);
  });

  app.post('/api/post-sale/handovers/:id/complete', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const id = c.req.param('id');
    await c.env.DB.prepare(`UPDATE post_sale_handovers SET status='concluido', handover_at=?, updated_at=CURRENT_TIMESTAMP WHERE org_id=? AND id=?`).bind(nowIso(), org.id, id).run();
    return c.json({ ok:true, id, status:'concluido' });
  });

  app.post('/api/customer-success/accounts/from-subscription/:subscriptionId', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const subscriptionId = c.req.param('subscriptionId');
    const sub = await c.env.DB.prepare(`SELECT * FROM saas_customer_subscriptions WHERE org_id=? AND id=?`).bind(org.id, subscriptionId).first();
    if (!sub) return c.json({ ok:false, error:'Assinatura não encontrada' }, 404);
    const id = uid('csacc');
    await c.env.DB.prepare(`
      INSERT OR REPLACE INTO customer_success_accounts
      (id, org_id, account_id, subscription_id, contract_id, cs_owner_id, status, etapa, health_score, churn_risk_score, success_plan_json, goals_json, risks_json, updated_at)
      VALUES (COALESCE((SELECT id FROM customer_success_accounts WHERE org_id=? AND account_id=?), ?), ?, ?, ?, ?, ?, 'ativo', 'onboarding', 70, 30, '{}', '[]', '[]', CURRENT_TIMESTAMP)
    `).bind(org.id, sub.account_id, id, org.id, sub.account_id, subscriptionId, sub.contract_id || null, user.id).run();
    return c.json({ ok:true, id });
  });

  app.get('/api/customer-success/accounts', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`
      SELECT cs.*, a.razao_social AS account_name
      FROM customer_success_accounts cs
      JOIN crm_accounts a ON a.id=cs.account_id
      WHERE cs.org_id=?
      ORDER BY cs.health_score ASC
    `).bind(org.id).all();
    return c.json({ ok:true, items: rs.results || [] });
  });

  app.post('/api/customer-success/accounts/:id/recalculate-health', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const id = c.req.param('id');
    const cs = await c.env.DB.prepare(`SELECT * FROM customer_success_accounts WHERE org_id=? AND id=?`).bind(org.id, id).first();
    if (!cs) return c.json({ ok:false, error:'CS account não encontrada' }, 404);
    const proj = await c.env.DB.prepare(`SELECT AVG(progresso_percentual) progress FROM customer_onboarding_projects WHERE org_id=? AND cs_account_id=?`).bind(org.id, id).first();
    const crit = await c.env.DB.prepare(`SELECT COUNT(*) qtd FROM customer_success_tickets WHERE org_id=? AND cs_account_id=? AND status <> 'resolvido' AND severidade IN ('alta','critica','crítica')`).bind(org.id, id).first();
    const overdue = await c.env.DB.prepare(`
      SELECT COUNT(*) qtd FROM billing_invoices inv
      JOIN saas_customer_subscriptions sub ON sub.id=inv.subscription_id
      WHERE inv.org_id=? AND sub.account_id=? AND inv.status NOT IN ('paga','cancelada') AND date(inv.due_date) < date('now')
    `).bind(org.id, cs.account_id).first();
    const input = {
      onboarding_progress: num(proj?.progress, 0),
      nps_score: num(cs.nps_score, 0),
      open_critical_tickets: num(crit?.qtd, 0),
      overdue_invoices: num(overdue?.qtd, 0),
      days_without_touch: cs.last_touch_at ? Math.floor((Date.now() - new Date(cs.last_touch_at).getTime()) / 86400000) : 999
    };
    const score = calcHealth(input);
    await c.env.DB.prepare(`UPDATE customer_success_accounts SET health_score=?, churn_risk_score=?, risks_json=?, updated_at=CURRENT_TIMESTAMP WHERE org_id=? AND id=?`).bind(score.health_score, score.churn_risk_score, JSON.stringify([{ tipo:'health_calc', input }]), org.id, id).run();
    await c.env.DB.prepare(`
      INSERT INTO customer_health_events
      (id, org_id, cs_account_id, tipo, impacto_score, descricao, metadata_json, created_by)
      VALUES (?, ?, ?, 'health_recalc', ?, ?, ?, ?)
    `).bind(uid('hevt'), org.id, id, score.health_score, `Health recalculado para ${score.health_score}.`, JSON.stringify(input), user.id).run();
    return c.json({ ok:true, ...score, input });
  });

  app.post('/api/customer-success/onboarding-projects', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    if (!d.cs_account_id) return c.json({ ok:false, error:'cs_account_id é obrigatório' }, 400);
    const id = uid('csonb');
    await c.env.DB.prepare(`
      INSERT INTO customer_onboarding_projects
      (id, org_id, cs_account_id, contract_id, nome, status, progresso_percentual, kickoff_date, target_golive_date, created_by)
      VALUES (?, ?, ?, ?, ?, 'em_andamento', 0, ?, ?, ?)
    `).bind(id, org.id, d.cs_account_id, d.contract_id || null, d.nome || 'Onboarding Cliente', d.kickoff_date || today(), d.target_golive_date || addMonths(today(), 1), user.id).run();

    const tasks = d.tasks_json || ['Kickoff', 'Validar escopo contratado', 'Configurar ambiente', 'Importar dados iniciais', 'Treinar usuários-chave', 'Go-live assistido'];
    let order = 1;
    for (const t of tasks) {
      await c.env.DB.prepare(`
        INSERT INTO customer_onboarding_tasks
        (id, org_id, onboarding_project_id, ordem, titulo, descricao, etapa, status, obrigatoria, owner_id)
        VALUES (?, ?, ?, ?, ?, ?, 'implantacao', 'pendente', 1, ?)
      `).bind(uid('cstask'), org.id, id, order++, String(t), `Tarefa de onboarding: ${t}`, user.id).run();
    }
    return c.json({ ok:true, id, tasks: tasks.length }, 201);
  });

  app.get('/api/customer-success/onboarding-projects', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`SELECT * FROM customer_onboarding_projects WHERE org_id=? ORDER BY created_at DESC`).bind(org.id).all();
    return c.json({ ok:true, items: rs.results || [] });
  });

  app.get('/api/customer-success/onboarding-projects/:id/tasks', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const id = c.req.param('id');
    const rs = await c.env.DB.prepare(`SELECT * FROM customer_onboarding_tasks WHERE org_id=? AND onboarding_project_id=? ORDER BY ordem`).bind(org.id, id).all();
    return c.json({ ok:true, items: rs.results || [] });
  });

  app.post('/api/customer-success/onboarding-tasks/:id/complete', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const id = c.req.param('id');
    const task = await c.env.DB.prepare(`SELECT * FROM customer_onboarding_tasks WHERE org_id=? AND id=?`).bind(org.id, id).first();
    if (!task) return c.json({ ok:false, error:'Tarefa não encontrada' }, 404);
    await c.env.DB.prepare(`UPDATE customer_onboarding_tasks SET status='concluida', completed_by=?, completed_at=?, updated_at=CURRENT_TIMESTAMP WHERE org_id=? AND id=?`).bind(user.id, nowIso(), org.id, id).run();
    const counts = await c.env.DB.prepare(`SELECT COUNT(*) total, SUM(CASE WHEN status='concluida' THEN 1 ELSE 0 END) done FROM customer_onboarding_tasks WHERE org_id=? AND onboarding_project_id=?`).bind(org.id, task.onboarding_project_id).first();
    const progress = counts?.total ? (num(counts.done,0) / num(counts.total,1)) * 100 : 0;
    await c.env.DB.prepare(`UPDATE customer_onboarding_projects SET progresso_percentual=?, status=?, actual_golive_date=?, updated_at=CURRENT_TIMESTAMP WHERE org_id=? AND id=?`).bind(progress, progress >= 100 ? 'concluido' : 'em_andamento', progress >= 100 ? today() : null, org.id, task.onboarding_project_id).run();
    return c.json({ ok:true, progress });
  });

  app.post('/api/customer-success/tickets', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    if (!d.titulo) return c.json({ ok:false, error:'titulo é obrigatório' }, 400);
    const id = uid('csticket');
    await c.env.DB.prepare(`
      INSERT INTO customer_success_tickets
      (id, org_id, cs_account_id, account_id, titulo, descricao, tipo, severidade, status, prioridade, sla_due_at, assigned_to, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'aberto', ?, ?, ?, ?)
    `).bind(id, org.id, d.cs_account_id || null, d.account_id || null, d.titulo, d.descricao || null, d.tipo || 'suporte', d.severidade || 'media', d.prioridade || 'media', d.sla_due_at || null, d.assigned_to || user.id, user.id).run();
    return c.json({ ok:true, id }, 201);
  });

  app.get('/api/customer-success/tickets', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`SELECT * FROM customer_success_tickets WHERE org_id=? ORDER BY created_at DESC`).bind(org.id).all();
    return c.json({ ok:true, items: rs.results || [] });
  });

  app.post('/api/customer-success/tickets/:id/resolve', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const id = c.req.param('id');
    await c.env.DB.prepare(`UPDATE customer_success_tickets SET status='resolvido', resolved_by=?, resolved_at=?, updated_at=CURRENT_TIMESTAMP WHERE org_id=? AND id=?`).bind(user.id, nowIso(), org.id, id).run();
    return c.json({ ok:true, id, status:'resolvido' });
  });

  app.post('/api/customer-success/renewals/generate', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    const days = Number(d.days_ahead || 90);
    const contracts = await c.env.DB.prepare(`
      SELECT ctr.*, sub.id AS sub_id, sub.mrr
      FROM commercial_contracts ctr
      LEFT JOIN saas_customer_subscriptions sub ON sub.contract_id=ctr.id
      WHERE ctr.org_id=? AND ctr.status='ativo' AND date(ctr.data_fim) <= date('now', ?)
    `).bind(org.id, `+${days} day`).all();
    let created = 0;
    for (const ctr of contracts.results || []) {
      const exists = await c.env.DB.prepare(`SELECT id FROM renewal_opportunities WHERE org_id=? AND contract_id=? AND status='aberta'`).bind(org.id, ctr.id).first();
      if (exists) continue;
      await c.env.DB.prepare(`
        INSERT INTO renewal_opportunities
        (id, org_id, account_id, subscription_id, contract_id, tipo, status, current_mrr, target_mrr, valor_potencial, renewal_date, probabilidade, recomendacao, created_by)
        VALUES (?, ?, ?, ?, ?, 'renovacao', 'aberta', ?, ?, ?, ?, 60, ?, ?)
      `).bind(uid('ren'), org.id, ctr.account_id, ctr.sub_id || null, ctr.id, num(ctr.mrr, ctr.valor_mensal), num(ctr.mrr, ctr.valor_mensal), num(ctr.valor_mensal,0)*12, ctr.data_fim, 'Iniciar conversa de renovação com 90 dias de antecedência.', user.id).run();
      created++;
    }
    return c.json({ ok:true, created });
  });

  app.get('/api/customer-success/renewals', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`SELECT * FROM renewal_opportunities WHERE org_id=? ORDER BY renewal_date ASC`).bind(org.id).all();
    return c.json({ ok:true, items: rs.results || [] });
  });

  app.post('/api/customer-success/expansions', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    if (!d.account_id || !d.titulo) return c.json({ ok:false, error:'account_id e titulo são obrigatórios' }, 400);
    const id = uid('exp');
    await c.env.DB.prepare(`
      INSERT INTO expansion_opportunities
      (id, org_id, account_id, cs_account_id, tipo, status, titulo, descricao, current_mrr, expansion_mrr, valor_potencial, probabilidade, gatilho, owner_id, created_by)
      VALUES (?, ?, ?, ?, ?, 'aberta', ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, org.id, d.account_id, d.cs_account_id || null, d.tipo || 'upsell', d.titulo, d.descricao || null, num(d.current_mrr,0), num(d.expansion_mrr,0), num(d.valor_potencial, num(d.expansion_mrr,0)*12), num(d.probabilidade,40), d.gatilho || null, d.owner_id || user.id, user.id).run();
    return c.json({ ok:true, id }, 201);
  });

  app.get('/api/customer-success/expansions', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`SELECT * FROM expansion_opportunities WHERE org_id=? ORDER BY created_at DESC`).bind(org.id).all();
    return c.json({ ok:true, items: rs.results || [] });
  });
}

// src/modules/customer_portal_self_service_deliveries.ts
// NEXUS ERP — Etapa 26: Portal do Cliente, Autoatendimento, Tickets, Base de Conhecimento e Gestão de Entregas
//
// Integração:
// import { registerCustomerPortalRoutes } from './modules/customer_portal_self_service_deliveries';
// registerCustomerPortalRoutes(app, { requireOrg, auditLog });
//
// Observação:
// Esta etapa cria portal e APIs internas/externas simplificadas. Autenticação externa
// está preparada por token de convite/sessão, mas deve ser endurecida em produção.

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

async function sha256Hex(input: string) {
  const data = new TextEncoder().encode(input || '');
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function addDays(dateStr: string, days: number) {
  const d = dateStr ? new Date(dateStr) : new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0,10);
}

async function auditPortal(db: any, orgId: string, input: any) {
  await db.prepare(`
    INSERT INTO portal_audit_events
    (id, org_id, portal_customer_id, portal_user_id, action, entity_type, entity_id, ip_address, metadata_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(uid('paudit'), orgId, input.portal_customer_id || null, input.portal_user_id || null, input.action, input.entity_type || null, input.entity_id || null, input.ip_address || null, input.metadata_json ? json(input.metadata_json) : null).run();
}

async function requirePortalSession(c: Ctx) {
  const token = c.req.header('X-Portal-Token') || c.req.query('portal_token');
  if (!token) return null;
  const tokenHash = await sha256Hex(token);
  const row = await c.env.DB.prepare(`
    SELECT s.*, u.portal_customer_id, u.nome, u.email, u.role, u.status AS user_status, pc.account_id
    FROM portal_sessions s
    JOIN portal_users u ON u.id=s.portal_user_id
    JOIN portal_customers pc ON pc.id=u.portal_customer_id
    WHERE s.token_hash=? AND s.revoked_at IS NULL AND datetime(s.expires_at) > datetime('now') AND u.status='ativo'
  `).bind(tokenHash).first();
  return row || null;
}

async function hasPortalPermission(db: any, orgId: string, role: string, recurso: string, permissao = 'read') {
  const row = await db.prepare(`
    SELECT id FROM portal_permissions
    WHERE org_id=? AND role=? AND recurso=? AND permissao=?
  `).bind(orgId, role, recurso, permissao).first();
  return Boolean(row) || role === 'admin';
}

export function registerCustomerPortalRoutes(app: Hono, deps: Deps) {
  const { requireOrg, auditLog } = deps;

  async function log(c: Ctx, action: string, entity: string, entityId: string, data?: any) {
    if (auditLog) await auditLog(c, { action, entity, entity_id: entityId, data });
  }

  app.post('/api/portal/seed-defaults', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const roles = ['admin','manager','viewer','finance','support'];
    const perms = [
      ['contracts','read'],['invoices','read'],['tickets','read'],['tickets','write'],
      ['documents','read'],['knowledge','read'],['deliveries','read'],
      ['change_requests','read'],['change_requests','write'],['approvals','read'],['approvals','decide'],
      ['nps','write']
    ];
    let created = 0;
    for (const role of roles) {
      for (const [res, perm] of perms) {
        if (role === 'viewer' && ['write','decide'].includes(perm)) continue;
        if (role === 'finance' && !['invoices','contracts','documents','knowledge','nps'].includes(res)) continue;
        if (role === 'support' && !['tickets','knowledge','documents','deliveries','nps'].includes(res)) continue;
        await c.env.DB.prepare(`
          INSERT OR IGNORE INTO portal_permissions
          (id, org_id, role, recurso, permissao)
          VALUES (?, ?, ?, ?, ?)
        `).bind(uid('pperm'), org.id, role, res, perm).run();
        created++;
      }
    }

    const articles = [
      { titulo:'Como abrir um ticket', categoria:'suporte', conteudo:'Acesse o portal, vá em Tickets, descreva o problema, informe prioridade e envie a solicitação.' },
      { titulo:'Como acompanhar onboarding', categoria:'implantacao', conteudo:'Acompanhe entregas, milestones, tarefas concluídas e aprovações pendentes no painel de implantação.' },
      { titulo:'Como consultar faturas', categoria:'financeiro', conteudo:'Usuários com perfil financeiro podem consultar faturas, vencimentos, status e comprovantes.' }
    ];
    for (const a of articles) {
      await c.env.DB.prepare(`
        INSERT INTO portal_knowledge_articles
        (id, org_id, titulo, categoria, resumo, conteudo, tags_json, status, visible_to_customer)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'publicado', 1)
      `).bind(uid('kart'), org.id, a.titulo, a.categoria, a.conteudo.slice(0,100), a.conteudo, JSON.stringify([a.categoria])).run();
    }

    return c.json({ ok:true, permissions: created, articles: articles.length });
  });

  app.get('/api/portal/admin/dashboard', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const db = c.env.DB;
    const [customers, users, docs, articles, deliveries, changes, approvals, nps] = await Promise.all([
      db.prepare(`SELECT status, COUNT(*) qtd FROM portal_customers WHERE org_id=? GROUP BY status`).bind(org.id).all(),
      db.prepare(`SELECT status, COUNT(*) qtd FROM portal_users WHERE org_id=? GROUP BY status`).bind(org.id).all(),
      db.prepare(`SELECT status, COUNT(*) qtd FROM portal_shared_documents WHERE org_id=? GROUP BY status`).bind(org.id).all(),
      db.prepare(`SELECT status, COUNT(*) qtd FROM portal_knowledge_articles WHERE org_id=? GROUP BY status`).bind(org.id).all(),
      db.prepare(`SELECT status, COUNT(*) qtd FROM customer_deliveries WHERE org_id=? GROUP BY status`).bind(org.id).all(),
      db.prepare(`SELECT status, COUNT(*) qtd FROM customer_change_requests WHERE org_id=? GROUP BY status`).bind(org.id).all(),
      db.prepare(`SELECT status, COUNT(*) qtd FROM customer_approvals WHERE org_id=? GROUP BY status`).bind(org.id).all(),
      db.prepare(`SELECT COUNT(*) qtd, AVG(score) avg_score FROM portal_nps_responses WHERE org_id=?`).bind(org.id).first()
    ]);
    return c.json({ ok:true, customers: customers.results || [], users: users.results || [], documents: docs.results || [], articles: articles.results || [], deliveries: deliveries.results || [], change_requests: changes.results || [], approvals: approvals.results || [], nps: nps || { qtd:0, avg_score:null } });
  });

  app.post('/api/portal/customers', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    if (!d.account_id || !d.portal_name) return c.json({ ok:false, error:'account_id e portal_name são obrigatórios' }, 400);
    const id = uid('pcust');
    await c.env.DB.prepare(`
      INSERT OR REPLACE INTO portal_customers
      (id, org_id, account_id, portal_name, status, branding_json, allowed_domains_json, settings_json, created_by, updated_at)
      VALUES (COALESCE((SELECT id FROM portal_customers WHERE org_id=? AND account_id=?), ?), ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(org.id, d.account_id, id, org.id, d.account_id, d.portal_name, d.status || 'ativo', d.branding_json ? json(d.branding_json) : '{}', d.allowed_domains_json ? json(d.allowed_domains_json) : '[]', d.settings_json ? json(d.settings_json) : '{}', user.id).run();
    await log(c, 'UPSERT', 'portal_customers', id, d);
    return c.json({ ok:true, id });
  });

  app.get('/api/portal/customers', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`
      SELECT pc.*, acc.razao_social AS account_name
      FROM portal_customers pc
      JOIN crm_accounts acc ON acc.id=pc.account_id
      WHERE pc.org_id=?
      ORDER BY pc.created_at DESC
    `).bind(org.id).all();
    return c.json({ ok:true, items: rs.results || [] });
  });

  app.post('/api/portal/users/invite', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    if (!d.portal_customer_id || !d.nome || !d.email) return c.json({ ok:false, error:'portal_customer_id, nome e email são obrigatórios' }, 400);
    const invite = crypto.randomUUID() + '-' + crypto.randomUUID();
    const id = uid('puser');
    await c.env.DB.prepare(`
      INSERT INTO portal_users
      (id, org_id, portal_customer_id, contact_id, nome, email, role, status, invite_token, invite_expires_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'invited', ?, ?, ?)
    `).bind(id, org.id, d.portal_customer_id, d.contact_id || null, d.nome, d.email, d.role || 'viewer', invite, addDays(today(), 7), user.id).run();
    return c.json({ ok:true, id, invite_token: invite, invite_expires_at: addDays(today(), 7) }, 201);
  });

  app.post('/api/portal/auth/accept-invite', async (c: Ctx) => {
    const d = await body(c);
    if (!d.invite_token) return c.json({ ok:false, error:'invite_token é obrigatório' }, 400);
    const puser = await c.env.DB.prepare(`SELECT * FROM portal_users WHERE invite_token=? AND datetime(invite_expires_at) >= datetime('now')`).bind(d.invite_token).first();
    if (!puser) return c.json({ ok:false, error:'Convite inválido ou expirado' }, 400);
    const sessionToken = crypto.randomUUID() + '-' + crypto.randomUUID();
    const tokenHash = await sha256Hex(sessionToken);
    const sessionId = uid('psess');
    await c.env.DB.prepare(`UPDATE portal_users SET status='ativo', last_login_at=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(nowIso(), puser.id).run();
    await c.env.DB.prepare(`
      INSERT INTO portal_sessions
      (id, org_id, portal_user_id, token_hash, ip_address, user_agent, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(sessionId, puser.org_id, puser.id, tokenHash, c.req.header('CF-Connecting-IP') || null, c.req.header('User-Agent') || null, addDays(today(), 30)).run();
    await auditPortal(c.env.DB, puser.org_id, { portal_customer_id:puser.portal_customer_id, portal_user_id:puser.id, action:'accept_invite', entity_type:'portal_user', entity_id:puser.id });
    return c.json({ ok:true, portal_token: sessionToken, expires_at: addDays(today(), 30) });
  });

  app.get('/api/portal/me', async (c: Ctx) => {
    const sess = await requirePortalSession(c);
    if (!sess) return c.json({ ok:false, error:'Sessão inválida' }, 401);
    return c.json({ ok:true, user: { id:sess.portal_user_id, nome:sess.nome, email:sess.email, role:sess.role, portal_customer_id:sess.portal_customer_id, account_id:sess.account_id } });
  });

  app.post('/api/portal/documents', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    if (!d.portal_customer_id || !d.titulo) return c.json({ ok:false, error:'portal_customer_id e titulo são obrigatórios' }, 400);
    const id = uid('pdoc');
    await c.env.DB.prepare(`
      INSERT INTO portal_shared_documents
      (id, org_id, portal_customer_id, titulo, descricao, documento_tipo, entidade_tipo, entidade_id, arquivo_url, conteudo_texto, classificacao, status, visible_from, visible_until, uploaded_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, org.id, d.portal_customer_id, d.titulo, d.descricao || null, d.documento_tipo || 'arquivo', d.entidade_tipo || null, d.entidade_id || null, d.arquivo_url || null, d.conteudo_texto || null, d.classificacao || 'cliente', d.status || 'publicado', d.visible_from || null, d.visible_until || null, user.id).run();
    return c.json({ ok:true, id }, 201);
  });

  app.get('/api/portal/external/documents', async (c: Ctx) => {
    const sess = await requirePortalSession(c);
    if (!sess) return c.json({ ok:false, error:'Sessão inválida' }, 401);
    if (!(await hasPortalPermission(c.env.DB, sess.org_id, sess.role, 'documents', 'read'))) return c.json({ ok:false, error:'Sem permissão' }, 403);
    const rs = await c.env.DB.prepare(`
      SELECT * FROM portal_shared_documents
      WHERE org_id=? AND portal_customer_id=? AND status='publicado'
      AND (visible_from IS NULL OR date(visible_from) <= date('now'))
      AND (visible_until IS NULL OR date(visible_until) >= date('now'))
      ORDER BY created_at DESC
    `).bind(sess.org_id, sess.portal_customer_id).all();
    await auditPortal(c.env.DB, sess.org_id, { portal_customer_id:sess.portal_customer_id, portal_user_id:sess.portal_user_id, action:'list_documents' });
    return c.json({ ok:true, items: rs.results || [] });
  });

  app.post('/api/portal/knowledge/articles', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    if (!d.titulo || !d.conteudo) return c.json({ ok:false, error:'titulo e conteudo são obrigatórios' }, 400);
    const id = uid('kart');
    await c.env.DB.prepare(`
      INSERT INTO portal_knowledge_articles
      (id, org_id, titulo, categoria, resumo, conteudo, tags_json, segmento_codigo, status, visible_to_customer, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, org.id, d.titulo, d.categoria || 'geral', d.resumo || String(d.conteudo).slice(0,160), d.conteudo, d.tags_json ? json(d.tags_json) : '[]', d.segmento_codigo || null, d.status || 'publicado', d.visible_to_customer === false ? 0 : 1, user.id).run();
    return c.json({ ok:true, id }, 201);
  });

  app.get('/api/portal/external/knowledge', async (c: Ctx) => {
    const sess = await requirePortalSession(c);
    if (!sess) return c.json({ ok:false, error:'Sessão inválida' }, 401);
    if (!(await hasPortalPermission(c.env.DB, sess.org_id, sess.role, 'knowledge', 'read'))) return c.json({ ok:false, error:'Sem permissão' }, 403);
    const q = c.req.query('q');
    let sql = `SELECT * FROM portal_knowledge_articles WHERE org_id=? AND status='publicado' AND visible_to_customer=1`;
    const args: any[] = [sess.org_id];
    if (q) { sql += ` AND (titulo LIKE ? OR conteudo LIKE ? OR categoria LIKE ?)`; args.push(`%${q}%`,`%${q}%`,`%${q}%`); }
    sql += ` ORDER BY updated_at DESC LIMIT 100`;
    const rs = await c.env.DB.prepare(sql).bind(...args).all();
    return c.json({ ok:true, items: rs.results || [] });
  });

  app.post('/api/portal/external/knowledge/:id/feedback', async (c: Ctx) => {
    const sess = await requirePortalSession(c);
    if (!sess) return c.json({ ok:false, error:'Sessão inválida' }, 401);
    const d = await body(c);
    const id = uid('kfb');
    await c.env.DB.prepare(`
      INSERT INTO portal_knowledge_feedback
      (id, org_id, article_id, portal_user_id, helpful, comentario)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(id, sess.org_id, c.req.param('id'), sess.portal_user_id, d.helpful ? 1 : 0, d.comentario || null).run();
    return c.json({ ok:true, id });
  });

  app.post('/api/customer-deliveries', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    if (!d.account_id || !d.titulo) return c.json({ ok:false, error:'account_id e titulo são obrigatórios' }, 400);
    const id = uid('deliv');
    await c.env.DB.prepare(`
      INSERT INTO customer_deliveries
      (id, org_id, portal_customer_id, account_id, contract_id, onboarding_project_id, titulo, descricao, tipo, status, prioridade, planned_start, planned_end, owner_id, customer_owner_id, evidencia_json, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, org.id, d.portal_customer_id || null, d.account_id, d.contract_id || null, d.onboarding_project_id || null, d.titulo, d.descricao || null, d.tipo || 'entrega', d.status || 'planejada', d.prioridade || 'media', d.planned_start || today(), d.planned_end || addDays(today(), 15), d.owner_id || user.id, d.customer_owner_id || null, d.evidencia_json ? json(d.evidencia_json) : '[]', user.id).run();

    const milestones = d.milestones_json || ['Planejamento', 'Execução', 'Validação interna', 'Aprovação cliente'];
    let order = 1;
    for (const m of milestones) {
      await c.env.DB.prepare(`
        INSERT INTO customer_delivery_milestones
        (id, org_id, delivery_id, ordem, titulo, descricao, status, due_date, customer_visible)
        VALUES (?, ?, ?, ?, ?, ?, 'pendente', ?, 1)
      `).bind(uid('dms'), org.id, id, order++, String(m), `Milestone: ${m}`, addDays(today(), 7 * order)).run();
    }
    return c.json({ ok:true, id, milestones: milestones.length }, 201);
  });

  app.get('/api/customer-deliveries', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`SELECT * FROM customer_deliveries WHERE org_id=? ORDER BY created_at DESC`).bind(org.id).all();
    return c.json({ ok:true, items: rs.results || [] });
  });

  app.get('/api/portal/external/deliveries', async (c: Ctx) => {
    const sess = await requirePortalSession(c);
    if (!sess) return c.json({ ok:false, error:'Sessão inválida' }, 401);
    if (!(await hasPortalPermission(c.env.DB, sess.org_id, sess.role, 'deliveries', 'read'))) return c.json({ ok:false, error:'Sem permissão' }, 403);
    const rs = await c.env.DB.prepare(`SELECT * FROM customer_deliveries WHERE org_id=? AND portal_customer_id=? ORDER BY created_at DESC`).bind(sess.org_id, sess.portal_customer_id).all();
    return c.json({ ok:true, items: rs.results || [] });
  });

  app.get('/api/customer-deliveries/:id/milestones', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`SELECT * FROM customer_delivery_milestones WHERE org_id=? AND delivery_id=? ORDER BY ordem`).bind(org.id, c.req.param('id')).all();
    return c.json({ ok:true, items: rs.results || [] });
  });

  app.post('/api/customer-delivery-milestones/:id/complete', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const id = c.req.param('id');
    const ms = await c.env.DB.prepare(`SELECT * FROM customer_delivery_milestones WHERE org_id=? AND id=?`).bind(org.id, id).first();
    if (!ms) return c.json({ ok:false, error:'Milestone não encontrado' }, 404);
    await c.env.DB.prepare(`UPDATE customer_delivery_milestones SET status='concluido', completed_at=?, completed_by=?, updated_at=CURRENT_TIMESTAMP WHERE org_id=? AND id=?`).bind(nowIso(), user.id, org.id, id).run();
    const counts = await c.env.DB.prepare(`SELECT COUNT(*) total, SUM(CASE WHEN status='concluido' THEN 1 ELSE 0 END) done FROM customer_delivery_milestones WHERE org_id=? AND delivery_id=?`).bind(org.id, ms.delivery_id).first();
    const progress = counts?.total ? (num(counts.done,0)/num(counts.total,1))*100 : 0;
    const status = progress >= 100 ? 'concluida' : 'em_andamento';
    await c.env.DB.prepare(`UPDATE customer_deliveries SET status=?, actual_end=?, updated_at=CURRENT_TIMESTAMP WHERE org_id=? AND id=?`).bind(status, progress >= 100 ? today() : null, org.id, ms.delivery_id).run();
    return c.json({ ok:true, progress, delivery_status: status });
  });

  app.post('/api/portal/external/tickets', async (c: Ctx) => {
    const sess = await requirePortalSession(c);
    if (!sess) return c.json({ ok:false, error:'Sessão inválida' }, 401);
    if (!(await hasPortalPermission(c.env.DB, sess.org_id, sess.role, 'tickets', 'write'))) return c.json({ ok:false, error:'Sem permissão' }, 403);
    const d = await body(c);
    if (!d.titulo) return c.json({ ok:false, error:'titulo é obrigatório' }, 400);
    const cs = await c.env.DB.prepare(`SELECT * FROM customer_success_accounts WHERE org_id=? AND account_id=?`).bind(sess.org_id, sess.account_id).first();
    const id = uid('csticket');
    await c.env.DB.prepare(`
      INSERT INTO customer_success_tickets
      (id, org_id, cs_account_id, account_id, titulo, descricao, tipo, severidade, status, prioridade, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'aberto', ?, NULL)
    `).bind(id, sess.org_id, cs?.id || null, sess.account_id, d.titulo, d.descricao || null, d.tipo || 'suporte_cliente', d.severidade || 'media', d.prioridade || 'media').run();
    await auditPortal(c.env.DB, sess.org_id, { portal_customer_id:sess.portal_customer_id, portal_user_id:sess.portal_user_id, action:'create_ticket', entity_type:'customer_success_ticket', entity_id:id });
    return c.json({ ok:true, id }, 201);
  });

  app.get('/api/portal/external/tickets', async (c: Ctx) => {
    const sess = await requirePortalSession(c);
    if (!sess) return c.json({ ok:false, error:'Sessão inválida' }, 401);
    if (!(await hasPortalPermission(c.env.DB, sess.org_id, sess.role, 'tickets', 'read'))) return c.json({ ok:false, error:'Sem permissão' }, 403);
    const rs = await c.env.DB.prepare(`SELECT * FROM customer_success_tickets WHERE org_id=? AND account_id=? ORDER BY created_at DESC`).bind(sess.org_id, sess.account_id).all();
    return c.json({ ok:true, items: rs.results || [] });
  });

  app.get('/api/portal/external/contracts', async (c: Ctx) => {
    const sess = await requirePortalSession(c);
    if (!sess) return c.json({ ok:false, error:'Sessão inválida' }, 401);
    if (!(await hasPortalPermission(c.env.DB, sess.org_id, sess.role, 'contracts', 'read'))) return c.json({ ok:false, error:'Sem permissão' }, 403);
    const rs = await c.env.DB.prepare(`SELECT id, codigo, titulo, status, data_inicio, data_fim, valor_mensal, valor_total_contrato, assinatura_status FROM commercial_contracts WHERE org_id=? AND account_id=? ORDER BY created_at DESC`).bind(sess.org_id, sess.account_id).all();
    return c.json({ ok:true, items: rs.results || [] });
  });

  app.get('/api/portal/external/invoices', async (c: Ctx) => {
    const sess = await requirePortalSession(c);
    if (!sess) return c.json({ ok:false, error:'Sessão inválida' }, 401);
    if (!(await hasPortalPermission(c.env.DB, sess.org_id, sess.role, 'invoices', 'read'))) return c.json({ ok:false, error:'Sem permissão' }, 403);
    const rs = await c.env.DB.prepare(`
      SELECT inv.*
      FROM billing_invoices inv
      JOIN saas_customer_subscriptions sub ON sub.id=inv.subscription_id
      WHERE inv.org_id=? AND sub.account_id=?
      ORDER BY inv.created_at DESC
    `).bind(sess.org_id, sess.account_id).all();
    return c.json({ ok:true, items: rs.results || [] });
  });

  app.post('/api/portal/external/change-requests', async (c: Ctx) => {
    const sess = await requirePortalSession(c);
    if (!sess) return c.json({ ok:false, error:'Sessão inválida' }, 401);
    if (!(await hasPortalPermission(c.env.DB, sess.org_id, sess.role, 'change_requests', 'write'))) return c.json({ ok:false, error:'Sem permissão' }, 403);
    const d = await body(c);
    if (!d.titulo || !d.descricao) return c.json({ ok:false, error:'titulo e descricao são obrigatórios' }, 400);
    const id = uid('crq');
    await c.env.DB.prepare(`
      INSERT INTO customer_change_requests
      (id, org_id, portal_customer_id, account_id, contract_id, requested_by_portal_user, titulo, descricao, justificativa, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'solicitada')
    `).bind(id, sess.org_id, sess.portal_customer_id, sess.account_id, d.contract_id || null, sess.portal_user_id, d.titulo, d.descricao, d.justificativa || null).run();
    await auditPortal(c.env.DB, sess.org_id, { portal_customer_id:sess.portal_customer_id, portal_user_id:sess.portal_user_id, action:'create_change_request', entity_type:'customer_change_request', entity_id:id });
    return c.json({ ok:true, id }, 201);
  });

  app.get('/api/portal/external/change-requests', async (c: Ctx) => {
    const sess = await requirePortalSession(c);
    if (!sess) return c.json({ ok:false, error:'Sessão inválida' }, 401);
    const rs = await c.env.DB.prepare(`SELECT * FROM customer_change_requests WHERE org_id=? AND portal_customer_id=? ORDER BY created_at DESC`).bind(sess.org_id, sess.portal_customer_id).all();
    return c.json({ ok:true, items: rs.results || [] });
  });

  app.post('/api/customer-change-requests/:id/decide', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const id = c.req.param('id');
    const d = await body(c);
    if (!['aprovar','rejeitar','solicitar_mais_info'].includes(d.decisao)) return c.json({ ok:false, error:'decisão inválida' }, 400);
    const status = d.decisao === 'aprovar' ? 'aprovada' : d.decisao === 'rejeitar' ? 'rejeitada' : 'mais_info';
    await c.env.DB.prepare(`
      UPDATE customer_change_requests
      SET status=?, decisao=?, decidido_por=?, decidido_em=?, resposta=?, impacto_prazo_dias=?, impacto_valor=?, updated_at=CURRENT_TIMESTAMP
      WHERE org_id=? AND id=?
    `).bind(status, d.decisao, user.id, nowIso(), d.resposta || null, num(d.impacto_prazo_dias,0), num(d.impacto_valor,0), org.id, id).run();
    return c.json({ ok:true, id, status });
  });

  app.post('/api/customer-approvals', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    if (!d.portal_customer_id || !d.account_id || !d.entidade_tipo || !d.entidade_id || !d.titulo) {
      return c.json({ ok:false, error:'portal_customer_id, account_id, entidade_tipo, entidade_id e titulo são obrigatórios' }, 400);
    }
    const id = uid('cappr');
    await c.env.DB.prepare(`
      INSERT INTO customer_approvals
      (id, org_id, portal_customer_id, account_id, entidade_tipo, entidade_id, titulo, descricao, status, due_date, requested_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pendente', ?, ?)
    `).bind(id, org.id, d.portal_customer_id, d.account_id, d.entidade_tipo, d.entidade_id, d.titulo, d.descricao || null, d.due_date || null, user.id).run();
    return c.json({ ok:true, id }, 201);
  });

  app.get('/api/portal/external/approvals', async (c: Ctx) => {
    const sess = await requirePortalSession(c);
    if (!sess) return c.json({ ok:false, error:'Sessão inválida' }, 401);
    if (!(await hasPortalPermission(c.env.DB, sess.org_id, sess.role, 'approvals', 'read'))) return c.json({ ok:false, error:'Sem permissão' }, 403);
    const rs = await c.env.DB.prepare(`SELECT * FROM customer_approvals WHERE org_id=? AND portal_customer_id=? ORDER BY created_at DESC`).bind(sess.org_id, sess.portal_customer_id).all();
    return c.json({ ok:true, items: rs.results || [] });
  });

  app.post('/api/portal/external/approvals/:id/decide', async (c: Ctx) => {
    const sess = await requirePortalSession(c);
    if (!sess) return c.json({ ok:false, error:'Sessão inválida' }, 401);
    if (!(await hasPortalPermission(c.env.DB, sess.org_id, sess.role, 'approvals', 'decide'))) return c.json({ ok:false, error:'Sem permissão' }, 403);
    const d = await body(c);
    if (!['aprovar','rejeitar'].includes(d.decisao)) return c.json({ ok:false, error:'decisão inválida' }, 400);
    const status = d.decisao === 'aprovar' ? 'aprovada' : 'rejeitada';
    await c.env.DB.prepare(`
      UPDATE customer_approvals
      SET status=?, decisao=?, comentario_cliente=?, decided_by_portal_user=?, decided_at=?, updated_at=CURRENT_TIMESTAMP
      WHERE org_id=? AND portal_customer_id=? AND id=?
    `).bind(status, d.decisao, d.comentario || null, sess.portal_user_id, nowIso(), sess.org_id, sess.portal_customer_id, c.req.param('id')).run();
    await auditPortal(c.env.DB, sess.org_id, { portal_customer_id:sess.portal_customer_id, portal_user_id:sess.portal_user_id, action:'decide_approval', entity_type:'customer_approval', entity_id:c.req.param('id'), metadata_json:{ decisao:d.decisao } });
    return c.json({ ok:true, id:c.req.param('id'), status });
  });

  app.post('/api/portal/nps/surveys', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    if (!d.portal_customer_id || !d.account_id) return c.json({ ok:false, error:'portal_customer_id e account_id são obrigatórios' }, 400);
    const id = uid('nps');
    await c.env.DB.prepare(`
      INSERT INTO portal_nps_surveys
      (id, org_id, portal_customer_id, account_id, titulo, status, send_at, closes_at, created_by)
      VALUES (?, ?, ?, ?, ?, 'aberta', ?, ?, ?)
    `).bind(id, org.id, d.portal_customer_id, d.account_id, d.titulo || 'Pesquisa NPS', d.send_at || nowIso(), d.closes_at || addDays(today(), 15), user.id).run();
    return c.json({ ok:true, id }, 201);
  });

  app.get('/api/portal/external/nps', async (c: Ctx) => {
    const sess = await requirePortalSession(c);
    if (!sess) return c.json({ ok:false, error:'Sessão inválida' }, 401);
    const rs = await c.env.DB.prepare(`SELECT * FROM portal_nps_surveys WHERE org_id=? AND portal_customer_id=? AND status='aberta' ORDER BY created_at DESC`).bind(sess.org_id, sess.portal_customer_id).all();
    return c.json({ ok:true, items: rs.results || [] });
  });

  app.post('/api/portal/external/nps/:id/respond', async (c: Ctx) => {
    const sess = await requirePortalSession(c);
    if (!sess) return c.json({ ok:false, error:'Sessão inválida' }, 401);
    if (!(await hasPortalPermission(c.env.DB, sess.org_id, sess.role, 'nps', 'write'))) return c.json({ ok:false, error:'Sem permissão' }, 403);
    const d = await body(c);
    const score = Number(d.score);
    if (!Number.isInteger(score) || score < 0 || score > 10) return c.json({ ok:false, error:'score deve ser inteiro de 0 a 10' }, 400);
    const categoria = score >= 9 ? 'promotor' : score >= 7 ? 'neutro' : 'detrator';
    const id = uid('npsr');
    await c.env.DB.prepare(`
      INSERT INTO portal_nps_responses
      (id, org_id, survey_id, portal_user_id, score, comentario, categoria)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(id, sess.org_id, c.req.param('id'), sess.portal_user_id, score, d.comentario || null, categoria).run();
    return c.json({ ok:true, id, categoria });
  });
}

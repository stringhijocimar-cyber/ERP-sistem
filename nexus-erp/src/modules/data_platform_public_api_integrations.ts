// src/modules/data_platform_public_api_integrations.ts
// NEXUS ERP — Etapa 30: Data Platform, API Pública, Integrações, Webhooks Reais e Conectores Enterprise
//
// Integração:
// import { registerDataPlatformIntegrationRoutes } from './modules/data_platform_public_api_integrations';
// registerDataPlatformIntegrationRoutes(app, { requireOrg, auditLog });
//
// Regra crítica:
// esta etapa prepara APIs, credenciais, filas, webhooks, logs e conectores.
// Chamadas externas reais devem ser habilitadas somente com provider/secret configurado.

import type { Hono } from 'hono';

type Ctx = any;
type Deps = {
  requireOrg: (c: Ctx) => Promise<{ user: any; org: any }>;
  auditLog?: (c: Ctx, input: any) => Promise<void>;
};

function uid(prefix: string) { return `${prefix}_${crypto.randomUUID()}`; }
function nowIso() { return new Date().toISOString(); }
async function body(c: Ctx) { try { return await c.req.json(); } catch { return {}; } }
function json(v: any) { return typeof v === 'string' ? v : JSON.stringify(v ?? {}); }
function parseJson(v: any, fallback: any = {}) { try { return typeof v === 'string' ? JSON.parse(v) : (v ?? fallback); } catch { return fallback; } }
function addDays(days: number) { const d = new Date(); d.setDate(d.getDate()+days); return d.toISOString(); }

async function sha256Hex(input: string) {
  const data = new TextEncoder().encode(input || '');
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function audit(db: any, orgId: string, actorId: string | null, entityType: string, entityId: string, action: string, before?: any, after?: any, metadata?: any) {
  await db.prepare(`
    INSERT INTO integration_audit_trail
    (id, org_id, entity_type, entity_id, action, actor_id, before_json, after_json, metadata_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(uid('iaud'), orgId, entityType, entityId, action, actorId, before ? json(before) : null, after ? json(after) : null, metadata ? json(metadata) : null).run();
}

async function logRequest(db: any, orgId: string, input: any) {
  await db.prepare(`
    INSERT INTO api_request_logs
    (id, org_id, application_id, request_id, method, path, status_code, latency_ms, ip_address, user_agent, error_message)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(uid('apilog'), orgId, input.application_id || null, input.request_id || crypto.randomUUID(), input.method || 'GET', input.path || '/', input.status_code || null, input.latency_ms || null, input.ip_address || null, input.user_agent || null, input.error_message || null).run();
}

async function authenticateApiKey(db: any, apiKey: string) {
  if (!apiKey) return null;
  const hash = await sha256Hex(apiKey);
  const cred = await db.prepare(`
    SELECT c.*, a.codigo AS app_codigo, a.nome AS app_nome, a.scopes_json, a.rate_limit_per_minute, a.status AS app_status, a.org_id AS app_org_id
    FROM api_credentials c
    JOIN api_applications a ON a.id=c.application_id
    WHERE c.secret_hash=? AND c.status='ativo' AND a.status='ativo'
    AND (c.expires_at IS NULL OR datetime(c.expires_at) > datetime('now'))
  `).bind(hash).first();
  if (!cred) return null;
  await db.prepare(`UPDATE api_credentials SET last_used_at=? WHERE id=?`).bind(nowIso(), cred.id).run();
  return cred;
}

async function enqueueIntegrationEvent(db: any, orgId: string, input: any) {
  const id = uid('ijob');
  await db.prepare(`
    INSERT INTO integration_jobs
    (id, org_id, connector_id, mapping_id, job_type, direction, status, priority, entidade_tipo, entidade_id, payload_json, scheduled_at, created_by)
    VALUES (?, ?, ?, ?, ?, ?, 'queued', ?, ?, ?, ?, ?, ?)
  `).bind(id, orgId, input.connector_id || null, input.mapping_id || null, input.job_type || 'sync', input.direction || 'outbound', input.priority || 'normal', input.entidade_tipo || null, input.entidade_id || null, input.payload_json ? json(input.payload_json) : '{}', input.scheduled_at || nowIso(), input.created_by || null).run();
  return id;
}

export function registerDataPlatformIntegrationRoutes(app: Hono, deps: Deps) {
  const { requireOrg, auditLog } = deps;

  async function log(c: Ctx, action: string, entity: string, entityId: string, data?: any) {
    if (auditLog) await auditLog(c, { action, entity, entity_id: entityId, data });
  }

  app.post('/api/data-platform/seed-defaults', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);

    const endpoints = [
      { method:'GET', path:'/public/v1/accounts', nome:'Listar Contas', module:'crm', scopes:['crm:read'] },
      { method:'GET', path:'/public/v1/opportunities', nome:'Listar Oportunidades', module:'crm', scopes:['crm:read'] },
      { method:'POST', path:'/public/v1/integration-jobs', nome:'Criar Job de Integração', module:'integrations', scopes:['integrations:write'] },
      { method:'GET', path:'/public/v1/data-exports/:id', nome:'Consultar Exportação', module:'data', scopes:['data:read'] }
    ];
    for (const ep of endpoints) {
      await c.env.DB.prepare(`
        INSERT OR IGNORE INTO api_catalog_endpoints
        (id, org_id, version, method, path, nome, descricao, module, scopes_required_json, request_schema_json, response_schema_json, status)
        VALUES (?, ?, 'v1', ?, ?, ?, ?, ?, ?, '{}', '{}', 'ativo')
      `).bind(uid('apicat'), org.id, ep.method, ep.path, ep.nome, `Endpoint ${ep.nome}`, ep.module, JSON.stringify(ep.scopes)).run();
    }

    const connectors = [
      { codigo:'sap_erp', nome:'SAP ERP', type:'erp', provider:'sap', caps:['purchase_orders','vendors','invoices'] },
      { codigo:'totvs_protheus', nome:'TOTVS Protheus', type:'erp', provider:'totvs', caps:['financial','inventory','purchasing'] },
      { codigo:'power_bi', nome:'Power BI', type:'bi', provider:'microsoft', caps:['datasets','refresh','reports'] },
      { codigo:'s3_storage', nome:'S3 Storage', type:'storage', provider:'aws', caps:['files','exports','backups'] },
      { codigo:'n8n_automation', nome:'n8n Automation', type:'automation', provider:'n8n', caps:['webhooks','orchestration'] }
    ];
    for (const cn of connectors) {
      await c.env.DB.prepare(`
        INSERT OR IGNORE INTO integration_connectors
        (id, org_id, codigo, nome, connector_type, provider, status, direction, auth_type, capabilities_json, created_by)
        VALUES (?, ?, ?, ?, ?, ?, 'rascunho', 'bidirectional', 'api_key', ?, ?)
      `).bind(uid('conn'), org.id, cn.codigo, cn.nome, cn.type, cn.provider, JSON.stringify(cn.caps), user.id).run();
    }

    await log(c, 'SEED', 'data_platform_defaults', org.id, { endpoints:endpoints.length, connectors:connectors.length });
    return c.json({ ok:true, endpoints:endpoints.length, connectors:connectors.length });
  });

  app.get('/api/data-platform/dashboard', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const db = c.env.DB;
    const [apps, creds, connectors, jobs, wh, inbound, exports, bi, logs] = await Promise.all([
      db.prepare(`SELECT status, COUNT(*) qtd FROM api_applications WHERE org_id=? GROUP BY status`).bind(org.id).all(),
      db.prepare(`SELECT status, COUNT(*) qtd FROM api_credentials WHERE org_id=? GROUP BY status`).bind(org.id).all(),
      db.prepare(`SELECT status, connector_type, COUNT(*) qtd FROM integration_connectors WHERE org_id=? GROUP BY status,connector_type`).bind(org.id).all(),
      db.prepare(`SELECT status, COUNT(*) qtd FROM integration_jobs WHERE org_id=? GROUP BY status`).bind(org.id).all(),
      db.prepare(`SELECT status, COUNT(*) qtd FROM outbound_webhook_deliveries_v2 WHERE org_id=? GROUP BY status`).bind(org.id).all(),
      db.prepare(`SELECT status, COUNT(*) qtd FROM inbound_webhook_events WHERE org_id=? GROUP BY status`).bind(org.id).all(),
      db.prepare(`SELECT status, COUNT(*) qtd FROM data_export_jobs WHERE org_id=? GROUP BY status`).bind(org.id).all(),
      db.prepare(`SELECT status, COUNT(*) qtd FROM bi_connections WHERE org_id=? GROUP BY status`).bind(org.id).all(),
      db.prepare(`SELECT COUNT(*) qtd FROM api_request_logs WHERE org_id=?`).bind(org.id).first()
    ]);
    return c.json({ ok:true, applications:apps.results || [], credentials:creds.results || [], connectors:connectors.results || [], jobs:jobs.results || [], outbound_webhooks:wh.results || [], inbound_webhooks:inbound.results || [], exports:exports.results || [], bi_connections:bi.results || [], api_logs:logs || {qtd:0} });
  });

  app.post('/api/data-platform/applications', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    if (!d.codigo || !d.nome) return c.json({ ok:false, error:'codigo e nome são obrigatórios' }, 400);
    const id = uid('apiapp');
    await c.env.DB.prepare(`
      INSERT INTO api_applications
      (id, org_id, codigo, nome, descricao, owner_id, status, environment, scopes_json, allowed_ips_json, allowed_origins_json, rate_limit_per_minute, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, org.id, d.codigo, d.nome, d.descricao || null, d.owner_id || user.id, d.status || 'ativo', d.environment || 'production', d.scopes_json ? json(d.scopes_json) : '[]', d.allowed_ips_json ? json(d.allowed_ips_json) : '[]', d.allowed_origins_json ? json(d.allowed_origins_json) : '[]', d.rate_limit_per_minute || 120, user.id).run();
    await audit(c.env.DB, org.id, user.id, 'api_application', id, 'create', null, d);
    return c.json({ ok:true, id }, 201);
  });

  app.get('/api/data-platform/applications', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`SELECT * FROM api_applications WHERE org_id=? ORDER BY created_at DESC`).bind(org.id).all();
    return c.json({ ok:true, items:rs.results || [] });
  });

  app.post('/api/data-platform/applications/:id/credentials', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const appId = c.req.param('id');
    const d = await body(c);
    const appRow = await c.env.DB.prepare(`SELECT * FROM api_applications WHERE org_id=? AND id=?`).bind(org.id, appId).first();
    if (!appRow) return c.json({ ok:false, error:'Aplicação não encontrada' }, 404);
    const rawSecret = `nx_${crypto.randomUUID().replaceAll('-','')}_${crypto.randomUUID().replaceAll('-','')}`;
    const hash = await sha256Hex(rawSecret);
    const id = uid('apicred');
    await c.env.DB.prepare(`
      INSERT INTO api_credentials
      (id, org_id, application_id, credential_type, client_id, secret_hash, key_prefix, status, expires_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'ativo', ?, ?)
    `).bind(id, org.id, appId, d.credential_type || 'api_key', d.client_id || `client_${appRow.codigo}`, hash, rawSecret.slice(0,10), d.expires_at || addDays(365), user.id).run();
    return c.json({ ok:true, id, api_key:rawSecret, expires_at:d.expires_at || addDays(365) }, 201);
  });

  app.post('/api/public/auth/token', async (c: Ctx) => {
    const d = await body(c);
    const clientId = d.client_id;
    const clientSecret = d.client_secret;
    if (!clientId || !clientSecret) return c.json({ ok:false, error:'client_id e client_secret são obrigatórios' }, 400);
    const hash = await sha256Hex(clientSecret);
    const cred = await c.env.DB.prepare(`
      SELECT c.*, a.scopes_json, a.status AS app_status
      FROM api_credentials c
      JOIN api_applications a ON a.id=c.application_id
      WHERE c.client_id=? AND c.secret_hash=? AND c.status='ativo' AND a.status='ativo'
    `).bind(clientId, hash).first();
    if (!cred) return c.json({ ok:false, error:'Credencial inválida' }, 401);
    const token = `nxt_${crypto.randomUUID().replaceAll('-','')}_${crypto.randomUUID().replaceAll('-','')}`;
    const tokenHash = await sha256Hex(token);
    const tokenId = uid('apitok');
    await c.env.DB.prepare(`
      INSERT INTO api_access_tokens
      (id, org_id, application_id, token_hash, scopes_json, expires_at, metadata_json)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(tokenId, cred.org_id, cred.application_id, tokenHash, cred.scopes_json || '[]', addDays(1), JSON.stringify({ grant_type:'client_credentials' })).run();
    return c.json({ ok:true, access_token:token, token_type:'Bearer', expires_at:addDays(1), scopes:parseJson(cred.scopes_json,[]) });
  });

  app.get('/api/data-platform/catalog', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`SELECT * FROM api_catalog_endpoints WHERE org_id=? OR org_id IS NULL ORDER BY version,module,path`).bind(org.id).all();
    return c.json({ ok:true, items:rs.results || [] });
  });

  app.post('/api/data-platform/connectors', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    if (!d.codigo || !d.nome || !d.connector_type || !d.provider) return c.json({ ok:false, error:'codigo, nome, connector_type e provider são obrigatórios' }, 400);
    const id = uid('conn');
    await c.env.DB.prepare(`
      INSERT INTO integration_connectors
      (id, org_id, codigo, nome, connector_type, provider, status, direction, auth_type, credentials_ref, base_url, config_json, capabilities_json, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, org.id, d.codigo, d.nome, d.connector_type, d.provider, d.status || 'rascunho', d.direction || 'bidirectional', d.auth_type || 'api_key', d.credentials_ref || null, d.base_url || null, d.config_json ? json(d.config_json) : '{}', d.capabilities_json ? json(d.capabilities_json) : '[]', user.id).run();
    await audit(c.env.DB, org.id, user.id, 'integration_connector', id, 'create', null, d);
    return c.json({ ok:true, id }, 201);
  });

  app.get('/api/data-platform/connectors', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`SELECT * FROM integration_connectors WHERE org_id=? ORDER BY connector_type,provider,nome`).bind(org.id).all();
    return c.json({ ok:true, items:rs.results || [] });
  });

  app.post('/api/data-platform/mappings', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    if (!d.connector_id || !d.codigo || !d.nome || !d.source_entity || !d.target_entity) return c.json({ ok:false, error:'connector_id, codigo, nome, source_entity e target_entity são obrigatórios' }, 400);
    const id = uid('imap');
    await c.env.DB.prepare(`
      INSERT INTO integration_mappings
      (id, org_id, connector_id, codigo, nome, source_entity, target_entity, direction, field_map_json, transform_rules_json, validation_json, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, org.id, d.connector_id, d.codigo, d.nome, d.source_entity, d.target_entity, d.direction || 'outbound', d.field_map_json ? json(d.field_map_json) : '{}', d.transform_rules_json ? json(d.transform_rules_json) : '[]', d.validation_json ? json(d.validation_json) : '{}', d.status || 'ativo', user.id).run();
    return c.json({ ok:true, id }, 201);
  });

  app.get('/api/data-platform/mappings', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`
      SELECT m.*, c.codigo AS connector_codigo, c.provider
      FROM integration_mappings m
      JOIN integration_connectors c ON c.id=m.connector_id
      WHERE m.org_id=?
      ORDER BY c.codigo,m.codigo
    `).bind(org.id).all();
    return c.json({ ok:true, items:rs.results || [] });
  });

  app.post('/api/data-platform/jobs', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    const id = await enqueueIntegrationEvent(c.env.DB, org.id, { ...d, created_by:user.id });
    return c.json({ ok:true, id }, 201);
  });

  app.get('/api/data-platform/jobs', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`SELECT * FROM integration_jobs WHERE org_id=? ORDER BY scheduled_at DESC LIMIT 300`).bind(org.id).all();
    return c.json({ ok:true, items:rs.results || [] });
  });

  app.post('/api/data-platform/jobs/:id/process-manual', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const id = c.req.param('id');
    const job = await c.env.DB.prepare(`SELECT * FROM integration_jobs WHERE org_id=? AND id=?`).bind(org.id, id).first();
    if (!job) return c.json({ ok:false, error:'Job não encontrado' }, 404);
    await c.env.DB.prepare(`UPDATE integration_jobs SET status='running', started_at=?, attempts=attempts+1, updated_at=CURRENT_TIMESTAMP WHERE org_id=? AND id=?`).bind(nowIso(), org.id, id).run();
    await c.env.DB.prepare(`
      INSERT INTO integration_job_events
      (id, org_id, job_id, event_type, message, payload_json)
      VALUES (?, ?, ?, 'manual_process', 'Processamento manual simulado. Integração externa real não executada.', ?)
    `).bind(uid('ije'), org.id, id, job.payload_json || '{}').run();
    await c.env.DB.prepare(`UPDATE integration_jobs SET status='success', finished_at=?, result_json=?, updated_at=CURRENT_TIMESTAMP WHERE org_id=? AND id=?`).bind(nowIso(), JSON.stringify({ simulated:true, message:'Job processado manualmente com sucesso.' }), org.id, id).run();
    return c.json({ ok:true, id, status:'success', simulated:true });
  });

  app.post('/api/data-platform/outbound-webhooks', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    if (!d.codigo || !d.nome || !d.url) return c.json({ ok:false, error:'codigo, nome e url são obrigatórios' }, 400);
    const secret = d.secret || crypto.randomUUID();
    const secretHash = await sha256Hex(secret);
    const id = uid('owh');
    await c.env.DB.prepare(`
      INSERT INTO outbound_webhook_endpoints_v2
      (id, org_id, application_id, codigo, nome, url, secret_hash, eventos_json, headers_json, status, retry_policy_json, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, org.id, d.application_id || null, d.codigo, d.nome, d.url, secretHash, d.eventos_json ? json(d.eventos_json) : '[]', d.headers_json ? json(d.headers_json) : '{}', d.status || 'ativo', d.retry_policy_json ? json(d.retry_policy_json) : '{"max_attempts":5,"backoff_seconds":60}', user.id).run();
    return c.json({ ok:true, id, secret }, 201);
  });

  app.post('/api/data-platform/outbound-webhooks/emit', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const d = await body(c);
    if (!d.event_name) return c.json({ ok:false, error:'event_name é obrigatório' }, 400);
    const eps = await c.env.DB.prepare(`SELECT * FROM outbound_webhook_endpoints_v2 WHERE org_id=? AND status='ativo'`).bind(org.id).all();
    let created = 0;
    for (const ep of eps.results || []) {
      const events = parseJson(ep.eventos_json, []);
      if (events.length && !events.includes(d.event_name)) continue;
      await c.env.DB.prepare(`
        INSERT INTO outbound_webhook_deliveries_v2
        (id, org_id, endpoint_id, event_name, entidade_tipo, entidade_id, status, request_json, next_attempt_at)
        VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)
      `).bind(uid('owhd'), org.id, ep.id, d.event_name, d.entidade_tipo || null, d.entidade_id || null, JSON.stringify({ url:ep.url, event_name:d.event_name, payload:d.payload_json || {} }), nowIso()).run();
      created++;
    }
    return c.json({ ok:true, deliveries_created:created });
  });

  app.get('/api/data-platform/outbound-webhooks/deliveries', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`SELECT * FROM outbound_webhook_deliveries_v2 WHERE org_id=? ORDER BY created_at DESC LIMIT 300`).bind(org.id).all();
    return c.json({ ok:true, items:rs.results || [] });
  });

  app.post('/api/data-platform/outbound-webhooks/deliveries/:id/process-manual', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const id = c.req.param('id');
    const row = await c.env.DB.prepare(`SELECT * FROM outbound_webhook_deliveries_v2 WHERE org_id=? AND id=?`).bind(org.id, id).first();
    if (!row) return c.json({ ok:false, error:'Delivery não encontrada' }, 404);
    await c.env.DB.prepare(`
      UPDATE outbound_webhook_deliveries_v2
      SET status='delivered_manual', attempts=attempts+1, response_status=200, response_body=?, delivered_at=?, updated_at=CURRENT_TIMESTAMP
      WHERE org_id=? AND id=?
    `).bind(JSON.stringify({ manual:true, message:'Webhook externo real não chamado nesta etapa.' }), nowIso(), org.id, id).run();
    return c.json({ ok:true, id, status:'delivered_manual' });
  });

  app.post('/api/data-platform/inbound-webhooks/:provider', async (c: Ctx) => {
    const provider = c.req.param('provider');
    const d = await body(c);
    const orgId = d.org_id;
    if (!orgId) return c.json({ ok:false, error:'org_id é obrigatório no payload nesta implementação inicial' }, 400);
    const id = uid('iwh');
    await c.env.DB.prepare(`
      INSERT INTO inbound_webhook_events
      (id, org_id, connector_id, provider, event_name, signature_valid, status, payload_json)
      VALUES (?, ?, ?, ?, ?, ?, 'received', ?)
    `).bind(id, orgId, d.connector_id || null, provider, d.event_name || 'unknown', d.signature_valid ? 1 : 0, json(d)).run();
    return c.json({ ok:true, id, status:'received' }, 201);
  });

  app.post('/api/data-platform/exports', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    if (!d.codigo || !d.nome || !d.entity_name) return c.json({ ok:false, error:'codigo, nome e entity_name são obrigatórios' }, 400);
    const id = uid('dexp');
    await c.env.DB.prepare(`
      INSERT INTO data_export_jobs
      (id, org_id, codigo, nome, entity_name, export_format, filter_json, status, requested_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'queued', ?)
    `).bind(id, org.id, d.codigo, d.nome, d.entity_name, d.export_format || 'json', d.filter_json ? json(d.filter_json) : '{}', user.id).run();
    return c.json({ ok:true, id }, 201);
  });

  app.post('/api/data-platform/exports/:id/process-manual', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const id = c.req.param('id');
    const exp = await c.env.DB.prepare(`SELECT * FROM data_export_jobs WHERE org_id=? AND id=?`).bind(org.id, id).first();
    if (!exp) return c.json({ ok:false, error:'Export não encontrado' }, 404);
    const fileUrl = `/exports/${org.id}/${exp.codigo}.${exp.export_format}`;
    await c.env.DB.prepare(`UPDATE data_export_jobs SET status='finished', file_url=?, row_count=?, finished_at=? WHERE org_id=? AND id=?`).bind(fileUrl, 0, nowIso(), org.id, id).run();
    return c.json({ ok:true, id, file_url:fileUrl, row_count:0 });
  });

  app.get('/api/data-platform/exports', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`SELECT * FROM data_export_jobs WHERE org_id=? ORDER BY requested_at DESC LIMIT 300`).bind(org.id).all();
    return c.json({ ok:true, items:rs.results || [] });
  });

  app.post('/api/data-platform/datasets', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    if (!d.codigo || !d.nome || !d.source_entity) return c.json({ ok:false, error:'codigo, nome e source_entity são obrigatórios' }, 400);
    const id = uid('ds');
    await c.env.DB.prepare(`
      INSERT INTO data_warehouse_datasets
      (id, org_id, codigo, nome, descricao, source_entity, schema_json, refresh_policy_json, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, org.id, d.codigo, d.nome, d.descricao || null, d.source_entity, d.schema_json ? json(d.schema_json) : '{}', d.refresh_policy_json ? json(d.refresh_policy_json) : '{}', d.status || 'ativo', user.id).run();
    return c.json({ ok:true, id }, 201);
  });

  app.post('/api/data-platform/bi-connections', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    if (!d.codigo || !d.nome) return c.json({ ok:false, error:'codigo e nome são obrigatórios' }, 400);
    const id = uid('bi');
    await c.env.DB.prepare(`
      INSERT INTO bi_connections
      (id, org_id, codigo, nome, bi_tool, status, connection_type, endpoint_url, access_scope_json, refresh_frequency, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, org.id, d.codigo, d.nome, d.bi_tool || 'power_bi', d.status || 'ativo', d.connection_type || 'api', d.endpoint_url || null, d.access_scope_json ? json(d.access_scope_json) : '[]', d.refresh_frequency || 'daily', user.id).run();
    return c.json({ ok:true, id }, 201);
  });

  app.get('/api/data-platform/bi-connections', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`SELECT * FROM bi_connections WHERE org_id=? ORDER BY created_at DESC`).bind(org.id).all();
    return c.json({ ok:true, items:rs.results || [] });
  });

  app.post('/api/data-platform/storage-connectors', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    if (!d.codigo || !d.nome || !d.provider) return c.json({ ok:false, error:'codigo, nome e provider são obrigatórios' }, 400);
    const id = uid('stor');
    await c.env.DB.prepare(`
      INSERT INTO storage_connectors
      (id, org_id, codigo, nome, provider, status, bucket_name, base_path, credentials_ref, config_json, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, org.id, d.codigo, d.nome, d.provider, d.status || 'ativo', d.bucket_name || null, d.base_path || null, d.credentials_ref || null, d.config_json ? json(d.config_json) : '{}', user.id).run();
    return c.json({ ok:true, id }, 201);
  });

  app.post('/api/public/v1/integration-jobs', async (c: Ctx) => {
    const apiKey = c.req.header('X-API-Key') || '';
    const cred = await authenticateApiKey(c.env.DB, apiKey);
    if (!cred) return c.json({ ok:false, error:'API key inválida' }, 401);
    const d = await body(c);
    const id = await enqueueIntegrationEvent(c.env.DB, cred.org_id, { ...d, created_by:null });
    await logRequest(c.env.DB, cred.org_id, { application_id:cred.application_id, method:'POST', path:'/public/v1/integration-jobs', status_code:201 });
    return c.json({ ok:true, id }, 201);
  });

  app.get('/api/data-platform/audit', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`SELECT * FROM integration_audit_trail WHERE org_id=? ORDER BY created_at DESC LIMIT 300`).bind(org.id).all();
    return c.json({ ok:true, items:rs.results || [] });
  });
}

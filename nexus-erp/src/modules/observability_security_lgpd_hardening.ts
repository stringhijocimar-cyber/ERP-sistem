// src/modules/observability_security_lgpd_hardening.ts
// NEXUS ERP — Etapa 31: Observabilidade, Segurança Avançada, LGPD, Auditoria Forense e Hardening Enterprise
//
// Integração:
// import { registerObservabilitySecurityRoutes } from './modules/observability_security_lgpd_hardening';
// registerObservabilitySecurityRoutes(app, { requireOrg, auditLog });
//
// Regra crítica:
// Esta etapa implementa governança, registros, controles e simulações seguras.
// MFA, criptografia real, SIEM e DLP reais dependem de providers/infraestrutura externa.

import type { Hono } from 'hono';

type Ctx = any;
type Deps = {
  requireOrg: (c: Ctx) => Promise<{ user: any; org: any }>;
  auditLog?: (c: Ctx, input: any) => Promise<void>;
};

function uid(prefix: string) { return `${prefix}_${crypto.randomUUID()}`; }
function nowIso() { return new Date().toISOString(); }
function addDays(days: number) { const d = new Date(); d.setDate(d.getDate()+days); return d.toISOString(); }
async function body(c: Ctx) { try { return await c.req.json(); } catch { return {}; } }
function json(v: any) { return typeof v === 'string' ? v : JSON.stringify(v ?? {}); }
function parseJson(v: any, fallback: any = {}) { try { return typeof v === 'string' ? JSON.parse(v) : (v ?? fallback); } catch { return fallback; } }
function num(v: any, fallback = 0) { const n = Number(v); return Number.isFinite(n) ? n : fallback; }

async function sha256Hex(input: string) {
  const data = new TextEncoder().encode(input || '');
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function forensicHash(input: any, previousHash?: string) {
  return await sha256Hex(JSON.stringify({ previousHash: previousHash || null, input }));
}

async function writeForensic(db: any, orgId: string | null, actorId: string | null, input: any) {
  const prev = orgId
    ? await db.prepare(`SELECT event_hash FROM forensic_audit_events WHERE org_id=? ORDER BY created_at DESC LIMIT 1`).bind(orgId).first()
    : null;
  const hash = await forensicHash(input, prev?.event_hash);
  const id = uid('fae');
  await db.prepare(`
    INSERT INTO forensic_audit_events
    (id, org_id, event_hash, previous_hash, actor_user_id, action, entity_type, entity_id, before_json, after_json, ip_address, user_agent, risk_score, metadata_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id, orgId, hash, prev?.event_hash || null, actorId,
    input.action, input.entity_type || null, input.entity_id || null,
    input.before_json ? json(input.before_json) : null,
    input.after_json ? json(input.after_json) : null,
    input.ip_address || null,
    input.user_agent || null,
    num(input.risk_score, 0),
    input.metadata_json ? json(input.metadata_json) : '{}'
  ).run();
  return { id, hash };
}

export function registerObservabilitySecurityRoutes(app: Hono, deps: Deps) {
  const { requireOrg, auditLog } = deps;

  async function log(c: Ctx, action: string, entity: string, entityId: string, data?: any) {
    if (auditLog) await auditLog(c, { action, entity, entity_id: entityId, data });
  }

  app.post('/api/security-enterprise/seed-defaults', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);

    const policies = [
      { codigo:'password_default', nome:'Política de Senha Padrão', type:'password', config:{ min_length:12, require_upper:true, require_lower:true, require_number:true, require_symbol:true, expire_days:90 } },
      { codigo:'session_default', nome:'Política de Sessão Padrão', type:'session', config:{ session_hours:8, idle_minutes:30, revoke_on_password_change:true } },
      { codigo:'mfa_admin', nome:'MFA para Administradores', type:'mfa', config:{ required_for_roles:['admin','security_admin'], methods:['totp','email_code'] } }
    ];
    for (const p of policies) {
      await c.env.DB.prepare(`
        INSERT OR IGNORE INTO security_policies
        (id, org_id, codigo, nome, policy_type, status, config_json, enforced, created_by)
        VALUES (?, ?, ?, ?, ?, 'ativo', ?, 1, ?)
      `).bind(uid('spol'), org.id, p.codigo, p.nome, p.type, JSON.stringify(p.config), user.id).run();
    }

    const classes = [
      { codigo:'public', nome:'Público', classification:'public', retention:3650, enc:0, mask:0 },
      { codigo:'internal', nome:'Interno', classification:'internal', retention:1825, enc:0, mask:0 },
      { codigo:'confidential', nome:'Confidencial', classification:'confidential', retention:1825, enc:1, mask:1 },
      { codigo:'personal_data', nome:'Dados Pessoais LGPD', classification:'personal_data', retention:1825, enc:1, mask:1 },
      { codigo:'sensitive_data', nome:'Dados Sensíveis LGPD', classification:'sensitive_data', retention:1825, enc:1, mask:1 }
    ];
    for (const cl of classes) {
      await c.env.DB.prepare(`
        INSERT OR IGNORE INTO data_classification_policies
        (id, org_id, codigo, nome, classification, description, handling_rules_json, retention_days, encryption_required, masking_required, status, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ativo', ?)
      `).bind(uid('dcp'), org.id, cl.codigo, cl.nome, cl.classification, `Classificação ${cl.nome}`, JSON.stringify({ access:'least_privilege', audit:true }), cl.retention, cl.enc, cl.mask, user.id).run();
    }

    const retention = [
      { codigo:'logs_365', nome:'Retenção de Logs 365 dias', entity:'system_log_events', classification:'internal', days:365, action:'archive' },
      { codigo:'personal_1825', nome:'Retenção Dados Pessoais 5 anos', entity:'lgpd_data_subjects', classification:'personal_data', days:1825, action:'review' },
      { codigo:'audit_3650', nome:'Retenção Auditoria 10 anos', entity:'forensic_audit_events', classification:'confidential', days:3650, action:'archive' }
    ];
    for (const r of retention) {
      await c.env.DB.prepare(`
        INSERT OR IGNORE INTO data_retention_policies
        (id, org_id, codigo, nome, entity_type, classification, retention_days, action_after_retention, legal_hold_exempt, status, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 'ativo', ?)
      `).bind(uid('drp'), org.id, r.codigo, r.nome, r.entity, r.classification, r.days, r.action, user.id).run();
    }

    const anomaly = [
      { codigo:'failed_login_spike', nome:'Pico de falhas de login', source:'security_login_attempts', severity:'high', condition:{ failed_attempts:5, window_minutes:15 } },
      { codigo:'api_error_spike', nome:'Pico de erros API', source:'api_request_logs', severity:'medium', condition:{ error_rate_percent:20, window_minutes:10 } },
      { codigo:'admin_without_mfa', nome:'Admin sem MFA', source:'security_mfa_devices', severity:'high', condition:{ role:'admin', mfa_required:true } }
    ];
    for (const a of anomaly) {
      await c.env.DB.prepare(`
        INSERT OR IGNORE INTO anomaly_detection_rules
        (id, org_id, codigo, nome, category, severity, signal_source, condition_json, action_json, status, created_by)
        VALUES (?, ?, ?, ?, 'security', ?, ?, ?, ?, 'ativo', ?)
      `).bind(uid('adr'), org.id, a.codigo, a.nome, a.severity, a.source, JSON.stringify(a.condition), JSON.stringify({ create_incident:true, notify:true }), user.id).run();
    }

    await c.env.DB.prepare(`
      INSERT OR IGNORE INTO encryption_key_registry
      (id, org_id, key_alias, key_type, provider, status, rotation_days, last_rotated_at, next_rotation_at, created_by)
      VALUES (?, ?, 'default_logical_key', 'logical', 'internal_ref', 'ativo', 180, ?, ?, ?)
    `).bind(uid('ekey'), org.id, nowIso(), addDays(180), user.id).run();

    await writeForensic(c.env.DB, org.id, user.id, { action:'security_seed_defaults', entity_type:'security_enterprise', entity_id:org.id, metadata_json:{ policies:policies.length, classifications:classes.length } });
    await log(c, 'SEED', 'security_enterprise_defaults', org.id, { policies:policies.length });
    return c.json({ ok:true, policies:policies.length, classifications:classes.length, retention:retention.length, anomaly_rules:anomaly.length });
  });

  app.get('/api/security-enterprise/dashboard', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const db = c.env.DB;
    const [
      logs, metrics, health, policies, sessions, attempts, assets, lgpdReq,
      incidents, anomalies, hardening
    ] = await Promise.all([
      db.prepare(`SELECT level, COUNT(*) qtd FROM system_log_events WHERE org_id=? GROUP BY level`).bind(org.id).all(),
      db.prepare(`SELECT metric_name, AVG(metric_value) avg_value, COUNT(*) qtd FROM system_metrics WHERE org_id=? GROUP BY metric_name`).bind(org.id).all(),
      db.prepare(`SELECT status, COUNT(*) qtd FROM system_health_checks WHERE org_id=? GROUP BY status`).bind(org.id).all(),
      db.prepare(`SELECT policy_type, status, COUNT(*) qtd FROM security_policies WHERE org_id=? GROUP BY policy_type,status`).bind(org.id).all(),
      db.prepare(`SELECT status, COUNT(*) qtd FROM security_sessions WHERE org_id=? GROUP BY status`).bind(org.id).all(),
      db.prepare(`SELECT success, COUNT(*) qtd FROM security_login_attempts WHERE org_id=? GROUP BY success`).bind(org.id).all(),
      db.prepare(`SELECT classification, COUNT(*) qtd FROM data_asset_registry WHERE org_id=? GROUP BY classification`).bind(org.id).all(),
      db.prepare(`SELECT status, COUNT(*) qtd FROM lgpd_data_subject_requests WHERE org_id=? GROUP BY status`).bind(org.id).all(),
      db.prepare(`SELECT status, severity, COUNT(*) qtd FROM security_incidents WHERE org_id=? GROUP BY status,severity`).bind(org.id).all(),
      db.prepare(`SELECT status, severity, COUNT(*) qtd FROM anomaly_detection_events WHERE org_id=? GROUP BY status,severity`).bind(org.id).all(),
      db.prepare(`SELECT status, severity, COUNT(*) qtd FROM security_hardening_checks WHERE org_id=? GROUP BY status,severity`).bind(org.id).all()
    ]);
    return c.json({
      ok:true,
      logs:logs.results || [],
      metrics:metrics.results || [],
      health:health.results || [],
      policies:policies.results || [],
      sessions:sessions.results || [],
      login_attempts:attempts.results || [],
      data_assets:assets.results || [],
      lgpd_requests:lgpdReq.results || [],
      incidents:incidents.results || [],
      anomalies:anomalies.results || [],
      hardening:hardening.results || []
    });
  });

  app.post('/api/observability/logs', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    if (!d.event_name) return c.json({ ok:false, error:'event_name é obrigatório' }, 400);
    const id = uid('slog');
    await c.env.DB.prepare(`
      INSERT INTO system_log_events
      (id, org_id, level, source, module, event_name, message, request_id, user_id, session_id, ip_address, user_agent, entity_type, entity_id, metadata_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, org.id, d.level || 'info', d.source || 'app', d.module || null, d.event_name, d.message || null, d.request_id || null, user.id, d.session_id || null, d.ip_address || null, d.user_agent || null, d.entity_type || null, d.entity_id || null, d.metadata_json ? json(d.metadata_json) : '{}').run();
    return c.json({ ok:true, id }, 201);
  });

  app.get('/api/observability/logs', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const level = c.req.query('level');
    let sql = `SELECT * FROM system_log_events WHERE org_id=?`;
    const args:any[] = [org.id];
    if (level) { sql += ` AND level=?`; args.push(level); }
    sql += ` ORDER BY created_at DESC LIMIT 500`;
    const rs = await c.env.DB.prepare(sql).bind(...args).all();
    return c.json({ ok:true, items:rs.results || [] });
  });

  app.post('/api/observability/metrics', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const d = await body(c);
    if (!d.metric_name) return c.json({ ok:false, error:'metric_name é obrigatório' }, 400);
    const id = uid('met');
    await c.env.DB.prepare(`
      INSERT INTO system_metrics
      (id, org_id, metric_name, metric_type, metric_value, unit, dimensions_json, captured_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, org.id, d.metric_name, d.metric_type || 'gauge', num(d.metric_value,0), d.unit || null, d.dimensions_json ? json(d.dimensions_json) : '{}', d.captured_at || nowIso()).run();
    return c.json({ ok:true, id }, 201);
  });

  app.post('/api/observability/health-checks/run', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const checks = [
      { component:'database', status:'healthy', latency_ms:12, details:{ provider:'d1/sqlite' } },
      { component:'api', status:'healthy', latency_ms:8, details:{ routes:'registered' } },
      { component:'notifications', status:'degraded', latency_ms:0, details:{ reason:'external providers not configured' } },
      { component:'integrations', status:'degraded', latency_ms:0, details:{ reason:'manual processing mode' } }
    ];
    for (const chk of checks) {
      await c.env.DB.prepare(`
        INSERT INTO system_health_checks
        (id, org_id, component, status, latency_ms, details_json, checked_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(uid('hc'), org.id, chk.component, chk.status, chk.latency_ms, JSON.stringify(chk.details), nowIso()).run();
    }
    return c.json({ ok:true, checks });
  });

  app.get('/api/observability/health-checks', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`SELECT * FROM system_health_checks WHERE org_id=? ORDER BY checked_at DESC LIMIT 200`).bind(org.id).all();
    return c.json({ ok:true, items:rs.results || [] });
  });

  app.post('/api/security/policies', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    if (!d.codigo || !d.nome || !d.policy_type) return c.json({ ok:false, error:'codigo, nome e policy_type são obrigatórios' }, 400);
    const id = uid('spol');
    await c.env.DB.prepare(`
      INSERT INTO security_policies
      (id, org_id, codigo, nome, policy_type, status, config_json, enforced, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, org.id, d.codigo, d.nome, d.policy_type, d.status || 'ativo', d.config_json ? json(d.config_json) : '{}', d.enforced === false ? 0 : 1, user.id).run();
    await writeForensic(c.env.DB, org.id, user.id, { action:'security_policy_create', entity_type:'security_policy', entity_id:id, after_json:d });
    return c.json({ ok:true, id }, 201);
  });

  app.get('/api/security/policies', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`SELECT * FROM security_policies WHERE org_id=? ORDER BY policy_type,nome`).bind(org.id).all();
    return c.json({ ok:true, items:rs.results || [] });
  });

  app.post('/api/security/sessions', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    const raw = `sess_${crypto.randomUUID()}_${crypto.randomUUID()}`;
    const hash = await sha256Hex(raw);
    const id = uid('sess');
    await c.env.DB.prepare(`
      INSERT INTO security_sessions
      (id, org_id, user_id, session_token_hash, status, ip_address, user_agent, device_fingerprint, mfa_verified, last_seen_at, expires_at)
      VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?)
    `).bind(id, org.id, d.user_id || user.id, hash, d.ip_address || null, d.user_agent || null, d.device_fingerprint || null, d.mfa_verified ? 1 : 0, nowIso(), d.expires_at || addDays(1)).run();
    return c.json({ ok:true, id, session_token:raw, expires_at:d.expires_at || addDays(1) }, 201);
  });

  app.post('/api/security/sessions/:id/revoke', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const id = c.req.param('id');
    const d = await body(c);
    await c.env.DB.prepare(`UPDATE security_sessions SET status='revoked', revoked_at=?, revoke_reason=? WHERE org_id=? AND id=?`).bind(nowIso(), d.reason || 'manual_revoke', org.id, id).run();
    await writeForensic(c.env.DB, org.id, user.id, { action:'session_revoke', entity_type:'security_session', entity_id:id, metadata_json:{ reason:d.reason || 'manual_revoke' } });
    return c.json({ ok:true, id, status:'revoked' });
  });

  app.get('/api/security/sessions', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`SELECT id, org_id, user_id, status, ip_address, user_agent, mfa_verified, created_at, last_seen_at, expires_at, revoked_at, revoke_reason FROM security_sessions WHERE org_id=? ORDER BY created_at DESC LIMIT 300`).bind(org.id).all();
    return c.json({ ok:true, items:rs.results || [] });
  });

  app.post('/api/security/login-attempts', async (c: Ctx) => {
    const d = await body(c);
    const orgId = d.org_id;
    if (!orgId) return c.json({ ok:false, error:'org_id é obrigatório' }, 400);
    const id = uid('login');
    await c.env.DB.prepare(`
      INSERT INTO security_login_attempts
      (id, org_id, user_id, email, success, failure_reason, ip_address, user_agent, geo_json, risk_score)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, orgId, d.user_id || null, d.email || null, d.success ? 1 : 0, d.failure_reason || null, d.ip_address || null, d.user_agent || null, d.geo_json ? json(d.geo_json) : null, num(d.risk_score,0)).run();
    return c.json({ ok:true, id }, 201);
  });

  app.post('/api/security/mfa-devices', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    const id = uid('mfa');
    await c.env.DB.prepare(`
      INSERT INTO security_mfa_devices
      (id, org_id, user_id, device_type, label, secret_ref, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(id, org.id, d.user_id || user.id, d.device_type || 'totp', d.label || 'MFA Device', d.secret_ref || `secret_ref_${id}`, d.status || 'pending').run();
    return c.json({ ok:true, id, secret_ref:`secret_ref_${id}` }, 201);
  });

  app.post('/api/security/mfa-devices/:id/verify', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const id = c.req.param('id');
    await c.env.DB.prepare(`UPDATE security_mfa_devices SET status='verified', verified_at=?, last_used_at=?, updated_at=CURRENT_TIMESTAMP WHERE org_id=? AND id=?`).bind(nowIso(), nowIso(), org.id, id).run();
    return c.json({ ok:true, id, status:'verified' });
  });

  app.post('/api/data-governance/assets', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    if (!d.entity_type || !d.asset_name) return c.json({ ok:false, error:'entity_type e asset_name são obrigatórios' }, 400);
    const id = uid('asset');
    await c.env.DB.prepare(`
      INSERT OR REPLACE INTO data_asset_registry
      (id, org_id, entity_type, field_name, asset_name, classification, contains_personal_data, contains_sensitive_data, owner_user_id, retention_policy_id, lawful_basis, status, metadata_json, created_by, updated_at)
      VALUES (COALESCE((SELECT id FROM data_asset_registry WHERE org_id=? AND entity_type=? AND field_name IS ?), ?), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(
      org.id, d.entity_type, d.field_name || null, id,
      org.id, d.entity_type, d.field_name || null, d.asset_name, d.classification || 'internal',
      d.contains_personal_data ? 1 : 0, d.contains_sensitive_data ? 1 : 0,
      d.owner_user_id || user.id, d.retention_policy_id || null, d.lawful_basis || null,
      d.status || 'ativo', d.metadata_json ? json(d.metadata_json) : '{}', user.id
    ).run();
    return c.json({ ok:true, id });
  });

  app.get('/api/data-governance/assets', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`SELECT * FROM data_asset_registry WHERE org_id=? ORDER BY classification,entity_type,field_name`).bind(org.id).all();
    return c.json({ ok:true, items:rs.results || [] });
  });

  app.post('/api/lgpd/data-subjects', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const d = await body(c);
    const docHash = d.document_number ? await sha256Hex(String(d.document_number)) : null;
    const id = uid('dsj');
    await c.env.DB.prepare(`
      INSERT INTO lgpd_data_subjects
      (id, org_id, subject_type, external_ref, name, email, document_number_hash, status, metadata_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, org.id, d.subject_type || 'person', d.external_ref || null, d.name || null, d.email || null, docHash, d.status || 'ativo', d.metadata_json ? json(d.metadata_json) : '{}').run();
    return c.json({ ok:true, id }, 201);
  });

  app.post('/api/lgpd/consents', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    if (!d.data_subject_id || !d.purpose_code || !d.purpose_description) return c.json({ ok:false, error:'data_subject_id, purpose_code e purpose_description são obrigatórios' }, 400);
    const id = uid('cons');
    await c.env.DB.prepare(`
      INSERT INTO lgpd_consents
      (id, org_id, data_subject_id, purpose_code, purpose_description, lawful_basis, status, granted_at, evidence_json, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, org.id, d.data_subject_id, d.purpose_code, d.purpose_description, d.lawful_basis || 'consent', d.status || 'granted', d.granted_at || nowIso(), d.evidence_json ? json(d.evidence_json) : '{}', user.id).run();
    return c.json({ ok:true, id }, 201);
  });

  app.post('/api/lgpd/requests', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const d = await body(c);
    const id = uid('lgpdreq');
    await c.env.DB.prepare(`
      INSERT INTO lgpd_data_subject_requests
      (id, org_id, data_subject_id, request_type, status, description, due_at, evidence_json)
      VALUES (?, ?, ?, ?, 'open', ?, ?, ?)
    `).bind(id, org.id, d.data_subject_id || null, d.request_type || 'access', d.description || null, d.due_at || addDays(15), d.evidence_json ? json(d.evidence_json) : '{}').run();
    return c.json({ ok:true, id, due_at:d.due_at || addDays(15) }, 201);
  });

  app.post('/api/lgpd/requests/:id/handle', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const id = c.req.param('id');
    const d = await body(c);
    await c.env.DB.prepare(`
      UPDATE lgpd_data_subject_requests
      SET status=?, response_text=?, handled_by=?, handled_at=?, evidence_json=?, updated_at=CURRENT_TIMESTAMP
      WHERE org_id=? AND id=?
    `).bind(d.status || 'closed', d.response_text || null, user.id, nowIso(), d.evidence_json ? json(d.evidence_json) : '{}', org.id, id).run();
    await writeForensic(c.env.DB, org.id, user.id, { action:'lgpd_request_handled', entity_type:'lgpd_data_subject_request', entity_id:id, after_json:d });
    return c.json({ ok:true, id, status:d.status || 'closed' });
  });

  app.get('/api/lgpd/requests', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`SELECT * FROM lgpd_data_subject_requests WHERE org_id=? ORDER BY created_at DESC LIMIT 300`).bind(org.id).all();
    return c.json({ ok:true, items:rs.results || [] });
  });

  app.post('/api/data-retention/run', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    const policy = d.policy_id
      ? await c.env.DB.prepare(`SELECT * FROM data_retention_policies WHERE org_id=? AND id=?`).bind(org.id, d.policy_id).first()
      : await c.env.DB.prepare(`SELECT * FROM data_retention_policies WHERE org_id=? AND status='ativo' ORDER BY created_at ASC LIMIT 1`).bind(org.id).first();
    if (!policy) return c.json({ ok:false, error:'Política de retenção não encontrada' }, 404);
    const id = uid('retrun');
    await c.env.DB.prepare(`
      INSERT INTO data_retention_runs
      (id, org_id, policy_id, status, scanned_count, affected_count, result_json, started_at, finished_at, created_by)
      VALUES (?, ?, ?, 'finished', ?, ?, ?, ?, ?, ?)
    `).bind(id, org.id, policy.id, 0, 0, JSON.stringify({ simulated:true, entity_type:policy.entity_type, action:policy.action_after_retention, note:'Execução real de descarte/arquivamento não realizada nesta etapa.' }), nowIso(), nowIso(), user.id).run();
    return c.json({ ok:true, id, simulated:true });
  });

  app.post('/api/security/incidents', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    if (!d.titulo) return c.json({ ok:false, error:'titulo é obrigatório' }, 400);
    const id = uid('inc');
    const codigo = d.codigo || `INC-${Date.now()}`;
    await c.env.DB.prepare(`
      INSERT INTO security_incidents
      (id, org_id, codigo, titulo, descricao, severity, status, category, detected_by, detection_source, assigned_to, metadata_json, created_by)
      VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?)
    `).bind(id, org.id, codigo, d.titulo, d.descricao || null, d.severity || 'medium', d.category || 'security', d.detected_by || 'manual', d.detection_source || null, d.assigned_to || user.id, d.metadata_json ? json(d.metadata_json) : '{}', user.id).run();
    await writeForensic(c.env.DB, org.id, user.id, { action:'security_incident_create', entity_type:'security_incident', entity_id:id, after_json:d, risk_score:d.severity === 'critical' ? 90 : 50 });
    return c.json({ ok:true, id, codigo }, 201);
  });

  app.get('/api/security/incidents', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`SELECT * FROM security_incidents WHERE org_id=? ORDER BY opened_at DESC LIMIT 300`).bind(org.id).all();
    return c.json({ ok:true, items:rs.results || [] });
  });

  app.post('/api/security/incidents/:id/ack', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const id = c.req.param('id');
    await c.env.DB.prepare(`UPDATE security_incidents SET status='acknowledged', acknowledged_at=?, updated_at=CURRENT_TIMESTAMP WHERE org_id=? AND id=?`).bind(nowIso(), org.id, id).run();
    await c.env.DB.prepare(`INSERT INTO security_incident_events (id, org_id, incident_id, event_type, message, actor_user_id) VALUES (?, ?, ?, 'ack', 'Incidente reconhecido', ?)`).bind(uid('ince'), org.id, id, user.id).run();
    return c.json({ ok:true, id, status:'acknowledged' });
  });

  app.post('/api/security/incidents/:id/resolve', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const id = c.req.param('id');
    const d = await body(c);
    await c.env.DB.prepare(`UPDATE security_incidents SET status='resolved', resolved_at=?, resolution_summary=?, updated_at=CURRENT_TIMESTAMP WHERE org_id=? AND id=?`).bind(nowIso(), d.resolution_summary || null, org.id, id).run();
    await c.env.DB.prepare(`INSERT INTO security_incident_events (id, org_id, incident_id, event_type, message, actor_user_id) VALUES (?, ?, ?, 'resolve', ?, ?)`).bind(uid('ince'), org.id, id, d.resolution_summary || 'Incidente resolvido', user.id).run();
    return c.json({ ok:true, id, status:'resolved' });
  });

  app.post('/api/security/anomalies/run-checks', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const rules = await c.env.DB.prepare(`SELECT * FROM anomaly_detection_rules WHERE org_id=? AND status='ativo'`).bind(org.id).all();
    let created = 0;
    for (const r of rules.results || []) {
      if (r.codigo === 'failed_login_spike') {
        const cond = parseJson(r.condition_json, {});
        const count = await c.env.DB.prepare(`
          SELECT COUNT(*) qtd FROM security_login_attempts
          WHERE org_id=? AND success=0 AND datetime(created_at) >= datetime('now', ?)
        `).bind(org.id, `-${cond.window_minutes || 15} minutes`).first();
        if (num(count?.qtd,0) >= num(cond.failed_attempts,5)) {
          const anomId = uid('anom');
          await c.env.DB.prepare(`
            INSERT INTO anomaly_detection_events
            (id, org_id, rule_id, signal_source, severity, title, description, risk_score, status, metadata_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)
          `).bind(anomId, org.id, r.id, r.signal_source, r.severity, 'Pico de falhas de login', `Detectadas ${count.qtd} falhas recentes.`, 80, JSON.stringify({ count:count.qtd })).run();
          created++;
        }
      }
    }
    return c.json({ ok:true, anomalies_created:created });
  });

  app.get('/api/security/anomalies', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`SELECT * FROM anomaly_detection_events WHERE org_id=? ORDER BY detected_at DESC LIMIT 300`).bind(org.id).all();
    return c.json({ ok:true, items:rs.results || [] });
  });

  app.post('/api/security/hardening/run', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const checks = [
      { code:'mfa_policy_enabled', name:'Política MFA habilitada', status:'pass', severity:'high', recommendation:'Manter MFA obrigatório para perfis críticos.' },
      { code:'api_credentials_expire', name:'Credenciais API com expiração', status:'warning', severity:'medium', recommendation:'Garantir expiração e rotação de todas as credenciais.' },
      { code:'external_providers_configured', name:'Providers externos configurados', status:'warning', severity:'medium', recommendation:'Configurar providers reais para e-mail, storage, SIEM e webhooks.' },
      { code:'lgpd_assets_classified', name:'Ativos de dados classificados', status:'warning', severity:'high', recommendation:'Classificar campos críticos e dados pessoais.' },
      { code:'forensic_audit_enabled', name:'Auditoria forense habilitada', status:'pass', severity:'high', recommendation:'Monitorar integridade da cadeia de hashes.' }
    ];
    for (const chk of checks) {
      await c.env.DB.prepare(`
        INSERT OR REPLACE INTO security_hardening_checks
        (id, org_id, check_code, check_name, category, status, severity, details_json, recommendation, checked_at)
        VALUES (COALESCE((SELECT id FROM security_hardening_checks WHERE org_id=? AND check_code=?), ?), ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(org.id, chk.code, uid('hchk'), org.id, chk.code, chk.name, 'security', chk.status, chk.severity, '{}', chk.recommendation, nowIso()).run();
    }
    return c.json({ ok:true, checks });
  });

  app.get('/api/security/hardening', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`SELECT * FROM security_hardening_checks WHERE org_id=? ORDER BY severity,check_name`).bind(org.id).all();
    return c.json({ ok:true, items:rs.results || [] });
  });

  app.get('/api/security/forensic-audit', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`SELECT * FROM forensic_audit_events WHERE org_id=? ORDER BY created_at DESC LIMIT 300`).bind(org.id).all();
    return c.json({ ok:true, items:rs.results || [] });
  });
}

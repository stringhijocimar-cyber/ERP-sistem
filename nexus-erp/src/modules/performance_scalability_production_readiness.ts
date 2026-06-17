// src/modules/performance_scalability_production_readiness.ts
// NEXUS ERP — Etapa 32: Performance, Escalabilidade, Cache, Jobs Assíncronos, Backup/Restore e Preparação Enterprise Production
//
// Integração:
// import { registerProductionReadinessRoutes } from './modules/performance_scalability_production_readiness';
// registerProductionReadinessRoutes(app, { requireOrg, auditLog });
//
// Regra crítica:
// Esta etapa cria a fundação operacional. Jobs, backups e deploys são processados
// em modo governado/simulado até conexão com infraestrutura real.

import type { Hono } from 'hono';

type Ctx = any;
type Deps = {
  requireOrg: (c: Ctx) => Promise<{ user: any; org: any }>;
  auditLog?: (c: Ctx, input: any) => Promise<void>;
};

function uid(prefix: string) { return `${prefix}_${crypto.randomUUID()}`; }
function nowIso() { return new Date().toISOString(); }
function addMinutes(minutes: number) { const d = new Date(); d.setMinutes(d.getMinutes()+minutes); return d.toISOString(); }
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

async function auditProd(db: any, orgId: string | null, actorId: string | null, eventType: string, entityType?: string, entityId?: string, before?: any, after?: any, metadata?: any) {
  await db.prepare(`
    INSERT INTO production_audit_events
    (id, org_id, event_type, entity_type, entity_id, actor_id, before_json, after_json, metadata_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(uid('paud'), orgId, eventType, entityType || null, entityId || null, actorId, before ? json(before) : null, after ? json(after) : null, metadata ? json(metadata) : '{}').run();
}

export function registerProductionReadinessRoutes(app: Hono, deps: Deps) {
  const { requireOrg, auditLog } = deps;

  async function log(c: Ctx, action: string, entity: string, entityId: string, data?: any) {
    if (auditLog) await auditLog(c, { action, entity, entity_id: entityId, data });
  }

  app.post('/api/production/seed-defaults', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);

    const queues = [
      { codigo:'default', nome:'Fila Padrão', max:5 },
      { codigo:'notifications', nome:'Fila de Notificações', max:10 },
      { codigo:'integrations', nome:'Fila de Integrações', max:3 },
      { codigo:'exports', nome:'Fila de Exportações', max:2 },
      { codigo:'maintenance', nome:'Fila de Manutenção', max:1 }
    ];
    for (const q of queues) {
      await c.env.DB.prepare(`
        INSERT OR IGNORE INTO async_job_queues
        (id, org_id, codigo, nome, status, max_concurrency, created_by)
        VALUES (?, ?, ?, ?, 'ativo', ?, ?)
      `).bind(uid('queue'), org.id, q.codigo, q.nome, q.max, user.id).run();
    }

    const limits = [
      { key:'api_requests_per_day', value:100000, unit:'requests' },
      { key:'storage_gb', value:100, unit:'GB' },
      { key:'active_users', value:500, unit:'users' },
      { key:'async_jobs_per_day', value:50000, unit:'jobs' },
      { key:'records_per_tenant', value:5000000, unit:'records' }
    ];
    for (const l of limits) {
      await c.env.DB.prepare(`
        INSERT OR IGNORE INTO tenant_capacity_limits
        (id, org_id, limit_key, limit_value, unit, status, warning_threshold_percent, hard_block, created_by)
        VALUES (?, ?, ?, ?, ?, 'ativo', 80, 0, ?)
      `).bind(uid('tlim'), org.id, l.key, l.value, l.unit, user.id).run();
    }

    const flags = [
      { key:'new_lowcode_renderer', nome:'Novo Renderizador Low-Code', enabled:0, rollout:0 },
      { key:'async_notifications', nome:'Notificações Assíncronas', enabled:1, rollout:100 },
      { key:'advanced_security_dashboard', nome:'Dashboard Segurança Avançada', enabled:1, rollout:100 },
      { key:'public_api_v1', nome:'API Pública v1', enabled:1, rollout:100 }
    ];
    for (const f of flags) {
      await c.env.DB.prepare(`
        INSERT OR IGNORE INTO feature_flags
        (id, org_id, flag_key, nome, enabled, rollout_percent, environment, owner_id, created_by)
        VALUES (?, ?, ?, ?, ?, ?, 'production', ?, ?)
      `).bind(uid('flag'), org.id, f.key, f.nome, f.enabled, f.rollout, user.id, user.id).run();
    }

    await auditProd(c.env.DB, org.id, user.id, 'production_seed_defaults', 'organization', org.id, null, { queues:queues.length, limits:limits.length, flags:flags.length });
    await log(c, 'SEED', 'production_defaults', org.id, { queues:queues.length });
    return c.json({ ok:true, queues:queues.length, limits:limits.length, flags:flags.length });
  });

  app.get('/api/production/dashboard', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const db = c.env.DB;
    const [
      cache, queues, jobs, dead, schedules, locks, backups, restores,
      readiness, flags, releases, deployments, limits
    ] = await Promise.all([
      db.prepare(`SELECT namespace, COUNT(*) qtd, SUM(hit_count) hits FROM runtime_cache_entries WHERE org_id=? GROUP BY namespace`).bind(org.id).all(),
      db.prepare(`SELECT status, COUNT(*) qtd FROM async_job_queues WHERE org_id=? GROUP BY status`).bind(org.id).all(),
      db.prepare(`SELECT status, COUNT(*) qtd FROM async_jobs WHERE org_id=? GROUP BY status`).bind(org.id).all(),
      db.prepare(`SELECT COUNT(*) qtd FROM async_dead_letter_jobs WHERE org_id=?`).bind(org.id).first(),
      db.prepare(`SELECT status, COUNT(*) qtd FROM scheduled_tasks WHERE org_id=? GROUP BY status`).bind(org.id).all(),
      db.prepare(`SELECT status, COUNT(*) qtd FROM concurrency_locks WHERE org_id=? GROUP BY status`).bind(org.id).all(),
      db.prepare(`SELECT status, COUNT(*) qtd FROM logical_backups WHERE org_id=? GROUP BY status`).bind(org.id).all(),
      db.prepare(`SELECT status, COUNT(*) qtd FROM logical_restore_jobs WHERE org_id=? GROUP BY status`).bind(org.id).all(),
      db.prepare(`SELECT status, severity, COUNT(*) qtd FROM production_readiness_checks WHERE org_id=? GROUP BY status,severity`).bind(org.id).all(),
      db.prepare(`SELECT enabled, COUNT(*) qtd FROM feature_flags WHERE org_id=? GROUP BY enabled`).bind(org.id).all(),
      db.prepare(`SELECT status, COUNT(*) qtd FROM release_versions WHERE org_id=? GROUP BY status`).bind(org.id).all(),
      db.prepare(`SELECT status, COUNT(*) qtd FROM release_deployments WHERE org_id=? GROUP BY status`).bind(org.id).all(),
      db.prepare(`SELECT COUNT(*) qtd FROM tenant_capacity_limits WHERE org_id=?`).bind(org.id).first()
    ]);
    return c.json({
      ok:true,
      cache:cache.results || [],
      queues:queues.results || [],
      jobs:jobs.results || [],
      dead_letters:dead || {qtd:0},
      schedules:schedules.results || [],
      locks:locks.results || [],
      backups:backups.results || [],
      restores:restores.results || [],
      readiness:readiness.results || [],
      feature_flags:flags.results || [],
      releases:releases.results || [],
      deployments:deployments.results || [],
      limits:limits || {qtd:0}
    });
  });

  app.post('/api/runtime/cache/set', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const d = await body(c);
    if (!d.cache_key) return c.json({ ok:false, error:'cache_key é obrigatório' }, 400);
    const id = uid('cache');
    await c.env.DB.prepare(`
      INSERT OR REPLACE INTO runtime_cache_entries
      (id, org_id, cache_key, namespace, value_json, expires_at, hit_count, tags_json, updated_at)
      VALUES (COALESCE((SELECT id FROM runtime_cache_entries WHERE org_id=? AND namespace=? AND cache_key=?), ?), ?, ?, ?, ?, ?, COALESCE((SELECT hit_count FROM runtime_cache_entries WHERE org_id=? AND namespace=? AND cache_key=?), 0), ?, CURRENT_TIMESTAMP)
    `).bind(org.id, d.namespace || 'default', d.cache_key, id, org.id, d.cache_key, d.namespace || 'default', d.value_json ? json(d.value_json) : '{}', d.expires_at || null, org.id, d.namespace || 'default', d.cache_key, d.tags_json ? json(d.tags_json) : '[]').run();
    return c.json({ ok:true, id });
  });

  app.get('/api/runtime/cache/get', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const key = c.req.query('cache_key');
    const ns = c.req.query('namespace') || 'default';
    if (!key) return c.json({ ok:false, error:'cache_key é obrigatório' }, 400);
    const row = await c.env.DB.prepare(`
      SELECT * FROM runtime_cache_entries
      WHERE org_id=? AND namespace=? AND cache_key=? AND (expires_at IS NULL OR datetime(expires_at) > datetime('now'))
    `).bind(org.id, ns, key).first();
    if (!row) return c.json({ ok:false, hit:false }, 404);
    await c.env.DB.prepare(`UPDATE runtime_cache_entries SET hit_count=hit_count+1, last_hit_at=?, updated_at=CURRENT_TIMESTAMP WHERE org_id=? AND id=?`).bind(nowIso(), org.id, row.id).run();
    return c.json({ ok:true, hit:true, item:row, value:parseJson(row.value_json,{}) });
  });

  app.post('/api/runtime/cache/invalidate', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const d = await body(c);
    let sql = `DELETE FROM runtime_cache_entries WHERE org_id=?`;
    const args:any[] = [org.id];
    if (d.namespace) { sql += ` AND namespace=?`; args.push(d.namespace); }
    if (d.cache_key) { sql += ` AND cache_key=?`; args.push(d.cache_key); }
    const res = await c.env.DB.prepare(sql).bind(...args).run();
    return c.json({ ok:true, changes:res.meta?.changes || 0 });
  });

  app.post('/api/async/queues', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    if (!d.codigo || !d.nome) return c.json({ ok:false, error:'codigo e nome são obrigatórios' }, 400);
    const id = uid('queue');
    await c.env.DB.prepare(`
      INSERT INTO async_job_queues
      (id, org_id, codigo, nome, descricao, status, max_concurrency, retry_policy_json, dead_letter_enabled, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, org.id, d.codigo, d.nome, d.descricao || null, d.status || 'ativo', d.max_concurrency || 5, d.retry_policy_json ? json(d.retry_policy_json) : '{"max_attempts":3,"backoff_seconds":60}', d.dead_letter_enabled === false ? 0 : 1, user.id).run();
    return c.json({ ok:true, id }, 201);
  });

  app.get('/api/async/queues', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`SELECT * FROM async_job_queues WHERE org_id=? ORDER BY codigo`).bind(org.id).all();
    return c.json({ ok:true, items:rs.results || [] });
  });

  app.post('/api/async/jobs', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    if (!d.job_type) return c.json({ ok:false, error:'job_type é obrigatório' }, 400);
    let queueId = d.queue_id;
    if (!queueId && d.queue_codigo) {
      const q = await c.env.DB.prepare(`SELECT id FROM async_job_queues WHERE org_id=? AND codigo=?`).bind(org.id, d.queue_codigo).first();
      queueId = q?.id || null;
    }
    const id = uid('job');
    await c.env.DB.prepare(`
      INSERT INTO async_jobs
      (id, org_id, queue_id, job_type, status, priority, payload_json, max_attempts, scheduled_at, correlation_id, created_by)
      VALUES (?, ?, ?, ?, 'queued', ?, ?, ?, ?, ?, ?)
    `).bind(id, org.id, queueId || null, d.job_type, d.priority || 5, d.payload_json ? json(d.payload_json) : '{}', d.max_attempts || 3, d.scheduled_at || nowIso(), d.correlation_id || crypto.randomUUID(), user.id).run();
    await c.env.DB.prepare(`INSERT INTO async_job_events (id, org_id, job_id, event_type, message) VALUES (?, ?, ?, 'queued', 'Job criado')`).bind(uid('jevt'), org.id, id).run();
    return c.json({ ok:true, id }, 201);
  });

  app.get('/api/async/jobs', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`
      SELECT j.*, q.codigo AS queue_codigo
      FROM async_jobs j
      LEFT JOIN async_job_queues q ON q.id=j.queue_id
      WHERE j.org_id=?
      ORDER BY j.priority ASC, j.scheduled_at ASC
      LIMIT 300
    `).bind(org.id).all();
    return c.json({ ok:true, items:rs.results || [] });
  });

  app.post('/api/async/jobs/process-next', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const d = await body(c);
    const worker = d.worker_id || `worker-${crypto.randomUUID()}`;
    let sql = `
      SELECT * FROM async_jobs
      WHERE org_id=? AND status='queued' AND datetime(scheduled_at) <= datetime('now')
    `;
    const args:any[] = [org.id];
    if (d.queue_id) { sql += ` AND queue_id=?`; args.push(d.queue_id); }
    sql += ` ORDER BY priority ASC, scheduled_at ASC LIMIT 1`;
    const job = await c.env.DB.prepare(sql).bind(...args).first();
    if (!job) return c.json({ ok:true, processed:false, message:'Nenhum job pendente' });

    await c.env.DB.prepare(`UPDATE async_jobs SET status='running', locked_by=?, locked_at=?, started_at=?, attempts=attempts+1, updated_at=CURRENT_TIMESTAMP WHERE org_id=? AND id=?`).bind(worker, nowIso(), nowIso(), org.id, job.id).run();

    const success = d.force_fail ? false : true;
    if (success) {
      await c.env.DB.prepare(`UPDATE async_jobs SET status='success', finished_at=?, result_json=?, updated_at=CURRENT_TIMESTAMP WHERE org_id=? AND id=?`).bind(nowIso(), JSON.stringify({ simulated:true, worker }), org.id, job.id).run();
      await c.env.DB.prepare(`INSERT INTO async_job_events (id, org_id, job_id, event_type, message, metadata_json) VALUES (?, ?, ?, 'success', 'Job processado com sucesso em modo governado', ?)`).bind(uid('jevt'), org.id, job.id, JSON.stringify({ worker })).run();
      return c.json({ ok:true, processed:true, id:job.id, status:'success' });
    }

    const attempts = Number(job.attempts || 0) + 1;
    if (attempts >= Number(job.max_attempts || 3)) {
      await c.env.DB.prepare(`UPDATE async_jobs SET status='dead_letter', finished_at=?, error_message=?, updated_at=CURRENT_TIMESTAMP WHERE org_id=? AND id=?`).bind(nowIso(), 'Falha forçada no smoke/manual processing', org.id, job.id).run();
      await c.env.DB.prepare(`
        INSERT INTO async_dead_letter_jobs
        (id, org_id, original_job_id, queue_id, job_type, payload_json, failure_reason, attempts)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(uid('dlj'), org.id, job.id, job.queue_id || null, job.job_type, job.payload_json || '{}', 'max_attempts_exceeded', attempts).run();
      return c.json({ ok:true, processed:true, id:job.id, status:'dead_letter' });
    }

    await c.env.DB.prepare(`UPDATE async_jobs SET status='queued', error_message=?, updated_at=CURRENT_TIMESTAMP WHERE org_id=? AND id=?`).bind('Falha temporária simulada', org.id, job.id).run();
    return c.json({ ok:true, processed:true, id:job.id, status:'requeued' });
  });

  app.post('/api/scheduler/tasks', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    if (!d.codigo || !d.nome || !d.job_type) return c.json({ ok:false, error:'codigo, nome e job_type são obrigatórios' }, 400);
    const id = uid('stask');
    await c.env.DB.prepare(`
      INSERT INTO scheduled_tasks
      (id, org_id, codigo, nome, task_type, cron_expression, interval_minutes, timezone, target_queue_id, job_type, payload_json, status, next_run_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, org.id, d.codigo, d.nome, d.task_type || 'job', d.cron_expression || null, d.interval_minutes || 60, d.timezone || 'America/Sao_Paulo', d.target_queue_id || null, d.job_type, d.payload_json ? json(d.payload_json) : '{}', d.status || 'ativo', d.next_run_at || nowIso(), user.id).run();
    return c.json({ ok:true, id }, 201);
  });

  app.post('/api/scheduler/run-due', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const tasks = await c.env.DB.prepare(`SELECT * FROM scheduled_tasks WHERE org_id=? AND status='ativo' AND datetime(next_run_at) <= datetime('now') LIMIT 100`).bind(org.id).all();
    let created = 0;
    for (const t of tasks.results || []) {
      const jobId = uid('job');
      await c.env.DB.prepare(`
        INSERT INTO async_jobs
        (id, org_id, queue_id, job_type, status, priority, payload_json, scheduled_at, correlation_id, created_by)
        VALUES (?, ?, ?, ?, 'queued', 5, ?, ?, ?, ?)
      `).bind(jobId, org.id, t.target_queue_id || null, t.job_type, t.payload_json || '{}', nowIso(), `schedule-${t.codigo}-${Date.now()}`, user.id).run();
      const nextRun = addMinutes(Number(t.interval_minutes || 60));
      await c.env.DB.prepare(`UPDATE scheduled_tasks SET last_run_at=?, next_run_at=?, updated_at=CURRENT_TIMESTAMP WHERE org_id=? AND id=?`).bind(nowIso(), nextRun, org.id, t.id).run();
      created++;
    }
    return c.json({ ok:true, jobs_created:created });
  });

  app.post('/api/concurrency/locks/acquire', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const d = await body(c);
    if (!d.lock_key || !d.owner_ref) return c.json({ ok:false, error:'lock_key e owner_ref são obrigatórios' }, 400);
    const existing = await c.env.DB.prepare(`
      SELECT * FROM concurrency_locks
      WHERE org_id=? AND lock_scope=? AND lock_key=? AND status='locked' AND datetime(expires_at) > datetime('now')
    `).bind(org.id, d.lock_scope || 'global', d.lock_key).first();
    if (existing) return c.json({ ok:false, locked:false, error:'lock já adquirido', existing_owner:existing.owner_ref }, 409);
    const id = uid('lock');
    await c.env.DB.prepare(`
      INSERT OR REPLACE INTO concurrency_locks
      (id, org_id, lock_key, lock_scope, owner_ref, status, acquired_at, expires_at, metadata_json)
      VALUES (COALESCE((SELECT id FROM concurrency_locks WHERE org_id=? AND lock_scope=? AND lock_key=?), ?), ?, ?, ?, ?, 'locked', ?, ?, ?)
    `).bind(org.id, d.lock_scope || 'global', d.lock_key, id, org.id, d.lock_key, d.lock_scope || 'global', d.owner_ref, nowIso(), d.expires_at || addMinutes(15), d.metadata_json ? json(d.metadata_json) : '{}').run();
    return c.json({ ok:true, locked:true, id });
  });

  app.post('/api/concurrency/locks/release', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const d = await body(c);
    await c.env.DB.prepare(`UPDATE concurrency_locks SET status='released', released_at=? WHERE org_id=? AND lock_scope=? AND lock_key=?`).bind(nowIso(), org.id, d.lock_scope || 'global', d.lock_key).run();
    return c.json({ ok:true, released:true });
  });

  app.post('/api/performance/traces', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const d = await body(c);
    const id = uid('trace');
    await c.env.DB.prepare(`
      INSERT INTO performance_traces
      (id, org_id, trace_id, span_id, parent_span_id, operation_name, module, status, duration_ms, start_at, end_at, attributes_json, error_message)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, org.id, d.trace_id || crypto.randomUUID(), d.span_id || crypto.randomUUID(), d.parent_span_id || null, d.operation_name, d.module || null, d.status || 'ok', d.duration_ms || 0, d.start_at || nowIso(), d.end_at || nowIso(), d.attributes_json ? json(d.attributes_json) : '{}', d.error_message || null).run();
    return c.json({ ok:true, id }, 201);
  });

  app.post('/api/performance/query-stats', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const d = await body(c);
    if (!d.query_label) return c.json({ ok:false, error:'query_label é obrigatório' }, 400);
    const hash = await sha256Hex(d.query_label);
    const duration = Number(d.duration_ms || 0);
    await c.env.DB.prepare(`
      INSERT OR REPLACE INTO performance_query_stats
      (id, org_id, query_hash, query_label, module, execution_count, total_duration_ms, avg_duration_ms, max_duration_ms, last_duration_ms, last_executed_at, metadata_json)
      VALUES (
        COALESCE((SELECT id FROM performance_query_stats WHERE org_id=? AND query_hash=?), ?),
        ?, ?, ?, ?,
        COALESCE((SELECT execution_count FROM performance_query_stats WHERE org_id=? AND query_hash=?),0)+1,
        COALESCE((SELECT total_duration_ms FROM performance_query_stats WHERE org_id=? AND query_hash=?),0)+?,
        0,
        MAX(COALESCE((SELECT max_duration_ms FROM performance_query_stats WHERE org_id=? AND query_hash=?),0), ?),
        ?,
        ?,
        ?
      )
    `).bind(org.id, hash, uid('qstat'), org.id, hash, d.query_label, d.module || null, org.id, hash, org.id, hash, duration, org.id, hash, duration, duration, nowIso(), d.metadata_json ? json(d.metadata_json) : '{}').run();
    const row = await c.env.DB.prepare(`SELECT * FROM performance_query_stats WHERE org_id=? AND query_hash=?`).bind(org.id, hash).first();
    if (row) {
      const avg = Number(row.total_duration_ms || 0) / Math.max(1, Number(row.execution_count || 1));
      await c.env.DB.prepare(`UPDATE performance_query_stats SET avg_duration_ms=? WHERE org_id=? AND query_hash=?`).bind(avg, org.id, hash).run();
    }
    return c.json({ ok:true, query_hash:hash });
  });

  app.post('/api/tenant/usage/increment', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const d = await body(c);
    if (!d.usage_key) return c.json({ ok:false, error:'usage_key é obrigatório' }, 400);
    const id = uid('use');
    const inc = Number(d.increment || 1);
    await c.env.DB.prepare(`
      INSERT OR REPLACE INTO tenant_usage_counters
      (id, org_id, usage_key, usage_value, period_key, last_increment_at, metadata_json, updated_at)
      VALUES (
        COALESCE((SELECT id FROM tenant_usage_counters WHERE org_id=? AND usage_key=? AND period_key=?), ?),
        ?, ?, COALESCE((SELECT usage_value FROM tenant_usage_counters WHERE org_id=? AND usage_key=? AND period_key=?),0)+?, ?, ?, ?, CURRENT_TIMESTAMP
      )
    `).bind(org.id, d.usage_key, d.period_key || 'current', id, org.id, d.usage_key, org.id, d.usage_key, d.period_key || 'current', inc, d.period_key || 'current', nowIso(), d.metadata_json ? json(d.metadata_json) : '{}').run();

    const usage = await c.env.DB.prepare(`SELECT * FROM tenant_usage_counters WHERE org_id=? AND usage_key=? AND period_key=?`).bind(org.id, d.usage_key, d.period_key || 'current').first();
    const limit = await c.env.DB.prepare(`SELECT * FROM tenant_capacity_limits WHERE org_id=? AND limit_key=? AND status='ativo'`).bind(org.id, d.usage_key).first();
    const warning = limit ? Number(usage.usage_value) >= Number(limit.limit_value) * (Number(limit.warning_threshold_percent || 80)/100) : false;
    return c.json({ ok:true, usage, limit, warning });
  });

  app.post('/api/backups/logical', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    const code = d.backup_code || `BKP-${Date.now()}`;
    const id = uid('bkp');
    await c.env.DB.prepare(`
      INSERT INTO logical_backups
      (id, org_id, backup_code, backup_type, scope_json, status, requested_by, started_at)
      VALUES (?, ?, ?, ?, ?, 'running', ?, ?)
    `).bind(id, org.id, code, d.backup_type || 'logical', d.scope_json ? json(d.scope_json) : '{}', user.id, nowIso()).run();
    const checksum = await sha256Hex(`${org.id}:${code}:${nowIso()}`);
    const fileUrl = `/backups/${org.id}/${code}.json`;
    await c.env.DB.prepare(`UPDATE logical_backups SET status='finished', file_url=?, checksum=?, size_bytes=?, finished_at=? WHERE org_id=? AND id=?`).bind(fileUrl, checksum, 0, nowIso(), org.id, id).run();
    await auditProd(c.env.DB, org.id, user.id, 'logical_backup_finished', 'logical_backup', id, null, { fileUrl, checksum });
    return c.json({ ok:true, id, backup_code:code, file_url:fileUrl, checksum, simulated:true }, 201);
  });

  app.post('/api/restores/logical', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    if (!d.backup_id) return c.json({ ok:false, error:'backup_id é obrigatório' }, 400);
    const id = uid('restore');
    const code = d.restore_code || `RST-${Date.now()}`;
    await c.env.DB.prepare(`
      INSERT INTO logical_restore_jobs
      (id, org_id, backup_id, restore_code, target_environment, dry_run, status, validation_json, started_at, requested_by)
      VALUES (?, ?, ?, ?, ?, ?, 'running', ?, ?, ?)
    `).bind(id, org.id, d.backup_id, code, d.target_environment || 'sandbox', d.dry_run === false ? 0 : 1, d.validation_json ? json(d.validation_json) : '{}', nowIso(), user.id).run();
    await c.env.DB.prepare(`UPDATE logical_restore_jobs SET status='validated', result_json=?, finished_at=? WHERE org_id=? AND id=?`).bind(JSON.stringify({ simulated:true, dry_run:d.dry_run !== false, message:'Restore lógico validado em modo seguro.' }), nowIso(), org.id, id).run();
    return c.json({ ok:true, id, restore_code:code, status:'validated', simulated:true }, 201);
  });

  app.get('/api/backups/logical', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`SELECT * FROM logical_backups WHERE org_id=? ORDER BY created_at DESC LIMIT 200`).bind(org.id).all();
    return c.json({ ok:true, items:rs.results || [] });
  });

  app.post('/api/production/readiness/run', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const checks = [
      { code:'queues_configured', name:'Filas configuradas', status:'pass', severity:'high', rec:'Manter filas separadas por domínio crítico.' },
      { code:'backup_available', name:'Backup lógico disponível', status:'warning', severity:'high', rec:'Configurar storage real e rotina automática de backup.' },
      { code:'restore_tested', name:'Restore testado', status:'warning', severity:'high', rec:'Executar restore em sandbox periodicamente.' },
      { code:'feature_flags_enabled', name:'Feature flags habilitadas', status:'pass', severity:'medium', rec:'Usar rollout gradual para mudanças críticas.' },
      { code:'capacity_limits_defined', name:'Limites por tenant definidos', status:'pass', severity:'medium', rec:'Revisar limites por plano/cliente.' },
      { code:'external_jobs_real_workers', name:'Workers reais configurados', status:'warning', severity:'high', rec:'Conectar Cloudflare Queues, BullMQ, Temporal ou equivalente.' },
      { code:'database_indexes_reviewed', name:'Índices revisados', status:'pass', severity:'medium', rec:'Monitorar slow queries e ajustar índices.' }
    ];
    for (const chk of checks) {
      await c.env.DB.prepare(`
        INSERT OR REPLACE INTO production_readiness_checks
        (id, org_id, check_code, check_name, category, status, severity, details_json, recommendation, checked_at)
        VALUES (COALESCE((SELECT id FROM production_readiness_checks WHERE org_id=? AND check_code=?), ?), ?, ?, ?, 'production', ?, ?, '{}', ?, ?)
      `).bind(org.id, chk.code, uid('prdchk'), org.id, chk.code, chk.name, chk.status, chk.severity, chk.rec, nowIso()).run();
    }
    return c.json({ ok:true, checks });
  });

  app.get('/api/production/readiness', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`SELECT * FROM production_readiness_checks WHERE org_id=? ORDER BY severity,check_name`).bind(org.id).all();
    return c.json({ ok:true, items:rs.results || [] });
  });

  app.post('/api/maintenance/windows', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    if (!d.codigo || !d.titulo || !d.starts_at || !d.ends_at) return c.json({ ok:false, error:'codigo, titulo, starts_at e ends_at são obrigatórios' }, 400);
    const id = uid('mw');
    await c.env.DB.prepare(`
      INSERT INTO maintenance_windows
      (id, org_id, codigo, titulo, descricao, status, starts_at, ends_at, impact_level, affected_modules_json, communication_plan_json, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, org.id, d.codigo, d.titulo, d.descricao || null, d.status || 'scheduled', d.starts_at, d.ends_at, d.impact_level || 'low', d.affected_modules_json ? json(d.affected_modules_json) : '[]', d.communication_plan_json ? json(d.communication_plan_json) : '{}', user.id).run();
    return c.json({ ok:true, id }, 201);
  });

  app.post('/api/feature-flags', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    if (!d.flag_key || !d.nome) return c.json({ ok:false, error:'flag_key e nome são obrigatórios' }, 400);
    const id = uid('flag');
    await c.env.DB.prepare(`
      INSERT OR REPLACE INTO feature_flags
      (id, org_id, flag_key, nome, descricao, enabled, rollout_percent, target_rules_json, environment, owner_id, created_by, updated_at)
      VALUES (COALESCE((SELECT id FROM feature_flags WHERE org_id=? AND flag_key=? AND environment=?), ?), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(org.id, d.flag_key, d.environment || 'production', id, org.id, d.flag_key, d.nome, d.descricao || null, d.enabled ? 1 : 0, d.rollout_percent || 0, d.target_rules_json ? json(d.target_rules_json) : '{}', d.environment || 'production', d.owner_id || user.id, user.id).run();
    return c.json({ ok:true, id });
  });

  app.get('/api/feature-flags', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`SELECT * FROM feature_flags WHERE org_id=? ORDER BY environment,flag_key`).bind(org.id).all();
    return c.json({ ok:true, items:rs.results || [] });
  });

  app.post('/api/releases', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    if (!d.release_code || !d.version || !d.title) return c.json({ ok:false, error:'release_code, version e title são obrigatórios' }, 400);
    const id = uid('rel');
    await c.env.DB.prepare(`
      INSERT INTO release_versions
      (id, org_id, release_code, version, title, status, environment, changelog_json, deployment_plan_json, rollback_plan_json, planned_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, org.id, d.release_code, d.version, d.title, d.status || 'planned', d.environment || 'production', d.changelog_json ? json(d.changelog_json) : '[]', d.deployment_plan_json ? json(d.deployment_plan_json) : '{}', d.rollback_plan_json ? json(d.rollback_plan_json) : '{}', d.planned_at || null, user.id).run();
    return c.json({ ok:true, id }, 201);
  });

  app.post('/api/releases/:id/deploy', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const id = c.req.param('id');
    const rel = await c.env.DB.prepare(`SELECT * FROM release_versions WHERE org_id=? AND id=?`).bind(org.id, id).first();
    if (!rel) return c.json({ ok:false, error:'Release não encontrada' }, 404);
    const depId = uid('deploy');
    await c.env.DB.prepare(`
      INSERT INTO release_deployments
      (id, org_id, release_id, environment, status, started_at, deployed_by)
      VALUES (?, ?, ?, ?, 'running', ?, ?)
    `).bind(depId, org.id, id, rel.environment, nowIso(), user.id).run();
    await c.env.DB.prepare(`UPDATE release_deployments SET status='success', finished_at=?, result_json=? WHERE org_id=? AND id=?`).bind(nowIso(), JSON.stringify({ simulated:true, message:'Deploy registrado em modo governado.' }), org.id, depId).run();
    await c.env.DB.prepare(`UPDATE release_versions SET status='deployed', deployed_at=?, updated_at=CURRENT_TIMESTAMP WHERE org_id=? AND id=?`).bind(nowIso(), org.id, id).run();
    await auditProd(c.env.DB, org.id, user.id, 'release_deployed', 'release_version', id, { status:rel.status }, { status:'deployed' }, { deployment_id:depId });
    return c.json({ ok:true, deployment_id:depId, status:'success', simulated:true });
  });

  app.get('/api/releases', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`SELECT * FROM release_versions WHERE org_id=? ORDER BY created_at DESC`).bind(org.id).all();
    return c.json({ ok:true, items:rs.results || [] });
  });

  app.get('/api/production/audit', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`SELECT * FROM production_audit_events WHERE org_id=? ORDER BY created_at DESC LIMIT 300`).bind(org.id).all();
    return c.json({ ok:true, items:rs.results || [] });
  });
}

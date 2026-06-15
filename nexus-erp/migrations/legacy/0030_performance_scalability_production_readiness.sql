-- 0030_performance_scalability_production_readiness.sql
-- NEXUS ERP — Etapa 32: Performance, Escalabilidade, Cache, Jobs Assíncronos, Backup/Restore e Preparação Enterprise Production
-- Objetivo: preparar o ERP para produção enterprise:
-- cache, filas reais/preparadas, scheduler, concorrência, logs de performance,
-- backup lógico, restore lógico, migrations seguras, readiness checks,
-- manutenção programada, feature flags, release management e limites por tenant.

CREATE TABLE IF NOT EXISTS runtime_cache_entries (
  id TEXT PRIMARY KEY,
  org_id TEXT REFERENCES organizacoes(id),
  cache_key TEXT NOT NULL,
  namespace TEXT NOT NULL DEFAULT 'default',
  value_json TEXT NOT NULL DEFAULT '{}',
  expires_at TEXT,
  hit_count INTEGER NOT NULL DEFAULT 0,
  last_hit_at TEXT,
  tags_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, namespace, cache_key)
);

CREATE TABLE IF NOT EXISTS async_job_queues (
  id TEXT PRIMARY KEY,
  org_id TEXT REFERENCES organizacoes(id),
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  status TEXT NOT NULL DEFAULT 'ativo',
  max_concurrency INTEGER NOT NULL DEFAULT 5,
  retry_policy_json TEXT NOT NULL DEFAULT '{"max_attempts":3,"backoff_seconds":60}',
  dead_letter_enabled INTEGER NOT NULL DEFAULT 1,
  created_by TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, codigo)
);

CREATE TABLE IF NOT EXISTS async_jobs (
  id TEXT PRIMARY KEY,
  org_id TEXT REFERENCES organizacoes(id),
  queue_id TEXT REFERENCES async_job_queues(id),
  job_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  priority INTEGER NOT NULL DEFAULT 5,
  payload_json TEXT NOT NULL DEFAULT '{}',
  result_json TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  scheduled_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  locked_by TEXT,
  locked_at TEXT,
  started_at TEXT,
  finished_at TEXT,
  error_message TEXT,
  correlation_id TEXT,
  created_by TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS async_job_events (
  id TEXT PRIMARY KEY,
  org_id TEXT REFERENCES organizacoes(id),
  job_id TEXT NOT NULL REFERENCES async_jobs(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  message TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS async_dead_letter_jobs (
  id TEXT PRIMARY KEY,
  org_id TEXT REFERENCES organizacoes(id),
  original_job_id TEXT,
  queue_id TEXT,
  job_type TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  failure_reason TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  moved_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  replayed_at TEXT,
  replay_job_id TEXT
);

CREATE TABLE IF NOT EXISTS scheduled_tasks (
  id TEXT PRIMARY KEY,
  org_id TEXT REFERENCES organizacoes(id),
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  task_type TEXT NOT NULL DEFAULT 'job',
  cron_expression TEXT,
  interval_minutes INTEGER,
  timezone TEXT DEFAULT 'America/Sao_Paulo',
  target_queue_id TEXT REFERENCES async_job_queues(id),
  job_type TEXT,
  payload_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'ativo',
  last_run_at TEXT,
  next_run_at TEXT,
  created_by TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, codigo)
);

CREATE TABLE IF NOT EXISTS concurrency_locks (
  id TEXT PRIMARY KEY,
  org_id TEXT REFERENCES organizacoes(id),
  lock_key TEXT NOT NULL,
  lock_scope TEXT NOT NULL DEFAULT 'global',
  owner_ref TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'locked',
  acquired_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  released_at TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  UNIQUE(org_id, lock_scope, lock_key)
);

CREATE TABLE IF NOT EXISTS performance_traces (
  id TEXT PRIMARY KEY,
  org_id TEXT REFERENCES organizacoes(id),
  trace_id TEXT NOT NULL,
  span_id TEXT NOT NULL,
  parent_span_id TEXT,
  operation_name TEXT NOT NULL,
  module TEXT,
  status TEXT NOT NULL DEFAULT 'ok',
  duration_ms INTEGER DEFAULT 0,
  start_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  end_at TEXT,
  attributes_json TEXT NOT NULL DEFAULT '{}',
  error_message TEXT
);

CREATE TABLE IF NOT EXISTS performance_query_stats (
  id TEXT PRIMARY KEY,
  org_id TEXT REFERENCES organizacoes(id),
  query_hash TEXT NOT NULL,
  query_label TEXT,
  module TEXT,
  execution_count INTEGER NOT NULL DEFAULT 1,
  total_duration_ms INTEGER NOT NULL DEFAULT 0,
  avg_duration_ms REAL DEFAULT 0,
  max_duration_ms INTEGER DEFAULT 0,
  last_duration_ms INTEGER DEFAULT 0,
  last_executed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  UNIQUE(org_id, query_hash)
);

CREATE TABLE IF NOT EXISTS tenant_capacity_limits (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  limit_key TEXT NOT NULL,
  limit_value REAL NOT NULL,
  unit TEXT,
  status TEXT NOT NULL DEFAULT 'ativo',
  warning_threshold_percent REAL DEFAULT 80,
  hard_block INTEGER NOT NULL DEFAULT 0,
  created_by TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, limit_key)
);

CREATE TABLE IF NOT EXISTS tenant_usage_counters (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  usage_key TEXT NOT NULL,
  usage_value REAL NOT NULL DEFAULT 0,
  period_key TEXT NOT NULL DEFAULT 'current',
  last_increment_at TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, usage_key, period_key)
);

CREATE TABLE IF NOT EXISTS logical_backups (
  id TEXT PRIMARY KEY,
  org_id TEXT REFERENCES organizacoes(id),
  backup_code TEXT NOT NULL,
  backup_type TEXT NOT NULL DEFAULT 'logical',
  scope_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'queued',
  file_url TEXT,
  checksum TEXT,
  size_bytes INTEGER DEFAULT 0,
  started_at TEXT,
  finished_at TEXT,
  error_message TEXT,
  requested_by TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, backup_code)
);

CREATE TABLE IF NOT EXISTS logical_restore_jobs (
  id TEXT PRIMARY KEY,
  org_id TEXT REFERENCES organizacoes(id),
  backup_id TEXT REFERENCES logical_backups(id),
  restore_code TEXT NOT NULL,
  target_environment TEXT NOT NULL DEFAULT 'sandbox',
  dry_run INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'queued',
  validation_json TEXT NOT NULL DEFAULT '{}',
  result_json TEXT NOT NULL DEFAULT '{}',
  started_at TEXT,
  finished_at TEXT,
  error_message TEXT,
  requested_by TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, restore_code)
);

CREATE TABLE IF NOT EXISTS migration_registry (
  id TEXT PRIMARY KEY,
  org_id TEXT REFERENCES organizacoes(id),
  migration_id TEXT NOT NULL,
  migration_name TEXT NOT NULL,
  checksum TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  applied_at TEXT,
  applied_by TEXT REFERENCES usuarios(id),
  rollback_script_ref TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, migration_id)
);

CREATE TABLE IF NOT EXISTS production_readiness_checks (
  id TEXT PRIMARY KEY,
  org_id TEXT REFERENCES organizacoes(id),
  check_code TEXT NOT NULL,
  check_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'production',
  status TEXT NOT NULL DEFAULT 'unknown',
  severity TEXT NOT NULL DEFAULT 'medium',
  details_json TEXT NOT NULL DEFAULT '{}',
  recommendation TEXT,
  checked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, check_code)
);

CREATE TABLE IF NOT EXISTS maintenance_windows (
  id TEXT PRIMARY KEY,
  org_id TEXT REFERENCES organizacoes(id),
  codigo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled',
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  impact_level TEXT NOT NULL DEFAULT 'low',
  affected_modules_json TEXT NOT NULL DEFAULT '[]',
  communication_plan_json TEXT NOT NULL DEFAULT '{}',
  created_by TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, codigo)
);

CREATE TABLE IF NOT EXISTS feature_flags (
  id TEXT PRIMARY KEY,
  org_id TEXT REFERENCES organizacoes(id),
  flag_key TEXT NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  enabled INTEGER NOT NULL DEFAULT 0,
  rollout_percent REAL DEFAULT 0,
  target_rules_json TEXT NOT NULL DEFAULT '{}',
  environment TEXT NOT NULL DEFAULT 'production',
  owner_id TEXT REFERENCES usuarios(id),
  created_by TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, flag_key, environment)
);

CREATE TABLE IF NOT EXISTS release_versions (
  id TEXT PRIMARY KEY,
  org_id TEXT REFERENCES organizacoes(id),
  release_code TEXT NOT NULL,
  version TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned',
  environment TEXT NOT NULL DEFAULT 'production',
  changelog_json TEXT NOT NULL DEFAULT '[]',
  deployment_plan_json TEXT NOT NULL DEFAULT '{}',
  rollback_plan_json TEXT NOT NULL DEFAULT '{}',
  planned_at TEXT,
  deployed_at TEXT,
  created_by TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, release_code)
);

CREATE TABLE IF NOT EXISTS release_deployments (
  id TEXT PRIMARY KEY,
  org_id TEXT REFERENCES organizacoes(id),
  release_id TEXT NOT NULL REFERENCES release_versions(id) ON DELETE CASCADE,
  environment TEXT NOT NULL DEFAULT 'production',
  status TEXT NOT NULL DEFAULT 'queued',
  started_at TEXT,
  finished_at TEXT,
  deployed_by TEXT REFERENCES usuarios(id),
  result_json TEXT NOT NULL DEFAULT '{}',
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS production_audit_events (
  id TEXT PRIMARY KEY,
  org_id TEXT REFERENCES organizacoes(id),
  event_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  actor_id TEXT REFERENCES usuarios(id),
  before_json TEXT,
  after_json TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cache_entries ON runtime_cache_entries(org_id, namespace, expires_at);
CREATE INDEX IF NOT EXISTS idx_async_jobs ON async_jobs(org_id, status, priority, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks ON scheduled_tasks(org_id, status, next_run_at);
CREATE INDEX IF NOT EXISTS idx_perf_traces ON performance_traces(org_id, trace_id, start_at);
CREATE INDEX IF NOT EXISTS idx_capacity_limits ON tenant_capacity_limits(org_id, limit_key);
CREATE INDEX IF NOT EXISTS idx_backups ON logical_backups(org_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_readiness ON production_readiness_checks(org_id, status, severity);
CREATE INDEX IF NOT EXISTS idx_feature_flags ON feature_flags(org_id, flag_key, environment);
CREATE INDEX IF NOT EXISTS idx_releases ON release_versions(org_id, status, environment);

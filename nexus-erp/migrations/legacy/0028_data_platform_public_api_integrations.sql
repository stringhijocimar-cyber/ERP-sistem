-- 0028_data_platform_public_api_integrations.sql
-- NEXUS ERP — Etapa 30: Data Platform, API Pública, Integrações, Webhooks Reais e Conectores Enterprise
-- Objetivo: abrir o ERP com governança para integrações externas:
-- API pública versionada, API keys, OAuth/client credentials, rate limit, webhooks reais,
-- conectores enterprise, filas de integração, logs, BI, exportação, storage e catálogo de APIs.

CREATE TABLE IF NOT EXISTS api_applications (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  owner_id TEXT REFERENCES usuarios(id),
  status TEXT NOT NULL DEFAULT 'ativo',
  environment TEXT NOT NULL DEFAULT 'production',
  scopes_json TEXT NOT NULL DEFAULT '[]',
  allowed_ips_json TEXT NOT NULL DEFAULT '[]',
  allowed_origins_json TEXT NOT NULL DEFAULT '[]',
  rate_limit_per_minute INTEGER DEFAULT 120,
  created_by TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, codigo)
);

CREATE TABLE IF NOT EXISTS api_credentials (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  application_id TEXT NOT NULL REFERENCES api_applications(id) ON DELETE CASCADE,
  credential_type TEXT NOT NULL DEFAULT 'api_key',
  client_id TEXT,
  secret_hash TEXT NOT NULL,
  key_prefix TEXT,
  status TEXT NOT NULL DEFAULT 'ativo',
  expires_at TEXT,
  last_used_at TEXT,
  created_by TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS api_access_tokens (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  application_id TEXT NOT NULL REFERENCES api_applications(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  scopes_json TEXT NOT NULL DEFAULT '[]',
  issued_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  metadata_json TEXT
);

CREATE TABLE IF NOT EXISTS api_rate_limit_buckets (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  application_id TEXT NOT NULL REFERENCES api_applications(id) ON DELETE CASCADE,
  bucket_key TEXT NOT NULL,
  window_start TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  limit_count INTEGER NOT NULL DEFAULT 120,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, application_id, bucket_key, window_start)
);

CREATE TABLE IF NOT EXISTS api_request_logs (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  application_id TEXT REFERENCES api_applications(id),
  request_id TEXT NOT NULL,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  status_code INTEGER,
  latency_ms INTEGER,
  ip_address TEXT,
  user_agent TEXT,
  request_body_hash TEXT,
  response_body_hash TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS api_catalog_endpoints (
  id TEXT PRIMARY KEY,
  org_id TEXT REFERENCES organizacoes(id),
  version TEXT NOT NULL DEFAULT 'v1',
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  module TEXT,
  scopes_required_json TEXT NOT NULL DEFAULT '[]',
  request_schema_json TEXT NOT NULL DEFAULT '{}',
  response_schema_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'ativo',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, version, method, path)
);

CREATE TABLE IF NOT EXISTS integration_connectors (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  connector_type TEXT NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'rascunho',
  direction TEXT NOT NULL DEFAULT 'bidirectional',
  auth_type TEXT NOT NULL DEFAULT 'api_key',
  credentials_ref TEXT,
  base_url TEXT,
  config_json TEXT NOT NULL DEFAULT '{}',
  capabilities_json TEXT NOT NULL DEFAULT '[]',
  created_by TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, codigo)
);

CREATE TABLE IF NOT EXISTS integration_mappings (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  connector_id TEXT NOT NULL REFERENCES integration_connectors(id) ON DELETE CASCADE,
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  source_entity TEXT NOT NULL,
  target_entity TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'outbound',
  field_map_json TEXT NOT NULL DEFAULT '{}',
  transform_rules_json TEXT NOT NULL DEFAULT '[]',
  validation_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'ativo',
  created_by TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, connector_id, codigo)
);

CREATE TABLE IF NOT EXISTS integration_jobs (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  connector_id TEXT REFERENCES integration_connectors(id),
  mapping_id TEXT REFERENCES integration_mappings(id),
  job_type TEXT NOT NULL DEFAULT 'sync',
  direction TEXT NOT NULL DEFAULT 'outbound',
  status TEXT NOT NULL DEFAULT 'queued',
  priority TEXT NOT NULL DEFAULT 'normal',
  entidade_tipo TEXT,
  entidade_id TEXT,
  payload_json TEXT NOT NULL DEFAULT '{}',
  result_json TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  scheduled_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at TEXT,
  finished_at TEXT,
  error_message TEXT,
  created_by TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS integration_job_events (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  job_id TEXT NOT NULL REFERENCES integration_jobs(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  message TEXT,
  payload_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS integration_sync_state (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  connector_id TEXT NOT NULL REFERENCES integration_connectors(id) ON DELETE CASCADE,
  mapping_id TEXT REFERENCES integration_mappings(id),
  entity_name TEXT NOT NULL,
  last_sync_at TEXT,
  cursor_value TEXT,
  checkpoint_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'ativo',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, connector_id, mapping_id, entity_name)
);

CREATE TABLE IF NOT EXISTS outbound_webhook_endpoints_v2 (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  application_id TEXT REFERENCES api_applications(id),
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  url TEXT NOT NULL,
  secret_hash TEXT,
  eventos_json TEXT NOT NULL DEFAULT '[]',
  headers_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'ativo',
  retry_policy_json TEXT NOT NULL DEFAULT '{"max_attempts":5,"backoff_seconds":60}',
  created_by TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, codigo)
);

CREATE TABLE IF NOT EXISTS outbound_webhook_deliveries_v2 (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  endpoint_id TEXT NOT NULL REFERENCES outbound_webhook_endpoints_v2(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  entidade_tipo TEXT,
  entidade_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  request_json TEXT NOT NULL DEFAULT '{}',
  response_status INTEGER,
  response_body TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT,
  delivered_at TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inbound_webhook_events (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  connector_id TEXT REFERENCES integration_connectors(id),
  provider TEXT,
  event_name TEXT NOT NULL,
  signature_valid INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'received',
  payload_json TEXT NOT NULL DEFAULT '{}',
  processed_at TEXT,
  error_message TEXT,
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS data_export_jobs (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  entity_name TEXT NOT NULL,
  export_format TEXT NOT NULL DEFAULT 'json',
  filter_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'queued',
  file_url TEXT,
  row_count INTEGER DEFAULT 0,
  error_message TEXT,
  requested_by TEXT REFERENCES usuarios(id),
  requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TEXT,
  UNIQUE(org_id, codigo)
);

CREATE TABLE IF NOT EXISTS data_warehouse_datasets (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  source_entity TEXT NOT NULL,
  schema_json TEXT NOT NULL DEFAULT '{}',
  refresh_policy_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'ativo',
  last_refresh_at TEXT,
  created_by TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, codigo)
);

CREATE TABLE IF NOT EXISTS bi_connections (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  bi_tool TEXT NOT NULL DEFAULT 'power_bi',
  status TEXT NOT NULL DEFAULT 'ativo',
  connection_type TEXT NOT NULL DEFAULT 'api',
  endpoint_url TEXT,
  access_scope_json TEXT NOT NULL DEFAULT '[]',
  refresh_frequency TEXT DEFAULT 'daily',
  last_refresh_at TEXT,
  created_by TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, codigo)
);

CREATE TABLE IF NOT EXISTS storage_connectors (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 's3',
  status TEXT NOT NULL DEFAULT 'ativo',
  bucket_name TEXT,
  base_path TEXT,
  credentials_ref TEXT,
  config_json TEXT NOT NULL DEFAULT '{}',
  created_by TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, codigo)
);

CREATE TABLE IF NOT EXISTS integration_audit_trail (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  actor_id TEXT REFERENCES usuarios(id),
  before_json TEXT,
  after_json TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_api_apps_org ON api_applications(org_id, status, environment);
CREATE INDEX IF NOT EXISTS idx_api_credentials_org ON api_credentials(org_id, application_id, status);
CREATE INDEX IF NOT EXISTS idx_api_logs_org ON api_request_logs(org_id, application_id, created_at);
CREATE INDEX IF NOT EXISTS idx_connectors_org ON integration_connectors(org_id, connector_type, provider, status);
CREATE INDEX IF NOT EXISTS idx_jobs_org ON integration_jobs(org_id, status, scheduled_at, connector_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_v2 ON outbound_webhook_deliveries_v2(org_id, status, next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_inbound_webhooks_org ON inbound_webhook_events(org_id, status, received_at);
CREATE INDEX IF NOT EXISTS idx_export_jobs_org ON data_export_jobs(org_id, status, requested_at);

-- 0029_observability_security_lgpd_hardening.sql
-- NEXUS ERP — Etapa 31: Observabilidade, Segurança Avançada, LGPD, Auditoria Forense e Hardening Enterprise
-- Objetivo: fortalecer o ERP para ambiente enterprise:
-- logs técnicos estruturados, métricas, health checks, incidentes, trilha forense,
-- LGPD, consentimento, retenção/descarte, classificação de dados, criptografia lógica,
-- controle de sessão, política de senha/MFA, detecção de anomalias e painel de segurança.

CREATE TABLE IF NOT EXISTS system_log_events (
  id TEXT PRIMARY KEY,
  org_id TEXT REFERENCES organizacoes(id),
  level TEXT NOT NULL DEFAULT 'info',
  source TEXT NOT NULL DEFAULT 'app',
  module TEXT,
  event_name TEXT NOT NULL,
  message TEXT,
  request_id TEXT,
  user_id TEXT REFERENCES usuarios(id),
  session_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  entity_type TEXT,
  entity_id TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS system_metrics (
  id TEXT PRIMARY KEY,
  org_id TEXT REFERENCES organizacoes(id),
  metric_name TEXT NOT NULL,
  metric_type TEXT NOT NULL DEFAULT 'gauge',
  metric_value REAL NOT NULL DEFAULT 0,
  unit TEXT,
  dimensions_json TEXT NOT NULL DEFAULT '{}',
  captured_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS system_health_checks (
  id TEXT PRIMARY KEY,
  org_id TEXT REFERENCES organizacoes(id),
  component TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unknown',
  latency_ms INTEGER,
  details_json TEXT NOT NULL DEFAULT '{}',
  checked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS security_policies (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  policy_type TEXT NOT NULL DEFAULT 'password',
  status TEXT NOT NULL DEFAULT 'ativo',
  config_json TEXT NOT NULL DEFAULT '{}',
  enforced INTEGER NOT NULL DEFAULT 1,
  created_by TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, codigo)
);

CREATE TABLE IF NOT EXISTS security_sessions (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  user_id TEXT REFERENCES usuarios(id),
  session_token_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  ip_address TEXT,
  user_agent TEXT,
  device_fingerprint TEXT,
  mfa_verified INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  revoke_reason TEXT
);

CREATE TABLE IF NOT EXISTS security_mfa_devices (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  user_id TEXT NOT NULL REFERENCES usuarios(id),
  device_type TEXT NOT NULL DEFAULT 'totp',
  label TEXT,
  secret_ref TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  verified_at TEXT,
  last_used_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS security_login_attempts (
  id TEXT PRIMARY KEY,
  org_id TEXT REFERENCES organizacoes(id),
  user_id TEXT REFERENCES usuarios(id),
  email TEXT,
  success INTEGER NOT NULL DEFAULT 0,
  failure_reason TEXT,
  ip_address TEXT,
  user_agent TEXT,
  geo_json TEXT,
  risk_score REAL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS data_classification_policies (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  classification TEXT NOT NULL DEFAULT 'internal',
  description TEXT,
  handling_rules_json TEXT NOT NULL DEFAULT '{}',
  retention_days INTEGER,
  encryption_required INTEGER NOT NULL DEFAULT 0,
  masking_required INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ativo',
  created_by TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, codigo)
);

CREATE TABLE IF NOT EXISTS data_asset_registry (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  entity_type TEXT NOT NULL,
  field_name TEXT,
  asset_name TEXT NOT NULL,
  classification TEXT NOT NULL DEFAULT 'internal',
  contains_personal_data INTEGER NOT NULL DEFAULT 0,
  contains_sensitive_data INTEGER NOT NULL DEFAULT 0,
  owner_user_id TEXT REFERENCES usuarios(id),
  retention_policy_id TEXT,
  lawful_basis TEXT,
  status TEXT NOT NULL DEFAULT 'ativo',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_by TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, entity_type, field_name)
);

CREATE TABLE IF NOT EXISTS lgpd_data_subjects (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  subject_type TEXT NOT NULL DEFAULT 'person',
  external_ref TEXT,
  name TEXT,
  email TEXT,
  document_number_hash TEXT,
  status TEXT NOT NULL DEFAULT 'ativo',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lgpd_consents (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  data_subject_id TEXT NOT NULL REFERENCES lgpd_data_subjects(id) ON DELETE CASCADE,
  purpose_code TEXT NOT NULL,
  purpose_description TEXT NOT NULL,
  lawful_basis TEXT NOT NULL DEFAULT 'consent',
  status TEXT NOT NULL DEFAULT 'granted',
  granted_at TEXT,
  revoked_at TEXT,
  evidence_json TEXT NOT NULL DEFAULT '{}',
  created_by TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lgpd_data_subject_requests (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  data_subject_id TEXT REFERENCES lgpd_data_subjects(id),
  request_type TEXT NOT NULL DEFAULT 'access',
  status TEXT NOT NULL DEFAULT 'open',
  description TEXT,
  due_at TEXT,
  response_text TEXT,
  handled_by TEXT REFERENCES usuarios(id),
  handled_at TEXT,
  evidence_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS data_retention_policies (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  classification TEXT,
  retention_days INTEGER NOT NULL,
  action_after_retention TEXT NOT NULL DEFAULT 'archive',
  legal_hold_exempt INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'ativo',
  created_by TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, codigo)
);

CREATE TABLE IF NOT EXISTS data_retention_runs (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  policy_id TEXT REFERENCES data_retention_policies(id),
  status TEXT NOT NULL DEFAULT 'queued',
  scanned_count INTEGER DEFAULT 0,
  affected_count INTEGER DEFAULT 0,
  result_json TEXT NOT NULL DEFAULT '{}',
  error_message TEXT,
  started_at TEXT,
  finished_at TEXT,
  created_by TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS forensic_audit_events (
  id TEXT PRIMARY KEY,
  org_id TEXT REFERENCES organizacoes(id),
  event_hash TEXT NOT NULL,
  previous_hash TEXT,
  actor_user_id TEXT REFERENCES usuarios(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  before_json TEXT,
  after_json TEXT,
  ip_address TEXT,
  user_agent TEXT,
  risk_score REAL DEFAULT 0,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS security_incidents (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  codigo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  severity TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'open',
  category TEXT NOT NULL DEFAULT 'security',
  detected_by TEXT,
  detection_source TEXT,
  assigned_to TEXT REFERENCES usuarios(id),
  opened_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  acknowledged_at TEXT,
  resolved_at TEXT,
  resolution_summary TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_by TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, codigo)
);

CREATE TABLE IF NOT EXISTS security_incident_events (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  incident_id TEXT NOT NULL REFERENCES security_incidents(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  message TEXT,
  actor_user_id TEXT REFERENCES usuarios(id),
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS anomaly_detection_rules (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'security',
  severity TEXT NOT NULL DEFAULT 'medium',
  signal_source TEXT NOT NULL,
  condition_json TEXT NOT NULL DEFAULT '{}',
  action_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'ativo',
  created_by TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, codigo)
);

CREATE TABLE IF NOT EXISTS anomaly_detection_events (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  rule_id TEXT REFERENCES anomaly_detection_rules(id),
  signal_source TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  title TEXT NOT NULL,
  description TEXT,
  risk_score REAL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open',
  linked_incident_id TEXT REFERENCES security_incidents(id),
  metadata_json TEXT NOT NULL DEFAULT '{}',
  detected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TEXT
);

CREATE TABLE IF NOT EXISTS encryption_key_registry (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  key_alias TEXT NOT NULL,
  key_type TEXT NOT NULL DEFAULT 'logical',
  provider TEXT NOT NULL DEFAULT 'internal_ref',
  status TEXT NOT NULL DEFAULT 'ativo',
  rotation_days INTEGER DEFAULT 180,
  last_rotated_at TEXT,
  next_rotation_at TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_by TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, key_alias)
);

CREATE TABLE IF NOT EXISTS security_hardening_checks (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  check_code TEXT NOT NULL,
  check_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'security',
  status TEXT NOT NULL DEFAULT 'unknown',
  severity TEXT NOT NULL DEFAULT 'medium',
  details_json TEXT NOT NULL DEFAULT '{}',
  recommendation TEXT,
  checked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, check_code)
);

CREATE INDEX IF NOT EXISTS idx_system_logs_org ON system_log_events(org_id, level, created_at);
CREATE INDEX IF NOT EXISTS idx_system_metrics_org ON system_metrics(org_id, metric_name, captured_at);
CREATE INDEX IF NOT EXISTS idx_health_checks_org ON system_health_checks(org_id, component, checked_at);
CREATE INDEX IF NOT EXISTS idx_security_sessions_org ON security_sessions(org_id, user_id, status);
CREATE INDEX IF NOT EXISTS idx_login_attempts_org ON security_login_attempts(org_id, email, created_at);
CREATE INDEX IF NOT EXISTS idx_data_assets_org ON data_asset_registry(org_id, entity_type, classification);
CREATE INDEX IF NOT EXISTS idx_lgpd_requests_org ON lgpd_data_subject_requests(org_id, status, due_at);
CREATE INDEX IF NOT EXISTS idx_forensic_events_org ON forensic_audit_events(org_id, entity_type, entity_id, created_at);
CREATE INDEX IF NOT EXISTS idx_incidents_org ON security_incidents(org_id, status, severity);
CREATE INDEX IF NOT EXISTS idx_anomalies_org ON anomaly_detection_events(org_id, status, severity, detected_at);

-- 0025_notifications_multichannel_communication.sql
-- NEXUS ERP — Etapa 27: Notificações, E-mails, WhatsApp/Teams, Régua de Comunicação e Alertas Multicanal
-- Objetivo: centralizar comunicação ativa do ERP:
-- templates, canais, preferências, fila, logs, webhooks, alertas, régua de cobrança,
-- onboarding, aprovações, tickets, SLA e eventos automáticos.

CREATE TABLE IF NOT EXISTS notification_channels (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'email',
  provider TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'ativo',
  credentials_ref TEXT,
  config_json TEXT NOT NULL DEFAULT '{}',
  sandbox INTEGER NOT NULL DEFAULT 1,
  rate_limit_per_minute INTEGER DEFAULT 60,
  created_by TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, codigo)
);

CREATE TABLE IF NOT EXISTS notification_templates (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  evento TEXT NOT NULL,
  canal_tipo TEXT NOT NULL DEFAULT 'email',
  idioma TEXT NOT NULL DEFAULT 'pt-BR',
  assunto_template TEXT,
  corpo_template TEXT NOT NULL,
  variaveis_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'ativo',
  requires_approval INTEGER NOT NULL DEFAULT 0,
  approved_by TEXT REFERENCES usuarios(id),
  approved_at TEXT,
  created_by TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, codigo)
);

CREATE TABLE IF NOT EXISTS notification_preferences (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  principal_tipo TEXT NOT NULL DEFAULT 'user',
  principal_id TEXT NOT NULL,
  evento TEXT NOT NULL,
  canal_tipo TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  quiet_hours_json TEXT,
  digest_mode TEXT DEFAULT 'immediate',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, principal_tipo, principal_id, evento, canal_tipo)
);

CREATE TABLE IF NOT EXISTS notification_events (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  evento TEXT NOT NULL,
  entidade_tipo TEXT,
  entidade_id TEXT,
  prioridade TEXT NOT NULL DEFAULT 'media',
  payload_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'novo',
  created_by TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TEXT
);

CREATE TABLE IF NOT EXISTS notification_queue (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  event_id TEXT REFERENCES notification_events(id) ON DELETE SET NULL,
  template_id TEXT REFERENCES notification_templates(id),
  channel_id TEXT REFERENCES notification_channels(id),
  canal_tipo TEXT NOT NULL DEFAULT 'email',
  destinatario_tipo TEXT NOT NULL DEFAULT 'email',
  destinatario TEXT NOT NULL,
  destinatario_nome TEXT,
  assunto TEXT,
  corpo TEXT NOT NULL,
  prioridade TEXT NOT NULL DEFAULT 'media',
  status TEXT NOT NULL DEFAULT 'pendente',
  scheduled_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  last_attempt_at TEXT,
  sent_at TEXT,
  erro TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notification_delivery_logs (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  queue_id TEXT REFERENCES notification_queue(id) ON DELETE SET NULL,
  channel_id TEXT REFERENCES notification_channels(id),
  provider TEXT,
  status TEXT NOT NULL,
  provider_message_id TEXT,
  request_payload_json TEXT,
  response_payload_json TEXT,
  erro TEXT,
  delivered_at TEXT,
  opened_at TEXT,
  clicked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notification_rules (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  evento TEXT NOT NULL,
  entidade_tipo TEXT,
  condicao_json TEXT NOT NULL DEFAULT '{}',
  template_id TEXT REFERENCES notification_templates(id),
  canal_tipo TEXT NOT NULL DEFAULT 'email',
  destinatarios_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'ativo',
  throttle_minutes INTEGER DEFAULT 0,
  created_by TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, codigo)
);

CREATE TABLE IF NOT EXISTS notification_rule_runs (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  rule_id TEXT NOT NULL REFERENCES notification_rules(id) ON DELETE CASCADE,
  event_id TEXT REFERENCES notification_events(id),
  status TEXT NOT NULL DEFAULT 'executado',
  notifications_created INTEGER DEFAULT 0,
  erro TEXT,
  executed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS communication_sequences (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'onboarding',
  descricao TEXT,
  steps_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'ativo',
  created_by TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, codigo)
);

CREATE TABLE IF NOT EXISTS communication_sequence_enrollments (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  sequence_id TEXT NOT NULL REFERENCES communication_sequences(id) ON DELETE CASCADE,
  principal_tipo TEXT NOT NULL,
  principal_id TEXT NOT NULL,
  entidade_tipo TEXT,
  entidade_id TEXT,
  status TEXT NOT NULL DEFAULT 'ativo',
  current_step INTEGER DEFAULT 0,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS communication_sequence_runs (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  enrollment_id TEXT NOT NULL REFERENCES communication_sequence_enrollments(id) ON DELETE CASCADE,
  step_index INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  scheduled_at TEXT,
  executed_at TEXT,
  queue_id TEXT REFERENCES notification_queue(id),
  erro TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  url TEXT NOT NULL,
  secret_ref TEXT,
  eventos_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'ativo',
  created_by TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, codigo)
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  endpoint_id TEXT NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
  event_id TEXT REFERENCES notification_events(id),
  status TEXT NOT NULL DEFAULT 'pendente',
  request_json TEXT,
  response_status INTEGER,
  response_body TEXT,
  attempts INTEGER DEFAULT 0,
  last_attempt_at TEXT,
  delivered_at TEXT,
  erro TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS alert_definitions (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'geral',
  severidade TEXT NOT NULL DEFAULT 'media',
  query_tipo TEXT NOT NULL DEFAULT 'manual',
  regra_json TEXT NOT NULL DEFAULT '{}',
  evento_emitido TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ativo',
  created_by TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, codigo)
);

CREATE TABLE IF NOT EXISTS alert_instances (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  alert_definition_id TEXT REFERENCES alert_definitions(id),
  entidade_tipo TEXT,
  entidade_id TEXT,
  titulo TEXT NOT NULL,
  descricao TEXT,
  severidade TEXT NOT NULL DEFAULT 'media',
  status TEXT NOT NULL DEFAULT 'aberto',
  event_id TEXT REFERENCES notification_events(id),
  opened_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  acknowledged_by TEXT REFERENCES usuarios(id),
  acknowledged_at TEXT,
  resolved_by TEXT REFERENCES usuarios(id),
  resolved_at TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notification_digest_batches (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  principal_tipo TEXT NOT NULL,
  principal_id TEXT NOT NULL,
  canal_tipo TEXT NOT NULL,
  periodo TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'aberto',
  items_json TEXT NOT NULL DEFAULT '[]',
  queue_id TEXT REFERENCES notification_queue(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_notification_channels_org ON notification_channels(org_id, tipo, status);
CREATE INDEX IF NOT EXISTS idx_notification_templates_org ON notification_templates(org_id, evento, canal_tipo, status);
CREATE INDEX IF NOT EXISTS idx_notification_events_org ON notification_events(org_id, evento, status, created_at);
CREATE INDEX IF NOT EXISTS idx_notification_queue_org ON notification_queue(org_id, status, scheduled_at, canal_tipo);
CREATE INDEX IF NOT EXISTS idx_notification_logs_org ON notification_delivery_logs(org_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_notification_rules_org ON notification_rules(org_id, evento, status);
CREATE INDEX IF NOT EXISTS idx_alert_instances_org ON alert_instances(org_id, status, severidade);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_org ON webhook_deliveries(org_id, status, created_at);

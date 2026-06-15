-- 0026_workflow_sla_approval_orchestration.sql
-- NEXUS ERP — Etapa 28: Motor de Workflow, SLA, Escalonamento, Aprovações Avançadas e Orquestração de Processos
-- Objetivo: criar motor central para aprovações, estados, transições, alçadas, delegações,
-- substitutos, SLAs, escalonamentos, tarefas automáticas, regras e auditoria entre módulos.

CREATE TABLE IF NOT EXISTS workflow_definitions (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  entidade_tipo TEXT NOT NULL,
  versao INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'ativo',
  config_json TEXT NOT NULL DEFAULT '{}',
  created_by TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, codigo, versao)
);

CREATE TABLE IF NOT EXISTS workflow_states (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  workflow_id TEXT NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'normal',
  ordem INTEGER NOT NULL DEFAULT 1,
  is_initial INTEGER NOT NULL DEFAULT 0,
  is_final INTEGER NOT NULL DEFAULT 0,
  sla_hours REAL DEFAULT 0,
  config_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, workflow_id, codigo)
);

CREATE TABLE IF NOT EXISTS workflow_transitions (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  workflow_id TEXT NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
  from_state_id TEXT REFERENCES workflow_states(id),
  to_state_id TEXT NOT NULL REFERENCES workflow_states(id),
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  acao TEXT NOT NULL DEFAULT 'avancar',
  requires_reason INTEGER NOT NULL DEFAULT 0,
  requires_approval INTEGER NOT NULL DEFAULT 0,
  condition_json TEXT NOT NULL DEFAULT '{}',
  automation_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'ativo',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, workflow_id, codigo)
);

CREATE TABLE IF NOT EXISTS workflow_instances (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  workflow_id TEXT NOT NULL REFERENCES workflow_definitions(id),
  entidade_tipo TEXT NOT NULL,
  entidade_id TEXT NOT NULL,
  current_state_id TEXT REFERENCES workflow_states(id),
  status TEXT NOT NULL DEFAULT 'em_andamento',
  prioridade TEXT NOT NULL DEFAULT 'media',
  started_by TEXT REFERENCES usuarios(id),
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TEXT,
  due_at TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, entidade_tipo, entidade_id, workflow_id)
);

CREATE TABLE IF NOT EXISTS workflow_transition_history (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  instance_id TEXT NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,
  transition_id TEXT REFERENCES workflow_transitions(id),
  from_state_id TEXT REFERENCES workflow_states(id),
  to_state_id TEXT REFERENCES workflow_states(id),
  acao TEXT NOT NULL,
  comentario TEXT,
  performed_by TEXT REFERENCES usuarios(id),
  performed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metadata_json TEXT
);

CREATE TABLE IF NOT EXISTS approval_matrices (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  entidade_tipo TEXT NOT NULL,
  criterio_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'ativo',
  created_by TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, codigo)
);

CREATE TABLE IF NOT EXISTS approval_matrix_levels (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  matrix_id TEXT NOT NULL REFERENCES approval_matrices(id) ON DELETE CASCADE,
  nivel INTEGER NOT NULL,
  nome TEXT NOT NULL,
  min_value REAL DEFAULT 0,
  max_value REAL,
  required_approvals INTEGER NOT NULL DEFAULT 1,
  approver_type TEXT NOT NULL DEFAULT 'role',
  approver_ref TEXT NOT NULL,
  sla_hours REAL DEFAULT 24,
  condition_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS approval_requests_v2 (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  workflow_instance_id TEXT REFERENCES workflow_instances(id) ON DELETE SET NULL,
  entidade_tipo TEXT NOT NULL,
  entidade_id TEXT NOT NULL,
  matrix_id TEXT REFERENCES approval_matrices(id),
  level_id TEXT REFERENCES approval_matrix_levels(id),
  nivel INTEGER DEFAULT 1,
  titulo TEXT NOT NULL,
  descricao TEXT,
  valor_referencia REAL DEFAULT 0,
  moeda TEXT DEFAULT 'BRL',
  status TEXT NOT NULL DEFAULT 'pendente',
  requested_by TEXT REFERENCES usuarios(id),
  requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  due_at TEXT,
  decided_by TEXT REFERENCES usuarios(id),
  decided_at TEXT,
  decisao TEXT,
  comentario TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS approval_request_approvers (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  approval_request_id TEXT NOT NULL REFERENCES approval_requests_v2(id) ON DELETE CASCADE,
  approver_user_id TEXT REFERENCES usuarios(id),
  approver_role TEXT,
  approver_label TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',
  delegated_from_user_id TEXT REFERENCES usuarios(id),
  decided_by TEXT REFERENCES usuarios(id),
  decided_at TEXT,
  decisao TEXT,
  comentario TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS approval_delegations (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  delegator_user_id TEXT NOT NULL REFERENCES usuarios(id),
  delegate_user_id TEXT NOT NULL REFERENCES usuarios(id),
  scope_tipo TEXT DEFAULT 'all',
  scope_ref TEXT,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  motivo TEXT,
  status TEXT NOT NULL DEFAULT 'ativo',
  created_by TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS approval_substitutes (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  user_id TEXT NOT NULL REFERENCES usuarios(id),
  substitute_user_id TEXT NOT NULL REFERENCES usuarios(id),
  priority_order INTEGER NOT NULL DEFAULT 1,
  active INTEGER NOT NULL DEFAULT 1,
  created_by TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, user_id, substitute_user_id)
);

CREATE TABLE IF NOT EXISTS workflow_tasks (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  workflow_instance_id TEXT REFERENCES workflow_instances(id) ON DELETE CASCADE,
  entidade_tipo TEXT,
  entidade_id TEXT,
  titulo TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'pendente',
  prioridade TEXT NOT NULL DEFAULT 'media',
  assigned_to TEXT REFERENCES usuarios(id),
  assigned_role TEXT,
  due_at TEXT,
  completed_by TEXT REFERENCES usuarios(id),
  completed_at TEXT,
  automation_json TEXT NOT NULL DEFAULT '{}',
  created_by TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS workflow_sla_policies (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  entidade_tipo TEXT NOT NULL,
  state_codigo TEXT,
  sla_hours REAL NOT NULL DEFAULT 24,
  warning_percent REAL DEFAULT 80,
  escalation_policy_id TEXT,
  status TEXT NOT NULL DEFAULT 'ativo',
  created_by TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, codigo)
);

CREATE TABLE IF NOT EXISTS workflow_escalation_policies (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  steps_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'ativo',
  created_by TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, codigo)
);

CREATE TABLE IF NOT EXISTS workflow_sla_events (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  workflow_instance_id TEXT REFERENCES workflow_instances(id) ON DELETE CASCADE,
  task_id TEXT REFERENCES workflow_tasks(id) ON DELETE SET NULL,
  approval_request_id TEXT REFERENCES approval_requests_v2(id) ON DELETE SET NULL,
  policy_id TEXT REFERENCES workflow_sla_policies(id),
  event_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'aberto',
  due_at TEXT,
  triggered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TEXT,
  metadata_json TEXT
);

CREATE TABLE IF NOT EXISTS workflow_business_rules (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  entidade_tipo TEXT,
  evento TEXT NOT NULL,
  condition_json TEXT NOT NULL DEFAULT '{}',
  action_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'ativo',
  created_by TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, codigo)
);

CREATE TABLE IF NOT EXISTS workflow_automation_runs (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  rule_id TEXT REFERENCES workflow_business_rules(id),
  workflow_instance_id TEXT REFERENCES workflow_instances(id),
  entidade_tipo TEXT,
  entidade_id TEXT,
  evento TEXT,
  status TEXT NOT NULL DEFAULT 'executado',
  resultado_json TEXT,
  erro TEXT,
  executed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS workflow_audit_trail (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  entidade_tipo TEXT NOT NULL,
  entidade_id TEXT NOT NULL,
  action TEXT NOT NULL,
  actor_id TEXT REFERENCES usuarios(id),
  before_json TEXT,
  after_json TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_workflow_def_org ON workflow_definitions(org_id, entidade_tipo, status);
CREATE INDEX IF NOT EXISTS idx_workflow_instances_org ON workflow_instances(org_id, entidade_tipo, entidade_id, status);
CREATE INDEX IF NOT EXISTS idx_workflow_tasks_org ON workflow_tasks(org_id, status, due_at, assigned_to);
CREATE INDEX IF NOT EXISTS idx_approval_req_org ON approval_requests_v2(org_id, status, due_at, entidade_tipo);
CREATE INDEX IF NOT EXISTS idx_approval_approvers_org ON approval_request_approvers(org_id, status, approver_user_id, approver_role);
CREATE INDEX IF NOT EXISTS idx_sla_events_org ON workflow_sla_events(org_id, status, event_type);
CREATE INDEX IF NOT EXISTS idx_workflow_audit_org ON workflow_audit_trail(org_id, entidade_tipo, entidade_id, created_at);

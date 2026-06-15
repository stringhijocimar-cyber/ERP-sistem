-- 0027_lowcode_form_builder_custom_fields.sql
-- NEXUS ERP — Etapa 29: Designer Visual Low-Code, Form Builder, Campos Customizados e Configuração Sem Código
-- Objetivo: permitir configuração por cliente/tenant sem desenvolvimento:
-- campos customizados, formulários dinâmicos, layout, validações, regras de visibilidade,
-- formulários por módulo, formulários por etapa de workflow, preview, versionamento e publicação controlada.

CREATE TABLE IF NOT EXISTS lowcode_apps (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  segmento_codigo TEXT,
  status TEXT NOT NULL DEFAULT 'rascunho',
  owner_id TEXT REFERENCES usuarios(id),
  config_json TEXT NOT NULL DEFAULT '{}',
  created_by TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, codigo)
);

CREATE TABLE IF NOT EXISTS custom_field_definitions (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  entidade_tipo TEXT NOT NULL,
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  field_type TEXT NOT NULL DEFAULT 'text',
  data_type TEXT NOT NULL DEFAULT 'string',
  required INTEGER NOT NULL DEFAULT 0,
  searchable INTEGER NOT NULL DEFAULT 0,
  unique_value INTEGER NOT NULL DEFAULT 0,
  default_value TEXT,
  options_json TEXT NOT NULL DEFAULT '[]',
  validation_json TEXT NOT NULL DEFAULT '{}',
  visibility_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'ativo',
  created_by TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, entidade_tipo, codigo)
);

CREATE TABLE IF NOT EXISTS custom_field_values (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  field_id TEXT NOT NULL REFERENCES custom_field_definitions(id) ON DELETE CASCADE,
  entidade_tipo TEXT NOT NULL,
  entidade_id TEXT NOT NULL,
  valor_texto TEXT,
  valor_numero REAL,
  valor_data TEXT,
  valor_json TEXT,
  created_by TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, field_id, entidade_tipo, entidade_id)
);

CREATE TABLE IF NOT EXISTS form_definitions (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  app_id TEXT REFERENCES lowcode_apps(id) ON DELETE SET NULL,
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  entidade_tipo TEXT NOT NULL,
  modulo TEXT,
  workflow_id TEXT REFERENCES workflow_definitions(id),
  workflow_state_id TEXT REFERENCES workflow_states(id),
  status TEXT NOT NULL DEFAULT 'rascunho',
  current_version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT REFERENCES usuarios(id),
  published_by TEXT REFERENCES usuarios(id),
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, codigo)
);

CREATE TABLE IF NOT EXISTS form_versions (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  form_id TEXT NOT NULL REFERENCES form_definitions(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'rascunho',
  schema_json TEXT NOT NULL DEFAULT '{}',
  layout_json TEXT NOT NULL DEFAULT '{}',
  rules_json TEXT NOT NULL DEFAULT '[]',
  validations_json TEXT NOT NULL DEFAULT '[]',
  permissions_json TEXT NOT NULL DEFAULT '{}',
  change_log TEXT,
  created_by TEXT REFERENCES usuarios(id),
  published_by TEXT REFERENCES usuarios(id),
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, form_id, version)
);

CREATE TABLE IF NOT EXISTS form_sections (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  form_version_id TEXT NOT NULL REFERENCES form_versions(id) ON DELETE CASCADE,
  codigo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  ordem INTEGER NOT NULL DEFAULT 1,
  columns INTEGER NOT NULL DEFAULT 1,
  collapsible INTEGER NOT NULL DEFAULT 0,
  visibility_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS form_fields (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  form_version_id TEXT NOT NULL REFERENCES form_versions(id) ON DELETE CASCADE,
  section_id TEXT REFERENCES form_sections(id) ON DELETE SET NULL,
  custom_field_id TEXT REFERENCES custom_field_definitions(id),
  codigo TEXT NOT NULL,
  label TEXT NOT NULL,
  component_type TEXT NOT NULL DEFAULT 'input',
  data_binding TEXT,
  placeholder TEXT,
  help_text TEXT,
  ordem INTEGER NOT NULL DEFAULT 1,
  row_index INTEGER DEFAULT 1,
  col_span INTEGER DEFAULT 1,
  required INTEGER NOT NULL DEFAULT 0,
  readonly INTEGER NOT NULL DEFAULT 0,
  hidden INTEGER NOT NULL DEFAULT 0,
  options_json TEXT NOT NULL DEFAULT '[]',
  validation_json TEXT NOT NULL DEFAULT '{}',
  visibility_json TEXT NOT NULL DEFAULT '{}',
  default_value TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS form_rules (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  form_version_id TEXT NOT NULL REFERENCES form_versions(id) ON DELETE CASCADE,
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  trigger_event TEXT NOT NULL DEFAULT 'on_change',
  condition_json TEXT NOT NULL DEFAULT '{}',
  actions_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'ativo',
  ordem INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS form_submissions (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  form_id TEXT NOT NULL REFERENCES form_definitions(id),
  form_version_id TEXT NOT NULL REFERENCES form_versions(id),
  entidade_tipo TEXT NOT NULL,
  entidade_id TEXT,
  status TEXT NOT NULL DEFAULT 'rascunho',
  data_json TEXT NOT NULL DEFAULT '{}',
  validation_errors_json TEXT NOT NULL DEFAULT '[]',
  submitted_by TEXT REFERENCES usuarios(id),
  submitted_at TEXT,
  created_by TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS form_preview_sessions (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  form_version_id TEXT NOT NULL REFERENCES form_versions(id) ON DELETE CASCADE,
  preview_token TEXT NOT NULL,
  sample_data_json TEXT NOT NULL DEFAULT '{}',
  created_by TEXT REFERENCES usuarios(id),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, preview_token)
);

CREATE TABLE IF NOT EXISTS lowcode_publication_requests (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  entity_type TEXT NOT NULL DEFAULT 'form_version',
  entity_id TEXT NOT NULL,
  target_environment TEXT NOT NULL DEFAULT 'production',
  status TEXT NOT NULL DEFAULT 'pendente',
  requested_by TEXT REFERENCES usuarios(id),
  requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  approved_by TEXT REFERENCES usuarios(id),
  approved_at TEXT,
  published_at TEXT,
  rollback_ref TEXT,
  notes TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lowcode_environment_configs (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  environment TEXT NOT NULL DEFAULT 'production',
  config_key TEXT NOT NULL,
  config_value_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'ativo',
  updated_by TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, environment, config_key)
);

CREATE TABLE IF NOT EXISTS lowcode_component_registry (
  id TEXT PRIMARY KEY,
  org_id TEXT REFERENCES organizacoes(id),
  component_type TEXT NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  props_schema_json TEXT NOT NULL DEFAULT '{}',
  supported_data_types_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'ativo',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, component_type)
);

CREATE TABLE IF NOT EXISTS lowcode_change_log (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  actor_id TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lowcode_apps_org ON lowcode_apps(org_id, status, segmento_codigo);
CREATE INDEX IF NOT EXISTS idx_custom_fields_org ON custom_field_definitions(org_id, entidade_tipo, status);
CREATE INDEX IF NOT EXISTS idx_custom_values_entity ON custom_field_values(org_id, entidade_tipo, entidade_id);
CREATE INDEX IF NOT EXISTS idx_forms_org ON form_definitions(org_id, entidade_tipo, status);
CREATE INDEX IF NOT EXISTS idx_form_versions_org ON form_versions(org_id, form_id, status);
CREATE INDEX IF NOT EXISTS idx_form_submissions_org ON form_submissions(org_id, form_id, status);
CREATE INDEX IF NOT EXISTS idx_publication_requests_org ON lowcode_publication_requests(org_id, status, target_environment);

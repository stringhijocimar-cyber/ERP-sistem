-- 0024_customer_portal_self_service_deliveries.sql
-- NEXUS ERP — Etapa 26: Portal do Cliente, Autoatendimento, Tickets, Base de Conhecimento e Gestão de Entregas
-- Objetivo: criar portal externo do cliente para consultar contratos, assinaturas,
-- faturas, onboarding, documentos, tickets, entregas, mudanças, aprovações e feedback.

CREATE TABLE IF NOT EXISTS portal_customers (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  account_id TEXT NOT NULL REFERENCES crm_accounts(id),
  portal_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ativo',
  branding_json TEXT NOT NULL DEFAULT '{}',
  allowed_domains_json TEXT NOT NULL DEFAULT '[]',
  settings_json TEXT NOT NULL DEFAULT '{}',
  created_by TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, account_id)
);

CREATE TABLE IF NOT EXISTS portal_users (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  portal_customer_id TEXT NOT NULL REFERENCES portal_customers(id) ON DELETE CASCADE,
  contact_id TEXT REFERENCES crm_contacts(id),
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  status TEXT NOT NULL DEFAULT 'invited',
  last_login_at TEXT,
  invite_token TEXT,
  invite_expires_at TEXT,
  mfa_enabled INTEGER NOT NULL DEFAULT 0,
  created_by TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, email)
);

CREATE TABLE IF NOT EXISTS portal_sessions (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  portal_user_id TEXT NOT NULL REFERENCES portal_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS portal_permissions (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  role TEXT NOT NULL,
  recurso TEXT NOT NULL,
  permissao TEXT NOT NULL DEFAULT 'read',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, role, recurso, permissao)
);

CREATE TABLE IF NOT EXISTS portal_shared_documents (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  portal_customer_id TEXT NOT NULL REFERENCES portal_customers(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  documento_tipo TEXT NOT NULL DEFAULT 'arquivo',
  entidade_tipo TEXT,
  entidade_id TEXT,
  arquivo_url TEXT,
  conteudo_texto TEXT,
  classificacao TEXT NOT NULL DEFAULT 'cliente',
  status TEXT NOT NULL DEFAULT 'publicado',
  visible_from TEXT,
  visible_until TEXT,
  uploaded_by TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS portal_knowledge_articles (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  titulo TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'geral',
  resumo TEXT,
  conteudo TEXT NOT NULL,
  tags_json TEXT NOT NULL DEFAULT '[]',
  segmento_codigo TEXT,
  status TEXT NOT NULL DEFAULT 'publicado',
  visible_to_customer INTEGER NOT NULL DEFAULT 1,
  created_by TEXT REFERENCES usuarios(id),
  updated_by TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS portal_knowledge_feedback (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  article_id TEXT NOT NULL REFERENCES portal_knowledge_articles(id) ON DELETE CASCADE,
  portal_user_id TEXT REFERENCES portal_users(id),
  helpful INTEGER,
  comentario TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_deliveries (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  portal_customer_id TEXT REFERENCES portal_customers(id),
  account_id TEXT NOT NULL REFERENCES crm_accounts(id),
  contract_id TEXT REFERENCES commercial_contracts(id),
  onboarding_project_id TEXT,
  titulo TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT NOT NULL DEFAULT 'entrega',
  status TEXT NOT NULL DEFAULT 'planejada',
  prioridade TEXT NOT NULL DEFAULT 'media',
  planned_start TEXT,
  planned_end TEXT,
  actual_start TEXT,
  actual_end TEXT,
  owner_id TEXT REFERENCES usuarios(id),
  customer_owner_id TEXT REFERENCES portal_users(id),
  evidencia_json TEXT NOT NULL DEFAULT '[]',
  created_by TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_delivery_milestones (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  delivery_id TEXT NOT NULL REFERENCES customer_deliveries(id) ON DELETE CASCADE,
  ordem INTEGER NOT NULL DEFAULT 1,
  titulo TEXT NOT NULL,
  descricao TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',
  due_date TEXT,
  completed_at TEXT,
  completed_by TEXT REFERENCES usuarios(id),
  customer_visible INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_change_requests (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  portal_customer_id TEXT REFERENCES portal_customers(id),
  account_id TEXT NOT NULL REFERENCES crm_accounts(id),
  contract_id TEXT REFERENCES commercial_contracts(id),
  requested_by_portal_user TEXT REFERENCES portal_users(id),
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  justificativa TEXT,
  impacto_prazo_dias INTEGER DEFAULT 0,
  impacto_valor REAL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'solicitada',
  decisao TEXT,
  decidido_por TEXT REFERENCES usuarios(id),
  decidido_em TEXT,
  resposta TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_approvals (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  portal_customer_id TEXT NOT NULL REFERENCES portal_customers(id),
  account_id TEXT NOT NULL REFERENCES crm_accounts(id),
  entidade_tipo TEXT NOT NULL,
  entidade_id TEXT NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',
  due_date TEXT,
  requested_by TEXT REFERENCES usuarios(id),
  decided_by_portal_user TEXT REFERENCES portal_users(id),
  decisao TEXT,
  comentario_cliente TEXT,
  decided_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS portal_nps_surveys (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  portal_customer_id TEXT NOT NULL REFERENCES portal_customers(id),
  account_id TEXT NOT NULL REFERENCES crm_accounts(id),
  titulo TEXT NOT NULL DEFAULT 'Pesquisa NPS',
  status TEXT NOT NULL DEFAULT 'aberta',
  send_at TEXT,
  closes_at TEXT,
  created_by TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS portal_nps_responses (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  survey_id TEXT NOT NULL REFERENCES portal_nps_surveys(id) ON DELETE CASCADE,
  portal_user_id TEXT REFERENCES portal_users(id),
  score INTEGER NOT NULL,
  comentario TEXT,
  categoria TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS portal_audit_events (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  portal_customer_id TEXT REFERENCES portal_customers(id),
  portal_user_id TEXT REFERENCES portal_users(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  ip_address TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_portal_customers_org ON portal_customers(org_id, account_id, status);
CREATE INDEX IF NOT EXISTS idx_portal_users_customer ON portal_users(org_id, portal_customer_id, status);
CREATE INDEX IF NOT EXISTS idx_portal_docs_customer ON portal_shared_documents(org_id, portal_customer_id, status);
CREATE INDEX IF NOT EXISTS idx_knowledge_org ON portal_knowledge_articles(org_id, status, categoria);
CREATE INDEX IF NOT EXISTS idx_deliveries_account ON customer_deliveries(org_id, account_id, status);
CREATE INDEX IF NOT EXISTS idx_change_requests_account ON customer_change_requests(org_id, account_id, status);
CREATE INDEX IF NOT EXISTS idx_customer_approvals ON customer_approvals(org_id, portal_customer_id, status);
CREATE INDEX IF NOT EXISTS idx_nps_account ON portal_nps_surveys(org_id, account_id, status);
CREATE INDEX IF NOT EXISTS idx_portal_audit ON portal_audit_events(org_id, portal_user_id, created_at);

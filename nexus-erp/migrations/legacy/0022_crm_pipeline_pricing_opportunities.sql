-- 0022_crm_pipeline_pricing_opportunities.sql
-- NEXUS ERP — Etapa 24: CRM, Pipeline Comercial, Precificação, Aprovação Comercial e Gestão de Oportunidades
-- Objetivo: controlar leads, contas, contatos, oportunidades, pipeline, pricing,
-- descontos, aprovações comerciais, interações e conversão proposta → contrato.

CREATE TABLE IF NOT EXISTS crm_accounts (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  codigo TEXT NOT NULL,
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  cnpj TEXT,
  segmento_codigo TEXT,
  porte TEXT DEFAULT 'medio',
  origem TEXT DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'ativo',
  website TEXT,
  cidade TEXT,
  estado TEXT,
  pais TEXT DEFAULT 'Brasil',
  owner_id TEXT REFERENCES usuarios(id),
  metadata_json TEXT,
  created_by TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, codigo)
);

CREATE TABLE IF NOT EXISTS crm_contacts (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  account_id TEXT REFERENCES crm_accounts(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  cargo TEXT,
  area TEXT,
  email TEXT,
  telefone TEXT,
  whatsapp TEXT,
  decisor INTEGER NOT NULL DEFAULT 0,
  influenciador INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ativo',
  observacao TEXT,
  created_by TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS crm_leads (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  nome TEXT NOT NULL,
  empresa TEXT,
  email TEXT,
  telefone TEXT,
  segmento_codigo TEXT,
  origem TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'novo',
  score REAL DEFAULT 0,
  temperatura TEXT DEFAULT 'morno',
  necessidade TEXT,
  proximo_passo TEXT,
  owner_id TEXT REFERENCES usuarios(id),
  converted_account_id TEXT REFERENCES crm_accounts(id),
  converted_opportunity_id TEXT,
  converted_at TEXT,
  created_by TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS crm_pipeline_stages (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 1,
  probabilidade_padrao REAL DEFAULT 0,
  tipo TEXT NOT NULL DEFAULT 'open',
  criterio_saida TEXT,
  obrigatorio_proxima_acao INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'ativo',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, codigo)
);

CREATE TABLE IF NOT EXISTS crm_opportunities (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  codigo TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES crm_accounts(id),
  contact_id TEXT REFERENCES crm_contacts(id),
  lead_id TEXT REFERENCES crm_leads(id),
  titulo TEXT NOT NULL,
  segmento_codigo TEXT,
  stage_id TEXT REFERENCES crm_pipeline_stages(id),
  status TEXT NOT NULL DEFAULT 'aberta',
  valor_estimado REAL DEFAULT 0,
  moeda TEXT NOT NULL DEFAULT 'BRL',
  probabilidade REAL DEFAULT 0,
  expected_close_date TEXT,
  origem TEXT DEFAULT 'manual',
  dor_principal TEXT,
  proposta_valor TEXT,
  concorrentes_json TEXT NOT NULL DEFAULT '[]',
  riscos_json TEXT NOT NULL DEFAULT '[]',
  next_step TEXT,
  owner_id TEXT REFERENCES usuarios(id),
  created_by TEXT REFERENCES usuarios(id),
  closed_at TEXT,
  lost_reason TEXT,
  won_reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, codigo)
);

CREATE TABLE IF NOT EXISTS crm_opportunity_stage_history (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  opportunity_id TEXT NOT NULL REFERENCES crm_opportunities(id) ON DELETE CASCADE,
  from_stage_id TEXT REFERENCES crm_pipeline_stages(id),
  to_stage_id TEXT REFERENCES crm_pipeline_stages(id),
  changed_by TEXT REFERENCES usuarios(id),
  motivo TEXT,
  changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pricing_plans (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  moeda TEXT NOT NULL DEFAULT 'BRL',
  billing_period TEXT NOT NULL DEFAULT 'monthly',
  preco_base REAL NOT NULL DEFAULT 0,
  limite_usuarios INTEGER DEFAULT 5,
  modulos_json TEXT NOT NULL DEFAULT '[]',
  features_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'ativo',
  created_by TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, codigo)
);

CREATE TABLE IF NOT EXISTS pricing_items (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'recorrente',
  unidade TEXT DEFAULT 'mês',
  preco_unitario REAL NOT NULL DEFAULT 0,
  custo_unitario REAL DEFAULT 0,
  margem_minima_percentual REAL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ativo',
  created_by TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, codigo)
);

CREATE TABLE IF NOT EXISTS crm_quotes (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  opportunity_id TEXT NOT NULL REFERENCES crm_opportunities(id) ON DELETE CASCADE,
  proposal_id TEXT REFERENCES commercial_proposals(id),
  codigo TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'rascunho',
  moeda TEXT NOT NULL DEFAULT 'BRL',
  subtotal REAL DEFAULT 0,
  desconto_total REAL DEFAULT 0,
  total REAL DEFAULT 0,
  margem_percentual REAL DEFAULT 0,
  validade_ate TEXT,
  premissas_json TEXT NOT NULL DEFAULT '[]',
  observacao TEXT,
  created_by TEXT REFERENCES usuarios(id),
  approved_by TEXT REFERENCES usuarios(id),
  approved_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, codigo)
);

CREATE TABLE IF NOT EXISTS crm_quote_items (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  quote_id TEXT NOT NULL REFERENCES crm_quotes(id) ON DELETE CASCADE,
  pricing_item_id TEXT REFERENCES pricing_items(id),
  descricao TEXT NOT NULL,
  quantidade REAL NOT NULL DEFAULT 1,
  unidade TEXT DEFAULT 'un',
  preco_unitario REAL NOT NULL DEFAULT 0,
  custo_unitario REAL DEFAULT 0,
  desconto_percentual REAL DEFAULT 0,
  subtotal REAL DEFAULT 0,
  total REAL DEFAULT 0,
  margem_percentual REAL DEFAULT 0,
  ordem INTEGER DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS commercial_discount_policies (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  desconto_max_sem_aprovacao REAL DEFAULT 0,
  margem_minima_sem_aprovacao REAL DEFAULT 0,
  aprovador_role TEXT,
  status TEXT NOT NULL DEFAULT 'ativo',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, codigo)
);

CREATE TABLE IF NOT EXISTS commercial_approval_requests (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  entidade_tipo TEXT NOT NULL,
  entidade_id TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'desconto',
  status TEXT NOT NULL DEFAULT 'pendente',
  motivo TEXT,
  valor_impacto REAL DEFAULT 0,
  margem_percentual REAL DEFAULT 0,
  desconto_percentual REAL DEFAULT 0,
  requested_by TEXT REFERENCES usuarios(id),
  approver_id TEXT REFERENCES usuarios(id),
  decided_by TEXT REFERENCES usuarios(id),
  decided_at TEXT,
  decisao TEXT,
  comentario TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS crm_activities (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  account_id TEXT REFERENCES crm_accounts(id),
  contact_id TEXT REFERENCES crm_contacts(id),
  opportunity_id TEXT REFERENCES crm_opportunities(id),
  lead_id TEXT REFERENCES crm_leads(id),
  tipo TEXT NOT NULL DEFAULT 'nota',
  titulo TEXT NOT NULL,
  descricao TEXT,
  data_atividade TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  due_at TEXT,
  status TEXT NOT NULL DEFAULT 'aberta',
  resultado TEXT,
  owner_id TEXT REFERENCES usuarios(id),
  created_by TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS crm_interactions (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  account_id TEXT REFERENCES crm_accounts(id),
  contact_id TEXT REFERENCES crm_contacts(id),
  opportunity_id TEXT REFERENCES crm_opportunities(id),
  canal TEXT NOT NULL DEFAULT 'email',
  assunto TEXT,
  resumo TEXT,
  sentimento TEXT DEFAULT 'neutro',
  proximo_passo TEXT,
  interaction_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sales_forecasts (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  periodo TEXT NOT NULL,
  owner_id TEXT REFERENCES usuarios(id),
  pipeline_total REAL DEFAULT 0,
  weighted_total REAL DEFAULT 0,
  commit_total REAL DEFAULT 0,
  best_case_total REAL DEFAULT 0,
  oportunidades_json TEXT NOT NULL DEFAULT '[]',
  generated_by TEXT REFERENCES usuarios(id),
  generated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, periodo, owner_id)
);

CREATE TABLE IF NOT EXISTS crm_contract_conversions (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  opportunity_id TEXT NOT NULL REFERENCES crm_opportunities(id),
  quote_id TEXT REFERENCES crm_quotes(id),
  proposal_id TEXT REFERENCES commercial_proposals(id),
  contract_id TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',
  payload_json TEXT NOT NULL DEFAULT '{}',
  converted_by TEXT REFERENCES usuarios(id),
  converted_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_crm_accounts_org ON crm_accounts(org_id, status, segmento_codigo);
CREATE INDEX IF NOT EXISTS idx_crm_leads_org ON crm_leads(org_id, status, temperatura);
CREATE INDEX IF NOT EXISTS idx_crm_opps_org ON crm_opportunities(org_id, status, stage_id, owner_id);
CREATE INDEX IF NOT EXISTS idx_crm_quotes_org ON crm_quotes(org_id, opportunity_id, status);
CREATE INDEX IF NOT EXISTS idx_crm_activities_org ON crm_activities(org_id, status, due_at);
CREATE INDEX IF NOT EXISTS idx_crm_approvals_org ON commercial_approval_requests(org_id, status, entidade_tipo);
CREATE INDEX IF NOT EXISTS idx_sales_forecasts_org ON sales_forecasts(org_id, periodo);

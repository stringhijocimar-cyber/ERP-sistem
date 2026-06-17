-- 0023_commercial_contract_billing_customer_success.sql
-- NEXUS ERP — Etapa 25: Contrato Comercial, Assinatura, Billing e Customer Success
-- Objetivo: conectar oportunidade ganha/quote aprovada a contrato SaaS, assinatura,
-- billing preparado para gateway, onboarding pós-venda, customer success, health score,
-- renovação, expansão/up-sell, churn risk, tickets e handover comercial → implantação → operação.

CREATE TABLE IF NOT EXISTS commercial_contracts (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  account_id TEXT NOT NULL REFERENCES crm_accounts(id),
  opportunity_id TEXT REFERENCES crm_opportunities(id),
  quote_id TEXT REFERENCES crm_quotes(id),
  proposal_id TEXT REFERENCES commercial_proposals(id),
  codigo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'rascunho',
  tipo TEXT NOT NULL DEFAULT 'saas',
  data_inicio TEXT,
  data_fim TEXT,
  prazo_meses INTEGER DEFAULT 12,
  moeda TEXT NOT NULL DEFAULT 'BRL',
  valor_mensal REAL DEFAULT 0,
  valor_implantacao REAL DEFAULT 0,
  valor_total_contrato REAL DEFAULT 0,
  reajuste_indice TEXT DEFAULT 'IPCA',
  renovacao_automatica INTEGER NOT NULL DEFAULT 0,
  termos_json TEXT NOT NULL DEFAULT '[]',
  sla_json TEXT NOT NULL DEFAULT '[]',
  anexos_json TEXT NOT NULL DEFAULT '[]',
  assinatura_status TEXT NOT NULL DEFAULT 'pendente',
  signed_by_customer TEXT,
  signed_at TEXT,
  created_by TEXT REFERENCES usuarios(id),
  approved_by TEXT REFERENCES usuarios(id),
  approved_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, codigo)
);

CREATE TABLE IF NOT EXISTS commercial_contract_items (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  contract_id TEXT NOT NULL REFERENCES commercial_contracts(id) ON DELETE CASCADE,
  quote_item_id TEXT REFERENCES crm_quote_items(id),
  descricao TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'recorrente',
  quantidade REAL DEFAULT 1,
  unidade TEXT DEFAULT 'mês',
  preco_unitario REAL DEFAULT 0,
  total_mensal REAL DEFAULT 0,
  total_one_time REAL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS saas_customer_subscriptions (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  account_id TEXT NOT NULL REFERENCES crm_accounts(id),
  contract_id TEXT REFERENCES commercial_contracts(id),
  plano_codigo TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'trial',
  billing_cycle TEXT NOT NULL DEFAULT 'monthly',
  start_date TEXT,
  current_period_start TEXT,
  current_period_end TEXT,
  trial_end TEXT,
  cancel_at TEXT,
  canceled_at TEXT,
  cancellation_reason TEXT,
  mrr REAL DEFAULT 0,
  arr REAL DEFAULT 0,
  users_included INTEGER DEFAULT 5,
  modules_json TEXT NOT NULL DEFAULT '[]',
  external_subscription_id TEXT,
  created_by TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS billing_gateways (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'configurado',
  credentials_ref TEXT,
  config_json TEXT NOT NULL DEFAULT '{}',
  sandbox INTEGER NOT NULL DEFAULT 1,
  created_by TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, codigo)
);

CREATE TABLE IF NOT EXISTS billing_customers (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  account_id TEXT NOT NULL REFERENCES crm_accounts(id),
  gateway_id TEXT REFERENCES billing_gateways(id),
  external_customer_id TEXT,
  billing_name TEXT NOT NULL,
  billing_email TEXT,
  document_number TEXT,
  address_json TEXT,
  status TEXT NOT NULL DEFAULT 'ativo',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, account_id)
);

CREATE TABLE IF NOT EXISTS billing_invoices (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  subscription_id TEXT REFERENCES saas_customer_subscriptions(id),
  contract_id TEXT REFERENCES commercial_contracts(id),
  billing_customer_id TEXT REFERENCES billing_customers(id),
  gateway_id TEXT REFERENCES billing_gateways(id),
  numero TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'rascunho',
  competencia TEXT,
  issue_date TEXT,
  due_date TEXT,
  paid_at TEXT,
  moeda TEXT NOT NULL DEFAULT 'BRL',
  subtotal REAL DEFAULT 0,
  taxes REAL DEFAULT 0,
  discount REAL DEFAULT 0,
  total REAL DEFAULT 0,
  external_invoice_id TEXT,
  payment_url TEXT,
  boleto_url TEXT,
  pix_qr_code TEXT,
  erro TEXT,
  metadata_json TEXT,
  created_by TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, numero)
);

CREATE TABLE IF NOT EXISTS billing_invoice_items (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  invoice_id TEXT NOT NULL REFERENCES billing_invoices(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  quantidade REAL DEFAULT 1,
  preco_unitario REAL DEFAULT 0,
  total REAL DEFAULT 0,
  tipo TEXT DEFAULT 'recorrente',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS billing_payments (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  invoice_id TEXT NOT NULL REFERENCES billing_invoices(id),
  gateway_id TEXT REFERENCES billing_gateways(id),
  status TEXT NOT NULL DEFAULT 'pendente',
  metodo TEXT DEFAULT 'manual',
  valor REAL DEFAULT 0,
  paid_at TEXT,
  external_payment_id TEXT,
  comprovante_url TEXT,
  metadata_json TEXT,
  created_by TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS post_sale_handovers (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  account_id TEXT NOT NULL REFERENCES crm_accounts(id),
  opportunity_id TEXT REFERENCES crm_opportunities(id),
  contract_id TEXT REFERENCES commercial_contracts(id),
  status TEXT NOT NULL DEFAULT 'pendente',
  comercial_owner_id TEXT REFERENCES usuarios(id),
  implementation_owner_id TEXT REFERENCES usuarios(id),
  cs_owner_id TEXT REFERENCES usuarios(id),
  resumo_contexto TEXT,
  escopo_vendido_json TEXT NOT NULL DEFAULT '[]',
  riscos_json TEXT NOT NULL DEFAULT '[]',
  compromissos_json TEXT NOT NULL DEFAULT '[]',
  proximos_passos_json TEXT NOT NULL DEFAULT '[]',
  handover_at TEXT,
  created_by TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_success_accounts (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  account_id TEXT NOT NULL REFERENCES crm_accounts(id),
  subscription_id TEXT REFERENCES saas_customer_subscriptions(id),
  contract_id TEXT REFERENCES commercial_contracts(id),
  cs_owner_id TEXT REFERENCES usuarios(id),
  status TEXT NOT NULL DEFAULT 'ativo',
  etapa TEXT NOT NULL DEFAULT 'onboarding',
  health_score REAL DEFAULT 70,
  churn_risk_score REAL DEFAULT 30,
  nps_score REAL,
  last_touch_at TEXT,
  next_review_at TEXT,
  success_plan_json TEXT NOT NULL DEFAULT '{}',
  goals_json TEXT NOT NULL DEFAULT '[]',
  risks_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, account_id)
);

CREATE TABLE IF NOT EXISTS customer_onboarding_projects (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  cs_account_id TEXT NOT NULL REFERENCES customer_success_accounts(id) ON DELETE CASCADE,
  contract_id TEXT REFERENCES commercial_contracts(id),
  nome TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'em_andamento',
  progresso_percentual REAL DEFAULT 0,
  kickoff_date TEXT,
  target_golive_date TEXT,
  actual_golive_date TEXT,
  created_by TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_onboarding_tasks (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  onboarding_project_id TEXT NOT NULL REFERENCES customer_onboarding_projects(id) ON DELETE CASCADE,
  ordem INTEGER NOT NULL DEFAULT 1,
  titulo TEXT NOT NULL,
  descricao TEXT,
  etapa TEXT DEFAULT 'implantacao',
  status TEXT NOT NULL DEFAULT 'pendente',
  obrigatoria INTEGER NOT NULL DEFAULT 1,
  owner_id TEXT REFERENCES usuarios(id),
  due_date TEXT,
  completed_by TEXT REFERENCES usuarios(id),
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_health_events (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  cs_account_id TEXT NOT NULL REFERENCES customer_success_accounts(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  impacto_score REAL DEFAULT 0,
  descricao TEXT NOT NULL,
  metadata_json TEXT,
  created_by TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_success_tickets (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  cs_account_id TEXT REFERENCES customer_success_accounts(id),
  account_id TEXT REFERENCES crm_accounts(id),
  titulo TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT NOT NULL DEFAULT 'suporte',
  severidade TEXT NOT NULL DEFAULT 'media',
  status TEXT NOT NULL DEFAULT 'aberto',
  prioridade TEXT NOT NULL DEFAULT 'media',
  sla_due_at TEXT,
  assigned_to TEXT REFERENCES usuarios(id),
  resolved_by TEXT REFERENCES usuarios(id),
  resolved_at TEXT,
  created_by TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS renewal_opportunities (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  account_id TEXT NOT NULL REFERENCES crm_accounts(id),
  subscription_id TEXT REFERENCES saas_customer_subscriptions(id),
  contract_id TEXT REFERENCES commercial_contracts(id),
  tipo TEXT NOT NULL DEFAULT 'renovacao',
  status TEXT NOT NULL DEFAULT 'aberta',
  current_mrr REAL DEFAULT 0,
  target_mrr REAL DEFAULT 0,
  valor_potencial REAL DEFAULT 0,
  renewal_date TEXT,
  probabilidade REAL DEFAULT 50,
  owner_id TEXT REFERENCES usuarios(id),
  riscos_json TEXT NOT NULL DEFAULT '[]',
  recomendacao TEXT,
  created_by TEXT REFERENCES usuarios(id),
  closed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS expansion_opportunities (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  account_id TEXT NOT NULL REFERENCES crm_accounts(id),
  cs_account_id TEXT REFERENCES customer_success_accounts(id),
  tipo TEXT NOT NULL DEFAULT 'upsell',
  status TEXT NOT NULL DEFAULT 'aberta',
  titulo TEXT NOT NULL,
  descricao TEXT,
  current_mrr REAL DEFAULT 0,
  expansion_mrr REAL DEFAULT 0,
  valor_potencial REAL DEFAULT 0,
  probabilidade REAL DEFAULT 40,
  gatilho TEXT,
  owner_id TEXT REFERENCES usuarios(id),
  created_by TEXT REFERENCES usuarios(id),
  closed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_contracts_org ON commercial_contracts(org_id, account_id, status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_org ON saas_customer_subscriptions(org_id, account_id, status);
CREATE INDEX IF NOT EXISTS idx_billing_invoices_org ON billing_invoices(org_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_cs_accounts_org ON customer_success_accounts(org_id, status, health_score);
CREATE INDEX IF NOT EXISTS idx_cs_tickets_org ON customer_success_tickets(org_id, status, prioridade);
CREATE INDEX IF NOT EXISTS idx_renewals_org ON renewal_opportunities(org_id, status, renewal_date);
CREATE INDEX IF NOT EXISTS idx_expansions_org ON expansion_opportunities(org_id, status);

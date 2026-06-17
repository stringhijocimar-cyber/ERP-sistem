-- 0021_commercial_generation_sales_enablement.sql
-- NEXUS ERP — Etapa 23: Geração Comercial, Propostas, Demonstrações e Pitch por Segmento
-- Objetivo: transformar módulos, benchmarks, diferenciais e playbooks em materiais comerciais:
-- proposta, one-pager, demo script, pitch, business case, plano de implantação e comparativo.

CREATE TABLE IF NOT EXISTS commercial_offer_templates (
  id TEXT PRIMARY KEY,
  org_id TEXT REFERENCES organizacoes(id),
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'proposta',
  segmento_codigo TEXT,
  idioma TEXT NOT NULL DEFAULT 'pt-BR',
  estrutura_json TEXT NOT NULL DEFAULT '{}',
  conteudo_base TEXT,
  status TEXT NOT NULL DEFAULT 'ativo',
  created_by TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, codigo)
);

CREATE TABLE IF NOT EXISTS commercial_personas (
  id TEXT PRIMARY KEY,
  org_id TEXT REFERENCES organizacoes(id),
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  cargo_alvo TEXT,
  dores_json TEXT NOT NULL DEFAULT '[]',
  objetivos_json TEXT NOT NULL DEFAULT '[]',
  criterios_decisao_json TEXT NOT NULL DEFAULT '[]',
  objeções_json TEXT NOT NULL DEFAULT '[]',
  mensagens_chave_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'ativo',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, codigo)
);

CREATE TABLE IF NOT EXISTS commercial_value_propositions (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  segmento_codigo TEXT,
  persona_id TEXT REFERENCES commercial_personas(id),
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  problema TEXT,
  impacto_negocio TEXT,
  solucao TEXT,
  evidencia_json TEXT NOT NULL DEFAULT '[]',
  diferenciais_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'ativo',
  created_by TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS commercial_proposals (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  codigo TEXT NOT NULL,
  cliente_nome TEXT NOT NULL,
  segmento_codigo TEXT,
  titulo TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'rascunho',
  template_id TEXT REFERENCES commercial_offer_templates(id),
  comparison_run_id TEXT,
  valor_estimado REAL DEFAULT 0,
  moeda TEXT NOT NULL DEFAULT 'BRL',
  prazo_implantacao_dias INTEGER DEFAULT 30,
  premissas_json TEXT NOT NULL DEFAULT '[]',
  escopo_json TEXT NOT NULL DEFAULT '[]',
  fora_escopo_json TEXT NOT NULL DEFAULT '[]',
  riscos_json TEXT NOT NULL DEFAULT '[]',
  conteudo_json TEXT NOT NULL DEFAULT '{}',
  resumo_executivo TEXT,
  created_by TEXT REFERENCES usuarios(id),
  approved_by TEXT REFERENCES usuarios(id),
  approved_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, codigo)
);

CREATE TABLE IF NOT EXISTS commercial_proposal_sections (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  proposal_id TEXT NOT NULL REFERENCES commercial_proposals(id) ON DELETE CASCADE,
  ordem INTEGER NOT NULL DEFAULT 1,
  titulo TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'texto',
  conteudo TEXT,
  dados_json TEXT,
  evidencia_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS commercial_one_pagers (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  segmento_codigo TEXT,
  titulo TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'rascunho',
  headline TEXT,
  problema TEXT,
  proposta_valor TEXT,
  diferenciais_json TEXT NOT NULL DEFAULT '[]',
  provas_json TEXT NOT NULL DEFAULT '[]',
  call_to_action TEXT,
  conteudo_json TEXT NOT NULL DEFAULT '{}',
  created_by TEXT REFERENCES usuarios(id),
  approved_by TEXT REFERENCES usuarios(id),
  approved_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS commercial_demo_scripts (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  segmento_codigo TEXT,
  persona_id TEXT REFERENCES commercial_personas(id),
  titulo TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'rascunho',
  duracao_minutos INTEGER DEFAULT 30,
  roteiro_json TEXT NOT NULL DEFAULT '[]',
  perguntas_descoberta_json TEXT NOT NULL DEFAULT '[]',
  objeções_respostas_json TEXT NOT NULL DEFAULT '[]',
  evidencias_json TEXT NOT NULL DEFAULT '[]',
  created_by TEXT REFERENCES usuarios(id),
  approved_by TEXT REFERENCES usuarios(id),
  approved_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS commercial_pitch_decks (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  segmento_codigo TEXT,
  titulo TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'rascunho',
  publico_alvo TEXT NOT NULL DEFAULT 'executivo',
  slides_json TEXT NOT NULL DEFAULT '[]',
  narrativa TEXT,
  created_by TEXT REFERENCES usuarios(id),
  approved_by TEXT REFERENCES usuarios(id),
  approved_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS commercial_business_cases (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  cliente_nome TEXT,
  segmento_codigo TEXT,
  titulo TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'rascunho',
  baseline_json TEXT NOT NULL DEFAULT '{}',
  ganhos_json TEXT NOT NULL DEFAULT '[]',
  custos_json TEXT NOT NULL DEFAULT '[]',
  roi_percentual REAL DEFAULT 0,
  payback_meses REAL DEFAULT 0,
  premissas_json TEXT NOT NULL DEFAULT '[]',
  riscos_json TEXT NOT NULL DEFAULT '[]',
  created_by TEXT REFERENCES usuarios(id),
  approved_by TEXT REFERENCES usuarios(id),
  approved_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS commercial_implementation_plans (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  proposal_id TEXT REFERENCES commercial_proposals(id),
  segmento_codigo TEXT,
  titulo TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'rascunho',
  fases_json TEXT NOT NULL DEFAULT '[]',
  milestones_json TEXT NOT NULL DEFAULT '[]',
  responsabilidades_json TEXT NOT NULL DEFAULT '[]',
  riscos_json TEXT NOT NULL DEFAULT '[]',
  duracao_total_dias INTEGER DEFAULT 30,
  created_by TEXT REFERENCES usuarios(id),
  approved_by TEXT REFERENCES usuarios(id),
  approved_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS commercial_objection_library (
  id TEXT PRIMARY KEY,
  org_id TEXT REFERENCES organizacoes(id),
  segmento_codigo TEXT,
  objeção TEXT NOT NULL,
  resposta_recomendada TEXT NOT NULL,
  evidencia_json TEXT NOT NULL DEFAULT '[]',
  categoria TEXT NOT NULL DEFAULT 'comercial',
  status TEXT NOT NULL DEFAULT 'ativo',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS commercial_assets (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  tipo TEXT NOT NULL,
  entidade_tipo TEXT NOT NULL,
  entidade_id TEXT NOT NULL,
  titulo TEXT NOT NULL,
  formato TEXT NOT NULL DEFAULT 'json',
  conteudo_json TEXT,
  arquivo_url TEXT,
  status TEXT NOT NULL DEFAULT 'gerado',
  created_by TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS commercial_approval_events (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacoes(id),
  entidade_tipo TEXT NOT NULL,
  entidade_id TEXT NOT NULL,
  decisao TEXT NOT NULL,
  comentario TEXT,
  decided_by TEXT REFERENCES usuarios(id),
  decided_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_commercial_templates_org ON commercial_offer_templates(org_id, tipo, status);
CREATE INDEX IF NOT EXISTS idx_commercial_proposals_org ON commercial_proposals(org_id, status, segmento_codigo);
CREATE INDEX IF NOT EXISTS idx_commercial_onepagers_org ON commercial_one_pagers(org_id, status, segmento_codigo);
CREATE INDEX IF NOT EXISTS idx_commercial_demos_org ON commercial_demo_scripts(org_id, status, segmento_codigo);
CREATE INDEX IF NOT EXISTS idx_commercial_decks_org ON commercial_pitch_decks(org_id, status, segmento_codigo);
CREATE INDEX IF NOT EXISTS idx_commercial_cases_org ON commercial_business_cases(org_id, status, segmento_codigo);
CREATE INDEX IF NOT EXISTS idx_commercial_assets_org ON commercial_assets(org_id, entidade_tipo, entidade_id);

-- 0031_enterprise_consolidation_menu_documentation.sql
-- NEXUS ERP — Etapa 33: Consolidação Final, Menu Executivo, Documentação Técnica, Guia de Deploy, Testes Integrados e Pacote Enterprise
-- Objetivo: consolidar módulos, navegação executiva, catálogo funcional, ordem de migrations,
-- checklist de deploy, smoke tests, documentação, release package e governança final.

CREATE TABLE IF NOT EXISTS enterprise_module_catalog (
  id TEXT PRIMARY KEY,
  org_id TEXT REFERENCES organizacoes(id),
  module_code TEXT NOT NULL,
  module_name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'core',
  maturity_level TEXT NOT NULL DEFAULT 'prototype',
  business_owner TEXT,
  technical_owner TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  route_path TEXT,
  frontend_mount TEXT,
  backend_register_function TEXT,
  migration_refs_json TEXT NOT NULL DEFAULT '[]',
  dependencies_json TEXT NOT NULL DEFAULT '[]',
  capabilities_json TEXT NOT NULL DEFAULT '[]',
  risks_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, module_code)
);

CREATE TABLE IF NOT EXISTS executive_menu_items (
  id TEXT PRIMARY KEY,
  org_id TEXT REFERENCES organizacoes(id),
  parent_id TEXT REFERENCES executive_menu_items(id) ON DELETE CASCADE,
  menu_code TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  route_path TEXT,
  module_code TEXT,
  order_index INTEGER NOT NULL DEFAULT 1,
  visible INTEGER NOT NULL DEFAULT 1,
  required_roles_json TEXT NOT NULL DEFAULT '[]',
  required_flags_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, menu_code)
);

CREATE TABLE IF NOT EXISTS enterprise_deployment_checklists (
  id TEXT PRIMARY KEY,
  org_id TEXT REFERENCES organizacoes(id),
  checklist_code TEXT NOT NULL,
  checklist_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'deployment',
  environment TEXT NOT NULL DEFAULT 'production',
  status TEXT NOT NULL DEFAULT 'draft',
  items_json TEXT NOT NULL DEFAULT '[]',
  owner_id TEXT REFERENCES usuarios(id),
  created_by TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, checklist_code)
);

CREATE TABLE IF NOT EXISTS enterprise_test_suites (
  id TEXT PRIMARY KEY,
  org_id TEXT REFERENCES organizacoes(id),
  suite_code TEXT NOT NULL,
  suite_name TEXT NOT NULL,
  suite_type TEXT NOT NULL DEFAULT 'smoke',
  status TEXT NOT NULL DEFAULT 'active',
  test_files_json TEXT NOT NULL DEFAULT '[]',
  command TEXT,
  last_run_at TEXT,
  last_status TEXT,
  created_by TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, suite_code)
);

CREATE TABLE IF NOT EXISTS enterprise_test_runs (
  id TEXT PRIMARY KEY,
  org_id TEXT REFERENCES organizacoes(id),
  suite_id TEXT REFERENCES enterprise_test_suites(id),
  status TEXT NOT NULL DEFAULT 'queued',
  started_at TEXT,
  finished_at TEXT,
  total_tests INTEGER DEFAULT 0,
  passed_tests INTEGER DEFAULT 0,
  failed_tests INTEGER DEFAULT 0,
  result_json TEXT NOT NULL DEFAULT '{}',
  log_excerpt TEXT,
  executed_by TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS enterprise_release_packages (
  id TEXT PRIMARY KEY,
  org_id TEXT REFERENCES organizacoes(id),
  package_code TEXT NOT NULL,
  package_name TEXT NOT NULL,
  version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  included_modules_json TEXT NOT NULL DEFAULT '[]',
  included_migrations_json TEXT NOT NULL DEFAULT '[]',
  included_docs_json TEXT NOT NULL DEFAULT '[]',
  install_order_json TEXT NOT NULL DEFAULT '[]',
  known_limitations_json TEXT NOT NULL DEFAULT '[]',
  handoff_notes TEXT,
  created_by TEXT REFERENCES usuarios(id),
  approved_by TEXT REFERENCES usuarios(id),
  approved_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, package_code)
);

CREATE TABLE IF NOT EXISTS enterprise_handoff_notes (
  id TEXT PRIMARY KEY,
  org_id TEXT REFERENCES organizacoes(id),
  note_code TEXT NOT NULL,
  title TEXT NOT NULL,
  audience TEXT NOT NULL DEFAULT 'developer',
  priority TEXT NOT NULL DEFAULT 'medium',
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_by TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, note_code)
);

CREATE INDEX IF NOT EXISTS idx_enterprise_module_catalog_org ON enterprise_module_catalog(org_id, category, status);
CREATE INDEX IF NOT EXISTS idx_executive_menu_items_org ON executive_menu_items(org_id, parent_id, order_index);
CREATE INDEX IF NOT EXISTS idx_enterprise_checklists_org ON enterprise_deployment_checklists(org_id, category, environment);
CREATE INDEX IF NOT EXISTS idx_enterprise_test_runs_org ON enterprise_test_runs(org_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_enterprise_release_packages_org ON enterprise_release_packages(org_id, status, version);

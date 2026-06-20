PRAGMA foreign_keys = ON;

-- Usuarios (autenticacao). Senha NUNCA em texto puro: PBKDF2 + salt.
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  username      TEXT,
  name          TEXT,
  role          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  salt          TEXT NOT NULL,
  scopes        TEXT DEFAULT '[]',
  fornecedor_id TEXT,
  ativo         INTEGER DEFAULT 1,
  created_at    TEXT DEFAULT (datetime('now'))
);

-- Entidades "documento" (id + payload JSON). Flexivel e fiel ao que o
-- front-end ja envia/recebe como objetos.
CREATE TABLE IF NOT EXISTS fornecedores ( id TEXT PRIMARY KEY, payload TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS os           ( id TEXT PRIMARY KEY, payload TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS rc           ( id TEXT PRIMARY KEY, payload TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS rfq          ( id TEXT PRIMARY KEY, payload TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS mapas        ( id TEXT PRIMARY KEY, payload TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS pedidos      ( id TEXT PRIMARY KEY, payload TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS fluxo        ( id TEXT PRIMARY KEY, payload TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS contas_pagar ( id TEXT PRIMARY KEY, payload TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')) );

-- Entidades absorvidas do backend Express legado (consolidacao onto D1).
-- Mesmo modelo documento (id + payload JSON), servidas pelo CRUD generico
-- do Worker via a whitelist TABLES.
CREATE TABLE IF NOT EXISTS contratos    ( id TEXT PRIMARY KEY, payload TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS crm          ( id TEXT PRIMARY KEY, payload TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS projetos     ( id TEXT PRIMARY KEY, payload TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS ssma         ( id TEXT PRIMARY KEY, payload TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS almoxarifado ( id TEXT PRIMARY KEY, payload TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS recebimentos ( id TEXT PRIMARY KEY, payload TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS notas_fiscais ( id TEXT PRIMARY KEY, payload TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS notificacoes ( id TEXT PRIMARY KEY, payload TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS wbs_linhas ( id TEXT PRIMARY KEY, payload TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS aceites_servico ( id TEXT PRIMARY KEY, payload TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')) );

CREATE TABLE IF NOT EXISTS permissoes ( user_id TEXT PRIMARY KEY, permissoes TEXT DEFAULT '[]' );
CREATE TABLE IF NOT EXISTS config     ( chave TEXT PRIMARY KEY, valor TEXT );

-- Logs de aplicacao (o que o front-end lista em "Logs do Sistema").
CREATE TABLE IF NOT EXISTS logs (
  id        TEXT PRIMARY KEY,
  acao      TEXT, modulo TEXT, descricao TEXT, usuario_nome TEXT,
  criado_em TEXT DEFAULT (datetime('now'))
);

-- Trilha FORENSE append-only: so o servidor escreve, ninguem edita pelo app.
CREATE TABLE IF NOT EXISTS audit_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id   TEXT, action TEXT NOT NULL, entity TEXT, entity_id TEXT,
  payload    TEXT, created_at TEXT DEFAULT (datetime('now')),
  hash       TEXT, hash_anterior TEXT
);

CREATE INDEX IF NOT EXISTS idx_logs_modulo  ON logs(modulo, criado_em);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor  ON audit_log(actor_id, created_at);

-- Sequências atômicas (numeração sem corrida): PC/RC/RFQ/MAPA/CP por ano
CREATE TABLE IF NOT EXISTS sequences (
  tipo  TEXT NOT NULL,
  ano   INTEGER NOT NULL,
  valor INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (tipo, ano)
);

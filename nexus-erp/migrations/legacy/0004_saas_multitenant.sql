-- ============================================================
-- OpsCore ERP – Migração SaaS v2.0
-- Multi-tenant, Organizações, Leads, Billing, LGPD
-- ============================================================

-- ─── ORGANIZAÇÕES (tenants) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS organizacoes (
  id                TEXT PRIMARY KEY,
  nome              TEXT NOT NULL,
  slug              TEXT UNIQUE NOT NULL,
  cnpj              TEXT,
  email             TEXT NOT NULL,
  telefone          TEXT,
  segmento          TEXT,          -- Mineração, Construção, etc.
  plano             TEXT NOT NULL DEFAULT 'trial', -- trial|starter|professional|enterprise
  status            TEXT NOT NULL DEFAULT 'trial', -- trial|ativo|suspenso|cancelado|excluido
  trial_fim         TEXT,
  data_renovacao    TEXT,
  valor_mensalidade REAL DEFAULT 0,
  usuarios_max      INTEGER DEFAULT 5,
  storage_gb        INTEGER DEFAULT 5,
  motivo_exclusao   TEXT,
  criado_em         TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em     TEXT
);
CREATE INDEX IF NOT EXISTS idx_org_slug    ON organizacoes(slug);
CREATE INDEX IF NOT EXISTS idx_org_status  ON organizacoes(status);
CREATE INDEX IF NOT EXISTS idx_org_plano   ON organizacoes(plano);

-- ─── VÍNCULO USUÁRIO ↔ ORGANIZAÇÃO ───────────────────────────
CREATE TABLE IF NOT EXISTS usuarios_org (
  id         TEXT PRIMARY KEY,
  org_id     TEXT NOT NULL REFERENCES organizacoes(id) ON DELETE CASCADE,
  usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  papel      TEXT NOT NULL DEFAULT 'membro',  -- admin|membro|leitura
  ativo      INTEGER NOT NULL DEFAULT 1,
  criado_em  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(org_id, usuario_id)
);
CREATE INDEX IF NOT EXISTS idx_uorg_org  ON usuarios_org(org_id);
CREATE INDEX IF NOT EXISTS idx_uorg_user ON usuarios_org(usuario_id);

-- ─── LEADS (formulário da landing page) ───────────────────────
CREATE TABLE IF NOT EXISTS leads (
  id              TEXT PRIMARY KEY,
  nome            TEXT NOT NULL,
  email           TEXT NOT NULL,
  empresa         TEXT NOT NULL,
  telefone        TEXT,
  segmento        TEXT,
  plano_interesse TEXT DEFAULT 'trial',
  lgpd_aceito     INTEGER NOT NULL DEFAULT 0,
  lgpd_data       TEXT,
  status          TEXT NOT NULL DEFAULT 'novo',  -- novo|contatado|trial|convertido|perdido
  notas           TEXT,
  responsavel     TEXT,
  origem          TEXT DEFAULT 'landing',        -- landing|indicacao|evento|outro
  org_id          TEXT REFERENCES organizacoes(id),
  criado_em       TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em   TEXT
);
CREATE INDEX IF NOT EXISTS idx_leads_email  ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_data   ON leads(criado_em);

-- ─── HISTÓRICO DE BILLING ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS billing_historico (
  id           TEXT PRIMARY KEY,
  org_id       TEXT NOT NULL REFERENCES organizacoes(id),
  tipo         TEXT NOT NULL,  -- assinatura|upgrade|downgrade|cancelamento|estorno
  plano_de     TEXT,
  plano_para   TEXT,
  valor        REAL DEFAULT 0,
  status       TEXT DEFAULT 'pendente',  -- pendente|pago|estornado|falhou
  referencia   TEXT,  -- ID da transação no gateway
  gateway      TEXT DEFAULT 'manual',   -- stripe|asaas|pagar_me|manual
  notas        TEXT,
  criado_em    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_billing_org  ON billing_historico(org_id);
CREATE INDEX IF NOT EXISTS idx_billing_data ON billing_historico(criado_em);

-- ─── NOTIFICAÇÕES IN-APP ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS notificacoes (
  id          TEXT PRIMARY KEY,
  org_id      TEXT REFERENCES organizacoes(id),
  usuario_id  TEXT REFERENCES usuarios(id),
  tipo        TEXT NOT NULL,  -- info|warning|danger|success
  titulo      TEXT NOT NULL,
  mensagem    TEXT,
  link        TEXT,
  lida        INTEGER DEFAULT 0,
  criado_em   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notificacoes(usuario_id);
CREATE INDEX IF NOT EXISTS idx_notif_org  ON notificacoes(org_id);
CREATE INDEX IF NOT EXISTS idx_notif_lida ON notificacoes(lida);

-- ─── SOLICITAÇÕES LGPD ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lgpd_solicitacoes (
  id           TEXT PRIMARY KEY,
  org_id       TEXT REFERENCES organizacoes(id),
  usuario_id   TEXT REFERENCES usuarios(id),
  tipo         TEXT NOT NULL,  -- acesso|correcao|portabilidade|eliminacao|oposicao
  descricao    TEXT,
  status       TEXT DEFAULT 'recebida',  -- recebida|em_andamento|concluida|negada
  resposta     TEXT,
  prazo        TEXT,
  concluida_em TEXT,
  criado_em    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── INSERIR ORG DEMO (para desenvolvimento) ─────────────────
INSERT OR IGNORE INTO organizacoes(id,nome,slug,email,segmento,plano,status,usuarios_max,storage_gb)
VALUES('org-demo','Fraser Alexander Demo','fraser-demo','demo@fraseralexander.com','Mineração','professional','ativo',20,50);

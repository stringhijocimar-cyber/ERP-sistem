-- ============================================================
-- ERP Fraser Alexander – Schema D1 v1.0
-- Migração inicial: todas as entidades do sistema
-- ============================================================

-- ─── USUÁRIOS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usuarios (
  id          TEXT PRIMARY KEY,
  nome        TEXT NOT NULL,
  email       TEXT UNIQUE NOT NULL,
  senha_hash  TEXT NOT NULL,
  perfil      TEXT NOT NULL DEFAULT 'operacao',
  ativo       INTEGER NOT NULL DEFAULT 1,
  criado_em   TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em TEXT
);

-- ─── PERMISSÕES CUSTOMIZADAS POR USUÁRIO ──────────────────────
CREATE TABLE IF NOT EXISTS permissoes_usuario (
  id          TEXT PRIMARY KEY,
  usuario_id  TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  modulo      TEXT NOT NULL,
  acao        TEXT NOT NULL,
  permitido   INTEGER NOT NULL DEFAULT 1,
  UNIQUE(usuario_id, modulo, acao)
);

-- ─── LOGS DO SISTEMA ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS logs_sistema (
  id          TEXT PRIMARY KEY,
  usuario_id  TEXT REFERENCES usuarios(id),
  usuario_nome TEXT,
  acao        TEXT NOT NULL,
  modulo      TEXT NOT NULL,
  descricao   TEXT,
  ip          TEXT,
  criado_em   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_logs_usuario ON logs_sistema(usuario_id);
CREATE INDEX IF NOT EXISTS idx_logs_modulo ON logs_sistema(modulo);
CREATE INDEX IF NOT EXISTS idx_logs_data ON logs_sistema(criado_em);

-- ─── FORNECEDORES ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fornecedores (
  id            TEXT PRIMARY KEY,
  nome          TEXT NOT NULL,
  razao_social  TEXT,
  cnpj          TEXT UNIQUE,
  email         TEXT,
  telefone      TEXT,
  contato_nome  TEXT,
  endereco      TEXT,
  cidade        TEXT,
  estado        TEXT,
  categoria     TEXT,
  ativo         INTEGER NOT NULL DEFAULT 1,
  score_medio   REAL DEFAULT 0,
  total_avaliacoes INTEGER DEFAULT 0,
  criado_em     TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em TEXT
);
CREATE INDEX IF NOT EXISTS idx_forn_nome ON fornecedores(nome);
CREATE INDEX IF NOT EXISTS idx_forn_cnpj ON fornecedores(cnpj);

-- ─── AVALIAÇÕES DE FORNECEDORES ───────────────────────────────
CREATE TABLE IF NOT EXISTS avaliacoes_fornecedor (
  id              TEXT PRIMARY KEY,
  fornecedor_id   TEXT NOT NULL REFERENCES fornecedores(id),
  fornecedor_nome TEXT NOT NULL,
  pedido_id       TEXT,
  pedido_numero   TEXT,
  nota_qualidade  REAL,
  nota_prazo      REAL,
  nota_preco      REAL,
  nota_atendimento REAL,
  nota_media      REAL,
  comentario      TEXT,
  avaliado_por    TEXT,
  criado_em       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_aval_forn ON avaliacoes_fornecedor(fornecedor_id);

-- ─── ORDENS DE SERVIÇO ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ordens_servico (
  id              TEXT PRIMARY KEY,
  numero          TEXT UNIQUE NOT NULL,
  titulo          TEXT NOT NULL,
  descricao       TEXT,
  solicitante     TEXT,
  solicitante_id  TEXT REFERENCES usuarios(id),
  tipo            TEXT DEFAULT 'Manutenção',
  prioridade      TEXT DEFAULT 'Normal',
  status          TEXT NOT NULL DEFAULT 'Aberta',
  local           TEXT,
  equipamento     TEXT,
  data_abertura   TEXT NOT NULL DEFAULT (datetime('now')),
  data_prazo      TEXT,
  data_conclusao  TEXT,
  responsavel     TEXT,
  observacoes     TEXT,
  requer_compra   INTEGER DEFAULT 0,
  criado_em       TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em   TEXT
);
CREATE INDEX IF NOT EXISTS idx_os_status ON ordens_servico(status);
CREATE INDEX IF NOT EXISTS idx_os_numero ON ordens_servico(numero);

-- ─── ITENS DE ORDEM DE SERVIÇO ────────────────────────────────
CREATE TABLE IF NOT EXISTS os_itens (
  id          TEXT PRIMARY KEY,
  os_id       TEXT NOT NULL REFERENCES ordens_servico(id) ON DELETE CASCADE,
  descricao   TEXT NOT NULL,
  qtd         REAL DEFAULT 1,
  unidade     TEXT DEFAULT 'Un',
  observacao  TEXT
);

-- ─── HISTÓRICO DE OS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS os_historico (
  id          TEXT PRIMARY KEY,
  os_id       TEXT NOT NULL REFERENCES ordens_servico(id) ON DELETE CASCADE,
  acao        TEXT NOT NULL,
  usuario     TEXT,
  usuario_id  TEXT,
  data        TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── FLUXO DE APROVAÇÃO DE OS ────────────────────────────────
CREATE TABLE IF NOT EXISTS fluxo_aprovacao_os (
  id              TEXT PRIMARY KEY,
  os_id           TEXT NOT NULL REFERENCES ordens_servico(id) ON DELETE CASCADE,
  os_numero       TEXT,
  os_descricao    TEXT,
  status          TEXT NOT NULL DEFAULT 'Aguardando Aprovação',
  estagio_atual   INTEGER DEFAULT 1,
  criado_em       TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em   TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_fluxo_os_id ON fluxo_aprovacao_os(os_id);

-- ─── ESTÁGIOS DE APROVAÇÃO ────────────────────────────────────
CREATE TABLE IF NOT EXISTS aprovacao_estagios (
  id              TEXT PRIMARY KEY,
  fluxo_id        TEXT NOT NULL REFERENCES fluxo_aprovacao_os(id) ON DELETE CASCADE,
  estagio         INTEGER NOT NULL,
  nome            TEXT,
  status          TEXT NOT NULL DEFAULT 'Aguardando',
  aprovador       TEXT,
  aprovador_id    TEXT REFERENCES usuarios(id),
  data            TEXT,
  observacao      TEXT
);
CREATE INDEX IF NOT EXISTS idx_aprov_fluxo ON aprovacao_estagios(fluxo_id);

-- ─── REQUISIÇÕES DE COMPRA ────────────────────────────────────
CREATE TABLE IF NOT EXISTS requisicoes_compra (
  id              TEXT PRIMARY KEY,
  numero          TEXT UNIQUE NOT NULL,
  titulo          TEXT NOT NULL,
  descricao       TEXT,
  solicitante     TEXT,
  solicitante_id  TEXT REFERENCES usuarios(id),
  os_id           TEXT REFERENCES ordens_servico(id),
  os_numero       TEXT,
  fluxo_id        TEXT REFERENCES fluxo_aprovacao_os(id),
  status          TEXT NOT NULL DEFAULT 'Rascunho',
  prioridade      TEXT DEFAULT 'Normal',
  valor_estimado  REAL DEFAULT 0,
  valor_total     REAL DEFAULT 0,
  data_necessidade TEXT,
  observacoes     TEXT,
  criado_em       TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em   TEXT
);
CREATE INDEX IF NOT EXISTS idx_rc_status ON requisicoes_compra(status);
CREATE INDEX IF NOT EXISTS idx_rc_os ON requisicoes_compra(os_id);

-- ─── ITENS DE REQUISIÇÃO ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS rc_itens (
  id          TEXT PRIMARY KEY,
  rc_id       TEXT NOT NULL REFERENCES requisicoes_compra(id) ON DELETE CASCADE,
  descricao   TEXT NOT NULL,
  qtd         REAL DEFAULT 1,
  unidade     TEXT DEFAULT 'Un',
  preco_unit  REAL DEFAULT 0,
  total       REAL DEFAULT 0,
  observacao  TEXT
);

-- ─── HISTÓRICO DE RC ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rc_historico (
  id          TEXT PRIMARY KEY,
  rc_id       TEXT NOT NULL REFERENCES requisicoes_compra(id) ON DELETE CASCADE,
  acao        TEXT NOT NULL,
  usuario     TEXT,
  usuario_id  TEXT,
  data        TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── RFQ (REQUEST FOR QUOTATION) ─────────────────────────────
CREATE TABLE IF NOT EXISTS rfq (
  id              TEXT PRIMARY KEY,
  numero          TEXT UNIQUE NOT NULL,
  titulo          TEXT NOT NULL,
  rc_id           TEXT REFERENCES requisicoes_compra(id),
  rc_numero       TEXT,
  os_id           TEXT REFERENCES ordens_servico(id),
  status          TEXT NOT NULL DEFAULT 'Rascunho',
  data_limite     TEXT,
  data_envio      TEXT,
  observacoes     TEXT,
  criado_por      TEXT,
  criado_por_id   TEXT REFERENCES usuarios(id),
  criado_em       TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em   TEXT
);
CREATE INDEX IF NOT EXISTS idx_rfq_status ON rfq(status);
CREATE INDEX IF NOT EXISTS idx_rfq_rc ON rfq(rc_id);

-- ─── ITENS DO RFQ ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rfq_itens (
  id          TEXT PRIMARY KEY,
  rfq_id      TEXT NOT NULL REFERENCES rfq(id) ON DELETE CASCADE,
  descricao   TEXT NOT NULL,
  qtd         REAL DEFAULT 1,
  unidade     TEXT DEFAULT 'Un',
  especificacao TEXT
);

-- ─── FORNECEDORES CONVIDADOS NO RFQ ───────────────────────────
CREATE TABLE IF NOT EXISTS rfq_fornecedores (
  id              TEXT PRIMARY KEY,
  rfq_id          TEXT NOT NULL REFERENCES rfq(id) ON DELETE CASCADE,
  fornecedor_id   TEXT REFERENCES fornecedores(id),
  fornecedor_nome TEXT NOT NULL,
  email           TEXT,
  status_resposta TEXT DEFAULT 'Aguardando',
  enviado_em      TEXT,
  respondido_em   TEXT
);
CREATE INDEX IF NOT EXISTS idx_rfq_forn ON rfq_fornecedores(rfq_id);

-- ─── COTAÇÕES (RESPOSTAS DO RFQ) ─────────────────────────────
CREATE TABLE IF NOT EXISTS cotacoes (
  id              TEXT PRIMARY KEY,
  rfq_id          TEXT NOT NULL REFERENCES rfq(id) ON DELETE CASCADE,
  fornecedor_id   TEXT REFERENCES fornecedores(id),
  fornecedor_nome TEXT NOT NULL,
  valor_total     REAL DEFAULT 0,
  prazo_entrega   TEXT,
  condicao_pag    TEXT,
  validade        TEXT,
  observacoes     TEXT,
  recebida_em     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cot_rfq ON cotacoes(rfq_id);

-- ─── ITENS DE COTAÇÃO ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cotacao_itens (
  id          TEXT PRIMARY KEY,
  cotacao_id  TEXT NOT NULL REFERENCES cotacoes(id) ON DELETE CASCADE,
  rfq_item_id TEXT REFERENCES rfq_itens(id),
  descricao   TEXT NOT NULL,
  qtd         REAL DEFAULT 1,
  unidade     TEXT DEFAULT 'Un',
  preco_unit  REAL DEFAULT 0,
  total       REAL DEFAULT 0
);

-- ─── MAPAS COMPARATIVOS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS mapas_comparativos (
  id                    TEXT PRIMARY KEY,
  numero                TEXT UNIQUE NOT NULL,
  rfq_id                TEXT REFERENCES rfq(id),
  rfq_numero            TEXT,
  rc_id                 TEXT REFERENCES requisicoes_compra(id),
  rc_numero             TEXT,
  os_id                 TEXT REFERENCES ordens_servico(id),
  titulo                TEXT,
  status                TEXT NOT NULL DEFAULT 'Em Análise',
  fornecedor_selecionado TEXT,
  fornecedor_id         TEXT REFERENCES fornecedores(id),
  criterio              TEXT DEFAULT 'Menor Preço',
  valor_total           REAL DEFAULT 0,
  score_ia              TEXT,
  justificativa         TEXT,
  pc_numero             TEXT,
  aprovado_por          TEXT,
  aprovado_por_id       TEXT REFERENCES usuarios(id),
  aprovado_em           TEXT,
  reprovado_por         TEXT,
  motivo_reprovacao     TEXT,
  criado_por            TEXT,
  criado_por_id         TEXT REFERENCES usuarios(id),
  criado_em             TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em         TEXT
);
CREATE INDEX IF NOT EXISTS idx_mapa_status ON mapas_comparativos(status);
CREATE INDEX IF NOT EXISTS idx_mapa_rfq ON mapas_comparativos(rfq_id);

-- ─── HISTÓRICO DE MAPAS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS mapa_historico (
  id          TEXT PRIMARY KEY,
  mapa_id     TEXT NOT NULL REFERENCES mapas_comparativos(id) ON DELETE CASCADE,
  acao        TEXT NOT NULL,
  usuario     TEXT,
  usuario_id  TEXT,
  data        TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── PEDIDOS DE COMPRA ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pedidos_compra (
  id                  TEXT PRIMARY KEY,
  numero              TEXT UNIQUE NOT NULL,
  fornecedor_id       TEXT REFERENCES fornecedores(id),
  fornecedor          TEXT NOT NULL,
  mapa_id             TEXT REFERENCES mapas_comparativos(id),
  mapa_numero         TEXT,
  rfq_id              TEXT REFERENCES rfq(id),
  rfq_numero          TEXT,
  rc_id               TEXT REFERENCES requisicoes_compra(id),
  rc_numero           TEXT,
  os_id               TEXT REFERENCES ordens_servico(id),
  valor_total         REAL DEFAULT 0,
  condicao_pagamento  TEXT,
  prazo_entrega       TEXT,
  local_entrega       TEXT,
  observacoes         TEXT,
  status              TEXT NOT NULL DEFAULT 'Emitido',
  data_emissao        TEXT NOT NULL DEFAULT (datetime('now')),
  emitido_por         TEXT,
  emitido_por_id      TEXT REFERENCES usuarios(id),
  envio_agendado      INTEGER DEFAULT 0,
  envio_canal         TEXT,
  envio_data          TEXT,
  envio_email         TEXT,
  data_entrega        TEXT,
  recebido_por        TEXT,
  motivo_cancelamento TEXT,
  data_cancelamento   TEXT,
  cancelado_por       TEXT,
  atualizado_em       TEXT
);
CREATE INDEX IF NOT EXISTS idx_pc_status ON pedidos_compra(status);
CREATE INDEX IF NOT EXISTS idx_pc_fornecedor ON pedidos_compra(fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_pc_numero ON pedidos_compra(numero);

-- ─── ITENS DO PEDIDO DE COMPRA ────────────────────────────────
CREATE TABLE IF NOT EXISTS pc_itens (
  id          TEXT PRIMARY KEY,
  pc_id       TEXT NOT NULL REFERENCES pedidos_compra(id) ON DELETE CASCADE,
  descricao   TEXT NOT NULL,
  qtd         REAL DEFAULT 1,
  unidade     TEXT DEFAULT 'Un',
  preco_unit  REAL DEFAULT 0,
  total       REAL DEFAULT 0
);

-- ─── HISTÓRICO DO PEDIDO ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS pc_historico (
  id          TEXT PRIMARY KEY,
  pc_id       TEXT NOT NULL REFERENCES pedidos_compra(id) ON DELETE CASCADE,
  acao        TEXT NOT NULL,
  usuario     TEXT,
  usuario_id  TEXT,
  data        TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── LOG DE ENVIOS DO PEDIDO ──────────────────────────────────
CREATE TABLE IF NOT EXISTS pc_envio_log (
  id          TEXT PRIMARY KEY,
  pc_id       TEXT NOT NULL REFERENCES pedidos_compra(id) ON DELETE CASCADE,
  descricao   TEXT,
  canal       TEXT,
  email       TEXT,
  data        TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── CONTAS A PAGAR ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contas_pagar (
  id              TEXT PRIMARY KEY,
  numero          TEXT UNIQUE NOT NULL,
  descricao       TEXT NOT NULL,
  fornecedor_id   TEXT REFERENCES fornecedores(id),
  fornecedor      TEXT,
  pc_id           TEXT REFERENCES pedidos_compra(id),
  pc_numero       TEXT,
  valor_total     REAL DEFAULT 0,
  data_vencimento TEXT,
  data_pagamento  TEXT,
  status          TEXT NOT NULL DEFAULT 'A Pagar',
  tipo            TEXT DEFAULT 'Compra',
  observacoes     TEXT,
  criado_em       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cp_status ON contas_pagar(status);
CREATE INDEX IF NOT EXISTS idx_cp_vencimento ON contas_pagar(data_vencimento);

-- ─── CONFIG DE APROVAÇÃO ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS config_aprovacao (
  id          TEXT PRIMARY KEY DEFAULT 'default',
  dados_json  TEXT NOT NULL DEFAULT '{}',
  atualizado_em TEXT
);
INSERT OR IGNORE INTO config_aprovacao(id, dados_json) VALUES('default', '{}');

-- ─── SESSÕES DE USUÁRIO ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessoes (
  token       TEXT PRIMARY KEY,
  usuario_id  TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  expira_em   TEXT NOT NULL,
  ip          TEXT,
  criado_em   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sess_usuario ON sessoes(usuario_id);

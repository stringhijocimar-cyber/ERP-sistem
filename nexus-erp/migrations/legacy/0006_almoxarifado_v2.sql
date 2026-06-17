-- ============================================================
-- Migration 0006: Almoxarifado v2 – Rastreabilidade completa
-- Tabelas: almox_itens, almox_movimentos, almox_emprestimos
-- ============================================================

-- ─── ITENS DO ALMOXARIFADO (Catálogo/Inventário) ─────────────
CREATE TABLE IF NOT EXISTS almox_itens (
  id                TEXT PRIMARY KEY,
  codigo            TEXT UNIQUE NOT NULL,
  nome              TEXT NOT NULL,
  descricao         TEXT,
  categoria         TEXT DEFAULT 'Geral',
  tipo              TEXT DEFAULT 'Material',   -- Material | Equipamento | Ferramenta | EPI | Consumivel
  unidade           TEXT DEFAULT 'UN',
  estoque_atual     REAL NOT NULL DEFAULT 0,
  estoque_minimo    REAL DEFAULT 0,
  estoque_maximo    REAL DEFAULT 0,
  localizacao       TEXT,                       -- Prateleira / Galpão / Setor
  fornecedor_id     TEXT REFERENCES fornecedores(id),
  fornecedor_nome   TEXT,
  preco_unitario    REAL DEFAULT 0,
  numero_serie      TEXT,                       -- Para equipamentos/ferramentas
  patrimonio        TEXT,                       -- Número de patrimônio
  observacoes       TEXT,
  ativo             INTEGER NOT NULL DEFAULT 1,
  criado_por        TEXT,
  criado_em         TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em     TEXT
);
CREATE INDEX IF NOT EXISTS idx_almox_itens_codigo ON almox_itens(codigo);
CREATE INDEX IF NOT EXISTS idx_almox_itens_categoria ON almox_itens(categoria);
CREATE INDEX IF NOT EXISTS idx_almox_itens_tipo ON almox_itens(tipo);

-- ─── MOVIMENTOS DO ALMOXARIFADO ──────────────────────────────
CREATE TABLE IF NOT EXISTS almox_movimentos (
  id                TEXT PRIMARY KEY,
  numero            TEXT UNIQUE NOT NULL,       -- MOV-YYYYMMDD-XXXX
  tipo              TEXT NOT NULL,              -- Entrada | Saída | Transferência | Ajuste | Devolução
  item_id           TEXT NOT NULL REFERENCES almox_itens(id),
  item_nome         TEXT NOT NULL,
  item_codigo       TEXT,
  quantidade        REAL NOT NULL,
  quantidade_antes  REAL NOT NULL DEFAULT 0,    -- Saldo antes
  quantidade_depois REAL NOT NULL DEFAULT 0,    -- Saldo depois
  unidade           TEXT DEFAULT 'UN',
  -- Vínculos de origem (rastreabilidade)
  pedido_id         TEXT REFERENCES pedidos_compra(id),
  pedido_numero     TEXT,
  recebimento_id    TEXT REFERENCES recebimentos(id),
  recebimento_numero TEXT,
  os_id             TEXT REFERENCES ordens_servico(id),
  os_numero         TEXT,
  projeto_id        TEXT,
  projeto_nome      TEXT,
  contrato_id       TEXT,
  -- Destino / Responsabilidade
  destinatario      TEXT,                       -- Quem retirou / recebeu
  destinatario_id   TEXT REFERENCES usuarios(id),
  setor_destino     TEXT,                       -- Setor / Centro de custo
  local_destino     TEXT,                       -- Localização física
  -- Dados fiscais
  nota_fiscal       TEXT,
  valor_unitario    REAL DEFAULT 0,
  valor_total       REAL DEFAULT 0,
  fornecedor_id     TEXT REFERENCES fornecedores(id),
  fornecedor_nome   TEXT,
  -- Inspeção / Conformidade
  status_inspecao   TEXT DEFAULT 'Conforme',   -- Conforme | Divergente | Recusado
  obs_inspecao      TEXT,
  -- Controle
  observacoes       TEXT,
  responsavel       TEXT NOT NULL,
  responsavel_id    TEXT REFERENCES usuarios(id),
  cp_gerado         INTEGER NOT NULL DEFAULT 0,
  cp_id             TEXT,
  emprestimo_id     TEXT,                       -- Link para almox_emprestimos se for retirada
  criado_em         TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_almox_mov_item ON almox_movimentos(item_id);
CREATE INDEX IF NOT EXISTS idx_almox_mov_tipo ON almox_movimentos(tipo);
CREATE INDEX IF NOT EXISTS idx_almox_mov_pedido ON almox_movimentos(pedido_id);
CREATE INDEX IF NOT EXISTS idx_almox_mov_recebimento ON almox_movimentos(recebimento_id);
CREATE INDEX IF NOT EXISTS idx_almox_mov_os ON almox_movimentos(os_id);
CREATE INDEX IF NOT EXISTS idx_almox_mov_data ON almox_movimentos(criado_em);
CREATE INDEX IF NOT EXISTS idx_almox_mov_destinatario ON almox_movimentos(destinatario_id);

-- ─── EMPRÉSTIMOS / RETIRADAS RASTREADAS ──────────────────────
CREATE TABLE IF NOT EXISTS almox_emprestimos (
  id                TEXT PRIMARY KEY,
  numero            TEXT UNIQUE NOT NULL,       -- EMP-YYYYMMDD-XXXX
  item_id           TEXT NOT NULL REFERENCES almox_itens(id),
  item_nome         TEXT NOT NULL,
  item_codigo       TEXT,
  quantidade        REAL NOT NULL,
  unidade           TEXT DEFAULT 'UN',
  -- Responsável pela retirada
  retirado_por      TEXT NOT NULL,
  retirado_por_id   TEXT REFERENCES usuarios(id),
  setor             TEXT,
  -- Vínculos
  os_id             TEXT REFERENCES ordens_servico(id),
  os_numero         TEXT,
  projeto_id        TEXT,
  projeto_nome      TEXT,
  local_uso         TEXT,
  -- Controle de devolução
  status            TEXT NOT NULL DEFAULT 'Ativo',  -- Ativo | Devolvido | Parcial | Perdido
  data_retirada     TEXT NOT NULL DEFAULT (datetime('now')),
  data_prevista_dev TEXT,
  data_devolucao    TEXT,
  quantidade_devolvida REAL DEFAULT 0,
  devolvido_por     TEXT,
  obs_devolucao     TEXT,
  -- Movimentos vinculados
  mov_saida_id      TEXT REFERENCES almox_movimentos(id),
  mov_devolucao_id  TEXT REFERENCES almox_movimentos(id),
  observacoes       TEXT,
  criado_em         TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em     TEXT
);
CREATE INDEX IF NOT EXISTS idx_almox_emp_item ON almox_emprestimos(item_id);
CREATE INDEX IF NOT EXISTS idx_almox_emp_status ON almox_emprestimos(status);
CREATE INDEX IF NOT EXISTS idx_almox_emp_retirado ON almox_emprestimos(retirado_por_id);
CREATE INDEX IF NOT EXISTS idx_almox_emp_os ON almox_emprestimos(os_id);

-- ─── AJUSTE DE INVENTÁRIO ────────────────────────────────────
CREATE TABLE IF NOT EXISTS almox_inventario (
  id                TEXT PRIMARY KEY,
  numero            TEXT UNIQUE NOT NULL,       -- INV-YYYYMMDD-XXXX
  item_id           TEXT NOT NULL REFERENCES almox_itens(id),
  item_nome         TEXT,
  qtd_sistema       REAL NOT NULL DEFAULT 0,
  qtd_contada       REAL NOT NULL DEFAULT 0,
  diferenca         REAL GENERATED ALWAYS AS (qtd_contada - qtd_sistema) VIRTUAL,
  justificativa     TEXT,
  responsavel       TEXT,
  responsavel_id    TEXT REFERENCES usuarios(id),
  status            TEXT DEFAULT 'Pendente',   -- Pendente | Aprovado | Rejeitado
  aprovado_por      TEXT,
  criado_em         TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_almox_inv_item ON almox_inventario(item_id);

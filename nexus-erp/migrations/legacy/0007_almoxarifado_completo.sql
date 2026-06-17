-- Migration 0007: Almoxarifado Completo
-- Tabelas: materiais, movimentos_estoque, inventarios, emprestimos
-- Autor: Fraser Alexander ERP v6.1

-- ============================================================
-- TABELA DE MATERIAIS (catálogo completo)
-- ============================================================
CREATE TABLE IF NOT EXISTS materiais (
  id              TEXT PRIMARY KEY,
  codigo          TEXT UNIQUE NOT NULL,
  nome            TEXT NOT NULL,
  descricao       TEXT,
  categoria       TEXT,
  subcategoria    TEXT,
  unidade         TEXT NOT NULL DEFAULT 'UN',
  tipo            TEXT NOT NULL DEFAULT 'Material', -- Material | Equipamento | EPI | Ferramenta | Consumivel
  marca           TEXT,
  modelo          TEXT,
  numero_serie    TEXT,
  localizacao     TEXT,                             -- ex: "Prateleira A1, Galpão 2"
  foto_url        TEXT,
  estoque_atual   REAL NOT NULL DEFAULT 0,
  estoque_minimo  REAL NOT NULL DEFAULT 0,
  estoque_maximo  REAL,
  valor_unitario  REAL DEFAULT 0,
  pedido_id       TEXT,                             -- último pedido de compra vinculado
  recebimento_id  TEXT,                             -- último recebimento vinculado
  ativo           INTEGER NOT NULL DEFAULT 1,
  criado_por      TEXT,
  criado_em       TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_mat_codigo    ON materiais(codigo);
CREATE INDEX IF NOT EXISTS idx_mat_nome      ON materiais(nome);
CREATE INDEX IF NOT EXISTS idx_mat_tipo      ON materiais(tipo);
CREATE INDEX IF NOT EXISTS idx_mat_categoria ON materiais(categoria);

-- ============================================================
-- TABELA DE MOVIMENTOS DE ESTOQUE
-- ============================================================
CREATE TABLE IF NOT EXISTS movimentos_estoque (
  id              TEXT PRIMARY KEY,
  numero          TEXT NOT NULL,                    -- MOV-2026-0001
  material_id     TEXT NOT NULL,
  material_nome   TEXT,
  material_codigo TEXT,
  tipo            TEXT NOT NULL,                    -- Entrada | Saída | Transferência | Ajuste | Devolução
  subtipo         TEXT,                             -- Compra | Recebimento | Baixa | Inventário | Empréstimo
  quantidade      REAL NOT NULL,
  unidade         TEXT,
  valor_unitario  REAL DEFAULT 0,
  valor_total     REAL DEFAULT 0,
  estoque_antes   REAL DEFAULT 0,
  estoque_depois  REAL DEFAULT 0,
  -- Vínculos
  pedido_id       TEXT,
  pedido_numero   TEXT,
  recebimento_id  TEXT,
  recebimento_num TEXT,
  os_id           TEXT,
  os_numero       TEXT,
  emprestimo_id   TEXT,
  inventario_id   TEXT,
  -- Dados NF/fiscal
  nota_fiscal     TEXT,
  fornecedor_id   TEXT,
  fornecedor_nome TEXT,
  -- Logística
  local_origem    TEXT,
  local_destino   TEXT,
  -- Responsabilidade
  responsavel_id  TEXT,
  responsavel     TEXT NOT NULL,
  solicitante     TEXT,
  -- Rastreabilidade
  numero_serie    TEXT,
  lote            TEXT,
  -- Observações e status
  observacoes     TEXT,
  status          TEXT NOT NULL DEFAULT 'Efetivado',  -- Efetivado | Cancelado | Pendente
  cancelado_por   TEXT,
  cancelado_em    TEXT,
  motivo_cancelamento TEXT,
  -- Controle
  criado_em       TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_mov_material  ON movimentos_estoque(material_id);
CREATE INDEX IF NOT EXISTS idx_mov_tipo      ON movimentos_estoque(tipo);
CREATE INDEX IF NOT EXISTS idx_mov_data      ON movimentos_estoque(criado_em);
CREATE INDEX IF NOT EXISTS idx_mov_pedido    ON movimentos_estoque(pedido_id);
CREATE INDEX IF NOT EXISTS idx_mov_receb     ON movimentos_estoque(recebimento_id);
CREATE INDEX IF NOT EXISTS idx_mov_resp      ON movimentos_estoque(responsavel);

-- ============================================================
-- TABELA DE INVENTÁRIOS
-- ============================================================
CREATE TABLE IF NOT EXISTS inventarios (
  id              TEXT PRIMARY KEY,
  numero          TEXT NOT NULL,                    -- INV-2026-001
  descricao       TEXT,
  tipo            TEXT NOT NULL DEFAULT 'Geral',    -- Geral | Parcial | Cíclico
  status          TEXT NOT NULL DEFAULT 'Aberto',   -- Aberto | Em Contagem | Concluído | Cancelado
  data_inicio     TEXT NOT NULL DEFAULT (date('now')),
  data_fim        TEXT,
  responsavel     TEXT NOT NULL,
  aprovador       TEXT,
  aprovado_em     TEXT,
  local_filtro    TEXT,                             -- filtro de localização se parcial
  categoria_filtro TEXT,                            -- filtro de categoria se parcial
  total_itens     INTEGER DEFAULT 0,
  itens_contados  INTEGER DEFAULT 0,
  divergencias    INTEGER DEFAULT 0,
  obs             TEXT,
  criado_por      TEXT,
  criado_em       TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_inv_status ON inventarios(status);
CREATE INDEX IF NOT EXISTS idx_inv_data   ON inventarios(data_inicio);

-- ============================================================
-- TABELA DE ITENS DO INVENTÁRIO
-- ============================================================
CREATE TABLE IF NOT EXISTS inventario_itens (
  id              TEXT PRIMARY KEY,
  inventario_id   TEXT NOT NULL REFERENCES inventarios(id),
  material_id     TEXT NOT NULL,
  material_nome   TEXT,
  material_codigo TEXT,
  unidade         TEXT,
  localizacao     TEXT,
  estoque_sistema REAL NOT NULL DEFAULT 0,          -- quantidade no sistema antes da contagem
  estoque_contado REAL,                             -- quantidade física contada
  divergencia     REAL,                             -- estoque_contado - estoque_sistema
  status          TEXT NOT NULL DEFAULT 'Pendente', -- Pendente | Contado | Ajustado
  ajustado        INTEGER DEFAULT 0,
  obs             TEXT,
  contado_por     TEXT,
  contado_em      TEXT,
  criado_em       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_inv_item_inv ON inventario_itens(inventario_id);
CREATE INDEX IF NOT EXISTS idx_inv_item_mat ON inventario_itens(material_id);

-- ============================================================
-- TABELA DE EMPRÉSTIMOS / COMODATOS
-- ============================================================
CREATE TABLE IF NOT EXISTS emprestimos (
  id              TEXT PRIMARY KEY,
  numero          TEXT NOT NULL,                    -- EMP-2026-001
  material_id     TEXT NOT NULL,
  material_nome   TEXT,
  material_codigo TEXT,
  numero_serie    TEXT,
  quantidade      REAL NOT NULL DEFAULT 1,
  unidade         TEXT,
  -- Quem pegou
  responsavel_retirada TEXT NOT NULL,
  responsavel_id_retirada TEXT,
  matricula_retirada TEXT,
  setor_retirada  TEXT,
  -- Autorização
  autorizado_por  TEXT,
  -- Datas
  data_retirada   TEXT NOT NULL DEFAULT (date('now')),
  data_prevista_devolucao TEXT,
  data_devolucao  TEXT,                             -- preenchida ao devolver
  -- Quem devolveu
  responsavel_devolucao TEXT,
  responsavel_id_devolucao TEXT,
  -- Destino / uso
  local_uso       TEXT,
  os_id           TEXT,
  os_numero       TEXT,
  projeto_id      TEXT,
  projeto_nome    TEXT,
  finalidade      TEXT,
  -- Estado
  condicao_retirada TEXT DEFAULT 'Bom',             -- Bom | Regular | Danificado
  condicao_devolucao TEXT,
  -- Status
  status          TEXT NOT NULL DEFAULT 'Ativo',    -- Ativo | Devolvido | Atrasado | Perdido
  obs_retirada    TEXT,
  obs_devolucao   TEXT,
  -- Controle
  criado_por      TEXT,
  criado_em       TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_emp_material  ON emprestimos(material_id);
CREATE INDEX IF NOT EXISTS idx_emp_status    ON emprestimos(status);
CREATE INDEX IF NOT EXISTS idx_emp_resp      ON emprestimos(responsavel_retirada);
CREATE INDEX IF NOT EXISTS idx_emp_data      ON emprestimos(data_retirada);

-- ============================================================
-- TABELA DE LOCALIZAÇÕES DO ALMOXARIFADO
-- ============================================================
CREATE TABLE IF NOT EXISTS almox_localizacoes (
  id              TEXT PRIMARY KEY,
  codigo          TEXT UNIQUE NOT NULL,             -- ex: A-01-01 (corredor-prateleira-posição)
  descricao       TEXT NOT NULL,
  tipo            TEXT DEFAULT 'Prateleira',        -- Prateleira | Gaveta | Pallet | Área
  capacidade      REAL,
  ativo           INTEGER DEFAULT 1,
  criado_em       TEXT NOT NULL DEFAULT (datetime('now'))
);

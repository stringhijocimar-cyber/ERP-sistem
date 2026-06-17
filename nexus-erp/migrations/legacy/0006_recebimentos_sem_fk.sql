-- Migration 0006: Recriar tabela recebimentos sem FK obrigatória
-- (pedidos criados via localStorage não existem no D1)

DROP TABLE IF EXISTS recebimentos_old;

-- Renomeia a tabela atual para backup
CREATE TABLE IF NOT EXISTS recebimentos_old AS SELECT * FROM recebimentos;

-- Recria sem FK
DROP TABLE IF EXISTS recebimentos;

CREATE TABLE IF NOT EXISTS recebimentos (
  id                 TEXT PRIMARY KEY,
  numero             TEXT NOT NULL,
  pedido_id          TEXT NOT NULL,
  pedido_numero      TEXT,
  fornecedor_id      TEXT,
  fornecedor         TEXT,
  nf_numero          TEXT NOT NULL,
  valor_nf           REAL NOT NULL DEFAULT 0,
  data_recebimento   TEXT,
  conferente         TEXT,
  status             TEXT NOT NULL DEFAULT 'Conforme',
  local_entrega      TEXT,
  obs                TEXT,
  anexo_nf           TEXT,
  itens_inspecao     TEXT,
  cp_gerado          INTEGER NOT NULL DEFAULT 0,
  criado_em          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Restaura dados se existiam
INSERT OR IGNORE INTO recebimentos SELECT * FROM recebimentos_old;
DROP TABLE IF EXISTS recebimentos_old;

CREATE INDEX IF NOT EXISTS idx_recebimentos_pedido ON recebimentos(pedido_id);
CREATE INDEX IF NOT EXISTS idx_recebimentos_nf     ON recebimentos(nf_numero);

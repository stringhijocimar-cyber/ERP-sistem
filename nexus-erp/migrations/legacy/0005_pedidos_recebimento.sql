-- Migration 0005: Adicionar campos de recebimento na tabela pedidos_compra
-- e criar tabela de recebimentos + expandir contas_pagar

-- Adicionar colunas de recebimento na tabela pedidos_compra
ALTER TABLE pedidos_compra ADD COLUMN nf_numero TEXT;
ALTER TABLE pedidos_compra ADD COLUMN valor_nf REAL;
ALTER TABLE pedidos_compra ADD COLUMN obs_recebimento TEXT;

-- Adicionar colunas extras em contas_pagar
ALTER TABLE contas_pagar ADD COLUMN nota_fiscal TEXT;
ALTER TABLE contas_pagar ADD COLUMN cond_pagamento TEXT;
ALTER TABLE contas_pagar ADD COLUMN conta_contabil TEXT;
ALTER TABLE contas_pagar ADD COLUMN centro_custo TEXT;
ALTER TABLE contas_pagar ADD COLUMN data_emissao TEXT;

-- Criar tabela de recebimentos
CREATE TABLE IF NOT EXISTS recebimentos (
  id                 TEXT PRIMARY KEY,
  numero             TEXT NOT NULL,
  pedido_id          TEXT NOT NULL REFERENCES pedidos_compra(id),
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

CREATE INDEX IF NOT EXISTS idx_recebimentos_pedido ON recebimentos(pedido_id);
CREATE INDEX IF NOT EXISTS idx_recebimentos_nf ON recebimentos(nf_numero);

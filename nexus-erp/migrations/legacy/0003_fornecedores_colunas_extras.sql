-- ============================================================
-- Migração 0003: Adicionar colunas extras na tabela fornecedores
-- Campos comerciais, bancários e IDF não presentes no schema inicial
-- ============================================================

ALTER TABLE fornecedores ADD COLUMN prazo_pagamento  INTEGER DEFAULT 30;
ALTER TABLE fornecedores ADD COLUMN limite_credito   REAL    DEFAULT 0;
ALTER TABLE fornecedores ADD COLUMN documentos_ok    INTEGER DEFAULT 1;
ALTER TABLE fornecedores ADD COLUMN status           TEXT    DEFAULT 'Ativo';
ALTER TABLE fornecedores ADD COLUMN banco            TEXT;
ALTER TABLE fornecedores ADD COLUMN agencia          TEXT;
ALTER TABLE fornecedores ADD COLUMN conta            TEXT;
ALTER TABLE fornecedores ADD COLUMN tipo_conta       TEXT    DEFAULT 'Corrente';
ALTER TABLE fornecedores ADD COLUMN pix              TEXT;
ALTER TABLE fornecedores ADD COLUMN pix_tipo         TEXT    DEFAULT 'CNPJ';
ALTER TABLE fornecedores ADD COLUMN score_idf        REAL    DEFAULT 0;
ALTER TABLE fornecedores ADD COLUMN idf_classificacao TEXT;
ALTER TABLE fornecedores ADD COLUMN idf_avaliado_em  TEXT;
ALTER TABLE fornecedores ADD COLUMN total_pedidos    INTEGER DEFAULT 0;
ALTER TABLE fornecedores ADD COLUMN total_gasto      REAL    DEFAULT 0;

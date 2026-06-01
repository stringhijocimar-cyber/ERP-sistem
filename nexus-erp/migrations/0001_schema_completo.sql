-- ============================================================
-- NEXUS ERP – Schema Completo v3.0
-- ============================================================
PRAGMA foreign_keys = ON;

-- Usuários
CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  senha_hash TEXT NOT NULL DEFAULT '$2b$10$placeholder',
  perfil TEXT NOT NULL DEFAULT 'operacao',
  ativo INTEGER NOT NULL DEFAULT 1,
  avatar TEXT,
  tenant_id TEXT DEFAULT 'default',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Sessões
CREATE TABLE IF NOT EXISTS sessoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT UNIQUE NOT NULL,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  expira_em TEXT NOT NULL,
  ip TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Fornecedores
CREATE TABLE IF NOT EXISTS fornecedores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  cnpj TEXT,
  email TEXT,
  telefone TEXT,
  contato TEXT,
  endereco TEXT,
  cidade TEXT,
  estado TEXT,
  categoria TEXT DEFAULT 'Geral',
  ativo INTEGER DEFAULT 1,
  banco TEXT,
  agencia TEXT,
  conta TEXT,
  prazo_entrega INTEGER DEFAULT 7,
  condicao_pagamento TEXT DEFAULT '30 dias',
  observacoes TEXT,
  score_medio REAL DEFAULT 0,
  tenant_id TEXT DEFAULT 'default',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Avaliações de Fornecedor
CREATE TABLE IF NOT EXISTS avaliacoes_fornecedor (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fornecedor_id INTEGER NOT NULL REFERENCES fornecedores(id),
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  usuario_nome TEXT,
  nota_qualidade REAL DEFAULT 0,
  nota_prazo REAL DEFAULT 0,
  nota_preco REAL DEFAULT 0,
  nota_atendimento REAL DEFAULT 0,
  nota_media REAL DEFAULT 0,
  comentario TEXT,
  pedido_id INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Ordens de Serviço
CREATE TABLE IF NOT EXISTS ordens_servico (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  numero TEXT UNIQUE NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  solicitante_id INTEGER REFERENCES usuarios(id),
  solicitante_nome TEXT,
  departamento TEXT,
  prioridade TEXT DEFAULT 'Normal',
  status TEXT DEFAULT 'Rascunho',
  valor_estimado REAL DEFAULT 0,
  centro_custo TEXT,
  projeto TEXT,
  data_necessidade TEXT,
  aprovado_em TEXT,
  aprovado_por TEXT,
  tenant_id TEXT DEFAULT 'default',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Fluxo de Aprovação OS
CREATE TABLE IF NOT EXISTS fluxo_aprovacao (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  os_id INTEGER NOT NULL REFERENCES ordens_servico(id),
  estagio INTEGER DEFAULT 1,
  tipo TEXT DEFAULT 'OS',
  aprovador_id INTEGER REFERENCES usuarios(id),
  aprovador_nome TEXT,
  status TEXT DEFAULT 'Pendente',
  comentario TEXT,
  data_acao TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Requisições de Compra
CREATE TABLE IF NOT EXISTS requisicoes_compra (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  numero TEXT UNIQUE NOT NULL,
  os_id INTEGER REFERENCES ordens_servico(id),
  os_numero TEXT,
  solicitante_id INTEGER REFERENCES usuarios(id),
  solicitante_nome TEXT,
  departamento TEXT,
  status TEXT DEFAULT 'Rascunho',
  prioridade TEXT DEFAULT 'Normal',
  valor_total REAL DEFAULT 0,
  observacoes TEXT,
  aprovado_em TEXT,
  aprovado_por TEXT,
  tenant_id TEXT DEFAULT 'default',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Itens da RC
CREATE TABLE IF NOT EXISTS rc_itens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rc_id INTEGER NOT NULL REFERENCES requisicoes_compra(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  quantidade REAL DEFAULT 1,
  unidade TEXT DEFAULT 'UN',
  valor_unitario_estimado REAL DEFAULT 0,
  valor_total_estimado REAL DEFAULT 0,
  codigo_produto TEXT,
  especificacao TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- RFQ – Request for Quotation
CREATE TABLE IF NOT EXISTS rfq (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  numero TEXT UNIQUE NOT NULL,
  rc_id INTEGER REFERENCES requisicoes_compra(id),
  rc_numero TEXT,
  titulo TEXT NOT NULL,
  descricao TEXT,
  status TEXT DEFAULT 'Aberta',
  prazo_resposta TEXT,
  comprador_id INTEGER REFERENCES usuarios(id),
  comprador_nome TEXT,
  valor_estimado REAL DEFAULT 0,
  tenant_id TEXT DEFAULT 'default',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Fornecedores convidados para RFQ
CREATE TABLE IF NOT EXISTS rfq_fornecedores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rfq_id INTEGER NOT NULL REFERENCES rfq(id) ON DELETE CASCADE,
  fornecedor_id INTEGER NOT NULL REFERENCES fornecedores(id),
  fornecedor_nome TEXT,
  status TEXT DEFAULT 'Convidado',
  enviado_em TEXT,
  respondido_em TEXT
);

-- Cotações (propostas dos fornecedores)
CREATE TABLE IF NOT EXISTS cotacoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rfq_id INTEGER NOT NULL REFERENCES rfq(id),
  fornecedor_id INTEGER NOT NULL REFERENCES fornecedores(id),
  fornecedor_nome TEXT,
  status TEXT DEFAULT 'Recebida',
  valor_total REAL DEFAULT 0,
  prazo_entrega INTEGER DEFAULT 7,
  condicao_pagamento TEXT,
  observacoes TEXT,
  vencedor INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Itens da Cotação
CREATE TABLE IF NOT EXISTS cotacao_itens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cotacao_id INTEGER NOT NULL REFERENCES cotacoes(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  quantidade REAL DEFAULT 1,
  unidade TEXT DEFAULT 'UN',
  valor_unitario REAL DEFAULT 0,
  valor_total REAL DEFAULT 0
);

-- Mapas Comparativos
CREATE TABLE IF NOT EXISTS mapas_comparativos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  numero TEXT UNIQUE NOT NULL,
  rfq_id INTEGER NOT NULL REFERENCES rfq(id),
  rfq_numero TEXT,
  cotacao_vencedora_id INTEGER REFERENCES cotacoes(id),
  fornecedor_vencedor_id INTEGER REFERENCES fornecedores(id),
  fornecedor_vencedor_nome TEXT,
  status TEXT DEFAULT 'Em análise',
  valor_aprovado REAL DEFAULT 0,
  economia_gerada REAL DEFAULT 0,
  aprovado_em TEXT,
  aprovado_por TEXT,
  justificativa TEXT,
  tenant_id TEXT DEFAULT 'default',
  created_at TEXT DEFAULT (datetime('now'))
);

-- Pedidos de Compra
CREATE TABLE IF NOT EXISTS pedidos_compra (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  numero TEXT UNIQUE NOT NULL,
  mapa_id INTEGER REFERENCES mapas_comparativos(id),
  mapa_numero TEXT,
  rc_id INTEGER REFERENCES requisicoes_compra(id),
  fornecedor_id INTEGER NOT NULL REFERENCES fornecedores(id),
  fornecedor_nome TEXT,
  status TEXT DEFAULT 'Emitido',
  valor_total REAL DEFAULT 0,
  prazo_entrega TEXT,
  condicao_pagamento TEXT DEFAULT '30 dias',
  local_entrega TEXT,
  observacoes TEXT,
  enviado_em TEXT,
  enviado_por TEXT,
  entregue_em TEXT,
  recebedor TEXT,
  cancelado_em TEXT,
  motivo_cancelamento TEXT,
  comprador_id INTEGER REFERENCES usuarios(id),
  comprador_nome TEXT,
  tenant_id TEXT DEFAULT 'default',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Itens do PC
CREATE TABLE IF NOT EXISTS pc_itens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pc_id INTEGER NOT NULL REFERENCES pedidos_compra(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  quantidade REAL DEFAULT 1,
  unidade TEXT DEFAULT 'UN',
  valor_unitario REAL DEFAULT 0,
  valor_total REAL DEFAULT 0,
  codigo_produto TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Histórico do PC
CREATE TABLE IF NOT EXISTS pc_historico (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pc_id INTEGER NOT NULL REFERENCES pedidos_compra(id),
  usuario_nome TEXT,
  acao TEXT NOT NULL,
  descricao TEXT,
  status_de TEXT,
  status_para TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Contas a Pagar (gerado automaticamente ao emitir PC)
CREATE TABLE IF NOT EXISTS contas_pagar (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  numero TEXT UNIQUE NOT NULL,
  pc_id INTEGER REFERENCES pedidos_compra(id),
  pc_numero TEXT,
  fornecedor_id INTEGER REFERENCES fornecedores(id),
  fornecedor_nome TEXT,
  descricao TEXT,
  valor REAL DEFAULT 0,
  data_vencimento TEXT,
  data_pagamento TEXT,
  status TEXT DEFAULT 'Pendente',
  forma_pagamento TEXT,
  banco TEXT,
  agencia TEXT,
  conta TEXT,
  observacoes TEXT,
  tenant_id TEXT DEFAULT 'default',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Almoxarifado – Itens
CREATE TABLE IF NOT EXISTS almoxarifado_itens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT,
  descricao TEXT NOT NULL,
  categoria TEXT DEFAULT 'Geral',
  unidade TEXT DEFAULT 'UN',
  quantidade_atual REAL DEFAULT 0,
  quantidade_minima REAL DEFAULT 0,
  quantidade_maxima REAL DEFAULT 999,
  localizacao TEXT,
  valor_medio REAL DEFAULT 0,
  ativo INTEGER DEFAULT 1,
  tenant_id TEXT DEFAULT 'default',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Movimentações de Estoque
CREATE TABLE IF NOT EXISTS almoxarifado_movimentos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL REFERENCES almoxarifado_itens(id),
  tipo TEXT NOT NULL,
  quantidade REAL NOT NULL,
  valor_unitario REAL DEFAULT 0,
  documento TEXT,
  observacao TEXT,
  usuario_id INTEGER REFERENCES usuarios(id),
  usuario_nome TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Logs do Sistema
CREATE TABLE IF NOT EXISTS logs_sistema (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER,
  usuario_nome TEXT,
  acao TEXT NOT NULL,
  modulo TEXT,
  descricao TEXT,
  ip TEXT,
  tenant_id TEXT DEFAULT 'default',
  created_at TEXT DEFAULT (datetime('now'))
);

-- Config do Sistema
CREATE TABLE IF NOT EXISTS config_sistema (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chave TEXT UNIQUE NOT NULL,
  valor TEXT,
  descricao TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Contratos
CREATE TABLE IF NOT EXISTS contratos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  numero TEXT UNIQUE NOT NULL,
  titulo TEXT NOT NULL,
  fornecedor_id INTEGER REFERENCES fornecedores(id),
  fornecedor_nome TEXT,
  tipo TEXT DEFAULT 'Serviço',
  status TEXT DEFAULT 'Ativo',
  valor_total REAL DEFAULT 0,
  data_inicio TEXT,
  data_fim TEXT,
  objeto TEXT,
  responsavel_id INTEGER REFERENCES usuarios(id),
  responsavel_nome TEXT,
  tenant_id TEXT DEFAULT 'default',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Medições de Contrato
CREATE TABLE IF NOT EXISTS medicoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  numero TEXT UNIQUE NOT NULL,
  contrato_id INTEGER NOT NULL REFERENCES contratos(id),
  contrato_numero TEXT,
  periodo_inicio TEXT,
  periodo_fim TEXT,
  valor_medicao REAL DEFAULT 0,
  status TEXT DEFAULT 'Aberta',
  aprovado_em TEXT,
  aprovado_por TEXT,
  observacoes TEXT,
  tenant_id TEXT DEFAULT 'default',
  created_at TEXT DEFAULT (datetime('now'))
);

-- CRM – Oportunidades
CREATE TABLE IF NOT EXISTS crm_oportunidades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  titulo TEXT NOT NULL,
  cliente TEXT NOT NULL,
  valor REAL DEFAULT 0,
  estagio TEXT DEFAULT 'Prospecção',
  probabilidade INTEGER DEFAULT 10,
  responsavel_id INTEGER REFERENCES usuarios(id),
  responsavel_nome TEXT,
  data_fechamento TEXT,
  observacoes TEXT,
  tenant_id TEXT DEFAULT 'default',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Projetos (Gantt)
CREATE TABLE IF NOT EXISTS projetos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  descricao TEXT,
  status TEXT DEFAULT 'Em andamento',
  data_inicio TEXT,
  data_fim TEXT,
  responsavel_id INTEGER REFERENCES usuarios(id),
  responsavel_nome TEXT,
  progresso INTEGER DEFAULT 0,
  valor_orcado REAL DEFAULT 0,
  valor_realizado REAL DEFAULT 0,
  tenant_id TEXT DEFAULT 'default',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- SSMA – Segurança/Saúde
CREATE TABLE IF NOT EXISTS ssma_ocorrencias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  numero TEXT UNIQUE NOT NULL,
  tipo TEXT NOT NULL,
  descricao TEXT,
  local TEXT,
  gravidade TEXT DEFAULT 'Baixa',
  status TEXT DEFAULT 'Aberta',
  responsavel_id INTEGER REFERENCES usuarios(id),
  responsavel_nome TEXT,
  data_ocorrencia TEXT,
  data_resolucao TEXT,
  acoes_corretivas TEXT,
  tenant_id TEXT DEFAULT 'default',
  created_at TEXT DEFAULT (datetime('now'))
);

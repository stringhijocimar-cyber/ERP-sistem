// ============================================================
// NEXUS ERP v3.0 – Servidor Express + SQLite (sandbox)
// Simula o ambiente Hono + Cloudflare D1
//
// ⚠️  LEGADO: backend canônico é o Cloudflare Worker (nexus-cf).
//     Mantido apenas como sandbox local até o cutover (ver CONSOLIDACAO.md).
// ============================================================
import express from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import bcrypt from 'bcryptjs'
import Database from 'better-sqlite3'
import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import './public/js/lib/auditoria.js' // define globalThis.Auditoria (hash encadeado)
import './public/js/lib/three_way.js' // define globalThis.conciliarTresVias (3-way por item)
import './public/js/lib/lgpd.js'      // define globalThis.LGPD (anonimização/retenção)
import './public/js/lib/anomalias.js' // define globalThis.detectarAnomalias (risco em compras)
import { consultarCredito } from './lib/credit_bureau.js'
import { consultarReceita, consultarCadastroCNPJ } from './lib/receita.js'
import { analisarFinanceiro } from './lib/analise_financeira.js'
import { calcularIDF } from './lib/idf.js'
import { montarRollupWBS } from './lib/wbs_rollup.js'
import { emitirNotaFiscal, cancelarNotaFiscal, consultarNotaFiscal } from './lib/nfe.js'
import { parseExtrato, sugerirMatch } from './lib/conciliacao.js'
import { enviarEmail } from './lib/email.js'
import { montarFluxoCaixa } from './lib/fluxo_caixa.js'
import { montarFluxoProjetado } from './lib/fluxo_projetado.js'
import { dreParaCSV, dashboardParaCSV } from './lib/csv_export.js'
import { montarOrcamentoAnual } from './lib/orcamento.js'
import { aplicarMovimento, itensParaRepor, valorizarEstoque } from './lib/estoque.js'

const Auditoria = globalThis.Auditoria
const conciliarTresVias = globalThis.conciliarTresVias
const LGPD = globalThis.LGPD
const __dirname = dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 3002
const DB_PATH = process.env.DB_PATH || join(__dirname, 'nexus.db')
const IS_TEST = process.env.NODE_ENV === 'test'
const BCRYPT_ROUNDS = 10

// Origens permitidas para CORS (separadas por vírgula). Em produção, defina
// ALLOWED_ORIGINS explicitamente — sem fallback curinga "*".
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3002,http://127.0.0.1:3002')
  .split(',').map(s => s.trim()).filter(Boolean)

// Senha inicial usada apenas para semear/migrar contas que ainda estão com
// hash placeholder. Configure via env; o default só serve para dev local.
const SEED_PASSWORD = process.env.SEED_PASSWORD || 'Fraser@2025'
if (!process.env.SEED_PASSWORD && !IS_TEST) {
  console.warn('⚠️  SEED_PASSWORD não definido — usando senha de desenvolvimento. Defina SEED_PASSWORD em produção.')
}

// ─── Banco de dados ───────────────────────────────────────────
const db = new Database(DB_PATH)
db.pragma('foreign_keys = ON')
db.pragma('journal_mode = WAL')

// Aplicar migrations
const migrations = [
  '0001_schema_completo.sql',
  '0002_seed_inicial.sql',
]
for (const m of migrations) {
  const p = join(__dirname, 'migrations', m)
  if (existsSync(p)) {
    const sql = readFileSync(p, 'utf-8')
    // Runner resiliente: uma migration incompatível (ex.: seed escrito para
    // outro schema) não deve impedir o boot. O aviso mantém o problema visível.
    try {
      db.exec(sql)
    } catch (e) {
      if (!IS_TEST) console.warn(`⚠️  Migration "${m}" falhou (ignorada): ${e.message}`)
    }
  }
}

// ─── Colunas aditivas (idempotente) ──────────────────────────
// SQLite não tem "ADD COLUMN IF NOT EXISTS"; checa via PRAGMA e adiciona só o
// que falta. Mantém o schema legado evoluindo sem migration destrutiva.
function ensureColumns(table, cols) {
  try {
    const existing = new Set(db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name))
    for (const [name, ddl] of cols) {
      if (!existing.has(name)) {
        try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`) }
        catch (e) { if (!IS_TEST) console.warn(`coluna ${table}.${name} não adicionada: ${e.message}`) }
      }
    }
  } catch (e) { if (!IS_TEST) console.warn(`ensureColumns(${table}) falhou: ${e.message}`) }
}
// Campos financeiros e de crédito do fornecedor.
ensureColumns('fornecedores', [
  ['razao_social', 'razao_social TEXT'],
  ['nome_fantasia', 'nome_fantasia TEXT'],
  ['faturamento_anual', 'faturamento_anual REAL DEFAULT 0'],
  ['limite_credito', 'limite_credito REAL DEFAULT 0'],
  ['score_credito', 'score_credito INTEGER DEFAULT 0'],
  ['classificacao_credito', 'classificacao_credito TEXT'],
  ['analise_credito', 'analise_credito TEXT'],
  ['status', "status TEXT DEFAULT 'Em Homologação'"],
  ['anonimizado', 'anonimizado INTEGER DEFAULT 0'],
])
// Trilha de auditoria imutável: hash do registro + hash do anterior.
ensureColumns('logs_sistema', [
  ['hash', 'hash TEXT'],
  ['hash_anterior', 'hash_anterior TEXT'],
])
// Portal do fornecedor: usuário pode ser vinculado a um fornecedor (escopo).
ensureColumns('usuarios', [
  ['fornecedor_id', 'fornecedor_id INTEGER'],
])
// NF enviada pelo fornecedor no pedido.
ensureColumns('pedidos_compra', [
  ['nf_numero', 'nf_numero TEXT'],
  ['nf_valor', 'nf_valor REAL'],
  // B2: serviço segue fluxo de aceite (não almoxarifado/3-way físico).
  ['tipo_compra', "tipo_compra TEXT DEFAULT 'material'"],
])
// Compliance de compras: a RC precisa de tipo (classificação de gasto) e de
// vínculo WBS (rastreabilidade custo → contrato → projeto).
ensureColumns('requisicoes_compra', [
  ['tipo', 'tipo TEXT'],
  ['wbs', 'wbs TEXT'],
])
// Rastreabilidade de custo na origem: a OS também exige vínculo WBS.
// A2: amarração a Contrato OU centro de custo de overhead, tipo de recurso e
// referência à linha WBS no backend (para validar pertencimento ao contrato).
ensureColumns('ordens_servico', [
  ['wbs', 'wbs TEXT'],
  ['contrato_id', 'contrato_id INTEGER'],
  ['centro_custo_overhead', 'centro_custo_overhead TEXT'],
  ['tipo_recurso', 'tipo_recurso TEXT'],
  ['wbs_linha_id', 'wbs_linha_id INTEGER'],
])
// SSMA: encerrar incidente exige RCA (causa raiz + plano de ação).
ensureColumns('ssma_ocorrencias', [
  ['causa_raiz', 'causa_raiz TEXT'],
  ['plano_acao', 'plano_acao TEXT'],
])
// CRM → Orçamentação (C1): ao passar de Qualificação, o lead precisa de
// estimativa de custos (WBS) e o orçamentista é alertado.
ensureColumns('crm_oportunidades', [
  ['orcamentacao_status', "orcamentacao_status TEXT DEFAULT 'nao_iniciada'"],
  ['orcamentacao_em', 'orcamentacao_em TEXT'],
])
// Dupla aprovação de dados bancários: alterações ficam pendentes até 2º aval.
ensureColumns('fornecedores', [
  ['banco_pendente', 'banco_pendente TEXT'],
  ['agencia_pendente', 'agencia_pendente TEXT'],
  ['conta_pendente', 'conta_pendente TEXT'],
  ['banco_solicitado_por', 'banco_solicitado_por TEXT'],
  ['banco_solicitado_em', 'banco_solicitado_em TEXT'],
  // Homologação de cadastro: dupla aprovação Financeiro + Compliance.
  ['aprovado_financeiro_por', 'aprovado_financeiro_por TEXT'],
  ['aprovado_financeiro_em', 'aprovado_financeiro_em TEXT'],
  ['aprovado_compliance_por', 'aprovado_compliance_por TEXT'],
  ['aprovado_compliance_em', 'aprovado_compliance_em TEXT'],
])
// Gate de pagamento precisa de NF e origem na conta a pagar.
ensureColumns('contas_pagar', [
  ['nota_fiscal', 'nota_fiscal TEXT'],
  ['contrato_id', 'contrato_id TEXT'],
  // Alçada por valor: aprovação de Diretor para pagamentos acima do limiar.
  ['alcada_aprovada_por', 'alcada_aprovada_por TEXT'],
  ['alcada_aprovada_em', 'alcada_aprovada_em TEXT'],
])

// ════════════════════════════════════════════════════════════
// MULTI-TENANT (multi-empresa): fundação de isolamento por empresa.
// Cada usuário pertence a uma empresa; o escopo vem SEMPRE de
// req.user.empresa_id (nunca de valor enviado pelo cliente) — é o que
// torna o sistema vendável como SaaS sem vazamento entre clientes.
// ════════════════════════════════════════════════════════════
db.exec(`CREATE TABLE IF NOT EXISTS empresas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  cnpj TEXT,
  plano TEXT DEFAULT 'padrao',
  ativo INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
)`)
// Garante a empresa padrão (id=1) para o tenant legado / instalações existentes.
try {
  const temEmpresa = db.prepare(`SELECT COUNT(*) as n FROM empresas`).get().n
  if (!temEmpresa) {
    db.prepare(`INSERT INTO empresas(id, razao_social, nome_fantasia, plano) VALUES(1, ?, ?, 'padrao')`)
      .run(process.env.EMPRESA_PADRAO_RAZAO || 'Empresa Padrão', process.env.EMPRESA_PADRAO_NOME || 'Horus ERP')
  }
} catch (e) { if (!IS_TEST) console.warn(`seed empresa padrão: ${e.message}`) }
// Todo usuário pertence a uma empresa (legado → empresa 1).
ensureColumns('usuarios', [
  ['empresa_id', 'empresa_id INTEGER DEFAULT 1'],
])

// Recebimento por item (alimenta o 3-way automaticamente).
db.exec(`CREATE TABLE IF NOT EXISTS recebimentos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pc_id INTEGER,
  nf_numero TEXT,
  valor_nf REAL DEFAULT 0,
  status TEXT,
  conferente TEXT,
  observacoes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
)`)
db.exec(`CREATE TABLE IF NOT EXISTS recebimento_itens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recebimento_id INTEGER NOT NULL REFERENCES recebimentos(id) ON DELETE CASCADE,
  pc_id INTEGER,
  codigo_produto TEXT,
  descricao TEXT,
  quantidade_recebida REAL DEFAULT 0
)`)
// Contas a RECEBER (o lado "dinheiro que entra"): espelha a estrutura de
// contas_pagar. Nasce de contrato/medição/proposta, é faturada (NFS-e) e
// baixada no recebimento. Isolada por tenant (empresa_id).
db.exec(`CREATE TABLE IF NOT EXISTS contas_receber (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  numero TEXT, contrato_id TEXT, medicao_id INTEGER, proposta_id INTEGER,
  cliente TEXT, descricao TEXT,
  valor REAL DEFAULT 0,
  data_emissao TEXT, data_vencimento TEXT, data_recebimento TEXT,
  status TEXT DEFAULT 'A Faturar',
  nota_fiscal TEXT, forma_recebimento TEXT, observacoes TEXT,
  empresa_id INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
)`)

// Conciliação bancária: um extrato importado (lote) e seus lançamentos.
// Cada lançamento é uma linha do banco (crédito/débito) que, ao ser
// conciliada, baixa uma conta a pagar/receber. Isolado por tenant.
db.exec(`CREATE TABLE IF NOT EXISTS extratos_bancarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  banco TEXT, conta TEXT, arquivo_nome TEXT, formato TEXT,
  periodo_inicio TEXT, periodo_fim TEXT, qtd_lancamentos INTEGER DEFAULT 0,
  empresa_id INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
)`)
db.exec(`CREATE TABLE IF NOT EXISTS extrato_lancamentos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  extrato_id INTEGER REFERENCES extratos_bancarios(id) ON DELETE CASCADE,
  data TEXT, descricao TEXT, documento TEXT,
  valor REAL DEFAULT 0, tipo TEXT,
  status TEXT DEFAULT 'pendente',
  conciliado_tipo TEXT, conciliado_id INTEGER, conciliado_em TEXT, conciliado_por TEXT,
  empresa_id INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
)`)

// RH — colaboradores (mão de obra própria) com custo/hora. A mão de obra é o
// maior custo de uma empresa de serviços; apontar horas em contratos torna a
// margem (DRE) verdadeira. Isolado por tenant.
db.exec(`CREATE TABLE IF NOT EXISTS colaboradores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL, cpf TEXT, cargo TEXT, departamento TEXT,
  custo_hora REAL DEFAULT 0, email TEXT, telefone TEXT,
  data_admissao TEXT, status TEXT DEFAULT 'Ativo',
  empresa_id INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
)`)
// Apontamento de horas: cada lançamento vira custo (horas × custo/hora), com
// snapshot do custo/hora vigente (histórico não muda se o salário mudar).
db.exec(`CREATE TABLE IF NOT EXISTS apontamentos_hora (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  colaborador_id INTEGER REFERENCES colaboradores(id) ON DELETE CASCADE,
  contrato_id TEXT, data TEXT, horas REAL DEFAULT 0,
  custo_hora REAL DEFAULT 0, custo REAL DEFAULT 0,
  descricao TEXT,
  empresa_id INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
)`)

// Orçamento anual (budget): metas mensais de receita/custo/despesa por tenant.
// Uma linha por (empresa, ano, mês); comparado com o realizado da DRE.
db.exec(`CREATE TABLE IF NOT EXISTS orcamento_metas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ano INTEGER NOT NULL, mes INTEGER NOT NULL,
  receita_meta REAL DEFAULT 0, custo_meta REAL DEFAULT 0, despesa_meta REAL DEFAULT 0,
  empresa_id INTEGER DEFAULT 1,
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(empresa_id, ano, mes)
)`)

// Propostas comerciais (C2): só nascem com estimativa de custos (WBS) do lead.
db.exec(`CREATE TABLE IF NOT EXISTS propostas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  numero TEXT, lead_id INTEGER, cliente TEXT, objeto TEXT,
  custo_estimado REAL DEFAULT 0, margem REAL DEFAULT 0, valor_total REAL DEFAULT 0,
  status TEXT DEFAULT 'Em Elaboração',
  created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
)`)
// Aceite de serviço (fluxo de serviço, B2): o requisitante atesta a prestação
// com checklist técnico — substitui o recebimento físico para serviços.
db.exec(`CREATE TABLE IF NOT EXISTS aceites_servico (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pedido_id INTEGER, os_id INTEGER,
  checklist TEXT, aceito INTEGER DEFAULT 0, aceito_por TEXT, aceito_em TEXT,
  especificacao TEXT, observacoes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
)`)
// WBS — linhas de custo (estrutura analítica) com vínculo a contrato/projeto/lead.
db.exec(`CREATE TABLE IF NOT EXISTS wbs_linhas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT, descricao TEXT, natureza TEXT, tipo TEXT DEFAULT 'OPEX',
  contrato_id INTEGER, projeto_id INTEGER, centro_custo TEXT, lead_id INTEGER,
  origem TEXT DEFAULT 'contrato',
  unidade TEXT, quantidade REAL DEFAULT 0, valor_unit_est REAL DEFAULT 0, valor_total_est REAL DEFAULT 0,
  custo_real REAL DEFAULT 0, nao_previsto INTEGER DEFAULT 0, ativo INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
)`)
// Notificações in-app (e e-mail via adaptador). Alvo por usuário OU por perfil.
db.exec(`CREATE TABLE IF NOT EXISTS notificacoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER, perfil TEXT,
  titulo TEXT NOT NULL, mensagem TEXT,
  tipo TEXT DEFAULT 'info', ref_tipo TEXT, ref_id TEXT,
  lida INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
)`)
// Notas fiscais emitidas (NF-e / NFS-e / CT-e).
db.exec(`CREATE TABLE IF NOT EXISTS notas_fiscais (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo TEXT, numero INTEGER, serie INTEGER,
  chave TEXT, protocolo TEXT, status TEXT DEFAULT 'autorizada',
  valor REAL DEFAULT 0,
  cnpj_emitente TEXT, destinatario TEXT, descricao TEXT,
  danfe_url TEXT, pedido_id INTEGER,
  justificativa_cancel TEXT, emitido_por TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
)`)
// Emissor real (PlugNotas): rastreia a fonte, o id do provedor (para consulta
// de status assíncrona), o XML e o tenant.
ensureColumns('notas_fiscais', [
  ['fonte', 'fonte TEXT'],
  ['provider_id', 'provider_id TEXT'],
  ['xml_url', 'xml_url TEXT'],
  ['empresa_id', 'empresa_id INTEGER DEFAULT 1'],
])
// Soma do que já foi recebido por item de um pedido (chave: código ou descrição).
function itensRecebidosAcumulados(pcId) {
  return db.prepare(
    `SELECT COALESCE(NULLIF(codigo_produto,''), descricao) AS codigo, descricao,
            SUM(quantidade_recebida) AS quantidade_recebida
       FROM recebimento_itens WHERE pc_id = ?
      GROUP BY COALESCE(NULLIF(codigo_produto,''), descricao)`
  ).all(pcId)
}

// ─── Sequências atômicas (numeração sem corrida) ──────────────
// Substitui o `length+1` do cliente por um contador no servidor, incrementado
// atomicamente (UPSERT + RETURNING numa única instrução — sem race condition).
db.exec(`CREATE TABLE IF NOT EXISTS sequences (
  tipo TEXT NOT NULL,
  ano INTEGER NOT NULL,
  valor INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (tipo, ano)
)`)

// ── Multi-tenant: empresa_id nas tabelas relacionais (isolamento) ──
// Roda DEPOIS de todos os CREATE TABLE (inclusive os db.exec acima como
// propostas/wbs_linhas), senão a coluna não é adicionada e o INSERT falha.
// Legado → empresa 1. Retrofit incremental.
for (const t of ['fornecedores', 'requisicoes_compra', 'rfq', 'mapas_comparativos', 'pedidos_compra', 'contas_pagar', 'ordens_servico',
                 'contratos', 'crm_oportunidades', 'propostas', 'projetos', 'wbs_linhas', 'almoxarifado_itens', 'logs_sistema', 'notificacoes']) {
  ensureColumns(t, [['empresa_id', 'empresa_id INTEGER DEFAULT 1']])
}
// Estoque: ponto de reposição por máximo + trilha de movimentos por tenant,
// com saldo resultante gravado (auditoria de estoque).
ensureColumns('almoxarifado_itens', [['quantidade_maxima', 'quantidade_maxima REAL DEFAULT 0']])
ensureColumns('almoxarifado_movimentos', [
  ['empresa_id', 'empresa_id INTEGER DEFAULT 1'],
  ['saldo_apos', 'saldo_apos REAL'],
])
const TIPOS_SEQ = new Set(['PC', 'RC', 'RFQ', 'MAPA', 'CP'])
function proximaSequencia(tipoRaw, anoRaw) {
  const tipo = String(tipoRaw || '').toUpperCase().replace(/[^A-Z]/g, '')
  if (!TIPOS_SEQ.has(tipo)) throw new Error('Tipo de sequência inválido')
  const ano = parseInt(anoRaw) || new Date().getFullYear()
  const row = db.prepare(
    `INSERT INTO sequences(tipo, ano, valor) VALUES(?, ?, 1)
     ON CONFLICT(tipo, ano) DO UPDATE SET valor = valor + 1
     RETURNING valor`
  ).get(tipo, ano)
  return { tipo, ano, valor: row.valor, numero: `${tipo}-${ano}-${String(row.valor).padStart(4, '0')}` }
}

// ─── Bootstrap de admin ───────────────────────────────────────
// Garante que exista um usuário admin com hash bcrypt real, mesmo que o seed
// SQL falhe (schemas divergentes). Idempotente: identifica pelo email.
function ensureAdmin() {
  try {
    const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@fraseralexander.com.br').toLowerCase()
    const existe = db.prepare(`SELECT id FROM usuarios WHERE email = ?`).get(ADMIN_EMAIL)
    if (existe) return
    const hash = bcrypt.hashSync(SEED_PASSWORD, BCRYPT_ROUNDS)
    db.prepare(`INSERT INTO usuarios(nome, email, senha_hash, perfil, ativo) VALUES(?,?,?,?,1)`)
      .run('Administrador', ADMIN_EMAIL, hash, 'admin')
    if (!IS_TEST) console.log(`🔐 Admin inicial criado: ${ADMIN_EMAIL} (senha via SEED_PASSWORD)`)
  } catch (e) {
    if (!IS_TEST) console.error('Erro ao garantir admin:', e.message)
  }
}

// ─── Bootstrap de senhas ──────────────────────────────────────
// Substitui hashes placeholder (`$2b$10$placeholder...`) por um hash bcrypt
// real derivado de SEED_PASSWORD. Sem isso o login compararia texto plano.
function bootstrapSenhas() {
  try {
    const pendentes = db.prepare(
      `SELECT id, senha_hash FROM usuarios WHERE senha_hash LIKE '$2b$10$placeholder%'`
    ).all()
    if (!pendentes.length) return
    const hash = bcrypt.hashSync(SEED_PASSWORD, BCRYPT_ROUNDS)
    const upd = db.prepare(`UPDATE usuarios SET senha_hash = ? WHERE id = ?`)
    for (const u of pendentes) upd.run(hash, u.id)
    if (!IS_TEST) console.log(`🔐 ${pendentes.length} usuário(s) migrado(s) para hash bcrypt`)
  } catch (e) {
    if (!IS_TEST) console.error('Erro no bootstrap de senhas:', e.message)
  }
}
bootstrapSenhas()
ensureAdmin()
if (!IS_TEST) console.log('✅ Banco de dados inicializado')

// ─── App Express ──────────────────────────────────────────────
const app = express()
// CORS restrito: só responde para origens conhecidas. Requisições sem header
// Origin (curl, mesmo host) são permitidas para não quebrar a SPA local.
app.use(cors({
  origin(origin, cb) {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true)
    cb(new Error('Origem não permitida pelo CORS'))
  },
  credentials: true,
}))
app.use(express.json())

// ─── Headers de segurança (hardening de API/SPA) ─────────────
// Sem dependência extra: o essencial do helmet aplicado à mão.
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')       // sem MIME sniffing
  res.setHeader('X-Frame-Options', 'DENY')                 // anti-clickjacking
  res.setHeader('Referrer-Policy', 'no-referrer')          // não vaza URLs internas
  res.setHeader('X-XSS-Protection', '0')                   // legado off (CSP é o caminho)
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  if ((process.env.FORCE_HSTS ?? '0') === '1') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }
  next()
})

app.use(express.static(join(__dirname, 'public')))

// ─── Rate limiting no login (anti força-bruta) ────────────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: IS_TEST ? 20 : 10,   // tentativas por IP na janela
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Muitas tentativas de login. Tente novamente em alguns minutos.', status: 429 },
})

// ─── Helpers ─────────────────────────────────────────────────
const ok = (data, meta) => ({ success: true, data, ...(meta ? { meta } : {}) })
const err = (msg, status = 400) => ({ success: false, error: msg, status })
function uid(prefix = 'id') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}
function now() { return new Date().toISOString() }

// Política de senha forte (mín. 8 caracteres, maiúscula, minúscula e dígito).
// Pura (espelhada no Worker). Devolve { ok } ou { ok:false, motivo }.
function validarSenhaForte(senha) {
  const s = String(senha || '')
  if (s.length < 8) return { ok: false, motivo: 'Senha deve ter no mínimo 8 caracteres' }
  if (!/[A-Z]/.test(s)) return { ok: false, motivo: 'Senha deve conter letra maiúscula' }
  if (!/[a-z]/.test(s)) return { ok: false, motivo: 'Senha deve conter letra minúscula' }
  if (!/[0-9]/.test(s)) return { ok: false, motivo: 'Senha deve conter número' }
  return { ok: true }
}

// Auth middleware
function getUser(req) {
  const auth = req.headers['authorization'] || ''
  const token = auth.replace('Bearer ', '').trim()
  if (!token) return null
  try {
    const row = db.prepare(
      `SELECT s.usuario_id, s.expira_em, u.nome, u.email, u.perfil, u.ativo, u.fornecedor_id, u.empresa_id
       FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id
       WHERE s.token = ? AND u.ativo = 1`
    ).get(token)
    if (!row) return null
    // Sessão expirada NÃO autentica (e é removida — higiene de sessão).
    if (row.expira_em && new Date(row.expira_em) <= new Date()) {
      try { db.prepare(`DELETE FROM sessoes WHERE token = ?`).run(token) } catch {}
      return null
    }
    return row
  } catch { return null }
}

function requireAuth(req, res, next) {
  const user = getUser(req)
  if (!user) return res.status(401).json(err('Não autenticado', 401))
  req.user = user
  next()
}

// Autorização por perfil. Use após requireAuth: requireRole('admin','diretor')
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json(err('Não autenticado', 401))
    if (!roles.includes(req.user.perfil)) {
      return res.status(403).json(err('Perfil sem permissão para esta ação', 403))
    }
    next()
  }
}

function log(userId, userName, acao, modulo, descricao) {
  try {
    // Encadeia ao hash do último registro (tamper-evident). Em Node (single
    // thread + better-sqlite3 síncrono) a leitura do último + insert é atômica.
    const created_at = new Date().toISOString()
    const ult = db.prepare(`SELECT hash FROM logs_sistema ORDER BY id DESC LIMIT 1`).get()
    const hash_anterior = (ult && ult.hash) ? ult.hash : Auditoria.GENESIS
    const reg = { usuario_id: userId, acao, modulo, descricao, created_at }
    const hash = Auditoria.hashRegistro(reg, hash_anterior)
    // Multi-tenant: atribui o log à empresa do autor (derivada do usuário),
    // sem alterar as centenas de call sites de log().
    let empresa = 1
    try { empresa = db.prepare(`SELECT empresa_id FROM usuarios WHERE id = ?`).get(userId)?.empresa_id || 1 } catch {}
    db.prepare(
      `INSERT INTO logs_sistema(usuario_id, usuario_nome, acao, modulo, descricao, created_at, hash, hash_anterior, empresa_id)
       VALUES(?,?,?,?,?,?,?,?,?)`
    ).run(userId, userName, acao, modulo, descricao, created_at, hash, hash_anterior, empresa)
  } catch {}
}

// ════════════════════════════════════════════════════════════
// AUTH
// ════════════════════════════════════════════════════════════
// Health-check público e leve: só diz que a API está de pé, sem dados.
// (usado pelo front para detectar online/offline sem precisar de token)
app.get('/api/health', (req, res) => res.json(ok({ ok: true })))

app.post('/api/auth/login', loginLimiter, (req, res) => {
  const { email, senha } = req.body
  if (!email || !senha) return res.status(400).json(err('Email e senha obrigatórios'))

  const user = db.prepare(
    `SELECT id, nome, email, perfil, senha_hash FROM usuarios WHERE email = ? AND ativo = 1`
  ).get(String(email).toLowerCase().trim())

  // Compara sempre com bcrypt (mesmo quando o usuário não existe, para não
  // vazar timing). Sem comparação de texto plano nem senhas hardcoded.
  const senhaOk = user ? bcrypt.compareSync(String(senha), user.senha_hash) : false
  if (!user || !senhaOk) return res.status(401).json(err('Credenciais inválidas', 401))

  // Higiene: remove sessões já expiradas (limpeza oportunista, barata).
  try { db.prepare(`DELETE FROM sessoes WHERE expira_em <= ?`).run(new Date().toISOString()) } catch {}

  const token = uid('tok')
  const expira = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()
  db.prepare(`INSERT INTO sessoes(token, usuario_id, expira_em, ip) VALUES(?,?,?,?)`)
    .run(token, user.id, expira, req.ip || '')

  log(user.id, user.nome, 'Login', 'auth', 'Login realizado')

  res.json(ok({ token, user: { id: user.id, nome: user.nome, email: user.email, perfil: user.perfil } }))
})

app.post('/api/auth/logout', requireAuth, (req, res) => {
  const token = (req.headers['authorization'] || '').replace('Bearer ', '')
  if (token) db.prepare(`DELETE FROM sessoes WHERE token = ?`).run(token)
  res.json(ok(null))
})

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json(ok(req.user))
})

// ════════════════════════════════════════════════════════════
// SYNC genérico: persiste o snapshot (array) que o front já envia para
// /api/<entidade>/sync — antes o Express não tinha a rota e RC/RFQ/mapas/
// contratos/projetos nunca persistiam (falha silenciosa no front).
// Registrado ANTES das rotas /api/<ent>/:id para não ser interceptado.
// ════════════════════════════════════════════════════════════
// sync_store agora é escopado por empresa. Migração idempotente: se a tabela
// antiga (sem empresa_id) existir, recria (é apenas espelho do localStorage do
// cliente, que reenvia no próximo boot via reconcile) com PK tenant-aware.
try {
  const cols = db.prepare(`PRAGMA table_info(sync_store)`).all().map(c => c.name)
  if (cols.length && !cols.includes('empresa_id')) db.exec(`DROP TABLE sync_store`)
} catch (e) { if (!IS_TEST) console.warn(`migração sync_store: ${e.message}`) }
db.exec(`CREATE TABLE IF NOT EXISTS sync_store (
  empresa_id INTEGER NOT NULL DEFAULT 1,
  entidade TEXT NOT NULL, item_id TEXT NOT NULL, payload TEXT,
  updated_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (empresa_id, entidade, item_id)
)`)
const _SYNC_OK = new Set(['rc', 'rfq', 'mapas', 'contratos', 'projetos', 'crm', 'os', 'pedidos', 'fornecedores', 'contas-pagar', 'medicoes', 'ssma', 'avaliacoes'])
// Escopo de tenant: SEMPRE do usuário autenticado, nunca do corpo/query.
const empresaDoReq = (req) => Number(req.user && req.user.empresa_id) || 1
// Busca uma linha por id JÁ no escopo da empresa do usuário (→ 404 se for de
// outro tenant). `table` é sempre um literal fixo no call site (sem injeção).
const rowScoped = (table, req, id) => db.prepare(`SELECT * FROM ${table} WHERE id = ? AND empresa_id = ?`).get(id ?? req.params.id, empresaDoReq(req))

app.post('/api/:entidade/sync', requireAuth, (req, res) => {
  const ent = req.params.entidade
  if (!_SYNC_OK.has(ent)) return res.status(404).json(err('Entidade não sincronizável'))
  const emp = empresaDoReq(req)
  const data = Array.isArray(req.body && req.body.data) ? req.body.data : []
  const up = db.prepare(`INSERT INTO sync_store(empresa_id, entidade, item_id, payload, updated_at) VALUES(?,?,?,?,datetime('now'))
     ON CONFLICT(empresa_id, entidade, item_id) DO UPDATE SET payload=excluded.payload, updated_at=datetime('now')`)
  const tx = db.transaction((rows) => {
    rows.forEach((it, i) => up.run(emp, ent, String((it && (it.id ?? it.numero)) ?? `i-${i}`), JSON.stringify(it || {})))
  })
  tx(data)
  res.json(ok({ synced: data.length }))
})

app.get('/api/:entidade/sync', requireAuth, (req, res) => {
  const ent = req.params.entidade
  if (!_SYNC_OK.has(ent)) return res.status(404).json(err('Entidade não sincronizável'))
  const emp = empresaDoReq(req)
  res.json(ok(db.prepare(`SELECT payload FROM sync_store WHERE empresa_id = ? AND entidade = ? ORDER BY updated_at DESC`).all(emp, ent).map(r => JSON.parse(r.payload || '{}'))))
})

// ════════════════════════════════════════════════════════════
// EMPRESAS (tenants). O tenant mestre (empresa 1) gerencia todas;
// os demais enxergam apenas a própria — isolamento por padrão.
// ════════════════════════════════════════════════════════════
app.get('/api/empresas/atual', requireAuth, (req, res) => {
  const emp = db.prepare(`SELECT id, razao_social, nome_fantasia, cnpj, plano, ativo FROM empresas WHERE id = ?`).get(empresaDoReq(req))
  res.json(ok(emp || { id: empresaDoReq(req), razao_social: 'Empresa Padrão' }))
})

app.get('/api/empresas', requireAuth, (req, res) => {
  const emp = empresaDoReq(req)
  const rows = emp === 1
    ? db.prepare(`SELECT id, razao_social, nome_fantasia, cnpj, plano, ativo, created_at FROM empresas ORDER BY id`).all()
    : db.prepare(`SELECT id, razao_social, nome_fantasia, cnpj, plano, ativo, created_at FROM empresas WHERE id = ?`).all(emp)
  res.json(ok(rows))
})

app.post('/api/empresas', requireAuth, requireRole('admin'), (req, res) => {
  // Provisionar novos tenants é privilégio do tenant mestre (empresa 1).
  if (empresaDoReq(req) !== 1) return res.status(403).json(err('Apenas o tenant mestre pode criar empresas', 403))
  const { razao_social, nome_fantasia, cnpj, plano } = req.body
  if (!razao_social || !String(razao_social).trim()) return res.status(400).json(err('Razão social obrigatória'))
  const r = db.prepare(`INSERT INTO empresas(razao_social, nome_fantasia, cnpj, plano) VALUES(?,?,?,?)`)
    .run(String(razao_social).trim(), nome_fantasia || null, cnpj || null, plano || 'padrao')
  const nova = db.prepare(`SELECT id, razao_social, nome_fantasia, cnpj, plano, ativo FROM empresas WHERE id = ?`).get(r.lastInsertRowid)
  log(req.user.usuario_id, req.user.nome, 'Criar', 'empresas', `Empresa criada: ${razao_social}`)
  res.status(201).json(ok(nova))
})

// ════════════════════════════════════════════════════════════
// DASHBOARD
// ════════════════════════════════════════════════════════════
app.get('/api/dashboard', requireAuth, (req, res) => {
  const e = empresaDoReq(req)
  const stats = {
    os: {
      total: db.prepare(`SELECT COUNT(*) as n FROM ordens_servico WHERE empresa_id = ?`).get(e).n,
      abertas: db.prepare(`SELECT COUNT(*) as n FROM ordens_servico WHERE empresa_id = ? AND status != 'Aprovada' AND status != 'Cancelada'`).get(e).n,
      aprovadas: db.prepare(`SELECT COUNT(*) as n FROM ordens_servico WHERE empresa_id = ? AND status = 'Aprovada'`).get(e).n,
    },
    rc: {
      total: db.prepare(`SELECT COUNT(*) as n FROM requisicoes_compra WHERE empresa_id = ?`).get(e).n,
      pendentes: db.prepare(`SELECT COUNT(*) as n FROM requisicoes_compra WHERE empresa_id = ? AND (status = 'Pendente' OR status = 'Rascunho')`).get(e).n,
      aprovadas: db.prepare(`SELECT COUNT(*) as n FROM requisicoes_compra WHERE empresa_id = ? AND status = 'Aprovada'`).get(e).n,
    },
    pc: {
      total: db.prepare(`SELECT COUNT(*) as n FROM pedidos_compra WHERE empresa_id = ?`).get(e).n,
      emitidos: db.prepare(`SELECT COUNT(*) as n FROM pedidos_compra WHERE empresa_id = ? AND status = 'Emitido'`).get(e).n,
      aguardando_envio: db.prepare(`SELECT COUNT(*) as n FROM pedidos_compra WHERE empresa_id = ? AND status = 'Aguardando Envio'`).get(e).n,
      enviados: db.prepare(`SELECT COUNT(*) as n FROM pedidos_compra WHERE empresa_id = ? AND status = 'Enviado'`).get(e).n,
      entregues: db.prepare(`SELECT COUNT(*) as n FROM pedidos_compra WHERE empresa_id = ? AND status = 'Entregue'`).get(e).n,
      cancelados: db.prepare(`SELECT COUNT(*) as n FROM pedidos_compra WHERE empresa_id = ? AND status = 'Cancelado'`).get(e).n,
      valor_total: db.prepare(`SELECT COALESCE(SUM(valor_total),0) as v FROM pedidos_compra WHERE empresa_id = ? AND status != 'Cancelado'`).get(e).v,
    },
    financeiro: {
      a_pagar_total: db.prepare(`SELECT COALESCE(SUM(valor),0) as v FROM contas_pagar WHERE empresa_id = ? AND status = 'Pendente'`).get(e).v,
      pago_total: db.prepare(`SELECT COALESCE(SUM(valor),0) as v FROM contas_pagar WHERE empresa_id = ? AND status = 'Pago'`).get(e).v,
      vencido_total: db.prepare(`SELECT COALESCE(SUM(valor),0) as v FROM contas_pagar WHERE empresa_id = ? AND status = 'Vencido'`).get(e).v,
      // Lado "dinheiro que entra" (contas a receber).
      a_receber_total: db.prepare(`SELECT COALESCE(SUM(valor),0) as v FROM contas_receber WHERE empresa_id = ? AND status = 'A Receber'`).get(e).v,
      recebido_total: db.prepare(`SELECT COALESCE(SUM(valor),0) as v FROM contas_receber WHERE empresa_id = ? AND status = 'Recebida'`).get(e).v,
    },
    fornecedores: {
      total: db.prepare(`SELECT COUNT(*) as n FROM fornecedores WHERE empresa_id = ? AND ativo = 1`).get(e).n,
    },
    almoxarifado: {
      total_itens: db.prepare(`SELECT COUNT(*) as n FROM almoxarifado_itens WHERE ativo = 1 AND empresa_id = ?`).get(e).n,
      estoque_baixo: db.prepare(`SELECT COUNT(*) as n FROM almoxarifado_itens WHERE quantidade_atual < quantidade_minima AND ativo = 1 AND empresa_id = ?`).get(e).n,
    },
    recentes: {
      pedidos: db.prepare(`SELECT pc.*, f.nome as fornecedor FROM pedidos_compra pc LEFT JOIN fornecedores f ON f.id = pc.fornecedor_id WHERE pc.empresa_id = ? ORDER BY pc.created_at DESC LIMIT 5`).all(e),
      os: db.prepare(`SELECT * FROM ordens_servico WHERE empresa_id = ? ORDER BY created_at DESC LIMIT 5`).all(e),
    }
  }
  res.json(ok(stats))
})

// ════════════════════════════════════════════════════════════
// FORNECEDORES
// ════════════════════════════════════════════════════════════
// LGPD — anonimiza os dados pessoais de um fornecedor (direito de eliminação).
// Admin apenas. Irreversível: contato/email/telefone viram máscaras.
app.post('/api/lgpd/anonimizar/fornecedores/:id', requireAuth, requireRole('admin'), (req, res) => {
  // Multi-tenant: admin só anonimiza fornecedores da PRÓPRIA empresa
  // (anonimização é irreversível — cross-tenant seria destrutivo).
  const f = db.prepare(`SELECT * FROM fornecedores WHERE id = ? AND empresa_id = ?`).get(req.params.id, empresaDoReq(req))
  if (!f) return res.status(404).json(err('Fornecedor não encontrado'))
  const novo = LGPD.anonimizarRegistro(
    { contato: f.contato, email: f.email, telefone: f.telefone },
    { contato: 'nome', email: 'email', telefone: 'telefone' }
  )
  db.prepare(`UPDATE fornecedores SET contato=?, email=?, telefone=?, anonimizado=1, updated_at=datetime('now') WHERE id=?`)
    .run(novo.contato, novo.email, novo.telefone, req.params.id)
  log(req.user.usuario_id, req.user.nome, 'LGPD anonimizar', 'fornecedores', `Dados pessoais anonimizados: fornecedor ${req.params.id}`)
  res.json(ok(db.prepare(`SELECT * FROM fornecedores WHERE id = ?`).get(req.params.id)))
})

// LGPD — retenção: política de guarda dos dados pessoais de fornecedor.
const RETENCAO_FORNECEDOR_MESES = parseInt(process.env.RETENCAO_FORNECEDOR_MESES) || 60
function _fornecedoresVencidos(empresa = 1) {
  // Conservador: inativos, além da retenção e ainda não anonimizados —
  // sempre dentro da empresa do solicitante (multi-tenant).
  const cands = db.prepare(
    `SELECT * FROM fornecedores WHERE ativo = 0 AND COALESCE(anonimizado,0) = 0 AND empresa_id = ?`
  ).all(Number(empresa) || 1)
  return LGPD.vencidosPorRetencao(cands, { campoData: 'created_at', retencaoMeses: RETENCAO_FORNECEDOR_MESES })
}

// Preview (dry-run): quem SERIA anonimizado pela política, sem alterar nada.
app.get('/api/lgpd/retencao/fornecedores', requireAuth, requireRole('admin'), (req, res) => {
  const vencidos = _fornecedoresVencidos(empresaDoReq(req)).map(f => ({ id: f.id, nome: f.nome, created_at: f.created_at, ativo: f.ativo }))
  res.json(ok({ politica_meses: RETENCAO_FORNECEDOR_MESES, total: vencidos.length, fornecedores: vencidos }))
})

// Execução: anonimiza todos os vencidos pela política (admin).
app.post('/api/lgpd/retencao/fornecedores/executar', requireAuth, requireRole('admin'), (req, res) => {
  const vencidos = _fornecedoresVencidos(empresaDoReq(req))
  const upd = db.prepare(`UPDATE fornecedores SET contato=?, email=?, telefone=?, anonimizado=1, updated_at=datetime('now') WHERE id=?`)
  let n = 0
  for (const f of vencidos) {
    const a = LGPD.anonimizarRegistro({ contato: f.contato, email: f.email, telefone: f.telefone }, { contato: 'nome', email: 'email', telefone: 'telefone' })
    upd.run(a.contato, a.email, a.telefone, f.id)
    n++
  }
  if (n) log(req.user.usuario_id, req.user.nome, 'LGPD retenção', 'fornecedores', `${n} fornecedor(es) anonimizado(s) por retenção (${RETENCAO_FORNECEDOR_MESES}m)`)
  res.json(ok({ anonimizados: n, politica_meses: RETENCAO_FORNECEDOR_MESES }))
})

// ════════════════════════════════════════════════════════════
// CENTRAL DE ALERTAS — consolida pendências acionáveis dos módulos
// num único feed, ordenado por severidade. Fontes 100% server-side.
// ════════════════════════════════════════════════════════════
const SEV_PESO = { alta: 3, media: 2, baixa: 1 }
// Antecedência de vencimento de contrato: vencido/≤30d → alta; ≤60d → média;
// ≤90d → baixa; acima disso, sem alerta. Pura (espelhada no Worker).
function classificarVencimentoContrato(dataFim, hoje = new Date().toISOString().slice(0, 10)) {
  if (!dataFim) return null
  const fim = String(dataFim).slice(0, 10)
  const diasRest = Math.round((new Date(fim + 'T00:00:00Z') - new Date(hoje + 'T00:00:00Z')) / 864e5)
  if (diasRest <= 30) return 'alta'
  if (diasRest <= 60) return 'media'
  if (diasRest <= 90) return 'baixa'
  return null
}

function coletarAlertas({ dias = 7, isAdmin = false, empresa = 1 } = {}) {
  const hoje = new Date().toISOString().slice(0, 10)
  const limite = new Date(Date.now() + dias * 864e5).toISOString().slice(0, 10)
  const alertas = []

  // 1) Contas a pagar VENCIDAS (dinheiro em atraso) → severidade alta.
  for (const c of db.prepare(
    `SELECT id, numero, descricao, valor, data_vencimento FROM contas_pagar
      WHERE empresa_id = ? AND status IN ('Pendente','Aprovado','Vencido')
        AND data_vencimento IS NOT NULL AND date(data_vencimento) < date(?)
      ORDER BY data_vencimento ASC`
  ).all(empresa, hoje)) {
    alertas.push({ tipo: 'conta_vencida', severidade: 'alta', modulo: 'Financeiro',
      titulo: `Conta vencida: ${c.numero}`, descricao: `${c.descricao || ''} — venc. ${c.data_vencimento}`,
      valor: c.valor, data: c.data_vencimento, ref: c.id })
  }

  // 2) Contas a VENCER na janela (próximos N dias) → severidade média.
  for (const c of db.prepare(
    `SELECT id, numero, descricao, valor, data_vencimento FROM contas_pagar
      WHERE empresa_id = ? AND status IN ('Pendente','Aprovado') AND data_vencimento IS NOT NULL
        AND date(data_vencimento) >= date(?) AND date(data_vencimento) <= date(?)
      ORDER BY data_vencimento ASC`
  ).all(empresa, hoje, limite)) {
    alertas.push({ tipo: 'conta_a_vencer', severidade: 'media', modulo: 'Financeiro',
      titulo: `Conta a vencer: ${c.numero}`, descricao: `${c.descricao || ''} — venc. ${c.data_vencimento}`,
      valor: c.valor, data: c.data_vencimento, ref: c.id })
  }

  // 3) Entregas ATRASADAS (pedido enviado, prazo estourado, não recebido) → alta.
  for (const p of db.prepare(
    `SELECT id, numero, fornecedor_nome, enviado_em, prazo_entrega FROM pedidos_compra
      WHERE empresa_id = ? AND enviado_em IS NOT NULL
        AND status NOT IN ('Entregue','Recebido','Cancelado','Concluído')
        AND date(enviado_em, '+' || COALESCE(prazo_entrega,7) || ' days') < date(?)
      ORDER BY enviado_em ASC`
  ).all(empresa, hoje)) {
    alertas.push({ tipo: 'entrega_atrasada', severidade: 'alta', modulo: 'Compras',
      titulo: `Entrega atrasada: ${p.numero}`, descricao: `${p.fornecedor_nome || ''} — enviado ${p.enviado_em}, prazo ${p.prazo_entrega || 7}d`,
      data: p.enviado_em, ref: p.id })
  }

  // 4) Retenção LGPD pendente — dado sensível, só para admin → média.
  if (isAdmin) {
    const venc = _fornecedoresVencidos(empresa)
    if (venc.length) {
      alertas.push({ tipo: 'lgpd_retencao', severidade: 'media', modulo: 'LGPD',
        titulo: `Retenção LGPD: ${venc.length} fornecedor(es) a anonimizar`,
        descricao: `Inativos além de ${RETENCAO_FORNECEDOR_MESES} meses, ainda não anonimizados.`,
        valor: venc.length, ref: 'lgpd' })
    }
  }

  // 5) Vencimento de contrato — antecedência 90/60/30 (severidade crescente).
  const lim90 = new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10)
  for (const c of db.prepare(
    `SELECT id, numero, titulo, fornecedor_nome, data_fim FROM contratos
      WHERE empresa_id = ? AND status = 'Ativo' AND data_fim IS NOT NULL AND date(data_fim) <= date(?)
      ORDER BY data_fim ASC`
  ).all(empresa, lim90)) {
    const sev = classificarVencimentoContrato(c.data_fim, hoje)
    if (!sev) continue
    const venc = c.data_fim < hoje
    alertas.push({ tipo: 'contrato_vencimento', severidade: sev, modulo: 'Contratos',
      titulo: `${venc ? 'Contrato vencido' : 'Contrato a vencer'}: ${c.numero}`,
      descricao: `${c.titulo || c.fornecedor_nome || ''} — fim ${c.data_fim}`,
      data: c.data_fim, ref: c.id })
  }

  // 6) ANOMALIAS DE COMPRA — o motor puro (fracionamento, fora da curva,
  //    fornecedor novo/crédito ruim com valor alto, duplicidade) roda sobre
  //    os pedidos recentes do tenant, com o histórico completo do tenant.
  try {
    const histRows = db.prepare(
      `SELECT pc.id, pc.numero, pc.fornecedor_id, pc.fornecedor_nome, pc.valor_total, pc.created_at
         FROM pedidos_compra pc WHERE pc.empresa_id = ? AND pc.status != 'Cancelado'
        ORDER BY pc.created_at DESC LIMIT 500`
    ).all(empresa)
    const hist = histRows.map(p => ({ id: p.id, fornecedor_id: p.fornecedor_id, valor: p.valor_total, data: p.created_at }))
    const jaAvisado = new Set() // 1 alerta por (tipo, fornecedor) — evita ruído
    for (const p of histRows.slice(0, 20)) { // analisa os 20 mais recentes
      const f = p.fornecedor_id
        ? db.prepare(`SELECT score_credito, classificacao_credito FROM fornecedores WHERE id = ? AND empresa_id = ?`).get(p.fornecedor_id, empresa)
        : null
      const r = detectarAnomalias({ id: p.id, fornecedor_id: p.fornecedor_id, valor: p.valor_total, data: p.created_at }, hist, f || {})
      for (const a of r.alertas) {
        const chave = `${a.tipo}:${p.fornecedor_id}`
        if (jaAvisado.has(chave)) continue
        jaAvisado.add(chave)
        alertas.push({ tipo: `anomalia_${a.tipo}`, severidade: a.severidade, modulo: 'Compras',
          titulo: `${a.mensagem} — ${p.fornecedor_nome || 'fornecedor ' + p.fornecedor_id}`,
          descricao: `${p.numero}: ${a.detalhe}`, valor: p.valor_total, data: p.created_at, ref: p.id })
      }
    }
  } catch (e) { if (!IS_TEST) console.warn(`varredura de anomalias falhou: ${e.message}`) }

  alertas.sort((a, b) => (SEV_PESO[b.severidade] || 0) - (SEV_PESO[a.severidade] || 0))
  return alertas
}

app.get('/api/alertas', requireAuth, (req, res) => {
  // Feed interno: fornecedor (portal) não acessa a central de alertas.
  if (req.user.perfil === 'fornecedor') return res.status(403).json(err('Sem acesso à central de alertas', 403))
  const dias = Math.max(1, Math.min(parseInt(req.query.dias) || 7, 90))
  const alertas = coletarAlertas({ dias, isAdmin: req.user.perfil === 'admin', empresa: empresaDoReq(req) })
  const resumo = { total: alertas.length, alta: 0, media: 0, baixa: 0 }
  for (const a of alertas) resumo[a.severidade] = (resumo[a.severidade] || 0) + 1
  res.json(ok({ resumo, dias, alertas }))
})

// ════════════════════════════════════════════════════════════
// DASHBOARD BI — KPIs gerenciais consolidados (exposição financeira,
// governança do gate, homologação de fornecedores, alertas). Server-side.
// ════════════════════════════════════════════════════════════
function coletarKPIs({ dias = 30, isAdmin = false, empresa = 1 } = {}) {
  const hoje = new Date().toISOString().slice(0, 10)
  const limite = new Date(Date.now() + dias * 864e5).toISOString().slice(0, 10)
  const one = (sql, ...p) => db.prepare(sql).get(...p)

  // Exposição financeira (Pendente/Aprovado = compromissado, ainda não pago).
  const aPagar = one(`SELECT COUNT(*) qtd, COALESCE(SUM(valor),0) val FROM contas_pagar WHERE empresa_id = ? AND status IN ('Pendente','Aprovado')`, empresa)
  const vencido = one(`SELECT COUNT(*) qtd, COALESCE(SUM(valor),0) val FROM contas_pagar
      WHERE empresa_id = ? AND status IN ('Pendente','Aprovado','Vencido') AND data_vencimento IS NOT NULL AND date(data_vencimento) < date(?)`, empresa, hoje)
  const aVencer = one(`SELECT COUNT(*) qtd, COALESCE(SUM(valor),0) val FROM contas_pagar
      WHERE empresa_id = ? AND status IN ('Pendente','Aprovado') AND data_vencimento IS NOT NULL
        AND date(data_vencimento) >= date(?) AND date(data_vencimento) <= date(?)`, empresa, hoje, limite)
  const pago = one(`SELECT COALESCE(SUM(valor),0) val FROM contas_pagar WHERE empresa_id = ? AND status = 'Pago'`, empresa)

  // Governança do gate: bloqueios vs. pagamentos liberados (trilha de logs).
  const bloqueios = one(`SELECT COUNT(*) n FROM logs_sistema WHERE acao = 'payment_blocked'`).n
  const liberados = one(`SELECT COUNT(*) n FROM logs_sistema WHERE acao = 'Pagar' AND modulo = 'contas_pagar'`).n
  const totGate = bloqueios + liberados

  // Homologação e qualidade de fornecedores.
  const fornAtivos = one(`SELECT COUNT(*) n, COALESCE(AVG(score_medio),0) score FROM fornecedores WHERE empresa_id = ? AND ativo = 1`, empresa)
  const porStatus = db.prepare(`SELECT COALESCE(status,'—') status, COUNT(*) n FROM fornecedores WHERE empresa_id = ? AND ativo = 1 GROUP BY status`).all(empresa)

  // Compras: valor comprometido em pedidos ativos e taxa de entrega.
  const pc = one(`SELECT COUNT(*) tot,
      COALESCE(SUM(CASE WHEN status != 'Cancelado' THEN valor_total ELSE 0 END),0) val,
      SUM(CASE WHEN status IN ('Entregue','Recebido','Concluído') THEN 1 ELSE 0 END) entregues
      FROM pedidos_compra WHERE empresa_id = ?`, empresa)

  // Alertas por severidade (reusa o motor da central).
  const alertas = coletarAlertas({ dias, isAdmin, empresa })
  const sevs = { total: alertas.length, alta: 0, media: 0 }
  for (const a of alertas) if (sevs[a.severidade] != null) sevs[a.severidade]++

  // Riscos de compra (motor de anomalias): visão executiva — contagem por
  // tipo e as principais ocorrências, prontas para o painel gerencial.
  const anomalias = alertas.filter(a => String(a.tipo).startsWith('anomalia_'))
  const riscosPorTipo = {}
  for (const a of anomalias) {
    const t = String(a.tipo).replace('anomalia_', '')
    riscosPorTipo[t] = (riscosPorTipo[t] || 0) + 1
  }
  const riscos = {
    total: anomalias.length,
    alta: anomalias.filter(a => a.severidade === 'alta').length,
    por_tipo: riscosPorTipo,
    principais: anomalias.slice(0, 5).map(a => ({
      titulo: a.titulo, severidade: a.severidade, valor: a.valor || 0, ref: a.ref,
    })),
  }

  return {
    gerado_em: new Date().toISOString(),
    dias,
    financeiro: {
      a_pagar_valor: aPagar.val, a_pagar_qtd: aPagar.qtd,
      vencido_valor: vencido.val, vencido_qtd: vencido.qtd,
      a_vencer_valor: aVencer.val, a_vencer_qtd: aVencer.qtd,
      pago_valor: pago.val,
    },
    gate: {
      bloqueios, liberados,
      taxa_bloqueio: totGate ? +(bloqueios / totGate).toFixed(3) : 0,
    },
    fornecedores: {
      ativos: fornAtivos.n, score_medio: +(fornAtivos.score || 0).toFixed(2),
      por_status: porStatus,
    },
    compras: {
      pc_valor_ativo: pc.val, pc_total: pc.tot, pc_entregues: pc.entregues || 0,
      pc_entregues_pct: pc.tot ? +(((pc.entregues || 0) / pc.tot) * 100).toFixed(1) : 0,
    },
    alertas: sevs,
    riscos,
  }
}

app.get('/api/bi', requireAuth, (req, res) => {
  if (req.user.perfil === 'fornecedor') return res.status(403).json(err('Sem acesso ao painel gerencial', 403))
  const dias = Math.max(1, Math.min(parseInt(req.query.dias) || 30, 365))
  res.json(ok(coletarKPIs({ dias, isAdmin: req.user.perfil === 'admin', empresa: empresaDoReq(req) })))
})

// Fluxo de caixa (saídas): comparativo semanal planejado × realizado por contrato.
app.get('/api/fluxo-caixa', requireAuth, (req, res) => {
  if (req.user.perfil === 'fornecedor') return res.status(403).json(err('Sem acesso ao fluxo de caixa', 403))
  const semanas = Math.max(1, Math.min(parseInt(req.query.semanas) || 8, 52))
  const contas = db.prepare(`SELECT valor, data_vencimento, data_pagamento, status, contrato_id, pc_numero FROM contas_pagar WHERE empresa_id = ?`).all(empresaDoReq(req))
  res.json(ok(montarFluxoCaixa(contas, { semanas })))
})

// Fluxo de caixa PROJETADO (forward-looking): entradas (AR em aberto) × saídas
// (AP em aberto) por semana, com saldo acumulado a partir de um saldo inicial.
// Antecipa aperto de caixa (semanas com saldo negativo). Isolado por tenant.
app.get('/api/fluxo-caixa-projetado', requireAuth, (req, res) => {
  if (req.user.perfil === 'fornecedor') return res.status(403).json(err('Sem acesso ao fluxo de caixa', 403))
  const emp = empresaDoReq(req)
  const semanas = Math.max(1, Math.min(parseInt(req.query.semanas) || 8, 52))
  const saldoInicial = req.query.saldo_inicial != null ? Number(req.query.saldo_inicial) || 0 : 0
  const receber = db.prepare(`SELECT valor, data_vencimento, status FROM contas_receber WHERE empresa_id = ?`).all(emp)
  const pagar = db.prepare(`SELECT valor, data_vencimento, status FROM contas_pagar WHERE empresa_id = ?`).all(emp)
  res.json(ok(montarFluxoProjetado({ receber, pagar, semanas, saldoInicial })))
})

// DRE (Demonstração de Resultado) REAL, derivada dos livros do tenant:
// Receita (contas a receber faturadas) − Custos (contas a pagar de pedidos) −
// Despesas (contas a pagar de overhead). Competência por data; ?ano&?mes
// filtram o período. Também expõe a visão CAIXA (recebido − pago).
function _montarDRE(emp, { ano, mes } = {}) {
  const pref = mes && ano ? `${ano}-${String(mes).padStart(2, '0')}` : (ano ? String(ano) : '')
  const like = pref ? pref + '%' : '%'
  const one = (sql, ...p) => db.prepare(sql).get(...p) || {}
  const rec = one(`SELECT COUNT(*) qtd, COALESCE(SUM(valor),0) val FROM contas_receber
     WHERE empresa_id = ? AND status IN ('A Receber','Recebida') AND COALESCE(data_emissao,'') LIKE ?`, emp, like)
  const cpv = one(`SELECT COALESCE(SUM(valor),0) val FROM contas_pagar
     WHERE empresa_id = ? AND pc_id IS NOT NULL AND COALESCE(data_vencimento,'') LIKE ?`, emp, like)
  const desp = one(`SELECT COALESCE(SUM(valor),0) val FROM contas_pagar
     WHERE empresa_id = ? AND pc_id IS NULL AND COALESCE(data_vencimento,'') LIKE ?`, emp, like)
  // Mão de obra própria: custo dos apontamentos de horas no período (competência
  // pela data do apontamento). Compõe o custo dos serviços junto com os pedidos.
  const mo = one(`SELECT COALESCE(SUM(custo),0) val, COALESCE(SUM(horas),0) horas FROM apontamentos_hora
     WHERE empresa_id = ? AND COALESCE(data,'') LIKE ?`, emp, like)
  const recebido = one(`SELECT COALESCE(SUM(valor),0) val FROM contas_receber
     WHERE empresa_id = ? AND status='Recebida' AND COALESCE(data_recebimento,'') LIKE ?`, emp, like)
  const pago = one(`SELECT COALESCE(SUM(valor),0) val FROM contas_pagar
     WHERE empresa_id = ? AND status='Pago' AND COALESCE(data_pagamento,'') LIKE ?`, emp, like)

  const round = n => Math.round(n * 100) / 100
  const receita = rec.val, custoPedidos = cpv.val, custoMaoObra = round(mo.val), despesas = desp.val
  const custos = round(custoPedidos + custoMaoObra)
  const resultadoBruto = receita - custos
  const resultadoOperacional = resultadoBruto - despesas
  const pct = (n, base) => base > 0 ? round((n / base) * 100) : 0
  return {
    periodo: pref || 'total', gerado_em: new Date().toISOString(),
    receita_bruta: receita, receita_qtd: rec.qtd || 0,
    custos, custo_pedidos: custoPedidos, custo_mao_obra: custoMaoObra, horas_mao_obra: round(mo.horas || 0),
    despesas,
    resultado_bruto: round(resultadoBruto), margem_bruta_pct: pct(resultadoBruto, receita),
    resultado_operacional: round(resultadoOperacional), margem_liquida_pct: pct(resultadoOperacional, receita),
    caixa: { recebido: recebido.val, pago: pago.val, saldo: round(recebido.val - pago.val) },
    linhas: [
      { label: 'Receita Bruta de Serviços', valor: receita, tipo: 'receita', nivel: 1 },
      { label: '(-) Custo dos Serviços (pedidos)', valor: -custoPedidos, tipo: 'custo', nivel: 2 },
      { label: '(-) Custo de Mão de Obra (apontamentos)', valor: -custoMaoObra, tipo: 'custo', nivel: 2 },
      { label: '= Resultado Bruto', valor: round(resultadoBruto), tipo: 'subtotal', nivel: 1 },
      { label: '(-) Despesas Operacionais (overhead)', valor: -despesas, tipo: 'custo', nivel: 2 },
      { label: '= Resultado Operacional', valor: round(resultadoOperacional), tipo: 'total', nivel: 1 },
    ],
  }
}

app.get('/api/dre', requireAuth, (req, res) => {
  if (req.user.perfil === 'fornecedor') return res.status(403).json(err('Sem acesso à DRE', 403))
  const ano = req.query.ano ? parseInt(req.query.ano) : null
  const mes = req.query.mes ? parseInt(req.query.mes) : null
  res.json(ok(_montarDRE(empresaDoReq(req), { ano, mes })))
})

// Dashboard financeiro CONSOLIDADO — o "cockpit" executivo: junta a DRE real,
// o fluxo de caixa projetado, a posição de contas a receber/pagar e o ranking
// de contratos por resultado, numa só resposta. Isolado por tenant.
function _montarDashboardFinanceiro(emp, { ano } = {}) {
  ano = ano || new Date().getFullYear()
  const hoje = new Date().toISOString().slice(0, 10)
  const round = n => Math.round(n * 100) / 100
  const one = (sql, ...p) => db.prepare(sql).get(emp, ...p) || {}

  // 1) DRE real do ano.
  const dre = _montarDRE(emp, { ano })

  // 2) Fluxo de caixa projetado (12 semanas) — saldo inicial = saldo caixa da DRE.
  const receber = db.prepare(`SELECT valor, data_vencimento, status FROM contas_receber WHERE empresa_id = ?`).all(emp)
  const pagar = db.prepare(`SELECT valor, data_vencimento, status FROM contas_pagar WHERE empresa_id = ?`).all(emp)
  const fluxo = montarFluxoProjetado({ receber, pagar, semanas: 12, saldoInicial: dre.caixa.saldo })

  // 3) Posição de contas a receber/pagar (aberto e vencido).
  const arAberto = one(`SELECT COALESCE(SUM(valor),0) v, COUNT(*) n FROM contas_receber WHERE empresa_id = ? AND status IN ('A Receber','A Faturar')`)
  const arVencido = one(`SELECT COALESCE(SUM(valor),0) v FROM contas_receber WHERE empresa_id = ? AND status IN ('A Receber','A Faturar') AND COALESCE(data_vencimento,'') <> '' AND data_vencimento < ?`, hoje)
  const apAberto = one(`SELECT COALESCE(SUM(valor),0) v, COUNT(*) n FROM contas_pagar WHERE empresa_id = ? AND status NOT IN ('Pago','Cancelado')`)
  const apVencido = one(`SELECT COALESCE(SUM(valor),0) v FROM contas_pagar WHERE empresa_id = ? AND status NOT IN ('Pago','Cancelado') AND COALESCE(data_vencimento,'') <> '' AND data_vencimento < ?`, hoje)

  // 4) Ranking de contratos por resultado (usa o helper de margem).
  const contratos = db.prepare(`SELECT * FROM contratos WHERE empresa_id = ? ORDER BY created_at DESC LIMIT 100`).all(emp)
  const margens = contratos.map(ct => {
    const m = _margemDoContrato(emp, ct)
    return { contrato_id: m.contrato_id, numero: m.numero, titulo: m.titulo, receita: m.receita, resultado: m.resultado, margem_pct: m.margem_pct }
  }).filter(m => m.receita || m.resultado)
  const topContratos = [...margens].sort((a, b) => b.resultado - a.resultado).slice(0, 5)
  const piores = [...margens].sort((a, b) => a.margem_pct - b.margem_pct).filter(m => m.margem_pct < 0).slice(0, 5)

  // 5) Conciliação pendente (lançamentos bancários não conciliados).
  const conc = one(`SELECT COUNT(*) n FROM extrato_lancamentos WHERE empresa_id = ? AND status='pendente'`)

  return {
    periodo: String(ano), gerado_em: new Date().toISOString(),
    dre: {
      receita: dre.receita_bruta, custos: dre.custos, despesas: dre.despesas,
      resultado_operacional: dre.resultado_operacional, margem_liquida_pct: dre.margem_liquida_pct,
      custo_mao_obra: dre.custo_mao_obra,
    },
    caixa: { ...dre.caixa },
    projecao: {
      saldo_inicial: fluxo.saldo_inicial, saldo_final: fluxo.resumo.saldo_final,
      menor_saldo: fluxo.resumo.menor_saldo, semana_critica: fluxo.resumo.semana_critica,
      aperto_previsto: fluxo.resumo.menor_saldo < 0,
      entradas_previstas: fluxo.resumo.entradas_total, saidas_previstas: fluxo.resumo.saidas_total,
    },
    posicao: {
      a_receber: round(arAberto.v || 0), a_receber_qtd: arAberto.n || 0, a_receber_vencido: round(arVencido.v || 0),
      a_pagar: round(apAberto.v || 0), a_pagar_qtd: apAberto.n || 0, a_pagar_vencido: round(apVencido.v || 0),
      capital_giro: round((arAberto.v || 0) - (apAberto.v || 0)),
    },
    contratos: { top: topContratos, prejuizo: piores, total_avaliados: margens.length },
    conciliacao_pendente: conc.n || 0,
  }
}

app.get('/api/dashboard-financeiro', requireAuth, (req, res) => {
  if (req.user.perfil === 'fornecedor') return res.status(403).json(err('Sem acesso ao dashboard financeiro', 403))
  const ano = req.query.ano ? parseInt(req.query.ano) : null
  res.json(ok(_montarDashboardFinanceiro(empresaDoReq(req), { ano })))
})

// Exportações CSV (Excel abre direto) para diretoria/contador.
app.get('/api/dre/export.csv', requireAuth, (req, res) => {
  if (req.user.perfil === 'fornecedor') return res.status(403).json(err('Sem acesso à DRE', 403))
  const ano = req.query.ano ? parseInt(req.query.ano) : null
  const mes = req.query.mes ? parseInt(req.query.mes) : null
  const dre = _montarDRE(empresaDoReq(req), { ano, mes })
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="dre-${dre.periodo}.csv"`)
  res.send(dreParaCSV(dre))
})

app.get('/api/dashboard-financeiro/export.csv', requireAuth, (req, res) => {
  if (req.user.perfil === 'fornecedor') return res.status(403).json(err('Sem acesso ao dashboard financeiro', 403))
  const ano = req.query.ano ? parseInt(req.query.ano) : null
  const dash = _montarDashboardFinanceiro(empresaDoReq(req), { ano })
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="dashboard-financeiro-${dash.periodo}.csv"`)
  res.send(dashboardParaCSV(dash))
})

// ════════════════════════════════════════════════════════════
// ORÇAMENTO ANUAL (budget) × REALIZADO — planejamento financeiro.
// Metas mensais versus o realizado derivado da DRE, com desvio e % atingido.
// ════════════════════════════════════════════════════════════

// Orçado × realizado do ano: 12 meses + totais. Reusa _montarDRE por mês.
app.get('/api/orcamento', requireAuth, (req, res) => {
  if (req.user.perfil === 'fornecedor') return res.status(403).json(err('Sem acesso ao orçamento', 403))
  const emp = empresaDoReq(req)
  const ano = req.query.ano ? parseInt(req.query.ano) : new Date().getFullYear()
  const metasRows = db.prepare(`SELECT mes, receita_meta, custo_meta, despesa_meta FROM orcamento_metas WHERE empresa_id = ? AND ano = ?`).all(emp, ano)
  const metasPorMes = {}
  for (const m of metasRows) metasPorMes[m.mes] = m
  const realPorMes = {}
  for (let mes = 1; mes <= 12; mes++) {
    const dre = _montarDRE(emp, { ano, mes })
    realPorMes[mes] = { receita: dre.receita_bruta, custos: dre.custos, despesas: dre.despesas }
  }
  res.json(ok(montarOrcamentoAnual(ano, metasPorMes, realPorMes)))
})

// Upsert das metas de um mês (ano/mes). Só financeiro/admin/diretor.
app.post('/api/orcamento', requireAuth, requireRole('admin', 'diretor', 'financeiro'), (req, res) => {
  const b = req.body || {}
  const emp = empresaDoReq(req)
  const ano = parseInt(b.ano), mes = parseInt(b.mes)
  if (!(ano > 0) || !(mes >= 1 && mes <= 12)) return res.status(400).json(err('Ano e mês (1-12) obrigatórios'))
  const num = (v) => { const n = Number(v); return isFinite(n) && n >= 0 ? n : 0 }
  db.prepare(`INSERT INTO orcamento_metas(ano, mes, receita_meta, custo_meta, despesa_meta, empresa_id)
     VALUES(?,?,?,?,?,?)
     ON CONFLICT(empresa_id, ano, mes) DO UPDATE SET receita_meta=excluded.receita_meta, custo_meta=excluded.custo_meta, despesa_meta=excluded.despesa_meta, updated_at=datetime('now')`)
    .run(ano, mes, num(b.receita_meta), num(b.custo_meta), num(b.despesa_meta), emp)
  log(req.user.usuario_id, req.user.nome, 'orcamento_meta', 'orcamento', `Meta ${ano}-${String(mes).padStart(2, '0')}: receita ${num(b.receita_meta)}`)
  res.status(201).json(ok(db.prepare(`SELECT * FROM orcamento_metas WHERE empresa_id = ? AND ano = ? AND mes = ?`).get(emp, ano, mes)))
})

// Consulta a bureau de crédito (provedor por env; mock por padrão).
app.post('/api/credito/consultar', requireAuth, async (req, res) => {
  try {
    const data = await consultarCredito(req.body && req.body.cnpj, { provider: process.env.CREDIT_BUREAU_PROVIDER })
    res.json(ok(data))
  } catch (e) {
    res.status(400).json(err(e.message))
  }
})

// Situação cadastral (Receita/SEFAZ): consulta avulsa do CNPJ.
app.post('/api/receita/consultar', requireAuth, async (req, res) => {
  try {
    const data = await consultarReceita(req.body && req.body.cnpj, { provider: process.env.RECEITA_PROVIDER })
    res.json(ok(data))
  } catch (e) {
    res.status(400).json(err(e.message))
  }
})

// Cadastro completo por CNPJ (proxy server-side, sem CORS) — preenche o form.
app.get('/api/cnpj/:cnpj', requireAuth, async (req, res) => {
  try {
    const data = await consultarCadastroCNPJ(req.params.cnpj, { provider: process.env.RECEITA_PROVIDER })
    res.json(ok(data))
  } catch (e) {
    res.status(400).json(err(e.message))
  }
})

// ════════════════════════════════════════════════════════════
// ACEITE DE SERVIÇO — fluxo de serviço (B2): requisitante atesta a prestação
// ════════════════════════════════════════════════════════════
// Pedido de serviço só paga com aceite do requisitante. Pura (espelhada no Worker).
function exigeAceiteServico(pedido, temAceite) {
  const tipo = String((pedido && pedido.tipo_compra) || 'material').toLowerCase()
  const ehServico = tipo === 'servico' || tipo === 'serviço' || tipo === 'serviço externo' || tipo === 'servico externo'
  return ehServico && !temAceite
}

app.get('/api/aceites-servico', requireAuth, (req, res) => {
  const { pedido_id, os_id } = req.query
  const where = []; const p = []
  if (pedido_id) { where.push('pedido_id = ?'); p.push(pedido_id) }
  if (os_id) { where.push('os_id = ?'); p.push(os_id) }
  const sql = `SELECT * FROM aceites_servico ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC`
  res.json(ok(db.prepare(sql).all(...p)))
})

// O requisitante registra o aceite (ou recusa) do serviço com o checklist técnico.
app.post('/api/pedidos/:id/aceite-servico', requireAuth, (req, res) => {
  const ped = db.prepare(`SELECT * FROM pedidos_compra WHERE id = ?`).get(req.params.id)
  if (!ped) return res.status(404).json(err('Pedido não encontrado'))
  const b = req.body || {}
  const checklist = Array.isArray(b.checklist) ? b.checklist : []
  if (!checklist.length) return res.status(400).json(err('Informe o checklist de recebimento do serviço (especificação técnica)'))
  // Só aceita se todos os itens do checklist estiverem conformes (salvo recusa explícita).
  const todosConformes = checklist.every(c => c && (c.conforme === true || c.conforme === 1))
  const aceito = b.aceitar === false ? 0 : (todosConformes ? 1 : 0)
  if (b.aceitar !== false && !todosConformes) {
    return res.status(409).json(err('Aceite bloqueado: há itens não conformes no checklist'))
  }
  const r = db.prepare(`INSERT INTO aceites_servico(pedido_id, os_id, checklist, aceito, aceito_por, aceito_em, especificacao, observacoes)
     VALUES(?,?,?,?,?,datetime('now'),?,?)`)
    .run(req.params.id, b.os_id ?? null, JSON.stringify(checklist), aceito, req.user.nome, b.especificacao ?? null, b.observacoes ?? null)
  // Marca o pedido como serviço (segue o fluxo de aceite, não almoxarifado).
  db.prepare(`UPDATE pedidos_compra SET tipo_compra='servico', updated_at=datetime('now') WHERE id=?`).run(req.params.id)
  log(req.user.usuario_id, req.user.nome, aceito ? 'aceite_servico' : 'aceite_servico_recusado', 'pedidos_compra', `Aceite de serviço do pedido ${ped.numero}: ${aceito ? 'ACEITO' : 'recusado/pendente'}`)
  res.status(201).json(ok(db.prepare(`SELECT * FROM aceites_servico WHERE id = ?`).get(r.lastInsertRowid)))
})

// ════════════════════════════════════════════════════════════
// WBS — linhas de custo (entidade no backend, vínculo a contrato/projeto)
// ════════════════════════════════════════════════════════════
// Uma linha WBS "pertence" a um contrato quando o contrato_id bate (base da
// amarração OS↔Contrato↔WBS). Pura (espelhada no Worker).
function wbsPertenceAoContrato(linha, contratoId) {
  return !!linha && String(linha.contrato_id ?? '') === String(contratoId ?? '')
}

// Rollup de custos: estimado × realizado por contrato (Controle de Custos).
app.get('/api/wbs/rollup', requireAuth, (req, res) => {
  const { contrato_id } = req.query
  const emp = empresaDoReq(req)
  const linhas = contrato_id
    ? db.prepare(`SELECT * FROM wbs_linhas WHERE empresa_id = ? AND ativo = 1 AND contrato_id = ?`).all(emp, contrato_id)
    : db.prepare(`SELECT * FROM wbs_linhas WHERE empresa_id = ? AND ativo = 1`).all(emp)
  res.json(ok(montarRollupWBS(linhas)))
})

app.get('/api/wbs', requireAuth, (req, res) => {
  const { contrato_id, projeto_id, lead_id, ativo = '1' } = req.query
  const where = ['empresa_id = ?']; const p = [empresaDoReq(req)]
  if (contrato_id) { where.push('contrato_id = ?'); p.push(contrato_id) }
  if (projeto_id) { where.push('projeto_id = ?'); p.push(projeto_id) }
  if (lead_id) { where.push('lead_id = ?'); p.push(lead_id) }
  if (ativo !== 'todos') { where.push('ativo = ?'); p.push(ativo === '0' ? 0 : 1) }
  const sql = `SELECT * FROM wbs_linhas WHERE ${where.join(' AND ')} ORDER BY codigo, id`
  res.json(ok(db.prepare(sql).all(...p)))
})

app.post('/api/wbs', requireAuth, (req, res) => {
  const b = req.body || {}
  if (!b.descricao && !b.codigo) return res.status(400).json(err('Informe ao menos código ou descrição'))
  const qtd = Number(b.quantidade) || 0
  const vUnit = Number(b.valor_unit_est) || 0
  const vTotal = b.valor_total_est != null ? Number(b.valor_total_est) : qtd * vUnit
  const r = db.prepare(`INSERT INTO wbs_linhas(codigo, descricao, natureza, tipo, contrato_id, projeto_id, centro_custo, lead_id, origem, unidade, quantidade, valor_unit_est, valor_total_est, nao_previsto, empresa_id)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(b.codigo ?? null, b.descricao ?? null, b.natureza ?? null, b.tipo || 'OPEX',
      b.contrato_id ?? null, b.projeto_id ?? null, b.centro_custo ?? null, b.lead_id ?? null, b.origem || 'contrato',
      b.unidade ?? null, qtd, vUnit, vTotal, b.nao_previsto ? 1 : 0, empresaDoReq(req))
  // C1: WBS de orçamentação vinculada a um lead → marca a estimativa em andamento.
  if (b.lead_id) {
    db.prepare(`UPDATE crm_oportunidades SET orcamentacao_status='em_andamento' WHERE id = ? AND orcamentacao_status IN ('pendente','nao_iniciada')`).run(b.lead_id)
  }
  res.status(201).json(ok(db.prepare(`SELECT * FROM wbs_linhas WHERE id = ?`).get(r.lastInsertRowid)))
})

app.put('/api/wbs/:id', requireAuth, (req, res) => {
  const cur = rowScoped('wbs_linhas', req)
  if (!cur) return res.status(404).json(err('Linha WBS não encontrada'))
  const b = req.body || {}
  const v = (campo) => b[campo] !== undefined ? b[campo] : cur[campo]
  const qtd = Number(v('quantidade')) || 0
  const vUnit = Number(v('valor_unit_est')) || 0
  const vTotal = b.valor_total_est != null ? Number(b.valor_total_est) : qtd * vUnit
  db.prepare(`UPDATE wbs_linhas SET codigo=?, descricao=?, natureza=?, tipo=?, contrato_id=?, projeto_id=?, centro_custo=?, lead_id=?, origem=?, unidade=?, quantidade=?, valor_unit_est=?, valor_total_est=?, custo_real=?, nao_previsto=?, updated_at=datetime('now') WHERE id=?`)
    .run(v('codigo'), v('descricao'), v('natureza'), v('tipo'), v('contrato_id'), v('projeto_id'), v('centro_custo'), v('lead_id'), v('origem'), v('unidade'), qtd, vUnit, vTotal, Number(v('custo_real')) || 0, b.nao_previsto != null ? (b.nao_previsto ? 1 : 0) : cur.nao_previsto, req.params.id)
  res.json(ok(db.prepare(`SELECT * FROM wbs_linhas WHERE id = ?`).get(req.params.id)))
})

app.delete('/api/wbs/:id', requireAuth, (req, res) => {
  const cur = rowScoped('wbs_linhas', req)
  if (!cur) return res.status(404).json(err('Linha WBS não encontrada'))
  db.prepare(`UPDATE wbs_linhas SET ativo=0, updated_at=datetime('now') WHERE id=?`).run(req.params.id)
  res.json(ok({ ok: true }))
})

// ════════════════════════════════════════════════════════════
// NOTIFICAÇÕES (in-app + e-mail) — alvo por usuário ou por perfil
// ════════════════════════════════════════════════════════════
// Cria uma notificação e, opcionalmente, dispara e-mail (adaptador, mock).
function notificar({ usuario_id = null, perfil = null, titulo, mensagem = '', tipo = 'info', ref_tipo = null, ref_id = null, email = false, empresa = null } = {}) {
  if (!titulo) return
  // Empresa não informada: deriva do destinatário (como log() faz) — evita
  // que um call site esquecido entregue a notificação ao tenant mestre.
  let emp = Number(empresa) || 0
  if (!emp && usuario_id) {
    try { emp = Number(db.prepare(`SELECT empresa_id FROM usuarios WHERE id = ?`).get(usuario_id)?.empresa_id) || 0 } catch {}
  }
  if (!emp) emp = 1
  db.prepare(`INSERT INTO notificacoes(usuario_id, perfil, titulo, mensagem, tipo, ref_tipo, ref_id, empresa_id) VALUES(?,?,?,?,?,?,?,?)`)
    .run(usuario_id, perfil, titulo, mensagem, tipo, ref_tipo, ref_id, emp)
  if (email) {
    try {
      // E-mail por perfil respeita o tenant: só usuários da MESMA empresa.
      const dests = usuario_id
        ? db.prepare(`SELECT email FROM usuarios WHERE id = ? AND email IS NOT NULL`).all(usuario_id)
        : (perfil ? db.prepare(`SELECT email FROM usuarios WHERE perfil = ? AND ativo = 1 AND email IS NOT NULL AND empresa_id = ?`).all(perfil, emp) : [])
      for (const d of dests) enviarEmail({ to: d.email, assunto: titulo, corpo: mensagem }, { provider: process.env.EMAIL_PROVIDER }).catch(() => {})
    } catch { /* e-mail nunca quebra a operação */ }
  }
}
// Filtro de escopo do usuário logado (próprias + do seu perfil + globais),
// SEMPRE dentro da própria empresa (multi-tenant).
const _NOTIF_ESCOPO = `empresa_id = ? AND (usuario_id = ? OR perfil = ? OR (usuario_id IS NULL AND perfil IS NULL))`

app.get('/api/notificacoes', requireAuth, (req, res) => {
  const rows = db.prepare(`SELECT * FROM notificacoes WHERE ${_NOTIF_ESCOPO} ORDER BY created_at DESC LIMIT 100`).all(empresaDoReq(req), req.user.usuario_id, req.user.perfil)
  res.json(ok(rows))
})

app.get('/api/notificacoes/contagem', requireAuth, (req, res) => {
  const n = db.prepare(`SELECT COUNT(*) n FROM notificacoes WHERE lida = 0 AND ${_NOTIF_ESCOPO}`).get(empresaDoReq(req), req.user.usuario_id, req.user.perfil).n
  res.json(ok({ nao_lidas: n }))
})

app.post('/api/notificacoes/ler-todas', requireAuth, (req, res) => {
  db.prepare(`UPDATE notificacoes SET lida = 1 WHERE lida = 0 AND ${_NOTIF_ESCOPO}`).run(empresaDoReq(req), req.user.usuario_id, req.user.perfil)
  res.json(ok({ ok: true }))
})

app.post('/api/notificacoes/:id/lida', requireAuth, (req, res) => {
  const n = db.prepare(`SELECT * FROM notificacoes WHERE id = ? AND ${_NOTIF_ESCOPO}`).get(req.params.id, empresaDoReq(req), req.user.usuario_id, req.user.perfil)
  if (!n) return res.status(404).json(err('Notificação não encontrada'))
  db.prepare(`UPDATE notificacoes SET lida = 1 WHERE id = ?`).run(req.params.id)
  res.json(ok({ ok: true }))
})

// Criação manual / broadcast (interno).
app.post('/api/notificacoes', requireAuth, requireRole('admin', 'diretor', 'financeiro', 'compliance'), (req, res) => {
  const b = req.body || {}
  if (!b.titulo) return res.status(400).json(err('Título obrigatório'))
  notificar({ usuario_id: b.usuario_id || null, perfil: b.perfil || null, titulo: b.titulo, mensagem: b.mensagem || '', tipo: b.tipo || 'info', email: !!b.email, empresa: empresaDoReq(req) })
  res.status(201).json(ok({ ok: true }))
})

// ════════════════════════════════════════════════════════════
// FISCAL — emissão de NF-e / NFS-e / CT-e (adaptador server-side)
// ════════════════════════════════════════════════════════════
// Credenciais do emissor fiscal, injetadas do env (a lib nfe.js é pura).
function _nfeOpts() {
  return {
    provider: process.env.NFE_PROVIDER,
    apiKey: process.env.NFE_API_KEY,
    baseUrl: process.env.NFE_BASE_URL,
    ambiente: process.env.NFE_AMBIENTE,
  }
}

app.get('/api/nfe', requireAuth, (req, res) => {
  res.json(ok(db.prepare(`SELECT * FROM notas_fiscais WHERE empresa_id = ? ORDER BY created_at DESC LIMIT 200`).all(empresaDoReq(req))))
})

app.get('/api/nfe/:id', requireAuth, (req, res) => {
  const n = rowScoped('notas_fiscais', req)
  if (!n) return res.status(404).json(err('Nota não encontrada'))
  res.json(ok(n))
})

app.post('/api/nfe/emitir', requireAuth, requireRole('admin', 'financeiro', 'fiscal'), async (req, res) => {
  const b = req.body || {}
  const emp = empresaDoReq(req)
  // Numeração por série quando não informada.
  const serie = Number(b.serie) || 1
  const numero = Number(b.numero) || (db.prepare(`SELECT COUNT(*) n FROM notas_fiscais WHERE serie = ? AND empresa_id = ?`).get(serie, emp).n + 1)
  try {
    const r = await emitirNotaFiscal({ ...b, numero, serie }, _nfeOpts())
    // 'autorizada' (mock) ou 'processando' (emissor autoriza em background)
    // ambos persistem a nota; 'rejeitada'/'erro' não.
    if (r.status !== 'autorizada' && r.status !== 'processando') {
      return res.status(422).json(err('Emissão rejeitada: ' + (r.motivo || 'dados inválidos')))
    }
    const destinatario = b.cnpj_destinatario || b.cpf_destinatario || b.destinatario || ''
    const ins = db.prepare(`INSERT INTO notas_fiscais(tipo, numero, serie, chave, protocolo, status, valor, cnpj_emitente, destinatario, descricao, danfe_url, xml_url, pedido_id, emitido_por, fonte, provider_id, empresa_id)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(r.tipo || (b.tipo || 'nfe'), r.numero || numero, r.serie || serie, r.chave || null, r.protocolo || null, r.status, (r.valor ?? Number(b.valor)) || 0,
        b.cnpj_emitente || '', destinatario, b.descricao || '', r.danfe_url || null, r.xml_url || null, b.pedido_id || null, req.user.nome, r.fonte || null, r.id || null, emp)
    log(req.user.usuario_id, req.user.nome, 'nfe_emitir', 'notas_fiscais', `${r.tipo_label || r.tipo} ${numero}/${serie} — ${r.status} (${r.fonte || 'mock'})`)
    res.status(201).json(ok(db.prepare(`SELECT * FROM notas_fiscais WHERE id = ?`).get(ins.lastInsertRowid)))
  } catch (e) {
    res.status(400).json(err(e.message))
  }
})

// Consulta o status assíncrono de uma nota no emissor (PlugNotas autoriza em
// background) e atualiza a linha. mock retorna 'autorizada' de imediato.
app.post('/api/nfe/:id/status', requireAuth, requireRole('admin', 'financeiro', 'fiscal'), async (req, res) => {
  const n = rowScoped('notas_fiscais', req)
  if (!n) return res.status(404).json(err('Nota não encontrada'))
  try {
    const r = await consultarNotaFiscal(n.provider_id || n.id, _nfeOpts())
    if (r.status === 'autorizada' || r.status === 'rejeitada' || r.status === 'processando') {
      db.prepare(`UPDATE notas_fiscais SET status=?, chave=COALESCE(?,chave), protocolo=COALESCE(?,protocolo), danfe_url=COALESCE(?,danfe_url), xml_url=COALESCE(?,xml_url), updated_at=datetime('now') WHERE id=?`)
        .run(r.status, r.chave, r.protocolo, r.danfe_url, r.xml_url, n.id)
    }
    res.json(ok({ ...db.prepare(`SELECT * FROM notas_fiscais WHERE id = ?`).get(n.id), _consulta: r.status, _motivo: r.motivo || null }))
  } catch (e) {
    res.status(400).json(err(e.message))
  }
})

app.post('/api/nfe/:id/cancelar', requireAuth, requireRole('admin', 'financeiro', 'fiscal'), (req, res) => {
  const n = rowScoped('notas_fiscais', req)
  if (!n) return res.status(404).json(err('Nota não encontrada'))
  if (n.status === 'cancelada') return res.status(409).json(err('Nota já cancelada'))
  try {
    const r = cancelarNotaFiscal(n.chave, req.body && req.body.justificativa, _nfeOpts())
    if (r.status !== 'cancelada') return res.status(400).json(err(r.motivo || 'cancelamento rejeitado'))
    db.prepare(`UPDATE notas_fiscais SET status='cancelada', justificativa_cancel=?, updated_at=datetime('now') WHERE id=?`)
      .run(String(req.body.justificativa).trim(), req.params.id)
    log(req.user.usuario_id, req.user.nome, 'nfe_cancelar', 'notas_fiscais', `Nota ${n.numero}/${n.serie} cancelada`)
    res.json(ok(db.prepare(`SELECT * FROM notas_fiscais WHERE id = ?`).get(req.params.id)))
  } catch (e) {
    res.status(400).json(err(e.message))
  }
})

// Análise financeira prévia: bureau (mercado) + Receita → parecer automático.
app.post('/api/analise-financeira', requireAuth, async (req, res) => {
  try {
    const cnpj = req.body && req.body.cnpj
    const bureau = await consultarCredito(cnpj, { provider: process.env.CREDIT_BUREAU_PROVIDER })
    let receita = {}
    try { receita = await consultarReceita(cnpj, { provider: process.env.RECEITA_PROVIDER }) } catch (_) { /* sem situação não impede o parecer */ }
    const parecer = analisarFinanceiro({ bureau, receita })
    res.json(ok({ ...parecer, bureau, receita }))
  } catch (e) {
    res.status(400).json(err(e.message))
  }
})

// Numeração atômica: POST /api/sequencia/PC → { numero: 'PC-2026-0001', ... }
app.post('/api/sequencia/:tipo', requireAuth, (req, res) => {
  try {
    const r = proximaSequencia(req.params.tipo, req.body && req.body.ano)
    res.json(ok(r))
  } catch (e) {
    res.status(400).json(err(e.message))
  }
})

// ════════════════════════════════════════════════════════════
// PORTAL DO FORNECEDOR (self-service, escopo restrito ao próprio fornecedor)
// ════════════════════════════════════════════════════════════
// Garante perfil 'fornecedor' COM vínculo. Toda rota /portal usa req.user.fornecedor_id
// como filtro — um fornecedor nunca enxerga dados de outro.
function requirePortal(req, res, next) {
  if (!req.user || req.user.perfil !== 'fornecedor') return res.status(403).json(err('Acesso restrito ao portal do fornecedor', 403))
  if (!req.user.fornecedor_id) return res.status(403).json(err('Usuário sem fornecedor vinculado', 403))
  next()
}

app.get('/api/portal/pedidos', requireAuth, requirePortal, (req, res) => {
  const rows = db.prepare(
    `SELECT id, numero, status, valor_total, prazo_entrega, created_at, nf_numero, nf_valor
       FROM pedidos_compra WHERE fornecedor_id = ? ORDER BY created_at DESC LIMIT 200`
  ).all(req.user.fornecedor_id)
  res.json(ok(rows))
})

app.post('/api/portal/pedidos/:id/nf', requireAuth, requirePortal, (req, res) => {
  const ped = db.prepare(`SELECT * FROM pedidos_compra WHERE id = ?`).get(req.params.id)
  if (!ped) return res.status(404).json(err('Pedido não encontrado'))
  // Ownership: só o dono do pedido pode anexar NF.
  if (ped.fornecedor_id !== req.user.fornecedor_id) return res.status(403).json(err('Pedido não pertence a este fornecedor', 403))
  const { nf_numero, nf_valor } = req.body || {}
  if (!nf_numero) return res.status(400).json(err('Informe o número da NF'))
  db.prepare(`UPDATE pedidos_compra SET nf_numero=?, nf_valor=?, status='NF Enviada', updated_at=datetime('now') WHERE id=?`)
    .run(nf_numero, nf_valor || ped.valor_total || 0, req.params.id)
  log(req.user.usuario_id, req.user.nome, 'Portal NF', 'pedidos_compra', `NF ${nf_numero} enviada no pedido ${ped.numero}`)
  res.json(ok(db.prepare(`SELECT id, numero, status, nf_numero, nf_valor FROM pedidos_compra WHERE id = ?`).get(req.params.id)))
})

app.get('/api/portal/perfil', requireAuth, requirePortal, (req, res) => {
  const f = db.prepare(`SELECT id, nome, razao_social, cnpj, contato, email, telefone, banco, agencia, conta FROM fornecedores WHERE id = ?`).get(req.user.fornecedor_id)
  if (!f) return res.status(404).json(err('Fornecedor não encontrado'))
  res.json(ok(f))
})

app.put('/api/portal/perfil', requireAuth, requirePortal, (req, res) => {
  const f = db.prepare(`SELECT * FROM fornecedores WHERE id = ?`).get(req.user.fornecedor_id)
  if (!f) return res.status(404).json(err('Fornecedor não encontrado'))
  const b = req.body || {}
  // Fornecedor edita só contato (nunca crédito/status/ativo). Dados bancários
  // entram como PENDENTES de dupla aprovação interna (anti-desvio de pagamento).
  const bankChange = alteracaoBancariaSolicitada(f, b)
  db.prepare(`UPDATE fornecedores SET contato=?, email=?, telefone=?, updated_at=datetime('now') WHERE id=?`)
    .run(b.contato ?? f.contato, b.email ?? f.email, b.telefone ?? f.telefone, req.user.fornecedor_id)
  if (bankChange) {
    db.prepare(`UPDATE fornecedores SET banco_pendente=?, agencia_pendente=?, conta_pendente=?, banco_solicitado_por=?, banco_solicitado_em=datetime('now') WHERE id=?`)
      .run(bankChange.banco ?? f.banco, bankChange.agencia ?? f.agencia, bankChange.conta ?? f.conta, `portal:${f.nome}`, req.user.fornecedor_id)
    log(req.user.usuario_id, req.user.nome, 'banco_alteracao_solicitada', 'fornecedores', `Alteração bancária via portal pendente de aprovação: ${f.nome}`)
  }
  log(req.user.usuario_id, req.user.nome, 'Portal perfil', 'fornecedores', `Atualização de cadastro pelo portal`)
  res.json(ok(db.prepare(`SELECT id, nome, contato, email, telefone, banco, agencia, conta, banco_solicitado_por FROM fornecedores WHERE id = ?`).get(req.user.fornecedor_id)))
})

// Normalização de CNPJ em SQL (só dígitos) — usada na detecção de duplicatas.
const CNPJ_NORM = `REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(cnpj,''),'.',''),'/',''),'-',''),' ','')`

// Relatório de duplicatas: fornecedores por CNPJ e NFs repetidas em contas a pagar.
app.get('/api/duplicatas', requireAuth, (req, res) => {
  const emp = empresaDoReq(req)
  const grpForn = db.prepare(`SELECT ${CNPJ_NORM} cnpj, COUNT(*) n FROM fornecedores WHERE ${CNPJ_NORM} <> '' AND empresa_id = ? GROUP BY ${CNPJ_NORM} HAVING n > 1`).all(emp)
  const fornecedores = grpForn.map(g => ({
    cnpj: g.cnpj, total: g.n,
    ocorrencias: db.prepare(`SELECT id, nome, ativo FROM fornecedores WHERE ${CNPJ_NORM} = ? AND empresa_id = ?`).all(g.cnpj, emp),
  }))
  const grpNF = db.prepare(`SELECT nota_fiscal, COUNT(*) n FROM contas_pagar
      WHERE nota_fiscal IS NOT NULL AND nota_fiscal <> '' AND nota_fiscal <> '—' GROUP BY nota_fiscal HAVING n > 1`).all()
  const notas_fiscais = grpNF.map(g => ({
    nota_fiscal: g.nota_fiscal, total: g.n,
    ocorrencias: db.prepare(`SELECT id, fornecedor_nome, valor FROM contas_pagar WHERE nota_fiscal = ?`).all(g.nota_fiscal),
  }))
  res.json(ok({ resumo: { fornecedores_dup: fornecedores.length, nf_dup: notas_fiscais.length }, fornecedores, notas_fiscais }))
})

// Multi-tenant: fornecedor sempre buscado no escopo da empresa do usuário.
// Retorna null se não existir OU pertencer a outro tenant (→ 404).
const fornecedorScoped = (req) => db.prepare(`SELECT * FROM fornecedores WHERE id = ? AND empresa_id = ?`).get(req.params.id, empresaDoReq(req))

app.get('/api/fornecedores', requireAuth, (req, res) => {
  const { q = '', ativo = '1', limit = 100, offset = 0 } = req.query
  let sql = `SELECT f.*, COALESCE(ROUND(AVG(a.nota_media), 1), 0) as score_calculado, COUNT(a.id) as total_avaliacoes
    FROM fornecedores f LEFT JOIN avaliacoes_fornecedor a ON a.fornecedor_id = f.id`
  const where = ['f.empresa_id = ?']
  const params = [empresaDoReq(req)]
  if (ativo !== 'todos') { where.push('f.ativo = ?'); params.push(parseInt(ativo)) }
  if (q) { where.push('(f.nome LIKE ? OR f.cnpj LIKE ? OR f.email LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`) }
  if (where.length) sql += ' WHERE ' + where.join(' AND ')
  sql += ' GROUP BY f.id ORDER BY f.nome LIMIT ? OFFSET ?'
  params.push(parseInt(limit), parseInt(offset))
  const rows = db.prepare(sql).all(...params)
  res.json(ok(rows, { total: rows.length }))
})

app.get('/api/fornecedores/:id', requireAuth, (req, res) => {
  const f = fornecedorScoped(req)
  if (!f) return res.status(404).json(err('Fornecedor não encontrado'))
  const avaliacoes = db.prepare(`SELECT * FROM avaliacoes_fornecedor WHERE fornecedor_id = ? ORDER BY created_at DESC LIMIT 10`).all(req.params.id)
  res.json(ok({ ...f, avaliacoes, idf: _idfDoFornecedor(req.params.id) }))
})

// IDF — Índice de Desempenho do Fornecedor (OTD + avaliações), server-side.
function _idfDoFornecedor(id) {
  const pedidos = db.prepare(`SELECT enviado_em, entregue_em, prazo_entrega, status FROM pedidos_compra WHERE fornecedor_id = ?`).all(id)
  const avaliacoes = db.prepare(`SELECT nota_media FROM avaliacoes_fornecedor WHERE fornecedor_id = ?`).all(id)
  return calcularIDF({ pedidos, avaliacoes })
}
app.get('/api/fornecedores/:id/idf', requireAuth, (req, res) => {
  const f = fornecedorScoped(req)
  if (!f) return res.status(404).json(err('Fornecedor não encontrado'))
  res.json(ok({ fornecedor_id: f.id, nome: f.nome, ..._idfDoFornecedor(req.params.id) }))
})

app.post('/api/fornecedores', requireAuth, (req, res) => {
  const b = req.body || {}
  const nome = b.nome
  if (!nome) return res.status(400).json(err('Nome obrigatório'))
  // Qualidade de dados: bloqueia CNPJ duplicado (compara só dígitos).
  const emp = empresaDoReq(req)
  const cnpjDig = String(b.cnpj || '').replace(/\D/g, '')
  if (cnpjDig) {
    // Duplicidade avaliada apenas dentro da própria empresa (tenant).
    const dup = db.prepare(`SELECT id, nome FROM fornecedores WHERE ${CNPJ_NORM} = ? AND empresa_id = ?`).get(cnpjDig, emp)
    if (dup) return res.status(409).json(err(`CNPJ já cadastrado no fornecedor "${dup.nome}" (#${dup.id}) — duplicata`))
  }
  // Aceita aliases vindos do frontend (contato_nome, prazo_pagamento).
  const contato = b.contato ?? b.contato_nome ?? null
  const prazo = b.prazo_entrega ?? b.prazo_pagamento ?? 7
  const r = db.prepare(
    `INSERT INTO fornecedores(nome,razao_social,nome_fantasia,cnpj,email,telefone,contato,cidade,estado,categoria,
       banco,agencia,conta,prazo_entrega,condicao_pagamento,observacoes,faturamento_anual,limite_credito,
       score_credito,classificacao_credito,analise_credito,status,ativo,empresa_id)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    nome, b.razao_social ?? null, b.nome_fantasia ?? null, b.cnpj ?? null, b.email ?? null, b.telefone ?? null,
    contato, b.cidade ?? null, b.estado ?? null, b.categoria || 'Geral',
    b.banco ?? null, b.agencia ?? null, b.conta ?? null, prazo, b.condicao_pagamento || '30 dias', b.observacoes ?? null,
    b.faturamento_anual ?? 0, b.limite_credito ?? 0, b.score_credito ?? 0, b.classificacao_credito ?? null,
    b.analise_credito ?? null, b.status || 'Em Homologação', b.ativo ?? 1, emp
  )
  const f = db.prepare(`SELECT * FROM fornecedores WHERE id = ?`).get(r.lastInsertRowid)
  log(req.user.usuario_id, req.user.nome, 'Criar', 'fornecedores', `Fornecedor criado: ${nome}`)
  // Notifica Financeiro e Compliance: novo fornecedor aguardando homologação.
  notificar({ perfil: 'financeiro', titulo: 'Novo fornecedor a homologar', mensagem: `${nome} aguarda aprovação Financeiro + Compliance.`, tipo: 'homologacao', ref_tipo: 'fornecedor', ref_id: String(f.id), email: true, empresa: emp })
  notificar({ perfil: 'compliance', titulo: 'Novo fornecedor a homologar', mensagem: `${nome} aguarda aprovação Financeiro + Compliance.`, tipo: 'homologacao', ref_tipo: 'fornecedor', ref_id: String(f.id), empresa: emp })
  res.status(201).json(ok(f))
})

// Fornecedor homologado = aprovado por Financeiro E Compliance. Pura (espelhada no Worker).
function fornecedorHomologado(f) {
  if (!f) return false
  if (f.status === 'Homologado') return true
  return !!(String(f.aprovado_financeiro_por || '').trim() && String(f.aprovado_compliance_por || '').trim())
}

// Aplica uma etapa de homologação e promove a 'Homologado' quando ambas existem.
function _registrarHomologacao(req, res, etapa) {
  const f = fornecedorScoped(req)
  if (!f) return res.status(404).json(err('Fornecedor não encontrado'))
  if (f.status === 'Homologado') return res.status(409).json(err('Fornecedor já homologado'))
  const col = etapa === 'financeiro'
    ? { por: 'aprovado_financeiro_por', em: 'aprovado_financeiro_em' }
    : { por: 'aprovado_compliance_por', em: 'aprovado_compliance_em' }
  db.prepare(`UPDATE fornecedores SET ${col.por}=?, ${col.em}=datetime('now'), updated_at=datetime('now') WHERE id=?`).run(req.user.nome, req.params.id)
  const at = db.prepare(`SELECT * FROM fornecedores WHERE id = ?`).get(req.params.id)
  let homologado = false
  if (at.aprovado_financeiro_por && at.aprovado_compliance_por) {
    db.prepare(`UPDATE fornecedores SET status='Homologado', updated_at=datetime('now') WHERE id=?`).run(req.params.id)
    homologado = true
  }
  log(req.user.usuario_id, req.user.nome, `homologacao_${etapa}`, 'fornecedores', `Aprovação ${etapa}: ${f.nome}${homologado ? ' → HOMOLOGADO' : ''}`)
  res.json(ok(db.prepare(`SELECT * FROM fornecedores WHERE id = ?`).get(req.params.id)))
}

// Etapa Financeiro (perfil financeiro/admin).
app.post('/api/fornecedores/:id/homologar/financeiro', requireAuth, requireRole('admin', 'financeiro'), (req, res) => _registrarHomologacao(req, res, 'financeiro'))
// Etapa Compliance (perfil compliance/diretor/admin).
app.post('/api/fornecedores/:id/homologar/compliance', requireAuth, requireRole('admin', 'diretor', 'compliance'), (req, res) => _registrarHomologacao(req, res, 'compliance'))
// Reprovação da homologação (volta o cadastro ao estado bloqueado).
app.post('/api/fornecedores/:id/reprovar-homologacao', requireAuth, requireRole('admin', 'diretor', 'compliance', 'financeiro'), (req, res) => {
  const f = fornecedorScoped(req)
  if (!f) return res.status(404).json(err('Fornecedor não encontrado'))
  db.prepare(`UPDATE fornecedores SET status='Reprovado', aprovado_financeiro_por=NULL, aprovado_financeiro_em=NULL, aprovado_compliance_por=NULL, aprovado_compliance_em=NULL, updated_at=datetime('now') WHERE id=?`).run(req.params.id)
  log(req.user.usuario_id, req.user.nome, 'homologacao_reprovada', 'fornecedores', `Homologação reprovada: ${f.nome} (${req.body?.motivo || 'sem motivo'})`)
  res.json(ok(db.prepare(`SELECT * FROM fornecedores WHERE id = ?`).get(req.params.id)))
})

// Detecta alteração de dados bancários (banco/agência/conta) no corpo vs. atual.
function alteracaoBancariaSolicitada(atual, b) {
  const mudou = {}
  for (const c of ['banco', 'agencia', 'conta']) {
    if (b[c] !== undefined && String(b[c] ?? '') !== String(atual[c] ?? '')) mudou[c] = b[c]
  }
  return Object.keys(mudou).length ? mudou : null
}

// Aprovação da alteração bancária — exige 2ª pessoa (segregação anti-desvio).
app.post('/api/fornecedores/:id/aprovar-banco', requireAuth, requireRole('admin', 'diretor', 'financeiro'), (req, res) => {
  const f = fornecedorScoped(req)
  if (!f) return res.status(404).json(err('Fornecedor não encontrado'))
  if (!f.banco_solicitado_por) return res.status(400).json(err('Não há alteração bancária pendente'))
  if (f.banco_solicitado_por === req.user.nome) {
    return res.status(403).json(err('A aprovação deve ser feita por outro usuário (segregação de funções)'))
  }
  db.prepare(`UPDATE fornecedores SET banco=?, agencia=?, conta=?, banco_pendente=NULL, agencia_pendente=NULL, conta_pendente=NULL, banco_solicitado_por=NULL, banco_solicitado_em=NULL, updated_at=datetime('now') WHERE id=?`)
    .run(f.banco_pendente, f.agencia_pendente, f.conta_pendente, req.params.id)
  log(req.user.usuario_id, req.user.nome, 'banco_alteracao_aprovada', 'fornecedores', `Alteração bancária aprovada: ${f.nome} (solicitante: ${f.banco_solicitado_por})`)
  res.json(ok(db.prepare(`SELECT * FROM fornecedores WHERE id = ?`).get(req.params.id)))
})

// Rejeição descarta a alteração pendente.
app.post('/api/fornecedores/:id/rejeitar-banco', requireAuth, requireRole('admin', 'diretor', 'financeiro'), (req, res) => {
  const f = fornecedorScoped(req)
  if (!f) return res.status(404).json(err('Fornecedor não encontrado'))
  if (!f.banco_solicitado_por) return res.status(400).json(err('Não há alteração bancária pendente'))
  db.prepare(`UPDATE fornecedores SET banco_pendente=NULL, agencia_pendente=NULL, conta_pendente=NULL, banco_solicitado_por=NULL, banco_solicitado_em=NULL WHERE id=?`).run(req.params.id)
  log(req.user.usuario_id, req.user.nome, 'banco_alteracao_rejeitada', 'fornecedores', `Alteração bancária rejeitada: ${f.nome}`)
  res.json(ok(db.prepare(`SELECT * FROM fornecedores WHERE id = ?`).get(req.params.id)))
})

app.put('/api/fornecedores/:id', requireAuth, (req, res) => {
  const b = req.body || {}
  const atual = fornecedorScoped(req)
  if (!atual) return res.status(404).json(err('Fornecedor não encontrado'))
  // Merge parcial: só sobrescreve o que veio no corpo (aceita aliases).
  const v = (campo, ...alias) => { for (const k of [campo, ...alias]) if (b[k] !== undefined) return b[k]; return atual[campo] }
  // Dados bancários NÃO são aplicados direto: ficam pendentes de 2ª aprovação.
  const bankChange = alteracaoBancariaSolicitada(atual, b)
  db.prepare(
    `UPDATE fornecedores SET nome=?,razao_social=?,nome_fantasia=?,cnpj=?,email=?,telefone=?,contato=?,cidade=?,estado=?,
       categoria=?,ativo=?,banco=?,agencia=?,conta=?,prazo_entrega=?,condicao_pagamento=?,observacoes=?,
       faturamento_anual=?,limite_credito=?,score_credito=?,classificacao_credito=?,analise_credito=?,status=?,
       updated_at=datetime('now') WHERE id=?`
  ).run(
    v('nome'), v('razao_social'), v('nome_fantasia'), v('cnpj'), v('email'), v('telefone'), v('contato', 'contato_nome'),
    v('cidade'), v('estado'), v('categoria'), b.ativo ?? atual.ativo, atual.banco, atual.agencia, atual.conta,
    v('prazo_entrega', 'prazo_pagamento'), v('condicao_pagamento'), v('observacoes'),
    v('faturamento_anual'), v('limite_credito'), v('score_credito'), v('classificacao_credito'), v('analise_credito'),
    v('status'), req.params.id
  )
  if (bankChange) {
    db.prepare(`UPDATE fornecedores SET banco_pendente=?, agencia_pendente=?, conta_pendente=?, banco_solicitado_por=?, banco_solicitado_em=datetime('now') WHERE id=?`)
      .run(bankChange.banco ?? atual.banco, bankChange.agencia ?? atual.agencia, bankChange.conta ?? atual.conta, req.user.nome, req.params.id)
    log(req.user.usuario_id, req.user.nome, 'banco_alteracao_solicitada', 'fornecedores', `Alteração bancária pendente de aprovação: ${atual.nome}`)
    notificar({ perfil: 'financeiro', titulo: 'Alteração bancária a aprovar', mensagem: `Dados bancários de ${atual.nome} aguardam 2ª aprovação.`, tipo: 'banco', ref_tipo: 'fornecedor', ref_id: String(req.params.id), email: true, empresa: empresaDoReq(req) })
  }
  const f = db.prepare(`SELECT * FROM fornecedores WHERE id = ?`).get(req.params.id)
  log(req.user.usuario_id, req.user.nome, 'Editar', 'fornecedores', `Fornecedor atualizado: ${v('nome')}`)
  res.json(ok(f))
})

app.post('/api/fornecedores/:id/avaliacoes', requireAuth, (req, res) => {
  if (!fornecedorScoped(req)) return res.status(404).json(err('Fornecedor não encontrado'))
  const { nota_qualidade = 0, nota_prazo = 0, nota_preco = 0, nota_atendimento = 0, comentario, pedido_id } = req.body
  const media = (nota_qualidade + nota_prazo + nota_preco + nota_atendimento) / 4
  db.prepare(
    `INSERT INTO avaliacoes_fornecedor(fornecedor_id, usuario_id, usuario_nome, nota_qualidade, nota_prazo, nota_preco, nota_atendimento, nota_media, comentario, pedido_id)
     VALUES(?,?,?,?,?,?,?,?,?,?)`
  ).run(req.params.id, req.user.usuario_id, req.user.nome, nota_qualidade, nota_prazo, nota_preco, nota_atendimento, media, comentario, pedido_id)
  const novoScore = db.prepare(`SELECT ROUND(AVG(nota_media),1) as m FROM avaliacoes_fornecedor WHERE fornecedor_id = ?`).get(req.params.id).m
  db.prepare(`UPDATE fornecedores SET score_medio = ? WHERE id = ?`).run(novoScore, req.params.id)
  res.status(201).json(ok({ score_medio: novoScore }))
})

// ════════════════════════════════════════════════════════════
// ORDENS DE SERVIÇO
// ════════════════════════════════════════════════════════════
function nextOS() {
  const year = new Date().getFullYear()
  const count = db.prepare(`SELECT COUNT(*) as n FROM ordens_servico WHERE numero LIKE ?`).get(`OS-${year}-%`).n
  return `OS-${year}-${String(count + 1).padStart(3, '0')}`
}

app.get('/api/os', requireAuth, (req, res) => {
  const { status, q = '' } = req.query
  let sql = `SELECT os.*, u.nome as solicitante FROM ordens_servico os LEFT JOIN usuarios u ON u.id = os.solicitante_id`
  const where = ['os.empresa_id = ?']
  const params = [empresaDoReq(req)]
  if (status) { where.push('os.status = ?'); params.push(status) }
  if (q) { where.push('(os.numero LIKE ? OR os.titulo LIKE ?)'); params.push(`%${q}%`, `%${q}%`) }
  sql += ' WHERE ' + where.join(' AND ')
  sql += ' ORDER BY os.created_at DESC'
  res.json(ok(db.prepare(sql).all(...params)))
})

app.get('/api/os/:id', requireAuth, (req, res) => {
  const os = rowScoped('ordens_servico', req)
  if (!os) return res.status(404).json(err('OS não encontrada'))
  const fluxo = db.prepare(`SELECT * FROM fluxo_aprovacao WHERE os_id = ? ORDER BY estagio`).all(req.params.id)
  res.json(ok({ ...os, fluxo }))
})

// Centros de custo de overhead (OS administrativa sem contrato). Lista fixa,
// sobrescrevível por env OVERHEAD_CENTROS (csv).
const OVERHEAD_CENTROS = (process.env.OVERHEAD_CENTROS || 'Administrativo,TI,RH,Comercial,Financeiro,SSMA,Diretoria,Manutenção Interna').split(',').map(s => s.trim()).filter(Boolean)
const TIPOS_RECURSO = ['material', 'servico', 'locacao', 'mao_obra']

app.get('/api/overhead-centros', requireAuth, (req, res) => res.json(ok(OVERHEAD_CENTROS)))

// Valida a amarração da OS: Contrato OU overhead; tipo de recurso; e WBS (se
// referenciar uma linha do backend) pertencente ao contrato. Devolve {erro,code}.
function validarVinculoOS(b) {
  const contrato_id = b.contrato_id || null
  const overhead = b.centro_custo_overhead || null
  if (!contrato_id && !overhead) return { erro: 'Informe o Contrato ou o centro de custo de overhead (OS administrativa)' }
  if (overhead && !OVERHEAD_CENTROS.includes(overhead)) return { erro: 'Centro de custo de overhead inválido' }
  const tipo = b.tipo_recurso ? String(b.tipo_recurso).toLowerCase() : null
  if (tipo && !TIPOS_RECURSO.includes(tipo)) return { erro: 'Tipo de recurso inválido (material, servico, locacao, mao_obra)' }
  if (b.wbs_linha_id) {
    const linha = db.prepare(`SELECT * FROM wbs_linhas WHERE id = ?`).get(b.wbs_linha_id)
    if (!linha) return { erro: 'Linha WBS informada não existe' }
    if (contrato_id && !wbsPertenceAoContrato(linha, contrato_id)) return { erro: 'A linha WBS não pertence ao contrato da OS', code: 409 }
  }
  return { ok: true, tipo }
}

app.post('/api/os', requireAuth, (req, res) => {
  const b = req.body || {}
  const { titulo, descricao, departamento, prioridade, valor_estimado, centro_custo, projeto, data_necessidade, wbs } = b
  if (!titulo) return res.status(400).json(err('Título obrigatório'))
  // Compliance: WBS obrigatória para rastreabilidade de custo na origem da demanda.
  if (!wbs || !String(wbs).trim()) return res.status(400).json(err('Vínculo WBS obrigatório na OS (rastreabilidade de custo)'))
  // A2: amarração obrigatória a Contrato ou overhead + WBS coerente com o contrato.
  const vin = validarVinculoOS(b)
  if (vin.erro) return res.status(vin.code || 400).json(err(vin.erro, vin.code || 400))
  const numero = nextOS()
  const r = db.prepare(
    `INSERT INTO ordens_servico(numero, titulo, descricao, solicitante_id, solicitante_nome, departamento, prioridade, status, valor_estimado, centro_custo, projeto, data_necessidade, wbs, contrato_id, centro_custo_overhead, tipo_recurso, wbs_linha_id, empresa_id)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(numero, titulo, descricao, req.user.usuario_id, req.user.nome, departamento, prioridade || 'Normal', 'Rascunho', valor_estimado || 0, centro_custo, projeto, data_necessidade, String(wbs).trim(),
    b.contrato_id || null, b.centro_custo_overhead || null, vin.tipo || 'material', b.wbs_linha_id || null, empresaDoReq(req))
  const os = db.prepare(`SELECT * FROM ordens_servico WHERE id = ?`).get(r.lastInsertRowid)
  log(req.user.usuario_id, req.user.nome, 'Criar', 'os', `OS criada: ${numero}`)
  res.status(201).json(ok(os))
})

app.put('/api/os/:id', requireAuth, (req, res) => {
  const cur = rowScoped('ordens_servico', req)
  if (!cur) return res.status(404).json(err('OS não encontrada'))
  const { titulo, descricao, departamento, prioridade, status, valor_estimado, centro_custo, projeto, data_necessidade } = req.body
  // WBS não pode ser removida; se enviada, deve permanecer preenchida.
  let wbs = cur.wbs
  if (req.body.wbs !== undefined) {
    if (!String(req.body.wbs).trim()) return res.status(400).json(err('WBS não pode ser removida da OS'))
    wbs = String(req.body.wbs).trim()
  }
  // Campos de amarração (mantêm o atual quando omitidos); revalida se mudarem.
  const v = (campo) => req.body[campo] !== undefined ? req.body[campo] : cur[campo]
  const efetivo = { contrato_id: v('contrato_id'), centro_custo_overhead: v('centro_custo_overhead'), tipo_recurso: v('tipo_recurso'), wbs_linha_id: v('wbs_linha_id') }
  if (['contrato_id', 'centro_custo_overhead', 'tipo_recurso', 'wbs_linha_id'].some(k => req.body[k] !== undefined)) {
    const vin = validarVinculoOS(efetivo)
    if (vin.erro) return res.status(vin.code || 400).json(err(vin.erro, vin.code || 400))
  }
  db.prepare(
    `UPDATE ordens_servico SET titulo=?,descricao=?,departamento=?,prioridade=?,status=?,valor_estimado=?,centro_custo=?,projeto=?,data_necessidade=?,wbs=?,contrato_id=?,centro_custo_overhead=?,tipo_recurso=?,wbs_linha_id=?,updated_at=datetime('now') WHERE id=?`
  ).run(titulo, descricao, departamento, prioridade, status, valor_estimado, centro_custo, projeto, data_necessidade, wbs,
    efetivo.contrato_id || null, efetivo.centro_custo_overhead || null, efetivo.tipo_recurso || cur.tipo_recurso, efetivo.wbs_linha_id || null, req.params.id)
  const os = db.prepare(`SELECT * FROM ordens_servico WHERE id = ?`).get(req.params.id)
  log(req.user.usuario_id, req.user.nome, 'Editar', 'os', `OS atualizada: ${os.numero}`)
  res.json(ok(os))
})

app.post('/api/os/:id/iniciar-fluxo', requireAuth, (req, res) => {
  if (!rowScoped('ordens_servico', req)) return res.status(404).json(err('OS não encontrada'))
  db.prepare(`UPDATE ordens_servico SET status = 'Em Análise', updated_at = datetime('now') WHERE id = ?`).run(req.params.id)
  const os = db.prepare(`SELECT * FROM ordens_servico WHERE id = ?`).get(req.params.id)
  db.prepare(`INSERT INTO fluxo_aprovacao(os_id, estagio, tipo, status) VALUES(?,1,'OS','Pendente')`).run(req.params.id)
  log(req.user.usuario_id, req.user.nome, 'IniciarFluxo', 'os', `Fluxo iniciado: ${os.numero}`)
  res.json(ok(os))
})

// Conclui a OS e LANÇA o custo realizado na linha WBS (custo_real acumulado).
app.post('/api/os/:id/concluir', requireAuth, (req, res) => {
  const os = rowScoped('ordens_servico', req)
  if (!os) return res.status(404).json(err('OS não encontrada'))
  if (os.status === 'Concluída') return res.status(409).json(err('OS já concluída'))
  const custo = Number(req.body?.custo_realizado) || 0
  db.prepare(`UPDATE ordens_servico SET status='Concluída', updated_at=datetime('now') WHERE id=?`).run(req.params.id)
  let wbs_linha = null
  if (os.wbs_linha_id && custo > 0) {
    db.prepare(`UPDATE wbs_linhas SET custo_real = COALESCE(custo_real,0) + ?, updated_at=datetime('now') WHERE id=?`).run(custo, os.wbs_linha_id)
    wbs_linha = db.prepare(`SELECT id, codigo, descricao, valor_total_est, custo_real FROM wbs_linhas WHERE id=?`).get(os.wbs_linha_id)
  }
  log(req.user.usuario_id, req.user.nome, 'os_concluir', 'os', `OS ${os.numero} concluída — custo realizado R$ ${custo.toFixed(2)} na WBS ${wbs_linha?.codigo || '—'}`)
  res.json(ok({ os: db.prepare(`SELECT * FROM ordens_servico WHERE id = ?`).get(req.params.id), wbs_linha }))
})

// ════════════════════════════════════════════════════════════
// FLUXO DE APROVAÇÃO
// ════════════════════════════════════════════════════════════
app.get('/api/fluxo', requireAuth, (req, res) => {
  const rows = db.prepare(
    `SELECT f.*, os.numero as os_numero, os.titulo as os_titulo, os.valor_estimado FROM fluxo_aprovacao f
     JOIN ordens_servico os ON os.id = f.os_id
     WHERE f.status = 'Pendente' ORDER BY f.created_at`
  ).all()
  res.json(ok(rows))
})

app.post('/api/fluxo/:id/aprovar', requireAuth, requireRole('admin', 'diretor', 'supervisor', 'compras'), (req, res) => {
  const { comentario = '' } = req.body
  db.prepare(
    `UPDATE fluxo_aprovacao SET status='Aprovado', aprovador_id=?, aprovador_nome=?, comentario=?, data_acao=datetime('now') WHERE id=?`
  ).run(req.user.usuario_id, req.user.nome, comentario, req.params.id)
  const f = db.prepare(`SELECT * FROM fluxo_aprovacao WHERE id = ?`).get(req.params.id)
  db.prepare(`UPDATE ordens_servico SET status='Aprovada', aprovado_em=datetime('now'), aprovado_por=? WHERE id=?`).run(req.user.nome, f.os_id)
  log(req.user.usuario_id, req.user.nome, 'Aprovar', 'fluxo', `OS aprovada`)
  res.json(ok(f))
})

app.post('/api/fluxo/:id/reprovar', requireAuth, requireRole('admin', 'diretor', 'supervisor', 'compras'), (req, res) => {
  const { comentario = '' } = req.body
  db.prepare(
    `UPDATE fluxo_aprovacao SET status='Reprovado', aprovador_id=?, aprovador_nome=?, comentario=?, data_acao=datetime('now') WHERE id=?`
  ).run(req.user.usuario_id, req.user.nome, comentario, req.params.id)
  const f = db.prepare(`SELECT * FROM fluxo_aprovacao WHERE id = ?`).get(req.params.id)
  db.prepare(`UPDATE ordens_servico SET status='Reprovada', updated_at=datetime('now') WHERE id=?`).run(f.os_id)
  log(req.user.usuario_id, req.user.nome, 'Reprovar', 'fluxo', `OS reprovada`)
  res.json(ok(f))
})

// ════════════════════════════════════════════════════════════
// REQUISIÇÕES DE COMPRA
// ════════════════════════════════════════════════════════════
function nextRC() {
  const year = new Date().getFullYear()
  const count = db.prepare(`SELECT COUNT(*) as n FROM requisicoes_compra WHERE numero LIKE ?`).get(`RC-${year}-%`).n
  return `RC-${year}-${String(count + 1).padStart(3, '0')}`
}

app.get('/api/rc', requireAuth, (req, res) => {
  const { status, q = '' } = req.query
  let sql = `SELECT rc.* FROM requisicoes_compra rc`
  const where = ['rc.empresa_id = ?']; const params = [empresaDoReq(req)]
  if (status) { where.push('rc.status = ?'); params.push(status) }
  if (q) { where.push('(rc.numero LIKE ? OR rc.descricao LIKE ?)'); params.push(`%${q}%`, `%${q}%`) }
  sql += ' WHERE ' + where.join(' AND ')
  sql += ' ORDER BY rc.created_at DESC'
  const rows = db.prepare(sql).all(...params)
  const result = rows.map(r => ({ ...r, itens: db.prepare(`SELECT * FROM rc_itens WHERE rc_id = ?`).all(r.id) }))
  res.json(ok(result))
})

app.get('/api/rc/:id', requireAuth, (req, res) => {
  const rc = rowScoped('requisicoes_compra', req)
  if (!rc) return res.status(404).json(err('RC não encontrada'))
  const itens = db.prepare(`SELECT * FROM rc_itens WHERE rc_id = ?`).all(req.params.id)
  res.json(ok({ ...rc, itens }))
})

// Tipos de RC aceitos (classificação obrigatória do gasto). Aceita acento/caixa.
function normalizarTipoRC(v) {
  const k = String(v || '').trim().toLowerCase()
  if (k === 'material') return 'Material'
  if (k === 'servico' || k === 'servi\u00e7o' || k === 'servi\u00e7os' || k === 'servicos') return 'Servi\u00e7o'
  if (k === 'equipamento') return 'Equipamento'
  return null
}

// Insere uma RC + itens (reutilizado por POST /api/rc e pela reposição de
// estoque). tipo já canônico; wbs já validada pelo chamador.
function inserirRC(emp, user, { os_id = null, os_numero = null, departamento = null, prioridade = 'Normal', observacoes = null, tipo, wbs }, itens = []) {
  const numero = nextRC()
  const valorTotal = itens.reduce((s, i) => s + ((i.quantidade || 1) * (i.valor_unitario_estimado || 0)), 0)
  const r = db.prepare(
    `INSERT INTO requisicoes_compra(numero, os_id, os_numero, solicitante_id, solicitante_nome, departamento, prioridade, status, valor_total, observacoes, tipo, wbs, empresa_id)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(numero, os_id, os_numero, user.usuario_id, user.nome, departamento, prioridade, 'Rascunho', valorTotal, observacoes, tipo, String(wbs).trim(), emp)
  const rcId = r.lastInsertRowid
  for (const item of itens) {
    const vt = (item.quantidade || 1) * (item.valor_unitario_estimado || 0)
    db.prepare(`INSERT INTO rc_itens(rc_id, descricao, quantidade, unidade, valor_unitario_estimado, valor_total_estimado, codigo_produto) VALUES(?,?,?,?,?,?,?)`)
      .run(rcId, item.descricao, item.quantidade || 1, item.unidade || 'UN', item.valor_unitario_estimado || 0, vt, item.codigo_produto)
  }
  const rc = db.prepare(`SELECT * FROM requisicoes_compra WHERE id = ?`).get(rcId)
  return { ...rc, itens: db.prepare(`SELECT * FROM rc_itens WHERE rc_id = ?`).all(rcId) }
}

app.post('/api/rc', requireAuth, (req, res) => {
  const { os_id, os_numero, departamento, prioridade, observacoes, tipo, wbs, itens = [] } = req.body
  // Compliance: tipo válido e WBS são obrigatórios para rastreabilidade de custo.
  const tipoCanon = normalizarTipoRC(tipo)
  if (!tipoCanon) return res.status(400).json(err('Tipo da RC obrigatório: Material, Serviço ou Equipamento'))
  if (!wbs || !String(wbs).trim()) return res.status(400).json(err('Vínculo WBS obrigatório na RC (rastreabilidade de custo)'))
  const rc = inserirRC(empresaDoReq(req), req.user, { os_id: os_id || null, os_numero, departamento, prioridade: prioridade || 'Normal', observacoes, tipo: tipoCanon, wbs }, itens)
  log(req.user.usuario_id, req.user.nome, 'Criar', 'rc', `RC criada: ${rc.numero}`)
  res.status(201).json(ok(rc))
})

app.put('/api/rc/:id', requireAuth, (req, res) => {
  const cur = rowScoped('requisicoes_compra', req)
  if (!cur) return res.status(404).json(err('RC não encontrada'))
  const { status, departamento, prioridade, observacoes } = req.body
  // tipo/WBS não podem ser removidos; se enviados, devem permanecer válidos.
  let tipo = cur.tipo, wbs = cur.wbs
  if (req.body.tipo !== undefined) {
    tipo = normalizarTipoRC(req.body.tipo)
    if (!tipo) return res.status(400).json(err('Tipo da RC inválido: use Material, Serviço ou Equipamento'))
  }
  if (req.body.wbs !== undefined) {
    if (!String(req.body.wbs).trim()) return res.status(400).json(err('WBS não pode ser removida da RC'))
    wbs = String(req.body.wbs).trim()
  }
  db.prepare(`UPDATE requisicoes_compra SET status=?,departamento=?,prioridade=?,observacoes=?,tipo=?,wbs=?,updated_at=datetime('now') WHERE id=?`)
    .run(status, departamento, prioridade, observacoes, tipo, wbs, req.params.id)
  res.json(ok(db.prepare(`SELECT * FROM requisicoes_compra WHERE id = ?`).get(req.params.id)))
})

// ════════════════════════════════════════════════════════════
// RFQ
// ════════════════════════════════════════════════════════════
function nextRFQ() {
  const year = new Date().getFullYear()
  const count = db.prepare(`SELECT COUNT(*) as n FROM rfq WHERE numero LIKE ?`).get(`RFQ-${year}-%`).n
  return `RFQ-${year}-${String(count + 1).padStart(3, '0')}`
}

app.get('/api/rfq', requireAuth, (req, res) => {
  const rows = db.prepare(`SELECT rfq.*, u.nome as comprador FROM rfq LEFT JOIN usuarios u ON u.id = rfq.comprador_id WHERE rfq.empresa_id = ? ORDER BY rfq.created_at DESC`).all(empresaDoReq(req))
  const result = rows.map(r => ({
    ...r,
    fornecedores: db.prepare(`SELECT rf.*, f.nome FROM rfq_fornecedores rf JOIN fornecedores f ON f.id = rf.fornecedor_id WHERE rf.rfq_id = ?`).all(r.id),
    total_cotacoes: db.prepare(`SELECT COUNT(*) as n FROM cotacoes WHERE rfq_id = ?`).get(r.id).n
  }))
  res.json(ok(result))
})

app.get('/api/rfq/:id', requireAuth, (req, res) => {
  const rfq = rowScoped('rfq', req)
  if (!rfq) return res.status(404).json(err('RFQ não encontrada'))
  const fornecedores = db.prepare(`SELECT rf.*, f.nome as fornecedor_nome FROM rfq_fornecedores rf JOIN fornecedores f ON f.id = rf.fornecedor_id WHERE rf.rfq_id = ?`).all(req.params.id)
  const cotacoes = db.prepare(`SELECT c.*, f.nome as fornecedor FROM cotacoes c JOIN fornecedores f ON f.id = c.fornecedor_id WHERE c.rfq_id = ? ORDER BY c.valor_total`).all(req.params.id)
  res.json(ok({ ...rfq, fornecedores, cotacoes }))
})

app.post('/api/rfq', requireAuth, (req, res) => {
  const { rc_id, rc_numero, titulo, descricao, prazo_resposta, fornecedor_ids = [], valor_estimado } = req.body
  if (!titulo) return res.status(400).json(err('Título obrigatório'))
  const numero = nextRFQ()
  const r = db.prepare(
    `INSERT INTO rfq(numero, rc_id, rc_numero, titulo, descricao, status, prazo_resposta, comprador_id, comprador_nome, valor_estimado, empresa_id)
     VALUES(?,?,?,?,?,?,?,?,?,?,?)`
  ).run(numero, rc_id || null, rc_numero, titulo, descricao, 'Aberta', prazo_resposta, req.user.usuario_id, req.user.nome, valor_estimado || 0, empresaDoReq(req))
  const rfqId = r.lastInsertRowid
  for (const fid of fornecedor_ids) {
    const f = db.prepare(`SELECT nome FROM fornecedores WHERE id = ?`).get(fid)
    db.prepare(`INSERT INTO rfq_fornecedores(rfq_id, fornecedor_id, fornecedor_nome) VALUES(?,?,?)`)
      .run(rfqId, fid, f?.nome || '')
  }
  const rfq = db.prepare(`SELECT * FROM rfq WHERE id = ?`).get(rfqId)
  log(req.user.usuario_id, req.user.nome, 'Criar', 'rfq', `RFQ criada: ${numero}`)
  res.status(201).json(ok(rfq))
})

app.post('/api/rfq/:id/cotacoes', requireAuth, (req, res) => {
  if (!rowScoped('rfq', req)) return res.status(404).json(err('RFQ não encontrada'))
  const { fornecedor_id, valor_total, prazo_entrega, condicao_pagamento, observacoes, itens = [] } = req.body
  const f = db.prepare(`SELECT nome FROM fornecedores WHERE id = ?`).get(fornecedor_id)
  const r = db.prepare(
    `INSERT INTO cotacoes(rfq_id, fornecedor_id, fornecedor_nome, status, valor_total, prazo_entrega, condicao_pagamento, observacoes)
     VALUES(?,?,?,?,?,?,?,?)`
  ).run(req.params.id, fornecedor_id, f?.nome, 'Recebida', valor_total || 0, prazo_entrega || 7, condicao_pagamento, observacoes)
  const cotId = r.lastInsertRowid
  for (const item of itens) {
    const vt = (item.quantidade || 1) * (item.valor_unitario || 0)
    db.prepare(`INSERT INTO cotacao_itens(cotacao_id, descricao, quantidade, unidade, valor_unitario, valor_total) VALUES(?,?,?,?,?,?)`)
      .run(cotId, item.descricao, item.quantidade || 1, item.unidade || 'UN', item.valor_unitario || 0, vt)
  }
  res.status(201).json(ok(db.prepare(`SELECT * FROM cotacoes WHERE id = ?`).get(cotId)))
})

// ════════════════════════════════════════════════════════════
// MAPAS COMPARATIVOS
// ════════════════════════════════════════════════════════════
function nextMapa() {
  const year = new Date().getFullYear()
  const count = db.prepare(`SELECT COUNT(*) as n FROM mapas_comparativos WHERE numero LIKE ?`).get(`MC-${year}-%`).n
  return `MC-${year}-${String(count + 1).padStart(3, '0')}`
}

app.get('/api/mapas', requireAuth, (req, res) => {
  const rows = db.prepare(
    `SELECT mc.*, rfq.titulo as rfq_titulo, f.nome as fornecedor_nome
     FROM mapas_comparativos mc
     LEFT JOIN rfq ON rfq.id = mc.rfq_id
     LEFT JOIN fornecedores f ON f.id = mc.fornecedor_vencedor_id
     WHERE mc.empresa_id = ?
     ORDER BY mc.created_at DESC`
  ).all(empresaDoReq(req))
  res.json(ok(rows))
})

// Concorrência mínima: compras acima do limiar exigem N cotações; exceção só
// com justificativa + Diretor (registrada na trilha). Pura (espelhada no Worker).
const CONCORRENCIA_VALOR_MIN = parseFloat(process.env.CONCORRENCIA_VALOR_MIN) || 10000
const CONCORRENCIA_MIN_COTACOES = parseInt(process.env.CONCORRENCIA_MIN_COTACOES) || 3
function avaliarConcorrencia({ valor = 0, numCotacoes = 0, justificativa = '', perfil = '' } = {}) {
  if ((Number(valor) || 0) <= CONCORRENCIA_VALOR_MIN) return { ok: true }
  if ((Number(numCotacoes) || 0) >= CONCORRENCIA_MIN_COTACOES) return { ok: true }
  const ehDiretor = perfil === 'diretor' || perfil === 'admin'
  if (String(justificativa || '').trim() && ehDiretor) return { ok: true, excecao: true }
  return { ok: false, motivo: `Compra acima de R$ ${CONCORRENCIA_VALOR_MIN} exige ${CONCORRENCIA_MIN_COTACOES} cotações (recebidas: ${Number(numCotacoes) || 0}). Exceção requer justificativa e aprovação de Diretor.` }
}

app.post('/api/mapas', requireAuth, (req, res) => {
  const { rfq_id, cotacao_vencedora_id, fornecedor_vencedor_id, valor_aprovado, economia_gerada, justificativa } = req.body
  if (!rfq_id || !cotacao_vencedora_id) return res.status(400).json(err('RFQ e cotação vencedora obrigatórios'))
  // Compliance: concorrência mínima para compras acima do limiar.
  const numCotacoes = db.prepare(`SELECT COUNT(*) as n FROM cotacoes WHERE rfq_id = ?`).get(rfq_id).n
  const conc = avaliarConcorrencia({ valor: valor_aprovado || 0, numCotacoes, justificativa, perfil: req.user.perfil })
  if (!conc.ok) {
    log(req.user.usuario_id, req.user.nome, 'concorrencia_bloqueada', 'mapas', conc.motivo)
    return res.status(409).json(err(conc.motivo, 409))
  }
  // O RFQ de origem precisa pertencer ao mesmo tenant.
  if (!rowScoped('rfq', req, rfq_id)) return res.status(404).json(err('RFQ não encontrada'))
  const rfq = db.prepare(`SELECT numero FROM rfq WHERE id = ?`).get(rfq_id)
  const f = db.prepare(`SELECT nome FROM fornecedores WHERE id = ?`).get(fornecedor_vencedor_id)
  const numero = nextMapa()
  const r = db.prepare(
    `INSERT INTO mapas_comparativos(numero, rfq_id, rfq_numero, cotacao_vencedora_id, fornecedor_vencedor_id, fornecedor_vencedor_nome, status, valor_aprovado, economia_gerada, justificativa, empresa_id)
     VALUES(?,?,?,?,?,?,?,?,?,?,?)`
  ).run(numero, rfq_id, rfq?.numero, cotacao_vencedora_id, fornecedor_vencedor_id, f?.nome, 'Em análise', valor_aprovado || 0, economia_gerada || 0, justificativa, empresaDoReq(req))
  db.prepare(`UPDATE cotacoes SET vencedor = 1 WHERE id = ?`).run(cotacao_vencedora_id)
  if (conc.excecao) log(req.user.usuario_id, req.user.nome, 'concorrencia_excecao', 'mapas', `Exceção de concorrência (${numCotacoes} cotação(ões)) aprovada por Diretor: ${justificativa}`)
  const mapa = db.prepare(`SELECT * FROM mapas_comparativos WHERE id = ?`).get(r.lastInsertRowid)
  log(req.user.usuario_id, req.user.nome, 'Criar', 'mapas', `Mapa criado: ${numero}`)
  res.status(201).json(ok(mapa))
})

app.post('/api/mapas/:id/aprovar', requireAuth, requireRole('admin', 'diretor', 'financeiro', 'compras'), (req, res) => {
  if (!rowScoped('mapas_comparativos', req)) return res.status(404).json(err('Mapa não encontrado'))
  const { comentario = '' } = req.body
  db.prepare(`UPDATE mapas_comparativos SET status='Aprovado', aprovado_em=datetime('now'), aprovado_por=? WHERE id=?`)
    .run(req.user.nome, req.params.id)
  const mapa = db.prepare(`SELECT * FROM mapas_comparativos WHERE id = ?`).get(req.params.id)
  log(req.user.usuario_id, req.user.nome, 'Aprovar', 'mapas', `Mapa aprovado`)
  res.json(ok(mapa))
})

app.post('/api/mapas/:id/reprovar', requireAuth, requireRole('admin', 'diretor', 'financeiro', 'compras'), (req, res) => {
  if (!rowScoped('mapas_comparativos', req)) return res.status(404).json(err('Mapa não encontrado'))
  db.prepare(`UPDATE mapas_comparativos SET status='Reprovado' WHERE id=?`).run(req.params.id)
  const mapa = db.prepare(`SELECT * FROM mapas_comparativos WHERE id = ?`).get(req.params.id)
  res.json(ok(mapa))
})

// ════════════════════════════════════════════════════════════
// PEDIDOS DE COMPRA
// ════════════════════════════════════════════════════════════
function nextPC() {
  const year = new Date().getFullYear()
  const count = db.prepare(`SELECT COUNT(*) as n FROM pedidos_compra WHERE numero LIKE ?`).get(`PC-${year}-%`).n
  return `PC-${year}-${String(count + 1).padStart(3, '0')}`
}

app.get('/api/pedidos', requireAuth, (req, res) => {
  const { status, fornecedor_id, q = '' } = req.query
  let sql = `SELECT pc.*, f.nome as fornecedor FROM pedidos_compra pc LEFT JOIN fornecedores f ON f.id = pc.fornecedor_id`
  const where = ['pc.empresa_id = ?']; const params = [empresaDoReq(req)]
  if (status) { where.push('pc.status = ?'); params.push(status) }
  if (fornecedor_id) { where.push('pc.fornecedor_id = ?'); params.push(fornecedor_id) }
  if (q) { where.push('(pc.numero LIKE ? OR f.nome LIKE ?)'); params.push(`%${q}%`, `%${q}%`) }
  sql += ' WHERE ' + where.join(' AND ')
  sql += ' ORDER BY pc.created_at DESC'
  const rows = db.prepare(sql).all(...params)
  const result = rows.map(r => ({
    ...r,
    itens: db.prepare(`SELECT * FROM pc_itens WHERE pc_id = ?`).all(r.id),
    historico: db.prepare(`SELECT * FROM pc_historico WHERE pc_id = ? ORDER BY created_at DESC LIMIT 5`).all(r.id)
  }))
  res.json(ok(result))
})

app.get('/api/pedidos/:id', requireAuth, (req, res) => {
  const pc = db.prepare(`SELECT pc.*, f.nome as fornecedor FROM pedidos_compra pc LEFT JOIN fornecedores f ON f.id = pc.fornecedor_id WHERE pc.id = ? AND pc.empresa_id = ?`).get(req.params.id, empresaDoReq(req))
  if (!pc) return res.status(404).json(err('PC não encontrado'))
  const itens = db.prepare(`SELECT * FROM pc_itens WHERE pc_id = ?`).all(req.params.id)
  const historico = db.prepare(`SELECT * FROM pc_historico WHERE pc_id = ? ORDER BY created_at DESC`).all(req.params.id)
  // Visibilidade: contas a pagar geradas a partir deste pedido (B1).
  const contas_pagar = db.prepare(`SELECT id, numero, valor, status, nota_fiscal, data_vencimento FROM contas_pagar WHERE pc_id = ?`).all(req.params.id)
  res.json(ok({ ...pc, itens, historico, contas_pagar }))
})

app.post('/api/pedidos', requireAuth, async (req, res) => {
  const { mapa_id, mapa_numero, rc_id, fornecedor_id, valor_total, prazo_entrega, condicao_pagamento, local_entrega, observacoes, itens = [] } = req.body
  if (!fornecedor_id) return res.status(400).json(err('Fornecedor obrigatório'))
  // Multi-tenant: o fornecedor precisa existir NO TENANT do usuário — sem
  // isso, um tenant emitia PC referenciando fornecedor (e homologação) de outro.
  const f = db.prepare(`SELECT * FROM fornecedores WHERE id = ? AND empresa_id = ?`).get(fornecedor_id, empresaDoReq(req))
  if (!f) return res.status(404).json(err('Fornecedor não encontrado'))
  // Compliance: fornecedor precisa estar HOMOLOGADO (Financeiro + Compliance).
  if (f && (process.env.ENFORCE_HOMOLOGACAO_PO ?? '1') !== '0' && !fornecedorHomologado(f)) {
    log(req.user.usuario_id, req.user.nome, 'po_bloqueada_homologacao', 'pedidos_compra', `Fornecedor ${f.nome} não homologado`)
    return res.status(409).json(err('Emissão bloqueada: fornecedor não homologado (pendente de aprovação Financeiro/Compliance)'))
  }
  // Compliance: valida a situação cadastral (Receita/SEFAZ) antes de emitir a PC.
  if (f && f.cnpj && (process.env.ENFORCE_RECEITA_PO ?? '1') !== '0') {
    try {
      const sit = await consultarReceita(f.cnpj, { provider: process.env.RECEITA_PROVIDER })
      if (!sit.regular) {
        log(req.user.usuario_id, req.user.nome, 'po_bloqueada_receita', 'pedidos_compra', `Fornecedor ${f.nome} com situação ${sit.situacao_cadastral}`)
        return res.status(409).json(err(`Emissão bloqueada: fornecedor com situação cadastral irregular na Receita (${sit.situacao_cadastral})`))
      }
    } catch (e) { /* CNPJ inválido/sem provedor não bloqueia a emissão aqui */ }
  }
  const emp = empresaDoReq(req)
  const numero = nextPC()
  const r = db.prepare(
    `INSERT INTO pedidos_compra(numero, mapa_id, mapa_numero, rc_id, fornecedor_id, fornecedor_nome, status, valor_total, prazo_entrega, condicao_pagamento, local_entrega, observacoes, comprador_id, comprador_nome, empresa_id)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(numero, mapa_id || null, mapa_numero, rc_id || null, fornecedor_id, f?.nome, 'Emitido', valor_total || 0, prazo_entrega, condicao_pagamento || '30 dias', local_entrega, observacoes, req.user.usuario_id, req.user.nome, emp)
  const pcId = r.lastInsertRowid
  for (const item of itens) {
    const vt = (item.quantidade || 1) * (item.valor_unitario || 0)
    db.prepare(`INSERT INTO pc_itens(pc_id, descricao, quantidade, unidade, valor_unitario, valor_total, codigo_produto) VALUES(?,?,?,?,?,?,?)`)
      .run(pcId, item.descricao, item.quantidade || 1, item.unidade || 'UN', item.valor_unitario || 0, vt, item.codigo_produto)
  }
  // Registra histórico
  db.prepare(`INSERT INTO pc_historico(pc_id, usuario_nome, acao, descricao, status_para) VALUES(?,?,?,?,?)`)
    .run(pcId, req.user.nome, 'Emissão', `Pedido emitido`, 'Emitido')
  // Gera conta a pagar automaticamente
  const cpNum = `CP-${new Date().getFullYear()}-${String(db.prepare(`SELECT COUNT(*) as n FROM contas_pagar`).get().n + 1).padStart(3, '0')}`
  db.prepare(`INSERT INTO contas_pagar(numero, pc_id, pc_numero, fornecedor_id, fornecedor_nome, descricao, valor, data_vencimento, status, empresa_id)
    VALUES(?,?,?,?,?,?,?,?,?,?)`)
    .run(cpNum, pcId, numero, fornecedor_id, f?.nome, `${numero} – ${f?.nome}`, valor_total || 0, prazo_entrega, 'Pendente', emp)

  log(req.user.usuario_id, req.user.nome, 'Criar', 'pedidos', `PC emitido: ${numero}`)

  // Inteligência proativa: roda o motor de anomalias no pedido recém-emitido.
  // Severidade ALTA → notifica Financeiro (com e-mail) e Compliance do tenant.
  try {
    const histRows = db.prepare(
      `SELECT id, fornecedor_id, valor_total, created_at FROM pedidos_compra
        WHERE empresa_id = ? AND status != 'Cancelado' ORDER BY created_at DESC LIMIT 500`
    ).all(emp)
    const hist = histRows.map(h => ({ id: h.id, fornecedor_id: h.fornecedor_id, valor: h.valor_total, data: h.created_at }))
    const rAn = detectarAnomalias({ id: pcId, fornecedor_id, valor: valor_total || 0, data: new Date().toISOString() }, hist, f || {})
    for (const a of rAn.alertas.filter(x => x.severidade === 'alta')) {
      const msg = `${numero} (${f?.nome || 'fornecedor ' + fornecedor_id}) — ${a.mensagem}. ${a.detalhe}`
      notificar({ perfil: 'financeiro', titulo: `Risco em compras: ${a.mensagem}`, mensagem: msg, tipo: 'anomalia', ref_tipo: 'pedido', ref_id: String(pcId), email: true, empresa: emp })
      notificar({ perfil: 'compliance', titulo: `Risco em compras: ${a.mensagem}`, mensagem: msg, tipo: 'anomalia', ref_tipo: 'pedido', ref_id: String(pcId), empresa: emp })
      log(req.user.usuario_id, req.user.nome, 'anomalia_detectada', 'pedidos', msg)
    }
  } catch (e) { if (!IS_TEST) console.warn(`anomalia pós-emissão falhou: ${e.message}`) }

  const pc = db.prepare(`SELECT * FROM pedidos_compra WHERE id = ?`).get(pcId)
  res.status(201).json(ok({ ...pc, itens: db.prepare(`SELECT * FROM pc_itens WHERE pc_id = ?`).all(pcId) }))
})

app.put('/api/pedidos/:id', requireAuth, (req, res) => {
  const { status, valor_total, prazo_entrega, condicao_pagamento, observacoes } = req.body
  const old = rowScoped('pedidos_compra', req)
  if (!old) return res.status(404).json(err('PC não encontrado'))
  db.prepare(`UPDATE pedidos_compra SET status=?,valor_total=?,prazo_entrega=?,condicao_pagamento=?,observacoes=?,updated_at=datetime('now') WHERE id=?`)
    .run(status || old.status, valor_total ?? old.valor_total, prazo_entrega || old.prazo_entrega, condicao_pagamento || old.condicao_pagamento, observacoes || old.observacoes, req.params.id)
  if (status && status !== old.status) {
    db.prepare(`INSERT INTO pc_historico(pc_id, usuario_nome, acao, descricao, status_de, status_para) VALUES(?,?,?,?,?,?)`)
      .run(req.params.id, req.user.nome, 'Atualização', `Status alterado`, old.status, status)
  }
  const pc = db.prepare(`SELECT * FROM pedidos_compra WHERE id = ?`).get(req.params.id)
  res.json(ok(pc))
})

app.post('/api/pedidos/:id/envio', requireAuth, (req, res) => {
  if (!rowScoped('pedidos_compra', req)) return res.status(404).json(err('PC não encontrado'))
  const { metodo = 'email', observacao = '' } = req.body
  db.prepare(`UPDATE pedidos_compra SET status='Enviado', enviado_em=datetime('now'), enviado_por=? WHERE id=?`)
    .run(req.user.nome, req.params.id)
  db.prepare(`INSERT INTO pc_historico(pc_id, usuario_nome, acao, descricao, status_de, status_para) VALUES(?,?,?,?,?,?)`)
    .run(req.params.id, req.user.nome, 'Envio', `Pedido enviado por ${metodo}. ${observacao}`, 'Emitido', 'Enviado')
  const pc = db.prepare(`SELECT * FROM pedidos_compra WHERE id = ?`).get(req.params.id)
  log(req.user.usuario_id, req.user.nome, 'Envio', 'pedidos', `PC enviado: ${pc.numero}`)
  res.json(ok(pc))
})

app.post('/api/pedidos/:id/entrega', requireAuth, (req, res) => {
  if (!rowScoped('pedidos_compra', req)) return res.status(404).json(err('PC não encontrado'))
  const { recebedor, observacao = '' } = req.body
  db.prepare(`UPDATE pedidos_compra SET status='Entregue', entregue_em=datetime('now'), recebedor=? WHERE id=?`)
    .run(recebedor || req.user.nome, req.params.id)
  db.prepare(`INSERT INTO pc_historico(pc_id, usuario_nome, acao, descricao, status_de, status_para) VALUES(?,?,?,?,?,?)`)
    .run(req.params.id, req.user.nome, 'Entrega', `Entrega confirmada por ${recebedor}. ${observacao}`, 'Enviado', 'Entregue')
  db.prepare(`UPDATE contas_pagar SET status='Pendente' WHERE pc_id=?`).run(req.params.id)
  const pc = db.prepare(`SELECT * FROM pedidos_compra WHERE id = ?`).get(req.params.id)
  log(req.user.usuario_id, req.user.nome, 'Entrega', 'pedidos', `PC entregue: ${pc.numero}`)
  res.json(ok(pc))
})

app.post('/api/pedidos/:id/cancelar', requireAuth, (req, res) => {
  if (!rowScoped('pedidos_compra', req)) return res.status(404).json(err('PC não encontrado'))
  const { motivo = 'Cancelado pelo usuário' } = req.body
  db.prepare(`UPDATE pedidos_compra SET status='Cancelado', cancelado_em=datetime('now'), motivo_cancelamento=? WHERE id=?`)
    .run(motivo, req.params.id)
  db.prepare(`INSERT INTO pc_historico(pc_id, usuario_nome, acao, descricao, status_de, status_para) VALUES(?,?,?,?,?,?)`)
    .run(req.params.id, req.user.nome, 'Cancelamento', `Motivo: ${motivo}`, 'Ativo', 'Cancelado')
  db.prepare(`UPDATE contas_pagar SET status='Cancelado' WHERE pc_id=?`).run(req.params.id)
  const pc = db.prepare(`SELECT * FROM pedidos_compra WHERE id = ?`).get(req.params.id)
  log(req.user.usuario_id, req.user.nome, 'Cancelar', 'pedidos', `PC cancelado: ${pc.numero}`)
  res.json(ok(pc))
})

// ════════════════════════════════════════════════════════════
// CONTAS A PAGAR
// ════════════════════════════════════════════════════════════
app.get('/api/contas-pagar', requireAuth, (req, res) => {
  const { status, q = '', pc_id } = req.query
  let sql = `SELECT cp.*, f.nome as fornecedor FROM contas_pagar cp LEFT JOIN fornecedores f ON f.id = cp.fornecedor_id`
  const where = ['cp.empresa_id = ?']; const params = [empresaDoReq(req)]
  if (status) { where.push('cp.status = ?'); params.push(status) }
  if (pc_id) { where.push('cp.pc_id = ?'); params.push(pc_id) }
  if (q) { where.push('(cp.numero LIKE ? OR cp.descricao LIKE ?)'); params.push(`%${q}%`, `%${q}%`) }
  sql += ' WHERE ' + where.join(' AND ')
  sql += ' ORDER BY cp.data_vencimento ASC'
  res.json(ok(db.prepare(sql).all(...params)))
})

app.put('/api/contas-pagar/:id', requireAuth, requireRole('admin', 'financeiro'), (req, res) => {
  if (!rowScoped('contas_pagar', req)) return res.status(404).json(err('Conta a pagar não encontrada'))
  const { status, data_pagamento, forma_pagamento, observacoes } = req.body
  db.prepare(`UPDATE contas_pagar SET status=?,data_pagamento=?,forma_pagamento=?,observacoes=?,updated_at=datetime('now') WHERE id=?`)
    .run(status, data_pagamento, forma_pagamento, observacoes, req.params.id)
  res.json(ok(db.prepare(`SELECT * FROM contas_pagar WHERE id = ?`).get(req.params.id)))
})

// ════════════════════════════════════════════════════════════
// CONTAS A RECEBER (dinheiro que entra) — espelha Contas a Pagar,
// isolado por tenant. Ciclo: A Faturar → (faturar) → A Receber →
// (receber) → Recebida.
// ════════════════════════════════════════════════════════════
function nextCR(emp) {
  const year = new Date().getFullYear()
  const n = db.prepare(`SELECT COUNT(*) as n FROM contas_receber WHERE empresa_id = ? AND numero LIKE ?`).get(emp, `CR-${year}-%`).n
  return `CR-${year}-${String(n + 1).padStart(3, '0')}`
}

app.get('/api/contas-receber', requireAuth, (req, res) => {
  const { status, q = '', contrato_id } = req.query
  const where = ['empresa_id = ?']; const params = [empresaDoReq(req)]
  if (status) { where.push('status = ?'); params.push(status) }
  if (contrato_id) { where.push('contrato_id = ?'); params.push(contrato_id) }
  if (q) { where.push('(numero LIKE ? OR cliente LIKE ? OR descricao LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`) }
  const sql = `SELECT * FROM contas_receber WHERE ${where.join(' AND ')} ORDER BY data_vencimento ASC`
  res.json(ok(db.prepare(sql).all(...params)))
})

app.post('/api/contas-receber', requireAuth, requireRole('admin', 'financeiro', 'diretor'), (req, res) => {
  const b = req.body || {}
  const emp = empresaDoReq(req)
  if (!(Number(b.valor) > 0)) return res.status(400).json(err('Valor deve ser maior que zero'))
  const numero = b.numero || nextCR(emp)
  const r = db.prepare(`INSERT INTO contas_receber(numero, contrato_id, medicao_id, proposta_id, cliente, descricao, valor, data_emissao, data_vencimento, status, observacoes, empresa_id)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(numero, b.contrato_id || null, b.medicao_id || null, b.proposta_id || null, b.cliente || '', b.descricao || '', Number(b.valor),
      b.data_emissao || new Date().toISOString().slice(0, 10), b.data_vencimento || null, b.status || 'A Receber', b.observacoes || null, emp)
  log(req.user.usuario_id, req.user.nome, 'Criar', 'contas_receber', `Conta a receber ${numero} (R$ ${Number(b.valor).toFixed(2)}) — ${b.cliente || ''}`)
  res.status(201).json(ok(db.prepare(`SELECT * FROM contas_receber WHERE id = ?`).get(r.lastInsertRowid)))
})

app.put('/api/contas-receber/:id', requireAuth, requireRole('admin', 'financeiro', 'diretor'), (req, res) => {
  const cur = rowScoped('contas_receber', req)
  if (!cur) return res.status(404).json(err('Conta a receber não encontrada'))
  const b = req.body || {}
  db.prepare(`UPDATE contas_receber SET cliente=?,descricao=?,valor=?,data_vencimento=?,status=?,nota_fiscal=?,observacoes=?,updated_at=datetime('now') WHERE id=?`)
    .run(b.cliente ?? cur.cliente, b.descricao ?? cur.descricao, b.valor != null ? Number(b.valor) : cur.valor,
      b.data_vencimento ?? cur.data_vencimento, b.status ?? cur.status, b.nota_fiscal ?? cur.nota_fiscal, b.observacoes ?? cur.observacoes, req.params.id)
  res.json(ok(db.prepare(`SELECT * FROM contas_receber WHERE id = ?`).get(req.params.id)))
})

// Faturar: vincula a nota fiscal e coloca em cobrança.
app.post('/api/contas-receber/:id/faturar', requireAuth, requireRole('admin', 'financeiro'), (req, res) => {
  const cur = rowScoped('contas_receber', req)
  if (!cur) return res.status(404).json(err('Conta a receber não encontrada'))
  if (cur.status === 'Recebida') return res.status(409).json(err('Conta já recebida'))
  const nf = (req.body && req.body.nota_fiscal) || null
  db.prepare(`UPDATE contas_receber SET status='A Receber', nota_fiscal=?, updated_at=datetime('now') WHERE id=?`).run(nf, req.params.id)
  log(req.user.usuario_id, req.user.nome, 'cr_faturar', 'contas_receber', `Conta ${cur.numero} faturada (NF ${nf || '—'})`)
  res.json(ok(db.prepare(`SELECT * FROM contas_receber WHERE id = ?`).get(req.params.id)))
})

// Receber: baixa o título (o evento "dinheiro entrou").
app.post('/api/contas-receber/:id/receber', requireAuth, requireRole('admin', 'financeiro'), (req, res) => {
  const cur = rowScoped('contas_receber', req)
  if (!cur) return res.status(404).json(err('Conta a receber não encontrada'))
  if (cur.status === 'Recebida' || cur.data_recebimento) return res.status(409).json(err('Conta já recebida (duplicidade)'))
  const b = req.body || {}
  db.prepare(`UPDATE contas_receber SET status='Recebida', data_recebimento=?, forma_recebimento=?, updated_at=datetime('now') WHERE id=?`)
    .run(b.data_recebimento || new Date().toISOString().slice(0, 10), b.forma_recebimento || null, req.params.id)
  log(req.user.usuario_id, req.user.nome, 'cr_receber', 'contas_receber', `Recebimento de ${cur.numero} (R$ ${Number(cur.valor).toFixed(2)}) — ${cur.cliente || ''}`)
  res.json(ok(db.prepare(`SELECT * FROM contas_receber WHERE id = ?`).get(req.params.id)))
})

// ELO 1 — gera a conta a receber a partir de uma MEDIÇÃO aprovada.
// Idempotente por (empresa, medicao_id): rechamar não duplica o título.
app.post('/api/contas-receber/de-medicao', requireAuth, requireRole('admin', 'financeiro', 'diretor'), (req, res) => {
  const b = req.body || {}
  const emp = empresaDoReq(req)
  const medId = b.medicao_id
  if (medId == null) return res.status(400).json(err('medicao_id obrigatório'))
  if (!(Number(b.valor) > 0)) return res.status(400).json(err('Valor da medição deve ser maior que zero'))
  const existente = db.prepare(`SELECT * FROM contas_receber WHERE empresa_id = ? AND medicao_id = ?`).get(emp, medId)
  if (existente) return res.json(ok({ ...existente, ja_existia: true }))
  const numero = nextCR(emp)
  const r = db.prepare(`INSERT INTO contas_receber(numero, contrato_id, medicao_id, cliente, descricao, valor, data_emissao, data_vencimento, status, empresa_id)
     VALUES(?,?,?,?,?,?,?,?,?,?)`)
    .run(numero, b.contrato_id || null, medId, b.cliente || '', b.descricao || `Medição ${medId}`, Number(b.valor),
      new Date().toISOString().slice(0, 10), b.data_vencimento || null, 'A Faturar', emp)
  log(req.user.usuario_id, req.user.nome, 'cr_de_medicao', 'contas_receber', `Conta ${numero} gerada da medição ${medId} (R$ ${Number(b.valor).toFixed(2)})`)
  res.status(201).json(ok(db.prepare(`SELECT * FROM contas_receber WHERE id = ?`).get(r.lastInsertRowid)))
})

// ELO 2 — emite a NFS-e a partir da conta a receber (liga faturamento ao
// fiscal). Emitente = CNPJ da empresa (tenant); tomador = cliente da conta.
app.post('/api/contas-receber/:id/emitir-nfse', requireAuth, requireRole('admin', 'financeiro', 'fiscal'), async (req, res) => {
  const emp = empresaDoReq(req)
  const cur = rowScoped('contas_receber', req)
  if (!cur) return res.status(404).json(err('Conta a receber não encontrada'))
  if (cur.nota_fiscal) return res.status(409).json(err('Conta já faturada (NF ' + cur.nota_fiscal + ')'))
  const b = req.body || {}
  const empresa = db.prepare(`SELECT cnpj FROM empresas WHERE id = ?`).get(emp)
  const cnpjEmit = b.cnpj_emitente || (empresa && empresa.cnpj) || ''
  const cnpjDest = b.cnpj_destinatario || cur.cnpj_destinatario || ''
  const numero = db.prepare(`SELECT COUNT(*) n FROM notas_fiscais WHERE serie = 1 AND empresa_id = ?`).get(emp).n + 1
  try {
    const r = await emitirNotaFiscal({
      tipo: 'nfse', cnpj_emitente: cnpjEmit, cnpj_destinatario: cnpjDest, cpf_destinatario: b.cpf_destinatario,
      nome_destinatario: cur.cliente, descricao: cur.descricao || `Fatura ${cur.numero}`, valor: Number(cur.valor),
      numero, serie: 1,
    }, _nfeOpts())
    if (r.status !== 'autorizada' && r.status !== 'processando') {
      return res.status(422).json(err('Emissão de NFS-e rejeitada: ' + (r.motivo || 'dados inválidos')))
    }
    const ins = db.prepare(`INSERT INTO notas_fiscais(tipo, numero, serie, chave, protocolo, status, valor, cnpj_emitente, destinatario, descricao, danfe_url, xml_url, emitido_por, fonte, provider_id, empresa_id)
       VALUES('nfse',?,1,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(r.numero || numero, r.chave || null, r.protocolo || null, r.status, Number(cur.valor), cnpjEmit, cnpjDest || cur.cliente, cur.descricao || '', r.danfe_url || null, r.xml_url || null, req.user.nome, r.fonte || null, r.id || null, emp)
    const nfNumero = r.numero || String(numero)
    // Vincula a NF à conta e coloca em cobrança.
    db.prepare(`UPDATE contas_receber SET status='A Receber', nota_fiscal=?, updated_at=datetime('now') WHERE id=?`).run(String(nfNumero), cur.id)
    log(req.user.usuario_id, req.user.nome, 'cr_emitir_nfse', 'contas_receber', `NFS-e ${nfNumero} (${r.status}) para ${cur.cliente} — conta ${cur.numero}`)
    res.status(201).json(ok({
      conta: db.prepare(`SELECT * FROM contas_receber WHERE id = ?`).get(cur.id),
      nota: db.prepare(`SELECT * FROM notas_fiscais WHERE id = ?`).get(ins.lastInsertRowid),
    }))
  } catch (e) {
    res.status(400).json(err(e.message))
  }
})

// ════════════════════════════════════════════════════════════
// CONCILIAÇÃO BANCÁRIA — importa extrato (CSV/OFX), sugere o casamento
// com contas a pagar/receber e baixa o título ao conciliar.
// ════════════════════════════════════════════════════════════

// Importa um extrato: parseia o conteúdo e grava os lançamentos (pendentes).
app.post('/api/conciliacao/importar', requireAuth, requireRole('admin', 'financeiro', 'diretor'), (req, res) => {
  const b = req.body || {}
  const emp = empresaDoReq(req)
  let lancs
  try { lancs = parseExtrato(b.formato, b.conteudo) } catch (e) { return res.status(400).json(err('Falha ao ler o extrato: ' + e.message)) }
  if (!Array.isArray(lancs) || !lancs.length) return res.status(400).json(err('Nenhum lançamento reconhecido no arquivo (verifique o formato CSV/OFX)'))
  const datas = lancs.map(l => l.data).filter(Boolean).sort()
  const info = db.prepare(`INSERT INTO extratos_bancarios(banco, conta, arquivo_nome, formato, periodo_inicio, periodo_fim, qtd_lancamentos, empresa_id)
     VALUES(?,?,?,?,?,?,?,?)`)
    .run(b.banco || '', b.conta || '', b.arquivo_nome || '', String(b.formato || 'auto'), datas[0] || null, datas[datas.length - 1] || null, lancs.length, emp)
  const extId = info.lastInsertRowid
  const ins = db.prepare(`INSERT INTO extrato_lancamentos(extrato_id, data, descricao, documento, valor, tipo, empresa_id) VALUES(?,?,?,?,?,?,?)`)
  const tx = db.transaction(() => { for (const l of lancs) ins.run(extId, l.data, l.descricao, l.documento, l.valor, l.tipo, emp) })
  tx()
  log(req.user.usuario_id, req.user.nome, 'conc_importar', 'conciliacao', `Extrato ${b.banco || ''} importado: ${lancs.length} lançamento(s)`)
  res.status(201).json(ok({ extrato_id: extId, importados: lancs.length, periodo: { inicio: datas[0] || null, fim: datas[datas.length - 1] || null } }))
})

// Lista lançamentos do tenant (filtra por status/extrato).
app.get('/api/conciliacao/lancamentos', requireAuth, (req, res) => {
  const { status, extrato_id } = req.query
  const where = ['empresa_id = ?']; const params = [empresaDoReq(req)]
  if (status) { where.push('status = ?'); params.push(status) }
  if (extrato_id) { where.push('extrato_id = ?'); params.push(extrato_id) }
  const rows = db.prepare(`SELECT * FROM extrato_lancamentos WHERE ${where.join(' AND ')} ORDER BY data ASC, id ASC`).all(...params)
  res.json(ok(rows))
})

// Sugere o casamento de cada lançamento pendente com AP (débito) / AR (crédito).
// Débito → conta a pagar em aberto; crédito → conta a receber em cobrança.
app.get('/api/conciliacao/sugestoes', requireAuth, (req, res) => {
  const emp = empresaDoReq(req)
  const janela = parseInt(req.query.janela) || 5
  const lancs = db.prepare(`SELECT * FROM extrato_lancamentos WHERE empresa_id = ? AND status = 'pendente' ORDER BY data ASC`).all(emp)
  const pagar = db.prepare(`SELECT id, valor, data_vencimento AS data, numero, descricao, fornecedor_nome FROM contas_pagar WHERE empresa_id = ? AND status NOT IN ('Pago','Cancelado')`).all(emp)
  const receber = db.prepare(`SELECT id, valor, data_vencimento AS data, numero, descricao, cliente FROM contas_receber WHERE empresa_id = ? AND status IN ('A Receber','A Faturar')`).all(emp)
  const out = lancs.map(l => {
    const tipoConta = l.tipo === 'debito' ? 'contas_pagar' : 'contas_receber'
    const candidatos = l.tipo === 'debito' ? pagar : receber
    const m = sugerirMatch(l, candidatos, { janelaDias: janela })
    let sugestao = null
    if (m) {
      const c = candidatos.find(x => x.id === m.ref_id)
      sugestao = { tipo: tipoConta, ref_id: m.ref_id, score: m.score, dias: m.dias, numero: c && c.numero, descricao: c && c.descricao, parte: c && (c.fornecedor_nome || c.cliente) }
    }
    return { lancamento: l, sugestao }
  })
  res.json(ok(out))
})

// Concilia um lançamento com uma conta: baixa o título (Pago/Recebida) e
// marca o lançamento como conciliado. Idempotente (409 se já conciliado).
app.post('/api/conciliacao/:id/conciliar', requireAuth, requireRole('admin', 'financeiro'), (req, res) => {
  const emp = empresaDoReq(req)
  const lanc = rowScoped('extrato_lancamentos', req)
  if (!lanc) return res.status(404).json(err('Lançamento não encontrado'))
  if (lanc.status === 'conciliado') return res.status(409).json(err('Lançamento já conciliado'))
  const b = req.body || {}
  const tipo = b.tipo || (lanc.tipo === 'debito' ? 'contas_pagar' : 'contas_receber')
  const refId = b.ref_id
  if (tipo !== 'contas_pagar' && tipo !== 'contas_receber') return res.status(400).json(err('tipo inválido (contas_pagar|contas_receber)'))
  if (refId == null) return res.status(400).json(err('ref_id obrigatório'))
  const conta = db.prepare(`SELECT * FROM ${tipo} WHERE id = ? AND empresa_id = ?`).get(refId, emp)
  if (!conta) return res.status(404).json(err('Conta a conciliar não encontrada'))
  const hoje = new Date().toISOString().slice(0, 10)
  if (tipo === 'contas_pagar') {
    if (conta.status !== 'Pago') db.prepare(`UPDATE contas_pagar SET status='Pago', data_pagamento=?, forma_pagamento=COALESCE(forma_pagamento,'Conciliação bancária'), updated_at=datetime('now') WHERE id=?`).run(lanc.data || hoje, refId)
  } else {
    if (conta.status !== 'Recebida') db.prepare(`UPDATE contas_receber SET status='Recebida', data_recebimento=?, forma_recebimento=COALESCE(forma_recebimento,'Conciliação bancária'), updated_at=datetime('now') WHERE id=?`).run(lanc.data || hoje, refId)
  }
  db.prepare(`UPDATE extrato_lancamentos SET status='conciliado', conciliado_tipo=?, conciliado_id=?, conciliado_em=datetime('now'), conciliado_por=? WHERE id=?`)
    .run(tipo, refId, req.user.nome, lanc.id)
  log(req.user.usuario_id, req.user.nome, 'conc_conciliar', 'conciliacao', `Lançamento ${lanc.data} R$ ${Number(lanc.valor).toFixed(2)} conciliado com ${tipo} #${refId} (${conta.numero || ''})`)
  res.json(ok({
    lancamento: db.prepare(`SELECT * FROM extrato_lancamentos WHERE id = ?`).get(lanc.id),
    conta: db.prepare(`SELECT * FROM ${tipo} WHERE id = ?`).get(refId),
  }))
})

// Ignora um lançamento (tarifa, transferência interna etc. — não vira baixa).
app.post('/api/conciliacao/:id/ignorar', requireAuth, requireRole('admin', 'financeiro'), (req, res) => {
  const lanc = rowScoped('extrato_lancamentos', req)
  if (!lanc) return res.status(404).json(err('Lançamento não encontrado'))
  if (lanc.status === 'conciliado') return res.status(409).json(err('Lançamento já conciliado — não pode ser ignorado'))
  db.prepare(`UPDATE extrato_lancamentos SET status='ignorado' WHERE id=?`).run(lanc.id)
  log(req.user.usuario_id, req.user.nome, 'conc_ignorar', 'conciliacao', `Lançamento ${lanc.data} R$ ${Number(lanc.valor).toFixed(2)} ignorado`)
  res.json(ok(db.prepare(`SELECT * FROM extrato_lancamentos WHERE id = ?`).get(lanc.id)))
})

// Resumo da conciliação (para o dashboard/cabeçalho da tela).
app.get('/api/conciliacao/resumo', requireAuth, (req, res) => {
  const emp = empresaDoReq(req)
  const one = (sql) => db.prepare(sql).get(emp) || {}
  const pend = one(`SELECT COUNT(*) qtd, COALESCE(SUM(valor),0) val FROM extrato_lancamentos WHERE empresa_id = ? AND status='pendente'`)
  const conc = one(`SELECT COUNT(*) qtd, COALESCE(SUM(valor),0) val FROM extrato_lancamentos WHERE empresa_id = ? AND status='conciliado'`)
  const ign = one(`SELECT COUNT(*) qtd FROM extrato_lancamentos WHERE empresa_id = ? AND status='ignorado'`)
  res.json(ok({
    pendentes: pend.qtd || 0, valor_pendente: pend.val || 0,
    conciliados: conc.qtd || 0, valor_conciliado: conc.val || 0,
    ignorados: ign.qtd || 0,
  }))
})

// ════════════════════════════════════════════════════════════
// RH — colaboradores (custo/hora) e apontamento de horas em contratos.
// A mão de obra apontada compõe o custo dos serviços na DRE real.
// ════════════════════════════════════════════════════════════

app.get('/api/colaboradores', requireAuth, (req, res) => {
  const { status, q = '' } = req.query
  const where = ['empresa_id = ?']; const params = [empresaDoReq(req)]
  if (status) { where.push('status = ?'); params.push(status) }
  if (q) { where.push('(nome LIKE ? OR cargo LIKE ? OR departamento LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`) }
  res.json(ok(db.prepare(`SELECT * FROM colaboradores WHERE ${where.join(' AND ')} ORDER BY nome ASC`).all(...params)))
})

app.get('/api/colaboradores/:id', requireAuth, (req, res) => {
  const c = rowScoped('colaboradores', req)
  if (!c) return res.status(404).json(err('Colaborador não encontrado'))
  res.json(ok(c))
})

app.post('/api/colaboradores', requireAuth, requireRole('admin', 'diretor', 'rh'), (req, res) => {
  const b = req.body || {}
  if (!String(b.nome || '').trim()) return res.status(400).json(err('Nome obrigatório'))
  if (b.custo_hora != null && !(Number(b.custo_hora) >= 0)) return res.status(400).json(err('Custo/hora inválido'))
  const r = db.prepare(`INSERT INTO colaboradores(nome, cpf, cargo, departamento, custo_hora, email, telefone, data_admissao, status, empresa_id)
     VALUES(?,?,?,?,?,?,?,?,?,?)`)
    .run(String(b.nome).trim(), b.cpf || null, b.cargo || null, b.departamento || null, Number(b.custo_hora) || 0,
      b.email || null, b.telefone || null, b.data_admissao || null, b.status || 'Ativo', empresaDoReq(req))
  log(req.user.usuario_id, req.user.nome, 'Criar', 'colaboradores', `Colaborador ${b.nome} (${b.cargo || '—'}, R$ ${Number(b.custo_hora) || 0}/h)`)
  res.status(201).json(ok(db.prepare(`SELECT * FROM colaboradores WHERE id = ?`).get(r.lastInsertRowid)))
})

app.put('/api/colaboradores/:id', requireAuth, requireRole('admin', 'diretor', 'rh'), (req, res) => {
  const cur = rowScoped('colaboradores', req)
  if (!cur) return res.status(404).json(err('Colaborador não encontrado'))
  const b = req.body || {}
  if (b.custo_hora != null && !(Number(b.custo_hora) >= 0)) return res.status(400).json(err('Custo/hora inválido'))
  db.prepare(`UPDATE colaboradores SET nome=?,cpf=?,cargo=?,departamento=?,custo_hora=?,email=?,telefone=?,data_admissao=?,status=?,updated_at=datetime('now') WHERE id=?`)
    .run(b.nome ?? cur.nome, b.cpf ?? cur.cpf, b.cargo ?? cur.cargo, b.departamento ?? cur.departamento,
      b.custo_hora != null ? Number(b.custo_hora) : cur.custo_hora, b.email ?? cur.email, b.telefone ?? cur.telefone,
      b.data_admissao ?? cur.data_admissao, b.status ?? cur.status, req.params.id)
  res.json(ok(db.prepare(`SELECT * FROM colaboradores WHERE id = ?`).get(req.params.id)))
})

// Apontar horas: gera custo (horas × custo/hora vigente, com snapshot).
app.post('/api/apontamentos-hora', requireAuth, requireRole('admin', 'diretor', 'rh', 'financeiro'), (req, res) => {
  const b = req.body || {}
  const emp = empresaDoReq(req)
  const colab = db.prepare(`SELECT * FROM colaboradores WHERE id = ? AND empresa_id = ?`).get(b.colaborador_id, emp)
  if (!colab) return res.status(404).json(err('Colaborador não encontrado'))
  const horas = Number(b.horas)
  if (!(horas > 0)) return res.status(400).json(err('Horas devem ser maiores que zero'))
  const custoHora = b.custo_hora != null ? Number(b.custo_hora) : Number(colab.custo_hora) || 0
  const custo = Math.round(horas * custoHora * 100) / 100
  const r = db.prepare(`INSERT INTO apontamentos_hora(colaborador_id, contrato_id, data, horas, custo_hora, custo, descricao, empresa_id)
     VALUES(?,?,?,?,?,?,?,?)`)
    .run(colab.id, b.contrato_id || null, b.data || new Date().toISOString().slice(0, 10), horas, custoHora, custo, b.descricao || null, emp)
  log(req.user.usuario_id, req.user.nome, 'apontar_horas', 'apontamentos_hora', `${horas}h de ${colab.nome} (R$ ${custo.toFixed(2)}) — contrato ${b.contrato_id || '—'}`)
  res.status(201).json(ok(db.prepare(`SELECT * FROM apontamentos_hora WHERE id = ?`).get(r.lastInsertRowid)))
})

app.get('/api/apontamentos-hora', requireAuth, (req, res) => {
  const { colaborador_id, contrato_id } = req.query
  const where = ['a.empresa_id = ?']; const params = [empresaDoReq(req)]
  if (colaborador_id) { where.push('a.colaborador_id = ?'); params.push(colaborador_id) }
  if (contrato_id) { where.push('a.contrato_id = ?'); params.push(contrato_id) }
  const rows = db.prepare(`SELECT a.*, c.nome AS colaborador_nome, c.cargo AS colaborador_cargo
     FROM apontamentos_hora a LEFT JOIN colaboradores c ON c.id = a.colaborador_id
     WHERE ${where.join(' AND ')} ORDER BY a.data DESC, a.id DESC`).all(...params)
  res.json(ok(rows))
})

// Rollup de custo de mão de obra por contrato (para a margem do contrato).
app.get('/api/contratos/:id/custo-mao-de-obra', requireAuth, (req, res) => {
  const emp = empresaDoReq(req)
  const tot = db.prepare(`SELECT COALESCE(SUM(custo),0) custo, COALESCE(SUM(horas),0) horas, COUNT(*) qtd
     FROM apontamentos_hora WHERE empresa_id = ? AND contrato_id = ?`).get(emp, req.params.id) || {}
  const porColab = db.prepare(`SELECT c.nome, c.cargo, COALESCE(SUM(a.horas),0) horas, COALESCE(SUM(a.custo),0) custo
     FROM apontamentos_hora a LEFT JOIN colaboradores c ON c.id = a.colaborador_id
     WHERE a.empresa_id = ? AND a.contrato_id = ? GROUP BY a.colaborador_id ORDER BY custo DESC`).all(emp, req.params.id)
  res.json(ok({ contrato_id: req.params.id, custo_total: tot.custo || 0, horas_total: tot.horas || 0, apontamentos: tot.qtd || 0, por_colaborador: porColab }))
})

// Margem do contrato (P&L): Receita (AR faturada do contrato) − Custo de
// pedidos (AP do contrato) − Custo de mão de obra (apontamentos). Casa o
// contrato tanto pelo id numérico quanto pelo número (CT-AAAA-NNN), porque os
// livros podem referenciar qualquer um dos dois. Helper reutilizado pelo
// dashboard financeiro para rankear contratos.
function _margemDoContrato(emp, ct) {
  const chaves = [String(ct.id), ct.numero].filter(Boolean)
  const inClause = chaves.map(() => '?').join(',')
  const one = (sql) => db.prepare(sql).get(emp, ...chaves) || {}
  const receita = one(`SELECT COALESCE(SUM(valor),0) v FROM contas_receber WHERE empresa_id = ? AND contrato_id IN (${inClause}) AND status IN ('A Receber','Recebida')`).v || 0
  const custoPedidos = one(`SELECT COALESCE(SUM(valor),0) v FROM contas_pagar WHERE empresa_id = ? AND contrato_id IN (${inClause})`).v || 0
  const mo = one(`SELECT COALESCE(SUM(custo),0) v, COALESCE(SUM(horas),0) h FROM apontamentos_hora WHERE empresa_id = ? AND contrato_id IN (${inClause})`)
  const custoMaoObra = mo.v || 0, horas = mo.h || 0
  const round = n => Math.round(n * 100) / 100
  const custoTotal = round(custoPedidos + custoMaoObra)
  const resultado = round(receita - custoTotal)
  const margemPct = receita > 0 ? round((resultado / receita) * 100) : 0
  return {
    contrato_id: ct.id, numero: ct.numero, titulo: ct.titulo, valor_contratado: ct.valor_total || 0,
    receita, custo_pedidos: custoPedidos, custo_mao_obra: custoMaoObra, horas_mao_obra: round(horas),
    custo_total: custoTotal, resultado, margem_pct: margemPct,
    linhas: [
      { label: 'Receita faturada (contas a receber)', valor: receita, tipo: 'receita' },
      { label: '(-) Custo de pedidos/compras', valor: -custoPedidos, tipo: 'custo' },
      { label: '(-) Custo de mão de obra', valor: -custoMaoObra, tipo: 'custo' },
      { label: '= Resultado do contrato', valor: resultado, tipo: 'total' },
    ],
  }
}

app.get('/api/contratos/:id/margem', requireAuth, (req, res) => {
  const ct = rowScoped('contratos', req)
  if (!ct) return res.status(404).json(err('Contrato não encontrado'))
  res.json(ok(_margemDoContrato(empresaDoReq(req), ct)))
})

// ── Recebimento por item ──────────────────────────────────────
app.get('/api/recebimentos', requireAuth, (req, res) => {
  const { pc_id } = req.query
  let sql = `SELECT * FROM recebimentos`
  const params = []
  if (pc_id) { sql += ` WHERE pc_id = ?`; params.push(pc_id) }
  sql += ` ORDER BY created_at DESC LIMIT 200`
  const recs = db.prepare(sql).all(...params).map(r => ({
    ...r, itens: db.prepare(`SELECT * FROM recebimento_itens WHERE recebimento_id = ?`).all(r.id)
  }))
  res.json(ok(recs))
})

app.post('/api/recebimentos', requireAuth, (req, res) => {
  const b = req.body || {}
  const pcId = b.pc_id ?? b.pedido_id ?? null   // o front envia "pedido_id"
  const r = db.prepare(
    `INSERT INTO recebimentos(pc_id, nf_numero, valor_nf, status, conferente, observacoes)
     VALUES(?,?,?,?,?,?)`
  ).run(pcId, b.nf_numero ?? null, b.valor_nf ?? 0, b.status ?? 'Conforme',
        b.conferente ?? req.user.nome, b.observacoes ?? null)
  const recId = r.lastInsertRowid
  const itens = Array.isArray(b.itens) ? b.itens : []
  const ins = db.prepare(`INSERT INTO recebimento_itens(recebimento_id, pc_id, codigo_produto, descricao, quantidade_recebida) VALUES(?,?,?,?,?)`)
  for (const it of itens) {
    ins.run(recId, pcId, it.codigo_produto ?? it.codigo ?? null, it.descricao ?? it.desc ?? null,
            Number(it.quantidade_recebida ?? it.qtd_recebida ?? it.qtd ?? 0) || 0)
  }
  // Liga o recebimento à(s) conta(s) a pagar do pedido: anexa a NF (que nasceu
  // na emissão do PC) para o gate enxergar a nota e a conta ficar localizável.
  let contas = []
  if (pcId && b.nf_numero) {
    db.prepare(`UPDATE contas_pagar SET nota_fiscal = ?, updated_at = datetime('now')
       WHERE pc_id = ? AND (nota_fiscal IS NULL OR nota_fiscal = '' OR nota_fiscal = '—')`).run(b.nf_numero, pcId)
  }
  if (pcId) contas = db.prepare(`SELECT id, numero, valor, status, nota_fiscal, data_vencimento FROM contas_pagar WHERE pc_id = ?`).all(pcId)
  log(req.user.usuario_id, req.user.nome, 'Receber', 'recebimentos', `Recebimento NF ${b.nf_numero || '—'} (${itens.length} item(ns))`)
  const rec = db.prepare(`SELECT * FROM recebimentos WHERE id = ?`).get(recId)
  res.status(201).json(ok({ ...rec, itens: db.prepare(`SELECT * FROM recebimento_itens WHERE recebimento_id = ?`).all(recId), contas_pagar: contas }))
})

// GATE DE PAGAMENTO: "nada paga sem lastro" + 3-way por item. Segregação: só
// financeiro/admin. Bloqueios respondem 409 e ficam na trilha de auditoria.
// Alçada de pagamento: acima do limiar exige aprovação de Diretor (segregação
// do pagador). Pura (espelhada no Worker).
const ALCADA_PAGAMENTO_VALOR = parseFloat(process.env.ALCADA_PAGAMENTO_VALOR) || 50000
function alcadaPendente({ valor = 0, aprovadaPor = null, limite = ALCADA_PAGAMENTO_VALOR } = {}) {
  return (Number(valor) || 0) > limite && !String(aprovadaPor || '').trim()
}

// Aprovação de alçada por Diretor — distinta do pagamento (segregação de funções).
app.post('/api/contas-pagar/:id/aprovar-alcada', requireAuth, requireRole('admin', 'diretor'), (req, res) => {
  const conta = rowScoped('contas_pagar', req)
  if (!conta) return res.status(404).json(err('Conta não encontrada'))
  db.prepare(`UPDATE contas_pagar SET alcada_aprovada_por=?, alcada_aprovada_em=datetime('now') WHERE id=?`)
    .run(req.user.nome, req.params.id)
  log(req.user.usuario_id, req.user.nome, 'alcada_aprovada', 'contas_pagar', `Alçada aprovada: ${conta.descricao} (R$ ${conta.valor})`)
  res.json(ok(db.prepare(`SELECT * FROM contas_pagar WHERE id = ?`).get(req.params.id)))
})

app.post('/api/contas-pagar/:id/pagar', requireAuth, requireRole('admin', 'financeiro'), (req, res) => {
  const conta = rowScoped('contas_pagar', req)
  if (!conta) return res.status(404).json(err('Conta não encontrada'))

  const motivos = []
  if (conta.data_pagamento || conta.status === 'Pago') motivos.push('conta já paga (duplicidade)')
  if (!['Aprovado', 'Aprovada', 'Liberado'].includes(conta.status)) motivos.push('não aprovada no fluxo')
  if (!conta.nota_fiscal || conta.nota_fiscal === '—') motivos.push('sem nota fiscal')
  const origem = conta.pc_id || (conta.contrato_id && conta.contrato_id !== 'Geral' && conta.contrato_id !== '—')
  if (!origem) motivos.push('sem pedido ou contrato de origem (lastro)')
  // Alçada por valor: acima do limiar exige aprovação prévia de Diretor.
  if (alcadaPendente({ valor: conta.valor, aprovadaPor: conta.alcada_aprovada_por })) {
    motivos.push(`acima de R$ ${ALCADA_PAGAMENTO_VALOR} sem aprovação de alçada (Diretor Financeiro)`)
  }
  // Serviço: paga com ACEITE do requisitante (não com recebimento físico/3-way).
  if (conta.pc_id) {
    const ped = db.prepare(`SELECT tipo_compra FROM pedidos_compra WHERE id = ?`).get(conta.pc_id)
    const temAceite = !!db.prepare(`SELECT 1 FROM aceites_servico WHERE pedido_id = ? AND aceito = 1 LIMIT 1`).get(conta.pc_id)
    if (exigeAceiteServico(ped, temAceite)) motivos.push('serviço sem aceite do requisitante (checklist de recebimento)')
  }
  if (motivos.length) {
    log(req.user.usuario_id, req.user.nome, 'payment_blocked', 'contas_pagar', `Bloqueio: ${motivos.join('; ')}`)
    return res.status(409).json(err('Pagamento bloqueado: ' + motivos.join('; ')))
  }

  // 3-way por item: confere a nota contra o pedido (e recebimento, se houver).
  if (conta.pc_id && conciliarTresVias) {
    const itensPedido = db.prepare(`SELECT descricao, quantidade, valor_unitario, codigo_produto FROM pc_itens WHERE pc_id = ?`).all(conta.pc_id)
    const itensNota = (req.body && req.body.itens_nota) || []
    // Auto-feed: se o corpo não trouxer os recebidos, usa o acumulado do banco.
    let itensRecebidos = (req.body && req.body.itens_recebidos) || []
    if (!itensRecebidos.length) itensRecebidos = itensRecebidosAcumulados(conta.pc_id)
    if (itensNota.length) {
      const r = conciliarTresVias({ itensPedido, itensRecebidos, itensNota })
      if (!r.conforme) {
        log(req.user.usuario_id, req.user.nome, 'payment_blocked', 'contas_pagar', `Bloqueio 3-way: ${r.divergencias.map(d => d.tipo).join(',')}`)
        return res.status(409).json(err('Pagamento bloqueado (3-way): ' + r.divergencias.map(d => d.detalhe).join('; ')))
      }
    }
    // Fallback de total: a conta não pode exceder o pedido (+2%).
    const ped = db.prepare(`SELECT valor_total FROM pedidos_compra WHERE id = ?`).get(conta.pc_id)
    if (ped && typeof conta.valor === 'number' && conta.valor > ped.valor_total * 1.02) {
      return res.status(409).json(err('Pagamento bloqueado: valor acima do pedido de origem'))
    }
  }

  const data_pagamento = new Date().toISOString().split('T')[0]
  db.prepare(`UPDATE contas_pagar SET status='Pago', data_pagamento=?, updated_at=datetime('now') WHERE id=?`).run(data_pagamento, req.params.id)
  log(req.user.usuario_id, req.user.nome, 'Pagar', 'contas_pagar', `Pagamento liberado: ${conta.descricao} (R$ ${conta.valor})`)
  res.json(ok({ id: conta.id, status: 'Pago', data_pagamento }))
})

// ════════════════════════════════════════════════════════════
// ALMOXARIFADO
// ════════════════════════════════════════════════════════════
app.get('/api/almoxarifado', requireAuth, (req, res) => {
  const { q = '', categoria } = req.query
  let sql = `SELECT * FROM almoxarifado_itens WHERE ativo = 1 AND empresa_id = ?`
  const params = [empresaDoReq(req)]
  if (q) { sql += ` AND (descricao LIKE ? OR codigo LIKE ?)`; params.push(`%${q}%`, `%${q}%`) }
  if (categoria) { sql += ` AND categoria = ?`; params.push(categoria) }
  sql += ' ORDER BY descricao'
  const rows = db.prepare(sql).all(...params)
  res.json(ok(rows))
})

app.post('/api/almoxarifado', requireAuth, (req, res) => {
  const { codigo, descricao, categoria, unidade, quantidade_atual, quantidade_minima, quantidade_maxima, localizacao, valor_medio } = req.body
  if (!descricao) return res.status(400).json(err('Descrição obrigatória'))
  // quantidade_maxima explícita (default 0 = "sem máximo"; a reposição usa 2×min).
  // Evita o default de schema (999), que tornava a sugestão de compra absurda.
  const r = db.prepare(
    `INSERT INTO almoxarifado_itens(codigo, descricao, categoria, unidade, quantidade_atual, quantidade_minima, quantidade_maxima, localizacao, valor_medio, empresa_id)
     VALUES(?,?,?,?,?,?,?,?,?,?)`
  ).run(codigo, descricao, categoria || 'Geral', unidade || 'UN', quantidade_atual || 0, quantidade_minima || 0, Number(quantidade_maxima) || 0, localizacao, valor_medio || 0, empresaDoReq(req))
  res.status(201).json(ok(db.prepare(`SELECT * FROM almoxarifado_itens WHERE id = ?`).get(r.lastInsertRowid)))
})

app.put('/api/almoxarifado/:id', requireAuth, (req, res) => {
  const cur = rowScoped('almoxarifado_itens', req)
  if (!cur) return res.status(404).json(err('Item não encontrado'))
  const { codigo, descricao, categoria, unidade, quantidade_atual, quantidade_minima, quantidade_maxima, localizacao, valor_medio, ativo } = req.body
  db.prepare(`UPDATE almoxarifado_itens SET codigo=?,descricao=?,categoria=?,unidade=?,quantidade_atual=?,quantidade_minima=?,quantidade_maxima=?,localizacao=?,valor_medio=?,ativo=?,updated_at=datetime('now') WHERE id=?`)
    .run(codigo, descricao, categoria, unidade, quantidade_atual, quantidade_minima,
      quantidade_maxima != null ? Number(quantidade_maxima) || 0 : cur.quantidade_maxima, localizacao, valor_medio, ativo ?? 1, req.params.id)
  res.json(ok(db.prepare(`SELECT * FROM almoxarifado_itens WHERE id = ?`).get(req.params.id)))
})

// Movimenta o estoque com regras reais: custo médio ponderado na entrada e
// bloqueio de saída sem lastro (não zera silenciosamente). Grava o movimento
// com o saldo resultante (trilha) e o tenant. Pura em lib/estoque.js.
app.post('/api/almoxarifado/:id/movimentar', requireAuth, (req, res) => {
  const b = req.body || {}
  const item = rowScoped('almoxarifado_itens', req)
  if (!item) return res.status(404).json(err('Item não encontrado'))
  const r = aplicarMovimento(item, {
    tipo: b.tipo, quantidade: b.quantidade, valor_unitario: b.valor_unitario,
    permitir_negativo: !!b.permitir_negativo,
  })
  if (!r.ok) return res.status(r.code || 400).json(err(r.erro, r.code || 400))
  db.prepare(`UPDATE almoxarifado_itens SET quantidade_atual = ?, valor_medio = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(r.quantidade, r.valor_medio, item.id)
  db.prepare(`INSERT INTO almoxarifado_movimentos(item_id, tipo, quantidade, valor_unitario, documento, observacao, saldo_apos, usuario_id, usuario_nome, empresa_id)
     VALUES(?,?,?,?,?,?,?,?,?,?)`)
    .run(item.id, b.tipo, Number(b.quantidade), b.valor_unitario || 0, b.documento || null, b.observacao || null, r.quantidade, req.user.usuario_id, req.user.nome, empresaDoReq(req))
  log(req.user.usuario_id, req.user.nome, 'movimentar', 'almoxarifado', `${b.tipo} ${b.quantidade} de ${item.descricao} → saldo ${r.quantidade}`)
  res.json(ok(db.prepare(`SELECT * FROM almoxarifado_itens WHERE id = ?`).get(item.id)))
})

// Histórico de movimentos de um item (tenant-scoped).
app.get('/api/almoxarifado/:id/movimentos', requireAuth, (req, res) => {
  const item = rowScoped('almoxarifado_itens', req)
  if (!item) return res.status(404).json(err('Item não encontrado'))
  const rows = db.prepare(`SELECT * FROM almoxarifado_movimentos WHERE item_id = ? ORDER BY id DESC LIMIT 200`).all(item.id)
  res.json(ok(rows))
})

// Ponto de reposição: itens no/abaixo do mínimo + sugestão de compra.
app.get('/api/almoxarifado/reposicao', requireAuth, (req, res) => {
  const itens = db.prepare(`SELECT id, codigo, descricao, quantidade_atual, quantidade_minima, quantidade_maxima, valor_medio FROM almoxarifado_itens WHERE ativo = 1 AND empresa_id = ?`).all(empresaDoReq(req))
  const repor = itensParaRepor(itens)
  res.json(ok({ itens: repor, total: repor.length, custo_estimado_total: Math.round(repor.reduce((s, i) => s + (i.custo_estimado || 0), 0) * 100) / 100 }))
})

// Valorização do estoque: total e por categoria (Σ saldo × custo médio).
app.get('/api/almoxarifado/valorizacao', requireAuth, (req, res) => {
  const itens = db.prepare(`SELECT quantidade_atual, valor_medio, categoria FROM almoxarifado_itens WHERE ativo = 1 AND empresa_id = ?`).all(empresaDoReq(req))
  res.json(ok(valorizarEstoque(itens)))
})

// ELO estoque → suprimentos: gera uma requisição de compra (RC) a partir dos
// itens em ponto de reposição, com a quantidade sugerida e o custo médio como
// estimativa. Fecha o ciclo de abastecimento. tipo = Material.
app.post('/api/almoxarifado/requisicao-reposicao', requireAuth, requireRole('admin', 'diretor', 'comprador', 'almoxarife', 'operacao'), (req, res) => {
  const emp = empresaDoReq(req)
  const b = req.body || {}
  const itensRows = db.prepare(`SELECT id, codigo, descricao, unidade, quantidade_atual, quantidade_minima, quantidade_maxima, valor_medio FROM almoxarifado_itens WHERE ativo = 1 AND empresa_id = ?`).all(emp)
  let repor = itensParaRepor(itensRows)
  // Seleção opcional de itens específicos (senão, todos em reposição).
  if (Array.isArray(b.item_ids) && b.item_ids.length) {
    const set = new Set(b.item_ids.map(String))
    repor = repor.filter(i => set.has(String(i.id)))
  }
  if (!repor.length) return res.status(400).json(err('Nenhum item em ponto de reposição'))
  const byId = new Map(itensRows.map(i => [i.id, i]))
  const itens = repor.map(i => {
    const it = byId.get(i.id) || {}
    return { descricao: i.descricao, codigo_produto: i.codigo, quantidade: i.sugestao_compra, unidade: it.unidade || 'UN', valor_unitario_estimado: it.valor_medio || 0 }
  })
  const wbs = (b.wbs && String(b.wbs).trim()) || 'ESTOQUE'
  const rc = inserirRC(emp, req.user, {
    departamento: b.departamento || 'Almoxarifado', prioridade: b.prioridade || 'Normal',
    observacoes: b.observacoes || 'Reposição automática de estoque (ponto de reposição)', tipo: 'Material', wbs,
  }, itens)
  log(req.user.usuario_id, req.user.nome, 'rc_reposicao', 'almoxarifado', `RC ${rc.numero} gerada da reposição (${repor.length} item(ns))`)
  res.status(201).json(ok({ ...rc, origem: 'reposicao', itens_repostos: repor.length }))
})

// ════════════════════════════════════════════════════════════
// Recursos do front de almoxarifado (materiais, movimentos, empréstimos,
// inventários). Persistem o objeto enviado pelo front (antes só localStorage).
// ════════════════════════════════════════════════════════════
const _DOC_RES = { 'materiais': 'materiais', 'movimentos-estoque': 'movimentos_estoque', 'emprestimos': 'emprestimos', 'inventarios': 'inventarios' }
for (const t of Object.values(_DOC_RES)) {
  db.exec(`CREATE TABLE IF NOT EXISTS ${t} (id INTEGER PRIMARY KEY AUTOINCREMENT, payload TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')))`)
  ensureColumns(t, [['empresa_id', 'empresa_id INTEGER DEFAULT 1']]) // isolamento por tenant
}
function _registrarDocResource(rota, tabela) {
  const parse = r => ({ id: r.id, ...JSON.parse(r.payload || '{}'), created_at: r.created_at })
  // Busca escopada por empresa (→ 404 se de outro tenant).
  const doc = (req) => db.prepare(`SELECT id, payload, created_at FROM ${tabela} WHERE id = ? AND empresa_id = ?`).get(req.params.id, empresaDoReq(req))
  app.get(`/api/${rota}`, requireAuth, (req, res) => {
    const limit = Math.max(1, Math.min(parseInt(req.query.limit) || 1000, 2000))
    res.json(ok(db.prepare(`SELECT id, payload, created_at FROM ${tabela} WHERE empresa_id = ? ORDER BY id DESC LIMIT ?`).all(empresaDoReq(req), limit).map(parse)))
  })
  app.get(`/api/${rota}/:id`, requireAuth, (req, res) => {
    const r = doc(req)
    if (!r) return res.status(404).json(err('Registro não encontrado'))
    res.json(ok(parse(r)))
  })
  app.post(`/api/${rota}`, requireAuth, (req, res) => {
    const r = db.prepare(`INSERT INTO ${tabela}(payload, empresa_id) VALUES(?,?)`).run(JSON.stringify(req.body || {}), empresaDoReq(req))
    res.status(201).json(ok({ id: r.lastInsertRowid, ...(req.body || {}) }))
  })
  app.put(`/api/${rota}/:id`, requireAuth, (req, res) => {
    const cur = doc(req)
    if (!cur) return res.status(404).json(err('Registro não encontrado'))
    const merged = { ...JSON.parse(cur.payload || '{}'), ...(req.body || {}) }
    db.prepare(`UPDATE ${tabela} SET payload = ?, updated_at = datetime('now') WHERE id = ?`).run(JSON.stringify(merged), req.params.id)
    res.json(ok({ id: Number(req.params.id), ...merged }))
  })
  app.delete(`/api/${rota}/:id`, requireAuth, (req, res) => {
    if (!doc(req)) return res.status(404).json(err('Registro não encontrado'))
    db.prepare(`DELETE FROM ${tabela} WHERE id = ?`).run(req.params.id)
    res.json(ok({ ok: true }))
  })
}
for (const [rota, tabela] of Object.entries(_DOC_RES)) _registrarDocResource(rota, tabela)

// ════════════════════════════════════════════════════════════
// CONTRATOS
// ════════════════════════════════════════════════════════════
app.get('/api/contratos', requireAuth, (req, res) => {
  const rows = db.prepare(`SELECT c.*, f.nome as fornecedor FROM contratos c LEFT JOIN fornecedores f ON f.id = c.fornecedor_id WHERE c.empresa_id = ? ORDER BY c.created_at DESC`).all(empresaDoReq(req))
  res.json(ok(rows))
})

app.post('/api/contratos', requireAuth, (req, res) => {
  const { titulo, fornecedor_id, tipo, valor_total, data_inicio, data_fim, objeto, observacoes } = req.body
  if (!titulo) return res.status(400).json(err('Título obrigatório'))
  const year = new Date().getFullYear()
  const count = db.prepare(`SELECT COUNT(*) as n FROM contratos WHERE numero LIKE ?`).get(`CT-${year}-%`).n
  const numero = `CT-${year}-${String(count + 1).padStart(3, '0')}`
  const f = fornecedor_id ? db.prepare(`SELECT nome FROM fornecedores WHERE id = ?`).get(fornecedor_id) : null
  const r = db.prepare(
    `INSERT INTO contratos(numero, titulo, fornecedor_id, fornecedor_nome, tipo, status, valor_total, data_inicio, data_fim, objeto, responsavel_id, responsavel_nome, empresa_id)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(numero, titulo, fornecedor_id || null, f?.nome, tipo || 'Serviço', 'Ativo', valor_total || 0, data_inicio, data_fim, objeto, req.user.usuario_id, req.user.nome, empresaDoReq(req))
  res.status(201).json(ok(db.prepare(`SELECT * FROM contratos WHERE id = ?`).get(r.lastInsertRowid)))
})

app.put('/api/contratos/:id', requireAuth, (req, res) => {
  if (!rowScoped('contratos', req)) return res.status(404).json(err('Contrato não encontrado'))
  const { titulo, tipo, status, valor_total, data_inicio, data_fim, objeto } = req.body
  db.prepare(`UPDATE contratos SET titulo=?,tipo=?,status=?,valor_total=?,data_inicio=?,data_fim=?,objeto=?,updated_at=datetime('now') WHERE id=?`)
    .run(titulo, tipo, status, valor_total, data_inicio, data_fim, objeto, req.params.id)
  res.json(ok(db.prepare(`SELECT * FROM contratos WHERE id = ?`).get(req.params.id)))
})

// ════════════════════════════════════════════════════════════
// CRM
// ════════════════════════════════════════════════════════════
// Etapas do funil em ordem. "Passou de Qualificação" = Qualificação até
// Negociação (não vale para Prospecção nem para os fechados). Pura (espelhada no Worker).
const CRM_ETAPAS_ORDEM = ['Prospecção', 'Qualificação', 'Reunião Agendada', 'Proposta Enviada', 'Negociação', 'Fechado Ganho', 'Fechado Perdido']
function precisaOrcamentacao(estagio) {
  const i = CRM_ETAPAS_ORDEM.indexOf(estagio)
  return i >= 1 && i <= 4
}

app.get('/api/crm', requireAuth, (req, res) => {
  const rows = db.prepare(`SELECT * FROM crm_oportunidades WHERE empresa_id = ? ORDER BY created_at DESC`).all(empresaDoReq(req))
  res.json(ok(rows))
})

app.post('/api/crm', requireAuth, (req, res) => {
  const { titulo, cliente, valor, estagio, probabilidade, data_fechamento, observacoes } = req.body
  if (!titulo || !cliente) return res.status(400).json(err('Título e cliente obrigatórios'))
  const r = db.prepare(
    `INSERT INTO crm_oportunidades(titulo, cliente, valor, estagio, probabilidade, responsavel_id, responsavel_nome, data_fechamento, observacoes, empresa_id)
     VALUES(?,?,?,?,?,?,?,?,?,?)`
  ).run(titulo, cliente, valor || 0, estagio || 'Prospecção', probabilidade || 10, req.user.usuario_id, req.user.nome, data_fechamento, observacoes, empresaDoReq(req))
  res.status(201).json(ok(db.prepare(`SELECT * FROM crm_oportunidades WHERE id = ?`).get(r.lastInsertRowid)))
})

app.put('/api/crm/:id', requireAuth, (req, res) => {
  const cur = rowScoped('crm_oportunidades', req)
  if (!cur) return res.status(404).json(err('Oportunidade não encontrada'))
  const { titulo, cliente, valor, estagio, probabilidade, data_fechamento, observacoes } = req.body
  db.prepare(`UPDATE crm_oportunidades SET titulo=?,cliente=?,valor=?,estagio=?,probabilidade=?,data_fechamento=?,observacoes=?,updated_at=datetime('now') WHERE id=?`)
    .run(titulo, cliente, valor, estagio, probabilidade, data_fechamento, observacoes, req.params.id)
  // C1: passou para Qualificação (ou além) e ainda não orçado → dispara orçamentação.
  if (precisaOrcamentacao(estagio) && cur.orcamentacao_status === 'nao_iniciada') {
    db.prepare(`UPDATE crm_oportunidades SET orcamentacao_status='pendente', orcamentacao_em=datetime('now') WHERE id=?`).run(req.params.id)
    notificar({ perfil: 'orcamentista', titulo: 'Lead para precificar', mensagem: `Crie a estimativa de custos (WBS) do lead "${titulo || cur.titulo}" — ${cliente || cur.cliente}.`, tipo: 'orcamentacao', ref_tipo: 'crm', ref_id: String(req.params.id), email: true, empresa: empresaDoReq(req) })
    log(req.user.usuario_id, req.user.nome, 'orcamentacao_disparada', 'crm_oportunidades', `Orçamentação pendente para o lead ${titulo || cur.titulo}`)
  }
  res.json(ok(db.prepare(`SELECT * FROM crm_oportunidades WHERE id = ?`).get(req.params.id)))
})

// Leads aguardando precificação (visão do orçamentista / Controle de Custos).
app.get('/api/crm/orcamentacao', requireAuth, (req, res) => {
  const status = req.query.status || 'pendente'
  res.json(ok(db.prepare(`SELECT * FROM crm_oportunidades WHERE empresa_id = ? AND orcamentacao_status = ? ORDER BY orcamentacao_em DESC, created_at DESC`).all(empresaDoReq(req), status)))
})

app.delete('/api/crm/:id', requireAuth, (req, res) => {
  if (!rowScoped('crm_oportunidades', req)) return res.status(404).json(err('Oportunidade não encontrada'))
  db.prepare(`DELETE FROM crm_oportunidades WHERE id = ?`).run(req.params.id)
  res.json(ok(null))
})

// ════════════════════════════════════════════════════════════
// PROPOSTAS COMERCIAIS (C2) — só com estimativa de custos (WBS) do lead
// ════════════════════════════════════════════════════════════
// Comercial só gera proposta quando há estimativa vinculada. Pura (espelhada no Worker).
function podeGerarProposta(lead, temEstimativa) {
  if (!lead) return { ok: false, motivo: 'lead/oportunidade não encontrado' }
  if (!temEstimativa) return { ok: false, motivo: 'lead sem estimativa de custos (WBS) — orçamentação pendente' }
  return { ok: true }
}
function nextProposta() {
  const year = new Date().getFullYear()
  const n = db.prepare(`SELECT COUNT(*) as n FROM propostas WHERE numero LIKE ?`).get(`PROP-${year}-%`).n
  return `PROP-${year}-${String(n + 1).padStart(3, '0')}`
}

app.get('/api/propostas', requireAuth, (req, res) => {
  const { lead_id } = req.query
  const emp = empresaDoReq(req)
  const sql = `SELECT * FROM propostas WHERE empresa_id = ? ${lead_id ? 'AND lead_id = ?' : ''} ORDER BY created_at DESC`
  res.json(ok(lead_id ? db.prepare(sql).all(emp, lead_id) : db.prepare(sql).all(emp)))
})

app.post('/api/propostas', requireAuth, (req, res) => {
  const b = req.body || {}
  const emp = empresaDoReq(req)
  // Lead e estimativa devem pertencer ao mesmo tenant.
  const lead = b.lead_id ? db.prepare(`SELECT * FROM crm_oportunidades WHERE id = ? AND empresa_id = ?`).get(b.lead_id, emp) : null
  // Soma da estimativa (WBS de orçamentação vinculada ao lead).
  const est = (b.lead_id && lead) ? db.prepare(`SELECT COUNT(*) n, COALESCE(SUM(valor_total_est),0) custo FROM wbs_linhas WHERE lead_id = ? AND empresa_id = ? AND ativo = 1`).get(b.lead_id, emp) : { n: 0, custo: 0 }
  const gate = podeGerarProposta(lead, est.n > 0)
  if (!gate.ok) return res.status(409).json(err('Proposta bloqueada: ' + gate.motivo))
  const margem = Number(b.margem) || 0
  const valor_total = b.valor_total != null ? Number(b.valor_total) : est.custo * (1 + margem / 100)
  const numero = nextProposta()
  const r = db.prepare(`INSERT INTO propostas(numero, lead_id, cliente, objeto, custo_estimado, margem, valor_total, status, empresa_id)
     VALUES(?,?,?,?,?,?,?,?,?)`)
    .run(numero, b.lead_id, b.cliente ?? lead.cliente, b.objeto ?? lead.titulo, est.custo, margem, valor_total, 'Em Elaboração', emp)
  // Estimativa concluída: o ciclo CRM→Custos→Proposta fechou.
  db.prepare(`UPDATE crm_oportunidades SET orcamentacao_status='concluida' WHERE id=?`).run(b.lead_id)
  log(req.user.usuario_id, req.user.nome, 'proposta_criada', 'propostas', `Proposta ${numero} para ${b.cliente ?? lead.cliente} (R$ ${valor_total.toFixed(2)})`)
  res.status(201).json(ok(db.prepare(`SELECT * FROM propostas WHERE id = ?`).get(r.lastInsertRowid)))
})

// ════════════════════════════════════════════════════════════
// PROJETOS
// ════════════════════════════════════════════════════════════
app.get('/api/projetos', requireAuth, (req, res) => {
  res.json(ok(db.prepare(`SELECT * FROM projetos WHERE empresa_id = ? ORDER BY created_at DESC`).all(empresaDoReq(req))))
})

app.post('/api/projetos', requireAuth, (req, res) => {
  const { nome, descricao, status, data_inicio, data_fim, progresso, valor_orcado } = req.body
  if (!nome) return res.status(400).json(err('Nome obrigatório'))
  const r = db.prepare(
    `INSERT INTO projetos(nome, descricao, status, data_inicio, data_fim, responsavel_id, responsavel_nome, progresso, valor_orcado, empresa_id)
     VALUES(?,?,?,?,?,?,?,?,?,?)`
  ).run(nome, descricao, status || 'Em andamento', data_inicio, data_fim, req.user.usuario_id, req.user.nome, progresso || 0, valor_orcado || 0, empresaDoReq(req))
  res.status(201).json(ok(db.prepare(`SELECT * FROM projetos WHERE id = ?`).get(r.lastInsertRowid)))
})

app.put('/api/projetos/:id', requireAuth, (req, res) => {
  if (!rowScoped('projetos', req)) return res.status(404).json(err('Projeto não encontrado'))
  const { nome, descricao, status, progresso, valor_orcado, valor_realizado } = req.body
  db.prepare(`UPDATE projetos SET nome=?,descricao=?,status=?,progresso=?,valor_orcado=?,valor_realizado=?,updated_at=datetime('now') WHERE id=?`)
    .run(nome, descricao, status, progresso ?? 0, valor_orcado ?? 0, valor_realizado ?? 0, req.params.id)
  res.json(ok(db.prepare(`SELECT * FROM projetos WHERE id = ?`).get(req.params.id)))
})

// ════════════════════════════════════════════════════════════
// SSMA
// ════════════════════════════════════════════════════════════
app.get('/api/ssma', requireAuth, (req, res) => {
  res.json(ok(db.prepare(`SELECT * FROM ssma_ocorrencias ORDER BY created_at DESC`).all()))
})

app.post('/api/ssma', requireAuth, (req, res) => {
  const { tipo, descricao, local, gravidade, data_ocorrencia, acoes_corretivas } = req.body
  const year = new Date().getFullYear()
  const count = db.prepare(`SELECT COUNT(*) as n FROM ssma_ocorrencias WHERE numero LIKE ?`).get(`SSMA-${year}-%`).n
  const numero = `SSMA-${year}-${String(count + 1).padStart(3, '0')}`
  const r = db.prepare(
    `INSERT INTO ssma_ocorrencias(numero, tipo, descricao, local, gravidade, status, responsavel_id, responsavel_nome, data_ocorrencia, acoes_corretivas)
     VALUES(?,?,?,?,?,?,?,?,?,?)`
  ).run(numero, tipo, descricao, local, gravidade || 'Baixa', 'Aberta', req.user.usuario_id, req.user.nome, data_ocorrencia, acoes_corretivas)
  res.status(201).json(ok(db.prepare(`SELECT * FROM ssma_ocorrencias WHERE id = ?`).get(r.lastInsertRowid)))
})

// RCA completo = causa raiz + plano de ação preenchidos. Pura (espelhada no Worker).
function rcaCompleto({ causa_raiz, plano_acao } = {}) {
  return !!(String(causa_raiz || '').trim() && String(plano_acao || '').trim())
}

// Atualiza a ocorrência (inclui preencher a RCA antes do encerramento).
app.put('/api/ssma/:id', requireAuth, (req, res) => {
  const oc = db.prepare(`SELECT * FROM ssma_ocorrencias WHERE id = ?`).get(req.params.id)
  if (!oc) return res.status(404).json(err('Ocorrência não encontrada'))
  const b = req.body || {}
  db.prepare(`UPDATE ssma_ocorrencias SET tipo=?, descricao=?, local=?, gravidade=?, data_ocorrencia=?, acoes_corretivas=?, causa_raiz=?, plano_acao=? WHERE id=?`)
    .run(b.tipo ?? oc.tipo, b.descricao ?? oc.descricao, b.local ?? oc.local, b.gravidade ?? oc.gravidade,
      b.data_ocorrencia ?? oc.data_ocorrencia, b.acoes_corretivas ?? oc.acoes_corretivas,
      b.causa_raiz ?? oc.causa_raiz, b.plano_acao ?? oc.plano_acao, req.params.id)
  res.json(ok(db.prepare(`SELECT * FROM ssma_ocorrencias WHERE id = ?`).get(req.params.id)))
})

// Encerramento bloqueado sem RCA (causa raiz + plano de ação) → reduz reincidência.
app.post('/api/ssma/:id/encerrar', requireAuth, (req, res) => {
  const oc = db.prepare(`SELECT * FROM ssma_ocorrencias WHERE id = ?`).get(req.params.id)
  if (!oc) return res.status(404).json(err('Ocorrência não encontrada'))
  if (oc.status === 'Encerrada') return res.status(409).json(err('Ocorrência já encerrada', 409))
  const causa_raiz = req.body?.causa_raiz ?? oc.causa_raiz
  const plano_acao = req.body?.plano_acao ?? oc.plano_acao
  if (!rcaCompleto({ causa_raiz, plano_acao })) {
    return res.status(400).json(err('Encerramento exige RCA: informe a causa raiz e o plano de ação'))
  }
  db.prepare(`UPDATE ssma_ocorrencias SET status='Encerrada', data_resolucao=datetime('now'), causa_raiz=?, plano_acao=? WHERE id=?`)
    .run(causa_raiz, plano_acao, req.params.id)
  log(req.user.usuario_id, req.user.nome, 'ssma_encerrar', 'ssma_ocorrencias', `Ocorrência ${oc.numero} encerrada com RCA`)
  res.json(ok(db.prepare(`SELECT * FROM ssma_ocorrencias WHERE id = ?`).get(req.params.id)))
})

// ════════════════════════════════════════════════════════════
// USUÁRIOS (admin)
// ════════════════════════════════════════════════════════════
app.get('/api/usuarios', requireAuth, (req, res) => {
  const rows = db.prepare(`SELECT id, nome, email, perfil, ativo, created_at FROM usuarios ORDER BY nome`).all()
  res.json(ok(rows))
})

app.post('/api/usuarios', requireAuth, requireRole('admin'), (req, res) => {
  const { nome, email, senha, perfil, fornecedor_id } = req.body
  if (!nome || !email) return res.status(400).json(err('Nome e email obrigatórios'))
  // Usuário de portal (perfil 'fornecedor') exige vínculo com um fornecedor.
  if (perfil === 'fornecedor' && !fornecedor_id) return res.status(400).json(err('Usuário fornecedor exige fornecedor_id'))
  // Política de senha forte quando informada (omitida → SEED_PASSWORD do env).
  if (senha !== undefined) {
    const pol = validarSenhaForte(senha)
    if (!pol.ok) return res.status(400).json(err(pol.motivo))
  }
  // Senha sempre armazenada com hash bcrypt; se omitida, usa SEED_PASSWORD.
  const senhaHash = bcrypt.hashSync(String(senha || SEED_PASSWORD), BCRYPT_ROUNDS)
  // Multi-tenant: novo usuário herda a empresa de quem o cria (isolamento).
  // Só o tenant mestre (empresa 1) pode provisionar usuários em outra empresa.
  const criador = Number(req.user.empresa_id) || 1
  const empresaId = (criador === 1 && req.body.empresa_id) ? Number(req.body.empresa_id) : criador
  try {
    const r = db.prepare(`INSERT INTO usuarios(nome, email, senha_hash, perfil, fornecedor_id, empresa_id) VALUES(?,?,?,?,?,?)`)
      .run(nome, email.toLowerCase().trim(), senhaHash, perfil || 'operacao', fornecedor_id || null, empresaId)
    const u = db.prepare(`SELECT id, nome, email, perfil, ativo FROM usuarios WHERE id = ?`).get(r.lastInsertRowid)
    log(req.user.usuario_id, req.user.nome, 'Criar', 'usuarios', `Usuário criado: ${nome}`)
    res.status(201).json(ok(u))
  } catch (e) {
    res.status(400).json(err('Email já cadastrado'))
  }
})

app.put('/api/usuarios/:id', requireAuth, requireRole('admin'), (req, res) => {
  const { nome, email, perfil, ativo, senha } = req.body
  // Troca de senha respeita a política de senha forte.
  if (senha) {
    const pol = validarSenhaForte(senha)
    if (!pol.ok) return res.status(400).json(err(pol.motivo))
  }
  db.prepare(`UPDATE usuarios SET nome=?,email=?,perfil=?,ativo=?,updated_at=datetime('now') WHERE id=?`)
    .run(nome, email, perfil, ativo ?? 1, req.params.id)
  // Troca de senha opcional (sempre com hash bcrypt).
  if (senha) {
    db.prepare(`UPDATE usuarios SET senha_hash = ? WHERE id = ?`)
      .run(bcrypt.hashSync(String(senha), BCRYPT_ROUNDS), req.params.id)
  }
  res.json(ok(db.prepare(`SELECT id, nome, email, perfil, ativo FROM usuarios WHERE id = ?`).get(req.params.id)))
})

// ════════════════════════════════════════════════════════════
// LOGS
// ════════════════════════════════════════════════════════════
app.get('/api/logs', requireAuth, (req, res) => {
  // Multi-tenant: o tenant mestre (empresa 1) vê toda a trilha; os demais
  // enxergam apenas os próprios registros.
  const emp = empresaDoReq(req)
  const rows = emp === 1
    ? db.prepare(`SELECT * FROM logs_sistema ORDER BY created_at DESC LIMIT 200`).all()
    : db.prepare(`SELECT * FROM logs_sistema WHERE empresa_id = ? ORDER BY created_at DESC LIMIT 200`).all(emp)
  res.json(ok(rows))
})

// Verifica a integridade da trilha (recomputa a cadeia de hash — global e
// encadeada, por isso restrita ao tenant mestre). Admin.
app.get('/api/auditoria/verificar', requireAuth, requireRole('admin'), (req, res) => {
  if (empresaDoReq(req) !== 1) return res.status(403).json(err('Verificação da trilha restrita ao tenant mestre', 403))
  const rows = db.prepare(`SELECT id, usuario_id, acao, modulo, descricao, created_at, hash, hash_anterior
                           FROM logs_sistema ORDER BY id ASC`).all()
  res.json(ok(Auditoria.verificarCadeia(rows)))
})

// ════════════════════════════════════════════════════════════
// CONFIG
// ════════════════════════════════════════════════════════════
app.get('/api/config', requireAuth, (req, res) => {
  const rows = db.prepare(`SELECT * FROM config_sistema`).all()
  const config = {}
  rows.forEach(r => { config[r.chave] = r.valor })
  res.json(ok(config))
})

// ════════════════════════════════════════════════════════════
// MODO DEMO COMERCIAL — semeia, NO TENANT ATUAL, um cenário coerente que
// demonstra em 1 clique os 4 momentos de valor do produto. Admin apenas,
// idempotente por empresa (não duplica), 100% isolado por tenant.
// ════════════════════════════════════════════════════════════
app.post('/api/demo/seed', requireAuth, requireRole('admin'), (req, res) => {
  const emp = empresaDoReq(req)
  const uidNome = req.user.nome
  // Idempotência: se já semeamos esta empresa, devolve o roteiro sem duplicar.
  const jaTem = db.prepare(`SELECT COUNT(*) n FROM contratos WHERE empresa_id = ? AND objeto = 'DEMO'`).get(emp).n
  if (jaTem) return res.json(ok({ ja_existia: true, roteiro: _demoRoteiro() }))

  const tx = db.transaction(() => {
    // 1) Fornecedor HOMOLOGADO (libera emissão de PC).
    const forn = db.prepare(`INSERT INTO fornecedores(nome, razao_social, cnpj, status, ativo, empresa_id) VALUES(?,?,?,?,1,?)`)
      .run('Aço Forte Ltda (DEMO)', 'Aço Forte Industrial Ltda', '11.222.333/0001-81', 'Homologado', emp).lastInsertRowid

    // 2) Contrato + 3) linha WBS + 4) OS amarrada ao contrato/WBS.
    const contrato = db.prepare(`INSERT INTO contratos(numero, titulo, fornecedor_id, fornecedor_nome, tipo, status, valor_total, data_inicio, data_fim, objeto, responsavel_id, responsavel_nome, empresa_id)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(nextContratoDemo(emp), 'Manutenção Industrial — Planta Norte', forn, 'Aço Forte Ltda (DEMO)', 'Serviço', 'Ativo', 1200000, '2026-01-01', '2026-12-31', 'DEMO', req.user.usuario_id, uidNome, emp).lastInsertRowid
    const wbs = db.prepare(`INSERT INTO wbs_linhas(codigo, descricao, tipo, contrato_id, origem, quantidade, valor_unit_est, valor_total_est, empresa_id)
      VALUES(?,?,?,?,?,?,?,?,?)`).run('1.1', 'Mão de obra de manutenção', 'OPEX', String(contrato), 'contrato', 1, 200000, 200000, emp).lastInsertRowid
    db.prepare(`INSERT INTO ordens_servico(numero, titulo, descricao, solicitante_id, solicitante_nome, departamento, prioridade, status, valor_estimado, wbs, contrato_id, tipo_recurso, wbs_linha_id, empresa_id)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(nextOS(), 'Troca de rolamentos — Britador 02', 'Serviço de manutenção corretiva', req.user.usuario_id, uidNome, 'Manutenção', 'Alta', 'Concluída', 50000, '1.1', contrato, 'servico', wbs, emp)
    // Custo realizado lançado na linha WBS (margem visível por contrato).
    db.prepare(`UPDATE wbs_linhas SET custo_real = 48000 WHERE id = ?`).run(wbs)

    // 5) Fracionamento: 2 PCs de R$30k na janela (cada um < alçada de R$50k).
    for (let i = 0; i < 2; i++) {
      db.prepare(`INSERT INTO pedidos_compra(numero, fornecedor_id, fornecedor_nome, status, valor_total, prazo_entrega, condicao_pagamento, comprador_id, comprador_nome, empresa_id)
        VALUES(?,?,?,?,?,?,?,?,?,?)`).run(nextPC(), forn, 'Aço Forte Ltda (DEMO)', 'Emitido', 30000, '2026-08-01', '30 dias', req.user.usuario_id, uidNome, emp)
    }

    // 6) Conta a pagar SEM nota fiscal → o gate de pagamento bloqueia.
    const cpNum = `CP-${new Date().getFullYear()}-D${db.prepare(`SELECT COUNT(*) n FROM contas_pagar WHERE empresa_id = ?`).get(emp).n + 1}`
    db.prepare(`INSERT INTO contas_pagar(numero, fornecedor_id, fornecedor_nome, descricao, valor, data_vencimento, status, empresa_id)
      VALUES(?,?,?,?,?,?,?,?)`).run(cpNum, forn, 'Aço Forte Ltda (DEMO)', 'Serviço de manutenção — aguardando NF', 90000, '2026-08-15', 'Aprovado', emp)

    // 7) Lead em Qualificação com orçamentação pendente → orçamentista alertado.
    db.prepare(`INSERT INTO crm_oportunidades(titulo, cliente, valor, estagio, probabilidade, responsavel_id, responsavel_nome, observacoes, orcamentacao_status, orcamentacao_em, empresa_id)
      VALUES(?,?,?,?,?,?,?,?,?,datetime('now'),?)`).run('Obra Mina Serra Azul', 'Minera Serra Azul S.A.', 850000, 'Qualificação', 40, req.user.usuario_id, uidNome, 'Lead demo aguardando estimativa de custos', 'pendente', emp)
  })
  try {
    tx()
    log(req.user.usuario_id, uidNome, 'demo_seed', 'demo', `Cenário demo semeado para a empresa ${emp}`)
  } catch (e) {
    return res.status(500).json(err('Falha ao semear demo: ' + e.message))
  }
  res.status(201).json(ok({ semeado: true, roteiro: _demoRoteiro() }))
})

function nextContratoDemo(emp) {
  const year = new Date().getFullYear()
  const n = db.prepare(`SELECT COUNT(*) n FROM contratos WHERE empresa_id = ?`).get(emp).n
  return `CT-${year}-D${String(n + 1).padStart(2, '0')}`
}
// O roteiro de demonstração — os 4 momentos de valor, com onde clicar.
function _demoRoteiro() {
  return [
    { passo: 1, titulo: 'Pagamento bloqueado por falta de lastro', onde: 'Financeiro › Contas a Pagar › tentar pagar "aguardando NF"', valor: 'O gate barra o pagamento sem nota fiscal — evita fraude/erro.' },
    { passo: 2, titulo: 'Anomalia: fracionamento de alçada', onde: 'Central de Alertas (e e-mail do Financeiro)', valor: '2 pedidos de R$30k ao mesmo fornecedor viram 1 alerta de alta severidade.' },
    { passo: 3, titulo: 'Orçamentação disparada pelo funil', onde: 'CRM › lead "Obra Mina Serra Azul" (Qualificação)', valor: 'O orçamentista é notificado automaticamente para precificar.' },
    { passo: 4, titulo: 'Custo real do serviço na margem do contrato', onde: 'Contratos › "Manutenção Industrial" › WBS / Custos', valor: 'A OS concluída lançou R$48k na linha WBS — margem por contrato visível.' },
  ]
}

// ════════════════════════════════════════════════════════════
// START
// ════════════════════════════════════════════════════════════
// Exporta o app para testes (supertest) sem subir o listener.
export { app, db }

if (!IS_TEST) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 NEXUS ERP v3.0 rodando em http://localhost:${PORT}`)
    console.log(`📦 Banco de dados: ${DB_PATH}`)
    console.log(`👤 Usuário admin: admin@fraseralexander.com.br (senha definida via SEED_PASSWORD)\n`)
  })
}

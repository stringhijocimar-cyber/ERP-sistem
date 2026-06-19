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
import { consultarCredito } from './lib/credit_bureau.js'
import { consultarReceita } from './lib/receita.js'
import { montarFluxoCaixa } from './lib/fluxo_caixa.js'

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
])
// Compliance de compras: a RC precisa de tipo (classificação de gasto) e de
// vínculo WBS (rastreabilidade custo → contrato → projeto).
ensureColumns('requisicoes_compra', [
  ['tipo', 'tipo TEXT'],
  ['wbs', 'wbs TEXT'],
])
// Rastreabilidade de custo na origem: a OS também exige vínculo WBS.
ensureColumns('ordens_servico', [
  ['wbs', 'wbs TEXT'],
])
// SSMA: encerrar incidente exige RCA (causa raiz + plano de ação).
ensureColumns('ssma_ocorrencias', [
  ['causa_raiz', 'causa_raiz TEXT'],
  ['plano_acao', 'plano_acao TEXT'],
])
// Dupla aprovação de dados bancários: alterações ficam pendentes até 2º aval.
ensureColumns('fornecedores', [
  ['banco_pendente', 'banco_pendente TEXT'],
  ['agencia_pendente', 'agencia_pendente TEXT'],
  ['conta_pendente', 'conta_pendente TEXT'],
  ['banco_solicitado_por', 'banco_solicitado_por TEXT'],
  ['banco_solicitado_em', 'banco_solicitado_em TEXT'],
])
// Gate de pagamento precisa de NF e origem na conta a pagar.
ensureColumns('contas_pagar', [
  ['nota_fiscal', 'nota_fiscal TEXT'],
  ['contrato_id', 'contrato_id TEXT'],
  // Alçada por valor: aprovação de Diretor para pagamentos acima do limiar.
  ['alcada_aprovada_por', 'alcada_aprovada_por TEXT'],
  ['alcada_aprovada_em', 'alcada_aprovada_em TEXT'],
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

// Auth middleware
function getUser(req) {
  const auth = req.headers['authorization'] || ''
  const token = auth.replace('Bearer ', '').trim()
  if (!token) return null
  try {
    const row = db.prepare(
      `SELECT s.usuario_id, u.nome, u.email, u.perfil, u.ativo, u.fornecedor_id
       FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id
       WHERE s.token = ? AND u.ativo = 1`
    ).get(token)
    return row || null
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
    db.prepare(
      `INSERT INTO logs_sistema(usuario_id, usuario_nome, acao, modulo, descricao, created_at, hash, hash_anterior)
       VALUES(?,?,?,?,?,?,?,?)`
    ).run(userId, userName, acao, modulo, descricao, created_at, hash, hash_anterior)
  } catch {}
}

// ════════════════════════════════════════════════════════════
// AUTH
// ════════════════════════════════════════════════════════════
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
// DASHBOARD
// ════════════════════════════════════════════════════════════
app.get('/api/dashboard', requireAuth, (req, res) => {
  const stats = {
    os: {
      total: db.prepare(`SELECT COUNT(*) as n FROM ordens_servico`).get().n,
      abertas: db.prepare(`SELECT COUNT(*) as n FROM ordens_servico WHERE status != 'Aprovada' AND status != 'Cancelada'`).get().n,
      aprovadas: db.prepare(`SELECT COUNT(*) as n FROM ordens_servico WHERE status = 'Aprovada'`).get().n,
    },
    rc: {
      total: db.prepare(`SELECT COUNT(*) as n FROM requisicoes_compra`).get().n,
      pendentes: db.prepare(`SELECT COUNT(*) as n FROM requisicoes_compra WHERE status = 'Pendente' OR status = 'Rascunho'`).get().n,
      aprovadas: db.prepare(`SELECT COUNT(*) as n FROM requisicoes_compra WHERE status = 'Aprovada'`).get().n,
    },
    pc: {
      total: db.prepare(`SELECT COUNT(*) as n FROM pedidos_compra`).get().n,
      emitidos: db.prepare(`SELECT COUNT(*) as n FROM pedidos_compra WHERE status = 'Emitido'`).get().n,
      aguardando_envio: db.prepare(`SELECT COUNT(*) as n FROM pedidos_compra WHERE status = 'Aguardando Envio'`).get().n,
      enviados: db.prepare(`SELECT COUNT(*) as n FROM pedidos_compra WHERE status = 'Enviado'`).get().n,
      entregues: db.prepare(`SELECT COUNT(*) as n FROM pedidos_compra WHERE status = 'Entregue'`).get().n,
      cancelados: db.prepare(`SELECT COUNT(*) as n FROM pedidos_compra WHERE status = 'Cancelado'`).get().n,
      valor_total: db.prepare(`SELECT COALESCE(SUM(valor_total),0) as v FROM pedidos_compra WHERE status != 'Cancelado'`).get().v,
    },
    financeiro: {
      a_pagar_total: db.prepare(`SELECT COALESCE(SUM(valor),0) as v FROM contas_pagar WHERE status = 'Pendente'`).get().v,
      pago_total: db.prepare(`SELECT COALESCE(SUM(valor),0) as v FROM contas_pagar WHERE status = 'Pago'`).get().v,
      vencido_total: db.prepare(`SELECT COALESCE(SUM(valor),0) as v FROM contas_pagar WHERE status = 'Vencido'`).get().v,
    },
    fornecedores: {
      total: db.prepare(`SELECT COUNT(*) as n FROM fornecedores WHERE ativo = 1`).get().n,
    },
    almoxarifado: {
      total_itens: db.prepare(`SELECT COUNT(*) as n FROM almoxarifado_itens WHERE ativo = 1`).get().n,
      estoque_baixo: db.prepare(`SELECT COUNT(*) as n FROM almoxarifado_itens WHERE quantidade_atual < quantidade_minima AND ativo = 1`).get().n,
    },
    recentes: {
      pedidos: db.prepare(`SELECT pc.*, f.nome as fornecedor FROM pedidos_compra pc LEFT JOIN fornecedores f ON f.id = pc.fornecedor_id ORDER BY pc.created_at DESC LIMIT 5`).all(),
      os: db.prepare(`SELECT * FROM ordens_servico ORDER BY created_at DESC LIMIT 5`).all(),
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
  const f = db.prepare(`SELECT * FROM fornecedores WHERE id = ?`).get(req.params.id)
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
function _fornecedoresVencidos() {
  // Conservador: inativos, além da retenção e ainda não anonimizados.
  const cands = db.prepare(
    `SELECT * FROM fornecedores WHERE ativo = 0 AND COALESCE(anonimizado,0) = 0`
  ).all()
  return LGPD.vencidosPorRetencao(cands, { campoData: 'created_at', retencaoMeses: RETENCAO_FORNECEDOR_MESES })
}

// Preview (dry-run): quem SERIA anonimizado pela política, sem alterar nada.
app.get('/api/lgpd/retencao/fornecedores', requireAuth, requireRole('admin'), (req, res) => {
  const vencidos = _fornecedoresVencidos().map(f => ({ id: f.id, nome: f.nome, created_at: f.created_at, ativo: f.ativo }))
  res.json(ok({ politica_meses: RETENCAO_FORNECEDOR_MESES, total: vencidos.length, fornecedores: vencidos }))
})

// Execução: anonimiza todos os vencidos pela política (admin).
app.post('/api/lgpd/retencao/fornecedores/executar', requireAuth, requireRole('admin'), (req, res) => {
  const vencidos = _fornecedoresVencidos()
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

function coletarAlertas({ dias = 7, isAdmin = false } = {}) {
  const hoje = new Date().toISOString().slice(0, 10)
  const limite = new Date(Date.now() + dias * 864e5).toISOString().slice(0, 10)
  const alertas = []

  // 1) Contas a pagar VENCIDAS (dinheiro em atraso) → severidade alta.
  for (const c of db.prepare(
    `SELECT id, numero, descricao, valor, data_vencimento FROM contas_pagar
      WHERE status IN ('Pendente','Aprovado','Vencido')
        AND data_vencimento IS NOT NULL AND date(data_vencimento) < date(?)
      ORDER BY data_vencimento ASC`
  ).all(hoje)) {
    alertas.push({ tipo: 'conta_vencida', severidade: 'alta', modulo: 'Financeiro',
      titulo: `Conta vencida: ${c.numero}`, descricao: `${c.descricao || ''} — venc. ${c.data_vencimento}`,
      valor: c.valor, data: c.data_vencimento, ref: c.id })
  }

  // 2) Contas a VENCER na janela (próximos N dias) → severidade média.
  for (const c of db.prepare(
    `SELECT id, numero, descricao, valor, data_vencimento FROM contas_pagar
      WHERE status IN ('Pendente','Aprovado') AND data_vencimento IS NOT NULL
        AND date(data_vencimento) >= date(?) AND date(data_vencimento) <= date(?)
      ORDER BY data_vencimento ASC`
  ).all(hoje, limite)) {
    alertas.push({ tipo: 'conta_a_vencer', severidade: 'media', modulo: 'Financeiro',
      titulo: `Conta a vencer: ${c.numero}`, descricao: `${c.descricao || ''} — venc. ${c.data_vencimento}`,
      valor: c.valor, data: c.data_vencimento, ref: c.id })
  }

  // 3) Entregas ATRASADAS (pedido enviado, prazo estourado, não recebido) → alta.
  for (const p of db.prepare(
    `SELECT id, numero, fornecedor_nome, enviado_em, prazo_entrega FROM pedidos_compra
      WHERE enviado_em IS NOT NULL
        AND status NOT IN ('Entregue','Recebido','Cancelado','Concluído')
        AND date(enviado_em, '+' || COALESCE(prazo_entrega,7) || ' days') < date(?)
      ORDER BY enviado_em ASC`
  ).all(hoje)) {
    alertas.push({ tipo: 'entrega_atrasada', severidade: 'alta', modulo: 'Compras',
      titulo: `Entrega atrasada: ${p.numero}`, descricao: `${p.fornecedor_nome || ''} — enviado ${p.enviado_em}, prazo ${p.prazo_entrega || 7}d`,
      data: p.enviado_em, ref: p.id })
  }

  // 4) Retenção LGPD pendente — dado sensível, só para admin → média.
  if (isAdmin) {
    const venc = _fornecedoresVencidos()
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
      WHERE status = 'Ativo' AND data_fim IS NOT NULL AND date(data_fim) <= date(?)
      ORDER BY data_fim ASC`
  ).all(lim90)) {
    const sev = classificarVencimentoContrato(c.data_fim, hoje)
    if (!sev) continue
    const venc = c.data_fim < hoje
    alertas.push({ tipo: 'contrato_vencimento', severidade: sev, modulo: 'Contratos',
      titulo: `${venc ? 'Contrato vencido' : 'Contrato a vencer'}: ${c.numero}`,
      descricao: `${c.titulo || c.fornecedor_nome || ''} — fim ${c.data_fim}`,
      data: c.data_fim, ref: c.id })
  }

  alertas.sort((a, b) => (SEV_PESO[b.severidade] || 0) - (SEV_PESO[a.severidade] || 0))
  return alertas
}

app.get('/api/alertas', requireAuth, (req, res) => {
  // Feed interno: fornecedor (portal) não acessa a central de alertas.
  if (req.user.perfil === 'fornecedor') return res.status(403).json(err('Sem acesso à central de alertas', 403))
  const dias = Math.max(1, Math.min(parseInt(req.query.dias) || 7, 90))
  const alertas = coletarAlertas({ dias, isAdmin: req.user.perfil === 'admin' })
  const resumo = { total: alertas.length, alta: 0, media: 0, baixa: 0 }
  for (const a of alertas) resumo[a.severidade] = (resumo[a.severidade] || 0) + 1
  res.json(ok({ resumo, dias, alertas }))
})

// ════════════════════════════════════════════════════════════
// DASHBOARD BI — KPIs gerenciais consolidados (exposição financeira,
// governança do gate, homologação de fornecedores, alertas). Server-side.
// ════════════════════════════════════════════════════════════
function coletarKPIs({ dias = 30, isAdmin = false } = {}) {
  const hoje = new Date().toISOString().slice(0, 10)
  const limite = new Date(Date.now() + dias * 864e5).toISOString().slice(0, 10)
  const one = (sql, ...p) => db.prepare(sql).get(...p)

  // Exposição financeira (Pendente/Aprovado = compromissado, ainda não pago).
  const aPagar = one(`SELECT COUNT(*) qtd, COALESCE(SUM(valor),0) val FROM contas_pagar WHERE status IN ('Pendente','Aprovado')`)
  const vencido = one(`SELECT COUNT(*) qtd, COALESCE(SUM(valor),0) val FROM contas_pagar
      WHERE status IN ('Pendente','Aprovado','Vencido') AND data_vencimento IS NOT NULL AND date(data_vencimento) < date(?)`, hoje)
  const aVencer = one(`SELECT COUNT(*) qtd, COALESCE(SUM(valor),0) val FROM contas_pagar
      WHERE status IN ('Pendente','Aprovado') AND data_vencimento IS NOT NULL
        AND date(data_vencimento) >= date(?) AND date(data_vencimento) <= date(?)`, hoje, limite)
  const pago = one(`SELECT COALESCE(SUM(valor),0) val FROM contas_pagar WHERE status = 'Pago'`)

  // Governança do gate: bloqueios vs. pagamentos liberados (trilha de logs).
  const bloqueios = one(`SELECT COUNT(*) n FROM logs_sistema WHERE acao = 'payment_blocked'`).n
  const liberados = one(`SELECT COUNT(*) n FROM logs_sistema WHERE acao = 'Pagar' AND modulo = 'contas_pagar'`).n
  const totGate = bloqueios + liberados

  // Homologação e qualidade de fornecedores.
  const fornAtivos = one(`SELECT COUNT(*) n, COALESCE(AVG(score_medio),0) score FROM fornecedores WHERE ativo = 1`)
  const porStatus = db.prepare(`SELECT COALESCE(status,'—') status, COUNT(*) n FROM fornecedores WHERE ativo = 1 GROUP BY status`).all()

  // Compras: valor comprometido em pedidos ativos e taxa de entrega.
  const pc = one(`SELECT COUNT(*) tot,
      COALESCE(SUM(CASE WHEN status != 'Cancelado' THEN valor_total ELSE 0 END),0) val,
      SUM(CASE WHEN status IN ('Entregue','Recebido','Concluído') THEN 1 ELSE 0 END) entregues
      FROM pedidos_compra`)

  // Alertas por severidade (reusa o motor da central).
  const alertas = coletarAlertas({ dias, isAdmin })
  const sevs = { total: alertas.length, alta: 0, media: 0 }
  for (const a of alertas) if (sevs[a.severidade] != null) sevs[a.severidade]++

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
  }
}

app.get('/api/bi', requireAuth, (req, res) => {
  if (req.user.perfil === 'fornecedor') return res.status(403).json(err('Sem acesso ao painel gerencial', 403))
  const dias = Math.max(1, Math.min(parseInt(req.query.dias) || 30, 365))
  res.json(ok(coletarKPIs({ dias, isAdmin: req.user.perfil === 'admin' })))
})

// Fluxo de caixa (saídas): comparativo semanal planejado × realizado por contrato.
app.get('/api/fluxo-caixa', requireAuth, (req, res) => {
  if (req.user.perfil === 'fornecedor') return res.status(403).json(err('Sem acesso ao fluxo de caixa', 403))
  const semanas = Math.max(1, Math.min(parseInt(req.query.semanas) || 8, 52))
  const contas = db.prepare(`SELECT valor, data_vencimento, data_pagamento, status, contrato_id, pc_numero FROM contas_pagar`).all()
  res.json(ok(montarFluxoCaixa(contas, { semanas })))
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
  const grpForn = db.prepare(`SELECT ${CNPJ_NORM} cnpj, COUNT(*) n FROM fornecedores WHERE ${CNPJ_NORM} <> '' GROUP BY ${CNPJ_NORM} HAVING n > 1`).all()
  const fornecedores = grpForn.map(g => ({
    cnpj: g.cnpj, total: g.n,
    ocorrencias: db.prepare(`SELECT id, nome, ativo FROM fornecedores WHERE ${CNPJ_NORM} = ?`).all(g.cnpj),
  }))
  const grpNF = db.prepare(`SELECT nota_fiscal, COUNT(*) n FROM contas_pagar
      WHERE nota_fiscal IS NOT NULL AND nota_fiscal <> '' AND nota_fiscal <> '—' GROUP BY nota_fiscal HAVING n > 1`).all()
  const notas_fiscais = grpNF.map(g => ({
    nota_fiscal: g.nota_fiscal, total: g.n,
    ocorrencias: db.prepare(`SELECT id, fornecedor_nome, valor FROM contas_pagar WHERE nota_fiscal = ?`).all(g.nota_fiscal),
  }))
  res.json(ok({ resumo: { fornecedores_dup: fornecedores.length, nf_dup: notas_fiscais.length }, fornecedores, notas_fiscais }))
})

app.get('/api/fornecedores', requireAuth, (req, res) => {
  const { q = '', ativo = '1', limit = 100, offset = 0 } = req.query
  let sql = `SELECT f.*, COALESCE(ROUND(AVG(a.nota_media), 1), 0) as score_calculado, COUNT(a.id) as total_avaliacoes
    FROM fornecedores f LEFT JOIN avaliacoes_fornecedor a ON a.fornecedor_id = f.id`
  const where = []
  const params = []
  if (ativo !== 'todos') { where.push('f.ativo = ?'); params.push(parseInt(ativo)) }
  if (q) { where.push('(f.nome LIKE ? OR f.cnpj LIKE ? OR f.email LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`) }
  if (where.length) sql += ' WHERE ' + where.join(' AND ')
  sql += ' GROUP BY f.id ORDER BY f.nome LIMIT ? OFFSET ?'
  params.push(parseInt(limit), parseInt(offset))
  const rows = db.prepare(sql).all(...params)
  res.json(ok(rows, { total: rows.length }))
})

app.get('/api/fornecedores/:id', requireAuth, (req, res) => {
  const f = db.prepare(`SELECT * FROM fornecedores WHERE id = ?`).get(req.params.id)
  if (!f) return res.status(404).json(err('Fornecedor não encontrado'))
  const avaliacoes = db.prepare(`SELECT * FROM avaliacoes_fornecedor WHERE fornecedor_id = ? ORDER BY created_at DESC LIMIT 10`).all(req.params.id)
  res.json(ok({ ...f, avaliacoes }))
})

app.post('/api/fornecedores', requireAuth, (req, res) => {
  const b = req.body || {}
  const nome = b.nome
  if (!nome) return res.status(400).json(err('Nome obrigatório'))
  // Qualidade de dados: bloqueia CNPJ duplicado (compara só dígitos).
  const cnpjDig = String(b.cnpj || '').replace(/\D/g, '')
  if (cnpjDig) {
    const dup = db.prepare(`SELECT id, nome FROM fornecedores WHERE ${CNPJ_NORM} = ?`).get(cnpjDig)
    if (dup) return res.status(409).json(err(`CNPJ já cadastrado no fornecedor "${dup.nome}" (#${dup.id}) — duplicata`))
  }
  // Aceita aliases vindos do frontend (contato_nome, prazo_pagamento).
  const contato = b.contato ?? b.contato_nome ?? null
  const prazo = b.prazo_entrega ?? b.prazo_pagamento ?? 7
  const r = db.prepare(
    `INSERT INTO fornecedores(nome,razao_social,nome_fantasia,cnpj,email,telefone,contato,cidade,estado,categoria,
       banco,agencia,conta,prazo_entrega,condicao_pagamento,observacoes,faturamento_anual,limite_credito,
       score_credito,classificacao_credito,analise_credito,status,ativo)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    nome, b.razao_social ?? null, b.nome_fantasia ?? null, b.cnpj ?? null, b.email ?? null, b.telefone ?? null,
    contato, b.cidade ?? null, b.estado ?? null, b.categoria || 'Geral',
    b.banco ?? null, b.agencia ?? null, b.conta ?? null, prazo, b.condicao_pagamento || '30 dias', b.observacoes ?? null,
    b.faturamento_anual ?? 0, b.limite_credito ?? 0, b.score_credito ?? 0, b.classificacao_credito ?? null,
    b.analise_credito ?? null, b.status || 'Em Homologação', b.ativo ?? 1
  )
  const f = db.prepare(`SELECT * FROM fornecedores WHERE id = ?`).get(r.lastInsertRowid)
  log(req.user.usuario_id, req.user.nome, 'Criar', 'fornecedores', `Fornecedor criado: ${nome}`)
  res.status(201).json(ok(f))
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
  const f = db.prepare(`SELECT * FROM fornecedores WHERE id = ?`).get(req.params.id)
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
  const f = db.prepare(`SELECT * FROM fornecedores WHERE id = ?`).get(req.params.id)
  if (!f) return res.status(404).json(err('Fornecedor não encontrado'))
  if (!f.banco_solicitado_por) return res.status(400).json(err('Não há alteração bancária pendente'))
  db.prepare(`UPDATE fornecedores SET banco_pendente=NULL, agencia_pendente=NULL, conta_pendente=NULL, banco_solicitado_por=NULL, banco_solicitado_em=NULL WHERE id=?`).run(req.params.id)
  log(req.user.usuario_id, req.user.nome, 'banco_alteracao_rejeitada', 'fornecedores', `Alteração bancária rejeitada: ${f.nome}`)
  res.json(ok(db.prepare(`SELECT * FROM fornecedores WHERE id = ?`).get(req.params.id)))
})

app.put('/api/fornecedores/:id', requireAuth, (req, res) => {
  const b = req.body || {}
  const atual = db.prepare(`SELECT * FROM fornecedores WHERE id = ?`).get(req.params.id)
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
  }
  const f = db.prepare(`SELECT * FROM fornecedores WHERE id = ?`).get(req.params.id)
  log(req.user.usuario_id, req.user.nome, 'Editar', 'fornecedores', `Fornecedor atualizado: ${v('nome')}`)
  res.json(ok(f))
})

app.post('/api/fornecedores/:id/avaliacoes', requireAuth, (req, res) => {
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
  const where = []
  const params = []
  if (status) { where.push('os.status = ?'); params.push(status) }
  if (q) { where.push('(os.numero LIKE ? OR os.titulo LIKE ?)'); params.push(`%${q}%`, `%${q}%`) }
  if (where.length) sql += ' WHERE ' + where.join(' AND ')
  sql += ' ORDER BY os.created_at DESC'
  res.json(ok(db.prepare(sql).all(...params)))
})

app.get('/api/os/:id', requireAuth, (req, res) => {
  const os = db.prepare(`SELECT * FROM ordens_servico WHERE id = ?`).get(req.params.id)
  if (!os) return res.status(404).json(err('OS não encontrada'))
  const fluxo = db.prepare(`SELECT * FROM fluxo_aprovacao WHERE os_id = ? ORDER BY estagio`).all(req.params.id)
  res.json(ok({ ...os, fluxo }))
})

app.post('/api/os', requireAuth, (req, res) => {
  const { titulo, descricao, departamento, prioridade, valor_estimado, centro_custo, projeto, data_necessidade, wbs } = req.body
  if (!titulo) return res.status(400).json(err('Título obrigatório'))
  // Compliance: WBS obrigatória para rastreabilidade de custo na origem da demanda.
  if (!wbs || !String(wbs).trim()) return res.status(400).json(err('Vínculo WBS obrigatório na OS (rastreabilidade de custo)'))
  const numero = nextOS()
  const r = db.prepare(
    `INSERT INTO ordens_servico(numero, titulo, descricao, solicitante_id, solicitante_nome, departamento, prioridade, status, valor_estimado, centro_custo, projeto, data_necessidade, wbs)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(numero, titulo, descricao, req.user.usuario_id, req.user.nome, departamento, prioridade || 'Normal', 'Rascunho', valor_estimado || 0, centro_custo, projeto, data_necessidade, String(wbs).trim())
  const os = db.prepare(`SELECT * FROM ordens_servico WHERE id = ?`).get(r.lastInsertRowid)
  log(req.user.usuario_id, req.user.nome, 'Criar', 'os', `OS criada: ${numero}`)
  res.status(201).json(ok(os))
})

app.put('/api/os/:id', requireAuth, (req, res) => {
  const cur = db.prepare(`SELECT * FROM ordens_servico WHERE id = ?`).get(req.params.id)
  if (!cur) return res.status(404).json(err('OS não encontrada'))
  const { titulo, descricao, departamento, prioridade, status, valor_estimado, centro_custo, projeto, data_necessidade } = req.body
  // WBS não pode ser removida; se enviada, deve permanecer preenchida.
  let wbs = cur.wbs
  if (req.body.wbs !== undefined) {
    if (!String(req.body.wbs).trim()) return res.status(400).json(err('WBS não pode ser removida da OS'))
    wbs = String(req.body.wbs).trim()
  }
  db.prepare(
    `UPDATE ordens_servico SET titulo=?,descricao=?,departamento=?,prioridade=?,status=?,valor_estimado=?,centro_custo=?,projeto=?,data_necessidade=?,wbs=?,updated_at=datetime('now') WHERE id=?`
  ).run(titulo, descricao, departamento, prioridade, status, valor_estimado, centro_custo, projeto, data_necessidade, wbs, req.params.id)
  const os = db.prepare(`SELECT * FROM ordens_servico WHERE id = ?`).get(req.params.id)
  log(req.user.usuario_id, req.user.nome, 'Editar', 'os', `OS atualizada: ${os.numero}`)
  res.json(ok(os))
})

app.post('/api/os/:id/iniciar-fluxo', requireAuth, (req, res) => {
  db.prepare(`UPDATE ordens_servico SET status = 'Em Análise', updated_at = datetime('now') WHERE id = ?`).run(req.params.id)
  const os = db.prepare(`SELECT * FROM ordens_servico WHERE id = ?`).get(req.params.id)
  db.prepare(`INSERT INTO fluxo_aprovacao(os_id, estagio, tipo, status) VALUES(?,1,'OS','Pendente')`).run(req.params.id)
  log(req.user.usuario_id, req.user.nome, 'IniciarFluxo', 'os', `Fluxo iniciado: ${os.numero}`)
  res.json(ok(os))
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
  const where = []; const params = []
  if (status) { where.push('rc.status = ?'); params.push(status) }
  if (q) { where.push('(rc.numero LIKE ? OR rc.descricao LIKE ?)'); params.push(`%${q}%`, `%${q}%`) }
  if (where.length) sql += ' WHERE ' + where.join(' AND ')
  sql += ' ORDER BY rc.created_at DESC'
  const rows = db.prepare(sql).all(...params)
  const result = rows.map(r => ({ ...r, itens: db.prepare(`SELECT * FROM rc_itens WHERE rc_id = ?`).all(r.id) }))
  res.json(ok(result))
})

app.get('/api/rc/:id', requireAuth, (req, res) => {
  const rc = db.prepare(`SELECT * FROM requisicoes_compra WHERE id = ?`).get(req.params.id)
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

app.post('/api/rc', requireAuth, (req, res) => {
  const { os_id, os_numero, departamento, prioridade, observacoes, tipo, wbs, itens = [] } = req.body
  // Compliance: tipo válido e WBS são obrigatórios para rastreabilidade de custo.
  const tipoCanon = normalizarTipoRC(tipo)
  if (!tipoCanon) return res.status(400).json(err('Tipo da RC obrigatório: Material, Serviço ou Equipamento'))
  if (!wbs || !String(wbs).trim()) return res.status(400).json(err('Vínculo WBS obrigatório na RC (rastreabilidade de custo)'))
  const numero = nextRC()
  const valorTotal = itens.reduce((s, i) => s + ((i.quantidade || 1) * (i.valor_unitario_estimado || 0)), 0)
  const r = db.prepare(
    `INSERT INTO requisicoes_compra(numero, os_id, os_numero, solicitante_id, solicitante_nome, departamento, prioridade, status, valor_total, observacoes, tipo, wbs)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(numero, os_id || null, os_numero, req.user.usuario_id, req.user.nome, departamento, prioridade || 'Normal', 'Rascunho', valorTotal, observacoes, tipoCanon, String(wbs).trim())
  const rcId = r.lastInsertRowid
  for (const item of itens) {
    const vt = (item.quantidade || 1) * (item.valor_unitario_estimado || 0)
    db.prepare(`INSERT INTO rc_itens(rc_id, descricao, quantidade, unidade, valor_unitario_estimado, valor_total_estimado, codigo_produto) VALUES(?,?,?,?,?,?,?)`)
      .run(rcId, item.descricao, item.quantidade || 1, item.unidade || 'UN', item.valor_unitario_estimado || 0, vt, item.codigo_produto)
  }
  const rc = db.prepare(`SELECT * FROM requisicoes_compra WHERE id = ?`).get(rcId)
  log(req.user.usuario_id, req.user.nome, 'Criar', 'rc', `RC criada: ${numero}`)
  res.status(201).json(ok({ ...rc, itens: db.prepare(`SELECT * FROM rc_itens WHERE rc_id = ?`).all(rcId) }))
})

app.put('/api/rc/:id', requireAuth, (req, res) => {
  const cur = db.prepare(`SELECT * FROM requisicoes_compra WHERE id = ?`).get(req.params.id)
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
  const rows = db.prepare(`SELECT rfq.*, u.nome as comprador FROM rfq LEFT JOIN usuarios u ON u.id = rfq.comprador_id ORDER BY rfq.created_at DESC`).all()
  const result = rows.map(r => ({
    ...r,
    fornecedores: db.prepare(`SELECT rf.*, f.nome FROM rfq_fornecedores rf JOIN fornecedores f ON f.id = rf.fornecedor_id WHERE rf.rfq_id = ?`).all(r.id),
    total_cotacoes: db.prepare(`SELECT COUNT(*) as n FROM cotacoes WHERE rfq_id = ?`).get(r.id).n
  }))
  res.json(ok(result))
})

app.get('/api/rfq/:id', requireAuth, (req, res) => {
  const rfq = db.prepare(`SELECT * FROM rfq WHERE id = ?`).get(req.params.id)
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
    `INSERT INTO rfq(numero, rc_id, rc_numero, titulo, descricao, status, prazo_resposta, comprador_id, comprador_nome, valor_estimado)
     VALUES(?,?,?,?,?,?,?,?,?,?)`
  ).run(numero, rc_id || null, rc_numero, titulo, descricao, 'Aberta', prazo_resposta, req.user.usuario_id, req.user.nome, valor_estimado || 0)
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
     ORDER BY mc.created_at DESC`
  ).all()
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
  const rfq = db.prepare(`SELECT numero FROM rfq WHERE id = ?`).get(rfq_id)
  const f = db.prepare(`SELECT nome FROM fornecedores WHERE id = ?`).get(fornecedor_vencedor_id)
  const numero = nextMapa()
  const r = db.prepare(
    `INSERT INTO mapas_comparativos(numero, rfq_id, rfq_numero, cotacao_vencedora_id, fornecedor_vencedor_id, fornecedor_vencedor_nome, status, valor_aprovado, economia_gerada, justificativa)
     VALUES(?,?,?,?,?,?,?,?,?,?)`
  ).run(numero, rfq_id, rfq?.numero, cotacao_vencedora_id, fornecedor_vencedor_id, f?.nome, 'Em análise', valor_aprovado || 0, economia_gerada || 0, justificativa)
  db.prepare(`UPDATE cotacoes SET vencedor = 1 WHERE id = ?`).run(cotacao_vencedora_id)
  if (conc.excecao) log(req.user.usuario_id, req.user.nome, 'concorrencia_excecao', 'mapas', `Exceção de concorrência (${numCotacoes} cotação(ões)) aprovada por Diretor: ${justificativa}`)
  const mapa = db.prepare(`SELECT * FROM mapas_comparativos WHERE id = ?`).get(r.lastInsertRowid)
  log(req.user.usuario_id, req.user.nome, 'Criar', 'mapas', `Mapa criado: ${numero}`)
  res.status(201).json(ok(mapa))
})

app.post('/api/mapas/:id/aprovar', requireAuth, requireRole('admin', 'diretor', 'financeiro', 'compras'), (req, res) => {
  const { comentario = '' } = req.body
  db.prepare(`UPDATE mapas_comparativos SET status='Aprovado', aprovado_em=datetime('now'), aprovado_por=? WHERE id=?`)
    .run(req.user.nome, req.params.id)
  const mapa = db.prepare(`SELECT * FROM mapas_comparativos WHERE id = ?`).get(req.params.id)
  log(req.user.usuario_id, req.user.nome, 'Aprovar', 'mapas', `Mapa aprovado`)
  res.json(ok(mapa))
})

app.post('/api/mapas/:id/reprovar', requireAuth, requireRole('admin', 'diretor', 'financeiro', 'compras'), (req, res) => {
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
  const where = []; const params = []
  if (status) { where.push('pc.status = ?'); params.push(status) }
  if (fornecedor_id) { where.push('pc.fornecedor_id = ?'); params.push(fornecedor_id) }
  if (q) { where.push('(pc.numero LIKE ? OR f.nome LIKE ?)'); params.push(`%${q}%`, `%${q}%`) }
  if (where.length) sql += ' WHERE ' + where.join(' AND ')
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
  const pc = db.prepare(`SELECT pc.*, f.nome as fornecedor FROM pedidos_compra pc LEFT JOIN fornecedores f ON f.id = pc.fornecedor_id WHERE pc.id = ?`).get(req.params.id)
  if (!pc) return res.status(404).json(err('PC não encontrado'))
  const itens = db.prepare(`SELECT * FROM pc_itens WHERE pc_id = ?`).all(req.params.id)
  const historico = db.prepare(`SELECT * FROM pc_historico WHERE pc_id = ? ORDER BY created_at DESC`).all(req.params.id)
  res.json(ok({ ...pc, itens, historico }))
})

app.post('/api/pedidos', requireAuth, async (req, res) => {
  const { mapa_id, mapa_numero, rc_id, fornecedor_id, valor_total, prazo_entrega, condicao_pagamento, local_entrega, observacoes, itens = [] } = req.body
  if (!fornecedor_id) return res.status(400).json(err('Fornecedor obrigatório'))
  const f = db.prepare(`SELECT nome, cnpj FROM fornecedores WHERE id = ?`).get(fornecedor_id)
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
  const numero = nextPC()
  const r = db.prepare(
    `INSERT INTO pedidos_compra(numero, mapa_id, mapa_numero, rc_id, fornecedor_id, fornecedor_nome, status, valor_total, prazo_entrega, condicao_pagamento, local_entrega, observacoes, comprador_id, comprador_nome)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(numero, mapa_id || null, mapa_numero, rc_id || null, fornecedor_id, f?.nome, 'Emitido', valor_total || 0, prazo_entrega, condicao_pagamento || '30 dias', local_entrega, observacoes, req.user.usuario_id, req.user.nome)
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
  db.prepare(`INSERT INTO contas_pagar(numero, pc_id, pc_numero, fornecedor_id, fornecedor_nome, descricao, valor, data_vencimento, status)
    VALUES(?,?,?,?,?,?,?,?,?)`)
    .run(cpNum, pcId, numero, fornecedor_id, f?.nome, `${numero} – ${f?.nome}`, valor_total || 0, prazo_entrega, 'Pendente')

  log(req.user.usuario_id, req.user.nome, 'Criar', 'pedidos', `PC emitido: ${numero}`)
  const pc = db.prepare(`SELECT * FROM pedidos_compra WHERE id = ?`).get(pcId)
  res.status(201).json(ok({ ...pc, itens: db.prepare(`SELECT * FROM pc_itens WHERE pc_id = ?`).all(pcId) }))
})

app.put('/api/pedidos/:id', requireAuth, (req, res) => {
  const { status, valor_total, prazo_entrega, condicao_pagamento, observacoes } = req.body
  const old = db.prepare(`SELECT * FROM pedidos_compra WHERE id = ?`).get(req.params.id)
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
  const { status, q = '' } = req.query
  let sql = `SELECT cp.*, f.nome as fornecedor FROM contas_pagar cp LEFT JOIN fornecedores f ON f.id = cp.fornecedor_id`
  const where = []; const params = []
  if (status) { where.push('cp.status = ?'); params.push(status) }
  if (q) { where.push('(cp.numero LIKE ? OR cp.descricao LIKE ?)'); params.push(`%${q}%`, `%${q}%`) }
  if (where.length) sql += ' WHERE ' + where.join(' AND ')
  sql += ' ORDER BY cp.data_vencimento ASC'
  res.json(ok(db.prepare(sql).all(...params)))
})

app.put('/api/contas-pagar/:id', requireAuth, requireRole('admin', 'financeiro'), (req, res) => {
  const { status, data_pagamento, forma_pagamento, observacoes } = req.body
  db.prepare(`UPDATE contas_pagar SET status=?,data_pagamento=?,forma_pagamento=?,observacoes=?,updated_at=datetime('now') WHERE id=?`)
    .run(status, data_pagamento, forma_pagamento, observacoes, req.params.id)
  res.json(ok(db.prepare(`SELECT * FROM contas_pagar WHERE id = ?`).get(req.params.id)))
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
  const r = db.prepare(
    `INSERT INTO recebimentos(pc_id, nf_numero, valor_nf, status, conferente, observacoes)
     VALUES(?,?,?,?,?,?)`
  ).run(b.pc_id ?? null, b.nf_numero ?? null, b.valor_nf ?? 0, b.status ?? 'Conforme',
        b.conferente ?? req.user.nome, b.observacoes ?? null)
  const recId = r.lastInsertRowid
  const itens = Array.isArray(b.itens) ? b.itens : []
  const ins = db.prepare(`INSERT INTO recebimento_itens(recebimento_id, pc_id, codigo_produto, descricao, quantidade_recebida) VALUES(?,?,?,?,?)`)
  for (const it of itens) {
    ins.run(recId, b.pc_id ?? null, it.codigo_produto ?? it.codigo ?? null, it.descricao ?? it.desc ?? null,
            Number(it.quantidade_recebida ?? it.qtd_recebida ?? it.qtd ?? 0) || 0)
  }
  log(req.user.usuario_id, req.user.nome, 'Receber', 'recebimentos', `Recebimento NF ${b.nf_numero || '—'} (${itens.length} item(ns))`)
  const rec = db.prepare(`SELECT * FROM recebimentos WHERE id = ?`).get(recId)
  res.status(201).json(ok({ ...rec, itens: db.prepare(`SELECT * FROM recebimento_itens WHERE recebimento_id = ?`).all(recId) }))
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
  const conta = db.prepare(`SELECT * FROM contas_pagar WHERE id = ?`).get(req.params.id)
  if (!conta) return res.status(404).json(err('Conta não encontrada'))
  db.prepare(`UPDATE contas_pagar SET alcada_aprovada_por=?, alcada_aprovada_em=datetime('now') WHERE id=?`)
    .run(req.user.nome, req.params.id)
  log(req.user.usuario_id, req.user.nome, 'alcada_aprovada', 'contas_pagar', `Alçada aprovada: ${conta.descricao} (R$ ${conta.valor})`)
  res.json(ok(db.prepare(`SELECT * FROM contas_pagar WHERE id = ?`).get(req.params.id)))
})

app.post('/api/contas-pagar/:id/pagar', requireAuth, requireRole('admin', 'financeiro'), (req, res) => {
  const conta = db.prepare(`SELECT * FROM contas_pagar WHERE id = ?`).get(req.params.id)
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
  let sql = `SELECT * FROM almoxarifado_itens WHERE ativo = 1`
  const params = []
  if (q) { sql += ` AND (descricao LIKE ? OR codigo LIKE ?)`; params.push(`%${q}%`, `%${q}%`) }
  if (categoria) { sql += ` AND categoria = ?`; params.push(categoria) }
  sql += ' ORDER BY descricao'
  const rows = db.prepare(sql).all(...params)
  res.json(ok(rows))
})

app.post('/api/almoxarifado', requireAuth, (req, res) => {
  const { codigo, descricao, categoria, unidade, quantidade_atual, quantidade_minima, localizacao, valor_medio } = req.body
  if (!descricao) return res.status(400).json(err('Descrição obrigatória'))
  const r = db.prepare(
    `INSERT INTO almoxarifado_itens(codigo, descricao, categoria, unidade, quantidade_atual, quantidade_minima, localizacao, valor_medio)
     VALUES(?,?,?,?,?,?,?,?)`
  ).run(codigo, descricao, categoria || 'Geral', unidade || 'UN', quantidade_atual || 0, quantidade_minima || 0, localizacao, valor_medio || 0)
  res.status(201).json(ok(db.prepare(`SELECT * FROM almoxarifado_itens WHERE id = ?`).get(r.lastInsertRowid)))
})

app.put('/api/almoxarifado/:id', requireAuth, (req, res) => {
  const { codigo, descricao, categoria, unidade, quantidade_atual, quantidade_minima, localizacao, valor_medio, ativo } = req.body
  db.prepare(`UPDATE almoxarifado_itens SET codigo=?,descricao=?,categoria=?,unidade=?,quantidade_atual=?,quantidade_minima=?,localizacao=?,valor_medio=?,ativo=?,updated_at=datetime('now') WHERE id=?`)
    .run(codigo, descricao, categoria, unidade, quantidade_atual, quantidade_minima, localizacao, valor_medio, ativo ?? 1, req.params.id)
  res.json(ok(db.prepare(`SELECT * FROM almoxarifado_itens WHERE id = ?`).get(req.params.id)))
})

app.post('/api/almoxarifado/:id/movimentar', requireAuth, (req, res) => {
  const { tipo, quantidade, valor_unitario, documento, observacao } = req.body
  const item = db.prepare(`SELECT * FROM almoxarifado_itens WHERE id = ?`).get(req.params.id)
  if (!item) return res.status(404).json(err('Item não encontrado'))
  let novaQtd = item.quantidade_atual
  if (tipo === 'Entrada') novaQtd += parseFloat(quantidade)
  else if (tipo === 'Saída') novaQtd = Math.max(0, novaQtd - parseFloat(quantidade))
  db.prepare(`UPDATE almoxarifado_itens SET quantidade_atual = ?, updated_at = datetime('now') WHERE id = ?`).run(novaQtd, req.params.id)
  db.prepare(`INSERT INTO almoxarifado_movimentos(item_id, tipo, quantidade, valor_unitario, documento, observacao, usuario_id, usuario_nome) VALUES(?,?,?,?,?,?,?,?)`)
    .run(req.params.id, tipo, quantidade, valor_unitario || 0, documento, observacao, req.user.usuario_id, req.user.nome)
  res.json(ok(db.prepare(`SELECT * FROM almoxarifado_itens WHERE id = ?`).get(req.params.id)))
})

// ════════════════════════════════════════════════════════════
// CONTRATOS
// ════════════════════════════════════════════════════════════
app.get('/api/contratos', requireAuth, (req, res) => {
  const rows = db.prepare(`SELECT c.*, f.nome as fornecedor FROM contratos c LEFT JOIN fornecedores f ON f.id = c.fornecedor_id ORDER BY c.created_at DESC`).all()
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
    `INSERT INTO contratos(numero, titulo, fornecedor_id, fornecedor_nome, tipo, status, valor_total, data_inicio, data_fim, objeto, responsavel_id, responsavel_nome)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(numero, titulo, fornecedor_id || null, f?.nome, tipo || 'Serviço', 'Ativo', valor_total || 0, data_inicio, data_fim, objeto, req.user.usuario_id, req.user.nome)
  res.status(201).json(ok(db.prepare(`SELECT * FROM contratos WHERE id = ?`).get(r.lastInsertRowid)))
})

app.put('/api/contratos/:id', requireAuth, (req, res) => {
  const { titulo, tipo, status, valor_total, data_inicio, data_fim, objeto } = req.body
  db.prepare(`UPDATE contratos SET titulo=?,tipo=?,status=?,valor_total=?,data_inicio=?,data_fim=?,objeto=?,updated_at=datetime('now') WHERE id=?`)
    .run(titulo, tipo, status, valor_total, data_inicio, data_fim, objeto, req.params.id)
  res.json(ok(db.prepare(`SELECT * FROM contratos WHERE id = ?`).get(req.params.id)))
})

// ════════════════════════════════════════════════════════════
// CRM
// ════════════════════════════════════════════════════════════
app.get('/api/crm', requireAuth, (req, res) => {
  const rows = db.prepare(`SELECT * FROM crm_oportunidades ORDER BY created_at DESC`).all()
  res.json(ok(rows))
})

app.post('/api/crm', requireAuth, (req, res) => {
  const { titulo, cliente, valor, estagio, probabilidade, data_fechamento, observacoes } = req.body
  if (!titulo || !cliente) return res.status(400).json(err('Título e cliente obrigatórios'))
  const r = db.prepare(
    `INSERT INTO crm_oportunidades(titulo, cliente, valor, estagio, probabilidade, responsavel_id, responsavel_nome, data_fechamento, observacoes)
     VALUES(?,?,?,?,?,?,?,?,?)`
  ).run(titulo, cliente, valor || 0, estagio || 'Prospecção', probabilidade || 10, req.user.usuario_id, req.user.nome, data_fechamento, observacoes)
  res.status(201).json(ok(db.prepare(`SELECT * FROM crm_oportunidades WHERE id = ?`).get(r.lastInsertRowid)))
})

app.put('/api/crm/:id', requireAuth, (req, res) => {
  const { titulo, cliente, valor, estagio, probabilidade, data_fechamento, observacoes } = req.body
  db.prepare(`UPDATE crm_oportunidades SET titulo=?,cliente=?,valor=?,estagio=?,probabilidade=?,data_fechamento=?,observacoes=?,updated_at=datetime('now') WHERE id=?`)
    .run(titulo, cliente, valor, estagio, probabilidade, data_fechamento, observacoes, req.params.id)
  res.json(ok(db.prepare(`SELECT * FROM crm_oportunidades WHERE id = ?`).get(req.params.id)))
})

app.delete('/api/crm/:id', requireAuth, (req, res) => {
  db.prepare(`DELETE FROM crm_oportunidades WHERE id = ?`).run(req.params.id)
  res.json(ok(null))
})

// ════════════════════════════════════════════════════════════
// PROJETOS
// ════════════════════════════════════════════════════════════
app.get('/api/projetos', requireAuth, (req, res) => {
  res.json(ok(db.prepare(`SELECT * FROM projetos ORDER BY created_at DESC`).all()))
})

app.post('/api/projetos', requireAuth, (req, res) => {
  const { nome, descricao, status, data_inicio, data_fim, progresso, valor_orcado } = req.body
  if (!nome) return res.status(400).json(err('Nome obrigatório'))
  const r = db.prepare(
    `INSERT INTO projetos(nome, descricao, status, data_inicio, data_fim, responsavel_id, responsavel_nome, progresso, valor_orcado)
     VALUES(?,?,?,?,?,?,?,?,?)`
  ).run(nome, descricao, status || 'Em andamento', data_inicio, data_fim, req.user.usuario_id, req.user.nome, progresso || 0, valor_orcado || 0)
  res.status(201).json(ok(db.prepare(`SELECT * FROM projetos WHERE id = ?`).get(r.lastInsertRowid)))
})

app.put('/api/projetos/:id', requireAuth, (req, res) => {
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
  // Senha sempre armazenada com hash bcrypt; se omitida, usa SEED_PASSWORD.
  const senhaHash = bcrypt.hashSync(String(senha || SEED_PASSWORD), BCRYPT_ROUNDS)
  try {
    const r = db.prepare(`INSERT INTO usuarios(nome, email, senha_hash, perfil, fornecedor_id) VALUES(?,?,?,?,?)`)
      .run(nome, email.toLowerCase().trim(), senhaHash, perfil || 'operacao', fornecedor_id || null)
    const u = db.prepare(`SELECT id, nome, email, perfil, ativo FROM usuarios WHERE id = ?`).get(r.lastInsertRowid)
    log(req.user.usuario_id, req.user.nome, 'Criar', 'usuarios', `Usuário criado: ${nome}`)
    res.status(201).json(ok(u))
  } catch (e) {
    res.status(400).json(err('Email já cadastrado'))
  }
})

app.put('/api/usuarios/:id', requireAuth, requireRole('admin'), (req, res) => {
  const { nome, email, perfil, ativo, senha } = req.body
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
  const rows = db.prepare(`SELECT * FROM logs_sistema ORDER BY created_at DESC LIMIT 200`).all()
  res.json(ok(rows))
})

// Verifica a integridade da trilha (recomputa a cadeia de hash). Admin.
app.get('/api/auditoria/verificar', requireAuth, requireRole('admin'), (req, res) => {
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

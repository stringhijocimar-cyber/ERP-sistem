// ============================================================
// NEXUS ERP v3.0 – Servidor Express + SQLite (sandbox)
// Simula o ambiente Hono + Cloudflare D1
// ============================================================
import express from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import bcrypt from 'bcryptjs'
import Database from 'better-sqlite3'
import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

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
      `SELECT s.usuario_id, u.nome, u.email, u.perfil, u.ativo
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
    db.prepare(
      `INSERT INTO logs_sistema(usuario_id, usuario_nome, acao, modulo, descricao) VALUES(?,?,?,?,?)`
    ).run(userId, userName, acao, modulo, descricao)
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
  const { nome, cnpj, email, telefone, contato, cidade, estado, categoria, prazo_entrega, condicao_pagamento, observacoes } = req.body
  if (!nome) return res.status(400).json(err('Nome obrigatório'))
  const r = db.prepare(
    `INSERT INTO fornecedores(nome,cnpj,email,telefone,contato,cidade,estado,categoria,prazo_entrega,condicao_pagamento,observacoes,ativo)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,1)`
  ).run(nome, cnpj, email, telefone, contato, cidade, estado, categoria || 'Geral', prazo_entrega || 7, condicao_pagamento || '30 dias', observacoes)
  const f = db.prepare(`SELECT * FROM fornecedores WHERE id = ?`).get(r.lastInsertRowid)
  log(req.user.usuario_id, req.user.nome, 'Criar', 'fornecedores', `Fornecedor criado: ${nome}`)
  res.status(201).json(ok(f))
})

app.put('/api/fornecedores/:id', requireAuth, (req, res) => {
  const { nome, cnpj, email, telefone, contato, cidade, estado, categoria, ativo, prazo_entrega, condicao_pagamento, observacoes } = req.body
  db.prepare(
    `UPDATE fornecedores SET nome=?,cnpj=?,email=?,telefone=?,contato=?,cidade=?,estado=?,categoria=?,ativo=?,prazo_entrega=?,condicao_pagamento=?,observacoes=?,updated_at=datetime('now') WHERE id=?`
  ).run(nome, cnpj, email, telefone, contato, cidade, estado, categoria, ativo ?? 1, prazo_entrega, condicao_pagamento, observacoes, req.params.id)
  const f = db.prepare(`SELECT * FROM fornecedores WHERE id = ?`).get(req.params.id)
  log(req.user.usuario_id, req.user.nome, 'Editar', 'fornecedores', `Fornecedor atualizado: ${nome}`)
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
  const { titulo, descricao, departamento, prioridade, valor_estimado, centro_custo, projeto, data_necessidade } = req.body
  if (!titulo) return res.status(400).json(err('Título obrigatório'))
  const numero = nextOS()
  const r = db.prepare(
    `INSERT INTO ordens_servico(numero, titulo, descricao, solicitante_id, solicitante_nome, departamento, prioridade, status, valor_estimado, centro_custo, projeto, data_necessidade)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(numero, titulo, descricao, req.user.usuario_id, req.user.nome, departamento, prioridade || 'Normal', 'Rascunho', valor_estimado || 0, centro_custo, projeto, data_necessidade)
  const os = db.prepare(`SELECT * FROM ordens_servico WHERE id = ?`).get(r.lastInsertRowid)
  log(req.user.usuario_id, req.user.nome, 'Criar', 'os', `OS criada: ${numero}`)
  res.status(201).json(ok(os))
})

app.put('/api/os/:id', requireAuth, (req, res) => {
  const { titulo, descricao, departamento, prioridade, status, valor_estimado, centro_custo, projeto, data_necessidade } = req.body
  db.prepare(
    `UPDATE ordens_servico SET titulo=?,descricao=?,departamento=?,prioridade=?,status=?,valor_estimado=?,centro_custo=?,projeto=?,data_necessidade=?,updated_at=datetime('now') WHERE id=?`
  ).run(titulo, descricao, departamento, prioridade, status, valor_estimado, centro_custo, projeto, data_necessidade, req.params.id)
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

app.post('/api/rc', requireAuth, (req, res) => {
  const { os_id, os_numero, departamento, prioridade, observacoes, itens = [] } = req.body
  const numero = nextRC()
  const valorTotal = itens.reduce((s, i) => s + ((i.quantidade || 1) * (i.valor_unitario_estimado || 0)), 0)
  const r = db.prepare(
    `INSERT INTO requisicoes_compra(numero, os_id, os_numero, solicitante_id, solicitante_nome, departamento, prioridade, status, valor_total, observacoes)
     VALUES(?,?,?,?,?,?,?,?,?,?)`
  ).run(numero, os_id || null, os_numero, req.user.usuario_id, req.user.nome, departamento, prioridade || 'Normal', 'Rascunho', valorTotal, observacoes)
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
  const { status, departamento, prioridade, observacoes } = req.body
  db.prepare(`UPDATE requisicoes_compra SET status=?,departamento=?,prioridade=?,observacoes=?,updated_at=datetime('now') WHERE id=?`)
    .run(status, departamento, prioridade, observacoes, req.params.id)
  const rc = db.prepare(`SELECT * FROM requisicoes_compra WHERE id = ?`).get(req.params.id)
  res.json(ok(rc))
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

app.post('/api/mapas', requireAuth, (req, res) => {
  const { rfq_id, cotacao_vencedora_id, fornecedor_vencedor_id, valor_aprovado, economia_gerada, justificativa } = req.body
  if (!rfq_id || !cotacao_vencedora_id) return res.status(400).json(err('RFQ e cotação vencedora obrigatórios'))
  const rfq = db.prepare(`SELECT numero FROM rfq WHERE id = ?`).get(rfq_id)
  const f = db.prepare(`SELECT nome FROM fornecedores WHERE id = ?`).get(fornecedor_vencedor_id)
  const numero = nextMapa()
  const r = db.prepare(
    `INSERT INTO mapas_comparativos(numero, rfq_id, rfq_numero, cotacao_vencedora_id, fornecedor_vencedor_id, fornecedor_vencedor_nome, status, valor_aprovado, economia_gerada, justificativa)
     VALUES(?,?,?,?,?,?,?,?,?,?)`
  ).run(numero, rfq_id, rfq?.numero, cotacao_vencedora_id, fornecedor_vencedor_id, f?.nome, 'Em análise', valor_aprovado || 0, economia_gerada || 0, justificativa)
  db.prepare(`UPDATE cotacoes SET vencedor = 1 WHERE id = ?`).run(cotacao_vencedora_id)
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

app.post('/api/pedidos', requireAuth, (req, res) => {
  const { mapa_id, mapa_numero, rc_id, fornecedor_id, valor_total, prazo_entrega, condicao_pagamento, local_entrega, observacoes, itens = [] } = req.body
  if (!fornecedor_id) return res.status(400).json(err('Fornecedor obrigatório'))
  const f = db.prepare(`SELECT nome FROM fornecedores WHERE id = ?`).get(fornecedor_id)
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

// ════════════════════════════════════════════════════════════
// USUÁRIOS (admin)
// ════════════════════════════════════════════════════════════
app.get('/api/usuarios', requireAuth, (req, res) => {
  const rows = db.prepare(`SELECT id, nome, email, perfil, ativo, created_at FROM usuarios ORDER BY nome`).all()
  res.json(ok(rows))
})

app.post('/api/usuarios', requireAuth, requireRole('admin'), (req, res) => {
  const { nome, email, senha, perfil } = req.body
  if (!nome || !email) return res.status(400).json(err('Nome e email obrigatórios'))
  // Senha sempre armazenada com hash bcrypt; se omitida, usa SEED_PASSWORD.
  const senhaHash = bcrypt.hashSync(String(senha || SEED_PASSWORD), BCRYPT_ROUNDS)
  try {
    const r = db.prepare(`INSERT INTO usuarios(nome, email, senha_hash, perfil) VALUES(?,?,?,?)`)
      .run(nome, email.toLowerCase().trim(), senhaHash, perfil || 'operacao')
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

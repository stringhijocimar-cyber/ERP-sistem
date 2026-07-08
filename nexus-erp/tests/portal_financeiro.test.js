// ============================================================
// Testes — Portal · Financeiro (read-only) e Dashboard do fornecedor.
// Escopo por fornecedor_id; nenhum vazamento entre concorrentes.
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
let request, app, db, token, tokF1, tokF2, f1, f2

const D = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10)

beforeAll(async () => {
  const st = await import('supertest')
  request = st.default
  ;({ app, db } = await import('../server.js'))
  token = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token
  const m = r => r.set('Authorization', `Bearer ${token}`)

  f1 = (await m(request(app).post('/api/fornecedores')).send({ nome: 'Aços Alfa', status: 'Homologado' })).body.data.id
  f2 = (await m(request(app).post('/api/fornecedores')).send({ nome: 'Chapas Beta', status: 'Homologado' })).body.data.id
  await m(request(app).post('/api/usuarios')).send({ nome: 'U1', email: 'fin1@f.com', senha: 'Aa@123456', perfil: 'fornecedor', fornecedor_id: f1, empresa_id: 1 })
  await m(request(app).post('/api/usuarios')).send({ nome: 'U2', email: 'fin2@f.com', senha: 'Aa@123456', perfil: 'fornecedor', fornecedor_id: f2, empresa_id: 1 })
  tokF1 = (await request(app).post('/api/auth/login').send({ email: 'fin1@f.com', senha: 'Aa@123456' })).body?.data?.token
  tokF2 = (await request(app).post('/api/auth/login').send({ email: 'fin2@f.com', senha: 'Aa@123456' })).body?.data?.token

  // Faturas do F1: uma paga, uma pendente vencendo em 10 dias. F2: nada.
  db.prepare(`INSERT INTO contas_pagar(numero, pc_numero, fornecedor_id, fornecedor_nome, nota_fiscal, valor, data_vencimento, data_pagamento, status, empresa_id)
    VALUES('CP-P1','PC-X',?, 'Aços Alfa','NF-100',50000,?,?, 'Pago',1)`).run(f1, D(-10), D(-8))
  db.prepare(`INSERT INTO contas_pagar(numero, pc_numero, fornecedor_id, fornecedor_nome, nota_fiscal, valor, data_vencimento, status, empresa_id)
    VALUES('CP-P2','PC-Y',?, 'Aços Alfa','NF-101',30000,?, 'Pendente',1)`).run(f1, D(10))
  // Pedido ativo sem NF do F1 + RFQ aguardando resposta.
  db.prepare(`INSERT INTO pedidos_compra(numero, fornecedor_id, fornecedor_nome, status, valor_total, empresa_id) VALUES('PC-D1',?,'Aços Alfa','Emitido',80000,1)`).run(f1)
  const rfqId = db.prepare(`INSERT INTO rfq(numero, titulo, status, prazo_resposta, empresa_id) VALUES('RFQ-D1','Chapa','Aberta',?,1)`).run(D(5)).lastInsertRowid
  db.prepare(`INSERT INTO rfq_fornecedores(rfq_id, fornecedor_id, fornecedor_nome) VALUES(?,?,'Aços Alfa')`).run(rfqId, f1)
})

const asF1 = r => r.set('Authorization', `Bearer ${tokF1}`)
const asF2 = r => r.set('Authorization', `Bearer ${tokF2}`)

describe('GET /api/portal/financeiro', () => {
  it('F1 vê as próprias faturas com resumo (pago / a receber / próximo)', async () => {
    const r = await asF1(request(app).get('/api/portal/financeiro'))
    expect(r.status).toBe(200)
    expect(r.body.data.faturas).toHaveLength(2)
    expect(r.body.data.resumo.recebido_total).toBe(50000)
    expect(r.body.data.resumo.a_receber_total).toBe(30000)
    expect(r.body.data.resumo.proximo_pagamento.valor).toBe(30000)
  })
  it('F2 vê extrato vazio (isolamento — nem valor do concorrente)', async () => {
    const r = await asF2(request(app).get('/api/portal/financeiro'))
    expect(r.body.data.faturas).toHaveLength(0)
    expect(r.body.data.resumo.a_receber_total).toBe(0)
    expect(JSON.stringify(r.body)).not.toContain('50000')
  })
  it('perfil interno (admin) barrado (403)', async () => {
    const r = await request(app).get('/api/portal/financeiro').set('Authorization', `Bearer ${token}`)
    expect(r.status).toBe(403)
  })
})

describe('GET /api/portal/dashboard', () => {
  it('F1 vê RFQs a responder, pedidos ativos, NF a enviar e recebíveis 30d', async () => {
    const d = (await asF1(request(app).get('/api/portal/dashboard'))).body.data
    expect(d.rfqs_aguardando.qtd).toBe(1)
    expect(d.rfqs_aguardando.itens[0].numero).toBe('RFQ-D1')
    expect(d.pedidos_ativos.qtd).toBe(1)
    expect(d.pedidos_ativos.valor).toBe(80000)
    expect(d.pendencias.nf_a_enviar).toBe(1)
    expect(d.pagamentos_proximos.valor).toBe(30000)
  })
  it('F2 tem dashboard zerado', async () => {
    const d = (await asF2(request(app).get('/api/portal/dashboard'))).body.data
    expect(d.rfqs_aguardando.qtd).toBe(0)
    expect(d.pedidos_ativos.qtd).toBe(0)
    expect(d.pagamentos_proximos.valor).toBe(0)
  })
})

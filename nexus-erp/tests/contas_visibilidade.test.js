// ============================================================
// Testes — B1: visibilidade do Contas a Pagar (recebimento ↔ conta + NF)
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
let request, app, db, token, pcId

beforeAll(async () => {
  const st = await import('supertest')
  request = st.default
  ;({ app, db } = await import('../server.js'))
  token = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token
  const fid = db.prepare(`INSERT INTO fornecedores(nome) VALUES('Forn CP')`).run().lastInsertRowid
  pcId = db.prepare(`INSERT INTO pedidos_compra(numero, fornecedor_id, status, valor_total) VALUES('PC-CP-1', ?, 'Emitido', 1000)`).run(fid).lastInsertRowid
  // Conta a pagar nasce na emissão do PC — aqui simulada, SEM nota fiscal.
  db.prepare(`INSERT INTO contas_pagar(numero, pc_id, fornecedor_id, descricao, valor, status) VALUES('CP-1', ?, ?, 'Material', 1000, 'Pendente')`).run(pcId, fid)
})

const auth = r => r.set('Authorization', `Bearer ${token}`)
const receber = body => auth(request(app).post('/api/recebimentos')).send(body)

describe('Contas a pagar — visibilidade pós-recebimento', () => {
  it('a conta existe e pode ser localizada pelo pedido (pc_id)', async () => {
    const r = await auth(request(app).get(`/api/contas-pagar?pc_id=${pcId}`))
    expect(r.status).toBe(200)
    expect(r.body.data.length).toBe(1)
    expect(r.body.data[0].numero).toBe('CP-1')
  })

  it('detalhe do pedido traz as contas a pagar geradas', async () => {
    const r = await auth(request(app).get(`/api/pedidos/${pcId}`))
    expect(r.body.data.contas_pagar.length).toBe(1)
    expect(r.body.data.contas_pagar[0].numero).toBe('CP-1')
  })

  it('registrar recebimento anexa a NF à conta e a devolve', async () => {
    const r = await receber({ pc_id: pcId, nf_numero: 'NF-555', valor_nf: 1000 })
    expect(r.status).toBe(201)
    expect(r.body.data.contas_pagar.length).toBe(1)
    expect(r.body.data.contas_pagar[0].nota_fiscal).toBe('NF-555')
    // confirma persistido
    const conta = db.prepare(`SELECT nota_fiscal FROM contas_pagar WHERE pc_id = ?`).get(pcId)
    expect(conta.nota_fiscal).toBe('NF-555')
  })

  it('não sobrescreve uma NF já anexada em recebimento posterior', async () => {
    await receber({ pc_id: pcId, nf_numero: 'NF-OUTRA', valor_nf: 1000 })
    const conta = db.prepare(`SELECT nota_fiscal FROM contas_pagar WHERE pc_id = ?`).get(pcId)
    expect(conta.nota_fiscal).toBe('NF-555') // mantém a primeira
  })

  it('aceita o alias "pedido_id" que o front envia', async () => {
    const fid = db.prepare(`INSERT INTO fornecedores(nome) VALUES('Forn CP2')`).run().lastInsertRowid
    const pc2 = db.prepare(`INSERT INTO pedidos_compra(numero, fornecedor_id, status, valor_total) VALUES('PC-CP-2', ?, 'Emitido', 500)`).run(fid).lastInsertRowid
    db.prepare(`INSERT INTO contas_pagar(numero, pc_id, fornecedor_id, descricao, valor, status) VALUES('CP-2', ?, ?, 'Mat', 500, 'Pendente')`).run(pc2, fid)
    const r = await receber({ pedido_id: pc2, nf_numero: 'NF-777' })
    expect(r.body.data.contas_pagar[0].nota_fiscal).toBe('NF-777')
  })
})

// ============================================================
// Testes de integração — Gate de pagamento + 3-way por item (Express)
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
let request, app, db, token, opToken, pcId

beforeAll(async () => {
  const st = await import('supertest')
  request = st.default
  ;({ app, db } = await import('../server.js'))
  token = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token

  // Fornecedor (via API, respeita a FK), pedido + itens (via db).
  const f = await request(app).post('/api/fornecedores').set('Authorization', `Bearer ${token}`).send({ nome: 'Forn 3way' })
  const fid = f.body.data.id
  pcId = db.prepare(`INSERT INTO pedidos_compra(numero, fornecedor_id, status, valor_total) VALUES(?,?,?,?)`)
    .run('PC-3W-1', fid, 'Emitido', 200).lastInsertRowid
  db.prepare(`INSERT INTO pc_itens(pc_id, descricao, quantidade, valor_unitario, codigo_produto) VALUES(?,?,?,?,?)`).run(pcId, 'Parafuso', 100, 1.0, 'A')
  db.prepare(`INSERT INTO pc_itens(pc_id, descricao, quantidade, valor_unitario, codigo_produto) VALUES(?,?,?,?,?)`).run(pcId, 'Porca', 50, 2.0, 'B')

  // Usuário não-admin (segregação).
  await request(app).post('/api/usuarios').set('Authorization', `Bearer ${token}`)
    .send({ nome: 'Op', email: 'op.3w@fraseralexander.com.br', senha: 'Operacao@123', perfil: 'operacao' })
  opToken = (await request(app).post('/api/auth/login').send({ email: 'op.3w@fraseralexander.com.br', senha: 'Operacao@123' })).body?.data?.token
})

let seqConta = 0
function criarConta({ status = 'Aprovado', nf = 'NF-1', valor = 200, comPC = true } = {}) {
  seqConta++
  const id = db.prepare(`INSERT INTO contas_pagar(numero, pc_id, valor, status, nota_fiscal, descricao) VALUES(?,?,?,?,?,?)`)
    .run('CP-3W-' + seqConta, comPC ? pcId : null, valor, status, nf, 'Conta teste').lastInsertRowid
  return id
}
const pagar = (id, body, tok = token) =>
  request(app).post(`/api/contas-pagar/${id}/pagar`).set('Authorization', `Bearer ${tok}`).send(body || {})

describe('POST /api/contas-pagar/:id/pagar', () => {
  it('paga quando a nota concilia com o pedido (3-way OK)', async () => {
    const id = criarConta()
    const r = await pagar(id, { itens_nota: [{ codigo: 'A', qtd: 100, preco: 1.0 }, { codigo: 'B', qtd: 50, preco: 2.0 }] })
    expect(r.status).toBe(200)
    expect(r.body.data.status).toBe('Pago')
  })

  it('bloqueia (409) quando o preço faturado excede o do pedido', async () => {
    const id = criarConta()
    const r = await pagar(id, { itens_nota: [{ codigo: 'A', qtd: 100, preco: 1.5 }] })
    expect(r.status).toBe(409)
    expect(r.body.error).toMatch(/3-way/i)
  })

  it('bloqueia (409) quando fatura mais do que foi recebido', async () => {
    const id = criarConta()
    const r = await pagar(id, {
      itens_recebidos: [{ codigo: 'A', qtd: 60 }],
      itens_nota: [{ codigo: 'A', qtd: 100, preco: 1.0 }],
    })
    expect(r.status).toBe(409)
    expect(r.body.error).toMatch(/3-way/i)
  })

  it('bloqueia (409) conta sem nota fiscal (gate de lastro)', async () => {
    const id = criarConta({ nf: null })
    const r = await pagar(id, {})
    expect(r.status).toBe(409)
    expect(r.body.error).toMatch(/nota fiscal/i)
  })

  it('nega pagamento a quem não é financeiro/admin (segregação)', async () => {
    const id = criarConta()
    const r = await pagar(id, {}, opToken)
    expect(r.status).toBe(403)
  })
})

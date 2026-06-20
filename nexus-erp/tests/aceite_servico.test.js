// ============================================================
// Testes — B2: fluxo de serviço (aceite do requisitante + checklist) no gate
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
let request, app, db, token

beforeAll(async () => {
  const st = await import('supertest')
  request = st.default
  ;({ app, db } = await import('../server.js'))
  token = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token
})

const auth = r => r.set('Authorization', `Bearer ${token}`)
// Cria um pedido de SERVIÇO + conta a pagar pronta (com NF e lastro), faltando só o aceite.
let seq = 0
function pedidoServicoComConta() {
  seq++
  const fid = db.prepare(`INSERT INTO fornecedores(nome) VALUES(?)`).run(`Forn Svc ${seq}`).lastInsertRowid
  const pid = db.prepare(`INSERT INTO pedidos_compra(numero, fornecedor_id, status, valor_total, tipo_compra) VALUES(?,?,?,?,'servico')`)
    .run(`PC-SV-${seq}`, fid, 'Emitido', 2000).lastInsertRowid
  const cid = db.prepare(`INSERT INTO contas_pagar(numero, pc_id, fornecedor_id, descricao, valor, status, nota_fiscal) VALUES(?,?,?,?,?,?,?)`)
    .run(`CP-SV-${seq}`, pid, fid, 'Serviço', 2000, 'Aprovado', 'NF-SV').lastInsertRowid
  return { pid, cid }
}
const aceitar = (pid, body) => auth(request(app).post(`/api/pedidos/${pid}/aceite-servico`)).send(body)
const pagar = cid => auth(request(app).post(`/api/contas-pagar/${cid}/pagar`)).send({})

describe('Aceite de serviço', () => {
  it('exige checklist (400)', async () => {
    const { pid } = pedidoServicoComConta()
    const r = await aceitar(pid, {})
    expect(r.status).toBe(400)
  })

  it('bloqueia aceite com item não conforme (409)', async () => {
    const { pid } = pedidoServicoComConta()
    const r = await aceitar(pid, { checklist: [{ item: 'Escopo', conforme: true }, { item: 'Prazo', conforme: false }] })
    expect(r.status).toBe(409)
  })

  it('registra aceite quando o checklist está todo conforme', async () => {
    const { pid } = pedidoServicoComConta()
    const r = await aceitar(pid, { checklist: [{ item: 'Escopo', conforme: true }, { item: 'Qualidade', conforme: true }] })
    expect(r.status).toBe(201)
    expect(r.body.data.aceito).toBe(1)
    const lista = await auth(request(app).get(`/api/aceites-servico?pedido_id=${pid}`))
    expect(lista.body.data.length).toBe(1)
  })
})

describe('Gate de pagamento de serviço', () => {
  it('bloqueia pagamento de serviço SEM aceite (409)', async () => {
    const { cid } = pedidoServicoComConta()
    const r = await pagar(cid)
    expect(r.status).toBe(409)
    expect(r.body.error).toMatch(/servi[çc]o.*aceite|aceite/i)
  })

  it('libera pagamento de serviço APÓS o aceite', async () => {
    const { pid, cid } = pedidoServicoComConta()
    await aceitar(pid, { checklist: [{ item: 'Escopo', conforme: true }] })
    const r = await pagar(cid)
    expect(r.status).toBe(200)
    expect(r.body.data.status).toBe('Pago')
  })

  it('pedido de MATERIAL não exige aceite de serviço', async () => {
    const fid = db.prepare(`INSERT INTO fornecedores(nome) VALUES('Forn Mat')`).run().lastInsertRowid
    const pid = db.prepare(`INSERT INTO pedidos_compra(numero, fornecedor_id, status, valor_total, tipo_compra) VALUES('PC-MAT-1', ?, 'Emitido', 100, 'material')`).run(fid).lastInsertRowid
    const cid = db.prepare(`INSERT INTO contas_pagar(numero, pc_id, fornecedor_id, descricao, valor, status, nota_fiscal) VALUES('CP-MAT-1', ?, ?, 'Mat', 100, 'Aprovado', 'NF-M')`).run(pid, fid).lastInsertRowid
    const r = await pagar(cid)
    expect(r.status).toBe(200)
  })
})

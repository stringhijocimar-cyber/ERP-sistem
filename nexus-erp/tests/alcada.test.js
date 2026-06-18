// ============================================================
// Testes de integração — Alçada de pagamento >R$50k (Onda 1)
// Pagamentos acima do limiar exigem aprovação prévia de Diretor,
// distinta do pagador (segregação de funções).
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
let request, app, db, adminToken, finToken, dirToken

beforeAll(async () => {
  const st = await import('supertest')
  request = st.default
  ;({ app, db } = await import('../server.js'))
  adminToken = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token

  const criarUser = (nome, email, perfil) => request(app).post('/api/usuarios').set('Authorization', `Bearer ${adminToken}`)
    .send({ nome, email, senha: 'Aa@123456', perfil })
  await criarUser('Fin', 'fin.alcada@x.com', 'financeiro')
  await criarUser('Dir', 'dir.alcada@x.com', 'diretor')
  finToken = (await request(app).post('/api/auth/login').send({ email: 'fin.alcada@x.com', senha: 'Aa@123456' })).body?.data?.token
  dirToken = (await request(app).post('/api/auth/login').send({ email: 'dir.alcada@x.com', senha: 'Aa@123456' })).body?.data?.token
})

// Cria uma conta pronta para pagar (com lastro), exceto pela alçada.
let seq = 0
function contaPronta(valor) {
  seq++
  const fid = db.prepare(`INSERT INTO fornecedores(nome) VALUES(?)`).run(`F-ALC-${seq}`).lastInsertRowid
  const pcId = db.prepare(`INSERT INTO pedidos_compra(numero, fornecedor_id, status, valor_total) VALUES(?,?,?,?)`)
    .run(`PC-ALC-${seq}`, fid, 'Emitido', valor).lastInsertRowid
  return db.prepare(`INSERT INTO contas_pagar(numero, pc_id, fornecedor_id, descricao, valor, status, nota_fiscal) VALUES(?,?,?,?,?,?,?)`)
    .run(`CP-ALC-${seq}`, pcId, fid, 'Serviço', valor, 'Aprovado', 'NF-999').lastInsertRowid
}

const pagar = (tok, id) => request(app).post(`/api/contas-pagar/${id}/pagar`).set('Authorization', `Bearer ${tok}`).send({})
const aprovarAlcada = (tok, id) => request(app).post(`/api/contas-pagar/${id}/aprovar-alcada`).set('Authorization', `Bearer ${tok}`).send({})

describe('Alçada de pagamento (>R$50k)', () => {
  it('paga normalmente abaixo do limiar sem aprovação de alçada', async () => {
    const id = contaPronta(40000)
    const r = await pagar(finToken, id)
    expect(r.status).toBe(200)
    expect(r.body.data.status).toBe('Pago')
  })

  it('bloqueia pagamento acima do limiar sem aprovação de alçada (409)', async () => {
    const id = contaPronta(60000)
    const r = await pagar(finToken, id)
    expect(r.status).toBe(409)
    expect(r.body.error).toMatch(/alçada|alcada/i)
  })

  it('financeiro não pode aprovar a própria alçada (403 — segregação)', async () => {
    const id = contaPronta(60000)
    const r = await aprovarAlcada(finToken, id)
    expect(r.status).toBe(403)
  })

  it('Diretor aprova a alçada e então o pagamento é liberado', async () => {
    const id = contaPronta(60000)
    const ap = await aprovarAlcada(dirToken, id)
    expect(ap.status).toBe(200)
    expect(ap.body.data.alcada_aprovada_por).toBeTruthy()
    const pg = await pagar(finToken, id)
    expect(pg.status).toBe(200)
    expect(pg.body.data.status).toBe('Pago')
  })
})

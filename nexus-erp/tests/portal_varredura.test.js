// ============================================================
// Testes — Varredura adversarial do portal (#100–#104): regressões dos
// 3 bugs reais encontrados nas sondas.
// 1) Cross-tenant: tenant B convidava fornecedor do tenant A na RFQ.
// 2) data_confirmada aceitava lixo ("not-a-date") na entrega.
// 3) Cotação aceitava item com preço negativo embutido.
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'
process.env.ENFORCE_RECEITA_PO = '0'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
let request, app, db, token, tokB, tokF1, f1

const D = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10)

beforeAll(async () => {
  const st = await import('supertest')
  request = st.default
  ;({ app, db } = await import('../server.js'))
  token = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token
  const m = r => r.set('Authorization', `Bearer ${token}`)
  f1 = (await m(request(app).post('/api/fornecedores')).send({ nome: 'Alfa T1', status: 'Homologado' })).body.data.id
  await m(request(app).post('/api/usuarios')).send({ nome: 'U', email: 'var1@f.com', senha: 'Aa@123456', perfil: 'fornecedor', fornecedor_id: f1, empresa_id: 1 })
  tokF1 = (await request(app).post('/api/auth/login').send({ email: 'var1@f.com', senha: 'Aa@123456' })).body?.data?.token
  const empB = (await m(request(app).post('/api/empresas')).send({ razao_social: 'Tenant B' })).body.data.id
  await m(request(app).post('/api/usuarios')).send({ nome: 'AdmB', email: 'var.b@x.com', senha: 'Aa@123456', perfil: 'admin', empresa_id: empB })
  tokB = (await request(app).post('/api/auth/login').send({ email: 'var.b@x.com', senha: 'Aa@123456' })).body?.data?.token
})

const asF1 = r => r.set('Authorization', `Bearer ${tokF1}`)

describe('BUG 1 — convite cross-tenant na RFQ', () => {
  it('tenant B NÃO consegue convidar fornecedor do tenant A (400)', async () => {
    const r = await request(app).post('/api/rfq').set('Authorization', `Bearer ${tokB}`)
      .send({ titulo: 'RFQ do Tenant B', prazo_resposta: D(5), fornecedor_ids: [f1] })
    expect(r.status).toBe(400)
    expect(r.body.error).toContain('não pertence')
    // E o fornecedor de A não vê nada no portal.
    const lista = await asF1(request(app).get('/api/portal/rfq'))
    expect(lista.body.data).toHaveLength(0)
  })
  it('convite dentro do próprio tenant segue funcionando', async () => {
    const r = await request(app).post('/api/rfq').set('Authorization', `Bearer ${token}`)
      .send({ titulo: 'RFQ legítima', prazo_resposta: D(5), fornecedor_ids: [f1] })
    expect(r.status).toBe(201)
  })
})

describe('BUG 2 — data lixo na confirmação de entrega', () => {
  let entregaId
  beforeAll(async () => {
    await request(app).post('/api/pedidos').set('Authorization', `Bearer ${token}`)
      .send({ fornecedor_id: f1, valor_total: 1000, prazo_entrega: D(10) })
    entregaId = (await asF1(request(app).get('/api/portal/entregas'))).body.data.entregas[0].id
  })
  it('"not-a-date" → 400 e nada gravado', async () => {
    const r = await asF1(request(app).post(`/api/portal/entregas/${entregaId}/confirmar`)).send({ data_confirmada: 'not-a-date', justificativa: 'x' })
    expect(r.status).toBe(400)
    const e = db.prepare(`SELECT data_confirmada FROM programacao_entregas WHERE id = ?`).get(entregaId)
    expect(e.data_confirmada).toBeNull()
  })
  it('data ISO válida segue passando', async () => {
    const r = await asF1(request(app).post(`/api/portal/entregas/${entregaId}/confirmar`)).send({ data_confirmada: D(20), justificativa: 'ajuste de produção' })
    expect(r.status).toBe(200)
  })
})

describe('BUG 3 — item com preço negativo na cotação', () => {
  let rfqId
  beforeAll(async () => {
    rfqId = (await request(app).post('/api/rfq').set('Authorization', `Bearer ${token}`)
      .send({ titulo: 'RFQ neg', prazo_resposta: D(5), fornecedor_ids: [f1] })).body.data.id
  })
  it('item negativo embutido → 400 (mesmo com total positivo)', async () => {
    const r = await asF1(request(app).post(`/api/portal/rfq/${rfqId}/cotacao`)).send({ itens: [
      { descricao: 'Item bom', quantidade: 1, valor_unitario: 1000 },
      { descricao: 'Desconto malicioso', quantidade: 1, valor_unitario: -900 },
    ]})
    expect(r.status).toBe(400)
    expect(r.body.error).toContain('Desconto malicioso')
  })
  it('quantidade zero → 400; itens sãos seguem passando', async () => {
    expect((await asF1(request(app).post(`/api/portal/rfq/${rfqId}/cotacao`)).send({ itens: [{ descricao: 'X', quantidade: 0, valor_unitario: 10 }] })).status).toBe(400)
    expect((await asF1(request(app).post(`/api/portal/rfq/${rfqId}/cotacao`)).send({ itens: [{ descricao: 'X', quantidade: 2, valor_unitario: 10 }] })).status).toBe(201)
  })
})

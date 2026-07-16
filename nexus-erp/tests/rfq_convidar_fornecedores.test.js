// ============================================================
// Testes — POST /api/rfq/:id/fornecedores (convidar fornecedores para uma RFQ
// já existente). Isolado por tenant, idempotente, valida entradas.
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
let request, app, token, tokenB, fornId, fornId2, empBFornId, rfqId

beforeAll(async () => {
  request = (await import('supertest')).default
  ;({ app } = await import('../server.js'))
  token = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token
  const auth = r => r.set('Authorization', `Bearer ${token}`)

  // Tenant B (para o teste de isolamento)
  const empB = (await auth(request(app).post('/api/empresas')).send({ razao_social: 'Tenant B' })).body.data.id
  await auth(request(app).post('/api/usuarios')).send({ nome: 'Admin B', email: 'rfqb@x.com', senha: 'Aa@123456', perfil: 'admin', empresa_id: empB })
  tokenB = (await request(app).post('/api/auth/login').send({ email: 'rfqb@x.com', senha: 'Aa@123456' })).body?.data?.token

  fornId  = (await auth(request(app).post('/api/fornecedores')).send({ nome: 'Aço Forte' })).body.data.id
  fornId2 = (await auth(request(app).post('/api/fornecedores')).send({ nome: 'Blindagem Sul' })).body.data.id
  empBFornId = (await request(app).post('/api/fornecedores').set('Authorization', `Bearer ${tokenB}`).send({ nome: 'Forn do B' })).body.data.id

  rfqId = (await auth(request(app).post('/api/rfq')).send({ titulo: 'Cotação de teste', valor_estimado: 5000 })).body.data.id
})

const auth = r => r.set('Authorization', `Bearer ${token}`)

describe('POST /api/rfq/:id/fornecedores', () => {
  it('convida fornecedores do tenant e retorna a lista', async () => {
    const r = await auth(request(app).post(`/api/rfq/${rfqId}/fornecedores`)).send({ fornecedor_ids: [fornId, fornId2] })
    expect(r.status).toBe(201)
    expect(r.body.data.convidados).toBe(2)
    expect(r.body.data.fornecedores.length).toBe(2)
  })

  it('idempotente: reconvidar não duplica', async () => {
    const r = await auth(request(app).post(`/api/rfq/${rfqId}/fornecedores`)).send({ fornecedor_ids: [fornId, fornId2] })
    expect(r.body.data.convidados).toBe(0)
    const full = (await auth(request(app).get(`/api/rfq/${rfqId}`))).body.data
    expect(full.fornecedores.length).toBe(2) // ainda 2, sem duplicar
  })

  it('lista vazia → 400', async () => {
    const r = await auth(request(app).post(`/api/rfq/${rfqId}/fornecedores`)).send({ fornecedor_ids: [] })
    expect(r.status).toBe(400)
  })

  it('fornecedor de OUTRO tenant → 400 (isolamento)', async () => {
    const r = await auth(request(app).post(`/api/rfq/${rfqId}/fornecedores`)).send({ fornecedor_ids: [empBFornId] })
    expect(r.status).toBe(400)
    expect(r.body.error).toMatch(/não pertence/i)
  })

  it('RFQ de outro tenant → 404 (não vaza)', async () => {
    const r = await request(app).post(`/api/rfq/${rfqId}/fornecedores`).set('Authorization', `Bearer ${tokenB}`).send({ fornecedor_ids: [empBFornId] })
    expect(r.status).toBe(404)
  })
})

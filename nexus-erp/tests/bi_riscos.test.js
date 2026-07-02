// ============================================================
// Testes — Relatório executivo de riscos no BI (/api/bi → riscos).
// Agrega as anomalias do motor por tipo/severidade e lista as
// principais ocorrências, escopado por tenant.
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
let request, app, token, tokenB

beforeAll(async () => {
  const st = await import('supertest')
  request = st.default
  ;({ app } = await import('../server.js'))
  token = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token
  const m = r => r.set('Authorization', `Bearer ${token}`)

  const empB = (await m(request(app).post('/api/empresas')).send({ razao_social: 'Tenant B' })).body.data.id
  await m(request(app).post('/api/usuarios')).send({ nome: 'Admin B', email: 'bi.b@x.com', senha: 'Aa@123456', perfil: 'admin', empresa_id: empB })
  tokenB = (await request(app).post('/api/auth/login').send({ email: 'bi.b@x.com', senha: 'Aa@123456' })).body?.data?.token

  // Fornecedor homologado + fracionamento no tenant A.
  await m(request(app).post('/api/usuarios')).send({ nome: 'Fin', email: 'fin.bi@x.com', senha: 'Aa@123456', perfil: 'financeiro' })
  await m(request(app).post('/api/usuarios')).send({ nome: 'Comp', email: 'comp.bi@x.com', senha: 'Aa@123456', perfil: 'compliance' })
  const fin = (await request(app).post('/api/auth/login').send({ email: 'fin.bi@x.com', senha: 'Aa@123456' })).body.data.token
  const comp = (await request(app).post('/api/auth/login').send({ email: 'comp.bi@x.com', senha: 'Aa@123456' })).body.data.token
  const fid = (await m(request(app).post('/api/fornecedores')).send({ nome: 'Risco BI Ltda' })).body.data.id
  await request(app).post(`/api/fornecedores/${fid}/homologar/financeiro`).set('Authorization', `Bearer ${fin}`).send({})
  await request(app).post(`/api/fornecedores/${fid}/homologar/compliance`).set('Authorization', `Bearer ${comp}`).send({})
  await m(request(app).post('/api/pedidos')).send({ fornecedor_id: fid, valor_total: 30000 })
  await m(request(app).post('/api/pedidos')).send({ fornecedor_id: fid, valor_total: 30000 })
})

const auth = r => r.set('Authorization', `Bearer ${token}`)

describe('/api/bi → seção riscos', () => {
  it('agrega as anomalias por tipo com contagem de severidade alta', async () => {
    const r = await auth(request(app).get('/api/bi'))
    expect(r.status).toBe(200)
    const riscos = r.body.data.riscos
    expect(riscos.total).toBeGreaterThanOrEqual(1)
    expect(riscos.alta).toBeGreaterThanOrEqual(1)
    expect(riscos.por_tipo.fracionamento).toBe(1)
  })

  it('lista as principais ocorrências com título e severidade', async () => {
    const r = await auth(request(app).get('/api/bi'))
    const principais = r.body.data.riscos.principais
    expect(principais.length).toBeGreaterThanOrEqual(1)
    expect(principais[0].titulo).toMatch(/Risco BI Ltda|fracionamento/i)
    expect(['alta', 'media']).toContain(principais[0].severidade)
  })

  it('tenant B tem riscos zerados (isolamento)', async () => {
    const r = await request(app).get('/api/bi').set('Authorization', `Bearer ${tokenB}`)
    expect(r.status).toBe(200)
    expect(r.body.data.riscos.total).toBe(0)
    expect(r.body.data.riscos.principais).toEqual([])
  })
})

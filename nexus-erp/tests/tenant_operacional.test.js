// ============================================================
// Testes — Isolamento por tenant de Contratos, CRM, Projetos, WBS e
// Propostas. Módulos operacionais que o cliente mais usa: nenhum vaza
// nem pode ser manipulado por outra empresa.
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
let request, app, tokenA, tokenB
const A = {}

beforeAll(async () => {
  const st = await import('supertest')
  request = st.default
  ;({ app } = await import('../server.js'))
  tokenA = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token
  const m = r => r.set('Authorization', `Bearer ${tokenA}`)
  const empB = (await m(request(app).post('/api/empresas')).send({ razao_social: 'Tenant B' })).body.data.id
  await m(request(app).post('/api/usuarios')).send({ nome: 'Admin B', email: 'opb@x.com', senha: 'Aa@123456', perfil: 'admin', empresa_id: empB })
  tokenB = (await request(app).post('/api/auth/login').send({ email: 'opb@x.com', senha: 'Aa@123456' })).body?.data?.token

  A.contrato = (await m(request(app).post('/api/contratos')).send({ titulo: 'Contrato A' })).body.data.id
  A.lead = (await m(request(app).post('/api/crm')).send({ titulo: 'Lead A', cliente: 'ACME' })).body.data.id
  A.projeto = (await m(request(app).post('/api/projetos')).send({ nome: 'Projeto A' })).body.data.id
  A.wbs = (await m(request(app).post('/api/wbs')).send({ codigo: '1.1', descricao: 'Linha A', lead_id: A.lead, origem: 'orcamentacao', valor_total_est: 1000 })).body.data.id
})

const asA = r => r.set('Authorization', `Bearer ${tokenA}`)
const asB = r => r.set('Authorization', `Bearer ${tokenB}`)

describe('Contratos', () => {
  it('lista de B não inclui o contrato de A; A vê o próprio', async () => {
    expect((await asB(request(app).get('/api/contratos'))).body.data.some(c => c.id === A.contrato)).toBe(false)
    expect((await asA(request(app).get('/api/contratos'))).body.data.some(c => c.id === A.contrato)).toBe(true)
  })
  it('B não edita o contrato de A → 404', async () => {
    expect((await asB(request(app).put(`/api/contratos/${A.contrato}`)).send({ titulo: 'x' })).status).toBe(404)
  })
})

describe('CRM', () => {
  it('lista de B não inclui o lead de A', async () => {
    expect((await asB(request(app).get('/api/crm'))).body.data.some(c => c.id === A.lead)).toBe(false)
  })
  it('B não edita nem exclui o lead de A → 404', async () => {
    expect((await asB(request(app).put(`/api/crm/${A.lead}`)).send({ titulo: 'x', cliente: 'y' })).status).toBe(404)
    expect((await asB(request(app).delete(`/api/crm/${A.lead}`))).status).toBe(404)
  })
  it('orcamentação de B não lista leads de A', async () => {
    const r = await asB(request(app).get('/api/crm/orcamentacao?status=pendente'))
    expect(r.body.data.some(l => l.id === A.lead)).toBe(false)
  })
})

describe('Projetos', () => {
  it('lista de B não inclui o projeto de A', async () => {
    expect((await asB(request(app).get('/api/projetos'))).body.data.some(p => p.id === A.projeto)).toBe(false)
  })
  it('B não edita o projeto de A → 404', async () => {
    expect((await asB(request(app).put(`/api/projetos/${A.projeto}`)).send({ nome: 'x' })).status).toBe(404)
  })
})

describe('WBS', () => {
  it('lista de B não inclui a linha de A; A vê a própria', async () => {
    expect((await asB(request(app).get('/api/wbs?ativo=todos'))).body.data.some(w => w.id === A.wbs)).toBe(false)
    expect((await asA(request(app).get('/api/wbs?ativo=todos'))).body.data.some(w => w.id === A.wbs)).toBe(true)
  })
  it('B não edita nem exclui a linha de A → 404', async () => {
    expect((await asB(request(app).put(`/api/wbs/${A.wbs}`)).send({ quantidade: 9 })).status).toBe(404)
    expect((await asB(request(app).delete(`/api/wbs/${A.wbs}`))).status).toBe(404)
  })
  it('rollup de B não soma a WBS de A', async () => {
    const r = await asB(request(app).get('/api/wbs/rollup'))
    expect(r.body.data.total.estimado).toBe(0)
  })
})

describe('Propostas', () => {
  it('B NÃO gera proposta a partir do lead de A (lead fora do tenant → 409)', async () => {
    const r = await asB(request(app).post('/api/propostas')).send({ lead_id: A.lead, margem: 10 })
    expect(r.status).toBe(409)
  })
  it('A gera proposta do próprio lead (com estimativa WBS) → 201', async () => {
    const r = await asA(request(app).post('/api/propostas')).send({ lead_id: A.lead, margem: 20 })
    expect(r.status).toBe(201)
    expect(r.body.data.valor_total).toBe(1200)
  })
  it('lista de propostas de B não vê a de A', async () => {
    expect((await asB(request(app).get('/api/propostas'))).body.data.length).toBe(0)
  })
})

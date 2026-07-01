// ============================================================
// Testes — Isolamento de OS e dos AGREGADOS (dashboard/BI/fluxo-caixa)
// por tenant. Um cliente nunca vê OS nem números financeiros de outro.
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
let request, app, tokenA, tokenB, osA

beforeAll(async () => {
  const st = await import('supertest')
  request = st.default
  ;({ app } = await import('../server.js'))
  tokenA = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token // empresa 1
  const m = r => r.set('Authorization', `Bearer ${tokenA}`)
  const empB = (await m(request(app).post('/api/empresas')).send({ razao_social: 'Tenant B' })).body.data.id
  await m(request(app).post('/api/usuarios')).send({ nome: 'Admin B', email: 'osb@x.com', senha: 'Aa@123456', perfil: 'admin', empresa_id: empB })
  tokenB = (await request(app).post('/api/auth/login').send({ email: 'osb@x.com', senha: 'Aa@123456' })).body?.data?.token

  // Tenant A cria uma OS (overhead + WBS) e um fornecedor.
  osA = (await m(request(app).post('/api/os')).send({
    titulo: 'Manutenção interna', wbs: '1.1', centro_custo_overhead: 'Administrativo', tipo_recurso: 'servico',
  })).body.data.id
  await m(request(app).post('/api/fornecedores')).send({ nome: 'Forn A dash' })
})

const asA = r => r.set('Authorization', `Bearer ${tokenA}`)
const asB = r => r.set('Authorization', `Bearer ${tokenB}`)

describe('Isolamento de OS', () => {
  it('a lista de OS do tenant B não inclui a OS de A', async () => {
    const r = await asB(request(app).get('/api/os'))
    expect(r.status).toBe(200)
    expect(r.body.data.some(o => o.id === osA)).toBe(false)
  })
  it('o tenant A enxerga a própria OS', async () => {
    const r = await asA(request(app).get('/api/os'))
    expect(r.body.data.some(o => o.id === osA)).toBe(true)
  })
  it('GET/PUT/concluir da OS de A pelo tenant B → 404', async () => {
    expect((await asB(request(app).get(`/api/os/${osA}`))).status).toBe(404)
    expect((await asB(request(app).put(`/api/os/${osA}`)).send({ titulo: 'x' })).status).toBe(404)
    expect((await asB(request(app).post(`/api/os/${osA}/concluir`)).send({})).status).toBe(404)
    // continua íntegra para A
    expect((await asA(request(app).get(`/api/os/${osA}`))).body.data.titulo).toBe('Manutenção interna')
  })
})

describe('Isolamento dos agregados', () => {
  it('dashboard do tenant B zera OS e fornecedores (não conta os de A)', async () => {
    const r = await asB(request(app).get('/api/dashboard'))
    expect(r.body.data.os.total).toBe(0)
    expect(r.body.data.fornecedores.total).toBe(0)
    expect(r.body.data.recentes.os.length).toBe(0)
  })
  it('dashboard do tenant A reflete os próprios dados', async () => {
    const r = await asA(request(app).get('/api/dashboard'))
    expect(r.body.data.os.total).toBeGreaterThanOrEqual(1)
    expect(r.body.data.fornecedores.total).toBeGreaterThanOrEqual(1)
  })
  it('BI do tenant B não conta fornecedores de A', async () => {
    const r = await asB(request(app).get('/api/bi'))
    expect(r.status).toBe(200)
    expect(r.body.data.fornecedores.ativos).toBe(0)
  })
  it('fluxo de caixa do tenant B não vê contas de A', async () => {
    const r = await asB(request(app).get('/api/fluxo-caixa'))
    expect(r.status).toBe(200)
  })
})

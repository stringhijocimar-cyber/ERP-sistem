// ============================================================
// Testes — RH: colaboradores (custo/hora), apontamento de horas
// (gera custo), rollup por contrato e ELO com a DRE real (mão de obra
// compõe o custo dos serviços). Isolamento por tenant.
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
let request, app, db, token, tokenB, colabId

beforeAll(async () => {
  const st = await import('supertest')
  request = st.default
  ;({ app, db } = await import('../server.js'))
  token = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token
  const m = r => r.set('Authorization', `Bearer ${token}`)
  const empB = (await m(request(app).post('/api/empresas')).send({ razao_social: 'Tenant B' })).body.data.id
  await m(request(app).post('/api/usuarios')).send({ nome: 'Admin B', email: 'rh.b@x.com', senha: 'Aa@123456', perfil: 'admin', empresa_id: empB })
  tokenB = (await request(app).post('/api/auth/login').send({ email: 'rh.b@x.com', senha: 'Aa@123456' })).body?.data?.token
})

const auth = r => r.set('Authorization', `Bearer ${token}`)

describe('colaboradores CRUD', () => {
  it('cria colaborador com custo/hora', async () => {
    const r = await auth(request(app).post('/api/colaboradores')).send({ nome: 'João Operador', cargo: 'Operador', custo_hora: 50, departamento: 'Operações' })
    expect(r.status).toBe(201)
    expect(r.body.data.custo_hora).toBe(50)
    colabId = r.body.data.id
  })
  it('sem nome → 400', async () => {
    const r = await auth(request(app).post('/api/colaboradores')).send({ cargo: 'X' })
    expect(r.status).toBe(400)
  })
  it('custo/hora negativo → 400', async () => {
    const r = await auth(request(app).post('/api/colaboradores')).send({ nome: 'Y', custo_hora: -1 })
    expect(r.status).toBe(400)
  })
  it('lista traz o colaborador criado', async () => {
    const r = await auth(request(app).get('/api/colaboradores'))
    expect(r.body.data.some(c => c.nome === 'João Operador')).toBe(true)
  })
})

describe('apontamento de horas', () => {
  it('gera custo = horas × custo/hora (com snapshot)', async () => {
    const r = await auth(request(app).post('/api/apontamentos-hora')).send({ colaborador_id: colabId, contrato_id: 'CT-1', data: '2026-05-10', horas: 8 })
    expect(r.status).toBe(201)
    expect(r.body.data.custo).toBe(400) // 8 × 50
    expect(r.body.data.custo_hora).toBe(50)
  })
  it('snapshot: mudar o custo/hora do colaborador não altera apontamento antigo', async () => {
    await auth(request(app).put(`/api/colaboradores/${colabId}`)).send({ custo_hora: 80 })
    const novo = await auth(request(app).post('/api/apontamentos-hora')).send({ colaborador_id: colabId, contrato_id: 'CT-1', data: '2026-05-11', horas: 10 })
    expect(novo.body.data.custo).toBe(800) // 10 × 80 (novo custo)
    const antigo = (await auth(request(app).get('/api/apontamentos-hora?contrato_id=CT-1'))).body.data.find(a => a.data === '2026-05-10')
    expect(antigo.custo).toBe(400) // permanece no custo antigo
  })
  it('horas <= 0 → 400', async () => {
    const r = await auth(request(app).post('/api/apontamentos-hora')).send({ colaborador_id: colabId, horas: 0 })
    expect(r.status).toBe(400)
  })
  it('colaborador inexistente → 404', async () => {
    const r = await auth(request(app).post('/api/apontamentos-hora')).send({ colaborador_id: 99999, horas: 5 })
    expect(r.status).toBe(404)
  })
})

describe('rollup por contrato', () => {
  it('soma custo e horas do contrato, com quebra por colaborador', async () => {
    const r = await auth(request(app).get('/api/contratos/CT-1/custo-mao-de-obra'))
    expect(r.body.data.custo_total).toBe(1200) // 400 + 800
    expect(r.body.data.horas_total).toBe(18)   // 8 + 10
    expect(r.body.data.por_colaborador[0].nome).toBe('João Operador')
  })
})

describe('ELO com a DRE real', () => {
  it('mão de obra apontada entra no custo dos serviços da DRE', async () => {
    const dre = (await auth(request(app).get('/api/dre?ano=2026&mes=5'))).body.data
    expect(dre.custo_mao_obra).toBe(1200)
    expect(dre.horas_mao_obra).toBe(18)
    // custos totais = pedidos (0 aqui) + mão de obra (1200)
    expect(dre.custos).toBe(1200)
    expect(dre.linhas.some(l => l.label.includes('Mão de Obra') && l.valor === -1200)).toBe(true)
  })
})

describe('isolamento por tenant', () => {
  it('tenant B não vê colaboradores de A', async () => {
    const r = await request(app).get('/api/colaboradores').set('Authorization', `Bearer ${tokenB}`)
    expect(r.body.data).toHaveLength(0)
  })
  it('tenant B não aponta horas para colaborador de A (404)', async () => {
    const r = await request(app).post('/api/apontamentos-hora').set('Authorization', `Bearer ${tokenB}`).send({ colaborador_id: colabId, horas: 5 })
    expect(r.status).toBe(404)
  })
  it('DRE do tenant B não enxerga a mão de obra de A', async () => {
    const dre = (await request(app).get('/api/dre?ano=2026&mes=5').set('Authorization', `Bearer ${tokenB}`)).body.data
    expect(dre.custo_mao_obra).toBe(0)
  })
})

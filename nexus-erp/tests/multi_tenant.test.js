// ============================================================
// Testes — Multi-tenant (isolamento por empresa).
// Fundação SaaS: o escopo vem SEMPRE de req.user.empresa_id. Dois
// tenants não enxergam os dados um do outro no /sync genérico, e só o
// tenant mestre (empresa 1) provisiona novas empresas/usuários.
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
let request, app, masterToken, tokenB, empresaBId

beforeAll(async () => {
  const st = await import('supertest')
  request = st.default
  ;({ app } = await import('../server.js'))
  masterToken = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token
  const m = r => r.set('Authorization', `Bearer ${masterToken}`)
  // Master (empresa 1) provisiona uma segunda empresa e um admin dela.
  empresaBId = (await m(request(app).post('/api/empresas')).send({ razao_social: 'Cliente B S.A.', nome_fantasia: 'B' })).body.data.id
  await m(request(app).post('/api/usuarios')).send({ nome: 'Admin B', email: 'admin.b@x.com', senha: 'Aa@123456', perfil: 'admin', empresa_id: empresaBId })
  tokenB = (await request(app).post('/api/auth/login').send({ email: 'admin.b@x.com', senha: 'Aa@123456' })).body?.data?.token
})

const asMaster = r => r.set('Authorization', `Bearer ${masterToken}`)
const asB = r => r.set('Authorization', `Bearer ${tokenB}`)

describe('Multi-tenant — provisionamento', () => {
  it('empresa padrão (mestre) existe e é a do admin seed', async () => {
    const r = await asMaster(request(app).get('/api/empresas/atual'))
    expect(r.status).toBe(200)
    expect(r.body.data.id).toBe(1)
  })

  it('segunda empresa foi criada com id != 1', () => {
    expect(empresaBId).toBeGreaterThan(1)
  })

  it('admin do tenant B enxerga apenas a própria empresa', async () => {
    const r = await asB(request(app).get('/api/empresas'))
    expect(r.body.data.length).toBe(1)
    expect(r.body.data[0].id).toBe(empresaBId)
  })

  it('tenant mestre enxerga todas as empresas', async () => {
    const r = await asMaster(request(app).get('/api/empresas'))
    expect(r.body.data.length).toBeGreaterThanOrEqual(2)
  })

  it('tenant não-mestre NÃO pode criar empresas (403)', async () => {
    const r = await asB(request(app).post('/api/empresas')).send({ razao_social: 'Pirata' })
    expect(r.status).toBe(403)
  })
})

describe('Multi-tenant — isolamento de dados no /sync', () => {
  it('cada empresa só enxerga os próprios contratos', async () => {
    await asMaster(request(app).post('/api/contratos/sync')).send({ data: [{ id: 'CT-A', titulo: 'Contrato do tenant A' }] })
    await asB(request(app).post('/api/contratos/sync')).send({ data: [{ id: 'CT-B', titulo: 'Contrato do tenant B' }] })

    const a = await asMaster(request(app).get('/api/contratos/sync'))
    const b = await asB(request(app).get('/api/contratos/sync'))
    expect(a.body.data.map(x => x.id)).toEqual(['CT-A'])
    expect(b.body.data.map(x => x.id)).toEqual(['CT-B'])
  })

  it('mesmo item_id em empresas diferentes não colide', async () => {
    await asMaster(request(app).post('/api/projetos/sync')).send({ data: [{ id: 'P-1', nome: 'Projeto A' }] })
    await asB(request(app).post('/api/projetos/sync')).send({ data: [{ id: 'P-1', nome: 'Projeto B' }] })
    const a = await asMaster(request(app).get('/api/projetos/sync'))
    const b = await asB(request(app).get('/api/projetos/sync'))
    expect(a.body.data.find(x => x.id === 'P-1').nome).toBe('Projeto A')
    expect(b.body.data.find(x => x.id === 'P-1').nome).toBe('Projeto B')
  })

  it('o escopo ignora empresa_id enviado no corpo (não spoofável)', async () => {
    // B tenta marcar o item como empresa 1 no corpo — deve continuar no tenant B.
    await asB(request(app).post('/api/crm/sync')).send({ data: [{ id: 'L-9', empresa_id: 1, titulo: 'Lead B' }] })
    const a = await asMaster(request(app).get('/api/crm/sync'))
    expect(a.body.data.some(x => x.id === 'L-9')).toBe(false)
    const b = await asB(request(app).get('/api/crm/sync'))
    expect(b.body.data.some(x => x.id === 'L-9')).toBe(true)
  })
})

describe('Multi-tenant — usuários herdam a empresa do criador', () => {
  it('admin do tenant B cria usuário que cai no tenant B (override ignorado)', async () => {
    await asB(request(app).post('/api/usuarios')).send({ nome: 'Op B', email: 'op.b@x.com', senha: 'Aa@123456', perfil: 'operacao', empresa_id: 1 })
    const opToken = (await request(app).post('/api/auth/login').send({ email: 'op.b@x.com', senha: 'Aa@123456' })).body?.data?.token
    const r = await request(app).get('/api/empresas/atual').set('Authorization', `Bearer ${opToken}`)
    expect(r.body.data.id).toBe(empresaBId)
  })
})

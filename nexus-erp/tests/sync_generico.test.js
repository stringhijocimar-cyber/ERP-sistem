// ============================================================
// Testes — /sync genérico (Express): persiste arrays do front
// (RC/RFQ/mapas/contratos/projetos antes falhavam em 404 silencioso)
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
let request, app, token

beforeAll(async () => {
  const st = await import('supertest')
  request = st.default
  ;({ app } = await import('../server.js'))
  token = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token
})

const auth = r => r.set('Authorization', `Bearer ${token}`)

describe('/sync genérico', () => {
  it('POST /api/contratos/sync persiste e GET retorna o array', async () => {
    const data = [
      { id: 'CT-1', titulo: 'Contrato A', valor: 1000 },
      { id: 'CT-2', titulo: 'Contrato B', valor: 2000 },
    ]
    const p = await auth(request(app).post('/api/contratos/sync')).send({ data })
    expect(p.status).toBe(200)
    expect(p.body.data.synced).toBe(2)
    const g = await auth(request(app).get('/api/contratos/sync'))
    expect(g.status).toBe(200)
    expect(g.body.data.length).toBe(2)
    const ids = g.body.data.map(x => x.id).sort()
    expect(ids).toEqual(['CT-1', 'CT-2'])
  })

  it('POST /api/rc/sync funciona (entidade antes sem persistência)', async () => {
    const p = await auth(request(app).post('/api/rc/sync')).send({ data: [{ numero: 'RC-001', tipo: 'Material' }] })
    expect(p.status).toBe(200)
    expect(p.body.data.synced).toBe(1)
    const g = await auth(request(app).get('/api/rc/sync'))
    expect(g.body.data.some(x => x.numero === 'RC-001')).toBe(true)
  })

  it('upsert: re-sincronizar o mesmo id atualiza, não duplica', async () => {
    await auth(request(app).post('/api/projetos/sync')).send({ data: [{ id: 'P-9', nome: 'v1' }] })
    await auth(request(app).post('/api/projetos/sync')).send({ data: [{ id: 'P-9', nome: 'v2' }] })
    const g = await auth(request(app).get('/api/projetos/sync'))
    const p9 = g.body.data.filter(x => x.id === 'P-9')
    expect(p9.length).toBe(1)
    expect(p9[0].nome).toBe('v2')
  })

  it('item sem id usa numero como chave', async () => {
    await auth(request(app).post('/api/mapas/sync')).send({ data: [{ numero: 'MAP-7', total: 50 }] })
    const g = await auth(request(app).get('/api/mapas/sync'))
    expect(g.body.data.some(x => x.numero === 'MAP-7')).toBe(true)
  })

  it('404 para entidade não permitida', async () => {
    const p = await auth(request(app).post('/api/hackzone/sync')).send({ data: [{ id: 1 }] })
    expect(p.status).toBe(404)
    const g = await auth(request(app).get('/api/hackzone/sync'))
    expect(g.status).toBe(404)
  })

  it('exige autenticação', async () => {
    const p = await request(app).post('/api/contratos/sync').send({ data: [] })
    expect(p.status).toBe(401)
  })

  it('body sem data não quebra (synced 0)', async () => {
    const p = await auth(request(app).post('/api/crm/sync')).send({})
    expect(p.status).toBe(200)
    expect(p.body.data.synced).toBe(0)
  })
})

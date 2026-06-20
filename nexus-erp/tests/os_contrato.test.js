// ============================================================
// Testes — A2: OS amarrada a Contrato/Overhead + WBS coerente + Mão de Obra
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
let request, app, db, token, wbsContrato10

beforeAll(async () => {
  const st = await import('supertest')
  request = st.default
  ;({ app, db } = await import('../server.js'))
  token = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token
  // Linha WBS pertencente ao contrato 10.
  wbsContrato10 = (await request(app).post('/api/wbs').set('Authorization', `Bearer ${token}`)
    .send({ codigo: '1.1', descricao: 'MOD', contrato_id: 10 })).body.data.id
})

const novaOS = body => request(app).post('/api/os').set('Authorization', `Bearer ${token}`).send(body)

describe('OS — amarração a contrato/overhead', () => {
  it('bloqueia OS sem contrato nem overhead (400)', async () => {
    const r = await novaOS({ titulo: 'Sem amarra', wbs: '1.0' })
    expect(r.status).toBe(400)
    expect(r.body.error).toMatch(/contrato|overhead/i)
  })

  it('aceita OS vinculada a contrato', async () => {
    const r = await novaOS({ titulo: 'Com contrato', wbs: '1.0', contrato_id: 10 })
    expect(r.status).toBe(201)
    expect(r.body.data.contrato_id).toBe(10)
  })

  it('aceita OS administrativa por centro de custo de overhead', async () => {
    const r = await novaOS({ titulo: 'Admin', wbs: '1.0', centro_custo_overhead: 'Administrativo' })
    expect(r.status).toBe(201)
    expect(r.body.data.centro_custo_overhead).toBe('Administrativo')
  })

  it('rejeita overhead fora da lista (400)', async () => {
    const r = await novaOS({ titulo: 'X', wbs: '1.0', centro_custo_overhead: 'Inexistente' })
    expect(r.status).toBe(400)
  })

  it('lista de overhead disponível por endpoint', async () => {
    const r = await request(app).get('/api/overhead-centros').set('Authorization', `Bearer ${token}`)
    expect(r.body.data).toContain('Administrativo')
  })
})

describe('OS — WBS deve pertencer ao contrato', () => {
  it('aceita WBS do mesmo contrato', async () => {
    const r = await novaOS({ titulo: 'OK', wbs: '1.1', contrato_id: 10, wbs_linha_id: wbsContrato10 })
    expect(r.status).toBe(201)
    expect(r.body.data.wbs_linha_id).toBe(wbsContrato10)
  })

  it('bloqueia WBS de outro contrato (409)', async () => {
    const r = await novaOS({ titulo: 'Errada', wbs: '1.1', contrato_id: 99, wbs_linha_id: wbsContrato10 })
    expect(r.status).toBe(409)
    expect(r.body.error).toMatch(/contrato/i)
  })

  it('bloqueia WBS inexistente (400)', async () => {
    const r = await novaOS({ titulo: 'Fantasma', wbs: '1.1', contrato_id: 10, wbs_linha_id: 999999 })
    expect(r.status).toBe(400)
  })
})

describe('OS — tipo de recurso (inclui Mão de Obra)', () => {
  it('aceita tipo mao_obra', async () => {
    const r = await novaOS({ titulo: 'Só MO', wbs: '1.0', contrato_id: 10, tipo_recurso: 'mao_obra' })
    expect(r.status).toBe(201)
    expect(r.body.data.tipo_recurso).toBe('mao_obra')
  })

  it('rejeita tipo de recurso inválido (400)', async () => {
    const r = await novaOS({ titulo: 'X', wbs: '1.0', contrato_id: 10, tipo_recurso: 'foo' })
    expect(r.status).toBe(400)
  })

  it('default do tipo é material', async () => {
    const r = await novaOS({ titulo: 'Default', wbs: '1.0', contrato_id: 10 })
    expect(r.body.data.tipo_recurso).toBe('material')
  })
})

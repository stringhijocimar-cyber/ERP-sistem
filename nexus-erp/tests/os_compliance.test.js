// ============================================================
// Testes de integração — OS: WBS obrigatória (compliance Onda 1)
// Rastreabilidade de custo na origem da demanda: toda OS precisa de vínculo WBS.
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

const novaOS = body => request(app).post('/api/os').set('Authorization', `Bearer ${token}`).send(body)

describe('OS — WBS obrigatória', () => {
  it('bloqueia OS sem WBS (400)', async () => {
    const r = await novaOS({ titulo: 'Troca de rolamento' })
    expect(r.status).toBe(400)
    expect(r.body.error || r.body.message).toMatch(/wbs/i)
  })

  it('bloqueia WBS em branco (400)', async () => {
    const r = await novaOS({ titulo: 'Inspeção', wbs: '   ' })
    expect(r.status).toBe(400)
  })

  it('ainda exige título (400)', async () => {
    const r = await novaOS({ wbs: '1.0' })
    expect(r.status).toBe(400)
  })

  it('grava a WBS (aparada) quando válida', async () => {
    const r = await novaOS({ titulo: 'Parada programada', wbs: '  4.2.1  ' })
    expect(r.status).toBe(201)
    expect(r.body.data.wbs).toBe('4.2.1')
  })
})

describe('OS — PUT preserva WBS', () => {
  let osId
  beforeAll(async () => {
    osId = (await novaOS({ titulo: 'Manutenção', wbs: '5.0' })).body.data.id
  })

  it('não permite remover a WBS (400)', async () => {
    const r = await request(app).put(`/api/os/${osId}`).set('Authorization', `Bearer ${token}`).send({ titulo: 'Manutenção', wbs: '' })
    expect(r.status).toBe(400)
  })

  it('mantém a WBS anterior quando omitida e atualiza quando enviada', async () => {
    const keep = await request(app).put(`/api/os/${osId}`).set('Authorization', `Bearer ${token}`).send({ titulo: 'Manutenção', status: 'Em andamento' })
    expect(keep.body.data.wbs).toBe('5.0')
    const upd = await request(app).put(`/api/os/${osId}`).set('Authorization', `Bearer ${token}`).send({ titulo: 'Manutenção', wbs: '5.1' })
    expect(upd.body.data.wbs).toBe('5.1')
  })
})

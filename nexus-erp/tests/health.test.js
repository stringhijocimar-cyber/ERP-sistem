// ============================================================
// Testes — /api/health público + dashboard protegido.
// O health-check é o único endpoint aberto (sem dados); o dashboard
// exige token (e no Worker passou a contar só o tenant do usuário —
// antes era público e vazava contadores globais).
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

describe('/api/health', () => {
  it('é público e responde ok sem token', async () => {
    const r = await request(app).get('/api/health')
    expect(r.status).toBe(200)
    expect(r.body.data.ok).toBe(true)
  })

  it('não vaza nenhum dado além do ok', async () => {
    const r = await request(app).get('/api/health')
    expect(Object.keys(r.body.data)).toEqual(['ok'])
  })
})

describe('/api/dashboard continua protegido', () => {
  it('sem token → 401', async () => {
    const r = await request(app).get('/api/dashboard')
    expect(r.status).toBe(401)
  })

  it('com token → 200 (controle)', async () => {
    const r = await request(app).get('/api/dashboard').set('Authorization', `Bearer ${token}`)
    expect(r.status).toBe(200)
    expect(r.body.data.os).toBeTruthy()
  })
})

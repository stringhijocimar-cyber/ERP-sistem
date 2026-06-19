// Testes de integração — consulta a bureau de crédito (Express).
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

describe('POST /api/credito/consultar', () => {
  it('retorna score e situação para CNPJ válido', async () => {
    const r = await request(app).post('/api/credito/consultar')
      .set('Authorization', `Bearer ${token}`).send({ cnpj: '11.222.333/0001-81' })
    expect(r.status).toBe(200)
    expect(r.body.data.score_externo).toBeGreaterThanOrEqual(300)
    expect(['ATIVA', 'INAPTA']).toContain(r.body.data.situacao)
  })

  it('rejeita CNPJ inválido (400)', async () => {
    const r = await request(app).post('/api/credito/consultar')
      .set('Authorization', `Bearer ${token}`).send({ cnpj: '123' })
    expect(r.status).toBe(400)
  })

  it('exige autenticação (401)', async () => {
    const r = await request(app).post('/api/credito/consultar').send({ cnpj: '11.222.333/0001-81' })
    expect(r.status).toBe(401)
  })
})

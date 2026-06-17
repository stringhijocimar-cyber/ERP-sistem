// ============================================================
// Testes de integração — Numeração atômica (Express)
// Garante sequência única e crescente por tipo/ano (sem corrida length+1).
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
  const r = await request(app).post('/api/auth/login').send(ADMIN)
  token = r.body?.data?.token
})

const seq = (tipo, ano) =>
  request(app).post('/api/sequencia/' + tipo).set('Authorization', `Bearer ${token}`).send({ ano })

describe('POST /api/sequencia/:tipo', () => {
  it('gera números crescentes e formatados', async () => {
    const a = await seq('PC', 2026)
    const b = await seq('PC', 2026)
    expect(a.status).toBe(200)
    expect(a.body.data.numero).toBe('PC-2026-0001')
    expect(b.body.data.numero).toBe('PC-2026-0002')
  })

  it('sequências por tipo são independentes', async () => {
    const rc = await seq('RC', 2026)
    expect(rc.body.data.numero).toBe('RC-2026-0001') // não herda a contagem de PC
  })

  it('rejeita tipo inválido (400)', async () => {
    const r = await seq('HACK', 2026)
    expect(r.status).toBe(400)
  })

  it('100 chamadas concorrentes produzem 100 números ÚNICOS (sem corrida)', async () => {
    const N = 100
    const res = await Promise.all(Array.from({ length: N }, () => seq('RFQ', 2030)))
    const nums = res.map(r => r.body.data.numero)
    const unicos = new Set(nums)
    expect(unicos.size).toBe(N)                  // nenhuma duplicata
    expect(Math.max(...res.map(r => r.body.data.valor))).toBe(N) // contíguo 1..N
  })
})

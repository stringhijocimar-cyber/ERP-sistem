// ============================================================
// Testes — CORS: same-origin é sempre permitido (SPA servida pelo próprio
// backend), o allowlist controla cross-origin, e a detecção de same-origin usa
// SOMENTE o header Host real (nunca X-Forwarded-Host, que seria forjável).
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'
process.env.ALLOWED_ORIGINS = 'https://permitido.example.com'

let request, app

beforeAll(async () => {
  request = (await import('supertest')).default
  ;({ app } = await import('../server.js'))
})

const health = () => request(app).get('/api/health')

describe('CORS — same-origin sempre permitido', () => {
  it('sem header Origin (curl / same-host) → permitido', async () => {
    const r = await health()
    expect(r.status).toBe(200)
    expect(r.body.data.ok).toBe(true)
  })

  it('Origin cujo host == Host do request (same-origin) → permitido', async () => {
    const r = await health().set('Host', 'meuapp.example.com').set('Origin', 'https://meuapp.example.com')
    expect(r.status).toBe(200)
    expect(r.headers['access-control-allow-origin']).toBe('https://meuapp.example.com')
  })

  it('Origin no ALLOWED_ORIGINS (cross-origin explícito) → permitido', async () => {
    const r = await health().set('Host', 'interno').set('Origin', 'https://permitido.example.com')
    expect(r.status).toBe(200)
    expect(r.headers['access-control-allow-origin']).toBe('https://permitido.example.com')
  })
})

describe('CORS — cross-origin real continua bloqueado', () => {
  it('Origin de outro host, fora do allowlist → rejeitado', async () => {
    const r = await health().set('Host', 'meuapp.example.com').set('Origin', 'https://evil.example.com')
    expect(r.status).toBe(500) // cors chama cb(Error) → handler padrão do Express
  })

  it('X-Forwarded-Host NÃO é aceito como prova de same-origin (não é forjável para burlar)', async () => {
    // Atacante em evil.com tentando forjar o proxy header para casar com a Origin.
    const r = await health()
      .set('Host', 'meuapp.example.com')
      .set('X-Forwarded-Host', 'evil.example.com')
      .set('Origin', 'https://evil.example.com')
    expect(r.status).toBe(500) // Host real != evil.example.com → bloqueado
  })
})

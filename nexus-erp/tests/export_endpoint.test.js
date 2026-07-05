// ============================================================
// Testes — exportação CSV: /api/dre/export.csv e
// /api/dashboard-financeiro/export.csv (headers + conteúdo + tenant).
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
let request, app, db, token

beforeAll(async () => {
  const st = await import('supertest')
  request = st.default
  ;({ app, db } = await import('../server.js'))
  token = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token
  const ano = new Date().getFullYear()
  db.prepare(`INSERT INTO contas_receber(numero, cliente, valor, data_emissao, status, empresa_id) VALUES('CR-E','Cli',300000,?,'A Receber',1)`).run(`${ano}-04-10`)
})

const auth = r => r.set('Authorization', `Bearer ${token}`)

describe('/api/dre/export.csv', () => {
  it('retorna text/csv com Content-Disposition e conteúdo da DRE', async () => {
    const r = await auth(request(app).get('/api/dre/export.csv'))
    expect(r.status).toBe(200)
    expect(r.headers['content-type']).toMatch(/text\/csv/)
    expect(r.headers['content-disposition']).toMatch(/attachment; filename="dre-.*\.csv"/)
    expect(r.text).toContain('Receita Bruta de Serviços')
  })
})

describe('/api/dashboard-financeiro/export.csv', () => {
  it('retorna CSV do dashboard com indicadores', async () => {
    const r = await auth(request(app).get('/api/dashboard-financeiro/export.csv'))
    expect(r.status).toBe(200)
    expect(r.headers['content-disposition']).toMatch(/dashboard-financeiro-.*\.csv/)
    expect(r.text).toContain('Resultado operacional')
    expect(r.text).toContain('Receita;300000,00')
  })
  it('sem token → 401', async () => {
    const r = await request(app).get('/api/dashboard-financeiro/export.csv')
    expect(r.status).toBe(401)
  })
})

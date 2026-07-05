// ============================================================
// Testes — /api/orcamento: upsert de metas + comparação com o realizado
// da DRE, desvio e % atingido; isolamento por tenant.
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
let request, app, db, token, tokenB

beforeAll(async () => {
  const st = await import('supertest')
  request = st.default
  ;({ app, db } = await import('../server.js'))
  token = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token
  const m = r => r.set('Authorization', `Bearer ${token}`)
  const empB = (await m(request(app).post('/api/empresas')).send({ razao_social: 'Tenant B' })).body.data.id
  await m(request(app).post('/api/usuarios')).send({ nome: 'Admin B', email: 'orc.b@x.com', senha: 'Aa@123456', perfil: 'admin', empresa_id: empB })
  tokenB = (await request(app).post('/api/auth/login').send({ email: 'orc.b@x.com', senha: 'Aa@123456' })).body?.data?.token

  // Realizado de maio/2026: receita 90k (AR faturada).
  db.prepare(`INSERT INTO contas_receber(numero, cliente, valor, data_emissao, status, empresa_id) VALUES('CR-O','X',90000,'2026-05-10','A Receber',1)`).run()
})

const auth = r => r.set('Authorization', `Bearer ${token}`)

describe('POST /api/orcamento (upsert)', () => {
  it('cria a meta de maio', async () => {
    const r = await auth(request(app).post('/api/orcamento')).send({ ano: 2026, mes: 5, receita_meta: 100000, custo_meta: 30000, despesa_meta: 10000 })
    expect(r.status).toBe(201)
    expect(r.body.data.receita_meta).toBe(100000)
  })
  it('re-upsert atualiza (não duplica)', async () => {
    await auth(request(app).post('/api/orcamento')).send({ ano: 2026, mes: 5, receita_meta: 120000 })
    const n = db.prepare(`SELECT COUNT(*) n FROM orcamento_metas WHERE empresa_id=1 AND ano=2026 AND mes=5`).get().n
    expect(n).toBe(1)
  })
  it('mês inválido → 400', async () => {
    const r = await auth(request(app).post('/api/orcamento')).send({ ano: 2026, mes: 13 })
    expect(r.status).toBe(400)
  })
})

describe('GET /api/orcamento', () => {
  it('compara meta × realizado de maio com desvio e % atingido', async () => {
    const o = (await auth(request(app).get('/api/orcamento?ano=2026'))).body.data
    expect(o.meses).toHaveLength(12)
    const mai = o.meses[4]
    expect(mai.receita.meta).toBe(120000)  // última meta upsertada
    expect(mai.receita.real).toBe(90000)    // AR faturada de maio
    expect(mai.receita.atingido_pct).toBe(75)
  })
})

describe('isolamento', () => {
  it('tenant B não vê metas nem realizado de A', async () => {
    const o = (await request(app).get('/api/orcamento?ano=2026').set('Authorization', `Bearer ${tokenB}`)).body.data
    expect(o.total.receita.meta).toBe(0)
    expect(o.total.receita.real).toBe(0)
  })
})

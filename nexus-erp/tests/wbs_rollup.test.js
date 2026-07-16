// ============================================================
// Testes — Rollup de custos WBS (estimado × realizado) + endpoint + paridade
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'
import { montarRollupWBS } from '../lib/wbs_rollup.js'

describe('montarRollupWBS (lib pura)', () => {
  const linhas = [
    { contrato_id: 'A', valor_total_est: 1000, custo_real: 800 },
    { contrato_id: 'A', valor_total_est: 500, custo_real: 700 },  // estourou
    { contrato_id: 'B', valor_total_est: 2000, custo_real: 0 },
    { contrato_id: 'A', valor_total_est: 100, custo_real: 0, ativo: 0 }, // inativa ignora
  ]
  it('agrupa por contrato com estimado/realizado/desvio/pct', () => {
    const r = montarRollupWBS(linhas)
    const a = r.grupos.find(g => g.chave === 'A')
    expect(a.estimado).toBe(1500)
    expect(a.realizado).toBe(1500)
    expect(a.desvio).toBe(0)
    expect(a.linhas).toBe(2)
    const b = r.grupos.find(g => g.chave === 'B')
    expect(b.realizado).toBe(0)
    expect(b.pct).toBe(0)
  })
  it('total consolidado', () => {
    const r = montarRollupWBS(linhas)
    expect(r.total.estimado).toBe(3500)
    expect(r.total.realizado).toBe(1500)
    expect(r.total.desvio).toBe(-2000)
  })
  it('linha sem contrato cai em "Sem contrato"', () => {
    const r = montarRollupWBS([{ centro_custo: 'ADM', valor_total_est: 100, custo_real: 90 }])
    expect(r.grupos[0].chave).toBe('ADM')
  })
})

describe('Endpoint GET /api/wbs/rollup', () => {
  const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
  let request, app, token
  beforeAll(async () => {
    process.env.NODE_ENV = 'test'; process.env.DB_PATH = ':memory:'; process.env.SEED_PASSWORD = 'Fraser@2025'
    const st = await import('supertest'); request = st.default
    ;({ app } = await import('../server.js'))
    token = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token
  })
  it('consolida as linhas criadas via API', async () => {
    const auth = r => r.set('Authorization', `Bearer ${token}`)
    await auth(request(app).post('/api/wbs')).send({ codigo: '1', descricao: 'x', contrato_id: 'CT-R', valor_total_est: 1000 })
    await auth(request(app).post('/api/wbs')).send({ codigo: '2', descricao: 'y', contrato_id: 'CT-R', valor_total_est: 500 })
    const r = await auth(request(app).get('/api/wbs/rollup?contrato_id=CT-R'))
    expect(r.status).toBe(200)
    expect(r.body.data.total.estimado).toBe(1500)
  })
})

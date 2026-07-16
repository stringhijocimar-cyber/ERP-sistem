// ============================================================
// Testes — Análise financeira prévia (bureau + Receita → parecer)
// Lib pura + endpoint + paridade Express ⇄ Worker.
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'
import { analisarFinanceiro } from '../lib/analise_financeira.js'
import { analisarFinanceiro as wAnalise, bureauMock } from '../../nexus-cf/src/index.js'

const bom = { score_externo: 900, score_0_100: 86, pendencias: 0, protestos: 0, faturamento_estimado: 2000000, situacao: 'ATIVA' }
const medio = { score_externo: 600, score_0_100: 55, pendencias: 1, protestos: 0, faturamento_estimado: 300000, situacao: 'ATIVA' }
const ruim = { score_externo: 350, score_0_100: 12, pendencias: 3, protestos: 2, faturamento_estimado: 120000, situacao: 'ATIVA' }

describe('analisarFinanceiro (lib pura)', () => {
  it('bom histórico → Aprovar / risco Baixo', () => {
    const r = analisarFinanceiro({ bureau: bom, receita: { situacao_cadastral: 'ATIVA', regular: true } })
    expect(r.recomendacao).toBe('Aprovar')
    expect(r.nivel).toBe('Baixo')
    expect(r.score).toBeGreaterThanOrEqual(65)
  })

  it('histórico mediano → Aprovar com ressalvas', () => {
    const r = analisarFinanceiro({ bureau: medio, receita: { situacao_cadastral: 'ATIVA', regular: true } })
    expect(r.recomendacao).toBe('Aprovar com ressalvas')
    expect(r.nivel).toBe('Médio')
  })

  it('pendências/protestos altos → Recusar', () => {
    const r = analisarFinanceiro({ bureau: ruim, receita: { situacao_cadastral: 'ATIVA', regular: true } })
    expect(r.recomendacao).toBe('Recusar')
    expect(r.protestos).toBe(2)
  })

  it('situação cadastral irregular força Recusar mesmo com bom score', () => {
    const r = analisarFinanceiro({ bureau: bom, receita: { situacao_cadastral: 'INAPTA', regular: false } })
    expect(r.recomendacao).toBe('Recusar')
    expect(r.nivel).toBe('Alto')
    expect(r.fatores.some(f => f.fator === 'Situação cadastral' && f.impacto === -40)).toBe(true)
  })
})

describe('Paridade Express ⇄ Worker', () => {
  it('mesmo parecer para os mesmos dados', () => {
    for (const b of [bom, medio, ruim]) {
      const rec = { situacao_cadastral: 'ATIVA', regular: true }
      expect(wAnalise({ bureau: b, receita: rec })).toEqual(analisarFinanceiro({ bureau: b, receita: rec }))
    }
  })
  it('bureauMock do Worker bate com o shape esperado', () => {
    const d = bureauMock('11444777000161')
    expect(d.cnpj).toBe('11444777000161')
    expect(typeof d.score_0_100).toBe('number')
    expect(bureauMock('123')).toBeNull()
  })
})

describe('Endpoint POST /api/analise-financeira', () => {
  const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
  let request, app, token
  beforeAll(async () => {
    process.env.NODE_ENV = 'test'; process.env.DB_PATH = ':memory:'; process.env.SEED_PASSWORD = 'Fraser@2025'
    const st = await import('supertest'); request = st.default
    ;({ app } = await import('../server.js'))
    token = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token
  })
  it('devolve parecer com recomendação e fatores', async () => {
    const r = await request(app).post('/api/analise-financeira').set('Authorization', `Bearer ${token}`).send({ cnpj: '11444777000161' })
    expect(r.status).toBe(200)
    expect(['Aprovar', 'Aprovar com ressalvas', 'Recusar']).toContain(r.body.data.recomendacao)
    expect(Array.isArray(r.body.data.fatores)).toBe(true)
    expect(r.body.data.bureau).toBeTruthy()
  })
  it('CNPJ inválido → 400', async () => {
    const r = await request(app).post('/api/analise-financeira').set('Authorization', `Bearer ${token}`).send({ cnpj: '123' })
    expect(r.status).toBe(400)
  })
})

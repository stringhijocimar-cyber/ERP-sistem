// Testes do adaptador de bureau de crédito (provedor mock).
import { describe, expect, it } from 'vitest'
import { consultarCredito } from '../lib/credit_bureau.js'

const CNPJ = '11.222.333/0001-81'

describe('consultarCredito (mock)', () => {
  it('rejeita CNPJ inválido', async () => {
    await expect(consultarCredito('123')).rejects.toThrow(/inválido/i)
  })

  it('retorna dados normalizados para CNPJ válido', async () => {
    const r = await consultarCredito(CNPJ)
    expect(r.cnpj).toBe('11222333000181')
    expect(r.fonte).toBe('mock')
    expect(r.score_externo).toBeGreaterThanOrEqual(300)
    expect(r.score_externo).toBeLessThanOrEqual(999)
    expect(r.score_0_100).toBeGreaterThanOrEqual(0)
    expect(r.score_0_100).toBeLessThanOrEqual(100)
    expect(['ATIVA', 'INAPTA']).toContain(r.situacao)
    expect(typeof r.pendencias).toBe('number')
  })

  it('é determinístico (mesma entrada → mesma saída)', async () => {
    const a = await consultarCredito(CNPJ)
    const b = await consultarCredito('11222333000181')
    expect(a).toEqual(b)
  })

  it('provedor não configurado falha de forma honesta', async () => {
    await expect(consultarCredito(CNPJ, { provider: 'serasa' })).rejects.toThrow(/não configurado/i)
  })
})

// ============================================================
// Testes — lib/orcamento.js (puro): comparação meta × realizado.
// ============================================================
import { describe, expect, it } from 'vitest'
import { compararLinha, montarOrcamentoAnual } from '../lib/orcamento.js'

describe('compararLinha', () => {
  it('desvio e % atingido com meta positiva', () => {
    expect(compararLinha(1000, 800)).toEqual({ meta: 1000, real: 800, desvio: -200, atingido_pct: 80 })
  })
  it('meta zero com realizado → 100%', () => {
    expect(compararLinha(0, 500).atingido_pct).toBe(100)
  })
  it('meta e real zero → 0%', () => {
    expect(compararLinha(0, 0).atingido_pct).toBe(0)
  })
})

describe('montarOrcamentoAnual', () => {
  it('monta 12 meses e acumula os totais', () => {
    const metas = { 3: { receita_meta: 100000, custo_meta: 40000, despesa_meta: 10000 } }
    const real = { 3: { receita: 90000, custos: 45000, despesas: 8000 } }
    const o = montarOrcamentoAnual(2026, metas, real)
    expect(o.meses).toHaveLength(12)
    const mar = o.meses[2]
    expect(mar.receita.atingido_pct).toBe(90)      // 90k/100k
    expect(mar.custo.desvio).toBe(5000)            // 45k - 40k (estourou)
    expect(mar.resultado_meta).toBe(50000)         // 100k - 40k - 10k
    expect(mar.resultado_real).toBe(37000)         // 90k - 45k - 8k
    expect(o.total.receita.meta).toBe(100000)
    expect(o.total.resultado_real).toBe(37000)
  })
  it('sem metas nem realizado → tudo zero, 12 meses', () => {
    const o = montarOrcamentoAnual(2026, {}, {})
    expect(o.meses).toHaveLength(12)
    expect(o.total.receita.meta).toBe(0)
    expect(o.total.resultado_desvio).toBe(0)
  })
})

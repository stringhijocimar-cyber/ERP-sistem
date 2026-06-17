// Testes do motor de análise de crédito de fornecedores (função pura).
import { describe, expect, it } from 'vitest'
import { analisarCreditoFornecedor } from '../public/js/lib/credito.js'

describe('analisarCreditoFornecedor', () => {
  it('fornecedor sólido e ativo → baixo risco (A) com limite sugerido', () => {
    const r = analisarCreditoFornecedor({
      situacaoCnpj: 'ATIVA',
      dataAbertura: '2008-01-01',
      faturamentoAnual: 12000000,
      limiteSolicitado: 300000,   // 2.5% do faturamento
      scoreInternoIDF: 4.5,
    })
    expect(r.score).toBeGreaterThanOrEqual(80)
    expect(r.classe).toBe('A')
    expect(r.limiteSugerido).toBeGreaterThan(0)
    expect(r.fatores.length).toBeGreaterThan(0)
  })

  it('CNPJ baixado → penaliza forte e não sugere limite (alto risco)', () => {
    const r = analisarCreditoFornecedor({
      situacaoCnpj: 'BAIXADA',
      faturamentoAnual: 500000,
      limiteSolicitado: 200000,
    })
    expect(r.classe).toBe('D')
    expect(r.limiteSugerido).toBe(0)
    expect(r.fatores.some(f => f.impacto < 0)).toBe(true)
  })

  it('limite acima do prudente vs faturamento penaliza a exposição', () => {
    const baixaExposicao = analisarCreditoFornecedor({ situacaoCnpj: 'ATIVA', faturamentoAnual: 1000000, limiteSolicitado: 30000 })
    const altaExposicao  = analisarCreditoFornecedor({ situacaoCnpj: 'ATIVA', faturamentoAnual: 1000000, limiteSolicitado: 600000 })
    expect(altaExposicao.score).toBeLessThan(baixaExposicao.score)
    expect(altaExposicao.fatores.some(f => /acima do prudente/i.test(f.fator))).toBe(true)
  })

  it('score sempre fica no intervalo 0–100', () => {
    const pessimo = analisarCreditoFornecedor({ situacaoCnpj: 'SUSPENSA', pendenciasFinanceiras: 5, dataAbertura: '2024-06-01' })
    const otimo   = analisarCreditoFornecedor({ situacaoCnpj: 'ATIVA', dataAbertura: '1990-01-01', faturamentoAnual: 50000000, limiteSolicitado: 100000, scoreInternoIDF: 5 })
    expect(pessimo.score).toBeGreaterThanOrEqual(0)
    expect(otimo.score).toBeLessThanOrEqual(100)
  })

  it('entrada vazia retorna nota neutra sem quebrar', () => {
    const r = analisarCreditoFornecedor()
    expect(r.score).toBe(50)
    expect(r.classe).toBe('C')
    expect(Array.isArray(r.fatores)).toBe(true)
  })
})

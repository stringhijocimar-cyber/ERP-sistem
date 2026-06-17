// Testes do recomendador de fornecedor em RFQ (motor puro).
import { describe, expect, it } from 'vitest'
import { recomendarFornecedor, explicarRecomendacao } from '../public/js/lib/recomendador.js'

describe('recomendarFornecedor', () => {
  it('com pesos padrão (custo domina), o mais barato e equilibrado vence', () => {
    const r = recomendarFornecedor([
      { fornecedor_nome: 'A', preco: 10000, prazo_dias: 10, idf: 4, classificacao_credito: 'A' },
      { fornecedor_nome: 'B', preco: 15000, prazo_dias: 8,  idf: 5, classificacao_credito: 'A' },
      { fornecedor_nome: 'C', preco: 20000, prazo_dias: 30, idf: 2, classificacao_credito: 'C' },
    ])
    expect(r.recomendado.fornecedor_nome).toBe('A')
    expect(r.ranking).toHaveLength(3)
    expect(r.ranking[0].posicao).toBe(1)
    expect(r.ranking[0].recomendado).toBe(true)
  })

  it('ignora fornecedor que declinou', () => {
    const r = recomendarFornecedor([
      { fornecedor_nome: 'A', preco: 9000, declinou: true },
      { fornecedor_nome: 'B', preco: 12000, prazo_dias: 10, idf: 4 },
    ])
    expect(r.ranking).toHaveLength(1)
    expect(r.recomendado.fornecedor_nome).toBe('B')
  })

  it('normaliza critérios: menor preço e menor prazo recebem 100', () => {
    const r = recomendarFornecedor([
      { fornecedor_nome: 'Barato', preco: 1000, prazo_dias: 5, idf: 3 },
      { fornecedor_nome: 'Caro',   preco: 5000, prazo_dias: 20, idf: 3 },
    ])
    const barato = r.ranking.find(x => x.fornecedor_nome === 'Barato')
    expect(barato.fatores.custo).toBe(100)
    expect(barato.fatores.prazo).toBe(100)
  })

  it('peso pode priorizar prazo sobre custo', () => {
    const opcoes = [
      { fornecedor_nome: 'Barato-Lento', preco: 1000, prazo_dias: 60, idf: 3, classificacao_credito: 'B' },
      { fornecedor_nome: 'Caro-Rapido',  preco: 3000, prazo_dias: 3,  idf: 3, classificacao_credito: 'B' },
    ]
    const porCusto = recomendarFornecedor(opcoes)
    const porPrazo = recomendarFornecedor(opcoes, { pesos: { custo: 0.1, idf: 0.1, credito: 0.1, prazo: 0.7 } })
    expect(porCusto.recomendado.fornecedor_nome).toBe('Barato-Lento')
    expect(porPrazo.recomendado.fornecedor_nome).toBe('Caro-Rapido')
  })

  it('crédito frágil aparece na explicação', () => {
    const r = recomendarFornecedor([{ fornecedor_nome: 'Risco', preco: 1000, prazo_dias: 5, idf: 5, classificacao_credito: 'D' }])
    expect(explicarRecomendacao(r)).toMatch(/crédito frágil/i)
  })

  it('lista vazia não quebra', () => {
    const r = recomendarFornecedor([])
    expect(r.recomendado).toBeNull()
    expect(r.ranking).toHaveLength(0)
    expect(explicarRecomendacao(r)).toBe('')
  })
})

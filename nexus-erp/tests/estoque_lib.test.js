// ============================================================
// Testes — lib/estoque.js (puro): custo médio ponderado, aplicação de
// movimento (Entrada/Saída/Ajuste), reposição e valorização.
// ============================================================
import { describe, expect, it } from 'vitest'
import { custoMedioPonderado, aplicarMovimento, itensParaRepor, valorizarEstoque } from '../lib/estoque.js'

describe('custoMedioPonderado', () => {
  it('média ponderada entre saldo e entrada', () => {
    // 10 @ 2,00 + 10 @ 4,00 = 20 @ 3,00
    expect(custoMedioPonderado(10, 2, 10, 4)).toBe(3)
  })
  it('entrada sem custo não dilui o custo médio', () => {
    expect(custoMedioPonderado(10, 5, 5, 0)).toBe(5)
  })
  it('estoque zerado assume o custo da entrada', () => {
    expect(custoMedioPonderado(0, 0, 10, 7)).toBe(7)
  })
})

describe('aplicarMovimento', () => {
  const item = { quantidade_atual: 10, valor_medio: 2 }
  it('Entrada soma e recalcula custo médio', () => {
    const r = aplicarMovimento(item, { tipo: 'Entrada', quantidade: 10, valor_unitario: 4 })
    expect(r).toMatchObject({ ok: true, quantidade: 20, valor_medio: 3 })
  })
  it('Saída com lastro subtrai e mantém custo', () => {
    const r = aplicarMovimento(item, { tipo: 'Saída', quantidade: 4 })
    expect(r).toMatchObject({ ok: true, quantidade: 6, valor_medio: 2 })
  })
  it('Saída sem lastro é BLOQUEADA (409) — não zera silenciosamente', () => {
    const r = aplicarMovimento(item, { tipo: 'Saída', quantidade: 50 })
    expect(r.ok).toBe(false)
    expect(r.code).toBe(409)
  })
  it('Saída sem lastro passa com permitir_negativo', () => {
    const r = aplicarMovimento(item, { tipo: 'Saída', quantidade: 50, permitir_negativo: true })
    expect(r).toMatchObject({ ok: true, quantidade: -40 })
  })
  it('Ajuste define a quantidade absoluta (inventário)', () => {
    const r = aplicarMovimento(item, { tipo: 'Ajuste', quantidade: 7 })
    expect(r).toMatchObject({ ok: true, quantidade: 7 })
  })
  it('tipo inválido → 400', () => {
    expect(aplicarMovimento(item, { tipo: 'Xpto', quantidade: 1 }).code).toBe(400)
  })
  it('quantidade negativa → 400', () => {
    expect(aplicarMovimento(item, { tipo: 'Entrada', quantidade: -1 }).code).toBe(400)
  })
})

describe('itensParaRepor', () => {
  it('lista só itens no/abaixo do mínimo, com sugestão de compra', () => {
    const r = itensParaRepor([
      { id: 1, codigo: 'A', descricao: 'Baixo', quantidade_atual: 2, quantidade_minima: 5, valor_medio: 10 },
      { id: 2, codigo: 'B', descricao: 'OK', quantidade_atual: 20, quantidade_minima: 5 },
      { id: 3, codigo: 'C', descricao: 'Sem mínimo', quantidade_atual: 0, quantidade_minima: 0 },
    ])
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ id: 1, sugestao_compra: 8, custo_estimado: 80 }) // alvo 2×min=10, repor 8; 8×10
  })
})

describe('valorizarEstoque', () => {
  it('soma saldo × custo médio, total e por categoria', () => {
    const v = valorizarEstoque([
      { quantidade_atual: 10, valor_medio: 5, categoria: 'EPI' },
      { quantidade_atual: 4, valor_medio: 25, categoria: 'Ferramenta' },
      { quantidade_atual: 2, valor_medio: 5, categoria: 'EPI' },
    ])
    expect(v.total).toBe(160) // 50 + 100 + 10
    expect(v.por_categoria[0]).toEqual({ categoria: 'Ferramenta', valor: 100 })
  })
})

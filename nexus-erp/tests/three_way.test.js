// Testes do motor de conciliação 3-way por item (função pura).
import { describe, expect, it } from 'vitest'
import { conciliarTresVias } from '../public/js/lib/three_way.js'

const pedido = [
  { codigo: 'A', descricao: 'Parafuso', qtd: 100, preco: 1.0 },
  { codigo: 'B', descricao: 'Porca', qtd: 50, preco: 2.0 },
]

describe('conciliarTresVias', () => {
  it('nota dentro do pedido e do recebimento → conforme', () => {
    const r = conciliarTresVias({
      itensPedido: pedido,
      itensRecebidos: [{ codigo: 'A', qtd: 100 }, { codigo: 'B', qtd: 50 }],
      itensNota: [{ codigo: 'A', qtd: 100, preco: 1.0 }, { codigo: 'B', qtd: 50, preco: 2.0 }],
    })
    expect(r.conforme).toBe(true)
    expect(r.divergencias).toHaveLength(0)
  })

  it('preço faturado acima do pedido (além da tolerância) → divergência', () => {
    const r = conciliarTresVias({
      itensPedido: pedido,
      itensNota: [{ codigo: 'A', qtd: 100, preco: 1.5 }], // 50% acima
    })
    expect(r.conforme).toBe(false)
    expect(r.divergencias.some(d => d.tipo === 'preco_acima_pedido')).toBe(true)
  })

  it('preço dentro da tolerância de 2% → conforme', () => {
    const r = conciliarTresVias({
      itensPedido: pedido,
      itensNota: [{ codigo: 'A', qtd: 100, preco: 1.02 }],
    })
    expect(r.conforme).toBe(true)
  })

  it('faturado acima do recebido → divergência (não paga o que não chegou)', () => {
    const r = conciliarTresVias({
      itensPedido: pedido,
      itensRecebidos: [{ codigo: 'A', qtd: 60 }],
      itensNota: [{ codigo: 'A', qtd: 100, preco: 1.0 }],
    })
    expect(r.conforme).toBe(false)
    expect(r.divergencias.some(d => d.tipo === 'faturado_acima_recebido')).toBe(true)
  })

  it('item na nota que não está no pedido → compra não autorizada', () => {
    const r = conciliarTresVias({
      itensPedido: pedido,
      itensNota: [{ codigo: 'Z', descricao: 'Item fantasma', qtd: 1, preco: 999 }],
    })
    expect(r.divergencias.some(d => d.tipo === 'item_sem_pedido')).toBe(true)
  })

  it('quantidade faturada acima do pedido → divergência', () => {
    const r = conciliarTresVias({
      itensPedido: pedido,
      itensNota: [{ codigo: 'A', qtd: 150, preco: 1.0 }],
    })
    expect(r.divergencias.some(d => d.tipo === 'faturado_acima_pedido')).toBe(true)
  })

  it('sem itens de nota → conforme com aviso (cai para checagem de total)', () => {
    const r = conciliarTresVias({ itensPedido: pedido, itensNota: [] })
    expect(r.conforme).toBe(true)
    expect(r.aviso).toMatch(/total/i)
  })
})

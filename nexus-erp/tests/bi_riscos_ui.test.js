// @vitest-environment jsdom
// ============================================================
// Testes — Bloco "Riscos de compra" no Dashboard BI (front).
// _biRiscosHTML renderiza contadores, chips por tipo e as principais
// ocorrências (com escape de HTML); estado verde quando não há riscos.
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'

beforeAll(async () => {
  await import('../public/js/pages/bi.js')
})

const RISCOS = {
  total: 3, alta: 1,
  por_tipo: { fracionamento: 1, duplicidade: 2 },
  principais: [
    { titulo: 'Possível fracionamento para furar a alçada — Aço Forte Ltda', severidade: 'alta', valor: 30000, ref: 7 },
    { titulo: 'Possível pedido duplicado — Aço Forte Ltda', severidade: 'media', valor: 30000, ref: 8 },
  ],
}

describe('_biRiscosHTML', () => {
  it('renderiza contadores, chips traduzidos e ocorrências', () => {
    const html = window._biRiscosHTML(RISCOS)
    expect(html).toContain('Riscos de compra')
    expect(html).toMatch(/>1<\/span> <span[^>]*>severidade alta/)
    expect(html).toContain('Fracionamento de alçada')
    expect(html).toContain('Possível duplicidade')
    expect(html).toContain('Aço Forte Ltda')
    expect(html).toContain("navigate('alertas')")
  })

  it('escapa HTML nos títulos (nome de fornecedor malicioso)', () => {
    const html = window._biRiscosHTML({ total: 1, alta: 1, por_tipo: {}, principais: [{ titulo: '<img src=x onerror=alert(1)>', severidade: 'alta' }] })
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;img')
  })

  it('sem riscos → estado verde "nenhuma anomalia"', () => {
    const html = window._biRiscosHTML({ total: 0, alta: 0, por_tipo: {}, principais: [] })
    expect(html).toMatch(/Nenhuma anomalia detectada/)
    expect(html).not.toContain('severidade alta')
  })

  it('riscos ausente (backend antigo) não quebra', () => {
    const html = window._biRiscosHTML(undefined)
    expect(html).toMatch(/Nenhuma anomalia/)
  })
})

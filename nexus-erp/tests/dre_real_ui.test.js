// @vitest-environment jsdom
// ============================================================
// Testes — card "DRE Real" no front (_dreRealHTML puro + carregamento).
// ============================================================
import { beforeAll, describe, expect, it, vi } from 'vitest'

beforeAll(async () => {
  window.fmt = v => 'R$ ' + Number(v || 0).toLocaleString('pt-BR')
  window.hasPermission = () => true
  window.apiAuth = vi.fn(async () => DRE)
  // dre.js referencia vários globais no load; stubs mínimos.
  window.ERP_DATA = { faturas: [] }
  await import('../public/js/pages/dre.js')
})

const DRE = {
  periodo: '2026', receita_bruta: 500000, custos: 120000, despesas: 50000,
  resultado_bruto: 380000, resultado_operacional: 330000, margem_liquida_pct: 66,
  caixa: { recebido: 200000, pago: 120000, saldo: 80000 },
  linhas: [
    { label: 'Receita Bruta de Serviços', valor: 500000, tipo: 'receita', nivel: 1 },
    { label: '(-) Custo dos Serviços (pedidos)', valor: -120000, tipo: 'custo', nivel: 2 },
    { label: '= Resultado Operacional', valor: 330000, tipo: 'total', nivel: 1 },
  ],
}

describe('_dreRealHTML', () => {
  it('renderiza linhas, margem e visão caixa', () => {
    const html = window._dreRealHTML(DRE)
    expect(html).toContain('DRE Real')
    expect(html).toContain('Receita Bruta de Serviços')
    expect(html).toContain('66%')
    expect(html).toContain('Visão Caixa')
    expect(html).toContain('Saldo')
  })
  it('dre ausente não quebra', () => {
    expect(window._dreRealHTML(null)).toBe('')
  })
})

describe('_dreCarregarReal', () => {
  it('busca /api/dre e injeta o card em #dreReal', async () => {
    document.body.innerHTML = '<div id="dreReal"></div>'
    await window._dreCarregarReal()
    expect(window.apiAuth).toHaveBeenCalledWith(expect.stringMatching(/\/api\/dre\?ano=/))
    expect(document.getElementById('dreReal').innerHTML).toContain('DRE Real')
  })
})

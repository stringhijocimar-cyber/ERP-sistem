// @vitest-environment jsdom
// ============================================================
// Testes — Visibilidade da conta a pagar após o recebimento (B1 no front).
// _cpResumoHTML renderiza as contas REAIS do servidor (número, valor,
// vencimento, status) no modal de resumo, com escape de HTML.
// ============================================================
import { beforeAll, describe, expect, it, vi } from 'vitest'

beforeAll(async () => {
  // Stubs mínimos: pedidos.js referencia globais no load
  window.fmt = v => 'R$ ' + (v || 0).toLocaleString('pt-BR')
  window.showToast = vi.fn(); window.logAction = vi.fn()
  window.FA_FORNECEDORES = []; window.FA_PEDIDOS = []
  await import('../public/js/pages/pedidos.js')
})

describe('_cpResumoHTML', () => {
  it('renderiza número, valor, vencimento e status das contas do servidor', () => {
    const html = window._cpResumoHTML([
      { numero: 'CP-2026-007', valor: 19000, status: 'Pendente', data_vencimento: '2026-08-01' },
      { numero: 'CP-2026-008', valor: 500, status: 'Pendente', data_vencimento: null },
    ])
    expect(html).toContain('CP-2026-007')
    expect(html).toContain('venc. 2026-08-01')
    expect(html).toContain('Pendente')
    expect(html).toContain('CP-2026-008')
    expect(html).toMatch(/R\$\s?19[.,]000/)
  })

  it('escapa HTML nos campos (dados vêm do banco)', () => {
    const html = window._cpResumoHTML([{ numero: '<img src=x onerror=alert(1)>', valor: 1, status: 'x' }])
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;img')
  })

  it('lista vazia/ausente → string vazia (modal não quebra)', () => {
    expect(window._cpResumoHTML([])).toBe('')
    expect(window._cpResumoHTML(undefined)).toBe('')
  })
})

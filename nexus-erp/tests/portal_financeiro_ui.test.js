// @vitest-environment jsdom
// ============================================================
// Testes — Portal · Dashboard + Financeiro no front (portal_financeiro.js).
// ============================================================
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const DASH = {
  rfqs_aguardando: { qtd: 2, itens: [] },
  pedidos_ativos: { qtd: 1, valor: 80000 },
  pendencias: { nf_a_enviar: 1 },
  pagamentos_proximos: { qtd: 1, valor: 30000, ate: '2026-08-07' },
}
const FIN = {
  faturas: [
    { id: 1, numero: 'CP-P1', pc_numero: 'PC-X', nota_fiscal: 'NF-100', valor: 50000, data_vencimento: '2026-06-28', data_pagamento: '2026-06-30', status: 'Pago' },
    { id: 2, numero: 'CP-P2', pc_numero: 'PC-Y', nota_fiscal: '<img src=x onerror=alert(1)>', valor: 30000, data_vencimento: '2026-07-18', status: 'Pendente' },
  ],
  resumo: { recebido_total: 50000, recebido_qtd: 1, a_receber_total: 30000, a_receber_qtd: 1, proximo_pagamento: { valor: 30000, data_vencimento: '2026-07-18' } },
}

beforeAll(async () => {
  window.fmt = v => 'R$ ' + Number(v || 0).toLocaleString('pt-BR')
  window.apiAuth = vi.fn(async (path) => path.includes('dashboard') ? DASH : FIN)
  await import('../public/js/nexus_api.js')
  await import('../public/js/pages/portal_financeiro.js')
})

beforeEach(() => { document.body.innerHTML = '<div id="portal_dashboard"></div><div id="portal_financeiro"></div>' })

describe('_portalDashboardHTML (puro)', () => {
  it('renderiza os 4 cards com números certos', () => {
    const html = window._portalDashboardHTML(DASH)
    expect(html).toContain('Cotações a responder')
    expect(html).toContain('NF a enviar')
    expect(html).toContain('A receber (30 dias)')
    expect(html).toContain('R$ 30.000')
  })
  it('ausente não quebra', () => expect(window._portalDashboardHTML(null)).toBe(''))
})

describe('_portalFinanceiroHTML (puro)', () => {
  it('renderiza extrato com status pago/pendente e resumo', () => {
    const html = window._portalFinanceiroHTML(FIN)
    expect(html).toContain('Meu Financeiro')
    expect(html).toContain('✓ Pago')
    expect(html).toContain('Pendente')
    expect(html).toContain('Próximo pagamento')
  })
  it('escapa HTML da NF (dado externo)', () => {
    const html = window._portalFinanceiroHTML(FIN)
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;img')
  })
  it('sem faturas mostra mensagem amigável', () => {
    expect(window._portalFinanceiroHTML({ faturas: [], resumo: {} })).toContain('Nenhuma fatura')
  })
})

describe('carregadores', () => {
  it('injetam dashboard e financeiro nos containers', async () => {
    await window._portalCarregarDashboard()
    await window._portalCarregarFinanceiro()
    expect(document.getElementById('portal_dashboard').innerHTML).toContain('Pedidos ativos')
    expect(document.getElementById('portal_financeiro').innerHTML).toContain('NF-100')
  })
})

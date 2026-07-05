// @vitest-environment jsdom
// ============================================================
// Testes — página Dashboard Financeiro (front): _dashFinHTML puro + render.
// ============================================================
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const DASH = {
  periodo: '2026', gerado_em: '2026-07-05T00:00:00Z',
  dre: { receita: 400000, custos: 100000, despesas: 0, resultado_operacional: 300000, margem_liquida_pct: 75, custo_mao_obra: 0 },
  caixa: { recebido: 0, pago: 0, saldo: 0 },
  projecao: { saldo_inicial: 0, saldo_final: -5000, menor_saldo: -5000, semana_critica: '2026-07-13', aperto_previsto: true, entradas_previstas: 400000, saidas_previstas: 405000 },
  posicao: { a_receber: 400000, a_receber_qtd: 1, a_receber_vencido: 0, a_pagar: 100000, a_pagar_qtd: 1, a_pagar_vencido: 0, capital_giro: 300000 },
  contratos: { top: [{ contrato_id: 1, numero: 'CT-2026-001', titulo: 'Contrato Dash', receita: 400000, resultado: 300000, margem_pct: 75 }], prejuizo: [], total_avaliados: 1 },
  conciliacao_pendente: 2,
}

beforeAll(async () => {
  window.apiAuth = vi.fn(async () => DASH)
  window.fmt = v => 'R$ ' + Number(v || 0).toLocaleString('pt-BR')
  await import('../public/js/nexus_api.js')
  await import('../public/js/pages/dashboard_financeiro.js')
})

beforeEach(() => { document.body.innerHTML = '<div id="mainContent"></div>' })

describe('_dashFinHTML (puro)', () => {
  it('renderiza KPIs, alerta de aperto e ranking de contratos', () => {
    const html = window._dashFinHTML(DASH)
    expect(html).toContain('Resultado operacional')
    expect(html).toContain('75%')
    expect(html).toContain('aperto de caixa previsto')
    expect(html).toContain('CT-2026-001')
    expect(html).toContain('Capital de giro')
  })
  it('mostra caixa tranquilo quando não há aperto', () => {
    const ok = { ...DASH, projecao: { ...DASH.projecao, aperto_previsto: false } }
    expect(window._dashFinHTML(ok)).toContain('caixa positivo nas próximas 12 semanas')
  })
  it('dado ausente não quebra', () => {
    expect(window._dashFinHTML(null)).toBe('')
  })
})

describe('renderDashboardFinanceiro', () => {
  it('busca /api/dashboard-financeiro e injeta o cockpit', async () => {
    await window.renderDashboardFinanceiro()
    await new Promise(r => setTimeout(r, 10))
    expect(window.apiAuth).toHaveBeenCalledWith('/api/dashboard-financeiro')
    expect(document.getElementById('mainContent').innerHTML).toContain('Contrato Dash')
  })
})

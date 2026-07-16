// @vitest-environment jsdom
// ============================================================
// Testes — card "Fluxo de Caixa Projetado" no front (dre.js).
// _fluxoProjetadoHTML (puro) + _carregarFluxoProjetado (fetch + injeta).
// ============================================================
import { beforeAll, describe, expect, it, vi } from 'vitest'

const FLUXO = {
  saldo_inicial: 1000,
  semanas: [
    { semana: '2026-05-11', inicio: '2026-05-11', fim: '2026-05-18', entradas: 5000, saidas: 0, liquido: 5000, saldo_acumulado: 6000, negativo: false },
    { semana: '2026-05-18', inicio: '2026-05-18', fim: '2026-05-25', entradas: 0, saidas: 9000, liquido: -9000, saldo_acumulado: -3000, negativo: true },
  ],
  vencido: { entradas: 0, saidas: 800 },
  resumo: { entradas_total: 5000, saidas_total: 9000, liquido_total: -4000, saldo_final: -3000, menor_saldo: -3000, semana_critica: '2026-05-18' },
}

beforeAll(async () => {
  window.fmt = v => 'R$ ' + Number(v || 0).toLocaleString('pt-BR')
  window.hasPermission = () => true
  window.apiAuth = vi.fn(async () => FLUXO)
  window.ERP_DATA = { faturas: [] }
  await import('../public/js/pages/dre.js')
})

describe('_fluxoProjetadoHTML', () => {
  it('renderiza semanas, saldo acumulado e alerta de aperto', () => {
    const html = window._fluxoProjetadoHTML(FLUXO)
    expect(html).toContain('Fluxo de Caixa Projetado')
    expect(html).toContain('2026-05-11')
    expect(html).toContain('aperto de caixa previsto')
    expect(html).toContain('vencidos em aberto') // porque vencido.saidas = 800
  })
  it('saldo sempre positivo mostra mensagem tranquila', () => {
    const ok = { ...FLUXO, resumo: { ...FLUXO.resumo, menor_saldo: 500 } }
    expect(window._fluxoProjetadoHTML(ok)).toContain('saldo positivo em todo o horizonte')
  })
  it('dado ausente não quebra', () => {
    expect(window._fluxoProjetadoHTML(null)).toBe('')
  })
})

describe('_carregarFluxoProjetado', () => {
  it('busca /api/fluxo-caixa-projetado e injeta o card', async () => {
    document.body.innerHTML = '<div id="fluxoProjetado"></div>'
    await window._carregarFluxoProjetado()
    expect(window.apiAuth).toHaveBeenCalledWith(expect.stringMatching(/\/api\/fluxo-caixa-projetado/))
    expect(document.getElementById('fluxoProjetado').innerHTML).toContain('Fluxo de Caixa Projetado')
  })
})

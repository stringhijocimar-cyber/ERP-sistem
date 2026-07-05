// ============================================================
// Testes — lib/fluxo_projetado.js (puro): baldes semanais de entradas/saídas,
// saldo acumulado, vencido na 1ª semana, detecção de aperto de caixa.
// ============================================================
import { describe, expect, it } from 'vitest'
import { montarFluxoProjetado } from '../lib/fluxo_projetado.js'

// Base fixa (quarta-feira 2026-05-13) → início da semana = segunda 2026-05-11.
const HOJE = '2026-05-13'

describe('montarFluxoProjetado', () => {
  it('bucketiza entradas/saídas por semana e acumula saldo', () => {
    const r = montarFluxoProjetado({
      hoje: HOJE, semanas: 3, saldoInicial: 1000,
      receber: [{ valor: 5000, data_vencimento: '2026-05-13', status: 'A Receber' }],  // semana 0
      pagar: [{ valor: 2000, data_vencimento: '2026-05-20', status: 'Pendente' }],       // semana 1
    })
    expect(r.semanas).toHaveLength(3)
    expect(r.semanas[0].entradas).toBe(5000)
    expect(r.semanas[0].saldo_acumulado).toBe(6000)   // 1000 + 5000
    expect(r.semanas[1].saidas).toBe(2000)
    expect(r.semanas[1].saldo_acumulado).toBe(4000)   // 6000 - 2000
    expect(r.resumo.saldo_final).toBe(4000)
    expect(r.resumo.entradas_total).toBe(5000)
    expect(r.resumo.saidas_total).toBe(2000)
  })

  it('vencido (antes do início) cai na 1ª semana e é exposto à parte', () => {
    const r = montarFluxoProjetado({
      hoje: HOJE, semanas: 2, saldoInicial: 0,
      pagar: [{ valor: 800, data_vencimento: '2026-04-01', status: 'Pendente' }], // vencido
    })
    expect(r.vencido.saidas).toBe(800)
    expect(r.semanas[0].saidas).toBe(800)
  })

  it('detecta aperto de caixa (saldo acumulado negativo)', () => {
    const r = montarFluxoProjetado({
      hoje: HOJE, semanas: 2, saldoInicial: 100,
      pagar: [{ valor: 500, data_vencimento: '2026-05-14', status: 'Pendente' }],
    })
    expect(r.semanas[0].negativo).toBe(true)
    expect(r.resumo.menor_saldo).toBe(-400)
    expect(r.resumo.semana_critica).toBe(r.semanas[0].semana)
  })

  it('ignora contas já liquidadas/canceladas e fora do horizonte', () => {
    const r = montarFluxoProjetado({
      hoje: HOJE, semanas: 2, saldoInicial: 0,
      receber: [
        { valor: 999, data_vencimento: '2026-05-13', status: 'Recebida' },   // já entrou
        { valor: 100, data_vencimento: '2030-01-01', status: 'A Receber' },   // fora do horizonte
      ],
      pagar: [{ valor: 50, data_vencimento: '2026-05-14', status: 'Cancelado' }], // cancelada
    })
    expect(r.resumo.entradas_total).toBe(0)
    expect(r.resumo.saidas_total).toBe(0)
  })
})

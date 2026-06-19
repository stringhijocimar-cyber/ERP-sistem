// ============================================================
// Worker (nexus-cf) — fluxo de caixa (função pura)
// Verifica o cálculo E a PARIDADE com a lib/fluxo_caixa.js do Express.
// ============================================================
import { describe, expect, it } from 'vitest'
import { montarFluxoCaixa as worker } from '../../nexus-cf/src/index.js'
import { montarFluxoCaixa as express } from '../lib/fluxo_caixa.js'

const HOJE = '2026-06-15' // segunda-feira
const off = n => new Date(new Date(HOJE + 'T00:00:00Z').getTime() + n * 864e5).toISOString().slice(0, 10)

const contas = [
  { valor: 100, data_vencimento: off(2), status: 'Pendente', contrato_id: 'CT-1' },
  { valor: 50, data_vencimento: off(1), data_pagamento: off(3), status: 'Pago', contrato_id: 'CT-1' },
  { valor: 200, vencimento: off(8), status: 'Aprovado', contrato_id: 'CT-2' }, // doc model usa "vencimento"
  { valor: 999, data_vencimento: off(2), status: 'Cancelado', contrato_id: 'CT-1' },
]

describe('Worker — montarFluxoCaixa', () => {
  it('calcula planejado/realizado/desvio por semana', () => {
    const r = worker(contas, { semanas: 8, hoje: HOJE })
    expect(r.semanas[0].planejado).toBe(150)
    expect(r.semanas[0].realizado).toBe(50)
    expect(r.semanas[1].planejado).toBe(200)
    expect(r.resumo.desvio_total).toBe(-300)
  })

  it('paridade total com o Express (mesma saída)', () => {
    expect(worker(contas, { semanas: 8, hoje: HOJE })).toEqual(express(contas, { semanas: 8, hoje: HOJE }))
  })
})

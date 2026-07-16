// ============================================================
// Testes — lib/otif.js (puro): status efetivo, OTIF sobre a promessa
// original (replanejar NÃO conserta o indicador) e parse de prazo.
// ============================================================
import { describe, expect, it } from 'vitest'
import { calcularOTIF, statusEntrega, dataPrometidaDoPrazo } from '../lib/otif.js'

const HOJE = '2026-07-10'

describe('statusEntrega', () => {
  it('entregue > atrasada > confirmada > programada', () => {
    expect(statusEntrega({ data_entregue: '2026-07-01' }, HOJE)).toBe('Entregue')
    expect(statusEntrega({ data_prometida: '2026-07-01' }, HOJE)).toBe('Atrasada')
    expect(statusEntrega({ data_prometida: '2026-07-20', data_confirmada: '2026-07-20' }, HOJE)).toBe('Confirmada')
    expect(statusEntrega({ data_prometida: '2026-07-20' }, HOJE)).toBe('Programada')
  })
  it('replanejada usa a data confirmada para o atraso corrente', () => {
    // prometida 07-01 (passado), replanejada para 07-20 (futuro) → não está "Atrasada" hoje
    expect(statusEntrega({ data_prometida: '2026-07-01', data_confirmada: '2026-07-20', status: 'Replanejada' }, HOJE)).toBe('Replanejada')
  })
})

describe('calcularOTIF', () => {
  it('OTIF = entregues no prazo ORIGINAL / entregues', () => {
    const r = calcularOTIF([
      { data_prometida: '2026-07-01', data_entregue: '2026-07-01' },              // no prazo
      { data_prometida: '2026-07-01', data_entregue: '2026-07-05' },              // atrasada
      { data_prometida: '2026-07-01', data_confirmada: '2026-07-10', data_entregue: '2026-07-08' }, // replanejada: falha no original, ok no revisado
      { data_prometida: '2026-08-01' },                                            // aberta futura
    ], HOJE)
    expect(r.entregues).toBe(3)
    expect(r.no_prazo).toBe(1)
    expect(r.otif_pct).toBe(33.3)          // replanejar NÃO conserta o OTIF
    expect(r.otif_revisado_pct).toBe(66.7) // mas o indicador revisado reconhece
    expect(r.abertas).toBe(1)
    expect(r.atrasadas_abertas).toBe(0)
  })
  it('sem entregas concluídas → OTIF null (sem histórico)', () => {
    expect(calcularOTIF([{ data_prometida: '2026-08-01' }], HOJE).otif_pct).toBeNull()
  })
  it('aberta com prazo vencido conta como atrasada', () => {
    expect(calcularOTIF([{ data_prometida: '2026-07-01' }], HOJE).atrasadas_abertas).toBe(1)
  })
})

describe('dataPrometidaDoPrazo', () => {
  it('data ISO passa; texto tipo "30 dias" vira null', () => {
    expect(dataPrometidaDoPrazo('2026-08-01')).toBe('2026-08-01')
    expect(dataPrometidaDoPrazo('30 dias')).toBeNull()
    expect(dataPrometidaDoPrazo('')).toBeNull()
  })
})

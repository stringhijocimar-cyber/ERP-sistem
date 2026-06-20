// ============================================================
// Worker (nexus-cf) — pertencimento de linha WBS ao contrato (puro).
// Base da amarração OS↔Contrato↔WBS (Fatia A1).
// ============================================================
import { describe, expect, it } from 'vitest'
import { wbsPertenceAoContrato } from '../../nexus-cf/src/index.js'

describe('Worker — wbsPertenceAoContrato', () => {
  it('reconhece linha do mesmo contrato (tolera tipo)', () => {
    expect(wbsPertenceAoContrato({ contrato_id: 10 }, 10)).toBe(true)
    expect(wbsPertenceAoContrato({ contrato_id: '10' }, 10)).toBe(true)
  })
  it('rejeita linha de outro contrato', () => {
    expect(wbsPertenceAoContrato({ contrato_id: 20 }, 10)).toBe(false)
  })
  it('linha nula nunca pertence', () => {
    expect(wbsPertenceAoContrato(null, 10)).toBe(false)
  })
  it('linha sem contrato só casa com alvo vazio', () => {
    expect(wbsPertenceAoContrato({ contrato_id: null }, null)).toBe(true)
    expect(wbsPertenceAoContrato({ contrato_id: null }, 10)).toBe(false)
  })
})

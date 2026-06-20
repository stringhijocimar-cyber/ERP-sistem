// ============================================================
// Worker (nexus-cf) — precisaOrcamentacao (função pura, paridade C1)
// ============================================================
import { describe, expect, it } from 'vitest'
import { precisaOrcamentacao } from '../../nexus-cf/src/index.js'

describe('Worker — precisaOrcamentacao', () => {
  it('Prospecção não exige; fechados não exigem', () => {
    expect(precisaOrcamentacao('Prospecção')).toBe(false)
    expect(precisaOrcamentacao('Fechado Ganho')).toBe(false)
    expect(precisaOrcamentacao('Fechado Perdido')).toBe(false)
    expect(precisaOrcamentacao('inexistente')).toBe(false)
  })
  it('de Qualificação até Negociação exige orçamentação', () => {
    expect(precisaOrcamentacao('Qualificação')).toBe(true)
    expect(precisaOrcamentacao('Reunião Agendada')).toBe(true)
    expect(precisaOrcamentacao('Proposta Enviada')).toBe(true)
    expect(precisaOrcamentacao('Negociação')).toBe(true)
  })
})

// ============================================================
// Worker (nexus-cf) — RCA do SSMA (função pura)
// Mesma semântica do rcaCompleto do Express.
// ============================================================
import { describe, expect, it } from 'vitest'
import { rcaCompleto } from '../../nexus-cf/src/index.js'

describe('Worker — rcaCompleto', () => {
  it('exige causa raiz E plano de ação', () => {
    expect(rcaCompleto({ causa_raiz: 'Falha', plano_acao: 'Treinar' })).toBe(true)
  })
  it('falta de qualquer um reprova', () => {
    expect(rcaCompleto({ causa_raiz: 'Falha' })).toBe(false)
    expect(rcaCompleto({ plano_acao: 'Treinar' })).toBe(false)
    expect(rcaCompleto({})).toBe(false)
    expect(rcaCompleto()).toBe(false)
  })
  it('strings em branco não contam', () => {
    expect(rcaCompleto({ causa_raiz: '   ', plano_acao: 'Treinar' })).toBe(false)
    expect(rcaCompleto({ causa_raiz: 'Falha', plano_acao: '  ' })).toBe(false)
  })
})

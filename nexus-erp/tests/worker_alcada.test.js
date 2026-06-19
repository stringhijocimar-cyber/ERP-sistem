// ============================================================
// Worker (nexus-cf) — alçada de pagamento (função pura)
// Mesma semântica do alcadaPendente do Express (usada no gateContaPagar).
// ============================================================
import { describe, expect, it } from 'vitest'
import { alcadaPendente } from '../../nexus-cf/src/index.js'

describe('Worker — alcadaPendente', () => {
  it('abaixo/igual ao limiar nunca pende', () => {
    expect(alcadaPendente({ valor: 40000 })).toBe(false)
    expect(alcadaPendente({ valor: 50000 })).toBe(false)
  })
  it('acima do limiar sem aprovação pende (bloqueia)', () => {
    expect(alcadaPendente({ valor: 60000 })).toBe(true)
  })
  it('acima do limiar com aprovação não pende', () => {
    expect(alcadaPendente({ valor: 60000, aprovadaPor: 'Diretor X' })).toBe(false)
    expect(alcadaPendente({ valor: 60000, aprovadaPor: '   ' })).toBe(true) // branco não conta
  })
  it('respeita limiar customizado', () => {
    expect(alcadaPendente({ valor: 60000, limite: 100000 })).toBe(false)
    expect(alcadaPendente({ valor: 120000, limite: 100000 })).toBe(true)
  })
})

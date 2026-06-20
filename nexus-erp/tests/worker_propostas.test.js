// ============================================================
// Worker (nexus-cf) — podeGerarProposta (função pura, paridade C2)
// ============================================================
import { describe, expect, it } from 'vitest'
import { podeGerarProposta } from '../../nexus-cf/src/index.js'

describe('Worker — podeGerarProposta', () => {
  it('sem lead → bloqueia', () => {
    expect(podeGerarProposta(null, true).ok).toBe(false)
  })
  it('lead sem estimativa → bloqueia', () => {
    const r = podeGerarProposta({ id: 1 }, false)
    expect(r.ok).toBe(false)
    expect(r.motivo).toMatch(/estimativa/i)
  })
  it('lead com estimativa → libera', () => {
    expect(podeGerarProposta({ id: 1 }, true).ok).toBe(true)
  })
})

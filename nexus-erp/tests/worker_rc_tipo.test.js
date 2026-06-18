// ============================================================
// Worker (nexus-cf) — normalização do tipo da RC (função pura)
// Mesma semântica do normalizarTipoRC do Express.
// ============================================================
import { describe, expect, it } from 'vitest'
import { normalizarTipoRC } from '../../nexus-cf/src/index.js'

describe('Worker RC — normalizarTipoRC', () => {
  it('aceita os três tipos canônicos', () => {
    expect(normalizarTipoRC('Material')).toBe('Material')
    expect(normalizarTipoRC('Serviço')).toBe('Serviço')
    expect(normalizarTipoRC('Equipamento')).toBe('Equipamento')
  })

  it('tolera caixa e acento', () => {
    expect(normalizarTipoRC('material')).toBe('Material')
    expect(normalizarTipoRC('MATERIAL')).toBe('Material')
    expect(normalizarTipoRC('servico')).toBe('Serviço')
    expect(normalizarTipoRC('serviços')).toBe('Serviço')
    expect(normalizarTipoRC('  Equipamento  ')).toBe('Equipamento')
  })

  it('rejeita vazio e tipos fora da lista', () => {
    expect(normalizarTipoRC('')).toBeNull()
    expect(normalizarTipoRC(undefined)).toBeNull()
    expect(normalizarTipoRC('Consultoria')).toBeNull()
    expect(normalizarTipoRC('mat')).toBeNull()
  })
})

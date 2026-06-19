// ============================================================
// Worker (nexus-cf) — detecção de alteração bancária (função pura)
// Mesma semântica do alteracaoBancariaSolicitada do Express.
// ============================================================
import { describe, expect, it } from 'vitest'
import { alteracaoBancariaSolicitada } from '../../nexus-cf/src/index.js'

const atual = { banco: '001', agencia: '1234', conta: '11111-1' }

describe('Worker — alteracaoBancariaSolicitada', () => {
  it('detecta mudança de conta', () => {
    expect(alteracaoBancariaSolicitada(atual, { conta: '99999-9' })).toEqual({ conta: '99999-9' })
  })
  it('detecta múltiplos campos', () => {
    expect(alteracaoBancariaSolicitada(atual, { banco: '341', agencia: '1234', conta: '2-2' }))
      .toEqual({ banco: '341', conta: '2-2' }) // agencia igual não entra
  })
  it('ignora campos não-bancários e valores iguais', () => {
    expect(alteracaoBancariaSolicitada(atual, { telefone: 'x', banco: '001' })).toBeNull()
    expect(alteracaoBancariaSolicitada(atual, {})).toBeNull()
  })
  it('trata atual nulo (todos os campos são mudança)', () => {
    expect(alteracaoBancariaSolicitada({}, { conta: '5' })).toEqual({ conta: '5' })
  })
})

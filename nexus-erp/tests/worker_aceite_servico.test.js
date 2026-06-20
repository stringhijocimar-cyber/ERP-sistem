// ============================================================
// Worker (nexus-cf) — exigeAceiteServico (função pura, paridade B2)
// ============================================================
import { describe, expect, it } from 'vitest'
import { exigeAceiteServico } from '../../nexus-cf/src/index.js'

describe('Worker — exigeAceiteServico', () => {
  it('serviço sem aceite exige aceite (bloqueia)', () => {
    expect(exigeAceiteServico({ tipo_compra: 'servico' }, false)).toBe(true)
    expect(exigeAceiteServico({ tipo_compra: 'Serviço Externo' }, false)).toBe(true)
  })
  it('serviço com aceite libera', () => {
    expect(exigeAceiteServico({ tipo_compra: 'servico' }, true)).toBe(false)
  })
  it('material nunca exige aceite de serviço', () => {
    expect(exigeAceiteServico({ tipo_compra: 'material' }, false)).toBe(false)
    expect(exigeAceiteServico({}, false)).toBe(false)
    expect(exigeAceiteServico(null, false)).toBe(false)
  })
})

// ============================================================
// Worker (nexus-cf) — fornecedorHomologado (função pura)
// Mesma semântica do gate de homologação do Express.
// ============================================================
import { describe, expect, it } from 'vitest'
import { fornecedorHomologado } from '../../nexus-cf/src/index.js'

describe('Worker — fornecedorHomologado', () => {
  it('status Homologado basta', () => {
    expect(fornecedorHomologado({ status: 'Homologado' })).toBe(true)
  })
  it('exige as duas aprovações (Financeiro E Compliance)', () => {
    expect(fornecedorHomologado({ aprovado_financeiro_por: 'A', aprovado_compliance_por: 'B' })).toBe(true)
    expect(fornecedorHomologado({ aprovado_financeiro_por: 'A' })).toBe(false)
    expect(fornecedorHomologado({ aprovado_compliance_por: 'B' })).toBe(false)
  })
  it('nasce não-homologado (default-deny)', () => {
    expect(fornecedorHomologado({ status: 'Em Homologação' })).toBe(false)
    expect(fornecedorHomologado({})).toBe(false)
    expect(fornecedorHomologado(null)).toBe(false)
  })
  it('strings em branco não contam', () => {
    expect(fornecedorHomologado({ aprovado_financeiro_por: '  ', aprovado_compliance_por: 'B' })).toBe(false)
  })
})

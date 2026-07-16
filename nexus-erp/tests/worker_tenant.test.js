// ============================================================
// Worker (nexus-cf) — multi-tenant: empresaDoUsuario + docPertenceEmpresa
// (funções puras; paridade de semântica com o Express: escopo vem do
// usuário autenticado, legado sem empresa_id pertence à empresa 1).
// ============================================================
import { describe, expect, it } from 'vitest'
import { docPertenceEmpresa, empresaDoUsuario } from '../../nexus-cf/src/index.js'

describe('Worker — empresaDoUsuario', () => {
  it('usa o empresa_id do JWT', () => {
    expect(empresaDoUsuario({ empresa_id: 3 })).toBe(3)
    expect(empresaDoUsuario({ empresa_id: '2' })).toBe(2)
  })
  it('legado sem empresa_id → empresa 1 (tenant mestre)', () => {
    expect(empresaDoUsuario({})).toBe(1)
    expect(empresaDoUsuario(null)).toBe(1)
    expect(empresaDoUsuario({ empresa_id: 0 })).toBe(1)
    expect(empresaDoUsuario({ empresa_id: 'abc' })).toBe(1)
  })
})

describe('Worker — docPertenceEmpresa', () => {
  it('doc com a mesma empresa → pertence', () => {
    expect(docPertenceEmpresa({ empresa_id: 2 }, 2)).toBe(true)
    expect(docPertenceEmpresa({ empresa_id: '2' }, 2)).toBe(true)
  })
  it('doc de outra empresa → NÃO pertence (isolamento)', () => {
    expect(docPertenceEmpresa({ empresa_id: 2 }, 3)).toBe(false)
    expect(docPertenceEmpresa({ empresa_id: 1 }, 2)).toBe(false)
  })
  it('doc legado sem empresa_id pertence à empresa 1 e SÓ a ela', () => {
    expect(docPertenceEmpresa({ titulo: 'antigo' }, 1)).toBe(true)
    expect(docPertenceEmpresa({ titulo: 'antigo' }, 2)).toBe(false)
  })
  it('doc nulo nunca pertence', () => {
    expect(docPertenceEmpresa(null, 1)).toBe(false)
  })
  it('anti-spoof por tipo: string vs número não quebra a comparação', () => {
    expect(docPertenceEmpresa({ empresa_id: '3' }, '3')).toBe(true)
    expect(docPertenceEmpresa({ empresa_id: '3' }, 2)).toBe(false)
  })
})

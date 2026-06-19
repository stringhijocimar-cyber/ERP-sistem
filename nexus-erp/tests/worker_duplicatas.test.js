// ============================================================
// Worker (nexus-cf) — detecção de duplicatas (função pura)
// Mesma semântica do relatório /api/duplicatas do Express.
// ============================================================
import { describe, expect, it } from 'vitest'
import { detectarDuplicatas, normalizarCNPJ } from '../../nexus-cf/src/index.js'

describe('Worker — normalizarCNPJ', () => {
  it('mantém só os dígitos', () => {
    expect(normalizarCNPJ('11.222.333/0001-81')).toBe('11222333000181')
    expect(normalizarCNPJ(null)).toBe('')
  })
})

describe('Worker — detectarDuplicatas', () => {
  const fornecedores = [
    { id: 1, nome: 'A', cnpj: '11.222.333/0001-81' },
    { id: 2, nome: 'B', cnpj: '11222333000181' }, // duplicata (sem máscara)
    { id: 3, nome: 'C', cnpj: '99888777000166' }, // único
    { id: 4, nome: 'Sem CNPJ' },                  // ignorado
  ]
  const contas = [
    { id: 'CP1', nota_fiscal: 'NF-1', fornecedor_nome: 'A', valor: 100 },
    { id: 'CP2', nota_fiscal: 'NF-1', fornecedor_nome: 'B', valor: 200 }, // NF repetida
    { id: 'CP3', nota_fiscal: 'NF-UNICA', valor: 300 },
    { id: 'CP4', nota_fiscal: '—', valor: 1 },                            // placeholder ignorado
    { id: 'CP5', nota_fiscal: '—', valor: 1 },
  ]

  it('agrupa fornecedores por CNPJ (independe de máscara)', () => {
    const r = detectarDuplicatas({ fornecedores, contas })
    const g = r.fornecedores.find(x => x.cnpj === '11222333000181')
    expect(g.total).toBe(2)
    expect(g.ocorrencias.map(o => o.nome).sort()).toEqual(['A', 'B'])
  })

  it('agrupa NFs repetidas e ignora placeholder/único', () => {
    const r = detectarDuplicatas({ fornecedores, contas })
    expect(r.notas_fiscais.find(x => x.nota_fiscal === 'NF-1').total).toBe(2)
    expect(r.notas_fiscais.some(x => x.nota_fiscal === 'NF-UNICA')).toBe(false)
    expect(r.notas_fiscais.some(x => x.nota_fiscal === '—')).toBe(false)
  })

  it('resumo reflete as contagens', () => {
    const r = detectarDuplicatas({ fornecedores, contas })
    expect(r.resumo.fornecedores_dup).toBe(1)
    expect(r.resumo.nf_dup).toBe(1)
  })
})

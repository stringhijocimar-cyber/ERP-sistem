// ============================================================
// Worker (nexus-cf) — concorrência mínima (função pura)
// Mesma semântica do avaliarConcorrencia do Express.
// ============================================================
import { describe, expect, it } from 'vitest'
import { avaliarConcorrencia } from '../../nexus-cf/src/index.js'

describe('Worker — avaliarConcorrencia', () => {
  it('libera abaixo do limiar (independe do nº de cotações)', () => {
    expect(avaliarConcorrencia({ valor: 5000, numCotacoes: 1 }).ok).toBe(true)
  })

  it('libera acima do limiar com cotações suficientes', () => {
    expect(avaliarConcorrencia({ valor: 25000, numCotacoes: 3 }).ok).toBe(true)
  })

  it('bloqueia acima do limiar com <3 cotações sem exceção', () => {
    const r = avaliarConcorrencia({ valor: 25000, numCotacoes: 2 })
    expect(r.ok).toBe(false)
    expect(r.motivo).toMatch(/cotacoes/i)
  })

  it('exige justificativa E Diretor para a exceção', () => {
    expect(avaliarConcorrencia({ valor: 25000, numCotacoes: 1, justificativa: 'exclusivo', perfil: 'operacao' }).ok).toBe(false)
    expect(avaliarConcorrencia({ valor: 25000, numCotacoes: 1, perfil: 'diretor' }).ok).toBe(false) // sem justificativa
    const ok = avaliarConcorrencia({ valor: 25000, numCotacoes: 1, justificativa: 'exclusivo', perfil: 'diretor' })
    expect(ok.ok).toBe(true)
    expect(ok.excecao).toBe(true)
  })

  it('admin equivale a Diretor para a exceção; respeita limiares custom', () => {
    expect(avaliarConcorrencia({ valor: 25000, numCotacoes: 1, justificativa: 'x', perfil: 'admin' }).excecao).toBe(true)
    // limiar custom: R$50k → 20k não dispara a regra
    expect(avaliarConcorrencia({ valor: 20000, numCotacoes: 1, valorMin: 50000 }).ok).toBe(true)
  })
})

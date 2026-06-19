// ============================================================
// Worker (nexus-cf) — situação cadastral (mock determinístico)
// Verifica a função pura E a PARIDADE com o lib/receita.js do Express.
// ============================================================
import { describe, expect, it } from 'vitest'
import { situacaoReceitaMock } from '../../nexus-cf/src/index.js'
import { consultarReceita } from '../lib/receita.js'

describe('Worker — situacaoReceitaMock', () => {
  it('normaliza e marca regular = ATIVA', () => {
    const s = situacaoReceitaMock('11.222.333/0001-81')
    expect(s.cnpj).toBe('11222333000181')
    expect(typeof s.regular).toBe('boolean')
    expect(s.regular).toBe(s.situacao_cadastral === 'ATIVA')
  })
  it('CNPJ inválido → null', () => {
    expect(situacaoReceitaMock('123')).toBeNull()
    expect(situacaoReceitaMock('')).toBeNull()
  })
  it('paridade com o adaptador do Express (mesma situação por CNPJ)', async () => {
    for (let i = 10000000000000; i < 10000000000200; i++) {
      const cnpj = String(i)
      const w = situacaoReceitaMock(cnpj)
      const e = await consultarReceita(cnpj)
      expect(w.situacao_cadastral).toBe(e.situacao_cadastral)
      expect(w.regular).toBe(e.regular)
    }
  })
})

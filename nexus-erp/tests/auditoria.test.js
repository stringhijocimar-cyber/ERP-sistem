// Testes do motor de trilha de auditoria imutável (hash encadeado).
import { describe, expect, it } from 'vitest'
import { sha256hex, hashRegistro, verificarCadeia, GENESIS } from '../public/js/lib/auditoria.js'

// Constrói uma cadeia válida a partir de registros de negócio.
function construirCadeia(regs) {
  let prev = GENESIS
  return regs.map(r => {
    const hash = hashRegistro(r, prev)
    const row = { ...r, hash, hash_anterior: prev }
    prev = hash
    return row
  })
}

describe('sha256hex', () => {
  it('bate com o vetor de teste padrão do SHA-256', () => {
    // SHA-256("abc")
    expect(sha256hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })
  it('SHA-256("") conhecido', () => {
    expect(sha256hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
  })
  it('aceita acentos (UTF-8) sem quebrar', () => {
    expect(sha256hex('ação')).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('verificarCadeia', () => {
  const base = [
    { usuario_id: 1, acao: 'Criar', modulo: 'pedidos', descricao: 'PC-1', created_at: '2026-01-01T10:00:00Z' },
    { usuario_id: 2, acao: 'Aprovar', modulo: 'mapas', descricao: 'MAPA-1', created_at: '2026-01-01T11:00:00Z' },
    { usuario_id: 3, acao: 'Pagar', modulo: 'financeiro', descricao: 'CP-1', created_at: '2026-01-01T12:00:00Z' },
  ]

  it('cadeia íntegra verifica com sucesso', () => {
    const r = verificarCadeia(construirCadeia(base))
    expect(r.integra).toBe(true)
    expect(r.total).toBe(3)
    expect(r.quebraEm).toBeNull()
  })

  it('adulterar o conteúdo de um registro quebra a cadeia', () => {
    const cadeia = construirCadeia(base)
    cadeia[1].descricao = 'MAPA-ADULTERADO' // muda o conteúdo sem recalcular o hash
    const r = verificarCadeia(cadeia)
    expect(r.integra).toBe(false)
    expect(r.motivo).toMatch(/adulterado/i)
  })

  it('remover um registro do meio quebra o elo', () => {
    const cadeia = construirCadeia(base)
    const semMeio = [cadeia[0], cadeia[2]] // remove o do meio
    const r = verificarCadeia(semMeio)
    expect(r.integra).toBe(false)
    expect(r.motivo).toMatch(/elo quebrado/i)
  })

  it('cadeia vazia é considerada íntegra', () => {
    expect(verificarCadeia([]).integra).toBe(true)
  })
})

// ============================================================
// Worker (nexus-cf) — regra de isolamento do Portal do Fornecedor
// O Worker não tem harness HTTP aqui; testamos as funções puras que
// governam o escopo (mesma semântica do Express requirePortal/ownership).
// ============================================================
import { describe, expect, it } from 'vitest'
import { pedidoPertence, portalScope } from '../../nexus-cf/src/index.js'

describe('Worker portal — portalScope (quem entra)', () => {
  it('bloqueia perfil que não é fornecedor (403)', () => {
    const r = portalScope({ role: 'admin', fornecedor_id: 'F1' })
    expect(r.ok).toBe(false)
    expect(r.code).toBe(403)
  })

  it('bloqueia fornecedor sem vínculo (403)', () => {
    const r = portalScope({ role: 'fornecedor' })
    expect(r.ok).toBe(false)
    expect(r.code).toBe(403)
  })

  it('libera fornecedor vinculado, expondo o fornecedor_id como filtro', () => {
    const r = portalScope({ role: 'fornecedor', fornecedor_id: 'F1' })
    expect(r).toEqual({ ok: true, fornecedor_id: 'F1' })
  })
})

describe('Worker portal — pedidoPertence (ownership)', () => {
  it('reconhece o próprio pedido', () => {
    expect(pedidoPertence({ fornecedor_id: 'F1' }, 'F1')).toBe(true)
    expect(pedidoPertence({ fornecedor_id: 1 }, '1')).toBe(true) // tolera tipo
  })

  it('rejeita pedido de outro fornecedor', () => {
    expect(pedidoPertence({ fornecedor_id: 'F2' }, 'F1')).toBe(false)
  })

  it('rejeita entradas degeneradas (pedido nulo / vínculo ausente)', () => {
    expect(pedidoPertence(null, 'F1')).toBe(false)
    expect(pedidoPertence({ fornecedor_id: 'F1' }, null)).toBe(false)
    expect(pedidoPertence({}, 'F1')).toBe(false)
  })
})

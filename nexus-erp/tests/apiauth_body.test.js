// @vitest-environment jsdom
// ============================================================
// Testes — apiAuth serializa o body objeto (bug: fetch enviava "[object
// Object]" → 400). Bodies que já são string passam intactos (não re-serializa).
// Isto conserta emissão de RC, criação/convite de RFQ e aprovação de mapa.
// ============================================================
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

beforeAll(async () => {
  window.DB = { token: { get: () => 'tok-123' } }
  await import('../public/js/nexus_melhorias.js')
})

beforeEach(() => {
  window.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ data: { ok: true } }) }))
})

describe('apiAuth — serialização do body', () => {
  it('objeto vira JSON string no fetch', async () => {
    await window.apiAuth('/api/rfq', { method: 'POST', body: { titulo: 'X', fornecedor_ids: [1, 2] } })
    const [, opts] = window.fetch.mock.calls[0]
    expect(typeof opts.body).toBe('string')
    expect(JSON.parse(opts.body)).toEqual({ titulo: 'X', fornecedor_ids: [1, 2] })
    expect(opts.headers['Content-Type']).toBe('application/json')
    expect(opts.headers['Authorization']).toBe('Bearer tok-123')
  })

  it('body já-string NÃO é re-serializado (não quebra quem passa JSON.stringify)', async () => {
    const s = JSON.stringify({ motivo: 'x' })
    await window.apiAuth('/api/mapas/1/reprovar', { method: 'POST', body: s })
    const [, opts] = window.fetch.mock.calls[0]
    expect(opts.body).toBe(s) // idêntico, sem aspas duplicadas
    expect(JSON.parse(opts.body)).toEqual({ motivo: 'x' })
  })

  it('body vazio {} vira "{}" (não "[object Object]")', async () => {
    await window.apiAuth('/api/mapas/1/aprovar', { method: 'POST', body: {} })
    const [, opts] = window.fetch.mock.calls[0]
    expect(opts.body).toBe('{}')
  })

  it('GET sem body funciona normalmente', async () => {
    const out = await window.apiAuth('/api/rfq')
    const [, opts] = window.fetch.mock.calls[0]
    expect(opts.body).toBeUndefined()
    expect(out).toEqual({ ok: true })
  })

  it('erro do servidor (não-ok) lança com a mensagem', async () => {
    window.fetch = vi.fn(async () => ({ ok: false, status: 400, json: async () => ({ error: 'Título obrigatório' }) }))
    await expect(window.apiAuth('/api/rfq', { method: 'POST', body: {} })).rejects.toThrow(/obrigatório/i)
  })
})

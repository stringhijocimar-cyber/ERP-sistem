// @vitest-environment jsdom
// ============================================================
// Testes — NexusAPI (cliente resiliente dos módulos "enterprise").
// Antes, window.NexusAPI não existia e as 11 páginas quebravam no mount.
// Garantias: o objeto existe, desembrulha envelopes, e NUNCA lança em
// 404/erro de rede (devolve default seguro), evitando telas quebradas.
// ============================================================
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

beforeAll(async () => {
  window.sessionStorage.setItem('fa_token', 'tok-123')
  await import('../public/js/nexus_api.js')
})

afterEach(() => { vi.restoreAllMocks() })

describe('NexusAPI — existência e contrato', () => {
  it('define window.NexusAPI com get/post/escapeHtml', () => {
    expect(window.NexusAPI).toBeTruthy()
    expect(typeof window.NexusAPI.get).toBe('function')
    expect(typeof window.NexusAPI.post).toBe('function')
    expect(typeof window.NexusAPI.escapeHtml).toBe('function')
  })

  it('escapeHtml neutraliza HTML perigoso', () => {
    expect(window.NexusAPI.escapeHtml('<script>"x"&\'')).toBe('&lt;script&gt;&quot;x&quot;&amp;&#39;')
    expect(window.NexusAPI.escapeHtml(null)).toBe('')
    expect(window.NexusAPI.escapeHtml(42)).toBe('42')
  })
})

describe('NexusAPI — resiliência', () => {
  it('GET 404 não lança e devolve default seguro com items[]', async () => {
    global.fetch = vi.fn(async () => ({ ok: false, status: 404, json: async () => ({ error: 'nope' }) }))
    const r = await window.NexusAPI.get('/api/notifications/dashboard')
    expect(r).toBeTruthy()
    expect(Array.isArray(r.items)).toBe(true)
    expect(r.items.length).toBe(0)
  })

  it('GET de rede caída não lança', async () => {
    global.fetch = vi.fn(async () => { throw new Error('network down') })
    const r = await window.NexusAPI.get('/api/alerts/instances')
    expect(r.items).toEqual([])
  })

  it('GET desembrulha envelope { success, data } do Express', async () => {
    global.fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ success: true, data: { items: [{ id: 1 }] } }) }))
    const r = await window.NexusAPI.get('/api/x')
    expect(r.items[0].id).toBe(1)
  })

  it('POST 404 devolve { ok:false } em vez de lançar', async () => {
    global.fetch = vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) }))
    const r = await window.NexusAPI.post('/api/notifications/templates', { codigo: 'x' })
    expect(r.ok).toBe(false)
    expect(r._stub).toBe(true)
  })

  it('POST envia o token de autorização', async () => {
    const spy = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ data: { ok: true } }) }))
    global.fetch = spy
    await window.NexusAPI.post('/api/x', { a: 1 })
    const headers = spy.mock.calls[0][1].headers
    expect(headers.Authorization).toBe('Bearer tok-123')
    expect(spy.mock.calls[0][1].body).toBe(JSON.stringify({ a: 1 }))
  })
})

// @vitest-environment jsdom
// ============================================================
// Testes — ações server-backed da RC no front (aprovar / gerar pedido).
// ============================================================
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

let chamadas = []
beforeAll(async () => {
  window.showToast = vi.fn(); window.logAction = vi.fn()
  window.apiAuth = vi.fn(async (path, opts = {}) => {
    chamadas.push({ path, method: (opts.method || 'GET').toUpperCase(), body: opts.body || null })
    if (path.includes('/aprovar')) return { id: 1, status: 'Aprovada' }
    if (path.includes('/gerar-pedido')) return { pedido: { numero: 'PC-2026-010', id: 5 }, rc: { status: 'Atendida' } }
    return {}
  })
  await import('../public/js/pages/rc_acoes.js')
})

beforeEach(() => { chamadas = []; vi.clearAllMocks() })

describe('aprovarRequisicao', () => {
  it('POSTa /api/rc/:id/aprovar e avisa', async () => {
    const rc = await window.aprovarRequisicao(1)
    expect(chamadas.some(c => c.method === 'POST' && c.path === '/api/rc/1/aprovar')).toBe(true)
    expect(rc.status).toBe('Aprovada')
    expect(window.showToast).toHaveBeenCalledWith(expect.stringMatching(/aprovada/i), 'success')
  })
})

describe('gerarPedidoDaRequisicao', () => {
  it('POSTa /:id/gerar-pedido com o fornecedor e avisa com o número do PC', async () => {
    const r = await window.gerarPedidoDaRequisicao(1, 42)
    const post = chamadas.find(c => c.method === 'POST' && c.path === '/api/rc/1/gerar-pedido')
    expect(post.body).toMatchObject({ fornecedor_id: 42 })
    expect(r.pedido.numero).toBe('PC-2026-010')
    expect(window.showToast).toHaveBeenCalledWith(expect.stringMatching(/PC-2026-010/), 'success')
  })
  it('sem fornecedor não POSTa (avisa para selecionar)', async () => {
    await window.gerarPedidoDaRequisicao(1, null)
    expect(chamadas.some(c => c.path.includes('gerar-pedido'))).toBe(false)
    expect(window.showToast).toHaveBeenCalledWith(expect.stringMatching(/fornecedor/i), 'warning')
  })
})

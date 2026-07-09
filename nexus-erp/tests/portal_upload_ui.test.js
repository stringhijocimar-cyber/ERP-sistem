// @vitest-environment jsdom
// ============================================================
// Testes — upload de arquivo no front (portal.js): File→base64→POST.
// ============================================================
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

let chamadas = []

beforeAll(async () => {
  window.showToast = vi.fn(); window.closeModal = vi.fn(); window.openModal = vi.fn()
  window.apiAuth = vi.fn(async (path, opts = {}) => {
    chamadas.push({ path, method: (opts.method || 'GET').toUpperCase(), body: opts.body ? JSON.parse(opts.body) : null })
    if (path === '/api/portal/arquivos') return { id: 42, nome: 'cnd.pdf', mime: 'application/pdf', tamanho: 10 }
    return { ok: true }
  })
  await import('../public/js/nexus_api.js')
  await import('../public/js/pages/portal.js')
})

beforeEach(() => { chamadas = [] })

describe('portalUploadArquivo', () => {
  it('lê o File como base64 (sem prefixo data-URI cru) e POSTa nome+conteudo', async () => {
    const file = new File([new Uint8Array([37, 80, 68, 70])], 'cnd.pdf', { type: 'application/pdf' }) // %PDF
    const meta = await window.portalUploadArquivo(file)
    const post = chamadas.find(c => c.method === 'POST' && c.path === '/api/portal/arquivos')
    expect(post.body.nome).toBe('cnd.pdf')
    expect(typeof post.body.conteudo_base64).toBe('string')
    expect(post.body.conteudo_base64.length).toBeGreaterThan(0)
    expect(meta.id).toBe(42) // devolve os metadados do servidor
  })
  it('sem arquivo → devolve null e não POSTa', async () => {
    const r = await window.portalUploadArquivo(null)
    expect(r).toBeNull()
    expect(chamadas.some(c => c.path === '/api/portal/arquivos')).toBe(false)
  })
})

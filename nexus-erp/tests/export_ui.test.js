// @vitest-environment jsdom
// ============================================================
// Testes — download CSV autenticado no front (baixarCSVFinanceiro).
// ============================================================
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

let fetchArgs = null

beforeAll(async () => {
  window.showToast = vi.fn()
  window.fmt = v => 'R$ ' + Number(v || 0).toLocaleString('pt-BR')
  window.apiAuth = vi.fn(async () => ({}))
  try { sessionStorage.setItem('fa_token', 'tok-123') } catch {}
  // Stubs de URL/Blob que o jsdom não implementa por completo.
  global.URL.createObjectURL = vi.fn(() => 'blob:mock')
  global.URL.revokeObjectURL = vi.fn()
  global.fetch = vi.fn(async (url, opts) => {
    fetchArgs = { url, opts }
    return { ok: true, status: 200, blob: async () => new Blob(['csv;data'], { type: 'text/csv' }) }
  })
  await import('../public/js/nexus_api.js')
  await import('../public/js/pages/dashboard_financeiro.js')
})

beforeEach(() => { fetchArgs = null; document.body.innerHTML = '' })

describe('baixarCSVFinanceiro', () => {
  it('faz fetch autenticado e dispara o download (âncora clicada)', async () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    await window.baixarCSVFinanceiro('/api/dashboard-financeiro/export.csv', 'x.csv')
    expect(fetchArgs.url).toBe('/api/dashboard-financeiro/export.csv')
    expect(fetchArgs.opts.headers.Authorization).toBe('Bearer tok-123')
    expect(clickSpy).toHaveBeenCalled()
    expect(window.showToast).toHaveBeenCalledWith(expect.stringMatching(/gerada/), 'success')
    clickSpy.mockRestore()
  })
  it('erro HTTP mostra toast de falha', async () => {
    global.fetch = vi.fn(async () => ({ ok: false, status: 500 }))
    await window.baixarCSVFinanceiro('/api/dre/export.csv', 'y.csv')
    expect(window.showToast).toHaveBeenCalledWith(expect.stringMatching(/Falha/), 'error')
  })
})

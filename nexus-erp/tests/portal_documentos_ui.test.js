// @vitest-environment jsdom
// ============================================================
// Testes — Portal · Documentos no front (portal_documentos.js).
// ============================================================
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

let chamadas = []
const DOCS = {
  documentos: [
    { id: 2, tipo: 'CND Federal', arquivo_nome: 'cnd-nova.pdf', validade: '2026-12-01', situacao: 'Válido', vigente: true },
    { id: 1, tipo: 'CND Federal', arquivo_nome: 'cnd.pdf', validade: '2026-06-01', situacao: 'Vencido', vigente: false },
    { id: 3, tipo: 'CRF FGTS', arquivo_nome: 'fgts.pdf', validade: '2026-07-10', situacao: 'Vencido', vigente: true },
  ],
  resumo: { total_vigentes: 2, validos: 1, a_vencer: 0, vencidos: 1, alertas: [{ tipo: 'CRF FGTS', situacao: 'Vencido' }] },
}

beforeAll(async () => {
  window.showToast = vi.fn(); window.closeModal = vi.fn(); window.openModal = vi.fn()
  window.apiAuth = vi.fn(async (path, opts = {}) => {
    chamadas.push({ path, method: (opts.method || 'GET').toUpperCase(), body: opts.body ? JSON.parse(opts.body) : null })
    if (path === '/api/portal/documentos' && (!opts.method || opts.method === 'GET')) return DOCS
    if (path === '/api/portal/acessos') return [{ quando: '2026-07-08 10:00:00', ip: '1.2.3.4' }]
    return { ok: true }
  })
  await import('../public/js/nexus_api.js')
  await import('../public/js/pages/portal_documentos.js')
})

beforeEach(() => { chamadas = []; vi.clearAllMocks(); document.body.innerHTML = '<div id="portal_docs"></div>' })

describe('_portalDocsHTML (puro)', () => {
  it('marca vigente vs substituído e alerta de vencido', () => {
    const html = window._portalDocsHTML(DOCS)
    expect(html).toContain('Meus Documentos')
    expect(html).toContain('(substituído)')
    expect(html).toContain('⚠ Vencido')
    expect(html).toContain('1 vencido(s)')
  })
  it('sem documentos mostra estado vazio; ausente não quebra', () => {
    expect(window._portalDocsHTML({ documentos: [], resumo: {} })).toContain('Nenhum documento')
    expect(window._portalDocsHTML(null)).toBe('')
  })
})

describe('ações', () => {
  it('enviar documento POSTa tipo/validade (sem arquivo anexado)', async () => {
    document.body.innerHTML += `<input id="pdoc_tipo" value="CND Federal"><input id="pdoc_val" value="2027-01-01"><input id="pdoc_num" value="123">`
    await window.portalEnviarDocumento()
    const post = chamadas.find(c => c.method === 'POST' && c.path === '/api/portal/documentos')
    expect(post.body).toMatchObject({ tipo: 'CND Federal', validade: '2027-01-01', arquivo_id: null })
    expect(window.showToast).toHaveBeenCalledWith(expect.stringMatching(/compliance/), 'success')
  })
  it('sem tipo não POSTa', async () => {
    document.body.innerHTML += `<input id="pdoc_tipo" value="">`
    await window.portalEnviarDocumento()
    expect(chamadas.some(c => c.method === 'POST')).toBe(false)
  })
  it('trocar senha POSTa atual + nova', async () => {
    document.body.innerHTML += `<input id="psen_atual" value="Aa@123456"><input id="psen_nova" value="Bb@123456">`
    await window.portalConfirmarTrocaSenha()
    const post = chamadas.find(c => c.method === 'POST' && c.path === '/api/portal/trocar-senha')
    expect(post.body).toEqual({ senha_atual: 'Aa@123456', senha_nova: 'Bb@123456' })
  })
})

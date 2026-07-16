// @vitest-environment jsdom
// ============================================================
// Testes — Comprador · UI de convites de fornecedor (fornecedor_convites.js).
// ============================================================
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

let chamadas = []
const CONVITES = [
  { email: 'a@f.com', fornecedor_nome: 'Aço Novo', situacao: 'pendente', expira_em: '2026-07-16T00:00:00.000Z' },
  { email: 'b@f.com', fornecedor_nome: 'Chapas', situacao: 'aceito', expira_em: '2026-07-10T00:00:00.000Z' },
  { email: 'c@f.com', fornecedor_nome: '<img src=x onerror=alert(1)>', situacao: 'expirado', expira_em: '2026-01-01T00:00:00.000Z' },
]

beforeAll(async () => {
  window.showToast = vi.fn(); window.closeModal = vi.fn(); window.openModal = vi.fn(); window.logAction = vi.fn()
  window.apiAuth = vi.fn(async (path, opts = {}) => {
    chamadas.push({ path, method: (opts.method || 'GET').toUpperCase(), body: opts.body ? JSON.parse(opts.body) : null })
    if (path === '/api/fornecedor-convites' && (!opts.method || opts.method === 'GET')) return CONVITES
    if (path === '/api/fornecedor-convites') return { token: 'tok123', link: '/portal/convite?token=tok123' }
    return {}
  })
  await import('../public/js/nexus_api.js')
  await import('../public/js/pages/fornecedor_convites.js')
})

beforeEach(() => { chamadas = []; document.body.innerHTML = '<div id="mainContent"></div>' })

describe('_convitesHTML (puro)', () => {
  it('renderiza situações e escapa o nome (dado externo)', () => {
    const html = window._convitesHTML(CONVITES)
    expect(html).toContain('✓ Aceito')
    expect(html).toContain('Pendente')
    expect(html).toContain('Expirado')
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;img')
  })
  it('lista vazia mostra estado amigável', () => {
    expect(window._convitesHTML([])).toContain('Nenhum convite')
  })
})

describe('enviar convite', () => {
  it('sem e-mail/nome não POSTa (aviso)', async () => {
    document.body.innerHTML += `<input id="cv_email" value=""><input id="cv_nome" value=""><input id="cv_cnpj" value=""><div id="cv_link"></div>`
    await window.enviarConviteFornecedor()
    expect(chamadas.some(c => c.method === 'POST')).toBe(false)
    expect(window.showToast).toHaveBeenCalledWith(expect.stringMatching(/e-mail e nome/i), 'warning')
  })
  it('POSTa e mostra o link do convite gerado', async () => {
    document.body.innerHTML += `<input id="cv_email" value="novo@f.com"><input id="cv_nome" value="Aço Novo"><input id="cv_cnpj" value="11.222.333/0001-44"><div id="cv_link"></div>`
    await window.enviarConviteFornecedor()
    const post = chamadas.find(c => c.method === 'POST' && c.path === '/api/fornecedor-convites')
    expect(post.body).toMatchObject({ email: 'novo@f.com', nome: 'Aço Novo' })
    expect(document.getElementById('cv_link').innerHTML).toContain('/portal/convite?token=tok123')
  })
})

describe('render + carregar', () => {
  it('carrega a lista e injeta a grade', async () => {
    await window.renderConvitesFornecedor()
    await new Promise(r => setTimeout(r, 10))
    expect(chamadas.some(c => c.path === '/api/fornecedor-convites')).toBe(true)
    expect(document.getElementById('mainContent').innerHTML).toContain('Aço Novo')
  })
})

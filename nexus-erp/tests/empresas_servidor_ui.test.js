// @vitest-environment jsdom
// ============================================================
// Testes — Gestão de tenants no front (modal de empresas).
// listar/criar via /api/empresas, detecção do tenant mestre e criação
// guiada (novaEmpresaServidor) com prompt.
// ============================================================
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

let chamadas = []

beforeAll(async () => {
  global.fetch = vi.fn(async (url, opts = {}) => {
    const path = String(url).replace(/\?.*$/, '')
    const method = (opts.method || 'GET').toUpperCase()
    chamadas.push({ path, method, body: opts.body ? JSON.parse(opts.body) : null })
    let data = []
    if (path === '/api/empresas' && method === 'GET') data = [
      { id: 1, razao_social: 'Empresa Padrão', plano: 'padrao' },
      { id: 2, razao_social: 'Cliente B S.A.', nome_fantasia: 'B Corp', cnpj: '11.222.333/0001-81', plano: 'padrao' },
    ]
    if (path === '/api/empresas' && method === 'POST') data = { id: 3, razao_social: opts.body ? JSON.parse(opts.body).razao_social : '?' }
    return { ok: true, status: 200, json: async () => ({ success: true, data }) }
  })
  await import('../public/js/nexus_api.js')
  await import('../public/js/empresas.js')
})

beforeEach(() => { chamadas = [] })

describe('listarEmpresasServidor', () => {
  it('busca /api/empresas e devolve a lista', async () => {
    const list = await window.listarEmpresasServidor()
    expect(list.length).toBe(2)
    expect(list[1].razao_social).toBe('Cliente B S.A.')
    expect(chamadas.some(c => c.path === '/api/empresas' && c.method === 'GET')).toBe(true)
  })
})

describe('criarEmpresaServidor', () => {
  it('POSTa razão social/fantasia/cnpj para /api/empresas', async () => {
    const r = await window.criarEmpresaServidor({ razao_social: 'Novo Cliente', nome_fantasia: 'NC', cnpj: null })
    expect(r.id).toBe(3)
    const post = chamadas.find(c => c.method === 'POST' && c.path === '/api/empresas')
    expect(post.body.razao_social).toBe('Novo Cliente')
  })
})

describe('_souTenantMestre', () => {
  it('true quando a empresa do servidor é a 1; false para outras/sem cache', () => {
    localStorage.setItem('fa_empresa_atual', JSON.stringify({ id: 1, razao_social: 'Empresa Padrão' }))
    expect(window._souTenantMestre()).toBe(true)
    localStorage.setItem('fa_empresa_atual', JSON.stringify({ id: 2, razao_social: 'B' }))
    expect(window._souTenantMestre()).toBe(false)
    localStorage.removeItem('fa_empresa_atual')
    expect(window._souTenantMestre()).toBe(false)
  })
})

describe('novaEmpresaServidor (fluxo guiado)', () => {
  it('cria com os dados do prompt e reabre o modal', async () => {
    const prompts = ['Cliente Z Ltda', 'Z', '']
    window.prompt = vi.fn(() => prompts.shift())
    window.showToast = vi.fn()
    window.closeModal = vi.fn()
    window.openModalWide = vi.fn()
    await window.novaEmpresaServidor()
    const post = chamadas.find(c => c.method === 'POST' && c.path === '/api/empresas')
    expect(post.body.razao_social).toBe('Cliente Z Ltda')
    expect(window.showToast).toHaveBeenCalledWith(expect.stringMatching(/criado/), 'success')
  })

  it('cancela silenciosamente quando o prompt vem vazio', async () => {
    window.prompt = vi.fn(() => '')
    await window.novaEmpresaServidor()
    expect(chamadas.some(c => c.method === 'POST')).toBe(false)
  })
})

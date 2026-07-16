// @vitest-environment jsdom
// ============================================================
// Testes — aba "Dados de Demonstração" (demo_dados.js).
// Botão que semeia todos os módulos e mostra a contagem ao vivo por módulo.
// ============================================================
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

beforeAll(async () => {
  window.NexusAPI = { escapeHtml: s => String(s == null ? '' : s), post: vi.fn() }
  window.showToast = () => {}
  window.navigate = () => {}
  await import('../public/js/pages/demo_dados.js')
})

beforeEach(() => {
  document.body.innerHTML = '<div id="mainContent"></div>'
})

describe('_demoDadosHTML (puro)', () => {
  it('lista todos os módulos e o botão de simular', () => {
    const html = window._demoDadosHTML({ contagens: {} })
    expect(html).toContain('Inserir dados de simulação')
    expect(html).toContain('Materiais (MM / BOM)')
    expect(html).toContain('Cotações (RFQ)')
    expect(html).toContain('Mapa Comparativo')
    expect(html).toContain('SSMA')
    expect(html).toContain("navigate('mm')")
  })
  it('mostra a contagem e destaca módulos com dados', () => {
    const html = window._demoDadosHTML({ contagens: { mm: 9, pp: 0, rfq: 1 } })
    expect(html).toContain('9 registro(s)')
    expect(html).toContain('1 registro(s)')
    expect(html).toContain('vazio')          // pp: 0
    expect(html).toMatch(/\d+\/15 módulo\(s\) com dados/)
  })
  it('sinaliza servidor indisponível', () => {
    const html = window._demoDadosHTML({ contagens: {}, semServidor: true })
    expect(html).toContain('Servidor indisponível')
  })
})

describe('_demoDadosCarregarContagens', () => {
  it('busca a contagem de cada módulo via apiAuth', async () => {
    window.apiAuth = vi.fn(async (url) => (url === '/api/mm/materiais' ? [1, 2, 3] : []))
    const c = await window._demoDadosCarregarContagens()
    expect(c.mm).toBe(3)
    expect(c.pp).toBe(0)
    expect(window.apiAuth).toHaveBeenCalledWith('/api/rfq')
  })
  it('sem apiAuth → null (modo offline), sem quebrar', async () => {
    const saved = window.apiAuth
    window.apiAuth = undefined
    expect(await window._demoDadosCarregarContagens()).toBeNull()
    window.apiAuth = saved
  })
})

describe('renderDemoDados', () => {
  it('injeta a página e as contagens no mainContent', async () => {
    window.apiAuth = vi.fn(async () => [{}, {}])
    await window.renderDemoDados()
    expect(document.getElementById('mainContent').innerHTML).toContain('Dados de Demonstração')
    expect(document.getElementById('mainContent').innerHTML).toContain('2 registro(s)')
  })
})

describe('simularDadosDemo', () => {
  it('POSTa /api/demo/seed e mostra sucesso; recarrega contagens', async () => {
    const toasts = []
    window.showToast = m => toasts.push(m)
    window.NexusAPI.post = vi.fn(async () => ({ semeado: true, roteiro: [1, 2, 3, 4] }))
    window.apiAuth = vi.fn(async () => [{}])
    document.getElementById('mainContent').innerHTML = window._demoDadosHTML({ contagens: {} })
    await window.simularDadosDemo()
    expect(window.NexusAPI.post).toHaveBeenCalledWith('/api/demo/seed', {})
    expect(toasts.join(' ')).toMatch(/populados|inserido/i)
  })
  it('top-up: já existia mas completou módulos → mensagem específica', async () => {
    const toasts = []
    window.showToast = m => toasts.push(m)
    window.NexusAPI.post = vi.fn(async () => ({ ja_existia: true, modulos_completados: true, roteiro: [1, 2, 3, 4] }))
    window.apiAuth = vi.fn(async () => [{}])
    await window.simularDadosDemo()
    expect(toasts.join(' ')).toMatch(/completados/i)
  })
  it('perfil sem permissão (sem roteiro) → erro', async () => {
    const toasts = []
    window.showToast = m => toasts.push(m)
    window.NexusAPI.post = vi.fn(async () => ({}))
    window.apiAuth = vi.fn(async () => [])
    await window.simularDadosDemo()
    expect(toasts.join(' ')).toMatch(/administrador/i)
  })
})

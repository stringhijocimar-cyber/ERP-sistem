// @vitest-environment jsdom
// ============================================================
// Testes — painel de EPIs no front (ssma_epis.js).
// ============================================================
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const ALERTAS = { vencidos: 1, a_vencer: 1, total: 2 }
const LISTA = [
  { colaborador_nome: 'João', epi: 'Capacete', ca: '31469', validade: '2030-01-01', situacao: 'Válido' },
  { colaborador_nome: 'Maria', epi: 'Bota', ca: '111', validade: '2024-01-01', situacao: 'Vencido' },
]

beforeAll(async () => {
  await import('../public/js/nexus_api.js')
  await import('../public/js/pages/ssma_epis.js')
})

beforeEach(() => { document.body.innerHTML = '<div id="ssmaEpis"></div>' })

describe('_ssmaEpisHTML (puro)', () => {
  it('renderiza tabela com situação e alerta de vencido', () => {
    const html = window._ssmaEpisHTML(ALERTAS, LISTA)
    expect(html).toContain('EPIs por colaborador')
    expect(html).toContain('Vencido')
    expect(html).toContain('EPI(s) vencido(s) em uso')
    expect(html).toContain('Capacete')
  })
  it('escapa conteúdo do usuário', () => {
    const html = window._ssmaEpisHTML(ALERTAS, [{ colaborador_nome: '<b>x</b>', epi: 'y', situacao: 'Válido' }])
    expect(html).not.toContain('<b>x</b>')
    expect(html).toContain('&lt;b&gt;')
  })
  it('lista vazia mostra estado vazio (sem alerta)', () => {
    const html = window._ssmaEpisHTML({ vencidos: 0, a_vencer: 0, total: 0 }, [])
    expect(html).toContain('Nenhuma entrega de EPI registrada')
    expect(html).not.toContain('vencido(s) em uso')
  })
})

describe('_carregarSsmaEpis', () => {
  it('busca alertas + lista e injeta no container', async () => {
    window.apiAuth = vi.fn(async (url) => url.endsWith('/alertas') ? ALERTAS : LISTA)
    await window._carregarSsmaEpis()
    expect(window.apiAuth).toHaveBeenCalledWith('/api/ssma/epis/alertas')
    expect(window.apiAuth).toHaveBeenCalledWith('/api/ssma/epis')
    expect(document.getElementById('ssmaEpis').innerHTML).toContain('EPIs por colaborador')
  })
})

// @vitest-environment jsdom
// ============================================================
// Testes — painel de treinamentos/matriz NR no front (ssma_treinamentos.js).
// ============================================================
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const ALERTAS = { vencidos: 1, a_vencer: 1, bloqueantes: 1, total: 2 }
const LISTA = [
  { colaborador_nome: 'Maria', tipo: 'NR-35', descricao: 'Altura', validade: '2024-01-01', situacao: 'Vencido', bloqueia_risco: true },
  { colaborador_nome: 'João', tipo: 'NR-05', descricao: 'CIPA', validade: '2030-01-01', situacao: 'Válido', bloqueia_risco: false },
]

beforeAll(async () => {
  await import('../public/js/nexus_api.js')
  await import('../public/js/pages/ssma_treinamentos.js')
})

beforeEach(() => { document.body.innerHTML = '<div id="ssmaTreinamentos"></div>' })

describe('_ssmaTreinamentosHTML (puro)', () => {
  it('renderiza matriz + alerta de bloqueio', () => {
    const html = window._ssmaTreinamentosHTML(ALERTAS, LISTA)
    expect(html).toContain('Treinamentos / matriz NR')
    expect(html).toContain('colaborador BLOQUEADO')
    expect(html).toContain('NR-35')
  })
  it('escapa conteúdo do usuário', () => {
    const html = window._ssmaTreinamentosHTML(ALERTAS, [{ colaborador_nome: '<b>x</b>', tipo: 'y', situacao: 'Válido' }])
    expect(html).not.toContain('<b>x</b>')
    expect(html).toContain('&lt;b&gt;')
  })
  it('sem bloqueantes não mostra alerta vermelho', () => {
    const html = window._ssmaTreinamentosHTML({ vencidos: 0, a_vencer: 0, bloqueantes: 0, total: 0 }, [])
    expect(html).toContain('Nenhum treinamento registrado')
    expect(html).not.toContain('BLOQUEADO')
  })
})

describe('_carregarSsmaTreinamentos', () => {
  it('busca alertas + lista e injeta', async () => {
    window.apiAuth = vi.fn(async (url) => url.endsWith('/alertas') ? ALERTAS : LISTA)
    await window._carregarSsmaTreinamentos()
    expect(window.apiAuth).toHaveBeenCalledWith('/api/ssma/treinamentos/alertas')
    expect(window.apiAuth).toHaveBeenCalledWith('/api/ssma/treinamentos')
    expect(document.getElementById('ssmaTreinamentos').innerHTML).toContain('Treinamentos / matriz NR')
  })
})

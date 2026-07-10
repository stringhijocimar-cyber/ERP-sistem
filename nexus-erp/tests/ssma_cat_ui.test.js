// @vitest-environment jsdom
// ============================================================
// Testes — painel de CAT/S-2210 no front (ssma_cat.js).
// ============================================================
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const PEND = { total: 1, atrasadas: 1, pendentes: [{ id: 7, numero: 'SSMA-2026-002', colaborador_nome: 'Pedro', data_ocorrencia: '2026-06-01', prazo_legal: '2026-06-02', situacao: 'Atrasada' }] }
const CATS = [{ id: 3, numero: 'CAT-2026-001', colaborador_nome: 'Ana', tipo: 'Inicial', data_acidente: '2026-07-08', prazo_legal: '2026-07-09', situacao: 'Emitida no prazo' }]

beforeAll(async () => {
  await import('../public/js/nexus_api.js')
  await import('../public/js/pages/ssma_cat.js')
})

beforeEach(() => { document.body.innerHTML = '<div id="ssmaCat"></div>' })

describe('_ssmaCatHTML (puro)', () => {
  it('renderiza pendências, alerta de prazo e CATs emitidas', () => {
    const html = window._ssmaCatHTML(PEND, CATS)
    expect(html).toContain('CAT / eSocial S-2210')
    expect(html).toContain('fora do prazo legal')
    expect(html).toContain('Emitir CAT')
    expect(html).toContain('CAT-2026-001')
  })
  it('escapa conteúdo do usuário', () => {
    const html = window._ssmaCatHTML({ total: 0, atrasadas: 0, pendentes: [] }, [{ id: 1, numero: '<b>x</b>', tipo: 'Inicial', situacao: 'Emitida no prazo' }])
    expect(html).not.toContain('<b>x</b>')
    expect(html).toContain('&lt;b&gt;')
  })
  it('sem pendências nem CATs mostra estado vazio', () => {
    const html = window._ssmaCatHTML({ total: 0, atrasadas: 0, pendentes: [] }, [])
    expect(html).toContain('Nenhum acidente com afastamento pendente')
    expect(html).not.toContain('fora do prazo legal')
  })
})

describe('_carregarSsmaCat', () => {
  it('busca pendências + CATs e injeta', async () => {
    window.apiAuth = vi.fn(async (url) => url.includes('pendentes') ? PEND : CATS)
    await window._carregarSsmaCat()
    expect(window.apiAuth).toHaveBeenCalledWith('/api/ssma/cat/pendentes/alertas')
    expect(window.apiAuth).toHaveBeenCalledWith('/api/ssma/cat')
    expect(document.getElementById('ssmaCat').innerHTML).toContain('CAT / eSocial S-2210')
  })
})

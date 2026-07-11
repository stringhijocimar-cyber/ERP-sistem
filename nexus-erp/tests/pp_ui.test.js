// @vitest-environment jsdom
// ============================================================
// Testes — página PP no front (pp.js): lista de ordens, progresso e ações.
// ============================================================
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const ORDENS = [
  { id: 1, numero: 'OP-2026-001', projeto: 'Guarani', veiculos_plan: 10, veiculos_produzidos: 4, status: 'Em Produção' },
  { id: 2, numero: 'OP-2026-002', projeto: 'Guarani', veiculos_plan: 5, veiculos_produzidos: 0, status: 'Planejada' },
  { id: 3, numero: 'OP-2026-003', projeto: null, veiculos_plan: 3, veiculos_produzidos: 3, status: 'Concluída' },
]

beforeAll(async () => {
  await import('../public/js/nexus_api.js')
  await import('../public/js/pages/pp.js')
})

beforeEach(() => { document.body.innerHTML = '<div id="mainContent"></div><div id="ppOrdens"></div>' })

describe('_ppOrdensHTML (puro)', () => {
  it('mostra KPIs, progresso e ações por status', () => {
    const html = window._ppOrdensHTML(ORDENS)
    expect(html).toContain('OP-2026-001')
    expect(html).toContain('4/10')
    expect(html).toContain('Apontar')  // Em Produção
    expect(html).toContain('Liberar')  // Planejada
    expect(html).toContain('Concluída')
    // KPI: 7 produzidos de 18 planejados
    expect(html).toContain('18')
    expect(html).toContain('7')
  })
  it('escapa conteúdo do usuário', () => {
    const html = window._ppOrdensHTML([{ id: 9, numero: '<b>x</b>', veiculos_plan: 1, veiculos_produzidos: 0, status: 'Planejada' }])
    expect(html).not.toContain('<b>x</b>')
    expect(html).toContain('&lt;b&gt;')
  })
  it('lista vazia mostra estado vazio', () => {
    expect(window._ppOrdensHTML([])).toContain('Nenhuma ordem de produção')
  })
})

describe('_carregarPP', () => {
  it('busca /api/pp/ordens e injeta', async () => {
    window.apiAuth = vi.fn(async () => ORDENS)
    await window._carregarPP()
    expect(window.apiAuth).toHaveBeenCalledWith('/api/pp/ordens')
    expect(document.getElementById('ppOrdens').innerHTML).toContain('OP-2026-001')
  })
})

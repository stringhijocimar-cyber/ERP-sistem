// @vitest-environment jsdom
// ============================================================
// Testes — página MM no front (mm.js): resumo, tabela e gate visual.
// ============================================================
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const MATS = [
  { id: 1, part_number: 'MEC-000-001', descricao: 'Sistema', sistema: 'Mecânica', make_buy: 'MAKE', nivel: 1, qtd_veiculo: 1, criticidade: 'Alta', eng_liberado_compras: 0 },
  { id: 2, part_number: 'MEC-100-001', descricao: 'Motor', sistema: 'Mecânica', make_buy: 'BUY', nivel: 2, qtd_veiculo: 1, criticidade: 'Alta', eng_liberado_compras: 0 },
  { id: 3, part_number: 'MEC-100-002', descricao: 'Filtro', make_buy: 'BUY', nivel: 3, qtd_veiculo: 2, criticidade: 'Média', eng_liberado_compras: 1 },
]

beforeAll(async () => {
  await import('../public/js/nexus_api.js')
  await import('../public/js/pages/mm.js')
})

beforeEach(() => { document.body.innerHTML = '<div id="mmMateriais"></div>' })

describe('_mmResumo (puro)', () => {
  it('conta BUY/MAKE, sem engenharia e críticos', () => {
    const r = window._mmResumo(MATS)
    expect(r.total).toBe(3)
    expect(r.buy).toBe(2)
    expect(r.make).toBe(1)
    expect(r.sem_eng).toBe(1) // só o motor BUY sem liberação
    expect(r.criticos).toBe(2)
  })
})

describe('_mmMateriaisHTML (puro)', () => {
  it('mostra gate Bloqueado/Liberado e alerta de itens sem engenharia', () => {
    const html = window._mmMateriaisHTML(MATS)
    expect(html).toContain('Bloqueado')
    expect(html).toContain('Liberado')
    expect(html).toContain('sem engenharia liberada')
    expect(html).toContain('MEC-100-001')
  })
  it('escapa conteúdo do usuário', () => {
    const html = window._mmMateriaisHTML([{ id: 9, part_number: '<b>x</b>', make_buy: 'BUY', nivel: 1, qtd_veiculo: 1, eng_liberado_compras: 1 }])
    expect(html).not.toContain('<b>x</b>')
    expect(html).toContain('&lt;b&gt;')
  })
})

describe('_carregarMM', () => {
  it('busca /api/mm/materiais e injeta', async () => {
    window.apiAuth = vi.fn(async () => MATS)
    await window._carregarMM()
    expect(window.apiAuth).toHaveBeenCalledWith('/api/mm/materiais')
    expect(document.getElementById('mmMateriais').innerHTML).toContain('Part Number')
  })
})

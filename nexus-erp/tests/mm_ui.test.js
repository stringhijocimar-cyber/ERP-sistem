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

describe('_mmSourcingHTML (puro)', () => {
  const D = {
    resumo: { make: 1, bloqueado: 1, a_cotar: 1, em_cotacao: 1 },
    materiais: [
      { id: 1, part_number: 'MEC-000-001', make_buy: 'MAKE', status_sourcing: 'MAKE' },
      { id: 2, part_number: 'MEC-100-001', descricao: 'Motor', status_sourcing: 'A cotar', rfq_numero: null },
      { id: 3, part_number: 'MEC-100-002', descricao: 'Filtro', status_sourcing: 'Em cotação', rfq_numero: 'RFQ-2026-001' },
    ],
  }
  it('mostra status, esconde MAKE da tabela e traz botão de lote', () => {
    const html = window._mmSourcingHTML(D)
    expect(html).toContain('RFQ automática')
    expect(html).toContain('A cotar')
    expect(html).toContain('RFQ-2026-001')
    expect(html).toContain('Gerar RFQs em lote (1)')
    // MAKE não aparece como linha de sourcing
    expect(html).not.toContain('MEC-000-001')
  })
  it('vazio não quebra', () => expect(window._mmSourcingHTML(null)).toBe(''))
})

describe('_mmQualidadeHTML (puro)', () => {
  it('mostra bloqueios e gate de produção', () => {
    const html = window._mmQualidadeHTML({ total_buy: 3, liberados: 1, bloqueados: 2, itens: [
      { id: 2, part_number: 'MEC-100-001', descricao: 'Motor', sistema: 'Mecânica', status_qualidade: 'Sem PPAP' },
    ] })
    expect(html).toContain('gate de produção')
    expect(html).toContain('bloqueando a produção')
    expect(html).toContain('Submeter PPAP')
    expect(html).toContain('MEC-100-001')
  })
  it('sem bloqueios mostra liberado', () => {
    const html = window._mmQualidadeHTML({ total_buy: 2, liberados: 2, bloqueados: 0, itens: [] })
    expect(html).toContain('liberados para produção')
    expect(html).not.toContain('bloqueando a produção')
  })
  it('nulo não quebra', () => expect(window._mmQualidadeHTML(null)).toBe(''))
})

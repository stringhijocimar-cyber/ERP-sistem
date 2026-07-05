// @vitest-environment jsdom
// ============================================================
// Testes — painel real de estoque no front (estoque_real.js).
// _estoqueRealHTML puro + _carregarEstoqueReal (fetch + injeta).
// ============================================================
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const REP = { total: 1, custo_estimado_total: 80, itens: [
  { id: 1, codigo: 'LUVA-01', descricao: 'Luva nitrílica', quantidade_atual: 15, quantidade_minima: 20, sugestao_compra: 25, custo_estimado: 75 },
] }
const VAL = { total: 45, itens: 1, por_categoria: [{ categoria: 'EPI', valor: 45 }] }

beforeAll(async () => {
  window.fmt = v => 'R$ ' + Number(v || 0).toLocaleString('pt-BR')
  window.apiAuth = vi.fn(async (path) => path.includes('reposicao') ? REP : VAL)
  await import('../public/js/nexus_api.js')
  await import('../public/js/pages/estoque_real.js')
})

beforeEach(() => { document.body.innerHTML = '<div id="estoqueRealPanel"></div>' })

describe('_estoqueRealHTML (puro)', () => {
  it('renderiza reposição e valorização', () => {
    const html = window._estoqueRealHTML(REP, VAL)
    expect(html).toContain('Ponto de reposição')
    expect(html).toContain('LUVA-01')
    expect(html).toContain('Valorização do estoque')
    expect(html).toContain('EPI')
  })
  it('sem itens abaixo do mínimo mostra mensagem positiva', () => {
    const html = window._estoqueRealHTML({ itens: [] }, VAL)
    expect(html).toContain('Nenhum item abaixo do mínimo')
  })
  it('escapa HTML da descrição (dado do banco)', () => {
    const html = window._estoqueRealHTML({ itens: [{ codigo: 'X', descricao: '<img src=x onerror=alert(1)>', quantidade_atual: 0, quantidade_minima: 1, sugestao_compra: 2, custo_estimado: 0 }] }, VAL)
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;img')
  })
})

describe('_carregarEstoqueReal', () => {
  it('busca reposição+valorização e injeta o painel', async () => {
    await window._carregarEstoqueReal()
    expect(window.apiAuth).toHaveBeenCalledWith('/api/almoxarifado/reposicao')
    expect(window.apiAuth).toHaveBeenCalledWith('/api/almoxarifado/valorizacao')
    expect(document.getElementById('estoqueRealPanel').innerHTML).toContain('LUVA-01')
  })
})

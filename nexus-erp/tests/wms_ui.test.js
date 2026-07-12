// @vitest-environment jsdom
// ============================================================
// Testes — página WMS no front (wms.js): endereços com ocupação + posição.
// ============================================================
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const ENDS = [
  { id: 1, codigo: 'A-01', zona: 'Recebimento', descricao: 'Rua A', usado: 20, capacidade: 50, ocupacao_pct: 40, cheio: false },
  { id: 2, codigo: 'A-02', zona: 'Picking', usado: 40, capacidade: 40, ocupacao_pct: 100, cheio: true },
]
const POS = { quantidade_atual: 80, saldo_enderecado: 50, saldo_nao_enderecado: 30, posicoes: [{ endereco_id: 1, codigo: 'A-01', zona: 'Recebimento', quantidade: 30 }] }

beforeAll(async () => {
  await import('../public/js/nexus_api.js')
  await import('../public/js/pages/wms.js')
})

beforeEach(() => { document.body.innerHTML = '<div id="wmsEnderecos"></div><div id="wmsPosicao"></div>' })

describe('_wmsEnderecosHTML (puro)', () => {
  it('mostra ocupação e sinaliza cheio', () => {
    const html = window._wmsEnderecosHTML(ENDS)
    expect(html).toContain('A-01')
    expect(html).toContain('40%')
    expect(html).toContain('cheio')
  })
  it('escapa conteúdo do usuário', () => {
    const html = window._wmsEnderecosHTML([{ id: 9, codigo: '<b>x</b>', usado: 0 }])
    expect(html).not.toContain('<b>x</b>')
    expect(html).toContain('&lt;b&gt;')
  })
  it('vazio mostra estado vazio', () => {
    expect(window._wmsEnderecosHTML([])).toContain('Nenhum endereço cadastrado')
  })
})

describe('_wmsPosicaoHTML (puro)', () => {
  it('mostra endereçado, a guardar e posições', () => {
    const html = window._wmsPosicaoHTML(POS)
    expect(html).toContain('A guardar')
    expect(html).toContain('30')
    expect(html).toContain('A-01')
  })
  it('nulo não quebra', () => expect(window._wmsPosicaoHTML(null)).toBe(''))
})

describe('wmsVerPosicao', () => {
  it('busca a posição e injeta', async () => {
    window.apiAuth = vi.fn(async () => POS)
    await window.wmsVerPosicao(1)
    expect(window.apiAuth).toHaveBeenCalledWith('/api/almoxarifado/1/enderecos')
    expect(document.getElementById('wmsPosicao').innerHTML).toContain('Endereçado')
  })
})

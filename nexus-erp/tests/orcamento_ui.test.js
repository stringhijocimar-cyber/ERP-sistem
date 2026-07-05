// @vitest-environment jsdom
// ============================================================
// Testes — página Orçamento (front): _orcamentoHTML puro + render + salvar meta.
// ============================================================
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

function mkMes(mes, receitaMeta, receitaReal) {
  const cmp = (m, r) => ({ meta: m, real: r, desvio: r - m, atingido_pct: m > 0 ? Math.round(r / m * 100) : (r > 0 ? 100 : 0) })
  return { mes, receita: cmp(receitaMeta, receitaReal), custo: cmp(0, 0), despesa: cmp(0, 0), resultado_meta: receitaMeta, resultado_real: receitaReal, resultado_desvio: receitaReal - receitaMeta }
}
const ORC = {
  ano: 2026,
  meses: Array.from({ length: 12 }, (_, i) => mkMes(i + 1, i === 4 ? 120000 : 0, i === 4 ? 90000 : 0)),
  total: { receita: { meta: 120000, real: 90000, desvio: -30000, atingido_pct: 75 }, custo: { meta: 0, real: 0, desvio: 0, atingido_pct: 0 }, despesa: { meta: 0, real: 0, desvio: 0, atingido_pct: 0 }, resultado_meta: 120000, resultado_real: 90000, resultado_desvio: -30000 },
}

let chamadas = []
beforeAll(async () => {
  window.apiAuth = vi.fn(async (path, opts = {}) => {
    chamadas.push({ path, method: (opts.method || 'GET').toUpperCase(), body: opts.body || null })
    if (String(path).startsWith('/api/orcamento?')) return ORC
    return { ok: true }
  })
  window.showToast = vi.fn()
  window.fmt = v => 'R$ ' + Number(v || 0).toLocaleString('pt-BR')
  await import('../public/js/pages/orcamento.js')
})

beforeEach(() => { chamadas = []; document.body.innerHTML = '<div id="mainContent"></div>' })

describe('_orcamentoHTML (puro)', () => {
  it('renderiza 12 meses, % atingido e totais', () => {
    const html = window._orcamentoHTML(ORC)
    expect(html).toContain('Mai')
    expect(html).toContain('75%')
    expect(html).toContain('Receita — realizada')
  })
  it('ausente não quebra', () => {
    expect(window._orcamentoHTML(null)).toBe('')
  })
})

describe('render + salvar meta', () => {
  it('carrega /api/orcamento e injeta a grade', async () => {
    await window.renderOrcamento()
    await new Promise(r => setTimeout(r, 10))
    expect(chamadas.some(c => String(c.path).startsWith('/api/orcamento?'))).toBe(true)
    expect(document.getElementById('mainContent').innerHTML).toContain('75%')
  })
  it('salvarMetaMes POSTa /api/orcamento com ano/mes/metas', async () => {
    window._orcamentoAno = 2026
    document.body.innerHTML += `<input id="meta_receita" value="100000"><input id="meta_custo" value="30000"><input id="meta_despesa" value="10000">`
    await window.salvarMetaMes(5)
    const post = chamadas.find(c => c.method === 'POST' && c.path === '/api/orcamento')
    expect(post.body).toMatchObject({ ano: 2026, mes: 5, receita_meta: 100000, custo_meta: 30000 })
  })
})

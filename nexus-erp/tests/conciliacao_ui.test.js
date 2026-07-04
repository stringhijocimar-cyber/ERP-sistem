// @vitest-environment jsdom
// ============================================================
// Testes — página Conciliação Bancária (front).
// _conciliacaoResumo (puro) + carregamento/ações via apiAuth.
// ============================================================
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

let sugestoes = []
let chamadas = []

beforeAll(async () => {
  window.apiAuth = vi.fn(async (path, opts = {}) => {
    chamadas.push({ path, method: (opts.method || 'GET').toUpperCase(), body: opts.body || null })
    if (path === '/api/conciliacao/sugestoes') return sugestoes
    return { importados: 1 }
  })
  window.showToast = vi.fn(); window.logAction = vi.fn()
  window.fmt = v => 'R$ ' + Number(v || 0).toLocaleString('pt-BR')
  await import('../public/js/nexus_api.js')
  await import('../public/js/pages/conciliacao.js')
})

beforeEach(() => { chamadas = []; document.body.innerHTML = '<div id="mainContent"></div>' })

describe('_conciliacaoResumo (puro)', () => {
  it('conta com/sem sugestão e soma créditos/débitos', () => {
    const r = window._conciliacaoResumo([
      { lancamento: { tipo: 'debito', valor: 1200 }, sugestao: { ref_id: 1 } },
      { lancamento: { tipo: 'credito', valor: 3000 }, sugestao: { ref_id: 2 } },
      { lancamento: { tipo: 'debito', valor: 30 }, sugestao: null },
    ])
    expect(r.total).toBe(3)
    expect(r.comSugestao).toBe(2)
    expect(r.semSugestao).toBe(1)
    expect(r.valorCred).toBe(3000)
    expect(r.valorDeb).toBe(1230)
  })
  it('lista vazia/ausente não quebra', () => {
    expect(window._conciliacaoResumo(undefined).total).toBe(0)
  })
})

describe('renderConciliacao — dados reais', () => {
  it('monta a tabela a partir de /api/conciliacao/sugestoes', async () => {
    sugestoes = [{ lancamento: { id: 5, data: '2026-05-11', descricao: 'PAG FORNECEDOR', valor: 1200, tipo: 'debito' },
                  sugestao: { tipo: 'contas_pagar', ref_id: 9, numero: 'CP-C', parte: 'F Conc', score: 95 } }]
    await window.renderConciliacao()
    await new Promise(r => setTimeout(r, 10))
    const html = document.getElementById('mainContent').innerHTML
    expect(chamadas.some(c => c.path === '/api/conciliacao/sugestoes')).toBe(true)
    expect(html).toContain('PAG FORNECEDOR')
    expect(html).toContain('CP-C')
    expect(html).toContain('match 95%')
  })
  it('escapa HTML do histórico (dado do banco)', async () => {
    sugestoes = [{ lancamento: { id: 6, data: '2026-05-01', descricao: '<img src=x onerror=alert(1)>', valor: 1, tipo: 'credito' }, sugestao: null }]
    await window.renderConciliacao()
    await new Promise(r => setTimeout(r, 10))
    const html = document.getElementById('mainContent').innerHTML
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;img')
  })
})

describe('ações', () => {
  it('conciliarLanc POSTa /:id/conciliar com tipo/ref_id', async () => {
    await window.conciliarLanc(5, 'contas_pagar', 9)
    const post = chamadas.find(c => c.method === 'POST' && c.path === '/api/conciliacao/5/conciliar')
    expect(post.body).toMatchObject({ tipo: 'contas_pagar', ref_id: 9 })
  })
  it('ignorarLanc POSTa /:id/ignorar', async () => {
    await window.ignorarLanc(7)
    expect(chamadas.some(c => c.method === 'POST' && c.path === '/api/conciliacao/7/ignorar')).toBe(true)
  })
})

// @vitest-environment jsdom
// ============================================================
// Testes — página Faturamento REAL (consome /api/contas-receber).
// _faturamentoResumo (puro): pipeline por status + totais + atraso.
// _carregarFaturamento: monta a tabela a partir do servidor.
// receberFatura/salvarNovaFatura: ações via NexusAPI.
// ============================================================
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

let contasServidor = []
let chamadas = []

beforeAll(async () => {
  // apiAuth é usado pelo financeiro.js (retorna o data direto).
  window.apiAuth = vi.fn(async (path, opts = {}) => {
    chamadas.push({ path, method: (opts.method || 'GET').toUpperCase() })
    if (path === '/api/contas-receber') return contasServidor
    return []
  })
  global.fetch = vi.fn(async (url, opts = {}) => {
    chamadas.push({ path: String(url).replace(/\?.*$/, ''), method: (opts.method || 'GET').toUpperCase(), body: opts.body ? JSON.parse(opts.body) : null })
    return { ok: true, status: 200, json: async () => ({ success: true, data: { id: 9, numero: 'CR-2026-009', status: 'Recebida' } }) }
  })
  window.showToast = vi.fn(); window.closeModal = vi.fn(); window.logAction = vi.fn(); window.openModal = vi.fn()
  window.fmt = v => 'R$ ' + Number(v || 0).toLocaleString('pt-BR')
  window.statusBadge = s => `<span class="badge">${s}</span>`
  await import('../public/js/nexus_api.js')
  await import('../public/js/pages/financeiro.js')
})

beforeEach(() => { chamadas = []; document.body.innerHTML = '<div id="mainContent"></div>' })

const ONTEM = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
const AMANHA = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)

describe('_faturamentoResumo (puro)', () => {
  it('classifica status e detecta atraso; soma totais', () => {
    const R = window._faturamentoResumo([
      { id: 1, status: 'A Faturar', valor: 1000 },
      { id: 2, status: 'A Receber', valor: 2000, data_vencimento: AMANHA },
      { id: 3, status: 'A Receber', valor: 500, data_vencimento: ONTEM },   // atraso
      { id: 4, status: 'Recebida', valor: 3000, data_recebimento: ONTEM },
    ])
    const byLabel = l => R.pipeline.find(p => p.label === l).count
    expect(byLabel('A Faturar')).toBe(1)
    expect(byLabel('A Receber')).toBe(1)
    expect(byLabel('Em Atraso')).toBe(1)
    expect(byLabel('Recebida')).toBe(1)
    expect(R.aReceberTotal).toBe(2500)   // a receber (2000) + atraso (500)
    expect(R.recebidoTotal).toBe(3000)
    expect(R.atrasoTotal).toBe(500)
  })
  it('lista vazia/ausente não quebra', () => {
    expect(window._faturamentoResumo(undefined).aReceberTotal).toBe(0)
  })
})

describe('renderFaturamento — dados reais do servidor', () => {
  it('monta a tabela a partir de /api/contas-receber (não usa mais seed)', async () => {
    contasServidor = [{ id: 7, numero: 'CR-2026-007', cliente: 'Minera Serra Azul', descricao: 'Medição 07', valor: 250000, status: 'A Receber', data_vencimento: AMANHA }]
    window.renderFaturamento()
    await new Promise(r => setTimeout(r, 10))
    const html = document.getElementById('mainContent').innerHTML
    expect(chamadas.some(c => c.path === '/api/contas-receber')).toBe(true)
    expect(html).toContain('CR-2026-007')
    expect(html).toContain('Minera Serra Azul')
  })

  it('escapa HTML do cliente (dado do banco)', async () => {
    contasServidor = [{ id: 8, numero: 'CR-X', cliente: '<img src=x onerror=alert(1)>', valor: 1, status: 'A Receber' }]
    window.renderFaturamento()
    await new Promise(r => setTimeout(r, 10))
    const html = document.getElementById('mainContent').innerHTML
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;img')
  })
})

describe('ações reais', () => {
  it('receberFatura POSTa /:id/receber', async () => {
    await window.receberFatura('7')
    expect(chamadas.some(c => c.method === 'POST' && c.path === '/api/contas-receber/7/receber')).toBe(true)
  })
  it('salvarNovaFatura POSTa /api/contas-receber com cliente/valor', async () => {
    document.body.innerHTML += `<input id="nf_cliente" value="ACME"><input id="nf_valor" value="5000"><input id="nf_desc" value="ref"><input id="nf_contrato" value=""><input id="nf_venc" value="2026-10-01">`
    await window.salvarNovaFatura()
    const post = chamadas.find(c => c.method === 'POST' && c.path === '/api/contas-receber')
    expect(post.body.cliente).toBe('ACME')
    expect(post.body.valor).toBe(5000)
  })
  it('salvarNovaFatura sem cliente/valor não POSTa', async () => {
    document.body.innerHTML += `<input id="nf_cliente" value=""><input id="nf_valor" value="">`
    await window.salvarNovaFatura()
    expect(chamadas.some(c => c.method === 'POST' && c.path === '/api/contas-receber')).toBe(false)
  })
})

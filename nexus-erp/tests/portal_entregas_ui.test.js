// @vitest-environment jsdom
// ============================================================
// Testes — Portal · Entregas no front (portal_entregas.js).
// ============================================================
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

let chamadas = []
const DATA = {
  entregas: [
    { id: 1, pc_numero: 'PC-2026-001', valor: 50000, data_prometida: '2026-07-20', data_confirmada: null, status_efetivo: 'Programada' },
    { id: 2, pc_numero: 'PC-2026-002', valor: 30000, data_prometida: '2026-07-01', data_confirmada: null, status_efetivo: 'Atrasada' },
    { id: 3, pc_numero: 'PC-2026-003', valor: 10000, data_prometida: '2026-06-01', data_entregue: '2026-06-01', status_efetivo: 'Entregue' },
  ],
  resumo: { otif_pct: 100, atrasadas_abertas: 1, entregues: 1, abertas: 2 },
}

beforeAll(async () => {
  window.showToast = vi.fn(); window.closeModal = vi.fn(); window.openModal = vi.fn()
  window.fmt = v => 'R$ ' + Number(v || 0).toLocaleString('pt-BR')
  window.apiAuth = vi.fn(async (path, opts = {}) => {
    chamadas.push({ path, method: (opts.method || 'GET').toUpperCase(), body: opts.body ? JSON.parse(opts.body) : null })
    if (path === '/api/portal/entregas') return DATA
    return {}
  })
  await import('../public/js/nexus_api.js')
  await import('../public/js/pages/portal_entregas.js')
})

beforeEach(() => { chamadas = []; vi.clearAllMocks(); document.body.innerHTML = '<div id="portal_entregas"></div>' })

describe('_portalEntregasHTML (puro)', () => {
  it('renderiza situações (programada/atrasada/entregue) e OTIF no cabeçalho', () => {
    const html = window._portalEntregasHTML(DATA)
    expect(html).toContain('Minhas Entregas')
    expect(html).toContain('⚠ Atrasada')
    expect(html).toContain('✓ Entregue')
    expect(html).toContain('OTIF: <b')
    expect(html).toContain('1 atrasada(s)')
  })
  it('entrega concluída não tem botão de ação; aberta tem Confirmar/Replanejar', () => {
    const html = window._portalEntregasHTML(DATA)
    expect(html).toContain('portalConfirmarEntrega(1)')
    expect((html.match(/portalConfirmarEntrega\(/g) || []).length).toBe(2) // ids 1 e 2, não a 3
  })
  it('vazio/ausente não quebra', () => {
    expect(window._portalEntregasHTML({ entregas: [], resumo: {} })).toContain('Nenhuma entrega')
    expect(window._portalEntregasHTML(null)).toBe('')
  })
})

describe('ações', () => {
  it('confirmar POSTa sem data (mantém a promessa)', async () => {
    await window.portalConfirmarEntrega(1)
    const post = chamadas.find(c => c.method === 'POST' && c.path === '/api/portal/entregas/1/confirmar')
    expect(post.body).toEqual({})
    expect(window.showToast).toHaveBeenCalledWith(expect.stringMatching(/confirmado/), 'success')
  })
  it('replanejar exige data + justificativa antes de POSTar', async () => {
    document.body.innerHTML += `<input id="pent_data" value=""><textarea id="pent_just"></textarea>`
    await window.portalEnviarReplanejamento(2)
    expect(chamadas.some(c => c.method === 'POST')).toBe(false)
    document.getElementById('pent_data').value = '2026-08-01'
    document.getElementById('pent_just').value = 'Aciaria em manutenção'
    await window.portalEnviarReplanejamento(2)
    const post = chamadas.find(c => c.method === 'POST' && c.path === '/api/portal/entregas/2/confirmar')
    expect(post.body).toMatchObject({ data_confirmada: '2026-08-01', justificativa: 'Aciaria em manutenção' })
  })
})

// @vitest-environment jsdom
// ============================================================
// Testes — Portal RFQ no front (portal_rfq.js): lista pura, coleta de
// itens do formulário e envio da cotação.
// ============================================================
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

let chamadas = []
const RFQS = [
  { id: 1, numero: 'RFQ-2026-001', titulo: 'Chapa A36', prazo_resposta: '2099-12-31', status: 'Aberta', convite_status: 'Convidado', prazo_expirado: false, pode_responder: true },
  { id: 2, numero: 'RFQ-2026-002', titulo: 'Perfil W', prazo_resposta: '2020-01-01', status: 'Aberta', convite_status: 'Convidado', prazo_expirado: true, pode_responder: false },
  { id: 3, numero: 'RFQ-2026-003', titulo: 'Tubo sch40', prazo_resposta: '2099-12-31', status: 'Aberta', convite_status: 'Respondida', prazo_expirado: false, pode_responder: true },
]

beforeAll(async () => {
  window.showToast = vi.fn(); window.closeModal = vi.fn(); window.openModal = vi.fn()
  window.apiAuth = vi.fn(async (path, opts = {}) => {
    chamadas.push({ path, method: (opts.method || 'GET').toUpperCase(), body: opts.body ? JSON.parse(opts.body) : null })
    if (path === '/api/portal/rfq') return RFQS
    if (path.includes('/cotacao')) return { valor_total: 25800, revisada: false }
    return {}
  })
  await import('../public/js/nexus_api.js')
  await import('../public/js/pages/portal_rfq.js')
})

beforeEach(() => { chamadas = []; document.body.innerHTML = '<div id="portal_rfq"></div>' })

describe('_portalRfqHTML (puro)', () => {
  it('renderiza situação correta por RFQ (aguardando / expirada / respondida)', () => {
    const html = window._portalRfqHTML(RFQS)
    expect(html).toContain('RFQ-2026-001')
    expect(html).toContain('Aguardando resposta')
    expect(html).toContain('Prazo expirado')
    expect(html).toContain('✓ Respondida')
    expect(html).toContain('Revisar cotação') // respondida mas ainda no prazo
  })
  it('lista vazia mostra mensagem amigável', () => {
    expect(window._portalRfqHTML([])).toContain('Nenhuma solicitação')
  })
  it('escapa HTML do título (dado vindo do comprador)', () => {
    const html = window._portalRfqHTML([{ id: 9, numero: 'X', titulo: '<img src=x onerror=alert(1)>', pode_responder: true }])
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;img')
  })
})

describe('_portalColetarItens + portalEnviarCotacao', () => {
  it('coleta itens válidos do formulário e POSTa a cotação', async () => {
    document.body.innerHTML += `
      <div class="prfq-item">
        <input class="prfq-desc" value="Chapa A36 3/4"><input class="prfq-qtd" value="10">
        <input class="prfq-un" value="PC"><input class="prfq-vu" value="2400">
      </div>
      <div class="prfq-item">
        <input class="prfq-desc" value=""><input class="prfq-qtd" value="1">
        <input class="prfq-un" value="UN"><input class="prfq-vu" value="0">
      </div>
      <input id="prfq_prazo" value="12"><input id="prfq_cond" value="28 dias"><textarea id="prfq_obs">ok</textarea>`
    await window.portalEnviarCotacao(1)
    const post = chamadas.find(c => c.method === 'POST' && c.path === '/api/portal/rfq/1/cotacao')
    expect(post.body.itens).toHaveLength(1) // linha vazia filtrada
    expect(post.body.itens[0]).toMatchObject({ descricao: 'Chapa A36 3/4', quantidade: 10, valor_unitario: 2400 })
    expect(post.body.prazo_entrega).toBe(12)
    expect(window.showToast).toHaveBeenCalledWith(expect.stringMatching(/enviada/), 'success')
  })
  it('sem item válido não POSTa (aviso)', async () => {
    document.body.innerHTML = '<div id="portal_rfq"></div>' // sem .prfq-item
    await window.portalEnviarCotacao(1)
    expect(chamadas.some(c => c.method === 'POST')).toBe(false)
    expect(window.showToast).toHaveBeenCalledWith(expect.stringMatching(/ao menos um item/), 'warning')
  })
})

describe('_portalCarregarRFQs', () => {
  it('busca /api/portal/rfq e injeta a lista', async () => {
    await window._portalCarregarRFQs()
    expect(chamadas.some(c => c.path === '/api/portal/rfq')).toBe(true)
    expect(document.getElementById('portal_rfq').innerHTML).toContain('RFQ-2026-001')
  })
})

// @vitest-environment jsdom
// ============================================================
// Testes — migração das telas RFQ e Mapa Comparativo para a API
// (/api/rfq, /api/mapas). A API é a fonte de verdade; linhas locais legadas
// seguem visíveis via merge; a escrita nunca persiste linhas da API.
// ============================================================
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const RFQ_SERVIDOR = {
  id: 5, numero: 'RFQ-2026-005', titulo: 'Cotação de chapa', descricao: '80 chapas',
  status: 'Em Análise', valor_estimado: 148000, rc_numero: 'RC-2026-003',
  created_at: '2026-07-11 09:00:00', total_cotacoes: 2,
  fornecedores: [{ fornecedor_id: 3, nome: 'Aço Forte', status: 'Respondida' }],
}
const MAPA_SERVIDOR = {
  id: 4, numero: 'MC-2026-004', rfq_id: 5, rfq_numero: 'RFQ-2026-005', rfq_titulo: 'Cotação de chapa',
  cotacao_vencedora_id: 9, fornecedor_vencedor_id: 3, fornecedor_vencedor_nome: 'Aço Forte',
  status: 'Em Análise', valor_aprovado: 140000, economia_gerada: 12000, justificativa: 'Menor preço',
  created_at: '2026-07-12 10:00:00',
}

beforeAll(async () => {
  window.currentUser = { profile: 'compras', name: 'Comprador' }
  window.showToast = () => {}
  window.fmt = v => 'R$ ' + Number(v || 0)
  await import('../public/js/nexus_api.js')
  await import('../public/js/pages/procurement.js')
})

beforeEach(() => {
  localStorage.clear()
  window._procRFQAPICache = null
  window._procMapasAPICache = null
})

describe('_rfqAdaptarAPI (servidor → tela)', () => {
  it('mapeia campos, traduz status e marca origem api', () => {
    const a = window._rfqAdaptarAPI(RFQ_SERVIDOR)
    expect(a.numero).toBe('RFQ-2026-005')
    expect(a.id).toBe('RFQ-2026-005')
    expect(a._apiId).toBe(5)
    expect(a.titulo).toBe('Cotação de chapa')
    expect(a.status).toBe('Cotações Recebidas')      // 'Em Análise' → tela
    expect(a.data_criacao).toBe('2026-07-11')
    expect(a.total_cotacoes).toBe(2)
    expect(a.fornecedores[0].nome).toBe('Aço Forte')
    expect(a.origem).toBe('api')
  })
  it('traduz status Aberta → Em Cotação e Aprovada → Aprovada', () => {
    expect(window._rfqAdaptarAPI({ ...RFQ_SERVIDOR, status: 'Aberta' }).status).toBe('Em Cotação')
    expect(window._rfqAdaptarAPI({ ...RFQ_SERVIDOR, status: 'Aprovada' }).status).toBe('Aprovada')
  })
})

describe('_mapaAdaptarAPI (servidor → tela)', () => {
  it('mapeia campos, traduz status e marca origem api', () => {
    const a = window._mapaAdaptarAPI(MAPA_SERVIDOR)
    expect(a.id).toBe('MC-2026-004')
    expect(a._apiId).toBe(4)
    expect(a.numero_rfq).toBe('RFQ-2026-005')
    expect(a.forn_recomendado_nome).toBe('Aço Forte')
    expect(a.valor_aprovado).toBe(140000)
    expect(a.status).toBe('Aguardando Aprovação')     // 'Em Análise' → aguardando
    expect(a.origem).toBe('api')
  })
  it('traduz status Aprovado → Aprovada e Reprovado → Cancelada', () => {
    expect(window._mapaAdaptarAPI({ ...MAPA_SERVIDOR, status: 'Aprovado', aprovado_por: 'Diretor' }).status).toBe('Aprovada')
    expect(window._mapaAdaptarAPI({ ...MAPA_SERVIDOR, status: 'Aprovado', aprovado_por: 'Diretor' }).aprovado_por).toBe('Diretor')
    expect(window._mapaAdaptarAPI({ ...MAPA_SERVIDOR, status: 'Reprovado' }).status).toBe('Cancelada')
  })
})

describe('_mergeRFQs (merge API + legado local)', () => {
  it('injeta as RFQs da API + locais (nada some) e API vem primeiro', () => {
    localStorage.setItem('fa_rfqs', JSON.stringify([{ id: 'RFQ-LOCAL-1', numero: 'RFQ-LOCAL-1', status: 'Em Cotação', data_criacao: '2026-01-01' }]))
    window._procRFQAPICache = [window._rfqAdaptarAPI(RFQ_SERVIDOR)]
    const lista = window._mergeRFQs()
    expect(lista.length).toBe(2)
    expect(lista.some(r => r.numero === 'RFQ-2026-005' && r.origem === 'api')).toBe(true)
    expect(lista.some(r => r.numero === 'RFQ-LOCAL-1')).toBe(true)
  })
  it('NUNCA persiste linhas da API nos storages locais', () => {
    window._procRFQAPICache = [window._rfqAdaptarAPI(RFQ_SERVIDOR)]
    window._mergeRFQs()
    const salvas = JSON.parse(localStorage.getItem('fa_rfqs') || '[]')
    expect(salvas.some(r => r.origem === 'api')).toBe(false)
  })
  it('sem API (offline): retorna só as locais', () => {
    localStorage.setItem('fa_rfqs', JSON.stringify([{ id: 'X', numero: 'X', status: 'Em Cotação' }]))
    expect(window._mergeRFQs().length).toBe(1)
  })
})

describe('_getMatrizes / _saveMatrizes (merge + anti-duplicação)', () => {
  it('injeta os mapas da API além dos locais', () => {
    localStorage.setItem('fa_matrizes', JSON.stringify([{ id: 'MAP-LOCAL-1', numero: 'MAP-LOCAL-1', status: 'Aprovada' }]))
    window._procMapasAPICache = [window._mapaAdaptarAPI(MAPA_SERVIDOR)]
    const lista = window._getMatrizes()
    expect(lista.length).toBe(2)
    expect(lista.some(m => m.id === 'MC-2026-004' && m.origem === 'api')).toBe(true)
  })
  it('_saveMatrizes nunca persiste linhas da API', () => {
    window._saveMatrizes([
      { id: 'MC-2026-004', origem: 'api' },
      { id: 'MAP-LOCAL-1' },
    ])
    const salvas = JSON.parse(localStorage.getItem('fa_matrizes'))
    expect(salvas.length).toBe(1)
    expect(salvas[0].id).toBe('MAP-LOCAL-1')
  })
})

describe('loaders _procCarregar*API', () => {
  it('RFQ: popula o cache a partir de /api/rfq', async () => {
    window.apiAuth = vi.fn(async () => [RFQ_SERVIDOR])
    expect(await window._procCarregarRFQAPI()).toBe(true)
    expect(window.apiAuth).toHaveBeenCalledWith('/api/rfq')
    expect(window._procRFQAPICache[0].origem).toBe('api')
  })
  it('Mapa: popula o cache a partir de /api/mapas', async () => {
    window.apiAuth = vi.fn(async () => [MAPA_SERVIDOR])
    expect(await window._procCarregarMapasAPI()).toBe(true)
    expect(window.apiAuth).toHaveBeenCalledWith('/api/mapas')
    expect(window._procMapasAPICache[0]._apiId).toBe(4)
  })
  it('falha de rede → cache null (modo local), sem quebrar', async () => {
    window.apiAuth = vi.fn(async () => { throw new Error('offline') })
    expect(await window._procCarregarRFQAPI()).toBe(false)
    expect(window._procRFQAPICache).toBeNull()
    expect(await window._procCarregarMapasAPI()).toBe(false)
    expect(window._procMapasAPICache).toBeNull()
  })
})

describe('emissão de RFQ pela API (_rfqCriarViaAPI / _rfqConvidarViaAPI)', () => {
  it('cria a RFQ no servidor com o payload mapeado', async () => {
    window.apiAuth = vi.fn(async () => ({ id: 9, numero: 'RFQ-2026-009' }))
    const rfq = await window._rfqCriarViaAPI({ titulo: 'Compra X', descricao: '2 PC — parafuso', valor_estimado: 1200 })
    expect(rfq.numero).toBe('RFQ-2026-009')
    const [url, opts] = window.apiAuth.mock.calls[0]
    expect(url).toBe('/api/rfq')
    expect(opts.method).toBe('POST')
    expect(opts.body.titulo).toBe('Compra X')
    expect(opts.body.valor_estimado).toBe(1200)
    expect(opts.body.fornecedor_ids).toEqual([])
  })
  it('criar: validação do servidor → { erro:true } + toast', async () => {
    const toasts = []
    window.showToast = m => toasts.push(m)
    window.apiAuth = vi.fn(async () => { throw new Error('Título obrigatório') })
    expect(await window._rfqCriarViaAPI({ titulo: '' })).toEqual({ erro: true })
    expect(toasts.join(' ')).toMatch(/obrigatório/i)
  })
  it('criar: sem servidor (rede) → null (chamador cai no modo local)', async () => {
    window.apiAuth = vi.fn(async () => { throw new TypeError('Failed to fetch') })
    expect(await window._rfqCriarViaAPI({ titulo: 'X' })).toBeNull()
  })
  it('convida fornecedores da RFQ da API', async () => {
    window.apiAuth = vi.fn(async () => ({ convidados: 2, fornecedores: [{}, {}] }))
    const r = await window._rfqConvidarViaAPI(9, [3, 4])
    expect(r.convidados).toBe(2)
    const [url, opts] = window.apiAuth.mock.calls[0]
    expect(url).toBe('/api/rfq/9/fornecedores')
    expect(opts.body.fornecedor_ids).toEqual([3, 4])
  })
  it('convidar: sem servidor → null', async () => {
    window.apiAuth = vi.fn(async () => { throw new TypeError('network error') })
    expect(await window._rfqConvidarViaAPI(9, [3])).toBeNull()
  })
})

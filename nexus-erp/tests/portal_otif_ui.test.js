// @vitest-environment jsdom
// ============================================================
// Testes — gráfico de tendência de OTIF no front (portal_entregas.js).
// ============================================================
import { beforeAll, describe, expect, it, vi } from 'vitest'

beforeAll(async () => {
  window.fmt = v => 'R$ ' + Number(v || 0).toLocaleString('pt-BR')
  window.apiAuth = vi.fn(async () => ({ entregas: [], resumo: {} }))
  await import('../public/js/nexus_api.js')
  await import('../public/js/pages/portal_entregas.js')
})

describe('_portalOtifTendenciaHTML (puro)', () => {
  const buckets = [
    { mes: '2026-02', entregues: 2, no_prazo: 1, otif_pct: 50 },
    { mes: '2026-03', entregues: 0, no_prazo: 0, otif_pct: null },
    { mes: '2026-04', entregues: 4, no_prazo: 4, otif_pct: 100 },
  ]
  it('renderiza barras com rótulos de mês e % (mês sem entrega = "—")', () => {
    const html = window._portalOtifTendenciaHTML(buckets)
    expect(html).toContain('Tendência de OTIF')
    expect(html).toContain('50%')
    expect(html).toContain('100%')
    expect(html).toContain('>—<')       // mês sem entregas
    expect(html).toContain('>02<')      // rótulo fev
    expect(html).toContain('>04<')      // rótulo abr
  })
  it('lista vazia/ausente não quebra', () => {
    expect(window._portalOtifTendenciaHTML([])).toBe('')
    expect(window._portalOtifTendenciaHTML(null)).toBe('')
  })
})

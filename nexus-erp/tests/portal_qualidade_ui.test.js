// @vitest-environment jsdom
// ============================================================
// Testes — Portal · Qualidade no front (portal_qualidade.js).
// ============================================================
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const Q = {
  medias: { geral: 3.5, qualidade: 2, prazo: 4, preco: 4, atendimento: 4, total: 3 },
  avaliacoes: [{ nota_media: 3.5, comentario: 'Chapa fora de espessura', created_at: '2026-07-08 10:00:00' }],
  alertas: [
    { tipo: 'qualidade_baixa', detalhe: 'Avaliação de qualidade 2/5 — Chapa fora de espessura' },
    { tipo: 'documento_vencido', detalhe: 'CRF FGTS — vencido (validade 2026-07-06)' },
  ],
  otif: { otif_pct: 88 },
}

beforeAll(async () => {
  window.fmt = v => 'R$ ' + Number(v || 0).toLocaleString('pt-BR')
  window.apiAuth = vi.fn(async () => Q)
  await import('../public/js/nexus_api.js')
  await import('../public/js/pages/portal_qualidade.js')
})

beforeEach(() => { document.body.innerHTML = '<div id="portal_qualidade"></div>' })

describe('_portalQualidadeHTML (puro)', () => {
  it('renderiza dimensões, alertas e comentários', () => {
    const html = window._portalQualidadeHTML(Q)
    expect(html).toContain('Minha Qualidade')
    expect(html).toContain('2/5')                       // nota de qualidade baixa
    expect(html).toContain('Chapa fora de espessura')
    expect(html).toContain('CRF FGTS')
  })
  it('sem avaliações mostra estado vazio; ausente não quebra', () => {
    expect(window._portalQualidadeHTML({ medias: { total: 0 }, avaliacoes: [], alertas: [] })).toContain('sem avaliações')
    expect(window._portalQualidadeHTML(null)).toBe('')
  })
  it('escapa HTML do comentário (dado da contratante)', () => {
    const html = window._portalQualidadeHTML({ medias: { total: 1, geral: 3 }, avaliacoes: [{ nota_media: 3, comentario: '<img src=x onerror=alert(1)>', created_at: '2026-01-01' }], alertas: [] })
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;img')
  })
})

describe('_portalCarregarQualidade', () => {
  it('busca /api/portal/qualidade e injeta a seção', async () => {
    await window._portalCarregarQualidade()
    expect(window.apiAuth).toHaveBeenCalledWith('/api/portal/qualidade')
    expect(document.getElementById('portal_qualidade').innerHTML).toContain('Minha Qualidade')
  })
})

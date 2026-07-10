// @vitest-environment jsdom
// ============================================================
// Testes — painel de indicadores HSE no front (ssma_indicadores.js).
// ============================================================
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const IND = {
  total: 3, com_afastamento: 1, sem_afastamento: 2, dias_perdidos: 10, hht: 500000,
  tf: 2, tg: 20, dias_sem_acidente: 45, ultimo_acidente: '2026-05-10',
  por_gravidade: [{ gravidade: 'Alta', qtd: 1 }, { gravidade: 'Baixa', qtd: 2 }],
}

beforeAll(async () => {
  window.apiAuth = vi.fn(async () => IND)
  await import('../public/js/nexus_api.js')
  await import('../public/js/pages/ssma_indicadores.js')
})

beforeEach(() => { document.body.innerHTML = '<div id="ssmaIndicadores"></div>' })

describe('_ssmaIndicadoresHTML (puro)', () => {
  it('renderiza TF/TG, dias sem acidente e por gravidade', () => {
    const html = window._ssmaIndicadoresHTML(IND)
    expect(html).toContain('Taxa de Frequência')
    expect(html).toContain('Taxa de Gravidade')
    expect(html).toContain('45')       // dias sem acidente
    expect(html).toContain('Alta: <b>1')
  })
  it('sem HHT (TF/TG null) mostra aviso de horas-homem', () => {
    const html = window._ssmaIndicadoresHTML({ ...IND, tf: null, tg: null })
    expect(html).toContain('informe as horas-homem')
  })
  it('ausente não quebra', () => expect(window._ssmaIndicadoresHTML(null)).toBe(''))
})

describe('_carregarSsmaIndicadores', () => {
  it('busca /api/ssma/indicadores e injeta', async () => {
    await window._carregarSsmaIndicadores()
    expect(window.apiAuth).toHaveBeenCalledWith('/api/ssma/indicadores')
    expect(document.getElementById('ssmaIndicadores').innerHTML).toContain('Indicadores HSE')
  })
})

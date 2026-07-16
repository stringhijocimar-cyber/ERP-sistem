// @vitest-environment jsdom
// ============================================================
// Testes — Painel Executivo no front (painel_executivo.js).
// ============================================================
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const PAINEL = {
  periodo: '2026',
  financeiro: { receita: 400000, resultado: 300000, margem_pct: 75, capital_giro: 250000, saldo_projetado: -5000, aperto_previsto: true, a_receber: 400000, a_pagar: 150000 },
  suprimentos: { pedidos_ativos: 3, pedidos_valor: 120000, rcs_pendentes: 2, estoque_valor: 90000, itens_reposicao: 4, anomalias_abertas: 1 },
  fornecedores: { total: 10, homologados: 7, otif_pct: 82, otif_sem_prazo: 0, entregas_atrasadas: 2, cotacoes_pendentes: 3, convites_pendentes: 1 },
  riscos: [
    { nivel: 'alto', area: 'Caixa', titulo: 'Aperto de caixa previsto', detalhe: 'Menor saldo -5000 na semana 2026-07-13' },
    { nivel: 'baixo', area: 'Estoque', titulo: '4 item(ns) no ponto de reposição', detalhe: 'Custo estimado 20000' },
  ],
}

beforeAll(async () => {
  window.fmt = v => 'R$ ' + Number(v || 0).toLocaleString('pt-BR')
  window.apiAuth = vi.fn(async () => PAINEL)
  await import('../public/js/nexus_api.js')
  await import('../public/js/pages/painel_executivo.js')
})

beforeEach(() => { document.body.innerHTML = '<div id="mainContent"></div>' })

describe('_painelExecutivoHTML (puro)', () => {
  it('renderiza as 3 seções e os KPIs', () => {
    const html = window._painelExecutivoHTML(PAINEL)
    expect(html).toContain('Financeiro')
    expect(html).toContain('Suprimentos')
    expect(html).toContain('Fornecedores & Entregas')
    expect(html).toContain('75%')       // margem
    expect(html).toContain('82%')       // OTIF
    expect(html).toContain('7/10')      // homologados
  })
  it('mostra aperto de caixa e os riscos priorizados', () => {
    const html = window._painelExecutivoHTML(PAINEL)
    expect(html).toContain('aperto previsto')
    expect(html).toContain('Aperto de caixa previsto')
    expect(html).toContain('ponto de reposição')
  })
  it('sem riscos mostra mensagem positiva; ausente não quebra', () => {
    expect(window._painelExecutivoHTML({ ...PAINEL, riscos: [] })).toContain('Nenhum risco crítico')
    expect(window._painelExecutivoHTML(null)).toBe('')
  })
  it('bloco industrial só aparece quando o tenant usa o MM', () => {
    // sem industrial (null) → seção ausente
    expect(window._painelExecutivoHTML(PAINEL)).not.toContain('Industrial (MM)')
    const html = window._painelExecutivoHTML({ ...PAINEL, industrial: {
      materiais: 30, buy: 20, sem_engenharia: 2, sem_cotacao: 3, sem_ppap: 5, criticos: 4,
      mrp_faltantes: 6, disponibilidade_pct: 70, veiculos_alvo: 50, veiculos_possiveis: 20,
    } })
    expect(html).toContain('Industrial (MM)')
    expect(html).toContain('20/50')            // veículos possíveis/alvo
    expect(html).toContain('70%')              // disponibilidade
    expect(html).toContain('bloqueiam o sourcing')
    expect(html).toContain('bloqueiam a produção')
  })
})

describe('renderPainelExecutivo', () => {
  it('busca /api/painel-executivo e injeta o cockpit', async () => {
    await window.renderPainelExecutivo()
    await new Promise(r => setTimeout(r, 10))
    expect(window.apiAuth).toHaveBeenCalledWith('/api/painel-executivo')
    expect(document.getElementById('mainContent').innerHTML).toContain('OTIF')
  })
})

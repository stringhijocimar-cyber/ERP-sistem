// Testes do motor de detecção de anomalias em compras (função pura).
import { describe, expect, it } from 'vitest'
import { detectarAnomalias } from '../public/js/lib/anomalias.js'

const hoje = '2026-06-16'
function pedido(fornecedor_id, valor, data = hoje, extra = {}) {
  return { fornecedor_id, valor, data, ...extra }
}

describe('detectarAnomalias', () => {
  it('pedido normal com histórico saudável → sem alertas', () => {
    const hist = [pedido('F1', 10000, '2026-05-10'), pedido('F1', 12000, '2026-05-20'),
                  pedido('F1', 9000, '2026-06-01'), pedido('F1', 11000, '2026-06-10')]
    const r = detectarAnomalias(pedido('F1', 10500), hist, { classificacao_credito: 'A' })
    expect(r.risco).toBe('Nenhum')
    expect(r.alertas).toHaveLength(0)
  })

  it('detecta fracionamento: vários pedidos abaixo da alçada que somados a furam', () => {
    const hist = [pedido('F1', 20000, '2026-06-02'), pedido('F1', 20000, '2026-06-05'),
                  pedido('F1', 18000, '2026-06-10')]
    // novo de 15000 → soma 73000 > alçada 50000, todos < 50000
    const r = detectarAnomalias(pedido('F1', 15000), hist, {}, { limiteAlcada: 50000 })
    expect(r.alertas.some(a => a.tipo === 'fracionamento')).toBe(true)
    expect(r.risco).toBe('Alto')
  })

  it('NÃO acusa fracionamento se um pedido já está acima da alçada (caminho normal de aprovação)', () => {
    const hist = [pedido('F1', 60000, '2026-06-02')]
    const r = detectarAnomalias(pedido('F1', 10000), hist, {}, { limiteAlcada: 50000 })
    expect(r.alertas.some(a => a.tipo === 'fracionamento')).toBe(false)
  })

  it('detecta valor fora da curva (outlier vs mediana)', () => {
    const hist = [pedido('F2', 5000, '2026-05-01'), pedido('F2', 6000, '2026-05-08'),
                  pedido('F2', 5500, '2026-05-15'), pedido('F2', 4800, '2026-05-22')]
    const r = detectarAnomalias(pedido('F2', 40000), hist)
    expect(r.alertas.some(a => a.tipo === 'fora_da_curva')).toBe(true)
  })

  it('detecta fornecedor novo recebendo valor alto', () => {
    const r = detectarAnomalias(pedido('F-NOVO', 80000), [], {}, { valorAltoNovoFornecedor: 30000 })
    expect(r.alertas.some(a => a.tipo === 'fornecedor_novo')).toBe(true)
  })

  it('integra crédito: classe D + valor alto = alerta de alta severidade', () => {
    const hist = Array.from({ length: 5 }, (_, i) => pedido('F3', 50000, '2026-05-0' + (i + 1)))
    const r = detectarAnomalias(pedido('F3', 60000), hist, { classificacao_credito: 'D', score_credito: 25 })
    const a = r.alertas.find(x => x.tipo === 'credito_baixo')
    expect(a).toBeTruthy()
    expect(a.severidade).toBe('alta')
  })

  it('detecta duplicidade (mesmo valor, mesmo fornecedor, janela curta)', () => {
    const hist = [pedido('F4', 25000, '2026-06-14')]
    const r = detectarAnomalias(pedido('F4', 25000, '2026-06-16'), hist, {}, { janelaDuplicidadeDias: 7 })
    expect(r.alertas.some(a => a.tipo === 'duplicidade')).toBe(true)
  })

  it('entrada vazia não quebra e retorna risco Nenhum', () => {
    const r = detectarAnomalias()
    expect(r.risco).toBe('Nenhum')
    expect(Array.isArray(r.alertas)).toBe(true)
  })
})

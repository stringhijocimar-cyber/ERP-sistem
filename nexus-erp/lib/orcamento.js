/**
 * orcamento.js — Orçamento anual (budget) × realizado. Puro, sem I/O.
 *
 * Compara metas mensais (receita/custo/despesa) com o realizado derivado da
 * DRE, calculando desvio e % de atingimento. O servidor injeta as metas
 * (do banco) e os realizados (de _montarDRE por mês).
 */

const _r2 = n => Math.round((Number(n) || 0) * 100) / 100

// Compara uma linha meta × real. Para receita, atingir mais é melhor; para
// custo/despesa, o sinal do desvio é interpretado pelo consumidor. Aqui só
// reportamos os números (desvio = real − meta; atingido = real/meta).
export function compararLinha(meta, real) {
  const m = _r2(meta), r = _r2(real)
  const desvio = _r2(r - m)
  const atingido_pct = m > 0 ? _r2((r / m) * 100) : (r > 0 ? 100 : 0)
  return { meta: m, real: r, desvio, atingido_pct }
}

// Monta o orçamento anual (12 meses) a partir de mapas por mês.
//   metasPorMes:  { 1: {receita_meta,custo_meta,despesa_meta}, ... }
//   realPorMes:   { 1: {receita,custos,despesas}, ... }
export function montarOrcamentoAnual(ano, metasPorMes = {}, realPorMes = {}) {
  const meses = []
  const acc = { receita_meta: 0, receita_real: 0, custo_meta: 0, custo_real: 0, despesa_meta: 0, despesa_real: 0 }
  for (let mes = 1; mes <= 12; mes++) {
    const meta = metasPorMes[mes] || {}
    const real = realPorMes[mes] || {}
    const receita = compararLinha(meta.receita_meta, real.receita)
    const custo = compararLinha(meta.custo_meta, real.custos)
    const despesa = compararLinha(meta.despesa_meta, real.despesas)
    const resultadoMeta = _r2((meta.receita_meta || 0) - (meta.custo_meta || 0) - (meta.despesa_meta || 0))
    const resultadoReal = _r2((real.receita || 0) - (real.custos || 0) - (real.despesas || 0))
    acc.receita_meta += receita.meta; acc.receita_real += receita.real
    acc.custo_meta += custo.meta; acc.custo_real += custo.real
    acc.despesa_meta += despesa.meta; acc.despesa_real += despesa.real
    meses.push({
      mes, receita, custo, despesa,
      resultado_meta: resultadoMeta, resultado_real: resultadoReal, resultado_desvio: _r2(resultadoReal - resultadoMeta),
    })
  }
  const total = {
    receita: compararLinha(acc.receita_meta, acc.receita_real),
    custo: compararLinha(acc.custo_meta, acc.custo_real),
    despesa: compararLinha(acc.despesa_meta, acc.despesa_real),
    resultado_meta: _r2(acc.receita_meta - acc.custo_meta - acc.despesa_meta),
    resultado_real: _r2(acc.receita_real - acc.custo_real - acc.despesa_real),
  }
  total.resultado_desvio = _r2(total.resultado_real - total.resultado_meta)
  return { ano: Number(ano), meses, total }
}

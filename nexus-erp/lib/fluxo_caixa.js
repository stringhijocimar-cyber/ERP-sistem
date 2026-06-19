/**
 * fluxo_caixa.js — Comparativo semanal de fluxo de caixa (saídas): planejado
 * (por vencimento) vs. realizado (por pagamento), com desvios e quebra por
 * contrato. Função pura, sem I/O — recebe as contas a pagar já carregadas.
 *
 * Saída:
 *   { semanas: [{ semana, inicio, fim, planejado, realizado, desvio }],
 *     por_contrato: [{ contrato, planejado, realizado, desvio }],
 *     resumo: { planejado_total, realizado_total, desvio_total } }
 */

const _ymd = d => d.toISOString().slice(0, 10)
const _addDias = (ymd, n) => _ymd(new Date(new Date(ymd + 'T00:00:00Z').getTime() + n * 864e5))
// Segunda-feira (UTC) da semana que contém `ymd`.
function _inicioSemana(ymd) {
  const d = new Date(ymd + 'T00:00:00Z')
  const dow = (d.getUTCDay() + 6) % 7 // 0 = segunda
  return _addDias(ymd, -dow)
}
const _r2 = n => Math.round(n * 100) / 100

export function montarFluxoCaixa(contas = [], { semanas = 8, hoje } = {}) {
  const base = hoje || _ymd(new Date())
  const inicio = _inicioSemana(base)
  const n = Math.max(1, Math.min(Number(semanas) || 8, 52))
  const fimWindow = _addDias(inicio, n * 7)

  const buckets = []
  for (let i = 0; i < n; i++) {
    const ini = _addDias(inicio, i * 7)
    buckets.push({ semana: ini, inicio: ini, fim: _addDias(ini, 7), planejado: 0, realizado: 0, desvio: 0 })
  }
  const inWin = ymd => ymd >= inicio && ymd < fimWindow
  const idx = ymd => Math.floor((Date.parse(ymd + 'T00:00:00Z') - Date.parse(inicio + 'T00:00:00Z')) / (7 * 864e5))

  const contratos = {}
  let planTot = 0, realTot = 0
  for (const c of contas) {
    const valor = Number(c.valor) || 0
    const venc = String(c.data_vencimento || c.vencimento || '').slice(0, 10)
    const pag = String(c.data_pagamento || '').slice(0, 10)
    const cancelada = c.status === 'Cancelado'
    const paga = c.status === 'Pago'
    const ckey = String(c.contrato_id || c.contrato || c.pc_numero || 'Sem contrato')
    if (!contratos[ckey]) contratos[ckey] = { contrato: ckey, planejado: 0, realizado: 0, desvio: 0 }

    if (venc && inWin(venc) && !cancelada) {
      buckets[idx(venc)].planejado += valor
      contratos[ckey].planejado += valor
      planTot += valor
    }
    if (pag && paga && inWin(pag)) {
      buckets[idx(pag)].realizado += valor
      contratos[ckey].realizado += valor
      realTot += valor
    }
  }
  for (const b of buckets) { b.planejado = _r2(b.planejado); b.realizado = _r2(b.realizado); b.desvio = _r2(b.realizado - b.planejado) }
  const por_contrato = Object.values(contratos)
    .map(c => ({ contrato: c.contrato, planejado: _r2(c.planejado), realizado: _r2(c.realizado), desvio: _r2(c.realizado - c.planejado) }))
    .filter(c => c.planejado || c.realizado)
    .sort((a, b) => Math.abs(b.desvio) - Math.abs(a.desvio))

  return {
    semanas: buckets,
    por_contrato,
    resumo: { planejado_total: _r2(planTot), realizado_total: _r2(realTot), desvio_total: _r2(realTot - planTot) },
  }
}

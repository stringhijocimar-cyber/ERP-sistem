/**
 * wbs_rollup.js — Consolida as linhas WBS por contrato: estimado × realizado,
 * desvio e % executado. Função pura (recebe as linhas já carregadas).
 *
 * Saída:
 *   { grupos: [{ chave, estimado, realizado, desvio, pct, linhas }],
 *     total: { estimado, realizado, desvio, linhas } }
 */
const _r2 = n => Math.round(n * 100) / 100
const _r1 = n => Math.round(n * 10) / 10

export function montarRollupWBS(linhas = []) {
  const map = {}
  let estTot = 0, realTot = 0
  for (const l of linhas) {
    if ((l.ativo ?? 1) === 0) continue
    const chave = String(l.contrato_id ?? l.centro_custo ?? 'Sem contrato')
    if (!map[chave]) map[chave] = { chave, estimado: 0, realizado: 0, linhas: 0 }
    const est = Number(l.valor_total_est) || 0
    const real = Number(l.custo_real) || 0
    map[chave].estimado += est
    map[chave].realizado += real
    map[chave].linhas++
    estTot += est; realTot += real
  }
  const grupos = Object.values(map).map(g => ({
    chave: g.chave,
    estimado: _r2(g.estimado),
    realizado: _r2(g.realizado),
    desvio: _r2(g.realizado - g.estimado),
    pct: g.estimado ? _r1((g.realizado / g.estimado) * 100) : 0,
    linhas: g.linhas,
  })).sort((a, b) => Math.abs(b.desvio) - Math.abs(a.desvio))
  return {
    grupos,
    total: { estimado: _r2(estTot), realizado: _r2(realTot), desvio: _r2(realTot - estTot), linhas: linhas.length },
  }
}

/**
 * pp_calendario.js — PP fase 2: calendário de produção (plan × real por mês)
 * e custo de materiais do apontamento. Puro, sem I/O.
 *
 * Espelha a aba "Calendário de Produção" da planilha: veículos planejados vs
 * produzidos por mês, % realizado e acumulados — a leitura de ritmo que diz
 * se o contrato (ex.: 50 veículos no ano) vai ser cumprido.
 */

// Custo dos materiais consumidos: Σ quantidade × custo médio vigente do item.
export function custoConsumo(consumo = [], custoPorPN = new Map()) {
  let total = 0
  const itens = (consumo || []).map(c => {
    const cu = custoPorPN.get(String(c.part_number || '').trim().toUpperCase()) || 0
    const ct = Math.round(c.quantidade * cu * 100) / 100
    total += ct
    return { ...c, custo_unitario: cu, custo_total: ct }
  })
  return { total: Math.round(total * 100) / 100, itens }
}

const _MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

/**
 * Monta o calendário do ano: para cada mês, plan (de pp_plano), real (soma dos
 * apontamentos no mês), % e acumulados. `hoje` (YYYY-MM-DD) define o status:
 * mês passado sem atingir o plano = Atrasado; mês futuro = Planejado.
 */
export function montarCalendario(plano = [], apontamentos = [], ano, hoje) {
  const y = String(ano)
  const mesAtual = String(hoje || '').slice(0, 7)
  const planPorMes = new Map()
  for (const p of plano || []) {
    const m = String(p.mes || '').slice(0, 7)
    if (m.startsWith(y)) planPorMes.set(m, (planPorMes.get(m) || 0) + (Number(p.veiculos_plan) || 0))
  }
  const realPorMes = new Map()
  let custoTotal = 0
  for (const a of apontamentos || []) {
    const m = String(a.data || '').slice(0, 7)
    if (!m.startsWith(y)) continue // calendário de UM ano: real E custo só do ano exibido
    custoTotal += Number(a.custo_materiais) || 0
    realPorMes.set(m, (realPorMes.get(m) || 0) + (Number(a.veiculos) || 0))
  }
  let acumPlan = 0, acumReal = 0
  const meses = []
  for (let i = 1; i <= 12; i++) {
    const mes = `${y}-${String(i).padStart(2, '0')}`
    const plan = planPorMes.get(mes) || 0
    const real = realPorMes.get(mes) || 0
    acumPlan += plan; acumReal += real
    const pct = plan > 0 ? Math.round((real / plan) * 100) : (real > 0 ? 100 : null)
    let status = 'Planejado'
    if (mes < mesAtual) status = real >= plan ? 'Concluído' : (plan > 0 ? 'Atrasado' : 'Concluído')
    else if (mes === mesAtual) status = 'Em andamento'
    meses.push({ mes, label: _MESES[i - 1], plan, real, pct, acum_plan: acumPlan, acum_real: acumReal, status })
  }
  const totalPlan = acumPlan, totalReal = acumReal
  return {
    ano: y, meses,
    resumo: {
      total_plan: totalPlan, total_real: totalReal,
      pct: totalPlan > 0 ? Math.round((totalReal / totalPlan) * 100) : null,
      atrasados: meses.filter(m => m.status === 'Atrasado').length,
      custo_producao: Math.round(custoTotal * 100) / 100, // custo dos apontamentos DO ANO exibido
    },
  }
}

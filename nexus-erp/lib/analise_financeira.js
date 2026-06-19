/**
 * analise_financeira.js — Parecer financeiro prévio do fornecedor a partir de
 * dados de mercado (bureau de crédito) + situação cadastral (Receita/SEFAZ).
 * Função pura: recebe os dados já consultados e devolve score consolidado,
 * nível de risco, recomendação e os fatores que pesaram.
 *
 * Saída:
 *   { score(0-100), nivel('Baixo'|'Médio'|'Alto'), recomendacao,
 *     fatores: [{ fator, impacto, detalhe }], situacao_cadastral, regular,
 *     score_bureau, pendencias, protestos, faturamento_estimado }
 */
export function analisarFinanceiro({ bureau = {}, receita = {} } = {}) {
  const fatores = []
  let score = Number(bureau.score_0_100)
  if (!isFinite(score)) score = 50
  fatores.push({ fator: 'Score de crédito (bureau)', impacto: 0, detalhe: `${bureau.score_externo ?? '—'} (${isFinite(Number(bureau.score_0_100)) ? bureau.score_0_100 : '—'}/100)` })

  const pend = Number(bureau.pendencias) || 0
  if (pend > 0) { const p = Math.min(pend * 8, 30); score -= p; fatores.push({ fator: 'Pendências financeiras', impacto: -p, detalhe: `${pend} pendência(s)` }) }

  const prot = Number(bureau.protestos) || 0
  if (prot > 0) { const p = Math.min(prot * 12, 30); score -= p; fatores.push({ fator: 'Protestos', impacto: -p, detalhe: `${prot} protesto(s)` }) }

  // Situação cadastral (Receita): irregular derruba o parecer e recomenda recusar.
  const sit = receita.situacao_cadastral || bureau.situacao || 'ATIVA'
  const regular = receita.regular !== undefined ? !!receita.regular : (sit === 'ATIVA')
  let recusaCadastral = false
  if (!regular) { score -= 40; recusaCadastral = true; fatores.push({ fator: 'Situação cadastral', impacto: -40, detalhe: sit }) }
  else fatores.push({ fator: 'Situação cadastral', impacto: 0, detalhe: sit })

  // Faturamento estimado como sinal de capacidade (positivo leve).
  const fat = Number(bureau.faturamento_estimado) || 0
  if (fat >= 1000000) { score += 5; fatores.push({ fator: 'Faturamento estimado', impacto: +5, detalhe: `R$ ${Math.round(fat).toLocaleString('pt-BR')}` }) }

  score = Math.max(0, Math.min(100, Math.round(score)))
  let nivel, recomendacao
  if (recusaCadastral || score < 40) { nivel = 'Alto'; recomendacao = 'Recusar' }
  else if (score < 65) { nivel = 'Médio'; recomendacao = 'Aprovar com ressalvas' }
  else { nivel = 'Baixo'; recomendacao = 'Aprovar' }

  return {
    score, nivel, recomendacao, fatores,
    situacao_cadastral: sit, regular,
    score_bureau: bureau.score_externo ?? null,
    pendencias: pend, protestos: prot, faturamento_estimado: fat,
  }
}

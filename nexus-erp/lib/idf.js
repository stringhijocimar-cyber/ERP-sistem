/**
 * idf.js — Índice de Desempenho do Fornecedor (IDF). Consolida sinais reais:
 *  - OTD (On-Time Delivery): % de pedidos entregues dentro do prazo;
 *  - Avaliações: média das notas registradas (0–5 → 0–100).
 * Função pura: recebe os pedidos e avaliações do fornecedor e devolve o índice.
 *
 * Saída:
 *   { score(0-100|null), classificacao('A'|'B'|'C'|'D'|'Sem dados'),
 *     otd_pct, entregas_consideradas, avaliacao_media, avaliacoes_qtd,
 *     componentes: [{ nome, valor, peso }] }
 */
const _addDias = (ymd, n) => new Date(new Date(ymd + 'T00:00:00Z').getTime() + n * 864e5).toISOString().slice(0, 10)
const _r1 = n => Math.round(n * 10) / 10

export function calcularIDF({ pedidos = [], avaliacoes = [] } = {}) {
  // OTD: só pedidos efetivamente entregues, com base de envio e prazo.
  let onTime = 0, considerados = 0
  for (const p of pedidos) {
    const entrega = String(p.entregue_em || p.data_entrega || '').slice(0, 10)
    if (!entrega) continue
    const base = String(p.enviado_em || p.emitido_em || '').slice(0, 10)
    const prazo = Number(p.prazo_entrega)
    if (!base || !prazo) continue
    considerados++
    if (entrega <= _addDias(base, prazo)) onTime++
  }
  const otd = considerados ? (onTime / considerados) * 100 : null

  // Avaliações (nota_media 0–5).
  const notas = avaliacoes.map(a => Number(a.nota_media ?? a.media ?? a.nota) || 0).filter(n => n > 0)
  const avalMedia = notas.length ? notas.reduce((s, n) => s + n, 0) / notas.length : null
  const avalScore = avalMedia != null ? (avalMedia / 5) * 100 : null

  let score = null
  const componentes = []
  if (otd != null) componentes.push({ nome: 'OTD (entrega no prazo)', valor: _r1(otd), peso: avalScore != null ? 0.6 : 1 })
  if (avalScore != null) componentes.push({ nome: 'Avaliações', valor: _r1(avalScore), peso: otd != null ? 0.4 : 1 })
  if (otd != null && avalScore != null) score = 0.6 * otd + 0.4 * avalScore
  else if (otd != null) score = otd
  else if (avalScore != null) score = avalScore

  let classificacao = 'Sem dados'
  if (score != null) classificacao = score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 50 ? 'C' : 'D'

  return {
    score: score != null ? _r1(score) : null,
    classificacao,
    otd_pct: otd != null ? _r1(otd) : null,
    entregas_consideradas: considerados,
    avaliacao_media: avalMedia != null ? _r1(avalMedia) : null,
    avaliacoes_qtd: notas.length,
    componentes,
  }
}

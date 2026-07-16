/**
 * ssma_indicadores.js — Indicadores de segurança do trabalho (HSE). Puro.
 *
 * TF (Taxa de Frequência) e TG (Taxa de Gravidade) são os KPIs clássicos da
 * NBR 14280, normalizados por 1.000.000 de horas-homem trabalhadas (HHT):
 *   TF = (acidentes COM afastamento × 1e6) / HHT
 *   TG = (dias perdidos × 1e6) / HHT
 * Sem HHT não há como medir (retorna null) — não inventa denominador.
 */

const _r2 = n => Math.round((Number(n) || 0) * 100) / 100
const MILHAO = 1_000_000

// `ocorrencias`: [{ gravidade, com_afastamento, dias_perdidos, data_ocorrencia, status }]
// `hht`: horas-homem trabalhadas no período. `hoje`: YYYY-MM-DD (dias sem acidente).
export function calcularIndicadoresSSMA(ocorrencias = [], hht = 0, hoje) {
  const lista = Array.isArray(ocorrencias) ? ocorrencias : []
  const HHT = Math.max(0, Number(hht) || 0)
  let comAfastamento = 0, diasPerdidos = 0, total = 0
  const porGravidade = {}
  let ultimoAcidente = null // data do último acidente COM afastamento
  for (const o of lista) {
    total++
    const g = String(o.gravidade || 'Não classificada')
    porGravidade[g] = (porGravidade[g] || 0) + 1
    if (o.com_afastamento) {
      comAfastamento++
      diasPerdidos += Math.max(0, Number(o.dias_perdidos) || 0)
      const d = String(o.data_ocorrencia || '').slice(0, 10)
      if (d && (!ultimoAcidente || d > ultimoAcidente)) ultimoAcidente = d
    }
  }
  const tf = HHT > 0 ? _r2((comAfastamento * MILHAO) / HHT) : null
  const tg = HHT > 0 ? _r2((diasPerdidos * MILHAO) / HHT) : null
  return {
    total, com_afastamento: comAfastamento, sem_afastamento: total - comAfastamento,
    dias_perdidos: diasPerdidos, hht: HHT,
    tf, tg, // null quando não há HHT
    dias_sem_acidente: diasSemAcidente(ultimoAcidente, hoje),
    ultimo_acidente: ultimoAcidente,
    por_gravidade: Object.entries(porGravidade).map(([gravidade, qtd]) => ({ gravidade, qtd })).sort((a, b) => b.qtd - a.qtd),
  }
}

// Dias desde o último acidente com afastamento (null se nunca houve).
export function diasSemAcidente(ultimoAcidente, hoje) {
  const u = String(ultimoAcidente || '').slice(0, 10)
  if (!u) return null
  const h = String(hoje || '').slice(0, 10)
  const du = Date.parse(u + 'T00:00:00Z'), dh = Date.parse(h + 'T00:00:00Z')
  if (isNaN(du) || isNaN(dh)) return null
  return Math.max(0, Math.round((dh - du) / 86400000))
}

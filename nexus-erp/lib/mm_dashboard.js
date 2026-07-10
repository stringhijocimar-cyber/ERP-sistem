/**
 * mm_dashboard.js — MM fase 5: visão executiva consolidada, score de
 * fornecedor e sugestão de compra. Puro, sem I/O.
 *
 * Consolida os gaps de todo o pipeline MM (BOM→Engenharia→Sourcing→PPAP→MRP)
 * numa só leitura de gestão, e transforma dados que já existem (OTIF, PPAP,
 * avaliações) em um score acionável de fornecedor.
 */

const _isBuy = m => String(m.make_buy || '').toUpperCase() === 'BUY'
const _ppapLibera = p => p && (p.status === 'Aprovado' || p.status === 'Condicional')

// Consolida os gaps do pipeline: sem engenharia, sem cotação, sem PPAP,
// críticos. `rfqMaterialIds`: materiais já com RFQ; `ppapMap`: material_id→PPAP.
export function consolidarMM({ materiais = [], rfqMaterialIds = [], ppapMap = new Map() } = {}) {
  const jaRfq = new Set((rfqMaterialIds || []).map(Number))
  const buy = materiais.filter(_isBuy)
  const resumir = arr => arr.map(m => ({ id: m.id, part_number: m.part_number, descricao: m.descricao, sistema: m.sistema, criticidade: m.criticidade }))
  const sem_engenharia = buy.filter(m => !m.eng_liberado_compras)
  const sem_cotacao = buy.filter(m => m.eng_liberado_compras && !jaRfq.has(Number(m.id)))
  const sem_ppap = buy.filter(m => !_ppapLibera(ppapMap.get(m.id) || null))
  const criticos = materiais.filter(m => m.criticidade === 'Alta')
  return {
    resumo: {
      total: materiais.length, buy: buy.length,
      sem_engenharia: sem_engenharia.length, sem_cotacao: sem_cotacao.length,
      sem_ppap: sem_ppap.length, criticos: criticos.length,
    },
    sem_engenharia: resumir(sem_engenharia),
    sem_cotacao: resumir(sem_cotacao),
    sem_ppap: resumir(sem_ppap),
    criticos: resumir(criticos),
  }
}

function _clamp(n) { return Math.max(0, Math.min(100, n)) }
function _r1(n) { return Math.round(n * 10) / 10 }

/**
 * Score 0–100 de fornecedor a partir de sinais reais:
 *  - prazo: OTIF (% no prazo) ou nota_prazo (0–5 → ×20)
 *  - qualidade: taxa de aprovação de PPAP e/ou nota_qualidade
 *  - comercial: nota_preco + nota_atendimento
 * Pesos: prazo 35% · qualidade 40% · comercial 25% — renormalizados sobre as
 * dimensões com dado (fornecedor novo não é punido por falta de histórico).
 */
export function scoreFornecedor(sinais = {}) {
  const { otif_pct, ppap_total = 0, ppap_aprovados = 0, nota_qualidade, nota_prazo, nota_preco, nota_atendimento } = sinais
  const dims = []
  // Prazo
  let prazo = null
  if (otif_pct != null) prazo = _clamp(otif_pct)
  else if (nota_prazo > 0) prazo = _clamp(nota_prazo * 20)
  if (prazo != null) dims.push({ nome: 'prazo', valor: prazo, peso: 0.35 })
  // Qualidade
  let qual = null
  const partes = []
  if (ppap_total > 0) partes.push((ppap_aprovados / ppap_total) * 100)
  if (nota_qualidade > 0) partes.push(nota_qualidade * 20)
  if (partes.length) qual = _clamp(partes.reduce((a, b) => a + b, 0) / partes.length)
  if (qual != null) dims.push({ nome: 'qualidade', valor: qual, peso: 0.40 })
  // Comercial
  const com = []
  if (nota_preco > 0) com.push(nota_preco * 20)
  if (nota_atendimento > 0) com.push(nota_atendimento * 20)
  let comercial = com.length ? _clamp(com.reduce((a, b) => a + b, 0) / com.length) : null
  if (comercial != null) dims.push({ nome: 'comercial', valor: comercial, peso: 0.25 })

  if (!dims.length) return { score: null, classificacao: 'Sem histórico', dimensoes: {} }
  const somaPeso = dims.reduce((a, d) => a + d.peso, 0)
  const score = _r1(dims.reduce((a, d) => a + d.valor * d.peso, 0) / somaPeso)
  return {
    score,
    classificacao: classificarFornecedor(score),
    dimensoes: Object.fromEntries(dims.map(d => [d.nome, _r1(d.valor)])),
  }
}

export function classificarFornecedor(score) {
  if (score == null) return 'Sem histórico'
  if (score >= 80) return 'A — Preferencial'
  if (score >= 60) return 'B — Homologado'
  if (score >= 40) return 'C — Atenção'
  return 'D — Crítico'
}

// Sugestão de compra: dos faltantes do MRP, os que são BUY (compráveis),
// marcando se estão prontos (engenharia liberada) e o fornecedor sugerido.
export function sugestaoCompra(faltantes = [], materiaisById = new Map()) {
  return (faltantes || []).map(f => {
    const m = materiaisById.get(f.id) || {}
    const pronto = !!m.eng_liberado_compras
    return {
      id: f.id, part_number: f.part_number, descricao: f.descricao,
      faltante: f.faltante, criticidade: m.criticidade || f.criticidade,
      fornecedor_id: m.fornecedor_id || null,
      pronto_para_compra: pronto,
      acao: !pronto ? 'Liberar engenharia' : (m.fornecedor_id ? 'Gerar RFQ' : 'Definir fornecedor'),
    }
  })
}

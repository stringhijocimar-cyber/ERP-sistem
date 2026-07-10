/**
 * mm_bom.js — Materials Management: estrutura de produto (BOM multinível),
 * explosão de necessidade e gates industriais. Puro, sem I/O.
 *
 * Inspirado em SAP MM. Modelo fiel à engenharia real: cada material aponta o
 * PAI (peca_pai_id) e a quantidade por veículo; a árvore é a BOM. A explosão
 * multiplica as quantidades ao longo do caminho raiz→folha e pelo volume de
 * produção — é a base do MRP (necessidade de compra/fabricação).
 *
 * Regra-mãe do MM: item BUY só pode ser comprado com a ENGENHARIA LIBERADA
 * (desenho liberado p/ compras). Item MAKE não passa por sourcing.
 */

// Índice id→material e pai→filhos (uma passada).
function _indexar(materiais = []) {
  const porId = new Map()
  const filhos = new Map()
  for (const m of materiais) {
    porId.set(m.id, m)
    const pai = m.peca_pai_id == null ? null : m.peca_pai_id
    if (!filhos.has(pai)) filhos.set(pai, [])
    filhos.get(pai).push(m)
  }
  return { porId, filhos }
}

/**
 * Explode a BOM a partir de `rootId` (ou de todas as raízes se null),
 * multiplicando a quantidade acumulada pelo caminho e por `veiculos`.
 * Protegido contra ciclos (peca_pai_id inconsistente). Retorna lista achatada
 * em ordem de profundidade (pai antes dos filhos).
 */
export function explodirBOM(materiais = [], rootId = null, veiculos = 1) {
  const { porId, filhos } = _indexar(materiais)
  const n = Number(veiculos) > 0 ? Number(veiculos) : 1
  const out = []
  const visitados = new Set()
  function anda(m, qtdAcum, prof) {
    if (visitados.has(m.id)) return // corta ciclo
    visitados.add(m.id)
    const qtdVeic = qtdAcum * (Number(m.qtd_veiculo) || 0)
    out.push({
      id: m.id, part_number: m.part_number, descricao: m.descricao,
      sistema: m.sistema, subsistema: m.subsistema, make_buy: m.make_buy,
      nivel: m.nivel, profundidade: prof, criticidade: m.criticidade,
      qtd_por_veiculo: qtdVeic, qtd_total: qtdVeic * n,
    })
    for (const f of (filhos.get(m.id) || [])) anda(f, qtdVeic || 1, prof + 1)
  }
  const raizes = rootId == null ? (filhos.get(null) || []) : (porId.has(rootId) ? [porId.get(rootId)] : [])
  for (const r of raizes) {
    // a raiz entra com qtd acumulada = a própria qtd/veículo (fator inicial 1)
    anda(r, 1, 0)
  }
  return out
}

// Filhos diretos de um material (um nível). Útil para navegação da árvore.
export function filhosDiretos(materiais = [], paiId = null) {
  return (materiais || []).filter(m => (m.peca_pai_id == null ? null : m.peca_pai_id) === paiId)
}

// Gate de compra: BUY exige engenharia liberada; MAKE não vai a sourcing.
export function gateCompra(material = {}) {
  const mb = String(material.make_buy || '').toUpperCase()
  if (mb === 'MAKE') return { ok: false, motivo: 'Item MAKE não passa por sourcing (fabricação interna)' }
  if (!material.eng_liberado_compras) return { ok: false, motivo: 'Engenharia não liberada para compras' }
  return { ok: true }
}

// Engenharia liberada = desenho + revisão informados e status Liberado.
export function podeLiberarEngenharia({ eng_desenho, eng_revisao } = {}) {
  return !!(String(eng_desenho || '').trim() && String(eng_revisao || '').trim())
}

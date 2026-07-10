/**
 * mm_sourcing.js — MM fase 2: ponte entre a explosão da BOM e o Sourcing.
 * Puro, sem I/O.
 *
 * Da BOM explodida, os itens BUY com engenharia liberada viram RFQ automática
 * (o comprador não digita item a item). Este módulo classifica o status de
 * sourcing de cada material e monta o texto da RFQ com a necessidade real.
 *
 * Estados:
 *  - MAKE       → fabricação interna, não vai a sourcing
 *  - Bloqueado  → BUY sem engenharia liberada (gate MM)
 *  - A cotar    → BUY liberado, ainda sem RFQ
 *  - Em cotação → BUY liberado, já com RFQ aberta
 */

// Status de sourcing de um material. `temRfq`: já existe RFQ ligada a ele.
export function statusSourcing(material = {}, temRfq = false) {
  if (String(material.make_buy || '').toUpperCase() === 'MAKE') return 'MAKE'
  if (!material.eng_liberado_compras) return 'Bloqueado'
  return temRfq ? 'Em cotação' : 'A cotar'
}

// Itens que PODEM virar RFQ agora: BUY, engenharia liberada e sem RFQ ainda.
// `rfqMaterialIds`: Set/array de material_id que já têm RFQ.
export function itensParaCotar(materiais = [], rfqMaterialIds = []) {
  const jaTem = new Set((rfqMaterialIds || []).map(Number))
  return (materiais || []).filter(m =>
    String(m.make_buy || '').toUpperCase() === 'BUY' &&
    m.eng_liberado_compras &&
    !jaTem.has(Number(m.id)))
}

// Contagem por status (para o painel de sourcing do MM).
export function resumoSourcing(materiais = [], rfqMaterialIds = []) {
  const jaTem = new Set((rfqMaterialIds || []).map(Number))
  const r = { make: 0, bloqueado: 0, a_cotar: 0, em_cotacao: 0 }
  for (const m of materiais || []) {
    const s = statusSourcing(m, jaTem.has(Number(m.id)))
    if (s === 'MAKE') r.make++
    else if (s === 'Bloqueado') r.bloqueado++
    else if (s === 'A cotar') r.a_cotar++
    else r.em_cotacao++
  }
  return r
}

// Título e descrição da RFQ a partir do material e da necessidade explodida.
export function montarRFQdeMaterial(material = {}, qtdTotal = 0, veiculos = 1) {
  const pn = material.part_number || ('MAT-' + (material.id ?? ''))
  const desc = material.descricao || ''
  return {
    titulo: `Cotação ${pn}${desc ? ' — ' + desc : ''}`,
    descricao: `Necessidade de ${qtdTotal} ${material.unidade || 'PC'} de ${pn}${desc ? ' (' + desc + ')' : ''}`
      + ` para ${veiculos} veículo(s).`
      + (material.sistema ? ` Sistema: ${material.sistema}${material.subsistema ? ' / ' + material.subsistema : ''}.` : '')
      + (material.criticidade ? ` Criticidade: ${material.criticidade}.` : ''),
    quantidade: qtdTotal,
  }
}

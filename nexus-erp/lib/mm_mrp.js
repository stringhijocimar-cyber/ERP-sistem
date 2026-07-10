/**
 * mm_mrp.js — MM fase 4: MRP (Material Requirements Planning). Puro, sem I/O.
 *
 * Cruza a NECESSIDADE (BOM explodida × volume de produção) com a
 * DISPONIBILIDADE (saldo do almoxarifado) para revelar:
 *  - peças faltantes (necessidade > saldo)
 *  - % de disponibilidade da estrutura
 *  - impacto no plano: quantos veículos dá para montar com o estoque atual
 *    (o item mais restritivo é o gargalo).
 *
 * O elo material↔estoque é o part_number ↔ código do item de almoxarifado.
 */

// Índice de saldo por part_number (case-insensitive) a partir dos itens de estoque.
export function indexarEstoque(itensEstoque = []) {
  const map = new Map()
  for (const it of itensEstoque) {
    const k = String(it.codigo || '').trim().toUpperCase()
    if (!k) continue
    map.set(k, (map.get(k) || 0) + (Number(it.quantidade_atual) || 0))
  }
  return map
}

// Calcula o MRP a partir da BOM explodida (itens com part_number, make_buy,
// qtd_por_veiculo, qtd_total) e do índice de saldo. Só itens BUY são "comprados"
// (MAKE é fabricado internamente); ambos aparecem, mas o gargalo usa BUY.
export function calcularMRP(explosao = [], saldoPorPN = new Map(), veiculosAlvo = 1) {
  const alvo = Number(veiculosAlvo) > 0 ? Number(veiculosAlvo) : 1
  const itens = (explosao || []).map(e => {
    const pn = String(e.part_number || '').trim().toUpperCase()
    const disponivel = saldoPorPN.get(pn) || 0
    const necessidade = Number(e.qtd_total) || 0
    const faltante = Math.max(0, necessidade - disponivel)
    const cobertura = necessidade > 0 ? Math.min(100, Math.round((disponivel / necessidade) * 1000) / 10) : 100
    const qtdVeic = Number(e.qtd_por_veiculo) || 0
    // Quantos veículos o saldo cobre para este item (só faz sentido se consome).
    const veiculosCobertos = qtdVeic > 0 ? Math.floor(disponivel / qtdVeic) : Infinity
    return {
      id: e.id, part_number: e.part_number, descricao: e.descricao, make_buy: e.make_buy,
      criticidade: e.criticidade, qtd_por_veiculo: qtdVeic,
      necessidade, disponivel, faltante, cobertura_pct: cobertura,
      veiculos_cobertos: veiculosCobertos === Infinity ? null : veiculosCobertos,
      status: faltante > 0 ? 'Faltante' : 'Disponível',
    }
  })
  const compraveis = itens.filter(i => String(i.make_buy || '').toUpperCase() === 'BUY')
  const faltantes = compraveis.filter(i => i.faltante > 0)
  const disponibilidade = compraveis.length ? Math.round(((compraveis.length - faltantes.length) / compraveis.length) * 1000) / 10 : 100
  // Gargalo: menor cobertura de veículos entre os itens BUY que consomem.
  const cobre = compraveis.map(i => i.veiculos_cobertos).filter(v => v != null)
  const veiculosPossiveis = cobre.length ? Math.min(...cobre) : alvo
  return {
    veiculos_alvo: alvo,
    veiculos_possiveis: veiculosPossiveis,
    itens_buy: compraveis.length,
    itens_faltantes: faltantes.length,
    disponibilidade_pct: disponibilidade,
    itens,
    faltantes: faltantes.sort((a, b) => b.faltante - a.faltante),
  }
}

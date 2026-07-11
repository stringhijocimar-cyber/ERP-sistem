/**
 * pp_producao.js — PP (Production Planning): ordens de produção com gate de
 * liberação e consumo de materiais pela BOM. Puro, sem I/O.
 *
 * Elo final do ciclo MM: a ordem de produção (N veículos) só é LIBERADA se
 * (a) nenhum item BUY bloqueia por PPAP (qualidade bloqueia produção) e
 * (b) o estoque cobre a quantidade da ordem (MRP). Ao APONTAR produção, os
 * componentes BUY são consumidos do estoque conforme a BOM explodida.
 */

// Gate de liberação da OP: PPAP + cobertura do MRP para a qtd da ordem.
// `bloqueiosPPAP`: itens BUY sem PPAP que libere; `mrp`: resultado de
// calcularMRP para a quantidade da ordem.
export function gateLiberacaoOP({ bloqueiosPPAP = [], mrp = null, veiculos = 1 } = {}) {
  const motivos = []
  if (bloqueiosPPAP.length) {
    motivos.push(`${bloqueiosPPAP.length} item(ns) sem PPAP aprovado (qualidade bloqueia produção)`)
  }
  if (mrp && mrp.itens_faltantes > 0 && mrp.veiculos_possiveis < veiculos) {
    motivos.push(`Estoque cobre ${mrp.veiculos_possiveis} de ${veiculos} veículo(s) — ${mrp.itens_faltantes} faltante(s) no MRP`)
  }
  return { ok: motivos.length === 0, motivos }
}

/**
 * Lista de consumo para produzir `veiculos` unidades: dos itens agregados do
 * MRP (por PN), os BUY que consomem (qtd_por_veiculo > 0). MAKE é fabricado
 * na própria ordem — não baixa estoque de comprados.
 */
export function consumoDaOrdem(itensMRP = [], veiculos = 1) {
  const n = Number(veiculos) > 0 ? Number(veiculos) : 1
  return (itensMRP || [])
    .filter(i => String(i.make_buy || '').toUpperCase() === 'BUY' && (Number(i.qtd_por_veiculo) || 0) > 0)
    .map(i => ({ part_number: i.part_number, descricao: i.descricao, quantidade: (Number(i.qtd_por_veiculo) || 0) * n }))
}

// Valida o consumo contra o saldo (tudo-ou-nada: um item sem saldo bloqueia o
// apontamento inteiro — produção parcial com material faltando não existe).
export function validarConsumo(consumo = [], saldoPorPN = new Map()) {
  const insuficientes = []
  for (const c of consumo || []) {
    const pn = String(c.part_number || '').trim().toUpperCase()
    const disp = saldoPorPN.get(pn) || 0
    if (disp < c.quantidade) insuficientes.push({ ...c, disponivel: disp })
  }
  return { ok: insuficientes.length === 0, insuficientes }
}

// Status derivado da ordem a partir do progresso.
export function statusAposApontamento(ordem = {}, veiculosApontados = 0) {
  const plan = Number(ordem.veiculos_plan) || 0
  const total = (Number(ordem.veiculos_produzidos) || 0) + (Number(veiculosApontados) || 0)
  return { veiculos_produzidos: total, status: total >= plan ? 'Concluída' : 'Em Produção', concluida: total >= plan }
}

/**
 * estoque.js — Regras de estoque (puro, sem I/O).
 *
 * Núcleo de movimentação de almoxarifado: custo médio ponderado na entrada e
 * aplicação de um movimento (Entrada/Saída/Ajuste) sobre o saldo, com bloqueio
 * de saída sem lastro. O servidor injeta o item e o movimento; aqui só o
 * cálculo — testável sem banco.
 */

const _r = n => Math.round((Number(n) || 0) * 10000) / 10000

// Custo médio ponderado após uma entrada:
//   (saldo×custoAtual + qtdEntrada×custoEntrada) / (saldo + qtdEntrada)
// Sem saldo/entrada válidos, mantém o custo de entrada (ou o atual).
export function custoMedioPonderado(qtdAtual, custoAtual, qtdEntrada, custoEntrada) {
  const qa = Math.max(0, Number(qtdAtual) || 0)
  const ca = Number(custoAtual) || 0
  const qe = Math.max(0, Number(qtdEntrada) || 0)
  const ce = Number(custoEntrada) || 0
  const total = qa + qe
  if (total <= 0) return _r(ce || ca)
  // Entrada sem custo informado não dilui o custo médio (usa o atual).
  const custoEnt = ce > 0 ? ce : ca
  return _r((qa * ca + qe * custoEnt) / total)
}

// Aplica um movimento ao item. Retorna { ok, quantidade, valor_medio } ou
// { ok:false, erro, code }. tipos: Entrada | Saída | Ajuste.
//   - Entrada: soma qtd, recalcula custo médio ponderado.
//   - Saída: subtrai qtd; bloqueia se faltar saldo (a menos de permitir_negativo).
//   - Ajuste: define a quantidade absoluta (contagem de inventário); custo médio
//     muda só se um novo valor_unitario for informado.
export function aplicarMovimento(item, mov) {
  const atual = Number(item && item.quantidade_atual) || 0
  const custo = Number(item && item.valor_medio) || 0
  const tipo = String(mov && mov.tipo || '')
  const q = Number(mov && mov.quantidade)
  const vu = mov && mov.valor_unitario != null ? Number(mov.valor_unitario) : null

  if (!['Entrada', 'Saída', 'Ajuste'].includes(tipo)) return { ok: false, erro: 'Tipo inválido (Entrada|Saída|Ajuste)', code: 400 }
  if (!isFinite(q) || q < 0) return { ok: false, erro: 'Quantidade inválida', code: 400 }
  if (tipo !== 'Ajuste' && !(q > 0)) return { ok: false, erro: 'Quantidade deve ser maior que zero', code: 400 }

  if (tipo === 'Entrada') {
    return { ok: true, quantidade: _r(atual + q), valor_medio: custoMedioPonderado(atual, custo, q, vu) }
  }
  if (tipo === 'Saída') {
    if (q > atual && !(mov && mov.permitir_negativo)) {
      return { ok: false, erro: `Saída de ${q} maior que o saldo disponível (${atual})`, code: 409 }
    }
    return { ok: true, quantidade: _r(atual - q), valor_medio: custo }
  }
  // Ajuste: quantidade passa a ser o valor contado.
  return { ok: true, quantidade: _r(q), valor_medio: vu != null && vu >= 0 ? _r(vu) : custo }
}

// Itens que atingiram o ponto de reposição (saldo ≤ mínimo). Sugere repor até
// o mínimo (ou o dobro do mínimo, se não houver máximo definido).
export function itensParaRepor(itens = []) {
  return (itens || [])
    .filter(i => (Number(i.quantidade_atual) || 0) <= (Number(i.quantidade_minima) || 0) && (Number(i.quantidade_minima) || 0) > 0)
    .map(i => {
      const atual = Number(i.quantidade_atual) || 0
      const min = Number(i.quantidade_minima) || 0
      const alvo = (Number(i.quantidade_maxima) || 0) > 0 ? Number(i.quantidade_maxima) : min * 2
      const sugerido = Math.max(0, _r(alvo - atual))
      return { id: i.id, codigo: i.codigo, descricao: i.descricao, quantidade_atual: atual, quantidade_minima: min, sugestao_compra: sugerido, custo_estimado: _r(sugerido * (Number(i.valor_medio) || 0)) }
    })
    .sort((a, b) => (a.quantidade_atual - a.quantidade_minima) - (b.quantidade_atual - b.quantidade_minima))
}

// Valorização do estoque: total e por categoria (Σ saldo × custo médio).
export function valorizarEstoque(itens = []) {
  let total = 0
  const porCategoria = {}
  for (const i of itens || []) {
    const v = _r((Number(i.quantidade_atual) || 0) * (Number(i.valor_medio) || 0))
    total += v
    const cat = i.categoria || 'Geral'
    porCategoria[cat] = _r((porCategoria[cat] || 0) + v)
  }
  return {
    total: _r(total),
    itens: (itens || []).length,
    por_categoria: Object.entries(porCategoria).map(([categoria, valor]) => ({ categoria, valor })).sort((a, b) => b.valor - a.valor),
  }
}

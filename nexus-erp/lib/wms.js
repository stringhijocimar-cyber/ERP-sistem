/**
 * wms.js — WMS (Warehouse Management): endereçamento físico do estoque e
 * separação (picking). Puro, sem I/O.
 *
 * O almoxarifado sabe QUANTO existe de cada item (quantidade_atual); o WMS
 * sabe ONDE está — distribuído em endereços (bins). Invariante: a soma das
 * alocações de um item nunca excede o saldo do almoxarifado; o que sobra é
 * "não endereçado" (recebido mas ainda não guardado).
 */

// Saldo já endereçado (soma das alocações do item).
export function saldoEnderecado(alocacoes = []) {
  return Math.round((alocacoes || []).reduce((s, a) => s + (Number(a.quantidade) || 0), 0) * 1000) / 1000
}

// Saldo recebido mas ainda sem endereço (a guardar).
export function saldoNaoEnderecado(quantidadeAtual, alocacoes = []) {
  return Math.round(((Number(quantidadeAtual) || 0) - saldoEnderecado(alocacoes)) * 1000) / 1000
}

// Valida guardar `qtd` num endereço: não pode passar do saldo não endereçado.
export function validarAlocacao(quantidadeAtual, alocacoes = [], qtd) {
  const q = Number(qtd)
  if (!(q > 0)) return { ok: false, erro: 'Quantidade deve ser maior que zero' }
  const livre = saldoNaoEnderecado(quantidadeAtual, alocacoes)
  if (q > livre) return { ok: false, erro: `Quantidade (${q}) excede o saldo não endereçado (${livre})` }
  return { ok: true }
}

/**
 * Sugere de quais endereços separar `quantidade`, do maior estoque primeiro
 * (esvazia bins cheios antes) — reduz o nº de posições visitadas. Retorna as
 * retiradas e o que faltou (se as alocações não cobrem a demanda).
 */
export function sugerirPicking(alocacoes = [], quantidade) {
  let restante = Number(quantidade) || 0
  const ordenadas = [...(alocacoes || [])]
    .filter(a => (Number(a.quantidade) || 0) > 0)
    .sort((a, b) => (Number(b.quantidade) || 0) - (Number(a.quantidade) || 0))
  const retiradas = []
  for (const a of ordenadas) {
    if (restante <= 0) break
    const pega = Math.min(Number(a.quantidade) || 0, restante)
    retiradas.push({ endereco_id: a.endereco_id, codigo: a.endereco_codigo, quantidade: Math.round(pega * 1000) / 1000 })
    restante = Math.round((restante - pega) * 1000) / 1000
  }
  return { ok: restante <= 0, retiradas, faltante: Math.max(0, restante) }
}

// Ocupação de um endereço vs sua capacidade (para alertar bin cheio).
export function ocupacaoEndereco(capacidade, alocacoesDoEndereco = []) {
  const usado = saldoEnderecado(alocacoesDoEndereco)
  const cap = Number(capacidade) || 0
  return {
    usado, capacidade: cap,
    ocupacao_pct: cap > 0 ? Math.round((usado / cap) * 1000) / 10 : null,
    cheio: cap > 0 && usado >= cap,
  }
}

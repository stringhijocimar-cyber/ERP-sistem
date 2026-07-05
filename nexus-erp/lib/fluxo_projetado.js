/**
 * fluxo_projetado.js — Fluxo de caixa PROJETADO (forward-looking).
 *
 * Combina entradas futuras (contas a receber em aberto, por vencimento) e
 * saídas futuras (contas a pagar em aberto, por vencimento) em baldes
 * semanais, com saldo acumulado a partir de um saldo inicial. Antecipa
 * aperto de caixa (semanas com saldo acumulado negativo).
 *
 * Pura, sem I/O — recebe as contas já carregadas. Espelha o estilo de
 * fluxo_caixa.js (comparativo histórico de saídas).
 *
 * Saída:
 *   { saldo_inicial,
 *     semanas: [{ semana, inicio, fim, entradas, saidas, liquido, saldo_acumulado, negativo }],
 *     vencido: { entradas, saidas },
 *     resumo: { entradas_total, saidas_total, liquido_total, saldo_final,
 *               menor_saldo, semana_critica } }
 */

const _ymd = d => d.toISOString().slice(0, 10)
const _addDias = (ymd, n) => _ymd(new Date(new Date(ymd + 'T00:00:00Z').getTime() + n * 864e5))
function _inicioSemana(ymd) {
  const d = new Date(ymd + 'T00:00:00Z')
  const dow = (d.getUTCDay() + 6) % 7 // 0 = segunda
  return _addDias(ymd, -dow)
}
const _r2 = n => Math.round(n * 100) / 100

// Uma conta a receber é "futura" se ainda não entrou (não Recebida/Cancelada).
function _abertaReceber(c) {
  const s = String(c.status || '')
  return s !== 'Recebida' && s !== 'Cancelado' && s !== 'Cancelada'
}
// Uma conta a pagar é "futura" se ainda não saiu (não Paga/Cancelada).
function _abertaPagar(c) {
  const s = String(c.status || '')
  return s !== 'Pago' && s !== 'Cancelado' && s !== 'Cancelada'
}

export function montarFluxoProjetado({ receber = [], pagar = [], semanas = 8, hoje, saldoInicial = 0 } = {}) {
  const base = hoje || _ymd(new Date())
  const inicio = _inicioSemana(base)
  const n = Math.max(1, Math.min(Number(semanas) || 8, 52))
  const fimWindow = _addDias(inicio, n * 7)

  const buckets = []
  for (let i = 0; i < n; i++) {
    const ini = _addDias(inicio, i * 7)
    buckets.push({ semana: ini, inicio: ini, fim: _addDias(ini, 7), entradas: 0, saidas: 0, liquido: 0, saldo_acumulado: 0, negativo: false })
  }
  const idx = ymd => Math.floor((Date.parse(ymd + 'T00:00:00Z') - Date.parse(inicio + 'T00:00:00Z')) / (7 * 864e5))

  const vencido = { entradas: 0, saidas: 0 }
  // Vencido (antes do início da janela) e ainda em aberto entra na 1ª semana,
  // para o saldo acumulado refletir a realidade — e é exposto à parte.
  const lancar = (lista, aberta, campo, vencCampo) => {
    for (const c of lista) {
      if (!aberta(c)) continue
      const valor = Number(c.valor) || 0
      if (!valor) continue
      const venc = String(c.data_vencimento || c.vencimento || c[vencCampo] || '').slice(0, 10)
      if (!venc) continue
      if (venc < inicio) { buckets[0][campo] += valor; vencido[campo] += valor; continue }
      if (venc >= fimWindow) continue // fora do horizonte
      buckets[idx(venc)][campo] += valor
    }
  }
  lancar(receber, _abertaReceber, 'entradas')
  lancar(pagar, _abertaPagar, 'saidas')

  let saldo = Number(saldoInicial) || 0
  let entTot = 0, saiTot = 0, menorSaldo = Infinity, semanaCritica = null
  for (const b of buckets) {
    b.entradas = _r2(b.entradas); b.saidas = _r2(b.saidas); b.liquido = _r2(b.entradas - b.saidas)
    saldo = _r2(saldo + b.liquido)
    b.saldo_acumulado = saldo
    b.negativo = saldo < 0
    entTot += b.entradas; saiTot += b.saidas
    if (saldo < menorSaldo) { menorSaldo = saldo; semanaCritica = b.semana }
  }

  return {
    saldo_inicial: _r2(Number(saldoInicial) || 0),
    semanas: buckets,
    vencido: { entradas: _r2(vencido.entradas), saidas: _r2(vencido.saidas) },
    resumo: {
      entradas_total: _r2(entTot), saidas_total: _r2(saiTot), liquido_total: _r2(entTot - saiTot),
      saldo_final: saldo, menor_saldo: menorSaldo === Infinity ? 0 : _r2(menorSaldo), semana_critica: semanaCritica,
    },
  }
}

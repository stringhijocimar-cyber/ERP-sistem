/**
 * csv_export.js — Geração de CSV (puro, portável). Usado para exportar a DRE
 * e o dashboard financeiro para a diretoria/contador (Excel abre direto).
 *
 * Sem I/O: recebe dados já montados e devolve uma string CSV. Escapa aspas,
 * separador e quebras de linha conforme o RFC 4180; usa ';' como separador
 * (padrão pt-BR do Excel) e CRLF. Prefixa BOM para acentuação correta.
 */

const SEP = ';'
const EOL = '\r\n'
const BOM = '﻿'

// Escapa um campo: envolve em aspas se contiver separador, aspas ou quebra.
function _campo(v) {
  const s = v == null ? '' : String(v)
  if (s.includes('"') || s.includes(SEP) || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

// Monta CSV a partir de um cabeçalho (array) e linhas (array de arrays).
export function toCSV(headers, rows, { bom = true } = {}) {
  const linhas = []
  if (headers && headers.length) linhas.push(headers.map(_campo).join(SEP))
  for (const r of rows || []) linhas.push((r || []).map(_campo).join(SEP))
  return (bom ? BOM : '') + linhas.join(EOL) + (linhas.length ? EOL : '')
}

// Formata número no padrão pt-BR (vírgula decimal) para o Excel brasileiro.
function _num(n) {
  const v = Number(n) || 0
  return v.toFixed(2).replace('.', ',')
}

// Serializa a DRE (saída de _montarDRE) em CSV: uma linha por item + resumo.
export function dreParaCSV(dre) {
  if (!dre) return toCSV(['DRE'], [])
  const rows = []
  rows.push([`DRE — período ${dre.periodo || ''}`, ''])
  rows.push(['Linha', 'Valor'])
  for (const l of dre.linhas || []) rows.push([l.label, _num(l.valor)])
  rows.push(['', ''])
  rows.push(['Margem bruta (%)', _num(dre.margem_bruta_pct)])
  rows.push(['Margem líquida (%)', _num(dre.margem_liquida_pct)])
  rows.push(['Caixa — Recebido', _num(dre.caixa && dre.caixa.recebido)])
  rows.push(['Caixa — Pago', _num(dre.caixa && dre.caixa.pago)])
  rows.push(['Caixa — Saldo', _num(dre.caixa && dre.caixa.saldo)])
  return toCSV(null, rows)
}

// Serializa o dashboard financeiro (saída de /api/dashboard-financeiro) em CSV.
export function dashboardParaCSV(d) {
  if (!d) return toCSV(['Dashboard'], [])
  const rows = []
  rows.push([`Dashboard Financeiro — ${d.periodo || ''}`, ''])
  rows.push(['Indicador', 'Valor'])
  rows.push(['Receita', _num(d.dre && d.dre.receita)])
  rows.push(['Custos', _num(d.dre && d.dre.custos)])
  rows.push(['Despesas', _num(d.dre && d.dre.despesas)])
  rows.push(['Resultado operacional', _num(d.dre && d.dre.resultado_operacional)])
  rows.push(['Margem líquida (%)', _num(d.dre && d.dre.margem_liquida_pct)])
  rows.push(['Capital de giro', _num(d.posicao && d.posicao.capital_giro)])
  rows.push(['A receber (aberto)', _num(d.posicao && d.posicao.a_receber)])
  rows.push(['A receber (vencido)', _num(d.posicao && d.posicao.a_receber_vencido)])
  rows.push(['A pagar (aberto)', _num(d.posicao && d.posicao.a_pagar)])
  rows.push(['A pagar (vencido)', _num(d.posicao && d.posicao.a_pagar_vencido)])
  rows.push(['Saldo projetado (fim)', _num(d.projecao && d.projecao.saldo_final)])
  rows.push(['Menor saldo projetado', _num(d.projecao && d.projecao.menor_saldo)])
  rows.push(['Aperto de caixa previsto', d.projecao && d.projecao.aperto_previsto ? 'SIM' : 'NÃO'])
  rows.push(['Conciliação pendente', String(d.conciliacao_pendente || 0)])
  rows.push(['', ''])
  rows.push(['Contratos por resultado', ''])
  rows.push(['Contrato', 'Título', 'Receita', 'Resultado', 'Margem (%)'])
  for (const c of (d.contratos && d.contratos.top) || []) {
    rows.push([c.numero || ('#' + c.contrato_id), c.titulo || '', _num(c.receita), _num(c.resultado), _num(c.margem_pct)])
  }
  return toCSV(null, rows)
}

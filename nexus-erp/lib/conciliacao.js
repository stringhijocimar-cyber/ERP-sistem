/**
 * conciliacao.js — Conciliação bancária: parsing de extrato + matching.
 *
 * Puro e portável (não lê process.env, não toca banco/rede). O servidor
 * injeta o conteúdo do arquivo; estas funções devolvem lançamentos
 * normalizados e sugerem o casamento com contas a pagar/receber.
 *
 * Um lançamento normalizado tem a forma:
 *   { data: 'AAAA-MM-DD', valor: <número>, tipo: 'credito'|'debito',
 *     descricao: <string>, documento: <string> }
 * `valor` é SEMPRE positivo; o sinal vira `tipo` (crédito = entrou,
 * débito = saiu). Isso alinha com contas_receber (crédito) e
 * contas_pagar (débito).
 */

// ── Normalização numérica (pt-BR e en-US) ──────────────────────
// "1.234,56" → 1234.56 | "1,234.56" → 1234.56 | "-50.00" → -50 | "R$ 10" → 10
function parseValor(raw) {
  if (raw == null) return NaN
  if (typeof raw === 'number') return raw
  let s = String(raw).trim().replace(/\s/g, '').replace(/r\$/i, '')
  const neg = /^-/.test(s) || /^\(.*\)$/.test(s) // (100) = negativo
  s = s.replace(/[()]/g, '').replace(/^-/, '').replace(/[^0-9.,]/g, '')
  const temVirgula = s.includes(','), temPonto = s.includes('.')
  if (temVirgula && temPonto) {
    // O separador decimal é o que aparece por último.
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.')
    else s = s.replace(/,/g, '')
  } else if (temVirgula) {
    // Só vírgula: decimal se houver 1-2 casas após a última vírgula.
    const dec = s.length - s.lastIndexOf(',') - 1
    s = dec <= 2 ? s.replace(',', '.') : s.replace(/,/g, '')
  }
  const n = parseFloat(s)
  if (!isFinite(n)) return NaN
  return neg ? -n : n
}

// ── Normalização de data → AAAA-MM-DD ──────────────────────────
// Aceita: 2026-05-10 | 10/05/2026 | 10-05-2026 | 20260510 (OFX DTPOSTED)
function parseData(raw) {
  const s = String(raw || '').trim()
  if (!s) return ''
  let m
  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) return `${m[1]}-${m[2]}-${m[3]}`
  if ((m = s.match(/^(\d{2})[/-](\d{2})[/-](\d{4})/))) return `${m[3]}-${m[2]}-${m[1]}`
  if ((m = s.match(/^(\d{4})(\d{2})(\d{2})/))) return `${m[1]}-${m[2]}-${m[3]}` // OFX: 20260510[...]
  return ''
}

function _lancamento(valorNum, data, descricao, documento) {
  return {
    data: parseData(data),
    valor: Math.abs(valorNum),
    tipo: valorNum < 0 ? 'debito' : 'credito',
    descricao: String(descricao || '').trim(),
    documento: String(documento || '').trim(),
  }
}

// ── CSV ────────────────────────────────────────────────────────
// Detecta delimitador e mapeia colunas por cabeçalho (data/descrição/valor).
// Sem cabeçalho reconhecível, assume ordem data;descricao;valor.
function _splitLinha(linha, delim) {
  // Split simples respeitando aspas duplas.
  const out = []; let cur = '', aspas = false
  for (const ch of linha) {
    if (ch === '"') { aspas = !aspas; continue }
    if (ch === delim && !aspas) { out.push(cur); cur = '' } else cur += ch
  }
  out.push(cur)
  return out.map(c => c.trim())
}

function parseCSVExtrato(texto) {
  const linhas = String(texto || '').split(/\r?\n/).filter(l => l.trim())
  if (!linhas.length) return []
  const delim = [';', '\t', ','].map(d => ({ d, n: (linhas[0].match(new RegExp('\\' + d, 'g')) || []).length }))
    .sort((a, b) => b.n - a.n)[0].d
  const primeira = _splitLinha(linhas[0], delim).map(c => c.toLowerCase())
  const achaCol = (...keys) => primeira.findIndex(c => keys.some(k => c.includes(k)))
  const temCabecalho = achaCol('data') >= 0 || achaCol('valor', 'montante', 'amount') >= 0
  let iData = achaCol('data', 'date'), iDesc = achaCol('desc', 'histor', 'hist', 'memo', 'lançamento', 'lancamento'), iValor = achaCol('valor', 'montante', 'amount')
  let iCred = achaCol('crédito', 'credito', 'credit'), iDeb = achaCol('débito', 'debito', 'debit'), iDoc = achaCol('doc', 'número', 'numero')
  if (!temCabecalho) { iData = 0; iDesc = 1; iValor = 2; iCred = iDeb = iDoc = -1 }
  const corpo = temCabecalho ? linhas.slice(1) : linhas
  const out = []
  for (const l of corpo) {
    const cols = _splitLinha(l, delim)
    let valor = iValor >= 0 ? parseValor(cols[iValor]) : NaN
    // Colunas separadas de crédito/débito (débito conta como saída).
    if (!isFinite(valor) && (iCred >= 0 || iDeb >= 0)) {
      const c = iCred >= 0 ? parseValor(cols[iCred]) : NaN
      const d = iDeb >= 0 ? parseValor(cols[iDeb]) : NaN
      if (isFinite(c) && c !== 0) valor = Math.abs(c)
      else if (isFinite(d) && d !== 0) valor = -Math.abs(d)
    }
    const data = iData >= 0 ? cols[iData] : ''
    if (!isFinite(valor) || !parseData(data)) continue // ignora linha inválida/rodapé
    out.push(_lancamento(valor, data, iDesc >= 0 ? cols[iDesc] : '', iDoc >= 0 ? cols[iDoc] : ''))
  }
  return out
}

// ── OFX (SGML) ─────────────────────────────────────────────────
function _tag(bloco, tag) {
  const m = bloco.match(new RegExp('<' + tag + '>([^<\r\n]*)', 'i'))
  return m ? m[1].trim() : ''
}

function parseOFX(texto) {
  const t = String(texto || '')
  const blocos = t.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) || t.match(/<STMTTRN>[\s\S]*?(?=<STMTTRN>|<\/BANKTRANLIST>)/gi) || []
  const out = []
  for (const b of blocos) {
    let valor = parseValor(_tag(b, 'TRNAMT'))
    if (!isFinite(valor)) continue
    const tipoOfx = _tag(b, 'TRNTYPE').toUpperCase()
    // TRNAMT já vem com sinal; DEBIT/CREDIT reforça quando o sinal falta.
    if (valor === 0 && tipoOfx === 'DEBIT') valor = -0
    const desc = _tag(b, 'MEMO') || _tag(b, 'NAME')
    out.push(_lancamento(valor, _tag(b, 'DTPOSTED'), desc, _tag(b, 'FITID')))
  }
  return out
}

// ── Dispatcher ─────────────────────────────────────────────────
function parseExtrato(formato, conteudo) {
  const f = String(formato || '').toLowerCase()
  if (f === 'ofx') return parseOFX(conteudo)
  if (f === 'csv') return parseCSVExtrato(conteudo)
  // auto: OFX se tiver a tag, senão CSV.
  return /<STMTTRN>/i.test(String(conteudo || '')) ? parseOFX(conteudo) : parseCSVExtrato(conteudo)
}

// ── Matching lançamento ↔ conta (pagar/receber) ────────────────
// Score: valor exato (obrigatório p/ sugerir) + proximidade de data.
// candidatos: [{ id, valor, data }]. Janela padrão: 5 dias.
function _difDias(a, b) {
  if (!a || !b) return 999
  const da = Date.parse(a + 'T00:00:00Z'), db = Date.parse(b + 'T00:00:00Z')
  if (isNaN(da) || isNaN(db)) return 999
  return Math.abs(Math.round((da - db) / 86400000))
}

function sugerirMatch(lanc, candidatos, { janelaDias = 5, tolerancia = 0.01 } = {}) {
  const alvo = Math.abs(Number(lanc && lanc.valor) || 0)
  let melhor = null
  for (const c of candidatos || []) {
    if (Math.abs(Math.abs(Number(c.valor) || 0) - alvo) > tolerancia) continue // valor precisa bater
    const dias = _difDias(lanc.data, c.data)
    if (dias > janelaDias) continue
    const score = 100 - dias * 5 // valor exato = 100; cai 5 por dia de distância
    if (!melhor || score > melhor.score) melhor = { ref_id: c.id, score, dias }
  }
  return melhor // null se nenhum candidato casar
}

export {
  parseValor, parseData, parseCSVExtrato, parseOFX, parseExtrato, sugerirMatch,
}

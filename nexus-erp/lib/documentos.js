/**
 * documentos.js — Validade de documentos do fornecedor (certidões,
 * contratos, comprovações). Puro, sem I/O.
 *
 * Regra: documento com `validade` vence no fim do próprio dia (vencido só
 * quando validade < hoje). "A vencer" = dentro da janela de aviso (30 dias
 * por padrão). Sem validade = não vence (ex.: contrato social).
 */

export function statusDocumento(doc, hoje, diasAviso = 30) {
  const v = String((doc && doc.validade) || '').slice(0, 10)
  if (!v) return 'Sem validade'
  const h = String(hoje || '').slice(0, 10)
  if (v < h) return 'Vencido'
  const limite = new Date(new Date(h + 'T00:00:00Z').getTime() + diasAviso * 864e5).toISOString().slice(0, 10)
  return v <= limite ? 'A vencer' : 'Válido'
}

// Vigente por tipo: o documento MAIS RECENTE de cada tipo é o que vale
// (reenvio substitui a certidão anterior sem apagar a trilha). Empate de
// created_at (mesmo segundo) desempata pelo id — maior = mais novo.
export function vigentesPorTipo(docs = []) {
  const porTipo = new Map()
  const maisNovo = (a, b) => {
    const ca = String(a.created_at || ''), cb = String(b.created_at || '')
    if (ca !== cb) return ca > cb ? a : b
    return (Number(a.id) || 0) >= (Number(b.id) || 0) ? a : b
  }
  for (const d of docs || []) {
    const k = String(d.tipo || '').trim().toLowerCase()
    const atual = porTipo.get(k)
    porTipo.set(k, atual ? maisNovo(d, atual) : d)
  }
  return Array.from(porTipo.values())
}

export function resumoDocumentos(docs = [], hoje, diasAviso = 30) {
  const vigentes = vigentesPorTipo(docs)
  let validos = 0, aVencer = 0, vencidos = 0
  const alertas = []
  for (const d of vigentes) {
    const s = statusDocumento(d, hoje, diasAviso)
    if (s === 'Vencido') { vencidos++; alertas.push({ tipo: d.tipo, validade: d.validade, situacao: 'Vencido' }) }
    else if (s === 'A vencer') { aVencer++; alertas.push({ tipo: d.tipo, validade: d.validade, situacao: 'A vencer' }) }
    else validos++
  }
  return { total_vigentes: vigentes.length, validos, a_vencer: aVencer, vencidos, alertas }
}

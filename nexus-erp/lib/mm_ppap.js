/**
 * mm_ppap.js — MM fase 3: qualidade de peça (PPAP/PSW) e gate de produção.
 * Puro, sem I/O.
 *
 * PPAP (Production Part Approval Process): antes de uma peça comprada entrar
 * na produção seriada, o fornecedor comprova dimensional, material, funcional
 * e documentação. A regra-mãe: **sem PPAP aprovado, não se produz**.
 *
 * Amostras/APQP são a etapa anterior (protótipo → teste → aprovação da
 * amostra), que habilita a submissão do PPAP.
 */

const _CHECKS = ['dimensional_ok', 'material_ok', 'funcional_ok', 'documentacao_ok']

// Avalia os 4 pilares do PPAP. Aprovável só com todos OK; senão lista pendências.
export function avaliarPPAP(checks = {}) {
  const pendentes = _CHECKS.filter(k => !checks[k]).map(k => k.replace('_ok', ''))
  return { aprovavel: pendentes.length === 0, pendentes }
}

// Resolve o status ao decidir o PPAP. Todos OK → Aprovado. Condicional exige
// PSW assinado (aprovação interina). Caso contrário Rejeitado.
export function resolverStatusPPAP(checks = {}, { condicional = false, psw_assinado = false } = {}) {
  if (avaliarPPAP(checks).aprovavel) return 'Aprovado'
  if (condicional && psw_assinado) return 'Condicional'
  return 'Rejeitado'
}

// Um PPAP libera produção quando Aprovado ou Condicional (interina).
export function ppapLibera(ppap) {
  const s = ppap && ppap.status
  return s === 'Aprovado' || s === 'Condicional'
}

// Gate de produção de UM material: MAKE (interno) não exige PPAP de fornecedor;
// BUY exige PPAP que libere. `ppap` = PPAP vigente do material (ou null).
export function gateProducao(material = {}, ppap = null) {
  if (String(material.make_buy || '').toUpperCase() === 'MAKE') return { ok: true }
  if (!ppap) return { ok: false, motivo: 'Sem PPAP submetido' }
  if (!ppapLibera(ppap)) return { ok: false, motivo: `PPAP ${ppap.status || 'pendente'} — não libera produção` }
  return { ok: true, condicional: ppap.status === 'Condicional' }
}

// Itens BUY que BLOQUEIAM a produção (sem PPAP que libere). `ppapPorMaterial`:
// Map material_id → PPAP vigente.
export function bloqueiosProducao(materiais = [], ppapPorMaterial = new Map()) {
  return (materiais || []).filter(m => {
    if (String(m.make_buy || '').toUpperCase() !== 'BUY') return false
    return !gateProducao(m, ppapPorMaterial.get(m.id) || null).ok
  })
}

// Status de qualidade legível de um material (para o painel).
export function statusQualidade(material = {}, ppap = null) {
  if (String(material.make_buy || '').toUpperCase() === 'MAKE') return 'Interno'
  if (!ppap) return 'Sem PPAP'
  return ppap.status || 'Pendente'
}

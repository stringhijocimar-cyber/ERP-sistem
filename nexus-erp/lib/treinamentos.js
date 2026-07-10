/**
 * treinamentos.js — Matriz de treinamentos/certificações NR por colaborador,
 * com validade e BLOQUEIO de atividade de risco quando vencido. Puro, sem I/O.
 *
 * O par lógico dos EPIs: EPI protege o corpo; o treinamento habilita a pessoa.
 * Um colaborador com NR-35 (altura), NR-10 (elétrica), NR-33 (confinado) ou ASO
 * VENCIDO não pode exercer a atividade de risco correspondente (NR-1 §1.7, NR-7)
 * — este módulo transforma a validade em aptidão/bloqueio auditável.
 *
 * Reusa a semântica de validade de documentos.js (statusDocumento).
 */

import { statusDocumento } from './documentos.js'

// NRs (e ASO) cujo vencimento BLOQUEIA a atividade de risco. Comparação
// tolerante a formato ("NR-35", "nr35", "NR 35").
const _RISCO = new Set(['NR-10', 'NR-35', 'NR-33', 'NR-34', 'NR-18', 'NR-22', 'ASO'])
export function normalizarNR(tipo) {
  const t = String(tipo || '').toUpperCase().replace(/\s+/g, '').replace(/^NR-?/, 'NR-')
  return t === 'NR-' ? '' : t
}
export function bloqueiaRisco(tipo) {
  return _RISCO.has(normalizarNR(tipo))
}

// Anota cada treinamento com a `situacao` (Válido/A vencer/Vencido/Sem validade)
// e se ele é bloqueante de atividade de risco.
export function classificarTreinamentos(lista = [], hoje, diasAviso = 30) {
  return (lista || []).map(t => ({
    ...t,
    situacao: statusDocumento({ validade: t && t.validade }, hoje, diasAviso),
    bloqueia_risco: bloqueiaRisco(t && t.tipo),
  }))
}

// Aptidão de UM colaborador: apto=false quando existe treinamento de risco
// vencido. Retorna também os alertas (a vencer) para programar reciclagem.
export function aptidaoColaborador(treinamentos = [], hoje, diasAviso = 30) {
  const cls = classificarTreinamentos(treinamentos, hoje, diasAviso)
  const bloqueios = cls.filter(t => t.bloqueia_risco && t.situacao === 'Vencido')
    .map(t => ({ tipo: normalizarNR(t.tipo), validade: t.validade }))
  const a_vencer = cls.filter(t => t.situacao === 'A vencer')
    .map(t => ({ tipo: normalizarNR(t.tipo) || t.tipo, validade: t.validade }))
  return { apto: bloqueios.length === 0, bloqueios, a_vencer }
}

// Só o que exige ação em toda a base: vencidos e a vencer, mais crítico
// (validade menor) primeiro. `alertas` inclui o colaborador para acionar.
export function alertasTreinamentos(lista = [], hoje, diasAviso = 30) {
  const alertas = classificarTreinamentos(lista, hoje, diasAviso)
    .filter(t => t.situacao === 'Vencido' || t.situacao === 'A vencer')
    .sort((a, b) => String(a.validade || '').localeCompare(String(b.validade || '')))
  const vencidos = alertas.filter(t => t.situacao === 'Vencido').length
  const a_vencer = alertas.filter(t => t.situacao === 'A vencer').length
  const bloqueantes = alertas.filter(t => t.situacao === 'Vencido' && t.bloqueia_risco).length
  return { vencidos, a_vencer, bloqueantes, total: alertas.length, alertas }
}

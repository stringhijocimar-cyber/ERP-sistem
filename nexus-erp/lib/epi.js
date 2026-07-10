/**
 * epi.js — EPIs (Equipamentos de Proteção Individual) entregues ao
 * colaborador, com controle de validade (CA / vida útil). Puro, sem I/O.
 *
 * NR-6: o empregador deve fornecer EPI adequado, exigir o uso e SUBSTITUIR
 * imediatamente quando danificado ou vencido. Um EPI vencido em uso é um
 * passivo de segurança e legal — este módulo transforma a validade em alerta.
 *
 * Reusa a semântica de validade de documentos.js (statusDocumento):
 * vencido só quando validade < hoje; "A vencer" dentro da janela de aviso.
 */

import { statusDocumento } from './documentos.js'

// Anota cada entrega com a `situacao` (Válido / A vencer / Vencido / Sem
// validade). A validade do EPI é a data de vencimento da vida útil/CA.
export function classificarEpis(entregas = [], hoje, diasAviso = 30) {
  return (entregas || []).map(e => ({
    ...e,
    situacao: statusDocumento({ validade: e && e.validade }, hoje, diasAviso),
  }))
}

// Só os que exigem ação: vencidos (troca imediata) e a vencer (programar
// reposição). Ordenados por validade ascendente — o mais crítico primeiro.
export function alertasEpi(entregas = [], hoje, diasAviso = 30) {
  const alertas = classificarEpis(entregas, hoje, diasAviso)
    .filter(e => e.situacao === 'Vencido' || e.situacao === 'A vencer')
    .sort((a, b) => String(a.validade || '').localeCompare(String(b.validade || '')))
  const vencidos = alertas.filter(e => e.situacao === 'Vencido').length
  const a_vencer = alertas.filter(e => e.situacao === 'A vencer').length
  return { vencidos, a_vencer, total: alertas.length, alertas }
}

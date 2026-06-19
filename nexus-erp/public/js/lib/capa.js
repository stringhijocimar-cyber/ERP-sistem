/**
 * capa.js — Workflow de CAPA (Corrective And Preventive Actions) — NEXUS ERP
 * ─────────────────────────────────────────────────────────────────────────
 * Dá ciclo de vida às não-conformidades: Aberta → Em Ação → Verificação →
 * Fechada, com detecção de atraso por prazo e KPIs de conformidade. Atende
 * ISO 9001/14001/45001 §10.2 (não conformidade e ação corretiva).
 *
 * Função pura: roda no browser e no Node (testes), via UMD.
 */
(function (root) {
  'use strict';

  var FLUXO = ['Aberta', 'Em Ação', 'Verificação', 'Fechada'];

  function _idx(s) { return FLUXO.indexOf(s); }

  // Próximo passo do fluxo (ou null se já fechada/indefinida).
  function proximoStatus(atual) {
    var i = _idx(atual);
    return (i >= 0 && i < FLUXO.length - 1) ? FLUXO[i + 1] : null;
  }

  // Transição válida: avança um passo OU fecha diretamente (com justificativa).
  function transicaoValida(de, para) {
    var i = _idx(de), j = _idx(para);
    if (i < 0 || j < 0) return false;
    if (de === 'Fechada') return false;        // fechada é terminal
    return j === i + 1 || para === 'Fechada';
  }

  function _data(v) { var d = new Date(v); return isNaN(d.getTime()) ? null : d; }

  // Estado derivado de uma CAPA em relação à data de referência.
  function estadoCapa(capa, hoje) {
    capa = capa || {};
    hoje = hoje ? new Date(hoje) : new Date();
    var fechada = capa.status === 'Fechada';
    var prazo = _data(capa.prazo);
    var atrasada = !fechada && !!prazo && prazo < hoje;
    var diasRestantes = prazo ? Math.ceil((prazo - hoje) / 86400000) : null;
    return {
      fechada: fechada,
      atrasada: atrasada,
      diasRestantes: diasRestantes,
      statusEfetivo: atrasada ? 'Atrasada' : (capa.status || 'Aberta'),
    };
  }

  // KPIs do conjunto de CAPAs.
  function resumoCapa(lista, hoje) {
    lista = Array.isArray(lista) ? lista : [];
    var r = { total: lista.length, abertas: 0, emAcao: 0, verificacao: 0, fechadas: 0, atrasadas: 0 };
    lista.forEach(function (c) {
      var e = estadoCapa(c, hoje);
      if (c.status === 'Fechada') r.fechadas++;
      else if (c.status === 'Verificação') r.verificacao++;
      else if (c.status === 'Em Ação') r.emAcao++;
      else r.abertas++;
      if (e.atrasada) r.atrasadas++;
    });
    var emAndamento = r.total - r.fechadas;
    r.emAndamento = emAndamento;
    r.percentNoPrazo = emAndamento > 0 ? Math.round(((emAndamento - r.atrasadas) / emAndamento) * 100) : 100;
    return r;
  }

  root.CAPA = { FLUXO: FLUXO, proximoStatus: proximoStatus, transicaoValida: transicaoValida, estadoCapa: estadoCapa, resumoCapa: resumoCapa };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.CAPA;
})(typeof window !== 'undefined' ? window : globalThis);

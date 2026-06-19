/**
 * lgpd.js — Conformidade LGPD (NEXUS ERP)
 * ────────────────────────────────────────
 * Funções puras para os três eixos da LGPD que o ERP precisa operar:
 *   • Base legal (art. 7) — valida o fundamento do tratamento.
 *   • Retenção — calcula vencimento do período de guarda do dado.
 *   • Anonimização — mascara dados pessoais de forma irreversível.
 *
 * Roda no browser e no Node (testes), via UMD.
 */
(function (root) {
  'use strict';

  // Bases legais para tratamento de dados pessoais (LGPD, art. 7º).
  var BASES_LEGAIS = [
    'Consentimento',
    'Cumprimento de obrigação legal/regulatória',
    'Execução de políticas públicas',
    'Estudos por órgão de pesquisa',
    'Execução de contrato',
    'Exercício regular de direitos',
    'Proteção da vida',
    'Tutela da saúde',
    'Legítimo interesse',
    'Proteção ao crédito',
  ];

  function validarBaseLegal(base) { return BASES_LEGAIS.indexOf(base) >= 0; }

  // Mascaramento por tipo de dado pessoal (irreversível = anonimização).
  function anonimizarCampo(valor, tipo) {
    if (valor == null || valor === '') return valor;
    var s = String(valor);
    switch (tipo) {
      case 'cpf':
        return s.replace(/\d/g, '•'); // remove identificabilidade
      case 'email': {
        var p = s.split('@');
        return p.length === 2 ? (s.charAt(0) + '•••@' + p[1]) : '•••';
      }
      case 'telefone': {
        var d = s.replace(/\D/g, '');
        var ddd = d.slice(0, 2);
        return ddd ? ('(' + ddd + ') •••••-••••') : '•••••';
      }
      case 'nome':
        return s.trim().split(/\s+/).map(function (w) { return w ? w.charAt(0).toUpperCase() + '.' : ''; }).join(' ').trim();
      default:
        return '•••';
    }
  }

  // Anonimiza um registro a partir de um mapa { campo: tipo }.
  function anonimizarRegistro(obj, mapaCampos) {
    var out = Object.assign({}, obj || {});
    Object.keys(mapaCampos || {}).forEach(function (campo) {
      if (campo in out) out[campo] = anonimizarCampo(out[campo], mapaCampos[campo]);
    });
    out.anonimizado = 1;
    return out;
  }

  // Status de retenção de um dado: vencido? quantos meses restam?
  function statusRetencao(item, hoje) {
    item = item || {};
    var ref = hoje ? new Date(hoje) : new Date();
    var dt = new Date(item.data_coleta || item.data || item.criado_em || NaN);
    if (isNaN(dt.getTime())) return { vencido: false, mesesRestantes: null, limite: null };
    var meses = Number(item.retencao_meses) || 0;
    var limite = new Date(dt); limite.setMonth(limite.getMonth() + meses);
    var msMes = 2629800000; // ~1 mês
    return {
      vencido: limite < ref,
      mesesRestantes: Math.round((limite - ref) / msMes),
      limite: limite.toISOString().slice(0, 10),
    };
  }

  // Filtra registros cujo período de retenção venceu. opts: { campoData,
  // retencaoMeses }. Retorna só os vencidos (para preview/expurgo).
  function vencidosPorRetencao(registros, opts, hoje) {
    opts = opts || {};
    var campo = opts.campoData || 'created_at';
    var meses = Number(opts.retencaoMeses) || 0;
    return (registros || []).filter(function (r) {
      var s = statusRetencao({ data_coleta: r[campo], retencao_meses: meses }, hoje);
      return s.vencido;
    });
  }

  root.LGPD = {
    BASES_LEGAIS: BASES_LEGAIS,
    validarBaseLegal: validarBaseLegal,
    anonimizarCampo: anonimizarCampo,
    anonimizarRegistro: anonimizarRegistro,
    statusRetencao: statusRetencao,
    vencidosPorRetencao: vencidosPorRetencao,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.LGPD;
})(typeof window !== 'undefined' ? window : globalThis);

/**
 * recomendador.js — Recomendador de Fornecedor em RFQ (NEXUS ERP)
 * ────────────────────────────────────────────────────────────────
 * Une os critérios numa recomendação única e EXPLICÁVEL: custo, IDF
 * (desempenho), crédito (risco) e prazo de entrega. Cada critério é
 * normalizado 0–100 (maior = melhor) e ponderado; o resultado traz o ranking,
 * o fornecedor recomendado e a contribuição de cada fator.
 *
 * Reaproveita os motores já existentes (crédito/IDF). Função pura: browser + Node.
 */
(function (root) {
  'use strict';

  var PESOS_PADRAO = { custo: 0.45, idf: 0.25, credito: 0.15, prazo: 0.15 };

  function _clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function _num(v) { var n = Number(v); return isFinite(n) ? n : null; }

  // Normaliza "menor é melhor" para 0–100 (menor valor → 100).
  function _normInverso(valor, min, max) {
    if (valor == null || valor <= 0) return 0;
    if (max === min) return 100;
    return _clamp(((max - valor) / (max - min)) * 100, 0, 100);
  }

  function _normIDF(idf) {
    var v = _num(idf);
    if (v == null) return 50;            // neutro quando ausente
    if (v <= 5) return _clamp(v / 5 * 100, 0, 100); // escala 0–5
    return _clamp(v, 0, 100);            // já 0–100
  }

  function _normCredito(opt) {
    var s = _num(opt.score_credito);
    if (s != null) return _clamp(s, 0, 100);
    var classe = String(opt.classificacao_credito || '').toUpperCase();
    var mapa = { A: 90, B: 70, C: 45, D: 20 };
    return mapa[classe] != null ? mapa[classe] : 50;
  }

  /**
   * recomendarFornecedor(opcoes, opts)
   * @param {Array} opcoes [{ fornecedor_id, fornecedor_nome, preco, prazo_dias,
   *                          idf, score_credito, classificacao_credito, declinou }]
   * @param {Object} opts  { pesos } (opcional)
   * @returns {{ ranking:Array, recomendado:Object|null, pesos:Object }}
   */
  function recomendarFornecedor(opcoes, opts) {
    opts = opts || {};
    var pesos = Object.assign({}, PESOS_PADRAO, opts.pesos || {});
    // Normaliza os pesos para somar 1 (robustez a configs).
    var somaP = (pesos.custo + pesos.idf + pesos.credito + pesos.prazo) || 1;
    ['custo', 'idf', 'credito', 'prazo'].forEach(function (k) { pesos[k] = pesos[k] / somaP; });

    var validas = (opcoes || []).filter(function (o) { return o && !o.declinou; });
    if (!validas.length) return { ranking: [], recomendado: null, pesos: pesos };

    var precos = validas.map(function (o) { return _num(o.preco); }).filter(function (v) { return v != null && v > 0; });
    var prazos = validas.map(function (o) { return _num(o.prazo_dias); }).filter(function (v) { return v != null && v > 0; });
    var minPreco = Math.min.apply(null, precos.length ? precos : [0]);
    var maxPreco = Math.max.apply(null, precos.length ? precos : [0]);
    var minPrazo = Math.min.apply(null, prazos.length ? prazos : [0]);
    var maxPrazo = Math.max.apply(null, prazos.length ? prazos : [0]);

    var ranking = validas.map(function (o) {
      var fatores = {
        custo:   Math.round(_normInverso(_num(o.preco), minPreco, maxPreco)),
        idf:     Math.round(_normIDF(o.idf)),
        credito: Math.round(_normCredito(o)),
        prazo:   prazos.length ? Math.round(_normInverso(_num(o.prazo_dias), minPrazo, maxPrazo)) : 50
      };
      var score = Math.round(
        fatores.custo * pesos.custo + fatores.idf * pesos.idf +
        fatores.credito * pesos.credito + fatores.prazo * pesos.prazo
      );
      return Object.assign({}, o, { scoreFinal: score, fatores: fatores });
    }).sort(function (a, b) {
      if (b.scoreFinal !== a.scoreFinal) return b.scoreFinal - a.scoreFinal;
      // Desempate: menor preço.
      return (_num(a.preco) || Infinity) - (_num(b.preco) || Infinity);
    });

    ranking.forEach(function (r, i) { r.posicao = i + 1; r.recomendado = i === 0; });
    return { ranking: ranking, recomendado: ranking[0], pesos: pesos };
  }

  // Frase curta explicando a recomendação.
  function explicarRecomendacao(rec) {
    if (!rec || !rec.recomendado) return '';
    var r = rec.recomendado, f = r.fatores;
    var pontos = [];
    if (f.custo >= 80) pontos.push('melhor custo');
    if (f.idf >= 70) pontos.push('bom desempenho (IDF)');
    if (f.credito >= 70) pontos.push('crédito saudável');
    else if (f.credito < 40) pontos.push('ATENÇÃO: crédito frágil');
    if (f.prazo >= 80) pontos.push('melhor prazo');
    var nome = r.fornecedor_nome || r.fornecedor_id || 'Fornecedor';
    return nome + ' — score ' + r.scoreFinal + '/100' + (pontos.length ? ' (' + pontos.join(', ') + ')' : '');
  }

  root.recomendarFornecedor = recomendarFornecedor;
  root.explicarRecomendacao = explicarRecomendacao;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { recomendarFornecedor: recomendarFornecedor, explicarRecomendacao: explicarRecomendacao };
  }
})(typeof window !== 'undefined' ? window : globalThis);

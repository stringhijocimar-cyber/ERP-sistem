/**
 * anomalias.js — Motor de Detecção de Anomalias em Compras (NEXUS ERP)
 * ────────────────────────────────────────────────────────────────────
 * Função pura, transparente e explicável. Recebe um pedido em análise + o
 * histórico de pedidos + dados do fornecedor, e devolve os ALERTAS de risco
 * (cada um com tipo, severidade e o porquê) e um veredito agregado.
 *
 * Detecta padrões clássicos de risco/fraude em suprimentos:
 *   1. Fracionamento — vários pedidos ao mesmo fornecedor que, somados numa
 *      janela curta, furam a alçada de aprovação (cada um abaixo do limite).
 *   2. Valor fora da curva — pedido muito acima do padrão histórico.
 *   3. Fornecedor novo + valor alto — pouca/nenhuma relação anterior.
 *   4. Crédito ruim + valor alto — exposição a fornecedor de alto risco
 *      (integra o motor de crédito: classe C/D).
 *   5. Duplicidade — mesmo fornecedor e valor em janela curta (pedido dobrado).
 *
 * Sem dependência de DOM: roda no browser e no Node (testes), via UMD.
 */
(function (root) {
  'use strict';

  var DEFAULTS = {
    limiteAlcada: 50000,            // R$ acima do qual exige aprovação superior
    janelaFracionamentoDias: 30,    // janela p/ somar pedidos do mesmo fornecedor
    janelaDuplicidadeDias: 7,       // janela p/ flagrar duplicidade
    minHistoricoFornecedor: 3,      // < isso = fornecedor "novo"
    valorAltoNovoFornecedor: 30000, // R$ que torna um fornecedor novo arriscado
    fatorForaDaCurva: 3,            // pedido > fator × mediana histórica
    minAmostrasCurva: 4             // mínimo de pedidos p/ calibrar a curva
  };

  var PESO = { alta: 40, media: 20, baixa: 10 };

  function _num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function _dias(a, b) {
    var da = new Date(a), db = new Date(b);
    if (isNaN(da) || isNaN(db)) return Infinity;
    return Math.abs(da - db) / (24 * 3600 * 1000);
  }
  function _mediana(arr) {
    if (!arr.length) return 0;
    var s = arr.slice().sort(function (x, y) { return x - y; });
    var m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  /**
   * detectarAnomalias(pedido, historico, fornecedor, opts)
   * @param {Object} pedido      { fornecedor_id, valor, data, categoria }
   * @param {Array}  historico   pedidos anteriores [{ fornecedor_id, valor, data, categoria }]
   * @param {Object} fornecedor  { score_credito, classificacao_credito } (opcional)
   * @param {Object} opts        sobrescreve DEFAULTS (opcional)
   * @returns {{risco:string, score:number, alertas:Array}}
   */
  function detectarAnomalias(pedido, historico, fornecedor, opts) {
    var cfg = Object.assign({}, DEFAULTS, opts || {});
    pedido = pedido || {};
    historico = Array.isArray(historico) ? historico : [];
    fornecedor = fornecedor || {};
    var alertas = [];
    var valor = _num(pedido.valor);
    var data = pedido.data || new Date().toISOString();
    var fid = pedido.fornecedor_id;

    function alerta(tipo, severidade, mensagem, detalhe) {
      alertas.push({ tipo: tipo, severidade: severidade, mensagem: mensagem, detalhe: detalhe || '' });
    }

    // Pedidos do MESMO fornecedor (exclui o próprio, se vier com id).
    var doFornecedor = historico.filter(function (p) {
      if (!p || p.fornecedor_id !== fid) return false;
      // Exclui o próprio pedido apenas quando ele tem id (evita falso "self-match").
      return pedido.id == null || p.id !== pedido.id;
    });

    // 1) FRACIONAMENTO — soma na janela cruza a alçada com cada item abaixo dela.
    if (fid != null) {
      var naJanela = doFornecedor.filter(function (p) {
        return _dias(p.data, data) <= cfg.janelaFracionamentoDias;
      });
      var somatorio = valor + naJanela.reduce(function (a, p) { return a + _num(p.valor); }, 0);
      var qtd = naJanela.length + 1;
      var todosAbaixo = valor < cfg.limiteAlcada &&
        naJanela.every(function (p) { return _num(p.valor) < cfg.limiteAlcada; });
      if (qtd >= 2 && todosAbaixo && somatorio >= cfg.limiteAlcada) {
        alerta('fracionamento', 'alta',
          'Possível fracionamento para furar a alçada',
          qtd + ' pedidos somando R$ ' + somatorio.toLocaleString('pt-BR') + ' em ' +
          cfg.janelaFracionamentoDias + ' dias, cada um abaixo da alçada de R$ ' +
          cfg.limiteAlcada.toLocaleString('pt-BR'));
      }
    }

    // 2) VALOR FORA DA CURVA — outlier vs mediana histórica do fornecedor.
    var valores = doFornecedor.map(function (p) { return _num(p.valor); }).filter(function (v) { return v > 0; });
    if (valores.length >= cfg.minAmostrasCurva) {
      var med = _mediana(valores);
      if (med > 0 && valor > cfg.fatorForaDaCurva * med) {
        alerta('fora_da_curva', 'media',
          'Valor muito acima do padrão deste fornecedor',
          'R$ ' + valor.toLocaleString('pt-BR') + ' é ' + (valor / med).toFixed(1) +
          '× a mediana histórica (R$ ' + med.toLocaleString('pt-BR') + ')');
      }
    }

    // 3) FORNECEDOR NOVO + VALOR ALTO
    if (fid != null && doFornecedor.length < cfg.minHistoricoFornecedor && valor >= cfg.valorAltoNovoFornecedor) {
      alerta('fornecedor_novo', 'media',
        'Fornecedor novo recebendo pedido de valor alto',
        'Apenas ' + doFornecedor.length + ' pedido(s) anterior(es) e valor de R$ ' + valor.toLocaleString('pt-BR'));
    }

    // 4) CRÉDITO RUIM + VALOR ALTO (integra o motor de crédito)
    var classe = String(fornecedor.classificacao_credito || '').toUpperCase();
    var scoreCred = fornecedor.score_credito;
    var creditoRuim = classe === 'C' || classe === 'D' || (scoreCred != null && _num(scoreCred) < 40);
    if (creditoRuim && valor >= cfg.valorAltoNovoFornecedor) {
      alerta('credito_baixo', classe === 'D' ? 'alta' : 'media',
        'Exposição a fornecedor de alto risco de crédito',
        'Classe ' + (classe || '—') + (scoreCred != null ? ' (score ' + scoreCred + ')' : '') +
        ' com pedido de R$ ' + valor.toLocaleString('pt-BR'));
    }

    // 5) DUPLICIDADE — mesmo valor ao mesmo fornecedor em janela curta.
    var dup = doFornecedor.find(function (p) {
      return _num(p.valor) === valor && valor > 0 && _dias(p.data, data) <= cfg.janelaDuplicidadeDias;
    });
    if (dup) {
      alerta('duplicidade', 'media',
        'Possível pedido duplicado',
        'Mesmo valor (R$ ' + valor.toLocaleString('pt-BR') + ') ao mesmo fornecedor em ' +
        cfg.janelaDuplicidadeDias + ' dias');
    }

    var score = alertas.reduce(function (a, x) { return a + (PESO[x.severidade] || 0); }, 0);
    var risco = score >= 40 ? 'Alto' : score >= 20 ? 'Médio' : score > 0 ? 'Baixo' : 'Nenhum';

    return { risco: risco, score: score, alertas: alertas };
  }

  root.detectarAnomalias = detectarAnomalias;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { detectarAnomalias: detectarAnomalias };
  }
})(typeof window !== 'undefined' ? window : globalThis);

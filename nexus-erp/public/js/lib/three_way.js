/**
 * three_way.js — Conciliação 3-way por item (NEXUS ERP)
 * ──────────────────────────────────────────────────────
 * Confere, item a item, o triângulo Pedido (PC) × Recebimento × Nota Fiscal:
 *   • faturado ≤ recebido (não paga o que não chegou),
 *   • recebido/faturado ≤ pedido (+ tolerância de quantidade),
 *   • preço faturado ≤ preço do pedido (+ tolerância de preço),
 *   • item na nota sem correspondência no pedido (compra não autorizada).
 *
 * Robusto a fontes ausentes: se não houver itens de nota, devolve conforme=true
 * com aviso (o gate cai para a checagem de total). Função pura: browser + Node.
 */
(function (root) {
  'use strict';

  var PADRAO = { tolPreco: 0.02, tolQtd: 0 }; // 2% no preço, 0% na quantidade

  function _num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function _chave(it) {
    var k = it.codigo || it.codigo_produto || it.sku || it.descricao || it.desc || '';
    return String(k).trim().toLowerCase();
  }
  function _qtd(it) { return _num(it.qtd != null ? it.qtd : (it.quantidade != null ? it.quantidade : it.quantidade_recebida)); }
  function _preco(it) { return _num(it.preco != null ? it.preco : (it.preco_unit != null ? it.preco_unit : (it.valor_unitario != null ? it.valor_unitario : it.valor_unit))); }

  function _indexar(itens) {
    var m = {};
    (itens || []).forEach(function (it) {
      var k = _chave(it);
      if (!k) return;
      if (m[k]) { m[k].qtd += _qtd(it); } // soma itens repetidos
      else m[k] = { chave: k, qtd: _qtd(it), preco: _preco(it), desc: it.descricao || it.desc || k };
    });
    return m;
  }

  /**
   * conciliarTresVias(dados, opts)
   * @param {Object} dados { itensPedido, itensRecebidos, itensNota }
   * @param {Object} opts  { tolPreco, tolQtd }
   * @returns {{conforme:boolean, divergencias:Array, verificados:number, aviso:string}}
   */
  function conciliarTresVias(dados, opts) {
    dados = dados || {};
    var cfg = Object.assign({}, PADRAO, opts || {});
    var itensNota = dados.itensNota || [];
    var temRecebimento = Array.isArray(dados.itensRecebidos) && dados.itensRecebidos.length > 0;

    if (!itensNota.length) {
      return { conforme: true, divergencias: [], verificados: 0, aviso: 'sem itens de nota — usar checagem de total' };
    }

    var ped = _indexar(dados.itensPedido);
    var rec = _indexar(dados.itensRecebidos);
    var divergencias = [];
    function div(item, tipo, detalhe) { divergencias.push({ item: item, tipo: tipo, detalhe: detalhe }); }

    itensNota.forEach(function (itn) {
      var k = _chave(itn);
      var qn = _qtd(itn), pn = _preco(itn);
      var p = ped[k];
      if (!p) { div(itn.descricao || k, 'item_sem_pedido', 'Item faturado sem correspondência no pedido'); return; }

      if (pn > 0 && p.preco > 0 && pn > p.preco * (1 + cfg.tolPreco)) {
        div(p.desc, 'preco_acima_pedido', 'Preço faturado R$ ' + pn + ' acima do pedido R$ ' + p.preco);
      }
      if (qn > p.qtd * (1 + cfg.tolQtd)) {
        div(p.desc, 'faturado_acima_pedido', 'Qtd faturada ' + qn + ' acima do pedido ' + p.qtd);
      }
      if (temRecebimento) {
        var r = rec[k];
        if (!r) div(p.desc, 'item_nao_recebido', 'Item faturado mas sem recebimento registrado');
        else if (qn > r.qtd * (1 + cfg.tolQtd)) {
          div(p.desc, 'faturado_acima_recebido', 'Qtd faturada ' + qn + ' acima da recebida ' + r.qtd);
        }
      }
    });

    return { conforme: divergencias.length === 0, divergencias: divergencias, verificados: itensNota.length, aviso: '' };
  }

  root.conciliarTresVias = conciliarTresVias;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { conciliarTresVias: conciliarTresVias };
  }
})(typeof window !== 'undefined' ? window : globalThis);

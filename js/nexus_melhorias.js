/**
 * nexus_melhorias.js — Utilitarios de seguranca e validacao do NEXUS ERP
 * ----------------------------------------------------------------------
 * ARQUIVO NOVO E ADITIVO. So acrescenta funcoes; nao substitui nada.
 * Salve em: nexus-erp/public/js/nexus_melhorias.js
 * Carregue-o LOGO APOS o js/db.js (ver MUDANCA 8 no index.html).
 *
 * Tudo aqui roda no NAVEGADOR: melhora a UX e evita erros do usuario,
 * mas NAO e a barreira final. A regra que impede fraude (ex.: pagar sem
 * lastro) precisa ser reforcada NO SERVIDOR.
 */
(function () {
  'use strict';

  // -- Configuracao central de regras (ajuste conforme sua operacao) --------
  window.NEXUS_CONFIG = window.NEXUS_CONFIG || {
    lastro: {
      exigirNotaFiscal: true, // bloqueia pagamento sem nota fiscal real
      exigirOrigem:     true, // bloqueia pagamento sem pedido/contrato de origem
    }
  };

  // -- 1) escapeHtml — protecao contra XSS armazenado -----------------------
  // Use SEMPRE que injetar texto vindo do usuario/banco dentro de innerHTML.
  if (typeof window.escapeHtml !== 'function') {
    window.escapeHtml = function (value) {
      if (value === null || value === undefined) return '';
      return String(value)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    };
  }

  // -- 2) podePagarConta — gate de lastro (a regra critica do ERP) ----------
  // Recebe uma conta a pagar e devolve { ok, motivos }.
  window.podePagarConta = function (c) {
    const cfg = (window.NEXUS_CONFIG && window.NEXUS_CONFIG.lastro) || {};
    const motivos = [];
    if (!c) return { ok: false, motivos: ['conta inexistente'] };
    if (c.data_pagamento) motivos.push('conta ja paga (evita duplicidade)');
    const aprovada = ['Aprovado', 'Aprovada', 'Liberado'].includes(c.status);
    if (!aprovada) motivos.push('nao aprovada no fluxo');
    if (cfg.exigirNotaFiscal !== false && (!c.nota_fiscal || c.nota_fiscal === '—'))
      motivos.push('sem nota fiscal');
    if (cfg.exigirOrigem !== false) {
      const temOrigem = c.pedido_id ||
        (c.contrato_id && c.contrato_id !== 'Geral' && c.contrato_id !== '—');
      if (!temOrigem) motivos.push('sem pedido ou contrato de origem (lastro)');
    }
    return { ok: motivos.length === 0, motivos };
  };

  // -- 3) fetchSeguro — fetch honesto que NAO engole erro do servidor -------
  window.fetchSeguro = async function (url, opts = {}) {
    const res = await fetch(url, opts);
    if (!res.ok) {
      let msg = 'HTTP ' + res.status;
      try { const j = await res.json(); if (j && j.error) msg = j.error; } catch (_) {}
      throw new Error(msg);
    }
    try { return await res.json(); } catch (_) { return null; }
  };

  console.info('[NEXUS] melhorias carregadas. Modo demo:', window.NEXUS_DEMO_MODE === true);
})();

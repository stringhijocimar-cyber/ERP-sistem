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

  // ── Interceptor global de fetch: injeta o token JWT em toda chamada /api/ ──
  // Corrige páginas que faziam fetch('/api/...') sem Authorization (401 → vazio).
  // Não sobrescreve um header Authorization já definido, e só age se houver token.
  if (!window.__fetchAuthPatched) {
    window.__fetchAuthPatched = true;
    const _origFetch = window.fetch.bind(window);
    const _tk = () => { try { return sessionStorage.getItem('fa_token') || localStorage.getItem('fa_token') || ''; } catch (e) { return ''; } };
    window.fetch = function (input, init) {
      try {
        const url = typeof input === 'string' ? input : (input && input.url) || '';
        const isApi = url.indexOf('/api/') === 0 || url.indexOf(location.origin + '/api/') === 0;
        if (isApi) {
          const token = _tk();
          if (token) {
            init = Object.assign({}, init);
            const headers = new Headers((init && init.headers) || (typeof input !== 'string' && input && input.headers) || {});
            if (!headers.has('Authorization')) headers.set('Authorization', 'Bearer ' + token);
            init.headers = headers;
          }
        }
      } catch (e) { /* nunca quebra a requisição */ }
      return _origFetch(input, init);
    };
  }

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

  // -- apiAuth — chamada autenticada usando o token do db.js -----------------
  window.apiAuth = async function (path, opts = {}) {
    const token = (window.DB && DB.token && DB.token.get && DB.token.get()) || '';
    // Serializa o body quando vem como objeto simples. Sem isto, o fetch envia
    // "[object Object]" e o servidor responde 400 (JSON inválido). Bodies que já
    // são string (JSON.stringify), FormData ou Blob passam intactos.
    const o = { ...opts };
    if (o.body != null && typeof o.body !== 'string'
        && !(typeof FormData !== 'undefined' && o.body instanceof FormData)
        && !(typeof Blob !== 'undefined' && o.body instanceof Blob)
        && !(typeof ArrayBuffer !== 'undefined' && o.body instanceof ArrayBuffer)) {
      o.body = JSON.stringify(o.body);
    }
    const res = await fetch(path, {
      ...o,
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token, ...(o.headers || {}) }
    });
    let json = null;
    try { json = await res.json(); } catch (_) {}
    if (!res.ok) throw new Error((json && json.error) || ('HTTP ' + res.status));
    return json ? json.data : null;
  };

  console.info('[NEXUS] melhorias carregadas. Modo demo:', window.NEXUS_DEMO_MODE === true);
})();

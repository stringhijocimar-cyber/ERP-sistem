/**
 * iso.js — Esqueleto de Auditoria ISO / Conformidade (NEXUS ERP)
 * ──────────────────────────────────────────────────────────────
 * Trata conformidade como TRANSVERSAL: os módulos que já existem (IDF, SSMA,
 * RBAC, logs, documentos) emitem EVIDÊNCIAS para as cláusulas das normas. O
 * motor calcula a cobertura por norma, aponta as lacunas e considera as
 * não-conformidades (CAPA) abertas. Tudo explicável, sem caixa-preta.
 *
 * Função pura: roda no browser e no Node (testes), via UMD.
 */
(function (root) {
  'use strict';

  // Catálogo focado nas cláusulas que o ERP consegue evidenciar hoje.
  // fonte = de qual dado do ERP a evidência é derivada automaticamente.
  var CATALOGO_ISO = [
    // ISO 9001 — Qualidade
    { id: '9001-7.5',  norma: 'ISO 9001',  titulo: 'Informação documentada',                fonte: 'documentos' },
    { id: '9001-8.4',  norma: 'ISO 9001',  titulo: 'Controle de fornecedores externos',     fonte: 'fornecedores' },
    { id: '9001-9.1',  norma: 'ISO 9001',  titulo: 'Monitoramento e medição (desempenho)',  fonte: 'idf' },
    { id: '9001-10.2', norma: 'ISO 9001',  titulo: 'Não conformidade e ação corretiva',     fonte: 'capa' },
    // ISO 14001 — Ambiental
    { id: '14001-6.1', norma: 'ISO 14001', titulo: 'Aspectos e impactos ambientais',        fonte: 'ambiental' },
    { id: '14001-7.5', norma: 'ISO 14001', titulo: 'Informação documentada (ambiental)',    fonte: 'documentos' },
    // ISO 45001 — Saúde e Segurança Ocupacional
    { id: '45001-7.2',  norma: 'ISO 45001', titulo: 'Competência e treinamento',             fonte: 'treinamentos' },
    { id: '45001-10.2', norma: 'ISO 45001', titulo: 'Incidentes e ações corretivas (SST)',   fonte: 'incidentes' },
    // ISO 27001 — Segurança da Informação
    { id: '27001-A.9',    norma: 'ISO 27001', titulo: 'Controle de acesso (RBAC)',           fonte: 'rbac' },
    { id: '27001-A.12.4', norma: 'ISO 27001', titulo: 'Registros e trilha de auditoria',     fonte: 'logs' }
  ];

  function _n(x) { return Array.isArray(x) ? x.length : (Number(x) || 0); }

  /**
   * gerarEvidenciasAutomaticas(dados) — deriva evidências dos módulos existentes.
   * @param {Object} dados { idf, fornecedores, incidentes, treinamentos, usuarios,
   *                          logs, documentos, gateAtivo }
   * @returns {Array<{requisito_id, origem, qtd, descricao}>}
   */
  function gerarEvidenciasAutomaticas(dados) {
    dados = dados || {};
    var ev = [];
    function push(reqId, origem, qtd, descricao) {
      if (qtd > 0) ev.push({ requisito_id: reqId, origem: origem, qtd: qtd, descricao: descricao });
    }
    var fornecedores = dados.fornecedores || [];
    var homologados = fornecedores.filter(function (f) {
      var s = String(f.status || '').toLowerCase();
      return s.indexOf('ativo') >= 0 || s.indexOf('homolog') >= 0 || f.ativo === 1;
    }).length;

    push('9001-8.4',  'fornecedores', homologados || _n(dados.idf),
      homologados + ' fornecedor(es) homologado(s) / ' + _n(dados.idf) + ' avaliação(ões) IDF');
    push('9001-9.1',  'idf', _n(dados.idf), _n(dados.idf) + ' avaliação(ões) de desempenho (IDF)');
    push('9001-7.5',  'documentos', _n(dados.documentos) + _n(dados.logs),
      _n(dados.documentos) + ' documento(s) e ' + _n(dados.logs) + ' registro(s)');
    push('14001-7.5', 'documentos', _n(dados.documentos), _n(dados.documentos) + ' documento(s) controlado(s)');
    push('45001-7.2', 'treinamentos', _n(dados.treinamentos), _n(dados.treinamentos) + ' treinamento(s) registrado(s)');
    push('45001-10.2','incidentes', _n(dados.incidentes), _n(dados.incidentes) + ' incidente(s) SSMA registrado(s)');
    push('27001-A.9', 'rbac', _n(dados.usuarios), _n(dados.usuarios) + ' usuário(s) com perfil de acesso (RBAC)');
    push('27001-A.12.4', 'logs', _n(dados.logs) + (dados.gateAtivo ? 1 : 0),
      _n(dados.logs) + ' registro(s) de auditoria' + (dados.gateAtivo ? ' + gate de pagamento ativo' : ''));
    return ev;
  }

  function _nivel(score) {
    return score >= 80 ? 'Maduro' : score >= 50 ? 'Em evolução' : score >= 20 ? 'Inicial' : 'Crítico';
  }

  /**
   * avaliarConformidade(catalogo, evidencias, naoConformidades)
   * @returns {{ porNorma: Array, geral: {cobertura, score, nivel, ncsAbertas, total, atendidos} }}
   */
  function avaliarConformidade(catalogo, evidencias, naoConformidades) {
    catalogo = catalogo || CATALOGO_ISO;
    evidencias = evidencias || [];
    naoConformidades = naoConformidades || [];
    var comEvidencia = {};
    evidencias.forEach(function (e) { if (e && e.requisito_id) comEvidencia[e.requisito_id] = true; });

    var normas = {};
    catalogo.forEach(function (c) {
      var n = normas[c.norma] || (normas[c.norma] = { norma: c.norma, total: 0, atendidos: 0, pendentes: [], ncsAbertas: 0 });
      n.total++;
      if (comEvidencia[c.id]) n.atendidos++;
      else n.pendentes.push({ id: c.id, titulo: c.titulo });
    });

    naoConformidades.forEach(function (nc) {
      var st = String(nc.status || '').toLowerCase();
      if (st !== 'fechada' && st !== 'concluída' && st !== 'concluida' && normas[nc.norma]) {
        normas[nc.norma].ncsAbertas++;
      }
    });

    var porNorma = Object.keys(normas).map(function (k) {
      var n = normas[k];
      n.cobertura = n.total ? Math.round((n.atendidos / n.total) * 100) : 0;
      n.score = Math.max(0, n.cobertura - n.ncsAbertas * 10); // cada NC aberta penaliza 10
      n.nivel = _nivel(n.score);
      return n;
    });

    var total = porNorma.reduce(function (a, n) { return a + n.total; }, 0);
    var atendidos = porNorma.reduce(function (a, n) { return a + n.atendidos; }, 0);
    var ncsAbertas = porNorma.reduce(function (a, n) { return a + n.ncsAbertas; }, 0);
    var cobertura = total ? Math.round((atendidos / total) * 100) : 0;
    var score = Math.max(0, cobertura - ncsAbertas * 5);

    return {
      porNorma: porNorma,
      geral: { total: total, atendidos: atendidos, ncsAbertas: ncsAbertas, cobertura: cobertura, score: score, nivel: _nivel(score) }
    };
  }

  root.ISO = {
    CATALOGO_ISO: CATALOGO_ISO,
    gerarEvidenciasAutomaticas: gerarEvidenciasAutomaticas,
    avaliarConformidade: avaliarConformidade
  };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = root.ISO;
  }
})(typeof window !== 'undefined' ? window : globalThis);

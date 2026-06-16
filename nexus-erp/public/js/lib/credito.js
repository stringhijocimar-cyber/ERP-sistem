/**
 * credito.js — Motor de Análise de Crédito de Fornecedores (NEXUS ERP)
 * ───────────────────────────────────────────────────────────────────
 * Função pura, transparente e explicável (sem caixa-preta): recebe os dados
 * do fornecedor e devolve um score 0–100, a classificação de risco, o limite
 * de crédito sugerido e a LISTA DE FATORES que compuseram a nota.
 *
 * Usado no cadastro/edição de fornecedor e reaproveitável em RFQ, pedidos e
 * fechamento comercial. Sem dependência de DOM — roda no browser e no Node
 * (testes), via o wrapper UMD abaixo.
 */
(function (root) {
  'use strict';

  // Faixas de classificação por score.
  var FAIXAS = [
    { min: 80, classe: 'A', risco: 'Baixo risco',   cor: '#16a34a' },
    { min: 60, classe: 'B', risco: 'Risco moderado', cor: '#2563eb' },
    { min: 40, classe: 'C', risco: 'Atenção',        cor: '#d97706' },
    { min: 0,  classe: 'D', risco: 'Alto risco',     cor: '#dc2626' }
  ];

  function _clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

  function _anosDeAtividade(dataAbertura) {
    if (!dataAbertura) return null;
    var d = new Date(dataAbertura);
    if (isNaN(d.getTime())) return null;
    return (Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000);
  }

  /**
   * analisarCreditoFornecedor(dados)
   * @param {Object} dados
   *   situacaoCnpj        {string}  ex.: "ATIVA" | "BAIXADA" | "SUSPENSA"
   *   dataAbertura        {string}  data de abertura (ISO ou dd/mm/aaaa→ISO)
   *   faturamentoAnual    {number}  R$/ano informado
   *   limiteSolicitado    {number}  R$ de limite pretendido
   *   scoreInternoIDF     {number}  0–5 (média das avaliações IDF) — opcional
   *   pendenciasFinanceiras {number} qtd. de pendências/protestos — opcional
   * @returns {{score:number, classe:string, risco:string, cor:string,
   *            limiteSugerido:number, fatores:Array<{fator:string,impacto:number,detalhe:string}>}}
   */
  function analisarCreditoFornecedor(dados) {
    dados = dados || {};
    var fatores = [];
    var score = 50; // base neutra
    function add(fator, impacto, detalhe) {
      impacto = Math.round(impacto);
      if (impacto !== 0) fatores.push({ fator: fator, impacto: impacto, detalhe: detalhe || '' });
      score += impacto;
    }

    // 1) Situação cadastral na Receita
    var sit = String(dados.situacaoCnpj || '').toUpperCase();
    if (sit) {
      if (sit.indexOf('ATIVA') >= 0) add('Situação cadastral ativa', +15, 'CNPJ ATIVO na Receita');
      else add('Situação cadastral irregular', -30, 'CNPJ ' + sit);
    }

    // 2) Tempo de atividade (maturidade)
    var anos = _anosDeAtividade(dados.dataAbertura);
    if (anos != null) {
      if (anos >= 10) add('Empresa consolidada (10+ anos)', +15, anos.toFixed(0) + ' anos de atividade');
      else if (anos >= 5) add('Boa maturidade (5+ anos)', +10, anos.toFixed(0) + ' anos de atividade');
      else if (anos >= 2) add('Maturidade inicial (2+ anos)', +5, anos.toFixed(1) + ' anos de atividade');
      else add('Empresa recém-aberta (<2 anos)', -5, anos.toFixed(1) + ' anos de atividade');
    }

    // 3) Porte por faturamento anual
    var fat = Number(dados.faturamentoAnual) || 0;
    if (fat > 0) {
      if (fat >= 10000000) add('Faturamento expressivo', +12, '≥ R$ 10 mi/ano');
      else if (fat >= 1000000) add('Faturamento sólido', +8, '≥ R$ 1 mi/ano');
      else if (fat >= 240000) add('Faturamento moderado', +4, '≥ R$ 240 mil/ano');
      else add('Faturamento baixo', 0, '< R$ 240 mil/ano');
    }

    // 4) Exposição: limite solicitado vs faturamento
    var limite = Number(dados.limiteSolicitado) || 0;
    if (limite > 0 && fat > 0) {
      var ratio = limite / fat;
      if (ratio <= 0.05) add('Limite conservador vs faturamento', +8, '≤ 5% do faturamento');
      else if (ratio <= 0.10) add('Limite moderado vs faturamento', +4, '≤ 10% do faturamento');
      else if (ratio <= 0.20) add('Limite elevado vs faturamento', 0, '≤ 20% do faturamento');
      else add('Limite acima do prudente', -12, (ratio * 100).toFixed(0) + '% do faturamento');
    }

    // 5) Histórico interno (avaliações IDF, 0–5)
    if (dados.scoreInternoIDF != null && dados.scoreInternoIDF !== '') {
      var idf = Number(dados.scoreInternoIDF) || 0;
      var imp = Math.round((idf - 2.5) / 2.5 * 10); // 0→-10, 2.5→0, 5→+10
      add('Histórico de avaliações (IDF)', imp, 'Média IDF ' + idf.toFixed(1) + '/5');
    }

    // 6) Pendências financeiras / protestos
    var pend = Number(dados.pendenciasFinanceiras) || 0;
    if (pend > 0) add('Pendências financeiras', -15 * Math.min(pend, 3), pend + ' pendência(s)');

    score = Math.round(_clamp(score, 0, 100));

    var faixa = FAIXAS.find(function (f) { return score >= f.min; }) || FAIXAS[FAIXAS.length - 1];

    // Limite sugerido: proporcional ao porte e à nota; 0 para alto risco.
    var limiteSugerido = 0;
    if (faixa.classe !== 'D' && fat > 0) {
      limiteSugerido = Math.round((fat * 0.10) * (score / 100) / 100) * 100; // ~10% do fat ponderado, arredondado a R$100
    }

    return {
      score: score,
      classe: faixa.classe,
      risco: faixa.risco,
      cor: faixa.cor,
      limiteSugerido: limiteSugerido,
      fatores: fatores
    };
  }

  root.analisarCreditoFornecedor = analisarCreditoFornecedor;
  // Suporte a require() nos testes (Node), sem quebrar no browser.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { analisarCreditoFornecedor: analisarCreditoFornecedor };
  }
})(typeof window !== 'undefined' ? window : globalThis);

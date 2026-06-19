/**
 * auditoria.js — Trilha de Auditoria Imutável (NEXUS ERP)
 * ────────────────────────────────────────────────────────
 * Encadeamento por hash (estilo blockchain): cada registro guarda o hash do
 * registro anterior. Adulterar, remover ou reordenar qualquer entrada quebra a
 * cadeia — e a verificação aponta exatamente onde. SHA-256 puro (determinístico,
 * sem dependência de plataforma), igual no Express e no Worker. Função pura:
 * roda no browser e no Node (testes).
 */
(function (root) {
  'use strict';

  // SHA-256 (domínio público, baseado em geraintluff/sha256). Recebe string de
  // bytes (0–255); usamos UTF-8 antes para aceitar acentos.
  var sha256 = function (ascii) {
    function rightRotate(value, amount) { return (value >>> amount) | (value << (32 - amount)); }
    var mathPow = Math.pow;
    var maxWord = mathPow(2, 32);
    var i, j;
    var result = '';
    var words = [];
    var asciiBitLength = ascii.length * 8;

    var hash = sha256.h = sha256.h || [];
    var k = sha256.k = sha256.k || [];
    var primeCounter = k.length;

    var isComposite = {};
    for (var candidate = 2; primeCounter < 64; candidate++) {
      if (!isComposite[candidate]) {
        for (i = 0; i < 313; i += candidate) { isComposite[i] = candidate; }
        hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
        k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
      }
    }

    ascii += '\x80';
    while (ascii.length % 64 - 56) ascii += '\x00';
    for (i = 0; i < ascii.length; i++) {
      j = ascii.charCodeAt(i);
      if (j >> 8) return ''; // só bytes 0–255 (use UTF-8 antes)
      words[i >> 2] |= j << ((3 - i) % 4) * 8;
    }
    words[words.length] = (asciiBitLength / maxWord) | 0;
    words[words.length] = asciiBitLength;

    for (j = 0; j < words.length;) {
      var w = words.slice(j, j += 16);
      var oldHash = hash;
      hash = hash.slice(0, 8);

      for (i = 0; i < 64; i++) {
        var w15 = w[i - 15], w2 = w[i - 2];
        var a = hash[0], e = hash[4];
        var temp1 = hash[7]
          + (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25))
          + ((e & hash[5]) ^ (~e & hash[6]))
          + k[i]
          + (w[i] = (i < 16) ? w[i] : (
            w[i - 16]
            + (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3))
            + w[i - 7]
            + (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))
          ) | 0);
        var temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22))
          + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
        hash = [(temp1 + temp2) | 0].concat(hash);
        hash[4] = (hash[4] + temp1) | 0;
      }

      for (i = 0; i < 8; i++) { hash[i] = (hash[i] + oldHash[i]) | 0; }
    }

    for (i = 0; i < 8; i++) {
      for (j = 3; j + 1; j--) {
        var b = (hash[i] >> (j * 8)) & 255;
        result += ((b < 16) ? 0 : '') + b.toString(16);
      }
    }
    return result;
  };

  function _utf8(str) {
    // unescape(encodeURIComponent()) → string de bytes (cada char 0–255).
    try { return unescape(encodeURIComponent(String(str))); }
    catch (e) { return String(str); }
  }
  function sha256hex(str) { return sha256(_utf8(str)); }

  var GENESIS = 'GENESIS';

  // Serialização determinística dos campos de negócio (sem o id, que só existe
  // após a inserção). Aceita campos do Express (logs_sistema) e do Worker.
  function canonicalRegistro(r) {
    r = r || {};
    var ator = r.usuario_id != null ? r.usuario_id : (r.actor_id != null ? r.actor_id : '');
    var acao = r.acao || r.action || '';
    var modulo = r.modulo || r.entity || '';
    var desc = r.descricao != null ? r.descricao : (r.payload != null ? r.payload : '');
    return [ator, acao, modulo, desc, r.created_at || ''].join('|');
  }

  // Hash de um registro encadeado ao anterior.
  function hashRegistro(reg, hashAnterior) {
    return sha256hex((hashAnterior || GENESIS) + '|' + canonicalRegistro(reg));
  }

  /**
   * verificarCadeia(registros) — registros em ordem ASCENDENTE (por id).
   * Cada um deve ter .hash e .hash_anterior.
   * @returns {{integra:boolean, total:number, quebraEm:(number|null), motivo:string}}
   */
  function verificarCadeia(registros) {
    // Ignora registros legados sem hash (anteriores à ativação da trilha):
    // verifica apenas a cadeia efetivamente encadeada.
    registros = (registros || []).filter(function (r) { return r && r.hash; });
    var prevHash = registros.length ? (registros[0].hash_anterior || GENESIS) : GENESIS;
    for (var i = 0; i < registros.length; i++) {
      var r = registros[i];
      var idRef = r.id != null ? r.id : (i + 1);
      // 1) elo: o hash_anterior precisa apontar para o hash do registro anterior
      if ((r.hash_anterior || GENESIS) !== prevHash) {
        return { integra: false, total: registros.length, quebraEm: idRef, motivo: 'elo quebrado (remoção/reordenação)' };
      }
      // 2) conteúdo: recomputar o hash deve bater com o armazenado
      var esperado = hashRegistro(r, r.hash_anterior);
      if (r.hash !== esperado) {
        return { integra: false, total: registros.length, quebraEm: idRef, motivo: 'conteúdo adulterado' };
      }
      prevHash = r.hash;
    }
    return { integra: true, total: registros.length, quebraEm: null, motivo: '' };
  }

  root.Auditoria = {
    GENESIS: GENESIS,
    sha256hex: sha256hex,
    canonicalRegistro: canonicalRegistro,
    hashRegistro: hashRegistro,
    verificarCadeia: verificarCadeia
  };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = root.Auditoria;
  }
})(typeof window !== 'undefined' ? window : globalThis);

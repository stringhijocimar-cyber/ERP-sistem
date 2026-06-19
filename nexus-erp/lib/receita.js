/**
 * receita.js — Adaptador de consulta de situação cadastral (CNPJ na Receita/SEFAZ).
 * ──────────────────────────────────────────────────────────────────────────
 * Mesma filosofia do credit_bureau.js: a consulta real (Receita Federal / SEFAZ
 * / provedores como ReceitaWS, BrasilAPI, Serpro) exige rede/credencial e roda
 * no servidor. Este adaptador expõe UMA interface e troca de provedor por
 * configuração (RECEITA_PROVIDER). O provedor `mock` é determinístico — permite
 * demo e testes ponta a ponta sem rede; provedores reais entram quando houver
 * credencial.
 *
 * Saída normalizada (independe do provedor):
 *   { cnpj, fonte, situacao_cadastral, regular(bool) }
 * situacao_cadastral ∈ ATIVA | SUSPENSA | INAPTA | BAIXADA | NULA
 * regular = (situacao_cadastral === 'ATIVA')
 */

const SITUACOES = ['ATIVA', 'ATIVA', 'ATIVA', 'ATIVA', 'SUSPENSA', 'INAPTA', 'BAIXADA', 'NULA']

function _soDigitos(s) { return String(s || '').replace(/\D/g, '') }

// Hash determinístico simples sobre os dígitos do CNPJ (igual ao do bureau).
function _hash(cnpj) {
  let h = 0
  for (const ch of cnpj) h = (h * 31 + (ch.charCodeAt(0) - 48)) % 1000003
  return h
}

// Provedor MOCK: situação plausível e estável derivada do CNPJ.
function _mock(cnpj) {
  const situacao_cadastral = SITUACOES[_hash(cnpj) % SITUACOES.length]
  return { fonte: 'mock', situacao_cadastral, regular: situacao_cadastral === 'ATIVA' }
}

/**
 * consultarReceita(cnpj, opts)
 * @param {string} cnpj
 * @param {{provider?:string}} opts
 * @returns {Promise<{cnpj:string, fonte:string, situacao_cadastral:string, regular:boolean}>}
 */
export async function consultarReceita(cnpj, opts = {}) {
  const limpo = _soDigitos(cnpj)
  if (limpo.length !== 14) throw new Error('CNPJ inválido (14 dígitos)')
  const provider = (opts.provider || 'mock').toLowerCase()
  if (provider === 'mock') return { cnpj: limpo, ..._mock(limpo) }
  // Provedores reais entram aqui (fetch autenticado com credencial do env).
  throw new Error('Provedor de situação cadastral não configurado: ' + provider)
}

export const _internal = { _hash, _mock, SITUACOES }

/**
 * credit_bureau.js — Adaptador de consulta a bureau de crédito (server-side).
 * ──────────────────────────────────────────────────────────────────────────
 * A consulta real (Serasa/SPC/Boa Vista) exige credenciais e roda no servidor,
 * nunca no cliente. Este adaptador expõe UMA interface e troca de provedor por
 * configuração (CREDIT_BUREAU_PROVIDER). O provedor `mock` é determinístico —
 * permite demo e testes ponta a ponta sem credencial; os provedores reais são
 * plugados aqui quando houver contrato/credencial.
 *
 * Saída normalizada (independe do provedor):
 *   { cnpj, fonte, situacao, score_externo(0–1000), score_0_100,
 *     pendencias, protestos, faturamento_estimado }
 */

function _soDigitos(s) { return String(s || '').replace(/\D/g, '') }

// Hash determinístico simples sobre os dígitos do CNPJ.
function _hash(cnpj) {
  let h = 0
  for (const ch of cnpj) h = (h * 31 + (ch.charCodeAt(0) - 48)) % 1000003
  return h
}

// Provedor MOCK: dados plausíveis e estáveis derivados do CNPJ.
function _mock(cnpj) {
  const h = _hash(cnpj)
  const score = 300 + (h % 700)                 // escala tipo Serasa: 300–999
  const situacao = (h % 13 === 0) ? 'INAPTA' : 'ATIVA'
  const pendencias = (h % 7 === 0) ? (1 + (h % 3)) : 0
  const protestos = (h % 11 === 0) ? 1 : 0
  const faturamento_estimado = 120000 * (1 + (h % 60)) // ~120k a ~7.3M
  return {
    fonte: 'mock',
    situacao,
    score_externo: score,
    score_0_100: Math.round(((score - 300) / 699) * 100),
    pendencias,
    protestos,
    faturamento_estimado,
  }
}

/**
 * consultarCredito(cnpj, opts)
 * @param {string} cnpj
 * @param {{provider?:string}} opts
 * @returns {Promise<Object>} dados normalizados do bureau
 */
export async function consultarCredito(cnpj, opts = {}) {
  const limpo = _soDigitos(cnpj)
  if (limpo.length !== 14) throw new Error('CNPJ inválido (14 dígitos)')
  const provider = (opts.provider || 'mock').toLowerCase()
  if (provider === 'mock') return { cnpj: limpo, ..._mock(limpo) }
  // Provedores reais entram aqui (fetch autenticado com credencial do env).
  // Enquanto não configurados, falha de forma honesta.
  throw new Error('Provedor de bureau não configurado: ' + provider)
}

export const _internal = { _hash, _mock } // exposto para testes

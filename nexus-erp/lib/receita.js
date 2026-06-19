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

// ── Cadastro completo por CNPJ (estilo Omie): razão, fantasia, endereço, etc. ──
// Mock determinístico para preencher o formulário sem depender de rede/CORS.
// Provedores reais (BrasilAPI/ReceitaWS/Serpro) plugam no mesmo formato.
const _UFS = ['SP', 'RJ', 'MG', 'PR', 'RS', 'SC', 'BA', 'PE', 'CE', 'GO', 'ES', 'DF']
const _CIDADES = { SP: 'São Paulo', RJ: 'Rio de Janeiro', MG: 'Belo Horizonte', PR: 'Curitiba', RS: 'Porto Alegre', SC: 'Joinville', BA: 'Salvador', PE: 'Recife', CE: 'Fortaleza', GO: 'Goiânia', ES: 'Serra', DF: 'Brasília' }
const _BAIRROS = ['Centro', 'Distrito Industrial', 'Jardim América', 'Vila Nova', 'Boa Vista', 'São José', 'Santa Mônica', 'Industrial']
const _LOGRAD = ['Rua das Indústrias', 'Av. Brasil', 'Av. das Nações', 'Rua XV de Novembro', 'Av. Industrial', 'Rua do Comércio', 'Rod. BR-101']
const _ATIV = ['Comércio atacadista de materiais de construção', 'Transporte rodoviário de carga', 'Fabricação de peças e acessórios', 'Manutenção e reparação de máquinas', 'Comércio varejista de equipamentos', 'Serviços de engenharia', 'Locação de máquinas e equipamentos', 'Comércio de produtos químicos']
const _PORTES = ['ME', 'EPP', 'Demais', 'MEI']
const _NATUREZAS = ['Sociedade Empresária Limitada', 'Empresário (Individual)', 'Sociedade Anônima Fechada', 'EIRELI']
const _RAMOS = ['Metalúrgica', 'Comercial', 'Transportes', 'Engenharia', 'Industrial', 'Construtora', 'Distribuidora', 'Serviços']
const _MARCAS = ['Aliança', 'Horizonte', 'Progresso', 'União', 'Pioneira', 'Atlas', 'Vértice', 'Primus']
const _SUFIXOS = ['LTDA', 'S.A.', 'ME', 'EIRELI']

function _fmtCNPJ(c) { return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12, 14)}` }
const _pick = (arr, h) => arr[h % arr.length]

function _cadastroMock(cnpj) {
  const h = _hash(cnpj)
  const ramo = _pick(_RAMOS, h)
  const marca = _pick(_MARCAS, Math.floor(h / 7))
  const sufixo = _pick(_SUFIXOS, Math.floor(h / 13))
  const uf = _pick(_UFS, Math.floor(h / 3))
  const ano = 1990 + (h % 33)
  const mes = String(1 + (h % 12)).padStart(2, '0')
  const dia = String(1 + (h % 27)).padStart(2, '0')
  const ddd = 11 + (h % 80)
  const sit = _mock(cnpj)
  return {
    cnpj,
    cnpj_fmt: _fmtCNPJ(cnpj),
    razao: `${ramo} ${marca} ${sufixo}`,
    fantasia: `${marca} ${ramo}`,
    situacao: sit.situacao_cadastral,
    regular: sit.regular,
    logradouro: _pick(_LOGRAD, Math.floor(h / 5)),
    numero: String(50 + (h % 1950)),
    bairro: _pick(_BAIRROS, Math.floor(h / 11)),
    cidade: _CIDADES[uf],
    uf,
    cep: `${String(10000 + (h % 89999)).slice(0, 5)}-${String(100 + (h % 899)).slice(0, 3)}`,
    email: `contato@${marca.toLowerCase()}${(h % 90) + 10}.com.br`,
    telefone: `(${ddd}) ${String(90000 + (h % 9999)).slice(0, 5)}-${String(1000 + (h % 8999)).slice(0, 4)}`,
    porte: _pick(_PORTES, Math.floor(h / 17)),
    atividade: _pick(_ATIV, Math.floor(h / 19)),
    abertura: `${ano}-${mes}-${dia}`,
    capital: 50000 * (1 + (h % 200)),
    natureza: _pick(_NATUREZAS, Math.floor(h / 23)),
    fonte: 'mock',
    ok: true,
  }
}

/**
 * consultarCadastroCNPJ(cnpj, opts) — dados cadastrais completos para preencher
 * o formulário de fornecedor. Retorna o objeto normalizado ou lança em erro.
 */
export async function consultarCadastroCNPJ(cnpj, opts = {}) {
  const limpo = _soDigitos(cnpj)
  if (limpo.length !== 14) throw new Error('CNPJ inválido (14 dígitos)')
  const provider = (opts.provider || 'mock').toLowerCase()
  if (provider === 'mock') return _cadastroMock(limpo)
  throw new Error('Provedor de cadastro CNPJ não configurado: ' + provider)
}

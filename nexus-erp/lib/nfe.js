/**
 * nfe.js — Adaptador de emissão de documentos fiscais (NF-e / NFS-e / CT-e).
 * Mesma filosofia dos demais adaptadores: a emissão real exige integração
 * autenticada com SEFAZ via provedor (Focus NF-e, eNotas, NFe.io) e roda no
 * servidor. O provedor `mock` é determinístico — valida os campos e simula a
 * autorização (chave de acesso de 44 dígitos, protocolo, DANFE). Provedores
 * reais plugam aqui (NFE_PROVIDER) sem mudar a interface.
 */
const TIPOS = { nfe: 'NF-e', nfse: 'NFS-e', cte: 'CT-e' }
const _digits = s => String(s || '').replace(/\D/g, '')

function _validar(tipo, d) {
  const erros = []
  if (!TIPOS[tipo]) erros.push('tipo inválido (nfe|nfse|cte)')
  if (_digits(d.cnpj_emitente).length !== 14) erros.push('CNPJ do emitente inválido')
  if (_digits(d.cnpj_destinatario).length !== 14 && _digits(d.cpf_destinatario).length !== 11) erros.push('documento do destinatário inválido')
  if (!(Number(d.valor) > 0)) erros.push('valor deve ser maior que zero')
  if (!d.descricao && !(Array.isArray(d.itens) && d.itens.length)) erros.push('informe itens ou descrição')
  return erros
}

// Chave de acesso de 44 dígitos, plausível e determinística (mock).
function _chave(d, numero) {
  const base = _digits(d.cnpj_emitente) + _digits(String(numero)) + _digits(String(Math.round(Number(d.valor) * 100)))
  let seed = 0; for (const c of base) seed = (seed * 31 + c.charCodeAt(0)) % 1000000007
  return (String(seed) + base + '0'.repeat(44)).replace(/\D/g, '').slice(0, 44)
}

/**
 * emitirNotaFiscal(dados, opts) — valida e (mock) autoriza a nota.
 * @returns { status:'autorizada'|'rejeitada', ... }  (não lança em validação)
 */
export async function emitirNotaFiscal(dados = {}, opts = {}) {
  const tipo = String(dados.tipo || 'nfe').toLowerCase()
  const erros = _validar(tipo, dados)
  if (erros.length) return { status: 'rejeitada', tipo, motivo: erros.join('; ') }
  const provider = (opts.provider || 'mock').toLowerCase()
  if (provider !== 'mock') throw new Error('Provedor de NF-e não configurado: ' + provider)
  const numero = Number(dados.numero) || 1
  const serie = Number(dados.serie) || 1
  const chave = _chave(dados, numero)
  return {
    status: 'autorizada', tipo, tipo_label: TIPOS[tipo],
    numero, serie, chave,
    protocolo: '1' + chave.slice(0, 14),
    danfe_url: `/danfe/${chave}.pdf`,
    valor: Number(dados.valor),
    fonte: 'mock',
  }
}

/**
 * cancelarNotaFiscal(chave, justificativa, opts) — regra SEFAZ: justificativa
 * com no mínimo 15 caracteres.
 */
export function cancelarNotaFiscal(chave, justificativa, opts = {}) {
  const ch = _digits(chave)
  if (ch.length !== 44) return { status: 'erro', motivo: 'chave inválida (44 dígitos)' }
  if (String(justificativa || '').trim().length < 15) return { status: 'rejeitada', motivo: 'justificativa de cancelamento exige no mínimo 15 caracteres (regra SEFAZ)' }
  const provider = (opts.provider || 'mock').toLowerCase()
  if (provider !== 'mock') throw new Error('Provedor de NF-e não configurado: ' + provider)
  return { status: 'cancelada', chave: ch, protocolo: '2' + ch.slice(0, 14) }
}

export const _internal = { _chave, _validar, TIPOS }

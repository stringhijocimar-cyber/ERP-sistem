/**
 * nfe.js — Adaptador de emissão de documentos fiscais (NF-e / NFS-e / CT-e).
 *
 * Provider-agnóstico (mesma filosofia de credit_bureau.js / receita.js):
 *   - `mock`      → determinístico; valida campos e simula autorização.
 *   - `plugnotas` → emissor homologado real (NFS-e nesta fase). A rede fica
 *                   atrás de `fetch`, então o construtor de payload e o parser
 *                   de resposta são funções PURAS e testáveis sem credencial.
 *
 * O servidor injeta as credenciais por opts (apiKey/baseUrl/ambiente), lidas
 * do env (NFE_PROVIDER/NFE_API_KEY/NFE_BASE_URL/NFE_AMBIENTE) — a lib não lê
 * process.env, para permanecer pura e portável (Node e Worker).
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

function _emitirMock(dados, tipo) {
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

// ── PlugNotas (NFS-e) ──────────────────────────────────────────────────────
// Base sandbox por padrão — produção sobrescreve via NFE_BASE_URL.
const PLUGNOTAS_SANDBOX = 'https://api.sandbox.plugnotas.com.br'

// Monta o corpo de emissão de NFS-e do PlugNotas a partir do nosso `dados`.
// Função PURA (sem rede) — o núcleo do que os testes verificam.
function _montarPayloadPlugNotasNFSe(d = {}, opts = {}) {
  const tomadorDoc = _digits(d.cnpj_destinatario) || _digits(d.cpf_destinatario)
  const discriminacao = d.descricao ||
    (Array.isArray(d.itens) ? d.itens.map(i => i.descricao || i.desc || '').filter(Boolean).join('; ') : '')
  const payload = {
    prestador: { cpfCnpj: _digits(d.cnpj_emitente) },
    tomador: {
      cpfCnpj: tomadorDoc,
      razaoSocial: d.nome_destinatario || d.destinatario || undefined,
      email: d.email_destinatario || undefined,
    },
    servico: {
      codigo: d.codigo_servico || undefined,   // código do serviço municipal
      cnae: d.cnae || undefined,
      discriminacao,
      iss: { tipoTributacao: d.iss_tipo_tributacao != null ? d.iss_tipo_tributacao : 6 },
      valor: { servico: Number(d.valor) },
    },
    ambiente: String(opts.ambiente || '').toLowerCase() === 'producao' ? 'PRODUCAO' : 'HOMOLOGACAO',
  }
  if (d.id_integracao != null || d.numero != null) payload.idIntegracao = String(d.id_integracao != null ? d.id_integracao : d.numero)
  return payload
}

// Normaliza a resposta do PlugNotas (emissão ou consulta) para o nosso formato.
// PURA. Aceita { documents:[{...}] } | array | objeto único, e status HTTP.
function _parseRespostaPlugNotas(json, httpStatus = 200) {
  if (httpStatus >= 400) {
    const msg = (json && (json.message || json.error ||
      (Array.isArray(json.errors) && json.errors.map(e => e.message || e).join('; ')))) || `HTTP ${httpStatus}`
    return { status: 'rejeitada', fonte: 'plugnotas', tipo: 'nfse', tipo_label: 'NFS-e', motivo: msg }
  }
  const doc = (json && Array.isArray(json.documents) ? json.documents[0]
            : (Array.isArray(json) ? json[0] : json)) || {}
  const raw = String(doc.status || (json && json.status) || '').toUpperCase()
  const status = (raw === 'CONCLUIDO' || raw === 'AUTORIZADO' || raw === 'CONCLUÍDO') ? 'autorizada'
    : (raw === 'REJEITADO' || raw === 'CANCELADO' || raw === 'NEGADO' || raw === 'ERRO') ? 'rejeitada'
    : 'processando'
  return {
    status, fonte: 'plugnotas', tipo: 'nfse', tipo_label: 'NFS-e',
    id: doc.id || (json && json.id) || null,
    protocolo: doc.protocolo || null,
    chave: doc.chaveAcesso || doc.chave || null,
    numero: doc.numeroNfse || doc.numero || null,
    danfe_url: doc.pdf || doc.linkDownloadPDF || (doc.id ? `/nfse/${doc.id}/pdf` : null),
    xml_url: doc.xml || doc.linkDownloadXML || null,
    motivo: doc.mensagem || (json && json.message) || null,
  }
}

async function _emitirPlugNotas(dados, tipo, opts) {
  if (tipo !== 'nfse') return { status: 'rejeitada', tipo, fonte: 'plugnotas', motivo: 'Adapter PlugNotas cobre NFS-e nesta fase' }
  if (!opts.apiKey) return { status: 'erro', fonte: 'plugnotas', motivo: 'NFE_API_KEY ausente (configure a chave do PlugNotas)' }
  const baseUrl = String(opts.baseUrl || PLUGNOTAS_SANDBOX).replace(/\/+$/, '')
  const payload = _montarPayloadPlugNotasNFSe(dados, opts)
  try {
    const res = await fetch(`${baseUrl}/nfse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': opts.apiKey },
      body: JSON.stringify([payload]),
    })
    let json = null; try { json = await res.json() } catch (_) { json = null }
    return _parseRespostaPlugNotas(json || {}, res.status)
  } catch (e) {
    return { status: 'erro', fonte: 'plugnotas', motivo: 'Falha de rede ao emitir: ' + e.message }
  }
}

/**
 * emitirNotaFiscal(dados, opts) — valida e emite (mock ou provedor real).
 * Nunca lança por validação: devolve { status:'rejeitada'|'erro', ... }.
 */
export async function emitirNotaFiscal(dados = {}, opts = {}) {
  const tipo = String(dados.tipo || 'nfe').toLowerCase()
  const erros = _validar(tipo, dados)
  if (erros.length) return { status: 'rejeitada', tipo, motivo: erros.join('; ') }
  const provider = (opts.provider || 'mock').toLowerCase()
  if (provider === 'mock') return _emitirMock(dados, tipo)
  if (provider === 'plugnotas') return _emitirPlugNotas(dados, tipo, opts)
  throw new Error('Provedor de NF-e não configurado: ' + provider)
}

/**
 * consultarNotaFiscal(id, opts) — status assíncrono da nota (emissores
 * autorizam em background). mock devolve autorizada; plugnotas consulta.
 */
export async function consultarNotaFiscal(id, opts = {}) {
  const provider = (opts.provider || 'mock').toLowerCase()
  if (provider === 'mock') return { status: 'autorizada', id, fonte: 'mock', tipo: 'nfse', tipo_label: 'NFS-e' }
  if (provider !== 'plugnotas') throw new Error('Provedor de NF-e não configurado: ' + provider)
  if (!opts.apiKey) return { status: 'erro', fonte: 'plugnotas', motivo: 'NFE_API_KEY ausente' }
  if (!id) return { status: 'erro', fonte: 'plugnotas', motivo: 'id da nota ausente' }
  const baseUrl = String(opts.baseUrl || PLUGNOTAS_SANDBOX).replace(/\/+$/, '')
  try {
    const res = await fetch(`${baseUrl}/nfse/${encodeURIComponent(id)}`, { headers: { 'x-api-key': opts.apiKey } })
    let json = null; try { json = await res.json() } catch (_) { json = null }
    return _parseRespostaPlugNotas(json || {}, res.status)
  } catch (e) {
    return { status: 'erro', fonte: 'plugnotas', motivo: 'Falha de rede na consulta: ' + e.message }
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
  if (provider === 'mock') return { status: 'cancelada', chave: ch, protocolo: '2' + ch.slice(0, 14) }
  // Cancelamento via emissor real é assíncrono — não implementado nesta fase.
  if (provider === 'plugnotas') return { status: 'erro', fonte: 'plugnotas', motivo: 'Cancelamento via PlugNotas ainda não implementado nesta fase' }
  throw new Error('Provedor de NF-e não configurado: ' + provider)
}

export const _internal = { _chave, _validar, TIPOS, _montarPayloadPlugNotasNFSe, _parseRespostaPlugNotas, PLUGNOTAS_SANDBOX }

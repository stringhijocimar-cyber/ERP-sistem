/**
 * storage.js — Upload de arquivos binários (puro; sem I/O de rede/banco).
 *
 * Valida e decodifica o upload (base64) antes de persistir. Os BYTES são
 * guardados de verdade (BLOB no banco por padrão) — não é ponteiro por nome.
 * O seam de provider (db|local|s3|r2) fica no servidor; aqui só a validação
 * e a decodificação, testáveis sem credencial.
 */

// Extensões aceitas: certidões/contratos (pdf/office/imagem) + engenharia
// (desenho/step/dwg) + dados (csv/xml/zip). A defesa forte é o tamanho.
const EXT_PERMITIDAS = new Set([
  'pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp',
  'doc', 'docx', 'xls', 'xlsx', 'csv', 'txt', 'xml',
  'dwg', 'dxf', 'step', 'stp', 'zip',
])
const MAX_BYTES_PADRAO = 5 * 1024 * 1024 // 5 MB

export function extensaoDe(nome) {
  const s = String(nome || '')
  const i = s.lastIndexOf('.')
  return i >= 0 ? s.slice(i + 1).toLowerCase().trim() : ''
}

// Remove o prefixo data-URI ("data:...;base64,") se vier do <input type=file>.
export function _semPrefixoDataURI(b64) {
  const s = String(b64 || '')
  const m = s.match(/^data:[^;]*;base64,(.*)$/s)
  return m ? m[1] : s
}

// Decodifica base64 → Buffer (Node) ou Uint8Array-like. Retorna null se inválido.
export function decodeBase64(b64) {
  try {
    const limpo = _semPrefixoDataURI(b64).replace(/\s/g, '')
    if (!limpo) return null
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(limpo)) return null
    return Buffer.from(limpo, 'base64')
  } catch { return null }
}

// Valida o upload. Retorna { ok, bytes(Buffer), tamanho, ext } ou { ok:false, erro }.
export function validarUpload({ nome, conteudo_base64 } = {}, { maxBytes = MAX_BYTES_PADRAO } = {}) {
  const nomeLimpo = String(nome || '').trim()
  if (!nomeLimpo) return { ok: false, erro: 'Nome do arquivo obrigatório' }
  const ext = extensaoDe(nomeLimpo)
  if (!EXT_PERMITIDAS.has(ext)) return { ok: false, erro: `Extensão .${ext || '?'} não permitida` }
  const bytes = decodeBase64(conteudo_base64)
  if (!bytes || bytes.length === 0) return { ok: false, erro: 'Conteúdo do arquivo inválido ou vazio' }
  if (bytes.length > maxBytes) return { ok: false, erro: `Arquivo excede o limite de ${Math.round(maxBytes / 1024 / 1024)} MB` }
  return { ok: true, bytes, tamanho: bytes.length, ext, nome: nomeLimpo }
}

// MIME por extensão (para o Content-Type do download; genérico quando não sabe).
const MIME = {
  pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  gif: 'image/gif', webp: 'image/webp', csv: 'text/csv', txt: 'text/plain',
  xml: 'application/xml', zip: 'application/zip',
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}
export function mimeDe(nome) {
  return MIME[extensaoDe(nome)] || 'application/octet-stream'
}

export const _EXT_PERMITIDAS = EXT_PERMITIDAS
export const _MAX_BYTES_PADRAO = MAX_BYTES_PADRAO

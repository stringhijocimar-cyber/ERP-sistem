// ============================================================
// Testes — lib/storage.js (puro): validação de upload, decode base64,
// allowlist de extensão, cap de tamanho, mime.
// ============================================================
import { describe, expect, it } from 'vitest'
import { validarUpload, decodeBase64, extensaoDe, mimeDe, _semPrefixoDataURI } from '../lib/storage.js'

const b64 = s => Buffer.from(s).toString('base64')

describe('decode e prefixo', () => {
  it('remove prefixo data-URI', () => {
    expect(_semPrefixoDataURI('data:application/pdf;base64,QUJD')).toBe('QUJD')
  })
  it('decodeBase64 devolve os bytes; inválido → null', () => {
    expect(decodeBase64(b64('hello')).toString()).toBe('hello')
    expect(decodeBase64('não é base64 @#$')).toBeNull()
    expect(decodeBase64('')).toBeNull()
  })
})

describe('extensaoDe / mimeDe', () => {
  it('extensão em minúsculo', () => expect(extensaoDe('CND-Federal.PDF')).toBe('pdf'))
  it('mime conhecido e genérico', () => {
    expect(mimeDe('a.pdf')).toBe('application/pdf')
    expect(mimeDe('desenho.dwg')).toBe('application/octet-stream')
  })
})

describe('validarUpload', () => {
  it('aceita pdf válido e devolve bytes/tamanho', () => {
    const r = validarUpload({ nome: 'cnd.pdf', conteudo_base64: b64('conteudo do pdf') })
    expect(r.ok).toBe(true)
    expect(r.tamanho).toBe(15)
    expect(r.bytes.toString()).toBe('conteudo do pdf')
  })
  it('nome sem extensão permitida → erro', () => {
    expect(validarUpload({ nome: 'virus.exe', conteudo_base64: b64('x') }).ok).toBe(false)
    expect(validarUpload({ nome: 'semext', conteudo_base64: b64('x') }).ok).toBe(false)
  })
  it('sem nome → erro; conteúdo vazio/inválido → erro', () => {
    expect(validarUpload({ conteudo_base64: b64('x') }).ok).toBe(false)
    expect(validarUpload({ nome: 'a.pdf', conteudo_base64: '' }).ok).toBe(false)
  })
  it('excede o limite de tamanho → erro', () => {
    const grande = b64('a'.repeat(2000))
    const r = validarUpload({ nome: 'big.pdf', conteudo_base64: grande }, { maxBytes: 1000 })
    expect(r.ok).toBe(false)
    expect(r.erro).toMatch(/limite/)
  })
  it('aceita extensões de engenharia (dwg/step) e office (xlsx)', () => {
    for (const nome of ['peca.dwg', 'modelo.step', 'planilha.xlsx']) {
      expect(validarUpload({ nome, conteudo_base64: b64('x') }).ok).toBe(true)
    }
  })
})

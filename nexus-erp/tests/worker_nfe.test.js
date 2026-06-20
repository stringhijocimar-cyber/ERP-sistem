// ============================================================
// Worker (nexus-cf) — NF-e (adaptador) + paridade com lib/nfe.js do Express.
// ============================================================
import { describe, expect, it } from 'vitest'
import { emitirNotaFiscal as wEmitir, cancelarNotaFiscal as wCancelar } from '../../nexus-cf/src/index.js'
import { emitirNotaFiscal as eEmitir, cancelarNotaFiscal as eCancelar } from '../lib/nfe.js'

const VALIDA = { tipo: 'nfe', cnpj_emitente: '11222333000181', cnpj_destinatario: '11444777000161', valor: 1500, descricao: 'Serviço', numero: 5 }

describe('Worker — NF-e', () => {
  it('autoriza e gera chave de 44 dígitos', async () => {
    const r = await wEmitir(VALIDA)
    expect(r.status).toBe('autorizada')
    expect(r.chave).toMatch(/^\d{44}$/)
  })
  it('paridade de emissão com o Express (mesma chave/protocolo)', async () => {
    expect(await wEmitir(VALIDA)).toEqual(await eEmitir(VALIDA))
  })
  it('paridade de cancelamento (regra dos 15 caracteres)', () => {
    const ch = '0'.repeat(44)
    expect(wCancelar(ch, 'curta')).toEqual(eCancelar(ch, 'curta'))
    expect(wCancelar(ch, 'erro de digitação no valor')).toEqual(eCancelar(ch, 'erro de digitação no valor'))
  })
})

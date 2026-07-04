// ============================================================
// Testes — Adapter PlugNotas (NFS-e). Payload e parser são PUROS; a
// emissão/consulta usam fetch (mockado — sem credencial real no CI).
// ============================================================
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { consultarNotaFiscal, emitirNotaFiscal, _internal } from '../lib/nfe.js'

const NFSE = {
  tipo: 'nfse', cnpj_emitente: '11.222.333/0001-81', cnpj_destinatario: '11.444.777/0001-61',
  nome_destinatario: 'Minera Serra Azul S.A.', descricao: 'Manutenção industrial', valor: 12000,
  codigo_servico: '14.01', numero: 7,
}
const OPTS = { provider: 'plugnotas', apiKey: 'chave-sandbox', baseUrl: 'https://api.sandbox.plugnotas.com.br', ambiente: 'homologacao' }

afterEach(() => { vi.restoreAllMocks() })

describe('_montarPayloadPlugNotasNFSe (puro)', () => {
  it('mapeia prestador/tomador/servico e ambiente', () => {
    const p = _internal._montarPayloadPlugNotasNFSe(NFSE, { ambiente: 'homologacao' })
    expect(p.prestador.cpfCnpj).toBe('11222333000181')      // só dígitos
    expect(p.tomador.cpfCnpj).toBe('11444777000161')
    expect(p.tomador.razaoSocial).toBe('Minera Serra Azul S.A.')
    expect(p.servico.valor.servico).toBe(12000)
    expect(p.servico.codigo).toBe('14.01')
    expect(p.servico.discriminacao).toBe('Manutenção industrial')
    expect(p.ambiente).toBe('HOMOLOGACAO')
    expect(p.idIntegracao).toBe('7')
  })
  it('produção quando ambiente=producao; discriminação a partir de itens', () => {
    const p = _internal._montarPayloadPlugNotasNFSe({ ...NFSE, descricao: '', itens: [{ descricao: 'Item A' }, { descricao: 'Item B' }] }, { ambiente: 'producao' })
    expect(p.ambiente).toBe('PRODUCAO')
    expect(p.servico.discriminacao).toBe('Item A; Item B')
  })
})

describe('_parseRespostaPlugNotas (puro)', () => {
  it('CONCLUIDO → autorizada com chave/numero/pdf', () => {
    const r = _internal._parseRespostaPlugNotas({ documents: [{ id: 'abc', status: 'CONCLUIDO', chaveAcesso: '123', numeroNfse: 55, pdf: 'http://pdf' }] }, 200)
    expect(r.status).toBe('autorizada')
    expect(r.id).toBe('abc'); expect(r.chave).toBe('123'); expect(r.numero).toBe(55); expect(r.danfe_url).toBe('http://pdf')
  })
  it('PROCESSANDO → processando (autorização assíncrona)', () => {
    expect(_internal._parseRespostaPlugNotas({ documents: [{ id: 'x', status: 'PROCESSANDO' }] }, 200).status).toBe('processando')
  })
  it('REJEITADO → rejeitada; HTTP 400 → rejeitada com motivo', () => {
    expect(_internal._parseRespostaPlugNotas({ status: 'REJEITADO', mensagem: 'código inválido' }, 200).status).toBe('rejeitada')
    const err = _internal._parseRespostaPlugNotas({ message: 'x-api-key inválida' }, 401)
    expect(err.status).toBe('rejeitada')
    expect(err.motivo).toMatch(/api-key/i)
  })
})

describe('emitirNotaFiscal — provider plugnotas', () => {
  it('POSTa /nfse com x-api-key e o payload em array; parseia processando', async () => {
    const spy = vi.fn(async () => ({ status: 202, json: async () => ({ documents: [{ id: 'nfse-1', status: 'PROCESSANDO' }] }) }))
    global.fetch = spy
    const r = await emitirNotaFiscal(NFSE, OPTS)
    expect(r.status).toBe('processando')
    expect(r.id).toBe('nfse-1')
    const [url, req] = spy.mock.calls[0]
    expect(url).toBe('https://api.sandbox.plugnotas.com.br/nfse')
    expect(req.headers['x-api-key']).toBe('chave-sandbox')
    expect(Array.isArray(JSON.parse(req.body))).toBe(true)
  })

  it('sem apiKey → status erro (não emite)', async () => {
    global.fetch = vi.fn()
    const r = await emitirNotaFiscal(NFSE, { provider: 'plugnotas' })
    expect(r.status).toBe('erro')
    expect(r.motivo).toMatch(/API_KEY/i)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('NF-e (produto) ainda não coberto pelo adapter → rejeitada explicando', async () => {
    const r = await emitirNotaFiscal({ ...NFSE, tipo: 'nfe' }, OPTS)
    expect(r.status).toBe('rejeitada')
    expect(r.motivo).toMatch(/NFS-e/i)
  })

  it('validação (valor 0) rejeita ANTES de chamar o provedor', async () => {
    global.fetch = vi.fn()
    const r = await emitirNotaFiscal({ ...NFSE, valor: 0 }, OPTS)
    expect(r.status).toBe('rejeitada')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('provider desconhecido lança (config incorreta é erro de operação)', async () => {
    await expect(emitirNotaFiscal(NFSE, { provider: 'inexistente', apiKey: 'x' })).rejects.toThrow(/não configurado/i)
  })
})

describe('consultarNotaFiscal', () => {
  it('mock → autorizada; plugnotas consulta e normaliza', async () => {
    expect((await consultarNotaFiscal('id', { provider: 'mock' })).status).toBe('autorizada')
    global.fetch = vi.fn(async () => ({ status: 200, json: async () => ({ id: 'nfse-1', status: 'CONCLUIDO', chaveAcesso: 'ch', pdf: 'http://p' }) }))
    const r = await consultarNotaFiscal('nfse-1', OPTS)
    expect(r.status).toBe('autorizada')
    expect(r.chave).toBe('ch')
  })
})

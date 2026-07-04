// ============================================================
// Testes — endpoint /api/nfe/emitir + /status com o provider PlugNotas.
// Emissão assíncrona persiste 'processando'; a consulta atualiza para
// 'autorizada'. Tudo escopado por tenant. fetch é mockado (sem credencial).
// ============================================================
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'
// Ativa o provider real (com fetch mockado) só para esta suíte.
process.env.NFE_PROVIDER = 'plugnotas'
process.env.NFE_API_KEY = 'chave-sandbox'
process.env.NFE_BASE_URL = 'https://api.sandbox.plugnotas.com.br'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
let request, app, token

beforeAll(async () => {
  const st = await import('supertest')
  request = st.default
  ;({ app } = await import('../server.js'))
  token = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token
})

afterAll(() => { delete process.env.NFE_PROVIDER; delete process.env.NFE_API_KEY; delete process.env.NFE_BASE_URL; vi.restoreAllMocks() })

const auth = r => r.set('Authorization', `Bearer ${token}`)

describe('/api/nfe/emitir + /status — PlugNotas (fetch mockado)', () => {
  it('emissão assíncrona persiste como processando com o provider_id', async () => {
    global.fetch = vi.fn(async () => ({ status: 202, json: async () => ({ documents: [{ id: 'nfse-77', status: 'PROCESSANDO' }] }) }))
    const r = await auth(request(app).post('/api/nfe/emitir')).send({
      tipo: 'nfse', cnpj_emitente: '11222333000181', cnpj_destinatario: '11444777000161',
      descricao: 'Manutenção industrial', valor: 12000, codigo_servico: '14.01',
    })
    expect(r.status).toBe(201)
    expect(r.body.data.status).toBe('processando')
    expect(r.body.data.provider_id).toBe('nfse-77')
    expect(r.body.data.fonte).toBe('plugnotas')
  })

  it('consulta de status atualiza a nota para autorizada com chave/pdf', async () => {
    const nota = (await auth(request(app).get('/api/nfe'))).body.data[0]
    global.fetch = vi.fn(async () => ({ status: 200, json: async () => ({ id: 'nfse-77', status: 'CONCLUIDO', chaveAcesso: '35240711222333000181...', numeroNfse: 123, pdf: 'http://pdf/nfse-77' }) }))
    const r = await auth(request(app).post(`/api/nfe/${nota.id}/status`)).send({})
    expect(r.status).toBe(200)
    expect(r.body.data.status).toBe('autorizada')
    expect(r.body.data.danfe_url).toBe('http://pdf/nfse-77')
  })

  it('emissão rejeitada pelo provedor não persiste (422)', async () => {
    global.fetch = vi.fn(async () => ({ status: 400, json: async () => ({ message: 'código de serviço inválido' }) }))
    const antes = (await auth(request(app).get('/api/nfe'))).body.data.length
    const r = await auth(request(app).post('/api/nfe/emitir')).send({
      tipo: 'nfse', cnpj_emitente: '11222333000181', cnpj_destinatario: '11444777000161', descricao: 'x', valor: 500,
    })
    expect(r.status).toBe(422)
    const depois = (await auth(request(app).get('/api/nfe'))).body.data.length
    expect(depois).toBe(antes)
  })
})

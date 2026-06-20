// ============================================================
// Testes — Emissão fiscal NF-e/NFS-e/CT-e (adaptador + endpoints)
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'
import { cancelarNotaFiscal, emitirNotaFiscal } from '../lib/nfe.js'

const VALIDA = { tipo: 'nfe', cnpj_emitente: '11222333000181', cnpj_destinatario: '11444777000161', valor: 1500, descricao: 'Serviço de manutenção' }

describe('Adaptador NF-e (lib pura)', () => {
  it('autoriza nota válida com chave de 44 dígitos', async () => {
    const r = await emitirNotaFiscal({ ...VALIDA, numero: 1 })
    expect(r.status).toBe('autorizada')
    expect(r.chave).toMatch(/^\d{44}$/)
    expect(r.danfe_url).toContain(r.chave)
    expect(r.tipo_label).toBe('NF-e')
  })

  it('rejeita sem destinatário / valor / descrição', async () => {
    expect((await emitirNotaFiscal({ tipo: 'nfe', cnpj_emitente: '11222333000181', valor: 100, descricao: 'x' })).status).toBe('rejeitada')
    expect((await emitirNotaFiscal({ ...VALIDA, valor: 0 })).status).toBe('rejeitada')
    expect((await emitirNotaFiscal({ tipo: 'nfe', cnpj_emitente: '11222333000181', cnpj_destinatario: '11444777000161', valor: 10 })).status).toBe('rejeitada')
  })

  it('é determinística (mesma chave para os mesmos dados)', async () => {
    const a = await emitirNotaFiscal({ ...VALIDA, numero: 7 })
    const b = await emitirNotaFiscal({ ...VALIDA, numero: 7 })
    expect(a.chave).toBe(b.chave)
  })

  it('cancelamento exige justificativa de 15+ caracteres (SEFAZ)', () => {
    const ch = '0'.repeat(44)
    expect(cancelarNotaFiscal(ch, 'curta').status).toBe('rejeitada')
    expect(cancelarNotaFiscal(ch, 'erro de digitação no valor total').status).toBe('cancelada')
    expect(cancelarNotaFiscal('123', 'justificativa longa o suficiente').status).toBe('erro')
  })
})

describe('Endpoints /api/nfe', () => {
  const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
  let request, app, token
  beforeAll(async () => {
    process.env.NODE_ENV = 'test'; process.env.DB_PATH = ':memory:'; process.env.SEED_PASSWORD = 'Fraser@2025'
    const st = await import('supertest'); request = st.default
    ;({ app } = await import('../server.js'))
    token = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token
  })
  const emitir = body => request(app).post('/api/nfe/emitir').set('Authorization', `Bearer ${token}`).send(body)

  it('emite e persiste uma NF-e (201)', async () => {
    const r = await emitir(VALIDA)
    expect(r.status).toBe(201)
    expect(r.body.data.status).toBe('autorizada')
    expect(r.body.data.chave).toMatch(/^\d{44}$/)
    expect(r.body.data.numero).toBeGreaterThanOrEqual(1)
  })

  it('rejeita emissão inválida (422)', async () => {
    const r = await emitir({ tipo: 'nfe', cnpj_emitente: '11222333000181', valor: 0 })
    expect(r.status).toBe(422)
  })

  it('lista as notas emitidas', async () => {
    const r = await request(app).get('/api/nfe').set('Authorization', `Bearer ${token}`)
    expect(r.status).toBe(200)
    expect(r.body.data.length).toBeGreaterThanOrEqual(1)
  })

  it('cancela com justificativa válida e bloqueia recancelamento', async () => {
    const id = (await emitir(VALIDA)).body.data.id
    const curto = await request(app).post(`/api/nfe/${id}/cancelar`).set('Authorization', `Bearer ${token}`).send({ justificativa: 'erro' })
    expect(curto.status).toBe(400)
    const ok = await request(app).post(`/api/nfe/${id}/cancelar`).set('Authorization', `Bearer ${token}`).send({ justificativa: 'nota emitida em duplicidade' })
    expect(ok.status).toBe(200)
    expect(ok.body.data.status).toBe('cancelada')
    const dnv = await request(app).post(`/api/nfe/${id}/cancelar`).set('Authorization', `Bearer ${token}`).send({ justificativa: 'nota emitida em duplicidade' })
    expect(dnv.status).toBe(409)
  })
})

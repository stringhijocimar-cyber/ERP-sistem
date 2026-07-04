// ============================================================
// Testes — Contas a Receber (o lado "dinheiro que entra").
// Ciclo A Receber → faturar (NF) → receber (baixa), numeração e
// isolamento por tenant; espelha Contas a Pagar.
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
let request, app, token, tokenB

beforeAll(async () => {
  const st = await import('supertest')
  request = st.default
  ;({ app } = await import('../server.js'))
  token = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token
  const m = r => r.set('Authorization', `Bearer ${token}`)
  const empB = (await m(request(app).post('/api/empresas')).send({ razao_social: 'Tenant B' })).body.data.id
  await m(request(app).post('/api/usuarios')).send({ nome: 'Admin B', email: 'cr.b@x.com', senha: 'Aa@123456', perfil: 'admin', empresa_id: empB })
  tokenB = (await request(app).post('/api/auth/login').send({ email: 'cr.b@x.com', senha: 'Aa@123456' })).body?.data?.token
})

const auth = r => r.set('Authorization', `Bearer ${token}`)
const asB = r => r.set('Authorization', `Bearer ${tokenB}`)
const novaCR = (over = {}) => auth(request(app).post('/api/contas-receber')).send({ cliente: 'Minera Serra Azul', descricao: 'Medição 07', valor: 250000, data_vencimento: '2026-09-10', ...over })

describe('Contas a Receber — ciclo e numeração', () => {
  it('cria com número CR-AAAA-NNN e status A Receber', async () => {
    const r = await novaCR()
    expect(r.status).toBe(201)
    expect(r.body.data.numero).toMatch(/^CR-\d{4}-\d{3}$/)
    expect(r.body.data.status).toBe('A Receber')
    expect(r.body.data.valor).toBe(250000)
  })

  it('rejeita valor <= 0 (400)', async () => {
    expect((await novaCR({ valor: 0 })).status).toBe(400)
  })

  it('faturar vincula a NF e mantém A Receber', async () => {
    const id = (await novaCR()).body.data.id
    const r = await auth(request(app).post(`/api/contas-receber/${id}/faturar`)).send({ nota_fiscal: 'NFSE-123' })
    expect(r.body.data.nota_fiscal).toBe('NFSE-123')
    expect(r.body.data.status).toBe('A Receber')
  })

  it('receber baixa o título (Recebida) e bloqueia duplicidade (409)', async () => {
    const id = (await novaCR()).body.data.id
    const r = await auth(request(app).post(`/api/contas-receber/${id}/receber`)).send({ forma_recebimento: 'PIX' })
    expect(r.body.data.status).toBe('Recebida')
    expect(r.body.data.data_recebimento).toBeTruthy()
    const dup = await auth(request(app).post(`/api/contas-receber/${id}/receber`)).send({})
    expect(dup.status).toBe(409)
  })

  it('filtra por status', async () => {
    const r = await auth(request(app).get('/api/contas-receber?status=Recebida'))
    expect(r.body.data.every(c => c.status === 'Recebida')).toBe(true)
  })
})

describe('Contas a Receber — isolamento por tenant', () => {
  it('tenant B não vê as contas a receber de A e recebe 404 ao operar por id', async () => {
    const idA = (await novaCR()).body.data.id
    const listaB = (await asB(request(app).get('/api/contas-receber'))).body.data
    expect(listaB.some(c => c.id === idA)).toBe(false)
    expect((await asB(request(app).post(`/api/contas-receber/${idA}/receber`)).send({})).status).toBe(404)
    expect((await asB(request(app).put(`/api/contas-receber/${idA}`)).send({ valor: 1 })).status).toBe(404)
  })

  it('numeração é independente por empresa (B começa em CR-...-001)', async () => {
    const r = await asB(request(app).post('/api/contas-receber')).send({ cliente: 'Cliente B', valor: 1000 })
    expect(r.body.data.numero).toMatch(/-001$/)
  })
})

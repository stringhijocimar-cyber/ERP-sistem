// ============================================================
// Testes — Portal · Entregas & OTIF: programação nasce na emissão do PC,
// fornecedor confirma/replaneja (justificativa obrigatória), recebimento
// interno grava a entrega real, OTIF no dashboard. Isolamento por fornecedor.
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'
process.env.ENFORCE_RECEITA_PO = '0'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
let request, app, db, token, tokF1, tokF2, f1, f2, pcId, entregaId

const D = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10)

beforeAll(async () => {
  const st = await import('supertest')
  request = st.default
  ;({ app, db } = await import('../server.js'))
  token = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token
  const m = r => r.set('Authorization', `Bearer ${token}`)
  f1 = (await m(request(app).post('/api/fornecedores')).send({ nome: 'Aços Alfa', status: 'Homologado' })).body.data.id
  f2 = (await m(request(app).post('/api/fornecedores')).send({ nome: 'Chapas Beta', status: 'Homologado' })).body.data.id
  await m(request(app).post('/api/usuarios')).send({ nome: 'U1', email: 'ent1@f.com', senha: 'Aa@123456', perfil: 'fornecedor', fornecedor_id: f1, empresa_id: 1 })
  await m(request(app).post('/api/usuarios')).send({ nome: 'U2', email: 'ent2@f.com', senha: 'Aa@123456', perfil: 'fornecedor', fornecedor_id: f2, empresa_id: 1 })
  tokF1 = (await request(app).post('/api/auth/login').send({ email: 'ent1@f.com', senha: 'Aa@123456' })).body?.data?.token
  tokF2 = (await request(app).post('/api/auth/login').send({ email: 'ent2@f.com', senha: 'Aa@123456' })).body?.data?.token

  // Pedido real do F1 com prazo em data ISO → deve gerar a programação.
  pcId = (await m(request(app).post('/api/pedidos')).send({ fornecedor_id: f1, valor_total: 50000, prazo_entrega: D(10), itens: [{ descricao: 'Chapa', quantidade: 5, valor_unitario: 10000 }] })).body.data.id
})

const asF1 = r => r.set('Authorization', `Bearer ${tokF1}`)
const asF2 = r => r.set('Authorization', `Bearer ${tokF2}`)

describe('programação nasce na emissão do pedido', () => {
  it('GET /api/portal/entregas mostra a entrega Programada com a promessa original', async () => {
    const r = await asF1(request(app).get('/api/portal/entregas'))
    expect(r.status).toBe(200)
    expect(r.body.data.entregas).toHaveLength(1)
    const e = r.body.data.entregas[0]
    expect(e.data_prometida).toBe(D(10))
    expect(e.status_efetivo).toBe('Programada')
    entregaId = e.id
  })
  it('F2 (outro fornecedor) não vê nada', async () => {
    const r = await asF2(request(app).get('/api/portal/entregas'))
    expect(r.body.data.entregas).toHaveLength(0)
  })
})

describe('confirmar e replanejar', () => {
  it('confirmar sem nova data mantém a promessa (status Confirmada)', async () => {
    const r = await asF1(request(app).post(`/api/portal/entregas/${entregaId}/confirmar`)).send({})
    expect(r.status).toBe(200)
    expect(r.body.data.status).toBe('Confirmada')
    expect(r.body.data.data_confirmada).toBe(D(10))
  })
  it('replanejar SEM justificativa → 400', async () => {
    const r = await asF1(request(app).post(`/api/portal/entregas/${entregaId}/confirmar`)).send({ data_confirmada: D(20) })
    expect(r.status).toBe(400)
  })
  it('replanejar com justificativa muda a data e avisa o comprador', async () => {
    const r = await asF1(request(app).post(`/api/portal/entregas/${entregaId}/confirmar`)).send({ data_confirmada: D(20), justificativa: 'Aciaria parada para manutenção' })
    expect(r.status).toBe(200)
    expect(r.body.data.status).toBe('Replanejada')
    expect(r.body.data.data_confirmada).toBe(D(20))
    const notif = db.prepare(`SELECT * FROM notificacoes WHERE tipo='entrega' ORDER BY id DESC LIMIT 1`).get()
    expect(notif.mensagem).toContain('Aciaria')
  })
  it('data no passado → 400; F2 confirmando entrega do F1 → 404', async () => {
    expect((await asF1(request(app).post(`/api/portal/entregas/${entregaId}/confirmar`)).send({ data_confirmada: D(-3), justificativa: 'x' })).status).toBe(400)
    expect((await asF2(request(app).post(`/api/portal/entregas/${entregaId}/confirmar`)).send({})).status).toBe(404)
  })
})

describe('entrega real fecha o ciclo (OTIF)', () => {
  it('recebimento interno grava data_entregue e o portal reflete', async () => {
    await request(app).post(`/api/pedidos/${pcId}/entrega`).set('Authorization', `Bearer ${token}`).send({ recebedor: 'Almox' })
    const r = await asF1(request(app).get('/api/portal/entregas'))
    const e = r.body.data.entregas[0]
    expect(e.status_efetivo).toBe('Entregue')
    expect(e.data_entregue).toBe(D(0))
    // Entregue hoje, prometido D+10 → dentro do prazo ORIGINAL → OTIF 100.
    expect(r.body.data.resumo.otif_pct).toBe(100)
  })
  it('confirmar entrega já realizada → 409', async () => {
    const r = await asF1(request(app).post(`/api/portal/entregas/${entregaId}/confirmar`)).send({})
    expect(r.status).toBe(409)
  })
  it('dashboard do portal expõe o bloco de entregas com OTIF', async () => {
    const d = (await asF1(request(app).get('/api/portal/dashboard'))).body.data
    expect(d.entregas.otif_pct).toBe(100)
    expect(d.entregas.abertas).toBe(0)
  })
})

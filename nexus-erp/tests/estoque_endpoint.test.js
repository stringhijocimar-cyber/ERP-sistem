// ============================================================
// Testes — estoque (endpoints): movimentar com custo médio + bloqueio de
// saída sem lastro, histórico, reposição, valorização; isolamento por tenant.
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
let request, app, db, token, tokenB, itemId

beforeAll(async () => {
  const st = await import('supertest')
  request = st.default
  ;({ app, db } = await import('../server.js'))
  token = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token
  const m = r => r.set('Authorization', `Bearer ${token}`)
  const empB = (await m(request(app).post('/api/empresas')).send({ razao_social: 'Tenant B' })).body.data.id
  await m(request(app).post('/api/usuarios')).send({ nome: 'Admin B', email: 'est.b@x.com', senha: 'Aa@123456', perfil: 'admin', empresa_id: empB })
  tokenB = (await request(app).post('/api/auth/login').send({ email: 'est.b@x.com', senha: 'Aa@123456' })).body?.data?.token

  itemId = (await m(request(app).post('/api/almoxarifado')).send({ codigo: 'LUVA-01', descricao: 'Luva nitrílica', categoria: 'EPI', unidade: 'PAR', quantidade_atual: 10, quantidade_minima: 20, valor_medio: 2 })).body.data.id
})

const auth = r => r.set('Authorization', `Bearer ${token}`)

describe('movimentar', () => {
  it('Entrada recalcula o custo médio ponderado', async () => {
    const r = await auth(request(app).post(`/api/almoxarifado/${itemId}/movimentar`)).send({ tipo: 'Entrada', quantidade: 10, valor_unitario: 4 })
    expect(r.status).toBe(200)
    expect(r.body.data.quantidade_atual).toBe(20)
    expect(r.body.data.valor_medio).toBe(3) // (10×2 + 10×4)/20
  })
  it('Saída com lastro baixa o saldo', async () => {
    const r = await auth(request(app).post(`/api/almoxarifado/${itemId}/movimentar`)).send({ tipo: 'Saída', quantidade: 5 })
    expect(r.body.data.quantidade_atual).toBe(15)
  })
  it('Saída sem lastro é bloqueada (409) e NÃO altera o saldo', async () => {
    const r = await auth(request(app).post(`/api/almoxarifado/${itemId}/movimentar`)).send({ tipo: 'Saída', quantidade: 999 })
    expect(r.status).toBe(409)
    const item = db.prepare(`SELECT quantidade_atual FROM almoxarifado_itens WHERE id = ?`).get(itemId)
    expect(item.quantidade_atual).toBe(15) // inalterado
  })
  it('grava o histórico com saldo resultante', async () => {
    const r = await auth(request(app).get(`/api/almoxarifado/${itemId}/movimentos`))
    expect(r.body.data.length).toBeGreaterThanOrEqual(2)
    expect(r.body.data[0].saldo_apos).toBe(15) // último movimento (Saída de 5)
  })
})

describe('reposição e valorização', () => {
  it('reposição lista o item abaixo do mínimo com sugestão sensata (2×min, não o default 999)', async () => {
    const r = await auth(request(app).get('/api/almoxarifado/reposicao'))
    const luva = r.body.data.itens.find(i => i.id === itemId)
    expect(luva).toBeTruthy()
    expect(luva.quantidade_atual).toBe(15) // < mínimo 20
    // sem quantidade_maxima definida → alvo = 2×min = 40; repor 40 - 15 = 25
    expect(luva.sugestao_compra).toBe(25)
  })
  it('item criado sem máximo tem quantidade_maxima 0 (não o default 999 do schema)', async () => {
    const novo = (await auth(request(app).post('/api/almoxarifado')).send({ descricao: 'Item sem max', quantidade_minima: 5 })).body.data
    expect(novo.quantidade_maxima).toBe(0)
  })
  it('valorização soma saldo × custo médio', async () => {
    const r = await auth(request(app).get('/api/almoxarifado/valorizacao'))
    expect(r.body.data.total).toBe(45) // 15 × 3
    expect(r.body.data.por_categoria[0].categoria).toBe('EPI')
  })
})

describe('isolamento por tenant', () => {
  it('tenant B não movimenta item de A (404)', async () => {
    const r = await request(app).post(`/api/almoxarifado/${itemId}/movimentar`).set('Authorization', `Bearer ${tokenB}`).send({ tipo: 'Entrada', quantidade: 1 })
    expect(r.status).toBe(404)
  })
  it('tenant B tem valorização zerada', async () => {
    const r = await request(app).get('/api/almoxarifado/valorizacao').set('Authorization', `Bearer ${tokenB}`)
    expect(r.body.data.total).toBe(0)
  })
})

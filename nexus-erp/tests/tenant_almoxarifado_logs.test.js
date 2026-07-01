// ============================================================
// Testes — Isolamento por tenant do Almoxarifado (itens + recursos
// doc-model: materiais/movimentos/empréstimos/inventários) e da trilha
// de logs. Fecha o último vazamento de dados operacionais no Express.
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
let request, app, tokenA, tokenB
const A = {}

beforeAll(async () => {
  const st = await import('supertest')
  request = st.default
  ;({ app } = await import('../server.js'))
  tokenA = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token // empresa 1 (mestre)
  const m = r => r.set('Authorization', `Bearer ${tokenA}`)
  const empB = (await m(request(app).post('/api/empresas')).send({ razao_social: 'Tenant B' })).body.data.id
  await m(request(app).post('/api/usuarios')).send({ nome: 'Admin B', email: 'almb@x.com', senha: 'Aa@123456', perfil: 'admin', empresa_id: empB })
  tokenB = (await request(app).post('/api/auth/login').send({ email: 'almb@x.com', senha: 'Aa@123456' })).body?.data?.token

  A.item = (await m(request(app).post('/api/almoxarifado')).send({ descricao: 'Parafuso A', quantidade_atual: 100 })).body.data.id
  A.material = (await m(request(app).post('/api/materiais')).send({ nome: 'Cimento A', qtd: 50 })).body.data.id
  // Ação logada exclusiva de A (criação de fornecedor "Marca A do tenant A").
  await m(request(app).post('/api/fornecedores')).send({ nome: 'Marca A tenant A' })
})

const asA = r => r.set('Authorization', `Bearer ${tokenA}`)
const asB = r => r.set('Authorization', `Bearer ${tokenB}`)

describe('Almoxarifado — itens', () => {
  it('lista de B não inclui o item de A; A vê o próprio', async () => {
    expect((await asB(request(app).get('/api/almoxarifado'))).body.data.some(i => i.id === A.item)).toBe(false)
    expect((await asA(request(app).get('/api/almoxarifado'))).body.data.some(i => i.id === A.item)).toBe(true)
  })
  it('B não edita nem movimenta o item de A → 404', async () => {
    expect((await asB(request(app).put(`/api/almoxarifado/${A.item}`)).send({ descricao: 'x' })).status).toBe(404)
    expect((await asB(request(app).post(`/api/almoxarifado/${A.item}/movimentar`)).send({ tipo: 'Saída', quantidade: 10 })).status).toBe(404)
  })
  it('dashboard de B zera o almoxarifado de A', async () => {
    expect((await asB(request(app).get('/api/dashboard'))).body.data.almoxarifado.total_itens).toBe(0)
  })
})

describe('Almoxarifado — recursos doc-model (materiais)', () => {
  it('lista de B não inclui o material de A', async () => {
    expect((await asB(request(app).get('/api/materiais'))).body.data.some(x => x.id === A.material)).toBe(false)
  })
  it('B não lê/edita/exclui o material de A → 404', async () => {
    expect((await asB(request(app).get(`/api/materiais/${A.material}`))).status).toBe(404)
    expect((await asB(request(app).put(`/api/materiais/${A.material}`)).send({ nome: 'x' })).status).toBe(404)
    expect((await asB(request(app).delete(`/api/materiais/${A.material}`))).status).toBe(404)
  })
  it('mesmo id em tenants diferentes não colide', async () => {
    const bMat = (await asB(request(app).post('/api/materiais')).send({ nome: 'Cimento B' })).body.data
    const lidoB = await asB(request(app).get(`/api/materiais/${bMat.id}`))
    expect(lidoB.body.data.nome).toBe('Cimento B')
  })
})

describe('Trilha de logs', () => {
  it('B não vê os logs de A na sua trilha', async () => {
    await asB(request(app).post('/api/fornecedores')).send({ nome: 'Marca B tenant B' })
    const logsB = (await asB(request(app).get('/api/logs'))).body.data
    expect(logsB.some(l => (l.descricao || '').includes('Marca A tenant A'))).toBe(false)
    expect(logsB.some(l => (l.descricao || '').includes('Marca B tenant B'))).toBe(true)
  })
  it('o tenant mestre (empresa 1) vê a trilha completa', async () => {
    const logsA = (await asA(request(app).get('/api/logs'))).body.data
    expect(logsA.some(l => (l.descricao || '').includes('Marca A tenant A'))).toBe(true)
  })
  it('verificação da cadeia de auditoria é restrita ao mestre (B → 403)', async () => {
    expect((await asB(request(app).get('/api/auditoria/verificar'))).status).toBe(403)
    expect((await asA(request(app).get('/api/auditoria/verificar'))).status).toBe(200)
  })
})

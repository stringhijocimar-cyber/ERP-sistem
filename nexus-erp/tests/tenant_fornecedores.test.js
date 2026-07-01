// ============================================================
// Testes — Isolamento de fornecedores por empresa (tenant).
// Dados sensíveis (bancários, CNPJ, crédito) NÃO podem vazar nem ser
// modificados entre tenants: listagem, leitura, edição e homologação
// são todas escopadas por req.user.empresa_id.
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
let request, app, tokenA, tokenB, fornA

beforeAll(async () => {
  const st = await import('supertest')
  request = st.default
  ;({ app } = await import('../server.js'))
  tokenA = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token // empresa 1 (mestre)
  const m = r => r.set('Authorization', `Bearer ${tokenA}`)
  const empB = (await m(request(app).post('/api/empresas')).send({ razao_social: 'Tenant B' })).body.data.id
  await m(request(app).post('/api/usuarios')).send({ nome: 'Admin B', email: 'ab@x.com', senha: 'Aa@123456', perfil: 'admin', empresa_id: empB })
  tokenB = (await request(app).post('/api/auth/login').send({ email: 'ab@x.com', senha: 'Aa@123456' })).body?.data?.token
  // Fornecedor com dados bancários criado pelo tenant A.
  fornA = (await m(request(app).post('/api/fornecedores')).send({
    nome: 'Aço A', cnpj: '11.222.333/0001-81', banco: '001', agencia: '1234', conta: '55555',
  })).body.data.id
})

const asA = r => r.set('Authorization', `Bearer ${tokenA}`)
const asB = r => r.set('Authorization', `Bearer ${tokenB}`)

describe('Isolamento de fornecedores', () => {
  it('a LISTA do tenant B não inclui o fornecedor do tenant A', async () => {
    const r = await asB(request(app).get('/api/fornecedores?ativo=todos'))
    expect(r.status).toBe(200)
    expect(r.body.data.some(f => f.id === fornA)).toBe(false)
  })

  it('o tenant A enxerga o próprio fornecedor', async () => {
    const r = await asA(request(app).get('/api/fornecedores?ativo=todos'))
    expect(r.body.data.some(f => f.id === fornA)).toBe(true)
  })

  it('GET direto do fornecedor de A pelo tenant B → 404', async () => {
    const r = await asB(request(app).get(`/api/fornecedores/${fornA}`))
    expect(r.status).toBe(404)
  })

  it('IDF do fornecedor de A pelo tenant B → 404', async () => {
    const r = await asB(request(app).get(`/api/fornecedores/${fornA}/idf`))
    expect(r.status).toBe(404)
  })

  it('tenant B NÃO consegue editar o fornecedor de A → 404', async () => {
    const r = await asB(request(app).put(`/api/fornecedores/${fornA}`)).send({ nome: 'Sequestrado' })
    expect(r.status).toBe(404)
    // continua íntegro para A
    const check = await asA(request(app).get(`/api/fornecedores/${fornA}`))
    expect(check.body.data.nome).toBe('Aço A')
  })

  it('tenant B NÃO consegue homologar o fornecedor de A → 404', async () => {
    const r = await asB(request(app).post(`/api/fornecedores/${fornA}/homologar/financeiro`)).send({})
    expect(r.status).toBe(404)
  })

  it('o MESMO CNPJ pode existir em tenants diferentes (dup só dentro do tenant)', async () => {
    const r = await asB(request(app).post('/api/fornecedores')).send({ nome: 'Aço B', cnpj: '11.222.333/0001-81' })
    expect(r.status).toBe(201)
    // e duplicar dentro do MESMO tenant continua bloqueado
    const dup = await asB(request(app).post('/api/fornecedores')).send({ nome: 'Aço B2', cnpj: '11.222.333/0001-81' })
    expect(dup.status).toBe(409)
  })

  it('relatório de duplicatas não mistura tenants', async () => {
    const r = await asB(request(app).get('/api/duplicatas'))
    // B só tem 1 ocorrência desse CNPJ → não aparece como duplicata
    expect(r.body.data.fornecedores.some(g => g.cnpj === '11222333000181')).toBe(false)
  })
})

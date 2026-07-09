// ============================================================
// Testes — G4: onboarding self-service do fornecedor (convite por token).
// Comprador convida → fornecedor valida o token (público) → aceita, cria o
// próprio acesso e já entra logado. Token seguro, uso único, expiração,
// isolamento por tenant.
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
let request, app, db, token, fExistente

beforeAll(async () => {
  const st = await import('supertest')
  request = st.default
  ;({ app, db } = await import('../server.js'))
  token = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token
  const m = r => r.set('Authorization', `Bearer ${token}`)
  fExistente = (await m(request(app).post('/api/fornecedores')).send({ nome: 'Aços Existente', status: 'Homologado' })).body.data.id
})
const auth = r => r.set('Authorization', `Bearer ${token}`)

describe('criar convite', () => {
  it('e-mail inválido → 400; sem fornecedor nem nome → 400', async () => {
    expect((await auth(request(app).post('/api/fornecedor-convites')).send({ email: 'x' })).status).toBe(400)
    expect((await auth(request(app).post('/api/fornecedor-convites')).send({ email: 'a@b.com' })).status).toBe(400)
  })
  it('convite para fornecedor NOVO gera token e link', async () => {
    const r = await auth(request(app).post('/api/fornecedor-convites')).send({ email: 'novo@aco.com', nome: 'Aço Novo', cnpj: '11.222.333/0001-44' })
    expect(r.status).toBe(201)
    expect(r.body.data.token).toHaveLength(48) // 24 bytes hex
    expect(r.body.data.link).toContain(r.body.data.token)
  })
})

describe('fluxo público de aceite (fornecedor NOVO)', () => {
  let tk
  beforeAll(async () => {
    tk = (await auth(request(app).post('/api/fornecedor-convites')).send({ email: 'joao@aconovo.com', nome: 'Aço Novo Ltda' })).body.data.token
  })
  it('GET público valida o token e mostra os dados (sem auth)', async () => {
    const r = await request(app).get(`/api/convites/${tk}`)
    expect(r.status).toBe(200)
    expect(r.body.data.valido).toBe(true)
    expect(r.body.data.email).toBe('joao@aconovo.com')
    expect(r.body.data.fornecedor_nome).toBe('Aço Novo Ltda')
  })
  it('token inexistente → 404', async () => {
    expect((await request(app).get('/api/convites/naoexiste')).status).toBe(404)
  })
  it('aceitar exige senha forte', async () => {
    expect((await request(app).post(`/api/convites/${tk}/aceitar`).send({ nome: 'João', senha: 'fraca' })).status).toBe(400)
  })
  it('aceita: cria fornecedor + usuário e já devolve sessão (auto-login)', async () => {
    const r = await request(app).post(`/api/convites/${tk}/aceitar`).send({ nome: 'João da Silva', senha: 'Aa@123456' })
    expect(r.status).toBe(201)
    expect(r.body.data.token).toBeTruthy()
    expect(r.body.data.user.perfil).toBe('fornecedor')
    // fornecedor novo entrou 'Em Análise' (homologação normal)
    const f = db.prepare(`SELECT status FROM fornecedores WHERE email = 'joao@aconovo.com'`).get()
    expect(f.status).toBe('Em Análise')
    // o token de auto-login já acessa o portal
    const portal = await request(app).get('/api/portal/perfil').set('Authorization', `Bearer ${r.body.data.token}`)
    expect(portal.status).toBe(200)
  })
  it('token é de uso ÚNICO: segundo aceite → 409', async () => {
    const r = await request(app).post(`/api/convites/${tk}/aceitar`).send({ nome: 'Outro', senha: 'Bb@123456' })
    expect(r.status).toBe(409)
    // e o GET agora mostra situacao aceito / não-válido
    expect((await request(app).get(`/api/convites/${tk}`)).body.data.valido).toBe(false)
  })
})

describe('convite para fornecedor EXISTENTE + expiração + isolamento', () => {
  it('aceite vincula ao fornecedor existente (não cria outro)', async () => {
    const tk = (await auth(request(app).post('/api/fornecedor-convites')).send({ email: 'user@existente.com', fornecedor_id: fExistente })).body.data.token
    const r = await request(app).post(`/api/convites/${tk}/aceitar`).send({ nome: 'Maria', senha: 'Aa@123456' })
    expect(r.status).toBe(201)
    const u = db.prepare(`SELECT fornecedor_id FROM usuarios WHERE email = 'user@existente.com'`).get()
    expect(u.fornecedor_id).toBe(fExistente)
  })
  it('convite expirado → 409 no aceite e valido:false', async () => {
    const tk = (await auth(request(app).post('/api/fornecedor-convites')).send({ email: 'exp@aco.com', nome: 'Expira' })).body.data.token
    db.prepare(`UPDATE fornecedor_convites SET expira_em = '2000-01-01T00:00:00.000Z' WHERE token = ?`).run(tk)
    expect((await request(app).get(`/api/convites/${tk}`)).body.data.valido).toBe(false)
    expect((await request(app).post(`/api/convites/${tk}/aceitar`).send({ nome: 'X', senha: 'Aa@123456' })).status).toBe(409)
  })
  it('lista de convites é isolada por tenant', async () => {
    const empB = (await auth(request(app).post('/api/empresas')).send({ razao_social: 'Tenant B' })).body.data.id
    await auth(request(app).post('/api/usuarios')).send({ nome: 'AdmB', email: 'onb.b@x.com', senha: 'Aa@123456', perfil: 'admin', empresa_id: empB })
    const tokB = (await request(app).post('/api/auth/login').send({ email: 'onb.b@x.com', senha: 'Aa@123456' })).body?.data?.token
    const r = await request(app).get('/api/fornecedor-convites').set('Authorization', `Bearer ${tokB}`)
    expect(r.body.data).toHaveLength(0) // não vê os convites do tenant A
  })
})

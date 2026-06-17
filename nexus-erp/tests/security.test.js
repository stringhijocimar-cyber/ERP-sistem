// ============================================================
// Testes de segurança da API (Sprint 1) — Express backend
// Cobre: auth bcrypt, ausência de senhas hardcoded, autorização
// por perfil e rate limiting no login.
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'

// Ambiente isolado ANTES de importar o servidor (migrations rodam no import).
process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }

let request, app, adminToken, opToken

beforeAll(async () => {
  const st = await import('supertest')
  request = st.default
  ;({ app } = await import('../server.js'))

  // Login admin para preparar dados.
  const r = await request(app).post('/api/auth/login').send(ADMIN)
  adminToken = r.body?.data?.token

  // Cria um usuário de perfil "operacao" (apenas admin pode).
  await request(app)
    .post('/api/usuarios')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ nome: 'Op Teste', email: 'op.teste@fraseralexander.com.br', senha: 'Operacao@123', perfil: 'operacao' })

  const ro = await request(app)
    .post('/api/auth/login')
    .send({ email: 'op.teste@fraseralexander.com.br', senha: 'Operacao@123' })
  opToken = ro.body?.data?.token
})

describe('Autenticação', () => {
  it('rejeita senha inválida com 401', async () => {
    const r = await request(app).post('/api/auth/login').send({ email: ADMIN.email, senha: 'errada' })
    expect(r.status).toBe(401)
  })

  it('rejeita senhas hardcoded antigas (admin/123456) com 401', async () => {
    const r1 = await request(app).post('/api/auth/login').send({ email: ADMIN.email, senha: 'admin' })
    const r2 = await request(app).post('/api/auth/login').send({ email: ADMIN.email, senha: '123456' })
    expect(r1.status).toBe(401)
    expect(r2.status).toBe(401)
  })

  it('aceita a senha correta (hash bcrypt) e retorna token', async () => {
    const r = await request(app).post('/api/auth/login').send(ADMIN)
    expect(r.status).toBe(200)
    expect(r.body?.data?.token).toBeTruthy()
  })

  it('bloqueia rota protegida sem token (401)', async () => {
    const r = await request(app).get('/api/dashboard')
    expect(r.status).toBe(401)
  })
})

describe('Autorização por perfil', () => {
  it('admin consegue listar usuários', async () => {
    const r = await request(app).get('/api/usuarios').set('Authorization', `Bearer ${adminToken}`)
    expect(r.status).toBe(200)
  })

  it('operacao NÃO pode criar usuário (403)', async () => {
    const r = await request(app)
      .post('/api/usuarios')
      .set('Authorization', `Bearer ${opToken}`)
      .send({ nome: 'X', email: 'x@y.com', perfil: 'admin' })
    expect(r.status).toBe(403)
  })

  it('operacao NÃO pode aprovar fluxo (403)', async () => {
    const r = await request(app)
      .post('/api/fluxo/1/aprovar')
      .set('Authorization', `Bearer ${opToken}`)
      .send({ comentario: 'ok' })
    expect(r.status).toBe(403)
  })

  it('operacao NÃO pode atualizar conta a pagar (403)', async () => {
    const r = await request(app)
      .put('/api/contas-pagar/1')
      .set('Authorization', `Bearer ${opToken}`)
      .send({ status: 'Pago' })
    expect(r.status).toBe(403)
  })
})

describe('Rate limiting no login', () => {
  it('retorna 429 após exceder o limite de tentativas', async () => {
    let saw429 = false
    for (let i = 0; i < 40; i++) {
      const r = await request(app).post('/api/auth/login').send({ email: ADMIN.email, senha: 'errada' })
      if (r.status === 429) { saw429 = true; break }
    }
    expect(saw429).toBe(true)
  })
})

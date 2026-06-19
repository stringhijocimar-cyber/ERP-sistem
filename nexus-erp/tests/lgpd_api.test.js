// Testes de integração — LGPD anonimização de fornecedor (Express)
import { beforeAll, describe, expect, it } from 'vitest'

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
let request, app, token, opToken, fid

beforeAll(async () => {
  const st = await import('supertest')
  request = st.default
  ;({ app } = await import('../server.js'))
  token = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token

  fid = (await request(app).post('/api/fornecedores').set('Authorization', `Bearer ${token}`).send({
    nome: 'Forn LGPD', contato_nome: 'João da Silva', email: 'joao@forn.com', telefone: '(11) 98888-7777',
  })).body.data.id

  await request(app).post('/api/usuarios').set('Authorization', `Bearer ${token}`)
    .send({ nome: 'Op', email: 'op.lgpd@fraseralexander.com.br', senha: 'Operacao@123', perfil: 'operacao' })
  opToken = (await request(app).post('/api/auth/login').send({ email: 'op.lgpd@fraseralexander.com.br', senha: 'Operacao@123' })).body?.data?.token
})

describe('POST /api/lgpd/anonimizar/fornecedores/:id', () => {
  it('anonimiza os dados pessoais do fornecedor (admin)', async () => {
    const r = await request(app).post(`/api/lgpd/anonimizar/fornecedores/${fid}`).set('Authorization', `Bearer ${token}`)
    expect(r.status).toBe(200)
    const f = r.body.data
    expect(f.email).toBe('j•••@forn.com')
    expect(f.telefone).toBe('(11) •••••-••••')
    expect(f.contato).toMatch(/^J\. /)        // iniciais
    // Confirma persistência
    const g = await request(app).get(`/api/fornecedores/${fid}`).set('Authorization', `Bearer ${token}`)
    expect(g.body.data.email).toBe('j•••@forn.com')
  })

  it('nega anonimização a não-admin (403)', async () => {
    const r = await request(app).post(`/api/lgpd/anonimizar/fornecedores/${fid}`).set('Authorization', `Bearer ${opToken}`)
    expect(r.status).toBe(403)
  })

  it('404 para fornecedor inexistente', async () => {
    const r = await request(app).post('/api/lgpd/anonimizar/fornecedores/999999').set('Authorization', `Bearer ${token}`)
    expect(r.status).toBe(404)
  })
})

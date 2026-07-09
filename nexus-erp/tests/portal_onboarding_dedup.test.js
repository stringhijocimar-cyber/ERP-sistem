// ============================================================
// Varredura #8 (onboarding) — dedup de CNPJ no aceite.
// Bug: aceitar um convite "novo" cujo CNPJ JÁ existe no tenant criava um
// fornecedor DUPLICADO, furando a dedup do cadastro normal. Fix: reaproveita
// o fornecedor existente. (Demais vetores — takeover, senha, colisão de
// e-mail cross-tenant — confirmados sólidos nas sondas.)
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
let request, app, db, token

beforeAll(async () => {
  const st = await import('supertest')
  request = st.default
  ;({ app, db } = await import('../server.js'))
  token = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token
})
const auth = r => r.set('Authorization', `Bearer ${token}`)

describe('aceite não duplica fornecedor por CNPJ', () => {
  it('convite "novo" com CNPJ já existente REAPROVEITA o fornecedor', async () => {
    const cnpj = '11.222.333/0001-44'
    const existente = (await auth(request(app).post('/api/fornecedores')).send({ nome: 'Aços Existe', cnpj, status: 'Homologado' })).body.data.id
    const tk = (await auth(request(app).post('/api/fornecedor-convites')).send({ email: 'dup@f.com', nome: 'Aços Duplicado', cnpj })).body.data.token
    const r = await request(app).post(`/api/convites/${tk}/aceitar`).send({ nome: 'Novo User', senha: 'Aa@123456' })
    expect(r.status).toBe(201)
    // NÃO criou outro fornecedor com o mesmo CNPJ
    const n = db.prepare(`SELECT COUNT(*) n FROM fornecedores WHERE cnpj = ?`).get(cnpj).n
    expect(n).toBe(1)
    // o usuário do portal foi vinculado ao fornecedor QUE JÁ EXISTIA
    const u = db.prepare(`SELECT fornecedor_id FROM usuarios WHERE email = 'dup@f.com'`).get()
    expect(u.fornecedor_id).toBe(existente)
  })
  it('convite "novo" com CNPJ inédito cria o fornecedor normalmente', async () => {
    const tk = (await auth(request(app).post('/api/fornecedor-convites')).send({ email: 'inedito@f.com', nome: 'Aço Inédito', cnpj: '99.888.777/0001-66' })).body.data.token
    const r = await request(app).post(`/api/convites/${tk}/aceitar`).send({ nome: 'U', senha: 'Aa@123456' })
    expect(r.status).toBe(201)
    const f = db.prepare(`SELECT status FROM fornecedores WHERE cnpj = '99.888.777/0001-66'`).get()
    expect(f.status).toBe('Em Análise')
  })
})

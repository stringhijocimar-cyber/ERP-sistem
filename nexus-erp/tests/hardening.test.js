// ============================================================
// Testes — Hardening de segurança (nível SAP):
//  1. Headers de segurança em toda resposta.
//  2. Política de senha forte na criação/troca de usuários.
//  3. Sessão expirada NÃO autentica (e é removida).
//  4. Paridade Express ⇄ Worker da política de senha.
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'
import { validarSenhaForte as workerSenha } from '../../nexus-cf/src/index.js'

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

describe('Headers de segurança', () => {
  it('respostas da API carregam os headers de hardening', async () => {
    const r = await auth(request(app).get('/api/auth/me'))
    expect(r.headers['x-content-type-options']).toBe('nosniff')
    expect(r.headers['x-frame-options']).toBe('DENY')
    expect(r.headers['referrer-policy']).toBe('no-referrer')
    expect(r.headers['permissions-policy']).toContain('camera=()')
  })
})

describe('Política de senha forte', () => {
  const criar = senha => auth(request(app).post('/api/usuarios')).send({ nome: 'X', email: `x${Math.random().toString(36).slice(2)}@t.com`, senha, perfil: 'operacao' })

  it('rejeita senha curta, sem maiúscula, sem minúscula e sem número (400)', async () => {
    for (const s of ['Aa1', 'somenteminuscula1', 'SOMENTEMAIUSCULA1', 'SemNumeroAqui']) {
      const r = await criar(s)
      expect(r.status).toBe(400)
      expect(r.body.error).toMatch(/senha/i)
    }
  })

  it('aceita senha forte (201)', async () => {
    const r = await criar('SenhaForte123')
    expect(r.status).toBe(201)
  })

  it('troca de senha também respeita a política (400)', async () => {
    const u = (await criar('SenhaForte123')).body.data
    const r = await auth(request(app).put(`/api/usuarios/${u.id}`)).send({ nome: 'X', email: u.email, perfil: 'operacao', senha: 'fraca' })
    expect(r.status).toBe(400)
  })
})

describe('Expiração de sessão', () => {
  it('token com sessão expirada NÃO autentica (401) e a sessão é removida', async () => {
    const admin = db.prepare(`SELECT id FROM usuarios WHERE email = ?`).get(ADMIN.email)
    const velho = 'tok-expirado-teste'
    db.prepare(`INSERT INTO sessoes(token, usuario_id, expira_em, ip) VALUES(?,?,?,?)`)
      .run(velho, admin.id, new Date(Date.now() - 60_000).toISOString(), '127.0.0.1')
    const r = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${velho}`)
    expect(r.status).toBe(401)
    expect(db.prepare(`SELECT COUNT(*) n FROM sessoes WHERE token = ?`).get(velho).n).toBe(0)
  })

  it('token com sessão válida continua autenticando (controle)', async () => {
    const r = await auth(request(app).get('/api/auth/me'))
    expect(r.status).toBe(200)
  })
})

describe('Paridade Express ⇄ Worker — validarSenhaForte', () => {
  it('mesmos vereditos nos dois backends', () => {
    for (const s of ['Aa1', 'SenhaForte123', 'semmaiuscula1', 'SEMMINUSCULA1', 'SemNumero', '']) {
      expect(workerSenha(s).ok).toBe(s === 'SenhaForte123')
    }
  })
})

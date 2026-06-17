// ============================================================
// Testes de integração — Trilha de auditoria imutável (Express)
// Verifica encadeamento de hash e detecção de adulteração.
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
let request, app, db, token, opToken

beforeAll(async () => {
  const st = await import('supertest')
  request = st.default
  ;({ app, db } = await import('../server.js'))
  token = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token

  // Gera entradas na trilha (cada cadastro chama log()).
  for (const n of ['Forn A', 'Forn B', 'Forn C']) {
    await request(app).post('/api/fornecedores').set('Authorization', `Bearer ${token}`).send({ nome: n })
  }

  // Usuário não-admin para o teste de autorização.
  await request(app).post('/api/usuarios').set('Authorization', `Bearer ${token}`)
    .send({ nome: 'Op', email: 'op.aud@fraseralexander.com.br', senha: 'Operacao@123', perfil: 'operacao' })
  opToken = (await request(app).post('/api/auth/login')
    .send({ email: 'op.aud@fraseralexander.com.br', senha: 'Operacao@123' })).body?.data?.token
})

const verificar = (tok) =>
  request(app).get('/api/auditoria/verificar').set('Authorization', `Bearer ${tok}`)

describe('GET /api/auditoria/verificar', () => {
  it('a trilha recém-gravada está íntegra', async () => {
    const r = await verificar(token)
    expect(r.status).toBe(200)
    expect(r.body.data.integra).toBe(true)
    expect(r.body.data.total).toBeGreaterThanOrEqual(3)
  })

  it('nega acesso a quem não é admin (403)', async () => {
    const r = await verificar(opToken)
    expect(r.status).toBe(403)
  })

  it('adulterar uma linha diretamente no banco quebra a verificação', async () => {
    // Simula um atacante que edita o conteúdo sem recalcular o hash.
    const mid = db.prepare(`SELECT id FROM logs_sistema ORDER BY id ASC LIMIT 1 OFFSET 1`).get()
    db.prepare(`UPDATE logs_sistema SET descricao = 'ADULTERADO' WHERE id = ?`).run(mid.id)
    const r = await verificar(token)
    expect(r.body.data.integra).toBe(false)
    expect(r.body.data.motivo).toMatch(/adulterado/i)
    expect(r.body.data.quebraEm).toBe(mid.id)
  })
})

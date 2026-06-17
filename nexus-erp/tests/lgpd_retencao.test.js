// Testes de integração — Retenção LGPD (preview + execução) no Express
import { beforeAll, describe, expect, it } from 'vitest'

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
let request, app, db, token, idVelho, idNovo

beforeAll(async () => {
  const st = await import('supertest')
  request = st.default
  ;({ app, db } = await import('../server.js'))
  token = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token

  const mk = (nome) => request(app).post('/api/fornecedores').set('Authorization', `Bearer ${token}`)
    .send({ nome, contato_nome: 'João Silva', email: 'joao@x.com', telefone: '(11) 98888-7777' })
  idVelho = (await mk('Velho Inativo')).body.data.id
  idNovo = (await mk('Novo Ativo')).body.data.id

  // Backdata o "velho" e o torna inativo (candidato a retenção).
  db.prepare(`UPDATE fornecedores SET created_at='2018-01-01', ativo=0 WHERE id=?`).run(idVelho)
})

const auth = r => r.set('Authorization', `Bearer ${token}`)

describe('LGPD retenção de fornecedores', () => {
  it('preview lista só os vencidos e inativos', async () => {
    const r = await auth(request(app).get('/api/lgpd/retencao/fornecedores'))
    expect(r.status).toBe(200)
    const ids = r.body.data.fornecedores.map(f => f.id)
    expect(ids).toContain(idVelho)
    expect(ids).not.toContain(idNovo) // recente e ativo
  })

  it('execução anonimiza os vencidos e some do preview', async () => {
    const ex = await auth(request(app).post('/api/lgpd/retencao/fornecedores/executar'))
    expect(ex.status).toBe(200)
    expect(ex.body.data.anonimizados).toBeGreaterThanOrEqual(1)

    const f = await auth(request(app).get(`/api/fornecedores/${idVelho}`))
    expect(f.body.data.email).toBe('j•••@x.com')
    expect(f.body.data.anonimizado).toBe(1)

    const prev = await auth(request(app).get('/api/lgpd/retencao/fornecedores'))
    expect(prev.body.data.fornecedores.map(x => x.id)).not.toContain(idVelho)
  })

  it('exige admin (403 para operação)', async () => {
    await request(app).post('/api/usuarios').set('Authorization', `Bearer ${token}`)
      .send({ nome: 'Op', email: 'op.ret@fraseralexander.com.br', senha: 'Operacao@123', perfil: 'operacao' })
    const op = (await request(app).post('/api/auth/login').send({ email: 'op.ret@fraseralexander.com.br', senha: 'Operacao@123' })).body?.data?.token
    const r = await request(app).get('/api/lgpd/retencao/fornecedores').set('Authorization', `Bearer ${op}`)
    expect(r.status).toBe(403)
  })
})

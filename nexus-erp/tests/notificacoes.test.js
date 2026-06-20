// ============================================================
// Testes — Notificações (in-app + e-mail adapter) e escopo por usuário/perfil
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'
import { enviarEmail } from '../lib/email.js'

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
let request, app, adminToken, finToken, compToken

beforeAll(async () => {
  const st = await import('supertest')
  request = st.default
  ;({ app } = await import('../server.js'))
  adminToken = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token
  const mk = (nome, email, perfil) => request(app).post('/api/usuarios').set('Authorization', `Bearer ${adminToken}`).send({ nome, email, senha: 'Aa@123456', perfil })
  await mk('Fin N', 'fin.n@x.com', 'financeiro')
  await mk('Comp N', 'comp.n@x.com', 'compliance')
  finToken = (await request(app).post('/api/auth/login').send({ email: 'fin.n@x.com', senha: 'Aa@123456' })).body?.data?.token
  compToken = (await request(app).post('/api/auth/login').send({ email: 'comp.n@x.com', senha: 'Aa@123456' })).body?.data?.token
})

const lista = tok => request(app).get('/api/notificacoes').set('Authorization', `Bearer ${tok}`)
const contagem = tok => request(app).get('/api/notificacoes/contagem').set('Authorization', `Bearer ${tok}`)

describe('Adaptador de e-mail (mock)', () => {
  it('simula envio para destinatário válido', async () => {
    const r = await enviarEmail({ to: 'a@b.com', assunto: 'Oi', corpo: 'corpo' })
    expect(r.status).toBe('simulado')
  })
  it('erro para destinatário inválido / sem assunto', async () => {
    expect((await enviarEmail({ to: 'xyz', assunto: 'a' })).status).toBe('erro')
    expect((await enviarEmail({ to: 'a@b.com' })).status).toBe('erro')
  })
})

describe('Notificações — eventos reais e escopo', () => {
  it('criar fornecedor notifica Financeiro e Compliance', async () => {
    await request(app).post('/api/fornecedores').set('Authorization', `Bearer ${adminToken}`).send({ nome: 'Forn Notif' })
    const fin = (await lista(finToken)).body.data
    const comp = (await lista(compToken)).body.data
    expect(fin.some(n => n.tipo === 'homologacao' && /homologar/i.test(n.titulo))).toBe(true)
    expect(comp.some(n => n.tipo === 'homologacao')).toBe(true)
  })

  it('um perfil não vê notificação destinada a outro', async () => {
    // cria notificação só para compliance
    await request(app).post('/api/notificacoes').set('Authorization', `Bearer ${adminToken}`)
      .send({ perfil: 'compliance', titulo: 'Só compliance', mensagem: 'x' })
    const fin = (await lista(finToken)).body.data
    expect(fin.some(n => n.titulo === 'Só compliance')).toBe(false)
    const comp = (await lista(compToken)).body.data
    expect(comp.some(n => n.titulo === 'Só compliance')).toBe(true)
  })

  it('contagem de não-lidas e marcar como lida', async () => {
    const antes = (await contagem(compToken)).body.data.nao_lidas
    expect(antes).toBeGreaterThan(0)
    const nots = (await lista(compToken)).body.data
    const alvo = nots.find(n => n.lida === 0)
    const r = await request(app).post(`/api/notificacoes/${alvo.id}/lida`).set('Authorization', `Bearer ${compToken}`).send({})
    expect(r.status).toBe(200)
    const depois = (await contagem(compToken)).body.data.nao_lidas
    expect(depois).toBe(antes - 1)
  })

  it('ler-todas zera a contagem do usuário', async () => {
    await request(app).post('/api/notificacoes/ler-todas').set('Authorization', `Bearer ${finToken}`).send({})
    expect((await contagem(finToken)).body.data.nao_lidas).toBe(0)
  })

  it('marcar lida fora do escopo retorna 404', async () => {
    // notificação só de compliance; financeiro tenta marcar
    await request(app).post('/api/notificacoes').set('Authorization', `Bearer ${adminToken}`).send({ perfil: 'compliance', titulo: 'Privada comp', mensagem: 'x' })
    const id = (await lista(compToken)).body.data.find(n => n.titulo === 'Privada comp').id
    const r = await request(app).post(`/api/notificacoes/${id}/lida`).set('Authorization', `Bearer ${finToken}`).send({})
    expect(r.status).toBe(404)
  })
})

// ============================================================
// Testes — Notificação proativa de anomalias na emissão do pedido.
// Anomalia de severidade ALTA (ex.: fracionamento de alçada) notifica o
// Financeiro (com e-mail) e o Compliance DO TENANT, no momento do evento.
// Também cobre o isolamento de notificações por empresa (antes, uma
// notificação por perfil vazava para o mesmo perfil de OUTRO tenant).
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
let request, app, db, token, finToken, finBToken

beforeAll(async () => {
  const st = await import('supertest')
  request = st.default
  ;({ app, db } = await import('../server.js'))
  token = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token
  const m = r => r.set('Authorization', `Bearer ${token}`)

  // Financeiro + Compliance no tenant A (mestre).
  await m(request(app).post('/api/usuarios')).send({ nome: 'Fin A', email: 'fin.notif@x.com', senha: 'Aa@123456', perfil: 'financeiro' })
  await m(request(app).post('/api/usuarios')).send({ nome: 'Comp A', email: 'comp.notif@x.com', senha: 'Aa@123456', perfil: 'compliance' })
  finToken = (await request(app).post('/api/auth/login').send({ email: 'fin.notif@x.com', senha: 'Aa@123456' })).body.data.token
  const compToken = (await request(app).post('/api/auth/login').send({ email: 'comp.notif@x.com', senha: 'Aa@123456' })).body.data.token

  // Financeiro do tenant B — não pode ver notificações do A.
  const empB = (await m(request(app).post('/api/empresas')).send({ razao_social: 'Tenant B' })).body.data.id
  await m(request(app).post('/api/usuarios')).send({ nome: 'Fin B', email: 'fin.b.notif@x.com', senha: 'Aa@123456', perfil: 'financeiro', empresa_id: empB })
  finBToken = (await request(app).post('/api/auth/login').send({ email: 'fin.b.notif@x.com', senha: 'Aa@123456' })).body.data.token

  // Fornecedor homologado + fracionamento: 2 PCs de R$30k na mesma janela.
  const fid = (await m(request(app).post('/api/fornecedores')).send({ nome: 'Notifica Ltda' })).body.data.id
  await request(app).post(`/api/fornecedores/${fid}/homologar/financeiro`).set('Authorization', `Bearer ${finToken}`).send({})
  await request(app).post(`/api/fornecedores/${fid}/homologar/compliance`).set('Authorization', `Bearer ${compToken}`).send({})
  await m(request(app).post('/api/pedidos')).send({ fornecedor_id: fid, valor_total: 30000 })
  await m(request(app).post('/api/pedidos')).send({ fornecedor_id: fid, valor_total: 30000 })
})

describe('Anomalia ALTA na emissão do pedido → notificação proativa', () => {
  it('o Financeiro do tenant recebe a notificação de anomalia', async () => {
    const r = await request(app).get('/api/notificacoes').set('Authorization', `Bearer ${finToken}`)
    const anomalia = r.body.data.find(n => n.tipo === 'anomalia')
    expect(anomalia).toBeTruthy()
    expect(anomalia.titulo).toMatch(/fracionamento/i)
    expect(anomalia.mensagem).toMatch(/Notifica Ltda/)
  })

  it('a detecção fica registrada na trilha de auditoria', () => {
    const n = db.prepare(`SELECT COUNT(*) n FROM logs_sistema WHERE acao = 'anomalia_detectada'`).get().n
    expect(n).toBeGreaterThanOrEqual(1)
  })

  it('pedido normal (primeiro, valor baixo) NÃO gera notificação de anomalia', () => {
    // Só os pedidos fracionados geraram anomalia; nada de falso positivo em massa.
    const total = db.prepare(`SELECT COUNT(*) n FROM notificacoes WHERE tipo = 'anomalia' AND perfil = 'financeiro'`).get().n
    expect(total).toBe(1) // 1 fracionamento (dedupe natural: só o 2º pedido dispara)
  })
})

describe('Isolamento de notificações por tenant', () => {
  it('o Financeiro do tenant B NÃO vê a notificação do tenant A', async () => {
    const r = await request(app).get('/api/notificacoes').set('Authorization', `Bearer ${finBToken}`)
    expect(r.status).toBe(200)
    expect(r.body.data.some(n => n.tipo === 'anomalia')).toBe(false)
  })

  it('contagem de não-lidas do tenant B ignora as do A', async () => {
    const r = await request(app).get('/api/notificacoes/contagem').set('Authorization', `Bearer ${finBToken}`)
    expect(r.body.data.nao_lidas).toBe(0)
  })
})

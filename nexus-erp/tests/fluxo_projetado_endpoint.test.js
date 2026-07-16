// ============================================================
// Testes — /api/fluxo-caixa-projetado: entradas (AR) × saídas (AP) por semana,
// saldo acumulado, saldo inicial, isolamento por tenant, gate de perfil.
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
let request, app, db, token, tokenB

beforeAll(async () => {
  const st = await import('supertest')
  request = st.default
  ;({ app, db } = await import('../server.js'))
  token = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token
  const m = r => r.set('Authorization', `Bearer ${token}`)
  const empB = (await m(request(app).post('/api/empresas')).send({ razao_social: 'Tenant B' })).body.data.id
  await m(request(app).post('/api/usuarios')).send({ nome: 'Admin B', email: 'fp.b@x.com', senha: 'Aa@123456', perfil: 'admin', empresa_id: empB })
  tokenB = (await request(app).post('/api/auth/login').send({ email: 'fp.b@x.com', senha: 'Aa@123456' })).body?.data?.token

  // Datas relativas a hoje para cair na janela padrão de 8 semanas.
  const hoje = new Date()
  const d = n => new Date(hoje.getTime() + n * 864e5).toISOString().slice(0, 10)
  db.prepare(`INSERT INTO contas_receber(numero, cliente, valor, data_vencimento, status, empresa_id) VALUES('CR-P','X',10000,?,'A Receber',1)`).run(d(3))
  db.prepare(`INSERT INTO contas_pagar(numero, valor, data_vencimento, status, empresa_id) VALUES('CP-P',4000,?,'Pendente',1)`).run(d(10))
  // Já liquidadas — não entram na projeção.
  db.prepare(`INSERT INTO contas_receber(numero, cliente, valor, data_vencimento, status, empresa_id) VALUES('CR-R','Y',777,?,'Recebida',1)`).run(d(5))
})

const auth = r => r.set('Authorization', `Bearer ${token}`)

describe('/api/fluxo-caixa-projetado', () => {
  it('projeta entradas (AR) e saídas (AP) em aberto com saldo inicial', async () => {
    const r = await auth(request(app).get('/api/fluxo-caixa-projetado?semanas=8&saldo_inicial=1000'))
    expect(r.status).toBe(200)
    expect(r.body.data.saldo_inicial).toBe(1000)
    expect(r.body.data.resumo.entradas_total).toBe(10000)
    expect(r.body.data.resumo.saidas_total).toBe(4000)
    expect(r.body.data.resumo.saldo_final).toBe(7000) // 1000 + 10000 - 4000
  })
  it('sem saldo inicial parte de zero', async () => {
    const r = await auth(request(app).get('/api/fluxo-caixa-projetado'))
    expect(r.body.data.saldo_inicial).toBe(0)
    expect(r.body.data.resumo.saldo_final).toBe(6000)
  })
})

describe('isolamento e autenticação', () => {
  it('tenant B tem projeção zerada', async () => {
    const r = await request(app).get('/api/fluxo-caixa-projetado').set('Authorization', `Bearer ${tokenB}`)
    expect(r.body.data.resumo.entradas_total).toBe(0)
    expect(r.body.data.resumo.saidas_total).toBe(0)
  })
  it('sem token → 401', async () => {
    const r = await request(app).get('/api/fluxo-caixa-projetado')
    expect(r.status).toBe(401)
  })
})

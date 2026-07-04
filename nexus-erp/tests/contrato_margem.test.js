// ============================================================
// Testes — margem por contrato (P&L): Receita − Custo de pedidos −
// Custo de mão de obra. Casa por id numérico OU número; isola tenant.
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
let request, app, db, token, tokenB, ctId, ctNumero

beforeAll(async () => {
  const st = await import('supertest')
  request = st.default
  ;({ app, db } = await import('../server.js'))
  token = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token
  const m = r => r.set('Authorization', `Bearer ${token}`)
  const empB = (await m(request(app).post('/api/empresas')).send({ razao_social: 'Tenant B' })).body.data.id
  await m(request(app).post('/api/usuarios')).send({ nome: 'Admin B', email: 'marg.b@x.com', senha: 'Aa@123456', perfil: 'admin', empresa_id: empB })
  tokenB = (await request(app).post('/api/auth/login').send({ email: 'marg.b@x.com', senha: 'Aa@123456' })).body?.data?.token

  // Contrato do tenant A.
  const ct = (await m(request(app).post('/api/contratos')).send({ titulo: 'Manutenção Mina', valor_total: 1000000 })).body.data
  ctId = ct.id; ctNumero = ct.numero

  // Receita: AR faturada do contrato (referenciada pelo NÚMERO).
  db.prepare(`INSERT INTO contas_receber(numero, contrato_id, cliente, valor, status, empresa_id) VALUES('CR-M',?,'Cli',500000,'A Receber',1)`).run(ctNumero)
  // Custo de pedidos: AP do contrato (referenciada pelo NÚMERO).
  db.prepare(`INSERT INTO contas_pagar(numero, contrato_id, valor, status, empresa_id) VALUES('CP-M',?,120000,'Pendente',1)`).run(ctNumero)
  // Mão de obra: apontamentos (referenciados pelo ID numérico).
  const cid = db.prepare(`INSERT INTO colaboradores(nome, custo_hora, empresa_id) VALUES('Op',50,1)`).run().lastInsertRowid
  db.prepare(`INSERT INTO apontamentos_hora(colaborador_id, contrato_id, data, horas, custo_hora, custo, empresa_id) VALUES(?,?,?,?,?,?,1)`).run(cid, String(ctId), '2026-05-10', 100, 50, 5000)
})

const auth = r => r.set('Authorization', `Bearer ${token}`)

describe('/api/contratos/:id/margem', () => {
  let margem
  beforeAll(async () => { margem = (await auth(request(app).get(`/api/contratos/${ctId}/margem`))).body.data })

  it('receita = AR faturada do contrato', () => expect(margem.receita).toBe(500000))
  it('custo de pedidos = AP do contrato', () => expect(margem.custo_pedidos).toBe(120000))
  it('custo de mão de obra = apontamentos (casados pelo id numérico)', () => {
    expect(margem.custo_mao_obra).toBe(5000)
    expect(margem.horas_mao_obra).toBe(100)
  })
  it('resultado e margem', () => {
    expect(margem.custo_total).toBe(125000)      // 120k + 5k
    expect(margem.resultado).toBe(375000)        // 500k - 125k
    expect(margem.margem_pct).toBe(75)           // 375k/500k
  })
  it('inclui linhas do P&L', () => {
    expect(margem.linhas.find(l => l.tipo === 'total').valor).toBe(375000)
  })
})

describe('robustez e isolamento', () => {
  it('contrato inexistente → 404', async () => {
    const r = await auth(request(app).get('/api/contratos/99999/margem'))
    expect(r.status).toBe(404)
  })
  it('tenant B não acessa o contrato de A (404)', async () => {
    const r = await request(app).get(`/api/contratos/${ctId}/margem`).set('Authorization', `Bearer ${tokenB}`)
    expect(r.status).toBe(404)
  })
})

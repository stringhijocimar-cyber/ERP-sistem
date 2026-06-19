// ============================================================
// Testes de integração — Dashboard BI (KPIs gerenciais consolidados)
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
const d = off => new Date(Date.now() + off * 864e5).toISOString().slice(0, 10)
let request, app, db, adminToken

beforeAll(async () => {
  const st = await import('supertest')
  request = st.default
  ;({ app, db } = await import('../server.js'))
  adminToken = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token

  // Financeiro: vencida(100), a vencer 10d(200), paga(300).
  const cp = db.prepare(`INSERT INTO contas_pagar(numero, descricao, valor, data_vencimento, status) VALUES(?,?,?,?,?)`)
  cp.run('CP-V', 'Venc', 100, d(-2), 'Pendente')
  cp.run('CP-P', 'Prox', 200, d(10), 'Aprovado')
  cp.run('CP-Q', 'Quit', 300, d(-2), 'Pago')

  // Fornecedores: 2 ativos com status distintos + score.
  const f = db.prepare(`INSERT INTO fornecedores(nome, ativo, status, score_medio) VALUES(?,?,?,?)`)
  const f1 = f.run('Forn H', 1, 'Homologado', 8).lastInsertRowid
  f.run('Forn E', 1, 'Em Homologação', 6)

  // Pedidos: 1 entregue + 1 emitido (taxa de entrega 50%).
  const pc = db.prepare(`INSERT INTO pedidos_compra(numero, fornecedor_id, status, valor_total) VALUES(?,?,?,?)`)
  pc.run('PC-1', f1, 'Entregue', 1000)
  pc.run('PC-2', f1, 'Emitido', 500)

  // Governança do gate: 2 bloqueios + 1 liberação na trilha de logs.
  const lg = db.prepare(`INSERT INTO logs_sistema(usuario_id, usuario_nome, acao, modulo, descricao) VALUES(1,'t',?,?,?)`)
  lg.run('payment_blocked', 'contas_pagar', 'b1')
  lg.run('payment_blocked', 'contas_pagar', 'b2')
  lg.run('Pagar', 'contas_pagar', 'ok1')
})

const bi = (qs = '') => request(app).get('/api/bi' + qs).set('Authorization', `Bearer ${adminToken}`)

describe('Dashboard BI', () => {
  it('consolida exposição financeira (vencido/a vencer/pago)', async () => {
    const r = await bi('?dias=30')
    expect(r.status).toBe(200)
    const fin = r.body.data.financeiro
    expect(fin.vencido_valor).toBe(100)
    expect(fin.vencido_qtd).toBe(1)
    expect(fin.a_vencer_valor).toBe(200)
    expect(fin.pago_valor).toBe(300)
    expect(fin.a_pagar_valor).toBe(300) // Pendente(100)+Aprovado(200), exclui Pago
  })

  it('mede a governança do gate (taxa de bloqueio)', async () => {
    const g = (await bi()).body.data.gate
    expect(g.bloqueios).toBe(2)
    expect(g.liberados).toBe(1)
    expect(g.taxa_bloqueio).toBeCloseTo(2 / 3, 2)
  })

  it('resume homologação e score dos fornecedores', async () => {
    const f = (await bi()).body.data.fornecedores
    expect(f.ativos).toBe(2)
    expect(f.score_medio).toBe(7) // (8+6)/2
    const st = Object.fromEntries(f.por_status.map(s => [s.status, s.n]))
    expect(st['Homologado']).toBe(1)
    expect(st['Em Homologação']).toBe(1)
  })

  it('calcula taxa de entrega de pedidos', async () => {
    const c = (await bi()).body.data.compras
    expect(c.pc_total).toBe(2)
    expect(c.pc_entregues).toBe(1)
    expect(c.pc_entregues_pct).toBe(50)
    expect(c.pc_valor_ativo).toBe(1500)
  })

  it('inclui o resumo de alertas por severidade', async () => {
    const a = (await bi()).body.data.alertas
    expect(a.total).toBeGreaterThanOrEqual(1) // ao menos a conta vencida
    expect(a.alta).toBeGreaterThanOrEqual(1)
  })

  it('fornecedor (portal) é barrado no painel gerencial (403)', async () => {
    const fid = db.prepare(`INSERT INTO fornecedores(nome) VALUES('FP')`).run().lastInsertRowid
    await request(app).post('/api/usuarios').set('Authorization', `Bearer ${adminToken}`)
      .send({ nome: 'P', email: 'pbi@forn.com', senha: 'P@123456', perfil: 'fornecedor', fornecedor_id: fid })
    const tok = (await request(app).post('/api/auth/login').send({ email: 'pbi@forn.com', senha: 'P@123456' })).body?.data?.token
    const r = await request(app).get('/api/bi').set('Authorization', `Bearer ${tok}`)
    expect(r.status).toBe(403)
  })
})

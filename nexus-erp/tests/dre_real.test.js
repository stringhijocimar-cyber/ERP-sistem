// ============================================================
// Testes — DRE real derivada dos livros (contas a pagar + receber).
// Receita (AR faturada) − Custos (AP de pedidos) − Despesas (AP overhead);
// filtro por período; visão caixa; isolamento por tenant.
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
  await m(request(app).post('/api/usuarios')).send({ nome: 'Admin B', email: 'dre.b@x.com', senha: 'Aa@123456', perfil: 'admin', empresa_id: empB })
  tokenB = (await request(app).post('/api/auth/login').send({ email: 'dre.b@x.com', senha: 'Aa@123456' })).body?.data?.token

  // Tenant A (empresa 1): monta um cenário determinístico via SQL direto.
  // Receita: 2 contas a receber faturadas em 2026-05, uma recebida.
  db.prepare(`INSERT INTO contas_receber(numero, cliente, valor, data_emissao, status, empresa_id) VALUES('CR-1','X',300000,'2026-05-10','A Receber',1)`).run()
  db.prepare(`INSERT INTO contas_receber(numero, cliente, valor, data_emissao, data_recebimento, status, empresa_id) VALUES('CR-2','Y',200000,'2026-05-20','2026-05-25','Recebida',1)`).run()
  // Custo: conta a pagar com pc_id (de pedido) vencendo em 2026-05, uma paga.
  const fid = db.prepare(`INSERT INTO fornecedores(nome, status, empresa_id) VALUES('F DRE','Homologado',1)`).run().lastInsertRowid
  db.prepare(`INSERT INTO pedidos_compra(id, numero, status, valor_total, fornecedor_id, empresa_id) VALUES(77,'PC-DRE','Emitido',120000,?,1)`).run(fid)
  db.prepare(`INSERT INTO contas_pagar(numero, pc_id, valor, data_vencimento, data_pagamento, status, empresa_id) VALUES('CP-1',77,120000,'2026-05-15','2026-05-16','Pago',1)`).run()
  // Despesa overhead: conta a pagar SEM pc_id.
  db.prepare(`INSERT INTO contas_pagar(numero, valor, data_vencimento, status, empresa_id) VALUES('CP-2',50000,'2026-05-05','Pendente',1)`).run()
  // Ruído fora do período (2026-06) — não deve entrar no filtro de maio.
  db.prepare(`INSERT INTO contas_receber(numero, cliente, valor, data_emissao, status, empresa_id) VALUES('CR-9','Z',999,'2026-06-01','A Receber',1)`).run()
})

const auth = r => r.set('Authorization', `Bearer ${token}`)

describe('/api/dre — período 2026-05', () => {
  let dre
  beforeAll(async () => { dre = (await auth(request(app).get('/api/dre?ano=2026&mes=5'))).body.data })

  it('receita bruta = soma das AR faturadas no mês', () => {
    expect(dre.receita_bruta).toBe(500000) // 300k + 200k
    expect(dre.receita_qtd).toBe(2)
  })
  it('custos = AP de pedidos; despesas = AP overhead', () => {
    expect(dre.custos).toBe(120000)
    expect(dre.despesas).toBe(50000)
  })
  it('resultado bruto e operacional com margens', () => {
    expect(dre.resultado_bruto).toBe(380000)       // 500k - 120k
    expect(dre.resultado_operacional).toBe(330000) // 380k - 50k
    expect(dre.margem_liquida_pct).toBe(66)        // 330k/500k
  })
  it('visão caixa: recebido e pago no mês', () => {
    expect(dre.caixa.recebido).toBe(200000) // só a CR-2 foi recebida
    expect(dre.caixa.pago).toBe(120000)     // só a CP-1 foi paga
    expect(dre.caixa.saldo).toBe(80000)
  })
  it('não inclui o ruído de junho', () => {
    expect(dre.receita_bruta).not.toBe(500999)
  })
})

describe('/api/dre — sem filtro e isolamento', () => {
  it('sem período soma tudo do tenant (inclui junho)', async () => {
    const r = await auth(request(app).get('/api/dre'))
    expect(r.body.data.receita_bruta).toBe(500999)
  })
  it('tenant B tem DRE zerada (isolamento)', async () => {
    const r = await request(app).get('/api/dre?ano=2026&mes=5').set('Authorization', `Bearer ${tokenB}`)
    expect(r.body.data.receita_bruta).toBe(0)
    expect(r.body.data.resultado_operacional).toBe(0)
  })
})

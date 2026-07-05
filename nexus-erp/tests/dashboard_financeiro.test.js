// ============================================================
// Testes — /api/dashboard-financeiro (cockpit consolidado): DRE + projeção
// de caixa + posição AR/AP + ranking de contratos. Isolado por tenant.
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
let request, app, db, token, tokenB, ctNum

beforeAll(async () => {
  const st = await import('supertest')
  request = st.default
  ;({ app, db } = await import('../server.js'))
  token = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token
  const m = r => r.set('Authorization', `Bearer ${token}`)
  const empB = (await m(request(app).post('/api/empresas')).send({ razao_social: 'Tenant B' })).body.data.id
  await m(request(app).post('/api/usuarios')).send({ nome: 'Admin B', email: 'dash.b@x.com', senha: 'Aa@123456', perfil: 'admin', empresa_id: empB })
  tokenB = (await request(app).post('/api/auth/login').send({ email: 'dash.b@x.com', senha: 'Aa@123456' })).body?.data?.token

  const ano = new Date().getFullYear()
  const ct = (await m(request(app).post('/api/contratos')).send({ titulo: 'Contrato Dash', valor_total: 800000 })).body.data
  ctNum = ct.numero
  // Receita faturada no ano corrente + custo de pedidos.
  db.prepare(`INSERT INTO contas_receber(numero, contrato_id, cliente, valor, data_emissao, data_vencimento, status, empresa_id) VALUES('CR-D',?,'Cli',400000,?,?,'A Receber',1)`)
    .run(ctNum, `${ano}-03-10`, `${ano}-03-20`)
  // Custo de pedido: AP ligada a um pedido (pc_id) para contar como CUSTO na DRE.
  const fid = db.prepare(`INSERT INTO fornecedores(nome, status, empresa_id) VALUES('F Dash','Homologado',1)`).run().lastInsertRowid
  const pid = db.prepare(`INSERT INTO pedidos_compra(numero, status, valor_total, fornecedor_id, empresa_id) VALUES('PC-D','Emitido',100000,?,1)`).run(fid).lastInsertRowid
  db.prepare(`INSERT INTO contas_pagar(numero, contrato_id, pc_id, valor, data_vencimento, status, empresa_id) VALUES('CP-D',?,?,100000,?,'Pendente',1)`)
    .run(ctNum, pid, `${ano}-03-15`)
})

const auth = r => r.set('Authorization', `Bearer ${token}`)

describe('/api/dashboard-financeiro', () => {
  let d
  beforeAll(async () => { d = (await auth(request(app).get('/api/dashboard-financeiro'))).body.data })

  it('traz o bloco DRE consolidado', () => {
    expect(d.dre.receita).toBe(400000)
    expect(d.dre.custos).toBe(100000)
    expect(d.dre.resultado_operacional).toBe(300000)
  })
  it('traz a projeção de caixa com alerta de aperto', () => {
    expect(d.projecao).toHaveProperty('saldo_final')
    expect(d.projecao).toHaveProperty('aperto_previsto')
  })
  it('traz a posição AR/AP e capital de giro', () => {
    expect(d.posicao.a_receber).toBe(400000)
    expect(d.posicao.a_pagar).toBe(100000)
    expect(d.posicao.capital_giro).toBe(300000) // 400k - 100k
  })
  it('rankeia contratos por resultado', () => {
    expect(d.contratos.top[0].numero).toBe(ctNum)
    expect(d.contratos.top[0].resultado).toBe(300000)
  })
})

describe('isolamento e gate', () => {
  it('tenant B tem dashboard zerado', async () => {
    const r = await request(app).get('/api/dashboard-financeiro').set('Authorization', `Bearer ${tokenB}`)
    expect(r.body.data.dre.receita).toBe(0)
    expect(r.body.data.posicao.a_receber).toBe(0)
    expect(r.body.data.contratos.total_avaliados).toBe(0)
  })
  it('sem token → 401', async () => {
    const r = await request(app).get('/api/dashboard-financeiro')
    expect(r.status).toBe(401)
  })
})

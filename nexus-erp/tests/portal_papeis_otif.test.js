// ============================================================
// Testes — G2: papéis por usuário do fornecedor + tendência de OTIF.
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'
import { tendenciaOTIF } from '../lib/otif.js'

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'
process.env.ENFORCE_RECEITA_PO = '0'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
let request, app, db, token, f1
let tokComercial, tokFinanceiro, tokLogistica, tokCompleto

const D = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10)

describe('lib tendenciaOTIF (pura)', () => {
  it('bucketiza por mês de entrega (competência = data_entregue) e calcula OTIF', () => {
    const t = tendenciaOTIF([
      { data_prometida: '2026-05-10', data_entregue: '2026-05-09' }, // maio, no prazo
      { data_prometida: '2026-05-10', data_entregue: '2026-05-20' }, // maio, atrasada
      { data_prometida: '2026-06-01', data_entregue: '2026-06-01' }, // junho, no prazo
      { data_prometida: '2026-07-01' },                               // aberta (ignorada)
    ], 3, '2026-07-15')
    expect(t).toHaveLength(3)
    expect(t.map(b => b.mes)).toEqual(['2026-05', '2026-06', '2026-07'])
    expect(t[0]).toMatchObject({ entregues: 2, no_prazo: 1, otif_pct: 50 })
    expect(t[1]).toMatchObject({ entregues: 1, otif_pct: 100 })
    expect(t[2].entregues).toBe(0)
    expect(t[2].otif_pct).toBeNull() // mês sem entregas
  })
  it('vira o ano corretamente sem usar Date', () => {
    const t = tendenciaOTIF([], 3, '2026-01-15')
    expect(t.map(b => b.mes)).toEqual(['2025-11', '2025-12', '2026-01'])
  })
})

describe('endpoints — papéis do portal', () => {
  beforeAll(async () => {
    const st = await import('supertest')
    request = st.default
    ;({ app, db } = await import('../server.js'))
    token = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token
    const m = r => r.set('Authorization', `Bearer ${token}`)
    f1 = (await m(request(app).post('/api/fornecedores')).send({ nome: 'Aços Alfa', status: 'Homologado' })).body.data.id
    const mkUser = async (email, papel) => {
      await m(request(app).post('/api/usuarios')).send({ nome: email, email, senha: 'Aa@123456', perfil: 'fornecedor', fornecedor_id: f1, papel_fornecedor: papel, empresa_id: 1 })
      return (await request(app).post('/api/auth/login').send({ email, senha: 'Aa@123456' })).body?.data?.token
    }
    tokComercial = await mkUser('com@f.com', 'comercial')
    tokFinanceiro = await mkUser('fin@f.com', 'financeiro')
    tokLogistica = await mkUser('log@f.com', 'logistica')
    tokCompleto = await mkUser('dono@f.com', '') // sem papel = completo
  })

  const as = tok => path => request(app).get(path).set('Authorization', `Bearer ${tok}`)

  it('papel_fornecedor inválido → 400 na criação', async () => {
    const r = await request(app).post('/api/usuarios').set('Authorization', `Bearer ${token}`)
      .send({ nome: 'x', email: 'bad@f.com', senha: 'Aa@123456', perfil: 'fornecedor', fornecedor_id: f1, papel_fornecedor: 'chefe' })
    expect(r.status).toBe(400)
  })
  it('comercial: RFQ ok, financeiro/entregas bloqueados (403)', async () => {
    expect((await as(tokComercial)('/api/portal/rfq')).status).toBe(200)
    expect((await as(tokComercial)('/api/portal/financeiro')).status).toBe(403)
    expect((await as(tokComercial)('/api/portal/entregas')).status).toBe(403)
  })
  it('financeiro: financeiro ok, RFQ bloqueada (403)', async () => {
    expect((await as(tokFinanceiro)('/api/portal/financeiro')).status).toBe(200)
    expect((await as(tokFinanceiro)('/api/portal/rfq')).status).toBe(403)
  })
  it('logistica: entregas + tendência ok, RFQ bloqueada', async () => {
    expect((await as(tokLogistica)('/api/portal/entregas')).status).toBe(200)
    expect((await as(tokLogistica)('/api/portal/otif-tendencia')).status).toBe(200)
    expect((await as(tokLogistica)('/api/portal/rfq')).status).toBe(403)
  })
  it('sem papel (dono): acessa todas as áreas', async () => {
    expect((await as(tokCompleto)('/api/portal/rfq')).status).toBe(200)
    expect((await as(tokCompleto)('/api/portal/financeiro')).status).toBe(200)
    expect((await as(tokCompleto)('/api/portal/entregas')).status).toBe(200)
  })
  it('áreas comuns livres para qualquer papel (dashboard/qualidade/documentos)', async () => {
    expect((await as(tokComercial)('/api/portal/dashboard')).status).toBe(200)
    expect((await as(tokFinanceiro)('/api/portal/qualidade')).status).toBe(200)
    expect((await as(tokLogistica)('/api/portal/documentos')).status).toBe(200)
  })
})

describe('GET /api/portal/otif-tendencia', () => {
  it('devolve 6 buckets mensais com o OTIF de cada mês', async () => {
    const hojeMes = new Date().toISOString().slice(0, 7)
    // Entrega real neste mês, no prazo.
    db.prepare(`INSERT INTO programacao_entregas(fornecedor_id, data_prometida, data_entregue, status, empresa_id) VALUES(?,?,?,?,1)`)
      .run(f1, D(0), D(0), 'Entregue')
    const r = await request(app).get('/api/portal/otif-tendencia').set('Authorization', `Bearer ${tokLogistica}`)
    expect(r.body.data).toHaveLength(6)
    const atual = r.body.data.find(b => b.mes === hojeMes)
    expect(atual.entregues).toBe(1)
    expect(atual.otif_pct).toBe(100)
  })
})

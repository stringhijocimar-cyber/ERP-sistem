// ============================================================
// Testes — Conciliação bancária (endpoints): importar extrato,
// sugerir casamento com AP/AR, conciliar (baixa o título), isolar tenant.
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
let request, app, db, token, tokenB, cpId, crId

beforeAll(async () => {
  const st = await import('supertest')
  request = st.default
  ;({ app, db } = await import('../server.js'))
  token = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token
  const m = r => r.set('Authorization', `Bearer ${token}`)
  const empB = (await m(request(app).post('/api/empresas')).send({ razao_social: 'Tenant B' })).body.data.id
  await m(request(app).post('/api/usuarios')).send({ nome: 'Admin B', email: 'conc.b@x.com', senha: 'Aa@123456', perfil: 'admin', empresa_id: empB })
  tokenB = (await request(app).post('/api/auth/login').send({ email: 'conc.b@x.com', senha: 'Aa@123456' })).body?.data?.token

  // Tenant A (empresa 1): uma conta a pagar e uma a receber que devem casar.
  const fid = db.prepare(`INSERT INTO fornecedores(nome, status, empresa_id) VALUES('F Conc','Homologado',1)`).run().lastInsertRowid
  cpId = db.prepare(`INSERT INTO contas_pagar(numero, fornecedor_id, fornecedor_nome, descricao, valor, data_vencimento, status, empresa_id) VALUES('CP-C',?,'F Conc','Serviço',1200,'2026-05-10','Pendente',1)`).run(fid).lastInsertRowid
  crId = db.prepare(`INSERT INTO contas_receber(numero, cliente, descricao, valor, data_vencimento, status, empresa_id) VALUES('CR-C','Cliente Z','Fatura',3000,'2026-05-12','A Receber',1)`).run().lastInsertRowid
})

const auth = r => r.set('Authorization', `Bearer ${token}`)

const CSV = 'Data;Histórico;Valor\n11/05/2026;PAG FORNECEDOR;-1.200,00\n12/05/2026;REC CLIENTE;3.000,00\n05/05/2026;TARIFA BANCARIA;-30,00'

describe('POST /api/conciliacao/importar', () => {
  it('importa CSV e grava lançamentos pendentes', async () => {
    const r = await auth(request(app).post('/api/conciliacao/importar')).send({ formato: 'csv', banco: 'Itaú', conteudo: CSV })
    expect(r.status).toBe(201)
    expect(r.body.data.importados).toBe(3)
    const lst = await auth(request(app).get('/api/conciliacao/lancamentos?status=pendente'))
    expect(lst.body.data).toHaveLength(3)
  })
  it('extrato vazio → 400', async () => {
    const r = await auth(request(app).post('/api/conciliacao/importar')).send({ formato: 'csv', conteudo: '' })
    expect(r.status).toBe(400)
  })
})

describe('GET /api/conciliacao/sugestoes', () => {
  it('casa débito↔AP e crédito↔AR por valor+data; tarifa fica sem sugestão', async () => {
    const r = await auth(request(app).get('/api/conciliacao/sugestoes'))
    const byDesc = d => r.body.data.find(x => x.lancamento.descricao === d)
    expect(byDesc('PAG FORNECEDOR').sugestao).toMatchObject({ tipo: 'contas_pagar', ref_id: cpId })
    expect(byDesc('REC CLIENTE').sugestao).toMatchObject({ tipo: 'contas_receber', ref_id: crId })
    expect(byDesc('TARIFA BANCARIA').sugestao).toBeNull()
  })
})

describe('POST /api/conciliacao/:id/conciliar', () => {
  let lancDebito
  beforeAll(async () => {
    const lst = await auth(request(app).get('/api/conciliacao/lancamentos?status=pendente'))
    lancDebito = lst.body.data.find(x => x.descricao === 'PAG FORNECEDOR')
  })
  it('concilia débito → baixa a conta a pagar (Pago) e marca conciliado', async () => {
    const r = await auth(request(app).post(`/api/conciliacao/${lancDebito.id}/conciliar`)).send({ tipo: 'contas_pagar', ref_id: cpId })
    expect(r.status).toBe(200)
    expect(r.body.data.conta.status).toBe('Pago')
    expect(r.body.data.lancamento.status).toBe('conciliado')
    const cp = db.prepare(`SELECT status, data_pagamento FROM contas_pagar WHERE id = ?`).get(cpId)
    expect(cp.status).toBe('Pago')
    expect(cp.data_pagamento).toBe('2026-05-11') // data do lançamento
  })
  it('reconciliar o mesmo lançamento → 409', async () => {
    const r = await auth(request(app).post(`/api/conciliacao/${lancDebito.id}/conciliar`)).send({ tipo: 'contas_pagar', ref_id: cpId })
    expect(r.status).toBe(409)
  })
  it('infere o tipo pelo sinal quando body não envia tipo', async () => {
    const lst = await auth(request(app).get('/api/conciliacao/lancamentos?status=pendente'))
    const cred = lst.body.data.find(x => x.descricao === 'REC CLIENTE')
    const r = await auth(request(app).post(`/api/conciliacao/${cred.id}/conciliar`)).send({ ref_id: crId })
    expect(r.status).toBe(200)
    expect(r.body.data.conta.status).toBe('Recebida')
  })
})

describe('POST /api/conciliacao/:id/ignorar + resumo', () => {
  it('ignora a tarifa e o resumo reflete os status', async () => {
    const lst = await auth(request(app).get('/api/conciliacao/lancamentos?status=pendente'))
    const tarifa = lst.body.data.find(x => x.descricao === 'TARIFA BANCARIA')
    await auth(request(app).post(`/api/conciliacao/${tarifa.id}/ignorar`)).send({})
    const r = await auth(request(app).get('/api/conciliacao/resumo'))
    expect(r.body.data.conciliados).toBe(2)
    expect(r.body.data.ignorados).toBe(1)
    expect(r.body.data.pendentes).toBe(0)
  })
})

describe('isolamento por tenant', () => {
  it('tenant B não enxerga os lançamentos de A', async () => {
    const r = await request(app).get('/api/conciliacao/lancamentos').set('Authorization', `Bearer ${tokenB}`)
    expect(r.body.data).toHaveLength(0)
  })
  it('tenant B não concilia lançamento de A (404)', async () => {
    const lstA = await auth(request(app).get('/api/conciliacao/lancamentos'))
    const algum = lstA.body.data[0]
    const r = await request(app).post(`/api/conciliacao/${algum.id}/conciliar`).set('Authorization', `Bearer ${tokenB}`).send({ ref_id: 1 })
    expect(r.status).toBe(404)
  })
})

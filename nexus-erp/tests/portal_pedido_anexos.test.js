// ============================================================
// Testes — G1: detalhe do pedido no portal + anexos técnicos na cotação.
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'
process.env.ENFORCE_RECEITA_PO = '0'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
let request, app, db, token, tokF1, tokF2, f1, f2, pcId, rfqId

const D = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10)

beforeAll(async () => {
  const st = await import('supertest')
  request = st.default
  ;({ app, db } = await import('../server.js'))
  token = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token
  const m = r => r.set('Authorization', `Bearer ${token}`)
  f1 = (await m(request(app).post('/api/fornecedores')).send({ nome: 'Aços Alfa', status: 'Homologado' })).body.data.id
  f2 = (await m(request(app).post('/api/fornecedores')).send({ nome: 'Chapas Beta', status: 'Homologado' })).body.data.id
  await m(request(app).post('/api/usuarios')).send({ nome: 'U1', email: 'g1a@f.com', senha: 'Aa@123456', perfil: 'fornecedor', fornecedor_id: f1, empresa_id: 1 })
  await m(request(app).post('/api/usuarios')).send({ nome: 'U2', email: 'g1b@f.com', senha: 'Aa@123456', perfil: 'fornecedor', fornecedor_id: f2, empresa_id: 1 })
  tokF1 = (await request(app).post('/api/auth/login').send({ email: 'g1a@f.com', senha: 'Aa@123456' })).body?.data?.token
  tokF2 = (await request(app).post('/api/auth/login').send({ email: 'g1b@f.com', senha: 'Aa@123456' })).body?.data?.token

  pcId = (await m(request(app).post('/api/pedidos')).send({
    fornecedor_id: f1, valor_total: 25000, prazo_entrega: D(10), condicao_pagamento: '28 dias',
    itens: [{ descricao: 'Chapa A36 3/4', quantidade: 10, unidade: 'PC', valor_unitario: 2400 }, { descricao: 'Frete', quantidade: 1, unidade: 'VB', valor_unitario: 1000 }],
  })).body.data.id
  rfqId = (await m(request(app).post('/api/rfq')).send({ titulo: 'Perfil W', prazo_resposta: D(5), fornecedor_ids: [f1] })).body.data.id
})

const asF1 = r => r.set('Authorization', `Bearer ${tokF1}`)
const asF2 = r => r.set('Authorization', `Bearer ${tokF2}`)

describe('GET /api/portal/pedidos/:id — detalhe', () => {
  it('dono vê itens, entrega programada e situação do pagamento', async () => {
    const p = (await asF1(request(app).get(`/api/portal/pedidos/${pcId}`))).body.data
    expect(p.itens).toHaveLength(2)
    expect(p.itens[0].descricao).toContain('Chapa')
    expect(p.entrega.data_prometida).toBe(D(10))
    expect(p.entrega.status_efetivo).toBe('Programada')
    expect(p.pagamento.status).toBe('Pendente')
    expect(p.pagamento.valor).toBe(25000)
  })
  it('outro fornecedor → 404 (não revela existência)', async () => {
    expect((await asF2(request(app).get(`/api/portal/pedidos/${pcId}`))).status).toBe(404)
  })
})

describe('anexos técnicos na cotação', () => {
  it('cotação com anexos grava e devolve os registros', async () => {
    const r = await asF1(request(app).post(`/api/portal/rfq/${rfqId}/cotacao`)).send({
      itens: [{ descricao: 'Perfil W150', quantidade: 5, valor_unitario: 900 }],
      anexos: [{ arquivo_nome: 'datasheet-w150.pdf', descricao: 'Ficha técnica' }, { arquivo_nome: 'certificado-usina.pdf' }, { arquivo_nome: '  ' }],
    })
    expect(r.status).toBe(201)
    expect(r.body.data.anexos).toHaveLength(2) // vazio filtrado
    expect(r.body.data.anexos[0].arquivo_nome).toBe('datasheet-w150.pdf')
  })
  it('revisão substitui os anexos (não acumula)', async () => {
    const r = await asF1(request(app).post(`/api/portal/rfq/${rfqId}/cotacao`)).send({
      itens: [{ descricao: 'Perfil W150', quantidade: 5, valor_unitario: 880 }],
      anexos: [{ arquivo_nome: 'datasheet-v2.pdf' }],
    })
    expect(r.status).toBe(200)
    expect(r.body.data.anexos).toHaveLength(1)
    expect(r.body.data.anexos[0].arquivo_nome).toBe('datasheet-v2.pdf')
  })
  it('detalhe do portal traz os anexos da minha cotação', async () => {
    const d = (await asF1(request(app).get(`/api/portal/rfq/${rfqId}`))).body.data
    expect(d.minha_cotacao.anexos).toHaveLength(1)
  })
  it('comprador vê os anexos na visão interna da RFQ', async () => {
    const d = (await request(app).get(`/api/rfq/${rfqId}`).set('Authorization', `Bearer ${token}`)).body.data
    const cot = d.cotacoes.find(c => c.fornecedor_id === f1)
    expect(cot.anexos).toHaveLength(1)
    expect(cot.anexos[0].arquivo_nome).toBe('datasheet-v2.pdf')
  })
})

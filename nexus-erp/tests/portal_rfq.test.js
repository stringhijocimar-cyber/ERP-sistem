// ============================================================
// Testes — Portal do Fornecedor · RFQ (cotação self-service).
// Isolamento POR FORNECEDOR (convite = gate), trava de prazo, revisão
// dentro do prazo, e o vazamento que NÃO pode existir: cotação de
// concorrente nunca sai pelo portal.
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
let request, app, db, token, tokF1, tokF2, f1, f2, rfqAberta, rfqVencida

const AMANHA = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10)
const ONTEM = new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10)

beforeAll(async () => {
  const st = await import('supertest')
  request = st.default
  ;({ app, db } = await import('../server.js'))
  token = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token
  const m = r => r.set('Authorization', `Bearer ${token}`)

  // Dois fornecedores concorrentes, cada um com seu usuário de portal.
  f1 = (await m(request(app).post('/api/fornecedores')).send({ nome: 'Aços Alfa', status: 'Homologado' })).body.data.id
  f2 = (await m(request(app).post('/api/fornecedores')).send({ nome: 'Chapas Beta', status: 'Homologado' })).body.data.id
  await m(request(app).post('/api/usuarios')).send({ nome: 'User Alfa', email: 'alfa@f.com', senha: 'Aa@123456', perfil: 'fornecedor', fornecedor_id: f1, empresa_id: 1 })
  await m(request(app).post('/api/usuarios')).send({ nome: 'User Beta', email: 'beta@f.com', senha: 'Aa@123456', perfil: 'fornecedor', fornecedor_id: f2, empresa_id: 1 })
  tokF1 = (await request(app).post('/api/auth/login').send({ email: 'alfa@f.com', senha: 'Aa@123456' })).body?.data?.token
  tokF2 = (await request(app).post('/api/auth/login').send({ email: 'beta@f.com', senha: 'Aa@123456' })).body?.data?.token

  // RFQ aberta convidando SÓ o F1; outra vencida convidando F1.
  rfqAberta = (await m(request(app).post('/api/rfq')).send({ titulo: 'Chapa A36 3/4"', prazo_resposta: AMANHA, fornecedor_ids: [f1] })).body.data.id
  rfqVencida = (await m(request(app).post('/api/rfq')).send({ titulo: 'Perfil W 150', prazo_resposta: ONTEM, fornecedor_ids: [f1] })).body.data.id
})

const asF1 = r => r.set('Authorization', `Bearer ${tokF1}`)
const asF2 = r => r.set('Authorization', `Bearer ${tokF2}`)

describe('GET /api/portal/rfq — lista por convite', () => {
  it('F1 vê as 2 RFQs onde foi convidado, com pode_responder correto', async () => {
    const r = await asF1(request(app).get('/api/portal/rfq'))
    expect(r.status).toBe(200)
    expect(r.body.data).toHaveLength(2)
    const aberta = r.body.data.find(x => x.id === rfqAberta)
    const vencida = r.body.data.find(x => x.id === rfqVencida)
    expect(aberta.pode_responder).toBe(true)
    expect(vencida.prazo_expirado).toBe(true)
    expect(vencida.pode_responder).toBe(false)
  })
  it('F2 (não convidado) vê lista vazia', async () => {
    const r = await asF2(request(app).get('/api/portal/rfq'))
    expect(r.body.data).toHaveLength(0)
  })
  it('perfil interno (admin) é barrado no portal (403)', async () => {
    const r = await request(app).get('/api/portal/rfq').set('Authorization', `Bearer ${token}`)
    expect(r.status).toBe(403)
  })
})

describe('POST /api/portal/rfq/:id/cotacao', () => {
  it('F1 responde com itens; valor = soma dos itens; convite vira Respondida', async () => {
    const r = await asF1(request(app).post(`/api/portal/rfq/${rfqAberta}/cotacao`)).send({
      prazo_entrega: 12, condicao_pagamento: '28 dias',
      itens: [
        { descricao: 'Chapa A36 3/4" 3x12m', quantidade: 10, unidade: 'PC', valor_unitario: 2400 },
        { descricao: 'Frete CIF', quantidade: 1, unidade: 'VB', valor_unitario: 1800 },
      ],
    })
    expect(r.status).toBe(201)
    expect(r.body.data.valor_total).toBe(25800) // 24000 + 1800
    expect(r.body.data.itens).toHaveLength(2)
    const conv = db.prepare(`SELECT status, respondido_em FROM rfq_fornecedores WHERE rfq_id = ? AND fornecedor_id = ?`).get(rfqAberta, f1)
    expect(conv.status).toBe('Respondida')
    expect(conv.respondido_em).toBeTruthy()
  })

  it('revisão dentro do prazo SUBSTITUI (não duplica) a cotação', async () => {
    const r = await asF1(request(app).post(`/api/portal/rfq/${rfqAberta}/cotacao`)).send({
      itens: [{ descricao: 'Chapa A36 3/4" 3x12m', quantidade: 10, unidade: 'PC', valor_unitario: 2300 }],
    })
    expect(r.status).toBe(200)
    expect(r.body.data.revisada).toBe(true)
    expect(r.body.data.valor_total).toBe(23000)
    const n = db.prepare(`SELECT COUNT(*) n FROM cotacoes WHERE rfq_id = ? AND fornecedor_id = ?`).get(rfqAberta, f1).n
    expect(n).toBe(1) // não duplicou
  })

  it('F2 sem convite → 404 (a RFQ "não existe" para ele)', async () => {
    const r = await asF2(request(app).post(`/api/portal/rfq/${rfqAberta}/cotacao`)).send({ valor_total: 999 })
    expect(r.status).toBe(404)
  })

  it('prazo expirado → 409 e nada é gravado', async () => {
    const r = await asF1(request(app).post(`/api/portal/rfq/${rfqVencida}/cotacao`)).send({ valor_total: 5000 })
    expect(r.status).toBe(409)
    const n = db.prepare(`SELECT COUNT(*) n FROM cotacoes WHERE rfq_id = ?`).get(rfqVencida).n
    expect(n).toBe(0)
  })

  it('valor zero/ausente → 400', async () => {
    const r = await asF1(request(app).post(`/api/portal/rfq/${rfqAberta}/cotacao`)).send({ observacoes: 'sem preço' })
    expect(r.status).toBe(400)
  })
})

describe('GET /api/portal/rfq/:id — detalhe SEM vazamento competitivo', () => {
  it('F1 vê a própria cotação com itens', async () => {
    const r = await asF1(request(app).get(`/api/portal/rfq/${rfqAberta}`))
    expect(r.status).toBe(200)
    expect(r.body.data.minha_cotacao.valor_total).toBe(23000)
    expect(r.body.data.minha_cotacao.itens).toHaveLength(1)
  })
  it('NUNCA expõe cotações de concorrentes (nem o campo existe)', async () => {
    // Lança uma cotação interna do F2 na mesma RFQ (via rota interna do comprador).
    await request(app).post(`/api/rfq/${rfqAberta}/cotacoes`).set('Authorization', `Bearer ${token}`)
      .send({ fornecedor_id: f2, valor_total: 20000 })
    const r = await asF1(request(app).get(`/api/portal/rfq/${rfqAberta}`))
    const raw = JSON.stringify(r.body)
    expect(r.body.data.cotacoes).toBeUndefined()      // sem lista de cotações
    expect(raw).not.toContain('Chapas Beta')           // nem o nome do concorrente
    expect(raw).not.toContain('20000')                 // nem o preço dele
  })
  it('F2 sem convite no detalhe → 404', async () => {
    const r = await asF2(request(app).get(`/api/portal/rfq/${rfqAberta}`))
    expect(r.status).toBe(404)
  })
})

// ============================================================
// Testes — Fluxo de caixa planejado × realizado (Onda 2)
// Unit da lib pura (datas controladas) + integração do endpoint.
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'
import { montarFluxoCaixa } from '../lib/fluxo_caixa.js'

// 2026-06-15 é uma segunda-feira → início de semana determinístico.
const HOJE = '2026-06-15'
const off = n => new Date(new Date(HOJE + 'T00:00:00Z').getTime() + n * 864e5).toISOString().slice(0, 10)

describe('montarFluxoCaixa (lib pura)', () => {
  const contas = [
    { valor: 100, data_vencimento: off(2), status: 'Pendente', contrato_id: 'CT-1' },   // semana 0 planejado
    { valor: 50, data_vencimento: off(1), data_pagamento: off(3), status: 'Pago', contrato_id: 'CT-1' }, // sem0 plan+real
    { valor: 200, data_vencimento: off(8), status: 'Aprovado', contrato_id: 'CT-2' },    // semana 1 planejado
    { valor: 999, data_vencimento: off(2), status: 'Cancelado', contrato_id: 'CT-1' },   // cancelada: ignora
    { valor: 70, data_vencimento: off(400), status: 'Pendente', contrato_id: 'CT-3' },   // fora da janela
  ]

  it('distribui planejado/realizado nas semanas certas', () => {
    const r = montarFluxoCaixa(contas, { semanas: 8, hoje: HOJE })
    expect(r.semanas[0].planejado).toBe(150) // 100 + 50
    expect(r.semanas[0].realizado).toBe(50)
    expect(r.semanas[0].desvio).toBe(-100)
    expect(r.semanas[1].planejado).toBe(200)
  })

  it('ignora cancelada e fora da janela; resumo coerente', () => {
    const r = montarFluxoCaixa(contas, { semanas: 8, hoje: HOJE })
    expect(r.resumo.planejado_total).toBe(350) // 150 + 200 (sem cancelada/fora)
    expect(r.resumo.realizado_total).toBe(50)
    expect(r.resumo.desvio_total).toBe(-300)
  })

  it('quebra por contrato, ordenada por |desvio|', () => {
    const r = montarFluxoCaixa(contas, { semanas: 8, hoje: HOJE })
    const ct2 = r.por_contrato.find(c => c.contrato === 'CT-2')
    const ct1 = r.por_contrato.find(c => c.contrato === 'CT-1')
    expect(ct2.planejado).toBe(200)
    expect(ct1.planejado).toBe(150)
    expect(ct1.realizado).toBe(50)
    expect(r.por_contrato.some(c => c.contrato === 'CT-3')).toBe(false) // fora da janela
  })
})

describe('Endpoint /api/fluxo-caixa', () => {
  const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
  let request, app, db, token

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'; process.env.DB_PATH = ':memory:'; process.env.SEED_PASSWORD = 'Fraser@2025'
    const st = await import('supertest'); request = st.default
    ;({ app, db } = await import('../server.js'))
    token = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token
    const hoje = new Date().toISOString().slice(0, 10)
    const prox = new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10)
    db.prepare(`INSERT INTO contas_pagar(numero, valor, data_vencimento, status, contrato_id) VALUES('CP-F1', 500, ?, 'Pendente', 'CT-X')`).run(prox)
    db.prepare(`INSERT INTO contas_pagar(numero, valor, data_vencimento, data_pagamento, status, contrato_id) VALUES('CP-F2', 300, ?, ?, 'Pago', 'CT-X')`).run(hoje, hoje)
  })

  it('retorna semanas, por_contrato e resumo', async () => {
    const r = await request(app).get('/api/fluxo-caixa?semanas=4').set('Authorization', `Bearer ${token}`)
    expect(r.status).toBe(200)
    expect(Array.isArray(r.body.data.semanas)).toBe(true)
    expect(r.body.data.semanas.length).toBe(4)
    expect(r.body.data.resumo.planejado_total).toBeGreaterThanOrEqual(800)
    expect(r.body.data.por_contrato.some(c => c.contrato === 'CT-X')).toBe(true)
  })

  it('bloqueia o fornecedor (403)', async () => {
    const fid = db.prepare(`INSERT INTO fornecedores(nome) VALUES('FFC')`).run().lastInsertRowid
    await request(app).post('/api/usuarios').set('Authorization', `Bearer ${token}`).send({ nome: 'P', email: 'pfc@forn.com', senha: 'Portal@123', perfil: 'fornecedor', fornecedor_id: fid })
    const tk = (await request(app).post('/api/auth/login').send({ email: 'pfc@forn.com', senha: 'Portal@123' })).body?.data?.token
    const r = await request(app).get('/api/fluxo-caixa').set('Authorization', `Bearer ${tk}`)
    expect(r.status).toBe(403)
  })
})

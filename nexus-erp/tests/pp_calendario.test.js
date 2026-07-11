// ============================================================
// Testes — PP fase 2: calendário de produção (plan × real por mês) + custo da
// OP na margem do contrato. Lib pura + endpoints (plano upsert, calendário,
// custo do apontamento, linha de produção na margem, isolamento).
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'
import { custoConsumo, montarCalendario } from '../lib/pp_calendario.js'

describe('lib pp_calendario (pura)', () => {
  it('custoConsumo multiplica quantidade × custo médio', () => {
    const r = custoConsumo(
      [{ part_number: 'MOTOR', quantidade: 2 }, { part_number: 'graxa', quantidade: 1.5 }],
      new Map([['MOTOR', 90000], ['GRAXA', 40]]),
    )
    expect(r.total).toBe(180060) // 2×90000 + 1.5×40
    expect(r.itens[1].custo_total).toBe(60)
  })
  it('calendário: real por mês, %, acumulados e status', () => {
    const plano = [{ mes: '2027-01', veiculos_plan: 4 }, { mes: '2027-02', veiculos_plan: 4 }, { mes: '2027-03', veiculos_plan: 5 }]
    const apont = [
      { data: '2027-01-15', veiculos: 4, custo_materiais: 100 },
      { data: '2027-02-10', veiculos: 2, custo_materiais: 50 },  // fev abaixo do plano
      { data: '2026-12-01', veiculos: 9, custo_materiais: 10 },  // fora do ano (custo conta, real não)
    ]
    const c = montarCalendario(plano, apont, 2027, '2027-03-05')
    const jan = c.meses[0], fev = c.meses[1], mar = c.meses[2]
    expect(jan.real).toBe(4); expect(jan.pct).toBe(100); expect(jan.status).toBe('Concluído')
    expect(fev.real).toBe(2); expect(fev.pct).toBe(50); expect(fev.status).toBe('Atrasado')
    expect(mar.status).toBe('Em andamento')
    expect(mar.acum_plan).toBe(13); expect(mar.acum_real).toBe(6)
    expect(c.resumo.total_plan).toBe(13)
    expect(c.resumo.atrasados).toBe(1)
    expect(c.resumo.custo_producao).toBe(160) // trilha financeira total
  })
})

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
let request, app, db, token, tokB, ctNumero

describe('endpoints — calendário + custo da OP na margem', () => {
  beforeAll(async () => {
    const st = await import('supertest')
    request = st.default
    ;({ app, db } = await import('../server.js'))
    token = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token
    const m = r => r.set('Authorization', `Bearer ${token}`)
    // BOM + estoque + PPAP ok
    const sys = (await m(request(app).post('/api/mm/materiais')).send({ part_number: 'SYS', make_buy: 'MAKE', nivel: 1, qtd_veiculo: 1 })).body.data.id
    const motor = (await m(request(app).post('/api/mm/materiais')).send({ part_number: 'MOTOR', make_buy: 'BUY', nivel: 2, peca_pai_id: sys, qtd_veiculo: 1 })).body.data.id
    await m(request(app).post('/api/almoxarifado')).send({ codigo: 'MOTOR', descricao: 'Motor', quantidade_atual: 10, valor_medio: 90000 })
    const p = (await m(request(app).post(`/api/mm/materiais/${motor}/ppap`)).send({ nivel: 3, dimensional_ok: true, material_ok: true, funcional_ok: true, documentacao_ok: true })).body.data.id
    await m(request(app).post(`/api/mm/ppap/${p}/decidir`)).send({})
    // contrato para a margem
    ctNumero = 'CT-PP-001'
    db.prepare(`INSERT INTO contratos(numero, titulo, valor_total, empresa_id) VALUES(?, 'Guarani', 1000000, 1)`).run(ctNumero)
    // tenant B
    const empB = (await m(request(app).post('/api/empresas')).send({ razao_social: 'Tenant B Cal' })).body.data.id
    await m(request(app).post('/api/usuarios')).send({ nome: 'AdmB', email: 'cal.b@x.com', senha: 'Aa@123456', perfil: 'admin', empresa_id: empB })
    tokB = (await request(app).post('/api/auth/login').send({ email: 'cal.b@x.com', senha: 'Aa@123456' })).body?.data?.token
  })
  const auth = r => r.set('Authorization', `Bearer ${token}`)

  it('plano: upsert por mês; mês inválido 400', async () => {
    const ano = new Date().getFullYear()
    expect((await auth(request(app).post('/api/pp/plano')).send({ mes: `${ano}-01`, veiculos_plan: 4 })).status).toBe(201)
    const up = await auth(request(app).post('/api/pp/plano')).send({ mes: `${ano}-01`, veiculos_plan: 6 })
    expect(up.status).toBe(200)
    expect(up.body.data.veiculos_plan).toBe(6)
    expect((await auth(request(app).post('/api/pp/plano')).send({ mes: 'jan/2027', veiculos_plan: 1 })).status).toBe(400)
  })

  it('OP ligada a contrato inexistente → 404; apontamento carrega custo e alimenta calendário + margem', async () => {
    const bad = await auth(request(app).post('/api/pp/ordens')).send({ veiculos_plan: 2, contrato_id: 'NAO-EXISTE' })
    expect(bad.status).toBe(404)
    const op = (await auth(request(app).post('/api/pp/ordens')).send({ veiculos_plan: 2, contrato_id: ctNumero })).body.data
    await auth(request(app).post(`/api/pp/ordens/${op.id}/liberar`)).send({})
    const ap = await auth(request(app).post(`/api/pp/ordens/${op.id}/apontar`)).send({ veiculos: 2 })
    expect(ap.body.data.custo_apontamento).toBe(180000) // 2 motores × 90000
    expect(ap.body.data.custo_real).toBe(180000)
    // calendário do ano corrente: real=2 no mês atual, custo total 180000
    const cal = (await auth(request(app).get('/api/pp/calendario'))).body.data
    const mesAtual = new Date().toISOString().slice(0, 7)
    const mes = cal.meses.find(x => x.mes === mesAtual)
    expect(mes.real).toBe(2)
    expect(cal.resumo.custo_producao).toBe(180000)
    // margem do contrato ganha a linha de produção
    const ctId = db.prepare(`SELECT id FROM contratos WHERE numero = ?`).get(ctNumero).id
    const mg = (await auth(request(app).get(`/api/contratos/${ctId}/margem`))).body.data
    expect(mg.custo_producao).toBe(180000)
    expect(mg.custo_total).toBe(180000)
    expect(mg.linhas.some(l => /produção/i.test(l.label) && l.valor === -180000)).toBe(true)
  })

  it('isolamento: tenant B tem calendário zerado', async () => {
    const cal = (await request(app).get('/api/pp/calendario').set('Authorization', `Bearer ${tokB}`)).body.data
    expect(cal.resumo.total_real).toBe(0)
    expect(cal.resumo.custo_producao).toBe(0)
  })
})

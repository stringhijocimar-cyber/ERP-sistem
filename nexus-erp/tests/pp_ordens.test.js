// ============================================================
// Testes — PP: ordens de produção. Gate de liberação (PPAP + MRP), apontamento
// com baixa automática do estoque pela BOM (tudo-ou-nada), conclusão da ordem
// e isolamento. Lib pura + endpoints E2E.
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'
import { gateLiberacaoOP, consumoDaOrdem, validarConsumo, statusAposApontamento } from '../lib/pp_producao.js'

describe('lib pp_producao (pura)', () => {
  it('gate: PPAP e MRP bloqueiam com motivos; sem pendências libera', () => {
    const g = gateLiberacaoOP({ bloqueiosPPAP: [{ id: 1 }], mrp: { itens_faltantes: 2, veiculos_possiveis: 3 }, veiculos: 10 })
    expect(g.ok).toBe(false)
    expect(g.motivos.length).toBe(2)
    expect(gateLiberacaoOP({ bloqueiosPPAP: [], mrp: { itens_faltantes: 0, veiculos_possiveis: 10 }, veiculos: 10 }).ok).toBe(true)
  })
  it('MRP que cobre a ordem não bloqueia mesmo com faltante além dela', () => {
    // faltantes existem p/ volumes maiores, mas cobre os 5 da ordem
    const g = gateLiberacaoOP({ bloqueiosPPAP: [], mrp: { itens_faltantes: 1, veiculos_possiveis: 5 }, veiculos: 5 })
    expect(g.ok).toBe(true)
  })
  it('consumoDaOrdem: só BUY que consome, multiplicado pelos veículos', () => {
    const c = consumoDaOrdem([
      { part_number: 'SYS', make_buy: 'MAKE', qtd_por_veiculo: 1 },
      { part_number: 'MOTOR', make_buy: 'BUY', qtd_por_veiculo: 1 },
      { part_number: 'PARAF', make_buy: 'BUY', qtd_por_veiculo: 8 },
      { part_number: 'OPC', make_buy: 'BUY', qtd_por_veiculo: 0 },
    ], 5)
    expect(c.map(x => x.part_number)).toEqual(['MOTOR', 'PARAF'])
    expect(c.find(x => x.part_number === 'PARAF').quantidade).toBe(40)
  })
  it('validarConsumo é tudo-ou-nada', () => {
    const saldo = new Map([['MOTOR', 5], ['PARAF', 10]])
    const v = validarConsumo([{ part_number: 'MOTOR', quantidade: 5 }, { part_number: 'PARAF', quantidade: 40 }], saldo)
    expect(v.ok).toBe(false)
    expect(v.insuficientes[0].part_number).toBe('PARAF')
    expect(v.insuficientes[0].disponivel).toBe(10)
  })
  it('statusAposApontamento conclui ao atingir o plano', () => {
    expect(statusAposApontamento({ veiculos_plan: 10, veiculos_produzidos: 8 }, 1).status).toBe('Em Produção')
    const done = statusAposApontamento({ veiculos_plan: 10, veiculos_produzidos: 8 }, 2)
    expect(done.status).toBe('Concluída')
    expect(done.concluida).toBe(true)
  })
})

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
let request, app, token, tokB, motorId, opId

describe('endpoints — ordem de produção E2E', () => {
  beforeAll(async () => {
    const st = await import('supertest')
    request = st.default
    ;({ app } = await import('../server.js'))
    token = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token
    const m = r => r.set('Authorization', `Bearer ${token}`)
    // BOM: sistema MAKE → motor BUY 1×/veíc
    const sys = (await m(request(app).post('/api/mm/materiais')).send({ part_number: 'SYS', make_buy: 'MAKE', nivel: 1, qtd_veiculo: 1 })).body.data.id
    motorId = (await m(request(app).post('/api/mm/materiais')).send({ part_number: 'MOTOR', descricao: 'Motor', make_buy: 'BUY', nivel: 2, peca_pai_id: sys, qtd_veiculo: 1 })).body.data.id
    // estoque: 5 motores (cobre 5 veículos)
    await m(request(app).post('/api/almoxarifado')).send({ codigo: 'MOTOR', descricao: 'Motor', quantidade_atual: 5, valor_medio: 90000 })
    // tenant B
    const empB = (await m(request(app).post('/api/empresas')).send({ razao_social: 'Tenant B PP' })).body.data.id
    await m(request(app).post('/api/usuarios')).send({ nome: 'AdmB', email: 'pp.b@x.com', senha: 'Aa@123456', perfil: 'admin', empresa_id: empB })
    tokB = (await request(app).post('/api/auth/login').send({ email: 'pp.b@x.com', senha: 'Aa@123456' })).body?.data?.token
  })
  const auth = r => r.set('Authorization', `Bearer ${token}`)

  it('tenant sem BOM não cria ordem (400)', async () => {
    const r = await request(app).post('/api/pp/ordens').set('Authorization', `Bearer ${tokB}`).send({ veiculos_plan: 5 })
    expect(r.status).toBe(400)
  })

  it('cria ordem Planejada com numeração OP', async () => {
    const r = await auth(request(app).post('/api/pp/ordens')).send({ veiculos_plan: 5, projeto: 'Guarani' })
    expect(r.status).toBe(201)
    expect(r.body.data.numero).toMatch(/^OP-\d{4}-\d{3}$/)
    expect(r.body.data.status).toBe('Planejada')
    opId = r.body.data.id
  })

  it('GATE: liberação bloqueada sem PPAP (409 com motivo)', async () => {
    const g = (await auth(request(app).get(`/api/pp/ordens/${opId}/gate`))).body.data
    expect(g.ok).toBe(false)
    const r = await auth(request(app).post(`/api/pp/ordens/${opId}/liberar`)).send({})
    expect(r.status).toBe(409)
    expect(r.body.error).toMatch(/PPAP/i)
  })

  it('apontar sem liberar → 409', async () => {
    const r = await auth(request(app).post(`/api/pp/ordens/${opId}/apontar`)).send({ veiculos: 1 })
    expect(r.status).toBe(409)
  })

  it('resolve PPAP → libera; aponta 2 veículos e o estoque baixa pela BOM', async () => {
    const ppapId = (await auth(request(app).post(`/api/mm/materiais/${motorId}/ppap`)).send({ nivel: 3, dimensional_ok: true, material_ok: true, funcional_ok: true, documentacao_ok: true })).body.data.id
    await auth(request(app).post(`/api/mm/ppap/${ppapId}/decidir`)).send({})
    const lib = await auth(request(app).post(`/api/pp/ordens/${opId}/liberar`)).send({})
    expect(lib.status).toBe(200)
    expect(lib.body.data.status).toBe('Liberada')

    const ap = await auth(request(app).post(`/api/pp/ordens/${opId}/apontar`)).send({ veiculos: 2 })
    expect(ap.status).toBe(200)
    expect(ap.body.data.veiculos_produzidos).toBe(2)
    expect(ap.body.data.status).toBe('Em Produção')
    expect(ap.body.data.consumo.find(c => c.part_number === 'MOTOR').quantidade).toBe(2)
    // saldo: 5 − 2 = 3, com movimento de Saída registrado
    const itens = (await auth(request(app).get('/api/almoxarifado'))).body.data
    const motor = itens.find(i => i.codigo === 'MOTOR')
    expect(motor.quantidade_atual).toBe(3)
    const movs = (await auth(request(app).get(`/api/almoxarifado/${motor.id}/movimentos`))).body.data
    expect(movs.some(mv => mv.tipo === 'Saída' && String(mv.documento || '').startsWith('OP-'))).toBe(true)
  })

  it('apontar além do restante → 400; consumo insuficiente → 409', async () => {
    const alem = await auth(request(app).post(`/api/pp/ordens/${opId}/apontar`)).send({ veiculos: 4 })
    expect(alem.status).toBe(400) // restante é 3
    // nova ordem de 4 com só 3 motores em estoque → gate de liberação bloqueia
    const op2 = (await auth(request(app).post('/api/pp/ordens')).send({ veiculos_plan: 4 })).body.data.id
    const r = await auth(request(app).post(`/api/pp/ordens/${op2}/liberar`)).send({})
    expect(r.status).toBe(409)
    expect(r.body.error).toMatch(/Estoque cobre 3 de 4/)
  })

  it('conclui a ordem ao apontar o restante', async () => {
    const ap = await auth(request(app).post(`/api/pp/ordens/${opId}/apontar`)).send({ veiculos: 3 })
    expect(ap.body.data.status).toBe('Concluída')
    expect(ap.body.data.data_conclusao).toBeTruthy()
    // estoque zerou (5 − 2 − 3)
    const itens = (await auth(request(app).get('/api/almoxarifado'))).body.data
    expect(itens.find(i => i.codigo === 'MOTOR').quantidade_atual).toBe(0)
  })

  it('isolamento: tenant B não vê/opera ordens do A', async () => {
    const rB = await request(app).get('/api/pp/ordens').set('Authorization', `Bearer ${tokB}`)
    expect(rB.body.data.length).toBe(0)
    const g = await request(app).post(`/api/pp/ordens/${opId}/apontar`).set('Authorization', `Bearer ${tokB}`).send({ veiculos: 1 })
    expect(g.status).toBe(404)
  })
})

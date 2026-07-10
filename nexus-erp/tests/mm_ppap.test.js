// ============================================================
// Testes — MM fase 3: amostras/APQP + PPAP (gate de produção). Lib pura
// (avaliação/status/gate) + endpoints (submissão, decisão, gate de produção,
// bloqueios, isolamento).
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'
import { avaliarPPAP, resolverStatusPPAP, ppapLibera, gateProducao, bloqueiosProducao, statusQualidade } from '../lib/mm_ppap.js'

describe('lib mm_ppap (pura)', () => {
  const todosOk = { dimensional_ok: 1, material_ok: 1, funcional_ok: 1, documentacao_ok: 1 }
  it('avaliarPPAP lista pendências e só aprova com todos OK', () => {
    expect(avaliarPPAP(todosOk).aprovavel).toBe(true)
    const r = avaliarPPAP({ dimensional_ok: 1, material_ok: 0, funcional_ok: 1, documentacao_ok: 0 })
    expect(r.aprovavel).toBe(false)
    expect(r.pendentes).toEqual(['material', 'documentacao'])
  })
  it('resolverStatusPPAP: Aprovado / Condicional (c/ PSW) / Rejeitado', () => {
    expect(resolverStatusPPAP(todosOk)).toBe('Aprovado')
    expect(resolverStatusPPAP({ dimensional_ok: 1 }, { condicional: true, psw_assinado: true })).toBe('Condicional')
    expect(resolverStatusPPAP({ dimensional_ok: 1 }, { condicional: true, psw_assinado: false })).toBe('Rejeitado')
    expect(resolverStatusPPAP({ dimensional_ok: 0 })).toBe('Rejeitado')
  })
  it('gateProducao: MAKE ok; BUY sem PPAP bloqueia; Aprovado/Condicional libera; Rejeitado bloqueia', () => {
    expect(gateProducao({ make_buy: 'MAKE' }).ok).toBe(true)
    expect(gateProducao({ make_buy: 'BUY' }, null).ok).toBe(false)
    expect(gateProducao({ make_buy: 'BUY' }, { status: 'Aprovado' }).ok).toBe(true)
    const cond = gateProducao({ make_buy: 'BUY' }, { status: 'Condicional' })
    expect(cond.ok).toBe(true); expect(cond.condicional).toBe(true)
    expect(gateProducao({ make_buy: 'BUY' }, { status: 'Rejeitado' }).ok).toBe(false)
  })
  it('bloqueiosProducao só conta BUY sem PPAP que libere', () => {
    const mats = [
      { id: 1, make_buy: 'MAKE' },
      { id: 2, make_buy: 'BUY' },                       // sem ppap → bloqueia
      { id: 3, make_buy: 'BUY' },                       // aprovado → ok
    ]
    const ppap = new Map([[3, { status: 'Aprovado' }]])
    expect(bloqueiosProducao(mats, ppap).map(m => m.id)).toEqual([2])
  })
  it('statusQualidade legível', () => {
    expect(statusQualidade({ make_buy: 'MAKE' })).toBe('Interno')
    expect(statusQualidade({ make_buy: 'BUY' }, null)).toBe('Sem PPAP')
    expect(statusQualidade({ make_buy: 'BUY' }, { status: 'Aprovado' })).toBe('Aprovado')
  })
})

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
let request, app, token, tokB, buyId, makeId

describe('endpoints — MM PPAP / amostras', () => {
  beforeAll(async () => {
    const st = await import('supertest')
    request = st.default
    ;({ app } = await import('../server.js'))
    token = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token
    const m = r => r.set('Authorization', `Bearer ${token}`)
    buyId = (await m(request(app).post('/api/mm/materiais')).send({ part_number: 'MEC-100-001', descricao: 'Motor', make_buy: 'BUY', qtd_veiculo: 1 })).body.data.id
    makeId = (await m(request(app).post('/api/mm/materiais')).send({ part_number: 'MEC-000-001', make_buy: 'MAKE', qtd_veiculo: 1 })).body.data.id
    const empB = (await m(request(app).post('/api/empresas')).send({ razao_social: 'Tenant B PPAP' })).body.data.id
    await m(request(app).post('/api/usuarios')).send({ nome: 'AdmB', email: 'ppap.b@x.com', senha: 'Aa@123456', perfil: 'admin', empresa_id: empB })
    tokB = (await request(app).post('/api/auth/login').send({ email: 'ppap.b@x.com', senha: 'Aa@123456' })).body?.data?.token
  })
  const auth = r => r.set('Authorization', `Bearer ${token}`)

  it('MAKE não aceita PPAP (400)', async () => {
    const r = await auth(request(app).post(`/api/mm/materiais/${makeId}/ppap`)).send({ nivel: 3 })
    expect(r.status).toBe(400)
  })

  it('produção do motor bloqueada sem PPAP', async () => {
    const g = (await auth(request(app).get(`/api/mm/materiais/${buyId}/gate-producao`))).body.data
    expect(g.ok).toBe(false)
    const bl = (await auth(request(app).get('/api/mm/producao/bloqueios'))).body.data
    expect(bl.bloqueados).toBe(1)
    expect(bl.itens[0].part_number).toBe('MEC-100-001')
  })

  it('submete PPAP, marca os 4 pilares, decide Aprovado → libera produção', async () => {
    const ppapId = (await auth(request(app).post(`/api/mm/materiais/${buyId}/ppap`)).send({ nivel: 3 })).body.data.id
    // decidir sem os checks → Rejeitado
    const rej = await auth(request(app).post(`/api/mm/ppap/${ppapId}/decidir`)).send({})
    expect(rej.body.data.status).toBe('Rejeitado')
    // marca todos OK e aprova
    await auth(request(app).put(`/api/mm/ppap/${ppapId}`)).send({ dimensional_ok: true, material_ok: true, funcional_ok: true, documentacao_ok: true })
    const apr = await auth(request(app).post(`/api/mm/ppap/${ppapId}/decidir`)).send({})
    expect(apr.body.data.status).toBe('Aprovado')
    expect(apr.body.data.data_aprovacao).toBeTruthy()
    const g = (await auth(request(app).get(`/api/mm/materiais/${buyId}/gate-producao`))).body.data
    expect(g.ok).toBe(true)
    const bl = (await auth(request(app).get('/api/mm/producao/bloqueios'))).body.data
    expect(bl.bloqueados).toBe(0)
  })

  it('aprovação condicional exige PSW assinado', async () => {
    const id = (await auth(request(app).post(`/api/mm/materiais/${buyId}/ppap`)).send({ nivel: 4 })).body.data.id
    await auth(request(app).put(`/api/mm/ppap/${id}`)).send({ dimensional_ok: true, material_ok: false })
    const semPsw = await auth(request(app).post(`/api/mm/ppap/${id}/decidir`)).send({ condicional: true })
    expect(semPsw.status).toBe(400)
    const comPsw = await auth(request(app).post(`/api/mm/ppap/${id}/decidir`)).send({ condicional: true, psw_assinado: true })
    expect(comPsw.body.data.status).toBe('Condicional')
  })

  it('amostra: solicita e atualiza status/resultado', async () => {
    const a = (await auth(request(app).post(`/api/mm/materiais/${buyId}/amostra`)).send({ tipo_teste: 'Dimensional', quantidade: 3 })).body.data
    expect(a.status).toBe('Solicitada')
    const up = await auth(request(app).put(`/api/mm/amostras/${a.id}`)).send({ status: 'Aprovada', resultado: 'OK', data_recebimento: '2026-07-10' })
    expect(up.body.data.status).toBe('Aprovada')
  })

  it('isolamento: tenant B não vê PPAP/bloqueios do A e não submete no material do A (404)', async () => {
    const rB = await request(app).get('/api/mm/ppap').set('Authorization', `Bearer ${tokB}`)
    expect(rB.body.data.length).toBe(0)
    const sub = await request(app).post(`/api/mm/materiais/${buyId}/ppap`).set('Authorization', `Bearer ${tokB}`).send({ nivel: 3 })
    expect(sub.status).toBe(404)
    const bl = (await request(app).get('/api/mm/producao/bloqueios').set('Authorization', `Bearer ${tokB}`)).body.data
    expect(bl.total_buy).toBe(0)
  })
})

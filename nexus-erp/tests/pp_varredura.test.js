// ============================================================
// Varredura adversarial do PP — gaps que viram regressão.
// GAP 1 (real, fechado): apontar não re-checava o PPAP — um PPAP REJEITADO no
//   meio da produção (recall de qualidade) não parava os apontamentos; a peça
//   reprovada continuaria sendo montada.
// GAP 2 (real, fechado): status "Cancelada" existia no front mas não havia
//   endpoint — ordem errada ficava viva para sempre.
// Extras: quantidade fracionária na BOM, apontar em ordem cancelada.
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
let request, app, token, motorId, opId

const aprovarPPAP = async (auth, materialId) => {
  const p = (await auth(request(app).post(`/api/mm/materiais/${materialId}/ppap`))
    .send({ nivel: 3, dimensional_ok: true, material_ok: true, funcional_ok: true, documentacao_ok: true })).body.data.id
  await auth(request(app).post(`/api/mm/ppap/${p}/decidir`)).send({})
  return p
}

describe('varredura PP', () => {
  beforeAll(async () => {
    const st = await import('supertest')
    request = st.default
    ;({ app } = await import('../server.js'))
    token = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token
    const m = r => r.set('Authorization', `Bearer ${token}`)
    const sys = (await m(request(app).post('/api/mm/materiais')).send({ part_number: 'SYS', make_buy: 'MAKE', nivel: 1, qtd_veiculo: 1 })).body.data.id
    motorId = (await m(request(app).post('/api/mm/materiais')).send({ part_number: 'MOTOR', make_buy: 'BUY', nivel: 2, peca_pai_id: sys, qtd_veiculo: 1 })).body.data.id
    // graxa fracionária: 0.5 kg por veículo (testa consumo não-inteiro)
    await m(request(app).post('/api/mm/materiais')).send({ part_number: 'GRAXA', make_buy: 'BUY', nivel: 2, peca_pai_id: sys, qtd_veiculo: 0.5, unidade: 'KG' })
    await m(request(app).post('/api/almoxarifado')).send({ codigo: 'MOTOR', descricao: 'Motor', quantidade_atual: 10 })
    await m(request(app).post('/api/almoxarifado')).send({ codigo: 'GRAXA', descricao: 'Graxa', quantidade_atual: 5 })
  })
  const auth = r => r.set('Authorization', `Bearer ${token}`)

  it('GAP 1 — recall de qualidade: PPAP rejeitado após a liberação PARA a produção', async () => {
    await aprovarPPAP(auth, motorId)
    // graxa também precisa de PPAP para liberar
    const graxaId = (await auth(request(app).get('/api/mm/materiais'))).body.data.find(m => m.part_number === 'GRAXA').id
    await aprovarPPAP(auth, graxaId)
    opId = (await auth(request(app).post('/api/pp/ordens')).send({ veiculos_plan: 6 })).body.data.id
    expect((await auth(request(app).post(`/api/pp/ordens/${opId}/liberar`)).send({})).status).toBe(200)
    // aponta 2 normalmente (consome 2 motores + 1 kg de graxa)
    const ap1 = await auth(request(app).post(`/api/pp/ordens/${opId}/apontar`)).send({ veiculos: 2 })
    expect(ap1.status).toBe(200)
    expect(ap1.body.data.consumo.find(c => c.part_number === 'GRAXA').quantidade).toBe(1) // 0.5 × 2
    // RECALL: nova submissão de PPAP do motor decidida SEM os pilares → Rejeitado vira o vigente
    const ruim = (await auth(request(app).post(`/api/mm/materiais/${motorId}/ppap`)).send({ nivel: 3 })).body.data.id
    await auth(request(app).post(`/api/mm/ppap/${ruim}/decidir`)).send({})
    const ap2 = await auth(request(app).post(`/api/pp/ordens/${opId}/apontar`)).send({ veiculos: 1 })
    expect(ap2.status).toBe(409) // antes: 200 — montava peça reprovada
    expect(ap2.body.error).toMatch(/recall|qualidade/i)
    // resolve o recall (PPAP bom de novo) e a produção volta
    await aprovarPPAP(auth, motorId)
    expect((await auth(request(app).post(`/api/pp/ordens/${opId}/apontar`)).send({ veiculos: 1 })).status).toBe(200)
  })

  it('consumo fracionário baixa o saldo corretamente', async () => {
    // 3 veículos apontados até aqui → graxa 5 − 1.5 = 3.5
    const itens = (await auth(request(app).get('/api/almoxarifado'))).body.data
    expect(itens.find(i => i.codigo === 'GRAXA').quantidade_atual).toBe(3.5)
  })

  it('GAP 2 — cancelar congela a ordem; apontar depois é 409; não cancela duas vezes', async () => {
    const r = await auth(request(app).post(`/api/pp/ordens/${opId}/cancelar`)).send({ motivo: 'Mudança de plano' })
    expect(r.status).toBe(200)
    expect(r.body.data.status).toBe('Cancelada')
    const ap = await auth(request(app).post(`/api/pp/ordens/${opId}/apontar`)).send({ veiculos: 1 })
    expect(ap.status).toBe(409)
    const again = await auth(request(app).post(`/api/pp/ordens/${opId}/cancelar`)).send({})
    expect(again.status).toBe(409)
  })

  it('ordem Concluída não pode ser cancelada (409)', async () => {
    const op2 = (await auth(request(app).post('/api/pp/ordens')).send({ veiculos_plan: 1 })).body.data.id
    await auth(request(app).post(`/api/pp/ordens/${op2}/liberar`)).send({})
    await auth(request(app).post(`/api/pp/ordens/${op2}/apontar`)).send({ veiculos: 1 })
    const r = await auth(request(app).post(`/api/pp/ordens/${op2}/cancelar`)).send({})
    expect(r.status).toBe(409)
  })
})

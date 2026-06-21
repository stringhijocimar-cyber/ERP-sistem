// ============================================================
// Testes — OS completa: concluir lança custo realizado na linha WBS
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
let request, app, db, token

beforeAll(async () => {
  const st = await import('supertest')
  request = st.default
  ;({ app, db } = await import('../server.js'))
  token = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token
})

const auth = r => r.set('Authorization', `Bearer ${token}`)

// Cria contrato (id sintético) + linha WBS + OS vinculada.
async function cenario(custoEst) {
  const wbs = (await auth(request(app).post('/api/wbs')).send({ codigo: '1.1', descricao: 'MOD', contrato_id: 'CT-A', valor_total_est: custoEst })).body.data
  const os = (await auth(request(app).post('/api/os')).send({ titulo: 'Serviço', contrato_id: 'CT-A', wbs: '1.1', wbs_linha_id: wbs.id, tipo_recurso: 'mao_obra' })).body.data
  return { wbs, os }
}
const concluir = (id, custo) => auth(request(app).post(`/api/os/${id}/concluir`)).send({ custo_realizado: custo })

describe('OS — conclusão e lançamento de custo na WBS', () => {
  it('concluir lança o custo realizado na linha WBS (custo_real)', async () => {
    const { wbs, os } = await cenario(10000)
    const r = await concluir(os.id, 8500)
    expect(r.status).toBe(200)
    expect(r.body.data.os.status).toBe('Concluída')
    expect(r.body.data.wbs_linha.custo_real).toBe(8500)
    expect(r.body.data.wbs_linha.valor_total_est).toBe(10000) // estimado preservado
  })

  it('acumula custo de várias OS na mesma linha WBS', async () => {
    const wbs = (await auth(request(app).post('/api/wbs')).send({ codigo: '2.1', descricao: 'Acumula', contrato_id: 'CT-B', valor_total_est: 0 })).body.data
    const os1 = (await auth(request(app).post('/api/os')).send({ titulo: 'A', contrato_id: 'CT-B', wbs: '2.1', wbs_linha_id: wbs.id })).body.data
    const os2 = (await auth(request(app).post('/api/os')).send({ titulo: 'B', contrato_id: 'CT-B', wbs: '2.1', wbs_linha_id: wbs.id })).body.data
    await concluir(os1.id, 1000)
    await concluir(os2.id, 1500)
    const linha = db.prepare(`SELECT custo_real FROM wbs_linhas WHERE id=?`).get(wbs.id)
    expect(linha.custo_real).toBe(2500)
  })

  it('não conclui duas vezes (409)', async () => {
    const { os } = await cenario(100)
    await concluir(os.id, 50)
    const r = await concluir(os.id, 50)
    expect(r.status).toBe(409)
  })

  it('a OS concluída aparece na listagem do servidor (GET /api/os)', async () => {
    const { os } = await cenario(100)
    await concluir(os.id, 50)
    const lista = await auth(request(app).get('/api/os'))
    const found = lista.body.data.find(o => o.id === os.id)
    expect(found.status).toBe('Concluída')
  })
})

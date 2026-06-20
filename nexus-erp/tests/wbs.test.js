// ============================================================
// Testes — WBS como entidade no backend (Fatia A1)
// CRUD + filtro por contrato/projeto + validador de pertencimento.
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
let request, app, token

beforeAll(async () => {
  const st = await import('supertest')
  request = st.default
  ;({ app } = await import('../server.js'))
  token = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token
})

const auth = r => r.set('Authorization', `Bearer ${token}`)
const novaWBS = body => auth(request(app).post('/api/wbs')).send(body)

describe('WBS — CRUD e vínculo a contrato', () => {
  it('cria linha calculando o total (qtd × unitário)', async () => {
    const r = await novaWBS({ codigo: '1.1', descricao: 'Mão de obra', natureza: 'MOD', contrato_id: 10, projeto_id: 5, quantidade: 100, valor_unit_est: 25 })
    expect(r.status).toBe(201)
    expect(r.body.data.valor_total_est).toBe(2500)
    expect(r.body.data.contrato_id).toBe(10)
    expect(r.body.data.ativo).toBe(1)
  })

  it('filtra por contrato', async () => {
    await novaWBS({ codigo: '2.1', descricao: 'Material', contrato_id: 20 })
    const r10 = await auth(request(app).get('/api/wbs?contrato_id=10'))
    const r20 = await auth(request(app).get('/api/wbs?contrato_id=20'))
    expect(r10.body.data.every(l => l.contrato_id === 10)).toBe(true)
    expect(r20.body.data.some(l => l.codigo === '2.1')).toBe(true)
    expect(r20.body.data.some(l => l.codigo === '1.1')).toBe(false)
  })

  it('atualiza e recalcula o total', async () => {
    const id = (await novaWBS({ codigo: '3.1', descricao: 'Equip', contrato_id: 30, quantidade: 2, valor_unit_est: 100 })).body.data.id
    const r = await auth(request(app).put(`/api/wbs/${id}`)).send({ quantidade: 5 })
    expect(r.body.data.valor_total_est).toBe(500)
  })

  it('exclusão é lógica (ativo=0) e some da listagem padrão', async () => {
    const id = (await novaWBS({ codigo: '4.1', descricao: 'Temp', contrato_id: 40 })).body.data.id
    await auth(request(app).delete(`/api/wbs/${id}`))
    const ativos = await auth(request(app).get('/api/wbs?contrato_id=40'))
    expect(ativos.body.data.some(l => l.id === id)).toBe(false)
    const todos = await auth(request(app).get('/api/wbs?contrato_id=40&ativo=todos'))
    expect(todos.body.data.some(l => l.id === id)).toBe(true)
  })

  it('overhead: linha com centro de custo e sem contrato', async () => {
    const r = await novaWBS({ descricao: 'Administrativo', centro_custo: 'ADM', origem: 'overhead' })
    expect(r.status).toBe(201)
    expect(r.body.data.centro_custo).toBe('ADM')
    expect(r.body.data.contrato_id).toBeNull()
  })
})

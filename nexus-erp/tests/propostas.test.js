// ============================================================
// Testes — C2: Orçamentação → Proposta (proposta exige estimativa do lead)
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
const novoLead = () => auth(request(app).post('/api/crm')).send({ titulo: 'Obra X', cliente: 'ACME', valor: 0, estagio: 'Qualificação' })
const criarWBS = leadId => auth(request(app).post('/api/wbs')).send({ descricao: 'Mobilização', lead_id: leadId, origem: 'orcamentacao', valor_total_est: 100000 })
const criarProposta = body => auth(request(app).post('/api/propostas')).send(body)

describe('Proposta — exige estimativa de custos do lead', () => {
  it('bloqueia proposta de lead SEM estimativa (409)', async () => {
    const leadId = (await novoLead()).body.data.id
    const r = await criarProposta({ lead_id: leadId, cliente: 'ACME', margem: 20 })
    expect(r.status).toBe(409)
    expect(r.body.error).toMatch(/estimativa|orçament/i)
  })

  it('bloqueia proposta de lead inexistente (409)', async () => {
    const r = await criarProposta({ lead_id: 999999, cliente: 'X' })
    expect(r.status).toBe(409)
  })

  it('cria proposta após estimativa e calcula valor (custo × margem)', async () => {
    const leadId = (await novoLead()).body.data.id
    await criarWBS(leadId) // estimativa 100.000
    const r = await criarProposta({ lead_id: leadId, margem: 20 })
    expect(r.status).toBe(201)
    expect(r.body.data.custo_estimado).toBe(100000)
    expect(r.body.data.valor_total).toBe(120000) // +20%
    expect(r.body.data.numero).toMatch(/^PROP-\d{4}-\d{3}$/)
  })

  it('marca a orçamentação do lead como concluída', async () => {
    const leadId = (await novoLead()).body.data.id
    await criarWBS(leadId)
    await criarProposta({ lead_id: leadId, margem: 0 })
    const f = db.prepare(`SELECT orcamentacao_status FROM crm_oportunidades WHERE id=?`).get(leadId)
    expect(f.orcamentacao_status).toBe('concluida')
  })

  it('lista as propostas do lead', async () => {
    const leadId = (await novoLead()).body.data.id
    await criarWBS(leadId)
    await criarProposta({ lead_id: leadId })
    const r = await auth(request(app).get(`/api/propostas?lead_id=${leadId}`))
    expect(r.body.data.length).toBe(1)
  })

  it('respeita um valor_total informado manualmente', async () => {
    const leadId = (await novoLead()).body.data.id
    await criarWBS(leadId)
    const r = await criarProposta({ lead_id: leadId, valor_total: 150000 })
    expect(r.body.data.valor_total).toBe(150000)
  })
})

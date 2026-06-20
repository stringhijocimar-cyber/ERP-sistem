// ============================================================
// Testes — C1: CRM → Orçamentação (gatilho ao passar de Qualificação + alerta)
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
let request, app, db, adminToken, orcToken

beforeAll(async () => {
  const st = await import('supertest')
  request = st.default
  ;({ app, db } = await import('../server.js'))
  adminToken = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token
  await request(app).post('/api/usuarios').set('Authorization', `Bearer ${adminToken}`)
    .send({ nome: 'Orc', email: 'orc@x.com', senha: 'Aa@12345', perfil: 'orcamentista' })
  orcToken = (await request(app).post('/api/auth/login').send({ email: 'orc@x.com', senha: 'Aa@12345' })).body?.data?.token
})

const auth = (tok, r) => r.set('Authorization', `Bearer ${tok}`)
const novoLead = estagio => auth(adminToken, request(app).post('/api/crm')).send({ titulo: 'Lead X', cliente: 'ACME', valor: 100000, estagio })
const mover = (id, estagio) => auth(adminToken, request(app).put(`/api/crm/${id}`)).send({ titulo: 'Lead X', cliente: 'ACME', valor: 100000, estagio })
const pendentes = () => auth(adminToken, request(app).get('/api/crm/orcamentacao?status=pendente'))

describe('CRM → Orçamentação', () => {
  it('Prospecção ainda não dispara orçamentação', async () => {
    const id = (await novoLead('Prospecção')).body.data.id
    const f = db.prepare(`SELECT orcamentacao_status FROM crm_oportunidades WHERE id=?`).get(id)
    expect(f.orcamentacao_status).toBe('nao_iniciada')
  })

  it('passar para Qualificação marca pendente e aparece na lista', async () => {
    const id = (await novoLead('Prospecção')).body.data.id
    await mover(id, 'Qualificação')
    const f = db.prepare(`SELECT orcamentacao_status FROM crm_oportunidades WHERE id=?`).get(id)
    expect(f.orcamentacao_status).toBe('pendente')
    const lista = await pendentes()
    expect(lista.body.data.some(l => l.id === id)).toBe(true)
  })

  it('alerta o orçamentista (notificação)', async () => {
    const id = (await novoLead('Prospecção')).body.data.id
    await mover(id, 'Negociação')
    const notifs = (await auth(orcToken, request(app).get('/api/notificacoes'))).body.data
    expect(notifs.some(n => n.tipo === 'orcamentacao' && n.ref_id === String(id))).toBe(true)
  })

  it('criar WBS vinculada ao lead marca a estimativa em andamento', async () => {
    const id = (await novoLead('Qualificação')).body.data.id // já nasce pendente? não — POST não dispara; PUT sim
    await mover(id, 'Qualificação')
    await auth(adminToken, request(app).post('/api/wbs')).send({ codigo: '1.1', descricao: 'Estimativa', lead_id: id, origem: 'orcamentacao' })
    const f = db.prepare(`SELECT orcamentacao_status FROM crm_oportunidades WHERE id=?`).get(id)
    expect(f.orcamentacao_status).toBe('em_andamento')
  })

  it('não re-dispara se já saiu de "nao_iniciada"', async () => {
    const id = (await novoLead('Prospecção')).body.data.id
    await mover(id, 'Qualificação')           // pendente
    await mover(id, 'Reunião Agendada')       // não deve voltar a disparar
    const f = db.prepare(`SELECT orcamentacao_status FROM crm_oportunidades WHERE id=?`).get(id)
    expect(f.orcamentacao_status).toBe('pendente')
  })
})

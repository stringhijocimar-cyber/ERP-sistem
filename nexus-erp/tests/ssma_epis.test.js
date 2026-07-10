// ============================================================
// Testes — SSMA fase 2: EPIs por colaborador (NR-6) com controle de validade.
// Lib pura (situação/alertas) + endpoints (validação de tenant no colaborador,
// isolamento cross-tenant, alertas de vencido/a vencer).
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'
import { classificarEpis, alertasEpi } from '../lib/epi.js'

describe('lib epi (pura)', () => {
  const hoje = '2026-07-10'
  const base = [
    { id: 1, epi: 'Capacete', validade: '2026-12-31' }, // Válido
    { id: 2, epi: 'Luva', validade: '2026-07-20' },     // A vencer (10 dias)
    { id: 3, epi: 'Bota', validade: '2026-06-01' },     // Vencido
    { id: 4, epi: 'Protetor', validade: '' },           // Sem validade
  ]
  it('classifica cada entrega pela validade', () => {
    const c = classificarEpis(base, hoje)
    expect(c.map(e => e.situacao)).toEqual(['Válido', 'A vencer', 'Vencido', 'Sem validade'])
  })
  it('alertas: só vencidos + a vencer, mais crítico (validade menor) primeiro', () => {
    const a = alertasEpi(base, hoje)
    expect(a.vencidos).toBe(1)
    expect(a.a_vencer).toBe(1)
    expect(a.total).toBe(2)
    expect(a.alertas[0].epi).toBe('Bota') // vencido antes (validade menor)
  })
  it('não quebra com lista vazia', () => {
    expect(alertasEpi([], hoje)).toEqual({ vencidos: 0, a_vencer: 0, total: 0, alertas: [] })
  })
})

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
let request, app, token, tokB, colabA

describe('endpoints — EPIs por colaborador', () => {
  beforeAll(async () => {
    const st = await import('supertest')
    request = st.default
    ;({ app } = await import('../server.js'))
    token = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token
    const m = r => r.set('Authorization', `Bearer ${token}`)
    // colaborador do tenant A
    colabA = (await m(request(app).post('/api/colaboradores')).send({ nome: 'João Operador', cargo: 'Operador', custo_hora: 50 })).body.data.id
    // tenant B
    const empB = (await m(request(app).post('/api/empresas')).send({ razao_social: 'Tenant B EPI' })).body.data.id
    await m(request(app).post('/api/usuarios')).send({ nome: 'AdmB', email: 'epi.b@x.com', senha: 'Aa@123456', perfil: 'admin', empresa_id: empB })
    tokB = (await request(app).post('/api/auth/login').send({ email: 'epi.b@x.com', senha: 'Aa@123456' })).body?.data?.token
  })
  const auth = r => r.set('Authorization', `Bearer ${token}`)

  it('registra entrega de EPI com situação calculada', async () => {
    const r = await auth(request(app).post('/api/ssma/epis'))
      .send({ colaborador_id: colabA, epi: 'Capacete classe B', ca: '31469', validade: '2030-01-01' })
    expect(r.status).toBe(201)
    expect(r.body.data.colaborador_nome).toBe('João Operador')
    expect(r.body.data.situacao).toBe('Válido')
  })

  it('rejeita EPI sem descrição (400)', async () => {
    const r = await auth(request(app).post('/api/ssma/epis')).send({ colaborador_id: colabA, epi: '  ' })
    expect(r.status).toBe(400)
  })

  it('rejeita quantidade zero/negativa (400)', async () => {
    const r = await auth(request(app).post('/api/ssma/epis')).send({ colaborador_id: colabA, epi: 'Luva', quantidade: 0 })
    expect(r.status).toBe(400)
  })

  it('BUG: não entrega EPI a colaborador de outro tenant (404)', async () => {
    const r = await request(app).post('/api/ssma/epis').set('Authorization', `Bearer ${tokB}`)
      .send({ colaborador_id: colabA, epi: 'Bota' })
    expect(r.status).toBe(404)
  })

  it('lista e filtra por situação; alertas trazem vencidos/a vencer', async () => {
    const ano = new Date().getFullYear()
    await auth(request(app).post('/api/ssma/epis')).send({ colaborador_id: colabA, epi: 'Bota vencida', validade: `${ano - 1}-01-01` })
    const lista = (await auth(request(app).get('/api/ssma/epis'))).body.data
    expect(lista.length).toBeGreaterThanOrEqual(2)
    const vencidos = (await auth(request(app).get('/api/ssma/epis?situacao=Vencido'))).body.data
    expect(vencidos.every(e => e.situacao === 'Vencido')).toBe(true)
    const al = (await auth(request(app).get('/api/ssma/epis/alertas'))).body.data
    expect(al.vencidos).toBeGreaterThanOrEqual(1)
  })

  it('isolamento: tenant B não vê EPIs do tenant A', async () => {
    const rB = await request(app).get('/api/ssma/epis').set('Authorization', `Bearer ${tokB}`)
    expect(rB.body.data.length).toBe(0)
  })
})

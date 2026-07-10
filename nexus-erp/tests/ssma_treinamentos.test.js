// ============================================================
// Testes — SSMA fase 3: matriz de treinamentos NR por colaborador com
// BLOQUEIO de atividade de risco vencida (NR-1 §1.7). Lib pura + endpoints
// (validação de tenant, isolamento, aptidão apto/bloqueado, alertas).
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'
import { classificarTreinamentos, aptidaoColaborador, alertasTreinamentos, bloqueiaRisco, normalizarNR } from '../lib/treinamentos.js'

describe('lib treinamentos (pura)', () => {
  const hoje = '2026-07-10'
  it('normaliza e identifica NRs de risco (tolerante a formato)', () => {
    expect(normalizarNR('nr35')).toBe('NR-35')
    expect(normalizarNR('NR 10')).toBe('NR-10')
    expect(bloqueiaRisco('nr-35')).toBe(true)
    expect(bloqueiaRisco('ASO')).toBe(true)
    expect(bloqueiaRisco('NR-05')).toBe(false) // CIPA não bloqueia atividade
  })
  it('classifica situação e marca bloqueante', () => {
    const c = classificarTreinamentos([{ tipo: 'NR-35', validade: '2026-06-01' }], hoje)
    expect(c[0].situacao).toBe('Vencido')
    expect(c[0].bloqueia_risco).toBe(true)
  })
  it('aptidão: NR de risco vencida bloqueia o colaborador', () => {
    const r = aptidaoColaborador([
      { tipo: 'NR-35', validade: '2026-06-01' }, // vencido → bloqueia
      { tipo: 'NR-10', validade: '2030-01-01' }, // válido
    ], hoje)
    expect(r.apto).toBe(false)
    expect(r.bloqueios).toEqual([{ tipo: 'NR-35', validade: '2026-06-01' }])
  })
  it('aptidão: NR não-crítica vencida NÃO bloqueia', () => {
    const r = aptidaoColaborador([{ tipo: 'NR-05', validade: '2020-01-01' }], hoje)
    expect(r.apto).toBe(true)
  })
  it('alertas contam vencidos, a vencer e bloqueantes; mais crítico primeiro', () => {
    const a = alertasTreinamentos([
      { tipo: 'NR-35', validade: '2026-06-01', colaborador_nome: 'A' }, // vencido bloqueante
      { tipo: 'NR-05', validade: '2026-07-20', colaborador_nome: 'B' }, // a vencer
      { tipo: 'ASO', validade: '2030-01-01', colaborador_nome: 'C' },   // válido (fora)
    ], hoje)
    expect(a.vencidos).toBe(1)
    expect(a.a_vencer).toBe(1)
    expect(a.bloqueantes).toBe(1)
    expect(a.total).toBe(2)
    expect(a.alertas[0].tipo).toBe('NR-35') // validade menor primeiro
  })
})

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
let request, app, token, tokB, colabA

describe('endpoints — treinamentos/matriz NR', () => {
  beforeAll(async () => {
    const st = await import('supertest')
    request = st.default
    ;({ app } = await import('../server.js'))
    token = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token
    const m = r => r.set('Authorization', `Bearer ${token}`)
    colabA = (await m(request(app).post('/api/colaboradores')).send({ nome: 'Maria Altura', cargo: 'Montadora', custo_hora: 60 })).body.data.id
    const empB = (await m(request(app).post('/api/empresas')).send({ razao_social: 'Tenant B Trein' })).body.data.id
    await m(request(app).post('/api/usuarios')).send({ nome: 'AdmB', email: 'trein.b@x.com', senha: 'Aa@123456', perfil: 'admin', empresa_id: empB })
    tokB = (await request(app).post('/api/auth/login').send({ email: 'trein.b@x.com', senha: 'Aa@123456' })).body?.data?.token
  })
  const auth = r => r.set('Authorization', `Bearer ${token}`)

  it('registra treinamento com situação e bloqueio', async () => {
    const r = await auth(request(app).post('/api/ssma/treinamentos'))
      .send({ colaborador_id: colabA, tipo: 'NR-35', validade: '2030-01-01', carga_horaria: 8 })
    expect(r.status).toBe(201)
    expect(r.body.data.colaborador_nome).toBe('Maria Altura')
    expect(r.body.data.situacao).toBe('Válido')
    expect(r.body.data.bloqueia_risco).toBe(true)
  })

  it('rejeita treinamento sem tipo (400)', async () => {
    const r = await auth(request(app).post('/api/ssma/treinamentos')).send({ colaborador_id: colabA, tipo: '  ' })
    expect(r.status).toBe(400)
  })

  it('BUG: não registra treinamento p/ colaborador de outro tenant (404)', async () => {
    const r = await request(app).post('/api/ssma/treinamentos').set('Authorization', `Bearer ${tokB}`)
      .send({ colaborador_id: colabA, tipo: 'NR-10' })
    expect(r.status).toBe(404)
  })

  it('aptidão: colaborador com NR-35 vencida fica bloqueado', async () => {
    const ano = new Date().getFullYear()
    await auth(request(app).post('/api/ssma/treinamentos')).send({ colaborador_id: colabA, tipo: 'NR-10', validade: `${ano - 1}-01-01` })
    const r = await auth(request(app).get(`/api/ssma/colaboradores/${colabA}/aptidao`))
    expect(r.status).toBe(200)
    expect(r.body.data.apto).toBe(false)
    expect(r.body.data.bloqueios.some(b => b.tipo === 'NR-10')).toBe(true)
  })

  it('aptidão de colaborador de outro tenant → 404', async () => {
    const r = await request(app).get(`/api/ssma/colaboradores/${colabA}/aptidao`).set('Authorization', `Bearer ${tokB}`)
    expect(r.status).toBe(404)
  })

  it('lista/alertas isolados por tenant; filtro por situação', async () => {
    const lista = (await auth(request(app).get('/api/ssma/treinamentos'))).body.data
    expect(lista.length).toBeGreaterThanOrEqual(2)
    const venc = (await auth(request(app).get('/api/ssma/treinamentos?situacao=Vencido'))).body.data
    expect(venc.every(t => t.situacao === 'Vencido')).toBe(true)
    const al = (await auth(request(app).get('/api/ssma/treinamentos/alertas'))).body.data
    expect(al.bloqueantes).toBeGreaterThanOrEqual(1)
    const rB = await request(app).get('/api/ssma/treinamentos').set('Authorization', `Bearer ${tokB}`)
    expect(rB.body.data.length).toBe(0)
  })
})

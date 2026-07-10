// ============================================================
// Testes — SSMA first-class: isolamento por tenant (bug real fechado) +
// indicadores HSE (TF/TG NBR-14280, dias sem acidente).
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'
import { calcularIndicadoresSSMA, diasSemAcidente } from '../lib/ssma_indicadores.js'

describe('lib ssma_indicadores (pura)', () => {
  it('TF/TG normalizados por 1e6 HHT; sem afastamento não conta', () => {
    const r = calcularIndicadoresSSMA([
      { gravidade: 'Alta', com_afastamento: 1, dias_perdidos: 15, data_ocorrencia: '2026-05-10' },
      { gravidade: 'Baixa', com_afastamento: 0, dias_perdidos: 0, data_ocorrencia: '2026-05-12' },
      { gravidade: 'Média', com_afastamento: 1, dias_perdidos: 5, data_ocorrencia: '2026-06-01' },
    ], 1_000_000, '2026-07-01')
    expect(r.total).toBe(3)
    expect(r.com_afastamento).toBe(2)
    expect(r.dias_perdidos).toBe(20)
    expect(r.tf).toBe(2)   // 2 acidentes × 1e6 / 1e6
    expect(r.tg).toBe(20)  // 20 dias × 1e6 / 1e6
    expect(r.ultimo_acidente).toBe('2026-06-01')
    expect(r.dias_sem_acidente).toBe(30) // 06-01 → 07-01
  })
  it('sem HHT → TF/TG null (não inventa denominador)', () => {
    const r = calcularIndicadoresSSMA([{ com_afastamento: 1, dias_perdidos: 3, data_ocorrencia: '2026-05-10' }], 0, '2026-05-20')
    expect(r.tf).toBeNull()
    expect(r.tg).toBeNull()
  })
  it('diasSemAcidente null quando nunca houve', () => {
    expect(diasSemAcidente(null, '2026-05-01')).toBeNull()
  })
})

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
let request, app, db, token, tokB, ocA

describe('endpoints — isolamento + indicadores', () => {
  beforeAll(async () => {
    const st = await import('supertest')
    request = st.default
    ;({ app, db } = await import('../server.js'))
    token = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token
    const m = r => r.set('Authorization', `Bearer ${token}`)
    const empB = (await m(request(app).post('/api/empresas')).send({ razao_social: 'Tenant B' })).body.data.id
    await m(request(app).post('/api/usuarios')).send({ nome: 'AdmB', email: 'ssma.b@x.com', senha: 'Aa@123456', perfil: 'admin', empresa_id: empB })
    tokB = (await request(app).post('/api/auth/login').send({ email: 'ssma.b@x.com', senha: 'Aa@123456' })).body?.data?.token

    const ano = new Date().getFullYear()
    ocA = (await m(request(app).post('/api/ssma')).send({ tipo: 'Acidente', gravidade: 'Alta', com_afastamento: true, dias_perdidos: 10, data_ocorrencia: `${ano}-05-10`, descricao: 'Queda' })).body.data.id
    await m(request(app).post('/api/ssma')).send({ tipo: 'Quase acidente', gravidade: 'Baixa', data_ocorrencia: `${ano}-05-12` })
  })
  const auth = r => r.set('Authorization', `Bearer ${token}`)

  it('BUG FECHADO: tenant B NÃO vê as ocorrências do tenant A', async () => {
    const rA = await auth(request(app).get('/api/ssma'))
    expect(rA.body.data.length).toBe(2)
    const rB = await request(app).get('/api/ssma').set('Authorization', `Bearer ${tokB}`)
    expect(rB.body.data.length).toBe(0) // antes vazava TODAS as ocorrências
  })
  it('tenant B não edita ocorrência de A (404)', async () => {
    const r = await request(app).put(`/api/ssma/${ocA}`).set('Authorization', `Bearer ${tokB}`).send({ gravidade: 'Baixa' })
    expect(r.status).toBe(404)
  })
  it('indicadores: TF/TG com HHT informado + dias sem acidente', async () => {
    const d = (await auth(request(app).get('/api/ssma/indicadores?hht=500000'))).body.data
    expect(d.com_afastamento).toBe(1)
    expect(d.tf).toBe(2) // 1 × 1e6 / 500000
    expect(d.tg).toBe(20) // 10 × 1e6 / 500000
    expect(d.por_gravidade.length).toBeGreaterThanOrEqual(2)
  })
  it('indicadores do tenant B são zerados', async () => {
    const d = (await request(app).get('/api/ssma/indicadores?hht=500000').set('Authorization', `Bearer ${tokB}`)).body.data
    expect(d.total).toBe(0)
    expect(d.tf).toBe(0)
  })
})

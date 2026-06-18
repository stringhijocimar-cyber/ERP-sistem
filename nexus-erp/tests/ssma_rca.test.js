// ============================================================
// Testes de integração — SSMA: RCA obrigatório p/ encerrar (Onda 1)
// Encerrar incidente exige causa raiz + plano de ação → reduz reincidência.
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
const novaOcorrencia = () => auth(request(app).post('/api/ssma')).send({ tipo: 'Quase-acidente', descricao: 'Queda de objeto', gravidade: 'Alta' })

describe('SSMA — RCA obrigatório para encerrar', () => {
  it('bloqueia encerramento sem RCA (400)', async () => {
    const id = (await novaOcorrencia()).body.data.id
    const r = await auth(request(app).post(`/api/ssma/${id}/encerrar`)).send({})
    expect(r.status).toBe(400)
    expect(r.body.error).toMatch(/causa raiz|rca/i)
  })

  it('bloqueia se só a causa raiz for informada (sem plano de ação)', async () => {
    const id = (await novaOcorrencia()).body.data.id
    const r = await auth(request(app).post(`/api/ssma/${id}/encerrar`)).send({ causa_raiz: 'Falha de fixação' })
    expect(r.status).toBe(400)
  })

  it('encerra quando causa raiz + plano de ação são informados', async () => {
    const id = (await novaOcorrencia()).body.data.id
    const r = await auth(request(app).post(`/api/ssma/${id}/encerrar`))
      .send({ causa_raiz: 'Falha de fixação do guincho', plano_acao: 'Revisar checklist e treinar equipe' })
    expect(r.status).toBe(200)
    expect(r.body.data.status).toBe('Encerrada')
    expect(r.body.data.data_resolucao).toBeTruthy()
  })

  it('aceita RCA preenchida via PUT antes do encerramento', async () => {
    const id = (await novaOcorrencia()).body.data.id
    await auth(request(app).put(`/api/ssma/${id}`)).send({ causa_raiz: 'Piso escorregadio', plano_acao: 'Sinalização + revestimento antiderrapante' })
    const r = await auth(request(app).post(`/api/ssma/${id}/encerrar`)).send({})
    expect(r.status).toBe(200)
    expect(r.body.data.status).toBe('Encerrada')
  })

  it('não encerra duas vezes (409)', async () => {
    const id = (await novaOcorrencia()).body.data.id
    await auth(request(app).post(`/api/ssma/${id}/encerrar`)).send({ causa_raiz: 'x', plano_acao: 'y' })
    const r = await auth(request(app).post(`/api/ssma/${id}/encerrar`)).send({ causa_raiz: 'x', plano_acao: 'y' })
    expect(r.status).toBe(409)
  })
})

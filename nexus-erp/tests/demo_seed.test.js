// ============================================================
// Testes — Modo demo comercial (/api/demo/seed).
// Prova que o cenário semeado materializa os 4 momentos de valor,
// é idempotente por empresa e 100% isolado por tenant.
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
let request, app, token, tokenB

beforeAll(async () => {
  const st = await import('supertest')
  request = st.default
  ;({ app } = await import('../server.js'))
  token = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token
  const m = r => r.set('Authorization', `Bearer ${token}`)
  const empB = (await m(request(app).post('/api/empresas')).send({ razao_social: 'Tenant B' })).body.data.id
  await m(request(app).post('/api/usuarios')).send({ nome: 'Admin B', email: 'demob@x.com', senha: 'Aa@123456', perfil: 'admin', empresa_id: empB })
  tokenB = (await request(app).post('/api/auth/login').send({ email: 'demob@x.com', senha: 'Aa@123456' })).body?.data?.token
  // Semeia o tenant A (mestre).
  await m(request(app).post('/api/demo/seed')).send({})
})

const auth = r => r.set('Authorization', `Bearer ${token}`)

describe('demo/seed — os 4 momentos de valor', () => {
  it('retorna o roteiro de 4 passos', async () => {
    const r = await auth(request(app).post('/api/demo/seed')).send({})
    expect(r.body.data.roteiro.length).toBe(4)
    expect(r.body.data.ja_existia).toBe(true) // idempotente na 2ª chamada
  })

  it('momento 1: conta a pagar sem NF é bloqueada no gate (409)', async () => {
    const contas = (await auth(request(app).get('/api/contas-pagar'))).body.data
    const semNF = contas.find(c => /aguardando NF/i.test(c.descricao || ''))
    expect(semNF).toBeTruthy()
    const r = await auth(request(app).post(`/api/contas-pagar/${semNF.id}/pagar`)).send({})
    expect(r.status).toBe(409)
    expect(r.body.error).toMatch(/nota fiscal/i)
  })

  it('momento 2: fracionamento aparece na central de alertas', async () => {
    const r = await auth(request(app).get('/api/alertas'))
    expect(r.body.data.alertas.some(a => a.tipo === 'anomalia_fracionamento')).toBe(true)
  })

  it('momento 3: lead em orçamentação pendente', async () => {
    const r = await auth(request(app).get('/api/crm/orcamentacao?status=pendente'))
    expect(r.body.data.some(l => /Serra Azul/i.test(l.titulo))).toBe(true)
  })

  it('momento 4: custo realizado lançado na linha WBS do contrato', async () => {
    const r = await auth(request(app).get('/api/wbs?ativo=todos'))
    const linha = r.body.data.find(w => w.codigo === '1.1' && Number(w.custo_real) > 0)
    expect(linha).toBeTruthy()
    expect(Number(linha.custo_real)).toBe(48000)
  })
})

describe('demo/seed — isolamento e idempotência', () => {
  it('idempotente: não duplica o contrato demo na 2ª execução', async () => {
    await auth(request(app).post('/api/demo/seed')).send({})
    const contratos = (await auth(request(app).get('/api/contratos'))).body.data
    expect(contratos.filter(c => c.objeto === 'DEMO').length).toBe(1)
  })

  it('tenant B não vê nada do cenário demo do tenant A', async () => {
    const asB = r => r.set('Authorization', `Bearer ${tokenB}`)
    expect((await asB(request(app).get('/api/contratos'))).body.data.length).toBe(0)
    expect((await asB(request(app).get('/api/alertas'))).body.data.alertas.some(a => String(a.tipo).startsWith('anomalia_'))).toBe(false)
  })

  it('só admin pode semear (perfil comum → 403)', async () => {
    await auth(request(app).post('/api/usuarios')).send({ nome: 'Op', email: 'op.demo@x.com', senha: 'Aa@123456', perfil: 'operacao' })
    const opTok = (await request(app).post('/api/auth/login').send({ email: 'op.demo@x.com', senha: 'Aa@123456' })).body.data.token
    const r = await request(app).post('/api/demo/seed').set('Authorization', `Bearer ${opTok}`).send({})
    expect(r.status).toBe(403)
  })
})

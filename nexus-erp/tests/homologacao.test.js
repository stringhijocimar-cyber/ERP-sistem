// ============================================================
// Testes — Gate de homologação de fornecedor (Financeiro + Compliance)
// Fornecedor só pode ser usado em PC após aprovação das duas funções.
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
let request, app, db, adminToken, finToken, compToken

beforeAll(async () => {
  const st = await import('supertest')
  request = st.default
  ;({ app, db } = await import('../server.js'))
  adminToken = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token
  const mk = (nome, email, perfil) => request(app).post('/api/usuarios').set('Authorization', `Bearer ${adminToken}`).send({ nome, email, senha: 'Aa@123456', perfil })
  await mk('Fin H', 'fin.h@x.com', 'financeiro')
  await mk('Comp H', 'comp.h@x.com', 'compliance')
  finToken = (await request(app).post('/api/auth/login').send({ email: 'fin.h@x.com', senha: 'Aa@123456' })).body?.data?.token
  compToken = (await request(app).post('/api/auth/login').send({ email: 'comp.h@x.com', senha: 'Aa@123456' })).body?.data?.token
})

let seq = 0
const novoForn = () => request(app).post('/api/fornecedores').set('Authorization', `Bearer ${adminToken}`).send({ nome: `Forn H ${++seq}` })
const emitirPC = fid => request(app).post('/api/pedidos').set('Authorization', `Bearer ${adminToken}`).send({ fornecedor_id: fid, valor_total: 1000 })
const aprovFin = fid => request(app).post(`/api/fornecedores/${fid}/homologar/financeiro`).set('Authorization', `Bearer ${finToken}`).send({})
const aprovComp = fid => request(app).post(`/api/fornecedores/${fid}/homologar/compliance`).set('Authorization', `Bearer ${compToken}`).send({})

describe('Homologação de fornecedor', () => {
  it('fornecedor novo nasce "Em Homologação"', async () => {
    const r = await novoForn()
    expect(r.body.data.status).toBe('Em Homologação')
  })

  it('bloqueia emissão de PC para fornecedor não homologado (409)', async () => {
    const fid = (await novoForn()).body.data.id
    const r = await emitirPC(fid)
    expect(r.status).toBe(409)
    expect(r.body.error).toMatch(/homologad/i)
  })

  it('só Financeiro aprovou: ainda bloqueado', async () => {
    const fid = (await novoForn()).body.data.id
    await aprovFin(fid)
    const f = db.prepare(`SELECT * FROM fornecedores WHERE id=?`).get(fid)
    expect(f.status).toBe('Em Homologação')
    expect((await emitirPC(fid)).status).toBe(409)
  })

  it('Financeiro + Compliance → Homologado e PC liberada', async () => {
    const fid = (await novoForn()).body.data.id
    await aprovFin(fid)
    const r = await aprovComp(fid)
    expect(r.body.data.status).toBe('Homologado')
    expect((await emitirPC(fid)).status).toBe(201)
  })

  it('perfil sem papel não pode aprovar etapa Financeiro (403)', async () => {
    const fid = (await novoForn()).body.data.id
    const r = await request(app).post(`/api/fornecedores/${fid}/homologar/financeiro`).set('Authorization', `Bearer ${compToken}`).send({})
    expect(r.status).toBe(403)
  })

  it('reprovar limpa as aprovações e marca Reprovado', async () => {
    const fid = (await novoForn()).body.data.id
    await aprovFin(fid)
    const r = await request(app).post(`/api/fornecedores/${fid}/reprovar-homologacao`).set('Authorization', `Bearer ${compToken}`).send({ motivo: 'pendências fiscais' })
    expect(r.body.data.status).toBe('Reprovado')
    expect(r.body.data.aprovado_financeiro_por).toBeNull()
  })
})

// ============================================================
// Testes — os 2 elos do faturamento:
//  ELO 1: gerar conta a receber a partir de medição aprovada
//         (idempotente por medicao_id).
//  ELO 2: emitir NFS-e a partir da conta (liga faturamento ao fiscal;
//         emitente = CNPJ da empresa, tomador = cliente). Mock autoriza
//         na hora; a NF é vinculada e a conta vai para "A Receber".
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'
// provider mock (default) — autoriza a NFS-e determinística sem rede.

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
let request, app, db, token, tokenB, empBId

beforeAll(async () => {
  const st = await import('supertest')
  request = st.default
  ;({ app, db } = await import('../server.js'))
  token = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token
  const m = r => r.set('Authorization', `Bearer ${token}`)
  empBId = (await m(request(app).post('/api/empresas')).send({ razao_social: 'Tenant B', cnpj: '11.444.777/0001-61' })).body.data.id
  await m(request(app).post('/api/usuarios')).send({ nome: 'Admin B', email: 'elo.b@x.com', senha: 'Aa@123456', perfil: 'admin', empresa_id: empBId })
  tokenB = (await request(app).post('/api/auth/login').send({ email: 'elo.b@x.com', senha: 'Aa@123456' })).body?.data?.token
  // Dá um CNPJ à empresa mestre (emitente da NFS-e).
  db.prepare(`UPDATE empresas SET cnpj='11.222.333/0001-81' WHERE id=1`).run()
})

const auth = r => r.set('Authorization', `Bearer ${token}`)
const asB = r => r.set('Authorization', `Bearer ${tokenB}`)

describe('ELO 1 — conta a receber a partir de medição', () => {
  it('cria a conta com status A Faturar, vinculada à medição', async () => {
    const r = await auth(request(app).post('/api/contas-receber/de-medicao')).send({ medicao_id: 501, contrato_id: 'CT-9', cliente: 'Minera Serra Azul', valor: 180000, data_vencimento: '2026-09-30' })
    expect(r.status).toBe(201)
    expect(r.body.data.status).toBe('A Faturar')
    expect(r.body.data.medicao_id).toBe(501)
    expect(r.body.data.numero).toMatch(/^CR-\d{4}-\d{3}$/)
  })

  it('é idempotente: rechamar a mesma medição não duplica', async () => {
    const r = await auth(request(app).post('/api/contas-receber/de-medicao')).send({ medicao_id: 501, cliente: 'X', valor: 180000 })
    expect(r.body.data.ja_existia).toBe(true)
    const todas = (await auth(request(app).get('/api/contas-receber'))).body.data.filter(c => c.medicao_id === 501)
    expect(todas.length).toBe(1)
  })

  it('valida medicao_id e valor', async () => {
    expect((await auth(request(app).post('/api/contas-receber/de-medicao')).send({ valor: 100 })).status).toBe(400)
    expect((await auth(request(app).post('/api/contas-receber/de-medicao')).send({ medicao_id: 9, valor: 0 })).status).toBe(400)
  })
})

describe('ELO 2 — NFS-e a partir da conta a receber', () => {
  let contaId
  beforeAll(async () => {
    contaId = (await auth(request(app).post('/api/contas-receber')).send({ cliente: 'ACME Serviços', valor: 50000, data_vencimento: '2026-10-10' })).body.data.id
  })

  it('emite a NFS-e (mock autoriza), vincula a NF e coloca em A Receber', async () => {
    const r = await auth(request(app).post(`/api/contas-receber/${contaId}/emitir-nfse`)).send({ cnpj_destinatario: '11.444.777/0001-61' })
    expect(r.status).toBe(201)
    expect(r.body.data.nota.tipo).toBe('nfse')
    expect(r.body.data.nota.status).toBe('autorizada')
    expect(r.body.data.nota.cnpj_emitente).toBe('11.222.333/0001-81') // CNPJ da empresa
    expect(r.body.data.conta.nota_fiscal).toBeTruthy()
    expect(r.body.data.conta.status).toBe('A Receber')
  })

  it('a NFS-e aparece na lista de notas do tenant', async () => {
    const notas = (await auth(request(app).get('/api/nfe'))).body.data
    expect(notas.some(n => n.tipo === 'nfse' && n.destinatario === '11.444.777/0001-61')).toBe(true)
  })

  it('não fatura duas vezes a mesma conta (409)', async () => {
    const r = await auth(request(app).post(`/api/contas-receber/${contaId}/emitir-nfse`)).send({ cnpj_destinatario: '11.444.777/0001-61' })
    expect(r.status).toBe(409)
  })

  it('rejeita sem documento do destinatário (422 da validação fiscal)', async () => {
    const outra = (await auth(request(app).post('/api/contas-receber')).send({ cliente: 'Sem Doc', valor: 100 })).body.data.id
    const r = await auth(request(app).post(`/api/contas-receber/${outra}/emitir-nfse`)).send({})
    expect(r.status).toBe(422)
  })
})

describe('Isolamento dos elos', () => {
  it('tenant B não emite NFS-e sobre conta de A (404)', async () => {
    const idA = (await auth(request(app).post('/api/contas-receber')).send({ cliente: 'A', valor: 10 })).body.data.id
    const r = await asB(request(app).post(`/api/contas-receber/${idA}/emitir-nfse`)).send({ cnpj_destinatario: '11.444.777/0001-61' })
    expect(r.status).toBe(404)
  })
})

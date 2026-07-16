// ============================================================
// Testes — WMS: endereçamento físico do estoque + separação (picking).
// Lib pura (saldos, validação, picking, ocupação) + endpoints (endereço,
// alocação sem exceder saldo, movimentação, posição, picking, isolamento).
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'
import { saldoEnderecado, saldoNaoEnderecado, validarAlocacao, sugerirPicking, ocupacaoEndereco } from '../lib/wms.js'

describe('lib wms (pura)', () => {
  const aloc = [{ endereco_id: 1, endereco_codigo: 'A-01', quantidade: 30 }, { endereco_id: 2, endereco_codigo: 'A-02', quantidade: 20 }]
  it('saldos endereçado / não endereçado', () => {
    expect(saldoEnderecado(aloc)).toBe(50)
    expect(saldoNaoEnderecado(80, aloc)).toBe(30)
  })
  it('validarAlocacao respeita o saldo não endereçado', () => {
    expect(validarAlocacao(80, aloc, 30).ok).toBe(true)
    expect(validarAlocacao(80, aloc, 31).ok).toBe(false) // só 30 livres
    expect(validarAlocacao(80, aloc, 0).ok).toBe(false)
  })
  it('picking esvazia o maior bin primeiro e reporta faltante', () => {
    const p = sugerirPicking(aloc, 40)
    expect(p.ok).toBe(true)
    expect(p.retiradas[0]).toEqual({ endereco_id: 1, codigo: 'A-01', quantidade: 30 })
    expect(p.retiradas[1]).toEqual({ endereco_id: 2, codigo: 'A-02', quantidade: 10 })
    const falta = sugerirPicking(aloc, 60)
    expect(falta.ok).toBe(false)
    expect(falta.faltante).toBe(10)
  })
  it('ocupacaoEndereco calcula % e cheio', () => {
    expect(ocupacaoEndereco(50, aloc)).toEqual({ usado: 50, capacidade: 50, ocupacao_pct: 100, cheio: true })
    expect(ocupacaoEndereco(0, aloc).ocupacao_pct).toBeNull()
  })
})

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
let request, app, token, tokB, itemId, endA, endB

describe('endpoints — WMS', () => {
  beforeAll(async () => {
    const st = await import('supertest')
    request = st.default
    ;({ app } = await import('../server.js'))
    token = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token
    const m = r => r.set('Authorization', `Bearer ${token}`)
    itemId = (await m(request(app).post('/api/almoxarifado')).send({ codigo: 'MOTOR', descricao: 'Motor', quantidade_atual: 80 })).body.data.id
    endA = (await m(request(app).post('/api/wms/enderecos')).send({ codigo: 'A-01', zona: 'Recebimento', capacidade: 50 })).body.data.id
    endB = (await m(request(app).post('/api/wms/enderecos')).send({ codigo: 'A-02', zona: 'Picking', capacidade: 40 })).body.data.id
    const empB = (await m(request(app).post('/api/empresas')).send({ razao_social: 'Tenant B WMS' })).body.data.id
    await m(request(app).post('/api/usuarios')).send({ nome: 'AdmB', email: 'wms.b@x.com', senha: 'Aa@123456', perfil: 'admin', empresa_id: empB })
    tokB = (await request(app).post('/api/auth/login').send({ email: 'wms.b@x.com', senha: 'Aa@123456' })).body?.data?.token
  })
  const auth = r => r.set('Authorization', `Bearer ${token}`)

  it('endereço com código duplicado → 409', async () => {
    const r = await auth(request(app).post('/api/wms/enderecos')).send({ codigo: 'a-01' })
    expect(r.status).toBe(409)
  })

  it('aloca respeitando o saldo; excesso → 409', async () => {
    expect((await auth(request(app).post(`/api/almoxarifado/${itemId}/alocar`)).send({ endereco_id: endA, quantidade: 30 })).status).toBe(201)
    const r = await auth(request(app).post(`/api/almoxarifado/${itemId}/alocar`)).send({ endereco_id: endB, quantidade: 60 })
    expect(r.status).toBe(409) // só 50 livres (80−30)
    expect((await auth(request(app).post(`/api/almoxarifado/${itemId}/alocar`)).send({ endereco_id: endB, quantidade: 20 })).body.data.saldo_nao_enderecado).toBe(30)
  })

  it('posição do item mostra onde está', async () => {
    const p = (await auth(request(app).get(`/api/almoxarifado/${itemId}/enderecos`))).body.data
    expect(p.saldo_enderecado).toBe(50)
    expect(p.saldo_nao_enderecado).toBe(30)
    expect(p.posicoes.length).toBe(2)
  })

  it('picking sugere as retiradas; faltante quando não cobre', async () => {
    const ok = (await auth(request(app).get(`/api/almoxarifado/${itemId}/picking?quantidade=40`))).body.data
    expect(ok.ok).toBe(true)
    expect(ok.retiradas[0].codigo).toBe('A-01') // 30 no maior bin
    const falta = (await auth(request(app).get(`/api/almoxarifado/${itemId}/picking?quantidade=100`))).body.data
    expect(falta.ok).toBe(false)
    expect(falta.faltante).toBe(50) // só 50 endereçados
  })

  it('mover entre endereços preserva o total endereçado', async () => {
    await auth(request(app).post(`/api/almoxarifado/${itemId}/mover`)).send({ de_endereco_id: endA, para_endereco_id: endB, quantidade: 10 })
    const p = (await auth(request(app).get(`/api/almoxarifado/${itemId}/enderecos`))).body.data
    expect(p.saldo_enderecado).toBe(50) // 20 em A, 30 em B
    expect(p.posicoes.find(x => x.codigo === 'A-01').quantidade).toBe(20)
    expect(p.posicoes.find(x => x.codigo === 'A-02').quantidade).toBe(30)
  })

  it('ocupação do endereço é exibida na listagem', async () => {
    const ends = (await auth(request(app).get('/api/wms/enderecos'))).body.data
    const a = ends.find(e => e.codigo === 'A-01')
    expect(a.usado).toBe(20)
    expect(a.ocupacao_pct).toBe(40) // 20/50
  })

  it('isolamento: tenant B não vê endereços/aloca no item do A', async () => {
    const ends = await request(app).get('/api/wms/enderecos').set('Authorization', `Bearer ${tokB}`)
    expect(ends.body.data.length).toBe(0)
    const r = await request(app).post(`/api/almoxarifado/${itemId}/alocar`).set('Authorization', `Bearer ${tokB}`).send({ endereco_id: endA, quantidade: 1 })
    expect(r.status).toBe(404)
  })
})

// ============================================================
// Testes — MM fase 4: MRP (necessidade × saldo). Lib pura (index/cálculo,
// faltantes, disponibilidade, gargalo de veículos) + endpoint (cruza BOM
// explodida com o almoxarifado, isolamento).
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'
import { indexarEstoque, calcularMRP } from '../lib/mm_mrp.js'

describe('lib mm_mrp (pura)', () => {
  it('indexarEstoque soma por código (case-insensitive)', () => {
    const m = indexarEstoque([{ codigo: 'ABC', quantidade_atual: 5 }, { codigo: 'abc', quantidade_atual: 3 }, { codigo: '', quantidade_atual: 9 }])
    expect(m.get('ABC')).toBe(8)
    expect(m.has('')).toBe(false)
  })
  it('calcula faltante, cobertura e disponibilidade só sobre BUY', () => {
    const explosao = [
      { id: 1, part_number: 'SYS', make_buy: 'MAKE', qtd_por_veiculo: 1, qtd_total: 50 },
      { id: 2, part_number: 'MOTOR', make_buy: 'BUY', qtd_por_veiculo: 1, qtd_total: 50 },   // saldo 50 → ok
      { id: 3, part_number: 'FILTRO', make_buy: 'BUY', qtd_por_veiculo: 2, qtd_total: 100 }, // saldo 40 → falta 60
    ]
    const saldo = indexarEstoque([{ codigo: 'MOTOR', quantidade_atual: 50 }, { codigo: 'FILTRO', quantidade_atual: 40 }])
    const r = calcularMRP(explosao, saldo, 50)
    expect(r.itens_buy).toBe(2)
    expect(r.itens_faltantes).toBe(1)
    const filtro = r.itens.find(i => i.part_number === 'FILTRO')
    expect(filtro.faltante).toBe(60)
    expect(filtro.cobertura_pct).toBe(40) // 40/100
    // disponibilidade: 1 de 2 BUY ok → 50%
    expect(r.disponibilidade_pct).toBe(50)
    // gargalo: filtro cobre floor(40/2)=20 veículos; motor 50 → possíveis 20
    expect(r.veiculos_possiveis).toBe(20)
    // faltantes ordenados por maior falta
    expect(r.faltantes[0].part_number).toBe('FILTRO')
  })
  it('sem BUY → 100% disponível e alvo mantido', () => {
    const r = calcularMRP([{ id: 1, part_number: 'X', make_buy: 'MAKE', qtd_por_veiculo: 1, qtd_total: 10 }], new Map(), 10)
    expect(r.disponibilidade_pct).toBe(100)
    expect(r.veiculos_possiveis).toBe(10)
  })
})

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
let request, app, token, tokB

describe('endpoint — MM MRP', () => {
  beforeAll(async () => {
    const st = await import('supertest')
    request = st.default
    ;({ app } = await import('../server.js'))
    token = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token
    const m = r => r.set('Authorization', `Bearer ${token}`)
    const sys = (await m(request(app).post('/api/mm/materiais')).send({ part_number: 'SYS', make_buy: 'MAKE', nivel: 1, qtd_veiculo: 1 })).body.data.id
    const motor = (await m(request(app).post('/api/mm/materiais')).send({ part_number: 'MOTOR', make_buy: 'BUY', nivel: 2, peca_pai_id: sys, qtd_veiculo: 1 })).body.data.id
    await m(request(app).post('/api/mm/materiais')).send({ part_number: 'FILTRO', make_buy: 'BUY', nivel: 3, peca_pai_id: motor, qtd_veiculo: 2 })
    // estoque: código = part_number
    await m(request(app).post('/api/almoxarifado')).send({ codigo: 'MOTOR', descricao: 'Motor', quantidade_atual: 50 })
    await m(request(app).post('/api/almoxarifado')).send({ codigo: 'FILTRO', descricao: 'Filtro', quantidade_atual: 40 })
    const empB = (await m(request(app).post('/api/empresas')).send({ razao_social: 'Tenant B MRP' })).body.data.id
    await m(request(app).post('/api/usuarios')).send({ nome: 'AdmB', email: 'mrp.b@x.com', senha: 'Aa@123456', perfil: 'admin', empresa_id: empB })
    tokB = (await request(app).post('/api/auth/login').send({ email: 'mrp.b@x.com', senha: 'Aa@123456' })).body?.data?.token
  })
  const auth = r => r.set('Authorization', `Bearer ${token}`)

  it('MRP cruza BOM × saldo e aponta faltante + gargalo', async () => {
    const d = (await auth(request(app).get('/api/mm/mrp?veiculos=50'))).body.data
    expect(d.itens_buy).toBe(2)
    expect(d.itens_faltantes).toBe(1)
    expect(d.faltantes[0].part_number).toBe('FILTRO')
    expect(d.faltantes[0].faltante).toBe(60) // 100 - 40
    expect(d.veiculos_possiveis).toBe(20)    // filtro: floor(40/2)
  })

  it('isolamento: tenant B tem MRP vazio', async () => {
    const d = (await request(app).get('/api/mm/mrp?veiculos=50').set('Authorization', `Bearer ${tokB}`)).body.data
    expect(d.itens_buy).toBe(0)
    expect(d.disponibilidade_pct).toBe(100)
  })
})

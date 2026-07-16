// ============================================================
// Testes — MM (Materials Management): material master, BOM multinível,
// explosão de necessidade e gate de engenharia (sem liberação não compra).
// Lib pura + endpoints (dedup PN, validação de pai, isolamento, explosão, gate).
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'
import { explodirBOM, gateCompra, podeLiberarEngenharia, filhosDiretos } from '../lib/mm_bom.js'

describe('lib mm_bom (pura)', () => {
  // BOM real (Guarani): sistema(1) → motor(1×) → filtro de ar(1×), terminais(168×)
  const mats = [
    { id: 1, part_number: 'MEC-000-001', make_buy: 'MAKE', peca_pai_id: null, qtd_veiculo: 1, nivel: 1 },
    { id: 2, part_number: 'MEC-100-001', make_buy: 'BUY', peca_pai_id: 1, qtd_veiculo: 1, nivel: 2 },
    { id: 3, part_number: 'MEC-100-002', make_buy: 'BUY', peca_pai_id: 2, qtd_veiculo: 2, nivel: 3 },
    { id: 4, part_number: 'ELE-100-003', make_buy: 'BUY', peca_pai_id: 1, qtd_veiculo: 168, nivel: 2 },
  ]
  it('explode multiplicando o caminho e o volume de veículos', () => {
    const ex = explodirBOM(mats, 1, 50)
    const byId = Object.fromEntries(ex.map(e => [e.id, e]))
    expect(byId[1].qtd_total).toBe(50)      // 1 × 50
    expect(byId[3].qtd_por_veiculo).toBe(2) // 1(motor) × 2(filtro)
    expect(byId[3].qtd_total).toBe(100)     // 2 × 50
    expect(byId[4].qtd_total).toBe(168 * 50)
  })
  it('não entra em loop com pai inconsistente (ciclo)', () => {
    const ciclo = [
      { id: 1, peca_pai_id: 2, qtd_veiculo: 1 },
      { id: 2, peca_pai_id: 1, qtd_veiculo: 1 },
    ]
    expect(() => explodirBOM(ciclo, 1, 1)).not.toThrow()
  })
  it('filhosDiretos retorna só um nível', () => {
    expect(filhosDiretos(mats, 1).map(m => m.id).sort()).toEqual([2, 4])
  })
  it('gate: BUY sem liberação bloqueia; MAKE não vai a sourcing; BUY liberado passa', () => {
    expect(gateCompra({ make_buy: 'BUY', eng_liberado_compras: 0 }).ok).toBe(false)
    expect(gateCompra({ make_buy: 'MAKE' }).ok).toBe(false)
    expect(gateCompra({ make_buy: 'BUY', eng_liberado_compras: 1 }).ok).toBe(true)
  })
  it('podeLiberarEngenharia exige desenho + revisão', () => {
    expect(podeLiberarEngenharia({ eng_desenho: 'DWG-1', eng_revisao: '01' })).toBe(true)
    expect(podeLiberarEngenharia({ eng_desenho: 'DWG-1' })).toBe(false)
  })
})

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
let request, app, token, tokB, sistemaId, motorId

describe('endpoints — MM material/BOM/engenharia', () => {
  beforeAll(async () => {
    const st = await import('supertest')
    request = st.default
    ;({ app } = await import('../server.js'))
    token = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token
    const m = r => r.set('Authorization', `Bearer ${token}`)
    sistemaId = (await m(request(app).post('/api/mm/materiais')).send({ part_number: 'MEC-000-001', descricao: 'Sistema Mecânico', sistema: 'Mecânica', nivel: 1, make_buy: 'MAKE', qtd_veiculo: 1, criticidade: 'Alta', projeto: 'Guarani' })).body.data.id
    motorId = (await m(request(app).post('/api/mm/materiais')).send({ part_number: 'MEC-100-001', descricao: 'Motor Diesel', sistema: 'Mecânica', subsistema: 'Powertrain', nivel: 2, peca_pai_id: sistemaId, make_buy: 'BUY', qtd_veiculo: 1, criticidade: 'Alta' })).body.data.id
    await m(request(app).post('/api/mm/materiais')).send({ part_number: 'MEC-100-002', descricao: 'Filtro de Ar', nivel: 3, peca_pai_id: motorId, make_buy: 'BUY', qtd_veiculo: 2 })
    const empB = (await m(request(app).post('/api/empresas')).send({ razao_social: 'Tenant B MM' })).body.data.id
    await m(request(app).post('/api/usuarios')).send({ nome: 'AdmB', email: 'mm.b@x.com', senha: 'Aa@123456', perfil: 'admin', empresa_id: empB })
    tokB = (await request(app).post('/api/auth/login').send({ email: 'mm.b@x.com', senha: 'Aa@123456' })).body?.data?.token
  })
  const auth = r => r.set('Authorization', `Bearer ${token}`)

  it('rejeita part number duplicado (409)', async () => {
    const r = await auth(request(app).post('/api/mm/materiais')).send({ part_number: 'mec-000-001', descricao: 'dup' })
    expect(r.status).toBe(409)
  })

  it('rejeita pai inexistente (404)', async () => {
    const r = await auth(request(app).post('/api/mm/materiais')).send({ part_number: 'X-1', peca_pai_id: 99999 })
    expect(r.status).toBe(404)
  })

  it('explosão multiplica pela quantidade e pelos veículos', async () => {
    const ex = (await auth(request(app).get(`/api/mm/materiais/${sistemaId}/explosao?veiculos=50`))).body.data
    const filtro = ex.find(e => e.part_number === 'MEC-100-002')
    expect(filtro.qtd_por_veiculo).toBe(2)
    expect(filtro.qtd_total).toBe(100)
  })

  it('GATE: motor BUY começa bloqueado; libera engenharia; passa', async () => {
    const g1 = (await auth(request(app).get(`/api/mm/materiais/${motorId}/gate-compra`))).body.data
    expect(g1.ok).toBe(false)
    const semRev = await auth(request(app).post(`/api/mm/materiais/${motorId}/liberar-engenharia`)).send({ eng_desenho: 'DWG-MEC-100-001' })
    expect(semRev.status).toBe(400)
    const lib = await auth(request(app).post(`/api/mm/materiais/${motorId}/liberar-engenharia`)).send({ eng_desenho: 'DWG-MEC-100-001', eng_revisao: '01' })
    expect(lib.status).toBe(200)
    expect(lib.body.data.eng_liberado_compras).toBe(1)
    const g2 = (await auth(request(app).get(`/api/mm/materiais/${motorId}/gate-compra`))).body.data
    expect(g2.ok).toBe(true)
  })

  it('isolamento: tenant B não vê materiais do tenant A', async () => {
    const rB = await request(app).get('/api/mm/materiais').set('Authorization', `Bearer ${tokB}`)
    expect(rB.body.data.length).toBe(0)
    const g = await request(app).get(`/api/mm/materiais/${motorId}/explosao`).set('Authorization', `Bearer ${tokB}`)
    expect(g.status).toBe(404)
  })
})

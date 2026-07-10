// ============================================================
// Testes — MM fase 2: explosão → RFQ automática. Lib pura (status/itens/resumo)
// + endpoints (gate bloqueia RFQ, geração unitária e em lote, quantidade
// explodida, ligação com o Sourcing, isolamento).
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'
import { statusSourcing, itensParaCotar, resumoSourcing, montarRFQdeMaterial } from '../lib/mm_sourcing.js'

describe('lib mm_sourcing (pura)', () => {
  const mats = [
    { id: 1, make_buy: 'MAKE', eng_liberado_compras: 0 },
    { id: 2, make_buy: 'BUY', eng_liberado_compras: 0 },          // bloqueado
    { id: 3, make_buy: 'BUY', eng_liberado_compras: 1 },          // a cotar
    { id: 4, make_buy: 'BUY', eng_liberado_compras: 1 },          // em cotação
  ]
  it('status por material', () => {
    expect(statusSourcing(mats[0], false)).toBe('MAKE')
    expect(statusSourcing(mats[1], false)).toBe('Bloqueado')
    expect(statusSourcing(mats[2], false)).toBe('A cotar')
    expect(statusSourcing(mats[3], true)).toBe('Em cotação')
  })
  it('itensParaCotar = BUY liberado sem RFQ', () => {
    expect(itensParaCotar(mats, [4]).map(m => m.id)).toEqual([3])
  })
  it('resumoSourcing conta cada estado', () => {
    const r = resumoSourcing(mats, [4])
    expect(r).toEqual({ make: 1, bloqueado: 1, a_cotar: 1, em_cotacao: 1 })
  })
  it('montarRFQdeMaterial traz quantidade e escopo', () => {
    const rfq = montarRFQdeMaterial({ part_number: 'MEC-100-002', descricao: 'Filtro', unidade: 'PC', sistema: 'Mecânica' }, 100, 50)
    expect(rfq.quantidade).toBe(100)
    expect(rfq.titulo).toContain('MEC-100-002')
    expect(rfq.descricao).toContain('100 PC')
    expect(rfq.descricao).toContain('50 veículo')
  })
})

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
let request, app, token, fornId, sistemaId, motorId, filtroId

describe('endpoints — MM sourcing / RFQ automática', () => {
  beforeAll(async () => {
    const st = await import('supertest')
    request = st.default
    ;({ app } = await import('../server.js'))
    token = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token
    const m = r => r.set('Authorization', `Bearer ${token}`)
    fornId = (await m(request(app).post('/api/fornecedores')).send({ nome: 'MetalFor', cnpj: '11.111.111/0001-11' })).body.data.id
    sistemaId = (await m(request(app).post('/api/mm/materiais')).send({ part_number: 'MEC-000-001', make_buy: 'MAKE', nivel: 1, qtd_veiculo: 1 })).body.data.id
    motorId = (await m(request(app).post('/api/mm/materiais')).send({ part_number: 'MEC-100-001', make_buy: 'BUY', nivel: 2, peca_pai_id: sistemaId, qtd_veiculo: 1, fornecedor_id: fornId })).body.data.id
    filtroId = (await m(request(app).post('/api/mm/materiais')).send({ part_number: 'MEC-100-002', descricao: 'Filtro Ar', make_buy: 'BUY', nivel: 3, peca_pai_id: motorId, qtd_veiculo: 2, fornecedor_id: fornId })).body.data.id
  })
  const auth = r => r.set('Authorization', `Bearer ${token}`)

  it('bloqueia RFQ de item sem engenharia liberada (409)', async () => {
    const r = await auth(request(app).post(`/api/mm/materiais/${motorId}/gerar-rfq`)).send({ veiculos: 50 })
    expect(r.status).toBe(409)
    expect(r.body.error).toMatch(/engenharia|bloqueado/i)
  })

  it('gera RFQ unitária com quantidade explodida após liberar engenharia', async () => {
    await auth(request(app).post(`/api/mm/materiais/${filtroId}/liberar-engenharia`)).send({ eng_desenho: 'DWG-1', eng_revisao: '01' })
    const r = await auth(request(app).post(`/api/mm/materiais/${filtroId}/gerar-rfq`)).send({ veiculos: 50 })
    expect(r.status).toBe(201)
    expect(r.body.data.numero).toMatch(/^RFQ/)
    // filtro: 1 (motor) × 2 = 2/veículo × 50 = 100
    expect(r.body.data.descricao).toContain('100')
    expect(r.body.data.mm_material_id).toBe(filtroId)
  })

  it('sourcing marca o material como Em cotação', async () => {
    const s = (await auth(request(app).get('/api/mm/sourcing'))).body.data
    const filtro = s.materiais.find(x => x.id === filtroId)
    expect(filtro.status_sourcing).toBe('Em cotação')
    expect(filtro.rfq_numero).toMatch(/^RFQ/)
    expect(s.resumo.em_cotacao).toBeGreaterThanOrEqual(1)
  })

  it('geração em lote cria RFQ dos liberados e pula os sem fornecedor/bloqueados', async () => {
    // libera o motor (tem fornecedor) → entra no lote; sistema é MAKE (fora)
    await auth(request(app).post(`/api/mm/materiais/${motorId}/liberar-engenharia`)).send({ eng_desenho: 'DWG-2', eng_revisao: '01' })
    const r = await auth(request(app).post('/api/mm/bom/gerar-rfqs')).send({ veiculos: 50 })
    expect(r.status).toBe(201)
    expect(r.body.data.criadas).toBe(1) // só o motor (filtro já tinha RFQ)
    expect(r.body.data.rfqs[0].part_number).toBe('MEC-100-001')
  })

  it('exige fornecedor quando o material não tem homologado (400)', async () => {
    const semForn = (await auth(request(app).post('/api/mm/materiais')).send({ part_number: 'ELE-1', make_buy: 'BUY', qtd_veiculo: 1 })).body.data.id
    await auth(request(app).post(`/api/mm/materiais/${semForn}/liberar-engenharia`)).send({ eng_desenho: 'D', eng_revisao: '1' })
    const r = await auth(request(app).post(`/api/mm/materiais/${semForn}/gerar-rfq`)).send({ veiculos: 1 })
    expect(r.status).toBe(400)
  })
})

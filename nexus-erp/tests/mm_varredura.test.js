// ============================================================
// Varredura adversarial do MM (fases 1–5) — ataques que viram regressão.
// BUG 1 (real, corrigido): MRP contava o estoque em dobro quando o mesmo
//   part_number aparecia em 2 nós da BOM → faltante escondido (parada de linha).
// BUG 2 (real, corrigido): pai com qtd_veiculo 0 (conjunto opcional) não
//   zerava a subárvore → necessidade inflada.
// Demais ataques: fornecedor cross-tenant em PPAP/amostra, quantidades
// negativas, RFQ p/ fornecedor de outro tenant.
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'
import { explodirBOM } from '../lib/mm_bom.js'
import { indexarEstoque, calcularMRP } from '../lib/mm_mrp.js'

describe('BUG 1 — MRP agrega por part_number (estoque não conta em dobro)', () => {
  it('mesmo PN em 2 nós: necessidade soma, saldo é um só', () => {
    const mats = [
      { id: 1, part_number: 'SYS-A', make_buy: 'MAKE', peca_pai_id: null, qtd_veiculo: 1 },
      { id: 2, part_number: 'SYS-B', make_buy: 'MAKE', peca_pai_id: null, qtd_veiculo: 1 },
      { id: 3, part_number: 'PARAF-M8', make_buy: 'BUY', peca_pai_id: 1, qtd_veiculo: 4 },
      { id: 4, part_number: 'PARAF-M8', make_buy: 'BUY', peca_pai_id: 2, qtd_veiculo: 4 },
    ]
    const saldo = indexarEstoque([{ codigo: 'PARAF-M8', quantidade_atual: 100 }])
    const r = calcularMRP(explodirBOM(mats, null, 20), saldo, 20)
    const paraf = r.itens.filter(i => i.part_number === 'PARAF-M8')
    expect(paraf.length).toBe(1)                 // agregado num só PN
    expect(paraf[0].necessidade).toBe(160)       // (4+4) × 20
    expect(paraf[0].faltante).toBe(60)           // 160 − 100
    expect(r.itens_faltantes).toBe(1)            // antes: 0 (otimista!)
    expect(r.veiculos_possiveis).toBe(12)        // floor(100/8); antes: 25
  })
  it('agregação: BUY vence MAKE e criticidade fica a maior', () => {
    const explosao = [
      { id: 1, part_number: 'X', make_buy: 'MAKE', criticidade: 'Baixa', qtd_por_veiculo: 1, qtd_total: 10 },
      { id: 2, part_number: 'x', make_buy: 'BUY', criticidade: 'Alta', qtd_por_veiculo: 2, qtd_total: 20 },
    ]
    const r = calcularMRP(explosao, new Map(), 10)
    expect(r.itens.length).toBe(1)
    expect(r.itens[0].make_buy).toBe('BUY')
    expect(r.itens[0].criticidade).toBe('Alta')
    expect(r.itens[0].necessidade).toBe(30)
  })
})

describe('BUG 2 — pai com qtd 0 zera a subárvore', () => {
  it('conjunto opcional desativado não gera necessidade dos filhos', () => {
    const mats = [
      { id: 1, part_number: 'OPC', make_buy: 'MAKE', peca_pai_id: null, qtd_veiculo: 0 },
      { id: 2, part_number: 'FILHO', make_buy: 'BUY', peca_pai_id: 1, qtd_veiculo: 5 },
    ]
    const filho = explodirBOM(mats, null, 10).find(e => e.part_number === 'FILHO')
    expect(filho.qtd_total).toBe(0) // antes: 50 (herdava 1 do pai zerado)
  })
})

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
let request, app, token, fornB, matId

describe('varredura endpoints — fornecedor cross-tenant e entradas inválidas', () => {
  beforeAll(async () => {
    const st = await import('supertest')
    request = st.default
    ;({ app } = await import('../server.js'))
    token = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token
    const m = r => r.set('Authorization', `Bearer ${token}`)
    // fornecedor do tenant B
    const empB = (await m(request(app).post('/api/empresas')).send({ razao_social: 'Tenant B Varredura' })).body.data.id
    await m(request(app).post('/api/usuarios')).send({ nome: 'AdmB', email: 'var.b@x.com', senha: 'Aa@123456', perfil: 'admin', empresa_id: empB })
    const tokB = (await request(app).post('/api/auth/login').send({ email: 'var.b@x.com', senha: 'Aa@123456' })).body?.data?.token
    fornB = (await request(app).post('/api/fornecedores').set('Authorization', `Bearer ${tokB}`).send({ nome: 'FornB', cnpj: '22.222.222/0001-22' })).body.data.id
    matId = (await m(request(app).post('/api/mm/materiais')).send({ part_number: 'VAR-1', make_buy: 'BUY', qtd_veiculo: 1 })).body.data.id
    await m(request(app).post(`/api/mm/materiais/${matId}/liberar-engenharia`)).send({ eng_desenho: 'D', eng_revisao: '1' })
  })
  const auth = r => r.set('Authorization', `Bearer ${token}`)

  it('PPAP não aceita fornecedor de outro tenant (400)', async () => {
    const r = await auth(request(app).post(`/api/mm/materiais/${matId}/ppap`)).send({ nivel: 3, fornecedor_id: fornB })
    expect(r.status).toBe(400)
  })

  it('amostra não aceita fornecedor de outro tenant (400)', async () => {
    const r = await auth(request(app).post(`/api/mm/materiais/${matId}/amostra`)).send({ fornecedor_id: fornB })
    expect(r.status).toBe(400)
  })

  it('gerar-rfq não convida fornecedor de outro tenant (400)', async () => {
    const r = await auth(request(app).post(`/api/mm/materiais/${matId}/gerar-rfq`)).send({ fornecedor_ids: [fornB] })
    expect(r.status).toBe(400)
  })

  it('amostra rejeita quantidade zero/negativa (400)', async () => {
    const r = await auth(request(app).post(`/api/mm/materiais/${matId}/amostra`)).send({ quantidade: -5 })
    expect(r.status).toBe(400)
  })

  it('material rejeita qtd_veiculo negativa (400)', async () => {
    const r = await auth(request(app).post('/api/mm/materiais')).send({ part_number: 'NEG-1', make_buy: 'BUY', qtd_veiculo: -3 })
    expect(r.status).toBe(400)
  })

  it('qtd_veiculo = 0 é preservada (conjunto opcional), não vira 1', async () => {
    const r = await auth(request(app).post('/api/mm/materiais')).send({ part_number: 'ZERO-1', make_buy: 'MAKE', qtd_veiculo: 0 })
    expect(r.status).toBe(201)
    expect(r.body.data.qtd_veiculo).toBe(0)
    const up = await auth(request(app).put(`/api/mm/materiais/${r.body.data.id}`)).send({ qtd_veiculo: 0 })
    expect(up.body.data.qtd_veiculo).toBe(0)
  })
})

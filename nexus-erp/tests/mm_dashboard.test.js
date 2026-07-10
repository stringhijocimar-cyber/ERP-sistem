// ============================================================
// Testes — MM fase 5: dashboard executivo + score de fornecedor + sugestão de
// compra. Lib pura (consolidação de gaps, score ponderado, sugestão) +
// endpoints (dashboard consolidado, ranking de score, isolamento).
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'
import { consolidarMM, scoreFornecedor, classificarFornecedor, sugestaoCompra } from '../lib/mm_dashboard.js'

describe('lib mm_dashboard (pura)', () => {
  const materiais = [
    { id: 1, make_buy: 'MAKE', criticidade: 'Alta' },
    { id: 2, make_buy: 'BUY', eng_liberado_compras: 0, criticidade: 'Alta' },  // sem engenharia
    { id: 3, make_buy: 'BUY', eng_liberado_compras: 1, criticidade: 'Média' }, // liberado, sem rfq → sem cotação
    { id: 4, make_buy: 'BUY', eng_liberado_compras: 1, criticidade: 'Baixa' }, // com rfq + ppap ok
  ]
  it('consolida os gaps do pipeline', () => {
    const g = consolidarMM({ materiais, rfqMaterialIds: [4], ppapMap: new Map([[4, { status: 'Aprovado' }]]) })
    expect(g.resumo.sem_engenharia).toBe(1)   // id 2
    expect(g.resumo.sem_cotacao).toBe(1)       // id 3
    expect(g.resumo.sem_ppap).toBe(2)          // id 2 e 3 (4 tem ppap)
    expect(g.resumo.criticos).toBe(2)          // id 1 e 2
  })
  it('score pondera prazo/qualidade/comercial e renormaliza sobre o que existe', () => {
    // só prazo (OTIF 100) → score 100
    expect(scoreFornecedor({ otif_pct: 100 }).score).toBe(100)
    // OTIF 50, PPAP 2/2 (qualidade 100) → (50*.35 + 100*.40)/.75 = 76.7
    const s = scoreFornecedor({ otif_pct: 50, ppap_total: 2, ppap_aprovados: 2 })
    expect(s.score).toBe(76.7)
    expect(s.classificacao).toBe('B — Homologado')
    // fornecedor novo sem histórico
    expect(scoreFornecedor({}).score).toBeNull()
  })
  it('classificarFornecedor por faixa', () => {
    expect(classificarFornecedor(85)).toBe('A — Preferencial')
    expect(classificarFornecedor(65)).toBe('B — Homologado')
    expect(classificarFornecedor(45)).toBe('C — Atenção')
    expect(classificarFornecedor(20)).toBe('D — Crítico')
  })
  it('sugestaoCompra indica a ação certa por item', () => {
    const mats = new Map([
      [2, { eng_liberado_compras: 0 }],
      [3, { eng_liberado_compras: 1, fornecedor_id: null }],
      [5, { eng_liberado_compras: 1, fornecedor_id: 9 }],
    ])
    const s = sugestaoCompra([{ id: 2, faltante: 10 }, { id: 3, faltante: 5 }, { id: 5, faltante: 3 }], mats)
    expect(s.find(x => x.id === 2).acao).toBe('Liberar engenharia')
    expect(s.find(x => x.id === 3).acao).toBe('Definir fornecedor')
    expect(s.find(x => x.id === 5).acao).toBe('Gerar RFQ')
  })
})

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
let request, app, token, tokB, fornId, buyId

describe('endpoints — MM dashboard / score', () => {
  beforeAll(async () => {
    const st = await import('supertest')
    request = st.default
    ;({ app } = await import('../server.js'))
    token = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token
    const m = r => r.set('Authorization', `Bearer ${token}`)
    fornId = (await m(request(app).post('/api/fornecedores')).send({ nome: 'MetalFor', cnpj: '11.111.111/0001-11' })).body.data.id
    buyId = (await m(request(app).post('/api/mm/materiais')).send({ part_number: 'MEC-100-001', descricao: 'Motor', make_buy: 'BUY', qtd_veiculo: 1, criticidade: 'Alta', fornecedor_id: fornId })).body.data.id
    const empB = (await m(request(app).post('/api/empresas')).send({ razao_social: 'Tenant B Dash' })).body.data.id
    await m(request(app).post('/api/usuarios')).send({ nome: 'AdmB', email: 'dash.b@x.com', senha: 'Aa@123456', perfil: 'admin', empresa_id: empB })
    tokB = (await request(app).post('/api/auth/login').send({ email: 'dash.b@x.com', senha: 'Aa@123456' })).body?.data?.token
  })
  const auth = r => r.set('Authorization', `Bearer ${token}`)

  it('dashboard aponta item BUY sem engenharia e sugere liberar', async () => {
    const d = (await auth(request(app).get('/api/mm/dashboard?veiculos=50'))).body.data
    expect(d.gaps.resumo.sem_engenharia).toBe(1)
    expect(d.gaps.resumo.criticos).toBe(1)
    // sem estoque → faltante → sugestão "Liberar engenharia" (ainda não liberado)
    const sug = d.sugestao_compra.find(s => s.part_number === 'MEC-100-001')
    expect(sug.acao).toBe('Liberar engenharia')
  })

  it('score lista fornecedores (sem histórico → score nulo)', async () => {
    const s = (await auth(request(app).get('/api/mm/fornecedores/score'))).body.data
    const f = s.find(x => x.fornecedor_id === fornId)
    expect(f).toBeTruthy()
    expect(f.classificacao).toBe('Sem histórico')
  })

  it('gate: fornecedor (perfil) não acessa o dashboard MM (403)', async () => {
    // cria usuário fornecedor vinculado
    const uForn = await auth(request(app).post('/api/usuarios')).send({ nome: 'Forn', email: 'forn.dash@x.com', senha: 'Aa@123456', perfil: 'fornecedor', fornecedor_id: fornId })
    const tokF = (await request(app).post('/api/auth/login').send({ email: 'forn.dash@x.com', senha: 'Aa@123456' })).body?.data?.token
    const r = await request(app).get('/api/mm/dashboard').set('Authorization', `Bearer ${tokF}`)
    expect(r.status).toBe(403)
  })

  it('isolamento: tenant B tem dashboard vazio', async () => {
    const d = (await request(app).get('/api/mm/dashboard').set('Authorization', `Bearer ${tokB}`)).body.data
    expect(d.gaps.resumo.total).toBe(0)
    const s = (await request(app).get('/api/mm/fornecedores/score').set('Authorization', `Bearer ${tokB}`)).body.data
    expect(s.length).toBe(0)
  })
})

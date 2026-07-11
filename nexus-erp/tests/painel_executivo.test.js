// ============================================================
// Testes — Painel Executivo (visão CEO): costura financeiro + suprimentos
// + fornecedores/OTIF + riscos. Isolado por tenant; gate de perfil.
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'
process.env.ENFORCE_RECEITA_PO = '0'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
let request, app, db, token, tokF, painel

const ANO = new Date().getFullYear()
const D = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10)

beforeAll(async () => {
  const st = await import('supertest')
  request = st.default
  ;({ app, db } = await import('../server.js'))
  token = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token
  const m = r => r.set('Authorization', `Bearer ${token}`)

  // Financeiro: receita (AR faturada no ano) e uma conta a pagar vencida.
  db.prepare(`INSERT INTO contas_receber(numero, cliente, valor, data_emissao, status, empresa_id) VALUES('CR-PE','X',400000,?,'A Receber',1)`).run(`${ANO}-03-10`)
  db.prepare(`INSERT INTO contas_pagar(numero, valor, data_vencimento, status, empresa_id) VALUES('CP-VENC',30000,?, 'Pendente',1)`).run(D(-5))
  // Suprimentos: pedido ativo + item de estoque abaixo do mínimo.
  const fid = db.prepare(`INSERT INTO fornecedores(nome, status, empresa_id) VALUES('F PE','Homologado',1)`).run().lastInsertRowid
  db.prepare(`INSERT INTO pedidos_compra(numero, fornecedor_id, status, valor_total, empresa_id) VALUES('PC-PE',?,'Emitido',80000,1)`).run(fid)
  db.prepare(`INSERT INTO almoxarifado_itens(codigo, descricao, quantidade_atual, quantidade_minima, valor_medio, ativo, empresa_id) VALUES('IT','Item',2,10,50,1,1)`).run()
  // OTIF: uma entrega atrasada (prometida no passado, não entregue).
  db.prepare(`INSERT INTO programacao_entregas(fornecedor_id, data_prometida, status, empresa_id) VALUES(?,?,'Programada',1)`).run(fid, D(-3))
  db.prepare(`INSERT INTO programacao_entregas(fornecedor_id, data_prometida, data_entregue, status, empresa_id) VALUES(?,?,?,'Entregue',1)`).run(fid, D(-20), D(-25))

  // Usuário fornecedor (para o gate 403).
  await m(request(app).post('/api/usuarios')).send({ nome: 'UF', email: 'pe@f.com', senha: 'Aa@123456', perfil: 'fornecedor', fornecedor_id: fid, empresa_id: 1 })
  tokF = (await request(app).post('/api/auth/login').send({ email: 'pe@f.com', senha: 'Aa@123456' })).body?.data?.token
})
const auth = r => r.set('Authorization', `Bearer ${token}`)

describe('GET /api/painel-executivo', () => {
  beforeAll(async () => { painel = (await auth(request(app).get('/api/painel-executivo'))).body.data })

  it('bloco financeiro consolidado', () => {
    expect(painel.financeiro.receita).toBe(400000)
    expect(painel.financeiro).toHaveProperty('capital_giro')
    expect(painel.financeiro).toHaveProperty('saldo_projetado')
  })
  it('bloco suprimentos (pedidos, estoque, reposição)', () => {
    expect(painel.suprimentos.pedidos_ativos).toBe(1)
    expect(painel.suprimentos.pedidos_valor).toBe(80000)
    expect(painel.suprimentos.itens_reposicao).toBe(1)
    expect(painel.suprimentos.estoque_valor).toBe(100) // 2 × 50
  })
  it('bloco fornecedores/OTIF', () => {
    expect(painel.fornecedores.homologados).toBeGreaterThanOrEqual(1)
    // 1 entregue no prazo (D-25 <= D-20) → OTIF 100; 1 aberta atrasada
    expect(painel.fornecedores.otif_pct).toBe(100)
    expect(painel.fornecedores.entregas_atrasadas).toBe(1)
  })
  it('riscos priorizados incluem vencido e reposição', () => {
    const titulos = painel.riscos.map(r => r.titulo).join(' | ')
    expect(titulos).toMatch(/vencid/i)
    expect(titulos).toMatch(/reposição/i)
    // ordenados: nível alto vem antes de baixo
    const niveis = painel.riscos.map(r => r.nivel)
    if (niveis.includes('alto') && niveis.includes('baixo')) {
      expect(niveis.indexOf('alto')).toBeLessThan(niveis.lastIndexOf('baixo'))
    }
  })
})

describe('bloco industrial (MM) no painel', () => {
  it('sem materiais MM o bloco é null (tenant não usa o módulo)', () => {
    expect(painel.industrial).toBeNull()
  })
  it('com BOM: gaps + faltantes do MRP + riscos de produção/qualidade/engenharia', async () => {
    // BOM mínima: sistema MAKE → motor BUY (sem engenharia, sem PPAP, sem estoque)
    const sys = (await auth(request(app).post('/api/mm/materiais')).send({ part_number: 'PE-SYS', make_buy: 'MAKE', nivel: 1, qtd_veiculo: 1 })).body.data.id
    await auth(request(app).post('/api/mm/materiais')).send({ part_number: 'PE-MOTOR', make_buy: 'BUY', nivel: 2, peca_pai_id: sys, qtd_veiculo: 1, criticidade: 'Alta' })
    const d = (await auth(request(app).get('/api/painel-executivo?veiculos=10'))).body.data
    expect(d.industrial).toBeTruthy()
    expect(d.industrial.sem_engenharia).toBe(1)
    expect(d.industrial.sem_ppap).toBe(1)
    expect(d.industrial.mrp_faltantes).toBe(1)          // motor sem estoque
    expect(d.industrial.veiculos_possiveis).toBe(0)     // nada coberto
    expect(d.industrial.veiculos_alvo).toBe(10)
    const areas = d.riscos.map(r => r.area).join(' | ')
    expect(areas).toMatch(/Produção/)
    expect(areas).toMatch(/Qualidade/)
    expect(areas).toMatch(/Engenharia/)
    // risco de produção é nível alto → aparece antes dos médios
    expect(d.riscos[0].nivel).toBe('alto')
  })
})

describe('isolamento e gate', () => {
  it('perfil fornecedor é bloqueado (403)', async () => {
    const r = await request(app).get('/api/painel-executivo').set('Authorization', `Bearer ${tokF}`)
    expect(r.status).toBe(403)
  })
  it('tenant B tem painel zerado e sem bloco industrial', async () => {
    const empB = (await auth(request(app).post('/api/empresas')).send({ razao_social: 'Tenant B' })).body.data.id
    await auth(request(app).post('/api/usuarios')).send({ nome: 'AdmB', email: 'pe.b@x.com', senha: 'Aa@123456', perfil: 'admin', empresa_id: empB })
    const tokB = (await request(app).post('/api/auth/login').send({ email: 'pe.b@x.com', senha: 'Aa@123456' })).body?.data?.token
    const d = (await request(app).get('/api/painel-executivo').set('Authorization', `Bearer ${tokB}`)).body.data
    expect(d.financeiro.receita).toBe(0)
    expect(d.suprimentos.pedidos_ativos).toBe(0)
    expect(d.fornecedores.total).toBe(0)
    expect(d.industrial).toBeNull()
  })
})

// ============================================================
// Testes — MM fase 7: MRP → RC automática dos faltantes. A lista de faltantes
// vira requisição de compra no ciclo existente (RC→aprovação→pedido), com
// quantidade = faltante agregado e custo estimado do estoque.
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
let request, app, token, tokB

describe('endpoint — MRP → RC dos faltantes', () => {
  beforeAll(async () => {
    const st = await import('supertest')
    request = st.default
    ;({ app } = await import('../server.js'))
    token = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token
    const m = r => r.set('Authorization', `Bearer ${token}`)
    const sys = (await m(request(app).post('/api/mm/materiais')).send({ part_number: 'SYS', make_buy: 'MAKE', nivel: 1, qtd_veiculo: 1 })).body.data.id
    const motor = (await m(request(app).post('/api/mm/materiais')).send({ part_number: 'MOTOR', descricao: 'Motor Diesel', make_buy: 'BUY', nivel: 2, peca_pai_id: sys, qtd_veiculo: 1, unidade: 'CJ' })).body.data.id
    await m(request(app).post('/api/mm/materiais')).send({ part_number: 'FILTRO', descricao: 'Filtro de Ar', make_buy: 'BUY', nivel: 3, peca_pai_id: motor, qtd_veiculo: 2 })
    // estoque: motor coberto (50), filtro só 40 (necessidade 100 p/ 50 veíc → falta 60)
    await m(request(app).post('/api/almoxarifado')).send({ codigo: 'MOTOR', descricao: 'Motor', quantidade_atual: 50, valor_medio: 90000 })
    await m(request(app).post('/api/almoxarifado')).send({ codigo: 'FILTRO', descricao: 'Filtro', quantidade_atual: 40, valor_medio: 120 })
    const empB = (await m(request(app).post('/api/empresas')).send({ razao_social: 'Tenant B MRPRC' })).body.data.id
    await m(request(app).post('/api/usuarios')).send({ nome: 'AdmB', email: 'mrprc.b@x.com', senha: 'Aa@123456', perfil: 'admin', empresa_id: empB })
    tokB = (await request(app).post('/api/auth/login').send({ email: 'mrprc.b@x.com', senha: 'Aa@123456' })).body?.data?.token
  })
  const auth = r => r.set('Authorization', `Bearer ${token}`)

  it('gera RC com os faltantes (qtd = faltante, custo do estoque)', async () => {
    const r = await auth(request(app).post('/api/mm/mrp/gerar-rc')).send({ veiculos: 50 })
    expect(r.status).toBe(201)
    expect(r.body.data.numero).toMatch(/^RC/)
    expect(r.body.data.origem).toBe('mrp')
    expect(r.body.data.itens_faltantes).toBe(1)
    expect(r.body.data.veiculos_possiveis).toBe(20)
    // RC persistida com o item certo
    const rc = (await auth(request(app).get(`/api/rc/${r.body.data.id}`))).body.data
    const item = rc.itens.find(i => i.codigo_produto === 'FILTRO')
    expect(item.quantidade).toBe(60)               // 100 − 40
    expect(item.valor_unitario_estimado).toBe(120) // custo médio do estoque
    expect(rc.wbs).toBe('MRP')
    expect(rc.tipo).toBe('Material')
  })

  it('sem faltantes → 400 (não cria RC vazia)', async () => {
    // repõe o filtro: saldo passa a cobrir tudo
    const itens = (await auth(request(app).get('/api/almoxarifado'))).body.data
    const filtro = itens.find(i => i.codigo === 'FILTRO')
    const mov = await auth(request(app).post(`/api/almoxarifado/${filtro.id}/movimentar`)).send({ tipo: 'Entrada', quantidade: 100, valor_unitario: 120 })
    expect(mov.status).toBe(200)
    const r = await auth(request(app).post('/api/mm/mrp/gerar-rc')).send({ veiculos: 50 })
    expect(r.status).toBe(400)
  })

  it('isolamento: tenant B sem materiais → 400', async () => {
    const r = await request(app).post('/api/mm/mrp/gerar-rc').set('Authorization', `Bearer ${tokB}`).send({ veiculos: 50 })
    expect(r.status).toBe(400)
  })
})

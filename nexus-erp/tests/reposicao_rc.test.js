// ============================================================
// Testes — ELO estoque→suprimentos: gera RC a partir do ponto de reposição.
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
let request, app, db, token, tokenB, baixoId, okId

beforeAll(async () => {
  const st = await import('supertest')
  request = st.default
  ;({ app, db } = await import('../server.js'))
  token = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token
  const m = r => r.set('Authorization', `Bearer ${token}`)
  const empB = (await m(request(app).post('/api/empresas')).send({ razao_social: 'Tenant B' })).body.data.id
  await m(request(app).post('/api/usuarios')).send({ nome: 'Admin B', email: 'rep.b@x.com', senha: 'Aa@123456', perfil: 'admin', empresa_id: empB })
  tokenB = (await request(app).post('/api/auth/login').send({ email: 'rep.b@x.com', senha: 'Aa@123456' })).body?.data?.token

  // Item abaixo do mínimo (entra na reposição) + item ok (não entra).
  baixoId = (await m(request(app).post('/api/almoxarifado')).send({ codigo: 'BOTA-01', descricao: 'Bota', unidade: 'PAR', quantidade_atual: 4, quantidade_minima: 10, valor_medio: 50 })).body.data.id
  okId = (await m(request(app).post('/api/almoxarifado')).send({ codigo: 'LUVA-01', descricao: 'Luva', quantidade_atual: 100, quantidade_minima: 10, valor_medio: 2 })).body.data.id
})

const auth = r => r.set('Authorization', `Bearer ${token}`)

describe('POST /api/almoxarifado/requisicao-reposicao', () => {
  it('cria uma RC de Material com os itens em reposição e a quantidade sugerida', async () => {
    const r = await auth(request(app).post('/api/almoxarifado/requisicao-reposicao')).send({})
    expect(r.status).toBe(201)
    expect(r.body.data.tipo).toBe('Material')
    expect(r.body.data.numero).toMatch(/^RC-/)
    expect(r.body.data.itens_repostos).toBe(1) // só a bota
    const bota = r.body.data.itens.find(i => i.codigo_produto === 'BOTA-01')
    expect(bota.quantidade).toBe(16)        // alvo 2×min=20, repor 20-4
    expect(bota.valor_unitario_estimado).toBe(50)
    expect(r.body.data.valor_total).toBe(800) // 16 × 50
    // não inclui o item acima do mínimo
    expect(r.body.data.itens.some(i => i.codigo_produto === 'LUVA-01')).toBe(false)
  })

  it('a RC gerada aparece na listagem /api/rc', async () => {
    const r = await auth(request(app).get('/api/rc'))
    expect(r.body.data.some(rc => rc.observacoes && rc.observacoes.includes('Reposição automática'))).toBe(true)
  })

  it('seleção por item_ids restringe a RC', async () => {
    const r = await auth(request(app).post('/api/almoxarifado/requisicao-reposicao')).send({ item_ids: [okId] })
    // okId está acima do mínimo → não há item a repor nessa seleção
    expect(r.status).toBe(400)
  })

  it('sem itens em reposição → 400', async () => {
    // tenant B não tem itens
    const r = await request(app).post('/api/almoxarifado/requisicao-reposicao').set('Authorization', `Bearer ${tokenB}`).send({})
    expect(r.status).toBe(400)
  })
})

// ============================================================
// Testes — Almoxarifado: recursos do front agora persistem no backend
// (materiais, movimentos-estoque, emprestimos, inventarios)
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
let request, app, token

beforeAll(async () => {
  const st = await import('supertest')
  request = st.default
  ;({ app } = await import('../server.js'))
  token = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token
})

const auth = r => r.set('Authorization', `Bearer ${token}`)
const post = (rota, body) => auth(request(app).post(`/api/${rota}`)).send(body)
const get = rota => auth(request(app).get(`/api/${rota}`))

describe('Almoxarifado — materiais', () => {
  it('cria e lista material com o shape do front', async () => {
    const r = await post('materiais', { codigo: 'MAT-1', nome: 'Rolamento', estoque_atual: 10, unidade: 'UN' })
    expect(r.status).toBe(201)
    expect(r.body.data.id).toBeTruthy()
    const lista = await get('materiais')
    const it0 = lista.body.data.find(m => m.codigo === 'MAT-1')
    expect(it0.nome).toBe('Rolamento')
    expect(it0.estoque_atual).toBe(10)
  })

  it('atualiza (PUT) preservando os demais campos', async () => {
    const id = (await post('materiais', { codigo: 'MAT-2', nome: 'Correia', estoque_atual: 5 })).body.data.id
    const r = await auth(request(app).put(`/api/materiais/${id}`)).send({ estoque_atual: 8 })
    expect(r.body.data.estoque_atual).toBe(8)
    expect(r.body.data.nome).toBe('Correia')
  })
})

describe('Almoxarifado — movimentos / empréstimos / inventários', () => {
  it('persiste um movimento de estoque', async () => {
    await post('movimentos-estoque', { matId: 1, tipo: 'Entrada', qtd: 20, nf: 'NF-1' })
    const r = await auth(request(app).get('/api/movimentos-estoque?limit=500'))
    expect(r.body.data.some(m => m.nf === 'NF-1')).toBe(true)
  })
  it('persiste um empréstimo', async () => {
    const r = await post('emprestimos', { item: 'Furadeira', responsavel: 'João', status: 'Emprestado' })
    expect(r.status).toBe(201)
    expect((await get('emprestimos')).body.data.length).toBeGreaterThanOrEqual(1)
  })
  it('persiste um inventário', async () => {
    const r = await post('inventarios', { data: '2026-06-01', responsavel: 'Maria', itens: [{ codigo: 'MAT-1', contado: 9 }] })
    expect(r.status).toBe(201)
    const lista = await get('inventarios')
    expect(lista.body.data[0].itens.length).toBe(1)
  })
  it('404 ao buscar id inexistente', async () => {
    const r = await auth(request(app).get('/api/emprestimos/999999'))
    expect(r.status).toBe(404)
  })
})

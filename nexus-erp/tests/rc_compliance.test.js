// ============================================================
// Testes de integração — RC: tipo + WBS obrigatórios (compliance Onda 1)
// Rastreabilidade de custo: toda RC precisa de classificação de gasto (tipo)
// e de vínculo WBS. Sem isso, não grava.
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

const novaRC = body => request(app).post('/api/rc').set('Authorization', `Bearer ${token}`).send(body)

describe('RC — tipo obrigatório', () => {
  it('bloqueia RC sem tipo (400)', async () => {
    const r = await novaRC({ wbs: '1.2.3', departamento: 'Obras' })
    expect(r.status).toBe(400)
    expect(r.body.error || r.body.message).toMatch(/tipo/i)
  })

  it('bloqueia tipo inválido (400)', async () => {
    const r = await novaRC({ tipo: 'Consultoria', wbs: '1.2.3' })
    expect(r.status).toBe(400)
  })

  it('aceita tipo com acento/caixa e grava o canônico', async () => {
    const r1 = await novaRC({ tipo: 'serviço', wbs: '1.1' })
    expect(r1.status).toBe(201)
    expect(r1.body.data.tipo).toBe('Serviço')

    const r2 = await novaRC({ tipo: 'MATERIAL', wbs: '1.1' })
    expect(r2.body.data.tipo).toBe('Material')

    const r3 = await novaRC({ tipo: 'servico', wbs: '1.1' })
    expect(r3.body.data.tipo).toBe('Serviço')
  })
})

describe('RC — WBS obrigatória', () => {
  it('bloqueia RC sem WBS (400)', async () => {
    const r = await novaRC({ tipo: 'Material' })
    expect(r.status).toBe(400)
    expect(r.body.error || r.body.message).toMatch(/wbs/i)
  })

  it('bloqueia WBS em branco (400)', async () => {
    const r = await novaRC({ tipo: 'Material', wbs: '   ' })
    expect(r.status).toBe(400)
  })

  it('grava a WBS (aparada) quando válida', async () => {
    const r = await novaRC({ tipo: 'Equipamento', wbs: '  2.4.7  ' })
    expect(r.status).toBe(201)
    expect(r.body.data.wbs).toBe('2.4.7')
    expect(r.body.data.tipo).toBe('Equipamento')
  })
})

describe('RC — PUT preserva tipo/WBS', () => {
  let rcId
  beforeAll(async () => {
    rcId = (await novaRC({ tipo: 'Material', wbs: '3.0' })).body.data.id
  })

  it('não permite remover a WBS (400)', async () => {
    const r = await request(app).put(`/api/rc/${rcId}`).set('Authorization', `Bearer ${token}`).send({ wbs: '' })
    expect(r.status).toBe(400)
  })

  it('rejeita tipo inválido no update (400)', async () => {
    const r = await request(app).put(`/api/rc/${rcId}`).set('Authorization', `Bearer ${token}`).send({ tipo: 'xpto' })
    expect(r.status).toBe(400)
  })

  it('atualiza tipo/WBS válidos e mantém valor anterior quando omitido', async () => {
    const r = await request(app).put(`/api/rc/${rcId}`).set('Authorization', `Bearer ${token}`)
      .send({ status: 'Pendente', tipo: 'serviço' })
    expect(r.status).toBe(200)
    expect(r.body.data.tipo).toBe('Serviço')
    expect(r.body.data.wbs).toBe('3.0') // preservado
  })
})

// ============================================================
// Testes — fluxo suprimentos: aprovar RC → gerar Pedido de Compra.
// Gate de aprovação, geração de PC a partir dos itens da RC (com gates de
// compliance), conta a pagar automática e RC marcada como Atendida.
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'
process.env.ENFORCE_RECEITA_PO = '0' // sem provedor de Receita nos testes

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
let request, app, db, token, fornId, fornNaoHomId, rcId

beforeAll(async () => {
  const st = await import('supertest')
  request = st.default
  ;({ app, db } = await import('../server.js'))
  token = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token
  const m = r => r.set('Authorization', `Bearer ${token}`)
  fornId = (await m(request(app).post('/api/fornecedores')).send({ nome: 'Forn Homologado', status: 'Homologado' })).body.data.id
  fornNaoHomId = (await m(request(app).post('/api/fornecedores')).send({ nome: 'Forn Pendente', status: 'Em Análise' })).body.data.id
  // RC com itens (tipo + WBS obrigatórios).
  rcId = (await m(request(app).post('/api/rc')).send({
    tipo: 'Material', wbs: 'ESTOQUE', departamento: 'Almox', itens: [
      { descricao: 'Bota', quantidade: 10, unidade: 'PAR', valor_unitario_estimado: 50 },
      { descricao: 'Luva', quantidade: 20, unidade: 'PAR', valor_unitario_estimado: 5 },
    ],
  })).body.data.id
})

const auth = r => r.set('Authorization', `Bearer ${token}`)

describe('aprovar RC', () => {
  it('gerar pedido antes de aprovar → 409', async () => {
    const r = await auth(request(app).post(`/api/rc/${rcId}/gerar-pedido`)).send({ fornecedor_id: fornId })
    expect(r.status).toBe(409)
  })
  it('aprova a RC (registra aprovador)', async () => {
    const r = await auth(request(app).post(`/api/rc/${rcId}/aprovar`)).send({})
    expect(r.status).toBe(200)
    expect(r.body.data.status).toBe('Aprovada')
    expect(r.body.data.aprovado_por).toBeTruthy()
  })
})

describe('gerar Pedido de Compra a partir da RC aprovada', () => {
  it('fornecedor não homologado é bloqueado (409)', async () => {
    const r = await auth(request(app).post(`/api/rc/${rcId}/gerar-pedido`)).send({ fornecedor_id: fornNaoHomId })
    expect(r.status).toBe(409)
    expect(r.body.error).toMatch(/homologado/i)
  })

  it('gera o PC com os itens da RC, conta a pagar e marca a RC como Atendida', async () => {
    const r = await auth(request(app).post(`/api/rc/${rcId}/gerar-pedido`)).send({ fornecedor_id: fornId })
    expect(r.status).toBe(201)
    const pc = r.body.data.pedido
    expect(pc.numero).toMatch(/^PC-/)
    expect(pc.rc_id).toBe(rcId)
    expect(pc.valor_total).toBe(600) // 10×50 + 20×5
    expect(pc.itens).toHaveLength(2)
    expect(r.body.data.rc.status).toBe('Atendida')
    // conta a pagar gerada automaticamente
    const cp = db.prepare(`SELECT * FROM contas_pagar WHERE pc_id = ?`).get(pc.id)
    expect(cp).toBeTruthy()
    expect(cp.valor).toBe(600)
  })

  it('RC já Atendida não gera outro pedido (409)', async () => {
    const r = await auth(request(app).post(`/api/rc/${rcId}/gerar-pedido`)).send({ fornecedor_id: fornId })
    expect(r.status).toBe(409)
  })
})

// ============================================================
// Testes — Isolamento do caminho do dinheiro por tenant.
// RC, RFQ, mapas, pedidos e contas a pagar de um tenant não vazam nem
// podem ser manipulados por outro. Escopo sempre por req.user.empresa_id.
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
let request, app
let tokenA, tokenB
const A = {}  // ids criados pelo tenant A

beforeAll(async () => {
  const st = await import('supertest')
  request = st.default
  ;({ app } = await import('../server.js'))
  tokenA = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token // empresa 1
  const m = r => r.set('Authorization', `Bearer ${tokenA}`)

  // Tenant B (empresa 2) + admin.
  const empB = (await m(request(app).post('/api/empresas')).send({ razao_social: 'Tenant B' })).body.data.id
  await m(request(app).post('/api/usuarios')).send({ nome: 'Admin B', email: 'moneyb@x.com', senha: 'Aa@123456', perfil: 'admin', empresa_id: empB })
  tokenB = (await request(app).post('/api/auth/login').send({ email: 'moneyb@x.com', senha: 'Aa@123456' })).body?.data?.token

  // Fin + Compliance no tenant A para homologar fornecedor e emitir PC.
  await m(request(app).post('/api/usuarios')).send({ nome: 'Fin A', email: 'fina@x.com', senha: 'Aa@123456', perfil: 'financeiro' })
  await m(request(app).post('/api/usuarios')).send({ nome: 'Comp A', email: 'compa@x.com', senha: 'Aa@123456', perfil: 'compliance' })
  const finA = (await request(app).post('/api/auth/login').send({ email: 'fina@x.com', senha: 'Aa@123456' })).body.data.token
  const compA = (await request(app).post('/api/auth/login').send({ email: 'compa@x.com', senha: 'Aa@123456' })).body.data.token

  const fid = (await m(request(app).post('/api/fornecedores')).send({ nome: 'Forn A' })).body.data.id
  await request(app).post(`/api/fornecedores/${fid}/homologar/financeiro`).set('Authorization', `Bearer ${finA}`).send({})
  await request(app).post(`/api/fornecedores/${fid}/homologar/compliance`).set('Authorization', `Bearer ${compA}`).send({})

  // Cadeia do tenant A: RC → RFQ → cotações → mapa → PC (+ conta a pagar).
  A.rc = (await m(request(app).post('/api/rc')).send({ tipo: 'Material', wbs: '1.1', itens: [{ descricao: 'x', quantidade: 1, valor_unitario_estimado: 5000 }] })).body.data.id
  A.rfq = (await m(request(app).post('/api/rfq')).send({ titulo: 'RFQ A', fornecedor_ids: [fid] })).body.data.id
  const cot = (await m(request(app).post(`/api/rfq/${A.rfq}/cotacoes`)).send({ fornecedor_id: fid, valor_total: 5000 })).body.data.id
  A.mapa = (await m(request(app).post('/api/mapas')).send({ rfq_id: A.rfq, cotacao_vencedora_id: cot, fornecedor_vencedor_id: fid, valor_aprovado: 5000 })).body.data.id
  A.pc = (await m(request(app).post('/api/pedidos')).send({ mapa_id: A.mapa, fornecedor_id: fid, valor_total: 5000 })).body.data.id
})

const asA = r => r.set('Authorization', `Bearer ${tokenA}`)
const asB = r => r.set('Authorization', `Bearer ${tokenB}`)

describe('Isolamento do caminho do dinheiro', () => {
  it('as listas do tenant B estão vazias (não veem a cadeia de A)', async () => {
    for (const path of ['/api/rc', '/api/rfq', '/api/mapas', '/api/pedidos', '/api/contas-pagar']) {
      const r = await asB(request(app).get(path))
      expect(r.status).toBe(200)
      expect(r.body.data.length).toBe(0)
    }
  })

  it('o tenant A enxerga a própria cadeia', async () => {
    const rc = await asA(request(app).get('/api/rc'))
    expect(rc.body.data.some(x => x.id === A.rc)).toBe(true)
    const pc = await asA(request(app).get('/api/pedidos'))
    expect(pc.body.data.some(x => x.id === A.pc)).toBe(true)
    const cp = await asA(request(app).get('/api/contas-pagar'))
    expect(cp.body.data.length).toBeGreaterThanOrEqual(1) // conta gerada pela PC
  })

  it('GET de RC/RFQ/pedido de A pelo tenant B → 404', async () => {
    expect((await asB(request(app).get(`/api/rc/${A.rc}`))).status).toBe(404)
    expect((await asB(request(app).get(`/api/rfq/${A.rfq}`))).status).toBe(404)
    expect((await asB(request(app).get(`/api/pedidos/${A.pc}`))).status).toBe(404)
  })

  it('tenant B NÃO edita a RC de A → 404 (e A continua íntegra)', async () => {
    const r = await asB(request(app).put(`/api/rc/${A.rc}`)).send({ status: 'Cancelada' })
    expect(r.status).toBe(404)
    const check = await asA(request(app).get(`/api/rc/${A.rc}`))
    expect(check.body.data.status).not.toBe('Cancelada')
  })

  it('tenant B NÃO aprova o mapa de A → 404', async () => {
    const r = await asB(request(app).post(`/api/mapas/${A.mapa}/aprovar`)).send({})
    expect(r.status).toBe(404)
  })

  it('tenant B NÃO cancela o pedido de A → 404', async () => {
    const r = await asB(request(app).post(`/api/pedidos/${A.pc}/cancelar`)).send({ motivo: 'x' })
    expect(r.status).toBe(404)
  })

  it('tenant B NÃO adiciona cotação no RFQ de A → 404', async () => {
    const r = await asB(request(app).post(`/api/rfq/${A.rfq}/cotacoes`)).send({ fornecedor_id: 1, valor_total: 1 })
    expect(r.status).toBe(404)
  })
})

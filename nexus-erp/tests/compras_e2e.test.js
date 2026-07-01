// ============================================================
// Testes E2E — Caminho do dinheiro (Compras ponta a ponta):
//   RC → RFQ → Cotações → Mapa (gate de concorrência) → Aprovação
//   → PC (gates homologação/receita) → Conta a Pagar automática.
// Prova, via API real, que cada transição PERSISTE e que os gates
// de compliance disparam. É a validação de "as funções funcionam".
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
let request, app, db, token, finToken, compToken, fornId

beforeAll(async () => {
  const st = await import('supertest')
  request = st.default
  ;({ app, db } = await import('../server.js'))
  token = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token
  const auth = r => r.set('Authorization', `Bearer ${token}`)
  const mk = (nome, email, perfil) => auth(request(app).post('/api/usuarios')).send({ nome, email, senha: 'Aa@123456', perfil })
  await mk('Fin E2E', 'fin.e2e@x.com', 'financeiro')
  await mk('Comp E2E', 'comp.e2e@x.com', 'compliance')
  finToken = (await request(app).post('/api/auth/login').send({ email: 'fin.e2e@x.com', senha: 'Aa@123456' })).body?.data?.token
  compToken = (await request(app).post('/api/auth/login').send({ email: 'comp.e2e@x.com', senha: 'Aa@123456' })).body?.data?.token
  // Fornecedor homologado (Financeiro + Compliance) para liberar a PC.
  fornId = (await auth(request(app).post('/api/fornecedores')).send({ nome: 'Aço Forte Ltda' })).body.data.id
  await request(app).post(`/api/fornecedores/${fornId}/homologar/financeiro`).set('Authorization', `Bearer ${finToken}`).send({})
  await request(app).post(`/api/fornecedores/${fornId}/homologar/compliance`).set('Authorization', `Bearer ${compToken}`).send({})
})

const auth = r => r.set('Authorization', `Bearer ${token}`)

describe('Compras E2E — RC → RFQ → Mapa → PC → Conta a Pagar', () => {
  it('percorre a cadeia completa e persiste cada estágio', async () => {
    // 1) RC com tipo + WBS + itens (rastreabilidade de custo)
    const rcRes = await auth(request(app).post('/api/rc')).send({
      departamento: 'Manutenção', tipo: 'Material', wbs: '1.2.3',
      itens: [{ descricao: 'Chapa de aço', quantidade: 10, unidade: 'UN', valor_unitario_estimado: 2000 }],
    })
    expect(rcRes.status).toBe(201)
    const rc = rcRes.body.data
    expect(rc.numero).toMatch(/^RC-\d{4}-\d{3}$/)
    expect(rc.valor_total).toBe(20000)
    expect(rc.wbs).toBe('1.2.3')

    // 2) RFQ vinculada à RC
    const rfqRes = await auth(request(app).post('/api/rfq')).send({
      rc_id: rc.id, rc_numero: rc.numero, titulo: 'Cotação chapa de aço',
      fornecedor_ids: [fornId], valor_estimado: 20000,
    })
    expect(rfqRes.status).toBe(201)
    const rfq = rfqRes.body.data
    expect(rfq.rc_id).toBe(rc.id)

    // 3) Três cotações (compra > R$10k exige concorrência mínima = 3)
    let vencedora
    for (let i = 0; i < 3; i++) {
      const c = await auth(request(app).post(`/api/rfq/${rfq.id}/cotacoes`)).send({
        fornecedor_id: fornId, valor_total: 19000 + i * 500,
      })
      expect(c.status).toBe(201)
      if (i === 0) vencedora = c.body.data
    }
    const rfqFull = (await auth(request(app).get(`/api/rfq/${rfq.id}`))).body.data
    expect(rfqFull.cotacoes.length).toBe(3)

    // 4) Mapa comparativo (gate de concorrência passa com 3 cotações)
    const mapaRes = await auth(request(app).post('/api/mapas')).send({
      rfq_id: rfq.id, cotacao_vencedora_id: vencedora.id,
      fornecedor_vencedor_id: fornId, valor_aprovado: 19000, economia_gerada: 1000,
    })
    expect(mapaRes.status).toBe(201)
    const mapa = mapaRes.body.data
    expect(mapa.status).toBe('Em análise')
    // cotação vencedora marcada
    const cotVenc = db.prepare('SELECT vencedor FROM cotacoes WHERE id=?').get(vencedora.id)
    expect(cotVenc.vencedor).toBe(1)

    // 5) Aprovação do mapa
    const aprovRes = await auth(request(app).post(`/api/mapas/${mapa.id}/aprovar`)).send({ comentario: 'ok' })
    expect(aprovRes.status).toBe(200)
    expect(aprovRes.body.data.status).toBe('Aprovado')

    // 6) PC emitida do mapa (fornecedor homologado libera)
    const pcRes = await auth(request(app).post('/api/pedidos')).send({
      mapa_id: mapa.id, mapa_numero: mapa.numero, rc_id: rc.id,
      fornecedor_id: fornId, valor_total: 19000,
      itens: [{ descricao: 'Chapa de aço', quantidade: 10, valor_unitario: 1900 }],
    })
    expect(pcRes.status).toBe(201)
    const pc = pcRes.body.data
    expect(pc.numero).toMatch(/^PC-\d{4}-\d{3}$/)
    expect(pc.mapa_id).toBe(mapa.id)

    // 7) Conta a pagar gerada automaticamente e visível pelo pedido
    const pcFull = (await auth(request(app).get(`/api/pedidos/${pc.id}`))).body.data
    expect(pcFull.itens.length).toBe(1)
    expect(pcFull.contas_pagar.length).toBe(1)
    expect(pcFull.contas_pagar[0].valor).toBe(19000)
    expect(pcFull.historico.length).toBeGreaterThanOrEqual(1)
  })

  it('gate: RC sem WBS é bloqueada (400)', async () => {
    const r = await auth(request(app).post('/api/rc')).send({ tipo: 'Material', itens: [] })
    expect(r.status).toBe(400)
    expect(r.body.error).toMatch(/WBS/i)
  })

  it('gate: RC sem tipo válido é bloqueada (400)', async () => {
    const r = await auth(request(app).post('/api/rc')).send({ wbs: '1.1', itens: [] })
    expect(r.status).toBe(400)
  })

  it('gate: concorrência mínima bloqueia mapa >R$10k com <3 cotações (409)', async () => {
    const rfq = (await auth(request(app).post('/api/rfq')).send({ titulo: 'RFQ curta', fornecedor_ids: [fornId] })).body.data
    const c = (await auth(request(app).post(`/api/rfq/${rfq.id}/cotacoes`)).send({ fornecedor_id: fornId, valor_total: 25000 })).body.data
    const r = await auth(request(app).post('/api/mapas')).send({
      rfq_id: rfq.id, cotacao_vencedora_id: c.id, fornecedor_vencedor_id: fornId, valor_aprovado: 25000,
    })
    expect(r.status).toBe(409)
    expect(r.body.error).toMatch(/cota|concorr/i)
  })

  it('gate: exceção de concorrência liberada com justificativa (admin/diretor)', async () => {
    const rfq = (await auth(request(app).post('/api/rfq')).send({ titulo: 'RFQ exceção', fornecedor_ids: [fornId] })).body.data
    const c = (await auth(request(app).post(`/api/rfq/${rfq.id}/cotacoes`)).send({ fornecedor_id: fornId, valor_total: 30000 })).body.data
    const r = await auth(request(app).post('/api/mapas')).send({
      rfq_id: rfq.id, cotacao_vencedora_id: c.id, fornecedor_vencedor_id: fornId,
      valor_aprovado: 30000, justificativa: 'Fornecedor único homologado para a liga',
    })
    expect(r.status).toBe(201)
  })

  it('gate: PC para fornecedor NÃO homologado é bloqueada (409)', async () => {
    const novo = (await auth(request(app).post('/api/fornecedores')).send({ nome: 'Novo Sem Homolog' })).body.data.id
    const r = await auth(request(app).post('/api/pedidos')).send({ fornecedor_id: novo, valor_total: 5000 })
    expect(r.status).toBe(409)
    expect(r.body.error).toMatch(/homologad/i)
  })
})

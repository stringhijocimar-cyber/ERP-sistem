// ============================================================
// Testes de integração — Concorrência mínima (Onda 1)
// Compras acima de R$10.000 exigem 3 cotações; exceção só com
// justificativa + Diretor, registrada na trilha de auditoria.
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
let request, app, db, adminToken, opToken, forn = []

beforeAll(async () => {
  const st = await import('supertest')
  request = st.default
  ;({ app, db } = await import('../server.js'))
  adminToken = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token

  for (const n of ['F1', 'F2', 'F3']) forn.push(db.prepare(`INSERT INTO fornecedores(nome) VALUES(?)`).run(n).lastInsertRowid)

  await request(app).post('/api/usuarios').set('Authorization', `Bearer ${adminToken}`)
    .send({ nome: 'Op', email: 'op.conc@x.com', senha: 'Op@12345', perfil: 'operacao' })
  opToken = (await request(app).post('/api/auth/login').send({ email: 'op.conc@x.com', senha: 'Op@12345' })).body?.data?.token
})

let rfqSeq = 0
// Cria uma RFQ com `n` cotações e devolve o id da RFQ + a 1ª cotação (vencedora).
function novaRFQ(n) {
  rfqSeq++
  const rfqId = db.prepare(`INSERT INTO rfq(numero, titulo, status) VALUES(?, ?, 'Aberta')`).run(`RFQ-T-${rfqSeq}`, `Cotação ${rfqSeq}`).lastInsertRowid
  let primeira
  for (let i = 0; i < n; i++) {
    const id = db.prepare(`INSERT INTO cotacoes(rfq_id, fornecedor_id, valor_total, status) VALUES(?,?,?,'Recebida')`)
      .run(rfqId, forn[i % forn.length], 1000 * (i + 1)).lastInsertRowid
    if (i === 0) primeira = id
  }
  return { rfqId, cotacaoId: primeira }
}

const criarMapa = (tok, body) => request(app).post('/api/mapas').set('Authorization', `Bearer ${tok}`).send(body)

describe('Concorrência mínima', () => {
  it('permite abaixo do limiar (R$10k) mesmo com 1 cotação', async () => {
    const { rfqId, cotacaoId } = novaRFQ(1)
    const r = await criarMapa(adminToken, { rfq_id: rfqId, cotacao_vencedora_id: cotacaoId, fornecedor_vencedor_id: forn[0], valor_aprovado: 5000 })
    expect(r.status).toBe(201)
  })

  it('permite acima do limiar com 3 cotações', async () => {
    const { rfqId, cotacaoId } = novaRFQ(3)
    const r = await criarMapa(adminToken, { rfq_id: rfqId, cotacao_vencedora_id: cotacaoId, fornecedor_vencedor_id: forn[0], valor_aprovado: 25000 })
    expect(r.status).toBe(201)
  })

  it('bloqueia acima do limiar com <3 cotações e sem justificativa (409)', async () => {
    const { rfqId, cotacaoId } = novaRFQ(2)
    const r = await criarMapa(adminToken, { rfq_id: rfqId, cotacao_vencedora_id: cotacaoId, fornecedor_vencedor_id: forn[0], valor_aprovado: 25000 })
    expect(r.status).toBe(409)
    expect(r.body.error).toMatch(/cotações|cotacoes/i)
  })

  it('bloqueia exceção quando há justificativa mas o usuário não é Diretor (409)', async () => {
    const { rfqId, cotacaoId } = novaRFQ(2)
    const r = await criarMapa(opToken, { rfq_id: rfqId, cotacao_vencedora_id: cotacaoId, fornecedor_vencedor_id: forn[0], valor_aprovado: 25000, justificativa: 'fornecedor exclusivo' })
    expect(r.status).toBe(409)
  })

  it('permite exceção com justificativa + Diretor e registra na trilha', async () => {
    const antes = db.prepare(`SELECT COUNT(*) n FROM logs_sistema WHERE acao='concorrencia_excecao'`).get().n
    const { rfqId, cotacaoId } = novaRFQ(2)
    const r = await criarMapa(adminToken, { rfq_id: rfqId, cotacao_vencedora_id: cotacaoId, fornecedor_vencedor_id: forn[0], valor_aprovado: 25000, justificativa: 'fornecedor exclusivo homologado' })
    expect(r.status).toBe(201)
    const depois = db.prepare(`SELECT COUNT(*) n FROM logs_sistema WHERE acao='concorrencia_excecao'`).get().n
    expect(depois).toBe(antes + 1)
  })
})

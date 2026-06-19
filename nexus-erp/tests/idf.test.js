// ============================================================
// Testes — IDF (Índice de Desempenho do Fornecedor): OTD + avaliações
// Lib pura + endpoint /api/fornecedores/:id/idf.
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'
import { calcularIDF } from '../lib/idf.js'

const d = off => new Date(Date.now() + off * 864e5).toISOString().slice(0, 10)

describe('calcularIDF (lib pura)', () => {
  it('sem dados → classificacao "Sem dados" e score null', () => {
    const r = calcularIDF({})
    expect(r.score).toBeNull()
    expect(r.classificacao).toBe('Sem dados')
  })

  it('OTD 100% sem avaliações → score = OTD, classe A', () => {
    const pedidos = [
      { enviado_em: d(-20), prazo_entrega: 7, entregue_em: d(-15) }, // no prazo
      { enviado_em: d(-30), prazo_entrega: 10, entregue_em: d(-25) }, // no prazo
    ]
    const r = calcularIDF({ pedidos })
    expect(r.otd_pct).toBe(100)
    expect(r.score).toBe(100)
    expect(r.classificacao).toBe('A')
    expect(r.entregas_consideradas).toBe(2)
  })

  it('entrega atrasada derruba o OTD', () => {
    const pedidos = [
      { enviado_em: d(-30), prazo_entrega: 7, entregue_em: d(-22) }, // atrasou (8d > 7)
      { enviado_em: d(-30), prazo_entrega: 7, entregue_em: d(-26) }, // no prazo
    ]
    const r = calcularIDF({ pedidos })
    expect(r.otd_pct).toBe(50)
  })

  it('combina OTD (60%) + avaliações (40%)', () => {
    const pedidos = [{ enviado_em: d(-20), prazo_entrega: 7, entregue_em: d(-15) }] // OTD 100
    const avaliacoes = [{ nota_media: 4 }, { nota_media: 4 }] // média 4/5 = 80
    const r = calcularIDF({ pedidos, avaliacoes })
    expect(r.score).toBe(92) // 0.6*100 + 0.4*80
    expect(r.avaliacao_media).toBe(4)
    expect(r.componentes.length).toBe(2)
  })

  it('só avaliações (sem entregas) → score pela avaliação', () => {
    const r = calcularIDF({ avaliacoes: [{ nota_media: 5 }] })
    expect(r.otd_pct).toBeNull()
    expect(r.score).toBe(100)
  })
})

describe('Endpoint /api/fornecedores/:id/idf', () => {
  const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
  let request, app, db, token
  beforeAll(async () => {
    process.env.NODE_ENV = 'test'; process.env.DB_PATH = ':memory:'; process.env.SEED_PASSWORD = 'Fraser@2025'
    const st = await import('supertest'); request = st.default
    ;({ app, db } = await import('../server.js'))
    token = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token
  })

  it('consolida OTD + avaliações do fornecedor', async () => {
    const fid = db.prepare(`INSERT INTO fornecedores(nome) VALUES('Forn IDF')`).run().lastInsertRowid
    db.prepare(`INSERT INTO pedidos_compra(numero, fornecedor_id, status, enviado_em, prazo_entrega, entregue_em) VALUES('PC-IDF-1', ?, 'Entregue', ?, 7, ?)`)
      .run(fid, d(-20), d(-15))
    db.prepare(`INSERT INTO avaliacoes_fornecedor(fornecedor_id, usuario_id, nota_media) VALUES(?, 1, 4)`).run(fid)
    const r = await request(app).get(`/api/fornecedores/${fid}/idf`).set('Authorization', `Bearer ${token}`)
    expect(r.status).toBe(200)
    expect(r.body.data.otd_pct).toBe(100)
    expect(r.body.data.avaliacao_media).toBe(4)
    expect(r.body.data.classificacao).toBe('A')
  })

  it('o detalhe do fornecedor também traz o idf', async () => {
    const fid = db.prepare(`INSERT INTO fornecedores(nome) VALUES('Forn IDF2')`).run().lastInsertRowid
    const r = await request(app).get(`/api/fornecedores/${fid}`).set('Authorization', `Bearer ${token}`)
    expect(r.body.data.idf).toBeTruthy()
    expect(r.body.data.idf.classificacao).toBe('Sem dados')
  })

  it('404 para fornecedor inexistente', async () => {
    const r = await request(app).get('/api/fornecedores/999999/idf').set('Authorization', `Bearer ${token}`)
    expect(r.status).toBe(404)
  })
})

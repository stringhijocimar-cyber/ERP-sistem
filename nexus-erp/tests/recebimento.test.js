// ============================================================
// Testes de integração — Recebimento por item + auto-feed no 3-way (Express)
// Prova que o gate puxa o recebido do banco sem precisar no corpo do /pagar.
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
let request, app, db, token, pcId, fid

beforeAll(async () => {
  const st = await import('supertest')
  request = st.default
  ;({ app, db } = await import('../server.js'))
  token = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token
  fid = (await request(app).post('/api/fornecedores').set('Authorization', `Bearer ${token}`).send({ nome: 'Forn Rec' })).body.data.id
  pcId = db.prepare(`INSERT INTO pedidos_compra(numero, fornecedor_id, status, valor_total) VALUES(?,?,?,?)`).run('PC-REC-1', fid, 'Emitido', 100).lastInsertRowid
  db.prepare(`INSERT INTO pc_itens(pc_id, descricao, quantidade, valor_unitario, codigo_produto) VALUES(?,?,?,?,?)`).run(pcId, 'Parafuso', 100, 1.0, 'A')
})

const auth = r => r.set('Authorization', `Bearer ${token}`)
let seq = 0
function conta() {
  seq++
  return db.prepare(`INSERT INTO contas_pagar(numero, pc_id, valor, status, nota_fiscal, descricao) VALUES(?,?,?,?,?,?)`)
    .run('CP-REC-' + seq, pcId, 100, 'Aprovado', 'NF-1', 'Conta').lastInsertRowid
}
const pagar = (id, body) => auth(request(app).post(`/api/contas-pagar/${id}/pagar`)).send(body || {})

describe('Recebimento por item + auto-feed', () => {
  it('registra recebimento com itens e lista por pedido', async () => {
    const r = await auth(request(app).post('/api/recebimentos')).send({
      pc_id: pcId, nf_numero: 'NF-1', valor_nf: 60,
      itens: [{ codigo_produto: 'A', descricao: 'Parafuso', quantidade_recebida: 60 }],
    })
    expect(r.status).toBe(201)
    expect(r.body.data.itens).toHaveLength(1)
    const g = await auth(request(app).get('/api/recebimentos?pc_id=' + pcId))
    expect(g.body.data[0].itens[0].quantidade_recebida).toBe(60)
  })

  it('gate BLOQUEIA pagar 100 quando só 60 foram recebidos (auto-feed, sem itens no corpo)', async () => {
    const id = conta()
    const r = await pagar(id, { itens_nota: [{ codigo: 'A', qtd: 100, preco: 1.0 }] })
    expect(r.status).toBe(409)
    expect(r.body.error).toMatch(/3-way/i)
  })

  it('após receber o restante (acumulado 100), o pagamento de 100 é liberado', async () => {
    await auth(request(app).post('/api/recebimentos')).send({
      pc_id: pcId, nf_numero: 'NF-1', valor_nf: 40,
      itens: [{ codigo_produto: 'A', descricao: 'Parafuso', quantidade_recebida: 40 }],
    })
    const id = conta()
    const r = await pagar(id, { itens_nota: [{ codigo: 'A', qtd: 100, preco: 1.0 }] })
    expect(r.status).toBe(200)
    expect(r.body.data.status).toBe('Pago')
  })
})

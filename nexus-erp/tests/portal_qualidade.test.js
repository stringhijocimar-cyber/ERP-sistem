// ============================================================
// Testes — Portal · Qualidade + notificações ao fornecedor nos
// eventos-chave (nova RFQ, pedido emitido, pagamento realizado).
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'
process.env.ENFORCE_RECEITA_PO = '0'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
let request, app, db, token, tokF1, f1, userF1Id, pcId

const D = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10)

beforeAll(async () => {
  const st = await import('supertest')
  request = st.default
  ;({ app, db } = await import('../server.js'))
  token = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token
  const m = r => r.set('Authorization', `Bearer ${token}`)
  f1 = (await m(request(app).post('/api/fornecedores')).send({ nome: 'Aços Alfa', status: 'Homologado' })).body.data.id
  const u = (await m(request(app).post('/api/usuarios')).send({ nome: 'U1', email: 'qual1@f.com', senha: 'Aa@123456', perfil: 'fornecedor', fornecedor_id: f1, empresa_id: 1 })).body.data
  userF1Id = u.id
  tokF1 = (await request(app).post('/api/auth/login').send({ email: 'qual1@f.com', senha: 'Aa@123456' })).body?.data?.token
})

const asF1 = r => r.set('Authorization', `Bearer ${tokF1}`)
const notifsDoUsuario = () => db.prepare(`SELECT * FROM notificacoes WHERE usuario_id = ? ORDER BY id`).all(userF1Id)

describe('notificações ao fornecedor nos eventos-chave', () => {
  it('nova RFQ convidada notifica o usuário do portal', async () => {
    await request(app).post('/api/rfq').set('Authorization', `Bearer ${token}`)
      .send({ titulo: 'Chapa A36', prazo_resposta: D(5), fornecedor_ids: [f1] })
    const n = notifsDoUsuario().find(x => x.tipo === 'rfq')
    expect(n).toBeTruthy()
    expect(n.titulo).toContain('Nova cotação')
    expect(n.mensagem).toContain('Chapa A36')
  })
  it('pedido emitido notifica o fornecedor', async () => {
    pcId = (await request(app).post('/api/pedidos').set('Authorization', `Bearer ${token}`)
      .send({ fornecedor_id: f1, valor_total: 50000, prazo_entrega: D(10) })).body.data.id
    const n = notifsDoUsuario().find(x => x.tipo === 'pedido')
    expect(n).toBeTruthy()
    expect(n.titulo).toContain('Pedido emitido')
  })
  it('pagamento realizado notifica o fornecedor', async () => {
    // Prepara a conta do pedido para passar no gate (NF + status aprovado).
    db.prepare(`UPDATE contas_pagar SET nota_fiscal='NF-1', status='Aprovado' WHERE pc_id = ?`).run(pcId)
    const conta = db.prepare(`SELECT id FROM contas_pagar WHERE pc_id = ?`).get(pcId)
    const r = await request(app).post(`/api/contas-pagar/${conta.id}/pagar`).set('Authorization', `Bearer ${token}`).send({})
    expect(r.status).toBe(200)
    const n = notifsDoUsuario().find(x => x.tipo === 'pagamento')
    expect(n).toBeTruthy()
    expect(n.mensagem).toContain('50000.00')
  })
  it('o fornecedor vê as notificações no feed padrão /api/notificacoes', async () => {
    const r = await asF1(request(app).get('/api/notificacoes'))
    const tipos = r.body.data.map(n => n.tipo)
    expect(tipos).toContain('rfq')
    expect(tipos).toContain('pedido')
    expect(tipos).toContain('pagamento')
  })
})

describe('GET /api/portal/qualidade', () => {
  it('consolida médias, avaliações, alertas (nota baixa + docs) e OTIF', async () => {
    // Avaliação com qualidade baixa + doc vencido.
    await request(app).post(`/api/fornecedores/${f1}/avaliacoes`).set('Authorization', `Bearer ${token}`)
      .send({ nota_qualidade: 2, nota_prazo: 4, nota_preco: 4, nota_atendimento: 4, nota_media: 3.5, comentario: 'Chapa fora de espessura' })
    await asF1(request(app).post('/api/portal/documentos')).send({ tipo: 'CRF FGTS', validade: D(-2) })
    const q = (await asF1(request(app).get('/api/portal/qualidade'))).body.data
    expect(q.medias.total).toBe(1)
    expect(q.medias.qualidade).toBe(2)
    expect(q.avaliacoes[0].comentario).toContain('espessura')
    const tipos = q.alertas.map(a => a.tipo)
    expect(tipos).toContain('qualidade_baixa')
    expect(tipos).toContain('documento_vencido')
    expect(q.otif).toHaveProperty('otif_pct')
  })
  it('perfil interno barrado (403)', async () => {
    const r = await request(app).get('/api/portal/qualidade').set('Authorization', `Bearer ${token}`)
    expect(r.status).toBe(403)
  })
})

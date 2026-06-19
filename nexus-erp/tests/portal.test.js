// ============================================================
// Testes de integração — Portal do Fornecedor (escopo/isolamento)
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
let request, app, db, adminToken, fornToken, fidA, fidB, pedA, pedB

beforeAll(async () => {
  const st = await import('supertest')
  request = st.default
  ;({ app, db } = await import('../server.js'))
  adminToken = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token

  const mk = (nome) => request(app).post('/api/fornecedores').set('Authorization', `Bearer ${adminToken}`)
    .send({ nome, contato_nome: 'Contato', email: 'c@x.com', telefone: '(11) 90000-0000' })
  fidA = (await mk('Forn A')).body.data.id
  fidB = (await mk('Forn B')).body.data.id

  pedA = db.prepare(`INSERT INTO pedidos_compra(numero, fornecedor_id, status, valor_total) VALUES(?,?,?,?)`).run('PC-A-1', fidA, 'Emitido', 500).lastInsertRowid
  pedB = db.prepare(`INSERT INTO pedidos_compra(numero, fornecedor_id, status, valor_total) VALUES(?,?,?,?)`).run('PC-B-1', fidB, 'Emitido', 700).lastInsertRowid

  // Usuário de portal vinculado ao fornecedor A.
  await request(app).post('/api/usuarios').set('Authorization', `Bearer ${adminToken}`)
    .send({ nome: 'Portal A', email: 'portal.a@forn.com', senha: 'Portal@123', perfil: 'fornecedor', fornecedor_id: fidA })
  fornToken = (await request(app).post('/api/auth/login').send({ email: 'portal.a@forn.com', senha: 'Portal@123' })).body?.data?.token
})

const pAuth = r => r.set('Authorization', `Bearer ${fornToken}`)

describe('Portal — isolamento de acesso', () => {
  it('fornecedor vê só os próprios pedidos', async () => {
    const r = await pAuth(request(app).get('/api/portal/pedidos'))
    expect(r.status).toBe(200)
    const nums = r.body.data.map(p => p.numero)
    expect(nums).toContain('PC-A-1')
    expect(nums).not.toContain('PC-B-1')
  })

  it('envia NF no próprio pedido (200) mas é bloqueado no de outro (403)', async () => {
    const ok = await pAuth(request(app).post(`/api/portal/pedidos/${pedA}/nf`)).send({ nf_numero: 'NF-A-1', nf_valor: 500 })
    expect(ok.status).toBe(200)
    expect(ok.body.data.status).toBe('NF Enviada')

    const blocked = await pAuth(request(app).post(`/api/portal/pedidos/${pedB}/nf`)).send({ nf_numero: 'NF-HACK' })
    expect(blocked.status).toBe(403)
  })

  it('perfil retorna o próprio fornecedor e edita só contato/bancário', async () => {
    const g = await pAuth(request(app).get('/api/portal/perfil'))
    expect(g.body.data.id).toBe(fidA)
    const u = await pAuth(request(app).put('/api/portal/perfil')).send({ telefone: '(11) 91111-2222', score_credito: 999 })
    expect(u.body.data.telefone).toBe('(11) 91111-2222')
    // crédito não é editável pelo portal:
    const chk = db.prepare('SELECT score_credito FROM fornecedores WHERE id=?').get(fidA)
    expect(chk.score_credito).not.toBe(999)
  })

  it('não-fornecedor (admin) é barrado no portal (403)', async () => {
    const r = await request(app).get('/api/portal/pedidos').set('Authorization', `Bearer ${adminToken}`)
    expect(r.status).toBe(403)
  })

  it('criar usuário fornecedor sem vínculo falha (400)', async () => {
    const r = await request(app).post('/api/usuarios').set('Authorization', `Bearer ${adminToken}`)
      .send({ nome: 'Sem Vinculo', email: 'sv@forn.com', senha: 'x', perfil: 'fornecedor' })
    expect(r.status).toBe(400)
  })
})

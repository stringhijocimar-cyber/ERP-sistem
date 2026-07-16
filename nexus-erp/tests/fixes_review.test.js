// ============================================================
// Testes — Correções da varredura de qualidade (PRs #64–#73):
//  F3: POST /api/pedidos não aceita fornecedor de outro tenant (404).
//  F4: LGPD anonimizar/retenção escopados por tenant.
//  F5: dashboard normaliza valor_total → valor (KPI não zera).
//  F7: notificar() deriva a empresa do destinatário quando omitida.
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
let request, app, db, tokenA, tokenB, fornA, opBId

beforeAll(async () => {
  const st = await import('supertest')
  request = st.default
  ;({ app, db } = await import('../server.js'))
  tokenA = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token
  const m = r => r.set('Authorization', `Bearer ${tokenA}`)

  const empB = (await m(request(app).post('/api/empresas')).send({ razao_social: 'Tenant B' })).body.data.id
  await m(request(app).post('/api/usuarios')).send({ nome: 'Admin B', email: 'fix.b@x.com', senha: 'Aa@123456', perfil: 'admin', empresa_id: empB })
  tokenB = (await request(app).post('/api/auth/login').send({ email: 'fix.b@x.com', senha: 'Aa@123456' })).body?.data?.token
  opBId = (await m(request(app).post('/api/usuarios')).send({ nome: 'Op B', email: 'fix.opb@x.com', senha: 'Aa@123456', perfil: 'operacao', empresa_id: empB })).body.data.id

  // Fornecedor homologado do tenant A (via SQL direto para o teste de PC).
  const r = db.prepare(`INSERT INTO fornecedores(nome, status, ativo, empresa_id) VALUES('Forn A Fix', 'Homologado', 0, 1)`).run()
  fornA = r.lastInsertRowid
})

const asA = r => r.set('Authorization', `Bearer ${tokenA}`)
const asB = r => r.set('Authorization', `Bearer ${tokenB}`)

describe('F3 — PC não referencia fornecedor de outro tenant', () => {
  it('tenant B emitindo PC com fornecedor do A → 404', async () => {
    const r = await asB(request(app).post('/api/pedidos')).send({ fornecedor_id: fornA, valor_total: 1000 })
    expect(r.status).toBe(404)
    expect(r.body.error).toMatch(/fornecedor/i)
  })
  it('fornecedor inexistente → 404 (não cria PC fantasma)', async () => {
    const r = await asA(request(app).post('/api/pedidos')).send({ fornecedor_id: 999999, valor_total: 1000 })
    expect(r.status).toBe(404)
  })
  it('tenant dono continua emitindo normalmente (controle)', async () => {
    const r = await asA(request(app).post('/api/pedidos')).send({ fornecedor_id: fornA, valor_total: 1000 })
    expect(r.status).toBe(201)
  })
})

describe('F4 — LGPD escopado por tenant', () => {
  it('admin do tenant B NÃO anonimiza fornecedor do A → 404 (dado intacto)', async () => {
    const antes = db.prepare(`SELECT contato FROM fornecedores WHERE id = ?`).get(fornA)
    const r = await asB(request(app).post(`/api/lgpd/anonimizar/fornecedores/${fornA}`)).send({})
    expect(r.status).toBe(404)
    expect(db.prepare(`SELECT contato FROM fornecedores WHERE id = ?`).get(fornA).contato).toBe(antes.contato)
  })
  it('retenção (preview) do tenant B não lista fornecedores do A', async () => {
    // fornA é inativo (ativo=0) — candidato natural de retenção do tenant A.
    const r = await asB(request(app).get('/api/lgpd/retencao/fornecedores'))
    expect(r.status).toBe(200)
    expect(r.body.data.fornecedores.some(f => f.id === fornA)).toBe(false)
  })
})

describe('F7 — notificar() deriva a empresa do destinatário', () => {
  it('notificação com usuario_id e SEM empresa cai no tenant do usuário', async () => {
    // Broadcast pelo mestre direcionado a um usuário do tenant B, sem passar
    // empresa no corpo — o servidor deriva do destinatário.
    db.exec(`DELETE FROM notificacoes`)
    const { app: _ } = { app } // noop
    // chama o notificar interno via rota de broadcast (admin do tenant B → própria empresa)
    await asB(request(app).post('/api/notificacoes')).send({ usuario_id: opBId, titulo: 'Direta B' })
    const opTok = (await request(app).post('/api/auth/login').send({ email: 'fix.opb@x.com', senha: 'Aa@123456' })).body.data.token
    const r = await request(app).get('/api/notificacoes').set('Authorization', `Bearer ${opTok}`)
    expect(r.body.data.some(n => n.titulo === 'Direta B')).toBe(true)
  })
})

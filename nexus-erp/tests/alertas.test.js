// ============================================================
// Testes de integração — Central de Alertas (agregação por módulo)
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
const d = off => new Date(Date.now() + off * 864e5).toISOString().slice(0, 10)
let request, app, db, adminToken, opToken

beforeAll(async () => {
  const st = await import('supertest')
  request = st.default
  ;({ app, db } = await import('../server.js'))
  adminToken = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token

  // Contas a pagar: vencida (ontem), a vencer (3d), controle paga (não alerta).
  const cp = db.prepare(`INSERT INTO contas_pagar(numero, descricao, valor, data_vencimento, status) VALUES(?,?,?,?,?)`)
  cp.run('CP-VENC-1', 'Atrasada', 100, d(-1), 'Pendente')
  cp.run('CP-PROX-1', 'Perto', 200, d(3), 'Pendente')
  cp.run('CP-PAGA-1', 'Quitada', 300, d(-1), 'Pago')

  // Pedidos: atrasado (enviado há 30d, prazo 7) e no prazo (enviado hoje).
  const fBase = db.prepare(`INSERT INTO fornecedores(nome) VALUES('Forn Base')`).run().lastInsertRowid
  const pc = db.prepare(`INSERT INTO pedidos_compra(numero, fornecedor_id, status, enviado_em, prazo_entrega) VALUES(?,?,?,?,?)`)
  pc.run('PC-ATR-1', fBase, 'Emitido', d(-30), 7)
  pc.run('PC-OK-1', fBase, 'Emitido', d(0), 7)

  // LGPD: fornecedor inativo antigo (dispara retenção, só admin).
  db.prepare(`INSERT INTO fornecedores(nome, ativo, anonimizado, created_at) VALUES(?,?,?,?)`)
    .run('Antigo LTDA', 0, 0, '2017-01-01')

  // Usuário interno não-admin (operação) para checar filtro do alerta LGPD.
  await request(app).post('/api/usuarios').set('Authorization', `Bearer ${adminToken}`)
    .send({ nome: 'Op', email: 'op@x.com', senha: 'Op@12345', perfil: 'operacao' })
  opToken = (await request(app).post('/api/auth/login').send({ email: 'op@x.com', senha: 'Op@12345' })).body?.data?.token
})

const get = (tok, qs = '') => request(app).get('/api/alertas' + qs).set('Authorization', `Bearer ${tok}`)

describe('Central de Alertas', () => {
  it('admin vê todas as categorias com severidade e resumo', async () => {
    const r = await get(adminToken)
    expect(r.status).toBe(200)
    const tipos = r.body.data.alertas.map(a => a.tipo)
    expect(tipos).toContain('conta_vencida')
    expect(tipos).toContain('conta_a_vencer')
    expect(tipos).toContain('entrega_atrasada')
    expect(tipos).toContain('lgpd_retencao')
    expect(r.body.data.resumo.total).toBe(r.body.data.alertas.length)
    // ordenado por severidade: o primeiro é 'alta'
    expect(r.body.data.alertas[0].severidade).toBe('alta')
  })

  it('não alerta conta já paga', async () => {
    const r = await get(adminToken)
    const refs = r.body.data.alertas.filter(a => a.tipo.startsWith('conta')).map(a => a.titulo)
    expect(refs.join(' ')).not.toContain('CP-PAGA-1')
  })

  it('janela "dias" controla as contas a vencer', async () => {
    const r1 = await get(adminToken, '?dias=1')
    expect(r1.body.data.alertas.some(a => a.tipo === 'conta_a_vencer')).toBe(false)
    const r7 = await get(adminToken, '?dias=7')
    expect(r7.body.data.alertas.some(a => a.tipo === 'conta_a_vencer')).toBe(true)
  })

  it('não-admin não recebe o alerta sensível de LGPD', async () => {
    const r = await get(opToken)
    expect(r.status).toBe(200)
    expect(r.body.data.alertas.some(a => a.tipo === 'lgpd_retencao')).toBe(false)
    // mas vê os operacionais
    expect(r.body.data.alertas.some(a => a.tipo === 'entrega_atrasada')).toBe(true)
  })

  it('fornecedor (portal) é barrado na central (403)', async () => {
    const fid = db.prepare(`INSERT INTO fornecedores(nome) VALUES('F Portal')`).run().lastInsertRowid
    await request(app).post('/api/usuarios').set('Authorization', `Bearer ${adminToken}`)
      .send({ nome: 'P', email: 'p@forn.com', senha: 'P@123456', perfil: 'fornecedor', fornecedor_id: fid })
    const tok = (await request(app).post('/api/auth/login').send({ email: 'p@forn.com', senha: 'P@123456' })).body?.data?.token
    const r = await get(tok)
    expect(r.status).toBe(403)
  })
})

// ============================================================
// Testes — Anomalias de compra na Central de Alertas (server-side).
// O motor puro (lib/anomalias.js) roda sobre os pedidos do tenant e
// publica alertas proativos: fracionamento de alçada, duplicidade etc.
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
let request, app, token, tokenB

beforeAll(async () => {
  const st = await import('supertest')
  request = st.default
  ;({ app } = await import('../server.js'))
  token = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token
  const m = r => r.set('Authorization', `Bearer ${token}`)

  // Tenant B para provar o isolamento dos alertas de anomalia.
  const empB = (await m(request(app).post('/api/empresas')).send({ razao_social: 'Tenant B' })).body.data.id
  await m(request(app).post('/api/usuarios')).send({ nome: 'Admin B', email: 'anomb@x.com', senha: 'Aa@123456', perfil: 'admin', empresa_id: empB })
  tokenB = (await request(app).post('/api/auth/login').send({ email: 'anomb@x.com', senha: 'Aa@123456' })).body?.data?.token

  // Fornecedor homologado no tenant A.
  await m(request(app).post('/api/usuarios')).send({ nome: 'Fin', email: 'fin.anom@x.com', senha: 'Aa@123456', perfil: 'financeiro' })
  await m(request(app).post('/api/usuarios')).send({ nome: 'Comp', email: 'comp.anom@x.com', senha: 'Aa@123456', perfil: 'compliance' })
  const fin = (await request(app).post('/api/auth/login').send({ email: 'fin.anom@x.com', senha: 'Aa@123456' })).body.data.token
  const comp = (await request(app).post('/api/auth/login').send({ email: 'comp.anom@x.com', senha: 'Aa@123456' })).body.data.token
  const fid = (await m(request(app).post('/api/fornecedores')).send({ nome: 'Fraciona Ltda' })).body.data.id
  await request(app).post(`/api/fornecedores/${fid}/homologar/financeiro`).set('Authorization', `Bearer ${fin}`).send({})
  await request(app).post(`/api/fornecedores/${fid}/homologar/compliance`).set('Authorization', `Bearer ${comp}`).send({})

  // Fracionamento: 2 PCs de R$30k (cada um abaixo da alçada de R$50k) na
  // mesma janela → somados furam a alçada.
  await m(request(app).post('/api/pedidos')).send({ fornecedor_id: fid, valor_total: 30000 })
  await m(request(app).post('/api/pedidos')).send({ fornecedor_id: fid, valor_total: 30000 })
})

const auth = r => r.set('Authorization', `Bearer ${token}`)

describe('Central de Alertas — anomalias de compra', () => {
  it('detecta o fracionamento de alçada nos pedidos do tenant', async () => {
    const r = await auth(request(app).get('/api/alertas'))
    expect(r.status).toBe(200)
    const frac = r.body.data.alertas.find(a => a.tipo === 'anomalia_fracionamento')
    expect(frac).toBeTruthy()
    expect(frac.severidade).toBe('alta')
    expect(frac.titulo).toMatch(/fracionamento/i)
    expect(frac.titulo).toMatch(/Fraciona Ltda/)
  })

  it('detecta a duplicidade (mesmo valor, mesmo fornecedor, janela curta)', async () => {
    const r = await auth(request(app).get('/api/alertas'))
    expect(r.body.data.alertas.some(a => a.tipo === 'anomalia_duplicidade')).toBe(true)
  })

  it('não duplica o alerta por (tipo, fornecedor)', async () => {
    const r = await auth(request(app).get('/api/alertas'))
    const fracs = r.body.data.alertas.filter(a => a.tipo === 'anomalia_fracionamento')
    expect(fracs.length).toBe(1)
  })

  it('tenant B NÃO vê as anomalias do tenant A (isolamento)', async () => {
    const r = await request(app).get('/api/alertas').set('Authorization', `Bearer ${tokenB}`)
    expect(r.status).toBe(200)
    expect(r.body.data.alertas.some(a => String(a.tipo).startsWith('anomalia_'))).toBe(false)
  })
})

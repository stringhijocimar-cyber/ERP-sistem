// ============================================================
// Testes — Portal · Documentos com validade, histórico de acessos e
// troca de senha self-service. Lib pura + endpoints + gate opcional.
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'
import { statusDocumento, vigentesPorTipo, resumoDocumentos } from '../lib/documentos.js'

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'
process.env.PORTAL_BLOQUEIA_DOC_VENCIDO = '1' // gate ligado neste teste

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
let request, app, db, token, tokF1, f1, rfqId

const D = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10)
const HOJE = D(0)

describe('lib/documentos (puro)', () => {
  it('status: vencido < hoje; a vencer na janela; válido além; sem validade', () => {
    expect(statusDocumento({ validade: D(-1) }, HOJE)).toBe('Vencido')
    expect(statusDocumento({ validade: HOJE }, HOJE)).toBe('A vencer')      // vence no fim do dia
    expect(statusDocumento({ validade: D(15) }, HOJE)).toBe('A vencer')
    expect(statusDocumento({ validade: D(60) }, HOJE)).toBe('Válido')
    expect(statusDocumento({}, HOJE)).toBe('Sem validade')
  })
  it('vigente por tipo = o mais recente (reenvio substitui sem apagar trilha)', () => {
    const docs = [
      { id: 1, tipo: 'CND Federal', validade: D(-5), created_at: '2026-01-01' },
      { id: 2, tipo: 'CND Federal', validade: D(90), created_at: '2026-06-01' },
      { id: 3, tipo: 'FGTS', validade: D(-2), created_at: '2026-06-01' },
    ]
    const vig = vigentesPorTipo(docs)
    expect(vig).toHaveLength(2)
    expect(vig.find(d => d.tipo === 'CND Federal').id).toBe(2) // a renovada vale
    const r = resumoDocumentos(docs, HOJE)
    expect(r.vencidos).toBe(1)  // só o FGTS (a CND antiga foi substituída)
    expect(r.validos).toBe(1)
  })
})

describe('endpoints', () => {
  beforeAll(async () => {
    const st = await import('supertest')
    request = st.default
    ;({ app, db } = await import('../server.js'))
    token = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token
    const m = r => r.set('Authorization', `Bearer ${token}`)
    f1 = (await m(request(app).post('/api/fornecedores')).send({ nome: 'Aços Alfa', status: 'Homologado' })).body.data.id
    await m(request(app).post('/api/usuarios')).send({ nome: 'U1', email: 'doc1@f.com', senha: 'Aa@123456', perfil: 'fornecedor', fornecedor_id: f1, empresa_id: 1 })
    tokF1 = (await request(app).post('/api/auth/login').send({ email: 'doc1@f.com', senha: 'Aa@123456' })).body?.data?.token
    rfqId = (await m(request(app).post('/api/rfq')).send({ titulo: 'Chapa', prazo_resposta: D(5), fornecedor_ids: [f1] })).body.data.id
  })

  const asF1 = r => r.set('Authorization', `Bearer ${tokF1}`)

  it('envia documento com validade e o compliance é notificado', async () => {
    const r = await asF1(request(app).post('/api/portal/documentos')).send({ tipo: 'CND Federal', validade: D(-3), arquivo_nome: 'cnd.pdf' })
    expect(r.status).toBe(201)
    expect(r.body.data.situacao).toBe('Vencido')
    const notif = db.prepare(`SELECT * FROM notificacoes WHERE tipo='documento' ORDER BY id DESC LIMIT 1`).get()
    expect(notif.titulo).toContain('Aços Alfa')
  })
  it('sem tipo → 400; validade inválida → 400', async () => {
    expect((await asF1(request(app).post('/api/portal/documentos')).send({ validade: D(10) })).status).toBe(400)
    expect((await asF1(request(app).post('/api/portal/documentos')).send({ tipo: 'FGTS', validade: 'amanhã' })).status).toBe(400)
  })
  it('GATE: certidão vencida bloqueia nova cotação (409) quando ligado', async () => {
    const r = await asF1(request(app).post(`/api/portal/rfq/${rfqId}/cotacao`)).send({ valor_total: 1000 })
    expect(r.status).toBe(409)
    expect(r.body.error).toContain('CND Federal')
  })
  it('renovar a certidão (reenvio do tipo) desbloqueia a cotação', async () => {
    await asF1(request(app).post('/api/portal/documentos')).send({ tipo: 'CND Federal', validade: D(90), arquivo_nome: 'cnd-nova.pdf' })
    const r = await asF1(request(app).post(`/api/portal/rfq/${rfqId}/cotacao`)).send({ valor_total: 1000 })
    expect(r.status).toBe(201)
  })
  it('GET /api/portal/documentos marca o vigente e resume', async () => {
    const d = (await asF1(request(app).get('/api/portal/documentos'))).body.data
    expect(d.documentos).toHaveLength(2)
    const vigente = d.documentos.find(x => x.vigente)
    expect(vigente.arquivo_nome).toBe('cnd-nova.pdf')
    expect(d.resumo.vencidos).toBe(0)
  })
  it('visão interna /api/fornecedores/:id/documentos mostra só vigentes', async () => {
    const r = await request(app).get(`/api/fornecedores/${f1}/documentos`).set('Authorization', `Bearer ${token}`)
    expect(r.body.data.documentos).toHaveLength(1)
  })
  it('histórico de acessos registra o login do portal', async () => {
    const r = await asF1(request(app).get('/api/portal/acessos'))
    expect(r.body.data.length).toBeGreaterThanOrEqual(1)
    expect(r.body.data[0]).toHaveProperty('quando')
  })
  it('trocar senha: exige atual correta + política forte; derruba outras sessões', async () => {
    expect((await asF1(request(app).post('/api/portal/trocar-senha')).send({ senha_atual: 'errada', senha_nova: 'Bb@123456' })).status).toBe(401)
    expect((await asF1(request(app).post('/api/portal/trocar-senha')).send({ senha_atual: 'Aa@123456', senha_nova: 'fraca' })).status).toBe(400)
    // Segunda sessão do mesmo usuário, que deve cair após a troca.
    const tok2 = (await request(app).post('/api/auth/login').send({ email: 'doc1@f.com', senha: 'Aa@123456' })).body?.data?.token
    const r = await asF1(request(app).post('/api/portal/trocar-senha')).send({ senha_atual: 'Aa@123456', senha_nova: 'Bb@123456' })
    expect(r.status).toBe(200)
    expect((await request(app).get('/api/portal/acessos').set('Authorization', `Bearer ${tok2}`)).status).toBe(401) // sessão antiga caiu
    expect((await asF1(request(app).get('/api/portal/acessos'))).status).toBe(200)                                  // a atual continua
    const login = await request(app).post('/api/auth/login').send({ email: 'doc1@f.com', senha: 'Bb@123456' })
    expect(login.status).toBe(200) // senha nova vale
  })
})

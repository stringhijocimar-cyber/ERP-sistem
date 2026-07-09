// ============================================================
// Testes — Storage binário real: upload/download com bytes reais e
// isolamento (dono baixa; concorrente 404; comprador do tenant baixa;
// outro tenant 404). Wire em documento/anexo.
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
let request, app, db, token, tokB, tokF1, tokF2, f1, f2, arqId
const b64 = s => Buffer.from(s).toString('base64')
const D = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10)

beforeAll(async () => {
  const st = await import('supertest')
  request = st.default
  ;({ app, db } = await import('../server.js'))
  token = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token
  const m = r => r.set('Authorization', `Bearer ${token}`)
  f1 = (await m(request(app).post('/api/fornecedores')).send({ nome: 'Alfa', status: 'Homologado' })).body.data.id
  f2 = (await m(request(app).post('/api/fornecedores')).send({ nome: 'Beta', status: 'Homologado' })).body.data.id
  await m(request(app).post('/api/usuarios')).send({ nome: 'U1', email: 'arq1@f.com', senha: 'Aa@123456', perfil: 'fornecedor', fornecedor_id: f1, empresa_id: 1 })
  await m(request(app).post('/api/usuarios')).send({ nome: 'U2', email: 'arq2@f.com', senha: 'Aa@123456', perfil: 'fornecedor', fornecedor_id: f2, empresa_id: 1 })
  tokF1 = (await request(app).post('/api/auth/login').send({ email: 'arq1@f.com', senha: 'Aa@123456' })).body?.data?.token
  tokF2 = (await request(app).post('/api/auth/login').send({ email: 'arq2@f.com', senha: 'Aa@123456' })).body?.data?.token
  // Tenant B
  const empB = (await m(request(app).post('/api/empresas')).send({ razao_social: 'Tenant B' })).body.data.id
  await m(request(app).post('/api/usuarios')).send({ nome: 'AdmB', email: 'arq.b@x.com', senha: 'Aa@123456', perfil: 'admin', empresa_id: empB })
  tokB = (await request(app).post('/api/auth/login').send({ email: 'arq.b@x.com', senha: 'Aa@123456' })).body?.data?.token
})

const asF1 = r => r.set('Authorization', `Bearer ${tokF1}`)
const asF2 = r => r.set('Authorization', `Bearer ${tokF2}`)

describe('upload', () => {
  it('grava os bytes reais e devolve metadados (sem o binário)', async () => {
    const r = await asF1(request(app).post('/api/portal/arquivos')).send({ nome: 'cnd.pdf', conteudo_base64: b64('%PDF-1.4 conteudo real') })
    expect(r.status).toBe(201)
    expect(r.body.data.tamanho).toBe(22)
    expect(r.body.data.mime).toBe('application/pdf')
    expect(r.body.data.conteudo).toBeUndefined()
    arqId = r.body.data.id
    // bytes realmente no banco
    const row = db.prepare(`SELECT conteudo, tamanho FROM arquivos WHERE id = ?`).get(arqId)
    expect(row.tamanho).toBe(22)
    expect(Buffer.from(row.conteudo).toString()).toContain('%PDF-1.4')
  })
  it('extensão proibida → 400', async () => {
    expect((await asF1(request(app).post('/api/portal/arquivos')).send({ nome: 'x.exe', conteudo_base64: b64('MZ') })).status).toBe(400)
  })
})

describe('download com isolamento', () => {
  it('o dono baixa o binário com Content-Disposition', async () => {
    const r = await asF1(request(app).get(`/api/portal/arquivos/${arqId}`))
    expect(r.status).toBe(200)
    expect(r.headers['content-type']).toMatch(/application\/pdf/)
    expect(r.headers['content-disposition']).toContain('cnd.pdf')
    expect(Buffer.from(r.body).toString()).toContain('%PDF-1.4')
  })
  it('outro fornecedor do mesmo tenant NÃO baixa pelo portal (404)', async () => {
    expect((await asF2(request(app).get(`/api/portal/arquivos/${arqId}`))).status).toBe(404)
  })
  it('comprador do MESMO tenant baixa pela rota interna', async () => {
    const r = await request(app).get(`/api/arquivos/${arqId}`).set('Authorization', `Bearer ${token}`)
    expect(r.status).toBe(200)
    expect(Buffer.from(r.body).toString()).toContain('%PDF-1.4')
  })
  it('outro TENANT não baixa (404)', async () => {
    expect((await request(app).get(`/api/arquivos/${arqId}`).set('Authorization', `Bearer ${tokB}`)).status).toBe(404)
  })
})

describe('wire em documento e anexo de cotação', () => {
  it('documento referencia o arquivo do próprio fornecedor', async () => {
    const r = await asF1(request(app).post('/api/portal/documentos')).send({ tipo: 'CND Federal', validade: D(90), arquivo_id: arqId })
    expect(r.status).toBe(201)
    expect(r.body.data.arquivo_id).toBe(arqId)
    expect(r.body.data.arquivo_nome).toBe('cnd.pdf') // nome puxado do arquivo
  })
  it('documento com arquivo_id de OUTRO fornecedor ignora o vínculo (não vaza)', async () => {
    // F2 tenta referenciar o arquivo de F1.
    const r = await asF2(request(app).post('/api/portal/documentos')).send({ tipo: 'CND Federal', arquivo_id: arqId })
    expect(r.status).toBe(201)
    expect(r.body.data.arquivo_id).toBeNull() // vínculo recusado
  })
})

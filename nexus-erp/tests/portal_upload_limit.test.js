// ============================================================
// Varredura #7 (storage) — limite de corpo do upload.
// Bug: express.json() sem limit usa o padrão de 100 KB, então QUALQUER
// arquivo real (>~75 KB) era rejeitado com 413 antes da validação. O
// parser dedicado da rota de upload precisa aceitar o arquivo até o cap,
// e o excedente cai em 400 (validação), não 413.
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
let request, app, tokF1

const b64Bytes = n => Buffer.alloc(n, 0x41).toString('base64') // n bytes de 'A'

beforeAll(async () => {
  const st = await import('supertest')
  request = st.default
  ;({ app } = await import('../server.js'))
  const token = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token
  const m = r => r.set('Authorization', `Bearer ${token}`)
  const f1 = (await m(request(app).post('/api/fornecedores')).send({ nome: 'Alfa', status: 'Homologado' })).body.data.id
  await m(request(app).post('/api/usuarios')).send({ nome: 'U1', email: 'lim@f.com', senha: 'Aa@123456', perfil: 'fornecedor', fornecedor_id: f1, empresa_id: 1 })
  tokF1 = (await request(app).post('/api/auth/login').send({ email: 'lim@f.com', senha: 'Aa@123456' })).body?.data?.token
})

const asF1 = r => r.set('Authorization', `Bearer ${tokF1}`)

describe('limite de corpo do upload', () => {
  it('arquivo de 300 KB é ACEITO (antes: 413 pelo padrão de 100 KB)', async () => {
    const r = await asF1(request(app).post('/api/portal/arquivos')).send({ nome: 'grande.pdf', conteudo_base64: b64Bytes(300 * 1024) })
    expect(r.status).toBe(201)
    expect(r.body.data.tamanho).toBe(300 * 1024)
  })
  it('arquivo acima do cap (6 MB) → 400 da validação, não 413 de transporte', async () => {
    const r = await asF1(request(app).post('/api/portal/arquivos')).send({ nome: 'enorme.pdf', conteudo_base64: b64Bytes(6 * 1024 * 1024) })
    expect(r.status).toBe(400)
    expect(r.body.error).toMatch(/limite/)
  })
  it('endpoint comum (não-upload) segue no limite normal (1 MB)', async () => {
    // Um POST gigante numa rota comum é rejeitado (413) — o teto grande é só do upload.
    const r = await asF1(request(app).post('/api/portal/rfq/1/cotacao')).send({ observacoes: 'x'.repeat(2 * 1024 * 1024) })
    expect(r.status).toBe(413)
  })
})

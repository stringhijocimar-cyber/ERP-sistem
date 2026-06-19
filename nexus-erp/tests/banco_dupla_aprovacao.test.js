// ============================================================
// Testes — Dupla aprovação de dados bancários (Onda 2)
// Alteração de banco/agência/conta de fornecedor fica PENDENTE até a
// aprovação de uma 2ª pessoa (segregação anti-desvio de pagamento).
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
let request, app, db, adminToken, finToken, dirToken

beforeAll(async () => {
  const st = await import('supertest')
  request = st.default
  ;({ app, db } = await import('../server.js'))
  adminToken = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token
  const mk = (nome, email, perfil) => request(app).post('/api/usuarios').set('Authorization', `Bearer ${adminToken}`).send({ nome, email, senha: 'Aa@123456', perfil })
  await mk('Fin Banco', 'fin.banco@x.com', 'financeiro')
  await mk('Dir Banco', 'dir.banco@x.com', 'diretor')
  finToken = (await request(app).post('/api/auth/login').send({ email: 'fin.banco@x.com', senha: 'Aa@123456' })).body?.data?.token
  dirToken = (await request(app).post('/api/auth/login').send({ email: 'dir.banco@x.com', senha: 'Aa@123456' })).body?.data?.token
})

let seq = 0
function fornComBanco() {
  seq++
  return db.prepare(`INSERT INTO fornecedores(nome, banco, agencia, conta) VALUES(?, '001', '1234', '11111-1')`).run(`F-BANK-${seq}`).lastInsertRowid
}
const editar = (tok, id, body) => request(app).put(`/api/fornecedores/${id}`).set('Authorization', `Bearer ${tok}`).send(body)
const aprovar = (tok, id) => request(app).post(`/api/fornecedores/${id}/aprovar-banco`).set('Authorization', `Bearer ${tok}`).send({})
const rejeitar = (tok, id) => request(app).post(`/api/fornecedores/${id}/rejeitar-banco`).set('Authorization', `Bearer ${tok}`).send({})
const ler = id => db.prepare(`SELECT * FROM fornecedores WHERE id = ?`).get(id)

describe('Dupla aprovação de dados bancários', () => {
  it('alteração de conta NÃO é aplicada na hora; fica pendente', async () => {
    const id = fornComBanco()
    await editar(finToken, id, { conta: '99999-9' })
    const f = ler(id)
    expect(f.conta).toBe('11111-1')          // conta viva inalterada
    expect(f.conta_pendente).toBe('99999-9') // proposta fica pendente
    expect(f.banco_solicitado_por).toBeTruthy()
  })

  it('campos não-bancários continuam sendo aplicados direto', async () => {
    const id = fornComBanco()
    await editar(finToken, id, { telefone: '(11) 90000-1111', conta: '77777-7' })
    const f = ler(id)
    expect(f.telefone).toBe('(11) 90000-1111') // aplicado
    expect(f.conta).toBe('11111-1')            // bancário segue pendente
  })

  it('o solicitante não pode aprovar a própria alteração (403)', async () => {
    const id = fornComBanco()
    await editar(finToken, id, { conta: '88888-8' })
    const r = await aprovar(finToken, id)
    expect(r.status).toBe(403)
  })

  it('uma 2ª pessoa aprova e a conta passa a valer', async () => {
    const id = fornComBanco()
    await editar(finToken, id, { banco: '341', agencia: '4567', conta: '88888-8' })
    const r = await aprovar(dirToken, id)
    expect(r.status).toBe(200)
    const f = ler(id)
    expect(f.banco).toBe('341')
    expect(f.conta).toBe('88888-8')
    expect(f.banco_solicitado_por).toBeNull() // pendência limpa
  })

  it('rejeição descarta a alteração e mantém os dados originais', async () => {
    const id = fornComBanco()
    await editar(finToken, id, { conta: '55555-5' })
    const r = await rejeitar(dirToken, id)
    expect(r.status).toBe(200)
    const f = ler(id)
    expect(f.conta).toBe('11111-1')
    expect(f.conta_pendente).toBeNull()
  })

  it('aprovar sem pendência retorna 400', async () => {
    const id = fornComBanco()
    const r = await aprovar(dirToken, id)
    expect(r.status).toBe(400)
  })
})

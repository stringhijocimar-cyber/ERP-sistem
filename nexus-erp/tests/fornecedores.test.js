// ============================================================
// Testes de integração — Cadastro de Fornecedores (Express)
// Cobre o bug "cadastro não funciona": persistência dos campos
// financeiros/crédito e dos aliases (contato_nome, prazo_pagamento).
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }

let request, app, token

beforeAll(async () => {
  const st = await import('supertest')
  request = st.default
  ;({ app } = await import('../server.js'))
  const r = await request(app).post('/api/auth/login').send(ADMIN)
  token = r.body?.data?.token
})

describe('POST /api/fornecedores', () => {
  it('cadastra fornecedor com dados financeiros e de crédito e os persiste', async () => {
    const payload = {
      nome: 'Fornecedor Teste Ltda', razao_social: 'Fornecedor Teste Ltda', nome_fantasia: 'FT',
      cnpj: '11.222.333/0001-81', email: 'contato@ft.com.br',
      contato_nome: 'João', prazo_pagamento: 45,
      banco: '001', agencia: '1234', conta: '56789-0',
      faturamento_anual: 5000000, limite_credito: 200000,
      score_credito: 82, classificacao_credito: 'A',
      analise_credito: JSON.stringify({ score: 82, classe: 'A' }),
      status: 'Ativo', ativo: 1,
    }
    const r = await request(app).post('/api/fornecedores').set('Authorization', `Bearer ${token}`).send(payload)
    expect(r.status).toBe(201)
    expect(r.body?.success).toBe(true)
    const f = r.body.data
    // Campos antes perdidos agora persistem:
    expect(f.contato).toBe('João')          // veio de contato_nome (alias)
    expect(f.prazo_entrega).toBe(45)        // veio de prazo_pagamento (alias)
    expect(f.limite_credito).toBe(200000)
    expect(f.faturamento_anual).toBe(5000000)
    expect(f.score_credito).toBe(82)
    expect(f.classificacao_credito).toBe('A')
    expect(f.razao_social).toBe('Fornecedor Teste Ltda')
  })

  it('rejeita cadastro sem nome (400)', async () => {
    const r = await request(app).post('/api/fornecedores').set('Authorization', `Bearer ${token}`).send({ cnpj: '123' })
    expect(r.status).toBe(400)
  })

  it('edição parcial preserva os campos não enviados', async () => {
    const cri = await request(app).post('/api/fornecedores').set('Authorization', `Bearer ${token}`)
      .send({ nome: 'Edita Me', limite_credito: 100000, score_credito: 70 })
    const id = cri.body.data.id
    // PUT só com o limite — score e nome devem permanecer.
    const upd = await request(app).put(`/api/fornecedores/${id}`).set('Authorization', `Bearer ${token}`)
      .send({ limite_credito: 150000 })
    expect(upd.status).toBe(200)
    expect(upd.body.data.limite_credito).toBe(150000)
    expect(upd.body.data.score_credito).toBe(70)   // preservado
    expect(upd.body.data.nome).toBe('Edita Me')    // preservado
  })
})

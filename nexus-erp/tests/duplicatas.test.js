// ============================================================
// Testes — Detecção e prevenção de duplicatas (Onda 2)
// Fornecedor por CNPJ (prevenção no cadastro) + relatório de duplicatas
// (fornecedores por CNPJ, NFs repetidas em contas a pagar).
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
let request, app, db, token

beforeAll(async () => {
  const st = await import('supertest')
  request = st.default
  ;({ app, db } = await import('../server.js'))
  token = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token
})

const novoForn = body => request(app).post('/api/fornecedores').set('Authorization', `Bearer ${token}`).send(body)
const duplicatas = () => request(app).get('/api/duplicatas').set('Authorization', `Bearer ${token}`)

describe('Prevenção de CNPJ duplicado no cadastro', () => {
  it('bloqueia segundo fornecedor com o mesmo CNPJ (409)', async () => {
    const r1 = await novoForn({ nome: 'Alfa LTDA', cnpj: '11.222.333/0001-81' })
    expect(r1.status).toBe(201)
    const r2 = await novoForn({ nome: 'Alfa Duplicado', cnpj: '11222333000181' }) // mesmo CNPJ, sem máscara
    expect(r2.status).toBe(409)
    expect(r2.body.error).toMatch(/duplicata|cadastrado/i)
  })

  it('permite fornecedores sem CNPJ (regra não se aplica)', async () => {
    expect((await novoForn({ nome: 'Sem CNPJ 1' })).status).toBe(201)
    expect((await novoForn({ nome: 'Sem CNPJ 2' })).status).toBe(201)
  })
})

describe('Relatório /api/duplicatas', () => {
  it('aponta CNPJ duplicado pré-existente (independe de máscara)', async () => {
    // Insere direto no banco simulando uma duplicata legada (a prevenção é só no POST).
    db.prepare(`INSERT INTO fornecedores(nome, cnpj) VALUES('Beta A', '99.888.777/0001-66')`).run()
    db.prepare(`INSERT INTO fornecedores(nome, cnpj) VALUES('Beta B', '99888777000166')`).run()
    const r = await duplicatas()
    expect(r.status).toBe(200)
    const grupo = r.body.data.fornecedores.find(g => g.cnpj === '99888777000166')
    expect(grupo).toBeTruthy()
    expect(grupo.total).toBe(2)
    expect(grupo.ocorrencias.map(o => o.nome).sort()).toEqual(['Beta A', 'Beta B'])
  })

  it('aponta NF repetida em contas a pagar', async () => {
    db.prepare(`INSERT INTO contas_pagar(numero, descricao, valor, nota_fiscal) VALUES('CP-D1','x',100,'NF-DUP-1')`).run()
    db.prepare(`INSERT INTO contas_pagar(numero, descricao, valor, nota_fiscal) VALUES('CP-D2','y',200,'NF-DUP-1')`).run()
    db.prepare(`INSERT INTO contas_pagar(numero, descricao, valor, nota_fiscal) VALUES('CP-OK','z',300,'NF-UNICA')`).run()
    const r = await duplicatas()
    const nf = r.body.data.notas_fiscais.find(g => g.nota_fiscal === 'NF-DUP-1')
    expect(nf).toBeTruthy()
    expect(nf.total).toBe(2)
    expect(r.body.data.notas_fiscais.some(g => g.nota_fiscal === 'NF-UNICA')).toBe(false)
  })

  it('ignora NF placeholder "—" e vazia', async () => {
    db.prepare(`INSERT INTO contas_pagar(numero, descricao, valor, nota_fiscal) VALUES('CP-P1','a',1,'—')`).run()
    db.prepare(`INSERT INTO contas_pagar(numero, descricao, valor, nota_fiscal) VALUES('CP-P2','b',1,'—')`).run()
    const r = await duplicatas()
    expect(r.body.data.notas_fiscais.some(g => g.nota_fiscal === '—')).toBe(false)
  })

  it('resumo reflete as contagens', async () => {
    const r = await duplicatas()
    expect(r.body.data.resumo.fornecedores_dup).toBe(r.body.data.fornecedores.length)
    expect(r.body.data.resumo.nf_dup).toBe(r.body.data.notas_fiscais.length)
  })
})

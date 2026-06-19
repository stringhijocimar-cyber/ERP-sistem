// ============================================================
// Testes — Receita/SEFAZ: adaptador + endpoint + gate de emissão de PC (Onda 2)
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'
import { consultarReceita } from '../lib/receita.js'

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
let request, app, db, token, cnpjRegular, cnpjIrregular

// Encontra (deterministicamente) um CNPJ ATIVA e um irregular para os testes.
async function acharCNPJs() {
  let reg, irr
  for (let i = 10000000000000; i < 10000000002000 && (!reg || !irr); i++) {
    const cnpj = String(i)
    const s = await consultarReceita(cnpj)
    if (s.regular && !reg) reg = cnpj
    else if (!s.regular && !irr) irr = cnpj
  }
  return { reg, irr }
}

beforeAll(async () => {
  const st = await import('supertest')
  request = st.default
  ;({ app, db } = await import('../server.js'))
  token = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token
  ;({ reg: cnpjRegular, irr: cnpjIrregular } = await acharCNPJs())
})

describe('Adaptador de situação cadastral', () => {
  it('rejeita CNPJ inválido', async () => {
    await expect(consultarReceita('123')).rejects.toThrow(/inválido/i)
  })
  it('é determinístico e normaliza a saída', async () => {
    const a = await consultarReceita('11.222.333/0001-81')
    const b = await consultarReceita('11222333000181')
    expect(a.situacao_cadastral).toBe(b.situacao_cadastral)
    expect(typeof a.regular).toBe('boolean')
    expect(a.cnpj).toBe('11222333000181')
  })
})

describe('Endpoint /api/receita/consultar', () => {
  it('retorna a situação cadastral', async () => {
    const r = await request(app).post('/api/receita/consultar').set('Authorization', `Bearer ${token}`).send({ cnpj: cnpjRegular })
    expect(r.status).toBe(200)
    expect(r.body.data.regular).toBe(true)
  })
  it('exige autenticação', async () => {
    const r = await request(app).post('/api/receita/consultar').send({ cnpj: cnpjRegular })
    expect(r.status).toBe(401)
  })
})

describe('Gate de emissão de PC por situação cadastral', () => {
  const emitir = fid => request(app).post('/api/pedidos').set('Authorization', `Bearer ${token}`).send({ fornecedor_id: fid, valor_total: 1000 })

  it('bloqueia PC para fornecedor com CNPJ irregular (409)', async () => {
    const fid = db.prepare(`INSERT INTO fornecedores(nome, cnpj, status) VALUES('Irregular SA', ?, 'Homologado')`).run(cnpjIrregular).lastInsertRowid
    const r = await emitir(fid)
    expect(r.status).toBe(409)
    expect(r.body.error).toMatch(/cadastral|receita|irregular/i)
  })

  it('permite PC para fornecedor com CNPJ regular', async () => {
    const fid = db.prepare(`INSERT INTO fornecedores(nome, cnpj, status) VALUES('Regular SA', ?, 'Homologado')`).run(cnpjRegular).lastInsertRowid
    const r = await emitir(fid)
    expect(r.status).toBe(201)
  })

  it('não bloqueia fornecedor sem CNPJ (validação não se aplica)', async () => {
    const fid = db.prepare(`INSERT INTO fornecedores(nome, status) VALUES('Sem CNPJ', 'Homologado')`).run().lastInsertRowid
    const r = await emitir(fid)
    expect(r.status).toBe(201)
  })
})

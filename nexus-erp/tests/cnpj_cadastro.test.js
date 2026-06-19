// ============================================================
// Testes — Cadastro por CNPJ (autofill estilo Omie)
// Adaptador lib + endpoint /api/cnpj/:cnpj + paridade com o Worker.
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'
import { consultarCadastroCNPJ } from '../lib/receita.js'
import { cadastroCNPJMock } from '../../nexus-cf/src/index.js'

describe('Adaptador de cadastro por CNPJ (lib)', () => {
  it('rejeita CNPJ inválido', async () => {
    await expect(consultarCadastroCNPJ('123')).rejects.toThrow(/inválido/i)
  })
  it('retorna o cadastro completo, determinístico e normalizado', async () => {
    const a = await consultarCadastroCNPJ('11.222.333/0001-81')
    const b = await consultarCadastroCNPJ('11222333000181')
    expect(a).toEqual(b) // independe da máscara
    for (const k of ['razao', 'fantasia', 'situacao', 'cnpj_fmt', 'logradouro', 'cidade', 'uf', 'email', 'telefone', 'atividade', 'porte', 'abertura']) {
      expect(a[k]).toBeTruthy()
    }
    expect(a.cnpj_fmt).toBe('11.222.333/0001-81')
    expect(typeof a.regular).toBe('boolean')
  })
})

describe('Paridade Express ⇄ Worker (mesmo cadastro por CNPJ)', () => {
  it('gera dados idênticos nos dois backends', async () => {
    for (let i = 10000000000000; i < 10000000000100; i++) {
      const cnpj = String(i)
      const e = await consultarCadastroCNPJ(cnpj)
      const w = cadastroCNPJMock(cnpj)
      expect(w).toEqual(e)
    }
  })
  it('Worker rejeita CNPJ inválido com null', () => {
    expect(cadastroCNPJMock('123')).toBeNull()
  })
})

describe('Endpoint GET /api/cnpj/:cnpj', () => {
  const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
  let request, app, token
  beforeAll(async () => {
    process.env.NODE_ENV = 'test'; process.env.DB_PATH = ':memory:'; process.env.SEED_PASSWORD = 'Fraser@2025'
    const st = await import('supertest'); request = st.default
    ;({ app } = await import('../server.js'))
    token = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token
  })
  it('devolve o cadastro no envelope {success,data} esperado pelo front', async () => {
    const r = await request(app).get('/api/cnpj/11222333000181').set('Authorization', `Bearer ${token}`)
    expect(r.status).toBe(200)
    expect(r.body.success).toBe(true)
    expect(r.body.data.razao).toBeTruthy()
    expect(r.body.data.cnpj_fmt).toBe('11.222.333/0001-81')
  })
  it('CNPJ inválido → 400', async () => {
    const r = await request(app).get('/api/cnpj/123').set('Authorization', `Bearer ${token}`)
    expect(r.status).toBe(400)
  })
  it('exige autenticação', async () => {
    const r = await request(app).get('/api/cnpj/11222333000181')
    expect(r.status).toBe(401)
  })
})

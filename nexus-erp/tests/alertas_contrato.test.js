// ============================================================
// Testes de integração — Alertas de vencimento de contrato (90/60/30)
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
const d = off => new Date(Date.now() + off * 864e5).toISOString().slice(0, 10)
let request, app, db, token

beforeAll(async () => {
  const st = await import('supertest')
  request = st.default
  ;({ app, db } = await import('../server.js'))
  token = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token

  const ct = db.prepare(`INSERT INTO contratos(numero, titulo, status, data_fim) VALUES(?,?,?,?)`)
  ct.run('CT-30', 'Vence em 20d', 'Ativo', d(20))   // alta
  ct.run('CT-60', 'Vence em 50d', 'Ativo', d(50))   // media
  ct.run('CT-90', 'Vence em 80d', 'Ativo', d(80))   // baixa
  ct.run('CT-LONGE', 'Vence em 200d', 'Ativo', d(200)) // sem alerta
  ct.run('CT-VENC', 'Já vencido', 'Ativo', d(-5))   // alta
  ct.run('CT-ENC', 'Encerrado', 'Encerrado', d(10)) // ignora (não Ativo)
})

const alertas = async () => (await request(app).get('/api/alertas').set('Authorization', `Bearer ${token}`)).body.data.alertas
const doContrato = (lista, numero) => lista.find(a => a.tipo === 'contrato_vencimento' && a.titulo.includes(numero))

describe('Alertas de vencimento de contrato', () => {
  it('gera alerta com severidade por antecedência (90/60/30)', async () => {
    const l = await alertas()
    expect(doContrato(l, 'CT-30').severidade).toBe('alta')
    expect(doContrato(l, 'CT-60').severidade).toBe('media')
    expect(doContrato(l, 'CT-90').severidade).toBe('baixa')
  })

  it('trata contrato já vencido como alta', async () => {
    const a = doContrato(await alertas(), 'CT-VENC')
    expect(a.severidade).toBe('alta')
    expect(a.titulo).toMatch(/vencido/i)
  })

  it('não alerta contrato fora da janela de 90 dias', async () => {
    expect(doContrato(await alertas(), 'CT-LONGE')).toBeUndefined()
  })

  it('ignora contrato não-Ativo (encerrado)', async () => {
    expect(doContrato(await alertas(), 'CT-ENC')).toBeUndefined()
  })

  it('o módulo do alerta é "Contratos"', async () => {
    expect(doContrato(await alertas(), 'CT-30').modulo).toBe('Contratos')
  })
})

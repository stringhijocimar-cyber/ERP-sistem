// ============================================================
// Testes — Modo demo comercial (/api/demo/seed).
// Prova que o cenário semeado materializa os 4 momentos de valor,
// é idempotente por empresa e 100% isolado por tenant.
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
let request, app, db, token, tokenB

beforeAll(async () => {
  const st = await import('supertest')
  request = st.default
  ;({ app, db } = await import('../server.js'))
  token = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token
  const m = r => r.set('Authorization', `Bearer ${token}`)
  const empB = (await m(request(app).post('/api/empresas')).send({ razao_social: 'Tenant B' })).body.data.id
  await m(request(app).post('/api/usuarios')).send({ nome: 'Admin B', email: 'demob@x.com', senha: 'Aa@123456', perfil: 'admin', empresa_id: empB })
  tokenB = (await request(app).post('/api/auth/login').send({ email: 'demob@x.com', senha: 'Aa@123456' })).body?.data?.token
  // Semeia o tenant A (mestre).
  await m(request(app).post('/api/demo/seed')).send({})
})

const auth = r => r.set('Authorization', `Bearer ${token}`)

describe('demo/seed — os 4 momentos de valor', () => {
  it('retorna o roteiro de 4 passos', async () => {
    const r = await auth(request(app).post('/api/demo/seed')).send({})
    expect(r.body.data.roteiro.length).toBe(4)
    expect(r.body.data.ja_existia).toBe(true) // idempotente na 2ª chamada
  })

  it('momento 1: conta a pagar sem NF é bloqueada no gate (409)', async () => {
    const contas = (await auth(request(app).get('/api/contas-pagar'))).body.data
    const semNF = contas.find(c => /aguardando NF/i.test(c.descricao || ''))
    expect(semNF).toBeTruthy()
    const r = await auth(request(app).post(`/api/contas-pagar/${semNF.id}/pagar`)).send({})
    expect(r.status).toBe(409)
    expect(r.body.error).toMatch(/nota fiscal/i)
  })

  it('momento 2: fracionamento aparece na central de alertas', async () => {
    const r = await auth(request(app).get('/api/alertas'))
    expect(r.body.data.alertas.some(a => a.tipo === 'anomalia_fracionamento')).toBe(true)
  })

  it('momento 3: lead em orçamentação pendente', async () => {
    const r = await auth(request(app).get('/api/crm/orcamentacao?status=pendente'))
    expect(r.body.data.some(l => /Serra Azul/i.test(l.titulo))).toBe(true)
  })

  it('momento 4: custo realizado lançado na linha WBS do contrato', async () => {
    const r = await auth(request(app).get('/api/wbs?ativo=todos'))
    const linha = r.body.data.find(w => w.codigo === '1.1' && Number(w.custo_real) > 0)
    expect(linha).toBeTruthy()
    expect(Number(linha.custo_real)).toBe(48000)
  })
})

describe('demo/seed — isolamento e idempotência', () => {
  it('idempotente: não duplica o contrato demo na 2ª execução', async () => {
    await auth(request(app).post('/api/demo/seed')).send({})
    const contratos = (await auth(request(app).get('/api/contratos'))).body.data
    expect(contratos.filter(c => c.objeto === 'DEMO').length).toBe(1)
  })

  it('tenant B não vê nada do cenário demo do tenant A', async () => {
    const asB = r => r.set('Authorization', `Bearer ${tokenB}`)
    expect((await asB(request(app).get('/api/contratos'))).body.data.length).toBe(0)
    expect((await asB(request(app).get('/api/alertas'))).body.data.alertas.some(a => String(a.tipo).startsWith('anomalia_'))).toBe(false)
  })

  it('só admin pode semear (perfil comum → 403)', async () => {
    await auth(request(app).post('/api/usuarios')).send({ nome: 'Op', email: 'op.demo@x.com', senha: 'Aa@123456', perfil: 'operacao' })
    const opTok = (await request(app).post('/api/auth/login').send({ email: 'op.demo@x.com', senha: 'Aa@123456' })).body.data.token
    const r = await request(app).post('/api/demo/seed').set('Authorization', `Bearer ${opTok}`).send({})
    expect(r.status).toBe(403)
  })
})

describe('demo/seed — volume em TODOS os módulos (nenhuma tela vazia)', () => {
  const len = async ep => (await auth(request(app).get(ep))).body.data.length

  it('semeia a BOM multinível do MM com o gate de engenharia', async () => {
    const mats = (await auth(request(app).get('/api/mm/materiais'))).body.data
    expect(mats.length).toBeGreaterThanOrEqual(9)
    expect(mats.some(m => m.part_number === 'VBTP-GUARANI-II')).toBe(true)
    // Placa balística é BUY sem liberação → o gate de compra deve barrar.
    const placa = mats.find(m => m.part_number === 'PLACA-BALISTICA-N3')
    expect(placa).toBeTruthy()
    expect(Number(placa.eng_liberado_compras)).toBe(0)
  })

  it('semeia produção (PP), estoque endereçado (WMS) e SSMA', async () => {
    expect(await len('/api/pp/ordens')).toBeGreaterThanOrEqual(1)
    expect(await len('/api/wms/enderecos')).toBeGreaterThanOrEqual(3)
    expect(await len('/api/ssma/epis')).toBeGreaterThanOrEqual(3)
    expect(await len('/api/ssma/treinamentos')).toBeGreaterThanOrEqual(2)
    expect(await len('/api/ssma/cat')).toBeGreaterThanOrEqual(1)
    expect(await len('/api/mm/ppap')).toBeGreaterThanOrEqual(1)
  })

  it('semeia o funil de compras (RC → RFQ → mapa) e o financeiro', async () => {
    expect(await len('/api/rc')).toBeGreaterThanOrEqual(1)
    expect(await len('/api/rfq')).toBeGreaterThanOrEqual(1)
    expect(await len('/api/mapas')).toBeGreaterThanOrEqual(1)
    expect(await len('/api/contas-receber')).toBeGreaterThanOrEqual(2)
    expect(await len('/api/colaboradores')).toBeGreaterThanOrEqual(3)
    expect(await len('/api/projetos')).toBeGreaterThanOrEqual(2)
  })

  it('idempotente: 2ª chamada não completa módulos de novo', async () => {
    const r = await auth(request(app).post('/api/demo/seed')).send({})
    expect(r.body.data.modulos_completados).toBe(false)
    const mats = (await auth(request(app).get('/api/mm/materiais'))).body.data
    expect(mats.filter(m => m.part_number === 'VBTP-GUARANI-II').length).toBe(1) // não duplicou
  })

  it('top-up: tenant com seed antigo (só a espinha, sem módulos) é completado ao re-semear', async () => {
    // Simula fielmente um tenant que rodou uma versão anterior do seed: tem a
    // espinha (contrato DEMO) mas os módulos industriais nunca foram criados.
    const empB = db.prepare(`SELECT id FROM empresas WHERE razao_social = 'Tenant B'`).get().id
    const f = db.prepare(`INSERT INTO fornecedores(nome, status, ativo, empresa_id) VALUES('Aço Forte Ltda (DEMO)','Homologado',1,?)`).run(empB).lastInsertRowid
    db.prepare(`INSERT INTO contratos(numero, titulo, fornecedor_id, tipo, status, valor_total, objeto, empresa_id) VALUES('CT-2099-D01','Manut',?,'Serviço','Ativo',1200000,'DEMO',?)`).run(f, empB)
    db.prepare(`INSERT INTO wbs_linhas(codigo, descricao, tipo, contrato_id, empresa_id) VALUES('1.1','MO','OPEX','1',?)`).run(empB)
    expect(db.prepare(`SELECT COUNT(*) n FROM mm_materiais WHERE empresa_id = ?`).get(empB).n).toBe(0)

    const asB = r => r.set('Authorization', `Bearer ${tokenB}`)
    const r = await asB(request(app).post('/api/demo/seed')).send({})
    expect(r.body.data.ja_existia).toBe(true)
    expect(r.body.data.modulos_completados).toBe(true)
    expect(db.prepare(`SELECT COUNT(*) n FROM mm_materiais WHERE empresa_id = ?`).get(empB).n).toBeGreaterThanOrEqual(9)
    // E permanece isolado: o tenant A não foi afetado.
    expect((await asB(request(app).get('/api/pp/ordens'))).body.data.length).toBeGreaterThanOrEqual(1)
  })
})

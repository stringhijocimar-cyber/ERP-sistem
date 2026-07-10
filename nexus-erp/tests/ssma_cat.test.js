// ============================================================
// Testes — SSMA fase 4: CAT (Lei 8.213/91) + evento eSocial S-2210 gerada a
// partir do incidente com afastamento. Lib pura (prazo/status/S-2210) +
// endpoints (geração, validação, prazo legal, isolamento, pendências).
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'
import { prazoCAT, statusPrazoCAT, tipoCatCodigo, validarCAT, montarS2210 } from '../lib/cat.js'

describe('lib cat (pura)', () => {
  it('prazo = 1º dia útil seguinte; sexta rola p/ segunda', () => {
    expect(prazoCAT('2026-07-08')).toBe('2026-07-09') // quarta → quinta
    expect(prazoCAT('2026-07-10')).toBe('2026-07-13') // sexta → segunda
    expect(prazoCAT('2026-07-11')).toBe('2026-07-13') // sábado → segunda
  })
  it('óbito = prazo imediato (mesmo dia)', () => {
    expect(prazoCAT('2026-07-10', true)).toBe('2026-07-10')
  })
  it('status: pendente vs atrasada vs emitida', () => {
    expect(statusPrazoCAT({ prazo_legal: '2026-07-13' }, '2026-07-11')).toBe('Pendente')
    expect(statusPrazoCAT({ prazo_legal: '2026-07-13' }, '2026-07-15')).toBe('Atrasada')
    expect(statusPrazoCAT({ data_emissao: '2026-07-12', prazo_legal: '2026-07-13' }, '2026-07-20')).toBe('Emitida no prazo')
    expect(statusPrazoCAT({ data_emissao: '2026-07-15', prazo_legal: '2026-07-13' }, '2026-07-20')).toBe('Emitida com atraso')
  })
  it('tpCat: inicial/reabertura/óbito', () => {
    expect(tipoCatCodigo('Inicial')).toBe(1)
    expect(tipoCatCodigo('Reabertura')).toBe(2)
    expect(tipoCatCodigo('Óbito')).toBe(3)
  })
  it('validarCAT exige data, colaborador e descrição', () => {
    expect(validarCAT({ data_acidente: '2026-07-10', colaborador_id: 1, descricao: 'x' }).ok).toBe(true)
    expect(validarCAT({ colaborador_id: 1 }).faltando).toContain('data_acidente')
  })
  it('S-2210 mapeia CPF/CNPJ (só dígitos) e tpCat/indCatObito', () => {
    const s = montarS2210(
      { data_acidente: '2026-07-10', descricao: 'queda', com_afastamento: 1, dias_afastamento: 10, cid: 'S82', obito: false, tipo: 'Inicial' },
      { id: 5, cpf: '123.456.789-00' },
      { cnpj: '12.345.678/0001-99' },
    )
    expect(s.evtCAT.ideEmpregador.nrInsc).toBe('12345678')
    expect(s.evtCAT.ideVinculo.cpfTrab).toBe('12345678900')
    expect(s.evtCAT.infoCAT.tpCat).toBe(1)
    expect(s.evtCAT.infoCAT.indCatObito).toBe('N')
    expect(s.evtCAT.infoCAT.atestado.durTrat).toBe(10)
  })
})

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
let request, app, token, tokB, colabA, incAfast, incSemAfast

describe('endpoints — CAT/S-2210', () => {
  beforeAll(async () => {
    const st = await import('supertest')
    request = st.default
    ;({ app } = await import('../server.js'))
    token = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token
    const m = r => r.set('Authorization', `Bearer ${token}`)
    colabA = (await m(request(app).post('/api/colaboradores')).send({ nome: 'Pedro Acidentado', cargo: 'Operador', cpf: '111.222.333-44' })).body.data.id
    incAfast = (await m(request(app).post('/api/ssma')).send({ tipo: 'Acidente', gravidade: 'Alta', com_afastamento: true, dias_perdidos: 12, data_ocorrencia: '2026-07-08', descricao: 'Queda de andaime', colaborador_id: colabA })).body.data.id
    incSemAfast = (await m(request(app).post('/api/ssma')).send({ tipo: 'Quase acidente', gravidade: 'Baixa', data_ocorrencia: '2026-07-08', descricao: 'Sem lesão' })).body.data.id
    const empB = (await m(request(app).post('/api/empresas')).send({ razao_social: 'Tenant B CAT' })).body.data.id
    await m(request(app).post('/api/usuarios')).send({ nome: 'AdmB', email: 'cat.b@x.com', senha: 'Aa@123456', perfil: 'admin', empresa_id: empB })
    tokB = (await request(app).post('/api/auth/login').send({ email: 'cat.b@x.com', senha: 'Aa@123456' })).body?.data?.token
  })
  const auth = r => r.set('Authorization', `Bearer ${token}`)

  it('gera CAT do incidente com afastamento (prazo + S-2210)', async () => {
    const r = await auth(request(app).post(`/api/ssma/${incAfast}/gerar-cat`)).send({ cid: 'S82', parte_atingida: '755010000' })
    expect(r.status).toBe(201)
    expect(r.body.data.numero).toMatch(/^CAT-\d{4}-\d{3}$/)
    expect(r.body.data.prazo_legal).toBe('2026-07-09') // 08 (quarta) → 09 (quinta)
    expect(r.body.data.colaborador_nome).toBe('Pedro Acidentado')
    expect(r.body.data.s2210.evtCAT.ideVinculo.cpfTrab).toBe('11122233344')
    expect(r.body.data.s2210.evtCAT.infoCAT.atestado.codCID).toBe('S82')
  })

  it('não gera CAT p/ incidente sem afastamento (400)', async () => {
    const r = await auth(request(app).post(`/api/ssma/${incSemAfast}/gerar-cat`)).send({})
    expect(r.status).toBe(400)
  })

  it('não duplica CAT inicial do mesmo incidente (409)', async () => {
    const r = await auth(request(app).post(`/api/ssma/${incAfast}/gerar-cat`)).send({})
    expect(r.status).toBe(409)
  })

  it('BUG: tenant B não gera CAT de incidente do tenant A (404)', async () => {
    const r = await request(app).post(`/api/ssma/${incAfast}/gerar-cat`).set('Authorization', `Bearer ${tokB}`).send({})
    expect(r.status).toBe(404)
  })

  it('lista CATs e detalha S-2210; isolada por tenant', async () => {
    const lista = (await auth(request(app).get('/api/ssma/cat'))).body.data
    expect(lista.length).toBe(1)
    const det = (await auth(request(app).get(`/api/ssma/cat/${lista[0].id}`))).body.data
    expect(det.s2210.evtCAT.infoCAT.dtAcid).toBe('2026-07-08')
    const rB = await request(app).get('/api/ssma/cat').set('Authorization', `Bearer ${tokB}`)
    expect(rB.body.data.length).toBe(0)
  })

  it('alerta de pendências: incidente com afastamento sem CAT aparece', async () => {
    const inc2 = (await auth(request(app).post('/api/ssma')).send({ tipo: 'Acidente', com_afastamento: true, data_ocorrencia: '2020-01-02', descricao: 'Antigo', colaborador_id: colabA })).body.data.id
    const al = (await auth(request(app).get('/api/ssma/cat/pendentes/alertas'))).body.data
    expect(al.total).toBeGreaterThanOrEqual(1)
    expect(al.atrasadas).toBeGreaterThanOrEqual(1) // o de 2020 está muito atrasado
    expect(al.pendentes.some(p => p.id === inc2)).toBe(true)
  })
})

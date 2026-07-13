// ============================================================
// Testes — lib xlsx (gerador OOXML puro) + exportação Excel do módulo
// Processos (Requisições): filtros, período, perfil, sem-registros e
// segurança (fórmula vira texto; acentuação preservada).
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest'
import { gerarXLSX, colLetra, dataParaSerial } from '../lib/xlsx.js'

describe('lib xlsx (pura)', () => {
  const COLS = [
    { titulo: 'Número', tipo: 'text', largura: 14 },
    { titulo: 'Valor Total', tipo: 'money' },
    { titulo: 'Criada em', tipo: 'date' },
    { titulo: 'Qtd', tipo: 'number' },
  ]
  const buf = gerarXLSX({
    sheetName: 'Processos',
    colunas: COLS,
    linhas: [
      ['RC-2026-001', 1234.56, '2020-01-01', 3],
      ['=cmd|calc', 'não-número', 'sem-data', null], // ataque + tipos ruins
      ['Aço & <especiais> "çãõ"', 0, '2026-07-12', 1.5],
    ],
  })
  const txt = buf.toString('latin1') // STORE = conteúdo visível no binário

  it('é um ZIP válido com as partes OOXML obrigatórias', () => {
    expect(buf.slice(0, 4).toString('latin1')).toBe('PK\x03\x04')
    for (const parte of ['[Content_Types].xml', 'xl/workbook.xml', 'xl/worksheets/sheet1.xml', 'xl/styles.xml']) {
      expect(txt).toContain(parte)
    }
    // EOCD no fim
    expect(buf.readUInt32LE(buf.length - 22)).toBe(0x06054b50)
  })
  it('planilha "Processos", 1ª linha congelada e filtros automáticos', () => {
    expect(txt).toContain('name="Processos"')
    expect(txt).toContain('state="frozen"')
    expect(txt).toContain('<autoFilter ref="A1:D4"/>')
  })
  it('cabeçalho em negrito (estilo s=1) e larguras de coluna', () => {
    expect(txt).toContain('<c r="A1" t="inlineStr" s="1">')
    expect(txt).toContain('width="14"')
  })
  it('data vira serial nativo (2020-01-01 = 43831) e moeda/número são numéricos', () => {
    expect(dataParaSerial('2020-01-01')).toBe(43831)
    expect(txt).toContain('<c r="C2" s="2"><v>43831</v></c>')
    expect(txt).toContain('<c r="B2" s="3"><v>1234.56</v></c>')
    expect(txt).toContain('<c r="D2" s="4"><v>3</v></c>')
  })
  it('SEGURANÇA: "=cmd|calc" fica como texto inline (nunca fórmula)', () => {
    expect(txt).toContain('<c r="A3" t="inlineStr"><is><t xml:space="preserve">=cmd|calc</t></is></c>')
    expect(txt).not.toContain('<f>') // nenhuma célula de fórmula
  })
  it('acentos preservados e XML escapado', () => {
    const utf = buf.toString('utf8')
    expect(utf).toContain('Aço &amp; &lt;especiais&gt; &quot;çãõ&quot;')
  })
  it('valores não-conversíveis degradam para texto (não corrompem o arquivo)', () => {
    const utf = buf.toString('utf8')
    expect(utf).toContain('não-número')
    expect(utf).toContain('sem-data')
  })
  it('colLetra cobre além de Z', () => {
    expect(colLetra(0)).toBe('A'); expect(colLetra(25)).toBe('Z'); expect(colLetra(26)).toBe('AA')
  })
})

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.SEED_PASSWORD = 'Fraser@2025'

const ADMIN = { email: 'admin@fraseralexander.com.br', senha: 'Fraser@2025' }
let request, app, token, tokF

describe('GET /api/rc/export.xlsx (módulo Processos)', () => {
  beforeAll(async () => {
    const st = await import('supertest')
    request = st.default
    ;({ app } = await import('../server.js'))
    token = (await request(app).post('/api/auth/login').send(ADMIN)).body?.data?.token
    const m = r => r.set('Authorization', `Bearer ${token}`)
    await m(request(app).post('/api/rc')).send({ tipo: 'Material', wbs: 'WBS-1', prioridade: 'Alta', itens: [{ descricao: 'Aço 1020', quantidade: 10, valor_unitario_estimado: 50 }] })
    await m(request(app).post('/api/rc')).send({ tipo: 'Material', wbs: 'WBS-2', observacoes: 'çãõ & <x>', itens: [{ descricao: 'Parafuso', quantidade: 5, valor_unitario_estimado: 2 }] })
    // usuário fornecedor p/ gate
    const forn = (await m(request(app).post('/api/fornecedores')).send({ nome: 'F Exp', cnpj: '33.333.333/0001-33' })).body.data.id
    await m(request(app).post('/api/usuarios')).send({ nome: 'UF', email: 'exp@f.com', senha: 'Aa@123456', perfil: 'fornecedor', fornecedor_id: forn, empresa_id: 1 })
    tokF = (await request(app).post('/api/auth/login').send({ email: 'exp@f.com', senha: 'Aa@123456' })).body?.data?.token
  })
  const auth = r => r.set('Authorization', `Bearer ${token}`)
  // supertest não bufferiza spreadsheetml por padrão → parser binário
  const bin = r => r.buffer(true).parse((res, cb) => { const c = []; res.on('data', d => c.push(d)); res.on('end', () => cb(null, Buffer.concat(c))) })

  it('exporta .xlsx com content-type e nome processos_data_hora', async () => {
    const r = await bin(auth(request(app).get('/api/rc/export.xlsx')))
    expect(r.status).toBe(200)
    expect(r.headers['content-type']).toContain('spreadsheetml.sheet')
    expect(r.headers['content-disposition']).toMatch(/processos_\d{4}-\d{2}-\d{2}_\d{4}\.xlsx/)
    const body = Buffer.from(r.body)
    expect(body.slice(0, 2).toString()).toBe('PK')
    expect(body.toString('utf8')).toContain('WBS-1')
  })

  it('respeita a pesquisa (q) e o status múltiplo (|)', async () => {
    const r = await auth(request(app).get('/api/rc/export.xlsx?q=RC-'))
    expect(r.status).toBe(200)
    const rStatus = await auth(request(app).get('/api/rc/export.xlsx?status=Rascunho|Aprovada'))
    expect(rStatus.status).toBe(200)
  })

  it('período: de/ate filtram; formato inválido → 400', async () => {
    const hoje = new Date().toISOString().slice(0, 10)
    expect((await auth(request(app).get(`/api/rc/export.xlsx?de=${hoje}&ate=${hoje}`))).status).toBe(200)
    expect((await auth(request(app).get('/api/rc/export.xlsx?de=2099-01-01'))).status).toBe(404) // futuro: nada
    expect((await auth(request(app).get('/api/rc/export.xlsx?de=12/07/2026'))).status).toBe(400)
  })

  it('sem registros → 404 com mensagem clara', async () => {
    const r = await auth(request(app).get('/api/rc/export.xlsx?q=NAO-EXISTE-XYZ'))
    expect(r.status).toBe(404)
    expect(r.body.error).toMatch(/nenhum registro/i)
  })

  it('perfil fornecedor não exporta (403)', async () => {
    const r = await request(app).get('/api/rc/export.xlsx').set('Authorization', `Bearer ${tokF}`)
    expect(r.status).toBe(403)
  })
})

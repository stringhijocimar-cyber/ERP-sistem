// ============================================================
// Testes — lib/conciliacao.js (puro): parsing CSV/OFX + matching.
// ============================================================
import { describe, expect, it } from 'vitest'
import { parseValor, parseData, parseCSVExtrato, parseOFX, parseExtrato, sugerirMatch } from '../lib/conciliacao.js'

describe('parseValor (pt-BR e en-US)', () => {
  it('decimal pt-BR com milhar', () => expect(parseValor('1.234,56')).toBe(1234.56))
  it('decimal en-US com milhar', () => expect(parseValor('1,234.56')).toBe(1234.56))
  it('só vírgula decimal', () => expect(parseValor('50,00')).toBe(50))
  it('negativo e R$', () => expect(parseValor('-R$ 120,00')).toBe(-120))
  it('parênteses = negativo', () => expect(parseValor('(75,50)')).toBe(-75.5))
  it('milhar sem decimal (vírgula agrupando)', () => expect(parseValor('1,234')).toBe(1234))
  it('inválido → NaN', () => expect(Number.isNaN(parseValor('abc'))).toBe(true))
})

describe('parseData', () => {
  it('ISO', () => expect(parseData('2026-05-10')).toBe('2026-05-10'))
  it('BR dd/mm/aaaa', () => expect(parseData('10/05/2026')).toBe('2026-05-10'))
  it('OFX AAAAMMDD', () => expect(parseData('20260510120000[-3:BRT]')).toBe('2026-05-10'))
  it('vazio → ""', () => expect(parseData('')).toBe(''))
})

describe('parseCSVExtrato', () => {
  it('cabeçalho pt-BR com ; e sinal no valor', () => {
    const csv = 'Data;Histórico;Valor\n10/05/2026;PAGAMENTO FORNECEDOR;-1.200,00\n12/05/2026;RECEBIMENTO CLIENTE;3.000,00'
    const r = parseCSVExtrato(csv)
    expect(r).toHaveLength(2)
    expect(r[0]).toMatchObject({ data: '2026-05-10', valor: 1200, tipo: 'debito' })
    expect(r[1]).toMatchObject({ data: '2026-05-12', valor: 3000, tipo: 'credito' })
  })
  it('colunas separadas de crédito/débito', () => {
    const csv = 'data,descricao,debito,credito\n2026-05-01,Tarifa,30.00,\n2026-05-02,Deposito,,500.00'
    const r = parseCSVExtrato(csv)
    expect(r[0]).toMatchObject({ valor: 30, tipo: 'debito' })
    expect(r[1]).toMatchObject({ valor: 500, tipo: 'credito' })
  })
  it('sem cabeçalho: assume data;descricao;valor', () => {
    const r = parseCSVExtrato('05/05/2026;Compra;-99,90')
    expect(r[0]).toMatchObject({ data: '2026-05-05', valor: 99.9, tipo: 'debito' })
  })
  it('ignora rodapé/linha inválida (sem data válida)', () => {
    const csv = 'Data;Valor\n10/05/2026;100,00\nSaldo final;100,00'
    expect(parseCSVExtrato(csv)).toHaveLength(1)
  })
})

describe('parseOFX', () => {
  const ofx = `<OFX><BANKMSGSRSV1><STMTTRNRS><BANKTRANLIST>
    <STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260510<TRNAMT>-1200.00<FITID>A1<MEMO>Fornecedor X</STMTTRN>
    <STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260512<TRNAMT>3000.00<FITID>A2<NAME>Cliente Y</STMTTRN>
    </BANKTRANLIST></STMTTRNRS></BANKMSGSRSV1></OFX>`
  it('extrai lançamentos com sinal e memo/name', () => {
    const r = parseOFX(ofx)
    expect(r).toHaveLength(2)
    expect(r[0]).toMatchObject({ data: '2026-05-10', valor: 1200, tipo: 'debito', descricao: 'Fornecedor X', documento: 'A1' })
    expect(r[1]).toMatchObject({ data: '2026-05-12', valor: 3000, tipo: 'credito', descricao: 'Cliente Y' })
  })
})

describe('parseExtrato (dispatcher)', () => {
  it('auto-detecta OFX pela tag', () => {
    const r = parseExtrato('auto', '<STMTTRN><DTPOSTED>20260501<TRNAMT>10.00<MEMO>x</STMTTRN>')
    expect(r[0].valor).toBe(10)
  })
  it('auto cai para CSV', () => {
    const r = parseExtrato('auto', '01/05/2026;x;10,00')
    expect(r[0].valor).toBe(10)
  })
})

describe('sugerirMatch', () => {
  const lanc = { data: '2026-05-10', valor: 1200, tipo: 'debito' }
  it('casa por valor exato dentro da janela e prefere data mais próxima', () => {
    const cands = [{ id: 1, valor: 1200, data: '2026-05-14' }, { id: 2, valor: 1200, data: '2026-05-10' }]
    expect(sugerirMatch(lanc, cands).ref_id).toBe(2)
  })
  it('não casa fora da janela de dias', () => {
    expect(sugerirMatch(lanc, [{ id: 9, valor: 1200, data: '2026-06-30' }])).toBeNull()
  })
  it('não casa se valor diverge', () => {
    expect(sugerirMatch(lanc, [{ id: 9, valor: 1199, data: '2026-05-10' }])).toBeNull()
  })
  it('sem candidatos → null', () => {
    expect(sugerirMatch(lanc, [])).toBeNull()
  })
})

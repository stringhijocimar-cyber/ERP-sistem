// ============================================================
// Testes — lib/csv_export.js (puro): escaping RFC-4180, DRE e dashboard.
// ============================================================
import { describe, expect, it } from 'vitest'
import { toCSV, dreParaCSV, dashboardParaCSV } from '../lib/csv_export.js'

describe('toCSV', () => {
  it('usa ; como separador e escapa campos com separador/aspas/quebra', () => {
    const csv = toCSV(['a', 'b'], [['x;y', 'z"z'], ['linha\nnova', 'ok']], { bom: false })
    expect(csv).toContain('a;b')
    expect(csv).toContain('"x;y";"z""z"')
    expect(csv).toContain('"linha\nnova";ok')
  })
  it('prefixa BOM por padrão (acentuação no Excel)', () => {
    expect(toCSV(['x'], [], { bom: true }).charCodeAt(0)).toBe(0xFEFF)
  })
})

describe('dreParaCSV', () => {
  const dre = {
    periodo: '2026', margem_bruta_pct: 80, margem_liquida_pct: 66,
    caixa: { recebido: 200000, pago: 120000, saldo: 80000 },
    linhas: [
      { label: 'Receita Bruta de Serviços', valor: 500000 },
      { label: '= Resultado Operacional', valor: 330000 },
    ],
  }
  it('inclui linhas, margens e visão caixa em pt-BR (vírgula decimal)', () => {
    const csv = dreParaCSV(dre)
    expect(csv).toContain('DRE — período 2026')
    expect(csv).toContain('Receita Bruta de Serviços;500000,00')
    expect(csv).toContain('Margem líquida (%);66,00')
    expect(csv).toContain('Caixa — Saldo;80000,00')
  })
  it('dre ausente não quebra', () => {
    expect(typeof dreParaCSV(null)).toBe('string')
  })
})

describe('dashboardParaCSV', () => {
  const d = {
    periodo: '2026',
    dre: { receita: 400000, custos: 100000, despesas: 0, resultado_operacional: 300000, margem_liquida_pct: 75 },
    posicao: { capital_giro: 300000, a_receber: 400000, a_receber_vencido: 0, a_pagar: 100000, a_pagar_vencido: 0 },
    projecao: { saldo_final: -5000, menor_saldo: -5000, aperto_previsto: true },
    contratos: { top: [{ numero: 'CT-2026-001', titulo: 'Obra X', receita: 400000, resultado: 300000, margem_pct: 75 }] },
    conciliacao_pendente: 2,
  }
  it('inclui indicadores, aperto e ranking de contratos', () => {
    const csv = dashboardParaCSV(d)
    expect(csv).toContain('Resultado operacional;300000,00')
    expect(csv).toContain('Aperto de caixa previsto;SIM')
    expect(csv).toContain('CT-2026-001;Obra X;400000,00;300000,00;75,00')
    expect(csv).toContain('Conciliação pendente;2')
  })
})

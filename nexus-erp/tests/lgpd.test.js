// Testes do motor de conformidade LGPD (função pura).
import { describe, expect, it } from 'vitest'
import LGPD from '../public/js/lib/lgpd.js'

describe('LGPD — base legal', () => {
  it('valida bases legais do art. 7', () => {
    expect(LGPD.validarBaseLegal('Consentimento')).toBe(true)
    expect(LGPD.validarBaseLegal('Execução de contrato')).toBe(true)
    expect(LGPD.validarBaseLegal('Porque sim')).toBe(false)
  })
})

describe('LGPD — anonimização', () => {
  it('mascara CPF removendo identificabilidade', () => {
    expect(LGPD.anonimizarCampo('123.456.789-09', 'cpf')).toBe('•••.•••.•••-••')
  })
  it('email mantém o domínio mas oculta o usuário', () => {
    expect(LGPD.anonimizarCampo('joao.silva@empresa.com', 'email')).toBe('j•••@empresa.com')
  })
  it('telefone mantém só o DDD', () => {
    expect(LGPD.anonimizarCampo('(11) 98888-7777', 'telefone')).toBe('(11) •••••-••••')
  })
  it('nome vira iniciais', () => {
    expect(LGPD.anonimizarCampo('João da Silva', 'nome')).toBe('J. D. S.')
  })
  it('anonimizarRegistro aplica o mapa e marca o registro', () => {
    const r = LGPD.anonimizarRegistro(
      { nome: 'Maria Souza', email: 'maria@x.com', telefone: '(21) 91234-5678', cidade: 'Rio' },
      { nome: 'nome', email: 'email', telefone: 'telefone' }
    )
    expect(r.nome).toBe('M. S.')
    expect(r.email).toBe('m•••@x.com')
    expect(r.cidade).toBe('Rio')   // campo não pessoal preservado
    expect(r.anonimizado).toBe(1)
  })
})

describe('LGPD — retenção', () => {
  it('detecta dado vencido (passou do período de guarda)', () => {
    const s = LGPD.statusRetencao({ data_coleta: '2020-01-01', retencao_meses: 12 }, '2026-06-16')
    expect(s.vencido).toBe(true)
    expect(s.mesesRestantes).toBeLessThan(0)
  })
  it('dado dentro do período não está vencido', () => {
    const s = LGPD.statusRetencao({ data_coleta: '2026-01-01', retencao_meses: 60 }, '2026-06-16')
    expect(s.vencido).toBe(false)
    expect(s.mesesRestantes).toBeGreaterThan(0)
  })
  it('sem data válida não quebra', () => {
    const s = LGPD.statusRetencao({ retencao_meses: 12 })
    expect(s.vencido).toBe(false)
    expect(s.limite).toBeNull()
  })

  it('vencidosPorRetencao filtra apenas os além do período', () => {
    const regs = [
      { id: 1, created_at: '2018-01-01' }, // vencido (>60m)
      { id: 2, created_at: '2025-06-01' }, // dentro
    ]
    const v = LGPD.vencidosPorRetencao(regs, { campoData: 'created_at', retencaoMeses: 60 }, '2026-06-16')
    expect(v.map(r => r.id)).toEqual([1])
  })
})

// ============================================================
// Worker (nexus-cf) — alertas de vencimento de contrato (90/60/30)
// Função pura classificarVencimentoContrato + integração em montarAlertasWorker.
// ============================================================
import { describe, expect, it } from 'vitest'
import { classificarVencimentoContrato, montarAlertasWorker } from '../../nexus-cf/src/index.js'

const HOJE = '2026-06-18'
const off = n => new Date(new Date(HOJE + 'T00:00:00Z').getTime() + n * 864e5).toISOString().slice(0, 10)

describe('classificarVencimentoContrato (90/60/30)', () => {
  it('escala a severidade pela antecedência', () => {
    expect(classificarVencimentoContrato(off(20), HOJE)).toBe('alta')
    expect(classificarVencimentoContrato(off(50), HOJE)).toBe('media')
    expect(classificarVencimentoContrato(off(80), HOJE)).toBe('baixa')
    expect(classificarVencimentoContrato(off(200), HOJE)).toBeNull()
  })
  it('vencido conta como alta; nulo é ignorado', () => {
    expect(classificarVencimentoContrato(off(-3), HOJE)).toBe('alta')
    expect(classificarVencimentoContrato(null, HOJE)).toBeNull()
  })
})

describe('montarAlertasWorker — contratos', () => {
  const contratos = [
    { id: 'CT-A', numero: 'CT-A', titulo: 'A', status: 'Ativo', data_fim: off(20) },
    { id: 'CT-L', numero: 'CT-L', titulo: 'L', status: 'Ativo', data_fim: off(200) },
    { id: 'CT-E', numero: 'CT-E', titulo: 'E', status: 'Encerrado', data_fim: off(10) },
    { id: 'CT-V', numero: 'CT-V', titulo: 'V', status: 'Ativo', data_fim: off(-5) },
  ]
  const get = num => montarAlertasWorker({ contratos, hoje: HOJE })
    .find(a => a.tipo === 'contrato_vencimento' && a.titulo.includes(num))

  it('alerta dentro de 90d e ignora fora da janela / não-Ativo', () => {
    expect(get('CT-A').severidade).toBe('alta')
    expect(get('CT-A').modulo).toBe('Contratos')
    expect(get('CT-L')).toBeUndefined()
    expect(get('CT-E')).toBeUndefined()
  })
  it('contrato vencido é alta e rotulado como vencido', () => {
    expect(get('CT-V').severidade).toBe('alta')
    expect(get('CT-V').titulo).toMatch(/vencido/i)
  })
})

// ============================================================
// Varredura #6 — integridade do OTIF: entrega SEM data prometida
// (pedido com prazo textual "30 dias" → data_prometida NULL) NÃO pode
// contar como pontual e inflar o indicador. Sai do cálculo (sem_prazo).
// ============================================================
import { describe, expect, it } from 'vitest'
import { calcularOTIF, tendenciaOTIF } from '../lib/otif.js'

describe('calcularOTIF — entrega sem prazo é não-mensurável', () => {
  it('entrega sem data prometida NÃO entra no OTIF (fica em sem_prazo)', () => {
    const r = calcularOTIF([
      { data_prometida: null, data_entregue: '2026-05-10' },        // sem prazo → fora
      { data_prometida: '2026-05-01', data_entregue: '2026-05-10' }, // atrasada
    ], '2026-06-01')
    expect(r.entregues).toBe(2)
    expect(r.sem_prazo).toBe(1)
    expect(r.no_prazo).toBe(0)
    expect(r.otif_pct).toBe(0) // 0 de 1 mensurável — não 50% inflado
  })
  it('só entregas sem prazo → OTIF null (nada mensurável), não 100%', () => {
    const r = calcularOTIF([{ data_prometida: null, data_entregue: '2026-05-10' }], '2026-06-01')
    expect(r.sem_prazo).toBe(1)
    expect(r.otif_pct).toBeNull()
  })
  it('com prazo continua medindo normalmente', () => {
    const r = calcularOTIF([
      { data_prometida: '2026-05-10', data_entregue: '2026-05-09' },
      { data_prometida: '2026-05-10', data_entregue: '2026-05-20' },
    ], '2026-06-01')
    expect(r.otif_pct).toBe(50)
    expect(r.sem_prazo).toBe(0)
  })
})

describe('tendenciaOTIF — mesmo tratamento por mês', () => {
  it('entrega sem prazo não infla o bucket do mês', () => {
    const t = tendenciaOTIF([
      { data_prometida: null, data_entregue: '2026-05-10' },
      { data_prometida: '2026-05-01', data_entregue: '2026-05-10' }, // atrasada
    ], 1, '2026-05-31')
    const b = t[0]
    expect(b.mes).toBe('2026-05')
    expect(b.entregues).toBe(2)
    expect(b.sem_prazo).toBe(1)
    expect(b.com_prazo).toBe(1)
    expect(b.otif_pct).toBe(0) // não 50%
  })
})

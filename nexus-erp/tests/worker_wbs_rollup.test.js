// ============================================================
// Worker (nexus-cf) — rollup WBS (paridade com lib/wbs_rollup.js do Express)
// ============================================================
import { describe, expect, it } from 'vitest'
import { montarRollupWBS as worker } from '../../nexus-cf/src/index.js'
import { montarRollupWBS as express } from '../lib/wbs_rollup.js'

const linhas = [
  { contrato_id: 'A', valor_total_est: 1000, custo_real: 800 },
  { contrato_id: 'A', valor_total_est: 500, custo_real: 700 },
  { contrato_id: 'B', valor_total_est: 2000, custo_real: 0 },
  { contrato_id: 'A', valor_total_est: 100, custo_real: 0, ativo: 0 },
]

describe('Worker — montarRollupWBS', () => {
  it('calcula o consolidado', () => {
    const r = worker(linhas)
    expect(r.total.estimado).toBe(3500)
    expect(r.total.realizado).toBe(1500)
  })
  it('paridade total com o Express', () => {
    expect(worker(linhas)).toEqual(express(linhas))
    expect(worker([])).toEqual(express([]))
  })
})

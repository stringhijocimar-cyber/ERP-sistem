// ============================================================
// Worker (nexus-cf) — montagem do Dashboard BI (função pura)
// Mesma semântica do coletarKPIs do Express, sobre o modelo documento.
// ============================================================
import { describe, expect, it } from 'vitest'
import { montarKPIsWorker } from '../../nexus-cf/src/index.js'

const HOJE = '2026-06-18'
const off = n => new Date(new Date(HOJE + 'T00:00:00Z').getTime() + n * 864e5).toISOString().slice(0, 10)

const contas = [
  { id: 'CP-V', status: 'Pendente', valor: 100, vencimento: off(-2) }, // vencida + a pagar
  { id: 'CP-P', status: 'Aprovado', valor: 200, vencimento: off(10) }, // a vencer + a pagar
  { id: 'CP-Q', status: 'Pago', valor: 300, vencimento: off(-2) },     // pago
]
const fornecedores = [
  { id: 'F1', ativo: 1, status: 'Homologado', score_medio: 8 },
  { id: 'F2', ativo: 1, status: 'Em Homologação', score_medio: 6 },
  { id: 'F3', ativo: 0, status: 'Homologado', score_medio: 10 }, // inativo: ignora
]
const pedidos = [
  { id: 'PC-1', status: 'Entregue', valor_total: 1000 },
  { id: 'PC-2', status: 'Emitido', valor_total: 500 },
  { id: 'PC-3', status: 'Cancelado', valor_total: 999 }, // não soma valor ativo
]

const base = { contas, fornecedores, pedidos, bloqueios: 2, liberados: 1, dias: 30, hoje: HOJE }

describe('Worker BI — montarKPIsWorker', () => {
  it('consolida a exposição financeira', () => {
    const f = montarKPIsWorker(base).financeiro
    expect(f.vencido_valor).toBe(100)
    expect(f.vencido_qtd).toBe(1)
    expect(f.a_vencer_valor).toBe(200)
    expect(f.pago_valor).toBe(300)
    expect(f.a_pagar_valor).toBe(300) // Pendente(100)+Aprovado(200)
  })

  it('mede a taxa de bloqueio do gate', () => {
    const g = montarKPIsWorker(base).gate
    expect(g.bloqueios).toBe(2)
    expect(g.liberados).toBe(1)
    expect(g.taxa_bloqueio).toBeCloseTo(2 / 3, 2)
  })

  it('resume homologação/score só dos fornecedores ativos', () => {
    const fo = montarKPIsWorker(base).fornecedores
    expect(fo.ativos).toBe(2)
    expect(fo.score_medio).toBe(7) // (8+6)/2, ignora inativo
    const st = Object.fromEntries(fo.por_status.map(s => [s.status, s.n]))
    expect(st['Homologado']).toBe(1)
    expect(st['Em Homologação']).toBe(1)
  })

  it('calcula taxa de entrega e valor ativo (exclui cancelado)', () => {
    const c = montarKPIsWorker(base).compras
    expect(c.pc_total).toBe(3)
    expect(c.pc_entregues).toBe(1)
    expect(c.pc_entregues_pct).toBeCloseTo(33.3, 1)
    expect(c.pc_valor_ativo).toBe(1500) // 1000+500, exclui o cancelado
  })

  it('inclui alertas por severidade e respeita o gate LGPD do admin', () => {
    const naoAdmin = montarKPIsWorker(base)
    expect(naoAdmin.alertas.alta).toBeGreaterThanOrEqual(1) // conta vencida
    const admin = montarKPIsWorker({ ...base, isAdmin: true, vencidosLGPD: [{ id: 'X' }] })
    expect(admin.alertas.total).toBeGreaterThan(naoAdmin.alertas.total)
  })
})

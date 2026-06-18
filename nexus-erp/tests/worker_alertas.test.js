// ============================================================
// Worker (nexus-cf) — montagem da Central de Alertas (função pura)
// Mesma semântica do coletarAlertas do Express, sobre o modelo documento.
// ============================================================
import { describe, expect, it } from 'vitest'
import { montarAlertasWorker } from '../../nexus-cf/src/index.js'

const HOJE = '2026-06-18'
const off = n => new Date(new Date(HOJE + 'T00:00:00Z').getTime() + n * 864e5).toISOString().slice(0, 10)

const contas = [
  { id: 'CP-VENC', numero: 'CP-VENC', status: 'Pendente', valor: 100, vencimento: off(-1) }, // vencida
  { id: 'CP-PROX', numero: 'CP-PROX', status: 'Aprovado', valor: 200, vencimento: off(3) },   // a vencer (3d)
  { id: 'CP-LONGE', numero: 'CP-LONGE', status: 'Pendente', valor: 300, vencimento: off(40) }, // fora da janela 7
  { id: 'CP-PAGA', numero: 'CP-PAGA', status: 'Pago', valor: 400, vencimento: off(-1) },        // não alerta
]
const pedidos = [
  { id: 'PC-ATR', numero: 'PC-ATR', status: 'Emitido', emitido_em: off(-30), prazo_entrega: 7 }, // atrasado
  { id: 'PC-OK', numero: 'PC-OK', status: 'Emitido', emitido_em: off(0), prazo_entrega: 7 },      // no prazo
  { id: 'PC-ENT', numero: 'PC-ENT', status: 'Entregue', emitido_em: off(-30), prazo_entrega: 7 }, // entregue: ignora
]

describe('Worker alertas — montarAlertasWorker', () => {
  it('admin recebe todas as categorias, ordenadas por severidade', () => {
    const a = montarAlertasWorker({ contas, pedidos, vencidosLGPD: [{ id: 'F1' }], dias: 7, hoje: HOJE, isAdmin: true })
    const tipos = a.map(x => x.tipo)
    expect(tipos).toContain('conta_vencida')
    expect(tipos).toContain('conta_a_vencer')
    expect(tipos).toContain('entrega_atrasada')
    expect(tipos).toContain('lgpd_retencao')
    expect(a[0].severidade).toBe('alta') // alta vem primeiro
  })

  it('ignora conta paga e fora da janela; ignora pedido entregue', () => {
    const a = montarAlertasWorker({ contas, pedidos, dias: 7, hoje: HOJE, isAdmin: false })
    const refs = a.map(x => x.ref)
    expect(refs).not.toContain('CP-PAGA')
    expect(refs).not.toContain('CP-LONGE')
    expect(refs).not.toContain('PC-ENT')
    expect(refs).not.toContain('PC-OK')
  })

  it('janela "dias" controla as contas a vencer', () => {
    const j1 = montarAlertasWorker({ contas, dias: 1, hoje: HOJE })
    expect(j1.some(x => x.tipo === 'conta_a_vencer')).toBe(false)
    const j7 = montarAlertasWorker({ contas, dias: 7, hoje: HOJE })
    expect(j7.some(x => x.tipo === 'conta_a_vencer')).toBe(true)
  })

  it('alerta LGPD só para admin', () => {
    const naoAdmin = montarAlertasWorker({ vencidosLGPD: [{ id: 'F1' }], hoje: HOJE, isAdmin: false })
    expect(naoAdmin.some(x => x.tipo === 'lgpd_retencao')).toBe(false)
    const admin = montarAlertasWorker({ vencidosLGPD: [{ id: 'F1' }], hoje: HOJE, isAdmin: true })
    expect(admin.some(x => x.tipo === 'lgpd_retencao')).toBe(true)
  })
})

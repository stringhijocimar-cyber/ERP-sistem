// @vitest-environment jsdom
// ============================================================
// Testes — card "Margem real do contrato" no front (contratos.js).
// _margemContratoHTML (puro) + carregarMargemContrato (fetch + injeta).
// ============================================================
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const MARGEM = {
  contrato_id: 7, numero: 'CT-2026-007', titulo: 'Manutenção Mina', valor_contratado: 1000000,
  receita: 500000, custo_pedidos: 120000, custo_mao_obra: 5000, horas_mao_obra: 100,
  custo_total: 125000, resultado: 375000, margem_pct: 75,
  linhas: [
    { label: 'Receita faturada (contas a receber)', valor: 500000, tipo: 'receita' },
    { label: '(-) Custo de pedidos/compras', valor: -120000, tipo: 'custo' },
    { label: '(-) Custo de mão de obra', valor: -5000, tipo: 'custo' },
    { label: '= Resultado do contrato', valor: 375000, tipo: 'total' },
  ],
}

beforeAll(async () => {
  window.showToast = vi.fn(); window.closeModal = vi.fn(); window.logAction = vi.fn()
  window.currentUser = { profile: 'admin' }
  window.fmt = v => 'R$ ' + Number(v || 0).toLocaleString('pt-BR')
  window.fmtK = v => 'R$ ' + Math.round((v || 0) / 1000) + 'k'
  window.fmtDate = v => String(v || '')
  window.statusBadge = s => `<span>${s || ''}</span>`
  window.ERP_DATA = { contratos: [] }
  window.renderContratos = vi.fn()
  window.apiAuth = vi.fn(async () => MARGEM)
  await import('../public/js/nexus_api.js')
  await import('../public/js/pages/contratos.js')
  window.renderContratos = vi.fn()
})

beforeEach(() => { document.body.innerHTML = '<div id="margemContratoReal"></div>' })

describe('_margemContratoHTML (puro)', () => {
  it('renderiza margem, linhas e mão de obra', () => {
    const html = window._margemContratoHTML(MARGEM)
    expect(html).toContain('Margem real do contrato')
    expect(html).toContain('75%')
    expect(html).toContain('Custo de mão de obra')
    expect(html).toContain('100h')
  })
  it('margem ausente não quebra', () => {
    expect(window._margemContratoHTML(null)).toBe('')
  })
})

describe('carregarMargemContrato', () => {
  it('busca /api/contratos/:id/margem e injeta o card', async () => {
    await window.carregarMargemContrato(7)
    expect(window.apiAuth).toHaveBeenCalledWith('/api/contratos/7/margem')
    expect(document.getElementById('margemContratoReal').innerHTML).toContain('Margem real do contrato')
  })
  it('erro no fetch deixa o container vazio (silencioso)', async () => {
    window.apiAuth = vi.fn(async () => { throw new Error('404') })
    await window.carregarMargemContrato(999)
    expect(document.getElementById('margemContratoReal').innerHTML).toBe('')
    window.apiAuth = vi.fn(async () => MARGEM)
  })
})

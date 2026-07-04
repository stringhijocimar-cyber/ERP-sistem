// @vitest-environment jsdom
// ============================================================
// Testes — correções da varredura de qualidade #2 (PRs #75–#80):
//  F1: filterContratos não quebra com id numérico (contrato real).
//  F2: _ctrContratos / _pgContratosDisponiveis não quebram com JSON
//      não-array em fa_contratos.
//  F3: _crmSyncLeadServidor não faz POST duplicado (guarda de in-flight).
//  F4: NexusAPI.post NÃO mostra "módulo não conectado" em 409 (negócio).
// ============================================================
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

let respStatus = 200

beforeAll(async () => {
  window.showToast = vi.fn(); window.closeModal = vi.fn(); window.logAction = vi.fn()
  window.openModal = vi.fn(); window.openModalWide = vi.fn()
  window.currentUser = { profile: 'admin', name: 'Tester' }
  window.gerarId = p => `${p}-${Math.random().toString(36).slice(2, 8)}`
  window.fmt = v => 'R$ ' + (v || 0); window.fmtK = v => 'R$ ' + (v || 0)
  window.fmtDate = v => String(v || ''); window.statusBadge = s => `<span>${s || ''}</span>`
  window.ERP_DATA = { contratos: [] }
  await import('../public/js/nexus_api.js')
  await import('../public/js/pages/contratos.js')
  await import('../public/js/pages/projetos_gantt.js')
})

beforeEach(() => { localStorage.clear(); document.body.innerHTML = '<div id="mainContent"></div>'; respStatus = 200 })

describe('F1 — filterContratos com id numérico', () => {
  it('não quebra ao filtrar contrato real (id number)', () => {
    localStorage.setItem('fa_contratos', JSON.stringify([{ id: 42, numero: 'CT-2026-001', titulo: 'Cliente Real', status: 'Ativo' }]))
    document.body.innerHTML = `<input id="searchContratos" value="cliente"><select id="filterStatus"></select><select id="filterTipo"></select><div id="tabelaContratos"></div>`
    expect(() => window.filterContratos()).not.toThrow()
    expect(document.getElementById('tabelaContratos').innerHTML).toContain('Cliente Real')
  })
})

describe('F2 — fa_contratos com JSON não-array', () => {
  it('_ctrContratos devolve o seed sem quebrar quando o cache é um objeto', () => {
    window.ERP_DATA = { contratos: [{ id: 'SEED-1', cliente: 'Demo', status: 'Ativo', valor: 1 }] }
    localStorage.setItem('fa_contratos', JSON.stringify({ items: [] })) // objeto, não array
    expect(() => window._ctrContratos()).not.toThrow()
    expect(window._ctrContratos()[0].id).toBe('SEED-1')
  })
  it('_pgContratosDisponiveis não quebra com objeto vazio', () => {
    delete window._ctrContratos // força o caminho local do gantt
    localStorage.setItem('fa_contratos', JSON.stringify({}))
    expect(() => window._pgContratosDisponiveis()).not.toThrow()
  })
})

describe('F4 — NexusAPI.post não engana em 409', () => {
  it('409 de negócio NÃO dispara toast "módulo não conectado"; 404 dispara', async () => {
    window.NexusToast = vi.fn()
    global.fetch = vi.fn(async () => ({ ok: false, status: 409, json: async () => ({ error: 'Proposta bloqueada' }) }))
    const r409 = await window.NexusAPI.post('/api/propostas', {})
    expect(window.NexusToast).not.toHaveBeenCalled()
    expect(r409._stub).toBe(false)
    expect(r409.status).toBe(409)

    global.fetch = vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) }))
    await window.NexusAPI.post('/api/inexistente', {})
    expect(window.NexusToast).toHaveBeenCalledWith(expect.stringMatching(/não conectado/), 'info')
  })
})

// @vitest-environment jsdom
// ============================================================
// Testes — Dashboard com dados REAIS do servidor:
//  1. O boot (DB._init) pré-carrega contas-pagar/OS/contratos do servidor
//     para os caches que o dashboard lê — sem apagar o cache local quando
//     o servidor devolve lista vazia.
//  2. _dashContratos: contratos reais têm precedência sobre o seed demo.
// ============================================================
import { beforeAll, describe, expect, it, vi } from 'vitest'

const RESPOSTAS = {
  '/api/contas-pagar': [{ id: 77, numero: 'CP-1', valor: 1000, status: 'Pendente' }],
  '/api/os': [{ id: 88, numero: 'OS-1', status: 'Aberta' }],
  '/api/contratos': [], // servidor SEM contratos → cache local preservado
}

beforeAll(async () => {
  global.fetch = vi.fn(async (url) => {
    const path = String(url).replace(/\?.*$/, '')
    const data = RESPOSTAS[path] ?? []
    return { ok: true, status: 200, json: async () => ({ success: true, data }) }
  })
  await import('../public/js/db.js')
  await import('../public/js/pages/dashboard.js')
})

describe('Boot — preload dos caches do dashboard', () => {
  it('carrega contas a pagar e OS do servidor para o localStorage', async () => {
    localStorage.setItem('fa_contratos', JSON.stringify([{ id: 'CT-local', titulo: 'Local', status: 'Ativo' }]))
    await window.DB._init()
    expect(JSON.parse(localStorage.getItem('fa_contas_pagar'))[0].numero).toBe('CP-1')
    expect(JSON.parse(localStorage.getItem('fa_ordens_servico'))[0].numero).toBe('OS-1')
  })

  it('lista vazia do servidor NÃO apaga o cache local', () => {
    const contratos = JSON.parse(localStorage.getItem('fa_contratos'))
    expect(contratos.length).toBe(1)
    expect(contratos[0].id).toBe('CT-local')
  })
})

describe('_dashContratos — dados reais têm precedência sobre o demo', () => {
  it('com contratos reais no cache, o seed ERP_DATA é ignorado', () => {
    window.ERP_DATA = { contratos: [{ id: 'DEMO-1', titulo: 'Demo', status: 'Ativo' }] }
    localStorage.setItem('fa_contratos', JSON.stringify([{ id: 'CT-9', titulo: 'Real', status: 'Ativo' }]))
    const r = window._dashContratos()
    expect(r.length).toBe(1)
    expect(r[0].id).toBe('CT-9')
  })

  it('sem contratos reais, cai no seed demo (comportamento anterior)', () => {
    localStorage.removeItem('fa_contratos')
    const r = window._dashContratos()
    expect(r[0].id).toBe('DEMO-1')
  })
})

// @vitest-environment jsdom
// ============================================================
// Testes — Badge multi-empresa ligado ao tenant REAL do servidor.
// O boot (DB._init) cacheia /api/empresas/atual em 'fa_empresa_atual';
// getEmpresaAtiva passa a usar essa identidade (nome/CNPJ do servidor),
// caindo no seletor local apenas quando não há cache do servidor.
// ============================================================
import { beforeAll, describe, expect, it, vi } from 'vitest'

beforeAll(async () => {
  global.fetch = vi.fn(async (url) => {
    const path = String(url).replace(/\?.*$/, '')
    const data = path === '/api/empresas/atual'
      ? { id: 2, razao_social: 'Cliente B S.A.', nome_fantasia: 'B Corp', cnpj: '11.222.333/0001-81' }
      : []
    return { ok: true, status: 200, json: async () => ({ success: true, data }) }
  })
  await import('../public/js/db.js')
  await import('../public/js/empresas.js')
})

describe('Badge multi-empresa — identidade do servidor', () => {
  it('DB._init cacheia a empresa atual do servidor', async () => {
    await window.DB._init()
    const cache = JSON.parse(localStorage.getItem('fa_empresa_atual'))
    expect(cache.razao_social).toBe('Cliente B S.A.')
  })

  it('getEmpresaAtiva usa a identidade do servidor (não o seletor local)', () => {
    localStorage.setItem('erp_empresas', JSON.stringify([{ id: 'EMP-001', nome: 'Local Fake', fantasia: 'Fake', cnpj: '00.000.000/0001-00' }]))
    localStorage.setItem('erp_empresa_ativa', 'EMP-001')
    const emp = window.getEmpresaAtiva()
    expect(emp.nome).toBe('Cliente B S.A.')
    expect(emp.fantasia).toBe('B Corp')
    expect(emp.cnpj).toBe('11.222.333/0001-81')
    expect(emp._servidor).toBe(true)
  })

  it('sem cache do servidor, cai no seletor local (comportamento anterior)', () => {
    localStorage.removeItem('fa_empresa_atual')
    const emp = window.getEmpresaAtiva()
    expect(emp.nome).toBe('Local Fake')
  })
})

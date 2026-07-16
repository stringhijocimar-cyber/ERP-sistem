// @vitest-environment jsdom
// ============================================================
// Testes — reconcile de boot (db.js): módulos só-localStorage (projetos,
// contratos, crm, ssma, medições) são empurrados para /api/<ent>/sync
// quando o servidor ainda não tem o snapshot. Fecha a persistência dos
// módulos que antes viviam apenas no navegador.
// ============================================================
import { beforeAll, describe, expect, it, vi } from 'vitest'

let chamadas = []

beforeAll(async () => {
  global.fetch = vi.fn(async (url, opts = {}) => {
    chamadas.push({ url: String(url), method: (opts.method || 'GET').toUpperCase() })
    return { ok: true, status: 200, json: async () => ({ success: true, data: [] }) }
  })
  await import('../public/js/db.js')
})

describe('reconcile de boot — snapshots locais → servidor', () => {
  it('expõe _syncSnapshot e _reconcileSnapshotsOnBoot', () => {
    expect(typeof window._syncSnapshot).toBe('function')
    expect(typeof window._reconcileSnapshotsOnBoot).toBe('function')
  })

  it('empurra ssma e medições locais quando o servidor está vazio', async () => {
    localStorage.setItem('fa_incidentes', JSON.stringify([{ id: 1, titulo: 'Quase acidente' }]))
    localStorage.setItem('fa_medicoes_v2', JSON.stringify([{ id: 'M-1', valor: 500 }]))
    localStorage.setItem('fa_projetos_gantt', JSON.stringify([{ id: 'P-1', nome: 'Obra' }]))

    // Marca a API como disponível (o reconcile checa _apiOk via DB._init).
    await window.DB._init()

    const posts = chamadas.filter(c => c.method === 'POST' && c.url.includes('/sync'))
    expect(posts.some(c => c.url.includes('/api/ssma/sync'))).toBe(true)
    expect(posts.some(c => c.url.includes('/api/medicoes/sync'))).toBe(true)
    expect(posts.some(c => c.url.includes('/api/projetos/sync'))).toBe(true)
  })

  it('NÃO empurra entidade sem dados locais', async () => {
    chamadas = []
    localStorage.removeItem('fa_contratos') // sem contratos locais
    await window._reconcileSnapshotsOnBoot()
    expect(chamadas.some(c => c.method === 'POST' && c.url.includes('/api/contratos/sync'))).toBe(false)
  })
})

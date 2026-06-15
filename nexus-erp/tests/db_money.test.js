// @vitest-environment jsdom
// ============================================================
// Testes da religação do db.js — CAMINHO DO DINHEIRO
// Verifica: módulo de contas com gate (pagar), emitirPC, e a semântica
// server-authoritative sob NEXUS_SERVER_MODE (sem fallback que forje status).
// ============================================================
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

let DB

beforeAll(async () => {
  // Evita que o auto-init do db.js (setTimeout no fim do arquivo) dispare fetch.
  vi.useFakeTimers()
  global.fetch = vi.fn(async () => ({ ok: false, status: 0, json: async () => ({ error: 'offline' }) }))
  await import('../public/js/db.js')
  DB = window.DB
})

beforeEach(() => {
  window.NEXUS_SERVER_MODE = false
  localStorage.clear()
})

describe('db.js — superfície do caminho do dinheiro', () => {
  it('expõe DB.contas.pagar e DB.mapas.emitirPC', () => {
    expect(typeof DB.contas.pagar).toBe('function')
    expect(typeof DB.mapas.emitirPC).toBe('function')
    expect(typeof DB.serverMode.get).toBe('function')
  })
})

describe('Gate de pagamento (DB.contas.pagar)', () => {
  it('chama o endpoint do gate e propaga o 409 com o motivo', async () => {
    const calls = []
    global.fetch = vi.fn(async (url) => {
      calls.push(String(url))
      if (String(url).includes('/pagar')) {
        return { ok: false, status: 409, json: async () => ({ error: 'Pagamento bloqueado: sem nota fiscal' }) }
      }
      return { ok: false, status: 0, json: async () => ({ error: 'offline' }) }
    })
    await expect(DB.contas.pagar('CP-1')).rejects.toThrow(/bloqueado/i)
    expect(calls.some(u => u.includes('/api/contas-pagar/CP-1/pagar'))).toBe(true)
  })
})

describe('Aprovação de mapa server-authoritative', () => {
  it('em SERVER MODE, mapas.aprovar NÃO cai para localStorage (propaga erro)', async () => {
    window.NEXUS_SERVER_MODE = true
    global.fetch = vi.fn(async () => ({ ok: false, status: 403, json: async () => ({ error: 'sem permissão' }) }))
    await expect(DB.mapas.aprovar('M-1', { aprovador: 'x' })).rejects.toThrow()
    // Não pode haver status "Aprovado" forjado no cache local.
    expect(localStorage.getItem('fa_mapas_comp')).toBeNull()
  })

  it('em modo LEGADO, mapas.aprovar cai para localStorage', async () => {
    window.NEXUS_SERVER_MODE = false
    localStorage.setItem('fa_mapas_comp', JSON.stringify([{ id: 'M-1', status: 'Em análise' }]))
    global.fetch = vi.fn(async () => ({ ok: false, status: 500, json: async () => ({ error: 'offline' }) }))
    const r = await DB.mapas.aprovar('M-1', { aprovador: 'x' })
    expect(r._local).toBe(true)
    const m = JSON.parse(localStorage.getItem('fa_mapas_comp'))[0]
    expect(m.status).toBe('Aprovado')
  })
})

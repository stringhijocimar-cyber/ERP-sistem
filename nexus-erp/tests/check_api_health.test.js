// @vitest-environment jsdom
// ============================================================
// Testes — o front detecta online/offline via /api/health (público),
// não mais via /api/dashboard (que exige token e é escopado por tenant).
// Antes do fix, um usuário deslogado via a API como "offline" à toa.
// ============================================================
import { beforeAll, describe, expect, it, vi } from 'vitest'

const urls = []

beforeAll(async () => {
  global.fetch = vi.fn(async (url) => {
    urls.push(String(url).replace(/\?.*$/, ''))
    return { ok: true, status: 200, json: async () => ({ success: true, data: { ok: true } }) }
  })
  await import('../public/js/db.js')
})

describe('_checkApi → /api/health', () => {
  it('o boot sonda /api/health e NÃO usa /api/dashboard como probe', async () => {
    await window.DB.checkApi()
    expect(urls).toContain('/api/health')
    expect(urls).not.toContain('/api/dashboard')
  })
})

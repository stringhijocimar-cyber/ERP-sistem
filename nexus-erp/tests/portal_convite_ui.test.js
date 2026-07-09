// @vitest-environment jsdom
// ============================================================
// Testes — aceite público de convite no front (portal_convite.js):
// detecção do token na URL + render da tela de aceite.
// ============================================================
import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('detecção do token de convite', () => {
  beforeEach(() => { vi.resetModules(); document.body.innerHTML = '' })

  it('só aciona quando o path/param é de convite', async () => {
    window.history.replaceState({}, '', '/portal/convite?token=abc123')
    await import('../public/js/pages/portal_convite.js')
    expect(window._portalConviteToken()).toBe('abc123')
  })

  it('ignora um "token" em URL comum (sem contexto de convite)', async () => {
    window.history.replaceState({}, '', '/dashboard?token=xyz')
    await import('../public/js/pages/portal_convite.js')
    expect(window._portalConviteToken()).toBeNull()
  })

  it('renderiza a tela de aceite para um convite válido', async () => {
    window.history.replaceState({}, '', '/portal/convite?token=tok-valido')
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ success: true, data: { valido: true, email: 'joao@aco.com', fornecedor_nome: 'Aço Novo', empresa: 'Fraser' } }) }))
    await import('../public/js/pages/portal_convite.js')
    await new Promise(r => setTimeout(r, 10))
    const overlay = document.getElementById('convite-overlay')
    expect(overlay).toBeTruthy()
    expect(overlay.innerHTML).toContain('Portal do Fornecedor')
    expect(overlay.innerHTML).toContain('joao@aco.com')
    expect(overlay.querySelector('#cv_btn')).toBeTruthy()
  })

  it('convite inválido mostra aviso, não o formulário', async () => {
    window.history.replaceState({}, '', '/portal/convite?token=tok-usado')
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ success: true, data: { valido: false, situacao: 'aceito' } }) }))
    await import('../public/js/pages/portal_convite.js')
    await new Promise(r => setTimeout(r, 10))
    const overlay = document.getElementById('convite-overlay')
    expect(overlay.innerHTML).toContain('aceito')
    expect(overlay.querySelector('#cv_btn')).toBeFalsy()
  })
})

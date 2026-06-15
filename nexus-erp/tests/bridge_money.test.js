// @vitest-environment jsdom
// ============================================================
// Testes da religação do caminho do dinheiro no bridge.
// Verifica que, com NEXUS_SERVER_MODE ligado, as ações locais de mapa
// (aprovar / emitir PC) passam a delegar ao servidor; e que, desligado,
// o comportamento legado (localStorage) é preservado.
// ============================================================
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

beforeAll(async () => {
  // Stubs dos globais que o bridge referencia.
  window.apiAuth = async () => null
  window.showToast = () => {}
  window.openModal = () => {}
  window.closeModal = () => {}
  window.switchFluxoTab = () => {}
  window.DB = { mapas: { emitirPC: async () => ({ id: 'PC-x' }) }, contas: {} }
  // Funções locais "legadas" — definidas ANTES do bridge as envolver.
  window.aprovarMapa2 = vi.fn(() => 'local-aprovar')
  window.emitirPedidoDoMapa = vi.fn(() => 'local-emitir')
  window.gerarPedidoDeMapa = vi.fn(() => 'local-gerar')
  await import('../public/js/fluxo_server_bridge.js')
})

beforeEach(() => { window.NEXUS_SERVER_MODE = false })

describe('bridge — religação do caminho do dinheiro', () => {
  it('modo OFF (legado): usa as funções locais', () => {
    expect(window.emitirPedidoDoMapa('M1')).toBe('local-emitir')
    expect(window.gerarPedidoDeMapa('M1')).toBe('local-gerar')
    expect(window.aprovarMapa2('M1')).toBe('local-aprovar')
  })

  it('modo ON: delega emissão de PC e aprovação ao servidor', () => {
    window.NEXUS_SERVER_MODE = true
    const spyEmit = vi.fn()
    const spyAprov = vi.fn()
    window.emitirPCServer = spyEmit
    window.aprovarMapaServer = spyAprov

    window.emitirPedidoDoMapa('M1')
    window.gerarPedidoDeMapa('M2')
    window.aprovarMapa2('M3')

    expect(spyEmit).toHaveBeenCalledWith('M1')
    expect(spyEmit).toHaveBeenCalledWith('M2')
    expect(spyAprov).toHaveBeenCalledWith('M3')
  })
})

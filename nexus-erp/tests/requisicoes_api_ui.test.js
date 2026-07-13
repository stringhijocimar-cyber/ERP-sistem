// @vitest-environment jsdom
// ============================================================
// Testes — migração da página Requisições para a API (/api/rc).
// A API é a fonte de verdade; RCs locais legadas (demo) seguem visíveis via
// merge; _reqSaveRC nunca persiste linhas da API (evita duplicação).
// ============================================================
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const RC_SERVIDOR = {
  id: 7, numero: 'RC-2026-007', status: 'Pendente', tipo: 'Material', wbs: 'WBS-9',
  prioridade: 'Alta', valor_total: 3500, solicitante_nome: 'Ana', os_numero: 'OS-1',
  observacoes: 'Reposição rolamentos', created_at: '2026-07-10 12:00:00',
  itens: [{ descricao: 'Rolamento 6205', quantidade: 10, unidade: 'PC', valor_unitario_estimado: 350 }],
}

beforeAll(async () => {
  // stubs de ambiente exigidos pelo suprimentos.js no import
  window.hasPermission = () => true
  window.ERP_DATA = { contratos: [] }
  window.showToast = () => {}
  await import('../public/js/nexus_api.js')
  await import('../public/js/pages/suprimentos.js')
})

beforeEach(() => {
  localStorage.clear()
  window._reqRCsCache = null
})

describe('_reqAdaptarRC (servidor → tela)', () => {
  it('mapeia campos e marca origem api', () => {
    const a = window._reqAdaptarRC(RC_SERVIDOR)
    expect(a.numero).toBe('RC-2026-007')
    expect(a.titulo).toBe('Reposição rolamentos')
    expect(a.contrato).toBe('WBS-9')          // WBS exibida na coluna contrato
    expect(a.urgencia).toBe('Alta')
    expect(a.data_criacao).toBe('2026-07-10')
    expect(a.itens[0].valor_unit).toBe(350)
    expect(a.origem).toBe('api')
  })
  it('sem observações usa a descrição do 1º item como título', () => {
    const a = window._reqAdaptarRC({ ...RC_SERVIDOR, observacoes: null })
    expect(a.titulo).toBe('Rolamento 6205')
  })
})

describe('_reqGetRC (merge API + legado local)', () => {
  it('API carregada: serve API + locais (nada some)', () => {
    localStorage.setItem('fa_rcs', JSON.stringify([{ id: 'REQ-LOCAL-1', numero: 'REQ-LOCAL-1', status: 'Aguardando Aprovação' }]))
    window._reqRCsCache = { dados: [window._reqAdaptarRC(RC_SERVIDOR)] }
    const lista = window._reqGetRC()
    expect(lista.length).toBe(2)
    expect(lista[0].origem).toBe('api')
    expect(lista[1].numero).toBe('REQ-LOCAL-1')
  })
  it('sem API (offline): cai no modo local', () => {
    localStorage.setItem('fa_rcs', JSON.stringify([{ id: 'X', status: 'Aguardando Aprovação' }]))
    expect(window._reqGetRC().length).toBe(1)
  })
})

describe('_reqSaveRC (proteção contra duplicação)', () => {
  it('NUNCA persiste linhas da API no localStorage', () => {
    window._reqSaveRC([
      { id: 7, numero: 'RC-2026-007', origem: 'api' },
      { id: 'REQ-LOCAL-1', numero: 'REQ-LOCAL-1' },
    ])
    const salvas = JSON.parse(localStorage.getItem('fa_rcs'))
    expect(salvas.length).toBe(1)
    expect(salvas[0].numero).toBe('REQ-LOCAL-1')
  })
})

describe('_reqCarregarRCsAPI', () => {
  it('popula o cache a partir de /api/rc', async () => {
    window.apiAuth = vi.fn(async () => [RC_SERVIDOR])
    const ok = await window._reqCarregarRCsAPI()
    expect(ok).toBe(true)
    expect(window.apiAuth).toHaveBeenCalledWith('/api/rc')
    expect(window._reqRCsCache.dados[0].origem).toBe('api')
  })
  it('falha de rede → cache null (modo local), sem quebrar', async () => {
    window.apiAuth = vi.fn(async () => { throw new Error('offline') })
    const ok = await window._reqCarregarRCsAPI()
    expect(ok).toBe(false)
    expect(window._reqRCsCache).toBeNull()
  })
})

// @vitest-environment jsdom
// ============================================================
// Testes — Projetos/Gantt vinculando contratos REAIS.
// O seletor de "Contrato Vinculado" agora normaliza o shape do servidor
// (titulo/valor_total) e mescla com o seed; o valor contratual é sugerido
// ao selecionar. Antes, contratos do servidor apareciam SEM nome.
// ============================================================
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

beforeAll(async () => {
  window.showToast = vi.fn()
  window.ERP_DATA = { contratos: [{ id: 'SEED-9', cliente: 'Demo Seed', valor: 111, status: 'Ativo' }] }
  await import('../public/js/pages/projetos_gantt.js')
})

beforeEach(() => { localStorage.clear(); document.body.innerHTML = ''; delete window._ctrContratos })

describe('_pgContratosDisponiveis', () => {
  it('normaliza contratos do servidor (titulo/valor_total) e mescla com o seed', () => {
    localStorage.setItem('fa_contratos', JSON.stringify([{ id: 42, numero: 'CT-2026-001', titulo: 'Cliente Real', valor_total: 900000 }]))
    const lista = window._pgContratosDisponiveis()
    expect(lista[0].cliente).toBe('Cliente Real')
    expect(lista[0].valor).toBe(900000)
    expect(lista.some(c => c.id === 'SEED-9')).toBe(true)
  })

  it('reusa _ctrContratos da página de contratos quando disponível', () => {
    window._ctrContratos = () => [{ id: 1, numero: 'CT-X', cliente: 'Via Helper', valor: 5 }]
    expect(window._pgContratosDisponiveis()[0].cliente).toBe('Via Helper')
  })
})

describe('_pgContratoOpts', () => {
  it('gera options com número, nome e data-valor (escapados)', () => {
    localStorage.setItem('fa_contratos', JSON.stringify([{ id: 42, numero: 'CT-2026-001', titulo: '<b>Real</b>', valor_total: 900000 }]))
    const html = window._pgContratoOpts()
    expect(html).toContain('CT-2026-001')
    expect(html).toContain('data-valor="900000"')
    expect(html).not.toContain('<b>Real</b>')
    expect(html).toContain('&lt;b&gt;Real&lt;/b&gt;')
  })
})

describe('_pgAutoValorContrato', () => {
  it('sugere o valor do contrato quando o campo está vazio', () => {
    document.body.innerHTML = `<select id="s"><option value="42" data-valor="900000" selected>CT</option></select><input id="np_valor" value="">`
    window._pgAutoValorContrato(document.getElementById('s'))
    expect(document.getElementById('np_valor').value).toBe('900000')
  })

  it('NÃO sobrescreve valor já digitado pelo usuário', () => {
    document.body.innerHTML = `<select id="s"><option value="42" data-valor="900000" selected>CT</option></select><input id="np_valor" value="123">`
    window._pgAutoValorContrato(document.getElementById('s'))
    expect(document.getElementById('np_valor').value).toBe('123')
  })
})

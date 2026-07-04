// @vitest-environment jsdom
// ============================================================
// Testes — página RH (front): _rhResumo puro + render + ações.
// ============================================================
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

let colabs = []
let chamadas = []

beforeAll(async () => {
  window.apiAuth = vi.fn(async (path, opts = {}) => {
    chamadas.push({ path, method: (opts.method || 'GET').toUpperCase(), body: opts.body || null })
    if (path === '/api/colaboradores') return colabs
    return { id: 1 }
  })
  window.showToast = vi.fn()
  window.fmt = v => 'R$ ' + Number(v || 0).toLocaleString('pt-BR')
  await import('../public/js/nexus_api.js')
  await import('../public/js/pages/rh.js')
})

beforeEach(() => { chamadas = []; document.body.innerHTML = '<div id="mainContent"></div>' })

describe('_rhResumo (puro)', () => {
  it('conta ativos/inativos e custo/hora médio', () => {
    const r = window._rhResumo([
      { status: 'Ativo', custo_hora: 50 },
      { status: 'Ativo', custo_hora: 100 },
      { status: 'Inativo', custo_hora: 0 },
    ])
    expect(r.total).toBe(3)
    expect(r.ativos).toBe(2)
    expect(r.inativos).toBe(1)
    expect(r.custoHoraMedio).toBe(50) // (50+100+0)/3
  })
  it('lista vazia não quebra', () => {
    expect(window._rhResumo(undefined).total).toBe(0)
  })
})

describe('renderRH — dados reais', () => {
  it('monta a tabela a partir de /api/colaboradores', async () => {
    colabs = [{ id: 3, nome: 'João Operador', cargo: 'Operador', departamento: 'Operações', custo_hora: 50, status: 'Ativo' }]
    await window.renderRH()
    await new Promise(r => setTimeout(r, 10))
    const html = document.getElementById('mainContent').innerHTML
    expect(chamadas.some(c => c.path === '/api/colaboradores')).toBe(true)
    expect(html).toContain('João Operador')
    expect(html).toContain('Operador')
  })
  it('escapa HTML do nome (dado do banco)', async () => {
    colabs = [{ id: 4, nome: '<img src=x onerror=alert(1)>', custo_hora: 1, status: 'Ativo' }]
    await window.renderRH()
    await new Promise(r => setTimeout(r, 10))
    const html = document.getElementById('mainContent').innerHTML
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;img')
  })
})

describe('ações', () => {
  it('salvarColaborador POSTa /api/colaboradores', async () => {
    document.body.innerHTML += `<input id="rh_nome" value="Maria"><input id="rh_cargo" value="Técnica"><input id="rh_dep" value="Manutenção"><input id="rh_custo" value="70">`
    await window.salvarColaborador()
    const post = chamadas.find(c => c.method === 'POST' && c.path === '/api/colaboradores')
    expect(post.body).toMatchObject({ nome: 'Maria', custo_hora: 70 })
  })
  it('salvarColaborador sem nome não POSTa', async () => {
    document.body.innerHTML += `<input id="rh_nome" value=""><input id="rh_custo" value="10">`
    await window.salvarColaborador()
    expect(chamadas.some(c => c.method === 'POST' && c.path === '/api/colaboradores')).toBe(false)
  })
  it('salvarApontamento POSTa /api/apontamentos-hora com horas', async () => {
    document.body.innerHTML += `<input id="ap_contrato" value="CT-1"><input id="ap_data" value="2026-05-10"><input id="ap_horas" value="8"><input id="ap_desc" value="op">`
    await window.salvarApontamento(3)
    const post = chamadas.find(c => c.method === 'POST' && c.path === '/api/apontamentos-hora')
    expect(post.body).toMatchObject({ colaborador_id: 3, horas: 8, contrato_id: 'CT-1' })
  })
})

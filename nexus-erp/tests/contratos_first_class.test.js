// @vitest-environment jsdom
// ============================================================
// Testes — Contratos first-class no front:
//  • salvarNovoContrato POSTa /api/contratos (antes o botão era só toast);
//  • fallback local honesto quando offline;
//  • _ctrContratos normaliza o shape do servidor e mescla com o seed;
//  • salvarEdicaoContrato de contrato real faz PUT + atualiza o cache.
// ============================================================
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

let chamadas = []
let apiOk = true

beforeAll(async () => {
  global.fetch = vi.fn(async (url, opts = {}) => {
    const path = String(url).replace(/\?.*$/, '')
    const method = (opts.method || 'GET').toUpperCase()
    const body = opts.body ? JSON.parse(opts.body) : null
    chamadas.push({ path, method, body })
    if (!apiOk) return { ok: false, status: 0, json: async () => ({ error: 'offline' }) }
    let data = { ok: true }
    if (path === '/api/contratos' && method === 'POST') data = { id: 42, numero: 'CT-2026-001', ...body, status: 'Ativo' }
    if (path.startsWith('/api/contratos/') && method === 'PUT') data = { id: 42, ...body }
    return { ok: true, status: 200, json: async () => ({ success: true, data }) }
  })
  // Stubs de UI usados pela página
  window.showToast = vi.fn(); window.closeModal = vi.fn(); window.logAction = vi.fn()
  window.currentUser = { profile: 'admin' }
  window.fmt = v => 'R$ ' + (v || 0)
  window.fmtK = v => 'R$ ' + Math.round((v || 0) / 1000) + 'k'
  window.fmtDate = v => String(v || '')
  window.statusBadge = s => `<span>${s || ''}</span>`
  window.t = undefined
  window.ERP_DATA = { contratos: [{ id: 'SEED-1', cliente: 'Demo', status: 'Ativo', valor: 100, medidoAcum: 0, tipo: 'Serviço', descricao: '', gestor: 'X', unidade: 'U', margem: 10, progress: 0, ssmaStatus: 'N/A' }] }
  window.renderContratos = vi.fn() // evita montar a página inteira
  await import('../public/js/nexus_api.js')
  await import('../public/js/pages/contratos.js')
  window.renderContratos = vi.fn() // o import sobrescreve; re-stub
})

beforeEach(() => { chamadas = []; apiOk = true; localStorage.clear(); document.body.innerHTML = '' })

function formNovo(valores = {}) {
  const campos = { ctr_novo_cliente: 'ACME S.A.', ctr_novo_tipo: 'Serviço', ctr_novo_objeto: 'Manutenção', ctr_novo_inicio: '2026-01-01', ctr_novo_fim: '2026-12-31', ctr_novo_valor: '250000', ctr_novo_gestor: 'Maria', ...valores }
  document.body.innerHTML = '<div id="mainContent"></div>' + Object.entries(campos).map(([id, v]) => `<input id="${id}" value="${v}">`).join('')
}

describe('salvarNovoContrato', () => {
  it('POSTa para /api/contratos e grava o retorno do servidor no cache', async () => {
    formNovo()
    await window.salvarNovoContrato()
    const post = chamadas.find(c => c.method === 'POST' && c.path === '/api/contratos')
    expect(post.body.titulo).toBe('ACME S.A.')
    expect(post.body.valor_total).toBe(250000)
    const cache = JSON.parse(localStorage.getItem('fa_contratos'))
    expect(cache[0].numero).toBe('CT-2026-001')
    expect(cache[0].gestor).toBe('Maria')
    expect(window.showToast).toHaveBeenCalledWith(expect.stringMatching(/servidor/), 'success')
  })

  it('offline → salva localmente com aviso honesto (não finge sucesso no servidor)', async () => {
    apiOk = false
    formNovo()
    await window.salvarNovoContrato()
    const cache = JSON.parse(localStorage.getItem('fa_contratos'))
    expect(cache[0]._local).toBe(true)
    expect(window.showToast).toHaveBeenCalledWith(expect.stringMatching(/localmente/), 'info')
  })

  it('sem cliente → erro e nenhum POST', async () => {
    formNovo({ ctr_novo_cliente: '' })
    await window.salvarNovoContrato()
    expect(chamadas.some(c => c.method === 'POST')).toBe(false)
  })
})

describe('_ctrContratos — normalização e mescla', () => {
  it('normaliza shape do servidor (titulo/valor_total/objeto) e vem antes do seed', () => {
    localStorage.setItem('fa_contratos', JSON.stringify([{ id: 7, numero: 'CT-7', titulo: 'Cliente Real', valor_total: 900, objeto: 'Obra', responsavel_nome: 'João', data_inicio: '2026-02-01' }]))
    const lista = window._ctrContratos()
    expect(lista[0].cliente).toBe('Cliente Real')
    expect(lista[0].valor).toBe(900)
    expect(lista[0].descricao).toBe('Obra')
    expect(lista[0].gestor).toBe('João')
    expect(lista[0].inicio).toBe('2026-02-01')
    expect(lista.some(c => c.id === 'SEED-1')).toBe(true) // seed preservado
  })

  it('sem dados reais, devolve só o seed (comportamento anterior)', () => {
    expect(window._ctrContratos()[0].id).toBe('SEED-1')
  })
})

describe('salvarEdicaoContrato — contrato real', () => {
  it('faz PUT /api/contratos/:id e atualiza o cache', async () => {
    localStorage.setItem('fa_contratos', JSON.stringify([{ id: 42, numero: 'CT-2026-001', titulo: 'Velho', valor_total: 1, status: 'Ativo' }]))
    document.body.innerHTML = '<div id="mainContent"></div>' + ['ecCliente:Novo Nome', 'ecTipo:Serviço', 'ecDescricao:Obj', 'ecValor:5000', 'ecMargem:15', 'ecGestor:Ana', 'ecUnidade:MG', 'ecStatus:Ativo', 'ecSsma:Conforme', 'ecProgress:40']
      .map(s => { const [id, v] = s.split(':'); return `<input id="${id}" value="${v}">` }).join('')
    await window.salvarEdicaoContrato(42)
    const put = chamadas.find(c => c.method === 'PUT' && c.path === '/api/contratos/42')
    expect(put.body.titulo).toBe('Novo Nome')
    expect(put.body.valor_total).toBe(5000)
    const cache = JSON.parse(localStorage.getItem('fa_contratos'))
    expect(cache[0].titulo).toBe('Novo Nome')
    expect(cache[0].progress).toBe(40)
  })
})

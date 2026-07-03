// @vitest-environment jsdom
// ============================================================
// Testes — Proposta do CRM ligada ao C2 REAL (/api/propostas):
//  • lead sincronizado → POST com lead_id do servidor; proposta ganha o
//    número oficial (PROP-AAAA-NNN) e custo_estimado;
//  • gate C2: servidor bloqueia (409 sem estimativa WBS) → proposta NÃO
//    é criada e o usuário é orientado para o Controle de Custos;
//  • lead local (sem _srvId) → fluxo legado preservado, agora persistindo.
// ============================================================
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

let chamadas = []
let modoServidor = 'ok' // 'ok' | 'bloqueia' | 'offline'

beforeAll(async () => {
  global.fetch = vi.fn(async (url, opts = {}) => {
    const path = String(url).replace(/\?.*$/, '')
    const method = (opts.method || 'GET').toUpperCase()
    const body = opts.body ? JSON.parse(opts.body) : null
    chamadas.push({ path, method, body })
    if (modoServidor === 'offline') return { ok: false, status: 0, json: async () => ({ error: 'network down' }) }
    if (path === '/api/propostas' && method === 'POST') {
      if (modoServidor === 'bloqueia') return { ok: false, status: 409, json: async () => ({ success: false, error: 'Proposta bloqueada: lead sem estimativa de custos (WBS) — orçamentação pendente.' }) }
      return { ok: true, status: 200, json: async () => ({ success: true, data: { id: 555, numero: 'PROP-2026-003', custo_estimado: 100000, valor_total: body.valor_total } }) }
    }
    if (path === '/api/crm' && method === 'POST') return { ok: true, status: 200, json: async () => ({ success: true, data: { id: 91 } }) }
    return { ok: true, status: 200, json: async () => ({ success: true, data: { ok: true } }) }
  })
  window.showToast = vi.fn(); window.closeModal = vi.fn(); window.logAction = vi.fn()
  window.openModal = vi.fn(); window.openModalWide = vi.fn()
  window.currentUser = { profile: 'admin', name: 'Tester' }
  window.gerarId = p => `${p}-${Math.random().toString(36).slice(2, 8)}`
  window.fmt = v => 'R$ ' + (v || 0); window.fmtK = v => 'R$ ' + (v || 0)
  await import('../public/js/nexus_api.js')
  await import('../public/js/pages/crm.js')
})

beforeEach(() => {
  chamadas = []; modoServidor = 'ok'; window.showToast.mockClear()
  document.body.innerHTML = '<div id="mainContent"></div>'
  // Lead sincronizado (com _srvId) já em cache
  localStorage.setItem('fa_crm_data', JSON.stringify({ leads: [{ id: 'LEAD-1', empresa: 'Minera Alfa', etapa: 'Qualificação', potencial: 500000, _srvId: 91 }], oportunidades: [], atividades: [], propostas: [], contatos: [] }))
})

function formProposta() {
  document.body.innerHTML += ['propDesc:Manutenção industrial', 'propValor:120000', 'propNumero:FA-PROP-X', 'propCliente:Minera Alfa', 'propPrazo:24', 'propValidade:2026-08-30', 'propStatus:Enviada']
    .map(s => { const [id, ...v] = s.split(':'); return `<input id="${id}" value="${v.join(':')}">` }).join('')
}

// O CRM_DATA do módulo foi carregado no import; recarrega via helper interno
async function salvar() {
  // força o módulo a reler o cache (CRM_DATA é module-level): usa o próprio lead do módulo
  await window.salvarProposta('LEAD-1')
}

describe('Proposta CRM → C2 real', () => {
  it('POSTa /api/propostas com o lead_id do servidor e adota o número oficial', async () => {
    formProposta()
    // injeta o lead no CRM_DATA do módulo via salvarNovoLead? Mais simples: o módulo lê fa_crm_data no load.
    // Como CRM_DATA já foi carregado no import (vazio), recria o lead pelo fluxo real:
    document.body.innerHTML += ['nlEmpresa:Minera Alfa', 'nlContato:Carlos', 'nlPotencial:500000', 'nlProb:60', 'nlEtapa:Qualificação']
      .map(s => { const [id, v] = s.split(':'); return `<input id="${id}" value="${v}">` }).join('')
    window.renderCRM = vi.fn()
    window.salvarNovoLead()
    await new Promise(r => setTimeout(r, 10))
    const leadId = JSON.parse(localStorage.getItem('fa_crm_data')).leads[0].id
    await window.salvarProposta(leadId)
    const post = chamadas.find(c => c.method === 'POST' && c.path === '/api/propostas')
    expect(post.body.lead_id).toBe(91)
    expect(post.body.valor_total).toBe(120000)
    const dados = JSON.parse(localStorage.getItem('fa_crm_data'))
    expect(dados.propostas[0].numero).toBe('PROP-2026-003')
    expect(dados.propostas[0].custo_estimado).toBe(100000)
  })

  it('gate C2: bloqueio do servidor → proposta NÃO criada + orientação', async () => {
    formProposta()
    document.body.innerHTML += ['nlEmpresa:Minera Beta', 'nlContato:Ana', 'nlPotencial:1', 'nlProb:60', 'nlEtapa:Qualificação']
      .map(s => { const [id, v] = s.split(':'); return `<input id="${id}" value="${v}">` }).join('')
    window.renderCRM = vi.fn()
    window.salvarNovoLead()
    await new Promise(r => setTimeout(r, 10))
    const leadId = JSON.parse(localStorage.getItem('fa_crm_data')).leads[0].id
    const antes = JSON.parse(localStorage.getItem('fa_crm_data')).propostas.length
    modoServidor = 'bloqueia'
    await window.salvarProposta(leadId)
    const dados = JSON.parse(localStorage.getItem('fa_crm_data'))
    expect(dados.propostas.length).toBe(antes) // nada criado
    expect(window.showToast).toHaveBeenCalledWith(expect.stringMatching(/estimativa.*Controle de Custos/s), 'error', 8000)
  })

  it('offline → cai no fluxo local (proposta salva localmente, sem fingir servidor)', async () => {
    formProposta()
    document.body.innerHTML += ['nlEmpresa:Minera Gama', 'nlContato:Zé', 'nlPotencial:1', 'nlProb:60', 'nlEtapa:Qualificação']
      .map(s => { const [id, v] = s.split(':'); return `<input id="${id}" value="${v}">` }).join('')
    window.renderCRM = vi.fn()
    window.salvarNovoLead()
    await new Promise(r => setTimeout(r, 10))
    const leadId = JSON.parse(localStorage.getItem('fa_crm_data')).leads[0].id
    const antes = JSON.parse(localStorage.getItem('fa_crm_data')).propostas.length
    modoServidor = 'offline'
    await window.salvarProposta(leadId)
    const dados = JSON.parse(localStorage.getItem('fa_crm_data'))
    expect(dados.propostas.length).toBe(antes + 1)
    expect(dados.propostas[0]._srvId).toBeUndefined()
    expect(dados.propostas[0].numero).toBe('FA-PROP-X')
  })
})

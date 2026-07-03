// @vitest-environment jsdom
// ============================================================
// Testes — CRM first-class no front:
//  • salvarNovoLead persiste no localStorage (antes NEM isso) e POSTa
//    /api/crm com o mapeamento certo, guardando _srvId;
//  • alterarEtapaLead persiste + PUT /api/crm/:id (dispara o C1 no
//    servidor quando o lead passa de Qualificação);
//  • offline → lead fica local, sem _srvId (honesto).
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
    if (path === '/api/crm' && method === 'POST') data = { id: 91, ...body }
    return { ok: true, status: 200, json: async () => ({ success: true, data }) }
  })
  window.showToast = vi.fn(); window.closeModal = vi.fn(); window.logAction = vi.fn()
  window.openModal = vi.fn(); window.openModalWide = vi.fn()
  window.currentUser = { profile: 'admin', name: 'Tester' }
  window.gerarId = p => `${p}-${Math.random().toString(36).slice(2, 8)}`
  window.fmt = v => 'R$ ' + (v || 0); window.fmtK = v => 'R$ ' + (v || 0)
  window.renderCRM = vi.fn()
  await import('../public/js/nexus_api.js')
  await import('../public/js/pages/crm.js')
})

beforeEach(() => { chamadas = []; apiOk = true; localStorage.clear(); document.body.innerHTML = '<div id="mainContent"></div>' })

function formLead() {
  document.body.innerHTML += ['nlEmpresa:Minera Alfa', 'nlContato:Carlos', 'nlPotencial:800000', 'nlProb:60', 'nlEtapa:Prospecção', 'nlObs:obra grande']
    .map(s => { const [id, v] = s.split(':'); return `<input id="${id}" value="${v}">` }).join('')
}

const esperar = () => new Promise(r => setTimeout(r, 10))

describe('salvarNovoLead', () => {
  it('persiste no localStorage e POSTa /api/crm com o mapeamento certo', async () => {
    formLead()
    window.salvarNovoLead()
    await esperar()
    const dados = JSON.parse(localStorage.getItem('fa_crm_data'))
    expect(dados.leads[0].empresa).toBe('Minera Alfa')
    expect(dados.leads[0]._srvId).toBe(91) // id do servidor guardado
    const post = chamadas.find(c => c.method === 'POST' && c.path === '/api/crm')
    expect(post.body.titulo).toBe('Minera Alfa')
    expect(post.body.valor).toBe(800000)
    expect(post.body.estagio).toBe('Prospecção')
  })

  it('offline → lead salvo localmente sem _srvId (não finge servidor)', async () => {
    apiOk = false
    formLead()
    window.salvarNovoLead()
    await esperar()
    const dados = JSON.parse(localStorage.getItem('fa_crm_data'))
    expect(dados.leads[0].empresa).toBe('Minera Alfa')
    expect(dados.leads[0]._srvId).toBeUndefined()
  })
})

describe('alterarEtapaLead', () => {
  it('persiste e faz PUT /api/crm/:id com a nova etapa (gatilho C1 no servidor)', async () => {
    formLead()
    window.salvarNovoLead()
    await esperar()
    const leadId = JSON.parse(localStorage.getItem('fa_crm_data')).leads[0].id
    window.verDetalheLead = vi.fn() // reaberto no fim da troca
    window.alterarEtapaLead(leadId, 'Qualificação')
    await esperar()
    const put = chamadas.find(c => c.method === 'PUT' && c.path === '/api/crm/91')
    expect(put).toBeTruthy()
    expect(put.body.estagio).toBe('Qualificação')
    expect(JSON.parse(localStorage.getItem('fa_crm_data')).leads[0].etapa).toBe('Qualificação')
  })
})

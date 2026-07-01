// @vitest-environment jsdom
// ============================================================
// Testes — nav_safety (rede de segurança de navegação).
// Garante que nenhum render possa deixar a tela quebrada ou presa num
// spinner: detecção de travamento, card de erro com retry, e watchdog.
// ============================================================
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

beforeAll(async () => {
  window.NAV_WATCHDOG_MS = 50 // acelera o watchdog no teste
  await import('../public/js/nav_safety.js')
})

afterEach(() => { document.body.innerHTML = ''; window.__navToken = 0 })

function mainWith(html) {
  const el = document.createElement('div')
  el.id = 'mainContent'
  el.innerHTML = html
  document.body.appendChild(el)
  return el
}

describe('nav_safety — detecção de página travada', () => {
  it('placeholder de "Carregando" curto é considerado travado', () => {
    const m = mainWith('<p>Carregando Fornecedores...</p>')
    expect(window.__navSafetyPageIsStuck(m)).toBe(true)
  })

  it('spinner sem conteúdo é considerado travado', () => {
    const m = mainWith('<div class="spinner"></div>')
    expect(window.__navSafetyPageIsStuck(m)).toBe(true)
  })

  it('página com conteúdo real NÃO é travada', () => {
    const m = mainWith('<table><tr><td>Fornecedor A</td></tr><tr><td>Fornecedor B</td></tr></table><p>Lista completa carregada com muitos itens exibidos aqui.</p>')
    expect(window.__navSafetyPageIsStuck(m)).toBe(false)
  })
})

describe('nav_safety — card de erro', () => {
  it('renderiza mensagem + botão de retry com a página sanitizada', () => {
    const m = mainWith('<p>Carregando...</p>')
    window._renderPageError(m, { label: 'Fornecedores' }, new Error('boom'), 'fornecedores')
    expect(m.textContent).toMatch(/Não foi possível carregar Fornecedores/)
    expect(m.textContent).toMatch(/boom/)
    expect(m.querySelector('button').getAttribute('onclick')).toBe("navigate('fornecedores')")
  })

  it('sanitiza o nome da página no onclick (anti-injeção)', () => {
    const m = mainWith('')
    window._renderPageError(m, { label: 'X' }, new Error('x'), "a');alert(1)//")
    expect(m.querySelector('button').getAttribute('onclick')).toBe("navigate('aalert1')")
  })

  it('escapa a mensagem de erro', () => {
    const m = mainWith('')
    window._renderPageError(m, { label: 'X' }, new Error('<img src=x onerror=alert(1)>'), 'x')
    expect(m.innerHTML).not.toMatch(/<img/)
    expect(m.innerHTML).toMatch(/&lt;img/)
  })
})

describe('nav_safety — watchdog', () => {
  it('troca spinner travado por card de erro após o timeout', async () => {
    const m = mainWith('<p>Carregando dados...</p>')
    window.__navToken = 5
    window._armSpinnerWatchdog(m, { label: 'BI' }, 'bi', 5)
    await new Promise(r => setTimeout(r, 80))
    expect(m.textContent).toMatch(/Não foi possível carregar BI/)
  })

  it('NÃO mexe se o usuário já navegou (token mudou)', async () => {
    const m = mainWith('<p>Carregando dados...</p>')
    window.__navToken = 5
    window._armSpinnerWatchdog(m, { label: 'BI' }, 'bi', 5)
    window.__navToken = 6 // navegou para outra página
    await new Promise(r => setTimeout(r, 80))
    expect(m.textContent).toMatch(/Carregando dados/)
  })

  it('NÃO mexe se a página já carregou conteúdo real', async () => {
    const m = mainWith('<p>Carregando...</p>')
    window.__navToken = 7
    window._armSpinnerWatchdog(m, { label: 'BI' }, 'bi', 7)
    m.innerHTML = '<table><tr><td>linha</td></tr></table><p>Conteúdo real e extenso já foi renderizado com sucesso aqui.</p>'
    await new Promise(r => setTimeout(r, 80))
    expect(m.textContent).toMatch(/Conteúdo real/)
    expect(m.textContent).not.toMatch(/Não foi possível/)
  })
})

// ============================================================
// Teste de integridade do menu — a regressão que teria pegado os achados da
// auditoria: 5 itens SaaS sem rota ("Módulo em desenvolvimento"), kpi_exec
// duplicado no menu e páginas sem PAGE_META. Cruza index.html ↔ app.js.
// ============================================================
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')
const html = readFileSync(join(ROOT, 'index.html'), 'utf8')
const appjs = readFileSync(join(ROOT, 'js', 'app.js'), 'utf8')

// Itens do menu: navigate('x') dentro do bloco <nav> da sidebar (atributos
// extras como "active", style e badges não importam)
const navBlock = html.slice(html.indexOf('<nav'), html.indexOf('</nav>'))
const menuPages = [...navBlock.matchAll(/onclick="navigate\('([a-z_0-9]+)'\)"/g)].map(m => m[1])
// Route map: chaves do objeto `pages` dentro de renderPage/navigate
const pagesBlock = appjs.match(/const pages = \{([\s\S]*?)\n  \};/)
const routeKeys = new Set([...(pagesBlock ? pagesBlock[1] : '').matchAll(/^\s{4}'?([a-z_0-9]+)'?:/gm)].map(m => m[1]))
// PAGE_META
const metaBlock = appjs.match(/const PAGE_META = \{([\s\S]*?)\n\};/)
const metaKeys = new Set([...(metaBlock ? metaBlock[1] : '').matchAll(/^\s+([a-z_0-9]+):/gm)].map(m => m[1]))

describe('integridade do menu de navegação', () => {
  it('o menu tem itens e o route map foi extraído', () => {
    expect(menuPages.length).toBeGreaterThan(50)
    expect(routeKeys.size).toBeGreaterThan(50)
  })

  it('TODO item do menu tem rota registrada (nada cai em "Módulo em desenvolvimento")', () => {
    const semRota = menuPages.filter(p => !routeKeys.has(p))
    expect(semRota, `itens de menu sem rota: ${semRota.join(', ')}`).toEqual([])
  })

  it('nenhuma página aparece duas vezes no menu', () => {
    const vistos = new Set(); const dups = []
    for (const p of menuPages) { if (vistos.has(p)) dups.push(p); vistos.add(p) }
    expect(dups, `itens duplicados no menu: ${dups.join(', ')}`).toEqual([])
  })

  it('TODO item do menu tem PAGE_META (breadcrumb correto)', () => {
    const sem = menuPages.filter(p => !metaKeys.has(p))
    expect(sem, `itens sem PAGE_META: ${sem.join(', ')}`).toEqual([])
  })

  it('estrutura profissional: 11 seções na ordem esperada + 69 itens', () => {
    const navBloco = html.slice(html.indexOf('<nav'), html.indexOf('</nav>'))
    const secoes = [...navBloco.matchAll(/nav-section-label[^>]*>([^<]+)</g)].map(m => m[1].trim())
    expect(secoes).toEqual([
      'Visão Geral', 'Comercial', 'Operações', 'Suprimentos & Compras',
      'Industrial & Estoque', 'Fornecedores', 'Financeiro & Fiscal',
      'SSMA & Compliance', 'Relatórios & Análises', 'Administração', 'SaaS / Negócio',
    ])
    const itensDeSecao = [...navBloco.matchAll(/class="nav-item"[^>]*onclick="navigate/g)].length
    expect(itensDeSecao).toBe(70) // 70 nas seções (o atalho de perfil fica no rodapé)
  })

    it('rotas fora do menu são as intencionais (acessíveis por outros caminhos)', () => {
    const foraDoMenu = [...routeKeys].filter(k => !menuPages.includes(k))
    // sino (notificações) e o atalho interno do fluxo de RC; perfil fica no
    // rodapé da própria sidebar
    expect(foraDoMenu.sort()).toEqual(['fluxo_aprovacao_rc', 'notificacoes'])
  })

  it('funções de render referenciadas no route map existem em algum script', () => {
    const { readdirSync } = require('fs')
    let all = appjs
    for (const f of readdirSync(join(ROOT, 'js', 'pages'))) all += readFileSync(join(ROOT, 'js', 'pages', f), 'utf8')
    const defs = new Set([
      ...[...all.matchAll(/function (render[A-Za-z0-9_]+)/g)].map(m => m[1]),
      ...[...all.matchAll(/window\.(render[A-Za-z0-9_]+)\s*=/g)].map(m => m[1]),
    ])
    const refs = [...(pagesBlock ? pagesBlock[1] : '').matchAll(/render[A-Z][A-Za-z0-9_]*/g)].map(m => m[0])
    const faltando = [...new Set(refs.filter(r => !defs.has(r)))]
    expect(faltando, `renders inexistentes: ${faltando.join(', ')}`).toEqual([])
  })
})

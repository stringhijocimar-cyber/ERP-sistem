// ============================================================
// Testes — integridade do i18n.
// Regressão: a tela de login exibia as CHAVES cruas (login_btn,
// login_email, system_subtitle…) porque as chaves não existiam no
// dicionário e _applyI18nDOM sobrescrevia o texto do HTML com o nome
// da chave. Estes testes travam as duas causas.
// ============================================================
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pub = join(__dirname, '..', 'public')
const i18nSrc = readFileSync(join(pub, 'js', 'i18n.js'), 'utf8')
const html = readFileSync(join(pub, 'index.html'), 'utf8')

// Extrai as chaves declaradas dentro de um bloco de idioma (pt/en/es).
function chavesDoIdioma(lang) {
  const ini = i18nSrc.indexOf(`\n  ${lang}: {`)
  expect(ini, `bloco do idioma ${lang} não encontrado`).toBeGreaterThan(-1)
  const fim = i18nSrc.indexOf('\n  }', ini)
  const bloco = i18nSrc.slice(ini, fim)
  return new Set([...bloco.matchAll(/^\s*([a-zA-Z0-9_]+)\s*:/gm)].map(m => m[1]))
}

const usadasNoHtml = [
  ...new Set([...html.matchAll(/data-i18n(?:-ph|-title)?="([^"]+)"/g)].map(m => m[1])),
]

describe('i18n — cobertura das chaves', () => {
  it('index.html realmente usa chaves de tradução', () => {
    expect(usadasNoHtml.length).toBeGreaterThan(0)
  })

  for (const lang of ['pt', 'en', 'es']) {
    it(`toda chave usada no index.html existe no dicionário "${lang}"`, () => {
      const declaradas = chavesDoIdioma(lang)
      const faltando = usadasNoHtml.filter(k => !declaradas.has(k))
      expect(faltando, `chaves ausentes em ${lang}: ${faltando.join(', ')}`).toEqual([])
    })
  }

  it('as chaves da tela de login estão cadastradas (regressão)', () => {
    const login = ['system_subtitle', 'login_email', 'login_password', 'login_btn', 'login_demo', 'login_how']
    for (const lang of ['pt', 'en', 'es']) {
      const declaradas = chavesDoIdioma(lang)
      for (const k of login) {
        expect(declaradas.has(k), `${k} ausente em ${lang}`).toBe(true)
      }
    }
  })
})

describe('i18n — não sobrescreve o HTML quando a chave falta', () => {
  it('_applyI18nDOM consulta _hasKey antes de escrever no elemento', () => {
    expect(i18nSrc).toContain('function _hasKey(')
    // o guard precisa existir nos três pontos de escrita
    expect(i18nSrc).toContain('if (!_hasKey(key)) return')
    expect(i18nSrc).toContain('if (_hasKey(key)) el.placeholder')
    expect(i18nSrc).toContain('if (_hasKey(key)) el.title')
  })
})

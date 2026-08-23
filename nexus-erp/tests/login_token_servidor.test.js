// ============================================================
// Testes — o login precisa autenticar NO SERVIDOR e guardar o token.
//
// Regressão real: doLogin() validava a senha só no navegador (hash local) e
// nunca chamava /api/auth/login. Nenhum token era salvo, então TODA chamada
// /api/* voltava 401 — os módulos apareciam "vazios"/"sem servidor" e o botão
// "Inserir dados de simulação" falhava. Estes testes travam o contrato.
// ============================================================
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const appSrc = readFileSync(join(__dirname, '..', 'public', 'js', 'app.js'), 'utf8')
const dbSrc = readFileSync(join(__dirname, '..', 'public', 'js', 'db.js'), 'utf8')

describe('login — autenticação no servidor', () => {
  it('existe o helper que autentica no servidor', () => {
    expect(appSrc).toContain('async function _autenticarNoServidor(')
  })

  it('o helper usa DB.auth.login (rota /api/auth/login)', () => {
    const ini = appSrc.indexOf('async function _autenticarNoServidor(')
    const trecho = appSrc.slice(ini, ini + 700)
    expect(trecho).toContain('DB.auth.login')
    expect(dbSrc).toContain("_apiFetch('/api/auth/login'")
  })

  it('doLogin tenta o servidor ANTES do fluxo local', () => {
    const ini = appSrc.indexOf('async function doLogin(')
    expect(ini).toBeGreaterThan(-1)
    const corpo = appSrc.slice(ini, appSrc.indexOf('\n}', ini))
    const posServidor = corpo.indexOf('_autenticarNoServidor')
    const posLocal = corpo.indexOf('_inicializarCredenciais')
    expect(posServidor).toBeGreaterThan(-1)
    expect(posLocal).toBeGreaterThan(-1)
    expect(posServidor).toBeLessThan(posLocal) // servidor primeiro
  })

  it('doLogin entra com o perfil devolvido pelo servidor', () => {
    const ini = appSrc.indexOf('async function doLogin(')
    const corpo = appSrc.slice(ini, appSrc.indexOf('\n}', ini))
    expect(corpo).toMatch(/perfilServidor[\s\S]*loginAs\(perfilServidor/)
  })

  it('DB.auth.login persiste o token para as chamadas /api/*', () => {
    const ini = dbSrc.indexOf('async login(')
    const corpo = dbSrc.slice(ini, ini + 600)
    expect(corpo).toContain('_setToken(data.token)')
  })
})

describe('acesso rápido (quickLogin) não entra sem token', () => {
  it('exige a senha em vez de chamar loginAs direto', () => {
    const ini = appSrc.indexOf('function quickLogin(')
    const corpo = appSrc.slice(ini, appSrc.indexOf('\n}', ini))
    // não pode mais entrar direto sem autenticar
    expect(corpo).not.toMatch(/loginAs\(profile,\s*emailMap/)
    expect(corpo).toContain('doLogin()')
    expect(corpo).toMatch(/if \(!senha\)/)
  })
})

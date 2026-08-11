import { describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const guard = join(__dirname, '..', 'scripts', 'runtime_guard.js')

function run(extraEnv = {}) {
  const env = {
    ...process.env,
    NODE_ENV: '',
    SEED_PASSWORD: '',
    DB_PATH: '',
    ALLOW_EPHEMERAL_DB: '',
    ...extraEnv,
  }
  return spawnSync(process.execPath, [guard], { env, encoding: 'utf-8' })
}

describe('runtime_guard', () => {
  it('não bloqueia desenvolvimento', () => {
    const result = run({ NODE_ENV: 'development' })
    expect(result.status).toBe(0)
  })

  it('bloqueia produção sem SEED_PASSWORD', () => {
    const result = run({ NODE_ENV: 'production', DB_PATH: '/data/nexus.db' })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('SEED_PASSWORD é obrigatório')
  })

  it('bloqueia a senha padrão conhecida', () => {
    const result = run({
      NODE_ENV: 'production',
      SEED_PASSWORD: 'Fraser@2025',
      DB_PATH: '/data/nexus.db',
    })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('senha padrão conhecida')
  })

  it('bloqueia banco efêmero não autorizado', () => {
    const result = run({
      NODE_ENV: 'production',
      SEED_PASSWORD: 'SenhaSegura-2026!',
    })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('DB_PATH é obrigatório')
  })

  it('permite banco persistente configurado', () => {
    const result = run({
      NODE_ENV: 'production',
      SEED_PASSWORD: 'SenhaSegura-2026!',
      DB_PATH: '/data/nexus.db',
    })
    expect(result.status).toBe(0)
  })

  it('permite demo efêmero somente com opt-in explícito', () => {
    const result = run({
      NODE_ENV: 'production',
      SEED_PASSWORD: 'SenhaSegura-2026!',
      ALLOW_EPHEMERAL_DB: '1',
    })
    expect(result.status).toBe(0)
    expect(result.stderr).toContain('o banco pode ser perdido')
  })
})

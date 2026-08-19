import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean)

const failures = []
const warnings = []

function isEnvSecret(path) {
  const name = path.split('/').pop()
  if (name === '.env') return true
  return name?.startsWith('.env.') && name !== '.env.example'
}

const forbidden = [
  ['dependência node_modules versionada', (p) => p === 'node_modules' || p.startsWith('node_modules/') || p.includes('/node_modules/')],
  ['cache .vite versionado', (p) => p === '.vite' || p.startsWith('.vite/') || p.includes('/.vite/')],
  ['banco SQLite de runtime versionado', (p) => /\.(db|db-wal|db-shm)$/i.test(p)],
  ['arquivo de ambiente/segredo versionado', isEnvSecret],
  ['bundle gerado de código-fonte versionado', (p) => /^nexus-erp\/dist\/(NEXUS_ERP_CODIGO_FONTE\.(pdf|txt|zip)|nexus_erp_source_code\.txt)$/i.test(p)]
]

for (const path of tracked) {
  for (const [label, predicate] of forbidden) {
    if (predicate(path)) failures.push(`${label}: ${path}`)
  }
}

if (existsSync('render.yaml')) {
  const render = readFileSync('render.yaml', 'utf8')
  for (const required of ['name: horus-erp', 'healthCheckPath: /api/health', 'SEED_PASSWORD']) {
    if (!render.includes(required)) failures.push(`render.yaml sem configuração obrigatória: ${required}`)
  }
  if (!render.includes('DB_PATH') && !render.includes('ALLOW_EPHEMERAL_DB')) {
    failures.push('render.yaml sem política explícita de persistência (DB_PATH ou ALLOW_EPHEMERAL_DB)')
  }
}

if (existsSync('nexus-cf/wrangler.toml')) {
  const wrangler = readFileSync('nexus-cf/wrangler.toml', 'utf8')
  if (wrangler.includes('PREENCHER_APOS_CRIAR')) {
    warnings.push('Cloudflare Worker ainda possui database_id placeholder; não tratar nexus-cf como produção até configurar D1.')
  }
}

if (warnings.length) {
  console.warn('\nRepository Guard — avisos:')
  warnings.forEach((warning) => console.warn(`- ${warning}`))
}

if (failures.length) {
  console.error('\nRepository Guard — falhou:')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}

console.log(`Repository Guard OK — ${tracked.length} arquivos versionados verificados.`)

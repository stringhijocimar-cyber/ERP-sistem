// Guard de inicialização para produção.
// Este arquivo roda via npm prestart antes do server.js e impede dois cenários
// críticos: senha inicial insegura e banco SQLite efêmero sem opt-in explícito.

const isProduction = process.env.NODE_ENV === 'production'

if (!isProduction) {
  process.exit(0)
}

const errors = []
const seedPassword = (process.env.SEED_PASSWORD || '').trim()
const dbPath = (process.env.DB_PATH || '').trim()
const allowEphemeral = process.env.ALLOW_EPHEMERAL_DB === '1'
const forbiddenPasswords = new Set([
  'Fraser@2025',
  'admin',
  'password',
  '123456',
  '12345678',
])

if (!seedPassword) {
  errors.push('SEED_PASSWORD é obrigatório em produção.')
} else if (seedPassword.length < 12 || forbiddenPasswords.has(seedPassword)) {
  errors.push('SEED_PASSWORD deve ter pelo menos 12 caracteres e não pode usar uma senha padrão conhecida.')
}

if (!dbPath && !allowEphemeral) {
  errors.push(
    'DB_PATH é obrigatório em produção para persistência. ' +
    'Para ambiente demo efêmero, defina ALLOW_EPHEMERAL_DB=1 explicitamente.'
  )
}

if (errors.length) {
  console.error('❌ NEXUS ERP bloqueado por configuração insegura de produção:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

if (!dbPath && allowEphemeral) {
  console.warn(
    '⚠️  ALLOW_EPHEMERAL_DB=1: o banco pode ser perdido em restart/deploy. ' +
    'Use somente para demonstração, nunca para dados reais.'
  )
}

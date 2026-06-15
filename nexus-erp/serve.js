// ============================================================
// NEXUS ERP v3.0 – Servidor Estático Simples (sandbox)
// Serve os arquivos da pasta public/ na porta 3002
// ============================================================
import express from 'express'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { createReadStream, existsSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 3002

// Origens permitidas (separadas por vírgula). Sem curinga "*" por padrão.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3002,http://127.0.0.1:3002')
  .split(',').map(s => s.trim()).filter(Boolean)

const app = express()

// Cache básico + CORS restrito por origem conhecida
app.use((req, res, next) => {
  res.removeHeader('X-Powered-By')
  const origin = req.headers.origin
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }
  next()
})

// Serve arquivos estáticos da pasta public/
app.use(express.static(join(__dirname, 'public'), {
  maxAge: '1m',
  etag: true
}))

// Fallback: redireciona tudo para index.html (SPA)
app.get('*', (req, res) => {
  const indexPath = join(__dirname, 'public', 'index.html')
  if (existsSync(indexPath)) {
    res.sendFile(indexPath)
  } else {
    res.status(404).send('NEXUS ERP – index.html não encontrado')
  }
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(``)
  console.log(`  ╔══════════════════════════════════════════╗`)
  console.log(`  ║   🚀  NEXUS ERP v3.0  —  INICIADO       ║`)
  console.log(`  ║                                          ║`)
  console.log(`  ║   Porta : ${PORT}                          ║`)
  console.log(`  ║   URL   : http://0.0.0.0:${PORT}           ║`)
  console.log(`  ║                                          ║`)
  console.log(`  ║   Login : admin@fraseralexander.com.br   ║`)
  console.log(`  ║   Senha : definida via SEED_PASSWORD     ║`)
  console.log(`  ║                                          ║`)
  console.log(`  ║   Ou use os botões de Acesso Rápido      ║`)
  console.log(`  ╚══════════════════════════════════════════╝`)
  console.log(``)
})

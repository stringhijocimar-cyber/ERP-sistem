import { Hono } from 'hono'
import { cors } from 'hono/cors'

// ─── Módulos Etapas 23-33 ────────────────────────────────────
import { registerContractBillingCsRoutes } from './modules/commercial_contract_billing_customer_success'
import { registerCommercialGenerationRoutes } from './modules/commercial_generation_sales_enablement'
import { registerCrmPipelinePricingRoutes } from './modules/crm_pipeline_pricing_opportunities'
import { registerCustomerPortalRoutes } from './modules/customer_portal_self_service_deliveries'
import { registerDataPlatformIntegrationRoutes } from './modules/data_platform_public_api_integrations'
import { registerEnterpriseConsolidationRoutes } from './modules/enterprise_consolidation_final_package'
import { registerLowCodeFormBuilderRoutes } from './modules/lowcode_form_builder_custom_fields'
import { registerNotificationsRoutes } from './modules/notifications_multichannel_communication'
import { registerObservabilitySecurityRoutes } from './modules/observability_security_lgpd_hardening'
import { registerProductionReadinessRoutes } from './modules/performance_scalability_production_readiness'
import { registerWorkflowOrchestrationRoutes } from './modules/workflow_sla_approval_orchestration'

// ─── Tipagem do ambiente Cloudflare ──────────────────────────
type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

// ─── CORS para chamadas da SPA ────────────────────────────────
app.use('/api/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}))

// ─── HELPERS ─────────────────────────────────────────────────
function uid(prefix = 'id'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}
function now(): string {
  return new Date().toISOString()
}
function ok(data: unknown, meta?: unknown) {
  return { success: true, data, ...(meta ? { meta } : {}) }
}
function err(msg: string, status = 400) {
  return { success: false, error: msg, status }
}

// ─── PARSE BODY SEGURO ────────────────────────────────────────
async function body(c: any): Promise<any> {
  try { return await c.req.json() } catch { return {} }
}

// ─── AUTH SIMPLES (token no header) ──────────────────────────
// Em produção usar JWT; aqui valida token da sessão no D1
async function getUser(c: any): Promise<any> {
  const auth = c.req.header('Authorization') || ''
  const token = auth.replace('Bearer ', '').trim()
  if (!token) return null
  try {
    const row = await c.env.DB.prepare(
      `SELECT s.usuario_id, u.nome, u.email, u.perfil, u.ativo
       FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id
       WHERE s.token = ? AND s.expira_em > datetime('now') AND u.ativo = 1`
    ).bind(token).first()
    return row || null
  } catch { return null }
}

// ════════════════════════════════════════════════════════════
// AUTH
// ════════════════════════════════════════════════════════════
app.post('/api/auth/login', async (c) => {
  const { email, senha } = await body(c)
  if (!email || !senha) return c.json(err('Email e senha obrigatórios'), 400)

  const user = await c.env.DB.prepare(
    `SELECT id, nome, email, perfil, senha_hash FROM usuarios WHERE email = ? AND ativo = 1`
  ).bind(email.toLowerCase().trim()).first() as any

  if (!user) return c.json(err('Credenciais inválidas'), 401)

  // Verificação de senha – usa placeholder para dev, produção usa bcrypt via Worker
  // Em dev, aceita senha padrão "Fraser@2025" OU a senha armazenada se não for placeholder
  const senhaOk = user.senha_hash.startsWith('$2b$10$placeholder')
    ? (senha === 'Fraser@2025' || senha === 'admin')  // dev
    : user.senha_hash === senha  // prod simplificado (substituir por bcrypt)

  if (!senhaOk) return c.json(err('Credenciais inválidas'), 401)

  // Cria sessão
  const token = uid('tok')
  const expira = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString() // 8h
  await c.env.DB.prepare(
    `INSERT INTO sessoes(token, usuario_id, expira_em, ip) VALUES(?,?,?,?)`
  ).bind(token, user.id, expira, c.req.header('CF-Connecting-IP') || '').run()

  // Log
  await c.env.DB.prepare(
    `INSERT INTO logs_sistema(id, usuario_id, usuario_nome, acao, modulo, descricao) VALUES(?,?,?,?,?,?)`
  ).bind(uid('log'), user.id, user.nome, 'Login', 'auth', `Login realizado`).run()

  return c.json(ok({
    token,
    user: { id: user.id, nome: user.nome, email: user.email, perfil: user.perfil }
  }))
})

app.post('/api/auth/logout', async (c) => {
  const auth = c.req.header('Authorization') || ''
  const token = auth.replace('Bearer ', '')
  if (token) await c.env.DB.prepare(`DELETE FROM sessoes WHERE token = ?`).bind(token).run()
  return c.json(ok(null))
})

app.get('/api/auth/me', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json(err('Não autenticado'), 401)
  return c.json(ok(user))
})

// ════════════════════════════════════════════════════════════
// FORNECEDORES
// ════════════════════════════════════════════════════════════
app.get('/api/fornecedores', async (c) => {
  const ativo = c.req.query('ativo') ?? '1'
  const q = c.req.query('q') || ''
  let sql = `SELECT f.*, 
    COALESCE(ROUND(AVG(a.nota_media), 1), 0) as score_medio,
    COUNT(a.id) as total_avaliacoes
    FROM fornecedores f
    LEFT JOIN avaliacoes_fornecedor a ON a.fornecedor_id = f.id`
  const params: any[] = []
  const where: string[] = []
  if (ativo !== 'todos') { where.push('f.ativo = ?'); params.push(parseInt(ativo)) }
  if (q) { where.push(`(f.nome LIKE ? OR f.cnpj LIKE ? OR f.email LIKE ?)`); params.push(`%${q}%`, `%${q}%`, `%${q}%`) }
  if (where.length) sql += ' WHERE ' + where.join(' AND ')
  sql += ' GROUP BY f.id ORDER BY f.nome'
  const { results } = await c.env.DB.prepare(sql).bind(...params).all()
  return c.json(ok(results))
})

app.get('/api/fornecedores/:id', async (c) => {
  const row = await c.env.DB.prepare(`SELECT * FROM fornecedores WHERE id = ?`).bind(c.req.param('id')).first()
  if (!row) return c.json(err('Fornecedor não encontrado'), 404)
  const { results: avals } = await c.env.DB.prepare(
    `SELECT * FROM avaliacoes_fornecedor WHERE fornecedor_id = ? ORDER BY criado_em DESC LIMIT 10`
  ).bind(c.req.param('id')).all()
  return c.json(ok({ ...row as any, avaliacoes: avals }))
})

app.post('/api/fornecedores', async (c) => {
  const d = await body(c)
  if (!d.nome) return c.json(err('Nome é obrigatório'), 400)
  const id = uid('forn')
  const ativoVal = d.ativo !== undefined ? (d.ativo ? 1 : 0) : 1
  const statusVal = d.status || (ativoVal ? 'Ativo' : 'Em Homologação')
  await c.env.DB.prepare(
    `INSERT INTO fornecedores(
      id,nome,razao_social,cnpj,email,telefone,contato_nome,endereco,cidade,estado,categoria,ativo,
      status,prazo_pagamento,limite_credito,documentos_ok,banco,agencia,conta,tipo_conta,pix,pix_tipo
     ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(
    id, d.nome, d.razao_social||null, d.cnpj||null, d.email||null, d.telefone||null,
    d.contato_nome||null, d.endereco||null, d.cidade||null, d.estado||null, d.categoria||null,
    ativoVal, statusVal,
    d.prazo_pagamento||30, d.limite_credito||0, d.documentos_ok!==false ? 1 : 0,
    d.banco||null, d.agencia||null, d.conta||null, d.tipo_conta||'Corrente',
    d.pix||null, d.pix_tipo||'CNPJ'
  ).run()
  return c.json(ok({ id }), 201)
})

app.put('/api/fornecedores/:id', async (c) => {
  const d = await body(c)
  const id = c.req.param('id')
  const ativoVal = d.ativo !== undefined ? (d.ativo ? 1 : 0) : 1
  const statusVal = d.status || (ativoVal ? 'Ativo' : 'Inativo')
  await c.env.DB.prepare(
    `UPDATE fornecedores SET
      nome=?,razao_social=?,cnpj=?,email=?,telefone=?,contato_nome=?,
      endereco=?,cidade=?,estado=?,categoria=?,ativo=?,status=?,
      prazo_pagamento=?,limite_credito=?,documentos_ok=?,
      banco=?,agencia=?,conta=?,tipo_conta=?,pix=?,pix_tipo=?,
      atualizado_em=?
     WHERE id=?`
  ).bind(
    d.nome, d.razao_social||null, d.cnpj||null, d.email||null, d.telefone||null,
    d.contato_nome||null, d.endereco||null, d.cidade||null, d.estado||null,
    d.categoria||null, ativoVal, statusVal,
    d.prazo_pagamento||30, d.limite_credito||0, d.documentos_ok!==false ? 1 : 0,
    d.banco||null, d.agencia||null, d.conta||null, d.tipo_conta||'Corrente',
    d.pix||null, d.pix_tipo||'CNPJ',
    now(), id
  ).run()
  return c.json(ok({ id }))
})

// Endpoint dedicado para sincronizar score IDF de um fornecedor
app.patch('/api/fornecedores/:id/idf', async (c) => {
  const d = await body(c)
  const id = c.req.param('id')
  await c.env.DB.prepare(
    `UPDATE fornecedores SET score_idf=?,idf_classificacao=?,idf_avaliado_em=?,atualizado_em=? WHERE id=?`
  ).bind(d.score||0, d.classificacao||null, d.avaliado_em||now(), now(), id).run()
  return c.json(ok({ id }))
})

// ─── AVALIAÇÕES ───────────────────────────────────────────────
app.post('/api/fornecedores/:id/avaliacoes', async (c) => {
  const d = await body(c)
  const forn_id = c.req.param('id')
  const forn = await c.env.DB.prepare(`SELECT nome FROM fornecedores WHERE id=?`).bind(forn_id).first() as any
  if (!forn) return c.json(err('Fornecedor não encontrado'), 404)
  const media = ((d.nota_qualidade||0)+(d.nota_prazo||0)+(d.nota_preco||0)+(d.nota_atendimento||0)) / 4
  const id = uid('aval')
  await c.env.DB.prepare(
    `INSERT INTO avaliacoes_fornecedor(id,fornecedor_id,fornecedor_nome,pedido_id,pedido_numero,
     nota_qualidade,nota_prazo,nota_preco,nota_atendimento,nota_media,comentario,avaliado_por)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(id, forn_id, forn.nome, d.pedido_id||null, d.pedido_numero||null,
    d.nota_qualidade||0, d.nota_prazo||0, d.nota_preco||0, d.nota_atendimento||0,
    parseFloat(media.toFixed(1)), d.comentario||null, d.avaliado_por||null).run()
  // Atualiza score médio no fornecedor
  await c.env.DB.prepare(
    `UPDATE fornecedores SET score_medio=(SELECT ROUND(AVG(nota_media),1) FROM avaliacoes_fornecedor WHERE fornecedor_id=?),
     total_avaliacoes=(SELECT COUNT(*) FROM avaliacoes_fornecedor WHERE fornecedor_id=?),
     atualizado_em=? WHERE id=?`
  ).bind(forn_id, forn_id, now(), forn_id).run()
  return c.json(ok({ id, media: parseFloat(media.toFixed(1)) }), 201)
})

// ════════════════════════════════════════════════════════════
// ORDENS DE SERVIÇO
// ════════════════════════════════════════════════════════════
app.get('/api/os', async (c) => {
  const status = c.req.query('status') || ''
  const q = c.req.query('q') || ''
  let sql = `SELECT o.*, 
    (SELECT COUNT(*) FROM os_itens WHERE os_id=o.id) as total_itens,
    (SELECT COUNT(*) FROM requisicoes_compra WHERE os_id=o.id) as total_rcs
    FROM ordens_servico o`
  const params: any[] = []
  const where: string[] = []
  if (status) { where.push('o.status = ?'); params.push(status) }
  if (q) { where.push(`(o.numero LIKE ? OR o.titulo LIKE ? OR o.solicitante LIKE ?)`); params.push(`%${q}%`,`%${q}%`,`%${q}%`) }
  if (where.length) sql += ' WHERE ' + where.join(' AND ')
  sql += ' ORDER BY o.criado_em DESC'
  const { results } = await c.env.DB.prepare(sql).bind(...params).all()
  return c.json(ok(results))
})

app.get('/api/os/:id', async (c) => {
  const id = c.req.param('id')
  const os = await c.env.DB.prepare(`SELECT * FROM ordens_servico WHERE id=?`).bind(id).first()
  if (!os) return c.json(err('OS não encontrada'), 404)
  const { results: itens } = await c.env.DB.prepare(`SELECT * FROM os_itens WHERE os_id=? ORDER BY rowid`).bind(id).all()
  const { results: hist } = await c.env.DB.prepare(`SELECT * FROM os_historico WHERE os_id=? ORDER BY data DESC`).bind(id).all()
  const fluxo = await c.env.DB.prepare(
    `SELECT f.*, 
      (SELECT json_group_array(json_object('estagio',e.estagio,'nome',e.nome,'status',e.status,'aprovador',e.aprovador,'data',e.data,'observacao',e.observacao))
       FROM aprovacao_estagios e WHERE e.fluxo_id=f.id ORDER BY e.estagio) as estagios_json
     FROM fluxo_aprovacao_os f WHERE f.os_id=?`
  ).bind(id).first() as any
  let fluxoData = fluxo ? { ...fluxo, estagios: JSON.parse(fluxo.estagios_json || '[]') } : null
  return c.json(ok({ ...(os as any), itens, historico: hist, fluxo: fluxoData }))
})

app.post('/api/os', async (c) => {
  const d = await body(c)
  if (!d.titulo) return c.json(err('Título obrigatório'), 400)
  const id = uid('os')
  const ano = new Date().getFullYear()
  const count = await c.env.DB.prepare(`SELECT COUNT(*) as n FROM ordens_servico WHERE numero LIKE ?`).bind(`OS-${ano}-%`).first() as any
  const numero = `OS-${ano}-${String((count?.n || 0) + 1).padStart(4, '0')}`
  await c.env.DB.prepare(
    `INSERT INTO ordens_servico(id,numero,titulo,descricao,solicitante,solicitante_id,tipo,prioridade,status,local,equipamento,data_prazo,responsavel,observacoes,requer_compra)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(id, numero, d.titulo, d.descricao||null, d.solicitante||null, d.solicitante_id||null,
    d.tipo||'Manutenção', d.prioridade||'Normal', d.status||'Aberta',
    d.local||null, d.equipamento||null, d.data_prazo||null, d.responsavel||null,
    d.observacoes||null, d.requer_compra?1:0).run()
  // Itens
  if (d.itens?.length) {
    const stmt = c.env.DB.prepare(`INSERT INTO os_itens(id,os_id,descricao,qtd,unidade,observacao) VALUES(?,?,?,?,?,?)`)
    for (const it of d.itens) await stmt.bind(uid('osi'), id, it.descricao, it.qtd||1, it.unidade||'Un', it.observacao||null).run()
  }
  // Histórico
  await c.env.DB.prepare(`INSERT INTO os_historico(id,os_id,acao,usuario) VALUES(?,?,?,?)`).bind(uid('osh'), id, `OS ${numero} criada`, d.solicitante||'Sistema').run()
  return c.json(ok({ id, numero }), 201)
})

app.put('/api/os/:id', async (c) => {
  const id = c.req.param('id')
  const d = await body(c)
  const user = await getUser(c)
  await c.env.DB.prepare(
    `UPDATE ordens_servico SET titulo=?,descricao=?,tipo=?,prioridade=?,status=?,local=?,equipamento=?,
     data_prazo=?,responsavel=?,observacoes=?,requer_compra=?,atualizado_em=? WHERE id=?`
  ).bind(d.titulo, d.descricao||null, d.tipo||'Manutenção', d.prioridade||'Normal', d.status,
    d.local||null, d.equipamento||null, d.data_prazo||null, d.responsavel||null,
    d.observacoes||null, d.requer_compra?1:0, now(), id).run()
  await c.env.DB.prepare(`INSERT INTO os_historico(id,os_id,acao,usuario) VALUES(?,?,?,?)`)
    .bind(uid('osh'), id, `OS atualizada – status: ${d.status}`, user?.nome||'Sistema').run()
  return c.json(ok({ id }))
})

// ─── FLUXO DE APROVAÇÃO DA OS ─────────────────────────────────
app.post('/api/os/:id/iniciar-fluxo', async (c) => {
  const os_id = c.req.param('id')
  const os = await c.env.DB.prepare(`SELECT * FROM ordens_servico WHERE id=?`).bind(os_id).first() as any
  if (!os) return c.json(err('OS não encontrada'), 404)
  const existente = await c.env.DB.prepare(`SELECT id FROM fluxo_aprovacao_os WHERE os_id=?`).bind(os_id).first()
  if (existente) return c.json(err('Fluxo já iniciado para esta OS'), 409)
  const fid = uid('flx')
  await c.env.DB.prepare(
    `INSERT INTO fluxo_aprovacao_os(id,os_id,os_numero,os_descricao,status,estagio_atual) VALUES(?,?,?,?,?,?)`
  ).bind(fid, os_id, os.numero, os.titulo, 'Aguardando Aprovação', 1).run()
  // Cria estágios padrão
  const cfgRow = await c.env.DB.prepare(`SELECT dados_json FROM config_aprovacao WHERE id='default'`).first() as any
  const cfg = JSON.parse(cfgRow?.dados_json || '{}')
  const estagios = cfg.estagios || [
    { estagio: 1, nome: 'Supervisor' },
    { estagio: 2, nome: 'Compras' },
    { estagio: 3, nome: 'Diretor' }
  ]
  for (const e of estagios) {
    await c.env.DB.prepare(`INSERT INTO aprovacao_estagios(id,fluxo_id,estagio,nome,status) VALUES(?,?,?,?,?)`)
      .bind(uid('est'), fid, e.estagio, e.nome, 'Aguardando').run()
  }
  await c.env.DB.prepare(`UPDATE ordens_servico SET status='Em Aprovação',atualizado_em=? WHERE id=?`).bind(now(), os_id).run()
  await c.env.DB.prepare(`INSERT INTO os_historico(id,os_id,acao,usuario) VALUES(?,?,?,?)`)
    .bind(uid('osh'), os_id, 'Fluxo de aprovação iniciado', 'Sistema').run()
  return c.json(ok({ fluxo_id: fid }), 201)
})

app.post('/api/fluxo/:id/aprovar', async (c) => {
  const fluxo_id = c.req.param('id')
  const d = await body(c)
  const user = await getUser(c)
  const userName = user?.nome || d.aprovador || 'Aprovador'
  const fluxo = await c.env.DB.prepare(`SELECT * FROM fluxo_aprovacao_os WHERE id=?`).bind(fluxo_id).first() as any
  if (!fluxo) return c.json(err('Fluxo não encontrado'), 404)
  const estagio = await c.env.DB.prepare(
    `SELECT * FROM aprovacao_estagios WHERE fluxo_id=? AND estagio=?`
  ).bind(fluxo_id, fluxo.estagio_atual).first() as any
  if (!estagio) return c.json(err('Estágio não encontrado'), 404)
  // Aprova estágio atual
  await c.env.DB.prepare(
    `UPDATE aprovacao_estagios SET status='Aprovado',aprovador=?,data=?,observacao=? WHERE id=?`
  ).bind(userName, now(), d.observacao||null, estagio.id).run()
  // Verifica se há próximo estágio
  const proximo = await c.env.DB.prepare(
    `SELECT * FROM aprovacao_estagios WHERE fluxo_id=? AND estagio=?`
  ).bind(fluxo_id, fluxo.estagio_atual + 1).first()
  if (proximo) {
    await c.env.DB.prepare(`UPDATE fluxo_aprovacao_os SET estagio_atual=?,atualizado_em=? WHERE id=?`)
      .bind(fluxo.estagio_atual + 1, now(), fluxo_id).run()
  } else {
    // Todos aprovados
    await c.env.DB.prepare(`UPDATE fluxo_aprovacao_os SET status='Aprovado',atualizado_em=? WHERE id=?`)
      .bind(now(), fluxo_id).run()
    await c.env.DB.prepare(`UPDATE ordens_servico SET status='Aprovada',atualizado_em=? WHERE id=?`)
      .bind(now(), fluxo.os_id).run()
    await c.env.DB.prepare(`INSERT INTO os_historico(id,os_id,acao,usuario) VALUES(?,?,?,?)`)
      .bind(uid('osh'), fluxo.os_id, `OS aprovada por ${userName} – estágio ${fluxo.estagio_atual}`, userName).run()
  }
  return c.json(ok({ aprovado: true, estagio_atual: fluxo.estagio_atual + (proximo ? 1 : 0) }))
})

app.post('/api/fluxo/:id/reprovar', async (c) => {
  const fluxo_id = c.req.param('id')
  const d = await body(c)
  const user = await getUser(c)
  const userName = user?.nome || d.aprovador || 'Revisor'
  const fluxo = await c.env.DB.prepare(`SELECT * FROM fluxo_aprovacao_os WHERE id=?`).bind(fluxo_id).first() as any
  if (!fluxo) return c.json(err('Fluxo não encontrado'), 404)
  await c.env.DB.prepare(
    `UPDATE aprovacao_estagios SET status='Reprovado',aprovador=?,data=?,observacao=? WHERE fluxo_id=? AND estagio=?`
  ).bind(userName, now(), d.motivo||null, fluxo_id, fluxo.estagio_atual).run()
  await c.env.DB.prepare(`UPDATE fluxo_aprovacao_os SET status='Reprovado',atualizado_em=? WHERE id=?`)
    .bind(now(), fluxo_id).run()
  await c.env.DB.prepare(`UPDATE ordens_servico SET status='Reprovada',atualizado_em=? WHERE id=?`)
    .bind(now(), fluxo.os_id).run()
  await c.env.DB.prepare(`INSERT INTO os_historico(id,os_id,acao,usuario) VALUES(?,?,?,?)`)
    .bind(uid('osh'), fluxo.os_id, `OS reprovada por ${userName} – ${d.motivo||'sem motivo'}`, userName).run()
  return c.json(ok({ reprovado: true }))
})

app.get('/api/fluxo', async (c) => {
  const status = c.req.query('status') || ''
  let sql = `SELECT f.*,
    (SELECT json_group_array(json_object('estagio',e.estagio,'nome',e.nome,'status',e.status,'aprovador',e.aprovador,'data',e.data))
     FROM aprovacao_estagios e WHERE e.fluxo_id=f.id ORDER BY e.estagio) as estagios_json,
    o.titulo as os_titulo, o.solicitante, o.prioridade, o.requer_compra, o.criado_em as os_data
    FROM fluxo_aprovacao_os f JOIN ordens_servico o ON o.id=f.os_id`
  const params: any[] = []
  if (status) { sql += ' WHERE f.status=?'; params.push(status) }
  sql += ' ORDER BY f.criado_em DESC'
  const { results } = await c.env.DB.prepare(sql).bind(...params).all()
  return c.json(ok(results.map((r: any) => ({ ...r, estagios: JSON.parse(r.estagios_json || '[]') }))))
})

// ════════════════════════════════════════════════════════════
// REQUISIÇÕES DE COMPRA (RC)
// ════════════════════════════════════════════════════════════
app.get('/api/rc', async (c) => {
  const status = c.req.query('status') || ''
  const q = c.req.query('q') || ''
  let sql = `SELECT r.*, 
    (SELECT COUNT(*) FROM rc_itens WHERE rc_id=r.id) as total_itens,
    (SELECT COALESCE(SUM(total),0) FROM rc_itens WHERE rc_id=r.id) as valor_calculado
    FROM requisicoes_compra r`
  const params: any[] = []
  const where: string[] = []
  if (status) { where.push('r.status=?'); params.push(status) }
  if (q) { where.push(`(r.numero LIKE ? OR r.titulo LIKE ? OR r.solicitante LIKE ?)`); params.push(`%${q}%`,`%${q}%`,`%${q}%`) }
  if (where.length) sql += ' WHERE ' + where.join(' AND ')
  sql += ' ORDER BY r.criado_em DESC'
  const { results } = await c.env.DB.prepare(sql).bind(...params).all()
  return c.json(ok(results))
})

app.get('/api/rc/:id', async (c) => {
  const id = c.req.param('id')
  const rc = await c.env.DB.prepare(`SELECT * FROM requisicoes_compra WHERE id=?`).bind(id).first()
  if (!rc) return c.json(err('RC não encontrada'), 404)
  const { results: itens } = await c.env.DB.prepare(`SELECT * FROM rc_itens WHERE rc_id=? ORDER BY rowid`).bind(id).all()
  const { results: hist } = await c.env.DB.prepare(`SELECT * FROM rc_historico WHERE rc_id=? ORDER BY data DESC`).bind(id).all()
  return c.json(ok({ ...(rc as any), itens, historico: hist }))
})

app.post('/api/rc', async (c) => {
  const d = await body(c)
  const user = await getUser(c)
  if (!d.titulo) return c.json(err('Título obrigatório'), 400)
  const id = uid('rc')
  const ano = new Date().getFullYear()
  const count = await c.env.DB.prepare(`SELECT COUNT(*) as n FROM requisicoes_compra WHERE numero LIKE ?`).bind(`RC-${ano}-%`).first() as any
  const numero = `RC-${ano}-${String((count?.n || 0) + 1).padStart(4, '0')}`
  await c.env.DB.prepare(
    `INSERT INTO requisicoes_compra(id,numero,titulo,descricao,solicitante,solicitante_id,os_id,os_numero,fluxo_id,status,prioridade,data_necessidade,observacoes)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(id, numero, d.titulo, d.descricao||null, user?.nome||d.solicitante||null, user?.usuario_id||null,
    d.os_id||null, d.os_numero||null, d.fluxo_id||null, d.status||'Rascunho',
    d.prioridade||'Normal', d.data_necessidade||null, d.observacoes||null).run()
  // Itens
  let valorTotal = 0
  if (d.itens?.length) {
    const stmt = c.env.DB.prepare(`INSERT INTO rc_itens(id,rc_id,descricao,qtd,unidade,preco_unit,total) VALUES(?,?,?,?,?,?,?)`)
    for (const it of d.itens) {
      const total = (it.qtd||1) * (it.preco_unit||0)
      valorTotal += total
      await stmt.bind(uid('rci'), id, it.descricao, it.qtd||1, it.unidade||'Un', it.preco_unit||0, total).run()
    }
    await c.env.DB.prepare(`UPDATE requisicoes_compra SET valor_total=? WHERE id=?`).bind(valorTotal, id).run()
  }
  await c.env.DB.prepare(`INSERT INTO rc_historico(id,rc_id,acao,usuario) VALUES(?,?,?,?)`)
    .bind(uid('rch'), id, `RC ${numero} criada`, user?.nome||'Sistema').run()
  return c.json(ok({ id, numero }), 201)
})

app.put('/api/rc/:id', async (c) => {
  const id = c.req.param('id')
  const d = await body(c)
  const user = await getUser(c)
  await c.env.DB.prepare(
    `UPDATE requisicoes_compra SET titulo=?,descricao=?,status=?,prioridade=?,data_necessidade=?,observacoes=?,atualizado_em=? WHERE id=?`
  ).bind(d.titulo, d.descricao||null, d.status, d.prioridade||'Normal', d.data_necessidade||null, d.observacoes||null, now(), id).run()
  if (d.itens) {
    await c.env.DB.prepare(`DELETE FROM rc_itens WHERE rc_id=?`).bind(id).run()
    let valorTotal = 0
    const stmt = c.env.DB.prepare(`INSERT INTO rc_itens(id,rc_id,descricao,qtd,unidade,preco_unit,total) VALUES(?,?,?,?,?,?,?)`)
    for (const it of d.itens) {
      const total = (it.qtd||1) * (it.preco_unit||0)
      valorTotal += total
      await stmt.bind(uid('rci'), id, it.descricao, it.qtd||1, it.unidade||'Un', it.preco_unit||0, total).run()
    }
    await c.env.DB.prepare(`UPDATE requisicoes_compra SET valor_total=?,atualizado_em=? WHERE id=?`).bind(valorTotal, now(), id).run()
  }
  await c.env.DB.prepare(`INSERT INTO rc_historico(id,rc_id,acao,usuario) VALUES(?,?,?,?)`)
    .bind(uid('rch'), id, `RC atualizada – status: ${d.status}`, user?.nome||'Sistema').run()
  return c.json(ok({ id }))
})

// ════════════════════════════════════════════════════════════
// RFQ – REQUEST FOR QUOTATION
// ════════════════════════════════════════════════════════════
app.get('/api/rfq', async (c) => {
  const status = c.req.query('status') || ''
  let sql = `SELECT r.*,
    (SELECT COUNT(*) FROM rfq_fornecedores WHERE rfq_id=r.id) as total_fornecedores,
    (SELECT COUNT(*) FROM cotacoes WHERE rfq_id=r.id) as total_cotacoes
    FROM rfq r`
  const params: any[] = []
  if (status) { sql += ' WHERE r.status=?'; params.push(status) }
  sql += ' ORDER BY r.criado_em DESC'
  const { results } = await c.env.DB.prepare(sql).bind(...params).all()
  return c.json(ok(results))
})

app.get('/api/rfq/:id', async (c) => {
  const id = c.req.param('id')
  const rfq = await c.env.DB.prepare(`SELECT * FROM rfq WHERE id=?`).bind(id).first()
  if (!rfq) return c.json(err('RFQ não encontrada'), 404)
  const { results: itens } = await c.env.DB.prepare(`SELECT * FROM rfq_itens WHERE rfq_id=? ORDER BY rowid`).bind(id).all()
  const { results: fornecedores } = await c.env.DB.prepare(
    `SELECT rf.*, f.email as forn_email_cadastro, f.cnpj, f.score_medio
     FROM rfq_fornecedores rf LEFT JOIN fornecedores f ON f.id=rf.fornecedor_id
     WHERE rf.rfq_id=?`
  ).bind(id).all()
  const { results: cotacoes } = await c.env.DB.prepare(
    `SELECT c.*, json_group_array(json_object('descricao',ci.descricao,'qtd',ci.qtd,'unidade',ci.unidade,'preco_unit',ci.preco_unit,'total',ci.total)) as itens_json
     FROM cotacoes c LEFT JOIN cotacao_itens ci ON ci.cotacao_id=c.id
     WHERE c.rfq_id=? GROUP BY c.id`
  ).bind(id).all()
  return c.json(ok({
    ...(rfq as any), itens, fornecedores,
    cotacoes: cotacoes.map((co: any) => ({ ...co, itens: JSON.parse(co.itens_json || '[]') }))
  }))
})

app.post('/api/rfq', async (c) => {
  const d = await body(c)
  const user = await getUser(c)
  if (!d.titulo) return c.json(err('Título obrigatório'), 400)
  const id = uid('rfq')
  const ano = new Date().getFullYear()
  const count = await c.env.DB.prepare(`SELECT COUNT(*) as n FROM rfq WHERE numero LIKE ?`).bind(`RFQ-${ano}-%`).first() as any
  const numero = `RFQ-${ano}-${String((count?.n || 0) + 1).padStart(4, '0')}`
  await c.env.DB.prepare(
    `INSERT INTO rfq(id,numero,titulo,rc_id,rc_numero,os_id,status,data_limite,observacoes,criado_por,criado_por_id)
     VALUES(?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(id, numero, d.titulo, d.rc_id||null, d.rc_numero||null, d.os_id||null,
    d.status||'Rascunho', d.data_limite||null, d.observacoes||null, user?.nome||null, user?.usuario_id||null).run()
  // Itens
  if (d.itens?.length) {
    const stmt = c.env.DB.prepare(`INSERT INTO rfq_itens(id,rfq_id,descricao,qtd,unidade,especificacao) VALUES(?,?,?,?,?,?)`)
    for (const it of d.itens) await stmt.bind(uid('rfqi'), id, it.descricao, it.qtd||1, it.unidade||'Un', it.especificacao||null).run()
  }
  // Fornecedores
  if (d.fornecedores?.length) {
    const stmt = c.env.DB.prepare(`INSERT INTO rfq_fornecedores(id,rfq_id,fornecedor_id,fornecedor_nome,email,status_resposta) VALUES(?,?,?,?,?,?)`)
    for (const f of d.fornecedores) await stmt.bind(uid('rfqf'), id, f.id||null, f.nome||f.fornecedor_nome, f.email||null, 'Aguardando').run()
  }
  return c.json(ok({ id, numero }), 201)
})

app.put('/api/rfq/:id', async (c) => {
  const id = c.req.param('id')
  const d = await body(c)
  await c.env.DB.prepare(
    `UPDATE rfq SET titulo=?,status=?,data_limite=?,data_envio=?,observacoes=?,atualizado_em=? WHERE id=?`
  ).bind(d.titulo, d.status, d.data_limite||null, d.data_envio||null, d.observacoes||null, now(), id).run()
  return c.json(ok({ id }))
})

// ─── COTAÇÕES ────────────────────────────────────────────────
app.post('/api/rfq/:id/cotacoes', async (c) => {
  const rfq_id = c.req.param('id')
  const d = await body(c)
  if (!d.fornecedor_nome) return c.json(err('Fornecedor obrigatório'), 400)
  const cid = uid('cot')
  await c.env.DB.prepare(
    `INSERT INTO cotacoes(id,rfq_id,fornecedor_id,fornecedor_nome,valor_total,prazo_entrega,condicao_pag,validade,observacoes)
     VALUES(?,?,?,?,?,?,?,?,?)`
  ).bind(cid, rfq_id, d.fornecedor_id||null, d.fornecedor_nome, d.valor_total||0,
    d.prazo_entrega||null, d.condicao_pag||null, d.validade||null, d.observacoes||null).run()
  if (d.itens?.length) {
    const stmt = c.env.DB.prepare(`INSERT INTO cotacao_itens(id,cotacao_id,rfq_item_id,descricao,qtd,unidade,preco_unit,total) VALUES(?,?,?,?,?,?,?,?)`)
    for (const it of d.itens) await stmt.bind(uid('coti'), cid, it.rfq_item_id||null, it.descricao||'', it.qtd||1, it.unidade||'Un', it.preco_unit||0, it.total||(it.qtd||1)*(it.preco_unit||0)).run()
  }
  // Atualiza status do rfq_fornecedor
  await c.env.DB.prepare(
    `UPDATE rfq_fornecedores SET status_resposta='Respondido',respondido_em=? WHERE rfq_id=? AND fornecedor_nome=?`
  ).bind(now(), rfq_id, d.fornecedor_nome).run()
  return c.json(ok({ id: cid }), 201)
})

// ════════════════════════════════════════════════════════════
// MAPAS COMPARATIVOS
// ════════════════════════════════════════════════════════════
app.get('/api/mapas', async (c) => {
  const status = c.req.query('status') || ''
  let sql = `SELECT m.*,
    f.score_medio, f.total_avaliacoes
    FROM mapas_comparativos m
    LEFT JOIN fornecedores f ON f.id=m.fornecedor_id`
  const params: any[] = []
  if (status) { sql += ' WHERE m.status=?'; params.push(status) }
  sql += ' ORDER BY m.criado_em DESC'
  const { results } = await c.env.DB.prepare(sql).bind(...params).all()
  return c.json(ok(results))
})

app.get('/api/mapas/:id', async (c) => {
  const id = c.req.param('id')
  const mapa = await c.env.DB.prepare(
    `SELECT m.*, f.score_medio, f.total_avaliacoes, f.cnpj as forn_cnpj, f.email as forn_email, f.contato_nome as forn_contato
     FROM mapas_comparativos m LEFT JOIN fornecedores f ON f.id=m.fornecedor_id WHERE m.id=?`
  ).bind(id).first()
  if (!mapa) return c.json(err('Mapa não encontrado'), 404)
  // Cotações do RFQ vinculado
  const rfqId = (mapa as any).rfq_id
  let cotacoes: any[] = []
  if (rfqId) {
    const { results: cots } = await c.env.DB.prepare(
      `SELECT c.*, f.score_medio, f.total_avaliacoes,
       json_group_array(json_object('descricao',ci.descricao,'qtd',ci.qtd,'preco_unit',ci.preco_unit,'total',ci.total)) as itens_json
       FROM cotacoes c
       LEFT JOIN fornecedores f ON f.nome=c.fornecedor_nome
       LEFT JOIN cotacao_itens ci ON ci.cotacao_id=c.id
       WHERE c.rfq_id=? GROUP BY c.id ORDER BY c.valor_total`
    ).bind(rfqId).all()
    cotacoes = cots.map((co: any) => ({ ...co, itens: JSON.parse(co.itens_json || '[]') }))
  }
  const { results: hist } = await c.env.DB.prepare(`SELECT * FROM mapa_historico WHERE mapa_id=? ORDER BY data DESC`).bind(id).all()
  return c.json(ok({ ...(mapa as any), cotacoes, historico: hist }))
})

app.post('/api/mapas', async (c) => {
  const d = await body(c)
  const user = await getUser(c)
  const id = uid('map')
  const ano = new Date().getFullYear()
  const count = await c.env.DB.prepare(`SELECT COUNT(*) as n FROM mapas_comparativos WHERE numero LIKE ?`).bind(`MAP-${ano}-%`).first() as any
  const numero = `MAP-${ano}-${String((count?.n || 0) + 1).padStart(4, '0')}`
  // Identifica fornecedor no banco pelo nome
  let fornecedor_id = d.fornecedor_id || null
  if (!fornecedor_id && d.fornecedor_selecionado) {
    const f = await c.env.DB.prepare(`SELECT id FROM fornecedores WHERE nome=? OR razao_social=?`)
      .bind(d.fornecedor_selecionado, d.fornecedor_selecionado).first() as any
    if (f) fornecedor_id = f.id
  }
  await c.env.DB.prepare(
    `INSERT INTO mapas_comparativos(id,numero,rfq_id,rfq_numero,rc_id,rc_numero,os_id,titulo,status,
     fornecedor_selecionado,fornecedor_id,criterio,valor_total,score_ia,justificativa,criado_por,criado_por_id)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(id, numero, d.rfq_id||null, d.rfq_numero||null, d.rc_id||null, d.rc_numero||null, d.os_id||null,
    d.titulo||`Mapa – ${d.rfq_numero||d.rc_numero||''}`, d.status||'Em Análise',
    d.fornecedor_selecionado||null, fornecedor_id, d.criterio||'Menor Preço',
    d.valor_total||0, d.score_ia||null, d.justificativa||null, user?.nome||null, user?.usuario_id||null).run()
  await c.env.DB.prepare(`INSERT INTO mapa_historico(id,mapa_id,acao,usuario) VALUES(?,?,?,?)`)
    .bind(uid('mph'), id, `Mapa ${numero} criado`, user?.nome||'Sistema').run()
  return c.json(ok({ id, numero }), 201)
})

app.post('/api/mapas/:id/aprovar', async (c) => {
  const id = c.req.param('id')
  const d = await body(c)
  const user = await getUser(c)
  const userName = user?.nome || d.aprovador || 'Aprovador'
  await c.env.DB.prepare(
    `UPDATE mapas_comparativos SET status='Aprovado',aprovado_por=?,aprovado_por_id=?,aprovado_em=?,atualizado_em=? WHERE id=?`
  ).bind(userName, user?.usuario_id||null, now(), now(), id).run()
  await c.env.DB.prepare(`INSERT INTO mapa_historico(id,mapa_id,acao,usuario) VALUES(?,?,?,?)`)
    .bind(uid('mph'), id, `Mapa aprovado por ${userName}${d.observacao?' – '+d.observacao:''}`, userName).run()
  return c.json(ok({ aprovado: true }))
})

app.post('/api/mapas/:id/reprovar', async (c) => {
  const id = c.req.param('id')
  const d = await body(c)
  const user = await getUser(c)
  const userName = user?.nome || 'Revisor'
  await c.env.DB.prepare(
    `UPDATE mapas_comparativos SET status='Reprovado',reprovado_por=?,motivo_reprovacao=?,atualizado_em=? WHERE id=?`
  ).bind(userName, d.motivo||null, now(), id).run()
  await c.env.DB.prepare(`INSERT INTO mapa_historico(id,mapa_id,acao,usuario) VALUES(?,?,?,?)`)
    .bind(uid('mph'), id, `Mapa reprovado – ${d.motivo||'sem motivo'}`, userName).run()
  return c.json(ok({ reprovado: true }))
})

// ════════════════════════════════════════════════════════════
// PEDIDOS DE COMPRA
// ════════════════════════════════════════════════════════════
app.get('/api/pedidos', async (c) => {
  const status = c.req.query('status') || ''
  const q = c.req.query('q') || ''
  let sql = `SELECT p.*, f.score_medio, f.total_avaliacoes, f.email as forn_email, f.cnpj as forn_cnpj,
    (SELECT COUNT(*) FROM pc_itens WHERE pc_id=p.id) as total_itens
    FROM pedidos_compra p LEFT JOIN fornecedores f ON f.id=p.fornecedor_id`
  const params: any[] = []
  const where: string[] = []
  if (status) { where.push('p.status=?'); params.push(status) }
  if (q) { where.push(`(p.numero LIKE ? OR p.fornecedor LIKE ? OR p.mapa_numero LIKE ? OR p.rc_numero LIKE ?)`); params.push(`%${q}%`,`%${q}%`,`%${q}%`,`%${q}%`) }
  if (where.length) sql += ' WHERE ' + where.join(' AND ')
  sql += ' ORDER BY p.data_emissao DESC'
  const { results } = await c.env.DB.prepare(sql).bind(...params).all()
  // Attach itens
  const pedidosComItens = await Promise.all(results.map(async (p: any) => {
    const { results: itens } = await c.env.DB.prepare(`SELECT * FROM pc_itens WHERE pc_id=? ORDER BY rowid`).bind(p.id).all()
    return { ...p, itens }
  }))
  return c.json(ok(pedidosComItens))
})

app.get('/api/pedidos/:id', async (c) => {
  const id = c.req.param('id')
  const p = await c.env.DB.prepare(
    `SELECT p.*, f.score_medio, f.total_avaliacoes, f.email as forn_email, f.cnpj as forn_cnpj
     FROM pedidos_compra p LEFT JOIN fornecedores f ON f.id=p.fornecedor_id WHERE p.id=?`
  ).bind(id).first()
  if (!p) return c.json(err('Pedido não encontrado'), 404)
  const { results: itens } = await c.env.DB.prepare(`SELECT * FROM pc_itens WHERE pc_id=? ORDER BY rowid`).bind(id).all()
  const { results: hist } = await c.env.DB.prepare(`SELECT * FROM pc_historico WHERE pc_id=? ORDER BY data DESC`).bind(id).all()
  const { results: envioLog } = await c.env.DB.prepare(`SELECT * FROM pc_envio_log WHERE pc_id=? ORDER BY data DESC`).bind(id).all()
  return c.json(ok({ ...(p as any), itens, historico: hist, envio_log: envioLog }))
})

app.post('/api/pedidos', async (c) => {
  const d = await body(c)
  const user = await getUser(c)
  if (!d.fornecedor) return c.json(err('Fornecedor obrigatório'), 400)
  const id = uid('pc')
  const ano = new Date().getFullYear()
  const count = await c.env.DB.prepare(`SELECT COUNT(*) as n FROM pedidos_compra WHERE numero LIKE ?`).bind(`PC-${ano}-%`).first() as any
  const numero = `PC-${ano}-${String((count?.n || 0) + 1).padStart(4, '0')}`
  // Identifica fornecedor_id
  let fornecedor_id = d.fornecedor_id || null
  if (!fornecedor_id && d.fornecedor) {
    const f = await c.env.DB.prepare(`SELECT id FROM fornecedores WHERE nome=? OR razao_social=?`)
      .bind(d.fornecedor, d.fornecedor).first() as any
    if (f) fornecedor_id = f.id
  }
  await c.env.DB.prepare(
    `INSERT INTO pedidos_compra(id,numero,fornecedor_id,fornecedor,mapa_id,mapa_numero,rfq_id,rfq_numero,rc_id,rc_numero,os_id,
     valor_total,condicao_pagamento,prazo_entrega,local_entrega,observacoes,status,emitido_por,emitido_por_id)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(id, numero, fornecedor_id, d.fornecedor, d.mapa_id||null, d.mapa_numero||null,
    d.rfq_id||null, d.rfq_numero||null, d.rc_id||null, d.rc_numero||null, d.os_id||null,
    d.valor_total||0, d.condicao_pagamento||null, d.prazo_entrega||null,
    d.local_entrega||null, d.observacoes||null, 'Emitido', user?.nome||d.emitido_por||null, user?.usuario_id||null).run()
  // Itens
  if (d.itens?.length) {
    const stmt = c.env.DB.prepare(`INSERT INTO pc_itens(id,pc_id,descricao,qtd,unidade,preco_unit,total) VALUES(?,?,?,?,?,?,?)`)
    for (const it of d.itens) await stmt.bind(uid('pci'), id, it.descricao, it.qtd||1, it.unidade||'Un', it.preco_unit||0, it.total||(it.qtd||1)*(it.preco_unit||0)).run()
  }
  // Histórico inicial
  await c.env.DB.prepare(`INSERT INTO pc_historico(id,pc_id,acao,usuario) VALUES(?,?,?,?)`)
    .bind(uid('pch'), id, `Pedido ${numero} emitido`, user?.nome||'Sistema').run()
  // Atualiza mapa
  if (d.mapa_id) {
    await c.env.DB.prepare(`UPDATE mapas_comparativos SET status='PC Emitido',pc_numero=?,atualizado_em=? WHERE id=?`)
      .bind(numero, now(), d.mapa_id).run()
  }
  // Cria conta a pagar
  if (d.criar_conta_pagar !== false) {
    const cpid = uid('cp')
    const cpCount = await c.env.DB.prepare(`SELECT COUNT(*) as n FROM contas_pagar WHERE numero LIKE ?`).bind(`CP-${ano}-%`).first() as any
    const cpNum = `CP-${ano}-${String((cpCount?.n || 0) + 1).padStart(4, '0')}`
    await c.env.DB.prepare(
      `INSERT INTO contas_pagar(id,numero,descricao,fornecedor_id,fornecedor,pc_id,pc_numero,valor_total,data_vencimento,status,tipo)
       VALUES(?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(cpid, cpNum, `Pedido ${numero} – ${d.fornecedor}`, fornecedor_id, d.fornecedor,
      id, numero, d.valor_total||0, d.prazo_entrega||null, 'A Pagar', 'Compra').run()
  }
  return c.json(ok({ id, numero }), 201)
})

app.put('/api/pedidos/:id', async (c) => {
  const id = c.req.param('id')
  const d = await body(c)
  const user = await getUser(c)
  await c.env.DB.prepare(
    `UPDATE pedidos_compra SET condicao_pagamento=?,prazo_entrega=?,local_entrega=?,observacoes=?,status=?,atualizado_em=? WHERE id=?`
  ).bind(d.condicao_pagamento||null, d.prazo_entrega||null, d.local_entrega||null, d.observacoes||null, d.status, now(), id).run()
  if (d.itens) {
    await c.env.DB.prepare(`DELETE FROM pc_itens WHERE pc_id=?`).bind(id).run()
    let total = 0
    const stmt = c.env.DB.prepare(`INSERT INTO pc_itens(id,pc_id,descricao,qtd,unidade,preco_unit,total) VALUES(?,?,?,?,?,?,?)`)
    for (const it of d.itens) {
      const t = (it.qtd||1)*(it.preco_unit||0)
      total += t
      await stmt.bind(uid('pci'), id, it.descricao, it.qtd||1, it.unidade||'Un', it.preco_unit||0, it.total||t).run()
    }
    if (total > 0) await c.env.DB.prepare(`UPDATE pedidos_compra SET valor_total=? WHERE id=?`).bind(total, id).run()
  }
  await c.env.DB.prepare(`INSERT INTO pc_historico(id,pc_id,acao,usuario) VALUES(?,?,?,?)`)
    .bind(uid('pch'), id, `Pedido editado – status: ${d.status}`, user?.nome||'Sistema').run()
  return c.json(ok({ id }))
})

// ─── ENVIO AO FORNECEDOR ──────────────────────────────────────
app.post('/api/pedidos/:id/envio', async (c) => {
  const id = c.req.param('id')
  const d = await body(c)
  const user = await getUser(c)
  const novoStatus = d.agendado ? 'Aguardando Envio' : 'Enviado ao Fornecedor'
  await c.env.DB.prepare(
    `UPDATE pedidos_compra SET status=?,envio_agendado=?,envio_canal=?,envio_data=?,envio_email=?,atualizado_em=? WHERE id=?`
  ).bind(novoStatus, d.agendado?1:0, d.canal||null, d.data_envio||null, d.email||null, now(), id).run()
  const descLog = d.agendado ? `Agendado para ${d.data_envio} via ${d.canal}` : `Enviado via ${d.canal}${d.email?' para '+d.email:''}`
  await c.env.DB.prepare(`INSERT INTO pc_envio_log(id,pc_id,descricao,canal,email) VALUES(?,?,?,?,?)`)
    .bind(uid('pel'), id, descLog, d.canal||null, d.email||null).run()
  await c.env.DB.prepare(`INSERT INTO pc_historico(id,pc_id,acao,usuario) VALUES(?,?,?,?)`)
    .bind(uid('pch'), id, descLog, user?.nome||'Sistema').run()
  return c.json(ok({ status: novoStatus }))
})

// ─── REGISTRAR ENTREGA ────────────────────────────────────────
app.post('/api/pedidos/:id/entrega', async (c) => {
  const id = c.req.param('id')
  const d = await body(c)
  const user = await getUser(c)
  const userName = user?.nome || d.recebido_por || 'Almoxarife'
  const statusEntrega = d.status || 'Entregue Total'
  await c.env.DB.prepare(
    `UPDATE pedidos_compra SET status=?,data_entrega=?,recebido_por=?,nf_numero=?,valor_nf=?,obs_recebimento=?,atualizado_em=? WHERE id=?`
  ).bind(
    statusEntrega,
    d.data_entrega_real || d.data_entrega || null,
    userName,
    d.nf_numero || null,
    d.valor_nf || null,
    d.obs_recebimento || null,
    now(),
    id
  ).run()
  await c.env.DB.prepare(`INSERT INTO pc_historico(id,pc_id,acao,usuario) VALUES(?,?,?,?)`)
    .bind(uid('pch'), id,
      `Recebimento confirmado – NF ${d.nf_numero||'S/N'} – Status: ${statusEntrega}${d.obs_recebimento?' – '+d.obs_recebimento:''}`,
      userName
    ).run()
  // Persiste o recebimento na tabela recebimentos
  try {
    const recId = d.recebimento_id || uid('rec')
    await c.env.DB.prepare(`
      INSERT OR IGNORE INTO recebimentos
        (id, numero, pedido_id, pedido_numero, fornecedor_id, fornecedor, nf_numero, valor_nf,
         data_recebimento, conferente, status, obs, cp_gerado, criado_em)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      recId, recId, id,
      d.pedido_numero || null, d.fornecedor_id || null, d.fornecedor || null,
      d.nf_numero || null, d.valor_nf || null,
      d.data_entrega_real || now(), userName,
      statusEntrega, d.obs_recebimento || null,
      0, now()
    ).run()
  } catch(e) { /* tabela pode não ter a coluna ainda */ }
  return c.json(ok({ status: statusEntrega }))
})

// ─── CANCELAR PEDIDO ──────────────────────────────────────────
app.post('/api/pedidos/:id/cancelar', async (c) => {
  const id = c.req.param('id')
  const d = await body(c)
  const user = await getUser(c)
  const userName = user?.nome || 'Comprador'
  await c.env.DB.prepare(
    `UPDATE pedidos_compra SET status='Cancelado',motivo_cancelamento=?,data_cancelamento=?,cancelado_por=?,atualizado_em=? WHERE id=?`
  ).bind(d.motivo||null, now(), userName, now(), id).run()
  await c.env.DB.prepare(`INSERT INTO pc_historico(id,pc_id,acao,usuario) VALUES(?,?,?,?)`)
    .bind(uid('pch'), id, `Pedido cancelado – ${d.motivo||'sem motivo'}`, userName).run()
  return c.json(ok({ cancelado: true }))
})

// ════════════════════════════════════════════════════════════
// RECEBIMENTOS
// ════════════════════════════════════════════════════════════

// GET /api/recebimentos — lista recebimentos com filtros opcionais
app.get('/api/recebimentos', async (c) => {
  const pedidoId = c.req.query('pedido_id')
  const q = c.req.query('q')
  let sql = `SELECT r.*, pc.numero AS pedido_numero_real, f.nome AS fornecedor_nome_real
    FROM recebimentos r
    LEFT JOIN pedidos_compra pc ON r.pedido_id = pc.id
    LEFT JOIN fornecedores f ON r.fornecedor_id = f.id WHERE 1=1`
  const params: any[] = []
  if (pedidoId) { sql += ` AND r.pedido_id=?`; params.push(pedidoId) }
  if (q) { sql += ` AND (r.nf_numero LIKE ? OR r.pedido_numero LIKE ? OR r.fornecedor LIKE ?)`; params.push(`%${q}%`, `%${q}%`, `%${q}%`) }
  sql += ` ORDER BY r.criado_em DESC LIMIT 500`
  try {
    const { results } = await c.env.DB.prepare(sql).bind(...params).all()
    return c.json(ok(results))
  } catch(e) {
    return c.json(ok([]))
  }
})

// GET /api/recebimentos/:id — detalhe de um recebimento
app.get('/api/recebimentos/:id', async (c) => {
  const id = c.req.param('id')
  try {
    const row = await c.env.DB.prepare(
      `SELECT r.*, pc.numero AS pedido_numero_real FROM recebimentos r
       LEFT JOIN pedidos_compra pc ON r.pedido_id = pc.id WHERE r.id=?`
    ).bind(id).first()
    if (!row) return c.json(err('Recebimento não encontrado'), 404)
    return c.json(ok(row))
  } catch(e) {
    return c.json(err('Tabela não encontrada'), 500)
  }
})

// POST /api/recebimentos — registra manualmente um recebimento (sem ser via entrega)
app.post('/api/recebimentos', async (c) => {
  const d = await body(c)
  const user = await getUser(c)
  const recId = d.id || uid('rec')
  const numero = d.numero || recId
  try {
    await c.env.DB.prepare(`
      INSERT OR IGNORE INTO recebimentos
        (id, numero, pedido_id, pedido_numero, fornecedor_id, fornecedor, nf_numero, valor_nf,
         data_recebimento, conferente, status, local_entrega, obs, anexo_nf, itens_inspecao, cp_gerado, criado_em)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      recId, numero,
      d.pedido_id || null, d.pedido_numero || null,
      d.fornecedor_id || null, d.fornecedor || null,
      d.nf_numero || null, d.valor_nf || 0,
      d.data_recebimento || now(),
      d.conferente || user?.nome || null,
      d.status || 'Conforme',
      d.local_entrega || null, d.obs || null,
      d.anexo_nf || null,
      d.itens_inspecao ? JSON.stringify(d.itens_inspecao) : null,
      d.cp_gerado ? 1 : 0,
      now()
    ).run()
  } catch(e) {
    return c.json(err('Erro ao salvar recebimento: ' + String(e)), 500)
  }
  return c.json(ok({ id: recId, numero }), 201)
})

// ════════════════════════════════════════════════════════════
// ALMOXARIFADO – MATERIAIS
// ════════════════════════════════════════════════════════════

app.get('/api/materiais', async (c) => {
  const q     = c.req.query('q')
  const tipo  = c.req.query('tipo')
  const cat   = c.req.query('categoria')
  let sql = `SELECT * FROM materiais WHERE ativo=1`
  const params: any[] = []
  if (tipo) { sql += ` AND tipo=?`; params.push(tipo) }
  if (cat)  { sql += ` AND categoria=?`; params.push(cat) }
  if (q)    { sql += ` AND (nome LIKE ? OR codigo LIKE ? OR descricao LIKE ?)`; params.push(`%${q}%`,`%${q}%`,`%${q}%`) }
  sql += ` ORDER BY nome ASC LIMIT 1000`
  try {
    const { results } = await c.env.DB.prepare(sql).bind(...params).all()
    return c.json(ok(results))
  } catch { return c.json(ok([])) }
})

app.get('/api/materiais/:id', async (c) => {
  const id = c.req.param('id')
  try {
    const row = await c.env.DB.prepare(`SELECT * FROM materiais WHERE id=?`).bind(id).first()
    if (!row) return c.json(err('Material não encontrado'), 404)
    return c.json(ok(row))
  } catch(e) { return c.json(err(String(e)), 500) }
})

app.post('/api/materiais', async (c) => {
  const d    = await body(c)
  const user = await getUser(c)
  if (!d.nome || !d.codigo) return c.json(err('Nome e código são obrigatórios'), 400)
  const id   = d.id || uid('mat')
  try {
    await c.env.DB.prepare(`
      INSERT OR IGNORE INTO materiais
        (id,codigo,nome,descricao,categoria,subcategoria,unidade,tipo,marca,modelo,numero_serie,
         localizacao,estoque_atual,estoque_minimo,estoque_maximo,valor_unitario,
         pedido_id,recebimento_id,ativo,criado_por,criado_em,atualizado_em)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?,?)
    `).bind(
      id, d.codigo, d.nome, d.descricao||null, d.categoria||null, d.subcategoria||null,
      d.unidade||'UN', d.tipo||'Material', d.marca||null, d.modelo||null, d.numero_serie||null,
      d.localizacao||null,
      d.estoque_atual||0, d.estoque_minimo||0, d.estoque_maximo||null, d.valor_unitario||0,
      d.pedido_id||null, d.recebimento_id||null,
      user?.nome||null, now(), now()
    ).run()
    return c.json(ok({ id }), 201)
  } catch(e) { return c.json(err('Erro ao salvar material: '+String(e)), 500) }
})

app.put('/api/materiais/:id', async (c) => {
  const id = c.req.param('id')
  const d  = await body(c)
  const fields: string[] = []
  const params: any[] = []
  const allowed = ['nome','descricao','categoria','subcategoria','unidade','tipo','marca','modelo',
                   'numero_serie','localizacao','estoque_minimo','estoque_maximo','valor_unitario','ativo']
  for (const k of allowed) {
    if (d[k] !== undefined) { fields.push(`${k}=?`); params.push(d[k]) }
  }
  if (!fields.length) return c.json(err('Nenhum campo para atualizar'), 400)
  fields.push('atualizado_em=?'); params.push(now()); params.push(id)
  try {
    await c.env.DB.prepare(`UPDATE materiais SET ${fields.join(',')} WHERE id=?`).bind(...params).run()
    return c.json(ok({ id }))
  } catch(e) { return c.json(err(String(e)), 500) }
})

// ════════════════════════════════════════════════════════════
// ALMOXARIFADO – MOVIMENTOS DE ESTOQUE
// ════════════════════════════════════════════════════════════

app.get('/api/movimentos-estoque', async (c) => {
  const matId  = c.req.query('material_id')
  const tipo   = c.req.query('tipo')
  const pedId  = c.req.query('pedido_id')
  const recId  = c.req.query('recebimento_id')
  const q      = c.req.query('q')
  const limit  = parseInt(c.req.query('limit') || '200')
  let sql = `SELECT m.*, mat.unidade AS mat_unidade FROM movimentos_estoque m LEFT JOIN materiais mat ON m.material_id=mat.id WHERE 1=1`
  const params: any[] = []
  if (matId) { sql += ` AND m.material_id=?`; params.push(matId) }
  if (tipo)  { sql += ` AND m.tipo=?`; params.push(tipo) }
  if (pedId) { sql += ` AND m.pedido_id=?`; params.push(pedId) }
  if (recId) { sql += ` AND m.recebimento_id=?`; params.push(recId) }
  if (q)     { sql += ` AND (m.material_nome LIKE ? OR m.numero LIKE ? OR m.responsavel LIKE ?)`; params.push(`%${q}%`,`%${q}%`,`%${q}%`) }
  sql += ` ORDER BY m.criado_em DESC LIMIT ${limit}`
  try {
    const { results } = await c.env.DB.prepare(sql).bind(...params).all()
    return c.json(ok(results))
  } catch { return c.json(ok([])) }
})

app.get('/api/movimentos-estoque/:id', async (c) => {
  const id = c.req.param('id')
  try {
    const row = await c.env.DB.prepare(`SELECT * FROM movimentos_estoque WHERE id=?`).bind(id).first()
    if (!row) return c.json(err('Movimento não encontrado'), 404)
    return c.json(ok(row))
  } catch(e) { return c.json(err(String(e)), 500) }
})

app.post('/api/movimentos-estoque', async (c) => {
  const d    = await body(c)
  const user = await getUser(c)
  if (!d.material_id || !d.tipo || d.quantidade === undefined)
    return c.json(err('material_id, tipo e quantidade são obrigatórios'), 400)
  const id  = d.id || uid('mov')
  const ano = new Date().getFullYear()
  // Gera número sequencial
  const cnt = await c.env.DB.prepare(
    `SELECT COUNT(*) AS n FROM movimentos_estoque WHERE numero LIKE ?`
  ).bind(`MOV-${ano}-%`).first() as any
  const num = `MOV-${ano}-${String((cnt?.n||0)+1).padStart(4,'0')}`
  // Busca estoque atual do material
  let estAntes = 0
  try {
    const mat: any = await c.env.DB.prepare(`SELECT estoque_atual FROM materiais WHERE id=?`).bind(d.material_id).first()
    estAntes = mat?.estoque_atual || 0
  } catch {}
  const delta = ['Entrada','Devolução','Ajuste'].includes(d.tipo) && d.subtipo !== 'Baixa'
    ? (d.tipo === 'Saída' ? -Math.abs(d.quantidade) : Math.abs(d.quantidade))
    : (d.tipo === 'Saída' ? -Math.abs(d.quantidade) : Math.abs(d.quantidade))
  const estDepois = estAntes + (d.tipo === 'Saída' ? -Math.abs(d.quantidade) : (d.tipo === 'Ajuste' ? (d.quantidade - estAntes) : Math.abs(d.quantidade)))
  try {
    await c.env.DB.prepare(`
      INSERT INTO movimentos_estoque
        (id,numero,material_id,material_nome,material_codigo,tipo,subtipo,quantidade,unidade,
         valor_unitario,valor_total,estoque_antes,estoque_depois,
         pedido_id,pedido_numero,recebimento_id,recebimento_num,os_id,os_numero,emprestimo_id,inventario_id,
         nota_fiscal,fornecedor_id,fornecedor_nome,local_origem,local_destino,
         responsavel_id,responsavel,solicitante,numero_serie,lote,observacoes,status,criado_em,atualizado_em)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      id, num, d.material_id, d.material_nome||null, d.material_codigo||null,
      d.tipo, d.subtipo||null, Math.abs(d.quantidade), d.unidade||null,
      d.valor_unitario||0, d.valor_total||0, estAntes, estDepois,
      d.pedido_id||null, d.pedido_numero||null, d.recebimento_id||null, d.recebimento_num||null,
      d.os_id||null, d.os_numero||null, d.emprestimo_id||null, d.inventario_id||null,
      d.nota_fiscal||null, d.fornecedor_id||null, d.fornecedor_nome||null,
      d.local_origem||null, d.local_destino||null,
      d.responsavel_id||null, d.responsavel||user?.nome||'Sistema',
      d.solicitante||null, d.numero_serie||null, d.lote||null,
      d.observacoes||null, d.status||'Efetivado', now(), now()
    ).run()
    // Atualiza estoque do material
    if (d.tipo !== 'Transferência') {
      await c.env.DB.prepare(
        `UPDATE materiais SET estoque_atual=?, atualizado_em=? WHERE id=?`
      ).bind(estDepois, now(), d.material_id).run()
    }
    return c.json(ok({ id, numero: num, estoque_depois: estDepois }), 201)
  } catch(e) { return c.json(err('Erro ao registrar movimento: '+String(e)), 500) }
})

// PATCH para cancelar um movimento
app.patch('/api/movimentos-estoque/:id/cancelar', async (c) => {
  const id   = c.req.param('id')
  const d    = await body(c)
  const user = await getUser(c)
  try {
    const mov: any = await c.env.DB.prepare(`SELECT * FROM movimentos_estoque WHERE id=?`).bind(id).first()
    if (!mov) return c.json(err('Movimento não encontrado'), 404)
    if (mov.status === 'Cancelado') return c.json(err('Movimento já cancelado'), 400)
    // Estorna o estoque
    const mat: any = await c.env.DB.prepare(`SELECT estoque_atual FROM materiais WHERE id=?`).bind(mov.material_id).first()
    const estoqueAtual = mat?.estoque_atual || 0
    const estornoQtd   = mov.tipo === 'Saída' ? Math.abs(mov.quantidade) : -Math.abs(mov.quantidade)
    await c.env.DB.prepare(`UPDATE materiais SET estoque_atual=?, atualizado_em=? WHERE id=?`)
      .bind(estoqueAtual + estornoQtd, now(), mov.material_id).run()
    await c.env.DB.prepare(
      `UPDATE movimentos_estoque SET status='Cancelado', cancelado_por=?, cancelado_em=?, motivo_cancelamento=?, atualizado_em=? WHERE id=?`
    ).bind(user?.nome||'Sistema', now(), d.motivo||null, now(), id).run()
    return c.json(ok({ id, estoque_atual: estoqueAtual + estornoQtd }))
  } catch(e) { return c.json(err(String(e)), 500) }
})

// ════════════════════════════════════════════════════════════
// ALMOXARIFADO – EMPRÉSTIMOS / COMODATOS
// ════════════════════════════════════════════════════════════

app.get('/api/emprestimos', async (c) => {
  const status  = c.req.query('status')
  const matId   = c.req.query('material_id')
  const resp    = c.req.query('responsavel')
  let sql = `SELECT * FROM emprestimos WHERE 1=1`
  const params: any[] = []
  if (status) { sql += ` AND status=?`; params.push(status) }
  if (matId)  { sql += ` AND material_id=?`; params.push(matId) }
  if (resp)   { sql += ` AND (responsavel_retirada LIKE ? OR responsavel_devolucao LIKE ?)`; params.push(`%${resp}%`,`%${resp}%`) }
  sql += ` ORDER BY criado_em DESC LIMIT 500`
  try {
    const { results } = await c.env.DB.prepare(sql).bind(...params).all()
    return c.json(ok(results))
  } catch { return c.json(ok([])) }
})

app.post('/api/emprestimos', async (c) => {
  const d    = await body(c)
  const user = await getUser(c)
  if (!d.material_id || !d.responsavel_retirada)
    return c.json(err('material_id e responsavel_retirada são obrigatórios'), 400)
  const id  = d.id || uid('emp')
  const ano = new Date().getFullYear()
  const cnt = await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM emprestimos WHERE numero LIKE ?`)
    .bind(`EMP-${ano}-%`).first() as any
  const num = `EMP-${ano}-${String((cnt?.n||0)+1).padStart(4,'0')}`
  const qtd = d.quantidade || 1
  try {
    // Verifica estoque disponível
    const mat: any = await c.env.DB.prepare(`SELECT estoque_atual, nome FROM materiais WHERE id=?`).bind(d.material_id).first()
    if (!mat) return c.json(err('Material não encontrado'), 404)
    if ((mat.estoque_atual || 0) < qtd) return c.json(err(`Estoque insuficiente. Disponível: ${mat.estoque_atual}`), 400)
    await c.env.DB.prepare(`
      INSERT INTO emprestimos
        (id,numero,material_id,material_nome,material_codigo,numero_serie,quantidade,unidade,
         responsavel_retirada,responsavel_id_retirada,matricula_retirada,setor_retirada,
         autorizado_por,data_retirada,data_prevista_devolucao,local_uso,
         os_id,os_numero,projeto_id,projeto_nome,finalidade,condicao_retirada,status,obs_retirada,criado_por,criado_em,atualizado_em)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      id, num, d.material_id, d.material_nome||mat.nome||null, d.material_codigo||null,
      d.numero_serie||null, qtd, d.unidade||null,
      d.responsavel_retirada, d.responsavel_id_retirada||null, d.matricula_retirada||null, d.setor_retirada||null,
      d.autorizado_por||user?.nome||null,
      d.data_retirada||now().slice(0,10), d.data_prevista_devolucao||null,
      d.local_uso||null, d.os_id||null, d.os_numero||null,
      d.projeto_id||null, d.projeto_nome||null, d.finalidade||null,
      d.condicao_retirada||'Bom', 'Ativo', d.obs_retirada||null,
      user?.nome||null, now(), now()
    ).run()
    // Debita do estoque
    await c.env.DB.prepare(`UPDATE materiais SET estoque_atual=estoque_atual-?, atualizado_em=? WHERE id=?`)
      .bind(qtd, now(), d.material_id).run()
    // Registra movimento
    const movId = uid('mov')
    await c.env.DB.prepare(`
      INSERT INTO movimentos_estoque (id,numero,material_id,material_nome,tipo,subtipo,quantidade,
        responsavel,solicitante,local_destino,emprestimo_id,observacoes,status,criado_em,atualizado_em)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(movId, `MOV-EMP-${num}`, d.material_id, d.material_nome||mat.nome||null,
      'Saída','Empréstimo', qtd, user?.nome||'Sistema', d.responsavel_retirada||null,
      d.local_uso||null, id, `Empréstimo ${num} para ${d.responsavel_retirada}`, 'Efetivado', now(), now()
    ).run()
    return c.json(ok({ id, numero: num }), 201)
  } catch(e) { return c.json(err('Erro ao registrar empréstimo: '+String(e)), 500) }
})

// POST /api/emprestimos/:id/devolucao
app.post('/api/emprestimos/:id/devolucao', async (c) => {
  const id   = c.req.param('id')
  const d    = await body(c)
  const user = await getUser(c)
  try {
    const emp: any = await c.env.DB.prepare(`SELECT * FROM emprestimos WHERE id=?`).bind(id).first()
    if (!emp) return c.json(err('Empréstimo não encontrado'), 404)
    if (emp.status === 'Devolvido') return c.json(err('Empréstimo já devolvido'), 400)
    await c.env.DB.prepare(`
      UPDATE emprestimos SET status='Devolvido', data_devolucao=?, responsavel_devolucao=?,
        responsavel_id_devolucao=?, condicao_devolucao=?, obs_devolucao=?, atualizado_em=? WHERE id=?
    `).bind(
      d.data_devolucao||now().slice(0,10),
      d.responsavel_devolucao||user?.nome||null,
      d.responsavel_id_devolucao||null,
      d.condicao_devolucao||'Bom',
      d.obs_devolucao||null, now(), id
    ).run()
    // Crédita no estoque
    await c.env.DB.prepare(`UPDATE materiais SET estoque_atual=estoque_atual+?, atualizado_em=? WHERE id=?`)
      .bind(emp.quantidade, now(), emp.material_id).run()
    // Registra movimento de devolução
    const movId = uid('mov')
    await c.env.DB.prepare(`
      INSERT INTO movimentos_estoque (id,numero,material_id,material_nome,tipo,subtipo,quantidade,
        responsavel,solicitante,emprestimo_id,observacoes,status,criado_em,atualizado_em)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(movId, `MOV-DEV-${emp.numero}`, emp.material_id, emp.material_nome,
      'Entrada','Devolução', emp.quantidade, user?.nome||'Sistema',
      d.responsavel_devolucao||null, id,
      `Devolução do empréstimo ${emp.numero}`, 'Efetivado', now(), now()
    ).run()
    return c.json(ok({ id, numero: emp.numero }))
  } catch(e) { return c.json(err(String(e)), 500) }
})

// ════════════════════════════════════════════════════════════
// ALMOXARIFADO – INVENTÁRIOS
// ════════════════════════════════════════════════════════════

app.get('/api/inventarios', async (c) => {
  const status = c.req.query('status')
  let sql = `SELECT * FROM inventarios WHERE 1=1`
  const params: any[] = []
  if (status) { sql += ` AND status=?`; params.push(status) }
  sql += ` ORDER BY criado_em DESC LIMIT 100`
  try {
    const { results } = await c.env.DB.prepare(sql).bind(...params).all()
    return c.json(ok(results))
  } catch { return c.json(ok([])) }
})

app.get('/api/inventarios/:id', async (c) => {
  const id = c.req.param('id')
  try {
    const inv = await c.env.DB.prepare(`SELECT * FROM inventarios WHERE id=?`).bind(id).first()
    if (!inv) return c.json(err('Inventário não encontrado'), 404)
    const { results: itens } = await c.env.DB.prepare(
      `SELECT ii.*, m.unidade AS mat_unidade, m.localizacao FROM inventario_itens ii
       LEFT JOIN materiais m ON ii.material_id=m.id WHERE ii.inventario_id=?`
    ).bind(id).all()
    return c.json(ok({ ...inv as any, itens }))
  } catch(e) { return c.json(err(String(e)), 500) }
})

app.post('/api/inventarios', async (c) => {
  const d    = await body(c)
  const user = await getUser(c)
  if (!d.descricao && !d.tipo) return c.json(err('Descrição ou tipo são obrigatórios'), 400)
  const id  = uid('inv')
  const ano = new Date().getFullYear()
  const cnt = await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM inventarios WHERE numero LIKE ?`)
    .bind(`INV-${ano}-%`).first() as any
  const num = `INV-${ano}-${String((cnt?.n||0)+1).padStart(3,'0')}`
  try {
    await c.env.DB.prepare(`
      INSERT INTO inventarios (id,numero,descricao,tipo,status,data_inicio,responsavel,
        local_filtro,categoria_filtro,obs,criado_por,criado_em,atualizado_em)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      id, num, d.descricao||null, d.tipo||'Geral', 'Aberto',
      d.data_inicio||now().slice(0,10), d.responsavel||user?.nome||'Sistema',
      d.local_filtro||null, d.categoria_filtro||null, d.obs||null,
      user?.nome||null, now(), now()
    ).run()
    // Popula itens de inventário com todos materiais ativos (ou filtrados)
    let matSql = `SELECT id, nome, codigo, unidade, estoque_atual, localizacao FROM materiais WHERE ativo=1`
    const matParams: any[] = []
    if (d.categoria_filtro) { matSql += ` AND categoria=?`; matParams.push(d.categoria_filtro) }
    if (d.local_filtro)     { matSql += ` AND localizacao LIKE ?`; matParams.push(`%${d.local_filtro}%`) }
    const { results: mats } = await c.env.DB.prepare(matSql).bind(...matParams).all() as { results: any[] }
    for (const mat of mats) {
      const iid = uid('iinv')
      await c.env.DB.prepare(`
        INSERT INTO inventario_itens (id,inventario_id,material_id,material_nome,material_codigo,
          unidade,localizacao,estoque_sistema,status,criado_em)
        VALUES (?,?,?,?,?,?,?,?,?,?)
      `).bind(iid, id, mat.id, mat.nome, mat.codigo, mat.unidade, mat.localizacao, mat.estoque_atual, 'Pendente', now()).run()
    }
    await c.env.DB.prepare(`UPDATE inventarios SET total_itens=? WHERE id=?`).bind(mats.length, id).run()
    return c.json(ok({ id, numero: num, total_itens: mats.length }), 201)
  } catch(e) { return c.json(err('Erro ao criar inventário: '+String(e)), 500) }
})

// PATCH /api/inventarios/:id/contar — lança contagem de um item
app.patch('/api/inventarios/:id/contar', async (c) => {
  const invId = c.req.param('id')
  const d     = await body(c)
  const user  = await getUser(c)
  if (!d.item_id || d.estoque_contado === undefined)
    return c.json(err('item_id e estoque_contado são obrigatórios'), 400)
  try {
    const item: any = await c.env.DB.prepare(`SELECT * FROM inventario_itens WHERE id=? AND inventario_id=?`).bind(d.item_id, invId).first()
    if (!item) return c.json(err('Item não encontrado'), 404)
    const divergencia = d.estoque_contado - item.estoque_sistema
    await c.env.DB.prepare(`
      UPDATE inventario_itens SET estoque_contado=?, divergencia=?, status='Contado',
        contado_por=?, contado_em=?, obs=? WHERE id=?
    `).bind(d.estoque_contado, divergencia, user?.nome||'Sistema', now(), d.obs||null, d.item_id).run()
    // Atualiza contadores no inventário
    await c.env.DB.prepare(`
      UPDATE inventarios SET
        itens_contados=(SELECT COUNT(*) FROM inventario_itens WHERE inventario_id=? AND status!='Pendente'),
        divergencias=(SELECT COUNT(*) FROM inventario_itens WHERE inventario_id=? AND divergencia!=0 AND divergencia IS NOT NULL),
        atualizado_em=?
      WHERE id=?
    `).bind(invId, invId, now(), invId).run()
    return c.json(ok({ item_id: d.item_id, divergencia }))
  } catch(e) { return c.json(err(String(e)), 500) }
})

// POST /api/inventarios/:id/concluir — aplica ajustes de estoque
app.post('/api/inventarios/:id/concluir', async (c) => {
  const invId = c.req.param('id')
  const d     = await body(c)
  const user  = await getUser(c)
  try {
    const inv: any = await c.env.DB.prepare(`SELECT * FROM inventarios WHERE id=?`).bind(invId).first()
    if (!inv) return c.json(err('Inventário não encontrado'), 404)
    if (inv.status === 'Concluído') return c.json(err('Inventário já concluído'), 400)
    // Aplica ajustes nos itens contados com divergência
    const { results: itens } = await c.env.DB.prepare(
      `SELECT * FROM inventario_itens WHERE inventario_id=? AND status='Contado' AND divergencia!=0`
    ).bind(invId).all() as { results: any[] }
    for (const item of itens) {
      // Ajusta estoque do material para o valor contado
      await c.env.DB.prepare(`UPDATE materiais SET estoque_atual=?, atualizado_em=? WHERE id=?`)
        .bind(item.estoque_contado, now(), item.material_id).run()
      // Registra movimento de ajuste
      const movId = uid('mov')
      const ano   = new Date().getFullYear()
      const cnt: any = await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM movimentos_estoque WHERE numero LIKE ?`).bind(`MOV-${ano}-%`).first()
      const movNum = `MOV-${ano}-${String((cnt?.n||0)+1).padStart(4,'0')}`
      await c.env.DB.prepare(`
        INSERT INTO movimentos_estoque (id,numero,material_id,material_nome,tipo,subtipo,quantidade,
          estoque_antes,estoque_depois,inventario_id,responsavel,observacoes,status,criado_em,atualizado_em)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).bind(movId, movNum, item.material_id, item.material_nome,
        'Ajuste','Inventário', item.estoque_contado,
        item.estoque_sistema, item.estoque_contado,
        invId, user?.nome||'Sistema',
        `Ajuste de inventário ${inv.numero}`, 'Efetivado', now(), now()
      ).run()
      await c.env.DB.prepare(`UPDATE inventario_itens SET status='Ajustado', ajustado=1 WHERE id=?`).bind(item.id).run()
    }
    await c.env.DB.prepare(`UPDATE inventarios SET status='Concluído', data_fim=?, aprovador=?, aprovado_em=?, atualizado_em=? WHERE id=?`)
      .bind(now().slice(0,10), user?.nome||null, now(), now(), invId).run()
    return c.json(ok({ id: invId, ajustes: itens.length }))
  } catch(e) { return c.json(err(String(e)), 500) }
})

// ════════════════════════════════════════════════════════════
// CONTAS A PAGAR
// ════════════════════════════════════════════════════════════

// GET /api/contas-pagar
app.get('/api/contas-pagar', async (c) => {
  const status = c.req.query('status')
  const q = c.req.query('q')
  let sql = `SELECT cp.*, f.nome AS fornecedor_nome FROM contas_pagar cp
    LEFT JOIN fornecedores f ON cp.fornecedor_id = f.id WHERE 1=1`
  const params: any[] = []
  if (status) { sql += ` AND cp.status=?`; params.push(status) }
  if (q) { sql += ` AND (cp.descricao LIKE ? OR cp.numero LIKE ?)`; params.push(`%${q}%`, `%${q}%`) }
  sql += ` ORDER BY cp.data_vencimento ASC LIMIT 500`
  const { results } = await c.env.DB.prepare(sql).bind(...params).all()
  return c.json(ok(results))
})

// POST /api/contas-pagar
app.post('/api/contas-pagar', async (c) => {
  const d = await body(c)
  const user = await getUser(c)
  const ano = new Date().getFullYear()
  const cpCount = await c.env.DB.prepare(
    `SELECT COUNT(*) as n FROM contas_pagar WHERE numero LIKE ?`
  ).bind(`CP-${ano}-%`).first() as any
  const seq = String((cpCount?.n || 0) + 1).padStart(4, '0')
  const numero = d.numero || `CP-${ano}-${seq}`
  const cpId = d.id || uid('cp')
  await c.env.DB.prepare(`
    INSERT OR IGNORE INTO contas_pagar
      (id, numero, descricao, fornecedor_id, fornecedor, pc_id, pc_numero,
       valor_total, data_vencimento, data_emissao, status, tipo, nota_fiscal,
       cond_pagamento, conta_contabil, centro_custo, criado_em)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).bind(
    cpId, numero,
    d.descricao || null,
    d.fornecedor_id || null,
    d.fornecedor_nome || d.fornecedor || null,
    d.pedido_id || null,
    d.pedido_numero || null,
    d.valor || d.valor_total || 0,
    d.vencimento_iso || d.vencimento || null,
    d.data_emissao || now(),
    d.status || 'Pendente',
    d.tipo || 'Fornecedor',
    d.nota_fiscal || null,
    d.cond_pagamento || null,
    d.conta_contabil || null,
    d.centro_custo || null,
    now()
  ).run()
  return c.json(ok({ id: cpId, numero }))
})

// ════════════════════════════════════════════════════════════
// USUÁRIOS (admin)
// ════════════════════════════════════════════════════════════
app.get('/api/usuarios', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT id, nome, email, perfil, ativo, criado_em FROM usuarios ORDER BY nome`
  ).all()
  return c.json(ok(results))
})

app.post('/api/usuarios', async (c) => {
  const d = await body(c)
  if (!d.nome || !d.email) return c.json(err('Nome e email obrigatórios'), 400)
  const id = uid('usr')
  await c.env.DB.prepare(
    `INSERT INTO usuarios(id,nome,email,senha_hash,perfil,ativo) VALUES(?,?,?,?,?,1)`
  ).bind(id, d.nome, d.email.toLowerCase(), d.senha_hash||'$2b$10$placeholder_new', d.perfil||'operacao').run()
  return c.json(ok({ id }), 201)
})

app.put('/api/usuarios/:id', async (c) => {
  const id = c.req.param('id')
  const d = await body(c)
  await c.env.DB.prepare(
    `UPDATE usuarios SET nome=?,email=?,perfil=?,ativo=?,atualizado_em=? WHERE id=?`
  ).bind(d.nome, d.email?.toLowerCase()||null, d.perfil, d.ativo??1, now(), id).run()
  return c.json(ok({ id }))
})

// ─── PERMISSÕES CUSTOMIZADAS ──────────────────────────────────
app.get('/api/usuarios/:id/permissoes', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM permissoes_usuario WHERE usuario_id=?`
  ).bind(c.req.param('id')).all()
  return c.json(ok(results))
})

app.put('/api/usuarios/:id/permissoes', async (c) => {
  const uid_param = c.req.param('id')
  const { permissoes } = await body(c)
  await c.env.DB.prepare(`DELETE FROM permissoes_usuario WHERE usuario_id=?`).bind(uid_param).run()
  if (permissoes?.length) {
    const stmt = c.env.DB.prepare(`INSERT INTO permissoes_usuario(id,usuario_id,modulo,acao,permitido) VALUES(?,?,?,?,?)`)
    for (const p of permissoes) await stmt.bind(uid('perm'), uid_param, p.modulo, p.acao, p.permitido??1).run()
  }
  return c.json(ok(null))
})

// ════════════════════════════════════════════════════════════
// LOGS DO SISTEMA
// ════════════════════════════════════════════════════════════
app.post('/api/logs', async (c) => {
  const d = await body(c)
  const user = await getUser(c)
  await c.env.DB.prepare(
    `INSERT INTO logs_sistema(id,usuario_id,usuario_nome,acao,modulo,descricao,ip) VALUES(?,?,?,?,?,?,?)`
  ).bind(uid('log'), user?.usuario_id||null, user?.nome||d.usuario_nome||null,
    d.acao||'Ação', d.modulo||'geral', d.descricao||null,
    c.req.header('CF-Connecting-IP')||null).run()
  return c.json(ok(null), 201)
})

app.get('/api/logs', async (c) => {
  const modulo = c.req.query('modulo') || ''
  const limit = parseInt(c.req.query('limit') || '100')
  let sql = `SELECT * FROM logs_sistema`
  const params: any[] = []
  if (modulo) { sql += ' WHERE modulo=?'; params.push(modulo) }
  sql += ` ORDER BY criado_em DESC LIMIT ${Math.min(limit, 500)}`
  const { results } = await c.env.DB.prepare(sql).bind(...params).all()
  return c.json(ok(results))
})

// ════════════════════════════════════════════════════════════
// CONFIG APROVAÇÃO
// ════════════════════════════════════════════════════════════
app.get('/api/config/aprovacao', async (c) => {
  const row = await c.env.DB.prepare(`SELECT dados_json FROM config_aprovacao WHERE id='default'`).first() as any
  return c.json(ok(JSON.parse(row?.dados_json || '{}')))
})

app.put('/api/config/aprovacao', async (c) => {
  const d = await body(c)
  await c.env.DB.prepare(`UPDATE config_aprovacao SET dados_json=?,atualizado_em=? WHERE id='default'`)
    .bind(JSON.stringify(d), now()).run()
  return c.json(ok(null))
})

// ════════════════════════════════════════════════════════════
// DASHBOARD – KPIs consolidados
// ════════════════════════════════════════════════════════════
app.get('/api/dashboard', async (c) => {
  const [os_total, os_abertas, rc_total, rfq_total, mapas_aprovados, pc_total, pc_valor] = await Promise.all([
    c.env.DB.prepare(`SELECT COUNT(*) as n FROM ordens_servico`).first() as Promise<any>,
    c.env.DB.prepare(`SELECT COUNT(*) as n FROM ordens_servico WHERE status NOT IN ('Concluída','Cancelada')`).first() as Promise<any>,
    c.env.DB.prepare(`SELECT COUNT(*) as n FROM requisicoes_compra`).first() as Promise<any>,
    c.env.DB.prepare(`SELECT COUNT(*) as n FROM rfq`).first() as Promise<any>,
    c.env.DB.prepare(`SELECT COUNT(*) as n FROM mapas_comparativos WHERE status='Aprovado'`).first() as Promise<any>,
    c.env.DB.prepare(`SELECT COUNT(*) as n FROM pedidos_compra WHERE status NOT IN ('Cancelado')`).first() as Promise<any>,
    c.env.DB.prepare(`SELECT COALESCE(SUM(valor_total),0) as v FROM pedidos_compra WHERE status NOT IN ('Cancelado')`).first() as Promise<any>,
  ])
  return c.json(ok({
    os: { total: os_total?.n || 0, abertas: os_abertas?.n || 0 },
    rc: { total: rc_total?.n || 0 },
    rfq: { total: rfq_total?.n || 0 },
    mapas: { aprovados: mapas_aprovados?.n || 0 },
    pedidos: { total: pc_total?.n || 0, volume: pc_valor?.v || 0 },
  }))
})

// ════════════════════════════════════════════════════════════
// SAAS — ORGANIZAÇÕES (multi-tenant)
// ════════════════════════════════════════════════════════════

// Lista todas as organizações (super-admin only)
app.get('/api/saas/orgs', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT o.*,
      (SELECT COUNT(*) FROM usuarios_org WHERE org_id=o.id) as total_usuarios,
      (SELECT COUNT(*) FROM logs_sistema WHERE modulo='auth' AND descricao LIKE '%'||o.id||'%') as total_logins
     FROM organizacoes o ORDER BY o.criado_em DESC`
  ).all()
  return c.json(ok(results))
})

app.get('/api/saas/orgs/:id', async (c) => {
  const id = c.req.param('id')
  const org = await c.env.DB.prepare(`SELECT * FROM organizacoes WHERE id=?`).bind(id).first()
  if (!org) return c.json(err('Organização não encontrada'), 404)
  const { results: usuarios } = await c.env.DB.prepare(
    `SELECT u.id, u.nome, u.email, u.perfil, uo.papel, uo.ativo, uo.criado_em
     FROM usuarios_org uo JOIN usuarios u ON u.id=uo.usuario_id
     WHERE uo.org_id=? ORDER BY u.nome`
  ).bind(id).all()
  return c.json(ok({ ...(org as any), usuarios }))
})

app.post('/api/saas/orgs', async (c) => {
  const d = await body(c)
  if (!d.nome || !d.email_admin) return c.json(err('Nome e email do admin obrigatórios'), 400)
  const id = uid('org')
  const slug = (d.nome as string).toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 30)
  const trialFim = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
  await c.env.DB.prepare(
    `INSERT INTO organizacoes(id,nome,slug,cnpj,email,telefone,segmento,plano,status,trial_fim,usuarios_max,storage_gb,criado_em)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(
    id, d.nome, d.slug||slug, d.cnpj||null, d.email||d.email_admin, d.telefone||null,
    d.segmento||null, d.plano||'trial', 'trial', trialFim,
    d.plano==='enterprise' ? 999 : d.plano==='professional' ? 20 : 5,
    d.plano==='enterprise' ? 500 : d.plano==='professional' ? 50 : 5,
    now()
  ).run()
  // Cria usuário admin da org
  const uid_admin = uid('usr')
  await c.env.DB.prepare(
    `INSERT INTO usuarios(id,nome,email,senha_hash,perfil,ativo) VALUES(?,?,?,?,?,1)`
  ).bind(uid_admin, d.nome_admin||d.nome, d.email_admin.toLowerCase(),
    '$2b$10$placeholder_new', 'admin').run()
  // Vincula usuário à org
  await c.env.DB.prepare(
    `INSERT INTO usuarios_org(id,org_id,usuario_id,papel,ativo) VALUES(?,?,?,?,1)`
  ).bind(uid('uorg'), id, uid_admin, 'admin').run()
  await c.env.DB.prepare(
    `INSERT INTO logs_sistema(id,usuario_id,usuario_nome,acao,modulo,descricao) VALUES(?,?,?,?,?,?)`
  ).bind(uid('log'), uid_admin, d.nome_admin||d.nome, 'Cadastro', 'saas', `Org criada: ${d.nome} | Plano: ${d.plano||'trial'}`).run()
  return c.json(ok({ id, slug: d.slug||slug, usuario_admin_id: uid_admin, trial_fim: trialFim }), 201)
})

app.put('/api/saas/orgs/:id', async (c) => {
  const id = c.req.param('id')
  const d = await body(c)
  await c.env.DB.prepare(
    `UPDATE organizacoes SET nome=?,plano=?,status=?,usuarios_max=?,storage_gb=?,
     data_renovacao=?,valor_mensalidade=?,atualizado_em=? WHERE id=?`
  ).bind(
    d.nome, d.plano, d.status,
    d.usuarios_max||(d.plano==='enterprise'?999:d.plano==='professional'?20:5),
    d.storage_gb||(d.plano==='enterprise'?500:d.plano==='professional'?50:5),
    d.data_renovacao||null,
    d.valor_mensalidade||(d.plano==='professional'?2490:d.plano==='enterprise'?6900:890),
    now(), id
  ).run()
  return c.json(ok({ id }))
})

// ════════════════════════════════════════════════════════════
// SAAS — LEADS (formulário da landing page)
// ════════════════════════════════════════════════════════════

app.get('/api/leads', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM leads ORDER BY criado_em DESC LIMIT 200`
  ).all()
  return c.json(ok(results))
})

app.post('/api/leads', async (c) => {
  const d = await body(c)
  if (!d.nome || !d.email || !d.empresa) return c.json(err('Dados incompletos'), 400)
  const id = uid('lead')
  // Verifica se já existe lead com mesmo email
  const existing = await c.env.DB.prepare(`SELECT id FROM leads WHERE email=?`).bind(d.email.toLowerCase()).first()
  if (existing) {
    // Atualiza interesse
    await c.env.DB.prepare(
      `UPDATE leads SET nome=?,empresa=?,telefone=?,segmento=?,plano_interesse=?,lgpd_aceito=?,atualizado_em=? WHERE email=?`
    ).bind(d.nome, d.empresa, d.telefone||null, d.segmento||null, d.plano||'trial', 1, now(), d.email.toLowerCase()).run()
    return c.json(ok({ id: (existing as any).id, atualizado: true }))
  }
  await c.env.DB.prepare(
    `INSERT INTO leads(id,nome,email,empresa,telefone,segmento,plano_interesse,lgpd_aceito,lgpd_data,status,origem,criado_em)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(
    id, d.nome, d.email.toLowerCase(), d.empresa, d.telefone||null,
    d.segmento||null, d.plano||'trial', 1, d.lgpd_data||now(),
    'novo', d.origem||'landing', now()
  ).run()
  return c.json(ok({ id }), 201)
})

app.put('/api/leads/:id', async (c) => {
  const id = c.req.param('id')
  const d = await body(c)
  await c.env.DB.prepare(
    `UPDATE leads SET status=?,notas=?,responsavel=?,atualizado_em=? WHERE id=?`
  ).bind(d.status, d.notas||null, d.responsavel||null, now(), id).run()
  return c.json(ok({ id }))
})

// ════════════════════════════════════════════════════════════
// SAAS — DASHBOARD (métricas da plataforma)
// ════════════════════════════════════════════════════════════

app.get('/api/saas/metricas', async (c) => {
  const [orgs, trials, ativos, pagos, leads_total, leads_novos, mrr] = await Promise.all([
    c.env.DB.prepare(`SELECT COUNT(*) as n FROM organizacoes`).first() as Promise<any>,
    c.env.DB.prepare(`SELECT COUNT(*) as n FROM organizacoes WHERE status='trial'`).first() as Promise<any>,
    c.env.DB.prepare(`SELECT COUNT(*) as n FROM organizacoes WHERE status IN ('ativo','trial')`).first() as Promise<any>,
    c.env.DB.prepare(`SELECT COUNT(*) as n FROM organizacoes WHERE status='ativo' AND plano!='trial'`).first() as Promise<any>,
    c.env.DB.prepare(`SELECT COUNT(*) as n FROM leads`).first() as Promise<any>,
    c.env.DB.prepare(`SELECT COUNT(*) as n FROM leads WHERE status='novo' AND date(criado_em)>=date('now','-7 days')`).first() as Promise<any>,
    c.env.DB.prepare(`SELECT COALESCE(SUM(valor_mensalidade),0) as v FROM organizacoes WHERE status='ativo' AND plano!='trial'`).first() as Promise<any>,
  ])
  return c.json(ok({
    orgs: { total: orgs?.n||0, trial: trials?.n||0, ativos: ativos?.n||0, pagos: pagos?.n||0 },
    leads: { total: leads_total?.n||0, novos_7d: leads_novos?.n||0 },
    financeiro: { mrr: mrr?.v||0, arr: (mrr?.v||0) * 12 },
  }))
})

// ════════════════════════════════════════════════════════════
// SAAS — BILLING / PLANOS
// ════════════════════════════════════════════════════════════

app.get('/api/saas/planos', async (c) => {
  return c.json(ok([
    {
      id: 'starter', nome: 'Starter', preco: 890, moeda: 'BRL',
      usuarios_max: 5, storage_gb: 5,
      modulos: ['contratos','os','compras','fornecedores','idf','financeiro','relatorios'],
      descricao: 'Ideal para pequenas empreiteiras',
    },
    {
      id: 'professional', nome: 'Professional', preco: 2490, moeda: 'BRL',
      usuarios_max: 20, storage_gb: 50, popular: true,
      modulos: ['contratos','os','compras','fornecedores','idf','financeiro','relatorios',
                'gantt','projetos','ssma','crm','proposta_comercial','equipe'],
      descricao: 'Ideal para mineradoras e construtoras médias',
    },
    {
      id: 'enterprise', nome: 'Enterprise', preco: 6900, moeda: 'BRL',
      usuarios_max: 999, storage_gb: 500,
      modulos: ['all'],
      descricao: 'Para grandes grupos industriais',
      extras: ['sso','api_publica','white_label','sla_garantido','gerente_conta'],
    },
  ]))
})

// Upgrade de plano
app.post('/api/saas/orgs/:id/upgrade', async (c) => {
  const id = c.req.param('id')
  const { plano, motivo } = await body(c)
  const precos: Record<string, number> = { starter: 890, professional: 2490, enterprise: 6900 }
  const limites: Record<string, [number, number]> = {
    starter: [5, 5], professional: [20, 50], enterprise: [999, 500]
  }
  const [umax, sgb] = limites[plano] || [5, 5]
  await c.env.DB.prepare(
    `UPDATE organizacoes SET plano=?,status='ativo',usuarios_max=?,storage_gb=?,
     valor_mensalidade=?,data_renovacao=?,atualizado_em=? WHERE id=?`
  ).bind(
    plano, umax, sgb, precos[plano]||890,
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    now(), id
  ).run()
  await c.env.DB.prepare(
    `INSERT INTO logs_sistema(id,usuario_nome,acao,modulo,descricao) VALUES(?,?,?,?,?)`
  ).bind(uid('log'), 'Sistema', 'Upgrade', 'saas', `Org ${id} → plano ${plano}${motivo?' – '+motivo:''}`).run()
  return c.json(ok({ plano, valor: precos[plano]||890 }))
})

// ════════════════════════════════════════════════════════════
// SAAS — EXCLUSÃO DE DADOS (LGPD Art. 18)
// ════════════════════════════════════════════════════════════

app.delete('/api/saas/orgs/:id/dados', async (c) => {
  const id = c.req.param('id')
  const { motivo, confirmacao } = await body(c)
  if (confirmacao !== 'CONFIRMAR_EXCLUSAO') {
    return c.json(err('Confirmação inválida. Envie confirmacao: "CONFIRMAR_EXCLUSAO"'), 400)
  }
  // Marca org como excluída (soft delete + anonimização)
  await c.env.DB.prepare(
    `UPDATE organizacoes SET status='excluido',nome='[EXCLUIDO]',email='[EXCLUIDO]',cnpj='[EXCLUIDO]',
     telefone=NULL,atualizado_em=?,motivo_exclusao=? WHERE id=?`
  ).bind(now(), motivo||'Solicitação LGPD', id).run()
  // Anonimiza usuários da org
  await c.env.DB.prepare(
    `UPDATE usuarios SET nome='[ANONIMIZADO]',email='anonimizado-'||id||'@excluido.local',
     senha_hash='[EXCLUIDO]',ativo=0,atualizado_em=?
     WHERE id IN (SELECT usuario_id FROM usuarios_org WHERE org_id=?)`
  ).bind(now(), id).run()
  await c.env.DB.prepare(
    `INSERT INTO logs_sistema(id,usuario_nome,acao,modulo,descricao) VALUES(?,?,?,?,?)`
  ).bind(uid('log'), 'Sistema', 'Exclusao_LGPD', 'saas', `Dados da org ${id} excluídos por solicitação LGPD`).run()
  return c.json(ok({ excluido: true, mensagem: 'Dados anonimizados conforme LGPD Art. 18' }))
})

// ════════════════════════════════════════════════════════════
// SAAS — HEALTH CHECK
// ════════════════════════════════════════════════════════════
app.get('/api/health', (c) => c.json({ status: 'ok', ts: now(), version: '2.0.0-saas' }))
app.get('/api/version', (c) => c.json({ version: '2.0.0', saas: true, multiTenant: true, lgpd: true, region: 'sa-east-1' }))

// ════════════════════════════════════════════════════════════
// SAAS — ONBOARDING (registro de nova organização)
// ════════════════════════════════════════════════════════════

app.post('/api/saas/onboarding', async (c) => {
  const d = await body(c)
  const { empresa, cnpj, telefone, segmento, nome, email, senha, cargo, lgpd_aceito, lgpd_data, plano, origem } = d

  if (!empresa || !email || !nome || !senha) return c.json(err('Campos obrigatórios: empresa, email, nome, senha'), 400)
  if (!lgpd_aceito) return c.json(err('Consentimento LGPD obrigatório'), 400)

  // Verificar se e-mail já existe
  const existente = await c.env.DB.prepare(`SELECT id FROM usuarios WHERE email=?`).bind(email.toLowerCase()).first()
  if (existente) return c.json(err('E-mail já cadastrado'), 409)

  // Criar slug único da org
  const slug = empresa.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 40) + '-' + Date.now().toString(36)
  const orgId = uid('org')
  const trialFim = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()

  const planosMaxUsers: Record<string, number> = { trial: 3, starter: 5, professional: 20, enterprise: 999 }
  const planosStorage: Record<string, number> = { trial: 1, starter: 5, professional: 50, enterprise: 500 }
  const usersMax = planosMaxUsers[plano || 'trial'] || 3
  const storageGb = planosStorage[plano || 'trial'] || 1

  // Criar organização
  await c.env.DB.prepare(
    `INSERT INTO organizacoes(id,nome,slug,cnpj,email,telefone,segmento,plano,status,trial_fim,usuarios_max,storage_gb,criado_em)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(orgId, empresa, slug, cnpj || null, email, telefone || null, segmento || null, plano || 'trial', 'trial', trialFim, usersMax, storageGb, now()).run()

  // Criar usuário admin
  const userId = uid('usr')
  const tokenSessao = uid('tok')
  const expira = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()
  const senhaHash = `$2b$10$onboarding-${senha.slice(0,4)}`

  await c.env.DB.prepare(
    `INSERT INTO usuarios(id,nome,email,senha_hash,perfil,ativo,criado_em) VALUES(?,?,?,?,?,?,?)`
  ).bind(userId, nome, email.toLowerCase(), senhaHash, 'admin', 1, now()).run()

  // Vincular usuário à org
  await c.env.DB.prepare(
    `INSERT INTO usuarios_org(id,org_id,usuario_id,papel) VALUES(?,?,?,?)`
  ).bind(uid('uorg'), orgId, userId, 'admin').run()

  // Criar sessão
  await c.env.DB.prepare(
    `INSERT INTO sessoes(token,usuario_id,expira_em,ip) VALUES(?,?,?,?)`
  ).bind(tokenSessao, userId, expira, c.req.header('CF-Connecting-IP') || '').run()

  // Registrar lead
  try {
    await c.env.DB.prepare(
      `INSERT OR IGNORE INTO leads(id,nome,email,empresa,telefone,segmento,plano_interesse,lgpd_aceito,lgpd_data,status,origem,org_id,criado_em)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(uid('lead'), nome, email, empresa, telefone || null, segmento || null, plano || 'trial', 1, lgpd_data || now(), 'convertido', origem || 'onboarding', orgId, now()).run()
  } catch { /* ignora duplicata */ }

  // Log
  await c.env.DB.prepare(
    `INSERT INTO logs_sistema(id,usuario_id,usuario_nome,acao,modulo,descricao) VALUES(?,?,?,?,?,?)`
  ).bind(uid('log'), userId, nome, 'Onboarding', 'saas', `Nova org: ${empresa} (${plano || 'trial'})`).run()

  // Notificação
  try {
    await c.env.DB.prepare(
      `INSERT INTO notificacoes(id,org_id,usuario_id,tipo,titulo,mensagem) VALUES(?,?,?,?,?,?)`
    ).bind(uid('notif'), orgId, userId, 'success', 'Bem-vindo ao OpsCore ERP!', `Trial de 14 dias ativo.`).run()
  } catch { /* ignora */ }

  return c.json(ok({
    token: tokenSessao,
    org: { id: orgId, nome: empresa, slug, plano: plano || 'trial', status: 'trial', trial_fim: trialFim },
    user: { id: userId, nome, email: email.toLowerCase(), perfil: 'admin' },
  }))
})

// ════════════════════════════════════════════════════════════
// SAAS — ADMIN — Orgs, Leads, Billing
// ════════════════════════════════════════════════════════════

app.get('/api/saas/admin/orgs', async (c) => {
  const user = await getUser(c)
  if (!user || user.perfil !== 'admin') return c.json(err('Acesso negado', 403), 403)
  const rows = await c.env.DB.prepare(
    `SELECT o.*, (SELECT COUNT(*) FROM usuarios_org uo WHERE uo.org_id=o.id AND uo.ativo=1) as total_usuarios
     FROM organizacoes o WHERE o.status != 'excluido' ORDER BY o.criado_em DESC`
  ).all()
  return c.json(ok(rows.results || []))
})

app.get('/api/saas/admin/stats', async (c) => {
  const user = await getUser(c)
  if (!user || user.perfil !== 'admin') return c.json(err('Acesso negado', 403), 403)
  const [orgs, trials, ativos, pagos, leads_total, leads_novos, mrr] = await Promise.all([
    c.env.DB.prepare(`SELECT COUNT(*) as n FROM organizacoes WHERE status!='excluido'`).first() as Promise<any>,
    c.env.DB.prepare(`SELECT COUNT(*) as n FROM organizacoes WHERE status='trial'`).first() as Promise<any>,
    c.env.DB.prepare(`SELECT COUNT(*) as n FROM organizacoes WHERE status='ativo'`).first() as Promise<any>,
    c.env.DB.prepare(`SELECT COUNT(*) as n FROM organizacoes WHERE status='ativo' AND plano!='trial'`).first() as Promise<any>,
    c.env.DB.prepare(`SELECT COUNT(*) as n FROM leads`).first() as Promise<any>,
    c.env.DB.prepare(`SELECT COUNT(*) as n FROM leads WHERE status='novo' AND date(criado_em)>=date('now','-7 days')`).first() as Promise<any>,
    c.env.DB.prepare(`SELECT COALESCE(SUM(valor_mensalidade),0) as v FROM organizacoes WHERE status='ativo' AND plano!='trial'`).first() as Promise<any>,
  ])
  return c.json(ok({
    orgs: { total: orgs?.n || 0, trial: trials?.n || 0, ativos: ativos?.n || 0, pagos: pagos?.n || 0 },
    leads: { total: leads_total?.n || 0, novos_7d: leads_novos?.n || 0 },
    financeiro: { mrr: mrr?.v || 0, arr: (mrr?.v || 0) * 12 },
  }))
})

app.get('/api/saas/admin/leads', async (c) => {
  const user = await getUser(c)
  if (!user || user.perfil !== 'admin') return c.json(err('Acesso negado', 403), 403)
  const rows = await c.env.DB.prepare(`SELECT * FROM leads ORDER BY criado_em DESC LIMIT 200`).all()
  return c.json(ok(rows.results || []))
})

app.put('/api/saas/leads/:id', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json(err('Não autorizado', 401), 401)
  const id = c.req.param('id')
  const { status, notas, responsavel } = await body(c)
  await c.env.DB.prepare(
    `UPDATE leads SET status=COALESCE(?,status), notas=COALESCE(?,notas), responsavel=COALESCE(?,responsavel), atualizado_em=? WHERE id=?`
  ).bind(status || null, notas || null, responsavel || null, now(), id).run()
  return c.json(ok({ updated: true }))
})

app.get('/api/saas/admin/billing', async (c) => {
  const user = await getUser(c)
  if (!user || user.perfil !== 'admin') return c.json(err('Acesso negado', 403), 403)
  const rows = await c.env.DB.prepare(
    `SELECT b.*, o.nome as org_nome FROM billing_historico b
     LEFT JOIN organizacoes o ON o.id=b.org_id ORDER BY b.criado_em DESC LIMIT 200`
  ).all()
  return c.json(ok(rows.results || []))
})

// ════════════════════════════════════════════════════════════
// NOTIFICAÇÕES IN-APP
// ════════════════════════════════════════════════════════════

app.get('/api/notificacoes', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json(err('Não autorizado', 401), 401)
  const rows = await c.env.DB.prepare(
    `SELECT * FROM notificacoes WHERE usuario_id=? ORDER BY criado_em DESC LIMIT 50`
  ).bind(user.usuario_id).all()
  return c.json(ok(rows.results || []))
})

app.patch('/api/notificacoes/:id/lida', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json(err('Não autorizado', 401), 401)
  await c.env.DB.prepare(`UPDATE notificacoes SET lida=1 WHERE id=? AND usuario_id=?`).bind(c.req.param('id'), user.usuario_id).run()
  return c.json(ok({ lida: true }))
})

app.patch('/api/notificacoes/todas/lidas', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json(err('Não autorizado', 401), 401)
  await c.env.DB.prepare(`UPDATE notificacoes SET lida=1 WHERE usuario_id=?`).bind(user.usuario_id).run()
  return c.json(ok({ updated: true }))
})

// ════════════════════════════════════════════════════════════
// LGPD — Solicitações de Titulares (Art. 18)
// ════════════════════════════════════════════════════════════

app.get('/api/lgpd/solicitacoes', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json(err('Não autorizado', 401), 401)
  const rows = await c.env.DB.prepare(`SELECT * FROM lgpd_solicitacoes ORDER BY criado_em DESC`).all()
  return c.json(ok(rows.results || []))
})

app.post('/api/lgpd/solicitacoes', async (c) => {
  const user = await getUser(c)
  const { tipo, descricao } = await body(c)
  if (!tipo) return c.json(err('Tipo obrigatório'), 400)
  const prazo = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString()
  await c.env.DB.prepare(
    `INSERT INTO lgpd_solicitacoes(id,usuario_id,tipo,descricao,status,prazo,criado_em) VALUES(?,?,?,?,?,?,?)`
  ).bind(uid('lgpd'), user?.usuario_id || null, tipo, descricao || null, 'recebida', prazo, now()).run()
  return c.json(ok({ prazo, mensagem: 'Solicitação recebida. Prazo legal: 15 dias.' }))
})

// ════════════════════════════════════════════════════════════
// ALMOXARIFADO v2 – Itens, Movimentos, Empréstimos, Inventário
// ════════════════════════════════════════════════════════════

// ── helpers internos ──────────────────────────────────────────
async function almoxNextNum(db: D1Database, prefix: string): Promise<string> {
  const d = new Date()
  const ymd = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`
  const like = `${prefix}-${ymd}-%`
  let tbl = 'almox_movimentos'
  if (prefix === 'EMP') tbl = 'almox_emprestimos'
  if (prefix === 'INV') tbl = 'almox_inventario'
  try {
    const r = await db.prepare(`SELECT COUNT(*) AS n FROM ${tbl} WHERE numero LIKE ?`).bind(like).first<{n:number}>()
    const seq = String((r?.n || 0) + 1).padStart(4, '0')
    return `${prefix}-${ymd}-${seq}`
  } catch { return `${prefix}-${ymd}-0001` }
}

// ── ITENS (catálogo do almoxarifado) ─────────────────────────

// GET /api/almox/itens
app.get('/api/almox/itens', async (c) => {
  const q = c.req.query('q')
  const categoria = c.req.query('categoria')
  const tipo = c.req.query('tipo')
  let sql = `SELECT ai.*, f.nome AS fornecedor_nome_real FROM almox_itens ai
    LEFT JOIN fornecedores f ON ai.fornecedor_id = f.id WHERE ai.ativo=1`
  const params: any[] = []
  if (q) { sql += ` AND (ai.nome LIKE ? OR ai.codigo LIKE ? OR ai.descricao LIKE ?)`; params.push(`%${q}%`,`%${q}%`,`%${q}%`) }
  if (categoria) { sql += ` AND ai.categoria=?`; params.push(categoria) }
  if (tipo) { sql += ` AND ai.tipo=?`; params.push(tipo) }
  sql += ` ORDER BY ai.nome ASC LIMIT 500`
  try {
    const { results } = await c.env.DB.prepare(sql).bind(...params).all()
    return c.json(ok(results))
  } catch(e) { return c.json(ok([])) }
})

// GET /api/almox/itens/:id
app.get('/api/almox/itens/:id', async (c) => {
  const id = c.req.param('id')
  try {
    const item = await c.env.DB.prepare(`SELECT * FROM almox_itens WHERE id=?`).bind(id).first()
    if (!item) return c.json(err('Item não encontrado'), 404)
    const { results: movs } = await c.env.DB.prepare(
      `SELECT * FROM almox_movimentos WHERE item_id=? ORDER BY criado_em DESC LIMIT 100`
    ).bind(id).all()
    const { results: emps } = await c.env.DB.prepare(
      `SELECT * FROM almox_emprestimos WHERE item_id=? ORDER BY criado_em DESC LIMIT 50`
    ).bind(id).all()
    return c.json(ok({ ...item, movimentos: movs, emprestimos: emps }))
  } catch(e) { return c.json(err('Erro: '+String(e)), 500) }
})

// POST /api/almox/itens
app.post('/api/almox/itens', async (c) => {
  const d = await body(c)
  const user = await getUser(c)
  if (!d.nome || !d.codigo) return c.json(err('Nome e código são obrigatórios'), 400)
  const id = uid('ait')
  try {
    await c.env.DB.prepare(`
      INSERT INTO almox_itens (id,codigo,nome,descricao,categoria,tipo,unidade,estoque_atual,estoque_minimo,
        estoque_maximo,localizacao,fornecedor_id,fornecedor_nome,preco_unitario,numero_serie,patrimonio,
        observacoes,ativo,criado_por,criado_em)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?)
    `).bind(
      id, d.codigo, d.nome, d.descricao||null, d.categoria||'Geral', d.tipo||'Material',
      d.unidade||'UN', d.estoque_atual||0, d.estoque_minimo||0, d.estoque_maximo||0,
      d.localizacao||null, d.fornecedor_id||null, d.fornecedor_nome||null,
      d.preco_unitario||0, d.numero_serie||null, d.patrimonio||null,
      d.observacoes||null, user?.nome||null, now()
    ).run()
    return c.json(ok({ id, codigo: d.codigo }), 201)
  } catch(e) {
    if (String(e).includes('UNIQUE')) return c.json(err('Código já existe'), 409)
    return c.json(err('Erro: '+String(e)), 500)
  }
})

// PUT /api/almox/itens/:id
app.put('/api/almox/itens/:id', async (c) => {
  const id = c.req.param('id')
  const d = await body(c)
  try {
    await c.env.DB.prepare(`
      UPDATE almox_itens SET nome=?,descricao=?,categoria=?,tipo=?,unidade=?,estoque_minimo=?,
        estoque_maximo=?,localizacao=?,fornecedor_id=?,fornecedor_nome=?,preco_unitario=?,
        numero_serie=?,patrimonio=?,observacoes=?,ativo=?,atualizado_em=? WHERE id=?
    `).bind(
      d.nome, d.descricao||null, d.categoria||'Geral', d.tipo||'Material',
      d.unidade||'UN', d.estoque_minimo||0, d.estoque_maximo||0,
      d.localizacao||null, d.fornecedor_id||null, d.fornecedor_nome||null,
      d.preco_unitario||0, d.numero_serie||null, d.patrimonio||null,
      d.observacoes||null, d.ativo===false?0:1, now(), id
    ).run()
    return c.json(ok({ updated: true }))
  } catch(e) { return c.json(err('Erro: '+String(e)), 500) }
})

// ── MOVIMENTOS ────────────────────────────────────────────────

// GET /api/almox/movimentos
app.get('/api/almox/movimentos', async (c) => {
  const tipo = c.req.query('tipo')
  const itemId = c.req.query('item_id')
  const pedidoId = c.req.query('pedido_id')
  const recId = c.req.query('recebimento_id')
  const osId = c.req.query('os_id')
  const q = c.req.query('q')
  const limit = parseInt(c.req.query('limit')||'200')
  let sql = `SELECT am.*, ai.codigo AS item_codigo_real FROM almox_movimentos am
    LEFT JOIN almox_itens ai ON am.item_id = ai.id WHERE 1=1`
  const params: any[] = []
  if (tipo) { sql += ` AND am.tipo=?`; params.push(tipo) }
  if (itemId) { sql += ` AND am.item_id=?`; params.push(itemId) }
  if (pedidoId) { sql += ` AND am.pedido_id=?`; params.push(pedidoId) }
  if (recId) { sql += ` AND am.recebimento_id=?`; params.push(recId) }
  if (osId) { sql += ` AND am.os_id=?`; params.push(osId) }
  if (q) { sql += ` AND (am.item_nome LIKE ? OR am.nota_fiscal LIKE ? OR am.destinatario LIKE ? OR am.pedido_numero LIKE ?)`; params.push(`%${q}%`,`%${q}%`,`%${q}%`,`%${q}%`) }
  sql += ` ORDER BY am.criado_em DESC LIMIT ${limit}`
  try {
    const { results } = await c.env.DB.prepare(sql).bind(...params).all()
    return c.json(ok(results))
  } catch(e) { return c.json(ok([])) }
})

// POST /api/almox/movimentos  (entrada/saída/ajuste/transferência/devolução)
app.post('/api/almox/movimentos', async (c) => {
  const d = await body(c)
  const user = await getUser(c)
  if (!d.item_id || !d.tipo || d.quantidade == null) return c.json(err('item_id, tipo e quantidade são obrigatórios'), 400)
  const allowedTipos = ['Entrada','Saída','Transferência','Ajuste','Devolução']
  if (!allowedTipos.includes(d.tipo)) return c.json(err('Tipo inválido'), 400)
  try {
    // Busca saldo atual
    const item = await c.env.DB.prepare(`SELECT * FROM almox_itens WHERE id=?`).bind(d.item_id).first<any>()
    if (!item) return c.json(err('Item não encontrado'), 404)
    const saldoAntes = item.estoque_atual || 0
    const qty = parseFloat(d.quantidade)
    let saldoDepois: number
    if (d.tipo === 'Entrada' || d.tipo === 'Devolução') {
      saldoDepois = saldoAntes + qty
    } else if (d.tipo === 'Saída') {
      if (qty > saldoAntes) return c.json(err(`Saldo insuficiente. Disponível: ${saldoAntes}`), 400)
      saldoDepois = saldoAntes - qty
    } else if (d.tipo === 'Ajuste') {
      saldoDepois = parseFloat(d.quantidade_depois ?? d.quantidade)
    } else { // Transferência
      saldoDepois = saldoAntes - qty
    }
    const movId = uid('amv')
    const numero = await almoxNextNum(c.env.DB, 'MOV')
    await c.env.DB.prepare(`
      INSERT INTO almox_movimentos (id,numero,tipo,item_id,item_nome,item_codigo,quantidade,
        quantidade_antes,quantidade_depois,unidade,pedido_id,pedido_numero,recebimento_id,
        recebimento_numero,os_id,os_numero,projeto_id,projeto_nome,contrato_id,destinatario,
        destinatario_id,setor_destino,local_destino,nota_fiscal,valor_unitario,valor_total,
        fornecedor_id,fornecedor_nome,status_inspecao,obs_inspecao,observacoes,responsavel,
        responsavel_id,cp_gerado,emprestimo_id,criado_em)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      movId, numero, d.tipo, d.item_id, item.nome, item.codigo, qty,
      saldoAntes, saldoDepois, d.unidade||item.unidade||'UN',
      d.pedido_id||null, d.pedido_numero||null,
      d.recebimento_id||null, d.recebimento_numero||null,
      d.os_id||null, d.os_numero||null,
      d.projeto_id||null, d.projeto_nome||null, d.contrato_id||null,
      d.destinatario||null, d.destinatario_id||null,
      d.setor_destino||null, d.local_destino||null,
      d.nota_fiscal||null, d.valor_unitario||0, d.valor_total||0,
      d.fornecedor_id||null, d.fornecedor_nome||null,
      d.status_inspecao||'Conforme', d.obs_inspecao||null,
      d.observacoes||null,
      d.responsavel||user?.nome||'Sistema',
      d.responsavel_id||user?.usuario_id||null,
      0, d.emprestimo_id||null, now()
    ).run()
    // Atualiza saldo no item
    await c.env.DB.prepare(`UPDATE almox_itens SET estoque_atual=?,atualizado_em=? WHERE id=?`)
      .bind(saldoDepois, now(), d.item_id).run()
    return c.json(ok({ id: movId, numero, saldo_antes: saldoAntes, saldo_depois: saldoDepois }), 201)
  } catch(e) { return c.json(err('Erro: '+String(e)), 500) }
})

// ── EMPRÉSTIMOS / RETIRADAS ───────────────────────────────────

// GET /api/almox/emprestimos
app.get('/api/almox/emprestimos', async (c) => {
  const status = c.req.query('status')
  const itemId = c.req.query('item_id')
  const osId = c.req.query('os_id')
  const q = c.req.query('q')
  let sql = `SELECT ae.*, ai.codigo AS item_codigo_real FROM almox_emprestimos ae
    LEFT JOIN almox_itens ai ON ae.item_id = ai.id WHERE 1=1`
  const params: any[] = []
  if (status) { sql += ` AND ae.status=?`; params.push(status) }
  if (itemId) { sql += ` AND ae.item_id=?`; params.push(itemId) }
  if (osId) { sql += ` AND ae.os_id=?`; params.push(osId) }
  if (q) { sql += ` AND (ae.item_nome LIKE ? OR ae.retirado_por LIKE ? OR ae.os_numero LIKE ?)`; params.push(`%${q}%`,`%${q}%`,`%${q}%`) }
  sql += ` ORDER BY ae.criado_em DESC LIMIT 300`
  try {
    const { results } = await c.env.DB.prepare(sql).bind(...params).all()
    return c.json(ok(results))
  } catch(e) { return c.json(ok([])) }
})

// POST /api/almox/emprestimos  (registra retirada)
app.post('/api/almox/emprestimos', async (c) => {
  const d = await body(c)
  const user = await getUser(c)
  if (!d.item_id || !d.retirado_por || !d.quantidade) return c.json(err('item_id, retirado_por e quantidade obrigatórios'), 400)
  try {
    // Verifica saldo
    const item = await c.env.DB.prepare(`SELECT * FROM almox_itens WHERE id=?`).bind(d.item_id).first<any>()
    if (!item) return c.json(err('Item não encontrado'), 404)
    const saldoAntes = item.estoque_atual || 0
    const qty = parseFloat(d.quantidade)
    if (qty > saldoAntes) return c.json(err(`Saldo insuficiente. Disponível: ${saldoAntes}`), 400)
    const empId = uid('emp')
    const numero = await almoxNextNum(c.env.DB, 'EMP')
    // Cria movimento de saída vinculado
    const movId = uid('amv')
    const movNum = await almoxNextNum(c.env.DB, 'MOV')
    const saldoDepois = saldoAntes - qty
    await c.env.DB.prepare(`
      INSERT INTO almox_movimentos (id,numero,tipo,item_id,item_nome,item_codigo,quantidade,
        quantidade_antes,quantidade_depois,unidade,os_id,os_numero,projeto_id,projeto_nome,
        destinatario,destinatario_id,setor_destino,local_destino,observacoes,responsavel,
        responsavel_id,emprestimo_id,criado_em)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      movId, movNum, 'Saída', d.item_id, item.nome, item.codigo, qty,
      saldoAntes, saldoDepois, d.unidade||item.unidade||'UN',
      d.os_id||null, d.os_numero||null, d.projeto_id||null, d.projeto_nome||null,
      d.retirado_por, d.retirado_por_id||null, d.setor||null, d.local_uso||null,
      `Retirada – ${d.observacoes||''}`,
      user?.nome||d.retirado_por, user?.usuario_id||null, empId, now()
    ).run()
    await c.env.DB.prepare(`UPDATE almox_itens SET estoque_atual=?,atualizado_em=? WHERE id=?`)
      .bind(saldoDepois, now(), d.item_id).run()
    // Cria empréstimo
    await c.env.DB.prepare(`
      INSERT INTO almox_emprestimos (id,numero,item_id,item_nome,item_codigo,quantidade,unidade,
        retirado_por,retirado_por_id,setor,os_id,os_numero,projeto_id,projeto_nome,local_uso,
        status,data_retirada,data_prevista_dev,quantidade_devolvida,mov_saida_id,observacoes,criado_em)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      empId, numero, d.item_id, item.nome, item.codigo, qty, d.unidade||item.unidade||'UN',
      d.retirado_por, d.retirado_por_id||null, d.setor||null,
      d.os_id||null, d.os_numero||null, d.projeto_id||null, d.projeto_nome||null,
      d.local_uso||null, 'Ativo', now(), d.data_prevista_dev||null,
      0, movId, d.observacoes||null, now()
    ).run()
    return c.json(ok({ id: empId, numero, mov_id: movId, saldo_depois: saldoDepois }), 201)
  } catch(e) { return c.json(err('Erro: '+String(e)), 500) }
})

// POST /api/almox/emprestimos/:id/devolver
app.post('/api/almox/emprestimos/:id/devolver', async (c) => {
  const id = c.req.param('id')
  const d = await body(c)
  const user = await getUser(c)
  try {
    const emp = await c.env.DB.prepare(`SELECT * FROM almox_emprestimos WHERE id=?`).bind(id).first<any>()
    if (!emp) return c.json(err('Empréstimo não encontrado'), 404)
    if (emp.status === 'Devolvido') return c.json(err('Já devolvido'), 400)
    const qtyDev = parseFloat(d.quantidade_devolvida || emp.quantidade)
    const item = await c.env.DB.prepare(`SELECT * FROM almox_itens WHERE id=?`).bind(emp.item_id).first<any>()
    const saldoAntes = item?.estoque_atual || 0
    const saldoDepois = saldoAntes + qtyDev
    const movId = uid('amv')
    const movNum = await almoxNextNum(c.env.DB, 'MOV')
    await c.env.DB.prepare(`
      INSERT INTO almox_movimentos (id,numero,tipo,item_id,item_nome,item_codigo,quantidade,
        quantidade_antes,quantidade_depois,unidade,os_id,os_numero,destinatario,responsavel,
        responsavel_id,emprestimo_id,observacoes,criado_em)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      movId, movNum, 'Devolução', emp.item_id, emp.item_nome, emp.item_codigo, qtyDev,
      saldoAntes, saldoDepois, emp.unidade,
      emp.os_id||null, emp.os_numero||null, emp.retirado_por,
      user?.nome||emp.retirado_por, user?.usuario_id||null,
      id, d.obs||null, now()
    ).run()
    await c.env.DB.prepare(`UPDATE almox_itens SET estoque_atual=?,atualizado_em=? WHERE id=?`)
      .bind(saldoDepois, now(), emp.item_id).run()
    const totalDev = (emp.quantidade_devolvida||0) + qtyDev
    const novoStatus = totalDev >= emp.quantidade ? 'Devolvido' : 'Parcial'
    await c.env.DB.prepare(`
      UPDATE almox_emprestimos SET status=?,data_devolucao=?,quantidade_devolvida=?,
        devolvido_por=?,obs_devolucao=?,mov_devolucao_id=?,atualizado_em=? WHERE id=?
    `).bind(novoStatus, now(), totalDev, user?.nome||null, d.obs||null, movId, now(), id).run()
    return c.json(ok({ status: novoStatus, saldo_depois: saldoDepois }))
  } catch(e) { return c.json(err('Erro: '+String(e)), 500) }
})

// ── INVENTÁRIO ────────────────────────────────────────────────

// GET /api/almox/inventario
app.get('/api/almox/inventario', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      `SELECT * FROM almox_inventario ORDER BY criado_em DESC LIMIT 200`
    ).all()
    return c.json(ok(results))
  } catch(e) { return c.json(ok([])) }
})

// POST /api/almox/inventario  (registra contagem)
app.post('/api/almox/inventario', async (c) => {
  const d = await body(c)
  const user = await getUser(c)
  if (!d.item_id || d.qtd_contada == null) return c.json(err('item_id e qtd_contada obrigatórios'), 400)
  try {
    const item = await c.env.DB.prepare(`SELECT * FROM almox_itens WHERE id=?`).bind(d.item_id).first<any>()
    if (!item) return c.json(err('Item não encontrado'), 404)
    const id = uid('inv')
    const numero = await almoxNextNum(c.env.DB, 'INV')
    await c.env.DB.prepare(`
      INSERT INTO almox_inventario (id,numero,item_id,item_nome,qtd_sistema,qtd_contada,
        justificativa,responsavel,responsavel_id,status,criado_em)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      id, numero, d.item_id, item.nome, item.estoque_atual||0,
      parseFloat(d.qtd_contada), d.justificativa||null,
      user?.nome||null, user?.usuario_id||null, 'Pendente', now()
    ).run()
    return c.json(ok({ id, numero, diferenca: parseFloat(d.qtd_contada) - (item.estoque_atual||0) }), 201)
  } catch(e) { return c.json(err('Erro: '+String(e)), 500) }
})

// POST /api/almox/inventario/:id/aprovar  (aplica o ajuste)
app.post('/api/almox/inventario/:id/aprovar', async (c) => {
  const id = c.req.param('id')
  const user = await getUser(c)
  try {
    const inv = await c.env.DB.prepare(`SELECT * FROM almox_inventario WHERE id=?`).bind(id).first<any>()
    if (!inv) return c.json(err('Registro não encontrado'), 404)
    // Cria movimento de ajuste
    const movId = uid('amv')
    const movNum = await almoxNextNum(c.env.DB, 'MOV')
    const diff = inv.qtd_contada - inv.qtd_sistema
    const item = await c.env.DB.prepare(`SELECT * FROM almox_itens WHERE id=?`).bind(inv.item_id).first<any>()
    const saldoAntes = item?.estoque_atual || 0
    await c.env.DB.prepare(`
      INSERT INTO almox_movimentos (id,numero,tipo,item_id,item_nome,quantidade,quantidade_antes,
        quantidade_depois,observacoes,responsavel,responsavel_id,criado_em)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      movId, movNum, 'Ajuste', inv.item_id, inv.item_nome, Math.abs(diff),
      saldoAntes, inv.qtd_contada,
      `Ajuste de inventário ${inv.numero}: ${inv.justificativa||''}`,
      user?.nome||'Sistema', user?.usuario_id||null, now()
    ).run()
    await c.env.DB.prepare(`UPDATE almox_itens SET estoque_atual=?,atualizado_em=? WHERE id=?`)
      .bind(inv.qtd_contada, now(), inv.item_id).run()
    await c.env.DB.prepare(`UPDATE almox_inventario SET status='Aprovado',aprovado_por=? WHERE id=?`)
      .bind(user?.nome||'Sistema', id).run()
    return c.json(ok({ aprovado: true, novo_saldo: inv.qtd_contada }))
  } catch(e) { return c.json(err('Erro: '+String(e)), 500) }
})

// ── KPI resumo almoxarifado ────────────────────────────────────
app.get('/api/almox/kpi', async (c) => {
  try {
    const totalItens = await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM almox_itens WHERE ativo=1`).first<{n:number}>()
    const itensBaixo = await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM almox_itens WHERE ativo=1 AND estoque_atual < estoque_minimo AND estoque_minimo > 0`).first<{n:number}>()
    const totalEntradas = await c.env.DB.prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(valor_total),0) AS v FROM almox_movimentos WHERE tipo='Entrada'`).first<{n:number,v:number}>()
    const totalSaidas = await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM almox_movimentos WHERE tipo='Saída'`).first<{n:number}>()
    const empAtivos = await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM almox_emprestimos WHERE status='Ativo'`).first<{n:number}>()
    const empAtrasados = await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM almox_emprestimos WHERE status='Ativo' AND data_prevista_dev < datetime('now')`).first<{n:number}>()
    return c.json(ok({
      total_itens: totalItens?.n||0,
      itens_abaixo_minimo: itensBaixo?.n||0,
      total_entradas: totalEntradas?.n||0,
      valor_total_entradas: totalEntradas?.v||0,
      total_saidas: totalSaidas?.n||0,
      emprestimos_ativos: empAtivos?.n||0,
      emprestimos_atrasados: empAtrasados?.n||0
    }))
  } catch(e) { return c.json(ok({})) }
})

// ════════════════════════════════════════════════════════════
// PROXY CNPJ – Receita Federal via BrasilAPI (sem CORS)
// ════════════════════════════════════════════════════════════
app.get('/api/cnpj/:cnpj', async (c) => {
  const cnpj = c.req.param('cnpj').replace(/\D/g, '')
  if (cnpj.length !== 14) {
    return c.json(err('CNPJ inválido – 14 dígitos necessários'), 400)
  }

  // Tenta BrasilAPI primeiro, depois ReceitaWS
  const apis = [
    `https://brasilapi.com.br/api/cnpj/v1/${cnpj}`,
    `https://receitaws.com.br/v1/cnpj/${cnpj}`,
  ]

  for (const url of apis) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'FraserAlexanderERP/1.0' },
        signal: AbortSignal.timeout(10000),
      })
      if (!res.ok) continue
      const json = await res.json() as any
      if (!json || (!json.razao_social && !json.nome)) continue

      const data = {
        razao:    json.razao_social || json.nome || '',
        fantasia: json.nome_fantasia || json.fantasia || '',
        situacao: json.descricao_situacao_cadastral || json.situacao || 'ATIVA',
        cnpj_fmt: (json.cnpj || cnpj).replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5'),
        logradouro: json.logradouro || '',
        numero:   json.numero || '',
        bairro:   json.bairro || '',
        cidade:   json.municipio || json.municipio || '',
        uf:       json.uf || '',
        cep:      (json.cep || '').replace(/\D/g,'').replace(/(\d{5})(\d{3})/, '$1-$2'),
        email:    json.email || '',
        telefone: json.ddd_telefone_1
          ? `(${json.ddd_telefone_1}) ${(json.telefone_1||'').trim()}`
          : (json.telefone || ''),
        porte:    json.descricao_porte || json.porte || '',
        atividade: json.cnae_fiscal_descricao || (json.atividade_principal?.[0]?.text) || '',
        abertura:  json.data_inicio_atividade || json.abertura || '',
        capital:  json.capital_social || 0,
        natureza: json.descricao_natureza_juridica || json.natureza_juridica || '',
        ok: true,
        fonte: url.includes('brasilapi') ? 'BrasilAPI' : 'ReceitaWS',
      }
      return c.json(ok(data))
    } catch(e) {
      // Tenta próxima API
    }
  }

  return c.json(err('CNPJ não encontrado na Receita Federal'), 404)
})

// ════════════════════════════════════════════════════════════
// MÓDULOS ETAPAS 23-33 — Geração Comercial, CRM, Customer Portal,
// Data Platform, Enterprise Consolidation, Low-Code Forms,
// Notifications, Observability, Production Readiness, Workflows
// ════════════════════════════════════════════════════════════

// Helpers de dependência para os módulos
async function requireOrg(c: any): Promise<{ user: any; org: any }> {
  const user = await getUser(c)
  if (!user) throw new Error('Não autenticado')
  // Em modo SaaS, busca org do usuário; em modo single-tenant retorna org padrão
  let org: any = null
  try {
    org = await c.env.DB.prepare(
      `SELECT o.* FROM organizacoes o 
       JOIN usuarios_org uo ON uo.org_id=o.id 
       WHERE uo.usuario_id=? AND uo.ativo=1 LIMIT 1`
    ).bind(user.usuario_id).first()
  } catch {}
  // Fallback: usa org padrão ou cria estrutura mínima
  if (!org) {
    org = { id: 'default', nome: 'NEXUS ERP', plano: 'enterprise', status: 'ativo' }
  }
  return { user, org }
}

async function auditLog(c: any, input: any): Promise<void> {
  try {
    const user = await getUser(c)
    await c.env.DB.prepare(
      `INSERT INTO logs_sistema(id,usuario_id,usuario_nome,acao,modulo,descricao) VALUES(?,?,?,?,?,?)`
    ).bind(
      uid('log'),
      user?.usuario_id || null,
      user?.nome || 'Sistema',
      input.action || 'Ação',
      input.module || 'geral',
      JSON.stringify(input).slice(0, 500)
    ).run()
  } catch { /* não bloqueia */ }
}

const moduleDeps = { requireOrg, auditLog }

// Registra rotas de todos os módulos das etapas 23-33
try { registerContractBillingCsRoutes(app as any, moduleDeps) } catch(e) { console.error('ContractBilling:', e) }
try { registerCommercialGenerationRoutes(app as any, moduleDeps) } catch(e) { console.error('CommercialGen:', e) }
try { registerCrmPipelinePricingRoutes(app as any, moduleDeps) } catch(e) { console.error('CrmPipeline:', e) }
try { registerCustomerPortalRoutes(app as any, moduleDeps) } catch(e) { console.error('CustomerPortal:', e) }
try { registerDataPlatformIntegrationRoutes(app as any, moduleDeps) } catch(e) { console.error('DataPlatform:', e) }
try { registerEnterpriseConsolidationRoutes(app as any, moduleDeps) } catch(e) { console.error('EnterpriseConsolidation:', e) }
try { registerLowCodeFormBuilderRoutes(app as any, moduleDeps) } catch(e) { console.error('LowCodeFormBuilder:', e) }
try { registerNotificationsRoutes(app as any, moduleDeps) } catch(e) { console.error('Notifications:', e) }
try { registerObservabilitySecurityRoutes(app as any, moduleDeps) } catch(e) { console.error('ObservabilitySecurity:', e) }
try { registerProductionReadinessRoutes(app as any, moduleDeps) } catch(e) { console.error('ProductionReadiness:', e) }
try { registerWorkflowOrchestrationRoutes(app as any, moduleDeps) } catch(e) { console.error('WorkflowOrchestration:', e) }

// Cloudflare Pages serve automaticamente os arquivos estáticos
// O worker só lida com /api/* - o Pages faz fallback para index.html

export default app

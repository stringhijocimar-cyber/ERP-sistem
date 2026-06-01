// src/modules/workflow_sla_approval_orchestration.ts
// NEXUS ERP — Etapa 28: Motor de Workflow, SLA, Escalonamento, Aprovações Avançadas e Orquestração de Processos
//
// Integração:
// import { registerWorkflowOrchestrationRoutes } from './modules/workflow_sla_approval_orchestration';
// registerWorkflowOrchestrationRoutes(app, { requireOrg, auditLog });
//
// Regra crítica:
// este motor centraliza orquestração, mas não deve substituir validações específicas de cada módulo.
// Sempre registrar auditoria e preservar rastreabilidade.

import type { Hono } from 'hono';

type Ctx = any;
type Deps = {
  requireOrg: (c: Ctx) => Promise<{ user: any; org: any }>;
  auditLog?: (c: Ctx, input: any) => Promise<void>;
};

function uid(prefix: string) { return `${prefix}_${crypto.randomUUID()}`; }
function nowIso() { return new Date().toISOString(); }
async function body(c: Ctx) { try { return await c.req.json(); } catch { return {}; } }
function json(v: any) { return typeof v === 'string' ? v : JSON.stringify(v ?? {}); }
function parseJson(v: any, fallback: any = {}) { try { return typeof v === 'string' ? JSON.parse(v) : (v ?? fallback); } catch { return fallback; } }
function num(v: any, fallback = 0) { const n = Number(v); return Number.isFinite(n) ? n : fallback; }
function addHours(hours: number) { const d = new Date(); d.setHours(d.getHours() + hours); return d.toISOString(); }

const DEFAULT_WORKFLOWS = [
  {
    codigo:'wf_compras_aprovacao',
    nome:'Workflow de Aprovação de Compras',
    entidade_tipo:'purchase_request',
    states:[
      { codigo:'rascunho', nome:'Rascunho', tipo:'initial', is_initial:1, ordem:1, sla_hours:0 },
      { codigo:'em_aprovacao', nome:'Em Aprovação', tipo:'approval', ordem:2, sla_hours:24 },
      { codigo:'aprovado', nome:'Aprovado', tipo:'final', is_final:1, ordem:3, sla_hours:0 },
      { codigo:'rejeitado', nome:'Rejeitado', tipo:'final', is_final:1, ordem:4, sla_hours:0 }
    ],
    transitions:[
      { codigo:'submeter', nome:'Submeter para aprovação', from:'rascunho', to:'em_aprovacao', acao:'submeter', requires_approval:1 },
      { codigo:'aprovar', nome:'Aprovar', from:'em_aprovacao', to:'aprovado', acao:'aprovar' },
      { codigo:'rejeitar', nome:'Rejeitar', from:'em_aprovacao', to:'rejeitado', acao:'rejeitar', requires_reason:1 }
    ]
  },
  {
    codigo:'wf_cliente_entrega',
    nome:'Workflow de Entrega ao Cliente',
    entidade_tipo:'customer_delivery',
    states:[
      { codigo:'planejada', nome:'Planejada', tipo:'initial', is_initial:1, ordem:1, sla_hours:48 },
      { codigo:'em_execucao', nome:'Em Execução', ordem:2, sla_hours:120 },
      { codigo:'aguardando_cliente', nome:'Aguardando Cliente', tipo:'approval', ordem:3, sla_hours:72 },
      { codigo:'concluida', nome:'Concluída', tipo:'final', is_final:1, ordem:4 },
      { codigo:'cancelada', nome:'Cancelada', tipo:'final', is_final:1, ordem:5 }
    ],
    transitions:[
      { codigo:'iniciar', nome:'Iniciar execução', from:'planejada', to:'em_execucao', acao:'iniciar' },
      { codigo:'enviar_cliente', nome:'Enviar para cliente', from:'em_execucao', to:'aguardando_cliente', acao:'enviar_aprovacao', requires_approval:1 },
      { codigo:'aprovar_cliente', nome:'Aprovação do cliente', from:'aguardando_cliente', to:'concluida', acao:'aprovar' },
      { codigo:'cancelar', nome:'Cancelar', from:'planejada', to:'cancelada', acao:'cancelar', requires_reason:1 }
    ]
  }
];

async function audit(db: any, orgId: string, actorId: string | null, entityType: string, entityId: string, action: string, before?: any, after?: any, metadata?: any) {
  await db.prepare(`
    INSERT INTO workflow_audit_trail
    (id, org_id, entidade_tipo, entidade_id, action, actor_id, before_json, after_json, metadata_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(uid('waud'), orgId, entityType, entityId, action, actorId, before ? json(before) : null, after ? json(after) : null, metadata ? json(metadata) : null).run();
}

async function emitNotificationEvent(db: any, orgId: string, userId: string | null, evento: string, entidadeTipo: string, entidadeId: string, payload: any, prioridade='media') {
  try {
    await db.prepare(`
      INSERT INTO notification_events
      (id, org_id, evento, entidade_tipo, entidade_id, prioridade, payload_json, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'novo', ?)
    `).bind(uid('nevt'), orgId, evento, entidadeTipo, entidadeId, prioridade, json(payload), userId).run();
  } catch {}
}

async function findActiveDelegation(db: any, orgId: string, userId: string, scopeTipo='all', scopeRef?: string) {
  return await db.prepare(`
    SELECT * FROM approval_delegations
    WHERE org_id=? AND delegator_user_id=? AND status='ativo'
    AND datetime(starts_at) <= datetime('now') AND datetime(ends_at) >= datetime('now')
    AND (scope_tipo='all' OR scope_tipo=? OR scope_ref=?)
    ORDER BY created_at DESC LIMIT 1
  `).bind(orgId, userId, scopeTipo, scopeRef || null).first();
}

async function recalcApprovalStatus(db: any, orgId: string, approvalId: string) {
  const req = await db.prepare(`SELECT * FROM approval_requests_v2 WHERE org_id=? AND id=?`).bind(orgId, approvalId).first();
  if (!req) return null;
  const approvers = await db.prepare(`SELECT * FROM approval_request_approvers WHERE org_id=? AND approval_request_id=?`).bind(orgId, approvalId).all();
  const list = approvers.results || [];
  const rejected = list.some((a:any)=>a.status === 'rejeitado');
  const approvedCount = list.filter((a:any)=>a.status === 'aprovado').length;
  const required = 1;
  let status = req.status;
  if (rejected) status = 'rejeitado';
  else if (approvedCount >= required) status = 'aprovado';
  if (status !== req.status) {
    await db.prepare(`UPDATE approval_requests_v2 SET status=?, decisao=?, decided_at=?, updated_at=CURRENT_TIMESTAMP WHERE org_id=? AND id=?`).bind(status, status, nowIso(), orgId, approvalId).run();
  }
  return status;
}

export function registerWorkflowOrchestrationRoutes(app: Hono, deps: Deps) {
  const { requireOrg, auditLog } = deps;

  async function log(c: Ctx, action: string, entity: string, entityId: string, data?: any) {
    if (auditLog) await auditLog(c, { action, entity, entity_id: entityId, data });
  }

  app.post('/api/workflows/seed-defaults', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    let workflows = 0, states = 0, transitions = 0;
    for (const wf of DEFAULT_WORKFLOWS) {
      const wfId = uid('wf');
      await c.env.DB.prepare(`
        INSERT OR IGNORE INTO workflow_definitions
        (id, org_id, codigo, nome, entidade_tipo, versao, status, created_by)
        VALUES (?, ?, ?, ?, ?, 1, 'ativo', ?)
      `).bind(wfId, org.id, wf.codigo, wf.nome, wf.entidade_tipo, user.id).run();
      const actualWf = await c.env.DB.prepare(`SELECT * FROM workflow_definitions WHERE org_id=? AND codigo=? AND versao=1`).bind(org.id, wf.codigo).first();
      workflows++;
      const stateMap: Record<string,string> = {};
      for (const s of wf.states) {
        const sid = uid('wfs');
        await c.env.DB.prepare(`
          INSERT OR IGNORE INTO workflow_states
          (id, org_id, workflow_id, codigo, nome, tipo, ordem, is_initial, is_final, sla_hours)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(sid, org.id, actualWf.id, s.codigo, s.nome, s.tipo || 'normal', s.ordem, s.is_initial || 0, s.is_final || 0, s.sla_hours || 0).run();
        const actualState = await c.env.DB.prepare(`SELECT id FROM workflow_states WHERE org_id=? AND workflow_id=? AND codigo=?`).bind(org.id, actualWf.id, s.codigo).first();
        stateMap[s.codigo] = actualState.id;
        states++;
      }
      for (const t of wf.transitions) {
        await c.env.DB.prepare(`
          INSERT OR IGNORE INTO workflow_transitions
          (id, org_id, workflow_id, from_state_id, to_state_id, codigo, nome, acao, requires_reason, requires_approval, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ativo')
        `).bind(uid('wft'), org.id, actualWf.id, stateMap[t.from] || null, stateMap[t.to], t.codigo, t.nome, t.acao, t.requires_reason || 0, t.requires_approval || 0).run();
        transitions++;
      }
    }

    await c.env.DB.prepare(`
      INSERT OR IGNORE INTO approval_matrices
      (id, org_id, codigo, nome, entidade_tipo, criterio_json, status, created_by)
      VALUES (?, ?, 'compras_valor_padrao', 'Matriz de Alçada de Compras', 'purchase_request', '{"campo_valor":"valor_total"}', 'ativo', ?)
    `).bind(uid('amat'), org.id, user.id).run();
    const matrix = await c.env.DB.prepare(`SELECT * FROM approval_matrices WHERE org_id=? AND codigo='compras_valor_padrao'`).bind(org.id).first();
    const levels = [
      { nivel:1, nome:'Coordenador/Gestor', min:0, max:50000, role:'gestor_area', sla:24 },
      { nivel:2, nome:'Gerência', min:50000.01, max:250000, role:'gerente', sla:24 },
      { nivel:3, nome:'Diretoria', min:250000.01, max:null, role:'diretoria', sla:48 }
    ];
    for (const l of levels) {
      await c.env.DB.prepare(`
        INSERT INTO approval_matrix_levels
        (id, org_id, matrix_id, nivel, nome, min_value, max_value, required_approvals, approver_type, approver_ref, sla_hours)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'role', ?, ?)
      `).bind(uid('aml'), org.id, matrix.id, l.nivel, l.nome, l.min, l.max, l.role, l.sla).run();
    }

    await c.env.DB.prepare(`
      INSERT OR IGNORE INTO workflow_escalation_policies
      (id, org_id, codigo, nome, steps_json, status, created_by)
      VALUES (?, ?, 'default_sla', 'Escalonamento SLA Padrão', ?, 'ativo', ?)
    `).bind(uid('esc'), org.id, JSON.stringify([
      { at_percent:80, action:'notify_owner', evento:'sla_warning' },
      { at_percent:100, action:'notify_manager', evento:'sla_breach' },
      { at_percent:150, action:'notify_director', evento:'sla_critical' }
    ]), user.id).run();

    await log(c, 'SEED', 'workflow_defaults', org.id, { workflows, states, transitions });
    return c.json({ ok:true, workflows, states, transitions, approval_matrix:true });
  });

  app.get('/api/workflows/dashboard', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const db = c.env.DB;
    const [defs, inst, approvals, tasks, sla, delegations] = await Promise.all([
      db.prepare(`SELECT status, COUNT(*) qtd FROM workflow_definitions WHERE org_id=? GROUP BY status`).bind(org.id).all(),
      db.prepare(`SELECT status, COUNT(*) qtd FROM workflow_instances WHERE org_id=? GROUP BY status`).bind(org.id).all(),
      db.prepare(`SELECT status, COUNT(*) qtd FROM approval_requests_v2 WHERE org_id=? GROUP BY status`).bind(org.id).all(),
      db.prepare(`SELECT status, COUNT(*) qtd FROM workflow_tasks WHERE org_id=? GROUP BY status`).bind(org.id).all(),
      db.prepare(`SELECT status, event_type, COUNT(*) qtd FROM workflow_sla_events WHERE org_id=? GROUP BY status,event_type`).bind(org.id).all(),
      db.prepare(`SELECT status, COUNT(*) qtd FROM approval_delegations WHERE org_id=? GROUP BY status`).bind(org.id).all()
    ]);
    return c.json({ ok:true, definitions:defs.results || [], instances:inst.results || [], approvals:approvals.results || [], tasks:tasks.results || [], sla_events:sla.results || [], delegations:delegations.results || [] });
  });

  app.get('/api/workflows/definitions', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`SELECT * FROM workflow_definitions WHERE org_id=? ORDER BY entidade_tipo,nome`).bind(org.id).all();
    return c.json({ ok:true, items:rs.results || [] });
  });

  app.post('/api/workflows/definitions', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    if (!d.codigo || !d.nome || !d.entidade_tipo) return c.json({ ok:false, error:'codigo, nome e entidade_tipo são obrigatórios' }, 400);
    const id = uid('wf');
    await c.env.DB.prepare(`
      INSERT INTO workflow_definitions
      (id, org_id, codigo, nome, descricao, entidade_tipo, versao, status, config_json, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, org.id, d.codigo, d.nome, d.descricao || null, d.entidade_tipo, d.versao || 1, d.status || 'ativo', d.config_json ? json(d.config_json) : '{}', user.id).run();
    return c.json({ ok:true, id }, 201);
  });

  app.get('/api/workflows/definitions/:id/detail', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const id = c.req.param('id');
    const [wf, states, transitions] = await Promise.all([
      c.env.DB.prepare(`SELECT * FROM workflow_definitions WHERE org_id=? AND id=?`).bind(org.id, id).first(),
      c.env.DB.prepare(`SELECT * FROM workflow_states WHERE org_id=? AND workflow_id=? ORDER BY ordem`).bind(org.id, id).all(),
      c.env.DB.prepare(`SELECT * FROM workflow_transitions WHERE org_id=? AND workflow_id=?`).bind(org.id, id).all()
    ]);
    if (!wf) return c.json({ ok:false, error:'Workflow não encontrado' }, 404);
    return c.json({ ok:true, workflow:wf, states:states.results || [], transitions:transitions.results || [] });
  });

  app.post('/api/workflows/states', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const d = await body(c);
    if (!d.workflow_id || !d.codigo || !d.nome) return c.json({ ok:false, error:'workflow_id, codigo e nome são obrigatórios' }, 400);
    const id = uid('wfs');
    await c.env.DB.prepare(`
      INSERT INTO workflow_states
      (id, org_id, workflow_id, codigo, nome, tipo, ordem, is_initial, is_final, sla_hours, config_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, org.id, d.workflow_id, d.codigo, d.nome, d.tipo || 'normal', d.ordem || 1, d.is_initial ? 1 : 0, d.is_final ? 1 : 0, num(d.sla_hours,0), d.config_json ? json(d.config_json) : '{}').run();
    return c.json({ ok:true, id }, 201);
  });

  app.post('/api/workflows/transitions', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const d = await body(c);
    if (!d.workflow_id || !d.to_state_id || !d.codigo || !d.nome) return c.json({ ok:false, error:'workflow_id, to_state_id, codigo e nome são obrigatórios' }, 400);
    const id = uid('wft');
    await c.env.DB.prepare(`
      INSERT INTO workflow_transitions
      (id, org_id, workflow_id, from_state_id, to_state_id, codigo, nome, acao, requires_reason, requires_approval, condition_json, automation_json, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, org.id, d.workflow_id, d.from_state_id || null, d.to_state_id, d.codigo, d.nome, d.acao || 'avancar', d.requires_reason ? 1 : 0, d.requires_approval ? 1 : 0, d.condition_json ? json(d.condition_json) : '{}', d.automation_json ? json(d.automation_json) : '{}', d.status || 'ativo').run();
    return c.json({ ok:true, id }, 201);
  });

  app.post('/api/workflows/instances/start', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    if (!d.entidade_tipo || !d.entidade_id) return c.json({ ok:false, error:'entidade_tipo e entidade_id são obrigatórios' }, 400);
    let wf = null;
    if (d.workflow_id) wf = await c.env.DB.prepare(`SELECT * FROM workflow_definitions WHERE org_id=? AND id=?`).bind(org.id, d.workflow_id).first();
    else wf = await c.env.DB.prepare(`SELECT * FROM workflow_definitions WHERE org_id=? AND entidade_tipo=? AND status='ativo' ORDER BY versao DESC LIMIT 1`).bind(org.id, d.entidade_tipo).first();
    if (!wf) return c.json({ ok:false, error:'Workflow ativo não encontrado para entidade_tipo' }, 404);
    const state = await c.env.DB.prepare(`SELECT * FROM workflow_states WHERE org_id=? AND workflow_id=? AND is_initial=1 ORDER BY ordem LIMIT 1`).bind(org.id, wf.id).first();
    if (!state) return c.json({ ok:false, error:'Workflow sem estado inicial' }, 400);
    const due = state.sla_hours ? addHours(Number(state.sla_hours)) : null;
    const id = uid('wfi');
    await c.env.DB.prepare(`
      INSERT OR REPLACE INTO workflow_instances
      (id, org_id, workflow_id, entidade_tipo, entidade_id, current_state_id, status, prioridade, started_by, due_at, metadata_json, updated_at)
      VALUES (COALESCE((SELECT id FROM workflow_instances WHERE org_id=? AND entidade_tipo=? AND entidade_id=? AND workflow_id=?), ?), ?, ?, ?, ?, ?, 'em_andamento', ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(org.id, d.entidade_tipo, d.entidade_id, wf.id, id, org.id, wf.id, d.entidade_tipo, d.entidade_id, state.id, d.prioridade || 'media', user.id, due, d.metadata_json ? json(d.metadata_json) : '{}').run();

    const actual = await c.env.DB.prepare(`SELECT * FROM workflow_instances WHERE org_id=? AND entidade_tipo=? AND entidade_id=? AND workflow_id=?`).bind(org.id, d.entidade_tipo, d.entidade_id, wf.id).first();
    await audit(c.env.DB, org.id, user.id, d.entidade_tipo, d.entidade_id, 'workflow_start', null, actual, { workflow:wf.codigo, state:state.codigo });
    await emitNotificationEvent(c.env.DB, org.id, user.id, 'workflow_started', d.entidade_tipo, d.entidade_id, { workflow:wf.nome, state:state.nome, entidade_id:d.entidade_id }, d.prioridade || 'media');
    return c.json({ ok:true, id:actual.id, workflow_id:wf.id, state:state.codigo, due_at:due }, 201);
  });

  app.post('/api/workflows/instances/:id/transition', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const id = c.req.param('id');
    const d = await body(c);
    if (!d.transition_id && !d.acao) return c.json({ ok:false, error:'transition_id ou acao é obrigatório' }, 400);
    const inst = await c.env.DB.prepare(`SELECT * FROM workflow_instances WHERE org_id=? AND id=?`).bind(org.id, id).first();
    if (!inst) return c.json({ ok:false, error:'Instância não encontrada' }, 404);
    let transition = null;
    if (d.transition_id) transition = await c.env.DB.prepare(`SELECT * FROM workflow_transitions WHERE org_id=? AND id=?`).bind(org.id, d.transition_id).first();
    else transition = await c.env.DB.prepare(`
      SELECT * FROM workflow_transitions
      WHERE org_id=? AND workflow_id=? AND acao=? AND (from_state_id=? OR from_state_id IS NULL) AND status='ativo'
      ORDER BY created_at DESC LIMIT 1
    `).bind(org.id, inst.workflow_id, d.acao, inst.current_state_id).first();
    if (!transition) return c.json({ ok:false, error:'Transição não encontrada' }, 404);
    if (transition.requires_reason && !d.comentario) return c.json({ ok:false, error:'Esta transição exige comentário/justificativa' }, 400);

    const toState = await c.env.DB.prepare(`SELECT * FROM workflow_states WHERE org_id=? AND id=?`).bind(org.id, transition.to_state_id).first();
    const due = toState?.sla_hours ? addHours(Number(toState.sla_hours)) : null;
    const newStatus = toState?.is_final ? 'finalizado' : 'em_andamento';

    await c.env.DB.prepare(`
      UPDATE workflow_instances
      SET current_state_id=?, status=?, finished_at=?, due_at=?, updated_at=CURRENT_TIMESTAMP
      WHERE org_id=? AND id=?
    `).bind(toState.id, newStatus, toState.is_final ? nowIso() : null, due, org.id, id).run();

    await c.env.DB.prepare(`
      INSERT INTO workflow_transition_history
      (id, org_id, instance_id, transition_id, from_state_id, to_state_id, acao, comentario, performed_by, metadata_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(uid('wfh'), org.id, id, transition.id, inst.current_state_id, toState.id, transition.acao, d.comentario || null, user.id, d.metadata_json ? json(d.metadata_json) : null).run();

    await audit(c.env.DB, org.id, user.id, inst.entidade_tipo, inst.entidade_id, 'workflow_transition', { state_id:inst.current_state_id }, { state_id:toState.id, status:newStatus }, { transition:transition.codigo });
    await emitNotificationEvent(c.env.DB, org.id, user.id, 'workflow_transitioned', inst.entidade_tipo, inst.entidade_id, { transition:transition.nome, state:toState.nome, entidade_id:inst.entidade_id }, inst.prioridade);
    return c.json({ ok:true, id, state:toState.codigo, status:newStatus, due_at:due });
  });

  app.get('/api/workflows/instances', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`
      SELECT i.*, wf.codigo AS workflow_codigo, wf.nome AS workflow_nome, st.codigo AS state_codigo, st.nome AS state_nome
      FROM workflow_instances i
      JOIN workflow_definitions wf ON wf.id=i.workflow_id
      LEFT JOIN workflow_states st ON st.id=i.current_state_id
      WHERE i.org_id=?
      ORDER BY i.created_at DESC
      LIMIT 300
    `).bind(org.id).all();
    return c.json({ ok:true, items:rs.results || [] });
  });

  app.get('/api/workflows/instances/:id/history', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`SELECT * FROM workflow_transition_history WHERE org_id=? AND instance_id=? ORDER BY performed_at DESC`).bind(org.id, c.req.param('id')).all();
    return c.json({ ok:true, items:rs.results || [] });
  });

  app.post('/api/approvals/matrices', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    if (!d.codigo || !d.nome || !d.entidade_tipo) return c.json({ ok:false, error:'codigo, nome e entidade_tipo são obrigatórios' }, 400);
    const id = uid('amat');
    await c.env.DB.prepare(`
      INSERT INTO approval_matrices
      (id, org_id, codigo, nome, entidade_tipo, criterio_json, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, org.id, d.codigo, d.nome, d.entidade_tipo, d.criterio_json ? json(d.criterio_json) : '{}', d.status || 'ativo', user.id).run();
    return c.json({ ok:true, id }, 201);
  });

  app.get('/api/approvals/matrices', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`SELECT * FROM approval_matrices WHERE org_id=? ORDER BY entidade_tipo,nome`).bind(org.id).all();
    return c.json({ ok:true, items:rs.results || [] });
  });

  app.post('/api/approvals/request', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    if (!d.entidade_tipo || !d.entidade_id || !d.titulo) return c.json({ ok:false, error:'entidade_tipo, entidade_id e titulo são obrigatórios' }, 400);
    let matrix = null;
    if (d.matrix_id) matrix = await c.env.DB.prepare(`SELECT * FROM approval_matrices WHERE org_id=? AND id=?`).bind(org.id, d.matrix_id).first();
    else matrix = await c.env.DB.prepare(`SELECT * FROM approval_matrices WHERE org_id=? AND entidade_tipo=? AND status='ativo' ORDER BY created_at DESC LIMIT 1`).bind(org.id, d.entidade_tipo).first();
    if (!matrix) return c.json({ ok:false, error:'Matriz de aprovação não encontrada' }, 404);

    const value = num(d.valor_referencia, 0);
    let level = await c.env.DB.prepare(`
      SELECT * FROM approval_matrix_levels
      WHERE org_id=? AND matrix_id=? AND min_value <= ? AND (max_value IS NULL OR max_value >= ?)
      ORDER BY nivel ASC LIMIT 1
    `).bind(org.id, matrix.id, value, value).first();
    if (!level) level = await c.env.DB.prepare(`SELECT * FROM approval_matrix_levels WHERE org_id=? AND matrix_id=? ORDER BY nivel ASC LIMIT 1`).bind(org.id, matrix.id).first();
    if (!level) return c.json({ ok:false, error:'Matriz sem níveis' }, 400);

    const due = addHours(num(level.sla_hours, 24));
    const id = uid('aprv2');
    await c.env.DB.prepare(`
      INSERT INTO approval_requests_v2
      (id, org_id, workflow_instance_id, entidade_tipo, entidade_id, matrix_id, level_id, nivel, titulo, descricao, valor_referencia, moeda, status, requested_by, due_at, metadata_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendente', ?, ?, ?)
    `).bind(id, org.id, d.workflow_instance_id || null, d.entidade_tipo, d.entidade_id, matrix.id, level.id, level.nivel, d.titulo, d.descricao || null, value, d.moeda || 'BRL', user.id, due, d.metadata_json ? json(d.metadata_json) : '{}').run();

    if (level.approver_type === 'user') {
      const del = await findActiveDelegation(c.env.DB, org.id, level.approver_ref, d.entidade_tipo, d.entidade_id);
      await c.env.DB.prepare(`
        INSERT INTO approval_request_approvers
        (id, org_id, approval_request_id, approver_user_id, approver_label, delegated_from_user_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(uid('apra'), org.id, id, del?.delegate_user_id || level.approver_ref, level.nome, del ? level.approver_ref : null).run();
    } else {
      await c.env.DB.prepare(`
        INSERT INTO approval_request_approvers
        (id, org_id, approval_request_id, approver_role, approver_label)
        VALUES (?, ?, ?, ?, ?)
      `).bind(uid('apra'), org.id, id, level.approver_ref, level.nome).run();
    }

    await audit(c.env.DB, org.id, user.id, d.entidade_tipo, d.entidade_id, 'approval_requested', null, { approval_id:id, nivel:level.nivel, value }, { matrix:matrix.codigo });
    await emitNotificationEvent(c.env.DB, org.id, user.id, 'approval_pending', d.entidade_tipo, d.entidade_id, { titulo:d.titulo, due_date:due, valor_referencia:value }, 'alta');
    return c.json({ ok:true, id, nivel:level.nivel, due_at:due, approver_type:level.approver_type, approver_ref:level.approver_ref }, 201);
  });

  app.get('/api/approvals/requests', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`
      SELECT r.*, m.codigo AS matrix_codigo, l.nome AS level_nome
      FROM approval_requests_v2 r
      LEFT JOIN approval_matrices m ON m.id=r.matrix_id
      LEFT JOIN approval_matrix_levels l ON l.id=r.level_id
      WHERE r.org_id=?
      ORDER BY r.created_at DESC
      LIMIT 300
    `).bind(org.id).all();
    return c.json({ ok:true, items:rs.results || [] });
  });

  app.post('/api/approvals/requests/:id/decide', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const id = c.req.param('id');
    const d = await body(c);
    if (!['aprovar','rejeitar'].includes(d.decisao)) return c.json({ ok:false, error:'decisão inválida' }, 400);
    const req = await c.env.DB.prepare(`SELECT * FROM approval_requests_v2 WHERE org_id=? AND id=?`).bind(org.id, id).first();
    if (!req) return c.json({ ok:false, error:'Solicitação não encontrada' }, 404);
    const status = d.decisao === 'aprovar' ? 'aprovado' : 'rejeitado';
    const approver = await c.env.DB.prepare(`
      SELECT * FROM approval_request_approvers
      WHERE org_id=? AND approval_request_id=? AND status='pendente'
      ORDER BY created_at ASC LIMIT 1
    `).bind(org.id, id).first();
    if (approver) {
      await c.env.DB.prepare(`
        UPDATE approval_request_approvers
        SET status=?, decisao=?, comentario=?, decided_by=?, decided_at=?
        WHERE org_id=? AND id=?
      `).bind(status, d.decisao, d.comentario || null, user.id, nowIso(), org.id, approver.id).run();
    }
    await c.env.DB.prepare(`
      UPDATE approval_requests_v2
      SET status=?, decisao=?, comentario=?, decided_by=?, decided_at=?, updated_at=CURRENT_TIMESTAMP
      WHERE org_id=? AND id=?
    `).bind(status, d.decisao, d.comentario || null, user.id, nowIso(), org.id, id).run();

    await audit(c.env.DB, org.id, user.id, req.entidade_tipo, req.entidade_id, 'approval_decided', { status:req.status }, { status, decisao:d.decisao }, { approval_id:id });
    await emitNotificationEvent(c.env.DB, org.id, user.id, d.decisao === 'aprovar' ? 'approval_approved' : 'approval_rejected', req.entidade_tipo, req.entidade_id, { titulo:req.titulo, decisao:d.decisao }, 'alta');
    return c.json({ ok:true, id, status });
  });

  app.post('/api/approvals/delegations', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    if (!d.delegator_user_id || !d.delegate_user_id || !d.starts_at || !d.ends_at) return c.json({ ok:false, error:'delegator_user_id, delegate_user_id, starts_at e ends_at são obrigatórios' }, 400);
    const id = uid('adel');
    await c.env.DB.prepare(`
      INSERT INTO approval_delegations
      (id, org_id, delegator_user_id, delegate_user_id, scope_tipo, scope_ref, starts_at, ends_at, motivo, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, org.id, d.delegator_user_id, d.delegate_user_id, d.scope_tipo || 'all', d.scope_ref || null, d.starts_at, d.ends_at, d.motivo || null, d.status || 'ativo', user.id).run();
    return c.json({ ok:true, id }, 201);
  });

  app.get('/api/approvals/delegations', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`SELECT * FROM approval_delegations WHERE org_id=? ORDER BY created_at DESC`).bind(org.id).all();
    return c.json({ ok:true, items:rs.results || [] });
  });

  app.post('/api/workflow/tasks', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    if (!d.titulo) return c.json({ ok:false, error:'titulo é obrigatório' }, 400);
    const id = uid('wtask');
    await c.env.DB.prepare(`
      INSERT INTO workflow_tasks
      (id, org_id, workflow_instance_id, entidade_tipo, entidade_id, titulo, descricao, tipo, status, prioridade, assigned_to, assigned_role, due_at, automation_json, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pendente', ?, ?, ?, ?, ?, ?)
    `).bind(id, org.id, d.workflow_instance_id || null, d.entidade_tipo || null, d.entidade_id || null, d.titulo, d.descricao || null, d.tipo || 'manual', d.prioridade || 'media', d.assigned_to || null, d.assigned_role || null, d.due_at || null, d.automation_json ? json(d.automation_json) : '{}', user.id).run();
    return c.json({ ok:true, id }, 201);
  });

  app.get('/api/workflow/tasks', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`SELECT * FROM workflow_tasks WHERE org_id=? ORDER BY COALESCE(due_at, created_at) ASC LIMIT 300`).bind(org.id).all();
    return c.json({ ok:true, items:rs.results || [] });
  });

  app.post('/api/workflow/tasks/:id/complete', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const id = c.req.param('id');
    await c.env.DB.prepare(`UPDATE workflow_tasks SET status='concluida', completed_by=?, completed_at=?, updated_at=CURRENT_TIMESTAMP WHERE org_id=? AND id=?`).bind(user.id, nowIso(), org.id, id).run();
    return c.json({ ok:true, id, status:'concluida' });
  });

  app.post('/api/workflow/sla/check', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    let created = 0;
    const overdueInst = await c.env.DB.prepare(`
      SELECT i.*, st.nome AS state_nome, wf.nome AS workflow_nome
      FROM workflow_instances i
      LEFT JOIN workflow_states st ON st.id=i.current_state_id
      LEFT JOIN workflow_definitions wf ON wf.id=i.workflow_id
      WHERE i.org_id=? AND i.status='em_andamento' AND i.due_at IS NOT NULL AND datetime(i.due_at) < datetime('now')
    `).bind(org.id).all();
    for (const i of overdueInst.results || []) {
      const exists = await c.env.DB.prepare(`SELECT id FROM workflow_sla_events WHERE org_id=? AND workflow_instance_id=? AND event_type='breach' AND status='aberto'`).bind(org.id, i.id).first();
      if (exists) continue;
      const eid = uid('sla');
      await c.env.DB.prepare(`
        INSERT INTO workflow_sla_events
        (id, org_id, workflow_instance_id, event_type, status, due_at, metadata_json)
        VALUES (?, ?, ?, 'breach', 'aberto', ?, ?)
      `).bind(eid, org.id, i.id, i.due_at, JSON.stringify({ workflow:i.workflow_nome, state:i.state_nome })).run();
      await emitNotificationEvent(c.env.DB, org.id, user.id, 'sla_breach', i.entidade_tipo, i.entidade_id, { titulo:`SLA violado: ${i.workflow_nome}`, state:i.state_nome, due_at:i.due_at }, 'alta');
      created++;
    }

    const overdueTasks = await c.env.DB.prepare(`SELECT * FROM workflow_tasks WHERE org_id=? AND status='pendente' AND due_at IS NOT NULL AND datetime(due_at) < datetime('now')`).bind(org.id).all();
    for (const t of overdueTasks.results || []) {
      const exists = await c.env.DB.prepare(`SELECT id FROM workflow_sla_events WHERE org_id=? AND task_id=? AND event_type='task_overdue' AND status='aberto'`).bind(org.id, t.id).first();
      if (exists) continue;
      await c.env.DB.prepare(`
        INSERT INTO workflow_sla_events
        (id, org_id, task_id, event_type, status, due_at, metadata_json)
        VALUES (?, ?, ?, 'task_overdue', 'aberto', ?, ?)
      `).bind(uid('sla'), org.id, t.id, t.due_at, JSON.stringify({ titulo:t.titulo })).run();
      await emitNotificationEvent(c.env.DB, org.id, user.id, 'task_overdue', t.entidade_tipo || 'workflow_task', t.entidade_id || t.id, { titulo:t.titulo, due_at:t.due_at }, 'media');
      created++;
    }
    return c.json({ ok:true, sla_events_created:created });
  });

  app.get('/api/workflow/sla/events', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`SELECT * FROM workflow_sla_events WHERE org_id=? ORDER BY triggered_at DESC LIMIT 300`).bind(org.id).all();
    return c.json({ ok:true, items:rs.results || [] });
  });

  app.post('/api/workflow/rules', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    if (!d.codigo || !d.nome || !d.evento) return c.json({ ok:false, error:'codigo, nome e evento são obrigatórios' }, 400);
    const id = uid('wbr');
    await c.env.DB.prepare(`
      INSERT INTO workflow_business_rules
      (id, org_id, codigo, nome, entidade_tipo, evento, condition_json, action_json, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, org.id, d.codigo, d.nome, d.entidade_tipo || null, d.evento, d.condition_json ? json(d.condition_json) : '{}', d.action_json ? json(d.action_json) : '{}', d.status || 'ativo', user.id).run();
    return c.json({ ok:true, id }, 201);
  });

  app.post('/api/workflow/rules/execute-event', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const d = await body(c);
    if (!d.evento) return c.json({ ok:false, error:'evento é obrigatório' }, 400);
    const rules = await c.env.DB.prepare(`SELECT * FROM workflow_business_rules WHERE org_id=? AND evento=? AND status='ativo'`).bind(org.id, d.evento).all();
    let executed = 0;
    for (const r of rules.results || []) {
      await c.env.DB.prepare(`
        INSERT INTO workflow_automation_runs
        (id, org_id, rule_id, workflow_instance_id, entidade_tipo, entidade_id, evento, status, resultado_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'executado', ?)
      `).bind(uid('warun'), org.id, r.id, d.workflow_instance_id || null, d.entidade_tipo || r.entidade_tipo || null, d.entidade_id || null, d.evento, JSON.stringify({ action:parseJson(r.action_json,{}), simulated:true })).run();
      executed++;
    }
    return c.json({ ok:true, executed });
  });

  app.get('/api/workflow/audit', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const entityType = c.req.query('entidade_tipo');
    const entityId = c.req.query('entidade_id');
    let sql = `SELECT * FROM workflow_audit_trail WHERE org_id=?`;
    const args:any[] = [org.id];
    if (entityType) { sql += ` AND entidade_tipo=?`; args.push(entityType); }
    if (entityId) { sql += ` AND entidade_id=?`; args.push(entityId); }
    sql += ` ORDER BY created_at DESC LIMIT 300`;
    const rs = await c.env.DB.prepare(sql).bind(...args).all();
    return c.json({ ok:true, items:rs.results || [] });
  });
}

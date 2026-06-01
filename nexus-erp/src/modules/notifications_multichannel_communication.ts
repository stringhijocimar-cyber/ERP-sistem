// src/modules/notifications_multichannel_communication.ts
// NEXUS ERP — Etapa 27: Notificações, E-mails, WhatsApp/Teams, Régua de Comunicação e Alertas Multicanal
//
// Integração:
// import { registerNotificationsRoutes } from './modules/notifications_multichannel_communication';
// registerNotificationsRoutes(app, { requireOrg, auditLog });
//
// Regra crítica:
// Esta etapa NÃO envia e-mail/WhatsApp/Teams real. Ela cria fila, logs e payload preparado.
// Envio real depende de provider externo configurado.

import type { Hono } from 'hono';

type Ctx = any;
type Deps = {
  requireOrg: (c: Ctx) => Promise<{ user: any; org: any }>;
  auditLog?: (c: Ctx, input: any) => Promise<void>;
};

function uid(prefix: string) { return `${prefix}_${crypto.randomUUID()}`; }
function nowIso() { return new Date().toISOString(); }
function today() { return new Date().toISOString().slice(0,10); }
async function body(c: Ctx) { try { return await c.req.json(); } catch { return {}; } }
function json(v: any) { return typeof v === 'string' ? v : JSON.stringify(v ?? {}); }
function parseJson(v: any, fallback: any = {}) { try { return typeof v === 'string' ? JSON.parse(v) : (v ?? fallback); } catch { return fallback; } }
function num(v: any, fallback = 0) { const n = Number(v); return Number.isFinite(n) ? n : fallback; }

function addMinutes(minutes: number) {
  const d = new Date();
  d.setMinutes(d.getMinutes() + minutes);
  return d.toISOString();
}

function renderTemplate(tpl: string, data: Record<string, any>) {
  return String(tpl || '').replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
    const parts = key.split('.');
    let cur: any = data;
    for (const p of parts) cur = cur?.[p];
    return cur === undefined || cur === null ? '' : String(cur);
  });
}

const DEFAULT_TEMPLATES = [
  {
    codigo:'portal_invite_email',
    nome:'Convite Portal Cliente',
    evento:'portal_user_invited',
    canal_tipo:'email',
    assunto:'Convite para acessar o Portal NEXUS',
    corpo:'Olá {{nome}}, você foi convidado para acessar o portal do cliente. Token de convite: {{invite_token}}. Expira em {{invite_expires_at}}.'
  },
  {
    codigo:'approval_pending_email',
    nome:'Aprovação pendente',
    evento:'approval_pending',
    canal_tipo:'email',
    assunto:'Aprovação pendente: {{titulo}}',
    corpo:'Olá {{destinatario_nome}}, existe uma aprovação pendente: {{titulo}}. Prazo: {{due_date}}.'
  },
  {
    codigo:'invoice_due_email',
    nome:'Fatura próxima do vencimento',
    evento:'invoice_due',
    canal_tipo:'email',
    assunto:'Fatura {{numero}} próxima do vencimento',
    corpo:'Olá {{billing_name}}, a fatura {{numero}} no valor de {{total}} vence em {{due_date}}.'
  },
  {
    codigo:'ticket_update_email',
    nome:'Atualização de ticket',
    evento:'ticket_updated',
    canal_tipo:'email',
    assunto:'Atualização do ticket: {{titulo}}',
    corpo:'O ticket {{titulo}} está com status {{status}} e prioridade {{prioridade}}.'
  },
  {
    codigo:'onboarding_reminder_email',
    nome:'Lembrete de onboarding',
    evento:'onboarding_reminder',
    canal_tipo:'email',
    assunto:'Lembrete de onboarding: {{titulo}}',
    corpo:'A tarefa {{titulo}} está pendente no onboarding. Prazo: {{due_date}}.'
  },
  {
    codigo:'sla_breach_teams',
    nome:'Alerta de SLA no Teams',
    evento:'sla_breach',
    canal_tipo:'teams',
    assunto:'SLA violado',
    corpo:'Alerta de SLA: {{titulo}} | Severidade: {{severidade}} | Cliente: {{cliente}}.'
  }
];

export function registerNotificationsRoutes(app: Hono, deps: Deps) {
  const { requireOrg, auditLog } = deps;

  async function log(c: Ctx, action: string, entity: string, entityId: string, data?: any) {
    if (auditLog) await auditLog(c, { action, entity, entity_id: entityId, data });
  }

  async function createQueueFromTemplate(db: any, orgId: string, input: any) {
    const tpl = input.template_id
      ? await db.prepare(`SELECT * FROM notification_templates WHERE org_id=? AND id=?`).bind(orgId, input.template_id).first()
      : await db.prepare(`SELECT * FROM notification_templates WHERE org_id=? AND evento=? AND canal_tipo=? AND status='ativo' ORDER BY created_at DESC LIMIT 1`).bind(orgId, input.evento, input.canal_tipo || 'email').first();

    if (!tpl) throw new Error('Template não encontrado para evento/canal');
    const channel = input.channel_id
      ? await db.prepare(`SELECT * FROM notification_channels WHERE org_id=? AND id=?`).bind(orgId, input.channel_id).first()
      : await db.prepare(`SELECT * FROM notification_channels WHERE org_id=? AND tipo=? AND status='ativo' ORDER BY created_at DESC LIMIT 1`).bind(orgId, tpl.canal_tipo).first();

    const payload = input.payload || {};
    const subject = renderTemplate(tpl.assunto_template || '', payload);
    const content = renderTemplate(tpl.corpo_template || '', payload);
    const qid = uid('nq');

    await db.prepare(`
      INSERT INTO notification_queue
      (id, org_id, event_id, template_id, channel_id, canal_tipo, destinatario_tipo, destinatario, destinatario_nome, assunto, corpo, prioridade, status, scheduled_at, metadata_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendente', ?, ?)
    `).bind(
      qid, orgId, input.event_id || null, tpl.id, channel?.id || null, tpl.canal_tipo,
      input.destinatario_tipo || tpl.canal_tipo, input.destinatario, input.destinatario_nome || null,
      subject || null, content, input.prioridade || 'media', input.scheduled_at || nowIso(),
      input.metadata_json ? json(input.metadata_json) : null
    ).run();
    return qid;
  }

  app.post('/api/notifications/seed-defaults', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const channels = [
      { codigo:'email_manual', nome:'E-mail Manual', tipo:'email', provider:'manual' },
      { codigo:'teams_webhook', nome:'Microsoft Teams Webhook', tipo:'teams', provider:'webhook' },
      { codigo:'whatsapp_placeholder', nome:'WhatsApp Placeholder', tipo:'whatsapp', provider:'manual' },
      { codigo:'portal_inapp', nome:'Portal In-App', tipo:'in_app', provider:'internal' }
    ];
    let ch = 0, tpl = 0;
    for (const channel of channels) {
      await c.env.DB.prepare(`
        INSERT OR IGNORE INTO notification_channels
        (id, org_id, codigo, nome, tipo, provider, status, sandbox, created_by)
        VALUES (?, ?, ?, ?, ?, ?, 'ativo', 1, ?)
      `).bind(uid('nch'), org.id, channel.codigo, channel.nome, channel.tipo, channel.provider, user.id).run();
      ch++;
    }
    for (const t of DEFAULT_TEMPLATES) {
      await c.env.DB.prepare(`
        INSERT OR IGNORE INTO notification_templates
        (id, org_id, codigo, nome, evento, canal_tipo, idioma, assunto_template, corpo_template, variaveis_json, status, created_by)
        VALUES (?, ?, ?, ?, ?, ?, 'pt-BR', ?, ?, '[]', 'ativo', ?)
      `).bind(uid('ntpl'), org.id, t.codigo, t.nome, t.evento, t.canal_tipo, t.assunto, t.corpo, user.id).run();
      tpl++;
    }

    await c.env.DB.prepare(`
      INSERT OR IGNORE INTO communication_sequences
      (id, org_id, codigo, nome, tipo, descricao, steps_json, status, created_by)
      VALUES (?, ?, 'onboarding_cliente_padrao', 'Régua de Onboarding do Cliente', 'onboarding', 'Comunicação padrão de onboarding pós-venda.', ?, 'ativo', ?)
    `).bind(uid('seq'), org.id, JSON.stringify([
      { day_offset:0, evento:'onboarding_reminder', canal_tipo:'email', template_codigo:'onboarding_reminder_email', titulo:'Kickoff' },
      { day_offset:3, evento:'onboarding_reminder', canal_tipo:'email', template_codigo:'onboarding_reminder_email', titulo:'Envio de dados' },
      { day_offset:7, evento:'onboarding_reminder', canal_tipo:'email', template_codigo:'onboarding_reminder_email', titulo:'Validação de configuração' }
    ]), user.id).run();

    await log(c, 'SEED', 'notification_defaults', org.id, { channels:ch, templates:tpl });
    return c.json({ ok:true, channels:ch, templates:tpl });
  });

  app.get('/api/notifications/dashboard', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const db = c.env.DB;
    const [channels, templates, queue, logs, alerts, webhooks] = await Promise.all([
      db.prepare(`SELECT tipo, status, COUNT(*) qtd FROM notification_channels WHERE org_id=? GROUP BY tipo,status`).bind(org.id).all(),
      db.prepare(`SELECT canal_tipo, COUNT(*) qtd FROM notification_templates WHERE org_id=? AND status='ativo' GROUP BY canal_tipo`).bind(org.id).all(),
      db.prepare(`SELECT status, COUNT(*) qtd FROM notification_queue WHERE org_id=? GROUP BY status`).bind(org.id).all(),
      db.prepare(`SELECT status, COUNT(*) qtd FROM notification_delivery_logs WHERE org_id=? GROUP BY status`).bind(org.id).all(),
      db.prepare(`SELECT status, severidade, COUNT(*) qtd FROM alert_instances WHERE org_id=? GROUP BY status,severidade`).bind(org.id).all(),
      db.prepare(`SELECT status, COUNT(*) qtd FROM webhook_deliveries WHERE org_id=? GROUP BY status`).bind(org.id).all()
    ]);
    return c.json({ ok:true, channels: channels.results || [], templates: templates.results || [], queue: queue.results || [], logs: logs.results || [], alerts: alerts.results || [], webhooks: webhooks.results || [] });
  });

  app.post('/api/notifications/channels', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    if (!d.codigo || !d.nome || !d.tipo) return c.json({ ok:false, error:'codigo, nome e tipo são obrigatórios' }, 400);
    const id = uid('nch');
    await c.env.DB.prepare(`
      INSERT INTO notification_channels
      (id, org_id, codigo, nome, tipo, provider, status, credentials_ref, config_json, sandbox, rate_limit_per_minute, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, org.id, d.codigo, d.nome, d.tipo, d.provider || 'manual', d.status || 'ativo', d.credentials_ref || null, d.config_json ? json(d.config_json) : '{}', d.sandbox === false ? 0 : 1, d.rate_limit_per_minute || 60, user.id).run();
    return c.json({ ok:true, id }, 201);
  });

  app.get('/api/notifications/channels', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`SELECT * FROM notification_channels WHERE org_id=? ORDER BY tipo,nome`).bind(org.id).all();
    return c.json({ ok:true, items: rs.results || [] });
  });

  app.post('/api/notifications/templates', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    if (!d.codigo || !d.nome || !d.evento || !d.corpo_template) return c.json({ ok:false, error:'codigo, nome, evento e corpo_template são obrigatórios' }, 400);
    const id = uid('ntpl');
    await c.env.DB.prepare(`
      INSERT INTO notification_templates
      (id, org_id, codigo, nome, evento, canal_tipo, idioma, assunto_template, corpo_template, variaveis_json, status, requires_approval, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, org.id, d.codigo, d.nome, d.evento, d.canal_tipo || 'email', d.idioma || 'pt-BR', d.assunto_template || null, d.corpo_template, d.variaveis_json ? json(d.variaveis_json) : '[]', d.status || 'ativo', d.requires_approval ? 1 : 0, user.id).run();
    return c.json({ ok:true, id }, 201);
  });

  app.get('/api/notifications/templates', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`SELECT * FROM notification_templates WHERE org_id=? ORDER BY evento,canal_tipo`).bind(org.id).all();
    return c.json({ ok:true, items: rs.results || [] });
  });

  app.post('/api/notifications/events', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    if (!d.evento) return c.json({ ok:false, error:'evento é obrigatório' }, 400);
    const id = uid('nevt');
    await c.env.DB.prepare(`
      INSERT INTO notification_events
      (id, org_id, evento, entidade_tipo, entidade_id, prioridade, payload_json, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'novo', ?)
    `).bind(id, org.id, d.evento, d.entidade_tipo || null, d.entidade_id || null, d.prioridade || 'media', d.payload_json ? json(d.payload_json) : '{}', user.id).run();

    const rules = await c.env.DB.prepare(`SELECT * FROM notification_rules WHERE org_id=? AND evento=? AND status='ativo'`).bind(org.id, d.evento).all();
    let created = 0;
    for (const r of rules.results || []) {
      const recipients = parseJson(r.destinatarios_json, []);
      for (const rec of recipients) {
        try {
          await createQueueFromTemplate(c.env.DB, org.id, {
            event_id:id,
            template_id:r.template_id,
            canal_tipo:r.canal_tipo,
            destinatario:rec.destinatario || rec.email || rec.phone || rec.webhook,
            destinatario_nome:rec.nome || null,
            payload:{ ...(d.payload_json || {}), destinatario_nome:rec.nome || '' },
            prioridade:d.prioridade || 'media'
          });
          created++;
        } catch {}
      }
      await c.env.DB.prepare(`
        INSERT INTO notification_rule_runs
        (id, org_id, rule_id, event_id, status, notifications_created)
        VALUES (?, ?, ?, ?, 'executado', ?)
      `).bind(uid('nrr'), org.id, r.id, id, created).run();
    }

    await c.env.DB.prepare(`UPDATE notification_events SET status='processado', processed_at=? WHERE org_id=? AND id=?`).bind(nowIso(), org.id, id).run();
    return c.json({ ok:true, id, notifications_created:created }, 201);
  });

  app.post('/api/notifications/queue', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const d = await body(c);
    if (!d.destinatario || !d.evento) return c.json({ ok:false, error:'destinatario e evento são obrigatórios' }, 400);
    try {
      const id = await createQueueFromTemplate(c.env.DB, org.id, d);
      return c.json({ ok:true, id }, 201);
    } catch (e:any) {
      return c.json({ ok:false, error:String(e?.message || e) }, 400);
    }
  });

  app.get('/api/notifications/queue', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const status = c.req.query('status');
    let sql = `SELECT * FROM notification_queue WHERE org_id=?`;
    const args:any[] = [org.id];
    if (status) { sql += ` AND status=?`; args.push(status); }
    sql += ` ORDER BY scheduled_at ASC LIMIT 300`;
    const rs = await c.env.DB.prepare(sql).bind(...args).all();
    return c.json({ ok:true, items: rs.results || [] });
  });

  app.post('/api/notifications/queue/:id/process-manual', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const id = c.req.param('id');
    const item = await c.env.DB.prepare(`SELECT * FROM notification_queue WHERE org_id=? AND id=?`).bind(org.id, id).first();
    if (!item) return c.json({ ok:false, error:'Item não encontrado' }, 404);
    if (!['pendente','erro'].includes(item.status)) return c.json({ ok:false, error:'Item não está processável' }, 400);

    const channel = item.channel_id ? await c.env.DB.prepare(`SELECT * FROM notification_channels WHERE org_id=? AND id=?`).bind(org.id, item.channel_id).first() : null;
    await c.env.DB.prepare(`
      UPDATE notification_queue
      SET status='enviado', attempts=attempts+1, last_attempt_at=?, sent_at=?, updated_at=CURRENT_TIMESTAMP
      WHERE org_id=? AND id=?
    `).bind(nowIso(), nowIso(), org.id, id).run();

    const logId = uid('nlog');
    await c.env.DB.prepare(`
      INSERT INTO notification_delivery_logs
      (id, org_id, queue_id, channel_id, provider, status, provider_message_id, request_payload_json, response_payload_json, delivered_at)
      VALUES (?, ?, ?, ?, ?, 'enviado_manual', ?, ?, ?, ?)
    `).bind(logId, org.id, id, item.channel_id || null, channel?.provider || 'manual', `manual-${Date.now()}`, JSON.stringify({ to:item.destinatario, subject:item.assunto, body:item.corpo }), JSON.stringify({ manual:true, note:'Envio real não executado nesta etapa.' }), nowIso()).run();
    return c.json({ ok:true, id, log_id:logId, status:'enviado_manual' });
  });

  app.post('/api/notifications/rules', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    if (!d.codigo || !d.nome || !d.evento || !d.destinatarios_json?.length) return c.json({ ok:false, error:'codigo, nome, evento e destinatarios_json são obrigatórios' }, 400);
    const id = uid('nrule');
    await c.env.DB.prepare(`
      INSERT INTO notification_rules
      (id, org_id, codigo, nome, evento, entidade_tipo, condicao_json, template_id, canal_tipo, destinatarios_json, status, throttle_minutes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, org.id, d.codigo, d.nome, d.evento, d.entidade_tipo || null, d.condicao_json ? json(d.condicao_json) : '{}', d.template_id || null, d.canal_tipo || 'email', json(d.destinatarios_json), d.status || 'ativo', d.throttle_minutes || 0, user.id).run();
    return c.json({ ok:true, id }, 201);
  });

  app.get('/api/notifications/rules', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`SELECT * FROM notification_rules WHERE org_id=? ORDER BY evento,nome`).bind(org.id).all();
    return c.json({ ok:true, items: rs.results || [] });
  });

  app.post('/api/notifications/preferences', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const d = await body(c);
    if (!d.principal_tipo || !d.principal_id || !d.evento || !d.canal_tipo) return c.json({ ok:false, error:'principal_tipo, principal_id, evento e canal_tipo são obrigatórios' }, 400);
    const id = uid('npref');
    await c.env.DB.prepare(`
      INSERT OR REPLACE INTO notification_preferences
      (id, org_id, principal_tipo, principal_id, evento, canal_tipo, enabled, quiet_hours_json, digest_mode, updated_at)
      VALUES (COALESCE((SELECT id FROM notification_preferences WHERE org_id=? AND principal_tipo=? AND principal_id=? AND evento=? AND canal_tipo=?), ?), ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(org.id, d.principal_tipo, d.principal_id, d.evento, d.canal_tipo, id, org.id, d.principal_tipo, d.principal_id, d.evento, d.canal_tipo, d.enabled === false ? 0 : 1, d.quiet_hours_json ? json(d.quiet_hours_json) : null, d.digest_mode || 'immediate').run();
    return c.json({ ok:true, id });
  });

  app.post('/api/communication/sequences', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    if (!d.codigo || !d.nome || !Array.isArray(d.steps_json)) return c.json({ ok:false, error:'codigo, nome e steps_json são obrigatórios' }, 400);
    const id = uid('seq');
    await c.env.DB.prepare(`
      INSERT INTO communication_sequences
      (id, org_id, codigo, nome, tipo, descricao, steps_json, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, org.id, d.codigo, d.nome, d.tipo || 'onboarding', d.descricao || null, json(d.steps_json), d.status || 'ativo', user.id).run();
    return c.json({ ok:true, id }, 201);
  });

  app.get('/api/communication/sequences', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`SELECT * FROM communication_sequences WHERE org_id=? ORDER BY tipo,nome`).bind(org.id).all();
    return c.json({ ok:true, items: rs.results || [] });
  });

  app.post('/api/communication/sequences/:id/enroll', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const seqId = c.req.param('id');
    const d = await body(c);
    if (!d.principal_tipo || !d.principal_id) return c.json({ ok:false, error:'principal_tipo e principal_id são obrigatórios' }, 400);
    const seq = await c.env.DB.prepare(`SELECT * FROM communication_sequences WHERE org_id=? AND id=?`).bind(org.id, seqId).first();
    if (!seq) return c.json({ ok:false, error:'Régua não encontrada' }, 404);
    const enrollmentId = uid('enroll');
    await c.env.DB.prepare(`
      INSERT INTO communication_sequence_enrollments
      (id, org_id, sequence_id, principal_tipo, principal_id, entidade_tipo, entidade_id, status, metadata_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'ativo', ?)
    `).bind(enrollmentId, org.id, seqId, d.principal_tipo, d.principal_id, d.entidade_tipo || null, d.entidade_id || null, d.metadata_json ? json(d.metadata_json) : null).run();

    const steps = parseJson(seq.steps_json, []);
    for (let i=0; i<steps.length; i++) {
      await c.env.DB.prepare(`
        INSERT INTO communication_sequence_runs
        (id, org_id, enrollment_id, step_index, status, scheduled_at)
        VALUES (?, ?, ?, ?, 'pendente', ?)
      `).bind(uid('seqrun'), org.id, enrollmentId, i, addMinutes(Number(steps[i].minute_offset ?? (steps[i].day_offset || 0)*1440))).run();
    }
    return c.json({ ok:true, id:enrollmentId, steps: steps.length }, 201);
  });

  app.post('/api/communication/sequence-runs/process-due', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const runs = await c.env.DB.prepare(`
      SELECT r.*, e.principal_tipo, e.principal_id, e.metadata_json, s.steps_json
      FROM communication_sequence_runs r
      JOIN communication_sequence_enrollments e ON e.id=r.enrollment_id
      JOIN communication_sequences s ON s.id=e.sequence_id
      WHERE r.org_id=? AND r.status='pendente' AND datetime(r.scheduled_at) <= datetime('now')
      LIMIT 100
    `).bind(org.id).all();
    let processed = 0;
    for (const r of runs.results || []) {
      const steps = parseJson(r.steps_json, []);
      const step = steps[r.step_index];
      if (!step) continue;
      const metadata = parseJson(r.metadata_json, {});
      const destinatario = metadata.destinatario || metadata.email || step.destinatario;
      if (!destinatario) {
        await c.env.DB.prepare(`UPDATE communication_sequence_runs SET status='erro', erro='destinatario ausente' WHERE org_id=? AND id=?`).bind(org.id, r.id).run();
        continue;
      }
      try {
        const qid = await createQueueFromTemplate(c.env.DB, org.id, {
          evento: step.evento,
          canal_tipo: step.canal_tipo || 'email',
          destinatario,
          destinatario_nome: metadata.nome || '',
          payload:{ ...metadata, titulo:step.titulo || '', due_date:step.due_date || '' },
          prioridade: step.prioridade || 'media'
        });
        await c.env.DB.prepare(`UPDATE communication_sequence_runs SET status='executado', executed_at=?, queue_id=? WHERE org_id=? AND id=?`).bind(nowIso(), qid, org.id, r.id).run();
        processed++;
      } catch (e:any) {
        await c.env.DB.prepare(`UPDATE communication_sequence_runs SET status='erro', erro=? WHERE org_id=? AND id=?`).bind(String(e?.message || e), org.id, r.id).run();
      }
    }
    return c.json({ ok:true, processed });
  });

  app.post('/api/webhooks/endpoints', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    if (!d.codigo || !d.nome || !d.url) return c.json({ ok:false, error:'codigo, nome e url são obrigatórios' }, 400);
    const id = uid('wh');
    await c.env.DB.prepare(`
      INSERT INTO webhook_endpoints
      (id, org_id, codigo, nome, url, secret_ref, eventos_json, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, org.id, d.codigo, d.nome, d.url, d.secret_ref || null, d.eventos_json ? json(d.eventos_json) : '[]', d.status || 'ativo', user.id).run();
    return c.json({ ok:true, id }, 201);
  });

  app.get('/api/webhooks/endpoints', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`SELECT * FROM webhook_endpoints WHERE org_id=? ORDER BY created_at DESC`).bind(org.id).all();
    return c.json({ ok:true, items: rs.results || [] });
  });

  app.post('/api/webhooks/dispatch-event/:eventId', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const eventId = c.req.param('eventId');
    const event = await c.env.DB.prepare(`SELECT * FROM notification_events WHERE org_id=? AND id=?`).bind(org.id, eventId).first();
    if (!event) return c.json({ ok:false, error:'Evento não encontrado' }, 404);
    const endpoints = await c.env.DB.prepare(`SELECT * FROM webhook_endpoints WHERE org_id=? AND status='ativo'`).bind(org.id).all();
    let created = 0;
    for (const ep of endpoints.results || []) {
      const events = parseJson(ep.eventos_json, []);
      if (events.length && !events.includes(event.evento)) continue;
      await c.env.DB.prepare(`
        INSERT INTO webhook_deliveries
        (id, org_id, endpoint_id, event_id, status, request_json)
        VALUES (?, ?, ?, ?, 'pendente', ?)
      `).bind(uid('whd'), org.id, ep.id, eventId, JSON.stringify({ url:ep.url, event:event.evento, payload:parseJson(event.payload_json,{}) })).run();
      created++;
    }
    return c.json({ ok:true, deliveries_created:created });
  });

  app.get('/api/webhooks/deliveries', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`SELECT * FROM webhook_deliveries WHERE org_id=? ORDER BY created_at DESC LIMIT 200`).bind(org.id).all();
    return c.json({ ok:true, items: rs.results || [] });
  });

  app.post('/api/alerts/definitions', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    if (!d.codigo || !d.nome || !d.evento_emitido) return c.json({ ok:false, error:'codigo, nome e evento_emitido são obrigatórios' }, 400);
    const id = uid('aldef');
    await c.env.DB.prepare(`
      INSERT INTO alert_definitions
      (id, org_id, codigo, nome, categoria, severidade, query_tipo, regra_json, evento_emitido, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, org.id, d.codigo, d.nome, d.categoria || 'geral', d.severidade || 'media', d.query_tipo || 'manual', d.regra_json ? json(d.regra_json) : '{}', d.evento_emitido, d.status || 'ativo', user.id).run();
    return c.json({ ok:true, id }, 201);
  });

  app.post('/api/alerts/instances', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    if (!d.titulo) return c.json({ ok:false, error:'titulo é obrigatório' }, 400);
    const eventId = uid('nevt');
    await c.env.DB.prepare(`
      INSERT INTO notification_events
      (id, org_id, evento, entidade_tipo, entidade_id, prioridade, payload_json, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'novo', ?)
    `).bind(eventId, org.id, d.evento_emitido || 'alert_created', d.entidade_tipo || null, d.entidade_id || null, d.severidade || 'media', JSON.stringify({ titulo:d.titulo, descricao:d.descricao || '', severidade:d.severidade || 'media' }), user.id).run();

    const id = uid('alert');
    await c.env.DB.prepare(`
      INSERT INTO alert_instances
      (id, org_id, alert_definition_id, entidade_tipo, entidade_id, titulo, descricao, severidade, status, event_id, metadata_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'aberto', ?, ?)
    `).bind(id, org.id, d.alert_definition_id || null, d.entidade_tipo || null, d.entidade_id || null, d.titulo, d.descricao || null, d.severidade || 'media', eventId, d.metadata_json ? json(d.metadata_json) : null).run();

    return c.json({ ok:true, id, event_id:eventId }, 201);
  });

  app.get('/api/alerts/instances', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`SELECT * FROM alert_instances WHERE org_id=? ORDER BY opened_at DESC`).bind(org.id).all();
    return c.json({ ok:true, items: rs.results || [] });
  });

  app.post('/api/alerts/instances/:id/ack', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const id = c.req.param('id');
    await c.env.DB.prepare(`UPDATE alert_instances SET status='reconhecido', acknowledged_by=?, acknowledged_at=?, updated_at=CURRENT_TIMESTAMP WHERE org_id=? AND id=?`).bind(user.id, nowIso(), org.id, id).run();
    return c.json({ ok:true, id, status:'reconhecido' });
  });

  app.post('/api/alerts/instances/:id/resolve', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const id = c.req.param('id');
    await c.env.DB.prepare(`UPDATE alert_instances SET status='resolvido', resolved_by=?, resolved_at=?, updated_at=CURRENT_TIMESTAMP WHERE org_id=? AND id=?`).bind(user.id, nowIso(), org.id, id).run();
    return c.json({ ok:true, id, status:'resolvido' });
  });
}

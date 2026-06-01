// src/modules/lowcode_form_builder_custom_fields.ts
// NEXUS ERP — Etapa 29: Designer Visual Low-Code, Form Builder, Campos Customizados e Configuração Sem Código
//
// Integração:
// import { registerLowCodeFormBuilderRoutes } from './modules/lowcode_form_builder_custom_fields';
// registerLowCodeFormBuilderRoutes(app, { requireOrg, auditLog });
//
// Regra crítica:
// configurações low-code devem ser versionadas, auditadas e publicadas com controle.
// Publicação em produção exige request/aprovação.

import type { Hono } from 'hono';

type Ctx = any;
type Deps = {
  requireOrg: (c: Ctx) => Promise<{ user: any; org: any }>;
  auditLog?: (c: Ctx, input: any) => Promise<void>;
};

function uid(prefix: string) { return `${prefix}_${crypto.randomUUID()}`; }
function nowIso() { return new Date().toISOString(); }
function addDays(days: number) { const d = new Date(); d.setDate(d.getDate()+days); return d.toISOString(); }
async function body(c: Ctx) { try { return await c.req.json(); } catch { return {}; } }
function json(v: any) { return typeof v === 'string' ? v : JSON.stringify(v ?? {}); }
function parseJson(v: any, fallback: any = {}) { try { return typeof v === 'string' ? JSON.parse(v) : (v ?? fallback); } catch { return fallback; } }
function num(v: any, fallback = 0) { const n = Number(v); return Number.isFinite(n) ? n : fallback; }

async function changeLog(db: any, orgId: string, actorId: string | null, entityType: string, entityId: string, action: string, before?: any, after?: any) {
  await db.prepare(`
    INSERT INTO lowcode_change_log
    (id, org_id, entity_type, entity_id, action, before_json, after_json, actor_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(uid('lclog'), orgId, entityType, entityId, action, before ? json(before) : null, after ? json(after) : null, actorId).run();
}

function validateData(fields: any[], data: Record<string, any>) {
  const errors: any[] = [];
  for (const f of fields) {
    const value = data[f.codigo];
    if (f.required && (value === undefined || value === null || value === '')) {
      errors.push({ field:f.codigo, message:`${f.label} é obrigatório` });
      continue;
    }
    const validation = parseJson(f.validation_json, {});
    if (value !== undefined && value !== null && value !== '') {
      if (validation.min !== undefined && Number(value) < Number(validation.min)) errors.push({ field:f.codigo, message:`${f.label} deve ser >= ${validation.min}` });
      if (validation.max !== undefined && Number(value) > Number(validation.max)) errors.push({ field:f.codigo, message:`${f.label} deve ser <= ${validation.max}` });
      if (validation.regex) {
        try {
          const re = new RegExp(validation.regex);
          if (!re.test(String(value))) errors.push({ field:f.codigo, message:`${f.label} não atende ao padrão exigido` });
        } catch {}
      }
      if (validation.maxLength && String(value).length > Number(validation.maxLength)) errors.push({ field:f.codigo, message:`${f.label} excede o tamanho máximo` });
    }
  }
  return errors;
}

const DEFAULT_COMPONENTS = [
  { component_type:'input', nome:'Input Texto', types:['string','number'] },
  { component_type:'textarea', nome:'Texto Longo', types:['string'] },
  { component_type:'select', nome:'Select', types:['string','number'] },
  { component_type:'multi_select', nome:'Multi Select', types:['array'] },
  { component_type:'date', nome:'Data', types:['date'] },
  { component_type:'currency', nome:'Moeda', types:['number'] },
  { component_type:'checkbox', nome:'Checkbox', types:['boolean'] },
  { component_type:'file', nome:'Arquivo', types:['file'] },
  { component_type:'approval_box', nome:'Bloco de Aprovação', types:['object'] },
  { component_type:'computed', nome:'Campo Calculado', types:['string','number'] }
];

export function registerLowCodeFormBuilderRoutes(app: Hono, deps: Deps) {
  const { requireOrg, auditLog } = deps;

  async function log(c: Ctx, action: string, entity: string, entityId: string, data?: any) {
    if (auditLog) await auditLog(c, { action, entity, entity_id: entityId, data });
  }

  app.post('/api/lowcode/seed-defaults', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    let components = 0;
    for (const comp of DEFAULT_COMPONENTS) {
      await c.env.DB.prepare(`
        INSERT OR IGNORE INTO lowcode_component_registry
        (id, org_id, component_type, nome, descricao, props_schema_json, supported_data_types_json, status)
        VALUES (?, ?, ?, ?, ?, '{}', ?, 'ativo')
      `).bind(uid('lcomp'), org.id, comp.component_type, comp.nome, `Componente ${comp.nome}`, JSON.stringify(comp.types)).run();
      components++;
    }

    const appId = uid('lcapp');
    await c.env.DB.prepare(`
      INSERT OR IGNORE INTO lowcode_apps
      (id, org_id, codigo, nome, descricao, segmento_codigo, status, created_by)
      VALUES (?, ?, 'operacoes_padrao', 'App Operações Padrão', 'Configuração low-code padrão para operações e serviços.', 'servicos_operacionais', 'rascunho', ?)
    `).bind(appId, org.id, user.id).run();

    await log(c, 'SEED', 'lowcode_defaults', org.id, { components });
    return c.json({ ok:true, components });
  });

  app.get('/api/lowcode/dashboard', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const db = c.env.DB;
    const [apps, fields, forms, versions, submissions, pubs] = await Promise.all([
      db.prepare(`SELECT status, COUNT(*) qtd FROM lowcode_apps WHERE org_id=? GROUP BY status`).bind(org.id).all(),
      db.prepare(`SELECT entidade_tipo, COUNT(*) qtd FROM custom_field_definitions WHERE org_id=? AND status='ativo' GROUP BY entidade_tipo`).bind(org.id).all(),
      db.prepare(`SELECT status, COUNT(*) qtd FROM form_definitions WHERE org_id=? GROUP BY status`).bind(org.id).all(),
      db.prepare(`SELECT status, COUNT(*) qtd FROM form_versions WHERE org_id=? GROUP BY status`).bind(org.id).all(),
      db.prepare(`SELECT status, COUNT(*) qtd FROM form_submissions WHERE org_id=? GROUP BY status`).bind(org.id).all(),
      db.prepare(`SELECT status, COUNT(*) qtd FROM lowcode_publication_requests WHERE org_id=? GROUP BY status`).bind(org.id).all()
    ]);
    return c.json({ ok:true, apps:apps.results || [], custom_fields:fields.results || [], forms:forms.results || [], versions:versions.results || [], submissions:submissions.results || [], publications:pubs.results || [] });
  });

  app.get('/api/lowcode/components', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`SELECT * FROM lowcode_component_registry WHERE (org_id=? OR org_id IS NULL) AND status='ativo' ORDER BY nome`).bind(org.id).all();
    return c.json({ ok:true, items:rs.results || [] });
  });

  app.post('/api/lowcode/apps', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    if (!d.codigo || !d.nome) return c.json({ ok:false, error:'codigo e nome são obrigatórios' }, 400);
    const id = uid('lcapp');
    await c.env.DB.prepare(`
      INSERT INTO lowcode_apps
      (id, org_id, codigo, nome, descricao, segmento_codigo, status, owner_id, config_json, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, org.id, d.codigo, d.nome, d.descricao || null, d.segmento_codigo || null, d.status || 'rascunho', d.owner_id || user.id, d.config_json ? json(d.config_json) : '{}', user.id).run();
    await changeLog(c.env.DB, org.id, user.id, 'lowcode_app', id, 'create', null, d);
    return c.json({ ok:true, id }, 201);
  });

  app.get('/api/lowcode/apps', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`SELECT * FROM lowcode_apps WHERE org_id=? ORDER BY created_at DESC`).bind(org.id).all();
    return c.json({ ok:true, items:rs.results || [] });
  });

  app.post('/api/lowcode/custom-fields', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    if (!d.entidade_tipo || !d.codigo || !d.nome) return c.json({ ok:false, error:'entidade_tipo, codigo e nome são obrigatórios' }, 400);
    const id = uid('cfld');
    await c.env.DB.prepare(`
      INSERT INTO custom_field_definitions
      (id, org_id, entidade_tipo, codigo, nome, descricao, field_type, data_type, required, searchable, unique_value, default_value, options_json, validation_json, visibility_json, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, org.id, d.entidade_tipo, d.codigo, d.nome, d.descricao || null,
      d.field_type || 'text', d.data_type || 'string', d.required ? 1 : 0,
      d.searchable ? 1 : 0, d.unique_value ? 1 : 0, d.default_value || null,
      d.options_json ? json(d.options_json) : '[]',
      d.validation_json ? json(d.validation_json) : '{}',
      d.visibility_json ? json(d.visibility_json) : '{}',
      d.status || 'ativo', user.id
    ).run();
    await changeLog(c.env.DB, org.id, user.id, 'custom_field', id, 'create', null, d);
    return c.json({ ok:true, id }, 201);
  });

  app.get('/api/lowcode/custom-fields', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const entity = c.req.query('entidade_tipo');
    let sql = `SELECT * FROM custom_field_definitions WHERE org_id=?`;
    const args:any[] = [org.id];
    if (entity) { sql += ` AND entidade_tipo=?`; args.push(entity); }
    sql += ` ORDER BY entidade_tipo,nome`;
    const rs = await c.env.DB.prepare(sql).bind(...args).all();
    return c.json({ ok:true, items:rs.results || [] });
  });

  app.post('/api/lowcode/custom-field-values', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    if (!d.field_id || !d.entidade_tipo || !d.entidade_id) return c.json({ ok:false, error:'field_id, entidade_tipo e entidade_id são obrigatórios' }, 400);
    const field = await c.env.DB.prepare(`SELECT * FROM custom_field_definitions WHERE org_id=? AND id=?`).bind(org.id, d.field_id).first();
    if (!field) return c.json({ ok:false, error:'Campo não encontrado' }, 404);
    const id = uid('cfv');
    await c.env.DB.prepare(`
      INSERT OR REPLACE INTO custom_field_values
      (id, org_id, field_id, entidade_tipo, entidade_id, valor_texto, valor_numero, valor_data, valor_json, created_by, updated_at)
      VALUES (COALESCE((SELECT id FROM custom_field_values WHERE org_id=? AND field_id=? AND entidade_tipo=? AND entidade_id=?), ?), ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(
      org.id, d.field_id, d.entidade_tipo, d.entidade_id, id,
      org.id, d.field_id, d.entidade_tipo, d.entidade_id,
      d.valor_texto ?? null, d.valor_numero ?? null, d.valor_data ?? null, d.valor_json ? json(d.valor_json) : null, user.id
    ).run();
    return c.json({ ok:true, id });
  });

  app.get('/api/lowcode/custom-field-values/:entityType/:entityId', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`
      SELECT v.*, f.codigo, f.nome, f.field_type, f.data_type
      FROM custom_field_values v
      JOIN custom_field_definitions f ON f.id=v.field_id
      WHERE v.org_id=? AND v.entidade_tipo=? AND v.entidade_id=?
      ORDER BY f.nome
    `).bind(org.id, c.req.param('entityType'), c.req.param('entityId')).all();
    return c.json({ ok:true, items:rs.results || [] });
  });

  app.post('/api/lowcode/forms', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    if (!d.codigo || !d.nome || !d.entidade_tipo) return c.json({ ok:false, error:'codigo, nome e entidade_tipo são obrigatórios' }, 400);
    const id = uid('form');
    await c.env.DB.prepare(`
      INSERT INTO form_definitions
      (id, org_id, app_id, codigo, nome, descricao, entidade_tipo, modulo, workflow_id, workflow_state_id, status, current_version, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'rascunho', 1, ?)
    `).bind(id, org.id, d.app_id || null, d.codigo, d.nome, d.descricao || null, d.entidade_tipo, d.modulo || null, d.workflow_id || null, d.workflow_state_id || null, user.id).run();

    const versionId = uid('fver');
    await c.env.DB.prepare(`
      INSERT INTO form_versions
      (id, org_id, form_id, version, status, schema_json, layout_json, rules_json, validations_json, permissions_json, change_log, created_by)
      VALUES (?, ?, ?, 1, 'rascunho', ?, ?, '[]', '[]', '{}', 'Versão inicial', ?)
    `).bind(versionId, org.id, id, d.schema_json ? json(d.schema_json) : '{}', d.layout_json ? json(d.layout_json) : '{}', user.id).run();

    await changeLog(c.env.DB, org.id, user.id, 'form', id, 'create', null, d);
    return c.json({ ok:true, id, version_id:versionId }, 201);
  });

  app.get('/api/lowcode/forms', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`SELECT * FROM form_definitions WHERE org_id=? ORDER BY created_at DESC`).bind(org.id).all();
    return c.json({ ok:true, items:rs.results || [] });
  });

  app.get('/api/lowcode/forms/:id/detail', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const id = c.req.param('id');
    const form = await c.env.DB.prepare(`SELECT * FROM form_definitions WHERE org_id=? AND id=?`).bind(org.id, id).first();
    if (!form) return c.json({ ok:false, error:'Formulário não encontrado' }, 404);
    const version = await c.env.DB.prepare(`SELECT * FROM form_versions WHERE org_id=? AND form_id=? AND version=?`).bind(org.id, id, form.current_version).first();
    const sections = version ? await c.env.DB.prepare(`SELECT * FROM form_sections WHERE org_id=? AND form_version_id=? ORDER BY ordem`).bind(org.id, version.id).all() : { results: [] };
    const fields = version ? await c.env.DB.prepare(`SELECT * FROM form_fields WHERE org_id=? AND form_version_id=? ORDER BY ordem`).bind(org.id, version.id).all() : { results: [] };
    const rules = version ? await c.env.DB.prepare(`SELECT * FROM form_rules WHERE org_id=? AND form_version_id=? ORDER BY ordem`).bind(org.id, version.id).all() : { results: [] };
    return c.json({ ok:true, form, version, sections:sections.results || [], fields:fields.results || [], rules:rules.results || [] });
  });

  app.post('/api/lowcode/forms/:id/new-version', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const id = c.req.param('id');
    const form = await c.env.DB.prepare(`SELECT * FROM form_definitions WHERE org_id=? AND id=?`).bind(org.id, id).first();
    if (!form) return c.json({ ok:false, error:'Formulário não encontrado' }, 404);
    const current = await c.env.DB.prepare(`SELECT * FROM form_versions WHERE org_id=? AND form_id=? AND version=?`).bind(org.id, id, form.current_version).first();
    const newVersion = Number(form.current_version || 1) + 1;
    const versionId = uid('fver');
    await c.env.DB.prepare(`
      INSERT INTO form_versions
      (id, org_id, form_id, version, status, schema_json, layout_json, rules_json, validations_json, permissions_json, change_log, created_by)
      VALUES (?, ?, ?, ?, 'rascunho', ?, ?, ?, ?, ?, ?, ?)
    `).bind(versionId, org.id, id, newVersion, current?.schema_json || '{}', current?.layout_json || '{}', current?.rules_json || '[]', current?.validations_json || '[]', current?.permissions_json || '{}', 'Nova versão baseada na versão anterior', user.id).run();
    await c.env.DB.prepare(`UPDATE form_definitions SET current_version=?, status='rascunho', updated_at=CURRENT_TIMESTAMP WHERE org_id=? AND id=?`).bind(newVersion, org.id, id).run();
    return c.json({ ok:true, version_id:versionId, version:newVersion }, 201);
  });

  app.post('/api/lowcode/form-sections', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const d = await body(c);
    if (!d.form_version_id || !d.codigo || !d.titulo) return c.json({ ok:false, error:'form_version_id, codigo e titulo são obrigatórios' }, 400);
    const id = uid('fsec');
    await c.env.DB.prepare(`
      INSERT INTO form_sections
      (id, org_id, form_version_id, codigo, titulo, descricao, ordem, columns, collapsible, visibility_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, org.id, d.form_version_id, d.codigo, d.titulo, d.descricao || null, d.ordem || 1, d.columns || 1, d.collapsible ? 1 : 0, d.visibility_json ? json(d.visibility_json) : '{}').run();
    return c.json({ ok:true, id }, 201);
  });

  app.post('/api/lowcode/form-fields', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const d = await body(c);
    if (!d.form_version_id || !d.codigo || !d.label) return c.json({ ok:false, error:'form_version_id, codigo e label são obrigatórios' }, 400);
    const id = uid('ffld');
    await c.env.DB.prepare(`
      INSERT INTO form_fields
      (id, org_id, form_version_id, section_id, custom_field_id, codigo, label, component_type, data_binding, placeholder, help_text, ordem, row_index, col_span, required, readonly, hidden, options_json, validation_json, visibility_json, default_value)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, org.id, d.form_version_id, d.section_id || null, d.custom_field_id || null,
      d.codigo, d.label, d.component_type || 'input', d.data_binding || null,
      d.placeholder || null, d.help_text || null, d.ordem || 1, d.row_index || 1,
      d.col_span || 1, d.required ? 1 : 0, d.readonly ? 1 : 0, d.hidden ? 1 : 0,
      d.options_json ? json(d.options_json) : '[]',
      d.validation_json ? json(d.validation_json) : '{}',
      d.visibility_json ? json(d.visibility_json) : '{}',
      d.default_value || null
    ).run();
    return c.json({ ok:true, id }, 201);
  });

  app.post('/api/lowcode/form-rules', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const d = await body(c);
    if (!d.form_version_id || !d.codigo || !d.nome) return c.json({ ok:false, error:'form_version_id, codigo e nome são obrigatórios' }, 400);
    const id = uid('frule');
    await c.env.DB.prepare(`
      INSERT INTO form_rules
      (id, org_id, form_version_id, codigo, nome, trigger_event, condition_json, actions_json, status, ordem)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, org.id, d.form_version_id, d.codigo, d.nome, d.trigger_event || 'on_change', d.condition_json ? json(d.condition_json) : '{}', d.actions_json ? json(d.actions_json) : '[]', d.status || 'ativo', d.ordem || 1).run();
    return c.json({ ok:true, id }, 201);
  });

  app.post('/api/lowcode/forms/:id/preview-session', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    const id = c.req.param('id');
    const form = await c.env.DB.prepare(`SELECT * FROM form_definitions WHERE org_id=? AND id=?`).bind(org.id, id).first();
    if (!form) return c.json({ ok:false, error:'Formulário não encontrado' }, 404);
    const version = await c.env.DB.prepare(`SELECT * FROM form_versions WHERE org_id=? AND form_id=? AND version=?`).bind(org.id, id, d.version || form.current_version).first();
    if (!version) return c.json({ ok:false, error:'Versão não encontrada' }, 404);
    const token = crypto.randomUUID() + '-' + crypto.randomUUID();
    const previewId = uid('fprev');
    await c.env.DB.prepare(`
      INSERT INTO form_preview_sessions
      (id, org_id, form_version_id, preview_token, sample_data_json, created_by, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(previewId, org.id, version.id, token, d.sample_data_json ? json(d.sample_data_json) : '{}', user.id, addDays(3)).run();
    return c.json({ ok:true, id:previewId, preview_token:token, expires_at:addDays(3) }, 201);
  });

  app.get('/api/lowcode/preview/:token', async (c: Ctx) => {
    const token = c.req.param('token');
    const prev = await c.env.DB.prepare(`
      SELECT p.*, v.form_id, v.version, v.schema_json, v.layout_json, v.rules_json, f.nome AS form_nome, f.entidade_tipo
      FROM form_preview_sessions p
      JOIN form_versions v ON v.id=p.form_version_id
      JOIN form_definitions f ON f.id=v.form_id
      WHERE p.preview_token=? AND datetime(p.expires_at) > datetime('now')
    `).bind(token).first();
    if (!prev) return c.json({ ok:false, error:'Preview inválido ou expirado' }, 404);
    const fields = await c.env.DB.prepare(`SELECT * FROM form_fields WHERE org_id=? AND form_version_id=? ORDER BY ordem`).bind(prev.org_id, prev.form_version_id).all();
    const sections = await c.env.DB.prepare(`SELECT * FROM form_sections WHERE org_id=? AND form_version_id=? ORDER BY ordem`).bind(prev.org_id, prev.form_version_id).all();
    return c.json({ ok:true, preview:prev, sections:sections.results || [], fields:fields.results || [], sample_data:parseJson(prev.sample_data_json,{}) });
  });

  app.post('/api/lowcode/forms/:id/submit', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const id = c.req.param('id');
    const d = await body(c);
    const form = await c.env.DB.prepare(`SELECT * FROM form_definitions WHERE org_id=? AND id=?`).bind(org.id, id).first();
    if (!form) return c.json({ ok:false, error:'Formulário não encontrado' }, 404);
    const version = await c.env.DB.prepare(`SELECT * FROM form_versions WHERE org_id=? AND form_id=? AND version=?`).bind(org.id, id, d.version || form.current_version).first();
    if (!version) return c.json({ ok:false, error:'Versão não encontrada' }, 404);
    const fields = await c.env.DB.prepare(`SELECT * FROM form_fields WHERE org_id=? AND form_version_id=?`).bind(org.id, version.id).all();
    const errors = validateData(fields.results || [], d.data_json || {});
    const status = errors.length ? 'erro_validacao' : (d.submit ? 'submetido' : 'rascunho');
    const subId = uid('fsub');
    await c.env.DB.prepare(`
      INSERT INTO form_submissions
      (id, org_id, form_id, form_version_id, entidade_tipo, entidade_id, status, data_json, validation_errors_json, submitted_by, submitted_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(subId, org.id, id, version.id, form.entidade_tipo, d.entidade_id || null, status, json(d.data_json || {}), json(errors), status === 'submetido' ? user.id : null, status === 'submetido' ? nowIso() : null, user.id).run();
    return c.json({ ok:!errors.length, id:subId, status, errors });
  });

  app.get('/api/lowcode/submissions', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`
      SELECT s.*, f.codigo AS form_codigo, f.nome AS form_nome
      FROM form_submissions s
      JOIN form_definitions f ON f.id=s.form_id
      WHERE s.org_id=?
      ORDER BY s.created_at DESC
      LIMIT 300
    `).bind(org.id).all();
    return c.json({ ok:true, items:rs.results || [] });
  });

  app.post('/api/lowcode/publication-requests', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    if (!d.entity_id) return c.json({ ok:false, error:'entity_id é obrigatório' }, 400);
    const id = uid('lpub');
    await c.env.DB.prepare(`
      INSERT INTO lowcode_publication_requests
      (id, org_id, entity_type, entity_id, target_environment, status, requested_by, notes, metadata_json)
      VALUES (?, ?, ?, ?, ?, 'pendente', ?, ?, ?)
    `).bind(id, org.id, d.entity_type || 'form_version', d.entity_id, d.target_environment || 'production', user.id, d.notes || null, d.metadata_json ? json(d.metadata_json) : '{}').run();
    return c.json({ ok:true, id }, 201);
  });

  app.get('/api/lowcode/publication-requests', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`SELECT * FROM lowcode_publication_requests WHERE org_id=? ORDER BY created_at DESC`).bind(org.id).all();
    return c.json({ ok:true, items:rs.results || [] });
  });

  app.post('/api/lowcode/publication-requests/:id/approve', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const id = c.req.param('id');
    const req = await c.env.DB.prepare(`SELECT * FROM lowcode_publication_requests WHERE org_id=? AND id=?`).bind(org.id, id).first();
    if (!req) return c.json({ ok:false, error:'Solicitação não encontrada' }, 404);
    await c.env.DB.prepare(`
      UPDATE lowcode_publication_requests
      SET status='aprovada', approved_by=?, approved_at=?, updated_at=CURRENT_TIMESTAMP
      WHERE org_id=? AND id=?
    `).bind(user.id, nowIso(), org.id, id).run();
    return c.json({ ok:true, id, status:'aprovada' });
  });

  app.post('/api/lowcode/publication-requests/:id/publish', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const id = c.req.param('id');
    const req = await c.env.DB.prepare(`SELECT * FROM lowcode_publication_requests WHERE org_id=? AND id=?`).bind(org.id, id).first();
    if (!req) return c.json({ ok:false, error:'Solicitação não encontrada' }, 404);
    if (req.status !== 'aprovada') return c.json({ ok:false, error:'Solicitação precisa estar aprovada' }, 400);

    if (req.entity_type === 'form_version') {
      const v = await c.env.DB.prepare(`SELECT * FROM form_versions WHERE org_id=? AND id=?`).bind(org.id, req.entity_id).first();
      if (!v) return c.json({ ok:false, error:'Versão não encontrada' }, 404);
      await c.env.DB.prepare(`UPDATE form_versions SET status='publicado', published_by=?, published_at=? WHERE org_id=? AND id=?`).bind(user.id, nowIso(), org.id, req.entity_id).run();
      await c.env.DB.prepare(`UPDATE form_definitions SET status='publicado', current_version=?, published_by=?, published_at=?, updated_at=CURRENT_TIMESTAMP WHERE org_id=? AND id=?`).bind(v.version, user.id, nowIso(), org.id, v.form_id).run();
    }

    await c.env.DB.prepare(`
      UPDATE lowcode_publication_requests
      SET status='publicada', published_at=?, updated_at=CURRENT_TIMESTAMP
      WHERE org_id=? AND id=?
    `).bind(nowIso(), org.id, id).run();

    await changeLog(c.env.DB, org.id, user.id, req.entity_type, req.entity_id, 'publish', null, { publication_request_id:id, environment:req.target_environment });
    return c.json({ ok:true, id, status:'publicada' });
  });

  app.post('/api/lowcode/environment-configs', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    if (!d.environment || !d.config_key) return c.json({ ok:false, error:'environment e config_key são obrigatórios' }, 400);
    const id = uid('lenv');
    await c.env.DB.prepare(`
      INSERT OR REPLACE INTO lowcode_environment_configs
      (id, org_id, environment, config_key, config_value_json, status, updated_by, updated_at)
      VALUES (COALESCE((SELECT id FROM lowcode_environment_configs WHERE org_id=? AND environment=? AND config_key=?), ?), ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(org.id, d.environment, d.config_key, id, org.id, d.environment, d.config_key, d.config_value_json ? json(d.config_value_json) : '{}', d.status || 'ativo', user.id).run();
    return c.json({ ok:true, id });
  });

  app.get('/api/lowcode/change-log', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`SELECT * FROM lowcode_change_log WHERE org_id=? ORDER BY created_at DESC LIMIT 300`).bind(org.id).all();
    return c.json({ ok:true, items:rs.results || [] });
  });
}

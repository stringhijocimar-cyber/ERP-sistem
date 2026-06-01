// src/modules/enterprise_consolidation_final_package.ts
// NEXUS ERP — Etapa 33: Consolidação Final, Menu Executivo, Documentação Técnica, Guia de Deploy, Testes Integrados e Pacote Enterprise
//
// Integração:
// import { registerEnterpriseConsolidationRoutes } from './modules/enterprise_consolidation_final_package';
// registerEnterpriseConsolidationRoutes(app, { requireOrg, auditLog });
//
// Objetivo:
// Consolidar o ERP em um pacote final para Claude/Genspark com catálogo de módulos,
// menu executivo, checklists, testes integrados, pacote de release e handoff técnico.

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

const MODULES = [
  { code:'crm', name:'CRM e Comercial', cat:'commercial', route:'/crm', front:'NexusCRM.mount', backend:'registerCrmRoutes', caps:['accounts','contacts','opportunities','quotes','proposals'] },
  { code:'contracts_billing_cs', name:'Contratos, Billing e Customer Success', cat:'commercial', route:'/customer-lifecycle', front:'NexusCustomerLifecycle.mount', backend:'registerCommercialContractBillingCustomerSuccessRoutes', caps:['contracts','subscriptions','invoices','payments','cs','renewals','expansions'] },
  { code:'customer_portal', name:'Portal do Cliente', cat:'customer', route:'/customer-portal', front:'NexusCustomerPortal.mountAdmin', backend:'registerCustomerPortalRoutes', caps:['portal','documents','tickets','deliveries','approvals','nps'] },
  { code:'notifications', name:'Notificações Multicanal', cat:'platform', route:'/notifications', front:'NexusNotifications.mount', backend:'registerNotificationsRoutes', caps:['templates','channels','queue','alerts','webhooks','sequences'] },
  { code:'workflow', name:'Workflow, SLA e Aprovações', cat:'platform', route:'/workflow', front:'NexusWorkflowOrchestration.mount', backend:'registerWorkflowOrchestrationRoutes', caps:['states','transitions','approval_matrix','delegations','sla','tasks'] },
  { code:'lowcode', name:'Low-Code e Form Builder', cat:'platform', route:'/lowcode', front:'NexusLowCodeFormBuilder.mount', backend:'registerLowCodeFormBuilderRoutes', caps:['custom_fields','forms','versions','preview','publication'] },
  { code:'data_platform', name:'Data Platform e Integrações', cat:'platform', route:'/data-platform', front:'NexusDataPlatform.mount', backend:'registerDataPlatformIntegrationRoutes', caps:['api_keys','connectors','mappings','jobs','webhooks','exports','bi','storage'] },
  { code:'security_enterprise', name:'Segurança, LGPD e Observabilidade', cat:'governance', route:'/security-enterprise', front:'NexusSecurityEnterprise.mount', backend:'registerObservabilitySecurityRoutes', caps:['logs','metrics','health','lgpd','incidents','anomalies','hardening','forensic_audit'] },
  { code:'production_readiness', name:'Production Readiness', cat:'operations', route:'/production-readiness', front:'NexusProductionReadiness.mount', backend:'registerProductionReadinessRoutes', caps:['cache','async_jobs','scheduler','locks','backup','restore','feature_flags','releases'] }
];

const MIGRATIONS = [
  '0023_commercial_contract_billing_customer_success.sql',
  '0024_customer_portal_self_service_deliveries.sql',
  '0025_notifications_multichannel_communication.sql',
  '0026_workflow_sla_approval_orchestration.sql',
  '0027_lowcode_form_builder_custom_fields.sql',
  '0028_data_platform_public_api_integrations.sql',
  '0029_observability_security_lgpd_hardening.sql',
  '0030_performance_scalability_production_readiness.sql',
  '0031_enterprise_consolidation_menu_documentation.sql'
];

const SMOKE_TESTS = [
  'tests/contract-billing-cs-smoke.sh',
  'tests/customer-portal-smoke.sh',
  'tests/notifications-multichannel-smoke.sh',
  'tests/workflow-orchestration-smoke.sh',
  'tests/lowcode-formbuilder-smoke.sh',
  'tests/data-platform-integrations-smoke.sh',
  'tests/security-enterprise-smoke.sh',
  'tests/production-readiness-smoke.sh',
  'tests/enterprise-consolidated-smoke.sh'
];

export function registerEnterpriseConsolidationRoutes(app: Hono, deps: Deps) {
  const { requireOrg, auditLog } = deps;

  async function log(c: Ctx, action: string, entity: string, entityId: string, data?: any) {
    if (auditLog) await auditLog(c, { action, entity, entity_id: entityId, data });
  }

  app.post('/api/enterprise-consolidation/seed-defaults', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);

    let moduleCount = 0;
    for (const m of MODULES) {
      await c.env.DB.prepare(`
        INSERT OR REPLACE INTO enterprise_module_catalog
        (id, org_id, module_code, module_name, description, category, maturity_level, status, route_path, frontend_mount, backend_register_function, migration_refs_json, dependencies_json, capabilities_json, risks_json, updated_at)
        VALUES (COALESCE((SELECT id FROM enterprise_module_catalog WHERE org_id=? AND module_code=?), ?), ?, ?, ?, ?, ?, 'enterprise_ready_draft', 'active', ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(
        org.id, m.code, uid('emod'),
        org.id, m.code, m.name, `Módulo ${m.name} consolidado no pacote enterprise.`, m.cat,
        m.route, m.front, m.backend,
        JSON.stringify(MIGRATIONS), JSON.stringify([]), JSON.stringify(m.caps),
        JSON.stringify(['validar integração real','executar smoke test','revisar permissões'])
      ).run();
      moduleCount++;
    }

    const rootItems = [
      { code:'exec_home', label:'Executive Home', icon:'layout-dashboard', route:'/executive', order:1 },
      { code:'commercial', label:'Comercial e Cliente', icon:'handshake', route:'/commercial', order:2 },
      { code:'operations', label:'Operações e Workflow', icon:'workflow', route:'/operations', order:3 },
      { code:'platform', label:'Plataforma e Integrações', icon:'plug', route:'/platform', order:4 },
      { code:'governance', label:'Governança e Segurança', icon:'shield', route:'/governance', order:5 },
      { code:'production', label:'Produção Enterprise', icon:'server', route:'/production', order:6 }
    ];
    for (const item of rootItems) {
      await c.env.DB.prepare(`
        INSERT OR REPLACE INTO executive_menu_items
        (id, org_id, parent_id, menu_code, label, description, icon, route_path, order_index, visible, required_roles_json, status, updated_at)
        VALUES (COALESCE((SELECT id FROM executive_menu_items WHERE org_id=? AND menu_code=?), ?), ?, NULL, ?, ?, ?, ?, ?, ?, 1, '["admin","executive","manager"]', 'active', CURRENT_TIMESTAMP)
      `).bind(org.id, item.code, uid('menu'), org.id, item.code, item.label, `Menu ${item.label}`, item.icon, item.route, item.order).run();
    }

    const checklists = [
      {
        code:'deploy_preflight',
        name:'Checklist Pré-Deploy',
        category:'deployment',
        items:[
          'Aplicar migrations na ordem oficial',
          'Registrar funções backend no src/index.ts',
          'Incluir scripts frontend nas páginas correspondentes',
          'Executar smoke tests por módulo',
          'Validar variáveis de ambiente',
          'Validar autenticação e tenant isolation',
          'Validar backup antes do deploy'
        ]
      },
      {
        code:'security_go_live',
        name:'Checklist Segurança Go-Live',
        category:'security',
        items:[
          'MFA obrigatório para admins',
          'API keys com expiração',
          'Logs e auditoria habilitados',
          'Ativos LGPD classificados',
          'Políticas de retenção revisadas',
          'Sessões com expiração',
          'Incidentes e hardening disponíveis'
        ]
      },
      {
        code:'production_go_live',
        name:'Checklist Produção Enterprise',
        category:'production',
        items:[
          'Cache configurado',
          'Workers reais definidos',
          'Scheduler real definido',
          'Storage real para backup',
          'Restore testado em sandbox',
          'Feature flags revisadas',
          'Plano de rollback aprovado',
          'Readiness sem falhas críticas'
        ]
      }
    ];
    for (const cl of checklists) {
      await c.env.DB.prepare(`
        INSERT OR REPLACE INTO enterprise_deployment_checklists
        (id, org_id, checklist_code, checklist_name, category, environment, status, items_json, owner_id, created_by, updated_at)
        VALUES (COALESCE((SELECT id FROM enterprise_deployment_checklists WHERE org_id=? AND checklist_code=?), ?), ?, ?, ?, ?, 'production', 'active', ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(org.id, cl.code, uid('chk'), org.id, cl.code, cl.name, cl.category, JSON.stringify(cl.items.map((x,i)=>({ id:i+1, title:x, status:'pending' }))), user.id, user.id).run();
    }

    const suiteId = uid('tsuite');
    await c.env.DB.prepare(`
      INSERT OR REPLACE INTO enterprise_test_suites
      (id, org_id, suite_code, suite_name, suite_type, status, test_files_json, command, created_by, updated_at)
      VALUES (COALESCE((SELECT id FROM enterprise_test_suites WHERE org_id=? AND suite_code='enterprise_all_smoke'), ?), ?, 'enterprise_all_smoke', 'Smoke Test Integrado Enterprise', 'smoke', 'active', ?, 'bash tests/enterprise-consolidated-smoke.sh', ?, CURRENT_TIMESTAMP)
    `).bind(org.id, suiteId, org.id, JSON.stringify(SMOKE_TESTS), user.id).run();

    const packageId = uid('pkg');
    await c.env.DB.prepare(`
      INSERT OR REPLACE INTO enterprise_release_packages
      (id, org_id, package_code, package_name, version, status, included_modules_json, included_migrations_json, included_docs_json, install_order_json, known_limitations_json, handoff_notes, created_by, updated_at)
      VALUES (COALESCE((SELECT id FROM enterprise_release_packages WHERE org_id=? AND package_code='nexus_enterprise_v1'), ?), ?, 'nexus_enterprise_v1', 'NEXUS ERP Enterprise Package', '1.0.0-draft', 'draft', ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(
      org.id, packageId, org.id,
      JSON.stringify(MODULES.map(m=>m.code)),
      JSON.stringify(MIGRATIONS),
      JSON.stringify(['docs/ENTERPRISE_TECHNICAL_DOCUMENTATION.md','docs/DEPLOYMENT_GUIDE.md','docs/CLAUDE_GENSARK_HANDOFF_PROMPT.md']),
      JSON.stringify(MIGRATIONS),
      JSON.stringify([
        'Integrações externas reais ainda exigem providers e secrets',
        'Workers assíncronos reais dependem de infraestrutura',
        'MFA/KMS/SIEM reais dependem de integração enterprise',
        'Front-end entregue como camada inicial funcional/API driven'
      ]),
      'Pacote consolidado para evolução no Claude Sonnet/Genspark. Aplicar migrations, registrar módulos, executar smoke tests e validar integrações reais.',
      user.id
    ).run();

    await log(c, 'SEED', 'enterprise_consolidation', org.id, { modules:moduleCount, checklists:checklists.length });
    return c.json({ ok:true, modules:moduleCount, migrations:MIGRATIONS.length, checklists:checklists.length, smoke_tests:SMOKE_TESTS.length });
  });

  app.get('/api/enterprise-consolidation/dashboard', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const db = c.env.DB;
    const [modules, menus, checklists, suites, runs, packages, notes] = await Promise.all([
      db.prepare(`SELECT category, status, COUNT(*) qtd FROM enterprise_module_catalog WHERE org_id=? GROUP BY category,status`).bind(org.id).all(),
      db.prepare(`SELECT COUNT(*) qtd FROM executive_menu_items WHERE org_id=? AND visible=1`).bind(org.id).first(),
      db.prepare(`SELECT category, status, COUNT(*) qtd FROM enterprise_deployment_checklists WHERE org_id=? GROUP BY category,status`).bind(org.id).all(),
      db.prepare(`SELECT status, COUNT(*) qtd FROM enterprise_test_suites WHERE org_id=? GROUP BY status`).bind(org.id).all(),
      db.prepare(`SELECT status, COUNT(*) qtd FROM enterprise_test_runs WHERE org_id=? GROUP BY status`).bind(org.id).all(),
      db.prepare(`SELECT status, COUNT(*) qtd FROM enterprise_release_packages WHERE org_id=? GROUP BY status`).bind(org.id).all(),
      db.prepare(`SELECT status, COUNT(*) qtd FROM enterprise_handoff_notes WHERE org_id=? GROUP BY status`).bind(org.id).all()
    ]);
    return c.json({ ok:true, modules:modules.results || [], menus, checklists:checklists.results || [], suites:suites.results || [], test_runs:runs.results || [], packages:packages.results || [], notes:notes.results || [] });
  });

  app.get('/api/enterprise-consolidation/modules', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`SELECT * FROM enterprise_module_catalog WHERE org_id=? ORDER BY category,module_name`).bind(org.id).all();
    return c.json({ ok:true, items:rs.results || [] });
  });

  app.get('/api/enterprise-consolidation/menu', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`SELECT * FROM executive_menu_items WHERE org_id=? AND visible=1 ORDER BY COALESCE(parent_id,''), order_index`).bind(org.id).all();
    return c.json({ ok:true, items:rs.results || [] });
  });

  app.get('/api/enterprise-consolidation/checklists', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`SELECT * FROM enterprise_deployment_checklists WHERE org_id=? ORDER BY category,checklist_name`).bind(org.id).all();
    return c.json({ ok:true, items:rs.results || [] });
  });

  app.post('/api/enterprise-consolidation/test-runs/simulate', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    const suite = d.suite_id
      ? await c.env.DB.prepare(`SELECT * FROM enterprise_test_suites WHERE org_id=? AND id=?`).bind(org.id, d.suite_id).first()
      : await c.env.DB.prepare(`SELECT * FROM enterprise_test_suites WHERE org_id=? AND suite_code='enterprise_all_smoke'`).bind(org.id).first();
    if (!suite) return c.json({ ok:false, error:'Suite de teste não encontrada' }, 404);

    const tests = JSON.parse(suite.test_files_json || '[]');
    const runId = uid('trun');
    const failed = d.force_fail ? 1 : 0;
    const passed = tests.length - failed;
    const status = failed ? 'failed' : 'passed';

    await c.env.DB.prepare(`
      INSERT INTO enterprise_test_runs
      (id, org_id, suite_id, status, started_at, finished_at, total_tests, passed_tests, failed_tests, result_json, log_excerpt, executed_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(runId, org.id, suite.id, status, nowIso(), nowIso(), tests.length, passed, failed, JSON.stringify({ simulated:true, tests }), 'Execução simulada. Rodar scripts reais no ambiente alvo.', user.id).run();

    await c.env.DB.prepare(`UPDATE enterprise_test_suites SET last_run_at=?, last_status=?, updated_at=CURRENT_TIMESTAMP WHERE org_id=? AND id=?`).bind(nowIso(), status, org.id, suite.id).run();
    return c.json({ ok:true, id:runId, status, total_tests:tests.length, passed_tests:passed, failed_tests:failed });
  });

  app.get('/api/enterprise-consolidation/test-runs', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`SELECT * FROM enterprise_test_runs WHERE org_id=? ORDER BY created_at DESC LIMIT 100`).bind(org.id).all();
    return c.json({ ok:true, items:rs.results || [] });
  });

  app.get('/api/enterprise-consolidation/packages', async (c: Ctx) => {
    const { org } = await requireOrg(c);
    const rs = await c.env.DB.prepare(`SELECT * FROM enterprise_release_packages WHERE org_id=? ORDER BY created_at DESC`).bind(org.id).all();
    return c.json({ ok:true, items:rs.results || [] });
  });

  app.post('/api/enterprise-consolidation/packages/:id/approve', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const id = c.req.param('id');
    await c.env.DB.prepare(`UPDATE enterprise_release_packages SET status='approved', approved_by=?, approved_at=?, updated_at=CURRENT_TIMESTAMP WHERE org_id=? AND id=?`).bind(user.id, nowIso(), org.id, id).run();
    return c.json({ ok:true, id, status:'approved' });
  });

  app.post('/api/enterprise-consolidation/handoff-notes', async (c: Ctx) => {
    const { org, user } = await requireOrg(c);
    const d = await body(c);
    if (!d.note_code || !d.title || !d.content) return c.json({ ok:false, error:'note_code, title e content são obrigatórios' }, 400);
    const id = uid('note');
    await c.env.DB.prepare(`
      INSERT INTO enterprise_handoff_notes
      (id, org_id, note_code, title, audience, priority, content, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, org.id, d.note_code, d.title, d.audience || 'developer', d.priority || 'medium', d.content, d.status || 'open', user.id).run();
    return c.json({ ok:true, id }, 201);
  });
}

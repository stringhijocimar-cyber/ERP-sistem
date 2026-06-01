// public/js/pages/data_platform_integrations_api.js
// NEXUS ERP — Etapa 30: Data Platform, APIs e Integrações.
// Requer nexus_api.js.

(function () {
  const esc = (v) => (window.NexusAPI?.escapeHtml ? window.NexusAPI.escapeHtml(v) : String(v ?? ''));
  const $ = (s) => document.querySelector(s);
  async function get(path) { return window.NexusAPI.get(path); }
  async function post(path, data) { return window.NexusAPI.post(path, data); }
  function total(arr) { return (arr || []).reduce((s,x)=>s+Number(x.qtd||0),0); }

  async function mount() {
    const root = document.getElementById('app') || document.body;
    root.innerHTML = `
      <div class="nexus-page">
        <div class="page-header">
          <h1>Data Platform e Integrações</h1>
          <p>API pública, API keys, conectores, jobs, webhooks, BI, storage, exportações e logs.</p>
        </div>
        <div class="grid grid-4" id="dpKpis"></div>
        <div class="toolbar wrap">
          <button class="btn btn-primary" id="btnSeed">Seed Defaults</button>
          <button class="btn" id="btnApp">API App</button>
          <button class="btn" id="btnCred">Credencial</button>
          <button class="btn" id="btnConnector">Conector</button>
          <button class="btn" id="btnMapping">Mapping</button>
          <button class="btn" id="btnJob">Job</button>
          <button class="btn" id="btnWebhook">Webhook</button>
          <button class="btn" id="btnExport">Export</button>
          <button class="btn" id="btnReload">Atualizar</button>
        </div>
        <div class="grid grid-2">
          <section class="card"><h2>API Pública</h2><div id="apiBox"></div></section>
          <section class="card"><h2>Conectores e Jobs</h2><div id="integrationBox"></div></section>
        </div>
        <div class="grid grid-2">
          <section class="card"><h2>Webhooks, Exportações e BI</h2><div id="dataBox"></div></section>
          <section class="card"><h2>Catálogo e Auditoria</h2><div id="catalogBox"></div></section>
        </div>
      </div>
    `;
    $('#btnSeed')?.addEventListener('click', async () => { await post('/api/data-platform/seed-defaults', {}); await load(); });
    $('#btnApp')?.addEventListener('click', createApiApp);
    $('#btnCred')?.addEventListener('click', createCredential);
    $('#btnConnector')?.addEventListener('click', createConnector);
    $('#btnMapping')?.addEventListener('click', createMapping);
    $('#btnJob')?.addEventListener('click', createJob);
    $('#btnWebhook')?.addEventListener('click', createWebhook);
    $('#btnExport')?.addEventListener('click', createExport);
    $('#btnReload')?.addEventListener('click', load);
    await load();
  }

  async function load() {
    try {
      const [dash, apps, connectors, mappings, jobs, wh, exports, bi, catalog, audit] = await Promise.all([
        get('/api/data-platform/dashboard'),
        get('/api/data-platform/applications'),
        get('/api/data-platform/connectors'),
        get('/api/data-platform/mappings'),
        get('/api/data-platform/jobs'),
        get('/api/data-platform/outbound-webhooks/deliveries'),
        get('/api/data-platform/exports'),
        get('/api/data-platform/bi-connections'),
        get('/api/data-platform/catalog'),
        get('/api/data-platform/audit')
      ]);
      $('#dpKpis').innerHTML = `
        <div class="kpi-card"><span>Apps API</span><strong>${total(dash.applications)}</strong></div>
        <div class="kpi-card"><span>Conectores</span><strong>${total(dash.connectors)}</strong></div>
        <div class="kpi-card"><span>Jobs</span><strong>${total(dash.jobs)}</strong></div>
        <div class="kpi-card"><span>API Logs</span><strong>${dash.api_logs?.qtd || 0}</strong></div>
      `;
      renderApi(apps.items || []);
      renderIntegrations(connectors.items || [], mappings.items || [], jobs.items || []);
      renderData(wh.items || [], exports.items || [], bi.items || []);
      renderCatalog(catalog.items || [], audit.items || []);
    } catch(e) { err(e); }
  }

  function renderApi(apps) {
    $('#apiBox').innerHTML = apps.length ? apps.map(a => `<p><strong>${esc(a.codigo)}</strong> — ${esc(a.environment)} · ${esc(a.status)} · rate ${esc(a.rate_limit_per_minute)}/min</p>`).join('') : '<p>Sem aplicações API.</p>';
  }

  function renderIntegrations(connectors, mappings, jobs) {
    $('#integrationBox').innerHTML = `
      <h3>Conectores</h3>
      ${connectors.length ? connectors.slice(0,8).map(c => `<p><strong>${esc(c.codigo)}</strong> — ${esc(c.provider)} · ${esc(c.connector_type)} · ${esc(c.status)}</p>`).join('') : '<p>Sem conectores.</p>'}
      <h3>Mappings</h3>
      ${mappings.length ? mappings.slice(0,6).map(m => `<p><strong>${esc(m.codigo)}</strong> — ${esc(m.source_entity)} → ${esc(m.target_entity)}</p>`).join('') : '<p>Sem mappings.</p>'}
      <h3>Jobs</h3>
      ${jobs.length ? jobs.slice(0,8).map(j => `
        <div class="list-row">
          <div><strong>${esc(j.job_type)}</strong><small>${esc(j.status)} · ${esc(j.direction)} · ${esc(j.entidade_tipo || '')}</small></div>
          <button class="btn btn-sm" data-job="${esc(j.id)}">Processar</button>
        </div>`).join('') : '<p>Sem jobs.</p>'}
    `;
    document.querySelectorAll('[data-job]').forEach(b => b.addEventListener('click', async () => { await post(`/api/data-platform/jobs/${b.dataset.job}/process-manual`, {}); await load(); }));
  }

  function renderData(webhooks, exports, bi) {
    $('#dataBox').innerHTML = `
      <h3>Webhook deliveries</h3>
      ${webhooks.length ? webhooks.slice(0,6).map(w => `<p><strong>${esc(w.event_name)}</strong> — ${esc(w.status)} · tentativas ${esc(w.attempts)}</p>`).join('') : '<p>Sem webhooks.</p>'}
      <h3>Exports</h3>
      ${exports.length ? exports.slice(0,6).map(e => `<p><strong>${esc(e.codigo)}</strong> — ${esc(e.entity_name)} · ${esc(e.status)} · ${esc(e.export_format)}</p>`).join('') : '<p>Sem exportações.</p>'}
      <h3>BI</h3>
      ${bi.length ? bi.slice(0,6).map(b => `<p><strong>${esc(b.codigo)}</strong> — ${esc(b.bi_tool)} · ${esc(b.status)}</p>`).join('') : '<p>Sem conexões BI.</p>'}
    `;
  }

  function renderCatalog(catalog, audit) {
    $('#catalogBox').innerHTML = `
      <h3>Catálogo API</h3>
      ${catalog.length ? catalog.slice(0,8).map(c => `<p><strong>${esc(c.method)} ${esc(c.path)}</strong> — ${esc(c.nome)}</p>`).join('') : '<p>Catálogo vazio.</p>'}
      <h3>Auditoria</h3>
      ${audit.length ? audit.slice(0,8).map(a => `<p><strong>${esc(a.action)}</strong> — ${esc(a.entity_type)}:${esc(a.entity_id)}</p>`).join('') : '<p>Sem auditoria.</p>'}
    `;
  }

  async function createApiApp() {
    await post('/api/data-platform/applications', {
      codigo: prompt('Código:', 'app_integracao_cliente'),
      nome: prompt('Nome:', 'Integração Cliente'),
      scopes_json: ['crm:read','integrations:write','data:read'],
      environment: prompt('Ambiente:', 'production')
    });
    await load();
  }

  async function createCredential() {
    const apps = await get('/api/data-platform/applications');
    const appId = prompt('Application ID:', apps.items?.[0]?.id || '');
    if (!appId) return;
    const r = await post(`/api/data-platform/applications/${appId}/credentials`, {});
    alert(`API Key gerada. Copie agora: ${r.api_key}`);
    await load();
  }

  async function createConnector() {
    await post('/api/data-platform/connectors', {
      codigo: prompt('Código:', 'erp_cliente'),
      nome: prompt('Nome:', 'ERP Cliente'),
      connector_type: prompt('Tipo:', 'erp'),
      provider: prompt('Provider:', 'custom'),
      base_url: prompt('Base URL:', 'https://api.example.com')
    });
    await load();
  }

  async function createMapping() {
    const cons = await get('/api/data-platform/connectors');
    const connector_id = prompt('Connector ID:', cons.items?.[0]?.id || '');
    if (!connector_id) return;
    await post('/api/data-platform/mappings', {
      connector_id,
      codigo: prompt('Código:', 'map_po'),
      nome: prompt('Nome:', 'Mapa Pedido de Compra'),
      source_entity: prompt('Source:', 'purchase_order'),
      target_entity: prompt('Target:', 'external_purchase_order'),
      field_map_json: { id:'id', numero:'number', valor_total:'amount' }
    });
    await load();
  }

  async function createJob() {
    const cons = await get('/api/data-platform/connectors');
    await post('/api/data-platform/jobs', {
      connector_id: prompt('Connector ID:', cons.items?.[0]?.id || ''),
      job_type: prompt('Job type:', 'sync'),
      direction: prompt('Direction:', 'outbound'),
      entidade_tipo: prompt('Entidade:', 'purchase_order'),
      entidade_id: prompt('Entidade ID:', `PO-${Date.now()}`),
      payload_json: { source:'ui' }
    });
    await load();
  }

  async function createWebhook() {
    const wh = await post('/api/data-platform/outbound-webhooks', {
      codigo: prompt('Código:', 'wh_cliente'),
      nome: prompt('Nome:', 'Webhook Cliente'),
      url: prompt('URL:', 'https://example.org/webhook'),
      eventos_json: ['purchase_order.created','invoice.paid']
    });
    alert(`Webhook secret: ${wh.secret}`);
    await post('/api/data-platform/outbound-webhooks/emit', { event_name:'purchase_order.created', payload_json:{ demo:true } });
    await load();
  }

  async function createExport() {
    await post('/api/data-platform/exports', {
      codigo: prompt('Código:', `EXP-${Date.now()}`),
      nome: prompt('Nome:', 'Exportação Demo'),
      entity_name: prompt('Entidade:', 'crm_accounts'),
      export_format: prompt('Formato:', 'json')
    });
    await load();
  }

  function err(e) { console.error(e); alert(e?.message || 'Erro em Data Platform'); }

  window.NexusDataPlatform = { mount, load };
})();

// public/js/pages/lowcode_form_builder_api.js
// NEXUS ERP — Etapa 29: Low-Code, Form Builder e Campos Customizados.
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
          <h1>Low-Code e Form Builder</h1>
          <p>Campos customizados, formulários dinâmicos, versões, preview, validações e publicação controlada.</p>
        </div>
        <div class="grid grid-4" id="lcKpis"></div>
        <div class="toolbar wrap">
          <button class="btn btn-primary" id="btnSeed">Seed Defaults</button>
          <button class="btn" id="btnApp">App</button>
          <button class="btn" id="btnField">Campo Customizado</button>
          <button class="btn" id="btnForm">Formulário</button>
          <button class="btn" id="btnAddField">Campo no Form</button>
          <button class="btn" id="btnPreview">Preview</button>
          <button class="btn" id="btnSubmit">Submeter</button>
          <button class="btn" id="btnPublish">Publicar</button>
          <button class="btn" id="btnReload">Atualizar</button>
        </div>
        <div class="grid grid-2">
          <section class="card"><h2>Apps, Forms e Versões</h2><div id="formsBox"></div></section>
          <section class="card"><h2>Campos e Componentes</h2><div id="fieldsBox"></div></section>
        </div>
        <div class="grid grid-2">
          <section class="card"><h2>Submissões e Publicações</h2><div id="submissionsBox"></div></section>
          <section class="card"><h2>Change Log</h2><div id="logBox"></div></section>
        </div>
      </div>
    `;
    $('#btnSeed')?.addEventListener('click', async () => { await post('/api/lowcode/seed-defaults', {}); await load(); });
    $('#btnApp')?.addEventListener('click', createApp);
    $('#btnField')?.addEventListener('click', createCustomField);
    $('#btnForm')?.addEventListener('click', createForm);
    $('#btnAddField')?.addEventListener('click', addFieldToForm);
    $('#btnPreview')?.addEventListener('click', createPreview);
    $('#btnSubmit')?.addEventListener('click', submitForm);
    $('#btnPublish')?.addEventListener('click', publishForm);
    $('#btnReload')?.addEventListener('click', load);
    await load();
  }

  async function load() {
    try {
      const [dash, apps, forms, fields, comps, subs, pubs, logs] = await Promise.all([
        get('/api/lowcode/dashboard'),
        get('/api/lowcode/apps'),
        get('/api/lowcode/forms'),
        get('/api/lowcode/custom-fields'),
        get('/api/lowcode/components'),
        get('/api/lowcode/submissions'),
        get('/api/lowcode/publication-requests'),
        get('/api/lowcode/change-log')
      ]);
      $('#lcKpis').innerHTML = `
        <div class="kpi-card"><span>Apps</span><strong>${total(dash.apps)}</strong></div>
        <div class="kpi-card"><span>Forms</span><strong>${total(dash.forms)}</strong></div>
        <div class="kpi-card"><span>Campos</span><strong>${(fields.items||[]).length}</strong></div>
        <div class="kpi-card"><span>Publicações</span><strong>${total(dash.publications)}</strong></div>
      `;
      renderForms(apps.items || [], forms.items || []);
      renderFields(fields.items || [], comps.items || []);
      renderSubmissions(subs.items || [], pubs.items || []);
      renderLogs(logs.items || []);
    } catch(e) { err(e); }
  }

  function renderForms(apps, forms) {
    $('#formsBox').innerHTML = `
      <h3>Apps</h3>
      ${apps.length ? apps.slice(0,6).map(a => `<p><strong>${esc(a.codigo)}</strong> — ${esc(a.nome)} · ${esc(a.status)}</p>`).join('') : '<p>Sem apps.</p>'}
      <h3>Formulários</h3>
      ${forms.length ? forms.slice(0,10).map(f => `<p><strong>${esc(f.codigo)}</strong> — ${esc(f.entidade_tipo)} · v${esc(f.current_version)} · ${esc(f.status)}</p>`).join('') : '<p>Sem formulários.</p>'}
    `;
  }

  function renderFields(fields, comps) {
    $('#fieldsBox').innerHTML = `
      <h3>Campos Customizados</h3>
      ${fields.length ? fields.slice(0,10).map(f => `<p><strong>${esc(f.codigo)}</strong> — ${esc(f.entidade_tipo)} · ${esc(f.field_type)} · ${f.required ? 'obrigatório' : 'opcional'}</p>`).join('') : '<p>Sem campos.</p>'}
      <h3>Componentes</h3>
      ${comps.length ? comps.slice(0,12).map(c => `<p><strong>${esc(c.component_type)}</strong> — ${esc(c.nome)}</p>`).join('') : '<p>Sem componentes.</p>'}
    `;
  }

  function renderSubmissions(subs, pubs) {
    $('#submissionsBox').innerHTML = `
      <h3>Submissões</h3>
      ${subs.length ? subs.slice(0,8).map(s => `<p><strong>${esc(s.form_codigo)}</strong> — ${esc(s.status)} · ${esc(s.entidade_id || '')}</p>`).join('') : '<p>Sem submissões.</p>'}
      <h3>Publicações</h3>
      ${pubs.length ? pubs.slice(0,8).map(p => `<p><strong>${esc(p.entity_type)}</strong> — ${esc(p.status)} · ${esc(p.target_environment)}</p>`).join('') : '<p>Sem publicações.</p>'}
    `;
  }

  function renderLogs(logs) {
    $('#logBox').innerHTML = logs.length ? logs.slice(0,12).map(l => `<p><strong>${esc(l.action)}</strong> — ${esc(l.entity_type)}:${esc(l.entity_id)}</p>`).join('') : '<p>Sem logs.</p>';
  }

  async function createApp() {
    await post('/api/lowcode/apps', {
      codigo: prompt('Código:', 'app_cliente'),
      nome: prompt('Nome:', 'App Cliente'),
      segmento_codigo: prompt('Segmento:', 'servicos_operacionais')
    });
    await load();
  }

  async function createCustomField() {
    await post('/api/lowcode/custom-fields', {
      entidade_tipo: prompt('Entidade tipo:', 'purchase_request'),
      codigo: prompt('Código:', 'centro_custo_cliente'),
      nome: prompt('Nome:', 'Centro de Custo Cliente'),
      field_type: prompt('Tipo campo:', 'text'),
      data_type: prompt('Data type:', 'string'),
      required: confirm('Obrigatório?')
    });
    await load();
  }

  async function createForm() {
    const apps = await get('/api/lowcode/apps');
    await post('/api/lowcode/forms', {
      app_id: prompt('App ID opcional:', apps.items?.[0]?.id || ''),
      codigo: prompt('Código:', 'form_requisicao_custom'),
      nome: prompt('Nome:', 'Formulário de Requisição Customizado'),
      entidade_tipo: prompt('Entidade tipo:', 'purchase_request'),
      modulo: prompt('Módulo:', 'suprimentos')
    });
    await load();
  }

  async function addFieldToForm() {
    const forms = await get('/api/lowcode/forms');
    const formId = prompt('Form ID:', forms.items?.[0]?.id || '');
    if (!formId) return;
    const detail = await get(`/api/lowcode/forms/${formId}/detail`);
    const versionId = detail.version?.id;
    if (!versionId) return alert('Versão não encontrada.');
    await post('/api/lowcode/form-fields', {
      form_version_id: versionId,
      codigo: prompt('Código:', 'valor_estimado'),
      label: prompt('Label:', 'Valor Estimado'),
      component_type: prompt('Componente:', 'currency'),
      required: confirm('Obrigatório?'),
      validation_json: { min: 0 }
    });
    await load();
  }

  async function createPreview() {
    const forms = await get('/api/lowcode/forms');
    const formId = prompt('Form ID:', forms.items?.[0]?.id || '');
    if (!formId) return;
    const r = await post(`/api/lowcode/forms/${formId}/preview-session`, { sample_data_json: { valor_estimado: 1000 } });
    alert(`Preview token: ${r.preview_token}`);
    await load();
  }

  async function submitForm() {
    const forms = await get('/api/lowcode/forms');
    const formId = prompt('Form ID:', forms.items?.[0]?.id || '');
    if (!formId) return;
    const code = prompt('Campo exemplo:', 'valor_estimado');
    const value = prompt('Valor:', '1000');
    const r = await post(`/api/lowcode/forms/${formId}/submit`, {
      entidade_id: prompt('Entidade ID:', `DEMO-${Date.now()}`),
      submit: true,
      data_json: { [code]: value }
    });
    alert(`Status: ${r.status} | Erros: ${(r.errors || []).length}`);
    await load();
  }

  async function publishForm() {
    const forms = await get('/api/lowcode/forms');
    const formId = prompt('Form ID:', forms.items?.[0]?.id || '');
    if (!formId) return;
    const detail = await get(`/api/lowcode/forms/${formId}/detail`);
    const versionId = detail.version?.id;
    const req = await post('/api/lowcode/publication-requests', { entity_type:'form_version', entity_id:versionId, target_environment:'production' });
    await post(`/api/lowcode/publication-requests/${req.id}/approve`, {});
    await post(`/api/lowcode/publication-requests/${req.id}/publish`, {});
    await load();
  }

  function err(e) { console.error(e); alert(e?.message || 'Erro em low-code'); }

  window.NexusLowCodeFormBuilder = { mount, load };
})();

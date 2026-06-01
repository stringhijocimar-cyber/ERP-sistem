// public/js/pages/crm_pipeline_api.js
// NEXUS ERP — Etapa 24: CRM, Pipeline, Pricing e Oportunidades.
// Requer nexus_api.js.

(function () {
  const esc = (v) => (window.NexusAPI?.escapeHtml ? window.NexusAPI.escapeHtml(v) : String(v ?? ''));
  const $ = (s) => document.querySelector(s);
  async function get(path) { return window.NexusAPI.get(path); }
  async function post(path, data) { return window.NexusAPI.post(path, data); }
  function total(arr) { return (arr || []).reduce((s,x)=>s+Number(x.qtd||0),0); }
  function money(v) { return new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' }).format(Number(v || 0)); }

  async function mount() {
    const root = document.getElementById('app') || document.body;
    root.innerHTML = `
      <div class="nexus-page">
        <div class="page-header">
          <h1>CRM e Pipeline Comercial</h1>
          <p>Leads, contas, oportunidades, pricing, quotes, aprovação comercial, atividades e forecast.</p>
        </div>
        <div class="grid grid-4" id="crmKpis"></div>
        <div class="toolbar wrap">
          <button class="btn btn-primary" id="btnSeed">Seed Defaults</button>
          <button class="btn" id="btnAccount">Conta</button>
          <button class="btn" id="btnLead">Lead</button>
          <button class="btn" id="btnOpp">Oportunidade</button>
          <button class="btn" id="btnQuote">Quote</button>
          <button class="btn" id="btnActivity">Atividade</button>
          <button class="btn" id="btnForecast">Forecast</button>
          <button class="btn" id="btnReload">Atualizar</button>
        </div>
        <div class="grid grid-2">
          <section class="card"><h2>Pipeline</h2><div id="pipelineBox"></div></section>
          <section class="card"><h2>Quotes e Aprovações</h2><div id="quotesBox"></div></section>
        </div>
        <div class="grid grid-2">
          <section class="card"><h2>Leads, Contas e Atividades</h2><div id="crmBox"></div></section>
          <section class="card"><h2>Forecast e Pricing</h2><div id="forecastBox"></div></section>
        </div>
      </div>
    `;
    $('#btnSeed')?.addEventListener('click', async () => { await post('/api/crm/seed-defaults', {}); await load(); });
    $('#btnAccount')?.addEventListener('click', createAccount);
    $('#btnLead')?.addEventListener('click', createLead);
    $('#btnOpp')?.addEventListener('click', createOpportunity);
    $('#btnQuote')?.addEventListener('click', createQuote);
    $('#btnActivity')?.addEventListener('click', createActivity);
    $('#btnForecast')?.addEventListener('click', async () => { await post('/api/sales/forecast/generate', {}); await load(); });
    $('#btnReload')?.addEventListener('click', load);
    await load();
  }

  async function load() {
    try {
      const [dash, leads, accounts, opps, quotes, approvals, activities, forecasts, pricing, stages] = await Promise.all([
        get('/api/crm/dashboard'),
        get('/api/crm/leads'),
        get('/api/crm/accounts'),
        get('/api/crm/opportunities'),
        get('/api/crm/quotes'),
        get('/api/commercial/approval-requests'),
        get('/api/crm/activities'),
        get('/api/sales/forecasts'),
        get('/api/pricing/items'),
        get('/api/crm/stages')
      ]);
      $('#crmKpis').innerHTML = `
        <div class="kpi-card"><span>Leads</span><strong>${total(dash.leads)}</strong></div>
        <div class="kpi-card"><span>Oportunidades</span><strong>${total(dash.opportunities)}</strong></div>
        <div class="kpi-card"><span>Quotes</span><strong>${total(dash.quotes)}</strong></div>
        <div class="kpi-card"><span>Forecast</span><strong>${money(dash.latest_forecast?.weighted_total || 0)}</strong></div>
      `;
      renderPipeline(opps.items || [], stages.items || []);
      renderQuotes(quotes.items || [], approvals.items || []);
      renderCrm(leads.items || [], accounts.items || [], activities.items || []);
      renderForecast(forecasts.items || [], pricing.items || []);
    } catch(e) { err(e); }
  }

  function renderPipeline(opps, stages) {
    $('#pipelineBox').innerHTML = opps.length ? opps.slice(0,12).map(o => `
      <div class="list-row">
        <div><strong>${esc(o.codigo)} — ${esc(o.titulo)}</strong><small>${esc(o.account_name)} · ${esc(o.stage_name || '')} · ${esc(o.status)} · ${money(o.valor_estimado)}</small></div>
        <button class="btn btn-sm" data-move="${esc(o.id)}">Mover</button>
      </div>
    `).join('') : '<p>Sem oportunidades.</p>';
    document.querySelectorAll('[data-move]').forEach(b => b.addEventListener('click', async () => {
      const st = await get('/api/crm/stages');
      const stage_id = prompt('Stage ID:', st.items?.[1]?.id || st.items?.[0]?.id || '');
      if (!stage_id) return;
      await post(`/api/crm/opportunities/${b.dataset.move}/move-stage`, { stage_id, motivo:'Movido pela interface.' });
      await load();
    }));
  }

  function renderQuotes(quotes, approvals) {
    $('#quotesBox').innerHTML = `
      <h3>Quotes</h3>
      ${quotes.length ? quotes.slice(0,10).map(q => `
        <div class="list-row">
          <div><strong>${esc(q.codigo)}</strong><small>${esc(q.status)} · ${money(q.total)} · margem ${Number(q.margem_percentual||0).toFixed(1)}%</small></div>
          <button class="btn btn-sm" data-submit="${esc(q.id)}">Aprovação</button>
        </div>`).join('') : '<p>Sem quotes.</p>'}
      <h3>Aprovações</h3>
      ${approvals.length ? approvals.slice(0,10).map(a => `
        <div class="list-row">
          <div><strong>${esc(a.tipo)}</strong><small>${esc(a.status)} · desconto ${Number(a.desconto_percentual||0).toFixed(1)}% · margem ${Number(a.margem_percentual||0).toFixed(1)}%</small></div>
          <button class="btn btn-sm" data-appr="${esc(a.id)}">Aprovar</button>
        </div>`).join('') : '<p>Sem aprovações.</p>'}
    `;
    document.querySelectorAll('[data-submit]').forEach(b => b.addEventListener('click', async () => { await post(`/api/crm/quotes/${b.dataset.submit}/submit-approval`, {}); await load(); }));
    document.querySelectorAll('[data-appr]').forEach(b => b.addEventListener('click', async () => { await post(`/api/commercial/approval-requests/${b.dataset.appr}/decide`, { decisao:'aprovar', comentario:'Aprovado pela interface.' }); await load(); }));
  }

  function renderCrm(leads, accounts, activities) {
    $('#crmBox').innerHTML = `
      <h3>Leads</h3>
      ${leads.length ? leads.slice(0,5).map(l => `<p><strong>${esc(l.nome)}</strong> — ${esc(l.empresa || '')} · ${esc(l.status)} · ${esc(l.temperatura)}</p>`).join('') : '<p>Sem leads.</p>'}
      <h3>Contas</h3>
      ${accounts.length ? accounts.slice(0,5).map(a => `<p><strong>${esc(a.razao_social)}</strong> — ${esc(a.segmento_codigo || '')} · ${esc(a.status)}</p>`).join('') : '<p>Sem contas.</p>'}
      <h3>Atividades</h3>
      ${activities.length ? activities.slice(0,5).map(a => `<p><strong>${esc(a.titulo)}</strong> — ${esc(a.status)} · ${esc(a.tipo)}</p>`).join('') : '<p>Sem atividades.</p>'}
    `;
  }

  function renderForecast(forecasts, pricing) {
    $('#forecastBox').innerHTML = `
      <h3>Forecast</h3>
      ${forecasts.length ? forecasts.slice(0,5).map(f => `<p><strong>${esc(f.periodo)}</strong> — Pipeline ${money(f.pipeline_total)} · Weighted ${money(f.weighted_total)} · Commit ${money(f.commit_total)}</p>`).join('') : '<p>Sem forecast.</p>'}
      <h3>Pricing Items</h3>
      ${pricing.length ? pricing.slice(0,8).map(p => `<p><strong>${esc(p.codigo)}</strong> — ${money(p.preco_unitario)} / ${esc(p.unidade)}</p>`).join('') : '<p>Sem itens de preço.</p>'}
    `;
  }

  async function createAccount() {
    await post('/api/crm/accounts', {
      razao_social: prompt('Razão social:', 'Cliente Demo Ltda'),
      nome_fantasia: prompt('Nome fantasia:', 'Cliente Demo'),
      segmento_codigo: prompt('Segmento:', 'servicos_industriais'),
      cidade: prompt('Cidade:', 'Belo Horizonte'),
      estado: prompt('Estado:', 'MG')
    });
    await load();
  }

  async function createLead() {
    await post('/api/crm/leads', {
      nome: prompt('Nome:', 'Lead Demo'),
      empresa: prompt('Empresa:', 'Empresa Demo'),
      email: prompt('E-mail:', 'lead@example.com'),
      segmento_codigo: prompt('Segmento:', 'servicos_industriais'),
      necessidade: prompt('Necessidade:', 'Melhorar controle operacional e comercial')
    });
    await load();
  }

  async function createOpportunity() {
    const accounts = await get('/api/crm/accounts');
    const account_id = prompt('Account ID:', accounts.items?.[0]?.id || '');
    if (!account_id) return;
    await post('/api/crm/opportunities', {
      account_id,
      titulo: prompt('Título:', 'Implantação NEXUS ERP'),
      segmento_codigo: prompt('Segmento:', 'servicos_industriais'),
      valor_estimado: Number(prompt('Valor estimado:', '60000')) || 0,
      dor_principal: 'Processos comerciais e operacionais fragmentados',
      next_step: 'Agendar descoberta executiva'
    });
    await load();
  }

  async function createQuote() {
    const opps = await get('/api/crm/opportunities');
    const opportunity_id = prompt('Opportunity ID:', opps.items?.[0]?.id || '');
    if (!opportunity_id) return;
    const quote = await post('/api/crm/quotes', { opportunity_id });
    const items = await get('/api/pricing/items');
    const itemId = prompt('Pricing item ID:', items.items?.[0]?.id || '');
    if (itemId) {
      await post(`/api/crm/quotes/${quote.id}/items`, {
        pricing_item_id: itemId,
        quantidade: Number(prompt('Quantidade:', '1')) || 1,
        desconto_percentual: Number(prompt('Desconto %:', '0')) || 0
      });
    }
    await load();
  }

  async function createActivity() {
    await post('/api/crm/activities', {
      tipo: prompt('Tipo:', 'call'),
      titulo: prompt('Título:', 'Follow-up comercial'),
      descricao: prompt('Descrição:', 'Alinhar próximos passos da proposta.'),
      due_at: prompt('Vencimento ISO:', '')
    });
    await load();
  }

  function err(e) { console.error(e); alert(e?.message || 'Erro no CRM'); }

  window.NexusCrmPipeline = { mount, load };
})();

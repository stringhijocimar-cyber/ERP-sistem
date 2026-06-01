// public/js/pages/customer_portal_api.js
// NEXUS ERP — Etapa 26: Portal do Cliente e Autoatendimento.
// Requer nexus_api.js.

(function () {
  const esc = (v) => (window.NexusAPI?.escapeHtml ? window.NexusAPI.escapeHtml(v) : String(v ?? ''));
  const $ = (s) => document.querySelector(s);
  async function get(path) { return window.NexusAPI.get(path); }
  async function post(path, data) { return window.NexusAPI.post(path, data); }
  function total(arr) { return (arr || []).reduce((s,x)=>s+Number(x.qtd||0),0); }
  function money(v) { return new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' }).format(Number(v || 0)); }

  async function mountAdmin() {
    const root = document.getElementById('app') || document.body;
    root.innerHTML = `
      <div class="nexus-page">
        <div class="page-header">
          <h1>Portal do Cliente</h1>
          <p>Clientes externos, usuários, documentos, base de conhecimento, entregas, mudanças, aprovações e NPS.</p>
        </div>
        <div class="grid grid-4" id="portalKpis"></div>
        <div class="toolbar wrap">
          <button class="btn btn-primary" id="btnSeed">Seed Defaults</button>
          <button class="btn" id="btnPortal">Criar Portal</button>
          <button class="btn" id="btnInvite">Convidar Usuário</button>
          <button class="btn" id="btnDoc">Documento</button>
          <button class="btn" id="btnDelivery">Entrega</button>
          <button class="btn" id="btnApproval">Aprovação Cliente</button>
          <button class="btn" id="btnNps">NPS</button>
          <button class="btn" id="btnReload">Atualizar</button>
        </div>
        <div class="grid grid-2">
          <section class="card"><h2>Clientes e Usuários</h2><div id="customersBox"></div></section>
          <section class="card"><h2>Entregas e Aprovações</h2><div id="deliveriesBox"></div></section>
        </div>
        <div class="grid grid-2">
          <section class="card"><h2>Documentos e Conhecimento</h2><div id="knowledgeBox"></div></section>
          <section class="card"><h2>Feedback e Solicitações</h2><div id="feedbackBox"></div></section>
        </div>
      </div>
    `;
    $('#btnSeed')?.addEventListener('click', async () => { await post('/api/portal/seed-defaults', {}); await loadAdmin(); });
    $('#btnPortal')?.addEventListener('click', createPortal);
    $('#btnInvite')?.addEventListener('click', inviteUser);
    $('#btnDoc')?.addEventListener('click', createDoc);
    $('#btnDelivery')?.addEventListener('click', createDelivery);
    $('#btnApproval')?.addEventListener('click', createApproval);
    $('#btnNps')?.addEventListener('click', createNps);
    $('#btnReload')?.addEventListener('click', loadAdmin);
    await loadAdmin();
  }

  async function loadAdmin() {
    const [dash, customers, deliveries, docs] = await Promise.all([
      get('/api/portal/admin/dashboard'),
      get('/api/portal/customers'),
      get('/api/customer-deliveries'),
      get('/api/customer-success/tickets')
    ]);
    $('#portalKpis').innerHTML = `
      <div class="kpi-card"><span>Portais</span><strong>${total(dash.customers)}</strong></div>
      <div class="kpi-card"><span>Usuários</span><strong>${total(dash.users)}</strong></div>
      <div class="kpi-card"><span>Entregas</span><strong>${total(dash.deliveries)}</strong></div>
      <div class="kpi-card"><span>NPS Médio</span><strong>${dash.nps?.avg_score ? Number(dash.nps.avg_score).toFixed(1) : '-'}</strong></div>
    `;
    $('#customersBox').innerHTML = customers.items?.length ? customers.items.map(c => `<p><strong>${esc(c.portal_name)}</strong> — ${esc(c.account_name)} · ${esc(c.status)}</p>`).join('') : '<p>Sem portais.</p>';
    $('#deliveriesBox').innerHTML = deliveries.items?.length ? deliveries.items.slice(0,10).map(d => `<p><strong>${esc(d.titulo)}</strong> — ${esc(d.status)} · ${esc(d.prioridade)}</p>`).join('') : '<p>Sem entregas.</p>';
    $('#knowledgeBox').innerHTML = `
      <p>Documentos publicados: <strong>${total(dash.documents)}</strong></p>
      <p>Artigos publicados: <strong>${total(dash.articles)}</strong></p>
    `;
    $('#feedbackBox').innerHTML = `
      <p>Change Requests: <strong>${total(dash.change_requests)}</strong></p>
      <p>Aprovações: <strong>${total(dash.approvals)}</strong></p>
      <p>Tickets externos/internos: <strong>${docs.items?.length || 0}</strong></p>
    `;
  }

  async function createPortal() {
    const accounts = await get('/api/crm/accounts');
    const account_id = prompt('Account ID:', accounts.items?.[0]?.id || '');
    if (!account_id) return;
    const r = await post('/api/portal/customers', {
      account_id,
      portal_name: prompt('Nome portal:', 'Portal Cliente'),
      allowed_domains_json: ['example.com']
    });
    alert(`Portal criado: ${r.id}`);
    await loadAdmin();
  }

  async function inviteUser() {
    const customers = await get('/api/portal/customers');
    const portal_customer_id = prompt('Portal Customer ID:', customers.items?.[0]?.id || '');
    if (!portal_customer_id) return;
    const r = await post('/api/portal/users/invite', {
      portal_customer_id,
      nome: prompt('Nome:', 'Cliente Usuário'),
      email: prompt('Email:', 'cliente@example.com'),
      role: prompt('Role:', 'admin')
    });
    alert(`Convite criado. Token: ${r.invite_token}`);
    await loadAdmin();
  }

  async function createDoc() {
    const customers = await get('/api/portal/customers');
    const portal_customer_id = prompt('Portal Customer ID:', customers.items?.[0]?.id || '');
    if (!portal_customer_id) return;
    await post('/api/portal/documents', {
      portal_customer_id,
      titulo: prompt('Título:', 'Documento compartilhado'),
      descricao: 'Documento publicado no portal.',
      conteudo_texto: prompt('Conteúdo:', 'Conteúdo do documento para o cliente.')
    });
    await loadAdmin();
  }

  async function createDelivery() {
    const customers = await get('/api/portal/customers');
    const accounts = await get('/api/crm/accounts');
    await post('/api/customer-deliveries', {
      portal_customer_id: prompt('Portal Customer ID:', customers.items?.[0]?.id || ''),
      account_id: prompt('Account ID:', accounts.items?.[0]?.id || ''),
      titulo: prompt('Título:', 'Entrega de implantação'),
      descricao: 'Entrega criada para acompanhamento do cliente.',
      milestones_json: ['Kickoff','Configuração','Validação','Go-live']
    });
    await loadAdmin();
  }

  async function createApproval() {
    const customers = await get('/api/portal/customers');
    const accounts = await get('/api/crm/accounts');
    await post('/api/customer-approvals', {
      portal_customer_id: prompt('Portal Customer ID:', customers.items?.[0]?.id || ''),
      account_id: prompt('Account ID:', accounts.items?.[0]?.id || ''),
      entidade_tipo: 'delivery',
      entidade_id: prompt('Entidade ID:', 'demo'),
      titulo: prompt('Título:', 'Aprovar entrega'),
      descricao: 'Solicitação de aprovação do cliente.'
    });
    await loadAdmin();
  }

  async function createNps() {
    const customers = await get('/api/portal/customers');
    const accounts = await get('/api/crm/accounts');
    await post('/api/portal/nps/surveys', {
      portal_customer_id: prompt('Portal Customer ID:', customers.items?.[0]?.id || ''),
      account_id: prompt('Account ID:', accounts.items?.[0]?.id || ''),
      titulo: 'Pesquisa NPS'
    });
    await loadAdmin();
  }

  window.NexusCustomerPortal = { mountAdmin, loadAdmin };
})();

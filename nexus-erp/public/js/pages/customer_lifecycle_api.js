// public/js/pages/customer_lifecycle_api.js
// NEXUS ERP — Etapa 25: Contrato, Billing e Customer Success.
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
          <h1>Contrato, Billing e Customer Success</h1>
          <p>Contrato comercial, assinatura, faturas, pagamentos, handover, onboarding, health score, renovação e expansão.</p>
        </div>
        <div class="grid grid-4" id="lifeKpis"></div>
        <div class="toolbar wrap">
          <button class="btn btn-primary" id="btnContract">Contrato</button>
          <button class="btn" id="btnSubscription">Assinatura</button>
          <button class="btn" id="btnInvoice">Fatura</button>
          <button class="btn" id="btnCs">CS Account</button>
          <button class="btn" id="btnOnboarding">Onboarding</button>
          <button class="btn" id="btnTicket">Ticket</button>
          <button class="btn" id="btnRenewals">Renovações</button>
          <button class="btn" id="btnReload">Atualizar</button>
        </div>
        <div class="grid grid-2">
          <section class="card"><h2>Contratos e Assinaturas</h2><div id="contractsBox"></div></section>
          <section class="card"><h2>Billing</h2><div id="billingBox"></div></section>
        </div>
        <div class="grid grid-2">
          <section class="card"><h2>Customer Success</h2><div id="csBox"></div></section>
          <section class="card"><h2>Renovação e Expansão</h2><div id="growthBox"></div></section>
        </div>
      </div>
    `;
    $('#btnContract')?.addEventListener('click', createContract);
    $('#btnSubscription')?.addEventListener('click', createSubscription);
    $('#btnInvoice')?.addEventListener('click', createInvoice);
    $('#btnCs')?.addEventListener('click', createCs);
    $('#btnOnboarding')?.addEventListener('click', createOnboarding);
    $('#btnTicket')?.addEventListener('click', createTicket);
    $('#btnRenewals')?.addEventListener('click', async () => { await post('/api/customer-success/renewals/generate', { days_ahead: 120 }); await load(); });
    $('#btnReload')?.addEventListener('click', load);
    await load();
  }

  async function load() {
    try {
      const [dash, contracts, subs, invoices, cs, tickets, onboardings, renewals, expansions] = await Promise.all([
        get('/api/customer-lifecycle/dashboard'),
        get('/api/contracts'),
        get('/api/subscriptions'),
        get('/api/billing/invoices'),
        get('/api/customer-success/accounts'),
        get('/api/customer-success/tickets'),
        get('/api/customer-success/onboarding-projects'),
        get('/api/customer-success/renewals'),
        get('/api/customer-success/expansions')
      ]);
      $('#lifeKpis').innerHTML = `
        <div class="kpi-card"><span>Contratos</span><strong>${total(dash.contracts)}</strong></div>
        <div class="kpi-card"><span>MRR</span><strong>${money((dash.subscriptions||[]).reduce((s,x)=>s+Number(x.mrr||0),0))}</strong></div>
        <div class="kpi-card"><span>Faturas</span><strong>${total(dash.invoices)}</strong></div>
        <div class="kpi-card"><span>Tickets</span><strong>${total(dash.tickets)}</strong></div>
      `;
      renderContracts(contracts.items || [], subs.items || []);
      renderBilling(invoices.items || []);
      renderCs(cs.items || [], tickets.items || [], onboardings.items || []);
      renderGrowth(renewals.items || [], expansions.items || []);
    } catch(e) { err(e); }
  }

  function renderContracts(contracts, subs) {
    $('#contractsBox').innerHTML = `
      <h3>Contratos</h3>
      ${contracts.length ? contracts.slice(0,8).map(c => `
        <div class="list-row">
          <div><strong>${esc(c.codigo)}</strong><small>${esc(c.account_name)} · ${esc(c.status)} · ${money(c.valor_total_contrato)}</small></div>
          <button class="btn btn-sm" data-sign="${esc(c.id)}">Assinar</button>
        </div>`).join('') : '<p>Sem contratos.</p>'}
      <h3>Assinaturas</h3>
      ${subs.length ? subs.slice(0,8).map(s => `<p><strong>${esc(s.plano_codigo)}</strong> — ${esc(s.account_name)} · ${esc(s.status)} · MRR ${money(s.mrr)}</p>`).join('') : '<p>Sem assinaturas.</p>'}
    `;
    document.querySelectorAll('[data-sign]').forEach(b => b.addEventListener('click', async () => { await post(`/api/contracts/${b.dataset.sign}/sign`, { signed_by_customer:'Cliente' }); await load(); }));
  }

  function renderBilling(invoices) {
    $('#billingBox').innerHTML = invoices.length ? invoices.slice(0,12).map(i => `
      <div class="list-row">
        <div><strong>${esc(i.numero)}</strong><small>${esc(i.status)} · venc. ${esc(i.due_date || '')} · ${money(i.total)}</small></div>
        <button class="btn btn-sm" data-pay="${esc(i.id)}">Registrar Pagamento</button>
      </div>
    `).join('') : '<p>Sem faturas.</p>';
    document.querySelectorAll('[data-pay]').forEach(b => b.addEventListener('click', async () => { await post(`/api/billing/invoices/${b.dataset.pay}/register-payment`, { metodo:'manual' }); await load(); }));
  }

  function renderCs(cs, tickets, onboardings) {
    $('#csBox').innerHTML = `
      <h3>CS Accounts</h3>
      ${cs.length ? cs.slice(0,8).map(a => `
        <div class="list-row">
          <div><strong>${esc(a.account_name)}</strong><small>${esc(a.etapa)} · health ${Number(a.health_score||0).toFixed(1)} · churn ${Number(a.churn_risk_score||0).toFixed(1)}</small></div>
          <button class="btn btn-sm" data-health="${esc(a.id)}">Recalcular</button>
        </div>`).join('') : '<p>Sem contas CS.</p>'}
      <h3>Onboarding</h3>
      ${onboardings.length ? onboardings.slice(0,5).map(o => `<p><strong>${esc(o.nome)}</strong> — ${esc(o.status)} · ${Number(o.progresso_percentual||0).toFixed(0)}%</p>`).join('') : '<p>Sem onboarding.</p>'}
      <h3>Tickets</h3>
      ${tickets.length ? tickets.slice(0,5).map(t => `<p><strong>${esc(t.titulo)}</strong> — ${esc(t.status)} · ${esc(t.severidade)}</p>`).join('') : '<p>Sem tickets.</p>'}
    `;
    document.querySelectorAll('[data-health]').forEach(b => b.addEventListener('click', async () => { await post(`/api/customer-success/accounts/${b.dataset.health}/recalculate-health`, {}); await load(); }));
  }

  function renderGrowth(renewals, expansions) {
    $('#growthBox').innerHTML = `
      <h3>Renovações</h3>
      ${renewals.length ? renewals.slice(0,8).map(r => `<p><strong>${esc(r.tipo)}</strong> — ${esc(r.status)} · ${money(r.valor_potencial)} · ${esc(r.renewal_date || '')}</p>`).join('') : '<p>Sem renovações.</p>'}
      <h3>Expansões</h3>
      ${expansions.length ? expansions.slice(0,8).map(e => `<p><strong>${esc(e.titulo)}</strong> — ${esc(e.status)} · ${money(e.valor_potencial)}</p>`).join('') : '<p>Sem expansões.</p>'}
    `;
  }

  async function createContract() {
    const accounts = await get('/api/crm/accounts');
    const account_id = prompt('Account ID:', accounts.items?.[0]?.id || '');
    if (!account_id) return;
    await post('/api/contracts', {
      account_id,
      titulo: prompt('Título:', 'Contrato NEXUS ERP'),
      status: 'ativo',
      valor_mensal: Number(prompt('Valor mensal:', '5000')) || 0,
      valor_implantacao: Number(prompt('Implantação:', '30000')) || 0,
      prazo_meses: Number(prompt('Prazo meses:', '12')) || 12
    });
    await load();
  }

  async function createSubscription() {
    const contracts = await get('/api/contracts');
    const contract_id = prompt('Contract ID:', contracts.items?.[0]?.id || '');
    if (!contract_id) return;
    await post(`/api/subscriptions/from-contract/${contract_id}`, { plano_codigo:'enterprise', status:'ativo' });
    await load();
  }

  async function createInvoice() {
    const subs = await get('/api/subscriptions');
    const sub_id = prompt('Subscription ID:', subs.items?.[0]?.id || '');
    if (!sub_id) return;
    await post(`/api/billing/invoices/from-subscription/${sub_id}`, {});
    await load();
  }

  async function createCs() {
    const subs = await get('/api/subscriptions');
    const sub_id = prompt('Subscription ID:', subs.items?.[0]?.id || '');
    if (!sub_id) return;
    await post(`/api/customer-success/accounts/from-subscription/${sub_id}`, {});
    await load();
  }

  async function createOnboarding() {
    const cs = await get('/api/customer-success/accounts');
    const cs_account_id = prompt('CS Account ID:', cs.items?.[0]?.id || '');
    if (!cs_account_id) return;
    await post('/api/customer-success/onboarding-projects', { cs_account_id, nome:'Onboarding Cliente' });
    await load();
  }

  async function createTicket() {
    const cs = await get('/api/customer-success/accounts');
    await post('/api/customer-success/tickets', {
      cs_account_id: prompt('CS Account ID:', cs.items?.[0]?.id || ''),
      titulo: prompt('Título:', 'Dúvida do cliente'),
      descricao: prompt('Descrição:', 'Cliente precisa de apoio.'),
      severidade: prompt('Severidade:', 'media')
    });
    await load();
  }

  function err(e) { console.error(e); alert(e?.message || 'Erro no ciclo do cliente'); }

  window.NexusCustomerLifecycle = { mount, load };
})();

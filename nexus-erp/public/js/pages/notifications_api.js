// public/js/pages/notifications_api.js
// NEXUS ERP — Etapa 27: Notificações Multicanal.
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
          <h1>Notificações Multicanal</h1>
          <p>E-mail, WhatsApp, Teams, portal, templates, fila, regras, alertas, webhooks e réguas de comunicação.</p>
        </div>
        <div class="grid grid-4" id="notifKpis"></div>
        <div class="toolbar wrap">
          <button class="btn btn-primary" id="btnSeed">Seed Defaults</button>
          <button class="btn" id="btnTemplate">Template</button>
          <button class="btn" id="btnRule">Regra</button>
          <button class="btn" id="btnEvent">Evento</button>
          <button class="btn" id="btnQueue">Fila Manual</button>
          <button class="btn" id="btnProcess">Processar Fila</button>
          <button class="btn" id="btnAlert">Alerta</button>
          <button class="btn" id="btnReload">Atualizar</button>
        </div>
        <div class="grid grid-2">
          <section class="card"><h2>Canais, Templates e Regras</h2><div id="configBox"></div></section>
          <section class="card"><h2>Fila e Logs</h2><div id="queueBox"></div></section>
        </div>
        <div class="grid grid-2">
          <section class="card"><h2>Alertas</h2><div id="alertsBox"></div></section>
          <section class="card"><h2>Réguas e Webhooks</h2><div id="seqBox"></div></section>
        </div>
      </div>
    `;
    $('#btnSeed')?.addEventListener('click', async () => { await post('/api/notifications/seed-defaults', {}); await load(); });
    $('#btnTemplate')?.addEventListener('click', createTemplate);
    $('#btnRule')?.addEventListener('click', createRule);
    $('#btnEvent')?.addEventListener('click', emitEvent);
    $('#btnQueue')?.addEventListener('click', createQueue);
    $('#btnProcess')?.addEventListener('click', processFirst);
    $('#btnAlert')?.addEventListener('click', createAlert);
    $('#btnReload')?.addEventListener('click', load);
    await load();
  }

  async function load() {
    try {
      const [dash, channels, templates, rules, queue, alerts, seqs, webhooks] = await Promise.all([
        get('/api/notifications/dashboard'),
        get('/api/notifications/channels'),
        get('/api/notifications/templates'),
        get('/api/notifications/rules'),
        get('/api/notifications/queue'),
        get('/api/alerts/instances'),
        get('/api/communication/sequences'),
        get('/api/webhooks/endpoints')
      ]);
      $('#notifKpis').innerHTML = `
        <div class="kpi-card"><span>Canais</span><strong>${total(dash.channels)}</strong></div>
        <div class="kpi-card"><span>Templates</span><strong>${total(dash.templates)}</strong></div>
        <div class="kpi-card"><span>Fila</span><strong>${total(dash.queue)}</strong></div>
        <div class="kpi-card"><span>Alertas</span><strong>${total(dash.alerts)}</strong></div>
      `;
      renderConfig(channels.items || [], templates.items || [], rules.items || []);
      renderQueue(queue.items || []);
      renderAlerts(alerts.items || []);
      renderSeq(seqs.items || [], webhooks.items || []);
    } catch(e) { err(e); }
  }

  function renderConfig(channels, templates, rules) {
    $('#configBox').innerHTML = `
      <h3>Canais</h3>
      ${channels.length ? channels.map(c => `<p><strong>${esc(c.codigo)}</strong> — ${esc(c.tipo)} · ${esc(c.provider)} · ${esc(c.status)}</p>`).join('') : '<p>Sem canais.</p>'}
      <h3>Templates</h3>
      ${templates.length ? templates.slice(0,8).map(t => `<p><strong>${esc(t.codigo)}</strong> — ${esc(t.evento)} · ${esc(t.canal_tipo)}</p>`).join('') : '<p>Sem templates.</p>'}
      <h3>Regras</h3>
      ${rules.length ? rules.slice(0,8).map(r => `<p><strong>${esc(r.codigo)}</strong> — ${esc(r.evento)} · ${esc(r.canal_tipo)}</p>`).join('') : '<p>Sem regras.</p>'}
    `;
  }

  function renderQueue(items) {
    $('#queueBox').innerHTML = items.length ? items.slice(0,15).map(q => `
      <div class="list-row">
        <div><strong>${esc(q.destinatario)}</strong><small>${esc(q.canal_tipo)} · ${esc(q.status)} · ${esc(q.assunto || '')}</small></div>
        <button class="btn btn-sm" data-send="${esc(q.id)}">Manual</button>
      </div>
    `).join('') : '<p>Fila vazia.</p>';
    document.querySelectorAll('[data-send]').forEach(b => b.addEventListener('click', async () => { await post(`/api/notifications/queue/${b.dataset.send}/process-manual`, {}); await load(); }));
  }

  function renderAlerts(items) {
    $('#alertsBox').innerHTML = items.length ? items.slice(0,12).map(a => `
      <div class="list-row">
        <div><strong>${esc(a.titulo)}</strong><small>${esc(a.severidade)} · ${esc(a.status)}</small></div>
        <button class="btn btn-sm" data-ack="${esc(a.id)}">Reconhecer</button>
        <button class="btn btn-sm" data-res="${esc(a.id)}">Resolver</button>
      </div>
    `).join('') : '<p>Sem alertas.</p>';
    document.querySelectorAll('[data-ack]').forEach(b => b.addEventListener('click', async () => { await post(`/api/alerts/instances/${b.dataset.ack}/ack`, {}); await load(); }));
    document.querySelectorAll('[data-res]').forEach(b => b.addEventListener('click', async () => { await post(`/api/alerts/instances/${b.dataset.res}/resolve`, {}); await load(); }));
  }

  function renderSeq(seqs, webhooks) {
    $('#seqBox').innerHTML = `
      <h3>Réguas</h3>
      ${seqs.length ? seqs.map(s => `<p><strong>${esc(s.codigo)}</strong> — ${esc(s.tipo)} · ${esc(s.status)}</p>`).join('') : '<p>Sem réguas.</p>'}
      <h3>Webhooks</h3>
      ${webhooks.length ? webhooks.map(w => `<p><strong>${esc(w.codigo)}</strong> — ${esc(w.url)} · ${esc(w.status)}</p>`).join('') : '<p>Sem webhooks.</p>'}
    `;
  }

  async function createTemplate() {
    await post('/api/notifications/templates', {
      codigo: prompt('Código:', 'custom_template'),
      nome: prompt('Nome:', 'Template Customizado'),
      evento: prompt('Evento:', 'custom_event'),
      canal_tipo: prompt('Canal:', 'email'),
      assunto_template: prompt('Assunto:', 'Aviso: {{titulo}}'),
      corpo_template: prompt('Corpo:', 'Olá {{destinatario_nome}}, aviso: {{titulo}}.')
    });
    await load();
  }

  async function createRule() {
    const templates = await get('/api/notifications/templates');
    await post('/api/notifications/rules', {
      codigo: prompt('Código:', 'rule_custom'),
      nome: prompt('Nome:', 'Regra Customizada'),
      evento: prompt('Evento:', 'custom_event'),
      template_id: prompt('Template ID:', templates.items?.[0]?.id || ''),
      canal_tipo: prompt('Canal:', 'email'),
      destinatarios_json: [{ destinatario: prompt('Destinatário:', 'user@example.com'), nome:'Usuário' }]
    });
    await load();
  }

  async function emitEvent() {
    await post('/api/notifications/events', {
      evento: prompt('Evento:', 'custom_event'),
      prioridade: prompt('Prioridade:', 'media'),
      payload_json: { titulo: prompt('Título:', 'Evento de teste'), destinatario_nome:'Usuário' }
    });
    await load();
  }

  async function createQueue() {
    await post('/api/notifications/queue', {
      evento: prompt('Evento:', 'invoice_due'),
      canal_tipo: prompt('Canal:', 'email'),
      destinatario: prompt('Destinatário:', 'financeiro@example.com'),
      destinatario_nome: prompt('Nome:', 'Financeiro'),
      payload: {
        billing_name:'Cliente',
        numero:'INV-TEST',
        total:'R$ 1.000,00',
        due_date:'2026-05-10'
      }
    });
    await load();
  }

  async function processFirst() {
    const q = await get('/api/notifications/queue?status=pendente');
    const id = q.items?.[0]?.id;
    if (!id) return alert('Sem item pendente.');
    await post(`/api/notifications/queue/${id}/process-manual`, {});
    await load();
  }

  async function createAlert() {
    await post('/api/alerts/instances', {
      titulo: prompt('Título:', 'SLA próximo do vencimento'),
      descricao: prompt('Descrição:', 'Ticket crítico próximo do SLA.'),
      severidade: prompt('Severidade:', 'alta'),
      evento_emitido: 'sla_breach'
    });
    await load();
  }

  function err(e) { console.error(e); alert(e?.message || 'Erro em notificações'); }

  window.NexusNotifications = { mount, load };
})();

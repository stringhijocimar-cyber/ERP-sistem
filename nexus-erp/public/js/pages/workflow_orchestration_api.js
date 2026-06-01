// public/js/pages/workflow_orchestration_api.js
// NEXUS ERP — Etapa 28: Workflow, SLA, Aprovações e Orquestração.
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
          <h1>Workflow, SLA e Aprovações</h1>
          <p>Motor central de estados, transições, alçadas, delegações, tarefas, SLA, escalonamento e auditoria.</p>
        </div>
        <div class="grid grid-4" id="wfKpis"></div>
        <div class="toolbar wrap">
          <button class="btn btn-primary" id="btnSeed">Seed Defaults</button>
          <button class="btn" id="btnStart">Iniciar Workflow</button>
          <button class="btn" id="btnTransition">Transição</button>
          <button class="btn" id="btnApproval">Solicitar Aprovação</button>
          <button class="btn" id="btnTask">Criar Tarefa</button>
          <button class="btn" id="btnSla">Checar SLA</button>
          <button class="btn" id="btnDelegation">Delegação</button>
          <button class="btn" id="btnReload">Atualizar</button>
        </div>
        <div class="grid grid-2">
          <section class="card"><h2>Workflows e Instâncias</h2><div id="instancesBox"></div></section>
          <section class="card"><h2>Aprovações</h2><div id="approvalsBox"></div></section>
        </div>
        <div class="grid grid-2">
          <section class="card"><h2>Tarefas e SLA</h2><div id="tasksBox"></div></section>
          <section class="card"><h2>Delegações e Auditoria</h2><div id="auditBox"></div></section>
        </div>
      </div>
    `;
    $('#btnSeed')?.addEventListener('click', async () => { await post('/api/workflows/seed-defaults', {}); await load(); });
    $('#btnStart')?.addEventListener('click', startWorkflow);
    $('#btnTransition')?.addEventListener('click', transitionWorkflow);
    $('#btnApproval')?.addEventListener('click', requestApproval);
    $('#btnTask')?.addEventListener('click', createTask);
    $('#btnSla')?.addEventListener('click', async () => { await post('/api/workflow/sla/check', {}); await load(); });
    $('#btnDelegation')?.addEventListener('click', createDelegation);
    $('#btnReload')?.addEventListener('click', load);
    await load();
  }

  async function load() {
    try {
      const [dash, defs, inst, approvals, tasks, sla, deleg, audit] = await Promise.all([
        get('/api/workflows/dashboard'),
        get('/api/workflows/definitions'),
        get('/api/workflows/instances'),
        get('/api/approvals/requests'),
        get('/api/workflow/tasks'),
        get('/api/workflow/sla/events'),
        get('/api/approvals/delegations'),
        get('/api/workflow/audit')
      ]);
      $('#wfKpis').innerHTML = `
        <div class="kpi-card"><span>Workflows</span><strong>${total(dash.definitions)}</strong></div>
        <div class="kpi-card"><span>Instâncias</span><strong>${total(dash.instances)}</strong></div>
        <div class="kpi-card"><span>Aprovações</span><strong>${total(dash.approvals)}</strong></div>
        <div class="kpi-card"><span>SLA</span><strong>${total(dash.sla_events)}</strong></div>
      `;
      renderInstances(defs.items || [], inst.items || []);
      renderApprovals(approvals.items || []);
      renderTasks(tasks.items || [], sla.items || []);
      renderAudit(deleg.items || [], audit.items || []);
    } catch(e) { err(e); }
  }

  function renderInstances(defs, inst) {
    $('#instancesBox').innerHTML = `
      <h3>Definições</h3>
      ${defs.length ? defs.slice(0,8).map(d => `<p><strong>${esc(d.codigo)}</strong> — ${esc(d.entidade_tipo)} · ${esc(d.status)}</p>`).join('') : '<p>Sem workflows.</p>'}
      <h3>Instâncias</h3>
      ${inst.length ? inst.slice(0,10).map(i => `
        <div class="list-row">
          <div><strong>${esc(i.workflow_codigo)}</strong><small>${esc(i.entidade_tipo)}:${esc(i.entidade_id)} · ${esc(i.state_nome)} · ${esc(i.status)}</small></div>
        </div>`).join('') : '<p>Sem instâncias.</p>'}
    `;
  }

  function renderApprovals(items) {
    $('#approvalsBox').innerHTML = items.length ? items.slice(0,12).map(a => `
      <div class="list-row">
        <div><strong>${esc(a.titulo)}</strong><small>${esc(a.status)} · nível ${esc(a.nivel)} · ${esc(a.level_nome || '')}</small></div>
        <button class="btn btn-sm" data-appr="${esc(a.id)}">Aprovar</button>
        <button class="btn btn-sm" data-rej="${esc(a.id)}">Rejeitar</button>
      </div>
    `).join('') : '<p>Sem aprovações.</p>';
    document.querySelectorAll('[data-appr]').forEach(b => b.addEventListener('click', async () => { await post(`/api/approvals/requests/${b.dataset.appr}/decide`, { decisao:'aprovar', comentario:'Aprovado pela interface.' }); await load(); }));
    document.querySelectorAll('[data-rej]').forEach(b => b.addEventListener('click', async () => { await post(`/api/approvals/requests/${b.dataset.rej}/decide`, { decisao:'rejeitar', comentario:'Rejeitado pela interface.' }); await load(); }));
  }

  function renderTasks(tasks, sla) {
    $('#tasksBox').innerHTML = `
      <h3>Tarefas</h3>
      ${tasks.length ? tasks.slice(0,8).map(t => `<p><strong>${esc(t.titulo)}</strong> — ${esc(t.status)} · ${esc(t.prioridade)} · ${esc(t.due_at || '')}</p>`).join('') : '<p>Sem tarefas.</p>'}
      <h3>SLA Events</h3>
      ${sla.length ? sla.slice(0,8).map(s => `<p><strong>${esc(s.event_type)}</strong> — ${esc(s.status)} · ${esc(s.due_at || '')}</p>`).join('') : '<p>Sem eventos de SLA.</p>'}
    `;
  }

  function renderAudit(deleg, audit) {
    $('#auditBox').innerHTML = `
      <h3>Delegações</h3>
      ${deleg.length ? deleg.slice(0,5).map(d => `<p>${esc(d.delegator_user_id)} → ${esc(d.delegate_user_id)} · ${esc(d.status)}</p>`).join('') : '<p>Sem delegações.</p>'}
      <h3>Auditoria</h3>
      ${audit.length ? audit.slice(0,8).map(a => `<p><strong>${esc(a.action)}</strong> — ${esc(a.entidade_tipo)}:${esc(a.entidade_id)}</p>`).join('') : '<p>Sem auditoria.</p>'}
    `;
  }

  async function startWorkflow() {
    await post('/api/workflows/instances/start', {
      entidade_tipo: prompt('Entidade tipo:', 'purchase_request'),
      entidade_id: prompt('Entidade ID:', `DEMO-${Date.now()}`),
      prioridade: prompt('Prioridade:', 'media')
    });
    await load();
  }

  async function transitionWorkflow() {
    const inst = await get('/api/workflows/instances');
    const id = prompt('Instance ID:', inst.items?.[0]?.id || '');
    if (!id) return;
    await post(`/api/workflows/instances/${id}/transition`, {
      acao: prompt('Ação:', 'submeter'),
      comentario: prompt('Comentário:', 'Transição executada.')
    });
    await load();
  }

  async function requestApproval() {
    await post('/api/approvals/request', {
      entidade_tipo: prompt('Entidade tipo:', 'purchase_request'),
      entidade_id: prompt('Entidade ID:', `REQ-${Date.now()}`),
      titulo: prompt('Título:', 'Aprovar compra'),
      descricao: 'Aprovação criada pela interface.',
      valor_referencia: Number(prompt('Valor:', '75000')) || 0
    });
    await load();
  }

  async function createTask() {
    await post('/api/workflow/tasks', {
      titulo: prompt('Título:', 'Tarefa de workflow'),
      descricao: prompt('Descrição:', 'Executar ação pendente.'),
      prioridade: prompt('Prioridade:', 'media'),
      due_at: prompt('Due ISO:', '')
    });
    await load();
  }

  async function createDelegation() {
    await post('/api/approvals/delegations', {
      delegator_user_id: prompt('Delegador user id:', 'user_a'),
      delegate_user_id: prompt('Delegado user id:', 'user_b'),
      starts_at: prompt('Início ISO:', new Date().toISOString()),
      ends_at: prompt('Fim ISO:', new Date(Date.now()+7*86400000).toISOString()),
      motivo: prompt('Motivo:', 'Ausência temporária')
    });
    await load();
  }

  function err(e) { console.error(e); alert(e?.message || 'Erro em workflow'); }

  window.NexusWorkflowOrchestration = { mount, load };
})();

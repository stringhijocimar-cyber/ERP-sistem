// public/js/pages/security_enterprise_api.js
// NEXUS ERP — Etapa 31: Observabilidade, Segurança, LGPD e Hardening.
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
          <h1>Segurança Enterprise, LGPD e Observabilidade</h1>
          <p>Logs, métricas, health checks, sessões, MFA, incidentes, LGPD, retenção, anomalias e hardening.</p>
        </div>
        <div class="grid grid-4" id="secKpis"></div>
        <div class="toolbar wrap">
          <button class="btn btn-primary" id="btnSeed">Seed Defaults</button>
          <button class="btn" id="btnLog">Log</button>
          <button class="btn" id="btnHealth">Health Check</button>
          <button class="btn" id="btnSession">Sessão</button>
          <button class="btn" id="btnAsset">Data Asset</button>
          <button class="btn" id="btnLgpd">LGPD Request</button>
          <button class="btn" id="btnIncident">Incidente</button>
          <button class="btn" id="btnHardening">Hardening</button>
          <button class="btn" id="btnReload">Atualizar</button>
        </div>
        <div class="grid grid-2">
          <section class="card"><h2>Observabilidade</h2><div id="obsBox"></div></section>
          <section class="card"><h2>Segurança</h2><div id="securityBox"></div></section>
        </div>
        <div class="grid grid-2">
          <section class="card"><h2>LGPD e Governança de Dados</h2><div id="lgpdBox"></div></section>
          <section class="card"><h2>Incidentes, Anomalias e Hardening</h2><div id="incidentBox"></div></section>
        </div>
      </div>
    `;
    $('#btnSeed')?.addEventListener('click', async () => { await post('/api/security-enterprise/seed-defaults', {}); await load(); });
    $('#btnLog')?.addEventListener('click', createLog);
    $('#btnHealth')?.addEventListener('click', async () => { await post('/api/observability/health-checks/run', {}); await load(); });
    $('#btnSession')?.addEventListener('click', createSession);
    $('#btnAsset')?.addEventListener('click', createAsset);
    $('#btnLgpd')?.addEventListener('click', createLgpdRequest);
    $('#btnIncident')?.addEventListener('click', createIncident);
    $('#btnHardening')?.addEventListener('click', async () => { await post('/api/security/hardening/run', {}); await load(); });
    $('#btnReload')?.addEventListener('click', load);
    await load();
  }

  async function load() {
    try {
      const [dash, logs, health, sessions, assets, lgpdReq, incidents, anomalies, hardening, forensic] = await Promise.all([
        get('/api/security-enterprise/dashboard'),
        get('/api/observability/logs'),
        get('/api/observability/health-checks'),
        get('/api/security/sessions'),
        get('/api/data-governance/assets'),
        get('/api/lgpd/requests'),
        get('/api/security/incidents'),
        get('/api/security/anomalies'),
        get('/api/security/hardening'),
        get('/api/security/forensic-audit')
      ]);

      $('#secKpis').innerHTML = `
        <div class="kpi-card"><span>Logs</span><strong>${total(dash.logs)}</strong></div>
        <div class="kpi-card"><span>Sessões</span><strong>${total(dash.sessions)}</strong></div>
        <div class="kpi-card"><span>Incidentes</span><strong>${total(dash.incidents)}</strong></div>
        <div class="kpi-card"><span>Anomalias</span><strong>${total(dash.anomalies)}</strong></div>
      `;
      renderObs(logs.items || [], health.items || []);
      renderSecurity(sessions.items || [], forensic.items || []);
      renderLgpd(assets.items || [], lgpdReq.items || []);
      renderIncidents(incidents.items || [], anomalies.items || [], hardening.items || []);
    } catch(e) { err(e); }
  }

  function renderObs(logs, health) {
    $('#obsBox').innerHTML = `
      <h3>Logs recentes</h3>
      ${logs.length ? logs.slice(0,8).map(l => `<p><strong>${esc(l.level)}</strong> — ${esc(l.event_name)} · ${esc(l.module || '')}</p>`).join('') : '<p>Sem logs.</p>'}
      <h3>Health Checks</h3>
      ${health.length ? health.slice(0,8).map(h => `<p><strong>${esc(h.component)}</strong> — ${esc(h.status)} · ${esc(h.latency_ms || 0)}ms</p>`).join('') : '<p>Sem checks.</p>'}
    `;
  }

  function renderSecurity(sessions, forensic) {
    $('#securityBox').innerHTML = `
      <h3>Sessões</h3>
      ${sessions.length ? sessions.slice(0,8).map(s => `
        <div class="list-row">
          <div><strong>${esc(s.user_id || 'user')}</strong><small>${esc(s.status)} · MFA ${s.mfa_verified ? 'sim' : 'não'} · ${esc(s.ip_address || '')}</small></div>
          <button class="btn btn-sm" data-revoke="${esc(s.id)}">Revogar</button>
        </div>`).join('') : '<p>Sem sessões.</p>'}
      <h3>Auditoria Forense</h3>
      ${forensic.length ? forensic.slice(0,6).map(f => `<p><strong>${esc(f.action)}</strong> — hash ${esc(String(f.event_hash || '').slice(0,12))}</p>`).join('') : '<p>Sem auditoria forense.</p>'}
    `;
    document.querySelectorAll('[data-revoke]').forEach(b => b.addEventListener('click', async () => { await post(`/api/security/sessions/${b.dataset.revoke}/revoke`, { reason:'revogado pela interface' }); await load(); }));
  }

  function renderLgpd(assets, reqs) {
    $('#lgpdBox').innerHTML = `
      <h3>Data Assets</h3>
      ${assets.length ? assets.slice(0,8).map(a => `<p><strong>${esc(a.asset_name)}</strong> — ${esc(a.entity_type)}.${esc(a.field_name || '*')} · ${esc(a.classification)}</p>`).join('') : '<p>Sem ativos classificados.</p>'}
      <h3>Solicitações LGPD</h3>
      ${reqs.length ? reqs.slice(0,8).map(r => `<p><strong>${esc(r.request_type)}</strong> — ${esc(r.status)} · vence ${esc(r.due_at || '')}</p>`).join('') : '<p>Sem solicitações LGPD.</p>'}
    `;
  }

  function renderIncidents(incidents, anomalies, hardening) {
    $('#incidentBox').innerHTML = `
      <h3>Incidentes</h3>
      ${incidents.length ? incidents.slice(0,8).map(i => `
        <div class="list-row">
          <div><strong>${esc(i.codigo)}</strong><small>${esc(i.severity)} · ${esc(i.status)} · ${esc(i.titulo)}</small></div>
          <button class="btn btn-sm" data-ack="${esc(i.id)}">Ack</button>
          <button class="btn btn-sm" data-res="${esc(i.id)}">Resolver</button>
        </div>`).join('') : '<p>Sem incidentes.</p>'}
      <h3>Anomalias</h3>
      ${anomalies.length ? anomalies.slice(0,6).map(a => `<p><strong>${esc(a.title)}</strong> — ${esc(a.severity)} · risco ${esc(a.risk_score)}</p>`).join('') : '<p>Sem anomalias.</p>'}
      <h3>Hardening</h3>
      ${hardening.length ? hardening.slice(0,8).map(h => `<p><strong>${esc(h.check_code)}</strong> — ${esc(h.status)} · ${esc(h.severity)}</p>`).join('') : '<p>Sem hardening checks.</p>'}
    `;
    document.querySelectorAll('[data-ack]').forEach(b => b.addEventListener('click', async () => { await post(`/api/security/incidents/${b.dataset.ack}/ack`, {}); await load(); }));
    document.querySelectorAll('[data-res]').forEach(b => b.addEventListener('click', async () => { await post(`/api/security/incidents/${b.dataset.res}/resolve`, { resolution_summary:'Resolvido pela interface.' }); await load(); }));
  }

  async function createLog() {
    await post('/api/observability/logs', {
      level: prompt('Level:', 'info'),
      module: prompt('Módulo:', 'security'),
      event_name: prompt('Evento:', 'manual_log'),
      message: prompt('Mensagem:', 'Log manual de teste.')
    });
    await load();
  }

  async function createSession() {
    const r = await post('/api/security/sessions', {
      ip_address: prompt('IP:', '127.0.0.1'),
      user_agent: 'manual-ui',
      mfa_verified: confirm('MFA verificado?')
    });
    alert(`Session token gerado. Copie agora: ${r.session_token}`);
    await load();
  }

  async function createAsset() {
    await post('/api/data-governance/assets', {
      entity_type: prompt('Entity:', 'crm_contacts'),
      field_name: prompt('Field:', 'email'),
      asset_name: prompt('Nome:', 'E-mail do contato'),
      classification: prompt('Classificação:', 'personal_data'),
      contains_personal_data: true,
      lawful_basis: prompt('Base legal:', 'legitimate_interest')
    });
    await load();
  }

  async function createLgpdRequest() {
    const ds = await post('/api/lgpd/data-subjects', {
      name: prompt('Nome titular:', 'Cliente Teste'),
      email: prompt('E-mail:', 'cliente@example.com')
    });
    await post('/api/lgpd/requests', {
      data_subject_id: ds.id,
      request_type: prompt('Tipo:', 'access'),
      description: prompt('Descrição:', 'Solicitação de acesso aos dados.')
    });
    await load();
  }

  async function createIncident() {
    await post('/api/security/incidents', {
      titulo: prompt('Título:', 'Incidente de segurança'),
      descricao: prompt('Descrição:', 'Evento suspeito identificado.'),
      severity: prompt('Severidade:', 'high'),
      category: prompt('Categoria:', 'security')
    });
    await load();
  }

  function err(e) { console.error(e); alert(e?.message || 'Erro em segurança enterprise'); }

  window.NexusSecurityEnterprise = { mount, load };
})();

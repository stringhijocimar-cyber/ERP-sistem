// public/js/pages/production_readiness_api.js
// NEXUS ERP — Etapa 32: Performance, Escalabilidade e Production Readiness.
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
          <h1>Production Readiness</h1>
          <p>Cache, jobs assíncronos, scheduler, locks, performance, backup/restore, feature flags, releases e readiness.</p>
        </div>
        <div class="grid grid-4" id="prodKpis"></div>
        <div class="toolbar wrap">
          <button class="btn btn-primary" id="btnSeed">Seed Defaults</button>
          <button class="btn" id="btnCache">Cache</button>
          <button class="btn" id="btnJob">Job</button>
          <button class="btn" id="btnProcess">Processar Job</button>
          <button class="btn" id="btnSchedule">Scheduler</button>
          <button class="btn" id="btnBackup">Backup</button>
          <button class="btn" id="btnReadiness">Readiness</button>
          <button class="btn" id="btnRelease">Release</button>
          <button class="btn" id="btnReload">Atualizar</button>
        </div>
        <div class="grid grid-2">
          <section class="card"><h2>Cache, Filas e Jobs</h2><div id="jobsBox"></div></section>
          <section class="card"><h2>Performance e Capacidade</h2><div id="perfBox"></div></section>
        </div>
        <div class="grid grid-2">
          <section class="card"><h2>Backup, Restore e Readiness</h2><div id="backupBox"></div></section>
          <section class="card"><h2>Feature Flags e Releases</h2><div id="releaseBox"></div></section>
        </div>
      </div>
    `;
    $('#btnSeed')?.addEventListener('click', async () => { await post('/api/production/seed-defaults', {}); await load(); });
    $('#btnCache')?.addEventListener('click', setCache);
    $('#btnJob')?.addEventListener('click', createJob);
    $('#btnProcess')?.addEventListener('click', async () => { await post('/api/async/jobs/process-next', {}); await load(); });
    $('#btnSchedule')?.addEventListener('click', createSchedule);
    $('#btnBackup')?.addEventListener('click', createBackup);
    $('#btnReadiness')?.addEventListener('click', async () => { await post('/api/production/readiness/run', {}); await load(); });
    $('#btnRelease')?.addEventListener('click', createRelease);
    $('#btnReload')?.addEventListener('click', load);
    await load();
  }

  async function load() {
    try {
      const [dash, queues, jobs, readiness, flags, releases, backups, audit] = await Promise.all([
        get('/api/production/dashboard'),
        get('/api/async/queues'),
        get('/api/async/jobs'),
        get('/api/production/readiness'),
        get('/api/feature-flags'),
        get('/api/releases'),
        get('/api/backups/logical'),
        get('/api/production/audit')
      ]);
      $('#prodKpis').innerHTML = `
        <div class="kpi-card"><span>Jobs</span><strong>${total(dash.jobs)}</strong></div>
        <div class="kpi-card"><span>Filas</span><strong>${total(dash.queues)}</strong></div>
        <div class="kpi-card"><span>Readiness</span><strong>${total(dash.readiness)}</strong></div>
        <div class="kpi-card"><span>Flags</span><strong>${total(dash.feature_flags)}</strong></div>
      `;
      renderJobs(queues.items || [], jobs.items || [], dash.cache || []);
      renderPerf(dash.limits, dash.locks || []);
      renderBackups(backups.items || [], readiness.items || []);
      renderReleases(flags.items || [], releases.items || [], audit.items || []);
    } catch(e) { err(e); }
  }

  function renderJobs(queues, jobs, cache) {
    $('#jobsBox').innerHTML = `
      <h3>Cache</h3>
      ${cache.length ? cache.map(c => `<p><strong>${esc(c.namespace)}</strong> — ${esc(c.qtd)} entradas · hits ${esc(c.hits || 0)}</p>`).join('') : '<p>Sem cache.</p>'}
      <h3>Filas</h3>
      ${queues.length ? queues.slice(0,6).map(q => `<p><strong>${esc(q.codigo)}</strong> — ${esc(q.status)} · conc. ${esc(q.max_concurrency)}</p>`).join('') : '<p>Sem filas.</p>'}
      <h3>Jobs</h3>
      ${jobs.length ? jobs.slice(0,10).map(j => `<p><strong>${esc(j.job_type)}</strong> — ${esc(j.status)} · ${esc(j.queue_codigo || '')}</p>`).join('') : '<p>Sem jobs.</p>'}
    `;
  }

  function renderPerf(limits, locks) {
    $('#perfBox').innerHTML = `
      <p>Limites configurados: <strong>${esc(limits?.qtd || 0)}</strong></p>
      <h3>Locks</h3>
      ${locks.length ? locks.map(l => `<p>${esc(l.status)} — ${esc(l.qtd)}</p>`).join('') : '<p>Sem locks ativos.</p>'}
    `;
  }

  function renderBackups(backups, readiness) {
    $('#backupBox').innerHTML = `
      <h3>Backups</h3>
      ${backups.length ? backups.slice(0,8).map(b => `<p><strong>${esc(b.backup_code)}</strong> — ${esc(b.status)} · ${esc(b.file_url || '')}</p>`).join('') : '<p>Sem backups.</p>'}
      <h3>Readiness</h3>
      ${readiness.length ? readiness.slice(0,10).map(r => `<p><strong>${esc(r.check_code)}</strong> — ${esc(r.status)} · ${esc(r.severity)}</p>`).join('') : '<p>Sem checks.</p>'}
    `;
  }

  function renderReleases(flags, releases, audit) {
    $('#releaseBox').innerHTML = `
      <h3>Feature Flags</h3>
      ${flags.length ? flags.slice(0,8).map(f => `<p><strong>${esc(f.flag_key)}</strong> — ${f.enabled ? 'on' : 'off'} · rollout ${esc(f.rollout_percent)}%</p>`).join('') : '<p>Sem flags.</p>'}
      <h3>Releases</h3>
      ${releases.length ? releases.slice(0,8).map(r => `<p><strong>${esc(r.release_code)}</strong> — ${esc(r.version)} · ${esc(r.status)}</p>`).join('') : '<p>Sem releases.</p>'}
      <h3>Audit</h3>
      ${audit.length ? audit.slice(0,5).map(a => `<p>${esc(a.event_type)} — ${esc(a.entity_type || '')}:${esc(a.entity_id || '')}</p>`).join('') : '<p>Sem auditoria.</p>'}
    `;
  }

  async function setCache() {
    await post('/api/runtime/cache/set', {
      namespace: prompt('Namespace:', 'dashboard'),
      cache_key: prompt('Key:', 'home_kpis'),
      value_json: { value: prompt('Valor:', 'demo') },
      expires_at: new Date(Date.now()+3600000).toISOString()
    });
    await load();
  }

  async function createJob() {
    await post('/api/async/jobs', {
      queue_codigo: prompt('Fila:', 'default'),
      job_type: prompt('Tipo:', 'manual_test'),
      priority: Number(prompt('Prioridade:', '5')) || 5,
      payload_json: { source:'ui' }
    });
    await load();
  }

  async function createSchedule() {
    const queues = await get('/api/async/queues');
    await post('/api/scheduler/tasks', {
      codigo: prompt('Código:', `sch_${Date.now()}`),
      nome: prompt('Nome:', 'Scheduler Teste'),
      interval_minutes: Number(prompt('Intervalo minutos:', '60')) || 60,
      target_queue_id: prompt('Queue ID:', queues.items?.[0]?.id || ''),
      job_type: prompt('Job type:', 'scheduled_test'),
      next_run_at: new Date().toISOString()
    });
    await post('/api/scheduler/run-due', {});
    await load();
  }

  async function createBackup() {
    await post('/api/backups/logical', {
      backup_code: prompt('Código:', `BKP-${Date.now()}`),
      scope_json: { modules:['core','security','workflow'] }
    });
    await load();
  }

  async function createRelease() {
    const rel = await post('/api/releases', {
      release_code: prompt('Release code:', `REL-${Date.now()}`),
      version: prompt('Versão:', '1.0.0'),
      title: prompt('Título:', 'Release Production Readiness'),
      changelog_json: ['Ajustes operacionais']
    });
    if (confirm('Deploy agora em modo governado?')) {
      await post(`/api/releases/${rel.id}/deploy`, {});
    }
    await load();
  }

  function err(e) { console.error(e); alert(e?.message || 'Erro em production readiness'); }

  window.NexusProductionReadiness = { mount, load };
})();

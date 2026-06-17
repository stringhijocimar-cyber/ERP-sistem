// public/js/pages/enterprise_consolidation_api.js
// NEXUS ERP — Etapa 33: Consolidação Enterprise.
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
          <h1>NEXUS Enterprise Console</h1>
          <p>Consolidação final: módulos, menu executivo, checklists, testes integrados, pacote enterprise e handoff Claude/Genspark.</p>
        </div>
        <div class="grid grid-4" id="entKpis"></div>
        <div class="toolbar wrap">
          <button class="btn btn-primary" id="btnSeed">Seed Defaults</button>
          <button class="btn" id="btnTest">Simular Smoke Integrado</button>
          <button class="btn" id="btnNote">Handoff Note</button>
          <button class="btn" id="btnApprove">Aprovar Pacote</button>
          <button class="btn" id="btnReload">Atualizar</button>
        </div>
        <div class="grid grid-2">
          <section class="card"><h2>Catálogo de Módulos</h2><div id="modulesBox"></div></section>
          <section class="card"><h2>Menu Executivo</h2><div id="menuBox"></div></section>
        </div>
        <div class="grid grid-2">
          <section class="card"><h2>Checklists e Testes</h2><div id="qualityBox"></div></section>
          <section class="card"><h2>Pacote Enterprise</h2><div id="packageBox"></div></section>
        </div>
      </div>
    `;
    $('#btnSeed')?.addEventListener('click', async () => { await post('/api/enterprise-consolidation/seed-defaults', {}); await load(); });
    $('#btnTest')?.addEventListener('click', async () => { await post('/api/enterprise-consolidation/test-runs/simulate', {}); await load(); });
    $('#btnNote')?.addEventListener('click', createNote);
    $('#btnApprove')?.addEventListener('click', approvePackage);
    $('#btnReload')?.addEventListener('click', load);
    await load();
  }

  async function load() {
    try {
      const [dash, modules, menu, checklists, runs, packages] = await Promise.all([
        get('/api/enterprise-consolidation/dashboard'),
        get('/api/enterprise-consolidation/modules'),
        get('/api/enterprise-consolidation/menu'),
        get('/api/enterprise-consolidation/checklists'),
        get('/api/enterprise-consolidation/test-runs'),
        get('/api/enterprise-consolidation/packages')
      ]);

      $('#entKpis').innerHTML = `
        <div class="kpi-card"><span>Módulos</span><strong>${total(dash.modules)}</strong></div>
        <div class="kpi-card"><span>Menus</span><strong>${dash.menus?.qtd || 0}</strong></div>
        <div class="kpi-card"><span>Checklists</span><strong>${total(dash.checklists)}</strong></div>
        <div class="kpi-card"><span>Pacotes</span><strong>${total(dash.packages)}</strong></div>
      `;

      $('#modulesBox').innerHTML = modules.items?.length
        ? modules.items.map(m => `<p><strong>${esc(m.module_code)}</strong> — ${esc(m.module_name)} · ${esc(m.category)} · ${esc(m.maturity_level)}</p>`).join('')
        : '<p>Sem módulos consolidados.</p>';

      $('#menuBox').innerHTML = menu.items?.length
        ? menu.items.map(i => `<p><strong>${esc(i.label)}</strong> — ${esc(i.route_path)} · ${esc(i.icon || '')}</p>`).join('')
        : '<p>Sem menu executivo.</p>';

      $('#qualityBox').innerHTML = `
        <h3>Checklists</h3>
        ${checklists.items?.length ? checklists.items.map(c => `<p><strong>${esc(c.checklist_code)}</strong> — ${esc(c.category)} · ${esc(c.status)}</p>`).join('') : '<p>Sem checklists.</p>'}
        <h3>Test Runs</h3>
        ${runs.items?.length ? runs.items.slice(0,6).map(r => `<p><strong>${esc(r.status)}</strong> — ${esc(r.passed_tests)}/${esc(r.total_tests)} aprovados</p>`).join('') : '<p>Sem execuções.</p>'}
      `;

      $('#packageBox').innerHTML = packages.items?.length
        ? packages.items.map(p => `<p><strong>${esc(p.package_code)}</strong> — ${esc(p.version)} · ${esc(p.status)}</p><small>${esc(p.handoff_notes || '')}</small>`).join('')
        : '<p>Sem pacote enterprise.</p>';
    } catch(e) { err(e); }
  }

  async function createNote() {
    await post('/api/enterprise-consolidation/handoff-notes', {
      note_code: prompt('Código:', `NOTE-${Date.now()}`),
      title: prompt('Título:', 'Ponto de atenção para continuidade'),
      audience: prompt('Audiência:', 'developer'),
      priority: prompt('Prioridade:', 'high'),
      content: prompt('Conteúdo:', 'Validar integrações reais, migrations e smoke tests no ambiente alvo.')
    });
    await load();
  }

  async function approvePackage() {
    const pkgs = await get('/api/enterprise-consolidation/packages');
    const id = prompt('Package ID:', pkgs.items?.[0]?.id || '');
    if (!id) return;
    await post(`/api/enterprise-consolidation/packages/${id}/approve`, {});
    await load();
  }

  function err(e) { console.error(e); alert(e?.message || 'Erro em consolidação enterprise'); }

  window.NexusEnterpriseConsolidation = { mount, load };
})();

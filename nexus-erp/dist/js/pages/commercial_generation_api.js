// public/js/pages/commercial_generation_api.js
// NEXUS ERP — Etapa 23: Geração Comercial e Sales Enablement.
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
          <h1>Geração Comercial</h1>
          <p>Propostas, one-pagers, demos, pitch decks, business cases e planos de implantação por segmento.</p>
        </div>
        <div class="grid grid-4" id="commKpis"></div>
        <div class="toolbar wrap">
          <button class="btn btn-primary" id="btnSeed">Seed Defaults</button>
          <button class="btn" id="btnProposal">Proposta</button>
          <button class="btn" id="btnOnePager">One-pager</button>
          <button class="btn" id="btnDemo">Demo Script</button>
          <button class="btn" id="btnDeck">Pitch Deck</button>
          <button class="btn" id="btnCase">Business Case</button>
          <button class="btn" id="btnPlan">Plano Implantação</button>
          <button class="btn" id="btnReload">Atualizar</button>
        </div>
        <div class="grid grid-2">
          <section class="card"><h2>Propostas e Materiais</h2><div id="materialsBox"></div></section>
          <section class="card"><h2>Demos e Pitch</h2><div id="pitchBox"></div></section>
        </div>
        <div class="grid grid-2">
          <section class="card"><h2>Business Case e Implantação</h2><div id="businessBox"></div></section>
          <section class="card"><h2>Templates e Personas</h2><div id="templatesBox"></div></section>
        </div>
      </div>
    `;
    $('#btnSeed')?.addEventListener('click', async () => { await post('/api/commercial/seed-defaults', {}); await load(); });
    $('#btnProposal')?.addEventListener('click', generateProposal);
    $('#btnOnePager')?.addEventListener('click', async () => { await post('/api/commercial/one-pagers/generate', { segmento_codigo: prompt('Segmento:', 'servicos_industriais') }); await load(); });
    $('#btnDemo')?.addEventListener('click', async () => { await post('/api/commercial/demo-scripts/generate', { segmento_codigo: prompt('Segmento:', 'servicos_industriais') }); await load(); });
    $('#btnDeck')?.addEventListener('click', async () => { await post('/api/commercial/pitch-decks/generate', { segmento_codigo: prompt('Segmento:', 'servicos_industriais') }); await load(); });
    $('#btnCase')?.addEventListener('click', generateCase);
    $('#btnPlan')?.addEventListener('click', async () => { await post('/api/commercial/implementation-plans/generate', { segmento_codigo: prompt('Segmento:', 'servicos_industriais') }); await load(); });
    $('#btnReload')?.addEventListener('click', load);
    await load();
  }

  async function load() {
    try {
      const [dash, proposals, onep, demos, decks, cases, plans, templates, personas, assets] = await Promise.all([
        get('/api/commercial/dashboard'),
        get('/api/commercial/proposals'),
        get('/api/commercial/one-pagers'),
        get('/api/commercial/demo-scripts'),
        get('/api/commercial/pitch-decks'),
        get('/api/commercial/business-cases'),
        get('/api/commercial/implementation-plans'),
        get('/api/commercial/templates'),
        get('/api/commercial/personas'),
        get('/api/commercial/assets')
      ]);
      $('#commKpis').innerHTML = `
        <div class="kpi-card"><span>Propostas</span><strong>${total(dash.proposals)}</strong></div>
        <div class="kpi-card"><span>One-pagers</span><strong>${total(dash.one_pagers)}</strong></div>
        <div class="kpi-card"><span>Demos/Decks</span><strong>${total(dash.demos)+total(dash.decks)}</strong></div>
        <div class="kpi-card"><span>Assets</span><strong>${total(dash.assets)}</strong></div>
      `;
      renderMaterials(proposals.items || [], onep.items || [], assets.items || []);
      renderPitch(demos.items || [], decks.items || []);
      renderBusiness(cases.items || [], plans.items || []);
      renderTemplates(templates.items || [], personas.items || []);
    } catch(e) { err(e); }
  }

  function renderMaterials(proposals, onep, assets) {
    $('#materialsBox').innerHTML = `
      <h3>Propostas</h3>
      ${proposals.length ? proposals.slice(0,8).map(p => `
        <div class="list-row">
          <div><strong>${esc(p.codigo)}</strong><small>${esc(p.cliente_nome)} · ${esc(p.status)} · ${money(p.valor_estimado)}</small></div>
          <button class="btn btn-sm" data-approve="${esc(p.id)}">Aprovar</button>
        </div>`).join('') : '<p>Sem propostas.</p>'}
      <h3>One-pagers</h3>
      ${onep.length ? onep.slice(0,5).map(o => `<p><strong>${esc(o.titulo)}</strong> — ${esc(o.status)}</p>`).join('') : '<p>Sem one-pagers.</p>'}
      <h3>Assets</h3>
      ${assets.length ? assets.slice(0,5).map(a => `<p>${esc(a.titulo)} · ${esc(a.entidade_tipo)} · ${esc(a.status)}</p>`).join('') : '<p>Sem assets exportados.</p>'}
    `;
    document.querySelectorAll('[data-approve]').forEach(b => b.addEventListener('click', async () => { await post(`/api/commercial/proposals/${b.dataset.approve}/approve`, { comentario:'Aprovado pela interface.' }); await load(); }));
  }

  function renderPitch(demos, decks) {
    $('#pitchBox').innerHTML = `
      <h3>Demo Scripts</h3>
      ${demos.length ? demos.slice(0,8).map(d => `<p><strong>${esc(d.titulo)}</strong> — ${esc(d.status)} · ${esc(d.duracao_minutos)} min</p>`).join('') : '<p>Sem demos.</p>'}
      <h3>Pitch Decks</h3>
      ${decks.length ? decks.slice(0,8).map(d => `<p><strong>${esc(d.titulo)}</strong> — ${esc(d.status)} · ${esc(d.publico_alvo)}</p>`).join('') : '<p>Sem decks.</p>'}
    `;
  }

  function renderBusiness(cases, plans) {
    $('#businessBox').innerHTML = `
      <h3>Business Cases</h3>
      ${cases.length ? cases.slice(0,8).map(c => `<p><strong>${esc(c.titulo)}</strong> — ROI ${Number(c.roi_percentual || 0).toFixed(1)}% · Payback ${Number(c.payback_meses || 0).toFixed(1)} meses</p>`).join('') : '<p>Sem business cases.</p>'}
      <h3>Planos de Implantação</h3>
      ${plans.length ? plans.slice(0,8).map(p => `<p><strong>${esc(p.titulo)}</strong> — ${esc(p.duracao_total_dias)} dias · ${esc(p.status)}</p>`).join('') : '<p>Sem planos.</p>'}
    `;
  }

  function renderTemplates(templates, personas) {
    $('#templatesBox').innerHTML = `
      <h3>Templates</h3>
      ${templates.length ? templates.map(t => `<p><strong>${esc(t.codigo)}</strong> — ${esc(t.nome)} · ${esc(t.tipo)}</p>`).join('') : '<p>Sem templates. Rode Seed Defaults.</p>'}
      <h3>Personas</h3>
      ${personas.length ? personas.map(p => `<p><strong>${esc(p.codigo)}</strong> — ${esc(p.nome)}</p>`).join('') : '<p>Sem personas.</p>'}
    `;
  }

  async function generateProposal() {
    const runs = await get('/api/competitive/comparison-runs').catch(()=>({items:[]}));
    await post('/api/commercial/proposals/generate', {
      cliente_nome: prompt('Cliente:', 'Cliente Demo'),
      segmento_codigo: prompt('Segmento:', 'servicos_industriais'),
      comparison_run_id: prompt('Comparison Run ID opcional:', runs.items?.[0]?.id || ''),
      valor_estimado: Number(prompt('Valor estimado:', '50000')) || 0,
      prazo_implantacao_dias: Number(prompt('Prazo implantação dias:', '30')) || 30
    });
    await load();
  }

  async function generateCase() {
    await post('/api/commercial/business-cases/generate', {
      cliente_nome: prompt('Cliente:', 'Cliente Demo'),
      segmento_codigo: prompt('Segmento:', 'servicos_industriais'),
      titulo: prompt('Título:', 'Business Case NEXUS ERP'),
      ganhos_json: [
        { descricao:'Redução de retrabalho administrativo', valor_anual:Number(prompt('Ganho anual estimado:', '120000')) || 0 }
      ],
      custos_json: [
        { descricao:'Implantação e assinatura inicial', valor:Number(prompt('Custo estimado:', '50000')) || 0 }
      ]
    });
    await load();
  }

  function err(e) { console.error(e); alert(e?.message || 'Erro em geração comercial'); }

  window.NexusCommercialGeneration = { mount, load };
})();

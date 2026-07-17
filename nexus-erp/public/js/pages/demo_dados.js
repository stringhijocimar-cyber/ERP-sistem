// =====================================================
// Dados de Demonstração — aba dedicada para inserir/simular dados em TODOS os
// módulos e CONFERIR (contagem ao vivo por módulo + link "Abrir").
// Chama POST /api/demo/seed (idempotente + top-up) e relê as contagens.
// =====================================================

// Módulos que o seed popula, com a rota de navegação e o endpoint de contagem.
function _demoDadosModulos() {
  return [
    { label: 'Materiais (MM / BOM)',   rota: 'mm',            api: '/api/mm/materiais',      icon: 'sitemap' },
    { label: 'Produção (PP)',          rota: 'pp',            api: '/api/pp/ordens',         icon: 'industry' },
    { label: 'Estoque / Almoxarifado', rota: 'estoque',       api: '/api/almoxarifado',      icon: 'boxes-stacked' },
    { label: 'WMS — Endereçamento',    rota: 'wms',           api: '/api/wms/enderecos',     icon: 'warehouse' },
    { label: 'SSMA — Ocorrências',     rota: 'ssma',          api: '/api/ssma',              icon: 'helmet-safety' },
    { label: 'Treinamentos',           rota: 'treinamentos',  api: '/api/ssma/treinamentos', icon: 'graduation-cap' },
    { label: 'Fornecedores',           rota: 'fornecedores',  api: '/api/fornecedores',      icon: 'building' },
    { label: 'Requisições (RC)',       rota: 'requisicoes',   api: '/api/rc',                icon: 'file-lines' },
    { label: 'Cotações (RFQ)',         rota: 'rfq',           api: '/api/rfq',               icon: 'file-signature' },
    { label: 'Mapa Comparativo',       rota: 'mapa_cotacao',  api: '/api/mapas',             icon: 'scale-balanced' },
    { label: 'Pedidos de Compra',      rota: 'pedidos',       api: '/api/pedidos',           icon: 'file-invoice' },
    { label: 'Contas a Receber',       rota: 'financeiro',    api: '/api/contas-receber',    icon: 'hand-holding-dollar' },
    { label: 'CRM / Oportunidades',    rota: 'crm',           api: '/api/crm',               icon: 'handshake' },
    { label: 'Projetos',               rota: 'projetos_gantt',api: '/api/projetos',          icon: 'diagram-project' },
    { label: 'Colaboradores (RH)',     rota: 'rh',            api: '/api/colaboradores',     icon: 'users' },
  ];
}

// Busca a contagem de cada módulo (silencioso: sem servidor → null).
async function _demoDadosCarregarContagens() {
  if (typeof apiAuth !== 'function') return null;
  const mods = _demoDadosModulos();
  const contagens = {};
  await Promise.all(mods.map(async m => {
    try {
      const d = await apiAuth(m.api);
      contagens[m.rota] = Array.isArray(d) ? d.length : (d && Array.isArray(d.data) ? d.data.length : 0);
    } catch (e) { contagens[m.rota] = null; }
  }));
  return contagens;
}
window._demoDadosCarregarContagens = _demoDadosCarregarContagens;

// Render puro (testável): estado = { contagens: {rota:n}|null, semServidor:bool }.
function _demoDadosHTML(estado) {
  const esc = v => (window.NexusAPI ? NexusAPI.escapeHtml(v) : String(v == null ? '' : v));
  const mods = _demoDadosModulos();
  const contagens = (estado && estado.contagens) || {};
  const semServidor = !!(estado && estado.semServidor);
  const totalComDados = mods.filter(m => (contagens[m.rota] || 0) > 0).length;

  const cards = mods.map(m => {
    const n = contagens[m.rota];
    const temDados = (n || 0) > 0;
    const cor = temDados ? '#22c55e' : (n === null ? '#94a3b8' : '#f59e0b');
    const badge = n === null ? '—' : String(n);
    const rotulo = temDados ? `${badge} registro(s)` : (n === null ? 'sem servidor' : 'vazio');
    return `
      <div style="border:1px solid var(--border-color);border-left:4px solid ${cor};border-radius:10px;padding:12px 14px;background:var(--bg-card);display:flex;align-items:center;gap:12px">
        <div style="width:36px;height:36px;border-radius:8px;background:rgba(0,180,184,0.10);display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <i class="fas fa-${esc(m.icon)}" style="color:var(--fa-teal)"></i>
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:13px;color:var(--text-primary)">${esc(m.label)}</div>
          <div style="font-size:11px;color:${cor};font-weight:600">
            <i class="fas fa-${temDados ? 'circle-check' : (n === null ? 'plug-circle-xmark' : 'circle-exclamation')}" style="margin-right:4px"></i>${rotulo}
          </div>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="navigate('${esc(m.rota)}')" title="Abrir módulo" style="flex-shrink:0">
          Abrir <i class="fas fa-arrow-right" style="margin-left:4px"></i>
        </button>
      </div>`;
  }).join('');

  return `
    <div class="page-header">
      <div class="page-title">
        <h2><i class="fas fa-wand-magic-sparkles" style="color:var(--fa-teal);margin-right:8px"></i>Dados de Demonstração</h2>
        <p>Insira um cenário industrial completo em todos os módulos para explorar e validar o sistema.</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary" id="btnSimularDemo" onclick="simularDadosDemo()">
          <i class="fas fa-wand-magic-sparkles" style="margin-right:6px"></i>Inserir dados de simulação
        </button>
      </div>
    </div>

    <div style="background:rgba(59,130,246,0.07);border:1px solid rgba(59,130,246,0.25);border-radius:10px;padding:12px 16px;margin-bottom:18px;display:flex;gap:12px;align-items:flex-start">
      <i class="fas fa-circle-info" style="color:#3b82f6;font-size:15px;margin-top:2px;flex-shrink:0"></i>
      <div style="font-size:12.5px;color:var(--text-secondary);line-height:1.6">
        Clique em <strong>Inserir dados de simulação</strong> para popular um cenário coerente (BOM do VBTP Guarani II, produção, estoque endereçado, SSMA, funil de compras e financeiro).
        É <strong>seguro e não duplica</strong>: se você já rodou antes, apenas completa os módulos que estiverem vazios. Requer perfil <strong>administrador</strong>.
        ${semServidor ? '<br><span style="color:#f59e0b;font-weight:700"><i class="fas fa-triangle-exclamation"></i> Servidor indisponível — conecte-se para inserir dados.</span>' : ''}
      </div>
    </div>

    <div class="card" style="margin-bottom:18px">
      <div class="card-header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
        <h3 style="margin:0"><i class="fas fa-list-check" style="color:var(--fa-teal);margin-right:8px"></i>Situação por módulo</h3>
        <span style="font-size:11px;color:var(--text-muted);background:var(--bg-tertiary);padding:3px 10px;border-radius:10px">
          ${totalComDados}/${mods.length} módulo(s) com dados
        </span>
      </div>
      <div style="padding:14px;display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px">
        ${cards}
      </div>
    </div>`;
}
window._demoDadosHTML = _demoDadosHTML;

// Loader: renderiza, busca contagens, re-renderiza.
async function renderDemoDados() {
  const main = document.getElementById('mainContent');
  if (!main) return;
  main.innerHTML = _demoDadosHTML({ contagens: null });
  const contagens = await _demoDadosCarregarContagens();
  main.innerHTML = _demoDadosHTML({ contagens: contagens || {}, semServidor: contagens === null });
}
window.renderDemoDados = renderDemoDados;

// Ação: semeia o cenário demo e relê as contagens.
async function simularDadosDemo() {
  const btn = document.getElementById('btnSimularDemo');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right:6px"></i>Inserindo…'; }
  try {
    if (typeof NexusAPI === 'undefined' || typeof NexusAPI.post !== 'function') {
      if (typeof showToast === 'function') showToast('Servidor indisponível — não foi possível inserir dados.', 'error');
      return;
    }
    const r = await NexusAPI.post('/api/demo/seed', {});
    if (!r || !Array.isArray(r.roteiro)) {
      // Mensagem HONESTA conforme o erro real — antes dizia sempre "apenas
      // administrador", escondendo falhas de CORS/rede/sessão.
      let msg;
      if (r && r.status === 403) msg = 'Sem permissão: seu usuário precisa ter perfil administrador para semear.';
      else if (r && r.status === 401) msg = 'Sessão expirada — saia e entre de novo como administrador.';
      else if (r && r.status) msg = `Falha ao inserir (HTTP ${r.status})${r.error ? ': ' + r.error : ''}.`;
      else msg = 'O servidor não respondeu à gravação (provável CORS/deploy). Atualize o app com Ctrl+Shift+R; se persistir, o backend precisa do último deploy.';
      if (typeof showToast === 'function') showToast(msg, 'error', 8000);
      return;
    }
    const msg = !r.ja_existia
      ? 'Cenário inserido — todos os módulos foram populados!'
      : (r.modulos_completados ? 'Módulos que estavam vazios foram completados!' : 'Os dados já estavam inseridos.');
    if (typeof showToast === 'function') showToast('✅ ' + msg, 'success', 6000);
  } catch (e) {
    if (typeof showToast === 'function') showToast((e && e.message) || 'Falha ao inserir os dados.', 'error');
  } finally {
    await renderDemoDados(); // relê as contagens e mostra o resultado
  }
}
window.simularDadosDemo = simularDadosDemo;

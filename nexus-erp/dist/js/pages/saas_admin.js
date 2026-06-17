// ============================================================
// OpsCore ERP – Módulo SaaS Admin (saas_admin.js)
// Dashboard de negócio, clientes, leads, billing, LGPD
// ============================================================

// ─── UTILIDADES ────────────────────────────────────────────
function fmtBRL(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}
function fmtData(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
function fmtDataHora(d) {
  if (!d) return '—'
  return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}
function diasRestantes(d) {
  if (!d) return null
  const diff = new Date(d) - new Date()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function badgePlano(plano) {
  const cores = {
    trial: '#888', starter: '#e67e22', professional: '#3498db', enterprise: '#9b59b6'
  }
  return `<span style="background:${cores[plano]||'#555'}22;color:${cores[plano]||'#888'};border:1px solid ${cores[plano]||'#555'}44;padding:2px 10px;border-radius:20px;font-size:.72rem;font-weight:700;text-transform:uppercase">${plano || '—'}</span>`
}

function badgeStatus(status) {
  const map = {
    trial: ['#f39c12', 'Trial'], ativo: ['#2ecc71', 'Ativo'], suspenso: ['#e74c3c', 'Suspenso'],
    cancelado: ['#888', 'Cancelado'], excluido: ['#555', 'Excluído'],
    novo: ['#3498db', 'Novo'], contatado: ['#9b59b6', 'Contatado'],
    convertido: ['#2ecc71', 'Convertido'], perdido: ['#e74c3c', 'Perdido'],
    pago: ['#2ecc71', 'Pago'], pendente: ['#f39c12', 'Pendente'], falhou: ['#e74c3c', 'Falhou']
  }
  const [cor, label] = map[status] || ['#888', status || '—']
  return `<span style="background:${cor}22;color:${cor};border:1px solid ${cor}44;padding:2px 10px;border-radius:20px;font-size:.72rem;font-weight:700">${label}</span>`
}

// ─── MOCK DATA (fallback quando API indisponível) ──────────
const MOCK_ORGS = [
  { id: 'org-1', nome: 'Mineração Horizonte Ltda', email: 'contato@mhorizonte.com.br', cnpj: '12.345.678/0001-90', segmento: 'Mineração', plano: 'professional', status: 'ativo', valor_mensalidade: 2490, usuarios_max: 20, trial_fim: null, data_renovacao: '2025-04-30', criado_em: '2025-01-15' },
  { id: 'org-2', nome: 'Construtora Alfa S.A.', email: 'ti@alfa.com.br', cnpj: '98.765.432/0001-11', segmento: 'Construção', plano: 'starter', status: 'ativo', valor_mensalidade: 890, usuarios_max: 5, trial_fim: null, data_renovacao: '2025-04-15', criado_em: '2025-02-10' },
  { id: 'org-3', nome: 'Siderúrgica Beta', email: 'erp@beta.ind.br', cnpj: '45.678.901/0001-22', segmento: 'Siderurgia', plano: 'enterprise', status: 'ativo', valor_mensalidade: 6900, usuarios_max: 999, trial_fim: null, data_renovacao: '2025-05-01', criado_em: '2024-11-20' },
  { id: 'org-4', nome: 'Logística Delta Ltda', email: 'admin@delta.log', cnpj: '11.222.333/0001-44', segmento: 'Logística', plano: 'trial', status: 'trial', valor_mensalidade: 0, usuarios_max: 3, trial_fim: new Date(Date.now() + 8 * 86400000).toISOString(), criado_em: '2025-03-20' },
  { id: 'org-5', nome: 'Energia Épsilon', email: 'gerencia@epsilon.enr', cnpj: '55.666.777/0001-88', segmento: 'Energia', plano: 'trial', status: 'trial', valor_mensalidade: 0, usuarios_max: 3, trial_fim: new Date(Date.now() + 3 * 86400000).toISOString(), criado_em: '2025-03-28' },
  { id: 'org-6', nome: 'Petro Zeta S/A', email: 'ti@zeta.pet', cnpj: '22.333.444/0001-55', segmento: 'Petróleo & Gás', plano: 'professional', status: 'suspenso', valor_mensalidade: 2490, usuarios_max: 20, criado_em: '2025-01-05' },
]

const MOCK_LEADS = [
  { id: 'lead-1', nome: 'Carlos Mendes', email: 'carlos@mineracaop.com', empresa: 'Mineração Prata', telefone: '(31) 99999-1234', segmento: 'Mineração', plano_interesse: 'professional', status: 'novo', criado_em: '2025-03-30' },
  { id: 'lead-2', nome: 'Ana Paula Lima', email: 'apalima@construtmax.com.br', empresa: 'ConstrutMax', telefone: '(11) 98888-5678', segmento: 'Construção', plano_interesse: 'starter', status: 'contatado', criado_em: '2025-03-28' },
  { id: 'lead-3', nome: 'Roberto Farias', email: 'rfarias@siderx.ind.br', empresa: 'SiderX', telefone: '(21) 97777-9012', segmento: 'Siderurgia', plano_interesse: 'enterprise', status: 'convertido', criado_em: '2025-03-15' },
  { id: 'lead-4', nome: 'Mariana Costa', email: 'mcosta@agrofeld.com', empresa: 'AgroFeld', telefone: '(51) 96666-3456', segmento: 'Agro', plano_interesse: 'starter', status: 'perdido', criado_em: '2025-03-10' },
  { id: 'lead-5', nome: 'Paulo Henrique', email: 'ph@petromax.net', empresa: 'PetroMax', telefone: '(71) 95555-7890', segmento: 'Petróleo & Gás', plano_interesse: 'professional', status: 'novo', criado_em: '2025-04-01' },
]

const MOCK_BILLING = [
  { id: 'bill-1', org_id: 'org-3', org_nome: 'Siderúrgica Beta', tipo: 'assinatura', plano_para: 'enterprise', valor: 6900, status: 'pago', gateway: 'asaas', criado_em: '2025-04-01' },
  { id: 'bill-2', org_id: 'org-1', org_nome: 'Mineração Horizonte Ltda', tipo: 'assinatura', plano_para: 'professional', valor: 2490, status: 'pago', gateway: 'asaas', criado_em: '2025-04-01' },
  { id: 'bill-3', org_id: 'org-2', org_nome: 'Construtora Alfa S.A.', tipo: 'assinatura', plano_para: 'starter', valor: 890, status: 'pago', gateway: 'asaas', criado_em: '2025-04-01' },
  { id: 'bill-4', org_id: 'org-6', org_nome: 'Petro Zeta S/A', tipo: 'assinatura', plano_para: 'professional', valor: 2490, status: 'falhou', gateway: 'asaas', criado_em: '2025-04-01' },
  { id: 'bill-5', org_id: 'org-1', org_nome: 'Mineração Horizonte Ltda', tipo: 'upgrade', plano_de: 'starter', plano_para: 'professional', valor: 1600, status: 'pago', gateway: 'manual', criado_em: '2025-03-01' },
]

// ─── FETCH COM FALLBACK ─────────────────────────────────────
async function apiFetch(url, opts = {}) {
  const token = localStorage.getItem('erp_token')
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  })
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  return resp.json()
}

// ═══════════════════════════════════════════════════════════
// DASHBOARD SAAS
// ═══════════════════════════════════════════════════════════
window.renderSaasDashboard = async function () {
  const el = document.getElementById('content')
  el.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title"><i class="fas fa-chart-line text-orange-400 mr-2"></i>Dashboard SaaS</h1>
        <p class="page-subtitle">Visão geral do negócio – Clientes, MRR, Leads e Churn</p>
      </div>
      <button class="btn-primary" onclick="renderSaasDashboard()"><i class="fas fa-sync mr-1"></i>Atualizar</button>
    </div>
    <div id="saas-dash-content"><div class="loading-state"><i class="fas fa-circle-notch fa-spin"></i> Carregando...</div></div>
  `

  try {
    let stats = { orgs: { total: 0, trial: 0, ativos: 0, pagos: 0 }, leads: { total: 0, novos_7d: 0 }, financeiro: { mrr: 0, arr: 0 } }
    try {
      const r = await apiFetch('/api/saas/admin/stats')
      stats = r.data || stats
    } catch {
      // Mock
      stats = {
        orgs: { total: 6, trial: 2, ativos: 4, pagos: 3 },
        leads: { total: 5, novos_7d: 2 },
        financeiro: { mrr: 10280, arr: 123360 },
      }
    }

    const mrr = stats.financeiro?.mrr || 0
    const arr = stats.financeiro?.arr || 0
    const churnRate = 5.2 // mock

    document.getElementById('saas-dash-content').innerHTML = `
      <!-- KPIs -->
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px;margin-bottom:24px">
        ${kpiCard('MRR', fmtBRL(mrr), 'fas fa-dollar-sign', '#2ecc71', '+12% vs mês ant.')}
        ${kpiCard('ARR', fmtBRL(arr), 'fas fa-chart-bar', '#3498db', 'Projeção anual')}
        ${kpiCard('Clientes Ativos', stats.orgs.ativos || 0, 'fas fa-building', '#e67e22', `${stats.orgs.trial || 0} em trial`)}
        ${kpiCard('Leads', stats.leads.total || 0, 'fas fa-funnel-dollar', '#9b59b6', `${stats.leads.novos_7d || 0} novos (7d)`)}
        ${kpiCard('Churn Rate', churnRate + '%', 'fas fa-arrow-down', '#e74c3c', 'Últimos 30 dias')}
        ${kpiCard('LTV Médio', fmtBRL(mrr * 18), 'fas fa-gem', '#f39c12', 'Estimativa 18 meses')}
      </div>

      <!-- Charts row -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px" class="saas-grid-2col">
        <div class="card">
          <div class="card-header"><span class="card-title"><i class="fas fa-chart-pie mr-2 text-orange-400"></i>Distribuição de Planos</span></div>
          <canvas id="chart-planos" height="200"></canvas>
        </div>
        <div class="card">
          <div class="card-header"><span class="card-title"><i class="fas fa-chart-area mr-2 text-blue-400"></i>MRR por Segmento</span></div>
          <canvas id="chart-segmentos" height="200"></canvas>
        </div>
      </div>

      <!-- Trials vencendo -->
      <div class="card mb-4">
        <div class="card-header">
          <span class="card-title"><i class="fas fa-exclamation-triangle mr-2 text-yellow-400"></i>Trials Vencendo em Breve</span>
        </div>
        <div id="trials-vencendo"></div>
      </div>

      <!-- Atividade recente -->
      <div class="card">
        <div class="card-header">
          <span class="card-title"><i class="fas fa-history mr-2 text-gray-400"></i>Atividade Recente</span>
        </div>
        <div id="atividade-recente"></div>
      </div>
    `

    renderChartPlanos()
    renderChartSegmentos()
    renderTrialsVencendo()
    renderAtividadeRecente()

  } catch (e) {
    document.getElementById('saas-dash-content').innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle text-red-400 text-3xl mb-2"></i><p>Erro ao carregar dashboard: ${e.message}</p></div>`
  }
}

function kpiCard(label, valor, icon, cor, sub) {
  return `
    <div class="card" style="border-left:4px solid ${cor}">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <span style="font-size:.8rem;color:#888;font-weight:600;text-transform:uppercase">${label}</span>
        <div style="background:${cor}22;color:${cor};width:34px;height:34px;border-radius:8px;display:flex;align-items:center;justify-content:center">
          <i class="${icon} text-sm"></i>
        </div>
      </div>
      <div style="font-size:1.7rem;font-weight:800;color:#fff;line-height:1">${valor}</div>
      <div style="font-size:.75rem;color:#666;margin-top:6px">${sub}</div>
    </div>
  `
}

function renderChartPlanos() {
  const ctx = document.getElementById('chart-planos')
  if (!ctx || !window.Chart) return
  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Trial', 'Starter', 'Professional', 'Enterprise'],
      datasets: [{ data: [2, 1, 2, 1], backgroundColor: ['#888', '#e67e22', '#3498db', '#9b59b6'], borderWidth: 0 }],
    },
    options: { responsive: true, plugins: { legend: { labels: { color: '#aaa', font: { size: 11 } } } } },
  })
}

function renderChartSegmentos() {
  const ctx = document.getElementById('chart-segmentos')
  if (!ctx || !window.Chart) return
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Mineração', 'Construção', 'Siderurgia', 'Petróleo', 'Energia', 'Logística'],
      datasets: [{ label: 'MRR (R$)', data: [2490, 890, 6900, 0, 0, 0], backgroundColor: '#e67e2266', borderColor: '#e67e22', borderWidth: 2, borderRadius: 6 }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { ticks: { color: '#888' }, grid: { color: '#ffffff10' } }, x: { ticks: { color: '#888' } } },
    },
  })
}

function renderTrialsVencendo() {
  const trialsAtivos = MOCK_ORGS.filter(o => o.status === 'trial' && o.trial_fim)
  const el = document.getElementById('trials-vencendo')
  if (!el) return
  if (!trialsAtivos.length) { el.innerHTML = '<div class="empty-state py-4">Nenhum trial vencendo</div>'; return }
  el.innerHTML = `<div class="table-container"><table class="table"><thead><tr>
    <th>Empresa</th><th>Segmento</th><th>Vence em</th><th>Dias</th><th>Ação</th>
  </tr></thead><tbody>
    ${trialsAtivos.map(o => {
      const dias = diasRestantes(o.trial_fim)
      const cor = dias <= 3 ? '#e74c3c' : dias <= 7 ? '#f39c12' : '#2ecc71'
      return `<tr>
        <td><div class="font-medium">${o.nome}</div><div class="text-xs text-gray-400">${o.email}</div></td>
        <td>${o.segmento || '—'}</td>
        <td>${fmtData(o.trial_fim)}</td>
        <td><span style="color:${cor};font-weight:700">${dias}d</span></td>
        <td><button class="btn-sm btn-primary" onclick="abrirUpgradeModal('${o.id}','${o.nome}')"><i class="fas fa-arrow-up mr-1"></i>Converter</button></td>
      </tr>`
    }).join('')}
  </tbody></table></div>`
}

function renderAtividadeRecente() {
  const el = document.getElementById('atividade-recente')
  if (!el) return
  const atividades = [
    { icon: 'fa-user-plus', cor: '#2ecc71', texto: 'Nova org: Energia Épsilon criou conta (Trial)', data: '01/04/2025 09:14' },
    { icon: 'fa-arrow-up', cor: '#3498db', texto: 'Mineração Horizonte fez upgrade: Starter → Professional', data: '01/03/2025 14:30' },
    { icon: 'fa-credit-card', cor: '#2ecc71', texto: 'Siderúrgica Beta: pagamento mensal confirmado R$6.900', data: '01/04/2025 00:01' },
    { icon: 'fa-exclamation-triangle', cor: '#e74c3c', texto: 'Petro Zeta: pagamento falhou – conta suspensa', data: '01/04/2025 02:15' },
    { icon: 'fa-funnel-dollar', cor: '#9b59b6', texto: 'Novo lead: PetroMax (plano Professional)', data: '01/04/2025 11:00' },
  ]
  el.innerHTML = `<div class="space-y-1 p-4">
    ${atividades.map(a => `
      <div style="display:flex;align-items:flex-start;gap:12px;padding:10px;border-radius:8px;background:rgba(255,255,255,0.02)">
        <div style="background:${a.cor}22;color:${a.cor};width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <i class="fas ${a.icon} text-xs"></i>
        </div>
        <div class="flex-1">
          <div style="font-size:.85rem;color:#ddd">${a.texto}</div>
          <div style="font-size:.75rem;color:#666;margin-top:2px">${a.data}</div>
        </div>
      </div>
    `).join('')}
  </div>`
}

// ═══════════════════════════════════════════════════════════
// CLIENTES / ORGS
// ═══════════════════════════════════════════════════════════
window.renderSaasClientes = async function (filtro = '') {
  const el = document.getElementById('content')
  el.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title"><i class="fas fa-building text-orange-400 mr-2"></i>Clientes / Organizações</h1>
        <p class="page-subtitle">Gestão multi-tenant de todas as empresas clientes</p>
      </div>
      <button class="btn-primary" onclick="abrirNovaOrg()"><i class="fas fa-plus mr-1"></i>Nova Org</button>
    </div>

    <!-- FILTROS -->
    <div class="card mb-4">
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">
        <input type="text" id="filter-orgs" class="form-input" placeholder="🔍 Buscar empresa, e-mail, CNPJ..." style="flex:1;min-width:200px" oninput="filterOrgs()" value="${filtro}">
        <select id="filter-plano" class="form-input" style="width:auto" onchange="filterOrgs()">
          <option value="">Todos os planos</option>
          <option value="trial">Trial</option>
          <option value="starter">Starter</option>
          <option value="professional">Professional</option>
          <option value="enterprise">Enterprise</option>
        </select>
        <select id="filter-status-org" class="form-input" style="width:auto" onchange="filterOrgs()">
          <option value="">Todos os status</option>
          <option value="trial">Trial</option>
          <option value="ativo">Ativo</option>
          <option value="suspenso">Suspenso</option>
          <option value="cancelado">Cancelado</option>
        </select>
        <button class="btn-secondary" onclick="exportarOrgs()"><i class="fas fa-download mr-1"></i>Exportar CSV</button>
      </div>
    </div>

    <!-- TABELA -->
    <div class="card">
      <div id="orgs-table-wrap"><div class="loading-state"><i class="fas fa-circle-notch fa-spin"></i></div></div>
    </div>
  `

  let orgs = MOCK_ORGS
  try {
    const r = await apiFetch('/api/saas/admin/orgs')
    orgs = r.data || orgs
  } catch { /* usa mock */ }

  window._saasOrgs = orgs
  renderOrgsTable(orgs)
}

function filterOrgs() {
  const texto = (document.getElementById('filter-orgs')?.value || '').toLowerCase()
  const plano = document.getElementById('filter-plano')?.value || ''
  const status = document.getElementById('filter-status-org')?.value || ''

  let filtered = (window._saasOrgs || MOCK_ORGS).filter(o => {
    const matchText = !texto || o.nome.toLowerCase().includes(texto) || o.email.toLowerCase().includes(texto) || (o.cnpj || '').includes(texto)
    const matchPlano = !plano || o.plano === plano
    const matchStatus = !status || o.status === status
    return matchText && matchPlano && matchStatus
  })
  renderOrgsTable(filtered)
}

function renderOrgsTable(orgs) {
  const el = document.getElementById('orgs-table-wrap')
  if (!el) return
  if (!orgs.length) { el.innerHTML = '<div class="empty-state">Nenhuma organização encontrada</div>'; return }

  el.innerHTML = `
    <div class="table-container">
      <table class="table">
        <thead><tr>
          <th>Empresa</th>
          <th>Segmento</th>
          <th>Plano</th>
          <th>Status</th>
          <th>Usuários</th>
          <th>Mensalidade</th>
          <th>Renovação</th>
          <th>Ações</th>
        </tr></thead>
        <tbody>
          ${orgs.map(o => {
            const diasTrial = o.status === 'trial' && o.trial_fim ? diasRestantes(o.trial_fim) : null
            return `<tr>
              <td>
                <div class="font-medium">${o.nome}</div>
                <div class="text-xs text-gray-400">${o.email}</div>
                ${o.cnpj ? `<div class="text-xs text-gray-500">${o.cnpj}</div>` : ''}
              </td>
              <td><span class="text-sm">${o.segmento || '—'}</span></td>
              <td>${badgePlano(o.plano)}</td>
              <td>
                ${badgeStatus(o.status)}
                ${diasTrial !== null ? `<div class="text-xs mt-1" style="color:${diasTrial<=3?'#e74c3c':'#f39c12'}">${diasTrial}d restantes</div>` : ''}
              </td>
              <td class="text-center">${o.usuarios_max === 999 ? '∞' : o.usuarios_max}</td>
              <td>${o.valor_mensalidade ? fmtBRL(o.valor_mensalidade) : '—'}</td>
              <td class="text-sm text-gray-400">${fmtData(o.data_renovacao)}</td>
              <td>
                <div style="display:flex;gap:6px">
                  <button class="btn-sm btn-secondary" onclick="verDetalhesOrg('${o.id}')" title="Ver detalhes"><i class="fas fa-eye"></i></button>
                  <button class="btn-sm btn-primary" onclick="abrirUpgradeModal('${o.id}','${o.nome}')" title="Gerenciar plano"><i class="fas fa-arrow-up"></i></button>
                  ${o.status === 'ativo' ? `<button class="btn-sm" style="background:#e74c3c22;color:#e74c3c;border:1px solid #e74c3c44" onclick="suspenderOrg('${o.id}','${o.nome}')" title="Suspender"><i class="fas fa-pause"></i></button>` : ''}
                  ${o.status === 'suspenso' ? `<button class="btn-sm" style="background:#2ecc7122;color:#2ecc71;border:1px solid #2ecc7144" onclick="reativarOrg('${o.id}','${o.nome}')" title="Reativar"><i class="fas fa-play"></i></button>` : ''}
                </div>
              </td>
            </tr>`
          }).join('')}
        </tbody>
      </table>
    </div>
    <div class="table-footer">
      <span class="text-sm text-gray-400">Total: <strong>${orgs.length}</strong> organizações · MRR total: <strong>${fmtBRL(orgs.reduce((s,o)=>s+(o.valor_mensalidade||0),0))}</strong></span>
    </div>
  `
}

function abrirUpgradeModal(orgId, orgNome) {
  const modal = document.createElement('div')
  modal.id = 'upgrade-modal'
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)'
  modal.innerHTML = `
    <div style="background:#14161c;border:1px solid rgba(255,255,255,0.1);border-radius:20px;width:90%;max-width:460px;padding:28px">
      <h3 style="font-size:1.1rem;font-weight:700;color:#fff;margin-bottom:4px"><i class="fas fa-arrow-up text-orange-400 mr-2"></i>Gerenciar Plano</h3>
      <p style="color:#888;font-size:.85rem;margin-bottom:20px">${orgNome}</p>
      
      <label class="form-label">Novo Plano</label>
      <select id="upgrade-plano" class="form-input mb-4">
        <option value="trial">Trial (R$0)</option>
        <option value="starter">Starter (R$890/mês)</option>
        <option value="professional" selected>Professional (R$2.490/mês)</option>
        <option value="enterprise">Enterprise (R$6.900/mês)</option>
      </select>
      
      <label class="form-label">Motivo / Observação</label>
      <textarea id="upgrade-motivo" class="form-input mb-6" rows="2" placeholder="Ex.: Renovação anual, upgrade solicitado pelo cliente..."></textarea>
      
      <div style="display:flex;gap:12px">
        <button class="btn-secondary flex-1" onclick="document.getElementById('upgrade-modal').remove()">Cancelar</button>
        <button class="btn-primary flex-1" onclick="confirmarUpgrade('${orgId}')"><i class="fas fa-check mr-1"></i>Confirmar</button>
      </div>
    </div>
  `
  document.body.appendChild(modal)
}

async function confirmarUpgrade(orgId) {
  const plano = document.getElementById('upgrade-plano').value
  const motivo = document.getElementById('upgrade-motivo').value

  try {
    await apiFetch(`/api/saas/orgs/${orgId}/upgrade`, { method: 'POST', body: JSON.stringify({ plano, motivo }) })
  } catch { /* offline */ }

  document.getElementById('upgrade-modal').remove()
  showNotification('success', 'Plano atualizado com sucesso!')
  renderSaasClientes()
}

async function suspenderOrg(orgId, nome) {
  if (!confirm(`Suspender "${nome}"? O acesso será bloqueado imediatamente.`)) return
  showNotification('info', `Org "${nome}" suspensa.`)
  renderSaasClientes()
}

async function reativarOrg(orgId, nome) {
  showNotification('success', `Org "${nome}" reativada!`)
  renderSaasClientes()
}

function verDetalhesOrg(orgId) {
  const org = (window._saasOrgs || MOCK_ORGS).find(o => o.id === orgId)
  if (!org) return
  const modal = document.createElement('div')
  modal.id = 'org-detail-modal'
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);padding:16px'
  modal.innerHTML = `
    <div style="background:#14161c;border:1px solid rgba(255,255,255,0.1);border-radius:20px;width:100%;max-width:520px;padding:28px;max-height:80vh;overflow-y:auto">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
        <h3 style="font-size:1.1rem;font-weight:700;color:#fff"><i class="fas fa-building text-orange-400 mr-2"></i>${org.nome}</h3>
        <button onclick="document.getElementById('org-detail-modal').remove()" style="color:#888;background:none;border:none;cursor:pointer;font-size:1.2rem"><i class="fas fa-times"></i></button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
        ${detRow('E-mail', org.email)}
        ${detRow('CNPJ', org.cnpj || '—')}
        ${detRow('Segmento', org.segmento || '—')}
        ${detRow('País', org.pais || 'Brasil')}
        ${detRow('Plano', badgePlano(org.plano))}
        ${detRow('Status', badgeStatus(org.status))}
        ${detRow('Usuários', org.usuarios_max === 999 ? 'Ilimitado' : org.usuarios_max)}
        ${detRow('Mensalidade', fmtBRL(org.valor_mensalidade))}
        ${detRow('Renovação', fmtData(org.data_renovacao))}
        ${detRow('Criado em', fmtData(org.criado_em))}
      </div>
      <div style="display:flex;gap:12px;margin-top:24px">
        <button class="btn-secondary flex-1" onclick="document.getElementById('org-detail-modal').remove()">Fechar</button>
        <button class="btn-primary flex-1" onclick="document.getElementById('org-detail-modal').remove();abrirUpgradeModal('${org.id}','${org.nome}')"><i class="fas fa-arrow-up mr-1"></i>Gerenciar</button>
      </div>
    </div>
  `
  document.body.appendChild(modal)
}

function detRow(label, val) {
  return `<div style="background:rgba(255,255,255,0.03);border-radius:10px;padding:12px">
    <div style="font-size:.72rem;color:#888;text-transform:uppercase;font-weight:600;margin-bottom:4px">${label}</div>
    <div style="font-size:.9rem;color:#ddd">${val}</div>
  </div>`
}

function exportarOrgs() {
  const orgs = window._saasOrgs || MOCK_ORGS
  const csv = ['Nome,Email,CNPJ,Segmento,Plano,Status,Mensalidade,Renovação',
    ...orgs.map(o => `"${o.nome}","${o.email}","${o.cnpj||''}","${o.segmento||''}","${o.plano}","${o.status}","${o.valor_mensalidade||0}","${fmtData(o.data_renovacao)}"`),
  ].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `opscore-clientes-${new Date().toISOString().slice(0,10)}.csv`
  link.click()
}

function abrirNovaOrg() {
  showNotification('info', 'Use a página de Onboarding para criar novas organizações.')
  window.open('/onboarding.html', '_blank')
}

// ═══════════════════════════════════════════════════════════
// LEADS / PIPELINE
// ═══════════════════════════════════════════════════════════
window.renderSaasLeads = async function () {
  const el = document.getElementById('content')
  el.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title"><i class="fas fa-funnel-dollar text-orange-400 mr-2"></i>Leads / Pipeline</h1>
        <p class="page-subtitle">Gestão de interessados e funil de conversão</p>
      </div>
      <button class="btn-primary" onclick="abrirNovoLead()"><i class="fas fa-plus mr-1"></i>Novo Lead</button>
    </div>

    <!-- Kanban / Funil -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;margin-bottom:24px" id="funil-leads"></div>

    <!-- Tabela detalhada -->
    <div class="card">
      <div class="card-header"><span class="card-title"><i class="fas fa-list mr-2 text-gray-400"></i>Todos os Leads</span></div>
      <div id="leads-table-wrap"><div class="loading-state"><i class="fas fa-circle-notch fa-spin"></i></div></div>
    </div>
  `

  let leads = MOCK_LEADS
  try {
    const r = await apiFetch('/api/saas/admin/leads')
    leads = r.data || leads
  } catch { /* usa mock */ }

  window._saasLeads = leads
  renderFunilLeads(leads)
  renderLeadsTable(leads)
}

function renderFunilLeads(leads) {
  const etapas = [
    { id: 'novo', label: 'Novos', cor: '#3498db', icon: 'fa-inbox' },
    { id: 'contatado', label: 'Contatados', cor: '#9b59b6', icon: 'fa-phone' },
    { id: 'trial', label: 'Em Trial', cor: '#f39c12', icon: 'fa-play' },
    { id: 'convertido', label: 'Convertidos', cor: '#2ecc71', icon: 'fa-check' },
    { id: 'perdido', label: 'Perdidos', cor: '#e74c3c', icon: 'fa-times' },
  ]
  const el = document.getElementById('funil-leads')
  if (!el) return
  el.innerHTML = etapas.map(e => {
    const count = leads.filter(l => l.status === e.id).length
    return `
      <div class="card" style="border-top:3px solid ${e.cor};text-align:center">
        <div style="background:${e.cor}22;color:${e.cor};width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;margin:0 auto 10px">
          <i class="fas ${e.icon}"></i>
        </div>
        <div style="font-size:1.8rem;font-weight:800;color:#fff">${count}</div>
        <div style="font-size:.8rem;color:#888;margin-top:4px">${e.label}</div>
      </div>
    `
  }).join('')
}

function renderLeadsTable(leads) {
  const el = document.getElementById('leads-table-wrap')
  if (!el) return
  if (!leads.length) { el.innerHTML = '<div class="empty-state">Nenhum lead cadastrado</div>'; return }
  el.innerHTML = `
    <div class="table-container"><table class="table">
      <thead><tr><th>Nome</th><th>Empresa</th><th>Segmento</th><th>Interesse</th><th>Status</th><th>Data</th><th>Ações</th></tr></thead>
      <tbody>
        ${leads.map(l => `<tr>
          <td>
            <div class="font-medium">${l.nome}</div>
            <div class="text-xs text-gray-400">${l.email}</div>
            ${l.telefone ? `<div class="text-xs text-gray-500">${l.telefone}</div>` : ''}
          </td>
          <td>${l.empresa}</td>
          <td>${l.segmento || '—'}</td>
          <td>${badgePlano(l.plano_interesse)}</td>
          <td>${badgeStatus(l.status)}</td>
          <td class="text-sm text-gray-400">${fmtData(l.criado_em)}</td>
          <td>
            <div style="display:flex;gap:6px">
              <button class="btn-sm btn-secondary" onclick="editarLead('${l.id}')" title="Editar status"><i class="fas fa-edit"></i></button>
              <button class="btn-sm btn-primary" onclick="converterLead('${l.id}','${l.empresa}')" title="Converter em Trial"><i class="fas fa-rocket"></i></button>
            </div>
          </td>
        </tr>`).join('')}
      </tbody>
    </table></div>
    <div class="table-footer"><span class="text-sm text-gray-400">Total: <strong>${leads.length}</strong> leads</span></div>
  `
}

function editarLead(leadId) {
  const lead = (window._saasLeads || MOCK_LEADS).find(l => l.id === leadId)
  if (!lead) return
  const modal = document.createElement('div')
  modal.id = 'lead-edit-modal'
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)'
  modal.innerHTML = `
    <div style="background:#14161c;border:1px solid rgba(255,255,255,0.1);border-radius:20px;width:90%;max-width:420px;padding:28px">
      <h3 style="font-size:1.1rem;font-weight:700;color:#fff;margin-bottom:16px"><i class="fas fa-edit text-orange-400 mr-2"></i>${lead.nome}</h3>
      <label class="form-label">Status do Lead</label>
      <select id="lead-status-sel" class="form-input mb-3">
        ${['novo','contatado','trial','convertido','perdido'].map(s=>`<option value="${s}" ${s===lead.status?'selected':''}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`).join('')}
      </select>
      <label class="form-label">Anotações</label>
      <textarea id="lead-notas" class="form-input mb-4" rows="3" placeholder="Observações sobre o lead...">${lead.notas||''}</textarea>
      <div style="display:flex;gap:12px">
        <button class="btn-secondary flex-1" onclick="document.getElementById('lead-edit-modal').remove()">Cancelar</button>
        <button class="btn-primary flex-1" onclick="salvarLead('${leadId}')"><i class="fas fa-save mr-1"></i>Salvar</button>
      </div>
    </div>
  `
  document.body.appendChild(modal)
}

async function salvarLead(leadId) {
  const status = document.getElementById('lead-status-sel').value
  const notas = document.getElementById('lead-notas').value
  try {
    await apiFetch(`/api/saas/leads/${leadId}`, { method: 'PUT', body: JSON.stringify({ status, notas }) })
  } catch { /* offline */ }
  document.getElementById('lead-edit-modal').remove()
  showNotification('success', 'Lead atualizado!')
  renderSaasLeads()
}

function converterLead(leadId, empresa) {
  showNotification('info', `Redirecionando onboarding para "${empresa}"...`)
  window.open(`/onboarding.html?lead=${leadId}`, '_blank')
}

function abrirNovoLead() {
  window.open('/landing.html#contato', '_blank')
}

// ═══════════════════════════════════════════════════════════
// BILLING / RECEITA
// ═══════════════════════════════════════════════════════════
window.renderSaasBilling = async function () {
  const el = document.getElementById('content')

  let billing = MOCK_BILLING
  try {
    const r = await apiFetch('/api/saas/admin/billing')
    billing = r.data || billing
  } catch { /* usa mock */ }

  const mrr = MOCK_ORGS.filter(o=>o.status==='ativo').reduce((s,o)=>s+(o.valor_mensalidade||0),0)
  const pago = billing.filter(b=>b.status==='pago').reduce((s,b)=>s+(b.valor||0),0)
  const falhou = billing.filter(b=>b.status==='falhou').reduce((s,b)=>s+(b.valor||0),0)

  el.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title"><i class="fas fa-file-invoice-dollar text-orange-400 mr-2"></i>Billing / Receita</h1>
        <p class="page-subtitle">Histórico de pagamentos e gestão financeira SaaS</p>
      </div>
      <button class="btn-secondary" onclick="renderSaasBilling()"><i class="fas fa-sync mr-1"></i>Atualizar</button>
    </div>

    <!-- KPIs Billing -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px;margin-bottom:24px">
      ${kpiCard('MRR', fmtBRL(mrr), 'fas fa-dollar-sign', '#2ecc71', 'Receita Mensal Recorrente')}
      ${kpiCard('ARR', fmtBRL(mrr*12), 'fas fa-chart-bar', '#3498db', 'Receita Anual Recorrente')}
      ${kpiCard('Coletado (Mês)', fmtBRL(pago), 'fas fa-check-circle', '#2ecc71', 'Pagamentos confirmados')}
      ${kpiCard('Inadimplência', fmtBRL(falhou), 'fas fa-exclamation-circle', '#e74c3c', 'Pagamentos falhos')}
    </div>

    <!-- Tabela de transações -->
    <div class="card">
      <div class="card-header">
        <span class="card-title"><i class="fas fa-history mr-2 text-gray-400"></i>Histórico de Transações</span>
        <button class="btn-sm btn-secondary" onclick="exportarBilling()"><i class="fas fa-download mr-1"></i>CSV</button>
      </div>
      <div class="table-container">
        <table class="table">
          <thead><tr><th>Empresa</th><th>Tipo</th><th>Plano</th><th>Valor</th><th>Status</th><th>Gateway</th><th>Data</th></tr></thead>
          <tbody>
            ${billing.map(b => `<tr>
              <td class="font-medium">${b.org_nome}</td>
              <td><span class="text-sm text-gray-300">${b.tipo}</span></td>
              <td>${b.plano_de?`${badgePlano(b.plano_de)}<i class="fas fa-arrow-right mx-1 text-gray-500 text-xs"></i>`:''} ${badgePlano(b.plano_para)}</td>
              <td class="font-semibold">${fmtBRL(b.valor)}</td>
              <td>${badgeStatus(b.status)}</td>
              <td><span style="background:rgba(255,255,255,0.05);padding:2px 8px;border-radius:6px;font-size:.75rem">${b.gateway}</span></td>
              <td class="text-sm text-gray-400">${fmtData(b.criado_em)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div class="table-footer"><span class="text-sm text-gray-400">Total: <strong>${billing.length}</strong> transações</span></div>
    </div>

    <!-- Gateways disponíveis -->
    <div class="card mt-4">
      <div class="card-header"><span class="card-title"><i class="fas fa-credit-card mr-2 text-purple-400"></i>Gateways de Pagamento Configurados</span></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px;padding:16px">
        ${gatewayCard('Asaas', 'Pagamentos brasileiros (boleto, PIX, cartão)', '#00B0E8', 'fa-qrcode', true)}
        ${gatewayCard('Stripe', 'Cartões internacionais (USD/EUR)', '#635BFF', 'fa-stripe-s', false)}
        ${gatewayCard('Pagar.me', 'Pagamentos locais + split de pagamento', '#00B6B6', 'fa-money-bill', false)}
        ${gatewayCard('Manual', 'NF-e / transferência bancária direta', '#888', 'fa-file-invoice', true)}
      </div>
    </div>
  `
}

function gatewayCard(nome, desc, cor, icon, ativo) {
  return `
    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:16px;border-left:3px solid ${cor}">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="background:${cor}22;color:${cor};width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center">
            <i class="fab ${icon} text-sm" style="font-family:inherit"><i class="fas ${icon} text-sm"></i></i>
          </div>
          <span style="font-weight:600;color:#ddd">${nome}</span>
        </div>
        <span style="background:${ativo?'#2ecc7122':'#e74c3c22'};color:${ativo?'#2ecc71':'#e74c3c'};padding:2px 10px;border-radius:20px;font-size:.7rem;font-weight:700">${ativo?'Ativo':'Inativo'}</span>
      </div>
      <p style="font-size:.78rem;color:#666">${desc}</p>
    </div>
  `
}

function exportarBilling() {
  const billing = MOCK_BILLING
  const csv = ['Empresa,Tipo,Plano,Valor,Status,Gateway,Data',
    ...billing.map(b => `"${b.org_nome}","${b.tipo}","${b.plano_para}","${b.valor}","${b.status}","${b.gateway}","${fmtData(b.criado_em)}"`)
  ].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `opscore-billing-${new Date().toISOString().slice(0,10)}.csv`
  link.click()
}

// ═══════════════════════════════════════════════════════════
// LGPD / CONFORMIDADE
// ═══════════════════════════════════════════════════════════
window.renderSaasLgpd = function () {
  const el = document.getElementById('content')
  el.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title"><i class="fas fa-shield-alt text-green-400 mr-2"></i>LGPD / Conformidade</h1>
        <p class="page-subtitle">Gestão de consentimentos, solicitações e direitos dos titulares</p>
      </div>
    </div>

    <!-- Status de conformidade -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px;margin-bottom:24px">
      ${lgpdItem('Consentimento Explícito', 'Landing e Onboarding', true)}
      ${lgpdItem('Política de Privacidade', 'Publicada e vinculada', true)}
      ${lgpdItem('Dados no Brasil', 'Cloudflare D1 / sa-east-1', true)}
      ${lgpdItem('Direito de Exclusão', 'API LGPD Art. 18 ativa', true)}
      ${lgpdItem('Logs de Auditoria', 'Tabela logs_sistema', true)}
      ${lgpdItem('DPO Designado', 'Pendente nomeação', false)}
      ${lgpdItem('Avaliação de Impacto', 'DPIA pendente', false)}
      ${lgpdItem('Treinamento da Equipe', 'Planejado Q2 2025', false)}
    </div>

    <!-- Solicitações LGPD -->
    <div class="card mb-4">
      <div class="card-header">
        <span class="card-title"><i class="fas fa-inbox mr-2 text-orange-400"></i>Solicitações de Titulares</span>
        <span style="background:rgba(230,126,34,0.15);color:#e67e22;padding:2px 10px;border-radius:20px;font-size:.75rem;font-weight:700">0 pendentes</span>
      </div>
      <div class="empty-state py-6">
        <i class="fas fa-check-circle text-green-400 text-3xl mb-2"></i>
        <p>Nenhuma solicitação pendente</p>
        <p class="text-sm text-gray-500 mt-1">Solicitações de acesso, correção ou exclusão aparecem aqui</p>
      </div>
    </div>

    <!-- Checklist LGPD -->
    <div class="card">
      <div class="card-header"><span class="card-title"><i class="fas fa-tasks mr-2 text-blue-400"></i>Checklist LGPD – Roadmap de Adequação</span></div>
      <div class="p-4 space-y-2">
        ${lgpdCheck(true, 'Mapeamento de dados pessoais tratados')}
        ${lgpdCheck(true, 'Cláusula de LGPD nos Termos de Uso')}
        ${lgpdCheck(true, 'Formulário de consentimento com opt-in')}
        ${lgpdCheck(true, 'Mecanismo de exclusão de dados (soft delete + anonimização)')}
        ${lgpdCheck(true, 'Logs de auditoria de acessos e alterações')}
        ${lgpdCheck(true, 'Armazenamento de dados no Brasil (sa-east-1)')}
        ${lgpdCheck(false, 'Nomeação do DPO (Encarregado de Dados)')}
        ${lgpdCheck(false, 'Relatório de Impacto à Proteção de Dados (RIPD/DPIA)')}
        ${lgpdCheck(false, 'Procedimento de resposta a incidentes de segurança')}
        ${lgpdCheck(false, 'Treinamento de funcionários em LGPD')}
        ${lgpdCheck(false, 'Contrato de dados com suboperadores (Cloudflare, Supabase, etc.)')}
        ${lgpdCheck(false, 'Portal do titular (acesso/portabilidade/exclusão self-service)')}
      </div>
    </div>
  `
}

function lgpdItem(titulo, desc, ok) {
  return `
    <div style="background:rgba(255,255,255,0.03);border:1px solid ${ok?'rgba(46,204,113,0.2)':'rgba(231,76,60,0.2)'};border-radius:12px;padding:14px">
      <div style="display:flex;align-items:center;gap-8px;margin-bottom:6px">
        <i class="fas ${ok?'fa-check-circle text-green-400':'fa-times-circle text-red-400'} mr-2"></i>
        <span style="font-weight:600;color:#ddd;font-size:.88rem">${titulo}</span>
      </div>
      <div style="font-size:.75rem;color:#666;margin-top:4px">${desc}</div>
    </div>
  `
}

function lgpdCheck(done, texto) {
  return `
    <div style="display:flex;align-items:center;gap:12px;padding:8px;border-radius:8px;background:rgba(255,255,255,0.02)">
      <div style="width:20px;height:20px;border-radius:50%;background:${done?'#2ecc71':'rgba(255,255,255,0.1)'};border:2px solid ${done?'#2ecc71':'rgba(255,255,255,0.15)'};display:flex;align-items:center;justify-content:center;flex-shrink:0">
        ${done?'<i class="fas fa-check text-white" style="font-size:9px"></i>':''}
      </div>
      <span style="font-size:.85rem;color:${done?'#ddd':'#888'};${done?'':'opacity:.7'}">${texto}</span>
    </div>
  `
}

// ─── NAVEGAÇÃO ──────────────────────────────────────────────
(function() {
  var _saasOrigNavigate = window.navigate;
  window.navigate = function (page) {
    if (page === 'saas_dashboard') { renderSaasDashboard(); return; }
    if (page === 'saas_clientes')  { renderSaasClientes();  return; }
    if (page === 'saas_leads')     { renderSaasLeads();     return; }
    if (page === 'saas_billing')   { renderSaasBilling();   return; }
    if (page === 'saas_lgpd')      { renderSaasLgpd();      return; }
    if (_saasOrigNavigate) _saasOrigNavigate(page);
  };
})();

// ─── MOSTRAR MENU SAAS PARA ADMIN ──────────────────────────
function checkSaasMenu() {
  const user = JSON.parse(localStorage.getItem('erp_user') || '{}')
  const navSaas = document.getElementById('nav-saas-admin')
  if (navSaas && (user.perfil === 'admin' || user.perfil === 'superadmin')) {
    navSaas.style.display = ''
  }
}

// Executa após login
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(checkSaasMenu, 500)
})
document.addEventListener('erp-login', checkSaasMenu)

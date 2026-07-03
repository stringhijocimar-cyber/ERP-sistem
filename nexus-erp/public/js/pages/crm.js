// =====================================================
// Fraser Alexander ERP – Módulo CRM Comercial v4.0
// Vinculado ao perfil Diretor Comercial
// =====================================================

// ─── DADOS CRM (carregados do localStorage – sem dados fictícios) ───
function _getCRMData() {
  try {
    const raw = localStorage.getItem('fa_crm_data');
    if (raw) return JSON.parse(raw);
  } catch(e) {}
  return { leads: [], oportunidades: [], atividades: [], propostas: [], contatos: [] };
}
function _saveCRMData(data) {
  localStorage.setItem('fa_crm_data', JSON.stringify(data));
  CRM_DATA = data;
}

// ── Sync do lead com o SERVIDOR (/api/crm, tenant-isolado) ──────────────
// POST na criação; PUT nas mudanças (inclusive de etapa — é o PUT que
// dispara o gatilho C1 de orçamentação no backend quando o lead passa de
// Qualificação). Defensivo: nunca lança; offline segue só local.
async function _crmSyncLeadServidor(lead) {
  if (!lead || !window.NexusAPI) return;
  const payload = {
    titulo: lead.empresa, cliente: lead.empresa,
    valor: Number(lead.potencial) || 0,
    estagio: lead.etapa || 'Prospecção',
    probabilidade: Number(lead.probabilidade) || 10,
    observacoes: lead.obs || '',
  };
  try {
    if (lead._srvId != null) {
      await NexusAPI.put(`/api/crm/${lead._srvId}`, payload);
    } else {
      const r = await NexusAPI.post('/api/crm', payload);
      if (r && r.id != null && !r._stub) { lead._srvId = r.id; _saveCRMData(CRM_DATA); }
    }
  } catch (e) { /* offline → mantém local; reconcile de boot cobre depois */ }
}
window._crmSyncLeadServidor = _crmSyncLeadServidor;
let CRM_DATA = _getCRMData();

const CRM_ETAPAS = ['Prospecção', 'Qualificação', 'Reunião Agendada', 'Proposta Enviada', 'Negociação', 'Fechado Ganho', 'Fechado Perdido'];

// ─── RENDERIZAÇÃO PRINCIPAL DO CRM ───
function renderCRM() {
  // Verificação de permissão
  if (currentUser && !['admin','diretor','crm'].includes(currentUser.profile)) {
    document.getElementById('mainContent').innerHTML = `
      <div class="empty-state" style="padding-top:80px">
        <i class="fas fa-lock" style="color:var(--red-light);font-size:48px"></i>
        <p style="margin-top:16px;font-size:16px;font-weight:600;color:var(--text-primary)">Acesso Restrito</p>
        <p style="font-size:13px;color:var(--text-secondary)">Módulo CRM disponível apenas para Diretor Comercial e Administrador.</p>
      </div>`;
    return;
  }

  const totalLeads = CRM_DATA.leads.length;
  const totalPotencial = CRM_DATA.leads.reduce((a, l) => a + (l.potencial || 0), 0);
  const leadsAtivos = CRM_DATA.leads.filter(l => !['Fechado Ganho','Fechado Perdido'].includes(l.etapa)).length;
  const proposEnviadas = CRM_DATA.propostas.filter(p => p.status !== 'Cancelada').length;
  const propValor = CRM_DATA.propostas.reduce((a, p) => a + (p.valor || 0), 0);

  document.getElementById('mainContent').innerHTML = `
    <div class="page-header">
      <div class="page-title">
        <h2><i class="fas fa-handshake" style="color:var(--fa-teal);margin-right:8px"></i>CRM Comercial</h2>
        <p>Gestão de leads, oportunidades e propostas comerciais · Fraser Alexander</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary btn-sm" onclick="exportCRM()"><i class="fas fa-download"></i> Exportar</button>
        <button class="btn btn-primary btn-sm" onclick="openNovoLead()"><i class="fas fa-plus"></i> Novo Lead</button>
      </div>
    </div>

    <!-- KPIs -->
    <div class="kpi-grid" style="grid-template-columns:repeat(5,1fr);margin-bottom:20px">
      <div class="kpi-card kpi-blue">
        <div class="kpi-icon"><i class="fas fa-user-plus"></i></div>
        <div class="kpi-value">${totalLeads}</div>
        <div class="kpi-label">Leads Cadastrados</div>
      </div>
      <div class="kpi-card kpi-orange">
        <div class="kpi-icon"><i class="fas fa-fire"></i></div>
        <div class="kpi-value">${leadsAtivos}</div>
        <div class="kpi-label">Em Andamento</div>
      </div>
      <div class="kpi-card kpi-teal">
        <div class="kpi-icon"><i class="fas fa-dollar-sign"></i></div>
        <div class="kpi-value">${fmtK(totalPotencial)}</div>
        <div class="kpi-label">Pipeline Total</div>
      </div>
      <div class="kpi-card kpi-green">
        <div class="kpi-icon"><i class="fas fa-file-alt"></i></div>
        <div class="kpi-value">${proposEnviadas}</div>
        <div class="kpi-label">Propostas Ativas</div>
      </div>
      <div class="kpi-card kpi-purple">
        <div class="kpi-icon"><i class="fas fa-trophy"></i></div>
        <div class="kpi-value">${fmtK(propValor)}</div>
        <div class="kpi-label">Valor em Propostas</div>
      </div>
    </div>

    <!-- Tabs CRM -->
    <div class="card" style="margin-bottom:20px">
      <div style="display:flex;gap:0;border-bottom:1px solid var(--border-color);margin-bottom:0">
        ${['pipeline','leads','propostas','atividades','contatos'].map((t,i) => `
          <button onclick="switchCRMTab('${t}')" id="crm-tab-${t}" style="padding:12px 20px;border:none;background:${i===0?'var(--bg-tertiary)':'transparent'};color:${i===0?'var(--fa-teal)':'var(--text-secondary)'};font-weight:${i===0?'600':'400'};border-bottom:${i===0?'2px solid var(--fa-teal)':'2px solid transparent'};cursor:pointer;font-size:13px;transition:all 0.2s">
            <i class="fas fa-${['project-diagram','list','file-alt','tasks','address-book'][i]}" style="margin-right:6px"></i>
            ${'Pipeline,Leads,Propostas,Atividades,Contatos'.split(',')[i]}
          </button>
        `).join('')}
      </div>
      <div id="crm-tab-content" style="padding:20px">
        ${renderCRMPipeline()}
      </div>
    </div>
  `;
}

function switchCRMTab(tab) {
  ['pipeline','leads','propostas','atividades','contatos'].forEach(t => {
    const btn = document.getElementById(`crm-tab-${t}`);
    if (!btn) return;
    const active = t === tab;
    btn.style.background = active ? 'var(--bg-tertiary)' : 'transparent';
    btn.style.color = active ? 'var(--fa-teal)' : 'var(--text-secondary)';
    btn.style.fontWeight = active ? '600' : '400';
    btn.style.borderBottom = active ? '2px solid var(--fa-teal)' : '2px solid transparent';
  });
  const content = document.getElementById('crm-tab-content');
  if (!content) return;
  switch(tab) {
    case 'pipeline': content.innerHTML = renderCRMPipeline(); break;
    case 'leads': content.innerHTML = renderCRMLeads(); break;
    case 'propostas': content.innerHTML = renderCRMPropostas(); break;
    case 'atividades': content.innerHTML = renderCRMAtividades(); break;
    case 'contatos': content.innerHTML = renderCRMContatos(); break;
  }
}

// ─── PIPELINE KANBAN ───
function renderCRMPipeline() {
  const etapasFunil = ['Prospecção','Qualificação','Reunião Agendada','Proposta Enviada','Negociação'];
  const cores = {
    'Prospecção': '#6366f1',
    'Qualificação': '#3b82f6',
    'Reunião Agendada': '#f59e0b',
    'Proposta Enviada': '#8b5cf6',
    'Negociação': '#10b981',
    'Fechado Ganho': '#22c55e',
    'Fechado Perdido': '#ef4444'
  };

  return `
    <div style="display:flex;gap:12px;overflow-x:auto;padding-bottom:8px">
      ${etapasFunil.map(etapa => {
        const items = CRM_DATA.leads.filter(l => l.etapa === etapa);
        const valorEtapa = items.reduce((a, l) => a + (l.potencial * l.probabilidade / 100), 0);
        return `
          <div style="min-width:220px;flex:1;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:10px;padding:12px">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
              <div style="width:10px;height:10px;border-radius:50%;background:${cores[etapa]}"></div>
              <span style="font-size:12px;font-weight:600;color:var(--text-primary)">${etapa}</span>
              <span style="margin-left:auto;background:var(--bg-tertiary);border-radius:10px;padding:2px 8px;font-size:11px;color:var(--text-secondary)">${items.length}</span>
            </div>
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:10px">Ponderado: ${fmtK(valorEtapa)}</div>
            ${items.map(l => `
              <div onclick="verDetalheLead('${l.id}')" style="background:var(--bg-primary);border:1px solid var(--border-color);border-radius:8px;padding:10px;margin-bottom:8px;cursor:pointer;transition:border-color 0.2s" onmouseover="this.style.borderColor='var(--fa-teal)'" onmouseout="this.style.borderColor='var(--border-color)'">
                <div style="font-size:12px;font-weight:600;color:var(--text-primary);margin-bottom:4px">${l.empresa}</div>
                <div style="font-size:11px;color:var(--text-secondary);margin-bottom:6px">${l.contato} · ${l.cargo}</div>
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <span style="font-size:11px;font-weight:600;color:var(--fa-teal)">${fmtK(l.potencial)}</span>
                  <span style="font-size:10px;background:rgba(34,197,94,0.1);color:#22c55e;border-radius:10px;padding:2px 6px">${l.probabilidade}%</span>
                </div>
                <div style="font-size:10px;color:var(--text-muted);margin-top:4px">${l.ultimaAcao}</div>
              </div>
            `).join('')}
            ${items.length === 0 ? '<div style="text-align:center;color:var(--text-muted);font-size:11px;padding:20px 0">Sem leads nesta etapa</div>' : ''}
          </div>
        `;
      }).join('')}
    </div>
    <div style="display:flex;gap:12px;margin-top:16px">
      <div style="background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);border-radius:8px;padding:12px;flex:1;text-align:center">
        <div style="font-size:11px;color:#22c55e;font-weight:600;margin-bottom:4px"><i class="fas fa-trophy"></i> Fechado Ganho</div>
        <div style="font-size:13px;color:var(--text-primary)">${CRM_DATA.leads.filter(l=>l.etapa==='Fechado Ganho').length} leads · ${fmtK(CRM_DATA.leads.filter(l=>l.etapa==='Fechado Ganho').reduce((a,l)=>a+l.potencial,0))}</div>
      </div>
      <div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:8px;padding:12px;flex:1;text-align:center">
        <div style="font-size:11px;color:#ef4444;font-weight:600;margin-bottom:4px"><i class="fas fa-times-circle"></i> Fechado Perdido</div>
        <div style="font-size:13px;color:var(--text-primary)">${CRM_DATA.leads.filter(l=>l.etapa==='Fechado Perdido').length} leads</div>
      </div>
    </div>
  `;
}

// ─── LISTA DE LEADS ───
function renderCRMLeads() {
  return `
    <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap">
      <div style="position:relative;flex:1;min-width:200px">
        <i class="fas fa-search" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:12px"></i>
        <input type="text" id="searchLeads" placeholder="Buscar empresa, contato..." oninput="filterLeads()" style="width:100%;padding:8px 10px 8px 30px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
      </div>
      <select id="filterEtapa" onchange="filterLeads()" style="padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px">
        <option value="">Todas as Etapas</option>
        ${CRM_ETAPAS.map(e => `<option>${e}</option>`).join('')}
      </select>
      <select id="filterSegmento" onchange="filterLeads()" style="padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px">
        <option value="">Todos os Segmentos</option>
        <option>Mineração</option><option>Siderurgia</option><option>Metalurgia</option><option>Energia</option><option>Outros</option>
      </select>
    </div>
    <div id="leads-table-wrap">${_renderLeadsTable(CRM_DATA.leads)}</div>
  `;
}

function _renderLeadsTable(leads) {
  if (!leads.length) return '<div style="text-align:center;padding:40px;color:var(--text-muted)">Nenhum lead encontrado.</div>';
  return `
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead>
        <tr style="background:var(--bg-tertiary)">
          <th style="padding:10px 12px;text-align:left;color:var(--text-secondary);font-weight:600;font-size:11px;text-transform:uppercase">Empresa</th>
          <th style="padding:10px 12px;text-align:left;color:var(--text-secondary);font-weight:600;font-size:11px;text-transform:uppercase">Contato</th>
          <th style="padding:10px 12px;text-align:left;color:var(--text-secondary);font-weight:600;font-size:11px;text-transform:uppercase">Segmento</th>
          <th style="padding:10px 12px;text-align:right;color:var(--text-secondary);font-weight:600;font-size:11px;text-transform:uppercase">Potencial</th>
          <th style="padding:10px 12px;text-align:center;color:var(--text-secondary);font-weight:600;font-size:11px;text-transform:uppercase">Prob.</th>
          <th style="padding:10px 12px;text-align:left;color:var(--text-secondary);font-weight:600;font-size:11px;text-transform:uppercase">Etapa</th>
          <th style="padding:10px 12px;text-align:left;color:var(--text-secondary);font-weight:600;font-size:11px;text-transform:uppercase">Última Ação</th>
          <th style="padding:10px 12px;text-align:center;color:var(--text-secondary);font-weight:600;font-size:11px;text-transform:uppercase">Ações</th>
        </tr>
      </thead>
      <tbody>
        ${leads.map(l => `
          <tr style="border-bottom:1px solid var(--border-color);transition:background 0.15s" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='transparent'">
            <td style="padding:10px 12px">
              <div style="font-weight:600;color:var(--text-primary)">${l.empresa}</div>
              <div style="font-size:11px;color:var(--text-muted)">${l.origem}</div>
            </td>
            <td style="padding:10px 12px">
              <div style="color:var(--text-primary)">${l.contato}</div>
              <div style="font-size:11px;color:var(--text-muted)">${l.cargo}</div>
            </td>
            <td style="padding:10px 12px;color:var(--text-secondary)">${l.segmento}</td>
            <td style="padding:10px 12px;text-align:right;font-weight:600;color:var(--fa-teal)">${fmtK(l.potencial)}</td>
            <td style="padding:10px 12px;text-align:center">
              <span style="font-weight:600;color:${l.probabilidade>=60?'#22c55e':l.probabilidade>=30?'#f59e0b':'#ef4444'}">${l.probabilidade}%</span>
            </td>
            <td style="padding:10px 12px">${_crmEtapaBadge(l.etapa)}</td>
            <td style="padding:10px 12px;color:var(--text-muted);font-size:12px">${l.ultimaAcao}</td>
            <td style="padding:10px 12px;text-align:center">
              <button onclick="verDetalheLead('${l.id}')" class="btn btn-sm btn-secondary" style="margin:2px" title="Ver detalhes"><i class="fas fa-eye"></i></button>
              <button onclick="editarLead('${l.id}')" class="btn btn-sm btn-secondary" style="margin:2px" title="Editar"><i class="fas fa-edit"></i></button>
              <button onclick="gerarPDFLead('${l.id}')" class="btn btn-sm btn-secondary" style="margin:2px;color:#ef4444" title="Gerar PDF da ficha"><i class="fas fa-file-pdf"></i></button>
              <button onclick="gerarWordLead('${l.id}')" class="btn btn-sm btn-secondary" style="margin:2px;color:#2563eb" title="Gerar Word da ficha"><i class="fas fa-file-word"></i></button>
              <button onclick="novaAtividadeLead('${l.id}')" class="btn btn-sm btn-secondary" style="margin:2px" title="Registrar atividade"><i class="fas fa-plus-circle"></i></button>
              <button onclick="gerarPropostaLead('${l.id}')" class="btn btn-sm btn-primary" style="margin:2px" title="Gerar proposta"><i class="fas fa-file-alt"></i></button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function filterLeads() {
  const search = (document.getElementById('searchLeads')?.value || '').toLowerCase();
  const etapa  = document.getElementById('filterEtapa')?.value || '';
  const seg    = document.getElementById('filterSegmento')?.value || '';
  const filtered = CRM_DATA.leads.filter(l => {
    const matchSearch = !search || l.empresa.toLowerCase().includes(search) || l.contato.toLowerCase().includes(search);
    const matchEtapa  = !etapa  || l.etapa === etapa;
    const matchSeg    = !seg    || l.segmento === seg;
    return matchSearch && matchEtapa && matchSeg;
  });
  const wrap = document.getElementById('leads-table-wrap');
  if (wrap) wrap.innerHTML = _renderLeadsTable(filtered);
}

// ─── PROPOSTAS ───
function renderCRMPropostas() {
  // Busca também propostas do novo módulo fa_propostas_comerciais
  let propostasNovas = [];
  try { propostasNovas = JSON.parse(localStorage.getItem('fa_propostas_comerciais')||'[]'); } catch(e){}

  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
      <div>
        <span style="font-size:14px;font-weight:600;color:var(--text-primary)">${CRM_DATA.propostas.length + propostasNovas.length} propostas</span>
        <span style="font-size:12px;color:var(--text-muted);margin-left:8px">(${CRM_DATA.propostas.length} legadas · ${propostasNovas.length} no módulo)</span>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-secondary btn-sm" onclick="navigate('proposta_comercial')"><i class="fas fa-arrow-right"></i> Módulo Completo</button>
        <button class="btn btn-primary btn-sm" onclick="openNovaProposta()"><i class="fas fa-plus"></i> Nova Proposta</button>
      </div>
    </div>

    ${propostasNovas.length > 0 ? `
    <div style="margin-bottom:12px;padding:10px 14px;background:rgba(0,180,184,0.05);border:1px solid rgba(0,180,184,0.2);border-radius:8px;font-size:12px;color:var(--text-secondary)">
      <i class="fas fa-info-circle" style="color:var(--fa-teal);margin-right:6px"></i>
      <strong>${propostasNovas.length}</strong> proposta(s) com WBS detalhado no módulo <strong>Propostas Comerciais</strong>.
      <a onclick="navigate('proposta_comercial')" href="#" style="color:var(--fa-teal);margin-left:6px;text-decoration:underline">Ver todas →</a>
    </div>
    ` : ''}

    ${CRM_DATA.propostas.length === 0 && propostasNovas.length === 0 ? `
    <div style="text-align:center;padding:48px 24px">
      <i class="fas fa-file-invoice" style="font-size:36px;color:var(--fa-teal);opacity:.3"></i>
      <p style="margin-top:12px;font-size:14px;color:var(--text-muted)">Nenhuma proposta ainda. Gere a partir de um lead ou crie diretamente.</p>
    </div>
    ` : CRM_DATA.propostas.length > 0 ? `
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead>
        <tr style="background:var(--bg-tertiary)">
          <th style="padding:10px 12px;text-align:left;color:var(--text-secondary);font-size:11px;text-transform:uppercase">Número</th>
          <th style="padding:10px 12px;text-align:left;color:var(--text-secondary);font-size:11px;text-transform:uppercase">Cliente</th>
          <th style="padding:10px 12px;text-align:left;color:var(--text-secondary);font-size:11px;text-transform:uppercase">Descrição</th>
          <th style="padding:10px 12px;text-align:right;color:var(--text-secondary);font-size:11px;text-transform:uppercase">Valor</th>
          <th style="padding:10px 12px;text-align:center;color:var(--text-secondary);font-size:11px;text-transform:uppercase">Status</th>
          <th style="padding:10px 12px;text-align:center;color:var(--text-secondary);font-size:11px;text-transform:uppercase">Ações</th>
        </tr>
      </thead>
      <tbody>
        ${CRM_DATA.propostas.map(p => `
          <tr style="border-bottom:1px solid var(--border-color)" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='transparent'">
            <td style="padding:10px 12px;font-weight:600;color:var(--fa-teal)">${p.numero}</td>
            <td style="padding:10px 12px;color:var(--text-primary)">${p.cliente}</td>
            <td style="padding:10px 12px;color:var(--text-secondary);font-size:12px">${p.descricao||p.objeto||'—'}</td>
            <td style="padding:10px 12px;text-align:right;font-weight:600;color:var(--text-primary)">${fmt(p.valor||p.valor_total||0)}</td>
            <td style="padding:10px 12px;text-align:center">${_crmPropostaBadge(p.status)}</td>
            <td style="padding:10px 12px;text-align:center">
              <button onclick="verDetalheProposta('${p.id}')" class="btn btn-sm btn-secondary" title="Ver detalhes"><i class="fas fa-eye"></i></button>
              <button onclick="gerarPDFProposta('${p.id}')" class="btn btn-sm btn-secondary" title="Gerar PDF" style="color:#ef4444"><i class="fas fa-file-pdf"></i></button>
              <button onclick="gerarWordProposta('${p.id}')" class="btn btn-sm btn-secondary" title="Gerar Word" style="color:#2563eb"><i class="fas fa-file-word"></i></button>
              <button onclick="converterPropostaEmContrato('${p.id}')" class="btn btn-sm btn-primary" title="Converter em Contrato"><i class="fas fa-check-circle"></i></button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>` : ''}
  `;
}

// ─── ATIVIDADES ───
function renderCRMAtividades() {
  const pendentes = CRM_DATA.atividades.filter(a => a.status === 'Pendente' || a.status === 'Agendada');
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div>
        <span style="font-size:14px;font-weight:600;color:var(--text-primary)">${CRM_DATA.atividades.length} atividades</span>
        ${pendentes.length > 0 ? `<span style="margin-left:10px;background:rgba(245,158,11,0.15);color:#f59e0b;border-radius:10px;padding:2px 8px;font-size:11px">${pendentes.length} pendentes</span>` : ''}
      </div>
      <button class="btn btn-primary btn-sm" onclick="novaAtividadeGeral()"><i class="fas fa-plus"></i> Registrar Atividade</button>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead>
        <tr style="background:var(--bg-tertiary)">
          <th style="padding:10px 12px;text-align:left;color:var(--text-secondary);font-size:11px;text-transform:uppercase">Data</th>
          <th style="padding:10px 12px;text-align:left;color:var(--text-secondary);font-size:11px;text-transform:uppercase">Lead</th>
          <th style="padding:10px 12px;text-align:left;color:var(--text-secondary);font-size:11px;text-transform:uppercase">Tipo</th>
          <th style="padding:10px 12px;text-align:left;color:var(--text-secondary);font-size:11px;text-transform:uppercase">Descrição</th>
          <th style="padding:10px 12px;text-align:center;color:var(--text-secondary);font-size:11px;text-transform:uppercase">Status</th>
          <th style="padding:10px 12px;text-align:left;color:var(--text-secondary);font-size:11px;text-transform:uppercase">Resultado</th>
        </tr>
      </thead>
      <tbody>
        ${CRM_DATA.atividades.map(a => {
          const lead = CRM_DATA.leads.find(l => l.id === a.lead);
          return `
            <tr style="border-bottom:1px solid var(--border-color)" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='transparent'">
              <td style="padding:10px 12px;color:var(--text-muted)">${a.data}</td>
              <td style="padding:10px 12px;font-weight:500;color:var(--text-primary)">${lead ? lead.empresa : a.lead}</td>
              <td style="padding:10px 12px">${_crmAtividadeBadge(a.tipo)}</td>
              <td style="padding:10px 12px;color:var(--text-secondary);font-size:12px">${a.descricao}</td>
              <td style="padding:10px 12px;text-align:center">${_crmAtividadeStatusBadge(a.status)}</td>
              <td style="padding:10px 12px;color:var(--text-muted);font-size:12px">${a.resultado || '—'}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

// ─── CONTATOS ───
function renderCRMContatos() {
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div style="font-size:14px;font-weight:600;color:var(--text-primary)">${CRM_DATA.contatos.length} contatos cadastrados</div>
      <button class="btn btn-primary btn-sm" onclick="openNovoContato()"><i class="fas fa-plus"></i> Novo Contato</button>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px">
      ${CRM_DATA.contatos.map(c => `
        <div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:10px;padding:16px">
          <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:10px">
            <div style="width:40px;height:40px;border-radius:50%;background:var(--fa-teal);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:14px;flex-shrink:0">
              ${c.nome.split(' ').map(n=>n[0]).join('').substring(0,2)}
            </div>
            <div>
              <div style="font-weight:600;color:var(--text-primary)">${c.nome}</div>
              <div style="font-size:12px;color:var(--text-muted)">${c.cargo}</div>
              <div style="font-size:12px;color:var(--fa-teal);font-weight:600">${c.empresa}</div>
            </div>
            ${c.decisor ? '<span style="margin-left:auto;background:rgba(99,102,241,0.1);color:#818cf8;border-radius:6px;padding:2px 6px;font-size:10px;font-weight:600">DECISOR</span>' : ''}
          </div>
          <div style="font-size:12px;color:var(--text-secondary);display:grid;gap:4px">
            <div><i class="fas fa-envelope" style="width:14px;color:var(--text-muted)"></i> ${c.email}</div>
            <div><i class="fas fa-phone" style="width:14px;color:var(--text-muted)"></i> ${c.telefone}</div>
            <div><i class="fas fa-map-marker-alt" style="width:14px;color:var(--text-muted)"></i> ${c.cidade}</div>
          </div>
          <div style="margin-top:10px;display:flex;gap:8px">
            <button onclick="editarContato('${c.id}')" class="btn btn-sm btn-secondary" style="flex:1"><i class="fas fa-edit"></i> Editar</button>
            <button onclick="verHistoricoContato('${c.id}')" class="btn btn-sm btn-secondary" style="flex:1"><i class="fas fa-history"></i> Histórico</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// ─── BADGES AUXILIARES ───
function _crmEtapaBadge(etapa) {
  const map = {
    'Prospecção': '#6366f1', 'Qualificação': '#3b82f6', 'Reunião Agendada': '#f59e0b',
    'Proposta Enviada': '#8b5cf6', 'Negociação': '#10b981',
    'Fechado Ganho': '#22c55e', 'Fechado Perdido': '#ef4444'
  };
  const cor = map[etapa] || '#8b949e';
  return `<span style="background:${cor}22;color:${cor};border-radius:6px;padding:3px 8px;font-size:11px;font-weight:600">${etapa}</span>`;
}

function _crmPropostaBadge(status) {
  const map = { 'Enviada': '#3b82f6', 'Em Negociação': '#f59e0b', 'Aprovada': '#22c55e', 'Cancelada': '#ef4444', 'Ganha': '#22c55e', 'Perdida': '#ef4444' };
  const cor = map[status] || '#8b949e';
  return `<span style="background:${cor}22;color:${cor};border-radius:6px;padding:3px 8px;font-size:11px;font-weight:600">${status}</span>`;
}

function _crmAtividadeBadge(tipo) {
  const map = { 'Reunião': '#3b82f6', 'E-mail': '#8b5cf6', 'Ligação': '#f59e0b', 'Visita Técnica': '#10b981', 'Negociação': '#ef4444', 'Proposta': '#22c55e' };
  const cor = map[tipo] || '#8b949e';
  return `<span style="background:${cor}22;color:${cor};border-radius:6px;padding:3px 8px;font-size:11px;font-weight:600">${tipo}</span>`;
}

function _crmAtividadeStatusBadge(status) {
  const map = { 'Realizada': '#22c55e', 'Pendente': '#f59e0b', 'Agendada': '#3b82f6', 'Cancelada': '#ef4444' };
  const cor = map[status] || '#8b949e';
  return `<span style="background:${cor}22;color:${cor};border-radius:6px;padding:3px 8px;font-size:11px;font-weight:600">${status}</span>`;
}

// ─── DETALHE DO LEAD ───
function verDetalheLead(id) {
  const l = CRM_DATA.leads.find(x => x.id === id);
  if (!l) return;
  const ativs = CRM_DATA.atividades.filter(a => a.lead === id);
  const proposta = CRM_DATA.propostas.find(p => p.lead === id);

  openModalWide('Lead – ' + l.empresa, `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
      <div>
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">EMPRESA / SEGMENTO</div>
        <div style="font-size:15px;font-weight:700;color:var(--text-primary)">${l.empresa}</div>
        <div style="font-size:12px;color:var(--text-secondary)">${l.segmento}</div>
      </div>
      <div>
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">ETAPA ATUAL</div>
        ${_crmEtapaBadge(l.etapa)}
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px">
      <div style="background:var(--bg-tertiary);border-radius:8px;padding:12px;text-align:center">
        <div style="font-size:11px;color:var(--text-muted)">Potencial</div>
        <div style="font-size:16px;font-weight:700;color:var(--fa-teal)">${fmtK(l.potencial)}</div>
      </div>
      <div style="background:var(--bg-tertiary);border-radius:8px;padding:12px;text-align:center">
        <div style="font-size:11px;color:var(--text-muted)">Probabilidade</div>
        <div style="font-size:16px;font-weight:700;color:${l.probabilidade>=60?'#22c55e':l.probabilidade>=30?'#f59e0b':'#ef4444'}">${l.probabilidade}%</div>
      </div>
      <div style="background:var(--bg-tertiary);border-radius:8px;padding:12px;text-align:center">
        <div style="font-size:11px;color:var(--text-muted)">Valor Esperado</div>
        <div style="font-size:16px;font-weight:700;color:var(--text-primary)">${fmtK(l.potencial * l.probabilidade / 100)}</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
      <div><div style="font-size:11px;color:var(--text-muted)">CONTATO PRINCIPAL</div><div style="color:var(--text-primary);font-weight:600">${l.contato}</div><div style="font-size:12px;color:var(--text-secondary)">${l.cargo}</div></div>
      <div><div style="font-size:11px;color:var(--text-muted)">E-MAIL / TELEFONE</div><div style="color:var(--text-primary)">${l.email}</div><div style="font-size:12px;color:var(--text-secondary)">${l.telefone}</div></div>
    </div>
    ${l.obs ? `<div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;padding:12px;margin-bottom:16px"><div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">OBSERVAÇÕES</div><div style="font-size:13px;color:var(--text-secondary)">${l.obs}</div></div>` : ''}
    ${ativs.length > 0 ? `
      <div style="margin-bottom:12px">
        <div style="font-size:12px;font-weight:600;color:var(--text-primary);margin-bottom:8px">HISTÓRICO DE ATIVIDADES</div>
        ${ativs.map(a => `
          <div style="display:flex;gap:12px;padding:8px 0;border-bottom:1px solid var(--border-color)">
            ${_crmAtividadeBadge(a.tipo)}
            <div style="flex:1">
              <div style="font-size:12px;color:var(--text-primary)">${a.descricao}</div>
              ${a.resultado ? `<div style="font-size:11px;color:var(--text-muted)">${a.resultado}</div>` : ''}
            </div>
            <span style="font-size:11px;color:var(--text-muted);white-space:nowrap">${a.data}</span>
          </div>
        `).join('')}
      </div>
    ` : ''}
    ${proposta ? `<div style="background:rgba(0,180,184,0.05);border:1px solid rgba(0,180,184,0.2);border-radius:8px;padding:12px;margin-bottom:12px"><div style="font-size:11px;color:var(--fa-teal);margin-bottom:4px">PROPOSTA ASSOCIADA</div><div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px"><span style="font-weight:600;color:var(--text-primary)">${proposta.numero}</span><span style="color:var(--fa-teal)">${fmt(proposta.valor)}</span><span>${_crmPropostaBadge(proposta.status)}</span></div></div>` : ''}

    <!-- WBS / Estimativa de Custo -->
    <div style="margin-bottom:12px">
      <div style="font-size:12px;font-weight:600;color:var(--text-primary);margin-bottom:8px;display:flex;align-items:center;gap:6px">
        <i class="fas fa-sitemap" style="color:var(--fa-teal)"></i> WBS / Estimativa de Custo do Projeto
      </div>
      <div id="crm-wbs-resumo-${id}">
        <div style="text-align:center;padding:12px;color:var(--text-muted)"><i class="fas fa-spinner fa-spin"></i> Carregando...</div>
      </div>
    </div>

    <!-- Alterar etapa -->
    <div style="margin-top:16px">
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px">ALTERAR ETAPA DO FUNIL</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${CRM_ETAPAS.map(e => `
          <button onclick="alterarEtapaLead('${id}','${e}')" class="btn btn-sm ${e===l.etapa?'btn-primary':'btn-secondary'}" style="font-size:11px">${e}</button>
        `).join('')}
      </div>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
    <button class="btn btn-secondary" onclick="gerarPDFLead('${id}')"><i class="fas fa-file-pdf" style="color:#ef4444"></i> PDF</button>
    <button class="btn btn-secondary" onclick="gerarWordLead('${id}')"><i class="fas fa-file-word" style="color:#2563eb"></i> Word</button>
    <button class="btn btn-secondary" onclick="novaAtividadeLead('${id}')"><i class="fas fa-plus"></i> Atividade</button>
    <button class="btn btn-primary" onclick="gerarPropostaLead('${id}')"><i class="fas fa-file-alt"></i> Gerar Proposta</button>
  `);

  // Renderiza resumo WBS após abrir o modal
  setTimeout(() => {
    if (typeof wbsRenderResumoForLead === 'function') {
      wbsRenderResumoForLead(id, 'crm-wbs-resumo-' + id);
    }
  }, 150);
}

function alterarEtapaLead(id, novaEtapa) {
  const l = CRM_DATA.leads.find(x => x.id === id);
  if (!l) return;
  const etapaAnterior = l.etapa;
  l.etapa = novaEtapa;
  l.ultimaAcao = new Date().toLocaleDateString('pt-BR');
  _saveCRMData(CRM_DATA);
  _crmSyncLeadServidor(l); // servidor dispara a orçamentação (C1) quando passa de Qualificação
  logAction('Editar', 'CRM', `Lead ${l.empresa}: etapa alterada de ${etapaAnterior} para ${novaEtapa}`);

  // Se fechado ganho, integra com contratos
  if (novaEtapa === 'Fechado Ganho') {
    showToast(`🎉 Lead convertido! Acesse Contratos para formalizar o contrato com ${l.empresa}`, 'success', 6000);
  }
  closeModal();
  showToast(`Etapa atualizada: ${novaEtapa}`, 'success');
  // Reabrir lead para ver mudança
  verDetalheLead(id);
}

// ─── MODAIS DE CRIAÇÃO ───
function openNovoLead() {
  openModalWide('Novo Lead / Oportunidade Comercial', `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Empresa *</label>
        <input type="text" id="nlEmpresa" placeholder="Razão Social ou Nome" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
      </div>
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Segmento *</label>
        <select id="nlSegmento" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
          <option>Mineração</option><option>Siderurgia</option><option>Metalurgia</option><option>Energia</option><option>Petróleo e Gás</option><option>Outros</option>
        </select>
      </div>
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Contato Principal *</label>
        <input type="text" id="nlContato" placeholder="Nome do contato" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
      </div>
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Cargo</label>
        <input type="text" id="nlCargo" placeholder="Ex: Gerente de Manutenção" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
      </div>
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">E-mail</label>
        <input type="email" id="nlEmail" placeholder="contato@empresa.com.br" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
      </div>
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Telefone</label>
        <input type="text" id="nlTelefone" placeholder="(XX) XXXXX-XXXX" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
      </div>
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Potencial (R$) *</label>
        <input type="number" id="nlPotencial" placeholder="0" min="0" step="1000" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
      </div>
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Probabilidade (%)</label>
        <input type="number" id="nlProb" placeholder="50" min="0" max="100" value="50" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
      </div>
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Origem</label>
        <select id="nlOrigem" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
          <option>Indicação</option><option>Prospecção Ativa</option><option>Site/Marketing</option><option>Evento/Feira</option><option>Renovação</option><option>Outros</option>
        </select>
      </div>
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Etapa Inicial</label>
        <select id="nlEtapa" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
          ${CRM_ETAPAS.slice(0,5).map(e=>`<option>${e}</option>`).join('')}
        </select>
      </div>
    </div>
    <div style="margin-top:12px">
      <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Observações / Contexto</label>
      <textarea id="nlObs" rows="3" placeholder="Detalhes sobre a oportunidade, contexto do contato..." style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box;resize:vertical"></textarea>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="salvarNovoLead()"><i class="fas fa-save"></i> Cadastrar Lead</button>
  `);
}

function salvarNovoLead() {
  const empresa = document.getElementById('nlEmpresa')?.value?.trim();
  const contato = document.getElementById('nlContato')?.value?.trim();
  const potencial = parseFloat(document.getElementById('nlPotencial')?.value || 0);
  if (!empresa || !contato) { showToast('Preencha os campos obrigatórios.', 'error'); return; }

  const now = new Date().toLocaleDateString('pt-BR');
  const lead = {
    id: gerarId('LEAD'),
    empresa,
    contato,
    cargo: document.getElementById('nlCargo')?.value || '',
    email: document.getElementById('nlEmail')?.value || '',
    telefone: document.getElementById('nlTelefone')?.value || '',
    origem: document.getElementById('nlOrigem')?.value || 'Outros',
    segmento: document.getElementById('nlSegmento')?.value || 'Outros',
    potencial,
    probabilidade: parseInt(document.getElementById('nlProb')?.value || 50),
    etapa: document.getElementById('nlEtapa')?.value || 'Prospecção',
    responsavel: currentUser?.name || '—',
    criado: now,
    ultimaAcao: now,
    obs: document.getElementById('nlObs')?.value || '',
    contratos: []
  };
  CRM_DATA.leads.unshift(lead);
  _saveCRMData(CRM_DATA);            // antes NEM o localStorage era salvo
  _crmSyncLeadServidor(lead);        // cria no servidor (tenant-isolado)
  logAction('Criar', 'CRM', `Novo lead cadastrado: ${empresa}`);
  closeModal();
  showToast(`Lead ${empresa} cadastrado com sucesso!`, 'success');
  renderCRM();
}

// ─── NOVA ATIVIDADE ───
function novaAtividadeLead(leadId) {
  const lead = CRM_DATA.leads.find(l => l.id === leadId);
  openModal('Registrar Atividade – ' + (lead ? lead.empresa : leadId), `
    <div style="display:grid;gap:12px">
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Tipo de Atividade *</label>
        <select id="atiTipo" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
          <option>Reunião</option><option>Ligação</option><option>E-mail</option><option>Visita Técnica</option><option>Negociação</option><option>Proposta</option>
        </select>
      </div>
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Descrição *</label>
        <textarea id="atiDesc" rows="2" placeholder="Descreva a atividade realizada..." style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box;resize:vertical"></textarea>
      </div>
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Data</label>
        <input type="date" id="atiData" value="${new Date().toISOString().split('T')[0]}" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
      </div>
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Status</label>
        <select id="atiStatus" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
          <option>Realizada</option><option>Agendada</option><option>Pendente</option>
        </select>
      </div>
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Resultado / Próximo Passo</label>
        <textarea id="atiResult" rows="2" placeholder="Qual foi o resultado? Qual o próximo passo?" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box;resize:vertical"></textarea>
      </div>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="salvarAtividade('${leadId}')"><i class="fas fa-save"></i> Registrar</button>
  `);
}

function novaAtividadeGeral() {
  openModal('Registrar Atividade', `
    <div style="margin-bottom:12px">
      <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Lead *</label>
      <select id="atiLeadSelect" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
        ${CRM_DATA.leads.map(l=>`<option value="${l.id}">${l.empresa} – ${l.contato}</option>`).join('')}
      </select>
    </div>
    <div style="display:grid;gap:12px">
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Tipo</label>
        <select id="atiTipo" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
          <option>Reunião</option><option>Ligação</option><option>E-mail</option><option>Visita Técnica</option><option>Negociação</option><option>Proposta</option>
        </select>
      </div>
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Descrição</label>
        <textarea id="atiDesc" rows="2" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box;resize:vertical"></textarea>
      </div>
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Data</label>
        <input type="date" id="atiData" value="${new Date().toISOString().split('T')[0]}" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
      </div>
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Status</label>
        <select id="atiStatus" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
          <option>Realizada</option><option>Agendada</option><option>Pendente</option>
        </select>
      </div>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="salvarAtividadeGeral()"><i class="fas fa-save"></i> Registrar</button>
  `);
}

function salvarAtividade(leadId) {
  const desc = document.getElementById('atiDesc')?.value?.trim();
  if (!desc) { showToast('Informe a descrição.', 'error'); return; }
  const dataRaw = document.getElementById('atiData')?.value;
  const dataFmt = dataRaw ? new Date(dataRaw + 'T12:00:00').toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR');
  CRM_DATA.atividades.unshift({
    id: gerarId('ATI'),
    lead: leadId,
    tipo: document.getElementById('atiTipo')?.value || 'Reunião',
    descricao: desc,
    data: dataFmt,
    responsavel: currentUser?.name || '—',
    status: document.getElementById('atiStatus')?.value || 'Realizada',
    resultado: document.getElementById('atiResult')?.value || ''
  });
  const lead = CRM_DATA.leads.find(l => l.id === leadId);
  if (lead) lead.ultimaAcao = dataFmt;
  logAction('Criar', 'CRM', `Atividade registrada para lead ${lead?.empresa || leadId}`);
  closeModal();
  showToast('Atividade registrada com sucesso!', 'success');
}

function salvarAtividadeGeral() {
  const leadId = document.getElementById('atiLeadSelect')?.value;
  salvarAtividade(leadId);
}

// ─── PROPOSTA ───
function gerarPropostaLead(leadId) {
  const lead = CRM_DATA.leads.find(l => l.id === leadId);
  if (!lead) return;
  const numProp = 'FA-PROP-2025-' + String(CRM_DATA.propostas.length + 42).padStart(4, '0');
  openModalWide('Gerar Proposta Comercial – ' + lead.empresa, `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Número da Proposta</label>
        <input type="text" id="propNumero" value="${numProp}" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
      </div>
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Cliente</label>
        <input type="text" id="propCliente" value="${lead.empresa}" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
      </div>
      <div style="grid-column:1/-1">
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Descrição / Objeto *</label>
        <input type="text" id="propDesc" placeholder="Ex: Manutenção industrial preventiva e corretiva..." style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
      </div>
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Valor Total (R$) *</label>
        <input type="number" id="propValor" value="${lead.potencial}" min="0" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
      </div>
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Prazo Contratual (meses)</label>
        <input type="number" id="propPrazo" value="24" min="1" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
      </div>
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Validade da Proposta</label>
        <input type="date" id="propValidade" value="${new Date(Date.now()+30*24*60*60*1000).toISOString().split('T')[0]}" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
      </div>
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Status Inicial</label>
        <select id="propStatus" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
          <option>Enviada</option><option>Em Negociação</option><option>Em Elaboração</option>
        </select>
      </div>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="salvarProposta('${leadId}')"><i class="fas fa-file-alt"></i> Salvar Proposta</button>
  `);
}

async function salvarProposta(leadId) {
  const desc = document.getElementById('propDesc')?.value?.trim();
  const valor = parseFloat(document.getElementById('propValor')?.value || 0);
  if (!desc) { showToast('Informe a descrição.', 'error'); return; }
  const now = new Date().toLocaleDateString('pt-BR');
  const validadeRaw = document.getElementById('propValidade')?.value;
  const validadeFmt = validadeRaw ? new Date(validadeRaw + 'T12:00:00').toLocaleDateString('pt-BR') : '';
  const prop = {
    id: gerarId('PROP'),
    lead: leadId,
    numero: document.getElementById('propNumero')?.value || '',
    cliente: document.getElementById('propCliente')?.value || '',
    descricao: desc,
    valor,
    prazo: parseInt(document.getElementById('propPrazo')?.value || 24),
    emissao: now,
    validade: validadeFmt,
    status: document.getElementById('propStatus')?.value || 'Enviada',
    versao: 1,
    responsavel: currentUser?.name || '—'
  };

  // ── C2 REAL: lead sincronizado → proposta via /api/propostas ──────────
  // O servidor impõe o gate "lead sem estimativa de custos (WBS) → 409" e
  // calcula custo_estimado; a proposta ganha o número oficial (PROP-AAAA-NNN).
  const leadC2 = CRM_DATA.leads.find(l => l.id === leadId);
  if (leadC2 && leadC2._srvId != null && window.NexusAPI) {
    const r = await NexusAPI.post('/api/propostas', {
      lead_id: leadC2._srvId,
      cliente: prop.cliente,
      objeto: desc,
      valor_total: valor,
    });
    if (r && r.id != null && !r._stub) {
      prop.numero = r.numero || prop.numero;
      prop._srvId = r.id;
      prop.custo_estimado = r.custo_estimado;
    } else if (r && r.error && /bloqueada|estimativa|orçament/i.test(r.error)) {
      // Gate C2: NÃO cria a proposta — orienta o caminho da estimativa.
      showToast(`${r.error} Crie a estimativa do lead em Controle de Custos.`, 'error', 8000);
      return;
    } // outros erros (offline) → segue no fluxo local abaixo
  }

  CRM_DATA.propostas.unshift(prop);
  _saveCRMData(CRM_DATA); // antes a proposta só persistia se a etapa mudasse

  // Atualiza etapa do lead para "Proposta Enviada"
  const lead = CRM_DATA.leads.find(l => l.id === leadId);
  if (lead && lead.etapa !== 'Fechado Ganho' && lead.etapa !== 'Negociação') {
    lead.etapa = 'Proposta Enviada';
    lead.ultimaAcao = now;
    _saveCRMData(CRM_DATA);
    _crmSyncLeadServidor(lead);
  }

  logAction('Criar', 'CRM', `Proposta ${prop.numero} gerada para ${prop.cliente}`);
  closeModal();
  showToast(`Proposta ${prop.numero} gerada e salva!`, 'success');
  renderCRM();
}

// ─── CONVERTER PROPOSTA EM CONTRATO ───
function converterPropostaEmContrato(propostaId) {
  const prop = CRM_DATA.propostas.find(p => p.id === propostaId);
  if (!prop) return;
  confirmarAcao(
    'Converter em Contrato',
    `Confirmar conversão da proposta <strong>${prop.numero}</strong> (${prop.cliente} · ${fmt(prop.valor)}) em um contrato ativo no sistema?`,
    `_executarConversaoContrato('${propostaId}')`,
    false
  );
}

function _executarConversaoContrato(propostaId) {
  const prop = CRM_DATA.propostas.find(p => p.id === propostaId);
  if (!prop) return;

  const hoje = new Date();
  const fimDate = new Date(hoje);
  fimDate.setMonth(fimDate.getMonth() + (prop.prazo || 24));
  const inicio = hoje.toLocaleDateString('pt-BR');
  const fim = fimDate.toLocaleDateString('pt-BR');
  const idContrato = 'CTR-' + hoje.getFullYear() + '-' + String(ERP_DATA.contratos.length + 1).padStart(3, '0');

  ERP_DATA.contratos.push({
    id: idContrato,
    cliente: prop.cliente,
    descricao: prop.descricao,
    status: 'Mobilização',
    inicio,
    fim,
    valor: prop.valor,
    medidoAcum: 0,
    custoAcum: 0,
    margem: 0,
    gestor: prop.responsavel,
    unidade: '—',
    tipo: 'Manutenção',
    equipe: 0,
    equipamentos: 0,
    ssmaStatus: 'Pendente',
    progress: 0,
    origemCRM: prop.numero
  });

  prop.status = 'Ganha';
  const lead = CRM_DATA.leads.find(l => l.id === prop.lead);
  if (lead) { lead.etapa = 'Fechado Ganho'; _saveCRMData(CRM_DATA); _crmSyncLeadServidor(lead); }

  logAction('Criar', 'Contratos', `Contrato ${idContrato} criado a partir da proposta CRM ${prop.numero}`);
  showToast(`Contrato ${idContrato} criado! Acesse o módulo Contratos para configurar.`, 'success', 6000);
  renderCRM();
}

// ─── NOVA PROPOSTA AVULSA ───
function openNovaProposta() {
  if (CRM_DATA.leads.length === 0) { showToast('Cadastre um lead primeiro.', 'warning'); return; }
  gerarPropostaLead(CRM_DATA.leads[0].id);
}

// ─── VISUALIZAR PROPOSTA (com WBS) ───
function verDetalheProposta(id) {
  const p = CRM_DATA.propostas.find(x => x.id === id);
  if (!p) return;
  openModalWide('Proposta – ' + p.numero, `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;grid-column:1/-1;padding-bottom:8px;border-bottom:1px solid var(--border-color)">
        <div>
          <div style="font-size:16px;font-weight:700;color:var(--text-primary)">${p.numero}</div>
          <div style="font-size:12px;color:var(--text-muted)">${p.cliente}</div>
        </div>
        ${_crmPropostaBadge(p.status)}
      </div>
      <div>
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:3px">OBJETO</div>
        <div style="font-size:13px;color:var(--text-primary)">${p.descricao}</div>
      </div>
      <div>
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:3px">VALOR TOTAL</div>
        <div style="font-size:18px;font-weight:700;color:var(--fa-teal)">${fmt(p.valor)}</div>
      </div>
      <div>
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:3px">PRAZO / VIGÊNCIA</div>
        <div style="font-size:13px;color:var(--text-primary)">${p.prazo} meses</div>
      </div>
      <div>
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:3px">VALIDADE</div>
        <div style="font-size:13px;color:var(--text-primary)">${p.validade||'—'}</div>
      </div>
      <div>
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:3px">EMISSÃO / VERSÃO</div>
        <div style="font-size:13px;color:var(--text-primary)">${p.emissao} · v${p.versao||1}</div>
      </div>
      <div>
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:3px">RESPONSÁVEL</div>
        <div style="font-size:13px;color:var(--text-primary)">${p.responsavel||'—'}</div>
      </div>
    </div>

    <!-- WBS / Estimativa de Custo da Proposta -->
    <div style="border-top:1px solid var(--border-color);padding-top:14px">
      <div style="font-size:13px;font-weight:600;color:var(--text-primary);margin-bottom:10px;display:flex;align-items:center;gap:8px">
        <i class="fas fa-sitemap" style="color:var(--fa-teal)"></i>
        WBS / Estimativa de Custo
        <span style="font-size:11px;font-weight:400;color:var(--text-muted)">· Estrutura de decomposição de trabalho desta proposta</span>
      </div>
      <div id="crm-proposta-wbs-${id}" style="min-height:60px">
        <div style="text-align:center;padding:16px;color:var(--text-muted)"><i class="fas fa-spinner fa-spin"></i> Carregando WBS...</div>
      </div>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
    <button class="btn btn-secondary" onclick="gerarPDFProposta('${id}')"><i class="fas fa-file-pdf" style="color:#ef4444"></i> PDF</button>
    <button class="btn btn-secondary" onclick="gerarWordProposta('${id}')"><i class="fas fa-file-word" style="color:#2563eb"></i> Word</button>
    <button class="btn btn-primary" onclick="converterPropostaEmContrato('${id}')"><i class="fas fa-check-circle"></i> Converter em Contrato</button>
  `);

  // Renderiza WBS após abrir modal
  setTimeout(() => {
    const containerId = 'crm-proposta-wbs-' + id;
    // Tenta buscar WBS pela proposta ou pelo lead associado
    let wbsRendered = false;
    if (typeof wbsRenderResumoForLead === 'function') {
      // Tenta pelo id da proposta
      const pidByProp = typeof wbsGetProjetoIdForProposta === 'function' ? wbsGetProjetoIdForProposta(id) : null;
      if (pidByProp) {
        wbsRenderResumoForLead(id, containerId);
        wbsRendered = true;
      } else if (p.lead) {
        // Tenta pelo lead associado
        const pidByLead = typeof wbsGetProjetoIdForProposta === 'function' ? wbsGetProjetoIdForProposta(p.lead) : null;
        if (pidByLead) {
          wbsRenderResumoForLead(p.lead, containerId);
          wbsRendered = true;
        }
      }
    }
    if (!wbsRendered) {
      const el = document.getElementById(containerId);
      if (el) el.innerHTML = `
        <div style="text-align:center;padding:20px;color:var(--text-muted)">
          <i class="fas fa-sitemap" style="font-size:28px;opacity:0.3;display:block;margin-bottom:8px"></i>
          <p style="font-size:13px;margin-bottom:10px">Nenhuma WBS vinculada a esta proposta.</p>
          <button onclick="closeModal();wbsCriarWBSParaProposta('${id}')" class="btn btn-sm btn-primary">
            <i class="fas fa-magic"></i> Criar Estimativa WBS
          </button>
        </div>`;
    }
  }, 150);
}

// Cria WBS diretamente para uma proposta (sem passar pelo lead)
function wbsCriarWBSParaProposta(propostaId) {
  const p = CRM_DATA.propostas.find(x => x.id === propostaId);
  if (!p) return;
  if (typeof wbsCriarProjetoParaProposta === 'function') {
    const pid = wbsCriarProjetoParaProposta(p);
    showToast(`Estimativa WBS criada (${pid}) para a proposta ${p.numero}!`, 'success');
    verDetalheProposta(propostaId);
  }
}

// ─── EDITAR LEAD ───
function editarLead(id) {
  const l = CRM_DATA.leads.find(x => x.id === id);
  if (!l) return;
  openModalWide('Editar Lead – ' + l.empresa, `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Empresa</label>
        <input type="text" id="elEmpresa" value="${l.empresa}" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
      </div>
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Etapa</label>
        <select id="elEtapa" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
          ${CRM_ETAPAS.map(e=>`<option ${e===l.etapa?'selected':''}>${e}</option>`).join('')}
        </select>
      </div>
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Potencial (R$)</label>
        <input type="number" id="elPotencial" value="${l.potencial}" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
      </div>
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Probabilidade (%)</label>
        <input type="number" id="elProb" value="${l.probabilidade}" min="0" max="100" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
      </div>
      <div style="grid-column:1/-1">
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Observações</label>
        <textarea id="elObs" rows="3" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box;resize:vertical">${l.obs || ''}</textarea>
      </div>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="salvarEdicaoLead('${id}')"><i class="fas fa-save"></i> Salvar</button>
  `);
}

function salvarEdicaoLead(id) {
  const l = CRM_DATA.leads.find(x => x.id === id);
  if (!l) return;
  l.empresa = document.getElementById('elEmpresa')?.value || l.empresa;
  l.etapa = document.getElementById('elEtapa')?.value || l.etapa;
  l.potencial = parseFloat(document.getElementById('elPotencial')?.value || l.potencial);
  l.probabilidade = parseInt(document.getElementById('elProb')?.value || l.probabilidade);
  l.obs = document.getElementById('elObs')?.value || l.obs;
  l.ultimaAcao = new Date().toLocaleDateString('pt-BR');
  _saveCRMData(CRM_DATA);
  _crmSyncLeadServidor(l);
  logAction('Editar', 'CRM', `Lead ${l.empresa} editado`);
  closeModal();
  showToast('Lead atualizado!', 'success');
}

// ─── EDITAR PROPOSTA ───
function editarProposta(id) {
  const p = CRM_DATA.propostas.find(x => x.id === id);
  if (!p) return;
  openModal('Editar Proposta – ' + p.numero, `
    <div style="display:grid;gap:10px">
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Valor (R$)</label>
        <input type="number" id="epValor" value="${p.valor}" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
      </div>
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Status</label>
        <select id="epStatus" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
          <option ${p.status==='Enviada'?'selected':''}>Enviada</option>
          <option ${p.status==='Em Negociação'?'selected':''}>Em Negociação</option>
          <option ${p.status==='Aprovada'?'selected':''}>Aprovada</option>
          <option ${p.status==='Cancelada'?'selected':''}>Cancelada</option>
          <option ${p.status==='Ganha'?'selected':''}>Ganha</option>
          <option ${p.status==='Perdida'?'selected':''}>Perdida</option>
        </select>
      </div>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="salvarEdicaoProposta('${id}')">Salvar</button>
  `);
}

function salvarEdicaoProposta(id) {
  const p = CRM_DATA.propostas.find(x => x.id === id);
  if (!p) return;
  p.valor = parseFloat(document.getElementById('epValor')?.value || p.valor);
  p.status = document.getElementById('epStatus')?.value || p.status;
  p.versao += 1;
  logAction('Editar', 'CRM', `Proposta ${p.numero} editada – v${p.versao}`);
  closeModal();
  showToast('Proposta atualizada!', 'success');
}

// ─── CONTATOS ───
function openNovoContato() {
  openModal('Novo Contato CRM', `
    <div style="display:grid;gap:10px">
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Nome *</label>
        <input type="text" id="ncNome" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
      </div>
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Empresa *</label>
        <input type="text" id="ncEmpresa" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
      </div>
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Cargo</label>
        <input type="text" id="ncCargo" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
      </div>
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">E-mail</label>
        <input type="email" id="ncEmail" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
      </div>
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Telefone</label>
        <input type="text" id="ncTelefone" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
      </div>
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Cidade / UF</label>
        <input type="text" id="ncCidade" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <input type="checkbox" id="ncDecisor">
        <label for="ncDecisor" style="font-size:13px;color:var(--text-secondary);cursor:pointer">É decisor de compras</label>
      </div>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="salvarNovoContato()"><i class="fas fa-save"></i> Cadastrar</button>
  `);
}

function salvarNovoContato() {
  const nome = document.getElementById('ncNome')?.value?.trim();
  const empresa = document.getElementById('ncEmpresa')?.value?.trim();
  if (!nome || !empresa) { showToast('Nome e empresa são obrigatórios.', 'error'); return; }
  CRM_DATA.contatos.push({
    id: gerarId('CONT'),
    nome,
    empresa,
    cargo: document.getElementById('ncCargo')?.value || '',
    email: document.getElementById('ncEmail')?.value || '',
    telefone: document.getElementById('ncTelefone')?.value || '',
    cidade: document.getElementById('ncCidade')?.value || '',
    decisor: document.getElementById('ncDecisor')?.checked || false,
    status: 'Ativo'
  });
  logAction('Criar', 'CRM', `Contato ${nome} (${empresa}) cadastrado`);
  closeModal();
  showToast('Contato cadastrado!', 'success');
}

function editarContato(id) {
  const c = CRM_DATA.contatos.find(x => x.id === id);
  if (!c) return;
  openModal('Editar Contato – ' + c.nome, `
    <div style="display:grid;gap:10px">
      <div><label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">E-mail</label><input type="email" id="ecEmail" value="${c.email}" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box"></div>
      <div><label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Telefone</label><input type="text" id="ecTelefone" value="${c.telefone}" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box"></div>
      <div><label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Cargo</label><input type="text" id="ecCargo" value="${c.cargo}" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box"></div>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="salvarEdicaoContato('${id}')">Salvar</button>
  `);
}

function salvarEdicaoContato(id) {
  const c = CRM_DATA.contatos.find(x => x.id === id);
  if (!c) return;
  c.email = document.getElementById('ecEmail')?.value || c.email;
  c.telefone = document.getElementById('ecTelefone')?.value || c.telefone;
  c.cargo = document.getElementById('ecCargo')?.value || c.cargo;
  logAction('Editar', 'CRM', `Contato ${c.nome} editado`);
  closeModal();
  showToast('Contato atualizado!', 'success');
}

function verHistoricoContato(id) {
  const c = CRM_DATA.contatos.find(x => x.id === id);
  if (!c) return;
  const lead = CRM_DATA.leads.find(l => l.empresa === c.empresa);
  const ativs = lead ? CRM_DATA.atividades.filter(a => a.lead === lead.id) : [];
  openModal('Histórico – ' + c.nome, `
    <div style="font-size:13px;color:var(--text-secondary);margin-bottom:12px">
      ${c.empresa} · ${c.cargo} · ${c.email}
    </div>
    ${ativs.length ? ativs.map(a => `
      <div style="padding:8px 0;border-bottom:1px solid var(--border-color);font-size:12px">
        <div style="display:flex;justify-content:space-between;margin-bottom:2px">
          ${_crmAtividadeBadge(a.tipo)} <span style="color:var(--text-muted)">${a.data}</span>
        </div>
        <div style="color:var(--text-primary)">${a.descricao}</div>
        ${a.resultado ? `<div style="color:var(--text-muted)">${a.resultado}</div>` : ''}
      </div>
    `).join('') : '<div style="text-align:center;color:var(--text-muted);padding:20px">Nenhuma atividade registrada para este contato.</div>'}
  `, `<button class="btn btn-secondary" onclick="closeModal()">Fechar</button>`);
}

// ─── HELPER: monta HTML de proposta para impressão/export ───────────────────
function _crmHtmlProposta(p) {
  const lead = CRM_DATA.leads.find(l => l.id === p.lead) || {};
  const fmt  = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0);
  const hoje = new Date().toLocaleDateString('pt-BR');
  const itens = (p.itens || []);
  const totalItens = itens.reduce((s, it) => s + (it.total || (it.qtd||1)*(it.valor_unit||it.preco||0)), 0);

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Proposta Comercial – ${p.numero || p.id}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #222; background: #fff; padding: 32px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; border-bottom: 3px solid #00897B; padding-bottom: 16px; }
    .logo-area h1 { font-size: 22px; font-weight: 900; color: #00897B; margin-bottom: 2px; }
    .logo-area p { font-size: 11px; color: #555; }
    .doc-info { text-align: right; }
    .doc-info .num { font-size: 18px; font-weight: 700; color: #00897B; }
    .doc-info .sub { font-size: 11px; color: #777; margin-top: 2px; }
    .section { margin-bottom: 20px; }
    .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: #00897B; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-bottom: 10px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 20px; margin-bottom: 10px; }
    .info-item label { font-size: 10px; color: #888; display: block; margin-bottom: 2px; }
    .info-item span { font-size: 12px; font-weight: 600; color: #222; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
    th { background: #00897B; color: #fff; padding: 7px 10px; text-align: left; font-size: 11px; }
    td { padding: 6px 10px; border-bottom: 1px solid #eee; font-size: 11px; }
    tr:nth-child(even) td { background: #f9f9f9; }
    .total-row td { font-weight: 700; font-size: 13px; border-top: 2px solid #00897B; background: #e8f5e9; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 700; }
    .badge-green { background: #e8f5e9; color: #2e7d32; }
    .badge-blue  { background: #e3f2fd; color: #1565c0; }
    .badge-amber { background: #fff8e1; color: #e65100; }
    .footer { margin-top: 32px; border-top: 1px solid #ddd; padding-top: 12px; font-size: 10px; color: #888; display: flex; justify-content: space-between; }
    .signature { margin-top: 40px; display: flex; gap: 40px; }
    .sig-line { flex: 1; border-top: 1px solid #ccc; padding-top: 6px; text-align: center; font-size: 10px; color: #888; }
    @media print { body { padding: 16px; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo-area">
      <h1>Fraser Alexander</h1>
      <p>Sistema de Gestão Integrado – Módulo CRM</p>
      <p style="margin-top:6px;font-size:11px">Proposta emitida em: <strong>${hoje}</strong></p>
    </div>
    <div class="doc-info">
      <div class="num">${p.numero || p.id}</div>
      <div class="sub">PROPOSTA COMERCIAL</div>
      <div class="sub" style="margin-top:6px">
        <span class="badge ${p.status==='Enviada'?'badge-blue':p.status==='Fechado Ganho'?'badge-green':'badge-amber'}">${p.status||'—'}</span>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Dados do Cliente / Lead</div>
    <div class="info-grid">
      <div class="info-item"><label>Empresa</label><span>${p.empresa || lead.empresa || '—'}</span></div>
      <div class="info-item"><label>Contato</label><span>${p.contato || lead.contato || '—'}</span></div>
      <div class="info-item"><label>Segmento</label><span>${p.segmento || lead.segmento || '—'}</span></div>
      <div class="info-item"><label>E-mail</label><span>${lead.email || '—'}</span></div>
      <div class="info-item"><label>Telefone</label><span>${lead.telefone || '—'}</span></div>
      <div class="info-item"><label>Endereço</label><span>${lead.endereco || '—'}</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Dados da Proposta</div>
    <div class="info-grid">
      <div class="info-item"><label>Número da Proposta</label><span>${p.numero || p.id}</span></div>
      <div class="info-item"><label>Data de Emissão</label><span>${p.data || hoje}</span></div>
      <div class="info-item"><label>Validade</label><span>${p.validade || '30 dias'}</span></div>
      <div class="info-item"><label>Responsável Comercial</label><span>${p.responsavel || '—'}</span></div>
      <div class="info-item"><label>Probabilidade</label><span>${p.probabilidade || lead.probabilidade || '—'}%</span></div>
      <div class="info-item"><label>Objeto / Escopo</label><span>${p.objeto || p.titulo || '—'}</span></div>
    </div>
    ${p.descricao ? `<p style="font-size:12px;color:#444;margin-top:8px;line-height:1.5">${p.descricao}</p>` : ''}
  </div>

  ${itens.length > 0 ? `
  <div class="section">
    <div class="section-title">Itens da Proposta</div>
    <table>
      <thead><tr><th>#</th><th>Descrição</th><th style="text-align:center">Qtd</th><th>Un</th><th style="text-align:right">Valor Unit.</th><th style="text-align:right">Total</th></tr></thead>
      <tbody>
        ${itens.map((it, i) => {
          const tot = it.total || (it.qtd||1)*(it.valor_unit||it.preco||0);
          return `<tr>
            <td style="color:#888">${i+1}</td>
            <td>${it.descricao || it.nome || '—'}</td>
            <td style="text-align:center">${it.qtd||1}</td>
            <td>${it.unidade||it.un||'vb'}</td>
            <td style="text-align:right">${fmt(it.valor_unit||it.preco||0)}</td>
            <td style="text-align:right">${fmt(tot)}</td>
          </tr>`;
        }).join('')}
        <tr class="total-row">
          <td colspan="5" style="text-align:right">TOTAL ESTIMADO</td>
          <td style="text-align:right;color:#00897B">${fmt(totalItens || p.valor || 0)}</td>
        </tr>
      </tbody>
    </table>
  </div>
  ` : `
  <div class="section">
    <div class="section-title">Valor da Proposta</div>
    <table>
      <thead><tr><th>Escopo</th><th style="text-align:right">Valor Total</th></tr></thead>
      <tbody>
        <tr><td>${p.objeto || p.titulo || 'Conforme escopo negociado'}</td><td style="text-align:right;font-weight:700;color:#00897B">${fmt(p.valor)}</td></tr>
      </tbody>
    </table>
  </div>
  `}

  ${p.condicoes_pagamento || p.obs ? `
  <div class="section">
    <div class="section-title">Condições Comerciais</div>
    ${p.condicoes_pagamento ? `<p style="margin-bottom:6px"><strong>Pagamento:</strong> ${p.condicoes_pagamento}</p>` : ''}
    ${p.prazo_entrega ? `<p style="margin-bottom:6px"><strong>Prazo de Entrega:</strong> ${p.prazo_entrega}</p>` : ''}
    ${p.garantia ? `<p style="margin-bottom:6px"><strong>Garantia:</strong> ${p.garantia}</p>` : ''}
    ${p.obs ? `<p style="margin-top:8px;color:#444;font-size:11px">${p.obs}</p>` : ''}
  </div>
  ` : ''}

  <div class="signature">
    <div class="sig-line">Aprovado por<br><br><br>${p.responsavel || 'Responsável Comercial'}<br>Fraser Alexander</div>
    <div class="sig-line">Cliente<br><br><br>${p.empresa || lead.empresa || '—'}<br>Data: ___/___/______</div>
  </div>

  <div class="footer">
    <span>Fraser Alexander – Documento gerado pelo Sistema de Gestão em ${hoje}</span>
    <span>${p.numero || p.id}</span>
  </div>
</body>
</html>`;
}

// ─── GERAR PDF DE PROPOSTA CRM ───────────────────────────────────────────────
function gerarPDFProposta(id) {
  const p = CRM_DATA.propostas.find(x => x.id === id);
  if (!p) { showToast('Proposta não encontrada.', 'error'); return; }

  const html = _crmHtmlProposta(p);
  const win  = window.open('', '_blank', 'width=900,height=700');
  if (!win) { showToast('Popup bloqueado. Permita pop-ups para este site.', 'error'); return; }

  win.document.write(html);
  win.document.close();

  // Aguarda carregamento e aciona impressão
  win.onload = function() {
    setTimeout(() => {
      win.focus();
      win.print();
    }, 400);
  };

  showToast(`📄 PDF da proposta ${p.numero||p.id} pronto para impressão/download!`, 'success', 4000);
  logAction && logAction('PDF', 'CRM', `PDF da proposta ${p.numero||p.id} gerado`);
}

// ─── GERAR WORD (.doc) DE PROPOSTA CRM ──────────────────────────────────────
function gerarWordProposta(id) {
  const p = CRM_DATA.propostas.find(x => x.id === id);
  if (!p) { showToast('Proposta não encontrada.', 'error'); return; }

  const html = _crmHtmlProposta(p);

  // Word aceita HTML com namespace MIME correto
  const mimeType = 'application/vnd.ms-word';
  const fileContent = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office'
          xmlns:w='urn:schemas-microsoft-com:office:word'
          xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset='UTF-8'>
      <meta name=ProgId content=Word.Document>
      <meta name=Generator content='Microsoft Word 14'>
      <meta name=Originator content='Microsoft Word 14'>
      <!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>90</w:Zoom><w:DoNotOptimizeForBrowser/></w:WordDocument></xml><![endif]-->
    </head>
    <body>${html}</body>
    </html>`;

  const blob    = new Blob(['\ufeff', fileContent], { type: mimeType });
  const url     = URL.createObjectURL(blob);
  const a       = document.createElement('a');
  a.href        = url;
  a.download    = `Proposta_${(p.numero||p.id).replace(/[^a-zA-Z0-9-_]/g,'_')}_${new Date().toISOString().split('T')[0]}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast(`📝 Word da proposta ${p.numero||p.id} gerado e baixado!`, 'success', 4000);
  logAction && logAction('Word', 'CRM', `Word da proposta ${p.numero||p.id} gerado`);
}

// ─── GERAR PDF DE LEAD/OPORTUNIDADE ─────────────────────────────────────────
function gerarPDFLead(leadId) {
  const l = CRM_DATA.leads.find(x => x.id === leadId);
  if (!l) { showToast('Lead não encontrado.', 'error'); return; }
  const fmt = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0);
  const hoje = new Date().toLocaleDateString('pt-BR');
  const propostas = CRM_DATA.propostas.filter(p => p.lead === leadId);
  const atividades = (CRM_DATA.atividades || []).filter(a => a.lead === leadId);

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Ficha de Lead – ${l.empresa}</title>
  <style>
    * { box-sizing:border-box; margin:0; padding:0; }
    body { font-family:Arial,Helvetica,sans-serif; font-size:12px; color:#222; background:#fff; padding:32px; }
    .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:28px; border-bottom:3px solid #00897B; padding-bottom:16px; }
    .logo-area h1 { font-size:22px; font-weight:900; color:#00897B; }
    .logo-area p { font-size:11px; color:#555; margin-top:2px; }
    .doc-info { text-align:right; }
    .doc-info .empresa { font-size:18px; font-weight:700; color:#00897B; }
    .section { margin-bottom:20px; }
    .section-title { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.8px; color:#00897B; border-bottom:1px solid #ddd; padding-bottom:4px; margin-bottom:10px; }
    .info-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px 20px; }
    .info-item label { font-size:10px; color:#888; display:block; margin-bottom:2px; }
    .info-item span { font-size:12px; font-weight:600; }
    table { width:100%; border-collapse:collapse; font-size:11px; }
    th { background:#00897B; color:#fff; padding:7px 10px; text-align:left; }
    td { padding:6px 10px; border-bottom:1px solid #eee; }
    tr:nth-child(even) td { background:#f9f9f9; }
    .footer { margin-top:32px; border-top:1px solid #ddd; padding-top:12px; font-size:10px; color:#888; display:flex; justify-content:space-between; }
    @media print { body { padding:16px; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo-area"><h1>Fraser Alexander</h1><p>CRM Comercial – Ficha de Lead / Oportunidade</p></div>
    <div class="doc-info"><div class="empresa">${l.empresa}</div><div style="font-size:11px;color:#777;margin-top:4px">Gerado em ${hoje}</div></div>
  </div>

  <div class="section">
    <div class="section-title">Dados da Oportunidade</div>
    <div class="info-grid">
      <div class="info-item"><label>Empresa</label><span>${l.empresa}</span></div>
      <div class="info-item"><label>Contato</label><span>${l.contato||'—'}</span></div>
      <div class="info-item"><label>Segmento</label><span>${l.segmento||'—'}</span></div>
      <div class="info-item"><label>Etapa Atual</label><span>${l.etapa||'—'}</span></div>
      <div class="info-item"><label>Potencial</label><span>${fmt(l.potencial)}</span></div>
      <div class="info-item"><label>Probabilidade</label><span>${l.probabilidade||0}%</span></div>
      <div class="info-item"><label>Valor Esperado</label><span>${fmt((l.potencial||0)*(l.probabilidade||0)/100)}</span></div>
      <div class="info-item"><label>Última Ação</label><span>${l.ultimaAcao||'—'}</span></div>
    </div>
  </div>

  ${propostas.length > 0 ? `
  <div class="section">
    <div class="section-title">Propostas Vinculadas (${propostas.length})</div>
    <table>
      <thead><tr><th>Número</th><th>Objeto</th><th>Data</th><th style="text-align:right">Valor</th><th>Status</th></tr></thead>
      <tbody>
        ${propostas.map(pp => `
          <tr>
            <td style="font-weight:700;color:#00897B">${pp.numero||pp.id}</td>
            <td>${pp.objeto||pp.titulo||'—'}</td>
            <td>${pp.data||'—'}</td>
            <td style="text-align:right;font-weight:600">${fmt(pp.valor)}</td>
            <td>${pp.status||'—'}</td>
          </tr>`).join('')}
      </tbody>
    </table>
  </div>` : ''}

  ${atividades.length > 0 ? `
  <div class="section">
    <div class="section-title">Histórico de Atividades</div>
    <table>
      <thead><tr><th>Data</th><th>Tipo</th><th>Descrição</th><th>Responsável</th></tr></thead>
      <tbody>
        ${atividades.slice(0,10).map(a => `
          <tr>
            <td>${a.data||'—'}</td>
            <td>${a.tipo||'—'}</td>
            <td>${a.descricao||'—'}</td>
            <td>${a.responsavel||'—'}</td>
          </tr>`).join('')}
      </tbody>
    </table>
  </div>` : ''}

  ${l.obs ? `<div class="section"><div class="section-title">Observações</div><p style="font-size:12px;color:#444;line-height:1.5">${l.obs}</p></div>` : ''}

  <div class="footer">
    <span>Fraser Alexander – Sistema de Gestão Integrado · CRM · ${hoje}</span>
    <span>${l.id}</span>
  </div>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) { showToast('Popup bloqueado. Permita pop-ups para este site.', 'error'); return; }
  win.document.write(html);
  win.document.close();
  win.onload = function() { setTimeout(() => { win.focus(); win.print(); }, 400); };
  showToast(`📄 PDF da ficha de lead "${l.empresa}" pronto!`, 'success', 4000);
  logAction && logAction('PDF', 'CRM', `PDF ficha lead ${l.empresa} gerado`);
}

// ─── GERAR WORD DE LEAD ───────────────────────────────────────────────────────
function gerarWordLead(leadId) {
  const l = CRM_DATA.leads.find(x => x.id === leadId);
  if (!l) { showToast('Lead não encontrado.', 'error'); return; }
  // Reutiliza o HTML do PDF para gerar Word
  const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='UTF-8'><meta name=ProgId content=Word.Document></head><body>${_buildLeadHtml(l)}</body></html>`;
  const blob  = new Blob(['\ufeff', html], { type: 'application/vnd.ms-word' });
  const url   = URL.createObjectURL(blob);
  const a     = document.createElement('a');
  a.href = url;
  a.download = `Lead_${l.empresa.replace(/[^a-zA-Z0-9]/g,'_')}_${new Date().toISOString().split('T')[0]}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(`📝 Word da ficha de lead "${l.empresa}" gerado!`, 'success', 4000);
  logAction && logAction('Word', 'CRM', `Word ficha lead ${l.empresa} gerado`);
}

// helper simples para Word de lead (plain text)
function _buildLeadHtml(l) {
  const fmt = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0);
  return `<h2>${l.empresa}</h2><p><b>Contato:</b> ${l.contato||'—'} | <b>Segmento:</b> ${l.segmento||'—'}</p><p><b>Etapa:</b> ${l.etapa||'—'} | <b>Potencial:</b> ${fmt(l.potencial)} | <b>Probabilidade:</b> ${l.probabilidade||0}%</p>${l.obs?`<p>${l.obs}</p>`:''}`;
}

// ─── EXPORTAR CRM ───
function exportCRM() {
  const rows = [['ID','Empresa','Contato','Segmento','Potencial','Probabilidade','Etapa','Última Ação']];
  CRM_DATA.leads.forEach(l => rows.push([l.id, l.empresa, l.contato, l.segmento, l.potencial, l.probabilidade + '%', l.etapa, l.ultimaAcao]));
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent('\uFEFF' + csv);
  a.download = 'CRM_Fraser_Alexander_' + new Date().toISOString().split('T')[0] + '.csv';
  a.click();
  showToast('Exportação CSV realizada!', 'success');
  logAction('Exportar', 'CRM', 'Leads exportados para CSV');
}

// ─── EXPOR GLOBALMENTE ────────────────────────────────────────────────────────
window.gerarPDFProposta    = gerarPDFProposta;
window.gerarWordProposta   = gerarWordProposta;
window.gerarPDFLead        = gerarPDFLead;
window.gerarWordLead       = gerarWordLead;
window._crmHtmlProposta    = _crmHtmlProposta;

// Exposições globais (onclick inline + testes em ambiente de módulo).
window.salvarNovoLead = salvarNovoLead;
window.salvarEdicaoLead = salvarEdicaoLead;
window.alterarEtapaLead = alterarEtapaLead;
window.salvarProposta = salvarProposta;

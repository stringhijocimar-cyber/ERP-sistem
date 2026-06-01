// =====================================================================
// Fraser Alexander ERP – Módulo: PROPOSTA COMERCIAL v1.0
// Fluxo: CRM Lead → Proposta → WBS/Precificação → Revisão → Envio
// Totalmente editável em todas as camadas
// =====================================================================

// ─── STORAGE ─────────────────────────────────────────────────────────
function _getPropData() {
  try {
    const raw = localStorage.getItem('fa_propostas_comerciais');
    if (raw) return JSON.parse(raw);
  } catch(e) {}
  return [];
}
function _savePropData(arr) {
  localStorage.setItem('fa_propostas_comerciais', JSON.stringify(arr));
}

// ─── HELPERS ─────────────────────────────────────────────────────────
function _propFmt(v) {
  if (v == null || isNaN(v)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v);
}
function _propFmtPct(v) {
  return (v == null || isNaN(v)) ? '0,0%' : Number(v).toFixed(1).replace('.',',') + '%';
}
function _propGerarNumero() {
  const lista = _getPropData();
  const ano = new Date().getFullYear();
  const seq = lista.filter(p => p.numero && p.numero.includes(String(ano))).length + 1;
  return `FA-PROP-${ano}-${String(seq).padStart(4,'0')}`;
}
function _propStatusBadge(s) {
  const m = {
    'Em Elaboração': '#6366f1',
    'Aguardando Revisão': '#f59e0b',
    'Em Revisão': '#8b5cf6',
    'Aprovada Internamente': '#0891b2',
    'Enviada ao Cliente': '#3b82f6',
    'Em Negociação': '#f97316',
    'Ganha': '#22c55e',
    'Perdida': '#ef4444',
    'Cancelada': '#94a3b8'
  };
  const c = m[s] || '#64748b';
  return `<span style="display:inline-flex;align-items:center;gap:5px;background:${c}22;color:${c};border:1px solid ${c}44;border-radius:20px;padding:2px 10px;font-size:11px;font-weight:600">${s||'—'}</span>`;
}

// Naturezas WBS padrão Fraser Alexander
const _PROP_WBS_NATUREZAS = [
  'Subcontracted Services','Catering','Consumables','Fuel – Mobile Equipment',
  'Equipment','Engineering Projects','Full Construction of Construction Site',
  'Advanced Construction Site Setup','Central Construction Site Maintenance & Operation',
  'Labour','Travel & Accommodation','Utilities','Overhead','Contingency','Others'
];
const _PROP_WBS_EXPENDITURES = ['CAPEX','OPEX','G&A','Contingency'];
const _PROP_WBS_TIPO_CUSTO = ['One-off','Recorrente','Mensal','Trimestral','Anual'];

// ─── RENDER PRINCIPAL ─────────────────────────────────────────────────
function renderPropostaComercial() {
  const ok = currentUser && ['admin','diretor','crm','comercial'].includes(currentUser.profile);
  if (!ok) {
    document.getElementById('mainContent').innerHTML = `
      <div class="empty-state" style="padding-top:80px">
        <i class="fas fa-lock" style="color:var(--red-light);font-size:48px"></i>
        <p style="margin-top:16px;font-size:16px;font-weight:600;color:var(--text-primary)">Acesso Restrito</p>
        <p style="font-size:13px;color:var(--text-secondary)">Módulo disponível para Diretor Comercial e Administrador.</p>
      </div>`;
    return;
  }

  const lista = _getPropData();
  const total = lista.length;
  const emElab = lista.filter(p => p.status === 'Em Elaboração').length;
  const enviadas = lista.filter(p => ['Enviada ao Cliente','Em Negociação'].includes(p.status)).length;
  const ganhas = lista.filter(p => p.status === 'Ganha').length;
  const valorTotal = lista.filter(p => !['Perdida','Cancelada'].includes(p.status)).reduce((a,p) => a+(p.valor_total||0), 0);

  document.getElementById('mainContent').innerHTML = `
    <div class="page-header">
      <div class="page-title">
        <h2><i class="fas fa-file-contract" style="color:var(--fa-teal);margin-right:8px"></i>Propostas Comerciais</h2>
        <p>Elaboração, WBS, Precificação e Envio de Propostas · Fraser Alexander</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary btn-sm" onclick="_propExportar()"><i class="fas fa-download"></i> Exportar</button>
        <button class="btn btn-primary btn-sm" onclick="abrirNovaProposta()"><i class="fas fa-plus"></i> Nova Proposta</button>
      </div>
    </div>

    <!-- KPIs -->
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:20px">
      ${_propKpi('Total','file-contract',total,'#6366f1')}
      ${_propKpi('Em Elaboração','pencil-ruler',emElab,'#f59e0b')}
      ${_propKpi('Enviadas','paper-plane',enviadas,'#3b82f6')}
      ${_propKpi('Ganhas','trophy',ganhas,'#22c55e')}
      ${_propKpi('Valor Pipeline',null,null,'#0891b2',_propFmt(valorTotal))}
    </div>

    <!-- Tabela de Propostas -->
    <div class="card" style="overflow:hidden">
      <div style="padding:16px 20px;border-bottom:1px solid var(--border-color);display:flex;align-items:center;justify-content:space-between">
        <div style="display:flex;align-items:center;gap:12px">
          <i class="fas fa-list" style="color:var(--fa-teal)"></i>
          <span style="font-size:14px;font-weight:600;color:var(--text-primary)">${total} proposta${total!==1?'s':''}</span>
        </div>
        <div style="display:flex;gap:8px">
          <input type="text" id="propFiltroTexto" placeholder="Buscar proposta..." oninput="_propFiltrar()"
            style="padding:7px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;width:200px">
          <select id="propFiltroStatus" onchange="_propFiltrar()"
            style="padding:7px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px">
            <option value="">Todos os Status</option>
            ${['Em Elaboração','Aguardando Revisão','Em Revisão','Aprovada Internamente','Enviada ao Cliente','Em Negociação','Ganha','Perdida'].map(s=>`<option>${s}</option>`).join('')}
          </select>
        </div>
      </div>
      <div id="propTabelaContainer">
        ${_propRenderTabela(lista)}
      </div>
    </div>
  `;
}

function _propKpi(label, icon, val, color, customVal) {
  const display = customVal || String(val);
  return `
    <div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:12px;padding:16px;display:flex;align-items:center;gap:12px">
      ${icon ? `<div style="width:42px;height:42px;border-radius:10px;background:${color}22;display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <i class="fas fa-${icon}" style="color:${color};font-size:18px"></i>
      </div>` : `<div style="width:42px;height:42px;border-radius:10px;background:${color}22;display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <i class="fas fa-dollar-sign" style="color:${color};font-size:18px"></i>
      </div>`}
      <div>
        <div style="font-size:20px;font-weight:700;color:var(--text-primary);line-height:1">${display}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${label}</div>
      </div>
    </div>`;
}

function _propRenderTabela(lista) {
  if (!lista.length) return `
    <div style="padding:60px;text-align:center">
      <div style="width:72px;height:72px;border-radius:50%;background:rgba(0,180,184,0.1);display:flex;align-items:center;justify-content:center;margin:0 auto 16px">
        <i class="fas fa-file-contract" style="font-size:28px;color:var(--fa-teal)"></i>
      </div>
      <p style="font-size:15px;font-weight:600;color:var(--text-primary);margin-bottom:6px">Nenhuma proposta cadastrada</p>
      <p style="font-size:13px;color:var(--text-muted);margin-bottom:20px">Clique em <strong>Nova Proposta</strong> ou gere a partir de um lead no CRM</p>
      <button class="btn btn-primary" onclick="abrirNovaProposta()"><i class="fas fa-plus"></i> Nova Proposta</button>
    </div>`;

  return `
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="background:var(--bg-tertiary);border-bottom:2px solid var(--border-color)">
            <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px">Número</th>
            <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px">Cliente / Objeto</th>
            <th style="padding:10px 14px;text-align:center;font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px">Status</th>
            <th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px">Valor Total</th>
            <th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px">Margem</th>
            <th style="padding:10px 14px;text-align:center;font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px">Versão</th>
            <th style="padding:10px 14px;text-align:center;font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px">Validade</th>
            <th style="padding:10px 14px;text-align:center;font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px">Ações</th>
          </tr>
        </thead>
        <tbody>
          ${lista.map(p => _propLinha(p)).join('')}
        </tbody>
      </table>
    </div>`;
}

function _propLinha(p) {
  const custoTotal = (p.wbs_itens||[]).reduce((a,i) => a+(i.custo_total||0), 0);
  const margem = p.valor_total > 0 ? ((p.valor_total - custoTotal) / p.valor_total * 100) : 0;
  const margemColor = margem >= 20 ? '#22c55e' : margem >= 10 ? '#f59e0b' : '#ef4444';
  return `
    <tr style="border-bottom:1px solid var(--border-color);transition:background .15s" onmouseover="this.style.background='var(--bg-tertiary)'" onmouseout="this.style.background=''">
      <td style="padding:12px 14px">
        <span style="font-weight:700;color:var(--fa-teal);font-size:13px">${p.numero}</span>
        <div style="font-size:10px;color:var(--text-muted);margin-top:2px">${p.data_criacao||'—'}</div>
      </td>
      <td style="padding:12px 14px;max-width:240px">
        <div style="font-weight:600;color:var(--text-primary);font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.cliente||'—'}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.objeto||'—'}</div>
      </td>
      <td style="padding:12px 14px;text-align:center">${_propStatusBadge(p.status)}</td>
      <td style="padding:12px 14px;text-align:right;font-weight:700;color:var(--text-primary)">${_propFmt(p.valor_total||0)}</td>
      <td style="padding:12px 14px;text-align:right;font-weight:700;color:${margemColor}">${_propFmtPct(margem)}</td>
      <td style="padding:12px 14px;text-align:center">
        <span style="background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:20px;padding:2px 8px;font-size:11px;font-weight:600;color:var(--text-secondary)">v${p.versao||1}</span>
      </td>
      <td style="padding:12px 14px;text-align:center;font-size:12px;color:var(--text-secondary)">${p.validade||'—'}</td>
      <td style="padding:12px 14px;text-align:center">
        <div style="display:flex;gap:4px;justify-content:center">
          <button onclick="abrirEditorProposta('${p.id}')" title="Editar WBS / Precificação"
            style="width:32px;height:32px;border:none;border-radius:7px;background:#3b82f622;color:#3b82f6;cursor:pointer;font-size:13px" title="Editar">
            <i class="fas fa-edit"></i></button>
          <button onclick="verResumoProposta('${p.id}')" title="Resumo"
            style="width:32px;height:32px;border:none;border-radius:7px;background:#6366f122;color:#6366f1;cursor:pointer;font-size:13px">
            <i class="fas fa-eye"></i></button>
          <button onclick="gerarPDFProposta('${p.id}')" title="PDF"
            style="width:32px;height:32px;border:none;border-radius:7px;background:#ef444422;color:#ef4444;cursor:pointer;font-size:13px">
            <i class="fas fa-file-pdf"></i></button>
          <button onclick="gerarWordProposta('${p.id}')" title="Word"
            style="width:32px;height:32px;border:none;border-radius:7px;background:#2563eb22;color:#2563eb;cursor:pointer;font-size:13px">
            <i class="fas fa-file-word"></i></button>
          <button onclick="_propDuplicar('${p.id}')" title="Duplicar"
            style="width:32px;height:32px;border:none;border-radius:7px;background:#f59e0b22;color:#f59e0b;cursor:pointer;font-size:13px">
            <i class="fas fa-copy"></i></button>
          <button onclick="_propEnviar('${p.id}')" title="Enviar ao Cliente"
            style="width:32px;height:32px;border:none;border-radius:7px;background:#22c55e22;color:#22c55e;cursor:pointer;font-size:13px">
            <i class="fas fa-paper-plane"></i></button>
        </div>
      </td>
    </tr>`;
}

function _propFiltrar() {
  const txt = (document.getElementById('propFiltroTexto')?.value||'').toLowerCase();
  const st = document.getElementById('propFiltroStatus')?.value||'';
  let lista = _getPropData();
  if (txt) lista = lista.filter(p => (p.numero+p.cliente+p.objeto).toLowerCase().includes(txt));
  if (st) lista = lista.filter(p => p.status === st);
  document.getElementById('propTabelaContainer').innerHTML = _propRenderTabela(lista);
}

// ─── NOVA PROPOSTA (modal de criação) ─────────────────────────────────
function abrirNovaProposta(leadId) {
  let leadDados = null;
  if (leadId && typeof CRM_DATA !== 'undefined') {
    leadDados = CRM_DATA.leads.find(l => l.id === leadId);
  }
  const numero = _propGerarNumero();
  const hoje = new Date().toISOString().split('T')[0];
  const validade = new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0];

  openModalWide('Nova Proposta Comercial', `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Número da Proposta</label>
        <input id="np_numero" value="${numero}" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
      </div>
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Status Inicial</label>
        <select id="np_status" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
          <option>Em Elaboração</option><option>Aguardando Revisão</option>
        </select>
      </div>
      <div style="grid-column:1/-1">
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Cliente / Empresa *</label>
        <input id="np_cliente" value="${leadDados?.empresa||''}" placeholder="Nome do cliente ou empresa" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
      </div>
      <div style="grid-column:1/-1">
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Objeto / Escopo *</label>
        <input id="np_objeto" value="${leadDados?.descricao||''}" placeholder="Ex: Serviços de manutenção industrial – Contrato de 24 meses" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
      </div>
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Responsável Comercial</label>
        <input id="np_responsavel" value="${currentUser?.name||''}" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
      </div>
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Moeda</label>
        <select id="np_moeda" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
          <option value="BRL">BRL – Real Brasileiro</option>
          <option value="USD">USD – Dólar Americano</option>
          <option value="EUR">EUR – Euro</option>
        </select>
      </div>
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Prazo Contratual (meses)</label>
        <input id="np_prazo" type="number" value="24" min="1" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
      </div>
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Validade da Proposta</label>
        <input id="np_validade" type="date" value="${validade}" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
      </div>
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">% Margem Alvo</label>
        <input id="np_margem_alvo" type="number" value="20" min="0" max="100" step="0.5" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
      </div>
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Lead CRM Vinculado</label>
        <input id="np_lead" value="${leadDados?.id||''}" placeholder="ID do lead (opcional)" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
      </div>
      <div style="grid-column:1/-1">
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Observações Iniciais</label>
        <textarea id="np_obs" rows="2" placeholder="Contexto, premissas, requisitos especiais..." style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box;resize:vertical">${leadDados?.obs||''}</textarea>
      </div>
    </div>
    <div style="margin-top:14px;padding:12px 14px;background:rgba(0,180,184,0.05);border:1px solid rgba(0,180,184,0.2);border-radius:8px;font-size:12px;color:var(--text-secondary)">
      <i class="fas fa-info-circle" style="color:var(--fa-teal);margin-right:6px"></i>
      Após criar, você será direcionado ao <strong>Editor WBS/Precificação</strong> para detalhar os custos e definir o preço de venda.
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="_propSalvarNova('${leadId||''}')"><i class="fas fa-arrow-right"></i> Criar e Abrir Editor WBS</button>
  `);
}

function _propSalvarNova(leadId) {
  const cliente = document.getElementById('np_cliente')?.value?.trim();
  const objeto = document.getElementById('np_objeto')?.value?.trim();
  if (!cliente) { showToast('Informe o cliente.', 'error'); return; }
  if (!objeto)  { showToast('Informe o objeto/escopo.', 'error'); return; }

  const hoje = new Date().toLocaleDateString('pt-BR');
  const validadeRaw = document.getElementById('np_validade')?.value;
  const validadeFmt = validadeRaw ? new Date(validadeRaw+'T12:00:00').toLocaleDateString('pt-BR') : '';

  const prop = {
    id: typeof gerarId === 'function' ? gerarId('PROP') : ('PROP-'+ Date.now()),
    numero: document.getElementById('np_numero')?.value || _propGerarNumero(),
    cliente,
    objeto,
    status: document.getElementById('np_status')?.value || 'Em Elaboração',
    responsavel: document.getElementById('np_responsavel')?.value || (currentUser?.name||''),
    moeda: document.getElementById('np_moeda')?.value || 'BRL',
    prazo: parseInt(document.getElementById('np_prazo')?.value||24),
    margem_alvo: parseFloat(document.getElementById('np_margem_alvo')?.value||20),
    validade: validadeFmt,
    lead_id: leadId || document.getElementById('np_lead')?.value || '',
    observacoes: document.getElementById('np_obs')?.value||'',
    data_criacao: hoje,
    versao: 1,
    versoes_anteriores: [],
    wbs_itens: [],           // Itens do WBS (custo)
    valor_total: 0,          // Definido no editor
    markup_global: 0,        // % markup aplicado
    impostos: 0,             // % impostos sobre o preço
    historico: [{ acao:'Proposta criada', usuario: currentUser?.name||'Sistema', data: new Date().toLocaleString('pt-BR') }]
  };

  const lista = _getPropData();
  lista.unshift(prop);
  _savePropData(lista);

  if (typeof logAction === 'function') logAction('Criar','PropostaComercial',`Proposta ${prop.numero} criada para ${prop.cliente}`);
  closeModal();
  showToast(`Proposta ${prop.numero} criada! Abrindo editor WBS...`, 'success');

  // Atualiza lead no CRM se vinculado
  if (leadId && typeof CRM_DATA !== 'undefined') {
    const lead = CRM_DATA.leads.find(l => l.id === leadId);
    if (lead && !['Fechado Ganho','Negociação'].includes(lead.etapa)) {
      lead.etapa = 'Proposta Enviada';
      if (typeof _saveCRMData === 'function') _saveCRMData(CRM_DATA);
    }
  }

  setTimeout(() => abrirEditorProposta(prop.id), 300);
}

// ─── EDITOR WBS / PRECIFICAÇÃO ────────────────────────────────────────
function abrirEditorProposta(propId) {
  const lista = _getPropData();
  const prop = lista.find(p => p.id === propId);
  if (!prop) { showToast('Proposta não encontrada.', 'error'); return; }

  // Renderiza tela completa no mainContent
  const main = document.getElementById('mainContent');
  main.innerHTML = _propEditorHTML(prop);
  _propEditorCalcular(propId);
}

function _propEditorHTML(prop) {
  const itens = prop.wbs_itens || [];
  const grupos = [...new Set(itens.map(i => i.grupo_l1||'Sem Grupo'))];

  return `
    <!-- HEADER DO EDITOR -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px">
      <div style="display:flex;align-items:center;gap:12px">
        <button onclick="renderPropostaComercial()" style="width:36px;height:36px;border:1px solid var(--border-color);border-radius:8px;background:var(--bg-secondary);color:var(--text-secondary);cursor:pointer;font-size:14px"><i class="fas fa-arrow-left"></i></button>
        <div>
          <h2 style="margin:0;font-size:18px;font-weight:700;color:var(--text-primary)">
            <i class="fas fa-sitemap" style="color:var(--fa-teal);margin-right:8px"></i>
            Editor WBS – ${prop.numero}
          </h2>
          <p style="margin:0;font-size:12px;color:var(--text-muted)">${prop.cliente} · ${prop.objeto}</p>
        </div>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        ${_propStatusBadge(prop.status)}
        <button onclick="_propSalvarStatus('${prop.id}')" style="padding:8px 14px;background:#f59e0b22;color:#f59e0b;border:1px solid #f59e0b44;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600">
          <i class="fas fa-sync-alt"></i> Alterar Status
        </button>
        <button onclick="_propSalvarEditor('${prop.id}')" style="padding:8px 16px;background:var(--fa-teal);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600">
          <i class="fas fa-save"></i> Salvar
        </button>
        <button onclick="verResumoProposta('${prop.id}')" style="padding:8px 14px;background:#6366f122;color:#6366f1;border:1px solid #6366f144;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600">
          <i class="fas fa-chart-pie"></i> Resumo
        </button>
      </div>
    </div>

    <!-- PAINEL SUPERIOR: INFO + PRECIFICAÇÃO -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px">
      <!-- Dados da Proposta -->
      <div class="card" style="padding:16px">
        <div style="font-size:13px;font-weight:700;color:var(--text-primary);margin-bottom:12px;display:flex;align-items:center;gap:8px">
          <i class="fas fa-info-circle" style="color:var(--fa-teal)"></i> Dados da Proposta
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div>
            <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:3px">Cliente</label>
            <input id="ped_cliente" value="${prop.cliente||''}" oninput="_propEditorAutoSave('${prop.id}')"
              style="width:100%;padding:7px 10px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:7px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
          </div>
          <div>
            <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:3px">Responsável</label>
            <input id="ped_responsavel" value="${prop.responsavel||''}" oninput="_propEditorAutoSave('${prop.id}')"
              style="width:100%;padding:7px 10px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:7px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
          </div>
          <div style="grid-column:1/-1">
            <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:3px">Objeto / Escopo</label>
            <input id="ped_objeto" value="${prop.objeto||''}" oninput="_propEditorAutoSave('${prop.id}')"
              style="width:100%;padding:7px 10px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:7px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
          </div>
          <div>
            <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:3px">Prazo (meses)</label>
            <input id="ped_prazo" type="number" value="${prop.prazo||24}" min="1" oninput="_propEditorAutoSave('${prop.id}')"
              style="width:100%;padding:7px 10px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:7px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
          </div>
          <div>
            <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:3px">Validade</label>
            <input id="ped_validade" type="date" value="${prop.validade ? (() => { try { const d=prop.validade.split('/'); return d[2]+'-'+d[1].padStart(2,'0')+'-'+d[0].padStart(2,'0'); } catch(e){return '';} })() : ''}" oninput="_propEditorAutoSave('${prop.id}')"
              style="width:100%;padding:7px 10px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:7px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
          </div>
          <div style="grid-column:1/-1">
            <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:3px">Observações</label>
            <textarea id="ped_obs" rows="2" oninput="_propEditorAutoSave('${prop.id}')"
              style="width:100%;padding:7px 10px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:7px;color:var(--text-primary);font-size:13px;box-sizing:border-box;resize:vertical">${prop.observacoes||''}</textarea>
          </div>
        </div>
      </div>

      <!-- Precificação e Resumo Financeiro -->
      <div class="card" style="padding:16px">
        <div style="font-size:13px;font-weight:700;color:var(--text-primary);margin-bottom:12px;display:flex;align-items:center;gap:8px">
          <i class="fas fa-calculator" style="color:#22c55e"></i> Precificação
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
          <div>
            <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:3px">Markup sobre Custo (%)</label>
            <input id="ped_markup" type="number" value="${prop.markup_global||0}" min="0" max="200" step="0.5"
              oninput="_propEditorCalcular('${prop.id}')"
              style="width:100%;padding:7px 10px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:7px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
          </div>
          <div>
            <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:3px">Impostos / BDI (%)</label>
            <input id="ped_impostos" type="number" value="${prop.impostos||0}" min="0" max="100" step="0.5"
              oninput="_propEditorCalcular('${prop.id}')"
              style="width:100%;padding:7px 10px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:7px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
          </div>
          <div>
            <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:3px">Margem Alvo (%)</label>
            <input id="ped_margem_alvo" type="number" value="${prop.margem_alvo||20}" min="0" max="100" step="0.5"
              oninput="_propEditorCalcular('${prop.id}')"
              style="width:100%;padding:7px 10px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:7px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
          </div>
          <div>
            <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:3px">Preço de Venda (Override)</label>
            <input id="ped_preco_override" type="number" value="${prop.preco_override||''}" min="0" step="100"
              placeholder="(calculado automaticamente)"
              oninput="_propEditorCalcular('${prop.id}')"
              style="width:100%;padding:7px 10px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:7px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
          </div>
        </div>
        <!-- Painel de resultado financeiro (atualizado por JS) -->
        <div id="ped_resumo_financeiro" style="background:var(--bg-tertiary);border-radius:8px;padding:12px"></div>
      </div>
    </div>

    <!-- BARRA DE AÇÕES DO WBS -->
    <div class="card" style="margin-bottom:0;border-radius:12px 12px 0 0;border-bottom:none;padding:14px 16px;display:flex;align-items:center;justify-content:space-between;gap:10px">
      <div style="display:flex;align-items:center;gap:8px">
        <i class="fas fa-sitemap" style="color:var(--fa-teal)"></i>
        <span style="font-size:14px;font-weight:700;color:var(--text-primary)">WBS – Estrutura Analítica de Custos</span>
        <span id="ped_wbs_count" style="background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:20px;padding:2px 8px;font-size:11px;color:var(--text-muted)">${itens.length} itens</span>
      </div>
      <div style="display:flex;gap:6px">
        <button onclick="_propWBSAdicionarGrupo('${prop.id}')"
          style="padding:7px 13px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:7px;color:var(--text-secondary);cursor:pointer;font-size:12px;font-weight:600">
          <i class="fas fa-folder-plus"></i> Novo Grupo
        </button>
        <button onclick="_propWBSAdicionarItem('${prop.id}','')"
          style="padding:7px 13px;background:var(--fa-teal);color:#fff;border:none;border-radius:7px;cursor:pointer;font-size:12px;font-weight:600">
          <i class="fas fa-plus"></i> Adicionar Item
        </button>
        <button onclick="_propWBSImportarTemplate('${prop.id}')"
          style="padding:7px 13px;background:#6366f122;color:#6366f1;border:1px solid #6366f144;border-radius:7px;cursor:pointer;font-size:12px;font-weight:600">
          <i class="fas fa-cloud-download-alt"></i> Importar Template
        </button>
      </div>
    </div>

    <!-- TABELA WBS EDITÁVEL -->
    <div class="card" style="border-radius:0 0 12px 12px;overflow:hidden;margin-bottom:16px" id="ped_wbs_container">
      ${_propWBSTabela(prop)}
    </div>

    <!-- HISTÓRICO DE VERSÕES -->
    <div class="card" style="padding:16px">
      <div style="font-size:13px;font-weight:700;color:var(--text-primary);margin-bottom:10px;display:flex;align-items:center;gap:8px">
        <i class="fas fa-history" style="color:#8b5cf6"></i> Histórico
        <button onclick="_propNovaVersao('${prop.id}')"
          style="margin-left:auto;padding:5px 12px;background:#8b5cf622;color:#8b5cf6;border:1px solid #8b5cf644;border-radius:7px;cursor:pointer;font-size:11px;font-weight:600">
          <i class="fas fa-code-branch"></i> Criar Nova Versão
        </button>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${(prop.historico||[]).slice().reverse().map(h => `
          <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--bg-tertiary);border-radius:7px;font-size:12px">
            <i class="fas fa-circle" style="font-size:7px;color:var(--fa-teal)"></i>
            <span style="flex:1;color:var(--text-primary)">${h.acao}</span>
            <span style="color:var(--text-muted)">${h.usuario}</span>
            <span style="color:var(--text-muted);font-size:11px">${h.data}</span>
          </div>`).join('')}
      </div>
    </div>
  `;
}

// ─── WBS TABLE ────────────────────────────────────────────────────────
function _propWBSTabela(prop) {
  const itens = prop.wbs_itens || [];
  if (!itens.length) return `
    <div style="padding:48px;text-align:center">
      <i class="fas fa-sitemap" style="font-size:36px;color:var(--fa-teal);opacity:.4"></i>
      <p style="margin-top:12px;font-size:14px;color:var(--text-muted)">Nenhum item WBS cadastrado</p>
      <p style="font-size:12px;color:var(--text-muted)">Adicione itens manualmente ou importe um template</p>
      <div style="margin-top:16px;display:flex;gap:8px;justify-content:center">
        <button onclick="_propWBSAdicionarItem('${prop.id}','')" class="btn btn-primary btn-sm"><i class="fas fa-plus"></i> Adicionar Item</button>
        <button onclick="_propWBSImportarTemplate('${prop.id}')" style="padding:7px 14px;background:#6366f122;color:#6366f1;border:1px solid #6366f144;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600"><i class="fas fa-cloud-download-alt"></i> Importar Template</button>
      </div>
    </div>`;

  // Agrupa por grupo_l1
  const gruposMap = {};
  itens.forEach(it => {
    const g = it.grupo_l1 || 'Sem Grupo';
    if (!gruposMap[g]) gruposMap[g] = [];
    gruposMap[g].push(it);
  });

  let html = `
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead>
          <tr style="background:var(--bg-tertiary);border-bottom:2px solid var(--border-color)">
            <th style="padding:9px 10px;text-align:left;font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;min-width:180px">Descrição</th>
            <th style="padding:9px 10px;text-align:left;font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;min-width:140px">Natureza</th>
            <th style="padding:9px 10px;text-align:left;font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;min-width:100px">Tipo</th>
            <th style="padding:9px 10px;text-align:center;font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;min-width:70px">Qtd/Meses</th>
            <th style="padding:9px 10px;text-align:right;font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;min-width:110px">Custo Unit.</th>
            <th style="padding:9px 10px;text-align:right;font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;min-width:120px">Custo Total</th>
            <th style="padding:9px 10px;text-align:right;font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;min-width:120px">Preço Venda</th>
            <th style="padding:9px 10px;text-align:left;font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;min-width:80px">Fornecedor</th>
            <th style="padding:9px 10px;text-align:center;font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;min-width:60px">Ações</th>
          </tr>
        </thead>
        <tbody>`;

  Object.keys(gruposMap).forEach(grupo => {
    const gItens = gruposMap[grupo];
    const gTotal = gItens.reduce((a,i) => a+(i.custo_total||0), 0);
    const gPreco = gItens.reduce((a,i) => a+(i.preco_venda||0), 0);
    html += `
          <tr style="background:rgba(0,180,184,0.06);border-bottom:1px solid var(--border-color)">
            <td colspan="9" style="padding:8px 10px">
              <div style="display:flex;align-items:center;gap:8px;justify-content:space-between">
                <div style="display:flex;align-items:center;gap:8px">
                  <i class="fas fa-folder-open" style="color:var(--fa-teal)"></i>
                  <span style="font-size:12px;font-weight:700;color:var(--text-primary)">${grupo}</span>
                  <span style="font-size:10px;color:var(--text-muted)">${gItens.length} itens</span>
                </div>
                <div style="display:flex;gap:16px;font-size:11px">
                  <span style="color:var(--text-muted)">Custo: <strong style="color:var(--text-primary)">${_propFmt(gTotal)}</strong></span>
                  <span style="color:var(--text-muted)">Preço: <strong style="color:#22c55e">${_propFmt(gPreco)}</strong></span>
                  <button onclick="_propWBSAdicionarItem('${prop.id}','${grupo.replace(/'/g,"\\'")}')"
                    style="padding:3px 8px;background:var(--fa-teal);color:#fff;border:none;border-radius:5px;cursor:pointer;font-size:10px">
                    <i class="fas fa-plus"></i> Item
                  </button>
                </div>
              </div>
            </td>
          </tr>`;
    gItens.forEach(it => {
      html += _propWBSLinha(prop.id, it);
    });
  });

  // Linha de totais
  const totalCusto = itens.reduce((a,i) => a+(i.custo_total||0), 0);
  const totalPreco = itens.reduce((a,i) => a+(i.preco_venda||0), 0);
  html += `
          <tr style="background:var(--bg-tertiary);border-top:2px solid var(--border-color);font-weight:700">
            <td colspan="5" style="padding:10px 10px;font-size:12px;color:var(--text-primary)">TOTAL GERAL (${itens.length} itens)</td>
            <td style="padding:10px 10px;text-align:right;color:var(--text-primary)">${_propFmt(totalCusto)}</td>
            <td style="padding:10px 10px;text-align:right;color:#22c55e">${_propFmt(totalPreco)}</td>
            <td colspan="2"></td>
          </tr>
        </tbody>
      </table>
    </div>`;
  return html;
}

function _propWBSLinha(propId, it) {
  const id = it.id;
  return `
    <tr id="wbs-row-${id}" style="border-bottom:1px solid var(--border-color);transition:background .15s"
      onmouseover="this.style.background='var(--bg-tertiary)'" onmouseout="this.style.background=''">
      <td style="padding:7px 10px">
        <input value="${(it.descricao||'').replace(/"/g,'&quot;')}" placeholder="Descrição do item"
          onchange="_propWBSUpdateItem('${propId}','${id}','descricao',this.value)"
          style="width:100%;padding:5px 8px;background:transparent;border:1px solid transparent;border-radius:5px;color:var(--text-primary);font-size:12px;box-sizing:border-box"
          onfocus="this.style.background='var(--bg-secondary)';this.style.borderColor='var(--fa-teal)'"
          onblur="this.style.background='transparent';this.style.borderColor='transparent'">
      </td>
      <td style="padding:7px 10px">
        <select onchange="_propWBSUpdateItem('${propId}','${id}','natureza',this.value)"
          style="width:100%;padding:5px 7px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:5px;color:var(--text-primary);font-size:11px">
          ${_PROP_WBS_NATUREZAS.map(n => `<option ${n===it.natureza?'selected':''}>${n}</option>`).join('')}
        </select>
      </td>
      <td style="padding:7px 10px">
        <select onchange="_propWBSUpdateItem('${propId}','${id}','tipo_custo',this.value)"
          style="width:100%;padding:5px 7px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:5px;color:var(--text-primary);font-size:11px">
          ${_PROP_WBS_TIPO_CUSTO.map(t => `<option ${t===it.tipo_custo?'selected':''}>${t}</option>`).join('')}
        </select>
      </td>
      <td style="padding:7px 10px;text-align:center">
        <input type="number" value="${it.qtd_meses||1}" min="1"
          onchange="_propWBSUpdateItem('${propId}','${id}','qtd_meses',parseFloat(this.value)||1)"
          style="width:60px;padding:5px 6px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:5px;color:var(--text-primary);font-size:12px;text-align:center">
      </td>
      <td style="padding:7px 10px;text-align:right">
        <input type="number" value="${it.custo_unit||0}" min="0" step="100"
          onchange="_propWBSUpdateItem('${propId}','${id}','custo_unit',parseFloat(this.value)||0)"
          style="width:100px;padding:5px 8px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:5px;color:var(--text-primary);font-size:12px;text-align:right">
      </td>
      <td style="padding:7px 10px;text-align:right;font-weight:600;color:var(--text-primary)" id="wbs-ct-${id}">${_propFmt(it.custo_total||0)}</td>
      <td style="padding:7px 10px;text-align:right;font-weight:600;color:#22c55e" id="wbs-pv-${id}">${_propFmt(it.preco_venda||0)}</td>
      <td style="padding:7px 10px">
        <input value="${(it.fornecedor||'').replace(/"/g,'&quot;')}" placeholder="Fornecedor"
          onchange="_propWBSUpdateItem('${propId}','${id}','fornecedor',this.value)"
          style="width:100%;padding:5px 8px;background:transparent;border:1px solid transparent;border-radius:5px;color:var(--text-secondary);font-size:11px;box-sizing:border-box"
          onfocus="this.style.background='var(--bg-secondary)';this.style.borderColor='var(--fa-teal)'"
          onblur="this.style.background='transparent';this.style.borderColor='transparent'">
      </td>
      <td style="padding:7px 10px;text-align:center">
        <button onclick="_propWBSRemoverItem('${propId}','${id}')" title="Remover"
          style="width:28px;height:28px;border:none;border-radius:5px;background:#ef444422;color:#ef4444;cursor:pointer;font-size:11px">
          <i class="fas fa-trash"></i></button>
      </td>
    </tr>`;
}

// ─── WBS CRUD ─────────────────────────────────────────────────────────
function _propWBSUpdateItem(propId, itemId, campo, valor) {
  const lista = _getPropData();
  const prop = lista.find(p => p.id === propId);
  if (!prop) return;
  const item = prop.wbs_itens.find(i => i.id === itemId);
  if (!item) return;
  item[campo] = valor;
  // Recalcular custo total
  item.custo_total = (item.qtd_meses||1) * (item.custo_unit||0);
  // Recalcular preço de venda com markup global
  const markup = parseFloat(document.getElementById('ped_markup')?.value||prop.markup_global||0);
  const impostos = parseFloat(document.getElementById('ped_impostos')?.value||prop.impostos||0);
  item.preco_venda = item.custo_total * (1 + markup/100) * (1 + impostos/100);
  _savePropData(lista);
  // Atualiza células inline
  const ctEl = document.getElementById(`wbs-ct-${itemId}`);
  const pvEl = document.getElementById(`wbs-pv-${itemId}`);
  if (ctEl) ctEl.textContent = _propFmt(item.custo_total);
  if (pvEl) pvEl.textContent = _propFmt(item.preco_venda);
  _propEditorCalcular(propId);
}

function _propWBSAdicionarItem(propId, grupo) {
  const lista = _getPropData();
  const prop = lista.find(p => p.id === propId);
  if (!prop) return;
  const novoItem = {
    id: 'wbs_' + Date.now() + '_' + Math.floor(Math.random()*1000),
    grupo_l1: grupo || 'Geral',
    descricao: '',
    natureza: 'Subcontracted Services',
    tipo_custo: 'One-off',
    expenditure: 'OPEX',
    qtd_meses: 1,
    custo_unit: 0,
    custo_total: 0,
    preco_venda: 0,
    fornecedor: '',
    obs: ''
  };
  if (!prop.wbs_itens) prop.wbs_itens = [];
  prop.wbs_itens.push(novoItem);
  _savePropData(lista);
  _propRefreshWBSContainer(prop);
  _propEditorCalcular(propId);
}

function _propWBSAdicionarGrupo(propId) {
  openModal('Novo Grupo WBS', `
    <div>
      <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:6px">Nome do Grupo / Fase</label>
      <input id="_wbsGrupoNome" placeholder="Ex: Mobilização, Operação, Encerramento..."
        style="width:100%;padding:9px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="_propWBSCriarGrupo('${propId}')">Criar Grupo</button>
  `);
}

function _propWBSCriarGrupo(propId) {
  const nome = document.getElementById('_wbsGrupoNome')?.value?.trim();
  if (!nome) { showToast('Informe o nome do grupo.', 'error'); return; }
  closeModal();
  _propWBSAdicionarItem(propId, nome);
}

function _propWBSRemoverItem(propId, itemId) {
  const lista = _getPropData();
  const prop = lista.find(p => p.id === propId);
  if (!prop) return;
  prop.wbs_itens = prop.wbs_itens.filter(i => i.id !== itemId);
  _savePropData(lista);
  _propRefreshWBSContainer(prop);
  _propEditorCalcular(propId);
}

function _propRefreshWBSContainer(prop) {
  const cont = document.getElementById('ped_wbs_container');
  if (cont) {
    cont.innerHTML = _propWBSTabela(prop);
    const cnt = document.getElementById('ped_wbs_count');
    if (cnt) cnt.textContent = (prop.wbs_itens||[]).length + ' itens';
  }
}

// ─── IMPORTAR TEMPLATE WBS ────────────────────────────────────────────
function _propWBSImportarTemplate(propId) {
  openModalWide('Importar Template WBS', `
    <p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px">
      Selecione um template para pré-preencher a estrutura de custos. Os itens existentes serão mantidos.
    </p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      ${[
        { id:'mobilizacao', titulo:'Mobilização / Setup', desc:'Equipamentos, transporte, containers, segurança, documentação', icon:'truck', color:'#3b82f6' },
        { id:'manutencao', titulo:'Manutenção Industrial', desc:'Mão de obra, insumos, EPIs, ferramentas, subcontratados', icon:'tools', color:'#f59e0b' },
        { id:'operacao', titulo:'Operação Contínua', desc:'Pessoal, combustível, alimentação, acomodação, utilidades', icon:'cogs', color:'#22c55e' },
        { id:'encerramento', titulo:'Encerramento de Contrato', desc:'Desmobilização, limpeza, documentação final, logística', icon:'flag-checkered', color:'#8b5cf6' },
        { id:'projetos_engenharia', titulo:'Projetos de Engenharia', desc:'Projetos, automação, comissionamento, testes', icon:'drafting-compass', color:'#0891b2' },
        { id:'ssma', titulo:'SSMA / Compliance', desc:'Treinamentos, equipamentos de segurança, auditorias, laudos', icon:'shield-alt', color:'#ef4444' },
      ].map(t => `
        <div onclick="_propAplicarTemplate('${propId}','${t.id}')" style="padding:12px 14px;border:2px solid ${t.color}33;border-radius:10px;cursor:pointer;transition:all .2s"
          onmouseover="this.style.borderColor='${t.color}';this.style.background='${t.color}11'"
          onmouseout="this.style.borderColor='${t.color}33';this.style.background=''">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
            <div style="width:36px;height:36px;border-radius:8px;background:${t.color}22;display:flex;align-items:center;justify-content:center">
              <i class="fas fa-${t.icon}" style="color:${t.color};font-size:15px"></i>
            </div>
            <span style="font-size:13px;font-weight:700;color:var(--text-primary)">${t.titulo}</span>
          </div>
          <p style="font-size:11px;color:var(--text-muted);margin:0">${t.desc}</p>
        </div>`).join('')}
    </div>
  `, `<button class="btn btn-secondary" onclick="closeModal()">Fechar</button>`);
}

const _PROP_TEMPLATES = {
  mobilizacao: [
    { grupo_l1:'Mobilização', descricao:'Retro Escavadeira / Equipamento pesado', natureza:'Subcontracted Services', tipo_custo:'One-off', qtd_meses:1, custo_unit:20000 },
    { grupo_l1:'Mobilização', descricao:'Transporte e logística', natureza:'Subcontracted Services', tipo_custo:'One-off', qtd_meses:1, custo_unit:15000 },
    { grupo_l1:'Mobilização', descricao:'Containers / Instalações', natureza:'Subcontracted Services', tipo_custo:'One-off', qtd_meses:1, custo_unit:35000 },
    { grupo_l1:'Mobilização', descricao:'Segurança 24h', natureza:'Subcontracted Services', tipo_custo:'One-off', qtd_meses:1, custo_unit:20000 },
    { grupo_l1:'Mobilização', descricao:'Geradores', natureza:'Subcontracted Services', tipo_custo:'One-off', qtd_meses:1, custo_unit:15000 },
    { grupo_l1:'Mobilização', descricao:'EPI\'s e Uniformes iniciais', natureza:'Consumables', tipo_custo:'One-off', qtd_meses:1, custo_unit:50000 },
  ],
  manutencao: [
    { grupo_l1:'Manutenção', descricao:'Mão de obra técnica', natureza:'Labour', tipo_custo:'Mensal', qtd_meses:12, custo_unit:80000 },
    { grupo_l1:'Manutenção', descricao:'Insumos e consumíveis', natureza:'Consumables', tipo_custo:'Mensal', qtd_meses:12, custo_unit:15000 },
    { grupo_l1:'Manutenção', descricao:'EPIs', natureza:'Consumables', tipo_custo:'Mensal', qtd_meses:12, custo_unit:8000 },
    { grupo_l1:'Manutenção', descricao:'Ferramentas e equipamentos', natureza:'Equipment', tipo_custo:'One-off', qtd_meses:1, custo_unit:25000 },
    { grupo_l1:'Manutenção', descricao:'Subcontratados especializados', natureza:'Subcontracted Services', tipo_custo:'Mensal', qtd_meses:12, custo_unit:20000 },
  ],
  operacao: [
    { grupo_l1:'Operação', descricao:'Pessoal operacional', natureza:'Labour', tipo_custo:'Mensal', qtd_meses:24, custo_unit:120000 },
    { grupo_l1:'Operação', descricao:'Combustível – frota', natureza:'Fuel – Mobile Equipment', tipo_custo:'Mensal', qtd_meses:24, custo_unit:18000 },
    { grupo_l1:'Operação', descricao:'Alimentação', natureza:'Catering', tipo_custo:'Mensal', qtd_meses:24, custo_unit:25000 },
    { grupo_l1:'Operação', descricao:'Acomodação e viagens', natureza:'Travel & Accommodation', tipo_custo:'Mensal', qtd_meses:24, custo_unit:12000 },
    { grupo_l1:'Operação', descricao:'Utilities (água, internet, luz)', natureza:'Utilities', tipo_custo:'Mensal', qtd_meses:24, custo_unit:5000 },
  ],
  encerramento: [
    { grupo_l1:'Encerramento', descricao:'Desmobilização de equipamentos', natureza:'Subcontracted Services', tipo_custo:'One-off', qtd_meses:1, custo_unit:25000 },
    { grupo_l1:'Encerramento', descricao:'Limpeza e restauração do local', natureza:'Subcontracted Services', tipo_custo:'One-off', qtd_meses:1, custo_unit:10000 },
    { grupo_l1:'Encerramento', descricao:'Documentação e relatório final', natureza:'Others', tipo_custo:'One-off', qtd_meses:1, custo_unit:5000 },
  ],
  projetos_engenharia: [
    { grupo_l1:'Engenharia', descricao:'Projetos de engenharia', natureza:'Engineering Projects', tipo_custo:'One-off', qtd_meses:1, custo_unit:60000 },
    { grupo_l1:'Engenharia', descricao:'Projetos de automação', natureza:'Engineering Projects', tipo_custo:'One-off', qtd_meses:1, custo_unit:150000 },
    { grupo_l1:'Engenharia', descricao:'Comissionamento e testes', natureza:'Engineering Projects', tipo_custo:'One-off', qtd_meses:1, custo_unit:30000 },
  ],
  ssma: [
    { grupo_l1:'SSMA', descricao:'Treinamentos de segurança', natureza:'Consumables', tipo_custo:'Mensal', qtd_meses:12, custo_unit:8000 },
    { grupo_l1:'SSMA', descricao:'Laudos e auditorias', natureza:'Others', tipo_custo:'Trimestral', qtd_meses:4, custo_unit:5000 },
    { grupo_l1:'SSMA', descricao:'Equipamentos de segurança', natureza:'Equipment', tipo_custo:'One-off', qtd_meses:1, custo_unit:15000 },
  ]
};

function _propAplicarTemplate(propId, templateId) {
  const template = _PROP_TEMPLATES[templateId];
  if (!template) return;
  const lista = _getPropData();
  const prop = lista.find(p => p.id === propId);
  if (!prop) return;
  if (!prop.wbs_itens) prop.wbs_itens = [];
  const markup = prop.markup_global || 0;
  const impostos = prop.impostos || 0;
  template.forEach(it => {
    const custo_total = (it.qtd_meses||1) * (it.custo_unit||0);
    prop.wbs_itens.push({
      ...it,
      id: 'wbs_' + Date.now() + '_' + Math.floor(Math.random()*9999),
      custo_total,
      preco_venda: custo_total * (1+markup/100) * (1+impostos/100),
      fornecedor: '',
      obs: ''
    });
  });
  _savePropData(lista);
  closeModal();
  showToast('Template importado! Edite os valores conforme necessário.', 'success');
  _propRefreshWBSContainer(prop);
  _propEditorCalcular(propId);
}

// ─── CÁLCULO FINANCEIRO ───────────────────────────────────────────────
function _propEditorCalcular(propId) {
  const lista = _getPropData();
  const prop = lista.find(p => p.id === propId);
  if (!prop) return;

  const markup = parseFloat(document.getElementById('ped_markup')?.value || prop.markup_global || 0);
  const impostos = parseFloat(document.getElementById('ped_impostos')?.value || prop.impostos || 0);
  const margemAlvo = parseFloat(document.getElementById('ped_margem_alvo')?.value || prop.margem_alvo || 20);
  const precoOverride = parseFloat(document.getElementById('ped_preco_override')?.value || '') || 0;

  const custoTotal = (prop.wbs_itens||[]).reduce((a,i) => a+(i.custo_total||0), 0);

  // Recalcular preço de venda de todos os itens
  (prop.wbs_itens||[]).forEach(it => {
    it.preco_venda = it.custo_total * (1 + markup/100) * (1 + impostos/100);
  });

  let precoVendaCalculado = custoTotal * (1 + markup/100) * (1 + impostos/100);
  const precoFinal = precoOverride > 0 ? precoOverride : precoVendaCalculado;
  const margem = precoFinal > 0 ? ((precoFinal - custoTotal) / precoFinal * 100) : 0;
  const margemVsAlvo = margem - margemAlvo;

  prop.markup_global = markup;
  prop.impostos = impostos;
  prop.margem_alvo = margemAlvo;
  prop.preco_override = precoOverride > 0 ? precoOverride : 0;
  prop.valor_total = precoFinal;
  _savePropData(lista);

  // Renderizar resumo financeiro
  const el = document.getElementById('ped_resumo_financeiro');
  if (!el) return;
  const margemColor = margem >= margemAlvo ? '#22c55e' : margem >= margemAlvo*0.7 ? '#f59e0b' : '#ef4444';
  el.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px">
      <div style="display:flex;justify-content:space-between;padding:6px 8px;background:var(--bg-secondary);border-radius:6px">
        <span style="color:var(--text-muted)">Custo Total WBS</span>
        <strong style="color:var(--text-primary)">${_propFmt(custoTotal)}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;padding:6px 8px;background:var(--bg-secondary);border-radius:6px">
        <span style="color:var(--text-muted)">Preço com Markup</span>
        <strong style="color:var(--text-primary)">${_propFmt(precoVendaCalculado)}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;padding:6px 8px;background:#22c55e11;border:1px solid #22c55e33;border-radius:6px">
        <span style="color:#22c55e;font-weight:600">Preço Final de Venda</span>
        <strong style="color:#22c55e;font-size:14px">${_propFmt(precoFinal)}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;padding:6px 8px;background:${margemColor}11;border:1px solid ${margemColor}33;border-radius:6px">
        <span style="color:${margemColor};font-weight:600">Margem Real</span>
        <strong style="color:${margemColor};font-size:14px">${_propFmtPct(margem)}</strong>
      </div>
      <div style="grid-column:1/-1;display:flex;justify-content:space-between;padding:6px 8px;background:var(--bg-secondary);border-radius:6px">
        <span style="color:var(--text-muted)">Δ vs. Margem Alvo (${_propFmtPct(margemAlvo)})</span>
        <strong style="color:${margemVsAlvo >= 0 ? '#22c55e' : '#ef4444'}">${margemVsAlvo >= 0?'+':''}${_propFmtPct(margemVsAlvo)}</strong>
      </div>
    </div>
    <div style="margin-top:8px;background:var(--bg-secondary);border-radius:6px;overflow:hidden;height:8px">
      <div style="height:100%;width:${Math.min(100,Math.max(0,margem))}%;background:${margemColor};transition:width .4s"></div>
    </div>
    <div style="text-align:right;font-size:10px;color:var(--text-muted);margin-top:3px">Margem: ${_propFmtPct(margem)} de ${_propFmtPct(100)}</div>
  `;
}

function _propEditorAutoSave(propId) {
  // Debounce
  if (window._propAutoSaveTimer) clearTimeout(window._propAutoSaveTimer);
  window._propAutoSaveTimer = setTimeout(() => _propSalvarEditor(propId, true), 800);
}

function _propSalvarEditor(propId, silencioso) {
  const lista = _getPropData();
  const prop = lista.find(p => p.id === propId);
  if (!prop) return;

  const validadeRaw = document.getElementById('ped_validade')?.value;
  const validadeFmt = validadeRaw ? new Date(validadeRaw+'T12:00:00').toLocaleDateString('pt-BR') : prop.validade;

  prop.cliente = document.getElementById('ped_cliente')?.value || prop.cliente;
  prop.objeto = document.getElementById('ped_objeto')?.value || prop.objeto;
  prop.responsavel = document.getElementById('ped_responsavel')?.value || prop.responsavel;
  prop.prazo = parseInt(document.getElementById('ped_prazo')?.value||prop.prazo);
  prop.validade = validadeFmt;
  prop.observacoes = document.getElementById('ped_obs')?.value || prop.observacoes;
  prop.markup_global = parseFloat(document.getElementById('ped_markup')?.value||prop.markup_global||0);
  prop.impostos = parseFloat(document.getElementById('ped_impostos')?.value||prop.impostos||0);
  prop.margem_alvo = parseFloat(document.getElementById('ped_margem_alvo')?.value||prop.margem_alvo||20);

  _savePropData(lista);
  if (!silencioso) showToast('Proposta salva!', 'success');
}

// ─── ALTERAR STATUS ───────────────────────────────────────────────────
function _propSalvarStatus(propId) {
  const lista = _getPropData();
  const prop = lista.find(p => p.id === propId);
  if (!prop) return;
  openModal('Alterar Status da Proposta', `
    <div>
      <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:6px">Status da Proposta</label>
      <select id="_pst_status" style="width:100%;padding:9px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
        ${['Em Elaboração','Aguardando Revisão','Em Revisão','Aprovada Internamente','Enviada ao Cliente','Em Negociação','Ganha','Perdida','Cancelada'].map(s => `<option ${s===prop.status?'selected':''}>${s}</option>`).join('')}
      </select>
      <div style="margin-top:10px">
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:6px">Observação da mudança (opcional)</label>
        <input id="_pst_obs" placeholder="Motivo ou contexto..."
          style="width:100%;padding:9px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
      </div>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="_propConfirmarStatus('${propId}')">Confirmar</button>
  `);
}

function _propConfirmarStatus(propId) {
  const novoStatus = document.getElementById('_pst_status')?.value;
  const obs = document.getElementById('_pst_obs')?.value||'';
  const lista = _getPropData();
  const prop = lista.find(p => p.id === propId);
  if (!prop || !novoStatus) return;
  const statusAnt = prop.status;
  prop.status = novoStatus;
  prop.historico = prop.historico || [];
  prop.historico.push({
    acao: `Status: ${statusAnt} → ${novoStatus}${obs ? ' – '+obs : ''}`,
    usuario: currentUser?.name || 'Sistema',
    data: new Date().toLocaleString('pt-BR')
  });
  _savePropData(lista);
  if (typeof logAction === 'function') logAction('Editar','PropostaComercial',`Status proposta ${prop.numero}: ${statusAnt} → ${novoStatus}`);
  closeModal();
  showToast(`Status alterado para "${novoStatus}"`, 'success');
  // Re-renderiza o editor se estiver aberto
  const el = document.getElementById('ped_wbs_container');
  if (el) abrirEditorProposta(propId);
  else renderPropostaComercial();
}

// ─── RESUMO / PREVIEW ─────────────────────────────────────────────────
function verResumoProposta(propId) {
  const lista = _getPropData();
  const prop = lista.find(p => p.id === propId);
  if (!prop) return;

  const itens = prop.wbs_itens || [];
  const custoTotal = itens.reduce((a,i) => a+(i.custo_total||0), 0);
  const precoFinal = prop.valor_total || 0;
  const margem = precoFinal > 0 ? ((precoFinal-custoTotal)/precoFinal*100) : 0;

  // Grupos para gráfico de barras ASCII-like
  const grupos = {};
  itens.forEach(i => {
    const g = i.grupo_l1||'Geral';
    grupos[g] = (grupos[g]||0) + (i.custo_total||0);
  });

  openModalWide(`Resumo – ${prop.numero}`, `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
      <div>
        <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Dados da Proposta</div>
        ${[
          ['Número', prop.numero],
          ['Cliente', prop.cliente],
          ['Objeto', prop.objeto],
          ['Status', _propStatusBadge(prop.status)],
          ['Responsável', prop.responsavel||'—'],
          ['Prazo', (prop.prazo||'—') + ' meses'],
          ['Validade', prop.validade||'—'],
          ['Versão', 'v' + (prop.versao||1)],
          ['Criação', prop.data_criacao||'—'],
        ].map(([l,v]) => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid var(--border-color);font-size:12px">
            <span style="color:var(--text-muted)">${l}</span><span style="color:var(--text-primary);font-weight:500;text-align:right">${v}</span>
          </div>`).join('')}
      </div>
      <div>
        <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Resumo Financeiro</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          <div style="padding:10px 12px;background:var(--bg-secondary);border-radius:8px;display:flex;justify-content:space-between">
            <span style="font-size:12px;color:var(--text-muted)">Total Custo WBS</span>
            <strong style="font-size:14px;color:var(--text-primary)">${_propFmt(custoTotal)}</strong>
          </div>
          <div style="padding:10px 12px;background:rgba(0,180,184,0.08);border:1px solid rgba(0,180,184,0.2);border-radius:8px;display:flex;justify-content:space-between">
            <span style="font-size:12px;color:var(--fa-teal);font-weight:600">Preço de Venda</span>
            <strong style="font-size:16px;color:var(--fa-teal)">${_propFmt(precoFinal)}</strong>
          </div>
          <div style="padding:10px 12px;background:${margem >= (prop.margem_alvo||20) ? '#22c55e11' : '#ef444411'};border:1px solid ${margem >= (prop.margem_alvo||20) ? '#22c55e33' : '#ef444433'};border-radius:8px;display:flex;justify-content:space-between">
            <span style="font-size:12px;color:${margem >= (prop.margem_alvo||20) ? '#22c55e' : '#ef4444'};font-weight:600">Margem Real</span>
            <strong style="font-size:16px;color:${margem >= (prop.margem_alvo||20) ? '#22c55e' : '#ef4444'}">${_propFmtPct(margem)}</strong>
          </div>
          <div style="padding:8px 12px;background:var(--bg-secondary);border-radius:8px;font-size:11px;color:var(--text-muted)">
            Markup: ${_propFmtPct(prop.markup_global||0)} · Impostos/BDI: ${_propFmtPct(prop.impostos||0)} · Margem Alvo: ${_propFmtPct(prop.margem_alvo||20)}
          </div>
        </div>

        <!-- Distribuição por Grupo -->
        <div style="margin-top:12px">
          <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Custo por Grupo WBS</div>
          ${Object.entries(grupos).map(([g,v]) => {
            const pct = custoTotal > 0 ? v/custoTotal*100 : 0;
            return `
            <div style="margin-bottom:6px">
              <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px">
                <span style="color:var(--text-secondary);max-width:60%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${g}</span>
                <span style="color:var(--text-primary);font-weight:600">${_propFmt(v)} (${pct.toFixed(1)}%)</span>
              </div>
              <div style="height:5px;background:var(--border-color);border-radius:3px;overflow:hidden">
                <div style="height:100%;width:${pct}%;background:var(--fa-teal);border-radius:3px"></div>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>
    </div>

    <!-- Tabela de itens -->
    <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Itens WBS (${itens.length})</div>
    ${itens.length ? `
    <div style="overflow-x:auto;border:1px solid var(--border-color);border-radius:8px;max-height:280px;overflow-y:auto">
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead style="position:sticky;top:0">
          <tr style="background:var(--bg-tertiary)">
            <th style="padding:8px 10px;text-align:left;font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase">Grupo</th>
            <th style="padding:8px 10px;text-align:left;font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase">Descrição</th>
            <th style="padding:8px 10px;text-align:left;font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase">Natureza</th>
            <th style="padding:8px 10px;text-align:center;font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase">Qtd</th>
            <th style="padding:8px 10px;text-align:right;font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase">Custo</th>
            <th style="padding:8px 10px;text-align:right;font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase">Preço Venda</th>
          </tr>
        </thead>
        <tbody>
          ${itens.map(i => `
            <tr style="border-bottom:1px solid var(--border-color)">
              <td style="padding:6px 10px;color:var(--text-muted);font-size:11px">${i.grupo_l1||'—'}</td>
              <td style="padding:6px 10px;color:var(--text-primary)">${i.descricao||'—'}</td>
              <td style="padding:6px 10px;color:var(--text-muted);font-size:11px">${i.natureza||'—'}</td>
              <td style="padding:6px 10px;text-align:center">${i.qtd_meses||1}</td>
              <td style="padding:6px 10px;text-align:right;font-weight:600">${_propFmt(i.custo_total||0)}</td>
              <td style="padding:6px 10px;text-align:right;font-weight:600;color:#22c55e">${_propFmt(i.preco_venda||0)}</td>
            </tr>`).join('')}
          <tr style="background:var(--bg-tertiary);font-weight:700">
            <td colspan="4" style="padding:8px 10px">TOTAL</td>
            <td style="padding:8px 10px;text-align:right">${_propFmt(custoTotal)}</td>
            <td style="padding:8px 10px;text-align:right;color:#22c55e">${_propFmt(precoFinal)}</td>
          </tr>
        </tbody>
      </table>
    </div>` : `<p style="text-align:center;color:var(--text-muted);font-size:13px;padding:20px">Nenhum item WBS cadastrado ainda.</p>`}
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
    <button class="btn btn-secondary" onclick="closeModal();abrirEditorProposta('${propId}')"><i class="fas fa-edit"></i> Editar</button>
    <button class="btn btn-primary" onclick="closeModal();_propEnviar('${propId}')"><i class="fas fa-paper-plane"></i> Enviar ao Cliente</button>
  `);
}

// ─── ENVIAR AO CLIENTE ────────────────────────────────────────────────
function _propEnviar(propId) {
  const lista = _getPropData();
  const prop = lista.find(p => p.id === propId);
  if (!prop) return;

  openModal('Enviar Proposta ao Cliente', `
    <div style="font-size:13px">
      <p style="color:var(--text-secondary);margin-bottom:14px">
        Confirmar envio da proposta <strong>${prop.numero}</strong> para <strong>${prop.cliente}</strong>?
      </p>
      <div style="background:var(--bg-secondary);border-radius:8px;padding:12px;margin-bottom:14px;font-size:12px">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px">
          <span style="color:var(--text-muted)">Valor Total</span>
          <strong style="color:var(--fa-teal)">${_propFmt(prop.valor_total||0)}</strong>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:6px">
          <span style="color:var(--text-muted)">Validade</span>
          <span>${prop.validade||'—'}</span>
        </div>
        <div style="display:flex;justify-content:space-between">
          <span style="color:var(--text-muted)">Status atual</span>
          ${_propStatusBadge(prop.status)}
        </div>
      </div>
      <div>
        <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">Observação de envio (opcional)</label>
        <input id="_penv_obs" placeholder="Destinatário, forma de envio..."
          style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
      </div>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="_propConfirmarEnvio('${propId}')"><i class="fas fa-paper-plane"></i> Confirmar Envio</button>
  `);
}

function _propConfirmarEnvio(propId) {
  const obs = document.getElementById('_penv_obs')?.value||'';
  const lista = _getPropData();
  const prop = lista.find(p => p.id === propId);
  if (!prop) return;
  prop.status = 'Enviada ao Cliente';
  prop.data_envio = new Date().toLocaleDateString('pt-BR');
  prop.historico = prop.historico || [];
  prop.historico.push({
    acao: `Proposta enviada ao cliente${obs ? ' – '+obs : ''}`,
    usuario: currentUser?.name || 'Sistema',
    data: new Date().toLocaleString('pt-BR')
  });
  _savePropData(lista);
  if (typeof logAction === 'function') logAction('Enviar','PropostaComercial',`Proposta ${prop.numero} enviada ao cliente ${prop.cliente}`);
  closeModal();
  showToast(`Proposta ${prop.numero} marcada como enviada!`, 'success');
  renderPropostaComercial();
}

// ─── DUPLICAR PROPOSTA ────────────────────────────────────────────────
function _propDuplicar(propId) {
  const lista = _getPropData();
  const prop = lista.find(p => p.id === propId);
  if (!prop) return;
  const nova = JSON.parse(JSON.stringify(prop));
  nova.id = typeof gerarId === 'function' ? gerarId('PROP') : ('PROP-'+Date.now());
  nova.numero = _propGerarNumero();
  nova.versao = 1;
  nova.status = 'Em Elaboração';
  nova.data_criacao = new Date().toLocaleDateString('pt-BR');
  nova.data_envio = null;
  nova.historico = [{ acao: `Duplicada da proposta ${prop.numero}`, usuario: currentUser?.name||'Sistema', data: new Date().toLocaleString('pt-BR') }];
  nova.versoes_anteriores = [];
  // Gerar novos IDs para os itens WBS
  (nova.wbs_itens||[]).forEach(it => { it.id = 'wbs_'+Date.now()+'_'+Math.floor(Math.random()*9999); });
  lista.unshift(nova);
  _savePropData(lista);
  showToast(`Proposta duplicada: ${nova.numero}`, 'success');
  renderPropostaComercial();
}

// ─── NOVA VERSÃO ──────────────────────────────────────────────────────
function _propNovaVersao(propId) {
  const lista = _getPropData();
  const prop = lista.find(p => p.id === propId);
  if (!prop) return;
  // Salva versão atual no histórico de versões
  prop.versoes_anteriores = prop.versoes_anteriores || [];
  prop.versoes_anteriores.push({
    versao: prop.versao,
    data: new Date().toLocaleString('pt-BR'),
    valor_total: prop.valor_total,
    wbs_snapshot: JSON.parse(JSON.stringify(prop.wbs_itens||[]))
  });
  prop.versao = (prop.versao||1) + 1;
  prop.historico = prop.historico || [];
  prop.historico.push({
    acao: `Nova versão criada: v${prop.versao}`,
    usuario: currentUser?.name || 'Sistema',
    data: new Date().toLocaleString('pt-BR')
  });
  _savePropData(lista);
  showToast(`Versão v${prop.versao} criada! O WBS anterior foi arquivado.`, 'success');
  abrirEditorProposta(propId);
}

// ─── EXPORTAR ─────────────────────────────────────────────────────────
function _propExportar() {
  const lista = _getPropData();
  const header = ['Número','Cliente','Objeto','Status','Valor Total','Custo WBS','Margem%','Versão','Prazo','Validade','Data Criação','Responsável'].join(';');
  const rows = lista.map(p => {
    const custo = (p.wbs_itens||[]).reduce((a,i)=>a+(i.custo_total||0),0);
    const margem = p.valor_total > 0 ? ((p.valor_total-custo)/p.valor_total*100).toFixed(1) : '0';
    return [p.numero,p.cliente,p.objeto,p.status,p.valor_total||0,custo,margem+'%',
      'v'+(p.versao||1),p.prazo||0,p.validade,p.data_criacao,p.responsavel].join(';');
  });
  const csv = [header,...rows].join('\n');
  const blob = new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `propostas_${new Date().toISOString().split('T')[0]}.csv`;
  a.click(); URL.revokeObjectURL(url);
  showToast('Exportado com sucesso!', 'success');
}

// ─── PDF – PROPOSTA COMERCIAL PROFISSIONAL ────────────────────────────────────
function gerarPDFProposta(propId) {
  // Busca em propostas comerciais primeiro
  let p = null;
  const todas = (() => { try { return JSON.parse(localStorage.getItem('fa_propostas_comerciais')||'[]'); } catch(e){return[];} })();
  p = todas.find(x => x.id === propId);

  // Fallback para propostas do CRM
  if (!p) {
    const crmProps = (() => { try { return JSON.parse(localStorage.getItem('fa_crm_propostas')||'[]'); } catch(e){return[];} })();
    p = crmProps.find(x => x.id === propId);
  }

  if (!p) {
    showToast('Proposta não encontrada.', 'error');
    return;
  }

  const fmt = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0);
  const hoje = new Date().toLocaleDateString('pt-BR');
  const itens = p.itens || p.servicos || p.wbs || [];
  const total = p.valor_total || p.total || itens.reduce((s,it)=>s+(it.total||(it.qtd||1)*(it.valor_unit||it.preco||it.custo||0)),0) || p.valor || 0;
  const margem = p.margem || p.margem_total || 0;
  const prazoValidade = p.prazo_validade || p.validade || '30 dias';
  const prazoEntrega = p.prazo_execucao || p.prazo_entrega || '—';
  const formaPagamento = p.forma_pagamento || p.pagamento || 'A definir';
  const empresa = p.empresa || p.cliente || p.org || '—';
  const contato = p.contato || p.contato_nome || '—';
  const email = p.email || p.contato_email || '—';
  const objeto = p.objeto || p.titulo || p.descricao || p.servico || '—';
  const escopo = p.escopo || p.descricao_escopo || '';
  const observacoes = p.observacoes || p.obs || p.notas || '';
  const responsavel = p.responsavel || p.vendedor || 'Fraser Alexander';
  const local = p.local || p.cidade || '';

  // Calcula WBS por natureza se disponível
  const wbsAgg = {};
  itens.forEach(it => {
    const nat = it.natureza || it.categoria || it.tipo || 'Outros';
    if (!wbsAgg[nat]) wbsAgg[nat] = 0;
    wbsAgg[nat] += (it.total||(it.qtd||1)*(it.valor_unit||it.preco||it.custo||0));
  });

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Proposta Comercial ${p.numero||p.id} – Fraser Alexander</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Inter',Arial,sans-serif;font-size:11px;color:#1a1a2e;background:#fff;line-height:1.5}
    /* CAPA */
    .capa{min-height:100vh;display:flex;flex-direction:column;justify-content:space-between;padding:40px;background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 40%,#134e4a 100%);color:#fff;page-break-after:always}
    .capa-logo{font-size:28px;font-weight:900;letter-spacing:-1px}
    .capa-logo span{color:#34d399}
    .capa-badge{display:inline-block;background:rgba(52,211,153,0.2);color:#34d399;border:1px solid rgba(52,211,153,0.4);padding:4px 14px;border-radius:20px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:32px}
    .capa-titulo{font-size:36px;font-weight:900;line-height:1.2;margin-bottom:12px;max-width:600px}
    .capa-sub{font-size:14px;color:rgba(255,255,255,0.7);margin-bottom:40px}
    .capa-info{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px}
    .capa-item{background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);border-radius:8px;padding:12px 16px}
    .capa-item-label{font-size:9px;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,0.5);margin-bottom:4px}
    .capa-item-value{font-size:13px;font-weight:700}
    .capa-footer{display:flex;justify-content:space-between;align-items:center;border-top:1px solid rgba(255,255,255,0.15);padding-top:16px;margin-top:16px;font-size:10px;color:rgba(255,255,255,0.5)}
    /* CONTEÚDO */
    .page{padding:40px;page-break-inside:avoid}
    .page-break{page-break-before:always}
    h1{font-size:20px;font-weight:800;color:#0f172a;margin-bottom:4px}
    h2{font-size:13px;font-weight:700;color:#1e3a5f;border-left:3px solid #34d399;padding-left:10px;margin:24px 0 10px}
    h3{font-size:12px;font-weight:600;color:#334155;margin:16px 0 8px}
    .section{margin-bottom:24px}
    /* Cards de dados */
    .info-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px}
    .info-item{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:8px 10px}
    .info-label{font-size:9px;text-transform:uppercase;letter-spacing:.5px;color:#94a3b8;margin-bottom:2px}
    .info-value{font-size:11px;font-weight:600;color:#1e293b}
    /* Tabelas */
    table{width:100%;border-collapse:collapse;margin-bottom:12px;font-size:10px}
    thead tr{background:#1e3a5f;color:#fff}
    th{padding:7px 10px;text-align:left;font-weight:600;font-size:10px}
    td{padding:6px 10px;border-bottom:1px solid #f1f5f9}
    tr:hover td{background:#f8fafc}
    .tr-total{background:#ecfdf5;font-weight:700;border-top:2px solid #34d399}
    .tr-total td{color:#065f46;font-size:12px}
    /* Totais financeiros */
    .fin-box{background:linear-gradient(135deg,#ecfdf5,#d1fae5);border:2px solid #34d399;border-radius:10px;padding:16px 20px;margin-bottom:16px}
    .fin-row{display:flex;justify-content:space-between;padding:4px 0;font-size:11px;border-bottom:1px dashed #a7f3d0}
    .fin-row:last-child{border-bottom:none;font-size:14px;font-weight:800;padding-top:8px;margin-top:4px}
    .fin-row span:last-child{font-weight:700;color:#065f46}
    /* Colunas lado a lado */
    .two-col{display:grid;grid-template-columns:1fr 1fr;gap:16px}
    /* Aprovação */
    .assinatura{margin-top:40px;display:grid;grid-template-columns:1fr 1fr;gap:40px}
    .ass-box{border-top:2px solid #1e3a5f;padding-top:8px;text-align:center}
    .ass-name{font-size:11px;font-weight:700;color:#1e293b;margin-top:4px}
    .ass-role{font-size:10px;color:#94a3b8}
    /* Decoradores */
    .badge-green{display:inline-block;background:#dcfce7;color:#166534;border-radius:4px;padding:1px 6px;font-size:9px;font-weight:700}
    .badge-blue{display:inline-block;background:#dbeafe;color:#1e40af;border-radius:4px;padding:1px 6px;font-size:9px;font-weight:700}
    .accent-line{height:3px;background:linear-gradient(90deg,#34d399,#0ea5e9,transparent);border-radius:2px;margin-bottom:24px}
    /* Footer de página */
    .page-footer{position:fixed;bottom:0;left:0;right:0;border-top:1px solid #e2e8f0;padding:6px 40px;display:flex;justify-content:space-between;font-size:9px;color:#94a3b8;background:#fff}
    @media print{
      *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
      .capa{min-height:100vh}
      .page-footer{display:block}
      @page{margin:0;size:A4}
    }
  </style>
</head>
<body>

<!-- ═══════ CAPA ═══════ -->
<div class="capa">
  <div>
    <div class="capa-logo">Fraser<span>.</span></div>
    <div style="height:1px;background:rgba(255,255,255,0.15);margin:12px 0 20px"></div>
    <div class="capa-badge">Proposta Comercial</div>
    <div class="capa-titulo">${objeto}</div>
    <div class="capa-sub">Preparado para: <strong>${empresa}</strong>${contato!=='—'?' · Att.: '+contato:''}</div>
    <div class="capa-info">
      <div class="capa-item">
        <div class="capa-item-label">Número</div>
        <div class="capa-item-value">${p.numero||p.id}</div>
      </div>
      <div class="capa-item">
        <div class="capa-item-label">Data de Emissão</div>
        <div class="capa-item-value">${p.data||hoje}</div>
      </div>
      <div class="capa-item">
        <div class="capa-item-label">Validade</div>
        <div class="capa-item-value">${prazoValidade}</div>
      </div>
      <div class="capa-item">
        <div class="capa-item-label">Valor Total</div>
        <div class="capa-item-value" style="color:#34d399;font-size:16px">${fmt(total)}</div>
      </div>
      <div class="capa-item">
        <div class="capa-item-label">Responsável</div>
        <div class="capa-item-value">${responsavel}</div>
      </div>
      <div class="capa-item">
        <div class="capa-item-label">Status</div>
        <div class="capa-item-value">${p.status||'Em Elaboração'}</div>
      </div>
    </div>
  </div>
  <div class="capa-footer">
    <span>Fraser Alexander – Sistema de Gestão Integrado</span>
    <span>${hoje} · Documento Confidencial</span>
  </div>
</div>

<!-- ═══════ PÁGINA 2: DADOS E ESCOPO ═══════ -->
<div class="page page-break">
  <div class="accent-line"></div>
  <h1>Proposta Comercial</h1>
  <p style="font-size:11px;color:#64748b;margin-bottom:20px">${p.numero||p.id} · Emitida em ${p.data||hoje}</p>

  <div class="section">
    <h2>1. Dados do Cliente</h2>
    <div class="info-grid">
      <div class="info-item"><div class="info-label">Empresa / Organização</div><div class="info-value">${empresa}</div></div>
      <div class="info-item"><div class="info-label">Contato</div><div class="info-value">${contato}</div></div>
      <div class="info-item"><div class="info-label">E-mail</div><div class="info-value">${email}</div></div>
      <div class="info-item"><div class="info-label">Objeto / Serviço</div><div class="info-value">${objeto}</div></div>
      ${local?`<div class="info-item"><div class="info-label">Local da Execução</div><div class="info-value">${local}</div></div>`:''}
      <div class="info-item"><div class="info-label">Prazo de Execução</div><div class="info-value">${prazoEntrega}</div></div>
      <div class="info-item"><div class="info-label">Forma de Pagamento</div><div class="info-value">${formaPagamento}</div></div>
      <div class="info-item"><div class="info-label">Validade da Proposta</div><div class="info-value">${prazoValidade}</div></div>
      <div class="info-item"><div class="info-label">Responsável Comercial</div><div class="info-value">${responsavel}</div></div>
    </div>
  </div>

  ${escopo?`
  <div class="section">
    <h2>2. Escopo dos Serviços</h2>
    <p style="font-size:11px;color:#334155;line-height:1.7;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:12px">${escopo.replace(/\n/g,'<br>')}</p>
  </div>
  `:''}

  <!-- Resumo financeiro destacado -->
  <div class="section">
    <h2>${escopo?'3':'2'}. Resumo Financeiro</h2>
    <div class="fin-box">
      ${Object.entries(wbsAgg).length > 1 ? Object.entries(wbsAgg).map(([nat,v])=>`
        <div class="fin-row"><span>${nat}</span><span>${fmt(v)}</span></div>
      `).join('') : ''}
      <div class="fin-row"><span>VALOR TOTAL DA PROPOSTA</span><span>${fmt(total)}</span></div>
      ${margem?`<div class="fin-row" style="font-size:11px;color:#64748b"><span>Margem prevista</span><span>${typeof margem==='number'?margem.toFixed(1)+'%':margem}</span></div>`:''}
    </div>
  </div>
</div>

<!-- ═══════ PÁGINA 3: DETALHAMENTO ═══════ -->
${itens.length > 0 ? `
<div class="page page-break">
  <div class="accent-line"></div>
  <h2>Detalhamento de Itens / WBS</h2>
  <table>
    <thead>
      <tr>
        <th style="width:30px">#</th>
        <th>Descrição / Natureza</th>
        <th style="text-align:center;width:50px">Qtd</th>
        <th style="width:40px">Un</th>
        <th style="text-align:right;width:100px">Valor Unit.</th>
        <th style="text-align:right;width:100px">Total</th>
        ${itens[0]?.expenditure?'<th style="width:70px">Tipo</th>':''}
      </tr>
    </thead>
    <tbody>
      ${itens.map((it,i)=>{
        const t = it.total||(it.qtd||1)*(it.valor_unit||it.preco||it.custo||0);
        return `<tr>
          <td>${i+1}</td>
          <td><strong>${it.descricao||it.nome||it.natureza||'—'}</strong>${it.natureza&&it.descricao?`<br><span style="font-size:9px;color:#94a3b8">${it.natureza}</span>`:''}</td>
          <td style="text-align:center">${it.qtd||1}</td>
          <td>${it.unidade||it.un||it.unit||'vb'}</td>
          <td style="text-align:right">${fmt(it.valor_unit||it.preco||it.custo||0)}</td>
          <td style="text-align:right;font-weight:600">${fmt(t)}</td>
          ${itens[0]?.expenditure?`<td><span class="badge-blue">${it.expenditure||'OPEX'}</span></td>`:''}
        </tr>`;
      }).join('')}
      <tr class="tr-total">
        <td colspan="${itens[0]?.expenditure?5:4}" style="text-align:right;font-size:12px">TOTAL GERAL</td>
        <td style="text-align:right;font-size:14px;color:#065f46">${fmt(total)}</td>
        ${itens[0]?.expenditure?'<td></td>':''}
      </tr>
    </tbody>
  </table>
</div>
`:''}

<!-- ═══════ PÁGINA FINAL: CONDIÇÕES E ASSINATURAS ═══════ -->
<div class="page page-break">
  <div class="accent-line"></div>
  <h2>Condições Comerciais</h2>

  <div class="two-col" style="margin-bottom:20px">
    <div>
      <h3>Inclusões da Proposta</h3>
      <ul style="padding-left:14px;color:#334155;font-size:11px">
        ${(p.inclusoes||['Todos os itens descritos no escopo','Coordenação e gestão','Relatórios de andamento']).map(i=>`<li style="margin-bottom:4px">${i}</li>`).join('')}
      </ul>
    </div>
    <div>
      <h3>Exclusões / Premissas</h3>
      <ul style="padding-left:14px;color:#334155;font-size:11px">
        ${(p.exclusoes||['Impostos de responsabilidade do cliente','Alterações de escopo não previstas','Custos de mobilização do cliente']).map(e=>`<li style="margin-bottom:4px">${e}</li>`).join('')}
      </ul>
    </div>
  </div>

  <div class="info-grid" style="grid-template-columns:1fr 1fr 1fr">
    <div class="info-item"><div class="info-label">Prazo de Execução</div><div class="info-value">${prazoEntrega}</div></div>
    <div class="info-item"><div class="info-label">Forma de Pagamento</div><div class="info-value">${formaPagamento}</div></div>
    <div class="info-item"><div class="info-label">Validade desta Proposta</div><div class="info-value">${prazoValidade}</div></div>
  </div>

  ${observacoes?`
  <h2>Observações Gerais</h2>
  <p style="font-size:11px;color:#334155;line-height:1.7;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:12px;margin-bottom:20px">${observacoes.replace(/\n/g,'<br>')}</p>
  `:''}

  <!-- Valor final destacado -->
  <div style="background:linear-gradient(135deg,#0f172a,#1e3a5f);color:#fff;border-radius:10px;padding:20px 24px;margin:24px 0;display:flex;justify-content:space-between;align-items:center">
    <div>
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,0.6);margin-bottom:4px">Valor Total da Proposta</div>
      <div style="font-size:28px;font-weight:900;color:#34d399">${fmt(total)}</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:10px;color:rgba(255,255,255,0.6)">Proposta Nº</div>
      <div style="font-size:18px;font-weight:700">${p.numero||p.id}</div>
      <div style="font-size:10px;color:rgba(255,255,255,0.6)">Status: ${p.status||'Em Elaboração'}</div>
    </div>
  </div>

  <!-- Assinaturas -->
  <div class="assinatura">
    <div class="ass-box">
      <div style="height:40px"></div>
      <div class="ass-name">Responsável Fraser Alexander</div>
      <div class="ass-role">${responsavel} · Gestão Comercial</div>
    </div>
    <div class="ass-box">
      <div style="height:40px"></div>
      <div class="ass-name">Cliente / Aprovador</div>
      <div class="ass-role">${empresa} · ${hoje}</div>
    </div>
  </div>

  <!-- Rodapé -->
  <div style="margin-top:32px;border-top:1px solid #e2e8f0;padding-top:12px;display:flex;justify-content:space-between;font-size:9px;color:#94a3b8">
    <span>Fraser Alexander – Sistema de Gestão Integrado</span>
    <span>${p.numero||p.id} · ${hoje} · Documento Confidencial</span>
  </div>
</div>

<script>
  // Auto-print ao carregar
  window.onload = function() {
    setTimeout(function(){ window.focus(); window.print(); }, 500);
  };
</script>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=1000,height=750,scrollbars=yes');
  if (!win) {
    showToast('⚠️ Popup bloqueado! Clique no ícone de popup na barra do navegador para permitir.', 'error', 6000);
    return;
  }
  win.document.write(html);
  win.document.close();
  showToast(`📄 Proposta ${p.numero||p.id} aberta — use Ctrl+P para salvar como PDF`, 'success', 5000);
}

// ─── WORD ────────────────────────────────────────────────────────────────────
function gerarWordProposta(propId) {
  const todas = (() => { try { return JSON.parse(localStorage.getItem('fa_propostas_comerciais')||'[]'); } catch(e){return[];} })();
  const p = todas.find(x => x.id === propId);
  if (!p) { showToast('Proposta não encontrada.', 'error'); return; }
  // Gera versão simples Word-compatible
  const fmt = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0);
  const itens = p.itens || p.servicos || [];
  const total = p.valor_total || itens.reduce((s,it)=>s+(it.total||(it.qtd||1)*(it.valor_unit||it.preco||0)),0) || p.valor || 0;
  const rows = itens.map((it,i)=>`<tr><td>${i+1}</td><td>${it.descricao||it.nome||'—'}</td><td>${it.qtd||1}</td><td>${fmt(it.valor_unit||it.preco||0)}</td><td>${fmt(it.total||(it.qtd||1)*(it.valor_unit||it.preco||0))}</td></tr>`).join('');

  const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='UTF-8'><meta name=ProgId content=Word.Document></head><body>
<h1 style="color:#00897B">Fraser Alexander – Proposta Comercial</h1>
<p><b>Número:</b> ${p.numero||p.id} &nbsp; <b>Data:</b> ${p.data||new Date().toLocaleDateString('pt-BR')}</p>
<p><b>Empresa:</b> ${p.empresa||p.cliente||'—'} &nbsp; <b>Objeto:</b> ${p.objeto||p.titulo||'—'}</p>
${itens.length>0?`<table border="1" cellpadding="5" style="border-collapse:collapse;width:100%"><thead><tr><th>#</th><th>Descrição</th><th>Qtd</th><th>Valor Unit.</th><th>Total</th></tr></thead><tbody>${rows}<tr><td colspan="4" align="right"><b>TOTAL</b></td><td><b>${fmt(total)}</b></td></tr></tbody></table>`:`<p><b>Valor Total:</b> ${fmt(total)}</p>`}
${p.observacoes||p.obs?`<p><b>Observações:</b> ${p.observacoes||p.obs}</p>`:''}
</body></html>`;

  const blob = new Blob(['\ufeff', html], {type:'application/vnd.ms-word'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `Proposta_${(p.numero||p.id).replace(/[^a-zA-Z0-9-_]/g,'_')}_${new Date().toISOString().split('T')[0]}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(`📝 Word da proposta ${p.numero||p.id} gerado e baixado!`, 'success', 4000);
}

// ─── INTEGRAÇÃO: GERAR PROPOSTA A PARTIR DO CRM ───────────────────────
// Sobrescreve a função do CRM para usar o novo módulo
function gerarPropostaLead(leadId) {
  abrirNovaProposta(leadId);
}

// =====================================================
// ERP – Módulo Fiscal & Obrigações Acessórias v1.0
// NF-e, SPED, Guias, DAS, Calendário Fiscal Brasil
// =====================================================

// ─── Helpers ─────────────────────────────────────
function _fscGet(k, def) { try { return JSON.parse(localStorage.getItem(k)||JSON.stringify(def)); } catch(e) { return def; } }
function _fscSave(k, v) { localStorage.setItem(k, JSON.stringify(v)); }

function _getFiscalNFe()         { return _fscGet('fa_fiscal_nfe', []); }
function _saveFiscalNFe(d)       { _fscSave('fa_fiscal_nfe', d); }
function _getFiscalGuias()       { return _fscGet('fa_fiscal_guias', []); }
function _saveFiscalGuias(d)     { _fscSave('fa_fiscal_guias', d); }
function _getFiscalObrig()       { return _fscGet('fa_fiscal_obrigacoes', _obrigDefault()); }
function _saveFiscalObrig(d)     { _fscSave('fa_fiscal_obrigacoes', d); }
function _getFiscalConfig()      { return _fscGet('fa_fiscal_config', { regime:'Simples Nacional', cnae:'', crt:1 }); }
function _saveFiscalConfig(d)    { _fscSave('fa_fiscal_config', d); }

let _fscAba = 'dashboard';

// ─── Calendário de obrigações padrão Brasil ───────
function _obrigDefault() {
  const hoje = new Date();
  const ano  = hoje.getFullYear();
  const mes  = String(hoje.getMonth()+1).padStart(2,'0');
  const prox = String(hoje.getMonth()+2<=12 ? hoje.getMonth()+2 : 1).padStart(2,'0');
  const anoProx = hoje.getMonth()+2 > 12 ? ano+1 : ano;
  return [
    { id:'OBR-001', nome:'DAS – Simples Nacional', tipo:'Guia de Recolhimento', periodicidade:'Mensal', vencimento:`${ano}-${mes}-20`, regime:'Simples Nacional', status:'Pendente', valor:0, obs:'Documento de Arrecadação do Simples' },
    { id:'OBR-002', nome:'DCTF – Declaração de Débitos', tipo:'Declaração', periodicidade:'Mensal', vencimento:`${ano}-${mes}-15`, regime:'Lucro Real/Presumido', status:'Pendente', valor:0, obs:'Declaração de Débitos e Créditos Tributários Federais' },
    { id:'OBR-003', nome:'SPED Fiscal (EFD-ICMS/IPI)', tipo:'SPED', periodicidade:'Mensal', vencimento:`${ano}-${prox}-15`, regime:'Todos', status:'Pendente', valor:0, obs:'Escrituração Fiscal Digital' },
    { id:'OBR-004', nome:'SPED Contribuições (EFD-Contribuições)', tipo:'SPED', periodicidade:'Mensal', vencimento:`${ano}-${prox}-15`, regime:'Lucro Real/Presumido', status:'Pendente', valor:0, obs:'EFD PIS/COFINS' },
    { id:'OBR-005', nome:'GFIP/SEFIP', tipo:'Previdenciário', periodicidade:'Mensal', vencimento:`${ano}-${mes}-07`, regime:'Todos', status:'Pendente', valor:0, obs:'Guia de Recolhimento FGTS e Previdência' },
    { id:'OBR-006', nome:'eSocial – Folha de Pagamento', tipo:'eSocial', periodicidade:'Mensal', vencimento:`${ano}-${mes}-07`, regime:'Todos', status:'Pendente', valor:0, obs:'Fechamento da folha de pagamento' },
    { id:'OBR-007', nome:'EFD-Reinf', tipo:'SPED', periodicidade:'Mensal', vencimento:`${ano}-${mes}-15`, regime:'Todos', status:'Pendente', valor:0, obs:'Retenções na Fonte sobre Serviços' },
    { id:'OBR-008', nome:'DIRF', tipo:'Declaração', periodicidade:'Anual', vencimento:`${ano}-02-28`, regime:'Todos', status:'Pendente', valor:0, obs:'Declaração do Imposto sobre Renda Retido na Fonte' },
    { id:'OBR-009', nome:'RAIS', tipo:'Declaração', periodicidade:'Anual', vencimento:`${ano}-03-31`, regime:'Todos', status:'Pendente', valor:0, obs:'Relação Anual de Informações Sociais' },
    { id:'OBR-010', nome:'DEFIS', tipo:'Declaração', periodicidade:'Anual', vencimento:`${ano}-03-31`, regime:'Simples Nacional', status:'Pendente', valor:0, obs:'Declaração de Informações Socioeconômicas e Fiscais' },
    { id:'OBR-011', nome:'ISS – Nota Fiscal Eletrônica', tipo:'NFS-e', periodicidade:'Por emissão', vencimento:`${ano}-${mes}-10`, regime:'Todos', status:'Em Dia', valor:0, obs:'Emissão e envio de NFS-e à prefeitura' },
    { id:'OBR-012', nome:'DMED', tipo:'Declaração', periodicidade:'Anual', vencimento:`${ano}-02-28`, regime:'Saúde', status:'Pendente', valor:0, obs:'Declaração de Serviços Médicos e de Saúde' },
  ];
}

// ─── Render principal ─────────────────────────────
function renderFiscal() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `
  <div class="page-header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
    <div>
      <h2 style="margin:0;font-size:1.35rem;font-weight:700;display:flex;align-items:center;gap:8px">
        <i class="fas fa-landmark" style="color:#0891b2"></i> Fiscal &amp; Obrigações Acessórias
      </h2>
      <p style="margin:4px 0 0;font-size:.82rem;color:var(--text-muted)">Calendário fiscal · NF-e · SPED · Guias · Compliance tributário Brasil</p>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-outline-secondary btn-sm" onclick="_fscConfigRegime()">
        <i class="fas fa-cog"></i> Configurar Regime
      </button>
      <button class="btn btn-primary btn-sm" onclick="_fscNovaObrigacao()">
        <i class="fas fa-plus"></i> Nova Obrigação
      </button>
    </div>
  </div>

  <!-- Regime Tributário Badge -->
  <div id="fscRegimeBadge" style="margin:8px 0 16px"></div>

  <!-- Abas -->
  <div style="display:flex;gap:4px;margin-bottom:20px;border-bottom:2px solid var(--border-color)">
    ${[
      {id:'dashboard', label:'Painel', icone:'tachometer-alt'},
      {id:'calendario', label:'Calendário', icone:'calendar-alt'},
      {id:'nfe', label:'NF-e / NFS-e', icone:'file-invoice'},
      {id:'guias', label:'Guias & Impostos', icone:'receipt'},
      {id:'sped', label:'SPED / eSocial', icone:'server'},
      {id:'parametros', label:'Parâmetros', icone:'sliders-h'},
    ].map(a=>`
      <button onclick="_fscNavAba('${a.id}')" id="fscTab_${a.id}"
        style="padding:8px 14px;border:none;background:none;cursor:pointer;font-size:.83rem;font-weight:600;
               color:${_fscAba===a.id?'#0891b2':'var(--text-muted)'};
               border-bottom:${_fscAba===a.id?'3px solid #0891b2':'3px solid transparent'};
               margin-bottom:-2px;white-space:nowrap;transition:all .2s">
        <i class="fas fa-${a.icone}"></i> ${a.label}
      </button>
    `).join('')}
  </div>

  <div id="fscAbaContent"></div>`;

  _fscAtualizarRegimeBadge();
  _fscRenderAba();
}

function _fscAtualizarRegimeBadge() {
  const cfg = _getFiscalConfig();
  const el = document.getElementById('fscRegimeBadge');
  if (!el) return;
  const cores = { 'Simples Nacional':'#10b981', 'Lucro Presumido':'#f59e0b', 'Lucro Real':'#7c3aed', 'MEI':'#0891b2' };
  const cor = cores[cfg.regime] || '#64748b';
  el.innerHTML = `
    <span style="display:inline-flex;align-items:center;gap:8px;background:${cor}15;border:1px solid ${cor}40;border-radius:6px;padding:5px 14px;font-size:.8rem">
      <i class="fas fa-landmark" style="color:${cor}"></i>
      <strong style="color:${cor}">${cfg.regime}</strong>
      ${cfg.cnae ? `<span style="color:var(--text-muted)">| CNAE: ${cfg.cnae}</span>` : ''}
      ${cfg.crt ? `<span style="color:var(--text-muted)">| CRT: ${cfg.crt}</span>` : ''}
    </span>`;
}

function _fscNavAba(aba) { _fscAba = aba; renderFiscal(); }

function _fscRenderAba() {
  const el = document.getElementById('fscAbaContent');
  if (!el) return;
  if (_fscAba === 'dashboard')  _fscRenderDashboard(el);
  else if (_fscAba === 'calendario') _fscRenderCalendario(el);
  else if (_fscAba === 'nfe')   _fscRenderNFe(el);
  else if (_fscAba === 'guias') _fscRenderGuias(el);
  else if (_fscAba === 'sped')  _fscRenderSPED(el);
  else if (_fscAba === 'parametros') _fscRenderParametros(el);
}

// ─── ABA: Dashboard Fiscal ────────────────────────
function _fscRenderDashboard(el) {
  const obrig   = _getFiscalObrig();
  const guias   = _getFiscalGuias();
  const nfe     = _getFiscalNFe();
  const hoje    = new Date();
  const hoje7   = new Date(hoje); hoje7.setDate(hoje7.getDate()+7);
  const hoje30  = new Date(hoje); hoje30.setDate(hoje30.getDate()+30);

  const vencidas    = obrig.filter(o => o.status !== 'Entregue' && o.status !== 'Pago' && o.vencimento && new Date(o.vencimento) < hoje);
  const proximas7   = obrig.filter(o => o.status === 'Pendente' && o.vencimento && new Date(o.vencimento) >= hoje && new Date(o.vencimento) <= hoje7);
  const proximas30  = obrig.filter(o => o.status === 'Pendente' && o.vencimento && new Date(o.vencimento) >= hoje && new Date(o.vencimento) <= hoje30);
  const emDia       = obrig.filter(o => o.status === 'Entregue' || o.status === 'Pago' || o.status === 'Em Dia');
  const totalGuias  = guias.reduce((s,g) => s + parseFloat(g.valor||0), 0);
  const nfeMes      = nfe.filter(n => { const d=new Date(n.data_emissao||''); return d.getMonth()===hoje.getMonth() && d.getFullYear()===hoje.getFullYear(); });

  el.innerHTML = `
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;margin-bottom:20px">
    ${[
      { label:'Obrigações Vencidas',  valor:vencidas.length,   cor:'#ef4444', icone:'exclamation-circle' },
      { label:'Vencendo em 7 dias',   valor:proximas7.length,  cor:'#f59e0b', icone:'clock' },
      { label:'Vencendo em 30 dias',  valor:proximas30.length, cor:'#0891b2', icone:'calendar' },
      { label:'Em Dia',               valor:emDia.length,      cor:'#10b981', icone:'check-circle' },
      { label:'NF-e Emitidas/Mês',    valor:nfeMes.length,     cor:'#7c3aed', icone:'file-invoice' },
      { label:'Total Guias (Acum.)',   valor:'R$'+totalGuias.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}), cor:'#64748b', icone:'receipt' },
    ].map(c=>`
      <div class="card" style="padding:14px;border-left:3px solid ${c.cor}">
        <div style="font-size:.72rem;color:var(--text-muted);font-weight:600;text-transform:uppercase;margin-bottom:6px">
          <i class="fas fa-${c.icone}"></i> ${c.label}
        </div>
        <div style="font-size:1.5rem;font-weight:700;color:${c.cor}">${c.valor}</div>
      </div>
    `).join('')}
  </div>

  ${vencidas.length ? `
  <div class="card" style="padding:16px;margin-bottom:16px;border-left:4px solid #ef4444">
    <h6 style="font-weight:700;color:#ef4444;margin-bottom:10px"><i class="fas fa-exclamation-triangle"></i> Obrigações Vencidas (${vencidas.length})</h6>
    ${vencidas.map(o=>`
      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px;border-radius:6px;background:rgba(239,68,68,.05);margin-bottom:6px">
        <div>
          <strong style="font-size:.85rem">${o.nome}</strong>
          <div style="font-size:.72rem;color:var(--text-muted)">${o.tipo} · Venc: ${o.vencimento||'-'}</div>
        </div>
        <button class="btn btn-sm btn-outline-success" onclick="_fscMarcarEntregue('${o.id}')">
          <i class="fas fa-check"></i> Regularizar
        </button>
      </div>
    `).join('')}
  </div>` : ''}

  ${proximas7.length ? `
  <div class="card" style="padding:16px;border-left:4px solid #f59e0b">
    <h6 style="font-weight:700;color:#f59e0b;margin-bottom:10px"><i class="fas fa-clock"></i> Vencendo em 7 dias (${proximas7.length})</h6>
    ${proximas7.map(o=>`
      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px;border-radius:6px;background:rgba(245,158,11,.05);margin-bottom:6px">
        <div>
          <strong style="font-size:.85rem">${o.nome}</strong>
          <div style="font-size:.72rem;color:var(--text-muted)">${o.tipo} · Venc: ${o.vencimento||'-'}</div>
        </div>
        <button class="btn btn-sm btn-outline-primary" onclick="_fscMarcarEntregue('${o.id}')">
          <i class="fas fa-check"></i> Concluir
        </button>
      </div>
    `).join('')}
  </div>` : ''}`;
}

// ─── ABA: Calendário ──────────────────────────────
function _fscRenderCalendario(el) {
  const obrig = _getFiscalObrig();
  const hoje  = new Date();

  // Agrupa por mês
  const porMes = {};
  obrig.forEach(o => {
    if (!o.vencimento) return;
    const key = o.vencimento.slice(0,7); // YYYY-MM
    if (!porMes[key]) porMes[key] = [];
    porMes[key].push(o);
  });

  const meses = Object.keys(porMes).sort();

  el.innerHTML = `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
    <h6 style="font-weight:700;margin:0"><i class="fas fa-calendar-alt" style="color:#0891b2"></i> Calendário de Obrigações Fiscais</h6>
    <button class="btn btn-primary btn-sm" onclick="_fscNovaObrigacao()"><i class="fas fa-plus"></i> Adicionar</button>
  </div>

  ${meses.map(mes => {
    const [ano, m] = mes.split('-');
    const nomeMes = new Date(ano, parseInt(m)-1, 1).toLocaleString('pt-BR',{month:'long',year:'numeric'});
    const itens = porMes[mes].sort((a,b) => a.vencimento.localeCompare(b.vencimento));
    return `
    <div class="card" style="padding:16px;margin-bottom:16px">
      <h6 style="font-weight:700;text-transform:capitalize;margin-bottom:12px;display:flex;align-items:center;gap:8px">
        <i class="fas fa-calendar" style="color:#0891b2"></i> ${nomeMes}
        <span style="font-size:.72rem;background:#0891b215;color:#0891b2;padding:2px 8px;border-radius:10px">${itens.length} obrigações</span>
      </h6>
      <div style="overflow-x:auto">
        <table class="table table-sm">
          <thead>
            <tr>
              <th>Obrigação</th><th>Tipo</th><th>Vencimento</th><th>Regime</th><th>Valor</th><th>Status</th><th>Ações</th>
            </tr>
          </thead>
          <tbody>
            ${itens.map(o => {
              const venc = new Date(o.vencimento);
              const atrasado = venc < hoje && o.status === 'Pendente';
              return `<tr>
                <td style="font-weight:500">${o.nome}</td>
                <td><span style="font-size:.72rem;background:#0891b215;color:#0891b2;padding:2px 6px;border-radius:4px">${o.tipo}</span></td>
                <td style="color:${atrasado?'#ef4444':'inherit'};font-weight:${atrasado?700:400}">
                  ${o.vencimento||'-'} ${atrasado?'<i class="fas fa-exclamation-circle" style="color:#ef4444"></i>':''}
                </td>
                <td style="font-size:.75rem">${o.regime||'-'}</td>
                <td>${o.valor ? 'R$ ' + parseFloat(o.valor).toLocaleString('pt-BR',{minimumFractionDigits:2}) : '-'}</td>
                <td>
                  <span style="font-size:.72rem;padding:2px 8px;border-radius:4px;font-weight:600;
                    background:${o.status==='Entregue'||o.status==='Pago'||o.status==='Em Dia'?'rgba(16,185,129,.15)':atrasado?'rgba(239,68,68,.15)':'rgba(245,158,11,.15)'};
                    color:${o.status==='Entregue'||o.status==='Pago'||o.status==='Em Dia'?'#10b981':atrasado?'#ef4444':'#f59e0b'}">
                    ${o.status||'Pendente'}
                  </span>
                </td>
                <td>
                  <button class="btn btn-xs" onclick="_fscEditarObrigacao('${o.id}')" title="Editar"><i class="fas fa-edit"></i></button>
                  <button class="btn btn-xs btn-outline-success" onclick="_fscMarcarEntregue('${o.id}')" title="Marcar entregue"><i class="fas fa-check"></i></button>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
  }).join('')}

  ${meses.length === 0 ? `<div class="empty-state"><i class="fas fa-calendar-times"></i><p>Nenhuma obrigação cadastrada</p></div>` : ''}`;
}

// ─── ABA: NF-e / NFS-e ────────────────────────────
function _fscRenderNFe(el) {
  const nfe = _getFiscalNFe();
  const hoje = new Date();
  const mesMes = hoje.getMonth();

  el.innerHTML = `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
    <h6 style="font-weight:700;margin:0"><i class="fas fa-file-invoice" style="color:#7c3aed"></i> Notas Fiscais Eletrônicas</h6>
    <button class="btn btn-primary btn-sm" onclick="_fscNovaNFe()"><i class="fas fa-plus"></i> Registrar NF-e</button>
  </div>

  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
    ${[
      { label:'Total NF-e', valor: nfe.length, cor:'#7c3aed' },
      { label:'Emitidas Mês', valor: nfe.filter(n=>new Date(n.data_emissao||'').getMonth()===mesMes).length, cor:'#10b981' },
      { label:'Canceladas', valor: nfe.filter(n=>n.status==='Cancelada').length, cor:'#ef4444' },
      { label:'Valor Total', valor:'R$'+nfe.reduce((s,n)=>s+parseFloat(n.valor||0),0).toLocaleString('pt-BR',{minimumFractionDigits:2}), cor:'#0891b2' },
    ].map(c=>`
      <div class="card" style="padding:12px;border-left:3px solid ${c.cor}">
        <div style="font-size:.7rem;color:var(--text-muted);text-transform:uppercase">${c.label}</div>
        <div style="font-size:1.3rem;font-weight:700;color:${c.cor}">${c.valor}</div>
      </div>
    `).join('')}
  </div>

  <div class="card" style="padding:16px">
    <div style="overflow-x:auto">
      <table class="table">
        <thead>
          <tr><th>Número</th><th>Tipo</th><th>Tomador/Prestador</th><th>Emissão</th><th>Competência</th><th class="text-right">Valor</th><th>Status</th><th>Ações</th></tr>
        </thead>
        <tbody>
          ${nfe.length === 0 ? `<tr><td colspan="8" class="text-center" style="padding:32px;color:var(--text-muted)"><i class="fas fa-file-invoice" style="font-size:2rem;display:block;margin-bottom:8px"></i>Nenhuma NF-e registrada</td></tr>` : ''}
          ${nfe.map(n=>`
            <tr>
              <td><strong>${n.numero||'-'}</strong></td>
              <td><span style="font-size:.72rem;background:${n.tipo==='NFS-e'?'#7c3aed15':'#0891b215'};color:${n.tipo==='NFS-e'?'#7c3aed':'#0891b2'};padding:2px 8px;border-radius:4px">${n.tipo||'NF-e'}</span></td>
              <td>${n.tomador||n.prestador||'-'}</td>
              <td>${n.data_emissao||'-'}</td>
              <td>${n.competencia||'-'}</td>
              <td class="text-right">R$ ${parseFloat(n.valor||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
              <td><span style="font-size:.72rem;padding:2px 8px;border-radius:4px;background:${n.status==='Autorizada'?'rgba(16,185,129,.15)':n.status==='Cancelada'?'rgba(239,68,68,.15)':'rgba(245,158,11,.15)'};color:${n.status==='Autorizada'?'#10b981':n.status==='Cancelada'?'#ef4444':'#f59e0b'}">${n.status||'Emitida'}</span></td>
              <td>
                <button class="btn btn-xs" onclick="_fscEditarNFe('${n.id}')"><i class="fas fa-edit"></i></button>
                <button class="btn btn-xs btn-outline-danger" onclick="_fscCancelarNFe('${n.id}')"><i class="fas fa-ban"></i></button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
}

// ─── ABA: Guias & Impostos ────────────────────────
function _fscRenderGuias(el) {
  const guias = _getFiscalGuias();
  const hoje  = new Date();

  const totalPago   = guias.filter(g=>g.status==='Pago').reduce((s,g)=>s+parseFloat(g.valor||0),0);
  const totalPendente = guias.filter(g=>g.status!=='Pago').reduce((s,g)=>s+parseFloat(g.valor||0),0);

  el.innerHTML = `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
    <h6 style="font-weight:700;margin:0"><i class="fas fa-receipt" style="color:#0891b2"></i> Guias de Impostos e Contribuições</h6>
    <button class="btn btn-primary btn-sm" onclick="_fscNovaGuia()"><i class="fas fa-plus"></i> Registrar Guia</button>
  </div>

  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px">
    <div class="card" style="padding:14px;border-left:3px solid #10b981">
      <div style="font-size:.72rem;color:var(--text-muted)">Total Pago</div>
      <div style="font-size:1.2rem;font-weight:700;color:#10b981">R$ ${totalPago.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div>
    </div>
    <div class="card" style="padding:14px;border-left:3px solid #f59e0b">
      <div style="font-size:.72rem;color:var(--text-muted)">A Pagar</div>
      <div style="font-size:1.2rem;font-weight:700;color:#f59e0b">R$ ${totalPendente.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div>
    </div>
    <div class="card" style="padding:14px;border-left:3px solid #0891b2">
      <div style="font-size:.72rem;color:var(--text-muted)">Total Guias</div>
      <div style="font-size:1.2rem;font-weight:700;color:#0891b2">${guias.length}</div>
    </div>
  </div>

  <div class="card" style="padding:16px">
    <div style="overflow-x:auto">
      <table class="table">
        <thead>
          <tr><th>Imposto/Tributo</th><th>Competência</th><th>Vencimento</th><th>CNPJ Empresa</th><th class="text-right">Valor</th><th>Status</th><th>Ações</th></tr>
        </thead>
        <tbody>
          ${guias.length === 0 ? `<tr><td colspan="7" class="text-center" style="padding:32px;color:var(--text-muted)">Nenhuma guia registrada</td></tr>` : ''}
          ${guias.map(g => {
            const atrasado = g.status !== 'Pago' && g.vencimento && new Date(g.vencimento) < hoje;
            return `<tr>
              <td><strong>${g.tributo||'-'}</strong><div style="font-size:.72rem;color:var(--text-muted)">${g.codigo_receita||''}</div></td>
              <td>${g.competencia||'-'}</td>
              <td style="color:${atrasado?'#ef4444':'inherit'}">${g.vencimento||'-'}</td>
              <td style="font-size:.8rem">${g.cnpj||'-'}</td>
              <td class="text-right">R$ ${parseFloat(g.valor||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
              <td><span style="font-size:.72rem;padding:2px 8px;border-radius:4px;background:${g.status==='Pago'?'rgba(16,185,129,.15)':atrasado?'rgba(239,68,68,.15)':'rgba(245,158,11,.15)'};color:${g.status==='Pago'?'#10b981':atrasado?'#ef4444':'#f59e0b'}">${g.status||'Pendente'}</span></td>
              <td>
                <button class="btn btn-xs" onclick="_fscEditarGuia('${g.id}')"><i class="fas fa-edit"></i></button>
                ${g.status !== 'Pago' ? `<button class="btn btn-xs btn-outline-success" onclick="_fscPagarGuia('${g.id}')"><i class="fas fa-check"></i> Pagar</button>` : ''}
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
}

// ─── ABA: SPED / eSocial ──────────────────────────
function _fscRenderSPED(el) {
  el.innerHTML = `
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
    <!-- SPED -->
    <div class="card" style="padding:20px">
      <h6 style="font-weight:700;margin-bottom:16px"><i class="fas fa-server" style="color:#7c3aed"></i> Arquivos SPED</h6>
      <div style="display:flex;flex-direction:column;gap:10px">
        ${[
          { nome:'EFD-ICMS/IPI', desc:'Escrituração Fiscal Digital', status:'Pendente', cor:'#f59e0b' },
          { nome:'EFD-Contribuições', desc:'PIS/COFINS', status:'Pendente', cor:'#f59e0b' },
          { nome:'ECF', desc:'Escrituração Contábil Fiscal', status:'Pendente', cor:'#f59e0b' },
          { nome:'ECD', desc:'Escrituração Contábil Digital', status:'Pendente', cor:'#f59e0b' },
          { nome:'EFD-Reinf', desc:'Retenções na Fonte', status:'Pendente', cor:'#f59e0b' },
        ].map(s=>`
          <div style="display:flex;align-items:center;justify-content:space-between;padding:10px;border-radius:6px;background:var(--surface-color);border:1px solid var(--border-color)">
            <div>
              <div style="font-weight:600;font-size:.85rem">${s.nome}</div>
              <div style="font-size:.72rem;color:var(--text-muted)">${s.desc}</div>
            </div>
            <span style="font-size:.72rem;padding:2px 10px;border-radius:10px;background:rgba(245,158,11,.15);color:#f59e0b;font-weight:600">${s.status}</span>
          </div>
        `).join('')}
      </div>
      <div style="margin-top:16px;padding:12px;background:rgba(124,58,237,.05);border-radius:6px;font-size:.78rem;color:var(--text-muted);border:1px solid rgba(124,58,237,.15)">
        <i class="fas fa-info-circle" style="color:#7c3aed"></i>
        <strong> Integração contábil:</strong> Para geração dos arquivos SPED, integre com seu software contábil (ex: Contabilidade TOTVS, Domínio, Alterdata) via exportação de lançamentos.
      </div>
    </div>

    <!-- eSocial -->
    <div class="card" style="padding:20px">
      <h6 style="font-weight:700;margin-bottom:16px"><i class="fas fa-users" style="color:#10b981"></i> eSocial</h6>
      <div style="display:flex;flex-direction:column;gap:10px">
        ${[
          { evento:'S-1000', desc:'Informações do Empregador', status:'Transmitido', cor:'#10b981' },
          { evento:'S-1020', desc:'Tabela de Lotações Tributárias', status:'Transmitido', cor:'#10b981' },
          { evento:'S-1030', desc:'Cargos/Empregos', status:'Transmitido', cor:'#10b981' },
          { evento:'S-2200', desc:'Admissão de Trabalhador', status:'Pendente', cor:'#f59e0b' },
          { evento:'S-1200', desc:'Remuneração do Trabalhador', status:'Pendente', cor:'#f59e0b' },
          { evento:'S-1210', desc:'Pagamentos Devidos ao Trabalhador', status:'Pendente', cor:'#f59e0b' },
          { evento:'S-2400', desc:'Cadastro de Benefício', status:'Pendente', cor:'#f59e0b' },
        ].map(s=>`
          <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-radius:6px;background:var(--surface-color);border:1px solid var(--border-color)">
            <div>
              <span style="font-weight:700;font-size:.82rem;color:#0891b2">${s.evento}</span>
              <span style="font-size:.78rem;color:var(--text-muted);margin-left:8px">${s.desc}</span>
            </div>
            <span style="font-size:.7rem;padding:2px 8px;border-radius:4px;background:${s.cor==='#10b981'?'rgba(16,185,129,.15)':'rgba(245,158,11,.15)'};color:${s.cor};font-weight:600">${s.status}</span>
          </div>
        `).join('')}
      </div>
    </div>
  </div>

  <!-- Obrigações Mensais Checklist -->
  <div class="card" style="padding:20px;margin-top:16px">
    <h6 style="font-weight:700;margin-bottom:16px"><i class="fas fa-tasks" style="color:#0891b2"></i> Checklist de Fechamento Mensal</h6>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      ${[
        'Conciliar contas bancárias',
        'Fechar folha de pagamento (eSocial)',
        'Emitir guias DAS / DARF / GPS',
        'Transmitir EFD-Reinf',
        'Apurar ISS / nota de serviço',
        'Revisar NF-e emitidas e recebidas',
        'Conferir SPED Fiscal',
        'Recolher FGTS (até dia 7)',
        'Enviar GFIP (até dia 7)',
        'Revisar contas a pagar fiscais',
        'Calcular estimativas IR/CSLL (Lucro Real)',
        'Arquivar documentos fiscais',
      ].map((t,i)=>`
        <label style="display:flex;align-items:center;gap:8px;padding:8px;border-radius:6px;background:var(--surface-color);cursor:pointer;font-size:.82rem">
          <input type="checkbox" id="fscCheck_${i}" style="width:16px;height:16px;cursor:pointer">
          ${t}
        </label>
      `).join('')}
    </div>
    <div style="margin-top:12px;text-align:right">
      <button class="btn btn-success btn-sm" onclick="_fscSalvarChecklist()"><i class="fas fa-save"></i> Salvar Checklist</button>
    </div>
  </div>`;

  // Restaurar checklist
  setTimeout(() => {
    const saved = _fscGet('fa_fiscal_checklist', {});
    Object.entries(saved).forEach(([k,v]) => {
      const el = document.getElementById('fscCheck_' + k.replace('fscCheck_',''));
      if (el) el.checked = v;
    });
  }, 100);
}

function _fscSalvarChecklist() {
  const data = {};
  document.querySelectorAll('[id^="fscCheck_"]').forEach(el => {
    data[el.id] = el.checked;
  });
  _fscSave('fa_fiscal_checklist', data);
  showToast('Checklist salvo!', 'success');
}

// ─── ABA: Parâmetros ──────────────────────────────
function _fscRenderParametros(el) {
  const cfg = _getFiscalConfig();
  el.innerHTML = `
  <div class="card" style="padding:24px;max-width:700px">
    <h6 style="font-weight:700;margin-bottom:20px"><i class="fas fa-sliders-h" style="color:#0891b2"></i> Parâmetros Fiscais da Empresa</h6>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div class="form-group">
        <label>Regime Tributário *</label>
        <select class="form-control" id="fscCfgRegime">
          ${['Simples Nacional','MEI','Lucro Presumido','Lucro Real','Imune/Isenta'].map(r=>`<option ${cfg.regime===r?'selected':''}>${r}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>CRT (Código Regime Tributário)</label>
        <select class="form-control" id="fscCfgCRT">
          <option value="1" ${cfg.crt==1?'selected':''}>1 – Simples Nacional</option>
          <option value="2" ${cfg.crt==2?'selected':''}>2 – Simples Nacional – excesso de sublimite</option>
          <option value="3" ${cfg.crt==3?'selected':''}>3 – Regime Normal (Lucro Real/Presumido)</option>
          <option value="4" ${cfg.crt==4?'selected':''}>4 – MEI</option>
        </select>
      </div>
      <div class="form-group">
        <label>CNAE Principal</label>
        <input class="form-control" id="fscCfgCNAE" value="${cfg.cnae||''}" placeholder="ex: 4120-4/00">
      </div>
      <div class="form-group">
        <label>Alíquota ISS (%)</label>
        <input class="form-control" type="number" id="fscCfgISS" value="${cfg.aliquota_iss||5}" min="0" max="5" step="0.5">
      </div>
      <div class="form-group">
        <label>Alíquota Simples (Anexo)</label>
        <select class="form-control" id="fscCfgAnexo">
          ${['I – Comércio','II – Indústria','III – Serviços','IV – Serviços (sem CPP)','V – Serviços (fator R)'].map(a=>`<option ${cfg.anexo===a?'selected':''}>${a}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>CNPJ da Empresa</label>
        <input class="form-control" id="fscCfgCNPJ" value="${cfg.cnpj||''}" placeholder="00.000.000/0001-00">
      </div>
      <div class="form-group" style="grid-column:1/-1">
        <label>Endereço para fins fiscais</label>
        <input class="form-control" id="fscCfgEndereco" value="${cfg.endereco||''}" placeholder="Rua, número, bairro, município – UF">
      </div>
      <div class="form-group" style="grid-column:1/-1">
        <label>Inscrição Estadual</label>
        <input class="form-control" id="fscCfgIE" value="${cfg.ie||''}" placeholder="Número da IE">
      </div>
      <div class="form-group" style="grid-column:1/-1">
        <label>Inscrição Municipal</label>
        <input class="form-control" id="fscCfgIM" value="${cfg.im||''}" placeholder="Número da IM">
      </div>
    </div>
    <div style="margin-top:20px;display:flex;justify-content:flex-end;gap:8px">
      <button class="btn btn-secondary" onclick="renderFiscal()">Cancelar</button>
      <button class="btn btn-primary" onclick="_fscSalvarConfig()"><i class="fas fa-save"></i> Salvar Parâmetros</button>
    </div>
  </div>`;
}

function _fscSalvarConfig() {
  const cfg = {
    regime:      document.getElementById('fscCfgRegime')?.value,
    crt:         parseInt(document.getElementById('fscCfgCRT')?.value||1),
    cnae:        document.getElementById('fscCfgCNAE')?.value?.trim(),
    aliquota_iss:parseFloat(document.getElementById('fscCfgISS')?.value||5),
    anexo:       document.getElementById('fscCfgAnexo')?.value,
    cnpj:        document.getElementById('fscCfgCNPJ')?.value?.trim(),
    endereco:    document.getElementById('fscCfgEndereco')?.value?.trim(),
    ie:          document.getElementById('fscCfgIE')?.value?.trim(),
    im:          document.getElementById('fscCfgIM')?.value?.trim(),
  };
  _saveFiscalConfig(cfg);
  showToast('Parâmetros fiscais salvos!','success');
  renderFiscal();
}

// ─── Modais de Obrigação ──────────────────────────
function _fscNovaObrigacao() { _fscModalObrigacao(); }
function _fscEditarObrigacao(id) {
  const obrig = _getFiscalObrig().find(o=>o.id===id);
  if (obrig) _fscModalObrigacao(obrig);
}

function _fscModalObrigacao(o={}) {
  const titulo = o.id ? 'Editar Obrigação' : 'Nova Obrigação Fiscal';
  showModal(titulo, `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="form-group" style="grid-column:1/-1">
        <label>Nome da Obrigação *</label>
        <input class="form-control" id="fscObNome" value="${o.nome||''}" placeholder="Ex: DAS – Simples Nacional">
      </div>
      <div class="form-group">
        <label>Tipo</label>
        <select class="form-control" id="fscObTipo">
          ${['Guia de Recolhimento','Declaração','SPED','eSocial','NFS-e','Previdenciário','Outros'].map(t=>`<option ${o.tipo===t?'selected':''}>${t}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Periodicidade</label>
        <select class="form-control" id="fscObPer">
          ${['Mensal','Bimestral','Trimestral','Semestral','Anual','Por emissão'].map(p=>`<option ${o.periodicidade===p?'selected':''}>${p}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Data de Vencimento</label>
        <input class="form-control" type="date" id="fscObVenc" value="${o.vencimento||''}">
      </div>
      <div class="form-group">
        <label>Status</label>
        <select class="form-control" id="fscObStatus">
          ${['Pendente','Em Andamento','Entregue','Pago','Em Dia','Atrasado'].map(s=>`<option ${o.status===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Valor (R$)</label>
        <input class="form-control" type="number" id="fscObValor" value="${o.valor||0}" min="0" step="0.01">
      </div>
      <div class="form-group">
        <label>Regime</label>
        <select class="form-control" id="fscObRegime">
          ${['Todos','Simples Nacional','MEI','Lucro Presumido','Lucro Real','Saúde'].map(r=>`<option ${o.regime===r?'selected':''}>${r}</option>`).join('')}
        </select>
      </div>
      <div class="form-group" style="grid-column:1/-1">
        <label>Observações</label>
        <textarea class="form-control" id="fscObObs" rows="2">${o.obs||''}</textarea>
      </div>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    ${o.id ? `<button class="btn btn-danger" onclick="_fscExcluirObrigacao('${o.id}')"><i class="fas fa-trash"></i></button>` : ''}
    <button class="btn btn-primary" onclick="_fscSalvarObrigacao('${o.id||''}')"><i class="fas fa-save"></i> Salvar</button>
  `);
}

function _fscSalvarObrigacao(id) {
  const obrig = _getFiscalObrig();
  const nova = {
    id:           id || ('OBR-' + Date.now()),
    nome:         document.getElementById('fscObNome')?.value?.trim(),
    tipo:         document.getElementById('fscObTipo')?.value,
    periodicidade:document.getElementById('fscObPer')?.value,
    vencimento:   document.getElementById('fscObVenc')?.value,
    status:       document.getElementById('fscObStatus')?.value,
    valor:        parseFloat(document.getElementById('fscObValor')?.value||0),
    regime:       document.getElementById('fscObRegime')?.value,
    obs:          document.getElementById('fscObObs')?.value?.trim(),
  };
  if (!nova.nome) { showToast('Nome obrigatório','error'); return; }
  if (id) { const idx = obrig.findIndex(o=>o.id===id); if(idx>=0) obrig[idx]=nova; else obrig.push(nova); }
  else obrig.push(nova);
  _saveFiscalObrig(obrig);
  closeModal();
  showToast('Obrigação salva!','success');
  _fscNavAba('calendario');
}

function _fscExcluirObrigacao(id) {
  if (!confirm('Excluir esta obrigação?')) return;
  _saveFiscalObrig(_getFiscalObrig().filter(o=>o.id!==id));
  closeModal();
  showToast('Excluída','info');
  _fscNavAba('calendario');
}

function _fscMarcarEntregue(id) {
  const obrig = _getFiscalObrig();
  const idx = obrig.findIndex(o=>o.id===id);
  if (idx >= 0) { obrig[idx].status = 'Entregue'; _saveFiscalObrig(obrig); }
  showToast('Obrigação regularizada!','success');
  renderFiscal();
}

// ─── Modal NF-e ───────────────────────────────────
function _fscNovaNFe() { _fscModalNFe(); }
function _fscEditarNFe(id) {
  const n = _getFiscalNFe().find(n=>n.id===id);
  if(n) _fscModalNFe(n);
}

function _fscModalNFe(n={}) {
  showModal(n.id?'Editar NF-e':'Nova NF-e / NFS-e', `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="form-group">
        <label>Número *</label>
        <input class="form-control" id="fscNfeNum" value="${n.numero||''}" placeholder="000001">
      </div>
      <div class="form-group">
        <label>Tipo</label>
        <select class="form-control" id="fscNfeTipo">
          ${['NF-e','NFS-e','NFC-e','CT-e','MDF-e'].map(t=>`<option ${n.tipo===t?'selected':''}>${t}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Data de Emissão</label>
        <input class="form-control" type="date" id="fscNfeData" value="${n.data_emissao||new Date().toISOString().slice(0,10)}">
      </div>
      <div class="form-group">
        <label>Competência (MM/AAAA)</label>
        <input class="form-control" id="fscNfeComp" value="${n.competencia||''}" placeholder="04/2025">
      </div>
      <div class="form-group" style="grid-column:1/-1">
        <label>Tomador / Prestador</label>
        <input class="form-control" id="fscNfeTom" value="${n.tomador||n.prestador||''}" placeholder="Razão social">
      </div>
      <div class="form-group">
        <label>Valor (R$) *</label>
        <input class="form-control" type="number" id="fscNfeValor" value="${n.valor||0}" min="0" step="0.01">
      </div>
      <div class="form-group">
        <label>Status</label>
        <select class="form-control" id="fscNfeStatus">
          ${['Autorizada','Emitida','Cancelada','Denegada','Pendente'].map(s=>`<option ${n.status===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </div>
      <div class="form-group" style="grid-column:1/-1">
        <label>Chave de Acesso (44 dígitos)</label>
        <input class="form-control" id="fscNfeChave" value="${n.chave||''}" placeholder="0000000000000000000000000000000000000000000">
      </div>
      <div class="form-group" style="grid-column:1/-1">
        <label>Observações / Natureza da Operação</label>
        <textarea class="form-control" id="fscNfeObs" rows="2">${n.obs||''}</textarea>
      </div>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="_fscSalvarNFe('${n.id||''}')"><i class="fas fa-save"></i> Salvar</button>
  `);
}

function _fscSalvarNFe(id) {
  const nfe = _getFiscalNFe();
  const nova = {
    id:           id || ('NFE-' + Date.now()),
    numero:       document.getElementById('fscNfeNum')?.value?.trim(),
    tipo:         document.getElementById('fscNfeTipo')?.value,
    data_emissao: document.getElementById('fscNfeData')?.value,
    competencia:  document.getElementById('fscNfeComp')?.value?.trim(),
    tomador:      document.getElementById('fscNfeTom')?.value?.trim(),
    valor:        parseFloat(document.getElementById('fscNfeValor')?.value||0),
    status:       document.getElementById('fscNfeStatus')?.value,
    chave:        document.getElementById('fscNfeChave')?.value?.trim(),
    obs:          document.getElementById('fscNfeObs')?.value?.trim(),
  };
  if (!nova.numero) { showToast('Número da NF-e é obrigatório','error'); return; }
  if (id) { const idx = nfe.findIndex(n=>n.id===id); if(idx>=0) nfe[idx]=nova; else nfe.push(nova); }
  else nfe.push(nova);
  _saveFiscalNFe(nfe);
  closeModal();
  showToast('NF-e salva!','success');
  _fscNavAba('nfe');
}

function _fscCancelarNFe(id) {
  if (!confirm('Cancelar esta NF-e?')) return;
  const nfe = _getFiscalNFe();
  const idx = nfe.findIndex(n=>n.id===id);
  if (idx>=0) { nfe[idx].status = 'Cancelada'; _saveFiscalNFe(nfe); }
  showToast('NF-e cancelada','warning');
  _fscNavAba('nfe');
}

// ─── Modal Guia ───────────────────────────────────
function _fscNovaGuia() { _fscModalGuia(); }
function _fscEditarGuia(id) {
  const g = _getFiscalGuias().find(g=>g.id===id);
  if(g) _fscModalGuia(g);
}

function _fscModalGuia(g={}) {
  showModal(g.id?'Editar Guia':'Nova Guia de Imposto', `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="form-group" style="grid-column:1/-1">
        <label>Tributo / Imposto *</label>
        <select class="form-control" id="fscGuiaTrib">
          ${['DAS','DARF – IRPJ','DARF – CSLL','DARF – PIS','DARF – COFINS','GPS – INSS','FGTS','DARF – IRRF','ISS','ICMS','IPI','IOF','Outro'].map(t=>`<option ${g.tributo===t?'selected':''}>${t}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Competência (MM/AAAA)</label>
        <input class="form-control" id="fscGuiaComp" value="${g.competencia||''}" placeholder="04/2025">
      </div>
      <div class="form-group">
        <label>Vencimento</label>
        <input class="form-control" type="date" id="fscGuiaVenc" value="${g.vencimento||''}">
      </div>
      <div class="form-group">
        <label>Valor (R$) *</label>
        <input class="form-control" type="number" id="fscGuiaValor" value="${g.valor||0}" min="0" step="0.01">
      </div>
      <div class="form-group">
        <label>Código de Receita</label>
        <input class="form-control" id="fscGuiaCodRec" value="${g.codigo_receita||''}" placeholder="6291, 0220...">
      </div>
      <div class="form-group">
        <label>CNPJ</label>
        <input class="form-control" id="fscGuiaCNPJ" value="${g.cnpj||''}" placeholder="00.000.000/0001-00">
      </div>
      <div class="form-group">
        <label>Status</label>
        <select class="form-control" id="fscGuiaStatus">
          ${['Pendente','Pago','Vencido','Parcelado'].map(s=>`<option ${g.status===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </div>
      <div class="form-group" style="grid-column:1/-1">
        <label>Observações</label>
        <textarea class="form-control" id="fscGuiaObs" rows="2">${g.obs||''}</textarea>
      </div>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    ${g.id ? `<button class="btn btn-danger" onclick="_fscExcluirGuia('${g.id}')"><i class="fas fa-trash"></i></button>` : ''}
    <button class="btn btn-primary" onclick="_fscSalvarGuia('${g.id||''}')"><i class="fas fa-save"></i> Salvar</button>
  `);
}

function _fscSalvarGuia(id) {
  const guias = _getFiscalGuias();
  const nova = {
    id:             id || ('GUI-' + Date.now()),
    tributo:        document.getElementById('fscGuiaTrib')?.value,
    competencia:    document.getElementById('fscGuiaComp')?.value?.trim(),
    vencimento:     document.getElementById('fscGuiaVenc')?.value,
    valor:          parseFloat(document.getElementById('fscGuiaValor')?.value||0),
    codigo_receita: document.getElementById('fscGuiaCodRec')?.value?.trim(),
    cnpj:           document.getElementById('fscGuiaCNPJ')?.value?.trim(),
    status:         document.getElementById('fscGuiaStatus')?.value,
    obs:            document.getElementById('fscGuiaObs')?.value?.trim(),
  };
  if (id) { const idx = guias.findIndex(g=>g.id===id); if(idx>=0) guias[idx]=nova; else guias.push(nova); }
  else guias.push(nova);
  _saveFiscalGuias(guias);
  closeModal();
  showToast('Guia salva!','success');
  _fscNavAba('guias');
}

function _fscExcluirGuia(id) {
  if (!confirm('Excluir esta guia?')) return;
  _saveFiscalGuias(_getFiscalGuias().filter(g=>g.id!==id));
  closeModal();
  showToast('Excluída','info');
  _fscNavAba('guias');
}

function _fscPagarGuia(id) {
  const guias = _getFiscalGuias();
  const idx = guias.findIndex(g=>g.id===id);
  if (idx>=0) { guias[idx].status='Pago'; guias[idx].data_pagamento = new Date().toISOString().slice(0,10); _saveFiscalGuias(guias); }
  showToast('Guia marcada como paga!','success');
  _fscNavAba('guias');
}

function _fscConfigRegime() { _fscNavAba('parametros'); }

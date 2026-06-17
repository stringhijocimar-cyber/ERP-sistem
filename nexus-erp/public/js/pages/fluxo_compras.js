// =====================================================
// Fraser Alexander ERP – Fluxo Completo de Compras v5.0
// Requisição → Cadastro Material → RC → RFQ → Mapa → PC
// =====================================================

// ─── STORAGE HELPERS ───────────────────────────────────────────────────────
// _getRC / _saveRC: usa 'fa_rcs' como chave principal (padrão do sistema).
// Mantém compatibilidade com 'fa_rc' (legado) via merge na leitura.
function _getRC() {
  try {
    const principal = JSON.parse(localStorage.getItem('fa_rcs') || '[]');
    const legado    = JSON.parse(localStorage.getItem('fa_rc')  || '[]');
    if (!legado.length) return principal;
    // Mescla sem duplicar (prioriza fa_rcs)
    const ids = new Set(principal.map(r => r.id));
    const merged = [...principal, ...legado.filter(r => !ids.has(r.id))];
    // Persiste mergeado para corrigir inconsistência
    if (legado.length) {
      localStorage.setItem('fa_rcs', JSON.stringify(merged));
      localStorage.removeItem('fa_rc'); // limpa chave legada após migração
    }
    return merged;
  } catch(e) { return []; }
}
function _saveRC(d) {
  localStorage.setItem('fa_rcs', JSON.stringify(d));
  // Mantém fa_rc sincronizado para módulos legados ainda não atualizados
  localStorage.setItem('fa_rc', JSON.stringify(d));
}
function _getRFQFlow()  { try { return JSON.parse(localStorage.getItem('fa_rfq_flow') || '[]'); } catch(e) { return []; } }
function _saveRFQFlow(d){ localStorage.setItem('fa_rfq_flow', JSON.stringify(d)); }
function _getMapasComp(){ try { return JSON.parse(localStorage.getItem('fa_mapas_comp') || '[]'); } catch(e) { return []; } }
function _saveMapasComp(d){ localStorage.setItem('fa_mapas_comp', JSON.stringify(d)); }
function _getAprovacaoConfig() {
  try { return JSON.parse(localStorage.getItem('fa_aprovacao_config') || 'null'); } catch(e) { return null; }
}
function _saveAprovacaoConfig(d) { localStorage.setItem('fa_aprovacao_config', JSON.stringify(d)); }
function _getHistoricoCompras() { try { return JSON.parse(localStorage.getItem('fa_historico_compras') || '[]'); } catch(e) { return []; } }
function _saveHistoricoCompras(d) { localStorage.setItem('fa_historico_compras', JSON.stringify(d)); }

// Configuração padrão de aprovação – compatível com novo modelo por processo
function _getConfigAprovacao() {
  const cfg = _getAprovacaoConfig();
  // Mescla com defaults para garantir todos os campos
  const defaults = {
    rc_estagios:   3,
    mapa_estagios: 2,
    estagio1:      { nome: 'Supervisor / Solicitante',   perfis: ['supervisor','operacao'],  usuarios: [] },
    estagio2:      { nome: 'Gestor de Operações',        perfis: ['operacao','admin'],        usuarios: [] },
    estagio3:      { nome: 'Diretor / Gerente Geral',    perfis: ['diretor','admin'],         usuarios: [] },
    comprador:     { nome: 'Comprador (Suprimentos)',    perfis: ['compras','admin'],         usuarios: [] },
    mapa_estagio1: { nome: 'Aprovação Mapa – Operações', perfis: ['operacao','compras','admin'], usuarios: [] },
    mapa_estagio2: { nome: 'Aprovação Mapa – Diretoria', perfis: ['diretor','admin'],             usuarios: [] },
    emissor_pc:    { nome: 'Emissor do Pedido de Compra', perfis: ['compras','admin'],            usuarios: [] },
  };
  if (!cfg) return defaults;
  // Retrocompatibilidade: preenche campos que não existiam na config antiga
  return {
    ...defaults,
    ...cfg,
    estagio1:      { ...defaults.estagio1,      ...(cfg.estagio1||{})      },
    estagio2:      { ...defaults.estagio2,      ...(cfg.estagio2||{})      },
    estagio3:      { ...defaults.estagio3,      ...(cfg.estagio3||{})      },
    comprador:     { ...defaults.comprador,     ...(cfg.comprador||{})     },
    mapa_estagio1: { ...defaults.mapa_estagio1, ...(cfg.mapa_estagio1||{}) },
    mapa_estagio2: { ...defaults.mapa_estagio2, ...(cfg.mapa_estagio2||{}) },
    emissor_pc:    { ...defaults.emissor_pc,    ...(cfg.emissor_pc||{})    },
  };
}

// Gera número RC
function _gerarNumeroRC() {
  const lista = _getRC();
  return `RC-${new Date().getFullYear()}-${String(lista.length + 1).padStart(4,'0')}`;
}

// Gera número RFQ
function _gerarNumeroRFQ() {
  const lista = _getRFQFlow();
  return `RFQ-${new Date().getFullYear()}-${String(lista.length + 1).padStart(4,'0')}`;
}

// ─── TELA PRINCIPAL: FLUXO DE COMPRAS ─────────────────────────────────────
// ════════════════════════════════════════════════════════════════════════════
// FLUXO DE APROVAÇÃO DE COMPRAS
// Painel exclusivo para acompanhar e executar as aprovações de cada etapa.
// Criação de RC → Suprimentos | RFQ → Cotações | Mapa → Mapa Comparativo
// Pedido de Compra → Pedidos de Compra (cada ação na sua aba própria)
// ════════════════════════════════════════════════════════════════════════════
function renderFluxoCompras() {
  const isSup = currentUser && ['admin','supervisor','operacao','diretor','compras'].includes(currentUser.profile);
  if (!isSup) { renderAcessoNegado && renderAcessoNegado(); return; }

  const rcs    = _getRC();
  const mapas  = _getMapasComp();
  const pedidos = (typeof _getPedidos === 'function' ? _getPedidos() : []);
  const cfg    = _getConfigAprovacao();

  // Contadores por processo
  const p1_pendentes = rcs.filter(r => r.status === 'Aguardando Aprovação').length;
  const p2_pendentes = rcs.filter(r => r.status === 'Aprovada – Aguardando Comprador').length;
  const p3_pendentes = mapas.filter(m => m.status === 'Aguardando Aprovação').length;
  const p4_pendentes = mapas.filter(m => m.status === 'Aprovado').length; // mapa aprovado aguarda emissão PC

  const totalPendente = p1_pendentes + p2_pendentes + p3_pendentes + p4_pendentes;

  document.getElementById('mainContent').innerHTML = `
    <div class="page-header">
      <div class="page-title">
        <h2><i class="fas fa-tasks" style="color:var(--orange);margin-right:8px"></i>Fluxo de Aprovação de Compras</h2>
        <p>Acompanhamento e execução dos processos de aprovação · ${totalPendente > 0 ? `<span style="color:var(--orange);font-weight:700">${totalPendente} pendência(s)</span>` : '<span style="color:var(--green-light)">Sem pendências</span>'}</p>
      </div>
      <div class="page-actions">
        ${currentUser?.profile === 'admin' ? `
          <button class="btn btn-secondary btn-sm" onclick="abrirConfigAprovacao()">
            <i class="fas fa-sliders-h"></i> Configurar Aprovadores
          </button>` : ''}
      </div>
    </div>

    <!-- AVISO: Esta aba é apenas para aprovações -->
    <div style="background:rgba(0,180,184,0.07);border:1px solid rgba(0,180,184,0.25);border-radius:10px;padding:12px 16px;margin-bottom:20px;display:flex;align-items:center;gap:12px">
      <i class="fas fa-info-circle" style="color:var(--fa-teal);font-size:18px;flex-shrink:0"></i>
      <div style="font-size:12px;color:var(--text-secondary)">
        <strong style="color:var(--fa-teal)">Aba de Aprovações.</strong>
        Aqui você aprova ou rejeita demandas de cada etapa do processo de compras.
        Para <strong>criar uma Requisição</strong>, acesse <a href="#" onclick="navigate('requisicoes')" style="color:var(--fa-teal)">Emissão de Requisições</a> · 
        <strong>Cotações</strong>: <a href="#" onclick="navigate('rfq')" style="color:var(--fa-teal)">Cotações (RFQ)</a> ·
        <strong>Mapa</strong>: <a href="#" onclick="navigate('mapa_cotacao')" style="color:var(--fa-teal)">Mapa Comparativo</a> ·
        <strong>Pedido</strong>: <a href="#" onclick="navigate('pedidos')" style="color:var(--fa-teal)">Pedidos de Compra</a>
      </div>
    </div>

    <!-- Fluxograma visual dos 4 processos -->
    <div class="card" style="margin-bottom:20px">
      <div style="padding:16px 20px 8px;font-size:11px;font-weight:700;color:var(--text-muted);letter-spacing:0.5px;text-transform:uppercase">Processos de Aprovação</div>
      <div style="padding:0 20px 20px;display:flex;gap:0;overflow-x:auto;min-width:700px">
        ${[
          { num:1, icon:'fa-file-alt',      label:'Aprovação da RC',       sub:'OC gera Requisição',         color:'#f59e0b', count: p1_pendentes, tab:'processo1' },
          { num:2, icon:'fa-user-check',    label:'Aceite do Comprador',   sub:'Comprador aceita a RC',       color:'#3b82f6', count: p2_pendentes, tab:'processo2' },
          { num:3, icon:'fa-balance-scale', label:'Aprovação do Mapa',     sub:'Mapa Comparativo',            color:'#8b5cf6', count: p3_pendentes, tab:'processo3' },
          { num:4, icon:'fa-shopping-bag',  label:'Emissão do Pedido',     sub:'PC a partir do Mapa aprovado',color:'#10b981', count: p4_pendentes, tab:'processo4' }
        ].map((s, i, arr) => `
          <div style="flex:1;text-align:center;position:relative;padding:0 8px;cursor:pointer" onclick="switchFluxoTab('${s.tab}')">
            <div style="width:52px;height:52px;border:2px solid ${s.count>0?s.color:'var(--border-color)'};background:${s.count>0?s.color+'18':'rgba(255,255,255,0.04)'};border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 8px;transition:all 0.2s">
              <i class="fas ${s.icon}" style="color:${s.count>0?s.color:'var(--text-muted)'};font-size:20px"></i>
            </div>
            ${s.count>0 ? `<div style="position:absolute;top:0;right:calc(50% - 32px);background:${s.color};color:#fff;border-radius:10px;padding:1px 7px;font-size:10px;font-weight:700;min-width:20px">${s.count}</div>` : ''}
            <div style="font-size:11px;font-weight:700;color:${s.count>0?s.color:'var(--text-secondary)'}">${s.label}</div>
            <div style="font-size:10px;color:var(--text-muted);margin-top:2px">${s.sub}</div>
            ${i < arr.length-1 ? `<div style="position:absolute;top:24px;right:-6px;color:var(--text-muted);font-size:20px;z-index:1">›</div>` : ''}
          </div>
        `).join('')}
      </div>
    </div>

    <!-- KPIs resumo -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px">
      <div class="kpi-card kpi-yellow" onclick="switchFluxoTab('processo1')" style="cursor:pointer">
        <div class="kpi-icon"><i class="fas fa-file-alt"></i></div>
        <div class="kpi-value">${p1_pendentes}</div>
        <div class="kpi-label">RCs aguardando aprovação</div>
      </div>
      <div class="kpi-card kpi-blue" onclick="switchFluxoTab('processo2')" style="cursor:pointer">
        <div class="kpi-icon"><i class="fas fa-user-check"></i></div>
        <div class="kpi-value">${p2_pendentes}</div>
        <div class="kpi-label">RCs aguardando comprador</div>
      </div>
      <div class="kpi-card" onclick="switchFluxoTab('processo3')" style="cursor:pointer;background:rgba(139,92,246,0.08);border-color:rgba(139,92,246,0.25)">
        <div class="kpi-icon" style="color:#8b5cf6"><i class="fas fa-balance-scale"></i></div>
        <div class="kpi-value" style="color:#8b5cf6">${p3_pendentes}</div>
        <div class="kpi-label">Mapas aguardando aprovação</div>
      </div>
      <div class="kpi-card kpi-green" onclick="switchFluxoTab('processo4')" style="cursor:pointer">
        <div class="kpi-icon"><i class="fas fa-shopping-bag"></i></div>
        <div class="kpi-value">${p4_pendentes}</div>
        <div class="kpi-label">Mapas aprovados – emitir PC</div>
      </div>
    </div>

    <!-- Card principal com abas por processo -->
    <div class="card">
      <div style="display:flex;gap:0;border-bottom:1px solid var(--border-color);overflow-x:auto">
        ${[
          { id:'processo1', icon:'fa-file-alt',      label:'1. Aprovação da RC',     count: p1_pendentes },
          { id:'processo2', icon:'fa-user-check',    label:'2. Aceite do Comprador', count: p2_pendentes },
          { id:'processo3', icon:'fa-balance-scale', label:'3. Aprovação do Mapa',   count: p3_pendentes },
          { id:'processo4', icon:'fa-shopping-bag',  label:'4. Emissão do Pedido',   count: p4_pendentes },
          { id:'historico', icon:'fa-history',       label:'Histórico',              count: 0 }
        ].map((t, i) => `
          <button onclick="switchFluxoTab('${t.id}')" id="fluxo-tab-${t.id}"
            style="padding:12px 16px;border:none;background:${i===0?'var(--bg-tertiary)':'transparent'};
                   color:${i===0?'var(--fa-teal)':'var(--text-secondary)'};font-weight:${i===0?'700':'400'};
                   border-bottom:${i===0?'2px solid var(--fa-teal)':'2px solid transparent'};
                   cursor:pointer;font-size:12px;white-space:nowrap;flex-shrink:0;transition:all 0.15s">
            <i class="fas ${t.icon}" style="margin-right:5px"></i>${t.label}
            ${t.count>0 ? `<span style="background:var(--orange);color:#fff;border-radius:10px;padding:1px 7px;font-size:10px;font-weight:700;margin-left:5px">${t.count}</span>` : ''}
          </button>
        `).join('')}
      </div>
      <div id="fluxo-tab-content" style="padding:0">
        ${_renderProcesso1(rcs)}
      </div>
    </div>
  `;
}

function switchFluxoTab(tab) {
  // Compatibilidade: redirecionar tabs antigas para processos corretos
  const tabMap = {
    'rc':    'processo1',
    'rfq':   'processo2',  // rfq → Aceite do Comprador (processo2) ou recarrega processo1
    'mapa':  'processo3',
    'pedidos': 'processo4',
    'historico': 'historico'
  };
  const resolvedTab = tabMap[tab] || tab;

  ['processo1','processo2','processo3','processo4','historico'].forEach(t => {
    const btn = document.getElementById(`fluxo-tab-${t}`);
    if (!btn) return;
    const active = t === resolvedTab;
    btn.style.background    = active ? 'var(--bg-tertiary)' : 'transparent';
    btn.style.color         = active ? 'var(--fa-teal)'     : 'var(--text-secondary)';
    btn.style.fontWeight    = active ? '700' : '400';
    btn.style.borderBottom  = active ? '2px solid var(--fa-teal)' : '2px solid transparent';
  });
  const content = document.getElementById('fluxo-tab-content');
  if (!content) return;
  const rcs   = _getRC();
  const mapas = _getMapasComp();
  if      (resolvedTab === 'processo1') content.innerHTML = _renderProcesso1(rcs);
  else if (resolvedTab === 'processo2') content.innerHTML = _renderProcesso2(rcs);
  else if (resolvedTab === 'processo3') content.innerHTML = _renderProcesso3(mapas);
  else if (resolvedTab === 'processo4') content.innerHTML = _renderProcesso4(mapas);
  else if (resolvedTab === 'historico') content.innerHTML = _renderTabHistorico(_getHistoricoCompras());
}

// ─── PROCESSO 1: Aprovação da RC (OC → Requisição) ────────────────────────
function _renderProcesso1(rcs) {
  const cfg = _getConfigAprovacao();
  const pendentes   = rcs.filter(r => r.status === 'Aguardando Aprovação' || r.status?.includes('Aguardando Estágio'));
  const aprovadas   = rcs.filter(r => ['Aprovada – Aguardando Comprador','RFQ Criado','Em Cotação','Mapa Criado','PC Emitido'].includes(r.status));
  const rejeitadas  = rcs.filter(r => r.status === 'Rejeitada');

  return `
    <div style="padding:18px">
      <!-- Descrição do processo -->
      <div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.25);border-radius:10px;padding:14px;margin-bottom:18px">
        <div style="font-size:13px;font-weight:700;color:#f59e0b;margin-bottom:8px">
          <i class="fas fa-file-alt" style="margin-right:6px"></i>Processo 1 – Aprovação da Requisição de Compra (RC)
        </div>
        <div style="font-size:12px;color:var(--text-secondary);margin-bottom:10px">
          Uma OC (Ordem de Compra interna) gera uma Requisição de Compra que precisa ser aprovada em ${cfg.rc_estagios||3} estágio(s) antes de seguir para o Comprador.
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          ${_renderFluxoEstagiosPill(cfg, 'rc')}
          <span style="font-size:11px;color:var(--text-muted);margin-left:4px">→ Comprador</span>
        </div>
      </div>

      <!-- Pendentes de aprovação -->
      ${pendentes.length > 0 ? `
        <div style="margin-bottom:16px">
          <div style="font-size:12px;font-weight:700;color:#f59e0b;margin-bottom:10px;display:flex;align-items:center;gap:6px">
            <i class="fas fa-clock"></i> ${pendentes.length} RC(s) aguardando sua aprovação
          </div>
          ${pendentes.map(r => `
            <div style="display:flex;align-items:center;gap:10px;padding:12px;background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.2);border-radius:10px;margin-bottom:8px">
              <div style="flex:1;min-width:0">
                <div style="font-size:13px;font-weight:700;color:var(--text-primary)">${r.numero} – ${r.titulo}</div>
                <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${r.solicitante} · ${fmtDate(r.data_criacao)} · ${r.itens?.length||0} itens · ${fmt(r.valor_total)}</div>
                <div style="margin-top:6px;display:flex;align-items:center;gap:6px">
                  <span style="font-size:10px;color:var(--text-muted)">Estágio:</span>
                  ${_renderAprovacaoMini(r)}
                  <span style="font-size:10px;font-weight:700;color:#f59e0b">${r.estagio_atual||1}/${r.total_estagios||cfg.rc_estagios||3}</span>
                </div>
              </div>
              <div style="display:flex;gap:6px;flex-shrink:0">
                <button onclick="verDetalheRC('${r.id}')" class="btn btn-secondary btn-sm btn-icon" title="Ver detalhes"><i class="fas fa-eye"></i></button>
                ${_podeAprovarRC(r) ? `
                  <button onclick="abrirAprovarRC('${r.id}')" class="btn btn-success btn-sm"><i class="fas fa-check"></i> Aprovar</button>
                  <button onclick="reprovarRC('${r.id}')" class="btn btn-danger btn-sm btn-icon" title="Reprovar"><i class="fas fa-times"></i></button>
                ` : `<span style="font-size:11px;color:var(--text-muted);padding:4px 8px">Aguardando aprovador do estágio ${r.estagio_atual||1}</span>`}
              </div>
            </div>
          `).join('')}
        </div>
      ` : `
        <div style="background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.2);border-radius:10px;padding:14px;margin-bottom:16px;display:flex;align-items:center;gap:10px">
          <i class="fas fa-check-circle" style="color:#22c55e;font-size:18px"></i>
          <span style="font-size:13px;color:var(--text-secondary)">Nenhuma RC pendente de aprovação.</span>
        </div>
      `}

      <!-- Aprovadas / Em andamento -->
      ${aprovadas.length > 0 ? `
        <div style="margin-top:16px">
          <div style="font-size:11px;font-weight:700;color:var(--text-muted);letter-spacing:0.5px;text-transform:uppercase;margin-bottom:8px">RCs aprovadas / em andamento</div>
          <div style="overflow-x:auto">
            <table style="width:100%;border-collapse:collapse;font-size:12px">
              <thead><tr style="background:var(--bg-tertiary)">
                <th style="padding:8px 10px;text-align:left;font-size:11px;color:var(--text-muted)">Número</th>
                <th style="padding:8px 10px;text-align:left;font-size:11px;color:var(--text-muted)">Título</th>
                <th style="padding:8px 10px;text-align:left;font-size:11px;color:var(--text-muted)">Solicitante</th>
                <th style="padding:8px 10px;text-align:right;font-size:11px;color:var(--text-muted)">Valor</th>
                <th style="padding:8px 10px;text-align:center;font-size:11px;color:var(--text-muted)">Status</th>
                <th style="padding:8px 10px;text-align:center;font-size:11px;color:var(--text-muted)">Ações</th>
              </tr></thead>
              <tbody>
                ${aprovadas.map(r => `
                  <tr style="border-bottom:1px solid var(--border-color)">
                    <td style="padding:8px 10px;font-weight:700;color:var(--orange)">${r.numero}</td>
                    <td style="padding:8px 10px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.titulo}</td>
                    <td style="padding:8px 10px;color:var(--text-muted)">${r.solicitante}</td>
                    <td style="padding:8px 10px;text-align:right;font-weight:600">${fmt(r.valor_total)}</td>
                    <td style="padding:8px 10px;text-align:center">${_rcStatusBadge(r.status)}</td>
                    <td style="padding:8px 10px;text-align:center">
                      <button onclick="verDetalheRC('${r.id}')" class="btn btn-secondary btn-sm btn-icon"><i class="fas fa-eye"></i></button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      ` : ''}

      ${rejeitadas.length > 0 ? `
        <div style="margin-top:16px">
          <div style="font-size:11px;font-weight:700;color:#ef4444;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:8px">RCs rejeitadas</div>
          ${rejeitadas.map(r => `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.2);border-radius:8px;margin-bottom:6px">
              <div>
                <span style="font-weight:700;color:#ef4444">${r.numero}</span>
                <span style="color:var(--text-secondary);margin:0 8px">–</span>
                <span>${r.titulo}</span>
                <span style="font-size:11px;color:var(--text-muted);margin-left:8px">${r.solicitante}</span>
              </div>
              <button onclick="verDetalheRC('${r.id}')" class="btn btn-secondary btn-sm btn-icon"><i class="fas fa-eye"></i></button>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

// ─── PROCESSO 2: Aceite do Comprador ────────────────────────────────────────
function _renderProcesso2(rcs) {
  const cfg = _getConfigAprovacao();
  const isCompras = currentUser && ['admin','compras','diretor'].includes(currentUser.profile);
  const pendentes = rcs.filter(r => r.status === 'Aprovada – Aguardando Comprador');
  const emProcesso = rcs.filter(r => ['RFQ Criado','Em Cotação','Mapa Criado','PC Emitido'].includes(r.status));

  return `
    <div style="padding:18px">
      <div style="background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.25);border-radius:10px;padding:14px;margin-bottom:18px">
        <div style="font-size:13px;font-weight:700;color:#3b82f6;margin-bottom:8px">
          <i class="fas fa-user-check" style="margin-right:6px"></i>Processo 2 – Aceite do Comprador
        </div>
        <div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px">
          Após a RC ser aprovada em todos os estágios, o <strong>${cfg.comprador?.nome || 'Comprador (Suprimentos)'}</strong> deve aceitar ou rejeitar a RC e iniciar o processo de cotação.
        </div>
        <div style="font-size:11px;color:var(--text-muted)">
          <i class="fas fa-users" style="margin-right:4px"></i>Responsável: <strong>${cfg.comprador?.nome || 'Comprador'}</strong>
          ${(cfg.comprador?.perfis||['compras','admin']).map(p => `<span style="background:rgba(59,130,246,0.15);color:#3b82f6;border-radius:4px;padding:1px 6px;font-size:10px;font-weight:600;margin-left:4px">${p}</span>`).join('')}
        </div>
      </div>

      ${!isCompras ? `
        <div style="padding:14px;background:var(--bg-secondary);border-radius:10px;text-align:center;color:var(--text-muted);font-size:13px">
          <i class="fas fa-lock" style="margin-right:6px"></i>Apenas o perfil <strong>Compras / Admin / Diretor</strong> pode executar ações neste processo.
        </div>
      ` : pendentes.length === 0 ? `
        <div style="background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.2);border-radius:10px;padding:14px;display:flex;align-items:center;gap:10px">
          <i class="fas fa-check-circle" style="color:#22c55e;font-size:18px"></i>
          <span style="font-size:13px;color:var(--text-secondary)">Nenhuma RC aguardando aceite do comprador.</span>
        </div>
      ` : `
        <div style="margin-bottom:16px">
          <div style="font-size:12px;font-weight:700;color:#3b82f6;margin-bottom:10px;display:flex;align-items:center;gap:6px">
            <i class="fas fa-inbox"></i> ${pendentes.length} RC(s) aguardando seu aceite
          </div>
          ${pendentes.map(r => `
            <div style="display:flex;align-items:center;gap:10px;padding:12px;background:rgba(59,130,246,0.06);border:1px solid rgba(59,130,246,0.2);border-radius:10px;margin-bottom:8px">
              <div style="flex:1;min-width:0">
                <div style="font-size:13px;font-weight:700;color:var(--text-primary)">${r.numero} – ${r.titulo}</div>
                <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${r.solicitante} · ${r.itens?.length||0} itens · ${fmt(r.valor_total)}</div>
                ${r.prioridade ? `<span style="font-size:10px;font-weight:700;background:rgba(245,158,11,0.15);color:#f59e0b;padding:1px 7px;border-radius:5px;margin-top:4px;display:inline-block">Prioridade: ${r.prioridade}</span>` : ''}
              </div>
              <div style="display:flex;gap:6px;flex-shrink:0">
                <button onclick="verDetalheRC('${r.id}')" class="btn btn-secondary btn-sm btn-icon" title="Ver detalhes"><i class="fas fa-eye"></i></button>
                <button onclick="acaoCompradorRC('${r.id}')" class="btn btn-primary btn-sm"><i class="fas fa-play"></i> Processar</button>
              </div>
            </div>
          `).join('')}
        </div>
      `}

      ${emProcesso.length > 0 ? `
        <div style="margin-top:16px">
          <div style="font-size:11px;font-weight:700;color:var(--text-muted);letter-spacing:0.5px;text-transform:uppercase;margin-bottom:8px">Em processo (pós aceite)</div>
          ${emProcesso.map(r => `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:var(--bg-secondary);border-radius:8px;margin-bottom:6px;border:1px solid var(--border-color)">
              <div>
                <span style="font-weight:700;color:var(--orange)">${r.numero}</span>
                <span style="color:var(--text-secondary);margin:0 8px">–</span>${r.titulo}
                <span style="font-size:11px;color:var(--text-muted);margin-left:8px">${r.solicitante}</span>
              </div>
              <div style="display:flex;align-items:center;gap:8px">
                ${_rcStatusBadge(r.status)}
                <button onclick="verDetalheRC('${r.id}')" class="btn btn-secondary btn-sm btn-icon"><i class="fas fa-eye"></i></button>
              </div>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

// ─── PROCESSO 3: Aprovação do Mapa Comparativo ────────────────────────────
function _renderProcesso3(mapas) {
  const cfg = _getConfigAprovacao();
  const pendentes  = mapas.filter(m => m.status === 'Aguardando Aprovação');
  const aprovados  = mapas.filter(m => m.status === 'Aprovado');
  const rejeitados = mapas.filter(m => m.status === 'Rejeitado');

  return `
    <div style="padding:18px">
      <div style="background:rgba(139,92,246,0.08);border:1px solid rgba(139,92,246,0.25);border-radius:10px;padding:14px;margin-bottom:18px">
        <div style="font-size:13px;font-weight:700;color:#8b5cf6;margin-bottom:8px">
          <i class="fas fa-balance-scale" style="margin-right:6px"></i>Processo 3 – Aprovação do Mapa Comparativo
        </div>
        <div style="font-size:12px;color:var(--text-secondary);margin-bottom:10px">
          Após as cotações serem registradas, o Mapa Comparativo precisa ser aprovado antes da emissão do Pedido de Compra.
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          ${_renderFluxoEstagiosPill(cfg, 'mapa')}
        </div>
      </div>

      ${pendentes.length === 0 ? `
        <div style="background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.2);border-radius:10px;padding:14px;display:flex;align-items:center;gap:10px;margin-bottom:16px">
          <i class="fas fa-check-circle" style="color:#22c55e;font-size:18px"></i>
          <span style="font-size:13px;color:var(--text-secondary)">Nenhum Mapa Comparativo aguardando aprovação.</span>
        </div>
      ` : `
        <div style="margin-bottom:16px">
          <div style="font-size:12px;font-weight:700;color:#8b5cf6;margin-bottom:10px;display:flex;align-items:center;gap:6px">
            <i class="fas fa-clock"></i> ${pendentes.length} Mapa(s) aguardando aprovação
          </div>
          ${pendentes.map(m => `
            <div style="display:flex;align-items:center;gap:10px;padding:12px;background:rgba(139,92,246,0.06);border:1px solid rgba(139,92,246,0.2);border-radius:10px;margin-bottom:8px">
              <div style="flex:1;min-width:0">
                <div style="font-size:13px;font-weight:700;color:var(--text-primary)">${m.numero} – ${m.titulo||m.rfq_numero}</div>
                <div style="font-size:11px;color:var(--text-muted);margin-top:2px">Fornecedor selecionado: <strong>${m.fornecedor_selecionado||'—'}</strong> · ${fmt(m.valor_selecionado||0)} · ${m.criterio||'Menor Preço'}</div>
                <div style="margin-top:6px;display:flex;align-items:center;gap:6px">
                  ${_renderAprovacaoMapaMini(m)}
                  <span style="font-size:10px;font-weight:700;color:#8b5cf6">Estágio ${m.estagio_aprovacao||1}</span>
                </div>
              </div>
              <div style="display:flex;gap:6px;flex-shrink:0">
                <button onclick="verDetalheMapa2('${m.id}')" class="btn btn-secondary btn-sm btn-icon" title="Ver mapa"><i class="fas fa-eye"></i></button>
                ${_podeAprovarMapa(m) ? `
                  <button onclick="aprovarMapa2('${m.id}')" class="btn btn-success btn-sm"><i class="fas fa-check"></i> Aprovar</button>
                  <button onclick="rejeitarMapa2('${m.id}')" class="btn btn-danger btn-sm btn-icon" title="Rejeitar"><i class="fas fa-times"></i></button>
                ` : `<span style="font-size:11px;color:var(--text-muted);padding:4px 8px">Aguardando aprovador do estágio ${m.estagio_aprovacao||1}</span>`}
              </div>
            </div>
          `).join('')}
        </div>
      `}

      ${aprovados.length > 0 ? `
        <div style="margin-top:4px">
          <div style="font-size:11px;font-weight:700;color:var(--text-muted);letter-spacing:0.5px;text-transform:uppercase;margin-bottom:8px">Mapas aprovados (aguardando emissão de PC)</div>
          ${aprovados.map(m => `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.15);border-radius:8px;margin-bottom:6px">
              <div>
                <span style="font-weight:700;color:#22c55e">${m.numero}</span>
                <span style="color:var(--text-secondary);margin:0 8px">–</span>
                ${m.titulo||m.rfq_numero}
                <span style="font-size:11px;color:var(--text-muted);margin-left:8px">${m.fornecedor_selecionado||'—'} · ${fmt(m.valor_selecionado||0)}</span>
              </div>
              <div style="display:flex;gap:6px;align-items:center">
                ${_mapaBadge(m.status)}
                <button onclick="verDetalheMapa2('${m.id}')" class="btn btn-secondary btn-sm btn-icon"><i class="fas fa-eye"></i></button>
                <button onclick="navigate('pedidos')" class="btn btn-sm" title="Ir para Pedidos de Compra para emitir o PC" style="background:rgba(59,130,246,0.1);color:#3b82f6;border:1px solid rgba(59,130,246,0.3);font-size:11px"><i class="fas fa-arrow-right" style="margin-right:4px"></i>Ir p/ Pedidos</button>
              </div>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

// ─── PROCESSO 4: Emissão do Pedido de Compra ────────────────────────────────
function _renderProcesso4(mapas) {
  const cfg = _getConfigAprovacao();
  const aptos   = mapas.filter(m => m.status === 'Aprovado');
  const emitidos = mapas.filter(m => m.status === 'PC Emitido');
  const isCompras = currentUser && ['admin','compras','diretor'].includes(currentUser.profile);

  return `
    <div style="padding:18px">
      <div style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.25);border-radius:10px;padding:14px;margin-bottom:18px">
        <div style="font-size:13px;font-weight:700;color:#10b981;margin-bottom:8px">
          <i class="fas fa-shopping-bag" style="margin-right:6px"></i>Processo 4 – Emissão do Pedido de Compra (PC)
        </div>
        <div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px">
          Após o Mapa Comparativo ser aprovado, o <strong>${cfg.emissor_pc?.nome || 'Comprador (Suprimentos)'}</strong> emite o Pedido de Compra formal para o fornecedor selecionado.
        </div>
        <div style="font-size:11px;color:var(--text-muted)">
          <i class="fas fa-users" style="margin-right:4px"></i>Responsável: <strong>${cfg.emissor_pc?.nome || 'Comprador'}</strong>
          ${(cfg.emissor_pc?.perfis||['compras','admin']).map(p => `<span style="background:rgba(16,185,129,0.15);color:#10b981;border-radius:4px;padding:1px 6px;font-size:10px;font-weight:600;margin-left:4px">${p}</span>`).join('')}
        </div>
      </div>

      ${!isCompras ? `
        <div style="padding:14px;background:var(--bg-secondary);border-radius:10px;text-align:center;color:var(--text-muted);font-size:13px">
          <i class="fas fa-lock" style="margin-right:6px"></i>Apenas o perfil <strong>Compras / Admin / Diretor</strong> pode emitir pedidos de compra.
        </div>
      ` : aptos.length === 0 ? `
        <div style="background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.2);border-radius:10px;padding:14px;display:flex;align-items:center;gap:10px">
          <i class="fas fa-check-circle" style="color:#22c55e;font-size:18px"></i>
          <span style="font-size:13px;color:var(--text-secondary)">Nenhum Mapa aprovado aguardando emissão de PC.</span>
        </div>
      ` : `
        <div style="margin-bottom:16px">
          <div style="font-size:12px;font-weight:700;color:#10b981;margin-bottom:10px;display:flex;align-items:center;gap:6px">
            <i class="fas fa-file-export"></i> ${aptos.length} Mapa(s) aprovado(s) – pronto(s) para emissão de PC
          </div>
          ${aptos.map(m => `
            <div style="display:flex;align-items:center;gap:10px;padding:12px;background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.2);border-radius:10px;margin-bottom:8px">
              <div style="flex:1;min-width:0">
                <div style="font-size:13px;font-weight:700;color:var(--text-primary)">${m.numero} – ${m.titulo||m.rfq_numero}</div>
                <div style="font-size:11px;color:var(--text-muted);margin-top:2px">
                  Fornecedor: <strong>${m.fornecedor_selecionado||'—'}</strong> · Valor: <strong style="color:#10b981">${fmt(m.valor_selecionado||0)}</strong> · Critério: ${m.criterio||'Menor Preço'}
                </div>
              </div>
              <div style="display:flex;gap:6px;flex-shrink:0">
                <button onclick="verDetalheMapa2('${m.id}')" class="btn btn-secondary btn-sm btn-icon" title="Ver mapa"><i class="fas fa-eye"></i></button>
                <button onclick="navigate('pedidos')" class="btn btn-sm" title="Ir para aba Pedidos de Compra para emitir o PC" style="background:rgba(59,130,246,0.12);color:#3b82f6;border:1px solid rgba(59,130,246,0.35);font-size:12px;padding:7px 14px;border-radius:7px;font-weight:600">
                  <i class="fas fa-arrow-right" style="margin-right:5px"></i>Emitir na aba Pedidos
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      `}

      ${emitidos.length > 0 ? `
        <div style="margin-top:16px">
          <div style="font-size:11px;font-weight:700;color:var(--text-muted);letter-spacing:0.5px;text-transform:uppercase;margin-bottom:8px">PCs já emitidos (deste fluxo)</div>
          ${emitidos.slice(0,5).map(m => `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:var(--bg-secondary);border-radius:8px;margin-bottom:6px;border:1px solid var(--border-color)">
              <div>
                <span style="font-weight:700;color:var(--orange)">${m.pc_numero||m.numero}</span>
                <span style="color:var(--text-secondary);margin:0 8px">–</span>
                ${m.fornecedor_selecionado||'—'} · ${fmt(m.valor_selecionado||0)}
              </div>
              <div style="display:flex;gap:6px;align-items:center">
                <span style="font-size:10px;font-weight:700;background:rgba(16,185,129,0.15);color:#10b981;padding:2px 8px;border-radius:6px">PC Emitido</span>
                <button onclick="navigate('pedidos')" class="btn btn-secondary btn-sm btn-icon" title="Ver pedidos"><i class="fas fa-external-link-alt"></i></button>
              </div>
            </div>
          `).join('')}
          <div style="text-align:right;margin-top:8px">
            <button onclick="navigate('pedidos')" class="btn btn-secondary btn-sm"><i class="fas fa-external-link-alt"></i> Ver todos os Pedidos de Compra</button>
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

// ─── HELPER: Pílulas de estágios do fluxo ────────────────────────────────────
function _renderFluxoEstagiosPill(cfg, tipo) {
  const estagios = tipo === 'rc'
    ? [cfg.estagio1, cfg.estagio2, cfg.estagio3].filter(Boolean)
    : [cfg.mapa_estagio1, cfg.mapa_estagio2].filter(Boolean);
  if (!estagios.length) {
    return `<span style="font-size:11px;color:var(--text-muted)">Aprovação padrão</span>`;
  }
  return estagios.map((e, i) => `
    <span style="display:inline-flex;align-items:center;gap:4px;background:rgba(0,180,184,0.12);border:1px solid rgba(0,180,184,0.25);border-radius:6px;padding:3px 10px;font-size:11px;font-weight:600;color:var(--fa-teal)">
      <span style="width:16px;height:16px;background:var(--fa-teal);border-radius:50%;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:9px;font-weight:700">${i+1}</span>
      ${e.nome||('Estágio '+(i+1))}
      ${e.usuarios?.length ? `<span style="font-size:10px;opacity:0.7">(${e.usuarios.join(', ')})</span>` : ''}
    </span>
    ${i < estagios.length-1 ? '<span style="color:var(--text-muted)">›</span>' : ''}
  `).join('');
}

// ─── TAB: REQUISIÇÕES DE COMPRA ────────────────────────────────────────────
function _renderTabRC(lista) {
  const isCompras = currentUser && ['admin','compras','diretor'].includes(currentUser.profile);
  const isGestor  = currentUser && ['admin','operacao','diretor'].includes(currentUser.profile);

  // Separar por status
  const aguardando = lista.filter(r => r.status === 'Aguardando Aprovação' || r.status.includes('Aguardando Estágio'));
  const aprovadas  = lista.filter(r => r.status === 'Aprovada – Aguardando Comprador');
  const emProcesso = lista.filter(r => ['RFQ Criado','Em Cotação','Mapa Criado','PC Emitido'].includes(r.status));
  const rejeitadas = lista.filter(r => r.status === 'Rejeitada');
  const todos = lista;

  return `
    <div style="padding:16px">
      <!-- Alertas para aprovadores -->
      ${aguardando.length > 0 ? `
        <div style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);border-radius:10px;padding:14px;margin-bottom:16px">
          <div style="font-size:13px;font-weight:700;color:var(--yellow-light);margin-bottom:10px"><i class="fas fa-clock" style="margin-right:6px"></i>${aguardando.length} RC(s) aguardando aprovação</div>
          ${aguardando.slice(0,3).map(r => `
            <div style="display:flex;align-items:center;gap:10px;padding:8px;background:rgba(0,0,0,0.2);border-radius:8px;margin-bottom:6px">
              <div style="flex:1">
                <div style="font-size:12px;font-weight:600;color:var(--text-primary)">${r.numero} – ${r.titulo}</div>
                <div style="font-size:11px;color:var(--text-muted)">${r.solicitante} · ${fmtDate(r.data_criacao)} · Estágio ${r.estagio_atual||1}/${r.total_estagios||3}</div>
              </div>
              <div style="font-size:11px;font-weight:700;color:var(--fa-teal)">${fmt(r.valor_total)}</div>
              ${_podeAprovarRC(r) ? `<button onclick="abrirAprovarRC('${r.id}')" class="btn btn-success btn-sm"><i class="fas fa-check"></i> Aprovar</button>` : ''}
              <button onclick="verDetalheRC('${r.id}')" class="btn btn-secondary btn-sm btn-icon"><i class="fas fa-eye"></i></button>
            </div>
          `).join('')}
        </div>
      ` : ''}

      <!-- RC aprovadas aguardando comprador -->
      ${isCompras && aprovadas.length > 0 ? `
        <div style="background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.3);border-radius:10px;padding:14px;margin-bottom:16px">
          <div style="font-size:13px;font-weight:700;color:var(--blue-light);margin-bottom:10px"><i class="fas fa-inbox" style="margin-right:6px"></i>${aprovadas.length} RC(s) aprovadas – aguardando ação do Comprador</div>
          ${aprovadas.slice(0,3).map(r => `
            <div style="display:flex;align-items:center;gap:10px;padding:8px;background:rgba(0,0,0,0.2);border-radius:8px;margin-bottom:6px">
              <div style="flex:1">
                <div style="font-size:12px;font-weight:600;color:var(--text-primary)">${r.numero} – ${r.titulo}</div>
                <div style="font-size:11px;color:var(--text-muted)">${r.solicitante} · ${r.itens?.length || 0} itens · ${fmt(r.valor_total)}</div>
              </div>
              <button onclick="acaoCompradorRC('${r.id}')" class="btn btn-primary btn-sm"><i class="fas fa-play"></i> Processar</button>
              <button onclick="verDetalheRC('${r.id}')" class="btn btn-secondary btn-sm btn-icon"><i class="fas fa-eye"></i></button>
            </div>
          `).join('')}
        </div>
      ` : ''}

      <!-- Tabela completa -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div style="display:flex;gap:8px">
          <input type="text" id="searchRC" placeholder="Buscar RC..." oninput="filtrarRC()" style="padding:7px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;width:200px">
          <select id="filterRCStatus" onchange="filtrarRC()" style="padding:7px 10px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:12px">
            <option value="">Todos os Status</option>
            <option>Rascunho</option>
            <option>Aguardando Aprovação</option>
            <option>Aprovada – Aguardando Comprador</option>
            <option>RFQ Criado</option>
            <option>Em Cotação</option>
            <option>PC Emitido</option>
            <option>Rejeitada</option>
          </select>
        </div>
        <div style="display:flex;gap:8px">
          <button onclick="exportarRC()" class="btn btn-secondary btn-sm"><i class="fas fa-file-excel"></i> Exportar</button>
          <button onclick="navigate('requisicoes')" class="btn btn-secondary btn-sm" style="background:rgba(0,180,184,0.1);border-color:var(--fa-teal);color:var(--fa-teal)">
            <i class="fas fa-external-link-alt"></i> Ir para Emissão de Requisições
          </button>
        </div>
      </div>

      <div id="tabelaRC">
        ${_renderTabelaRC(lista)}
      </div>
    </div>
  `;
}

function _renderTabelaRC(lista) {
  if (!lista.length) return `<div style="text-align:center;padding:40px;color:var(--text-muted)"><i class="fas fa-inbox" style="font-size:32px;display:block;margin-bottom:12px"></i>Nenhuma RC encontrada.</div>`;
  return `
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead>
          <tr style="background:var(--bg-tertiary)">
            <th style="padding:9px 12px;text-align:left;color:var(--text-secondary);font-size:11px">Número</th>
            <th style="padding:9px 12px;text-align:left;color:var(--text-secondary);font-size:11px">Título</th>
            <th style="padding:9px 12px;text-align:left;color:var(--text-secondary);font-size:11px">Solicitante</th>
            <th style="padding:9px 12px;text-align:center;color:var(--text-secondary);font-size:11px">Itens</th>
            <th style="padding:9px 12px;text-align:right;color:var(--text-secondary);font-size:11px">Valor Est.</th>
            <th style="padding:9px 12px;text-align:center;color:var(--text-secondary);font-size:11px">Aprovação</th>
            <th style="padding:9px 12px;text-align:center;color:var(--text-secondary);font-size:11px">Status</th>
            <th style="padding:9px 12px;text-align:center;color:var(--text-secondary);font-size:11px">Ações</th>
          </tr>
        </thead>
        <tbody>
          ${lista.map(r => `
            <tr style="border-bottom:1px solid var(--border-color)" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='transparent'">
              <td style="padding:9px 12px;font-weight:700;color:var(--orange)">${r.numero}</td>
              <td style="padding:9px 12px;color:var(--text-primary);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${r.titulo}">${r.titulo}</td>
              <td style="padding:9px 12px;color:var(--text-secondary)">${r.solicitante}</td>
              <td style="padding:9px 12px;text-align:center">${r.itens?.length || 0}</td>
              <td style="padding:9px 12px;text-align:right;font-weight:600">${fmt(r.valor_total)}</td>
              <td style="padding:9px 12px;text-align:center">
                <div style="font-size:10px">${_renderAprovacaoMini(r)}</div>
              </td>
              <td style="padding:9px 12px;text-align:center">${_rcStatusBadge(r.status)}</td>
              <td style="padding:9px 12px;text-align:center">
                <div style="display:flex;gap:4px;justify-content:center">
                  <button onclick="verDetalheRC('${r.id}')" class="btn btn-secondary btn-sm btn-icon" title="Ver detalhes"><i class="fas fa-eye"></i></button>
                  ${r.status === 'Rascunho' || r.status === 'Rejeitada' ? `<button onclick="editarRC('${r.id}')" class="btn btn-info btn-sm btn-icon" title="Editar"><i class="fas fa-edit"></i></button>` : ''}
                  ${_podeAprovarRC(r) ? `<button onclick="abrirAprovarRC('${r.id}')" class="btn btn-success btn-sm btn-icon" title="Aprovar"><i class="fas fa-check"></i></button>` : ''}
                  ${r.status === 'Aprovada – Aguardando Comprador' && ['admin','compras','diretor'].includes(currentUser?.profile||'') ? `<button onclick="acaoCompradorRC('${r.id}')" class="btn btn-primary btn-sm btn-icon" title="Processar"><i class="fas fa-play"></i></button>` : ''}
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function _renderAprovacaoMini(r) {
  const cfg = _getConfigAprovacao();
  const estagios = r.estagios_aprovacao || [];
  const total = r.total_estagios || 3;
  const atual = r.estagio_atual || 0;
  const badges = [];
  for (let i = 1; i <= total; i++) {
    const e = estagios.find(x => x.estagio === i);
    const cor = e ? (e.status === 'Aprovado' ? '#22c55e' : '#ef4444') : (i <= atual ? '#f59e0b' : '#8b949e');
    badges.push(`<span style="display:inline-block;width:16px;height:16px;border-radius:50%;background:${cor};margin:1px;line-height:16px;text-align:center;font-size:9px;color:#fff;font-weight:700">${i}</span>`);
  }
  return badges.join('');
}

function _rcStatusBadge(s) {
  const map = {
    'Rascunho': '#8b949e',
    'Aguardando Aprovação': '#f59e0b',
    'Aprovada – Aguardando Comprador': '#3b82f6',
    'RFQ Criado': '#0ea5e9',
    'Em Cotação': '#6366f1',
    'Mapa Criado': '#8b5cf6',
    'PC Emitido': '#10b981',
    'Rejeitada': '#ef4444',
    'Cancelada': '#6b7280'
  };
  const cor = map[s] || '#8b949e';
  return `<span style="background:${cor}22;color:${cor};border-radius:6px;padding:3px 7px;font-size:10px;font-weight:700">${s}</span>`;
}

function _podeAprovarRC(r) {
  if (!currentUser) return false;
  const estagio = r.estagio_atual || 1;
  const cfg = _getConfigAprovacao();
  const mapcfg = { 1: cfg.estagio1, 2: cfg.estagio2, 3: cfg.estagio3 };
  const eCfg = mapcfg[estagio] || {};
  const perfisOk = (eCfg.perfis || ['supervisor','operacao']).includes(currentUser.profile);
  // Se houver usuários nomeados, só eles podem aprovar; senão qualquer perfil autorizado
  const usuariosOk = (eCfg.usuarios || []).length > 0
    ? (eCfg.usuarios || []).includes(currentUser.name)
    : true;
  const jaAprovou = (r.estagios_aprovacao || []).some(e => e.estagio === estagio && e.aprovador === currentUser.name);
  return r.status === 'Aguardando Aprovação' && perfisOk && usuariosOk && !jaAprovou;
}

function filtrarRC() {
  const s = (document.getElementById('searchRC')?.value || '').toLowerCase();
  const st = document.getElementById('filterRCStatus')?.value || '';
  const f = _getRC().filter(r =>
    (!s || (r.numero + r.titulo + r.solicitante).toLowerCase().includes(s)) &&
    (!st || r.status === st)
  );
  const el = document.getElementById('tabelaRC');
  if (el) el.innerHTML = _renderTabelaRC(f);
}

function exportarRC() {
  const lista = _getRC();
  const csv = [
    ['Número','Título','Solicitante','Itens','Valor Total','Status','Data Criação'],
    ...lista.map(r => [r.numero, r.titulo, r.solicitante, r.itens?.length||0, r.valor_total, r.status, r.data_criacao])
  ].map(row => row.map(c => `"${c}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\ufeff'+csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `RC_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  showToast('Exportado com sucesso!', 'success');
}

// ─── NOVA REQUISIÇÃO DE COMPRA (RC) ───────────────────────────────────────
function openNovaRC(osId, osTitulo, itemsOS) {
  // Pode ser chamada a partir de uma OS
  const vemDeOS = !!osId;
  const cfg = _getConfigAprovacao();

  openModalWide('Nova Requisição de Compra (RC)', `
    <div style="margin-bottom:16px;padding:12px;background:rgba(0,180,184,0.06);border:1px solid rgba(0,180,184,0.2);border-radius:8px;font-size:12px;color:var(--fa-teal)">
      <i class="fas fa-info-circle" style="margin-right:6px"></i>
      <strong>Fluxo de aprovação:</strong> ${cfg.estagio1.nome} → ${cfg.estagio2.nome} → ${cfg.estagio3.nome} → Comprador
    </div>

    <div style="display:flex;gap:12px;margin-bottom:12px">
      <div style="flex:2">
        <label style="font-size:12px;color:var(--text-secondary);display:block;margin-bottom:4px">Título da RC *</label>
        <input class="form-control" id="rc_titulo" placeholder="Descreva o objeto da compra..." value="${osTitulo ? 'Material para: '+osTitulo : ''}">
      </div>
      <div style="flex:1">
        <label style="font-size:12px;color:var(--text-secondary);display:block;margin-bottom:4px">Contrato</label>
        <select class="form-control" id="rc_contrato">
          <option value="Geral">Geral</option>
          ${ERP_DATA.contratos.filter(c=>c.status==='Ativo'||c.status==='Mobilização').map(c=>`<option value="${c.id}">${c.id} – ${c.cliente}</option>`).join('')}
        </select>
      </div>
    </div>

    <div style="display:flex;gap:12px;margin-bottom:12px">
      <div style="flex:1">
        <label style="font-size:12px;color:var(--text-secondary);display:block;margin-bottom:4px">Solicitante</label>
        <input class="form-control" id="rc_solicitante" value="${currentUser?.name || ''}">
      </div>
      <div style="flex:1">
        <label style="font-size:12px;color:var(--text-secondary);display:block;margin-bottom:4px">Departamento</label>
        <input class="form-control" id="rc_depto" value="${currentUser?.role || ''}">
      </div>
      <div style="flex:1">
        <label style="font-size:12px;color:var(--text-secondary);display:block;margin-bottom:4px">Prazo de Necessidade *</label>
        <input class="form-control" id="rc_prazo" type="date">
      </div>
    </div>

    ${osId ? `<div style="padding:8px 12px;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);border-radius:6px;font-size:12px;color:var(--yellow-light);margin-bottom:12px"><i class="fas fa-link" style="margin-right:6px"></i>Vinculada à OS: <strong>${osId}</strong></div>` : ''}

    <!-- Verificação de material cadastrado -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <div style="font-size:13px;font-weight:700;color:var(--text-primary)"><i class="fas fa-list" style="color:var(--orange);margin-right:6px"></i>Itens da Requisição</div>
      <div style="display:flex;gap:8px">
        <button onclick="abrirCadastroRapidoMaterial()" class="btn btn-secondary btn-sm"><i class="fas fa-cube"></i> Cadastrar Material</button>
        <button onclick="selecionarMaterialCadastrado()" class="btn btn-secondary btn-sm"><i class="fas fa-search"></i> Buscar Material</button>
        <button onclick="adicionarItemRC()" class="btn btn-primary btn-sm"><i class="fas fa-plus"></i> Adicionar Item</button>
      </div>
    </div>

    <div id="itensRC">
      ${(itemsOS && itemsOS.length > 0) ? itemsOS.map((it, idx) => _htmlItemRC(idx, it)).join('') : _htmlItemRC(0)}
    </div>

    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:rgba(0,180,184,0.06);border-radius:8px;margin-top:8px;margin-bottom:12px">
      <span style="font-size:12px;color:var(--text-muted)">Total Estimado:</span>
      <span id="totalRC" style="font-size:20px;font-weight:700;color:var(--fa-teal)">R$ 0,00</span>
    </div>

    <!-- Tipo de compra -->
    <div style="display:flex;gap:12px;margin-bottom:12px">
      <div style="flex:1">
        <label style="font-size:12px;color:var(--text-secondary);display:block;margin-bottom:4px">Tipo de Compra</label>
        <select class="form-control" id="rc_tipo">
          <option value="material">Material</option>
          <option value="servico">Serviço Externo</option>
          <option value="misto">Material + Serviço</option>
        </select>
      </div>
      <div style="flex:1">
        <label style="font-size:12px;color:var(--text-secondary);display:block;margin-bottom:4px">Urgência</label>
        <select class="form-control" id="rc_urgencia">
          <option>Normal</option>
          <option>Urgente</option>
          <option>Crítico</option>
        </select>
      </div>
    </div>

    <div style="margin-bottom:8px">
      <label style="font-size:12px;color:var(--text-secondary);display:block;margin-bottom:4px">Justificativa / Observações</label>
      <textarea class="form-control" id="rc_obs" rows="2" placeholder="Motivo da compra, referências de OS, urgência..."></textarea>
    </div>

    <div id="rc_erro" style="display:none;color:var(--red-light);font-size:12px;padding:8px 12px;background:rgba(239,68,68,0.1);border-radius:6px;margin-top:8px"></div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-info" onclick="salvarRCRascunho()"><i class="fas fa-save"></i> Salvar Rascunho</button>
    <button class="btn btn-primary" onclick="salvarRC('${osId||''}')"><i class="fas fa-paper-plane"></i> Enviar para Aprovação</button>
  `);

  setTimeout(() => calcularTotalRC(), 100);
}

function _htmlItemRC(idx, item) {
  return `
    <div class="form-row rc-item-row" style="background:var(--bg-card2);padding:8px 12px;border-radius:8px;margin-bottom:6px;align-items:flex-end" data-idx="${idx}">
      <div style="flex:3">
        ${idx===0 ? '<label style="font-size:10px;color:var(--text-muted)">Descrição do Item *</label>' : ''}
        <input class="form-control rc-item-desc" placeholder="Material ou serviço" value="${item?.descricao||''}">
      </div>
      <div style="flex:1">
        ${idx===0 ? '<label style="font-size:10px;color:var(--text-muted)">Qtd</label>' : ''}
        <input class="form-control rc-item-qtd" type="number" min="1" value="${item?.qtd||1}" oninput="calcularTotalRC()">
      </div>
      <div style="flex:0.8">
        ${idx===0 ? '<label style="font-size:10px;color:var(--text-muted)">Unidade</label>' : ''}
        <input class="form-control rc-item-un" placeholder="Un" value="${item?.unidade||'Un'}">
      </div>
      <div style="flex:1.5">
        ${idx===0 ? '<label style="font-size:10px;color:var(--text-muted)">Valor Est. (R$)</label>' : ''}
        <input class="form-control rc-item-val" type="number" min="0" step="0.01" value="${item?.valor_unit||''}" oninput="calcularTotalRC()">
      </div>
      <div style="flex:0.8">
        ${idx===0 ? '<label style="font-size:10px;color:var(--text-muted)">Material Cad.?</label>' : ''}
        <select class="form-control rc-item-mat">
          <option value="">Não cadastrado</option>
          ${_getMateriais().map(m=>`<option value="${m.id}" ${item?.material_id===m.id?'selected':''}>${m.codigo}</option>`).join('')}
        </select>
      </div>
      <div style="flex:0.3">
        <button class="btn btn-danger btn-sm btn-icon" onclick="this.closest('.rc-item-row').remove();calcularTotalRC()" title="Remover"><i class="fas fa-trash"></i></button>
      </div>
    </div>
  `;
}

function adicionarItemRC() {
  const cont = document.getElementById('itensRC');
  if (!cont) return;
  const idx = cont.querySelectorAll('.rc-item-row').length;
  const div = document.createElement('div');
  div.innerHTML = _htmlItemRC(idx);
  cont.appendChild(div.firstElementChild);
}

function calcularTotalRC() {
  const qtds = document.querySelectorAll('#itensRC .rc-item-qtd');
  const vals = document.querySelectorAll('#itensRC .rc-item-val');
  let total = 0;
  qtds.forEach((q, i) => { total += (parseFloat(q.value)||0) * (parseFloat(vals[i]?.value)||0); });
  const el = document.getElementById('totalRC');
  if (el) el.textContent = fmt(total);
}

function abrirCadastroRapidoMaterial() {
  // Abre modal de cadastro rápido de material em nova janela/modal overlay
  openModal('Cadastro Rápido de Material', `
    <div style="font-size:12px;color:var(--text-secondary);margin-bottom:12px">Cadastre um novo material para vincular à RC</div>
    <div style="display:flex;gap:10px;margin-bottom:10px">
      <div style="flex:1"><label style="font-size:11px;color:var(--text-muted)">Código *</label><input class="form-control" id="crm_cod" placeholder="Ex: ROL-6208"></div>
      <div style="flex:1"><label style="font-size:11px;color:var(--text-muted)">Categoria</label>
        <select class="form-control" id="crm_cat">
          ${['Lubrificantes','Abrasivos','Rolamentos','EPI','Fixação','Material Elétrico','Ferramentas','Químicos','Outros'].map(c=>`<option>${c}</option>`).join('')}
        </select>
      </div>
    </div>
    <div style="margin-bottom:10px"><label style="font-size:11px;color:var(--text-muted)">Descrição *</label><input class="form-control" id="crm_desc" placeholder="Descrição completa"></div>
    <div style="display:flex;gap:10px;margin-bottom:10px">
      <div style="flex:1"><label style="font-size:11px;color:var(--text-muted)">Unidade</label><input class="form-control" id="crm_un" value="Un"></div>
      <div style="flex:1"><label style="font-size:11px;color:var(--text-muted)">Valor Unit. Estimado</label><input class="form-control" id="crm_val" type="number" min="0" step="0.01"></div>
    </div>
    <div style="display:flex;gap:10px">
      <div style="flex:1"><label style="font-size:11px;color:var(--text-muted)">Estoque Atual</label><input class="form-control" id="crm_est" type="number" value="0"></div>
      <div style="flex:1"><label style="font-size:11px;color:var(--text-muted)">Estoque Mínimo</label><input class="form-control" id="crm_min" type="number" value="0"></div>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal();setTimeout(()=>openNovaRC(),100)">Cancelar</button>
    <button class="btn btn-primary" onclick="salvarCadastroRapidoMaterial()"><i class="fas fa-save"></i> Cadastrar e Voltar</button>
  `);
}

function salvarCadastroRapidoMaterial() {
  const cod = document.getElementById('crm_cod')?.value.trim();
  const desc = document.getElementById('crm_desc')?.value.trim();
  if (!cod || !desc) { showToast('Informe código e descrição.', 'warning'); return; }
  const est = parseInt(document.getElementById('crm_est')?.value)||0;
  const min = parseInt(document.getElementById('crm_min')?.value)||0;
  const lista = _getMateriais();
  const novo = {
    id: gerarId('MAT'),
    codigo: cod.toUpperCase(),
    descricao: desc,
    categoria: document.getElementById('crm_cat')?.value || 'Outros',
    unidade: document.getElementById('crm_un')?.value.trim() || 'Un',
    valor_unitario: parseFloat(document.getElementById('crm_val')?.value)||0,
    estoque_atual: est,
    estoque_min: min,
    status: est === 0 ? 'Crítico' : est < min ? 'Alerta' : 'Ativo',
    contrato: 'Geral',
    observacoes: 'Cadastrado via RC'
  };
  lista.push(novo);
  _saveMateriais(lista);
  logAction('Cadastro Rápido', 'Material', `${novo.codigo} – ${desc}`);
  showToast(`Material ${cod} cadastrado com sucesso!`, 'success');
  closeModal();
  setTimeout(() => openNovaRC(), 150);
}

function selecionarMaterialCadastrado() {
  const mats = _getMateriais();
  openModal('Selecionar Material Cadastrado', `
    <input type="text" id="searchMatRC" placeholder="Buscar..." oninput="filtrarMatRC()" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box;margin-bottom:12px">
    <div id="listaMatRC" style="max-height:320px;overflow-y:auto">
      ${mats.map(m => `
        <div onclick="adicionarMaterialRC('${m.id}')" style="display:flex;align-items:center;gap:10px;padding:10px;border:1px solid var(--border-color);border-radius:8px;margin-bottom:6px;cursor:pointer;transition:all 0.2s" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='transparent'">
          <div style="flex:1">
            <div style="font-size:12px;font-weight:700;color:var(--orange)">${m.codigo}</div>
            <div style="font-size:13px;color:var(--text-primary)">${m.descricao}</div>
            <div style="font-size:11px;color:var(--text-muted)">${m.categoria} · ${m.unidade} · ${fmt(m.valor_unitario)}</div>
          </div>
          <div style="text-align:right">
            ${statusBadge(m.status)}
            <div style="font-size:10px;color:var(--text-muted);margin-top:4px">Est: ${m.estoque_atual}</div>
          </div>
        </div>
      `).join('')}
    </div>
  `, '<button class="btn btn-secondary" onclick="closeModal()">Fechar</button>');
}

function filtrarMatRC() {
  const s = (document.getElementById('searchMatRC')?.value || '').toLowerCase();
  const mats = _getMateriais().filter(m => (m.codigo+m.descricao+m.categoria).toLowerCase().includes(s));
  document.getElementById('listaMatRC').innerHTML = mats.map(m => `
    <div onclick="adicionarMaterialRC('${m.id}')" style="display:flex;align-items:center;gap:10px;padding:10px;border:1px solid var(--border-color);border-radius:8px;margin-bottom:6px;cursor:pointer" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='transparent'">
      <div style="flex:1">
        <div style="font-size:12px;font-weight:700;color:var(--orange)">${m.codigo}</div>
        <div style="font-size:13px">${m.descricao}</div>
        <div style="font-size:11px;color:var(--text-muted)">${m.categoria} · ${fmt(m.valor_unitario)}</div>
      </div>
      ${statusBadge(m.status)}
    </div>
  `).join('') || '<div style="color:var(--text-muted);padding:20px;text-align:center">Nenhum material encontrado</div>';
}

function adicionarMaterialRC(matId) {
  const m = _getMateriais().find(x => x.id === matId);
  if (!m) return;
  closeModal();
  setTimeout(() => {
    const cont = document.getElementById('itensRC');
    if (!cont) return;
    const idx = cont.querySelectorAll('.rc-item-row').length;
    const div = document.createElement('div');
    div.innerHTML = _htmlItemRC(idx, {
      descricao: m.descricao,
      qtd: 1,
      unidade: m.unidade,
      valor_unit: m.valor_unitario,
      material_id: m.id
    });
    cont.appendChild(div.firstElementChild);
    calcularTotalRC();
  }, 100);
}

function salvarRCRascunho() {
  _salvarRCComStatus('Rascunho');
}

function salvarRC(osId) {
  _salvarRCComStatus('Aguardando Aprovação', osId);
}

function _salvarRCComStatus(statusInicial, osId) {
  const titulo = document.getElementById('rc_titulo')?.value.trim();
  const prazo = document.getElementById('rc_prazo')?.value;
  const erroEl = document.getElementById('rc_erro');

  if (!titulo) { if(erroEl){erroEl.textContent='Informe o título da RC.';erroEl.style.display='block';} return; }
  if (statusInicial !== 'Rascunho' && !prazo) { if(erroEl){erroEl.textContent='Informe o prazo de necessidade.';erroEl.style.display='block';} return; }

  const itens = [];
  document.querySelectorAll('#itensRC .rc-item-row').forEach(row => {
    const desc = row.querySelector('.rc-item-desc')?.value.trim();
    if (desc) {
      const qtd = parseFloat(row.querySelector('.rc-item-qtd')?.value) || 1;
      const val = parseFloat(row.querySelector('.rc-item-val')?.value) || 0;
      const un = row.querySelector('.rc-item-un')?.value.trim() || 'Un';
      const matId = row.querySelector('.rc-item-mat')?.value || '';
      itens.push({ descricao: desc, qtd, unidade: un, valor_unit: val, total: qtd*val, material_id: matId });
    }
  });

  if (statusInicial !== 'Rascunho' && !itens.length) {
    if(erroEl){erroEl.textContent='Adicione pelo menos um item.';erroEl.style.display='block';} return;
  }

  const valorTotal = itens.reduce((a,i) => a+i.total, 0);
  const cfg = _getConfigAprovacao();
  const lista = _getRC();
  const numero = _gerarNumeroRC();

  const novaRC = {
    id: gerarId('RC'),
    numero,
    titulo,
    contrato: document.getElementById('rc_contrato')?.value || 'Geral',
    solicitante: document.getElementById('rc_solicitante')?.value.trim() || currentUser?.name,
    departamento: document.getElementById('rc_depto')?.value.trim() || '',
    prazo_necessidade: prazo ? new Date(prazo+'T12:00:00').toLocaleDateString('pt-BR') : '',
    tipo: document.getElementById('rc_tipo')?.value || 'material',
    urgencia: document.getElementById('rc_urgencia')?.value || 'Normal',
    observacoes: document.getElementById('rc_obs')?.value.trim() || '',
    itens,
    valor_total: valorTotal,
    status: statusInicial,
    estagio_atual: statusInicial === 'Aguardando Aprovação' ? 1 : 0,
    total_estagios: 3,
    estagios_aprovacao: [],
    os_vinculada: osId || '',
    criado_por: currentUser?.name,
    data_criacao: new Date().toISOString(),
    historico: [{ acao: statusInicial === 'Rascunho' ? 'Rascunho salvo' : 'RC enviada para aprovação', usuario: currentUser?.name, data: new Date().toLocaleString('pt-BR') }]
  };

  lista.unshift(novaRC);
  _saveRC(lista);

  // Vincula à OS se vier de uma
  if (osId) {
    try {
      const oss = typeof _getOSList === 'function' ? _getOSList() : [];
      const osIdx = oss.findIndex(o => o.id === osId || o.numero === osId);
      if (osIdx >= 0) {
        if (!oss[osIdx].requisicoes_vinculadas) oss[osIdx].requisicoes_vinculadas = [];
        oss[osIdx].requisicoes_vinculadas.push(numero);
        if (typeof _saveOSList === 'function') _saveOSList(oss);
      }
    } catch(e) { /* silencioso */ }
  }

  logAction('Nova RC', 'Compras', `${numero} – ${titulo} (${fmt(valorTotal)})`);
  closeModal();
  showToast(`RC ${numero} ${statusInicial === 'Rascunho' ? 'salva como rascunho' : 'enviada para aprovação!'}`, 'success', 5000);
  renderFluxoCompras();
}

// ─── VER DETALHE RC ─────────────────────────────────────────────────────────
function verDetalheRC(rcId) {
  const r = _getRC().find(x => x.id === rcId);
  if (!r) return;
  const cfg = _getConfigAprovacao();

  openModalWide(`Requisição de Compra – ${r.numero}`, `
    <!-- Header info -->
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
      ${_rcStatusBadge(r.status)}
      <span style="background:rgba(255,255,255,0.08);padding:3px 8px;border-radius:6px;font-size:11px">${r.urgencia}</span>
      <span style="background:rgba(255,255,255,0.08);padding:3px 8px;border-radius:6px;font-size:11px">${r.tipo}</span>
      ${r.os_vinculada ? `<span style="background:rgba(0,180,184,0.15);color:var(--fa-teal);padding:3px 8px;border-radius:6px;font-size:11px"><i class="fas fa-link" style="margin-right:4px"></i>OS: ${r.os_vinculada}</span>` : ''}
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
      <div>
        <div style="font-size:11px;color:var(--text-muted)">Título</div>
        <div style="font-size:14px;font-weight:700;color:var(--text-primary)">${r.titulo}</div>
        <div style="margin-top:8px;font-size:11px;color:var(--text-muted)">Solicitante</div>
        <div style="font-size:13px">${r.solicitante} – ${r.departamento}</div>
        <div style="margin-top:8px;font-size:11px;color:var(--text-muted)">Contrato</div>
        <div style="font-size:13px">${r.contrato}</div>
        <div style="margin-top:8px;font-size:11px;color:var(--text-muted)">Prazo Necessidade</div>
        <div style="font-size:13px">${r.prazo_necessidade || '—'}</div>
      </div>
      <div>
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px">Fluxo de Aprovação</div>
        ${[1,2,3].map(i => {
          const cfg_e = i===1?cfg.estagio1:i===2?cfg.estagio2:cfg.estagio3;
          const ap = (r.estagios_aprovacao||[]).find(e=>e.estagio===i);
          const isAtual = r.estagio_atual === i && r.status === 'Aguardando Aprovação';
          const cor = ap ? (ap.status==='Aprovado'?'#22c55e':'#ef4444') : isAtual ? '#f59e0b' : '#8b949e';
          return `<div style="display:flex;align-items:center;gap:8px;padding:8px;background:${ap?.status==='Aprovado'?'rgba(34,197,94,0.08)':isAtual?'rgba(245,158,11,0.08)':'var(--bg-card2)'};border:1px solid ${cor}44;border-radius:8px;margin-bottom:6px">
            <div style="width:24px;height:24px;background:${cor};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;color:#fff;font-weight:700;flex-shrink:0">${i}</div>
            <div style="flex:1;font-size:12px">
              <div style="font-weight:600">${cfg_e?.nome || 'Estágio '+i}</div>
              <div style="font-size:11px;color:var(--text-muted)">${ap ? ap.aprovador+' em '+ap.data : isAtual ? '⏳ Aguardando...' : 'Pendente'}</div>
            </div>
            <span style="background:${cor}22;color:${cor};border-radius:6px;padding:2px 6px;font-size:10px;font-weight:700">${ap?.status||isAtual?'Pendente':'—'}</span>
          </div>`;
        }).join('')}
      </div>
    </div>

    <!-- Itens -->
    <div style="font-size:13px;font-weight:700;margin-bottom:8px">Itens da RC</div>
    <div style="overflow-x:auto;margin-bottom:12px">
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr style="background:var(--bg-tertiary)">
          <th style="padding:8px 10px;text-align:left">Descrição</th>
          <th style="padding:8px 10px;text-align:center">Qtd</th>
          <th style="padding:8px 10px;text-align:center">Un</th>
          <th style="padding:8px 10px;text-align:right">Val. Unit.</th>
          <th style="padding:8px 10px;text-align:right">Total</th>
          <th style="padding:8px 10px;text-align:center">Mat. Cad.?</th>
        </tr></thead>
        <tbody>
          ${(r.itens||[]).map(it => `
            <tr style="border-bottom:1px solid var(--border-color)">
              <td style="padding:8px 10px">${it.descricao}</td>
              <td style="padding:8px 10px;text-align:center">${it.qtd}</td>
              <td style="padding:8px 10px;text-align:center">${it.unidade}</td>
              <td style="padding:8px 10px;text-align:right">${fmt(it.valor_unit)}</td>
              <td style="padding:8px 10px;text-align:right;font-weight:600;color:var(--fa-teal)">${fmt(it.total)}</td>
              <td style="padding:8px 10px;text-align:center">${it.material_id ? `<span style="color:var(--green-light);font-size:11px"><i class="fas fa-check-circle"></i> ${it.material_id}</span>` : '<span style="color:var(--text-muted);font-size:11px">—</span>'}</td>
            </tr>
          `).join('')}
          <tr style="background:rgba(0,180,184,0.06)">
            <td colspan="4" style="padding:8px 10px;text-align:right;font-weight:700">TOTAL:</td>
            <td colspan="2" style="padding:8px 10px;text-align:right;font-weight:700;color:var(--fa-teal);font-size:14px">${fmt(r.valor_total)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    ${r.observacoes ? `<div style="padding:10px;background:rgba(255,255,255,0.04);border-radius:8px;font-size:12px;color:var(--text-muted);margin-bottom:12px"><i class="fas fa-info-circle" style="margin-right:6px;color:var(--fa-teal)"></i>${r.observacoes}</div>` : ''}

    <!-- Histórico -->
    <div style="font-size:13px;font-weight:700;margin-bottom:8px">Histórico de Ações</div>
    <div style="max-height:120px;overflow-y:auto">
      ${(r.historico||[]).reverse().map(h => `
        <div style="display:flex;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid var(--border-color)">
          <i class="fas fa-circle" style="color:var(--fa-teal);font-size:6px;flex-shrink:0"></i>
          <div style="flex:1;font-size:12px;color:var(--text-primary)">${h.acao}</div>
          <div style="font-size:11px;color:var(--text-muted)">${h.usuario} · ${h.data}</div>
        </div>
      `).join('')}
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
    ${_podeAprovarRC(r) ? `<button class="btn btn-danger" onclick="closeModal();reprovarRC('${r.id}')"><i class="fas fa-times"></i> Reprovar</button><button class="btn btn-success" onclick="closeModal();aprovarRC('${r.id}')"><i class="fas fa-check"></i> Aprovar</button>` : ''}
    ${r.status === 'Aprovada – Aguardando Comprador' && ['admin','compras','diretor'].includes(currentUser?.profile||'') ? `<button class="btn btn-primary" onclick="closeModal();acaoCompradorRC('${r.id}')"><i class="fas fa-play"></i> Processar RC</button>` : ''}
  `);
}

// ─── APROVAÇÃO DE RC ────────────────────────────────────────────────────────
function abrirAprovarRC(rcId) {
  const r = _getRC().find(x => x.id === rcId);
  if (!r) return;
  const cfg = _getConfigAprovacao();
  const est = r.estagio_atual || 1;
  const nomeEstagio = est===1?cfg.estagio1.nome:est===2?cfg.estagio2.nome:cfg.estagio3.nome;

  openModal(`Aprovação – ${r.numero} (${nomeEstagio})`, `
    <div style="margin-bottom:12px">
      <div style="font-weight:600;color:var(--text-primary);margin-bottom:4px">${r.titulo}</div>
      <div style="font-size:12px;color:var(--text-secondary)">${r.itens?.length||0} itens · ${fmt(r.valor_total)}</div>
    </div>
    <div style="padding:10px;background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.3);border-radius:8px;margin-bottom:12px;font-size:12px">
      <i class="fas fa-info-circle" style="color:var(--green-light);margin-right:6px"></i>
      Você está aprovando o <strong>Estágio ${est}: ${nomeEstagio}</strong>
    </div>
    <div>
      <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Observação (opcional)</label>
      <textarea id="obs_aprov_rc" rows="2" placeholder="Comentário sobre a aprovação..." style="width:100%;padding:8px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:6px;color:var(--text-primary);font-size:12px;box-sizing:border-box;resize:vertical"></textarea>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-danger" onclick="closeModal();reprovarRC('${rcId}')"><i class="fas fa-times"></i> Reprovar</button>
    <button class="btn btn-success" onclick="aprovarRC('${rcId}')"><i class="fas fa-check"></i> Aprovar Estágio ${est}</button>
  `);
}

function aprovarRC(rcId) {
  const lista = _getRC();
  const idx = lista.findIndex(x => x.id === rcId);
  if (idx < 0) return;
  const r = lista[idx];
  const est = r.estagio_atual || 1;
  const obs = document.getElementById('obs_aprov_rc')?.value.trim() || '';
  const hoje = new Date().toLocaleString('pt-BR');

  if (!r.estagios_aprovacao) r.estagios_aprovacao = [];
  r.estagios_aprovacao.push({ estagio: est, status: 'Aprovado', aprovador: currentUser?.name, data: hoje, obs });
  if (!r.historico) r.historico = [];
  r.historico.push({ acao: `Estágio ${est} aprovado por ${currentUser?.name}`, usuario: currentUser?.name, data: hoje });

  if (est >= (r.total_estagios || 3)) {
    r.status = 'Aprovada – Aguardando Comprador';
    r.estagio_atual = 4; // indica que todos os estágios passaram
    showToast(`✅ RC ${r.numero} totalmente aprovada! Aguardando ação do Comprador.`, 'success', 5000);
    logAction('Aprovação Final RC', 'Compras', `RC ${r.numero} aprovada em todos os estágios`);
  } else {
    r.estagio_atual = est + 1;
    showToast(`Estágio ${est} aprovado! Avançando para Estágio ${est+1}.`, 'success');
    logAction('Aprovação Estágio', 'Compras', `RC ${r.numero} – Estágio ${est} aprovado por ${currentUser?.name}`);
  }

  lista[idx] = r;
  _saveRC(lista);
  closeModal();
  renderFluxoCompras();
}

function reprovarRC(rcId) {
  openModal('Reprovar RC', `
    <div style="font-size:13px;color:var(--text-secondary);margin-bottom:12px">Informe o motivo da reprovação. A RC retornará ao solicitante para revisão.</div>
    <textarea id="motivo_reprov_rc" rows="3" placeholder="Descreva o motivo da reprovação..." style="width:100%;padding:8px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:6px;color:var(--text-primary);font-size:13px;box-sizing:border-box;resize:vertical"></textarea>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-danger" onclick="_confirmarReprovarRC('${rcId}')"><i class="fas fa-times"></i> Reprovar RC</button>
  `);
}

function _confirmarReprovarRC(rcId) {
  const motivo = document.getElementById('motivo_reprov_rc')?.value.trim() || 'Sem motivo informado';
  const lista = _getRC();
  const idx = lista.findIndex(x => x.id === rcId);
  if (idx < 0) return;
  const hoje = new Date().toLocaleString('pt-BR');
  lista[idx].status = 'Rejeitada';
  lista[idx].motivo_rejeicao = motivo;
  lista[idx].historico = lista[idx].historico || [];
  lista[idx].historico.push({ acao: `Reprovada por ${currentUser?.name}: ${motivo}`, usuario: currentUser?.name, data: hoje });
  _saveRC(lista);
  logAction('Reprovação RC', 'Compras', `RC ${lista[idx].numero} reprovada: ${motivo}`);
  closeModal();
  showToast('RC reprovada. Solicitante notificado para revisão.', 'warning');
  renderFluxoCompras();
}

// ─── AÇÃO DO COMPRADOR: ACEITAR/REJEITAR RC ─────────────────────────────────
function acaoCompradorRC(rcId) {
  const r = _getRC().find(x => x.id === rcId);
  if (!r) return;

  openModalWide(`Processar RC – ${r.numero} (Comprador)`, `
    <div style="margin-bottom:16px">
      <div style="font-size:14px;font-weight:700;color:var(--text-primary)">${r.titulo}</div>
      <div style="font-size:12px;color:var(--text-muted)">${r.itens?.length||0} itens · ${fmt(r.valor_total)} · Prazo: ${r.prazo_necessidade||'—'}</div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
      <!-- Coluna esq: itens -->
      <div>
        <div style="font-size:12px;font-weight:700;margin-bottom:8px;color:var(--text-secondary)">ITENS DA RC</div>
        ${(r.itens||[]).map((it, i) => `
          <div style="display:flex;align-items:center;gap:8px;padding:8px;border:1px solid var(--border-color);border-radius:8px;margin-bottom:6px">
            <input type="checkbox" id="rc_item_sel_${i}" checked style="accent-color:var(--fa-teal)">
            <div style="flex:1;font-size:12px">
              <div style="font-weight:600">${it.descricao}</div>
              <div style="color:var(--text-muted)">${it.qtd} ${it.unidade} · ${fmt(it.valor_unit)} unit.</div>
            </div>
            <div style="font-weight:600;font-size:12px;color:var(--fa-teal)">${fmt(it.total)}</div>
          </div>
        `).join('')}
      </div>
      <!-- Coluna dir: ação -->
      <div>
        <div style="font-size:12px;font-weight:700;margin-bottom:8px;color:var(--text-secondary)">AÇÃO DO COMPRADOR</div>
        <div style="margin-bottom:12px">
          <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px">Você pode:</div>
          <div style="display:flex;flex-direction:column;gap:8px">
            <label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;padding:10px;border:1px solid var(--border-color);border-radius:8px">
              <input type="radio" name="acao_comprador" value="aceitar_todos" checked style="accent-color:var(--fa-teal);margin-top:2px">
              <div style="font-size:12px"><strong>Criar uma única RFQ</strong> com todos os itens selecionados</div>
            </label>
            <label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;padding:10px;border:1px solid var(--border-color);border-radius:8px">
              <input type="radio" name="acao_comprador" value="aceitar_separado" style="accent-color:var(--fa-teal);margin-top:2px">
              <div style="font-size:12px"><strong>Criar RFQs separadas</strong> (uma por item ou agrupamento)</div>
            </label>
            <label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;padding:10px;border:1px solid var(--border-color);border-radius:8px">
              <input type="radio" name="acao_comprador" value="rejeitar" style="accent-color:var(--red-light);margin-top:2px">
              <div style="font-size:12px;color:var(--red-light)"><strong>Rejeitar RC</strong> – retorna ao solicitante</div>
            </label>
          </div>
        </div>
        <div style="margin-bottom:10px">
          <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Observação do Comprador</label>
          <textarea id="obs_comprador_rc" rows="2" placeholder="Justificativa ou observação..." style="width:100%;padding:8px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:6px;color:var(--text-primary);font-size:12px;box-sizing:border-box;resize:vertical"></textarea>
        </div>
      </div>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="processarAcaoCompradorRC('${r.id}')"><i class="fas fa-play"></i> Confirmar Ação</button>
  `);
}

function processarAcaoCompradorRC(rcId) {
  const acao = document.querySelector('input[name="acao_comprador"]:checked')?.value;
  const obs = document.getElementById('obs_comprador_rc')?.value.trim() || '';

  const lista = _getRC();
  const idx = lista.findIndex(x => x.id === rcId);
  if (idx < 0) return;
  const r = lista[idx];
  const hoje = new Date().toLocaleString('pt-BR');

  if (acao === 'rejeitar') {
    r.status = 'Rejeitada';
    r.motivo_rejeicao = obs || 'Rejeitada pelo Comprador';
    r.historico = r.historico || [];
    r.historico.push({ acao: `Rejeitada pelo Comprador: ${obs}`, usuario: currentUser?.name, data: hoje });
    _saveRC(lista);
    closeModal();
    showToast('RC rejeitada. Solicitante será notificado.', 'warning');
    renderFluxoCompras();
    return;
  }

  // Coletar itens selecionados
  const itensSelecionados = [];
  (r.itens || []).forEach((it, i) => {
    const cb = document.getElementById(`rc_item_sel_${i}`);
    if (cb?.checked) itensSelecionados.push({ ...it });
  });

  if (!itensSelecionados.length) { showToast('Selecione ao menos um item.', 'warning'); return; }

  r.status = 'RFQ Criado';
  r.historico = r.historico || [];
  r.historico.push({ acao: `Aceita pelo Comprador – Criando RFQ`, usuario: currentUser?.name, data: hoje });
  lista[idx] = r;
  _saveRC(lista);

  closeModal();

  if (acao === 'aceitar_todos') {
    // Cria um único RFQ
    criarRFQDaRC(rcId, itensSelecionados);
  } else {
    // Cria RFQs separadas – abre modal de agrupamento
    abrirCriarRFQsSeparadas(rcId, itensSelecionados);
  }
}

// ─── CRIAR RFQ A PARTIR DE RC ───────────────────────────────────────────────
function criarRFQDaRC(rcId, itens) {
  const r = _getRC().find(x => x.id === rcId);
  if (!r) return;

  openModalWide('Criar RFQ – Configurar Processo de Cotação', `
    <div style="margin-bottom:14px;padding:10px;background:rgba(0,180,184,0.08);border-radius:8px;font-size:12px;color:var(--fa-teal)">
      <strong>RC: ${r.numero}</strong> – ${r.titulo} · ${itens.length} itens · ${fmt(r.valor_total)}
    </div>

    <div style="display:flex;gap:12px;margin-bottom:12px">
      <div style="flex:2">
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Título do Processo RFQ *</label>
        <input class="form-control" id="rfq_titulo" value="${r.titulo}" placeholder="Título da cotação">
      </div>
      <div style="flex:1">
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Prazo para Cotações *</label>
        <input class="form-control" id="rfq_prazo" type="date" value="${new Date(Date.now()+7*24*60*60*1000).toISOString().split('T')[0]}">
      </div>
    </div>

    <!-- Método de envio -->
    <div style="font-size:12px;font-weight:700;color:var(--text-secondary);margin-bottom:8px">MÉTODO DE ENVIO AOS FORNECEDORES</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
      <label style="display:flex;align-items:center;gap:8px;padding:10px;border:1px solid var(--border-color);border-radius:8px;cursor:pointer" id="metodo_email_label">
        <input type="checkbox" id="rfq_metodo_email" checked style="accent-color:var(--fa-teal)" onchange="toggleMetodo('email')">
        <div>
          <div style="font-size:12px;font-weight:600"><i class="fas fa-envelope" style="color:var(--fa-teal);margin-right:4px"></i>E-mail Automático</div>
          <div style="font-size:10px;color:var(--text-muted)">Envia convite por e-mail aos fornecedores marcados</div>
        </div>
      </label>
      <label style="display:flex;align-items:center;gap:8px;padding:10px;border:1px solid var(--border-color);border-radius:8px;cursor:pointer">
        <input type="checkbox" id="rfq_metodo_texto" style="accent-color:var(--fa-teal)">
        <div>
          <div style="font-size:12px;font-weight:600"><i class="fas fa-sms" style="color:var(--orange);margin-right:4px"></i>Mensagem de Texto</div>
          <div style="font-size:10px;color:var(--text-muted)">Gera texto formatado para envio manual (WhatsApp, SMS)</div>
        </div>
      </label>
      <label style="display:flex;align-items:center;gap:8px;padding:10px;border:1px solid var(--border-color);border-radius:8px;cursor:pointer">
        <input type="checkbox" id="rfq_metodo_pdf" style="accent-color:var(--fa-teal)">
        <div>
          <div style="font-size:12px;font-weight:600"><i class="fas fa-file-pdf" style="color:#ef4444;margin-right:4px"></i>Exportar como PDF</div>
          <div style="font-size:10px;color:var(--text-muted)">Gera documento PDF da RFQ</div>
        </div>
      </label>
      <label style="display:flex;align-items:center;gap:8px;padding:10px;border:1px solid var(--border-color);border-radius:8px;cursor:pointer">
        <input type="checkbox" id="rfq_metodo_excel" style="accent-color:var(--fa-teal)">
        <div>
          <div style="font-size:12px;font-weight:600"><i class="fas fa-file-excel" style="color:#22c55e;margin-right:4px"></i>Exportar como Excel/CSV</div>
          <div style="font-size:10px;color:var(--text-muted)">Gera planilha CSV da RFQ</div>
        </div>
      </label>
    </div>

    <!-- Seleção de fornecedores -->
    <div style="font-size:12px;font-weight:700;color:var(--text-secondary);margin-bottom:8px">FORNECEDORES CONVIDADOS</div>
    <div style="display:flex;gap:8px;margin-bottom:8px">
      <input type="text" id="searchFornRFQ" placeholder="Buscar fornecedor..." oninput="filtrarFornRFQ()" style="flex:1;padding:7px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:12px">
      <select id="filterCatFornRFQ" onchange="filtrarFornRFQ()" style="padding:7px 10px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:12px">
        <option value="">Todas as Categorias</option>
        ${[...new Set((_getFornecedores&&_getFornecedores()||[]).map(f=>f.categoria).filter(Boolean))].map(c=>`<option>${c}</option>`).join('')}
      </select>
    </div>
    <div id="listaFornRFQ" style="max-height:200px;overflow-y:auto;margin-bottom:10px">
      ${_renderFornecedoresRFQ()}
    </div>
    <div style="display:flex;gap:8px;padding:8px;background:rgba(0,180,184,0.06);border-radius:8px">
      <input type="text" id="rfq_forn_manual" placeholder="Adicionar fornecedor manualmente (nome ou e-mail)" style="flex:1;padding:7px 10px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:6px;color:var(--text-primary);font-size:12px">
      <button onclick="adicionarFornManualRFQ()" class="btn btn-secondary btn-sm"><i class="fas fa-plus"></i> Adicionar</button>
    </div>
    <div id="forns_manuais_rfq" style="margin-top:8px"></div>

    <input type="hidden" id="rfq_rc_id" value="${rcId}">
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="salvarCriarRFQ(${JSON.stringify(itens).replace(/"/g,'&quot;')})"><i class="fas fa-paper-plane"></i> Criar RFQ e Enviar</button>
  `);
}

function _renderFornecedoresRFQ(filtro, cat) {
  const todos = typeof _getFornecedores === 'function' ? _getFornecedores() : (typeof FA_FORNECEDORES !== 'undefined' ? FA_FORNECEDORES : []);
  const ativos = todos.filter(f => f.status === 'Ativo' || f.status === 'Aprovado');
  const lista = ativos.filter(f => {
    const matchTxt = !filtro || (f.razao_social||'').toLowerCase().includes(filtro.toLowerCase());
    const matchCat = !cat || f.categoria === cat;
    return matchTxt && matchCat;
  });
  if (!lista.length) return '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:12px">Nenhum fornecedor ativo. Use o campo abaixo para adicionar manualmente.</div>';
  return lista.map(f => `
    <div style="display:flex;align-items:center;gap:8px;padding:8px;border:1px solid var(--border-color);border-radius:8px;margin-bottom:4px">
      <input type="checkbox" id="forn_rfq_cb_${f.id||f.cnpj}" value="${f.id||f.razao_social}" style="accent-color:var(--fa-teal)">
      <div style="flex:1;font-size:12px">
        <div style="font-weight:600;color:var(--text-primary)">${f.razao_social || f.nome}</div>
        <div style="font-size:11px;color:var(--text-muted)">${f.categoria||'—'} · ${f.email||'sem e-mail'}</div>
      </div>
    </div>
  `).join('');
}

function filtrarFornRFQ() {
  const txt = document.getElementById('searchFornRFQ')?.value || '';
  const cat = document.getElementById('filterCatFornRFQ')?.value || '';
  const el = document.getElementById('listaFornRFQ');
  if (el) el.innerHTML = _renderFornecedoresRFQ(txt, cat);
}

let _fornsAdicionaisRFQ = [];
function adicionarFornManualRFQ() {
  const val = document.getElementById('rfq_forn_manual')?.value.trim();
  if (!val) return;
  _fornsAdicionaisRFQ.push(val);
  document.getElementById('rfq_forn_manual').value = '';
  const el = document.getElementById('forns_manuais_rfq');
  if (el) el.innerHTML = _fornsAdicionaisRFQ.map((f,i) => `
    <span style="display:inline-flex;align-items:center;gap:4px;background:rgba(0,180,184,0.15);color:var(--fa-teal);padding:3px 8px;border-radius:12px;font-size:11px;margin:2px">
      ${f} <button onclick="_fornsAdicionaisRFQ.splice(${i},1);adicionarFornManualRFQ()" style="background:none;border:none;color:inherit;cursor:pointer;padding:0;margin-left:2px">×</button>
    </span>
  `).join('');
}

function salvarCriarRFQ(itens) {
  const titulo = document.getElementById('rfq_titulo')?.value.trim();
  const prazoRaw = document.getElementById('rfq_prazo')?.value;
  const rcId = document.getElementById('rfq_rc_id')?.value;

  if (!titulo) { showToast('Informe o título do processo RFQ.', 'warning'); return; }
  if (!prazoRaw) { showToast('Informe o prazo para cotações.', 'warning'); return; }

  // Coletar fornecedores selecionados
  const fornsIds = [];
  document.querySelectorAll('[id^="forn_rfq_cb_"]').forEach(cb => {
    if (cb.checked) fornsIds.push(cb.value);
  });
  fornsIds.push(...(_fornsAdicionaisRFQ || []));
  _fornsAdicionaisRFQ = [];

  const metodos = {
    email: document.getElementById('rfq_metodo_email')?.checked || false,
    texto: document.getElementById('rfq_metodo_texto')?.checked || false,
    pdf:   document.getElementById('rfq_metodo_pdf')?.checked || false,
    excel: document.getElementById('rfq_metodo_excel')?.checked || false
  };

  const r = _getRC().find(x => x.id === rcId);
  const numero = _gerarNumeroRFQ();
  const novoRFQ = {
    id: gerarId('RFQ'),
    numero,
    rc_id: rcId,
    rc_numero: r?.numero || '',
    titulo,
    contrato: r?.contrato || '',
    solicitante: r?.solicitante || '',
    itens: itens || r?.itens || [],
    fornecedores_convidados: fornsIds,
    metodos_envio: metodos,
    prazo_cotacao: new Date(prazoRaw+'T12:00:00').toLocaleDateString('pt-BR'),
    status: fornsIds.length > 0 ? 'Em Cotação' : 'Aguardando Cotações',
    cotacoes: [],
    criado_por: currentUser?.name,
    data_criacao: new Date().toISOString()
  };

  const lista = _getRFQFlow();
  lista.unshift(novoRFQ);
  _saveRFQFlow(lista);

  logAction('Criar RFQ', 'Compras', `${numero} criado a partir de ${r?.numero}`);

  // Executa métodos de envio
  if (metodos.email && fornsIds.length > 0) {
    showToast(`📧 E-mail de cotação enviado para ${fornsIds.length} fornecedor(es)!`, 'success');
  }
  if (metodos.texto) {
    setTimeout(() => gerarTextoRFQ(novoRFQ.id), 300);
  }
  if (metodos.pdf) {
    setTimeout(() => exportarRFQPDF(novoRFQ.id), 600);
  }
  if (metodos.excel) {
    setTimeout(() => exportarRFQExcel(novoRFQ.id), 900);
  }

  closeModal();
  showToast(`✅ RFQ ${numero} criado! ${fornsIds.length} fornecedor(es) convidados.`, 'success', 5000);
  renderFluxoCompras();
  setTimeout(() => switchFluxoTab('rfq'), 200);
}

function abrirCriarRFQsSeparadas(rcId, itens) {
  openModalWide('Criar RFQs Separadas – Agrupar Itens', `
    <div style="margin-bottom:14px;font-size:12px;color:var(--text-secondary)">
      Agrupe os itens conforme deseja criar as cotações separadas. Cada grupo gerará um RFQ independente.
    </div>
    <div id="grupos_rfq">
      <div class="rfq-grupo" style="border:1px solid var(--border-color);border-radius:10px;padding:12px;margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <input class="form-control grupo-titulo" placeholder="Título do grupo (ex: Materiais Elétricos)" style="max-width:300px">
          <button onclick="this.closest('.rfq-grupo').remove()" class="btn btn-danger btn-sm btn-icon"><i class="fas fa-trash"></i></button>
        </div>
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px">Arraste ou selecione os itens deste grupo:</div>
        <div class="grupo-itens">
          ${itens.map((it, i) => `
            <label style="display:flex;align-items:center;gap:8px;padding:6px;cursor:pointer;border-radius:6px" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='transparent'">
              <input type="checkbox" class="item-grupo" value="${i}" style="accent-color:var(--fa-teal)">
              <span style="font-size:12px">${it.descricao} – ${it.qtd} ${it.unidade}</span>
            </label>
          `).join('')}
        </div>
      </div>
    </div>
    <button onclick="adicionarGrupoRFQ(${JSON.stringify(itens).replace(/"/g,'&quot;')})" class="btn btn-secondary btn-sm"><i class="fas fa-plus"></i> Adicionar Grupo</button>
    <input type="hidden" id="sep_rc_id" value="${rcId}">
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="salvarRFQsSeparadas(${JSON.stringify(itens).replace(/"/g,'&quot;')})"><i class="fas fa-paper-plane"></i> Criar RFQs</button>
  `);
}

function adicionarGrupoRFQ(itens) {
  const cont = document.getElementById('grupos_rfq');
  if (!cont) return;
  const div = document.createElement('div');
  div.className = 'rfq-grupo';
  div.style.cssText = 'border:1px solid var(--border-color);border-radius:10px;padding:12px;margin-bottom:10px';
  div.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <input class="form-control grupo-titulo" placeholder="Título do grupo" style="max-width:300px">
      <button onclick="this.closest('.rfq-grupo').remove()" class="btn btn-danger btn-sm btn-icon"><i class="fas fa-trash"></i></button>
    </div>
    <div class="grupo-itens">
      ${itens.map((it, i) => `
        <label style="display:flex;align-items:center;gap:8px;padding:6px;cursor:pointer">
          <input type="checkbox" class="item-grupo" value="${i}" style="accent-color:var(--fa-teal)">
          <span style="font-size:12px">${it.descricao} – ${it.qtd} ${it.unidade}</span>
        </label>
      `).join('')}
    </div>
  `;
  cont.appendChild(div);
}

function salvarRFQsSeparadas(todosItens) {
  const grupos = document.querySelectorAll('.rfq-grupo');
  const rcId = document.getElementById('sep_rc_id')?.value;
  const r = _getRC().find(x => x.id === rcId);
  let criados = 0;

  grupos.forEach(g => {
    const titulo = g.querySelector('.grupo-titulo')?.value.trim();
    const itensSel = [];
    g.querySelectorAll('.item-grupo:checked').forEach(cb => {
      const idx = parseInt(cb.value);
      if (todosItens[idx]) itensSel.push(todosItens[idx]);
    });
    if (!titulo || !itensSel.length) return;

    const numero = _gerarNumeroRFQ();
    const novoRFQ = {
      id: gerarId('RFQ'),
      numero,
      rc_id: rcId,
      rc_numero: r?.numero || '',
      titulo,
      contrato: r?.contrato || '',
      solicitante: r?.solicitante || '',
      itens: itensSel,
      fornecedores_convidados: [],
      metodos_envio: {},
      prazo_cotacao: '',
      status: 'Aguardando Cotações',
      cotacoes: [],
      criado_por: currentUser?.name,
      data_criacao: new Date().toISOString()
    };
    const lista = _getRFQFlow();
    lista.unshift(novoRFQ);
    _saveRFQFlow(lista);
    criados++;
  });

  closeModal();
  if (criados > 0) {
    showToast(`✅ ${criados} RFQ(s) separadas criadas!`, 'success', 5000);
    renderFluxoCompras();
    setTimeout(() => switchFluxoTab('rfq'), 200);
  } else {
    showToast('Nenhum grupo válido encontrado. Preencha título e selecione itens.', 'warning');
  }
}

// ─── EXPORTAR RFQ (TEXTO / PDF / EXCEL) ────────────────────────────────────
function gerarTextoRFQ(rfqId) {
  const rfq = _getRFQFlow().find(r => r.id === rfqId);
  if (!rfq) return;
  const texto = `=== SOLICITAÇÃO DE COTAÇÃO – FRASER ALEXANDER ===

Nº Processo: ${rfq.numero}
Título: ${rfq.titulo}
Data: ${new Date(rfq.data_criacao).toLocaleDateString('pt-BR')}
Prazo para Cotação: ${rfq.prazo_cotacao}

ITENS A COTAR:
${(rfq.itens||[]).map((it,i) => `${i+1}. ${it.descricao}
   Quantidade: ${it.qtd} ${it.unidade}
   Valor de Referência: ${fmt(it.valor_unit)}`).join('\n\n')}

Por favor, envie sua proposta com:
- Preço unitário e total por item
- Prazo de entrega
- Condição de pagamento
- Validade da proposta

Contato: Compras Fraser Alexander
E-mail: compras@fraseralexander.com.br`;

  openModal('Texto da RFQ – Copiar e Enviar', `
    <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px">Copie o texto abaixo e envie ao fornecedor via WhatsApp, SMS ou e-mail.</div>
    <textarea readonly style="width:100%;height:260px;padding:10px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:12px;font-family:monospace;box-sizing:border-box;resize:none" onclick="this.select()">${texto}</textarea>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
    <button class="btn btn-primary" onclick="navigator.clipboard.writeText(document.querySelector('textarea[readonly]').value);showToast('Texto copiado!','success')"><i class="fas fa-copy"></i> Copiar</button>
  `);
}

function exportarRFQPDF(rfqId) {
  const rfq = _getRFQFlow().find(r => r.id === rfqId);
  if (!rfq) return;
  const html = `
    <!DOCTYPE html><html><head>
    <meta charset="UTF-8"><title>RFQ – ${rfq.numero}</title>
    <style>
      body { font-family:Arial,sans-serif; font-size:12px; color:#333; margin:30px; }
      .header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #e67e22; padding-bottom:12px; margin-bottom:16px; }
      .logo-text { font-size:22px; font-weight:900; color:#e67e22; }
      .logo-sub { font-size:10px; color:#666; }
      h2 { color:#e67e22; font-size:14px; margin:0; }
      table { width:100%; border-collapse:collapse; margin:10px 0; }
      th { background:#e67e22; color:#fff; padding:7px 10px; font-size:11px; text-align:left; }
      td { padding:7px 10px; border-bottom:1px solid #ddd; font-size:11px; }
      .total { font-weight:bold; font-size:13px; text-align:right; padding:8px 10px; }
      .footer { margin-top:40px; font-size:10px; color:#999; border-top:1px solid #ddd; padding-top:8px; }
    </style>
    </head><body>
    <div class="header">
      <div>
        <div class="logo-text">FRASER ALEXANDER</div>
        <div class="logo-sub">Gestão de Contratos e Suprimentos</div>
      </div>
      <div style="text-align:right">
        <h2>SOLICITAÇÃO DE COTAÇÃO</h2>
        <div><strong>Nº:</strong> ${rfq.numero}</div>
        <div><strong>Data:</strong> ${new Date(rfq.data_criacao).toLocaleDateString('pt-BR')}</div>
        <div><strong>Prazo:</strong> ${rfq.prazo_cotacao}</div>
      </div>
    </div>
    <table>
      <tr><td><strong>Processo:</strong></td><td>${rfq.numero}</td><td><strong>Contrato:</strong></td><td>${rfq.contrato||'—'}</td></tr>
      <tr><td><strong>Título:</strong></td><td colspan="3">${rfq.titulo}</td></tr>
      <tr><td><strong>Solicitante:</strong></td><td>${rfq.solicitante}</td><td><strong>Prazo Cotação:</strong></td><td>${rfq.prazo_cotacao}</td></tr>
    </table>
    <br>
    <strong>ITENS A COTAR:</strong>
    <table>
      <thead><tr><th>#</th><th>Descrição</th><th>Quantidade</th><th>Unidade</th><th>Val. Referência</th><th>Preço Ofertado</th><th>Total</th></tr></thead>
      <tbody>
        ${(rfq.itens||[]).map((it,i) => `<tr><td>${i+1}</td><td>${it.descricao}</td><td>${it.qtd}</td><td>${it.unidade}</td><td>R$ ${it.valor_unit?.toFixed(2)||'—'}</td><td>______</td><td>______</td></tr>`).join('')}
      </tbody>
    </table>
    <br>
    <table>
      <tr><td><strong>Prazo de Entrega:</strong></td><td>______</td><td><strong>Condição de Pagamento:</strong></td><td>______</td></tr>
      <tr><td><strong>Validade da Proposta:</strong></td><td>______</td><td><strong>TOTAL GERAL:</strong></td><td class="total">R$ ______</td></tr>
    </table>
    <div class="footer">
      Fraser Alexander · Documento gerado em ${new Date().toLocaleString('pt-BR')} · ${rfq.numero}
    </div>
    </body></html>
  `;
  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); w.print(); }
}

function exportarRFQExcel(rfqId) {
  const rfq = _getRFQFlow().find(r => r.id === rfqId);
  if (!rfq) return;
  const csv = [
    ['RFQ Nº', rfq.numero, '', 'Data', new Date(rfq.data_criacao).toLocaleDateString('pt-BR')],
    ['Título', rfq.titulo, '', 'Prazo Cotação', rfq.prazo_cotacao],
    ['Solicitante', rfq.solicitante, '', 'Contrato', rfq.contrato||'—'],
    [],
    ['#', 'Descrição', 'Qtd', 'Unidade', 'Val. Referência', 'Preço Ofertado', 'Total'],
    ...(rfq.itens||[]).map((it, i) => [i+1, it.descricao, it.qtd, it.unidade, it.valor_unit||0, '', ''])
  ].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\ufeff'+csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `RFQ_${rfq.numero}_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  showToast(`📊 RFQ exportada como CSV/Excel!`, 'success');
}

// ─── TAB: COTAÇÕES RFQ ─────────────────────────────────────────────────────
function _renderTabRFQ(lista) {
  if (!lista.length) return `<div style="text-align:center;padding:40px;color:var(--text-muted)"><i class="fas fa-paper-plane" style="font-size:32px;display:block;margin-bottom:12px"></i>Nenhuma RFQ. Processe uma RC para iniciar.</div>`;
  return `
    <div style="padding:16px">
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-bottom:12px">
        <input type="text" id="searchRFQ2" placeholder="Buscar RFQ..." oninput="filtrarRFQ2()" style="padding:7px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px">
      </div>
      <div id="tabelaRFQ2">
        ${_renderTabelaRFQ(lista)}
      </div>
    </div>
  `;
}

function _renderTabelaRFQ(lista) {
  return `
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr style="background:var(--bg-tertiary)">
          <th style="padding:9px 12px;text-align:left;color:var(--text-secondary);font-size:11px">Nº RFQ</th>
          <th style="padding:9px 12px;text-align:left;color:var(--text-secondary);font-size:11px">Título</th>
          <th style="padding:9px 12px;text-align:left;color:var(--text-secondary);font-size:11px">RC Origem</th>
          <th style="padding:9px 12px;text-align:center;color:var(--text-secondary);font-size:11px">Fornecedores</th>
          <th style="padding:9px 12px;text-align:center;color:var(--text-secondary);font-size:11px">Prazo Cotação</th>
          <th style="padding:9px 12px;text-align:center;color:var(--text-secondary);font-size:11px">Status</th>
          <th style="padding:9px 12px;text-align:center;color:var(--text-secondary);font-size:11px">Ações</th>
        </tr></thead>
        <tbody>
          ${lista.map(rfq => `
            <tr style="border-bottom:1px solid var(--border-color)" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='transparent'">
              <td style="padding:9px 12px;font-weight:700;color:var(--fa-teal)">${rfq.numero}</td>
              <td style="padding:9px 12px;color:var(--text-primary)">${rfq.titulo}</td>
              <td style="padding:9px 12px;color:var(--text-muted);font-size:11px">${rfq.rc_numero||'—'}</td>
              <td style="padding:9px 12px;text-align:center">${(rfq.fornecedores_convidados||[]).length}</td>
              <td style="padding:9px 12px;text-align:center;font-size:11px">${rfq.prazo_cotacao||'—'}</td>
              <td style="padding:9px 12px;text-align:center">${_rfqFlowStatusBadge(rfq.status)}</td>
              <td style="padding:9px 12px;text-align:center">
                <div style="display:flex;gap:4px;justify-content:center">
                  <button onclick="verDetalheRFQFlow('${rfq.id}')" class="btn btn-secondary btn-sm btn-icon" title="Ver"><i class="fas fa-eye"></i></button>
                  ${rfq.status === 'Em Cotação' || rfq.status === 'Aguardando Cotações' ? `<button onclick="registrarCotacoesRFQFlow('${rfq.id}')" class="btn btn-primary btn-sm" title="Registrar cotações">
                    <i class="fas fa-pencil-alt"></i> Registrar
                  </button>` : ''}
                  ${rfq.status === 'Cotações Recebidas' ? `<button onclick="abrirMapaComparativo2('${rfq.id}')" class="btn btn-success btn-sm" title="Gerar mapa"><i class="fas fa-balance-scale"></i> Mapa</button>` : ''}
                  <button onclick="exportarRFQPDF('${rfq.id}')" class="btn btn-secondary btn-sm btn-icon" title="PDF"><i class="fas fa-file-pdf"></i></button>
                  <button onclick="exportarRFQExcel('${rfq.id}')" class="btn btn-secondary btn-sm btn-icon" title="Excel"><i class="fas fa-file-excel"></i></button>
                  <button onclick="gerarTextoRFQ('${rfq.id}')" class="btn btn-secondary btn-sm btn-icon" title="Texto"><i class="fas fa-sms"></i></button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function filtrarRFQ2() {
  const s = (document.getElementById('searchRFQ2')?.value || '').toLowerCase();
  const f = _getRFQFlow().filter(r => (r.numero+r.titulo+r.rc_numero).toLowerCase().includes(s));
  const el = document.getElementById('tabelaRFQ2');
  if (el) el.innerHTML = _renderTabelaRFQ(f);
}

function _rfqFlowStatusBadge(s) {
  const map = { 'Em Cotação':'#3b82f6','Aguardando Cotações':'#f59e0b','Cotações Recebidas':'#6366f1','Mapa Criado':'#8b5cf6','Aprovada':'#22c55e','PC Emitido':'#10b981','Cancelada':'#ef4444' };
  const cor = map[s] || '#8b949e';
  return `<span style="background:${cor}22;color:${cor};border-radius:6px;padding:3px 7px;font-size:10px;font-weight:700">${s}</span>`;
}

function verDetalheRFQFlow(rfqId) {
  const rfq = _getRFQFlow().find(r => r.id === rfqId);
  if (!rfq) return;
  openModalWide(`RFQ – ${rfq.numero}`, `
    <div style="display:flex;gap:8px;margin-bottom:14px">${_rfqFlowStatusBadge(rfq.status)}</div>
    <div style="font-size:14px;font-weight:700;margin-bottom:4px">${rfq.titulo}</div>
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:14px">RC: ${rfq.rc_numero||'—'} · Solicitante: ${rfq.solicitante} · Prazo: ${rfq.prazo_cotacao||'—'}</div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
      <div>
        <div style="font-size:12px;font-weight:700;margin-bottom:8px">ITENS (${rfq.itens?.length||0})</div>
        ${(rfq.itens||[]).map(it => `<div style="padding:6px 0;border-bottom:1px solid var(--border-color);font-size:12px">${it.descricao} – ${it.qtd} ${it.unidade} (${fmt(it.valor_unit)})</div>`).join('')}
      </div>
      <div>
        <div style="font-size:12px;font-weight:700;margin-bottom:8px">FORNECEDORES CONVIDADOS (${(rfq.fornecedores_convidados||[]).length})</div>
        ${(rfq.fornecedores_convidados||[]).map(f => `<div style="padding:4px 0;font-size:12px;color:var(--text-secondary)">${f}</div>`).join('') || '<div style="color:var(--text-muted);font-size:12px">Nenhum convidado ainda</div>'}
        ${rfq.cotacoes?.length ? `<div style="margin-top:12px;font-size:12px;font-weight:700">COTAÇÕES RECEBIDAS (${rfq.cotacoes.length})</div>${rfq.cotacoes.map(c => `<div style="padding:6px 0;border-bottom:1px solid var(--border-color);font-size:12px;color:var(--green-light)">✓ ${c.fornecedor}: ${fmt(c.total)}</div>`).join('')}` : ''}
      </div>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
    ${rfq.status === 'Em Cotação' || rfq.status === 'Aguardando Cotações' ? `<button class="btn btn-primary" onclick="closeModal();registrarCotacoesRFQFlow('${rfq.id}')"><i class="fas fa-pencil-alt"></i> Registrar Cotações</button>` : ''}
    ${rfq.status === 'Cotações Recebidas' ? `<button class="btn btn-success" onclick="closeModal();abrirMapaComparativo2('${rfq.id}')"><i class="fas fa-balance-scale"></i> Gerar Mapa</button>` : ''}
  `);
}

// ─── REGISTRAR COTAÇÕES DOS FORNECEDORES ──────────────────────────────────
function registrarCotacoesRFQFlow(rfqId) {
  const rfq = _getRFQFlow().find(r => r.id === rfqId);
  if (!rfq) return;

  const forns = rfq.fornecedores_convidados?.length ? rfq.fornecedores_convidados : ['Fornecedor 1', 'Fornecedor 2', 'Fornecedor 3'];
  const itens = rfq.itens || [];

  openModalWide(`Registrar Cotações – ${rfq.numero}`, `
    <div style="margin-bottom:12px;font-size:12px;color:var(--text-secondary)">
      Registre os valores cotados por cada fornecedor para cada item da RFQ.
    </div>
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead>
          <tr style="background:var(--bg-tertiary)">
            <th style="padding:8px 10px;text-align:left;min-width:180px">Item</th>
            <th style="padding:8px 10px;text-align:center;width:60px">Qtd</th>
            <th style="padding:8px 10px;text-align:center;width:50px">Un</th>
            ${forns.map((f, i) => `<th style="padding:8px 10px;text-align:center;color:var(--fa-teal);min-width:120px"><div style="font-size:11px">F${i+1}</div><div style="font-size:11px">${typeof f === 'string' ? f.substring(0,18) : 'Forn.'+(i+1)}</div></th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${itens.map((item, idx) => `
            <tr style="border-bottom:1px solid var(--border-color)">
              <td style="padding:8px 10px;color:var(--text-primary)">${item.descricao}</td>
              <td style="padding:8px 10px;text-align:center">${item.qtd}</td>
              <td style="padding:8px 10px;text-align:center">${item.unidade}</td>
              ${forns.map((f, fi) => {
                const existing = rfq.cotacoes?.find(c => c.forn_idx === fi)?.itens?.[idx]?.preco || '';
                return `<td style="padding:4px 6px">
                  <input type="number" data-item="${idx}" data-forn="${fi}" class="cot-flow-input" placeholder="0,00" value="${existing}" min="0" step="0.01"
                    style="width:100%;padding:5px 8px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:6px;color:var(--text-primary);font-size:12px;text-align:right">
                </td>`;
              }).join('')}
            </tr>
          `).join('')}
          <!-- Linha total automático -->
          <tr style="background:var(--bg-tertiary)">
            <td colspan="3" style="padding:8px 10px;font-weight:700;font-size:11px;color:var(--text-secondary)">TOTAL CALCULADO</td>
            ${forns.map((f, fi) => `<td style="padding:8px 10px;text-align:center;font-weight:700;color:var(--fa-teal)" id="total_forn_${fi}">R$ 0,00</td>`).join('')}
          </tr>
          <!-- Prazo de entrega -->
          <tr>
            <td colspan="3" style="padding:8px 10px;font-size:11px;color:var(--text-secondary);font-weight:700">PRAZO ENTREGA (dias)</td>
            ${forns.map((f, fi) => `<td style="padding:4px 6px"><input type="number" data-prazo="${fi}" class="prazo-flow-input" placeholder="dias" min="1" style="width:100%;padding:5px 8px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:6px;color:var(--text-primary);font-size:12px;text-align:center"></td>`).join('')}
          </tr>
          <!-- Condição de pagamento -->
          <tr>
            <td colspan="3" style="padding:8px 10px;font-size:11px;color:var(--text-secondary);font-weight:700">COND. PAGAMENTO</td>
            ${forns.map((f, fi) => `<td style="padding:4px 6px"><select data-cond="${fi}" class="cond-flow-input" style="width:100%;padding:5px 8px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:6px;color:var(--text-primary);font-size:11px"><option value="">Selecionar</option><option>Antecipado</option><option>À entrega</option><option>30 dias</option><option>60 dias</option><option>90 dias</option></select></td>`).join('')}
          </tr>
        </tbody>
      </table>
    </div>
    <script>
      document.querySelectorAll('.cot-flow-input').forEach(inp => {
        inp.addEventListener('input', function() {
          const fi = this.getAttribute('data-forn');
          const inputs = document.querySelectorAll('.cot-flow-input[data-forn="'+fi+'"]');
          const qtds = ${JSON.stringify(itens.map(it=>it.qtd))};
          let total = 0;
          inputs.forEach((v, i) => total += (parseFloat(v.value)||0) * (qtds[i]||1));
          const el = document.getElementById('total_forn_'+fi);
          if(el) el.textContent = 'R$ ' + total.toLocaleString('pt-BR',{minimumFractionDigits:2});
        });
      });
    <\/script>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="salvarCotacoesRFQFlow('${rfqId}')"><i class="fas fa-save"></i> Salvar Cotações</button>
  `);
}

function salvarCotacoesRFQFlow(rfqId) {
  const lista = _getRFQFlow();
  const idx = lista.findIndex(r => r.id === rfqId);
  if (idx < 0) return;
  const rfq = lista[idx];
  const forns = rfq.fornecedores_convidados?.length ? rfq.fornecedores_convidados : ['Fornecedor 1','Fornecedor 2','Fornecedor 3'];
  const itens = rfq.itens || [];

  const cotacoes = forns.map((f, fi) => {
    const itensInputs = document.querySelectorAll(`.cot-flow-input[data-forn="${fi}"]`);
    const prazo = document.querySelector(`.prazo-flow-input[data-prazo="${fi}"]`)?.value || '';
    const cond = document.querySelector(`.cond-flow-input[data-cond="${fi}"]`)?.value || '';
    const itensCot = Array.from(itensInputs).map((inp, ii) => ({
      item_idx: ii, descricao: itens[ii]?.descricao || '', qtd: itens[ii]?.qtd || 1,
      unidade: itens[ii]?.unidade || 'Un', preco: parseFloat(inp.value)||0,
      total: (parseFloat(inp.value)||0) * (itens[ii]?.qtd||1)
    }));
    return {
      forn_idx: fi, fornecedor: f, itens: itensCot,
      total: itensCot.reduce((a,x) => a+x.total, 0),
      prazo_entrega: prazo, cond_pagamento: cond,
      data_registro: new Date().toLocaleDateString('pt-BR')
    };
  });

  lista[idx].cotacoes = cotacoes;
  lista[idx].status = 'Cotações Recebidas';
  _saveRFQFlow(lista);
  logAction('Cotações', 'Compras', `Cotações registradas para ${rfq.numero}`);
  closeModal();
  showToast('✅ Cotações salvas! Agora gere o Mapa Comparativo.', 'success', 5000);
  renderFluxoCompras();
  setTimeout(() => switchFluxoTab('rfq'), 100);
}

// ─── MAPA COMPARATIVO 2.0 ─────────────────────────────────────────────────
function abrirMapaComparativo2(rfqId) {
  const rfq = _getRFQFlow().find(r => r.id === rfqId);
  if (!rfq || !rfq.cotacoes?.length) { showToast('Registre as cotações antes de gerar o mapa.','warning'); return; }

  const cotacoes = rfq.cotacoes;
  const totais = cotacoes.map(c => c.total);
  const menorTotal = Math.min(...totais.filter(t => t > 0));

  openModalWide(`Mapa Comparativo – ${rfq.numero}`, `
    <div style="font-size:14px;font-weight:700;margin-bottom:4px">${rfq.titulo}</div>
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:16px">RC: ${rfq.rc_numero||'—'} · ${cotacoes.length} propostas recebidas</div>

    <!-- Resumo visual por fornecedor com Score IDF -->
    <div style="display:grid;grid-template-columns:repeat(${cotacoes.length},1fr);gap:10px;margin-bottom:16px">
      ${cotacoes.map((c, i) => {
        const isMenor = c.total === menorTotal && c.total > 0;
        // Busca Score IDF do fornecedor
        const nomeForn = typeof c.fornecedor === 'string' ? c.fornecedor : '';
        const idfItem = (typeof _idfDoFornecedor === 'function') ? _idfDoFornecedor(nomeForn) : null;
        const idfCls  = idfItem && (typeof _idfClassificacao === 'function') ? _idfClassificacao(idfItem.score || 0) : null;
        return `
          <div style="padding:12px;background:${isMenor?'rgba(34,197,94,0.12)':'var(--bg-card2)'};border:2px solid ${isMenor?'#22c55e':'var(--border-color)'};border-radius:10px;text-align:center">
            ${isMenor ? '<div style="font-size:9px;font-weight:700;color:#22c55e;margin-bottom:4px">⭐ MENOR PREÇO</div>' : ''}
            <div style="font-size:11px;font-weight:700;color:var(--text-secondary);margin-bottom:4px">F${i+1}</div>
            <div style="font-size:11px;color:var(--text-primary);margin-bottom:6px;word-break:break-word">${nomeForn.substring(0,20)||'Forn.'+(i+1)}</div>
            <div style="font-size:16px;font-weight:700;color:${isMenor?'#22c55e':'var(--text-primary)'}">${fmt(c.total)}</div>
            <div style="font-size:10px;color:var(--text-muted);margin-top:4px">${c.prazo_entrega ? c.prazo_entrega+' dias' : '—'}</div>
            <div style="font-size:10px;color:var(--text-muted)">${c.cond_pagamento||'—'}</div>
            <!-- Score IDF do fornecedor -->
            <div style="margin-top:8px;padding-top:8px;border-top:1px dashed var(--border-color)">
              ${idfItem ? `
                <div style="font-size:9px;color:var(--text-muted);margin-bottom:3px;text-transform:uppercase;letter-spacing:0.5px">Score IDF</div>
                <div style="display:flex;align-items:center;gap:4px;justify-content:center">
                  <div style="width:40px;height:5px;background:rgba(0,0,0,0.15);border-radius:3px;overflow:hidden">
                    <div style="height:100%;background:${idfCls.color};width:${Math.min(idfItem.score||0,100)}%"></div>
                  </div>
                  <span style="font-weight:800;font-size:14px;color:${idfCls.color}">${(idfItem.score||0).toFixed(1)}</span>
                </div>
                <div style="font-size:9px;font-weight:600;color:${idfCls.color};margin-top:2px">${idfCls.label}</div>
              ` : '<div style="font-size:9px;color:var(--text-muted)"><i class="fas fa-chart-bar"></i> Sem IDF</div>'}
            </div>
          </div>
        `;
      }).join('')}
    </div>

    <!-- Tabela detalhada por item -->
    <div style="font-size:12px;font-weight:700;color:var(--text-secondary);margin-bottom:8px">ANÁLISE POR ITEM</div>
    <div style="overflow-x:auto;margin-bottom:16px">
      <table style="width:100%;border-collapse:collapse;font-size:11px">
        <thead>
          <tr style="background:var(--bg-tertiary)">
            <th style="padding:8px 10px;text-align:left">Item</th>
            <th style="padding:8px 10px;text-align:center">Qtd</th>
            ${cotacoes.map((c,i) => `<th style="padding:8px 10px;text-align:right;color:var(--fa-teal)">F${i+1}: ${typeof c.fornecedor==='string'?c.fornecedor.substring(0,12):'Forn.'+(i+1)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${(rfq.itens||[]).map((it, idx) => {
            const precos = cotacoes.map(c => c.itens?.[idx]?.preco || 0);
            const menor = Math.min(...precos.filter(p => p > 0));
            return `
              <tr style="border-bottom:1px solid var(--border-color)">
                <td style="padding:8px 10px;color:var(--text-primary)">${it.descricao}</td>
                <td style="padding:8px 10px;text-align:center">${it.qtd} ${it.unidade}</td>
                ${precos.map(p => `<td style="padding:8px 10px;text-align:right;${p===menor&&p>0?'color:#22c55e;font-weight:700':''}">${p>0?fmt(p):'—'}</td>`).join('')}
              </tr>
            `;
          }).join('')}
          <tr style="background:rgba(0,180,184,0.06)">
            <td colspan="2" style="padding:8px 10px;font-weight:700;text-align:right">TOTAL GERAL</td>
            ${totais.map(t => `<td style="padding:8px 10px;text-align:right;font-weight:700;${t===menorTotal&&t>0?'color:#22c55e':''}">${t>0?fmt(t):'—'}</td>`).join('')}
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Critério e seleção -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Critério de Seleção</label>
        <select class="form-control" id="mapa_criterio">
          <option value="menor_preco">Menor Preço Total</option>
          <option value="menor_prazo">Menor Prazo de Entrega</option>
          <option value="tecnico_comercial">Melhor Técnico-Comercial</option>
          <option value="fornecedor_unico">Fornecedor Único / Exclusivo</option>
          <option value="manual">Indicação Manual do Comprador</option>
        </select>
      </div>
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Fornecedor Indicado</label>
        <select class="form-control" id="mapa_forn_sel">
          <option value="">Auto (baseado no critério)</option>
          ${cotacoes.map((c,i) => `<option value="${i}">${typeof c.fornecedor==='string'?c.fornecedor:'Forn.'+(i+1)} – ${fmt(c.total)}</option>`).join('')}
        </select>
      </div>
    </div>

    <!-- Multi-fornecedor por linha -->
    <div style="padding:10px;background:rgba(139,92,246,0.08);border:1px solid rgba(139,92,246,0.25);border-radius:8px;margin-bottom:12px">
      <div style="font-size:11px;font-weight:700;color:#8b5cf6;margin-bottom:8px"><i class="fas fa-sitemap" style="margin-right:6px"></i>OPÇÃO: PEDIDOS SEPARADOS POR FORNECEDOR (múltiplos PCs)</div>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${(rfq.itens||[]).map((it, idx) => {
          const precos = cotacoes.map((c,fi) => ({ fi, forn: c.fornecedor, preco: c.itens?.[idx]?.preco||0 }));
          const menor = precos.filter(p=>p.preco>0).sort((a,b)=>a.preco-b.preco)[0];
          return `
            <div style="display:flex;align-items:center;gap:8px;font-size:12px">
              <input type="checkbox" id="multi_${idx}" style="accent-color:#8b5cf6">
              <label for="multi_${idx}" style="flex:1;cursor:pointer">${it.descricao} → comprar de: </label>
              <select id="multi_forn_${idx}" style="padding:4px 8px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:6px;color:var(--text-primary);font-size:11px">
                ${cotacoes.map((c,fi) => `<option value="${fi}" ${fi===menor?.fi?'selected':''}>${typeof c.fornecedor==='string'?c.fornecedor:'Forn.'+(fi+1)} – ${c.itens?.[idx]?.preco?fmt(c.itens[idx].preco):'sem preço'}</option>`).join('')}
              </select>
            </div>
          `;
        }).join('')}
      </div>
    </div>

    <div>
      <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Justificativa da Seleção *</label>
      <textarea class="form-control" id="mapa_justificativa" rows="2" placeholder="Descreva o critério de seleção e eventuais justificativas..."></textarea>
    </div>
    <input type="hidden" id="mapa_rfq_id" value="${rfqId}">
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-info" onclick="exportarMapaPDF('${rfqId}')"><i class="fas fa-file-pdf"></i> Exportar PDF</button>
    <button class="btn btn-primary" onclick="salvarMapaComparativo2('${rfqId}')"><i class="fas fa-save"></i> Salvar Mapa e Enviar para Aprovação</button>
  `);
}

function salvarMapaComparativo2(rfqId) {
  const rfq = _getRFQFlow().find(r => r.id === rfqId);
  if (!rfq) return;

  const criterio = document.getElementById('mapa_criterio')?.value;
  const fornSelIdx = document.getElementById('mapa_forn_sel')?.value;
  const justificativa = document.getElementById('mapa_justificativa')?.value.trim();

  if (!justificativa) { showToast('Preencha a justificativa da seleção.', 'warning'); return; }

  // Determinar fornecedor selecionado
  const cotacoes = rfq.cotacoes || [];
  let fornSelecionado = '', valorSelecionado = 0, idx_sel = -1;

  if (fornSelIdx !== '') {
    idx_sel = parseInt(fornSelIdx);
    fornSelecionado = typeof cotacoes[idx_sel]?.fornecedor === 'string' ? cotacoes[idx_sel].fornecedor : 'Forn.'+(idx_sel+1);
    valorSelecionado = cotacoes[idx_sel]?.total || 0;
  } else {
    if (criterio === 'menor_preco') {
      const totais = cotacoes.map((c,i) => ({ i, total: c.total }));
      const melhor = totais.filter(t=>t.total>0).sort((a,b)=>a.total-b.total)[0];
      idx_sel = melhor?.i ?? 0;
      fornSelecionado = typeof cotacoes[idx_sel]?.fornecedor === 'string' ? cotacoes[idx_sel].fornecedor : 'Forn.'+(idx_sel+1);
      valorSelecionado = cotacoes[idx_sel]?.total || 0;
    }
  }

  // Coleta configuração multi-fornecedor
  const multiForn = [];
  (rfq.itens||[]).forEach((it, ii) => {
    const cb = document.getElementById(`multi_${ii}`);
    if (cb?.checked) {
      const fi = parseInt(document.getElementById(`multi_forn_${ii}`)?.value || '0');
      multiForn.push({ item_idx: ii, descricao: it.descricao, forn_idx: fi, fornecedor: cotacoes[fi]?.fornecedor || 'Forn.'+(fi+1), preco: cotacoes[fi]?.itens?.[ii]?.preco || 0 });
    }
  });

  const lista = _getMapasComp();
  const novoMapa = {
    id: gerarId('MAPA'),
    numero: `MC-${new Date().getFullYear()}-${String(lista.length+1).padStart(3,'0')}`,
    rfq_id: rfqId,
    rfq_numero: rfq.numero,
    rc_id: rfq.rc_id,
    rc_numero: rfq.rc_numero,
    titulo: rfq.titulo,
    cotacoes: rfq.cotacoes,
    itens: rfq.itens,
    criterio,
    fornecedor_selecionado: fornSelecionado,
    idx_fornecedor_selecionado: idx_sel,
    valor_selecionado: valorSelecionado,
    multi_fornecedor: multiForn,
    justificativa,
    status: 'Aguardando Aprovação',
    estagio_aprovacao: 1,
    estagios: [],
    criado_por: currentUser?.name,
    criado_em: new Date().toISOString()
  };

  lista.unshift(novoMapa);
  _saveMapasComp(lista);

  // Atualiza status do RFQ
  const rfqs = _getRFQFlow();
  const rIdx = rfqs.findIndex(r => r.id === rfqId);
  if (rIdx >= 0) { rfqs[rIdx].status = 'Mapa Criado'; _saveRFQFlow(rfqs); }

  logAction('Mapa Comparativo', 'Compras', `${novoMapa.numero} criado para ${rfq.numero}`);
  closeModal();
  showToast(`✅ Mapa ${novoMapa.numero} criado! Enviado para aprovação em 3 estágios.`, 'success', 5000);
  renderFluxoCompras();
  setTimeout(() => switchFluxoTab('mapa'), 150);
}

function exportarMapaPDF(rfqId) {
  const rfq = _getRFQFlow().find(r => r.id === rfqId);
  if (!rfq || !rfq.cotacoes?.length) return;
  const cotacoes = rfq.cotacoes;
  const totais = cotacoes.map(c => c.total);
  const menorTotal = Math.min(...totais.filter(t => t > 0));

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Mapa Comparativo – ${rfq.numero}</title>
    <style>
      body { font-family:Arial,sans-serif; font-size:11px; color:#222; margin:28px; }
      .header { display:flex; justify-content:space-between; border-bottom:2px solid #e67e22; padding-bottom:10px; margin-bottom:14px; }
      .logo-text { font-size:20px; font-weight:900; color:#e67e22; }
      h2 { color:#e67e22; font-size:13px; }
      table { width:100%; border-collapse:collapse; margin:8px 0; font-size:11px; }
      th { background:#e67e22; color:#fff; padding:7px 8px; text-align:center; }
      th:first-child { text-align:left; }
      td { padding:6px 8px; border-bottom:1px solid #ddd; }
      .melhor { background:#d1fae5; font-weight:bold; color:#065f46; }
      .total-row { background:#f3f4f6; font-weight:bold; }
      .footer { margin-top:30px; font-size:9px; color:#999; border-top:1px solid #ddd; padding-top:6px; }
    </style>
    </head><body>
    <div class="header">
      <div><div class="logo-text">FRASER ALEXANDER</div><div style="font-size:9px;color:#666">Gestão de Suprimentos</div></div>
      <div style="text-align:right"><h2>MAPA COMPARATIVO DE PROPOSTAS</h2><div>RFQ: <strong>${rfq.numero}</strong></div><div>Data: ${new Date().toLocaleDateString('pt-BR')}</div></div>
    </div>
    <table>
      <tr><td><strong>Processo:</strong></td><td>${rfq.numero}</td><td><strong>RC Origem:</strong></td><td>${rfq.rc_numero||'—'}</td></tr>
      <tr><td><strong>Título:</strong></td><td colspan="3">${rfq.titulo}</td></tr>
    </table>
    <br>
    <table>
      <thead><tr>
        <th>Item</th><th>Qtd</th>
        ${cotacoes.map((c,i) => `<th>F${i+1}: ${typeof c.fornecedor==='string'?c.fornecedor.substring(0,15):'Forn.'+(i+1)}</th>`).join('')}
      </tr></thead>
      <tbody>
        ${(rfq.itens||[]).map((it, idx) => {
          const precos = cotacoes.map(c => c.itens?.[idx]?.preco||0);
          const menor = Math.min(...precos.filter(p=>p>0));
          return `<tr>
            <td>${it.descricao}</td><td style="text-align:center">${it.qtd} ${it.unidade}</td>
            ${precos.map(p => `<td class="${p===menor&&p>0?'melhor':''}" style="text-align:right">${p>0?'R$ '+p.toFixed(2):'—'}</td>`).join('')}
          </tr>`;
        }).join('')}
        <tr class="total-row">
          <td colspan="2" style="text-align:right">TOTAL:</td>
          ${totais.map(t => `<td class="${t===menorTotal&&t>0?'melhor':''}" style="text-align:right">${t>0?'R$ '+t.toFixed(2):'—'}</td>`).join('')}
        </tr>
        <tr>
          <td colspan="2" style="text-align:right">Prazo (dias):</td>
          ${cotacoes.map(c => `<td style="text-align:center">${c.prazo_entrega||'—'}</td>`).join('')}
        </tr>
        <tr>
          <td colspan="2" style="text-align:right">Cond. Pgto:</td>
          ${cotacoes.map(c => `<td style="text-align:center">${c.cond_pagamento||'—'}</td>`).join('')}
        </tr>
      </tbody>
    </table>
    <div class="footer">Fraser Alexander · Gerado em ${new Date().toLocaleString('pt-BR')} · Documento confidencial</div>
    </body></html>`;
  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); w.print(); }
}

// ─── TAB: MAPA COMPARATIVO ─────────────────────────────────────────────────
function _renderTabMapa(lista) {
  if (!lista.length) return `<div style="text-align:center;padding:40px;color:var(--text-muted)"><i class="fas fa-balance-scale" style="font-size:32px;display:block;margin-bottom:12px"></i>Nenhum mapa comparativo. Finalize uma cotação RFQ para gerar.</div>`;

  return `
    <div style="padding:16px">
      <div style="display:flex;justify-content:flex-end;margin-bottom:12px;gap:8px">
        <select id="filterMapaStatus" onchange="filtrarMapa()" style="padding:7px 10px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:12px">
          <option value="">Todos os Status</option>
          <option>Aguardando Aprovação</option>
          <option>Aprovado</option>
          <option>PC Emitido</option>
          <option>Rejeitado</option>
        </select>
      </div>
      <div id="tabelaMapa">
        ${_renderTabelaMapa(lista)}
      </div>
    </div>
  `;
}

function _renderTabelaMapa(lista) {
  return `
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr style="background:var(--bg-tertiary)">
          <th style="padding:9px 12px;text-align:left;color:var(--text-secondary);font-size:11px">Nº Mapa</th>
          <th style="padding:9px 12px;text-align:left;color:var(--text-secondary);font-size:11px">Título</th>
          <th style="padding:9px 12px;text-align:left;color:var(--text-secondary);font-size:11px">RFQ / RC</th>
          <th style="padding:9px 12px;text-align:left;color:var(--text-secondary);font-size:11px">Forn. Selecionado</th>
          <th style="padding:9px 12px;text-align:right;color:var(--text-secondary);font-size:11px">Valor</th>
          <th style="padding:9px 12px;text-align:center;color:var(--text-secondary);font-size:11px">Aprovação</th>
          <th style="padding:9px 12px;text-align:center;color:var(--text-secondary);font-size:11px">Status</th>
          <th style="padding:9px 12px;text-align:center;color:var(--text-secondary);font-size:11px">Ações</th>
        </tr></thead>
        <tbody>
          ${lista.map(m => `
            <tr style="border-bottom:1px solid var(--border-color)" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='transparent'">
              <td style="padding:9px 12px;font-weight:700;color:var(--orange)">${m.numero}</td>
              <td style="padding:9px 12px;color:var(--text-primary)">${m.titulo}</td>
              <td style="padding:9px 12px;color:var(--text-muted);font-size:11px">${m.rfq_numero||'—'} / ${m.rc_numero||'—'}</td>
              <td style="padding:9px 12px;color:var(--green-light);font-size:12px;font-weight:600">${m.fornecedor_selecionado||'—'}</td>
              <td style="padding:9px 12px;text-align:right;font-weight:600">${fmt(m.valor_selecionado)}</td>
              <td style="padding:9px 12px;text-align:center">${_renderAprovacaoMapaMini(m)}</td>
              <td style="padding:9px 12px;text-align:center">${_mapaBadge(m.status)}</td>
              <td style="padding:9px 12px;text-align:center">
                <div style="display:flex;gap:4px;justify-content:center">
                  <button onclick="verDetalheMapa2('${m.id}')" class="btn btn-secondary btn-sm btn-icon" title="Ver"><i class="fas fa-eye"></i></button>
                  ${m.status === 'Aguardando Aprovação' && _podeAprovarMapa(m) ? `<button onclick="aprovarMapa2('${m.id}')" class="btn btn-success btn-sm btn-icon" title="Aprovar"><i class="fas fa-check"></i></button>` : ''}
                  ${m.status === 'Aprovado' ? `<button onclick="navigate('pedidos')" class="btn btn-sm" title="Ir para Pedidos de Compra" style="background:rgba(59,130,246,0.1);color:#3b82f6;border:1px solid rgba(59,130,246,0.3);font-size:11px"><i class="fas fa-arrow-right" style="margin-right:3px"></i>Ir p/ Pedidos</button>` : ''}
                  <button onclick="exportarMapaPDF2('${m.id}')" class="btn btn-secondary btn-sm btn-icon" title="PDF"><i class="fas fa-file-pdf"></i></button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function filtrarMapa() {
  const st = document.getElementById('filterMapaStatus')?.value || '';
  const f = _getMapasComp().filter(m => !st || m.status === st);
  const el = document.getElementById('tabelaMapa');
  if (el) el.innerHTML = _renderTabelaMapa(f);
}

function _mapaBadge(s) {
  const map = { 'Aguardando Aprovação':'#f59e0b','Aprovado':'#22c55e','PC Emitido':'#10b981','Rejeitado':'#ef4444' };
  const cor = map[s] || '#8b949e';
  return `<span style="background:${cor}22;color:${cor};border-radius:6px;padding:3px 7px;font-size:10px;font-weight:700">${s}</span>`;
}

function _renderAprovacaoMapaMini(m) {
  const cfg = _getConfigAprovacao();
  const total = 3;
  const atual = m.estagio_aprovacao || 1;
  const aprovados = (m.estagios || []).length;
  const badges = [];
  for (let i = 1; i <= total; i++) {
    const ap = (m.estagios||[]).find(e => e.estagio === i);
    const cor = ap ? (ap.status === 'Aprovado' ? '#22c55e' : '#ef4444') : (i === atual && m.status === 'Aguardando Aprovação' ? '#f59e0b' : '#8b949e');
    badges.push(`<span style="display:inline-block;width:16px;height:16px;border-radius:50%;background:${cor};margin:1px;line-height:16px;text-align:center;font-size:9px;color:#fff;font-weight:700">${i}</span>`);
  }
  return badges.join('');
}

function _podeAprovarMapa(m) {
  if (!currentUser) return false;
  const cfg = _getConfigAprovacao();
  const est = m.estagio_aprovacao || 1;
  // Usa configuração específica de mapa se disponível, senão usa a de RC como fallback
  const mapcfg = {
    1: cfg.mapa_estagio1 || cfg.estagio1,
    2: cfg.mapa_estagio2 || cfg.estagio2,
    3: cfg.estagio3
  };
  const eCfg = mapcfg[est] || {};
  const perfisOk = (eCfg.perfis || ['operacao','admin']).includes(currentUser.profile);
  const usuariosOk = (eCfg.usuarios || []).length > 0
    ? (eCfg.usuarios || []).includes(currentUser.name)
    : true; // se não houver usuários específicos, qualquer perfil autorizado pode
  return perfisOk && usuariosOk;
}

function verDetalheMapa2(mapaId) {
  const m = _getMapasComp().find(x => x.id === mapaId);
  if (!m) return;
  openModalWide(`Mapa Comparativo – ${m.numero}`, `
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">${_mapaBadge(m.status)}<span style="background:rgba(255,255,255,0.08);padding:3px 8px;border-radius:6px;font-size:11px">${m.criterio}</span></div>
    <div style="font-size:14px;font-weight:700;margin-bottom:4px">${m.titulo}</div>
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:14px">RFQ: ${m.rfq_numero} · RC: ${m.rc_numero||'—'}</div>

    <!-- Aprovação 3 estágios -->
    <div style="font-size:12px;font-weight:700;margin-bottom:8px">FLUXO DE APROVAÇÃO (3 ESTÁGIOS)</div>
    <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap">
      ${[1,2,3].map(i => {
        const cfg_e = i===1?_getConfigAprovacao().estagio1:i===2?_getConfigAprovacao().estagio2:_getConfigAprovacao().estagio3;
        const ap = (m.estagios||[]).find(e=>e.estagio===i);
        const isAtual = m.estagio_aprovacao === i && m.status === 'Aguardando Aprovação';
        const cor = ap ? (ap.status==='Aprovado'?'#22c55e':'#ef4444') : isAtual?'#f59e0b':'#8b949e';
        return `<div style="flex:1;min-width:200px;padding:10px;background:${ap?.status==='Aprovado'?'rgba(34,197,94,0.08)':isAtual?'rgba(245,158,11,0.08)':'var(--bg-card2)'};border:1px solid ${cor}44;border-radius:8px">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
            <div style="width:20px;height:20px;border-radius:50%;background:${cor};display:flex;align-items:center;justify-content:center;font-size:10px;color:#fff;font-weight:700">${i}</div>
            <div style="font-size:11px;font-weight:700;color:var(--text-primary)">${cfg_e?.nome||'Estágio '+i}</div>
          </div>
          <div style="font-size:11px;color:var(--text-muted)">${ap ? ap.aprovador+' · '+ap.data : isAtual ? '⏳ Aguardando aprovação' : '—'}</div>
          ${ap?.obs ? `<div style="font-size:10px;color:var(--text-muted);margin-top:4px;font-style:italic">"${ap.obs}"</div>` : ''}
        </div>`;
      }).join('')}
    </div>

    <!-- Resumo fornecedor selecionado + Score IDF -->
    ${(() => {
      const idfForn = (typeof _idfDoFornecedor === 'function') ? _idfDoFornecedor(m.fornecedor_selecionado) : null;
      const idfCls  = idfForn && (typeof _idfClassificacao === 'function') ? _idfClassificacao(idfForn.score || 0) : null;
      return `
    <div style="padding:14px;background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.3);border-radius:10px;margin-bottom:14px">
      <div style="font-size:11px;color:var(--green-light);font-weight:700;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px">Fornecedor Selecionado</div>
      <div style="display:flex;align-items:flex-start;gap:16px;flex-wrap:wrap">
        <div style="flex:1;min-width:200px">
          <div style="font-size:15px;font-weight:700;color:var(--text-primary)">${m.fornecedor_selecionado || '—'}</div>
          <div style="font-size:12px;color:var(--text-secondary);margin-top:3px">Valor: <strong>${fmt(m.valor_selecionado)}</strong> · Critério: ${m.criterio}</div>
          ${m.justificativa ? `<div style="font-size:11px;color:var(--text-muted);margin-top:6px;font-style:italic">"${m.justificativa}"</div>` : ''}
        </div>
        <div style="min-width:140px;padding:10px;background:${idfForn ? 'linear-gradient(135deg,#1e3a5f,#2563eb)' : 'var(--bg-secondary)'};border-radius:8px;text-align:center;color:${idfForn ? '#fff' : 'var(--text-muted)'}">
          <div style="font-size:10px;opacity:0.8;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.5px">Score IDF</div>
          ${idfForn ? `
            <div style="font-size:28px;font-weight:800">${(idfForn.score||0).toFixed(1)}</div>
            <div style="height:6px;background:rgba(255,255,255,0.2);border-radius:3px;margin:6px 0;overflow:hidden">
              <div style="height:100%;background:${idfCls.color};border-radius:3px;width:${Math.min(idfForn.score||0,100)}%"></div>
            </div>
            <div style="font-size:10px;font-weight:700;color:${idfCls.color};background:${idfCls.bg};padding:2px 8px;border-radius:10px;display:inline-block">${idfCls.label}</div>
            <div style="font-size:9px;opacity:0.7;margin-top:4px">Avaliado em ${idfForn.data||'—'}</div>
          ` : '<div style="font-size:22px">—</div><div style="font-size:10px;margin-top:4px">Sem avaliação</div>'}
        </div>
      </div>
    </div>`;
    })()}

    ${m.multi_fornecedor?.length ? `
      <div style="font-size:12px;font-weight:700;color:#8b5cf6;margin-bottom:6px"><i class="fas fa-sitemap" style="margin-right:6px"></i>ITENS COM FORNECEDORES DIFERENTES</div>
      ${m.multi_fornecedor.map(mf => `<div style="font-size:12px;padding:6px 8px;background:rgba(139,92,246,0.08);border-radius:6px;margin-bottom:4px">${mf.descricao} → ${mf.fornecedor} (${fmt(mf.preco)})</div>`).join('')}
    ` : ''}
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
    ${m.status === 'Aguardando Aprovação' && _podeAprovarMapa(m) ? `
      <button class="btn btn-danger" onclick="closeModal();rejeitarMapa2('${m.id}')"><i class="fas fa-times"></i> Reprovar</button>
      <button class="btn btn-success" onclick="aprovarMapa2('${m.id}')"><i class="fas fa-check"></i> Aprovar Estágio ${m.estagio_aprovacao||1}</button>
    ` : ''}
    ${m.status === 'Aprovado' ? `<button class="btn btn-sm" onclick="closeModal();navigate('pedidos')" style="background:rgba(59,130,246,0.12);color:#3b82f6;border:1px solid rgba(59,130,246,0.35);padding:8px 16px;border-radius:7px;font-weight:600;font-size:12px;cursor:pointer"><i class="fas fa-arrow-right" style="margin-right:5px"></i>Emitir na aba Pedidos de Compra</button>` : ''}
    <button class="btn btn-info" onclick="exportarMapaPDF2('${m.id}')"><i class="fas fa-file-pdf"></i> Exportar PDF</button>
  `);
}

function aprovarMapa2(mapaId) {
  const lista = _getMapasComp();
  const idx = lista.findIndex(x => x.id === mapaId);
  if (idx < 0) return;
  const m = lista[idx];
  const est = m.estagio_aprovacao || 1;
  const cfg = _getConfigAprovacao();
  const nomeEstagio = est===1?cfg.estagio1.nome:est===2?cfg.estagio2.nome:cfg.estagio3.nome;

  openModal(`Aprovar Mapa – Estágio ${est}: ${nomeEstagio}`, `
    <div style="margin-bottom:12px;font-size:13px;color:var(--text-secondary)">Confirme a aprovação do Mapa Comparativo <strong>${m.numero}</strong></div>
    <div style="margin-bottom:12px;padding:10px;background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.3);border-radius:8px;font-size:12px">
      Fornecedor Selecionado: <strong>${m.fornecedor_selecionado}</strong> · Valor: <strong>${fmt(m.valor_selecionado)}</strong>
    </div>
    <textarea id="obs_aprov_mapa" rows="2" placeholder="Observação (opcional)..." style="width:100%;padding:8px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:6px;color:var(--text-primary);font-size:12px;box-sizing:border-box;resize:vertical"></textarea>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-danger" onclick="closeModal();rejeitarMapa2('${mapaId}')"><i class="fas fa-times"></i> Reprovar</button>
    <button class="btn btn-success" onclick="_confirmarAprovarMapa2('${mapaId}')"><i class="fas fa-check"></i> Aprovar</button>
  `);
}

function _confirmarAprovarMapa2(mapaId) {
  const lista = _getMapasComp();
  const idx = lista.findIndex(x => x.id === mapaId);
  if (idx < 0) return;
  const m = lista[idx];
  const est = m.estagio_aprovacao || 1;
  const obs = document.getElementById('obs_aprov_mapa')?.value.trim() || '';
  const hoje = new Date().toLocaleString('pt-BR');
  const cfg = _getConfigAprovacao();

  if (!m.estagios) m.estagios = [];
  m.estagios.push({ estagio: est, status: 'Aprovado', aprovador: currentUser?.name, data: hoje, obs });

  if (est >= 3) {
    m.status = 'Aprovado';
    m.estagio_aprovacao = 4;
    // Notificação ao Diretor (simulada)
    // MELHORIA 3: Após aprovação do mapa, informar que a emissão de PC deve ser feita na aba Pedidos
    showToast(`✅ Mapa ${m.numero} APROVADO! Para emitir o Pedido de Compra, acesse a aba Pedidos de Compra.`, 'success', 7000);
    logAction('Mapa Aprovado', 'Compras', `${m.numero} aprovado por ${currentUser?.name} – Pronto para PC`);
  } else {
    m.estagio_aprovacao = est + 1;
    const proximo = est+1===2?cfg.estagio2.nome:cfg.estagio3.nome;
    showToast(`Estágio ${est} aprovado! Avançando para ${proximo}.`, 'success');
    logAction('Aprovação Mapa', 'Compras', `${m.numero} – Estágio ${est} aprovado por ${currentUser?.name}`);
  }

  lista[idx] = m;
  _saveMapasComp(lista);
  closeModal();
  renderFluxoCompras();
  setTimeout(() => switchFluxoTab('mapa'), 100);
}

function rejeitarMapa2(mapaId) {
  openModal('Reprovar Mapa Comparativo', `
    <textarea id="motivo_rej_mapa" rows="3" placeholder="Informe o motivo da reprovação..." style="width:100%;padding:8px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:6px;color:var(--text-primary);font-size:13px;box-sizing:border-box;resize:vertical"></textarea>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-danger" onclick="_confirmarRejeitarMapa2('${mapaId}')"><i class="fas fa-times"></i> Reprovar</button>
  `);
}

function _confirmarRejeitarMapa2(mapaId) {
  const motivo = document.getElementById('motivo_rej_mapa')?.value.trim() || 'Sem motivo';
  const lista = _getMapasComp();
  const idx = lista.findIndex(x => x.id === mapaId);
  if (idx < 0) return;
  lista[idx].status = 'Rejeitado';
  lista[idx].motivo_rejeicao = motivo;
  _saveMapasComp(lista);
  logAction('Mapa Rejeitado', 'Compras', `${lista[idx].numero}: ${motivo}`);
  closeModal();
  showToast('Mapa reprovado. Comprador será notificado.', 'warning');
  renderFluxoCompras();
}

function exportarMapaPDF2(mapaId) {
  const m = _getMapasComp().find(x => x.id === mapaId);
  if (!m) return;
  // Reutiliza lógica da exportação de RFQ
  const rfq = _getRFQFlow().find(r => r.id === m.rfq_id);
  if (rfq) exportarMapaPDF(rfq.id);
  else showToast('RFQ não encontrada para exportação.', 'warning');
}

// ─── EMISSÃO DE PEDIDO DE COMPRA DO MAPA ───────────────────────────────────
function emitirPedidoDoMapa(mapaId) {
  const m = _getMapasComp().find(x => x.id === mapaId);
  if (!m) return;

  const temMulti = m.multi_fornecedor?.length > 0;
  const rfq = _getRFQFlow().find(r => r.id === m.rfq_id);
  const cotSelecionada = rfq?.cotacoes?.[m.idx_fornecedor_selecionado];

  openModalWide(`Emitir Pedido de Compra – ${m.numero}`, `
    ${(() => {
      const idfForn2 = (typeof _idfDoFornecedor === 'function') ? _idfDoFornecedor(m.fornecedor_selecionado) : null;
      const idfCls2  = idfForn2 && (typeof _idfClassificacao === 'function') ? _idfClassificacao(idfForn2.score || 0) : null;
      return `
    <div style="margin-bottom:14px;padding:14px;background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.3);border-radius:10px">
      <div style="font-size:11px;font-weight:700;color:var(--green-light);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px"><i class="fas fa-check-circle" style="margin-right:4px"></i>Mapa Aprovado – ${m.numero}</div>
      <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
        <div style="flex:1;min-width:180px">
          <div style="font-size:14px;font-weight:700;color:var(--text-primary)">${m.fornecedor_selecionado}</div>
          <div style="font-size:12px;color:var(--text-secondary);margin-top:2px">Valor: <strong>${fmt(m.valor_selecionado)}</strong> · Critério: ${m.criterio}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px">Aprovado em ${(m.estagios||[]).length} estágio(s)</div>
        </div>
        <!-- Score IDF na emissão do pedido -->
        <div style="padding:10px 14px;border-radius:8px;background:${idfForn2 ? 'linear-gradient(135deg,#1e3a5f,#1d4ed8)' : 'var(--bg-secondary)'};color:${idfForn2 ? '#fff' : 'var(--text-muted)'};text-align:center;min-width:130px">
          <div style="font-size:9px;opacity:0.75;margin-bottom:3px;text-transform:uppercase;letter-spacing:0.5px">Score IDF</div>
          ${idfForn2 ? `
            <div style="font-size:26px;font-weight:900">${(idfForn2.score||0).toFixed(1)}</div>
            <div style="height:5px;background:rgba(255,255,255,0.2);border-radius:3px;margin:5px 0;overflow:hidden">
              <div style="height:100%;background:${idfCls2.color};border-radius:3px;width:${Math.min(idfForn2.score||0,100)}%"></div>
            </div>
            <div style="font-size:9px;font-weight:700;background:${idfCls2.bg};color:${idfCls2.color};padding:2px 6px;border-radius:8px;display:inline-block">${idfCls2.label}</div>
          ` : '<div style="font-size:20px">—</div><div style="font-size:9px;margin-top:2px">Sem avaliação IDF</div>'}
        </div>
      </div>
    </div>`;
    })()}

    ${temMulti ? `
      <div style="padding:10px;background:rgba(139,92,246,0.08);border:1px solid rgba(139,92,246,0.25);border-radius:8px;margin-bottom:12px">
        <div style="font-size:11px;font-weight:700;color:#8b5cf6;margin-bottom:6px"><i class="fas fa-sitemap" style="margin-right:4px"></i>ATENÇÃO: Este mapa contém itens de fornecedores diferentes</div>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px">
          <input type="radio" name="tipo_pc" value="unico" checked style="accent-color:#8b5cf6">
          <span>Emitir um único PC (com todos os itens do fornecedor principal)</span>
        </label>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;margin-top:6px">
          <input type="radio" name="tipo_pc" value="multiplo" style="accent-color:#8b5cf6">
          <span>Emitir PCs separados por fornecedor (como SAP)</span>
        </label>
      </div>
    ` : ''}

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Condição de Pagamento</label>
        <select class="form-control" id="pc_cond_pag">
          <option value="30 dias">30 dias</option>
          <option value="60 dias">60 dias</option>
          <option value="À entrega">À entrega</option>
          <option value="Antecipado">Antecipado (vai direto ao AP)</option>
          <option value="Personalizado">Personalizado</option>
        </select>
      </div>
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Prazo de Entrega Acordado</label>
        <input class="form-control" id="pc_prazo_entrega" value="${cotSelecionada?.prazo_entrega||''}" placeholder="Ex: 15 dias">
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Local de Entrega</label>
        <input class="form-control" id="pc_local" placeholder="Obra / Almoxarifado / Endereço">
      </div>
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Responsável pela Entrega (Fraser)</label>
        <input class="form-control" id="pc_responsavel" value="${currentUser?.name||''}" placeholder="Nome do responsável">
      </div>
    </div>

    <div style="margin-bottom:12px">
      <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Observações para o Fornecedor</label>
      <textarea class="form-control" id="pc_obs" rows="2" placeholder="Instruções de entrega, contato, etc."></textarea>
    </div>

    <!-- Histórico de aprovação -->
    <div style="padding:10px;background:rgba(255,255,255,0.04);border-radius:8px;font-size:11px;color:var(--text-muted)">
      <div style="font-weight:700;color:var(--text-secondary);margin-bottom:6px">HISTÓRICO DE APROVAÇÃO INCLUSO NO PC:</div>
      ${(m.estagios||[]).map(e => `<div style="padding:4px 0;border-bottom:1px solid var(--border-color)">✓ Estágio ${e.estagio}: ${e.aprovador} em ${e.data}</div>`).join('')}
    </div>

    <input type="hidden" id="pc_mapa_id" value="${mapaId}">
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="confirmarEmissaoPC()"><i class="fas fa-shopping-bag"></i> Emitir Pedido de Compra</button>
  `);
}

function confirmarEmissaoPC() {
  const mapaId = document.getElementById('pc_mapa_id')?.value;
  const condPag = document.getElementById('pc_cond_pag')?.value;
  const prazoEntrega = document.getElementById('pc_prazo_entrega')?.value.trim();
  const local = document.getElementById('pc_local')?.value.trim();
  const responsavel = document.getElementById('pc_responsavel')?.value.trim();
  const obs = document.getElementById('pc_obs')?.value.trim();
  const tipoPc = document.querySelector('input[name="tipo_pc"]:checked')?.value || 'unico';

  const m = _getMapasComp().find(x => x.id === mapaId);
  if (!m) return;
  const rfq = _getRFQFlow().find(r => r.id === m.rfq_id);
  const cotSelecionada = rfq?.cotacoes?.[m.idx_fornecedor_selecionado];

  if (tipoPc === 'multiplo' && m.multi_fornecedor?.length > 0) {
    // Criar múltiplos PCs
    _emitirPCsMultiplos(m, rfq, condPag, prazoEntrega, local, responsavel, obs);
  } else {
    // Criar um único PC
    _emitirPCUnico(m, rfq, cotSelecionada, condPag, prazoEntrega, local, responsavel, obs);
  }
}

function _emitirPCUnico(m, rfq, cot, condPag, prazoEntrega, local, responsavel, obs) {
  const pedidos = typeof _getPedidos === 'function' ? _getPedidos() : [];
  const numPedido = `PC-${new Date().getFullYear()}-${String(pedidos.length+1).padStart(4,'0')}`;
  const hoje = new Date().toLocaleDateString('pt-BR');

  const novoPedido = {
    id: gerarId('PC'),
    numero: numPedido,
    mapa_id: m.id,
    mapa_numero: m.numero,
    rfq_numero: m.rfq_numero,
    rc_numero: m.rc_numero,
    fornecedor: m.fornecedor_selecionado,
    titulo: m.titulo,
    itens: m.itens || rfq?.itens || [],
    valor_total: m.valor_selecionado,
    cond_pagamento: condPag,
    prazo_entrega: prazoEntrega,
    local_entrega: local,
    responsavel: responsavel,
    observacoes: obs,
    status: condPag === 'Antecipado' ? 'Aguardando Pagamento AP' : 'Aguardando Entrega',
    historico_aprovacao: m.estagios || [],
    emitido_por: currentUser?.name,
    data_emissao: hoje
  };

  pedidos.unshift(novoPedido);
  if (typeof _savePedidos === 'function') _savePedidos(pedidos);
  else localStorage.setItem('fa_pedidos', JSON.stringify(pedidos));

  // Atualiza status do mapa
  const mapas = _getMapasComp();
  const mIdx = mapas.findIndex(x => x.id === m.id);
  if (mIdx >= 0) { mapas[mIdx].status = 'PC Emitido'; _saveMapasComp(mapas); }

  // Se antecipado, envia direto ao AP
  if (condPag === 'Antecipado') {
    _criarContaPagarDoPC(novoPedido);
  }

  logAction('Pedido de Compra', 'Compras', `${numPedido} emitido – ${m.fornecedor_selecionado} – ${fmt(m.valor_selecionado)}`);
  closeModal();
  showToast(`✅ Pedido ${numPedido} emitido com sucesso!${condPag === 'Antecipado' ? ' Conta a pagar criada automaticamente.' : ''}`, 'success', 6000);

  setTimeout(() => {
    navigate('pedidos');
  }, 1000);
}

function _emitirPCsMultiplos(m, rfq, condPag, prazoEntrega, local, responsavel, obs) {
  const grupos = {};
  // Agrupar itens multi-fornecedor
  (m.multi_fornecedor || []).forEach(mf => {
    if (!grupos[mf.forn_idx]) grupos[mf.forn_idx] = { fornecedor: mf.fornecedor, itens: [], total: 0 };
    grupos[mf.forn_idx].itens.push({ descricao: mf.descricao, qtd: 1, unidade: 'Un', valor_unit: mf.preco, total: mf.preco });
    grupos[mf.forn_idx].total += mf.preco;
  });

  // Itens não multi-forn vão para o fornecedor principal
  const itensMultiIdx = new Set((m.multi_fornecedor||[]).map(mf => mf.item_idx));
  const itensPrincipal = (m.itens||[]).filter((_, i) => !itensMultiIdx.has(i));
  if (itensPrincipal.length > 0) {
    const cot = rfq?.cotacoes?.[m.idx_fornecedor_selecionado];
    grupos['principal'] = {
      fornecedor: m.fornecedor_selecionado,
      itens: itensPrincipal,
      total: itensPrincipal.reduce((a,it) => a+(cot?.itens?.find(ci=>ci.descricao===it.descricao)?.total||0), 0)
    };
  }

  const pedidos = typeof _getPedidos === 'function' ? _getPedidos() : (JSON.parse(localStorage.getItem('fa_pedidos')||'[]'));
  let criados = 0;

  Object.values(grupos).forEach(grupo => {
    if (!grupo.itens.length) return;
    const numPedido = `PC-${new Date().getFullYear()}-${String(pedidos.length+criados+1).padStart(4,'0')}`;
    const novoPedido = {
      id: gerarId('PC'),
      numero: numPedido,
      mapa_id: m.id,
      mapa_numero: m.numero,
      rfq_numero: m.rfq_numero,
      rc_numero: m.rc_numero,
      fornecedor: grupo.fornecedor,
      titulo: `${m.titulo} – ${grupo.fornecedor}`,
      itens: grupo.itens,
      valor_total: grupo.total,
      cond_pagamento: condPag,
      prazo_entrega: prazoEntrega,
      local_entrega: local,
      responsavel: responsavel,
      observacoes: obs,
      status: condPag === 'Antecipado' ? 'Aguardando Pagamento AP' : 'Aguardando Entrega',
      historico_aprovacao: m.estagios || [],
      emitido_por: currentUser?.name,
      data_emissao: new Date().toLocaleDateString('pt-BR'),
      multi_pc: true
    };
    pedidos.unshift(novoPedido);
    if (condPag === 'Antecipado') _criarContaPagarDoPC(novoPedido);
    criados++;
    logAction('Pedido de Compra', 'Compras', `${numPedido} (multi) emitido – ${grupo.fornecedor}`);
  });

  if (typeof _savePedidos === 'function') _savePedidos(pedidos);
  else localStorage.setItem('fa_pedidos', JSON.stringify(pedidos));

  const mapas = _getMapasComp();
  const mIdx = mapas.findIndex(x => x.id === m.id);
  if (mIdx >= 0) { mapas[mIdx].status = 'PC Emitido'; _saveMapasComp(mapas); }

  closeModal();
  showToast(`✅ ${criados} Pedido(s) de Compra emitidos com fornecedores separados!`, 'success', 6000);
  setTimeout(() => navigate('pedidos'), 1000);
}

function _criarContaPagarDoPC(pedido) {
  try {
    const cps = JSON.parse(localStorage.getItem('fa_contas_pagar') || '[]');
    cps.unshift({
      id: gerarId('CP'),
      numero: `CP-${new Date().getFullYear()}-${String(cps.length+1).padStart(4,'0')}`,
      descricao: `Pagamento antecipado – ${pedido.numero}`,
      fornecedor: pedido.fornecedor,
      pedido_numero: pedido.numero,
      valor: pedido.valor_total,
      vencimento: new Date().toLocaleDateString('pt-BR'),
      status: 'A Pagar',
      tipo: 'Compra',
      criado_em: new Date().toISOString()
    });
    localStorage.setItem('fa_contas_pagar', JSON.stringify(cps));
  } catch(e) { /* silencioso */ }
}

// ─── TAB: HISTÓRICO ─────────────────────────────────────────────────────────
function _renderTabHistorico(historico) {
  const logs = JSON.parse(localStorage.getItem('fa_logs_sistema') || '[]').filter(l =>
    ['Nova RC','Aprovação Estágio','Aprovação Final RC','Reprovação RC','Criar RFQ','Cotações','Mapa Comparativo','Mapa Aprovado','Pedido de Compra','Aprovação Mapa','Mapa Rejeitado'].includes(l.acao)
  );

  if (!logs.length) return `<div style="text-align:center;padding:40px;color:var(--text-muted)"><i class="fas fa-history" style="font-size:32px;display:block;margin-bottom:12px"></i>Nenhum registro de histórico.</div>`;
  return `
    <div style="padding:16px;max-height:500px;overflow-y:auto">
      ${logs.map(l => `
        <div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--border-color)">
          <div style="width:32px;height:32px;border-radius:50%;background:rgba(0,180,184,0.15);border:1px solid rgba(0,180,184,0.3);display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <i class="fas fa-${l.acao.includes('Compra')?'shopping-bag':l.acao.includes('Mapa')?'balance-scale':l.acao.includes('RFQ')?'paper-plane':'file-alt'}" style="color:var(--fa-teal);font-size:12px"></i>
          </div>
          <div style="flex:1">
            <div style="font-size:12px;font-weight:600;color:var(--text-primary)">${l.acao} – ${l.modulo}</div>
            <div style="font-size:11px;color:var(--text-muted)">${l.detalhe}</div>
          </div>
          <div style="font-size:11px;color:var(--text-muted);flex-shrink:0">${l.timestamp}</div>
        </div>
      `).join('')}
    </div>
  `;
}

// ─── CONFIGURAÇÃO DE APROVADORES POR PROCESSO (ADMIN) ─────────────────────
function abrirConfigAprovacao() {
  if (currentUser?.profile !== 'admin') {
    showToast('Apenas o Administrador pode configurar aprovadores.', 'warning');
    return;
  }
  const cfg      = _getConfigAprovacao();
  const usuarios = (typeof FA_USUARIOS !== 'undefined' ? FA_USUARIOS : []).filter(u => u.ativo !== false && u.ativo !== 0);
  const perfisOpts = ['supervisor','operacao','compras','financeiro','diretor','rh','ssma','admin'];

  // Helper: renderiza bloco de estágio configurável
  const blocoEstagio = (prefix, eObj, cor, titulo, hint) => {
    const perfis = eObj?.perfis || [];
    const usList = eObj?.usuarios || [];
    return `
      <div style="padding:14px;border:1px solid ${cor}44;border-radius:10px;margin-bottom:10px;background:${cor}08">
        <div style="font-size:12px;font-weight:700;color:${cor};margin-bottom:10px">${titulo}</div>
        ${hint ? `<div style="font-size:11px;color:var(--text-muted);margin-bottom:10px">${hint}</div>` : ''}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div>
            <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">Nome do estágio / papel</label>
            <input class="form-control" id="${prefix}_nome" value="${eObj?.nome||titulo}" placeholder="Ex: Gestor de Campo" style="font-size:12px">
          </div>
          <div>
            <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">Perfis autorizados</label>
            <div style="display:flex;flex-wrap:wrap;gap:4px">
              ${perfisOpts.map(p => `
                <label style="display:flex;align-items:center;gap:3px;font-size:10px;cursor:pointer;padding:2px 7px;border:1px solid ${perfis.includes(p)?cor:'var(--border-color)'};border-radius:4px;background:${perfis.includes(p)?cor+'18':'transparent'};color:${perfis.includes(p)?cor:'var(--text-secondary)'}">
                  <input type="checkbox" class="cfg-perfil-${prefix}" value="${p}" ${perfis.includes(p)?'checked':''} style="accent-color:${cor};width:11px;height:11px">
                  ${p}
                </label>
              `).join('')}
            </div>
          </div>
        </div>
        ${usuarios.length > 0 ? `
          <div style="margin-top:10px">
            <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">Usuários aprovadores específicos (opcional)</label>
            <div style="display:flex;flex-wrap:wrap;gap:4px;max-height:80px;overflow-y:auto;padding:4px;border:1px solid var(--border-color);border-radius:6px;background:var(--bg-primary)">
              ${usuarios.map(u => `
                <label style="display:flex;align-items:center;gap:3px;font-size:10px;cursor:pointer;padding:2px 7px;border:1px solid ${usList.includes(u.nome)?cor:'var(--border-color)'};border-radius:4px;background:${usList.includes(u.nome)?cor+'18':'transparent'};color:${usList.includes(u.nome)?cor:'var(--text-secondary)'}">
                  <input type="checkbox" class="cfg-users-${prefix}" value="${u.nome}" ${usList.includes(u.nome)?'checked':''} style="accent-color:${cor};width:11px;height:11px">
                  ${u.nome}
                </label>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  };

  openModalWide('Configurar Aprovadores por Processo', `
    <div style="font-size:12px;color:var(--text-secondary);margin-bottom:16px;padding:10px;background:rgba(0,180,184,0.06);border-radius:8px;border:1px solid rgba(0,180,184,0.2)">
      <i class="fas fa-info-circle" style="color:var(--fa-teal);margin-right:6px"></i>
      Configure separadamente os aprovadores de cada processo. As ações são realizadas nas abas próprias de cada módulo; aqui apenas define <strong>quem pode aprovar o quê</strong>.
    </div>

    <!-- PROCESSO 1: Aprovação da RC -->
    <div style="margin-bottom:20px">
      <div style="font-size:13px;font-weight:700;color:#f59e0b;margin-bottom:10px;display:flex;align-items:center;gap:8px">
        <div style="width:26px;height:26px;background:#f59e0b;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700">1</div>
        Aprovação da Requisição de Compra (RC)
      </div>
      <div style="display:flex;gap:10px;margin-bottom:8px">
        <label style="font-size:11px;color:var(--text-muted)">Número de estágios:</label>
        <select id="cfg_rc_estagios" style="padding:3px 8px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:6px;color:var(--text-primary);font-size:12px">
          ${[1,2,3].map(n=>`<option value="${n}" ${(cfg.rc_estagios||3)===n?'selected':''}>${n} estágio(s)</option>`).join('')}
        </select>
      </div>
      ${blocoEstagio('rc_e1', cfg.estagio1, '#f59e0b', '⓵ Estágio 1', 'Primeira aprovação – geralmente o supervisor imediato ou gestor da área solicitante.')}
      ${blocoEstagio('rc_e2', cfg.estagio2, '#f97316', '⓶ Estágio 2', 'Segunda aprovação – geralmente operação ou gerência de área.')}
      ${blocoEstagio('rc_e3', cfg.estagio3, '#ef4444', '⓷ Estágio 3', 'Aprovação final – geralmente diretoria ou administração.')}
    </div>

    <hr style="border-color:var(--border-color);margin:8px 0 16px">

    <!-- PROCESSO 2: Aceite do Comprador -->
    <div style="margin-bottom:20px">
      <div style="font-size:13px;font-weight:700;color:#3b82f6;margin-bottom:10px;display:flex;align-items:center;gap:8px">
        <div style="width:26px;height:26px;background:#3b82f6;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700">2</div>
        Aceite do Comprador (RC → Cotação)
      </div>
      ${blocoEstagio('comprador', cfg.comprador, '#3b82f6', 'Comprador / Suprimentos', 'Quem aceita a RC aprovada e inicia o processo de cotação junto aos fornecedores.')}
    </div>

    <hr style="border-color:var(--border-color);margin:8px 0 16px">

    <!-- PROCESSO 3: Aprovação do Mapa -->
    <div style="margin-bottom:20px">
      <div style="font-size:13px;font-weight:700;color:#8b5cf6;margin-bottom:10px;display:flex;align-items:center;gap:8px">
        <div style="width:26px;height:26px;background:#8b5cf6;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700">3</div>
        Aprovação do Mapa Comparativo
      </div>
      <div style="display:flex;gap:10px;margin-bottom:8px">
        <label style="font-size:11px;color:var(--text-muted)">Número de estágios:</label>
        <select id="cfg_mapa_estagios" style="padding:3px 8px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:6px;color:var(--text-primary);font-size:12px">
          ${[1,2,3].map(n=>`<option value="${n}" ${(cfg.mapa_estagios||2)===n?'selected':''}>${n} estágio(s)</option>`).join('')}
        </select>
      </div>
      ${blocoEstagio('mapa_e1', cfg.mapa_estagio1||cfg.estagio1, '#8b5cf6', '⓵ Estágio 1', 'Primeira aprovação do Mapa – análise técnica e comercial.')}
      ${blocoEstagio('mapa_e2', cfg.mapa_estagio2||cfg.estagio2, '#7c3aed', '⓶ Estágio 2', 'Aprovação final do Mapa – gerência / diretoria.')}
    </div>

    <hr style="border-color:var(--border-color);margin:8px 0 16px">

    <!-- PROCESSO 4: Emissão do PC -->
    <div style="margin-bottom:8px">
      <div style="font-size:13px;font-weight:700;color:#10b981;margin-bottom:10px;display:flex;align-items:center;gap:8px">
        <div style="width:26px;height:26px;background:#10b981;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700">4</div>
        Emissão do Pedido de Compra (PC)
      </div>
      ${blocoEstagio('emissor_pc', cfg.emissor_pc, '#10b981', 'Emissor do Pedido de Compra', 'Quem tem autorização para emitir o Pedido de Compra após aprovação do Mapa.')}
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="salvarConfigAprovacao()"><i class="fas fa-save"></i> Salvar Configuração</button>
  `);
}

function salvarConfigAprovacao() {
  const _coletarPerfis = (cls)  => Array.from(document.querySelectorAll(`.${cls}:checked`)).map(cb => cb.value);
  const _coletarUsers  = (cls)  => Array.from(document.querySelectorAll(`.${cls}:checked`)).map(cb => cb.value);
  const _nome          = (id)   => document.getElementById(id)?.value.trim() || '';

  const nova = {
    rc_estagios:   parseInt(document.getElementById('cfg_rc_estagios')?.value) || 3,
    mapa_estagios: parseInt(document.getElementById('cfg_mapa_estagios')?.value) || 2,

    // Processo 1 – Aprovação RC
    estagio1: { nome: _nome('rc_e1_nome')||'Estágio 1',  perfis: _coletarPerfis('cfg-perfil-rc_e1'),  usuarios: _coletarUsers('cfg-users-rc_e1')  },
    estagio2: { nome: _nome('rc_e2_nome')||'Estágio 2',  perfis: _coletarPerfis('cfg-perfil-rc_e2'),  usuarios: _coletarUsers('cfg-users-rc_e2')  },
    estagio3: { nome: _nome('rc_e3_nome')||'Estágio 3',  perfis: _coletarPerfis('cfg-perfil-rc_e3'),  usuarios: _coletarUsers('cfg-users-rc_e3')  },

    // Processo 2 – Aceite Comprador
    comprador: { nome: _nome('comprador_nome')||'Comprador (Suprimentos)', perfis: _coletarPerfis('cfg-perfil-comprador'), usuarios: _coletarUsers('cfg-users-comprador') },

    // Processo 3 – Aprovação Mapa
    mapa_estagio1: { nome: _nome('mapa_e1_nome')||'Aprovação Mapa E1', perfis: _coletarPerfis('cfg-perfil-mapa_e1'), usuarios: _coletarUsers('cfg-users-mapa_e1') },
    mapa_estagio2: { nome: _nome('mapa_e2_nome')||'Aprovação Mapa E2', perfis: _coletarPerfis('cfg-perfil-mapa_e2'), usuarios: _coletarUsers('cfg-users-mapa_e2') },

    // Processo 4 – Emissão PC
    emissor_pc: { nome: _nome('emissor_pc_nome')||'Emissor do PC', perfis: _coletarPerfis('cfg-perfil-emissor_pc'), usuarios: _coletarUsers('cfg-users-emissor_pc') },
  };

  _saveAprovacaoConfig(nova);
  logAction('Config Aprovação', 'Admin', `Fluxo de aprovação atualizado: RC(${nova.rc_estagios} est.), Mapa(${nova.mapa_estagios} est.)`);
  closeModal();
  showToast('✅ Configuração de aprovadores salva com sucesso!', 'success');
  renderFluxoCompras();
}

// ─── INTEGRAÇÃO COM OS: AUTO-CRIAR RC ─────────────────────────────────────
function abrirAcaoMaterialOS(osId, osTitulo) {
  openModal('Material / Serviço Externo – OS ' + osId, `
    <div style="font-size:13px;color:var(--text-secondary);margin-bottom:14px">
      Selecione a ação necessária para a OS <strong>${osId}</strong>:
    </div>
    <div style="display:flex;flex-direction:column;gap:10px">
      <div onclick="verificarMaterialParaOS('${osId}','${osTitulo.replace(/'/g,'\\\'')}')" style="display:flex;align-items:center;gap:12px;padding:14px;border:1px solid var(--border-color);border-radius:10px;cursor:pointer;transition:all 0.2s" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='transparent'">
        <div style="width:40px;height:40px;background:rgba(0,180,184,0.15);border-radius:50%;display:flex;align-items:center;justify-content:center"><i class="fas fa-cube" style="color:var(--fa-teal)"></i></div>
        <div>
          <div style="font-size:13px;font-weight:700;color:var(--text-primary)">Compra de Material</div>
          <div style="font-size:11px;color:var(--text-muted)">Verificar materiais no cadastro e criar RC de compra</div>
        </div>
        <i class="fas fa-chevron-right" style="color:var(--text-muted);margin-left:auto"></i>
      </div>
      <div onclick="closeModal();openNovaRC('${osId}','Serviço Externo – ${osTitulo.replace(/'/g,'\\\'')}')" style="display:flex;align-items:center;gap:12px;padding:14px;border:1px solid var(--border-color);border-radius:10px;cursor:pointer;transition:all 0.2s" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='transparent'">
        <div style="width:40px;height:40px;background:rgba(245,158,11,0.15);border-radius:50%;display:flex;align-items:center;justify-content:center"><i class="fas fa-hard-hat" style="color:var(--orange)"></i></div>
        <div>
          <div style="font-size:13px;font-weight:700;color:var(--text-primary)">Contratação de Serviço Externo</div>
          <div style="font-size:11px;color:var(--text-muted)">Criar RC para contratação de serviço externo</div>
        </div>
        <i class="fas fa-chevron-right" style="color:var(--text-muted);margin-left:auto"></i>
      </div>
    </div>
  `, '<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>');
}

function verificarMaterialParaOS(osId, osTitulo) {
  closeModal();
  const mats = _getMateriais();
  openModalWide('Materiais Disponíveis – OS ' + osId, `
    <div style="font-size:12px;color:var(--text-secondary);margin-bottom:12px">
      Selecione os materiais necessários para a OS. Materiais sem estoque ou abaixo do mínimo precisam de RC.
    </div>
    <input type="text" id="searchMatOS" placeholder="Buscar material..." oninput="filtrarMatOS()" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box;margin-bottom:12px">
    <div id="listaMatOS" style="max-height:350px;overflow-y:auto">
      ${mats.map(m => `
        <div style="display:flex;align-items:center;gap:10px;padding:10px;border:1px solid var(--border-color);border-radius:8px;margin-bottom:6px">
          <input type="checkbox" class="mat-os-sel" value="${m.id}" ${m.status!=='Ativo'?'checked':''} style="accent-color:var(--fa-teal)">
          <div style="flex:1;font-size:12px">
            <div style="font-weight:700;color:var(--orange)">${m.codigo}</div>
            <div style="color:var(--text-primary)">${m.descricao}</div>
            <div style="color:var(--text-muted)">${m.categoria} · Est: ${m.estoque_atual} ${m.unidade} (mín: ${m.estoque_min})</div>
          </div>
          <div>
            ${statusBadge(m.status)}
            <div style="text-align:right;margin-top:4px"><input type="number" id="qtd_mat_os_${m.id}" value="${Math.max(1, m.estoque_min - m.estoque_atual)}" min="1" style="width:60px;padding:3px 6px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:4px;color:var(--text-primary);font-size:11px;text-align:center"></div>
          </div>
        </div>
      `).join('')}
    </div>
    <div style="margin-top:10px;display:flex;gap:10px;align-items:center;justify-content:flex-end">
      <button onclick="abrirCadastroRapidoMaterial()" class="btn btn-secondary btn-sm"><i class="fas fa-plus"></i> Cadastrar Novo Material</button>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="criarRCDosMateriais('${osId}','${osTitulo.replace(/'/g,'\\\'')}')" ><i class="fas fa-file-alt"></i> Criar RC com Selecionados</button>
  `);
}

function filtrarMatOS() {
  const s = (document.getElementById('searchMatOS')?.value || '').toLowerCase();
  // Recarrega mantendo os checkboxes marcados
}

function criarRCDosMateriais(osId, osTitulo) {
  const itens = [];
  document.querySelectorAll('.mat-os-sel:checked').forEach(cb => {
    const m = _getMateriais().find(x => x.id === cb.value);
    if (m) {
      const qtdEl = document.getElementById(`qtd_mat_os_${m.id}`);
      const qtd = parseInt(qtdEl?.value) || 1;
      itens.push({ descricao: m.descricao, qtd, unidade: m.unidade, valor_unit: m.valor_unitario, total: qtd*m.valor_unitario, material_id: m.id });
    }
  });
  if (!itens.length) { showToast('Selecione ao menos um material.', 'warning'); return; }
  closeModal();
  setTimeout(() => openNovaRC(osId, osTitulo, itens), 150);
}

// ─── INICIALIZAÇÃO: ADICIONA NAVEGAÇÃO ───────────────────────────────────
// Garante que renderFluxoCompras está disponível globalmente
window.renderFluxoCompras = renderFluxoCompras;

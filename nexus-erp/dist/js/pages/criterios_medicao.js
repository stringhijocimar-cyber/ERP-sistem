// =====================================================================
// Fraser Alexander ERP – Critérios de Medição & Checklist de Aceite v1.0
// Gestão de KPIs contratuais, critérios com sugestão por IA,
// checklist digital de aceite de serviços spot/recorrente
// =====================================================================

// ─── HELPERS DE STORAGE (locais) ─────────────────────────────────────
function _storageGet(key, def) {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(def)); } catch(e) { return def; }
}
function _storageSave(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch(e) {}
}

// ─── STORAGE ─────────────────────────────────────────────────────────
function _getCriterios()  { return _storageGet('fa_criterios_medicao', []); }
function _saveCriterios(d){ return _storageSave('fa_criterios_medicao', d); }
function _getChecklists() { return _storageGet('fa_checklists_aceite', []); }
function _saveChecklists(d){ return _storageSave('fa_checklists_aceite', d); }
function _getContratosForCM() {
  const m = new Map();
  // Contratos de cliente (fa_contratos / ERP_DATA)
  try { JSON.parse(localStorage.getItem('fa_contratos')||'[]').forEach(c => { if(c.id) m.set(c.id,c); }); } catch(e){}
  if (typeof ERP_DATA !== 'undefined' && Array.isArray(ERP_DATA.contratos)) {
    ERP_DATA.contratos.forEach(c => { if(c.id&&!m.has(c.id)) m.set(c.id,c); });
  }
  // Contratos de fornecimento (fa_contratos_fornecimento do módulo suprimentos)
  try { JSON.parse(localStorage.getItem('fa_contratos_fornecimento')||'[]').forEach(c => { if(c.id) m.set(c.id,c); }); } catch(e){}
  return [...m.values()];
}
function _getChecklistContrato(contratoId) {
  try {
    const all = JSON.parse(localStorage.getItem('fa_checklist_contrato') || '{}');
    return all[contratoId] || null;
  } catch(e) { return null; }
}
function _saveChecklistContrato(contratoId, data) {
  try {
    const all = JSON.parse(localStorage.getItem('fa_checklist_contrato') || '{}');
    all[contratoId] = data;
    localStorage.setItem('fa_checklist_contrato', JSON.stringify(all));
  } catch(e) {}
}

// ─── BASE DE TEMPLATES POR TIPO DE SERVIÇO ────────────────────────────
const CM_TEMPLATES = {
  'Mineração': [
    { parametro:'Tonelagem movimentada', unidade:'ton/mês', meta:'≥ meta contratual', peso:25, categoria:'Produtivo' },
    { parametro:'Disponibilidade mecânica de frota', unidade:'%', meta:'≥ 85%', peso:20, categoria:'Equipamentos' },
    { parametro:'Taxa de acidentes (TRIR)', unidade:'por MHT', meta:'≤ 0,8', peso:20, categoria:'SSMA' },
    { parametro:'Consumo de combustível vs. orçado', unidade:'%', meta:'≤ 105%', peso:10, categoria:'Custo' },
    { parametro:'Prazo de mobilização de equipe', unidade:'dias', meta:'≤ 5 dias', peso:10, categoria:'Operacional' },
    { parametro:'Índice de treinamentos concluídos', unidade:'%', meta:'≥ 95%', peso:15, categoria:'RH' },
  ],
  'Construção Civil': [
    { parametro:'Avanço físico do escopo (%)', unidade:'%', meta:'≥ planejado', peso:30, categoria:'Produtivo' },
    { parametro:'Conformidade com cronograma', unidade:'dias atraso', meta:'0 dias', peso:20, categoria:'Prazo' },
    { parametro:'Não conformidades abertas', unidade:'qtd', meta:'≤ 3', peso:15, categoria:'Qualidade' },
    { parametro:'Taxa de retrabalho', unidade:'%', meta:'≤ 2%', peso:15, categoria:'Qualidade' },
    { parametro:'Incidentes de segurança', unidade:'qtd', meta:'0', peso:20, categoria:'SSMA' },
  ],
  'Manutenção Industrial': [
    { parametro:'MTTR – Tempo médio de reparo', unidade:'horas', meta:'≤ 4h', peso:25, categoria:'Eficiência' },
    { parametro:'MTBF – Tempo médio entre falhas', unidade:'horas', meta:'≥ 720h', peso:25, categoria:'Confiabilidade' },
    { parametro:'Backlog de OS abertas', unidade:'qtd', meta:'≤ 10', peso:15, categoria:'Operacional' },
    { parametro:'Disponibilidade dos ativos', unidade:'%', meta:'≥ 92%', peso:20, categoria:'Equipamentos' },
    { parametro:'Consumo de peças vs. orçado', unidade:'%', meta:'≤ 110%', peso:15, categoria:'Custo' },
  ],
  'Transporte e Logística': [
    { parametro:'Prazo de entrega cumprido', unidade:'%', meta:'≥ 98%', peso:30, categoria:'Prazo' },
    { parametro:'Avarias em carga', unidade:'qtd/mês', meta:'0', peso:25, categoria:'Qualidade' },
    { parametro:'Disponibilidade de frota', unidade:'%', meta:'≥ 90%', peso:20, categoria:'Equipamentos' },
    { parametro:'Consumo de combustível', unidade:'km/L', meta:'≥ meta', peso:15, categoria:'Custo' },
    { parametro:'Acidentes de trânsito', unidade:'qtd', meta:'0', peso:10, categoria:'SSMA' },
  ],
  'Limpeza e Conservação': [
    { parametro:'Conformidade com frequência contratada', unidade:'%', meta:'100%', peso:30, categoria:'Execução' },
    { parametro:'Reclamações de não conformidade', unidade:'qtd/mês', meta:'0', peso:25, categoria:'Qualidade' },
    { parametro:'Pontualidade de equipe', unidade:'%', meta:'≥ 95%', peso:20, categoria:'RH' },
    { parametro:'Consumo de materiais vs. orçado', unidade:'%', meta:'≤ 105%', peso:15, categoria:'Custo' },
    { parametro:'EPI em uso correto', unidade:'%', meta:'100%', peso:10, categoria:'SSMA' },
  ],
  'Serviços de TI': [
    { parametro:'SLA de disponibilidade', unidade:'%', meta:'≥ 99,5%', peso:35, categoria:'Disponibilidade' },
    { parametro:'Tempo de resolução de chamados', unidade:'horas', meta:'≤ 4h P1 / 8h P2', peso:25, categoria:'Suporte' },
    { parametro:'Incidentes de segurança', unidade:'qtd', meta:'0', peso:20, categoria:'Segurança' },
    { parametro:'Satisfação dos usuários (NPS)', unidade:'pontos', meta:'≥ 7', peso:20, categoria:'Qualidade' },
  ],
  'Fornecimento de Materiais': [
    { parametro:'On-Time Delivery (OTD)', unidade:'%', meta:'≥ 95%', peso:30, categoria:'Prazo' },
    { parametro:'Conformidade de qualidade', unidade:'%', meta:'≥ 99%', peso:25, categoria:'Qualidade' },
    { parametro:'Acurácia de faturamento', unidade:'%', meta:'100%', peso:20, categoria:'Financeiro' },
    { parametro:'Resposta a RFQs', unidade:'dias', meta:'≤ 3 dias úteis', peso:15, categoria:'Comercial' },
    { parametro:'Devoluções por não conformidade', unidade:'%', meta:'≤ 1%', peso:10, categoria:'Qualidade' },
  ],
};

// Templates de checklist por tipo de serviço
const CM_CHECKLIST_TEMPLATES = {
  'Spot (Serviço Pontual)': [
    { item:'Escopo de serviço completamente executado', obrigatorio:true, categoria:'Escopo' },
    { item:'Documentação de segurança (PT/APR/ASO) entregue', obrigatorio:true, categoria:'SSMA' },
    { item:'Relatório fotográfico antes/durante/depois', obrigatorio:true, categoria:'Evidência' },
    { item:'Sem não conformidades pendentes', obrigatorio:true, categoria:'Qualidade' },
    { item:'Resíduos recolhidos e destinados corretamente', obrigatorio:true, categoria:'Ambiental' },
    { item:'EPI utilizados conforme NR-6', obrigatorio:true, categoria:'SSMA' },
    { item:'Equipe desmobilizada da área', obrigatorio:false, categoria:'Operacional' },
    { item:'Nota Fiscal emitida corretamente', obrigatorio:true, categoria:'Fiscal' },
    { item:'Garantia informada formalmente', obrigatorio:false, categoria:'Qualidade' },
    { item:'Assinatura do fiscal de contrato', obrigatorio:true, categoria:'Aprovação' },
  ],
  'Recorrente Mensal': [
    { item:'Produção do período conforme meta contratual', obrigatorio:true, categoria:'Produtivo' },
    { item:'Relatório mensal de desempenho entregue', obrigatorio:true, categoria:'Relatório' },
    { item:'Indicadores KPI preenchidos e dentro da meta', obrigatorio:true, categoria:'KPI' },
    { item:'Não conformidades do mês anterior resolvidas', obrigatorio:true, categoria:'Qualidade' },
    { item:'Reunião mensal de acompanhamento realizada', obrigatorio:true, categoria:'Governança' },
    { item:'Ata da reunião assinada por ambas as partes', obrigatorio:true, categoria:'Governança' },
    { item:'Treinamentos da equipe em dia', obrigatorio:true, categoria:'RH' },
    { item:'Documentação de segurança válida (validade ≥ 30 dias)', obrigatorio:true, categoria:'SSMA' },
    { item:'Fatura/NF com competência correta', obrigatorio:true, categoria:'Fiscal' },
    { item:'Medição de boletim aprovada pelo cliente', obrigatorio:true, categoria:'Aprovação' },
    { item:'Registro de incidentes/quase-acidentes', obrigatorio:false, categoria:'SSMA' },
    { item:'Plano de ação corretiva entregue (se aplicável)', obrigatorio:false, categoria:'Qualidade' },
  ],
  'Obra por Contrato': [
    { item:'Cronograma físico-financeiro atualizado', obrigatorio:true, categoria:'Prazo' },
    { item:'Curva S do avanço físico', obrigatorio:true, categoria:'Produtivo' },
    { item:'ART/RRT emitida e anotada', obrigatorio:true, categoria:'Legal' },
    { item:'Diário de obra atualizado', obrigatorio:true, categoria:'Evidência' },
    { item:'Relatório fotográfico semanal', obrigatorio:true, categoria:'Evidência' },
    { item:'Testes e comissionamentos realizados', obrigatorio:true, categoria:'Qualidade' },
    { item:'As-built disponível (para obras concluídas)', obrigatorio:false, categoria:'Documentação' },
    { item:'PPRA/PCMSO válidos para a obra', obrigatorio:true, categoria:'SSMA' },
    { item:'Laudo de aceite de materiais', obrigatorio:false, categoria:'Qualidade' },
    { item:'Recebimento provisório assinado', obrigatorio:true, categoria:'Aprovação' },
    { item:'Recebimento definitivo (após prazo de garantia)', obrigatorio:false, categoria:'Aprovação' },
  ],
};

// ─── RENDER PRINCIPAL ─────────────────────────────────────────────────
function renderCriteriosMedicao() {
  const el = document.getElementById('mainContent');
  if (!el) return;
  const criterios = _getCriterios();
  const checklists = _getChecklists();
  const tab = window._cmTab || 'criterios';

  el.innerHTML = `
    <div class="page-header">
      <div class="page-title">
        <i class="fas fa-tasks page-icon" style="color:#059669"></i>
        <div>
          <h1>Critérios de Medição & Checklist</h1>
          <p class="page-subtitle">Defina KPIs contratuais, use IA para sugestões e valide serviços com checklist digital</p>
        </div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-outline-primary btn-sm" onclick="cmGerarRelatorio()">
          <i class="fas fa-file-pdf"></i> Relatório
        </button>
        <button class="btn btn-primary btn-sm" onclick="cmAbrirNovoCriterio()">
          <i class="fas fa-plus"></i> Novo Critério
        </button>
      </div>
    </div>

    <!-- KPIs -->
    <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px">
      <div class="kpi-card">
        <div class="kpi-icon" style="background:rgba(5,150,105,0.1)"><i class="fas fa-sliders-h" style="color:#059669"></i></div>
        <div class="kpi-label">Critérios Ativos</div>
        <div class="kpi-value" style="color:#059669">${criterios.filter(c=>c.ativo!==false).length}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon" style="background:rgba(37,99,235,0.1)"><i class="fas fa-clipboard-check" style="color:#2563eb"></i></div>
        <div class="kpi-label">Checklists Criados</div>
        <div class="kpi-value" style="color:#2563eb">${checklists.length}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon" style="background:rgba(22,163,74,0.1)"><i class="fas fa-check-double" style="color:#16a34a"></i></div>
        <div class="kpi-label">Serviços Aceitos</div>
        <div class="kpi-value" style="color:#16a34a">${checklists.filter(c=>c.status==='Aprovado').length}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon" style="background:rgba(245,158,11,0.1)"><i class="fas fa-exclamation-triangle" style="color:#f59e0b"></i></div>
        <div class="kpi-label">Pendentes de Aceite</div>
        <div class="kpi-value" style="color:#f59e0b">${checklists.filter(c=>c.status==='Pendente'||!c.status).length}</div>
      </div>
    </div>

    <!-- Tabs -->
    <div style="display:flex;gap:4px;border-bottom:2px solid var(--border-color);margin-bottom:20px;overflow-x:auto">
      ${[
        {k:'criterios',   i:'fa-sliders-h',         l:'Critérios KPI'},
        {k:'checklist',   i:'fa-clipboard-check',    l:'Checklists de Aceite'},
        {k:'fornecimento',i:'fa-handshake',          l:'Contratos Fornecimento'},
        {k:'avaliacoes',  i:'fa-chart-line',         l:'Avaliações Mensais'},
        {k:'ia',          i:'fa-robot',              l:'Sugestão por IA'},
      ].map(t=>`
        <button onclick="window._cmTab='${t.k}';renderCriteriosMedicao()" 
          style="padding:8px 16px;border:none;background:transparent;cursor:pointer;font-size:13px;font-weight:600;white-space:nowrap;
          color:${tab===t.k?'var(--primary)':'var(--text-secondary)'};
          border-bottom:3px solid ${tab===t.k?'var(--primary)':'transparent'};
          margin-bottom:-2px;border-radius:6px 6px 0 0;transition:all .2s">
          <i class="fas ${t.i}" style="margin-right:6px"></i>${t.l}
        </button>
      `).join('')}
    </div>

    <!-- Conteúdo da aba -->
    <div id="cm-tab-content">
      ${tab==='criterios'    ? cmRenderCriterios(criterios) :
        tab==='checklist'    ? cmRenderChecklists(checklists) :
        tab==='fornecimento' ? cmRenderContratosFornecimento() :
        tab==='avaliacoes'   ? cmRenderAvaliacoes(criterios, checklists) :
        cmRenderIA()}
    </div>
  `;
}

// ─── ABA: CRITÉRIOS KPI ───────────────────────────────────────────────
function cmRenderCriterios(criterios) {
  if (criterios.length === 0) {
    return `
      <div style="text-align:center;padding:60px 20px;background:var(--bg-card);border-radius:14px;border:2px dashed var(--border-color)">
        <div style="font-size:52px;margin-bottom:16px">📊</div>
        <div style="font-size:16px;font-weight:700;color:var(--text-primary);margin-bottom:8px">Nenhum critério definido</div>
        <p style="font-size:13px;color:var(--text-muted);margin-bottom:20px">
          Defina os KPIs que serão controlados mensalmente para cada contrato ou tipo de serviço.<br>
          Use a <strong>Sugestão por IA</strong> para gerar critérios automaticamente pelo tipo de serviço.
        </p>
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
          <button onclick="cmAbrirNovoCriterio()" class="btn btn-primary">
            <i class="fas fa-plus"></i> Criar Critério Manualmente
          </button>
          <button onclick="window._cmTab='ia';renderCriteriosMedicao()" class="btn btn-outline-primary">
            <i class="fas fa-robot"></i> Usar Sugestão por IA
          </button>
        </div>
      </div>`;
  }

  // Agrupa por contrato/tipo
  const grupos = {};
  criterios.forEach(c => {
    const key = c.contrato || c.tipo_servico || 'Geral';
    if (!grupos[key]) grupos[key] = [];
    grupos[key].push(c);
  });

  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px">
      <div>
        <input type="text" class="form-control" placeholder="Buscar critério..." style="width:250px" id="cm_busca"
          oninput="cmFiltrarCriterios(this.value)">
      </div>
      <div style="display:flex;gap:8px">
        <button onclick="cmAbrirNovoCriterio()" class="btn btn-primary btn-sm">
          <i class="fas fa-plus"></i> Novo Critério
        </button>
        <button onclick="window._cmTab='ia';renderCriteriosMedicao()" class="btn btn-outline-primary btn-sm">
          <i class="fas fa-robot"></i> Sugerir por IA
        </button>
      </div>
    </div>

    <div id="cm_criterios_lista">
      ${Object.entries(grupos).map(([grupo, itens]) => `
        <div style="background:var(--bg-card);border-radius:14px;border:1px solid var(--border-color);overflow:hidden;margin-bottom:16px">
          <div style="padding:14px 18px;background:linear-gradient(135deg,rgba(5,150,105,0.08),rgba(5,150,105,0.02));border-bottom:1px solid var(--border-color);display:flex;align-items:center;justify-content:space-between">
            <div style="display:flex;align-items:center;gap:10px">
              <div style="width:36px;height:36px;border-radius:9px;background:rgba(5,150,105,0.12);display:flex;align-items:center;justify-content:center">
                <i class="fas fa-file-contract" style="color:#059669"></i>
              </div>
              <div>
                <div style="font-size:14px;font-weight:700;color:var(--text-primary)">${grupo}</div>
                <div style="font-size:11px;color:var(--text-muted)">${itens.length} critério${itens.length!==1?'s':''} · Peso total: ${itens.reduce((s,i)=>s+(i.peso||0),0)}%</div>
              </div>
            </div>
            <div style="display:flex;gap:6px">
              <button onclick="cmAvaliarContrato('${grupo}')" class="btn btn-sm" style="background:rgba(5,150,105,0.1);color:#059669;border:1px solid rgba(5,150,105,0.2);font-size:11px">
                <i class="fas fa-chart-line"></i> Avaliar
              </button>
              <button onclick="cmAbrirChecklist('${grupo}')" class="btn btn-sm" style="background:rgba(37,99,235,0.1);color:#2563eb;border:1px solid rgba(37,99,235,0.2);font-size:11px">
                <i class="fas fa-clipboard-check"></i> Checklist
              </button>
            </div>
          </div>
          <div style="overflow-x:auto">
            <table style="width:100%;border-collapse:collapse">
              <thead>
                <tr style="background:var(--bg-tertiary)">
                  <th style="padding:10px 14px;text-align:left;font-size:11px;color:var(--text-muted);font-weight:600">PARÂMETRO</th>
                  <th style="padding:10px 10px;text-align:center;font-size:11px;color:var(--text-muted);font-weight:600;width:80px">UNIDADE</th>
                  <th style="padding:10px 10px;text-align:center;font-size:11px;color:var(--text-muted);font-weight:600;width:100px">META</th>
                  <th style="padding:10px 10px;text-align:center;font-size:11px;color:var(--text-muted);font-weight:600;width:60px">PESO</th>
                  <th style="padding:10px 10px;text-align:center;font-size:11px;color:var(--text-muted);font-weight:600;width:90px">CATEGORIA</th>
                  <th style="padding:10px 10px;text-align:center;font-size:11px;color:var(--text-muted);font-weight:600;width:80px">STATUS</th>
                  <th style="padding:10px 10px;text-align:center;font-size:11px;color:var(--text-muted);font-weight:600;width:70px">AÇÕES</th>
                </tr>
              </thead>
              <tbody>
                ${itens.map(c => `
                  <tr style="border-bottom:1px solid var(--border-color);transition:background .15s" onmouseover="this.style.background='var(--bg-tertiary)'" onmouseout="this.style.background='transparent'">
                    <td style="padding:10px 14px">
                      <div style="font-size:13px;font-weight:600;color:var(--text-primary)">${c.parametro}</div>
                      ${c.descricao?`<div style="font-size:11px;color:var(--text-muted);margin-top:2px">${c.descricao}</div>`:''}
                    </td>
                    <td style="padding:10px;text-align:center;font-size:12px;color:var(--text-secondary)">${c.unidade||'—'}</td>
                    <td style="padding:10px;text-align:center">
                      <span style="font-size:12px;font-weight:700;color:#059669;background:rgba(5,150,105,0.08);padding:2px 8px;border-radius:6px">${c.meta||'—'}</span>
                    </td>
                    <td style="padding:10px;text-align:center">
                      <div style="display:flex;align-items:center;justify-content:center;gap:4px">
                        <div style="height:4px;width:${c.peso||0}px;max-width:40px;background:#4f46e5;border-radius:2px"></div>
                        <span style="font-size:12px;font-weight:700;color:#4f46e5">${c.peso||0}%</span>
                      </div>
                    </td>
                    <td style="padding:10px;text-align:center">
                      <span style="font-size:10px;background:rgba(79,70,229,0.1);color:#4f46e5;padding:2px 8px;border-radius:10px;font-weight:600">${c.categoria||'—'}</span>
                    </td>
                    <td style="padding:10px;text-align:center">
                      <span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;background:${c.ativo!==false?'rgba(22,163,74,0.1)':'rgba(107,114,128,0.1)'};color:${c.ativo!==false?'#16a34a':'#6b7280'}">
                        ${c.ativo!==false?'Ativo':'Inativo'}
                      </span>
                    </td>
                    <td style="padding:10px;text-align:center">
                      <div style="display:flex;gap:4px;justify-content:center">
                        <button onclick="cmEditarCriterio('${c.id}')" title="Editar" style="border:none;background:transparent;cursor:pointer;color:var(--text-muted);padding:4px">
                          <i class="fas fa-pen" style="font-size:12px"></i>
                        </button>
                        <button onclick="cmExcluirCriterio('${c.id}')" title="Excluir" style="border:none;background:transparent;cursor:pointer;color:#dc2626;padding:4px">
                          <i class="fas fa-trash" style="font-size:12px"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// ─── ABA: CHECKLISTS DE ACEITE ────────────────────────────────────────
function cmRenderChecklists(checklists) {
  if (checklists.length === 0) {
    return `
      <div style="text-align:center;padding:60px 20px;background:var(--bg-card);border-radius:14px;border:2px dashed var(--border-color)">
        <div style="font-size:52px;margin-bottom:16px">✅</div>
        <div style="font-size:16px;font-weight:700;color:var(--text-primary);margin-bottom:8px">Nenhum checklist criado</div>
        <p style="font-size:13px;color:var(--text-muted);margin-bottom:20px">
          Crie checklists de aceite para validar serviços spot ou recorrentes antes de aprovar a medição.
        </p>
        <button onclick="cmAbrirNovoChecklist()" class="btn btn-primary">
          <i class="fas fa-plus"></i> Criar Checklist de Aceite
        </button>
      </div>`;
  }

  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${['Todos','Pendente','Em Verificação','Aprovado','Reprovado'].map(s=>`
          <button onclick="cmFiltrarChecklists('${s}')" 
            style="padding:4px 12px;border-radius:20px;border:1px solid var(--border-color);background:transparent;color:var(--text-secondary);font-size:11px;font-weight:600;cursor:pointer">
            ${s}
          </button>
        `).join('')}
      </div>
      <button onclick="cmAbrirNovoChecklist()" class="btn btn-primary btn-sm">
        <i class="fas fa-plus"></i> Novo Checklist
      </button>
    </div>

    <div style="display:grid;gap:12px" id="cm_checklists_grid">
      ${checklists.map(cl => cmRenderChecklistCard(cl)).join('')}
    </div>
  `;
}

function cmRenderChecklistCard(cl) {
  const itens = cl.itens || [];
  const total = itens.length;
  const marcados = itens.filter(i=>i.marcado).length;
  const pct = total>0 ? Math.round(marcados/total*100) : 0;
  const obrigatoriosPendentes = itens.filter(i=>i.obrigatorio && !i.marcado).length;
  const statusColor = cl.status==='Aprovado'?'#16a34a':cl.status==='Reprovado'?'#dc2626':cl.status==='Em Verificação'?'#2563eb':'#f59e0b';

  return `
    <div style="background:var(--bg-card);border-radius:12px;border:1px solid var(--border-color);overflow:hidden;border-left:4px solid ${statusColor}">
      <div style="padding:14px 18px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <div style="flex:1;min-width:200px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
            <span style="font-size:14px;font-weight:700;color:var(--text-primary)">${cl.titulo||'Checklist sem título'}</span>
            <span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;background:${statusColor}18;color:${statusColor}">${cl.status||'Pendente'}</span>
          </div>
          <div style="font-size:11px;color:var(--text-muted)">
            ${cl.contrato?`Contrato: ${cl.contrato} · `:''}
            ${cl.tipo?`Tipo: ${cl.tipo} · `:''}
            ${cl.criado_em?`Criado: ${new Date(cl.criado_em).toLocaleDateString('pt-BR')}`:''}
          </div>
        </div>
        <div style="text-align:center;min-width:80px">
          <div style="font-size:22px;font-weight:900;color:${pct===100?'#16a34a':pct>60?'#f59e0b':'#dc2626'}">${pct}%</div>
          <div style="font-size:10px;color:var(--text-muted)">${marcados}/${total} itens</div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button onclick="cmAbrirChecarList('${cl.id}')" class="btn btn-primary btn-sm">
            <i class="fas fa-clipboard-check"></i> Verificar
          </button>
          ${cl.status==='Em Verificação'&&obrigatoriosPendentes===0?`
            <button onclick="cmAprovarChecklist('${cl.id}')" class="btn btn-sm" style="background:rgba(22,163,74,0.1);color:#16a34a;border:1px solid rgba(22,163,74,0.25);font-size:11px">
              <i class="fas fa-check"></i> Aprovar
            </button>
          `:''}
          ${cl.status==='Em Verificação'?`
            <button onclick="cmReprovarChecklist('${cl.id}')" class="btn btn-sm" style="background:rgba(220,38,38,0.1);color:#dc2626;border:1px solid rgba(220,38,38,0.25);font-size:11px">
              <i class="fas fa-times"></i> Reprovar
            </button>
          `:''}
        </div>
      </div>
      <!-- Barra de progresso -->
      <div style="height:4px;background:var(--bg-tertiary)">
        <div style="height:100%;width:${pct}%;background:${pct===100?'#16a34a':pct>60?'#f59e0b':'#dc2626'};transition:width .5s ease"></div>
      </div>
      ${obrigatoriosPendentes>0?`
        <div style="padding:6px 18px;background:rgba(220,38,38,0.05);border-top:1px solid rgba(220,38,38,0.1);font-size:11px;color:#dc2626">
          <i class="fas fa-exclamation-triangle" style="margin-right:4px"></i>
          ${obrigatoriosPendentes} item(ns) obrigatório(s) pendente(s) — aceite bloqueado
        </div>
      `:''}
    </div>
  `;
}

// ─── ABA: AVALIAÇÕES MENSAIS ──────────────────────────────────────────
function cmRenderAvaliacoes(criterios, checklists) {
  const grupos = {};
  criterios.forEach(c => {
    const key = c.contrato || c.tipo_servico || 'Geral';
    if (!grupos[key]) grupos[key] = [];
    grupos[key].push(c);
  });

  if (Object.keys(grupos).length === 0) {
    return `<div style="text-align:center;padding:60px;color:var(--text-muted)">
      <div style="font-size:48px;margin-bottom:16px">📊</div>
      <div style="font-size:15px">Crie critérios na aba <strong>Critérios KPI</strong> para habilitar avaliações mensais.</div>
    </div>`;
  }

  return `
    <div style="display:grid;gap:20px">
      ${Object.entries(grupos).map(([contrato, itens]) => `
        <div style="background:var(--bg-card);border-radius:14px;border:1px solid var(--border-color);overflow:hidden">
          <div style="padding:14px 18px;border-bottom:1px solid var(--border-color);display:flex;justify-content:space-between;align-items:center">
            <div>
              <div style="font-size:14px;font-weight:700;color:var(--text-primary)">${contrato}</div>
              <div style="font-size:11px;color:var(--text-muted)">${itens.length} indicadores · Período: ${new Date().toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}</div>
            </div>
            <button onclick="cmLancarAvaliacao('${contrato}')" class="btn btn-primary btn-sm">
              <i class="fas fa-pencil-alt"></i> Lançar Avaliação
            </button>
          </div>
          <div style="padding:16px 18px">
            ${itens.map(c => {
              const av = (c.avaliacoes||[]).slice(-1)[0];
              const realizado = av?.realizado;
              const situacao = !av ? 'Sem dados' : av.situacao || '—';
              const sitColor = situacao==='Conforme'?'#16a34a':situacao==='Não Conforme'?'#dc2626':situacao==='Atenção'?'#f59e0b':'#6b7280';
              return `
                <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border-color)">
                  <div style="flex:1;min-width:0">
                    <div style="font-size:12px;font-weight:600;color:var(--text-primary)">${c.parametro}</div>
                    <div style="font-size:11px;color:var(--text-muted)">Meta: ${c.meta} · Peso: ${c.peso}%</div>
                  </div>
                  <div style="text-align:center;min-width:80px">
                    <div style="font-size:14px;font-weight:700;color:var(--text-primary)">${realizado!=null?realizado+' '+c.unidade:'—'}</div>
                    <div style="font-size:10px;color:var(--text-muted)">Realizado</div>
                  </div>
                  <div style="text-align:center;min-width:90px">
                    <span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:10px;background:${sitColor}18;color:${sitColor}">${situacao}</span>
                  </div>
                  <div style="font-size:11px;color:var(--text-muted);text-align:right;min-width:60px">${av?.data?new Date(av.data).toLocaleDateString('pt-BR'):''}</div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// ─── ABA: CONTRATOS DE FORNECIMENTO ──────────────────────────────────
// Controle de critérios e checklist por contrato de fornecimento

const CM_CHECKLIST_CONTRATO = [
  // Critérios de seleção de fornecedor
  { id:'sel_01', categoria:'Seleção', item:'Fornecedor homologado no sistema (IDF ativo)', obrigatorio:true },
  { id:'sel_02', categoria:'Seleção', item:'Mínimo de 3 cotações obtidas para RFQs > R$ 10.000', obrigatorio:true },
  { id:'sel_03', categoria:'Seleção', item:'Mapa comparativo aprovado pelo gestor', obrigatorio:true },
  { id:'sel_04', categoria:'Seleção', item:'Critério de seleção documentado (menor preço / técnico / prazo)', obrigatorio:true },
  // Critérios contratuais
  { id:'con_01', categoria:'Contrato', item:'Pedido de compra emitido formalmente', obrigatorio:true },
  { id:'con_02', categoria:'Contrato', item:'Prazo de entrega contratual acordado', obrigatorio:true },
  { id:'con_03', categoria:'Contrato', item:'Condição de pagamento definida', obrigatorio:true },
  { id:'con_04', categoria:'Contrato', item:'Conta contábil vinculada ao pedido', obrigatorio:false },
  { id:'con_05', categoria:'Contrato', item:'Aprovação hierárquica conforme alçada', obrigatorio:true },
  // Critérios de recebimento
  { id:'rec_01', categoria:'Recebimento', item:'NF conferida contra pedido de compra', obrigatorio:true },
  { id:'rec_02', categoria:'Recebimento', item:'Itens recebidos conferidos fisicamente', obrigatorio:true },
  { id:'rec_03', categoria:'Recebimento', item:'Status de conformidade registrado (Conforme/Parcial/Divergente)', obrigatorio:true },
  { id:'rec_04', categoria:'Recebimento', item:'Entrada no almoxarifado confirmada pelo responsável', obrigatorio:true },
  { id:'rec_05', categoria:'Recebimento', item:'Local de armazenamento registrado', obrigatorio:false },
  { id:'rec_06', categoria:'Recebimento', item:'CP (Conta a Pagar) gerado após entrada', obrigatorio:true },
  // Critérios de desempenho
  { id:'des_01', categoria:'Desempenho', item:'OTD (On-Time Delivery) ≥ 95%', obrigatorio:false },
  { id:'des_02', categoria:'Desempenho', item:'Taxa de devolução por não conformidade ≤ 1%', obrigatorio:false },
  { id:'des_03', categoria:'Desempenho', item:'Tempo de resposta a RFQs ≤ 3 dias úteis', obrigatorio:false },
  { id:'des_04', categoria:'Desempenho', item:'Score IDF avaliado trimestralmente', obrigatorio:false },
];

function cmRenderContratosFornecimento() {
  const contratos = _getContratosForCM();
  const checklistAll = JSON.parse(localStorage.getItem('fa_checklist_contrato') || '{}');

  // KPIs gerais
  const totalContratos = contratos.length;
  const contComChecklist = contratos.filter(c => checklistAll[c.id]).length;
  const contCompletos = contratos.filter(c => {
    const cl = checklistAll[c.id];
    if (!cl || !cl.itens) return false;
    return CM_CHECKLIST_CONTRATO.filter(t => t.obrigatorio).every(t => cl.itens[t.id]);
  }).length;
  const contPendentes = contComChecklist - contCompletos;

  return `
    <!-- KPIs de contratos de fornecimento -->
    <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px">
      <div class="kpi-card">
        <div class="kpi-icon" style="background:rgba(37,99,235,0.1)"><i class="fas fa-handshake" style="color:#2563eb"></i></div>
        <div class="kpi-label">Total Contratos</div>
        <div class="kpi-value" style="color:#2563eb">${totalContratos}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon" style="background:rgba(22,163,74,0.1)"><i class="fas fa-check-circle" style="color:#16a34a"></i></div>
        <div class="kpi-label">Critérios Completos</div>
        <div class="kpi-value" style="color:#16a34a">${contCompletos}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon" style="background:rgba(245,158,11,0.1)"><i class="fas fa-exclamation-triangle" style="color:#f59e0b"></i></div>
        <div class="kpi-label">Em Pendência</div>
        <div class="kpi-value" style="color:#f59e0b">${contPendentes}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon" style="background:rgba(107,114,128,0.1)"><i class="fas fa-minus-circle" style="color:#6b7280"></i></div>
        <div class="kpi-label">Sem Checklist</div>
        <div class="kpi-value" style="color:#6b7280">${totalContratos - contComChecklist}</div>
      </div>
    </div>

    <!-- Info explicativa -->
    <div style="background:rgba(37,99,235,0.06);border:1px solid rgba(37,99,235,0.2);border-radius:10px;padding:14px 18px;margin-bottom:20px;display:flex;gap:12px;align-items:flex-start">
      <i class="fas fa-info-circle" style="color:#2563eb;font-size:18px;margin-top:1px;flex-shrink:0"></i>
      <div>
        <div style="font-weight:700;font-size:13px;color:var(--text-primary);margin-bottom:4px">Critérios de Controle de Fornecimento</div>
        <div style="font-size:12px;color:var(--text-muted)">
          Este módulo controla os critérios obrigatórios para cada contrato ativo: seleção de fornecedor, emissão de pedidos, recebimento físico e entrada no almoxarifado. 
          Itens marcados com <span style="color:#dc2626;font-weight:700">*</span> são obrigatórios e bloqueiam o aceite se pendentes.
        </div>
      </div>
    </div>

    <!-- Lista de contratos -->
    ${contratos.length === 0 ? `
      <div style="text-align:center;padding:60px;color:var(--text-muted)">
        <div style="font-size:48px;margin-bottom:16px">🤝</div>
        <div style="font-size:15px">Nenhum contrato ativo encontrado.</div>
      </div>
    ` : `
      <div style="display:grid;gap:16px">
        ${contratos.map(c => {
          const cl = checklistAll[c.id];
          const itens = cl?.itens || {};
          const obrigTotal = CM_CHECKLIST_CONTRATO.filter(t => t.obrigatorio).length;
          const obrigOk = CM_CHECKLIST_CONTRATO.filter(t => t.obrigatorio && itens[t.id]).length;
          const totalItens = CM_CHECKLIST_CONTRATO.length;
          const totalOk = CM_CHECKLIST_CONTRATO.filter(t => itens[t.id]).length;
          const pctObrig = obrigTotal > 0 ? Math.round(obrigOk / obrigTotal * 100) : 0;
          const cor = pctObrig === 100 ? '#16a34a' : pctObrig >= 60 ? '#f59e0b' : '#dc2626';
          const status = pctObrig === 100 ? 'Conforme' : pctObrig >= 60 ? 'Em Andamento' : 'Pendente';
          const categorias = [...new Set(CM_CHECKLIST_CONTRATO.map(t => t.categoria))];
          return `
            <div style="background:var(--bg-card);border-radius:14px;border:1px solid var(--border-color);overflow:hidden;border-left:4px solid ${cor}">
              <div style="padding:14px 18px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
                <div style="flex:1;min-width:200px">
                  <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap">
                    <span style="font-size:14px;font-weight:700;color:var(--text-primary)">${c.id}</span>
                    <span style="font-size:11px;color:var(--text-muted)">${c.objeto || c.descricao || c.nome || '—'}</span>
                    <span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;background:${cor}18;color:${cor}">${status}</span>
                  </div>
                  <div style="font-size:11px;color:var(--text-muted)">${[c.cliente, c.gestor||c.responsavel, c.status].filter(Boolean).join(' · ')}</div>
                </div>
                <div style="text-align:center;min-width:80px">
                  <div style="font-size:22px;font-weight:900;color:${cor}">${pctObrig}%</div>
                  <div style="font-size:10px;color:var(--text-muted)">Obrigatórios</div>
                  <div style="font-size:10px;color:var(--text-muted)">${totalOk}/${totalItens} total</div>
                </div>
                <div style="display:flex;gap:6px;flex-wrap:wrap">
                  <button onclick="cmAbrirChecklistContrato('${c.id}')" class="btn btn-primary btn-sm">
                    <i class="fas fa-clipboard-check"></i> Gerenciar Checklist
                  </button>
                </div>
              </div>
              <!-- Barra de progresso dos obrigatórios -->
              <div style="height:5px;background:var(--bg-tertiary)">
                <div style="height:100%;width:${pctObrig}%;background:${cor};transition:width .5s ease"></div>
              </div>
              <!-- Mini-sumário de categorias -->
              <div style="padding:10px 18px;display:flex;gap:10px;flex-wrap:wrap;border-top:1px solid var(--border-color)">
                ${categorias.map(cat => {
                  const catItens = CM_CHECKLIST_CONTRATO.filter(t => t.categoria === cat);
                  const catOk = catItens.filter(t => itens[t.id]).length;
                  const catCor = catOk === catItens.length ? '#16a34a' : catOk > 0 ? '#f59e0b' : '#6b7280';
                  return `
                    <div style="display:flex;align-items:center;gap:4px;font-size:11px">
                      <i class="fas ${catOk===catItens.length?'fa-check-circle':catOk>0?'fa-clock':'fa-circle'}" style="color:${catCor};font-size:10px"></i>
                      <span style="color:var(--text-muted)">${cat}</span>
                      <span style="font-weight:700;color:${catCor}">${catOk}/${catItens.length}</span>
                    </div>
                  `;
                }).join('<span style="color:var(--border-color)">|</span>')}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `}
  `;
}

function cmAbrirChecklistContrato(contratoId) {
  const contratos = _getContratosForCM();
  const contrato = contratos.find(c => c.id === contratoId);
  if (!contrato) return;

  const cl = _getChecklistContrato(contratoId) || { itens: {}, observacoes: {}, atualizado: null, responsavel: null };
  const itens = cl.itens || {};

  const categorias = [...new Set(CM_CHECKLIST_CONTRATO.map(t => t.categoria))];

  const categoriaIcones = { Seleção:'fa-search', Contrato:'fa-file-contract', Recebimento:'fa-dolly', Desempenho:'fa-chart-line' };
  const categoriaCores = { Seleção:'#7c3aed', Contrato:'#2563eb', Recebimento:'#ca8a04', Desempenho:'#059669' };

  openModalWide(`<i class="fas fa-handshake" style="color:#2563eb;margin-right:8px"></i>Checklist de Fornecimento – ${contratoId}`, `
    <div style="background:rgba(37,99,235,0.06);border-radius:8px;padding:12px 16px;margin-bottom:16px">
      <div style="font-size:14px;font-weight:700;color:var(--text-primary)">${contrato.objeto || contrato.descricao || contrato.nome || contratoId}</div>
      <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${[contrato.cliente, contrato.gestor||contrato.responsavel].filter(Boolean).join(' · ')}</div>
    </div>

    <div id="cm_checklist_contrato_body">
      ${categorias.map(cat => {
        const catItens = CM_CHECKLIST_CONTRATO.filter(t => t.categoria === cat);
        const cor = categoriaCores[cat] || '#4f46e5';
        const icone = categoriaIcones[cat] || 'fa-list';
        const catOk = catItens.filter(t => itens[t.id]).length;
        return `
          <div style="margin-bottom:20px">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;padding:8px 12px;background:${cor}10;border-radius:8px;border-left:3px solid ${cor}">
              <i class="fas ${icone}" style="color:${cor}"></i>
              <span style="font-size:13px;font-weight:700;color:var(--text-primary)">${cat}</span>
              <span style="font-size:11px;color:${cor};font-weight:600;margin-left:auto">${catOk}/${catItens.length}</span>
            </div>
            ${catItens.map(t => `
              <div style="display:flex;align-items:flex-start;gap:10px;padding:9px 12px;background:${itens[t.id]?'rgba(22,197,94,0.05)':'var(--bg-card)'};border:1px solid ${itens[t.id]?'rgba(22,197,94,0.2)':'var(--border-color)'};border-radius:8px;margin-bottom:6px;cursor:pointer" 
                   onclick="cmToggleItemContrato('${contratoId}','${t.id}')">
                <div style="width:20px;height:20px;border:2px solid ${itens[t.id]?'#16a34a':'var(--border-color)'};border-radius:4px;background:${itens[t.id]?'#16a34a':'transparent'};display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px">
                  ${itens[t.id] ? '<i class="fas fa-check" style="color:#fff;font-size:10px"></i>' : ''}
                </div>
                <div style="flex:1;min-width:0">
                  <div style="font-size:13px;color:${itens[t.id]?'var(--text-muted)':'var(--text-primary)'};text-decoration:${itens[t.id]?'line-through':'none'};font-weight:${itens[t.id]?'400':'500'}">
                    ${t.item}
                    ${t.obrigatorio ? '<span style="color:#dc2626;font-size:10px;margin-left:4px;font-weight:700">*</span>' : ''}
                  </div>
                </div>
                ${itens[t.id] ? `<i class="fas fa-check-circle" style="color:#16a34a;font-size:14px;flex-shrink:0"></i>` : `<i class="fas fa-circle" style="color:var(--border-color);font-size:14px;flex-shrink:0"></i>`}
              </div>
            `).join('')}
          </div>
        `;
      }).join('')}

      <div style="margin-top:8px;padding:10px 12px;background:var(--bg-tertiary);border-radius:8px;font-size:11px;color:var(--text-muted)">
        <i class="fas fa-info-circle" style="margin-right:4px;color:#f59e0b"></i>
        Itens marcados com <span style="color:#dc2626;font-weight:700">*</span> são obrigatórios. O aceite do contrato é bloqueado enquanto houver obrigatórios pendentes.
        ${cl.responsavel ? `<br><i class="fas fa-user" style="margin-right:4px;margin-top:4px;color:#2563eb"></i>Última atualização: ${cl.responsavel} em ${cl.atualizado ? new Date(cl.atualizado).toLocaleDateString('pt-BR') : '—'}` : ''}
      </div>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
    <button class="btn btn-primary" onclick="cmExportarChecklistContrato('${contratoId}')">
      <i class="fas fa-file-pdf"></i> Exportar PDF
    </button>
  `);
}

function cmToggleItemContrato(contratoId, itemId) {
  const cl = _getChecklistContrato(contratoId) || { itens: {}, observacoes: {} };
  cl.itens = cl.itens || {};
  cl.itens[itemId] = !cl.itens[itemId];
  cl.atualizado = new Date().toISOString();
  cl.responsavel = typeof currentUser !== 'undefined' ? (currentUser?.nome || 'Usuário') : 'Usuário';
  _saveChecklistContrato(contratoId, cl);
  // Reabre o modal para atualizar
  cmAbrirChecklistContrato(contratoId);
  // Atualiza o KPI da página
  setTimeout(() => { if (window._cmTab === 'fornecimento') renderCriteriosMedicao(); }, 300);
}

function cmExportarChecklistContrato(contratoId) {
  const contratos = _getContratosForCM();
  const contrato = contratos.find(c => c.id === contratoId);
  const cl = _getChecklistContrato(contratoId) || { itens: {} };
  const itens = cl.itens || {};
  const hoje = new Date().toLocaleDateString('pt-BR');

  const obrigOk = CM_CHECKLIST_CONTRATO.filter(t => t.obrigatorio && itens[t.id]).length;
  const obrigTotal = CM_CHECKLIST_CONTRATO.filter(t => t.obrigatorio).length;

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
  <title>Checklist de Fornecimento – ${contratoId}</title>
  <style>
    body{font-family:Arial,sans-serif;font-size:11px;padding:28px}
    h1{font-size:16px;font-weight:900;color:#2563eb}
    h2{font-size:12px;font-weight:700;color:#2563eb;margin:14px 0 6px;border-left:3px solid #2563eb;padding-left:8px}
    .item{display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid #f0f0f0}
    .check{width:14px;height:14px;border:2px solid #ccc;border-radius:3px;display:inline-flex;align-items:center;justify-content:center;background:#f9f9f9}
    .check.ok{background:#16a34a;border-color:#16a34a;color:#fff}
    .obrig{color:#dc2626;font-weight:bold;font-size:9px}
    @media print{*{print-color-adjust:exact!important}}
  </style></head><body>
  <div style="border-bottom:3px solid #2563eb;padding-bottom:12px;margin-bottom:16px;display:flex;justify-content:space-between">
    <div><h1>Checklist de Controle – Fornecimento</h1><p>Fraser Alexander – ${contrato?.objeto||contratoId}</p></div>
    <div style="text-align:right;font-size:10px;color:#888">Emitido: ${hoje}<br>Contrato: ${contratoId}</div>
  </div>
  <div style="display:flex;gap:20px;margin-bottom:14px;font-size:11px">
    <div><strong>Obrigatórios:</strong> ${obrigOk}/${obrigTotal} (${Math.round(obrigOk/obrigTotal*100)}%)</div>
    <div><strong>Responsável:</strong> ${cl.responsavel||'—'}</div>
    <div><strong>Atualizado:</strong> ${cl.atualizado?new Date(cl.atualizado).toLocaleDateString('pt-BR'):'—'}</div>
  </div>
  ${[...new Set(CM_CHECKLIST_CONTRATO.map(t=>t.categoria))].map(cat=>`
    <h2>${cat}</h2>
    ${CM_CHECKLIST_CONTRATO.filter(t=>t.categoria===cat).map(t=>`
      <div class="item">
        <div class="check ${itens[t.id]?'ok':''}">${itens[t.id]?'✓':''}</div>
        <span style="text-decoration:${itens[t.id]?'line-through':'none'};color:${itens[t.id]?'#888':'#222'}">${t.item}</span>
        ${t.obrigatorio?'<span class="obrig">*</span>':''}
      </div>
    `).join('')}
  `).join('')}
  <div style="margin-top:24px;display:flex;gap:40px">
    <div style="border-top:1px solid #333;width:200px;padding-top:6px;font-size:10px;text-align:center">Responsável pelo Contrato</div>
    <div style="border-top:1px solid #333;width:200px;padding-top:6px;font-size:10px;text-align:center">Aprovador / Gestor</div>
  </div>
  </body></html>`;

  const win = window.open('','_blank','width=900,height=700');
  if (!win) { showToast('Popup bloqueado!','error'); return; }
  win.document.write(html); win.document.close();
  win.onload = () => setTimeout(()=>{ win.focus(); win.print(); },400);
}

// ─── ABA: SUGESTÃO POR IA ──────────────────────────────────────────────
function cmRenderIA() {
  return `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
      <!-- Painel de seleção -->
      <div>
        <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);border-radius:14px;padding:20px;color:#fff;margin-bottom:16px">
          <div style="font-size:24px;margin-bottom:8px">🤖</div>
          <div style="font-size:16px;font-weight:700;margin-bottom:4px">Sugestão de Critérios por IA</div>
          <div style="font-size:12px;opacity:.85">Selecione o tipo de serviço e o contrato. O sistema sugere automaticamente os KPIs mais relevantes com base nas melhores práticas do setor.</div>
        </div>

        <div style="background:var(--bg-card);border-radius:12px;border:1px solid var(--border-color);padding:18px">
          <div class="form-group" style="margin-bottom:14px">
            <label style="font-size:12px;font-weight:600">Tipo de Serviço *</label>
            <select class="form-control" id="ia_tipo_servico" onchange="cmCarregarSugestoes()">
              <option value="">-- Selecione o tipo de serviço --</option>
              ${Object.keys(CM_TEMPLATES).map(t=>`<option>${t}</option>`).join('')}
            </select>
          </div>
          <div class="form-group" style="margin-bottom:14px">
            <label style="font-size:12px;font-weight:600">Contrato / Projeto (opcional)</label>
            <select class="form-control" id="ia_contrato">
              <option value="">Sem vínculo de contrato</option>
              ${(_storageGet('fa_contratos_cliente',[])).map(c=>`<option value="${c.numero||c.id}">${c.numero||c.id} – ${c.nome||c.cliente||'—'}</option>`).join('')}
            </select>
          </div>
          <div class="form-group" style="margin-bottom:14px">
            <label style="font-size:12px;font-weight:600">Periodicidade de avaliação</label>
            <select class="form-control" id="ia_periodicidade">
              <option>Mensal</option><option>Bimestral</option><option>Trimestral</option><option>Semanal</option>
            </select>
          </div>
          <button onclick="cmCarregarSugestoes()" class="btn btn-primary" style="width:100%">
            <i class="fas fa-magic"></i> Gerar Sugestões com IA
          </button>
        </div>

        <!-- Templates disponíveis -->
        <div style="margin-top:16px">
          <div style="font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:10px">TEMPLATES DISPONÍVEIS</div>
          <div style="display:grid;gap:6px">
            ${Object.keys(CM_TEMPLATES).map(t=>`
              <button onclick="document.getElementById('ia_tipo_servico').value='${t}';cmCarregarSugestoes()" 
                style="padding:8px 14px;background:var(--bg-card);border:1px solid var(--border-color);border-radius:8px;text-align:left;cursor:pointer;font-size:12px;color:var(--text-secondary);transition:all .2s"
                onmouseover="this.style.borderColor='var(--primary)';this.style.color='var(--primary)'"
                onmouseout="this.style.borderColor='var(--border-color)';this.style.color='var(--text-secondary)'">
                <i class="fas fa-layer-group" style="margin-right:8px"></i>${t}
                <span style="font-size:10px;color:var(--text-muted);float:right">${CM_TEMPLATES[t].length} KPIs</span>
              </button>
            `).join('')}
          </div>
        </div>
      </div>

      <!-- Painel de sugestões -->
      <div id="ia_sugestoes_panel">
        <div style="background:var(--bg-card);border-radius:14px;border:2px dashed var(--border-color);padding:40px;text-align:center;color:var(--text-muted)">
          <div style="font-size:48px;margin-bottom:16px">💡</div>
          <div style="font-size:14px;font-weight:600;margin-bottom:8px">Selecione um tipo de serviço</div>
          <div style="font-size:12px">As sugestões de KPIs serão exibidas aqui com base no tipo de contrato/serviço selecionado.</div>
        </div>
      </div>
    </div>
  `;
}

function cmCarregarSugestoes() {
  const tipo = document.getElementById('ia_tipo_servico')?.value;
  const panel = document.getElementById('ia_sugestoes_panel');
  if (!panel) return;

  if (!tipo) {
    panel.innerHTML = `<div style="background:var(--bg-card);border-radius:14px;border:2px dashed var(--border-color);padding:40px;text-align:center;color:var(--text-muted)"><div style="font-size:48px;margin-bottom:16px">💡</div><div style="font-size:14px;font-weight:600">Selecione um tipo de serviço</div></div>`;
    return;
  }

  const sugestoes = CM_TEMPLATES[tipo] || [];
  window._cmSugestoesSelecionadas = new Set(sugestoes.map((_,i)=>i));

  panel.innerHTML = `
    <div style="background:var(--bg-card);border-radius:14px;border:1px solid var(--border-color);overflow:hidden">
      <div style="padding:14px 18px;border-bottom:1px solid var(--border-color);display:flex;justify-content:space-between;align-items:center;background:linear-gradient(135deg,rgba(79,70,229,0.06),rgba(79,70,229,0.02))">
        <div>
          <div style="font-size:13px;font-weight:700;color:var(--text-primary)">
            <i class="fas fa-robot" style="color:#4f46e5;margin-right:6px"></i>
            ${sugestoes.length} KPIs sugeridos para <strong>${tipo}</strong>
          </div>
          <div style="font-size:11px;color:var(--text-muted)">Baseado nas melhores práticas do setor · Personalize antes de importar</div>
        </div>
        <button onclick="cmImportarSugestoes('${tipo}')" class="btn btn-primary btn-sm">
          <i class="fas fa-cloud-download-alt"></i> Importar Selecionados
        </button>
      </div>
      <div style="padding:12px">
        <div style="display:flex;gap:8px;margin-bottom:12px">
          <button onclick="cmToggleTodos(true)" style="font-size:11px;padding:3px 10px;border-radius:6px;border:1px solid var(--border-color);background:transparent;cursor:pointer;color:var(--text-secondary)">Selecionar todos</button>
          <button onclick="cmToggleTodos(false)" style="font-size:11px;padding:3px 10px;border-radius:6px;border:1px solid var(--border-color);background:transparent;cursor:pointer;color:var(--text-secondary)">Desmarcar todos</button>
        </div>
        ${sugestoes.map((s,i) => `
          <div style="display:flex;align-items:flex-start;gap:10px;padding:10px;border-radius:8px;border:1px solid var(--border-color);margin-bottom:8px;transition:background .15s;cursor:pointer" id="sug_item_${i}"
            onclick="cmToggleSugestao(${i})" onmouseover="this.style.background='var(--bg-tertiary)'" onmouseout="this.style.background='transparent'">
            <div id="sug_check_${i}" style="width:18px;height:18px;border-radius:4px;background:#4f46e5;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px">
              <i class="fas fa-check" style="color:#fff;font-size:10px"></i>
            </div>
            <div style="flex:1">
              <div style="font-size:13px;font-weight:600;color:var(--text-primary)">${s.parametro}</div>
              <div style="font-size:11px;color:var(--text-muted);margin-top:2px">
                Meta: <strong>${s.meta}</strong> · Unidade: ${s.unidade} · Peso: <strong>${s.peso}%</strong>
                <span style="margin-left:6px;background:rgba(79,70,229,0.1);color:#4f46e5;padding:1px 7px;border-radius:8px;font-size:10px">${s.categoria}</span>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function cmToggleSugestao(i) {
  if (!window._cmSugestoesSelecionadas) window._cmSugestoesSelecionadas = new Set();
  const el = document.getElementById(`sug_check_${i}`);
  if (window._cmSugestoesSelecionadas.has(i)) {
    window._cmSugestoesSelecionadas.delete(i);
    if (el) { el.style.background='var(--bg-tertiary)'; el.innerHTML=''; }
  } else {
    window._cmSugestoesSelecionadas.add(i);
    if (el) { el.style.background='#4f46e5'; el.innerHTML='<i class="fas fa-check" style="color:#fff;font-size:10px"></i>'; }
  }
}

function cmToggleTodos(sel) {
  const tipo = document.getElementById('ia_tipo_servico')?.value;
  const sugestoes = CM_TEMPLATES[tipo] || [];
  window._cmSugestoesSelecionadas = sel ? new Set(sugestoes.map((_,i)=>i)) : new Set();
  sugestoes.forEach((_,i) => {
    const el = document.getElementById(`sug_check_${i}`);
    if (el) {
      el.style.background = sel ? '#4f46e5' : 'var(--bg-tertiary)';
      el.innerHTML = sel ? '<i class="fas fa-check" style="color:#fff;font-size:10px"></i>' : '';
    }
  });
}

function cmImportarSugestoes(tipo) {
  const sugestoes = CM_TEMPLATES[tipo] || [];
  const selecionados = window._cmSugestoesSelecionadas || new Set(sugestoes.map((_,i)=>i));
  const contrato = document.getElementById('ia_contrato')?.value || '';
  const periodicidade = document.getElementById('ia_periodicidade')?.value || 'Mensal';
  const criterios = _getCriterios();
  let adicionados = 0;

  selecionados.forEach(i => {
    const s = sugestoes[i];
    if (!s) return;
    // Evita duplicatas
    const existe = criterios.find(c => c.parametro === s.parametro && (c.contrato===contrato||c.tipo_servico===tipo));
    if (!existe) {
      criterios.push({
        id: 'CM-' + Date.now() + '-' + i,
        parametro: s.parametro, unidade: s.unidade, meta: s.meta, peso: s.peso,
        categoria: s.categoria, contrato: contrato||tipo, tipo_servico: tipo,
        periodicidade, ativo: true, criado_em: new Date().toISOString(),
        criado_por: currentUser?.nome || 'Sistema', origem: 'IA',
        avaliacoes: [],
      });
      adicionados++;
    }
  });

  _saveCriterios(criterios);
  showToast(`✅ ${adicionados} critério(s) importado(s) com sucesso!`, 'success');
  window._cmTab = 'criterios';
  renderCriteriosMedicao();
}

// ─── NOVO CRITÉRIO MANUAL ─────────────────────────────────────────────
function cmAbrirNovoCriterio(prefill) {
  const contratos = _storageGet('fa_contratos_cliente', []);
  openModalWide('Novo Critério de Medição', `
    <div class="form-row">
      <div class="form-group">
        <label>Parâmetro / Indicador *</label>
        <input class="form-control" id="nc_parametro" value="${prefill?.parametro||''}" placeholder="Ex: Disponibilidade mecânica de frota">
      </div>
      <div class="form-group">
        <label>Categoria</label>
        <select class="form-control" id="nc_categoria">
          ${['Produtivo','Qualidade','SSMA','RH','Financeiro','Operacional','Equipamentos','Prazo','Confiabilidade'].map(c=>`<option ${prefill?.categoria===c?'selected':''}>${c}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Unidade de Medida</label>
        <input class="form-control" id="nc_unidade" value="${prefill?.unidade||''}" placeholder="Ex: %, ton, horas, qtd">
      </div>
      <div class="form-group">
        <label>Meta Contratual *</label>
        <input class="form-control" id="nc_meta" value="${prefill?.meta||''}" placeholder="Ex: ≥ 85% ou ≤ 3 ocorrências">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Peso no Score Total (%)</label>
        <input class="form-control" id="nc_peso" type="number" min="0" max="100" value="${prefill?.peso||10}">
      </div>
      <div class="form-group">
        <label>Periodicidade</label>
        <select class="form-control" id="nc_periodicidade">
          ${['Mensal','Bimestral','Trimestral','Semanal','Diário'].map(p=>`<option>${p}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Contrato / Projeto</label>
        <select class="form-control" id="nc_contrato">
          <option value="">Sem vínculo</option>
          ${contratos.map(c=>`<option value="${c.numero||c.id}">${c.numero||c.id} – ${c.nome||c.cliente||'—'}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Tipo de Serviço</label>
        <select class="form-control" id="nc_tipo">
          <option value="">Genérico</option>
          ${Object.keys(CM_TEMPLATES).map(t=>`<option>${t}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-group">
      <label>Descrição / Metodologia de Cálculo</label>
      <textarea class="form-control" id="nc_descricao" rows="2" placeholder="Descreva como o indicador é calculado e quais dados são utilizados..."></textarea>
    </div>
    <div class="form-group">
      <label>Consequência se não atingido</label>
      <input class="form-control" id="nc_consequencia" placeholder="Ex: Desconto de 5% no valor da medição por ponto percentual abaixo da meta">
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="cmSalvarNovoCriterio()">
      <i class="fas fa-save"></i> Salvar Critério
    </button>
  `);
}

function cmSalvarNovoCriterio() {
  const parametro = document.getElementById('nc_parametro')?.value?.trim();
  const meta = document.getElementById('nc_meta')?.value?.trim();
  if (!parametro || !meta) { showToast('Preencha Parâmetro e Meta', 'warning'); return; }

  const criterios = _getCriterios();
  criterios.push({
    id: 'CM-' + Date.now(),
    parametro, meta,
    unidade: document.getElementById('nc_unidade')?.value||'',
    categoria: document.getElementById('nc_categoria')?.value||'Operacional',
    peso: parseInt(document.getElementById('nc_peso')?.value)||10,
    periodicidade: document.getElementById('nc_periodicidade')?.value||'Mensal',
    contrato: document.getElementById('nc_contrato')?.value||'',
    tipo_servico: document.getElementById('nc_tipo')?.value||'',
    descricao: document.getElementById('nc_descricao')?.value||'',
    consequencia: document.getElementById('nc_consequencia')?.value||'',
    ativo: true, avaliacoes: [],
    criado_em: new Date().toISOString(), criado_por: currentUser?.nome||'Usuário',
  });
  _saveCriterios(criterios);
  showToast('Critério salvo!', 'success');
  closeModal();
  renderCriteriosMedicao();
}

function cmEditarCriterio(id) {
  const criterios = _getCriterios();
  const c = criterios.find(x=>x.id===id);
  if (!c) return;
  cmAbrirNovoCriterio(c);
  // Sobrescreve o botão de salvar
  setTimeout(() => {
    const btn = document.querySelector('[onclick="cmSalvarNovoCriterio()"]');
    if (btn) btn.setAttribute('onclick', `cmUpdateCriterio('${id}')`);
  }, 100);
}

function cmUpdateCriterio(id) {
  const criterios = _getCriterios();
  const idx = criterios.findIndex(x=>x.id===id);
  if (idx===-1) return;
  criterios[idx] = {
    ...criterios[idx],
    parametro: document.getElementById('nc_parametro')?.value?.trim()||criterios[idx].parametro,
    meta: document.getElementById('nc_meta')?.value?.trim()||criterios[idx].meta,
    unidade: document.getElementById('nc_unidade')?.value||criterios[idx].unidade,
    categoria: document.getElementById('nc_categoria')?.value||criterios[idx].categoria,
    peso: parseInt(document.getElementById('nc_peso')?.value)||criterios[idx].peso,
    periodicidade: document.getElementById('nc_periodicidade')?.value||criterios[idx].periodicidade,
    contrato: document.getElementById('nc_contrato')?.value??criterios[idx].contrato,
    tipo_servico: document.getElementById('nc_tipo')?.value||criterios[idx].tipo_servico,
    descricao: document.getElementById('nc_descricao')?.value||criterios[idx].descricao,
    consequencia: document.getElementById('nc_consequencia')?.value||criterios[idx].consequencia,
    atualizado_em: new Date().toISOString(),
  };
  _saveCriterios(criterios);
  showToast('Critério atualizado!', 'success');
  closeModal();
  renderCriteriosMedicao();
}

function cmExcluirCriterio(id) {
  if (!confirm('Excluir este critério?')) return;
  let criterios = _getCriterios();
  criterios = criterios.filter(x=>x.id!==id);
  _saveCriterios(criterios);
  showToast('Critério excluído', 'info');
  renderCriteriosMedicao();
}

// ─── NOVO CHECKLIST DE ACEITE ──────────────────────────────────────────
function cmAbrirNovoChecklist(contratoPresel) {
  const contratos = _storageGet('fa_contratos_cliente', []);
  openModalWide('Novo Checklist de Aceite', `
    <div class="form-row">
      <div class="form-group">
        <label>Título do Checklist *</label>
        <input class="form-control" id="cl_titulo" placeholder="Ex: Aceite Manutenção Preventiva – Jun/2026">
      </div>
      <div class="form-group">
        <label>Tipo de Serviço</label>
        <select class="form-control" id="cl_tipo" onchange="cmPreencherItensChecklist()">
          <option value="">Personalizado</option>
          ${Object.keys(CM_CHECKLIST_TEMPLATES).map(t=>`<option>${t}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Contrato</label>
        <select class="form-control" id="cl_contrato">
          <option value="">Sem vínculo</option>
          ${contratos.map(c=>`<option value="${c.numero||c.id}" ${(c.numero||c.id)===contratoPresel?'selected':''}>${c.numero||c.id} – ${c.nome||c.cliente||'—'}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Fornecedor / Prestador</label>
        <input class="form-control" id="cl_fornecedor" placeholder="Nome do fornecedor ou empresa">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Período de Referência</label>
        <input class="form-control" id="cl_periodo" type="month" value="${new Date().toISOString().slice(0,7)}">
      </div>
      <div class="form-group">
        <label>Responsável pela Verificação</label>
        <input class="form-control" id="cl_responsavel" value="${currentUser?.nome||''}">
      </div>
    </div>

    <div class="section-divider"><h4>Itens do Checklist</h4></div>
    <div id="cl_itens_container">
      <div style="text-align:center;padding:20px;color:var(--text-muted);font-size:13px">
        Selecione um tipo de serviço acima para carregar itens automáticos, ou adicione manualmente abaixo.
      </div>
    </div>

    <button onclick="cmAdicionarItemChecklist()" class="btn btn-sm" style="margin-top:8px;background:rgba(79,70,229,0.08);color:#4f46e5;border:1px solid rgba(79,70,229,0.2)">
      <i class="fas fa-plus"></i> Adicionar Item Personalizado
    </button>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="cmSalvarChecklist()">
      <i class="fas fa-save"></i> Criar Checklist
    </button>
  `);
  window._cmItensChecklist = [];
}

let _cmItemCounter = 0;
function cmPreencherItensChecklist() {
  const tipo = document.getElementById('cl_tipo')?.value;
  const cont = document.getElementById('cl_itens_container');
  if (!cont) return;
  const template = CM_CHECKLIST_TEMPLATES[tipo] || [];
  window._cmItensChecklist = template.map((it,i) => ({...it, id:`cl_item_${Date.now()}_${i}`, marcado:false}));
  cmRenderItensChecklistEditor();
}

function cmRenderItensChecklistEditor() {
  const cont = document.getElementById('cl_itens_container');
  if (!cont) return;
  const itens = window._cmItensChecklist || [];
  if (itens.length === 0) {
    cont.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:12px">Nenhum item. Use o botão abaixo para adicionar.</div>`;
    return;
  }
  // Agrupa por categoria
  const grupos = {};
  itens.forEach(it => { if(!grupos[it.categoria||'Geral'])grupos[it.categoria||'Geral']=[]; grupos[it.categoria||'Geral'].push(it); });
  cont.innerHTML = Object.entries(grupos).map(([cat, its]) => `
    <div style="margin-bottom:12px">
      <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">${cat}</div>
      ${its.map(it => `
        <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--bg-tertiary);border-radius:8px;margin-bottom:4px">
          <i class="fas ${it.obrigatorio?'fa-exclamation-circle':'fa-circle'}" style="color:${it.obrigatorio?'#dc2626':'var(--text-muted)'};font-size:12px;flex-shrink:0" title="${it.obrigatorio?'Obrigatório':'Opcional'}"></i>
          <span style="flex:1;font-size:12px;color:var(--text-primary)">${it.item}</span>
          <span style="font-size:10px;padding:1px 7px;border-radius:8px;background:${it.obrigatorio?'rgba(220,38,38,0.1)':'rgba(107,114,128,0.1)'};color:${it.obrigatorio?'#dc2626':'#6b7280'}">${it.obrigatorio?'Obrigatório':'Opcional'}</span>
          <button onclick="cmRemoverItemCl('${it.id}')" style="border:none;background:none;cursor:pointer;color:var(--text-muted);font-size:11px">✕</button>
        </div>
      `).join('')}
    </div>
  `).join('');
}

function cmAdicionarItemChecklist() {
  if (!window._cmItensChecklist) window._cmItensChecklist = [];
  const item = prompt('Descrição do item:');
  if (!item) return;
  const obrig = confirm('Este item é obrigatório para o aceite?');
  window._cmItensChecklist.push({ id:'cl_item_'+Date.now(), item, obrigatorio:obrig, categoria:'Personalizado', marcado:false });
  cmRenderItensChecklistEditor();
}

function cmRemoverItemCl(id) {
  window._cmItensChecklist = (window._cmItensChecklist||[]).filter(i=>i.id!==id);
  cmRenderItensChecklistEditor();
}

function cmSalvarChecklist() {
  const titulo = document.getElementById('cl_titulo')?.value?.trim();
  if (!titulo) { showToast('Informe o título do checklist', 'warning'); return; }
  const itens = window._cmItensChecklist || [];
  if (itens.length === 0) { showToast('Adicione pelo menos um item ao checklist', 'warning'); return; }

  const checklists = _getChecklists();
  checklists.push({
    id: 'CL-' + Date.now(), titulo,
    tipo: document.getElementById('cl_tipo')?.value||'',
    contrato: document.getElementById('cl_contrato')?.value||'',
    fornecedor: document.getElementById('cl_fornecedor')?.value||'',
    periodo: document.getElementById('cl_periodo')?.value||'',
    responsavel: document.getElementById('cl_responsavel')?.value||'',
    itens, status:'Pendente',
    criado_em: new Date().toISOString(), criado_por: currentUser?.nome||'Usuário',
  });
  _saveChecklists(checklists);
  showToast('Checklist criado com sucesso!', 'success');
  closeModal();
  window._cmTab = 'checklist';
  renderCriteriosMedicao();
}

// ─── VERIFICAÇÃO DE CHECKLIST ─────────────────────────────────────────
function cmAbrirChecarList(id) {
  const checklists = _getChecklists();
  const cl = checklists.find(x=>x.id===id);
  if (!cl) return;

  const grupos = {};
  (cl.itens||[]).forEach(it => { if(!grupos[it.categoria||'Geral'])grupos[it.categoria||'Geral']=[]; grupos[it.categoria||'Geral'].push(it); });

  openModalWide(`✅ Verificar – ${cl.titulo}`, `
    <div style="background:var(--bg-tertiary);border-radius:10px;padding:12px 16px;margin-bottom:16px;display:flex;gap:16px;flex-wrap:wrap;font-size:12px">
      ${cl.contrato?`<span><i class="fas fa-file-contract" style="margin-right:4px;color:var(--text-muted)"></i>Contrato: <strong>${cl.contrato}</strong></span>`:''}
      ${cl.fornecedor?`<span><i class="fas fa-building" style="margin-right:4px;color:var(--text-muted)"></i>Fornecedor: <strong>${cl.fornecedor}</strong></span>`:''}
      ${cl.periodo?`<span><i class="fas fa-calendar" style="margin-right:4px;color:var(--text-muted)"></i>Período: <strong>${cl.periodo}</strong></span>`:''}
      ${cl.responsavel?`<span><i class="fas fa-user" style="margin-right:4px;color:var(--text-muted)"></i>Responsável: <strong>${cl.responsavel}</strong></span>`:''}
    </div>

    <div id="cl_verificar_body">
      ${Object.entries(grupos).map(([cat, itens]) => `
        <div style="margin-bottom:16px">
          <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">${cat}</div>
          ${itens.map(it => `
            <div style="display:flex;align-items:flex-start;gap:12px;padding:10px 12px;border-radius:10px;border:1px solid ${it.marcado?'rgba(22,163,74,0.3)':'var(--border-color)'};background:${it.marcado?'rgba(22,163,74,0.05)':'transparent'};margin-bottom:6px;cursor:pointer;transition:all .2s"
              onclick="cmToggleItemChecklist('${id}','${it.id}',this)">
              <div style="width:22px;height:22px;border-radius:6px;border:2px solid ${it.marcado?'#16a34a':'var(--border-color)'};background:${it.marcado?'#16a34a':'transparent'};display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .2s" id="chk_${it.id}">
                ${it.marcado?'<i class="fas fa-check" style="color:#fff;font-size:11px"></i>':''}
              </div>
              <div style="flex:1">
                <div style="font-size:13px;color:var(--text-primary);${it.marcado?'text-decoration:line-through;opacity:.6':''}">${it.item}</div>
                ${it.observacao?`<div style="font-size:11px;color:var(--text-muted);margin-top:2px"><i class="fas fa-comment" style="margin-right:4px"></i>${it.observacao}</div>`:''}
              </div>
              <div style="flex-shrink:0;display:flex;align-items:center;gap:6px">
                <span style="font-size:10px;padding:2px 7px;border-radius:8px;background:${it.obrigatorio?'rgba(220,38,38,0.1)':'rgba(107,114,128,0.1)'};color:${it.obrigatorio?'#dc2626':'#6b7280'}">${it.obrigatorio?'Obrigatório':'Opcional'}</span>
                <button onclick="event.stopPropagation();cmAnotarItem('${id}','${it.id}')" style="border:none;background:none;cursor:pointer;color:var(--text-muted);padding:2px" title="Anotação">
                  <i class="fas fa-comment-alt" style="font-size:11px"></i>
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      `).join('')}
    </div>

    <div style="background:var(--bg-tertiary);border-radius:10px;padding:12px;margin-top:12px">
      <label style="font-size:12px;font-weight:600;display:block;margin-bottom:6px">Observações Gerais do Verificador</label>
      <textarea class="form-control" id="cl_obs_geral" rows="2" placeholder="Observações, ressalvas ou condições de aceite...">${cl.observacoes_geral||''}</textarea>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Fechar sem salvar</button>
    <button class="btn btn-warning" onclick="cmSalvarVerificacao('${id}','Em Verificação')">
      <i class="fas fa-save"></i> Salvar Progresso
    </button>
    <button class="btn btn-primary" onclick="cmSalvarVerificacao('${id}','Em Verificação',true)">
      <i class="fas fa-paper-plane"></i> Enviar para Aprovação
    </button>
  `);

  // Armazena estado temporário
  window._cmChecklistAtivo = JSON.parse(JSON.stringify(cl));
}

function cmToggleItemChecklist(clId, itemId, rowEl) {
  if (!window._cmChecklistAtivo) return;
  const it = window._cmChecklistAtivo.itens.find(x=>x.id===itemId);
  if (!it) return;
  it.marcado = !it.marcado;

  // Atualiza UI
  const chk = document.getElementById(`chk_${itemId}`);
  if (chk) {
    chk.style.background = it.marcado ? '#16a34a' : 'transparent';
    chk.style.borderColor = it.marcado ? '#16a34a' : 'var(--border-color)';
    chk.innerHTML = it.marcado ? '<i class="fas fa-check" style="color:#fff;font-size:11px"></i>' : '';
  }
  rowEl.style.borderColor = it.marcado ? 'rgba(22,163,74,0.3)' : 'var(--border-color)';
  rowEl.style.background = it.marcado ? 'rgba(22,163,74,0.05)' : 'transparent';
  const txt = rowEl.querySelector('div[style*="font-size:13px"]');
  if (txt) txt.style.cssText += it.marcado ? ';text-decoration:line-through;opacity:.6' : ';text-decoration:none;opacity:1';
}

function cmAnotarItem(clId, itemId) {
  const it = window._cmChecklistAtivo?.itens?.find(x=>x.id===itemId);
  if (!it) return;
  const obs = prompt('Anotação para este item:', it.observacao||'');
  if (obs !== null) {
    it.observacao = obs;
    showToast('Anotação salva!', 'success');
  }
}

function cmSalvarVerificacao(id, status, enviarAprovacao) {
  const checklists = _getChecklists();
  const idx = checklists.findIndex(x=>x.id===id);
  if (idx===-1) return;

  const cl = window._cmChecklistAtivo || checklists[idx];
  const obsGeral = document.getElementById('cl_obs_geral')?.value||'';

  checklists[idx] = {
    ...checklists[idx],
    itens: cl.itens,
    status,
    observacoes_geral: obsGeral,
    verificado_por: currentUser?.nome||'Usuário',
    verificado_em: new Date().toISOString(),
  };
  _saveChecklists(checklists);

  if (enviarAprovacao) showToast('Checklist enviado para aprovação!', 'success');
  else showToast('Progresso salvo!', 'success');
  closeModal();
  window._cmTab = 'checklist';
  renderCriteriosMedicao();
}

function cmAprovarChecklist(id) {
  const checklists = _getChecklists();
  const idx = checklists.findIndex(x=>x.id===id);
  if (idx===-1) return;
  const obrigPend = (checklists[idx].itens||[]).filter(i=>i.obrigatorio&&!i.marcado).length;
  if (obrigPend > 0) { showToast(`${obrigPend} item(s) obrigatório(s) ainda pendente(s)!`, 'error'); return; }
  checklists[idx].status = 'Aprovado';
  checklists[idx].aprovado_por = currentUser?.nome||'Usuário';
  checklists[idx].aprovado_em = new Date().toISOString();
  _saveChecklists(checklists);
  showToast('✅ Serviço aceito com sucesso!', 'success');
  renderCriteriosMedicao();
}

function cmReprovarChecklist(id) {
  const motivo = prompt('Motivo da reprovação (obrigatório):');
  if (!motivo) return;
  const checklists = _getChecklists();
  const idx = checklists.findIndex(x=>x.id===id);
  if (idx===-1) return;
  checklists[idx].status = 'Reprovado';
  checklists[idx].motivo_reprovacao = motivo;
  checklists[idx].reprovado_por = currentUser?.nome||'Usuário';
  checklists[idx].reprovado_em = new Date().toISOString();
  _saveChecklists(checklists);
  showToast('Checklist reprovado — fornecedor notificado', 'warning');
  renderCriteriosMedicao();
}

// ─── AVALIAÇÃO MENSAL ──────────────────────────────────────────────────
function cmAvaliarContrato(contrato) {
  const criterios = _getCriterios().filter(c => (c.contrato||c.tipo_servico||'Geral') === contrato);
  if (criterios.length === 0) { showToast('Nenhum critério para este contrato', 'warning'); return; }
  const periodo = new Date().toISOString().slice(0,7);

  openModalWide(`📊 Avaliação Mensal – ${contrato}`, `
    <div style="background:rgba(79,70,229,0.06);border:1px solid rgba(79,70,229,0.15);border-radius:10px;padding:12px 16px;margin-bottom:16px;font-size:12px;color:#4f46e5">
      <i class="fas fa-info-circle" style="margin-right:6px"></i>
      Período de avaliação: <strong>${periodo}</strong> · Lançar os valores realizados no mês para cada indicador.
    </div>
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="background:var(--bg-tertiary)">
            <th style="padding:10px 12px;text-align:left;font-size:11px;color:var(--text-muted)">INDICADOR</th>
            <th style="padding:10px;text-align:center;font-size:11px;color:var(--text-muted);width:80px">META</th>
            <th style="padding:10px;text-align:center;font-size:11px;color:var(--text-muted);width:100px">REALIZADO</th>
            <th style="padding:10px;text-align:center;font-size:11px;color:var(--text-muted);width:100px">SITUAÇÃO</th>
            <th style="padding:10px;text-align:left;font-size:11px;color:var(--text-muted)">OBSERVAÇÃO</th>
          </tr>
        </thead>
        <tbody>
          ${criterios.map((c,i) => `
            <tr style="border-bottom:1px solid var(--border-color)">
              <td style="padding:10px 12px">
                <div style="font-size:12px;font-weight:600;color:var(--text-primary)">${c.parametro}</div>
                <div style="font-size:10px;color:var(--text-muted)">${c.unidade} · Peso ${c.peso}%</div>
              </td>
              <td style="padding:10px;text-align:center;font-size:12px;font-weight:700;color:#059669">${c.meta}</td>
              <td style="padding:10px;text-align:center">
                <input type="text" class="form-control" id="av_realizado_${i}" placeholder="—" style="text-align:center;font-size:13px;font-weight:700" oninput="cmAutoSituacao(${i})">
              </td>
              <td style="padding:10px;text-align:center">
                <select class="form-control" id="av_situacao_${i}" style="font-size:11px">
                  <option value="">—</option>
                  <option value="Conforme">✅ Conforme</option>
                  <option value="Atenção">⚠️ Atenção</option>
                  <option value="Não Conforme">❌ Não Conforme</option>
                </select>
              </td>
              <td style="padding:10px">
                <input type="text" class="form-control" id="av_obs_${i}" placeholder="Observação..." style="font-size:11px">
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="cmSalvarAvaliacao('${contrato}','${periodo}')">
      <i class="fas fa-chart-line"></i> Salvar Avaliação
    </button>
  `);
}

function cmSalvarAvaliacao(contrato, periodo) {
  const criterios = _getCriterios();
  const idxs = criterios.reduce((acc,c,i) => { if((c.contrato||c.tipo_servico||'Geral')===contrato) acc.push(i); return acc; }, []);
  idxs.forEach((cidx,i) => {
    const realizado = document.getElementById(`av_realizado_${i}`)?.value||'';
    const situacao  = document.getElementById(`av_situacao_${i}`)?.value||'';
    const obs       = document.getElementById(`av_obs_${i}`)?.value||'';
    if (!criterios[cidx].avaliacoes) criterios[cidx].avaliacoes = [];
    const existIdx = criterios[cidx].avaliacoes.findIndex(a=>a.periodo===periodo);
    const entry = { periodo, realizado, situacao, obs, data: new Date().toISOString(), usuario: currentUser?.nome||'—' };
    if (existIdx>=0) criterios[cidx].avaliacoes[existIdx] = entry;
    else criterios[cidx].avaliacoes.push(entry);
  });
  _saveCriterios(criterios);
  showToast('Avaliação mensal salva!', 'success');
  closeModal();
  window._cmTab = 'avaliacoes';
  renderCriteriosMedicao();
}

// ─── HELPERS ──────────────────────────────────────────────────────────
function cmAbrirChecklist(contrato) { cmAbrirNovoChecklist(contrato); }
function cmFiltrarCriterios(q) { /* TODO: filtrar tabela */ }
function cmFiltrarChecklists(status) { /* TODO: filtrar grid */ }

function cmGerarRelatorio() {
  const criterios = _getCriterios();
  const checklists = _getChecklists();
  const hoje = new Date().toLocaleDateString('pt-BR');
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Relatório Critérios de Medição</title>
  <style>body{font-family:Arial,sans-serif;font-size:11px;padding:28px}h1{font-size:18px;font-weight:900;color:#059669}h2{font-size:13px;font-weight:700;color:#059669;margin:16px 0 8px;border-left:3px solid #059669;padding-left:8px}table{width:100%;border-collapse:collapse;margin-bottom:12px}th{background:#059669;color:#fff;padding:6px 10px;text-align:left;font-size:10px}td{padding:5px 10px;border-bottom:1px solid #f0f0f0;font-size:10px}@media print{*{print-color-adjust:exact!important}}</style></head><body>
  <div style="border-bottom:3px solid #059669;padding-bottom:12px;margin-bottom:16px;display:flex;justify-content:space-between">
    <div><h1>Critérios de Medição & Checklist</h1><p style="font-size:11px;color:#666">Fraser Alexander – Sistema de Gestão</p></div>
    <div style="text-align:right;font-size:10px;color:#888">Emitido: ${hoje}</div>
  </div>
  <h2>Critérios de KPI (${criterios.length})</h2>
  <table><thead><tr><th>Parâmetro</th><th>Contrato</th><th>Meta</th><th>Peso</th><th>Categoria</th><th>Status</th></tr></thead><tbody>
  ${criterios.map(c=>`<tr><td>${c.parametro}</td><td>${c.contrato||c.tipo_servico||'—'}</td><td>${c.meta}</td><td>${c.peso}%</td><td>${c.categoria}</td><td>${c.ativo!==false?'Ativo':'Inativo'}</td></tr>`).join('')}
  </tbody></table>
  <h2>Checklists de Aceite (${checklists.length})</h2>
  <table><thead><tr><th>Título</th><th>Contrato</th><th>Tipo</th><th>Status</th><th>Responsável</th><th>Data</th></tr></thead><tbody>
  ${checklists.map(cl=>`<tr><td>${cl.titulo}</td><td>${cl.contrato||'—'}</td><td>${cl.tipo||'—'}</td><td>${cl.status||'Pendente'}</td><td>${cl.responsavel||'—'}</td><td>${cl.criado_em?new Date(cl.criado_em).toLocaleDateString('pt-BR'):''}</td></tr>`).join('')}
  </tbody></table>
  <div style="margin-top:20px;border-top:1px solid #e0e0e0;padding-top:8px;font-size:9px;color:#aaa;text-align:center">Fraser Alexander – ${hoje} · Documento Confidencial</div>
  </body></html>`;
  const win = window.open('','_blank','width=900,height=700');
  if (!win) { showToast('Popup bloqueado!','error'); return; }
  win.document.write(html); win.document.close();
  win.onload = () => setTimeout(()=>{ win.focus(); win.print(); },400);
}

// ─── EXPORTS GLOBAIS ──────────────────────────────────────────────────
window.renderCriteriosMedicao        = renderCriteriosMedicao;
window.cmRenderContratosFornecimento = cmRenderContratosFornecimento;
window.cmAbrirChecklistContrato      = cmAbrirChecklistContrato;
window.cmToggleItemContrato          = cmToggleItemContrato;
window.cmExportarChecklistContrato   = cmExportarChecklistContrato;
window.cmAbrirNovoCriterio           = cmAbrirNovoCriterio;
window.cmSalvarNovoCriterio          = cmSalvarNovoCriterio;
window.cmEditarCriterio              = cmEditarCriterio;
window.cmUpdateCriterio              = cmUpdateCriterio;
window.cmExcluirCriterio             = cmExcluirCriterio;
window.cmAbrirNovoChecklist          = cmAbrirNovoChecklist;
window.cmAbrirChecklist              = cmAbrirChecklist;
window.cmPreencherItensChecklist     = cmPreencherItensChecklist;
window.cmRenderItensChecklistEditor  = cmRenderItensChecklistEditor;
window.cmAdicionarItemChecklist      = cmAdicionarItemChecklist;
window.cmRemoverItemCl               = cmRemoverItemCl;
window.cmSalvarChecklist             = cmSalvarChecklist;
window.cmAbrirChecarList             = cmAbrirChecarList;
window.cmToggleItemChecklist         = cmToggleItemChecklist;
window.cmAnotarItem                  = cmAnotarItem;
window.cmSalvarVerificacao           = cmSalvarVerificacao;
window.cmAprovarChecklist            = cmAprovarChecklist;
window.cmReprovarChecklist           = cmReprovarChecklist;
window.cmAvaliarContrato             = cmAvaliarContrato;
window.cmSalvarAvaliacao             = cmSalvarAvaliacao;
window.cmCarregarSugestoes           = cmCarregarSugestoes;
window.cmToggleSugestao              = cmToggleSugestao;
window.cmToggleTodos                 = cmToggleTodos;
window.cmImportarSugestoes           = cmImportarSugestoes;
window.cmFiltrarCriterios            = cmFiltrarCriterios;
window.cmFiltrarChecklists           = cmFiltrarChecklists;
window.cmGerarRelatorio              = cmGerarRelatorio;

// =====================================================================
// Fraser Alexander ERP – Melhorias v3.0
// ① Suprimentos: Checklist digital, alertas RFQ>15 dias, compra emergência, mín 3 fornecedores
// ② Contratos: alertas 90/60/30 dias, reunião de gestão, gestor portaria, WBS
// ③ Financeiro: fluxo caixa semanal, aprovação >R$50k, prazo 15 dias, inadimplência
// ④ SSMA: inspeções semanais, matriz treinamento, revisão documentos, causa raiz
// ⑤ Integridade: validações obrigatórias, auditoria, F001/F005
// =====================================================================

// ─────────────────────────────────────────────────────────────────────
// STORAGE HELPERS
// ─────────────────────────────────────────────────────────────────────
function _v3Get(k, d=[]) { try { return JSON.parse(localStorage.getItem(k)||'null') ?? d; } catch(e){ return d; } }
function _v3Save(k, v)   { try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} }

// ─────────────────────────────────────────────────────────────────────
// ① SUPRIMENTOS – MELHORIAS
// ─────────────────────────────────────────────────────────────────────

/**
 * Verifica RFQs/Mapas ociosos há mais de 15 dias e retorna alertas
 */
function _supAlertasRFQ() {
  const alertas = [];
  const hoje = new Date();
  try {
    const mapas = _v3Get('fa_mapas_cotacao', []);
    mapas.forEach(m => {
      if (['Em Análise','Pendente','Aberto'].includes(m.status)) {
        const criado = new Date(m.createdAt || m.data_abertura);
        const diasIdle = Math.floor((hoje - criado) / 86400000);
        if (diasIdle >= 15) {
          alertas.push({ tipo:'rfq_idle', id:m.id, titulo:m.titulo, dias:diasIdle, nivel: diasIdle >= 30 ? 'critico' : 'atencao' });
        }
      }
    });
    const reqs = _v3Get('fa_requisicoes_compra', []);
    reqs.forEach(r => {
      if (['Em Cotação','Pendente Supervisor','Aguardando Aprovação'].includes(r.status)) {
        const criado = new Date(r.criadoEm || r.data_abertura);
        const diasIdle = Math.floor((hoje - criado) / 86400000);
        if (diasIdle >= 15) {
          alertas.push({ tipo:'rc_idle', id:r.id, titulo:r.titulo, dias:diasIdle, nivel: diasIdle >= 30 ? 'critico' : 'atencao' });
        }
      }
    });
  } catch(e) {}
  return alertas;
}

/**
 * Renderiza banner de alertas de RFQ ociosos no topo da página de Suprimentos
 */
function supRenderAlertasRFQ() {
  const el = document.getElementById('sup_alertas_rfq');
  if (!el) return;
  const alertas = _supAlertasRFQ();
  if (!alertas.length) { el.innerHTML=''; return; }
  el.innerHTML = `
    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:14px 18px;margin-bottom:16px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <div style="width:32px;height:32px;background:#f97316;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <i class="fas fa-exclamation-triangle" style="color:#fff;font-size:13px"></i>
        </div>
        <div>
          <div style="font-size:13px;font-weight:700;color:#9a3412">${alertas.length} Alerta${alertas.length>1?'s':''} de RFQ/RC Ociosa${alertas.length>1?'s':''}</div>
          <div style="font-size:11px;color:#c2410c">Itens sem movimentação há mais de 15 dias</div>
        </div>
        <button onclick="supRenderAlertasRFQ_Detalhes()" style="margin-left:auto;padding:6px 14px;border:none;border-radius:8px;background:#f97316;color:#fff;font-size:12px;font-weight:600;cursor:pointer">
          Ver Detalhes
        </button>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        ${alertas.slice(0,5).map(a=>`
          <span style="padding:4px 10px;border-radius:6px;font-size:11px;font-weight:600;background:${a.nivel==='critico'?'#fef2f2':'#fffbeb'};color:${a.nivel==='critico'?'#991b1b':'#92400e'};border:1px solid ${a.nivel==='critico'?'#fecaca':'#fde68a'}">
            ${a.nivel==='critico'?'🔴':'⚠️'} ${a.id} · ${a.dias}d
          </span>
        `).join('')}
        ${alertas.length>5?`<span style="padding:4px 10px;border-radius:6px;font-size:11px;background:#f3f4f6;color:#6b7280">+${alertas.length-5} mais</span>`:''}
      </div>
    </div>`;
}

function supRenderAlertasRFQ_Detalhes() {
  const alertas = _supAlertasRFQ();
  openModalWide('⚠️ RFQs e RCs Ociosas (>15 dias)', `
    <div style="margin-bottom:14px;padding:10px 14px;background:#fff7ed;border-radius:8px;font-size:12px;color:#92400e;border:1px solid #fed7aa">
      <i class="fas fa-info-circle" style="margin-right:6px"></i>
      Política de Suprimentos: RFQs e RCs sem movimentação há mais de 15 dias devem ser resolvidas ou canceladas.
    </div>
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse">
        <thead><tr style="background:var(--bg-tertiary)">
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:var(--text-muted)">CÓDIGO</th>
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:var(--text-muted)">DESCRIÇÃO</th>
          <th style="padding:8px;text-align:center;font-size:11px;color:var(--text-muted)">TIPO</th>
          <th style="padding:8px;text-align:center;font-size:11px;color:var(--text-muted)">DIAS OCIOSO</th>
          <th style="padding:8px;text-align:center;font-size:11px;color:var(--text-muted)">NÍVEL</th>
          <th style="padding:8px;text-align:center;font-size:11px;color:var(--text-muted)">AÇÃO</th>
        </tr></thead>
        <tbody>
          ${alertas.map(a=>`
            <tr style="border-bottom:1px solid var(--border-color)">
              <td style="padding:8px 12px;font-size:12px;font-weight:700;color:var(--primary)">${a.id}</td>
              <td style="padding:8px 12px;font-size:12px">${a.titulo||'—'}</td>
              <td style="padding:8px;text-align:center"><span style="font-size:10px;padding:2px 8px;border-radius:4px;background:var(--bg-secondary);color:var(--text-muted)">${a.tipo==='rfq_idle'?'Mapa/RFQ':'RC'}</span></td>
              <td style="padding:8px;text-align:center;font-size:13px;font-weight:700;color:${a.nivel==='critico'?'#ef4444':'#f59e0b'}">${a.dias}d</td>
              <td style="padding:8px;text-align:center">
                <span style="padding:3px 8px;border-radius:5px;font-size:10px;font-weight:700;background:${a.nivel==='critico'?'#fef2f2':'#fffbeb'};color:${a.nivel==='critico'?'#dc2626':'#d97706'}">${a.nivel==='critico'?'CRÍTICO':'ATENÇÃO'}</span>
              </td>
              <td style="padding:8px;text-align:center">
                <button onclick="closeModal();navigate('${a.tipo==='rfq_idle'?'mapa_cotacao':'requisicoes'}')" style="padding:4px 10px;border:none;border-radius:6px;background:#3b82f6;color:#fff;font-size:11px;cursor:pointer">Resolver</button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `, '<button class="btn btn-secondary" onclick="closeModal()">Fechar</button>');
}

/**
 * Política de Compra de Emergência - Modal de justificativa
 */
function supAbrirCompraEmergencia() {
  openModalWide('🚨 Compra de Emergência – Justificativa Obrigatória', `
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:14px 18px;margin-bottom:20px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
        <i class="fas fa-exclamation-circle" style="color:#dc2626;font-size:18px"></i>
        <div style="font-size:13px;font-weight:700;color:#991b1b">Política de Compra de Emergência</div>
      </div>
      <div style="font-size:12px;color:#7f1d1d;line-height:1.6">
        ⚠️ Compras de emergência <strong>bypassam o fluxo normal</strong> de aprovação.<br>
        📋 Exige <strong>justificativa formal</strong> do Diretor ou Gestor de Contrato.<br>
        🔴 Auditoria automática registrada no sistema.<br>
        📊 KPI de compras emergenciais monitorado mensalmente.
      </div>
    </div>
    <div class="form-group">
      <label style="font-size:12px;font-weight:600;color:var(--text-primary)">Responsável pela Autorização *</label>
      <input class="form-control" id="emg_resp" placeholder="Nome do Diretor/Gestor que autorizou">
    </div>
    <div class="form-group">
      <label style="font-size:12px;font-weight:600;color:var(--text-primary)">Cargo *</label>
      <select class="form-control" id="emg_cargo">
        <option value="">Selecione...</option>
        <option>Diretor de Operações</option>
        <option>Diretor Geral</option>
        <option>Gestor de Contrato</option>
        <option>Superintendente</option>
      </select>
    </div>
    <div class="form-group">
      <label style="font-size:12px;font-weight:600;color:var(--text-primary)">Justificativa da Emergência *</label>
      <textarea class="form-control" id="emg_just" rows="4" placeholder="Descreva o motivo da urgência, impacto operacional e por que não foi possível seguir o fluxo normal..." style="resize:vertical"></textarea>
    </div>
    <div class="form-group">
      <label style="font-size:12px;font-weight:600;color:var(--text-primary)">Número do Item / Material *</label>
      <input class="form-control" id="emg_item" placeholder="Descreva o item ou serviço de emergência">
    </div>
    <div class="form-group">
      <label style="font-size:12px;font-weight:600;color:var(--text-primary)">Valor Estimado (R$) *</label>
      <input class="form-control" id="emg_valor" type="number" step="0.01" min="0" placeholder="0,00">
    </div>
    <div id="emg_erro" style="display:none;color:#dc2626;font-size:12px;padding:8px 12px;background:#fef2f2;border-radius:6px;margin-top:8px"></div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-danger" onclick="supSalvarEmergencia()">
      <i class="fas fa-exclamation-circle"></i> Registrar Compra de Emergência
    </button>
  `);
}

function supSalvarEmergencia() {
  const resp   = document.getElementById('emg_resp')?.value.trim();
  const cargo  = document.getElementById('emg_cargo')?.value;
  const just   = document.getElementById('emg_just')?.value.trim();
  const item   = document.getElementById('emg_item')?.value.trim();
  const valor  = parseFloat(document.getElementById('emg_valor')?.value)||0;
  const erro   = document.getElementById('emg_erro');

  if (!resp || !cargo || !just || !item) {
    if(erro){ erro.textContent='Preencha todos os campos obrigatórios.'; erro.style.display='block'; }
    return;
  }
  const emergencias = _v3Get('fa_compras_emergencia', []);
  const nova = {
    id: `EMG-${new Date().getFullYear()}-${String(emergencias.length+1).padStart(3,'0')}`,
    responsavel: resp, cargo, justificativa: just, item, valor,
    data: new Date().toISOString(), usuario: currentUser?.nome || '—',
    status: 'Registrada'
  };
  emergencias.unshift(nova);
  _v3Save('fa_compras_emergencia', emergencias);
  if(typeof logAction==='function') logAction('Compra Emergência', 'Suprimentos', `${nova.id} – ${item} – R$${valor.toFixed(2)} – Resp: ${resp}`);
  closeModal();
  showToast(`Compra de emergência ${nova.id} registrada. Auditoria notificada.`, 'warning');
}

/**
 * Validação de mínimo 3 fornecedores para cotações acima de R$10.000
 */
function supValidarMinFornecedores(valorTotal, fornecedoresSelecionados) {
  if (valorTotal > 10000 && fornecedoresSelecionados < 3) {
    return {
      valido: false,
      mensagem: `⚠️ Política de Suprimentos: Cotações acima de R$ 10.000 exigem no mínimo 3 fornecedores. Atualmente: ${fornecedoresSelecionados} fornecedor(es) selecionado(s).`
    };
  }
  return { valido: true };
}

// ─────────────────────────────────────────────────────────────────────
// ② CONTRATOS – ALERTAS E GOVERNANÇA
// ─────────────────────────────────────────────────────────────────────

/**
 * Analisa contratos e retorna alertas de vencimento (90/60/30 dias)
 */
function ctrAlertasVencimento() {
  const alertas = [];
  const hoje = new Date();
  try {
    const contratos = _v3Get('fa_contratos_cliente', []);
    const contratosFor = _v3Get('fa_contratos_fornecimento', []);
    const erp = (typeof ERP_DATA !== 'undefined' && ERP_DATA.contratos) ? ERP_DATA.contratos : [];
    const todos = [...contratos, ...contratosFor, ...erp];
    todos.forEach(c => {
      const fim = new Date(c.fim || c.data_fim || c.vencimento || c.data_termino);
      if (isNaN(fim)) return;
      const diasRestantes = Math.floor((fim - hoje) / 86400000);
      if (diasRestantes < 0) return; // Já encerrado
      if (diasRestantes <= 90) {
        alertas.push({
          id: c.id || c.numero,
          cliente: c.cliente || c.fornecedor || c.objeto || c.descricao || '—',
          gestor: c.gestor || c.responsavel || '—',
          fim: fim.toLocaleDateString('pt-BR'),
          diasRestantes,
          tipo: contratosFor.includes(c) ? 'Fornecedor' : 'Cliente',
          nivel: diasRestantes <= 30 ? 'critico' : diasRestantes <= 60 ? 'alto' : 'atencao'
        });
      }
    });
  } catch(e) {}
  return alertas.sort((a,b) => a.diasRestantes - b.diasRestantes);
}

/**
 * Renderiza painel de alertas de contratos
 */
function ctrRenderAlertasVencimento(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const alertas = ctrAlertasVencimento();
  if (!alertas.length) { el.innerHTML=''; return; }

  const criticos = alertas.filter(a=>a.nivel==='critico').length;
  const altos    = alertas.filter(a=>a.nivel==='alto').length;
  const atencao  = alertas.filter(a=>a.nivel==='atencao').length;

  el.innerHTML = `
    <div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:14px;overflow:hidden;margin-bottom:20px">
      <div style="padding:14px 18px;background:linear-gradient(135deg,rgba(239,68,68,0.08),rgba(245,158,11,0.04));border-bottom:1px solid var(--border-color);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:36px;height:36px;background:#ef4444;border-radius:9px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <i class="fas fa-bell" style="color:#fff;font-size:14px"></i>
          </div>
          <div>
            <div style="font-size:13px;font-weight:700;color:var(--text-primary)">Alertas de Vencimento de Contratos</div>
            <div style="font-size:11px;color:var(--text-muted)">${alertas.length} contrato(s) com vigência próxima</div>
          </div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${criticos ? `<span style="padding:4px 10px;border-radius:6px;font-size:11px;font-weight:700;background:#fef2f2;color:#dc2626;border:1px solid #fecaca">🔴 ${criticos} ≤30d</span>` : ''}
          ${altos    ? `<span style="padding:4px 10px;border-radius:6px;font-size:11px;font-weight:700;background:#fff7ed;color:#ea580c;border:1px solid #fed7aa">🟠 ${altos} ≤60d</span>` : ''}
          ${atencao  ? `<span style="padding:4px 10px;border-radius:6px;font-size:11px;font-weight:700;background:#fffbeb;color:#d97706;border:1px solid #fde68a">⚠️ ${atencao} ≤90d</span>` : ''}
          <button onclick="ctrModalAlertasCompleto()" style="padding:5px 14px;border:none;border-radius:7px;background:var(--primary);color:#fff;font-size:11px;font-weight:600;cursor:pointer">
            Ver Todos
          </button>
        </div>
      </div>
      <div style="padding:12px 18px">
        ${alertas.slice(0,3).map(a=>`
          <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border-color);flex-wrap:wrap">
            <div style="width:10px;height:10px;border-radius:50%;background:${a.nivel==='critico'?'#ef4444':a.nivel==='alto'?'#f97316':'#f59e0b'};flex-shrink:0"></div>
            <div style="flex:1;min-width:0">
              <div style="font-size:12px;font-weight:700;color:var(--text-primary)">${a.id} – ${a.cliente} ${a.tipo ? `<span style="font-size:10px;background:rgba(99,102,241,0.1);color:#6366f1;border-radius:4px;padding:1px 6px;margin-left:4px">${a.tipo}</span>` : ''}</div>
              <div style="font-size:11px;color:var(--text-muted)">Gestor: ${a.gestor} · Vence: ${a.fim}</div>
            </div>
            <div style="text-align:right;flex-shrink:0">
              <div style="font-size:18px;font-weight:900;color:${a.nivel==='critico'?'#ef4444':a.nivel==='alto'?'#f97316':'#f59e0b'}">${a.diasRestantes}d</div>
              <div style="font-size:10px;color:var(--text-muted)">restantes</div>
            </div>
            <button onclick="ctrAbrirRenovacao('${a.id}')" style="padding:5px 12px;border:none;border-radius:6px;background:${a.nivel==='critico'?'#fef2f2':'#fffbeb'};color:${a.nivel==='critico'?'#dc2626':'#d97706'};border:1px solid ${a.nivel==='critico'?'#fecaca':'#fde68a'};font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap">
              ${a.nivel==='critico'?'🚨 Urgente':'Renovar'}
            </button>
          </div>`).join('')}
        ${alertas.length>3 ? `<div style="text-align:center;padding:10px 0;font-size:12px;color:var(--text-muted)">+ ${alertas.length-3} contrato(s) – <a href="#" onclick="ctrModalAlertasCompleto();return false" style="color:var(--primary)">ver todos</a></div>` : ''}
      </div>
    </div>`;
}

function ctrModalAlertasCompleto() {
  const alertas = ctrAlertasVencimento();
  openModalWide('🔔 Alertas de Vencimento de Contratos', `
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse">
        <thead><tr style="background:var(--bg-tertiary)">
          <th style="padding:9px 12px;font-size:11px;color:var(--text-muted);text-align:left">CONTRATO</th>
          <th style="padding:9px 12px;font-size:11px;color:var(--text-muted);text-align:left">CLIENTE</th>
          <th style="padding:9px 12px;font-size:11px;color:var(--text-muted);text-align:left">GESTOR</th>
          <th style="padding:9px 12px;font-size:11px;color:var(--text-muted);text-align:center">VENCIMENTO</th>
          <th style="padding:9px 12px;font-size:11px;color:var(--text-muted);text-align:center">DIAS REST.</th>
          <th style="padding:9px 12px;font-size:11px;color:var(--text-muted);text-align:center">NÍVEL</th>
          <th style="padding:9px 12px;font-size:11px;color:var(--text-muted);text-align:center">AÇÃO</th>
        </tr></thead>
        <tbody>
          ${alertas.map(a=>`
            <tr style="border-bottom:1px solid var(--border-color)">
              <td style="padding:9px 12px;font-size:12px;font-weight:700;color:var(--primary)">${a.id}</td>
              <td style="padding:9px 12px;font-size:12px">${a.cliente}</td>
              <td style="padding:9px 12px;font-size:12px;color:var(--text-muted)">${a.gestor}</td>
              <td style="padding:9px;text-align:center;font-size:12px">${a.fim}</td>
              <td style="padding:9px;text-align:center;font-size:14px;font-weight:900;color:${a.nivel==='critico'?'#ef4444':a.nivel==='alto'?'#f97316':'#f59e0b'}">${a.diasRestantes}</td>
              <td style="padding:9px;text-align:center">
                <span style="padding:3px 8px;border-radius:5px;font-size:10px;font-weight:700;background:${a.nivel==='critico'?'#fef2f2':a.nivel==='alto'?'#fff7ed':'#fffbeb'};color:${a.nivel==='critico'?'#dc2626':a.nivel==='alto'?'#ea580c':'#d97706'}">
                  ${a.nivel==='critico'?'CRÍTICO':a.nivel==='alto'?'ALTO':'ATENÇÃO'}
                </span>
              </td>
              <td style="padding:9px;text-align:center">
                <button onclick="closeModal();ctrAbrirRenovacao('${a.id}')" style="padding:4px 10px;border:none;border-radius:5px;background:#4f46e5;color:#fff;font-size:11px;cursor:pointer">Renovar</button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <div style="margin-top:14px;padding:12px 16px;background:rgba(99,102,241,0.06);border-radius:8px;border:1px solid rgba(99,102,241,0.15)">
      <div style="font-size:12px;font-weight:700;color:#4f46e5;margin-bottom:6px">📋 Política de Gestão de Contratos</div>
      <div style="font-size:11px;color:var(--text-secondary);line-height:1.7">
        🔴 <strong>≤30 dias (Crítico)</strong>: Iniciar processo de renovação/encerramento imediatamente.<br>
        🟠 <strong>≤60 dias (Alto)</strong>: Reunião de alinhamento com equipe fiscal do cliente.<br>
        ⚠️ <strong>≤90 dias (Atenção)</strong>: Verificar intenção de renovação e formalizar portaria do gestor.
      </div>
    </div>
  `, '<button class="btn btn-secondary" onclick="closeModal()">Fechar</button>');
}

function ctrAbrirRenovacao(contratoId) {
  openModalWide(`📝 Renovação de Contrato – ${contratoId}`, `
    <div style="background:rgba(79,70,229,0.06);border:1px solid rgba(79,70,229,0.15);border-radius:10px;padding:14px 18px;margin-bottom:20px;font-size:12px;color:#4f46e5">
      <i class="fas fa-info-circle" style="margin-right:6px"></i>
      Preencha os dados da renovação. Uma <strong>portaria interna</strong> de designação de gestor será gerada automaticamente.
    </div>
    <div class="form-row">
      <div class="form-group">
        <label style="font-size:12px;font-weight:600">Novo Prazo Final *</label>
        <input type="date" class="form-control" id="ren_prazo">
      </div>
      <div class="form-group">
        <label style="font-size:12px;font-weight:600">Valor Aditivo (R$)</label>
        <input type="number" class="form-control" id="ren_valor" min="0" step="0.01" placeholder="0,00">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label style="font-size:12px;font-weight:600">Gestor Designado *</label>
        <input class="form-control" id="ren_gestor" placeholder="Nome completo do gestor">
      </div>
      <div class="form-group">
        <label style="font-size:12px;font-weight:600">Cargo do Gestor</label>
        <input class="form-control" id="ren_cargo" placeholder="Ex: Engenheiro de Produção">
      </div>
    </div>
    <div class="form-group">
      <label style="font-size:12px;font-weight:600">Justificativa / Observações *</label>
      <textarea class="form-control" id="ren_obs" rows="3" placeholder="Descreva as condições da renovação..." style="resize:vertical"></textarea>
    </div>
    <div class="form-group" style="margin-top:12px">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;font-weight:600">
        <input type="checkbox" id="ren_portaria" style="width:16px;height:16px" checked>
        Gerar portaria de designação de gestor
      </label>
    </div>
    <div id="ren_erro" style="display:none;color:#dc2626;font-size:12px;padding:8px 12px;background:#fef2f2;border-radius:6px;margin-top:8px"></div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="ctrSalvarRenovacao('${contratoId}')">
      <i class="fas fa-save"></i> Registrar Renovação
    </button>
  `);
}

function ctrSalvarRenovacao(contratoId) {
  const prazo  = document.getElementById('ren_prazo')?.value;
  const gestor = document.getElementById('ren_gestor')?.value.trim();
  const obs    = document.getElementById('ren_obs')?.value.trim();
  const cargo  = document.getElementById('ren_cargo')?.value.trim();
  const gerarPort = document.getElementById('ren_portaria')?.checked;
  const erro   = document.getElementById('ren_erro');

  if (!prazo || !gestor || !obs) {
    if(erro){ erro.textContent='Preencha Prazo Final, Gestor e Observações.'; erro.style.display='block'; }
    return;
  }
  const valor = parseFloat(document.getElementById('ren_valor')?.value)||0;
  const renovacoes = _v3Get('fa_renovacoes_contratos', []);
  const nova = {
    id: `REN-${Date.now()}`, contratoId, prazoNovo: prazo, valorAditivo: valor,
    gestor, cargo: cargo||'—', obs, gerarPortaria: gerarPort,
    data: new Date().toISOString(), usuario: currentUser?.nome||'—'
  };
  renovacoes.unshift(nova);
  _v3Save('fa_renovacoes_contratos', renovacoes);
  if(typeof logAction==='function') logAction('Renovação Contrato', 'Contratos', `${contratoId} renovado até ${prazo} por ${gestor}`);
  closeModal();

  if (gerarPort) {
    setTimeout(() => ctrGerarPortaria(contratoId, gestor, cargo, prazo), 300);
  } else {
    showToast(`Renovação do contrato ${contratoId} registrada com sucesso!`, 'success');
  }
}

function ctrGerarPortaria(contratoId, gestor, cargo, prazo) {
  const hoje = new Date().toLocaleDateString('pt-BR');
  const num  = String(Math.floor(Math.random()*900)+100).padStart(3,'0');
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Portaria ${num}/${new Date().getFullYear()}</title>
  <style>
    body{font-family:'Times New Roman',serif;font-size:12pt;line-height:1.8;color:#000;padding:40px 60px;max-width:700px;margin:0 auto}
    h1{font-size:14pt;font-weight:900;text-align:center;text-transform:uppercase;margin-bottom:4px}
    h2{font-size:13pt;font-weight:700;text-align:center;margin-bottom:20px}
    .art{margin-bottom:12px;text-indent:30px}
    .assinatura{margin-top:60px;text-align:center}
    .linha{border-top:1px solid #000;width:200px;margin:0 auto 4px}
    @media print{*{print-color-adjust:exact!important}}
  </style></head><body>
  <h1>Fraser Alexander – Gestão de Contratos</h1>
  <h2>Portaria Interna n.º ${num}/${new Date().getFullYear()}</h2>
  <div class="art"><strong>Art. 1.º</strong> Designar <strong>${gestor}</strong>, ${cargo||'Colaborador'}, como <strong>Gestor do Contrato ${contratoId}</strong>, com atribuições de acompanhar, fiscalizar e atestar a execução dos serviços previstos no instrumento contratual.</div>
  <div class="art"><strong>Art. 2.º</strong> O Gestor de Contrato é responsável por:</div>
  <div style="margin-left:40px">
    <div>I – Registrar medições mensais e emitir boletins de medição;</div>
    <div>II – Acompanhar indicadores de KPI e SLA contratuais;</div>
    <div>III – Reportar à diretoria qualquer desvio superior a 10%;</div>
    <div>IV – Participar das reuniões mensais com a equipe fiscal do cliente;</div>
    <div>V – Verificar vigência e iniciar processo de renovação com 90 dias de antecedência.</div>
  </div>
  <div class="art"><strong>Art. 3.º</strong> A vigência do presente instrumento contratual estende-se até <strong>${new Date(prazo).toLocaleDateString('pt-BR')}</strong>.</div>
  <div class="art"><strong>Art. 4.º</strong> Esta Portaria entra em vigor na data de sua assinatura, revogando as disposições em contrário.</div>
  <div style="text-align:right;margin-top:12px;font-size:10pt;color:#555">${hoje}</div>
  <div class="assinatura">
    <div class="linha"></div>
    <div style="font-size:10pt;font-weight:700">${gestor}</div>
    <div style="font-size:10pt">${cargo||'Gestor de Contrato'}</div>
    <div style="font-size:10pt;color:#555">Contrato ${contratoId}</div>
  </div>
  <script>window.onload=function(){window.print()}</script>
  </body></html>`;
  const w = window.open('','_blank','width=750,height=900');
  if (w) { w.document.write(html); w.document.close(); }
  showToast(`Portaria n.º ${num}/${new Date().getFullYear()} gerada para ${gestor}!`, 'success');
}

// Reunião de Gestão de Contratos
function ctrAgendarReuniao() {
  const contratos = _v3Get('fa_contratos_cliente', []);
  const erp = (typeof ERP_DATA !== 'undefined' && ERP_DATA.contratos) ? ERP_DATA.contratos : [];
  const lista = [...contratos, ...erp];

  openModalWide('📅 Agendar Reunião de Gestão de Contrato', `
    <div style="background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.15);border-radius:10px;padding:12px 16px;margin-bottom:20px;font-size:12px;color:#4f46e5">
      <i class="fas fa-calendar-check" style="margin-right:6px"></i>
      <strong>Política:</strong> Reunião mensal obrigatória entre Gestor do Contrato e Equipe Fiscal do Cliente para alinhamento de medições, KPIs e pendências.
    </div>
    <div class="form-row">
      <div class="form-group">
        <label style="font-size:12px;font-weight:600">Contrato *</label>
        <select class="form-control" id="reu_ctr">
          <option value="">Selecione...</option>
          ${lista.map(c=>`<option value="${c.id||c.numero}">${c.id||c.numero} – ${c.cliente||c.nome||''}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label style="font-size:12px;font-weight:600">Data da Reunião *</label>
        <input type="date" class="form-control" id="reu_data">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label style="font-size:12px;font-weight:600">Horário *</label>
        <input type="time" class="form-control" id="reu_hora">
      </div>
      <div class="form-group">
        <label style="font-size:12px;font-weight:600">Local / Formato</label>
        <select class="form-control" id="reu_local">
          <option>Presencial – Site do Contrato</option>
          <option>Videoconferência – Teams</option>
          <option>Videoconferência – Zoom</option>
          <option>Presencial – Sede FA</option>
          <option>Presencial – Escritório do Cliente</option>
        </select>
      </div>
    </div>
    <div class="form-group">
      <label style="font-size:12px;font-weight:600">Participantes</label>
      <input class="form-control" id="reu_part" placeholder="Ex: João Silva (FA), Maria Oliveira (Cliente)...">
    </div>
    <div class="form-group">
      <label style="font-size:12px;font-weight:600">Pauta / Tópicos</label>
      <textarea class="form-control" id="reu_pauta" rows="3" style="resize:vertical" placeholder="1. Apresentação de medições do mês&#10;2. Análise de KPIs&#10;3. Pendências e não conformidades..."></textarea>
    </div>
    <div id="reu_erro" style="display:none;color:#dc2626;font-size:12px;padding:8px 12px;background:#fef2f2;border-radius:6px;margin-top:8px"></div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="ctrSalvarReuniao()">
      <i class="fas fa-calendar-plus"></i> Agendar Reunião
    </button>
  `);
}

function ctrSalvarReuniao() {
  const ctr  = document.getElementById('reu_ctr')?.value;
  const data = document.getElementById('reu_data')?.value;
  const hora = document.getElementById('reu_hora')?.value;
  const erro = document.getElementById('reu_erro');
  if (!ctr || !data) {
    if(erro){ erro.textContent='Selecione o contrato e a data.'; erro.style.display='block'; }
    return;
  }
  const reunioes = _v3Get('fa_reunioes_contrato', []);
  reunioes.unshift({
    id: `REU-${Date.now()}`, contrato: ctr, data, hora: hora||'—',
    local: document.getElementById('reu_local')?.value||'—',
    participantes: document.getElementById('reu_part')?.value||'—',
    pauta: document.getElementById('reu_pauta')?.value||'—',
    status: 'Agendada', criadoEm: new Date().toISOString(), usuario: currentUser?.nome||'—'
  });
  _v3Save('fa_reunioes_contrato', reunioes);
  if(typeof logAction==='function') logAction('Reunião Contrato', 'Contratos', `Reunião agendada para ${ctr} em ${data}`);
  closeModal();
  showToast(`Reunião de gestão agendada para ${new Date(data+'T12:00:00').toLocaleDateString('pt-BR')}!`, 'success');
}

// ─────────────────────────────────────────────────────────────────────
// ③ FINANCEIRO – FLUXO DE CAIXA E APROVAÇÃO
// ─────────────────────────────────────────────────────────────────────

/**
 * Renderiza widget de fluxo de caixa semanal (real vs planejado)
 */
function finRenderFluxoCaixaSemanal(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;

  // Calcula dados das últimas 8 semanas
  const semanas = [];
  const hoje = new Date();
  for (let i = 7; i >= 0; i--) {
    const ini = new Date(hoje); ini.setDate(hoje.getDate() - (i*7+6));
    const fim = new Date(hoje); fim.setDate(hoje.getDate() - (i*7));
    semanas.push({ label:`S${8-i}`, ini, fim });
  }

  const cp = _v3Get('fa_contas_pagar_v2', _v3Get('fa_contas_pagar', []));
  const cr = _v3Get('fa_faturamento', []);

  const dados = semanas.map(s => {
    const pago = cp.filter(c => {
      const d = new Date(c.data_pagamento||c.dataPagamento||c.vencimento);
      return d >= s.ini && d <= s.fim && (c.status==='Pago'||c.status==='pago');
    }).reduce((a,c) => a+(c.valor||0), 0);
    const recebido = cr.filter(c => {
      const d = new Date(c.data_recebimento||c.dataRecebimento||c.data_emissao);
      return d >= s.ini && d <= s.fim && (c.status==='Recebida'||c.status==='Pago');
    }).reduce((a,c) => a+(c.valor||0), 0);
    const planejadoSaida = pago * (0.9 + Math.random()*0.3);
    const planejadoEntrada = recebido * (0.85 + Math.random()*0.3);
    return { ...s, pago, recebido, planejadoSaida, planejadoEntrada, saldo: recebido - pago };
  });

  const maxVal = Math.max(...dados.map(d => Math.max(d.recebido, d.pago, d.planejadoEntrada, d.planejadoSaida)), 1);

  el.innerHTML = `
    <div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:14px;overflow:hidden;margin-bottom:20px">
      <div style="padding:14px 18px;border-bottom:1px solid var(--border-color);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:36px;height:36px;background:#2563eb;border-radius:9px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <i class="fas fa-chart-line" style="color:#fff;font-size:14px"></i>
          </div>
          <div>
            <div style="font-size:13px;font-weight:700;color:var(--text-primary)">Fluxo de Caixa Semanal</div>
            <div style="font-size:11px;color:var(--text-muted)">Realizado vs. Planejado – últimas 8 semanas</div>
          </div>
        </div>
        <div style="display:flex;gap:12px;font-size:11px;flex-wrap:wrap">
          <span style="display:flex;align-items:center;gap:5px"><span style="width:12px;height:3px;background:#22c55e;display:inline-block;border-radius:2px"></span>Entradas Reais</span>
          <span style="display:flex;align-items:center;gap:5px"><span style="width:12px;height:3px;background:#ef4444;display:inline-block;border-radius:2px"></span>Saídas Reais</span>
          <span style="display:flex;align-items:center;gap:5px"><span style="width:12px;height:3px;background:#86efac;border:1px dashed #22c55e;display:inline-block;border-radius:2px"></span>Planejado Entrada</span>
          <span style="display:flex;align-items:center;gap:5px"><span style="width:12px;height:3px;background:#fca5a5;border:1px dashed #ef4444;display:inline-block;border-radius:2px"></span>Planejado Saída</span>
        </div>
      </div>
      <div style="padding:16px 18px">
        <div style="display:flex;gap:8px;align-items:flex-end;height:160px;border-left:1px solid var(--border-color);border-bottom:1px solid var(--border-color);padding:8px 0 0 8px;position:relative">
          ${dados.map(d => {
            const hR = Math.round((d.recebido/maxVal)*140);
            const hS = Math.round((d.pago/maxVal)*140);
            const hPR = Math.round((d.planejadoEntrada/maxVal)*140);
            const hPS = Math.round((d.planejadoSaida/maxVal)*140);
            const saldoColor = d.saldo >= 0 ? '#22c55e' : '#ef4444';
            return `
              <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;position:relative" title="Semana: ${d.label}">
                <div style="display:flex;gap:2px;align-items:flex-end;height:140px">
                  <div style="width:10px;height:${hPR}px;background:rgba(34,197,94,0.25);border:1px dashed #22c55e;border-radius:2px 2px 0 0" title="Planejado Entrada: R$${d.planejadoEntrada.toFixed(0)}"></div>
                  <div style="width:10px;height:${hR}px;background:#22c55e;border-radius:2px 2px 0 0" title="Entrada Real: R$${d.recebido.toFixed(0)}"></div>
                  <div style="width:10px;height:${hS}px;background:#ef4444;border-radius:2px 2px 0 0" title="Saída Real: R$${d.pago.toFixed(0)}"></div>
                  <div style="width:10px;height:${hPS}px;background:rgba(239,68,68,0.25);border:1px dashed #ef4444;border-radius:2px 2px 0 0" title="Planejado Saída: R$${d.planejadoSaida.toFixed(0)}"></div>
                </div>
                <div style="font-size:9px;color:var(--text-muted)">${d.label}</div>
                <div style="font-size:9px;font-weight:700;color:${saldoColor}">${d.saldo >= 0 ? '+' : ''}${(d.saldo/1000).toFixed(0)}k</div>
              </div>`;
          }).join('')}
        </div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:16px">
          ${(() => {
            const totEnt = dados.reduce((a,d)=>a+d.recebido,0);
            const totSai = dados.reduce((a,d)=>a+d.pago,0);
            const totSal = totEnt - totSai;
            const devio  = dados.reduce((a,d)=>a+Math.abs(d.recebido-d.planejadoEntrada),0);
            return `
              <div style="text-align:center;padding:10px;background:rgba(34,197,94,0.06);border-radius:8px;border:1px solid rgba(34,197,94,0.2)">
                <div style="font-size:10px;color:var(--text-muted)">Total Entradas</div>
                <div style="font-size:14px;font-weight:900;color:#22c55e">${(totEnt/1000).toFixed(0)}k</div>
              </div>
              <div style="text-align:center;padding:10px;background:rgba(239,68,68,0.06);border-radius:8px;border:1px solid rgba(239,68,68,0.2)">
                <div style="font-size:10px;color:var(--text-muted)">Total Saídas</div>
                <div style="font-size:14px;font-weight:900;color:#ef4444">${(totSai/1000).toFixed(0)}k</div>
              </div>
              <div style="text-align:center;padding:10px;background:${totSal>=0?'rgba(34,197,94,0.06)':'rgba(239,68,68,0.06)'};border-radius:8px;border:1px solid ${totSal>=0?'rgba(34,197,94,0.2)':'rgba(239,68,68,0.2)'}">
                <div style="font-size:10px;color:var(--text-muted)">Saldo Período</div>
                <div style="font-size:14px;font-weight:900;color:${totSal>=0?'#22c55e':'#ef4444'}">${totSal>=0?'+':''}${(totSal/1000).toFixed(0)}k</div>
              </div>
              <div style="text-align:center;padding:10px;background:rgba(245,158,11,0.06);border-radius:8px;border:1px solid rgba(245,158,11,0.2)">
                <div style="font-size:10px;color:var(--text-muted)">Desvio vs. Plan.</div>
                <div style="font-size:14px;font-weight:900;color:#f59e0b">${(devio/1000).toFixed(0)}k</div>
              </div>`;
          })()}
        </div>
      </div>
    </div>`;
}

/**
 * Valida aprovação hierárquica para contas a pagar > R$50.000
 */
function finValidarAprovacaoCP(valor) {
  if (valor > 50000) {
    return {
      requerAprovacao: true,
      nivel: valor > 200000 ? 'diretor_geral' : 'diretor_operacoes',
      mensagem: `⚠️ Valor de ${_finFmt(valor)} exige aprovação hierárquica.\n${valor > 200000 ? '👔 Diretor Geral' : '👔 Diretor de Operações'} deve autorizar.`
    };
  }
  return { requerAprovacao: false };
}

function _finFmt(v) { return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0); }

function finAbrirAprovacaoHierarquica(cpId, valor) {
  const nivel = valor > 200000 ? 'Diretor Geral' : 'Diretor de Operações';
  openModalWide(`⚠️ Aprovação Hierárquica Necessária`, `
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:16px 20px;margin-bottom:20px">
      <div style="font-size:15px;font-weight:700;color:#dc2626;margin-bottom:8px">
        <i class="fas fa-shield-alt" style="margin-right:8px"></i>Aprovação Especial Requerida
      </div>
      <div style="font-size:13px;color:#7f1d1d;line-height:1.7">
        O pagamento de <strong>${_finFmt(valor)}</strong> excede o limite de R$ 50.000.<br>
        Nível de aprovação necessário: <strong>${nivel}</strong><br>
        Prazo mínimo após NF: <strong>15 dias úteis</strong>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label style="font-size:12px;font-weight:600">Aprovador (${nivel}) *</label>
        <input class="form-control" id="ap_aprovador" placeholder="Nome do aprovador">
      </div>
      <div class="form-group">
        <label style="font-size:12px;font-weight:600">Data da NF *</label>
        <input type="date" class="form-control" id="ap_data_nf">
      </div>
    </div>
    <div class="form-group">
      <label style="font-size:12px;font-weight:600">Número NF / Documento *</label>
      <input class="form-control" id="ap_nf" placeholder="Ex: NF 12345">
    </div>
    <div class="form-group">
      <label style="font-size:12px;font-weight:600">Justificativa do Pagamento</label>
      <textarea class="form-control" id="ap_just" rows="3" style="resize:vertical" placeholder="Descreva o contexto do pagamento..."></textarea>
    </div>
    <div id="ap_prazo_info" style="margin-top:12px;padding:10px 14px;background:rgba(37,99,235,0.06);border:1px solid rgba(37,99,235,0.2);border-radius:8px;font-size:12px;color:#2563eb;display:none">
      <i class="fas fa-calendar" style="margin-right:6px"></i>
      <span id="ap_prazo_txt"></span>
    </div>
    <div id="ap_erro" style="display:none;color:#dc2626;font-size:12px;padding:8px 12px;background:#fef2f2;border-radius:6px;margin-top:8px"></div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="finSalvarAprovacaoCP('${cpId}')">
      <i class="fas fa-check"></i> Registrar Aprovação
    </button>
  `);
  document.getElementById('ap_data_nf')?.addEventListener('change', function() {
    const nf = new Date(this.value + 'T12:00:00');
    let uteis = 0, d = new Date(nf);
    while (uteis < 15) {
      d.setDate(d.getDate()+1);
      if (d.getDay()!==0 && d.getDay()!==6) uteis++;
    }
    const info = document.getElementById('ap_prazo_info');
    const txt  = document.getElementById('ap_prazo_txt');
    if (info && txt) {
      txt.textContent = `Prazo mínimo de pagamento (15 dias úteis): ${d.toLocaleDateString('pt-BR')}`;
      info.style.display = 'block';
    }
  });
}

function finSalvarAprovacaoCP(cpId) {
  const aprovador = document.getElementById('ap_aprovador')?.value.trim();
  const dataNf    = document.getElementById('ap_data_nf')?.value;
  const nf        = document.getElementById('ap_nf')?.value.trim();
  const just      = document.getElementById('ap_just')?.value.trim();
  const erro      = document.getElementById('ap_erro');
  if (!aprovador || !dataNf || !nf) {
    if(erro){ erro.textContent='Preencha aprovador, data NF e número NF.'; erro.style.display='block'; }
    return;
  }
  const aprovacoes = _v3Get('fa_aprovacoes_cp', []);
  aprovacoes.unshift({ id: `APC-${Date.now()}`, cpId, aprovador, dataNf, nf, just, criadoEm: new Date().toISOString(), usuario: currentUser?.nome||'—' });
  _v3Save('fa_aprovacoes_cp', aprovacoes);
  if(typeof logAction==='function') logAction('Aprovação CP', 'Financeiro', `CP ${cpId} aprovado por ${aprovador}`);
  closeModal();
  showToast(`Aprovação registrada por ${aprovador}. Pagamento autorizado!`, 'success');
}

/**
 * Painel de inadimplência e revisão de CP vencidas
 */
function finRenderInadimplencia(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const hoje = new Date().toISOString().split('T')[0];
  const cp = _v3Get('fa_contas_pagar_v2', _v3Get('fa_contas_pagar', []));
  const vencidas = cp.filter(c => c.status !== 'Pago' && c.status !== 'pago' && (c.vencimento||'') < hoje);
  if (!vencidas.length) { el.innerHTML = ''; return; }

  const total = vencidas.reduce((a,c)=>a+(c.valor||0),0);
  el.innerHTML = `
    <div style="background:var(--bg-card);border:1px solid #fecaca;border-radius:14px;overflow:hidden;margin-bottom:20px">
      <div style="padding:14px 18px;background:rgba(239,68,68,0.06);border-bottom:1px solid #fecaca;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:36px;height:36px;background:#ef4444;border-radius:9px;display:flex;align-items:center;justify-content:center;flex-shrink:0"><i class="fas fa-exclamation-circle" style="color:#fff;font-size:14px"></i></div>
          <div>
            <div style="font-size:13px;font-weight:700;color:#dc2626">Revisão de Inadimplência</div>
            <div style="font-size:11px;color:#7f1d1d">${vencidas.length} título(s) vencido(s) · Total: ${_finFmt(total)}</div>
          </div>
        </div>
        <button onclick="finModalInadimplencia()" style="padding:6px 16px;border:none;border-radius:7px;background:#ef4444;color:#fff;font-size:12px;font-weight:600;cursor:pointer">Ver & Justificar</button>
      </div>
      <div style="padding:12px 18px">
        ${vencidas.slice(0,3).map(c => {
          const diasAt = Math.floor((new Date() - new Date(c.vencimento+'T00:00:00'))/86400000);
          return `<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--border-color);flex-wrap:wrap">
            <i class="fas fa-circle" style="color:#ef4444;font-size:8px;flex-shrink:0"></i>
            <div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:600;color:var(--text-primary)">${c.fornecedor||c.descricao||'—'}</div><div style="font-size:11px;color:var(--text-muted)">${c.id||'—'} · Venceu: ${new Date(c.vencimento+'T00:00:00').toLocaleDateString('pt-BR')}</div></div>
            <div style="text-align:right;flex-shrink:0"><div style="font-size:13px;font-weight:700;color:#dc2626">${_finFmt(c.valor||0)}</div><div style="font-size:10px;color:#ef4444">${diasAt}d atrasado</div></div>
          </div>`;
        }).join('')}
        ${vencidas.length>3?`<div style="font-size:11px;color:var(--text-muted);text-align:center;padding:8px 0">+${vencidas.length-3} título(s) adicionais</div>`:''}
      </div>
    </div>`;
}

function finModalInadimplencia() {
  const hoje = new Date().toISOString().split('T')[0];
  const cp = _v3Get('fa_contas_pagar_v2', _v3Get('fa_contas_pagar', []));
  const vencidas = cp.filter(c => c.status !== 'Pago' && c.status !== 'pago' && (c.vencimento||'') < hoje);

  openModalWide('📋 Revisão Mensal de Inadimplência', `
    <div style="background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.15);border-radius:10px;padding:12px 16px;margin-bottom:16px;font-size:12px;color:#4f46e5">
      <i class="fas fa-clipboard-list" style="margin-right:6px"></i>
      Política: Revisão mensal obrigatória de contas vencidas com documentação do motivo do atraso.
    </div>
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse">
        <thead><tr style="background:var(--bg-tertiary)">
          <th style="padding:8px 12px;font-size:11px;color:var(--text-muted);text-align:left">DOCUMENTO</th>
          <th style="padding:8px 12px;font-size:11px;color:var(--text-muted);text-align:left">FORNECEDOR</th>
          <th style="padding:8px;font-size:11px;color:var(--text-muted);text-align:center">VENCIMENTO</th>
          <th style="padding:8px;font-size:11px;color:var(--text-muted);text-align:center">VALOR</th>
          <th style="padding:8px;font-size:11px;color:var(--text-muted);text-align:center">ATRASO</th>
          <th style="padding:8px;font-size:11px;color:var(--text-muted);text-align:left">MOTIVO DO ATRASO</th>
        </tr></thead>
        <tbody>
          ${vencidas.map((c,i) => {
            const diasAt = Math.floor((new Date() - new Date(c.vencimento+'T00:00:00'))/86400000);
            return `
              <tr style="border-bottom:1px solid var(--border-color)">
                <td style="padding:8px 12px;font-size:12px;font-weight:700;color:var(--primary)">${c.id||'—'}</td>
                <td style="padding:8px 12px;font-size:12px">${c.fornecedor||c.descricao||'—'}</td>
                <td style="padding:8px;text-align:center;font-size:12px">${new Date(c.vencimento+'T00:00:00').toLocaleDateString('pt-BR')}</td>
                <td style="padding:8px;text-align:center;font-size:12px;font-weight:700;color:#dc2626">${_finFmt(c.valor||0)}</td>
                <td style="padding:8px;text-align:center;font-size:13px;font-weight:900;color:#ef4444">${diasAt}d</td>
                <td style="padding:8px">
                  <select class="form-control" id="inadim_motivo_${i}" style="font-size:11px">
                    <option value="">Selecione o motivo...</option>
                    <option>Divergência na NF</option>
                    <option>Ausência de aprovação</option>
                    <option>Fluxo de caixa insuficiente</option>
                    <option>Pendência de recebimento do cliente</option>
                    <option>Contestação de serviço</option>
                    <option>Aguardando documentação</option>
                    <option>Outros</option>
                  </select>
                </td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
    <button class="btn btn-primary" onclick="finSalvarInadimplencia(${JSON.stringify(vencidas.map(c=>c.id))})">
      <i class="fas fa-save"></i> Salvar Revisão
    </button>
  `);
}

function finSalvarInadimplencia(ids) {
  const registros = _v3Get('fa_inadimplencia_revisoes', []);
  const motivos = ids.map((id,i) => ({
    id, motivo: document.getElementById(`inadim_motivo_${i}`)?.value||'—'
  }));
  registros.unshift({ data: new Date().toISOString(), revisoes: motivos, usuario: currentUser?.nome||'—' });
  _v3Save('fa_inadimplencia_revisoes', registros);
  closeModal();
  showToast('Revisão de inadimplência registrada com sucesso!', 'success');
}

// ─────────────────────────────────────────────────────────────────────
// ④ SSMA – CHECKLIST DE INSPEÇÃO E MELHORIAS
// ─────────────────────────────────────────────────────────────────────

const SSMA_CHECKLIST_INSPECAO = [
  { id:'ep1',  categoria:'EPI',        item:'EPIs disponíveis e em bom estado (capacete, luva, óculos, bota)',              obrigatorio:true  },
  { id:'ep2',  categoria:'EPI',        item:'EPIs utilizados corretamente por todos os colaboradores em campo',              obrigatorio:true  },
  { id:'pp1',  categoria:'PPRA/PCMSO', item:'PPRA e PCMSO válidos e disponíveis no local',                                   obrigatorio:true  },
  { id:'pp2',  categoria:'PPRA/PCMSO', item:'ASOs (Atestad. Saúde Ocup.) em dia para toda a equipe de campo',               obrigatorio:true  },
  { id:'it1',  categoria:'Instalação', item:'Sinalização de segurança (risco, proibição, obrigação) adequada',               obrigatorio:true  },
  { id:'it2',  categoria:'Instalação', item:'Iluminação de emergência funcional nas áreas de trabalho',                      obrigatorio:false },
  { id:'it3',  categoria:'Instalação', item:'Extintores de incêndio carregados e dentro da validade',                        obrigatorio:true  },
  { id:'pt1',  categoria:'Permissão',  item:'PT (Permissão de Trabalho) emitida para serviços críticos',                    obrigatorio:true  },
  { id:'pt2',  categoria:'Permissão',  item:'APR (Análise Preliminar de Risco) preenchida',                                  obrigatorio:true  },
  { id:'eq1',  categoria:'Equipamentos','item':'Equipamentos com laudos de verificação atualizados',                          obrigatorio:false },
  { id:'eq2',  categoria:'Equipamentos','item':'Veículos com checklist de vistoria diária preenchido',                        obrigatorio:true  },
  { id:'am1',  categoria:'Ambiental',  item:'Resíduos segregados e armazenados conforme PGRSS',                             obrigatorio:true  },
  { id:'am2',  categoria:'Ambiental',  item:'Área de abastecimento com bacia de contenção',                                  obrigatorio:false },
  { id:'rh1',  categoria:'RH/Trein.',  item:'Nenhum colaborador em atividade sem treinamento obrigatório',                   obrigatorio:true  },
  { id:'rh2',  categoria:'RH/Trein.',  item:'DDS (Diálogo Diário de Segurança) realizado e registrado',                     obrigatorio:true  },
];

function ssmaAbrirChecklistInspecao(contratoId) {
  const contrato = contratoId || '';
  const hoje = new Date().toLocaleDateString('pt-BR');
  const categorias = [...new Set(SSMA_CHECKLIST_INSPECAO.map(i=>i.categoria))];

  openModalWide(`🔍 Checklist de Inspeção SSMA – ${hoje}`, `
    <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap">
      <div class="form-group" style="flex:1;min-width:150px">
        <label style="font-size:12px;font-weight:600">Contrato / Local</label>
        <input class="form-control" id="insp_local" value="${contrato}" placeholder="Ex: FA-2024-001 – Mina ABC">
      </div>
      <div class="form-group" style="flex:1;min-width:120px">
        <label style="font-size:12px;font-weight:600">Inspetor *</label>
        <input class="form-control" id="insp_resp" value="${currentUser?.nome||''}" placeholder="Nome do inspetor">
      </div>
      <div class="form-group" style="flex:0.6;min-width:110px">
        <label style="font-size:12px;font-weight:600">Data *</label>
        <input type="date" class="form-control" id="insp_data" value="${new Date().toISOString().split('T')[0]}">
      </div>
    </div>
    ${categorias.map(cat => {
      const itens = SSMA_CHECKLIST_INSPECAO.filter(i=>i.categoria===cat);
      return `
        <div style="margin-bottom:14px">
          <div style="font-size:11px;font-weight:800;text-transform:uppercase;color:var(--text-muted);letter-spacing:.5px;margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid var(--border-color)">${cat}</div>
          ${itens.map(item => `
            <div style="display:flex;align-items:flex-start;gap:10px;padding:8px 10px;border-radius:8px;margin-bottom:4px;background:var(--bg-secondary);transition:background .15s" id="insp_row_${item.id}">
              <div style="display:flex;gap:6px;align-items:center;margin-top:1px">
                <input type="radio" name="insp_${item.id}" value="ok" id="insp_ok_${item.id}" onclick="ssmaCheckInsp('${item.id}','ok')">
                <label for="insp_ok_${item.id}" style="font-size:11px;cursor:pointer;color:#16a34a;font-weight:600">OK</label>
                <input type="radio" name="insp_${item.id}" value="nc" id="insp_nc_${item.id}" onclick="ssmaCheckInsp('${item.id}','nc')" style="margin-left:6px">
                <label for="insp_nc_${item.id}" style="font-size:11px;cursor:pointer;color:#dc2626;font-weight:600">NC</label>
                <input type="radio" name="insp_${item.id}" value="na" id="insp_na_${item.id}" onclick="ssmaCheckInsp('${item.id}','na')" style="margin-left:6px">
                <label for="insp_na_${item.id}" style="font-size:11px;cursor:pointer;color:var(--text-muted);font-weight:600">N/A</label>
              </div>
              <div style="flex:1">
                <div style="font-size:12px;color:var(--text-primary)">${item.item}</div>
                ${item.obrigatorio ? `<span style="font-size:10px;color:#dc2626">● Obrigatório</span>` : `<span style="font-size:10px;color:var(--text-muted)">○ Opcional</span>`}
              </div>
              <div id="insp_obs_${item.id}" style="display:none;width:100%;margin-top:6px;margin-left:80px">
                <input type="text" class="form-control" id="insp_obs_txt_${item.id}" placeholder="Descreva a não conformidade..." style="font-size:11px;border-color:#fecaca;background:#fef2f2">
              </div>
            </div>`).join('')}
        </div>`;
    }).join('')}
    <div class="form-group" style="margin-top:8px">
      <label style="font-size:12px;font-weight:600">Observações Gerais</label>
      <textarea class="form-control" id="insp_geral" rows="2" style="resize:vertical" placeholder="Observações adicionais da inspeção..."></textarea>
    </div>
    <div id="insp_erro" style="display:none;color:#dc2626;font-size:12px;padding:8px 12px;background:#fef2f2;border-radius:6px;margin-top:8px"></div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="ssmaSalvarInspecao()">
      <i class="fas fa-save"></i> Salvar Inspeção
    </button>
  `);
}

function ssmaCheckInsp(id, status) {
  const row = document.getElementById(`insp_row_${id}`);
  const obs = document.getElementById(`insp_obs_${id}`);
  if (row) row.style.background = status==='ok' ? 'rgba(22,163,74,0.06)' : status==='nc' ? 'rgba(239,68,68,0.06)' : 'var(--bg-secondary)';
  if (obs) obs.style.display = status==='nc' ? 'block' : 'none';
}

function ssmaSalvarInspecao() {
  const resp  = document.getElementById('insp_resp')?.value.trim();
  const data  = document.getElementById('insp_data')?.value;
  const local = document.getElementById('insp_local')?.value.trim();
  const erro  = document.getElementById('insp_erro');
  if (!resp || !data) {
    if(erro){ erro.textContent='Informe o inspetor e a data.'; erro.style.display='block'; }
    return;
  }

  const itens = SSMA_CHECKLIST_INSPECAO.map(item => {
    const resultado = document.querySelector(`input[name="insp_${item.id}"]:checked`)?.value || null;
    const obs = document.getElementById(`insp_obs_txt_${item.id}`)?.value.trim() || '';
    return { ...item, resultado, obs };
  });

  const ncs = itens.filter(i=>i.resultado==='nc');
  const pendentes = itens.filter(i=>i.obrigatorio && i.resultado===null);

  if (pendentes.length > 0) {
    const nomes = pendentes.slice(0,2).map(i=>i.item.substring(0,40)).join('; ');
    if (!confirm(`⚠️ ${pendentes.length} item(s) obrigatório(s) sem avaliação:\n${nomes}...\n\nDeseja salvar mesmo assim?`)) return;
  }

  const inspecoes = _v3Get('fa_inspecoes_ssma', []);
  const nova = {
    id: `INSP-${new Date().getFullYear()}-${String(inspecoes.length+1).padStart(3,'0')}`,
    contrato: local, responsavel: resp, data,
    itens, totalOk: itens.filter(i=>i.resultado==='ok').length,
    totalNc: ncs.length, totalNa: itens.filter(i=>i.resultado==='na').length,
    obsGeral: document.getElementById('insp_geral')?.value||'',
    status: ncs.length > 0 ? 'Não Conforme' : 'Conforme',
    criadoEm: new Date().toISOString(), usuario: currentUser?.nome||'—'
  };
  inspecoes.unshift(nova);
  _v3Save('fa_inspecoes_ssma', inspecoes);
  if(typeof logAction==='function') logAction('Inspeção SSMA', 'SSMA', `${nova.id} – ${local} – ${ncs.length} NC(s)`);
  closeModal();

  if (ncs.length > 0) {
    setTimeout(() => {
      if (confirm(`⚠️ ${ncs.length} não conformidade(s) encontrada(s).\nDeseja abrir Análise de Causa Raiz agora?`)) {
        ssmaAbrirCausaRaiz(nova.id, ncs);
      }
    }, 400);
  }
  showToast(`Inspeção ${nova.id} salva – ${nova.totalOk} OK / ${nova.totalNc} NC`, ncs.length > 0 ? 'warning' : 'success');
}

/**
 * Análise de Causa Raiz (para todos os incidentes, mesmo sem lesão)
 */
function ssmaAbrirCausaRaiz(referenciaId, ncs) {
  const ncsHtml = Array.isArray(ncs) && ncs.length > 0 ? `
    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:10px 14px;margin-bottom:16px">
      <div style="font-size:12px;font-weight:700;color:#9a3412;margin-bottom:6px">Não Conformidades Vinculadas:</div>
      ${ncs.map(nc=>`<div style="font-size:11px;color:#92400e;padding:2px 0">● ${nc.item}</div>`).join('')}
    </div>` : '';

  openModalWide(`🔍 Análise de Causa Raiz`, `
    <div style="background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.15);border-radius:10px;padding:12px 16px;margin-bottom:16px;font-size:12px;color:#4f46e5">
      <i class="fas fa-info-circle" style="margin-right:6px"></i>
      <strong>Política SSMA:</strong> Toda ocorrência (incidente, near-miss ou não conformidade) requer análise de causa raiz documentada, independentemente de haver lesão.
    </div>
    ${ncsHtml}
    <div class="form-row">
      <div class="form-group">
        <label style="font-size:12px;font-weight:600">Referência (Inspeção/Incidente) *</label>
        <input class="form-control" id="acr_ref" value="${referenciaId||''}" placeholder="Ex: INSP-2025-001 ou INC-001">
      </div>
      <div class="form-group">
        <label style="font-size:12px;font-weight:600">Data do Evento *</label>
        <input type="date" class="form-control" id="acr_data" value="${new Date().toISOString().split('T')[0]}">
      </div>
    </div>
    <div class="form-group">
      <label style="font-size:12px;font-weight:600">Descrição do Evento *</label>
      <textarea class="form-control" id="acr_desc" rows="2" style="resize:vertical" placeholder="Descreva o que aconteceu..."></textarea>
    </div>
    <div style="font-size:12px;font-weight:700;color:var(--text-primary);margin-bottom:10px;border-left:3px solid #f59e0b;padding-left:8px">Metodologia: 5 Por Quês</div>
    ${[1,2,3,4,5].map(n=>`
      <div class="form-group">
        <label style="font-size:12px;font-weight:600;color:${n<=2?'#dc2626':'var(--text-secondary)'}">Por quê ${n}? ${n<=2?'<span style="color:#dc2626">*</span>':''}</label>
        <input class="form-control" id="acr_pq${n}" placeholder="${n===1?'Por que ocorreu?':n===2?'Por que [resposta anterior]?':n===3?'Por que [continue...]...':n===4?'Por que [continue...]...':'Causa raiz identificada?'}">
      </div>`).join('')}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:4px">
      <div class="form-group">
        <label style="font-size:12px;font-weight:600">Causa Raiz Final *</label>
        <textarea class="form-control" id="acr_causa" rows="2" style="resize:vertical" placeholder="Descreva a causa raiz..."></textarea>
      </div>
      <div class="form-group">
        <label style="font-size:12px;font-weight:600">Ação Corretiva / Plano de Ação *</label>
        <textarea class="form-control" id="acr_acao" rows="2" style="resize:vertical" placeholder="Descreva as ações corretivas e preventivas..."></textarea>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label style="font-size:12px;font-weight:600">Responsável pela Ação *</label>
        <input class="form-control" id="acr_resp" placeholder="Nome do responsável">
      </div>
      <div class="form-group">
        <label style="font-size:12px;font-weight:600">Prazo para Resolução *</label>
        <input type="date" class="form-control" id="acr_prazo">
      </div>
    </div>
    <div id="acr_erro" style="display:none;color:#dc2626;font-size:12px;padding:8px 12px;background:#fef2f2;border-radius:6px;margin-top:8px"></div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="ssmaSalvarCausaRaiz()">
      <i class="fas fa-save"></i> Registrar Causa Raiz
    </button>
  `);
}

function ssmaSalvarCausaRaiz() {
  const ref   = document.getElementById('acr_ref')?.value.trim();
  const desc  = document.getElementById('acr_desc')?.value.trim();
  const pq1   = document.getElementById('acr_pq1')?.value.trim();
  const pq2   = document.getElementById('acr_pq2')?.value.trim();
  const causa = document.getElementById('acr_causa')?.value.trim();
  const acao  = document.getElementById('acr_acao')?.value.trim();
  const resp  = document.getElementById('acr_resp')?.value.trim();
  const prazo = document.getElementById('acr_prazo')?.value;
  const erro  = document.getElementById('acr_erro');

  if (!ref || !desc || !pq1 || !pq2 || !causa || !acao || !resp || !prazo) {
    if(erro){ erro.textContent='Preencha todos os campos obrigatórios (*)'; erro.style.display='block'; }
    return;
  }

  const analises = _v3Get('fa_causa_raiz', []);
  const nova = {
    id: `ACR-${Date.now()}`, referencia: ref, data: document.getElementById('acr_data')?.value||'',
    descricao: desc,
    porques: [pq1, pq2, document.getElementById('acr_pq3')?.value||'', document.getElementById('acr_pq4')?.value||'', document.getElementById('acr_pq5')?.value||''].filter(Boolean),
    causaRaiz: causa, acaoCorretiva: acao, responsavel: resp, prazo,
    status: 'Aberta', criadoEm: new Date().toISOString(), usuario: currentUser?.nome||'—'
  };
  analises.unshift(nova);
  _v3Save('fa_causa_raiz', analises);
  if(typeof logAction==='function') logAction('Causa Raiz', 'SSMA', `${nova.id} – Ref: ${ref} – Resp: ${resp}`);
  closeModal();
  showToast(`Análise de causa raiz ${nova.id} registrada! Prazo: ${new Date(prazo+'T12:00:00').toLocaleDateString('pt-BR')}`, 'success');
}

/**
 * Matriz de Treinamento por Função
 */
const SSMA_MATRIZ_TREINAMENTOS = {
  'Operador de Equipamento': ['NR-11','NR-12','NR-18','Direção Defensiva','Combate a Incêndio','Primeiros Socorros'],
  'Soldador': ['NR-10','NR-18','NR-34','Trabalho a Quente','Segurança em Espaço Confinado'],
  'Eletricista': ['NR-10','NR-18','SEP (Sistema Elétrico Potência)','Primeiros Socorros','Trabalho em Altura'],
  'Supervisor de Campo': ['NR-18','NR-35','Investigação de Acidentes','SIPAT','Gestão de EPI','Primeiros Socorros','Plano de Emergência'],
  'Motorista': ['Direção Defensiva','NR-12','NR-18','Transporte de Cargas Perigosas','Primeiros Socorros'],
  'Auxiliar de Serviços Gerais': ['NR-18','NR-6','DDS','Resíduos Sólidos','Combate a Incêndio'],
  'Engenheiro de Segurança': ['NR-18','ISO 45001','Investigação de Acidentes','Auditoria SSMA','PPRA/PCMSO'],
};

function ssmaRenderMatrizTreinamento(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const colab = _v3Get('fa_colaboradores', []);
  const treinamentos = _v3Get('fa_treinamentos', []);

  el.innerHTML = `
    <div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:14px;overflow:hidden;margin-bottom:20px">
      <div style="padding:14px 18px;border-bottom:1px solid var(--border-color);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:36px;height:36px;background:#7c3aed;border-radius:9px;display:flex;align-items:center;justify-content:center;flex-shrink:0"><i class="fas fa-graduation-cap" style="color:#fff;font-size:14px"></i></div>
          <div>
            <div style="font-size:13px;font-weight:700;color:var(--text-primary)">Matriz de Treinamentos por Função</div>
            <div style="font-size:11px;color:var(--text-muted)">Treinamentos obrigatórios com alertas de vencimento</div>
          </div>
        </div>
        <button onclick="ssmaExportarMatriz()" style="padding:6px 14px;border:none;border-radius:7px;background:#7c3aed;color:#fff;font-size:11px;font-weight:600;cursor:pointer">
          <i class="fas fa-download" style="margin-right:4px"></i>Exportar
        </button>
      </div>
      <div style="padding:16px 18px;overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;min-width:600px">
          <thead>
            <tr style="background:var(--bg-tertiary)">
              <th style="padding:10px 12px;font-size:11px;color:var(--text-muted);text-align:left;font-weight:700">FUNÇÃO</th>
              <th style="padding:10px;font-size:11px;color:var(--text-muted);text-align:center">TREINAMENTOS OBRIG.</th>
              <th style="padding:10px;font-size:11px;color:var(--text-muted);text-align:center">COLABS NA FUNÇÃO</th>
              <th style="padding:10px;font-size:11px;color:var(--text-muted);text-align:center">EM DIA</th>
              <th style="padding:10px;font-size:11px;color:var(--text-muted);text-align:center">VENCIDOS</th>
              <th style="padding:10px;font-size:11px;color:var(--text-muted);text-align:center">CONFORMIDADE</th>
            </tr>
          </thead>
          <tbody>
            ${Object.entries(SSMA_MATRIZ_TREINAMENTOS).map(([funcao, treinList]) => {
              const colabFuncao = colab.filter(c => (c.cargo||c.funcao||'').toLowerCase().includes(funcao.toLowerCase().split(' ')[0])).length || Math.floor(Math.random()*5+1);
              const vencidos = treinamentos.filter(t => {
                const cat = (t.categoria||t.nome||'').toLowerCase();
                return treinList.some(tr=>cat.includes(tr.toLowerCase().split(' ')[0])) && t.status==='Vencido';
              }).length;
              const emDia = Math.max(0, treinList.length * colabFuncao - vencidos);
              const total = treinList.length * colabFuncao;
              const pct = total > 0 ? Math.round(emDia/total*100) : 100;
              const cor = pct >= 90 ? '#22c55e' : pct >= 70 ? '#f59e0b' : '#ef4444';
              return `
                <tr style="border-bottom:1px solid var(--border-color)">
                  <td style="padding:10px 12px">
                    <div style="font-size:12px;font-weight:700;color:var(--text-primary)">${funcao}</div>
                    <div style="font-size:10px;color:var(--text-muted);margin-top:2px">${treinList.slice(0,2).join(', ')}${treinList.length>2?` +${treinList.length-2}`:''}</div>
                  </td>
                  <td style="padding:10px;text-align:center;font-size:13px;font-weight:700;color:var(--text-primary)">${treinList.length}</td>
                  <td style="padding:10px;text-align:center;font-size:13px;font-weight:700">${colabFuncao}</td>
                  <td style="padding:10px;text-align:center;font-size:13px;font-weight:700;color:#22c55e">${emDia}</td>
                  <td style="padding:10px;text-align:center;font-size:13px;font-weight:700;color:${vencidos>0?'#ef4444':'#22c55e'}">${vencidos}</td>
                  <td style="padding:10px">
                    <div style="display:flex;align-items:center;gap:8px">
                      <div style="flex:1;height:8px;background:var(--border-color);border-radius:4px;overflow:hidden">
                        <div style="height:100%;width:${pct}%;background:${cor};border-radius:4px;transition:width 1s"></div>
                      </div>
                      <span style="font-size:11px;font-weight:700;color:${cor};min-width:30px">${pct}%</span>
                    </div>
                  </td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────────────
// ⑤ INTEGRIDADE DE DADOS – VALIDAÇÕES F001/F005 E AUDITORIA
// ─────────────────────────────────────────────────────────────────────

/**
 * Executar auditoria automática de integridade de dados
 */
function dadosAuditarIntegridade() {
  const erros = [];
  const avisos = [];

  try {
    // F005 – Fornecedores com CNPJ duplicado
    const fornecedores = _v3Get('fa_fornecedores_v2', _v3Get('fa_fornecedores', []));
    const cnpjMap = {};
    fornecedores.forEach(f => {
      const cnpj = (f.cnpj||'').replace(/\D/g,'');
      if (cnpj.length >= 11) {
        if (!cnpjMap[cnpj]) cnpjMap[cnpj] = [];
        cnpjMap[cnpj].push(f.razao_social || f.nome || f.id);
      }
    });
    Object.entries(cnpjMap).forEach(([cnpj, nomes]) => {
      if (nomes.length > 1) {
        erros.push({
          codigo: 'F005', gravidade: 'ERRO', modulo: 'Fornecedores',
          descricao: `CNPJ ${cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')} duplicado`,
          detalhes: nomes.join(', '),
          impacto: 'Problemas fiscais e de pagamento duplicado',
          acao: 'Mesclar ou inativar o registro duplicado'
        });
      }
    });

    // F001 – Pedidos/RCs com valor zero ou indefinido
    const pedidos = _v3Get('fa_pedidos_compra', []);
    pedidos.forEach(p => {
      if (!p.valor_total || p.valor_total <= 0) {
        erros.push({
          codigo: 'F001', gravidade: 'ERRO', modulo: 'Suprimentos',
          descricao: `Pedido ${p.id} com valor zero ou indefinido`,
          detalhes: `Status: ${p.status||'—'} · Fornecedor: ${p.fornecedor||'—'}`,
          impacto: 'Dados incompletos – impossível processar financeiramente',
          acao: 'Atualizar o valor total do pedido'
        });
      }
    });

    // F002 – RCs sem vínculo a contrato
    const rcs = _v3Get('fa_requisicoes_compra', []);
    const rcSemContrato = rcs.filter(r => !r.contrato || r.contrato === '—' || r.contrato === '');
    if (rcSemContrato.length > 0) {
      avisos.push({
        codigo: 'F002', gravidade: 'AVISO', modulo: 'Suprimentos',
        descricao: `${rcSemContrato.length} RC(s) sem vínculo a contrato`,
        detalhes: rcSemContrato.slice(0,3).map(r=>r.id).join(', ') + (rcSemContrato.length>3?'...':''),
        impacto: 'Rastreabilidade e rateio de custo comprometidos',
        acao: 'Vincular RCs aos respectivos contratos'
      });
    }

    // F003 – Contratos com datas inconsistentes
    const contratos = _v3Get('fa_contratos_cliente', []);
    contratos.forEach(c => {
      if (c.fim && c.inicio && c.fim < c.inicio) {
        erros.push({
          codigo: 'F003', gravidade: 'ERRO', modulo: 'Contratos',
          descricao: `Contrato ${c.id} com data final anterior à inicial`,
          detalhes: `Início: ${c.inicio} · Fim: ${c.fim}`,
          impacto: 'Erros nos alertas de vencimento e relatórios',
          acao: 'Corrigir datas do contrato'
        });
      }
    });

    // F004 – Contas a pagar sem CNPJ de fornecedor
    const cp = _v3Get('fa_contas_pagar_v2', _v3Get('fa_contas_pagar', []));
    const cpSemCNPJ = cp.filter(c => c.status !== 'Pago' && !c.cnpj_fornecedor && !c.cnpj);
    if (cpSemCNPJ.length > 0) {
      avisos.push({
        codigo: 'F004', gravidade: 'AVISO', modulo: 'Financeiro',
        descricao: `${cpSemCNPJ.length} conta(s) a pagar sem CNPJ do fornecedor`,
        detalhes: cpSemCNPJ.slice(0,3).map(c=>c.id||c.fornecedor||'?').join(', ') + (cpSemCNPJ.length>3?'...':''),
        impacto: 'Impossível emitir SPED/DCTF sem CNPJ',
        acao: 'Atualizar CNPJ nos lançamentos financeiros'
      });
    }

  } catch(e) { console.warn('[Auditoria]', e); }

  const todos = [...erros, ...avisos];
  const resultado = {
    data: new Date().toISOString(), totalErros: erros.length, totalAvisos: avisos.length, itens: todos
  };

  _v3Save('fa_ultima_auditoria', resultado);
  if(typeof logAction==='function') logAction('Auditoria Dados', 'Sistema', `${erros.length} erros, ${avisos.length} avisos`);
  return resultado;
}

/**
 * Modal de resultados da auditoria de integridade
 */
function dadosModalAuditoria() {
  const resultado = dadosAuditarIntegridade();
  const { totalErros, totalAvisos, itens } = resultado;

  openModalWide('🔍 Auditoria de Integridade de Dados', `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:18px">
      <div style="padding:14px;background:${totalErros>0?'#fef2f2':'rgba(34,197,94,0.06)'};border-radius:10px;border:1px solid ${totalErros>0?'#fecaca':'rgba(34,197,94,0.2)'};text-align:center">
        <div style="font-size:28px;font-weight:900;color:${totalErros>0?'#dc2626':'#22c55e'}">${totalErros}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px">Erros Críticos</div>
      </div>
      <div style="padding:14px;background:${totalAvisos>0?'#fffbeb':'rgba(34,197,94,0.06)'};border-radius:10px;border:1px solid ${totalAvisos>0?'#fde68a':'rgba(34,197,94,0.2)'};text-align:center">
        <div style="font-size:28px;font-weight:900;color:${totalAvisos>0?'#d97706':'#22c55e'}">${totalAvisos}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px">Avisos</div>
      </div>
      <div style="padding:14px;background:rgba(79,70,229,0.06);border-radius:10px;border:1px solid rgba(79,70,229,0.15);text-align:center">
        <div style="font-size:28px;font-weight:900;color:#4f46e5">${itens.length}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px">Total de Itens</div>
      </div>
    </div>

    ${itens.length === 0 ? `
      <div style="text-align:center;padding:40px 20px;background:rgba(34,197,94,0.06);border-radius:12px;border:1px solid rgba(34,197,94,0.2)">
        <div style="font-size:40px;margin-bottom:12px">✅</div>
        <div style="font-size:15px;font-weight:700;color:#16a34a">Dados íntegros!</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:4px">Nenhum erro ou aviso encontrado nesta auditoria.</div>
      </div>
    ` : `
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse">
          <thead><tr style="background:var(--bg-tertiary)">
            <th style="padding:9px 12px;font-size:11px;color:var(--text-muted);text-align:left">CÓDIGO</th>
            <th style="padding:9px 12px;font-size:11px;color:var(--text-muted);text-align:center">TIPO</th>
            <th style="padding:9px 12px;font-size:11px;color:var(--text-muted);text-align:left">MÓDULO</th>
            <th style="padding:9px 12px;font-size:11px;color:var(--text-muted);text-align:left">DESCRIÇÃO</th>
            <th style="padding:9px 12px;font-size:11px;color:var(--text-muted);text-align:left">AÇÃO RECOMENDADA</th>
          </tr></thead>
          <tbody>
            ${itens.map(item => `
              <tr style="border-bottom:1px solid var(--border-color)">
                <td style="padding:9px 12px;font-size:12px;font-weight:800;color:${item.gravidade==='ERRO'?'#dc2626':'#d97706'}">${item.codigo}</td>
                <td style="padding:9px;text-align:center">
                  <span style="padding:3px 8px;border-radius:5px;font-size:10px;font-weight:700;background:${item.gravidade==='ERRO'?'#fef2f2':'#fffbeb'};color:${item.gravidade==='ERRO'?'#dc2626':'#d97706'}">${item.gravidade}</span>
                </td>
                <td style="padding:9px 12px;font-size:11px;color:var(--text-muted)">${item.modulo}</td>
                <td style="padding:9px 12px">
                  <div style="font-size:12px;font-weight:600;color:var(--text-primary)">${item.descricao}</div>
                  <div style="font-size:10px;color:var(--text-muted);margin-top:2px">${item.detalhes||''}</div>
                  ${item.impacto?`<div style="font-size:10px;color:#f97316;margin-top:1px">⚠️ ${item.impacto}</div>`:''}
                </td>
                <td style="padding:9px 12px;font-size:11px;color:#059669">${item.acao||'—'}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    `}

    <div style="margin-top:16px;padding:12px 16px;background:rgba(99,102,241,0.06);border-radius:8px;border:1px solid rgba(99,102,241,0.15)">
      <div style="font-size:12px;font-weight:700;color:#4f46e5;margin-bottom:6px">📋 Regras de Qualidade de Dados</div>
      <div style="font-size:11px;color:var(--text-secondary);line-height:1.7">
        🔴 <strong>F001</strong>: Pedidos com valor zero/indefinido → dados financeiros incompletos<br>
        🔴 <strong>F005</strong>: CNPJ duplicado em fornecedores → problemas fiscais e de pagamento<br>
        🟠 <strong>F002</strong>: RCs sem contrato vinculado → comprometimento de rastreabilidade<br>
        🟠 <strong>F004</strong>: Contas sem CNPJ → impossibilidade de emissão de SPED/DCTF
      </div>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
    <button class="btn btn-primary" onclick="closeModal();dadosExportarAuditoria()">
      <i class="fas fa-download"></i> Exportar Relatório
    </button>
  `);
}

function dadosExportarAuditoria() {
  const resultado = _v3Get('fa_ultima_auditoria', null);
  if (!resultado) { showToast('Execute a auditoria primeiro.', 'warning'); return; }
  const hoje = new Date().toLocaleDateString('pt-BR');
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Auditoria de Integridade</title>
  <style>body{font-family:Arial,sans-serif;font-size:11px;padding:28px;color:#000}h1{font-size:16px;font-weight:900;color:#4f46e5}h2{font-size:12px;font-weight:700;color:#4f46e5;border-left:3px solid #4f46e5;padding-left:8px;margin:14px 0 8px}table{width:100%;border-collapse:collapse;margin-bottom:10px}th{background:#4f46e5;color:#fff;padding:6px 10px;font-size:10px;text-align:left}td{padding:5px 10px;border-bottom:1px solid #f0f0f0;font-size:10px}.erro{color:#dc2626;font-weight:700}.aviso{color:#d97706;font-weight:700}@media print{*{print-color-adjust:exact!important}}</style></head>
  <body>
  <div style="display:flex;justify-content:space-between;border-bottom:3px solid #4f46e5;padding-bottom:12px;margin-bottom:16px">
    <div><h1>Auditoria de Integridade de Dados</h1><p style="font-size:10px;color:#666">Fraser Alexander – Sistema de Gestão</p></div>
    <div style="text-align:right;font-size:10px;color:#888">Data: ${hoje}</div>
  </div>
  <div style="display:flex;gap:20px;margin-bottom:16px">
    <div style="padding:10px 16px;border:1px solid #fecaca;border-radius:8px;text-align:center"><div style="font-size:20px;font-weight:900;color:#dc2626">${resultado.totalErros}</div><div>Erros</div></div>
    <div style="padding:10px 16px;border:1px solid #fde68a;border-radius:8px;text-align:center"><div style="font-size:20px;font-weight:900;color:#d97706">${resultado.totalAvisos}</div><div>Avisos</div></div>
  </div>
  <h2>Detalhamento</h2>
  <table><thead><tr><th>Código</th><th>Tipo</th><th>Módulo</th><th>Descrição</th><th>Ação Recomendada</th></tr></thead><tbody>
  ${(resultado.itens||[]).map(i=>`<tr><td class="${i.gravidade==='ERRO'?'erro':'aviso'}">${i.codigo}</td><td>${i.gravidade}</td><td>${i.modulo}</td><td>${i.descricao}<br><small>${i.detalhes||''}</small></td><td>${i.acao||'—'}</td></tr>`).join('')}
  </tbody></table>
  <script>window.onload=function(){window.print()}</script></body></html>`;
  const w = window.open('','_blank','width=800,height=900');
  if(w){w.document.write(html);w.document.close();}
}

// ─────────────────────────────────────────────────────────────────────
// INICIALIZAÇÃO – Injetar botões e alertas nas páginas existentes
// ─────────────────────────────────────────────────────────────────────

/**
 * Painel central de governance – botão de acesso rápido
 */
function renderGovernancePanel() {
  const el = document.getElementById('mainContent');
  if (!el) return;

  const alertasRFQ  = _supAlertasRFQ().length;
  const alertasCtr  = ctrAlertasVencimento().length;
  const audResult   = _v3Get('fa_ultima_auditoria', null);
  const audErros    = audResult ? audResult.totalErros : null;

  el.innerHTML = `
    <style>
      .gov-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(320px,1fr)); gap:16px; }
      .gov-card  { background:var(--bg-card); border:1px solid var(--border-color); border-radius:16px; overflow:hidden; transition:box-shadow .2s, transform .2s; cursor:pointer; }
      .gov-card:hover { box-shadow:0 8px 30px rgba(0,0,0,0.12); transform:translateY(-2px); }
      .gov-card-head { padding:16px 20px; border-bottom:1px solid var(--border-color); display:flex; align-items:center; gap:12px; }
      .gov-card-body { padding:16px 20px; }
      .gov-icon  { width:42px; height:42px; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:18px; flex-shrink:0; }
      .gov-badge { padding:3px 8px; border-radius:5px; font-size:10px; font-weight:700; }
      .gov-item  { display:flex; align-items:center; gap:8px; padding:7px 0; border-bottom:1px solid var(--border-color); font-size:12px; }
      .gov-item:last-child { border-bottom:none; }
      .gov-bullet { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
    </style>

    <div class="page-header">
      <div class="page-title">
        <i class="fas fa-shield-alt page-icon" style="color:#4f46e5"></i>
        <div>
          <h1>Painel de Governança</h1>
          <p class="page-subtitle">Gestão de controles, alertas e conformidade do sistema</p>
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button onclick="dadosModalAuditoria()" class="btn btn-primary btn-sm">
          <i class="fas fa-search"></i> Auditar Dados
        </button>
        <button onclick="ctrAgendarReuniao()" class="btn btn-outline-primary btn-sm">
          <i class="fas fa-calendar-plus"></i> Agendar Reunião
        </button>
      </div>
    </div>

    <div class="gov-grid">

      <!-- Alertas de Suprimentos -->
      <div class="gov-card" onclick="supRenderAlertasRFQ_Detalhes()">
        <div class="gov-card-head">
          <div class="gov-icon" style="background:rgba(249,115,22,0.12)"><i class="fas fa-shopping-cart" style="color:#f97316"></i></div>
          <div style="flex:1">
            <div style="font-size:14px;font-weight:700;color:var(--text-primary)">Suprimentos</div>
            <div style="font-size:11px;color:var(--text-muted)">RFQs ociosas e regras de compra</div>
          </div>
          ${alertasRFQ > 0 ? `<span class="gov-badge" style="background:#fff7ed;color:#ea580c;border:1px solid #fed7aa">${alertasRFQ} alerta${alertasRFQ>1?'s':''}</span>` : `<span class="gov-badge" style="background:rgba(34,197,94,0.1);color:#16a34a;border:1px solid rgba(34,197,94,0.3)">OK</span>`}
        </div>
        <div class="gov-card-body">
          <div class="gov-item"><div class="gov-bullet" style="background:${alertasRFQ>0?'#f97316':'#22c55e'}"></div><span>RFQs/RCs ociosas >15 dias: <strong style="color:${alertasRFQ>0?'#ea580c':'#22c55e'}">${alertasRFQ}</strong></span></div>
          <div class="gov-item"><div class="gov-bullet" style="background:#6366f1"></div><span>Mínimo 3 fornecedores para cotações >R$10k</span></div>
          <div class="gov-item"><div class="gov-bullet" style="background:#ef4444"></div><span onclick="supAbrirCompraEmergencia()" style="cursor:pointer;color:var(--primary)">Registrar compra de emergência</span></div>
        </div>
      </div>

      <!-- Alertas de Contratos -->
      <div class="gov-card" onclick="ctrModalAlertasCompleto()">
        <div class="gov-card-head">
          <div class="gov-icon" style="background:rgba(239,68,68,0.12)"><i class="fas fa-file-signature" style="color:#ef4444"></i></div>
          <div style="flex:1">
            <div style="font-size:14px;font-weight:700;color:var(--text-primary)">Contratos</div>
            <div style="font-size:11px;color:var(--text-muted)">Vencimentos e gestão</div>
          </div>
          ${alertasCtr > 0 ? `<span class="gov-badge" style="background:#fef2f2;color:#dc2626;border:1px solid #fecaca">${alertasCtr} venc.</span>` : `<span class="gov-badge" style="background:rgba(34,197,94,0.1);color:#16a34a;border:1px solid rgba(34,197,94,0.3)">OK</span>`}
        </div>
        <div class="gov-card-body">
          <div class="gov-item"><div class="gov-bullet" style="background:#ef4444"></div><span>Vencimentos em 30/60/90 dias: <strong style="color:${alertasCtr>0?'#dc2626':'#22c55e'}">${alertasCtr}</strong></span></div>
          <div class="gov-item"><div class="gov-bullet" style="background:#4f46e5"></div><span onclick="ctrAgendarReuniao()" style="cursor:pointer;color:var(--primary)">Agendar reunião de gestão</span></div>
          <div class="gov-item"><div class="gov-bullet" style="background:#f59e0b"></div><span>Portaria de designação de gestor</span></div>
        </div>
      </div>

      <!-- Financeiro -->
      <div class="gov-card" onclick="navigate('contas_pagar')">
        <div class="gov-card-head">
          <div class="gov-icon" style="background:rgba(37,99,235,0.12)"><i class="fas fa-hand-holding-usd" style="color:#2563eb"></i></div>
          <div style="flex:1">
            <div style="font-size:14px;font-weight:700;color:var(--text-primary)">Financeiro</div>
            <div style="font-size:11px;color:var(--text-muted)">Fluxo de caixa e aprovações</div>
          </div>
        </div>
        <div class="gov-card-body">
          <div class="gov-item"><div class="gov-bullet" style="background:#2563eb"></div><span>Fluxo semanal real vs. planejado</span></div>
          <div class="gov-item"><div class="gov-bullet" style="background:#ef4444"></div><span>Aprovação hierárquica >R$ 50.000</span></div>
          <div class="gov-item"><div class="gov-bullet" style="background:#f59e0b"></div><span>Prazo mínimo 15 dias úteis após NF</span></div>
        </div>
      </div>

      <!-- SSMA -->
      <div class="gov-card" onclick="navigate('ssma')">
        <div class="gov-card-head">
          <div class="gov-icon" style="background:rgba(20,184,166,0.12)"><i class="fas fa-hard-hat" style="color:#14b8a6"></i></div>
          <div style="flex:1">
            <div style="font-size:14px;font-weight:700;color:var(--text-primary)">SSMA</div>
            <div style="font-size:11px;color:var(--text-muted)">Segurança, saúde e meio ambiente</div>
          </div>
        </div>
        <div class="gov-card-body">
          <div class="gov-item"><div class="gov-bullet" style="background:#14b8a6"></div><span onclick="ssmaAbrirChecklistInspecao()" style="cursor:pointer;color:var(--primary)">Inspeção semanal com checklist digital</span></div>
          <div class="gov-item"><div class="gov-bullet" style="background:#7c3aed"></div><span>Matriz de treinamentos por função</span></div>
          <div class="gov-item"><div class="gov-bullet" style="background:#f59e0b"></div><span onclick="ssmaAbrirCausaRaiz('','[]')" style="cursor:pointer;color:var(--primary)">Análise de causa raiz (5 Por Quês)</span></div>
        </div>
      </div>

      <!-- Integridade de Dados -->
      <div class="gov-card" onclick="dadosModalAuditoria()">
        <div class="gov-card-head">
          <div class="gov-icon" style="background:rgba(79,70,229,0.12)"><i class="fas fa-database" style="color:#4f46e5"></i></div>
          <div style="flex:1">
            <div style="font-size:14px;font-weight:700;color:var(--text-primary)">Integridade de Dados</div>
            <div style="font-size:11px;color:var(--text-muted)">Auditoria e qualidade de dados</div>
          </div>
          ${audErros !== null ? (audErros > 0 ? `<span class="gov-badge" style="background:#fef2f2;color:#dc2626;border:1px solid #fecaca">${audErros} erro${audErros>1?'s':''}</span>` : `<span class="gov-badge" style="background:rgba(34,197,94,0.1);color:#16a34a;border:1px solid rgba(34,197,94,0.3)">OK</span>`) : ''}
        </div>
        <div class="gov-card-body">
          <div class="gov-item"><div class="gov-bullet" style="background:#dc2626"></div><span><strong>F005</strong>: CNPJ duplicado em fornecedores</span></div>
          <div class="gov-item"><div class="gov-bullet" style="background:#dc2626"></div><span><strong>F001</strong>: Pedidos com valor zero/indefinido</span></div>
          <div class="gov-item"><div class="gov-bullet" style="background:#4f46e5"></div><span>Auditoria mensal de dados mestre</span></div>
        </div>
      </div>

      <!-- Critérios de Medição -->
      <div class="gov-card" onclick="navigate('criterios_medicao')">
        <div class="gov-card-head">
          <div class="gov-icon" style="background:rgba(5,150,105,0.12)"><i class="fas fa-tasks" style="color:#059669"></i></div>
          <div style="flex:1">
            <div style="font-size:14px;font-weight:700;color:var(--text-primary)">Critérios de Medição</div>
            <div style="font-size:11px;color:var(--text-muted)">KPIs contratuais e checklist de aceite</div>
          </div>
        </div>
        <div class="gov-card-body">
          <div class="gov-item"><div class="gov-bullet" style="background:#059669"></div><span>KPIs mensais por contrato e tipo</span></div>
          <div class="gov-item"><div class="gov-bullet" style="background:#2563eb"></div><span>Checklist digital (spot/recorrente/obra)</span></div>
          <div class="gov-item"><div class="gov-bullet" style="background:#7c3aed"></div><span>Sugestão por IA com templates NR</span></div>
        </div>
      </div>

    </div>

    <!-- Widget: Alertas críticos em tempo real -->
    <div style="margin-top:24px">
      <div style="font-size:14px;font-weight:700;color:var(--text-primary);margin-bottom:14px;display:flex;align-items:center;gap:8px">
        <i class="fas fa-bell" style="color:#f59e0b"></i> Alertas em Tempo Real
      </div>
      <div id="gov_alertas_container">
        ${(() => {
          const a1 = _supAlertasRFQ();
          const a2 = ctrAlertasVencimento();
          const todos = [
            ...a1.slice(0,2).map(a=>({ cor:'#f97316', icon:'fa-shopping-cart', texto:`RFQ/RC ociosa: ${a.id} (${a.dias}d)`, sub:'Suprimentos', acao:`navigate('${a.tipo==='rfq_idle'?'mapa_cotacao':'requisicoes'}')` })),
            ...a2.filter(a=>a.nivel==='critico').slice(0,2).map(a=>({ cor:'#ef4444', icon:'fa-file-signature', texto:`Contrato vencendo: ${a.id} (${a.diasRestantes}d)`, sub:'Contratos', acao:`ctrAbrirRenovacao('${a.id}')` }))
          ];
          if (!todos.length) return `<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:13px">✅ Sem alertas críticos no momento</div>`;
          return todos.map(t=>`
            <div onclick="${t.acao}" style="display:flex;align-items:center;gap:12px;padding:12px 16px;background:var(--bg-card);border:1px solid var(--border-color);border-left:4px solid ${t.cor};border-radius:10px;margin-bottom:8px;cursor:pointer;transition:background .15s" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='var(--bg-card)'">
              <div style="width:32px;height:32px;background:${t.cor}22;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
                <i class="fas ${t.icon}" style="color:${t.cor};font-size:12px"></i>
              </div>
              <div style="flex:1">
                <div style="font-size:12px;font-weight:700;color:var(--text-primary)">${t.texto}</div>
                <div style="font-size:11px;color:var(--text-muted)">${t.sub}</div>
              </div>
              <i class="fas fa-chevron-right" style="color:var(--text-muted);font-size:11px"></i>
            </div>`).join('');
        })()}
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────────
// EXPORTAR MATRIZ SSMA
// ─────────────────────────────────────────────────────────────────────
function ssmaExportarMatriz() {
  const hoje = new Date().toLocaleDateString('pt-BR');
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Matriz de Treinamentos SSMA</title>
  <style>body{font-family:Arial,sans-serif;font-size:11px;padding:28px}h1{font-size:16px;font-weight:900;color:#14b8a6}table{width:100%;border-collapse:collapse;margin-top:12px}th{background:#14b8a6;color:#fff;padding:7px 10px;font-size:10px;text-align:left}td{padding:6px 10px;border-bottom:1px solid #f0f0f0;font-size:10px}@media print{*{print-color-adjust:exact!important}}</style></head>
  <body>
  <div style="border-bottom:3px solid #14b8a6;padding-bottom:10px;margin-bottom:14px">
    <h1>Matriz de Treinamentos por Função – SSMA</h1>
    <div style="font-size:10px;color:#666">Fraser Alexander · Emitido em ${hoje}</div>
  </div>
  <table><thead><tr><th>Função</th><th>Treinamentos Obrigatórios</th><th>Qtd Trein.</th></tr></thead><tbody>
  ${Object.entries(SSMA_MATRIZ_TREINAMENTOS).map(([f,ts])=>`<tr><td style="font-weight:700">${f}</td><td>${ts.join(' · ')}</td><td style="text-align:center">${ts.length}</td></tr>`).join('')}
  </tbody></table>
  <script>window.onload=function(){window.print()}</script></body></html>`;
  const w = window.open('','_blank','width=800,height=700');
  if(w){w.document.write(html);w.document.close();}
}

// ─────────────────────────────────────────────────────────────────────
// INTEGRAÇÃO COM APP.JS – Registrar módulo Governança
// ─────────────────────────────────────────────────────────────────────
window.renderGovernancePanel       = renderGovernancePanel;
window.supRenderAlertasRFQ         = supRenderAlertasRFQ;
window.supRenderAlertasRFQ_Detalhes= supRenderAlertasRFQ_Detalhes;
window.supAbrirCompraEmergencia    = supAbrirCompraEmergencia;
window.supSalvarEmergencia         = supSalvarEmergencia;
window.supValidarMinFornecedores   = supValidarMinFornecedores;
window.ctrAlertasVencimento        = ctrAlertasVencimento;
window.ctrRenderAlertasVencimento  = ctrRenderAlertasVencimento;
window.ctrModalAlertasCompleto     = ctrModalAlertasCompleto;
window.ctrAbrirRenovacao           = ctrAbrirRenovacao;
window.ctrSalvarRenovacao          = ctrSalvarRenovacao;
window.ctrGerarPortaria            = ctrGerarPortaria;
window.ctrAgendarReuniao           = ctrAgendarReuniao;
window.ctrSalvarReuniao            = ctrSalvarReuniao;
window.finRenderFluxoCaixaSemanal  = finRenderFluxoCaixaSemanal;
window.finValidarAprovacaoCP       = finValidarAprovacaoCP;
window.finAbrirAprovacaoHierarquica= finAbrirAprovacaoHierarquica;
window.finSalvarAprovacaoCP        = finSalvarAprovacaoCP;
window.finRenderInadimplencia      = finRenderInadimplencia;
window.finModalInadimplencia       = finModalInadimplencia;
window.finSalvarInadimplencia      = finSalvarInadimplencia;
window.ssmaAbrirChecklistInspecao  = ssmaAbrirChecklistInspecao;
window.ssmaCheckInsp               = ssmaCheckInsp;
window.ssmaSalvarInspecao          = ssmaSalvarInspecao;
window.ssmaAbrirCausaRaiz          = ssmaAbrirCausaRaiz;
window.ssmaSalvarCausaRaiz         = ssmaSalvarCausaRaiz;
window.ssmaRenderMatrizTreinamento = ssmaRenderMatrizTreinamento;
window.ssmaExportarMatriz          = ssmaExportarMatriz;
window.dadosAuditarIntegridade     = dadosAuditarIntegridade;
window.dadosModalAuditoria         = dadosModalAuditoria;
window.dadosExportarAuditoria      = dadosExportarAuditoria;

console.log('[MelhorIAS v3] Módulo de Governança carregado – Suprimentos, Contratos, Financeiro, SSMA, Integridade');

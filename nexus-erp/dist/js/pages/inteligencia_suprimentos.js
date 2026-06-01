// ═══════════════════════════════════════════════════════════════════════════
// ERP Serviços e Operações — Inteligência Estratégica de Suprimentos
// Módulos: Matriz Kraljic, BATNA, Análise SWOT, TCO (Total Cost of Ownership)
// Estratégias Make-or-Buy, Scorecard de Fornecedores, Alertas IA
// Versão: 1.0 | Fase 1
// ═══════════════════════════════════════════════════════════════════════════

'use strict';

/* ── Storage ─────────────────────────────────────────────────────────────── */
function _isGet(k, d)  { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }
function _isSave(k, v) { localStorage.setItem(k, JSON.stringify(v)); }
function _getKraljicItems() { return _isGet('erp_kraljic_items', []); }
function _saveKraljicItems(d){ _isSave('erp_kraljic_items', d); }
function _getBATNAs()        { return _isGet('erp_batna_list', []); }
function _saveBATNAs(d)      { _isSave('erp_batna_list', d); }
function _getSWOTs()         { return _isGet('erp_swot_list', []); }
function _saveSWOTs(d)       { _isSave('erp_swot_list', d); }
function _getTCOs()          { return _isGet('erp_tco_list', []); }
function _saveTCOs(d)        { _isSave('erp_tco_list', d); }
function _getFornecedores()  { return JSON.parse(localStorage.getItem('fa_fornecedores') || '[]'); }
function _getContratos()     { return JSON.parse(localStorage.getItem('fa_contratos_fornecedor') || '[]').concat(JSON.parse(localStorage.getItem('fa_contratos') || '[]')); }
function _getMateriais()     { return JSON.parse(localStorage.getItem('fa_materiais') || '[]'); }

/* ── Formatters ──────────────────────────────────────────────────────────── */
function _isFmtBRL(v) { return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0); }
function _isFmtDate(d){ if(!d) return '—'; try { return new Date(d+'T12:00:00').toLocaleDateString('pt-BR'); } catch { return d; } }

/* ── Gerar ID ─────────────────────────────────────────────────────────────── */
function _isGerarId(pref, lista) {
  const ano = new Date().getFullYear();
  const seq = String(lista.filter(x=>(x.id||'').startsWith(`${pref}-${ano}`)).length+1).padStart(3,'0');
  return `${pref}-${ano}-${seq}`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   RENDER PRINCIPAL
   ═══════════════════════════════════════════════════════════════════════════ */
function renderInteligenciaSuprimentos() {
  const main = document.getElementById('mainContent');
  if (!main) return;

  const kraljic = _getKraljicItems();
  const batna   = _getBATNAs();
  const swot    = _getSWOTs();
  const tco     = _getTCOs();

  main.innerHTML = `
    <div style="padding:20px 24px;max-width:1400px">
      <!-- Header -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px">
        <div>
          <h1 style="font-size:22px;font-weight:700;color:var(--text-primary);margin:0">
            <i class="fas fa-chess" style="color:var(--fa-teal);margin-right:10px"></i>
            Inteligência Estratégica de Suprimentos
          </h1>
          <div style="font-size:12px;color:var(--text-muted);margin-top:4px">
            Matriz Kraljic · BATNA · SWOT · TCO · Make-or-Buy
            <span style="margin-left:8px;padding:2px 8px;border-radius:4px;background:rgba(139,92,246,0.12);color:#8b5cf6;font-weight:600;font-size:11px">
              <i class="fas fa-robot" style="margin-right:3px"></i>IA Copiloto
            </span>
          </div>
        </div>
      </div>

      <!-- KPIs -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:20px">
        <div class="ss-card" style="padding:14px;text-align:center;cursor:pointer" onclick="isAbrirAba('kraljic')">
          <div style="font-size:28px;font-weight:800;color:var(--fa-teal)">${kraljic.length}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:3px">Itens na Matriz Kraljic</div>
          <div style="font-size:10px;color:var(--fa-teal);margin-top:2px">Ver →</div>
        </div>
        <div class="ss-card" style="padding:14px;text-align:center;cursor:pointer" onclick="isAbrirAba('batna')">
          <div style="font-size:28px;font-weight:800;color:#f59e0b">${batna.length}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:3px">Análises BATNA</div>
          <div style="font-size:10px;color:#f59e0b;margin-top:2px">Ver →</div>
        </div>
        <div class="ss-card" style="padding:14px;text-align:center;cursor:pointer" onclick="isAbrirAba('swot')">
          <div style="font-size:28px;font-weight:800;color:#6366f1">${swot.length}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:3px">Análises SWOT</div>
          <div style="font-size:10px;color:#6366f1;margin-top:2px">Ver →</div>
        </div>
        <div class="ss-card" style="padding:14px;text-align:center;cursor:pointer" onclick="isAbrirAba('tco')">
          <div style="font-size:28px;font-weight:800;color:#10b981">${tco.length}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:3px">Análises TCO</div>
          <div style="font-size:10px;color:#10b981;margin-top:2px">Ver →</div>
        </div>
        <div class="ss-card" style="padding:14px;text-align:center;background:linear-gradient(135deg,rgba(139,92,246,0.08),rgba(99,102,241,0.06));border-color:rgba(139,92,246,0.3)">
          <div style="font-size:24px;color:#8b5cf6"><i class="fas fa-robot"></i></div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:3px">IA Copiloto Ativo</div>
          <div style="font-size:10px;color:#8b5cf6;margin-top:2px">Sugestão · Não decide</div>
        </div>
      </div>

      <!-- Abas -->
      <div style="display:flex;gap:2px;flex-wrap:wrap;border-bottom:2px solid var(--border-color);margin-bottom:20px" id="is-tabs">
        ${[
          {k:'kraljic', label:'Matriz Kraljic', icon:'fa-th-large', cor:'var(--fa-teal)'},
          {k:'batna',   label:'BATNA',          icon:'fa-balance-scale', cor:'#f59e0b'},
          {k:'swot',    label:'SWOT',            icon:'fa-chess-board',   cor:'#6366f1'},
          {k:'tco',     label:'TCO',             icon:'fa-calculator',    cor:'#10b981'},
          {k:'mob',     label:'Make-or-Buy',     icon:'fa-code-branch',   cor:'#ec4899'},
        ].map((t,i)=>`
          <button onclick="isAbrirAba('${t.k}')" data-is-tab="${t.k}"
            style="padding:8px 14px;font-size:12px;font-weight:600;border:none;background:none;cursor:pointer;
            border-bottom:3px solid ${i===0?t.cor:'transparent'};
            color:${i===0?t.cor:'var(--text-muted)'};border-radius:4px 4px 0 0;transition:.15s">
            <i class="fas ${t.icon}" style="margin-right:4px"></i>${t.label}
          </button>`).join('')}
      </div>

      <!-- Conteúdo das abas -->
      <div id="is-conteudo">
        ${_isRenderKraljic(kraljic)}
      </div>
    </div>`;
}

/* ── Mudar aba ────────────────────────────────────────────────────────────── */
const _IS_ABA_CORES = {
  kraljic:'var(--fa-teal)', batna:'#f59e0b', swot:'#6366f1', tco:'#10b981', mob:'#ec4899'
};

function isAbrirAba(aba) {
  document.querySelectorAll('[data-is-tab]').forEach(b => {
    const isActive = b.dataset.isTab === aba;
    const cor = _IS_ABA_CORES[b.dataset.isTab] || 'var(--fa-teal)';
    b.style.borderBottomColor = isActive ? cor : 'transparent';
    b.style.color = isActive ? cor : 'var(--text-muted)';
  });
  const cont = document.getElementById('is-conteudo');
  if (!cont) return;
  switch(aba) {
    case 'kraljic': cont.innerHTML = _isRenderKraljic(_getKraljicItems());     break;
    case 'batna':   cont.innerHTML = _isRenderBATNA(_getBATNAs());               break;
    case 'swot':    cont.innerHTML = _isRenderSWOT(_getSWOTs());                 break;
    case 'tco':     cont.innerHTML = _isRenderTCO(_getTCOs());                   break;
    case 'mob':     cont.innerHTML = _isRenderMakeOrBuy();                       break;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   MATRIZ KRALJIC
   ═══════════════════════════════════════════════════════════════════════════ */
const _KRALJIC_QUADRANTES = {
  estrategico: { label:'Estratégico',      cor:'#ef4444', desc:'Alto impacto, alto risco — parceria de longo prazo' },
  alavanca:    { label:'Alavanca',          cor:'#f59e0b', desc:'Alto impacto, baixo risco — explorar poder de compra' },
  gargalo:     { label:'Gargalo',           cor:'#8b5cf6', desc:'Baixo impacto, alto risco — garantir fornecimento' },
  nao_critico: { label:'Não Crítico',       cor:'#6b7280', desc:'Baixo impacto, baixo risco — simplificar processo' },
};

function _isRenderKraljic(items) {
  const estrategico = items.filter(i=>i.quadrante==='estrategico');
  const alavanca    = items.filter(i=>i.quadrante==='alavanca');
  const gargalo     = items.filter(i=>i.quadrante==='gargalo');
  const nao_critico = items.filter(i=>i.quadrante==='nao_critico');

  return `
    <div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px">
        <div>
          <div style="font-size:15px;font-weight:700;color:var(--text-primary)">Matriz de Kraljic</div>
          <div style="font-size:12px;color:var(--text-muted)">Classifique os materiais/serviços por impacto no negócio e risco de fornecimento</div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="isAbrirNovoKraljic()">
          <i class="fas fa-plus"></i> Classificar Item
        </button>
      </div>

      <!-- Matriz visual 2x2 -->
      <div style="display:grid;grid-template-columns:1fr 1fr;grid-template-rows:auto auto;gap:2px;margin-bottom:20px;background:var(--border-color);border-radius:10px;overflow:hidden">
        <!-- Linha de eixos -->
        <div style="grid-column:1/-1;text-align:center;font-size:11px;color:var(--text-muted);padding:6px;background:var(--bg-card2)">
          ← Baixo Risco de Fornecimento ————————————— Alto Risco de Fornecimento →
        </div>

        ${[
          {q:'alavanca',    top:true, left:true,  estilo:'border-top:3px solid #f59e0b'},
          {q:'estrategico', top:true, left:false, estilo:'border-top:3px solid #ef4444'},
          {q:'nao_critico', top:false,left:true,  estilo:'border-bottom:3px solid #6b7280'},
          {q:'gargalo',     top:false,left:false, estilo:'border-bottom:3px solid #8b5cf6'},
        ].map(cell => {
          const qd   = _KRALJIC_QUADRANTES[cell.q];
          const list = items.filter(i=>i.quadrante===cell.q);
          return `
            <div style="background:var(--bg-card2);padding:14px;min-height:120px;${cell.estilo}">
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
                <span style="width:10px;height:10px;border-radius:50%;background:${qd.cor};display:inline-block"></span>
                <span style="font-size:12px;font-weight:700;color:${qd.cor}">${qd.label}</span>
                <span style="font-size:10px;background:${qd.cor}18;color:${qd.cor};border-radius:3px;padding:1px 6px">${list.length}</span>
              </div>
              <div style="font-size:10px;color:var(--text-muted);margin-bottom:8px">${qd.desc}</div>
              ${list.slice(0,3).map(item=>`
                <div style="background:${qd.cor}10;border:1px solid ${qd.cor}30;border-radius:5px;padding:5px 8px;margin-bottom:4px;cursor:pointer" onclick="isVerKraljic('${item.id}')">
                  <div style="font-size:11px;font-weight:600;color:var(--text-primary)">${(item.descricao||'—').substring(0,35)}</div>
                  <div style="font-size:10px;color:var(--text-muted)">${item.fornecedor||'—'} · ${_isFmtBRL(item.valor_anual)}/ano</div>
                </div>`).join('')}
              ${list.length>3?`<div style="font-size:10px;color:${qd.cor};cursor:pointer" onclick="isAbrirNovoKraljic()">+${list.length-3} mais...</div>`:''}
            </div>`;
        }).join('')}
      </div>

      <!-- Tabela -->
      ${items.length ? `
      <div class="ss-card" style="padding:0;overflow:hidden">
        <div style="overflow-x:auto">
          <table class="ss-table">
            <thead><tr>
              <th>Item / Material</th><th>Fornecedor</th><th>Quadrante</th>
              <th>Impacto</th><th>Risco</th><th>Valor Anual</th><th>Estratégia</th><th>Ações</th>
            </tr></thead>
            <tbody>
              ${items.map(item => {
                const qd = _KRALJIC_QUADRANTES[item.quadrante]||{label:'—',cor:'#6b7280'};
                return `<tr>
                  <td style="font-size:12px;font-weight:600">${item.descricao||'—'}</td>
                  <td style="font-size:12px">${item.fornecedor||'—'}</td>
                  <td><span style="padding:3px 8px;border-radius:4px;font-size:10px;font-weight:700;background:${qd.cor}18;color:${qd.cor}">${qd.label}</span></td>
                  <td><div style="display:flex;align-items:center;gap:5px"><div style="width:${(item.impacto||5)*8}px;height:6px;background:${qd.cor};border-radius:3px"></div><span style="font-size:11px">${item.impacto||'—'}/10</span></div></td>
                  <td><div style="display:flex;align-items:center;gap:5px"><div style="width:${(item.risco||5)*8}px;height:6px;background:#ef4444;border-radius:3px"></div><span style="font-size:11px">${item.risco||'—'}/10</span></div></td>
                  <td style="font-size:12px;font-weight:600">${_isFmtBRL(item.valor_anual)}</td>
                  <td style="font-size:11px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${item.estrategia||''}">${(item.estrategia||'—').substring(0,30)}</td>
                  <td>
                    <div style="display:flex;gap:4px">
                      <button class="btn btn-secondary btn-sm btn-icon" onclick="isVerKraljic('${item.id}')" title="Ver"><i class="fas fa-eye"></i></button>
                      <button class="btn btn-secondary btn-sm btn-icon" onclick="isAbrirNovoKraljic('${item.id}')" title="Editar"><i class="fas fa-edit"></i></button>
                    </div>
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>` : `
      <div style="text-align:center;padding:40px;color:var(--text-muted)">
        <i class="fas fa-th-large" style="font-size:32px;display:block;margin-bottom:10px;color:var(--fa-teal)"></i>
        <div style="font-weight:600;margin-bottom:6px">Nenhum item classificado</div>
        <button class="btn btn-primary btn-sm" onclick="isAbrirNovoKraljic()"><i class="fas fa-plus"></i> Classificar Primeiro Item</button>
      </div>`}
    </div>`;
}

function isAbrirNovoKraljic(existingId) {
  const existing = existingId ? _getKraljicItems().find(x=>x.id===existingId) : null;
  const novoId   = existing?.id || _isGerarId('KRJ', _getKraljicItems());
  const forn     = _getFornecedores();

  openModalWide(`${existing?'Editar':'Nova'} Classificação Kraljic — ${novoId}`, `
    <div style="max-height:80vh;overflow-y:auto">
      <div style="background:linear-gradient(135deg,rgba(0,180,184,0.06),rgba(99,102,241,0.04));border:1px solid rgba(0,180,184,0.2);border-radius:8px;padding:12px 14px;margin-bottom:16px;font-size:12px">
        <i class="fas fa-info-circle" style="color:var(--fa-teal);margin-right:5px"></i>
        Classifique cada material/serviço avaliando <strong>Impacto no Negócio</strong> (lucratividade, valor estratégico) 
        e <strong>Risco de Fornecimento</strong> (concentração, alternativas, prazo). A IA sugere o quadrante com base nas notas.
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
        <div><label style="font-size:11px;color:var(--text-muted)">Descrição do Item/Serviço *</label>
          <input class="form-control" id="krj_descricao" value="${existing?.descricao||''}" placeholder="Ex: Tubulação PEAD DN500, Serviço de Dragagem..."></div>
        <div><label style="font-size:11px;color:var(--text-muted)">Categoria</label>
          <select class="form-control" id="krj_categoria">
            ${['Material','Serviço','Equipamento','Mão de Obra','Software/Licença'].map(c=>`<option ${(existing?.categoria||'Material')===c?'selected':''}>${c}</option>`).join('')}
          </select></div>
        <div><label style="font-size:11px;color:var(--text-muted)">Fornecedor Principal</label>
          <input class="form-control" id="krj_fornecedor" value="${existing?.fornecedor||''}" list="krj_forn_list" placeholder="Nome do fornecedor">
          <datalist id="krj_forn_list">${forn.map(f=>`<option value="${f.nome||f.razao_social||''}">`).join('')}</datalist></div>
        <div><label style="font-size:11px;color:var(--text-muted)">Valor Anual (R$)</label>
          <input class="form-control" id="krj_valor_anual" type="number" min="0" step="100" value="${existing?.valor_anual||0}"></div>
        <div><label style="font-size:11px;color:var(--text-muted)">Nº de Fornecedores Alternativos</label>
          <input class="form-control" id="krj_n_forn" type="number" min="0" value="${existing?.n_fornecedores||1}"></div>
        <div><label style="font-size:11px;color:var(--text-muted)">Lead Time (dias)</label>
          <input class="form-control" id="krj_lead_time" type="number" min="0" value="${existing?.lead_time||30}"></div>
      </div>

      <!-- Sliders de score -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
        <div>
          <label style="font-size:11px;color:var(--text-muted);font-weight:700">Impacto no Negócio: <span id="krj_impacto_val" style="color:var(--fa-teal)">${existing?.impacto||5}</span>/10</label>
          <input type="range" min="1" max="10" value="${existing?.impacto||5}" id="krj_impacto" 
            style="width:100%;margin-top:6px" oninput="document.getElementById('krj_impacto_val').textContent=this.value;isSugerirQuadranteLive()">
          <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text-muted)">
            <span>Baixo impacto</span><span>Alto impacto</span>
          </div>
        </div>
        <div>
          <label style="font-size:11px;color:var(--text-muted);font-weight:700">Risco de Fornecimento: <span id="krj_risco_val" style="color:#ef4444">${existing?.risco||5}</span>/10</label>
          <input type="range" min="1" max="10" value="${existing?.risco||5}" id="krj_risco" 
            style="width:100%;margin-top:6px" oninput="document.getElementById('krj_risco_val').textContent=this.value;isSugerirQuadranteLive()">
          <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text-muted)">
            <span>Baixo risco</span><span>Alto risco</span>
          </div>
        </div>
      </div>

      <!-- Sugestão IA de quadrante -->
      <div id="krj_ia_sugestao" style="margin-bottom:12px;padding:10px 14px;background:rgba(139,92,246,0.08);border:1px solid rgba(139,92,246,0.25);border-radius:8px;font-size:12px">
        <i class="fas fa-robot" style="color:#8b5cf6;margin-right:5px"></i>
        <strong style="color:#8b5cf6">IA Copiloto:</strong> Ajuste as notas para ver a sugestão de quadrante.
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
        <div><label style="font-size:11px;color:var(--text-muted)">Quadrante (validação humana)</label>
          <select class="form-control" id="krj_quadrante">
            ${Object.entries(_KRALJIC_QUADRANTES).map(([k,v])=>`<option value="${k}" ${(existing?.quadrante||'nao_critico')===k?'selected':''}>${v.label}</option>`).join('')}
          </select></div>
        <div><label style="font-size:11px;color:var(--text-muted)">Estratégia Sugerida</label>
          <input class="form-control" id="krj_estrategia" value="${existing?.estrategia||''}" placeholder="Ex: Contrato de longo prazo, multi-sourcing..."></div>
      </div>
      <div><label style="font-size:11px;color:var(--text-muted)">Observações / Justificativa</label>
        <textarea class="form-control" id="krj_obs" rows="3" placeholder="Contexto, riscos específicos, histórico de fornecimento...">${existing?.observacoes||''}</textarea></div>
    </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
     <button class="btn btn-primary" onclick="isSalvarKraljic('${novoId}','${existingId||''}')">
       <i class="fas fa-save"></i> Salvar Classificação
     </button>`
  );

  setTimeout(() => isSugerirQuadranteLive(), 200);
}

function isSugerirQuadranteLive() {
  const impacto = parseInt(document.getElementById('krj_impacto')?.value)||5;
  const risco   = parseInt(document.getElementById('krj_risco')?.value)||5;
  const el      = document.getElementById('krj_ia_sugestao');
  const selEl   = document.getElementById('krj_quadrante');
  const estEl   = document.getElementById('krj_estrategia');

  let q, estrategia, explicacao;
  if (impacto >= 6 && risco >= 6) {
    q = 'estrategico'; estrategia = 'Parceria estratégica de longo prazo, SLA robusto, plano de contingência';
    explicacao = 'Alto impacto + Alto risco: priorize relacionamento de parceria, evite dependência única.';
  } else if (impacto >= 6 && risco < 6) {
    q = 'alavanca'; estrategia = 'Explorar poder de compra, concorrência entre fornecedores, contratos spot';
    explicacao = 'Alto impacto + Baixo risco: maximize valor via competição. Implemente múltiplas cotações.';
  } else if (impacto < 6 && risco >= 6) {
    q = 'gargalo'; estrategia = 'Estoque de segurança, desenvolver fornecedores alternativos';
    explicacao = 'Baixo impacto + Alto risco: risco de desabastecimento. Mantenha estoque estratégico.';
  } else {
    q = 'nao_critico'; estrategia = 'Simplificar processo de compra, catálogos digitais, e-procurement';
    explicacao = 'Baixo impacto + Baixo risco: otimize processos, reduza custo administrativo.';
  }

  const qd = _KRALJIC_QUADRANTES[q];
  if (el) el.innerHTML = `
    <i class="fas fa-robot" style="color:#8b5cf6;margin-right:5px"></i>
    <strong style="color:#8b5cf6">IA Copiloto sugere:</strong>
    <span style="padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;background:${qd.cor}18;color:${qd.cor};margin:0 6px">${qd.label}</span>
    ${explicacao}
    <div style="font-size:10px;color:var(--text-muted);margin-top:4px">
      <i class="fas fa-exclamation-triangle" style="color:#d97706;margin-right:3px"></i>
      Sugestão — decisão final deve ser validada pela equipe de suprimentos.
    </div>`;

  if (selEl && !selEl.dataset.userModified) selEl.value = q;
  if (estEl && !estEl.dataset.userModified) estEl.value = estrategia;
}

function isSalvarKraljic(novoId, existingId) {
  const descricao = document.getElementById('krj_descricao')?.value?.trim()||'';
  if (!descricao) { showToast('Informe a descrição do item.','error'); return; }

  const item = {
    id:           novoId,
    descricao,
    categoria:    document.getElementById('krj_categoria')?.value||'Material',
    fornecedor:   document.getElementById('krj_fornecedor')?.value?.trim()||'',
    valor_anual:  parseFloat(document.getElementById('krj_valor_anual')?.value)||0,
    n_fornecedores: parseInt(document.getElementById('krj_n_forn')?.value)||1,
    lead_time:    parseInt(document.getElementById('krj_lead_time')?.value)||30,
    impacto:      parseInt(document.getElementById('krj_impacto')?.value)||5,
    risco:        parseInt(document.getElementById('krj_risco')?.value)||5,
    quadrante:    document.getElementById('krj_quadrante')?.value||'nao_critico',
    estrategia:   document.getElementById('krj_estrategia')?.value?.trim()||'',
    observacoes:  document.getElementById('krj_obs')?.value?.trim()||'',
    criado_por:   currentUser?.name||'',
    atualizado_em: new Date().toISOString(),
  };

  let lista = _getKraljicItems();
  if (existingId) {
    const idx = lista.findIndex(x=>x.id===existingId);
    if (idx>=0) lista[idx]=item; else lista.unshift(item);
  } else lista.unshift(item);
  _saveKraljicItems(lista);

  closeModal();
  showToast('✅ Item classificado na Matriz Kraljic!','success');
  isAbrirAba('kraljic');
}

function isVerKraljic(id) {
  const item = _getKraljicItems().find(x=>x.id===id);
  if (!item) return;
  const qd = _KRALJIC_QUADRANTES[item.quadrante]||{label:'—',cor:'#6b7280'};
  openModal(`Kraljic — ${item.descricao}`, `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:12px">
      <div><span style="color:var(--text-muted);font-size:10px">Quadrante</span><div style="margin-top:3px"><span style="padding:3px 10px;border-radius:5px;font-weight:700;background:${qd.cor}18;color:${qd.cor}">${qd.label}</span></div></div>
      <div><span style="color:var(--text-muted);font-size:10px">Categoria</span><div style="font-weight:600;margin-top:3px">${item.categoria||'—'}</div></div>
      <div><span style="color:var(--text-muted);font-size:10px">Fornecedor</span><div style="font-weight:600;margin-top:3px;color:var(--fa-teal)">${item.fornecedor||'—'}</div></div>
      <div><span style="color:var(--text-muted);font-size:10px">Valor Anual</span><div style="font-weight:700;color:#16a34a;margin-top:3px">${_isFmtBRL(item.valor_anual)}</div></div>
      <div><span style="color:var(--text-muted);font-size:10px">Impacto / Risco</span><div style="font-weight:600;margin-top:3px">${item.impacto}/10 — ${item.risco}/10</div></div>
      <div><span style="color:var(--text-muted);font-size:10px">N° Forn. Alt.</span><div style="font-weight:600;margin-top:3px">${item.n_fornecedores}</div></div>
    </div>
    ${item.estrategia?`<div style="margin-top:10px;background:rgba(0,180,184,0.07);border-radius:8px;padding:10px"><div style="font-size:10px;color:var(--text-muted)">Estratégia</div><div style="font-size:12px;line-height:1.6">${item.estrategia}</div></div>`:''}
    ${item.observacoes?`<div style="margin-top:8px;background:var(--bg-card2);border-radius:8px;padding:10px"><div style="font-size:10px;color:var(--text-muted)">Observações</div><div style="font-size:12px">${item.observacoes}</div></div>`:''}`,
    `<button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
     <button class="btn btn-primary" onclick="closeModal();isAbrirNovoKraljic('${item.id}')"><i class="fas fa-edit"></i> Editar</button>`
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   BATNA
   ═══════════════════════════════════════════════════════════════════════════ */
function _isRenderBATNA(lista) {
  return `
    <div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px">
        <div>
          <div style="font-size:15px;font-weight:700;color:var(--text-primary)">BATNA — Melhor Alternativa à Negociação</div>
          <div style="font-size:12px;color:var(--text-muted)">Best Alternative To a Negotiated Agreement — defina e documente suas alternativas de negociação</div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="isAbrirNovoBATNA()"><i class="fas fa-plus"></i> Nova Análise BATNA</button>
      </div>

      ${lista.length === 0 ? `
      <div style="text-align:center;padding:50px;color:var(--text-muted)">
        <i class="fas fa-balance-scale" style="font-size:32px;display:block;margin-bottom:10px;color:#f59e0b"></i>
        <div style="font-weight:600;margin-bottom:6px">Nenhuma análise BATNA registrada</div>
        <button class="btn btn-primary btn-sm" onclick="isAbrirNovoBATNA()"><i class="fas fa-plus"></i> Criar Primeira Análise</button>
      </div>` : `
      <div style="display:grid;gap:14px">
        ${lista.map(b => `
          <div class="ss-card" style="padding:16px;cursor:pointer" onclick="isVerBATNA('${b.id}')">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:8px">
              <div>
                <div style="font-size:14px;font-weight:700;color:var(--text-primary)">${b.objeto||'—'}</div>
                <div style="font-size:12px;color:var(--fa-teal);margin-top:2px">${b.fornecedor||'Fornecedor a definir'}</div>
              </div>
              <div style="text-align:right">
                <div style="font-size:18px;font-weight:800;color:#f59e0b">${_isFmtBRL(b.valor_batna)}</div>
                <div style="font-size:10px;color:var(--text-muted)">Valor BATNA</div>
              </div>
            </div>
            <div style="margin-top:10px;display:grid;grid-template-columns:repeat(3,1fr);gap:8px;font-size:11px">
              <div style="background:rgba(245,158,11,0.08);padding:8px;border-radius:6px;text-align:center">
                <div style="font-weight:700;color:#d97706">${_isFmtBRL(b.valor_negociar)}</div>
                <div style="color:var(--text-muted)">Valor Negociação</div>
              </div>
              <div style="background:rgba(34,197,94,0.08);padding:8px;border-radius:6px;text-align:center">
                <div style="font-weight:700;color:#16a34a">${_isFmtBRL(b.zona_acordo)}</div>
                <div style="color:var(--text-muted)">Zona de Acordo (ZOPA)</div>
              </div>
              <div style="background:var(--bg-card2);padding:8px;border-radius:6px;text-align:center">
                <div style="font-weight:700">${(b.alternativas||[]).length}</div>
                <div style="color:var(--text-muted)">Alternativas</div>
              </div>
            </div>
          </div>`).join('')}
      </div>`}
    </div>`;
}

function isAbrirNovoBATNA(existingId) {
  const existing = existingId ? _getBATNAs().find(x=>x.id===existingId) : null;
  const novoId   = existing?.id || _isGerarId('BTN', _getBATNAs());
  const altsSeed = existing?.alternativas || [{ descricao:'', valor:0, viabilidade:'Média' }];

  openModalWide(`${existing?'Editar':'Nova'} Análise BATNA — ${novoId}`, `
    <div style="max-height:80vh;overflow-y:auto">
      <div style="background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.25);border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:12px">
        <i class="fas fa-info-circle" style="color:#f59e0b;margin-right:5px"></i>
        BATNA é sua melhor opção caso a negociação atual falhe. Defina suas alternativas antes de negociar — 
        quem tem melhor BATNA tem mais poder de negociação.
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
        <div style="grid-column:1/-1"><label style="font-size:11px;color:var(--text-muted)">Objeto da Negociação *</label>
          <input class="form-control" id="btn_objeto" value="${existing?.objeto||''}" placeholder="Material, serviço ou contrato em negociação"></div>
        <div><label style="font-size:11px;color:var(--text-muted)">Fornecedor / Parte</label>
          <input class="form-control" id="btn_fornecedor" value="${existing?.fornecedor||''}" placeholder="Nome do fornecedor ou contraparte"></div>
        <div><label style="font-size:11px;color:var(--text-muted)">Data da Negociação</label>
          <input class="form-control" id="btn_data" type="date" value="${existing?.data||new Date().toISOString().split('T')[0]}"></div>
        <div><label style="font-size:11px;color:var(--text-muted)">Valor em Negociação (R$)</label>
          <input class="form-control" id="btn_valor_negociar" type="number" min="0" step="0.01" value="${existing?.valor_negociar||0}" oninput="isBATNACalcZOPA()"></div>
        <div><label style="font-size:11px;color:var(--text-muted)">Valor BATNA — Sua Melhor Alternativa (R$)</label>
          <input class="form-control" id="btn_valor_batna" type="number" min="0" step="0.01" value="${existing?.valor_batna||0}" oninput="isBATNACalcZOPA()"></div>
      </div>

      <!-- ZOPA automático -->
      <div id="btn_zopa_info" style="margin-bottom:14px;padding:10px 14px;background:rgba(34,197,94,0.07);border:1px solid rgba(34,197,94,0.25);border-radius:8px;font-size:12px">
        <i class="fas fa-compress-arrows-alt" style="color:#16a34a;margin-right:5px"></i>
        ZOPA calculada automaticamente
      </div>

      <!-- Alternativas -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div style="font-size:13px;font-weight:700">Alternativas Mapeadas</div>
        <button onclick="isBATNAAddAlt()" class="btn btn-primary btn-sm"><i class="fas fa-plus"></i> Adicionar</button>
      </div>
      <div id="btn_alts_lista">
        ${altsSeed.map((a,i)=>_isRenderBATNAAlt(a,i)).join('')}
      </div>

      <div style="margin-top:12px"><label style="font-size:11px;color:var(--text-muted)">Estratégia de Negociação</label>
        <textarea class="form-control" id="btn_estrategia" rows="3" 
          placeholder="Descreva sua estratégia, pontos de ancoragem, concessões planejadas...">${existing?.estrategia||''}</textarea></div>
    </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
     <button class="btn btn-primary" onclick="isSalvarBATNA('${novoId}','${existingId||''}')"><i class="fas fa-save"></i> Salvar BATNA</button>`
  );

  setTimeout(() => isBATNACalcZOPA(), 200);
}

function _isRenderBATNAAlt(a, idx) {
  return `
    <div class="btn-alt-row" style="display:grid;grid-template-columns:2fr 1fr 1fr auto;gap:8px;align-items:end;margin-bottom:8px;background:var(--bg-card2);padding:10px;border-radius:8px;border:1px solid var(--border-color)">
      <div><label style="font-size:10px;color:var(--text-muted)">Descrição da Alternativa</label>
        <input class="form-control btn-alt-desc" value="${a.descricao||''}" style="font-size:12px" placeholder="Fornecedor B, importação, fabricação interna..."></div>
      <div><label style="font-size:10px;color:var(--text-muted)">Valor Estimado (R$)</label>
        <input class="form-control btn-alt-valor" type="number" min="0" step="0.01" value="${a.valor||0}" style="font-size:12px" oninput="isBATNACalcZOPA()"></div>
      <div><label style="font-size:10px;color:var(--text-muted)">Viabilidade</label>
        <select class="form-control btn-alt-viab" style="font-size:12px">
          ${['Alta','Média','Baixa'].map(v=>`<option ${(a.viabilidade||'Média')===v?'selected':''}>${v}</option>`).join('')}
        </select></div>
      <div style="padding-top:18px">
        <button onclick="this.closest('.btn-alt-row').remove();isBATNACalcZOPA()" class="btn btn-danger btn-sm btn-icon"><i class="fas fa-times"></i></button>
      </div>
    </div>`;
}

function isBATNAAddAlt() {
  const lista = document.getElementById('btn_alts_lista');
  if (!lista) return;
  const div = document.createElement('div');
  div.innerHTML = _isRenderBATNAAlt({}, lista.querySelectorAll('.btn-alt-row').length);
  lista.appendChild(div.firstElementChild);
}

function isBATNACalcZOPA() {
  const valNeg  = parseFloat(document.getElementById('btn_valor_negociar')?.value)||0;
  const valBATNA= parseFloat(document.getElementById('btn_valor_batna')?.value)||0;
  const alts    = Array.from(document.querySelectorAll('.btn-alt-valor')).map(i=>parseFloat(i.value)||0);
  const melhorAlt = alts.length ? Math.min(...alts) : valBATNA;
  const zopa    = Math.abs(valNeg - valBATNA);
  const el      = document.getElementById('btn_zopa_info');
  const zopaEl  = document.getElementById('btn_zona_acordo') || { value: 0 };

  if (el) {
    const favoravel = valBATNA < valNeg;
    el.innerHTML = `
      <i class="fas fa-compress-arrows-alt" style="color:#16a34a;margin-right:5px"></i>
      <strong>ZOPA (Zona de Possível Acordo):</strong> ${_isFmtBRL(zopa)} 
      <span style="margin-left:8px;padding:2px 8px;border-radius:4px;font-size:11px;background:${favoravel?'rgba(34,197,94,0.12)':'rgba(239,68,68,0.12)'};color:${favoravel?'#16a34a':'#dc2626'}">
        ${favoravel?'Posição favorável — BATNA melhor que proposta':'Posição de risco — proposta melhor que BATNA'}
      </span>
      <div style="font-size:10px;color:var(--text-muted);margin-top:4px">
        <i class="fas fa-robot" style="color:#8b5cf6;margin-right:3px"></i>IA Copiloto: 
        ${favoravel ? 'Você tem poder de negociação. Ancore abaixo do valor BATNA e conceda gradualmente.' 
                    : 'Cuidado: aceitar piora a situação atual. Considere melhorar o BATNA antes de negociar.'}
      </div>`;
  }
}

function isSalvarBATNA(novoId, existingId) {
  const objeto = document.getElementById('btn_objeto')?.value?.trim()||'';
  if (!objeto) { showToast('Informe o objeto da negociação.','error'); return; }

  const alternativas = [];
  document.querySelectorAll('.btn-alt-row').forEach(row => {
    const desc = row.querySelector('.btn-alt-desc')?.value?.trim()||'';
    if (!desc) return;
    alternativas.push({ descricao:desc, valor:parseFloat(row.querySelector('.btn-alt-valor')?.value)||0, viabilidade:row.querySelector('.btn-alt-viab')?.value||'Média' });
  });

  const valBATNA = parseFloat(document.getElementById('btn_valor_batna')?.value)||0;
  const valNeg   = parseFloat(document.getElementById('btn_valor_negociar')?.value)||0;

  const nova = {
    id:              novoId,
    objeto,
    fornecedor:      document.getElementById('btn_fornecedor')?.value?.trim()||'',
    data:            document.getElementById('btn_data')?.value||'',
    valor_negociar:  valNeg,
    valor_batna:     valBATNA,
    zona_acordo:     Math.abs(valNeg - valBATNA),
    alternativas,
    estrategia:      document.getElementById('btn_estrategia')?.value?.trim()||'',
    criado_por:      currentUser?.name||'',
    atualizado_em:   new Date().toISOString(),
  };

  let lista = _getBATNAs();
  if (existingId) {
    const idx = lista.findIndex(x=>x.id===existingId);
    if (idx>=0) lista[idx]=nova; else lista.unshift(nova);
  } else lista.unshift(nova);
  _saveBATNAs(lista);

  closeModal();
  showToast('✅ Análise BATNA salva!','success');
  isAbrirAba('batna');
}

function isVerBATNA(id) {
  const b = _getBATNAs().find(x=>x.id===id);
  if (!b) return;
  openModal(`BATNA — ${b.objeto}`, `
    <div style="font-size:12px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
        <div><span style="color:var(--text-muted);font-size:10px">Fornecedor</span><div style="font-weight:700">${b.fornecedor||'—'}</div></div>
        <div><span style="color:var(--text-muted);font-size:10px">Data</span><div style="font-weight:700">${_isFmtDate(b.data)}</div></div>
        <div><span style="color:var(--text-muted);font-size:10px">Valor Negociação</span><div style="font-weight:700;color:#d97706">${_isFmtBRL(b.valor_negociar)}</div></div>
        <div><span style="color:var(--text-muted);font-size:10px">Valor BATNA</span><div style="font-weight:700;color:#f59e0b">${_isFmtBRL(b.valor_batna)}</div></div>
        <div><span style="color:var(--text-muted);font-size:10px">ZOPA</span><div style="font-weight:700;color:#16a34a">${_isFmtBRL(b.zona_acordo)}</div></div>
        <div><span style="color:var(--text-muted);font-size:10px">Alternativas</span><div style="font-weight:700">${(b.alternativas||[]).length}</div></div>
      </div>
      ${b.estrategia?`<div style="background:var(--bg-card2);padding:10px;border-radius:8px"><div style="font-size:10px;color:var(--text-muted)">Estratégia</div><div style="line-height:1.6">${b.estrategia}</div></div>`:''}
    </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
     <button class="btn btn-primary" onclick="closeModal();isAbrirNovoBATNA('${b.id}')"><i class="fas fa-edit"></i> Editar</button>`
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SWOT de FORNECEDOR / CONTRATO
   ═══════════════════════════════════════════════════════════════════════════ */
function _isRenderSWOT(lista) {
  return `
    <div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px">
        <div>
          <div style="font-size:15px;font-weight:700;color:var(--text-primary)">Análise SWOT de Fornecedores / Contratos</div>
          <div style="font-size:12px;color:var(--text-muted)">Forças, Fraquezas, Oportunidades e Ameaças</div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="isAbrirNovoSWOT()"><i class="fas fa-plus"></i> Nova Análise SWOT</button>
      </div>

      ${lista.length === 0 ? `
      <div style="text-align:center;padding:50px;color:var(--text-muted)">
        <i class="fas fa-chess-board" style="font-size:32px;display:block;margin-bottom:10px;color:#6366f1"></i>
        <div style="font-weight:600;margin-bottom:6px">Nenhuma análise SWOT cadastrada</div>
        <button class="btn btn-primary btn-sm" onclick="isAbrirNovoSWOT()"><i class="fas fa-plus"></i> Criar Análise</button>
      </div>` : `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px">
        ${lista.map(s => `
          <div class="ss-card" style="padding:0;overflow:hidden;cursor:pointer" onclick="isVerSWOT('${s.id}')">
            <div style="padding:12px 14px;background:var(--bg-card2);border-bottom:1px solid var(--border-color)">
              <div style="font-size:13px;font-weight:700">${s.objeto||'—'}</div>
              <div style="font-size:11px;color:var(--fa-teal)">${s.fornecedor||''}</div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0">
              ${[
                {k:'forcas',       label:'Forças',        cor:'#16a34a', icon:'fa-plus-circle'},
                {k:'fraquezas',    label:'Fraquezas',     cor:'#dc2626', icon:'fa-minus-circle'},
                {k:'oportunidades',label:'Oportunidades', cor:'#0d9488', icon:'fa-arrow-up'},
                {k:'ameacas',      label:'Ameaças',       cor:'#d97706', icon:'fa-exclamation-triangle'},
              ].map((q,qi) => `
                <div style="padding:10px;border-right:${qi%2===0?'1px solid var(--border-color)':'none'};border-bottom:${qi<2?'1px solid var(--border-color)':'none'}">
                  <div style="font-size:10px;font-weight:700;color:${q.cor};margin-bottom:4px">
                    <i class="fas ${q.icon}" style="margin-right:3px"></i>${q.label} (${(s[q.k]||[]).length})
                  </div>
                  ${(s[q.k]||[]).slice(0,2).map(it=>`<div style="font-size:10px;color:var(--text-secondary);padding-left:4px">• ${it.substring(0,30)}</div>`).join('')}
                </div>`).join('')}
            </div>
          </div>`).join('')}
      </div>`}
    </div>`;
}

function isAbrirNovoSWOT(existingId) {
  const existing = existingId ? _getSWOTs().find(x=>x.id===existingId) : null;
  const novoId   = existing?.id || _isGerarId('SWT', _getSWOTs());

  const quads = [
    {k:'forcas',       label:'Forças (Strengths)',        cor:'#16a34a', icon:'fa-plus-circle',          placeholder:'O que o fornecedor/contrato faz bem...'},
    {k:'fraquezas',    label:'Fraquezas (Weaknesses)',    cor:'#dc2626', icon:'fa-minus-circle',          placeholder:'Pontos fracos, limitações...'},
    {k:'oportunidades',label:'Oportunidades',             cor:'#0d9488', icon:'fa-arrow-up',              placeholder:'Oportunidades no mercado, melhorias...'},
    {k:'ameacas',      label:'Ameaças (Threats)',         cor:'#d97706', icon:'fa-exclamation-triangle',  placeholder:'Riscos externos, concorrência...'},
  ];

  openModalWide(`${existing?'Editar':'Nova'} Análise SWOT — ${novoId}`, `
    <div style="max-height:80vh;overflow-y:auto">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
        <div><label style="font-size:11px;color:var(--text-muted)">Objeto da Análise *</label>
          <input class="form-control" id="swt_objeto" value="${existing?.objeto||''}" placeholder="Fornecedor, contrato ou categoria"></div>
        <div><label style="font-size:11px;color:var(--text-muted)">Fornecedor / Empresa</label>
          <input class="form-control" id="swt_fornecedor" value="${existing?.fornecedor||''}" placeholder="Nome do fornecedor"></div>
        <div><label style="font-size:11px;color:var(--text-muted)">Data de Referência</label>
          <input class="form-control" id="swt_data" type="date" value="${existing?.data||new Date().toISOString().split('T')[0]}"></div>
        <div><label style="font-size:11px;color:var(--text-muted)">Responsável</label>
          <input class="form-control" id="swt_responsavel" value="${existing?.responsavel||currentUser?.name||''}"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:2px;background:var(--border-color);border-radius:8px;overflow:hidden;margin-bottom:12px">
        ${quads.map(q => `
          <div style="background:var(--bg-card2);padding:14px">
            <div style="font-size:12px;font-weight:700;color:${q.cor};margin-bottom:8px">
              <i class="fas ${q.icon}" style="margin-right:5px"></i>${q.label}
            </div>
            <div id="swt_${q.k}_lista">
              ${(existing?.[q.k]||['']).map((v,i)=>_isSWOTItemRow(q.k, v, i)).join('')}
            </div>
            <button onclick="isSWOTAddItem('${q.k}')" class="btn btn-secondary btn-sm" style="margin-top:6px;font-size:11px">
              <i class="fas fa-plus"></i> Adicionar
            </button>
          </div>`).join('')}
      </div>

      <!-- IA Copiloto SWOT -->
      <div style="background:rgba(139,92,246,0.07);border:1px solid rgba(139,92,246,0.25);border-radius:8px;padding:12px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <i class="fas fa-robot" style="color:#8b5cf6"></i>
          <span style="font-size:12px;font-weight:700;color:#8b5cf6">IA Copiloto — Sugestões para SWOT</span>
          <button onclick="isSWOTGerarSugestoes()" class="btn btn-secondary btn-sm" style="font-size:11px">
            <i class="fas fa-magic"></i> Gerar Sugestões
          </button>
        </div>
        <div id="swt_ia_resultado" style="font-size:12px;color:var(--text-muted)">Preencha o objeto e clique em "Gerar Sugestões".</div>
      </div>
    </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
     <button class="btn btn-primary" onclick="isSalvarSWOT('${novoId}','${existingId||''}')"><i class="fas fa-save"></i> Salvar SWOT</button>`
  );
}

function _isSWOTItemRow(quadKey, valor, idx) {
  return `<div class="swt-item-row" style="display:flex;gap:5px;align-items:center;margin-bottom:5px">
    <input class="form-control swt-${quadKey}-item" value="${valor||''}" style="font-size:12px" placeholder="Item...">
    <button onclick="this.closest('.swt-item-row').remove()" class="btn btn-danger btn-sm btn-icon" style="flex-shrink:0"><i class="fas fa-times"></i></button>
  </div>`;
}

function isSWOTAddItem(quadKey) {
  const lista = document.getElementById(`swt_${quadKey}_lista`);
  if (!lista) return;
  const div = document.createElement('div');
  div.innerHTML = _isSWOTItemRow(quadKey, '', lista.querySelectorAll(`.swt-${quadKey}-item`).length);
  lista.appendChild(div.firstElementChild);
  lista.lastElementChild?.querySelector('input')?.focus();
}

function isSWOTGerarSugestoes() {
  const objeto = document.getElementById('swt_objeto')?.value?.trim()||'';
  if (!objeto) { showToast('Preencha o objeto da análise primeiro.','error'); return; }

  const el = document.getElementById('swt_ia_resultado');
  if (el) el.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gerando sugestões...';

  setTimeout(() => {
    if (!el) return;
    el.innerHTML = `
      <div style="margin-bottom:8px"><strong style="color:#16a34a">Forças (sugestão):</strong> Capacidade técnica comprovada, histórico de entregas no prazo, certificações relevantes, relacionamento de longo prazo.</div>
      <div style="margin-bottom:8px"><strong style="color:#dc2626">Fraquezas (sugestão):</strong> Concentração geográfica, dependência de subcontratados, ausência de redundância produtiva, SLA não formalizado.</div>
      <div style="margin-bottom:8px"><strong style="color:#0d9488">Oportunidades (sugestão):</strong> Desenvolvimento de novos produtos, parceria para P&D, entrada em novos mercados, otimização logística.</div>
      <div style="margin-bottom:8px"><strong style="color:#d97706">Ameaças (sugestão):</strong> Volatilidade cambial, escassez de matéria-prima, entrada de concorrentes, mudanças regulatórias, risco de falência.</div>
      <div style="font-size:10px;color:var(--text-muted);margin-top:6px">
        <i class="fas fa-exclamation-triangle" style="color:#d97706;margin-right:3px"></i>
        Sugestões genéricas baseadas em padrões de mercado. Revise e personalize conforme o contexto específico.
      </div>`;
  }, 1000);
}

function isSalvarSWOT(novoId, existingId) {
  const objeto = document.getElementById('swt_objeto')?.value?.trim()||'';
  if (!objeto) { showToast('Informe o objeto da análise.','error'); return; }

  const getItems = k => Array.from(document.querySelectorAll(`.swt-${k}-item`)).map(i=>i.value.trim()).filter(Boolean);

  const nova = {
    id:            novoId,
    objeto,
    fornecedor:    document.getElementById('swt_fornecedor')?.value?.trim()||'',
    data:          document.getElementById('swt_data')?.value||'',
    responsavel:   document.getElementById('swt_responsavel')?.value?.trim()||'',
    forcas:        getItems('forcas'),
    fraquezas:     getItems('fraquezas'),
    oportunidades: getItems('oportunidades'),
    ameacas:       getItems('ameacas'),
    criado_por:    currentUser?.name||'',
    atualizado_em: new Date().toISOString(),
  };

  let lista = _getSWOTs();
  if (existingId) { const idx=lista.findIndex(x=>x.id===existingId); if(idx>=0) lista[idx]=nova; else lista.unshift(nova); }
  else lista.unshift(nova);
  _saveSWOTs(lista);
  closeModal();
  showToast('✅ Análise SWOT salva!','success');
  isAbrirAba('swot');
}

function isVerSWOT(id) {
  const s = _getSWOTs().find(x=>x.id===id);
  if (!s) return;
  const quads=[{k:'forcas',l:'Forças',c:'#16a34a'},{k:'fraquezas',l:'Fraquezas',c:'#dc2626'},{k:'oportunidades',l:'Oportunidades',c:'#0d9488'},{k:'ameacas',l:'Ameaças',c:'#d97706'}];
  openModalWide(`SWOT — ${s.objeto}`, `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:2px;background:var(--border-color);border-radius:8px;overflow:hidden">
      ${quads.map(q=>`
        <div style="background:var(--bg-card2);padding:14px">
          <div style="font-size:12px;font-weight:700;color:${q.c};margin-bottom:8px">${q.l} (${(s[q.k]||[]).length})</div>
          ${(s[q.k]||[]).map(it=>`<div style="font-size:12px;padding:4px 8px;background:${q.c}10;border-radius:4px;margin-bottom:4px">• ${it}</div>`).join('')||'<div style="font-size:11px;color:var(--text-muted)">Nenhum item</div>'}
        </div>`).join('')}
    </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
     <button class="btn btn-primary" onclick="closeModal();isAbrirNovoSWOT('${s.id}')"><i class="fas fa-edit"></i> Editar</button>`
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   TCO — Total Cost of Ownership
   ═══════════════════════════════════════════════════════════════════════════ */
function _isRenderTCO(lista) {
  return `
    <div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px">
        <div>
          <div style="font-size:15px;font-weight:700;color:var(--text-primary)">TCO — Custo Total de Propriedade</div>
          <div style="font-size:12px;color:var(--text-muted)">Análise do custo total: aquisição + operação + manutenção + descarte</div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="isAbrirNovoTCO()"><i class="fas fa-plus"></i> Nova Análise TCO</button>
      </div>

      ${lista.length===0 ? `
      <div style="text-align:center;padding:50px;color:var(--text-muted)">
        <i class="fas fa-calculator" style="font-size:32px;display:block;margin-bottom:10px;color:#10b981"></i>
        <div style="font-weight:600;margin-bottom:6px">Nenhuma análise TCO registrada</div>
        <button class="btn btn-primary btn-sm" onclick="isAbrirNovoTCO()"><i class="fas fa-plus"></i> Criar Análise TCO</button>
      </div>` : `
      <div class="ss-card" style="padding:0;overflow:hidden">
        <div style="overflow-x:auto">
          <table class="ss-table">
            <thead><tr>
              <th>Item / Equipamento</th><th>Fornecedor</th>
              <th>Custo Aquisição</th><th>Custo Operação</th><th>Manutenção</th>
              <th>TCO Total</th><th>Vida Útil</th><th>Ações</th>
            </tr></thead>
            <tbody>
              ${lista.map(t => {
                const tco = (Number(t.custo_aquisicao)||0)+(Number(t.custo_operacao)||0)+(Number(t.custo_manutencao)||0)+(Number(t.custo_treinamento)||0)+(Number(t.custo_descarte)||0);
                return `<tr>
                  <td style="font-size:12px;font-weight:600">${t.descricao||'—'}</td>
                  <td style="font-size:12px">${t.fornecedor||'—'}</td>
                  <td style="font-size:12px">${_isFmtBRL(t.custo_aquisicao)}</td>
                  <td style="font-size:12px">${_isFmtBRL(t.custo_operacao)}</td>
                  <td style="font-size:12px">${_isFmtBRL(t.custo_manutencao)}</td>
                  <td style="font-weight:700;color:#10b981">${_isFmtBRL(tco)}</td>
                  <td style="font-size:12px">${t.vida_util||'—'} anos</td>
                  <td>
                    <div style="display:flex;gap:4px">
                      <button class="btn btn-secondary btn-sm btn-icon" onclick="isVerTCO('${t.id}')" title="Ver"><i class="fas fa-eye"></i></button>
                      <button class="btn btn-secondary btn-sm btn-icon" onclick="isAbrirNovoTCO('${t.id}')" title="Editar"><i class="fas fa-edit"></i></button>
                    </div>
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>`}
    </div>`;
}

function isAbrirNovoTCO(existingId) {
  const existing = existingId ? _getTCOs().find(x=>x.id===existingId) : null;
  const novoId   = existing?.id || _isGerarId('TCO', _getTCOs());

  const campos = [
    {id:'custo_aquisicao',  label:'Custo de Aquisição / Compra (R$)',            valor:existing?.custo_aquisicao||0},
    {id:'custo_instalacao', label:'Custo de Instalação / Implantação (R$)',       valor:existing?.custo_instalacao||0},
    {id:'custo_treinamento',label:'Custo de Treinamento (R$)',                    valor:existing?.custo_treinamento||0},
    {id:'custo_operacao',   label:'Custo Anual de Operação (R$)',                 valor:existing?.custo_operacao||0},
    {id:'custo_manutencao', label:'Custo Anual de Manutenção (R$)',               valor:existing?.custo_manutencao||0},
    {id:'custo_downtime',   label:'Custo de Downtime / Parada (R$/ano)',          valor:existing?.custo_downtime||0},
    {id:'custo_descarte',   label:'Custo de Descarte / Desmobilização (R$)',      valor:existing?.custo_descarte||0},
  ];

  openModalWide(`${existing?'Editar':'Nova'} Análise TCO — ${novoId}`, `
    <div style="max-height:80vh;overflow-y:auto">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
        <div><label style="font-size:11px;color:var(--text-muted)">Item / Equipamento / Serviço *</label>
          <input class="form-control" id="tco_descricao" value="${existing?.descricao||''}" placeholder="Ex: Escavadeira PC200, Sistema ERP, Tubulação..."></div>
        <div><label style="font-size:11px;color:var(--text-muted)">Fornecedor / Fabricante</label>
          <input class="form-control" id="tco_fornecedor" value="${existing?.fornecedor||''}" placeholder="Nome do fornecedor"></div>
        <div><label style="font-size:11px;color:var(--text-muted)">Vida Útil (anos)</label>
          <input class="form-control" id="tco_vida_util" type="number" min="1" max="50" value="${existing?.vida_util||5}" oninput="isTCOCalc()"></div>
        <div><label style="font-size:11px;color:var(--text-muted)">Moeda</label>
          <select class="form-control" id="tco_moeda">
            ${['BRL','USD','EUR'].map(m=>`<option ${(existing?.moeda||'BRL')===m?'selected':''}>${m}</option>`).join('')}
          </select></div>
      </div>

      <div style="font-size:13px;font-weight:700;color:var(--text-primary);margin-bottom:10px">Componentes do TCO</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
        ${campos.map(c=>`
          <div>
            <label style="font-size:11px;color:var(--text-muted)">${c.label}</label>
            <input class="form-control tco-valor" id="${c.id}" type="number" min="0" step="0.01" 
              value="${c.valor}" oninput="isTCOCalc()" style="font-size:12px">
          </div>`).join('')}
      </div>

      <!-- Resultado TCO -->
      <div id="tco_resultado" style="background:rgba(16,185,129,0.07);border:2px solid rgba(16,185,129,0.3);border-radius:10px;padding:16px">
        <div style="font-size:13px;font-weight:700;color:#059669;margin-bottom:12px"><i class="fas fa-calculator" style="margin-right:6px"></i>Resultado TCO</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
          <div style="text-align:center">
            <div style="font-size:10px;color:var(--text-muted)">TCO Total</div>
            <div id="tco_total" style="font-size:20px;font-weight:800;color:#059669">R$ 0,00</div>
          </div>
          <div style="text-align:center">
            <div style="font-size:10px;color:var(--text-muted)">Custo Anual Médio</div>
            <div id="tco_anual" style="font-size:20px;font-weight:800;color:#0d9488">R$ 0,00</div>
          </div>
          <div style="text-align:center">
            <div style="font-size:10px;color:var(--text-muted)">% Op. / Manutenção</div>
            <div id="tco_pct_opman" style="font-size:20px;font-weight:800;color:#6366f1">0%</div>
          </div>
        </div>
      </div>

      <div style="margin-top:12px"><label style="font-size:11px;color:var(--text-muted)">Observações / Premissas</label>
        <textarea class="form-control" id="tco_obs" rows="3" 
          placeholder="Premissas consideradas, benchmarks, fontes de dados...">${existing?.observacoes||''}</textarea></div>
    </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
     <button class="btn btn-primary" onclick="isSalvarTCO('${novoId}','${existingId||''}')"><i class="fas fa-save"></i> Salvar TCO</button>`
  );

  setTimeout(() => isTCOCalc(), 200);
}

function isTCOCalc() {
  const aquisicao    = parseFloat(document.getElementById('custo_aquisicao')?.value)||0;
  const instalacao   = parseFloat(document.getElementById('custo_instalacao')?.value)||0;
  const treinamento  = parseFloat(document.getElementById('custo_treinamento')?.value)||0;
  const operacao     = parseFloat(document.getElementById('custo_operacao')?.value)||0;
  const manutencao   = parseFloat(document.getElementById('custo_manutencao')?.value)||0;
  const downtime     = parseFloat(document.getElementById('custo_downtime')?.value)||0;
  const descarte     = parseFloat(document.getElementById('custo_descarte')?.value)||0;
  const vidaUtil     = parseInt(document.getElementById('tco_vida_util')?.value)||5;

  const tcoOneOff    = aquisicao + instalacao + treinamento + descarte;
  const tcoAnualizado= (operacao + manutencao + downtime) * vidaUtil;
  const tcoTotal     = tcoOneOff + tcoAnualizado;
  const custoAnual   = tcoTotal / vidaUtil;
  const opManPct     = tcoTotal > 0 ? Math.round(((operacao + manutencao) * vidaUtil / tcoTotal) * 100) : 0;

  document.getElementById('tco_total').textContent  = _isFmtBRL(tcoTotal);
  document.getElementById('tco_anual').textContent  = _isFmtBRL(custoAnual);
  document.getElementById('tco_pct_opman').textContent = opManPct + '%';
}

function isSalvarTCO(novoId, existingId) {
  const descricao = document.getElementById('tco_descricao')?.value?.trim()||'';
  if (!descricao) { showToast('Informe o item da análise.','error'); return; }

  const aquisicao   = parseFloat(document.getElementById('custo_aquisicao')?.value)||0;
  const instalacao  = parseFloat(document.getElementById('custo_instalacao')?.value)||0;
  const treinamento = parseFloat(document.getElementById('custo_treinamento')?.value)||0;
  const operacao    = parseFloat(document.getElementById('custo_operacao')?.value)||0;
  const manutencao  = parseFloat(document.getElementById('custo_manutencao')?.value)||0;
  const downtime    = parseFloat(document.getElementById('custo_downtime')?.value)||0;
  const descarte    = parseFloat(document.getElementById('custo_descarte')?.value)||0;
  const vidaUtil    = parseInt(document.getElementById('tco_vida_util')?.value)||5;

  const tcoTotal = aquisicao+instalacao+treinamento+descarte+(operacao+manutencao+downtime)*vidaUtil;

  const nova = {
    id:              novoId,
    descricao,
    fornecedor:      document.getElementById('tco_fornecedor')?.value?.trim()||'',
    moeda:           document.getElementById('tco_moeda')?.value||'BRL',
    vida_util:       vidaUtil,
    custo_aquisicao: aquisicao,
    custo_instalacao: instalacao,
    custo_treinamento: treinamento,
    custo_operacao:  operacao,
    custo_manutencao: manutencao,
    custo_downtime:  downtime,
    custo_descarte:  descarte,
    tco_total:       tcoTotal,
    custo_anual:     tcoTotal / vidaUtil,
    observacoes:     document.getElementById('tco_obs')?.value?.trim()||'',
    criado_por:      currentUser?.name||'',
    atualizado_em:   new Date().toISOString(),
  };

  let lista = _getTCOs();
  if (existingId) { const idx=lista.findIndex(x=>x.id===existingId); if(idx>=0) lista[idx]=nova; else lista.unshift(nova); }
  else lista.unshift(nova);
  _saveTCOs(lista);
  closeModal();
  showToast('✅ Análise TCO salva!','success');
  isAbrirAba('tco');
}

function isVerTCO(id) {
  const t = _getTCOs().find(x=>x.id===id);
  if (!t) return;
  openModal(`TCO — ${t.descricao}`, `
    <div style="font-size:12px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
        <div><span style="color:var(--text-muted);font-size:10px">Fornecedor</span><div style="font-weight:700">${t.fornecedor||'—'}</div></div>
        <div><span style="color:var(--text-muted);font-size:10px">Vida Útil</span><div style="font-weight:700">${t.vida_util||'—'} anos</div></div>
        <div><span style="color:var(--text-muted);font-size:10px">Custo Aquisição</span><div style="font-weight:700">${_isFmtBRL(t.custo_aquisicao)}</div></div>
        <div><span style="color:var(--text-muted);font-size:10px">Operação Anual</span><div style="font-weight:700">${_isFmtBRL(t.custo_operacao)}</div></div>
        <div><span style="color:var(--text-muted);font-size:10px">Manutenção Anual</span><div style="font-weight:700">${_isFmtBRL(t.custo_manutencao)}</div></div>
        <div><span style="color:var(--text-muted);font-size:10px">Descarte</span><div style="font-weight:700">${_isFmtBRL(t.custo_descarte)}</div></div>
      </div>
      <div style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.3);border-radius:8px;padding:12px;text-align:center">
        <div style="font-size:10px;color:var(--text-muted)">TCO Total (${t.vida_util} anos)</div>
        <div style="font-size:24px;font-weight:800;color:#059669">${_isFmtBRL(t.tco_total)}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:4px">Custo anual médio: ${_isFmtBRL(t.custo_anual)}</div>
      </div>
    </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
     <button class="btn btn-primary" onclick="closeModal();isAbrirNovoTCO('${t.id}')"><i class="fas fa-edit"></i> Editar</button>`
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAKE-OR-BUY
   ═══════════════════════════════════════════════════════════════════════════ */
function _isRenderMakeOrBuy() {
  const lista = _isGet('erp_mob_list', []);
  return `
    <div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px">
        <div>
          <div style="font-size:15px;font-weight:700;color:var(--text-primary)">Make-or-Buy — Fazer ou Comprar?</div>
          <div style="font-size:12px;color:var(--text-muted)">Decisão estruturada entre produção interna e terceirização</div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="isAbrirNovoMOB()"><i class="fas fa-plus"></i> Nova Análise</button>
      </div>

      ${lista.length===0 ? `
      <div style="text-align:center;padding:50px;color:var(--text-muted)">
        <i class="fas fa-code-branch" style="font-size:32px;display:block;margin-bottom:10px;color:#ec4899"></i>
        <div style="font-weight:600;margin-bottom:6px">Nenhuma análise Make-or-Buy cadastrada</div>
        <button class="btn btn-primary btn-sm" onclick="isAbrirNovoMOB()"><i class="fas fa-plus"></i> Criar Análise</button>
      </div>` : `
      <div class="ss-card" style="padding:0;overflow:hidden">
        <div style="overflow-x:auto">
          <table class="ss-table">
            <thead><tr><th>Objeto</th><th>Custo Fazer</th><th>Custo Comprar</th><th>Decisão IA</th><th>Decisão Final</th><th>Ações</th></tr></thead>
            <tbody>
              ${lista.map(m=>{
                const sug = m.custo_fazer <= m.custo_comprar ? 'Fazer (interno)' : 'Comprar (terceirizar)';
                const cor = m.custo_fazer <= m.custo_comprar ? '#16a34a' : '#6366f1';
                return `<tr>
                  <td style="font-size:12px;font-weight:600">${m.objeto||'—'}</td>
                  <td style="font-size:12px">${_isFmtBRL(m.custo_fazer)}</td>
                  <td style="font-size:12px">${_isFmtBRL(m.custo_comprar)}</td>
                  <td><span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:4px;background:${cor}15;color:${cor}">${sug}</span></td>
                  <td><span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:4px;background:rgba(99,102,241,0.12);color:#6366f1">${m.decisao_final||'Pendente'}</span></td>
                  <td><button class="btn btn-secondary btn-sm btn-icon" onclick="isAbrirNovoMOB('${m.id}')" title="Editar"><i class="fas fa-edit"></i></button></td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>`}
    </div>`;
}

function isAbrirNovoMOB(existingId) {
  const lista    = _isGet('erp_mob_list', []);
  const existing = existingId ? lista.find(x=>x.id===existingId) : null;
  const novoId   = existing?.id || _isGerarId('MOB', lista);

  openModalWide(`${existing?'Editar':'Nova'} Análise Make-or-Buy — ${novoId}`, `
    <div style="max-height:75vh;overflow-y:auto">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
        <div style="grid-column:1/-1"><label style="font-size:11px;color:var(--text-muted)">Objeto da Decisão *</label>
          <input class="form-control" id="mob_objeto" value="${existing?.objeto||''}" placeholder="Material, componente ou serviço a analisar"></div>
        <div><label style="font-size:11px;color:var(--text-muted)">Custo Total Fazer Internamente (R$)</label>
          <input class="form-control" id="mob_custo_fazer" type="number" min="0" step="0.01" value="${existing?.custo_fazer||0}" oninput="isMOBCalc()"></div>
        <div><label style="font-size:11px;color:var(--text-muted)">Custo Total Comprar/Terceirizar (R$)</label>
          <input class="form-control" id="mob_custo_comprar" type="number" min="0" step="0.01" value="${existing?.custo_comprar||0}" oninput="isMOBCalc()"></div>
      </div>
      
      <!-- Fatores qualitativos -->
      <div style="margin-bottom:14px">
        <div style="font-size:13px;font-weight:700;margin-bottom:8px">Fatores Qualitativos</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          ${[
            {id:'mob_core_business', label:'É core business?'},
            {id:'mob_capacidade',    label:'Capacidade interna disponível?'},
            {id:'mob_qualidade',     label:'Qualidade interna ≥ terceiro?'},
            {id:'mob_know_how',      label:'Know-how estratégico?'},
            {id:'mob_risco_forn',    label:'Risco de dependência de fornecedor?'},
            {id:'mob_flexibilidade', label:'Flexibilidade de volume necessária?'},
          ].map(f=>`
            <div><label style="font-size:11px;color:var(--text-muted)">${f.label}</label>
              <select class="form-control mob-qualit" id="${f.id}" style="font-size:12px" onchange="isMOBCalc()">
                <option value="0" ${(existing?.[f.id]||0)===0?'selected':''}>Não / Baixo (0)</option>
                <option value="5" ${(existing?.[f.id]||0)===5?'selected':''}>Parcial / Médio (5)</option>
                <option value="10" ${(existing?.[f.id]||0)===10?'selected':''}>Sim / Alto (10)</option>
              </select></div>`).join('')}
        </div>
      </div>

      <!-- Resultado -->
      <div id="mob_resultado" style="background:rgba(236,72,153,0.06);border:1px solid rgba(236,72,153,0.25);border-radius:10px;padding:14px;margin-bottom:12px">
        <div style="font-size:12px;font-weight:700;color:#ec4899;margin-bottom:8px"><i class="fas fa-robot" style="margin-right:5px"></i>IA Copiloto — Sugestão</div>
        <div id="mob_ia_resultado" style="font-size:12px;color:var(--text-muted)">Preencha os valores para ver a sugestão.</div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div><label style="font-size:11px;color:var(--text-muted)">Decisão Final (validação humana)</label>
          <select class="form-control" id="mob_decisao_final">
            ${['Pendente','Fazer (interno)','Comprar (terceirizar)','Híbrido'].map(d=>`<option ${(existing?.decisao_final||'Pendente')===d?'selected':''}>${d}</option>`).join('')}
          </select></div>
        <div><label style="font-size:11px;color:var(--text-muted)">Responsável pela Decisão</label>
          <input class="form-control" id="mob_responsavel" value="${existing?.responsavel||currentUser?.name||''}"></div>
      </div>
    </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
     <button class="btn btn-primary" onclick="isSalvarMOB('${novoId}','${existingId||''}')"><i class="fas fa-save"></i> Salvar</button>`
  );

  setTimeout(() => isMOBCalc(), 200);
}

function isMOBCalc() {
  const fazer   = parseFloat(document.getElementById('mob_custo_fazer')?.value)||0;
  const comprar = parseFloat(document.getElementById('mob_custo_comprar')?.value)||0;
  const el      = document.getElementById('mob_ia_resultado');
  if (!el) return;

  const qualScore = Array.from(document.querySelectorAll('.mob-qualit')).reduce((s,q)=>s+(parseInt(q.value)||0),0);
  const diff      = Math.abs(fazer - comprar);
  const pct       = comprar > 0 ? Math.round(diff/comprar*100) : 0;

  let sugestao, detalhe;
  const favFazer = fazer <= comprar;

  if (qualScore >= 35) {
    sugestao = 'Fazer (interno)';
    detalhe  = `Fatores estratégicos/qualitativos favorecem produção interna (score qualitativo: ${qualScore}/60). Independentemente do custo, o controle e know-how justificam a decisão.`;
  } else if (favFazer && pct > 15) {
    sugestao = 'Fazer (interno)';
    detalhe  = `Custo interno ${pct}% menor que terceirização. Economicamente favorável, especialmente se houver capacidade disponível.`;
  } else if (!favFazer && pct > 15) {
    sugestao = 'Comprar (terceirizar)';
    detalhe  = `Terceirização ${pct}% mais barata. Com baixo risco estratégico, foque recursos no core business.`;
  } else {
    sugestao = 'Análise aprofundada recomendada';
    detalhe  = `Diferença de custo pequena (${pct}%). Avalie fatores de longo prazo: flexibilidade, desenvolvimento de capacidade, risco de dependência.`;
  }

  el.innerHTML = `
    <strong style="color:#ec4899">Sugestão IA: ${sugestao}</strong><br>
    <span style="color:var(--text-muted)">${detalhe}</span><br>
    <div style="font-size:10px;margin-top:6px;color:var(--text-muted)">
      <i class="fas fa-exclamation-triangle" style="color:#d97706;margin-right:3px"></i>
      Sugestão orientativa. A decisão final deve ser validada pela diretoria considerando fatores estratégicos.
    </div>`;
}

function isSalvarMOB(novoId, existingId) {
  const objeto = document.getElementById('mob_objeto')?.value?.trim()||'';
  if (!objeto) { showToast('Informe o objeto da decisão.','error'); return; }

  const nova = {
    id:             novoId,
    objeto,
    custo_fazer:    parseFloat(document.getElementById('mob_custo_fazer')?.value)||0,
    custo_comprar:  parseFloat(document.getElementById('mob_custo_comprar')?.value)||0,
    mob_core_business: parseInt(document.getElementById('mob_core_business')?.value)||0,
    mob_capacidade:    parseInt(document.getElementById('mob_capacidade')?.value)||0,
    mob_qualidade:     parseInt(document.getElementById('mob_qualidade')?.value)||0,
    mob_know_how:      parseInt(document.getElementById('mob_know_how')?.value)||0,
    mob_risco_forn:    parseInt(document.getElementById('mob_risco_forn')?.value)||0,
    mob_flexibilidade: parseInt(document.getElementById('mob_flexibilidade')?.value)||0,
    decisao_final:  document.getElementById('mob_decisao_final')?.value||'Pendente',
    responsavel:    document.getElementById('mob_responsavel')?.value?.trim()||'',
    criado_por:     currentUser?.name||'',
    atualizado_em:  new Date().toISOString(),
  };

  let lista = _isGet('erp_mob_list', []);
  if (existingId) { const idx=lista.findIndex(x=>x.id===existingId); if(idx>=0) lista[idx]=nova; else lista.unshift(nova); }
  else lista.unshift(nova);
  _isSave('erp_mob_list', lista);
  closeModal();
  showToast('✅ Análise Make-or-Buy salva!','success');
  isAbrirAba('mob');
}

/* ── Exports ─────────────────────────────────────────────────────────────── */
window.renderInteligenciaSuprimentos = renderInteligenciaSuprimentos;
window.isAbrirAba               = isAbrirAba;
window.isAbrirNovoKraljic       = isAbrirNovoKraljic;
window.isSugerirQuadranteLive   = isSugerirQuadranteLive;
window.isSalvarKraljic          = isSalvarKraljic;
window.isVerKraljic             = isVerKraljic;
window.isAbrirNovoBATNA         = isAbrirNovoBATNA;
window.isBATNAAddAlt            = isBATNAAddAlt;
window.isBATNACalcZOPA          = isBATNACalcZOPA;
window.isSalvarBATNA            = isSalvarBATNA;
window.isVerBATNA               = isVerBATNA;
window.isAbrirNovoSWOT          = isAbrirNovoSWOT;
window.isSWOTAddItem            = isSWOTAddItem;
window.isSWOTGerarSugestoes     = isSWOTGerarSugestoes;
window.isSalvarSWOT             = isSalvarSWOT;
window.isVerSWOT                = isVerSWOT;
window.isAbrirNovoTCO           = isAbrirNovoTCO;
window.isTCOCalc                = isTCOCalc;
window.isSalvarTCO              = isSalvarTCO;
window.isVerTCO                 = isVerTCO;
window.isAbrirNovoMOB           = isAbrirNovoMOB;
window.isMOBCalc                = isMOBCalc;
window.isSalvarMOB              = isSalvarMOB;

// =====================================================
// Fraser Alexander ERP – Módulo Avaliação de Fornecedores
//                      + Cadastro em Massa
//                      + Medição PDF com logo
//                      + Gestão Contratos Terceiros
// =====================================================

// ─── AVALIAÇÃO DE FORNECEDORES ───
async function renderAvaliacaoFornecedores() {
  const isGestor = currentUser && ['admin','compras','diretor','operacao'].includes(currentUser.profile || currentUser.role);
  if (!isGestor) {
    document.getElementById('mainContent').innerHTML = `<div class="empty-state"><i class="fas fa-lock"></i><p>Acesso restrito.</p></div>`;
    return;
  }
  // Garante os fornecedores carregados (a página pode ser aberta diretamente).
  if ((typeof FA_FORNECEDORES === 'undefined' || !FA_FORNECEDORES || !FA_FORNECEDORES.length) && typeof loadFornecedores === 'function') {
    document.getElementById('mainContent').innerHTML = `<div class="empty-state"><i class="fas fa-spinner fa-spin" style="color:var(--fa-teal)"></i><p>Carregando...</p></div>`;
    try { await loadFornecedores(); } catch (e) {}
  }

  const avals = _getAvaliacoesForn();
  const fornList = typeof FA_FORNECEDORES !== 'undefined' ? FA_FORNECEDORES : [];
  const mediaGeral = avals.length ? (avals.reduce((a,v) => a + (v.nota_geral||0), 0) / avals.length).toFixed(1) : '—';

  document.getElementById('mainContent').innerHTML = `
    <div class="page-header">
      <div class="page-title">
        <h2><i class="fas fa-star" style="color:var(--orange);margin-right:8px"></i>Avaliação de Fornecedores</h2>
        <p>Registro de desempenho e qualificação dos fornecedores</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary btn-sm" onclick="exportAvaliacoes()"><i class="fas fa-download"></i> Exportar</button>
        <button class="btn btn-secondary btn-sm" onclick="navigate('idf')" style="background:#1e3a5f;color:#fff;border-color:#1e3a5f"><i class="fas fa-chart-bar"></i> Ir para IDF</button>
        <button class="btn btn-primary btn-sm" onclick="openNovaAvaliacao()"><i class="fas fa-plus"></i> Nova Avaliação</button>
      </div>
    </div>

    <!-- KPIs -->
    <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px">
      <div class="kpi-card kpi-blue">
        <div class="kpi-icon"><i class="fas fa-clipboard-check"></i></div>
        <div class="kpi-value">${avals.length}</div>
        <div class="kpi-label">Avaliações Realizadas</div>
      </div>
      <div class="kpi-card kpi-orange">
        <div class="kpi-icon"><i class="fas fa-star"></i></div>
        <div class="kpi-value">${mediaGeral}</div>
        <div class="kpi-label">Nota Média Geral</div>
      </div>
      <div class="kpi-card kpi-green">
        <div class="kpi-icon"><i class="fas fa-thumbs-up"></i></div>
        <div class="kpi-value">${avals.filter(a => (a.nota_geral||0) >= 4).length}</div>
        <div class="kpi-label">Fornecedores Bons (≥4)</div>
      </div>
      <div class="kpi-card kpi-red" style="--kpi-accent:var(--red-light)">
        <div class="kpi-icon"><i class="fas fa-thumbs-down"></i></div>
        <div class="kpi-value">${avals.filter(a => (a.nota_geral||0) < 3).length}</div>
        <div class="kpi-label">Fornecedores Críticos (<3)</div>
      </div>
    </div>

    <!-- Tabela de avaliações -->
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <div style="font-size:14px;font-weight:600;color:var(--text-primary)">${avals.length} avaliações registradas</div>
        <input type="text" placeholder="Buscar fornecedor..." oninput="filterAvaliacoes(this.value)" style="padding:7px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px">
      </div>
      <div id="aval-table">
        ${_renderAvalTable(avals)}
      </div>
    </div>

    <!-- Ranking de Fornecedores -->
    ${avals.length > 0 ? `
      <div class="card" style="margin-top:16px">
        <div class="card-header"><h3>Ranking de Fornecedores por Desempenho</h3></div>
        <div style="padding:16px">
          ${_getRankingFornecedores(avals).map((item, idx) => `
            <div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--border-color)">
              <div style="width:28px;height:28px;border-radius:50%;background:${idx===0?'#f59e0b':idx===1?'#9ca3af':idx===2?'#b87333':'var(--bg-tertiary)'};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;color:#fff;flex-shrink:0">${idx+1}</div>
              <div style="flex:1;font-weight:600;color:var(--text-primary)">${item.fornecedor}</div>
              <div style="display:flex;align-items:center;gap:8px">
                <div style="width:120px;height:8px;background:var(--bg-tertiary);border-radius:4px;overflow:hidden">
                  <div style="height:100%;border-radius:4px;background:${item.media>=4?'#22c55e':item.media>=3?'#f59e0b':'#ef4444'};width:${(item.media/5)*100}%"></div>
                </div>
                <span style="font-weight:700;color:${item.media>=4?'#22c55e':item.media>=3?'#f59e0b':'#ef4444'}">${item.media.toFixed(1)}</span>
              </div>
              <div style="font-size:11px;color:var(--text-muted)">${item.total} avaliações</div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}
  `;
}

function _renderAvalTable(avals) {
  if (!avals.length) return `<div style="text-align:center;padding:40px;color:var(--text-muted)">Nenhuma avaliação registrada.</div>`;
  return `
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead>
        <tr style="background:var(--bg-tertiary)">
          <th style="padding:9px 12px;text-align:left;color:var(--text-secondary);font-size:11px">Fornecedor</th>
          <th style="padding:9px 12px;text-align:center;color:var(--text-secondary);font-size:11px">Qualidade</th>
          <th style="padding:9px 12px;text-align:center;color:var(--text-secondary);font-size:11px">Prazo</th>
          <th style="padding:9px 12px;text-align:center;color:var(--text-secondary);font-size:11px">Preço</th>
          <th style="padding:9px 12px;text-align:center;color:var(--text-secondary);font-size:11px">Atendimento</th>
          <th style="padding:9px 12px;text-align:center;color:var(--text-secondary);font-size:11px">Nota Geral</th>
          <th style="padding:9px 12px;text-align:center;color:var(--text-secondary);font-size:11px">Pedido Ref.</th>
          <th style="padding:9px 12px;text-align:center;color:var(--text-secondary);font-size:11px">Data</th>
          <th style="padding:9px 12px;text-align:center;color:var(--text-secondary);font-size:11px">Ações</th>
        </tr>
      </thead>
      <tbody>
        ${avals.map(a => `
          <tr style="border-bottom:1px solid var(--border-color)" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='transparent'">
            <td style="padding:9px 12px;font-weight:600;color:var(--text-primary)">${a.fornecedor}</td>
            <td style="padding:9px 12px;text-align:center">${_starRating(a.qualidade)}</td>
            <td style="padding:9px 12px;text-align:center">${_starRating(a.prazo)}</td>
            <td style="padding:9px 12px;text-align:center">${_starRating(a.preco)}</td>
            <td style="padding:9px 12px;text-align:center">${_starRating(a.atendimento)}</td>
            <td style="padding:9px 12px;text-align:center">
              <span style="font-size:16px;font-weight:700;color:${(a.nota_geral||0)>=4?'#22c55e':(a.nota_geral||0)>=3?'#f59e0b':'#ef4444'}">${(a.nota_geral||0).toFixed(1)}</span>
            </td>
            <td style="padding:9px 12px;text-align:center;color:var(--text-muted);font-size:12px">${a.pedido_ref || '—'}</td>
            <td style="padding:9px 12px;text-align:center;color:var(--text-muted);font-size:12px">${a.data}</td>
            <td style="padding:9px 12px;text-align:center">
              <button onclick="verAvaliacaoDetalhe('${a.id}')" class="btn btn-sm btn-secondary"><i class="fas fa-eye"></i></button>
              <button onclick="editarAvaliacao('${a.id}')" class="btn btn-sm btn-secondary"><i class="fas fa-edit"></i></button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function _starRating(nota) {
  const n = Math.round(nota || 0);
  return `<span style="color:#f59e0b">${'★'.repeat(n)}</span><span style="color:var(--bg-tertiary)">${'★'.repeat(5-n)}</span>`;
}

function _getRankingFornecedores(avals) {
  const map = {};
  avals.forEach(a => {
    if (!map[a.fornecedor]) map[a.fornecedor] = { fornecedor: a.fornecedor, total: 0, soma: 0 };
    map[a.fornecedor].total++;
    map[a.fornecedor].soma += a.nota_geral || 0;
  });
  return Object.values(map).map(x => ({ ...x, media: x.soma / x.total })).sort((a,b) => b.media - a.media);
}

function filterAvaliacoes(search) {
  const avals = _getAvaliacoesForn().filter(a => a.fornecedor?.toLowerCase().includes(search.toLowerCase()));
  const wrap = document.getElementById('aval-table');
  if (wrap) wrap.innerHTML = _renderAvalTable(avals);
}

function _getFornecedoresCadastrados() {
  // Tenta FA_FORNECEDORES global primeiro, depois localStorage
  let lista = [];
  if (typeof FA_FORNECEDORES !== 'undefined' && FA_FORNECEDORES.length > 0) {
    lista = FA_FORNECEDORES;
  } else {
    try {
      const raw = localStorage.getItem('fa_fornecedores_cache');
      if (raw) lista = JSON.parse(raw);
    } catch(e) {}
  }
  return lista;
}

function openNovaAvaliacao() {
  const fornAll = _getFornecedoresCadastrados();
  const fornAtivos = fornAll.filter(f => f.status === 'Ativo' || f.status === 'Homologado');
  const fornList = fornAtivos.length > 0 ? fornAtivos : fornAll; // fallback: todos

  // Pedidos do localStorage como referência
  let pedidosList = [];
  try {
    const rawPed = localStorage.getItem('fa_pedidos') || localStorage.getItem('fraser_pedidos') || '[]';
    const todosPed = JSON.parse(rawPed);
    pedidosList = todosPed.filter(p =>
      p.status === 'Entregue Total' || p.status === 'Entregue' || p.status === 'Aprovado'
    );
  } catch(e) {}
  // Fallback: FA_PEDIDOS global
  if (pedidosList.length === 0 && typeof FA_PEDIDOS !== 'undefined') {
    pedidosList = FA_PEDIDOS.filter(p => p.status === 'Entregue Total' || p.status === 'Aprovado');
  }

  openModalWide('Nova Avaliação de Fornecedor', `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Fornecedor *</label>
        ${fornList.length > 0 ? `
          <div style="position:relative">
            <input type="text" id="avFornSearch" placeholder="Buscar fornecedor cadastrado..."
              oninput="_filtrarFornecedoresAval(this.value)"
              style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px 8px 0 0;color:var(--text-primary);font-size:13px;box-sizing:border-box">
            <select id="avFornSelect" size="4"
              style="width:100%;padding:4px 0;background:var(--bg-secondary);border:1px solid var(--border-color);border-top:none;border-radius:0 0 8px 8px;color:var(--text-primary);font-size:13px;box-sizing:border-box;max-height:120px;overflow-y:auto"
              onchange="document.getElementById('avFornSearch').value = this.options[this.selectedIndex]?.text || ''">
              ${fornList.map(f=>`<option value="${f.razao_social}">${f.razao_social}${f.categoria ? ' · ' + f.categoria : ''}</option>`).join('')}
            </select>
            <input type="hidden" id="avFornSelectedId" value="">
          </div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px">${fornList.length} fornecedor(es) cadastrado(s)</div>
        ` : `
          <input type="text" id="avFornInput" placeholder="Nome do fornecedor" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
          <div style="font-size:11px;color:#f59e0b;margin-top:4px"><i class="fas fa-exclamation-triangle"></i> Nenhum fornecedor cadastrado. Cadastre em Fornecedores primeiro.</div>
        `}
      </div>
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Pedido de Referência</label>
        ${pedidosList.length > 0 ? `
          <select id="avPedidoRef" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
            <option value="">— Sem vínculo de pedido —</option>
            ${pedidosList.map(p=>`<option value="${p.numero}">${p.numero} – ${p.fornecedor||p.descricao||''}</option>`).join('')}
          </select>
        ` : `
          <input type="text" id="avPedidoRefInput" placeholder="Número do pedido (opcional)" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
        `}
        <div style="font-size:11px;color:var(--text-muted);margin-top:4px">Vincule a uma entrega recebida</div>
      </div>
    </div>

    <!-- Critérios de avaliação com notas 1–5 -->
    <div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:10px;padding:16px;margin-bottom:12px">
      <div style="font-size:12px;font-weight:600;color:var(--text-primary);margin-bottom:12px">
        <i class="fas fa-star" style="color:var(--orange);margin-right:6px"></i>
        Critérios de Avaliação
        <span style="font-size:11px;color:var(--text-muted);font-weight:400;margin-left:8px">1 = Péssimo · 2 = Ruim · 3 = Regular · 4 = Bom · 5 = Excelente</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        ${[
          ['avQualidade', 'Qualidade do Produto/Serviço', 'fa-box-check', '#22c55e'],
          ['avPrazo',     'Cumprimento de Prazo',          'fa-clock',     '#3b82f6'],
          ['avPreco',     'Competitividade de Preço',       'fa-tag',       '#f59e0b'],
          ['avAtendimento','Atendimento / Suporte',         'fa-headset',   '#a855f7']
        ].map(([id, label, icon, color]) => `
          <div style="background:var(--bg-primary);border:1px solid var(--border-color);border-radius:8px;padding:12px">
            <label style="font-size:12px;color:var(--text-secondary);display:flex;align-items:center;gap:6px;margin-bottom:10px;font-weight:600">
              <i class="fas ${icon}" style="color:${color}"></i>${label}
            </label>
            <div style="display:flex;gap:6px;align-items:center">
              ${[1,2,3,4,5].map(n => `
                <button type="button" onclick="selecionarNota('${id}',${n})" id="${id}_${n}"
                  style="flex:1;height:38px;border:1px solid var(--border-color);border-radius:6px;
                         background:var(--bg-secondary);color:var(--text-secondary);cursor:pointer;
                         font-weight:700;font-size:14px;transition:all 0.15s;display:flex;align-items:center;justify-content:center"
                  title="${['','Péssimo','Ruim','Regular','Bom','Excelente'][n]}">
                  ${n}
                </button>
              `).join('')}
              <input type="hidden" id="${id}" value="3">
            </div>
            <div id="${id}_label" style="font-size:10px;color:var(--text-muted);text-align:center;margin-top:6px">Regular</div>
          </div>
        `).join('')}
      </div>
    </div>

    <div>
      <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Comentários / Observações</label>
      <textarea id="avObs" rows="3" placeholder="Descreva os pontos positivos e negativos do fornecedor..." style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box;resize:vertical"></textarea>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="salvarAvaliacao()"><i class="fas fa-save"></i> Salvar Avaliação</button>
  `);

  // Inicializa notas com 3 selecionado e labels
  setTimeout(() => {
    ['avQualidade','avPrazo','avPreco','avAtendimento'].forEach(id => selecionarNota(id, 3));
    // Seleciona primeiro item do select
    const sel = document.getElementById('avFornSelect');
    if (sel && sel.options.length > 0) sel.selectedIndex = 0;
  }, 100);
}

// Filtra a lista de fornecedores no select pelo texto digitado
function _filtrarFornecedoresAval(busca) {
  const fornAll = _getFornecedoresCadastrados();
  const fornList = fornAll.filter(f => f.status === 'Ativo' || f.status === 'Homologado' || !['Inativo','Bloqueado'].includes(f.status));
  const sel = document.getElementById('avFornSelect');
  if (!sel) return;
  const termo = (busca || '').toLowerCase();
  const filtrados = termo ? fornList.filter(f =>
    f.razao_social?.toLowerCase().includes(termo) ||
    f.nome_fantasia?.toLowerCase().includes(termo) ||
    f.categoria?.toLowerCase().includes(termo) ||
    f.cnpj?.includes(termo)
  ) : fornList;
  sel.innerHTML = filtrados.map(f =>
    `<option value="${f.razao_social}">${f.razao_social}${f.categoria ? ' · ' + f.categoria : ''}</option>`
  ).join('');
  if (sel.options.length > 0) sel.selectedIndex = 0;
}

function selecionarNota(campo, nota) {
  const labels = ['','Péssimo','Ruim','Regular','Bom','Excelente'];
  const colors = ['','#ef4444','#f97316','#f59e0b','#22c55e','#16a34a'];
  for (let n = 1; n <= 5; n++) {
    const btn = document.getElementById(`${campo}_${n}`);
    if (!btn) continue;
    if (n === nota) {
      btn.style.background = colors[nota] || 'var(--orange)';
      btn.style.color = '#fff';
      btn.style.borderColor = colors[nota] || 'var(--orange)';
      btn.style.transform = 'scale(1.1)';
      btn.classList.add('active');
    } else if (n < nota) {
      btn.style.background = (colors[nota] || 'var(--orange)') + '44';
      btn.style.color = colors[nota] || 'var(--orange)';
      btn.style.borderColor = (colors[nota] || 'var(--orange)') + '66';
      btn.style.transform = 'scale(1)';
      btn.classList.remove('active');
    } else {
      btn.style.background = 'var(--bg-secondary)';
      btn.style.color = 'var(--text-secondary)';
      btn.style.borderColor = 'var(--border-color)';
      btn.style.transform = 'scale(1)';
      btn.classList.remove('active');
    }
  }
  const hidden = document.getElementById(campo);
  if (hidden) hidden.value = nota;
  // Atualiza label de texto
  const labelEl = document.getElementById(`${campo}_label`);
  if (labelEl) {
    labelEl.textContent = labels[nota] || '';
    labelEl.style.color = colors[nota] || 'var(--text-muted)';
    labelEl.style.fontWeight = '600';
  }
}

function salvarAvaliacao() {
  // Pega o fornecedor: se tiver select com size, usa o valor; senão usa input de busca; senão input texto
  let forn = '';
  const fornSel = document.getElementById('avFornSelect');
  const fornSearch = document.getElementById('avFornSearch');
  const fornInput = document.getElementById('avFornInput');
  if (fornSel) {
    // Select com lista: usa o item selecionado
    forn = fornSel.value?.trim() || '';
    // Se o campo de busca tem texto mas não bateu com o select, usa o texto do select
    if (!forn && fornSel.options.length > 0) forn = fornSel.options[fornSel.selectedIndex]?.value || '';
  } else if (fornInput) {
    forn = fornInput.value?.trim() || '';
  }
  if (!forn) { showToast('Selecione ou informe o fornecedor.', 'error'); return; }

  const qualidade = parseInt(document.getElementById('avQualidade')?.value || 3);
  const prazo = parseInt(document.getElementById('avPrazo')?.value || 3);
  const preco = parseInt(document.getElementById('avPreco')?.value || 3);
  const atendimento = parseInt(document.getElementById('avAtendimento')?.value || 3);
  const nota_geral = ((qualidade + prazo + preco + atendimento) / 4);

  const pedidoRef = (document.getElementById('avPedidoRef') || document.getElementById('avPedidoRefInput'))?.value || '';

  const nova = {
    id: gerarId('AVAL'),
    fornecedor: forn,
    qualidade,
    prazo,
    preco,
    atendimento,
    nota_geral: parseFloat(nota_geral.toFixed(2)),
    pedido_ref: pedidoRef,
    avaliador: currentUser?.name || '',
    obs: document.getElementById('avObs')?.value || '',
    data: new Date().toLocaleDateString('pt-BR')
  };

  const avals = _getAvaliacoesForn();
  avals.unshift(nova);
  _saveAvaliacoesForn(avals);

  // Atualiza avaliação no cadastro do fornecedor
  if (typeof FA_FORNECEDORES !== 'undefined') {
    const forn_obj = FA_FORNECEDORES.find(f => f.razao_social === forn);
    if (forn_obj) {
      const avalsForns = avals.filter(a => a.fornecedor === forn);
      forn_obj.avaliacao = parseFloat((avalsForns.reduce((s,a) => s + a.nota_geral, 0) / avalsForns.length).toFixed(2));
    }
  }

  logAction('Criar', 'Avaliação', `Fornecedor ${forn} avaliado com nota ${nota_geral.toFixed(1)}`);
  closeModal();
  showToast(`Avaliação salva! Nota geral: ${nota_geral.toFixed(1)}/5`, 'success');
  renderAvaliacaoFornecedores();
}

function verAvaliacaoDetalhe(id) {
  const a = _getAvaliacoesForn().find(x => x.id === id);
  if (!a) return;
  openModal('Avaliação – ' + a.fornecedor, `
    <div style="display:grid;gap:8px;font-size:13px">
      <div style="text-align:center;margin-bottom:8px">
        <div style="font-size:32px;font-weight:700;color:${(a.nota_geral||0)>=4?'#22c55e':(a.nota_geral||0)>=3?'#f59e0b':'#ef4444'}">${(a.nota_geral||0).toFixed(1)}</div>
        <div style="font-size:12px;color:var(--text-muted)">Nota Geral</div>
      </div>
      ${[['Qualidade','avQualidade',a.qualidade],['Prazo','',a.prazo],['Preço','',a.preco],['Atendimento','',a.atendimento]].map(([lbl,,val]) => `
        <div style="display:flex;align-items:center;gap:12px">
          <span style="flex:1;color:var(--text-secondary)">${lbl}</span>
          ${_starRating(val)}
          <span style="font-weight:700">${val}/5</span>
        </div>
      `).join('')}
      ${a.obs ? `<div style="margin-top:8px;padding:10px;background:var(--bg-secondary);border-radius:8px;font-size:12px;color:var(--text-secondary)">${a.obs}</div>` : ''}
      <div style="font-size:11px;color:var(--text-muted)">Avaliado por ${a.avaliador} em ${a.data}</div>
    </div>
  `, `<button class="btn btn-secondary" onclick="closeModal()">Fechar</button>`);
}

function editarAvaliacao(id) {
  showToast('Funcionalidade de edição de avaliação disponível na próxima versão.', 'info');
}

function exportAvaliacoes() {
  const avals = _getAvaliacoesForn();
  if (!avals.length) { showToast('Nenhuma avaliação para exportar.', 'warning'); return; }
  const rows = [['Fornecedor','Qualidade','Prazo','Preço','Atendimento','Nota Geral','Pedido Ref','Avaliador','Data']];
  avals.forEach(a => rows.push([a.fornecedor, a.qualidade, a.prazo, a.preco, a.atendimento, a.nota_geral, a.pedido_ref, a.avaliador, a.data]));
  const csv = rows.map(r => r.map(c => `"${String(c||'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const el = document.createElement('a');
  el.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent('\uFEFF' + csv);
  el.download = 'Avaliacoes_Fornecedores_' + new Date().toISOString().split('T')[0] + '.csv';
  el.click();
  showToast('Avaliações exportadas!', 'success');
}

// ─── CADASTRO EM MASSA DE FORNECEDORES ───
function abrirCadastroMassaFornecedores() {
  openModalWide('Cadastro em Massa de Fornecedores', `
    <div style="margin-bottom:14px">
      <div style="font-size:13px;color:var(--text-secondary);margin-bottom:8px">
        Cole os dados no formato CSV abaixo (uma linha por fornecedor):
        <strong>Razão Social; CNPJ; Categoria; E-mail; Telefone; Estado; Cidade</strong>
      </div>
      <div style="background:rgba(0,180,184,0.06);border:1px solid rgba(0,180,184,0.2);border-radius:8px;padding:10px;font-size:11px;color:var(--text-muted);margin-bottom:10px;font-family:monospace">
        Exemplo:<br>
        Fornecedor Exemplo Ltda;XX.XXX.XXX/0001-00;Categoria;email@exemplo.com.br;(XX) XXXX-XXXX;UF;Cidade
      </div>
      <textarea id="massaFornCSV" rows="8" placeholder="Cole aqui os dados CSV..." style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:12px;font-family:monospace;box-sizing:border-box;resize:vertical"></textarea>
    </div>
    <div id="massaFornPreview" style="display:none">
      <div style="font-size:12px;font-weight:600;color:var(--text-primary);margin-bottom:6px">Pré-visualização:</div>
      <div id="massaFornPreviewContent"></div>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-secondary" onclick="previewMassaForn()"><i class="fas fa-eye"></i> Pré-visualizar</button>
    <button class="btn btn-primary" onclick="importarMassaForn()"><i class="fas fa-upload"></i> Importar Fornecedores</button>
  `);
}

function previewMassaForn() {
  const csv = document.getElementById('massaFornCSV')?.value?.trim();
  if (!csv) { showToast('Cole os dados CSV no campo.', 'warning'); return; }
  const linhas = csv.split('\n').filter(l => l.trim());
  const preview = document.getElementById('massaFornPreview');
  const content = document.getElementById('massaFornPreviewContent');
  if (!preview || !content) return;
  preview.style.display = 'block';
  content.innerHTML = `
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead><tr style="background:var(--bg-tertiary)">
        <th style="padding:6px 8px">Razão Social</th>
        <th style="padding:6px 8px">CNPJ</th>
        <th style="padding:6px 8px">Categoria</th>
        <th style="padding:6px 8px">E-mail</th>
        <th style="padding:6px 8px">Estado</th>
      </tr></thead>
      <tbody>
        ${linhas.slice(0,20).map(l => {
          const p = l.split(';').map(x => x.trim());
          return `<tr style="border-bottom:1px solid var(--border-color)">
            <td style="padding:5px 8px">${p[0]||'—'}</td>
            <td style="padding:5px 8px">${p[1]||'—'}</td>
            <td style="padding:5px 8px">${p[2]||'—'}</td>
            <td style="padding:5px 8px">${p[3]||'—'}</td>
            <td style="padding:5px 8px">${p[5]||'—'}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
    <div style="font-size:11px;color:var(--text-muted);margin-top:6px">${linhas.length} fornecedores encontrados para importação.</div>
  `;
}

function importarMassaForn() {
  const csv = document.getElementById('massaFornCSV')?.value?.trim();
  if (!csv) { showToast('Nenhum dado para importar.', 'warning'); return; }
  const linhas = csv.split('\n').filter(l => l.trim());
  let importados = 0;
  linhas.forEach(l => {
    const p = l.split(';').map(x => x.trim());
    if (!p[0]) return;
    const novoForn = {
      id: gerarId('FOR'),
      razao_social: p[0] || '',
      nome_fantasia: p[0] || '',
      cnpj: p[1] || '',
      categoria: p[2] || 'Outros',
      contato_email: p[3] || '',
      contato_telefone: p[4] || '',
      estado: p[5] || '',
      cidade: p[6] || '',
      status: 'Em Homologação',
      prazo_pagamento: 30,
      limite_credito: 0,
      avaliacao: 0,
      total_pedidos: 0,
      total_gasto: 0,
      documentos_ok: false,
      criado_em: new Date().toLocaleDateString('pt-BR')
    };
    if (typeof FA_FORNECEDORES !== 'undefined') FA_FORNECEDORES.push(novoForn);
    importados++;
  });
  logAction('Importar', 'Fornecedores', `${importados} fornecedores importados em massa`);
  closeModal();
  showToast(`${importados} fornecedores importados com sucesso! Status: Em Homologação.`, 'success', 5000);
}

// ─── CADASTRO EM MASSA DE MATERIAIS ───
function abrirCadastroMassaMateriais() {
  openModalWide('Cadastro em Massa de Materiais', `
    <div style="margin-bottom:14px">
      <div style="font-size:13px;color:var(--text-secondary);margin-bottom:8px">
        Cole os dados no formato CSV abaixo:
        <strong>Código; Descrição; Categoria; Unidade; Estoque Mínimo; Valor Unitário</strong>
      </div>
      <div style="background:rgba(0,180,184,0.06);border:1px solid rgba(0,180,184,0.2);border-radius:8px;padding:10px;font-size:11px;color:var(--text-muted);margin-bottom:10px;font-family:monospace">
        Exemplo:<br>
        ROL-6308;Rolamento Esférico 6308-ZZ;Rolamentos;Unidade;4;52.00<br>
        LUB-10L;Óleo Hidráulico VG 46 – 10L;Lubrificantes;Galão;10;45.00
      </div>
      <textarea id="massaMatCSV" rows="8" placeholder="Cole aqui os dados CSV..." style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:12px;font-family:monospace;box-sizing:border-box;resize:vertical"></textarea>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="importarMassaMateriais()"><i class="fas fa-upload"></i> Importar Materiais</button>
  `);
}

function importarMassaMateriais() {
  const csv = document.getElementById('massaMatCSV')?.value?.trim();
  if (!csv) { showToast('Nenhum dado para importar.', 'warning'); return; }
  const linhas = csv.split('\n').filter(l => l.trim());
  const mats = typeof _getMateriais === 'function' ? _getMateriais() : [];
  let importados = 0;
  linhas.forEach(l => {
    const p = l.split(';').map(x => x.trim());
    if (!p[1]) return;
    mats.push({
      id: gerarId('MAT'),
      codigo: p[0] || gerarId('COD'),
      descricao: p[1] || '',
      categoria: p[2] || 'Outros',
      unidade: p[3] || 'Un',
      estoque_min: parseInt(p[4] || 1),
      estoque_atual: 0,
      valor_unitario: parseFloat(p[5] || 0),
      contrato: 'Geral',
      status: 'Ativo',
      observacoes: ''
    });
    importados++;
  });
  if (typeof _saveMateriais === 'function') _saveMateriais(mats);
  logAction('Importar', 'Materiais', `${importados} materiais importados em massa`);
  closeModal();
  showToast(`${importados} materiais importados! Estoque inicial = 0.`, 'success');
}

// ─── MEDIÇÃO – GERAR RELATÓRIO PDF ───
function gerarRelatorioPDFMedicao(medicaoId) {
  const med = ERP_DATA.medicoes.find(m => m.id === medicaoId);
  if (!med) return;
  const contrato = ERP_DATA.contratos.find(c => c.id === med.contrato) || {};

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Relatório de Medição – ${med.id}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; color: #333; margin: 0; padding: 20px; background: #fff; }
  .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #00b4b8; padding-bottom: 12px; margin-bottom: 20px; }
  .logo-area { display: flex; align-items: center; gap: 16px; }
  .logo-area img { height: 50px; }
  .company { font-size: 18px; font-weight: 700; color: #00b4b8; }
  .doc-title { font-size: 14px; font-weight: 700; color: #333; text-align: right; }
  .doc-num { font-size: 11px; color: #666; text-align: right; }
  .section { margin-bottom: 16px; }
  .section-title { background: #00b4b8; color: #fff; padding: 6px 12px; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; border-radius: 4px 4px 0 0; }
  .section-body { border: 1px solid #ddd; border-top: none; padding: 12px; border-radius: 0 0 4px 4px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .info-item { display: flex; flex-direction: column; }
  .info-label { font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
  .info-value { font-size: 13px; font-weight: 600; color: #333; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { background: #f0f0f0; padding: 7px 10px; text-align: left; border: 1px solid #ddd; font-size: 10px; text-transform: uppercase; }
  td { padding: 6px 10px; border: 1px solid #ddd; }
  .total-row { background: #e8f8f8; font-weight: 700; }
  .badge { display: inline-block; padding: 3px 8px; border-radius: 10px; font-size: 10px; font-weight: 600; }
  .badge-aprovada { background: rgba(34,197,94,0.15); color: #166534; }
  .badge-rascunho { background: rgba(100,116,139,0.15); color: #475569; }
  .badge-analise { background: rgba(59,130,246,0.15); color: #1e40af; }
  .badge-paga { background: rgba(34,197,94,0.2); color: #166534; }
  .footer { margin-top: 24px; border-top: 1px solid #ddd; padding-top: 12px; display: flex; justify-content: space-between; font-size: 10px; color: #888; }
  .assinatura { border-top: 1px solid #333; width: 200px; text-align: center; padding-top: 4px; font-size: 10px; margin-top: 30px; }
  .value-positive { color: #166534; }
  .value-negative { color: #dc2626; }
</style>
</head>
<body>

<!-- HEADER -->
<div class="header">
  <div class="logo-area">
    <div>
      <div class="company">Fraser Alexander</div>
      <div style="font-size:11px;color:#666">Sistema de Gestão Integrado</div>
    </div>
  </div>
  <div>
    <div class="doc-title">RELATÓRIO DE MEDIÇÃO CONTRATUAL</div>
    <div class="doc-num">Nº ${med.id}</div>
    <div class="doc-num">Emitido em: ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
  </div>
</div>

<!-- IDENTIFICAÇÃO -->
<div class="section">
  <div class="section-title">Identificação da Medição</div>
  <div class="section-body">
    <div class="info-grid">
      <div class="info-item"><span class="info-label">Número da Medição</span><span class="info-value">${med.id}</span></div>
      <div class="info-item"><span class="info-label">Competência</span><span class="info-value">${med.competencia}</span></div>
      <div class="info-item"><span class="info-label">Contrato</span><span class="info-value">${med.contrato}</span></div>
      <div class="info-item"><span class="info-label">Cliente</span><span class="info-value">${med.cliente}</span></div>
      <div class="info-item"><span class="info-label">Status</span><span class="info-value">${med.status}</span></div>
      <div class="info-item"><span class="info-label">Previsão de Pagamento</span><span class="info-value">${med.previsaoPgto || '—'}</span></div>
    </div>
  </div>
</div>

<!-- DADOS DO CONTRATO -->
<div class="section">
  <div class="section-title">Dados do Contrato</div>
  <div class="section-body">
    <div class="info-grid">
      <div class="info-item"><span class="info-label">Objeto</span><span class="info-value">${contrato.descricao || '—'}</span></div>
      <div class="info-item"><span class="info-label">Gestor Responsável</span><span class="info-value">${contrato.gestor || '—'}</span></div>
      <div class="info-item"><span class="info-label">Vigência</span><span class="info-value">${contrato.inicio || '—'} a ${contrato.fim || '—'}</span></div>
      <div class="info-item"><span class="info-label">Valor Total do Contrato</span><span class="info-value value-positive">R$ ${(contrato.valor||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</span></div>
    </div>
  </div>
</div>

<!-- VALORES DA MEDIÇÃO -->
<div class="section">
  <div class="section-title">Composição dos Valores</div>
  <div class="section-body">
    <table>
      <thead>
        <tr>
          <th>Descrição</th>
          <th style="text-align:right">Valor (R$)</th>
          <th style="text-align:center">Observação</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Valor Bruto da Medição</td>
          <td style="text-align:right;font-weight:600">R$ ${(med.valorBruto||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
          <td style="text-align:center">Serviços executados no período</td>
        </tr>
        <tr>
          <td>Glosas / Descontos</td>
          <td style="text-align:right;color:${(med.glosa||0)>0?'#dc2626':'#666'}">
            ${(med.glosa||0)>0 ? '(R$ ' + (med.glosa||0).toLocaleString('pt-BR',{minimumFractionDigits:2}) + ')' : '—'}
          </td>
          <td style="text-align:center">${(med.glosa||0)>0 ? 'Glosas aplicadas pelo cliente' : 'Sem glosas'}</td>
        </tr>
        <tr class="total-row">
          <td><strong>Valor Líquido a Faturar</strong></td>
          <td style="text-align:right;color:#166534;font-size:14px">R$ ${(med.valorLiquido||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
          <td style="text-align:center">Base para emissão de NF</td>
        </tr>
      </tbody>
    </table>
  </div>
</div>

<!-- HISTÓRICO ACUMULADO -->
<div class="section">
  <div class="section-title">Situação Financeira do Contrato</div>
  <div class="section-body">
    <table>
      <thead>
        <tr>
          <th>Indicador</th>
          <th style="text-align:right">Valor</th>
          <th style="text-align:center">% do Contrato</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Valor Total do Contrato</td>
          <td style="text-align:right">R$ ${(contrato.valor||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
          <td style="text-align:center">100%</td>
        </tr>
        <tr>
          <td>Medido Acumulado</td>
          <td style="text-align:right;color:#1e40af">R$ ${(contrato.medidoAcum||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
          <td style="text-align:center">${contrato.valor ? ((contrato.medidoAcum/contrato.valor)*100).toFixed(1) : 0}%</td>
        </tr>
        <tr>
          <td>Custo Acumulado</td>
          <td style="text-align:right;color:#dc2626">R$ ${(contrato.custoAcum||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
          <td style="text-align:center">${contrato.valor ? ((contrato.custoAcum/contrato.valor)*100).toFixed(1) : 0}%</td>
        </tr>
        <tr class="total-row">
          <td><strong>Saldo a Executar</strong></td>
          <td style="text-align:right">${fmt((contrato.valor||0) - (contrato.medidoAcum||0))}</td>
          <td style="text-align:center">${contrato.valor ? (100 - (contrato.medidoAcum/contrato.valor)*100).toFixed(1) : 0}%</td>
        </tr>
      </tbody>
    </table>
  </div>
</div>

<!-- APROVAÇÃO -->
<div class="section">
  <div class="section-title">Aprovação e Assinaturas</div>
  <div class="section-body">
    <div style="display:flex;justify-content:space-around;margin-top:20px;flex-wrap:wrap;gap:20px">
      <div>
        <div class="assinatura">${contrato.gestor || 'Gestor do Contrato'}</div>
        <div style="font-size:10px;color:#666;text-align:center;margin-top:4px">Gestor Responsável</div>
      </div>
      <div>
        <div class="assinatura">${currentUser?.name || 'Diretor Geral'}</div>
        <div style="font-size:10px;color:#666;text-align:center;margin-top:4px">Diretor Geral – Fraser Alexander</div>
      </div>
      <div>
        <div class="assinatura">Representante do Cliente</div>
        <div style="font-size:10px;color:#666;text-align:center;margin-top:4px">Aprovador – ${med.cliente}</div>
      </div>
    </div>
  </div>
</div>

<!-- FOOTER -->
<div class="footer">
  <div>Fraser Alexander – Sistema de Gestão Integrado v4.0</div>
  <div>Documento gerado em ${new Date().toLocaleString('pt-BR')} · Medição ${med.id}</div>
  <div>CONFIDENCIAL – Uso interno</div>
</div>

</body>
</html>`;

  // Abre em nova janela para impressão/salvar como PDF
  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 800);
    showToast('Relatório PDF aberto para impressão/download!', 'success');
  } else {
    showToast('Permita pop-ups para gerar o PDF.', 'warning');
  }
  logAction('Exportar', 'Medição', `Relatório PDF gerado para ${med.id}`);
}

// ─── GESTÃO DE CONTRATOS TERCEIROS ───
function renderGestaoContratosTerceiros() {
  const isGestor = currentUser && ['admin','diretor','operacao','financeiro'].includes(currentUser.profile);
  if (!isGestor) {
    document.getElementById('mainContent').innerHTML = `<div class="empty-state"><i class="fas fa-lock"></i><p>Acesso restrito.</p></div>`;
    return;
  }

  const chave = 'fa_contratos_terceiros';
  let contratos3rd = [];
  try { contratos3rd = JSON.parse(localStorage.getItem(chave) || '[]'); } catch(e) {}

  document.getElementById('mainContent').innerHTML = `
    <div class="page-header">
      <div class="page-title">
        <h2><i class="fas fa-file-contract" style="color:var(--orange);margin-right:8px"></i>Contratos de Terceiros</h2>
        <p>Gestão de medições mensais, aprovações e fluxo financeiro de contratos terceirizados</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary btn-sm" onclick="openNovoContrato3rd()"><i class="fas fa-plus"></i> Novo Contrato</button>
      </div>
    </div>

    ${contratos3rd.length === 0 ? `
      <div class="card">
        <div style="text-align:center;padding:60px;color:var(--text-muted)">
          <i class="fas fa-file-contract" style="font-size:40px;margin-bottom:12px;display:block"></i>
          Nenhum contrato de terceiros cadastrado.
          <div style="margin-top:16px"><button class="btn btn-primary btn-sm" onclick="openNovoContrato3rd()"><i class="fas fa-plus"></i> Cadastrar Primeiro Contrato</button></div>
        </div>
      </div>
    ` : `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:16px">
        ${contratos3rd.map(c => `
          <div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:12px;padding:16px">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
              <div>
                <div style="font-weight:700;color:var(--text-primary)">${c.fornecedor}</div>
                <div style="font-size:12px;color:var(--text-muted)">${c.objeto}</div>
              </div>
              ${statusBadge(c.status)}
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;font-size:12px">
              <div><span style="color:var(--text-muted)">Valor Mensal:</span><br><strong style="color:var(--fa-teal)">${fmt(c.valor_mensal)}</strong></div>
              <div><span style="color:var(--text-muted)">Duração:</span><br><strong>${c.duracao_meses} meses</strong></div>
              <div><span style="color:var(--text-muted)">Medido (acum.):</span><br><strong style="color:#22c55e">${fmt(c.medido_acum||0)}</strong></div>
              <div><span style="color:var(--text-muted)">Saldo:</span><br><strong style="color:#f59e0b">${fmt((c.valor_mensal*(c.duracao_meses||0)) - (c.medido_acum||0))}</strong></div>
            </div>
            <div style="height:6px;background:var(--bg-tertiary);border-radius:4px;margin-bottom:12px;overflow:hidden">
              <div style="height:100%;background:var(--fa-teal);border-radius:4px;width:${Math.min(100,((c.medido_acum||0)/(c.valor_mensal*c.duracao_meses)*100)||0).toFixed(0)}%"></div>
            </div>
            <div style="display:flex;gap:8px">
              <button onclick="lancarMedicao3rd('${c.id}')" class="btn btn-primary btn-sm" style="flex:1"><i class="fas fa-ruler-combined"></i> Lançar Medição</button>
              <button onclick="verHistorico3rd('${c.id}')" class="btn btn-secondary btn-sm"><i class="fas fa-history"></i></button>
              <button onclick="editarContrato3rd('${c.id}')" class="btn btn-secondary btn-sm"><i class="fas fa-edit"></i></button>
            </div>
          </div>
        `).join('')}
      </div>
    `}
  `;
}

function openNovoContrato3rd() {
  openModalWide('Novo Contrato de Terceiro', `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div style="grid-column:1/-1">
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Fornecedor / Empresa Terceira *</label>
        <input type="text" id="c3Forn" placeholder="Razão social" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
      </div>
      <div style="grid-column:1/-1">
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Objeto do Contrato</label>
        <input type="text" id="c3Objeto" placeholder="Descrição dos serviços" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
      </div>
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Valor Mensal (R$)</label>
        <input type="number" id="c3Mensal" min="0" placeholder="0" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
      </div>
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Duração (meses)</label>
        <input type="number" id="c3Duracao" min="1" value="12" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
      </div>
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Data de Início</label>
        <input type="date" id="c3Inicio" value="${new Date().toISOString().split('T')[0]}" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
      </div>
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Gestor Responsável</label>
        <input type="text" id="c3Gestor" value="${currentUser?.name||''}" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
      </div>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="salvarNovoContrato3rd()"><i class="fas fa-save"></i> Cadastrar</button>
  `);
}

function salvarNovoContrato3rd() {
  const forn = document.getElementById('c3Forn')?.value?.trim();
  if (!forn) { showToast('Informe o fornecedor.', 'error'); return; }
  const chave = 'fa_contratos_terceiros';
  let contratos3rd = [];
  try { contratos3rd = JSON.parse(localStorage.getItem(chave) || '[]'); } catch(e) {}
  const inicioRaw = document.getElementById('c3Inicio')?.value;
  contratos3rd.push({
    id: gerarId('C3'),
    fornecedor: forn,
    objeto: document.getElementById('c3Objeto')?.value || '',
    valor_mensal: parseFloat(document.getElementById('c3Mensal')?.value || 0),
    duracao_meses: parseInt(document.getElementById('c3Duracao')?.value || 12),
    inicio: inicioRaw ? new Date(inicioRaw+'T12:00:00').toLocaleDateString('pt-BR') : '',
    gestor: document.getElementById('c3Gestor')?.value || '',
    status: 'Ativo',
    medido_acum: 0,
    historico: []
  });
  localStorage.setItem(chave, JSON.stringify(contratos3rd));
  logAction('Criar', 'Contratos Terceiros', `Contrato terceiro com ${forn} cadastrado`);
  closeModal();
  showToast('Contrato cadastrado!', 'success');
  renderGestaoContratosTerceiros();
}

function lancarMedicao3rd(id) {
  const chave = 'fa_contratos_terceiros';
  let contratos3rd = [];
  try { contratos3rd = JSON.parse(localStorage.getItem(chave) || '[]'); } catch(e) {}
  const c = contratos3rd.find(x => x.id === id);
  if (!c) return;

  openModal('Lançar Medição – ' + c.fornecedor, `
    <div style="display:grid;gap:12px">
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Competência (mês/ano)</label>
        <input type="month" id="m3Comp" value="${new Date().toISOString().slice(0,7)}" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
      </div>
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Valor Medido (R$) *</label>
        <input type="number" id="m3Valor" value="${c.valor_mensal}" min="0" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
      </div>
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Anexo (NF / Boletim)</label>
        <input type="text" id="m3Anexo" placeholder="Nome do arquivo..." style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
      </div>
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Observações</label>
        <textarea id="m3Obs" rows="2" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box;resize:vertical"></textarea>
      </div>
    </div>
    <div style="margin-top:10px;padding:10px;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.3);border-radius:8px;font-size:12px;color:#f59e0b">
      <i class="fas fa-info-circle"></i> Se o valor superar o orçamento mensal (R$ ${fmt(c.valor_mensal)}), será solicitada aprovação do Gerente de Projetos.
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="salvarMedicao3rd('${id}')"><i class="fas fa-save"></i> Lançar Medição</button>
  `);
}

function salvarMedicao3rd(id) {
  const valor = parseFloat(document.getElementById('m3Valor')?.value || 0);
  const chave = 'fa_contratos_terceiros';
  let contratos3rd = [];
  try { contratos3rd = JSON.parse(localStorage.getItem(chave) || '[]'); } catch(e) {}
  const c = contratos3rd.find(x => x.id === id);
  if (!c) return;

  const competenciaRaw = document.getElementById('m3Comp')?.value || '';
  const competencia = competenciaRaw ? competenciaRaw.split('-').reverse().join('/').replace(/\//g, '/').slice(-7) : new Date().toLocaleDateString('pt-BR').slice(3);

  const item = {
    competencia,
    valor,
    anexo: document.getElementById('m3Anexo')?.value || '',
    obs: document.getElementById('m3Obs')?.value || '',
    data: new Date().toLocaleDateString('pt-BR'),
    status: valor > c.valor_mensal ? 'Aguardando Aprovação GP' : 'Aprovada',
    aprovado_por: valor <= c.valor_mensal ? currentUser?.name || '' : ''
  };

  if (!c.historico) c.historico = [];
  c.historico.unshift(item);
  c.medido_acum = (c.medido_acum || 0) + valor;
  localStorage.setItem(chave, JSON.stringify(contratos3rd));

  logAction('Criar', 'Medição Terceiros', `Medição ${competencia} lançada para ${c.fornecedor} – ${fmt(valor)}`);
  closeModal();

  if (valor > c.valor_mensal) {
    showToast(`Valor acima do orçamento! Aguardando aprovação do Gerente de Projetos.`, 'warning', 6000);
  } else {
    showToast('Medição lançada com sucesso!', 'success');
    // Gera CP automaticamente se dentro do orçamento
    if (typeof FA_CONTAS_PAGAR !== 'undefined') {
      FA_CONTAS_PAGAR.unshift({
        id: gerarId('CP'),
        descricao: `Medição ${competencia} – ${c.objeto}`,
        fornecedor_nome: c.fornecedor,
        tipo: 'Contrato Terceiro',
        contrato_id: '',
        valor,
        vencimento: new Date(Date.now()+30*24*60*60*1000).toLocaleDateString('pt-BR'),
        nf: item.anexo,
        status: 'Pendente',
        cond_pagamento: '30 dias',
        conta_contabil: 'Contratos Terceiros'
      });
    }
  }
  renderGestaoContratosTerceiros();
}

function verHistorico3rd(id) {
  const chave = 'fa_contratos_terceiros';
  let contratos3rd = [];
  try { contratos3rd = JSON.parse(localStorage.getItem(chave) || '[]'); } catch(e) {}
  const c = contratos3rd.find(x => x.id === id);
  if (!c) return;
  openModal('Histórico – ' + c.fornecedor, `
    ${(c.historico||[]).length === 0 ? '<div style="text-align:center;color:var(--text-muted);padding:20px">Nenhuma medição registrada.</div>' :
      `<table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr style="background:var(--bg-tertiary)">
          <th style="padding:7px 10px">Competência</th>
          <th style="padding:7px 10px;text-align:right">Valor</th>
          <th style="padding:7px 10px">Status</th>
          <th style="padding:7px 10px">Data</th>
        </tr></thead>
        <tbody>
          ${(c.historico||[]).map(h => `
            <tr style="border-bottom:1px solid var(--border-color)">
              <td style="padding:7px 10px">${h.competencia}</td>
              <td style="padding:7px 10px;text-align:right;font-weight:600">${fmt(h.valor)}</td>
              <td style="padding:7px 10px">${statusBadge(h.status)}</td>
              <td style="padding:7px 10px;color:var(--text-muted)">${h.data}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>`
    }
  `, `<button class="btn btn-secondary" onclick="closeModal()">Fechar</button>`);
}

function editarContrato3rd(id) {
  showToast('Edição de contratos terceiros disponível em breve.', 'info');
}
